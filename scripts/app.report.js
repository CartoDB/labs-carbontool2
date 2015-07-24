var reporting = (function () {
  var config = {
    cdbUser: 'carbon-tool',
    tooltipText : {
      enabled: 'Launch the report',
      disabled: 'Select an area to analyse'
    },
    selectors: {
      launchButton: '#launch-button',
      areaTooBig: '#modal-area-too-big'
    }
  }


  var geometryReport ;
  var geometryType;

  var types = {'CIRCLE':0,'POLYGON':1,'VIEW':2};

  var sqlClient = new cartodb.SQL({user: config.cdbUser});



  var QUERIES = {
    'CARBON'            : "SELECT SUM((ST_Value(rast, 1, x, y) / 100) * ((ST_Area(ST_Transform(ST_SetSRID(ST_PixelAsPolygon(rast, x, y), 4326), 954009)) / 10000) / 100)) AS total, ST_Area(<%= polygon %>::geography) as area FROM carbonsequestration CROSS JOIN generate_series(1,10) As x CROSS JOIN generate_series(1,10) As y WHERE rid in ( SELECT rid FROM carbonsequestration WHERE ST_Intersects(rast, <%= polygon %>) ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast), ST_UpperLeftY(rast)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), <%= polygon %> );",
    'CARBON_COUNTRIES'  : "SET statement_timeout TO 100000; SELECT country, SUM((ST_Value(rast, 1, x, y) / 100) * ((ST_Area(ST_Transform(ST_SetSRID(ST_PixelAsPolygon(rast, x, y), 4326), 954009)) / 10000) / 100)) AS total, ST_Area(<%= polygon %>::geography) as area FROM carbonintersection CROSS JOIN generate_series(1,10) As x CROSS JOIN generate_series(1,10) As y CROSS JOIN countries WHERE rid IN ( SELECT rid FROM carbonintersection WHERE ST_Intersects(rast, <%= polygon %>) ) AND objectid IN ( SELECT objectid FROM countries WHERE ST_Intersects(the_geom, <%= polygon %>) ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast) + (ST_ScaleX(rast)/2), ST_UpperLeftY(rast) + (ST_ScaleY(rast)/2)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), <%= polygon %> ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast) + (ST_ScaleX(rast)/2), ST_UpperLeftY(rast) + (ST_ScaleY(rast)/2)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), the_geom ) GROUP BY country;",
    'RESTORATION'       : "SELECT band, AVG(ST_Value(rast, band, x, y)) AS percentage FROM restorationpotencial CROSS JOIN generate_series(1,10) As x CROSS JOIN generate_series(1,10) As y CROSS JOIN generate_series(1,4) As band WHERE rid in ( SELECT rid FROM restorationpotencial WHERE ST_Intersects(rast, <%= polygon %>) ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast), ST_UpperLeftY(rast)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), <%= polygon %> ) GROUP BY band;",
    'FOREST'            : "SELECT band, SUM(ST_Value(rast, band, x, y)) AS total FROM forestintactness CROSS JOIN generate_series(1,10) As x CROSS JOIN generate_series(1,10) As y CROSS JOIN generate_series(1,4) As band WHERE rid in ( SELECT rid FROM forestintactness WHERE ST_Intersects(rast, <%= polygon %>) ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast), ST_UpperLeftY(rast)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), <%= polygon %> ) GROUP BY band;",
    'COVERED_KBA'       : "SELECT (overlapped_area / ( SELECT ST_Area( ST_MakeValid(<%= polygon %>) ) LIMIT 1 )) * 100 AS kba_percentage, count FROM ( SELECT COUNT(1), ST_Area( ST_Intersection( ST_Union(the_geom), ST_MakeValid(<%= polygon %>) )) AS overlapped_area FROM kba WHERE ST_Intersects(ST_MakeValid(<%= polygon %>) , the_geom) ) foo",
    'COUNTRIES'         : "SELECT priority, country, ST_Area(ST_Intersection(ST_Union(mg.the_geom)::geography, <%= polygon %>::geography )) AS covered_area FROM gaps_merged mg WHERE ST_Intersects(mg.the_geom, <%= polygon %> ) GROUP BY priority, country"
  }

  var addReportButton = function(){
    $(config.selectors.launchButton).removeClass('button--gray');
    $(config.selectors.launchButton).addClass('button--blue');
    $(config.selectors.launchButton + ' .Tooltip').text(config.tooltipText.enabled);
  }

  var reportAreaTooBig = function(){
    $(config.selectors.areaTooBig).fadeIn();
    $(config.selectors.launchButton).removeClass('button--blue');
    $(config.selectors.launchButton).addClass('button--gray');
    $(config.selectors.launchButton + ' .Tooltip').text(config.tooltipText.disabled);
  }


  var reportCurrentView = function(bounds){
    addReportButton();
    console.log("report current view");
    geometryReport = bounds;
    geometryType = types.VIEW;
  }

  var reportCircle = function(circle){
    addReportButton();
    console.log("report circle");
    geometryReport = circle;
    geometryType = types.CIRCLE;
  }

  var reportPolygon = function(polygon){
    addReportButton();
    console.log("report polygon");
    geometryReport = polygon;
    geometryType = types.POLYGON;

  }

  var getSQLGeometry = function(form){
    var sql = "";
    if (geometryType == types.VIEW){
      var coords = [[
          form.getNorthEast(),
          form.getSouthEast(),
          form.getSouthWest(),
          form.getNorthWest(),
          form.getNorthEast()
        ].map(function(p){return [p.lng,p.lat]})];
      sql = 'ST_GeomFromText( \'' + wtk_polygon(coords)  + '\',4326)';
    } else if (geometryType == types.POLYGON){
      var coords = [form.getLatLngs().map(function(p){return [p.lng,p.lat]})];
      sql = 'ST_GeomFromText( \'' + wtk_polygon(coords)  + '\',4326)'
    } else if (geometryType == types.CIRCLE){
      var lat = form.getLatLng().lat;
      var lon = form.getLatLng().lng;
      var radius = Math.round(form.getRadius());
      sql = 'ST_Buffer(ST_GeomFromText(\'POINT ( ' + lon + ' ' + lat + ')\',4326)::geography,' + radius + ')::geometry';
    }

    console.log(sql);
    return sql;
  }

  var launchReport = function(e){
    var geom = getSQLGeometry(geometryReport);

    sqlClient.execute(_.template(QUERIES.COVERED_KBA)({polygon: geom}))
      .done(function(data){
        //Put the result on the report
        if (data.rows.length){
          var result = data.rows[0];
          if (result.kba_percentage){
            $('.report .covered-kba .title .value').text(result.kba_percentage.toFixed(1));
            $('.report .covered-kba .detail .value').text(result.count);
            $('.report').show();
            $('.report .covered-kba').show();
          }
        }
      });

    sqlClient.execute(_.template(QUERIES.CARBON)({polygon: geom}))
      .done(function(data){
        if (data.rows.length){
          var result = data.rows[0];
          console.log(result);
          $('.report .cseq .title .value').text(formatNumber(result.total.toFixed(0)));
          $('.report').show();
          $('.report .cseq').show();
        }
      });

    sqlClient.execute(_.template(QUERIES.FOREST)({polygon: geom}))
      .done(function(data){
        if (data.rows.length>0){
          var results = data.rows;
          var total = results.map(function(o){return o.total}).reduce(function(p,c){return p + c});

          var getBandPercentage = function(band){
            return (results.filter(function(o){return o.band == band})[0]).total/total * 100;
          }

          var deforested     = getBandPercentage(1);
          var fragmented     = getBandPercentage(2);
          var intact         = getBandPercentage(3);
          var partDeforested = getBandPercentage(4);

          // TODO Format into HTML
          debugger;
          console.log(result);
          $('.report .forest .detail .value1').text(formatNumber(result.total.toFixed(0)));
          $('.report').show();
          $('.report .forest').show();
        }

      });



    console.log("CARBON");
    console.log(_.template(QUERIES.CARBON)({polygon: geom}));

    console.log("CARBON_COUNTRIES");
    console.log(_.template(QUERIES.CARBON_COUNTRIES)({polygon: geom}));

    console.log("CARBON_COUNTRIES");
    console.log(_.template(QUERIES.CARBON_COUNTRIES)({polygon: geom}));

    console.log("RESTORATION");
    console.log(_.template(QUERIES.RESTORATION)({polygon: geom}));

    console.log("FOREST");
    console.log(_.template(QUERIES.FOREST)({polygon: geom}));

    console.log("COVERED_KBA");
    console.log(_.template(QUERIES.COVERED_KBA)({polygon: geom}));

    console.log("COUNTRIES");
    console.log(_.template(QUERIES.COUNTRIES)({polygon: geom}));


  }

  // From http://viz-carbontool.appspot.com/tool
  var wtk_polygon = function(poly) {
        var multipoly = [];
        _.each(poly, function(p) {
            var closed = p.concat([p[0]]);
            var wtk = _.map(closed, function(point) {
                return point[1] + " " + point[0];
            }).join(',');
            multipoly.push("((" + wtk + "))");
        });
        return 'MULTIPOLYGON(' + multipoly.join(',') + ')';
    }

  // From http://www.mredkj.com/javascript/numberFormat.html
  var formatNumber = function(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  }

	return {
    getReports : {
      'circle' : reportCircle,
      'polygon': reportPolygon,
      'current-view': reportCurrentView
    },
    getReportAreaTooBig : reportAreaTooBig,
    init : function (newConfig) {
      _.extend(config,newConfig);
      $(config.selectors.launchButton).click(launchReport);
    }
  }
})();
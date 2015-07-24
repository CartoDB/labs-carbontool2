var reporting = (function () {
  var config = {
    cdbUser: 'carbon-tool',
    launchButtonTexts: {
      launch : 'Launch',
      running: 'Running...'
    },
    tooltipText : {
      enabled: 'Launch the report',
      disabled: 'Select an area to analyse',
      running: 'Wait until the analysis is finished'
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
    $(config.selectors.launchButton)
      .removeClass('button--gray')
      .removeClass('button--red')
      .addClass('button--blue')
      .removeAttr('disabled');

    $(config.selectors.launchButton + ' .title')
      .text(config.launchButtonTexts.launch);

    $(config.selectors.launchButton + ' .Tooltip').text(config.tooltipText.enabled);
  };

  var disableReportButton = function(text,color,tooltip){
    $(config.selectors.launchButton)
      .removeClass('button--blue')
      .addClass(color ? color : 'button--gray')
      .attr('disabled','disabled');

    $(config.selectors.launchButton + ' .title')
      .text(text ? text : config.launchButtonTexts.launch);

    $(config.selectors.launchButton + ' .Tooltip').text(
      tooltip ? tooltip : config.tooltipText.disabled
    );
  };



  var reportAreaTooBig = function(){
    $(config.selectors.areaTooBig).fadeIn();
    disableReportButton();
  };


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

    disableReportButton(
      config.launchButtonTexts.running,
      'button--red'
      ,config.tooltipText.running
    );

    var d1 = $.Deferred();
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
        d1.resolve(data.time);
      });

    var d2 = $.Deferred();
    sqlClient.execute(_.template(QUERIES.CARBON)({polygon: geom}))
      .done(function(data){
        if (data.rows.length){
          var result = data.rows[0];
          if (result.total){
            $('.report .cseq .title .value').text(formatNumber(result.total.toFixed(0)));
            $('.report').show();
            $('.report .cseq').show();
          }
        }
        d2.resolve(data.time);
      });

    var d3 = $.Deferred();
    sqlClient.execute(_.template(QUERIES.FOREST)({polygon: geom}))
      .done(function(data){
        if (data.rows.length>0){
          var results = data.rows;
          var total = results.map(function(o){return o.total}).reduce(function(p,c){return p + c});

          var getBandPercentage = function(band){
            var value = (results.filter(function(o){return o.band == band})[0]).total/total * 100;
            return value.toFixed(0) + '%';
          }

          var deforested = getBandPercentage(1);
          var fragmented = getBandPercentage(2);
          var intact     = getBandPercentage(3);
          var partially  = getBandPercentage(4);

          $('.report .forest-status .detail .deforested').text(deforested);
          $('.report .forest-status .detail .fragmented').text(fragmented);
          $('.report .forest-status .detail .intact').text(intact);
          $('.report .forest-status .detail .partially').text(partially);
          $('.report').show();
          $('.report .forest-status').show();
        }
        d3.resolve(data.time);
      });

    var d4 = $.Deferred();
    sqlClient.execute(_.template(QUERIES.RESTORATION)({polygon: geom}))
      .done(function(data){
        if (data.rows.length>0){
          var value_map = {'1': 'wide_scale', '2': 'mosaic', '3': 'remote', '4':'agricultural lands'};
          var stats = {
            'wide_scale': 0,
            'mosaic': 0,
            'remote': 0,
            'none': 0
          };
          var total = 1.0;
          var percent = 100.0;
          _.each(data.rows, function(x) {
              var p = x.percentage;
              percent -= p;
              stats[value_map[x.band]] = p;
          });
          stats.none = percent;

          $('.report .forest-restoration .detail .wide_scale').text(stats.wide_scale.toFixed(0) + '%');
          $('.report .forest-restoration .detail .mosaic').text(stats.mosaic.toFixed(0) + '%');
          $('.report .forest-restoration .detail .remote').text(stats.remote.toFixed(0) + '%');
          $('.report .forest-restoration .detail .none').text(stats.none.toFixed(0) + '%');
          $('.report').show();
          $('.report .forest-restoration').show();
        }
        d4.resolve(data.time);
      });

    var d5 = $.Deferred();
    sqlClient.execute(_.template(QUERIES.CARBON_COUNTRIES)({polygon: geom}))
      .done(function(data){
        if (data.rows.length>0){
          data.rows.sort(function(a,b){
            return a.total < b.total;
          });
          var total = data.rows
            .map(function(o){return o.total})
            .reduce(function(c,p){return c + p });

          $('.report .carbon-countries .title .value').text(formatNumber(total.toFixed(0)));

          data.rows.forEach(function(row){
            var country = row.country;
            var total = row.total;
            $('.report .carbon-countries ul').append(
              '<li class="block clearfix"><p class="u-left">'+country+'</p>' +
              '<p class="u-right">'+formatNumber(total.toFixed(0)) + ' T</p></li>'
              );
          });

          $('.report').show();
          $('.report .carbon-countries').show();
        }
        d5.resolve(data.time);
      });


    $.when(d1,d2,d3,d4,d5).done(function(v1,v2,v3,v4,v5){
      console.log("Total time" + (v1 + v2 + v3 + v4 + v5))
      addReportButton();
      debugger;
    });
  };

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
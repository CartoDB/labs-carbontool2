var reporting = (function () {  
  var geometryReport ;
  var geometryType;

  var types = {'CIRCLE':0,'POLYGON':1,'VIEW':2};

  var config = {
    tooltipText : {
      enabled: 'Launch the report',
      disabled: 'Select an area to analyse'
    }
  }

  var QUERIES = {
    'CARBON'            : "SELECT SUM((ST_Value(rast, 1, x, y) / 100) * ((ST_Area(ST_Transform(ST_SetSRID(ST_PixelAsPolygon(rast, x, y), 4326), 954009)) / 10000) / 100)) AS total, ST_Area(<%= polygon %>::geography) as area FROM carbonsequestration CROSS JOIN generate_series(1,10) As x CROSS JOIN generate_series(1,10) As y WHERE rid in ( SELECT rid FROM carbonsequestration WHERE ST_Intersects(rast, <%= polygon %>) ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast), ST_UpperLeftY(rast)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), <%= polygon %> );",
    'CARBON_COUNTRIES'  : "SET statement_timeout TO 100000; SELECT country, SUM((ST_Value(rast, 1, x, y) / 100) * ((ST_Area(ST_Transform(ST_SetSRID(ST_PixelAsPolygon(rast, x, y), 4326), 954009)) / 10000) / 100)) AS total, ST_Area(<%= polygon %>::geography) as area FROM carbonintersection CROSS JOIN generate_series(1,10) As x CROSS JOIN generate_series(1,10) As y CROSS JOIN countries WHERE rid IN ( SELECT rid FROM carbonintersection WHERE ST_Intersects(rast, <%= polygon %>) ) AND objectid IN ( SELECT objectid FROM countries WHERE ST_Intersects(the_geom, <%= polygon %>) ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast) + (ST_ScaleX(rast)/2), ST_UpperLeftY(rast) + (ST_ScaleY(rast)/2)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), <%= polygon %> ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast) + (ST_ScaleX(rast)/2), ST_UpperLeftY(rast) + (ST_ScaleY(rast)/2)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), the_geom ) GROUP BY country;",
    'RESTORATION'       : "SELECT band, AVG(ST_Value(rast, band, x, y)) AS percentage FROM restorationpotencial CROSS JOIN generate_series(1,10) As x CROSS JOIN generate_series(1,10) As y CROSS JOIN generate_series(1,4) As band WHERE rid in ( SELECT rid FROM restorationpotencial WHERE ST_Intersects(rast, <%= polygon %>) ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast), ST_UpperLeftY(rast)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), <%= polygon %> ) GROUP BY band;",
    'FOREST'            : "SELECT band, SUM(ST_Value(rast, band, x, y)) AS total FROM forestintactness CROSS JOIN generate_series(1,10) As x CROSS JOIN generate_series(1,10) As y CROSS JOIN generate_series(1,4) As band WHERE rid in ( SELECT rid FROM forestintactness WHERE ST_Intersects(rast, <%= polygon %>) ) AND ST_Intersects(ST_Translate(ST_SetSRID(ST_Point(ST_UpperLeftX(rast), ST_UpperLeftY(rast)), 4326), ST_ScaleX(rast)*x, ST_ScaleY(rast)*y), <%= polygon %> ) GROUP BY band;",
    'COVERED_KBA'       : "SELECT (overlapped_area / ( SELECT ST_Area( ST_MakeValid(<%= polygon %>) ) LIMIT 1 )) * 100 AS kba_percentage, count FROM ( SELECT COUNT(1), ST_Area( ST_Intersection( ST_Union(the_geom), ST_MakeValid(<%= polygon %>) )) AS overlapped_area FROM kba WHERE ST_Intersects(ST_MakeValid(<%= polygon %>) , the_geom) ) foo",
    'COUNTRIES'         : "SELECT priority, country, ST_Area(ST_Intersection(ST_Union(mg.the_geom)::geography, <%= polygon %>::geography )) AS covered_area FROM gaps_merged mg WHERE ST_Intersects(mg.the_geom, <%= polygon %> ) GROUP BY priority, country"
  }

  var addReportButton = function(){
    $('#select-area').removeClass('button--gray');
    $('#select-area').addClass('button--blue');
    $('#select-area .Tooltip').text(config.tooltipText.enabled);
  }

  var reportAreaTooBig = function(){
    $('#modal-area-too-big').fadeIn();
    $('#select-area').removeClass('button--blue');
    $('#select-area').addClass('button--gray');
    $('#select-area .Tooltip').text(config.tooltipText.disabled);
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

	return {
    getReports : {
      'circle' : reportCircle,
      'polygon': reportPolygon,
      'current-view': reportCurrentView
    },
    getReportAreaTooBig : reportAreaTooBig,
    init : function (newConfig) {
      _.extend(config,newConfig);
      $('#select-area').click(launchReport);
    }
  }
})();
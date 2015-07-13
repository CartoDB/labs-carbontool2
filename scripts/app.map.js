var mapping = (function () {  
  var editableLayers;

  var callbacks = {
    'current-view' : function(bounds){
      console.log(bounds);
    },
    'circle' : function(circle){
      console.log(circle);
    },
    'polygon': function(polygon){
      console.log(polygon);
    }
  };

  var config = {
    MAX_POLYGON_AREA: 8000000*1000*1000,// #8.000.000km^2
    MAP_LAYERS: [
      /*
      {
         name: 'protected areas',
         url: 'http://184.73.201.235/blue/{z}/{x}/{y}',
         opacity: 0.7,
         enabled: true
      }, */
      {
         name: 'carbon',
         opacity: 0.7,
         url: 'http://lifeweb-maps.unep-wcmc.org/ArcGIS/rest/services/lifeweb/carbon/MapServer/tile/{z}/{y}/{x}',
         enabled: true
      }, {
        name: 'carbon sequestration',
        opacity: 0.7,
        url: 'http://lifeweb-maps.unep-wcmc.org/ArcGIS/rest/services/lifeweb/carb_seq/MapServer/tile/{z}/{y}/{x}',
        enabled: false
      }, {
        name: 'restoration potential',
        opacity: 0.7,
        url: 'http://lifeweb-maps.unep-wcmc.org/ArcGIS/rest/services/lifeweb/rest_pot/MapServer/tile/{z}/{y}/{x}',
        enabled: false
      }, {
        name: 'forest status',
        url: 'http://lifeweb-maps.unep-wcmc.org/ArcGIS/rest/services/lifeweb/forest_intact/MapServer/tile/{z}/{y}/{x}',
        opacity: 0.7,
        enabled: false
      }/*, {
        name: 'KBA',
        url: 'http://carbon-tool.cartodb.com/tiles/kba/{z}/{x}/{y}.png',
        opacity: 0.7,
        enabled: false
      }, {
        name: 'Gap Analysis',
        url: 'http://carbon-tool.cartodb.com/tiles/gap_analysis/{z}/{x}/{y}.png',
        opacity: 0.7,
        enabled: false
      }*/

    ]
  };

  var removeLayerFeatures = function(){
    editableLayers.getLayers().forEach(function(l){
      editableLayers.removeLayer(l)
    });
  }


  var validateLayer = function(layer){
    var max_area = config.MAX_POLYGON_AREA;
    debugger;
  }

  var setupMap = function(){
    // initiate leaflet map
    var map = new L.Map(config.div || 'map', {
      center: [0,0],
      zoom: 2
    })

    var mapLayers;
    mapLayers = {};

    // Base layer switcher
    var basemap = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    });
    basemap.addTo(map);

    $( "#white" ).click(function() {
      var baseLayer = 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
      basemap.setUrl(baseLayer);
      $( '.tabs > li a' ).toggleClass( "is-active" );
    });
    $( "#dark" ).click(function() {
      var baseLayer = 'http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
      basemap.setUrl(baseLayer);
      $( '.tabs > li a' ).toggleClass( "is-active" );
    });

    // Layers

    // add inputs
    for (var i=0;i<config.MAP_LAYERS.length;i++){
      var layer = config.MAP_LAYERS[i];
      $('.legends ul').append('<li class="legends-'+i+'"><input type="checkbox" value="' + i + '" id="'+ i +'" name="' + layer.name + '"><label for="'+layer.name+'">'+layer.name+'</label');
    }
    // attach the input change event
    $('.legends input').change(function(){
      var id = $(this).attr('value');
      if ($(this).attr('checked')){
        // add the layer
        var data = config.MAP_LAYERS[parseInt(id)];
        if (data){
          var layer = L.tileLayer(
            data.url,
            {
              opacity: data.opacity
            });
          layer.addTo(map);
          mapLayers[id] = layer;
        }

      } else {
        map.removeLayer(mapLayers[id]);
      }
      console.log(id);
    });

    // click on layers enabled by default
    for (var i=0;i<config.MAP_LAYERS.length;i++){
      var layer = config.MAP_LAYERS[i];
      if (layer.enabled){
        $('.legends input[id=' + i + ']').click();
      }
    };

    // set up the drawing plugin

    // Initialise the FeatureGroup to store editable layers
    editableLayers = new L.FeatureGroup();
    map.addLayer(editableLayers);

    // Initialise the draw control and pass it the FeatureGroup of editable layers
    var drawControl = new L.Control.Draw({
      draw: {
        polyline : false,
        rectangle: false,
        marker: false,
        polygon: {
          allowIntertsection: false,
          drawError: {
            color: '#e1e100', // Color the shape will turn when intersects
            message: '<strong>Oh snap!<strong> you can\'t draw that!' // Message that will show when intersect
          },
          shapeOptions: {
            color: '#bada55'
          }
        },
        circle: {
          shapeOptions: {
            color: '#bada55'
          }
        }
      },
      edit: {
        featureGroup: editableLayers,
        remove: false,
        edit: false
      }
    });
    map.addControl(drawControl);

    // Events on polygon drawn

    map.on('draw:created', function (e) {
      var type = e.layerType,
          layer = e.layer;


      if (validateLayer(layer)){
        // Do whatever else you need to. (save to db, add to map etc)
        editableLayers.addLayer(layer);

        if (type === 'polygon') {
          console.log("POLY");
          callbacks['polygon'](layer);
        } else if (type === 'circle'){
          console.log("CIRCLE");
          callbacks['circle'](layer);
        }
      }


    });


    $('#draw-polygon').click(function(){
      removeLayerFeatures();
      new L.Draw.Polygon(map, drawControl.options.polygon).enable();
    })
    $('#draw-circle').click(function(){
      removeLayerFeatures();
      new L.Draw.Circle(map, drawControl.options.circle).enable();
    })
    $('#current-view').click(function(){
      removeLayerFeatures();
      callbacks['current-view'](map.getBounds());
    })

  } // end of setup map


  return {
    setCallbacks: function(type, callback){
      callbacks[type] = callback; 
    },
    getMap : function(){ 
      return map 
    },
    init : function (newConfig) {
      _.extend(config,newConfig);
      setupMap();
    }
  };

})();
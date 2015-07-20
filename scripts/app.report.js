var reporting = (function () {  
  var config = {
    tooltipText : {
      enabled: 'Launch the report',
      disabled: 'Select an area to analyse'
    }
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
  }

  var reportCircle = function(circle){
    addReportButton();
    console.log("report circle");
  }

  var reportPolygon = function(polygon){
    addReportButton();
    console.log("report polygon");
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
    }
  }
})();
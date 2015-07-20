var app = (function () {
  return {
    // A public function utilizing privates
    init: function( bar ) {
		/* Init modules */
		mapping.init({div:'map'});
		reporting.init({});

		/* Pass to the map the reporting functions*/
		mapping.setCallbacks(reporting.getReports);
		mapping.setReportAreaTooBig(reporting.getReportAreaTooBig)
    }
  };
})();
var app = (function () {
  return {
    // A public function utilizing privates
    init: function( bar ) {
		console.log('==== INIT ===');
		mapping.init({div:'map'});
    }
  };
})();
Parse.Cloud.define('getCategories', function(req, res){
  var categories = [];
  var Category = Parse.Object.extend('Category');
  var query = new Parse.Query(Category);

  var sortedBy = req.params.sortedBy || 'createdAt';
  var sortDir = req.params.sortDir || 'desc';

  sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy);

  query.find({
    success: function(objects) {
      if (objects.length) {
        for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
          categories.push({
            id: object.id,
            name: object.get('name'),
            desc: object.get('desc'),
            image: object.get('image') ? (object.get('image')).toJSON().url : '',
            isLive: object.get('isLive')
          });
        }
      }
      res.success({categories: categories});
    },
    error: function(error) {
      res.error(error);
    }
  })
});

Parse.Cloud.define('deleteCategories', function(req, res){
  var Category = Parse.Object.extend('Category');
  var query = new Parse.Query(Category);
  query.containedIn("objectId", req.params.categoryIds);

  query.find({
    success: function(categories){
      Parse.Object.destroyAll(categories).then(function(success) {
        res.success('success');
      }, function(error) {
        res.error(error);
      });
    },
    error: function(error){
      res.error(error);
    }
  })
})

Parse.Cloud.define('getCategories', function(req, res){
  var categories = [];
  var Category = Parse.Object.extend('Category');
  var query = new Parse.Query(Category);

  var sortedBy = req.params.sortedBy || 'createdAt';
  var sortDir = req.params.sortDir || 'desc';
  var page = req.params.currentPage || 1;
  var limit = req.params.perPage || 6;
  var skip = (page - 1) * limit;

  // totalpages count
  var count;
  query.count().then(function(result){
    count = result;
    sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy);

    // filtering
    if (req.params.name) {
      query.contains('name', req.params.name);
    }

    // pagination
    query.limit(limit);
    query.skip(skip);

    query.find().then(function(objects) {
        if (objects.length) {
          for (var i = 0; i < objects.length; i++) {
          var object = objects[i];
            categories.push({
              id: object.id,
              name: object.get('name'),
              color: object.get('color'),
              desc: object.get('desc'),
              image: object.get('image') ? (object.get('image')).toJSON().url : '',
              icon: object.get('icon') ? (object.get('icon')).toJSON().url : '',
              isLive: object.get('isLive')
            });
          }
        }
        res.success({categories: categories, totalItems: count});
      },function(error) {
        res.error(error.message);
      })
  },function(error) {
    res.error(error.message);
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

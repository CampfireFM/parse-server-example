Parse.Cloud.define('getTags', function(req, res){
  var tags = [];
  var Tag = Parse.Object.extend('Tag');
  var query = new Parse.Query(Tag);

  var sortedBy = req.params.sortedBy || 'createdAt';
  var sortDir = req.params.sortDir || 'desc';
  var page = req.params.currentPage || 1;
  var limit = req.params.perPage || 6;
  var skip = (page - 1) * limit;

  // filtering
  if (req.params.name) {
    query.contains('name', req.params.name);
  }

  // totalpages count
  var count;
  query.count().then(function(result){
    count = result;
    sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy);

    // pagination
    query.limit(limit);
    query.skip(skip);

    query.find().then(function(objects) {
        if (objects.length) {
          for (var i = 0; i < objects.length; i++) {
          var object = objects[i];
            tags.push({
              id: object.id,
              name: object.get('name'),
              categories: object.get('categories')
            });
          }
        }
        res.success({tags: tags, totalItems: count});
      },function(error) {
        res.error(error.message);
      })
  },function(error) {
    res.error(error.message);
  })
});

Parse.Cloud.define('deleteTags', function(req, res){
  var Tag = Parse.Object.extend('Tag');
  var query = new Parse.Query(Tag);
  query.containedIn("objectId", req.params.tagIds);

  query.find({
    success: function(tags){
      Parse.Object.destroyAll(tags).then(function(success) {
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

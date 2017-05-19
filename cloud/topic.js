Parse.Cloud.define('getTopics', function(req, res){
  var topics = [];
  var List = Parse.Object.extend('List');
  var query = new Parse.Query(List);
  query.find({
    success: function(objects) {
      if (objects.length) {
        for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
          topics.push({
            id: object.id,
            name: object.get('name'),
            type: object.get('type'),
            image: object.get('image') ? (object.get('image')).toJSON().url : ''
          });
        }
      }
      res.success(topics);
    },
    error: function(error) {
      res.error(error);
    }
  })
});

Parse.Cloud.define('getFeaturedTopics', function(req, res) {
  // var topics = [];
  var List = Parse.Object.extend('List');
  var query = new Parse.Query(List);
  query.equalTo("objectId",'ra0bDcgdkD');
  query.find({
    success: function(topics) {
      res.success(topics);
    },
    error: function(error) {
      response.error(error);
    }
  })
});

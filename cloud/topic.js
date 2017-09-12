Parse.Cloud.define('getTopics', function(req, res){
  var topics = [];
  var List = Parse.Object.extend('List');
  var query = new Parse.Query(List);
  query.include(['questionRef', 'questionRef.toUser','questionRef.fromUser', 'questionRef.charity', 'userRef']);
  query.find({
    success: function(objects) {
      if (objects.length) {
        for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
          topics.push({
            id: object.id,
            name: object.get('name'),
            type: object.get('type'),
            liveDate: object.get('liveDate'),
            updatedAt: object.get('updatedAt'),
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
  var Defaults = Parse.Object.extend('Defaults');
  var defaultQuery = new Parse.Query(Defaults);
  defaultQuery.first({useMasterKey: true}).then(function(defaultValue){
    var spotlightedLists = defaultValue.get('spotlightedLists');
    console.log(spotlightedLists);
    var List = Parse.Object.extend('List');
    var query = new Parse.Query(List);
    query.containedIn('objectId', spotlightedLists);
    query.include(['questionRef', 'questionRef.toUser','questionRef.fromUser', 'questionRef.charity', 'userRef']);
    query.find({useMasterKey: true}).then(function(topics){
      // res.success({topics: topics, spotlightedLists: spotlightedLists.reverse() });
      // Sort topics as in default value
      topics.sort(function(a, b) {
        return spotlightedLists.indexOf(a.id) > spotlightedLists.indexOf(b.id);
      });
      res.success(topics);
    }, function(error) {
      res.error(error);
    });
  }, function(error){
    console.log(error);
    res.error(error);
  })
});

Parse.Cloud.define('getFeaturedTopics-web', function(req, res) {
  // var topics = [];
  var Defaults = Parse.Object.extend('Defaults');
  var defaultQuery = new Parse.Query(Defaults);
  defaultQuery.first({useMasterKey: true}).then(function(defaultValue){
    var spotlightedLists = defaultValue.get('spotlightedLists');
    console.log(spotlightedLists);
    var List = Parse.Object.extend('List');
    var query = new Parse.Query(List);
    query.containedIn('objectId', spotlightedLists);
    query.find({useMasterKey: true}).then(function(topics){
        res.success({topics: topics, spotlightedLists: spotlightedLists });
        //res.success(topics);
      }, function(error) {
        res.error(error);
      }
    );
  }, function(error){
    console.log(error);
    res.error(error);
  })
});

Parse.Cloud.define('setFeaturedTopics', function(req, res) {
  var Defaults = Parse.Object.extend('Defaults');
  var defaultQuery = new Parse.Query(Defaults);
  defaultQuery.first({useMasterKey: true}).then(function(defaultValue){
    var spotlightedLists = defaultValue.get('spotlightedLists');
    if (req.params.featuredLists) {
      defaultValue.remove('spotlightedLists');
      defaultValue.set('spotlightedLists', req.params.featuredLists);
    } else {
      if (spotlightedLists.indexOf(req.params.listId) == -1 ) {
        if (spotlightedLists.length > 2) {
          spotlightedLists.pop()
        }
        spotlightedLists.unshift(req.params.listId)
        defaultValue.set('spotlightedLists', spotlightedLists);
      }
    }
    defaultValue.save(null, {
      success: function(defaultObj) {
        res.success(defaultObj);
      },
      error: function(defaultObj, error) {
        res.error(error);
      }
    });
  }, function(error){
    console.log(error);
    res.error(error);
  })
});



Parse.Cloud.define('RemoveFeaturedTopic', function(req, res) {
  var Defaults = Parse.Object.extend('Defaults');
  var defaultQuery = new Parse.Query(Defaults);
  defaultQuery.first({useMasterKey: true}).then(function(defaultValue){
    var spotlightedLists = defaultValue.get('spotlightedLists');
    var listIdIndex = spotlightedLists.indexOf(req.params.listId);
    spotlightedLists.splice(listIdIndex, 1);
    defaultValue.remove('spotlightedLists');
    defaultValue.set('spotlightedLists', spotlightedLists);
    defaultValue.save(null, {
      success: function(defaultObj) {
        res.success(defaultObj);
      },
      error: function(defaultObj, error) {
        res.error(error);
      }
    });
  }, function(error){
    console.log(error);
    res.error(error);
  })
});

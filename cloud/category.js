const Promise = require('promise');
const wrapper = require('co-express');

function pointerTo(objectId, klass) {
  return { __type: 'Pointer', className: klass, objectId: objectId};
}
Parse.Cloud.define('getCategories', function(req, res){
  var categories = [];
  var Category = Parse.Object.extend('Category');
  var query = new Parse.Query(Category);
  var onlyLive = (req.params.onlyLive === undefined) ? true : req.params.onlyLive;
  var sortedBy = req.params.sortedBy || 'createdAt';
  var sortDir = req.params.sortDir || 'desc';
  var page = req.params.currentPage || 1;
  var limit = req.params.perPage || 6;
  var skip = (page - 1) * limit;
  const Answer = Parse.Object.extend('Answer');
  // totalpages count
  var count;
  // filter live
  if (onlyLive)
    query.equalTo('isLive', true);
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

    query.find({useMasterKey: true}).then(wrapper(function*(objects) {
      if (objects.length) {
        for (var i = 0; i < objects.length; i++) {
          var object = objects[i];
          const tags = object.get('tags');
          let answerCount = 0;
          for (let j = 0; j < tags.length; j++) {
            const tagRef = pointerTo(tags[j], 'Tag');
            const answerQuery = new Parse.Query(Answer);
            answerQuery.containsAll('tags', [tagRef]);
            answerCount += yield new Promise((resolve, reject) => {
              answerQuery.count({useMasterKey: true})
                .then(count => resolve(count))
                .catch(err => resolve(0))
            });
          }
          categories.push({
            id: object.id,
            name: object.get('name'),
            color: object.get('color'),
            desc: object.get('desc'),
            image: object.get('image') ? (object.get('image')).toJSON().url : '',
            icon: object.get('icon') ? (object.get('icon')).toJSON().url : '',
            isLive: object.get('isLive'),
            answerCount: answerCount
          });
        }
      }
      categories.sort((a, b) => {
        if (a.answerCount > b.answerCount)
          return -1;
        else if (a.answerCount < b.answerCount)
          return 1;
        return 0;
      });
      if (req.params.isAdmin)
        res.success({categories: categories, totalItems: count});
      else
        res.success(categories);
    }),function(error) {
      res.error(error.message);
    })
  },function(error) {
    res.error(error.message);
  })
});

Parse.Cloud.define('getCategory', function(req, res) {
  console.log('getCategory', 'started', new Date().toISOString());
  const id = req.params.id;
  const skip = req.params.skip || 0;
  const limit = req.params.limit || 10;
  const Category = Parse.Object.extend('Category');
  const categoryQuery = new Parse.Query(Category);

  categoryQuery.get(id, {useMasterKey: true}).then(function(category) {
    console.log('getCategory', 'fetched category object', new Date().toISOString());
    const categoryObj = {
      id: category.id,
      name: category.get('name'),
      color: category.get('color'),
      desc: category.get('desc'),
      image: category.get('image') ? (category.get('image')).toJSON().url : '',
      icon: category.get('icon') ? (category.get('icon')).toJSON().url : '',
      isLive: category.get('isLive')
    };
    let tags = category.get('tags');
    tags = tags.splice(0, 2);
    const Answer = Parse.Object.extend('Answer');
    let answers = [];
    let parentQuery;
    if (id !== 'sbL2KrW3wJ') {
      for (let i = 0; tags && i < tags.length; i++) {
        const answerQuery = new Parse.Query(Answer);
        const tagRef = pointerTo(tags[i], 'Tag');
        answerQuery.containsAll('tags', [tagRef]);
        parentQuery = parentQuery ? Parse.Query.or(parentQuery, answerQuery) : answerQuery;
      }
    } else {
      parentQuery = new Parse.Query(Answer);
      const featuredUserIds = category.get('featuredUsers') || [];
      const featuredUsers = featuredUserIds.map(id => pointerTo(id, '_User'));
      parentQuery.containedIn('userRef', featuredUsers);
    }
    parentQuery.notEqualTo('isTest', true);
    parentQuery.lessThanOrEqualTo('liveDate', new Date());
    parentQuery.include(['questionRef', 'questionRef.toUser',
      'questionRef.fromUser', 'questionRef.charity', 'questionRef.list', 'userRef']);
    parentQuery.skip(skip);
    parentQuery.limit(limit);
    parentQuery.descending('createdAt');
    parentQuery.find({useMasterKey: true}).then(answers => {
      console.log('getCategory', 'fetched category answers', new Date().toISOString());
      categoryObj.answers = answers;
      const userQuery = new Parse.Query(Parse.User);
      userQuery.containedIn('objectId', category.get('featuredUsers'));
      userQuery.find({useMasterKey: true}).then(users => {
        console.log('getCategory', 'fetched users', new Date().toISOString());
        users.sort(function(a, b) {
          if (a.get('isFeatured') && b.get('isFeatured')) {
            return ((a.get('answerCount') || 0) > (b.get('answerCount') || 0)) === true ? -1 : 1;
          }
          else if (a.get('isFeatured'))
            return -1;
          else if (b.get('isFeatured'))
            return 1;
          else {
            if (a.get('answerCount') > b.get('answerCount')) {
              return -1;
            }
            if (a.get('answerCount') < b.get('answerCount')) {
              return 1;
            }
            return 0;
          }
        });
        categoryObj.people = users;
        console.log('getCategory', 'sending response', new Date().toISOString());
        res.success(categoryObj);
      }, err => {
        console.log(err);
        res.error(err);
      });
    }, err => {
      console.log(err);
      res.error(err);
    });
  }, function(err) {
    res.error(err);
  })
})
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

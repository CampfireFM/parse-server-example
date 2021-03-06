const Promise = require('promise');
const wrapper = require('co-express');
const redisClient = require('./redis');
function pointerTo(objectId, klass) {
  return { __type: 'Pointer', className: klass, objectId: objectId};
}
Parse.Cloud.define('getCategories', function(req, res){
  let hashKey;
  var isAdmin = req.params.isAdmin;
  if (!isAdmin) {
    hashKey = 'categories:app';
  } else {
    hashKey = 'categories:admin';
  }
  redisClient.get(hashKey, (err, reply) => {
    if (reply) {
      console.log(reply, JSON.parse(reply))
      let result = JSON.parse(reply);
      if (!isAdmin) {
        result = result.map(category => {
          category.className = 'Category';
          return Parse.Object.fromJSON(category);
        })
        res.success(result);
      } else {
        res.success(JSON.parse(reply))
      }
    } else {
      var categories = [];
      var Category = Parse.Object.extend('Category');
      var query = new Parse.Query(Category);

      var sortedBy = req.params.sortedBy || 'views';
      var sortDir = req.params.sortDir || 'desc';
      var page = req.params.currentPage || 1;
      var limit = req.params.perPage || 6;
      var skip = (page - 1) * limit;
      if (!isAdmin) {
        limit = req.params.limit || 6;
        skip = req.params.skip || 0;
      }
      const Answer = Parse.Object.extend('Answer');
      // totalpages count
      var count;
      // filter live
      if (!isAdmin)
        query.equalTo('isLive', true);

      // filtering
      if (req.params.name) {
        query.contains('name', req.params.name);
      }
      query.count().then(function(result){
        count = result;
        sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy);

        // pagination
        if (isAdmin) {
          query.limit(limit);
          query.skip(skip);
        }

        const campfireUser = new Parse.Object('_User');
        campfireUser.id = 'ywQOHcPHOU';

        query.find({useMasterKey: true}).then(wrapper(function*(objects) {
          if (objects.length) {
            const date = new Date();
            date.setDate(date.getDate() - 2);
            for (var i = 0; i < objects.length; i++) {
              let answerCount = 0;
              try {
                var object = objects[i];
                const tags = object.get('tags');
                const answersFromUsers = object.get('answersFromUsers') || false;
                let parentQuery;
                if (answersFromUsers) {
                  parentQuery = new Parse.Query(Answer);
                  const featuredUserIds = object.get('featuredUsers') || [];
                  const featuredUsers = featuredUserIds.map(id => pointerTo(id, '_User'));
                  parentQuery.containedIn('userRef', featuredUsers);
                  parentQuery.greaterThanOrEqualTo('createdAt', date);
                  parentQuery.notEqualTo('questionAsker', campfireUser);
                } else {
                  for (let j = 0; j < tags.length; j++) {
                    const tagRef = pointerTo(tags[j], 'Tag');
                    const answerQuery = new Parse.Query(Answer);
                    answerQuery.containsAll('tags', [tagRef]);
                    answerQuery.greaterThanOrEqualTo('createdAt', date);
                    answerQuery.notEqualTo('questionAsker', campfireUser);
                    parentQuery = parentQuery ? Parse.Query.or(parentQuery, answerQuery) : answerQuery;
                  }
                }

                answerCount += yield new Promise((resolve, reject) => {
                  parentQuery.count({useMasterKey: true})
                    .then(count => resolve(count))
                    .catch(err => resolve(0))
                });
              } catch(err) {
                console.log("Error occured", err);
                answerCount = 0;
              }
              categories.push({
                id: object.id,
                name: object.get('name'),
                color: object.get('color'),
                desc: object.get('desc'),
                image: object.get('image') ? (object.get('image')).toJSON().url : '',
                icon: object.get('icon') ? (object.get('icon')).toJSON().url : '',
                isLive: object.get('isLive'),
                answersFromUsers: object.get('answersFromUsers'),
                views: object.get('views'),
                answerCount: answerCount
              });
              object.set('answerCount', answerCount);
              console.log(answerCount, object.get('name'));
            }
            let result;
            if (isAdmin) {
              categories.sort((a, b) => {
                if (a.answerCount > b.answerCount)
                  return -1;
                else if (a.answerCount < b.answerCount)
                  return 1;
                return 0;
              });
              result = {categories: categories, totalItems: count};
            } else {
              objects.sort((a, b) => {
                if (a.get('answerCount') > b.get('answerCount'))
                  return -1;
                else if (a.get('answerCount') < b.get('answerCount'))
                  return 1;
                return 0;
              });
              result = objects;
            }
            if (!isAdmin) redisClient.set(hashKey, JSON.stringify(result), 'EX', 3600 * 60 * 24); // Expire in 24 hours
            res.success(result);
          }
        }),function(error) {
          res.error(error.message);
        })
      },function(error) {
        res.error(error.message);
      })
    }
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
    const answersFromUsers = category.get('answersFromUsers');
    let tags = category.get('tags');
    tags = tags.splice(0, 2);
    const Answer = Parse.Object.extend('Answer');
    let answers = [];
    //  let parentQuery;
    //  if (answersFromUsers) {
    //    parentQuery = new Parse.Query(Answer);
    //    const featuredUserIds = object.get('featuredUsers') || [];
    //    const featuredUsers = featuredUserIds.map(id => pointerTo(id, '_User'));
    //    parentQuery.containedIn('userRef', featuredUsers);
    //  } else {
    //    for (let j = 0; j < tags.length; j++) {
    //      const tagRef = pointerTo(tags[j], 'Tag');
    //      const answerQuery = new Parse.Query(Answer);
    //      answerQuery.containsAll('tags', [tagRef]);
    //      parentQuery = parentQuery ? Parse.Query.or(parentQuery, answerQuery) : answerQuery;
    //    }
    //  }
    const campfireUser = new Parse.Object('_User');
    campfireUser.id = 'ywQOHcPHOU';
    let parentQuery;
    if (!answersFromUsers) {
      for (let i = 0; tags && i < tags.length; i++) {
        const answerQuery = new Parse.Query(Answer);
        const tagRef = pointerTo(tags[i], 'Tag');
        answerQuery.containsAll('tags', [tagRef]);
        answerQuery.notEqualTo('questionAsker', campfireUser);
        parentQuery = parentQuery ? Parse.Query.or(parentQuery, answerQuery) : answerQuery;
      }
    } else {
      parentQuery = new Parse.Query(Answer);
      const featuredUserIds = category.get('featuredUsers') || [];
      const featuredUsers = featuredUserIds.map(id => pointerTo(id, '_User'));
      parentQuery.containedIn('userRef', featuredUsers);
      parentQuery.notEqualTo('questionAsker', campfireUser);
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
Parse.Cloud.afterSave('Category', (req, res) => {
  redisClient.del('categories:app');
  redisClient.del('categories:admin');
  res.success();
})
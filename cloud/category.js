const Promise = require('promise');
const wrapper = require('co-express');

function pointerTo(objectId, klass) {
  return { __type: 'Pointer', className: klass, objectId: objectId};
}
Parse.Cloud.define('getCategories', function(req, res){
  var categories = [];
  var Category = Parse.Object.extend('Category');
  var query = new Parse.Query(Category);
  var onlyLive = req.params.onlyLive || false;
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
  const id = req.params.id;
  const Category = Parse.Object.extend('Category');
  const categoryQuery = new Parse.Query(Category);
  categoryQuery.get(id, {useMasterKey: true}).then(function(category) {
    const categoryObj = {
      id: category.id,
      name: category.get('name'),
      color: category.get('color'),
      desc: category.get('desc'),
      image: category.get('image') ? (category.get('image')).toJSON().url : '',
      icon: category.get('icon') ? (category.get('icon')).toJSON().url : '',
      isLive: category.get('isLive')
    };
    const tags = category.get('tags');
    const Answer = Parse.Object.extend('Answer');
    let answers = [];
    wrapper(function*() {
      for (let i = 0; i < tags.length; i++) {
        const answerQuery = new Parse.Query(Answer);
        answerQuery.notEqualTo('isTest', false);
        const tagRef = pointerTo(tags[i], 'Tag');
        answerQuery.containsAll('tags', [tagRef]);
        answerQuery.lessThanOrEqualTo('liveDate', new Date());
        answerQuery.include(['questionRef', 'questionRef.toUser',
          'questionRef.fromUser', 'questionRef.charity', 'questionRef.list', 'userRef']);
        try {
          const answersForTag = yield new Promise((resolve, reject) => {
            answerQuery.find({useMasterKey: true}).then(function (answers) {
              resolve(answers);
            }, function (err) {
              console.log(err);
              resolve([]);
            })
          });
          answers = answers.concat(answersForTag);
        } catch(err) {
          
        }
      }
      answers.sort((a, b) => {
        if (a.get('createdAt') > b.get('createdAt'))
          return -1;
        else if(a.get('createdAt') < b.get('createdAt'))
          return 1;
        return 0;
      });

      categoryObj.answers = answers;
      let people = [];

      const userQuery = new Parse.Query(Parse.User);
      for (let i = 0; i < tags.length; i++) {
        const tagRef = pointerTo(tags[i], 'Tag');
        userQuery.containsAll('profileTags', [tagRef]);
        userQuery.notEqualTo('isTestUser', false);
        try {
          const tagUsers = yield new Promise((resolve, reject) => {
            userQuery.find({useMasterKey: true}).then(function(users) {
              resolve(users);
            }, function(err) {
              console.log(err);
              resolve([]);
            });
          });
          people = people.concat(tagUsers);
        } catch(err) {

        }
      }
      people.sort(function(a, b) {
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
      categoryObj.people = people;
      res.success(categoryObj);
    })();

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

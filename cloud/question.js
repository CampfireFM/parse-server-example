Parse.Cloud.define('getQuestions', function(req, res) {
    var questions = [];
    var sortedBy = req.params.sortedBy || 'createdAt';
    var sortDir = req.params.sortDir || 'desc';
    var page = req.params.currentPage || 1;
    var limit = req.params.perPage || 6;
    var skip = (page - 1) * limit;

    var Question = Parse.Object.extend('Question');
    var query = new Parse.Query(Question);    

    query.include(['fromUser.fullName',
        'toUser.fullName', 'charity.name']);

    var fromUser = Parse.Object.extend('User');
    var fromUserQuery = new Parse.Query(fromUser);
    fromUserQuery.select("objectId", "fullName", "isTestUser", "isDummyUser");
    fromUserQuery.notEqualTo('isTestUser', true);
    fromUserQuery.notEqualTo('isDummyUser', true);

    var toUser = Parse.Object.extend('User');
    var toUserQuery = new Parse.Query(toUser);
    toUserQuery.select("objectId", "fullName", "isTestUser", "isDummyUser");
    toUserQuery.notEqualTo('isTestUser', true);
    toUserQuery.notEqualTo('isDummyUser', true);

    var charity = Parse.Object.extend('Charity');
    var charityQuery = new Parse.Query(charity);
    charityQuery.select("objectId", "name");

    // filtering
    if (req.params.answererName) {
        toUserQuery.contains("fullName", req.params.answererName);
    }
    if (req.params.answererAskerName) {
        fromUserQuery.contains("fullName", req.params.answererAskerName);
    }
    if (req.params.charity) {
        charityQuery.contains("name", req.params.charity);
    }
    if (req.params.question) {
        query.contains('text', req.params.question);
    }
    
    if (req.params.isAnswered != '' && (req.params.isAnswered == false || req.params.isAnswered == true)) {        
        query.equalTo('isAnswered', req.params.isAnswered);
    }

    if (req.params.price) {
        query.greaterThanOrEqualTo("price", parseInt(req.params.price));
    }

    // Exclude test data
    query.matchesQuery('toUser', toUserQuery);
    query.matchesQuery('fromUser', fromUserQuery);
    query.matchesQuery('charity', charityQuery);
    
    
    if (req.params.fromDate) {
        query.greaterThanOrEqualTo("createdAt", req.params.fromDate);
    }
    if (req.params.toDate) {
        query.lessThanOrEqualTo("createdAt", req.params.toDate);
    }

    // sorting
    sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy)

    // totalpages count
    var count = 0;

    var findQuestions = function () {
        query.find({
            success: function (objects) {
                console.log(objects)
                if (objects.length > 0) {                    
                    return Parse.Promise.as().then(function () {
                        var promise = Parse.Promise.as();

                        objects.forEach(function (object) {
                            promise = promise.then(function () {
                                var fromUser = object.get('fromUser');
                                var toUser = object.get('toUser');
                                var charity = object.get('charity');                                
                                date = new Date(object.get('createdAt'));

                                questions.push({
                                    id: object.id,                                    
                                    answererCoverPhoto: (toUser.get('coverPhoto') && toUser.get('coverPhoto').url) ? (toUser.get('coverPhoto')).toJSON().url : '',
                                    answererProfileImage: (toUser.get('profilePhoto') && toUser.get('profilePhoto').url) ? (toUser.get('profilePhoto')).toJSON().url : '',
                                    answererName: (toUser) ? toUser.get('fullName') : '',
                                    answererAskerName: (fromUser) ? fromUser.get('fullName') : '',
                                    question: object.get('text'),
                                    price: object.get('price'),
                                    isAnswered: object.get('isAnswered'),
                                    date: date.toDateString(),                                    
                                    charity: (charity) ? charity.get('name') : 'None'                                    
                                });
                                
                            });
                        });
                        return promise;

                    }).then(function () {
                        return res.success({questions: questions, totalItems: count});
                    }, function (error) {
                        res.error(error);
                    });
                }
                else {
                    res.success({questions: [], totalItems: 0});
                }
            },
            error: function (error) {
                res.error(error);
            }
        })
    }

    if (!req.params.noPagination) {
        query.count().then(function (result) {
            count = result;
            // pagination
            query.limit(limit);
            query.skip(skip);
            findQuestions();
        });
    } else {
        findQuestions();
    }
});

Parse.Cloud.define('getAutoQuestions', function(req, res){    
    var autoQuestions = [];
    var sortedBy = req.params.sortedBy || 'createdAt';
    var sortDir = req.params.sortDir || 'desc';
    var page = req.params.currentPage || 1;
    var limit = req.params.perPage || 6;
    var skip = (page - 1) * limit;

    var AutoQuestions = Parse.Object.extend('AutoQuestions');
    var query = new Parse.Query(AutoQuestions);

    // sorting
    sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy)

    // totalpages count
    var count = 0;

    var findAutoQuestions = function () {
        query.find({
            success: function(objects) {
                if (objects.length > 0) {
                    return Parse.Promise.as().then(function () {
                        var promise = Parse.Promise.as();

                        objects.forEach(function (object) {
                            promise = promise.then(function () {
                                autoQuestions.push({
                                    id: object.id,
                                    question: object.get('text'),
                                    isLive: object.get('isLive'),
                                    createdAt: object.get('createdAt'),
                                    updatedAt: object.get('updatedAt')
                                });
                            });
                        });
                        return promise;
                    }).then(function () {
                        return res.success({autoQuestions: autoQuestions, totalItems: count});
                    }, function (error) {
                        res.error(error);
                    });
                }
                else
                {
                  return res.success({autoQuestions: [], totalItems: 0});
                }
            },
            error: function(error) {
              res.error(error);
            }
        })
    }

    if (!req.params.noPagination) {
        query.count().then(function (result) {
            count = result;
            // pagination
            query.limit(limit);
            query.skip(skip);
            findAutoQuestions();
        });
    } else {
        findAutoQuestions();
    }
});
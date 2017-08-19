const { sendPushOrSMS, generateShareImage, getAllUsers } = require('./common');
const config = require('../config.js');
const stripe = require('stripe')(config.stripe_live_key);
// var paypal = require('paypal-rest-sdk');
var Paypal = require('paypal-nvp-api');
const wrapper = require('co-express');
const Promise = require('promise');
var algoliasearch = require('./algolia/algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);
//include the JS files which represent each classes (models), and contains their operations
require("./models/Answer.js");
require("./models/CampfireUnlock.js");
require("./models/Follow.js");
require("./models/Like.js");
require("./models/Question.js");
require("./models/User.js");
require("./models/List.js");
require("./models/Activity");
require("./algolia/algoliaQuestions.js");
require("./algolia/algoliaUsers.js");

require("./common");
require("./shareImage");

require("./category");
require("./tag");
require("./topic");
require("./transcript");
require("./cron");

transactionPercentage = 2.9;
transactionFee = 0.3;
answerPercentageToCampfire = 0.2;
campfireUnlockValue = 0.12;
matchValue = 0.1;
unlockCostMatches = 25;
unlockMatchValue = 0.002475;
campfireDefaultUser = null;
(function loadDefaultSettings(){
    var Defaults = Parse.Object.extend('Defaults');
    var default_values = null;
    var query = new Parse.Query(Defaults);
    query.limit(1);

    query.find({useMasterKey : true}).then(function(defaults) {
        transactionPercentage = defaults[0].get('transactionPercentage');
        transactionFee = defaults[0].get('transactionFee');
        answerPercentageToCampfire = defaults[0].get('answerPercentageToCampfire');
        campfireUnlockValue = defaults[0].get('campfireUnlockValue');
        matchValue = defaults[0].get('matchValue');
        unlockCostMatches = defaults[0].get('unlockCostMatches');
        unlockMatchValue = defaults[0].get('unlockMatchValue');
        campfireDefaultUser = defaults[0].get('campfireUserRef');
    }, function(err){
        //set to default value
        transactionFee = 0.3;
        transactionPercentage = 2.9;
        answerPercentageToCampfire = 0.2;
        campfireUnlockValue = 0.12;
        matchValue = 0.1;
        unlockCostMatches = 25;
        unlockMatchValue = 0.002475;
        console.log(err);
    })
})();

Parse.Cloud.afterSave('Defaults', function(request){
    transactionPercentage = request.object.get('transactionPercentage');
    transactionFee = request.object.get('transactionFee');
    answerPercentageToCampfire = request.object.get('answerPercentageToCampfire');
    campfireUnlockValue = request.object.get('campfireUnlockValue');
    matchValue = request.object.get('matchValue');
    unlockCostMatches = request.object.get('unlockCostMatches');
    unlockMatchValue = request.object.get('unlockMatchValue');
    campfireDefaultUser = request.object.get('campfireUserRef');
    if(!transactionPercentage)
        transactionPercentage = 2.9;
    if(!transactionFee)
        transactionFee = 0.3;
    if(!answerPercentageToCampfire)
        answerPercentageToCampfire = 0.2;
    if(!campfireUnlockValue)
        campfireUnlockValue = 0.12;
    if(!matchValue)
        matchValue = 0.1;
    if(!unlockCostMatches)
        unlockCostMatches = 25;
    if(!unlockMatchValue)
        unlockMatchValue = 0.002475;
});

//the below function is just to test if everything is working fine
Parse.Cloud.define('hello', function(req, res) {
    res.success("Hi");
});

Parse.Cloud.define('addAnswersToList', function(req, res) {
    var Answer = Parse.Object.extend('Answer');
    var query = new Parse.Query(Answer);
    query.containedIn("objectId", req.params.answerIds);
    query.find({
        success: function (objects) {
            if (objects.length) {
                for (var i = 0; i < objects.length; i++) {
                    var object = objects[i];
                    var pointer = new Parse.Object("List");
                    pointer.id = req.params.listId;
                    object.addUnique("lists", pointer);
                    object.save(null, {useMasterKey: true});
                }
                res.success('Success');
            }
        },
        error: function (error) {
            res.error(error);
        }

    })

});

Parse.Cloud.define('getUsers', function(request, response) {
    var result = [];
    var chunk_size = 1000;
    var processCallback = function(res) {
        const users = res.map((user) => {
            return {
                id: user.id,
                name: user.get('fullName'),
                email: user.get('email')
            }
        });
        result = result.concat(users);
        if (res.length === chunk_size) {
            process(res[res.length-1].id);
        } else {
            response.success(result);
        }
    };
    var process = function(skip) {
        var query = new Parse.Query(Parse.User);
        if (skip) {
            query.greaterThan("objectId", skip);
        }
        query.select(['objectId', 'fullName', 'email']);
        query.limit(chunk_size);
        query.ascending("objectId");
        query.find({useMasterKey: true}).then(function (res) {
            processCallback(res);
        }, function (error) {
            response.error("query unsuccessful, length of result " + result.length + ", error:" + error.code + " " + error.message);
        });
    };
    process(false);
});

Parse.Cloud.define('removeAnswersFromList', function(req, res) {
    var Answer = Parse.Object.extend('Answer');
    var query = new Parse.Query(Answer);
    query.containedIn("objectId", req.params.answerIds);
    query.find({
        success: function (objects) {
            if (objects.length) {
                for (var i = 0; i < objects.length; i++) {
                    var object = objects[i];
                    var pointer = new Parse.Object("List");
                    pointer.id = req.params.listId;
                    object.remove("lists", pointer);
                    object.save();
                }
                res.success('Success');
            }
        },
        error: function (error) {
            res.error(error);
        }

    })

});

Parse.Cloud.define('ExportPeopleToCSV', function(req, res) {
    var mp = new require("mixpanel-export-people")(config.mixpanel.api_key, config.mixpanel.api_secret);
    var mixpanelPeopleFile = mp.people.saveCsv("public/mixpanelPeople.csv");
    res.success({peopleExport: 'success'});
});

Parse.Cloud.define('getFeaturedCampfire', function(req, res) {
    var campfires = [];
    var limit = req.params.limit || 3;
    var skip = req.params.skip || 0;

    var Answer = Parse.Object.extend('Answer');
    var query = new Parse.Query(Answer);
    //query.equalTo('isDummyData', false);

    query.include(['questionRef', 'questionRef.fromUser.fullName',
        'questionRef.toUser.fullName']);
    query.descending('createdAt');
    query.lessThan('liveDate', new Date());
    query.limit(limit);
    query.skip(skip);

    query.find({
        success: function (objects) {
            if (objects.length) {
                for (var i = 0; i < objects.length; i++) {
                    var object = objects[i];
                    var fromUser = object.get('questionRef').get('fromUser');
                    var toUser = object.get('questionRef').get('toUser');
                    var answerFile = object.get('answerFile');
                    if (answerFile || true) {
                        campfires.push({
                            id: object.id,
                            question: object.get('questionRef').get('text'),
                            answer: answerFile.toJSON().url,
                            from: {
                                name: fromUser.get('fullName'),
                                firstName: fromUser.get('firstName'),
                                lastName: fromUser.get('lastName'),
                                picture: fromUser.get('profilePhoto') ? (fromUser.get('profilePhoto')).toJSON().url : '',
                                cover: fromUser.get('coverPhoto') ? (fromUser.get('coverPhoto')).toJSON().url : '',
                                tagline: fromUser.get('tagline')
                            },
                            to: {
                                name: toUser.get('fullName'),
                                firstName: toUser.get('firstName'),
                                lastName: toUser.get('lastName'),
                                picture: toUser.get('profilePhoto') ? (toUser.get('profilePhoto')).toJSON().url : '',
                                cover: toUser.get('coverPhoto') ? (toUser.get('coverPhoto')).toJSON().url : '',
                                tagline: toUser.get('tagline')
                            },
                        });
                    }
                }
            }
            res.success(campfires);
        },
        error: function (error) {
            res.error(error);
        }
    })
});
function pointerTo(objectId, klass) {

    return { __type:"Pointer", className:klass, objectId:objectId };
}
Parse.Cloud.define('getFeaturedAnswers', function(req, res) {
    var campfires = [];
    var limit = req.params.limit || 6;
    var skip = req.params.skip || 0;

    var Answer = Parse.Object.extend('Answer');
    var query = new Parse.Query(Answer);
    //query.equalTo('isDummyData', false);

    query.include(['questionRef', 'questionRef.toUser',
        'questionRef.fromUser', 'questionRef.charity', 'questionRef.list', 'userRef']);
    query.notEqualTo('isTest', true);
    query.containsAll('lists', [pointerTo('CTsXJi51Qc', 'List')]);
    query.descending('liveDate');
    query.lessThan('liveDate', new Date());
    query.limit(limit);
    query.skip(skip);

    query.find({
        success: function (objects) {
            res.success(objects);
        },
        error: function (error) {
            res.error(error);
        }
    })
});

Parse.Cloud.define('getMpActiveUsers', function(req, res) {
    var fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth());
    fromDate = (fromDate.getFullYear() + "-" + fromDate.getMonth() + "-" + fromDate.getDate());
    var toDate = new Date();
    toDate = (toDate.getFullYear() + "-" + (toDate.getMonth() + 1) + "-" + toDate.getDate());
    panel.segmentation({
        event: '$custom_event:483416',
        from_date: fromDate,
        to_date: toDate,
    }).then(function (data) {
        res.success(data);
    });
});

Parse.Cloud.define('getMixpanelData', function(req, res) {
    var fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth());
    fromDate = (fromDate.getFullYear() + "-" + fromDate.getMonth() + "-" + fromDate.getDate());
    var toDate = new Date();
    toDate = (toDate.getFullYear() + "-" + (toDate.getMonth() + 1) + "-" + toDate.getDate());
    panel.events({
        event: ["Unlock", "Viewed: Ask - Question Submitted"],
        type: "unique",
        unit: "day",
        from_date: fromDate,
        to_date: toDate
    }).then(function (data) {
        res.success(data);
    });
});

Parse.Cloud.define('getMpAvgQuestionsListened', function(req, res) {
    var fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth());
    fromDate = (fromDate.getFullYear() + "-" + fromDate.getMonth() + "-" + fromDate.getDate());
    var toDate = new Date();
    toDate = (toDate.getFullYear() + "-" + (toDate.getMonth() + 1) + "-" + toDate.getDate());
    panel.events({
        event: ["Unlock"],
        type: "average",
        unit: "day",
        from_date: fromDate,
        to_date: toDate
    }).then(function (data) {
        res.success(data);
    });
});

Parse.Cloud.define('getMpRetentionFeedLoad', function(req, res) {
    var fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth());
    fromDate = (fromDate.getFullYear() + "-" + fromDate.getMonth() + "-" + (fromDate.getDate() - 7) );
    var toDate = new Date();
    toDate = (toDate.getFullYear() + "-" + (toDate.getMonth() + 1) + "-" + toDate.getDate());
    panel.retention({
        unit: "day",
        event: "Initial Feed Load",
        where: 'user["Questions Answered"] > 1',
        retention_type: "compounded",
        interval_count: 37,
        segment_method: "first",
        from_date: fromDate,
        to_date: toDate
    }).then(function (data) {
        res.success(data);
    });
});

Parse.Cloud.define('getCampfires', function(req, res) {
    var campfires = [];
    var sortedBy = req.params.sortedBy || 'createdAt';
    var sortDir = req.params.sortDir || 'desc';
    var page = req.params.currentPage || 1;
    var limit = req.params.perPage || 6;
    var skip = (page - 1) * limit;

    var Campfire = Parse.Object.extend('Answer');
    var query = new Parse.Query(Campfire);
    query.equalTo('isDummyData', false);
    query.notEqualTo('isTest', true);

    if (req.params.topic_id) {
        var topic = new Parse.Object("List");
        topic.id = req.params.topic_id;
        query.equalTo('lists', topic);
    }

    query.include(['questionRef', 'questionRef.fromUser.fullName',
        'questionRef.toUser.fullName', 'questionRef.charity.name']);

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
    var Question = Parse.Object.extend("Question");
    var QuestionQuery = new Parse.Query(Question);

    // filtering
    if (req.params.answererName) {
        toUserQuery.contains("fullName", req.params.answererName);
    }
    if (req.params.answererAskerName) {
        fromUserQuery.contains("fullName", req.params.answererAskerName);
    }
    if (req.params.question) {
        QuestionQuery.contains('text', req.params.question);
    }
    if (req.params.categoryId) {
        var categoryRef = new Parse.Object("Category");
        categoryRef.id = req.params.categoryId;
        QuestionQuery.equalTo('category', categoryRef);
    }

    // Exclude test data
    QuestionQuery.matchesQuery('toUser', toUserQuery);
    QuestionQuery.matchesQuery('fromUser', fromUserQuery);
    query.matchesQuery('questionRef', QuestionQuery);

    if (req.params.likeCount) {
        query.greaterThanOrEqualTo("likeCount", parseInt(req.params.likeCount));
    }
    if (req.params.likeCount) {
        query.greaterThanOrEqualTo("unlockCount", parseInt(req.params.unlockCount));
    }
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

    var findCampfires = function () {
        query.find({
            success: function (objects) {
                if (objects.length > 0) {
                    return Parse.Promise.as().then(function () {
                        var promise = Parse.Promise.as();

                        objects.forEach(function (object) {
                            if (object.get('questionRef')) {
                                promise = promise.then(function () {
                                    var fromUser = object.get('questionRef').get('fromUser');
                                    var toUser = object.get('questionRef').get('toUser');
                                    var charity = object.get('questionRef').get('charity');
                                    var CampfireUnlock = Parse.Object.extend('CampfireUnlock');
                                    var CuQuery = new Parse.Query(CampfireUnlock);
                                    var answer = object.get('answerFile');
                                    var answerFile = answer ? answer.toJSON().url : ''
                                    date = new Date(object.get('createdAt'));

                                    CuQuery.equalTo("answerRef", object);
                                    var Cucount = 0;
                                    return CuQuery.count().then(function (result) {
                                        Cucount = result;
                                        campfires.push({
                                            id: object.id,
                                            answer: answerFile,
                                            answererCoverPhoto: (toUser.get('coverPhoto') && toUser.get('coverPhoto').url) ? (toUser.get('coverPhoto')).toJSON().url : '',
                                            answererProfileImage: (toUser.get('profilePhoto') && toUser.get('profilePhoto').url) ? (toUser.get('profilePhoto')).toJSON().url : '',
                                            answererName: toUser.get('fullName'),
                                            answererAskerName: (fromUser) ? fromUser.get('fullName') : '',
                                            question: object.get('questionRef').get('text'),
                                            date: date.toDateString(),
                                            eavesdrops: object.get("unlockCount"),
                                            likes: object.get('likeCount'),
                                            charity: (charity) ? charity.get('name') : 'None',
                                            transcription: object.get('transcription'),
                                            transcriptStatus: object.get('transcriptStatus'),
                                            recordingLength: object.get('recordingLength')
                                        });

                                        return Parse.Promise.as();

                                    }, function (error) {
                                        res.error(error);
                                    });
                                });
                            }
                        });
                        return promise;

                    }).then(function () {
                        return res.success({campfires: campfires, totalItems: count});
                    }, function (error) {
                        res.error(error);
                    });
                }
                else {
                    res.success({campfires: [], totalItems: 0});
                }
            },
            error: function (error) {
                res.error(error);
            }
        })
    }

    if (!(req.params.topic_id && req.params.noPagination)) {
        query.count().then(function (result) {
            count = result;
            // pagination
            query.limit(limit);
            query.skip(skip);
            findCampfires();
        });
    } else {
        findCampfires();
    }
});

Parse.Cloud.define('gettopCharityUsers', function(req, res) {
    var charityUsers = Parse.Object.extend('User');
    var charityUsersQuery = new Parse.Query(charityUsers);
    charityUsersQuery.select("profilePhoto");
    charityUsersQuery.greaterThan('donationPercentage', 0);
    var Campfire = Parse.Object.extend('Answer');
    var query = new Parse.Query(Campfire);
    query.matchesQuery('userRef', charityUsersQuery);
    query.ascending('unlockCount');
    query.limit(6);

    query.find({useMasterKey: true}).then(function (objects) {
        if (objects.length) {
            var topCharityUsers = [];
            var topCharityUserIds = [];
            for (var i = 0; i < objects.length; i++) {
                var object = objects[i];
                var toUserObj = object.get('userRef');
                topCharityUserIds.push(object.get('userRef').id);
            }
            var User = Parse.Object.extend('User');
            var queryUser = new Parse.Query(User);
            queryUser.containedIn('objectId', topCharityUserIds);
            queryUser.select('profilePhoto');
            queryUser.find({useMasterKey: true}).then(function (user_objects) {
            if (user_objects) {
                for (var i = 0; i < user_objects.length; i++) {
                    var user_object = user_objects[i];
                    topCharityUsers.push({
                        id: user_object.id,
                        image: (user_object.get('profilePhoto') && user_object.get('profilePhoto').url) ? (user_object.get('profilePhoto')).toJSON().url : ''
                    });
                }
            }
            res.success(topCharityUsers);
            }, function (error) {
                res.error(error);
            });
        }
    }, function(error) {
        res.error(error);
    });
});

Parse.Cloud.define('getPeople', function(req, res) {
    var people = [];
    var sortedBy = req.params.sortedBy || 'createdAt';
    var sortDir = req.params.sortDir || 'desc';
    var page = req.params.currentPage || 1;
    var limit = req.params.perPage || 6;
    var skip = (page - 1) * limit;

    var People = Parse.Object.extend('User');
    var query = new Parse.Query(People);

    // filtering
    if (req.params.fullName) {
        query.contains('fullName', req.params.fullName);
    }
    if (req.params.email) {
        query.contains('email', req.params.email);
    }
    if (req.params.gender) {
        query.equalTo("gender", req.params.gender);
    }
    if (req.params.tagline) {
        query.contains("tagline", req.params.tagline);
    }
    if (req.params.isFeatured) {
        query.startsWith("isFeatured", req.params.isFeatured);
    }
    if (req.params.followers) {
        query.startsWith("followers", req.params.followers);
    }
    if (req.params.createdAt) {
        query.startsWith("createdAt", req.params.createdAt);
    }
    if (req.params.fromDate) {
        query.greaterThanOrEqualTo("createdAt", req.params.fromDate);
    }
    if (req.params.toDate) {
        query.lessThanOrEqualTo("createdAt", req.params.toDate);
    }

    // totalpages count
    var count;
    query.count().then(function (result) {
        count = result;

        // sorting
        sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy)

        // pagination
        query.limit(limit);
        query.skip(skip);
        query.find({useMasterKey: true}).then(function (objects) {
            if (objects.length > 0) {
                for (var i = 0; i < objects.length; i++) {
                    var object = objects[i];
                    people.push({
                        id: object.id,
                        profileImage: object.get('profilePhoto') ? (object.get('profilePhoto')).toJSON().url : '',
                        fullName: object.get('fullName'),
                        email: object.get('email'),
                        gender: object.get('gender'),
                        tagline: object.get('tagline'),
                        isFeatured: object.get('isFeatured'),
                        fbFollowers: object.get('fbFollowers'),
                        twitterFollowers: object.get('twitterFollowers'),
                        createdAt: object.get('createdAt').toDateString()
                    });
                }
            }
            res.success({people: people, totalItems: count});
        }, function (error) {
            res.error(error);
        })
    }, function (error) {
        res.error(error);
    });

});

Parse.Cloud.define('getFeaturedPeople', function(req, res) {
    var Defaults = Parse.Object.extend('Defaults');
    var defaultQuery = new Parse.Query(Defaults);
    defaultQuery.first({useMasterKey: true}).then(wrapper(function*(defaultValue) {
        var featuredPeople = defaultValue.get('featuredPeople');
        var People = Parse.Object.extend('User');
        var query = new Parse.Query(People);
        query.containedIn('objectId', featuredPeople);
        query.find({useMasterKey: true}).then(function (people) {
            // Sort people
            if (people.length > 0) {
                people.sort(function(p1, p2) {
                    const personId1 = p1.id;
                    const personId2 = p2.id;
                    if (featuredPeople.indexOf(personId1) < featuredPeople.indexOf(personId2))
                        return -1;
                    if (featuredPeople.indexOf(personId1) > featuredPeople.indexOf(personId2))
                        return 1;
                    return 0;
                });
            }
            res.success(people);
        }, function (error) {
            res.error(error);
        });
    }), function (error) {
        res.error(error);
    })
});

Parse.Cloud.define('setFeaturedPeople', function(req, res) {
    var Defaults = Parse.Object.extend('Defaults');
    var defaultQuery = new Parse.Query(Defaults);
    defaultQuery.first({useMasterKey: true}).then(function (defaultValue) {
        var featuredPeople = defaultValue.get('featuredPeople');
        if (req.params.featuredPeople) {
            defaultValue.remove('featuredPeople');
            defaultValue.set('featuredPeople', req.params.featuredPeople);
        } else {
            if (featuredPeople.indexOf(req.params.featuredPersonId) == -1) {
                if (featuredPeople.length > 4) {
                    featuredPeople.pop()
                }
                featuredPeople.unshift(req.params.featuredPersonId)
                defaultValue.set('featuredPeople', featuredPeople);
            }
        }
        defaultValue.save(null, {
            success: function (defaultObj) {
                res.success(defaultObj);
            },
            error: function (defaultObj, error) {
                res.error(error);
            }
        });
    }, function (error) {
        console.log(error);
        res.error(error);
    })
});

Parse.Cloud.define('RemoveFeaturedPerson', function(req, res) {
  var Defaults = Parse.Object.extend('Defaults');
  var defaultQuery = new Parse.Query(Defaults);
  defaultQuery.first({useMasterKey: true}).then(function(defaultValue){
    var featuredPeople = defaultValue.get('featuredPeople');
    var featuredPersonIdIndex = featuredPeople.indexOf(req.params.featuredPersonId);
    featuredPeople.splice(featuredPersonIdIndex, 1);
    defaultValue.remove('featuredPeople');
    defaultValue.set('featuredPeople', featuredPeople);
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

Parse.Cloud.define('getQuestionDetails', function(req, res) {

    var Question = Parse.Object.extend("Question");
    var query = new Parse.Query(Question);
    // query.equalTo("objectId",question.id);
    query.include(['fromUser', 'fromUser.charityRef', 'toUser', 'toUser.charityRef']);
    query.equalTo("objectId", req.params.questionId);
    query.find({
        success: function (questions) {
            console.log(questions.length);
            console.log(questions[0]);
            return res.success(questions[0]);
            // return callback(null,questions[0]);
        },
        error: function (object, error) {
            console.log(error);
            // return callback(error,null);
            return res.error(error);
        }
    });
});


Parse.Cloud.define('deleteCharity', function(req, res) {

    var charity_ids_array = req.params.charity_ids_array;
    deleteCharity(array_charity_ids, function (err, result) {
        if (err) {
            return res.error(result);
        } else {
            return res.success(result);
        }
    });

});



function deleteCharity(array_charity_ids,callback) {

    var array_charity_pointers = [];
    for (id in array_charity_ids) {
        array_charity_ids[id] = {__type: "Pointer", className: "Charity", objectId: array_charity_ids[id]};
    }

    var query = new Parse.Query(Parse.User);
    query.equalTo("charityRef", array_charity_pointers);
    query.find({
        success: function (results_users) {

            for (i in results_users) {
                results_users[i].unset("charityRef");
            }
            Parse.Object.saveAll(results_users, {useMasterKey: true});

            var Question = Parse.Object.extend('Question');
            var query = new Parse.Query(Question);
            query.equalTo("charity", array_charity_pointers);
            query.find({
                success: function (results_questions) {

                    for (i in results_questions) {
                        results_questions[i].unset("charity");
                        results_questions[i].set("charityPercentage", 0);
                    }
                    Parse.Object.saveAll(results_questions, {useMasterKey: true});

                    var Charity = Parse.Object.extend('Charity');
                    var query = new Parse.Query(Charity);
                    query.containedIn('objectId', array_charity_ids);
                    query.find({useMasterKey: true}).then(function (charity_objects) {

                        Parse.Object.destroyAll(charity_objects);

                        return callback("Delete was success");

                    }, function (error) {
                        return callback(error, null);
                    });
                },
                error: function (error) {
                    return callback(error, null);
                }
            });
        },
        error: function (error) {
            return callback(error, null);
        }
    });

}

Parse.Cloud.define("updateNewUser", function(request, response) {
    var profilePicFile = null;
    var coverPicFile = null;
    var params = request.params;
    var firstname = params.firstName || '';
    var lastname = params.lastName || '';
    var bio = params.bio || '';
    var initial_match_count = 0;
    var default_image = {};
    var Defaults = Parse.Object.extend('Defaults');
    var default_values = null;
    var query = new Parse.Query(Defaults);
    query.limit(1);

    query.find({useMasterKey: true}).then(function (defaults) {
        default_values = defaults;
        initial_match_count = defaults[0].get('initialMatchCount');
        default_image = defaults[0].get('coverPhoto');
        if (request.user) {
            setUserValues(request.user);
        }
        else {
            var id = request.params.id;
            var User = Parse.Object.extend('User');
            var query = new Parse.Query(User);
            query.get(id, {useMasterKey: true}).then(function (user) {
                setUserValues(user);
            }, function (error) {
                response.error(error.message);
            });
        }
    }, function (error) {
        response.error(error.message);
    });

    var setUserValues = function (user) {

        user.set('firstName', firstname);
        user.set('lastName', lastname);
        user.set('fullName', firstname + ' ' + lastname)
        user.set('gender', params.gender);
        user.set('email', params.email);
        user.set('bio', params.bio);

        //default values

        user.set('unansweredQuestionCount', 0);
        user.set('missedNotificationCount', 0);
        user.set('matchCount', initial_match_count);
        user.set('questionPrice', 5);
        user.set('askAbout', '');
        user.set('tagline', '');
        user.set('donationPercentage', 0);
        user.set('isTestUser', false);
        user.set('isDummyUser', false);

        // setting both image to default image
        user.set('coverPhoto', default_image);
        user.set('profilePhoto', default_image);

        if (params.profilePicUrl && params.coverPicUrl) {
            var image_file_regex = /(.*\.(?:png|jpg|jpeg|gif))/i
            if (!image_file_regex.test(params.profilePicUrl)) {
                // If profile pic url is not an image url then save with
                // default image
                saveUser();
            }
            Parse.Cloud.httpRequest({url: params.profilePicUrl}).then(function (response) {
                var base64_profile_image = response.buffer.toString('base64');
                profilePicFile = new Parse.File("profile.jpeg", {base64: base64_profile_image});
                profilePicFile.save().then(function () {
                    user.set('profilePhoto', profilePicFile);
                    if (!image_file_regex.test(params.coverPicUrl)) {
                        // If cover pic url is not an image url then save with
                        // default image
                        saveUser();
                    }
                    Parse.Cloud.httpRequest({url: params.coverPicUrl}).then(function (response) {
                        var base64_cover_image = response.buffer.toString('base64');
                        coverPicFile = new Parse.File("cover.jpeg", {base64: base64_cover_image});
                        coverPicFile.save().then(function () {
                            user.set('coverPhoto', coverPicFile);
                            saveUser();
                        }, function (error) {
                            response.error(error.message);
                        });
                    }, function (error) {
                        saveUser();
                    });
                }, function (error) {
                    response.error(error.message);
                });
            }, function (error) {
                // if we get any error from profile pic url like 404,
                // we save user and give succes response
                // to avoid loosing the rest of the data
                saveUser();
            });
        }
        else {
            user.save(null, {useMasterKey: true}).then(function (user) {
                response.success(user);
            }, function (error) {
                response.error(error.message);
            });
        }

        var saveUser = function () {
            user.save(null, {useMasterKey: true}).then(function (user) {
                response.success(user);
            }, function (error) {
                response.error(error.message);
            });
        }
    }
});


function getQuestions(questionIds, callback){
    var Question = Parse.Object.extend('Question');
    var questionQuery = new Parse.Query(Question);
    questionQuery.include('text');
    questionQuery.containedIn('objectId', questionIds);
    questionQuery.find({useMasterKey : true}).then(function(questions){
        if(questions)
            callback(null, questions);
        else
            callback(null, []);
    }, function(err){
        console.log(err.message);
        callback(err);
    });
}

Parse.Cloud.define('getFriendsMatch', function(request, response){
    var facebookIds = request.params.fbUserIds;
    var twitterIds = request.params.twUserIds;
    var emails = request.params.emails;

    if(facebookIds === undefined)
        facebookIds = [];
    if(twitterIds === undefined)
        twitterIds = [];
    if(emails === undefined)
        emails = [];

    var usersFBIdMatch = new Parse.Query(Parse.User);
    usersFBIdMatch.containedIn('authData.facebook.id', facebookIds);

    var usersTWIdMatch = new Parse.Query(Parse.User);
    usersTWIdMatch.containedIn('authData.twitter.id', twitterIds);

    var usersEmailMatch = new Parse.Query(Parse.User);
    usersEmailMatch.containedIn('email', emails);

    var usersMatch = Parse.Query.or(usersFBIdMatch, usersTWIdMatch, usersEmailMatch);

    usersMatch.find({useMasterKey : true}).then(function(users){
        if(users.length){
            //Send push notification to users
            sendPushOrSMS(request.user, users, 'friendMatch');
            response.success(users);
        } else {
            response.success([]);
        }
    }, function(err){
        console.log(err);
        throw "Got an error " + error.code + " : " + error.message;
    });
});

Parse.Cloud.define('withdraw', function(request, response){
    var currentUser = request.user;
    var paypalEmail = request.params.paypalEmail;
    var earningsBalance = currentUser.get('earningsBalance');
    var email = currentUser.get('email');
    var paypalConfig = config.paypal;
    var paypal = Paypal(paypalConfig);

    // response.success("OK");
    // var create_payout_json = {
    //     'RECEIVER_TYPE' : 'EmailAddress',
    //     'L_EMAIL0' : 'krittylor@gmaiasdfafsl.xom',
    //     'L_AMT0' : 0.1,
    //     'CURRENCYCODE' : 'USD'
    // };
    // if(process.env.NODE_ENV !== 'production')
    //   paypalEmail = 'krittylor@gmail.xom';
    // Round earningsBalance
    const roundedEarningsBalance = Math.floor( earningsBalance * Math.pow(10, 2) ) / Math.pow(10, 2) ;
    var create_payout_json = {
        'RECEIVERTYPE' : 'Email',
        'L_EMAIL0': paypalEmail,
        'L_AMT0' : roundedEarningsBalance,
        'CURRENCYCODE' : 'USD'
    };

    console.log('Payout_Request_Json', create_payout_json);
    paypal.request('MassPay', create_payout_json).then(function(payout) {
        //Get Payout Item

        console.log("Created Single Payout");
        console.log(payout);
        if(payout.ACK == 'Success'){
            currentUser.set('earningsBalance', earningsBalance - roundedEarningsBalance);
            currentUser.save(null, {useMasterKey : true}).then(function(user){
                console.log(`Updated balance of ${user.get('earningsBalance')}`);
                response.success(payout);
            }, function(error){
                console.log(`Paid ${earningsBalance} to ${paypalEmail} but failed to update earningsBalance to 0`);
                console.log(error);
                response.success(payout);
            });
        } else {
            response.error(payout);
            var errorCode = payout.L_ERRORCODE0;
            console.log(`Something went wrong with payout`);
            console.log(`ErrorCode : ${payout.L_ERRORCODE0}, ${payout.L_SHORTMESSAGE0}`)
        }
    }).catch(function(err){
        console.log(err.response);
        response.error(err);
        throw 'Got an error ' + err.code + ' : ' + err.message;
    });
});

Parse.Cloud.define('getHottestCamps', function(request, response){

    var List = Parse.Object.extend('List');
    var Question = Parse.Object.extend('Question');

    var listQuery = new Parse.Query(List);

    var currentDate = new Date();
    listQuery.greaterThanOrEqualTo('endDate', currentDate);
    listQuery.lessThanOrEqualTo('liveDate', currentDate);
    listQuery.notContainedIn('name', ['Featured Web', 'Featured']);
    listQuery.include(['questionRef', 'questionRef.toUser','questionRef.fromUser', 'questionRef.charity', 'userRef']);

    var completed = function(countMap){
        if(countMap.length > 0)
            countMap.sort(function(a, b){
                if(a.list.get('createdAt') < b.list.get('createdAt'))
                    return 1;
                if(a.list.get('createdAt') > b.list.get('createdAt'))
                    return -1;
                return 0;
            });
        response.success(countMap);
    };

    listQuery.find({useMasterKey: true}).then(function(lists){
        if(lists.length === 0)
            return completed([]);
        const listCount = lists.length;
        const countMap = [];
        var processed = 0;
        lists.forEach(function(list){
            //Check answer's live date and list
            var Answer = Parse.Object.extend('Answer');
            var query = new Parse.Query(Answer);
            query.containsAll('lists', [pointerTo(list.id, 'List')]);
            query.count().then(function(count){
                countMap.push({
                    list: list,
                    count: count
                });
                processed++;
                if(listCount === processed){
                    completed(countMap);
                }
            });
        })
    })
});

Parse.Cloud.define('getHottestCategories', function(request, response){
    return response.success([]);
    var Category = Parse.Object.extend('Category');
    var Question = Parse.Object.extend('Question');

    var categoryQuery = new Parse.Query(Category);

    var completed = function(countMap){
        if(countMap.length > 0)
            countMap.sort(function(a, b){
                if(a.count < b.count)
                    return 1;
                if(a.count > b.count)
                    return -1;
                return 0;
            });
        response.success(countMap);
    };

    categoryQuery.find({useMasterKey: true}).then(function(categories){
        if(categories.length === 0)
            return completed([]);
        const categoryCount = categories.length;
        const countMap = [];
        var processed = 0;
        categories.forEach(function(category){
            var questionQuery = new Parse.Query(Question);
            questionQuery.equalTo('category', category);
            questionQuery.count().then(function(count){
                countMap.push({
                    category: category,
                    count: count
                });
                processed++;
                if(categoryCount === processed){
                    completed(countMap);
                }
            });
        })
    })
});

Parse.Cloud.define('getFeaturedUsers', function(request, res){
    var Defaults = Parse.Object.extend('Defaults');
    var defaultQuery = new Parse.Query(Defaults);
    defaultQuery.first({useMasterKey: true}).then(wrapper(function*(defaultValue) {
        var featuredPeople = defaultValue.get('featuredPeople');
        var People = Parse.Object.extend('User');
        var query = new Parse.Query(People);
        query.containedIn('objectId', featuredPeople);
        query.find({useMasterKey: true}).then(function (people) {
            // Sort people
            if (people.length > 0) {
                people.sort(function(p1, p2) {
                    const personId1 = p1.id;
                    const personId2 = p2.id;
                    if (featuredPeople.indexOf(personId1) < featuredPeople.indexOf(personId2))
                        return -1;
                    if (featuredPeople.indexOf(personId1) > featuredPeople.indexOf(personId2))
                        return 1;
                    return 0;
                });
            }
            res.success(people);
        }, function (error) {
            res.error(error);
        });
    }), function (error) {
        res.error(error);
    })
});

Parse.Cloud.define('getSuggestedUsers', function(request, response){
    //Get suggested users ranked by the number of answers to question
    var userQuery = new Parse.Query(Parse.User);
    userQuery.notEqualTo('isTestUser', true);
    userQuery.descending('answerCount').limit(6);

    userQuery.find({useMasterKey: true}).then(function(suggestedUsers){
        console.log(suggestedUsers);
        response.success(suggestedUsers);
    }, function(err){
        console.log(err);
        throw new Error(`Got an error while getting suggested users. ErrorCode: ${err.code}, ErrorMessage: ${err.message}`);
    });
});


// Schedule Refund Strategy every 5 minutes
(function scheduleRefund(){
    setInterval(function(){
        var Question = Parse.Object.extend('Question');
        var query = new Parse.Query(Question);
        var currentDate = new Date();
        var start = new Date();
        var end = new Date();
        start.setDate(start.getDate() - 4);
        end.setDate(end.getDate() - 3);
        query.greaterThanOrEqualTo('createdAt', start);
        query.lessThanOrEqualTo('createdAt', end);
        query.equalTo('isAnswered', false);
        query.notEqualTo('isRefunded', true);
        query.include('fromUser');
        query.find({useMasterKey: true}).then(function(questions){
            if(questions.length){
                questions.forEach(function(question){
                    console.log('Refunding money for question ', question.get('text'));
                    question.set('isExpired', true);
                    question.set('isRefunded', true);
                    question.save(null, {useMasterkey: true});
                    const fromUser = question.get('fromUser');
                    fromUser.increment('matchCount', question.get('price') / matchValue);
                    fromUser.save(null, {useMasterKey : true});
                });
            }
        });
    }, 60 * 5 * 1000);
})();

Parse.Cloud.define('getHottestUsers', function(request, response){
    //Get suggested users ranked by the number of answers to question
    var userQuery = new Parse.Query(Parse.User);
    userQuery.notEqualTo('isTestUser', true);
    userQuery.descending('answerCount').limit(6);

    userQuery.find({useMasterKey: true}).then(function(suggestedUsers){
        console.log(suggestedUsers);
        response.success(suggestedUsers);
    }, function(err){
        console.log(err);
        throw new Error(`Got an error while getting suggested users. ErrorCode: ${err.code}, ErrorMessage: ${err.message}`);
    });
});

Parse.Cloud.define('getWelcomeQuestion', function(request, response){

    // Get firstname of the user
    const firstName = request.user.get('firstName');
    const welcomeQuestions = [
        `Hey ${firstName}! If you could have picked your name, what would it be?`,
        `Hey ${firstName}! What's your secret super power and what super power do you wish you had?`,
        `Hey ${firstName}! What scares you the most?`,
        `Hey ${firstName}! If you could deliver a one minute piece of advice to your 13 year old self, what would it be?`,
        `Hey ${firstName}! What is your favorite city you\'ve ever been to?`,
        `Hey ${firstName}! If you could be from a country other than the one you were actually born in, what country would it be and why?`,
        `Hey ${firstName}! There are only so many hours in the day, so what do you think is more important: physical fitness or mental wellness?`,
        `Hey ${firstName}! Where do you get your news from? Why there?`,
        `Hey ${firstName}! If you could have a Campfire conversation with any historical figure, who would it be and why?`,
        // `Hey ${firstName}! Should we cut taxes to promote economic growth,raise them to support the most vulnerable members of our society or something else?`,
        `Hey ${firstName}! Have you ever "borrowed" someone else's Netflix or Amazon Prime account instead of opening your own account?`,
        `Hey ${firstName}! If we found evidence of intelligent life on other planets, would you be excited or terrified?`,
        `Hey ${firstName}! What's the most important quality you look for in a partner?`,
        `Hey ${firstName}! What was the most selfless thing you ever did, and how did it make you feel?`,
        `Hey ${firstName}! If you could have personally witnessed anything, what would you want to have seen and why?`,
        `Hey ${firstName}! A house aside, what's the most expensive thing you've ever bought? How did you justify the purchase?`,
        `Hey ${firstName}! Can you describe for us your proudest moment from the last 12 months?`,
        `Hey ${firstName}! Do you think humans are designed for monogamy? What other way do you think things could work?`,
        `Hey ${firstName}! What is the craziest law you've ever heard of?`,
        `Hey ${firstName}! What do you think Victoria's secret actually is?`,
        `Hey ${firstName}! Michael Jackson, Whitney Houston, Prince. Who would you most want to see in concert?`,
        `Hey ${firstName}! Do dating apps actually work? Or do you prefer to meet potential partners in the real world?`,
        `Hey ${firstName}! Who’s the most famous person you've spoken to, and how did it happen?`
    ];


    // Get Welcome List
    const List = Parse.Object.extend('List');
    const query = new Parse.Query(List);
    query.equalTo('objectId', 'You2tVmGHd');
    query.first({useMasterKey: true}).then(function(list) {
        // Get welcome question
        var Question = Parse.Object.extend('Question');
        var question = new Question();
        question.set('toUser', request.user);
        question.set('isAnswered', false);
        question.set('price', 0);
        question.set('list', list);
        const questionText = welcomeQuestions[Math.floor(Math.random() * welcomeQuestions.length)];
        question.set('text', questionText);
        question.set('charityPercentage', 0);
        question.set('fromUser', campfireDefaultUser);
        question.set('isExpired', false);
        question.set('isTest', false);
        question.save(null, {useMasterKey: true}).then(function(res){
            response.success({});
        }, function(err){
            response.error(err);
        })
    }, function(err) {
        console.log(err);
        response.error(err);
    });
});

function removeUser(userId) {

    // Get default avatar
    const Defaults = Parse.Object.extend('Defaults');
    const query = new Parse.Query(Defaults);
    query.find({useMasterKey: true}).then(function (defaults) {
        const defaultAvatar = defaults[0].get('defaultAvatar');
        const query = new Parse.Query(Parse.User);
        query.equalTo('objectId', userId);

        query.first({useMasterKey: true}).then(function (user) {
            if (user) {
                user.set('isLive', false);
                user.set('emailSubscriptions', []);
                user.set('pushSubscriptions', []);
                user.set('smsSubscriptions', []);
                user.set('username', 'deleted_' + user.get('username'));
                user.set('email', 'deleted_' + user.get('email'));
                user.set('profilePhoto', defaultAvatar);
                user.save(null, {useMasterKey: true});

                // Remove unanswered questions / Update fromUser or toUser to null
                const Question = Parse.Object.extend('Question');
                const questionQuery1 = new Parse.Query(Question);
                questionQuery1.equalTo('fromUser', user);
                // questionQuery1.equalTo('isAnswered', false);
                const questionQuery2 = new Parse.Query(Question);
                questionQuery2.equalTo('toUser', user);
                // questionQuery2.equalTo('isAnswered', false);

                const compoundQuery = Parse.Query.or(questionQuery1, questionQuery2);

                compoundQuery.find({useMasterKey: true}).then(function (questions) {
                    if (questions.length > 0) {
                        questions.forEach(function (question) {
                            if (question.get('isAnswered') !== true) {
                                Parse.Object.destroyAll([question], {useMasterKey: true});
                            }
                            else {
                                if (question.get('fromUser').id === userId) {
                                    question.set('fromUser', null);
                                    question.save(null, {useMasterKey: true});
                                }
                                if (question.get('toUser').id === userId) {
                                    question.set('toUser', null);
                                    question.save(null, {useMasterKey: true});
                                }
                            }
                        });
                    }
                });

                // Update userRef to null in answers
                const Answer = Parse.Object.extend('Answer');
                const answerQuery = new Parse.Query(Answer);

                answerQuery.equalTo('userRef', user);

                answerQuery.find({useMasterKey: true}).then(function (answers) {
                    if (answers.length > 0) {
                        answers.forEach(function (answer) {
                            answer.set('userRef', null);
                            answer.save(null, {useMasterKey: true});
                        })
                    }
                });
            }
        });
    }, function (err) {
        console.log(err);
    });
}

Parse.Cloud.define('removeUser', function(request, response) {
    const userId = request.params.userId;
    if(!userId)
        return response.success({});
    removeUser(userId);
    response.success({userId});
});

Parse.Cloud.define('searchUserQuestion', function(request, response) {
    const keyword = request.params.keyword;
    const indexUsers = client.initIndex('users');
    const indexQuestions = client.initIndex('questions');
    const start = new Date();
    let users = [];
    let questions = [];
    indexUsers.search(keyword, {
        page: 1,
        offset: 0,
        length: 5
    }, function searchDone(err, content) {
        if (err) {
            console.error(err);
            response.error(err);
            return;
        }
        console.log('First Search duration', new Date().getTime() - start.getTime());
        for (var h in content.hits) {
            console.log('Hit(' + content.hits[h].objectID + '): ' + content.hits[h].toString());
            content.hits[h].className = 'User';
            users.push(Parse.Object.fromJSON(content.hits[h]));
        }
        const start1 = new Date();
        indexQuestions.search(keyword, {
            page: 1,
            offset: 0,
            length: 5
        }, function searchDone(err, content) {
            console.log('Second Search duration', new Date().getTime() - start1.getTime());
            if (err) {
                console.error(err);
                response.error(err);
                return;
            }

            for (var h in content.hits) {
                console.log('Hit(' + content.hits[h].objectID + '): ' + content.hits[h].toString());
                content.hits[h].className = 'Question';
                questions.push(Parse.Object.fromJSON(content.hits[h]));
            }
            const end = new Date();
            const duration = end.getTime() - start.getTime();
            console.log('Search duration: ', duration);
            response.success({users, questions});
        });
    });
});

Parse.Cloud.define('searchUser', function(request, response) {
    const keyword = request.params.keyword;
    const indexUsers = client.initIndex('users');
    const start = new Date();
    let users = [];
    let questions = [];
    indexUsers.search(keyword, {
        page: 1,
        offset: 0,
        length: 5
    }, function searchDone(err, content) {
        if (err) {
            console.error(err);
            response.error(err);
            return;
        }
        console.log('First Search duration', new Date().getTime() - start.getTime());
        for (var h in content.hits) {
            console.log('Hit(' + content.hits[h].objectID + '): ' + content.hits[h].toString());
            content.hits[h].className = '_User';
            users.push(Parse.Object.fromJSON(content.hits[h]));
        }

        const end = new Date();
        const duration = end.getTime() - start.getTime();
        console.log('Search duration: ', duration);
        response.success(users);
    });
});

Parse.Cloud.define('getAnswersForList', function(request, response) {
    var skip = request.params.skip || 0;
    var limit = request.params.limit || 6;
    var listId = request.params.listId;

    if (listId === 'iFwMwfGvJc') {
        getMostPopularQuestions(limit, skip)
            .then(answers => response.success(answers))
            .catch(err => {
                console.log(err);
                response.error(err);
            })
    } else {
        var Answers = Parse.Object.extend('Answer');
        var query = new Parse.Query(Answers);

        query.include(['questionRef', 'questionRef.toUser','questionRef.fromUser', 'questionRef.charity', 'questionRef.list', 'userRef']);
        query.containsAll('lists', [pointerTo(listId, 'List')]);
        query.notEqualTo('isTest', true);
        query.lessThan('liveDate', new Date());
        query.skip(skip);
        query.limit(limit);
        query.descending("liveDate");

        query.find({useMasterKey: true}).then(function(answers) {
            response.success(answers);
        }, function(err) {
            console.log(err);
            request.error(err);
        })
    }

});

Parse.Cloud.define('removeList', function(request, response) {
    var listId = request.params.listId;
    const Answers = Parse.Object.extend('Answer');
    const query = new Parse.Query(Answers);
    query.containsAll('lists', [pointerTo(listId, 'List')]);
    query.find({useMasterKey: true}).then(function(answers) {
        answers.forEach(function(answer) {
            // Build new lists
            const oldLists = answer.get('lists');
            let newLists = [];
            oldLists.forEach(function(list) {
                if (list.id !== listId)
                    newLists.push(list);
            });
            answer.set('lists', newLists);
            answer.save(null, {useMasterKey: true});
        });
    });
    const Questions = Parse.Object.extend('Question');
    const questionQuery = new Parse.Query(Questions);
    const Lists = Parse.Object.extend('List');
    const listQuery = new Parse.Query(Lists);
    listQuery.equalTo('objectId', listId);
    listQuery.first({useMasterKey: true}).then(function(list) {
        questionQuery.equalTo('list', list);
        questionQuery.find({useMasterKey: true}).then(function(questions) {
            questions.forEach(function(question) {
                question.unset('list');
                question.save(null, {useMasterKey: true});
            });
        });
        Parse.Object.destroyAll([list], {useMasterKey: true});
        response.success({});
    })
});

Parse.Cloud.define('getShareImageUrl', function(request, response) {
    const userId = request.params.userId;
    generateShareImage(userId)
        .then(url => {
            response.success(url);
        })
        .catch(err => {
            console.log(err);
            response.error(err);
        })
});

function getMostPopularQuestions(limit, skip) {
    return new Promise((resolve, reject) => {
        var Answer = Parse.Object.extend('Answer');
        var query = new Parse.Query(Answer);

        query.include(['questionRef', 'questionRef.toUser','questionRef.fromUser', 'questionRef.charity', 'questionRef.list', 'userRef']);
        query.descending('unlockCount');
        query.notEqualTo('isTest', true);
        query.lessThan('liveDate', new Date());
        query.limit(limit);
        query.skip(skip);
        query.find({useMasterKey: true}).then(function(answers) {
            resolve(answers);
        }, function(err) {
            console.log(err);
            reject(err);
        });
    });
}

Parse.Cloud.define('requestPasswordReset', function(request, response) {
    const email = request.params.email;
    Parse.User.requestPasswordReset(email, {useMasterKey: true}).then(function(){
        console.log(`Sent password reset email to ${email}`);
        response.success({});
    }, function(err) {
        console.log(err);
        console.log(`Failed to send password reset email to ${email}`);
        response.error(err);
    })
});

Parse.Cloud.job('CheckShadowUsers', function(request, status) {
    let emailCount = 0;
    getAllUsers()
        .then(users => {
            users.forEach(user => {
                const email = user.get('email');
                if (email)
                    emailCount ++;
                if (email && (email.indexOf('@bonfire.fm') > -1 || email.indexOf('camp@gmail.com') > -1)) {
                    user.set('isShadowUser', true);
                    user.save(null, {useMasterKey: true}).then();
                }
            });
            status.success();
        })
        .catch(err => {
            status.error(err);
        })
});
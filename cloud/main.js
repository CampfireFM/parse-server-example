const { sendPushOrSMS, generateShareImage, getAllUsers, getFollows, resetFeaturedAnswers } = require('./common');
const config = require('../config.js');
// var paypal = require('paypal-rest-sdk');
var Paypal = require('paypal-nvp-api');
const iap = require('in-app-purchase');
const wrapper = require('co-express');
const Promise = require('promise');
var algoliasearch = require('./algolia/algoliaSearch.parse.js');
const Mixpanel = require('mixpanel');
var mixpanel = Mixpanel.init(config.mixpanelToken);
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);
const redisClient = require('./redis');
const { sendTransactionFailureEmail, sendCashoutEmail, sendCashoutSuccessEmail, sendCashoutRejectEmail } = require('../utils/mail');
//include the JS files which represent each classes (models), and contains their operations
require("./models/Answer.js");
require("./models/CampfireUnlock.js");
require("./models/Follow.js");
require("./models/Like.js");
require("./models/Question.js");
require("./models/User.js");
require("./models/List.js");
require("./models/Activity");
require("./models/AutoQuestion");
require("./models/MatchesReward");
require("./models/TestGroup");
require("./algolia/algoliaQuestions.js");
require("./algolia/algoliaUsers.js");
require("./algolia/algoliaAnswers");
require("./common");
require("./shareImage");

require("./category");
require("./tag");
require("./question");
require("./notificationText");
require("./topic");
require("./transcript");
require("./cron");
require("./campaigns/university");
require("./cashout");
require("./matchesReward");
require("./testGroup");
transactionPercentage = 2.9;
transactionFee = 0.3;
answerPercentageToCampfire = 0.2;
campfireUnlockValue = 0.12;
matchValue = 0.1;
unlockCostMatches = 25;
unlockMatchValue = 0.002475;
campfireDefaultUser = null;
pointsForQuestion = 2;
pointsForAnswer = 2;
pointsForUnlock = 2;
pointsForListen = 1;
pointsForFollow = 3;
pointsForLike = 1;
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
        pointsForQuestion = defaults[0].get('pointsForQuestion');
        pointsForAnswer = defaults[0].get('pointsForAnswer');
        pointsForUnlock = defaults[0].get('pointsForUnlock');
        pointsForLike = defaults[0].get('pointsForLike');
        pointsForFollow = defaults[0].get('pointsForFollow');
        pointsForListen = defaults[0].get('pointsForListen');
    }, function(err){
        //set to default value
        transactionFee = 0.3;
        transactionPercentage = 2.9;
        answerPercentageToCampfire = 0.2;
        campfireUnlockValue = 0.12;
        matchValue = 0.1;
        unlockCostMatches = 25;
        unlockMatchValue = 0.002475;
        pointsForQuestion = 2;
        pointsForAnswer = 2;
        pointsForUnlock = 2;
        pointsForListen = 1;
        pointsForFollow = 3;
        pointsForLike = 1;
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
    pointsForQuestion = request.object.get('pointsForQuestion') || 2;
    pointsForAnswer = request.object.get('pointsForAnswer') || 2;
    pointsForUnlock = request.object.get('poitnsForUnlock') || 2;
    pointsForLike = request.object.get('pointsForLike') || 1;
    pointsForFollow = request.object.get('pointsForFollow') || 3;
    pointsForListen = request.object.get('pointsForListen') || 1;
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

// Setup top 20 answer clout points
(function() {
    redisClient.exists('top20CloutPoints', (err, reply) => {
        if (reply === 1) {
            console.log('top20CloutPoints already exists');
        } else {
            const Answer = Parse.Object.extend('Answer');
            const query = new Parse.Query(Answer);
            query.notEqualTo('isTest', true);
            query.notEqualTo('isDummyData', true);
            query.lessThanOrEqualTo('liveDate', new Date());
            query.descending('cloutPoints');
            query.limit(20);
            query.select(['objectId', 'cloutPoints'])
            query.find({useMasterKey: true})
                .then(answers => {
                    const multi = redisClient.multi();
                    for (let i = answers.length - 1; i >= 0; i--) {
                        const answer = answers[i];
                        multi.lpush('top20CloutPoints', answer.get('cloutPoints'));
                        multi.lpush('top20AnswerIds', answer.id);
                    }
                    multi.ltrim('top20CloutPoints', 0, answers.length);
                    multi.ltrim('top20AnswerIds', 0, answers.length);
                    multi.exec((err, res) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log(res);
                        }
                    });
                })
        }
    });

})();
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
        query.notEqualTo('isTestUser', true);
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
Parse.Cloud.define('getFeaturedAnswers', (req, res) => {
    var campfires = [];
    var limit = req.params.limit || 6;
    var skip = req.params.skip || 0;

    var Answer = Parse.Object.extend('Answer');
    var query = new Parse.Query(Answer);
    //query.equalTo('isDummyData', false);

    redisClient.exists('featuredAnswers', wrapper(function*(err, reply) {
        if (reply === 0) {
            yield resetFeaturedAnswers();
        }
        redisClient.lrange('featuredAnswers', skip, skip + limit - 1, (err, ids) => {
            if (err) {
                res.error(err);
            }
            //answers = answers.map(answer => {
            //    answer = JSON.parse(answer);
            //    let userRef, fromUser, charity;
            //    let questionRef = answer.questionRef;
            //    if (questionRef) {
            //        userRef = questionRef.toUser;
            //        if (questionRef.toUser)
            //            questionRef.toUser.className = '_User';
            //        if (questionRef.fromUser)
            //            questionRef.fromUser.className = '_User';
            //        if (questionRef.charity)
            //            questionRef.charity.className = 'Charity';
            //        //fromUser = questionRef.fromUser;
            //        //charity = questionRef.charity;
            //    }
            //    answer.className = 'Answer';
            //    answer = Parse.Object.fromJSON(answer);
            //    //if (questionRef) {
            //    //    questionRef.className = 'Question';
            //    //    //questionRef = Parse.Object.fromJSON(questionRef);
            //    //    if (userRef) {
            //    //        userRef.className = '_User';
            //    //        //userRef = Parse.Object.fromJSON(userRef);
            //    //        //answer.set('userRef', userRef);
            //    //        //questionRef.set('toUser', userRef);
            //    //    }
            //    //    if (fromUser) {
            //    //        fromUser.className = '_User';
            //    //        fromUser = Parse.Object.fromJSON(fromUser);
            //    //        questionRef.set('fromUser', fromUser);
            //    //        answer.set('questionAsker', fromUser);
            //    //    }
            //    //
            //    //    if (charity) {
            //    //        charity.className = 'Charity';
            //    //        charity = Parse.Object.fromJSON(charity);
            //    //        questionRef.set('charity', charity);
            //    //        answer.set('charityRef', charity);
            //    //    }
            //    //    answer.set('questionRef', questionRef);
            //    //}
            //    return answer;
            //});
            //res.success(answers);
            query.include(['questionRef', 'questionRef.toUser',
                'questionRef.fromUser', 'questionRef.charity', 'questionRef.list', 'userRef']);
            query.containedIn('objectId', ids);
            //query.notEqualTo('isTest', true);
            //query.containsAll('lists', [pointerTo('CTsXJi51Qc', 'List')]);
            //query.descending('cloutPoints');
            //query.descending('liveDate');
            //query.lessThan('liveDate', new Date());
            //query.limit(limit);
            //query.skip(skip);

            query.find({
                success: function (objects) {
                    objects.sort((a, b) => {
                        if (ids.indexOf(a.id) < ids.indexOf(b.id))
                            return -1;
                        if (ids.indexOf(a.id) > ids.indexOf(b.id))
                            return 1;
                        return 0;
                    });
                    console.log('FromUser: ', req.user.id);
                    console.log('Limit: ', limit, 'Skip: ', skip);
                    console.log('Returning answer ids: ', objects.map(object => object.id));
                    console.log('Returning answer texts: ', objects.map(object => object.get('questionRef').get('text')));
                    res.success(objects);
                },
                error: function (error) {
                    res.error(error);
                }
            })
        })
    }));
});

Parse.Cloud.define('getFeaturedFollowsAnswers', function(request, response) {
    const skip = request.params.skip || 0;
    const limit = request.params.limit || 6;
    const Answer = Parse.Object.extend('Answer');
    const Follow = Parse.Object.extend('Follow');
    const featuredAnswerQuery = new Parse.Query(Answer);
    featuredAnswerQuery.containsAll('lists', [pointerTo('CTsXJi51Qc', 'List')]);
    const followQuery = new Parse.Query(Follow);
    followQuery.equalTo('fromUser', request.user);
    const followAnswerQuery = new Parse.Query(Answer);
    followAnswerQuery.matchesKeyInQuery('userRef', 'toUser', followQuery);
    const compoundQuery =  Parse.Query.or(featuredAnswerQuery, followAnswerQuery);
    compoundQuery.include(['questionRef', 'questionRef.toUser',
        'questionRef.fromUser', 'questionRef.charity', 'questionRef.list', 'userRef']);
    compoundQuery.notEqualTo('isTest', true);
    compoundQuery.descending('createdAt');
    compoundQuery.lessThan('liveDate', new Date());
    compoundQuery.limit(limit);
    compoundQuery.skip(skip);
    compoundQuery.find({useMasterKey: true}).then(function(answers) {
        response.success(answers);
    }, function(err) {
        response.error(err);
    })
})

Parse.Cloud.define('convertToCoins', function(req, res) {
    const userId = req.user.id;
    const userQuery = new Parse.Query(Parse.User);
    userQuery.get(userId, {useMasterKey: true}).then(function(user) {
        user.increment('matchCount', Math.round(user.get('earningsBalance') * 100));
        user.set('earningsBalance', 0);
         user.save(null, {useMasterKey: true}).then(function(user) {
            res.success(user);
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
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
        type: "general",
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

Parse.Cloud.define('getMpSignupUnlockFunnel', function(req, res) {
    var fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth());
    fromDate = (fromDate.getFullYear() + "-" + fromDate.getMonth() + "-" + fromDate.getDate());
    var toDate = new Date();
    toDate = (toDate.getFullYear() + "-" + (toDate.getMonth() + 1) + "-" + toDate.getDate());
    panel.funnels({
        funnel_id: '2711170',
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
        query.containsAll('lists', pointerTo(req.params.topic_id, 'Tag'));
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
                                    var tags = object.get('tags');
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
                                            date: date.toLocaleDateString(),
                                            tags: object.get('tags'),
                                            eavesdrops: object.get("unlockCount"),
                                            likes: object.get('likeCount'),
                                            charity: (charity) ? charity.get('name') : 'None',
                                            charityImage: (charity) ? charity.get('image').url() : '',
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

    query.count().then(function (result) {
        count = result;
        // pagination
        query.limit(limit);
        query.skip(skip);
        findCampfires();
    });
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
    if (req.params.allowKOLUser === true) {
        query.equalTo('isAdminKOL', true);
    }
    if (req.params.allowShadowUser === false) {
        query.notEqualTo('isShadowUser', true);
    }
    if (req.params.allowTestUser === false) {
        query.notEqualTo('isTestUser', true);
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
                        createdAt: object.get('createdAt').toDateString(),
                        isShadowUser: object.get('isShadowUser'),
                        isTestUser: object.get('isTestUser'),
                        isKOLUser: object.get('isAdminKOL')
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
            //sendPushOrSMS(request.user, users, 'friendMatch');
            response.success(users);
        } else {
            response.success([]);
        }
    }, function(err){
        console.log(err);
        throw "Got an error " + error.code + " : " + error.message;
    });
});

Parse.Cloud.define('requestCashout', function(request, response){
    var currentUser = request.user;
    var paypalEmail = request.params.paypalEmail;
    var cashoutAmount = request.params.cashoutAmount;
    
    const cashout = new Parse.Object('Cashout');
    cashout.set('userRef', currentUser);
    cashout.set('paypalEmail', paypalEmail);
    cashout.set('cashOutAmount', cashoutAmount);
    cashout.set('isConfirmed', false);
    cashout.set('isPaid', false);
    cashout.set('status', 'Pending');
    cashout.save(null).then((res) => {
        // Send notification email to paypal address
        sendCashoutEmail(paypalEmail, {});
        response.success({});
    }, function(err) {
        console.log(err);
        response.error(err);
    });
});


Parse.Cloud.define('rejectCashOut', function(request, response){
    const CashOut = Parse.Object.extend('Cashout');
    const cashOutQuery = new Parse.Query(CashOut);
    cashOutQuery.include(['userRef']);
    cashOutQuery.get(request.params.cashOutId, {useMasterKey: true}).then(cashOut => {
        cashOut.set('status', 'Rejected');
        cashOut.set('cashOutAmount', cashOut.get('userRef').get('earningsBalance'));
        cashOut.set('isConfirmed', false);
        cashOut.set('isPaid', false);
        cashOut.save(null, {useMasterKey: true}).then(() => {
            sendCashoutRejectEmail(cashOut.get('userRef').get('email'), {});
            response.success({});
        }, function(err) {
            console.log(err);
            response.error(err);
        })
    }, function(err) {
        console.log(err);
        response.error(err);
    });
});

Parse.Cloud.define('withdraw', function(request, response){
    const cashoutId = request.params.cashoutId;
    const Cashout = Parse.Object.extend('Cashout');
    const query = new Parse.Query(Cashout);
    query.include('userRef.paypalEmail');
    try {
        query.get(cashoutId, {useMasterKey: true}).then(cashout => {
            var userId = cashout.get('userRef').id;
            var paypalEmail = cashout.get('userRef').get('paypalEmail');
            var user = cashout.get('userRef');
            var earningsBalance = user.get('earningsBalance');
            var email = user.get('email');
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
            let roundedEarningsBalance = Math.floor(earningsBalance * Math.pow(10, 2)) / Math.pow(10, 2);
            var create_payout_json = {
                'RECEIVERTYPE': 'Email',
                'L_EMAIL0': paypalEmail,
                'L_AMT0': roundedEarningsBalance,
                'CURRENCYCODE': 'USD'
            };

            console.log('Payout_Request_Json', create_payout_json);
            paypal.request('MassPay', create_payout_json).then(function (payout) {
                const transaction = new Parse.Object('Transaction');
                transaction.set('userRef', request.user);
                transaction.set('amount', roundedEarningsBalance);
                transaction.set('paypalEmail', paypalEmail);

                transaction.set('CORRELATIONID', payout.CORRELATIONID);
                transaction.set('ACK', payout.ACK);
                transaction.set('L_ERRORCODE0', payout.L_ERRORCODE0);
                transaction.set('L_SHORTMESSAGE0', payout.L_SHORTMESSAGE0);
                transaction.set('L_LONGMESSAGE0', payout.L_LONGMESSAGE0);
                transaction.set('L_SEVERITYCODE0', payout.L_SEVERITYCODE0);
                transaction.set('TIMESTAMP', payout.TIMESTAMP);

                transaction.save(null, {useMasterKey: true}).then();

                //Get Payout Item

                console.log("Created Single Payout");
                console.log(payout);
                if (payout.ACK == 'Success') {
                    const date = new Date();
                    user.set('earningsBalance', earningsBalance - roundedEarningsBalance);
                    user.save(null, {useMasterKey: true}).then(function (user) {
                        console.log(`Updated balance of ${user.get('earningsBalance')}`);
                        response.success(payout);
                    }, function (error) {
                        console.log(`Paid ${earningsBalance} to ${paypalEmail} but failed to update earningsBalance to 0`);
                        console.log(error);
                        response.success(payout);
                    });

                    // Update payouts to isPaid=true and transactionRef
                    const pastCashoutQuery = new Parse.Query(Cashout);
                    pastCashoutQuery.descending('paidDate');
                    pastCashoutQuery.equalTo('userRef', user);
                    pastCashoutQuery.notEqualTo('objectId', cashout.id);
                    pastCashoutQuery.first({useMasterKey: true}).then(pastCashout => {
                        let pastDate = new Date('2000-01-01');
                        // Update paidDate of cashout

                        cashout.set('paidDate', date);
                        cashout.set('cashOutAmount', roundedEarningsBalance);
                        cashout.set('isPaid', true);
                        cashout.set('isConfirmed', true);
                        cashout.set('status', 'Confirmed');

                        cashout.save(null, {useMasterKey: true}).then(() => response.success({}), err => response.error(err));
                        
                        // Send cashout success email
                        sendCashoutSuccessEmail(cashout.get('userRef').get('email'), {
                            cashOutAmount: roundedEarningsBalance
                        });
                        if (pastCashout)
                            pastDate = pastCashout.get('paidDate');
                        const Payout = Parse.Object.extend('Payout');
                        const payoutQuery = new Parse.Query(Payout);
                        payoutQuery.equalTo('userRef', user);
                        console.log(pastDate);
                        payoutQuery.greaterThan('createdAt', pastDate);
                        payoutQuery.each(payout => {
                            payout.set('isPaid', true);
                            payout.set('cashoutRef', cashout);
                            return payout.save(null, {useMasterKey: true});
                        })
                    })
                } else {
                    response.error(payout);
                    sendTransactionFailureEmail('krittylor@gmail.com', {
                        userId: request.user.id,
                        fullName: request.user.get('fullName'),
                        amount: roundedEarningsBalance,
                        paypalEmail: paypalEmail,
                        shortMessage: payout.L_SHORTMESSAGE0,
                        longMessage: payout.L_LONGMESSAGE0,
                        timestamp: payout.TIMESTAMP
                    });
                    var errorCode = payout.L_ERRORCODE0;
                    console.log(`Something went wrong with payout`);
                    console.log(`ErrorCode : ${payout.L_ERRORCODE0}, ${payout.L_SHORTMESSAGE0}`)
                }
            }).catch(function (err) {
                console.log(err.response);
                const transaction = new Parse.Object('Transaction');
                transaction.set('userRef', user);
                transaction.set('amount', roundedEarningsBalance);
                transaction.set('paypalEmail', paypalEmail);
                transaction.save(null, {useMasterKey: true}).then();
                sendTransactionFailureEmail('krittylor@gmail.com', {
                    userId: userId,
                    fullName: user.get('fullName'),
                    amount: roundedEarningsBalance,
                    paypalEmail: paypalEmail,
                    shortMessage: 'Masspayout api call failed',
                    longMessage: 'Masspayout api call failed',
                    timestamp: new Date().toISOString()
                });
                response.error(err);
                throw 'Got an error ' + err.code + ' : ' + err.message;
            });
        }, function (err) {
            console.log(err);
            response.error(err);
        });
    } catch(err) {
        console.log(err);
        response.error(err);
    }
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
//(function scheduleRefund(){
//    setInterval(function(){
//        var Question = Parse.Object.extend('Question');
//        var query = new Parse.Query(Question);
//        var currentDate = new Date();
//        var start = new Date();
//        var end = new Date();
//        start.setDate(start.getDate() - 4);
//        end.setDate(end.getDate() - 3);
//        query.greaterThanOrEqualTo('createdAt', start);
//        query.lessThanOrEqualTo('createdAt', end);
//        query.notEqualTo('isAutoQuestion', true);
//        query.equalTo('isAnswered', false);
//        query.notEqualTo('isRefunded', true);
//        query.include(['fromUser', 'toUser']);
//        query.find({useMasterKey: true}).then(function(questions){
//            if(questions.length){
//                questions.forEach(function(question){
//                    if (!question.get('fromUser') && question.get('isAnswered') === false) {
//                        question.destroy({useMasterKey: true});
//                        console.log('Destroying null question', question.id);
//                        return;
//                    }
//                    if (!question.get('toUser') && question.get('isAnswered') === false) {
//                        question.destroy({useMasterKey: true});
//                        console.log('Destroying null question', question.id);
//                        return;
//                    }
//                    console.log('Refunding money for question ', question.get('text'));
//                    question.set('isExpired', true);
//                    question.set('isRefunded', true);
//                    question.save(null, {useMasterKey: true});
//                    const fromUser = question.get('fromUser');
//                    fromUser.increment('matchCount', question.get('price') / matchValue);
//                    fromUser.increment('unansweredQuestionCount', -1);
//                    fromUser.save(null, {useMasterKey : true});
//                });
//            }
//        });
//    }, 60 * 5 * 1000);
//})();

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
    let firstName = request.user.get('firstName');
    const lastName = request.user.get('lastName');
    if (!firstName && !lastName)
      return response.success({});
    if (!firstName)
      firstName = '';
    const IntroQuestion = Parse.Object.extend('IntroQuestions');
    const introQuestionQuery = new Parse.Query(IntroQuestion);
    introQuestionQuery.equalTo('isLive', true);
    introQuestionQuery.find({useMasterKey: true}).then(introQuestions => {
        let rand = Math.floor(introQuestions.length * Math.random());
        if (rand === introQuestions.length && rand !== 0)
            rand = introQuestions.length - 1;
        const text = `Hey ${firstName}! ${introQuestions[rand].get('text')}`;
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
            question.set('text', text);
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
    }, err => {
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
        length: 10
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

Parse.Cloud.define('setTagsToPerson', function(req, res) {
    const userId = req.params.userId;
    const tags = req.params.tags;
    const query = new Parse.Query(Parse.User);
    query.get(userId, {useMasterKey: true}).then(function(user) {
        const profileTags = tags.map(tagId => pointerTo(tagId, 'Tag'));
        user.set('profileTags', profileTags);
        user.save(null, {useMasterKey: true}).then(function() {
            res.success('ok');
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
});

Parse.Cloud.define('updateCanSubscribe', function(req, res) {
    const userId = req.params.userId;
    const promoImage = req.params.promoImage;
    const canSubscribe = req.params.canSubscribe;
    const query = new Parse.Query(Parse.User);
    query.get(userId, {useMasterKey: true}).then(function(user) {
        if(promoImage){
            user.set('promoImage', promoImage);
        }
        user.set('canSubscribe', canSubscribe);
        user.save(null, {useMasterKey: true}).then(function() {
            res.success('ok');
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
});

Parse.Cloud.define('updateUserVerified', function(req, res) {
    const userId = req.params.userId;
    const isVerified = req.params.isVerified;
    const query = new Parse.Query(Parse.User);
    query.get(userId, {useMasterKey: true}).then(function(user) {
        user.set('isVerified', isVerified);
        user.save(null, {useMasterKey: true}).then(function() {
            res.success('ok');
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
});

Parse.Cloud.define('setTagsToCampfire', function(req, res) {
    const answerId = req.params.answerId;
    const tagIds = req.params.tags;
    const Answer = Parse.Object.extend('Answer');
    const query = new Parse.Query(Answer);
    query.get(answerId, {useMasterKey: true}).then(function(answer) {
        const tags = tagIds.map(tagId => pointerTo(tagId, 'Tag'));
        answer.set('tags', tags);
        answer.save(null, {useMasterKey: true}).then(function() {
            res.success('ok');
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
});

Parse.Cloud.define('setPersonTestUser', function(req, res) {
    const userId = req.params.userId;
    const isATestUser = req.params.setTestUser;
    const query = new Parse.Query(Parse.User);
    query.get(userId, {useMasterKey: true}).then(function(user) {
        user.set('isTestUser', isATestUser);
        user.save(null, {useMasterKey: true}).then(function() {
            res.success('ok');
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
});

Parse.Cloud.define('setPersonShadowUser', function(req, res) {
    const userId = req.params.userId;
    const isAShadowUser = req.params.setShadowUser;
    const query = new Parse.Query(Parse.User);
    query.get(userId, {useMasterKey: true}).then(function(user) {
        user.set('isShadowUser', isAShadowUser);
        user.save(null, {useMasterKey: true}).then(function() {
            res.success('ok');
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
});

Parse.Cloud.define('setCategoryIsLive', function(req, res) {
    const categoryId = req.params.categoryId;
    const isLive = req.params.setIsLive;
    const Category = Parse.Object.extend('Category');
    const query = new Parse.Query(Category);
    query.get(categoryId, {useMasterKey: true}).then(function(category) {
        category.set('isLive', isLive);
        category.save(null, {useMasterKey: true}).then(function() {
            res.success('ok');
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
});

Parse.Cloud.define('setCategoryAnswersFromUsers', function(req, res) {
    const categoryId = req.params.categoryId;
    const answersFromUsers = req.params.answersFromUsers;
    const Category = Parse.Object.extend('Category');
    const query = new Parse.Query(Category);
    query.get(categoryId, {useMasterKey: true}).then(function(category) {
        category.set('answersFromUsers', answersFromUsers);
        category.save(null, {useMasterKey: true}).then(function() {
            res.success('ok');
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
});

Parse.Cloud.define('setPersonKOLUser', function(req, res) {
    const userId = req.params.userId;
    const isAKOLUser = req.params.setKOLUser;
    const query = new Parse.Query(Parse.User);
    query.get(userId, {useMasterKey: true}).then(function(user) {
        user.set('isAdminKOL', isAKOLUser);
        user.save(null, {useMasterKey: true}).then(function() {
            res.success('ok');
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    });
});

Parse.Cloud.define('updatePoint', function(req, res) {
    const userId = req.params.userId;
    const action = req.params.action;
    console.log('UserId: ', userId, 'Action: ', action);
    const query = new Parse.Query(Parse.User);
    query.get(userId, {useMasterKey: true}).then(function(user) {
        let cloutPoints = user.get('cloutPoints') || 0;
        let plusPoints = 0;
        switch (action) {
            case 'question':
                plusPoints = pointsForQuestion;
                break;
            case 'answer':
                plusPoints = pointsForAnswer;
                break;
            case 'unlock':
                plusPoints = pointsForUnlock;
                break;
            case 'like':
                plusPoints = pointsForLike;
                break;
            case 'follow':
                plusPoints = pointsForFollow;
                break;
            case 'listen':
                plusPoints = pointsForListen;
                break;
            default:
                plusPoints = 0;
                break;
        }
        cloutPoints += plusPoints;
        // Guess current level of user with cloutpoints, clout levels
        let userLevel = undefined;
        const CloutLevel = Parse.Object.extend('CloutLevel');
        const levelQuery = new Parse.Query(CloutLevel);
        levelQuery.descending('cloutPoints');
        levelQuery.find({useMasterKey: true}).then(function(levels) {
            console.log('levels');
            for (let i = 0; i < levels.length; i++) {
                if (levels[i].get('cloutPoints') < cloutPoints) {
                    userLevel = levels[i];
                    break;
                }
            }
            user.set('cloutLevel', userLevel);
            user.set('cloutPoints', cloutPoints);
            user.save(null, {useMasterKey: true}).then(function(user) {
                console.log(user);
                res.success('ok');
            }, function(err) {
                console.log(err);
                res.error(err);
            });
        }, function(err) {
            console.log(err);
            res.error(err);
        })
    }, function(err) {
        console.log(err);
        res.error(err);
    })

})

Parse.Cloud.define('getFeaturedUsersApp', function(request, response) {
    const Defaults = Parse.Object.extend('Defaults');
    const query = new Parse.Query(Defaults);
    query.first({useMasterKey: true}).then(function(defaultSettings) {
        const featuredUserIds = defaultSettings.get('featuredPeople');
        const userQuery = new Parse.Query(Parse.User);
        userQuery.containedIn('objectId', featuredUserIds);
        userQuery.include(['charityRef']);
        const Answer = Parse.Object.extend('Answer');
        const featuredUsersList = [];
        userQuery.find({useMasterKey: true}).then(wrapper(function*(featuredUsers) {
            for (let i = 0; i < featuredUsers.length; i++) {
                try {
                    const lastAnswer = yield new Promise((resolve, reject) => {
                        const answerQuery = new Parse.Query(Answer);
                        answerQuery.equalTo('userRef', featuredUsers[i])
                        answerQuery.descending('createdAt');
                        answerQuery.limit(1);
                        answerQuery.include('questionRef');
                        answerQuery.first({useMasterKey: true}).then(function (answer) {
                            console.log(answer);
                            resolve(answer);
                        }, function (err) {
                            console.log(err);
                            reject(err);
                        });
                    });
                    console.log(lastAnswer);
                    const featuredUserAppObj = {
                        id: featuredUsers[i].id,
                        fullName: featuredUsers[i].get('fullName'),
                        profilePhoto: featuredUsers[i].get('profilePhoto').url(),
                        tags: featuredUsers[i].get('tags'),
                        charityName: featuredUsers[i].get('charityRef') ? featuredUsers[i].get('charityRef').get('name') : '',
                        charityImage: featuredUsers[i].get('charityRef') ? featuredUsers[i].get('charityRef').get('image').url() : '',
                        verified: featuredUsers[i].get('emailVerified') === true,
                        lastQuestionText: lastAnswer.get('questionRef').get('text')
                    };
                    featuredUsersList.push(featuredUserAppObj);
                } catch (err) {
                    console.log('Failed to fetch last answer for featured user', featuredUsers[i].id);
                }
            }
            featuredUsersList.sort(function(a, b) {
                if (featuredUserIds.indexOf(a.id) < featuredUserIds.indexOf(b.id))
                  return -1;
                else
                  return 1;
            });
            response.success(featuredUsersList);
        }), function(err) {
            response.error(err);
        });
    });
});

Parse.Cloud.define('getFeedDisplayLists', function(request, response) {

    var List = Parse.Object.extend('List');
    var Question = Parse.Object.extend('Question');

    var listQuery = new Parse.Query(List);

    var currentDate = new Date();
    listQuery.greaterThanOrEqualTo('endDate', currentDate);
    listQuery.lessThanOrEqualTo('liveDate', currentDate);
    listQuery.notContainedIn('name', ['Featured Web', 'Featured']);
    listQuery.include(['questionRef', 'questionRef.toUser','questionRef.fromUser', 'questionRef.charity', 'userRef']);
    listQuery.descending('liveDate');
    //var completed = function(countMap){
    //    if(countMap.length > 0)
    //        countMap.sort(function(a, b){
    //            if(a.list.get('createdAt') < b.list.get('createdAt'))
    //                return 1;
    //            if(a.list.get('createdAt') > b.list.get('createdAt'))
    //                return -1;
    //            return 0;
    //        });
    //    response.success(countMap);
    //};

    listQuery.find({useMasterKey: true}).then(function(lists){
        response.success(lists);
        //if(lists.length === 0)
        //    return completed([]);
        //const listCount = lists.length;
        //const countMap = [];
        //var processed = 0;
        //lists.forEach(function(list){
        //    //Check answer's live date and list
        //    var Answer = Parse.Object.extend('Answer');
        //    var query = new Parse.Query(Answer);
        //    query.containsAll('lists', [pointerTo(list.id, 'List')]);
        //    query.count().then(function(count){
        //        countMap.push({
        //            list: list,
        //            count: count
        //        });
        //        processed++;
        //        if(listCount === processed){
        //            completed(countMap);
        //        }
        //    });
        //})
    }, err => {
        response.error(err);
    })
});

Parse.Cloud.define('generateAutoQuestionsForInActiveUsers', (req, res) => {
    generateAutoQuestionsForInActiveUsers();
    res.success({});
});

Parse.Cloud.job('GenerateAutoQuestionsForInActiveUsers', (request, status) => {
    generateAutoQuestionsForInActiveUsers();
    status.success();
});

Parse.Cloud.define('sendAutoQuestionsToGroup', (req, res) => {
    sendAutoQuestionsToGroup(req.params.from, req.params.to);
    res.success({});
});
function generateAutoQuestionsForInActiveUsers() {
    const Question = Parse.Object.extend('Question');
    const Defaults = Parse.Object.extend('Defaults');
    const AutoQuestion = Parse.Object.extend('AutoQuestions');
    const autoQuestionQuery = new Parse.Query(AutoQuestion);
    autoQuestionQuery.equalTo('isLive', true);
    const defaultQuery = new Parse.Query(Defaults);

    let featuredPeople = [];
    let autoQuestionTagRef;
    defaultQuery.find({useMasterKey: true}).then(defaultSettings => {
        const featuredPeopleIds = defaultSettings[0].get('teamMembers');
        autoQuestionTagRef = defaultSettings[0].get('autoQuestionTagRef');
        //console.log('Team members', featuredPeopleIds);
        const userQuery = new Parse.Query(Parse.User);
        userQuery.containedIn('objectId', featuredPeopleIds);
        return userQuery.find({useMasterKey: true});
    }).then((users) => {
        featuredPeople = users;
        return autoQuestionQuery.find({useMasterKey: true});
    }).then(autoQuestions => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        const userQuery = new Parse.Query(Parse.User);
        userQuery.notEqualTo('isTestUser', true);
        userQuery.notEqualTo('isShadowUser', true);
        userQuery.lessThan('lastActive', date);
        //userQuery.containedIn('objectId', [
        //    "zdnCGeyrJy",
        //    "oEO7y8Cq7H",
        //    "OibpPXeOsj",
        //    "AWxDK7u1Db",
        //    "LFaUU9DnNy",
        //    "JMN2NJCXFZ",
        //    "B4ITpzf2DA",
        //    "8alUO4H6Xv",
        //    "7mLBj1qsfX",
        //    "CxOh8uaHKk",
        //    "Zpa2aEMhP2",
        //    "WuXvdsBn5b",
        //    "eQAbHX5mN0",
        //    "SSJQ8mW13x",
        //    "I0A8tc18Fs",
        //    "wdoJiComO1",
        //    "SIKRqtWdEg",
        //    "ZKGabquWrP",
        //    "QkVDUuHDkN",
        //    "azHmsjW2y7",
        //    "3mjhBJNSMM",
        //    "lTDfprt3Yj",
        //    "7l20TGN5b8",
        //    "MdOCGrRIzn"
        //]);
        userQuery.each(user => {
            const question = new Question();
            const fromUser = featuredPeople[Math.floor(Math.min(Math.random(), 1) * featuredPeople.length)];
            question.set('fromUser', fromUser);
            question.set('toUser', user);
            question.set('text', autoQuestions[Math.floor(Math.min(Math.random(), 1) * autoQuestions.length)].get('text'));
            question.set('price', 0);
            question.set('charityPercentage', 0);
            question.set('isExpired', false);
            question.set('isTest', false);
            question.set('isAutoQuestion', true);
            question.set('isAnswered', false);
            question.set('initialTag', autoQuestionTagRef);
            //console.log(count);
            return question.save(null, {useMasterKey: true});
        }, {useMasterKey: true});
    });
}

function sendAutoQuestionsToGroup(fromUserIds, toUserIds) {
    const Question = Parse.Object.extend('Question');
    const Defaults = Parse.Object.extend('Defaults');
    const AutoQuestion = Parse.Object.extend('AutoQuestions');
    const autoQuestionQuery = new Parse.Query(AutoQuestion);
    autoQuestionQuery.equalTo('isLive', true);
    const defaultQuery = new Parse.Query(Defaults);

    let fromUsers = [], toUsers = [], autoQuestions;
    let autoQuestionTagRef;
    defaultQuery.find({useMasterKey: true})
        .then(defaultSettings => {
            autoQuestionTagRef = defaultSettings[0].get('autoQuestionTagRef');
            return autoQuestionQuery.find({useMasterKey: true});
        })
        .then(res => {
            autoQuestions = res;
            let fromUsersQuery = new Parse.Query(Parse.User);
            fromUsersQuery.containedIn('objectId', fromUserIds);
            return fromUsersQuery.find({useMasterKey: true});
        })
        .then(res => {
            fromUsers = res;
            let toUsersQuery = new Parse.Query(Parse.User);
            toUsersQuery.containedIn('objectId', toUserIds);
            return toUsersQuery.find({useMasterKey: true});
        })
        .then(res => {
            toUsers = res;
            toUsers.forEach(toUser => {
                const question = new Question();
                const fromUser = fromUsers[Math.min(Math.floor(Math.random() * fromUsers.length), fromUsers.length - 1)];
                question.set('fromUser', fromUser);
                question.set('toUser', toUser);
                question.set('text', autoQuestions[Math.min(Math.floor(Math.random() * autoQuestions.length), autoQuestions.length - 1)].get('text'));
                question.set('price', 0);
                question.set('charityPercentage', 0);
                question.set('isExpired', false);
                question.set('isTest', false);
                question.set('isAutoQuestion', true);
                question.set('isAnswered', false);
                question.set('initialTag', autoQuestionTagRef);
                //console.log(count);
                question.save(null, {useMasterKey: true})
                    .then(savedQuestion => {
                        mixpanel.track('Admin Targeted Question Asked', {
                            'Answerer ID': toUser.id,
                            'Answerer Name': toUser.get('fullName'),
                            'Asker ID': fromUser.id,
                            'Asker Name': fromUser.get('fullName'),
                            'Question Text': savedQuestion.get('text'),
                            'Question ID': savedQuestion.id
                        });
                    })
                    .catch(err => {
                        console.log(err);
                    })
            }, {useMasterKey: true});
        })
        .catch(err => {
            console.log(err);
        });
}

//sendAutoQuestionsToGroup(['zdnCGeyrJy'], ['SSJQ8mW13x']);
Parse.Cloud.define('resetFeaturedAnswers', (req, res) => {
    resetFeaturedAnswers().then();
    res.success({});
})

Parse.Cloud.define('validateReceipt', (request, response) => {
    const {receipt} = request.params;
    const {productId} = request.params;
    const secretKey = config.appleSecretKey;
    iap.config({
        applePassword: secretKey
    });
    iap.setup(function (error) {
        if (error) {
            console.error('something went wrong...');
            return response.error(error);
        }
        // iap is ready
        iap.validate(iap.APPLE, receipt, function (err, appleRes) {
            if (err) {
                console.error(err);
                response.error(err);
            } else if (iap.isValidated(appleRes)) {
                // yay good!
                // Get subscription
                console.log('Latest receipt info', appleRes.latest_receipt_info);
                // appleRes = appleRes.receipt;
                if (appleRes.latest_receipt_info) {
                    console.log('Latest receipt info exists');
                    try {
                        const receiptObj = new Parse.Object('Receipt');
                        receiptObj.set('userRef', request.user);
                        receiptObj.set('receipt', receipt);
                        receiptObj.save(null, {useMasterKey: true}).then(res => console.log('Successfully added receipt to database', res), err => console.log('An error occured while adding receipt', err));
                        const latestItem = appleRes.latest_receipt_info[appleRes.latest_receipt_info.length - 1];
                        const subscriptionExpirationDate = new Date(parseInt(latestItem.expires_date_ms));
                        request.user.set('subscriptionExpirationDate', subscriptionExpirationDate);
                        request.user.save(null, {useMasterKey: true})
                          .then(() => {
                              console.log('Successfully updated subscription expiration date');
                          })
                          .catch(err => {
                              console.log(err);
                          })
                    }
                    catch(err) {
                        console.log(err);
                    }

                }
                response.success({verified: true});
            } else {
                response.success({verified: false})
            }
        });
    });
});

Parse.Cloud.define('checkSubscriptionExpiration', (request, response) => {
    const user = request.user;
    const Receipt = Parse.Object.extend('Receipt');
    const receiptQuery = new Parse.Query(Receipt);
    receiptQuery.equalTo('userRef', user);
    receiptQuery.descending('createdAt');
    receiptQuery.first({useMasterKey: true})
      .then(receiptObj => {
          if (!receiptObj) 
            return response.success(new Error('No subscription for you yet'));
          const receipt = receiptObj.get('receipt');
          const secretKey = config.appleSecretKey;
          iap.config({
              applePassword: secretKey
          });
          iap.setup(function (error) {
              if (error) {
                  console.error('something went wrong...');
                  return response.error(error);
              }
              // iap is ready
              iap.validate(iap.APPLE, receipt, function (err, appleRes) {
                  if (err) {
                      console.error(err);
                      response.error(err);
                  } else if (iap.isValidated(appleRes)) {
                      // yay good!
                      // Get subscription
                      if (appleRes.latest_receipt_info) {
                          const latestItem = appleRes.latest_receipt_info[appleRes.latest_receipt_info.length - 1];
                          const subscriptionExpirationDate = new Date(parseInt(latestItem.expires_date_ms));
                          request.user.set('subscriptionExpirationDate', subscriptionExpirationDate);
                          request.user.save(null, {useMasterKey: true})
                            .then(() => {
                                console.log('Successfully updated subscription expiration date');
                            })
                            .catch(err => {
                                console.log(err);
                            });

                          if (parseInt(latestItem.expires_date_ms) > new Date().getTime()) {
                              return response.success({expired: false});
                          }
                      }
                      if (appleRes.pending_renewal_info && appleRes.pending_renewal_info[0]) {
                          console.log(appleRes.pending_renewal_info[0]);
                          if (appleRes.pending_renewal_info[0].auto_renew_status === '0') {
                              response.success({expired: true});
                          } else {
                              response.success({expired: false});
                          }
                      } else {
                          response.error(new Error('Can not detect'));
                      }
                  } else {
                      response.success(new Error('Your receipt is invalid'));
                  }
              });
          });
      })
});
Parse.Cloud.define('notifyCommunity', (request, response) => {
    const Defaults = Parse.Object.extend('Defaults');
    const query = new Parse.Query(Defaults);
    query.first({useMasterKey: true})
        .then(defaults => {
            const lastCommunityNotifiedAt = defaults.get('lastCommunityNotifiedAt');
            if (lastCommunityNotifiedAt && lastCommunityNotifiedAt.getTime() >= new Date(new Date().getTime() - 24 * 3600 * 1000).getTime()) {
                throw new Error(`Community can be notified once a day`);
            } else {
                const {title, text, target, type, listId, profileId} = request.params;
                var pushQuery = new Parse.Query(Parse.Installation);
                pushQuery.equalTo('deviceType', 'ios');
                const data = {
                    alert: text,
                    title,
                    tag: 'NotifyCommunity',
                    notifyType: type,
                    listId: listId,
                    profileId: profileId
                };
                if (target === 'Inactive') {
                    const userQuery = new Parse.Query(Parse.User);
                    userQuery.lessThan('lastActive', new Date(new Date().getTime() - 24 * 3600 * 1000));
                    pushQuery.matchesQuery('user', userQuery);
                }
                Parse.Push.send({
                    where: pushQuery,
                    data: data
                }, {
                    useMasterKey: true,
                    success: function () {
                        // Push was successful
                        defaults.set('lastCommunityNotifiedAt', new Date());
                        defaults.save(null, {useMasterKey: true});
                        response.success({});
                    },
                    error: function (error) {
                        throw "PUSH: Got an error " + error.code + " : " + error.message;
                    }
                });
            }
        })
        .catch(err => {
            console.log(err);
            response.error(err);
        })
});
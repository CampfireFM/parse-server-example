const {sendSummaryEmail} = require('../utils/mail');
const {checkEmailSubscription, sendPush} = require('./common');
const config = require('../config.js');
const payment_methods = require("../utils/paymenthandler.js");
const stripe = require('stripe')(config.stripe_test_key);
//include the JS files which represent each classes (models), and contains their operations
require("./models/Answer.js");
require("./models/Campfire.js");
require("./models/CampfireUnlock.js");
require("./models/Follow.js");
require("./models/Like.js");
require("./models/Question.js");
require("./models/User.js");
require("./algolia/algoliaQuestions.js");
require("./common");

require("./category");
require("./topic");
require("./transcript");

transactionPercentage = 2.9;
transactionFee = 0.3;
answerPercentageToCampfire = 0.2;
campfireUnlockValue = 0.12;

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
    }, function(err){
        //set to default value
        transactionFee = 0.3;
        transactionPercentage = 2.9;
        answerPercentageToCampfire = 0.2;
        campfireUnlockValue = 0.12;
        console.log(err);
    })
})();

Parse.Cloud.afterSave('Defaults', function(request){
    transactionPercentage = request.object.get('transactionPercentage');
    transactionFee = request.object.get('transactionFee');
    answerPercentageToCampfire = request.object.get('answerPercentageToCampfire');
    campfireUnlockValue = request.object.get('campfireUnlockValue');
    if(!transactionPercentage)
        transactionPercentage = 2.9;
    if(!transactionFee)
        transactionFee = 0.3;
    if(!answerPercentageToCampfire)
        answerPercentageToCampfire = 0.2;
    if(!campfireUnlockValue)
        campfireUnlockValue = 0.12;
});

//the below function is just to test if everything is working fine
Parse.Cloud.define('hello', function(req, res) {
    res.success("Hi");
});

Parse.Cloud.define('getStripeCustomer', function(req, res) {
	var customerId = req.params.customerId;
  	if(!customerId){
  		return res.error('customerId is mandatory');
  	}else{
  		payment_methods.retrieveCustomer(customerId, function(err, result){
  			if(err){
  				return res.error(err);
  			}else{
  				return res.success(result);
  			}
  		})
  	}
});


Parse.Cloud.define('createStripeSourceForCustomer', function(req, res) {
	if(!req.user){
		return res.error("User not logged in");
	}
    var customerId = req.params.stripeCustomerId;
	var sourceToken = req.params.sourceToken;
  	if(!customerId || !sourceToken){
  		return res.error('customerId and SourceToken is mandatory');
  	}else{
  		payment_methods.createSource(customerId, sourceToken, function(err, result){
  			if(err){
  				return res.error(err);
  			}else{
  				return res.success(result);
  			}
  		})
  	}
});


Parse.Cloud.define('createStripeCustomer', function(req, res) {
                   if(!req.user){
                   return res.error("User not logged in");
                   }
                   var email = req.params.email;
                   var sourceToken = req.params.sourceToken;
                   if(!email){
                   return res.error('email is mandatory');
                   }else{
                   stripe.customers.create({
                                           description: 'Customer for email' +email,
                                           source: sourceToken // obtained with Stripe.js
                                           }, function(err, customer) {
                                           if(err){
                                           return res.error(err);
                                           }else{
                                           return res.success(customer);
                                           }
                                           });
                   }
                   });


Parse.Cloud.define('chargeWithToken', function(req, res) {
	if(!req.user){
		return res.error("User not logged in");
	}

	var sourceToken = req.params.sourceToken;
    var customerId = req.params.customerId;
	var amount = req.params.amount;

  	if(!customerId || !amount){
  		return res.error('authToken and amount are mandatory');
  	}else{
  		stripe.charges.create({
	      amount: amount,
	      currency: "usd",
	      customer: customerId,
          capture: false,
	      description: 'Campire - test charging for amount '+amount
	    }, function(err, charge) {
	        if(err){
	          console.log("It was an error");
	          console.log(err);
	          return res.error(err);
	        }else{
	          console.log("It was success");
	          console.log(charge);
	          return res.success(charge);
	        }
	    });
  	}
});


Parse.Cloud.define('updateCustomer', function(req, res) {
                   if(!req.user){
                   return res.error("User not logged in");
                   }

                   var sourceToken = req.params.sourceToken;
                   var customerId = req.params.customerId;

                   if(!customerId || !sourceToken){
                   return res.error('sourceToken and customerId are mandatory');
                   }else{


                   stripe.customers.update(customerId, {
                                                 source: sourceToken
                                                 }, function(err, customer) {
                                                 if (err) {
                                                   return res.error(err)
                                                 } else {
                                                   return res.success(customer)
                                                 }
                                                 });
                   }
                   });



Parse.Cloud.define('addAnswersToList', function(req, res){
  var Answer = Parse.Object.extend('Answer');
  var query = new Parse.Query(Answer);
  query.containedIn("objectId", req.params.answerIds);
  query.find({
    success: function(objects) {
      if (objects.length) {
        for (var i = 0; i < objects.length; i++) {
          var object = objects[i];
          var pointer = new Parse.Object("List");
          pointer.id = req.params.listId;
          object.addUnique("lists", pointer);
          object.save();
        }
        res.success('Success');
      }
    },
    error: function(error) {
      res.error(error);
    }

  })

});

Parse.Cloud.define('getUsers', function(req, res){
  var users = [];
  var User = Parse.Object.extend('User');
  var query = new Parse.Query(User);

  query.find({
    success: function(objects) {
      if (objects.length) {
        for (var i = 0; i < objects.length; i++) {
        var object = objects[i];
          users.push({
            id: object.id,
            name: object.get('fullName')
          });
        }
      }
      res.success(users);
    },
    error: function(error) {
      res.error(error);
    }
  })
});

Parse.Cloud.define('removeAnswersFromList', function(req, res){
  var Answer = Parse.Object.extend('Answer');
  var query = new Parse.Query(Answer);
  query.containedIn("objectId", req.params.answerIds);
  query.find({
    success: function(objects) {
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
    error: function(error) {
      res.error(error);
    }

  })

});

Parse.Cloud.define('getFeaturedCampfire', function(req, res){
  var campfires = [];
  var limit = req.params.limit || 6;
  var skip =  req.params.skip || 0;

  var Answer = Parse.Object.extend('Answer');
  var query = new Parse.Query(Answer);
  //query.equalTo('isDummyData', false);

  query.include(['questionRef', 'questionRef.fromUser.fullName',
    'questionRef.toUser.fullName']);
  query.descending('createdAt');
  query.limit(limit);
  query.skip(skip);

  query.find({
    success: function(objects) {
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
    error: function(error) {
      res.error(error);
    }
  })
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

    var User = Parse.Object.extend('User');
    var UserQuery = new Parse.Query(User);
    UserQuery.equalTo('isTestUser', false);
    UserQuery.equalTo('isDummyUser', false);
    UserQuery.select("objectId", "fullName", "isTestUser", "isDummyUser");
    var Question = Parse.Object.extend("Question");
    var QuestionQuery = new Parse.Query(Question);

    // filtering
    if (req.params.answererName || req.params.answererAskerName) {
        // var User = Parse.Object.extend('User');
        // var UserQuery = new Parse.Query(User);
        // UserQuery.select("objectId", "fullName");
        (req.params.answererAskerName) ? UserQuery.startsWith("fullName", req.params.answererAskerName) : UserQuery.startsWith("fullName", req.params.answererName);
        // var Question = Parse.Object.extend("Question");
        // var QuestionQuery = new Parse.Query(Question);
        (req.params.answererAskerName) ? QuestionQuery.matchesQuery('fromUser', UserQuery) : QuestionQuery.matchesQuery('toUser', UserQuery)
        query.matchesQuery('questionRef', QuestionQuery);
    } else {
      query.matchesQuery('questionRef', QuestionQuery);
    }
    if (req.params.question) {
        var Question = Parse.Object.extend("Question");
        var QuestionQuery = new Parse.Query(Question);
        QuestionQuery.startsWith('text', req.params.question)
        query.matchesQuery('questionRef', QuestionQuery);
    }
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

    var findCampfires = function (){
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

Parse.Cloud.define('getPeople', function(req, res){
  var people = [];
  var sortedBy = req.params.sortedBy || 'createdAt';
  var sortDir = req.params.sortDir || 'desc';
  var page = req.params.currentPage || 1;
  var limit = req.params.perPage || 6;
  var skip = (page - 1) * limit;

  var People = Parse.Object.extend('User');
  var query = new Parse.Query(People);

  // filtering
  if (req.params.fullName){
    query.startsWith('fullName', req.params.fullName);
  }
  if (req.params.email){
    query.startsWith('email', req.params.email);
  }
  if (req.params.gender){
    query.equalTo("gender", req.params.gender);
  }
  if (req.params.tagline){
    query.startsWith("tagline", req.params.tagline);
  }

  // totalpages count
  var count;
  query.count().then(function(result){
    count = result;

    // sorting
    sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy)

    // pagination
    query.limit(limit);
    query.skip(skip);
    query.find({useMasterKey : true}).then(function(objects){
        if (objects.length > 0) {
          for (var i = 0; i < objects.length; i++) {
            var object = objects[i];
            people.push({
              id: object.id,
              profileImage: object.get('profilePhoto') ? (object.get('profilePhoto')).toJSON().url : '',
              fullName: object.get('fullName'),
              email: object.get('email'),
              gender: object.get('gender'),
              tagline: object.get('tagline')
            });
          }
        }
        res.success({people: people,totalItems: count});
      },function(error) {
        res.error(error);
      })
  },function(error) {
    res.error(error);
  });

});

Parse.Cloud.define('getQuestionDetails', function(req, res) {

      var Question = Parse.Object.extend("Question");
      var query = new Parse.Query(Question);
      // query.equalTo("objectId",question.id);
      query.include(['fromUser','fromUser.charityRef','toUser','toUser.charityRef']);
      query.equalTo("objectId",req.params.questionId);
      query.find({
        success: function(questions) {
          console.log(questions.length);
          console.log(questions[0]);
          return res.success(questions[0]);
          // return callback(null,questions[0]);
        },
        error: function(object, error) {
          console.log(error);
          // return callback(error,null);
          return res.error(error);
        }
      });
});


Parse.Cloud.define('deleteCharity', function(req, res) {

    var charity_ids_array = req.params.charity_ids_array;
    deleteCharity(array_charity_ids,function(err,result){
        if(err){
          return res.error(result);
        }else{
          return res.success(result);
        }
    });

});



function deleteCharity(array_charity_ids,callback){

    var array_charity_pointers = [];
    for(id in array_charity_ids){
      array_charity_ids[id] = {__type: "Pointer",className: "Charity",objectId: array_charity_ids[id]};
    }

    var query = new Parse.Query(Parse.User);
    query.equalTo("charityRef", array_charity_pointers);
    query.find({
      success: function(results_users) {

          for(i in results_users){
            results_users[i].unset("charityRef");
          }
          Parse.Object.saveAll(results_users,{useMasterKey:true});

          var Question = Parse.Object.extend('Question');
          var query = new Parse.Query(Question);
          query.equalTo("charity", array_charity_pointers);
          query.find({
            success: function(results_questions) {

                for(i in results_questions){
                  results_questions[i].unset("charity");
                  results_questions[i].set("charityPercentage",0);
                }
                Parse.Object.saveAll(results_questions,{useMasterKey:true});

                var Charity = Parse.Object.extend('Charity');
                var query = new Parse.Query(Charity);
                query.containedIn('objectId', array_charity_ids);
                query.find({useMasterKey:true}).then(function (charity_objects) {

                    Parse.Object.destroyAll(charity_objects);

                    return callback("Delete was success");

                }, function (error) {
                     return callback(error,null);
                });
            },
            error: function(error) {
                return callback(error,null);
            }
          });
      },
      error: function(error) {
          return callback(error,null);
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

  query.find({useMasterKey : true}).then(function(defaults){
    default_values = defaults;
    initial_match_count = defaults[0].get('initialMatchCount');
    default_image = defaults[0].get('coverPhoto');
    if(request.user){
      setUserValues(request.user);
    }
    else{
      var id = request.params.id;
      var User = Parse.Object.extend('User');
      var query = new Parse.Query(User);
      query.get(id, {useMasterKey : true}).then(function(user){
          setUserValues(user);
        }, function(error){
          response.error(error.message);
        });
    }
  },function(error){
    response.error(error.message);
  });

  var setUserValues = function(user){

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
    user.set('accountBalance', '');
    user.set('askAbout', '');
    user.set('tagline', '');
    user.set('donationPercentage', 0);
    user.set('totalEarnings', 0);
    user.set('isTestUser', false);
    user.set('isDummyUser', false);

    // setting both image to default image
    user.set('coverPhoto', default_image);
    user.set('profilePhoto', default_image);

    if(params.profilePicUrl && params.coverPicUrl){
      var image_file_regex = /(.*\.(?:png|jpg|jpeg|gif))/i
      if(!image_file_regex.test(params.profilePicUrl)){
        // If profile pic url is not an image url then save with
        // default image
        saveUser();
      }
      Parse.Cloud.httpRequest({ url: params.profilePicUrl }).then(function(response) {
        var base64_profile_image = response.buffer.toString('base64');
        profilePicFile = new Parse.File("profile.jpeg", { base64: base64_profile_image });
        profilePicFile.save().then(function() {
          user.set('profilePhoto', profilePicFile);
          if(!image_file_regex.test(params.coverPicUrl)){
            // If cover pic url is not an image url then save with
            // default image
            saveUser();
          }
          Parse.Cloud.httpRequest({ url: params.coverPicUrl }).then(function(response) {
            var base64_cover_image = response.buffer.toString('base64');
            coverPicFile = new Parse.File("cover.jpeg", { base64: base64_cover_image });
            coverPicFile.save().then(function() {
              user.set('coverPhoto', coverPicFile);
              saveUser();
            }, function(error) {
              response.error(error.message);
            });
          }, function(error){
            saveUser();
          });
        }, function(error) {
          response.error(error.message);
        });
      },function(error){
        // if we get any error from profile pic url like 404,
        // we save user and give succes response
        // to avoid loosing the rest of the data
        saveUser();
      });
    }
    else{
      user.save(null, {useMasterKey : true}).then(function(user) {
        response.success(user);
      }, function(error) {
        response.error(error.message);
      });
    }

    var saveUser = function(){
      user.save(null, {useMasterKey : true}).then(function(user) {
        response.success(user);
      }, function(error) {
        response.error(error.message);
      });
    }
  }
});

function getFollows(user, callback){
    var Follow = Parse.Object.extend('Follow');
    var followQuery = new Parse.Query(Follow);
    followQuery.include('toUser');
    followQuery.equalTo('fromUser', user);
    followQuery.find({useMasterKey : true}).then(function(follows){
        callback(null, follows);
    }, function(err){
        callback(err, null);
    });
}

function getRecentAnswers(users, callback){
    var Answer = Parse.Object.extend('Answer');
    var answerQuery = new Parse.Query(Answer);
    var date = new Date();
    date.setDate(date.getDate() - 1);
    answerQuery.include('userRef', 'questionRef', 'createdAt');
    answerQuery.greaterThan('updatedAt', date);
    answerQuery.containedIn('userRef', users);
    answerQuery.descending('createdAt');
    answerQuery.find({useMasterKey : true}).then(function(answers){
        if(answers[0])
            callback(null, answers);
        else
            callback(null, []);
    }, function(err){
        callback(err);
    })
}

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

function runSummaryUpdate(){
    var query = new Parse.Query(Parse.User);
    var limitExceed = false;
    return query.each(function(user){
        //Cancel getting summary if user has not subscribed to receive summary email
        if(checkEmailSubscription(user, 'summary') == false)
            return;
        getFollows(user, function(err, follows){
            if(err){
                console.log(err.message);
                return;
            }
            if(follows.length == 0)
                return;
            follows = follows.reduce(function(pre, follow){
                pre.push(follow.get('toUser'));
                return pre;
            }, []);
            getRecentAnswers(follows, function(err, answers){
                if(err) {
                    console.log(err.message);
                    return;
                }
                if(answers.length == 0)
                    return;
                if(answers.length > 5)
                    limitExceed = true;
                answers = answers.slice(0, 5);

                var summaries = answers.reduce(function(pre, answer){
                    //Get userId from answer
                    pre.push({
                        answerId : answer.id,
                        questionId : answer.get('questionRef').id,
                        question : answer.get('questionRef').get('text'),
                        username : answer.get('userRef').get('fullName'),
                        profilePhoto : answer.get('userRef').get('profilePhoto')._name
                    });
                    return pre;
                }, []);

                console.log("SummaryMap : ", summaries);
                //Generate email with template

                //send to test email in development
                var testEmail = process.env.TEST_EMAIL ? process.env.TEST_EMAIL : 'krittylor@gmail.com';
                if (process.env.NODE_ENV == 'production' && process.env.IS_TEST == false)
                    sendSummaryEmail(user.get('email'), summaries);
                else
                    sendSummaryEmail(testEmail, summaries);
            });
        });
    }, {useMasterKey : true})
}

Parse.Cloud.job("sendSummary", function(request, status){

    runSummaryUpdate().then(function(){
        status.success();
    });
});

//Schedule runSummaryUpdate everyday
(function scheduleSummary(){
    setInterval(function(){
        runSummaryUpdate().then(function(){
            console.log('Updated users with summary');
        })
    }, 3600 * 24 * 1000);
})();

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
            sendPush(request.user, users, 'friendMatch');
            response.success(users);
        } else {
            response.success([]);
        }
    }, function(err){
        console.log(err);
        throw "Got an error " + error.code + " : " + error.message;
    });
});


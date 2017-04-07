
var config = require('../config.js');
var payment_methods = require("../utils/paymenthandler.js");
var stripe = require('stripe')(config.stripe_test_key);

//include the JS files which represent each classes (models), and contains their operations
require("./models/Answer.js");
require("./models/Campfire.js");
require("./models/CampfireUnlock.js");
require("./models/Follow.js");
require("./models/Like.js");
require("./models/Question.js");


//the below function is just to test if everything is working fine
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
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



Parse.Cloud.define('getFeaturedCampfire', function(req, res){
  var campfires = [];
  var limit = req.params.limit || 6;
  var skip =  req.params.skip || 0;

  var Campfire = Parse.Object.extend('Campfire');
  var query = new Parse.Query(Campfire);
  query.equalTo('isDummyData', false);

  query.include(['questionRef', 'answerRef', 'questionRef.fromUser.fullName',
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
          var answerFile = object.get('answerRef').get('answerFile');
          if (answerFile) {
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
      response.error(error);
    }
  })
});

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
            id: object.objectId,
            name: object.get('name'),
            type: object.get('type'),
            image: object.get('image') ? (object.get('image')).toJSON().url : ''
          });
        }
      }
      res.success(topics);
    },
    error: function(error) {
      response.error(error);
    }
  })
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
  var params = request.params
  var firstname = params.firstName || '';
  var lastname = params.lastName || '';
  var bio = params.bio || '';
  var initial_match_count = 0;
  var default_image = {};
  var Defaults = Parse.Object.extend('Defaults');
  var default_values = null;
  var query = new Parse.Query(Defaults);
  query.limit(1);

  query.find().then(function(defaults){
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
      query.get(id, {
        success: function(user){
          setUserValues(user);
        },
        error: function(error){
          response.error(error.message);
        }
      })
    }
  },function(error){
    response.error(error.message);
  })

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

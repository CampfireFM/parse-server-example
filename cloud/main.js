
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
                                           if(err){
                                               console.log("It was an error");
                                               console.log(err);
                                               return res.error(err);
                                           
                                           }else{

//                                               customer.source = sourceToken;
//                                               customer.save;

                                               console.log("It was success");
                                               console.log(customer);
                                               
                                               return res.success(nil);
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


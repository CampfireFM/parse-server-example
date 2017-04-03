

var config = require('../config.js');
var stripe = require('stripe')(config.stripe_test_key);

var payment_methods = {};

//below functions just creating a charging instruction on the card. Capture will happen later
payment_methods.createCharge = function(amount, token, questionId, callback){

    stripe.charges.create({
      amount: amount,
      currency: "usd",
      customer: token,
      capture: false,
      description: 'Campire - charging for answering question - id#'+questionId
    }, function(err, charge) {
        if(err){
          console.log("It was an error");
          console.log(err);
          return callback(err,null);
          // return "Charge creation failed, sorry";
          // return res.status(500).send({ result: 'error' : response : err});
        }else{
          console.log("It was success");
          console.log(charge);
          return callback(null,charge);
          // return "charging instruction is done, thanks";
          // return res.status(500).send({ result: 'error' : response : err});
        }
    });
};

payment_methods.capturePayment = function(charge_id, questionId, callback){
    
        //      statement_descriptor: 'Campire - charging for answering question - id#'+questionId
//charge_id
    
    stripe.charges.capture("ch_1A4KcRINpUhRRtfdhECcdWRk"
//        charge : "ch_1A4KcRINpUhRRtfdhECcdWRk"
    , function(err, charge) {
        if(err){
          console.log("It was an error");
          console.log(err);
          return callback(err,null);
          // return "Charge capturing failed, sorry";
          // return res.status(500).send({ result: 'error' : response : err});
        }else{
          console.log("It was success");
          console.log(charge);
          return callback(null,charge);
          // return "charge capturing is done, thanks";
          // return res.status(500).send({ result: 'error' : response : err});
        }
    });
};


payment_methods.retrieveCustomer = function(customerId, callback){

    stripe.customers.retrieve(customerId, function(err, customer) {
      if (err) {
        return callback(err,null);
      } else {
        return callback(null,customer);
      }
    });
};

payment_methods.createSource = function(customerId, sourceToken, callback){

    stripe.customers.createSource(customerId, {
      source: sourceToken
    }, function(err, source) {
      if (err) {
        return callback(err, null);
      } else {
        return callback(null, source);
      }
    });
};

module.exports = payment_methods;


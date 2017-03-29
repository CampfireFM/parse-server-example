

var config = require('../config.js');
var stripe = require('stripe')(config.stripe_test_key);

var payment_methods = {};

//below functions just creating a charging instruction on the card. Capture will happen later
payment_methods.createCharge = function(amount, token, questionId, callback){

    stripe.charges.create({
      amount: amount,
      currency: "usd",
      source: token,
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
}

payment_methods.capturePayment = function(charge_id, questionId, callback){

    stripe.charges.capture({
      charge : charge_id,
      statement_descriptor: 'Campire - charging for answering question - id#'+questionId
    }, function(err, charge) {
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
}

module.exports = payment_methods;



var paymenthandler = require('../../utils/paymenthandler.js');

//begin of afterSave
Parse.Cloud.afterSave("Campfire", function(request) {
      if (request.object.existed() == false) {

            var questionRef = request.object.get("questionRef");
            // questionRef.include(["toUser","fromUser","charity"])
            questionRef.fetch({
                  useMasterKey: true,
                  success: function(question) {

                        request.log.info("REACHED IN QUESTION POINT");
                        request.log.info(question);
                        request.log.info(JSON.stringify(question));

                        chargeUserAndSplitPayment(request, question, function(e,r){
                              console.log(e);
                              console.log(r);
                        });

                        var questionAsker = question.get("fromUser");
                        questionAsker.fetch({
                              useMasterKey: true,
                              success: function(user) {
                                    var Activity = Parse.Object.extend("Activity");
                                    var newActivity1 = new Activity();
                                    newActivity1.set("question", question);
                                    newActivity1.set("campfire", request.object);
                                    newActivity1.set("isRead", false);
                                    newActivity1.set("toUser", user);
                                    //newActivity1.set("fromUser", currentUser);
                                    newActivity1.set("type", "youAskedTheyAnswered");
                                    newActivity1.save(null, { useMasterKey: true });
                              },
                              error: function(object, error) {
                                    console.log(error);
                                    throw "Got an error " + error.code + " : " + error.message;
                              }
                        });
                  },
                  error: function(object, error) {
                        console.log(error);
                        throw "Got an error " + error.code + " : " + error.message;
                  }
            });
      }
});
//end of afterSave


/*
@Description - This function takes the money from the user by charging his card, and split
      the amount between campfire, answerer, and donation
      Important - Call this function only if the question is not expired (compare against default expire time)
      @question - instace of Question object
      @
*/
function chargeUserAndSplitPayment(request, question, callback){

      //first find the charge details for the question
      getChargeDetails(question,function(err_charge, charge){
            if(charge){
                  var chargeId = charge.get("chargeId");
                  request.log.info("The charge ID that we are sending is "+chargeId);
                  request.log.info("The question ID that we are sending is "+question.id);

                  if(!chargeId){
                        return callback("No ChargeId found in the charge table",null);
                  }
                  //if chargeId exists
                  paymenthandler.capturePayment(chargeId, question.id, function(err, res_payment){
                        if(err){
                              //update the charge object
                              //throw an exception here to let the Campfire team know of the charging failure
                              charge.set("statusCaptureCharge","failure");
                              charge.set("responseStripeCapture",err);
                              return callback(err, null);
                        }else{
                              charge.set("statusCaptureCharge","success");
                              charge.set("responseStripeCapture",res_payment);
                              //calls the function to split the payment to stake holders based
                              //on properties of the question
                              splitAndMakePayments(question, charge, function(error, result){

                              });
                        }

                        //updates the charge object with the fields set above
                        charge.save(null, {useMasterKey: true});

                  });
            }
      });
}

//This function calculates the payments for user, donation and creates payouts
function splitAndMakePayments(question, charge, callback){

      var charity = question.get("charity");
      var charity_percentage = question.get("charityPercentage") ? question.get("charityPercentage") : 0;
      var price = question.get("price") ? question.get("price") : 0;

      var split_app = price * ( 20 / 100);
      var split_charity = split_app * ( charity_percentage / 100);
      var split_answerer = split_app - split_charity;

      var payout_params = {
            amount : split_answerer,
            userRef : question.get("toUser"),
            questionRef : question,
            chargeRef : charge,
            type : 'answer',
            isPaid : false
      };

      createPayout(payout_params, function(e,r){
            console.log(e);
            console.log();
        });

      var deposit_params = {
            transactionPercentage: 2.9,
            amount: price,
            transactionFee : 0.3,
            userRef : question.get("fromUser"),
            questionRef : question
      };

      createDeposit(deposit_params, function(e,r){
            console.log(e);
            console.log();
        });

      var charity_params = {
            amount: split_charity,
            charityRef: question.get("charity"),
            questionRef: question,
            userRef : question.get("toUser"),
            isPaid: false
      };

      createCharity(charity_params, function(e,r){
            console.log(e);
            console.log();
        });

      var user_earning_increment = split_charity + split_answerer;
      user.increment("totalEarnings", user_earning_increment);
      user.save(null, {useMasterKey: true});
}

//this function gets the charge details from the Charge table for the given question
function getChargeDetails(question,callback){

      var Charge = Parse.Object.extend("Charge");
      var query = new Parse.Query(Charge);
      query.equalTo("questionRef",question);
      query.find({
        success: function(charges) {
          return callback(null,charges[0]);
        },
        error: function(object, error) {
          return callback(error,null);
        }
      });
}


/*
@Description : Function to createDeposit record
*/
function createDeposit(params, callback){

      var Deposit = Parse.Object.extend("Deposit");
      var deposit = new Deposit();

      for(key in params){
            deposit.set(key,params[key]);
      }

      deposit.save(null, {
            useMasterKey: true,
            success: function(depositrecord){
                return callback(null,depositrecord);
            },error : function(err){
                return callback(err,null);
            }
      });
      //end of save operation code block
}

/*
@Description : Function to create Charity record
*/
function createCharity(params, callback){

      var Charity = Parse.Object.extend("Charity");
      var charity = new Charity();

      for(key in params){
            charity.set(key,params[key]);
      }

      charity.save(null, {
            useMasterKey: true,
            success: function(charityrecord){
                return callback(null,charityrecord);
            },error : function(err){
                return callback(err,null);
            }
      });
      //end of save operation code block
}

/*
@Description : Function to create Payout record
*/
function createPayout(params, callback){

      var Payout = Parse.Object.extend("Payout");
      var payout = new Payout();

      for(key in params){
            payout.set(key,params[key]);
      }

      payout.save(null, {
            useMasterKey: true,
            success: function(payoutrecord){
                return callback(null,payoutrecord);
            },error : function(err){
                return callback(err,null);
            }
      });
      //end of save operation code block
}

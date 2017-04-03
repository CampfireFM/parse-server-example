
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
                                                
                                                console.log("returned Error on capture!!");
                                                
                              return callback(err, null);
                        }else{
                              charge.set("statusCaptureCharge","success");
                              charge.set("responseStripeCapture",res_payment);
                              console.log("returned success on capture!!");
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

      console.log("split & make pmts started");
   
    
    var asker = question.get("fromUser");
    asker.fetch({
                        useMasterKey: true,
                        success: function(qAsker) {
                        
                        var answerer = question.get("fromUser");
                        answerer.fetch({
                                useMasterKey: true,
                                success: function(qAnswerer) {
                                       
                                       var theCharity = question.get("charity");
                                       theCharity.fetch({
                                                      useMasterKey: true,
                                                      success: function(charity) {
    
//    var charityId = question.get("charity").id;
//    var Charity = Parse.Object.extend("Charity");
//    var charity = Charity.createWithoutData(charityId);
                                       
//   var toUserId = question.get("toUser").id;
//   var ToUser = Parse.Object.extend("User");
//   var toUser = ToUser.createWithoutData(toUserId);
//   
//   var fromUserId = question.get("fromUser").id;
//   var FromUser = Parse.Object.extend("User");
//   var fromUser = FromUser.createWithoutData(toUserId);
    
    
                                                       var charity_percentage = question.get("charityPercentage") ? question.get("charityPercentage") : 0;
                                                       var price = question.get("price") ? question.get("price") : 0;
                                                       
                                                       var split_app = price * ( 20 / 100);
                                                       var split_charity = split_app * ( charity_percentage / 100);
                                                       var split_answerer = split_app - split_charity;
                    
                    
                                                       var toUser = qAnswerer;
                                                       var fromUser = qAsker;
                    
                                                       console.log(toUser);
                                                       console.log(fromUser);
                                                       
                                                       var payout_params = {
                                                       amount : split_answerer,
                                                       userRef : toUser,
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
                                                       userRef : fromUser,
                                                       questionRef : question
                                                       };
                                                       
                                                       createDeposit(deposit_params, function(e,r){
                                                                     console.log(e);
                                                                     console.log();
                                                                     });
                                                       
                                                       var donation_params = {
                                                       amount: split_charity,
                                                       charityRef: charity,
                                                       questionRef: question,
                                                       userRef : toUser,
                                                       isPaid: false
                                                       };
                                                       
                                                       createDonation(donation_params, function(e,r){
                                                                     console.log(e);
                                                                     console.log();
                                                                     });
                                                       
                                                       console.log("split & make pmts finished");
                                                       
                                                       var user_earning_increment = split_charity + split_answerer;
                                                       user.increment("totalEarnings", user_earning_increment);
                                                       user.save(null, {useMasterKey: true});
                                       

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
                },
                error: function(object, error) {
                console.log(error);
                throw "Got an error " + error.code + " : " + error.message;
                }
                });

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


function pointerTo(objectId, klass) {
    
    console.log(objectId)
    console.log(klass)
    
    return { __type:"Pointer", className:klass, objectId:objectId };
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
//                   console.log("deposit error");
                return callback(err,null);
            }
      });
      //end of save operation code block
}

/*
@Description : Function to create charitable Donation record
*/
function createDonation(params, callback){

      var Donation = Parse.Object.extend("Donation");
      var donation = new Donation();

      for(key in params){
            donation.set(key,params[key]);
      }

      donation.save(null, {
            useMasterKey: true,
            success: function(donationrecord){
                return callback(null,donationrecord);
            },error : function(err){
//                   console.log("charity error");
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
//                  console.log("payout error");
                return callback(err,null);
            }
      });
      //end of save operation code block
}

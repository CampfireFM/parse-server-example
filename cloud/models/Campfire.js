
var paymenthandler = require('../utils/paymenthandler.js');

//begin of afterSave
Parse.Cloud.afterSave("Campfire", function(request) {
      if (request.object.existed() == false) {

            var questionRef = request.object.get("questionRef");
            questionRef.fetch({
                  useMasterKey: true,
                  success: function(question) {
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
      @questionRef - instace of Question object
      @userRef - the user which represents Question Asker
      @
*/
function chargeUserAndSplitPayment(params, callback){

      paymenthandler.capturePayment(params.chargeID, params.question.id, function(err, payment){
            if(err){
                  //throw an exception here to let the Campfire team know of the charging failure
                  return callback(err, null);
            }else{

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
@Description : Function to update the Charge object after capturing the charge
*/
function updateCharge(params, callback){

}


function updateUserObject(params, callback){

}

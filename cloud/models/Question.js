const {checkPushSubscription} = require('../common');
var paymenthandler = require('../../utils/paymenthandler.js');

Parse.Cloud.afterSave("Question", function(request) {

    if (request.object.existed() == false) {

        var toUser = request.object.get("toUser");
        toUser.fetch({
                     useMasterKey: true,
                     success: function(user) {
                         var questCount = user.get("unansweredQuestionCount");
                         if (questCount == null) {
                            questCount = 0;
                         }
                         questCount++;
                         user.set("unansweredQuestionCount", questCount);
                         user.save(null, { useMasterKey: true });
                         var currentUser = request.user
                         var pushQuery = new Parse.Query(Parse.Installation);
                         pushQuery.equalTo('deviceType', 'ios');
                         pushQuery.equalTo('user', user);
                         var alert = "";
                         var firstName = currentUser.get('firstName');
                         var lastName = currentUser.get('lastName');
                         if (firstName) {
                         alert = firstName + " " + lastName + " asked you a question.";
                         }

                        var params = {
                            questionRef : request.object,
                            userRef : request.user,
                            amount : request.object.get("price"),
                            isExpired : false,
                            authToken : request.object.get("authToken"),
                            customerId : request.object.get("customerId"),
                            chargeId : request.object.get("chargeId")
                        };

                        if(!params.customerId){
                            params.customerId = request.user.get("customerId");
                            console.log("got customerId from request.user");
                        }

                        //call the stripe api and create the Charge Object
                        createCharge(params, function(err_charge, res_charge){
                            if(res_charge){

                                //Check for push subscription of question
                                if(!checkPushSubscription(toUser, 'questions')){
                                    console.log('Question asker has not subscribed to receive questions notification yet');
                                    return;
                                }
                                Parse.Push.send({
                                    where: pushQuery,
                                    data: {
                                      alert: alert,
                                      questionId: request.object.id
                                    }
                                    }, {
                                    useMasterKey: true,
                                     success: function() {
                                     // Push was successful
                                    },
                                    error: function(error) {
                                     throw "PUSH: Got an error " + error.code + " : " + error.message;
                                    }
                                });
                            }else{
                                //currently do nothing
                            }
                        });
                        //end of create charge function call handling

                        //removes the authToken from the question attributes
                        request.object.unset('chargeId');
                        request.object.save(null,{useMasterKey:true});
                     },
                     error: function(object, error) {
                        console.log(error);
                        throw "Got an error " + error.code + " : " + error.message;
                     }
                });
    }
});

/*
@Description - function to create a charge entry in Charge table
@params object contains the below fields:
    @questionRef - reference to the Question table object
    @userRef - the user on whose card the charge is going to be applied
    @amount - the amount to be charged on card
    @isExpired - this defaults to false
    @authToken - the stripe authorization token to charge the card
*/
function createCharge(params, callback){

    var question = params['questionRef'];
    var Charge = Parse.Object.extend("Charge");
    var charge = new Charge();
    for(key in params){
        charge.set(key,params[key]);
    }
    charge.set('status_createcharge','success');
    charge.set('isExpired',false);
    //update the charge with the charging status
    charge.save(null, {
        useMasterKey: true,
        success: function(chargerecord){
            return callback(null,chargerecord);
        },error : function(err){
            return callback(err,null);
        }
    });
    //end of save operation code block
}


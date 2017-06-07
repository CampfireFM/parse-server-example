const {checkEmailSubscription, sendPushOrSMS, addActivity} = require('../common');
const mail = require('../../utils/mail');
var paymenthandler = require('../../utils/paymenthandler.js');

Parse.Cloud.afterSave("Question", function(request) {

    if (request.object.existed() == false) {

        var toUser = request.object.get("toUser");
        toUser.fetch({
            useMasterKey: true,
            success: function(user) {
                //set isTest attribute according to isTestUser of fromUser/toUser
                const isTest = request.user.get('isTestUser') === true || toUser.get('isTestUser') === true;
                request.object.set('isTest', isTest);
                request.object.save(null, {useMasterKey : true});

                var questCount = user.get("unansweredQuestionCount");
                if (questCount == null) {
                    questCount = 0;
                }
                questCount++;
                user.set("unansweredQuestionCount", questCount);
                user.save(null, { useMasterKey: true });
                
                //Add question activity to Activity
                addActivity('question', request.user, user, request.object, null);
                
                var params = {
                    questionRef : request.object,
                    userRef : request.user,
                    matchesCount : request.object.get("price") / matchValue,
                    isExpired : false
                };

                if(request.object.get('price') == undefined || request.object.get('price') == 0){
                    sendPushOrSMS(request.user, toUser, 'questions');

                    //Check for email subscription of questions
                    if(!checkEmailSubscription(toUser, 'questions')) {
                        console.log('Question answerer has not subscribed to receive question emails yet')
                    } else {
                        mail.sendQuestionEmail(
                            toUser.get('email'),
                            request.object.id,
                            request.user.get('profilePhoto').url(),
                            toUser.get('firstName'),
                            request.object.get('text'),
                            request.object.get('price')
                        );
                    }
                } else {
                    //call the stripe api and create the Charge Object
                    createCharge(params, function (err_charge, res_charge) {
                        if (res_charge) {

                            //Send push notification to answerer
                            sendPushOrSMS(request.user, toUser, 'questions');

                            //Check for email subscription of questions
                            if (!checkEmailSubscription(toUser, 'questions')) {
                                console.log('Question answerer has not subscribed to receive question emails yet')
                            } else {
                                mail.sendQuestionEmail(
                                    toUser.get('email'),
                                    request.object.id,
                                    request.user.get('profilePhoto').url(),
                                    toUser.get('firstName'),
                                    request.object.get('text'),
                                    request.object.get('price')
                                );
                            }

                        } else {
                            //currently do nothing

                        }

                    });
                    //end of create charge function call handling
                }
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

/**
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
        charge.set(key, params[key]);
    }
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

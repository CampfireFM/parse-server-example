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
            },
            error: function(object, error) {
                console.log(error);
                throw "Got an error " + error.code + " : " + error.message;
            }
        });
    }
});

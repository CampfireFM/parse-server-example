const {checkEmailSubscription, sendPushOrSMS, addActivity} = require('../common');
const mail = require('../../utils/mail');
var paymenthandler = require('../../utils/paymenthandler.js');

Parse.Cloud.beforeSave('Question', function(request, response) {
    // Set isTest attribute according to isTestUser of fromUser/toUser
    const toUser = request.object.get('toUser');
    const fromUser = request.object.get('fromUser');
    toUser.fetch({useMasterKey: true}).then(toUser => {
        fromUser.fetch({useMasterKey: true}).then(fromUser => {
            const isTest = fromUser.get('isTestUser') === true || toUser.get('isTestUser') === true;
            request.object.set('isTest', request.object.get('isTest') || isTest);
            response.success();
        })
    }, err => {
        response.error(err);
    });
});

Parse.Cloud.afterSave("Question", function(request) {

    if (request.object.existed() == false) {

        var toUser = request.object.get("toUser");
        toUser.fetch({
            useMasterKey: true,
            success: function(user) {
                var fromUser = request.object.get('fromUser');
                fromUser.fetch({useMasterKey: true}).then(function(fromUser) {
                    var questCount = user.get("unansweredQuestionCount");
                    if (questCount == null) {
                        questCount = 0;
                    }
                    questCount++;
                    user.set("unansweredQuestionCount", questCount);
                    user.increment('askedQuestionCount', 1);
                    if (request.object.get('isAutoQuestion') === true)
                        user.set('lastActive', new Date());
                    user.save(null, { useMasterKey: true });

                    //Add question activity to Activity
                    addActivity('question', request.object.get('fromUser'), user, request.object, null);

                    sendPushOrSMS(fromUser, toUser, 'questions', questCount, request.object.id);

                    //Check for email subscription of questions
                    if(!checkEmailSubscription(toUser, 'questions')) {
                        console.log('Question answerer has not subscribed to receive question emails yet')
                    } else {
                        mail.sendQuestionEmail(
                            toUser.get('email'),
                            request.object.id,
                            fromUser.get('profilePhoto').url(),
                            toUser.get('firstName'),
                            request.object.get('text'),
                            request.object.get('price')
                        );
                    }
                }, function(error) {
                    console.log(error);
                    throw "Got an error " + error.code + " : " + error.message;
                });
            },
            error: function(object, error) {
                console.log(error);
                throw "Got an error " + error.code + " : " + error.message;
            }
        });
    }
});

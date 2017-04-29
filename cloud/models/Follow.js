const {checkEmailSubscription, sendPush, addActivity} = require('../common');
const mail = require('../../utils/mail');
Parse.Cloud.afterSave("Follow", function(request) {

    if (request.object.existed() == false) {

        var currentUser = request.user;
        var ToUser = request.object.get("toUser");
        ToUser.fetch({
            useMasterKey: true,
            success: function(toUser) {
                // Create and save a new "Follow" activity
                addActivity('follow', currentUser, toUser);

                //Send follows push notification to follow user
                sendPush(request.user, toUser, 'follows');

                //Send follows email to follow user
                if (!checkEmailSubscription(toUser, 'follows')) {
                    console.log('The user to follow has not subscribed to receive follow emails yet');
                } else {
                    mail.sendFollowEmail(toUser.get('email'), request.user.get('profilePhoto')._name, request.user.get('fullName'));
                }
            },
            error: function (object, error) {
                console.log(error);
                throw "Got an error " + error.code + " : " + error.message;
            }
        });
    }
});



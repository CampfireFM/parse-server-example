var Twilio = require('twilio');
const config = require('../config');
const logTexts = {
    questions : 'Question answerer has not subscribed to receive questions notification yet',
    expiringQuestions: 'Answerer has not subscribed to receive expiring questions notification yet',
    unlocks : 'Question asker/answerer has not subscribed to receive unlocks notification yet',
    answers : 'Question asker has not subscribed to receive answers sms yet',
    likes : 'Question ansker/answerer has not subscribed to receive likes notification yet',
    follows : 'The user has not subscribed to receive follows notification yet',
    earnings : 'The user has not subscribed to receive earnings notification yet'
};
const branch = require('node-branch-io');
const subscriptionTypes = ['questions', 'unlocks', 'answers', 'likes', 'follows', 'earnings'];
const campfireAutoPushTypes = ['friendMatch', 'joinCampfire', 'expiringQuestions'];

const activityTypes = ['follow', 'unlock', 'like', 'answer', 'question'];

function checkPushSubscription(user, type){
    var pushSubscriptions = user.get('pushSubscriptions');

    //Search subscription type in array
    if(pushSubscriptions == undefined || pushSubscriptions.indexOf(type) == -1)
        return false;
    return true;
}

function checkSMSSubscription(user, type){
    var smsSubscriptions = user.get('smsSubscriptions');

    //Search subscription type in array
    if(smsSubscriptions == undefined || smsSubscriptions.indexOf(type) == -1)
        return false;
    return true;
}
function checkEmailSubscription(user, type){
    var emailSubscriptions = user.get('emailSubscriptions');

    //Search subscription type in array
    if(emailSubscriptions == undefined || emailSubscriptions.indexOf(type) == -1)
        return false;
    return true;
}

/**
 * @Description This common function is used to send push notifications to toUsers with 'type'
 * @param currentUser - The user object in request where this is called
 * @param toUsers - The users who will receive push notification
 * @param type - subscription type of 'questions','answers','unlocks','likes','follows','earnings', campfire push notification of
 *               'friendMatch', 'joinCampfire'
 */
function sendPushOrSMS(currentUser, toUsers, type, additionalData){
    if(toUsers.length === undefined){
        toUsers = [toUsers];
    }

    if(type == undefined || type === ''){
        return;
    }

    toUsers.forEach(function(user){
        if (currentUser && (user.id == currentUser.id))
            return;
        if (subscriptionTypes.indexOf(type) !== -1) {
            if (!checkPushSubscription(user, type) && !checkSMSSubscription(user, type))
                return console.log(logTexts[type]);
        } else if(campfireAutoPushTypes.indexOf(type) === -1){
            return console.log('Unknown push type, no push notification sent');
        }
        // setup a push to the question Asker
        var pushQuery = new Parse.Query(Parse.Installation);
        pushQuery.equalTo('deviceType', 'ios');
        pushQuery.equalTo('user', user);

        //Compose alert text to be sent
        var alert = "";
        var badge = 0;
        var tag = "";
        const fullName = currentUser ? currentUser.get('fullName') : '';
        switch(type) {
            case 'questions' :
                alert = fullName + ' asked you a new question.';
                tag = 'question';
                badge = 1;
                break;
            case 'expiringQuestions' :
                if (additionalData > 1)
                    alert = `You have ${additionalData} questions expiring in the next 24 hours, hurry up!`;
                else
                    alert = `You have a question expiring in the next 24 hours, hurry up!`;
                break;
            case 'answers' :
                alert = fullName + ' answered your question on Campfire!';
                tag = 'answer';
                badge = 1;
                break;
            case 'unlocks' :
                alert = fullName + ' unlocked your question & answer.';
                break;
            case 'follows' :
                alert = fullName + ' just followed you.';
                break;
            case 'likes' :
                alert = fullName + ' just liked your question & answer'.;
                break;
            case 'earnings' :
                alert = 'You earned money!';
                break;
            case 'friendMatch' :
                alert = 'Your friend ' + fullName + ' is syncing you';
                break;
            case 'joinCampfire' :
                alert = 'Your friend ' + fullName + ' joined campfire! Go ask them a question.';
                break;
        }

        //Send push notification to ios devices
     
        if(checkPushSubscription(user, type) || (campfireAutoPushTypes.indexOf(type) > -1)) {
            
            var data = {
                alert: alert,
                tag: tag
            };

            if badge > 0 { data.badge = badge };

            Parse.Push.send({
                where: pushQuery,
                data
            }, {
                useMasterKey: true,
                success: function () {
                    // Push was successful
                },
                error: function (error) {
                    throw "PUSH: Got an error " + error.code + " : " + error.message;
                }
            });
        }
        if(checkSMSSubscription(user, type)) {
            // Twilio Credentials
            var accountSid = config.twilio.accountSid;
            var authToken = config.twilio.authToken;

            //require the Twilio module and create a REST client
            var client = Twilio(config.twilio.accountSid, config.twilio.authToken);

            if(user.get('phoneNumber') === undefined){
                console.log('User has not registerd phone number yet');
            } else {
                //Build deep link
                branch.link.create(config.branchKey, {
                    channel: '',
                    feature: '',
                    data: {
                        answerId: additionalData
                    }
                }).then(function(link) {
                    alert += `\n ${link.url}`;
                    client.messages.create({
                        to: user.get('phoneNumber'),
                        from: config.twilio.number,
                        body: alert
                    }, function (err, message) {
                        if (err)
                            console.log(err.message);
                        else
                            console.log(message.sid);
                    });
                }).catch(function(err){
                    console.log('Failed to create deep link for answer : ', err);
                    throw 'Got an error while looking for withdrawal object ' + err.code + ' : ' + err.message;
                })
            }
        }
    });
}

/**
 * @Description common function to add activities to Activity class
 * @param type - One of 'follow', 'unlock', 'like', 'answer', 'question'
 * @param question
 * @param answer
 * @param fromUser
 * @param toUsers
 */
function addActivity(type, fromUser, toUsers, question, answer){

    if(activityTypes.indexOf(type) === -1){
        return console.log("Unknown action");
    }

    if(toUsers.length === undefined)
        toUsers = [toUsers];
    var Activity = Parse.Object.extend('Activity');

    var newActivity = new Activity();
    newActivity.set('isRead', false);
    newActivity.set('toUsers', toUsers);
    newActivity.set('fromUser', fromUser);
    newActivity.set('type', type);
    if(type !== 'follow'){
        newActivity.set('question', question);
        newActivity.set('answer', answer);
    }
    newActivity.save(null, {useMasterKey: true});
}

/**
 * @Description Convert question parse object to algolia object
 * @param questions
 */
function questionsToAlgoliaObjects(questions){
    if(questions.length == undefined)
        questions = [questions];
    var algoliaObjects = questions.map(function(question){
        var object = question.toJSON();
        object.objectID = question.id;

        return object;
    });
    return algoliaObjects;
}
module.exports = {checkPushSubscription, checkEmailSubscription, sendPushOrSMS, addActivity, questionsToAlgoliaObjects};
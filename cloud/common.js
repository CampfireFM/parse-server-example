
const logTexts = {
    questions : 'Question answerer has not subscribed to receive questions notification yet',
    unlocks : 'Question asker/answerer has not subscribed to receive unlocks notification yet',
    answers : 'Question asker has not subscribed to receive questions notification yet',
    likes : 'Question ansker/answerer has not subscribed to receive likes notification yet',
    follows : 'The user has not subscribed to receive follows notification yet',
    earnings : 'The user has not subscribed to receive earnings notification yet'
};

const subscriptionTypes = ['questions', 'unlocks', 'answers', 'likes', 'follows', 'earnings'];
const campfireAutoPushTypes = ['friendMatch', 'joinCampfire'];

function checkPushSubscription(user, type){
    var pushSubscriptions = user.get('pushSubscriptions');

    //Search subscription type in array
    if(pushSubscriptions == undefined || pushSubscriptions.indexOf(type) == -1)
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
function sendPush(currentUser, toUsers, type){
    if(toUsers.length === undefined){
        toUsers = [toUsers];
    }

    if(type == undefined || type === ''){
        return;
    }

    toUsers.forEach(function(user){

        if (subscriptionTypes.indexOf(type) !== -1) {
            if (!checkPushSubscription(user, type))
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
        const fullName = currentUser ? currentUser.get('fullName') : '';
        switch(type) {
            case 'questions' :
                alert = fullName + ' asked you a new question';
                break;
            case 'answers' :
                alert = fullName + ' answered to your question';
                break;
            case 'unlocks' :
                alert = fullName + ' unlocked your answer/question';
                break;
            case 'follows' :
                alert = fullName + ' just followed you';
                break;
            case 'likes' :
                alert = fullName + ' just liked your answer/question';
                break;
            case 'earnings' :
                alert = 'You earned money';
                break;
            case 'friendMatch' :
                alert = 'Your friend ' + fullName + ' is syncing you';
                break;
            case 'joinCampfire' :
                alert = 'Your friend ' + fullName + ' joined campfire, you can ask whatever interested';
                break;
        }

        Parse.Push.send({
            where: pushQuery,
            data: {
                alert: alert
            }
        }, {
            useMasterKey: true,
            success: function () {
                // Push was successful
            },
            error: function (error) {
                throw "PUSH: Got an error " + error.code + " : " + error.message;
            }
        });
    });
}

module.exports = {checkPushSubscription, checkEmailSubscription, sendPush};
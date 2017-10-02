const Twilio = require('twilio');
const config = require('../config');
const redisClient = require('./redis');
const Promise = require('promise');
const request = require('superagent');
const Mixpanel = require('mixpanel');
const logTexts = {
    questions : 'Question answerer has not subscribed to receive questions notification yet',
    expiringQuestions: 'Answerer has not subscribed to receive expiring questions notification yet',
    unlocks : 'Question asker/answerer has not subscribed to receive unlocks notification yet',
    answers : 'Question asker has not subscribed to receive answers notification/sms yet',
    likes : 'Question ansker/answerer has not subscribed to receive likes notification yet',
    follows : 'The user has not subscribed to receive follows notification yet',
    earnings : 'The user has not subscribed to receive earnings notification yet'
};
const branch = require('node-branch-io');
const subscriptionTypes = ['questions', 'unlocks', 'answers', 'likes', 'follows', 'earnings'];
const campfireAutoPushTypes = ['friendMatch', 'joinCampfire', 'expiringQuestions', 'answerToFollowers'];

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
 *               'friendMatch', 'joinCampfire', 'answerToFollowers'
 */
function sendPushOrSMS(currentUser, toUsers, type, additionalData, additionalId){
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
        var tag;
        var objectId;
        const fullName = currentUser ? currentUser.get('fullName') : '';
        switch(type) {
            case 'questions' :
                alert = fullName + ' asked you a new question.';
                badge = additionalData;
                objectId = additionalId;
                tag = 'question';
                break;
            case 'expiringQuestions' :
                if (additionalData > 1)
                    alert = `You have ${additionalData} questions expiring in the next 24 hours, hurry up!`;
                else
                    alert = `You have a question expiring in the next 24 hours, hurry up!`;
                break;
            case 'answers' :
                alert = fullName + ' answered your question on Campfire!';
                badge = user.get('unansweredQuestionCount') || 0;
                tag = 'answer';
                objectId = additionalId;
                break;
            case 'answerToFollowers':
                alert = fullName + ' answered ' + additionalData + '\'s question on Campfire!';
                //badge = user.get('unansweredQuestionCount') || 0;
                tag = 'answer';
                objectId = additionalId;
                break;
            case 'unlocks' :
                alert = fullName + ' unlocked your question & answer.';
                break;
            case 'follows' :
                alert = fullName + ' just followed you.';
                break;
            case 'likes' :
                alert = fullName + ' just liked your question & answer.';
                break;
            case 'earnings' :
                alert = 'You earned money!';
                break;
            case 'friendMatch' :
                alert = 'Your friend ' + fullName + ' is syncing you.';
                break;
            case 'joinCampfire' :
                alert = 'Your friend ' + fullName + ' joined campfire! Go ask them a question.';
                break;
        }

        //Send push notification to ios devices
        if(checkPushSubscription(user, type) || (campfireAutoPushTypes.indexOf(type) > -1)) {
            
            var data = {
                alert: alert
            }

            if (badge > 0)
                data.badge = badge

            if (tag)
                data.tag = tag;

            if (objectId)
                data.objectId = objectId;
            
            Parse.Push.send({
                where: pushQuery,
                data: data
                // data: {
                //     alert: alert,
                //     tag: tag, 
                //     badge: badge
                // }
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
    // Remove fromUser from toUsers
    const filteredToUsers = [];
    toUsers.forEach(user => {
        if (user.id != fromUser.id)
            filteredToUsers.push(user);
    });
    var newActivity = new Activity();
    newActivity.set('isRead', false);
    newActivity.set('toUsers', filteredToUsers);
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
function parseToAlgoliaObjects(objects){
    if(objects.length == undefined)
        objects = [objects];
    var algoliaObjects = objects.map(function(obj){
        var object = obj.toJSON();
        object.objectID = obj.id;
        object.createdTimestamp = obj.get('createdAt').getTime();
        return object;
    });
    return algoliaObjects;
}

//function getShareImageAndExistence(user, charity) {
//    return new Promise((resolve, reject) => {
//        const ShareImage = Parse.Object.extend('ShareImage');
//        const query = new Parse.Query(ShareImage);
//        query.equalTo('userRef', user);
//        query.equalTo('charityRef', charity);
//        query.include(['charityRef', 'userRef']);
//        query.first({useMasterKey: true}).then(function(shareImage) {
//            if (!shareImage) {
//                return resolve({isExisting: false});
//            }
//            const charityImageName = (shareImage.get('charityRef') && shareImage.get('charityRef').get('image').name());
//            const profilePhotoName = (user.get('profilePhoto') && user.get('profilePhoto').name());
//            if (charityImageName === shareImage.get('charityImageName') && profilePhotoName === shareImage.get('profilePhotoName'))
//                return resolve({isExisting: true, shareImage});
//            return resolve({isExisting: false, shareImage});
//        }, function(err) {
//            reject(err);
//        });
//    });
//}

function getShareImageAndExistence(user, charity) {
    return new Promise((resolve, reject) => {
        const ShareImage = Parse.Object.extend('ShareImage');
        const query = new Parse.Query(ShareImage);
        query.equalTo('userRef', user);
        query.equalTo('charityRef', charity);
        query.include(['charityRef', 'userRef']);
        query.first({useMasterKey: true}).then(function(shareImage) {
            const charityImageName = (charity && charity.get('image').name());
            const profilePhotoName = (user.get('profilePhoto') && user.get('profilePhoto').name());
            if (!shareImage) {
                const shareImage = new ShareImage();
                shareImage.set('userRef', user);
                shareImage.set('charityRef', charity);
                shareImage.set('profilePhotoName', profilePhotoName);
                shareImage.set('charityImageName', charityImageName);
                shareImage.save().then(function(shareImage) {
                    resolve({isExisting: false, shareImage})
                }, function(err) {
                    reject(err);
                });
            } else if (charityImageName === shareImage.get('charityImageName') && profilePhotoName === shareImage.get('profilePhotoName')) {
                return resolve({isExisting: true, shareImage});
            } else {
                if (charityImageName)
                    shareImage.set('charityImageName', charityImageName);
                if (profilePhotoName)
                    shareImage.set('profilePhotoName', profilePhotoName);
                shareImage.save().then(function(shareImage) {
                    resolve({isExisting: false, shareImage});
                }, function(err) {
                    reject(err);
                });
            }
        }, function(err) {
            reject(err);
        });
    });
}

function generateShareImage(userId) {
    const userQuery = new Parse.Query(Parse.User);
    userQuery.include(['charityRef']);
    userQuery.get(userId, {useMasterKey: true}).then(function (user) {
        const charity = user.get('charityRef');
        getShareImageAndExistence(user, charity)
            .then(({isExisting, shareImage}) => {
                if (isExisting)
                    return console.log('Skipping duplicated image generation');
                request.post(config.imageGeneratorUrl + '/user')
                    .set('Content-Type', 'application/json')
                    .set('Accept', 'application/json')
                    .send({userId})
                    .end((err, res) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log(res.body);
                        }
                    });
            })
            .catch(err => {
                console.log(err);
            })
    }, err => {
        console.log(err);
    });
}

function generateAnswerShareImage(answerId) {
    request.post(config.imageGeneratorUrl + '/answer')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send({answerId})
        .end((err, res) => {
            if (err) {
                console.log(err);
            } else {
                console.log(res.body);
            }
        });
}

function getAllUsers(noFilter) {
    return new Promise((resolve, reject) => {
        var result = [];
        var chunk_size = 1000;
        var processCallback = function(res) {
            result = result.concat(res);
            if (res.length === chunk_size) {
                process(res[res.length-1].id);
            } else {
                resolve(result);
            }
        };
        var process = function(skip) {
            var query = new Parse.Query(Parse.User);
            if (skip) {
                query.greaterThan("objectId", skip);
            }
            //query.select(['profilePhoto', 'charityRef']);
            query.include(['charityRef']);
            if (!noFilter) {
                query.notEqualTo('isTestUser', true);
                query.notEqualTo('lastName', 'Test');
                query.notEqualTo('firstName', 'Test');
            }
            query.limit(chunk_size);
            query.ascending("objectId");
            query.find({useMasterKey: true}).then(function (res) {
                processCallback(res);
            }, function (error) {
                reject(error);
            });
        };
        process(false);
    })
}

function getAllAnswers() {
    return new Promise((resolve, reject) => {
        var result = [];
        var chunk_size = 1000;
        var processCallback = function(res) {
            result = result.concat(res);
            if (res.length === chunk_size) {
                process(res[res.length-1].id);
            } else {
                resolve(result);
            }
        };
        var process = function(skip) {
            const Answer = Parse.Object.extend('Answer');
            var query = new Parse.Query(Answer);
            if (skip) {
                query.greaterThan("objectId", skip);
            }
            query.select(['objectId', 'image']);
            query.limit(chunk_size);
            query.ascending("objectId");
            query.find({useMasterKey: true}).then(function (res) {
                processCallback(res);
            }, function (error) {
                reject(err);
            });
        };
        process(false);
    })
}

function getFollowers(user){
    return new Promise((resolve, reject) => {
        var Follow = Parse.Object.extend('Follow');
        var followQuery = new Parse.Query(Follow);
        followQuery.include('fromUser');
        followQuery.equalTo('toUser', user);
        followQuery.find({useMasterKey : true}).then(function(follows){
            resolve(follows);
        }, function(err){
            reject(err);
        });
    });
}

function getFollows(user){
    return new Promise((resolve, reject) => {
        if (!user)
            return resolve([]);
        var Follow = Parse.Object.extend('Follow');
        var followQuery = new Parse.Query(Follow);
        followQuery.include('toUser');
        followQuery.equalTo('fromUser', user);
        followQuery.find({useMasterKey : true}).then(function(follows){
            resolve(follows);
        }, function(err){
            reject(err);
        });
    })
}

function trackEvent(user, type, params) {
    const userId = user.get('username');
    const mixpanel = Mixpanel.init(config.mixpanelToken);
    
    switch(type) {
        case 'PAYOUT':
            mixpanel.track('Payout', {
                distinct_id: userId,
                'First Name': user.get('firstName'),
                'Last Name': user.get('lastName'),
                'Amount': params.amount,
                'Source': params.type[0].toUpperCase() + params.type.substr(2),
                'QuestionId': params.questionRef ? params.questionRef.id : '',
                'UnlockRef': params.unlockRef ? params.unlockRef.id : ''
            });
            mixpanel.people.increment(userId, {Payout: params.amount});
            break;
        case 'DONATION':
            mixpanel.track('Donation', {
                distinct_id: userId,
                'First Name': user.get('firstName'),
                'Last Name': user.get('lastName'),
                'Amount': params.amount,
                'QuestionId': params.questionRef ? params.questionRef.id : '',
                'CharityId': params.charityRef ? params.charityRef.id : ''
            });
            mixpanel.people.increment(userId, {Donation: params.amount});
            break;
        default:
            break;
    }
}

const resetTop20CloutPoints = () => {
    return new Promise((resolve, reject) => {
        redisClient.del('top20CloutPoints');
        redisClient.del('top20AnswerIds');
        const Answer = Parse.Object.extend('Answer');
        const query = new Parse.Query(Answer);
        query.notEqualTo('isTest', true);
        query.notEqualTo('isDummyData', true);
        query.lessThanOrEqualTo('liveDate', new Date());
        query.descending('cloutPoints');
        query.limit(20);
        query.select(['objectId', 'cloutPoints'])
        query.find({useMasterKey: true})
            .then(answers => {
                const multi = redisClient.multi();
                for (let i = answers.length - 1; i >= 0; i--) {
                    const answer = answers[i];
                    multi.lpush('top20CloutPoints', answer.get('cloutPoints'));
                    multi.lpush('top20AnswerIds', answer.id);
                }
                multi.ltrim('top20CloutPoints', 0, answers.length - 1);
                multi.ltrim('top20AnswerIds', 0, answers.length - 1);
                multi.exec((err, res) => {
                    if (err) {
                        console.log(err);
                        resolve(answers.map(answer => ({
                            cloutPoints: answer.get('cloutPoints'),
                            id: answer.id
                        })));
                    } else {
                        console.log(res);
                        resolve(answers.map(answer => ({
                            cloutPoints: answer.get('cloutPoints'),
                            id: answer.id
                        })));
                    }
                });
            }, err => {
                console.log(err);
                reject(err);
            })
    })

}
module.exports = {resetTop20CloutPoints, trackEvent, getFollowers, getFollows, checkPushSubscription, checkEmailSubscription, sendPushOrSMS, addActivity, parseToAlgoliaObjects, generateShareImage, getShareImageAndExistence, getAllUsers, generateAnswerShareImage, getAllAnswers};
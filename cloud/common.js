const Twilio = require('twilio');
const config = require('../config');
const redisClient = require('./redis');
const Promise = require('promise');
const request = require('superagent');
const Mixpanel = require('mixpanel');
const mustache = require('mustache');
var algoliasearch = require('./algolia/algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);
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
//const campfireAutoPushTypes = ['friendMatch', 'joinCampfire', 'expiringQuestions', 'answerToFollowers'];
const campfireAutoPushTypes = ['friendMatch', 'joinCampfire', 'expiringQuestions', 'matchesReward'];

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

    // Extract push notification texts
    const PushNotificationText = Parse.Object.extend('PushNotificationText');
    const pushNotificationTextQuery = new Parse.Query(PushNotificationText);
    pushNotificationTextQuery.find({useMasterKey: true})
        .then(pushNotificationTexts => {
            toUsers.forEach(function(user){
                //Send push notification to ios devices
                if(checkPushSubscription(user, type) || (campfireAutoPushTypes.indexOf(type) > -1)) {
                    // Self exception
                    if (currentUser && (user.id == currentUser.id) && ['matchesReward'].indexOf(type) === -1)
                        return;
                    if (subscriptionTypes.indexOf(type) !== -1) {
                        if (!checkPushSubscription(user, type) && !checkSMSSubscription(user, type))
                            return console.log(logTexts[type]);
                    } else if(campfireAutoPushTypes.indexOf(type) === -1){
                        return console.log('Unknown push type, no push notification sent');
                    }
                    // Get badge count
                    const Question = Parse.Object.extend('Question');
                    const questionQuery = new Parse.Query(Question);
                    questionQuery.equalTo('isAnswered', false);
                    questionQuery.notEqualTo('isIgnored', true);
                    questionQuery.equalTo('isExpired', false);
                    questionQuery.equalTo('toUser', user);
                    questionQuery.count({useMasterKey: true}).then(count => {
                        // setup a push to the question Asker
                        var pushQuery = new Parse.Query(Parse.Installation);
                        pushQuery.equalTo('deviceType', 'ios');
                        pushQuery.equalTo('user', user);

                        var badge = 0;
                        var tag;
                        var objectId;
                        const fullName = currentUser ? currentUser.get('fullName') : '';
                        const context = {
                            fullName,
                            askerFullName: additionalData
                        };
                        const templates = [];
                        pushNotificationTexts.forEach(pushNotificationText => {
                            if (pushNotificationText.get('type') === type)
                                templates.push(pushNotificationText.get('text'));
                        });
                        console.log(templates);
                        if (templates.length === 0)
                            return;
                        const randIndex = Math.min(templates.length - 1, Math.floor(Math.random() * templates.length));
                        let template;
                        try {
                            template = templates[randIndex];
                        } catch(err) {
                            console.log(err);
                            template = '';
                        }
                        console.log(template);
                        //Compose alert text to be sent
                        const alert = mustache.render(template, context);
                        switch(type) {
                            case 'questions' :
                                //alert = fullName + ' asked you a new question.';
                                badge = count;
                                objectId = additionalId;
                                tag = 'question';
                                break;
                            case 'answers' :
                                //alert = fullName + ' answered your question on Campfire!';
                                badge = count;
                                tag = 'answer';
                                objectId = additionalId;
                                break;
                            case 'answerToFollowers':
                                //alert = fullName + ' answered ' + additionalData + '\'s question on Campfire!';
                                //badge = user.get('unansweredQuestionCount') || 0;
                                tag = 'answer';
                                objectId = additionalId;
                                break;
                            case 'unlocks' :
                                //alert = fullName + ' unlocked your question & answer.';
                                break;
                            case 'follows' :
                                //alert = fullName + ' just followed you.';
                                break;
                            case 'likes' :
                                //alert = fullName + ' just liked your question & answer.';
                                break;
                            case 'earnings' :
                                //alert = 'You earned money!';
                                break;
                            case 'friendMatch' :
                                //alert = 'Your friend ' + fullName + ' is syncing you.';
                                break;
                            case 'matchesReward':
                                tag = 'matchesReward';
                                break;
                            //case 'joinCampfire' :
                            //    alert = 'Your friend ' + fullName + ' joined campfire! Go ask them a question.';
                            //    break;
                        }

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
                    }, err => {
                        console.log(err);
                    })
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
        }, err => {
            console.log(err);
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


function resetFeaturedAnswers() {
    return new Promise((resolve, reject) => {
        const Answer = Parse.Object.extend('Answer');

        const answerQuery = new Parse.Query(Answer);
        const date = new Date();
        answerQuery.lessThanOrEqualTo('liveDate', date);
        answerQuery.select(['objectId', 'cloutPoints', 'questionAsker']);
        answerQuery.descending('cloutPoints');
        answerQuery.limit(6);
        let featuredAnswers = [];
        let featuredAnswerUserLastPositions = {};
        let featuredAnswerPositions = [];

        const minimumStep = 5;
        let currentPosition = 0;
        let answerIndex;
        const start = new Date();
        console.log('starting');
        const indexName = config.algolia.answerIndex;
        const index = client.initIndex(indexName);
        const start2 = new Date();
        index.search({
            offset : 0,
            length : 1000,
            attributesToRetrieve: [
                "cloutPoints",
                "userRef.objectId"
            ]
        }, function(err, results){
            if(err){
                console.log(err);
            }
            let answers = results.hits;
            const start1 = new Date();
            try {
                for (let i = 0; i < answers.length; i++) {
                    featuredAnswerPositions.push(false);
                }
                for (let i = 0; i < answers.length; i++) {
                    let answerIndex = -1;
                    // Get first answer which is not added to featured
                    for (let j = 0; j < featuredAnswerPositions.length; j++) {
                        if (!featuredAnswerPositions[j]) {
                            let lastPosition = -minimumStep;
                            if (!answers[j].userRef)
                                lastPosition = -minimumStep;
                            else
                                lastPosition = featuredAnswerUserLastPositions[answers[j].userRef.objectId] || -minimumStep;
                            if (currentPosition - lastPosition >= minimumStep) {
                                answerIndex = j;
                                break;
                            }
                        }
                    }
                    if (answerIndex == -1) {
                        for (let j = 0; j < featuredAnswerPositions.length; j++) {
                            if (!featuredAnswerPositions[j]) {
                                answerIndex = j;
                                break;
                            }
                        }
                    }
                    // Add answer to featured
                    featuredAnswers.push(answers[answerIndex].objectID);
                    if (answers[answerIndex].userRef && answers[answerIndex].userRef.objectId)
                        featuredAnswerUserLastPositions[answers[answerIndex].userRef.objectId] = currentPosition;
                    featuredAnswerPositions[answerIndex] = true;
                    currentPosition++;
                    if (currentPosition === answers.length) {
                        // Finalize answers
                        console.log(featuredAnswers);
                        const multi = redisClient.multi();
                        multi.del('featuredAnswers');
                        featuredAnswers.forEach(answer => {
                            multi.rpush('featuredAnswers', answer);
                        });
                        multi.exec((err, res) => {
                            if (err) {
                                console.log(err);
                                reject(err);
                            }
                            console.log(res);
                            resolve(res);
                        });
                    }
                }
            } catch(err) {
                console.log(err);
                reject(err);
            }
            const end = new Date();
            console.log('Duration: ', end.getTime() - start2.getTime(), "Sort Duration: ", end.getTime() - start1.getTime());
        });
    });

    //answerQuery.find({useMasterKey: true}).then(answers => {
    //    const start1 = new Date();
    //    try {
    //        for (let i = 0; i < answers.length; i++) {
    //            featuredAnswerPositions.push(false);
    //        }
    //        for (let i = 0; i < answers.length; i++) {
    //            let answerIndex = -1;
    //            // Get first answer which is not added to featured
    //            for (let j = 0; j < featuredAnswerPositions.length; j++) {
    //                if (!featuredAnswerPositions[j]) {
    //                    let lastPosition = -minimumStep;
    //                    if (!answers[j].get('questionAsker'))
    //                        lastPosition = -minimumStep;
    //                    else
    //                        lastPosition = featuredAnswerUserLastPositions[answers[j].get('questionAsker').id] || -minimumStep;
    //                    if (currentPosition - lastPosition >= minimumStep) {
    //                        answerIndex = j;
    //                        break;
    //                    }
    //                }
    //            }
    //            if (answerIndex == -1) {
    //                for (let j = 0; j < featuredAnswerPositions.length; j++) {
    //                    if (!featuredAnswerPositions[j]) {
    //                        answerIndex = j;
    //                        break;
    //                    }
    //                }
    //            }
    //            // Add answer to featured
    //            featuredAnswers.push(answers[answerIndex].id);
    //            if (answers[answerIndex].get('questionAsker') && answers[answerIndex].get('questionAsker').id)
    //                featuredAnswerUserLastPositions[answers[answerIndex].get('questionAsker').id] = currentPosition;
    //            featuredAnswerPositions[answerIndex] = true;
    //            currentPosition++;
    //            if (currentPosition === answers.length) {
    //                // Finalize answers
    //                console.log(featuredAnswers);
    //            }
    //        }
    //    } catch(err) {
    //        console.log(err);
    //    }
    //    const end = new Date();
    //    console.log('Duration: ', end.getTime() - start.getTime(), "Sort Duration: ", end.getTime() - start1.getTime());
    //})
}
module.exports = {resetFeaturedAnswers, resetTop20CloutPoints, trackEvent, getFollowers, getFollows, checkPushSubscription, checkEmailSubscription, sendPushOrSMS, addActivity, parseToAlgoliaObjects, generateShareImage, getShareImageAndExistence, getAllUsers, generateAnswerShareImage, getAllAnswers};
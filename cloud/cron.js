const CronJob = require('cron').CronJob;
const { sendPushOrSMS, getAllUsers, sendSummaryEmail, checkEmailSubscription, getFollows } = require('./common');
const Promise = require('promise');
const wrapper = require('co-express');
const { sendAdminSummaryEmail } = require('../utils/mail');
var job = new CronJob({
    cronTime: '00 00 05 * * *',
    onTick: runCron,
    start: false,
    timeZone: 'America/Los_Angeles'
});
var qotdJob = new CronJob({
    cronTime: '00 00 12 * * *',
    onTick: sendQOTDLivePushNotification,
    start: false,
    timeZone: 'America/New_York'
});

if (process.env.RUN_CRON === 'true') {
    job.start();
    qotdJob.start();
}

const admins = ['krittylor@gmail.com', 'ericwebb85@yahoo.com', 'luke@lukevink.com', 'christos@campfire.fm', 'nick@campfire.fm'];

function runCron() {
    sendStatisticsEmail();
    notifyExpiringQuestions();
    runSummaryUpdate();
    //sendQOTDLivePushNotification();
}

function sendStatisticsEmail() {
    console.log('Sending statistics to admin users!');
    wrapper(function*() {
        try {
            const usersCount = yield getLast24('User', true);
            const questionsCount = yield getLast24('Question', true);
            const answersCount = yield getLast24('Answer', true);
            const unlocksCount = yield getLast24('CampfireUnlock', true);
            const purchases = yield getLast24('ProductPurchase', false, 'productRef', 'userRef');
            const purchasesCount = purchases.length;
            const payouts = yield getLast24('Payout', false);
            const payoutsCount = payouts.length;
            const donations = yield getLast24('Donation', false);

            let earningsByAnswer = 0;
            let earningsByUnlock = 0;
            let earningsByPurchase = 0;
            let totalDonationAmount = 0;
            // Calculate amount of money earned in 24 hours by answer and eavesdrop
            if (payoutsCount > 0) {
                payouts.forEach(function(payout) {
                    const amount = payout.get('amount');
                    switch (payout.get('type')) {
                        case 'answer':
                            earningsByAnswer += amount;
                            break;
                        case 'unlockAnswerer':
                            earningsByUnlock += amount;
                            break;
                        case 'unlockAsker':
                            earningsByUnlock += amount;
                            break;
                        default:
                            break;
                    }
                });
            }

            // Calculate amount of money earnings in 24 hours by product purchase
            if (purchasesCount > 0) {
                purchases.forEach(function(purchase) {
                    earningsByPurchase += purchase.get('productRef').get('cost');
                });
            }

            // Calculate total amount of donations in 24 hours
            if (donations.length > 0) {
                donations.forEach(function(donation) {
                    totalDonationAmount += donation.get('amount');
                });
            }

            // Round earnings
            earningsByAnswer = Math.floor( earningsByAnswer * Math.pow(10, 2) ) / Math.pow(10, 2);
            earningsByUnlock = Math.floor( earningsByUnlock * Math.pow(10, 2) ) / Math.pow(10, 2);
            earningsByPurchase = Math.floor( earningsByPurchase * Math.pow(10, 2) ) / Math.pow(10, 2);
            totalDonationAmount = Math.floor( totalDonationAmount * Math.pow(10, 2) ) / Math.pow(10, 2);

            // Send summary email to admins
            admins.forEach(function(admin) {
                sendAdminSummaryEmail(admin, {
                    usersCount,
                    questionsCount,
                    answersCount,
                    unlocksCount,
                    payoutsCount,
                    purchasesCount,
                    earningsByAnswer,
                    earningsByUnlock,
                    earningsByPurchase,
                    totalDonationAmount
                });
            });
        } catch(err) {
            console.trace(err);
        }
    })();
}

function getLast24(className, onlyCount, includes) {
    return new Promise((resolve, reject) => {
        const classObject = Parse.Object.extend(className);
        const query = new Parse.Query(classObject);
        const date = new Date();
        date.setDate(date.getDate() - 1);
        query.greaterThan('createdAt', date);
        // Include attributes to be extracted
        if (includes) {
            query.include(includes);
        }
        if (onlyCount) {
            query.count({useMasterKey: true}).then(function(count) {
                resolve(count);
            }, function(err) {
                reject(err);
            });
        } else {
            query.find({useMasterKey: true}).then(function(objects) {
                resolve(objects);
            }, function(err) {
                reject(err);
            })
        }

    });
}

function getExpiringQuestionsCount(user) {
    return new Promise((resolve, reject) => {
        const Question = Parse.Object.extend('Question');
        const query = new Parse.Query(Question);
        const start = new Date();
        const end = new Date();
        start.setDate(start.getDate() - 3);
        end.setDate(end.getDate() - 2);
        query.notEqualTo('isAnswered', true);
        query.greaterThanOrEqualTo('createdAt', start);
        query.lessThanOrEqualTo('createdAt', end);
        query.equalTo('isAnswered', false);
        query.equalTo('toUser', user);
        query.count({useMasterKey: true}).then(function(count) {
            resolve(count);
        }, function(err) {
            reject(err);
        });
    });
}

function notifyExpiringQuestions() {
    const query = new Parse.Query(Parse.User);
    query.greaterThan('unansweredQuestionCount', 0);
    query.notEqualTo('isTest', true);

    query.find({useMasterKey: true}).then(function(users) {
        if (users.length > 0) {
            users.forEach(function(user) {
                getExpiringQuestionsCount(user)
                    .then(count => {
                        if (count > 0) {
                            sendPushOrSMS(null, user, 'expiringQuestions', count);
                        }
                    })
                    .catch(err => {
                        console.log(err);
                    });
            })
        }
    }, function(err) {
        console.log(err);
    });
}

function runSummaryUpdate(){
    console.log('Sending Summary emails..........');
    getAllUsers()
        .then(users => {
            users.forEach(user => {
                //Cancel getting summary if user has not subscribed to receive summary email
                if (checkEmailSubscription(user, 'summary') == false)
                    return;
                getFollows(user)
                    .then(follows => {
                        if (follows.length == 0)
                            return;
                        follows = follows.reduce(function (pre, follow) {
                            pre.push(follow.get('toUser'));
                            return pre;
                        }, []);
                        getRecentAnswers(follows, function (err, answers) {
                            if (err) {
                                console.log(err.message);
                                return;
                            }
                            if (answers.length == 0)
                                return;
                            const moreAnswersCount = answers.length > 5 ? answers.length - 5 : 0;
                            answers = answers.slice(0, 5);

                            var summaries = answers.reduce(function (pre, answer) {
                                //Get userId from answer
                                pre.push({
                                    answerId: answer.id,
                                    questionId: answer.get('questionRef').id,
                                    question: answer.get('questionRef').get('text'),
                                    userName: answer.get('userRef').get('fullName'),
                                    profilePhoto: answer.get('userRef').get('profilePhoto').url()
                                });
                                return pre;
                            }, []);

                            console.log("SummaryMap : ", summaries);
                            //Generate email with template

                            //send to test email in development
                            // var testEmail = process.env.TEST_EMAIL ? process.env.TEST_EMAIL : 'krittylor@gmail.com';
                            if (process.env.SEND_SUMMARY == 'production')
                                sendSummaryEmail(user.get('email'), summaries, moreAnswersCount);
                            // else
                            //     sendSummaryEmail('ericwebb85@yahoo.com', summaries, moreAnswersCount);
                        });
                    })
                    .catch(err => {
                        console.log(err.message);
                    })
            });
        })
        .catch(err => {
            console.log(err);
        });
}

function getRecentAnswers(users, callback){
    var Answer = Parse.Object.extend('Answer');
    var answerQuery = new Parse.Query(Answer);
    var date = new Date();
    date.setDate(date.getDate() - 1);
    answerQuery.include('userRef', 'questionRef', 'createdAt');
    answerQuery.greaterThan('updatedAt', date);
    answerQuery.containedIn('userRef', users);
    answerQuery.descending('createdAt');
    answerQuery.find({useMasterKey : true}).then(function(answers){
        if(answers[0])
            callback(null, answers);
        else
            callback(null, []);
    }, function(err){
        callback(err);
    })
}

function sendQOTDLivePushNotification() {
    const List = Parse.Object.extend('List');
    const query = new Parse.Query(List);
    query.equalTo('type', 'qotd');
    const currentTime = new Date();
    currentTime.setMinutes(0);
    currentTime.setMilliseconds(0);
    currentTime.setSeconds(0);
    const timestamp = currentTime.getTime();
    query.find({useMasterKey: true}).then(function(lists) {
        console.log(lists.length);
        lists.forEach(list => {
            console.log(list);
            console.log(list.get('liveDate'), list.get('liveDate').getTime(), new Date(timestamp));
            if (list.get('liveDate').getTime() >= (timestamp - 60 * 1000 * 24 * 60) && list.get('liveDate').getTime() <= timestamp) {
                const pushQuery = new Parse.Query(Parse.Installation);
                pushQuery.equalTo('deviceType', 'ios');
                //const userQuery = new Parse.Query(Parse.User);
                //userQuery.equalTo('objectId', 'SSJQ8mW13x');
                //pushQuery.matchesQuery('user', userQuery);
                Parse.Push.send({
                    where: pushQuery,
                    data: {
                        alert: 'Question for you! ' + list.get('name')
                    }
                }, {useMasterKey: true}).then(function() {
                    console.log('Successfully send QOTD live notification');
                }, function(err) {
                    console.log(err);
                })
            }
        })
    })
}

Parse.Cloud.job("sendSummary", function(request, status){
    runSummaryUpdate();
    status.success();
});
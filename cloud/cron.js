const CronJob = require('cron').CronJob;
const { sendPushOrSMS } = require('./common');
const Promise = require('promise');
const wrapper = require('co-express');
const { sendAdminSummaryEmail } = require('../utils/mail');
var job = new CronJob({
    cronTime: '00 00 05 * * *',
    onTick: runCron,
    start: false,
    timeZone: 'America/Los_Angeles'
});
if (process.env.NODE_ENV === 'production')
    job.start();
const admins = ['krittylor@gmail.com', 'ericwebb85@yahoo.com', 'luke@lukevink.com', 'christos@campfire.fm', 'nick@campfire.fm'];

function runCron() {
    sendStatisticsEmail();
    notifyExpiringQuestions();
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
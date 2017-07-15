var CronJob = require('cron').CronJob;
const Promise = require('promise');
const wrapper = require('co-express');
const { sendAdminSummaryEmail } = require('../utils/mail');
var job = new CronJob({
    cronTime: '00 00 05 * * *',
    onTick: sendStatisticsEmail,
    start: false,
    timeZone: 'America/Los_Angeles'
});
job.start();
const admins = ['krittylor@gmail.com', 'ericwebb85@yahoo.com', 'luke@lukevink.com', 'christos@campfire.fm', 'nick@campfire.fm'];
function sendStatisticsEmail() {
    console.log('Sending statistics to admin users!');
    wrapper(function*() {
        try {
            const questionsCount = yield getLast24('Question', true);
            const answersCount = yield getLast24('Answer', true);
            const unlocksCount = yield getLast24('CampfireUnlock', true);
            const purchases = yield getLast24('ProductPurchase', false, 'productRef', 'userRef');
            const purchasesCount = purchases.length;
            const payouts = yield getLast24('Payout', false);
            const payoutsCount = payouts.length;

            let earningsByAnswer = 0;
            let earningsByUnlock = 0;
            let earningsByPurchase = 0;

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

            // Send summary email to admins
            admins.forEach(function(admin) {
                sendAdminSummaryEmail(admin, {
                    questionsCount,
                    answersCount,
                    unlocksCount,
                    payoutsCount,
                    purchasesCount,
                    earningsByAnswer,
                    earningsByUnlock,
                    earningsByPurchase
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

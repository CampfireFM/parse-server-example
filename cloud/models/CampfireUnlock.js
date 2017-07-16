const {sendPushOrSMS, addActivity} = require('../common');

Parse.Cloud.afterSave("CampfireUnlock", function(request) {

    if (request.object.existed() == false) {

        var currentUser = request.user;

        // It's a new "Unlock"
        var answerRef = request.object.get("answerRef");
        answerRef.fetch({
            success: function (answer) {
                var questionRef = answer.get("questionRef");
                getQuestionObjAndItsPointers(questionRef.id, function(err_question, complete_question) {
                    if (err_question) {
                        request.log.error(err_question);
                        console.log(err_question);
                    } else {
                        var params = {
                            question: complete_question,
                            campfireunlock: request.object,
                            answer: answer
                        };
                        answer.increment("unlockCount", 1);
                        answer.save();

                        splitUnlockEarnings(params);
                        var toUsers = [complete_question.get('fromUser'), complete_question.get('toUser')];
                        //Create 'unlock' activity
                        addActivity('unlock', currentUser, toUsers, complete_question, answer);
                        //Send push notification to question asker and answerer
                        sendPushOrSMS(currentUser, toUsers, 'unlocks');
                    }
                });
            },
            useMasterKey: true,
            error: function (object, error) {
                console.log(error);
                throw "Got an error " + error.code + " : " + error.message;
            }
        });
    }
});

/*
The below function calculates all the splits of money for asker and answerer
and their charity
*/
function splitUnlockEarnings(params){

    console.log("reached here11");
    var question = params.question;

    // Math.round((num + 0.00001) * 100) / 100
    var total_user_unlock_earnings = Math.floor( (unlockCostMatches * unlockMatchValue) * Math.pow(10, 4) ) / Math.pow(10, 4) ;
    // var total_unlock_earnings = Math.floor10(unlockCostMatches * unlockMatchValue);
    
    var fromUser = question.get("fromUser");
    var toUser   = question.get("toUser");

    var split_asker = total_user_unlock_earnings; /// 2;
    var split_answerer = total_user_unlock_earnings; // / 2;
    if(question.get('type') !== 'user'){
        split_asker = 0;
        split_answerer = total_user_unlock_earnings;
    }

    if(question.get('type') === 'user'){
        var asker_charity_percentage = fromUser.get("donationPercentage") ? fromUser.get("donationPercentage") : 0;
        var split_asker_charity = split_asker * ( asker_charity_percentage / 100);

        var asker_charity = fromUser.get("charityRef");

        var split_asker_final = split_asker - split_asker_charity;
        var payout_asker_params = {
            amount: split_asker_final,
            userRef: fromUser,
            unlockRef: params.campfireunlock,
            type: 'unlockAsker',
            isPaid: false
        };

        console.log(payout_asker_params);

        createPayoutForUnlock(payout_asker_params, function(e,r) {
            console.log(e);
        });

        var donation_asker_params = {
            amount: split_asker_charity,
            charityRef: asker_charity,
            questionRef: question,
            userRef: fromUser,
            isPaid: false
        };

        createDonationForUnlock(donation_asker_params, function (e, r) {
            console.log(e);
            console.log();
        });


        // The following should probably go inside a payout or donation success block

        fromUser.increment("earningsTotal", total_user_unlock_earnings);
        fromUser.increment("earningsBalance", split_asker);
        fromUser.increment("earningsFromUnlocks", split_asker);
        fromUser.increment("earningsDonated", split_asker_charity);
        fromUser.save(null, {useMasterKey: true});
    }

    var answerer_charity_percentage = question.get("charityPercentage") ? question.get("charityPercentage") : 0;
    var split_answerer_charity = split_answerer * ( answerer_charity_percentage / 100);

    var split_answerer_final = split_answerer - split_answerer_charity;

    var payout_answerer_params = {
        amount: split_answerer_final,
        userRef: toUser,
        unlockRef: params.campfireunlock,
        type: 'unlockAnswerer',
        isPaid: false
    };

    createPayoutForUnlock(payout_answerer_params, function(e,r) {
        console.log(e);
        console.log();
    });

    var donation_answerer_params = {
        amount: split_answerer_charity,
        charityRef: question.get("charity"),
        questionRef: question,
        userRef: toUser,
        isPaid: false
    };
    createDonationForUnlock(donation_answerer_params, function (e, r) {
        console.log(e);
        console.log();
    });

    toUser.increment("earningsTotal", total_user_unlock_earnings);
    toUser.increment("earningsBalance", split_answerer);
    toUser.increment("earningsFromUnlocks", split_answerer);
    toUser.increment("earningsDonated", split_answerer_charity);
    toUser.save(null, {useMasterKey: true});
}

/*
@Description : Function to create Charity record
*/
function createDonationForUnlock(params, callback) {

    var Donation = Parse.Object.extend("Donation");
    var donation = new Donation();

    if(params.amount === 0)
        return callback(null);
    for (key in params) {
        donation.set(key, params[key]);
    }

    donation.save(null, {
        useMasterKey: true,
        success: function (donationrecord) {
            return callback(null, donationrecord);
        }, error: function (err) {
            return callback(err, null);
        }
    });
    //end of save operation code block
}

/*
@Description : Function to create Payout record
*/
function createPayoutForUnlock(params, callback) {

    if(params.amount === 0 || !params.charityRef)
        return callback(null);

    var Payout = Parse.Object.extend("Payout");
    var payout = new Payout();

    for (key in params) {
        payout.set(key, params[key]);
    }

    payout.save(null, {
        useMasterKey: true,
        success: function (payoutrecord) {
            return callback(null, payoutrecord);
        }, error: function (err) {
            return callback(err, null);
        }
    });
    //end of save operation code block
}



function getQuestionObjAndItsPointers(questionId,callback) {

    console.log("inside getQuestionObjAndItsPointers");
    var Question = Parse.Object.extend("Question");
    var query = new Parse.Query(Question);
    query.include(['fromUser', 'fromUser.charityRef', 'toUser', 'toUser.charityRef']);
    query.equalTo("objectId", questionId);
    query.find({
        success: function (questions) {
            console.log("in the SUCCESS of getQuestionObjAndItsPointers");
            console.log(questions.length);
            console.log(questions[0]);
            // return res.success(questions[0]);
            return callback(null, questions[0]);
        },
        error: function (object, error) {
            console.log("in the FAILURE of getQuestionObjAndItsPointers");
            console.log(error);
            return callback(error, null);
            // return res.error(error);
        }
    });
}

(function() {
    /**
     * Decimal adjustment of a number.
     *
     * @param {String}  type  The type of adjustment.
     * @param {Number}  value The number.
     * @param {Integer} exp   The exponent (the 10 logarithm of the adjustment base).
     * @returns {Number} The adjusted value.
     */
    function decimalAdjust(type, value, exp) {
        // If the exp is undefined or zero...
        if (typeof exp === 'undefined' || +exp === 0) {
            return Math[type](value);
        }
        value = +value;
        exp = +exp;
        // If the value is not a number or the exp is not an integer...
        if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
            return NaN;
        }
        // Shift
        value = value.toString().split('e');
        value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
        // Shift back
        value = value.toString().split('e');
        return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
    }

    // Decimal round
    if (!Math.round10) {
        Math.round10 = function(value, exp) {
            return decimalAdjust('round', value, exp);
        };
    }
    // Decimal floor
    if (!Math.floor10) {
        Math.floor10 = function(value, exp) {
            return decimalAdjust('floor', value, exp);
        };
    }
    // Decimal ceil
    if (!Math.ceil10) {
        Math.ceil10 = function(value, exp) {
            return decimalAdjust('ceil', value, exp);
        };
    }
})();
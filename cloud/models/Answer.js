const {checkEmailSubscription, sendPushOrSMS, addActivity, questionsToAlgoliaObjects} = require('../common');
const mail = require('../../utils/mail');
var paymenthandler = require('../../utils/paymenthandler.js');
var answer_methods = {};

var config = require('../../config');
var algoliasearch = require('../algolia/algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);

Parse.Cloud.beforeSave("Answer", function(request, response){
    if(request.object.get("liveDate") === undefined)
        request.object.set("liveDate", new Date());
    response.success();
});

//begin of afterSave function
Parse.Cloud.afterSave("Answer", function(request) {

    console.log("starting afterSave of Answer");

    //check if its a new record.
    if (request.object.existed() == false) {

        var answer = request.object;

        var currentUser = request.user;
        currentUser.increment('answerCount', 1);
        currentUser.save(null, {useMasterKey: true}).then(function(user){
            console.log(`${currentUser.get('fullName')} has answered ${user.get('answerCount')} questions so far.`);
        }, function(err){
            console.log(err);
            console.log(`Failed to increase the number of answer of ${currentUser.get('fullName')}.`);
        });

        var questionRef = answer.get("questionRef");
        getQuestionAndItsPointers(questionRef.id, function(err_question, question) {
            if(err_question){
                request.log.error("FAILED IN QUESTION DETAILS FETCH");
                request.log.error(JSON.stringify(err_question));
            } else {
                if(question.get('isTest') !== true) {

                    var index = client.initIndex('questions');
                    // Convert Parse.Object to JSON
                    var objectToSave = questionsToAlgoliaObjects(question)[0];
                    // Add or update object
                    index.saveObject(objectToSave, function (err, content) {
                        if (err) {
                            throw err;
                        }
                    });
                    var indexByUsername = client.initIndex('questions_by_username');
                    indexByUsername.saveObject(objectToSave, function (err, content) {
                        if (err) {
                            throw err;
                        }
                    });
                }

                //Check if the question is already answered.
                //If not answered yet, this is first time for the question to be answered then charge user and split payment.
                if(question.get('isAnswered') == false){
                    question.set("isAnswered", true);
                    question.save(null, { useMasterKey: true });
                    //Charge user and split payment.
                    if(question.get('price') != undefined && question.get('price') != 0)
                        splitAndMakePayments(question, function(e,r){
                            console.log(e);
                            console.log(r);
                        });
                }

                var fromUser = question.get('fromUser');
                fromUser.fetch({
                    useMasterKey : true,
                    success : function(user) {

                        //Add answer activity to Activity
                        addActivity('answer', currentUser, user, question, answer);

                        //Send answers push notification to question asker
                        sendPushOrSMS(currentUser, user, 'answers', answer.id);

                        //Check for email subscription of questionAsker
                        if (!checkEmailSubscription(user, 'answers')){
                            console.log('Question asker has not been subscribed to receive answer emails yet');
                        } else {
                            mail.sendAnswerEmail(
                                user.get('email'),
                                request.user.get('profilePhoto').url(),
                                request.user.get('fullName'),
                                question.get('text')
                            )
                        }
                    },
                    error : function(error){
                        console.log(error);
                        throw "Got an error " + error.code + " : " + error.message;
                    }
                });
            }
        });
        //ENDS HERE - TO BE UNCOMMENTED
    }
});
//end of afterSave function

function getQuestionAndItsPointers(questionId,callback){

    var Question = Parse.Object.extend("Question");
    var query = new Parse.Query(Question);
    query.include(["toUser", "fromUser", "charity"]);
    query.equalTo("objectId",questionId);
    query.find({
        success: function(questions) {
            console.log(questions.length);
            console.log(questions[0]);
            return callback(null,questions[0]);
        },
        error: function(object, error) {
            console.log(error);
            return callback(error,null);
        }
    });
}

//This function calculates the payments for user, donation and creates payouts
function splitAndMakePayments(question, callback){

    var qAsker = question.get("fromUser");
    var qAnswerer = question.get("toUser");
    var charity = question.get("charity");

    var charity_percentage = question.get("charityPercentage") ? question.get("charityPercentage") : 0;
    var price = question.get("price") ? question.get("price") : 0;

    // split_app is the amount going to the app.
    var split_app = price * answerPercentageToCampfire;

    // split_app is the amount (if any) going to a charity.
    // Split to charity and split to answerer are found after money for app is taken out
    var split_charity = (price - split_app) * ( charity_percentage / 100);
    var split_answerer = price - (split_app + split_charity);

    var toUser = qAnswerer;
    var fromUser = qAsker;

    var payout_params = {
        amount : split_answerer,
        userRef : toUser,
        questionRef : question,
        type : 'answer',
        isPaid : false
    };

    createPayout(payout_params, function(e,r){
        console.log(e);
        console.log();
    });

    var deposit_params = {
        transactionPercentage: transactionPercentage,
        amount: price,
        transactionFee : transactionFee,
        userRef : fromUser,
        questionRef : question
    };

    createDeposit(deposit_params, function(e,r){
        console.log(e);
        console.log();
    });

    if(split_charity > 0){
        var donation_params = {
            amount: split_charity,
            questionRef: question,
            userRef : toUser,
            isPaid: false
        };

        createDonation(donation_params, function(e,r){
            console.log(e);
            console.log();
        });
    }


    var user_earning_increment = split_charity + split_answerer;

    // should probably go in a success block

    qAnswerer.increment("earningsTotal", user_earning_increment);
    qAnswerer.increment("earningsBalance", split_answerer);
    qAnswerer.increment("earningsDonated", split_charity);
    qAnswerer.save(null, {useMasterKey: true});

}

/*
 @Description : Function to createDeposit record
 */
function createDeposit(params, callback){

    var Deposit = Parse.Object.extend("Deposit");
    var deposit = new Deposit();

    for(key in params){
        deposit.set(key,params[key]);
    }

    deposit.save(null, {
        useMasterKey: true,
        success: function(depositrecord){
            return callback(null,depositrecord);
        },error : function(err){
            return callback(err,null);
        }
    });
    //end of save operation code block
}

/*
 @Description : Function to create charitable Donation record
 */
function createDonation(params, callback){

    var Donation = Parse.Object.extend("Donation");
    var donation = new Donation();

    for(key in params){
        donation.set(key,params[key]);
    }

    donation.save(null, {
        useMasterKey: true,
        success: function(donationrecord){
            return callback(null,donationrecord);
        },error : function(err){
            return callback(err,null);
        }
    });
    //end of save operation code block
}

/*
 @Description : Function to create Payout record
 */
function createPayout(params, callback){

    var Payout = Parse.Object.extend("Payout");
    var payout = new Payout();

    for(key in params){
        payout.set(key,params[key]);
    }

    payout.save(null, {
        useMasterKey: true,
        success: function(payoutrecord){
            return callback(null,payoutrecord);
        },error : function(err){
            return callback(err,null);
        }
    });
    //end of save operation code block
}

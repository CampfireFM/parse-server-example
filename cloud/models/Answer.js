const {trackEvent, checkEmailSubscription, sendPushOrSMS, addActivity, parseToAlgoliaObjects, generateAnswerShareImage } = require('../common');
const mail = require('../../utils/mail');
var paymenthandler = require('../../utils/paymenthandler.js');
const {getFollowers} = require('../common');
const Mixpanel = require('mixpanel');
var config = require('../../config');
const warningReceivers = config.warningReceivers;
var algoliasearch = require('../algolia/algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);
function pointerTo(objectId, klass) {
    return { __type:"Pointer", className:klass, objectId:objectId };
}
Parse.Cloud.beforeSave("Answer", function(request, response) {
    if (request.object.existed())
        return response.success();
    else {
        request.object.set('liveDate', new Date());
        getQuestionAndItsPointers(request.object.get('questionRef').id, (err, question) => {
            if (question) {
                const list = question.get('list');
                if (list) {
                    const answerLists = [pointerTo(list.id, 'List')];
                    request.object.set('lists', answerLists);
                }
                if (question.get('isAnswered') === true)
                    response.error(new Error('Duplicated answer for same question'));
                else {
                    question.set('isAnswered', true);
                    question.save(null, {useMasterKey: true}).then(function(question) {
                        response.success();
                    }, function(err) {
                        response.error(err);
                    });
                }
            } else {
                response.error(new Error('Can not find question of the answer'));
            }
        });
    }
});

//begin of afterSave function
Parse.Cloud.afterSave("Answer", function(request) {

    console.log("starting afterSave of Answer");

    var createdAt = request.object.get("createdAt");
    var updatedAt = request.object.get("updatedAt");
    var objectExisted = (createdAt.getTime() != updatedAt.getTime());
    //check if its a new record.
    if (objectExisted == false) {
        
        var answer = request.object;

        var questionRef = answer.get("questionRef");
        getQuestionAndItsPointers(questionRef.id, function(err_question, question) {
            if(err_question){
                request.log.error("FAILED IN QUESTION DETAILS FETCH");
                request.log.error(JSON.stringify(err_question));
            } else {

                var currentUser = question.get('toUser');
                currentUser.increment('answerCount', 1);
                currentUser.save(null, {useMasterKey: true}).then(function(user){
                    console.log(`${currentUser.get('fullName')} has answered ${user.get('answerCount')} questions so far.`);
                }, function(err){
                    console.log(err);
                    console.log(`Failed to increase the number of answer of ${currentUser.get('fullName')}.`);
                });

                if(question.get('isTest') !== true) {

                    var index = client.initIndex('questions');
                    //Convert Parse.Object to JSON
                    var objectToSave = parseToAlgoliaObjects(question)[0];
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
                    const answer = request.object;
                    var answerToSave = answer.toJSON();
                    answerToSave.questionRef = question.toJSON();
                    var indexAnswer = client.initIndex(config.algolia.answerIndex);
                    indexAnswer.saveObject(answerToSave, (err, content) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                }

                //Check if the question is already answered.
                //If not answered yet, this is first time for the question to be answered then charge user and split payment.
                    //Charge user and split payment.
                if(question.get('price') != undefined && question.get('price') != 0) {
                    splitAndMakePayments(question, function (e, r) {
                        console.log(e);
                        console.log(r);
                    });
                }
                var fromUser = question.get('fromUser');
                getFollowers(currentUser)
                  .then(followers => {
                      const followUsers = [];
                      followers.forEach(follower => {
                          if (follower.get('fromUser').id !== fromUser.id)
                              followUsers.push(follower.get('fromUser'));
                      });
                      if (followUsers.length > 0)
                        sendPushOrSMS(currentUser, followUsers, 'answerToFollowers', fromUser.get('fullName'), answer.id);
                  })
                  .catch(err => {
                      console.log(err);
                  })

                fromUser.fetch({
                    useMasterKey : true,
                    success : function(user) {

                        //Add answer activity to Activity
                        addActivity('answer', currentUser, user, question, answer);

                        //Send answers push notification to question asker
                        sendPushOrSMS(currentUser, user, 'answers', answer.id, answer.id);

                        //Check for email subscription of questionAsker
                        if (!checkEmailSubscription(user, 'answers')){
                            console.log('Question asker has not been subscribed to receive answer emails yet');
                        } else {
                            mail.sendAnswerEmail(
                                user.get('email'),
                                request.user.get('profilePhoto').url(),
                                request.user.get('fullName'),
                                question.get('text'),
                                answer.id
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
        generateAnswerShareImage(request.object.id);
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

    // Ignore charityPercentage if charity is found undefined
    var charity_percentage = question.get("charityPercentage") ? question.get("charityPercentage") : 0;
    if (!charity)
        charity_percentage = 0;

    var price = question.get("price") ? question.get("price") : 0;

    var total_user_answer_earnings = Math.floor((price / 2) * Math.pow(10, 4)) / Math.pow(10, 4);
    // Split to charity and split to answerer are found after money for app is taken out
    var split_charity = total_user_answer_earnings * ( charity_percentage / 100);
    var split_answerer = total_user_answer_earnings - split_charity;

    var toUser = qAnswerer;
    var fromUser = qAsker;

    if (split_answerer > 0) {
        var payout_params = {
            amount : split_answerer,
            userRef : toUser,
            questionRef : question,
            type : 'answer',
            isPaid : false
        };

        createPayout(payout_params, function(err, res){
            if (err) {
                console.log(err);
                // Send warning email
                warningReceivers.forEach(receiver => {
                    mail.sendWarningEmail(receiver, {
                        message: `Failed to create payout: \n params: ${JSON.stringify(payout_params, null, 2)}, err: ${JSON.stringify(err, null, 2)}`
                    });
                });
            } else {
                qAnswerer.increment("earningsTotal", total_user_answer_earnings);
                qAnswerer.increment("earningsBalance", split_answerer);
                qAnswerer.increment("earningsFromAnswers", split_answerer);
                qAnswerer.save(null, {useMasterKey: true}).then(res => {

                }, err => {
                    console.log(err);
                    // Send warning email
                    warningReceivers.forEach(receiver => {
                        mail.sendWarningEmail(receiver, {
                            message: `Failed to update earningsTotal, earningsBalance, earningsFromAnswer to ${total_user_answer_earnings}, ${split_answerer}, ${split_answerer} of user ${qAnswerer.id} \n err: ${JSON.stringify(err, null, 2)}`
                        });
                    });
                })
            }

        });
    }

    if(split_charity > 0 && charity){
        var donation_params = {
            amount: split_charity,
            questionRef: question,
            userRef : toUser,
            isPaid: false,
            charityRef: charity
        };

        createDonation(donation_params, function(err, res){
            if (err) {
                console.log(err);
                // Send warning email
                warningReceivers.forEach(receiver => {
                    mail.sendWarningEmail(receiver, {
                        message: `Failed to create donation: \n params: ${JSON.stringify(donation_params, null, 2)} \n err: ${JSON.stringify(err, null, 2)}`
                    });
                });

            } else {
                qAnswerer.increment("earningsDonated", split_charity);
                qAnswerer.save(null, {useMasterKey: true}).then(res => {

                }, err => {
                    console.log(err);
                    // Send warning email
                    warningReceivers.forEach(receiver => {
                        mail.sendWarningEmail(receiver, {
                            message: `Failed to update earningsDonated: \n params: ${split_charity}, user: ${qAnswerer.id} \n ${JSON.stringify(err, null, 2)}`
                        });
                    });
                });
            }
        });
    }
}

/*
 @Description : Function to create charitable Donation record
 */
function createDonation(params, callback){

    var Donation = Parse.Object.extend("Donation");
    var donation = new Donation();

    params.amount = Math.floor( params.amount * Math.pow(10, 4) ) / Math.pow(10, 4);
    for(key in params){
        donation.set(key,params[key]);
    }
    trackEvent(params.userRef, 'DONATION', params);
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
    params.amount = Math.floor( params.amount * Math.pow(10, 4) ) / Math.pow(10, 4);
    for(key in params){
        payout.set(key,params[key]);
    }
    trackEvent(params.userRef, 'PAYOUT', params);
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

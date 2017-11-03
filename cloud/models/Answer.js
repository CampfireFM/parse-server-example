const {resetFeaturedAnswers, resetTop20CloutPoints, trackEvent, checkEmailSubscription, sendPushOrSMS, addActivity, parseToAlgoliaObjects, generateAnswerShareImage } = require('../common');
const mail = require('../../utils/mail');
var paymenthandler = require('../../utils/paymenthandler.js');
const {getFollowers} = require('../common');
const Mixpanel = require('mixpanel');
const wrapper = require('co-express');
var config = require('../../config');
const warningReceivers = config.warningReceivers;
var algoliasearch = require('../algolia/algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);
const redisClient = require('../redis');
function pointerTo(objectId, klass) {
    return { __type:"Pointer", className:klass, objectId:objectId };
}
Parse.Cloud.beforeSave("Answer", function(request, response) {
    if (request.object.existed()) {
        const likeCount = request.object.get('likeCount') || 0;
        const unlockCount = request.object.get('unlockCount') || 0;
        const cloutDeductions = request.object.get('cloutDeductions') || 0;
        const cloutFromDate = request.object.get('cloutFromDate') || 0;
        const cloutEarned = likeCount * pointsForLike + unlockCount * pointsForUnlock;
        const cloutFromAdmin = request.object.get('cloutFromAdmin') || 0;
        const cloutPoints = cloutFromDate + cloutEarned + cloutFromAdmin - cloutDeductions;
        request.object.set('cloutEarned', cloutEarned);
        request.object.set('cloutPoints', cloutPoints);
        if (request.object.get('tags'))
          request.object.set('tags', request.object.get('tags').slice(0, 3));
        return response.success();
    }
    else {
        request.object.set('liveDate', new Date());
        request.object.set('cloutFromDate', 100);
        request.object.set('cloutFromAdmin', 0);
        request.object.set('cloutDeductions', 0);
        request.object.set('lastDeductionDate', new Date());
        request.object.set('listenCount', 0);
        request.object.set('likeCount', 0);
        request.object.set('unlockCount', 0);
        request.object.set('cloutPoints', 100);
        request.object.set('cloutEarned', 0);
        getQuestionAndItsPointers(request.object.get('questionRef').id, (err, question) => {
            if (question) {
                const list = question.get('list');
                const tag = question.get('initialTag');
                if (list) {
                    const answerLists = [pointerTo(list.id, 'List')];
                    request.object.set('lists', answerLists);
                }
                if (tag) {
                    const tagList = [pointerTo(tag.id, 'Tag')];
                    request.object.set('tags', tagList);
                }
                request.object.set('questionAsker', question.get('fromUser'));
                request.object.get('charityRef', question.get('charity'));
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
                    answerToSave.objectID = request.object.id;
                    answerToSave.createdTimestamp = request.object.get('createdAt').getTime();
                    answerToSave.questionRef = question.toJSON();
                    answerToSave.questionRef.toUser = question.get('toUser').toJSON();
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
        //ENDS HERE - TO BE UNCOMMENTED
    } else {
        var indexAnswer = client.initIndex(config.algolia.answerIndex);
        const partialUpdate = {
            objectID: request.object.id,
            unlockCount: request.object.get('unlockCount'),
            likeCount: request.object.get('likeCount'),
            listenCount: request.object.get('listenCount'),
            tags: request.object.get('tags'),
            lists: request.object.get('lists'),
            cloutPoints: request.object.get('cloutPoints'),
            isFreeToListen: request.object.get('isFreeToListen'),
            flagCount: request.object.get('flagCount')
        };
        indexAnswer.partialUpdateObject(partialUpdate, function(err, content) {
            console.log(content);
        });
    }
    if (!request.object.get('image')) {
        generateAnswerShareImage(request.object.id);
    }

    // Check top 20 clout points and update if available
    if (request.object.get('isTest') || request.object.get('isDummyData') || !(request.object.get('liveDate') < new Date())) {
        
        return;
    }

    const offset = new Date().getTime() - request.object.get('createdAt').getTime();
    if (offset > 7 * 24 * 3600 * 1000)
      return;
    const cloutPoints = request.object.get('cloutPoints');
    const multi = redisClient.multi();
    multi.lrange('top20CloutPoints', 0, -1);
    multi.lrange('top20AnswerIds', 0, -1);
    multi.exec(function(err, replies) {
        if (err) {
            console.log(err);
        } else {
            console.log(replies);
            let top20CloutPoints = replies[0];
            let top20AnswerIds = replies[1];
            if (top20CloutPoints.length === 0) {
                return resetTop20CloutPoints().then();
            }
            let isExisting = top20AnswerIds.indexOf(request.object.id) > -1;
            if (isExisting && cloutPoints < top20CloutPoints[top20CloutPoints.length - 1]) {
                return resetTop20CloutPoints().then();
            }
            if (!isExisting && cloutPoints < top20CloutPoints[top20CloutPoints.length - 1]) {
                return;
            }
            // Add this answer to top 20
            console.log('Updating top 20 clout points');
            if (isExisting) {
                console.log('Already in top 20 answers');
                top20CloutPoints[top20AnswerIds.indexOf(request.object.id)] = cloutPoints;
                //return;
            }
            let topAnswers = [];
            for (let i = 0; i < top20AnswerIds.length; i++) {
                topAnswers.push({
                    id: top20AnswerIds[i],
                    cloutPoints: parseInt(top20CloutPoints[i])
                })
            }
            if (!isExisting) {
                topAnswers.push({
                    id: request.object.id,
                    cloutPoints
                });
            }
            topAnswers.sort((a, b) => {
                if (a.cloutPoints > b.cloutPoints)
                    return 1;
                if (a.cloutPoints < b.cloutPoints)
                    return -1;
                return 0;
            });
            topAnswers = topAnswers.slice(-20);
            const multiUpdate = redisClient.multi();
            multiUpdate.del('top20CloutPoints');
            multiUpdate.del('top20AnswerIds');
            topAnswers.forEach(topAnswer => {
                multiUpdate.lpush('top20CloutPoints', topAnswer.cloutPoints);
                multiUpdate.lpush('top20AnswerIds', topAnswer.id);
            });
            multiUpdate.ltrim('top20CloutPoints', 0, topAnswers.length - 1);
            multiUpdate.ltrim('top20AnswerIds', 0, topAnswers.length - 1);
            multiUpdate.exec((err, res) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log(res);
                }
            })
        }
    })
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

Parse.Cloud.define('resetTopCloutPoints', (request, response) => {
    resetTop20CloutPoints();
    response.success({});
});

Parse.Cloud.define('getTopCloutPoints', (request, response) => {
    redisClient.lrange('top20CloutPoints', 0, -1, (err, top20CloutPoints) => {
        if (err || !top20CloutPoints || top20CloutPoints.length === 0) {
            resetTop20CloutPoints()
                .then(top20Answers => {
                    response.success(top20Answers);
                })
                .catch(err => {
                    response.error(err);
                })
        } else {
            redisClient.lrange('top20AnswerIds', 0, -1, (err, top20AnswerIds) => {
                let topAnswers = [];
                for (let i = 0; i < top20AnswerIds.length; i++) {
                    topAnswers.push({
                        id: top20AnswerIds[i],
                        cloutPoints: parseInt(top20CloutPoints[i])
                    })
                }
                response.success(topAnswers);
            })
        }
    })
})

Parse.Cloud.define('boostAnswer', (request, response) => {
    const ranking = request.params.ranking;
    const answerId = request.params.answerId;
    const Answer = Parse.Object.extend('Answer');
    const answerQuery = new Parse.Query(Answer);
    answerQuery.get(answerId, {useMasterKey: true}).then(answer => {
        redisClient.lrange('top20CloutPoints', 0, -1, (err, top20CloutPoints) => {
            if (err || !top20CloutPoints || top20CloutPoints.length === 0) {
                resetTop20CloutPoints()
                    .then(top20Answers => {
                        let targetIndex = 0;
                        switch(ranking) {
                            case 'TOP':
                                targetIndex = 0;
                                break;
                            case 'TOP5':
                                targetIndex = 4;
                                break;
                            case 'TOP10':
                                targetIndex = 9;
                                break;
                            case 'TOP20':
                                targetIndex = 19;
                                break;
                            default:
                                targetIndex = 19;
                                break;
                        }
                        let targetPoint = top20Answers[targetIndex].cloutPoints;
                        answer.increment('cloutFromAdmin', targetPoint - (answer.get('cloutPoints') || 0) + 1);
                        answer.save(null, {useMasterKey: true}).then(res => {
                            response.success(res);
                            setTimeout(() => {
                                resetFeaturedAnswers().then();
                            }, 10000);
                        }, err => response.error(err));
                        //response.success(top20Answers);
                    })
                    .catch(err => {
                        response.error(err);
                    })
            } else {
                let targetIndex = 0;
                switch(ranking) {
                    case 'TOP':
                        targetIndex = 0;
                        break;
                    case 'TOP5':
                        targetIndex = 4;
                        break;
                    case 'TOP10':
                        targetIndex = 9;
                        break;
                    case 'TOP20':
                        targetIndex = 19;
                        break;
                    default:
                        targetIndex = 19;
                        break;
                }
                let targetPoint = top20CloutPoints[targetIndex];
                answer.increment('cloutFromAdmin', targetPoint - (answer.get('cloutPoints') || 0) + 1);
                answer.save(null, {useMasterKey: true}).then(res => {
                    response.success(res);
                    resetFeaturedAnswers().then();
                }, err => response.error(err));
            }
        })
    }, err => {
        response.error(err);
    })

})


Parse.Cloud.define('buryAnswer', (request, response) => {
    const ranking = request.params.ranking;
    const answerId = request.params.answerId;
    const Answer = Parse.Object.extend('Answer');
    const answerQuery = new Parse.Query(Answer);
    const buryFloorQuery = new Parse.Query(Answer);
    buryFloorQuery.descending('cloutPoints');
    buryFloorQuery.skip(1000);
    const p1 = answerQuery.get(answerId, {useMasterKey: true});
    const p2 = buryFloorQuery.first({useMasterKey: true});

    Parse.Promise.when(p1, p2)
      .then((answer, borderAnswer) => {
          const diff = borderAnswer.get('cloutPoints') - answer.get('cloutPoints');
          answer.increment('cloutFromAdmin', diff);
          return answer.save(null, {useMasterKey: true});
      })
      .then(answer => {
          response.success({});
      })
      .catch(err => {
          console.log(err);
          response.error(err);
      });
    //answerQuery.get(answerId, {useMasterKey: true}).then(answer => {
    //    redisClient.lrange('featuredAnswers', 300, 300, (err, reply) => {
    //        if (err) {
    //            response.error(err);
    //        } else {
    //            const borderAnswerId = reply[0];
    //            const borderAnswerQuery = new Parse.Query(Answer);
    //            borderAnswerQuery.get(borderAnswerId, {useMasterKey: true})
    //                .then(borderAnswer => {
    //                    const diff = borderAnswer.get('cloutPoints') - answer.get('cloutPoints');
    //                    answer.increment('cloutFromAdmin', diff);
    //                    answer.save(null, {useMasterKey: true})
    //                        .then(answer => {
    //                            setTimeout(() => {
    //                                resetFeaturedAnswers().then();
    //                            }, 10000);
    //                            response.success({});
    //                        }, err => {
    //                            console.log(err);
    //                            response.error(err);
    //                        })
    //                }, err => {
    //                    console.log(err);
    //                    response.error(err);
    //                });
    //        }
    //    })
    //}, err => {
    //    response.error(err);
    //})
})

Parse.Cloud.job("Reset Top 20 Answers", function(request, status) {
    resetTop20CloutPoints()
        .then(res => {
            status.success();
        }, err => {
            status.error(err);
        })
});
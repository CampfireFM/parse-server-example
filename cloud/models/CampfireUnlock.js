Parse.Cloud.afterSave("CampfireUnlock", function(request) {

    if (request.object.existed() == false) {

        var currentUser = request.user;

        // It's a new "Unlock"
        var campfireRef = request.object.get("campfireRef");
        campfireRef.fetch({
            success: function (campfire) {
                var questionRef = campfire.get("questionRef");
                getQuestionObjAndItsPointers(questionRef.id, function(err_question, complete_question){
                        if(err_question){

                            request.log.error(err_question);
                            console.log(err_question);

                        }else{
                            var params = {
                                question: complete_question,
                                campfireunlock: request.object,
                                campfire : campfire
                            };

                            campfire.increment("unlockCount",1);
                            campfire.save({useMasterKey:true});

                            splitUnlockEarnings(params);
                            sendUnlockPushToAsker(campfire, complete_question, currentUser);
                            sendUnlockPushToAnswerer(campfire, complete_question, currentUser);
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


function saveUnlockActivity(campfire, question, currentUser, toUser, type) {
     // Create and save a new "Unlock" activity for the question Asker
    var Activity = Parse.Object.extend("Activity");
    var newActivity = new Activity();
    newActivity.set("question", question);
    newActivity.set("campfire", campfire);
    newActivity.set("isRead", false);
    newActivity.set("toUser", toUser);
    newActivity.set("fromUser", currentUser);
    newActivity.set("type", type);
    newActivity.save(null, {useMasterKey: true});
    
}

function sendUnlockPushToAsker(campfire, question, currentUser) {
    
    saveUnlockActivity(campfire, question, currentUser, question.get("fromUser"), "unlockToAsker");
    
    
    // setup a push to the question Asker
    var pushQuery = new Parse.Query(Parse.Installation);
    pushQuery.equalTo('deviceType', 'ios');
    pushQuery.equalTo('user', question.get("fromUser"));
    var alert = "";
    var firstName = currentUser.get('firstName');
    var lastName = currentUser.get('lastName');
    if (firstName) {
        alert = firstName + " " + lastName + " unlocked your question.";
    }
    
    Parse.Push.send({
                    where: pushQuery,
                    data: {
                    alert: alert,
                    questionId: question.id
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
}



function sendUnlockPushToAnswerer(campfire, question, currentUser) {
    
    saveUnlockActivity(campfire, question, currentUser, question.get("toUser"), "unlockToAnswerer");
    
    // setup a push to the question Answerer
    var pushQuery = new Parse.Query(Parse.Installation);
    pushQuery.equalTo('deviceType', 'ios');
    pushQuery.equalTo('user', question.get("toUser"));
    
    var alert = "";
    var firstName = currentUser.get('firstName');
    var lastName = currentUser.get('lastName');
    if (firstName) {
        alert = firstName + " " + lastName + " unlocked your answer";
    }
    
    Parse.Push.send({
                    where: pushQuery,
                    data: {
                    alert: alert,
                    questionId: question.id
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
}


/*
The below function calculates all the splits of money for asker and answerer
and their charity
*/
function splitUnlockEarnings(params){

      console.log("reached here11");
      var question = params.question;
      var total_unlock_earnings = campfireUnlockValue;
    
      var fromUser = question.get("fromUser");
      var toUser   = question.get("toUser");

      var split_asker = total_unlock_earnings / 2;
      var split_answerer = total_unlock_earnings / 2;

      var answerer_charity_percentage = question.get("charityPercentage") ? question.get("charityPercentage") : 0;
      var split_answerer_charity = split_answerer * ( answerer_charity_percentage / 100);

      var asker_charity_percentage = fromUser.get("donationPercentage") ? fromUser.get("donationPercentage") : 0;
      var split_asker_charity = split_asker * ( asker_charity_percentage / 100);

      var asker_charity = fromUser.get("charityRef");

      var split_asker_final = split_asker - split_asker_charity;
      var split_answerer_final = split_answerer - split_answerer_charity;

      var payout_asker_params = {
            amount : split_asker_final,
            userRef : fromUser,
            unlockRef : params.campfireunlock,
            type : 'unlockAsker',
            isPaid : false
      };

      console.log(payout_asker_params);

        createPayoutForUnlock(payout_asker_params, function(e,r){
            console.log(e);
            console.log();
        });

      var payout_answerer_params = {
            amount : split_answerer_final,
            userRef : toUser,
            unlockRef : params.campfireunlock,
            type : 'unlockAnswerer',
            isPaid : false
      };

        createPayoutForUnlock(payout_answerer_params, function(e,r){
            console.log(e);
            console.log();
        });

      var donation_answerer_params = {
            amount: split_answerer_charity,
            charityRef: question.get("charity"),
            questionRef: question,
            userRef : toUser,
            isPaid: false
      };

      createDonationForUnlock(donation_answerer_params, function(e,r){
            console.log(e);
            console.log();
        });

      var donation_asker_params = {
            amount: split_asker_charity,
            charityRef: asker_charity,
            questionRef: question,
            userRef : fromUser,
            isPaid: false
      };

      createDonationForUnlock(donation_asker_params, function(e,r){
            console.log(e);
            console.log();
        });

    
      // The following should probably go inside a payout or donation success block
    
      fromUser.increment("earningsTotal", split_asker);
      fromUser.increment("earningsBalance", split_asker);
      fromUser.increment("earningsDonated", donation_asker_params["amount"]);
      fromUser.save(null, {useMasterKey: true});

      toUser.increment("earningsTotal", split_answerer);
      toUser.increment("earningsBalance", split_answerer);
      toUser.increment("earningsDonated", donation_answerer_params["amount"]);
      toUser.save(null, {useMasterKey: true});
}

/*
@Description : Function to create Charity record
*/
function createDonationForUnlock(params, callback){

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
function createPayoutForUnlock(params, callback){

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



function getQuestionObjAndItsPointers(questionId,callback){

      console.log("inside getQuestionObjAndItsPointers");
      var Question = Parse.Object.extend("Question");
      var query = new Parse.Query(Question);
      query.include(['fromUser','fromUser.charityRef','toUser','toUser.charityRef']);
      query.equalTo("objectId",questionId);
      query.find({
        success: function(questions) {
          console.log("in the SUCCESS of getQuestionObjAndItsPointers");
          console.log(questions.length);
          console.log(questions[0]);
          // return res.success(questions[0]);
          return callback(null,questions[0]);
        },
        error: function(object, error) {
          console.log("in the FAILURE of getQuestionObjAndItsPointers");
          console.log(error);
          return callback(error,null);
          // return res.error(error);
        }
      });
}

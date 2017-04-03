
Parse.Cloud.afterSave("CampfireUnlock", function(request) {

    console.log("IAMHEERE");
    if (request.object.existed() == false) {

        console.log("HERE TOOOOO");

        var currentUser = request.user;

        console.log("SUCCESS on save");
        // It's a new "Like"
        var campfireRef = request.object.get("campfireRef");
        campfireRef.fetch({
            success: function (campfire) {
                console.log("SUCCESS getting Campfire");
                var questionRef = campfire.get("questionRef");
                // questionRef.include(['fromUser','fromUser.charityRef','toUser','toUser.charityRef']);
                questionRef.fetch({
                    success: function (question) {
                        console.log("SUCCESS getting Question");

                        var questionAsker = question.get("fromUser");

                        console.log("I AM JUST BEFORE FUNCTION CALL");

                        getQuestionObjAndItsPointers(question.id, function(err_question, complete_question){
                                if(err_question){

                                    request.log.error("FAILED IN QUESTION DETAILS FETCH");
                                    request.log.error(err_question);
                                    console.log("FAILED IN QUESTION DETAILS FETCH");
                                    console.log(err_question);

                                }else{

                                    var params = {
                                        question: complete_question,
                                        campfireunlock: request.object,
                                        campfire : campfire
                                    };

                                    console.log("JUST BEFORE CALLING SPLITUNLOCK EARNINGS");
                                    console.log(params);

                                    splitUnlockEarnings(params);

                                }
                        });



                        questionAsker.fetch({
                            success: function (questionAskerUser) {
                                console.log("SUCCESS getting the FROM USER!");
                                // Create and save a new "Like" activity for the question Asker
                                var Activity = Parse.Object.extend("Activity");
                                var newActivity = new Activity();
                                newActivity.set("question", question);
                                newActivity.set("campfire", campfire);
                                newActivity.set("isRead", false);
                                newActivity.set("toUser", questionAskerUser);
                                newActivity.set("fromUser", currentUser);
                                newActivity.set("type", "unlockToAsker");
                                newActivity.save(null, {useMasterKey: true});
                                // setup a push to the question Answerer
                                var pushQuery = new Parse.Query(Parse.Installation);
                                pushQuery.equalTo('deviceType', 'ios');
                                pushQuery.equalTo('user', questionAsker);
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

                            },
                            useMasterKey: true,
                            error: function (object, error) {
                                console.log(error);
                                throw "Got an error " + error.code + " : " + error.message;
                            }
                        });

                        var questionAnswerer = question.get("toUser");
                        questionAnswerer.fetch({
                            success: function (toUser) {

                                // Create and save a new "Like" activity
                                var Activity = Parse.Object.extend("Activity");
                                var newActivity2 = new Activity();
                                newActivity2.set("question", question);
                                newActivity2.set("campfire", campfire);
                                newActivity2.set("isRead", false);
                                newActivity2.set("toUser", toUser);
                                newActivity2.set("fromUser", currentUser);
                                newActivity2.set("type", "unlockToAnswerer");
                                newActivity2.save()

                                // setup a push to the question Asker
                                var pushQuery = new Parse.Query(Parse.Installation);
                                pushQuery.equalTo('deviceType', 'ios');
                                pushQuery.equalTo('user', toUser);

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
                            },
                            useMasterKey: true,
                            error: function (object, error) {
                                console.log(error);
                                throw "Got an error " + error.code + " : " + error.message;
                            }
                        });
                    },
                    useMasterKey: true,
                    error: function (object, error) {
                        console.log(error);
                        throw "Got an error " + error.code + " : " + error.message;
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
      var total_unlock_earnings = 0.12;

      var split_asker = total_unlock_earnings / 2;
      var split_answerer = total_unlock_earnings / 2;

      var answerer_charity_percentage = question.get("charityPercentage") ? question.get("charityPercentage") : 0;
      var split_answerer_charity = split_answerer * ( answerer_charity_percentage / 100);

      var asker_charity_percentage = question.get("fromUser").get("donationPercentage") ? question.get("fromUser").get("donationPercentage") : 0;
      var split_asker_charity = split_asker * ( asker_charity_percentage / 100);

      var asker_charity = question.get("fromUser").get("charityRef");

      var split_asker_final = split_asker - split_asker_charity;
      var split_answerer_final = split_answerer - split_answerer_charity;

      var payout_asker_params = {
            amount : split_asker_final,
            userRef : question.get("fromUser"),
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
            userRef : question.get("toUser"),
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
            userRef : question.get("toUser"),
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
            userRef : question.get("fromUser"),
            isPaid: false
      };

      createDonationForUnlock(donation_asker_params, function(e,r){
            console.log(e);
            console.log();
        });

      question.get("fromUser").increment("totalEarnings", split_asker);
      question.get("fromUser").save(null, {useMasterKey: true});

      question.get("toUser").increment("totalEarnings", split_answerer);
      question.get("toUser").save(null, {useMasterKey: true});
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

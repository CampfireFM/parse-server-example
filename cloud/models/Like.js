const {checkPushSubscription} = require('../common');
Parse.Cloud.afterSave("Like", function(request) {

    if (request.object.existed() == false) {

        var currentUser = request.user;
        var objId_currentUser = request.user.id;

        console.log("SUCCESS on save");
        // It's a new "Like"
        var answerRef = request.object.get("answerRef");
        answerRef.fetch({
            success: function(answer) {

                console.log("SUCCESS getting answer");
                var questionRef = answer.get("questionRef");
                questionRef.fetch({
                    success: function(question) {

                        console.log("SUCCESS getting Question");

                        var questionAsker = question.get("fromUser");
                        questionAsker.fetch({
                            success: function (questionAskerUser) {

                                console.log("SUCCESS getting the FROM USER!");
                                var objId_asker = questionAskerUser.id;
                                if (objId_asker == objId_currentUser) {
                                    console.log("Asker and current user same. Don't do anything");
                                } else {
                                    // Create and save a new "Like" activity for the question Asker
                                    var Activity = Parse.Object.extend("Activity");
                                    var newActivity = new Activity();
                                    newActivity.set("question", question);
                                    newActivity.set("answer", answer);
                                    newActivity.set("isRead", false);
                                    newActivity.set("toUsers", questionAskerUser);
                                    newActivity.set("fromUser", request.user);
                                    newActivity.set("type", "likeToAsker");
                                    newActivity.save(null, {useMasterKey: true});

                                    //Check for push subscription of likes
                                    if (!checkPushSubscription(questionAskerUser, 'likes')) {
                                        console.log('Question asker has not subscribed to receive likes notification yet');
                                    } else {

                                        // setup a push to the question Answerer
                                        var pushQuery = new Parse.Query(Parse.Installation);
                                        pushQuery.equalTo('deviceType', 'ios');
                                        pushQuery.equalTo('user', questionAskerUser);

                                        var alert = "";
                                        var firstName = currentUser.get('firstName');
                                        var lastName = currentUser.get('lastName');
                                        if (firstName) {
                                            alert = firstName + " " + lastName + " just liked the answer to your question!";
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
                                                console.log("Successful push to question Asker for like");
                                                // Push was successful
                                            },
                                            error: function (error) {
                                                throw "PUSH: Got an error " + error.code + " : " + error.message;
                                            }
                                        });
                                    }
                                }
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

                                var objId_answerer = toUser.id;
                                if (objId_answerer == objId_currentUser) {
                                    console.log("Answerer and current user same. Don't do anything");
                                } else {
                                    // Create and save a new "Like" activity
                                    var Activity = Parse.Object.extend("Activity");
                                    var newActivity2 = new Activity();
                                    newActivity2.set("question", question);
                                    newActivity2.set("answer", answer);
                                    newActivity2.set("isRead", false);
                                    newActivity2.set("toUser", toUser);
                                    newActivity2.set("fromUser", request.user);
                                    newActivity2.set("type", "likeToAnswerer");
                                    newActivity2.save(null, {useMasterKey: true});
                                    //Check for push subscription of likes
                                    if (!checkPushSubscription(toUser, 'likes')) {
                                        console.log('Question answerer has not subscribed to receive likes notification yet');
                                    } else {
                                        // setup a push to the question Asker
                                        var pushQuery = new Parse.Query(Parse.Installation);
                                        pushQuery.equalTo('deviceType', 'ios');
                                        pushQuery.equalTo('user', toUser);

                                        var alert = "";
                                        var firstName = currentUser.get('firstName');
                                        var lastName = currentUser.get('lastName');
                                        if (firstName) {
                                            alert = firstName + " " + lastName + " just liked your answer!";
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
                                }
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
            error: function(object, error) {
                console.log(error);
                throw "Got an error " + error.code + " : " + error.message;
            }
        });
    }
});





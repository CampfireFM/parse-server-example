
Parse.Cloud.afterSave("Like", function(request) {


    if (request.object.existed() == false) {

        var currentUser = request.user

        console.log("SUCCESS on save");
        // It's a new "Like"
        var campfireRef = request.object.get("campfireRef");
        campfireRef.fetch({
            success: function(campfire) {

                console.log("SUCCESS getting Campfire");

                var questionRef = campfire.get("questionRef");
                questionRef.fetch({
                    success: function(question) {

                        console.log("SUCCESS getting Question");

                        var questionAsker = question.get("fromUser");
                        questionAsker.fetch({
                            success: function(questionAskerUser) {

                                console.log("SUCCESS getting the FROM USER!");

                                // Create and save a new "Like" activity for the question Asker
                                var Activity = Parse.Object.extend("Activity");
                                var newActivity = new Activity();
                                newActivity.set("question", question);
                                newActivity.set("campfire", campfire);
                                newActivity.set("isRead", false);
                                newActivity.set("toUser", questionAskerUser);
                                newActivity.set("fromUser", request.user);
                                newActivity.set("type", "likeToAsker");
                                newActivity.save(null, { useMasterKey: true });


                                // setup a push to the question Answerer
                                var pushQuery = new Parse.Query(Parse.Installation);
                                pushQuery.equalTo('deviceType', 'ios');
                                pushQuery.equalTo('user', questionAsker);

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
                                    success: function() {
                                        console.log("Successful push to question Asker for like");
                                        // Push was successful
                                    },
                                    error: function(error) {
                                        throw "PUSH: Got an error " + error.code + " : " + error.message;
                                    }
                                });

                            },
                            useMasterKey: true,
                            error: function(object, error) {
                            console.log(error);
                            throw "Got an error " + error.code + " : " + error.message;
                            }
                        });

                        var questionAnswerer = question.get("toUser");
                        questionAnswerer.fetch({
                           success: function(toUser) {

                            // Create and save a new "Like" activity
                            var Activity = Parse.Object.extend("Activity");
                            var newActivity2 = new Activity();
                            newActivity2.set("question", question);
                            newActivity2.set("campfire", campfire);
                            newActivity2.set("isRead", false);
                            newActivity2.set("toUser", toUser);
                            newActivity2.set("fromUser", request.user);
                            newActivity2.set("type", "likeToAnswerer");
                            newActivity2.save() //(null, { useMasterKey: true });


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
                                success: function() {
                                    // Push was successful
                                },
                                error: function(error) {
                                    throw "PUSH: Got an error " + error.code + " : " + error.message;
                                }
                            });
                        },
                        useMasterKey: true,
                        error: function(object, error) {
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
            },
            useMasterKey: true,
            error: function(object, error) {
                console.log(error);
                throw "Got an error " + error.code + " : " + error.message;
            }
        });
    }
});





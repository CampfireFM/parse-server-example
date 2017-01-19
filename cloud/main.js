
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});



//Parse.Cloud.beforeSave(Parse.User, function(request, response) {
////                       Parse.Cloud.useMasterKey();
//                       
//                       if (request.object.existed() == false) {
//                           let newUser = request.object;
//                       
//                           newUser.set("unansweredQuestionCount", 0);
//                           newUser.set("missedNotificationCount", 0);
//                           newUser.set("matchCount", 0);
//                           newUser.set("questionPrice", 0);
//                           newUser.set("accountBalance", "");
//                           newUser.set("bio", "");
//                           newUser.set("askAbout", "");
//                           newUser.set("tagline", "");
//                       }
//                       });


Parse.Cloud.afterSave("Answer", function(request) {
                         
                      if (request.object.existed() == false) {
                      
                          var Campfire = Parse.Object.extend("Campfire");
                          var newCampfire = new Campfire();
                      
                          var answer = request.object
                          var question = request.object.get("questionRef");
                      
                          question.set("isAnswered", true);
                      
                          newCampfire.set("answerRef", answer);
                          newCampfire.set("questionRef", question);
                          newCampfire.set("listenCount", 0);
                          newCampfire.set("likeCount", 0);
                      
                          newCampfire.save();
                      
                      
                          var currentUser = request.user
                          
                          var questionAsker = question.get("fromUser");
                          
                          questionAsker.fetch({
                                       success: function(user) {
                      
                              // setup a push to the question Asker
                              var pushQuery = new Parse.Query(Parse.Installation);
                              pushQuery.equalTo('deviceType', 'ios');
                              pushQuery.equalTo('user', questionAsker);
                              
                              var alert = "";
                              var firstName = currentUser.get('firstName');
                              var lastName = currentUser.get('lastName');
                              if (firstName) {
                              alert = firstName + " " + lastName + " just answered your question!";
                              }
                              
                              Parse.Push.send({
                                              where: pushQuery,
                                              data: {
                                              alert: alert,
                                              questionId: request.object.id
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
                          
                      
                      
                      }        
                      });


Parse.Cloud.afterSave("Like", function(request) {



    if (request.object.existed() == false) {

        console.log("SUCCESS getting the FROM USER!");
        // It's a new "Like"
        var campfireRef = request.object.get("campfireRef");
        campfireRef.fetch({
            success: function(campfire) {

                var questionRef = campfire.object.get("questionRef");
                questionRef.fetch({
                    success: function(question) {

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

                       //  var questionAnswerer = question.get("toUser");
                       //  questionAnswerer.fetch({
                       //     success: function(toUser) {
                       //
                       //      // Create and save a new "Like" activity
                       //      var Activity = Parse.Object.extend("Activity");
                       //      var newActivity2 = new Activity();
                       //      newActivity2.set("question", question);
                       //      newActivity2.set("campfire", campfire);
                       //      newActivity2.set("isRead", false);
                       //      newActivity2.set("toUser", toUser);
                       //      newActivity2.set("fromUser", request.user);
                       //      newActivity2.set("type", "likeToAnswerer");
                       //      newActivity2.save() //(null, { useMasterKey: true });
                       //
                       //
                       //      // setup a push to the question Asker
                       //      var pushQuery = new Parse.Query(Parse.Installation);
                       //      pushQuery.equalTo('deviceType', 'ios');
                       //      pushQuery.equalTo('user', toUser);
                       //
                       //      var alert = "";
                       //      var firstName = currentUser.get('firstName');
                       //      var lastName = currentUser.get('lastName');
                       //      if (firstName) {
                       //          alert = firstName + " " + lastName + " just liked your answer!";
                       //      }
                       //
                       //      Parse.Push.send({
                       //          where: pushQuery,
                       //          data: {
                       //              alert: alert,
                       //              questionId: question.id
                       //          }
                       //      }, {
                       //          useMasterKey: true,
                       //          success: function() {
                       //              // Push was successful
                       //          },
                       //          error: function(error) {
                       //              throw "PUSH: Got an error " + error.code + " : " + error.message;
                       //          }
                       //      });
                       //  },
                       //  useMasterKey: true,
                       //  error: function(object, error) {
                       //      console.log(error);
                       //      throw "Got an error " + error.code + " : " + error.message;
                       //    }
                       // });
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



Parse.Cloud.afterSave("Campfire", function(request) {
                      if (request.object.existed() == false) {
    
//                         var currentUser = request.user
    
                         var questionRef = request.object.get("questionRef");
                         questionRef.fetch({
                                   success: function(question) {
              
                                     var questionAsker = question.get("fromUser");
                                     questionAsker.fetch({
                                                 success: function(user) {
                                                
                                                 var Activity = Parse.Object.extend("Activity");
                                                 var newActivity1 = new Activity();
                                                 newActivity1.set("question", question);
                                                 newActivity1.set("campfire", request.object);
                                                 newActivity1.set("isRead", false);
                                                 newActivity1.set("toUser", user);
//                                                 newActivity1.set("fromUser", currentUser);
                                                 newActivity1.set("type", "youAskedTheyAnswered");
                                                 newActivity1.save(null, { useMasterKey: true });

//                                                  var newActivity2 = new Activity();
//                                                  newActivity2.set("question", question);
//                                                  newActivity2.set("campfire", request.object);
//                                                  newActivity2.set("isRead", false);
// //                                                 newActivity2.set("toUser", currentUser);
//                                                  newActivity2.set("fromUser", user);
//                                                  newActivity2.set("type", "youAnsweredTheyAsked");
//                                                  newActivity2.save(null, { useMasterKey: true });

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



Parse.Cloud.afterSave("Question", function(request) {

                      if (request.object.existed() == false) {
                          var toUser = request.object.get("toUser");
                      
                      
                          toUser.fetch({
                                       success: function(user) {
                                       
                                       var questCount = user.get("unansweredQuestionCount");
                                       
                                       if (questCount == null) {
                                          questCount = 0;
                                       }
                                       
                                       questCount++;
                                       user.set("unansweredQuestionCount", questCount);
                                       
                                       user.save(null, { useMasterKey: true });
                                       
                                       var currentUser = request.user
                                       
                                       var pushQuery = new Parse.Query(Parse.Installation);
                                       pushQuery.equalTo('deviceType', 'ios');
                                       pushQuery.equalTo('user', user);
                                       
                                       var alert = "";
                                       var firstName = currentUser.get('firstName');
                                       var lastName = currentUser.get('lastName');
                                       if (firstName) {
                                       alert = firstName + " " + lastName + " asked you a question.";
                                       }
                                       
                                       Parse.Push.send({
                                                       where: pushQuery,
                                                       data: {
                                                       alert: alert,
                                                       questionId: request.object.id
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
                          }
                          });


/*

var sendNewMessageNotification = function(userRef, notifierUserRef, conversationRef, messageRef, alertText) {
        //console.log("sendNewMessageNotification()");
    
    var notification = Parse.Object.extend("Notification");
    var newNotification = new notification();
    
    newNotification.set("userRef", userRef);
    newNotification.set("notifierUserRef", notifierUserRef);
    newNotification.set("conversationRef", conversationRef);
    newNotification.set("messageRef", messageRef);
    newNotification.set("type", "MESSAGE");
    newNotification.set("isRead", false);
    newNotification.set("text", alertText);
    newNotification.set("sendPush", true);
    
    newNotification.save(null, {useMasterKey: true}).then(
                                                          function() {
                                                          console.log(notifierUserRef.id + " sent a MESSAGE Notification to " + userRef.id);
                                                          },
                                                          function(error) {
                                                          console.error("Could not send MESSAGE Notification: " + error.message);
                                                          });
    
};




Parse.Cloud.afterSave("Message", function(request) {
                      
                      console.log("DEBUG: Message afterSave triggerred...");
                      var msg = request.object;
                      
                      var notifierUserRef = msg.get("userRef");
                      var conversationRef = msg.get("conversationRef");
                      var updatedAt = msg.get("updatedAt");
                      var createdAt = msg.get("createdAt");
                      var isNew = updatedAt.toTimeString() == createdAt.toTimeString();
                      
                      if (isNew) {
                      notifyAudience(notifierUserRef, conversationRef, msg);
                      }
                      
                      });
 
 */

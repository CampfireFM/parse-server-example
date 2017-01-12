
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});



Parse.Cloud.beforeSave(Parse.User, function(request, response) {
//                       Parse.Cloud.useMasterKey();
                       
                       if (request.object.existed() == false) {
                           let newUser = request.object;
                       
                           newUser.set("unansweredQuestionCount", 0);
                           newUser.set("missedNotificationCount", 0);
                           newUser.set("matchCount", 0);
                           newUser.set("questionPrice", 0);
                           newUser.set("accountBalance", "");
                           newUser.set("bio", "");
                           newUser.set("askAbout", "");
                           newUser.set("tagline", "");
                       }
                       });


Parse.Cloud.afterSave("Answer", function(request) {
                         
                      if (request.object.existed() == false) {
                      
                          var Campfire = Parse.Object.extend("Campfire");
                          var newCampfire = new Campfire();
                      
                          var answer = request.object
                          var question = request.object.get("questionRef");
                      
                          question.set("isAnswered", true)
                      
                          newCampfire.set("answerRef", answer);
                          newCampfire.set("questionRef", question);
                          newCampfire.set("listenCount", 0);
                          newCampfire.set("likeCount", 0);
                      
                          newCampfire.save();
                      
                      
                          var currentUser = request.user
                          
                          
                          var questionAsker = question.get("fromUser");
                          
                          questionAsker.fetch({
                                       success: function(user) {
                      
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
                                       
//                                       var Activity = Parse.Object.extend("Activity");
//                                       var newActivity = new Activity();
//                                       
//                                       newActivity.set("isRead", false);
//                                       newActivity.set("toUser", editor);
//                                       newActivity.set("fromUser", photographer);
//                                       newActivity.set("editedPhoto", editedPhoto);
//                                       newActivity.set("type", "like");
//                                       newActivity.save();
                                       
                                       
                                       
                                       
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

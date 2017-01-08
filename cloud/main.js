
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
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
                      }
                      
                          
                      });



Parse.Cloud.afterSave("Question", function(request) {
                         
                      if (request.object.existed() == false) {
                      var toUser = request.object.get("userRef");
                      toUser.fetch({
                                   success: function(object) {
                                   var questCount = toUser.get("unansweredQuestionCount");
                                   if (questCount == null) {
                                   questCount = 0;
                                   }
                                   newQs++;
                                   toUser.set("unansweredQuestionCount", questCount);
                                   toUser.save();
                                   },
                                   error: function(object, error) {
                                   throw "Got an error " + error.code + " : " + error.message;
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

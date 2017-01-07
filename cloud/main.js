
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});


Parse.Cloud.afterSave("Answer", function(request) {
//                          Parse.Cloud.useMasterKey();
                         
                          console.log(request.object.id + request.object + "trying after save")
                          var Campfire = Parse.object.extend("Campfire");
                          var campfire = new Campfire();
//                          campfire.answerRef = request.object;
//                          campfire.questionRef = request.object.get("questionRef");
                          campfire.save();
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

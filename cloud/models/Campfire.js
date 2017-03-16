
//begin of afterSave
Parse.Cloud.afterSave("Campfire", function(request) {
      if (request.object.existed() == false) {

            var questionRef = request.object.get("questionRef");
            questionRef.fetch({
                  useMasterKey: true,
                  success: function(question) {
                        var questionAsker = question.get("fromUser");
                        questionAsker.fetch({
                              useMasterKey: true,
                              success: function(user) {
                                    var Activity = Parse.Object.extend("Activity");
                                    var newActivity1 = new Activity();
                                    newActivity1.set("question", question);
                                    newActivity1.set("campfire", request.object);
                                    newActivity1.set("isRead", false);
                                    newActivity1.set("toUser", user);
                                    //newActivity1.set("fromUser", currentUser);
                                    newActivity1.set("type", "youAskedTheyAnswered");
                                    newActivity1.save(null, { useMasterKey: true });
                              },
                              error: function(object, error) {
                                    console.log(error);
                                    throw "Got an error " + error.code + " : " + error.message;
                              }
                        });
                  },
                  error: function(object, error) {
                        console.log(error);
                        throw "Got an error " + error.code + " : " + error.message;
                  }
            });
      }
});
//end of afterSave

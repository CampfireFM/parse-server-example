
Parse.Cloud.afterSave("Question", function(request) {

    if (request.object.existed() == false) {

        var toUser = request.object.get("toUser");
        toUser.fetch({
                     useMasterKey: true,
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
                     error: function(object, error) {
                        console.log(error);
                        throw "Got an error " + error.code + " : " + error.message;
                     }
                });
    }
});




var answer_methods = {};

//begin of afterSave function
Parse.Cloud.afterSave("Answer", function(request) {

    //check if its a new record.                     
    if (request.object.existed() == false) {

        var Campfire = Parse.Object.extend("Campfire");
        var newCampfire = new Campfire();

        var answer = request.object;
        var question = request.object.get("questionRef");

        var currentUser = request.user;
        var isTestUser = request.user.get("isTestUser");

        question.set("isAnswered", true);

        newCampfire.set("answerRef", answer);
        newCampfire.set("questionRef", question);
        newCampfire.set("listenCount", 0);
        newCampfire.set("likeCount", 0);
        newCampfire.set("flagCount", 0);
        newCampfire.set("isDummyData", false);
        newCampfire.set("isTest", isTestUser);

        newCampfire.save();

        //START HERE - TO BE UNCOMMENTED
        /*var questionAsker = question.get("fromUser");
        questionAsker.fetch({
            useMasterKey: true,
            //success callback function
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
            //error callback function
            error: function(object, error) {
                console.log(error);
                throw "Got an error " + error.code + " : " + error.message;
            }
        });*/
        //ENDS HERE - TO BE UNCOMMENTED
    }      
  
});
//end of afterSave function

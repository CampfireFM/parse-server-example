

var answer_methods = {};

//begin of afterSave function
Parse.Cloud.afterSave("Answer", function(request) {

    console.log("starting afterSave");
                      
    //check if its a new record.                     
    if (request.object.existed() == false) {
                      
                      console.log("it's new");

//        var Campfire = Parse.Object.extend("Campfire");
//        var newCampfire = new Campfire();

        var answer = request.object;
        var question = answer.get("questionRef");

        var currentUser = request.user;
                      
//        console.log("checking testUser values");
//        console.log(request.user.get("isTestUser"));
//                      
//        var answererIsTestUser = request.user.get("isTestUser");

        question.set("isAnswered", true);
                      
        console.log("starting question asker fetch");

//        newCampfire.set("answerRef", answer);
//        newCampfire.set("questionRef", question);
//        newCampfire.set("listenCount", 0);
//        newCampfire.set("likeCount", 0);
//        newCampfire.set("flagCount", 0);
//        newCampfire.set("isDummyData", false);
//        newCampfire.set("isTest", answererIsTestUser);
//
//        newCampfire.save();

        //START HERE - TO BE UNCOMMENTED
        
        console.log(question.get("fromUser"));
                      
        var questionAsker = question.get("fromUser");
        questionAsker.fetch({
            useMasterKey: true,
            success: function(user) {
                            
               console.log("new campfire started");
                            
                var Campfire = Parse.Object.extend("Campfire");
                var newCampfire = new Campfire();
                            
                newCampfire.set("answerRef", answer);
                newCampfire.set("questionRef", question);
                newCampfire.set("listenCount", 0);
                newCampfire.set("likeCount", 0);
                newCampfire.set("flagCount", 0);
                newCampfire.set("isDummyData", false);
                            
                            var isTestUser = false;
                            console.log("starting check");
                            
                            if (typeof request.user.get("isTestUser") !== 'undefined') {
                                isTestUser = request.user.get("isTestUser");
                                console.log(isTestUser);
                            };
                            
                            console.log("second check");
                            console.log(isTestUser);
                            
                            if (typeof user.get("isTestUser") !== 'undefined' && isTestUser == false) {
                                isTestUser = user.get("isTestUser");
                            };
                            
                            newCampfire.set("isTest", isTestUser);
                            
                            
                            
                /*if(answererIsTestUser == true || user.get("isTestUser") == true) {
                    newCampfire.set("isTest", true);
                } else {
                    newCampfire.set("isTest", false);
                }*/

                newCampfire.save(null, {useMasterKey: true});

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
        });
        //ENDS HERE - TO BE UNCOMMENTED
    }      
  
});
//end of afterSave function

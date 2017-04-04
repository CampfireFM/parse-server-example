

var answer_methods = {};

//begin of afterSave function
Parse.Cloud.afterSave("Answer", function(request) {

    console.log("starting afterSave");
                      
    //check if its a new record.                     
    if (request.object.existed() == false) {

        var answer = request.object;

        var currentUser = request.user;

        var questionRef = answer.get("questionRef");
        getQuestionAndItsPointers(questionRef.id,function(err_question, question) {
                                if(err_question){
                                request.log.error("FAILED IN QUESTION DETAILS FETCH");
                                request.log.error(JSON.stringify(err_question));
                                }else{
                            
                            console.log("new campfire started");
                                  
                            question.set("isAnswered", true);
                                  
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
                            
                            if (typeof currentUser.get("isTestUser") !== 'undefined') {
                                isTestUser = request.user.get("isTestUser");
                                console.log(isTestUser);
                            };
                            
                            console.log("second check");
                            console.log(isTestUser);
                            
                            let fromUser = question["fromUser"];
                            if (typeof fromUser.get("isTestUser") !== 'undefined' && isTestUser == false) {
                                isTestUser = user.get("isTestUser");
                            };
                            
                            newCampfire.set("isTest", isTestUser);
                            
                            newCampfire.save(null, {useMasterKey: true});
                                  

                            // setup a push to the question Asker
                            var pushQuery = new Parse.Query(Parse.Installation);
                            pushQuery.equalTo('deviceType', 'ios');
                            pushQuery.equalTo('user', fromUser);

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
          }
          });
        //ENDS HERE - TO BE UNCOMMENTED
    }      
  
});
//end of afterSave function



function getQuestionAndItsPointers(questionId,callback){
    
    var Question = Parse.Object.extend("Question");
    var query = new Parse.Query(Question);
    query.include(["toUser"]);
    query.equalTo("objectId",questionId);
    query.find({
               success: function(questions) {
               console.log(questions.length);
               console.log(questions[0]);
               return callback(null,questions[0]);
               },
               error: function(object, error) {
               console.log(error);
               return callback(error,null);
               }
               });
}






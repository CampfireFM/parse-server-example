

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
                                } else {
                                  
                                question.set("isAnswered", true);
                                question.save(null, { useMasterKey: true });
                                
                                // create and save a new Campfire
//                                saveCampfire(question, answer);
                                  
                                      
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
                              }
          });
        //ENDS HERE - TO BE UNCOMMENTED
        }
  
});
//end of afterSave function


func saveCampfire(question, answer) {
//    var Campfire = Parse.Object.extend("Campfire");
//    var newCampfire = new Campfire();
//    
//    newCampfire.set("answerRef", answer);
//    newCampfire.set("questionRef", question);
//    newCampfire.set("listenCount", 0);
//    newCampfire.set("likeCount", 0);
//    newCampfire.set("flagCount", 0);
//    newCampfire.set("isDummyData", false);
    
    
//    var questionAnswerer = question.get("toUser");
//    // see if either question user is a test user
//    var isTestUser = false;
//    
//    if (typeof questionAnswerer.get("isTestUser") !== 'undefined') {
//        isTestUser = questionAnswerer.get("isTestUser");
//        console.log(isTestUser);
//    }
//    
//    let fromUser = question.get("fromUser");
//    
//    if (isTestUser == false) {
//        if (!fromUser.get("isTestUser")) {
//                // isTestUser is Undefined")
//        } else {
//            isTestUser = fromUser.get("isTestUser");
//        }
//    }
    
//    newCampfire.set("isTest", isTestUser);
//    
//    newCampfire.save(null, { useMasterKey: true });
}



function getQuestionAndItsPointers(questionId,callback){
    
    var Question = Parse.Object.extend("Question");
    var query = new Parse.Query(Question);
    query.include(["toUser", "fromUser", "charity"]);
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






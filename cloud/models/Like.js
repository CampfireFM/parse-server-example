const {sendPush, addActivity} = require('../common');
Parse.Cloud.afterSave("Like", function(request) {

    if (request.object.existed() == false) {

        var currentUser = request.user;
        var objId_currentUser = request.user.id;

        console.log("SUCCESS on save");
        // It's a new "Like"
        var answerRef = request.object.get("answerRef");
        answerRef.fetch({
            success: function(answer) {

                console.log("SUCCESS getting answer");
                var questionRef = answer.get("questionRef");
                questionRef.fetch({
                    success: function(question) {

                        console.log("SUCCESS getting Question");
                        var usersQuery = new Parse.Query(Parse.User);
                        usersQuery.containedIn('objectId', [question.get('fromUser').id, question.get('toUser').id]);
                        usersQuery.find({useMasterkey : true}).then(function(users){
                            if(!users.length){
                                console.log('error fetching question info');
                                throw "Error fetching question info";
                            }
                            //Create 'like' Activity
                            addActivity('like', currentUser, users, question, answer);
                            //Send 'likes' push notification to question asker and answerer
                            sendPush(currentUser, users, 'likes');

                        }, function(error){
                            console.log(error);
                            throw "Got an error " + error.code + " : " + error.message;
                        })
                    },
                    useMasterKey: true,
                    error: function (object, error) {
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





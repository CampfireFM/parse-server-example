
Parse.Cloud.afterSave("Follow", function(request) {

    if (request.object.existed() == false) {

      var currentUser = request.user;
      var ToUser = request.object.get("toUser");
      ToUser.fetch({
            useMasterKey: true,
            success: function(toUser) {
            // Create and save a new "Follow" activity for the question Asker
            var Activity = Parse.Object.extend("Activity");
            var newActivity = new Activity();
            newActivity.set("isRead", false);
            newActivity.set("toUser", toUser);
            newActivity.set("fromUser", request.user);
            newActivity.set("type", "follow");
            newActivity.save(null, { useMasterKey: true });

            //Check for push subscription of like
            if(!checkPushSubscription(toUser, 'follows')){
                console.log('Question asker has not subscribed to receive follows notification yet');
                return;
            }

             // setup a push to the question Answerer
             var pushQuery = new Parse.Query(Parse.Installation);
             pushQuery.equalTo('deviceType', 'ios');
             pushQuery.equalTo('user', toUser);

             var alert = "";
             var firstName = currentUser.get('firstName');
             var lastName = currentUser.get('lastName');
             if (firstName) {
                alert = firstName + " " + lastName + " just followed you!";
             }

             Parse.Push.send({
                             where: pushQuery,
                             data: {
                                 alert: alert,
                                 userId: toUser.id
                             }
                             }, {
                             useMasterKey: true,
                             success: function() {
                                 console.log("Successful push to user for new follow");
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



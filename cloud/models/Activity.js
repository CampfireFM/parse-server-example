Parse.Cloud.afterSave("Activity", function(request) {

    if (request.object.existed() == false) {
        const fromUser = request.object.get('fromUser');
        const toUsers = request.object.get('toUsers');
        toUsers.forEach(function(user){
            //Check activity created by oneself
            if(user.id === fromUser.id)
                return;
            user.increment('missedNotificationCount', 1);
            user.save(null, {useMasterKey: true});
        });
    }
});



const mail = require('../../utils/mail');
const config = require('../../config');
var Mixpanel = require('mixpanel');
var isUpdating = false;
var oldEmail = '';
Parse.Cloud.afterSave(Parse.User, function(request, response) {
    const userEmail = request.object.get('email');
    const firstName = request.object.get('firstName');
    const lastName = request.object.get('lastName');

    if(!(userEmail != undefined && userEmail != '')) {
        return response.success("Email undefined");
    }

    //Init MixPanel
    var mixpanel = Mixpanel.init(config.mixpanelToken);
    //Add user to mailing list and send welcome email if new user or update mailing list
    //mixpanel.track("played_game");
    if(!isUpdating) {
        mail.sendWelcomeMail(userEmail);
        mail.updateMailingList(firstName, lastName, userEmail);
        //Add user to MixPanel
        mixpanel.people.set(request.object.get('username'), {
            $first_name: firstName,
            $last_name: lastName,
            $email: userEmail,
            $created: (new Date()).toISOString()
        });
    } else {
        mail.updateMailingList(firstName, lastName, oldEmail, userEmail);
        //Update user at mixpanel

        mixpanel.people.set(request.object.get('username'), {
            $first_name: firstName,
            $last_name: lastName,
            $email: userEmail
        });
    }


    response.success('ok');
});


Parse.Cloud.beforeSave(Parse.User, function(request, response) {

    const id = request.object.id;
    isUpdating = id !== undefined;

    if(isUpdating == true){
        var query = new Parse.Query(Parse.User);
        query.get(request.object.id, {useMasterKey : true}).then(function(result){
            if(result)
                oldEmail = result.get('email');
            else
                oldEmail = undefined;
            if(oldEmail == undefined)
                isUpdating = false;
            response.success('ok');
        }, function(err){
            console.log(err.message);
            response.error(err);
        });
    } else {
        response.success('ok');
    }
});
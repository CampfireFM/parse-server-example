const mail = require('../../utils/mail');
const config = require('../../config');
var Mixpanel = require('mixpanel');
var oldEmail = '';
Parse.Cloud.afterSave(Parse.User, function(request, response) {
    const userEmail = request.object.get('email');
    const firstName = request.object.get('firstName');
    const lastName = request.object.get('lastName');

    if(!(userEmail != undefined && userEmail != '')) {
        if(request.object.get('isWelcomeEmailSent') != undefined)
            return;
        request.object.set('isWelcomeEmailSent', false);
        request.object.save(null, {useMasterKey : true});
        return response.success("Email undefined");
    }

    //Init MixPanel
    var mixpanel = Mixpanel.init(config.mixpanelToken);
    //Add user to mailing list and send welcome email if new user or update mailing list
    //mixpanel.track("played_game");

    //Check if it's first time user signs up to Campfire.
    var isNewToCampfire = false;
    if(request.object.get('isWelcomeEmailSent') == true){
        //Already has account
        isNewToCampfire = false;
    } else {
        //New to campfire, consider email or social login
        if (request.object.existed() == false && userEmail) //email sign up
            isNewToCampfire = true;
        if (request.object.existed() == true && request.object.get('isWelcomeEmailSent') != true) //facebook or twitter login
            isNewToCampfire = true;
    }

    if(isNewToCampfire) {
        mail.sendWelcomeMail(userEmail);
        mail.updateMailingList(firstName, lastName, userEmail);
        //Add user to MixPanel
        mixpanel.people.set(request.object.get('username'), {
            $first_name: firstName,
            $last_name: lastName,
            $email: userEmail,
            $created: (new Date()).toISOString()
        });
        request.object.set('isWelcomeEmailSent', true);
        request.object.save(null, {useMasterKey : true});
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
const mail = require('../../utils/mail');

var isUpdating = false;
var oldEmail = '';
Parse.Cloud.afterSave(Parse.User, function(request, response) {
    const userEmail = request.object.get('email');
    const firstName = request.object.get('firstName');
    const lastName = request.object.get('lastName');

    if(!(userEmail != undefined && userEmail != "")) {
        return response.success("Email undefined");
    }

    //Add user to mailing list and send welcome email if new user or update mailing list
    if(!isUpdating) {
        mail.sendWelcomeMail(userEmail);
        mail.updateMailingList(firstName, lastName, userEmail);
    } else {
        mail.updateMailingList(firstName, lastName, oldEmail, userEmail);
    }
    response.success('ok');
});


Parse.Cloud.beforeSave(Parse.User, function(request, response) {

    const userEmail = request.object.get('email');
    isUpdating = userEmail !== undefined;
    console.log(userEmail);
    console.log(isUpdating);
    if(isUpdating == true){
        var query = new Parse.Query(Parse.User);
        query.get(request.object.id, {useMasterKey : true}).then(function(result){
            if(result)
                oldEmail = result.get('email');
            else
                oldEmail = '';
            response.success('ok');
        }, function(err){
            console.log(err.message);
            response.error(err);
        });
    } else {
        response.success('ok');
    }
});
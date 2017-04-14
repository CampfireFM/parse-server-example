var config = require('../../config.js');
var mailgun = require('mailgun-js');

Parse.Cloud.afterSave(Parse.User, function(request, response) {
    console.log('Sending email test');
    const userEmail = request.object.get('email');
    const firstName = request.object.get('firstName');
    const lastName = request.object.get('lastName');

    if(!(userEmail != undefined && userEmail != "")) {
        return response.success("Email undefined");
    }
    // Get access to Parse Server's cache
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];

    // Invoke the send method with an options object
    MailgunAdapter.send({
        templateName: 'welcomeEmail',
        recipient: userEmail,
        variables: { serverUrl: config.baseURL,
            wrapIconUrl : function(){
                return function(text, render){
                    return '<img src=' + `"${render(text)}"` + 'alt="" border="0" width="30" height="30" style="display:block; border:none; outline:none; text-decoration:none;">';
                }
            },
            wrapLogoUrl : function(){
                return function(text, render){
                    return '<img src=' + `"${render(text)}"` + 'alt="" border="0" width="169" height="200" style="display:block; border:none; outline:none; text-decoration:none;">';
                }
            }
        } // {{alert}} will be compiled to 'New posts'
    });

    // Add user to the mailing list
    var mailgun = require('mailgun-js')({apiKey: config.mailgun.apiKey, domain: config.mailgun.domain});

    var userList = mailgun.lists(config.mailgun.listAddress);

    var user = {
        subscribed: true,
        address: userEmail,
        name: firstName + ' ' + lastName
    };

    userList.members().create(user, function (err, data) {
        // `data` is the member details
        console.log(data);
    });

    response.success('OK');
});
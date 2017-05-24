var config = require('../config.js');
var mailgun = require('mailgun-js');

function sendWelcomeMail(userEmail){
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
        }
    });
}

function updateMailingList(firstName, lastName, oldEmail, newEmail) {

    // Add user to the mailing list
    var mailgun = require('mailgun-js')({apiKey: config.mailgun.apiKey, domain: config.mailgun.domain});

    var userList = mailgun.lists(config.mailgun.listAddress);

    //Add or update user to mailing list
    if(newEmail == undefined){

        const user = {
            subscribed: true,
            address: oldEmail,
            name: firstName + ' ' + lastName
        };

        userList.members().create(user, function (err, data) {
            // `data` is the member details
            console.log(data);
        });
    } else {
        const user = {
            name: firstName + ' ' + lastName,
            address: newEmail
        }
        userList.members(oldEmail).update(user, function(err, body){
            console.log(body);
        });
    }
}

function sendSummaryEmail(recipient, summaries){
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];

    // Invoke the send method with an options object
    MailgunAdapter.send({
        templateName: 'summaryEmail',
        recipient: recipient,
        variables: {
            summaries,
            buildLinkButton : function(){
                return function(text, render){
                    return `<a class="LinkButton" href="${render(text)}">Watch in Campfire</a>`
                }
            },
            buildUserProfilePhoto : function(){
                return function(text, render){
                    return `<div class="profile-photo" background-image="${render(text)}" style="background-image: url(&quot;${render(text)}&quot;); background-repeat: no-repeat;"></div>`
                    //return `<img style="float: top;" class="profile-photo" src="${render(text)}" alt="interactive connection" width="45" />`
                }
            }
        }
    });
}

function sendFollowEmail(recipient, followerProfilePhoto, followerUsername){
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];

    // Invoke the send method with an options object
    MailgunAdapter.send({
        templateName: 'followEmail',
        recipient: recipient,
        variables: {
            followerProfilePhoto,
            followerUsername,
            buildUserProfilePhoto : function(){
                return function(text, render){
                    return `<img height="100" width="100" alt="Please enable images to view this content" border="0" hspace="0" src="${render(text)}" style="border-radius: 20rem; color: #000000; font-size: 0.8rem; margin: 0; padding: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: 3px solid white; margin-top:3rem; display: block;" title="New Follower image" vspace="0" width="560">`
                    //return `<img style="float: top;" class="profile-photo" src="${render(text)}" alt="interactive connection" width="45" />`
                }
            }
        }
    });
}

function sendQuestionEmail(recipient, questionAskerProfilePhoto, questionAskerUsername, questionText){
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];

    // Invoke the send method with an options object
    MailgunAdapter.send({
        templateName: 'questionEmail',
        recipient: recipient,
        variables: {
            questionAskerProfilePhoto,
            questionAskerUsername,
            questionText,
            buildUserProfilePhoto : function(){
                return function(text, render){
                    return `<div class="profile-photo" background-image="${render(text)}" style="background-image: url(&quot;${render(text)}&quot;); background-repeat: no-repeat;"></div>`
                    //return `<img style="float: top;" class="profile-photo" src="${render(text)}" alt="interactive connection" width="45" />`
                }
            }
        }
    });
}

function sendAnswerEmail(recipient, questionAnswererProfilePhoto, questionAnswererUsername, questionText){
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];

    // Invoke the send method with an options object
    MailgunAdapter.send({
        templateName: 'answerEmail',
        recipient: recipient,
        variables: {
            questionAnswererProfilePhoto,
            questionAnswererUsername,
            questionText,
            buildUserProfilePhoto : function(){
                return function(text, render){
                    return `<div class="profile-photo" background-image="${render(text)}" style="background-image: url(&quot;${render(text)}&quot;); background-repeat: no-repeat;"></div>`
                    //return `<img style="float: top;" class="profile-photo" src="${render(text)}" alt="interactive connection" width="45" />`
                }
            }
        }
    });
}
module.exports = {sendWelcomeMail, updateMailingList, sendSummaryEmail, sendFollowEmail, sendQuestionEmail, sendAnswerEmail};
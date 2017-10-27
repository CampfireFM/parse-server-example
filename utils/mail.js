var config = require('../config.js');
var mailgun = require('mailgun-js');
const branch = require('node-branch-io');
const wrapper = require('co-express');
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

function sendSummaryEmail(recipient, summaries, moreAnswersCount){
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];

    // Generate branch.io links
    wrapper(function*() {
        let links = [];
        for (let i = 0; i < summaries.length; i++) {
            const link = yield branch.link.create(config.branchKey, {
                channel: '',
                feature: '',
                data: {
                    answerId: summaries[i].answerId
                }
            });
            links.push(link.url);
            summaries[i].link = link.url;
        }
        console.log(links);
        // Invoke the send method with an options object
        MailgunAdapter.send({
            templateName: 'summaryEmail',
            recipient: recipient,
            variables: {
                summaries,
                moreAnswersCount,
                buildLinkButton : function(){
                    return function(text, render){
                        return `<a target="_blank" class="buttonA" style="text-decoration:none; color: #FFFFFF; font-family: sans-serif; font-size: 0.9rem; font-weight: 500; line-height: 3rem;  padding: 0.5rem 0.9rem;  border-radius: 0.5rem; margin:1rem 0;" href="${render(text)}">Eavesdrop on Campfire</a>`
                    }
                },
                buildUserProfilePhoto : function(){
                    return function(text, render){
                        return `<img alt="H" border="0" height="70" width="70" hspace="0" src="${render(text)}" style="border-radius: 20rem; padding: 0; margin: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: none; display: block; color: #000000;" title="Highly compatible" vspace="0" width="50">`
                        //return `<img style="float: top;" class="profile-photo" src="${render(text)}" alt="interactive connection" width="45" />`
                    }
                }
            }
        });
    })();
}

function sendFollowEmail(recipient, followerProfilePhoto, followerUsername){
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];
    //Build deep link
    branch.link.create(config.branchKey, {
        channel: '',
        feature: '',
        data: {
            tag: 'follow'
        }
    }).then(function(link) {
        // Invoke the send method with an options object
        MailgunAdapter.send({
            templateName: 'followEmail',
            recipient: recipient,
            variables: {
                followerProfilePhoto,
                followerUsername,
                buildUserProfilePhoto: function () {
                    return function (text, render) {
                        return `<img height="100" width="100" alt="Please enable images to view this content" border="0" hspace="0" src="${render(text)}" style="border-radius: 20rem; color: #000000; font-size: 0.8rem; margin: 0; padding: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: 3px solid white; margin-top:3rem; display: block;" title="New Follower image" vspace="0" width="560">`
                    }
                },
                buildAppLink: function () {
                    return function (text, render) {
                        return `<a target="_blank" style="text-decoration:none; color: #FFFFFF; font-family: sans-serif; font-size: 1rem; font-weight: 400; line-height: 120%;" href="${link.url}"> Go to app </a>`;
                    }
                }
            }
        });
    });
}

function sendQuestionEmail(recipient, questionId, questionAskerProfilePhoto, questionAnswererUsername, questionText, questionPrice){
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];

    //Build deep link
    branch.link.create(config.branchKey, {
        channel: '',
        feature: '',
        data: {
            tag: 'question'
        }
    }).then(function(link){
        // Invoke the send method with an options object
        questionPrice = Math.floor((questionPrice / 2) * Math.pow(10, 4)) / Math.pow(10, 4);
        MailgunAdapter.send({
            templateName: 'questionEmail',
            recipient: recipient,
            variables: {
                questionAskerProfilePhoto,
                questionAnswererUsername,
                questionText,
                questionPrice,
                questionId,
                buildUserProfilePhoto : function(){
                    return function(text, render){
                        return `<img height="100" width="100" alt="Please enable images to view this content" border="0" hspace="0" src="${render(text)}" style="border-radius: 20rem; color: #000000; font-size: 0.8rem; margin: 0; padding: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: 3px solid white; margin-top:3rem; display: block;" title="Hero Image" vspace="0" width="560">`
                    }
                },
                buildDeepLink: function(){
                    return function(text, render){
                        return `<a href="${link.url}" style="color: #F16F00; font-family: Nunito, Helvetica, sans-serif; font-size: 1.1rem; font-weight: 400; line-height: 160%;" target="_blank">`
                    }
                },
                buildLinkButton: function() {
                    return function(text, render){
                        return `<a target="_blank" style="text-decoration:none; color: #FFFFFF; font-family: sans-serif; font-size: 1rem; font-weight: 400; line-height: 120%;" href="${link.url}">`;
                    }
                }
            }
        });
    });
}
// sendAnswerEmail('ericwebb85@yahoo.com', '', 'Test', 'Test question', '7p3Jj3aBu7');
function sendAnswerEmail(recipient, questionAnswererProfilePhoto, questionAnswererUsername, questionText, answerId){
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];

    //Build deep link
    branch.link.create(config.branchKey, {
        channel: '',
        feature: '',
        data: {
            answerId: answerId
        }
    }).then(function(link) {

        // Invoke the send method with an options object
        MailgunAdapter.send({
            templateName: 'answerEmail',
            recipient: recipient,
            variables: {
                questionAnswererProfilePhoto,
                questionAnswererUsername,
                questionText,
                buildUserProfilePhoto: function () {
                    return function (text, render) {
                        return `<img height="100" width="100" alt="Please enable images to view this content" border="0" hspace="0" src="${render(text)}" style="border-radius: 20rem; color: #000000; font-size: 0.8rem; margin: 0; padding: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; border: 3px solid white; margin-top:3rem; display: block;" title="New Follower image" vspace="0" width="560">`
                    }
                },
                buildQuestionLink: function() {
                    return function (text, render) {
                        return `<a href="${link.url}" style="color: #F16F00; font-family: Nunito, Helvetica, sans-serif; font-size: 1.1rem; font-weight: 400; line-height: 160%;" target="_blank">`
                    }
                },
                buildAnswerLink: function() {
                    return function (text, render) {
                        return `<a target="_blank" style="text-decoration:none; color: #FFFFFF; font-family: sans-serif; font-size: 1rem; font-weight: 400; line-height: 120%;" href="${link.url}">Hear Answer </a>`;
                    }
                }
            }
        });
    });
}

function sendAdminSummaryEmail(recipient, data) {
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];
    // Invoke the send method with an options object
    MailgunAdapter.send({
        templateName: 'adminSummaryEmail',
        recipient: recipient,
        variables: data
    });
}

function sendTransactionFailureEmail(recipient, data) {
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];
    // Invoke the send method with an options object
    MailgunAdapter.send({
        templateName: 'transactionFailureEmail',
        recipient: recipient,
        variables: data
    });
}

function sendWarningEmail(recipient, data) {
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];
    // Invoke the send method with an options object
    MailgunAdapter.send({
        templateName: 'warningEmail',
        recipient: recipient,
        variables: data
    });
}

function sendCashoutEmail(recipient, data) {
    const { AppCache } = require('parse-server/lib/cache');
    // Get a reference to the MailgunAdapter
    // NOTE: It's best to do this inside the Parse.Cloud.define(...) method body and not at the top of your file with your other imports. This gives Parse Server time to boot, setup cloud code and the email adapter.
    const MailgunAdapter = AppCache.get(config.appId)['userController']['adapter'];
    // Invoke the send method with an options object
    MailgunAdapter.send({
        templateName: 'cashoutEmail',
        recipient: recipient,
        variables: data
    });
}
module.exports = {sendCashoutEmail, sendWarningEmail, sendWelcomeMail, updateMailingList, sendSummaryEmail, sendFollowEmail, sendQuestionEmail, sendAnswerEmail, sendAdminSummaryEmail, sendTransactionFailureEmail};
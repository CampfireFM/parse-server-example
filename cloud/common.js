const phantom = require('phantom');
const Twilio = require('twilio');
const config = require('../config');
const Promise = require('promise');
const logTexts = {
    questions : 'Question answerer has not subscribed to receive questions notification yet',
    expiringQuestions: 'Answerer has not subscribed to receive expiring questions notification yet',
    unlocks : 'Question asker/answerer has not subscribed to receive unlocks notification yet',
    answers : 'Question asker has not subscribed to receive answers sms yet',
    likes : 'Question ansker/answerer has not subscribed to receive likes notification yet',
    follows : 'The user has not subscribed to receive follows notification yet',
    earnings : 'The user has not subscribed to receive earnings notification yet'
};
const branch = require('node-branch-io');
const subscriptionTypes = ['questions', 'unlocks', 'answers', 'likes', 'follows', 'earnings'];
const campfireAutoPushTypes = ['friendMatch', 'joinCampfire', 'expiringQuestions'];

const activityTypes = ['follow', 'unlock', 'like', 'answer', 'question'];

const logoImageUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/logo.png';
const backgroundCharityImageUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/background-charity.png';
const backgroundNoCharityImageUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/background-nocharity.png';
const listenUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/listen.png';
const defaultAvatarUrl = 'https://campfiremedia.herokuapp.com/parse/files/maryhadalittlelamb/cdfa632577c4636d3a93d83cd88407ce_default_avatar.png';
const backgroundAnswerCharityImageUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/background-listen-charity.png';
const backgroundAnswerNoCharityImageUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/background-listen-nocharity.png';

function checkPushSubscription(user, type){
    var pushSubscriptions = user.get('pushSubscriptions');

    //Search subscription type in array
    if(pushSubscriptions == undefined || pushSubscriptions.indexOf(type) == -1)
        return false;
    return true;
}

function checkSMSSubscription(user, type){
    var smsSubscriptions = user.get('smsSubscriptions');

    //Search subscription type in array
    if(smsSubscriptions == undefined || smsSubscriptions.indexOf(type) == -1)
        return false;
    return true;
}
function checkEmailSubscription(user, type){
    var emailSubscriptions = user.get('emailSubscriptions');

    //Search subscription type in array
    if(emailSubscriptions == undefined || emailSubscriptions.indexOf(type) == -1)
        return false;
    return true;
}

/**
 * @Description This common function is used to send push notifications to toUsers with 'type'
 * @param currentUser - The user object in request where this is called
 * @param toUsers - The users who will receive push notification
 * @param type - subscription type of 'questions','answers','unlocks','likes','follows','earnings', campfire push notification of
 *               'friendMatch', 'joinCampfire'
 */
function sendPushOrSMS(currentUser, toUsers, type, additionalData){
    if(toUsers.length === undefined){
        toUsers = [toUsers];
    }

    if(type == undefined || type === ''){
        return;
    }

    toUsers.forEach(function(user){
        if (currentUser && (user.id == currentUser.id))
            return;
        if (subscriptionTypes.indexOf(type) !== -1) {
            if (!checkPushSubscription(user, type) && !checkSMSSubscription(user, type))
                return console.log(logTexts[type]);
        } else if(campfireAutoPushTypes.indexOf(type) === -1){
            return console.log('Unknown push type, no push notification sent');
        }
        // setup a push to the question Asker
        var pushQuery = new Parse.Query(Parse.Installation);
        pushQuery.equalTo('deviceType', 'ios');
        pushQuery.equalTo('user', user);

        //Compose alert text to be sent
        var alert = "";
        var badge = 0;

        const fullName = currentUser ? currentUser.get('fullName') : '';
        switch(type) {
            case 'questions' :
                alert = fullName + ' asked you a new question.';
                badge = 1;
                break;
            case 'expiringQuestions' :
                if (additionalData > 1)
                    alert = `You have ${additionalData} questions expiring in the next 24 hours, hurry up!`;
                else
                    alert = `You have a question expiring in the next 24 hours, hurry up!`;
                break;
            case 'answers' :
                alert = fullName + ' answered your question on Campfire!';
                badge = 1;
                break;
            case 'unlocks' :
                alert = fullName + ' unlocked your question & answer.';
                break;
            case 'follows' :
                alert = fullName + ' just followed you.';
                break;
            case 'likes' :
                alert = fullName + ' just liked your question & answer.';
                break;
            case 'earnings' :
                alert = 'You earned money!';
                break;
            case 'friendMatch' :
                alert = 'Your friend ' + fullName + ' is syncing you.';
                break;
            case 'joinCampfire' :
                alert = 'Your friend ' + fullName + ' joined campfire! Go ask them a question.';
                break;
        }

        //Send push notification to ios devices
        if(checkPushSubscription(user, type) || (campfireAutoPushTypes.indexOf(type) > -1)) {
            
            var data = {
                alert: alert
            }

            if (badge > 0)
                data.badge = badge

            Parse.Push.send({
                where: pushQuery,
                data: data
                // data: {
                //     alert: alert,
                //     tag: tag, 
                //     badge: badge
                // }
            }, {
                useMasterKey: true,
                success: function () {
                    // Push was successful
                },
                error: function (error) {
                    throw "PUSH: Got an error " + error.code + " : " + error.message;
                }
            });
        }
        if(checkSMSSubscription(user, type)) {
            // Twilio Credentials
            var accountSid = config.twilio.accountSid;
            var authToken = config.twilio.authToken;

            //require the Twilio module and create a REST client
            var client = Twilio(config.twilio.accountSid, config.twilio.authToken);

            if(user.get('phoneNumber') === undefined){
                console.log('User has not registerd phone number yet');
            } else {
                //Build deep link
                branch.link.create(config.branchKey, {
                    channel: '',
                    feature: '',
                    data: {
                        answerId: additionalData
                    }
                }).then(function(link) {
                    alert += `\n ${link.url}`;
                    client.messages.create({
                        to: user.get('phoneNumber'),
                        from: config.twilio.number,
                        body: alert
                    }, function (err, message) {
                        if (err)
                            console.log(err.message);
                        else
                            console.log(message.sid);
                    });
                }).catch(function(err){
                    console.log('Failed to create deep link for answer : ', err);
                    throw 'Got an error while looking for withdrawal object ' + err.code + ' : ' + err.message;
                })
            }
        }
    });
}

/**
 * @Description common function to add activities to Activity class
 * @param type - One of 'follow', 'unlock', 'like', 'answer', 'question'
 * @param question
 * @param answer
 * @param fromUser
 * @param toUsers
 */
function addActivity(type, fromUser, toUsers, question, answer){

    if(activityTypes.indexOf(type) === -1){
        return console.log("Unknown action");
    }

    if(toUsers.length === undefined)
        toUsers = [toUsers];
    var Activity = Parse.Object.extend('Activity');
    // Remove fromUser from toUsers
    const filteredToUsers = [];
    toUsers.forEach(user => {
        if (user.id != fromUser.id)
            filteredToUsers.push(user);
    });
    var newActivity = new Activity();
    newActivity.set('isRead', false);
    newActivity.set('toUsers', filteredToUsers);
    newActivity.set('fromUser', fromUser);
    newActivity.set('type', type);
    if(type !== 'follow'){
        newActivity.set('question', question);
        newActivity.set('answer', answer);
    }
    newActivity.save(null, {useMasterKey: true});
}

/**
 * @Description Convert question parse object to algolia object
 * @param questions
 */
function parseToAlgoliaObjects(objects){
    if(objects.length == undefined)
        objects = [objects];
    var algoliaObjects = objects.map(function(obj){
        var object = obj.toJSON();
        object.objectID = obj.id;

        return object;
    });
    return algoliaObjects;
}

function getShareImageAndExistence(user, charity) {
    return new Promise((resolve, reject) => {
        const ShareImage = Parse.Object.extend('ShareImage');
        const query = new Parse.Query(ShareImage);
        query.equalTo('userRef', user);
        query.equalTo('charityRef', charity);
        query.include(['charityRef', 'userRef']);
        query.first({useMasterKey: true}).then(function(shareImage) {
            if (!shareImage) {
                return resolve({isExisting: false});
            }
            if (charity) {
                if (charity.get('image').name() === shareImage.get('charityRef').get('image').name()
                    && (user.get('profilePhoto') && user.get('profilePhoto').name()) === (shareImage.get('userRef').get('profilePhoto') && shareImage.get('userRef').get('profilePhoto').name()))
                    return resolve({isExisting: true, shareImage});
                return resolve({isExisting: false, shareImage});
            } else {
                if ((user.get('profilePhoto') && user.get('profilePhoto').name()) === (shareImage.get('userRef').get('profilePhoto') && shareImage.get('userRef').get('profilePhoto').name()))
                    return resolve({isExisting: true, shareImage});
                else
                    return resolve({isExisting: false, shareImage});
            }
        }, function(err) {
            reject(err);
        });
    });
}

function generateShareImage(userId) {
    return new Promise((resolve, reject) => {

        const userQuery = new Parse.Query(Parse.User);
        userQuery.include(['charityRef']);
        userQuery.get(userId, {useMasterKey: true}).then(function (user) {
            const charity = user.get('charityRef');
            getShareImageAndExistence(user, charity)
                .then(({isExisting, shareImage}) => {
                    (function generateSocialImage() {
                        if (!isExisting) {
                            let sitepage = null;
                            let phInstance = null;
                            let attempts = 0;
                            const MAX_ATTEMPTS = 5;
                            phantom.create()
                                .then(instance => {
                                    phInstance = instance;
                                    return instance.createPage();
                                })
                                .then(page => {
                                    sitepage = page;
                                    return page.property('viewportSize', {width: 1024, height: 512});
                                })
                                .then(() => {
                                    return sitepage.property('content', '<html><head></head><body><div id="test"><canvas id="canvas" width="1024px" height="512px"></canvas></div></body>')
                                })
                                .then(() => {
                                    let charityImageUrl;
                                    let backgroundImageUrl;
                                    let charityOrgName;
                                    if (charity) {
                                        charityImageUrl = charity.get('image').url();
                                        backgroundImageUrl = backgroundCharityImageUrl;
                                        charityOrgName = charity.get('name');
                                    } else {
                                        charityImageUrl = listenUrl;
                                        backgroundImageUrl = backgroundNoCharityImageUrl;
                                    }
                                    let profilePhotoUrl;
                                    if (user.get('profilePhoto'))
                                        profilePhotoUrl = user.get('profilePhoto').url();
                                    else
                                        profilePhotoUrl = defaultAvatarUrl;

                                    sitepage.evaluate(generateImage, profilePhotoUrl, charityImageUrl, logoImageUrl, backgroundImageUrl, charityOrgName).then();

                                    setTimeout(() => {
                                        sitepage.evaluate(function () {
                                            if (window.isLoaded)
                                                return document.getElementById('canvas').toDataURL();
                                            return 'NOT_LOADED';
                                        }).then(res => {
                                            const t = res;
                                            console.log(t.substr(0, 10));
                                            if (t !== 'NOT_LOADED') {
                                                // Save share image
                                                if (!shareImage) {
                                                    const newShareImage = new Parse.Object('ShareImage');
                                                    newShareImage.set('userRef', user);
                                                    if (charity)
                                                        newShareImage.set('charityRef', charity);
                                                    var file = new Parse.File('social' + '.png', {base64: t}, 'image/png');
                                                    newShareImage.set('image', file);
                                                    newShareImage.save(null, {useMasterKey: true}).then((shareImage) => {
                                                        phInstance.exit();
                                                        resolve(shareImage.get('image').url());
                                                    }, err => {
                                                        console.log(err);
                                                        phInstance.exit();
                                                        reject(err);
                                                    });
                                                    console.log(`Creating share image for ${user.get('fullName')}`);
                                                } else {
                                                    var file = new Parse.File('social' + '.png', {base64: t}, 'image/png');
                                                    shareImage.set('image', file);
                                                    shareImage.save(null, {useMasterKey: true}).then(() => {
                                                        resolve(shareImage.get('image').url());
                                                        phInstance.exit();
                                                    }, err => {
                                                        console.log(err);
                                                        phInstance.exit();
                                                        reject(err);
                                                    });
                                                    console.log(`Updating share image for ${user.get('fullName')}`);
                                                }
                                            } else {
                                                console.log(`Retrying to generate share image for ${user.get('fullName')}`);
                                                attempts++;
                                                if (attempts > MAX_ATTEMPTS)
                                                    return reject(new Error(`Can not generate share image for ${user.get('fullName')}`))
                                                generateSocialImage();
                                            }
                                        })
                                    }, 5000);
                                })
                                .catch(err => {
                                    console.log(err);
                                    reject(err);
                                })
                        } else {
                            console.log('Skipping to generate image that already exists');
                            resolve(shareImage.get('image').url());
                        }
                    })();
                })
                .catch(err => {
                    console.log(err);
                    reject(err);
                })
        }, function (err) {
            console.log(err);
            reject(err);
        })
    });
}

function generateImage(profilePhoto, coverPhoto, logoUrl, backUrl, charityName) {
    window.isLoaded = false;
    const isCharity = !!charityName;
    var canvas = document.getElementById("canvas");

    var ctx = canvas.getContext("2d");
    console.log(backUrl);
    var img2 = loadImage(backUrl, drawBackground);
    var img1, img3, img4;
    const width = 1024;
    const height = 512;
    const widthUnit = width / 10;
    const radius = widthUnit;
    const centerY = isCharity ? height * 2 / 3 : height * 0.613;
    var loadedImages = 0;

    function checkAndUploadShareImage() {
        if (loadedImages === 3) {
            // const xhr = new XMLHttpRequest();
            // console.log(xhr);
            // xhr.open("POST", "http://4f3b72cb.ngrok.io/uploadSocialImage");
            // xhr.setRequestHeader("Content-Type", "application/json");
            // const data = canvas.toDataURL();
            // // xhr.send(JSON.stringify({ userId: userId, charityId:charityId , base64Image: canvas.toDataURL()}));
            // xhr.send(JSON.stringify({ userId: "SSJQ8mW13x", base64Image: data}));
            window.isLoaded = true;
        }
    }
    function drawBackground() {
        ctx.save();
        ctx.drawImage(img2, 0, 0, width, height);
        ctx.font = '36px Nunito,sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        if (isCharity) {
            if (charityName.length > 12)
                ctx.font = '29px Nunito,sans-serif';
            ctx.fillText('Ask me a question, support ' + charityName, width / 2, height * 1.7 / 5);

        }
        ctx.restore();
        img1 = loadImage(profilePhoto, drawProfilePhoto);
        img3 = loadImage(coverPhoto, drawCharity);
        img4 = loadImage(logoUrl, drawCampfireLogo);
    }

    function drawCampfireLogo() {
        ctx.save();
        ctx.beginPath();

        ctx.arc(widthUnit * 2, centerY, radius - 3, 0, Math.PI * 2, true);

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img4, widthUnit * 2 - radius + 3, centerY - radius, radius * 2, radius * 2);

        ctx.restore();
        loadedImages++;
        checkAndUploadShareImage();
    }

    function drawProfilePhoto() {

        ctx.save();
        ctx.beginPath();
        ctx.arc(widthUnit * 5 + 0.5, centerY, radius - 3, 0, Math.PI * 2, true);

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img1, widthUnit * 5 - radius + 3, centerY - radius, radius * 2, radius * 2);

        ctx.restore();
        loadedImages++;
        checkAndUploadShareImage();
    }

    function drawCharity() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(widthUnit * 8 + 1.5, centerY, radius - 3, 0, Math.PI * 2, true);

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img3, widthUnit * 8 - radius + 3, centerY - radius, radius * 2, radius * 2);

        ctx.restore();
        loadedImages++;
        checkAndUploadShareImage();
    }

    function loadImage(src, onload) {
        var img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = onload;
        img.src = src;
        return img;
    }
}

function generateAnswerShareImage(answerId) {
    return new Promise((resolve, reject) => {

        const Answer = Parse.Object.extend('Answer');
        const answerQuery = new Parse.Query(Answer);
        answerQuery.equalTo('objectId', answerId);
        answerQuery.include(['questionRef.fromUser', 'questionRef.toUser', 'questionRef.charity']);
        answerQuery.first({useMasterKey: true}).then(function(answer) {
            const question = answer.get('questionRef');
            if (!question)
                return reject('Can not find question');
            const questionText = question.get('text');
            if (!question.get('fromUser') || !question.get('fromUser').get('profilePhoto'))
                return reject('Can not find fromUser');
            if (!question.get('toUser') || !question.get('toUser').get('profilePhoto'))
                return reject('Can not find toUser');
            const askerPhoto = question.get('fromUser').get('profilePhoto').url();
            const askerName = question.get('fromUser').get('fullName');
            const answererPhoto = question.get('toUser').get('profilePhoto').url();
            const answererName = question.get('toUser').get('fullName');
            const charity = question.get('charity');
            let backUrl = backgroundAnswerNoCharityImageUrl;
            let charityImage;
            if (charity) {
                backUrl = backgroundAnswerCharityImageUrl;
                charityImage = charity.get('image').url();
            }
            (function generateImage() {
                let sitepage = null;
                let phInstance = null;
                let attempts = 0;
                const MAX_ATTEMPTS = 5;
                phantom.create()
                    .then(instance => {
                        phInstance = instance;
                        return instance.createPage();
                    })
                    .then(page => {
                        sitepage = page;
                        return page.property('viewportSize', {width: 1024, height: 512});
                    })
                    .then(() => {
                        return sitepage.property('content', '<html><head></head><body><div id="test"><canvas id="canvas" width="1024px" height="512px"></canvas></div></body>')
                    })
                    .then(() => {
                        let charityImageUrl;
                        let backgroundImageUrl;
                        let charityOrgName;

                        sitepage.evaluate(generateAnswerImage, answererPhoto, askerPhoto, answererName, askerName, charityImage, backUrl, questionText).then();

                        setTimeout(() => {
                            sitepage.evaluate(function () {
                                if (window.isLoaded)
                                    return document.getElementById('canvas').toDataURL();
                                return 'NOT_LOADED';
                            }).then(res => {
                                const t = res;
                                console.log(t.substr(0, 10));
                                if (t !== 'NOT_LOADED') {
                                    // Save share image
                                    var file = new Parse.File('answer' + '.png', {base64: t}, 'image/png');
                                    answer.set('image', file);
                                    answer.save(null, {useMasterKey: true}).then((answer) => {
                                        phInstance.exit();
                                        resolve(answer.get('image').url());
                                    }, err => {
                                        console.log(err);
                                        phInstance.exit();
                                        reject(err);
                                    });
                                    console.log(`Creating share image for ${answer.id}`);
                                } else {
                                    console.log(`Retrying to generate share image for ${answer.id}`);
                                    attempts++;
                                    if (attempts > MAX_ATTEMPTS)
                                        return reject(new Error(`Can not generate share image for ${answer.id}`))
                                    generateImage();
                                }
                            })
                        }, 10000);
                    })
                    .catch(err => {
                        console.log(err);
                        reject(err);
                    })
            })();
        }, function(err) {
            console.log(err);
            reject(err);
        });

    });
}
function generateAnswerImage(answererPhoto, askerPhoto, answererName, askerName, charityImage, backUrl, questionText) {
    const isCharity = !!charityImage;
    var canvas = document.getElementById("canvas");

    var ctx = canvas.getContext("2d");
    var backImg = loadImage(backUrl, drawBackground);
    var answererImg, charityImg, askerImg;
    const width = 1024;
    const height = 512;
    function drawBackground() {
        ctx.save();
        ctx.drawImage(backImg, 0, 0, width, height);
        ctx.font = '24px Nunito,sans-serif';
        ctx.fillStyle = '#848484';
        ctx.textAlign = 'left';
        const x = 60.5;
        const y = 455;
        ctx.fillText(askerName + ' asks:', x, y);
        // Draw question text
        /**
         * @param canvas : The canvas object where to draw .
         *                 This object is usually obtained by doing:
         *                 canvas = document.getElementById('canvasId');
         * @param x     :  The x position of the rectangle.
         * @param y     :  The y position of the rectangle.
         * @param w     :  The width of the rectangle.
         * @param h     :  The height of the rectangle.
         * @param text  :  The text we are going to centralize.
         * @param fh    :  The font height (in pixels).
         * @param spl   :  Vertical space between lines
         */
        const paint_centered_wrap = function(x, y, w, h, text, fh, spl, color, px) {
            // The painting properties
            // Normally I would write this as an input parameter
            var Paint = {
                RECTANGLE_STROKE_STYLE : 'black',
                RECTANGLE_LINE_WIDTH : 1,
                VALUE_FONT : 'normal ' + fh + 'Px Ninuto,sans-serif',
                VALUE_FILL_STYLE : 'red'
            }
            /*
             * @param ctx   : The 2d context
             * @param mw    : The max width of the text accepted
             * @param font  : The font used to draw the text
             * @param text  : The text to be splitted   into
             */
            var split_lines = function(ctx, mw, font, text) {
                // We give a little "padding"
                // This should probably be an input param
                // but for the sake of simplicity we will keep it
                // this way
                mw = mw - px;
                // We setup the text font to the context (if not already)
                ctx.font = font;
                // We split the text by words
                var words = text.split(' ');
                var new_line = words[0];
                var lines = [];
                for(var i = 1; i < words.length; ++i) {
                    if (ctx.measureText(new_line + " " + words[i]).width < mw) {
                        new_line += " " + words[i];
                    } else {
                        lines.push(new_line);
                        new_line = words[i];
                    }
                }
                lines.push(new_line);
                // DEBUG
                // for(var j = 0; j < lines.length; ++j) {
                //    console.log("line[" + j + "]=" + lines[j]);
                // }
                return lines;
            };
            if (ctx) {
                // draw rectangular
                //ctx.strokeStyle=Paint.RECTANGLE_STROKE_STYLE;
                ctx.lineWidth = Paint.RECTANGLE_LINE_WIDTH;
                ctx.fillStyle = color;
                //ctx.strokeRect(x, y, w, h);
                // Paint text
                var lines = split_lines(ctx, w, Paint.VALUE_FONT, text);
                // Block of text height
                var both = lines.length * (fh + spl);
                if (both >= h) {
                    // We won't be able to wrap the text inside the area
                    // the area is too small. We should inform the user
                    // about this in a meaningful way
                } else {
                    // We determine the y of the first line
                    var ly = (h - both)/2 + y + spl*lines.length;
                    var lx = 0;
                    for (var j = 0; j < lines.length; ++j, ly+=fh+spl) {
                        // We continue to centralize the lines
                        lx = x + w / 2 - ctx.measureText(lines[j]).width/2;
                        // DEBUG
                        console.log("ctx2d.fillText('"+ lines[j] +"', "+ lx +", " + ly + ")");
                        ctx.fillText(lines[j], lx, ly);
                    }
                }
            }
        };
        // Get font size

        var fontSize;
        //questionText = 'Parse.Query defines a query that is used to fetch Parse.Objects. The most common use case is finding all objects that match a query through the find method. For example, this sample code fetches all objects of class MyClass. It calls a different function depending on whether the fetch succeeded or not.';
        if (questionText.length > 200) {
            questionText = questionText.substr(0, 197) + '...';
        }
        fontSize = 33 + (200 - questionText.length) / 10;

        paint_centered_wrap(38, 32, 522, 378, '"' + questionText.trim() + '"', fontSize, fontSize * 0.1, '#535353', 100);
        paint_centered_wrap(625, 250, 350, 200, 'Listen to ' + answererName + '\'s answer', 35, 5, 'white', 0);
        ctx.restore();
        answererImg = loadImage(answererPhoto, drawAnswererPhoto);
    }

    function drawAnswererPhoto() {

        ctx.save();
        ctx.beginPath();
        const x = 796.5;
        const y = 141.5;
        const radius = 100;
        ctx.arc(x, y, radius, 0, Math.PI * 2, true);

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(answererImg, x - radius, y - radius, radius * 2, radius * 2);

        ctx.restore();
        askerImg = loadImage(askerPhoto, drawAskerPhoto);
    }

    function drawAskerPhoto() {

        ctx.save();
        ctx.beginPath();
        const x = 520.5;
        const y = 447.5;
        const radius = 22;
        ctx.arc(x, y, radius, 0, Math.PI * 2, true);

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(askerImg, x - radius, y - radius, radius * 2, radius * 2);
        if (isCharity)
            charityImg = loadImage(charityImage, drawCharity);
        else
            window.isLoaded = true;
        ctx.restore();
    }

    function drawCharity() {
        ctx.save();
        ctx.beginPath();
        const x = 908;
        const y = 85.3;
        const radius = 45;

        ctx.arc(x, y, radius, 0, Math.PI * 2, true);

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(charityImg, x - radius, y - radius, radius * 2, radius * 2);
        ctx.strokeStyle = "white";
        ctx.lineWidth   = 4;
        ctx.stroke();
        window.isLoaded = true;
        ctx.restore();

    }

    function loadImage(src, onload) {
        var img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = onload;
        img.src = src;
        return img;
    }
}

function getAllUsers() {
    return new Promise((resolve, reject) => {
        var result = [];
        var chunk_size = 1000;
        var processCallback = function(res) {
            result = result.concat(res);
            if (res.length === chunk_size) {
                process(res[res.length-1].id);
            } else {
                resolve(result);
            }
        };
        var process = function(skip) {
            var query = new Parse.Query(Parse.User);
            if (skip) {
                query.greaterThan("objectId", skip);
            }
            //query.select(['profilePhoto', 'charityRef']);
            query.include(['charityRef']);
            query.limit(chunk_size);
            query.ascending("objectId");
            query.find({useMasterKey: true}).then(function (res) {
                processCallback(res);
            }, function (error) {
                reject(err);
            });
        };
        process(false);
    })
}

function getAllAnswers() {
    return new Promise((resolve, reject) => {
        var result = [];
        var chunk_size = 1000;
        var processCallback = function(res) {
            result = result.concat(res);
            if (res.length === chunk_size) {
                process(res[res.length-1].id);
            } else {
                resolve(result);
            }
        };
        var process = function(skip) {
            const Answer = Parse.Object.extend('Answer');
            var query = new Parse.Query(Answer);
            if (skip) {
                query.greaterThan("objectId", skip);
            }
            query.select(['objectId', 'image']);
            query.limit(chunk_size);
            query.ascending("objectId");
            query.find({useMasterKey: true}).then(function (res) {
                processCallback(res);
            }, function (error) {
                reject(err);
            });
        };
        process(false);
    })
}

module.exports = {checkPushSubscription, checkEmailSubscription, sendPushOrSMS, addActivity, parseToAlgoliaObjects, generateShareImage, getShareImageAndExistence, getAllUsers, generateAnswerShareImage, getAllAnswers};
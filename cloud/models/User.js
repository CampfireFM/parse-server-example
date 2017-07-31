const mail = require('../../utils/mail');
const config = require('../../config');
const { sendPushOrSMS, generateShareImage, parseToAlgoliaObjects } = require('../common');
const Twitter = require('twitter');
const Mixpanel = require('mixpanel');
const graph = require('fbgraph');
const uniqid = require('uniqid');
const algoliasearch = require('../algolia/algoliaSearch.parse.js');
const algoliaClient = algoliasearch(config.algolia.app_id, config.algolia.api_key);
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
        //facebook or twitter login
        if (request.object.existed() == true && request.object.get('isWelcomeEmailSent') != true) {
            isNewToCampfire = true;
            //Look for friends already signed up to campfire
            var authData = request.object.get('authData');

            //Friends in facebook

            if(authData && authData.facebook){
                var facebookAuth = authData.facebook;
                graph.setAccessToken(facebookAuth.access_token);
                graph.get(facebookAuth.id + '/friends', function(err, friends){
                    if(err)
                        return console.log(err);
                    else{
                        console.log(friends);
                        //Send notification to the followers
                        if(friends.summary.total_count > 0){
                            var friendIds = friends.data.map(function(friend){
                                return friend.id;
                            });
                            getUsersByFacebookIds(friendIds, function(err, campfireFriends){
                                if (err) {
                                    console.log(err);
                                } else {
                                    // Send push notification to user's friends
                                    sendPushOrSMS(request.user, campfireFriends, 'joinCampfire');
                                    request.object.set('fbFollowers', campfireFriends.length);
                                    request.object.save(null, {useMasterKey: true});
                                }
                            });
                        }

                    }
                });
            }

            //Friends in twitter

            if(authData && authData.twitter){
                var twitterAuth = authData.twitter;
                var client = new Twitter({
                    consumer_key: config.auth.twitter.consumer_key,
                    consumer_secret: config.auth.twitter.consumer_secret,
                    access_token_key: twitterAuth.auth_token,
                    access_token_secret: twitterAuth.auth_token_secret
                });


                client.get('followers/ids.json', {stringify_ids : true}, function(error, tweets, response) {
                    if (!error) {
                        var ids = JSON.parse(response.body).ids;
                        var friendIds = ids.map(function(id){
                            return id.toString();
                        });
                        getUsersByTwitterIds(friendIds, function(err, campfireFriends){
                            if (err) {
                                console.log(err);
                            } else {
                                // Send push notification to user's friend
                                sendPushOrSMS(request.user, campfireFriends, 'joinCampfire');
                                request.object.set('twitterFollowers', campfireFriends.length);
                                request.object.save(null, {useMasterKey: true});
                            }
                        })
                    }
                });
            }
        }
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
        //Set default values
        request.object.set('emailSubscriptions', ["earnings","unlocks","questions","summary", "likes"]);
        request.object.set('pushSubscriptions', ["likes","questions","unlocks","earnings"]);
        request.object.save(null, {useMasterKey : true});

        // Save user to algolia
        var index = algoliaClient.initIndex('users');
        // Convert Parse.Object to JSON
        var objectToSave = parseToAlgoliaObjects(request.object)[0];
        // Add or update object
        index.saveObject(objectToSave, function (err, content) {
            if (err) {
                throw err;
            }
        });
    } else {
        mail.updateMailingList(firstName, lastName, oldEmail, userEmail);
        //Update user at mixpanel

        mixpanel.people.set(request.object.get('username'), {
            $first_name: firstName,
            $last_name: lastName,
            $email: userEmail
        });
        generateShareImage(request.object.id).then();

        // Save user to algolia
        var index = algoliaClient.initIndex('users');
        // Convert Parse.Object to JSON
        var objectToSave = parseToAlgoliaObjects(request.object)[0];
        // Add or update object
        index.saveObject(objectToSave, function (err, content) {
            if (err) {
                throw err;
            }
        });
    }
    response.success('ok');
});

Parse.Cloud.define('validateWvSession', function(req, res){
    var validUser = Parse.Object.extend('User');
    var validUserQuery = new Parse.Query(validUser);
    validUserQuery.equalTo("wvSessionToken", req.params.wvSessionToken)
    var password = uniqid(); //create new random passowrd
    validUserQuery.first({useMasterKey : true}).then(function(validUserObj) {
        var userObjId = validUserObj.id;
        var newToken = uniqid(userObjId+'-');
        validUserObj.set("password", password);
        validUserObj.set('wvSessionToken', newToken);
        validUserObj.save(null, {useMasterKey : true}).then(function(newUserObj){
            Parse.User.logIn(newUserObj.get("username"), password).then(function(user){
                var session_token = user.getSessionToken()
                res.success({session_token: session_token});
            }, function(error){
                console.log('Got an error ' + error.code + ' : ' + error.message);
                res.error(error);
            })
        }, function(error){
            console.log('Got an error ' + error.code + ' : ' + error.message);
            res.error(error);
        });
    }, function(error) {
        console.log('Got an error ' + error.code + ' : ' + error.message);
        res.error(error);
    });
});

Parse.Cloud.define('getWebViewToken', function(req, res){
    var wvUser = Parse.Object.extend('User');
    var wvUserQuery = new Parse.Query(wvUser);
    wvUserQuery.get(req.params.userId, {
      success: function(user) {
        var userObjId = user.id;
        var newToken = uniqid(userObjId+'-');
        user.set('wvSessionToken', newToken);
        user.save(null, {useMasterKey : true}).then(function(newUserObj){
            res.success({webViewToken: newUserObj.get("wvSessionToken")});
        }, function(error){
            console.log('Got an error ' + error.code + ' : ' + error.message);
            res.error(error);
        });
      },
      error: function(error) {
        console.log('Got an error ' + error.code + ' : ' + error.message);
        res.error(error);
      }
    });
});



function getUsersByFacebookIds(facebookIds, callback){
    var query = new Parse.Query(Parse.User);
    query.containedIn('authData.facebook.id', facebookIds);
    query.find({useMasterKey : true}).then(function(users){
        if(users.length > 0){
            callback(null, users);
        } else {
            callback(null, []);
        }
    }, function(err){
        console.log(err);
        callback(err);
    });
}

function getUsersByTwitterIds(twitterIds, callback){
    var query = new Parse.Query(Parse.User);
    query.containedIn('authData.twitter.id', twitterIds);
    query.find({useMasterKey : true}).then(function(users){
        if(users.length > 0){
            callback(null, users);
        } else {
            callback(null, []);
        }
    }, function(err){
        console.log(err);
        callback(err);
    });
}

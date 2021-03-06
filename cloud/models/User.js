const mail = require('../../utils/mail');
const config = require('../../config');
const { sendPushOrSMS, generateShareImage, parseToAlgoliaObjects } = require('../common');
const Twitter = require('twitter');
const Mixpanel = require('mixpanel');
const graph = require('fbgraph');
const uniqid = require('uniqid');
const algoliasearch = require('../algolia/algoliaSearch.parse.js');
const algoliaClient = algoliasearch(config.algolia.app_id, config.algolia.api_key);
const branch = require('node-branch-io');
const Promise = require('promise');
const wrapper = require('co-express');

const generateUserInviteUrl = (userId) => {
    return new Promise((resolve, reject) => {
        branch.link.create(config.branchKey, {
            channel: 'Invite Links',
            campaign: 'Invite for Matches',
            feature: 'invites',
            alias: `i${userId}`,
            tags: ['invite', 'inviteForMatches'],
            data: {
                inviter_userID: userId,
                clickedOn: 'Invite for Matches'
            }
        }).then(function(link) {
            resolve(link.url);
        }).catch(function(err){
            console.log(err);
            reject(err);
        })
    })
};

Parse.Cloud.beforeSave(Parse.User, function(request, response) {
    const email = request.object.get('email');
    if (email) {
        let isReal = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
        if (!isReal)
            request.object.unset('email');
    }
    if (email && (email.indexOf('@bonfire.fm') > -1 || email.indexOf('camp@gmail.com') > -1)) {
        request.object.set('isShadowUser', true);
    }

    if (request.object.get('firstName') === 'Test' || request.object.get('lastName') === 'Test')
        request.object.set('isTestUser', true);
    if (!request.object.existed()) {
        request.object.set('emailSubscriptions', ["earnings","unlocks","questions","summary", "likes"]);
        request.object.set('pushSubscriptions', ["likes","questions","unlocks","earnings"]);
        request.object.set('lastActive', new Date());
        // Email login
        if (email) {
            const firstName = request.object.get('firstName');
            const lastName = request.object.get('lastName');
            mail.sendWelcomeMail(email);
            response.success();
            //mail.updateMailingList(firstName, lastName, email);
        } else {
            const authData = request.object.get('authData');

            //Friends in facebook

            if(authData && authData.facebook) {
                var facebookAuth = authData.facebook;
                graph.setAccessToken(facebookAuth.access_token);
                //graph.get(facebookAuth.id + '/friends', function(err, friends){
                //    if(err) {
                //        console.log(err);
                //        return response.success();
                //    } else {
                //        console.log(friends);
                //        //Send notification to the followers
                //        if(friends && friends.summary && friends.summary.total_count > 0){
                //            var friendIds = friends.data.map(function(friend){
                //                return friend.id;
                //            });
                //            getUsersByFacebookIds(friendIds, function(err, campfireFriends){
                //                if (err) {
                //                    console.log(err);
                //                    response.success();
                //                } else {
                //                    // Send push notification to user's friends
                //                    // sendPushOrSMS(request.user, campfireFriends, 'joinCampfire');
                //                    request.object.set('fbFollowers', campfireFriends.length);
                //                    response.success();
                //                }
                //            });
                //        } else {
                //            response.success();
                //        }
                //    }
                //});
                graph.get('/me?fields=id,email', function (err, res) {
                    if (err) {
                        return response.reject(err);
                    } else {
                        const email = res.email;
                        request.object.set('email', email);
                        response.success();
                    }
                });
            } else if (authData && authData.twitter) {
                var twitterAuth = authData.twitter;
                var client = new Twitter({
                    consumer_key: config.auth.twitter.consumer_key,
                    consumer_secret: config.auth.twitter.consumer_secret,
                    access_token_key: twitterAuth.auth_token,
                    access_token_secret: twitterAuth.auth_token_secret
                });
                client.get('/account/verify_credentials.json?include_email=true&skip_status=true&include_entities=true', function(err, tweets, res) {
                    if (err) {
                        return response.error(err);
                    }
                    const email = tweets.email;
                    request.object.set('email', email);
                    response.success();
                });
            } else {
                response.success();
            }

            //Friends in twitter

            //if(authData && authData.twitter){
            //    var twitterAuth = authData.twitter;
            //    var client = new Twitter({
            //        consumer_key: config.auth.twitter.consumer_key,
            //        consumer_secret: config.auth.twitter.consumer_secret,
            //        access_token_key: twitterAuth.auth_token,
            //        access_token_secret: twitterAuth.auth_token_secret
            //    });
            //
            //
            //    client.get('followers/ids.json', {stringify_ids : true}, function(error, tweets, res) {
            //        if (!error) {
            //            var ids = res.body ? JSON.parse(res.body).ids : [];
            //            if (!ids || ids.length === 0)
            //                return response.success();
            //            var friendIds = ids.map(function(id){
            //                return id.toString();
            //            });
            //            getUsersByTwitterIds(friendIds, function(err, campfireFriends){
            //                if (err) {
            //                    console.log(err);
            //                    response.success();
            //                } else {
            //                    // Send push notification to user's friend
            //                    // sendPushOrSMS(request.user, campfireFriends, 'joinCampfire');
            //                    request.object.set('twitterFollowers', campfireFriends.length);
            //                    response.success();
            //                }
            //            })
            //        } else {
            //            response.success();
            //        }
            //    });
            //}
        }
    } else {
        // Get previous user object
        const query = new Parse.Query(Parse.User);
        query.get(request.object.id, {useMasterKey: true}).then(user => {
            // Check if first name, last name,
            if (user.get('bio') !== request.object.get('bio')
                || user.get('tagline') !== request.object.get('tagline')
                || user.get('firstName') !== request.object.get('firstName')
                || user.get('lastName') !== request.object.get('lastName')
                || user.get('fullName') !== request.object.get('fullName')
                || user.get('profilePhoto').name() !== request.object.get('profilePhoto').name()
                || user.get('coverPhoto').name() !== request.object.get('coverPhoto').name()
            ) {

                if (request.object.get('isTestUser') !== true) {
                    // Save user to algolia
                    let appUserIndex = algoliaClient.initIndex(config.algolia.userIndex);
                    // Add or update object
                    let objectToSave = parseToAlgoliaObjects(request.object)[0];
                    appUserIndex.saveObject(objectToSave, function (err, content) {
                        if (err) {
                            throw err;
                        }
                    });
                }
            }

        if (!request.object.get('invitationUrl')) {
            generateUserInviteUrl(request.object.id)
                .then(link => {
                    request.object.set('invitationUrl', link);
                    response.success();
                })
                .catch(err => {
                    response.success();
                })
        } else {
            response.success();
        }
        })
    }
});
Parse.Cloud.afterSave(Parse.User, function(request, response) {
    const userEmail = request.object.get('email');
    const firstName = request.object.get('firstName') || '';
    const lastName = request.object.get('lastName') || '';
    const twitterId = request.object.get('twitterId');
    const facebookId = request.object.get('facebookId');
    //Init MixPanel
    var mixpanel = Mixpanel.init(config.mixpanelToken);
    //Add user to mailing list and send welcome email if new user or update mailing list
    //mixpanel.track("played_game");

    if(!request.object.existed()) {
        //Add user to MixPanel
        mixpanel.people.set(request.object.get('username'), {
            $first_name: firstName,
            $last_name: lastName,
            $email: userEmail ? userEmail : '',
            $created: (new Date()).toISOString()
        });
        if (request.object.get('isTestUser') !== true) {
            // Save user to algolia
            let index = algoliaClient.initIndex('users');
            // Convert Parse.Object to JSON
            let objectToSave = parseToAlgoliaObjects(request.object)[0];
            // Add or update object
            index.saveObject(objectToSave, function (err, content) {
                if (err) {
                    throw err;
                }
            });
        }
    } else {
        if (!userEmail && !facebookId && !twitterId)
          return response.success();
        if (userEmail) {
            // mail.updateMailingList(firstName, lastName, userEmail)
        }
        //Update user at mixpanel

        mixpanel.people.set(request.object.get('username'), {
            $first_name: firstName,
            $last_name: lastName,
            $email: userEmail ? userEmail : ''
        });

        generateShareImage(request.object.id);
        let objectToSave = parseToAlgoliaObjects(request.object)[0];
        let adminUserIndex = algoliaClient.initIndex(config.algolia.adminUserIndex);
        // Add or update object
        adminUserIndex.saveObject(objectToSave, function (err, content) {
            if (err) {
                throw err;
            }
        });
        //if (request.object.get('isTestUser') !== true) {
        //    // Save user to algolia
        //    let index = algoliaClient.initIndex('users');
        //    // Convert Parse.Object to JSON
        //    let objectToSave = parseToAlgoliaObjects(request.object)[0];
        //    // Add or update object
        //    index.saveObject(objectToSave, function (err, content) {
        //        if (err) {
        //            throw err;
        //        }
        //    });
        //}

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

Parse.Cloud.define('updateUser', (request, response) => {
    const {firstName, lastName, tagline, bio} = request.params;
    const query = new Parse.Query(Parse.User);
    query.get(request.object.id, {useMasterKey: true}).then(user => {
        if (!firstName && !lastName && !tagline && !bio)
            return response.success({});
        if (firstName)
            user.set('firstName', firstName);
        if (lastName)
            user.set('lastName', lastName);
        if (tagline)
            user.set('tagline', tagline);
        if (bio)
            user.set('bio', bio);
        user.save(null, {useMasterKey: true}).then((updatedUser) => {
            if (request.object.get('isTestUser') !== true) {
                // Save user to algolia
                let index = algoliaClient.initIndex('users');
                // Convert Parse.Object to JSON
                let objectToSave = parseToAlgoliaObjects(updatedUser)[0];
                // Add or update object
                index.saveObject(objectToSave, function (err, content) {
                    if (err) {
                        throw err;
                    }
                });
            }
        })
    })
})
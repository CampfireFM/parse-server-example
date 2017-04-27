const mail = require('../../utils/mail');
const config = require('../../config');
var Twitter = require('twitter');
var Mixpanel = require('mixpanel');
var graph = require('fbgraph');
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
            var facebookAuth = authData.facebook;
            if(facebookAuth != undefined){
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
                                if(err){
                                    console.log(err);
                                } else {
                                    campfireFriends.forEach(function(friend){
                                        // setup a push to the question Answerer
                                        var pushQuery = new Parse.Query(Parse.Installation);
                                        pushQuery.equalTo('deviceType', 'ios');
                                        pushQuery.equalTo('user', friend);

                                        var alert = 'Your friend just joined campfire, you can ask him whatever interested';
                                        if (request.user) {
                                            alert = 'Your friend ' + request.user.get('fullName') + ' has joined Campfire \n You can ask him anything interested';
                                        }

                                        Parse.Push.send({
                                            where: pushQuery,
                                            data: {
                                                alert: alert,
                                                userId: request.user.id
                                            }
                                        }, {
                                            useMasterKey: true,
                                            success: function () {
                                                // Push was successful
                                            },
                                            error: function (error) {
                                                throw "PUSH: Got an error " + error.code + " : " + error.message;
                                            }
                                        });
                                    });
                                }
                            });
                        }

                    }
                });
            }

            //Friends in twitter
            var twitterAuth = authData.twitter;
            if(twitterAuth !== undefined){
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
                            if(err){
                                console.log(err);
                            } else {
                                campfireFriends.forEach(function(friend){
                                    // setup a push to the question Answerer
                                    var pushQuery = new Parse.Query(Parse.Installation);
                                    pushQuery.equalTo('deviceType', 'ios');
                                    pushQuery.equalTo('user', friend);

                                    var alert = 'Your friend just joined campfire, you can ask him whatever interested';
                                    if (request.object) {
                                        alert = 'Your friend ' + request.object.get('fullName') + ' has joined Campfire \n You can ask him anything interested';
                                    }

                                    Parse.Push.send({
                                        where: pushQuery,
                                        data: {
                                            alert: alert,
                                            userId: request.user.id
                                        }
                                    }, {
                                        useMasterKey: true,
                                        success: function () {
                                            // Push was successful
                                        },
                                        error: function (error) {
                                            throw "PUSH: Got an error " + error.code + " : " + error.message;
                                        }
                                    });
                                });
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
    })
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
    })
}

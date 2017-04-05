    // Example express application adding the parse-server module to expose Parse
    // compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
var ParseDashboard = require('parse-dashboard');
var config = require('./config.js');
var cors = require('cors')

var Twitter = require("node-twitter-api");

var twitter = new Twitter({
  consumerKey: config.auth.twitter.consumer_key,
  consumerSecret: config.auth.twitter.consumer_secret,
  callback: config.auth.twitter.callback_url
});

var _requestSecret;

var api = new ParseServer({
    databaseURI: config['databaseURI'],
    cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
    appId: config['appId'],
    facebookAppIds: config['facebookAppIds'],
    masterKey: config['masterKey'],
    serverURL: config['serverURL'],
    publicServerURL: config['serverURL'],
    auth: config['auth'],
    push: {
      ios: [{
          pfx:        './keys/APNS-PROD.p12', // The filename of private key and certificate in PFX or PKCS12 format from disk
          bundleId:   'com.campfire',        // The bundle identifier associate with your app
          production: false                  // Specifies which environment to connect to: Production (if true) or Sandbox
          },
          {
          pfx: './keys/APNS-PROD.p12',
          bundleId: 'com.campfire',
          production: true
      }]
    }
});

var dashboard = new ParseDashboard({
  "apps": [{
    "serverURL" : config['serverURL'],
    "appId"     : config['appId'],
    "masterKey" : config['masterKey'],
    "appName"   : config['appName'],
    "iconName"  : "siteLogo.png"
  }],
  "users": config['dashboardusers'],
  "iconsFolder": "icons"
},true);

var app = express();
app.use(cors({
  credentials: true
}));

app.set('view engine', 'ejs');

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

// make the Parse Dashboard available at /dashboard
app.use('/dashboard', dashboard);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
   res.status(200).send('I dream of being a website.  Please star the parse-server repo on GitHub!');
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
app.get('/test', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/test.html'));
});

app.get('/twitter/auth', function(req, res){
  twitter.getRequestToken(function(err, requestToken, requestSecret) {
    if (err) {
      return res.status(401).json({
        success: false,
        message: err.message
      });
    } else {
      _requestSecret = requestSecret;
      return res.status(200).json({
        success: true,
        url : config.auth.twitter.auth_url + requestToken
      });
    }
  });
})

app.get("/access-token", function(req, res) {
  var requestToken = req.query.oauth_token,
  verifier = req.query.oauth_verifier;
  if(requestToken && verifier){
    twitter.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
      if (err) {
        return res.status(401).json({
          success: false,
          message: err.message
        });
      } else {
        twitter.verifyCredentials(accessToken, accessSecret, function(err, user) {
          var error = '';

          var twitterProvider = {
            authenticate: function (options) {
              if (options.success) {
                options.success(this, {});
              }
            },
            restoreAuthentication: function (authData) {
              console.log(authData);
            },
            getAuthType: function () {
              return 'twitter';
            },
            deauthenticate: function () { }
          };

          if (err) {
            return res.status(401).json({
              success: false,
              message: err.message
            });
          } else {
            var authData = {
              authData: {
                auth_token: accessToken,
                auth_token_secret: accessSecret,
                id: user.id_str
              }
            };
            Parse.User.logInWith(twitterProvider, authData).then(function(twitterUser){
              // 'twitterUser' is an empty object created after login
              // for twitter provided data, use 'user' variable
              if (!twitterUser.existed()) {
                var first_name = '';
                var last_name = ''
                var name_array = user.name.split(' ');

                first_name = name_array[0];
                if(name_array.length > 1){
                  last_name = name_array.slice(-1)[0]
                }
                Parse.Cloud.run('updateNewUser', {
                  firstName: first_name,
                  lastname: last_name,
                  bio: user.description,
                  id: twitterUser.id,
                  profilePicUrl: user.profile_image_url_https,
                  coverPicUrl: user.profile_banner_url
                }).then(function(updatedUser) {
                  return res.status(200).json({
                    success: true,
                    session_token: twitterUser.getSessionToken()
                  });
                }, function() {
                  error = 'There is error while updating user detail!';
                  return res.status(200).json({
                    success: false,
                    error: error
                  });
                });
              }
              else{
                return res.status(200).json({
                  success: true,
                  session_token: twitterUser.getSessionToken()
                });
              }
            }, function(parseError){
              error = parseError;
              return res.status(200).json({
                success: false,
                error: error.message
              });
            });
          }
        });
      }
    });
  }
  else{
    return res.status(401).json({
      success: false,
      error: 'Error while log in with twitter'
    });
  }
});

app.get('/eavesdrop/:id', function(req, res) {
    var campfire = {};
    var campfireId = req.params.id
    if(campfireId){
      var Campfire = Parse.Object.extend('Campfire');
      var query = new Parse.Query(Campfire);
      query.include(['questionRef', 'answerRef', 'questionRef.fromUser.fullName', 'answerRef.fromUser.fullName', 'questionRef.toUser.fullName']);
      query.equalTo('isDummyData', false);
      query.get(campfireId, {
        success: function(object) {
            var camfireObj = {};
            var fromUser = object.get('questionRef').get('fromUser');
            var toUser = object.get('questionRef').get('toUser');
            var answerFile = object.get('answerRef').get('answerFile');
            if (answerFile) {
              camfireObj = {
                id: object.id,
                question: object.get('questionRef').get('text'),
                answer: answerFile.toJSON().url,
                to: {
                  name: toUser.get('fullName'),
                  firstName: toUser.get('firstName'),
                  lastName: toUser.get('lastName'),
                  picture: toUser.get('profilePhoto') ? (toUser.get('profilePhoto')).toJSON().url : '',
                  cover: '',
                  bio: toUser.get('bio'),
                  tagline: toUser.get('tagline')
                },
                from: {
                  name: fromUser.get('fullName'),
                  firstName: fromUser.get('firstName'),
                  lastName: fromUser.get('lastName'),
                  picture: fromUser.get('profilePhoto') ? (fromUser.get('profilePhoto')).toJSON().url : '',
                  cover: fromUser.get('coverPhoto') ? (fromUser.get('coverPhoto')).toJSON().url : '',
                  bio: fromUser.get('bio'),
                  tagline: toUser.get('tagline')
                }
              };
            }
            campfire = camfireObj
            return res.render('eavesdrop_meta',{
              id: campfireId,
              imageUrl: campfire.from.cover,
              question: '"' + campfire.question + '"',
              to_name: campfire.to.name,
              from_first_name: campfire.from.firstName,
              fb_app_id: config.facebookAppIds[0]
            });
          },
          error: function(object, error) {
            return res.status(500).json({
              success: false,
              message: error.message
            });
          }
      });
    }
    else{
      return res.status(500).json({
        success: false,
        message: 'No Campfire Id found.'
      });
    }
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);

httpServer.listen(port, function() {
  console.log('parse-server-example running on port ' + port + '.');
});


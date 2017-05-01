// Example express application adding the parse-server module to expose Parse
// compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
var ParseDashboard = require('parse-dashboard');
var config = require('./config.js');
var cors = require('cors')
const resolve = require('path').resolve;
var Twitter = require("node-twitter-api");

var twitter = new Twitter({
  consumerKey: config.auth.twitter.consumer_key,
  consumerSecret: config.auth.twitter.consumer_secret,
  callback: config.auth.twitter.callback_url
});

var _requestSecret;

var api = new ParseServer({
    verbose: true,
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
    },
    emailAdapter: {
        module: 'parse-server-mailgun',
        options: {
            // The address that your emails come from
            fromAddress: config.mailgun.fromAddress,
            // Your domain from mailgun.com
            domain: config.mailgun.domain,
            // Your API key from mailgun.com
            apiKey: config.mailgun.apiKey,
            // The template section
            templates: {
                // passwordResetEmail: {
                //     subject: 'Reset your password',
                //     pathPlainText: resolve(__dirname, 'path/to/templates/password_reset_email.txt'),
                //     pathHtml: resolve(__dirname, 'path/to/templates/password_reset_email.html'),
                //     callback: (user) => {return {firstName: user.get('firstName')}}
                //
                // // Now you can use {{firstName}} in your templates
                // },
                // verificationEmail: {
                //     subject: 'Confirm your account',
                //     pathPlainText: resolve(__dirname, 'path/to/templates/verification_email.txt'),
                //     pathHtml: resolve(__dirname, 'path/to/templates/verification_email.html'),
                //     callback: (user) => {return {firstName: user.get('firstName')}}
                // // Now you can use {{firstName}} in your templates
                // },
                welcomeEmail: {
                    subject: 'Welcome!',
                    pathPlainText: resolve(__dirname, './templates/welcome.txt'),
                    pathHtml: resolve(__dirname, './templates/welcome.html')
                },
                summaryEmail: {
                    subject: 'New answers last day!',
                    pathPlainText: resolve(__dirname, './templates/summary.txt'),
                    pathHtml: resolve(__dirname, './templates/summary.html')
                },
                followEmail: {
                    subject: 'You have new follower',
                    pathPlainText: resolve(__dirname, './templates/follow.txt'),
                    pathHtml: resolve(__dirname, './templates/follow.html'),
                },
                questionEmail: {
                    subject: 'You were asked new question',
                    pathPlainText: resolve(__dirname, './templates/question.txt'),
                    pathHtml: resolve(__dirname, './templates/question.html'),
                },
                answerEmail: {
                    subject: 'You were answered a question',
                    pathPlainText: resolve(__dirname, './templates/answer.txt'),
                    pathHtml: resolve(__dirname, './templates/answer.html'),
                }
            }
        }
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

app.all('*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', false);
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

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
  if (req.query.fromSite && req.query.fromSite == "admin") {
    twitter = new Twitter({
      consumerKey: config.auth.twitter.consumer_key,
      consumerSecret: config.auth.twitter.consumer_secret,
      callback: config.auth.twitter.admin_callback_url
    });
  } else {
    twitter = new Twitter({
      consumerKey: config.auth.twitter.consumer_key,
      consumerSecret: config.auth.twitter.consumer_secret,
      callback: config.auth.twitter.callback_url
    });
  }
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

app.get('/meta/*', function(req, res) {
    var page = req.params[0];
    page = page.replace('home', '');
    var isEavesdropPage = /^eavesdrop\/(.*)$/.test(page);
    if(isEavesdropPage){
      var answer = {};
      var answerId = req.params[0].split('/')[1]
      var Answer = Parse.Object.extend('Answer');
      var query = new Parse.Query(Answer);
      query.include(['questionRef', 'questionRef.fromUser.fullName', 'questionRef.toUser.fullName']);
      query.equalTo('isDummyData', false);
      query.get(answerId, {
        success: function(object) {
            var answerObj = {};
            var fromUser = object.get('questionRef').get('fromUser');
            var toUser = object.get('questionRef').get('toUser');
            var answerFile = object.get('answerFile');
            if (answerFile) {
              answerObj = {
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
            answer = answerObj;

            desc = answer.to.name + "responds to " + answer.from.firstName + "'s" + ' question: "' + answer.question + '" on Campfire.';
            title = "Eavesdrop on " + answer.to.name + " - Campfire";

            return res.render('eavesdrop_meta',{
              page: req.params[0],
              imageUrl: toUser.get('coverPhoto') ? (toUser.get('coverPhoto')).toJSON().url : '',
              fb_app_id: config.facebookAppIds[0],
              description: desc,
              title: title
            });
          },
          error: function(object, error) {
            return res.render('eavesdrop_meta',{
              page: req.params[0],
              imageUrl: 'https://campfiremedia.herokuapp.com/public/assets/images/defaultshareimage.jpg',
              fb_app_id: config.facebookAppIds[0],
              description: "Spark intimate conversations that reward you, your heroes, and the causes you care about.",
              title: "Campfire - Hear it here."
            });
          }
      });
    }
    else{
      return res.render('eavesdrop_meta',{
        page: page,
        imageUrl: 'https://campfiremedia.herokuapp.com/public/assets/images/defaultshareimage.jpg',
        fb_app_id: config.facebookAppIds[0],
        description: "Spark intimate conversations that reward you, your heroes, and the causes you care about.",
        title: "Campfire - Hear it here."
      });
    }
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);

httpServer.listen(port, function() {
  console.log('parse-server-example running on port ' + port + '.');
});


// Example express application adding the parse-server module to expose Parse
// compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
var ParseDashboard = require('parse-dashboard');
var config = require('./config.js');
var cors = require('cors');
const resolve = require('path').resolve;
var Twitter = require("node-twitter-api");
var MixpanelExport = require('mixpanel-data-export');
var uniqid = require('uniqid');
var ipn = require('paypal-ipn');
var bodyParser = require('body-parser');
panel = new MixpanelExport({
  api_key: config.mixpanel.api_key,
  api_secret: config.mixpanel.api_secret
});

var S3Adapter = require('parse-server-s3-adapter');

var s3Options = {
    "bucket": config['bucketName'],
    // optional:
    "region": 'us-east-1', // default value
    "bucketPrefix": '', // default value
    "directAccess": true, // default value
    "baseUrl": config['baseURL'], // default value
    "signatureVersion": 'v4', // default value
    "globalCacheControl": null // default value. Or 'public, max-age=86400' for 24 hrs Cache-Control
};

var s3Adapter = new S3Adapter(s3Options);

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
    filesAdapter: s3Adapter,
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
    appName: 'Campfire Media',
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
                passwordResetEmail: {
                    subject: 'Reset your password',
                    pathPlainText: resolve(__dirname, './templates/password_reset_email.txt'),
                    pathHtml: resolve(__dirname, './templates/password_reset_email.html'),
                    callback: (user) => {return {username: user.get('fullName')}}

                // Now you can use {{firstName}} in your templates
                },
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
                    subject: 'New questions have been answered!',
                    pathPlainText: resolve(__dirname, './templates/summary.txt'),
                    pathHtml: resolve(__dirname, './templates/summary.html')
                },
                followEmail: {
                    subject: 'You have a new follower',
                    pathPlainText: resolve(__dirname, './templates/follow.txt'),
                    pathHtml: resolve(__dirname, './templates/follow.html'),
                },
                questionEmail: {
                    subject: 'You have been asked a question',
                    pathPlainText: resolve(__dirname, './templates/question.txt'),
                    pathHtml: resolve(__dirname, './templates/question.html'),
                },
                answerEmail: {
                    subject: 'Your question was answered',
                    pathPlainText: resolve(__dirname, './templates/answer.txt'),
                    pathHtml: resolve(__dirname, './templates/answer.html'),
                },
                adminSummaryEmail: {
                    subject: 'New updates to Campfire',
                    pathPlainText: resolve(__dirname, './templates/adminSummary.txt'),
                    pathHtml: resolve(__dirname, './templates/adminSummary.html'),
                },
                transactionFailureEmail: {
                  subject: 'Transaction Failure',
                  pathPlainText: resolve(__dirname, './templates/transactionFailure.txt'),
                  pathHtml: resolve(__dirname, './templates/transactionFailure.html'),
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
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
});

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
                var last_name = '';
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
    //page = page.replace('home', '');
    var isEavesdropPage = /^eavesdrop\/(.*)$/.test(page);
    var isAskPage = /^user\/(.*)$/.test(page);
    var isAnotherRound = /^anotherround$/.test(page);
    if (isEavesdropPage) {
        var answer = {};
        var answerId = req.params[0].split('/')[1]
        var Answer = Parse.Object.extend('Answer');
        var query = new Parse.Query(Answer);
        query.include(['questionRef', 'questionRef.fromUser.fullName', 'questionRef.toUser.fullName']);
        query.equalTo('isDummyData', false);
        query.get(answerId, {
            success: function (object) {
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

                const desc = answer.to.name + " responds to " + answer.from.firstName + "'s" + ' question: "' + answer.question + '" on Campfire.';
                const title = "Eavesdrop on " + answer.to.name + " - Campfire";

                let imageUrl;
                if (object.get('image')) {
                    imageUrl = object.get('image').url();
                } else {
                    imageUrl = toUser.get('coverPhoto') ? (toUser.get('coverPhoto')).toJSON().url : '';
                }
                return res.render('eavesdrop_meta', {
                    page: req.params[0],
                    imageUrl: imageUrl,
                    fb_app_id: config.facebookAppIds[0],
                    description: desc,
                    title: title
                });
            },
            error: function (object, error) {
                return res.render('eavesdrop_meta', {
                    page: req.params[0],
                    imageUrl: 'https://campfiremedia.herokuapp.com/public/assets/images/defaultshareimage.jpg',
                    fb_app_id: config.facebookAppIds[0],
                    description: "Spark intimate conversations that reward you, your heroes, and the causes you care about.",
                    title: "Campfire - Ask, answer, get paid, do social good."
                });
            }
        });
    } else if (isAskPage) {
        var user = {};
        var userId = req.params[0].split('/')[1];
        var userQuery = new Parse.Query(Parse.User);
        userQuery.equalTo('objectId', userId);
        userQuery.include('charityRef');
        userQuery.first({useMasterKey: true}).then(function (user) {
            if (user) {
                const charity = user.get('charityRef');
                const ShareImage = Parse.Object.extend('ShareImage');
                const shareImageQuery = new Parse.Query(ShareImage);
                shareImageQuery.equalTo('userRef', user);
                shareImageQuery.equalTo('charityRef', charity);
                let title;
                if (charity)
                    title = 'Ask ' + user.get('firstName') + " any question, support " + charity.get('name') + " on Campfire";
                else
                    title = 'Ask ' + user.get('fullName') + ' any question with campfire';
                shareImageQuery.first({useMasterKey: true}).then(function (shareImage) {
                    const shareImageUrl = shareImage.get('image').url();

                    res.render('eavesdrop_meta', {
                        page: req.params[0],
                        imageUrl: shareImageUrl,
                        fb_app_id: config.facebookAppIds[0],
                        description: "Campfire lets you ask anyone a question, get an audio answer and support great causes: get.campfire.fm",
                        title: title
                    });
                }, function (err) {
                    return res.render('eavesdrop_meta', {
                        page: page,
                        imageUrl: 'https://campfiremedia.herokuapp.com/public/assets/images/defaultshareimage.jpg',
                        fb_app_id: config.facebookAppIds[0],
                        description: "Campfire lets you ask anyone a question, get an audio answer and support great causes: get.campfire.fm",
                        title: title
                    });
                })

            } else {
                return res.render('eavesdrop_meta', {
                    page: page,
                    imageUrl: 'https://campfiremedia.herokuapp.com/public/assets/images/defaultshareimage.jpg',
                    fb_app_id: config.facebookAppIds[0],
                    description: "Campfire lets you ask anyone a question, get an audio answer and support great causes: get.campfire.fm",
                    title: "Campfire - Ask, answer, get paid, do social good."
                });
            }
        }, function (err) {
            return res.render('eavesdrop_meta', {
                page: page,
                imageUrl: 'https://campfiremedia.herokuapp.com/public/assets/images/defaultshareimage.jpg',
                fb_app_id: config.facebookAppIds[0],
                description: "Campfire lets you ask anyone a question, get an audio answer and support great causes: get.campfire.fm",
                title: "Campfire - Ask, answer, get paid, do social good."
            });
        })
    } else if (isAnotherRound) {
        return res.render('eavesdrop_meta', {
            page: page,
            imageUrl: 'https://campfiremedia.herokuapp.com/public/assets/images/another-world.jpg',
            fb_app_id: config.facebookAppIds[0],
            description: "This week, Campfire sparks the Another Round podcast. Get Campfire to ask questions to your favorite experts and celebrities - and get paid for it.",
            title: "Get Campfire"
        });
    } else {
        return res.render('eavesdrop_meta', {
            page: 'home',
            imageUrl: 'https://campfiremedia.herokuapp.com/public/assets/images/defaultshareimage.jpg',
            fb_app_id: config.facebookAppIds[0],
            description: "Spark intimate conversations that reward you, your heroes, and the causes you care about.",
            title: "Campfire - Ask, answer, get paid, do social good."
        });
    }
});


app.use(bodyParser.urlencoded({extended: false}));
app.post('/ipn', function(req, res) {
    res.sendStatus(200);
    ipn.verify(req.body, {'allow_sandbox': process.env.PAYPAL_MODE !== 'live'}, function (err, msg) {
        if (err) {
            console.log('IPN INVALID');
            console.log(err);
        } else {
            console.log(req.body);
            const ipnContent = req.body;
            //In case of Mass payout, record appropriate datas in Withdraw Class
            if (ipnContent.txn_type == 'masspay') {
                //Save IPN object to database
                var IPN = Parse.Object.extend('IPN');
                var ipn = new IPN();
                ipn.set('masspayTransactionId', ipnContent.masspay_txn_id_1);
                ipn.set('currency', ipnContent.mc_currency_1);
                ipn.set('fee', parseFloat(ipnContent.mc_fee_1));
                ipn.set('gross', parseFloat(ipnContent.mc_gross_1));
                ipn.set('paymentDate', ipnContent.payment_date);
                ipn.set('paymentStatus', ipnContent.payment_status);
                ipn.set('status', ipnContent.status_1);
                ipn.set('receiverEmail', ipnContent.receiver_email_1);
                ipn.set('uniqueId', ipnContent.unique_id_1);
                ipn.set('testIpn', ipnContent.test_ipn == '1');
                if (ipnContent.status_1 == 'Failed')
                    ipn.set('reasonCode', ipnContent.reason_code_1);

                // Set userRef
                var userQuery = new Parse.Query(Parse.User);
                userQuery.equalTo('paypalEmail', ipn.receiver_email_1);
                userQuery.first({useMasterKey: true}).then(function (user) {
                    if (user) {
                        ipn.set('userRef', user);
                    }
                    ipn.save(null, {useMasterKey: true}).then(function (res) {
                        console.log(res);
                    }, function (err) {
                        console.log(err);
                    });
                });
                // Create payout object in parse
                var reverseEarnings = function (email, earnings) {
                    var userQuery = new Parse.Query(Parse.User);
                    userQuery.equalTo('paypalEmail', email);
                    userQuery.first({useMasterKey: true}).then(function (user) {
                        if (user) {
                            user.set('earningsBalance', user.get('earningsBalance') + earnings);
                            user.save(null, {useMasterKey: true});
                        }
                    });
                };
                switch (ipnContent.status_1) {
                    case 'Failed':
                        var reasonCode = ipnContent.reason_code_1;
                        switch (reasonCode) {
                            case '14767':
                                //Receiver is unregistered
                                break;
                            case '14769':
                                //Receiver is unconfirmed
                                break;
                        }
                        reverseEarnings(ipnContent.receiver_email_1, ipnContent.mc_gross_1);
                        break;
                    case 'Returned':
                        reverseEarnings(ipnContent.receiver_email_1, ipnContent.mc_gross_1);
                        break;
                    case 'Reversed':
                        reverseEarnings(ipnContent.receiver_email_1, ipnContent.mc_gross_1);
                        break;
                    case 'Unclaimed':
                        console.log('Receiver is unregistered');
                        // Reverse transaction
                        // reverseEarnings(ipnContent.receiver_email_1, ipnContent.mc_gross_1);
                        break;
                    case 'Pending':
                        break;
                    case 'Blocked':
                        // reverseEarnings(ipnContent.receiver_email_1, ipnContent.mc_gross_1);
                        break;
                    default:
                        break;
                }
            }
        }
    })
});
app.use(bodyParser.json({limit: '10mb'}));
app.post('/uploadSocialImage', (req, res) => {
    const userId = req.body.userId;
    const charityId = req.body.charityId;
    const base64Image = req.body.base64Image;

    const Charity = Parse.Object.extend('Charity');
    const ShareImage = Parse.Object.extend('ShareImage');
    // Get user object
    const userQuery = new Parse.Query(Parse.User);
    userQuery.get(userId, {useMasterKey: true}).then(function(user) {
        const charityQuery = new Parse.Query(Charity);
        if (charityId) {
            charityQuery.get(charityId, {useMasterKey: true}).then(function (charity) {
                // Check for existing share image
                const shareImageQuery = new Parse.Query(ShareImage);
                shareImageQuery.equalTo('userRef', user);
                shareImageQuery.equalTo('charityRef', charity);
                shareImageQuery.include(['userRef', 'charityRef']);
                shareImageQuery.first({useMasterKey: true}).then(function (shareImage) {
                    if (shareImage) {
                        const oldProfileImage = shareImage.get('userRef').get('profilePhoto');
                        const oldCharityImage = shareImage.get('charityRef').get('image');
                        if (oldProfileImage.name() === user.get('profilePhoto').name() && oldCharityImage.name() === charity.get('image').name()) {
                            return res.json({});
                        }

                        // Update share image
                        var file = new Parse.File('social' + '.png', {base64: base64Image}, 'image/png');
                        shareImage.set('image', file);
                        shareImage.save(null, {useMasterKey: true}).then(function () {
                            console.log(`Successfully updated share image: ${user.get('fullName')}, ${charity.get('name')}`);
                            res.json({});
                        }, function (err) {
                            console.log(err);
                            console.log(`Failed to update share image: ${user.get('fullName')}, ${charity.get('name')}`);
                            throw err;
                        });
                    } else {
                        const newShareImage = new Parse.Object('ShareImage');
                        newShareImage.set('userRef', user);
                        newShareImage.set('charityRef', charity);
                        var file = new Parse.File('social' + '.png', {base64: base64Image}, 'image/png');
                        newShareImage.set('image', file);
                        newShareImage.save(null, {useMasterKey: true}).then(function () {
                            res.json({});
                        }, function (err) {
                            console.log(err);
                            throw err;
                        })
                    }
                })
            }, function (err) {
                console.log(err);
                throw err;
            })
        } else {
            const shareImageQuery = new Parse.Query(ShareImage);
            shareImageQuery.equalTo('userRef', user);
            shareImageQuery.equalTo('charityRef', undefined);
            shareImageQuery.include(['userRef']);
            shareImageQuery.first({useMasterKey: true}).then(function(shareImage) {
                if (shareImage) {
                    if (shareImage.get('userRef').get('profilePhoto').name() === user.get('profilePhoto').name())
                        return res.json({});
                    var file = new Parse.File('social' + '.png', {base64: base64Image}, 'image/png');
                    shareImage.set('image', file);
                    shareImage.save(null, {useMasterKey: true}).then(function () {
                        res.json({});
                    }, function (err) {
                        console.log(err);
                        throw err;
                    })
                } else {
                    const newShareImage = new Parse.Object('ShareImage');
                    newShareImage.set('userRef', user);
                    var file = new Parse.File('social' + '.png', {base64: base64Image}, 'image/png');
                    newShareImage.set('image', file);
                    newShareImage.save(null, {useMasterKey: true}).then(function () {
                        res.json({});
                    }, function (err) {
                        console.log(err);
                        throw err;
                    })
                }
            }, function(err) {
                console.log(err);
                throw err;
            })
        }
    }, function(err) {
        console.log(err);
        throw err;
    })
});
var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);

httpServer.listen(port, function() {
  console.log('parse-server-example running on port ' + port + '.');
});


    // Example express application adding the parse-server module to expose Parse
    // compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
var ParseDashboard = require('parse-dashboard');
var config = require('./config.js');
var cors = require('cors')

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
app.use(cors({credentials: true}));

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

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);

httpServer.listen(port, function() {
  console.log('parse-server-example running on port ' + port + '.');
});


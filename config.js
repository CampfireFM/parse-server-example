
//The below config variables are used in initializing the parse applicationa
//and parse dashboard
configs = {
    development: {
        appName: process.env.APP_NAME || 'campfiremedia',
        databaseURI: process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dev',
        // databaseURI :'mongodb://heroku_3t2m0sw8:js2nq3l7o4cqk2hoshjmj2tj6a@ds139728-a0.mlab.com:39728,ds139728-a1.mlab.com:39728/heroku_3t2m0sw8?replicaSet=rs-ds139728',
        appId: process.env.APP_ID || 'maryhadalittlelamb',
        masterKey: process.env.MASTER_KEY || 'whosefleecewaswhiteassnow',
        serverURL: process.env.SERVER_URL || process.env.serverURL || 'http://localhost:1337/parse',
        baseURL: process.env.BASE_URL || process.env.baseURL || 'http://192.168.1.142:1337',
        facebookAppIds: ["984145855062964"],
        auth: {
            twitter: {
                consumer_key: "PxGZmDyQbD778kzrWmyyPXeIc", // Required
                consumer_secret: "qBTm2TEkqnsc8WxrtkKzq0qDrOhFFTvALsDIo4cFhXmZEjN3ee", // Required
                callback_url: "https://campfire.fm",
                auth_url: "https://api.twitter.com/oauth/authenticate?oauth_token="
            }
        },
        dashboardusers: [{"user": "user", "pass": "password"}],
        stripe_test_key: 'sk_test_dI6EuGEjaEwNrBLMKlcS84lq',
        stripe_live_key: 'sk_test_7D6yb4r&^U2?QCj/u4i}CFE+',
        mailgun: {
            domain: 'mailgun.campfire.fm',
            fromAddress: 'Customer Service <postmaster@mailgun.campfire.fm>',
            apiKey: 'key-8603e31c95f12cbd1ac969203c1ff7fe',
            listAddress: 'campfire_ios_users@mailgun.campfire.fm'
        },
        mixpanelToken : 'a09156a83517cda592357ca818137887',
        algolia : {
            app_id : 'SQIZQNTD1E',
            api_key : '6063c6a1e68779c80c7965f85074148b'
        }
    },
	production : {
        appName: process.env.APP_NAME || 'campfiremedia',
        databaseURI: process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dev',
        // databaseURI :'mongodb://heroku_3t2m0sw8:js2nq3l7o4cqk2hoshjmj2tj6a@ds139728-a0.mlab.com:39728,ds139728-a1.mlab.com:39728/heroku_3t2m0sw8?replicaSet=rs-ds139728',
        appId: process.env.APP_ID || 'maryhadalittlelamb',
        masterKey: process.env.MASTER_KEY || 'whosefleecewaswhiteassnow',
        serverURL: process.env.SERVER_URL || process.env.serverURL || 'http://localhost:1337/parse',
        baseURL: process.env.BASE_URL || process.env.baseURL || 'https://campfiremedia.herokuapp.com',
        facebookAppIds: ["984145855062964"],
        auth: {
            twitter: {
                consumer_key: "PxGZmDyQbD778kzrWmyyPXeIc", // Required
                consumer_secret: "qBTm2TEkqnsc8WxrtkKzq0qDrOhFFTvALsDIo4cFhXmZEjN3ee", // Required
                callback_url: "https://campfire.fm",
                auth_url: "https://api.twitter.com/oauth/authenticate?oauth_token="
            }
        },
        dashboardusers: [{"user": "user", "pass": "password"}],
        stripe_test_key: 'sk_test_dI6EuGEjaEwNrBLMKlcS84lq',
        stripe_live_key: 'sk_test_7D6yb4r&^U2?QCj/u4i}CFE+',
        mailgun: {
            domain: 'mailgun.campfire.fm',
            fromAddress: 'Customer Service <postmaster@mailgun.campfire.fm>',
            apiKey: 'key-8603e31c95f12cbd1ac969203c1ff7fe',
            listAddress: 'campfire_ios_users@mailgun.campfire.fm'
        },
        mixpanelToken : '09b2a637be266aeb72c61a05ea51e81d',
        algolia : {
            app_id : 'SQIZQNTD1E',
            api_key : '6063c6a1e68779c80c7965f85074148b'
        }
	}
};

const env = process.env.NODE_ENV || 'development';

module.exports = configs[env];

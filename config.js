
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
        facebookAppIds: ["984145855062964"],
        auth: {
            twitter: {
                consumer_key: "PxGZmDyQbD778kzrWmyyPXeIc", // Required
                consumer_secret: "qBTm2TEkqnsc8WxrtkKzq0qDrOhFFTvALsDIo4cFhXmZEjN3ee", // Required
                admin_callback_url: "http://admin.campfire.fm",
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
        mixpanel: {
            api_key: "a20f53207d150c2e7a293d9dfe62d6ae",
            api_secret: "e2ce4394690de18852ceb8c18f852976"
        },
        mixpanelToken : 'a09156a83517cda592357ca818137887',
        algolia : {
            app_id : 'SQIZQNTD1E',
            api_key : '6063c6a1e68779c80c7965f85074148b'
        },
        paypal : {
            client_id : 'Af_15KlMYpYaejaj9jggpmX5woRXprvdi_pkaulc0oXVx5XNY5_vut7LleFUsuQquSN3WsllmlpyVKXv',
            client_secret : 'EObAHnUatUChH3LZKsusmS2zLpbnC-kq-ibCX3fouDm4_e6ggHbzXk9HYDkgBjtWgxliYh-brGJJMvHk'
        },
        twilio : {
            number : '14844168181',
            accountSid : 'AC5d07bea4ae1346c5143af33ec13f074d',
            authToken : '8961a3e9ba921dc52ee5d385ea9771f3'
        },
        notificationType : 'twilio'
    },
	production : {
        appName: process.env.APP_NAME || 'campfiremedia',
        databaseURI: process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dev',
        // databaseURI :'mongodb://heroku_3t2m0sw8:js2nq3l7o4cqk2hoshjmj2tj6a@ds139728-a0.mlab.com:39728,ds139728-a1.mlab.com:39728/heroku_3t2m0sw8?replicaSet=rs-ds139728',
        appId: process.env.APP_ID || 'maryhadalittlelamb',
        masterKey: process.env.MASTER_KEY || 'whosefleecewaswhiteassnow',
        serverURL: process.env.SERVER_URL || process.env.serverURL || 'http://localhost:1337/parse',
        facebookAppIds: ["984145855062964"],
        auth: {
            twitter: {
                consumer_key: "PxGZmDyQbD778kzrWmyyPXeIc", // Required
                consumer_secret: "qBTm2TEkqnsc8WxrtkKzq0qDrOhFFTvALsDIo4cFhXmZEjN3ee", // Required
                admin_callback_url: "http://admin.campfire.fm",
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
        mixpanel: {
            api_key: "a20f53207d150c2e7a293d9dfe62d6ae",
            api_secret: "e2ce4394690de18852ceb8c18f852976"
        },
        mixpanelToken : '09b2a637be266aeb72c61a05ea51e81d',
        algolia : {
            app_id : 'SQIZQNTD1E',
            api_key : '6063c6a1e68779c80c7965f85074148b'
        },
        paypal : {
            client_id : 'Af_15KlMYpYaejaj9jggpmX5woRXprvdi_pkaulc0oXVx5XNY5_vut7LleFUsuQquSN3WsllmlpyVKXv',
            client_secret : 'EObAHnUatUChH3LZKsusmS2zLpbnC-kq-ibCX3fouDm4_e6ggHbzXk9HYDkgBjtWgxliYh-brGJJMvHk'
        },
        twilio : {
            number : '14844168181',
            accountSid : 'AC5d07bea4ae1346c5143af33ec13f074d',
            authToken : '8961a3e9ba921dc52ee5d385ea9771f3'
        },
        notificationType : 'twilio'
	}
};

const env = process.env.NODE_ENV || 'development';

module.exports = configs[env];

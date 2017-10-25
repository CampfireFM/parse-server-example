
//The below config variables are used in initializing the parse applicationa
//and parse dashboard
configs = {
    development: {
        appName: process.env.APP_NAME || 'campfiremedia',
        databaseURI: process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dev',
        appId: process.env.APP_ID || 'maryhadalittlelamb',
        masterKey: process.env.MASTER_KEY || 'whosefleecewaswhiteassnow',
        serverURL: process.env.SERVER_URL || process.env.serverURL || 'http://localhost:1337/parse',
        facebookAppIds: ["984145855062964"],
        baseURL: process.env.baseURL || 'http://d1h7eyqklrpraf.cloudfront.net',
        bucketName: process.env.S3_BUCKET_NAME || 'campfire-files-stage',
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
        stripe_live_key: process.env.STRIPE_KEY, //'sk_test_7D6yb4r&^U2?QCj/u4i}CFE+',
        mailgun: {
            domain: 'mailgun.campfire.fm',
            fromAddress: 'Campfire <postmaster@mailgun.campfire.fm>',
            apiKey: 'key-8603e31c95f12cbd1ac969203c1ff7fe',
            listAddress: 'campfire_ios_users@mailgun.campfire.fm'
        },
        mixpanel: {
            api_key: "a20f53207d150c2e7a293d9dfe62d6ae",
            api_secret: "e2ce4394690de18852ceb8c18f852976"
        },
        mixpanelToken: 'a09156a83517cda592357ca818137887',
        algolia: {
            app_id: 'SQIZQNTD1E',
            api_key: '6063c6a1e68779c80c7965f85074148b',
            answerIndex: process.env.ANSWER_INDEX || 'dev_answers',
            questionIndex: process.env.QUESTION_INDEX || 'questions',
            questionByUserNameIndex: process.env.QUESTION_USERNAME_INDEX || 'questions_by_username',
            userIndex: process.env.USER_INDEX || 'dev_users',
            adminUserIndex: process.env.ADMIN_USER_INDEX || 'dev_users_by_username'
        },
        paypal: {
            mode: process.env.PAYPAL_MODE,
            username: process.env.PAYPAL_USERNAME,
            password: process.env.PAYPAL_PASSWORD,
            signature: process.env.PAYPAL_SIGNATURE,
        },
        twilio: {
            number: '14844168181',
            accountSid: 'AC5d07bea4ae1346c5143af33ec13f074d',
            authToken: '8961a3e9ba921dc52ee5d385ea9771f3'
        },
        branchKey: 'key_live_edqtcFM19DZEOY1Mk2wMimjptFfWP3dv',
        imageGeneratorUrl: process.env.IMAGE_GENERATOR_URL || 'https://k49dg9x0j2.execute-api.us-east-1.amazonaws.com/dev',
        warningReceivers: ['krittylor@gmail.com'],
        redisSchemaUrl: process.env.REDISCLOUD_URL || 'redis://localhost:6379',
        redisCloudCodeUrl: process.env.REDIS_URL || 'redis://localhost:6379',
        appleSecretKey: process.env.APP_SECRET_KEY
    },
    production: {
        appName: process.env.APP_NAME || 'campfiremedia',
        databaseURI: process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dev',
        appId: process.env.APP_ID || 'maryhadalittlelamb',
        masterKey: process.env.MASTER_KEY || 'whosefleecewaswhiteassnow',
        serverURL: process.env.SERVER_URL || process.env.serverURL || 'http://localhost:1337/parse',
        facebookAppIds: ["984145855062964"],
        baseURL: process.env.baseURL || 'http://dl0luablfk015.cloudfront.net',
        bucketName: process.env.S3_BUCKET_NAME || 'campfire-files-prod',
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
        stripe_live_key: process.env.STRIPE_KEY,
        mailgun: {
            domain: 'mailgun.campfire.fm',
            fromAddress: 'Campfire <postmaster@mailgun.campfire.fm>',
            apiKey: 'key-8603e31c95f12cbd1ac969203c1ff7fe',
            listAddress: 'campfire_ios_users@mailgun.campfire.fm'
        },
        mixpanel: {
            api_key: "a20f53207d150c2e7a293d9dfe62d6ae",
            api_secret: "e2ce4394690de18852ceb8c18f852976"
        },
        mixpanelToken: '09b2a637be266aeb72c61a05ea51e81d',
        algolia: {
            app_id: 'SQIZQNTD1E',
            api_key: '6063c6a1e68779c80c7965f85074148b',
            answerIndex: process.env.ANSWER_INDEX || 'prod_answers',
            questionIndex: process.env.QUESTION_INDEX || 'questions',
            questionByUserNameIndex: process.env.QUESTION_USERNAME_INDEX || 'questions_by_username',
            userIndex: process.env.USER_INDEX || 'users',
            adminUserIndex: process.env.ADMIN_USER_INDEX || 'prod_users_by_username'
        },
        paypal: {
            mode: process.env.PAYPAL_MODE,
            username: process.env.PAYPAL_USERNAME,
            password: process.env.PAYPAL_PASSWORD,
            signature: process.env.PAYPAL_SIGNATURE,
        },
        twilio: {
            number: '14844168181',
            accountSid: 'AC5d07bea4ae1346c5143af33ec13f074d',
            authToken: '8961a3e9ba921dc52ee5d385ea9771f3'
        },
        branchKey: 'key_live_edqtcFM19DZEOY1Mk2wMimjptFfWP3dv',
        imageGeneratorUrl: process.env.IMAGE_GENERATOR_URL || 'https://nog8z7rjof.execute-api.us-east-1.amazonaws.com/prod',
        warningReceivers: ['krittylor@gmail.com', 'eric@campfire.fm'],
        redisSchemaUrl: process.env.REDISCLOUD_URL || 'redis://localhost:6379',
        redisCloudCodeUrl: process.env.REDIS_URL || 'redis://localhost:6379',
        appleSecretKey: process.env.APP_SECRET_KEY
    }
};

const env = process.env.NODE_ENV || 'development';

module.exports = configs[env];

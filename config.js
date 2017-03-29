
//The below config variables are used in initializing the parse applicationa
//and parse dashboard
module.exports = {
	appName: process.env.APP_NAME || 'campfiremedia',
	databaseURI: process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dev',
	appId: process.env.APP_ID || 'maryhadalittlelamb',
	masterKey: process.env.MASTER_KEY || 'whosefleecewaswhiteassnow',
	serverURL: process.env.SERVER_URL || process.env.serverURL || 'http://localhost:1337/parse',
	facebookAppIds: ["984145855062964"],
	auth: {
	    twitter: {
	        consumer_key: "sVvr3kgLVpEq9xYvkwA3BUty8", // Required
	        consumer_secret: "32lUjhIvlWjbmvEFN17nzkQJNNIY7kYXYFBQIeNdK64odICfEb" // Required
	    }
	},
	dashboardusers: [{"user":"user","pass":"password"}],
	stripe_test_key : 'sk_test_7D6yb4r&^U2?QCj/u4i}CFE+',
	stripe_live_key : 'sk_test_7D6yb4r&^U2?QCj/u4i}CFE+'
};
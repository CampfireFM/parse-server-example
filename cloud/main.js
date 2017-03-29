

require("../utils/paymenthandler.js");

//include the JS files which represent each classes (models), and contains their operations
require("./models/Answer.js");
require("./models/Campfire.js");
require("./models/CampfireUnlock.js");
require("./models/Follow.js");
require("./models/Like.js");
require("./models/Question.js");


//the below function is just to test if everything is working fine
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});



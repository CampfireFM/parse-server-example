const config = require('../config');
const redis = require("redis"),
  client = redis.createClient(config.redisCloudCodeUrl);

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

client.on("error", function (err) {
  console.log("Error " + err);
});

module.exports = client;
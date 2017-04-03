

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

Parse.Cloud.define('getFeaturedCampfire', function(req, res){
  var campfires = [];
  var limit = req.params.limit || 6;
  var skip =  req.params.skip || 0;

  var Campfire = Parse.Object.extend('Campfire');
  var query = new Parse.Query(Campfire);
  query.equalTo('isDummyData', false);

  query.include(['questionRef', 'answerRef', 'questionRef.fromUser.fullName',
    'questionRef.toUser.fullName']);
  query.descending('createdAt');
  query.limit(limit);
  query.skip(skip);

  query.find({
    success: function(objects) {
      if (objects.length) {
        for (var i = 0; i < objects.length; i++) {
          var object = objects[i];
          var fromUser = object.get('questionRef').get('fromUser');
          var toUser = object.get('questionRef').get('toUser');
          var answerFile = object.get('answerRef').get('answerFile');
          if (answerFile) {
            campfires.push({
              id: object.id,
              question: object.get('questionRef').get('text'),
              answer: answerFile.toJSON().url,
              from: {
                name: fromUser.get('fullName'),
                firstName: fromUser.get('firstName'),
                lastName: fromUser.get('lastName'),
                picture: fromUser.get('profilePhoto') ? (fromUser.get('profilePhoto')).toJSON().url : '',
                cover: fromUser.get('coverPhoto') ? (fromUser.get('coverPhoto')).toJSON().url : '',
                tagline: fromUser.get('tagline')
              },
              to: {
                name: toUser.get('fullName'),
                firstName: toUser.get('firstName'),
                lastName: toUser.get('lastName'),
                picture: toUser.get('profilePhoto') ? (toUser.get('profilePhoto')).toJSON().url : '',
                cover: toUser.get('coverPhoto') ? (toUser.get('coverPhoto')).toJSON().url : '',
                tagline: toUser.get('tagline')
              },
            });
          }
        }
      }
      res.success(campfires);      
    },
    error: function(error) {
      response.error(error);
    }
  })
});



Parse.Cloud.define("updateNewUser", function(request, response) {
  var profilePicFile = null;
  var coverPicFile = null;
  var params = request.params
  var firstname = params.firstName || '';
  var lastname = params.lastName || '';
  var bio = params.bio || '';
  var initial_match_count = 0;
  var Defaults = Parse.Object.extend('Defaults');
  var default_values = null;
  var query = new Parse.Query(Defaults);
  query.limit(1);

  query.find().then(function(defaults){
    default_values = defaults;
    initial_match_count = defaults[0].get('initialMatchCount');
    if(request.user){
      setUserValues(request.user);
    }
    else{
      var id = request.params.id;
      var User = Parse.Object.extend('User');
      var query = new Parse.Query(User);
      query.get(id, {
        success: function(user){
          setUserValues(user);
        },
        error: function(error){
          response.error(error.message);
        }
      })
    }
  },function(error){
    response.error(error.message);
  })

  var setUserValues = function(user){
    user.set('firstName', firstname);
    user.set('lastName', lastname);
    user.set('fullName', firstname + ' ' + lastname)
    user.set('gender', params.gender);
    user.set('email', params.email);
    user.set('bio', params.bio);

    //default values

    user.set('unansweredQuestionCount', 0);
    user.set('missedNotificationCount', 0);
    user.set('matchCount', initial_match_count);
    user.set('questionPrice', 5);
    user.set('accountBalance', '');
    user.set('askAbout', '');
    user.set('tagline', '');
    user.set('donationPercentage', 0);
    user.set('totalEarnings', 0);
    user.set('isTestUser', false);
    user.set('isDummyUser', false);
    
    if(params.profilePicUrl && params.coverPicUrl){
      Parse.Cloud.httpRequest({ url: params.profilePicUrl }).then(function(response) {
        var base64_profile_image = response.buffer.toString('base64');
        profilePicFile = new Parse.File("profile.jpeg", { base64: base64_profile_image });
        profilePicFile.save().then(function() {
          Parse.Cloud.httpRequest({ url: params.coverPicUrl }).then(function(response) {
            var base64_cover_image = response.buffer.toString('base64');
            coverPicFile = new Parse.File("cover.jpeg", { base64: base64_cover_image });
            coverPicFile.save().then(function() {
              user.set('coverPhoto', coverPicFile);
              user.set('profilePhoto', profilePicFile);
              saveUser();
            }, function(error) {
              console.log(error.message);
            });
          });
        }, function(error) {
          console.log(error.message);
        });
      });
    }
    else{
      var default_image = default_values[0].get('coverPhoto');
      user.set('coverPhoto', default_image);
      user.set('profilePhoto', default_image);
      user.save(null, {useMasterKey : true}).then(function(user) {
        response.success(user);
      }, function(error) {
        response.error(error.message);
      });
    }

    var saveUser = function(){
      user.save(null, {useMasterKey : true}).then(function(user) {
        response.success(user);
      }, function(error) {
        response.error(error.message);
      });
    }
  }
});


const {sendPushOrSMS} = require('../common');
Parse.Cloud.afterSave("MatchesReward", function(request) {
  if (request.object.existed())
    return;
  const userRef = request.object.get('userRef');
  const userQuery = new Parse.Query(Parse.User);
  userQuery.get(userRef.id, {useMasterKey: true}).then((user) => {
    user.set('matchesRewardStatus', 'Notified');
    user.save(null, {useMasterKey: true});
    sendPushOrSMS(request.user, user, 'matchesReward');
  }, err => {
    console.log(err);
  })
});
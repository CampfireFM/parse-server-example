Parse.Cloud.define('collectMatchesReward', (request, response) => {
  const userId = request.params.user;
  const userQuery = new Parse.Query(Parse.User);
  userQuery.get(userId, {useMasterKey: true}).then(user => {
    const MatchesReward = Parse.Object.extend('MatchesReward');
    const query = new Parse.Query(MatchesReward);
    query.equalTo('userRef', user);
    query.equalTo('status', 'Notified');
    query.descending('createdAt');
    query.first({useMasterKey: true})
      .then(matchesReward => {
        matchesReward.set('status', 'Collected');
        matchesReward.save(null, {useMasterKey: true});
        user.increment('matchCount', matchesReward.get('matchesCount'));
        return user.save(null, {useMasterKey: true});
      })
      .then((updatedUser) => {
        console.log(updatedUser.get('matchCount'));
        response.success({matchesCount: updatedUser.get('matchCount')});
      })
      .fail((err) => {
        console.log(err);
        response.error(err);
      });
  });
});
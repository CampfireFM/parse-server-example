Parse.Cloud.define('generateTestGroupQuestion', (request, response) => {
  const {fromUserId, groupId, questionText} = request.params;
  const TestGroup = Parse.Object.extend('TestGroup');
  const query = new Parse.Query(TestGroup);
  query.get(groupId, {useMasterKey: true})
    .then(group => {
      const userIds = group.get('users');
      const fromUser = new Parse.Object('_User');
      fromUser.id = fromUserId;
      let promises = [];
      userIds.forEach(userId => {
        const toUser = new Parse.Object('_User');
        toUser.id = userId;
        const question = new Parse.Object('Question');
        question.set('toUser', toUser);
        question.set('isAnswered', false);
        question.set('price', 0);
        question.set('text', questionText);
        question.set('charityPercentage', 0);
        question.set('fromUser', fromUser);
        question.set('isExpired', false);
        question.set('isTest', false);
        promises.push(question.save(null, {useMasterKey: true}));
      });
      Parse.Promise.when(promises)
        .then(() => {
          response.success({});
        })
        .catch(err => {
          console.log(err);
          response.error(err);
        });
    })
    .catch(err => {
      console.log(err);
      response.error(err);
    })
});
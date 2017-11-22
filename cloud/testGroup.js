const Mixpanel = require('mixpanel');
const config = require('../config');
const mixpanel = Mixpanel.init(config.mixpanelToken);
Parse.Cloud.define('generateTestGroupQuestion', (request, response) => {
  const {fromUserId, groupId, questionText, notificationText} = request.params;
  const TestGroup = Parse.Object.extend('TestGroup');
  const query = new Parse.Query(TestGroup);
  const fromUserQuery = new Parse.Query(Parse.User);
  fromUserQuery.get(fromUserId, {useMasterKey: true})
    .then(fromUser => {
      query.get(groupId, {useMasterKey: true})
        .then(group => {
          const userIds = group.get('users');
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

              let data = {
                alert: notificationText,
                tag: 'testGroup',
                objectId: groupId,
                groupName: group.get('name')
              };

              // Send push notification
              userIds.forEach(userId => {
                const toUserQuery = Parse.Query(Parse.User);
                toUserQuery.get(userId, {useMasterKey: true})
                  .then(toUser => {
                    var pushQuery = new Parse.Query(Parse.Installation);
                    pushQuery.equalTo('deviceType', 'ios');
                    pushQuery.equalTo('user', toUser);
                    mixpanel.track('Admin Notification Sent*', {
                      distinct_id: toUser.get('username'),
                      'Receivers ID': toUser.id,
                      'Receivers Name': toUser.get('fullName'),
                      'Notification Type': 'Test Group Notification',
                      'Notification Text': notificationText
                    });
                    mixpanel.track('Questions Asked', {
                      distinct_id: fromUser.get('username'),
                      "Answerer Name": toUser.get('fullName'),
                      "Answerer Id": toUser.id,
                      "Asker Name": fromUser.get('fullName'),
                      "Asker Id": fromUserId,
                      "Question Type": "Admin Test"
                    });
                    mixpanel.people.increment(fromUser.get('username'), {'Questions Asked': 1});
                    Parse.Push.send({
                      where: pushQuery,
                      data: data
                    }, {
                      useMasterKey: true,
                      success: function () {
                        // Push was successful
                      },
                      error: function (error) {
                        throw "PUSH: Got an error " + error.code + " : " + error.message;
                      }
                    });
                  })
                  .catch(err => {
                    console.log(err);
                  })

              })
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
    })
    .catch(err => {
      console.log(err);
      response.error(err);
    })

});
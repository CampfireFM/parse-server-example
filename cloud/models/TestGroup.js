Parse.Cloud.afterSave('TestGroup', function(request) {
    const users = request.object.get('users');
    users.forEach(user => {
        const query = new Parse.Query(Parse.User);
        query.get(user, {useMasterKey: true})
            .then(userObj => {
                const emailSubscriptions = userObj.get('emailSubscriptions');
                let newEmailSubscriptions = [];
                if (emailSubscriptions) {
                    emailSubscriptions.forEach(subscription => {
                        if (subscription != 'questions')
                            newEmailSubscriptions.push(subscription);
                    });
                }

                const pushSubscriptions = userObj.get('pushSubscriptions');
                let newPushSubscriptions = [];
                if (pushSubscriptions) {
                    pushSubscriptions.forEach(subscription => {
                        if (subscription != 'questions')
                            newPushSubscriptions.push(subscription);
                    });
                }

                userObj.set('emailSubscriptions', newEmailSubscriptions);
                userObj.set('pushSubscriptions', newPushSubscriptions);
                userObj.save(null, {useMasterKey: true});
            })
            .catch(err => {
                console.log(err);
            });
    });
});


Parse.Cloud.define('getPushNotificationTexts', function(req, res){
    var pushNotificationTexts = [];
    var sortedBy = req.params.sortedBy || 'createdAt';
    var sortDir = req.params.sortDir || 'desc';
    var page = req.params.currentPage || 1;
    var limit = req.params.perPage || 6;
    var skip = (page - 1) * limit;

    var PushNotificationTexts = Parse.Object.extend('PushNotificationText');
    var query = new Parse.Query(PushNotificationTexts);

    // sorting
    sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy)

    // totalpages count
    var count = 0;

    var findPushNotificationTexts = function () {
        query.find({
            success: function(objects) {
                if (objects.length > 0) {
                    return Parse.Promise.as().then(function () {
                        var promise = Parse.Promise.as();

                        objects.forEach(function (object) {
                            promise = promise.then(function () {
                                pushNotificationTexts.push({
                                    id: object.id,
                                    text: object.get('text'),
                                    type: object.get('type'),
                                    createdAt: object.get('createdAt'),
                                    updatedAt: object.get('updatedAt')
                                });
                            });
                        });
                        return promise;
                    }).then(function () {
                        return res.success({pushNotificationTexts, totalItems: count});
                    }, function (error) {
                        res.error(error);
                    });
                }
                else
                {
                    return res.success({autoQuestions: [], totalItems: 0});
                }
            },
            error: function(error) {
                res.error(error);
            }
        })
    }

    if (!req.params.noPagination) {
        query.count().then(function (result) {
            count = result;
            // pagination
            query.limit(limit);
            query.skip(skip);
            findPushNotificationTexts();
        });
    } else {
        findPushNotificationTexts();
    }
});
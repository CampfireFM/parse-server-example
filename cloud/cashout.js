Parse.Cloud.define('getCashouts', function(req, res){
  var cashouts = [];
  var Tag = Parse.Object.extend('Cashout');
  var query = new Parse.Query(Tag);

  //var sortedBy = req.params.sortedBy || 'createdAt';
  var sortedBy = 'status';
  var sortDir = 'desc';
  var page = req.params.currentPage || 1;
  var limit = req.params.perPage || 6;
  var skip = (page - 1) * limit;


  // totalpages count
  var count;
  query.count().then(function(result){
    count = result;
    sortDir == 'asc' ? query.ascending(sortedBy) : query.descending(sortedBy);

    // pagination
    query.limit(limit);
    query.skip(skip);

    query.include(['userRef']);
    query.find().then(function(objects) {
      if (objects.length) {
        for (var i = 0; i < objects.length; i++) {
          var object = objects[i];
          cashouts.push({
            id: object.id,
            status: object.get('status'),
            userFullName: object.get('userRef').get('fullName'),
            userId: object.get('userRef').id,
            paypalEmail: object.get('paypalEmail')
          });
        }
      }
      res.success({cashouts: cashouts, totalItems: count});
    },function(error) {
      res.error(error.message);
    })
  },function(error) {
    res.error(error.message);
  })
});
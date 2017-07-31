var config = require('../../config');
var algoliasearch = require('./algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);
var { parseToAlgoliaObjects, getAllUsers } = require('../common');
Parse.Cloud.job("Index Users", function(request, status){
  const index = client.initIndex('users');

  //Set Index settings
  index.setSettings({
    searchableAttributes : ['fullName'],
    customRanking : ['asc(firstName)']
  });
  getAllUsers()
    .then(function(users){

      const objectsToIndex = parseToAlgoliaObjects(users);
      // Add or update new objects
      index.saveObjects(objectsToIndex, function (err, content) {
        if (err) {
          console.log(err);
          status.error(err);
          throw err;
        }
        status.success();
      });
    })
    .catch(err => {
      console.log(err);
      status.error(err);
    });
});

var tempIndexName = 'users_temp';
var mainIndexName = 'users';
Parse.Cloud.job("Reindex Users", function(request, status){
  const tempIndex = client.initIndex(tempIndexName);
  var completedCount = 0;
  getAllUsers()
    .then(function(questions, totalCount) {
      // prepare objects to index from contacts
      const objectsToIndex = parseToAlgoliaObjects(questions);
      // Add new objects to temp index
      tempIndex.saveObjects(objectsToIndex, function (err, content) {
        if (err) {
          status.error(err);
          throw err;
        }
        client.moveIndex(tempIndexName, mainIndexName, function (err, content) {
          if (err) {
            status.error(err);
            throw err;
          }
          client.initIndex(mainIndexName).setSettings({
            searchableAttributes: ['fullName'],
            customRanking: ['asc(firstName)']
          });
          status.success();
        });
      });
    })
});
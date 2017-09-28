var config = require('../../config');
var algoliasearch = require('./algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);
var { parseToAlgoliaObjects, getAllUsers } = require('../common');
Parse.Cloud.job("Index Users", function(request, status){
  const index = client.initIndex(config.algolia.userIndex);

  //Set Index settings
  index.setSettings({
    searchableAttributes : ['fullName', 'firstName', 'lastName', 'bio', 'username', 'tagline'],
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

var tempIndexName = config.algolia.userIndex + '_temp';
var mainIndexName = config.algolia.userIndex;
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
            searchableAttributes: ['fullName', 'firstName', 'lastName', 'bio', 'username', 'tagline'],
            customRanking: ['asc(firstName)']
          });
          status.success();
        });
      });
    })
});

Parse.Cloud.job("Index Admin Users", function(request, status){
  const index = client.initIndex(config.algolia.adminUserIndex);

  //Set Index settings
  index.setSettings({
    searchableAttributes : ['fullName'],
    customRanking : ['asc(firstName)']
  });
  getAllUsers(true)
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

var adminUserTempIndex = config.algolia.adminUserIndex + '_temp';
var mainAdminUserIndex = config.algolia.adminUserIndex;
Parse.Cloud.job("Reindex Admin Users", function(request, status){
  const tempIndex = client.initIndex(adminUserTempIndex);
  var completedCount = 0;
  getAllUsers(true)
    .then(function(questions, totalCount) {
      // prepare objects to index from contacts
      const objectsToIndex = parseToAlgoliaObjects(questions);
      // Add new objects to temp index
      tempIndex.saveObjects(objectsToIndex, function (err, content) {
        if (err) {
          status.error(err);
          throw err;
        }
        client.moveIndex(adminUserTempIndex, mainAdminUserIndex, function (err, content) {
          if (err) {
            status.error(err);
            throw err;
          }
          client.initIndex(mainAdminUserIndex).setSettings({
            searchableAttributes: ['fullName'],
            customRanking: ['asc(firstName)']
          });
          status.success();
        });
      });
    })
});
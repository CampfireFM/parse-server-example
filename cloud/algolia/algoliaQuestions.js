var config = require('../../config');
var algoliasearch = require('./algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);


Parse.Cloud.job("Index Question", function(request, status){

    retrieveAllQuestions(function(err, questions){
        if(err){
            console.log('An error occured while retrieving questions');
            status.error(err);
        } else {
            var index = client.initIndex('questions');
            var indexByUsername = client.initIndex('questions_by_username');
            var objectsToIndex = questions.map(function (question) {
                var object = question.toJSON();
                object.objectID = question.id;
                return object;
            });
            // Add or update new objects
            index.saveObjects(objectsToIndex, function (err, content) {
                if (err) {
                    throw err;
                }
                console.log('index question by text<>Algolia import done');
                indexByUsername.save(objectsToIndex, function (err, content){
                    if (err) {
                        throw err;
                    }
                    console.log('index question by username<>Algolia import done');
                    status.success();
                });
            });
        }
    });
});

function retrieveAllQuestions(callback){
    var result = [];
    var chunk_size = 1000;
    var processCallback = function(res) {
        result = result.concat(res);
        if (res.length === chunk_size) {
            process(res[res.length-1].id);
        } else {
            callback(null, result);
        }
    };
    var process = function(skip) {
        var query = new Parse.Query('Question');
        query.include('toUser');
        query.equalTo('isAnswered', true);
        if (skip) {
            query.greaterThan("objectId", skip);
        }
        query.limit(chunk_size);
        query.ascending("objectId");
        query.find().then(function (res) {
            processCallback(res);
        }, function (error) {
            callback(error);
        });
    };
    process(false);
}

var tempIndexName = 'questions_temp';
var mainIndexName = 'questions';
var tempIndexUsername = 'questions_by_username_temp';
var mainIndexUsername = 'questions_by_username';
Parse.Cloud.job("Reindex Question", function(request, status){
    var objectsToIndex = [];
    // Create a temp index
    var tempIndex = client.initIndex(tempIndexName);
    var tempIndexByUsername = client.initIndex(tempIndexUsername);
    retrieveAllQuestions(function(err, questions){
        if(err){
            console.log('An error occured while retrieving questions');
            status.error(err);
        } else {
            // prepare objects to index from contacts
            objectsToIndex = questions.map(function(question) {
                var object = question.toJSON();
                object.objectID = question.id;
                return object;
            });
            // Add new objects to temp index
            tempIndex.saveObjects(objectsToIndex, function(err, content) {
                if (err) {
                    throw err;
                }
                // Overwrite main index with temp index
                client.moveIndex(tempIndexName, mainIndexName, function(err, content) {
                    if (err) {
                        throw err;
                    }
                    tempIndexByUsername.saveObjects(objectsToIndex, function(err, content){
                        if(err){
                            throw err;
                        }
                        // Overwrite main index by username with temp index by username
                        client.moveIndex(tempIndexUsername, mainIndexUsername, function(err, content){
                            if (err) {
                                throw err;
                            }
                            status.success();
                            console.log('Parse<>Algolia reimport done');
                        })
                    })

                });
            });
        }
    });
});

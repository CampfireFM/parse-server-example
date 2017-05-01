var config = require('../../config');
var algoliasearch = require('./algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);
var {questionsToAlgoliaObjects} = require('../common');

Parse.Cloud.job("Index Question", function(request, status){
    const index = client.initIndex('questions');
    const indexByUsername = client.initIndex('questions_by_username');

    //Set Index settings
    index.setSettings({
        searchableAttributes : ['text'],
        customRanking : ['desc(createdAt)']
    });
    indexByUsername.setSettings({
        searchableAttributes : ['toUser.fullName'],
        customRanking : ['desc(createdAt)']
    });
    processAllQuestions(function(err) {
        if (err) {
            console.log('An error occured while retrieving questions');
            return status.error(err);
        }
        console.log('index questions Parse<>Algolia import done');
        status.success();
    }, function(questions){

        const objectsToIndex = questionsToAlgoliaObjects(questions);
        // Add or update new objects
        index.saveObjects(objectsToIndex, function (err, content) {
            if (err) {
                throw err;
            }
            indexByUsername.saveObjects(objectsToIndex, function (err, content){
                if (err) {
                    throw err;
                }
            });
        });
    });
});

function processAllQuestions(callback, fnAddIndex, processAtOnce){
    
    var totalCount;
    var chunk_size = 1000;

    var processCallback = function(res) {
        fnAddIndex(res, totalCount);
        if (res.length === chunk_size) {
            process(res[res.length-1].id);
        } else {
            callback(null);
        }
    };
    var process = function(skip) {
        var query = new Parse.Query('Question');
        query.include('toUser', 'fromUser');
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
    var query = new Parse.Query('Question');
    query.include('toUser', 'fromUser');
    query.equalTo('isAnswered', true);

    query.count({useMasterKey : true}).then(function(count){
        totalCount = count;
        process(false);
    }, function(err){
        console.log(err);
        throw 'An error occured while counting questions ' + err.code + ' : ' + err.message;
    });

}

var tempIndexName = 'questions_temp';
var mainIndexName = 'questions';
var tempIndexUsername = 'questions_by_username_temp';
var mainIndexUsername = 'questions_by_username';
Parse.Cloud.job("Reindex Question", function(request, status){
    const tempIndex = client.initIndex(tempIndexName);
    const tempIndexByUsername = client.initIndex(tempIndexUsername);
    var completedCount = 0;
    processAllQuestions(function(err) {
        if (err) {
            console.log('An error occured while retrieving questions');
            return status.error(err);
        }
        console.log('Reindexing questions Parse<>Algolia completed');
        status.success();
    }, function(questions, totalCount) {
        // prepare objects to index from contacts
        const objectsToIndex = questionsToAlgoliaObjects(questions);
        // Add new objects to temp index
        tempIndex.saveObjects(objectsToIndex, function (err, content) {
            if (err) {
                throw err;
            }
            tempIndexByUsername.saveObjects(objectsToIndex, function (err, content) {
                if (err) {
                    throw err;
                }
                completedCount += questions.length;
                if (completedCount >= totalCount) {
                    // Overwrite main index with temp index
                    client.moveIndex(tempIndexName, mainIndexName, function (err, content) {
                        if (err) {
                            throw err;
                        }
                        client.initIndex(mainIndexName).setSettings({
                            searchableAttributes: ['text'],
                            customRanking: ['desc(createdAt)']
                        });
                        // Overwrite main index by username with temp index by username
                        client.moveIndex(tempIndexUsername, mainIndexUsername, function (err, content) {
                            if (err) {
                                throw err;
                            }
                            client.initIndex(mainIndexUsername).setSettings({
                                searchableAttributes: ['toUser.fullName'],
                                customRanking: ['desc(createdAt)']
                            });
                        });
                    });
                }
            });
        });
    });
});

Parse.Cloud.define('searchQuestions', function(request, response){
    const skip = request.params.skip ? request.params.skip : 0;
    const limit = request.params.limit ? request.params.limit : 0;
    const type = request.params.type ? 'questions' : 'usernames';
    const indexName = type == 'questions' ? 'questions' : 'questions_by_username';
    const index = client.initIndex(indexName);

    const text = request.params.text ? request.params.text : '';

    index.search({
        query : text,
        offset : skip,
        length : limit < 1000 ? limit : 1000
    }, function(err, results){
        if(err){
            console.log(err);
            response.error(err);
        }
        console.log(results);
        response.success(results);
    });
});
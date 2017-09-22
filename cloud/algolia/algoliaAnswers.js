var config = require('../../config');
var algoliasearch = require('./algoliaSearch.parse.js');
var client = algoliasearch(config.algolia.app_id, config.algolia.api_key);
var {parseToAlgoliaObjects} = require('../common');

Parse.Cloud.job("Index Answers", function(request, status){
    const index = client.initIndex(config.algolia.answerIndex);

    //Set Index settings
    index.setSettings({
        searchableAttributes : ['questionRef.text'],
        customRanking : ['desc(createdAt)']
    });
    processAllAnswers(function(err) {
        if (err) {
            console.log('An error occured while retrieving questions');
            return status.error(err);
        }
        console.log('index Answers Parse<>Algolia import done');
        status.success();
    }, function(answers){

        const objectsToIndex = parseToAlgoliaObjects(answers);
        // Add or update new objects
        index.saveObjects(objectsToIndex, function (err, content) {
            if (err) {
                throw err;
            }
        });
    });
});

function processAllAnswers(callback, fnAddIndex, processAtOnce){
    
    var totalCount;
    var chunk_size = 100;

    var processCallback = function(res) {
        fnAddIndex(res, totalCount);
        if (res.length === chunk_size) {
            process(res[res.length-1].id);
        } else {
            callback(null);
        }
    };
    var process = function(skip) {
        var Answer = Parse.Object.extend('Answer');
        var query = new Parse.Query(Answer);
        var Question = Parse.Object.extend('Question');
        var questionQuery = new Parse.Query(Question);
        questionQuery.notEqualTo('isTest', true);
        query.matchesQuery('questionRef', questionQuery);
        query.include('questionRef', 'questionRef.charity', 'questionRef.toUser', 'questionRef.fromUser');
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
    var query = new Parse.Query('Answer');
    query.count({useMasterKey : true}).then(function(count){
        totalCount = count;
        process(false);
    }, function(err){
        console.log(err);
        throw 'An error occured while counting questions ' + err.code + ' : ' + err.message;
    });

}

var tempIndexName = config.algolia.answerIndex + '_temp';
var mainIndexName = config.algolia.answerIndex;
Parse.Cloud.job("Reindex Answers", function(request, status){
    const tempIndex = client.initIndex(tempIndexName);
    var completedCount = 0;
    processAllAnswers(function(err) {
        if (err) {
            console.log('An error occured while retrieving questions');
            return status.error(err);
        }
        console.log('Reindexing answers Parse<>Algolia completed');
        status.success();
    }, function(questions, totalCount) {
        // prepare objects to index from contacts
        const objectsToIndex = parseToAlgoliaObjects(questions);
        // Add new objects to temp index
        tempIndex.saveObjects(objectsToIndex, function (err, content) {
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
                        searchableAttributes: ['questionRef.text'],
                        customRanking: ['desc(createdAt)']
                    });
                });
            }
        });
    });
});

var Answer = Parse.Object.extend('Answer');
var query = new Parse.Query(Answer);
var Question = Parse.Object.extend('Question');
var questionQuery = new Parse.Query(Question);
questionQuery.notEqualTo('isTest', true);
query.matchesQuery('questionRef', questionQuery);

query.count({useMasterKey: true}).then(count => {
    console.log(count)
})
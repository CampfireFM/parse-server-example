var https = require("https");
var request = require('request');
var fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

var speech = require('@google-cloud/speech')({
  projectId: 'campfire-speech',
  credentials: JSON.parse(process.env.GOOGLE_AUTH)
});

var googleStorage = require('@google-cloud/storage')({
  projectId: 'campfire-speech',
  credentials: JSON.parse(process.env.GOOGLE_AUTH)
});

var bucketName = 'campfires'
var bucket = googleStorage.bucket(bucketName);

var Answer = Parse.Object.extend('Answer');
var query = new Parse.Query(Answer);

Parse.Cloud.define('transcribeAudio', function(req, res){
    res.success({});
    //var answerObj = req.params.answer_object
    //var audioUrl = answerObj.answer
    //var filePath = audioUrl.split('/').pop();
    //var fileName = filePath.split('.').slice(0,-1).join('.')
    //filePath = 'public/' + filePath
    //
    //var bucketFile = bucket.file(fileName + '.flac');
    //
    //var speechContexts = answerObj.answererAskerName.split(' ')
    //var speechContexts = speechContexts.concat(answerObj.question.split(' '))
    //
    //if(speechContexts.length > 500){
    //    speechContexts = speechContexts.slice(0,499)
    //}
    //var flacFilePath = 'public/' + fileName + '.flac'
    //
    //function convertAndUpload(){
    //    var tmpFileStream = fs.createWriteStream(filePath);
    //
    //    tmpFileStream.on('open', function () {
    //        https.get(audioUrl, function (response) {
    //            response.on('error', function (err) {
    //                res.error({message: 'Could not fetch audio file.'})
    //            });
    //
    //            response.pipe(tmpFileStream);
    //        });
    //    }).on('error', function (err) {
    //        res.error({message: 'Something went wrong while fetching audio file'});
    //    }).on('finish', function () {
    //        // convert to flac
    //
    //        ffmpeg()
    //            .input(filePath)
    //            .audioCodec('flac')
    //            .audioChannels(1)
    //            .audioFrequency(16000)
    //            .outputOptions('-sample_fmt s16')
    //            .save(flacFilePath)
    //            .on('start', () => {
    //                console.log('Starting file encoding to flac');
    //            })
    //            .on('end', () => {
    //                console.log('File encoded to flac');
    //
    //                bucket.upload(flacFilePath, function(err, file, apiResponse) {
    //                    transcribe();
    //                });
    //            });
    //    });
    //}
    //
    //bucketFile.exists(function(err, exists) {
    //    if(exists)
    //        transcribe();
    //    else {
    //        convertAndUpload();
    //    }
    //});
    //
    //function transcribe(){
    //    fs.unlink(filePath, function(err){
    //        if(err){
    //            console.log("unlink failed")
    //        }
    //    })
    //    var config = {
    //       encoding: 'FLAC',
    //       sampleRateHertz: 16000,
    //       languageCode: 'en-US',
    //       speechContexts: [{
    //            phrases: speechContexts
    //       }]
    //    }
    //
    //    function callback(err, transcript, apiResponse) {
    //        fs.unlink(flacFilePath, function(err){
    //            if(err){
    //                console.log("unlink failed")
    //            }
    //        })
    //
    //        if (err) {
    //            res.error(err);
    //        }
    //
    //        query.equalTo("objectId",answerObj.id);
    //        query.find().then(function(objects){
    //            answer = objects[0]
    //            answer.set('transcription', transcript)
    //            answer.set('transcriptStatus', 'complete')
    //            answer.save(null, {useMasterKey : true}).then(function(saved_answer){
    //                res.success({transcript: transcript, answer_id: answerObj.id})
    //            }, function(err){
    //                res.error(error.message)
    //            })
    //        }, function(err){
    //            res.error(error.message)
    //        })
    //    }
    //
    //    speech.recognize('gs://'+ bucketName +'/'+ fileName + '.flac', config, callback)
    //}
})

var http = require("http");
var request = require('request');
var fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

var Answer = Parse.Object.extend('Answer');
var query = new Parse.Query(Answer);

Parse.Cloud.define('transcribeAudio', function(req, res){
    var answerObj = req.params.answer_object
    var audioUrl = answerObj.answer
    var filePath = audioUrl.split('/').pop();
    var fileName = filePath.split('.').slice(0,-1).join('.')

    var speechContexts = answerObj.answererAskerName.split(' ')
    var speechContexts = speechContexts.concat(answerObj.question.split(' '))

    if(speechContexts.length > 500){
        speechContexts = speechContexts.slice(0,499)
    }
    var flacFilePath = fileName + '.flac'

    var tmpFileStream = fs.createWriteStream(filePath);

    tmpFileStream.on('open', function () {
        http.get(audioUrl, function (response) {
            response.on('error', function (err) {
                res.error({message: 'Could not fetch audio file.'})
            });

            response.pipe(tmpFileStream);
        });
    }).on('error', function (err) {
        res.error({message: 'Something went wrong while fetching audio file'});
    }).on('finish', function () {
        // convert to flac

        ffmpeg()
            .input(filePath)
            .audioCodec('flac')
            .audioChannels(1)
            .audioFrequency(16000)
            .outputOptions('-sample_fmt s16')
            .save(flacFilePath)
            .on('start', () => {
                console.log('Starting file encoding to flac');
            })
            .on('end', () => {
                console.log('File encoded to flac');
                transcribe();
            });
    });

    function transcribe(){
        fs.unlinkSync(filePath);
        var flacData = fs.readFileSync(flacFilePath)
        var payload = {
            'config': {
                'encoding': 'FLAC',
                'sampleRateHertz': 16000,
                'languageCode': 'en-US',
                'speechContexts': {
                    'phrases': speechContexts
                }
            },
            'audio': {
                'content': flacData.toString('base64'),
            }
        }

        request.post(
            'https://speech.googleapis.com/v1/speech:recognize?key=AIzaSyDhikSb8ZlWuKq7shhEPpOyvfuy6RA5IAQ',
            { json: payload },
            function (error, response, body) {
                fs.unlinkSync(flacFilePath);
                if(response.body.error){
                    console.log(response.body)
                    res.error(response.body.error)
                }
                else if(response.body.results){
                    console.log(response.body.results[0]['alternatives'][0]['transcript']);
                }
                else{
                    console.log(response)
                }
            }
        );
    }
})

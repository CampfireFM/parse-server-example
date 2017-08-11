const { generateShareImage, getAllUsers, generateAnswerShareImage, getAllAnswers } = require('./common');
const Promise = require('promise');

Parse.Cloud.job("Generate User Share Images", function(request, status) {
    getAllUsers().then(users => {
        function generateSocialImage(index) {
            if (index === users.length) {
                console.log('Completed');
                status.success();
                return;
            }
            console.log(`Processing ${index} user`);
            const user = users[index];
            generateShareImage(user.id)
                .then(() => generateSocialImage(index + 1))
                .catch((err) => {
                    console.log(err);
                    generateSocialImage(index + 1);
                });
        }
        
        generateSocialImage(0);
    }).catch(err => {
        console.log(err);
        status.error(err);
        throw err;
    });
});


Parse.Cloud.job("Generate Answer Share Images", function(request, status) {
    getAllAnswers().then(answers => {
        function generateSocialAnswerImage(index) {
            if (index === answers.length) {
                console.log('Completed');
                status.success();
                return;
            }
            console.log(`Processing ${index} answer`);
            const answer = answers[index];
            if (answers[index].get('image')){
                console.log(`Skipping answer ${index}`);
                generateSocialAnswerImage(index + 1);
            } else {
                generateAnswerShareImage(answer.id)
                    .then(() => generateSocialAnswerImage(index + 1))
                    .catch((err) => {
                        console.log(err);
                        generateSocialAnswerImage(index + 1);
                    });
            }
        }
        generateSocialAnswerImage(0);
    }).catch(err => {
        console.log(err);
        status.error(err);
        throw err;
    });
});

const { generateShareImage } = require('./common');
const Promise = require('promise');

Parse.Cloud.job("Generate Share Images", function(request, status) {
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
        throw err;
    });
});

function getAllUsers() {
    return new Promise((resolve, reject) => {
        var result = [];
        var chunk_size = 1000;
        var processCallback = function(res) {
            result = result.concat(res);
            if (res.length === chunk_size) {
                process(res[res.length-1].id);
            } else {
                resolve(result);
            }
        };
        var process = function(skip) {
            var query = new Parse.Query(Parse.User);
            if (skip) {
                query.greaterThan("objectId", skip);
            }
            query.select(['profilePhoto', 'charityRef']);
            query.include(['charityRef']);
            query.limit(chunk_size);
            query.ascending("objectId");
            query.find().then(function (res) {
                processCallback(res);
            }, function (error) {
                reject(err);
            });
        };
        process(false);
    })
}

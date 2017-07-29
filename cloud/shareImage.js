const { generateShareImage, getAllUsers } = require('./common');
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

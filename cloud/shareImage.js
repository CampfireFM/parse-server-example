const phantom = require('phantom');
const Promise = require('promise');
let sitepage = null;
let phInstance = null;

const logoImageUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/logo.png';
const backgroundCharityImageUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/background-charity.png';
const backgroundNoCharityImageUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/background-nocharity.png';
const listenUrl = 'http://campfiremedia.herokuapp.com/public/assets/images/listen.png';
const defaultAvatarUrl = 'https://campfiremedia.herokuapp.com/parse/files/maryhadalittlelamb/cdfa632577c4636d3a93d83cd88407ce_default_avatar.png';

function getShareImageAndExistence(user, charity) {
    return new Promise((resolve, reject) => {
        const ShareImage = Parse.Object.extend('ShareImage');
        const query = new Parse.Query(ShareImage);
        query.equalTo('userRef', user);
        query.equalTo('charityRef', charity);
        query.include(['charityRef', 'userRef']);
        query.first({useMasterKey: true}).then(function(shareImage) {
            if (!shareImage) {
                return resolve({isExisting: false});
            }
            if (charity) {
                if (charity.get('image').name() === shareImage.get('charityRef').get('image').name()
                    && (user.get('profilePhoto') && user.get('profilePhoto').name()) === (shareImage.get('userRef').get('profilePhoto') === shareImage.get('userRef').get('profilePhoto').name()))
                    return resolve({isExisting: true, shareImage});
                return resolve({isExisting: false, shareImage});
            } else {
                if ((user.get('profilePhoto') && user.get('profilePhoto').name()) === (shareImage.get('userRef').get('profilePhoto') && shareImage.get('userRef').get('profilePhoto').name()))
                    return resolve({isExisting: true, shareImage});
                else
                    return resolve({isExisting: false, shareImage});
            }
        }, function(err) {
            reject(err);
        });
    });
}
Parse.Cloud.job("Generate Share Images", function(request, status) {
    phantom.create()
        .then(instance => {
            phInstance = instance;
            return instance.createPage();
        })
        .then(page => {
            sitepage = page;
            return page.property('viewportSize', {width: 1024, height: 512});
        })
        .then(() => {
            return sitepage.property('content', '<html><head></head><body><div id="test"><canvas id="canvas" width="1024px" height="512px"></canvas></div></body>')
        })
        .then(() => {
            getAllUsers().then(users => {
                function generateSocialImage(index) {
                    if (index === users.length){
                        console.log('Completed');
                        phInstance.exit();
                        status.success();
                        return;
                    }
                    console.log(`Processing ${index} user`);
                    const user = users[index];
                    const charity = user.get('charityRef');
                    getShareImageAndExistence(user, charity)
                        .then(({isExisting, shareImage}) => {
                            if (!isExisting) {
                                let charityImageUrl;
                                let backgroundImageUrl;
                                let charityOrgName;
                                if (charity) {
                                    charityImageUrl = charity.get('image').url();
                                    backgroundImageUrl = backgroundCharityImageUrl;
                                    charityOrgName = charity.get('name')
                                } else {
                                    charityImageUrl = listenUrl;
                                    backgroundImageUrl = backgroundNoCharityImageUrl;
                                }
                                let profilePhotoUrl;
                                if (user.get('profilePhoto'))
                                    profilePhotoUrl = user.get('profilePhoto').url();
                                else
                                    profilePhotoUrl = defaultAvatarUrl;

                                sitepage.evaluate(generateImage, profilePhotoUrl, charityImageUrl, logoImageUrl, backgroundImageUrl, charityOrgName).then();

                                setTimeout(() => {
                                    sitepage.evaluate(function() {
                                        if (window.isLoaded)
                                            return document.getElementById('canvas').toDataURL();
                                        return 'NOT_LOADED';
                                    }).then(res => {
                                        const t = res;
                                        console.log(t.substr(0, 10));
                                        if (t !== 'NOT_LOADED') {
                                            // Save share image
                                            if (!shareImage) {
                                                const newShareImage = new Parse.Object('ShareImage');
                                                newShareImage.set('userRef', user);
                                                if (charity)
                                                    newShareImage.set('charityRef', charity);
                                                var file = new Parse.File('social' + '.png', {base64: t}, 'image/png');
                                                newShareImage.set('image', file);
                                                newShareImage.save(null, {useMasterKey: true}).then(() => {}, err => console.log(err))
                                                console.log(`Creating share image for ${user.get('fullName')}`);
                                            } else {
                                                var file = new Parse.File('social' + '.png', {base64: t}, 'image/png');
                                                shareImage.set('image', file);
                                                shareImage.save(null, {useMasterKey: true}).then(() => {}, err => console.log(err));
                                                console.log(`Updating share image for ${user.get('fullName')}`);
                                            }
                                            generateSocialImage(index + 1);
                                        } else {
                                            console.log(`Retrying to generate share image for ${user.get('fullName')}`);
                                            generateSocialImage(index);
                                        }
                                    })
                                }, 5000);
                            } else {
                                console.log(`Skipping... Share image already exists for ${user.get('fullName')}`);
                                generateSocialImage(index + 1);
                            }
                        })
                        .catch(err => {
                            console.log(err);
                            generateSocialImage(index + 1);
                        })
                }
                generateSocialImage(0);
            }).catch(err => {
                console.log(err);
                throw err;
            });
        })
        .catch(err => {
            console.log(err);
            phInstance.exit();
        });
});

function generateImage(profilePhoto, coverPhoto, logoUrl, backUrl, charityName) {
    window.isLoaded = false;
    const isCharity = !!charityName;
    var canvas = document.getElementById("canvas");

    var ctx = canvas.getContext("2d");
    console.log(backUrl);
    var img2 = loadImage(backUrl, drawBackground);
    var img1, img3, img4;
    const width = 1024;
    const height = 512;
    const widthUnit = width / 10;
    const radius = widthUnit;
    const centerY = isCharity ? height * 2 / 3 : height * 0.613;
    var loadedImages = 0;

    function checkAndUploadShareImage() {
        if (loadedImages === 3) {
            // const xhr = new XMLHttpRequest();
            // console.log(xhr);
            // xhr.open("POST", "http://4f3b72cb.ngrok.io/uploadSocialImage");
            // xhr.setRequestHeader("Content-Type", "application/json");
            // const data = canvas.toDataURL();
            // // xhr.send(JSON.stringify({ userId: userId, charityId:charityId , base64Image: canvas.toDataURL()}));
            // xhr.send(JSON.stringify({ userId: "SSJQ8mW13x", base64Image: data}));
            window.isLoaded = true;
        }
    }
    function drawBackground() {
        ctx.save();
        ctx.drawImage(img2, 0, 0, width, height);
        ctx.font = '36px Nunito,sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        if (isCharity)
            ctx.fillText('Ask me a question, support ' + charityName, width / 2, height * 1.7 / 5);
        ctx.restore();
        img1 = loadImage(profilePhoto, drawProfilePhoto);
        img3 = loadImage(coverPhoto, drawCharity);
        img4 = loadImage(logoUrl, drawCampfireLogo);
    }

    function drawCampfireLogo() {
        ctx.save();
        ctx.beginPath();

        ctx.arc(widthUnit * 2, centerY, radius - 3, 0, Math.PI * 2, true);

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img4, widthUnit * 2 - radius + 3, centerY - radius, radius * 2, radius * 2);

        ctx.restore();
        loadedImages++;
        checkAndUploadShareImage();
    }

    function drawProfilePhoto() {

        ctx.save();
        ctx.beginPath();
        ctx.arc(widthUnit * 5 + 0.5, centerY, radius - 3, 0, Math.PI * 2, true);

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img1, widthUnit * 5 - radius + 3, centerY - radius, radius * 2, radius * 2);

        ctx.restore();
        loadedImages++;
        checkAndUploadShareImage();
    }

    function drawCharity() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(widthUnit * 8 + 1.5, centerY, radius - 3, 0, Math.PI * 2, true);

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img3, widthUnit * 8 - radius + 3, centerY - radius, radius * 2, radius * 2);

        ctx.restore();
        loadedImages++;
        checkAndUploadShareImage();
    }

    //
    function loadImage(src, onload) {
        var img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = onload;
        img.src = src;
        return img;
    }
}

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
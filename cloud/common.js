
function checkPushSubscription(user, type){
    var pushSubscriptions = user.get('pushSubscriptions');

    //Search subscription type in array
    if(pushSubscriptions == undefined || pushSubscriptions.indexOf(type) == -1)
        return false;
    return true;
}

function checkEmailSubscription(user, type){
    var emailSubscriptions = user.get('emailSubscriptions');

    //Search subscription type in array
    if(emailSubscriptions == undefined || emailSubscriptions.indexOf(type) == -1)
        return false;
    return true;
}
module.exports = {checkPushSubscription, checkEmailSubscription};
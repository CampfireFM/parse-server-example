Parse.Cloud.afterSave('ProductPurchase', function(request){
    var userRef = request.object.get('userRef');
    var productRef = request.object.get('productRef');

    productRef.fetch({useMasterKey: true}).then(function(product){
        userRef.fetch({useMasterKey: true}).then(function(user){
            //Create deposit
            var deposit = new Parse.Object("Deposit");
            deposit.set('userRef', user);
            deposit.set('amount', product.get('cost') * 0.7);
            deposit.save(null, {useMasterKey: true});
        })
    })
});
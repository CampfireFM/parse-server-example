const wrapper = require('co-express');

Parse.Cloud.afterSave('List', function(request) {

    const type = request.object.get('type');
    //Consider list type equals to 'qotd'
    if(type === 'qotd'){
        const questionRef = request.object.get('questionRef');
        questionRef.fetch({useMasterKey: true}).then(function(question){
            //Remove reference to this list in all questions
            const Question = Parse.Object.extend('Question');
            const removeQuery = new Parse.Query(Question);

            removeQuery.equalTo('list', request.object);
            removeQuery.find({useMasterKey: true}).then(function(questions){
                if(questions.length > 0){
                    const totalCount = questions.length;
                    questions.forEach(wrapper(function*(question){
                        question.set('list', undefined);
                        yield question.save(null, {useMasterKey: true});
                    }));
                }
                if(question){
                    //Ensure referred question has pointer to this list
                    question.set('list', request.object);
                    question.save(null, {useMasterKey: true}).then(function(res){
                        console.log(res);
                    }, function(err){
                        console.log(err);
                    });
                }
            }, function(err){
                console.log(err);
                throw err;
            });
        }, function(err){
            console.log(err);
            throw err;
        });
    }
});

(function test(){
    var Question = Parse.Object.extend('Question');
    var query = new Parse.Query(Question);
    query.equalTo('objectId', 'VAHNyJMLZj');
    query.first({useMasterKey: true}).then(function(res){
        res.set('list', null);
        res.save(null, {useMasterKey: true});
    })

})();
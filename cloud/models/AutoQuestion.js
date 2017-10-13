Parse.Cloud.define('deleteAllAutoQuestions', (req, res) => {
    const AutoQuestion = Parse.Object.extend('AutoQuestions');
    const query = new Parse.Query(AutoQuestion);
    query.each(autoQuestion => {
        return autoQuestion.destroy({useMasterKey: true});
    })
})


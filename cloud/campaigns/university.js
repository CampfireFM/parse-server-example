const branch = require('node-branch-io');
const Promise = require('promise');
const wrapper = require('co-express');
const config = require('../../config');
const generateCampaignUrl = (id, universityName, group) => {
  return new Promise((resolve, reject) => {
    branch.link.create(config.branchKey, {
      channel: '',
      feature: '',
      data: {
        id: id,
        universityName: universityName,
        group: group,
        clickedOn: 'University Campaign'
      }
    }).then(function(link) {
      resolve(link.url);
    }).catch(function(err){
      console.log(err);
      reject(err);
    })
  })
};
Parse.Cloud.job('CreateUniversityCampaignUrls', (req, res) => {
  const University = Parse.Object.extend('Universities');
  const universityQuery = new Parse.Query(University);

  universityQuery.find({useMasterKey: true})
    .then(universities => {
      let index = 0;
      universities.forEach(wrapper(function*(university) {
        try {
          const ebUrl = yield generateCampaignUrl(university.id, university.get('universityName'), 'ENTREPRENEUR/BUSINESS');
          const lgbtqUrl = yield generateCampaignUrl(university.id, university.get('universityName'), 'LGBTQ');
          const fwRightsUrl = yield generateCampaignUrl(university.id, university.get('universityName'), `FEMINISM/WOMEN'S RIGHTS`);
          const sgUrl = yield generateCampaignUrl(university.id, university.get('universityName'), 'STUDENT GOVERNMENT ');
          const caUrl = yield generateCampaignUrl(university.id, university.get('universityName'), 'CANCER AWARENESS');
          university.set('ebUrl', ebUrl);
          university.set('lgbtqUrl', lgbtqUrl);
          university.set('fwRightsUrl', fwRightsUrl);
          university.set('sgUrl', sgUrl);
          university.set('caUrl', caUrl);
          university.save({useMasterKey: true}).then(res => {
            console.log('Successfully created urls for university: ', university.get('universityName'));
          }, err => {
            console.log('Failed to create url for university: ', university.get('universityName'));
          });
        } catch(err) {
          throw err;
        }
      }));
      res.success();
    }, err => {
      console.log(err);
      throw err;
    })
});
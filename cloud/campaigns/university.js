const branch = require('node-branch-io');
const Promise = require('promise');
const wrapper = require('co-express');
const config = require('../../config');
const generateCampaignUrl = (id, universityName, group, groupNumber, universityNumber) => {
  return new Promise((resolve, reject) => {
    branch.link.create(config.branchKey, {
      channel: 'University Links',
      campaign: 'Universtiy Campaign',
      feature: 'getCampfire',
      alias: `${id}${groupNumber}${universityNumber}`,
      stage: universityName,
      tags: [group],
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

//(function generateUrl() {
//  const json2csv = require('json2csv');
//  const University = Parse.Object.extend('Universities');
//  const universityQuery = new Parse.Query(University);
//  universityQuery.ascending('createdAt');
//  const universitiesTemp = [];
//  universityQuery.find({useMasterKey: true})
//    .then(wrapper(function*(universities){
//      let index = 0;
//      //for (let i = 2; i < 100; i++) {
//      //  const university = universities[i];
//      //  try {
//      //    const ebUrl = yield generateCampaignUrl(university.id, university.get('universityName'), 'ENTREPRENEUR/BUSINESS',1, i + 1);
//      //    const lgbtqUrl = yield generateCampaignUrl(university.id, university.get('universityName'), 'LGBTQ', 2, i + 1);
//      //    const fwRightsUrl = yield generateCampaignUrl(university.id, university.get('universityName'), `FEMINISM/WOMEN'S RIGHTS`, 3, i + 1);
//      //    const sgUrl = yield generateCampaignUrl(university.id, university.get('universityName'), 'STUDENT GOVERNMENT', 4, i + 1);
//      //    const caUrl = yield generateCampaignUrl(university.id, university.get('universityName'), 'CANCER AWARENESS', 5, i + 1);
//      //    university.set('ebUrl', ebUrl);
//      //    university.set('lgbtqUrl', lgbtqUrl);
//      //    university.set('fwRightsUrl', fwRightsUrl);
//      //    university.set('sgUrl', sgUrl);
//      //    university.set('caUrl', caUrl);
//      //    university.save({useMasterKey: true}).then(res => {
//      //      console.log('Successfully created urls for university: ', university.get('universityName'));
//      //    }, err => {
//      //      console.log('Failed to create url for university: ', university.get('universityName'));
//      //    });
//      //    universitiesTemp.push(university);
//      //  } catch(err) {
//      //    throw err;
//      //  }
//      //}
//      const universityObjects = universities.map(university => university.toJSON());
//      const fs = require('fs');
//      const csv = json2csv({data: universityObjects, fields: Object.keys(universityObjects[0])});
//      fs.writeFile(`./universities.csv`, csv, function(err) {
//        if (err) throw err;
//        console.log('file saved');
//      });
//    }), err => {
//      console.log(err);
//      throw err;
//    })
//})();
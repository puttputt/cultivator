'use strict';
var strava = require('strava-v3');
var request = require('request-promise');
const { promisify } = require('util');

const clubId = 517228;
const firstSegmentEntryDistance = 40068.3;
const firstSegmentEntryMovingTime = 4753;

const client_id = process.env.STRAVA_CLIENT_ID;
const client_secret = process.env.STRAVA_CLIENT_SECRET;
const refresh_token = process.env.STRAVA_REFRESH_TOKEN;

let access_token = '';

module.exports.club = async (event, context) => {

  try {
    const authResult = JSON.parse(await auth());
    access_token = authResult.access_token;

    const clubPromise = getClub();
    const membersPromise = getMembers();
    const activitiesPromise = getActivities();

    const club = await clubPromise;
    const members = await membersPromise;
    const activities = await activitiesPromise;

  } catch (error) {
    const response = {
      statusCode: 400,
      body: JSON.stringify(error)
    };

    return response;
  }

  members.forEach((member) => {
    const name = `${member.firstname} ${member.lastname}`;
    if (activities[name]) {
      member['activities'] = activities[name].activities;
    }
  });

  club['members'] = members;

  const response = {
    statusCode: 200,
    body: JSON.stringify(club)
  };

  return response;
};

async function auth() {
  return request.post(`https://www.strava.com/oauth/token?grant_type=refresh_token&refresh_token=${refresh_token}&client_id=${client_id}&client_secret=${client_secret}`);
}

async function getMembers() {
  const listMembers = promisify(strava.clubs.listMembers);
  return listMembers({ id: clubId, access_token: access_token });
}

async function getClub() {
  const get = promisify(strava.clubs.get);
  return get({ id: clubId, access_token: access_token });
}

async function getActivities() {
  const listActivities = promisify(strava.clubs.listActivities);

  const activities = await listActivities({ id: clubId, access_token: access_token });

  let cleanPayload = [];
  for (let i = 0; i < activities.length; i++) {
    if (activities[i].distance === firstSegmentEntryDistance && activities[i].moving_time === firstSegmentEntryMovingTime) {
      break;
    } else {
      cleanPayload.push(activities[i]);
    }
  }

  const cleanMap = cleanPayload.map(item => {

    let newItem = item.athlete;
    item.athlete = null;
    newItem["activities"] = [item];
    return newItem;
  });

  let result = {};
  cleanMap.forEach((item) => {
    const name = `${item.firstname} ${item.lastname}`;

    if (result[name]) {
      result[name].activities = result[name].activities.concat(item.activities);
    } else {
      result[name] = item;
    }
  })

  return result;
}

// cloudFunctions/cleanupChannels.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.cleanupChannels = functions.database.ref('/channels/{channelId}/participants/{userId}').onDelete(async (snapshot, context) => {
  const { channelId, userId } = context.params;
  await admin.database().ref(`/signals/${channelId}/${userId}`).remove();
  console.log(`Cleaned up signaling data for ${userId} in ${channelId}`);
});

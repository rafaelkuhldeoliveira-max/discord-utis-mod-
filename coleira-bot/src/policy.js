'use strict';
function mayEnroll(active, ownerChannel, memberChannel) {
  return Boolean(active && ownerChannel && ownerChannel === memberChannel);
}
function shouldFollow(active, enrolled, from, to, memberChannel) {
  return Boolean(active && enrolled && from && to && from !== to && memberChannel === from);
}
function optedOut(previous, next, ownerChannel) {
  return Boolean(previous && next !== ownerChannel);
}
function validDiscordId(id) {
  return typeof id === 'string' && /^\d{15,22}$/.test(id);
}
function validPair(followerId,leaderId) {
  return Boolean(validDiscordId(followerId) && validDiscordId(leaderId) && followerId !== leaderId);
}
function mayEnrollPair(active,memberId,followerId,leaderChannel,memberChannel) {
  return Boolean(memberId === followerId && mayEnroll(active,leaderChannel,memberChannel));
}
function shouldFollowPair(active,memberId,followerId,enrolled,from,to,memberChannel) {
  return Boolean(memberId === followerId && shouldFollow(active,enrolled,from,to,memberChannel));
}
module.exports = { mayEnroll, shouldFollow, optedOut, validDiscordId, validPair, mayEnrollPair, shouldFollowPair };

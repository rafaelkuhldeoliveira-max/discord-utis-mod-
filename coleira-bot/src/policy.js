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
module.exports = { mayEnroll, shouldFollow, optedOut };

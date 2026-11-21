'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mayEnroll, shouldFollow, optedOut, validPair, mayEnrollPair, shouldFollowPair } = require('../src/policy');
test('autorizar apenas na chamada do dono enquanto ativo', () => {
  assert.equal(mayEnroll(true, 'A', 'A'), true);
  assert.equal(mayEnroll(false, 'A', 'A'), false);
  assert.equal(mayEnroll(true, 'A', 'B'), false);
  assert.equal(mayEnroll(true, null, 'A'), false);
});
test('mover somente inscrito presente no canal antigo', () => {
  assert.equal(shouldFollow(true, true, 'A', 'B', 'A'), true);
  assert.equal(shouldFollow(true, false, 'A', 'B', 'A'), false);
  assert.equal(shouldFollow(true, true, 'A', 'B', 'C'), false);
  assert.equal(shouldFollow(false, true, 'A', 'B', 'A'), false);
});
test('troca voluntaria ou saida cancela a inscricao', () => {
  assert.equal(optedOut('A', null, 'B'), true);
  assert.equal(optedOut('A', 'C', 'B'), true);
  assert.equal(optedOut('A', 'B', 'B'), false);
});

test('vinculo manual precisa de dois IDs validos e diferentes',()=>{
  assert.equal(validPair('123456789012345678','987654321098765432'),true);
  assert.equal(validPair('123456789012345678','123456789012345678'),false);
  assert.equal(validPair('123','987654321098765432'),false);
  assert.equal(validPair('abc123','987654321098765432'),false);
  assert.equal(validPair('123456789012345678',''),false);
});
test('somente o ID participante configurado pode autorizar o acompanhamento',()=>{
  const follower='123456789012345678';
  assert.equal(mayEnrollPair(true,follower,follower,'VOICE_A','VOICE_A'),true);
  assert.equal(mayEnrollPair(true,'987654321098765432',follower,'VOICE_A','VOICE_A'),false);
  assert.equal(mayEnrollPair(false,follower,follower,'VOICE_A','VOICE_A'),false);
  assert.equal(mayEnrollPair(true,follower,follower,'VOICE_A','VOICE_B'),false);
});
test('move apenas participante configurado, autorizado e ainda no canal anterior',()=>{
  const follower='123456789012345678';
  assert.equal(shouldFollowPair(true,follower,follower,true,'VOICE_A','VOICE_B','VOICE_A'),true);
  assert.equal(shouldFollowPair(true,'987654321098765432',follower,true,'VOICE_A','VOICE_B','VOICE_A'),false);
  assert.equal(shouldFollowPair(true,follower,follower,false,'VOICE_A','VOICE_B','VOICE_A'),false);
  assert.equal(shouldFollowPair(true,follower,follower,true,'VOICE_A','VOICE_B','VOICE_C'),false);
  assert.equal(shouldFollowPair(false,follower,follower,true,'VOICE_A','VOICE_B','VOICE_A'),false);
});

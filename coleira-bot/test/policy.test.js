'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mayEnroll, shouldFollow, optedOut } = require('../src/policy');
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

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const load = p => fs.readFileSync(path.join(root,p),'utf8');

const renderer = load('discordutils-global/renderer.js');
const bridge = load('discordutils-global/inject.js');
const bot = load('coleira-bot/src/index.js');
const installer = load('discordutils-plus/instalador-gui.ps1');
const gui = load('vencord-userplugin/oraculoXFakeVoice/index.ts');

function voice(mute, voice, original = {self_mute:false,self_deaf:false}) {
  const code = renderer.match(/    function duVoiceOutgoing\(packet\) \{[\s\S]*?\n    \}/);
  assert.ok(code, 'Falta duVoiceOutgoing');
  return vm.runInNewContext(
    'const duVoiceMod = '+JSON.stringify({mute,voice})+';\n'+code[0]+'\nduVoiceOutgoing({d:'+JSON.stringify(original)+'}).d',
    {}
  );
}

test('fake voice marca mute e deafen sem afetar audio local',()=>{
  const d=voice(false,true);
  assert.equal(d.self_mute,true);
  assert.equal(d.self_deaf,true);
});
test('fake mute marca somente mute',()=>{
  const d=voice(true,false);
  assert.equal(d.self_mute,true);
  assert.equal(d.self_deaf,false);
});
test('desativado preserva valores reais',()=>{
  const d=voice(false,false,{self_mute:false,self_deaf:true});
  assert.equal(d.self_mute,false);
  assert.equal(d.self_deaf,true);
});
test('os toggles nao pedem reiniciar',()=>{
  assert.match(renderer,/duVoiceSet\(key,!duVoiceMod\[key\]\)/);
  assert.doesNotMatch(renderer,/window\.alert\([^)]*(?:reinici|restart)/i);
  assert.doesNotMatch(gui,/restartNeeded:\s*true/);
});
test('Coleira usa ID no painel e segredo nao exposto',()=>{
  assert.match(renderer,/ownerId:currentId/);
  assert.doesNotMatch(renderer,/coleiraSessionKey|COLEIRA_CONTROL_KEY|x-coleira-key/i);
  assert.match(bridge,/coleira-bridge\.json/);
  assert.match(bridge,/bridge\.ownerId !== ownerId/);
  assert.match(bot,/req\.headers\['x-discord-owner-id'\] !== OWNER_ID/);
  assert.match(bot,/randomBytes\(32\)/);
});
test('instalador usa renderer global, com missoes e Orbs',()=>{
  assert.match(installer,/discordutils-global/);
  assert.match(installer,/autoUpdate' -NotePropertyValue \$false/);
  assert.match(renderer,/function renderMissoes\(/);
  assert.match(renderer,/loadOrbs\(/);
  for (const name of ['renderer.js','inject.js']) {
    const sha = crypto.createHash('sha256').update(load('discordutils-global/'+name)).digest('hex').toUpperCase();
    assert.ok(installer.includes(sha),'O hash SHA256 publicado para '+name+' nao corresponde ao arquivo');
  }
});

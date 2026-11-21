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

function formatQuestProgress(current, target) {
  const duration = renderer.match(/^    function qDur\(sec\) \{[^\n]+$/m);
  const begin = renderer.indexOf('    function questTimeView(cur, tot) {');
  const end = renderer.indexOf('    function updateQuestProgress(cur, tot) {',begin);
  assert.ok(duration && begin > 0 && end > begin,'Formatador de tempo da missao nao encontrado');
  return vm.runInNewContext(duration[0]+'\n'+renderer.slice(begin,end)+
    '\nquestTimeView('+JSON.stringify(current)+','+JSON.stringify(target)+')',{});
}

test('tempo da missao mostra duracao, andamento, restante estimado e percentual',()=>{
  const progress = formatQuestProgress(65,300);
  assert.equal(progress.elapsed,65);
  assert.equal(progress.target,300);
  assert.equal(progress.remaining,235);
  assert.equal(progress.percent,22);
  assert.match(progress.label,/1min 5s \/ 5min/);
  assert.match(progress.label,/restante estimado: 3min 55s/);
});
test('tempo da missao nao exibe restante negativo ou percentual maior que 100',()=>{
  for (const [current,target,expectedRemaining,expectedPercent] of [
    [0,300,300,0], [300,300,0,100], [999,300,0,100], [-3,300,300,0],[0,0,0,0]
  ]) {
    const data = formatQuestProgress(current,target);
    assert.equal(data.remaining,expectedRemaining);
    assert.equal(data.percent,expectedPercent);
  }
});
test('tema Oraculo X aplica vermelho carmesim ao executor de Orbs e a barra de tempo',()=>{
  assert.match(renderer,/#du-panel\{--bg:#09060b/);
  assert.match(renderer,/#du-panel \.q-card\{[^\n]*#1b0c14/);
  assert.match(renderer,/#du-panel \.q-reward\{[^\n]*#ffb1c3/);
  assert.match(renderer,/\.du-job \.jfill\{[^\n]*linear-gradient\(90deg,#c51639,#c51639\)/);
  assert.match(renderer,/class="qp-track"/);
  assert.match(renderer,/class="qp-bar"[^\n]*linear-gradient\(90deg,#ac1034,#ff456a\)/);
  assert.match(renderer,/aria-valuenow/);
  assert.doesNotMatch(renderer,/#5865f2|#8b5cf6|#7c46ec|#a78bfa|#c4b5fd/i);
});
test('regras de duracao e endpoints de missao nao foram alteradas pelo tema',()=>{
  assert.match(renderer,/function qPick\(q\)/);
  assert.match(renderer,/function completeQuest\(q, onProgress\)/);
  assert.match(renderer,/\/quests\/\$\{id\}\/video-progress/);
  assert.match(renderer,/\/quests\/\$\{id\}\/heartbeat/);
  assert.match(renderer,/function renderMissoes\(body\)/);
  assert.match(renderer,/function updateQuestProgress\(cur, tot\)/);
});

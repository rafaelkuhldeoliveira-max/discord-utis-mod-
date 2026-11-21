'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { timingSafeEqual, randomBytes } = require('node:crypto');
const { Client, Events, GatewayIntentBits, SlashCommandBuilder, MessageFlags } = require('discord.js');
const { mayEnroll, shouldFollow, optedOut } = require('./policy');

const TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const OWNER_ID = process.env.DISCORD_OWNER_ID || '';
const PORT = Number(process.env.COLEIRA_PORT || 37659);
if (!TOKEN || !/^\d{15,22}$/.test(GUILD_ID) || !/^\d{15,22}$/.test(OWNER_ID) ||
    !Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  console.error('Configure .env: token do BOT OFICIAL, IDs do servidor/dono e porta.');
  process.exit(1);
}
// Associacao por Discord ID, com chave temporaria gerada automaticamente.
// O ID identifica o dono, mas nao e uma senha: segredo fica entre processos locais.
const CONTROL_KEY = randomBytes(32).toString('hex');
const BRIDGE_DIR = path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'OraculoX');
const BRIDGE_FILE = path.join(BRIDGE_DIR, 'coleira-bridge.json');
const PAIR_FILE = path.join(BRIDGE_DIR, 'coleira-pair.json');
const validId = id => typeof id === 'string' && /^\d{15,22}$/.test(id);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});
const subscribers = new Set();
let enabled = false;
let leaderChannelId = null;
let followerId = null;
let leaderId = null;
function loadPair() {
  try {
    const p = JSON.parse(fs.readFileSync(PAIR_FILE, 'utf8'));
    if (validId(p.followerId) && validId(p.leaderId) && p.followerId !== p.leaderId) {
      followerId = p.followerId;
      leaderId = p.leaderId;
    }
  } catch (_) { /* A primeira configuracao sera feita pelo painel. */ }
}
function persistPair() {
  fs.mkdirSync(BRIDGE_DIR, {recursive:true,mode:0o700});
  fs.writeFileSync(PAIR_FILE, JSON.stringify({followerId,leaderId}), {mode:0o600,flag:'w'});
  try { fs.chmodSync(PAIR_FILE,0o600); } catch (_) {}
}
loadPair();
const snapshot = () => ({
  ready:client.isReady(), active:enabled, ownerId:OWNER_ID, guildId:GUILD_ID,
  followerId, leaderId, leaderChannelId,
  authorized:!!(followerId && subscribers.has(followerId)),
  subscribers:[...subscribers]
});
function activate(state) {
  if (state && (!validId(followerId) || !validId(leaderId))) {
    throw new Error('Configure os dois IDs da Coleira no painel antes de ligar.');
  }
  enabled = state;
  if (!state) subscribers.clear();
  return snapshot();
}
async function configurePair(nextFollowerId,nextLeaderId) {
  if (!validId(nextFollowerId) || !validId(nextLeaderId) || nextFollowerId === nextLeaderId) {
    throw new Error('Informe dois IDs diferentes do Discord (15 a 22 digitos).');
  }
  if (!client.isReady()) throw new Error('Bot ainda nao esta conectado ao Discord.');
  const guild = await client.guilds.fetch(GUILD_ID);
  const [follower,leader] = await Promise.all([
    guild.members.fetch(nextFollowerId), guild.members.fetch(nextLeaderId)
  ]);
  if (!follower || !leader || follower.user?.bot || leader.user?.bot) {
    throw new Error('Os dois IDs devem ser de membros humanos deste servidor.');
  }
  // Alterar IDs exige uma nova autorizacao do participante, nunca herdada.
  enabled = false;
  subscribers.clear();
  followerId = nextFollowerId;
  leaderId = nextLeaderId;
  leaderChannelId = leader.voice.channelId;
  persistPair();
  return snapshot();
}
const commands = [
  new SlashCommandBuilder().setName('coleira')
    .setDescription('Controla o acompanhamento voluntario de voz')
    .addStringOption(option => option.setName('acao').setDescription('Acao')
      .setRequired(true).addChoices(
        { name: 'ligar', value: 'ligar' },
        { name: 'desligar', value: 'desligar' },
        { name: 'status', value: 'status' }
      )),
  new SlashCommandBuilder().setName('seguir')
    .setDescription('Autorizar seguir o dono entre canais de voz'),
  new SlashCommandBuilder().setName('parar')
    .setDescription('Cancelar o acompanhamento')
].map(command => command.toJSON());

client.once(Events.ClientReady, async ready => {
  console.log('Bot conectado: ' + ready.user.tag);
  try {
    const guild = await ready.guilds.fetch(GUILD_ID);
    await guild.commands.set(commands);
    if (leaderId) {
      const leader = await guild.members.fetch(leaderId);
      leaderChannelId = leader.voice.channelId;
    }
    console.log('Comandos registrados; coleira desligada. Vinculo: ' + (followerId && leaderId ? 'configurado' : 'aguardando dois IDs no painel') + '.');
  } catch (error) { console.error('Falha no registro dos comandos:', error.message); }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.guildId !== GUILD_ID) return;
  const answer = content => interaction.reply({content, flags: MessageFlags.Ephemeral});
  try {
    if (interaction.commandName === 'coleira') {
      if (interaction.user.id !== OWNER_ID) return await answer('Somente o dono controla a coleira.');
      const action = interaction.options.getString('acao', true);
      if (action === 'ligar') {
        if (!followerId || !leaderId) return await answer('Configure os dois IDs da Coleira no painel Oraculo X.');
        activate(true);
        await answer('Coleira ligada. O participante configurado precisa entrar na chamada do lider e usar /seguir.');
      } else if (action === 'desligar') {
        activate(false);
        await answer('Coleira desligada; inscricoes removidas.');
      } else {
        await answer('Coleira: ' + (enabled ? 'ligada' : 'desligada') +
          '. Participantes: ' + subscribers.size);
      }
      return;
    }
    if (interaction.commandName === 'parar') {
      subscribers.delete(interaction.user.id);
      return await answer('Acompanhamento cancelado. Voce pode sair quando quiser.');
    }
    if (interaction.commandName === 'seguir') {
      if (interaction.user.id !== followerId || !leaderId) {
        return await answer('Esta conta nao e a pessoa configurada como participante da Coleira.');
      }
      const [leader,member] = await Promise.all([
        interaction.guild.members.fetch(leaderId),
        interaction.guild.members.fetch(interaction.user.id)
      ]);
      leaderChannelId = leader.voice.channelId;
      if (!mayEnroll(enabled, leaderChannelId, member.voice.channelId)) {
        return await answer('Entre no mesmo canal de voz da pessoa que vai seguir e use /seguir com a Coleira ligada.');
      }
      subscribers.add(interaction.user.id);
      return await answer('Autorizado a acompanhar. /parar, sair ou trocar de canal cancela imediatamente.');
    }
  } catch (error) {
    console.error('Erro em comando:', error);
    if (!interaction.replied) await answer('Erro no comando; verifique as permissoes.');
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (newState.guild.id !== GUILD_ID) return;
  if (leaderId && newState.id === leaderId) {
    const from = oldState.channelId, to = newState.channelId;
    leaderChannelId = to;
    if (!to) { subscribers.clear(); return; }
    if (!enabled || !from || from === to) return;
    for (const id of [...subscribers]) {
      if (!enabled || leaderChannelId !== to || id !== followerId) break;
      try {
        const member = await newState.guild.members.fetch(id);
        if (!shouldFollow(enabled, subscribers.has(id), from, to, member.voice.channelId)) {
          subscribers.delete(id);
          continue;
        }
        await member.voice.setChannel(to, 'Acompanhamento voluntario /seguir');
        console.log('Movido com consentimento: ' + id);
      } catch (error) {
        subscribers.delete(id);
        console.warn('Falha ao mover ' + id + ': ' + error.message);
      }
    }
    return;
  }
  if (newState.id === followerId && subscribers.has(newState.id) &&
      optedOut(oldState.channelId, newState.channelId, leaderChannelId)) {
    subscribers.delete(newState.id);
    console.log('Opt-out por troca de canal: ' + newState.id);
  }
});

function saveBridge() {
  fs.mkdirSync(BRIDGE_DIR, { recursive:true, mode:0o700 });
  fs.writeFileSync(BRIDGE_FILE, JSON.stringify({ ownerId:OWNER_ID, port:PORT, key:CONTROL_KEY, pid:process.pid }), { mode:0o600, flag:'w' });
  try { fs.chmodSync(BRIDGE_FILE, 0o600); } catch (_) {}
}
function removeBridge() {
  try {
    const existing = JSON.parse(fs.readFileSync(BRIDGE_FILE,'utf8'));
    if (existing.key === CONTROL_KEY) fs.unlinkSync(BRIDGE_FILE);
  } catch (_) {}
}
function validKey(given) {
  const a = Buffer.from(typeof given === 'string' ? given : '', 'utf8');
  const b = Buffer.from(CONTROL_KEY, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
function respond(res, status, object) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(object));
}
const server = http.createServer((req, res) => {
  if (!validKey(req.headers['x-coleira-key'])) {
    return respond(res, 401, {error:'Autenticacao local invalida.'});
  }
  if (req.headers['x-discord-owner-id'] !== OWNER_ID) {
    return respond(res, 403, {error:'ID diferente do proprietario configurado no bot.'});
  }
  if (req.method === 'GET' && req.url === '/status') {
    return respond(res, 200, snapshot());
  }
  if (req.method === 'POST' && (req.url === '/toggle' || req.url === '/pair')) {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2048) req.destroy();
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(data);
        if (req.url === '/toggle') {
          if (typeof body.active !== 'boolean') throw new Error('Valor de ativacao invalido.');
          return respond(res, 200, activate(body.active));
        }
        const result = await configurePair(body.followerId,body.leaderId);
        return respond(res, 200, result);
      } catch (error) {
        return respond(res, 400, {error:error.message || 'Configuracao invalida.'});
      }
    });
    return;
  }
  respond(res, 404, {error:'Rota desconhecida.'});
});
server.listen(PORT, '127.0.0.1', () => {
  try {
    saveBridge();
    console.log('Ponte vinculada ao Discord ID ' + OWNER_ID + ' em 127.0.0.1:' + PORT);
  } catch (e) {
    console.error('Nao foi possivel preparar o vinculo local:', e.message);
    server.close();
    client.destroy();
    process.exitCode = 1;
  }
});
server.on('error', e => {
  console.error('Ponte local nao abriu:', e.message);
  process.exitCode = 1;
});
client.login(TOKEN).catch(error => {
  console.error('Login do bot falhou:', error.message);
  server.close();
  process.exitCode = 1;
});
process.on('SIGINT', () => { activate(false); server.close(); client.destroy(); });
process.on('exit', removeBridge);

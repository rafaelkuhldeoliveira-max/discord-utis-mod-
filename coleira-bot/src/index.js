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
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});
const subscribers = new Set();
let enabled = false;
let ownerChannelId = null;
const snapshot = () => ({
  ready: client.isReady(), active: enabled, ownerId: OWNER_ID, guildId: GUILD_ID, ownerChannelId, subscribers: [...subscribers]
});
function activate(state) {
  enabled = state;
  if (!state) subscribers.clear();
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
    const owner = await guild.members.fetch(OWNER_ID);
    ownerChannelId = owner.voice.channelId;
    console.log('Comandos registrados; coleira desligada.');
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
        activate(true);
        await answer('Coleira ligada. Quem quiser participar entra na sua chamada e usa /seguir.');
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
      return await answer('Voce nao esta mais seguindo. Pode sair quando quiser.');
    }
    if (interaction.commandName === 'seguir') {
      const owner = await interaction.guild.members.fetch(OWNER_ID);
      const member = await interaction.guild.members.fetch(interaction.user.id);
      ownerChannelId = owner.voice.channelId;
      if (interaction.user.id === OWNER_ID) return await answer('Voce e o dono da coleira.');
      if (!mayEnroll(enabled, ownerChannelId, member.voice.channelId)) {
        return await answer('Com a coleira ligada, entre na mesma chamada do dono e use /seguir.');
      }
      subscribers.add(interaction.user.id);
      return await answer('Acompanhamento autorizado. Use /parar, saia ou troque de canal para cancelar.');
    }
  } catch (error) {
    console.error('Erro em comando:', error);
    if (!interaction.replied) await answer('Erro no comando; verifique as permissoes.');
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (newState.guild.id !== GUILD_ID) return;
  if (newState.id === OWNER_ID) {
    const from = oldState.channelId, to = newState.channelId;
    ownerChannelId = to;
    if (!to) { subscribers.clear(); return; }
    if (!enabled || !from || from === to) return;
    for (const id of [...subscribers]) {
      if (!enabled || ownerChannelId !== to) break;
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
  if (subscribers.has(newState.id) &&
      optedOut(oldState.channelId, newState.channelId, ownerChannelId)) {
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
  if (req.method === 'POST' && req.url === '/toggle') {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2048) req.destroy();
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(data);
        if (typeof body.active !== 'boolean') throw Error('active invalido');
        respond(res, 200, activate(body.active));
      } catch { respond(res, 400, {error:'JSON invalido.'}); }
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

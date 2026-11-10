// plugin/renderer.js
// Interface e estado local do plugin. Nenhuma alteração é enviada ao Discord.

'use strict';

const STORAGE_KEY = 'du-settings';

const NSET = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
})();

const MOD_OF = {
  fakeMute: 'fakeVoice',
  fakeDeafen: 'fakeVoice',
  fakeChan: 'fakeVoice',
  msgLogger: 'msgLogger',
  msgEditor: 'msgEditor'
};

const MOD_DEFS = [
  { key: 'fakeVoice', label: 'Fake Voice (simulação local)', desc: 'Controles e canal fictícios visíveis apenas neste cliente', icon: 'volume' },
  { key: 'msgLogger', label: 'Log de mensagens', desc: 'Área local de registro; captura de mensagens não implementada', icon: 'book' },
  { key: 'msgEditor', label: 'Editor local', desc: 'Pré-visualizar substituições locais; nada é enviado ao Discord', icon: 'pencil' }
];

const MOD_TOGGLES = [
  { key: 'fakeMute', label: 'Mute (simulação)', desc: 'Controle visual local, sem alterar seu estado de voz', icon: 'mic-off' },
  { key: 'fakeDeafen', label: 'Surdo (simulação)', desc: 'Controle visual local, sem alterar seu estado de voz', icon: 'volume-x' },
  { key: 'fakeChan', label: 'Canal fictício', desc: 'Mostrar um cartão fictício neste cliente', icon: 'hash' },
  { key: 'msgLogger', label: 'Registro local', desc: 'A captura automática de mensagens não está implementada', icon: 'log' },
  { key: 'msgEditor', label: 'Pré-visualização local', desc: 'Mostrar substituições somente nesta interface', icon: 'wand' }
];

const ML = { on: false, timer: null, list: [] };
let fakeVoiceEl = null;

function setNative(key, value) {
  try {
    NSET[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(NSET));
  } catch (_) {}
}

function mod(key, value) {
  if (typeof value !== 'undefined') setNative(key, value);
  return NSET[key];
}

const modsSelected = () => (NSET.mods && typeof NSET.mods === 'object' ? NSET.mods : {});
const modsState = () => (NSET.modsOn && typeof NSET.modsOn === 'object' ? NSET.modsOn : (NSET.modsOn = {}));
const modInstalled = (key) => modsSelected()[MOD_OF[key] || key] === true;
const modOn = (key) => modInstalled(key) && modsState()[key] === true;
const anyModInstalled = () => MOD_DEFS.some((m) => modInstalled(m.key));

function toast(message, type = 'ok', source = 'Plugin') {
  if (typeof console !== 'undefined') console.log(`[${source}/${type}] ${message}`);
}

function icon(name, size = 14) {
  return `<span class="du-icon" aria-hidden="true" style="font-size:${size}px">${esc(name)}</span>`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function el(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === 'className') node.className = value;
    else if (key === 'innerHTML') node.innerHTML = value;
    else if (key === 'value') node.value = value;
    else if (value !== null && typeof value !== 'undefined') node.setAttribute(key, String(value));
  }
  if (text) node.textContent = String(text);
  return node;
}

function parseMsgRef(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const allowedHosts = new Set(['discord.com', 'www.discord.com', 'discordapp.com', 'www.discordapp.com']);
    if (!allowedHosts.has(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'channels' || parts.length < 4) return null;
    const [guildId, channelId, messageId] = parts.slice(1, 4);
    if (![guildId, channelId, messageId].every((id) => /^\d+$/.test(id))) return null;
    return { guildId, channelId, messageId };
  } catch (_) {
    return null;
  }
}

function setOverride(ref, text) {
  if (!ref || !/^\d+$/.test(String(ref.messageId || ''))) return false;
  const overrides = NSET.overrides && typeof NSET.overrides === 'object' ? NSET.overrides : (NSET.overrides = {});
  overrides[ref.messageId] = { text: String(text), ref };
  setNative('overrides', overrides);
  return true;
}

function overrideCount() {
  return NSET.overrides && typeof NSET.overrides === 'object' ? Object.keys(NSET.overrides).length : 0;
}

function applyOverrides() {
  if (!NSET.overrides || typeof document === 'undefined') return;
  for (const [id, entry] of Object.entries(NSET.overrides)) {
    if (!/^\d+$/.test(id) || !entry || typeof entry.text !== 'string') continue;
    for (const message of document.querySelectorAll(`[data-message-id="${id}"]`)) {
      const content = message.querySelector('[class*="messageContent"]') || message;
      if (content.dataset.duLocalOverride === 'true') continue;
      content.textContent = entry.text;
      content.dataset.duLocalOverride = 'true';
      content.setAttribute('aria-label', 'Texto substituído localmente; não foi alterado no Discord');
    }
  }
}

function sweepDeletedDom() {
  // Captura de mensagens apagadas não é implementada; não monitora nem armazena mensagens.
}

function applyMod(key, enabled) {
  const state = modsState();
  state[key] = !!enabled;
  setNative('modsOn', state);
  if (key === 'fakeChan') renderFakeVoice();
  ensureSweep();
  return true;
}

function setModOn(key, enabled) {
  mod('modsOn', modsState());
  return applyMod(key, !!enabled);
}

function applyModsEnabled() {
  for (const definition of MOD_DEFS) {
    if (modInstalled(definition.key)) applyMod(definition.key, true);
  }
}

/* ---------- fake voice: cartão fictício apenas no cliente local ---------- */
function paintFakeVoice() {
  if (!fakeVoiceEl) return;
  const state = modsState();
  const name = String(state.fakeVoiceName || state.fakeChanName || 'Geral').slice(0, 40);
  fakeVoiceEl.innerHTML = `
    <div class="fv-name">${icon('hash', 14)}<span>${esc(name)}</span></div>
    <div class="fv-sub">Simulação local — não conectado</div>
    <div class="fv-actions"><span>Mute: ${state.fakeMute ? 'sim' : 'não'}</span><span>Surdo: ${state.fakeDeafen ? 'sim' : 'não'}</span></div>`;
}

function renderFakeVoice() {
  if (typeof document === 'undefined') return;
  if (!modOn('fakeChan')) {
    if (fakeVoiceEl) { fakeVoiceEl.remove(); fakeVoiceEl = null; }
    return;
  }
  if (fakeVoiceEl && fakeVoiceEl.isConnected) { paintFakeVoice(); return; }
  fakeVoiceEl = document.createElement('aside');
  fakeVoiceEl.id = 'du-fakevoice';
  fakeVoiceEl.setAttribute('aria-label', 'Simulação local de canal de voz');
  paintFakeVoice();
  document.body.appendChild(fakeVoiceEl);
}

/* ---------- sweep unificado ---------- */
function sweepDom() {
  try { sweepDeletedDom(); } catch (_) {}
  try { if (modOn('msgEditor')) applyOverrides(); } catch (_) {}
}

function needSweep() {
  ML.on = modOn('msgLogger');
  return ML.on || (modOn('msgEditor') && overrideCount() > 0);
}

function startSweep() {
  if (ML.timer) clearInterval(ML.timer);
  ML.timer = setInterval(sweepDom, 1200);
}

function stopSweep() {
  if (ML.timer) { clearInterval(ML.timer); ML.timer = null; }
}

function ensureSweep() {
  needSweep() ? startSweep() : stopSweep();
}

function toggleRow(key, iconName, label, description) {
  const row = el('div', { className: 'du-tg' + (modOn(key) ? ' on' : '') });
  row.setAttribute('role', 'switch');
  row.setAttribute('aria-checked', String(modOn(key)));
  row.innerHTML = `<span class="tgi">${icon(iconName, 18)}</span><div class="tgt"><b>${esc(label)}</b><small>${esc(description)}</small></div><div class="du-sw"></div>`;
  row.addEventListener('click', () => {
    const next = !modOn(key);
    setModOn(key, next);
    row.classList.toggle('on', next);
    row.setAttribute('aria-checked', String(next));
    toast(next ? 'Ativado localmente.' : 'Desativado.', next ? 'ok' : 'inf', label);
    setTimeout(renderActiveTab, 20);
  });
  return row;
}

function renderEditor(body) {
  const b2 = el('div', { className: 'du-group' });
  b2.innerHTML = '<div class="du-head">Pré-visualização local de uma mensagem</div><small class="du-warning">Só muda o texto exibido neste cliente; nada é enviado ao Discord.</small>';
  const input = el('input', { className: 'du-input', placeholder: 'Link da mensagem do Discord…' });
  const text = el('textarea', { className: 'du-input du-ta', rows: 2, placeholder: 'Texto para a pré-visualização local…' });
  const btn = el('button', { className: 'du-btn acc' });
  btn.textContent = 'Aplicar localmente';
  btn.onclick = () => {
    const ref = parseMsgRef(input.value.trim());
    if (!ref) return toast('Link do Discord inválido.', 'err', 'Editor');
    if (!text.value.trim()) return toast('Digite o texto.', 'err', 'Editor');
    setOverride(ref, text.value.trim());
    applyOverrides();
    toast('Pré-visualização aplicada somente neste cliente.', 'ok', 'Editor');
    renderActiveTab();
  };
  b2.append(input, text, btn);
  body.appendChild(b2);

  /* Edição em lote: aplica pré-visualizações locais, nunca envia mensagens. */
  const b3 = el('div', { className: 'du-group' });
  b3.innerHTML = '<div class="du-head">Pré-visualização em lote — várias mensagens</div><small class="du-warning">As substituições são apenas locais e não alteram mensagens no servidor.</small>';
  const i3 = el('textarea', { className: 'du-input du-ta', rows: 4, placeholder: 'Um link do Discord por linha…' });
  const t3 = el('textarea', { className: 'du-input du-ta', rows: 2, placeholder: 'Texto de pré-visualização para todas as mensagens…' });
  const g3 = el('button', { className: 'du-btn acc' });
  g3.textContent = 'Aplicar pré-visualização em todas';
  g3.onclick = () => {
    const lines = i3.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return toast('Cole pelo menos um link.', 'err', 'Editor');
    if (!t3.value.trim()) return toast('Digite o texto.', 'err', 'Editor');
    let ok = 0;
    let failed = 0;
    for (const line of lines) {
      const ref = parseMsgRef(line);
      if (!ref) { failed++; continue; }
      if (setOverride(ref, t3.value.trim())) ok++;
      else failed++;
    }
    applyOverrides();
    toast(`${ok} pré-visualização(ões) local(is) aplicada(s)${failed ? ` • ${failed} link(s) inválido(s)` : ''}.`, ok ? 'ok' : 'err', 'Editor');
    i3.value = '';
    t3.value = '';
    renderActiveTab();
  };
  b3.append(i3, t3, g3);
  body.appendChild(b3);
}

function paintLogList(box) {
  box.innerHTML = '<div class="du-empty">Registro local vazio. A captura automática não está implementada.</div>';
}

function renderActiveTab() {
  if (typeof document === 'undefined') return;
  const panel = document.querySelector('[data-tab="mods"]');
  if (panel) renderMods(panel);
}

function renderMods(body) {
  body.innerHTML = '';
  const installed = MOD_DEFS.filter((definition) => modInstalled(definition.key));
  body.appendChild(el('div', { className: 'du-mods-note' }, 'Mods instalados'));
  if (!installed.length) {
    body.appendChild(el('div', { className: 'du-empty' }, 'Nenhum mod está habilitado em settings.json.'));
    return;
  }

  for (const definition of installed) {
    const row = el('div', { className: 'du-tg' + (modOn(definition.key) ? ' on' : '') });
    row.setAttribute('role', 'switch');
    row.setAttribute('aria-checked', String(modOn(definition.key)));
    row.innerHTML = `<span class="tgi">${icon(definition.icon, 18)}</span><div class="tgt"><b>${esc(definition.label)}</b><small>${esc(definition.desc)}</small></div><div class="du-sw"></div>`;
    row.addEventListener('click', () => {
      const next = !modOn(definition.key);
      setModOn(definition.key, next);
      row.classList.toggle('on', next);
      row.setAttribute('aria-checked', String(next));
      toast(next ? 'Ativado localmente.' : 'Desativado.', next ? 'ok' : 'inf', definition.label);
      setTimeout(renderActiveTab, 20);
    });
    body.appendChild(row);

    if (definition.key === 'fakeVoice') {
      for (const toggle of MOD_TOGGLES.filter((item) => MOD_OF[item.key] === 'fakeVoice')) {
        body.appendChild(toggleRow(toggle.key, toggle.icon, toggle.label, toggle.desc));
      }
      if (modOn('fakeChan')) {
        const input = el('input', { className: 'du-input', placeholder: 'Nome do canal fictício…', value: String(modsState().fakeChanName || modsState().fakeVoiceName || 'Geral') });
        input.addEventListener('input', () => {
          modsState().fakeChanName = input.value.slice(0, 40);
          modsState().fakeVoiceName = input.value.slice(0, 40);
          setNative('modsOn', modsState());
          paintFakeVoice();
        });
        body.appendChild(input);
      }
    }

    if (definition.key === 'msgLogger') {
      const toggle = MOD_TOGGLES.find((item) => item.key === 'msgLogger');
      body.appendChild(toggleRow(toggle.key, toggle.icon, toggle.label, toggle.desc));
      if (modOn('msgLogger')) {
        const list = el('div', { className: 'du-ovlist' });
        paintLogList(list);
        body.appendChild(list);
        const clear = el('button', { className: 'du-btn red' });
        clear.textContent = 'Limpar lista';
        clear.onclick = () => { ML.list.length = 0; renderActiveTab(); };
        body.appendChild(clear);
      }
    }

    if (definition.key === 'msgEditor') {
      const toggle = MOD_TOGGLES.find((item) => item.key === 'msgEditor');
      body.appendChild(toggleRow(toggle.key, toggle.icon, toggle.label, toggle.desc));
      if (modOn('msgEditor')) renderEditor(body);
    }
  }
}

function initialize() {
  if (typeof document === 'undefined') return;
  let panel = document.querySelector('[data-tab="mods"]');
  if (!panel) {
    const root = document.getElementById('du-app') || document.body;
    panel = el('section', { 'data-tab': 'mods', className: 'du-panel' });
    root.appendChild(panel);
  }
  panel.id = 'du-panel';
  renderMods(panel);
  renderFakeVoice();
  ensureSweep();
}

if (typeof window !== 'undefined') {
  window.renderActiveTab = renderActiveTab;
  window.renderMods = renderMods;
  window.parseMsgRef = parseMsgRef;
  window.setOverride = setOverride;
  window.applyOverrides = applyOverrides;
  window.applyModsEnabled = applyModsEnabled;
  window.ensureSweep = ensureSweep;
  window.startSweep = startSweep;
  window.stopSweep = stopSweep;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MOD_OF, MOD_DEFS, MOD_TOGGLES,
    modsSelected, modsState, modInstalled, modOn, anyModInstalled,
    applyModsEnabled, parseMsgRef, setOverride, applyOverrides,
    renderFakeVoice, paintFakeVoice, renderMods, renderEditor,
    sweepDom, ensureSweep, startSweep, stopSweep
  };
}

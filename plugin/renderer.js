// inject.js
// Ponto de entrada do plugin.

const NSET = (() => {
  try {
    return JSON.parse(localStorage.getItem('du-settings') || '{}');
  } catch (_) {
    return {};
  }
})();

const ML = {
  on: true,
  timer: null,
  list: []
};

function setNative(key, value) {
  try {
    NSET[key] = value;
    localStorage.setItem('du-settings', JSON.stringify(NSET));
  } catch (_) {}
}

function mod(key, value) {
  if (typeof value !== 'undefined') {
    NSET[key] = value;
    setNative(key, value);
  }
  return NSET[key];
}

function toast(msg, type = 'ok', source = 'Plugin') {
  if (typeof console !== 'undefined') {
    console.log(`[${source}] ${msg}`);
  }
}

function icon(name, size = 14) {
  return `<span class="du-icon" style="font-size:${size}px">${name}</span>`;
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
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'className') node.className = v;
    else if (k === 'innerHTML') node.innerHTML = v;
    else if (v !== null && typeof v !== 'undefined') node.setAttribute(k, String(v));
  }
  if (text) node.textContent = String(text);
  return node;
}

function parseMsgRef(url) {
  try {
    const u = new URL(url);
    const p = u.pathname.split('/').filter(Boolean);
    if (p[0] === 'channels' && p.length >= 4) {
      return {
        channelId: p[1],
        messageId: p[3],
        guildId: p[0]
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

function setOverride(ref, text) {
  if (!ref || !ref.messageId) return false;
  if (!NSET.overrides) NSET.overrides = {};
  NSET.overrides[ref.messageId] = { text, ref };
  setNative('overrides', NSET.overrides);
  return true;
}

function overrideCount() {
  return NSET.overrides && typeof NSET.overrides === 'object' ? Object.keys(NSET.overrides).length : 0;
}

function applyOverrides() {
  if (!NSET.overrides || !document) return;
  for (const [id, entry] of Object.entries(NSET.overrides)) {
    const elms = document.querySelectorAll(`[data-message-id="${id}"]`);
    for (const node of elms) {
      if (node && node.textContent !== entry.text) {
        node.textContent = entry.text;
      }
    }
  }
}

function sweepDeletedDom() {
  // placeholder para limpeza da DOM quando for necessário.
}

function applyMod(key, enabled) {
  if (!NSET.modsOn) NSET.modsOn = {};
  NSET.modsOn[key] = !!enabled;
  setNative('modsOn', NSET.modsOn);
  return true;
}

function ensureSweep() {
  if (ML.on || (modOn('msgEditor') && overrideCount() > 0)) {
    startSweep();
  } else {
    stopSweep();
  }
}

function startSweep() {
  if (ML.timer) clearInterval(ML.timer);
  ML.timer = setInterval(() => {
    try { sweepDeletedDom(); } catch (_) {}
    try { applyOverrides(); } catch (_) {}
  }, 1200);
}

function stopSweep() {
  if (ML.timer) {
    clearInterval(ML.timer);
    ML.timer = null;
  }
}

function modInstalled(k) {
  const sel = (NSET.mods && typeof NSET.mods === 'object') ? NSET.mods : {};
  return sel[MOD_OF[k] || k] === true;
}

function modOn(k) {
  return modInstalled(k) && ((NSET.modsOn && NSET.modsOn[k]) === true);
}

function anyModInstalled() {
  return MOD_DEFS.some((m) => modInstalled(m.key));
}

const MOD_OF = {
  fakeMute: 'fakeVoice',
  fakeDeafen: 'fakeVoice',
  fakeChan: 'fakeVoice',
  msgLogger: 'msgLogger',
  msgEditor: 'msgEditor'
};

const MOD_DEFS = [
  { key: 'fakeVoice', label: 'Fake Voice', desc: 'Mute, surdo e canal falso', icon: 'volume' },
  { key: 'msgLogger', label: 'Log de apagadas', desc: 'Mensagens apagadas continuam visíveis', icon: 'book' },
  { key: 'msgEditor', label: 'Editor de mensagens', desc: 'Editar mensagens e sobrepor textos locais', icon: 'pencil' }
];

const MOD_TOGGLES = [
  { key: 'fakeMute', label: 'Mute', desc: 'Silenciar o usuário falso', icon: 'mic-off' },
  { key: 'fakeDeafen', label: 'Surdo', desc: 'Desativar áudio do canal falso', icon: 'volume-x' },
  { key: 'fakeChan', label: 'Canal falso', desc: 'Renderizar um canal virtual', icon: 'hash' },
  { key: 'msgLogger', label: 'Mensagem apagada', desc: 'Mostrar mensagens removidas', icon: 'log' },
  { key: 'msgEditor', label: 'Editor local', desc: 'Permitir edição local', icon: 'wand' }
];

function toggleRow(key, iconName, label, desc) {
  const row = el('div', { className: 'du-tg' + (modOn(key) ? ' on' : '') });
  row.setAttribute('role', 'switch');
  row.innerHTML = `
    <span class="tgi">${icon(iconName, 18)}</span>
    <div class="tgt"><b>${esc(label)}</b><small>${esc(desc)}</small></div>
    <div class="du-sw"></div>`;

  row.addEventListener('click', () => {
    const next = !modOn(key);
    if (!applyMod(key, next)) {
      if (NSET.modsOn) NSET.modsOn[key] = false;
      setNative('modsOn', NSET.modsOn);
      row.classList.remove('on');
      return;
    }
    row.classList.toggle('on', next);
    toast(next ? 'Ativado.' : 'Desativado.', next ? 'ok' : 'inf', label);
    setTimeout(() => window.renderActiveTab && window.renderActiveTab(), 20);
  });

  return row;
}

function renderEditor(body) {
  const b2 = el('div', { className: 'du-group' });
  b2.innerHTML = '<div class="du-head">Alterar fala de outra pessoa</div>';

  const input = el('input', {
    className: 'du-input',
    placeholder: 'Link da mensagem para trocar o texto…'
  });

  const text = el('textarea', {
    className: 'du-input du-ta',
    rows: 2,
    placeholder: 'Novo texto…'
  });

  const btn = el('button', { className: 'du-btn acc' });
  btn.innerHTML = `<span style="display:flex">${icon('wand', 15)}</span>Aplicar override`;

  btn.onclick = () => {
    const ref = parseMsgRef(input.value.trim());
    if (!ref) return toast('Link inválido.', 'err', 'Editor');
    if (!text.value.trim()) return toast('Digite o novo texto.', 'err', 'Editor');
    setOverride(ref, text.value.trim());
    toast('Texto alterado localmente.', 'ok', 'Editor');
    input.value = '';
    text.value = '';
    renderActiveTab();
  };

  b2.appendChild(input);
  b2.appendChild(text);
  b2.appendChild(btn);

  body.appendChild(b2);

  const b3 = el('div', { className: 'du-group' });
  b3.innerHTML = '<div class="du-head">Edição em lote — várias pessoas</div>';

  const i3 = el('textarea', {
    className: 'du-input du-ta',
    rows: 4,
    placeholder: 'Um link por linha:\nhttps://discord.com/channels/…/…/…\nhttps://discord.com/channels/…/…/…'
  });

  const t3 = el('textarea', {
    className: 'du-input du-ta',
    rows: 2,
    placeholder: 'Texto único que será aplicado em TODAS as mensagens acima…'
  });

  const g3 = el('button', { className: 'du-btn acc' });
  g3.innerHTML = `<span style="display:flex">${icon('wand', 15)}</span>Aplicar em todas`;

  g3.onclick = () => {
    const lines = i3.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return toast('Cole pelo menos um link.', 'err', 'Editor');
    if (!t3.value.trim()) return toast('Digite o novo texto.', 'err', 'Editor');

    let ok = 0;
    let falhou = 0;
    for (const ln of lines) {
      const ref = parseMsgRef(ln);
      if (!ref) { falhou++; continue; }
      setOverride(ref, t3.value);
      ok++;
    }

    toast(
      `${ok} alterada(s) localmente${falhou ? ` • ${falhou} link(s) inválido(s)` : ''}.`,
      ok > 0 ? 'ok' : 'err',
      'Editor'
    );

    i3.value = '';
    t3.value = '';
    renderActiveTab();
  };

  b3.appendChild(i3);
  b3.appendChild(t3);
  b3.appendChild(g3);
  body.appendChild(b3);
}

function paintLogList(box) {
  box.innerHTML = '';
  const items = Array.isArray(ML.list) ? ML.list : [];
  if (!items.length) {
    box.innerHTML = '<div class="du-empty">Nenhuma mensagem apagada registrada.</div>';
    return;
  }

  for (const item of items) {
    const row = el('div', { className: 'du-logrow' });
    row.innerHTML = `<div class="du-logtxt">${esc(item.text || '')}</div>`;
    box.appendChild(row);
  }
}

function renderActiveTab() {
  const app = document.getElementById('du-app') || document.body;
  if (app && app.querySelector) {
    const list = app.querySelector('[data-tab="mods"]');
    if (list) renderMods(list);
  }
}

function renderMods(body) {
  body.innerHTML = '';
  const inst = MOD_DEFS.filter((m) => modInstalled(m.key));

  body.appendChild(el('div', { className: 'du-mods-note' }, 'Mods instalados'));

  for (const m of inst) {
    const row = el('div', { className: 'du-tg' + (modOn(m.key) ? ' on' : '') });
    row.setAttribute('role', 'switch');
    row.innerHTML = `
      <span class="tgi">${icon(m.icon, 18)}</span>
      <div class="tgt"><b>${esc(m.label)}</b><small>${esc(m.desc)}</small></div>
      <div class="du-sw"></div>`;

    row.addEventListener('click', () => {
      const next = !row.classList.contains('on');
      if (!applyMod(m.key, next)) {
        if (NSET.modsOn) NSET.modsOn[m.key] = false;
        setNative('modsOn', NSET.modsOn);
        row.classList.remove('on');
        return;
      }
      row.classList.toggle('on', next);
      toast(next ? 'Ativado.' : 'Desativado.', next ? 'ok' : 'inf', m.label);
      setTimeout(renderActiveTab, 20);
    });
    body.appendChild(row);

    if (m.key === 'fakeVoice') {
      for (const t of MOD_TOGGLES.filter((x) => MOD_OF[x.key] === 'fakeVoice')) {
        body.appendChild(toggleRow(t.key, t.icon, t.label, t.desc));
      }

      if (modOn('fakeChan')) {
        const inp = el('input', {
          className: 'du-input',
          placeholder: 'Nome do canal de voz…',
          value: String(NSET.modsOn?.fakeChanName || NSET.modsOn?.fakeVoiceName || 'Geral')
        });
        inp.addEventListener('input', () => {
          NSET.modsOn.fakeChanName = inp.value.slice(0, 40);
          NSET.modsOn.fakeVoiceName = inp.value.slice(0, 40);
          setNative('modsOn', NSET.modsOn);
        });
        body.appendChild(inp);
      }
    }

    if (m.key === 'msgLogger') {
      const t = MOD_TOGGLES.find((x) => x.key === 'msgLogger');
      body.appendChild(toggleRow('msgLogger', t.icon, t.label, t.desc));

      if (modOn('msgLogger')) {
        const pills = el('div', { className: 'du-pills' });
        [['dm', 'Só DMs'], ['all', 'Todas']].forEach(([v, label]) => {
          const p = el('button', {
            className: 'du-pill' + (NSET.modsOn?.loggerScope === v ? ' on' : '')
          }, label);
          p.onclick = () => {
            NSET.modsOn.loggerScope = v;
            setNative('modsOn', NSET.modsOn);
            renderActiveTab();
          };
          pills.appendChild(p);
        });
        body.appendChild(pills);

        const box = el('div', { className: 'du-ovlist' });
        paintLogList(box);
        body.appendChild(box);

        const clr = el('button', { className: 'du-btn red' });
        clr.innerHTML = `<span style="display:flex">${icon('trash', 16)}</span>Limpar lista`;
        clr.onclick = () => {
          ML.list.length = 0;
          setNative('modsOn', NSET.modsOn);
          renderActiveTab();
        };
        body.appendChild(clr);
      }
    }

    if (m.key === 'msgEditor') {
      const t = MOD_TOGGLES.find((x) => x.key === 'msgEditor');
      body.appendChild(toggleRow('msgEditor', t.icon, t.label, t.desc));
      if (modOn('msgEditor')) renderEditor(body);
    }
  }
}

window.renderActiveTab = renderActiveTab;
window.renderMods = renderMods;
window.parseMsgRef = parseMsgRef;
window.setOverride = setOverride;
window.applyOverrides = applyOverrides;
window.ensureSweep = ensureSweep;
window.startSweep = startSweep;
window.stopSweep = stopSweep;

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('du-app') || document.body;
    if (root && !root.querySelector('[data-tab="mods"]')) {
      const panel = el('div', { 'data-tab': 'mods', className: 'du-panel' });
      root.appendChild(panel);
      renderMods(panel);
    }
  });
}

module.exports = {
  MOD_OF,
  MOD_DEFS,
  MOD_TOGGLES,
  modInstalled,
  modOn,
  anyModInstalled,
  renderMods,
  parseMsgRef,
  setOverride,
  applyOverrides,
  ensureSweep,
  startSweep,
  stopSweep
};






























































































































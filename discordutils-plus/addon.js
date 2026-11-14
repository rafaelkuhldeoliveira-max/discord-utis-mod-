    // DiscordUtils+ — controles de voz. Base DiscordUtils (licenca MIT).
    // Inserido na closure renderer.js: acessa os stores carregados do Discord.
    const DU_PLUS = (() => {
      'use strict';
      const TAG = '[DiscordUtils+/Voz]';
      const VOICE_ID = 'du-plus-voice-buttons';
      const STYLE_ID = 'du-plus-voice-style';
      const defaultOptions = { showMute: true, showVoice: true };
      const currentId = () => { try { return String(currentUser()?.id || 'anon'); } catch (_) { return 'anon'; } };
      const optKey = () => `DiscordUtils.plus.v2.${currentId()}.voiceOptions`;
      const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } };
      const save = () => { try { localStorage.setItem(optKey(), JSON.stringify(options)); } catch (e) { console.warn(TAG, 'falha ao salvar preferencias', e); } };
      const options = { ...defaultOptions, ...(read(optKey()) || (() => {
        const old = read(`DiscordUtils.plus.v1.${currentId()}.options`) || {};
        return { showMute: old.showMute !== false, showVoice: old.showVoice !== false };
      })()) };
      // Nenhum registro de mensagens: elimina arquivos locais legados desta conta.
      function cleanOldLogger() {
        for (const id of [currentId(), 'anon']) {
          for (const suffix of ['seen', 'deleted']) {
            try { localStorage.removeItem(`DiscordUtils.plus.v1.${id}.${suffix}`); } catch (_) {}
          }
        }
      }
      let fakeMute = false;
      let fakeVoice = false;
      let activeSocket = null;
      let originalSend = null;
      let wrappedSend = null;
      let lastVoicePayload = null;
      let dispatcher = null;
      let voiceSubscriptions = [];
      let running = false;
      let scheduled = false;
      let statusText = 'Aguardando conexao de voz';
      let syncState = 'idle';
      let lastAppliedAt = 0;
      let lastActual = null;
      const memo = new Map();
      const findModule = (...methods) => { try { return findByMethods(...methods); } catch (_) { return null; } };
      const findProps = (...props) => { try { return findByProps(...props); } catch (_) { return null; } };
      const resolve = (name, fn) => {
        if (memo.has(name)) return memo.get(name);
        const mod = fn();
        if (mod) memo.set(name, mod);
        return mod;
      };
      const socketModule = () => resolve('socket', () => findProps('getSocket'));
      const selectedStore = () => resolve('selected', () => findModule('getVoiceChannelId'));
      const channelStore = () => resolve('channels', () => findModule('getChannel'));
      const mediaStore = () => resolve('media', () => findModule('isMute', 'isDeaf'));
      const voiceStore = () => resolve('voice', () => findModule('getVoiceStateForUser'));
      function getSocket() {
        try {
          const s = socketModule()?.getSocket?.();
          return s && typeof s.send === 'function' ? s : null;
        } catch (e) { console.warn(TAG, 'gateway nao acessivel:', e); return null; }
      }
      function getVoiceChannel() {
        try { return selectedStore()?.getVoiceChannelId?.() || null; } catch (_) { return null; }
      }
      function realMedia() {
        try {
          const media = mediaStore();
          const mute = !!media?.isMute?.();
          const deaf = !!media?.isDeaf?.();
          lastActual = { mute, deaf };
          return lastActual;
        } catch (_) { return lastActual || { mute: false, deaf: false }; }
      }
      function effective(data) {
        const next = { ...data };
        if (fakeVoice) {
          // Reporta mute e deaf no Gateway; nao usa MediaEngine.setMute/setDeaf.
          next.self_mute = true;
          next.self_deaf = true;
        } else if (fakeMute) {
          next.self_mute = true;
        }
        return next;
      }
      function hookSocket() {
        const socket = getSocket();
        if (!socket) return false;
        if (activeSocket === socket && socket.send === wrappedSend) return true;
        // O Discord recria o socket em reconnects e troca o metodo send.
        if (activeSocket && wrappedSend && originalSend && activeSocket.send === wrappedSend) {
          try { activeSocket.send = originalSend; } catch (_) {}
        }
        activeSocket = null;
        const base = socket.send;
        if (typeof base !== 'function') return false;
        const wrapper = function (op, payload, ...args) {
          // Discord Gateway VOICE_STATE_UPDATE (opcode 4).
          if (op === 4 && payload && typeof payload === 'object') {
            lastVoicePayload = { ...payload };
            const outbound = effective(payload);
            const result = base.call(this, op, outbound, ...args);
            if (fakeMute || fakeVoice) {
              syncState = 'sent';
              statusText = 'Estado de voz enviado ao Discord';
              lastAppliedAt = Date.now();
            }
            return result;
          }
          return base.call(this, op, payload, ...args);
        };
        try {
          Object.defineProperty(wrapper, '__duPlusVoice', { value: true });
          socket.send = wrapper;
          if (socket.send !== wrapper) return false;
          activeSocket = socket;
          originalSend = base;
          wrappedSend = wrapper;
          return true;
        } catch (e) {
          console.warn(TAG, 'falha ao instalar hook do gateway:', e);
          return false;
        }
      }
      function buildPayload() {
        const channelId = getVoiceChannel();
        if (!channelId) return null;
        let channel = null;
        try { channel = channelStore()?.getChannel?.(channelId); } catch (_) {}
        let voice = null;
        try {
          const id = currentUser()?.id;
          if (id) voice = voiceStore()?.getVoiceStateForUser?.(id);
        } catch (_) {}
        const local = realMedia();
        return {
          guild_id: channel?.guild_id ?? lastVoicePayload?.guild_id ?? null,
          channel_id: channelId,
          self_mute: local.mute,
          self_deaf: local.deaf,
          self_video: voice?.selfVideo ?? lastVoicePayload?.self_video ?? false,
          flags: lastVoicePayload?.flags ?? 0
        };
      }
      function syncToDiscord() {
        const channelId = getVoiceChannel();
        if (!channelId) {
          syncState = 'pending';
          statusText = 'Fora da chamada: o modo sera aplicado ao entrar';
          return 'pending';
        }
        if (!hookSocket() || activeSocket?.isConnected?.() === false) {
          syncState = 'pending';
          statusText = 'Reconectando ao Gateway. O modo continua preparado';
          return 'pending';
        }
        const payload = buildPayload();
        if (!payload) {
          syncState = 'pending';
          statusText = 'Aguardando dados da chamada';
          return 'pending';
        }
        try {
          activeSocket.send(4, payload);
          syncState = 'sent';
          statusText = 'Estado de voz enviado ao Discord';
          lastAppliedAt = Date.now();
          return 'sent';
        } catch (e) {
          syncState = 'error';
          statusText = `Falha no envio: ${String(e?.message || e)}`;
          console.warn(TAG, statusText);
          return 'error';
        }
      }
      function toggle(kind) {
        if (kind === 'mute') fakeMute = !fakeMute;
        if (kind === 'voice') fakeVoice = !fakeVoice;
        // Ambos os modos podem coexistir: Fake Voice sempre implica self_mute.
        // Envia imediatamente OP4 quando ha chamada; senao aplica na proxima entrada.
        const result = syncToDiscord();
        updateButtons();
        return result;
      }
      const micIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>';
      const voiceIcon = '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15v-4a9 9 0 0 1 18 0v4"/><rect x="2" y="13" width="5" height="8" rx="2"/><rect x="17" y="13" width="5" height="8" rx="2"/></svg>';
      function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #${VOICE_ID}{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 5px;flex:0 0 auto}
          #${VOICE_ID} button{display:inline-flex;align-items:center;justify-content:center;position:relative;flex:0 0 auto;padding:0;border:1px solid rgba(255,255,255,.13);border-radius:9px;background:var(--background-modifier-selected,#313338);color:var(--interactive-normal,#dbdee1);cursor:pointer;transition:background .12s,color .12s,border-color .12s}
          #${VOICE_ID} button:hover{background:var(--background-modifier-hover,#43444b);color:white}
          #${VOICE_ID} button:focus-visible{outline:2px solid #99a3ff;outline-offset:2px}
          #${VOICE_ID} .du-plus-mute{width:29px;height:29px;min-width:29px;min-height:29px}
          #${VOICE_ID} .du-plus-voice{width:46px;height:36px;min-width:46px;min-height:36px}
          #${VOICE_ID} .is-on{background:rgba(237,66,69,.17)!important;color:#ff616b!important;border-color:rgba(237,66,69,.9)!important}
          #${VOICE_ID} .is-on::after{content:'';position:absolute;width:23px;height:2px;background:currentColor;border-radius:2px;transform:rotate(-44deg);pointer-events:none}
          #${VOICE_ID} .du-plus-mute.is-on::after{width:18px}
          #${VOICE_ID} .is-pending{border-style:dashed!important}
          #du-panel .du-plus-heading{color:#fff;font-weight:700;font-size:13px;margin:0 0 4px}
          #du-panel .du-plus-hint{color:var(--mut);font-size:11px;line-height:1.5;margin:3px 0 12px}
          #du-panel .du-plus-status{padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);margin:8px 0 13px;font-size:12px;color:var(--txt)}
          #du-panel .du-plus-status small{color:var(--mut);display:block;margin-top:4px;line-height:1.45}
          #du-panel .du-plus-status.pending{border-color:rgba(240,182,116,.5)}
          #du-panel .du-plus-status.error{border-color:rgba(237,66,69,.6)}
          #du-panel .du-plus-card{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:6px 0;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg2)}
          #du-panel .du-plus-card b{color:var(--txt);font-size:12px}
          #du-panel .du-plus-card small{display:block;color:var(--mut);line-height:1.4;margin-top:4px;font-size:11px}
          #du-panel .du-plus-card button{min-width:90px;background:var(--bg3);color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:8px 9px;cursor:pointer;font-size:11px}
          #du-panel .du-plus-card button.active{background:rgba(237,66,69,.17);border-color:rgba(237,66,69,.6);color:#ff888d}
          #du-panel .du-plus-card button:focus-visible{outline:2px solid #99a3ff}
        `;
        document.head.appendChild(style);
      }
      function findControls() {
        // Usa botao de mute nativo como ancora; evita colocar na linha errada.
        const buttons = Array.from(document.querySelectorAll('button[aria-label],button[title]'));
        const regex = /^(mute|unmute|silenciar|ativar microfone|desativar microfone|mutar|desmutar|microfone|microphone|toggle mute)(\b|\s|$)/i;
        const native = buttons.find(b => regex.test(b.getAttribute('aria-label') || b.title || '') && !b.closest('#du-panel') && !b.closest(`#${VOICE_ID}`));
        if (native) {
          const row = native.closest('[class*="buttons_"][class], [class*="buttons-"][class]');
          if (row && row !== document.body && row.isConnected) return row;
          if (native.parentElement?.parentElement?.isConnected) return native.parentElement.parentElement;
        }
        // Fallback: container de controles do rodape da conta.
        for (const panel of document.querySelectorAll('[class*="panels_"][class], [class*="panels-"][class]')) {
          const rows = Array.from(panel.querySelectorAll('[class*="buttons_"][class], [class*="buttons-"][class]'));
          const row = rows.find(x => x.querySelectorAll('button').length >= 2 && x.querySelectorAll('button').length <= 7);
          if (row && row.isConnected) return row;
        }
        return null;
      }
      function createButton(kind, className, html) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = className;
        el.dataset.duPlus = kind;
        el.setAttribute('role','switch');
        el.innerHTML = html;
        el.addEventListener('click', (event) => {
          event.stopPropagation(); event.preventDefault();
          toggle(kind);
        });
        return el;
      }
      function updateButtons() {
        const wrapper = document.getElementById(VOICE_ID);
        if (!wrapper) return;
        for (const [kind, enabled, visible] of [
          ['mute', fakeMute, options.showMute],
          ['voice', fakeVoice, options.showVoice]
        ]) {
          const button = wrapper.querySelector(`[data-du-plus="${kind}"]`);
          if (!button) continue;
          button.style.display = visible ? 'inline-flex' : 'none';
          button.classList.toggle('is-on',enabled);
          button.classList.toggle('is-pending',enabled && syncState === 'pending');
          button.setAttribute('aria-checked',String(enabled));
          const name = kind === 'mute' ? 'Fake Mute (pequeno)' : 'Fake Voice (maior)';
          const s = enabled ? (syncState === 'pending' ? 'preparado (aguardando chamada)' : 'ativado') : 'desativado';
          button.title = `${name}: ${s}`;
          button.setAttribute('aria-label',`${name}: ${s}`);
        }
        wrapper.style.display = options.showMute || options.showVoice ? 'flex' : 'none';
      }
      function mount() {
        if (!document.body) return;
        injectStyles();
        const target = findControls();
        if (!target) return;
        let wrapper = document.getElementById(VOICE_ID);
        if (!wrapper) {
          wrapper = document.createElement('div');
          wrapper.id = VOICE_ID;
          wrapper.append(
            createButton('mute','du-plus-mute',micIcon),
            createButton('voice','du-plus-voice',voiceIcon)
          );
        }
        if (wrapper.parentElement !== target) target.appendChild(wrapper);
        updateButtons();
      }
      function scheduleMount() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => { scheduled = false; mount(); }, 250);
      }
      function subscribeVoiceEvents() {
        if (voiceSubscriptions.length) return;
        const flux = findModule('dispatch','subscribe','unsubscribe');
        if (!flux) return;
        dispatcher = flux;
        for (const name of ['CONNECTION_OPEN','CONNECTION_RESUMED','VOICE_CHANNEL_SELECT']) {
          const listener = () => {
            memo.delete('socket');
            hookSocket();
            if (fakeMute || fakeVoice) syncToDiscord();
            updateButtons();
          };
          try { flux.subscribe(name, listener); voiceSubscriptions.push([name,listener]); } catch (_) {}
        }
      }
      function heading(body, title, description) {
        const h = document.createElement('div');
        h.className = 'du-plus-heading'; h.textContent = title; body.appendChild(h);
        if (description) {
          const p = document.createElement('p'); p.className = 'du-plus-hint';
          p.textContent = description; body.appendChild(p);
        }
      }
      function panelToggle(body, title, description, on, change) {
        const card = document.createElement('div');card.className = 'du-plus-card';
        const detail = document.createElement('div');
        const label = document.createElement('b');label.textContent = title;detail.appendChild(label);
        const caption = document.createElement('small');caption.textContent = description;detail.appendChild(caption);
        const button = document.createElement('button');button.type='button';
        button.textContent = on ? 'Ativado' : 'Desativado';
        button.setAttribute('aria-pressed', String(on));button.classList.toggle('active',on);
        button.onclick = () => {change();renderSettings(body);};
        card.append(detail,button);body.appendChild(card);
      }
      function renderSettings(body) {
        body.replaceChildren();
        heading(body, 'Estado da chamada', 'O Fake Mute envia self_mute; o Fake Voice envia self_mute e self_deaf ao Gateway. O microfone e os fones continuam controlados pelo Discord local.');
        const status = document.createElement('div');status.className='du-plus-status';
        status.classList.toggle('pending', syncState === 'pending');
        status.classList.toggle('error', syncState === 'error');
        const state = document.createElement('strong');
        state.textContent = `${fakeMute ? 'Fake Mute ligado' : 'Fake Mute desligado'} · ${fakeVoice ? 'Fake Voice ligado' : 'Fake Voice desligado'}`;
        const detail = document.createElement('small');detail.textContent=statusText;
        status.append(state,detail);body.appendChild(status);
        heading(body,'Ligar e desligar','Use estes controles ou os botões ao lado dos controles nativos do Discord.');
        panelToggle(body,'Fake Mute — botão pequeno','Aparecer mutado na chamada sem desligar o microfone local.',fakeMute,()=>toggle('mute'));
        panelToggle(body,'Fake Voice — botão maior','Aparecer mutado e sem ouvir, mantendo a recepção local.',fakeVoice,()=>toggle('voice'));
        heading(body,'Exibição dos botões','Escolha quais controles extras aparecem na barra de voz.');
        panelToggle(body,'Mostrar Fake Mute','Exibir o botão pequeno de microfone.',options.showMute,()=>{options.showMute=!options.showMute;save();updateButtons();});
        panelToggle(body,'Mostrar Fake Voice','Exibir o botão maior de fone.',options.showVoice,()=>{options.showVoice=!options.showVoice;save();updateButtons();});
        const hint = document.createElement('p');hint.className='du-plus-hint';
        hint.textContent='Quando estiver fora de uma chamada, os modos ficam preparados. Ao conectar, o estado será enviado. Se estiver usando mute/deafen real, essas opções locais continuam valendo.';
        body.appendChild(hint);
      }
      function start() {
        if (running) return;
        running = true;
        cleanOldLogger();
        injectStyles();
        hookSocket();
        subscribeVoiceEvents();
        mount();
        new MutationObserver(scheduleMount).observe(document.body, { childList:true, subtree:true });
        // Reconexoes podem ocorrer sem evento Flux exposto em algumas builds.
        setInterval(() => {
          const old = activeSocket;
          const oldHook = !!activeSocket && activeSocket.send === wrappedSend;
          const hooked = hookSocket();
          if (!voiceSubscriptions.length) subscribeVoiceEvents();
          if (hooked && (old !== activeSocket || !oldHook) && (fakeMute || fakeVoice)) syncToDiscord();
          cleanOldLogger();
        }, 2000);
        console.info(TAG,'ativo: Fake Mute pequeno + Fake Voice maior. Sem registro de mensagens.');
      }
      return { start, renderSettings, status: () => ({fakeMute, fakeVoice, syncState, statusText, lastAppliedAt, options}) };
    })();

    // DiscordUtils+ — controles de voz. Base DiscordUtils (licenca MIT).
    // Integracao adaptada do FakeMuteX v1.2.7 por MrCross:
    // https://github.com/mrcrossog/FakeMuteX (README declara licenca MIT).
    // WebSocket.prototype.send e atalho configuravel adaptados; BdApi nao e usado.
    // Inserido na closure renderer.js: acessa os stores carregados do Discord.
    const DU_PLUS = (() => {
      'use strict';
      const TAG = '[DiscordUtils+/Voz]';
      const VOICE_ID = 'du-plus-voice-buttons';
      const STYLE_ID = 'du-plus-voice-style';
      const LOCAL_ID = 'du-plus-local-status';
      const SELF_CLASS = 'du-plus-self-voice-status';
      const DEFAULT_KEYBIND = Object.freeze({key:'F6', code:'F6', ctrl:false, shift:false, alt:false});
      const DEFAULT_VOICE_KEYBIND = Object.freeze({key:'F7', code:'F7', ctrl:false, shift:false, alt:false});
      const defaultOptions = { showMute:true, showVoice:true, showLocalStatus:true, enableMuteKeybind:true, muteKeybind:DEFAULT_KEYBIND,
        enableVoiceKeybind:true, voiceKeybind:DEFAULT_VOICE_KEYBIND };
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
      let nativeWSOriginal = null, nativeWSWrapped = null;
      let recentRawSocket = null, recentRawVoice = null, recentRawPacket = null, recentRawAt = 0;
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

      // FakeMuteX intercepta WebSocket.prototype.send. Aqui fazemos o mesmo
      // como fallback, mas aceitando JSON string, ArrayBuffer e TypedArray.
      // Frames comprimidos/binarios desconhecidos passam intactos.
      function decodeGatewayFrame(frame) {
        let text, format = 'string';
        if (typeof frame === 'string') { text = frame; }
        else if (typeof ArrayBuffer !== 'undefined' && frame instanceof ArrayBuffer) {
          if (frame.byteLength > 32768) return null;
          text = new TextDecoder().decode(frame); format = 'buffer';
        } else if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(frame)) {
          if (frame.byteLength > 32768) return null;
          text = new TextDecoder().decode(new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength));
          format = 'view';
        } else return null;
        if (!text || text.length > 32768 || !text.includes('"op"')) return null;
        let packet;
        try { packet = JSON.parse(text); } catch (_) { return null; }
        if (!packet || packet.op !== 4 || !packet.d || typeof packet.d !== 'object'
            || !Object.prototype.hasOwnProperty.call(packet.d, 'self_mute')) return null;
        return { packet, format };
      }
      function encodeGatewayFrame(packet, format) {
        const text = JSON.stringify(packet);
        if (format === 'string') return text;
        const bytes = new TextEncoder().encode(text);
        return format === 'buffer' ? bytes.buffer : bytes;
      }
      function hookRawWebSocket() {
        if (typeof WebSocket !== 'function' || typeof WebSocket.prototype?.send !== 'function') return false;
        if (WebSocket.prototype.send === nativeWSWrapped) return true;
        const base = WebSocket.prototype.send;
        const wrapped = function (frame) {
          let outgoing = frame;
          try {
            const decoded = decodeGatewayFrame(frame);
            if (decoded) {
              recentRawSocket = this;
              recentRawVoice = { ...decoded.packet.d };
              recentRawPacket = decoded.packet;
              recentRawAt = Date.now();
              if (fakeMute || fakeVoice) {
                const altered = { ...decoded.packet, d: effective(decoded.packet.d) };
                outgoing = encodeGatewayFrame(altered, decoded.format);
              }
            }
          } catch (error) { console.warn(TAG, 'interceptacao WebSocket:', error); }
          return base.call(this, outgoing);
        };
        try {
          Object.defineProperty(wrapped, '__duPlusRawVoice', { value:true });
          WebSocket.prototype.send = wrapped;
          if (WebSocket.prototype.send !== wrapped) return false;
          nativeWSOriginal = base; nativeWSWrapped = wrapped;
          return true;
        } catch (error) { console.warn(TAG, 'hook WebSocket indisponivel:', error); return false; }
      }
      function rawVoiceResend() {
        if (!recentRawSocket || !recentRawVoice || !recentRawPacket || !nativeWSOriginal) return false;
        if (recentRawSocket.readyState !== 1 || !recentRawVoice.channel_id) return false;
        const selected = getVoiceChannel();
        if (selected && String(selected) !== String(recentRawVoice.channel_id)) return false;
        if (!selected && Date.now() - recentRawAt > 45000) return false;
        const media = mediaStore();
        const real = media ? realMedia() : {mute:!!recentRawVoice.self_mute, deaf:!!recentRawVoice.self_deaf};
        const fresh = { ...recentRawVoice, self_mute:real.mute, self_deaf:real.deaf };
        const packet = { ...recentRawPacket, op:4, d:effective(fresh) };
        try {
          nativeWSOriginal.call(recentRawSocket, JSON.stringify(packet));
          syncState = 'sent';
          statusText = 'Estado de voz enviado pelo WebSocket (FakeMuteX)';
          lastAppliedAt = Date.now();
          return true;
        } catch (error) { console.warn(TAG, 'reenvio WebSocket:', error); return false; }
      }
      function normalizeKeybind(kind='mute') {
        const voice = kind === 'voice';
        const fallback = voice ? DEFAULT_VOICE_KEYBIND : DEFAULT_KEYBIND;
        const k = voice ? options.voiceKeybind : options.muteKeybind;
        return k && typeof k === 'object' && typeof k.code === 'string' ? k : fallback;
      }
      function printKeybind(kind='mute') {
        const k=normalizeKeybind(kind);
        return [k.ctrl&&'Ctrl',k.shift&&'Shift',k.alt&&'Alt',k.key||k.code].filter(Boolean).join('+');
      }
      function handleVoiceShortcuts(event) {
        if (event.repeat || event.isComposing || event.metaKey ||
            event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
        const match = (k)=> event.code === k.code && event.ctrlKey === !!k.ctrl &&
          event.shiftKey === !!k.shift && event.altKey === !!k.alt;
        const mute = options.enableMuteKeybind && match(normalizeKeybind('mute'));
        const voice = options.enableVoiceKeybind && match(normalizeKeybind('voice'));
        if (!mute && !voice) return;
        event.preventDefault();event.stopPropagation();
        toggle(mute?'mute':'voice');
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
        if (channelId && hookSocket() && activeSocket?.isConnected?.() !== false) {
          const payload = buildPayload();
          if (payload) {
            try {
              activeSocket.send(4, payload);
              syncState = 'sent';
              statusText = 'Estado de voz enviado pelo Gateway';
              lastAppliedAt = Date.now();
              return 'sent';
            } catch (e) { console.warn(TAG, 'falha no envio direto:', e); }
          }
        }
        // Em algumas builds, getSocket nao fica exposto. FakeMuteX usa
        // WebSocket.send; usamos a ultima sessao observada para reenviar OP4.
        if (rawVoiceResend()) return 'sent';
        syncState = 'pending';
        statusText = channelId ? 'Gateway indisponivel: aguardando proximo pacote de voz'
          : 'Fora da chamada: o modo sera aplicado ao entrar';
        return 'pending';
      }
      function toggle(kind) {
        if (kind === 'mute') fakeMute = !fakeMute;
        if (kind === 'voice') fakeVoice = !fakeVoice;
        // Ambos os modos podem coexistir: Fake Voice sempre implica self_mute.
        // Envia imediatamente OP4 quando ha chamada; senao aplica na proxima entrada.
        const result = syncToDiscord();
        updateButtons();
        syncLocalStatus();
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
          #${LOCAL_ID}, .${SELF_CLASS}{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;margin:3px 5px;border:1px solid rgba(237,66,69,.45);border-radius:8px;background:rgba(237,66,69,.13);color:#ff9b9e;font:600 11px/1.3 var(--font-primary,system-ui);width:max-content;max-width:100%;pointer-events:none}
          #${LOCAL_ID} svg, .${SELF_CLASS} svg{width:14px;height:14px;flex-shrink:0}
          #${LOCAL_ID}[data-pending="true"], .${SELF_CLASS}[data-pending="true"]{border-style:dashed;color:#edca8e;border-color:rgba(240,182,116,.6)}
          .${SELF_CLASS}{padding:2px 5px;font-size:10px;margin-left:5px}
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
        syncLocalStatus();
      }

      // Indicadores no proprio Discord, independentes da visibilidade dos botoes.
      // O estado real de microfone/fones nao e alterado por estes elementos.
      function localMode() {
        if (!options.showLocalStatus || (!fakeMute && !fakeVoice)) return null;
        return {voice:fakeVoice,pending:syncState !== 'sent'};
      }
      function findOwnVoiceRow() {
        const uid=currentId();
        if (uid==='anon') return null;
        for (const node of document.querySelectorAll('[data-list-item-id], [data-voice-user-id], [data-user-id]')) {
          const value=node.getAttribute?.('data-list-item-id') || '';
          const exact=node.getAttribute?.('data-voice-user-id') || node.getAttribute?.('data-user-id') || '';
          const match=(value.includes('voice') && (value.endsWith('-'+uid) || value.endsWith(':'+uid))) ||
            (exact===uid && !!node.closest?.('[class*="voiceUser"],[class*="voiceUsers"],[class*="voiceChannel"]'));
          if (!match) continue;
          const row=node.closest?.('li,[role="listitem"]') || node;
          if (row.closest?.('#du-panel') || row.closest?.('#'+VOICE_ID)) continue;
          return row;
        }
        return null;
      }
      function fillLocalBadge(node,mode,detailed) {
        const signature=(mode.voice?'voice':'mute')+'-'+(mode.pending?'pending':'sent');
        if (node.dataset?.state === signature) return;
        node.replaceChildren();
        const glyph=document.createElement('span');
        glyph.innerHTML=mode.voice?voiceIcon:micIcon;
        glyph.setAttribute('aria-hidden','true');
        const label=document.createElement('span');
        label.textContent=(mode.voice?'Fake Voice':'Fake Mute')+(detailed?(mode.pending?' (aguardando)':' ativo'):'');
        node.append(glyph,label);
        node.dataset.state=signature;
        node.dataset.pending=String(mode.pending);
        node.title=mode.voice?'Exibicao falsa de mutado e surdo; audio local permanece independente':
          'Exibicao falsa de mutado; microfone local permanece independente';
      }
      function syncLocalStatus() {
        const mode=localMode();
        const controls=findControls();
        let banner=document.getElementById(LOCAL_ID);
        if (mode && controls?.parentElement) {
          if (!banner) {
            banner=document.createElement('div');banner.id=LOCAL_ID;
            banner.setAttribute('role','status');
          }
          if (banner.previousElementSibling!==controls) controls.insertAdjacentElement('afterend',banner);
          fillLocalBadge(banner,mode,true);
        } else banner?.remove();
        const row=mode?findOwnVoiceRow():null;
        for (const old of document.querySelectorAll('.'+SELF_CLASS)) {
          if (!row || old.parentElement!==row) old.remove();
        }
        if (row?.isConnected && mode) {
          let badge=Array.from(row.children).find(el=>el.classList?.contains(SELF_CLASS));
          if (!badge) {badge=document.createElement('span');badge.className=SELF_CLASS;row.appendChild(badge);}
          fillLocalBadge(badge,mode,false);
        }
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
            syncLocalStatus();
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
        panelToggle(body,'Mostrar meu estado falso','Exibe indicador na barra e ao lado do seu nome na chamada.',
          options.showLocalStatus,()=>{options.showLocalStatus=!options.showLocalStatus;save();syncLocalStatus();});

        heading(body,'Atalho do Fake Mute','FakeMuteX: por padrao F6. Clique no campo e pressione uma combinacao para redefinir (aceita NumPad).');
        panelToggle(body,'Habilitar atalho de teclado','Liga e desliga o Fake Mute sem abrir o painel.',options.enableMuteKeybind,()=>{
          options.enableMuteKeybind = !options.enableMuteKeybind;save();
        });
        const bind = document.createElement('input');
        bind.type = 'text'; bind.readOnly = true;
        bind.className = 'du-input';
        bind.setAttribute('aria-label','Atalho do Fake Mute');
        bind.value = printKeybind('mute');
        bind.title = 'Clique e pressione a combinacao desejada';
        bind.addEventListener('keydown',event=>{
          event.preventDefault();event.stopPropagation();
          if (['Control','Shift','Alt','Meta','Escape'].includes(event.key)) return;
          options.muteKeybind = {key:event.key, code:event.code, ctrl:!!event.ctrlKey,
            shift:!!event.shiftKey, alt:!!event.altKey};
          save(); bind.value = printKeybind('mute');
        });
        body.appendChild(bind);
        heading(body,'Atalho do Fake Voice','F7 por padrao. Tambem funciona com o botao extra escondido.');
        panelToggle(body,'Habilitar atalho Fake Voice','Liga/desliga pelo teclado.',
          options.enableVoiceKeybind,()=>{options.enableVoiceKeybind=!options.enableVoiceKeybind;save();});
        const voiceBind=document.createElement('input');
        voiceBind.type='text';voiceBind.readOnly=true;voiceBind.className='du-input';
        voiceBind.setAttribute('aria-label','Atalho do Fake Voice');
        voiceBind.value=printKeybind('voice');
        voiceBind.addEventListener('keydown',event=>{
          event.preventDefault();event.stopPropagation();
          if(['Control','Shift','Alt','Meta','Escape'].includes(event.key))return;
          options.voiceKeybind={key:event.key,code:event.code,ctrl:!!event.ctrlKey,
            shift:!!event.shiftKey,alt:!!event.altKey};
          save();voiceBind.value=printKeybind('voice');
        });
        body.appendChild(voiceBind);
        const hint = document.createElement('p');hint.className='du-plus-hint';
        hint.textContent='Quando estiver fora de uma chamada, os modos ficam preparados. Ao conectar, o estado será enviado. Se estiver usando mute/deafen real, essas opções locais continuam valendo.';
        body.appendChild(hint);
      }
      function start() {
        if (running) return;
        running = true;
        cleanOldLogger();
        injectStyles();
        hookRawWebSocket();
        hookSocket();
        subscribeVoiceEvents();
        mount();
        document.addEventListener('keydown',handleVoiceShortcuts,true);
        new MutationObserver(scheduleMount).observe(document.body, { childList:true, subtree:true });
        // Reconexoes podem ocorrer sem evento Flux exposto em algumas builds.
        setInterval(() => {
          const old = activeSocket;
          const oldHook = !!activeSocket && activeSocket.send === wrappedSend;
          hookRawWebSocket();
          const hooked = hookSocket();
          if (!voiceSubscriptions.length) subscribeVoiceEvents();
          if (hooked && (old !== activeSocket || !oldHook) && (fakeMute || fakeVoice)) syncToDiscord();
          cleanOldLogger();
          syncLocalStatus();
        }, 2000);
        console.info(TAG,'FakeMuteX: F6 fake mute, F7 fake voice, indicadores no proprio Discord.');
      }
      return { start, renderSettings, status: () => ({fakeMute, fakeVoice, syncState, statusText, lastAppliedAt, options}) };
    })();

    // DiscordUtils+ custom addon: Fake Mute / Fake Voice / 24h local delete log.
    // Injected within the original DiscordUtils renderer closure.
    const DU_PLUS = (() => {
      'use strict';
      const DAY = 24 * 60 * 60 * 1000;
      const MAX_SEEN = 450, MAX_DELETED = 240;
      const STYLE_ID_PLUS = 'du-plus-style';
      const VOICE_ID = 'du-plus-voice-buttons';
      const mark = '[DiscordUtils+]';
      const getUid = () => { try { return String(currentUser()?.id || 'anon'); } catch (_) { return 'anon'; } };
      const key = (suffix) => `DiscordUtils.plus.v1.${getUid()}.${suffix}`;
      const safeRead = (suffix, fallback) => { try { const v = JSON.parse(localStorage.getItem(key(suffix))); return v === null ? fallback : v; } catch (_) { return fallback; } };
      const safeSave = (suffix, value) => { try { localStorage.setItem(key(suffix), JSON.stringify(value)); return true; } catch (e) { console.warn(mark, 'sem armazenamento local:', e); return false; } };
      const defaultOptions = Object.freeze({ showMute: true, showVoice: true, saveDeleted: false });
      const options = { ...defaultOptions, ...safeRead('options', {}) };
      let fakeMute = false, fakeVoice = false;
      let lastError = '';
      let sock = null, originalSend = null, lastVoicePayload = null;
      let dispatcher = null, originalDispatch = null;
      let mounted = false, scheduled = false, listenersStarted = false;
      let seen = safeRead('seen', []), deleted = safeRead('deleted', []);
      if (!Array.isArray(seen)) seen = [];
      if (!Array.isArray(deleted)) deleted = [];
      const now = () => Date.now();
      const keepRecent = (items, max, field) => items.filter(x => x && Number.isFinite(x[field]) && now() - x[field] < DAY).slice(-max);
      function prune() {
        const beforeSeen = seen.length, beforeDeleted = deleted.length;
        seen = keepRecent(seen, MAX_SEEN, 'seenAt');
        deleted = keepRecent(deleted, MAX_DELETED, 'deletedAt');
        if (seen.length !== beforeSeen) safeSave('seen', seen);
        if (deleted.length !== beforeDeleted) safeSave('deleted', deleted);
      }
      prune();
      function persistOptions() { safeSave('options', options); updateButtons(); }
      function getModule(...methods) { try { return findByMethods(...methods); } catch (_) { return null; } }
      function moduleWith(...props) { try { return findByProps(...props); } catch (_) { return null; } }
      function findSocket() {
        const module = moduleWith('getSocket');
        try { const candidate = module && module.getSocket(); if (candidate && typeof candidate.send === 'function') return candidate; } catch (_) {}
        return null;
      }
      function patchSocket() {
        const current = findSocket();
        if (!current) { lastError = 'Gateway do Discord indisponível'; return false; }
        if (sock === current && current.send?.__duPlusSend) { lastError = ''; return true; }
        // If another add-on replaced send, rehook the current function instead of assuming success.
        sock = current;
        const baseSend = current.send;
        originalSend = baseSend;
        const wrapped = function(op, payload, ...rest) {
          if (op === 4 && payload && typeof payload === 'object') {
            lastVoicePayload = { ...payload };
            let modified = { ...payload };
            if (fakeVoice) { modified.self_mute = true; modified.self_deaf = true; }
            else if (fakeMute) modified.self_mute = true;
            return baseSend.call(this, op, modified, ...rest);
          }
          return baseSend.call(this, op, payload, ...rest);
        };
        try { Object.defineProperty(wrapped, '__duPlusSend', { value: true }); current.send = wrapped; lastError = ''; return true; }
        catch (e) { lastError = `Não foi possível conectar ao gateway: ${e.message}`; return false; }
      }
      function voiceStatePayload() {
        const selected = getModule('getVoiceChannelId');
        const channels = getModule('getChannel');
        const media = getModule('isMute', 'isDeaf');
        const user = currentUser();
        const voice = getModule('getVoiceStateForUser');
        let channelId = null;
        try { channelId = selected?.getVoiceChannelId?.(); } catch (_) {}
        if (!channelId) return null;
        let channel = null;
        try { channel = channels?.getChannel(channelId); } catch (_) {}
        let vs = null;
        try { vs = user?.id && voice?.getVoiceStateForUser(user.id); } catch (_) {}
        return {
          guild_id: channel?.guild_id ?? lastVoicePayload?.guild_id ?? null,
          channel_id: channelId,
          self_mute: !!(media?.isMute?.() ?? false),
          self_deaf: !!(media?.isDeaf?.() ?? false),
          self_video: !!(vs?.selfVideo ?? lastVoicePayload?.self_video ?? false),
          flags: lastVoicePayload?.flags ?? 0
        };
      }
      function refreshVoiceOnServer() {
        if (!patchSocket()) return false;
        const data = voiceStatePayload();
        if (!data) { lastError = 'Pronto: o estado será aplicado quando entrar em uma chamada'; return true; }
        try {
          if (sock.isConnected?.() === false) { lastError = 'Gateway ainda está desconectado'; return false; }
          sock.send(4, data);
          lastError = '';
          return true;
        } catch (e) { lastError = 'Falha ao enviar estado: ' + e.message; return false; }
      }
      function toggleFake(which) {
        if (!patchSocket()) { updateButtons(); return false; }
        const previousMute = fakeMute, previousVoice = fakeVoice;
        if (which === 'mute') fakeMute = !fakeMute;
        else fakeVoice = !fakeVoice;
        if (!refreshVoiceOnServer()) {
          fakeMute = previousMute; fakeVoice = previousVoice;
          updateButtons(); return false;
        }
        updateButtons();
        return true;
      }
      const iconMic = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>';
      const iconDeaf = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15V11a9 9 0 0 1 18 0v4"/><rect x="2" y="13" width="5" height="8" rx="2"/><rect x="17" y="13" width="5" height="8" rx="2"/><path d="M17 22a5 5 0 0 1-5 2"/></svg>';
      function injectPlusStyle() {
        if (document.getElementById(STYLE_ID_PLUS)) return;
        const sheet = document.createElement('style'); sheet.id = STYLE_ID_PLUS;
        sheet.textContent = `
          #${VOICE_ID}{display:flex;align-items:center;gap:5px;margin:0 5px;flex-shrink:0}
          #${VOICE_ID} button{display:flex;align-items:center;justify-content:center;position:relative;box-sizing:border-box;border:1px solid rgba(255,255,255,.11);border-radius:9px;background:var(--background-modifier-selected,#313338);color:var(--interactive-normal,#dbdee1);cursor:pointer;transition:background .13s,color .13s,border-color .13s}
          #${VOICE_ID} button:hover{background:#464958;color:white}
          #${VOICE_ID} .du-plus-mute{width:29px;height:29px;min-width:29px;min-height:29px}
          #${VOICE_ID} .du-plus-voice{width:46px;height:36px;min-width:46px;min-height:36px}
          #${VOICE_ID} .is-on{background:rgba(237,66,69,.18)!important;color:#ff616b!important;border-color:rgba(237,66,69,.8)!important}
          #${VOICE_ID} .is-on:after{content:'';position:absolute;width:25px;height:2px;background:currentColor;transform:rotate(-43deg);border-radius:2px;left:50%;top:50%;margin-left:-12px}
          #${VOICE_ID} .du-plus-mute.is-on:after{width:18px;margin-left:-9px}
          #du-panel .du-plus-line{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:7px 0;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--bg2);font-size:12px}
          #du-panel .du-plus-line button{border:1px solid #5865f2;border-radius:8px;color:#fff;background:#4858a9;padding:7px 12px;cursor:pointer;white-space:nowrap}
          #du-panel .du-plus-line button.on{background:#294b38;border-color:#3ba55c}
          #du-panel .du-plus-line small{display:block;color:var(--mut);margin-top:4px;line-height:1.4}
          #du-panel .du-plus-message{padding:12px;margin:8px 0;background:var(--bg2);border:1px solid var(--line);border-radius:10px;overflow-wrap:anywhere}
          #du-panel .du-plus-message strong{font-size:12px;color:#fff}
          #du-panel .du-plus-message small{display:block;color:var(--mut);font-size:11px;margin-top:4px}
          #du-panel .du-plus-message p{white-space:pre-wrap;margin:9px 0 0;line-height:1.5;font-size:12px;color:#d7d7df}
          #du-panel .du-plus-help{font-size:12px;line-height:1.5;color:var(--mut);margin:9px 0}
          #du-panel .du-plus-danger{color:#ff8589;border:1px solid rgba(237,66,69,.4);background:rgba(237,66,69,.1);padding:8px 10px;border-radius:8px;cursor:pointer}
        `;
        document.head.appendChild(sheet);
      }
      function canMountIn(node) { return !!(node && node.isConnected && node !== document.body && node.querySelectorAll('button').length >= 1); }
      function findControlSpot() {
        // Prefer buttons row inside the native account controls (bottom-left corner).
        for (const panel of document.querySelectorAll('[class*="panels_"], [class*="panels-"]')) {
          for (const row of panel.querySelectorAll('[class*="buttons_"], [class*="buttons-"]')) {
            if (canMountIn(row) && row.querySelectorAll('button').length <= 10) return row;
          }
        }
        // Discord versions rename class hashes. Anchor to native mic/deafen labels.
        const controls = [...document.querySelectorAll('button[aria-label],button[title]')];
        const mic = controls.find(b => /(^mute$|microfone|micr[oó]fono|desativar microfone|mute microphone|unmute|silenciar)/i.test(b.getAttribute('aria-label') || b.title || ''));
        if (mic) { const row = mic.parentElement?.parentElement; if (canMountIn(row)) return row; }
        return null;
      }
      function makeButton(type, cls, html, text, handler) {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = cls; btn.dataset.duPlus = type;
        btn.innerHTML = html; btn.setAttribute('role', 'switch');
        btn.title = text;
        btn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); handler(); });
        return btn;
      }
      function updateButtons() {
        const row = document.getElementById(VOICE_ID); if (!row) return;
        for (const [kind, enabled, shown] of [['mute', fakeMute, options.showMute], ['voice', fakeVoice, options.showVoice]]) {
          const b = row.querySelector(`[data-du-plus="${kind}"]`);
          if (!b) continue;
          b.style.display = shown ? 'flex' : 'none'; b.classList.toggle('is-on', enabled);
          b.setAttribute('aria-checked', String(enabled));
          b.title = kind === 'mute' ? `Fake Mute (pequeno): ${enabled ? 'ligado' : 'desligado'} — voz continua ativa` : `Fake Voice (grande): ${enabled ? 'ligado' : 'desligado'} — áudio continua ativo`;
        }
        row.style.display = (options.showMute || options.showVoice) ? 'flex' : 'none';
      }
      function mountButtons() {
        if (!document.body) return;
        injectPlusStyle();
        const spot = findControlSpot();
        if (!spot) return;
        let wrapper = document.getElementById(VOICE_ID);
        if (!wrapper) {
          wrapper = document.createElement('div'); wrapper.id = VOICE_ID;
          wrapper.appendChild(makeButton('mute','du-plus-mute',iconMic,'Fake Mute',()=>toggleFake('mute')));
          wrapper.appendChild(makeButton('voice','du-plus-voice',iconDeaf,'Fake Voice',()=>toggleFake('voice')));
        }
        if (wrapper.parentElement !== spot) spot.appendChild(wrapper);
        updateButtons();
      }
      function scheduleMount() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => { scheduled = false; mountButtons(); }, 300);
      }
      function serializeMessage(msg, channelId) {
        if (!msg) return null;
        const id = String(msg.id || '');
        const ch = String(msg.channel_id || msg.channelId || channelId || '');
        if (!id || !ch) return null;
        const author = msg.author || {};
        const authorId = String(author.id || msg.author_id || '');
        const attachmentNames = (Array.isArray(msg.attachments) ? msg.attachments : []).slice(0, 5).map(a => String(a.filename || 'arquivo').slice(0, 150));
        return {
          id, channelId: ch,
          authorId, authorName: String(author.global_name || author.globalName || author.username || msg.nick || authorId || 'Desconhecido').slice(0, 90),
          content: String(msg.content || '').slice(0, 4000),
          attachments: attachmentNames,
          seenAt: now()
        };
      }
      function capture(msg, channelId) {
        if (!options.saveDeleted) return;
        const entry = serializeMessage(msg, channelId);
        if (!entry) return;
        const i = seen.findIndex(x => x.id === entry.id && x.channelId === entry.channelId);
        if (i >= 0) seen.splice(i, 1);
        seen.push(entry);
        seen = keepRecent(seen, MAX_SEEN, 'seenAt');
        safeSave('seen', seen);
      }
      function cacheChannel(channelId) {
        if (!options.saveDeleted || !channelId) return;
        const messages = getModule('getMessage', 'getMessages');
        if (!messages?.getMessages) return;
        try {
          const collection = messages.getMessages(channelId);
          const items = Array.isArray(collection) ? collection : (typeof collection?.toArray === 'function' ? collection.toArray() : collection?._array || []);
          for (const msg of items.slice(-80)) capture(msg, channelId);
        } catch (_) {}
      }
      function recordDeleted(channelId, messageId) {
        if (!options.saveDeleted || !channelId || !messageId) return;
        const messageStore = getModule('getMessage', 'getMessages');
        let msg = null;
        try { msg = messageStore?.getMessage?.(channelId, messageId); } catch (_) {}
        const entry = (msg ? serializeMessage(msg, channelId) : null) || seen.find(x => x.id === String(messageId) && x.channelId === String(channelId));
        if (!entry || (!entry.content && !entry.attachments.length)) return;
        if (deleted.some(x => x.id === entry.id && x.channelId === entry.channelId)) return;
        deleted.push({ ...entry, deletedAt: now() });
        deleted = keepRecent(deleted, MAX_DELETED, 'deletedAt');
        safeSave('deleted', deleted);
      }
      function onDiscordEvent(evt) {
        if (!options.saveDeleted || !evt || typeof evt !== 'object') return;
        const type = evt.type;
        if (type === 'MESSAGE_CREATE') capture(evt.message, evt.channelId || evt.channel_id);
        else if (type === 'MESSAGE_UPDATE') capture(evt.message, evt.channelId || evt.channel_id);
        else if (type === 'MESSAGE_DELETE') recordDeleted(evt.channelId || evt.channel_id, evt.id || evt.messageId);
        else if (type === 'MESSAGE_DELETE_BULK') {
          const channelId = evt.channelId || evt.channel_id;
          for (const id of (evt.ids || evt.messageIds || []).slice(0, 200)) recordDeleted(channelId, id);
        } else if (type === 'CHANNEL_SELECT') {
          cacheChannel(evt.channelId || evt.channel_id);
        }
      }
      function patchDispatcher() {
        if (!options.saveDeleted) return;
        const current = getModule('dispatch', 'subscribe', 'unsubscribe');
        if (!current || typeof current.dispatch !== 'function') return;
        if (dispatcher === current && current.dispatch?.__duPlusDispatch) return;
        dispatcher = current;
        const baseDispatch = current.dispatch;
        originalDispatch = baseDispatch;
        const wrapped = function(event, ...args) {
          try { onDiscordEvent(event); } catch (e) { console.warn(mark, 'falha ao registrar evento', e); }
          return baseDispatch.call(this, event, ...args);
        };
        try { Object.defineProperty(wrapped, '__duPlusDispatch', { value: true }); current.dispatch = wrapped; } catch (_) {}
      }
      function disableDispatcher() {
        if (dispatcher && originalDispatch && dispatcher.dispatch?.__duPlusDispatch) dispatcher.dispatch = originalDispatch;
        dispatcher = null; originalDispatch = null;
      }
      const plain = (tag, text, parent) => { const element = document.createElement(tag); element.textContent = text; if (parent) parent.appendChild(element); return element; };
      function heading(body, title, help) { plain('div', title, body).className = 'du-sec'; if (help) plain('p', help, body).className = 'du-plus-help'; }
      function control(body, title, help, active, change) {
        const line = document.createElement('div'); line.className = 'du-plus-line';
        const text = document.createElement('div');
        plain('strong', title, text); plain('small', help, text);
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = active ? 'Ativado' : 'Desativado';
        b.classList.toggle('on', !!active);
        b.addEventListener('click', () => { change(); renderSettings(body); });
        line.append(text, b); body.appendChild(line);
      }
      function renderSettings(body) {
        body.replaceChildren();
        heading(body, 'Fake Voice e Fake Mute', 'Os botões ficam nos controles nativos de voz. O pequeno é Fake Mute; o maior é Fake Voice (simula estar surdo e mutado). A transmissão e recepção reais continuam dependendo das configurações locais de áudio.');
        control(body, 'Mostrar botão Fake Mute (pequeno)', 'Exibe o botão menor ao lado dos controles de voz.', options.showMute, () => { options.showMute = !options.showMute; persistOptions(); });
        control(body, 'Mostrar botão Fake Voice (grande)', 'Exibe o botão maior para simular surdez e mute.', options.showVoice, () => { options.showVoice = !options.showVoice; persistOptions(); });
        control(body, 'Fake Mute agora', 'Reportar microfone desligado sem realmente cortar sua voz.', fakeMute, () => toggleFake('mute'));
        control(body, 'Fake Voice agora', 'Reportar microfone e áudio desligados sem realmente silenciar seu PC.', fakeVoice, () => toggleFake('voice'));
        heading(body, 'Registro de mensagens apagadas (24 horas)', 'Salva localmente mensagens novas/visíveis enquanto o mod está aberto. Não recupera mensagens apagadas antes da captura.');
        control(body, 'Registrar mensagens apagadas', 'Desligado por padrão. Ao ligar, guarda mensagens vistas e as apagadas durante até 24 horas; sem envio para servidores externos.', options.saveDeleted, () => { options.saveDeleted = !options.saveDeleted; persistOptions(); if (options.saveDeleted) { patchDispatcher(); const selected = getModule('getChannelId'); try { cacheChannel(selected?.getChannelId?.()); } catch (_) {} } else { disableDispatcher(); seen = []; safeSave('seen', seen); } });
        const go = document.createElement('button'); go.className = 'du-btn'; go.textContent = 'Abrir mensagens apagadas';
        go.onclick = () => { const idx = tabs.findIndex(t => t.name === 'Apagadas 24h'); if (idx >= 0) { activeTab = idx; tabButtons.forEach((b,i) => b.classList.toggle('active', i === idx)); renderActiveTab(); } };
        body.appendChild(go);
        plain('p', lastError || 'Estado de voz: clique em cada botão para sincronizar com o gateway do Discord.', body).className = 'du-plus-help';
      }
      function renderDeleted(body) {
        body.replaceChildren(); prune();
        heading(body, 'Mensagens apagadas — últimas 24h', 'Exibe apenas mensagens recebidas enquanto o registro estava habilitado e que o Discord ainda não tinha apagado. Histórico apenas neste dispositivo.');
        const toolbar = document.createElement('div'); toolbar.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
        const refresh = document.createElement('button'); refresh.className = 'du-btn'; refresh.style.width = 'auto'; refresh.textContent = 'Atualizar'; refresh.onclick = () => renderDeleted(body);
        const clear = document.createElement('button'); clear.className = 'du-plus-danger'; clear.textContent = 'Limpar histórico';
        clear.onclick = () => { if (confirm('Apagar definitivamente o histórico local?')) { seen=[];deleted=[];safeSave('seen',seen);safeSave('deleted',deleted);renderDeleted(body); } };
        toolbar.append(refresh, clear); body.appendChild(toolbar);
        if (!options.saveDeleted) plain('p', 'Registro desativado. Ative em "Voz e privacidade" para capturar novas mensagens.', body).className = 'du-plus-help';
        if (!deleted.length) plain('p', 'Nenhuma mensagem apagada foi capturada nas últimas 24 horas.', body).className = 'du-plus-help';
        for (const entry of [...deleted].reverse()) {
          const item = document.createElement('div'); item.className = 'du-plus-message';
          plain('strong', entry.authorName || 'Autor desconhecido', item);
          const when = new Date(entry.deletedAt);
          const channel = `Canal ${entry.channelId}`;
          plain('small', `${channel} • apagada em ${when.toLocaleString('pt-BR')} • expira em ${new Date(entry.deletedAt + DAY).toLocaleString('pt-BR')}`, item);
          if (entry.content) plain('p', entry.content, item);
          if (entry.attachments?.length) plain('small', 'Anexos: ' + entry.attachments.join(', '), item);
          body.appendChild(item);
        }
      }
      function start() {
        if (mounted) return;
        mounted = true;
        injectPlusStyle();
        patchSocket();
        patchDispatcher();
        mountButtons();
        if (!listenersStarted) {
          listenersStarted = true;
          const observer = new MutationObserver(scheduleMount);
          observer.observe(document.body, { childList: true, subtree: true });
          // Handles voice gateway reconnects, as well as Discord renderer reloads.
          setInterval(() => {
            if (fakeMute || fakeVoice) {
              const oldSocket = sock;
              const oldHook = !!sock?.send?.__duPlusSend;
              if (patchSocket() && (oldSocket !== sock || !oldHook)) refreshVoiceOnServer();
            }
            if (options.saveDeleted) patchDispatcher();
            prune();
          }, 5000);
        }
        console.info(mark, 'carregado: Fake Mute (pequeno), Fake Voice (grande), apagadas 24h');
      }
      return { start, renderSettings, renderDeleted, status: () => ({ fakeMute, fakeVoice, options, lastError, deletedCount: deleted.length }), debugEvent: onDiscordEvent };
    })();

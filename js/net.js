/* ===== net.js : connexion au serveur (réveil Render, WebSocket, reconnexion, API REST) ===== */
(function () {
  const BR = window.BR;
  const DEFAULT_SERVER = 'wss://backrooms-relay-0w1a.onrender.com';
  const WAKE_MAX = 90000;        // un serveur Render gratuit endormi met 30 à 60 s à démarrer
  // l'ancien relais (sans comptes) répond en texte brut : il faut mettre à jour server.js sur Render
  const OUTDATED = "Le serveur Render n'est pas à jour (ancienne version sans comptes). Remplace server.js et package.json dans ton dépôt GitHub backrooms-relay par ceux du dossier jeu/server (voir LISEZ-MOI).";

  const N = (BR.Net = {
    url: '', httpBase: '', ws: null, id: null,
    status: 'off',               // off | waking | connecting | on
    online: 0, rooms: [], room: null, rtt: 0, lastError: '',
    ev: BR.Emitter(),
    DEFAULT_SERVER,
  });

  let connectPromise = null, wantOpen = false, retryDelay = 1000, retryTimer = null, pingTimer = null, everWelcomed = false;
  /* reprise de session : identifiant propre à cet onglet (gardé au rechargement de l'onglet, différent dans un autre onglet).
     Après une coupure, le serveur garde notre place ~25 s : on se reconnecte vite et on reprend la partie. */
  const GRACE_C = 22000;
  let lostTimer = null, pendingRoom = null;
  N.sid = (() => {
    let s = null; try { s = sessionStorage.getItem('br_sid'); } catch (e) {}
    if (!s || !/^[A-Za-z0-9]{8,40}$/.test(s)) { s = ''; const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; for (let i = 0; i < 24; i++) s += ch[Math.floor(Math.random() * ch.length)]; try { sessionStorage.setItem('br_sid', s); } catch (e) {} }
    return s;
  })();
  N.unstable = false;
  function giveUpRoom() { clearTimeout(lostTimer); lostTimer = null; if (!pendingRoom) return; pendingRoom = null; N.unstable = false; N.room = null; N.ev.emit('lost'); }

  // ---------- adresses ----------
  function normWs(u) {
    u = String(u || '').trim().replace(/\/+$/, '');
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) u = u.replace(/^http/i, 'ws');
    if (!/^wss?:\/\//i.test(u)) u = (/^(localhost|127\.|\[::1\]|192\.168\.|10\.)/.test(u) ? 'ws://' : 'wss://') + u;
    return u;
  }
  const toHttp = u => u.replace(/^ws/i, 'http');
  N.normalize = normWs;

  function fetchT(url, opts, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms || 8000);
    return fetch(url, Object.assign({ cache: 'no-store' }, opts || {}, ctl ? { signal: ctl.signal } : {})).finally(() => clearTimeout(t));
  }

  let resolved = null;
  // Choix du serveur : réglage manuel > même origine (si le jeu est servi par le serveur) > serveur Render par défaut
  N.resolve = async function (force) {
    if (resolved && !force) return resolved;
    const custom = BR.store.get('br_server', '');
    let url = normWs(custom);
    if (!url && /^https?:$/.test(location.protocol)) {
      try {
        const r = await fetchT(location.origin + '/health', {}, 2500);
        const j = r.ok ? await r.json() : null;
        if (j && j.ok && j.v) url = normWs(location.origin);
      } catch (e) { /* pas un serveur de jeu */ }
    }
    if (!url) url = DEFAULT_SERVER;
    N.url = url; N.httpBase = toHttp(url);
    resolved = url;
    return url;
  };
  N.setServer = function (u) {
    BR.store.set('br_server', u ? normWs(u) : '');
    resolved = null;
    if (N.status !== 'off') { N.close(); N.connect().catch(() => {}); }
  };

  function setStatus(s, info) {
    if (N.status === s && !info) return;
    N.status = s; N.ev.emit('status', s, info || '');
  }

  // ---------- réveil (GET /health jusqu'à réponse) ----------
  N.health = async function () {
    await N.resolve();
    const r = await fetchT(N.httpBase + '/health', {}, 9000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    try { const j = JSON.parse(txt); N.outdated = false; return j; }
    catch (e) { N.outdated = true; throw new Error(OUTDATED); }
  };
  N.wake = async function () {
    await N.resolve();
    const t0 = Date.now(); let tries = 0;
    for (;;) {
      try {
        const j = await N.health();
        if (j && j.ok) { N.online = j.online || 0; N.info = j; return j; }
      } catch (e) { N.lastError = String(e.message || e); if (N.outdated) throw e; }
      tries++;
      const el = Date.now() - t0;
      if (el > WAKE_MAX) throw new Error('Serveur injoignable');
      setStatus('waking', 'Réveil du serveur… (' + Math.round(el / 1000) + ' s)');
      N.ev.emit('wake', el);
      await BR.sleep(tries < 3 ? 1500 : 3000);
    }
  };

  // ---------- WebSocket ----------
  function openSocket(limit) {
    return new Promise((resolve, reject) => {
      if (N.status !== 'waking') setStatus('connecting');
      let ws, done = false;
      try { ws = new WebSocket(N.url); } catch (e) { reject(e); return; }
      N.ws = ws;
      const to = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch (e) {} reject(new Error('Délai dépassé')); } }, limit || 12000);
      ws.onopen = () => {
        const h = (BR.Account && BR.Account.helloData) ? BR.Account.helloData() : { name: 'Survivant' };
        ws.send(JSON.stringify(Object.assign({ t: 'hello', sid: N.sid }, h)));
      };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (!m || !m.t) return;
        if (m.t === 'welcome' && !done) {
          done = true; clearTimeout(to);
          N.id = m.id; N.online = m.online || 0; N.rooms = m.rooms || []; N.rk = m.rk || null;
          retryDelay = 1000; setStatus('on');
          startPing();
          const again = everWelcomed; everWelcomed = true;
          // reprise après coupure : même identifiant, même salon, la partie continue
          if (pendingRoom) { if (m.resumed) { clearTimeout(lostTimer); lostTimer = null; pendingRoom = null; N.unstable = false; N.ev.emit('resumed', m); } else giveUpRoom(); }
          N.ev.emit('welcome', m);
          if (again) N.ev.emit('reconnected', m);
          resolve(m);
          return;
        }
        handle(m);
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        clearTimeout(to); stopPing();
        if (N.ws === ws) N.ws = null;
        if (!done) { done = true; reject(new Error('Connexion refusée')); return; }
        // fermeture inattendue : dans un salon, on garde la place (N.room, N.id) le temps de se reconnecter
        const hadRoom = !!N.room;
        setStatus('off');
        if (hadRoom && !pendingRoom) {
          pendingRoom = N.room; N.unstable = true; retryDelay = 500;
          N.ev.emit('unstable');
          lostTimer = setTimeout(giveUpRoom, GRACE_C);
        } else if (!hadRoom) { N.room = null; N.id = null; }
        N.ev.emit('closed');
        if (wantOpen) scheduleRetry();
      };
    });
  }

  function handle(m) {
    switch (m.t) {
      case 'pong': if (typeof m.c === 'number') N.rtt = Math.round(performance.now() - m.c); if (m.online) N.online = m.online; N.ev.emit('pong', N.rtt); return;
      case 'rooms': N.rooms = m.list || []; if (m.online) N.online = m.online; break;
      case 'room': N.room = m.room; break;
      case 'kicked': N.room = null; break;
      case 'rk': N.rk = m; break;
    }
    N.ev.emit(m.t, m);
    N.ev.emit('msg', m);
  }

  function startPing() {
    stopPing();
    pingTimer = setInterval(() => N.send({ t: 'ping', c: performance.now() }), 15000);
    N.send({ t: 'ping', c: performance.now() });
  }
  function stopPing() { clearInterval(pingTimer); pingTimer = null; }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    const d = retryDelay; retryDelay = Math.min(pendingRoom ? 2000 : 15000, retryDelay * 2);   // en reprise : on réessaie vite
    N.ev.emit('retry', d);
    retryTimer = setTimeout(() => { if (wantOpen && N.status === 'off') N.connect().catch(() => {}); }, d);
  }

  // Connexion complète : résolution, réveil, socket, hello. Idempotente.
  N.connect = function () {
    wantOpen = true;
    if (N.status === 'on' && N.ws) return Promise.resolve();
    if (connectPromise) return connectPromise;
    clearTimeout(retryTimer);
    connectPromise = (async () => {
      try {
        await N.resolve();
        // WebSocket direct (le test HTTP /health peut être bloqué par un proxy alors que le WebSocket passe) :
        // on réessaie jusqu'à 90 s, le temps que le serveur gratuit se réveille.
        const t0 = Date.now();
        for (;;) {
          try { await openSocket(20000); break; }
          catch (e) {
            N.lastError = String(e.message || e);
            const el = Date.now() - t0;
            if (el > WAKE_MAX) throw new Error('Serveur injoignable (' + N.lastError + ')');
            setStatus('waking', 'Réveil du serveur… (' + Math.round(el / 1000) + ' s)');
            N.ev.emit('wake', el);
            await BR.sleep(1500);
          }
        }
        N.lastError = '';
      } catch (e) {
        N.lastError = String(e.message || e);
        setStatus('off', N.lastError);
        if (wantOpen) scheduleRetry();
        throw e;
      } finally { connectPromise = null; }
    })();
    return connectPromise;
  };

  N.close = function () {
    wantOpen = false; clearTimeout(retryTimer); stopPing();
    clearTimeout(lostTimer); lostTimer = null; pendingRoom = null; N.unstable = false;
    const ws = N.ws; N.ws = null; N.room = null; N.id = null; everWelcomed = false;
    if (ws) { ws.onclose = null; try { ws.close(); } catch (e) {} }
    setStatus('off');
  };

  N.send = function (o) {
    const ws = N.ws;
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(JSON.stringify(o)); return true; } catch (e) { return false; }
  };
  N.on = (t, f) => N.ev.on(t, f);
  N.isHost = () => !!(N.room && N.room.host === N.id);

  // ---------- raccourcis salon ----------
  N.list = () => N.send({ t: 'list' });
  N.create = o => N.send(Object.assign({ t: 'create' }, o));
  N.join = code => N.send({ t: 'join', code });
  N.quick = () => N.send({ t: 'quick' });
  N.rquick = () => N.send({ t: 'rquick' });
  N.leave = () => { N.room = null; N.send({ t: 'leave' }); };
  N.relay = (d, to) => N.send({ t: 'r', to: to === undefined ? '*' : to, d });
  N.chat = (m, q) => N.send({ t: 'chat', m, q: q ? 1 : 0 });

  // ---------- API REST (comptes, classement) ----------
  // même API passée par le WebSocket : sert de secours quand le proxy du réseau bloque les requêtes HTTPS du jeu
  let apiSeq = 0;
  function wsApi(path, body, token, ms) {
    return new Promise(async (resolve, reject) => {
      try { await N.connect(); } catch (e) { reject(e); return; }
      const q = ++apiSeq;
      const to = setTimeout(() => { off(); reject(new Error('Délai dépassé')); }, ms || 30000);
      const off = N.ev.on('apir', m => {
        if (m.q !== q) return;
        clearTimeout(to); off();
        const o = m.o || {};
        if (m.c >= 400) { const e = new Error(o.error || ('Erreur serveur (' + m.c + ')')); e.status = m.c; reject(e); }
        else resolve(o);
      });
      if (!N.send({ t: 'api', q, path, body: body || null, token: token || null })) { clearTimeout(to); off(); reject(new Error('Pas connecté')); }
    });
  }
  N.api = async function (path, opts) {
    opts = opts || {};
    await N.resolve();
    if (N.httpBlocked) {
      try { return await wsApi(path, opts.body, opts.token, opts.timeout); }
      catch (e) { if (e.status) throw e; const e2 = new Error('Serveur injoignable. Vérifie ta connexion internet.'); e2.status = 0; throw e2; }
    }
    if (N.outdated === undefined) { try { await N.health(); } catch (e) {} }
    if (N.outdated) { const e = new Error(OUTDATED); e.status = 0; throw e; }
    const headers = { 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    let lastErr;
    for (let attempt = 0; attempt < (opts.retries || 2); attempt++) {
      try {
        const r = await fetchT(N.httpBase + path, { method: opts.body ? 'POST' : 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined }, opts.timeout || 70000);
        let j = null; try { j = await r.json(); } catch (e) {}
        if (!r.ok) {
          // 502/503 = serveur Render en train de démarrer : on réessaie
          if ((r.status === 502 || r.status === 503 && !(j && j.error)) && attempt + 1 < (opts.retries || 2)) { await BR.sleep(4000); continue; }
          const e = new Error((j && j.error) || ('Erreur serveur (' + r.status + ')')); e.status = r.status; throw e;
        }
        return j || {};
      } catch (e) {
        lastErr = e;
        if (e.status) throw e;                   // vraie réponse d'erreur du serveur : inutile de réessayer
        if (e.name === 'TypeError') break;       // requête refusée par le navigateur/proxy : on passe tout de suite au WebSocket
        if (attempt + 1 < (opts.retries || 2)) await BR.sleep(2500);
      }
    }
    // HTTPS impossible (proxy, filtrage) : on retente par le WebSocket, et on s'en souvient pour la suite
    try { const r = await wsApi(path, opts.body, opts.token, opts.timeout); N.httpBlocked = true; return r; }
    catch (e2) { if (e2.status) throw e2; }
    const e = new Error('Serveur injoignable. Vérifie ta connexion internet.'); e.status = 0; e.cause = lastErr; throw e;
  };
  // diagnostic lisible (affiché dans l'écran multijoueur)
  N.diagnose = async function () {
    await N.resolve();
    const out = { url: N.url, http: null, ws: null };
    const t0 = performance.now();
    try { const r = await fetchT(N.httpBase + '/health', {}, 15000); out.http = r.ok ? 'ok (' + Math.round(performance.now() - t0) + ' ms)' : 'HTTP ' + r.status; }
    catch (e) { out.http = 'bloqué (' + (e.name === 'AbortError' ? 'délai' : e.message) + ')'; }
    out.ws = N.status === 'on' ? 'ok' : (N.lastError || N.status);
    return out;
  };
})();

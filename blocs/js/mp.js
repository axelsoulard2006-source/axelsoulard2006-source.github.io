/* ===== mp.js : multijoueur entre potes (module branché par les hooks)
   Utilise le serveur du site (salons + relais). L'hôte partage son monde (graine + modifications) ;
   chaque bloc cassé / posé est relayé à tous ; on voit les autres joueurs. L'invité ne sauvegarde jamais par-dessus son monde. ===== */
(function () {
  const VX = window.VX, G = VX.G, H = VX.hooks;
  const SERVER = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host : 'wss://backrooms-relay-0w1a.onrender.com';
  const MP = VX.MP = { ws: null, id: null, room: null, host: false, peers: new Map(), on: false, status: '' };
  const token = () => { try { const v = localStorage.getItem('br_token'); return v ? (v[0] === '"' ? JSON.parse(v) : v) : undefined; } catch (e) { return undefined; } };
  const pname = () => { try { const p = JSON.parse(localStorage.getItem('br_profile') || '{}'); return (p && p.name) || 'Bâtisseur'; } catch (e) { return 'Bâtisseur'; } };
  const send = m => { if (MP.ws && MP.ws.readyState === 1) MP.ws.send(JSON.stringify(m)); };
  const relay = (d, to) => send({ t: 'r', to: to || '*', d });
  function connect() {
    return new Promise((res, rej) => {
      if (MP.ws && MP.ws.readyState === 1) return res();
      MP.status = 'Connexion au serveur… (jusqu\'à 1 min s\'il dort)'; VX.UI.toast(MP.status);
      const ws = MP.ws = new WebSocket(SERVER); const to = setTimeout(() => rej(new Error('Serveur injoignable')), 90000);
      ws.onopen = () => send({ t: 'hello', sid: 'blocs' + Math.random().toString(36).slice(2, 12), name: pname(), look: null, level: 1, token: token() });
      ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'welcome') { clearTimeout(to); MP.id = m.id; res(); } handle(m); };
      ws.onclose = () => { if (MP.on) { VX.UI.toast('Connexion perdue avec le salon.'); leave(true); } };
      ws.onerror = () => { clearTimeout(to); rej(new Error('Serveur injoignable')); };
    });
  }
  function handle(m) {
    if (m.t === 'room') { MP.room = m.room; MP.host = m.room.host === MP.id; MP.on = true; for (const id of [...MP.peers.keys()]) if (!m.room.players.some(p => p.id === id)) dropPeer(id); }
    else if (m.t === 'error') VX.UI.toast(m.msg || 'Erreur');
    else if (m.t === 'left') dropPeer(m.id);
    else if (m.t === 'r') onRelay(m.f, m.d || {});
  }
  function onRelay(from, d) {
    if (d.k === 'need' && MP.host) { G.save(true); relay({ k: 'world', seed: G.seed, mods: G.mods, time: G.time, spawn: G.spawn }, from); return; }
    if (d.k === 'world' && !MP.host) { enterGuest(d); return; }
    if (d.k === 'set') { MP.remote = true; try { const w = G.world; if (d.dim === G.dim) w.set(d.x, d.y, d.z, d.id); else { const cx = Math.floor(d.x / 16), cz = Math.floor(d.z / 16), mods = G.mods[d.dim] = G.mods[d.dim] || {}; (mods[cx + ',' + cz] = mods[cx + ',' + cz] || {})[(d.x - cx * 16) + (d.z - cz * 16) * 16 + d.y * 256] = d.id; } } finally { MP.remote = false; } return; }
    if (d.k === 'p') { let p = MP.peers.get(from); if (!p) p = addPeer(from, d.n); p.t = [d.x, d.y, d.z, d.yaw]; p.dim = d.dim; return; }
    if (d.k === 'time' && !MP.host) G.time = d.time;
  }
  // l'invité joue dans le monde de l'hôte (sans jamais écraser sa propre sauvegarde)
  function enterGuest(d) {
    G.guest = true; G.seed = d.seed; G.mods = d.mods || { surface: {}, braises: {} }; G.time = d.time || 0.3; G.spawn = d.spawn || G.spawn; G.furnaces = {}; G.links = {};
    VX.G._dbg.useWorld('surface'); const s = G.spawn; G.player.pos.set(s.x, s.y + 0.5, s.z); G.player.vel.set(0, 0, 0); G.world.preload(s.x, s.z, 1);
    VX.UI.toast('Tu as rejoint le monde de ' + ((MP.room.players.find(p => p.id === MP.room.host) || {}).name || 'ton pote') + ' !'); VX.UI.menu(null);
  }
  /* ---------- les autres joueurs ---------- */
  function addPeer(id, name) {
    const col = new THREE.Color().setHSL((id.charCodeAt(0) * 37 % 360) / 360, 0.6, 0.55), g = new THREE.Group();
    const part = (w, h, d, c, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c })); m.position.y = y; g.add(m); return m; };
    part(0.6, 0.75, 0.35, col, 1.05); part(0.5, 0.5, 0.5, '#f0c8a0', 1.68); part(0.24, 0.7, 0.3, '#3a3a6a', 0.35).position.x = 0.15; part(0.24, 0.7, 0.3, '#3a3a6a', 0.35).position.x = -0.15;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c2 = cv.getContext('2d'); c2.fillStyle = 'rgba(0,0,0,.5)'; c2.fillRect(0, 8, 256, 48); c2.font = 'bold 34px monospace'; c2.textAlign = 'center'; c2.fillStyle = '#fff'; c2.fillText(String(name || '?').slice(0, 14), 128, 44);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false })); sp.scale.set(1.6, 0.4, 1); sp.position.y = 2.3; g.add(sp);
    G.scene.add(g); const p = { id, g, t: null, dim: null }; MP.peers.set(id, p); return p;
  }
  function dropPeer(id) { const p = MP.peers.get(id); if (!p) return; G.scene.remove(p.g); MP.peers.delete(id); }
  /* ---------- actions ---------- */
  async function hostGame() {
    try { await connect(); } catch (e) { VX.UI.toast(e.message); return; }
    send({ t: 'create', name: 'Blocaria de ' + pname(), map: 'b_blocs', max: 8, priv: true });
    const t0 = Date.now(); while (!MP.room && Date.now() - t0 < 5000) await new Promise(r => setTimeout(r, 100));
    if (MP.room) { VX.UI.toast('Salon ouvert ! Code : ' + MP.room.code + ' (donne-le à tes potes)'); VX.UI.menu('pause'); }
  }
  async function joinGame() {
    const code = (prompt('Code du salon de ton pote :', '') || '').trim().toUpperCase(); if (!code) return;
    try { await connect(); } catch (e) { VX.UI.toast(e.message); return; }
    send({ t: 'join', code }); const t0 = Date.now(); while (!MP.room && Date.now() - t0 < 6000) await new Promise(r => setTimeout(r, 100));
    if (!MP.room) { VX.UI.toast('Salon introuvable.'); return; }
    relay({ k: 'need' }, MP.room.host);
  }
  function leave(silent) { MP.on = false; MP.room = null; for (const id of [...MP.peers.keys()]) dropPeer(id); try { send({ t: 'leave' }); MP.ws && MP.ws.close(); } catch (e) {} MP.ws = null; if (G.guest) { G.guest = false; location.reload(); } else if (!silent) VX.UI.toast('Tu as quitté le salon.'); }
  MP.host_ = hostGame; MP.join = joinGame; MP.leave = leave;
  /* ---------- relais des modifications et des positions ---------- */
  H.on('worldSet', e => { if (MP.on && !MP.remote) relay({ k: 'set', dim: e.dim, x: e.x, y: e.y, z: e.z, id: e.id }); });
  let posT = 0, timeT = 0;
  H.on('playerTick', ({ dt, player: P }) => {
    if (!MP.on) return;
    if ((posT -= dt) <= 0) { posT = 0.1; const r = v => Math.round(v * 100) / 100; relay({ k: 'p', n: pname(), x: r(P.pos.x), y: r(P.pos.y), z: r(P.pos.z), yaw: r(P.yaw), dim: G.dim }); }
    if (MP.host && (timeT -= dt) <= 0) { timeT = 10; relay({ k: 'time', time: G.time }); }
    for (const p of MP.peers.values()) { if (!p.t) continue; p.g.visible = p.dim === G.dim; const k = Math.min(1, dt * 12); p.g.position.x += (p.t[0] - p.g.position.x) * k; p.g.position.y += (p.t[1] - p.g.position.y) * k; p.g.position.z += (p.t[2] - p.g.position.z) * k; p.g.rotation.y = p.t[3]; }
  });
})();

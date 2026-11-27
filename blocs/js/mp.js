/* ===== mp.js : multijoueur entre potes (module branché par les hooks)
   Passe par le serveur du site (salons privés par code + relais { t:'r', to, d }). L'HÔTE FAIT AUTORITÉ :
   - monde envoyé à l'arrivée (graine, modifications, coffres, fours, liens de portails, météo, mods), découpé en morceaux ;
   - blocs cassés / posés relayés à tous ; coffres et fours synchronisés (un invité envoie à l'hôte, qui rediffuse) ;
   - heure, météo et pousse du blé décidées par l'hôte (les invités ne font que recevoir) ;
   - créatures simulées par l'hôte autour de tous les joueurs de sa dimension, diffusées 10 fois par seconde (mobs.js) ;
   - chat partagé (touche T), liste des joueurs (Tab), arrivées / départs, JcJ (désactivé par défaut, choix de l'hôte) ;
   - les autres joueurs : modèle cubique animé (bras, jambes, tête), objet tenu, armure, nom au-dessus ;
   - robustesse : reprise automatique après une coupure (même place dans le salon), l'hôte qui part renvoie chacun chez soi.
   Un invité ne sauvegarde jamais par-dessus son propre monde.
   Messages relayés (champ k) : need, wpart, set, p, look, chat, cont, env, cfg, mobs, hit, mdrop, mfx, hurt, pvp, bye. ===== */
(function () {
  const VX = window.VX, G = VX.G, H = VX.hooks, UI = VX.UI, B = VX.B, D = VX.BLOCKS;
  const SERVER = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname) ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host : 'wss://backrooms-relay-0w1a.onrender.com';
  const MP = VX.MP = { ws: null, id: null, room: null, host: false, peers: new Map(), on: false, status: '', pvp: false, hostId: null, hostDim: 'surface', code: null, joined: false };
  const COFFRE = () => (B.COFFRE != null ? B.COFFRE : 40);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const token = () => { try { const v = localStorage.getItem('br_token'); return v ? (v[0] === '"' ? JSON.parse(v) : v) : undefined; } catch (e) { return undefined; } };
  // nom : celui de l'onglet (sessionStorage, utile pour tester à deux onglets) ou du profil du site
  const pname = () => { try { const s = sessionStorage.getItem('blocaria_pname'); if (s) return s; const p = JSON.parse(localStorage.getItem('br_profile') || '{}'); return (p && p.name) || 'Bâtisseur'; } catch (e) { return 'Bâtisseur'; } };
  G.pname = pname;
  // identifiant stable de l'onglet : permet au serveur de nous rendre notre place après une coupure
  const sid = (() => { try { let s = sessionStorage.getItem('blocaria_sid'); if (!s) { s = 'blocs' + Math.random().toString(36).slice(2, 14); sessionStorage.setItem('blocaria_sid', s); } return s; } catch (e) { return 'blocs' + Math.random().toString(36).slice(2, 14); } })();
  const send = m => { if (MP.ws && MP.ws.readyState === 1) MP.ws.send(JSON.stringify(m)); };
  const relay = (d, to) => send({ t: 'r', to: to || '*', d });
  const say = (t, k) => UI.say(t, k || 'ok');
  const nameOf = id => ((MP.room && MP.room.players.find(p => p.id === id)) || MP.peers.get(id) || {}).name || '?';
  const style = document.createElement('style');
  style.textContent = '.chatlog p.mp{color:#bfe6ff}.chatlog p.sys{color:#c8c0b0;font-style:italic}'
    + '.mptab{position:fixed;left:50%;top:12%;transform:translateX(-50%);min-width:320px;max-width:92vw;background:rgba(16,10,6,.82);border:3px solid #1a0e06;box-shadow:inset 2px 2px 0 rgba(255,255,255,.12);color:#f4e6c8;font:14px monospace;padding:8px 12px;z-index:40;display:none;pointer-events:none}'
    + '.mptab h3{margin:0 0 6px;text-align:center;color:#ffd23a;font-size:15px}.mptab div{display:flex;justify-content:space-between;gap:16px;padding:2px 0;border-top:1px solid rgba(255,255,255,.08)}.mptab i{opacity:.7;font-style:normal}';
  document.head.appendChild(style);

  /* =====================================================================
     1. CONNEXION (reprise automatique après une coupure)
     ===================================================================== */
  function connect() {
    return new Promise((res, rej) => {
      if (MP.ws && MP.ws.readyState === 1) return res();
      MP.status = 'Connexion au serveur… (jusqu\'à 1 min s\'il dort)'; if (!MP.reco) UI.toast(MP.status);
      const ws = MP.ws = new WebSocket(SERVER); let done = false;
      const to = setTimeout(() => { if (!done) { done = true; rej(new Error('Serveur injoignable')); } }, MP.reco ? 8000 : 90000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', sid, name: pname(), look: null, level: 1, token: token() }));
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'welcome') {
          MP.id = m.id; MP.resumed = !!m.resumed;
          // place gardée d'une page précédente (rechargement) alors qu'on n'est dans aucun salon : on la libère
          if (m.resumed && !MP.on) { MP.stale = true; ws.send(JSON.stringify({ t: 'leave' })); }
          if (!done) { done = true; clearTimeout(to); res(); }
          return;
        }
        handle(m);
      };
      ws.onclose = () => { if (MP.ws !== ws) return; MP.ws = null; if (!done) { done = true; clearTimeout(to); rej(new Error('Serveur injoignable')); } if (MP.on && !MP.leaving) reconnect(); };
      ws.onerror = () => {};
    });
  }
  async function reconnect() {
    if (MP.reco) return; MP.reco = true;
    say('Connexion perdue avec le salon… reconnexion.', 'err'); UI.toast('Connexion perdue… reconnexion');
    const t0 = Date.now();
    while (MP.on && !MP.leaving && Date.now() - t0 < 70000) {
      try { await connect(); } catch (e) { await sleep(2000); continue; }
      if (MP.resumed) {   // le serveur nous a gardé notre place : on redemande l'état (blocs changés pendant la coupure)
        MP.reco = false; say('Reconnecté au salon.', 'ok');
        if (!MP.host) relay({ k: 'need', re: 1, addons: addons() }, MP.hostId);
        return;
      }
      if (MP.host) { MP.reco = false; say('Le salon a été fermé pendant la coupure.', 'err'); leave(true); return; }
      // place perdue : on rejoint le salon par son code, l'hôte doit être le même
      MP.room = null; MP.expect = MP.code; send({ t: 'join', code: MP.code });
      const t1 = Date.now(); while (!MP.room && Date.now() - t1 < 6000) await sleep(100);
      MP.reco = false;
      if (MP.room && MP.room.host === MP.hostId) { say('De retour dans le salon.', 'ok'); relay({ k: 'need', re: 1, addons: addons() }, MP.hostId); }
      else hostGone('Le salon de l\'hôte n\'existe plus.');
      return;
    }
    MP.reco = false; if (MP.on) { say('Impossible de se reconnecter.', 'err'); if (MP.joined) hostGone('Connexion impossible.'); else leave(true); }
  }

  /* =====================================================================
     2. MESSAGES DU SERVEUR
     ===================================================================== */
  function handle(m) {
    if (m.t === 'room') {
      if (MP.stale) { MP.stale = false; return; }   // salon d'une page précédente (déjà quitté)
      if (MP.expect && !(MP.expect === '*host' ? m.room.host === MP.id : m.room.code === MP.expect)) return;
      MP.expect = null;
      const prev = MP.room; MP.room = m.room; MP.on = true;
      if (!MP.hostId) MP.hostId = m.room.host;
      MP.host = m.room.host === MP.id;
      // l'hôte d'un monde Blocaria ne se remplace pas : s'il part, tout le monde rentre chez soi
      if (MP.joined && m.room.host !== MP.hostId) { hostGone('L\'hôte a quitté la partie.'); return; }
      if (prev) {
        for (const p of m.room.players) if (p.id !== MP.id && !prev.players.some(q => q.id === p.id)) { UI.toast(p.name + ' a rejoint la partie'); say(p.name + ' a rejoint la partie.', 'sys'); if (MP.host) relay({ k: 'cfg', pvp: MP.pvp }, p.id); }
        for (const p of prev.players) if (!m.room.players.some(q => q.id === p.id)) { UI.toast(p.name + ' a quitté la partie'); say(p.name + ' a quitté la partie.', 'sys'); dropPeer(p.id); }
      }
      for (const id of [...MP.peers.keys()]) if (!m.room.players.some(p => p.id === id)) dropPeer(id);
    }
    else if (m.t === 'error') UI.toast(m.msg || 'Erreur');
    else if (m.t === 'left') { dropPeer(m.id); if (m.id === MP.hostId && !MP.host && MP.joined) hostGone('L\'hôte a quitté la partie.'); }
    else if (m.t === 'sys') { if (!/a rejoint le salon/.test(m.m || '')) say('• ' + m.m, 'sys'); }
    else if (m.t === 'kicked') { UI.toast(m.msg || 'Exclu du salon'); leave(true); }
    else if (m.t === 'r') { try { onRelay(m.f, m.d || {}); } catch (e) { console.error('[MP] message', m.d && m.d.k, e); } }
  }
  function hostGone(msg) {
    if (MP.gone) return; MP.gone = true;
    UI.toast(msg + ' Retour à ton monde…'); say(msg + ' Retour à ton monde dans 3 s.', 'err');
    setTimeout(() => leave(true), 3000);
  }

  /* =====================================================================
     3. MESSAGES DES JOUEURS
     ===================================================================== */
  const parts = {};   // morceaux du monde en cours de réception
  function onRelay(from, d) {
    const fromHost = from === MP.hostId;
    switch (d.k) {
      case 'need': if (MP.host) { sendWorld(from, !!d.re); checkAddonsOf(from, d.addons); } return;
      case 'wpart': {
        if (!fromHost) return;
        const P = parts[d.id] = parts[d.id] || { n: d.n, got: 0, s: [] };
        if (P.s[d.i] == null) { P.s[d.i] = d.s; P.got++; }
        if (P.got === P.n) { delete parts[d.id]; let w; try { w = JSON.parse(P.s.join('')); } catch (e) { UI.toast('Monde reçu illisible.'); return; } enterGuest(w); }
        else if (!MP.joined) MP.status = 'Réception du monde… ' + Math.round(P.got / P.n * 100) + ' %';
        return;
      }
      case 'set': applySet(d); return;
      case 'p': {
        const p = peerOf(from, d.n); p.t = [d.x, d.y, d.z, d.yaw, d.pi || 0]; p.dim = d.dim; p.sneak = !!d.s; p.vis = !!d.v; p.seen = performance.now();
        if (d.w !== p.swingN) { if (p.swingN != null) p.swingT = 1; p.swingN = d.w; }
        if (fromHost) MP.hostDim = d.dim;
        return;
      }
      case 'look': { const p = peerOf(from, d.n); p.lookIn = d; return; }
      case 'chat': UI.say('<' + String(d.n || nameOf(from)).slice(0, 16) + '> ' + String(d.m || '').slice(0, 240), 'mp'); return;
      case 'cont': applyCont(d); if (MP.host && !fromHost) forward(d, from); return;
      case 'env':
        if (!fromHost || MP.host) return;
        if (typeof d.time === 'number') G.time = d.time;
        if (d.w && VX.Weather) VX.Weather.load(Object.assign({}, d.w, { t: 1e6 }));   // l'invité ne change jamais le temps lui-même
        if (d.dim) MP.hostDim = d.dim;
        return;
      case 'cfg': if (fromHost) { const was = MP.pvp; MP.pvp = !!d.pvp; if (was !== MP.pvp && MP.joined) say('JcJ ' + (MP.pvp ? 'activé' : 'désactivé') + ' par l\'hôte.', 'sys'); } return;
      case 'mobs': if (fromHost && !MP.host && VX.Mobs && VX.Mobs.applySnapshot) VX.Mobs.applySnapshot(d); return;
      case 'mfx': if (fromHost && !MP.host && VX.Mobs && VX.Mobs.remoteFx) VX.Mobs.remoteFx(d); return;
      case 'mdrop': if (fromHost && VX.Mobs && VX.Mobs.remoteDrop) VX.Mobs.remoteDrop(d); return;
      case 'hit': if (MP.host && VX.Mobs && VX.Mobs.remoteHit) VX.Mobs.remoteHit(from, d); return;
      case 'hurt': if (fromHost) hurtMe(d.n, d.kind || 'mob', d.sx != null ? { x: d.sx, z: d.sz } : null, d.kb); return;
      case 'pvp': if (MP.pvp) hurtMe(d.n, 'mob', { x: d.sx, z: d.sz }, [d.kx, 3.5, d.kz]); return;
      case 'bye': if (fromHost && !MP.host) hostGone('L\'hôte a fermé le salon.'); return;
    }
  }
  // dégâts reçus d'une créature de l'hôte ou d'un joueur (l'armure et le bouclier comptent, comme en solo)
  function hurtMe(n, kind, src, kb) {
    const P = G.player, hit = G.hurt(+n || 0, kind, src);
    if (kb && hit !== false) { P.vel.x += +kb[0] || 0; P.vel.z += +kb[2] || 0; P.vel.y = Math.max(P.vel.y, +kb[1] || 0); }
    else if (kb && G.blocking) { P.vel.x += (+kb[0] || 0) * 0.4; P.vel.z += (+kb[2] || 0) * 0.4; }
  }
  function forward(d, except) { if (!MP.room) return; for (const p of MP.room.players) if (p.id !== MP.id && p.id !== except) relay(d, p.id); }

  /* ---------- blocs ---------- */
  function applySet(d) {
    const k = d.dim + ':' + d.x + ',' + d.y + ',' + d.z;
    // un conteneur cassé ailleurs : celui qui l'a cassé a répandu son contenu, on oublie notre copie
    if (d.id !== COFFRE() && G.chests[k]) { if (UI.open && (UI.open.chest === G.chests[k] || (UI.open.halves || []).includes(G.chests[k]))) UI.closeInv(); delete G.chests[k]; }
    if (d.id !== B.FOUR && G.furnaces[k]) { if (UI.open && UI.open.furnace === G.furnaces[k]) UI.closeInv(); delete G.furnaces[k]; }
    MP.remote = true;
    try {
      if (d.dim === G.dim) G.world.set(d.x, d.y, d.z, d.id);
      else { const cx = Math.floor(d.x / 16), cz = Math.floor(d.z / 16), mods = G.mods[d.dim] = G.mods[d.dim] || {}; (mods[cx + ',' + cz] = mods[cx + ',' + cz] || {})[(d.x - cx * 16) + (d.z - cz * 16) * 16 + d.y * 256] = d.id; }
    } finally { MP.remote = false; }
  }
  H.on('worldSet', e => { if (MP.on && !MP.remote) relay({ k: 'set', dim: e.dim, x: e.x, y: e.y, z: e.z, id: e.id }); });

  /* =====================================================================
     4. LE MONDE DE L'HÔTE (envoi découpé, entrée de l'invité, mods)
     ===================================================================== */
  const addons = () => (VX.Mods && VX.Mods.summary ? VX.Mods.summary() : []);
  function sendWorld(to, re) {
    const w = { seed: G.seed, mods: G.mods, time: G.time, spawn: G.spawn, chests: G.chests, furnaces: G.furnaces, links: G.links, weather: VX.Weather ? VX.Weather.save() : null, pvp: MP.pvp, dim: G.dim, addons: addons(), re: !!re };
    const s = JSON.stringify(w), SZ = 90000, n = Math.max(1, Math.ceil(s.length / SZ)), id = Math.random().toString(36).slice(2, 8);
    // morceaux espacés : le serveur limite la taille d'un message (256 Ko) et le débit
    for (let i = 0; i < n; i++) setTimeout(() => relay({ k: 'wpart', id, i, n, s: s.slice(i * SZ, (i + 1) * SZ) }, to), i * 60);
    relay({ k: 'cfg', pvp: MP.pvp }, to);
  }
  // l'invité joue dans le monde de l'hôte (sans jamais écraser sa propre sauvegarde)
  function enterGuest(d) {
    const first = !MP.joined;
    G.guest = true; MP.joined = true; MP.gone = false;
    G.seed = d.seed; G.mods = d.mods || { surface: {}, braises: {} }; G.time = d.time || 0.3; G.spawn = d.spawn || G.spawn; G.links = d.links || {};
    if (first) { for (const it of G.items) G.scene.remove(it.obj); G.items.length = 0; }
    const dim = first ? 'surface' : G.dim;
    G._dbg.useWorld(dim);   // recharge les chunks depuis les modifications reçues
    G.chests = d.chests || {}; G.furnaces = d.furnaces || {}; cwatch.clear();
    if (d.weather && VX.Weather) VX.Weather.load(Object.assign({}, d.weather, { t: 1e6 }));
    MP.pvp = !!d.pvp; MP.hostDim = d.dim || 'surface';
    const P = G.player;
    if (first) { const s = G.spawn; P.pos.set(s.x, s.y + 0.5, s.z); P.vel.set(0, 0, 0); P.fallTop = null; }
    G.world.preload(P.pos.x, P.pos.z, 1);
    if (UI.open) UI.closeInv();
    if (first) { UI.toast('Tu as rejoint le monde de ' + nameOf(MP.hostId) + ' !'); say('Bienvenue dans le monde de ' + nameOf(MP.hostId) + '. T : chat · Tab : joueurs.', 'ok'); UI.menu(null); }
    else say('Monde resynchronisé avec l\'hôte.', 'sys');
    checkAddons(d.addons || []);
  }
  // mods : l'hôte transmet sa liste ; un invité à qui il en manque est prévenu clairement
  function checkAddons(list) {
    const mine = addons(), has = id => mine.find(m => m.id === id);
    const miss = list.filter(a => !has(a.id)), ver = list.filter(a => has(a.id) && has(a.id).version !== a.version), extra = mine.filter(m => !list.some(a => a.id === m.id));
    if (miss.length) {
      const t = 'L\'hôte utilise des mods que tu n\'as pas activés : ' + miss.map(a => a.nom + ' (' + a.id + ' ' + a.version + ')').join(', ') + '. Leurs blocs s\'affichent en « bloc de mod inconnu ». Active-les dans le menu Mods, recharge la page, puis rejoins à nouveau.';
      say(t, 'err'); UI.toast('Il te manque ' + miss.length + ' mod(s) de l\'hôte : voir le chat');
    }
    if (ver.length) say('Versions de mods différentes de celles de l\'hôte : ' + ver.map(a => a.nom + ' (hôte ' + a.version + ', toi ' + has(a.id).version + ')').join(', ') + '.', 'err');
    if (extra.length) say('Tes mods que l\'hôte n\'a pas (ils restent chez toi) : ' + extra.map(a => a.nom).join(', ') + '.', 'sys');
  }
  function checkAddonsOf(from, list) {
    if (!Array.isArray(list)) return; const theirs = id => list.some(a => a.id === id), miss = addons().filter(a => !theirs(a.id));
    if (miss.length) say(nameOf(from) + ' n\'a pas activé tes mods : ' + miss.map(a => a.nom).join(', ') + ' (il est prévenu).', 'sys');
  }

  /* =====================================================================
     5. COFFRES ET FOURS (l'hôte fait autorité)
     ===================================================================== */
  const cwatch = new Map();   // clé -> signature du contenu au dernier envoi / à la dernière réception
  const furnData = f => ({ in: f.in, fuel: f.fuel, out: f.out, burn: Math.round(f.burn * 10) / 10, burnMax: f.burnMax, prog: Math.round(f.prog * 100) / 100 });
  const sigOf = (c, v) => c === 'k' ? JSON.stringify(v) : JSON.stringify([v.in, v.fuel, v.out]);
  const keyOf = (obj, store) => { for (const k in store) if (store[k] === obj) return k; return null; };
  function openContainers() {
    const o = UI.open; if (!o) return [];
    if (o.kind === 'coffre') return (o.halves || [o.chest]).map(h => ['k', keyOf(h, G.chests), h]).filter(x => x[1]);
    if (o.kind === 'four' && o.furnace) { const k = keyOf(o.furnace, G.furnaces); return k ? [['f', k, o.furnace]] : []; }
    return [];
  }
  function sendCont(c, key, obj) {
    const d = { k: 'cont', c, key, v: obj ? (c === 'k' ? obj : furnData(obj)) : null };
    if (MP.host) relay(d); else relay(d, MP.hostId);
  }
  function applyCont(d) {
    if (typeof d.key !== 'string') return;
    const store = d.c === 'k' ? G.chests : G.furnaces, cur = store[d.key];
    if (d.v == null) { if (cur && UI.open && (UI.open.chest === cur || UI.open.furnace === cur || (UI.open.halves || []).includes(cur))) UI.closeInv(); delete store[d.key]; cwatch.delete(d.key); return; }
    if (d.c === 'k') { if (cur) { for (let i = 0; i < 27; i++) cur[i] = d.v[i] || null; } else store[d.key] = Array.from({ length: 27 }, (_, i) => d.v[i] || null); }
    else if (cur) Object.assign(cur, d.v); else store[d.key] = Object.assign({ in: null, fuel: null, out: null, burn: 0, burnMax: 0, prog: 0 }, d.v);
    cwatch.set(d.key, sigOf(d.c, store[d.key]));   // pas de renvoi en écho
    if (UI.open && UI.open.kind !== 'inv') UI.refresh();
  }
  let contT = 0, furnT = 0; const furnLast = {};
  function containersTick(dt) {
    if ((contT -= dt) > 0) return; contT = 0.15;
    const open = openContainers(), seen = new Set();
    for (const [c, key, obj] of open) {
      seen.add(key); const s = sigOf(c, obj);
      if (!cwatch.has(key)) { cwatch.set(key, s); continue; }   // premier coup d'œil : rien n'a encore changé
      if (cwatch.get(key) !== s) { cwatch.set(key, s); sendCont(c, key, obj); }
    }
    // l'hôte diffuse l'état des fours qui travaillent (deux fois par seconde)
    if (MP.host && (furnT -= 0.15) <= 0) {
      furnT = 0.5;
      for (const k in G.furnaces) { const v = furnData(G.furnaces[k]), s = JSON.stringify(v); if (furnLast[k] !== s) { furnLast[k] = s; relay({ k: 'cont', c: 'f', key: k, v }); cwatch.set(k, sigOf('f', v)); } }
    }
  }

  /* =====================================================================
     6. LES AUTRES JOUEURS : modèle cubique animé, objet tenu, armure, nom
     ===================================================================== */
  const PM = {}, PMATS = [], GEO = {};
  const pmat = c => { const k = String(c); if (PM[k]) return PM[k]; const m = new THREE.MeshBasicMaterial({ color: c }); m.userData.base = new THREE.Color(c); PMATS.push(m); return (PM[k] = m); };
  const pgeo = (w, h, d) => GEO[w + ',' + h + ',' + d] || (GEO[w + ',' + h + ',' + d] = new THREE.BoxGeometry(w, h, d));
  const box = (parent, w, h, d, c, x, y, z) => { const m = new THREE.Mesh(pgeo(w, h, d), pmat(c)); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; };
  const hashId = s => { let h = 7; for (const ch of String(s)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const HAIR = ['#3a2416', '#1e1a18', '#7a4a20', '#c8a050', '#5a3020'], SKIN = ['#f0c8a0', '#e0b088', '#c08860', '#8a5a3a'];
  function buildRig(id, name) {
    const h = hashId(id), shirt = new THREE.Color().setHSL((h % 360) / 360, 0.55, 0.5).getStyle(), pants = new THREE.Color().setHSL(((h >> 3) % 360) / 360, 0.35, 0.28).getStyle();
    const skin = SKIN[(h >> 5) % SKIN.length], hair = HAIR[(h >> 7) % HAIR.length];
    const g = new THREE.Group(), r = { g };
    // jambes (pivot à la hanche) ; face du modèle vers +z
    r.legs = [0.125, -0.125].map(x => { const L = new THREE.Group(); L.position.set(x, 0.75, 0); box(L, 0.24, 0.63, 0.26, pants, 0, -0.315, 0); box(L, 0.25, 0.13, 0.28, '#3a2a1e', 0, -0.69, 0.01); g.add(L); return L; });
    // haut du corps (pivot à la hanche : s'incline quand on s'accroupit)
    const up = r.upper = new THREE.Group(); up.position.y = 0.75; g.add(up);
    r.torso = box(up, 0.5, 0.72, 0.27, shirt, 0, 0.36, 0); box(up, 0.51, 0.07, 0.28, '#4a3020', 0, 0.04, 0);
    r.arms = [0.37, -0.37].map(x => { const A = new THREE.Group(); A.position.set(x, 0.66, 0); box(A, 0.23, 0.3, 0.25, shirt, 0, -0.12, 0); box(A, 0.21, 0.44, 0.23, skin, 0, -0.48, 0); up.add(A); return A; });
    const hd = r.head = new THREE.Group(); hd.position.set(0, 0.72, 0); up.add(hd);
    box(hd, 0.48, 0.48, 0.48, skin, 0, 0.24, 0); box(hd, 0.5, 0.13, 0.5, hair, 0, 0.45, 0); box(hd, 0.5, 0.3, 0.07, hair, 0, 0.32, -0.22);
    box(hd, 0.08, 0.06, 0.02, '#ffffff', 0.11, 0.26, 0.245); box(hd, 0.08, 0.06, 0.02, '#ffffff', -0.11, 0.26, 0.245);
    box(hd, 0.04, 0.06, 0.02, '#20304a', 0.13, 0.26, 0.252); box(hd, 0.04, 0.06, 0.02, '#20304a', -0.09, 0.26, 0.252);
    box(hd, 0.16, 0.04, 0.02, '#8a4a3a', 0, 0.1, 0.245);
    // objets tenus : main droite (arms[0]) et main secondaire (arms[1])
    r.hand = [0, 1].map(i => { const H2 = new THREE.Group(); H2.position.set(0, -0.68, 0.1); r.arms[i].add(H2); return H2; });
    r.armor = new THREE.Group(); g.add(r.armor);
    // nom au-dessus de la tête
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c2 = cv.getContext('2d');
    c2.font = 'bold 34px monospace'; const tw = Math.min(250, c2.measureText(String(name || '?').slice(0, 16)).width + 24);
    c2.fillStyle = 'rgba(0,0,0,.5)'; c2.fillRect(128 - tw / 2, 8, tw, 48); c2.textAlign = 'center'; c2.fillStyle = '#fff'; c2.fillText(String(name || '?').slice(0, 16), 128, 44);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true })); sp.scale.set(1.6, 0.4, 1); sp.position.y = 2.25; sp.renderOrder = 5; g.add(sp); r.tag = sp;
    return r;
  }
  // armure : boîtes un peu plus grandes que le corps, fixées aux membres (elles bougent avec eux)
  function dress(p, cols) {
    const r = p.rig; for (const m of r.armorParts || []) m.parent && m.parent.remove(m); r.armorParts = [];
    const add = (parent, w, h, d, c, x, y, z) => r.armorParts.push(box(parent, w, h, d, c, x, y, z));
    (cols || []).forEach((a, slot) => {
      if (!a) return; const c = a[0], k = a[1] || a[0];
      if (slot === 0) { add(r.head, 0.56, 0.3, 0.56, c, 0, 0.4, 0); add(r.head, 0.56, 0.06, 0.58, k, 0, 0.26, 0); add(r.head, 0.08, 0.24, 0.56, c, 0.27, 0.2, 0); add(r.head, 0.08, 0.24, 0.56, c, -0.27, 0.2, 0); }
      if (slot === 1) { add(r.upper, 0.56, 0.76, 0.33, c, 0, 0.36, 0); add(r.upper, 0.57, 0.06, 0.34, k, 0, 0.62, 0); for (const A of r.arms) add(A, 0.27, 0.32, 0.29, c, 0, -0.1, 0); }
      if (slot === 2) { add(r.upper, 0.54, 0.14, 0.31, c, 0, 0.04, 0); for (const L of r.legs) add(L, 0.28, 0.46, 0.3, c, 0, -0.25, 0); }
      if (slot === 3) for (const L of r.legs) { add(L, 0.29, 0.2, 0.32, c, 0, -0.66, 0.01); add(L, 0.29, 0.04, 0.33, k, 0, -0.55, 0.01); }
    });
  }
  function holdIn(p, i, id) {
    const hand = p.rig.hand[i]; while (hand.children.length) hand.remove(hand.children[0]);
    if (!id || !VX.FX || !VX.FX.meshOf) return;
    const cube = VX.isBlock(id) && D[id] && D[id].shape !== 'torch', m = VX.FX.meshOf(id, cube ? 0.28 : 0.5);
    if (cube) m.position.set(0, -0.05, 0.08); else { m.rotation.set(0, Math.PI / 2, -0.6); m.position.set(0, 0, 0.05); }
    hand.add(m);
  }
  function addPeer(id, name) {
    const rig = buildRig(id, name); G.scene.add(rig.g); rig.g.visible = false;
    const p = { id, name: name || '?', rig, g: rig.g, t: null, dim: null, phase: 0, swingT: 0, swingN: null, hitT: 0, lookIn: null, lookKey: '' };
    MP.peers.set(id, p); return p;
  }
  function peerOf(id, name) {
    let p = MP.peers.get(id);
    if (p && name && p.name !== name) { dropPeer(id); p = null; }   // le nom arrive avec la première position
    return p || addPeer(id, name || nameOf(id));
  }
  function dropPeer(id) { const p = MP.peers.get(id); if (!p) return; G.scene.remove(p.g); MP.peers.delete(id); }
  const wrap = a => { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; };
  function peersTick(dt) {
    const dk = Math.max(0.3, G.dim === 'surface' ? VX.R.uniforms.uDay.value : 0.9);
    for (const m of PMATS) m.color.copy(m.userData.base).multiplyScalar(dk);
    for (const p of MP.peers.values()) {
      if (!p.t) continue; const g = p.g, r = p.rig;
      g.visible = p.dim === G.dim;
      // apparence (armure, objets en main) : appliquée seulement si elle change
      if (p.lookIn) { const key = JSON.stringify(p.lookIn); if (key !== p.lookKey) { p.lookKey = key; dress(p, p.lookIn.a); holdIn(p, 0, p.lookIn.h); holdIn(p, 1, p.lookIn.o); } }
      if (!g.visible) continue;
      // interpolation douce vers la dernière position reçue (10 par seconde)
      const k = Math.min(1, dt * 12), ox = g.position.x, oz = g.position.z;
      if (!p.placed) { g.position.set(p.t[0], p.t[1], p.t[2]); p.placed = true; }
      g.position.x += (p.t[0] - g.position.x) * k; g.position.y += (p.t[1] - (p.sneak ? 0.12 : 0) - g.position.y) * k; g.position.z += (p.t[2] - g.position.z) * k;
      g.rotation.y += wrap(p.t[3] + Math.PI - g.rotation.y) * k;
      r.head.rotation.x += (-p.t[4] * 0.8 - r.head.rotation.x) * k;
      r.upper.rotation.x += ((p.sneak ? 0.4 : 0) - r.upper.rotation.x) * k;
      // marche : jambes et bras en opposition, amplitude selon la vitesse
      const sp = Math.hypot(g.position.x - ox, g.position.z - oz) / Math.max(dt, 1e-3);
      p.phase += dt * Math.min(sp, 7) * 2.2; const amp = Math.min(1, sp / 4) * 0.8;
      r.legs[0].rotation.x = Math.sin(p.phase) * amp; r.legs[1].rotation.x = -Math.sin(p.phase) * amp;
      p.swingT = Math.max(0, p.swingT - dt * 4);
      r.arms[1].rotation.x = -Math.sin(p.phase) * amp * 0.7 + (p.sneak ? -0.3 : 0);
      r.arms[0].rotation.x = Math.sin(p.phase) * amp * 0.7 - Math.sin(p.swingT * Math.PI) * 1.5 - (p.lookIn && p.lookIn.h ? 0.25 : 0);
      // coup reçu (JcJ) : petit sursaut rouge du nom
      p.hitT = Math.max(0, p.hitT - dt); r.tag.material.color.setRGB(1, p.hitT > 0 ? 0.4 : 1, p.hitT > 0 ? 0.4 : 1);
    }
  }

  /* =====================================================================
     7. ENVOIS RÉGULIERS : position (10/s), apparence, heure + météo (hôte)
     ===================================================================== */
  let posT = 0, lookT = 0, envT = 0, lastLook = '', lookAge = 0, swings = 0;
  H.on('swing', () => { swings = (swings + 1) % 1000; });
  function myLook() {
    const L = VX.armorLook ? VX.armorLook().slots : [], s = G.inv[G.sel], o = G.offhand;
    return { n: pname(), a: [0, 1, 2, 3].map(i => (L[i] ? [L[i].col, L[i].dark] : null)), h: s ? s.id : 0, o: o ? o.id : 0 };
  }
  H.on('playerTick', ({ dt, player: P }) => {
    if (!MP.on) return;
    if ((posT -= dt) <= 0) {
      posT = 0.1; const r = v => Math.round(v * 100) / 100;
      relay({ k: 'p', n: pname(), x: r(P.pos.x), y: r(P.pos.y), z: r(P.pos.z), yaw: r(P.yaw), pi: r(P.pitch), dim: G.dim, s: P.sneak ? 1 : 0, w: swings, v: G.mode === 'survie' && P.hp > 0 ? 1 : 0 });
      if (MP.host && VX.Mobs && VX.Mobs.snapshot) { const s = VX.Mobs.snapshot(); if (s) relay(s); }
    }
    if ((lookT -= dt) <= 0) { lookT = 0.5; lookAge += 0.5; const L = myLook(), key = JSON.stringify(L); if (key !== lastLook || lookAge > 5) { lastLook = key; lookAge = 0; relay(Object.assign({ k: 'look' }, L)); } }
    if (MP.host && (envT -= dt) <= 0) { envT = 3; relay({ k: 'env', time: G.time, w: VX.Weather ? VX.Weather.save() : null, dim: G.dim }); }
    containersTick(dt);
  });
  H.on('renderFrame', ({ dt }) => { if (MP.peers.size) peersTick(dt || 0.016); });
  // l'hôte change l'heure ou la météo : diffusion immédiate
  const envNow = () => { envT = 0; };

  /* =====================================================================
     8. CHAT, COMMANDES, JcJ
     ===================================================================== */
  H.on('chat', ({ text }) => { if (MP.on) relay({ k: 'chat', n: pname(), m: String(text).slice(0, 240) }); });
  const baseCommand = G.command;
  G.command = function (txt) {
    const t = String(txt || '').trim(), cmd = t[0] === '/' ? t.slice(1).split(/\s+/)[0].toLowerCase() : '', arg = (t.split(/\s+/)[1] || '').toLowerCase();
    if (MP.on && MP.joined && !MP.host && (cmd === 'temps' || cmd === 'meteo')) { say('En multijoueur, seul l\'hôte décide de l\'heure et de la météo.', 'err'); return; }
    if (cmd === 'joueurs') { say(MP.on ? 'Salon ' + MP.room.code + ' : ' + MP.room.players.map(p => p.name + (p.id === MP.hostId ? ' ★' : '')).join(', ') : 'Tu n\'es dans aucun salon.', MP.on ? 'ok' : 'err'); return; }
    if (cmd === 'jcj') {
      if (!MP.on || !MP.host) { say('Seul l\'hôte d\'un salon peut changer le JcJ (actuellement ' + (MP.pvp ? 'activé' : 'désactivé') + ').', 'err'); return; }
      setPvp(arg === 'on' || arg === 'oui' ? true : arg === 'off' || arg === 'non' ? false : !MP.pvp); return;
    }
    const r = baseCommand.apply(this, arguments);
    if (MP.host && (cmd === 'temps' || cmd === 'meteo')) envNow();
    if ((cmd === 'aide' || cmd === '?') && MP.on) say('Multijoueur : /joueurs · /jcj (hôte) · Tab : liste des joueurs', 'ok');
    return r;
  };
  function setPvp(v) { MP.pvp = !!v; relay({ k: 'cfg', pvp: MP.pvp }); say('JcJ ' + (MP.pvp ? 'activé : les joueurs peuvent se blesser.' : 'désactivé.'), 'ok'); UI.toast('JcJ ' + (MP.pvp ? 'activé' : 'désactivé')); }
  MP.setPvp = setPvp;
  // un bloc solide entre l'œil et la cible ? (les plantes, torches, l'eau ne gênent pas)
  function wallBetween(o, d, len) {
    for (let t = 0.2; t < len; t += 0.2) { const b = D[G.world.get(Math.floor(o.x + d.x * t), Math.floor(o.y + d.y * t), Math.floor(o.z + d.z * t))]; if (b && b.solid) return true; }
    return false;
  }
  // coups entre joueurs (seulement si l'hôte a activé le JcJ)
  H.on('attack', ({ origin, dir, reach }) => {
    if (!MP.on || !MP.pvp || G.player.hp <= 0) return true;
    let best = null, bt = reach;
    for (const p of MP.peers.values()) {
      if (!p.t || p.dim !== G.dim) continue; const x = p.g.position.x, y = p.g.position.y, z = p.g.position.z;
      const mn = [x - 0.35, y, z - 0.35], mx = [x + 0.35, y + 1.9, z + 0.35], o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z]; let t0 = 0, t1 = bt, ok = true;
      for (let k = 0; k < 3 && ok; k++) { if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) ok = false; continue; } let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) { const tt = a; a = b; b = tt; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) ok = false; }
      if (!ok || t0 >= bt) continue;
      if (!wallBetween(origin, dir, t0)) { bt = t0; best = p; }
    }
    if (!best) return true;
    const st = G.inv[G.sel], tl = st && VX.ITEMS[st.id] && VX.ITEMS[st.id].tool, tier = tl ? VX.TIERS[tl.tier] : null;
    const n = tl ? (tl.kind === 'epee' ? tier.dmg : Math.max(2, tier.dmg - 2)) : 1;
    relay({ k: 'pvp', n, sx: G.player.pos.x, sz: G.player.pos.z, kx: dir.x * 6, kz: dir.z * 6 }, best.id);
    best.hitT = 0.3; G.sfx('hit', { dist: bt }); if (VX.FX) VX.FX.burst(best.g.position.x, best.g.position.y + 1.2, best.g.position.z, 6, [0.75, 0.1, 0.1], { speed: 2, life: 0.4 });
    return false;
  });

  /* =====================================================================
     9. LISTE DES JOUEURS (touche Tab maintenue)
     ===================================================================== */
  const tab = document.createElement('div'); tab.className = 'mptab'; document.body.appendChild(tab);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function renderTab() {
    if (!MP.on || !MP.room) { tab.innerHTML = '<h3>Multijoueur</h3><div>Aucun salon. Menu Échap → Multijoueur.</div>'; return; }
    const P = G.player.pos, dimN = d => d === 'braises' ? 'Braises' : 'Surface';
    tab.innerHTML = `<h3>Salon ${esc(MP.room.code)} · ${MP.room.players.length} joueur(s) · JcJ ${MP.pvp ? 'activé' : 'désactivé'}</h3>` + MP.room.players.map(pl => {
      const me = pl.id === MP.id, p = MP.peers.get(pl.id), where = me ? dimN(G.dim) : p && p.t ? dimN(p.dim) + (p.dim === G.dim ? ' · ' + Math.round(Math.hypot(p.t[0] - P.x, p.t[2] - P.z)) + ' m' : '') : '…';
      return `<div><span>${pl.id === MP.hostId ? '★ ' : ''}${esc(pl.name)}${me ? ' <i>(toi)</i>' : ''}</span><i>${where}</i></div>`;
    }).join('');
  }
  let tabOn = false, tabI = null;
  document.addEventListener('keydown', e => {
    if (e.code !== 'Tab' || UI.chatOpen || UI.menuOpen || UI.open) return;
    e.preventDefault(); if (tabOn) return; tabOn = true; renderTab(); tab.style.display = 'block'; tabI = setInterval(renderTab, 500);
  });
  const tabOff = () => { if (!tabOn) return; tabOn = false; tab.style.display = 'none'; clearInterval(tabI); };
  document.addEventListener('keyup', e => { if (e.code === 'Tab') tabOff(); });
  window.addEventListener('blur', tabOff);

  /* =====================================================================
     10. ACTIONS DU MENU : ouvrir, rejoindre, quitter
     ===================================================================== */
  async function hostGame() {
    if (MP.on) return;
    try { await connect(); } catch (e) { UI.toast(e.message); return; }
    MP.room = null; MP.hostId = null; MP.leaving = false; MP.gone = false; MP.expect = '*host';
    send({ t: 'create', name: 'Blocaria de ' + pname(), map: 'b_blocs', max: 8, priv: true });
    const t0 = Date.now(); while (!MP.room && Date.now() - t0 < 5000) await sleep(100);
    if (MP.room) { MP.code = MP.room.code; MP.hostId = MP.id; MP.hostDim = G.dim; UI.toast('Salon ouvert ! Code : ' + MP.room.code + ' (donne-le à tes potes)'); say('Salon ouvert : code ' + MP.room.code + '. JcJ désactivé (/jcj pour le changer).', 'ok'); UI.menu('pause'); }
  }
  async function joinGame(codeArg) {
    if (MP.on) return;
    const code = String(codeArg || prompt('Code du salon de ton pote :', '') || '').trim().toUpperCase(); if (!code) return;
    try { await connect(); } catch (e) { UI.toast(e.message); return; }
    MP.room = null; MP.hostId = null; MP.leaving = false; MP.gone = false; MP.joined = false; MP.expect = code;
    send({ t: 'join', code }); const t0 = Date.now(); while (!MP.room && Date.now() - t0 < 6000) await sleep(100);
    if (!MP.room) { MP.expect = null; UI.toast('Salon introuvable.'); return; }
    MP.code = MP.room.code; MP.hostId = MP.room.host; UI.toast('Salon trouvé : réception du monde…');
    relay({ k: 'need', addons: addons() }, MP.hostId);
  }
  function leave(silent) {
    if (MP.on && MP.host) relay({ k: 'bye' });
    MP.leaving = true; MP.on = false; MP.room = null;
    for (const id of [...MP.peers.keys()]) dropPeer(id);
    if (VX.Mobs && VX.Mobs.resetRemote) VX.Mobs.resetRemote();
    const ws = MP.ws; MP.ws = null;
    try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'leave' })); } catch (e) {}
    setTimeout(() => { try { ws && ws.close(); } catch (e) {} }, 100);
    // l'invité retourne à son propre monde : on recharge SANS sauvegarder (G.guest reste vrai jusqu'au rechargement)
    if (MP.joined) { MP.joined = false; G.guest = true; setTimeout(() => location.reload(), 150); return; }
    if (!silent) UI.toast('Tu as quitté le salon.');
  }
  // fermer l'onglet en tant qu'hôte : on prévient les invités
  window.addEventListener('beforeunload', () => { if (!MP.on) return; if (MP.host) relay({ k: 'bye' }); MP.leaving = true; send({ t: 'leave' }); });
  MP.host_ = hostGame; MP.join = joinGame; MP.leave = leave;
  MP.relay = relay; MP.sendTo = (id, d) => relay(d, id);
  // joueurs distants de ma dimension (cibles des créatures simulées par l'hôte)
  MP.targets = () => { const out = []; if (!MP.on) return out; for (const p of MP.peers.values()) if (p.t && p.dim === G.dim) out.push({ id: p.id, pos: { x: p.t[0], y: p.t[1], z: p.t[2] }, eye: p.t[1] + (p.sneak ? 1.42 : 1.62), alive: !!p.vis, remote: true }); return out; };
  MP.remoteMobs = () => MP.on && MP.joined && !MP.host && MP.hostDim === G.dim;
  // option JcJ dans le menu (bouton de l'écran Multijoueur)
  const baseMenu = G.menuAction;
  G.menuAction = function (a) { if (a === 'mppvp') { if (MP.on && MP.host) setPvp(!MP.pvp); return; } return baseMenu.apply(this, arguments); };
})();

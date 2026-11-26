/* ===== arena/asc-run.js : déroulement d'une course de « COLOSSES : L'ASCENSION » et ses écrans =====
   Solo ou entre amis (salon « a_asc », jusqu'à 4). L'hôte décide (portes proposées, contenu des étages) et
   diffuse ; chacun choisit SES récompenses. Messages relayés :
     qp  joueur prêt pour une étape (+ infos publiques : arme, bénédictions, PV, or)
     qd  portes proposées pour l'étage suivant (hôte)      qv  vote pour une porte
     qf  départ d'un étage (hôte, contenu complet)         qx  statistiques d'un joueur après un étage
     qe  fin de course imposée par l'hôte                   qa  effets pendant un étage (asc-combat.js) */
(function () {
  const BR = window.BR, AR = BR.ARENA, UI = BR.UI, Au = BR.Audio, N = BR.Net, Acc = BR.Account, el = BR.el, esc = BR.esc;
  const Q = BR.Asc, AU = BR.ArenaUI;
  const ICO = (n, sz, c) => BR.Icons.svg(n, sz, c);
  let R = null, M = null;
  Q.me = () => M;
  Q.addGold = v => addGold(v);
  Object.defineProperty(Q, 'run', { get: () => R });
  Object.defineProperty(Q, 'running', { get: () => !!(R && !R.ended) });

  /* =====================================================================
     DONNÉES DU COMPTE (éclats, déblocages, paliers, records)
     Gardées dans le profil (synchronisé si le serveur les accepte) ET en copie locale.
     ===================================================================== */
  const dkey = () => 'br_asc_' + String((Acc.p && Acc.p.name) || 'invite').toLowerCase();
  function normD(d) {
    d = d && typeof d === 'object' ? d : {};
    const n = (v, a, b) => { v = Number(v); return Number.isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : a; };
    const o = { sh: n(d.sh, 0, 1e8), u: {}, pal: n(d.pal, 0, 10), best: {}, runs: n(d.runs, 0, 1e8), wins: n(d.wins, 0, 1e8), fast: n(d.fast, 0, 1e7) };
    if (d.u && typeof d.u === 'object') for (const U of Q.UNLOCKS) if (d.u[U.id]) o.u[U.id] = n(d.u[U.id], 0, U.cost.length);
    if (d.best && typeof d.best === 'object') for (let p = 0; p <= 10; p++) if (d.best[p]) o.best[p] = n(d.best[p], 0, Q.FLOORS);
    o.cls = {}; const C = d.cls && typeof d.cls === 'object' ? d.cls : {};
    for (const k of ['chevalier', 'mage', 'archer']) { const c = C[k] && typeof C[k] === 'object' ? C[k] : {}, nodes = {}; if (c.nodes && typeof c.nodes === 'object') for (const id of Object.keys(c.nodes).slice(0, 120)) if (/^[a-z0-9_]{2,24}$/.test(id)) nodes[id] = n(c.nodes[id], 0, 5); const pw = Array.isArray(c.pw) ? c.pw.filter(id => typeof id === 'string' && /^[a-z_0-9]{2,24}$/.test(id)).slice(0, 40) : []; o.cls[k] = { xp: n(c.xp, 0, 1e9), nodes, pw: Array.from(new Set(pw)) }; }
    const sel = d.sel && typeof d.sel === 'object' ? d.sel : {}, sid = v => typeof v === 'string' && /^[a-z_0-9]{2,24}$/.test(v) ? v : null;
    const qs = d.q && typeof d.q === 'object' ? d.q : {}, qn = L => Array.isArray(L) ? L.slice(0, 6).filter(x => x && typeof x.id === 'string' && /^[a-z_0-9]{2,24}$/.test(x.id)).map(x => ({ id: x.id, p: n(x.p, 0, 1e6), c: x.c ? 1 : 0 })) : [];
    o.q = { day: typeof qs.day === 'string' ? qs.day.slice(0, 10) : '', week: typeof qs.week === 'string' ? qs.week.slice(0, 10) : '', d: qn(qs.d), w: qn(qs.w) };
    const nmap = (x, max, lim) => { const out = {}; if (x && typeof x === 'object') for (const k of Object.keys(x).slice(0, lim)) if (/^[a-z_0-9]{2,24}$/.test(k)) out[k] = n(x[k], 0, max); return out; };
    o.inf = n(d.inf, 0, 9999); o.st = nmap(d.st, 1e9, 80); o.bes = nmap(d.bes, 1e9, 40); o.ach = nmap(d.ach, 1, 120);
    o.title = typeof d.title === 'string' && /^[a-z_0-9]{2,24}$/.test(d.title) ? d.title : '';
    const wk = d.wk && typeof d.wk === 'object' ? d.wk : {}; o.wk = { key: typeof wk.key === 'string' ? wk.key.slice(0, 10) : '', fl: n(wk.fl, 0, 9999), t: n(wk.t, 0, 1e7) };
    o.sel = { cls: ['chevalier', 'mage', 'archer'].includes(sel.cls) ? sel.cls : null, kit: [0, 1, 2, 3].map(i => Array.isArray(sel.kit) ? sid(sel.kit[i]) : null), ult: sid(sel.ult) };
    return o;
  }
  Q.data = function () {
    const p = Acc.p; const d = normD(p.asc), bk = normD(BR.store.get(dkey(), null));
    d.sh = Math.max(d.sh, bk.sh); d.pal = Math.max(d.pal, bk.pal); d.runs = Math.max(d.runs, bk.runs); d.wins = Math.max(d.wins, bk.wins);
    d.fast = d.fast && bk.fast ? Math.min(d.fast, bk.fast) : d.fast || bk.fast;
    for (const k in bk.u) d.u[k] = Math.max(d.u[k] || 0, bk.u[k]);
    for (const k in bk.best) d.best[k] = Math.max(d.best[k] || 0, bk.best[k]);
    for (const k in bk.cls) { if (bk.cls[k].xp > d.cls[k].xp) d.cls[k] = Object.assign({}, bk.cls[k], { pw: Array.from(new Set(d.cls[k].pw.concat(bk.cls[k].pw))) }); else d.cls[k].pw = Array.from(new Set(d.cls[k].pw.concat(bk.cls[k].pw))); }
    if (!d.sel.cls && bk.sel.cls) d.sel = bk.sel;
    if (bk.q && bk.q.day > d.q.day) d.q = bk.q;
    d.inf = Math.max(d.inf, bk.inf); for (const k in bk.st) d.st[k] = Math.max(d.st[k] || 0, bk.st[k]); for (const k in bk.bes) d.bes[k] = Math.max(d.bes[k] || 0, bk.bes[k]); for (const k in bk.ach) d.ach[k] = 1;
    if (!d.title && bk.title) d.title = bk.title; if (bk.wk.key > d.wk.key || (bk.wk.key === d.wk.key && bk.wk.fl > d.wk.fl)) d.wk = bk.wk;
    p.asc = d; return d;
  };
  Q.saveData = function () { BR.store.set(dkey(), Acc.p.asc); Acc.save(true); };
  Q.selPal = () => Math.min(Q.data().pal, BR.store.get('br_asc_pal', 0) | 0);
  Q.palierList = function () {
    const r = N.room, cur = r && /^p\d+$/.test(r.diff || '') ? +r.diff.slice(1) : 0, mx = Math.max(Q.data().pal, cur);
    const out = []; for (let i = 0; i <= mx; i++) out.push(Q.palierDiff('p' + i)); return out;
  };
  Q.palierDiff = function (id) { const i = /^p\d+$/.test(id || '') ? Math.min(10, +String(id).slice(1)) : 0; return { id: 'p' + i, name: i ? 'Palier ' + i : 'Palier 0', color: Q.palCol(i), desc: Q.PALIERS[i].d }; };
  const palOf = id => /^p\d+$/.test(id || '') ? Math.min(10, +String(id).slice(1)) : 0;

  /* =====================================================================
     OUTILS
     ===================================================================== */
  const isHost = () => R && R.selfId === R.hostId;
  const send = d => { if (R && !R.solo && N.room) N.relay(d); };
  const active = () => Object.keys(R.P).filter(id => !R.P[id].gone);
  const nPlayers = () => Math.max(1, active().length);
  const unlocked = id => !!(Q.data().u[id]);
  const RAR = ['commun', 'rare', 'epique', 'legendaire'];
  const rcol = r => BR.RARITY[r].color;
  const wsel = (list, w, rng) => { const tot = list.reduce((s, x) => s + w(x), 0); let x = (rng || Math.random)() * tot; for (const it of list) { x -= w(it); if (x <= 0) return it; } return list[list.length - 1]; };
  function pub() { return { w: M.weapon, cls: M.cls, hp: +(M.hpK || 0).toFixed(2), b: M.boons, c: M.curses, g: M.gold, s: M.skills, u: M.ult, lv: M.lv }; }
  // classe + build (kit de 4 pouvoirs + ultime) ; un build invalide retombe sur le kit de départ de la classe
  function setClass(cls, sel) {
    const C = Q.CLASSES[cls], ok = (id, t) => { const s = id && AR.skill(id); return s && s.type === t && Q.isUnlocked(cls, id) ? id : null; };
    M.cls = cls; M.weapon = C.weapon; M.lv = {};
    const kit = (sel && Array.isArray(sel.kit) ? sel.kit : []).map(id => ok(id, 'skill')).filter((id, i, a) => id && a.indexOf(id) === i);
    for (const id of C.kit) if (kit.length < 4 && !kit.includes(id)) kit.push(id);
    M.skills = kit.slice(0, 4); M.ult = (sel && ok(sel.ult, 'ult')) || C.ult;
    M.skills.concat([M.ult]).forEach(id => { M.lv[id] = 1; });
    const D = Q.data(); M.tree = Object.assign({}, (D.cls[cls] || {}).nodes || {});
    Q.emit && Q.emit('classSet', M);
  }
  function kitObj() { return { weapon: M.weapon, cls: M.cls, s: M.skills.slice(), u: M.ult, lv: Object.assign({}, M.lv), tree: M.tree || {} }; }
  function famsOwned() { const s = new Set(); for (const id in M.boons) { const B = Q.boon(id); if (B) s.add(B.f); } return s; }

  /* ---------- tirages de récompenses (propres à chaque joueur) ---------- */
  function boonPool(ctx) {
    const fam = famsOwned();
    return Q.BOONS.filter(B => {
      if (ctx === 'shop' ? !B.shop : B.shop) return false;
      if (B.lock && !unlocked(B.lock)) return false;
      if (B.coop && R.roster.length < 2) return false;
      if (B.duo && !(fam.has(B.duo[0]) && fam.has(B.duo[1]))) return false;
      if ((M.boons[B.id] || 0) >= B.max) return false;
      if ((B.id === 'b_geant' && M.boons.b_mini) || (B.id === 'b_mini' && M.boons.b_geant)) return false;
      return true;
    });
  }
  function rarW(ctx) {
    const W = ctx === 'leg' ? { commun: 0, rare: 0, epique: 45, legendaire: 55 } : ctx === 'elite' ? { commun: 0, rare: 55, epique: 35, legendaire: 10 } : { commun: 56, rare: 32, epique: 10, legendaire: 2 };
    if (ctx === 'normal' && R.floor >= 5) { W.commun *= 0.65; W.epique *= 1.4; }
    if (M.meta.legend) { W.epique *= 1 + 0.4 * M.meta.legend; W.legendaire *= 1 + M.meta.legend; }
    return W;
  }
  function drawBoons(ctx, n, tier) {
    const pool = boonPool(ctx), out = [];
    let W = rarW(ctx === 'shop' ? 'normal' : ctx);
    if (tier && pool.some(B => B.r === tier && !B.duo)) W = { commun: 0, rare: 0, epique: 0, legendaire: 0, [tier]: 1 };
    for (let k = 0; k < n; k++) {
      // trois choix = trois actions différentes autant que possible (attaque, esquive, pouvoirs, ultime, passif)
      let left = pool.filter(B => !out.includes(B)); if (!left.length) break;
      const other = left.filter(B => !out.some(o => o.s === B.s)); if (other.length) left = other;
      // les duos disponibles ont une bonne chance d'apparaître
      const duo = left.filter(B => B.duo);
      if (duo.length && Math.random() < 0.35 && !out.some(B => B.duo)) { out.push(BR.pick(duo)); continue; }
      const rs = RAR.filter(r => W[r] > 0 && left.some(B => B.r === r && !B.duo));
      const r = rs.length ? wsel(rs, x => W[x]) : null;
      const cand = r ? left.filter(B => B.r === r && !B.duo) : left;
      out.push(BR.pick(cand.length ? cand : left));
    }
    return out.map(B => ({ t: 'boon', id: B.id }));
  }
  function drawPowers(n, ultOnly, tier) {
    const out = [], owned = M.skills.filter(Boolean).concat(M.ult ? [M.ult] : []);
    const fresh = AR.SKILLS.filter(s => (ultOnly ? s.type === 'ult' : s.type === 'skill') && !owned.includes(s.id) && !(s.id === 'u_temps' && R.roster.length > 1 && false));
    const ups = owned.filter(id => (M.lv[id] || 1) < AR.MAXLV && (!ultOnly || AR.skill(id).type === 'ult'));
    const W = { commun: 62, rare: 27, epique: 9, legendaire: 2 };
    for (let k = 0; k < n; k++) {
      const canUp = ups.filter(id => !out.some(o => o.id === id));
      if (!ultOnly && canUp.length && (Math.random() < 0.4 || !fresh.length)) { const id = BR.pick(canUp); out.push({ t: 'up', id }); continue; }
      let left = fresh.filter(s => !out.some(o => o.id === s.id)); if (!left.length) break;
      if (tier) { const tl = left.filter(s => s.rarity === tier); if (tl.length) left = tl; }
      const s = wsel(left, x => W[x.rarity]); out.push({ t: 'new', id: s.id });
    }
    return out;
  }
  function buildOffer(rw, ctx, tier) {
    if (rw === 'ult' && M.ult) rw = 'boon';
    const nC = 3 + ((M.meta.relance || 0) >= 1 ? 1 : 0);
    if (rw === 'boon') return { rw, ctx, tier, items: drawBoons(ctx || 'normal', nC, tier) };
    if (rw === 'leg') return { rw, ctx: 'leg', tier, items: drawBoons('leg', nC, tier) };
    if (rw === 'power') return { rw, tier, items: drawPowers(nC, false, tier) };
    if (rw === 'ult') return { rw, items: drawPowers(3, true) };
    if (rw === 'gold') return { rw, items: [{ t: 'gold', v: 70 + 14 * R.floor }] };
    if (rw === 'heal') return { rw, items: [{ t: 'heart' }] };
    return { rw: 'boon', items: drawBoons('normal', 3) };
  }
  function addGold(v) { if (M.curses.includes('m_avare')) return 0; v = Math.round(v * (1 + 0.1 * (M.meta.flair || 0))); M.gold += v; return v; }
  function applyItem(it, slot) {
    if (it.t === 'boon') {
      // une seule bénédiction par action : la nouvelle remplace l'ancienne
      const nb = Q.boon(it.id), old = nb && Q.boonOnSlot(M, nb.s); if (old && old.id !== it.id) delete M.boons[old.id];
      M.boons[it.id] = (M.boons[it.id] || 0) + 1; const B = Q.boon(it.id); if (B && (B.id === 'b_pv' || B.id === 'b_sacri' || B.id === 'b_geant' || B.id === 'b_mini')) { /* les PV max changent : le ratio est conservé */ } }
    else if (it.t === 'new') {
      const d = AR.skill(it.id);
      if (d.type === 'ult') M.ult = it.id;
      else { const free = M.skills.indexOf(null); const k = slot != null ? slot : free >= 0 ? free : 0; M.skills[k] = it.id; }
      M.lv[it.id] = 1;
      if (Q.unlockPower(M.cls, it.id)) setTimeout(() => BR.Arena.banner('NOUVEAU POUVOIR DÉBLOQUÉ', Q.skillName(it.id, M.cls) + ' — disponible chez le Maître d\'armes', 2.6, 'gold'), 1900);
    }
    else if (it.t === 'up') M.lv[it.id] = Math.min(AR.MAXLV, (M.lv[it.id] || 1) + 1);
    else if (it.t === 'gold') addGold(it.v);
    else if (it.t === 'heart') { M.bonusHp = (M.bonusHp || 0) + 120; M.hpK = Math.min(1, (M.hpK || 0) + 0.5); }
    else if (it.t === 'heal') M.hpK = Math.min(1, (M.hpK || 0) + it.v);
  }

  /* =====================================================================
     DÉMARRAGE D'UNE COURSE
     ===================================================================== */
  Q.selMap = () => { const id = BR.store.get('br_asc_map', 'grotte'); return Q.mapOpen(id) ? id : 'grotte'; };
  Q.mapOpen = id => { const Mp = BR.Dungeon && BR.Dungeon.MAPS.find(m => m.id === id); return !!Mp && Mp.lvl <= ((Q.data().st || {}).mapmax || 0) + 1; };
  Q.startSolo = function (mapId) {
    init({ map: mapId && Q.mapOpen(mapId) ? mapId : Q.selMap(), seed: (Math.random() * 2 ** 31) >>> 0, pal: Q.selPal(), roster: [{ id: 'me', name: Acc.p.name, look: Acc.p.look, level: Acc.level().level }], selfId: 'me', hostId: 'me', solo: true, faces: AU.pickFaces(8) });
  };
  /* défi de la semaine : même course pour tout le monde (graine = la semaine, en UTC), deux modificateurs, en solo */
  Q.CHAL_MODS = {
    acier: { n: 'Monstres d\'acier', d: 'Les monstres ont beaucoup plus de PV.' },
    furie: { n: 'Furie', d: 'Les monstres frappent plus fort et vont plus vite.' },
    verre: { n: 'Canon de verre', d: 'Tu as bien moins de PV, mais tu frappes plus fort.' },
    fortune: { n: 'Fortune', d: 'Chaque coffre est d\'une rareté au-dessus.' },
    sansrepos: { n: 'Sans répit', d: 'Aucun feu de camp sur la route.' },
    eclair: { n: 'Don des dieux', d: 'Tu commences avec une bénédiction légendaire.' },
  };
  Q.weekKey = () => { const now = new Date(), wd = (now.getUTCDay() + 6) % 7; return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - wd)).toISOString().slice(0, 10); };
  Q.weekChallenge = () => { const key = Q.weekKey(); let h = 2166136261; for (const c of 'defi' + key) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } const seed = h >>> 0, r = BR.rngFrom(seed), ks = Object.keys(Q.CHAL_MODS); const a = ks[Math.floor(r() * ks.length)]; let b = a; while (b === a) b = ks[Math.floor(r() * ks.length)]; return { key, seed, mods: [a, b] }; };
  Q.startChallenge = function () {
    const C = Q.weekChallenge();
    init({ map: 'citadelle', seed: C.seed, pal: 0, roster: [{ id: 'me', name: Acc.p.name, look: Acc.p.look, level: Acc.level().level }], selfId: 'me', hostId: 'me', solo: true, faces: AU.pickFaces(8), chal: C });
  };
  Q.startNet = function (m) {
    const room = m.room;
    init({ map: (m.cfg && m.cfg.amap) || 'grotte', seed: m.seed >>> 0, pal: palOf(m.diff), roster: room.players.map(p => ({ id: p.id, name: p.name, look: p.look, level: p.level })), selfId: N.id, hostId: room.host, solo: false, faces: (m.cfg && m.cfg.faces) || AU.pickFaces(8) });
  };
  function init(o) {
    stopListen();
    R = { map: o.map || 'grotte', seed: o.seed, pal: o.pal, roster: o.roster, selfId: o.selfId, hostId: o.hostId, solo: o.solo, faces: o.faces, floor: 0, phase: 'start', doors: null, room: null, used: [], P: {}, votes: {}, history: [], t0: performance.now(), deadline: performance.now() + 150000, ended: false, offer: null, pend: null, floorDmg: {} };
    R.rng = BR.rngFrom((o.seed ^ 0x2545f491) >>> 0);
    R.chal = o.chal || null; R.inf = false;
    R.roster.forEach(p => { R.P[p.id] = { name: p.name, look: p.look, rd: '', pub: null, st: null, gone: false }; });
    const D = Q.data();
    M = { cls: null, weapon: 'blade', skills: [null, null, null, null], ult: null, lv: {}, boons: {}, curses: [], gold: 40 * (D.u.bourse || 0), hpK: 1, ultC: [0, 40, 70, 100][D.u.ultdep || 0] || 0, bonusHp: 0,
      chance: D.u.chance || 0, meta: Object.assign({}, D.u),
      stats: { dmg: 0, taken: 0, downs: 0, revives: 0, perfect: 0, parries: 0, spent: 0, curses: 0 }, bosses: 0, cleared: 0, rerolls: 0 };
    if (R.pal >= 9) { const c = BR.pick(Q.CURSES.filter(x => x.id !== 'm_avare')); M.curses.push(c.id); M.stats.curses++; }
    // départ : d'abord la classe, puis 3 pouvoirs de départ de cette classe (+ 3 ultimes avec « Ultime de départ »)
    const ults = M.meta.ultdep ? BR.shuffle(AR.SKILLS.filter(s => s.type === 'ult')).slice(0, 3).map(s => s.id) : null;
    R.start = { cls: null, starters: null, ults, sk: null, ul: null };
    // classe et build choisis au village (maître d'armes) : on part directement
    const sel0 = D.sel && D.sel.cls && Q.CLASSES[D.sel.cls] ? D.sel : { cls: 'chevalier' };
    if (R.chal) { M.chalMods = R.chal.mods.slice(); if (R.chal.mods.includes('eclair')) { const L = Q.BOONS.filter(B => B.r === 'legendaire' && !B.shop && !B.coop && !B.duo && !B.lock); if (L.length) M.boons[L[Math.floor(R.rng() * L.length)].id] = 1; } }
    if (sel0) { setClass(sel0.cls, sel0); R.start.fromVillage = true; setTimeout(() => { if (R && R.phase === 'start' && R.P[R.selfId].rd !== 'start') { ready('start'); render(); } }, 400); }
    listen();
    clearInterval(R.timer); R.timer = setInterval(timerTick, 500);
    BR.curGame = 'arena'; BR.ascMode = true;
    UI.show('asc-x');
  }

  /* =====================================================================
     RÉSEAU
     ===================================================================== */
  let offs = [];
  function stopListen() { offs.forEach(f => f && f()); offs = []; }
  function listen() {
    if (R.solo) return;
    offs.push(N.on('r', m => onMsg(m.f, m.d)));
    offs.push(N.on('left', m => { if (!R || !R.P[m.id]) return; R.P[m.id].gone = true; toast(m.name + ' a quitté l\'Ascension.'); if (isHost()) hostCheck(); render(); }));
    offs.push(N.on('abort', m => { if (R && !R.ended && !BR.Arena.active) endRun({ win: false, aborted: true, why: m.msg || 'L\'hôte a quitté.' }); }));
    offs.push(N.on('lost', () => { if (R && !R.ended && !BR.Arena.active) endRun({ win: false, aborted: true, why: 'Connexion au serveur perdue.' }); }));
  }
  function onMsg(from, d) {
    if (!R || !d || typeof d.k !== 'string' || d.k[0] !== 'q') return;
    const P = R.P[from];
    switch (d.k) {
      case 'qp': if (P) { P.rd = d.ph; P.pub = d.pub || P.pub; if (isHost()) hostCheck(); render(); } break;
      case 'qv': if (P && d.fl === R.floor + 1) { R.votes[from] = d.d | 0; showVotes(); if (isHost()) hostCheck(); } break;
      case 'qx': if (P) { P.st = d.st || P.st; if (d.fd != null) { (R.floorDmg[d.fl] = R.floorDmg[d.fl] || {})[from] = d.fd; } render(); } break;
      case 'qd': if (from === R.hostId && d.fl === R.floor + 1) { setDoors(d.fl, d.doors); } break;
      case 'qf': if (from === R.hostId && d.fl > R.floor) { goFloor(d.fl, d.room, d.di); } break;
      case 'qe': if (!R.ended && d.fin) { winNow(); break; }
        if (from === R.hostId && !R.ended) { if (BR.Arena.active) BR.Arena.finish({ aborted: true }); endRun({ win: !!d.win, aborted: !d.win, why: d.why }); } break;
    }
  }
  function ready(ph) { const me = R.P[R.selfId]; me.rd = ph; me.pub = pub(); send({ k: 'qp', ph, pub: me.pub }); if (isHost()) hostCheck(); }

  /* ---------- hôte : avancer quand tout le monde est prêt (ou trop tard) ---------- */
  function phaseTag() { return R.floor === 0 ? 'start' : 'f' + R.floor; }
  function allReady(tag) { return active().every(id => R.P[id].rd === tag); }
  function hostCheck() {
    if (!R || R.ended || !isHost() || (R.floor === 0 && BR.Arena.active)) return;
    const late = !R.solo && performance.now() > R.deadline;   // en solo : on prend son temps
    if (R.floor === 0 && !R.room) { if (allReady('start') || late) startFloor(1, { kind: 'combat', rw: 'ult' }); return; }
    if (R.doors && R.doors.fl === R.floor + 1 && R.going !== R.floor + 1) {
      const voters = active().filter(id => R.votes[id] != null);
      if (voters.length === active().length || late) {
        const n = R.doors.list.length, cnt = new Array(n).fill(0); voters.forEach(id => cnt[Math.min(n - 1, R.votes[id])]++);
        const mx = Math.max(...cnt), tied = cnt.map((c, i) => c === mx ? i : -1).filter(i => i >= 0), pick = tied[Math.floor(R.rng() * tied.length)];
        startFloor(R.floor + 1, R.doors.list[pick], pick);
      }
    }
  }
  function timerTick() {
    if (!R || R.ended) return;
    if (isHost()) hostCheck();
    const c = BR.$('#s-asc-x .ax-count'); if (c && !R.solo) { const s = Math.max(0, Math.ceil((R.deadline - performance.now()) / 1000)); c.textContent = s + ' s'; c.classList.toggle('hot', s <= 5); }
  }
  function setDoors(fl, list) {
    R.doors = { fl, list }; R.votes = {}; R.deadline = performance.now() + 75000;
    placePortals();
  }
  // les portails apparaissent dans l'arène ; scellés tant que je n'ai pas pris ma récompense (étages de combat)
  function placePortals() {
    if (!R.doors || R.doors.fl !== R.floor + 1 || !Q.W.alive() || R.portalsUp === R.floor) return;
    R.portalsUp = R.floor;
    Q.W.portals(R.doors.list, i => vote(i));
    if (R.rewardTaken || (!COMBAT(R.room.kind) && !PUZ(R.room.kind))) Q.W.unseal();
    showVotes();
  }
  function vote(i) { R.votes[R.selfId] = i; send({ k: 'qv', fl: R.floor + 1, d: i }); showVotes(); if (isHost()) hostCheck(); }
  function showVotes() { if (!Q.W.alive() || R.solo) return; const names = {}; Object.keys(R.P).forEach(id => { names[id] = R.P[id].name; }); Q.W.showVotes(R.votes, names); }

  /* ---------- hôte : portes et contenu des étages ---------- */
  const KIND = {
    combat: { n: 'Combat', col: '#ffb24a', icon: 'swords' }, elite: { n: 'Élite', col: '#ff5a6a', icon: 'skull' }, defi: { n: 'Défi', col: '#ff3bd0', icon: 'bolt' },
    repos: { n: 'Feu de camp', col: '#ff9a3a', icon: 'fire' }, marchand: { n: 'Marchand', col: '#ffd84a', icon: 'coin' }, autel: { n: 'Autel maudit', col: '#b06bff', icon: 'curse' },
    enigme: { n: 'Énigme', col: '#5ad1ff', icon: 'gear' }, savoir: { n: 'Salle du Savoir', col: '#7dff9a', icon: 'bulb' },
    gardien: { n: 'Gardien', col: '#ff4a2a', icon: 'crown' }, final: { n: 'Le Colosse Ascendant', col: '#ffffff', icon: 'crown' },
    fin: { n: 'Victoire', col: '#ffd76a', icon: 'crown' }, infini: { n: "L'Infini", col: '#b06bff', icon: 'bolt' },
  };
  const RW = { boon: 'Bénédiction', power: 'Pouvoir', gold: 'Trésor', heal: 'Cœur de colosse', leg: 'Bénédiction légendaire', ult: 'Ultime' };
  function makeDoors(fl) {
    const one = d => { d.room = buildRoom(fl, d); return [d]; };
    if (fl === 5 || fl === 10 || (fl > Q.FLOORS && fl % 5 === 0)) return one({ kind: 'gardien' });
    if (fl === Q.FLOORS) return one({ kind: 'final' });
    const actOf = x => x <= 5 ? 1 : x <= 10 ? 2 : 3, r = R.rng, act = actOf(fl), hist = R.history.filter(h => actOf(h.fl) === act).map(h => h.kind);
    const opts = [];
    const rwPick = () => wsel(['boon', 'power', 'gold', 'heal'], x => ({ boon: 50, power: 30, gold: 10, heal: 10 })[x], r);
    const pre = fl % 5 === 4, prevFight = !R.room || COMBAT(R.room.kind);
    const noRest = !!(R.chal && R.chal.mods.includes('sansrepos'));
    // un seul chemin : une salle sur deux des monstres ; sinon une énigme, une salle du Savoir ou une salle calme
    if (pre) return one(!hist.includes('repos') && !noRest ? { kind: 'repos' } : !hist.includes('marchand') ? { kind: 'marchand' } : { kind: 'enigme', rw: 'boon' });
    if (prevFight) {
      opts.push({ w: 46, d: () => ({ kind: 'enigme', rw: wsel(['boon', 'power', 'gold'], x => ({ boon: 55, power: 30, gold: 15 })[x], r) }) });
      opts.push({ w: 30, d: () => ({ kind: 'savoir' }) });
      if (fl >= 3) opts.push({ w: 6, d: () => ({ kind: 'autel' }) });
      if (!hist.includes('marchand')) opts.push({ w: 10, d: () => ({ kind: 'marchand' }) });
    } else {
      opts.push({ w: 70, d: () => ({ kind: 'combat', rw: rwPick() }) });
      if (fl >= 2) opts.push({ w: 18, d: () => ({ kind: 'elite', rw: 'boon' }) });
      if (fl >= 6) opts.push({ w: 10, d: () => ({ kind: 'defi', rw: 'leg', mod: BR.pick(Object.keys(Q.DEFIS), r) }) });
    }
    return one(wsel(opts, x => x.w, r).d());
  }
  const THEMES = ['duel', 'titan', 'hydra', 'spider', 'eye', 'knight', 'beast', 'frost', 'storm'];
  const BMUS = ['arene_menu', 'arene_menu', 'duel', 'duel', 'boss_hydra', 'boss_eye', 'boss_spider', 'boss_titan', 'boss_spider', 'boss_eye'];
  const HMUS = ['boss_spider', 'boss_hydra', 'duel', 'boss_eye', 'boss_titan'];
  function buildRoom(fl, door) {
    const r = R.rng, n = nPlayers(), nMul = 1 + 0.75 * (n - 1), palHp = R.pal >= 1 ? 1.2 : 1, flK = 1 + 0.16 * (fl - 1);
    const room = { fl, kind: door.kind === 'combat' ? 'horde' : door.kind, rw: door.rw || null, mod: door.mod || null, seed: (r() * 2 ** 31) >>> 0, faces: AU.pickFaces(8), gold: 0 };
    const diff = { id: 'asc', name: 'Étage ' + fl, color: Q.palCol(R.pal), hp: 1, dmg: (0.7 + 0.05 * (fl - 1)) * (R.pal >= 4 ? 1.15 : 1), speed: 1 + 0.015 * fl, reward: 1, tier: fl >= 9 ? 2 : fl >= 5 ? 1 : 0 };
    const unused = list => { const l = list.filter(id => !R.used.includes(id)); return l.length ? l : list; };
    const affPick = (k, excl) => { const all = Object.keys(Q.AFFIX).filter(a => !(excl || []).includes(a)); return BR.shuffle(all, r).slice(0, k); };
    if (room.kind === 'horde' || room.kind === 'defi') {
      room.boss = 'horde'; room.waves = BR.ABoss.hordeWaves(fl, n, r, R.pal >= 6, room.mod);
      room.mhp = flK * palHp * (1 + 0.45 * (n - 1)); room.theme = BR.pick(THEMES, r); room.music = BR.pick(HMUS, r);
      room.gold = 30 + 6 * fl + (room.kind === 'defi' ? 70 : 0);
      room.title = room.kind === 'defi' ? 'DÉFI — ' + Q.DEFIS[room.mod].n.toUpperCase() : 'ÉTAGE ' + fl;
      if (room.kind === 'horde' && fl >= 2) { const x = r(); room.obj = x < 0.25 ? 'survie' : x < 0.45 ? 'totems' : null; }
      room.sub = room.kind === 'defi' ? Q.DEFIS[room.mod].d : room.obj === 'survie' ? 'Tiens bon jusqu\'à la fin du compte à rebours' : room.obj === 'totems' ? 'Détruis les 3 totems maudits' : 'Repousse toutes les vagues';
      if (Q._forceObj !== undefined && room.kind === 'horde') room.obj = Q._forceObj;   // outil de test (console)
      if (room.obj) room.gold += 20;
    } else if (room.kind === 'elite') {
      room.boss = BR.pick(unused(AR.BOSSES.map(b => b.id)), r); R.used.push(room.boss);
      room.aff = affPick(R.pal >= 2 ? 2 : 1, ['enrage']);
      room.bossHp = Math.round(AR.boss(room.boss).hp * (fl <= 3 ? 0.2 : 0.26) * flK * palHp * nMul * (room.aff.includes('geant') ? 1.3 : 1));
      if (room.aff.includes('geant')) diff.dmg *= 1.15;
      room.gold = 55 + 8 * fl; room.title = 'ÉLITE — ' + AR.boss(room.boss).name; room.sub = room.aff.map(a => Q.AFFIX[a].n).join(' · ');
    } else if (room.kind === 'gardien' || room.kind === 'final') {
      const pool = room.kind === 'final' ? AR.BOSSES.map(b => b.id) : fl === 5 ? ['titan', 'spider', 'knight', 'beast'] : ['hydra', 'eye', 'frost', 'storm'];
      room.boss = BR.pick(unused(pool), r); R.used.push(room.boss);
      room.aff = room.kind === 'final' ? ['geant', 'frenetique'].concat(R.pal >= 10 ? affPick(1, ['geant', 'frenetique']) : []) : R.pal >= 5 ? ['enrage'] : [];
      const k = room.kind === 'final' ? 1.0 : fl === 5 ? 0.4 : fl > Q.FLOORS ? 0.66 * (1 + 0.12 * (fl - Q.FLOORS)) : 0.66;
      room.bossHp = Math.round(AR.boss(room.boss).hp * k * palHp * (R.pal >= 8 ? 1.25 : 1) * nMul * (room.aff.includes('geant') ? 1.3 : 1));
      if (room.aff.includes('geant')) diff.dmg *= 1.12;
      if (room.kind === 'final') diff.tier = 2;
      room.gold = room.kind === 'final' ? 0 : 120;
      room.title = room.kind === 'final' ? 'LE COLOSSE ASCENDANT' : 'GARDIEN — ' + AR.boss(room.boss).name;
      room.sub = room.kind === 'final' ? AR.boss(room.boss).name + ' · ' + room.aff.map(a => Q.AFFIX[a].n).join(' · ') : room.aff.length ? room.aff.map(a => Q.AFFIX[a].n).join(' · ') : AR.boss(room.boss).sub;
      room.rw = room.kind === 'gardien' ? 'boon' : null;
    }
    if (R.chal) { const md = R.chal.mods; if (md.includes('acier')) { if (room.mhp) room.mhp *= 1.4; if (room.bossHp) room.bossHp = Math.round(room.bossHp * 1.3); } if (md.includes('furie')) { diff.dmg *= 1.25; diff.speed *= 1.12; } }
    room.diff = diff;
    if (room.kind === 'enigme' && BR.Dungeon) {
      const ids = Object.keys(BR.Dungeon.PUZZLES), used = R.usedPuz = R.usedPuz || [], fresh = ids.filter(i => !used.includes(i));
      room.puz = BR.pick(fresh.length ? fresh : ids, r); used.push(room.puz);
      const PZ = BR.Dungeon.PUZZLES[room.puz]; room.title = 'ÉNIGME — ' + PZ.n.toUpperCase(); room.sub = PZ.d; room.gold = 25 + 4 * fl; room.rw = room.rw || 'boon'; room.music = 'arene_menu';
    }
    if (room.kind === 'savoir' && BR.Dungeon) {
      const ids = Object.keys(BR.Dungeon.QUIZ), last = R.lastQuiz, fresh = ids.filter(i => i !== last);
      room.quiz = BR.pick(fresh.length ? fresh : ids, r); R.lastQuiz = room.quiz;
      const QZ = BR.Dungeon.QUIZ[room.quiz]; room.title = QZ.n.toUpperCase(); room.sub = QZ.d; room.gold = 30 + 5 * fl; room.music = 'arene_menu';
    }
    if (room.kind === 'repos' || room.kind === 'marchand' || room.kind === 'autel') room.music = room.kind === 'autel' ? 'boss_eye' : 'arene_menu';
    if (room.kind === 'elite') room.rw = 'boon';
    // le monde de l'étage : de la prairie (1) au Néant (10)
    room.theme = Q.biomeOf(fl); if (fl > Q.FLOORS) room.inf = true;
    if (BR.Dungeon) {
      room.dg = 1; room.map = R.map;   // chaque étage est une salle fermée du donjon de la carte choisie
      const MK = BR.Dungeon.mapOf(R.map).diff;
      if (room.mhp) room.mhp *= MK; if (room.bossHp) room.bossHp = Math.round(room.bossHp * MK);
      diff.dmg *= 0.6 + 0.4 * MK; diff.speed *= 0.95 + 0.05 * MK;
    }
    if (room.boss === 'horde') room.music = BMUS[fl - 1] || room.music;
    return room;
  }
  // outil de test (console) : ouvrir directement une salle — Q._testRoom('enigme', { puz: 'gouffre' })
  Q._testRoom = function (kind, o) {
    if (!R) return 'pas de course en cours';
    const room = buildRoom(R.floor + 1, Object.assign({ kind }, o || {}));
    if (o && o.puz && BR.Dungeon.PUZZLES[o.puz]) { const PZ = BR.Dungeon.PUZZLES[o.puz]; room.puz = o.puz; room.title = 'ÉNIGME — ' + PZ.n.toUpperCase(); room.sub = PZ.d; }
    if (o && o.quiz && BR.Dungeon.QUIZ[o.quiz]) { const QZ = BR.Dungeon.QUIZ[o.quiz]; room.quiz = o.quiz; room.title = QZ.n.toUpperCase(); room.sub = QZ.d; }
    beginFloor(R.floor + 1, room);
    return room.kind + ' ' + (room.puz || room.quiz || '');
  };
  function startFloor(fl, door, di) {
    if (door && door.kind === 'fin') { send({ k: 'qe', win: 1, fin: 1 }); winNow(); return; }
    if (door && door.kind === 'infini') door = { kind: 'combat', rw: 'boon', room: door.room };
    const room = (door && door.room) || buildRoom(fl, door);
    send({ k: 'qf', fl, room, di });
    goFloor(fl, room, di);
  }
  // tout le monde est aspiré dans le portail choisi, puis l'étage suivant commence
  function goFloor(fl, room, di) {
    if (R.going === fl) return; R.going = fl;
    capture();
    const S0 = BR.Arena.session();
    if (S0 && S0.env && S0.env.dungeon && BR.Dungeon && BR.Dungeon.takeNext(S0.env, room)) { beginFloor(fl, room, true); return; }
    if (Q.W.alive() && di != null && Q.W.portalList().length) Q.W.suck(di, () => beginFloor(fl, room));
    else beginFloor(fl, room);
  }
  // PV et ultime emportés d'un étage à l'autre
  // victoire (retour au village après le colosse) : on ferme l'arène, la fin de course compte comme gagnée
  function winNow() { if (!R || R.ended) return; R.forceWin = true; if (BR.Arena.active) BR.Arena.finish({ win: true }); else endRun({ win: true }); }
  function capture() {
    const S = BR.Arena.session(); if (!S || !S.me) return;
    M.hpK = S.me.alive ? BR.clamp(S.me.hp / Math.max(1, S.me.maxHp), 0.05, 1) : 0.3; M.ultC = S.me.ult || 0;
    if (!R.postDone && S.me.stats) { M.stats.dmg += Math.round(S.me.stats.dmg || 0); R.postDone = true; }
  }

  /* =====================================================================
     ÉTAGES
     ===================================================================== */
  const COMBAT = k => k === 'horde' || k === 'defi' || k === 'elite' || k === 'gardien' || k === 'final';
  const PUZ = k => k === 'enigme' || k === 'savoir';
  function beginFloor(fl, room, swap) {
    if (!R || R.ended) return;
    R.floor = fl; R.room = room; if (room.inf) R.inf = true; R.doors = null; R.votes = {}; R.done = false; R.offer = null; R.pend = null; R.shop = null; R.altar = null;
    R.history.push({ fl, kind: room.kind === 'horde' ? 'combat' : room.kind });
    M.cleared = Math.max(M.cleared, fl - 1);
    M.rerolls = M.meta.relance || 0;
    R.rewardTaken = false; R.postDone = false; R.portalsUp = -1;
    {
      R.phase = 'fight';
      const roster = R.solo ? R.roster : (N.room ? N.room.players.filter(p => R.P[p.id] && !R.P[p.id].gone).map(p => ({ id: p.id, name: p.name, look: p.look, level: p.level })) : R.roster);
      BR.$$('.modal-back').forEach(m => m.remove());
      BR.MenuBG.stop(); AU.bg(false);
      try {
        const opts = { mode: 'boss', boss: COMBAT(room.kind) ? room.boss : null, diffObj: room.diff, seed: room.seed, roster, selfId: R.selfId, hostId: R.hostId, solo: R.solo, faces: room.faces, theme: room.theme, onEnd: onFloorEnd,
          asc: { floor: fl, room, obj: room.obj || null, kit: kitObj(), waves: room.waves, mhp: room.mhp, bossHp: room.bossHp, mod: room.mod, music: room.music } };
        if (!(swap && BR.Arena.swapRoom && BR.Arena.swapRoom(opts))) BR.Arena.start(opts);
      } catch (e) { console.error(e); document.body.classList.remove('inarena'); toast('Erreur au lancement de l\'étage : ' + e.message); endRun({ win: false, aborted: true, why: 'Erreur : ' + e.message }); }
    }
  }
  function onFloorEnd(sum) {
    if (!R || R.ended) return;
    const r = sum.res || {};
    const fd = Math.round((sum.me && sum.me.dmg) || 0);
    if (!R.postDone) { M.stats.dmg += fd; R.postDone = true; }
    (R.floorDmg[R.floor] = R.floorDmg[R.floor] || {})[R.selfId] = fd;
    M.ultC = sum.ult || 0;
    if (r.quit) {
      if (isHost() && !R.solo) send({ k: 'qe', win: 0, why: (Acc.p.name || 'L\'hôte') + ' a abandonné.' });
      else if (!R.solo) { try { N.leave(); } catch (e) {} }   // les autres continuent sans moi
      endRun({ win: false, quit: true }); return;
    }
    if (r.aborted) { endRun({ win: false, aborted: true, why: r.reason || 'Partie interrompue.' }); return; }
    M.hpK = sum.alive ? BR.clamp(sum.hp / Math.max(1, sum.maxHp), 0.05, 1) : 0.3;
    const st = Object.assign({}, M.stats, { nboons: Object.keys(M.boons).length, curses: M.curses.length });
    if (!r.win && !R.forceWin) { send({ k: 'qx', fl: R.floor, fd, st }); endRun({ win: !!R.wonFinal }); return; }
    send({ k: 'qx', fl: R.floor, fd, st }); R.P[R.selfId].st = st;
    M.cleared = Math.max(M.cleared, R.floor);
    endRun({ win: R.floor >= Q.FLOORS || !!R.wonFinal });
  }
  /* =====================================================================
     DANS L'ARÈNE : étage nettoyé → reliques + portails ; salles (feu de camp, marchand, autel)
     ===================================================================== */
  const ARC = (n, rr, z) => { const out = []; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * rr; out.push(new THREE.Vector3(x, 0, (z || 0) - Math.abs(x) * 0.25)); } return out; };
  Q.postFloor = function (S) {
    if (!R || R.ended || R.cleared === R.floor) return;
    R.cleared = R.floor;
    const fd = Math.round(S.me.stats.dmg || 0); (R.floorDmg[R.floor] = R.floorDmg[R.floor] || {})[R.selfId] = fd;
    M.stats.dmg += fd; R.postDone = true;
    const g = addGold(R.room.gold || 0); R.lastGold = g;
    M.cleared = R.floor; if (R.room.kind !== 'horde' && R.room.kind !== 'defi') M.bosses++;
    Q.emit && Q.emit('floor', R.floor, R.room.kind, M, R.solo, R.room.boss);
    const st = Object.assign({}, M.stats, { nboons: Object.keys(M.boons).length, curses: M.curses.length });
    send({ k: 'qx', fl: R.floor, fd, st }); R.P[R.selfId].st = st;
    if (R.floor === Q.FLOORS && !R.inf) {
      floorBoard(S); R.rewardTaken = true; R.wonFinal = true;
      BR.Arena.banner('CARTE TERMINÉE !', 'Rentre en héros… ou continue dans l\'Infini', 4, 'gold');
      if (isHost()) { const d = { kind: 'infini' }; d.room = buildRoom(R.floor + 1, { kind: 'combat', rw: 'boon' }); const doors = [d]; send({ k: 'qd', fl: R.floor + 1, doors }); setDoors(R.floor + 1, doors); } else placePortals();
      const O = (S.env && S.env.rewardAt) ? S.env.rewardAt.clone() : new THREE.Vector3();
      Q.W.relic(O, { t: 'home' }, () => { send({ k: 'qe', win: 1, fin: 1 }); winNow(); });
      setTimeout(() => { if (Q.W.alive()) Q.W.unseal(); }, 600);
      return;
    }
    floorBoard(S);
    if (M.meta.recup) healNow(0.04 * M.meta.recup);
    spawnReward(S);
    if (isHost()) { const doors = makeDoors(R.floor + 1); send({ k: 'qd', fl: R.floor + 1, doors }); setDoors(R.floor + 1, doors); }
    else placePortals();
  };
  // mon ultime, mes PV : la récompense de soin agit tout de suite
  function healNow(k) { const S = BR.Arena.session(); if (S && S.me.alive) { const h = S.me.maxHp * k; S.me.hp = Math.min(S.me.maxHp, S.me.hp + h); S.fx.num(S.me.center(), '+' + Math.round(h), { color: '#7dff9a' }); BR.Audio.fx('heal'); } }
  function takeItem(it, done) {
    if (it.t === 'new' && AR.skill(it.id).type === 'skill' && !M.skills.includes(null)) { Q.W.askReplace(slot => { applyItem(it, slot); done(); }); return; }
    applyItem(it);
    // retour immédiat : bandeau « ESQUIVE — Pas de foudre » et barre du haut à jour
    const S = BR.Arena.session();
    if (S && S.hud && S.asc) { const top = S.hud.querySelector('.asc-top'); if (top) top.innerHTML = Q.hudTop(S.asc); }
    if (it.t === 'boon') { const B = Q.boon(it.id); if (B) BR.Arena.banner(Q.SLOTS[B.s].n.toUpperCase(), B.n + ((M.boons[B.id] || 0) > 1 ? ' — niveau ' + M.boons[B.id] : ''), 1.8, 'gold'); }
    if (it.t === 'heal') healNow(it.v);
    if (it.t === 'heart') healNow(0.5);
    done();
  }
  function rewardTaken() { R.rewardTaken = true; Q.W.clearRelics('reward'); Q.W.unseal(); ready(phaseTag()); }
  // rareté du coffre de fin de combat
  function rollTier(ctx) {
    const W = ctx === 'leg' ? { epique: 55, legendaire: 45 } : ctx === 'elite' ? { rare: 50, epique: 38, legendaire: 12 } : { commun: 62, rare: 27, epique: 9, legendaire: 2 };
    if (ctx === 'normal' && R.floor >= 8) { W.commun = 48; W.rare = 34; W.epique = 14; W.legendaire = 4; }
    if (M.meta.legend && W.legendaire) W.legendaire *= 1 + 0.8 * M.meta.legend;
    const ks = Object.keys(W); let t = wsel(ks, k => W[k]);
    const up = { commun: 'rare', rare: 'epique', epique: 'legendaire', legendaire: 'legendaire' };
    if (Math.random() < 0.05 * (M.meta.coffre || 0) + 0.1 * Math.max(0, (M.meta.relance || 0) - 1)) t = up[t];
    if (R.chal && R.chal.mods.includes('fortune')) t = { commun: 'rare', rare: 'epique', epique: 'legendaire', legendaire: 'legendaire' }[t];
    return t;
  }
  function spawnReward(S, ctxOver) {
    const ctx = ctxOver || (R.room.kind === 'elite' || R.room.kind === 'gardien' ? 'elite' : R.room.kind === 'defi' ? 'leg' : 'normal');
    const O = (S.env && S.env.rewardAt) ? S.env.rewardAt.clone() : new THREE.Vector3(), RWd = (S.env && S.env.rewardW) || 14, at = v => v.add(O);
    const tier = rollTier(ctx);
    const offer = buildOffer(R.room.rw || 'boon', ctx, tier);
    const show = () => {
      Q.W.clearRelics('reward');
      if (offer.rw === 'gold') { Q.W.chest(at(new THREE.Vector3(0, 0, 0)), offer.items[0].v, o => { o.open = true; addGold(offer.items[0].v); S.fx.burst(o.pos.clone().setY(1), { n: 60, color: 0xffc83a, speed: 8, up: 1.5, life: 1 }); BR.Audio.fx('reveal', { rate: 1.3 }); setTimeout(rewardTaken, 600); }); return; }
      const pts = ARC(offer.items.length, 4.2, 1.2);
      offer.items.forEach((it, i) => Q.W.relic(at(pts[i]), it, () => takeItem(it, rewardTaken)));
      if (offer.items.length > 1) BR.Arena.banner('CHOISIS UNE RÉCOMPENSE', 'Approche-toi pour lire, E pour prendre', 2.2, 'gold');
    };
    if (offer.rw === 'gold' || offer.rw === 'heal' || !Q.W.lootChest) show();
    else Q.W.lootChest(at(new THREE.Vector3(0, 0, -3.2)), tier, () => { Q.emit && Q.emit('chest', tier); show(); });
    if (!offer.items.length) rewardTaken();
    // la forge : en plus, un pouvoir gagne un niveau (on en choisit un parmi 3 ; facultatif, ne bloque pas les portails)
    // la forge : un de tes pouvoirs gagne un niveau, tout seul (plus rien à choisir au sol)
    const up1 = BR.shuffle(M.skills.filter(Boolean).concat(M.ult ? [M.ult] : []).filter(id => (M.lv[id] || 1) < AR.MAXLV))[0];
    if (up1) setTimeout(() => { if (!R || R.ended) return; applyItem({ t: 'up', id: up1 }); if ((M.meta.forge || 0) && Math.random() < 0.15 * M.meta.forge && (M.lv[up1] || 1) < AR.MAXLV) applyItem({ t: 'up', id: up1 }); BR.Arena.banner('FORGE', Q.skillName(up1, M.cls) + ' passe au niveau ' + M.lv[up1], 1.8, 'gold'); }, 2600);
    const ups = [];
    if (ups.length) { const fx0 = -Math.min(11.5, RWd - 2), fp = ups.map((_, i) => at(new THREE.Vector3(fx0 + Math.abs(i - (ups.length - 1) / 2) * 1.2, 0, (i - (ups.length - 1) / 2) * 3.8))); ups.forEach((id, i) => Q.W.relic(fp[i], { t: 'up', id }, () => { applyItem({ t: 'up', id }); Q.W.clearRelics('forge'); BR.Arena.banner('FORGE', Q.skillName(id, M.cls) + ' — niveau ' + M.lv[id], 1.6, 'gold'); }, { tag: 'forge' })); }
  }
  // tableau des dégâts de l'étage (à plusieurs), en surimpression quelques secondes
  function floorBoard(S) {
    if (R.solo) return;
    setTimeout(() => {
      if (BR.Arena.session() !== S) return;
      const fd = R.floorDmg[R.floor] || {}, ids = Object.keys(fd).sort((a, b) => fd[b] - fd[a]); if (ids.length < 2) return;
      const top = fd[ids[0]] || 1, quips = ['a surtout admiré le paysage', 'faisait la sieste', 'était en pause café', 'cherchait le bouton attaque', 'a encouragé de loin'];
      const el = BR.el('div', { class: 'asc-board', html: `<b>Dégâts de l'étage</b>${ids.map((id, i) => `<div class="${i === 0 ? 'mvp' : ''}"><span>${i === 0 ? BR.Icons.svg('crown', 13, 'gold') + ' ' : ''}${esc(R.P[id] ? R.P[id].name : '?')}</span><i><i style="width:${Math.round(fd[id] / top * 100)}%"></i></i><em>${BR.fmt(fd[id])}</em></div>${i === ids.length - 1 && fd[id] < top * 0.35 ? `<p>${quips[R.floor % quips.length]}</p>` : ''}`).join('')}` });
      S.hud.appendChild(el); setTimeout(() => el.classList.add('out'), 7000); setTimeout(() => el.remove(), 8000);
    }, 1800);
  }
  // salles sans combat (appelé au début de l'étage par asc-combat)
  Q.roomStart = function (S) {
    const k = R.room.kind;
    Q.W.room(k, R.room);
    if (PUZ(k) && BR.Dungeon && S.env && S.env.dungeon) {
      BR.Dungeon.startRoom(S, R.room, {
        // énigme résolue (score = 1) ; Savoir : score = part de bonnes réponses
        solved(score) {
          if (R.cleared === R.floor) return; R.cleared = R.floor;
          score = score == null ? 1 : score;
          const g = addGold(Math.round((R.room.gold || 30) * (k === 'savoir' ? score * (1 + 0.1 * (M.meta.savoir || 0)) : 1 + 0.12 * (M.meta.mecano || 0)))); R.lastGold = g;
          if (M.meta.recup) healNow(0.04 * M.meta.recup);
          M.cleared = Math.max(M.cleared, R.floor);
          Q.emit && Q.emit('floor', R.floor, k, M, R.solo, null);
          if (k === 'savoir') {
            Q.emit && Q.emit('quiz', score);
            if (score <= 0) { rewardTaken(); return; }
            R.room.rw = score >= 0.99 ? 'leg' : score >= 0.6 ? 'boon' : 'gold';
            spawnReward(S, score >= 0.99 ? 'leg' : 'normal');
          } else spawnReward(S);
        },
        // on passe son chemin (sans récompense) : les portes s'ouvrent
        skip() { if (R.cleared === R.floor) return; R.cleared = R.floor; rewardTaken(); },
      });
    }
    if (k === 'repos') {
      const heal = (R.pal >= 3 ? 0.25 : 0.4) + 0.08 * (M.meta.feu || 0), pts = [new THREE.Vector3(-5, 0, 2.5), new THREE.Vector3(0, 0, 5), new THREE.Vector3(5, 0, 2.5)];
      const ups = () => M.skills.filter(Boolean).concat(M.ult ? [M.ult] : []).filter(id => (M.lv[id] || 1) < AR.MAXLV);
      const bups = () => Object.keys(M.boons).filter(id => M.boons[id] < Q.boon(id).max);
      const done = () => { Q.W.clearRelics('reward'); R.rewardTaken = true; };
      const pick = (list, mk) => { Q.W.clearRelics('reward'); const p2 = ARC(list.length, 3.6, 4); list.slice(0, 5).forEach((x, i) => Q.W.relic(p2[i], mk(x), o => { applyItem(o.it); done(); })); };
      Q.W.relic(pts[0], { t: 'rest', v: heal }, () => { M.hpK = Math.min(1, M.hpK + heal); healNow(heal); done(); });
      if (ups().length) Q.W.relic(pts[1], { t: 'forge' }, () => pick(ups(), id => ({ t: 'up', id })));
      if (bups().length) Q.W.relic(pts[2], { t: 'medit' }, () => pick(bups(), id => ({ t: 'boon', id })));
    }
    if (k === 'marchand') {
      const kk = (R.pal >= 7 ? 1.35 : 1) * (1 - 0.06 * (M.meta.marchand || 0)), price = r => Math.round(({ commun: 70, rare: 110, epique: 165, legendaire: 250 })[r] * kk);
      const items = drawBoons('shop', 2).concat(drawBoons('normal', 1)).map(it => ({ it, p: price(Q.boon(it.id).r) }));
      const pw = drawPowers(1)[0]; if (pw) items.push({ it: pw, p: Math.round((pw.t === 'up' ? 90 : 120) * kk) });
      items.push({ it: { t: 'heal', v: 0.35 }, p: Math.round(55 * kk) });
      const pts = ARC(items.length, 3.4, 2.2);
      items.forEach((x, i) => Q.W.relic(pts[i], x.it, () => { M.gold -= x.p; M.stats.spent += x.p; BR.Audio.ui('buy'); takeItem(x.it, () => {}); }, { price: x.p, tag: 'shop' }));
      R.rewardTaken = true;
    }
    if (k === 'autel') {
      const curse = BR.pick(Q.CURSES.filter(c => !M.curses.includes(c.id))) || Q.CURSES[0];
      Q.W.relic(new THREE.Vector3(0, 0, 0.8), { t: 'pact', curse }, () => {
        M.curses.push(curse.id); M.stats.curses++; BR.Audio.fx('boom', { g: 0.5, rate: 0.7 }); BR.Arena.banner('PACTE SCELLÉ', curse.n + ' — choisis ta récompense', 2, 'evo');
        const items = drawBoons('leg', 3), p2 = ARC(items.length, 4.2, -2);
        items.forEach((it, i) => Q.W.relic(p2[i], it, () => takeItem(it, () => Q.W.clearRelics('reward'))));
      });
      R.rewardTaken = true;
    }
    if (isHost()) { const doors = makeDoors(R.floor + 1); send({ k: 'qd', fl: R.floor + 1, doors }); setDoors(R.floor + 1, doors); }
    else placePortals();
  };
  Q.isRoom = () => R && R.room && !COMBAT(R.room.kind);

  function finishStep() {
    // ma part de l'étape est faite : prêt, puis les portes (si l'hôte les a déjà envoyées) ou l'attente
    R.offer = null; R.pend = null;
    R.phase = R.doors && R.doors.fl === R.floor + 1 ? 'doors' : 'wait';
    ready(phaseTag()); render();
  }

  /* ---------- marchand ---------- */
  function makeShop() {
    const k = R.pal >= 7 ? 1.35 : 1, price = r => Math.round(({ commun: 70, rare: 110, epique: 165, legendaire: 250 })[r] * k);
    const items = drawBoons('shop', 2).concat(drawBoons('normal', 1)).map(it => ({ it, p: price(Q.boon(it.id).r) }));
    const pw = drawPowers(1)[0]; if (pw) items.push({ it: pw, p: Math.round((pw.t === 'up' ? 90 : 120) * k) });
    items.push({ it: { t: 'heal', v: 0.35 }, p: Math.round(55 * k) });
    return { items, rerollP: Math.round(30 * k) };
  }

  /* =====================================================================
     FIN DE COURSE
     ===================================================================== */
  function endRun(o) {
    if (!R || R.ended) return;
    R.ended = true; R.result = o; clearInterval(R.timer);
    if (isHost() && !R.solo && N.room) { try { N.send({ t: 'end', res: { arena: 1 } }); } catch (e) {} }
    const D = Q.data(), reached = o.win ? Q.FLOORS : Math.max(0, R.floor - (o.win ? 0 : 1));
    const palK = 1 + 0.15 * R.pal;
    const mapK = [1, 1.25, 1.5, 1.8, 2.2][((BR.Dungeon && BR.Dungeon.mapOf(R.map).lvl) || 1) - 1] || 1;
    const shards = Math.round((M.cleared * 8 + M.bosses * 20 + (o.win ? 120 : 0)) * palK * mapK * (1 + 0.08 * (M.meta.moisson || 0)) * (o.quit ? 0.5 : 1));
    // carte terminée : la suivante se débloque
    if (o.win && !R.chal && BR.Dungeon) { const lv = BR.Dungeon.mapOf(R.map).lvl; D.st = D.st || {}; if (lv > (D.st.mapmax || 0)) { D.st.mapmax = lv; R.newMap = lv < BR.Dungeon.MAPS.length ? BR.Dungeon.MAPS[lv] : null; } }
    const pts = Math.round((M.cleared * 45 + M.bosses * 60 + (o.win ? 300 : 0)) * palK * (o.quit ? 0.5 : 1));
    const xp = Math.round((M.cleared * 70 + (o.win ? 400 : 0)) * palK * (o.quit ? 0.5 : 1));
    const before = Acc.level();
    const cxp = Math.round((M.cleared * 100 + M.bosses * 150 + (o.win ? 600 : 0)) * palK * (o.quit ? 0.5 : 1));
    if (M.cls && D.cls[M.cls]) D.cls[M.cls].xp += cxp;
    if (R.inf) D.inf = Math.max(D.inf || 0, M.cleared);
    if (R.chal) { const wk = D.wk && D.wk.key === R.chal.key ? D.wk : { key: R.chal.key, fl: 0, t: 0 }, t = Math.round((performance.now() - R.t0) / 1000); if (M.cleared > wk.fl || (M.cleared === wk.fl && M.cleared > 0 && (!wk.t || t < wk.t))) { wk.fl = M.cleared; wk.t = t; } D.wk = wk; }
    D.sh += shards; D.runs++; D.best[R.pal] = Math.max(D.best[R.pal] || 0, M.cleared);
    let newPal = false;
    if (o.win) { D.wins++; if (R.pal >= D.pal && R.pal < 10) { D.pal = R.pal + 1; newPal = true; } const t = Math.round((performance.now() - R.t0) / 1000); if (!D.fast || t < D.fast) D.fast = t; }
    Acc.p.points += pts; Acc.p.xp += xp; Acc.p.stats.games++; if (R.solo) Acc.p.stats.solo++; else Acc.p.stats.multi++;
    Q.saveData();
    Q.emit && Q.emit('runEnd', o, M, D);
    R.rewards = { inf: R.inf ? M.cleared : 0, chal: R.chal ? { fl: M.cleared, best: D.wk.fl } : null, cxp, cls: M.cls, shards, pts, xp, newPal, before, after: Acc.level(), reached, time: (performance.now() - R.t0) / 1000 };
    R.phase = 'end';
    UI.show('asc-end');
  }
  Q.leave = function () { if (R) { clearInterval(R.timer); R.ended = true; } stopListen(); R = null; };

  /* =====================================================================
     ÉCRANS
     ===================================================================== */
  function toast(t, k) { UI.toast(t, k); }
  const SW = `<svg viewBox="0 0 24 24" width="$" height="$" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l10 10M4 4h4M4 4v4M20 4L10 14M20 4h-4M20 4v4M6.5 16.5l-3 3M17.5 16.5l3 3M8 13l3 3M16 13l-3 3"/></svg>`;
  function kindIcon(k, sz) {
    const K = KIND[k] || KIND.combat; sz = sz || 22;
    if (K.icon === 'swords') return SW.replace(/\$/g, sz);
    if (K.icon === 'fire') return Q.glyph('braise', sz, 'currentColor');
    if (K.icon === 'coin') return Q.coinSvg(sz);
    if (K.icon === 'curse') return Q.glyph('maudit', sz, 'currentColor');
    if (K.icon === 'gear' || K.icon === 'bulb') return ICO(K.icon, sz);
    return ICO(K.icon, sz);
  }
  function tower() {
    let h = '';
    for (let f = 1; f <= Q.FLOORS; f++) {
      const past = R.history.find(x => x.fl === f), cur = f === R.floor, fixed = f === 5 || f === 10 || f === Q.FLOORS;
      const k = past ? past.kind : fixed ? (f === Q.FLOORS ? 'final' : 'gardien') : null;
      h += `<div class="tw ${past ? 'past' : ''} ${cur ? 'cur' : ''} ${fixed ? 'boss' : ''}" style="--kc:${k ? KIND[k].col : '#556'}" title="Étage ${f}${k ? ' — ' + KIND[k].n : ''}"><i>${k ? kindIcon(k, 14) : '?'}</i><span>${f}</span></div>`;
      if (f < Q.FLOORS) h += '<em class="tw-l ' + (R.floor > f ? 'on' : '') + '"></em>';
    }
    return h;
  }
  function boonChips(b, c, sz) {
    return Object.keys(b || {}).map(id => { const B = Q.boon(id); return B ? `<span class="bc r-${B.r}" style="--fc:${Q.FAM[B.f].col}" title="${esc(B.n)} (niv. ${b[id]})">${Q.glyph(B.f, sz || 15)}${b[id] > 1 ? `<em>${b[id]}</em>` : ''}</span>` : ''; }).join('') +
      (c || []).map(id => { const C = Q.curse(id); return C ? `<span class="bc cur" title="${esc(C.n)}">${Q.glyph('maudit', sz || 15)}</span>` : ''; }).join('');
  }
  function party() {
    return active().map(id => {
      const P = R.P[id], me = id === R.selfId, pb = me ? pub() : (P.pub || {}), tag = phaseTag();
      const rd = R.phase === 'fight' ? '' : R.doors && R.votes[id] != null ? `<b class="pv-ok">${ICO('check', 13)} a voté</b>` : P.rd === tag ? `<b class="pv-ok">${ICO('check', 13)} prêt</b>` : '<b class="pv-w">choisit…</b>';
      const W = AR.WEAPONS[pb.w || 'blade'];
      return `<div class="axp ${me ? 'me' : ''}">
        <img class="axp-a" src="${UI.thumb(P.look, 80, 100)}" alt="">
        <div class="axp-i"><div class="axp-n">${id === R.hostId && !R.solo ? ICO('crown', 13, 'gold') + ' ' : ''}${esc(P.name)}</div>
          <div class="axp-hp"><i style="width:${Math.round((pb.hp == null ? 1 : pb.hp) * 100)}%"></i></div>
          <div class="axp-w"><img src="${AU.weaponThumb(pb.w || 'blade')}" alt=""><span>${W ? W.name : ''}</span>${pb.g != null ? `<span class="axp-g">${Q.coinSvg(12)} ${pb.g}</span>` : ''}</div>
          <div class="axp-b">${boonChips(pb.b, pb.c, 13)}</div></div>
        ${R.solo ? '' : `<div class="axp-s">${rd}</div>`}</div>`;
    }).join('');
  }
  function boonCard(it, i, extra) {
    const B = Q.boon(it.id), F = Q.FAM[B.f], lv = (M.boons[B.id] || 0) + 1;
    return `<button class="axc boon r-${B.r}" data-pick="${i}" style="--fc:${F.col};--rc:${rcol(B.r)}">
      <div class="axc-rar">${BR.RARITY[B.r].label}${B.duo ? ' · DUO' : ''}</div>
      <div class="axc-ico">${Q.glyph(B.f, 64)}</div>
      <div class="axc-fam" style="color:${F.col}">${F.n}${B.duo ? ' + ' + Q.FAM[B.duo[1]].n : ''}</div>
      <b class="axc-n">${esc(B.n)}</b>
      <div class="axc-lv">${lv > 1 ? `Niveau ${lv - 1} → <b>${lv}</b>` : B.max > 1 ? 'Nouveau · niveau 1' : 'Nouveau'}</div>
      <p>${B.d(lv)}</p>${extra || ''}</button>`;
  }
  function powerCard(it, i, extra) {
    const s = AR.skill(it.id), up = it.t === 'up', lv = up ? (M.lv[s.id] || 1) + 1 : 1;
    const aw = up && (lv === 3 || lv === 5) ? `<div class="axc-aw">${ICO('bolt', 12)} Éveil : ${Q.awText(s.id, M.cls, lv)}</div>` : '';
    return `<button class="axc pow r-${s.rarity}" data-pick="${i}" style="--fc:${s.color};--rc:${rcol(s.rarity)}">
      <div class="axc-rar">${s.type === 'ult' ? 'ULTIME · ' : ''}${BR.RARITY[s.rarity].label}</div>
      <div class="axc-ico img"><img src="${AR.icon(s.id, 96)}" alt=""></div>
      <div class="axc-fam" style="color:${s.color}">${up ? 'Maîtrise' : s.type === 'ult' ? 'Nouvel ultime' : 'Nouveau pouvoir'}</div>
      <b class="axc-n">${esc(Q.skillName(s.id, M.cls))}</b>
      <div class="axc-lv">${up ? `Niveau ${lv - 1} → <b>${lv}</b> · +15 % dégâts` : 'Niveau 1'}</div>
      <p>${Q.skillDesc(s.id, M.cls)}</p>${aw}${extra || ''}</button>`;
  }
  function itemCard(it, i, extra) {
    if (it.t === 'boon') return boonCard(it, i, extra);
    if (it.t === 'new' || it.t === 'up') return powerCard(it, i, extra);
    if (it.t === 'gold') return `<button class="axc misc" data-pick="${i}" style="--fc:#ffd84a;--rc:#ffd84a"><div class="axc-rar">Trésor</div><div class="axc-ico">${Q.coinSvg(64)}</div><b class="axc-n">+${it.v} or</b><p>De quoi faire chauffer la carte bleue chez le marchand.</p>${extra || ''}</button>`;
    if (it.t === 'heart') return `<button class="axc misc" data-pick="${i}" style="--fc:#ff4a6a;--rc:#ff4a6a"><div class="axc-rar">Cœur de colosse</div><div class="axc-ico">${ICO('heart', 64)}</div><b class="axc-n">+120 PV max</b><p>Et tu récupères la moitié de tes PV.</p>${extra || ''}</button>`;
    if (it.t === 'heal') return `<button class="axc misc" data-pick="${i}" style="--fc:#7dff9a;--rc:#7dff9a"><div class="axc-rar">Potion</div><div class="axc-ico"><svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9.5 2.5h5M10 2.5v5.2L5.2 16.4A3.4 3.4 0 0 0 8.2 21.5h7.6a3.4 3.4 0 0 0 3-5.1L14 7.7V2.5"/><path d="M7 14.5h10l1.8 3.2a2 2 0 0 1-1.8 2.8H7a2 2 0 0 1-1.8-2.8z" fill="currentColor" opacity=".45" stroke="none"/><path d="M12 11.5v4M10 13.5h4"/></svg></div><b class="axc-n">Soin ${Math.round(it.v * 100)} %</b><p>Remet un peu d'ordre dans tes PV.</p>${extra || ''}</button>`;
    return '';
  }
  function hpLine() {
    const st = Q.computeStats(M), mx = st.maxHp + (M.bonusHp || 0);
    return `<div class="ax-hp"><i style="width:${Math.round(M.hpK * 100)}%"></i><span>${Math.round(M.hpK * mx)} / ${mx} PV</span></div>`;
  }
  // les PV bonus du cœur de colosse s'ajoutent aux PV calculés
  const baseCompute = Q.computeStats;
  Q.computeStats = function (m) { const st = baseCompute(m); st.maxHp += (m && m.bonusHp) || 0; return st; };

  /* ---------- l'écran de la course (toutes les étapes hors combat) ---------- */
  UI.screen('asc-x', {
    noTop: true,
    enter(n) {
      BR.curGame = 'arena'; BR.ascMode = true; AU.bg(true, R ? Q.biomeOf(R.floor || 1) : null); Au.track('music', 'arene_menu', 0.5);
      n.innerHTML = `<div class="asc-x"><div class="ax-head"></div><div class="ax-main"><div class="ax-party"></div><div class="ax-stage"></div></div></div>`;
      n.addEventListener('click', onClick);
      render();
    },
  });
  function render() {
    if (R && R.phase === 'end') { if (R.repaint) R.repaint(); return; }
    const n = BR.$('#s-asc-x'); if (!n || !R || UI.current() !== 'asc-x') return;
    const head = n.querySelector('.ax-head');
    head.innerHTML = `<div class="ax-logo"><small>COLOSSES</small><b>L'ASCENSION</b></div><div class="ax-tower">${tower()}</div>
      <div class="ax-biome">${biomeLabel()}</div><div class="ax-meta"><span class="ax-pal" style="color:${Q.palCol(R.pal)}">${Q.PALIERS[R.pal].n}</span><span class="ax-gold">${Q.coinSvg(18)} <b>${M.gold}</b></span>${hpLine()}<button class="btn ghost small" data-a="quit">Abandonner</button></div>`;
    const pt = `<h4>${R.solo ? 'Ton héros' : 'L\'équipe'}</h4>` + party() + `<div class="ax-mykit">${myKitHtml()}</div>`, pe = n.querySelector('.ax-party');
    if (pe._h !== pt) { pe._h = pt; pe.innerHTML = pt; }
    // l'étape n'est redessinée que si elle change, et l'apparition ne rejoue que quand on change d'étape
    const sh = stageHtml(), se = n.querySelector('.ax-stage'), key = R.phase + '|' + R.floor + '|' + (R.pend || '');
    if (se._h !== sh) { const anim = se._k !== key; se._k = key; se._h = sh; se.innerHTML = sh; if (!anim && se.firstElementChild) se.firstElementChild.classList.add('noanim'); }
  }
  Q.render = render;
  function biomeLabel() { if (BR.Dungeon && R.floor) return esc('La Citadelle — ' + BR.Dungeon.tierName(R.floor)); const b = Q.biomeOf(R.floor || 1); return R.floor ? esc(BR.ArenaScene.biomeName(b)) : ''; }
  function myKitHtml() {
    const sl = M.skills.map((id, i) => `<div class="mk-s ${id ? '' : 'empty'}" title="${id ? esc(AR.skill(id).name) + ' — niv. ' + (M.lv[id] || 1) : 'Emplacement libre'}">${id ? `<img src="${AR.icon(id, 64)}"><em>${M.lv[id] || 1}</em>` : ''}<span>${AR.key(AR.KEYS.skills[i])}</span></div>`).join('');
    const ul = `<div class="mk-s ult ${M.ult ? '' : 'empty'}" title="${M.ult ? esc(AR.skill(M.ult).name) : 'Pas encore d\'ultime'}">${M.ult ? `<img src="${AR.icon(M.ult, 64)}"><em>${M.lv[M.ult] || 1}</em>` : ''}<span>${AR.key(AR.KEYS.ult)}</span></div>`;
    return `<div class="mk-h">Tes pouvoirs</div><div class="mk-row">${sl}${ul}</div>`;
  }
  function floorTable() {
    const fd = R.floorDmg[R.floor]; if (!fd || R.solo) return '';
    const ids = active().filter(id => fd[id] != null).sort((a, b) => fd[b] - fd[a]); if (ids.length < 2) return '';
    const top = fd[ids[0]] || 1;
    const quips = ['a surtout admiré le paysage', 'faisait la sieste', 'était en pause café', 'cherchait le bouton attaque', 'a encouragé de loin'];
    return `<div class="ax-ft"><div class="ax-ft-h">Dégâts de l'étage</div>${ids.map((id, i) => `<div class="ax-fr ${i === 0 ? 'mvp' : ''}"><b>${i === 0 ? ICO('crown', 14, 'gold') + ' ' : ''}${esc(R.P[id].name)}</b><i><i style="width:${Math.round(fd[id] / top * 100)}%"></i></i><span>${BR.fmt(fd[id])}</span>${i === ids.length - 1 && fd[id] < top * 0.35 ? `<em>${quips[R.floor % quips.length]}</em>` : ''}</div>`).join('')}</div>`;
  }
  function stageHtml() {
    if (R.phase === 'start') {
      const S0 = R.start, CL = Q.CLASSES;
      return `<div class="ax-st"><h2>Choisis ta classe</h2><p class="muted">Chaque pouvoir change de forme selon ta classe : la même <b>Tempête de foudre</b> transforme le Chevalier en nuée d'orage, déchaîne un nuage pour le Mage et une pluie de flèches pour l'Archer.</p>
        <div class="ax-classes">${Object.values(CL).map(c => `<button class="ax-cl ${M.cls === c.id ? 'on' : ''}" data-cls="${c.id}" style="--cc:${c.col}">
          <div class="cl-art"><img src="${AU.weaponThumb(c.weapon)}" alt=""><i></i></div><b>${c.n}</b><span class="cl-w">${c.look}</span><p>${c.d}</p>
          <div class="cl-kit">${c.kit.concat([c.ult]).map((id, i) => `<div class="${i === 4 ? 'ult' : ''}" title="${esc(Q.skillDesc(id, c.id))}"><img src="${AR.icon(id, 56)}"><kbd>${AR.key(i === 4 ? AR.KEYS.ult : AR.KEYS.skills[i])}</kbd><span>${esc(Q.skillName(id, c.id))}</span></div>`).join('')}</div></button>`).join('')}</div>
        ${M.cls ? `<div class="cl-desc">${Q.CLASSES[M.cls].kit.concat([Q.CLASSES[M.cls].ult]).map(id => `<div><b>${esc(Q.skillName(id, M.cls))}</b><span>${esc(Q.skillDesc(id, M.cls))}</span></div>`).join('')}</div>` : ''}
        ${M.curses.length ? `<div class="ax-curse">${Q.glyph('maudit', 20)} <b>${esc(Q.curse(M.curses[0]).n)}</b> — ${esc(Q.curse(M.curses[0]).d)} <span class="muted">(palier 9)</span></div>` : ''}
        <div class="row center">${R.P[R.selfId].rd === 'start' ? `<div class="ax-wait"><div class="spin"></div>En attente des autres joueurs…</div>` : `<button class="btn primary big" data-a="go" ${M.cls ? '' : 'disabled'}>${M.cls ? 'C\'EST PARTI' : 'CHOISIS UNE CLASSE'}</button>`}</div></div>`;
    }
    if (R.phase === 'reward' && R.offer) {
      const o = R.offer, room = R.room;
      const t = o.rw === 'gold' || o.rw === 'heal' ? 'Ta récompense' : o.rw === 'power' ? 'Choisis un pouvoir' : o.rw === 'ult' ? 'Choisis ton ultime' : o.rw === 'leg' ? 'Bénédiction légendaire' : 'Choisis une bénédiction';
      return `<div class="ax-st"><div class="ax-clear"><b>${room.kind === 'gardien' ? 'GARDIEN VAINCU' : room.kind === 'elite' ? 'ÉLITE VAINCU' : 'ÉTAGE ' + R.floor + ' NETTOYÉ'}</b>${R.lastGold ? `<span>${Q.coinSvg(16)} +${R.lastGold} or</span>` : ''}</div>
        ${floorTable()}<h2>${t}</h2>
        <div class="ax-cards">${o.items.map((it, i) => itemCard(it, i)).join('') || '<p class="muted">Rien à gagner cette fois…</p>'}</div>
        <div class="row center">${M.rerolls > 0 && (o.rw === 'boon' || o.rw === 'power' || o.rw === 'leg') ? `<button class="btn" data-a="reroll">${ICO('refresh', 16)} Relancer (${M.rerolls})</button>` : ''}${o.items.length ? '' : '<button class="btn primary big" data-a="skip">Continuer</button>'}</div></div>`;
    }
    if (R.phase === 'room') return roomHtml();
    if (R.phase === 'doors' && R.doors) {
      const L = R.doors.list, my = R.votes[R.selfId];
      const nb = Q.biomeOf(R.doors.fl), nbn = BR.Dungeon ? 'La Citadelle — ' + BR.Dungeon.tierName(R.doors.fl) : BR.ArenaScene.biomeName(nb);
      return `<div class="ax-st"><div class="ax-next">ÉTAGE ${R.doors.fl} · <b>${esc(nbn)}</b></div><h2>${L.length > 1 ? 'Quelle porte ?' : 'La suite…'}</h2><p class="muted">${L.length > 1 ? (R.solo ? 'Choisis ta route.' : 'Votez ! La majorité l\'emporte (égalité : au hasard).') : 'Un gardien vous attend derrière cette porte.'} <b class="ax-count"></b></p>
        <div class="ax-doors">${L.map((d, i) => doorHtml(d, i, my === i)).join('')}</div></div>`;
    }
    if (R.phase === 'wait') return `<div class="ax-st"><div class="ax-wait big"><div class="spin"></div>En attente des autres joueurs…</div>${floorTable()}</div>`;
    return '';
  }
  function doorHtml(d, i, mine) {
    const K = KIND[d.kind], voters = active().filter(id => R.votes[id] === i).map(id => `<span>${esc(R.P[id].name)}</span>`).join('');
    const sub = d.kind === 'combat' ? 'Récompense : ' + RW[d.rw] : d.kind === 'elite' ? 'Plus dur · bénédiction rare ou mieux' : d.kind === 'defi' ? Q.DEFIS[d.mod].n + ' · bénédiction légendaire' : d.kind === 'repos' ? 'Soin ou amélioration' : d.kind === 'marchand' ? 'Dépense ton or' : d.kind === 'autel' ? 'Une malédiction contre un pouvoir immense' : d.kind === 'final' ? 'Le dernier combat' : 'Le gardien de l\'acte';
    const rwIco = d.kind === 'combat' ? (d.rw === 'gold' ? Q.coinSvg(20) : d.rw === 'heal' ? ICO('heart', 20) : d.rw === 'power' ? ICO('bolt', 20) : Q.glyph('univ', 20)) : '';
    return `<button class="ax-door ${mine ? 'mine' : ''} k-${d.kind}" data-door="${i}" style="--kc:${K.col}">
      <div class="ad-arch"><div class="ad-glow"></div><div class="ad-ico">${kindIcon(d.kind, 46)}</div>${rwIco ? `<div class="ad-rw">${rwIco}</div>` : ''}</div>
      <b>${K.n}</b><span>${sub}</span><div class="ad-v">${voters}</div></button>`;
  }
  function roomHtml() {
    const k = R.room.kind, me = R.P[R.selfId];
    if (me.rd === phaseTag()) return `<div class="ax-st"><div class="ax-wait big"><div class="spin"></div>En attente des autres joueurs…</div></div>`;
    if (k === 'repos') {
      const heal = R.pal >= 3 ? 0.25 : 0.4;
      const ups = M.skills.filter(Boolean).concat(M.ult ? [M.ult] : []).filter(id => (M.lv[id] || 1) < AR.MAXLV);
      const bups = Object.keys(M.boons).filter(id => M.boons[id] < Q.boon(id).max);
      if (R.pend === 'forge') return `<div class="ax-st"><h2>Forger un pouvoir</h2><div class="ax-cards">${ups.map((id, i) => powerCard({ t: 'up', id }, 'f' + i)).join('')}</div><div class="row center"><button class="btn" data-a="back">Retour</button></div></div>`;
      if (R.pend === 'medit') return `<div class="ax-st"><h2>Méditer</h2><div class="ax-cards">${bups.map((id, i) => boonCard({ t: 'boon', id }, 'm' + i)).join('')}</div><div class="row center"><button class="btn" data-a="back">Retour</button></div></div>`;
      return `<div class="ax-st"><div class="ax-room fire">${Q.glyph('braise', 70)}</div><h2>Feu de camp</h2><p class="muted">Un instant de calme. Une seule action possible.</p>
        <div class="ax-cards">
          <button class="axc misc" data-rest="heal" style="--fc:#7dff9a;--rc:#7dff9a"><div class="axc-rar">Repos</div><div class="axc-ico">${ICO('heart', 60)}</div><b class="axc-n">Se reposer</b><p>Récupère <b>${Math.round(heal * 100)} %</b> de tes PV.</p></button>
          <button class="axc misc" data-rest="forge" ${ups.length ? '' : 'disabled'} style="--fc:#ffb24a;--rc:#ffb24a"><div class="axc-rar">Forge</div><div class="axc-ico">${ICO('bolt', 60)}</div><b class="axc-n">Forger</b><p>+1 niveau sur un de tes pouvoirs.</p></button>
          <button class="axc misc" data-rest="medit" ${bups.length ? '' : 'disabled'} style="--fc:#ffd76a;--rc:#ffd76a"><div class="axc-rar">Méditation</div><div class="axc-ico">${Q.glyph('univ', 60)}</div><b class="axc-n">Méditer</b><p>+1 niveau sur une de tes bénédictions.</p></button>
        </div></div>`;
    }
    if (k === 'marchand') {
      const sh = R.shop;
      return `<div class="ax-st"><div class="ax-room shop">${Q.coinSvg(64)}</div><h2>Le marchand</h2><p class="muted">« Tout se paie, surtout la puissance. » — Tu as <b>${M.gold}</b> or.</p>
        <div class="ax-cards shop">${sh.items.map((x, i) => itemCard(x.it, 'b' + i, `<div class="axc-price ${x.sold ? 'sold' : M.gold >= x.p ? '' : 'poor'}">${x.sold ? 'VENDU' : Q.coinSvg(14) + ' ' + x.p}</div>`).replace('<button class="axc', `<button ${x.sold ? 'disabled' : ''} class="axc`)).join('')}</div>
        <div class="row center"><button class="btn" data-a="shopre" ${M.gold >= sh.rerollP ? '' : 'disabled'}>${ICO('refresh', 16)} Nouveau stock (${sh.rerollP} or)</button><button class="btn primary big" data-a="done">Continuer</button></div></div>`;
    }
    if (k === 'autel') {
      const A = R.altar;
      if (A.took) return `<div class="ax-st"><h2>Le pacte est scellé</h2><p class="muted">${esc(A.curse.n)} : ${esc(A.curse.d)}</p><h3>Choisis ta récompense</h3><div class="ax-cards">${A.items.map((it, i) => boonCard(it, 'a' + i)).join('')}</div></div>`;
      return `<div class="ax-st"><div class="ax-room altar">${Q.glyph('maudit', 70)}</div><h2>Autel maudit</h2><p class="muted">Une voix murmure : « Accepte mon fardeau, et choisis parmi mes trésors. »</p>
        <div class="ax-pact"><div class="ax-pc">${Q.glyph('maudit', 28)}<div><b>${esc(A.curse.n)}</b><span>${esc(A.curse.d)}</span></div></div>
          <div class="ax-pr">contre <b>une bénédiction épique ou légendaire</b> au choix</div></div>
        <div class="row center"><button class="btn primary big danger" data-a="pact">Accepter le pacte</button><button class="btn big" data-a="refuse">Refuser (+40 or)</button></div></div>`;
    }
    return '';
  }

  /* ---------- clics ---------- */
  function onClick(e) {
    if (!R) return;
    const t = e.target;
    const a = t.closest('[data-a]');
    if (a && !a.disabled) {
      const act = a.dataset.a; Au.ui('click');
      if (act === 'quit') { UI.confirm('Abandonner l\'Ascension ?', R.solo ? 'La course s\'arrête ici (gains réduits de moitié).' : (isHost() ? 'Tu es l\'hôte : la course s\'arrête pour tout le monde.' : 'Tu quittes la course (tes amis continuent sans toi).'), 'Abandonner').then(ok => { if (!ok || !R) return; if (isHost() && !R.solo) send({ k: 'qe', win: 0, why: (Acc.p.name || 'L\'hôte') + ' a abandonné.' }); else if (!R.solo) { try { N.leave(); } catch (er) {} } endRun({ win: false, quit: true }); }); return; }
      if (act === 'go') { if (!M.cls) return; Au.ui('ok'); ready('start'); render(); return; }
      if (act === 'reroll' && M.rerolls > 0 && R.offer) { M.rerolls--; R.offer = buildOffer(R.offer.rw, R.offer.ctx); Au.fx('spin', { v: 0.5 }); render(); return; }
      if (act === 'skip') { finishStep(); return; }
      if (act === 'back') { R.pend = null; render(); return; }
      if (act === 'done') { finishStep(); return; }
      if (act === 'shopre' && M.gold >= R.shop.rerollP) { M.gold -= R.shop.rerollP; M.stats.spent += R.shop.rerollP; const p = R.shop.rerollP; R.shop = makeShop(); R.shop.rerollP = Math.round(p * 1.5); render(); return; }
      if (act === 'pact') { R.altar.took = true; M.curses.push(R.altar.curse.id); M.stats.curses++; Au.fx('boom', { g: 0.5, rate: 0.7 }); render(); return; }
      if (act === 'refuse') { addGold(40); finishStep(); return; }
    }
    const cl = t.closest('[data-cls]'); if (cl && R.phase === 'start') { const C = Q.CLASSES[cl.dataset.cls]; if (M.cls !== C.id) setClass(C.id, null); Au.ui('ok'); render(); return; }
    const rest = t.closest('[data-rest]');
    if (rest && !rest.disabled) {
      const k = rest.dataset.rest; Au.ui('ok');
      if (k === 'heal') { M.hpK = Math.min(1, M.hpK + (R.pal >= 3 ? 0.25 : 0.4)); Au.fx('heal'); finishStep(); }
      else { R.pend = k; render(); }
      return;
    }
    const dr = t.closest('[data-door]');
    if (dr && R.phase === 'doors') { const i = +dr.dataset.door; R.votes[R.selfId] = i; send({ k: 'qv', fl: R.floor + 1, d: i }); Au.ui('ok'); if (isHost()) hostCheck(); render(); return; }
    const pk = t.closest('[data-pick]'); if (!pk || pk.disabled) return;
    const id = pk.dataset.pick;
    if (R.phase === 'start') {
      if (id[0] === 's') R.start.sk = R.start.starters[+id.slice(1)];
      if (id[0] === 'u') R.start.ul = R.start.ults[+id.slice(1)];
      Au.ui('click'); render(); return;
    }
    if (R.phase === 'reward' && R.offer) { const it = R.offer.items[+id]; if (it) take(it, () => finishStep()); return; }
    if (R.phase === 'room') {
      if (id[0] === 'f') { const ups = M.skills.filter(Boolean).concat(M.ult ? [M.ult] : []).filter(x => (M.lv[x] || 1) < AR.MAXLV); applyItem({ t: 'up', id: ups[+id.slice(1)] }); Au.fx('reveal'); finishStep(); return; }
      if (id[0] === 'm') { const bups = Object.keys(M.boons).filter(x => M.boons[x] < Q.boon(x).max); applyItem({ t: 'boon', id: bups[+id.slice(1)] }); Au.fx('reveal'); finishStep(); return; }
      if (id[0] === 'a') { const it = R.altar.items[+id.slice(1)]; applyItem(it); Au.fx('reveal', { rate: 1.4 }); finishStep(); return; }
      if (id[0] === 'b') {
        const x = R.shop.items[+id.slice(1)]; if (!x || x.sold) return;
        if (M.gold < x.p) { Au.ui('error'); toast('Pas assez d\'or.', 'error'); return; }
        take(x.it, () => { M.gold -= x.p; M.stats.spent += x.p; x.sold = true; Au.ui('buy'); render(); });
      }
    }
  }
  // prendre un objet (nouveau pouvoir avec 4 emplacements pleins : choisir lequel remplacer)
  function take(it, then) {
    if (it.t === 'new' && AR.skill(it.id).type === 'skill' && !M.skills.includes(null)) {
      UI.modal((box, close) => {
        box.innerHTML = `<h3>Remplacer quel pouvoir ?</h3><div class="ax-repl">${M.skills.map((id, i) => `<button class="btn" data-k="${i}"><img src="${AR.icon(id, 48)}"> ${esc(AR.skill(id).name)} <em>niv. ${M.lv[id] || 1}</em></button>`).join('')}</div><div class="row center"><button class="btn ghost" data-k="x">Annuler</button></div>`;
        box.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; close(); if (b.dataset.k === 'x') return; applyItem(it, +b.dataset.k); Au.fx('reveal'); then(); });
      });
      return;
    }
    applyItem(it); Au.fx('reveal', { rate: it.t === 'boon' && Q.boon(it.id).r === 'legendaire' ? 1.5 : 1 }); then();
  }

  /* =====================================================================
     FIN DE COURSE : résultats et trophées
     ===================================================================== */
  function awards() {
    const ids = active().concat(Object.keys(R.P).filter(id => R.P[id].gone && R.P[id].st));
    const st = id => id === R.selfId ? Object.assign({}, M.stats, { nboons: Object.keys(M.boons).length, curses: M.curses.length }) : R.P[id].st;
    const have = ids.filter(id => st(id)), out = {};
    if (have.length < 2) return null;
    for (const A of Q.AWARDS) {
      if (A.multi && have.length < 2) continue;
      const cand = have.filter(id => !out[id] && (A.min == null || (st(id)[A.k] || 0) >= A.min));
      if (!cand.length) continue;
      const best = cand.reduce((a, b) => ((st(b)[A.k] || 0) > (st(a)[A.k] || 0)) === (A.best === 'max') ? b : a);
      out[best] = { A, v: st(best)[A.k] || 0 };
      if (Object.keys(out).length >= have.length) break;
    }
    return out;
  }
  UI.screen('asc-end', {
    enter(n) {
      if (!R) { UI.show('asc'); return; }
      const o = R.result || {}, rw = R.rewards, win = !!o.win;
      Au.track('music', 'arene_menu', 0.5); if (win) Au.fx('win'); else Au.fx('lose', { g: 0.5 });
      n.innerHTML = `<div class="panel wide asc-end ${win ? 'win' : 'lose'}"></div>`;
      const paint = () => {
        const aw = awards();
        const ids = active().concat(Object.keys(R.P).filter(id => R.P[id].gone && R.P[id].st));
        n.querySelector('.asc-end').innerHTML = `
          <div class="ae-t">${win ? 'ASCENSION ACCOMPLIE' : o.aborted ? 'ASCENSION INTERROMPUE' : o.quit ? 'ABANDON' : 'CHUTE À L\'ÉTAGE ' + R.floor}</div>
          <div class="ae-s"><span style="color:${Q.palCol(R.pal)}">${Q.PALIERS[R.pal].n}</span> · ${M.cleared} étage${M.cleared > 1 ? 's' : ''} franchi${M.cleared > 1 ? 's' : ''} · ${BR.fmtTime(rw.time)}${o.why ? ' · ' + esc(o.why) : ''}</div>
          ${R.newMap ? `<div class="ae-s" style="color:${R.newMap.col};font-weight:800;font-size:1.15em">Nouvelle carte débloquée : ${esc(R.newMap.n)} !</div>` : ''}
          <div class="ax-tower small">${tower()}</div>
          ${aw ? `<div class="ae-aw">${ids.filter(id => aw[id]).map(id => `<div class="ae-a"><img src="${UI.thumb(R.P[id].look, 90, 112)}" alt=""><b>${aw[id].A.n}</b><span>${esc(R.P[id].name)}</span><p>${aw[id].A.t(aw[id].v)}</p></div>`).join('')}</div>` : ''}
          <div class="ae-grid">
            <div class="col"><h4>Ton build</h4><div class="ae-build"><img src="${AU.weaponThumb(M.weapon)}" alt=""><div>${M.skills.filter(Boolean).concat(M.ult ? [M.ult] : []).map(id => `<span class="ae-sk"><img src="${AR.icon(id, 40)}" title="${esc(AR.skill(id).name)}"><em>${M.lv[id] || 1}</em></span>`).join('')}</div></div>
              <div class="ae-boons">${Object.keys(M.boons).map(id => { const B = Q.boon(id); return `<div class="ae-b r-${B.r}" style="--fc:${Q.FAM[B.f].col}">${Q.glyph(B.f, 18)}<b>${esc(B.n)}</b><em>${M.boons[id] > 1 ? 'niv. ' + M.boons[id] : ''}</em></div>`; }).join('') || '<p class="muted">Aucune bénédiction.</p>'}${M.curses.map(id => `<div class="ae-b cur">${Q.glyph('maudit', 18)}<b>${esc(Q.curse(id).n)}</b></div>`).join('')}</div>
              <div class="ae-stats"><div><b>${BR.fmt(M.stats.dmg)}</b><span>dégâts</span></div><div><b>${BR.fmt(M.stats.taken)}</b><span>encaissés</span></div><div><b>${M.stats.perfect}</b><span>esquives parfaites</span></div><div><b>${M.stats.parries}</b><span>parades</span></div></div></div>
            <div class="col"><h4>Gains</h4>
              <div class="ae-rw"><div class="ae-sh">${Q.glyph('univ', 26, '#b9a6ff')}<b>+${rw.shards}</b><span>éclats d'âme</span></div>
                <div class="rlines"><div><span>Points</span><b>+${BR.fmt(rw.pts)}</b></div><div><span>Expérience</span><b>+${BR.fmt(rw.xp)} XP</b></div></div>${rw.cls && rw.cxp && Q.treeEndHtml ? Q.treeEndHtml(rw.cls, rw.cxp) : ''}${rw.inf ? `<div class="ae-np">L'INFINI : étage <b>${rw.inf}</b><span>Record : étage ${Q.data().inf}</span></div>` : ''}${rw.chal ? `<div class="ae-np">DÉFI DE LA SEMAINE : étage <b>${rw.chal.fl}</b><span>Ton meilleur cette semaine : étage ${rw.chal.best}</span></div>` : ''}
                ${rw.newPal ? `<div class="ae-np">NOUVEAU PALIER DÉBLOQUÉ : <b style="color:${Q.palCol(R.pal + 1)}">${Q.PALIERS[R.pal + 1].n}</b><span>${esc(Q.PALIERS[R.pal + 1].d)}</span></div>` : ''}
                ${rw.after.level > rw.before.level ? `<div class="ae-np">NIVEAU ${rw.after.level} !</div>` : ''}
                <p class="muted tiny">Dépense tes éclats à l'<b>autel des âmes</b> pour débloquer de nouvelles bénédictions.</p></div></div>
          </div>
          <div class="row center">${R.solo ? '<button class="btn primary big" data-e="again">Nouvelle ascension</button>' : N.room ? '<button class="btn primary big" data-e="lobby">Retour au salon</button>' : ''}<button class="btn big" data-e="altar">Autel des âmes</button><button class="btn big" data-e="menu">Menu</button></div>`;
      };
      paint(); R.repaint = paint;
      n.addEventListener('click', e => {
        const b = e.target.closest('[data-e]'); if (!b) return; Au.ui('click');
        const a = b.dataset.e; const wasSolo = R && R.solo;
        Q.leave();
        if (a === 'again' && wasSolo) Q.startSolo();
        else if (a === 'lobby') UI.show(N.room ? 'lobby' : 'multi');
        else if (a === 'altar') UI.show('asc-altar');
        else UI.show('asc');
      });
    },
    leave() { if (R) R.repaint = null; },
  });
})();

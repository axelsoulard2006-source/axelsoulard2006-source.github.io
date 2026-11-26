/* ===== arena/engine.js : moteur du jeu 2 « COLOSSES » =====
   Combat à la 3e personne : combos, attaque chargée, plongeon aérien, double saut, esquive (invulnérable,
   esquive parfaite = ralenti), garde et parade parfaite, 4 compétences + ultime, verrouillage de cible.
   Modes : boss (solo / coop, l'hôte simule le boss) et duel 1 contre 1 (contre un joueur ou l'IA). */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, AR = BR.ARENA;
  const G = (BR.Arena = { active: false });
  const R_ARENA = () => BR.ArenaScene.R - 0.5;
  const PVP = { basic: 1, skill: 0.42, ult: 0.3 };
  const GRAV = 36, JUMP = 13, JUMP2 = 11.5, RUN = 10.5, DASH_V = 36, DASH_T = 0.16, INV_T = 0.3;
  // contre les boss : course permanente à la vitesse de sprint du jeu d'origine (pas de touche de course), accélération immédiate
  const RUN_BOSS = 11.6, ACC_BOSS = 17, DEC_BOSS = 12;
  /* esquives (une seule touche : Maj ; + Espace / clic gauche pour les enchaînements)
     step  : pas de côté / en arrière (au sol)          slide : glissade vers l'avant (au sol, plus longue)
     roll  : roulade (Maj deux fois de suite)             air   : dash aérien (Maj en l'air, une fois par saut)
     flip  : saut périlleux (Espace pendant ou juste après une esquive) — invulnérable, passe au-dessus des ondes
     riposte : clic gauche juste après une esquive parfaite — fonce sur le boss et frappe un coup critique */
  /* invulnérabilité volontairement courte : il faut esquiver AU BON MOMENT, pas en rafale.
     Fatigue : une esquive lancée moins de 1,2 s après la précédente protège 35 % moins longtemps. */
  const DODGE = {
    step: { v: 34, t: 0.17, inv: 0.22, name: 'ESQUIVE' },
    slide: { v: 31, t: 0.34, inv: 0.26, name: 'GLISSADE' },
    roll: { v: 24, t: 0.42, inv: 0.3, name: 'ROULADE' },
    air: { v: 33, t: 0.2, inv: 0.22, name: 'DASH AÉRIEN' },
  };
  const PERFECT_W = 0.15, RIPOSTE_W = 1.1, DODGE_CD = 1.1, FATIGUE_W = 1.2, FATIGUE_K = 0.65;
  let S = null, R = null, raf = 0;

  /* =====================================================================
     DÉMARRAGE
     ===================================================================== */
  // o = { mode: 'boss'|'duel', boss, diff, seed, roster:[{id,name,look,level}], selfId, hostId, solo, bot, onEnd }
  G.start = function (o) {
    if (S) G.stop();
    const net = !o.solo && BR.Net.room;
    const diff = o.diffObj || AR.DIFFS[o.diff] || AR.DIFFS.normal;
    const kit = o.asc ? o.asc.kit : myKit();
    let root = BR.$('#arena');
    if (!root) { root = BR.el('div', { id: 'arena' }); document.body.appendChild(root); }
    root.innerHTML = '<canvas class="a-gl"></canvas><div class="a-hud"></div>';
    document.body.classList.add('inarena');
    if (!R || R.domElement !== root.querySelector('canvas')) {
      R = new THREE.WebGLRenderer({ canvas: root.querySelector('canvas'), antialias: false, powerPreference: 'high-performance' });
    }
    const q = BR.settings.quality || 'high';
    R.setPixelRatio(Math.min(q === 'low' ? 1 : 1.5, window.devicePixelRatio || 1)); R.setSize(innerWidth, innerHeight, false);
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.15; R.outputEncoding = THREE.LinearEncoding;
    R.shadowMap.enabled = q !== 'low'; R.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 900);
    scene.userData.cam = cam;
    const hud = root.querySelector('.a-hud');
    const fx = BR.AFX.create(scene, cam, hud);
    let post = null;
    try { post = BR.AFX.post(R, scene, cam, q === 'low' ? 'low' : 'high'); } catch (e) { console.warn('post', e); }
    if (!post) { R.outputEncoding = THREE.sRGBEncoding; }
    const themeId = o.theme || (o.mode === 'duel' ? 'duel' : o.boss);
    S = {
      o, mode: o.mode, diff, net, solo: !net, isHost: o.selfId === o.hostId, selfId: o.selfId, hostId: o.hostId,
      root, hud, scene, cam, fx, post, env: (o.asc && o.asc.room && o.asc.room.dg && BR.Dungeon) ? BR.Dungeon.build(scene, o.asc.room, q) : BR.ArenaScene.build(scene, themeId, q), quality: q,
      fighters: new Map(), me: null, boss: null, projs: [], eprojs: [], zones: [], timers: [], summons: [],
      t: 0, stopT: 0, stopTeam: null, stopBank: [], stopDur: 0, slowT: 0, hitstop: 0, shake: 0, fovKick: 0, flash: new THREE.Color(0, 0, 0),
      camYaw: 0, camPitch: 0.18, camDist: 6.2, lock: false, keys: {}, mouse: { l: false, r: false, lT: 0 }, paused: false,
      combo: 0, comboT: 0, style: 0, maxCombo: 0, kit, ended: false, sendT: 0, bsT: 0, lives: {}, startT: performance.now(),
      remoteState: {}, msgs: [], duel: null, lastHurt: 0, banner: null, helpT: o.asc ? 0 : 8, asc: o.asc || null,
    };
    S.api = makeApi;
    if (S.env && S.env.dungeon) S.env.S = S;
    // combattants
    const roster = o.roster.slice();
    // équipes du duel : choisies par l'hôte dans le salon (o.teams = { idJoueur: 0..5 }) ; sinon chacun pour soi
    const teamIdx = (p, i) => (o.teams && o.teams[p.id] != null) ? Math.max(0, Math.min(5, o.teams[p.id] | 0)) : Math.min(5, i);
    roster.forEach((p, i) => {
      const local = p.id === o.selfId;
      const team = o.mode === 'duel' ? AR.TEAMS[teamIdx(p, i)].id : 'A';
      const f = BR.AFighter(S, { id: p.id, name: p.name, look: p.look, kind: local ? 'local' : 'remote', team, weapon: local ? kit.weapon : (p.kit && p.kit.weapon) || 'blade', hp: o.mode === 'duel' ? 1500 : 1000 });
      f.kit = local ? kit : (p.kit || null);
      f.lv = local ? kit.lv : {};
      f.dashN = 2; f.jumps = 0; f.combo = { i: 0, t: 9, queued: false }; f.ctl = blankCtl();
      S.fighters.set(p.id, f);
      if (local) S.me = f;
      S.lives[p.id] = o.mode === 'boss' && !o.asc ? 2 : 0;
    });
    // IA de duel (solo)
    if (o.mode === 'duel' && o.bot) {
      const bk = botKit(o.diff);
      const bf = BR.AFighter(S, { id: 'bot', name: bk.name, look: bk.look, kind: 'bot', team: 'B', weapon: bk.weapon, hp: 1500 });
      bf.kit = bk; bf.lv = bk.lv; bf.dashN = 2; bf.jumps = 0; bf.combo = { i: 0, t: 9, queued: false }; bf.ctl = blankCtl(); bf.ai = BR.ArenaAI ? BR.ArenaAI.create(S, bf, o.diff) : null;
      S.fighters.set('bot', bf);
    }
    // liste des équipes en jeu (ordre stable) ; couleurs dès qu'une équipe compte plusieurs joueurs ou qu'il y a plus de 2 équipes
    S.teams = [...new Set([...S.fighters.values()].map(f => f.team))].sort();
    if (o.mode === 'duel') {
      const multi = [...S.fighters.values()].some(f => [...S.fighters.values()].filter(g => g.team === f.team).length > 1) || S.teams.length > 2;
      S.fighters.forEach(f => { const T = AR.TEAMS.find(t => t.id === f.team); if (T && multi) f.setTeamColor(T.color, true); });
    }
    spawnAll();
    if (o.mode === 'boss') {
      const n = roster.length;
      // PV : +100 % par joueur en plus (les dégâts d'un groupe montent linéairement avec le nombre de joueurs)
      S.nStart = n;
      if (o.boss) S.boss = makeBoss(o, diff, n);
    } else {
      S.duel = { round: 1, wins: {}, state: 'count', t: 3.2 };
      S.teams.forEach(t => S.duel.wins[t] = 0);
      banner('ROUND 1', S.teams.length > 2 ? S.teams.length + ' équipes · première à 2 manches' : 'Premier à 2 manches', 2.2);
    }
    // réseau
    S.off = [];
    if (net) {
      S.off.push(BR.Net.on('r', m => onNet(m.f, m.d)));
      S.off.push(BR.Net.on('left', m => { const f = S.fighters.get(m.id); if (f) { f.dispose(); S.fighters.delete(m.id); msg(m.name + ' a quitté le combat.'); if (S.mode === 'duel' && !S.ended) finish({ win: true, reason: 'Adversaire parti' }); } }));
      S.off.push(BR.Net.on('abort', m => { if (!S.ended) finish({ aborted: true, reason: m.msg }); }));
      // coupure trop longue (la reprise de session a échoué) : on sort proprement au lieu de rester figé
      S.off.push(BR.Net.on('lost', () => { if (S && !S.ended) finish({ aborted: true, reason: 'Connexion au serveur perdue.' }); }));
      send({ k: 'kit', kit: { weapon: kit.weapon, s: kit.s, u: kit.u, cls: kit.cls, tree: kit.tree || {} } });
    }
    bindInput();
    buildHud();
    G.active = true;
    BR.Audio.track('music', o.asc && o.asc.music ? o.asc.music : o.mode === 'duel' ? 'duel' : AR.boss(o.boss).music, 0.75);
    if (S.asc && BR.Asc) { try { BR.Asc.onStart(S); } catch (e) { console.error('ascension', e); } }
    BR.Audio.track('amb', '', 0);
    S.camYaw = S.me.yaw;
    S.last = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    // ticker de secours quand l'onglet est masqué (l'hôte continue de simuler)
    S.bg = setInterval(() => { if (document.hidden && S && !S.ended && S.net) step(0.05); }, 50);   // en solo : pause quand la fenêtre est cachée
    window.addEventListener('resize', onResize);
    G.lockPointer();
  };

  function myKit() {
    const a = BR.Account.arena();
    const lv = {}; for (const id in a.owned) lv[id] = a.owned[id].lv;
    return { weapon: a.weapon, s: a.equip.slice(0, 4), u: a.ult, lv };
  }
  function botKit(diffId) {
    const pool = AR.SKILLS.filter(s => s.type === 'skill'), ults = AR.SKILLS.filter(s => s.type === 'ult' && s.id !== 'u_temps');
    const r = BR.rngFrom((Math.random() * 1e9) >>> 0);
    const s = BR.shuffle(pool.slice(), r).slice(0, 4).map(x => x.id), u = BR.pick(ults, r).id;
    const lvN = diffId === 'cauchemar' ? 5 : diffId === 'heroique' ? 3 : 1;
    const lv = {}; s.concat([u]).forEach(id => lv[id] = lvN);
    const skins = BR.SKINS.filter(x => x.rarity === (diffId === 'cauchemar' ? 'legendaire' : diffId === 'heroique' ? 'epique' : 'rare'));
    const skin = BR.pick(skins.length ? skins : BR.SKINS, r);
    const auras = (BR.AURAS || []).filter(a => a.rarity === skin.rarity);
    return { name: BR.pick(['Spectre', 'Ronin', 'Vorax', 'Nyx', 'Kael', 'Sylas', 'Morrigan', 'Azur'], r) + ' (IA)', look: { skin: skin.id, aura: auras.length ? BR.pick(auras, r).id : null }, weapon: BR.pick(Object.keys(AR.WEAPONS), r), s, u, lv };
  }
  const blankCtl = () => ({ move: new V3(), jump: false, attack: false, attackHeld: false, heavy: false, dash: null, guard: false, skill: -1, ult: false, aim: new V3() });
  function spawnAll() {
    const list = [...S.fighters.values()];
    list.forEach((f, i) => {
      if (S.mode === 'duel') {
        // chaque équipe démarre sur sa portion du cercle, les coéquipiers côte à côte, tous tournés vers le centre
        const nT = Math.max(2, S.teams.length), ti = Math.max(0, S.teams.indexOf(f.team)), mates = list.filter(g => g.team === f.team), k = mates.indexOf(f);
        const a = ti / nT * Math.PI * 2 + (k - (mates.length - 1) / 2) * 0.16, R = nT > 2 ? 16 : 12;
        f.pos.set(Math.sin(a) * R, 0, Math.cos(a) * R); f.yaw = a + Math.PI;
      }
      else if (S.env && S.env.spawn) { const sp = S.env.spawn, k = i - (list.length - 1) / 2; f.pos.set(sp.x + Math.cos(sp.yaw) * k * 1.7, sp.y || 0, sp.z - Math.sin(sp.yaw) * k * 1.7); f.yaw = sp.yaw; f.gy = sp.y || 0; }
      else { const a = Math.PI + (i - (list.length - 1) / 2) * 0.35; f.pos.set(Math.sin(a) * 24, 0, Math.cos(a) * 24); f.yaw = a + Math.PI; }
      f.vel.set(0, 0, 0); f.hp = f.maxHp; f.alive = true; f.down = false; f.energy = 100; f.inv = 1; f.stun = 0; f.action = null;
    });
  }

  function makeBoss(o, diff, n) {
    const b = BR.ABoss.create(S, o.boss, { faces: o.faces || [0, 1, 2, 3, 4, 5, 6, 7], hp: o.asc && o.asc.bossHp ? o.asc.bossHp : AR.boss(o.boss).hp * diff.hp * (1 + 1.0 * (n - 1)), dmg: diff.dmg, speed: diff.speed, seed: o.seed, n, asc: o.asc || null });
    // donjon : les lumières du boss ne s'ajoutent pas à la scène (sinon tous les shaders se recompilent = saccade)
    if (S.env && S.env.dungeon && BR.Dungeon && b) BR.Dungeon.absorbLights(b.group || b.root || null, S.env);
    return b;
  }
  G.renderer = () => R;
  /* ---------- salle suivante du donjon, sans chargement ----------
     La salle suivante est déjà construite derrière la porte (BR.Dungeon.prebuild) : on recentre le monde sur elle
     (joueurs, caméra), on jette l'ancienne salle, et l'étage suivant commence dans la même scène, avec le même
     moteur de rendu (aucun shader à recompiler). Renvoie false si ce n'est pas possible (on relancera l'arène). */
  G.swapRoom = function (o) {
    if (!S || !S.env || !S.env.dungeon || !BR.Dungeon) return false;
    const old = S.env, nb = BR.Dungeon.takeNext(old, o.asc && o.asc.room); if (!nb) return false;
    const off = nb.off.clone(), env = nb.env;
    // le combat de la salle précédente s'arrête
    if (S.boss) { try { S.boss.dispose(); } catch (e) { console.warn(e); } S.boss = null; }
    S.projs.forEach(p => { try { if (p.onEnd) p.onEnd(p); } catch (e) { /* rien */ } if (p.mesh) S.scene.remove(p.mesh); }); S.projs = [];
    S.eprojs.forEach(p => { if (p.mesh) S.scene.remove(p.mesh); }); S.eprojs = [];
    S.zones.forEach(z => { try { if (z.onEnd) z.onEnd(z); } catch (e) { /* rien */ } }); S.zones = [];
    S.summons.forEach(s => { try { s.dispose && s.dispose(); } catch (e) { /* rien */ } }); S.summons = [];
    S.timers = [];
    if (S.ascL && S.ascL.orbs) S.ascL.orbs.forEach(m => S.scene.remove(m));
    if (S.stopT > 0) endTimeStop();
    // le monde est recentré sur la nouvelle salle (personne ne voit le décalage)
    S.fighters.forEach(f => { f.pos.sub(off); f.gs = null; f.safe = null; f.action = null; f.vel.set(0, 0, 0); });
    S.cam.position.sub(off); if (S.camTgt) S.camTgt.sub(off);
    old.nb = null; old.dispose({ keepWorld: true });
    S.env = env; BR.Dungeon.activate(env, S);
    // un retardataire resté dans l'ancienne salle (à plusieurs) : on le place à l'entrée
    const me = S.me, Db = env.entrance;
    if (me && (me.pos.z - Db.z) * -Db.oz < 1.2) { me.pos.set(env.spawn.x, 0.2, env.spawn.z); S.camTgt = null; }
    // l'étage suivant
    const diff = o.diffObj || S.diff;
    S.o = Object.assign({}, S.o, o); S.mode = 'boss'; S.diff = diff; S.asc = o.asc || null;
    S.ended = false; S.bossDeadT = 0; S.ascPost = false; S.lock = false; S.combo = 0; S.banner = null; S.helpT = 0; S.startT = performance.now();
    S.fighters.forEach(f => { f.alive = true; f.down = false; f.inv = Math.max(f.inv || 0, 1); f.stun = 0; if (f.stats) f.stats.dmg = 0; });
    if (o.boss) S.boss = makeBoss(o, diff, S.nStart || S.fighters.size);
    S.hud.className = 'a-hud'; S.hud.innerHTML = ''; buildHud();
    BR.Audio.track('music', o.asc && o.asc.music ? o.asc.music : AR.boss(o.boss || 'titan').music, 0.75);
    if (S.asc && BR.Asc) { try { BR.Asc.onStart(S); } catch (e) { console.error('ascension', e); } }
    return true;
  };
  G.stop = function () {
    if (!S) return;
    cancelAnimationFrame(raf); raf = 0; clearInterval(S.bg);
    (S.off || []).forEach(off => off && off());
    unbindInput();
    window.removeEventListener('resize', onResize);
    if (S.beamSnd) S.beamSnd.stop();
    S.fighters.forEach(f => f.dispose()); S.summons.forEach(s => s.dispose && s.dispose());
    if (S.boss) S.boss.dispose();
    if (S.scene.userData.petals) S.scene.userData.petals.dispose();
    S.fx.dispose(); S.env.dispose(); if (S.post) S.post.dispose();
    S.scene.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); });
    document.body.classList.remove('inarena');
    if (document.pointerLockElement) document.exitPointerLock();
    S.root.innerHTML = '';
    S = null; G.active = false;
  };
  G.session = () => S;
  G._step = dt => { if (S) { step(dt); render(dt); } };   // outil de test
  G.lockPointer = function () { const c = S && S.root.querySelector('canvas'); if (c && c.requestPointerLock) try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} };   // refus (onglet masqué, pas de geste) : sans erreur en console

  /* =====================================================================
     ENTRÉES
     ===================================================================== */
  let handlers = null;
  function bindInput() {
    const c = S.root.querySelector('canvas');
    handlers = {
      kd: e => {
        if (!S) return;
        if (e.code === 'Escape') return;
        if (['Space', 'Tab'].includes(e.code) || BR.Keys.is('lock', e.code) || BR.Keys.is('jump', e.code)) e.preventDefault();
        if (e.repeat) return;
        S.keys[e.code] = true;
        const ctl = S.me.ctl;
        const KB = BR.Keys;
        if (KB.is('jump', e.code)) ctl.jump = true;
        if (KB.is('dash', e.code)) ctl.dash = true;
        if (S.asc && BR.Asc && BR.Asc.W && BR.Asc.W.wantsKey && BR.Asc.W.wantsKey(e.code)) { e.preventDefault(); return; }
        if (S.env && S.env.wantsKey && S.env.wantsKey(e.code)) { e.preventDefault(); return; }
        const si = ['sk1', 'sk2', 'sk3', 'sk4'].findIndex(id => KB.is(id, e.code)); if (si >= 0) ctl.skill = si;
        if (KB.is('ult', e.code)) ctl.ult = true;
        if (KB.is('lock', e.code)) { S.lock = !S.lock; BR.Audio.ui('click'); }
        if (KB.is('help', e.code)) S.helpT = S.helpT > 0 ? 0 : 8;
      },
      ku: e => { if (S) S.keys[e.code] = false; },
      md: e => {
        if (!S) return;
        if (document.pointerLockElement !== c) { G.lockPointer(); return; }
        if (e.button === 0) { S.mouse.l = true; S.mouse.lT = 0; S.me.ctl.attack = true; }
        if (e.button === 2) { S.mouse.r = true; S.me.parryT = S.t; S.me.ctl.guard = true; }
        if (e.button === 1) { S.lock = !S.lock; e.preventDefault(); }
      },
      mu: e => { if (!S) return; if (e.button === 0) { S.mouse.l = false; } if (e.button === 2) { S.mouse.r = false; S.me.ctl.guard = false; } },
      mm: e => {
        if (!S || document.pointerLockElement !== c) return;
        const k = 0.0022 * (BR.settings.sens || 1);
        S.camYaw -= e.movementX * k; S.camPitch = BR.clamp(S.camPitch + e.movementY * k * (BR.settings.invertY ? -1 : 1), -0.55, 1.05);
        if (S.lock && Math.abs(e.movementX) > 40) S.lock = false;
      },
      wh: e => { if (S) S.camDist = BR.clamp(S.camDist + e.deltaY * 0.004, 3.4, 10); },
      cm: e => e.preventDefault(),
      pl: () => {
        if (!S || S.ended) return;
        const locked = document.pointerLockElement === c;
        S.paused = !locked;
        const p = S.hud.querySelector('.a-pause'); if (p) p.classList.toggle('on', !locked);
        if (!locked) { S.mouse.l = S.mouse.r = false; S.me.ctl.guard = false; S.keys = {}; }
      },
    };
    document.addEventListener('keydown', handlers.kd); document.addEventListener('keyup', handlers.ku);
    c.addEventListener('mousedown', handlers.md); document.addEventListener('mouseup', handlers.mu); document.addEventListener('mousemove', handlers.mm);
    c.addEventListener('wheel', handlers.wh, { passive: true }); c.addEventListener('contextmenu', handlers.cm);
    document.addEventListener('pointerlockchange', handlers.pl);
  }
  function unbindInput() {
    if (!handlers) return;
    document.removeEventListener('keydown', handlers.kd); document.removeEventListener('keyup', handlers.ku);
    document.removeEventListener('mouseup', handlers.mu); document.removeEventListener('mousemove', handlers.mm);
    document.removeEventListener('pointerlockchange', handlers.pl);
    handlers = null;
  }
  function onResize() { if (!S) return; R.setSize(innerWidth, innerHeight, false); S.cam.aspect = innerWidth / innerHeight; S.cam.updateProjectionMatrix(); if (S.post) S.post.setSize(innerWidth, innerHeight); }

  /* =====================================================================
     BOUCLE
     ===================================================================== */
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!S) return;
    const dt = Math.min(0.05, Math.max(0, (now - S.last) / 1000)); S.last = now;
    if (document.hidden) return;
    step(dt);
    render(dt);
  }
  // facteur de temps d'une équipe (arrêt du temps, ralenti, domaine)
  function tscale(team) {
    if (S.stopT > 0 && team !== S.stopTeam) return 0;
    if (S.slowT > 0 && team !== S.me.team) return 0.28;
    return 1;
  }
  function step(rdt) {
    if (S.paused && S.solo) { updateHud(0); return; }
    // arrêt sur image (impact)
    let dt = rdt;
    if (S.hitstop > 0) { S.hitstop -= rdt; dt = rdt * 0.06; }
    S.t += dt;
    const enemyTeam = S.mode === 'boss' ? 'B' : null;
    if (S.stopT > 0) { S.stopT -= dt; S.stopVis = Math.min(1, (S.stopVis || 0) + rdt * 4); if (S.stopT <= 0) endTimeStop(); }
    else S.stopVis = Math.max(0, (S.stopVis || 0) - rdt * 3);
    if (S.slowT > 0) S.slowT -= rdt;
    const bdt = dt * (enemyTeam ? tscale('B') : 1);
    // minuteries
    for (let i = S.timers.length - 1; i >= 0; i--) { const tm = S.timers[i]; tm.t -= dt * tscale(tm.team); if (tm.t <= 0) { S.timers.splice(i, 1); try { tm.fn(); } catch (e) { console.error(e); } } }
    // combattants
    S.fighters.forEach(f => {
      const fdt = dt * tscale(f.team);
      if (f.kind === 'local' || f.kind === 'bot') {
        if (f.kind === 'bot' && f.ai && fdt > 0 && duelFighting()) f.ai.think(fdt);
        if (f.kind === 'local') readInput(f);
        simFighter(f, fdt);
      } else remoteFighter(f, fdt);
      f.update(fdt, { air: f.pos.y - (f.gy || 0) > 0.15, boost: f.buff.domain ? 1 : 0 });
      applySpin(f, fdt);
      // invulnérabilité d'esquive bien visible : silhouette fantôme qui reste derrière
      if (f.dashT > 0 && fdt > 0 && Math.random() < fdt * 50) S.fx.spark(f.center().add(new V3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 0.4)), new V3(0, 0.3, 0), { color: 0x9ad8ff, life: 0.28, size: 0.55, size1: 0.2, alpha: 0.6 });
    });
    for (let i = S.summons.length - 1; i >= 0; i--) { const s = S.summons[i]; if (s.update(dt * tscale(s.team)) === false) { s.dispose(); S.summons.splice(i, 1); } }
    // boss
    if (S.boss) {
      // garde-fou : une erreur dans le script d'un boss ne doit jamais figer le combat (avant : le boss se bloquait
      // et toute la boucle de l'hôte s'arrêtait à cet endroit)
      try {
        S.boss.update(bdt);
        if (S.isHost && !S.boss.dead && !S.ended) S.boss.think(bdt);
      } catch (e) { console.error('boss', e); bossRecover(); }
    }
    hostWatch(rdt);
    updateProjs(dt); updateEProjs(bdt); updateZones(dt);
    if (S.mode === 'duel') duelTick(rdt);
    else bossModeTick(rdt);
    if (S.asc && BR.Asc) { try { BR.Asc.tick(S, rdt, dt); } catch (e) { console.error('ascension', e); } }
    // combo / style
    S.comboT -= rdt; if (S.comboT <= 0 && S.combo) { S.combo = 0; }
    S.style = Math.max(0, S.style - rdt * (4 + S.style * 0.08));
    S.fx.update(rdt * (S.hitstop > 0 ? 0.1 : 1), bdt);
    if (S.scene.userData.petals) S.scene.userData.petals.update(rdt);
    S.env.update(rdt, S.fx);
    netTick(rdt);
    updateCamera(rdt);
    updateHud(rdt);
  }

  // remet un boss en état de combattre après une erreur : attaques annulées, position valide, petite pause
  function bossRecover() {
    const b = S.boss; if (!b) return;
    S.bossErr = (S.bossErr || 0) + 1;
    try { b.insts.forEach(x => { try { if (x.cancel) x.cancel(); else if (x.end) x.end(); } catch (e) {} }); } catch (e) {}
    b.insts = []; b.chain = null; b.cool = 1.2; b.airY = 0; b.lift = 0; b.sink = 0; b.crouch = 0;
    if (!isFinite(b.pos.x) || !isFinite(b.pos.z)) b.pos.set(0, 0, 0);
    if (!isFinite(b.yaw)) b.yaw = 0;
  }
  // l'hôte ne répond plus (sa connexion a lâché sans prévenir) : on prévient, puis on sort au lieu de rester devant un boss figé
  function hostWatch(dt) {
    if (!S.net || S.isHost || S.ended) return;
    S.hostSilent = (S.hostSilent || 0) + dt;
    if (S.hostSilent > 6 && !S.hostWarned) { S.hostWarned = true; banner('L\'HÔTE NE RÉPOND PLUS', 'Attente de sa reconnexion…', 4, 'bad'); }
    if (S.hostSilent > 40) finish({ aborted: true, reason: 'L\'hôte ne répond plus.' });
  }

  function render(dt) {
    const P = S.post;
    if (P) {
      const g = P.grade;
      g.uStop.value = S.stopVis || 0;
      if (S.stopRing != null) { S.stopRing += dt * 1.6; g.uRing.value = S.stopRing; if (S.stopRing > 1.8) S.stopRing = null; } else g.uRing.value = 0;
      g.uChrom.value = BR.clamp(S.shake * 0.9 + (S.slowT > 0 ? 0.35 : 0) + (S.me.dashT > 0 ? 0.4 : 0), 0, 1.2);
      g.uFlash.value.copy(S.flash); S.flash.multiplyScalar(Math.max(0, 1 - dt * 5));
      g.uSat.value = S.me.alive ? (S.me.hp / S.me.maxHp < 0.25 ? 0.55 : 1) : 0.15;
      g.uDomain.value = S.domainVis || 0;
      P.render(dt);
    } else R.render(S.scene, S.cam);
  }

  /* =====================================================================
     CONTRÔLE DU JOUEUR LOCAL
     ===================================================================== */
  function readInput(f) {
    const k = S.keys, c = f.ctl;
    const KH = BR.Keys.held, fw = (KH(k, 'up') ? 1 : 0) - (KH(k, 'down') ? 1 : 0), st = (KH(k, 'right') ? 1 : 0) - (KH(k, 'left') ? 1 : 0);
    const a = S.camYaw, F = new V3(Math.sin(a), 0, Math.cos(a)), Rt = new V3(-Math.cos(a), 0, Math.sin(a));
    c.move.set(0, 0, 0).addScaledVector(F, fw).addScaledVector(Rt, st); if (c.move.lengthSq() > 1) c.move.normalize();
    if (S.mouse.l) S.mouse.lT += 1 / 60;
    c.attackHeld = S.mouse.l;
    c.guard = S.mouse.r;
    const ap = aimPoint();
    // fenêtre réduite ou caméra pas encore prête : on vise devant soi plutôt que de propager des NaN
    if (isFinite(ap.x) && isFinite(ap.z)) c.aim.copy(ap); else c.aim.copy(f.pos).add(f.fwd().multiplyScalar(5));
  }
  // point visé : ce que vise le centre de l'écran (boss, adversaire, sol), ou la cible verrouillée
  const ray = new THREE.Raycaster();
  function aimPoint() {
    const lt = lockTarget(); if (S.lock && lt) return lt.clone();
    ray.setFromCamera({ x: 0, y: 0 }, S.cam);
    const o = ray.ray.origin, d = ray.ray.direction;
    let best = null, bd = 60;
    for (const t of enemiesOf(S.me)) { const v = t.pos.clone().sub(o), tp = v.dot(d); if (tp < 0) continue; const dist2 = v.lengthSq() - tp * tp; if (dist2 < t.r * t.r && tp < bd) { bd = tp; best = o.clone().addScaledVector(d, tp); } }
    if (best) return best;
    if (d.y < -0.01) { const tt = -o.y / d.y; if (tt < 60) return o.clone().addScaledVector(d, tt); }
    return o.clone().addScaledVector(d, 30).setY(0);
  }
  function lockTarget() {
    if (S.boss && !S.boss.dead) return S.boss.focus();
    // adversaire le plus proche (plusieurs équipes possibles)
    let e = null, bd = 1e9; S.fighters.forEach(f => { if (f.team === S.me.team || !f.alive) return; const d = f.pos.distanceTo(S.me.pos); if (d < bd) { bd = d; e = f; } });
    return e ? e.center() : null;
  }

  // simulation d'un combattant contrôlé ici (joueur local ou IA)
  function simFighter(f, dt) {
    if (dt <= 0) return;
    const c = f.ctl, W = f.weapon, local = f.kind === 'local';
    f.inv = Math.max(0, f.inv - dt); f.stun = Math.max(0, f.stun - dt); f.slow = Math.max(0, f.slow - dt); f.dashT = Math.max(0, f.dashT - dt);
    for (const k in f.buff) { if (typeof f.buff[k] === 'number' && k.endsWith('T')) { f.buff[k] -= dt; if (f.buff[k] <= 0) { delete f.buff[k]; delete f.buff[k.slice(0, -1)]; } } }
    for (const k in f.cds) f.cds[k] = Math.max(0, f.cds[k] - dt * (f.buff.domain ? 2 : 1));
    f.energy = Math.min(100, f.energy + dt * (f.buff.domain2 ? 40 : 7) * (f.asc ? f.asc.en || 1 : 1));
    if (f.dashN < (f.dashMax == null ? 2 : f.dashMax)) { f.dashCd = (f.dashCd || 0) + dt; const need = (S.mode === 'boss' ? DODGE_CD : 0.85) * (W.dashCd || 1) * (f.asc && f.asc.dcd || 1); if (f.dashCd >= need) { f.dashN++; f.dashCd = 0; } }
    if (!f.alive) { c.attack = c.jump = c.dash = c.ult = false; c.skill = -1; f.vel.x *= 0.9; f.vel.z *= 0.9; gravity(f, dt); return; }
    if (duelFrozen()) { c.attack = c.jump = c.dash = c.ult = false; c.skill = -1; return; }
    const A = f.action;
    const canAct = !A || A.cancel || (A.type === 'attack' && A.t > A.step.hit + 0.02);
    // --- esquive (annule presque tout) ---
    if (c.dash) {
      c.dash = false;
      if (f.dashN > 0 && f.stun <= 0 && (!A || (A.type !== 'skill' && A.type !== 'riposte') || A.cancel)) doDash(f);
    }
    // --- saut périlleux : Espace pendant une esquive au sol ou juste après ---
    if (c.jump && f.stun <= 0 && f.pos.y - (f.gy || 0) < 0.3 && ((A && A.type === 'dash' && A.kind !== 'air') || S.t - (f.dodgeEndT || -9) < 0.22)) { c.jump = false; doFlip(f); }
    // --- riposte : clic gauche juste après une esquive parfaite ---
    if (c.attack && f.riposteT > S.t && f.stun <= 0 && (!A || A.type === 'dash' || A.cancel || A.type === 'attack')) { c.attack = false; f.charging = false; doRiposte(f); }
    // --- saut / double saut ---
    if (c.jump) {
      c.jump = false;
      if (f.stun <= 0 && (!A || A.type === 'attack' || A.cancel) && f.jumps < (f.jumpMax || 2) && !f.guard) {
        const onGround = f.pos.y - (f.gy || 0) < 0.05 || (f.coyote || 0) > 0; f.coyote = 0;
        f.vel.y = f.jumps === 0 && onGround ? JUMP : JUMP2; f.jumps = onGround ? 1 : Math.max(2, f.jumps + 1); f.action = null;
        if (f.jumps === 2) { f.play('Jump_Start', 1.6); S.fx.ring(f.pos.clone(), { r0: 0.2, r1: 1.6, life: 0.3, color: W.color, width: 0.3 }); }
        BR.Audio.fx('jump', { g: local ? 1 : 0.4 });
      }
    }
    // --- garde ---
    const wantGuard = c.guard && f.stun <= 0 && f.pos.y - (f.gy || 0) < 0.05 && (!A || A.cancel);
    if (wantGuard && !f.guard) { f.guard = true; f.guardAnimT = 0; f.play('Block', 1.6); }
    if (!wantGuard && f.guard) { f.guard = false; }
    if (f.guard) { f.guardAnimT += dt; if (f.guardAnimT > 0.5) { f.guardAnimT = 0; f.play('Blocking', 1, { fade: 0.05 }); } }
    // --- ultime / compétences ---
    if (c.ult) { c.ult = false; if (canAct && f.stun <= 0 && f.ult >= 100) castSkill(f, 'ult'); else if (local && f.ult < 100) deny('Ultime pas prêt'); }
    if (c.skill >= 0) { const sl = c.skill; c.skill = -1; if (canAct && f.stun <= 0 && !f.guard) castSkill(f, sl); }
    // --- attaques ---
    if (c.attack) {
      c.attack = false;
      if (f.guard) { /* attaque depuis la garde : contre-coup */ f.guard = false; }
      if (f.stun <= 0) {
        if (f.pos.y - (f.gy || 0) > 1.0 && isFinite(f.gy == null ? 0 : f.gy) && (!A || A.type === 'attack')) startAir(f);
        else if (!A || A.cancel) { f.heldT = 0; f.charging = true; }
        else if (A.type === 'attack') A.queued = true;
      }
    }
    if (f.charging) {
      if (c.attackHeld) {
        f.heldT += dt;
        if (f.heldT > 0.12 && Math.random() < dt * 40) S.fx.spark(f.tip(0), new V3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2), { color: W.color, life: 0.3, size: 0.25 });
        if (f.heldT >= 0.42) { f.charging = false; startHeavy(f); }
      } else { f.charging = false; if (!f.action || f.action.cancel) startAttack(f); }
    }
    // --- action en cours ---
    if (f.action) runAction(f, dt);
    else f.combo.t += dt;
    if (f.combo.t > 0.75) f.combo.i = 0;
    // --- déplacement ---
    const bossMode = S.mode === 'boss';
    let sp = (bossMode ? RUN_BOSS : RUN) * (f.buff.haste ? 1.25 : 1) * (f.asc ? f.asc.spd || 1 : 1) * (f.mud > 0 ? 0.6 : 1);
    if (f.guard) sp *= 0.38; if (f.slow > 0) sp *= 0.45; if (f.stun > 0) sp = 0;
    const act = f.action;
    if (act && act.lockMove) sp *= act.type === 'attack' ? 0.3 : 0;
    const want = c.move.clone().multiplyScalar(sp);
    if (act && act.vel) {
      // une action impose sa vitesse, mais on y entre et on en sort en douceur (élan conservé, pas d'arrêt sec)
      const kb = Math.min(1, dt * (act.type === 'dash' ? 40 : 22));
      f.vel.x += (act.vel.x - f.vel.x) * kb; f.vel.z += (act.vel.z - f.vel.z) * kb;
    } else {
      // inertie : on accélère franchement, on freine un peu moins vite (glissement léger), demi-tour plus nerveux
      const air = f.pos.y - (f.gy || 0) > 0.05, cur = Math.hypot(f.vel.x, f.vel.z), wl = Math.hypot(want.x, want.z);
      const rev = cur > 0.5 && wl > 0.5 && (f.vel.x * want.x + f.vel.z * want.z) < 0;
      let ac = air ? (bossMode ? 6 : 5) : wl > cur + 0.1 ? (bossMode ? ACC_BOSS : 20) : rev ? 24 : (bossMode ? DEC_BOSS : 16);
      if (f.asc && f.asc.slip && !air) ac *= wl > cur + 0.1 ? 0.35 : 0.12;   // malédiction « savon »
      if (act && act.type === 'attack') ac = Math.min(ac, 10);
      f.vel.x += (want.x - f.vel.x) * Math.min(1, dt * ac); f.vel.z += (want.z - f.vel.z) * Math.min(1, dt * ac);
    }
    // orientation (ressort angulaire : ni à-coup, ni retard mou)
    if (act && act.face != null) turnTo(f, act.face, dt, 30);
    else if (f.guard || (f.kind === 'bot' && f.pos.distanceTo(c.aim) < 9)) turnTo(f, yawTo(f.pos, c.aim), dt, 16);
    else if (c.move.lengthSq() > 0.01) turnTo(f, Math.atan2(c.move.x, c.move.z), dt, 13);
    else f.yawV = (f.yawV || 0) * Math.max(0, 1 - dt * 12);
    gravity(f, dt);
    f.pos.x += f.vel.x * dt; f.pos.z += f.vel.z * dt;
    confine(f);
  }
  function gravity(f, dt) {
    const E = S.env, py = f.pos.y, wasAir = py - (f.gy || 0) > 0.05;
    if (!(f.action && f.action.float)) f.vel.y -= GRAV * dt;
    f.pos.y += f.vel.y * dt;
    let gy = 0;
    if (E && E.groundAt) {
      gy = E.groundAt(f.pos.x, f.pos.z, Math.max(py, f.pos.y) + (wasAir ? 0.05 : 0.5)); f.gs = E.lastS;
      // temps de grâce : on peut encore sauter juste après avoir quitté un bord
      if (!wasAir && f.pos.y > gy + 0.05) f.coyote = 0.12; else f.coyote = Math.max(0, (f.coyote || 0) - dt);
      if (!isFinite(gy) && f.pos.y < (E.fallY != null ? E.fallY : -14) && E.onFall) { E.onFall(f); return; }
    }
    f.gy = gy;
    if (f.pos.y <= gy) {
      f.pos.y = gy;
      if (wasAir) { if (f.vel.y < -8) { BR.Audio.fx('land', { g: f.kind === 'local' ? 1 : 0.4 }); } if (f.action && f.action.type === 'air') landAir(f); }
      f.vel.y = 0; f.jumps = 0; f.airDashed = false;
    }
  }
  function confine(f) {
    const r = Math.hypot(f.pos.x, f.pos.z), Rm = R_ARENA();
    if (S.env && S.env.confine) S.env.confine(f);
    else if (r > Rm) { f.pos.x *= Rm / r; f.pos.z *= Rm / r; }
    if (S.boss) for (const b of S.boss.blockers()) {
      if (f.pos.y > b.h) continue;
      const dx = f.pos.x - b.x, dz = f.pos.z - b.z, d = Math.hypot(dx, dz);
      if (d < b.r && d > 1e-4) { f.pos.x = b.x + dx / d * b.r; f.pos.z = b.z + dz / d * b.r; }
    }
    // décor de l'arène (on peut sauter par-dessus les obstacles bas)
    const obs = S.env && S.env.obstacles; if (obs) for (const b of obs) {
      if (f.pos.y > b.h - 0.2) continue;
      const dx = f.pos.x - b.x, dz = f.pos.z - b.z, d = Math.hypot(dx, dz), rr = b.r + 0.45;
      if (d < rr && d > 1e-4) { f.pos.x = b.x + dx / d * rr; f.pos.z = b.z + dz / d * rr; }
    }
    // les combattants ne se traversent pas (sauf en esquive)
    S.fighters.forEach(o => { if (o === f || !o.alive || f.dashT > 0 || o.dashT > 0) return; const dx = f.pos.x - o.pos.x, dz = f.pos.z - o.pos.z, d = Math.hypot(dx, dz); if (d < 0.8 && d > 1e-4 && Math.abs(f.pos.y - o.pos.y) < 1.5) { f.pos.x = o.pos.x + dx / d * 0.8; f.pos.z = o.pos.z + dz / d * 0.8; } });
  }
  const turn = (a, b, k) => a + BR.angDiff(a, b) * Math.min(1, k);
  // rotation par ressort critique (vitesse angulaire f.yawV) : départ progressif, arrivée sans rebond
  function turnTo(f, target, dt, w) {
    let v = f.yawV || 0; const n = Math.max(1, Math.ceil(dt * w / 0.25)), h = dt / n;
    for (let i = 0; i < n; i++) { const e = BR.angDiff(f.yaw, target); v += (w * w * e - 2 * w * v) * h; f.yaw += v * h; }
    f.yawV = v;
  }
  const yawTo = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);

  function doDash(f) {
    const c = f.ctl, air = f.pos.y - (f.gy || 0) > 0.3, moving = c.move.lengthSq() > 0.01, local = f.kind === 'local';
    let dir = moving ? c.move.clone().normalize() : f.fwd().multiplyScalar(-1);
    // quel type d'esquive ? (aucune touche en plus : tout se déduit de la situation)
    const chain = !air && f.lastDodge && S.t - f.lastDodge.t < 0.45 && f.lastDodge.kind !== 'roll';
    const ref = local ? S.camYaw : f.yaw, rel = BR.angDiff(ref, Math.atan2(dir.x, dir.z));
    let kind = air ? 'air' : chain ? 'roll' : moving && Math.abs(rel) < 0.75 ? 'slide' : 'step';
    if (kind === 'air' && f.airDashed) return;
    const D = DODGE[kind];
    const tired = f.lastDodge && S.t - f.lastDodge.t < FATIGUE_W;
    f.dashN--; f.dashCd = 0; f.dashT = D.t; f.inv = Math.max(f.inv, D.inv * (tired ? FATIGUE_K : 1)); f.dashStart = S.t; f.perfectUsed = false;
    f.lastDodge = { t: S.t, kind }; f.dodgeEndT = S.t + D.t;
    const v0 = D.v * (f.weaponId === 'daggers' ? 1.06 : 1);
    const A = f.action = { type: 'dash', kind, t: 0, dur: D.t, vel: dir.clone().multiplyScalar(v0), lockMove: true, cancel: false, float: kind === 'air',
      update(t) { if (kind === 'slide' || kind === 'roll') A.vel.copy(dir).multiplyScalar(v0 * (1 - 0.45 * t / D.t)); } };
    if (kind === 'air') { f.airDashed = true; f.vel.y = 0.5; }
    // animation : pas de côté orienté selon la caméra, sinon on se tourne dans le sens de l'esquive
    let anim = 'Dodge_Forward', spd = 1.7;
    if (kind === 'step') {
      if (!moving) anim = 'Dodge_Backward';
      else { f.yaw = ref; anim = Math.abs(rel) > 2.3 ? 'Dodge_Backward' : rel > 0 ? 'Dodge_Left' : 'Dodge_Right'; }
    } else { f.yaw = Math.atan2(dir.x, dir.z); if (kind !== 'air') { anim = 'Jump_Idle'; spd = 1; } }
    f.play(anim, spd, { fade: 0.04 });
    if (kind !== 'step') startSpin(f, kind, D.t + (kind === 'roll' ? 0.05 : 0.08));
    BR.Audio.fx('dash', { g: local ? 1 : 0.5, rate: kind === 'roll' ? 0.8 : kind === 'air' ? 1.25 : 1 });
    if (kind === 'slide' || kind === 'roll') S.fx.burst(f.pos.clone().setY(0.15), { n: 14, color: 0x6a6058, kind: 'smoke', speed: 4, up: 0.4, life: 0.6, size: 0.6, size1: 1.4, grav: -0.3 });
    // images rémanentes
    for (let i = 0; i < 16; i++) S.fx.spark(f.center().add(new V3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.6)), dir.clone().multiplyScalar(-4 - Math.random() * 4), { color: f.weapon.color, life: 0.35, size: 0.35, drag: 3 });
    if (local) { S.fovKick = Math.max(S.fovKick, kind === 'step' ? 6 : 8); moveLabel(D.name); send({ k: 'an', n: anim, s: spd, d: 1, fx: kind === 'step' ? 0 : kind, du: D.t }); }
    if (S.asc && BR.Asc) BR.Asc.onDash(S, f, kind, dir);
  }
  // saut périlleux : grand saut invulnérable qui garde l'élan de l'esquive
  function doFlip(f) {
    const local = f.kind === 'local', A = f.action, keep = A && A.vel ? A.vel.clone().multiplyScalar(0.55) : f.vel.clone().setY(0).multiplyScalar(0.8);
    f.action = null; f.vel.x = keep.x; f.vel.z = keep.z; f.vel.y = JUMP * 1.18; f.jumps = 2;
    f.inv = Math.max(f.inv, 0.34); f.dashT = 0.3; f.dashStart = S.t; f.perfectUsed = false; f.dodgeEndT = -9; f.lastDodge = { t: S.t, kind: 'flip' };
    f.play('Jump_Idle', 1, { fade: 0.05 });
    const back = keep.lengthSq() < 4 || keep.dot(f.fwd()) < 0;
    startSpin(f, back ? 'flipB' : 'flip', 0.72);
    S.fx.ring(f.pos.clone(), { r0: 0.3, r1: 2.4, life: 0.35, color: f.weapon.color, width: 0.3 });
    S.fx.burst(f.pos.clone().setY(0.2), { n: 18, color: f.weapon.color, speed: 6, up: 1, life: 0.4 });
    BR.Audio.fx('jump', { g: local ? 1.4 : 0.5 }); BR.Audio.fx('dash', { g: local ? 0.6 : 0.3, rate: 1.4 });
    if (local) { moveLabel('SAUT PÉRILLEUX'); S.fovKick = Math.max(S.fovKick, 7); send({ k: 'an', n: 'Jump_Idle', s: 1, fx: back ? 'flipB' : 'flip', du: 0.72 }); }
  }
  // riposte (contre-esquive) : fonce sur la cible, coup critique énorme + gros dégâts de posture
  function doRiposte(f) {
    f.riposteT = 0;
    const W = f.weapon, local = f.kind === 'local';
    let tgt = null, bd = 1e9; for (const t of enemiesOf(f)) { const d = t.pos.distanceTo(f.pos) - t.r + (t.weak ? -3 : 0); if (d < bd) { bd = d; tgt = t; } }
    const aim = tgt ? tgt.pos.clone() : f.pos.clone().add(f.fwd().multiplyScalar(4));
    f.inv = Math.max(f.inv, 0.6); f.dashT = 0.3;
    S.hitstop = Math.max(S.hitstop, 0.06);
    const A = f.action = { type: 'riposte', t: 0, dur: 0.42, lockMove: true, cancel: false, vel: new V3(), face: yawTo(f.pos, aim),
      update(t) {
        const d = Math.hypot(aim.x - f.pos.x, aim.z - f.pos.z), reach = (tgt ? tgt.r : 0) + 2.2;
        if (t < 0.24 && d > reach) A.vel.set(aim.x - f.pos.x, 0, aim.z - f.pos.z).normalize().multiplyScalar(Math.min(46, (d - reach) / 0.05 + 8)); else A.vel.set(0, 0, 0);
        if (t >= 0.2 && !A.hit) {
          A.hit = 1; const c = f.center().add(f.fwd().multiplyScalar(1.2));
          S.fx.slash(c, f.yaw, { r: 3.8, arc: 2.6, tilt: 0.7, color: W.color, life: 0.3, inner: 0.4 }); S.fx.slash(c, f.yaw, { r: 3.8, arc: 2.6, tilt: -0.7, flip: true, color: 0xffffff, life: 0.3, inner: 0.4 });
          S.fx.flash(c, { color: W.color, r: 1.8, life: 0.25, intensity: 6 }); S.fx.burst(c, { n: 50, color: W.color, speed: 14, life: 0.45 });
          BR.Audio.fx('crit', { g: 1.3 }); BR.Audio.fx('parry', { g: 0.6 });
          if (auth(f)) { const dm = Math.max(W.heavy.dmg, 200) * 1.7 * (W.heavy.hits ? 1.6 : 1); const hit = hitSphere(f, tgt ? tgt.pos : c, 3.4, dm, { kind: 'basic', crit: true, posture: 5, kb: 4 }); if (hit.length && local) { S.hitstop = 0.12; shake(0.5); } }
          if (local) { banner('RIPOSTE !', '', 0.8, 'gold'); S.style = Math.min(100, S.style + 14); }
        }
      } };
    f.yaw = A.face; f.play(W.heavy.a, W.heavy.sp * 1.4, { fade: 0.04 });
    for (let i = 0; i < 20; i++) S.fx.spark(f.center().add(new V3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.6)), new V3(), { color: 0xffffff, life: 0.4, size: 0.5 });
    if (local) { moveLabel('RIPOSTE'); S.fovKick = Math.max(S.fovKick, 10); send({ k: 'atk', i: 0, h: 1 }); }
  }
  // rotation procédurale du modèle (roulade, saut périlleux, glissade, dash aérien) — le pivot reste fixe
  function startSpin(f, kind, dur) { f.spin = { kind, t: 0, dur }; }
  function applySpin(f, dt) {
    const m = f.av && f.av.mixer && f.av.group.children[0]; if (!m) return;
    if (!m.userData.p0) m.userData.p0 = m.position.clone();
    const p0 = m.userData.p0;
    if (!f.spin) { if (m.rotation.x !== 0 || m.rotation.z !== 0) { m.rotation.x *= Math.max(0, 1 - dt * 18); m.rotation.z *= Math.max(0, 1 - dt * 18); if (Math.abs(m.rotation.x) < 0.01) m.rotation.x = 0; if (Math.abs(m.rotation.z) < 0.01) m.rotation.z = 0; m.position.set(p0.x, p0.y, p0.z); } return; }
    const s = f.spin; s.t += dt; const k = Math.min(1, s.t / s.dur), e = k * k * (3 - 2 * k);
    let th = 0, h = 0.9, drop = 0;
    if (s.kind === 'roll') { th = e * Math.PI * 2; h = 0.5; drop = Math.sin(k * Math.PI) * 0.25; }
    else if (s.kind === 'flip') th = e * Math.PI * 2;
    else if (s.kind === 'flipB') th = -e * Math.PI * 2;
    else if (s.kind === 'slide') { th = -1.15 * Math.min(1, k * 6) * Math.min(1, (1 - k) * 5); h = 0; drop = 0.2 * Math.min(1, k * 6) * Math.min(1, (1 - k) * 5); }
    else if (s.kind === 'air') { th = 0.75 * Math.sin(k * Math.PI); }
    m.rotation.x = th;
    m.position.set(p0.x, p0.y + h - h * Math.cos(th) - drop, p0.z - h * Math.sin(th));
    if (k >= 1) { f.spin = null; m.rotation.x = 0; m.position.copy(p0); }
  }
  function moveLabel(t) { const e = S.hud && S.hud.querySelector('.a-move'); if (!e) return; e.textContent = t; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
  function startAttack(f) {
    const W = f.weapon, i = f.combo.i % W.combo.length, st = W.combo[i];
    f.combo.i = i + 1; f.combo.t = 0;
    const tgt = f.ctl.aim, face = yawTo(f.pos, tgt);
    f.action = { type: 'attack', step: st, idx: i, t: 0, dur: st.dur, hits: 0, face, lockMove: true, cancel: false, queued: false };
    // on pivote vite vers la cible (ressort) au lieu de se téléporter d'un coup
    if (Math.abs(BR.angDiff(f.yaw, face)) > 1.6) f.yaw += BR.angDiff(f.yaw, face) * 0.5;
    f.play(st.a, st.sp, { fade: 0.1 });
    BR.Audio.fx(st.big ? 'swingBig' : 'swing', { g: f.kind === 'local' ? 1 : 0.5, rate: 0.9 + Math.random() * 0.25 });
    if (f.kind === 'local') send({ k: 'atk', i, h: 0 });
  }
  function startHeavy(f) {
    const H = f.weapon.heavy, face = yawTo(f.pos, f.ctl.aim);
    f.action = { type: 'attack', step: Object.assign({ heavy: true }, H), t: 0, dur: H.dur, hits: 0, face, lockMove: true, cancel: false };
    if (Math.abs(BR.angDiff(f.yaw, face)) > 1.6) f.yaw += BR.angDiff(f.yaw, face) * 0.5;
    f.play(H.a, H.sp, { fade: 0.1 });
    BR.Audio.fx('swingBig', { g: f.kind === 'local' ? 1 : 0.5 }); S.fx.flash(f.center(), { color: f.weapon.color, r: 0.8, life: 0.18 });
    if (f.kind === 'local') send({ k: 'atk', i: 0, h: 1 });
  }
  function startAir(f) {
    f.action = { type: 'air', t: 0, dur: 3, lockMove: true, face: f.yaw };
    f.vel.y = -30; f.vel.x *= 0.2; f.vel.z *= 0.2;
    f.play(f.weaponId === 'greatsword' ? '2H_Melee_Attack_Chop' : f.weaponId === 'daggers' ? 'Dualwield_Melee_Attack_Stab' : '1H_Melee_Attack_Chop', 1.4);
    if (f.kind === 'local') send({ k: 'atk', i: 0, h: 2 });
  }
  function landAir(f) {
    const W = f.weapon, p = f.pos.clone();
    f.action = { type: 'recover', t: 0, dur: 0.22, lockMove: true, cancel: false };
    S.fx.ring(p, { r0: 0.3, r1: W.air.r * 1.4, life: 0.4, color: W.color }); S.fx.burst(p.clone().setY(0.2), { n: 40, color: W.color, speed: 12, up: 0.3, life: 0.5, flat: true });
    S.fx.burst(p, { n: 16, color: 0x554a40, kind: 'smoke', speed: 5, up: 0.5, life: 0.9, size: 1.2, size1: 2, grav: -0.5 });
    BR.Audio.fx('stomp', { g: f.kind === 'local' ? 0.8 : 0.3 });
    if (f.kind === 'local') shake(0.45);
    if (auth(f)) hitSphere(f, p, W.air.r, W.air.dmg, { kind: 'basic', launch: 6, posture: 2 });
  }
  function runAction(f, dt) {
    const A = f.action; A.t += dt;
    if (A.type === 'attack') {
      const st = A.step;
      // ruée vers la cible jusqu'au coup : élan de la course conservé, poussée qui retombe en douceur,
      // puis petit glissement d'accompagnement après l'impact (le corps suit son arme)
      const hitT = st.hit || 0.2;
      if (A.v0 == null) A.v0 = Math.min(RUN_BOSS, Math.hypot(f.vel.x, f.vel.z));
      const d = Math.hypot(f.ctl.aim.x - f.pos.x, f.ctl.aim.z - f.pos.z), nearT = d < (st.range || 3) * 0.7;
      let lv;
      if (A.t < hitT) { const k = A.t / hitT; lv = (nearT ? 0.25 : 1) * (st.lunge || 0) * 2.2 * Math.pow(1 - k, 1.4) + A.v0 * 0.55 * Math.exp(-A.t * 7); }
      else lv = ((nearT ? 0.4 : 1) * (st.lunge || 0) * 0.35 + A.v0 * 0.15) * Math.exp(-(A.t - hitT) * 9);
      A.vel = (A.vel || new V3()).copy(f.fwd()).multiplyScalar(lv);
      const hits = st.hits || 1;
      const hitTimes = hits === 1 ? [st.hit] : Array.from({ length: hits }, (_, k) => st.hit + k * (st.dur - st.hit - 0.1) / hits);
      while (A.hits < hits && A.t >= hitTimes[A.hits]) { meleeHit(f, st, A.hits, hits); A.hits++; }
      if (A.t >= A.dur) {
        f.action = null; f.combo.t = 0;
        if (A.queued) { startAttack(f); }
      }
    } else if (A.type === 'air') {
      A.vel = new V3();
      if (A.t > 1.5) f.action = null;
    } else {
      if (A.update) A.update(A.t, dt);
      if (A.t >= A.dur) { const e = A.onEnd; f.action = null; if (e) e(); }
    }
  }
  function meleeHit(f, st, k, n) {
    const W = f.weapon, c = f.center();
    if (S.asc && BR.Asc && BR.Asc.onSwing && f.kind === 'local') BR.Asc.onSwing(S, f, st, k, n);
    if (st.arrow) {                 // arbalète : flèches
      const aim = f.ctl.aim.clone(); if (aim.y < 0.5) aim.y = 1;
      const from = f.center().add(new V3(0, 0.3, 0));
      for (let b = 0; b < st.arrow; b++) {
        const dir = aim.clone().sub(from).normalize(); if (st.arrow > 1) dir.applyAxisAngle(new V3(0, 1, 0), (b - (st.arrow - 1) / 2) * 0.14);
        const mesh = BR.AscFX && BR.AscFX.arrowMesh ? BR.AscFX.arrowMesh(W.color, st.big ? 1.8 : 1) : null;
        spawnProj(f, { pos: from.clone().addScaledVector(dir, 0.7), vel: dir.multiplyScalar(st.big ? 76 : 62), r: st.big ? 0.7 : 0.42, dmg: st.dmg, life: 1.1, color: W.color, kind: 'basic', size: 0.5, homing: 1.6, pierce: !!st.pierce, posture: st.big ? 2 : 1, mesh,
          onEnd: p => { if (p.mesh && p.mesh.userData.mats) p.mesh.userData.mats.forEach(m => m.dispose()); } });
      }
      BR.Audio.fx('swing', { g: f.kind === 'local' ? 0.7 : 0.3, rate: st.big ? 1.1 : 1.9 });
      if (f.kind === 'local') S.fovKick = Math.max(S.fovKick, st.big ? 6 : 1.2);
      return;
    }
    if (st.bolt || st.orb) {        // bâton : projectiles
      const aim = f.ctl.aim.clone(); if (aim.y < 0.5) aim.y = 1;
      for (let b = 0; b < (st.bolt || 1); b++) {
        const from = f.tip(0), dir = aim.clone().sub(from).normalize();
        if (st.bolt > 1) dir.applyAxisAngle(new V3(0, 1, 0), (b - (st.bolt - 1) / 2) * 0.18);
        const big = !!st.orb;
        spawnProj(f, { pos: from, vel: dir.multiplyScalar(big ? 26 : 42), r: big ? 0.9 : 0.35, dmg: st.dmg, life: 1.4, color: W.color, kind: 'basic', size: big ? 1.6 : 0.7, explode: big ? 4.5 : 0, homing: 4 });
      }
      BR.Audio.fx('magic', { g: f.kind === 'local' ? 1 : 0.4, rate: st.orb ? 0.6 : 1 });
      return;
    }
    // croissant de taille (dans la direction visée, même si le corps finit encore de pivoter)
    const s = st.slash || [0, 1], ay = f.action && f.action.face != null ? f.action.face : f.yaw;
    S.fx.slash(c.clone().add(new V3(Math.sin(ay), 0, Math.cos(ay)).multiplyScalar(0.4)), ay, { r: (st.range || 3) * 0.95, arc: Math.min(st.arc || 120, 220) * Math.PI / 180, tilt: s[0], flip: s[1] < 0, color: W.color, life: st.big ? 0.34 : 0.24, inner: st.small ? 0.7 : 0.5 });
    if (st.shock) { S.fx.ring(f.pos.clone(), { r1: st.shock, color: W.color, life: 0.35 }); }
    if (auth(f)) {
      const dm = st.dmg * (st.fin ? 1 : 1);
      const hit = hitCone(f, f.pos, ay, st.range || 3, (st.arc || 120) * Math.PI / 180, dm, { kind: 'basic', posture: (W.posture || 1) * (st.heavy ? 2.2 : 1), launch: st.fin ? 4 : 0, kb: st.fin ? 6 : 1.5 });
      if (hit.length && f.kind === 'local') { S.hitstop = Math.max(S.hitstop, st.heavy || st.fin ? 0.085 : 0.045); if (st.fin || st.heavy) shake(0.25); }
    }
  }

  /* =====================================================================
     CIBLES ET DÉGÂTS
     ===================================================================== */
  // ennemis de f : parties du boss, petits monstres, combattants adverses
  function enemiesOf(f) {
    const out = [];
    if (S.mode === 'boss' && f.team === 'A' && S.boss && !S.boss.dead) {
      const sc = S.boss.sc || 1;
      S.boss.parts.forEach((p, i) => { if (!p.dead && !p.nohit) out.push({ kind: 'boss', i, pos: S.boss.partPos(i), r: p.r * sc, weak: p.weak }); });
      (S.boss.adds || []).forEach((a, i) => { if (a.alive) out.push({ kind: 'add', i, pos: a.pos.clone().setY(a.y || 0.6), r: a.r || 0.9 }); });
    }
    S.fighters.forEach(o => { if (o.team !== f.team && o.alive) out.push({ kind: 'fighter', f: o, pos: o.center(), r: 0.65 }); });
    return out;
  }
  const auth = f => f.kind === 'local' || f.kind === 'bot' || (f.owner && (f.owner.kind === 'local' || f.owner.kind === 'bot'));
  // un coup ne touche qu'une seule partie d'un même ennemi (le point faible en priorité, sinon la plus proche) :
  // chaque tête de l'Hydre compte comme un ennemi distinct
  function groupKey(t) { if (t.kind === 'boss') { const p = S.boss.parts[t.i]; return p && p.pool ? 'pool' + S.boss.parts.indexOf(S.boss.parts.find(x => x.pool === p.pool)) : 'boss'; } return t.kind + (t.i != null ? t.i : t.f && t.f.id); }
  G.groupKey = t => groupKey(t);
  function resolve(src, cands, dmg, o) {
    const best = new Map();
    for (const c of cands) { const k = groupKey(c.t), b = best.get(k); if (!b || (c.t.weak && !b.t.weak) || (!!c.t.weak === !!b.t.weak && c.d < b.d)) best.set(k, c); }
    const hits = [];
    best.forEach(c => { hits.push(c.t); applyHit(src, c.t, dmg, o, c.at); });
    return hits;
  }
  function hitSphere(src, c, r, dmg, o) {
    o = Object.assign({ from: c }, o); const cands = [];
    for (const t of enemiesOf(src.owner || src)) { const d = t.pos.distanceTo(c); if (d <= r + t.r) cands.push({ t, d, at: t.pos.clone().lerp(c, Math.min(1, t.r / Math.max(d, 0.01))) }); }
    return resolve(src, cands, dmg, o);
  }
  function hitCone(src, p, yaw, range, arc, dmg, o) {
    o = Object.assign({ from: p }, o);
    const cands = [], fw = new V3(Math.sin(yaw), 0, Math.cos(yaw)), c = p.clone().setY(p.y + 1);
    for (const t of enemiesOf(src.owner || src)) {
      const d = t.pos.clone().sub(c); const vert = Math.abs(d.y) - t.r; d.y = 0;
      const dist = d.length() - t.r; if (dist > range || vert > 2.6) continue;
      const ang = Math.acos(BR.clamp(d.normalize().dot(fw), -1, 1));
      if (ang <= arc / 2 + Math.atan2(t.r, Math.max(0.5, dist + t.r)) || dist < 0.6) cands.push({ t, d: dist + Math.max(0, vert), at: t.pos.clone().lerp(c, 0.5).setY(t.pos.y) });
    }
    return resolve(src, cands, dmg, o);
  }
  function hitLine(src, a, b, w, dmg, o) {
    const cands = [], ab = b.clone().sub(a), L2 = Math.max(1e-6, ab.lengthSq());
    for (const t of enemiesOf(src.owner || src)) {
      const k = BR.clamp(t.pos.clone().sub(a).dot(ab) / L2, 0, 1), q = a.clone().addScaledVector(ab, k), d = q.distanceTo(t.pos);
      if (d <= w + t.r) cands.push({ t, d, at: q });
    }
    return resolve(src, cands, dmg, o);
  }
  // applique un coup (seulement si ce client fait autorité sur l'attaquant)
  function applyHit(src, t, base, o, at) {
    o = o || {};
    const owner = src.owner || src;
    if (!auth(src)) return;
    let dmg = base * (o.raw ? 1 : (owner.buff.dmg || 1)) * (owner.buff.domain ? owner.buff.domainMul || 1.4 : 1) * (owner.buff.focus ? 1.3 : 1);
    if (S.asc && BR.Asc) { dmg *= BR.Asc.outMul(S, owner, t, o); if (!(dmg > 0)) return; }
    let crit = !!o.crit || Math.random() < 0.1 + (owner.weapon.crit || 0) + (owner.buff.focus ? 0.2 : 0) + (owner.asc ? owner.asc.crit || 0 : 0);
    if (t.weak) { dmg *= 1.5; crit = true; }
    if (crit) dmg *= 1.6;
    if (t.kind === 'boss' && S.boss.broken > 0) dmg *= 1.5;
    if (src.summonMul) dmg *= src.summonMul;
    dmg = Math.round(dmg * (0.92 + Math.random() * 0.16));
    const kind = o.kind || 'skill';
    if (t.kind === 'fighter') dmg = Math.round(dmg * PVP[kind]);
    // arrêt du temps : les dégâts s'accumulent et seront libérés à la fin
    if (S.stopT > 0 && owner.team === S.stopTeam && owner.kind === 'local') {
      S.stopBank.push({ t, dmg, at: (at || t.pos).clone() });
      S.fx.num(at || t.pos, dmg, { cls: 'banked' });
      S.fx.burst(at || t.pos, { n: 6, color: 0xffffff, speed: 3, life: 0.4, grav: 0 });
      bumpCombo(owner);
      return;
    }
    dealFinal(owner, t, dmg, crit, o, at);
  }
  function dealFinal(owner, t, dmg, crit, o, at) {
    at = at || t.pos;
    const local = owner.kind === 'local';
    const col = o.color || (o.kind === 'basic' ? owner.weapon.color : '#ffffff');
    if (t.kind === 'boss' || t.kind === 'add') {
      const posture = dmg * 0.02 * (o.posture || 1);
      if (S.isHost) S.boss.damage(t.kind === 'add' ? 100 + t.i : t.i, dmg, posture, owner.id, o);
      else send({ k: 'hit', p: t.kind === 'add' ? 100 + t.i : t.i, d: dmg, ps: Math.round(posture * 10) / 10, fr: o.freeze || 0, st: o.stun || 0, kd: o.kind === 'ult' ? 1 : 0 });
      S.boss.hitFx(t.kind === 'add' ? 100 + t.i : t.i, at, crit, o);
    } else if (t.kind === 'fighter') {
      const kb = t.f.pos.clone().sub(owner.pos).setY(0).normalize().multiplyScalar(o.kb || 1.5);
      if (t.f.kind === 'remote') send({ k: 'pd', to: t.f.id, d: dmg, kb: [kb.x, kb.z], up: o.launch || 0, st: o.stun || 0, fr: o.freeze || 0, ub: o.unblockable ? 1 : 0, kind: o.kind });
      else hurtFighter(t.f, dmg, { kb, up: o.launch, stun: o.stun, freeze: o.freeze, unblockable: o.unblockable, src: owner, kind: o.kind });
    }
    if (local || owner.kind === 'bot') {
      S.fx.num(at, dmg, { crit, color: crit ? '#ffd23a' : col });
      S.fx.impact(at, at.clone().sub(owner.center()).setY(0.15), { color: col, crit, size: o.kind === 'basic' ? 1 : 0.8 });
      BR.Audio.fx(crit ? 'crit' : 'hit', { g: local ? 1 : 0.45, rate: 0.9 + Math.random() * 0.2 });
    }
    owner.stats.dmg += dmg; owner.stats.hits++;
    if (o.skill) owner.stats.skills[o.skill] = (owner.stats.skills[o.skill] || 0) + dmg;
    if (o.kind !== 'ult') owner.ult = Math.min(100, owner.ult + dmg * (o.kind === 'basic' ? 0.0042 : 0.0016) * (t.kind === 'fighter' ? 2.2 : 1));
    if (o.kind === 'basic') owner.energy = Math.min(100, owner.energy + 3.5 * (owner.weapon.energy || 1));
    if (local) bumpCombo(owner);
    if (S.asc && BR.Asc && o.kind !== 'boon') BR.Asc.onHit(S, owner, t, dmg, crit, o, at);
  }
  function bumpCombo(owner) { S.combo++; S.comboT = 2.2; S.maxCombo = Math.max(S.maxCombo, S.combo); S.style = Math.min(100, S.style + 2.2); }

  /** dégâts reçus par un combattant simulé ici */
  function hurtFighter(f, dmg, o) {
    o = o || {};
    if (!f.alive || S.ended) return false;
    if (S.mode === 'duel' && S.duel.state !== 'fight') return false;
    const local = f.kind === 'local';
    if (f.inv > 0) {
      // esquive parfaite : le coup arrive dans les premiers instants de l'esquive (le marquage au sol vire au blanc à ce moment-là)
      if (!f.perfectUsed && (S.t - (f.dashStart || -9)) < PERFECT_W) { f.perfectUsed = true; perfectDodge(f); }
      return false;
    }
    if (f.counter && f.counter.t > 0) { f.counter.trigger(o.src); return false; }
    if (!o.unblockable && f.parryT != null && (S.t - f.parryT) < (f.weapon.parry || 0.2)) { perfectParry(f, o.src); f.parryT = -9; return false; }
    if (f.shield > 0) {
      const ab = Math.min(f.shield, dmg); f.shield -= ab; dmg -= ab; f.shieldStore = (f.shieldStore || 0) + ab;
      S.fx.burst(f.center(), { n: 10, color: 0xcfe0ff, speed: 5, life: 0.3 }); BR.Audio.fx('block', { g: local ? 1 : 0.5 });
      if (f.onShieldHit) f.onShieldHit(o.src);
      if (dmg <= 0) return false;
    }
    if (f.guard && !o.unblockable && f.energy > 0) {
      dmg *= 0.25; f.energy -= 14; BR.Audio.fx('block', { g: local ? 1 : 0.5 });
      S.fx.burst(f.center().add(f.fwd().multiplyScalar(0.5)), { n: 10, color: 0xffe0a0, speed: 6, life: 0.25 });
      if (f.energy <= 0) { f.guard = false; f.stun = 1.0; f.play('Hit_B', 1); if (local) banner('GARDE BRISÉE', '', 0.9, 'bad'); }
      o.kb = o.kb ? o.kb.clone().multiplyScalar(0.4) : null;
    }
    if (f.buff.sanct) dmg *= 0.8;
    if (S.asc && BR.Asc) { dmg = BR.Asc.inMul(S, f, dmg, o); if (!(dmg > 0)) return false; }
    dmg = Math.max(1, Math.round(dmg));
    f.hp -= dmg; S.lastHurt = S.t;
    if (S.asc && BR.Asc) BR.Asc.onHurt(S, f, dmg, o);
    f.ult = Math.min(100, f.ult + dmg * 0.035);
    if (o.kb) { f.vel.x += o.kb.x; f.vel.z += o.kb.z; }
    if (o.up) { f.vel.y = Math.max(f.vel.y, o.up); }
    if (o.stun) f.stun = Math.max(f.stun, o.stun);
    if (o.freeze) { f.stun = Math.max(f.stun, o.freeze); }
    if (dmg > 90 || o.stun) { f.action = null; f.charging = false; f.play(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', 1.4); f.stun = Math.max(f.stun, 0.28); }
    S.fx.num(f.center(), dmg, { cls: local ? 'hurt' : 'pvp' });
    S.fx.burst(f.center(), { n: 10, color: 0xff3040, speed: 6, life: 0.35 });
    if (local) { BR.Audio.fx('hurt'); shake(Math.min(0.7, 0.15 + dmg / 300)); S.flash.setRGB(0.35, 0, 0); S.combo = 0; S.style *= 0.5; }
    if (f.hp <= 0) { f.hp = 0; if (!(S.asc && BR.Asc && BR.Asc.cheatDeath(S, f))) die(f); }
    return true;
  }
  function perfectDodge(f) {
    f.stats.perfect++;
    f.ult = Math.min(100, f.ult + 12); f.energy = Math.min(100, f.energy + 20);
    f.buff.focus = 1; f.buff.focusT = 3;
    S.fx.ring(f.pos.clone(), { r0: 0.5, r1: 7, color: 0x9ad8ff, life: 0.5, width: 0.12 });
    S.fx.ring(f.center(), { r0: 0.3, r1: 3.2, color: 0xffffff, life: 0.3, width: 0.3, tilt: Math.PI / 2, rotY: f.yaw });
    S.fx.burst(f.center(), { n: 40, color: 0x9ad8ff, speed: 10, life: 0.5 });
    f.riposteT = S.t + RIPOSTE_W; f.inv = Math.max(f.inv, 0.25);
    if (S.asc && BR.Asc) BR.Asc.onPerfect(S, f, 'dodge');
    if (f.kind === 'local') {
      BR.Audio.fx('perfect'); BR.Audio.fx('parry', { g: 0.35 });
      banner('ESQUIVE PARFAITE', 'Clic gauche : RIPOSTE  ·  +30 % dégâts', 1.2, 'blue');
      if (S.solo) S.slowT = 0.7; else S.hitstop = Math.max(S.hitstop, 0.08);
      S.flash.setRGB(0.12, 0.25, 0.4);
      S.style = Math.min(100, S.style + 12);
    }
  }
  function perfectParry(f, src) {
    f.stats.parries++;
    f.ult = Math.min(100, f.ult + 12); f.energy = Math.min(100, f.energy + 15);
    const p = f.center().add(f.fwd().multiplyScalar(0.7));
    S.fx.flash(p, { color: 0xffffff, r: 1.2, life: 0.18, intensity: 6 }); S.fx.burst(p, { n: 40, color: 0xffe9a0, speed: 14, life: 0.4 });
    S.fx.ring(p, { r0: 0.2, r1: 3, color: 0xffffff, life: 0.3, tilt: Math.PI / 2, rotY: f.yaw });
    f.play('Block_Attack', 1.6);
    BR.Audio.fx('parry');
    if (S.asc && BR.Asc) BR.Asc.onPerfect(S, f, 'parry');
    if (f.kind === 'local') { banner('PARADE PARFAITE', '', 0.9, 'gold'); S.hitstop = 0.12; shake(0.3); S.style = Math.min(100, S.style + 15); }
    // riposte : grosse perte de posture du boss / étourdit l'adversaire
    if (S.mode === 'boss' && S.boss) { if (S.isHost) S.boss.damage(-1, 0, 18, f.id, {}); else send({ k: 'hit', p: -1, d: 0, ps: 18 }); }
    else if (src && src.kind) { if (src.kind === 'remote') send({ k: 'pd', to: src.id, d: 0, st: 0.9, kb: [0, 0], parried: 1 }); else hurtFighter(src, 0.0001, { stun: 0.9, unblockable: true }); }
  }
  function die(f) {
    f.alive = false; f.down = true; f.action = null; f.guard = false; f.stats.deaths++;
    f.play('Death_A', 1);
    S.fx.burst(f.center(), { n: 30, color: 0xff3040, speed: 8, life: 0.8 });
    if (f.kind === 'local') { BR.Audio.fx('lose', { g: 0.6 }); send({ k: 'dn' }); }
    if (S.mode === 'boss') {
      S.lives[f.id] = (S.lives[f.id] || 0) - 1;
      if (f.kind === 'local') {
        if (S.asc) banner('À TERRE', S.fighters.size > 1 ? 'Un allié peut te relever : il doit rester près de toi' : 'Plus de vies…', 3, 'bad');
        else if (S.lives[f.id] >= 0) { banner('À TERRE', 'Retour au combat dans 6 s (' + (S.lives[f.id]) + ' vie' + (S.lives[f.id] > 1 ? 's' : '') + ' restante' + (S.lives[f.id] > 1 ? 's' : '') + ')', 3, 'bad'); later(6, () => respawn(f), 'A'); }
        else banner('ÉLIMINÉ', 'Plus de vies…', 3, 'bad');
      }
    } else if (S.mode === 'duel') {
      if (S.isHost) duelKO(f);
    }
  }
  function respawn(f) {
    if (!S || S.ended) return;
    f.alive = true; f.down = false; f.hp = Math.round(f.maxHp * 0.6); f.inv = 2.2; f.energy = 100;
    f.pos.set(0, 0, -26); f.vel.set(0, 0, 0); f.play('Lie_StandUp', 1.5);
    S.fx.pillar(f.pos.clone(), { color: 0xfff0c0, r: 1.2, h: 16, life: 0.9 }); BR.Audio.fx('heal');
    send({ k: 'rv' });
  }

  /* =====================================================================
     COMPÉTENCES : contexte fourni aux sorts (js/arena/skills.js)
     ===================================================================== */
  function castSkill(f, slot) {
    const id = slot === 'ult' ? f.kit.u : f.kit.s[slot];
    if (!id) { if (f.kind === 'local') deny('Emplacement vide : équipe une compétence'); return false; }
    const def = AR.skill(id), impl = BR.ASkills && BR.ASkills[id]; if (!def || !impl) return false;
    const lv = (f.lv && f.lv[id]) || 1;
    if (slot !== 'ult') {
      if ((f.cds[slot] || 0) > 0) { if (f.kind === 'local') deny('Recharge…'); return false; }
      const cost = f.buff.domain2 ? 0 : def.cost;
      if (f.energy < cost) { if (f.kind === 'local') deny('Pas assez d\'énergie'); return false; }
      f.energy -= cost;
      f.cds[slot] = def.cd * AR.cdMult(lv) * (1 - (f.weapon.cdr || 0)) * (f.asc ? f.asc.cdm || 1 : 1);
    } else { f.ult = 0; }
    f.action = null; f.charging = false; f.guard = false;
    const aim = f.ctl.aim.clone();
    const ctx = makeApi(f, true, lv, aim, id);
    try { impl.cast(ctx); } catch (e) { console.error('sort', id, e); }
    f.stats.skills[id] = f.stats.skills[id] || 0; f.usage = f.usage || {}; f.usage[id] = (f.usage[id] || 0) + 1;
    if (f.kind === 'local') { send({ k: 'sk', id, lv, x: f.pos.x, y: f.pos.y, z: f.pos.z, yw: f.yaw, a: [aim.x, aim.y, aim.z] }); if (def.type === 'ult') ultCinematic(f, def); }
    if (S.asc && BR.Asc && f.kind === 'local') BR.Asc.onCast(S, f, id, slot, lv, aim);
    if (slot !== 'ult' || def.id !== 'u_temps') S.summons.forEach(s => { if (s.isClone && s.owner === f && s.mimicSkill) s.mimicSkill(id, lv, aim); });
    return true;
  }
  function ultCinematic(f, def) {
    BR.Audio.fx('ult'); S.fovKick = 14; S.flash.set(def.color).multiplyScalar(0.25);
    const nm = S.asc && BR.Asc && BR.Asc.skillName ? BR.Asc.skillName(def.id, BR.Asc.classOf(f)) : def.name;
    banner(nm.toUpperCase(), '', 1.2, 'ult');
  }
  // sort lancé à distance (visuel seulement)
  function remoteCast(f, d) {
    const impl = BR.ASkills && BR.ASkills[d.id]; if (!impl) return;
    f.pos.set(d.x, d.y, d.z); f.yaw = d.yw;
    const ctx = makeApi(f, false, d.lv || 1, new V3(d.a[0], d.a[1], d.a[2]), d.id);
    try { impl.cast(ctx); } catch (e) { console.error('sort distant', d.id, e); }
  }
  function makeApi(f, isAuth, lv, aim, id) {
    const def = AR.skill(id) || {};
    const ctx = {
      S, f, lv, aim, id, def, auth: isAuth, fx: S.fx, V3, color: def.color || '#ffffff',
      dmg: base => base * AR.dmgMult(lv),
      opts: o => Object.assign({ kind: def.type === 'ult' ? 'ult' : 'skill', skill: id, color: def.color }, o || {}),
      hitSphere: (c, r, d, o) => isAuth ? hitSphere(f, c, r, d, ctx.opts(o)) : [],
      hitCone: (p, yaw, range, arc, d, o) => isAuth ? hitCone(f, p, yaw, range, arc, d, ctx.opts(o)) : [],
      hitLine: (a, b, w, d, o) => isAuth ? hitLine(f, a, b, w, d, ctx.opts(o)) : [],
      hitTarget: (t, d, o) => { if (isAuth) applyHit(f, t, d, ctx.opts(o), t.pos); },
      enemies: () => enemiesOf(f),
      nearest: (from, max) => { let b = null, bd = max || 99; for (const t of enemiesOf(f)) { const d = t.pos.distanceTo(from) - t.r; if (d < bd) { bd = d; b = t; } } return b; },
      allies: () => [...S.fighters.values()].filter(o => o.team === f.team && o.alive),
      later: (t, fn) => later(t, fn, f.team),
      every: (dur, iv, fn) => { const n = Math.max(1, Math.round(dur / iv)); for (let i = 0; i < n; i++) later(i * iv, () => fn(i, n), f.team); },
      proj: o => spawnProj(f, Object.assign({ kind: def.type === 'ult' ? 'ult' : 'skill', skill: id, color: def.color }, o)),
      zone: o => spawnZone(f, Object.assign({ team: f.team, auth: isAuth }, o)),
      act: (o) => { f.action = Object.assign({ type: 'skill', t: 0, dur: 0.4, lockMove: true, cancel: false }, o); return f.action; },
      anim: (n, s, o) => f.play(n, s, o),
      sfx: (n, o) => BR.Audio.fx(n, Object.assign({ g: f.kind === 'local' ? 1 : 0.5 }, o || {})),
      shake: v => { if (f.kind === 'local') shake(v); else shake(v * 0.3); },
      slowmo: t => { if (f.kind === 'local' && S.solo) S.slowT = Math.max(S.slowT, t); },
      hitstop: t => { if (f.kind === 'local') S.hitstop = Math.max(S.hitstop, t); },
      timeStop: dur => timeStop(f, dur, lv),
      heal: (o2, amount) => { o2.hp = Math.min(o2.maxHp, o2.hp + amount); if (o2.kind === 'local' || isAuth) S.fx.num(o2.center(), '+' + Math.round(amount), { color: '#7dff9a' }); },
      summon: s => { s.team = f.team; S.summons.push(s); return s; },
      fighter: o => BR.AFighter(S, o),
      boss: () => S.boss,
      ground: p => new V3(p.x, 0, p.z),
      clampAim: max => { const d = aim.clone().sub(f.pos).setY(0); if (d.length() > max) d.setLength(max); const p = f.pos.clone().add(d); p.y = 0; const r = Math.hypot(p.x, p.z), Rm = R_ARENA(); if (r > Rm) { p.x *= Rm / r; p.z *= Rm / r; } return p; },
      dirToAim: () => { const d = aim.clone().sub(f.pos).setY(0); if (d.lengthSq() < 0.01) d.copy(f.fwd()); return d.normalize(); },
      face: () => { const d = ctx.dirToAim(); f.yaw = Math.atan2(d.x, d.z); return f.yaw; },
      lockTarget: () => { const t = ctx.nearest(aim, 6) || ctx.nearest(f.pos, 30); return t; },
      clones: () => S.summons.filter(s => s.isClone && s.owner === f),
      pvp: S.mode === 'duel',
      buff: (k, v, t) => { f.buff[k] = v; f.buff[k + 'T'] = t; },
      arenaR: R_ARENA(),
      confine: () => confine(f),
      hurtFighter, shakeG: shake,
    };
    return ctx;
  }
  G.api = makeApi;

  /* ---------- arrêt du temps ---------- */
  function timeStop(f, dur, lv) {
    if (S.mode === 'duel') dur = 2 + (lv >= 3 ? 0.4 : 0);
    S.stopT = dur; S.stopDur = dur; S.stopTeam = f.team; S.stopBank = []; S.stopRing = 0; S.stopBy = f; S.stopLv = lv;
    BR.Audio.fx('timestop'); S.flash.setRGB(0.6, 0.7, 0.9);
    banner('TEMPS FIGÉ', '', 1.4, 'stop');
    if (f.kind === 'local') send({ k: 'ts', d: dur });
    // tic-tac
    for (let i = 1; i < dur; i++) later(i, () => BR.Audio.fx('tick'), f.team);
  }
  function endTimeStop() {
    const f = S.stopBy, lv = S.stopLv || 1;
    S.stopT = 0; S.stopTeam = null;
    BR.Audio.fx('timeresume'); S.stopRing = 0;
    if (!f || !S.stopBank.length) return;
    const mul = lv >= 5 ? 1.8 : 1.3;
    // libération : on regroupe par cible
    const byT = new Map();
    for (const b of S.stopBank) { const k = b.t.kind + ':' + (b.t.i != null ? b.t.i : b.t.f && b.t.f.id); const e = byT.get(k) || { t: b.t, dmg: 0, at: b.at, n: 0 }; e.dmg += b.dmg; e.n++; byT.set(k, e); }
    S.stopBank = [];
    byT.forEach(e => {
      const total = Math.round(e.dmg * mul);
      S.fx.flash(e.at, { color: 0xffffff, r: 3, life: 0.35, intensity: 8 }); S.fx.ring(e.at.clone().setY(0), { r1: 9, color: 0xe8e8ff, life: 0.6 });
      S.fx.burst(e.at, { n: 80, color: 0xe8f0ff, speed: 18, life: 0.6 });
      dealFinal(f, e.t, total, true, { kind: 'ult', skill: 'u_temps', posture: 3 }, e.at);
      S.fx.num(e.at.clone().add(new V3(0, 1.2, 0)), total, { crit: true, cls: 'huge' });
    });
    shake(0.9); S.hitstop = 0.15; BR.Audio.fx('boom', { len: 1.3 });
    if (lv >= 5) for (const k in f.cds) f.cds[k] = 0;
  }

  /* ---------- projectiles des joueurs ---------- */
  const projGeo = new THREE.SphereGeometry(1, 12, 8); projGeo.userData.keep = true;
  function spawnProj(f, o) {
    const p = Object.assign({ src: f, auth: auth(f), t: 0, hit: new Set(), pierce: false }, o);
    if (o.dmg === 0) p.auth = false;
    p.pos = o.pos.clone(); p.vel = o.vel.clone();
    if (o.mesh) { p.mesh = o.mesh; }
    else { const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color || '#ffffff').multiplyScalar(3), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      p.mesh = new THREE.Mesh(o.geo || projGeo, mat); p.mesh.scale.setScalar((o.size || 0.6) * 0.5); if (o.stretch) p.mesh.scale.z *= o.stretch; }
    S.scene.add(p.mesh);
    S.projs.push(p);
    return p;
  }
  function updateProjs(dt) {
    for (let i = S.projs.length - 1; i >= 0; i--) {
      const p = S.projs[i], d = dt * tscale(p.src.team);
      if (d <= 0) continue;
      p.t += d;
      if (p.homing) {
        const tg = p.target || (() => { let b = null, bd = 30; for (const t of enemiesOf(p.src.owner || p.src)) { const dd = t.pos.distanceTo(p.pos); if (dd < bd) { bd = dd; b = t; } } return b; })();
        if (tg) { const want = tg.pos.clone().sub(p.pos).normalize().multiplyScalar(p.vel.length()); p.vel.lerp(want, Math.min(1, d * p.homing)); }
      }
      if (p.grav) p.vel.y -= p.grav * d;
      p.pos.addScaledVector(p.vel, d);
      p.mesh.position.copy(p.pos);
      if (p.vel.lengthSq() > 0.01) p.mesh.lookAt(p.pos.clone().add(p.vel));
      if (p.onUpdate) p.onUpdate(p, d);
      // traînée
      if (Math.random() < d * 60) S.fx.spark(p.pos, p.vel.clone().multiplyScalar(-0.08).add(new V3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5))), { color: p.color, life: 0.3, size: (p.size || 0.6) * 0.7 });
      let done = p.t > (p.life || 2) || p.pos.y < -0.2;
      if (!done) for (const t of enemiesOf(p.src.owner || p.src)) {
        const key = groupKey(t);
        if (p.hit.has(key)) continue;
        if (t.pos.distanceTo(p.pos) <= t.r + p.r) {
          p.hit.add(key);
          if (p.auth) applyHit(p.src, t, p.dmg, { kind: p.kind, skill: p.skill, color: p.color, freeze: p.freeze, stun: p.stun, posture: p.posture }, p.pos.clone());
          if (p.onHit) p.onHit(p, t);
          S.fx.burst(p.pos, { n: 10, color: p.color, speed: 6, life: 0.3 });
          if (!p.pierce) { done = true; break; }
        }
      }
      if (done) {
        if (p.explode) { S.fx.flash(p.pos, { color: p.color, r: p.explode * 0.6, life: 0.25 }); S.fx.ring(p.pos.clone().setY(0.05), { r1: p.explode, color: p.color, life: 0.35 }); if (p.auth) hitSphere(p.src, p.pos, p.explode, p.dmg * 0.6, { kind: p.kind, skill: p.skill }); BR.Audio.fx('boom', { g: 0.4, rate: 1.6, len: 0.5 }); }
        if (p.onEnd) p.onEnd(p);
        S.scene.remove(p.mesh); if (p.mesh.material && !p.keepMat) p.mesh.material.dispose();
        S.projs.splice(i, 1);
      }
    }
  }
  /* ---------- zones persistantes ---------- */
  function spawnZone(f, o) {
    const z = Object.assign({ src: f, t: 0, life: 3, iv: 0.5, acc: 0, pos: o.pos.clone() }, o);
    S.zones.push(z);
    if (z.onStart) z.onStart(z);
    return z;
  }
  function updateZones(dt) {
    for (let i = S.zones.length - 1; i >= 0; i--) {
      const z = S.zones[i], d = dt * tscale(z.team);
      z.t += d; z.acc += d;
      if (z.onUpdate) z.onUpdate(z, d);
      while (z.acc >= z.iv && z.t <= z.life) { z.acc -= z.iv; if (z.onTick) z.onTick(z); }
      if (z.t >= z.life) { if (z.onEnd) z.onEnd(z); S.zones.splice(i, 1); }
    }
  }
  function later(t, fn, team) { S.timers.push({ t, fn, team: team || 'A' }); }

  /* =====================================================================
     BOSS : interface pour les scripts d'attaque (js/arena/boss.js)
     ===================================================================== */
  // multiplicateur de dégâts lié au stade d'évolution du boss
  const bossMul = () => (S.boss && S.boss.dmgMul) || 1;
  G.bossApi = function () {
    const me = () => S.me;
    const inAir = f => f.pos.y - (f.gy || 0) > 0.35;   // n'importe quel saut passe au-dessus d'une onde au sol
    const once = (inst, key) => { inst.hitKeys = inst.hitKeys || new Set(); if (inst.hitKeys.has(key)) return false; inst.hitKeys.add(key); return true; };
    const hurt = (f, dmg, o, inst, key) => {
      if (!f || !f.alive || (o.air && inAir(f))) return false;
      if (inst && !once(inst, key || 'h')) return false;
      const kb = o.kbFrom ? f.pos.clone().sub(o.kbFrom).setY(0).normalize().multiplyScalar(o.kb || 8) : null;
      return hurtFighter(f, dmg * S.diff.dmg * bossMul(), { kb, up: o.up, stun: o.stun, unblockable: o.unblockable, src: null });
    };
    return {
      S, fx: S.fx, V3,
      players: () => [...S.fighters.values()].filter(f => f.alive),
      player: id => S.fighters.get(id),
      me,
      sfx: (n, o) => BR.Audio.fx(n, o), voice: (sp, r, g) => BR.Audio.bossVoice(sp, r, g),
      shake: v => { const d = S.boss ? S.me.pos.distanceTo(S.boss.focus()) : 20; shake(v * BR.clamp(1.3 - d / 50, 0.3, 1.2)); },
      tele: (shape, p, o) => S.fx.decal(p, shape, Object.assign({ world: true }, o)),
      // tests de collision contre le joueur local uniquement (chaque client teste son propre joueur)
      hurtCircle: (x, z, r, dmg, o, inst, key) => { const f = me(); if (Math.hypot(f.pos.x - x, f.pos.z - z) <= r + 0.4 && f.pos.y < (o && o.h || 3)) return hurt(f, dmg, Object.assign({ kbFrom: new V3(x, 0, z) }, o), inst, key); return false; },
      hurtRing: (x, z, r0, r1, dmg, o, inst, key) => { const f = me(), d = Math.hypot(f.pos.x - x, f.pos.z - z); if (d >= r0 - 0.25 && d <= r1 + 0.25) return hurt(f, dmg, Object.assign({ kbFrom: new V3(x, 0, z), air: true }, o), inst, key); return false; },
      hurtSector: (x, z, yaw, r, arc, dmg, o, inst, key) => { const f = me(), dx = f.pos.x - x, dz = f.pos.z - z, d = Math.hypot(dx, dz); if (d > r + 0.4) return false; const a = Math.abs(BR.angDiff(yaw, Math.atan2(dx, dz))); if (a <= arc / 2 || d < 1) return hurt(f, dmg, Object.assign({ kbFrom: new V3(x, 0, z) }, o), inst, key); return false; },
      hurtLine: (x, z, yaw, len, w, dmg, o, inst, key) => { const f = me(), fx2 = Math.sin(yaw), fz = Math.cos(yaw), dx = f.pos.x - x, dz = f.pos.z - z, along = dx * fx2 + dz * fz, side = Math.abs(dx * fz - dz * fx2); if (along >= -0.5 && along <= len && side <= w / 2 + 0.4) return hurt(f, dmg, Object.assign({ kbFrom: new V3(x + fx2 * along, 0, z + fz * along) }, o), inst, key); return false; },
      hurtSphere: (c, r, dmg, o, inst, key) => { const f = me(); if (f.center().distanceTo(c) <= r + 0.5) return hurt(f, dmg, Object.assign({ kbFrom: c }, o), inst, key); return false; },
      // projectiles ennemis (simulés chez chacun, collision avec le joueur local)
      eproj: o => { const p = Object.assign({ t: 0, r: 0.6, dmg: 80, life: 4, color: 0xff4040 }, o); p.pos = o.pos.clone(); p.vel = o.vel.clone(); p.mesh = o.mesh || mkEProjMesh(p); S.scene.add(p.mesh); S.eprojs.push(p); return p; },
      ezone: o => spawnZone(null, Object.assign({ team: 'B' }, o)),
      later: (t, fn) => later(t, fn, 'B'),
      arenaR: R_ARENA(),
      hostSend: d => { if (S.isHost) send(d); },
      diff: S.diff,
    };
  };
  function mkEProjMesh(p) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).lerp(new THREE.Color(0xffffff), 0.5).multiplyScalar(1.3) })); core.scale.setScalar(p.r * 0.45); g.add(core);
    const glow = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(1.1), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(p.r * 0.85); g.add(glow);
    return g;
  }
  function updateEProjs(dt) {
    for (let i = S.eprojs.length - 1; i >= 0; i--) {
      const p = S.eprojs[i];
      if (dt <= 0) continue;
      p.t += dt;
      if (p.homing && S.me.alive) { const want = S.me.center().sub(p.pos).normalize().multiplyScalar(p.vel.length()); p.vel.lerp(want, Math.min(1, dt * p.homing)); }
      if (p.grav) p.vel.y -= p.grav * dt;
      if (p.accel) p.vel.multiplyScalar(1 + p.accel * dt);
      p.pos.addScaledVector(p.vel, dt); p.mesh.position.copy(p.pos);
      if (p.onUpdate) p.onUpdate(p, dt);
      if (Math.random() < dt * 25) S.fx.spark(p.pos, new V3(), { color: p.color, life: 0.25, size: p.r * 1.2, world: true });
      let done = p.t > p.life || (p.grav && p.pos.y <= 0) || Math.hypot(p.pos.x, p.pos.z) > 60;
      const me = S.me;
      if (!done && me.alive && me.center().distanceTo(p.pos) < p.r + 0.45) { if (hurtFighter(me, p.dmg * S.diff.dmg * bossMul(), { kb: p.vel.clone().setY(0).normalize().multiplyScalar(4), stun: p.stun })) { } if (!p.pierce) done = true; else p.pierce--; }
      if (done) { if (p.onEnd) p.onEnd(p); S.scene.remove(p.mesh); p.mesh.traverse(o => o.material && o.material.dispose()); S.eprojs.splice(i, 1); }
    }
  }

  /* =====================================================================
     MODE BOSS : victoire / défaite
     ===================================================================== */
  function bossModeTick(dt) {
    if (S.ended || !S.boss) return;
    if (S.boss.dead && !S.bossDeadT) { S.bossDeadT = S.asc ? 3.2 : 4.5; S.slowT = 1.6; BR.Audio.fx('win'); if (S.asc && BR.Asc) BR.Asc.cleared(S); else banner('VICTOIRE', AR.boss(S.o.boss).name + ' est vaincu', 4, 'gold'); }
    if (S.bossDeadT) {
      S.bossDeadT -= dt;
      // Ascension : pas de fin de partie, les récompenses et les portails apparaissent dans l'arène
      if (S.asc) { if (S.bossDeadT <= 1.6 && !S.ascPost && BR.Asc && BR.Asc.postFloor) { S.ascPost = true; if (!S.me.alive) G.ascTools().revive(S.me, 0.3); BR.Asc.postFloor(S); } return; }
      if (S.bossDeadT <= 0 && S.isHost) finish({ win: true }); return;
    }
    if (S.isHost) {
      const all = [...S.fighters.values()];
      const anyAlive = all.some(f => f.alive || (S.lives[f.id] || 0) >= 0);
      if (!anyAlive) { S.lostT = (S.lostT || 0) + dt; if (S.lostT > 2.5) finish({ win: false }); }
    }
  }
  G.bossDefeated = () => {};

  /* =====================================================================
     DUEL : manches
     ===================================================================== */
  function duelFighting() { return !S.duel || S.duel.state === 'fight'; }
  function duelFrozen() { return S.duel && S.duel.state !== 'fight'; }
  function duelTick(dt) {
    const D = S.duel; if (!D || S.ended) return;
    if (D.state === 'count') {
      const before = Math.ceil(D.t); D.t -= dt; const after = Math.ceil(D.t);
      if (after !== before && after > 0 && after <= 3) { banner(String(after), '', 0.8, 'count'); BR.Audio.fx('tick', { g: 3 }); }
      if (D.t <= 0) { D.state = 'fight'; banner('COMBATTEZ !', '', 0.9, 'gold'); BR.Audio.fx('ult', { g: 0.5 }); }
    } else if (D.state === 'ko') {
      D.t -= dt;
      if (D.t <= 0 && S.isHost) {
        const top = Object.entries(D.wins).sort((a, b) => b[1] - a[1])[0];
        if (top[1] >= 2) { send({ k: 'dr', st: 'end', w: D.wins }); duelEnd(top[0]); }
        else { D.round++; send({ k: 'dr', st: 'count', r: D.round, w: D.wins }); newRound(); }
      }
    }
  }
  /* duel en équipes (2 à 6 équipes, « chacun pour soi » = une équipe par joueur) : une manche se termine quand il ne reste
     qu'une équipe debout ; elle marque un point. Première équipe à 2 manches. D.wins est indexé par équipe ('A'…'F'). */
  function teamsAlive() { const s = new Set(); S.fighters.forEach(f => { if (f.alive) s.add(f.team); }); return s; }
  function duelKO(loser) {
    const D = S.duel; if (D.state !== 'fight') return;
    const alive = teamsAlive(); if (alive.size > 1) return;           // il reste encore plusieurs équipes : le combat continue
    const win = alive.size ? [...alive][0] : (loser ? loser.team : 'A');
    D.wins[win] = (D.wins[win] || 0) + 1; D.state = 'ko'; D.t = 3.2; D.last = win;
    send({ k: 'dr', st: 'ko', w: D.wins, win });
    koFx(win);
  }
  function koFx(team) {
    S.slowT = 1.4; BR.Audio.fx('break'); banner('K.O.', teamLabel(team) + ' remporte la manche', 2.4, team === S.me.team ? 'gold' : 'bad');
    shake(0.6);
  }
  function newRound() {
    const D = S.duel; D.state = 'count'; D.t = 3.2;
    spawnAll(); S.fighters.forEach(f => { f.ult = Math.min(f.ult, 60); f.cds = {}; f.dashN = 2; f.play('Idle', 1); });
    banner('ROUND ' + D.round, S.teams.map(t => teamLabel(t) + ' ' + (D.wins[t] || 0)).join('  —  '), 2.2);
  }
  function duelEnd(team) { finish({ win: team === S.me.team, duel: true, winner: team }); }
  // nom affiché d'une équipe : le joueur s'il est seul (chacun pour soi), sinon « Équipe Rouge »…
  function teamLabel(team) {
    const mem = [...S.fighters.values()].filter(f => f.team === team);
    if (mem.length === 1) return mem[0].name;
    const k = AR.TEAMS.findIndex(t => t.id === team); return 'Équipe ' + (k >= 0 ? AR.TEAMS[k].name : team);
  }

  /* =====================================================================
     RÉSEAU
     ===================================================================== */
  function send(d) { if (S && S.net) BR.Net.relay(d); }
  G.send = send;
  function netTick(dt) {
    if (!S.net) return;
    S.sendT -= dt;
    if (S.sendT <= 0) {
      S.sendT = 1 / 15;
      const m = S.me;
      const st = { k: 'st', p: [+m.pos.x.toFixed(2), +m.pos.y.toFixed(2), +m.pos.z.toFixed(2)], v: [+m.vel.x.toFixed(1), +m.vel.z.toFixed(1)], y: +m.yaw.toFixed(2), hp: Math.round(m.hp), mh: m.maxHp, g: m.guard ? 1 : 0, dn: m.alive ? 0 : 1, w: m.weaponId, u: Math.round(m.ult), l: S.lives[m.id] };
      // pendant un sort entretenu, la visée part avec l'état (les autres voient le rayon suivre la cible)
      if (m.action && m.action.type === 'skill' && m.action.update) { const a = m.ctl.aim; st.a = [+a.x.toFixed(1), +a.y.toFixed(1), +a.z.toFixed(1)]; }
      send(st);
    }
    if (S.isHost && S.boss) {
      S.bsT -= dt;
      if (S.bsT <= 0) { S.bsT = 0.1; send(Object.assign({ k: 'bs' }, S.boss.getState())); }
    }
  }
  function onNet(from, d) {
    if (!S || !d || !d.k) return;
    if (from === S.hostId) { if (S.hostWarned) { S.hostWarned = false; msg('L\'hôte est de retour.'); } S.hostSilent = 0; }
    const f = S.fighters.get(from);
    switch (d.k) {
      case 'st': if (f) { f.net = d; if (d.w && d.w !== f.weaponId) f.setWeapon(d.w); f.hp = d.hp; f.maxHp = d.mh || f.maxHp; f.ult = d.u || 0; if (d.l != null) S.lives[from] = d.l; const dn = !!d.dn; if (dn !== f.down) { f.down = dn; f.alive = !dn; if (!dn) f.play('Lie_StandUp', 1.5); } } break;
      case 'kit': if (f) { f.kit = d.kit; if (d.kit.weapon) f.setWeapon(d.kit.weapon); } break;
      case 'an': if (f) f.play(d.n, d.s || 1, { fade: 0.05 }); if (f && d.d) { f.dashT = d.du || DASH_T; } if (f && d.fx) { startSpin(f, d.fx, d.du || 0.5); if (/flip/.test(d.fx)) f.dashT = 0.3; } break;
      case 'atk': if (f) remoteAttack(f, d); break;
      case 'sk': if (f) remoteCast(f, d); break;
      case 'hit': if (S.isHost && S.boss) { S.boss.damage(d.p, d.d, d.ps || 0, from, { freeze: d.fr, stun: d.st, kind: d.kd ? 'ult' : '' }); if (d.p >= 0 && d.d > 0) { const at = d.p >= 100 ? (S.boss.adds[d.p - 100] || {}).pos : S.boss.partPos(d.p); if (at) S.fx.num(at.clone ? at.clone() : at, d.d, { cls: 'ally' }); } } break;
      case 'bs': if (!S.isHost && S.boss) S.boss.setState(d); break;
      case 'ba': if (!S.isHost && S.boss) S.boss.startAttack(d.n, d); break;
      case 'pd': if (d.to === S.selfId) { if (d.parried) { S.me.stun = Math.max(S.me.stun, d.st || 0.9); S.me.action = null; S.me.play('Hit_B', 1); banner('PARÉ !', '', 0.7, 'bad'); } else hurtFighter(S.me, d.d, { kb: new V3(d.kb[0], 0, d.kb[1]), up: d.up, stun: d.st, freeze: d.fr, unblockable: !!d.ub, src: f, kind: d.kind }); } break;
      case 'ts': if (f) timeStop(f, d.d, 1); break;
      case 'dn': if (f) { f.alive = false; f.down = true; f.play('Death_A', 1); if (S.mode === 'duel' && S.isHost) duelKO(f); } break;
      case 'rv': if (f) { f.alive = true; f.down = false; f.play('Lie_StandUp', 1.5); } break;
      case 'dr': if (!S.isHost && S.duel) {
        S.duel.wins = d.w || S.duel.wins;
        if (d.st === 'ko') { S.duel.state = 'ko'; S.duel.t = 3.2; koFx(d.win); }
        else if (d.st === 'count') { S.duel.round = d.r; newRound(); }
        else if (d.st === 'end') { const top = Object.entries(S.duel.wins).sort((a, b) => b[1] - a[1])[0]; duelEnd(top[0]); }
      } break;
      case 'end': if (!S.isHost && !S.ended) finish(Object.assign({}, d.r, { fromHost: true })); break;
      case 'dg': if (S.env && S.env.onNet) S.env.onNet(from, d); break;
      default: if (S.asc && BR.Asc) BR.Asc.onNet(S, from, d);
    }
  }
  function remoteFighter(f, dt) {
    const n = f.net; if (!n) return;
    // extrapolation légère puis lissage
    const tx = n.p[0] + (n.v ? n.v[0] * 0.05 : 0), tz = n.p[2] + (n.v ? n.v[1] * 0.05 : 0);
    f.pos.x += (tx - f.pos.x) * Math.min(1, dt * 14); f.pos.z += (tz - f.pos.z) * Math.min(1, dt * 14); f.pos.y += (n.p[1] - f.pos.y) * Math.min(1, dt * 16);
    f.vel.set(n.v ? n.v[0] : 0, 0, n.v ? n.v[1] : 0);
    // point visé par le joueur distant (rayon, souffle… qui suivent la visée pendant le sort)
    if (n.a && f.ctl) f.ctl.aim.set(n.a[0], n.a[1], n.a[2]);
    // sort « continu » lancé à distance : on joue son animation image par image ici aussi
    // (avant, seul le lanceur voyait le rayon ultime et les autres effets entretenus)
    const A = f.action;
    if (A && A.type === 'skill' && dt > 0) {
      A.t += dt;
      if (A.update) { try { A.update(A.t, dt); } catch (e) { console.error('sort distant', e); } }
      if (A.t >= A.dur) { const e = A.onEnd; f.action = null; if (e) { try { e(); } catch (er) { console.error(er); } } }
    }
    f.yaw = turn(f.yaw, n.y, dt * 16);
    f.guard = !!n.g; f.dashT = Math.max(0, f.dashT - dt);
  }
  function remoteAttack(f, d) {
    const W = f.weapon;
    if (d.h === 1) { f.play(W.heavy.a, W.heavy.sp); S.fx.flash(f.center(), { color: W.color, r: 0.8, life: 0.18 }); later(W.heavy.hit, () => meleeHit(f, Object.assign({ heavy: true }, W.heavy), 0, 1), 'A'); return; }
    if (d.h === 2) { f.play('1H_Melee_Attack_Chop', 1.4); return; }
    const st = W.combo[d.i % W.combo.length];
    f.play(st.a, st.sp, { fade: 0.05 });
    later(st.hit, () => meleeHit(f, st, 0, 1), 'A');
  }

  /* =====================================================================
     CAMÉRA
     ===================================================================== */
  function shake(v) { if (S) S.shake = Math.min(1.2, S.shake + v); }
  G.shake = shake;
  function updateCamera(dt) {
    const m = S.me, cam = S.cam;
    if (S.lock) {
      const lt = lockTarget();
      if (lt) {
        // verrouillage amorti (pas d'à-coups quand le boss bouge vite)
        const want = yawTo(m.pos, lt); S.camYaw = turn(S.camYaw, want, 1 - Math.exp(-dt * 4.5));
        const dh = lt.y - (m.pos.y + 1.6), dist = Math.hypot(lt.x - m.pos.x, lt.z - m.pos.z);
        const wp = BR.clamp(-Math.atan2(dh, dist) * 0.7 + 0.15, -0.5, 0.9); S.camPitch += (wp - S.camPitch) * (1 - Math.exp(-dt * 2.5));
      } else S.lock = false;
    }
    // recul automatique face aux colosses (lissé)
    let extra = 0;
    if (S.boss && !S.boss.dead) { const d = m.pos.distanceTo(S.boss.focus()); extra = BR.clamp((S.boss.size || 6) * 0.35 * (S.boss.sc || 1) - d * 0.04, 0, 3.8); }
    S.camExtra = S.camExtra == null ? extra : S.camExtra + (extra - S.camExtra) * (1 - Math.exp(-dt * 2.5));
    const dist = S.camDist + S.camExtra;
    const a = S.camYaw, pch = S.camPitch;
    const F = new V3(Math.sin(a), 0, Math.cos(a)), Rt = new V3(-Math.cos(a), 0, Math.sin(a));
    const tgt = new V3(m.pos.x, m.pos.y + 1.55, m.pos.z).addScaledVector(Rt, 0.55);
    // suivi doux : horizontal réactif, vertical plus amorti (les sauts ne secouent pas l'image)
    if (!S.camTgt) S.camTgt = tgt.clone();
    else { const kh = 1 - Math.exp(-dt * 14), kv = 1 - Math.exp(-dt * 7); S.camTgt.x += (tgt.x - S.camTgt.x) * kh; S.camTgt.z += (tgt.z - S.camTgt.z) * kh; S.camTgt.y += (tgt.y - S.camTgt.y) * kv; }
    const pos = S.camTgt.clone().addScaledVector(F, -dist * Math.cos(pch)); pos.y += dist * Math.sin(pch);
    // la caméra reste au-dessus du plateau (sinon on verrait la cascade de près)
    if (S.env && S.env.camClip) S.env.camClip(S.camTgt, pos);
    else for (let k = 0; k < 12 && Math.hypot(pos.x, pos.z) > R_ARENA() + 1.6; k++) pos.lerp(S.camTgt, 0.2);
    if (pos.y < 0.35 && !(S.env && S.env.dungeon)) pos.y = 0.35;
    cam.position.copy(pos);
    cam.lookAt(S.camTgt.clone().addScaledVector(F, 4).setY(S.camTgt.y + 0.2 - Math.sin(pch) * 1.5));
    // tremblement (trauma²)
    S.shake = Math.max(0, S.shake - dt * 1.6);
    const tr = S.shake * S.shake;
    // tremblement fluide (bruit continu plutôt que des sauts aléatoires à chaque image)
    if (tr > 0.001) { const T = S.t * 38; cam.position.x += (Math.sin(T * 1.13) + Math.sin(T * 2.71) * 0.5) * tr * 0.42; cam.position.y += (Math.sin(T * 1.37 + 1) + Math.sin(T * 3.1) * 0.5) * tr * 0.42; cam.rotation.z += Math.sin(T * 0.93 + 2) * tr * 0.035; }
    S.fovKick = Math.max(0, S.fovKick - dt * 30);
    const fov = 70 + S.fovKick + (m.dashT > 0 ? 4 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 12); cam.updateProjectionMatrix(); }
    BR.Audio.listener(cam.position, F);
  }

  /* =====================================================================
     INTERFACE (HUD)
     ===================================================================== */
  function banner(title, sub, dur, cls) { S.banner = { title, sub, t: dur || 1.5, cls: cls || '' }; const b = S.hud && S.hud.querySelector('.a-banner'); if (b) { b.className = 'a-banner on ' + (cls || ''); b.innerHTML = `<b>${BR.esc(title)}</b>${sub ? '<span>' + BR.esc(sub) + '</span>' : ''}`; } }
  G.banner = (t, s, d, c) => S && banner(t, s, d, c);
  function msg(t) { const box = S.hud.querySelector('.a-msgs'); if (!box) return; const e = BR.el('div', null, t); box.appendChild(e); setTimeout(() => e.remove(), 4000); }
  let denyT = 0;
  function deny(t) { if (performance.now() - denyT < 500) return; denyT = performance.now(); BR.Audio.ui('error'); const e = S.hud.querySelector('.a-deny'); if (e) { e.textContent = t; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); } }
  function buildHud() {
    const k = S.kit, K = AR.key;
    const slots = k.s.map((id, i) => `<div class="a-sk" data-i="${i}">${id ? `<img src="${AR.icon(id, 96)}">` : '<div class="a-sk-empty"></div>'}<i class="cd"></i><b class="cdn"></b><span class="key">${K(AR.KEYS.skills[i])}</span>${id ? `<span class="cost">${AR.skill(id).cost}</span>` : ''}</div>`).join('');
    const bossDef = S.mode === 'boss' && S.o.boss ? AR.boss(S.o.boss) : null;
    S.hud.innerHTML = `
      ${bossDef ? `<div class="a-boss" style="--bc:${bossDef.color}"><div class="a-bname">${bossDef.name}<span>${bossDef.sub} · <i style="color:${S.diff.color}">${S.diff.name}</i></span></div><div class="a-bbar"><i class="chip"></i><i class="fill"></i><em class="mark m2"></em><em class="mark m3"></em></div><div class="a-stage"><b class="s1 on">I</b><b class="s2">II</b><b class="s3">III</b><span>${AR.STAGES[1]}</span></div><div class="a-post"><i></i><span>POSTURE</span></div><div class="a-parts"></div></div>` : ''}
      <div class="a-move"></div><div class="a-ripo"><b>RIPOSTE</b><span>Clic gauche</span><i></i></div>
      ${S.mode === 'duel' ? '<div class="a-duel"></div>' : ''}
      <div class="a-allies"></div>
      <div class="a-cross"></div><div class="a-lock"></div>
      <div class="a-combo"><b>0</b><span>COUPS</span><em class="rank"></em><i class="sbar"><i></i></i></div>
      <div class="a-banner"></div><div class="a-deny"></div><div class="a-msgs"></div>
      <div class="a-me">
        <div class="a-bars"><div class="a-hp"><i class="chip"></i><i class="fill"></i><span></span></div><div class="a-en"><i class="fill"></i></div><div class="a-dash"><i></i><i></i></div></div>
        <div class="a-skills">${slots}<div class="a-ult">${k.u ? `<img src="${AR.icon(k.u, 120)}">` : ''}<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"></circle></svg><span class="key">${K(AR.KEYS.ult)}</span><b class="pct"></b></div></div>
      </div>
      <div class="a-help"><b>COMMANDES</b>
        <div><b>${['up', 'left', 'down', 'right'].map(BR.Keys.label).join(' ')}</b> déplacement · <b>${BR.Keys.label('jump')}</b> saut (double saut) · <b>${BR.Keys.label('dash')}</b> esquive · <b>${BR.Keys.label('interact')}</b> prendre une relique</div>
        <div><b>Clic gauche</b> combo · <b>maintenu</b> attaque chargée · <b>en l'air</b> plongeon</div>
        <div><b>Clic droit</b> garde (au bon moment = parade parfaite)</div>
        <div class="hl"><b>Maj</b> esquive : pas de côté / en arrière · <b>vers l'avant</b> glissade · <b>en l'air</b> dash aérien</div>
        <div class="hl"><b>Maj ×2</b> roulade · <b>Espace</b> pendant l'esquive : saut périlleux (passe au-dessus des ondes)</div>
        <div class="hl">Esquive quand le marquage <b>devient blanc</b> = esquive parfaite → <b>Clic gauche</b> : riposte</div>
        ${S.mode === 'boss' ? '<div class="muted">Tu cours en permanence. Le boss évolue (3 stades) selon ses PV perdus et la durée du combat.</div>' : ''}
        <div><b>${AR.KEYS.skills.map(K).join(' ')}</b> compétences · <b>${K(AR.KEYS.ult)}</b> ultime · <b>Tab / clic molette</b> verrouiller la cible</div>
        <div class="muted">H : afficher / masquer · Échap : pause</div></div>
      <div class="a-pause"><div class="box"><h2>PAUSE</h2><p class="muted">${S.solo ? 'Le combat est en pause.' : 'Le combat continue pour les autres joueurs !'}</p><button class="btn primary big" data-a="resume">Reprendre</button><button class="btn big danger" data-a="quit">Abandonner</button></div></div>`;
    S.hud.querySelector('.a-pause').addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'resume') G.lockPointer();
      if (b.dataset.a === 'quit') BR.UI.confirm('Abandonner le combat ?', 'Tu ne gagneras que les points liés aux dégâts infligés.', 'Abandonner').then(ok => { if (ok && S) finish({ win: false, quit: true }); });
    });
    S.hudEls = {
      bfill: S.hud.querySelector('.a-bbar .fill'), bchip: S.hud.querySelector('.a-bbar .chip'), post: S.hud.querySelector('.a-post'), parts: S.hud.querySelector('.a-parts'),
      hp: S.hud.querySelector('.a-hp .fill'), hpchip: S.hud.querySelector('.a-hp .chip'), hpt: S.hud.querySelector('.a-hp span'), en: S.hud.querySelector('.a-en .fill'), dash: S.hud.querySelectorAll('.a-dash i'),
      sk: [...S.hud.querySelectorAll('.a-sk')], ult: S.hud.querySelector('.a-ult'), combo: S.hud.querySelector('.a-combo'), lock: S.hud.querySelector('.a-lock'), allies: S.hud.querySelector('.a-allies'), duel: S.hud.querySelector('.a-duel'), help: S.hud.querySelector('.a-help'),
    };
    // repères de PV des évolutions (70 % et 38 %)
    if (S.hudEls.bfill) { S.hud.querySelector('.a-bbar .m2').style.left = '70%'; S.hud.querySelector('.a-bbar .m3').style.left = '38%'; }
    S.hudEls.stage = S.hud.querySelector('.a-stage'); S.hudEls.ripo = S.hud.querySelector('.a-ripo'); S.hudEls.me = S.hud.querySelector('.a-me'); S.hudStage = 1;
    S.hpChip = 1; S.bChip = 1;
  }
  const tmpV = new V3();
  function updateHud(dt) {
    const H = S.hudEls; if (!H) return;
    const m = S.me;
    // boss
    if (S.boss && H.bfill) {
      const k = Math.max(0, S.boss.hp / S.boss.maxHp);
      H.bfill.style.width = k * 100 + '%'; S.bChip += (k - S.bChip) * Math.min(1, dt * (S.bChip > k ? 1.6 : 10)); H.bchip.style.width = S.bChip * 100 + '%';
      const pk = S.boss.broken > 0 ? 1 : S.boss.posture / S.boss.postureMax;
      H.post.querySelector('i').style.width = pk * 100 + '%'; H.post.classList.toggle('broken', S.boss.broken > 0);
      if (S.boss.partBars) { const html = S.boss.partBars(); if (html !== H.parts._h) { H.parts.innerHTML = html; H.parts._h = html; } }
      if (H.stage && S.boss.stage !== S.hudStage) {
        S.hudStage = S.boss.stage;
        H.stage.querySelectorAll('b').forEach((e, i) => e.classList.toggle('on', i < S.boss.stage));
        H.stage.querySelector('span').textContent = AR.STAGES[S.boss.stage] || '';
        H.stage.classList.remove('flash'); void H.stage.offsetWidth; H.stage.classList.add('flash');
      }
    }
    // riposte disponible / invulnérabilité
    if (H.ripo) { const rk = (m.riposteT || 0) - S.t; H.ripo.classList.toggle('on', rk > 0 && m.alive); if (rk > 0) H.ripo.querySelector('i').style.width = (rk / RIPOSTE_W * 100) + '%'; }
    if (H.me) H.me.classList.toggle('inv', m.inv > 0 && m.alive);
    // duel
    if (H.duel) {
      const fs = [...S.fighters.values()], wins = t => [0, 1].map(j => `<i class="${(S.duel.wins[t] || 0) > j ? 'on' : ''}"></i>`).join('');
      if (fs.length <= 2) H.duel.innerHTML = fs.map((f, i) => `<div class="dp ${i ? 'r' : ''} ${f === m ? 'me' : ''}"><b>${BR.esc(f.name)}</b><div class="dbar"><i style="width:${(f.hp / f.maxHp) * 100}%"></i></div><div class="wins">${wins(f.team)}</div></div>`).join('<div class="vs">VS</div>');
      else {
        // plusieurs équipes : un bloc par équipe (couleur, manches gagnées, PV de chaque membre)
        H.duel.classList.add('many');
        H.duel.innerHTML = S.teams.map(t => { const T = AR.TEAMS.find(x => x.id === t) || AR.TEAMS[0], mem = fs.filter(f => f.team === t);
          return `<div class="dt ${t === m.team ? 'me' : ''}" style="--tc:${T.color}"><div class="dth"><span>${BR.esc(teamLabel(t))}</span><div class="wins">${wins(t)}</div></div>${mem.map(f => `<div class="dtm ${f.alive ? '' : 'ko'}"><b>${BR.esc(f.name)}</b><div class="dbar"><i style="width:${Math.max(0, f.hp / f.maxHp) * 100}%"></i></div></div>`).join('')}</div>`; }).join('');
      }
    }
    // alliés (coop)
    if (S.mode === 'boss' && S.fighters.size > 1) {
      const html = [...S.fighters.values()].filter(f => f !== m).map(f => `<div class="al ${f.alive ? '' : 'dead'}"><b>${BR.esc(f.name)}</b><div class="abar"><i style="width:${(f.hp / f.maxHp) * 100}%"></i></div></div>`).join('');
      if (H.allies._h !== html) { H.allies.innerHTML = html; H.allies._h = html; }
    }
    // moi
    const hk = m.hp / m.maxHp;
    H.hp.style.width = hk * 100 + '%'; S.hpChip += (hk - S.hpChip) * Math.min(1, dt * (S.hpChip > hk ? 1.8 : 10)); H.hpchip.style.width = S.hpChip * 100 + '%';
    H.hpt.textContent = Math.ceil(m.hp) + ' / ' + m.maxHp + (m.shield > 0 ? '  (+' + Math.round(m.shield) + ')' : '');
    H.hp.parentNode.classList.toggle('low', hk < 0.3);
    H.en.style.width = m.energy + '%';
    H.dash.forEach((d, i) => d.classList.toggle('on', i < m.dashN));
    S.kit.s.forEach((id, i) => {
      const el = H.sk[i]; if (!el || !id) return;
      const def = AR.skill(id), cd = m.cds[i] || 0, tot = def.cd * AR.cdMult(m.lv[id] || 1) * (1 - (m.weapon.cdr || 0)) * (m.asc ? m.asc.cdm || 1 : 1);
      el.querySelector('.cd').style.background = cd > 0 ? `conic-gradient(rgba(0,0,0,0.72) ${(cd / tot) * 360}deg, transparent 0)` : '';
      el.querySelector('.cdn').textContent = cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '';
      el.classList.toggle('noen', m.energy < def.cost && !m.buff.domain2); el.classList.toggle('ready', cd <= 0 && m.energy >= def.cost);
    });
    const u = m.ult; H.ult.querySelector('circle').style.strokeDashoffset = String(289 * (1 - u / 100)); H.ult.classList.toggle('ready', u >= 100); H.ult.querySelector('.pct').textContent = u >= 100 ? '' : Math.floor(u) + '%';
    // combo / style
    const ranks = [[0, ''], [10, 'D'], [25, 'C'], [40, 'B'], [55, 'A'], [70, 'S'], [82, 'SS'], [93, 'SSS']];
    let rk = ''; for (const [v, r] of ranks) if (S.style >= v) rk = r;
    H.combo.classList.toggle('on', S.combo > 1);
    H.combo.querySelector('b').textContent = S.combo; const re = H.combo.querySelector('.rank'); if (re.textContent !== rk) { re.textContent = rk; re.className = 'rank r' + rk; re.classList.add('pop'); }
    H.combo.querySelector('.sbar i').style.width = S.style + '%';
    // verrouillage
    const lt = S.lock ? lockTarget() : null;
    if (lt) { tmpV.copy(lt).project(S.cam); H.lock.style.display = tmpV.z < 1 ? '' : 'none'; H.lock.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * innerWidth}px,${(-tmpV.y * 0.5 + 0.5) * innerHeight}px)`; }
    else H.lock.style.display = 'none';
    // bandeau
    if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) { S.banner = null; const b = S.hud.querySelector('.a-banner'); if (b) b.classList.remove('on'); } }
    if (S.helpT > 0) { S.helpT -= dt; } H.help.classList.toggle('on', S.helpT > 0);
  }

  /* =====================================================================
     FIN DE PARTIE
     ===================================================================== */
  function finish(r) {
    if (!S || S.ended) return;
    S.ended = true;
    const time = (performance.now() - S.startT) / 1000;
    const me = S.me;
    const res = Object.assign({ mode: S.mode, boss: S.o.boss, diff: S.diff.id, time, solo: S.solo, bot: !!S.o.bot, selfId: S.selfId }, r);
    res.players = {};
    S.fighters.forEach((f, id) => { res.players[id] = { n: f.name, d: Math.round(f.stats.dmg), p: f.stats.parries, pf: f.stats.perfect, x: f.stats.deaths, sk: f.look ? f.look.skin : (f.av.look || {}).skin }; });
    if (S.isHost && S.net && !r.fromHost) send({ k: 'end', r: { win: res.win, duel: res.duel, winner: res.winner, aborted: res.aborted } });
    if (S.isHost && S.net && !r.aborted && !S.o.asc) BR.Net.send({ t: 'end', res: { arena: 1 } });
    // gains
    const share = S.boss ? Math.min(1, me.stats.dmg / Math.max(1, S.boss.maxHp)) : 0;
    let pts = 0, xp = 0; const lines = [];
    if (S.mode === 'boss') {
      /* butin partagé : la cagnotte d'un boss est la même quel que soit le nombre de joueurs (+15 % par joueur en plus
         pour ne pas pénaliser le jeu en groupe), puis elle est DIVISÉE : la prime de victoire à parts égales,
         la prime de dégâts au prorata des dégâts de chacun. Les bonus d'adresse sont plafonnés. */
      const n = Math.max(1, S.nStart || S.fighters.size), group = 1 + 0.15 * (n - 1);
      if (res.win) { const v = Math.round(520 * group / n); lines.push({ label: n > 1 ? 'Boss vaincu (part de ' + n + ' joueurs)' : 'Boss vaincu', v }); pts += v; xp += Math.round(400 * group / Math.sqrt(n)); }
      const dp = Math.round(320 * group * share); if (dp) { lines.push({ label: 'Dégâts infligés (' + Math.round(share * 100) + ' % du boss)', v: dp }); pts += dp; }
      xp += Math.round(220 * share * group);
      let bonus = 0;
      if (me.stats.parries) { const v = me.stats.parries * 8; lines.push({ label: 'Parades parfaites ×' + me.stats.parries, v }); bonus += v; }
      if (me.stats.perfect) { const v = me.stats.perfect * 5; lines.push({ label: 'Esquives parfaites ×' + me.stats.perfect, v }); bonus += v; }
      if (S.maxCombo >= 25) { const v = Math.min(80, S.maxCombo); lines.push({ label: 'Combo max ×' + S.maxCombo, v }); bonus += v; }
      if (bonus > 160) { lines.push({ label: 'Plafond des bonus', v: 160 - bonus }); bonus = 160; }
      pts += bonus;
      if (!res.win && pts > 0) { const v = -Math.round(pts * 0.4); lines.push({ label: 'Défaite', v }); pts += v; }
      pts = Math.round(pts * S.diff.reward); xp = Math.round(xp * S.diff.reward);
    } else {
      const base = S.o.bot ? Math.round(140 * S.diff.reward) : 260;
      if (res.win) { lines.push({ label: S.o.bot ? 'Victoire contre l\'IA' : 'Victoire en duel', v: base }); pts += base; xp += 250; }
      else { lines.push({ label: 'Participation', v: 60 }); pts += 60; xp += 80; }
      if (me.stats.parries) { const v = me.stats.parries * 10; lines.push({ label: 'Parades parfaites ×' + me.stats.parries, v }); pts += v; }
    }
    if (r.quit || r.aborted) { pts = Math.round(pts * 0.5); xp = Math.round(xp * 0.5); }
    // XP des compétences : utilisation + dégâts
    const skillXp = {};
    for (const id of S.kit.s.concat([S.kit.u])) { if (!id) continue; const used = (me.usage || {})[id] || 0, dmg = me.stats.skills[id] || 0; const v = Math.round(Math.min(80, used * 6 + dmg / 350)); if (v > 0) skillXp[id] = v; }
    const summary = { res, reward: { points: pts, xp, lines }, skillXp, me: me.stats, maxCombo: S.maxCombo, kit: S.kit, hp: me.hp, maxHp: me.maxHp, alive: me.alive, ult: me.ult };
    const onEnd = S.o.onEnd;
    setTimeout(() => { G.stop(); if (onEnd) onEnd(summary); }, r.win || r.duel ? 600 : 300);
  }
  G.finish = r => finish(r || {});
  // Ascension : accès aux outils internes (dégâts de zone, sorts relancés, renaissance sur place)
  G.obstacles = () => (S && S.env && S.env.obstacles) || null;
  G.ascTools = () => ({ hitSphere, hitLine, applyHit, enemiesOf, send, banner, shake, later, hurtFighter,
    recast(f, id, lv, aim) { const impl = BR.ASkills && BR.ASkills[id]; if (!impl) return; const ctx = makeApi(f, true, lv, aim, id); try { impl.cast(ctx); } catch (e) { console.error('écho', e); } send({ k: 'sk', id, lv, x: f.pos.x, y: f.pos.y, z: f.pos.z, yw: f.yaw, a: [aim.x, aim.y, aim.z] }); },
    revive(f, k) { if (!S || S.ended || f.alive) return; f.alive = true; f.down = false; f.hp = Math.max(1, Math.round(f.maxHp * (k || 0.35))); f.inv = 2; f.energy = 100; f.stun = 0; f.action = null; S.lives[f.id] = 0; f.play('Lie_StandUp', 1.5); S.fx.pillar(f.pos.clone(), { color: 0xfff0c0, r: 1.2, h: 16, life: 0.9 }); BR.Audio.fx('heal'); send({ k: 'rv' }); } });
  // outil de test : met un combattant K.O. (vérifie les manches du duel en équipes)
  G._kill = id => { const f = S && S.fighters.get(id); if (f && f.alive) { f.hp = 0; die(f); } };
})();

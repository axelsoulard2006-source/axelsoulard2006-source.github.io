/* ===== arena/horde.js : « LA HORDE » — vagues de serviteurs pour l'Ascension =====
   Pseudo-boss sans corps : l'hôte fait vivre les serviteurs (déplacements, choix d'attaque) et diffuse leurs positions
   (état « ex ») ; chaque attaque part en message { n: '_sw'… , ai } que tous les clients rejouent (marquage au sol,
   effets) en testant leur propre joueur, exactement comme les attaques des colosses.
   Les serviteurs portent les visages des monstres (vos amis) : petite troupe ridicule mais teigneuse. */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, AR = BR.ARENA, AB = BR.ABoss, H = AB.H;
  AR.XBOSS.horde = { id: 'horde', name: 'LA HORDE', sub: 'Vagues de serviteurs', hp: 1, color: '#ff9a3a', music: 'boss_spider', faces: 1 };

  /* types de serviteurs : PV de base, rayon de frappe, vitesse, taille, couleur, coût (budget d'une vague) */
  const T = {
    grunt:  { n: 'Cogneur',     hp: 300,  r: 0.95, sp: 5.6, sz: 1.0,  col: 0xff7a3a, rock: '#5a4a40', cost: 1 },
    boomer: { n: 'Kamikaze',    hp: 140,  r: 0.85, sp: 7.8, sz: 0.85, col: 0xffd23a, rock: '#4a4038', cost: 1 },
    archer: { n: 'Tireur',      hp: 210,  r: 0.9,  sp: 5.0, sz: 0.95, col: 0x4ad8ff, rock: '#3e4a56', cost: 1.5 },
    leaper: { n: 'Bondisseur',  hp: 250,  r: 0.9,  sp: 6.4, sz: 0.9,  col: 0x57ff9a, rock: '#3e5244', cost: 1.5 },
    shaman: { n: 'Chaman',      hp: 620,  r: 1.05, sp: 3.0, sz: 1.1,  col: 0xc070ff, rock: '#4a3e58', cost: 3 },
    brute:  { n: 'Brute',       hp: 1500, r: 1.7,  sp: 3.9, sz: 1.85, col: 0xff3a5a, rock: '#5a3e40', cost: 4, f: 1 },
    // spéciaux (jamais tirés dans une vague) : le gobelin voleur et les totems maudits de l'objectif « totems »
    gobelin: { n: 'Gobelin voleur', hp: 1100, r: 0.85, sp: 9.0, sz: 0.85, col: 0xffc83a, rock: '#4a6a30', cost: 0 },
    totem:   { n: 'Totem maudit',   hp: 1800, r: 1.35, sp: 0,   sz: 1.6,  col: 0xb05aff, rock: '#4e465a', cost: 0 },
  };
  const TYPES = Object.keys(T);
  AB.HORDE_TYPES = T;
  /* élites : un serviteur de la vague devient plus grand, bien plus solide, auréolé d'or, avec UN affixe lisible */
  const ELITE = [null,
    { k: 'veloce',     adj: ['véloce', 'véloce'],          col: 0x7af0ff, css: '#8af4ff' },
    { k: 'blinde',     adj: ['blindé', 'blindée'],         col: 0x8ab8ff, css: '#a8c8ff' },
    { k: 'explosif',   adj: ['explosif', 'explosive'],     col: 0xff5a2a, css: '#ff8a5a' },
    { k: 'invocateur', adj: ['invocateur', 'invocatrice'], col: 0xc070ff, css: '#d8a0ff' },
  ];
  const EL_V = 1, EL_B = 2, EL_X = 3, EL_I = 4, GOLD = 0xffc840;
  AB.HORDE_ELITES = ELITE;
  AB.eliteName = (type, el) => T[type] && ELITE[el] ? T[type].n + ' ' + ELITE[el].adj[T[type].f ? 1 : 0] : '';

  /* composition des vagues d'un étage (appelée par l'hôte de la course, tirage déterministe) */
  AB.hordeWaves = function (floor, nPlayers, rng, extraWave, mod) {
    const pool = ['grunt', 'boomer'];
    if (floor >= 2) pool.push('archer'); if (floor >= 3) pool.push('leaper'); if (floor >= 5) pool.push('shaman', 'brute');
    const nW = Math.min(3, 2 + Math.floor(floor / 5)) + (extraWave ? 1 : 0);
    const out = [];
    for (let w = 0; w < nW; w++) {
      let budget = (6 + floor * 1.2 + w * 2 + (nPlayers - 1) * 2.4) * 1.25;
      const wave = [];
      // la dernière vague a toujours un « gros » (brute ou chaman dès l'étage 5, sinon une meute de cogneurs)
      if (w === nW - 1 && floor >= 5) { const big = rng() < 0.6 ? 'brute' : 'shaman'; wave.push(big); budget -= T[big].cost; }
      if (w === nW - 1 && floor >= 7) { wave.push('brute'); budget -= T.brute.cost; }
      let guard = 0;
      // les cogneurs forment le gros de la troupe ; kamikazes et spécialistes viennent pimenter
      const W = { grunt: 4, boomer: 2, archer: 2.2, leaper: 2, shaman: 1, brute: 1 }, tot = pool.reduce((s, t) => s + W[t], 0);
      const pickT = () => { let x = rng() * tot; for (const t of pool) { x -= W[t]; if (x <= 0) return t; } return pool[0]; };
      while (budget > 0.6 && guard++ < 40) {
        const t = pickT();
        if ((t === 'brute' || t === 'shaman') && wave.filter(x => x === t).length >= (floor >= 7 ? 2 : 1)) continue;
        wave.push(t); budget -= T[t].cost;
      }
      out.push(wave);
    }
    void mod;
    return out;
  };
  AB.hordeTotalHp = (waves, mhp, mod) => waves.reduce((s, w) => s + w.reduce((s2, t) => s2 + Math.round(T[t].hp * mhp * (mod === 'geants' ? 1.45 : 1)), 0), 0);

  const ease = H.ease;
  function horde(S, o) {
    const b = AB.base(S, o, 'horde'), A = b.A, asc = o.asc || {};
    const waves = (asc.waves && asc.waves.length) ? asc.waves : [['grunt', 'grunt', 'boomer'], ['grunt', 'archer', 'boomer', 'grunt']];
    const mhp = asc.mhp || S.diff.hp || 1, giant = asc.mod === 'geants';
    b.size = 2; b.maxStage = 1; b.attacks._hunt = null; b.postureMax = 1e9;
    b.pos.set(0, 0, 0); b.vp.copy(b.pos);
    b.maxHp = b.hp = AB.hordeTotalHp(waves, mhp, asc.mod);
    b.wave = -1; b.nWaves = waves.length; b.queue = []; b.spawnT = 0; b.waveT = 0; b.cleared = false;
    const MAXA = 20;
    /* objectif de l'étage (choisi par la course : asc.obj) — 'waves' : vagues classiques ; 'survie' : tenir un temps donné
       sous un flot continu (la barre de PV = temps restant, ×10) ; 'totems' : détruire 3 totems invocateurs (barre = PV des totems) */
    const MODE = asc.obj === 'survie' ? 'survie' : asc.obj === 'totems' ? 'totems' : 'waves', FLOOR = asc.floor || 1;
    b.mode = MODE;
    b.survD = 35 + 2 * FLOOR;
    if (MODE === 'survie') { b.maxHp = b.hp = Math.round(b.survD * 10); b.nWaves = 1; }
    if (MODE === 'totems') { b.totHp = Math.round(T.totem.hp * mhp * (giant ? 1.45 : 1)); b.maxHp = b.hp = b.totHp * 3; b.totLeft = 3; b.nWaves = 1; }
    // gobelin voleur : ~30 % des étages en vagues dès l'étage 2 (décidé par l'hôte, il apparaît pendant la 2e vague)
    b.gobPlan = MODE === 'waves' && FLOOR >= 2 && b.rng() < 0.3;
    // ce serviteur compte-t-il dans la barre de PV de la horde ?
    const counts = a => MODE === 'waves' ? a.type !== 'gobelin' : MODE === 'totems' ? a.type === 'totem' : false;
    const ownTex = [];
    const geos = {
      ball: new THREE.IcosahedronGeometry(0.62, 1), arm: new THREE.CylinderGeometry(0.13, 0.09, 0.75, 6), horn: new THREE.ConeGeometry(0.14, 0.55, 5),
      orb: new THREE.OctahedronGeometry(0.28, 0), robe: new THREE.ConeGeometry(0.75, 1.6, 7, 1, true), leg: new THREE.CylinderGeometry(0.08, 0.05, 0.8, 5),
      ring: new THREE.TorusGeometry(0.85, 0.05, 6, 28), bomb: new THREE.SphereGeometry(0.6, 14, 10), fuse: new THREE.CylinderGeometry(0.05, 0.05, 0.4, 5),
      pillar: new THREE.BoxGeometry(1.1, 3, 1.1),
    };
    Object.values(geos).forEach(g => b.ownGeos.push(g));
    const lumps = {}; TYPES.forEach((t, k) => { lumps[t] = H.lumpy(0.62, 1, 0.32, 11 + k * 7, 1, t === 'archer' ? 1.35 : t === 'leaper' ? 0.8 : 1.05, 1); b.ownGeos.push(lumps[t]); });
    const mats = {};
    const L = c => new THREE.Color(c).convertSRGBToLinear();
    TYPES.forEach(t => {
      mats[t] = {
        rock: new THREE.MeshStandardMaterial({ color: L(T[t].rock), roughness: 0.75, metalness: 0.1, flatShading: true, emissive: new THREE.Color(0) }),
        glow: new THREE.MeshStandardMaterial({ color: 0x050505, emissive: new THREE.Color(T[t].col), emissiveIntensity: 2.4, roughness: 0.5 }),
      };
      b.ownMats = (b.ownMats || []).concat([mats[t].rock, mats[t].glow]);
    });
    const barBg = new THREE.SpriteMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: false });
    b.ownMats.push(barBg);
    const faces = b.faces && b.faces.length ? b.faces : [0];

    /* ---------- un serviteur modélisé (Blender) : pétales qui le forment, matérialisation de bas en haut ---------- */
    const MODEL = {
      grunt: { s: 0.92, face: 0.78, h: 2.3, pc: ['#ffb070', '#ffffff', '#9ad860'] }, boomer: { s: 0.9, face: 0.8, h: 1.9, pc: ['#ffd23a', '#ff7a3a', '#ffffff'] },
      archer: { s: 0.92, face: 0.58, h: 2.3, pc: ['#4ad8ff', '#ffffff', '#7a9aff'] }, leaper: { s: 1.0, face: 0.62, h: 1.6, pc: ['#7dff9a', '#ffffff', '#e8e07a'] },
      shaman: { s: 0.9, face: 0.58, h: 2.7, pc: ['#c070ff', '#ff9ae0', '#ffffff'] }, brute: { s: 1.25, face: 0.82, h: 2.9, pc: ['#ff5a4a', '#ffb070', '#ffffff'] },
      gobelin: { s: 0.85, face: 0.56, h: 2.3, pc: ['#ffd23a', '#9ad860', '#ffffff'] }, totem: { s: 1.0, face: 0.86, h: 5.1, pc: ['#c070ff', '#ff5ad8', '#ffffff'] },
    };
    const glowSpriteMat = new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g2 = c.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,220,140,0.8)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(), color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    b.ownMats.push(glowSpriteMat);
    const petals = BR.AscFX ? BR.AscFX.petals(S.scene) : null;
    function makeModelAdd(i, type, x, z, born, el) {
      const D = T[type], MD = MODEL[type], src = BR.Assets.models['asc_m_' + type];
      const sc = MD.s * (giant ? 1.3 : 1) * (el ? 1.35 : 1);
      const g = new THREE.Group(); b.group.add(g);
      const root = src.scene.clone(true); g.add(root);
      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
      const node = n => { let r = null; root.traverse(o => { if (!r && o.name === n) r = o; }); return r; };
      const parts = { body: node('body'), head: node('head'), arms: [node('armL'), node('armR')].filter(Boolean), legs: [node('legL'), node('legR')].filter(Boolean), ring: node('ring'), orb: node('orb'), staff: node('staff'), fuse: node('fuse'), sack: node('sack') };
      parts.body0 = parts.body ? parts.body.position.clone() : new V3();
      if (parts.orb) parts.orb0 = parts.orb.position.clone();
      const sparkA = node('spark');
      if (sparkA) { parts.spark = new THREE.Sprite(glowSpriteMat); parts.spark.scale.setScalar(0.5); sparkA.add(parts.spark); }
      // visage (photo) posé sur le repère « face » du modèle
      const fm = AB.faceMesh(faces[(i * 3 + TYPES.indexOf(type)) % faces.length], MD.face, D.col);
      const fa = node('face'); if (fa) fa.add(fm); else { fm.position.set(0, MD.h * 0.7, 0.5); root.add(fm); }
      b.faceMeshes.push(fm);
      g.scale.setScalar(sc);
      const dis = BR.AscFX.dissolve(root, D.col); dis.U.uH.value = MD.h * sc; dis.set(born ? 0 : 1);
      const bg = new THREE.Sprite(barBg); bg.scale.set(1.3, 0.13, 1); bg.position.y = MD.h + 0.3; bg.renderOrder = 10; g.add(bg);
      const fillMat = new THREE.SpriteMaterial({ color: new THREE.Color(D.col).multiplyScalar(1.4), depthTest: false });
      const fill = new THREE.Sprite(fillMat); fill.scale.set(1.24, 0.08, 1); fill.position.y = MD.h + 0.3; fill.renderOrder = 11; g.add(fill);
      bg.visible = fill.visible = !born;
      const a = { i, type, D, MD, g, body: parts.body || root, parts, fm, fill, bg, dis, model: true, pos: new V3(x, 0, z), y: MD.h * 0.42 * sc, r: D.r * (giant ? 1.3 : 1) * (el ? 1.35 : 1), hp: Math.round(D.hp * mhp * (giant ? 1.45 : 1) * (el ? 3.5 : 1)), alive: true, arm: 0,
        yaw: Math.atan2(-x, -z), cd: 1.4 + Math.random(), busy: 0, rise: born ? 0 : 1, t: Math.random() * 6, hk: 1, jump: null, lunge: 0, slow: 0, stun: 0, sc, popT: 0, elite: el | 0, h0: MD.h };
      a.maxHp = a.hp;
      if (type === 'totem') a.y = 1.6 * sc;
      g.position.set(x, 0, z); g.rotation.y = a.yaw;
      fm.userData.U.alpha.value = born ? 0 : 1;
      if (el) { fillMat.color.set(GOLD).multiplyScalar(1.5); decorateElite(a); }
      if (born) {
        const p = new V3(x, 0, z);
        if (petals) petals.gather(p, MD.h * sc, 0.55 * sc, MD.pc, 110, 1.05);
        S.fx.decal(p, 'circle', { r: 1.6 * sc, color: D.col, dur: 1.3, hold: 0.2, noWarn: true });
        S.fx.ring(p.clone().setY(0.05), { r0: 4, r1: 0.4, color: D.col, life: 1.1, world: true });
        BR.Audio.fx('magic', { g: 0.25, rate: 0.6 + Math.random() * 0.2 });
      }
      return a;
    }
    // animation d'un serviteur modélisé (pièces articulées)
    function animModel(a, dt) {
      const P = a.parts, MD = a.MD;
      // apparition : les pétales arrivent (0 → 0,4), le corps se matérialise de bas en haut (0,35 → 0,9), puis « pop »
      if (a.rise < 1) {
        const before = a.rise; a.rise = Math.min(1, a.rise + dt / 1.5);
        const k = Math.max(0, Math.min(1, (a.rise - 0.35) / 0.55)); a.dis.set(k); a.fm.userData.U.alpha.value = Math.max(0, (k - 0.5) * 2);
        if (before < 0.9 && a.rise >= 0.9) {
          const c = a.pos.clone().setY(a.y);
          S.fx.flash(c, { color: a.D.col, r: 1.8 * a.sc, life: 0.3, intensity: 5 }); S.fx.ring(a.pos.clone().setY(0.06), { r1: 3.2 * a.sc, color: a.D.col, life: 0.4, world: true });
          S.fx.burst(c, { n: 26, color: a.D.col, speed: 7, up: 1, life: 0.5, world: true }); a.popT = 0.35; BR.Audio.fx('reveal', { g: 0.18, rate: 1.6 + Math.random() * 0.3 });
        }
        if (a.rise >= 1) { a.bg.visible = a.fill.visible = true; }
      }
      a.popT = Math.max(0, a.popT - dt);
      if (a.type === 'totem') { animTotem(a, dt); return; }
      const pop = a.popT > 0 ? Math.sin((1 - a.popT / 0.35) * Math.PI) * 0.18 : 0;
      const k = a.kick || 0; a.kick = Math.max(0, k - dt * 6);
      a.lastP = a.lastP || a.pos.clone(); const vel = a.pos.clone().sub(a.lastP).length() / Math.max(dt, 1e-3); a.lastP.copy(a.pos);
      const walk = vel > 0.6, ph = a.t * (5 + vel * 1.1), wind = a.wind || 0;
      const fwd = new V3(Math.sin(a.yaw), 0, Math.cos(a.yaw));
      a.g.position.set(a.pos.x + fwd.x * a.lunge * 0.5, (a.hop || 0) + (a.airY || 0), a.pos.z + fwd.z * a.lunge * 0.5);
      a.g.rotation.y += BR.angDiff(a.g.rotation.y, a.yaw) * Math.min(1, dt * 12);
      if (P.sack) { P.sack.rotation.x = (walk ? Math.sin(ph * 2) * 0.12 : Math.sin(a.t * 2) * 0.03) - k * 0.2; P.sack.rotation.z = walk ? Math.sin(ph) * 0.14 : 0; }
      const float = a.type === 'shaman' ? 0.25 + Math.sin(a.t * 1.6) * 0.12 : 0;
      const bob = walk ? Math.abs(Math.sin(ph)) * (a.type === 'boomer' || a.type === 'leaper' ? 0.16 : 0.08) : Math.sin(a.t * 2.4) * 0.025;
      if (P.body) {
        P.body.position.y = P.body0.y + bob + float - wind * 0.08;
        P.body.rotation.x = -wind * 0.25 + a.lunge * 0.35 - k * 0.22;
        P.body.rotation.z = walk ? Math.sin(ph) * (a.type === 'brute' ? 0.07 : 0.1) : 0;
        const sq = pop - k * 0.08 + (a.arm ? Math.sin(a.t * 30) * 0.06 : 0);
        P.body.scale.set(1 + sq + wind * 0.05, 1 - sq * 0.6 - wind * 0.05, 1 + sq + wind * 0.05);
      }
      P.legs.forEach((m, j) => { m.rotation.x = a.type === 'leaper' ? (a.hop ? -0.9 : wind * 0.7) + (walk ? Math.sin(ph * 2 + j) * 0.4 : 0) : walk ? Math.sin(ph + j * Math.PI) * 0.7 : 0; });
      P.arms.forEach((m, j) => {
        if (a.type === 'boomer') { m.rotation.x = Math.sin(a.t * (a.arm ? 26 : 12) + j * 2) * 0.5; m.rotation.z = (j ? -1 : 1) * Math.sin(a.t * 9 + j) * 0.25; return; }
        const swing = walk ? Math.sin(ph + j * Math.PI + Math.PI) * 0.6 : Math.sin(a.t * 1.8 + j) * 0.05;
        const aim = a.type === 'archer' && j === 1 ? -1.1 * Math.max(wind, 0.3) : 0;
        m.rotation.x = (a.raise ? -2.7 : 0) + swing - a.lunge * 1.3 + aim - (a.type === 'shaman' ? wind * 1.6 : 0);
      });
      if (P.head) { P.head.rotation.x = -k * 0.45 + Math.sin(a.t * 2.1) * 0.04; P.head.rotation.y = Math.sin(a.t * 0.9) * 0.15; }
      if (P.ring) { P.ring.rotation.y += dt * (1.5 + wind * 7); P.ring.position.y = (P.ring.userData.y0 == null ? (P.ring.userData.y0 = P.ring.position.y) : P.ring.userData.y0) + Math.sin(a.t * 2) * 0.08; }
      if (P.orb) { P.orb.rotation.y += dt * 2.5; P.orb.position.y = P.orb0.y + Math.sin(a.t * 3) * 0.1; P.orb.scale.setScalar(1 + wind * 0.5); }
      if (P.spark) { P.spark.scale.setScalar((a.arm ? 0.9 : 0.4) + Math.random() * 0.3); if (Math.random() < dt * 18) S.fx.spark(P.spark.getWorldPosition(new V3()), new V3(rnd2(1), 1.5, rnd2(1)), { color: 0xffc040, life: 0.3, size: 0.16, world: true }); }
      if (a.type === 'shaman' && Math.random() < dt * 6) S.fx.spark(a.pos.clone().add(new V3(rnd2(0.7), 0.3, rnd2(0.7))), new V3(0, 1, 0), { color: 0xc070ff, life: 0.8, size: 0.22, size1: 0.02, world: true });
      const hk = Math.max(0, a.hp / a.maxHp); a.hk += (hk - a.hk) * Math.min(1, dt * 10); const kk = Math.max(0.002, a.hk); a.fill.scale.x = 1.24 * kk; a.fill.center.x = 0.5 / kk;
      a.fm.userData.U.hit.value = Math.max(0, a.fm.userData.U.hit.value - dt * 4);
    }
    // totem : immobile, l'orbe tourne et s'emballe quand il invoque, l'énergie fuit de ses fissures quand il faiblit
    function animTotem(a, dt) {
      const P = a.parts, k = a.kick || 0, hurt = 1 - Math.max(0, a.hp / a.maxHp); a.kick = Math.max(0, k - dt * 6);
      a.castT = Math.max(0, (a.castT || 0) - dt);
      const sh = 0.07 * k + 0.03 * hurt * hurt;
      a.g.position.set(a.pos.x + rnd2(sh), 0, a.pos.z + rnd2(sh)); a.g.rotation.y = a.yaw;
      if (P.body) P.body.scale.set(1 + k * 0.03, 1 - k * 0.02, 1 + k * 0.03);
      if (P.orb) { P.orb.rotation.y += dt * (1.4 + a.castT * 9); P.orb.rotation.x += dt * 0.6; P.orb.position.y = P.orb0.y + Math.sin(a.t * 1.8) * 0.15; P.orb.scale.setScalar(1 + a.castT * 0.7 + Math.sin(a.t * 4) * 0.05); }
      if (P.ring) P.ring.rotation.y -= dt * (1.1 + a.castT * 5);
      if (a.rise >= 1 && Math.random() < dt * (3 + hurt * 16)) {
        const ang = Math.random() * 6.283, h = 0.6 + Math.random() * 3.2 * a.sc;
        S.fx.spark(new V3(a.pos.x + Math.sin(ang) * 0.65 * a.sc, h, a.pos.z + Math.cos(ang) * 0.65 * a.sc), new V3(Math.sin(ang) * 1.5, 0.8 + hurt * 2, Math.cos(ang) * 1.5), { color: hurt > 0.5 ? 0xff5ad8 : 0xc070ff, life: 0.5, size: 0.22 + hurt * 0.2, size1: 0.02, world: true });
      }
      const hk = Math.max(0, a.hp / a.maxHp); a.hk += (hk - a.hk) * Math.min(1, dt * 10); const kk = Math.max(0.002, a.hk); a.fill.scale.x = 1.24 * kk; a.fill.center.x = 0.5 / kk;
      a.fm.userData.U.hit.value = Math.max(0, a.fm.userData.U.hit.value - dt * 4);
    }
    const rnd2 = s => (Math.random() - 0.5) * 2 * s;
    // mort d'un serviteur modélisé : dissolution + envol de pétales, puis suppression
    const dying = [];
    function dieModel(a, silent) {
      a.dieT = 0; dying.push(a); a.bg.visible = a.fill.visible = false;
      if (silent) { a.dieT = 1; return; }
      // totem : il se fissure (tremble, crache de l'énergie) puis explose (voir updateDying / totemBoom)
      if (a.type === 'totem') { a.dieT = -0.75; a.crack = true; BR.Audio.fx('break', { g: 0.5, rate: 0.7 }); BR.Audio.fx('charge', { len: 0.75, g: 0.4, rate: 0.8 }); return; }
      const c = a.pos.clone();
      if (petals) petals.burst(c, a.MD.h * a.sc, 0.5 * a.sc, a.MD.pc, 80, 1);
      S.fx.flash(c.clone().setY(a.y), { color: a.D.col, r: 1.6, life: 0.25, intensity: 4 });
      S.fx.spark(c.clone().setY(a.y + 0.5), new V3(0, 3.2, 0), { color: 0xffffff, life: 0.9, size: 0.7, size1: 0.05, world: true });
    }
    function updateDying(dt) {
      for (let j = dying.length - 1; j >= 0; j--) {
        const a = dying[j]; a.dieT += dt;
        if (a.dieT < 0) {   // totem qui se fissure : il tremble de plus en plus, l'énergie jaillit des fissures
          const q = 1 + a.dieT / 0.75;
          a.g.position.set(a.pos.x + rnd2(0.05 + 0.2 * q), 0, a.pos.z + rnd2(0.05 + 0.2 * q));
          a.fm.userData.U.hit.value = q * (0.5 + 0.5 * Math.sin(a.dieT * 60));
          if (Math.random() < dt * (20 + q * 40)) { const ang = Math.random() * 6.283; S.fx.spark(new V3(a.pos.x + Math.sin(ang) * 0.6 * a.sc, 0.5 + Math.random() * 3.5 * a.sc, a.pos.z + Math.cos(ang) * 0.6 * a.sc), new V3(Math.sin(ang) * 6, 1 + Math.random() * 3, Math.cos(ang) * 6), { color: 0xff5ad8, life: 0.35, size: 0.35, size1: 0.05, world: true }); }
          if (Math.random() < dt * 8 && S.fx.debris) S.fx.debris(a.pos.clone(), { n: 3, r: 0.7, speed: 5, size: 0.2, world: true });
          continue;
        }
        if (a.crack) { a.crack = false; totemBoom(a); }
        const k = 1 - a.dieT / 0.7; a.dis.set(k); a.fm.userData.U.alpha.value = Math.max(0, k * 2 - 1);
        a.g.position.y = (a.hop || 0) + (a.airY || 0) + a.dieT * 0.4; if (a.type !== 'totem') a.g.rotation.y += dt * 2;
        if (a.dieT >= 0.7) { dying.splice(j, 1); b.group.remove(a.g); freeAdd(a); }
      }
    }
    b.updateDying = updateDying;
    // libère les ressources propres à un serviteur (une seule fois)
    function freeAdd(a) {
      if (!a || a.freed) return; a.freed = true;
      dropElite(a);
      if (a.dis) a.dis.dispose();
      a.fm.material.dispose(); a.fm.geometry.dispose(); a.fill.material.dispose();
    }
    // explosion finale d'un totem
    function totemBoom(a) {
      const c = a.pos.clone(), col = 0xc070ff, h = a.MD.h * a.sc;
      if (petals) petals.burst(c, h, 0.8 * a.sc, ['#c070ff', '#ff5ad8', '#ffffff'], 220, 1.8);
      S.fx.flash(c.clone().setY(2.2), { color: col, r: 4.5, life: 0.5, intensity: 10 });
      S.fx.ring(c.clone().setY(0.06), { r1: 11, color: col, life: 0.6, world: true });
      S.fx.ring(c.clone().setY(0.06), { r1: 6, color: 0xffffff, life: 0.35, world: true });
      S.fx.pillar(c, { color: col, r: 1.8, h: 22, life: 0.8, world: true });
      S.fx.burst(c.clone().setY(2), { n: 80, color: col, speed: 16, up: 1, life: 0.9, world: true });
      S.fx.burst(c.clone().setY(1), { n: 30, color: 0x3a3440, kind: 'smoke', speed: 8, up: 1, life: 1.2, size: 0.9, grav: 6, world: true });
      if (S.fx.debris) { S.fx.debris(c, { n: 22, r: 1.2, speed: 14, size: 0.55, color: 0x4e465a, world: true }); S.fx.debris(c, { n: 10, r: 0.6, speed: 9, size: 0.3, up: 1.6, world: true }); }
      A.shake(0.6); BR.Audio.fx('boom', { len: 1.4, g: 0.8, rate: 0.8 }); BR.Audio.fx('break', { g: 0.6 });
    }

    /* ---------- élites : aura dorée (anneau qui tourne, lueur, particules), nom, affixe visible ---------- */
    let ER = null;   // ressources partagées par tous les élites (créées au premier élite)
    function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); ownTex.push(t); return t; }
    function eliteRes() {
      if (ER) return ER;
      const ringTex = canvasTex(256, 256, (g, w) => {
        const c = w / 2; g.translate(c, c); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8;
        g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 118, 0, 6.283); g.stroke();
        g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 100, 0, 6.283); g.stroke();
        for (let k = 0; k < 12; k++) { g.save(); g.rotate(k / 12 * 6.283); g.beginPath(); g.moveTo(0, -112); g.lineTo(9, -101); g.lineTo(0, -90); g.lineTo(-9, -101); g.closePath(); g.fill(); g.fillRect(-2, -88, 4, 10); g.restore(); }
        g.lineWidth = 2.5; g.setLineDash([10, 9]); g.beginPath(); g.arc(0, 0, 78, 0, 6.283); g.stroke();
      });
      const glowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(0.35, 'rgba(255,200,80,0.55)'); gr.addColorStop(1, 'rgba(255,160,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
      const hexTex = canvasTex(256, 128, (g, w, h) => {
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 2.2;
        const s = 14; for (let y = -s; y < h + s; y += s * 1.5) for (let x = -s; x < w + s; x += s * 1.732) { const ox = (Math.round(y / (s * 1.5)) % 2) * s * 0.866; g.beginPath(); for (let k = 0; k <= 6; k++) { const an = k / 6 * 6.283 + Math.PI / 6; g.lineTo(x + ox + Math.cos(an) * s * 0.92, y + Math.sin(an) * s * 0.92); } g.stroke(); }
      });
      const crackTex = canvasTex(256, 128, (g, w, h) => {
        g.strokeStyle = '#fff'; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 4; const rr = BR.rngFrom(77);
        for (let n = 0; n < 9; n++) {
          let x = rr() * w, y = rr() * h, ang = rr() * 6.283; g.lineWidth = 3;
          g.beginPath(); g.moveTo(x, y);
          for (let s = 0; s < 7; s++) { ang += (rr() - 0.5) * 1.4; x += Math.cos(ang) * 14; y += Math.sin(ang) * 14; g.lineTo(x, y); if (rr() < 0.3) { g.moveTo(x, y); g.lineTo(x + Math.cos(ang + 1.2) * 12, y + Math.sin(ang + 1.2) * 12); g.moveTo(x, y); } }
          g.stroke();
        }
      });
      const ringGeo = new THREE.PlaneGeometry(2, 2); ringGeo.rotateX(-Math.PI / 2);
      const shieldGeo = new THREE.IcosahedronGeometry(1, 2);
      b.ownGeos.push(ringGeo, shieldGeo);
      const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(GOLD).multiplyScalar(1.8), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const ringMat2 = ringMat.clone(); ringMat2.opacity = 0.45;
      const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(GOLD).multiplyScalar(1.2), blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, depthWrite: false });
      b.ownMats.push(ringMat, ringMat2, glowMat);
      ER = { ringGeo, shieldGeo, ringMat, ringMat2, glowMat, hexTex, crackTex };
      return ER;
    }
    function nameTex(text, css) {
      return canvasTex(512, 112, (g, w, h) => {
        g.font = 'bold 50px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = Math.min(w - 20, g.measureText(text).width + 60);
        g.fillStyle = 'rgba(20,12,4,0.62)'; g.beginPath(); g.moveTo((w - tw) / 2 + 20, 18); g.lineTo((w + tw) / 2 - 20, 18); g.lineTo((w + tw) / 2, h / 2); g.lineTo((w + tw) / 2 - 20, h - 18); g.lineTo((w - tw) / 2 + 20, h - 18); g.lineTo((w - tw) / 2, h / 2); g.closePath(); g.fill();
        g.strokeStyle = css; g.lineWidth = 3; g.stroke();
        const gr = g.createLinearGradient(0, 30, 0, 82); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.5, '#ffd25a'); gr.addColorStop(1, '#e09020');
        g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(text, w / 2, h / 2 + 2); g.fillStyle = gr; g.fillText(text, w / 2, h / 2 + 2);
      });
    }
    function decorateElite(a) {
      const R = eliteRes(), E = ELITE[a.elite]; if (!E) return;
      const eg = new THREE.Group(); b.group.add(eg); a.eg = eg; eg.position.set(a.pos.x, 0, a.pos.z);
      const top = a.h0 * a.sc, rr = Math.max(1.3, a.r * 1.5);
      const ring = new THREE.Mesh(R.ringGeo, R.ringMat); ring.scale.setScalar(rr); ring.position.y = 0.07; ring.renderOrder = 4; eg.add(ring);
      const ring2 = new THREE.Mesh(R.ringGeo, R.ringMat2); ring2.scale.setScalar(rr * 0.62); ring2.position.y = 0.08; ring2.renderOrder = 4; eg.add(ring2);
      const glow = new THREE.Sprite(R.glowMat); glow.scale.setScalar(top * 1.5); glow.position.y = top * 0.45; glow.renderOrder = 5; eg.add(glow);
      const txt = AB.eliteName(a.type, a.elite), tex = nameTex(txt, E.css);
      const nmMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const nm = new THREE.Sprite(nmMat); nm.scale.set(3.4, 0.74, 1); nm.position.y = top + 0.95; nm.renderOrder = 12; eg.add(nm);
      a.el = { ring, ring2, glow, nm, nmMat, tex, top, rr, t: 0 };
      if (a.elite === EL_B) {
        const bm = new THREE.MeshBasicMaterial({ map: R.hexTex, color: new THREE.Color(E.col).multiplyScalar(1.4), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const cm = new THREE.MeshBasicMaterial({ map: R.crackTex, color: new THREE.Color(0xd8ecff).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const bub = new THREE.Mesh(R.shieldGeo, bm), cr = new THREE.Mesh(R.shieldGeo, cm);
        const sr = Math.max(top * 0.62, a.r * 1.25); bub.scale.set(sr, top * 0.62, sr); cr.scale.copy(bub.scale).multiplyScalar(1.01); bub.position.y = cr.position.y = top * 0.5; bub.renderOrder = cr.renderOrder = 6;
        eg.add(bub); eg.add(cr); Object.assign(a.el, { bub, cr, bm, cm });
      }
    }
    // retire l'aura d'un élite (à sa mort ou à la libération)
    function dropElite(a) {
      if (!a || !a.el) return; const e = a.el; a.el = null;
      b.group.remove(a.eg); e.nmMat.dispose(); e.tex.dispose(); const ti = ownTex.indexOf(e.tex); if (ti >= 0) ownTex.splice(ti, 1);
      if (e.bm) { e.bm.dispose(); e.cm.dispose(); }
    }
    function updateElite(a, dt) {
      const e = a.el; if (!e) return;
      e.t += dt; const E = ELITE[a.elite], y0 = (a.hop || 0) + (a.airY || 0), vis = a.rise >= 0.6;
      a.eg.visible = vis; if (!vis) return;
      a.eg.position.set(a.pos.x, 0, a.pos.z);
      e.ring.rotation.y += dt * 1.1; e.ring2.rotation.y -= dt * 1.7;
      const pul = 1 + Math.sin(e.t * 4) * 0.05; e.ring.scale.setScalar(e.rr * pul);
      e.glow.position.y = e.top * 0.45 + y0; e.glow.scale.setScalar(e.top * (1.45 + Math.sin(e.t * 3) * 0.12));
      e.nm.position.y = e.top + 0.95 + y0;
      // particules dorées qui montent autour de lui
      if (Math.random() < dt * 14) { const an = Math.random() * 6.283; S.fx.spark(new V3(a.pos.x + Math.sin(an) * e.rr * 0.85, 0.15, a.pos.z + Math.cos(an) * e.rr * 0.85), new V3(0, 2.2 + Math.random() * 1.5, 0), { color: GOLD, life: 0.9, size: 0.28, size1: 0.03, world: true }); }
      const mv = a.lastE ? Math.hypot(a.pos.x - a.lastE.x, a.pos.z - a.lastE.z) / Math.max(dt, 1e-3) : 0; a.lastE = a.lastE || new V3(); a.lastE.copy(a.pos);
      switch (a.elite) {
        case EL_V:   // véloce : traînée de lumière et de poussière derrière lui
          if (mv > 1.5) {
            for (let k = 0; k < 2; k++) if (Math.random() < dt * 40) S.fx.spark(new V3(a.pos.x + rnd2(0.4), 0.3 + Math.random() * e.top * 0.7 + y0, a.pos.z + rnd2(0.4)), new V3(rnd2(0.3), 0.2, rnd2(0.3)), { color: E.col, life: 0.45, size: 0.55, size1: 0.05, world: true });
            if (Math.random() < dt * 12) S.fx.spark(new V3(a.pos.x, 0.2, a.pos.z), new V3(rnd2(1), 0.6, rnd2(1)), { color: 0x8a8070, kind: 'smoke', life: 0.6, size: 0.5, size1: 1.1, world: true, alpha: 0.5 });
          }
          break;
        case EL_B: {   // blindé : bulle de bouclier qui s'illumine sous les coups et se fissure avec les PV perdus
          const hurt = 1 - Math.max(0, a.hp / a.maxHp); a.shHit = Math.max(0, (a.shHit || 0) - dt * 4);
          e.bub.position.y = e.cr.position.y = e.top * 0.5 + y0; e.bub.rotation.y += dt * 0.4; e.cr.rotation.y = e.bub.rotation.y;
          e.bm.opacity = 0.22 + Math.sin(e.t * 3) * 0.05 + a.shHit * 0.5; e.cm.opacity = Math.min(1, hurt * 1.3) * (0.75 + a.shHit * 0.6);
          e.bm.color.set(E.col).lerp(new THREE.Color(0xff6040), hurt * 0.5).multiplyScalar(1.4 + a.shHit * 1.5);
          break;
        }
        case EL_X:   // explosif : braises et fumée, il « couve »
          if (Math.random() < dt * 16) S.fx.spark(new V3(a.pos.x + rnd2(0.6), 0.4 + Math.random() * e.top * 0.8 + y0, a.pos.z + rnd2(0.6)), new V3(rnd2(0.6), 1.5 + Math.random() * 2, rnd2(0.6)), { color: Math.random() < 0.5 ? 0xff5a2a : 0xffb030, life: 0.6, size: 0.25, size1: 0.02, world: true });
          if (Math.random() < dt * 4) S.fx.spark(new V3(a.pos.x, e.top * 0.9 + y0, a.pos.z), new V3(rnd2(0.4), 1.2, rnd2(0.4)), { color: 0x3a3030, kind: 'smoke', life: 1, size: 0.4, size1: 1, world: true, alpha: 0.55 });
          e.glow.scale.multiplyScalar(1 + Math.max(0, Math.sin(e.t * 9)) * 0.15);   // lueur qui bat comme une mèche
          break;
        case EL_I:   // invocateur : runes violettes en orbite
          for (let k = 0; k < 2; k++) { const an = e.t * 3 + k * Math.PI; S.fx.spark(new V3(a.pos.x + Math.sin(an) * e.rr * 0.8, e.top * 0.55 + Math.sin(e.t * 2 + k) * 0.4 + y0, a.pos.z + Math.cos(an) * e.rr * 0.8), new V3(0, 0.3, 0), { color: E.col, life: 0.35, size: 0.32, size1: 0.05, world: true }); }
          break;
      }
    }
    // mort d'un élite : grosse explosion de pétales dorés (et petit ralenti en solo)
    function eliteDeathFx(a, purge) {
      const E = ELITE[a.elite] || ELITE[1], c = a.pos.clone(), h = a.h0 * a.sc;
      if (petals) petals.burst(c, h, 0.7 * a.sc, ['#ffd76a', '#ffffff', '#ffb030', E.css], 240, 1.8);
      S.fx.flash(c.clone().setY(a.y + 0.5), { color: GOLD, r: 4, life: 0.45, intensity: 9 });
      S.fx.ring(c.clone().setY(0.06), { r1: 9, color: GOLD, life: 0.6, world: true });
      S.fx.ring(c.clone().setY(0.06), { r1: 5, color: E.col, life: 0.45, world: true });
      S.fx.pillar(c, { color: GOLD, r: 1.4, h: 16, life: 0.7, world: true });
      S.fx.burst(c.clone().setY(a.y + 0.5), { n: 60, color: GOLD, speed: 14, up: 1, life: 0.9, world: true });
      A.shake(0.35); BR.Audio.fx('reveal', { g: 0.45, rate: 0.8 }); BR.Audio.fx('boom', { g: 0.3, rate: 1.6, len: 0.6 });
      if (!purge && S.solo) S.slowT = Math.max(S.slowT || 0, 0.4);
    }

    /* ---------- pièces d'or semées par le gobelin (visuel, géré ici : matériau partagé) ---------- */
    const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.045, 12);
    const coinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xffc83a).convertSRGBToLinear(), metalness: 0.85, roughness: 0.3, emissive: new THREE.Color(0xffa020), emissiveIntensity: 0.9 });
    b.ownGeos.push(coinGeo); b.ownMats.push(coinMat);
    const coins = [];
    function dropCoin(p, force) {
      if (coins.length > 70) { const o = coins.shift(); b.group.remove(o.m); }
      const m = new THREE.Mesh(coinGeo, coinMat); m.position.copy(p); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); b.group.add(m);
      const f = force || 1, an = Math.random() * 6.283;
      coins.push({ m, v: new V3(Math.sin(an) * (1 + Math.random() * 2) * f, (3 + Math.random() * 3) * Math.sqrt(f), Math.cos(an) * (1 + Math.random() * 2) * f), w: 6 + Math.random() * 10, t: 0, life: 3.2 + Math.random() });
    }
    function updateCoins(dt) {
      for (let j = coins.length - 1; j >= 0; j--) {
        const o = coins[j], m = o.m; o.t += dt;
        if (m.position.y > 0.06 || o.v.y > 0) { o.v.y -= 22 * dt; m.position.addScaledVector(o.v, dt); m.rotation.x += o.w * dt; if (m.position.y < 0.06) { m.position.y = 0.06; o.v.y = Math.abs(o.v.y) > 2 ? -o.v.y * 0.35 : 0; o.v.x *= 0.5; o.v.z *= 0.5; o.w *= 0.5; if (!o.v.y) m.rotation.x = Math.PI / 2; } }
        else m.rotation.z += dt * 2;
        if (Math.random() < dt * 1.5) S.fx.spark(m.position.clone().setY(m.position.y + 0.1), new V3(0, 0.8, 0), { color: 0xffe080, life: 0.35, size: 0.3, size1: 0.02, world: true });
        const k = (o.t - o.life + 0.4) / 0.4; if (k > 0) m.scale.setScalar(Math.max(0.01, 1 - k));
        if (o.t >= o.life) { b.group.remove(m); coins.splice(j, 1); }
      }
    }
    // gobelin abattu : fontaine de pièces (chez tous)
    function goblinCaughtFx(a) {
      const c = a.pos.clone();
      for (let k = 0; k < 28; k++) dropCoin(c.clone().setY(1.2), 1.6);
      S.fx.flash(c.clone().setY(1), { color: 0xffd23a, r: 2.6, life: 0.35, intensity: 7 });
      S.fx.burst(c.clone().setY(1), { n: 50, color: 0xffd23a, speed: 11, up: 1.5, life: 0.8, world: true });
      if (BR.Audio.pickup) BR.Audio.pickup(); BR.Audio.fx('reveal', { g: 0.4, rate: 1.2 });
      BR.Arena.banner('GOBELIN ATTRAPÉ !', 'Son or est pour vous', 2, 'gold');
    }
    // gobelin qui s'échappe (hôte, puis chaque client via l'état) : nuage de fumée, retiré sans récompense
    function goblinEscape(a) {
      if (!a || !a.alive) return;
      a.escaped = true; a.endK = 'esc';
      const c = a.pos.clone();
      S.fx.burst(c.clone().setY(0.8), { n: 40, color: 0x8a8a90, kind: 'smoke', speed: 5, up: 1.2, life: 1.4, size: 1.1, size1: 2.4, grav: -1, drag: 2, world: true, alpha: 0.8 });
      S.fx.burst(c.clone().setY(1), { n: 24, color: 0xffd23a, speed: 6, up: 1, life: 0.6, world: true });
      S.fx.flash(c.clone().setY(1), { color: 0xffffff, r: 1.6, life: 0.25, intensity: 3 });
      BR.Audio.fx('dash', { g: 0.9 }); BR.Audio.fx('magic', { g: 0.3, rate: 0.5 });
      BR.Arena.banner('Le gobelin s\'est échappé…', 'Avec tout son or', 2, 'bad');
      b.killAdd(a.i, true);
    }

    /* ---------- un serviteur ---------- */
    function makeAdd(i, type, x, z, born, el) {
      el = ELITE[el] ? el : 0;
      if (BR.Assets && BR.Assets.models['asc_m_' + type] && BR.AscFX) return makeModelAdd(i, type, x, z, born, el);
      const D = T[type], M = mats[type], sz = D.sz * (giant ? 1.35 : 1) * (el ? 1.35 : 1);
      const g = new THREE.Group(); b.group.add(g);
      const body = new THREE.Group(); g.add(body);
      const parts = { arms: [], legs: [] };
      const mk = (geo, mat, p, s, r) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; if (p) m.position.set(p[0], p[1], p[2]); if (s) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]); } if (r) m.rotation.set(r[0], r[1], r[2]); body.add(m); return m; };
      let headY = 1.15;
      if (type === 'boomer') { mk(geos.bomb, M.rock, [0, 0.62, 0]); parts.fuse = mk(geos.fuse, M.glow, [0, 1.3, 0]); parts.spark = mk(geos.orb, M.glow, [0, 1.52, 0], 0.5); headY = 0.75; }
      else if (type === 'shaman') { mk(geos.robe, M.rock, [0, 0.8, 0]); mk(lumps.shaman, M.rock, [0, 1.75, 0], 0.62); parts.ring = mk(geos.ring, M.glow, [0, 1.2, 0], 1, [Math.PI / 2, 0, 0]); parts.orb = mk(geos.orb, M.glow, [0.75, 1.9, 0.2], 0.8); headY = 1.75; }
      else if (type === 'totem') { mk(geos.pillar, M.rock, [0, 1.5, 0]); parts.orb = mk(geos.orb, M.glow, [0, 3.5, 0], 1.6); mk(geos.orb, M.glow, [0, 2.5, 0.56], [1.6, 0.35, 0.2]); headY = 1.5; }
      else {
        mk(lumps[type], M.rock, [0, type === 'leaper' ? 0.55 : 0.85, 0]);
        for (const s of [-1, 1]) {
          parts.arms.push(mk(geos.arm, M.rock, [s * 0.66, 0.85, 0.1], type === 'brute' ? 1.5 : 1, [0, 0, s * 0.5]));
          parts.legs.push(mk(type === 'leaper' ? geos.arm : geos.leg, M.rock, [s * 0.3, 0.25, 0], type === 'leaper' ? [1, 1.2, 1] : 1, [0, 0, s * (type === 'leaper' ? 0.9 : 0.1)]));
        }
        if (type === 'brute') { for (const s of [-1, 1]) mk(geos.horn, M.glow, [s * 0.35, 1.55, 0.05], 1, [0, 0, -s * 0.5]); }
        if (type === 'archer') { parts.orb = mk(geos.orb, M.glow, [0, 2.05, 0], 1); }
        if (type === 'gobelin') { mk(geos.bomb, M.rock, [0, 1.15, -0.6], [1.15, 1.25, 1.0]); mk(geos.orb, M.glow, [0, 1.95, -0.6], 0.6); }
        // fissures lumineuses
        mk(geos.orb, M.glow, [0, type === 'leaper' ? 0.6 : 0.9, 0.5], [0.6, 0.5, 0.3]);
        headY = type === 'leaper' ? 0.85 : 1.25;
      }
      const fm = AB.faceMesh(faces[(i * 3 + TYPES.indexOf(type)) % faces.length], type === 'brute' ? 1.05 : 0.95, D.col);
      fm.position.set(0, headY, type === 'shaman' ? 0.42 : 0.55); body.add(fm); b.faceMeshes.push(fm);
      g.scale.setScalar(sz);
      // barre de vie au-dessus de la tête
      // (le décalage du remplissage se fait en espace écran via sprite.center : la barre reste droite quand il tourne)
      const bg = new THREE.Sprite(barBg); bg.center.set(0.5, 0.5); bg.scale.set(1.3, 0.13, 1); bg.position.y = headY + 0.9; bg.renderOrder = 10; g.add(bg);
      const fillMat = new THREE.SpriteMaterial({ color: new THREE.Color(D.col).multiplyScalar(1.4), depthTest: false });
      const fill = new THREE.Sprite(fillMat); fill.center.set(0.5, 0.5); fill.scale.set(1.24, 0.08, 1); fill.position.y = headY + 0.9; fill.renderOrder = 11; g.add(fill);
      const a = { i, type, D, g, body, parts, fm, fill, pos: new V3(x, 0, z), y: 0.9 * sz, r: D.r * (giant ? 1.3 : 1) * (el ? 1.35 : 1), hp: Math.round(D.hp * mhp * (giant ? 1.45 : 1) * (el ? 3.5 : 1)), alive: true, arm: 0,
        yaw: Math.atan2(-x, -z), cd: 1.2 + Math.random(), busy: 0, rise: born ? 0 : 1, t: Math.random() * 6, hk: 1, jump: null, lunge: 0, slow: 0, stun: 0, M, sc: sz, h0: headY + 0.9, elite: el | 0 };
      a.maxHp = a.hp;
      if (type === 'totem') a.y = 1.6 * sz;
      g.position.set(x, 0, z);
      if (el) { fillMat.color.set(GOLD).multiplyScalar(1.5); decorateElite(a); }
      if (born) {
        const p = new V3(x, 0, z);
        S.fx.pillar(p, { color: D.col, r: 1.1 * sz, h: 9, life: 0.6, world: true });
        S.fx.ring(p.clone().setY(0.05), { r1: 2.6 * sz, color: D.col, life: 0.5, world: true });
        S.fx.burst(p.clone().setY(0.4), { n: 18, color: D.col, speed: 6, up: 1, life: 0.5, world: true });
        if (S.fx.debris) S.fx.debris(p, { n: 8, r: 0.8, speed: 6, size: 0.25, world: true });
      }
      return a;
    }
    /* mort d'un serviteur (chez tous). silent : retiré sans effet ni récompense (kamikaze qui explose, gobelin échappé, resynchro) ;
       purge : fin d'objectif (survie / totems) — il explose en pétales mais onAddDeath reçoit silent = true (pas de récompense) */
    b.killAdd = function (i, silent, purge) {
      const a = b.adds[i]; if (!a || !a.alive) return;
      a.alive = false; a.deadAt = b.t; b.faceMeshes = b.faceMeshes.filter(m => m !== a.fm);
      if (purge) a.endK = 'pg';
      if (S.isHost && a.hp > 0 && counts(a)) b.hp = Math.max(0, b.hp - a.hp);
      // élite explosif (hôte) : gros anneau d'alerte puis explosion 1,2 s plus tard
      if (S.isHost && a.elite === EL_X && !silent && !purge && !b.dead) { const P = { k: 'ba', n: '_ex', s: 1, x: +a.pos.x.toFixed(2), z: +a.pos.z.toFixed(2), r: +(Math.max(5.2, a.r * 3.2)).toFixed(2) }; A.hostSend(P); b.startAttack('_ex', P); }
      dropElite(a);
      if (!silent && a.elite) eliteDeathFx(a, purge);
      if (!silent && !purge && a.type === 'gobelin') goblinCaughtFx(a);
      const quiet = !!(silent || purge || a.escaped);
      if (a.model) { dieModel(a, silent); if (!silent) BR.Audio.fx('break', { g: 0.22, rate: 1.5 + Math.random() * 0.3 }); if (BR.Asc && BR.Asc.onAddDeath) BR.Asc.onAddDeath(S, a, quiet); return; }
      b.group.remove(a.g); freeAdd(a);
      if (!silent) {
        const p = a.pos.clone().setY(0.7);
        S.fx.burst(p, { n: 34, color: a.D.col, speed: 9, up: 0.8, life: 0.6, world: true });
        S.fx.burst(p, { n: 12, color: 0x4a4246, kind: 'smoke', speed: 4, life: 0.8, size: 0.5, grav: 10, world: true });
        if (S.fx.debris) S.fx.debris(a.pos.clone(), { n: 10, r: 0.6, speed: 7, size: 0.28, world: true });
        S.fx.flash(p, { color: a.D.col, r: 1.4, life: 0.2, intensity: 4 });
        BR.Audio.fx('break', { g: 0.25, rate: 1.4 + Math.random() * 0.3 });
      }
      if (BR.Asc && BR.Asc.onAddDeath) BR.Asc.onAddDeath(S, a, quiet);
    };
    // dégâts (hôte) : seulement sur les serviteurs ; la barre du « boss » = PV restants de toute la horde
    b.damage = function (i, dmg, posture, src, opt) {
      if (b.dead || i < 100 || !(dmg > 0)) return;
      opt = opt || {};
      const a = b.adds[i - 100]; if (!a || !a.alive) return;
      if (a.elite === EL_B) { dmg *= 0.5; a.shHit = 1; }   // élite blindé : la bulle encaisse la moitié des dégâts
      const d = Math.min(a.hp, dmg); a.hp -= dmg; if (counts(a)) b.hp = Math.max(0, b.hp - d);
      if (src) b.threat[src] = (b.threat[src] || 0) + d;
      a.lastSrc = src;
      if (opt.stun && a.type !== 'totem') a.stun = Math.max(a.stun, opt.stun * 0.8);
      const w0 = { grunt: 1, boomer: 1.3, archer: 1.2, leaper: 1.1, shaman: 0.6, brute: 0.22, gobelin: 0.9, totem: 0 }[a.type], W8 = (w0 == null ? 1 : w0) * (a.elite ? 0.55 : 1), from = src != null && S.fighters && S.fighters.get(src);
      if (from && a.hp > 0) {
        const org = opt.from && opt.from.x != null && Math.hypot(a.pos.x - opt.from.x, a.pos.z - opt.from.z) > 0.3 ? opt.from : from.pos;
        let dx = a.pos.x - org.x, dz = a.pos.z - org.z; const dd = Math.hypot(dx, dz) || 1; dx /= dd; dz /= dd;
        const kb0 = typeof opt.kb === 'number' ? opt.kb : opt.kb && opt.kb.length ? opt.kb.length() : 2.2, kb = kb0 < 0 ? kb0 : kb0 + (opt.kind === 'ult' ? 4 : opt.kind === 'skill' ? 1.5 : 0);
        const v = Math.min(26, kb * 3.2 * W8 * (1 + Math.min(1, dmg / 400)));
        a.kbV = a.kbV || new V3(); a.kbV.x += dx * v; a.kbV.z += dz * v;
        if (W8 > 0.5) a.stun = Math.max(a.stun || 0, 0.12 + Math.min(0.25, dmg / 1500));
      }
      if (opt.freeze && a.type !== 'totem') a.slow = Math.max(a.slow, opt.freeze * 1.5);
      if (a.hp <= 0) { a.hp = 0; b.killAdd(i - 100); }
    };
    // retour visuel d'un coup (client qui frappe) ; o = options du coup (launch : projeté en l'air, purement visuel)
    const AIRW = { grunt: 1, boomer: 1.15, archer: 1.1, leaper: 1.05, shaman: 0.7, brute: 0.25, gobelin: 1, totem: 0 };
    b.hitFx = function (i, at, crit, o) {
      const a = i >= 100 ? b.adds[i - 100] : null; if (!a || !a.alive) return;
      a.fm.userData.U.hit.value = Math.max(a.fm.userData.U.hit.value, crit ? 0.5 : 0.25);
      a.flashT = 0.06; a.kick = 1;
      if (a.elite === EL_B) a.shHit = 1;
      if (o && !a.jump) {
        const w = (AIRW[a.type] == null ? 1 : AIRW[a.type]) * (a.elite ? 0.55 : 1);
        const up = o.launch > 0 ? Math.min(14, o.launch) : o.kind === 'ult' ? 4.5 : 0;
        if (up > 0 && w > 0) { a.airV = Math.max(a.airV || 0, up * w); a.airY = a.airY || 0.001; }
      }
      BR.Audio.fx('bossHit', { g: 0.3, rate: 1.3 });
    };
    // vol plané d'un serviteur projeté (visuel seulement : la position au sol reste celle de l'hôte)
    function updateAir(a, dt) {
      if (!(a.airY > 0) && !(a.airV > 0)) return;
      a.airV = (a.airV || 0) - 32 * dt; a.airY = (a.airY || 0) + a.airV * dt;
      if (a.airY <= 0) {
        const vImp = -a.airV; a.airY = 0;
        if (vImp > 4.5) {   // petit rebond + poussière
          a.airV = vImp * 0.3; a.airY = 0.001; a.kick = 1;
          S.fx.burst(a.pos.clone().setY(0.2), { n: 10, color: 0x8a7a68, kind: 'smoke', speed: 3 + vImp * 0.25, up: 0.2, flat: true, life: 0.6, size: 0.5, size1: 1.1, grav: -0.5, drag: 2, world: true, alpha: 0.6 });
          if (vImp > 9) BR.Audio.fx('land', { g: 0.5 });
        } else a.airV = 0;
      }
    }
    b.focus = function () {
      let best = null, bd = 1e9; const me = S.me ? S.me.pos : new V3();
      for (const a of b.adds) if (a && a.alive) { const d = a.pos.distanceTo(me); if (d < bd) { bd = d; best = a; } }
      return best ? best.pos.clone().setY(best.y) : new V3(0, 1, 0);
    };
    b.partPos = () => b.focus();
    b.move = () => {}; b.choose = () => null; b.animate = () => {};
    b.die = function () { if (b.dead) return; b.dead = true; b.deadT = 0; b.insts.forEach(x => x.cancel && x.cancel()); b.insts = []; };
    b.deathAnim = function (dt) { updateDying(dt); updateCoins(dt); for (const a of b.adds) if (a && a.alive) updateAir(a, dt); };
    b.onBreak = function () {};
    b.partBars = () => {
      const n = b.adds.filter(a => a && a.alive && a.type !== 'totem' && a.type !== 'gobelin').length, en = `<span>${n} ennemi${n > 1 ? 's' : ''}</span>`;
      if (MODE === 'survie') { const s = Math.max(0, Math.ceil(b.hp / 10)); return `<div class="hz-w">TIENS BON ! <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b>${en}</div>`; }
      if (MODE === 'totems') { const left = b.totLeft == null ? 3 : b.totLeft; return `<div class="hz-w">TOTEMS DÉTRUITS <b>${3 - left}</b> / 3${en}</div>`; }
      return `<div class="hz-w">VAGUE <b>${Math.max(1, b.wave + 1)}</b> / ${b.nWaves}${en}</div>`;
    };
    // fin de combat : on libère aussi ce qui reste (auras d'élites, pièces, textures)
    const baseDispose = b.dispose;
    b.dispose = function () {
      b.adds.forEach(a => { if (a) freeAdd(a); }); dying.forEach(freeAdd); dying.length = 0;
      coins.forEach(o => b.group.remove(o.m)); coins.length = 0;
      baseDispose();
      ownTex.forEach(t => t.dispose()); ownTex.length = 0;
    };

    /* ---------- hôte : vagues ---------- */
    function spawnPoint() {
      const ps = A.players();
      for (let k = 0; k < 12; k++) {
        const ang = b.rng() * Math.PI * 2, r = 20 + b.rng() * 9, x = Math.sin(ang) * r, z = Math.cos(ang) * r;
        if (ps.every(p => Math.hypot(p.pos.x - x, p.pos.z - z) > 9)) return [x, z];
      }
      const ang = b.rng() * Math.PI * 2; return [Math.sin(ang) * 26, Math.cos(ang) * 26];
    }
    const pickAffix = () => 1 + Math.min(3, Math.floor(b.rng() * 4));
    // type tiré pour les apparitions continues (survie, totems) : même palette que les vagues de l'étage
    function pickType(alive) {
      const pool = ['grunt', 'boomer']; if (FLOOR >= 2) pool.push('archer'); if (FLOOR >= 3) pool.push('leaper'); if (FLOOR >= 5) pool.push('shaman', 'brute');
      const W = { grunt: 4, boomer: 2, archer: 2.2, leaper: 2, shaman: 0.8, brute: 0.8 }, lim = FLOOR >= 7 ? 2 : 1;
      const ok = pool.filter(t => !((t === 'brute' || t === 'shaman') && alive.filter(a => a.type === t).length >= lim));
      const tot = ok.reduce((s, t) => s + W[t], 0); let x = b.rng() * tot;
      for (const t of ok) { x -= W[t]; if (x <= 0) return t; } return ok[0];
    }
    // crée un serviteur (hôte) dans un emplacement libre ; pre : déjà compté dans les PV de la horde (membre d'une vague)
    function spawnAdd(type, x, z, o) {
      o = o || {};
      // un emplacement libéré depuis peu n'est pas réutilisé : les clients doivent voir sa mort (récompenses, gobelin)
      let slot = b.adds.findIndex(a => !a || (!a.alive && b.t - (a.deadAt || 0) > 0.4)); if (slot < 0) slot = b.adds.length;
      const a = makeAdd(slot, type, x, z, true, o.el | 0); b.adds[slot] = a;
      if (MODE === 'waves' && counts(a)) { const base = o.pre ? Math.round(T[type].hp * mhp * (giant ? 1.45 : 1)) : 0, extra = a.hp - base; if (extra > 0) { b.maxHp += extra; b.hp += extra; } }
      return a;
    }
    function nextWave() {
      b.wave++; b.queue = waves[b.wave].slice(); b.spawnT = 0.6; b.waveT = 0; b.qi = 0; b.eliteAt = {};
      // élites : dès l'étage 2, de plus en plus fréquents (un 2e possible dans la dernière vague dès l'étage 6)
      if (FLOOR >= 2) {
        const nEl = (b.rng() < Math.min(0.9, 0.35 + 0.1 * (FLOOR - 2)) ? 1 : 0) + (FLOOR >= 6 && b.wave === b.nWaves - 1 && b.rng() < 0.5 ? 1 : 0);
        const cand = b.queue.map((t, k) => t !== 'boomer' ? k : -1).filter(k => k >= 0);
        for (let n = 0; n < nEl && cand.length; n++) { const k = cand.splice(Math.floor(b.rng() * cand.length), 1)[0]; b.eliteAt[k] = pickAffix(); }
      }
      const P = { k: 'ba', n: '_wave', s: 1, w: b.wave }; A.hostSend(P); b.startAttack('_wave', P);
    }
    b.attacks._wave = (P) => {
      b.wave = Math.max(b.wave, P.w);
      BR.Arena.banner('VAGUE ' + (P.w + 1) + ' / ' + b.nWaves, P.w === b.nWaves - 1 ? 'Dernière vague !' : '', 1.6, P.w === b.nWaves - 1 ? 'bad' : '');
      A.sfx('roar', { rate: 1.8, g: 0.5 });
      return null;
    };
    // 3 totems loin du centre, ni sur l'axe +Z (portails) ni sur l'axe -Z (arrivée des joueurs)
    function placeTotems() {
      const side = b.rng() < 0.5 ? 1 : -1, obs = BR.Arena.obstacles ? BR.Arena.obstacles() : null;
      const degs = [side * (62 + b.rng() * 16), -side * (62 + b.rng() * 16), side * (122 + b.rng() * 16)];
      return degs.map(dg => {
        const an = dg * Math.PI / 180; let first = null;
        for (let k = 0; k < 9; k++) {
          const r = A.arenaR * (0.6 + ((k % 3) - 1) * 0.07), a2 = an + Math.floor(k / 3) * 0.09 * (k % 2 ? 1 : -1), x = Math.sin(a2) * r, z = Math.cos(a2) * r;
          if (!first) first = [x, z];
          if (!obs || obs.every(o => Math.hypot(o.x - x, o.z - z) > o.r + 2.2)) return [x, z];
        }
        return first;
      });
    }
    function startObjective() {
      if (MODE === 'waves') { nextWave(); return; }
      const P = { k: 'ba', n: '_obj', s: 1, m: MODE, d: b.survD }; A.hostSend(P); b.startAttack('_obj', P);
      if (MODE === 'totems') placeTotems().forEach((p, k) => { const t = spawnAdd('totem', p[0], p[1], {}); t.cd = 2.6 + k * 1.6; });
      b.spawnT = 0.3;
    }
    // fin d'objectif : le gobelin file, les serviteurs restants explosent en pétales, l'étage est nettoyé
    function finishFloor() {
      if (MODE !== 'waves') { const P = { k: 'ba', n: '_end', s: 1, m: MODE }; A.hostSend(P); b.startAttack('_end', P); }
      for (const a of b.adds) if (a && a.alive) { if (a.type === 'gobelin') goblinEscape(a); else b.killAdd(a.i, false, true); }
      b.hp = 0; b.die();
    }
    function thinkWaves(dt, alive) {
      b.waveT += dt;
      const fighting = alive.filter(a => a.type !== 'gobelin');
      // apparition progressive de la vague en cours
      if (b.queue.length) {
        b.spawnT -= dt;
        if (b.spawnT <= 0 && alive.length < MAXA) {
          b.spawnT = 0.16;
          const type = b.queue.shift(), k = b.qi++, [x, z] = spawnPoint();
          spawnAdd(type, x, z, { pre: true, el: b.eliteAt[k] || 0 });
        }
      } else if (fighting.length <= (b.wave < b.nWaves - 1 ? Math.max(1, Math.floor(waves[b.wave].length * 0.25)) : 0)) {
        if (b.wave < b.nWaves - 1) nextWave();
        else if (!fighting.length) {
          const gob = alive.find(a => a.type === 'gobelin');
          // plus que le gobelin : il ne compte pas, mais on laisse une dernière chance de l'attraper (6 s au plus)
          if (gob) { if (!gob.lastCall) { gob.lastCall = 1; gob.escT = Math.min(gob.escT == null ? 6 : gob.escT, 6); } }
          else { finishFloor(); return true; }
        }
      }
      return false;
    }
    function thinkSurvie(dt, alive) {
      b.survT = (b.survT || 0) + dt;
      const left = Math.max(0, b.survD - b.survT); b.hp = Math.round(left * 10);
      if (left <= 0) { finishFloor(); return true; }
      const nP = Math.max(1, A.players().length), cap = Math.min(MAXA - 1, 5 + nP * 2 + Math.floor(FLOOR / 2)), k = b.survT / b.survD;
      b.spawnT -= dt;
      if (b.spawnT <= 0 && alive.length < cap) {
        b.spawnT = Math.max(0.4, (1.45 - 0.6 * k) / (1 + 0.25 * (nP - 1)));
        const type = pickType(alive); let el = 0;
        if (FLOOR >= 2 && type !== 'boomer' && b.survT - (b.lastElT || 0) > Math.max(9, 17 - FLOOR) && !alive.some(a => a.elite)) { el = pickAffix(); b.lastElT = b.survT; }
        const [x, z] = spawnPoint(); spawnAdd(type, x, z, { el });
      }
      return false;
    }
    function thinkTotems(dt, alive) {
      const tots = alive.filter(a => a.type === 'totem');
      b.totLeft = tots.length; b.hp = tots.reduce((s, a) => s + Math.max(0, a.hp), 0);
      if (!tots.length) { finishFloor(); return true; }
      return false;
    }
    // totem (hôte) : invoque un serviteur toutes les ~5 s (rayon magique vers le sol)
    function thinkTotem(a, dt, alive) {
      if (a.rise < 1) return;
      a.cd -= dt; if (a.cd > 0) return;
      a.cd = 4.6 + b.rng();
      const nP = Math.max(1, A.players().length), cap = Math.min(MAXA - 3, 4 + 2 * nP + Math.floor(FLOOR / 3));
      if (alive.filter(o => o.type !== 'totem').length >= cap) { a.cd = 1.5; return; }
      const an = b.rng() * 6.283, r = 3.2 + b.rng() * 2.5, [x, z] = H.clampR(a.pos.x + Math.sin(an) * r, a.pos.z + Math.cos(an) * r, A.arenaR - 1.5);
      const type = pickType(alive), el = FLOOR >= 3 && type !== 'boomer' && !alive.some(o => o.elite) && b.rng() < Math.min(0.12, 0.04 + 0.01 * FLOOR) ? pickAffix() : 0;
      const P = { k: 'ba', n: '_tb', s: 1, ai: a.i, tx: +x.toFixed(2), tz: +z.toFixed(2) }; A.hostSend(P); b.startAttack('_tb', P);
      spawnAdd(type, x, z, { el });
    }
    // gobelin (hôte) : apparaît ~2 s après le début de la 2e vague
    function thinkGoblinSpawn(dt) {
      if (!b.gobPlan || b.gobDone || b.wave < 1) return;
      b.gobT = (b.gobT || 0) + dt; if (b.gobT < 2.2) return;
      b.gobDone = true;
      const [x, z] = spawnPoint(), g = spawnAdd('gobelin', x, z, {}); g.escT = 14;
      const P = { k: 'ba', n: '_gob', s: 1 }; A.hostSend(P); b.startAttack('_gob', P);
    }
    // gobelin (hôte) : fuit les joueurs en zigzag, longe le bord de l'arène, nargue quand on est loin, s'échappe au bout de 14 s
    function thinkGob(a, dt, ps) {
      if (a.rise < 1) return;
      a.escT = (a.escT == null ? 14 : a.escT) - dt; if (a.escT <= 0) { goblinEscape(a); return; }
      a.stun -= dt; a.slow -= dt; if (a.stun > 0) return;
      let fx = 0, fz = 0, near = 1e9;
      for (const p of ps) { const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 0.1; near = Math.min(near, d); const w = 1 / Math.max(2, d * d); fx += dx / d * w; fz += dz / d * w; }
      let l = Math.hypot(fx, fz); if (l < 1e-6) { fx = -a.pos.x; fz = -a.pos.z; l = Math.hypot(fx, fz) || 1; } fx /= l; fz /= l;
      const R = A.arenaR - 1.5, rr = Math.hypot(a.pos.x, a.pos.z);
      if (rr > R * 0.62) {   // près du bord : on retire la composante vers le mur et on file le long de celui-ci
        const k = Math.min(1, (rr - R * 0.62) / (R * 0.38)), nx = a.pos.x / rr, nz = a.pos.z / rr, out = fx * nx + fz * nz;
        if (out > 0) { fx -= nx * out * Math.min(1, k * 1.6); fz -= nz * out * Math.min(1, k * 1.6); }
        const tx = -nz, tz = nx, tg = fx * tx + fz * tz;
        a.tSide = a.tSide || (Math.sign(tg) || 1); if (Math.sign(tg) === -a.tSide && Math.abs(tg) > 0.5) a.tSide *= -1;
        fx += tx * a.tSide * k * 1.2 - nx * k * 0.35; fz += tz * a.tSide * k * 1.2 - nz * k * 0.35;
        l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
      }
      a.zz = (a.zz || 0) + dt; const zig = Math.sin(a.zz * 5.2 + a.i) * 0.7;
      let mx = fx - fz * zig, mz = fz + fx * zig; l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
      const sp = a.D.sp * b.speed * (a.slow > 0 ? 0.5 : 1) * (near < 7 ? 1.05 : near > 18 ? 0.55 : 0.85);
      a.pos.x += mx * sp * dt; a.pos.z += mz * sp * dt;
      a.yaw += BR.angDiff(a.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 10);
      const [cx, cz] = H.clampR(a.pos.x, a.pos.z, A.arenaR - 0.8); a.pos.x = cx; a.pos.z = cz;
      const obs = BR.Arena.obstacles ? BR.Arena.obstacles() : null;
      if (obs) for (const o of obs) { const dx = a.pos.x - o.x, dz = a.pos.z - o.z, dd = Math.hypot(dx, dz), m = o.r + a.r * 0.8; if (dd < m && dd > 1e-3) { a.pos.x = o.x + dx / dd * m; a.pos.z = o.z + dz / dd * m; const tx = -dz / dd, tz = dx / dd, s = Math.sign(tx * mx + tz * mz) || 1; a.pos.x += tx * s * sp * dt; a.pos.z += tz * s * sp * dt; } }
      a.moving = true;
    }
    // élite invocateur (hôte) : 2 cogneurs toutes les ~7 s, dans un cercle magique
    function thinkSummoner(a, dt, alive) {
      if (a.rise < 1) return;
      a.sumT = (a.sumT == null ? 3.5 : a.sumT) - dt; if (a.sumT > 0) return;
      a.sumT = 7 + b.rng();
      if (alive.length >= MAXA - 2) return;
      const pts = [];
      for (let k = 0; k < 2; k++) { const an = a.yaw + (k ? 1 : -1) * (1.1 + b.rng() * 0.6), r = 2.6 + b.rng(), [x, z] = H.clampR(a.pos.x + Math.sin(an) * r, a.pos.z + Math.cos(an) * r, A.arenaR - 1.5); pts.push([+x.toFixed(2), +z.toFixed(2)]); }
      a.busy = Math.max(a.busy, 0.8);
      const P = { k: 'ba', n: '_inv', s: 1, ai: a.i, pts }; A.hostSend(P); b.startAttack('_inv', P);
      pts.forEach(p => spawnAdd('grunt', p[0], p[1], {}));
    }
    b.thinkAdds = function (dt) {
      if (b.dead) return;
      const alive = b.adds.filter(a => a && a.alive);
      // objectif lancé après le titre de l'étage
      if (!b.started) { b.startT = (b.startT || 0) + dt; if (b.startT < 1.6) return; b.started = true; startObjective(); return; }
      if ((MODE === 'waves' ? thinkWaves : MODE === 'survie' ? thinkSurvie : thinkTotems)(dt, alive)) return;
      thinkGoblinSpawn(dt);
      const ps = A.players(); if (!ps.length) return;
      for (const a of alive) {
        if (!a.alive) continue;
        if (a.type === 'totem') { thinkTotem(a, dt, alive); continue; }
        if (a.kbV && (a.kbV.x || a.kbV.z)) {
          a.pos.x += a.kbV.x * dt; a.pos.z += a.kbV.z * dt; const k = Math.exp(-dt * 9); a.kbV.x *= k; a.kbV.z *= k; if (Math.abs(a.kbV.x) + Math.abs(a.kbV.z) < 0.2) a.kbV.set(0, 0, 0);
          const [cx, cz] = H.clampR(a.pos.x, a.pos.z, A.arenaR - 0.8); a.pos.x = cx; a.pos.z = cz;
          const obs = BR.Arena.obstacles ? BR.Arena.obstacles() : null; if (obs) for (const o of obs) { const dx = a.pos.x - o.x, dz = a.pos.z - o.z, dd = Math.hypot(dx, dz), m = o.r + a.r * 0.8; if (dd < m && dd > 1e-3) { a.pos.x = o.x + dx / dd * m; a.pos.z = o.z + dz / dd * m; a.kbV.multiplyScalar(0.3); } }
        }
        if (a.type === 'gobelin') { thinkGob(a, dt, ps); continue; }
        if (a.elite === EL_I) thinkSummoner(a, dt, alive);
        thinkOne(a, dt, ps, alive);
      }
    };
    function nearestP(a, ps) { let tg = null, td = 1e9; for (const f of ps) { const d = Math.hypot(f.pos.x - a.pos.x, f.pos.z - a.pos.z) + (a.tgId === f.id ? -2 : 0); if (d < td) { td = d; tg = f; } } return [tg, Math.hypot(tg.pos.x - a.pos.x, tg.pos.z - a.pos.z)]; }
    function attack(a, n, extra) {
      const P = Object.assign({ k: 'ba', n, s: (Math.random() * 1e9) >>> 0, ai: a.i, x: +a.pos.x.toFixed(2), z: +a.pos.z.toFixed(2), yw: +a.yaw.toFixed(3) }, extra || {});
      A.hostSend(P); b.startAttack(n, P);
    }
    function thinkOne(a, dt, ps, alive) {
      if (a.rise < 1 || a.jump) return;
      a.cd -= dt * (a.elite === EL_V ? 1.25 : 1); a.busy -= dt; a.stun -= dt; a.slow -= dt;
      if (a.stun > 0 || a.busy > 0) return;
      const [tg, d] = nearestP(a, ps); if (!tg) return; a.tgId = tg.id;
      const dir = new V3(tg.pos.x - a.pos.x, 0, tg.pos.z - a.pos.z); if (dir.lengthSq() > 1e-4) dir.normalize();
      const want = Math.atan2(dir.x, dir.z); a.yaw += BR.angDiff(a.yaw, want) * Math.min(1, dt * 7);
      let mv = 0; const sp = a.D.sp * b.speed * (a.slow > 0 ? 0.45 : 1) * (S.asc && S.asc.mod === 'rapide' ? 1.3 : 1) * (a.elite === EL_V ? 1.4 : 1);
      switch (a.type) {
        case 'grunt': if (d > 2.3) mv = 1; else if (a.cd <= 0) { a.cd = 2.0 + b.rng() * 0.8; a.busy = 0.85; attack(a, '_sw'); } break;
        case 'boomer': if (d > 2.2) mv = 1; else { a.busy = 9; attack(a, '_bo'); } break;
        case 'archer':
          if (d < 9) mv = -1; else if (d > 17) mv = 1;
          if (a.cd <= 0 && d < 30) { a.cd = 2.6 + b.rng() * 1.2; a.busy = 0.7; attack(a, '_ar', { tx: +tg.pos.x.toFixed(2), tz: +tg.pos.z.toFixed(2) }); }
          break;
        case 'leaper':
          if (a.cd <= 0 && d > 4 && d < 15) { a.cd = 3.6 + b.rng(); a.busy = 1.3; const [tx, tz] = H.clampR(tg.pos.x + tg.vel.x * 0.35, tg.pos.z + tg.vel.z * 0.35, A.arenaR - 1); attack(a, '_le', { tx: +tx.toFixed(2), tz: +tz.toFixed(2) }); }
          else if (d > 3) mv = 1; else if (a.cd <= 0) { a.cd = 1.8; a.busy = 0.85; attack(a, '_sw'); }
          break;
        case 'shaman':
          if (d < 12) mv = -1; else if (d > 22) mv = 1;
          if (a.cd <= 0) {
            a.cd = 5.5 + b.rng() * 1.5; a.busy = 1.2;
            const hurtAllies = alive.filter(o => o !== a && o.hp < o.maxHp * 0.8 && o.pos.distanceTo(a.pos) < 14);
            if (hurtAllies.length && b.rng() < 0.5) { const ids = hurtAllies.slice(0, 4).map(o => o.i); ids.forEach(k => { const o = b.adds[k], h = Math.round(o.maxHp * 0.3); const gain = Math.min(h, o.maxHp - o.hp); o.hp += gain; b.hp += gain; }); attack(a, '_he', { ids }); }
            else attack(a, '_ru', { pts: ps.map(p => [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)]) });
          }
          break;
        case 'brute': if (d > 4.2) mv = 1; else if (a.cd <= 0) { a.cd = 3.4 + b.rng(); a.busy = 1.6; attack(a, '_sl'); } break;
      }
      // séparation (les serviteurs ne s'empilent pas)
      let sx = 0, sz = 0;
      for (const o of alive) { if (o === a) continue; const dx = a.pos.x - o.pos.x, dz = a.pos.z - o.pos.z, dd = Math.hypot(dx, dz), m = (a.r + o.r) * 1.1; if (dd < m && dd > 1e-3) { sx += dx / dd * (m - dd); sz += dz / dd * (m - dd); } }
      a.pos.x += (dir.x * mv * sp) * dt + sx * dt * 4; a.pos.z += (dir.z * mv * sp) * dt + sz * dt * 4;
      const [cx, cz] = H.clampR(a.pos.x, a.pos.z, A.arenaR - 0.8); a.pos.x = cx; a.pos.z = cz;
      // contourne le décor : repoussé hors de l'obstacle et glisse le long de son bord
      const obs = BR.Arena.obstacles ? BR.Arena.obstacles() : null;
      if (obs) for (const o of obs) { const dx = a.pos.x - o.x, dz = a.pos.z - o.z, dd = Math.hypot(dx, dz), m = o.r + a.r * 0.8; if (dd < m && dd > 1e-3) { a.pos.x = o.x + dx / dd * m; a.pos.z = o.z + dz / dd * m; const tx = -dz / dd, tz = dx / dd, s = Math.sign(tx * dir.x + tz * dir.z) || 1; a.pos.x += tx * s * sp * dt * 0.8; a.pos.z += tz * s * sp * dt * 0.8; } }
      a.moving = mv !== 0;
    }

    /* ---------- attaques (rejouées chez tous) ---------- */
    const addOf = P => { const a = b.adds[P.ai]; return a && a.alive ? a : null; };
    // coup de poing en éventail
    b.attacks._sw = (P) => {
      const a = addOf(P), yaw = P.yw, R = 3.2 * (giant ? 1.25 : 1), col = a ? a.D.col : 0xff7a3a;
      S.fx.decal({ x: P.x, z: P.z }, 'sector', { r: R, arc: 1.9, yaw, color: 0xff3020, dur: 0.6 });
      const inst = { dur: 0.8, main: false, update(t) {
        if (a) { a.yaw = yaw; a.wind = t < 0.6 ? t / 0.6 : Math.max(0, 1 - (t - 0.6) * 5); }
        if (t >= 0.6 && !inst.h) {
          inst.h = 1; if (a) a.lunge = 1;
          S.fx.slash(new V3(P.x, 1, P.z), yaw, { r: R, arc: 1.9, color: col, life: 0.22 });
          A.sfx('swing', { g: 0.35, rate: 0.8 });
          A.hurtSector(P.x, P.z, yaw, R, 1.9, 70, { kb: 7, up: 3 }, inst, 's');
        }
      } };
      return inst;
    };
    // kamikaze : s'arrête, clignote, explose
    b.attacks._bo = (P) => {
      const a = addOf(P), R = 3.3 * (giant ? 1.25 : 1);
      S.fx.decal({ x: P.x, z: P.z }, 'circle', { r: R, color: 0xff3020, dur: 0.75 });
      A.sfx('charge', { len: 0.8, g: 0.35, rate: 1.6 });
      const inst = { dur: 0.8, main: false, update(t) {
        if (a && a.alive) { a.arm = 1; a.fm.userData.U.hit.value = 0.5 + 0.5 * Math.sin(t * 50); }
        if (t >= 0.75 && !inst.h) {
          inst.h = 1;
          H.blast(b, inst, 'b', P.x, P.z, R, 95, 0xffb23a, { g: 0.55, rate: 1.4, shake: 0.25, light: true });
          if (a && a.alive) b.killAdd(a.i, true);
        }
      } };
      return inst;
    };
    // tireur : visée en ligne puis salve de 3
    b.attacks._ar = (P) => {
      const a = addOf(P), yaw = Math.atan2(P.tx - P.x, P.tz - P.z), col = 0x4ad8ff;
      S.fx.decal({ x: P.x, z: P.z }, 'line', { len: 16, width: 1.3, yaw, color: 0xff3020, dur: 0.55 });
      const inst = { dur: 0.7, main: false, update(t) {
        if (a) { a.yaw = yaw; a.wind = Math.min(1, t / 0.55); }
        if (t >= 0.55 && !inst.h) {
          inst.h = 1; if (a) a.lunge = 0.5;
          const from = new V3(P.x, 1.6 * (a ? a.D.sz : 1), P.z);
          H.fan(b, from, yaw, 3, 0.36, 19, { dmg: 52, r: 0.5, color: col, life: 2.4 });
          A.sfx('magic', { g: 0.3, rate: 1.4 });
        }
      } };
      return inst;
    };
    // bondisseur : saut en cloche sur la position du joueur
    b.attacks._le = (P) => {
      const a = addOf(P), T0 = 0.85, R = 2.9, p0 = new V3(P.x, 0, P.z), p1 = new V3(P.tx, 0, P.tz);
      S.fx.decal(p1, 'circle', { r: R, color: 0xff3020, dur: T0 });
      A.sfx('jump', { g: 0.4, rate: 0.8 });
      if (a) a.jump = { t: 0 };
      const inst = { dur: T0 + 0.15, main: false, update(t) {
        if (a && a.alive) {
          const k = Math.min(1, t / T0); a.pos.lerpVectors(p0, p1, ease(k)); a.hop = Math.sin(k * Math.PI) * 5.5; a.yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);
          if (t >= T0) { a.hop = 0; a.jump = null; }
        }
        if (t >= T0 && !inst.h) { inst.h = 1; H.blast(b, inst, 'l', p1.x, p1.z, R, 85, 0x57ff9a, { g: 0.5, rate: 1.2, shake: 0.3, smoke: 0x3e5244 }); A.sfx('stomp', { g: 0.5 }); }
      }, end() { if (a) { a.hop = 0; a.jump = null; } }, cancel() { this.end(); } };
      return inst;
    };
    // brute : frappe au sol + onde (à sauter)
    b.attacks._sl = (P) => {
      const a = addOf(P), yaw = P.yw, c = new V3(P.x + Math.sin(yaw) * 1.6, 0, P.z + Math.cos(yaw) * 1.6), R = 4.4 * (giant ? 1.2 : 1);
      S.fx.decal(c, 'circle', { r: R, color: 0xff3020, dur: 1.0 });
      A.sfx('roar', { rate: 1.3, g: 0.45 });
      const inst = { dur: 1.2, main: false, update(t) {
        if (a) { a.yaw = yaw; a.wind = t < 1.0 ? Math.min(1, t / 0.8) : Math.max(0, 1 - (t - 1.0) * 6); a.raise = t < 1.0; }
        if (t >= 1.0 && !inst.h) {
          inst.h = 1; if (a) { a.lunge = 1; a.raise = false; }
          H.blast(b, inst, 'sl', c.x, c.z, R, 120, 0xff3a5a, { g: 0.8, rate: 0.9, shake: 0.5, light: true });
          H.wave(b, c.x, c.z, { r0: R, rMax: 13, dmg: 60, color: 0xff3a5a, kb: 6, up: 5, noDebris: true });
          A.sfx('stomp');
        }
      }, end() { if (a) a.raise = false; } };
      return inst;
    };
    // chaman : runes sous les pieds de chaque joueur
    b.attacks._ru = (P) => {
      const a = addOf(P), pts = P.pts || [], R = 2.5, col = 0xc070ff;
      pts.forEach(p => S.fx.decal({ x: p[0], z: p[1] }, 'circle', { r: R, color: 0xb040ff, dur: 1.3 }));
      A.sfx('magic', { g: 0.45, rate: 0.6 });
      const inst = { dur: 1.5, main: false, update(t) {
        if (a) a.wind = Math.min(1, t / 1.3);
        if (t < 1.3 && Math.random() < 0.6) pts.forEach(p => S.fx.spark(new V3(p[0] + (Math.random() - 0.5) * R * 1.6, 0.1, p[1] + (Math.random() - 0.5) * R * 1.6), new V3(0, 3, 0), { color: col, life: 0.5, size: 0.3, world: true }));
        if (t >= 1.3 && !inst.h) {
          inst.h = 1; if (a) a.wind = 0;
          pts.forEach((p, k) => { H.blast(b, inst, 'r' + k, p[0], p[1], R, 85, col, { g: 0.4, rate: 1.5, quiet: k > 0, shake: 0.15 }); S.fx.pillar(new V3(p[0], 0, p[1]), { color: col, r: 1.1, h: 10, life: 0.4, world: true }); });
        }
      } };
      return inst;
    };
    // chaman : soigne ses alliés (rayons verts)
    b.attacks._he = (P) => {
      const a = addOf(P); A.sfx('heal', { g: 0.5 });
      const inst = { dur: 0.9, main: false, update(t) {
        if (!inst.h && t > 0.25) {
          inst.h = 1;
          (P.ids || []).forEach(k => { const o = b.adds[k]; if (!o || !o.alive || !a) return; S.fx.bolt(a.pos.clone().setY(2), o.pos.clone().setY(o.y + 0.4), { color: 0x7dff9a, life: 0.5, light: false }); S.fx.burst(o.pos.clone().setY(o.y), { n: 16, color: 0x7dff9a, speed: 4, up: 1.5, life: 0.6, world: true }); S.fx.num(o.pos.clone().setY(o.y + 1.2), '+30 %', { color: '#7dff9a' }); });
        }
      } };
      return inst;
    };

    // élite explosif abattu : gros anneau d'alerte, puis explosion 1,2 s plus tard (chaque client teste son joueur)
    b.attacks._ex = (P) => {
      const R = P.r || 5.5, c = new V3(P.x, 0, P.z), col = 0xff5a2a;
      S.fx.decal(c, 'circle', { r: R, color: 0xff3020, dur: 1.2 });
      S.fx.ring(c.clone().setY(0.06), { r0: R * 1.6, r1: R, color: col, life: 0.5, world: true });
      A.sfx('charge', { len: 1.2, g: 0.5, rate: 1.2 });
      const inst = { dur: 1.35, main: false, update(t) {
        if (t < 1.2) {
          if (Math.random() < 0.8) { const an = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * R; S.fx.spark(new V3(c.x + Math.sin(an) * rr, 0.1, c.z + Math.cos(an) * rr), new V3(0, 2 + Math.random() * 3, 0), { color: Math.random() < 0.5 ? col : 0xffb030, life: 0.5, size: 0.3, size1: 0.03, world: true }); }
          const beat = Math.floor(t / (0.4 - t * 0.2)); if (beat !== inst.beat) { inst.beat = beat; S.fx.flash(c.clone().setY(1), { color: col, r: 1.2 + t, life: 0.15, intensity: 2, light: false }); BR.Audio.fx('tick', { g: 2.5 }); }
        }
        if (t >= 1.2 && !inst.h) {
          inst.h = 1;
          H.blast(b, inst, 'x', c.x, c.z, R, 130, 0xff6a2a, { g: 0.9, rate: 0.9, shake: 0.6, light: true });
          S.fx.pillar(c, { color: 0xffa040, r: 2.2, h: 14, life: 0.5, world: true });
          S.fx.ring(c.clone().setY(0.06), { r1: R * 1.8, color: 0xffd23a, life: 0.5, world: true });
          if (S.fx.debris) S.fx.debris(c, { n: 14, r: 1.5, speed: 12, size: 0.35, world: true });
        }
      } };
      return inst;
    };
    // élite invocateur : cercles magiques où naissent les cogneurs
    b.attacks._inv = (P) => {
      const a = addOf(P), col = 0xc070ff;
      (P.pts || []).forEach(p => {
        const q = new V3(p[0], 0, p[1]);
        S.fx.decal(q, 'ring', { r: 2.1, inner: 0.72, color: col, dur: 1.1, noWarn: true });
        S.fx.ring(q.clone().setY(0.05), { r0: 2.6, r1: 0.3, color: col, life: 0.9, world: true });
        S.fx.pillar(q, { color: col, r: 0.9, h: 6, life: 0.7, world: true });
        if (a) S.fx.bolt(a.pos.clone().setY(a.y + 1), q.clone().setY(0.3), { color: col, life: 0.35, light: false });
      });
      if (a) { a.raiseT = 0.9; S.fx.flash(a.pos.clone().setY(a.y + 1), { color: col, r: 1.5, life: 0.3, intensity: 4 }); }
      A.sfx('magic', { g: 0.5, rate: 0.5 });
      return null;
    };
    // totem : rayon de l'orbe vers le sol, là où naît le serviteur
    b.attacks._tb = (P) => {
      const a = addOf(P), q = new V3(P.tx, 0.15, P.tz), col = 0xc070ff;
      const from = () => a ? new V3(a.pos.x, (a.h0 || 5) * (a.sc || 1) * 0.92, a.pos.z) : new V3(P.tx, 6, P.tz);
      if (a) a.castT = 0.9;
      S.fx.decal(q, 'circle', { r: 1.5, color: col, dur: 0.8, noWarn: true });
      A.sfx('zap', { g: 0.3, rate: 0.8 });
      const inst = { dur: 0.6, main: false, update(t) {
        if (!inst.b0) { inst.b0 = 1; S.fx.bolt(from(), q, { color: col, life: 0.3 }); S.fx.pillar(q.clone().setY(0), { color: col, r: 0.8, h: 7, life: 0.5, world: true }); }
        if (t > 0.22 && !inst.b1) { inst.b1 = 1; S.fx.bolt(from(), q, { color: 0xff5ad8, life: 0.25, light: false }); S.fx.burst(q, { n: 16, color: col, speed: 5, up: 1, life: 0.5, world: true }); }
      } };
      return inst;
    };
    b.attacks._gob = () => {
      BR.Arena.banner('UN GOBELIN VOLEUR !', 'Attrape-le avant qu\'il ne s\'échappe !', 2.2, 'gold');
      BR.Audio.fx('reveal', { g: 0.5, rate: 1.3 });
      return null;
    };
    b.attacks._obj = (P) => {
      if (P.m === 'survie') BR.Arena.banner('TIENS BON !', 'Survis ' + Math.round(P.d || b.survD) + ' secondes', 2.4, 'bad');
      else BR.Arena.banner('DÉTRUIS LES TOTEMS', 'Tant qu\'ils tiennent, la horde ne s\'arrête pas', 2.4, 'bad');
      A.sfx('roar', { rate: 1.5, g: 0.6 });
      return null;
    };
    // objectif accompli : onde dorée depuis le centre (les serviteurs restants explosent en pétales via killAdd)
    b.attacks._end = () => {
      const c = new V3(0, 0.1, 0);
      S.fx.ring(c, { r1: A.arenaR + 4, color: GOLD, life: 0.9, world: true });
      S.fx.ring(c, { r1: A.arenaR * 0.6, color: 0xffffff, life: 0.6, world: true });
      A.shake(0.4); BR.Audio.fx('reveal', { g: 0.6, rate: 0.9 });
      return null;
    };

    /* ---------- animation (tous les clients) ---------- */
    b.updateAdds = function (dt) {
      updateDying(dt); updateCoins(dt);
      // survie : compte à rebours des 5 dernières secondes (chez tous, d'après la barre = temps restant)
      if (MODE === 'survie') {
        const sec = Math.ceil(b.hp / 10);
        if (b.lastSec != null && sec !== b.lastSec && sec >= 1 && sec <= 5) { BR.Arena.banner(String(sec), '', 0.8, 'count'); BR.Audio.fx('tick', { g: 3 }); }
        b.lastSec = sec;
      }
      for (const a of b.adds) {
        if (!a || !a.alive) continue;
        a.t += dt;
        updateAir(a, dt);
        if (a.raiseT > 0) { a.raiseT -= dt; a.raise = a.raiseT > 0; }
        if (a.el) updateElite(a, dt);
        if (a.type === 'gobelin' && a.rise >= 1) {   // il sème des pièces qui brillent en courant
          a.coinT = (a.coinT == null ? 0.3 : a.coinT) - dt;
          const mv = a.lastC ? Math.hypot(a.pos.x - a.lastC.x, a.pos.z - a.lastC.z) : 0; a.lastC = a.lastC || new V3(); a.lastC.copy(a.pos);
          if (a.coinT <= 0 && mv > 0.01) { a.coinT = 0.22 + Math.random() * 0.15; dropCoin(new V3(a.pos.x, 1.4 * a.sc + (a.airY || 0), a.pos.z), 0.7); if (Math.random() < 0.3) BR.Audio.fx('tick', { g: 1.2 }); }
          if (Math.random() < dt * 10) S.fx.spark(new V3(a.pos.x + rnd2(0.5), 1.2 + Math.random(), a.pos.z + rnd2(0.5)), new V3(0, 1, 0), { color: 0xffd23a, life: 0.4, size: 0.22, size1: 0.02, world: true });
        }
        if (a.model) { a.lunge = Math.max(0, (a.lunge || 0) - dt * 4); animModel(a, dt); continue; }
        if (a.rise < 1) a.rise = Math.min(1, a.rise + dt * 2.2);
        a.lunge = Math.max(0, (a.lunge || 0) - dt * 4);
        a.flashT = Math.max(0, (a.flashT || 0) - dt);
        a.M.rock.emissive.setScalar(0);
        const k = a.kick || 0; a.kick = Math.max(0, k - dt * 6);
        const sz = a.g.scale.x, walk = a.moving || (a.lastP && a.lastP.distanceToSquared(a.pos) > 1e-4);
        a.lastP = a.lastP || a.pos.clone(); const vel = a.pos.clone().sub(a.lastP).length() / Math.max(dt, 1e-3); a.lastP.copy(a.pos);
        const ph = a.t * (6 + vel * 1.2);
        const fwd = new V3(Math.sin(a.yaw), 0, Math.cos(a.yaw));
        a.g.position.set(a.pos.x + fwd.x * a.lunge * 0.5, (a.hop || 0) + (a.airY || 0) + (a.rise - 1) * 1.8 * sz, a.pos.z + fwd.z * a.lunge * 0.5);
        a.g.rotation.y += BR.angDiff(a.g.rotation.y, a.yaw) * Math.min(1, dt * 12);
        const bob = walk && vel > 0.5 ? Math.abs(Math.sin(ph)) * 0.12 : Math.sin(a.t * 2.5) * 0.03;
        const wind = a.wind || 0;
        a.body.position.y = bob - wind * 0.12;
        a.body.rotation.x = -wind * 0.35 + a.lunge * 0.45 + k * -0.25;
        a.body.rotation.z = walk ? Math.sin(ph) * 0.08 : 0;
        a.body.scale.set(1 + wind * 0.08 + k * 0.08, 1 - wind * 0.08 - k * 0.1, 1 + wind * 0.08);
        a.parts.arms.forEach((m, j) => { m.rotation.x = (a.raise ? -2.6 : 0) + (walk ? Math.sin(ph + j * Math.PI) * 0.6 : 0) - a.lunge * 1.4; });
        a.parts.legs.forEach((m, j) => { m.rotation.x = walk ? Math.sin(ph + j * Math.PI) * 0.7 : 0; });
        if (a.parts.ring) { a.parts.ring.rotation.z += dt * (2 + wind * 8); a.parts.ring.position.y = 1.2 + Math.sin(a.t * 2) * 0.12; }
        if (a.parts.orb) { a.parts.orb.rotation.y += dt * 3; const o0 = a.parts.orb.userData.y0 == null ? (a.parts.orb.userData.y0 = a.parts.orb.position.y) : a.parts.orb.userData.y0; a.parts.orb.position.y = o0 + Math.sin(a.t * 3) * 0.1; a.parts.orb.scale.setScalar((a.type === 'archer' ? 1 : a.type === 'totem' ? 1.6 : 0.8) * (1 + wind * 0.6 + (a.castT || 0) * 0.5)); }
        if (a.parts.spark) { a.parts.spark.scale.setScalar(0.4 + Math.random() * 0.35 + (a.arm ? 0.6 : 0)); if (Math.random() < dt * 20) S.fx.spark(a.g.localToWorld(new V3(0, 1.55, 0)), new V3((Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2), { color: 0xffc040, life: 0.3, size: 0.18, world: true }); }
        if (a.type === 'totem') { a.castT = Math.max(0, (a.castT || 0) - dt); a.g.rotation.y = a.yaw; a.body.position.y = 0; a.body.rotation.set(0, 0, 0); }
        a.M.glow.emissiveIntensity = 2.2 + wind * 2.5 + (a.arm ? Math.sin(a.t * 40) * 2 + 2 : 0);
        const hk = Math.max(0, a.hp / a.maxHp); a.hk += (hk - a.hk) * Math.min(1, dt * 10); const kk = Math.max(0.002, a.hk); a.fill.scale.x = 1.24 * kk; a.fill.center.x = 0.5 / kk;
        a.fm.userData.U.hit.value = Math.max(0, a.fm.userData.U.hit.value - dt * 4);
      }
    };

    /* ---------- réseau : état des serviteurs ---------- */
    /* une entrée par emplacement : [x, z, type, yaw, pv/20, (affixe d'élite)] si vivant ; 0 mort ; -1 gobelin échappé ;
       -2 retiré en fin d'objectif (purge) — mh : PV max de la horde (élites, invocations) ; tt : totems restants */
    b.extraState = () => {
      const ex = { w: b.wave, mh: Math.round(b.maxHp), a: b.adds.map(a => {
        if (!a) return 0;
        if (a.alive) { const r = [+a.pos.x.toFixed(1), +a.pos.z.toFixed(1), TYPES.indexOf(a.type), +a.yaw.toFixed(2), Math.round(a.hp / a.maxHp * 20)]; if (a.elite) r.push(a.elite); return r; }
        return a.endK === 'esc' ? -1 : a.endK === 'pg' ? -2 : 0;
      }) };
      if (MODE === 'totems') ex.tt = b.totLeft;
      return ex;
    };
    b.applyExtra = ex => {
      if (!ex || !ex.a) return;
      if (ex.w > b.wave) b.wave = ex.w;
      if (ex.mh > 0) b.maxHp = ex.mh;
      if (ex.tt != null) b.totLeft = ex.tt;
      if (!b.started && ex.a.some(Array.isArray)) b.started = true;
      ex.a.forEach((s, i) => {
        const a = b.adds[i], live = Array.isArray(s), el = live ? (s[5] | 0) : 0;
        if (live && (!a || !a.alive || a.type !== TYPES[s[2]] || (a.elite | 0) !== el)) { if (a && a.alive) b.killAdd(i, true); b.adds[i] = makeAdd(i, TYPES[s[2]], s[0], s[1], true, el); }
        else if (!live && a && a.alive) { if (s === -1) goblinEscape(a); else b.killAdd(i, false, s === -2); }
        const c = b.adds[i];
        if (live && c && c.alive) { if (!c.jump) { c.netP = c.netP || new V3(); c.netP.set(s[0], 0, s[1]); } c.yaw = s[3]; c.hp = c.maxHp * s[4] / 20; }
      });
      for (let i = ex.a.length; i < b.adds.length; i++) if (b.adds[i] && b.adds[i].alive) b.killAdd(i);
    };
    // lissage des positions reçues (clients)
    const baseUpdate = b.update;
    b.update = function (dt) {
      if (!S.isHost) for (const a of b.adds) if (a && a.alive && a.netP && !a.jump) { const k = Math.min(1, dt * 10); a.pos.x += (a.netP.x - a.pos.x) * k; a.pos.z += (a.netP.z - a.pos.z) * k; }
      baseUpdate(dt);
    };
    return b;
  }
  AB.register('horde', horde);
})();

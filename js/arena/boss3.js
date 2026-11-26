/* ===== arena/boss3.js : nouveaux colosses — LA SORCIÈRE DE GIVRE et L'OISEAU-TONNERRE =====
   Corps procéduraux (Three.js), visages = images de monstres recadrées (sans effet d'horreur).
   Réseau : même principe que boss.js (l'hôte diffuse l'attaque, chaque client rejoue et ne teste que son joueur). */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, AB = BR.ABoss, H = AB.H;
  const ease = H.ease, rnd = H.rnd;
  const RED = 0xff3020;
  const fwdOf = yaw => new V3(Math.sin(yaw), 0, Math.cos(yaw)), rightOf = yaw => new V3(-Math.cos(yaw), 0, Math.sin(yaw));
  const damp = (v, want, k, dt) => v.lerp(want, 1 - Math.exp(-k * dt));

  /* =====================================================================
     7. LA SORCIÈRE DE GIVRE — buste flottant en robe de glace, deux mains géantes
     ===================================================================== */
  function frost(S, o) {
    const b = AB.base(S, o, 'frost'), A = b.A, accent = 0x8fd8ff;
    const M = H.mats(b, '#6f87a3', accent, { dark: '#1c2840', metalCol: '#b8d0e8', metal: 0.25, rough: 0.55 });
    const ice = new THREE.MeshStandardMaterial({ color: new THREE.Color('#bfe8ff').convertSRGBToLinear(), emissive: new THREE.Color(accent), emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.88 }); b.ownMats.push(ice);
    const robeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a3d66').convertSRGBToLinear(), roughness: 0.8, flatShading: true, side: THREE.DoubleSide }); b.ownMats.push(robeMat);
    b.size = 9; b.postureMax = 130; b.pos.set(0, 0, 10); b.vp.copy(b.pos);
    const mk = (geo, mat, opt) => H.mesh(b, geo, mat, opt);
    const root = new THREE.Group(); b.group.add(root);
    const G = new THREE.Group(); root.add(G);   // buste (flotte)
    G.add(mk(new THREE.CylinderGeometry(1.0, 2.7, 3.6, 9, 3, true), robeMat, { p: [0, -1.6, 0] }));
    G.add(mk(H.lumpy(1, 1, 0.1, 111, 1.5, 1.6, 1.1), M.dark, { p: [0, 0.9, 0] }));
    G.add(mk(new THREE.BoxGeometry(0.2, 1.6, 0.1), M.glow, { p: [0, 0.8, 1.08] }));
    for (const s of [-1, 1]) G.add(mk(H.lumpy(1, 1, 0.15, 112 + s, 0.9, 0.6, 0.8), ice, { p: [s * 1.45, 1.9, 0], r: [0, 0, s * -0.3] }));
    // bas de robe en stalactites (éclate au stade 3)
    const icicles = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const m = mk(new THREE.ConeGeometry(0.45, 2.2, 5), ice, { p: [Math.sin(a) * 2.45, -4.3, Math.cos(a) * 2.45], r: [Math.PI + Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25] }); G.add(m); icicles.push(m); }
    const head = new THREE.Group(); head.position.y = 3.0; G.add(head);
    head.add(mk(new THREE.SphereGeometry(1.55, 12, 8, Math.PI * 0.12 + Math.PI / 2, Math.PI * 1.76), robeMat, { p: [0, 0.2, -0.25], s: [1, 1.25, 1] }));
    const face = AB.faceMesh(b.faces[0], 2.1, accent); face.position.set(0, 0.1, 0.72); head.add(face); b.faceMeshes.push(face);
    const crown = [], crownBig = [];
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.32; const m = mk(new THREE.ConeGeometry(0.2, 1.3 - Math.abs(i - 3) * 0.15, 5), ice, { p: [Math.sin(a) * 1.25, 1.8, Math.cos(a) * 0.6 - 0.1], r: [-0.15, 0, -a * 0.6] }); head.add(m); crown.push(m); }
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.45; const m = mk(new THREE.ConeGeometry(0.3, 2.8 - Math.abs(i - 2) * 0.5, 5), ice, { p: [Math.sin(a) * 1.4, 2.4, Math.cos(a) * 0.4 - 0.3], r: [-0.2, 0, -a * 0.7] }); m.visible = false; head.add(m); crownBig.push(m); }
    const halo = new THREE.PointLight(accent, 3, 26, 2); halo.position.set(0, 1, 2); G.add(halo);
    // les mains géantes
    const hands = [-1, 1].map(s => {
      const g = new THREE.Group(); b.group.add(g);
      const palm = new THREE.Group(); g.add(palm);
      palm.add(mk(H.lumpy(1, 1, 0.12, 120 + s, 1.5, 0.55, 1.7), M.rock));
      palm.add(mk(new THREE.CylinderGeometry(0.75, 0.95, 1.2, 7), M.dark, { p: [0, 0, -1.9], r: [Math.PI / 2, 0, 0] }));
      palm.add(mk(new THREE.BoxGeometry(0.16, 0.08, 1.6), M.glow, { p: [0, 0.56, 0] }));
      const fingers = [], claws = [];
      for (let f = 0; f < 5; f++) {
        const thumb = f === 4, fg = new THREE.Group();
        if (thumb) { fg.position.set(-s * 1.45, -0.05, 0.2); fg.rotation.y = -s * 1.0; } else fg.position.set((f - 1.5) * 0.72, 0, 1.55);
        palm.add(fg);
        fg.add(mk(new THREE.BoxGeometry(0.5, 0.45, 1.3), M.rock, { p: [0, 0, 0.6] }));
        const j2 = new THREE.Group(); j2.position.z = 1.25; fg.add(j2);
        j2.add(mk(new THREE.BoxGeometry(0.42, 0.38, 1.1), M.rock, { p: [0, 0, 0.5] }));
        const cl = mk(new THREE.ConeGeometry(0.2, 1.1, 5), ice, { p: [0, 0, 1.4], r: [Math.PI / 2, 0, 0] }); cl.visible = false; j2.add(cl); claws.push(cl);
        fingers.push({ fg, j2, thumb });
      }
      const H2 = { s, g, palm, fingers, claws, pos: new V3(s * 5, 5, 10), want: new V3(), yaw: 0, pitch: 0, curl: 0.3, wantCurl: 0.3, wantPitch: 0.4, override: null, stuck: 0 };
      return H2;
    });
    let hover = 3.7;
    // parties touchables
    b.parts.push({ obj: head, off: new V3(0, 0.1, 0.5), r: 1.5, weak: false });
    b.parts.push({ obj: G, off: new V3(0, 0.6, 0), r: 2.0 });
    const HAND0 = b.parts.length; hands.forEach(h => b.parts.push({ obj: h.palm, off: new V3(0, 0, 0.5), r: 1.9, weak: false }));
    b.focus = () => b.partPos(1);
    b.blockers = () => [{ x: b.pos.x, z: b.pos.z, r: 2.6 * b.sc, h: 3 }];
    b.onStage = function (s) {
      if (s === 2) { hands.forEach(h => h.claws.forEach((c, i) => H.grow(b, c, 1.0 + i * 0.05))); crownBig.forEach((m, i) => H.grow(b, m, 1.1 + i * 0.08)); ice.emissiveIntensity = 1.0; }
      if (s === 3) { icicles.forEach((m, i) => A.later(1.0 + i * 0.07, () => H.breakOff(b, m, 6))); ice.emissiveIntensity = 1.5; }
    };
    const idleHand = (h, t) => { const F = fwdOf(b.yaw), R = rightOf(b.yaw); return new V3(b.pos.x, 0, b.pos.z).addScaledVector(R, h.s * 5.2 * b.sc).addScaledVector(F, 2.4).setY(2.9 + Math.sin(t * 1.3 + h.s) * 0.45); };
    b.evoPose = null;
    b.animate = function (dt) {
      const wantH = b.dead ? 2.2 : b.broken > 0 ? 2.6 : 3.7 + (b.lift || 0);
      hover += (wantH - hover) * (1 - Math.exp(-dt * 2.5));
      root.position.set(b.vp.x, 0, b.vp.z); root.rotation.y = b.vy; root.scale.setScalar(b.sc);
      G.position.y = hover + Math.sin(b.t * 1.2) * 0.35 + (b.airY || 0); G.rotation.x = Math.sin(b.t * 0.7) * 0.04 + (b.evoT >= 0 ? -0.25 : 0); G.rotation.z = Math.sin(b.t * 0.5) * 0.03;
      head.rotation.x = b.evoT >= 0 ? -0.4 : 0;
      hands.forEach((h, i) => {
        const want = h.override || idleHand(h, b.t);
        if (b.broken > 0 && !h.override) want.setY(1.2);
        // main tirée par un ressort : elle prend de l'élan, dépasse un peu sa cible et revient (geste vivant)
        h.vel = h.vel || new V3();
        H.springVec(h.pos, h.vel, want, dt, h.override ? (h.fast || 9) * 1.15 : 4.2, h.override ? 0.58 : 0.85);
        h.curl += (h.wantCurl - h.curl) * (1 - Math.exp(-dt * 10)); h.pitch += ((h.override ? h.wantPitch : 0.35 + Math.sin(b.t * 2 + i) * 0.1) - h.pitch) * (1 - Math.exp(-dt * 8));
        const yawW = h.yawOverride != null ? h.yawOverride : b.vy;
        h.yaw += BR.angDiff(h.yaw, yawW) * (1 - Math.exp(-dt * 8));
        h.g.position.copy(h.pos); h.g.rotation.set(0, h.yaw, 0); h.palm.rotation.set(h.pitch, 0, h.s * (h.override ? 0 : 0.25)); h.g.scale.setScalar(b.sc);
        h.fingers.forEach((f, k) => { f.fg.rotation.x = h.curl * (f.thumb ? 0.6 : 1) + Math.sin(b.t * 3 + k) * 0.05; f.j2.rotation.x = h.curl * 1.2; });
        b.parts[HAND0 + i].weak = h.stuck > 0 || b.broken > 0;
        if (h.stuck > 0) { h.stuck -= dt; if (Math.random() < dt * 8) S.fx.spark(h.pos.clone().add(new V3(rnd(Math.random, -1, 1), 0.5, rnd(Math.random, -1, 1))), new V3(0, 1.5, 0), { color: 0xffffff, life: 0.5, size: 0.4, world: true }); }
      });
      halo.intensity = 2.6 + Math.sin(b.t * 3) * 0.6;
      if (Math.random() < dt * (6 + b.stage * 6)) { const p = new V3(b.vp.x + rnd(Math.random, -4, 4), G.position.y + rnd(Math.random, -5, 3), b.vp.z + rnd(Math.random, -4, 4)); S.fx.spark(p, new V3(rnd(Math.random, -0.5, 0.5), -1, rnd(Math.random, -0.5, 0.5)), { color: 0xe8f6ff, life: 1.4, size: 0.35, size1: 0.1, world: true }); }
    };
    b.move = function (dt) {
      const tp = b.targetPos(), away = b.pos.clone().sub(tp).setY(0); if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
      b.orbit = b.orbit || 1; if (b.rng() < dt * 0.1) b.orbit *= -1;
      const want = tp.clone().addScaledVector(away.applyAxisAngle(new V3(0, 1, 0), 0.35 * b.orbit), 11); want.y = 0;
      const q = H.clampR(want.x, want.z, 25); want.x = q[0]; want.z = q[1];
      const d = want.sub(b.pos).setY(0), L = d.length(); if (L > 0.3) b.pos.addScaledVector(d.normalize(), Math.min(L, 4.2 * b.speed * dt));
      b.faceToward(dt, tp, 2.5);
    };
    b.choose = function () {
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z), sg = b.stage, n = b.nPlayers(), ids = A.players().map(p => p.id);
      const L = [['slam', 3, 1.0], ['clap', 2.4, 1.2], ['shards', 2.2, 1.3], ['pillars', 1.8, 1.6, { a: +(b.rng() * 6.283).toFixed(2) }], ['frostzone', 1.5, 1.2, { ids }, ['shards', null, 0.2, 1]]];
      if (sg >= 2) L.push(['sweep', 2.4, 1.2], ['blizzard', b.t - (b.lastBliz || -99) > 14 ? 2 : 0, 1.4, { pts: b.rainPts(12 + n * 4, 10), wa: +(b.rng() * 6.283).toFixed(2) }], ['slam', 1.5, 0.9, null, ['clap', null, 0.25, 1]]);
      if (sg >= 3 && b.t - (b.lastAbs || -99) > 25) L.push(['absolute', 4, 1.4, { ids }]);
      const x = b.weighted(L); if (x[0] === 'blizzard') b.lastBliz = b.t; if (x[0] === 'absolute') b.lastAbs = b.t;
      return [x[0], x[2], x[3], x[4]];
    };
    const tgOf = id => { const p = A.player(id); return p && p.alive ? p.pos : null; };
    const freeHand = (inst, h) => { h.override = null; h.yawOverride = null; h.wantCurl = 0.3; h.fast = 0; };
    // une main se place au-dessus de sa cible, la suit, se fige… puis écrase (2 mains au stade 2, 3 frappes au stade 3)
    b.attacks.slam = (P) => {
      const sg = P.sg || 1, n = sg >= 3 ? 3 : sg >= 2 ? 2 : 1, list = [];
      for (let i = 0; i < n; i++) list.push({ hand: hands[(i + (P.s % 2)) % 2], t0: i * 0.75, track: 1.05, lock: 0.42 });
      A.sfx('magic', { rate: 0.4, g: 0.8 });
      const inst = { dur: (n - 1) * 0.75 + 1.05 + 0.42 + 1.4, main: true,
        update(t, dt) {
          list.forEach((s, i) => {
            const tt = t - s.t0; if (tt < 0) return;
            const h = s.hand;
            if (!s.c) { const tp = tgOf(P.tg) || new V3(P.tx, 0, P.tz); s.c = tp.clone().setY(0); s.dec = S.fx.decal(s.c, 'circle', { r: 4.6, color: RED, dur: s.track + s.lock }); h.wantCurl = 0; h.wantPitch = 1.5; }
            if (tt < s.track) { const tp = tgOf(P.tg); if (tp) { s.c.x += (tp.x - s.c.x) * Math.min(1, dt * 4.5); s.c.z += (tp.z - s.c.z) * Math.min(1, dt * 4.5); const q = H.clampR(s.c.x, s.c.z, 31); s.c.x = q[0]; s.c.z = q[1]; s.dec.set(s.c); } }
            if (tt < s.track + s.lock) { h.override = new V3(s.c.x, 8.5 + Math.sin(tt * 6) * 0.2, s.c.z); h.fast = 9; h.yawOverride = b.yaw; }
            else if (tt < s.track + s.lock + 0.12) { h.override = new V3(s.c.x, 1.0, s.c.z); h.fast = 40; h.wantCurl = 0.9; }
            if (tt >= s.track + s.lock + 0.1 && !s.h) { s.h = 1; h.stuck = 0.9; H.blast(b, inst, 'sl' + i, s.c.x, s.c.z, 4.6, 165, 0xcfefff, { g: 0.9, rate: 1.1, shake: 0.7, light: true, smoke: 0xdde8f0 }); A.sfx('ice', { g: 1 }); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; S.fx.spark(s.c.clone().setY(0.5), new V3(Math.sin(a) * 9, 5, Math.cos(a) * 9), { color: 0xe8f8ff, life: 0.6, size: 0.8, grav: 18, world: true }); } }
            if (tt >= s.track + s.lock + 1.0 && !s.r) { s.r = 1; freeHand(inst, h); }
          });
        }, end() { hands.forEach(h => freeHand(inst, h)); }, cancel() { this.end(); } };
      return inst;
    };
    // claquement : les mains se placent de part et d'autre de la cible puis claquent (deux fois, en croix, au stade 2)
    b.attacks.clap = (P) => {
      const sg = P.sg || 1, n = sg >= 2 ? 2 : 1, claps = [];
      for (let i = 0; i < n; i++) claps.push({ t0: i * 1.25, w: 1.0 });
      const inst = { dur: n * 1.25 + 1.0, main: true,
        update(t, dt) {
          claps.forEach((c, i) => {
            const tt = t - c.t0; if (tt < 0) return;
            if (!c.c) { const tp = tgOf(P.tg) || new V3(P.tx, 0, P.tz); c.c = tp.clone().setY(0); const toB = Math.atan2(c.c.x - b.pos.x, c.c.z - b.pos.z); c.yaw = toB + Math.PI / 2 + (i ? Math.PI / 2 : 0); const d = fwdOf(c.yaw); c.a = c.c.clone().addScaledVector(d, -7.5); S.fx.decal(c.a, 'line', { len: 15, width: 3.6, yaw: c.yaw, color: RED, dur: c.w }); A.sfx('swingBig', { rate: 0.5, g: 0.8 }); }
            const d = fwdOf(c.yaw);
            if (tt < c.w) { hands[0].override = c.c.clone().addScaledVector(d, -7.5).setY(2.4); hands[1].override = c.c.clone().addScaledVector(d, 7.5).setY(2.4); hands[0].yawOverride = c.yaw - Math.PI / 2; hands[1].yawOverride = c.yaw + Math.PI / 2; hands.forEach(h => { h.wantPitch = 0; h.wantCurl = 0; h.fast = 8; }); }
            else if (tt < c.w + 0.5) { hands[0].override = c.c.clone().addScaledVector(d, -0.9).setY(2.4); hands[1].override = c.c.clone().addScaledVector(d, 0.9).setY(2.4); hands.forEach(h => { h.fast = 30; }); }
            if (tt >= c.w + 0.08 && !c.h) { c.h = 1; A.sfx('ice', { g: 1.2 }); A.sfx('boom', { g: 0.6, rate: 1.4 }); A.shake(0.5); S.fx.flash(c.c.clone().setY(2.4), { color: 0xe0f6ff, r: 2.5, life: 0.25 }); S.fx.burst(c.c.clone().setY(2.4), { n: 50, color: 0xe0f6ff, speed: 14, life: 0.5, world: true }); A.hurtLine(c.a.x, c.a.z, c.yaw, 15, 3.6, 155, { kb: 4, up: 6 }, inst, 'c' + i); }
          });
        }, end() { hands.forEach(h => freeHand(inst, h)); }, cancel() { this.end(); } };
      return inst;
    };
    // éclats de glace en éventail : trois volées décalées (plus nombreux et légèrement chercheurs au stade 2)
    b.attacks.shards = (P) => {
      const sg = P.sg || 1, n = sg >= 2 ? 9 : 7;
      const inst = { dur: 2.2, main: true,
        update(t) {
          for (let i = 0; i < 3; i++) { const t0 = 0.5 + i * 0.45; if (t >= t0 && !inst['v' + i]) { inst['v' + i] = 1; A.sfx('ice', { g: 0.6 }); const tp = tgOf(P.tg) || new V3(P.tx, 0, P.tz), from = b.focus().setY(1.2); const yaw = Math.atan2(tp.x - from.x, tp.z - from.z) + (i % 2 ? 0.09 : -0.09); H.fan(b, from, yaw, n, 1.4, 17 * b.speed, { r: 0.6, dmg: 60, color: 0xbfeaff, homing: sg >= 2 ? 0.5 : 0, life: 3.5 }); } }
        } };
      return inst;
    };
    // piliers de glace en spirale depuis la sorcière (attaques retardées qui se chevauchent)
    b.attacks.pillars = (P) => {
      const a0 = P.a || 0, p0 = new V3(P.x, 0, P.z), N = (P.sg || 1) >= 2 ? 34 : 26, pts = [];
      for (let i = 0; i < N; i++) { const a = a0 + i * 0.52, r = 3.5 + i * 0.95; const x = p0.x + Math.sin(a) * r, z = p0.z + Math.cos(a) * r; if (Math.hypot(x, z) < 33) pts.push([x, z]); }
      A.sfx('magic', { rate: 0.3, g: 1 });
      const inst = { dur: 0.3 + pts.length * 0.075 + 1.6, main: true,
        update(t) {
          pts.forEach((q, i) => {
            const t0 = 0.3 + i * 0.075;
            if (t >= t0 && !inst['d' + i]) { inst['d' + i] = 1; S.fx.decal({ x: q[0], z: q[1] }, 'circle', { r: 2.5, color: RED, dur: 0.95 }); }
            if (t >= t0 + 0.95 && !inst['h' + i]) { inst['h' + i] = 1; const m = new THREE.Mesh(S.fx.geo.cone, new THREE.MeshStandardMaterial({ color: new THREE.Color('#d8f2ff'), emissive: new THREE.Color(accent), emissiveIntensity: 0.8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, flatShading: true })); m.position.set(q[0], 2.2, q[1]); m.scale.set(1.2, 0.01, 1.2); S.fx.add(m, 1.2, (k, o2) => { o2.scale.y = 4.4 * Math.min(1, k * 8) * (k > 0.75 ? (1 - k) / 0.25 : 1); }, true); H.blast(b, inst, 'p' + i, q[0], q[1], 2.5, 115, 0xcfefff, { quiet: i % 4 !== 0, shake: 0, smoke: 0xdde8f0, h: 5 }); }
          });
        } };
      return inst;
    };
    // cercles de givre sur chaque joueur : ralentissent, puis éclatent
    b.attacks.frostzone = (P) => {
      const ids = (P.ids || [P.tg]).slice(0, 4), zones = [];
      A.sfx('ice', { g: 0.8 });
      const inst = { dur: 2.6, main: false,
        update(t) {
          ids.forEach((id, i) => {
            if (!zones[i]) { const p = tgOf(id) || new V3(P.tx, 0, P.tz); zones[i] = { c: p.clone().setY(0) }; S.fx.decal(zones[i].c, 'ring', { r: 4.2, inner: 0.15, color: 0x9fe8ff, dur: 2.0, hold: 0.15 }); }
            const z = zones[i], f = A.me();
            if (t < 2.0 && f.alive && Math.hypot(f.pos.x - z.c.x, f.pos.z - z.c.z) < 4.2 && f.pos.y < 0.5) f.slow = Math.max(f.slow, 0.25);
            if (t >= 2.0 && !z.h) { z.h = 1; H.blast(b, inst, 'z' + i, z.c.x, z.c.z, 4.2, 125, 0xcfefff, { smoke: 0xdde8f0, light: true }); A.sfx('ice', { g: 1.2 }); }
          });
        } };
      return inst;
    };
    // balayage des deux mains au ras du sol (stade 2+) : deux arcs successifs à sauter
    b.attacks.sweep = (P) => {
      const yaw = Math.atan2(P.tx - P.x, P.tz - P.z), p0 = new V3(P.x, 0, P.z), R = 17, arc = 2.6;
      S.fx.decal(p0, 'sector', { r: R, arc, yaw, color: RED, dur: 0.9, hold: 0.8 });
      const swp = [{ h: hands[0], t0: 0.9, dir: 1 }, { h: hands[1], t0: 1.45, dir: -1 }];
      A.sfx('swingBig', { rate: 0.3, g: 1 });
      const inst = { dur: 2.6, main: true,
        update(t) {
          swp.forEach((s, i) => {
            const k = BR.clamp((t - s.t0) / 0.45, 0, 1), a = yaw - s.dir * arc / 2 + s.dir * arc * ease(k);
            if (t < s.t0) { const a0 = yaw - s.dir * arc / 2; s.h.override = p0.clone().add(new V3(Math.sin(a0) * 11, 2.5, Math.cos(a0) * 11)); s.h.wantPitch = 0.1; s.h.wantCurl = 0.2; s.h.fast = 7; s.h.yawOverride = a0 + s.dir * Math.PI / 2; return; }
            if (k < 1) { s.h.override = p0.clone().add(new V3(Math.sin(a) * 11, 1.2, Math.cos(a) * 11)); s.h.fast = 35; s.h.yawOverride = a + s.dir * Math.PI / 2; A.hurtSector(p0.x, p0.z, a, R, 0.55, 135, { air: true, kb: 12, up: 4, h: 2.4 }, inst, 'w' + i); if (!s.s) { s.s = 1; A.sfx('swingBig', { rate: 0.4, g: 1.3 }); A.shake(0.3); S.fx.slash(p0.clone().setY(1.1), yaw, { r: R, arc, color: 0xcfefff, life: 0.5, inner: 0.55, flip: s.dir < 0, world: true }); } S.fx.burst(s.h.pos.clone().setY(0.3), { n: 3, color: 0xe8f6ff, speed: 4, up: 1, life: 0.5, world: true }); }
            else if (!s.e) { s.e = 1; freeHand(inst, s.h); }
          });
        }, end() { hands.forEach(h => freeHand(inst, h)); }, cancel() { this.end(); } };
      return inst;
    };
    // blizzard (stade 2+) : vent tournant qui pousse les joueurs + boules de neige qui s'écrasent
    b.attacks.blizzard = (P) => {
      const pts = P.pts || [], w0 = +P.wa || 0, T = 4.6;
      A.sfx('fire', { len: 4, g: 0.6 }); BR.Arena.banner('BLIZZARD', 'Le vent te pousse : lutte contre lui !', 1.4, 'blue');
      const inst = { dur: T + 1.2, main: true,
        update(t, dt) {
          const wa = w0 + t * 0.55, wd = fwdOf(wa);
          if (t < T) {
            const f = A.me(); if (f.alive && f.pos.y < 3) { f.pos.x += wd.x * 4.2 * dt; f.pos.z += wd.z * 4.2 * dt; }
            for (let k = 0; k < 4; k++) { const p = new V3(rnd(Math.random, -34, 34), rnd(Math.random, 0.5, 9), rnd(Math.random, -34, 34)); S.fx.spark(p, wd.clone().multiplyScalar(16).setY(-2), { color: 0xffffff, life: 0.8, size: 0.4, world: true, alpha: 0.7 }); }
          }
          pts.forEach((q, i) => { const t0 = 0.4 + i * (T - 1.4) / Math.max(1, pts.length); if (t >= t0 && !inst['d' + i]) { inst['d' + i] = 1; S.fx.decal({ x: q[0], z: q[1] }, 'circle', { r: 2.8, color: RED, dur: 1.0 }); } if (t >= t0 + 0.7 && t < t0 + 1.0) S.fx.spark(new V3(q[0] - wd.x * 6, 16 * (1 - (t - t0 - 0.7) / 0.3), q[1] - wd.z * 6), new V3(0, -10, 0), { color: 0xffffff, life: 0.12, size: 1.6, world: true }); if (t >= t0 + 1.0 && !inst['h' + i]) { inst['h' + i] = 1; H.blast(b, inst, 'b' + i, q[0], q[1], 2.8, 100, 0xe8f6ff, { quiet: i % 3 !== 0, shake: 0, smoke: 0xffffff }); } });
        } };
      return inst;
    };
    // DANGER TOTAL (stade 3) : le froid absolu fige l'arène ; seuls trois cercles de chaleur qui dérivent protègent
    b.attacks.absolute = (P, r) => {
      const T = 4.4, SR = 3.6, a0 = r() * 6.283, safes = [0, 1, 2].map(i => ({ a: a0 + i * 2.094, d: 10 + r() * 14, sp: (r() < 0.5 ? -1 : 1) * (0.18 + r() * 0.12) }));
      const pos = (s, t) => [Math.sin(s.a + t * s.sp) * s.d, Math.cos(s.a + t * s.sp) * s.d];
      A.voice(b.faces[0], 0.7, 1.3); A.sfx('timestop', { g: 0.4 });
      BR.Arena.banner('DANGER TOTAL', 'Réfugie-toi dans un cercle de chaleur !', 1.8, 'bad');
      const marks = [];
      const inst = { dur: T + 1.8, main: true, ownsMove: true,
        update(t) {
          b.lift = t < T ? 2.5 : 0;
          if (!inst.d) { inst.d = 1; S.fx.decal(new V3(0, 0, 0), 'circle', { r: A.arenaR + 1, color: 0x14306a, dur: T, hold: 0.2 }); safes.forEach(s => { const q = pos(s, 0); marks.push(S.fx.decal({ x: q[0], z: q[1] }, 'ring', { r: SR, inner: 0.8, color: 0xff9030, dur: T, hold: 0.1, noWarn: true })); s.col = H.safeColumn(b, 0xff9030, SR, T + 0.1); s.col.set(q[0], q[1]); }); }
          if (t < T) {
            safes.forEach((s, i) => { const q = pos(s, t); marks[i].set({ x: q[0], z: q[1] }); s.col.set(q[0], q[1]); if (Math.random() < 0.6) S.fx.spark(new V3(q[0] + rnd(Math.random, -SR, SR), 0.2, q[1] + rnd(Math.random, -SR, SR)), new V3(0, 3, 0), { color: 0xffa040, life: 0.6, size: 0.5, world: true }); });
            if (Math.random() < 0.9) S.fx.spark(new V3(rnd(Math.random, -33, 33), 0.2, rnd(Math.random, -33, 33)), new V3(0, 0.6, 0), { color: 0xcfefff, life: 1, size: 0.6, world: true });
            hands.forEach((h, i) => { h.override = new V3(b.pos.x + (i ? 6 : -6), 10, b.pos.z); h.wantCurl = 0; h.wantPitch = -0.6; h.fast = 4; });
          }
          if (t >= T && !inst.x) {
            inst.x = 1; S.fx.flash(new V3(0, 3, 0), { color: 0xe8f8ff, r: 14, life: 0.7, intensity: 10 }); S.fx.ring(new V3(0, 0, 0), { r1: 38, color: 0xcfefff, life: 0.6, width: 0.5 });
            for (let i = 0; i < 30; i++) { const a = i / 30 * 6.283, d = 5 + (i % 4) * 8; S.fx.burst(new V3(Math.sin(a) * d, 0.5, Math.cos(a) * d), { n: 6, color: 0xe8f8ff, speed: 10, up: 3, life: 0.6, world: true }); }
            BR.Audio.fx('boom', { len: 2 }); A.sfx('ice', { g: 1.6 }); A.shake(1.1);
            if (!H.inSafe(A, safes.map(s => pos(s, T)), SR + 0.25)) { H.hurtMe(A, 360, { stun: 1.0, unblockable: true, kbFrom: new V3(0, 0, 0), kb: 2 }, inst, 'abs'); }
            hands.forEach(h => freeHand(inst, h));
          }
        }, end() { b.lift = 0; hands.forEach(h => freeHand(inst, h)); }, cancel() { this.end(); } };
      return inst;
    };
    return b;
  }

  /* =====================================================================
     8. L'OISEAU-TONNERRE — rapace géant qui plane, ailes électriques
     ===================================================================== */
  function storm(S, o) {
    const b = AB.base(S, o, 'storm'), A = b.A, accent = 0xffe03a;
    const M = H.mats(b, '#3a3a58', accent, { dark: '#16162a', metalCol: '#d8d0ff', metal: 0.4, rough: 0.5 });
    const feather = new THREE.MeshStandardMaterial({ color: new THREE.Color('#7470b8').convertSRGBToLinear(), emissive: new THREE.Color('#2a2050'), roughness: 0.65, flatShading: true, side: THREE.DoubleSide }); b.ownMats.push(feather);
    b.size = 11; b.postureMax = 120; b.pos.set(0, 0, 12); b.vp.copy(b.pos);
    const mk = (geo, mat, opt) => H.mesh(b, geo, mat, opt);
    const root = new THREE.Group(); b.group.add(root);
    const bodyG = new THREE.Group(); root.add(bodyG);
    /* rapace modélisé dans Blender (outils/blender-boss-b.py → assets-boss-b.js) : tête d'aigle au bec crochu, ailes en
       3 segments couvertes de plumes en éventail (rémiges « doigts » à pointes lumineuses), queue en éventail (5 pièces),
       serres, médaillon d'or sur le poitrail (photo). Mêmes articulations que l'ancien corps, qui reste en repli. */
    const KB = (function (key) {
      const g = BR.Assets && BR.Assets.models && BR.Assets.models[key]; if (!g) return null;
      const src = {}; g.scene.traverse(n => { if (n.name && !src[n.name]) src[n.name] = n; });
      const cache = new Map(), skin = [], lum = [];
      const mat = m => {
        if (/^glow/.test(m.name)) return b.glowMat;
        if (!cache.has(m)) { const c = m.clone(); if (/^lum/.test(m.name)) { c.emissiveIntensity = 2.4; lum.push(c); } else skin.push(c); b.ownMats.push(c); cache.set(m, c); }
        return cache.get(m);
      };
      return { skin, lum, p0: n => src[n] ? src[n].position.clone() : new V3(),
        get(n, keep) { const s = src[n]; if (!s) return new THREE.Group(); const c = s.clone(true); if (!keep) c.position.set(0, 0, 0);
          c.traverse(m => { if (m.isMesh) { m.material = Array.isArray(m.material) ? m.material.map(mat) : mat(m.material); m.castShadow = true; m.receiveShadow = true; } }); return c; } };
    })('boss_storm_kit');
    let neck, head, wings, tailF = [], talons;
    const crest = [], crestBig = [];
    if (KB) {
      const bodyM = KB.get('st_body'); bodyG.add(bodyM);
      neck = new THREE.Group(); neck.position.set(0, 1.1, 3.0); bodyG.add(neck); neck.add(KB.get('st_neck'));
      head = new THREE.Group(); head.position.set(0, 2.1, 1.7); neck.add(head); head.add(KB.get('st_head'));
      // médaillon du poitrail : la photo, ronde, dans son cadre d'or
      const face = AB.faceMesh(b.faces[0], 2.1, accent); face.geometry.dispose(); face.geometry = new THREE.CircleGeometry(1.05, 40); b.ownGeos.push(face.geometry);
      const fa = bodyM.getObjectByName('st_face'); if (fa) fa.add(face); else { face.position.set(0, -0.1, 3.9); bodyG.add(face); }
      b.faceMeshes.push(face);
      const cr = KB.get('st_crest', true); cr.position.sub(KB.p0('st_head')); cr.visible = false; head.add(cr); crestBig.push(cr);
      wings = [-1, 1].map(s => {
        const sd = s > 0 ? 'R' : 'L';
        const sh = new THREE.Group(); sh.position.set(s * 1.6, 1.0, 0.8); bodyG.add(sh);
        const el = new THREE.Group(); el.position.x = s * 4.2; sh.add(el);
        const wr = new THREE.Group(); wr.position.x = s * 3.8; el.add(wr);
        sh.add(KB.get('st_w1' + sd)); el.add(KB.get('st_w2' + sd)); wr.add(KB.get('st_w3' + sd));
        // nervures d'éclair : celle de la main dès le début, les autres poussent au stade 2
        const edges = [sh, el, wr].map((g, k) => { const v = KB.get('st_v' + (k + 1) + sd); v.visible = k === 2; g.add(v); return v; });
        const tip = new THREE.Object3D(); tip.position.set(s * 6.4, 0.2, -1.6); wr.add(tip);
        return { s, sh, el, wr, tip, edges };
      });
      for (let i = 0; i < 5; i++) { const m = KB.get('st_tail' + i, true); bodyG.add(m); tailF.push(m); }
      talons = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.9, -1.4, 0.4); bodyG.add(g); g.add(KB.get(s > 0 ? 'st_legR' : 'st_legL')); return g; });
    } else {
    bodyG.add(mk(H.lumpy(1, 2, 0.1, 131, 2.3, 2.0, 3.7), M.rock));
    bodyG.add(mk(H.lumpy(1, 1, 0.15, 132, 1.6, 1.4, 1.6), M.metal, { p: [0, -0.3, 1.8] }));
    bodyG.add(mk(new THREE.BoxGeometry(0.2, 0.12, 3.4), M.glow, { p: [0, 1.6, -0.2] }));
    // cou + tête (visage) + bec + crête
    neck = new THREE.Group(); neck.position.set(0, 1.1, 3.0); bodyG.add(neck);
    neck.add(mk(new THREE.CylinderGeometry(0.75, 1.0, 2.0, 8), M.rock, { p: [0, 0.6, 0.4], r: [0.6, 0, 0] }));
    head = new THREE.Group(); head.position.set(0, 2.1, 1.7); neck.add(head);
    head.add(mk(H.lumpy(1, 1, 0.06, 133, 1.45, 1.5, 1.15), M.rock, { p: [0, 0, -0.2] }));
    const face = AB.faceMesh(b.faces[0], 2.0, accent); face.position.set(0, 0.55, 1.62); head.add(face); b.faceMeshes.push(face);
    head.add(mk(new THREE.ConeGeometry(0.45, 1.6, 6), M.metal, { p: [0, -1.05, 1.25], r: [Math.PI / 2 + 0.55, 0, 0] }));
    for (const s of [-1, 1]) head.add(mk(new THREE.BoxGeometry(0.22, 2.2, 0.3), M.metal, { p: [s * 1.08, 0.55, 1.5] }));
    head.add(mk(new THREE.BoxGeometry(2.4, 0.28, 0.32), M.metal, { p: [0, 1.62, 1.5] }));
    for (let i = 0; i < 5; i++) { const m = mk(new THREE.PlaneGeometry(0.5, 2.2), feather, { p: [(i - 2) * 0.28, 1.4, -0.6 - Math.abs(i - 2) * 0.1], r: [-0.9, 0, (i - 2) * 0.2] }); head.add(m); crest.push(m); }
    for (let i = 0; i < 3; i++) { const m = mk(new THREE.ConeGeometry(0.18, 2.4, 4), M.glow, { p: [(i - 1) * 0.45, 1.9, -0.8], r: [-1.0, 0, (i - 1) * 0.3] }); m.visible = false; head.add(m); crestBig.push(m); }
    // ailes : 3 segments articulés couverts de plumes ; bord lumineux
    wings = [-1, 1].map(s => {
      const sh = new THREE.Group(); sh.position.set(s * 1.6, 1.0, 0.8); bodyG.add(sh);
      const el = new THREE.Group(); el.position.x = s * 4.2; sh.add(el);
      const wr = new THREE.Group(); wr.position.x = s * 3.8; el.add(wr);
      const segs = [[sh, 4.2, 2.6], [el, 3.8, 2.4], [wr, 4.4, 2.0]];
      segs.forEach(([g, len, w], k) => {
        g.add(mk(new THREE.BoxGeometry(len, 0.35, 0.45), M.rock, { p: [s * len / 2, 0, 0.4] }));
        for (let f = 0; f < 4; f++) { const fl = w + 0.8 + (k === 2 ? f * 0.5 : 0); const pl = mk(new THREE.PlaneGeometry(len / 4 + 0.35, fl), feather, { p: [s * (len / 8 + f * len / 4), -0.12 * f, 0.4 - fl / 2], r: [-Math.PI / 2 + 0.18, s * 0.06 * f, 0] }); g.add(pl); const tipG = mk(new THREE.BoxGeometry(len / 4 + 0.2, 0.05, 0.14), M.glow2, { p: [s * (len / 8 + f * len / 4), -0.12 * f - 0.15, 0.4 - fl + 0.1] }); g.add(tipG); }
        const edge = mk(new THREE.BoxGeometry(len, 0.08, 0.12), M.glow, { p: [s * len / 2, 0.05, -w - 0.3 + (k === 2 ? -0.6 : 0)] }); edge.visible = k === 2; g.add(edge);
        g.userData.edge = edge;
      });
      const tip = new THREE.Object3D(); tip.position.set(s * 4.4, 0, -1); wr.add(tip);
      return { s, sh, el, wr, tip, edges: segs.map(x => x[0].userData.edge) };
    });
    // queue en éventail
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32; const m = mk(new THREE.PlaneGeometry(1.0, 4.2), feather, { p: [Math.sin(a) * 1.4, 0.2, -3.6 - Math.cos(a) * 1.6], r: [-Math.PI / 2 + 0.15, 0, a] }); bodyG.add(m); tailF.push(m); }
    // serres
    talons = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.9, -1.4, 0.4); bodyG.add(g); g.add(mk(new THREE.CylinderGeometry(0.28, 0.22, 1.8, 6), M.dark, { p: [0, -0.9, 0] })); for (let k = 0; k < 3; k++) g.add(mk(new THREE.ConeGeometry(0.14, 0.9, 5), M.metal, { p: [(k - 1) * 0.3, -1.9, 0.35], r: [1.9, 0, (k - 1) * 0.3] })); return g; });
    }
    // parties touchables
    const part = (obj, off, r, weak) => { b.parts.push({ obj, off, r, weak: !!weak }); return b.parts.length - 1; };
    const HEAD = part(head, new V3(0, 0, 0.4), 1.4, false);
    part(bodyG, new V3(0, 0, 0.5), 2.4); part(bodyG, new V3(0, -1.0, -1.6), 2.0);
    wings.forEach(w => part(w.el, new V3(w.s * 1.9, 0, 0), 1.7));
    part(talons[0], new V3(0.9, -1.3, 0), 1.4);
    b.focus = () => b.partPos(1);
    b.blockers = () => b.ground > 0 ? [{ x: b.pos.x, z: b.pos.z, r: 2.4 * b.sc, h: 4 }] : [];
    b.onStage = function (s) {
      if (s === 2) { crestBig.forEach((m, i) => H.grow(b, m, 1.0 + i * 0.1)); wings.forEach(w => w.edges.forEach((e, i) => { if (!e.visible) H.grow(b, e, 1.1 + i * 0.1); })); }
      if (s === 3) { [0, 4].forEach((i, k) => A.later(1.0 + k * 0.2, () => H.breakOff(b, tailF[i], 7))); }
    };
    // ---- vol ----
    let hover = 4.6, flap = 0, flapSp = 4, glide = 0, bank = 0, pitch = 0;
    b.ground = 0;
    b.animate = function (dt) {
      const groundH = 2.3;
      const wantH = b.dead ? 1.5 : (b.broken > 0 || b.ground > 0) ? groundH : 4.6 + (b.lift || 0);
      hover += (wantH - hover) * (1 - Math.exp(-dt * 3));
      if (b.ground > 0) b.ground -= dt;
      b.turn = (b.turn || 0) * Math.exp(-dt * 3);
      root.position.set(b.vp.x, 0, b.vp.z); root.rotation.y = b.vy; root.scale.setScalar(b.sc);
      bodyG.position.y = hover + (b.airY || 0) + Math.sin(flap) * 0.35 * (1 - glide);
      const wantPitch = b.diving ? 0.55 : b.ground > 0 ? -0.15 : 0.05; pitch += (wantPitch - pitch) * (1 - Math.exp(-dt * 6));
      bank += ((b.turn || 0) * 0.4 - bank) * (1 - Math.exp(-dt * 4));
      bodyG.rotation.set(pitch, 0, bank);
      const wantGlide = b.diving ? 1 : 0; glide += (wantGlide - glide) * (1 - Math.exp(-dt * 6));
      flap += dt * (b.ground > 0 ? 2.2 : flapSp + (b.flapBoost || 0));
      // modèle aux grandes ailes : battement relevé (dièdre) pour que les rémiges ne raclent pas le sol en bas de course
      const fa = KB ? (b.ground > 0 ? 0.15 + Math.sin(flap) * 0.2 : 0.29 + Math.sin(flap) * 0.41) * (1 - glide) + glide * 0.05
        : Math.sin(flap) * (b.ground > 0 ? 0.3 : 0.75) * (1 - glide) + glide * -0.15;
      const ka = KB ? 0.2 : 0.35, kb = KB ? 0.22 : 0.3;
      wings.forEach(w => { w.sh.rotation.set(0, w.s * (glide * 0.6 + (b.ground > 0 ? 0.9 : 0)), w.s * fa + (b.wingUp || 0) * w.s); w.el.rotation.z = w.s * Math.sin(flap - 0.6) * ka * (1 - glide); w.wr.rotation.z = w.s * Math.sin(flap - 1.1) * kb * (1 - glide); });
      if (KB) {
        // queue : chaque pièce ondule (relevée pendant le piqué) ; éclat à l'impact ; yeux qui flamboient en criant
        tailF.forEach((m, i) => { if (m.parent === bodyG) m.rotation.set(Math.sin(b.t * 2 + i) * 0.04 + (b.diving ? 0.3 : 0), Math.sin(b.t * 1.6 + i) * 0.05, 0); });
        const fl = b.flashT > 0 ? 0.09 : 0; KB.skin.forEach(m => m.emissive.setScalar(fl));
        const li = (2.2 + (b.stage - 1) * 0.6) * (1 + (b.screech || 0) * 0.8); KB.lum.forEach(m => { m.emissiveIntensity = li; });
        // arcs électriques qui courent sur les ailes, même au premier stade
        if (!b.dead && Math.random() < dt * 1.6) { const w = wings[Math.floor(Math.random() * 2)]; S.fx.bolt(w.el.getWorldPosition(new V3()), w.tip.getWorldPosition(new V3()), { color: accent, life: 0.09, light: false, jitter: 0.7 }); }
      } else tailF.forEach((m, i) => { if (m.parent) m.rotation.z = (i - 2) * 0.32 + Math.sin(b.t * 2 + i) * 0.05; });
      neck.rotation.x = b.ground > 0 ? 0.5 : (b.screech || 0) * -0.5; head.rotation.x = b.ground > 0 ? 0.2 : 0;
      talons.forEach((t, i) => { t.rotation.x = b.diving ? -0.9 : 0.3 + Math.sin(b.t * 2 + i) * 0.1; });
      b.parts[HEAD].weak = b.ground > 0 || b.broken > 0;
      if (b.stage >= 2 && Math.random() < dt * (b.stage >= 3 ? 3 : 1.5)) { const w = wings[Math.floor(Math.random() * 2)]; S.fx.bolt(w.tip.getWorldPosition(new V3()), b.focus(), { color: accent, life: 0.12, light: false, jitter: 1.4 }); }
      if (b.stage >= 3 && Math.random() < dt * 8) S.fx.spark(b.focus().add(new V3(rnd(Math.random, -6, 6), 5 + Math.random() * 3, rnd(Math.random, -6, 6))), new V3(0, 0.5, 0), { color: 0x2a2840, kind: 'smoke', life: 2, size: 2.5, size1: 4, world: true, alpha: 0.5 });
      if (b.ground > 0 && Math.random() < dt * 8) S.fx.spark(b.partPos(HEAD).add(new V3(rnd(Math.random, -1, 1), 1.4, rnd(Math.random, -1, 1))), new V3(0, 1, 0), { color: 0xfff6a0, life: 0.5, size: 0.4, world: true });
    };
    b.move = function (dt) {
      const tp = b.targetPos();
      b.orbit = b.orbit || 1; if (b.rng() < dt * 0.12) b.orbit *= -1;
      const ang = Math.atan2(b.pos.x - tp.x, b.pos.z - tp.z) + b.orbit * 0.5 * dt;
      const want = new V3(tp.x + Math.sin(ang) * 12, 0, tp.z + Math.cos(ang) * 12); const q = H.clampR(want.x, want.z, 27); want.x = q[0]; want.z = q[1];
      const d = want.sub(b.pos).setY(0), L = d.length(); if (L > 0.3) b.pos.addScaledVector(d.normalize(), Math.min(L, 7 * b.speed * dt));
      const before = b.yaw; b.faceToward(dt, tp, 2.2); b.turn = BR.angDiff(before, b.yaw) / Math.max(dt, 1e-3) * 0.3;
    };
    b.choose = function () {
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z), sg = b.stage, n = b.nPlayers(), ids = A.players().map(p => p.id);
      const L = [['bolts', 2.5, 1.0, { ids }], ['dive', 2.6, 1.3], ['gust', d < 18 ? 2 : 0.6, 1.0, null, ['bolts', () => ({ ids: A.players().map(p => p.id) }), 0.2, 1]], ['ring', 1.8, 1.4, { g: +(b.rng() * 6.283).toFixed(2) }], ['cyclone', b.t - (b.lastCyc || -99) > 10 ? 1.8 : 0, 1.2, { ids }]];
      if (sg >= 2) L.push(['xbolts', 2.2, 1.4, { a: +(b.rng() * 3.14).toFixed(2) }], ['pylons', 1.8, 1.4, { pts: [0, 1, 2, 3, 4].map(i => { const a = b.rng() * 6.283, r = 8 + b.rng() * 20; return H.pt(Math.sin(a) * r, Math.cos(a) * r); }) }], ['dive', 1.8, 1.0, null, ['dive', null, 0.2, 1]]);
      if (sg >= 3 && b.t - (b.lastTemp || -99) > 25) L.push(['tempest', 4, 1.4]);
      const x = b.weighted(L); if (x[0] === 'cyclone') b.lastCyc = b.t; if (x[0] === 'tempest') b.lastTemp = b.t;
      return [x[0], x[2], x[3], x[4]];
    };
    const tgOf = id => { const p = A.player(id); return p && p.alive ? p.pos : null; };
    const strikeAt = (inst, key, x, z, r, dmg) => {
      S.fx.bolt(new V3(x + rnd(Math.random, -2, 2), 30, z + rnd(Math.random, -2, 2)), new V3(x, 0.1, z), { color: 0xfff6a0, life: 0.22, jitter: 1.2 });
      S.fx.bolt(new V3(x + rnd(Math.random, -3, 3), 26, z + rnd(Math.random, -3, 3)), new V3(x, 0.1, z), { color: accent, life: 0.16, jitter: 1.6, light: false });
      return H.blast(b, inst, key, x, z, r, dmg, accent, { quiet: true, shake: 0.15, smoke: 0x2a2840, noSmoke: true, noHurt: !inst });
    };
    // foudre qui poursuit chaque joueur : 5 frappes, chacune vise là où il se trouve
    b.attacks.bolts = (P) => {
      const ids = (P.ids && P.ids.length ? P.ids : [P.tg]).slice(0, 4), N = (P.sg || 1) >= 2 ? 6 : 5, list = [];
      ids.forEach((id, gi) => { for (let i = 0; i < N; i++) list.push({ id, t0: 0.3 + i * 0.42 + gi * 0.07, w: 0.85 }); });
      b.screech = 1; A.sfx('zap', { g: 1 });
      const inst = { dur: 0.3 + N * 0.42 + 1.2, main: true,
        update(t) {
          list.forEach((s, i) => {
            if (t >= s.t0 && !s.c) { const p = tgOf(s.id) || new V3(P.tx, 0, P.tz); s.c = [p.x, p.z]; S.fx.decal({ x: p.x, z: p.z }, 'circle', { r: 3.1, color: RED, dur: s.w }); }
            if (s.c && t >= s.t0 + s.w && !s.h) { s.h = 1; strikeAt(inst, 'b' + i, s.c[0], s.c[1], 3.1, 115); if (i % 2 === 0) A.sfx('zap', { g: 0.8 }); }
          });
        }, end() { b.screech = 0; }, cancel() { b.screech = 0; } };
      return inst;
    };
    // piqué : monte, plonge en ligne droite vers la cible, impact + onde ; reste au sol (tête vulnérable)
    b.attacks.dive = (P) => {
      const p0 = new V3(P.x, 0, P.z), dir = new V3(P.tx - P.x, 0, P.tz - P.z); const dist = Math.max(4, dir.length()); dir.normalize();
      let len = dist + 4; for (let k = 0; k < 60 && p0.clone().addScaledVector(dir, len).length() > 28; k++) len -= 0.5; len = Math.max(5, len);
      const p1 = p0.clone().addScaledVector(dir, len), yaw = Math.atan2(dir.x, dir.z), T = len / 34;
      A.sfx('roar', { rate: 1.9, g: 0.6 });
      const inst = { dur: 0.95 + T + 2.0, main: true, ownsMove: true,
        update(t) {
          b.yaw = yaw;
          if (t < 0.95) { b.lift = ease(t / 0.8) * 8; b.flapBoost = 4; if (!inst.d && t > 0.15) { inst.d = 1; S.fx.decal(p0, 'line', { len: len + 3, width: 5, yaw, color: RED, dur: 0.8 }); S.fx.decal(p1, 'circle', { r: 6, color: RED, dur: 0.8 + T }); } return; }
          b.flapBoost = 0;
          if (t < 0.95 + T) { const k = (t - 0.95) / T; b.diving = true; b.pos.copy(p0).addScaledVector(dir, len * k); b.lift = 8 * (1 - k); A.hurtCircle(b.pos.x, b.pos.z, 3.2, 150, { kb: 14, up: 5, h: 3 + b.lift }, inst, 'dv'); if (Math.random() < 0.7) S.fx.spark(b.focus(), dir.clone().multiplyScalar(-10), { color: accent, life: 0.3, size: 1.2, world: true }); return; }
          if (!inst.h) { inst.h = 1; b.diving = false; b.lift = 0; b.pos.copy(p1); b.ground = 1.9; H.blast(b, inst, 'im', p1.x, p1.z, 6, 175, accent, { g: 1, rate: 0.9, shake: 0.9, light: true, smoke: 0x2a2840 }); strikeAt(null, null, p1.x, p1.z, 0.1, 0); if ((P.sg || 1) >= 2) H.wave(b, p1.x, p1.z, { r0: 6, rMax: 26, dmg: 90, color: accent }); A.sfx('zap', { g: 1.2 }); }
        }, end() { b.diving = false; b.lift = 0; b.flapBoost = 0; }, cancel() { this.end(); } };
      return inst;
    };
    // bourrasque : coup d'ailes en cône qui repousse fort + éventail de plumes électriques
    b.attacks.gust = (P) => {
      const yaw = Math.atan2(P.tx - P.x, P.tz - P.z), p0 = new V3(P.x, 0, P.z), sg = P.sg || 1;
      S.fx.decal(p0, 'sector', { r: 18, arc: 1.2, yaw, color: RED, dur: 0.75 });
      const inst = { dur: 1.7, main: true, ownsMove: true,
        update(t) {
          b.yaw = yaw; b.wingUp = t < 0.75 ? ease(t / 0.75) * 0.9 : Math.max(0, 0.9 - (t - 0.75) * 6) - 0.4 * Math.max(0, 1 - Math.abs(t - 0.9) * 5);
          if (t >= 0.75 && !inst.g) { inst.g = 1; A.sfx('swingBig', { rate: 0.25, g: 1.8 }); A.sfx('zap', { g: 0.6 }); A.shake(0.5);
            for (let i = 0; i < 40; i++) { const a = yaw + (Math.random() - 0.5) * 1.2; S.fx.spark(new V3(P.x, 3, P.z), new V3(Math.sin(a) * 28, rnd(Math.random, -1, 2), Math.cos(a) * 28), { color: 0xe8e0ff, life: 0.6, size: 0.6, drag: 1.5, world: true, alpha: 0.6 }); }
            H.fan(b, new V3(P.x, 1.1, P.z), yaw, sg >= 2 ? 9 : 7, 1.2, 20 * b.speed, { r: 0.55, dmg: 55, color: accent, life: 2.5 }); }
          if (t >= 0.75 && t < 1.0) A.hurtSector(P.x, P.z, yaw, 18, 1.2, 45, { kb: 24, up: 5 }, inst, 'g');
        }, end() { b.wingUp = 0; }, cancel() { b.wingUp = 0; } };
      return inst;
    };
    // anneaux d'éclairs : 3 ondes à sauter (avec une brèche qui tourne au stade 2)
    b.attacks.ring = (P) => {
      const sg = P.sg || 1, g0 = P.g || 0, p0 = new V3(P.x, 0, P.z);
      A.sfx('charge', { len: 0.7, g: 0.8 });
      const inst = { dur: 0.8 + 3 * 0.75 + 0.5, main: true, ownsMove: true,
        update(t) {
          b.wingUp = t < 0.7 ? ease(t / 0.7) * 0.7 : 0;
          for (let i = 0; i < 3; i++) if (t >= 0.8 + i * 0.75 && !inst['w' + i]) { inst['w' + i] = 1; A.sfx('zap', { g: 0.9 }); A.shake(0.3); S.fx.flash(p0.clone().setY(2), { color: accent, r: 3, life: 0.25 }); if (sg >= 2) H.wave(b, p0.x, p0.z, { r0: 2, rMax: 40, dmg: 105, color: accent, arc: Math.PI * 2 - 0.9, yaw: g0 + i * 1.3 + Math.PI }); else H.wave(b, p0.x, p0.z, { r0: 2, rMax: 40, dmg: 105, color: accent }); }
        }, end() { b.wingUp = 0; }, cancel() { b.wingUp = 0; } };
      return inst;
    };
    // cyclones qui poursuivent les joueurs pendant 5 s
    b.attacks.cyclone = (P) => {
      const ids = (P.ids && P.ids.length ? P.ids : [P.tg]).slice(0, (P.sg || 1) >= 2 ? 3 : 2), T = 5.5;
      const cs = ids.map((id, i) => { const a = i * 2.1; return { id, p: new V3(P.x + Math.sin(a) * 4, 0, P.z + Math.cos(a) * 4) }; });
      A.sfx('fire', { len: 5, g: 0.5 });
      const inst = { dur: T + 0.5, main: false,
        update(t, dt) {
          cs.forEach((c, i) => {
            if (t < T) { const tp = tgOf(c.id); if (tp) { const d = tp.clone().sub(c.p).setY(0); const L = d.length(); if (L > 0.1) c.p.addScaledVector(d.normalize(), Math.min(L, 6.2 * b.speed * dt)); } }
            const k = t < 0.5 ? t / 0.5 : t > T ? Math.max(0, 1 - (t - T) / 0.5) : 1;
            for (let j = 0; j < 4; j++) { const a = Math.random() * 6.283, h = Math.random() * 9, r = (0.6 + h * 0.25) * k; S.fx.spark(new V3(c.p.x + Math.sin(a) * r, h, c.p.z + Math.cos(a) * r), new V3(Math.cos(a) * 6, 2, -Math.sin(a) * 6), { color: j % 2 ? 0xcfc8ff : accent, life: 0.35, size: 0.6, world: true, alpha: 0.7 }); }
            if (t < T && Math.floor(t * 4) !== c.q) { c.q = Math.floor(t * 4); const f = A.me(); const d = Math.hypot(f.pos.x - c.p.x, f.pos.z - c.p.z); if (d < 2.6 && f.pos.y < 8) { A.hurtCircle(c.p.x, c.p.z, 2.6, 30, { up: 3, kb: 3, h: 8 }); } if (Math.random() < 0.3) S.fx.bolt(c.p.clone().setY(9), c.p.clone().setY(0.1), { color: accent, life: 0.1, light: false }); }
            if (t < T) { const f = A.me(); const d = c.p.clone().sub(f.pos).setY(0), L = d.length(); if (f.alive && L < 7 && L > 0.5 && f.pos.y < 3) f.pos.addScaledVector(d.normalize(), 2.2 * dt); }
          });
        } };
      return inst;
    };
    // lignes de foudre en X qui traversent l'arène (stade 2+), trois salves décalées
    b.attacks.xbolts = (P) => {
      const a0 = P.a || 0, sets = [0, 1, 2];
      b.screech = 1; A.sfx('charge', { len: 1, g: 0.7 });
      const inst = { dur: 0.3 + 3 * 0.8 + 1.4, main: true,
        update(t) {
          sets.forEach(si => {
            const td = 0.3 + si * 0.8, th = td + 1.0;
            for (let k = 0; k < 3; k++) {
              const yaw = a0 + si * 0.52 + k * Math.PI / 3, d = fwdOf(yaw), off = (k - 1) * 0;
              const x = -d.x * 36, z = -d.z * 36;
              if (t >= td && !inst['d' + si + k]) { inst['d' + si + k] = 1; S.fx.decal(new V3(x, 0, z), 'line', { len: 72, width: 3, yaw, color: RED, dur: th - td }); }
              if (t >= th && !inst['h' + si + k]) { inst['h' + si + k] = 1; for (let s = 0; s < 72; s += 9) { const q = new V3(x + d.x * s, 0, z + d.z * s); if (Math.hypot(q.x, q.z) < 34) S.fx.bolt(q.clone().setY(24), q.clone().setY(0.1), { color: accent, life: 0.18, light: s === 36, jitter: 1 }); } H.strike(b, inst, 'x' + si + k, x, z, yaw, 72, 3, 120, accent, { quiet: k > 0, h: 3 }); void off; }
            }
          });
        }, end() { b.screech = 0; }, cancel() { b.screech = 0; } };
      return inst;
    };
    // pylônes (stade 2+) : 5 orbes tombent au sol, puis la foudre les relie dans l'ordre (lignes à éviter)
    b.attacks.pylons = (P) => {
      const pts = P.pts || [], orbs = [];
      A.sfx('magic', { rate: 0.5, g: 1 });
      const inst = { dur: 1.0 + pts.length * 0.45 + 1.6, main: true,
        update(t) {
          pts.forEach((q, i) => {
            if (t >= i * 0.12 && !orbs[i]) { const m = new THREE.Mesh(S.fx.geo.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(2.4), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(0.8); m.position.set(q[0], 10, q[1]); orbs[i] = m; S.fx.add(m, inst.dur - i * 0.12, (k, o2, dt, tt) => { o2.position.y = Math.max(1.2, 10 - tt * 18); o2.scale.setScalar(0.8 + Math.sin(tt * 20) * 0.12); }, true); }
          });
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], c = pts[(i + 1) % pts.length], td = 0.8 + i * 0.45, th = td + 0.9, yaw = Math.atan2(c[0] - a[0], c[1] - a[1]), len = Math.hypot(c[0] - a[0], c[1] - a[1]);
            if (t >= td && !inst['d' + i]) { inst['d' + i] = 1; S.fx.decal({ x: a[0], z: a[1] }, 'line', { len, width: 2.6, yaw, color: RED, dur: th - td }); }
            if (t >= th && !inst['h' + i]) { inst['h' + i] = 1; S.fx.bolt(new V3(a[0], 1.2, a[1]), new V3(c[0], 1.2, c[1]), { color: accent, life: 0.35, jitter: 0.6 }); S.fx.bolt(new V3(a[0], 1.2, a[1]), new V3(c[0], 1.2, c[1]), { color: 0xffffff, life: 0.25, jitter: 0.9, light: false }); A.sfx('zap', { g: 1 }); A.hurtLine(a[0], a[1], yaw, len, 2.6, 125, { kb: 6, up: 5, h: 3 }, inst, 'l' + i); }
          }
        } };
      return inst;
    };
    // DANGER TOTAL (stade 3) : l'arène entière se charge ; seuls trois paratonnerres (cercles) qui dérivent protègent
    b.attacks.tempest = (P, r) => {
      const T = 4.6, SR = 3.4, a0 = r() * 6.283, rods = [0, 1, 2].map(i => ({ a: a0 + i * 2.094, d: 9 + r() * 15, sp: (r() < 0.5 ? -1 : 1) * (0.2 + r() * 0.15) }));
      const pos = (s, t) => [Math.sin(s.a + t * s.sp) * s.d, Math.cos(s.a + t * s.sp) * s.d];
      A.voice(b.faces[0], 0.8, 1.3); A.sfx('charge', { len: T, g: 0.8 });
      BR.Arena.banner('DANGER TOTAL', 'Abrite-toi sous un paratonnerre !', 1.8, 'bad');
      const marks = [];
      const inst = { dur: T + 3.0, main: true, ownsMove: true,
        update(t, dt) {
          b.lift = t < T ? Math.min(9, t * 6) : Math.max(0, 9 - (t - T) * 12);
          if (!inst.d) { inst.d = 1; S.fx.decal(new V3(0, 0, 0), 'circle', { r: A.arenaR + 1, color: 0x6a5208, dur: T, hold: 0.2 }); rods.forEach(s => { const q = pos(s, 0); marks.push(S.fx.decal({ x: q[0], z: q[1] }, 'ring', { r: SR, inner: 0.8, color: 0x60ffb0, dur: T, hold: 0.1, noWarn: true })); s.col = H.safeColumn(b, 0x60ffb0, SR, T + 0.1); s.col.set(q[0], q[1]); }); }
          if (t < T) {
            rods.forEach((s, i) => { const q = pos(s, t); marks[i].set({ x: q[0], z: q[1] }); s.col.set(q[0], q[1]); if (Math.random() < 0.5) S.fx.spark(new V3(q[0], 4 + Math.random() * 3, q[1]), new V3(0, -6, 0), { color: 0x80ffc0, life: 0.5, size: 0.6, world: true }); });
            if (Math.random() < dt * 9) { const x = rnd(Math.random, -32, 32), z = rnd(Math.random, -32, 32); if (Math.hypot(x, z) < 33) S.fx.bolt(new V3(x, 26, z), new V3(x, 0.1, z), { color: accent, life: 0.12, light: false }); }
          }
          if (t >= T && !inst.x) {
            inst.x = 1; S.fx.flash(new V3(0, 6, 0), { color: 0xffffff, r: 16, life: 0.7, intensity: 12 });
            for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283, d = 5 + (i % 4) * 8; S.fx.bolt(new V3(Math.sin(a) * d, 30, Math.cos(a) * d), new V3(Math.sin(a) * d, 0.1, Math.cos(a) * d), { color: i % 2 ? 0xffffff : accent, life: 0.3, light: i % 6 === 0 }); }
            BR.Audio.fx('boom', { len: 2.2 }); A.sfx('zap', { g: 2 }); A.shake(1.2);
            if (!H.inSafe(A, rods.map(s => pos(s, T)), SR + 0.25)) H.hurtMe(A, 370, { up: 8, unblockable: true, kbFrom: new V3(0, 0, 0), kb: 3 }, inst, 'tp');
          }
          if (t >= T + 0.7 && !inst.w) { inst.w = 1; H.wave(b, b.pos.x, b.pos.z, { r0: 2, rMax: 40, dmg: 110, color: accent }); A.later(0.6, () => H.wave(b, b.pos.x, b.pos.z, { r0: 2, rMax: 40, dmg: 110, color: accent })); }
        }, end() { b.lift = 0; }, cancel() { b.lift = 0; } };
      return inst;
    };
    return b;
  }

  AB.register('frost', frost);
  AB.register('storm', storm);
})();

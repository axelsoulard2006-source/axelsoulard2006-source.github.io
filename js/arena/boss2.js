/* ===== arena/boss2.js : nouveaux colosses — LE CHEVALIER DÉCHU et LE BÉHÉMOTH =====
   Corps procéduraux (Three.js), visages = images de monstres recadrées (sans effet d'horreur).
   Même principe réseau que boss.js : l'hôte choisit et diffuse { n, s, tg, tx, tz, x, z, yw, sg } ; chaque client rejoue
   le script et ne teste que son propre joueur. Toute variation aléatoire d'une attaque passe par r() (graine partagée). */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, AB = BR.ABoss, H = AB.H;
  const ease = H.ease, rnd = H.rnd;
  const RED = 0xff3020;
  const fwdOf = yaw => new V3(Math.sin(yaw), 0, Math.cos(yaw)), rightOf = yaw => new V3(-Math.cos(yaw), 0, Math.sin(yaw));
  // pose interpolée en douceur (ressort amorti), jamais de saut d'une image à l'autre
  function poser(pose) { return H.springPose(pose); }

  /* =====================================================================
     5. LE CHEVALIER DÉCHU — maître d'armes géant, épée longue, cape
     ===================================================================== */
  function knight(S, o) {
    const b = AB.base(S, o, 'knight'), A = b.A, accent = 0xff2c4c;
    const M = H.mats(b, '#5e5a68', accent, { dark: '#2a2530', metalCol: '#a8a4b8', metal: 0.55, rough: 0.4 });
    const cloth = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a0c16').convertSRGBToLinear(), roughness: 0.9, side: THREE.DoubleSide, flatShading: true }); b.ownMats.push(cloth);
    b.size = 11; b.postureMax = 150; b.pos.set(0, 0, 10); b.vp.copy(b.pos);
    const mk = (geo, mat, opt) => H.mesh(b, geo, mat, opt);
    const root = new THREE.Group(); b.group.add(root);
    const J = {};
    J.pelvis = new THREE.Group(); J.pelvis.position.y = 4.6; root.add(J.pelvis);
    J.pelvis.add(mk(new THREE.CylinderGeometry(1.25, 1.05, 1.1, 8), M.dark));
    // jupe d'armure (lames)
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const m = mk(new THREE.BoxGeometry(0.75, 1.5, 0.12), M.metal, { p: [Math.sin(a) * 1.25, -0.75, Math.cos(a) * 1.25], r: [Math.cos(a) * 0.25, a, -Math.sin(a) * 0.25 * 0] }); m.rotation.order = 'YXZ'; m.rotation.set(0.25, a, 0); J.pelvis.add(m); }
    J.torso = new THREE.Group(); J.torso.position.y = 0.45; J.pelvis.add(J.torso);
    J.torso.add(mk(new THREE.CylinderGeometry(1.15, 1.0, 1.4, 8), M.dark, { p: [0, 0.6, 0] }));
    J.torso.add(mk(H.lumpy(1, 1, 0.12, 30, 1.55, 1.3, 1.0), M.dark, { p: [0, 2.1, 0] }));
    const chest = mk(H.lumpy(1, 1, 0.12, 31, 1.95, 1.55, 1.25), M.metal, { p: [0, 2.15, 0.08] }); J.torso.add(chest);
    // rivets / gravures lumineuses sur le plastron
    const chestRunes = mk(new THREE.BoxGeometry(0.16, 1.3, 0.08), M.glow, { p: [0, 2.2, 1.12] }); J.torso.add(chestRunes);
    J.neck = new THREE.Group(); J.neck.position.y = 3.45; J.torso.add(J.neck);
    J.neck.add(mk(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 8), M.dark, { p: [0, 0.2, 0] }));
    J.head = new THREE.Group(); J.head.position.y = 0.5; J.neck.add(J.head);
    // heaume : coque arrière + cimier, le visage apparaît dans l'ouverture
    J.head.add(mk(new THREE.CylinderGeometry(1.2, 1.1, 2.4, 10, 1, false, Math.PI * 0.12, Math.PI * 1.76), M.metal, { p: [0, 1.2, -0.05] }));
    J.head.add(mk(new THREE.SphereGeometry(1.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.metal, { p: [0, 2.4, -0.05] }));
    J.head.add(mk(new THREE.BoxGeometry(0.22, 0.9, 2.2), M.glow, { p: [0, 3.05, -0.25] }));
    const face = AB.faceMesh(b.faces[0], 2.05, accent); face.position.set(0, 1.25, 0.62); J.head.add(face); b.faceMeshes.push(face);
    for (const s of [-1, 1]) J.head.add(mk(new THREE.BoxGeometry(0.22, 2.3, 0.5), M.metal, { p: [s * 1.08, 1.2, 0.55], r: [0, s * -0.35, 0] }));
    J.head.add(mk(new THREE.BoxGeometry(2.3, 0.28, 0.5), M.metal, { p: [0, 2.32, 0.6] }));
    // cornes (stade 2)
    const horns = [-1, 1].map(s => { const m = mk(new THREE.ConeGeometry(0.32, 2.6, 6), M.dark, { p: [s * 1.05, 2.6, -0.1], r: [-0.35, 0, s * -0.75] }); m.add(mk(new THREE.ConeGeometry(0.12, 0.6, 6), M.glow, { p: [0, 1.25, 0] })); m.visible = false; J.head.add(m); return m; });
    // bras
    const pauldrons = [];
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'L' : 'R';
      const sh = new THREE.Group(); sh.position.set(s * 2.0, 2.85, 0); J.torso.add(sh);
      const pd = mk(H.lumpy(1, 1, 0.1, 40 + s, 1.25, 0.9, 1.25), M.metal, { p: [s * 0.25, 0.35, 0] }); sh.add(pd); pauldrons.push(pd);
      sh.add(mk(new THREE.CylinderGeometry(0.6, 0.5, 2.0, 8), M.dark, { p: [0, -1.0, 0] }));
      const el = new THREE.Group(); el.position.y = -2.0; sh.add(el);
      el.add(mk(new THREE.CylinderGeometry(0.56, 0.46, 1.9, 8), M.metal, { p: [0, -0.95, 0] }));
      const wr = new THREE.Group(); wr.position.y = -1.95; el.add(wr);
      wr.add(mk(new THREE.BoxGeometry(0.7, 0.7, 0.7), M.dark, { p: [0, -0.2, 0] }));
      J['sh' + k] = sh; J['el' + k] = el; J['wr' + k] = wr;
      const hip = new THREE.Group(); hip.position.set(s * 0.78, -0.3, 0); J.pelvis.add(hip);
      hip.add(mk(new THREE.CylinderGeometry(0.78, 0.6, 2.3, 8), M.dark, { p: [0, -1.15, 0] }));
      hip.add(mk(new THREE.BoxGeometry(1.1, 1.4, 0.4), M.metal, { p: [0, -0.9, 0.55], r: [0.1, 0, 0] }));
      const kn = new THREE.Group(); kn.position.y = -2.3; hip.add(kn);
      kn.add(mk(new THREE.SphereGeometry(0.55, 8, 6), M.metal));
      kn.add(mk(new THREE.CylinderGeometry(0.64, 0.5, 2.0, 8), M.metal, { p: [0, -1.0, 0] }));
      kn.add(mk(new THREE.BoxGeometry(0.95, 0.5, 1.55), M.dark, { p: [0, -2.05, 0.3] }));
      J['hip' + k] = hip; J['kn' + k] = kn;
    }
    // l'épée (dans la main droite, lame le long de -Y de la main)
    const sword = new THREE.Group(); J.wrR.add(sword); sword.position.y = -0.3;
    sword.add(mk(new THREE.CylinderGeometry(0.14, 0.14, 1.3, 6), M.dark, { p: [0, 0.35, 0] }));
    sword.add(mk(new THREE.BoxGeometry(1.9, 0.26, 0.42), M.metal, { p: [0, -0.35, 0] }));
    const bladeLen = 7.6;
    sword.add(mk(new THREE.BoxGeometry(0.62, bladeLen, 0.13), M.metal, { p: [0, -0.5 - bladeLen / 2, 0] }));
    sword.add(mk(new THREE.ConeGeometry(0.44, 0.9, 4), M.metal, { p: [0, -0.5 - bladeLen - 0.4, 0], r: [Math.PI, Math.PI / 4, 0], s: [1, 1, 0.3] }));
    const edge = mk(new THREE.BoxGeometry(0.1, bladeLen, 0.16), M.glow, { p: [0, -0.5 - bladeLen / 2, 0] }); sword.add(edge);
    const swordTip = new THREE.Object3D(); swordTip.position.y = -0.5 - bladeLen; sword.add(swordTip);
    const swordMid = new THREE.Object3D(); swordMid.position.y = -0.5 - bladeLen * 0.55; sword.add(swordMid);
    // cape : bandes articulées qui ondulent
    const cape = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group(); g.position.set((i - 2) * 0.62, 3.3, -1.05); J.torso.add(g); let par = g; const segs = [];
      for (let k = 0; k < 4; k++) { const s = new THREE.Group(); s.position.y = k ? -1.35 : 0; par.add(s); s.add(mk(new THREE.PlaneGeometry(0.66, 1.4), cloth, { p: [0, -0.7, 0] })); const gl = mk(new THREE.PlaneGeometry(0.66, 0.16), M.glow2, { p: [0, -1.35, 0.01] }); gl.visible = false; s.add(gl); segs.push({ s, gl }); par = s; }
      cape.push(segs);
    }
    // stade 3 : cœur incandescent dans la poitrine (révélé quand le plastron éclate) + épée spectrale flottante
    const core = mk(new THREE.IcosahedronGeometry(0.75, 1), M.glow, { p: [0, 2.2, 0.75] }); core.visible = false; J.torso.add(core);
    const coreLight = new THREE.PointLight(accent, 0, 14, 2); coreLight.position.set(0, 2.2, 1.4); J.torso.add(coreLight);
    const ghost = new THREE.Group(); root.add(ghost); ghost.visible = false;
    ghost.add(mk(new THREE.BoxGeometry(0.55, 6.5, 0.12), M.glow2, { p: [0, -3.2, 0] })); ghost.add(mk(new THREE.BoxGeometry(1.6, 0.22, 0.3), M.glow2, { p: [0, 0.1, 0] }));
    // parties touchables
    const part = (obj, off, r, weak) => { b.parts.push({ obj, off, r, weak: !!weak }); return b.parts.length - 1; };
    part(J.knL, new V3(0, -0.9, 0), 1.0); part(J.knR, new V3(0, -0.9, 0), 1.0);
    part(J.pelvis, new V3(0, 0, 0), 1.6); part(J.torso, new V3(0, 2.0, 0.2), 2.0);
    const HEAD = part(J.head, new V3(0, 1.3, 0.2), 1.5, true);
    const CORE = part(J.torso, new V3(0, 2.2, 0.8), 1.1, false); b.parts[CORE].nohit = true;
    b.focus = () => b.partPos(HEAD);
    b.blockers = () => { if ((b.airY || 0) > 3) return []; const out = []; for (const k of ['L', 'R']) { const p = J['kn' + k].localToWorld(new V3(0, -1.5, 0.3)); out.push({ x: p.x, z: p.z, r: 1.2, h: 4 }); } out.push({ x: b.pos.x, z: b.pos.z, r: 1.3, h: 4 }); return out; };
    b.onStage = function (s) {
      if (s === 2) { horns.forEach((m, i) => H.grow(b, m, 1.0 + i * 0.1)); cape.forEach((segs, i) => segs.forEach((g, k) => H.grow(b, g.gl, 1.0 + i * 0.05 + k * 0.08))); }
      if (s === 3) {
        A.later(1.0, () => H.breakOff(b, chest, 8)); pauldrons.forEach((p, i) => A.later(1.15 + i * 0.12, () => H.breakOff(b, p, 9)));
        H.grow(b, core, 1.1); b.parts[CORE].nohit = false; b.parts[CORE].weak = true; H.grow(b, ghost, 1.4);
        A.later(1.1, () => { chestRunes.visible = false; });
      }
    };
    // ---- pose ----
    const pose = { py: 4.6, tx: 0, ty: 0, tz: 0, hx: 0, hy: 0, shLx: 0.1, shLz: 0.25, shRx: -0.35, shRz: -0.2, elL: -0.3, elR: -0.7, wR: -0.9, wRz: 0, hipL: 0, hipR: 0, knL: 0, knR: 0 };
    const blend = poser(pose); let walkPh = 0, moving = 0, strafe = 0;
    b.evoPose = t => { const c = ease(t / 0.8) * (1 - ease((t - 1.0) / 0.2)), up = ease((t - 0.95) / 0.25) * (1 - ease((t - 2.4) / 0.4));
      return { py: 4.6 - 1.2 * c, tx: 0.45 * c - 0.3 * up, hx: -0.4 * up, knL: 1.0 * c, knR: 1.0 * c, hipL: -0.8 * c, hipR: -0.8 * c, shRx: -0.4 - 2.6 * up, shRz: -0.2, wR: 0.2, shLx: -0.3 - 2.2 * up, shLz: 0.3 + 0.6 * up }; };
    b.animate = function (dt) {
      root.position.set(b.vp.x, b.airY || 0, b.vp.z); root.rotation.y = b.vy; root.scale.setScalar(b.sc);
      const br = Math.sin(b.t * 1.6);
      const w = { py: 4.6 + br * 0.04 - moving * Math.abs(Math.sin(walkPh)) * 0.18, tx: 0.06 + br * 0.015, ty: Math.sin(walkPh) * 0.07 * moving, tz: 0, hx: -0.04, hy: 0,
        shLx: -Math.sin(walkPh) * 0.4 * moving + 0.1, shLz: 0.25, shRx: -0.35 + Math.sin(walkPh) * 0.15 * moving, shRz: -0.2, elL: -0.3, elR: -0.7, wR: -0.9 + br * 0.04, wRz: 0,
        hipL: Math.sin(walkPh) * 0.5 * moving, hipR: -Math.sin(walkPh) * 0.5 * moving, knL: Math.max(0, -Math.cos(walkPh)) * 0.7 * moving, knR: Math.max(0, Math.cos(walkPh)) * 0.7 * moving };
      if (b.broken > 0) Object.assign(w, { py: 2.4, tx: 0.7, hx: 0.3, hipL: -1.3, hipR: -1.0, knL: 1.7, knR: 1.4, shRx: -0.6, wR: 1.4, shLx: -0.9 });
      for (const it of b.insts) if (it.pose) Object.assign(w, it.pose(it.t));
      blend(w, dt, 12);
      J.pelvis.position.y = pose.py; J.torso.rotation.set(pose.tx, pose.ty, pose.tz); J.head.rotation.set(pose.hx, pose.hy, 0);
      J.shL.rotation.set(pose.shLx, 0, pose.shLz); J.shR.rotation.set(pose.shRx, 0, pose.shRz); J.elL.rotation.x = pose.elL; J.elR.rotation.x = pose.elR;
      J.wrR.rotation.set(pose.wR, 0, pose.wRz);
      J.hipL.rotation.x = pose.hipL; J.hipR.rotation.x = pose.hipR; J.knL.rotation.x = pose.knL; J.knR.rotation.x = pose.knR;
      moving = Math.max(0, moving - dt * 2.5);
      // cape : ondulation qui suit le mouvement
      cape.forEach((segs, i) => segs.forEach((g, k) => { g.s.rotation.x = 0.12 + (k ? 0.08 : 0.3) + Math.sin(b.t * 2.2 + i * 0.7 + k * 0.9) * (0.06 + k * 0.03) + moving * 0.25 * (k ? 0.5 : 1) + (b.airY || 0) * 0.04; g.s.rotation.z = Math.sin(b.t * 1.4 + i) * 0.04; }));
      if (b.stage >= 2 && Math.random() < dt * 14) { const p = swordMid.getWorldPosition(new V3()).add(new V3(rnd(Math.random, -0.4, 0.4), rnd(Math.random, -2.5, 2.5), rnd(Math.random, -0.4, 0.4))); S.fx.spark(p, new V3(0, 2.5, 0), { color: b.glowCol, life: 0.6, size: 0.6, size1: 0.1, world: true }); }
      if (ghost.visible) { ghost.position.set(-3.2, 9 + Math.sin(b.t * 1.8) * 0.5, -1.6); ghost.rotation.set(0.25, b.t * 0.8, Math.PI + 0.15); }
      coreLight.intensity = core.visible ? 3 + Math.sin(b.t * 6) * 1 : 0;
    };
    b.move = function (dt) {
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z);
      b.faceToward(dt, tp, 2.2);
      const F = fwdOf(b.yaw), Rt = rightOf(b.yaw);
      strafe = Math.sin(b.t * 0.45) * 0.6;
      let vx = 0, vz = 0;
      if (d > 7.5) { vx += F.x; vz += F.z; } else if (d < 4.5) { vx -= F.x * 0.6; vz -= F.z * 0.6; }
      vx += Rt.x * strafe; vz += Rt.z * strafe;
      const L = Math.hypot(vx, vz);
      if (L > 0.05) { const sp = 5.4 * b.speed; b.pos.x += vx / L * sp * dt * Math.min(1, L); b.pos.z += vz / L * sp * dt * Math.min(1, L); moving = Math.min(1, L); const prev = walkPh; walkPh += dt * 3.6 * b.speed; if (Math.floor(walkPh / Math.PI) !== Math.floor(prev / Math.PI)) { A.sfx('stomp', { g: 0.35, rate: 1.3 }); A.shake(0.06); } }
      const q = H.clampR(b.pos.x, b.pos.z, 25); b.pos.x = q[0]; b.pos.z = q[1];
    };
    b.choose = function () {
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z), sg = b.stage, n = b.nPlayers();
      const L = [];
      if (d < 12) L.push(['combo', 4, 1.0], ['feint', 1.6, 1.2]);
      if (d >= 7) L.push(['thrust', 2.6, 1.1, null, ['combo', null, 0.25, 1]], ['waves', 2.2, 1.3], ['leap', 1.8, 1.2]);
      else L.push(['waves', 0.8, 1.3]);
      if (sg >= 2) L.push(['swords', 2.2, 1.3, { ids: A.players().map(p => p.id) }], ['five', d < 14 ? 2.8 : 1.2, 1.1], ['leap', 1.2, 1.0, null, ['five', null, 0.2, 1]]);
      if (n > 1) L.push(['swords', 1.6, 1.4, { ids: A.players().map(p => p.id) }]);
      if (sg >= 3 && b.t - (b.lastJudg || -99) > 26) L.push(['judgement', 4, 1.6]);
      const x = b.weighted(L); if (x[0] === 'judgement') b.lastJudg = b.t;
      return [x[0], x[2], x[3], x[4]];
    };
    const tgPos = P => { const p = A.player(P.tg); return p && p.alive ? p.pos : new V3(P.tx, 0, P.tz); };
    // poses d'un coup d'épée : 'diag' (diagonale), 'sweep' (horizontal), 'slam' (vertical), 'thrust' (estoc), 'rise' (remontante)
    function swingPose(kind, k, s2, rec) {
      const r2 = Math.max(rec, 0.15);
      if (kind === 'sweep') return { ty: (1.0 * k - 2.0 * s2) * r2, shRx: -1.5 * k + 0.2 * s2, shRz: -0.3 - 1.0 * k + 0.6 * s2, wR: 0.3, wRz: -0.8 * k + 1.4 * s2, py: 4.3, knL: 0.4, knR: 0.4, hipL: -0.3, hipR: -0.3 };
      if (kind === 'slam') return { shRx: (-3.0 * k * (1 - s2) - 1.2 * s2) * r2, shLx: (-2.6 * k * (1 - s2) - 1.0 * s2) * r2, shLz: 0.1, shRz: -0.1, wR: -0.5 * k * (1 - s2) + 0.15 * s2, py: 4.6 - 1.3 * s2 * rec, tx: 0.6 * s2 * rec - 0.2 * k * (1 - s2), knL: 1 * s2 * rec, knR: 1 * s2 * rec, hipL: -0.8 * s2 * rec, hipR: -0.8 * s2 * rec };
      if (kind === 'thrust') return { shRx: -1.2 * k - 0.3 * s2, shRz: -0.1, elR: -1.6 * k * (1 - s2), wR: 0.5 * (1 - s2) - 0.2 * s2, ty: 0.5 * k - 0.8 * s2, py: 4.2, tx: 0.35, knL: 0.8, knR: 0.2, hipL: -1.0, hipR: 0.3 };
      if (kind === 'rise') return { shRx: (-0.2 * k - 2.9 * s2) * r2, shRz: -0.5, wR: 1.4 * (1 - s2) - 0.3 * s2, ty: -0.6 * k + 0.6 * s2, py: 4.0 + 0.6 * s2, tx: 0.3 * k - 0.3 * s2, knL: 0.7 * k, knR: 0.7 * k, hipL: -0.6 * k, hipR: -0.6 * k };
      return { shRx: (-2.6 * k * (1 - s2) - 1.0 * s2) * r2, shRz: -0.6 * k * (1 - s2) + 0.5 * s2, wR: -0.3 * k + 0.4 * s2, wRz: 0.5 * s2, ty: 0.7 * k - 1.1 * s2, py: 4.3, tx: 0.2 + 0.3 * s2, knL: 0.5, knR: 0.5, hipL: -0.4, hipR: -0.4 };
    }
    // séquence de coups : chaque coup se prépare (marquage), le chevalier se tourne vers sa cible puis fige sa visée
    function strikeSeq(P, list, extraUpdate) {
      let cur = 0;
      const inst = { dur: list[list.length - 1].t + 1.0, main: true, ownsMove: true,
        pose: tt => { let c = list[list.length - 1]; for (const s of list) if (tt < s.t + 0.3) { c = s; break; } const k = ease((tt - (c.t - c.w)) / (c.w * 0.85)), s2 = ease((tt - c.t) / 0.1), rec = 1 - ease((tt - c.t - 0.3) / 0.35); return swingPose(c.k, k, s2, rec); },
        update(tt, dt) {
          list.forEach((s, i) => {
            if (tt >= s.t - s.w && tt < s.t - 0.22) { b.faceToward(dt, tgPos(P), 6); if (s.lunge) { const tp = tgPos(P), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z); if (d > 6) b.pos.addScaledVector(fwdOf(b.yaw), Math.min(d - 6, s.lunge * dt)); const q = H.clampR(b.pos.x, b.pos.z, 27); b.pos.x = q[0]; b.pos.z = q[1]; } }
            if (tt >= s.t - s.w && !s.d) { s.d = 1; s.yaw = b.yaw; s.x = b.pos.x; s.z = b.pos.z; s.dec = tele(s); A.sfx(s.k === 'slam' ? 'charge' : 'swingBig', { len: s.w, rate: 0.5, g: 0.5 }); }
            if (s.dec && tt < s.t - 0.22) { s.yaw = b.yaw; s.x = b.pos.x; s.z = b.pos.z; s.dec.set(new V3(s.x, 0, s.z), s.yaw); }
            if (tt >= s.t && !s.h) { s.h = 1; hit(s, i, inst); }
          });
          if (extraUpdate) extraUpdate(tt, dt, inst);
        } };
      return inst;
    }
    const SHAPE = { diag: [9.5, 1.7], sweep: [11.5, 2.9], rise: [9, 1.3], thrust: [14, 0], slam: [13, 0] };
    function tele(s) {
      const p = new V3(s.x, 0, s.z);
      if (s.k === 'slam') return S.fx.decal(p, 'line', { len: 13, width: 3.4, yaw: s.yaw, color: RED, dur: s.w });
      if (s.k === 'thrust') return S.fx.decal(p, 'line', { len: 14, width: 2.6, yaw: s.yaw, color: RED, dur: s.w });
      return S.fx.decal(p, 'sector', { r: SHAPE[s.k][0], arc: SHAPE[s.k][1], yaw: s.yaw, color: RED, dur: s.w });
    }
    function hit(s, i, inst) {
      const p = new V3(s.x, 0, s.z), col = b.glowCol;
      A.sfx('swingBig', { rate: 0.35, g: 1.4 }); A.shake(s.k === 'slam' ? 0.6 : 0.3);
      if (s.ranged) { S.fx.slash(p.clone().setY(2), s.yaw, { r: 6, arc: 1.8, tilt: i % 2 ? -0.6 : 0.6, color: col, life: 0.3, inner: 0.6, world: true }); return; }
      if (s.k === 'slam') {
        const F = fwdOf(s.yaw);
        H.strike(b, inst, 'k' + i, s.x + F.x * 1.5, s.z + F.z * 1.5, s.yaw, 11.5, 3.4, 170, col, { hurt: { up: 7, kb: 6 } });
        H.blast(b, inst, 'kb' + i, s.x + F.x * 12, s.z + F.z * 12, 3.2, 120, col, { smoke: 0x3a3440 });
        if (s.wave) H.wave(b, s.x + F.x * 6, s.z + F.z * 6, { r0: 2, rMax: 30, dmg: 100, color: col });
      } else if (s.k === 'thrust') {
        S.fx.slash(p.clone().setY(2.4), s.yaw, { r: 14, arc: 0.25, color: col, life: 0.3, inner: 0.1, world: true });
        A.hurtLine(s.x, s.z, s.yaw, 14, 2.6, 150, { kb: 12, up: 3 }, inst, 'k' + i);
      } else {
        const sh = SHAPE[s.k];
        S.fx.slash(p.clone().setY(s.k === 'sweep' ? 1.4 : 2.4), s.yaw, { r: sh[0], arc: sh[1], tilt: s.k === 'diag' ? 0.7 : s.k === 'rise' ? -1.2 : 0, color: col, life: 0.35, inner: 0.6, flip: i % 2 === 1, world: true });
        A.hurtSector(s.x, s.z, s.yaw, sh[0], sh[1], s.k === 'sweep' ? 140 : 125, { kb: 10, up: s.k === 'rise' ? 9 : 4, air: s.k === 'sweep', h: 3 }, inst, 'k' + i);
      }
    }
    // combo de 3 coups (4 au stade 2, 5 au stade 3), dernier coup parfois retardé (feinte de rythme)
    b.attacks.combo = (P, r) => {
      const sg = P.sg || 1, hold = r() < 0.45 ? 0.6 : 0, list = [];
      let t = 0.75; list.push({ t, w: 0.7, k: 'diag' }); t += 0.62; list.push({ t, w: 0.5, k: 'sweep' });
      if (sg >= 2) { t += 0.6; list.push({ t, w: 0.5, k: 'rise', lunge: 8 }); }
      if (sg >= 3) { t += 0.58; list.push({ t, w: 0.48, k: 'diag', lunge: 8 }); }
      t += 0.8 + hold; list.push({ t, w: 0.75 + hold, k: 'slam', wave: sg >= 2 });
      A.sfx('roar', { rate: 1.7, g: 0.45 });
      return strikeSeq(P, list);
    };
    // cinq coups enchaînés avec des pas en avant (stade 2+)
    b.attacks.five = (P, r) => {
      const ks = ['diag', 'sweep', 'thrust', 'rise', 'slam'], list = []; let t = 0.6;
      ks.forEach((k, i) => { const w = k === 'slam' ? 0.7 + r() * 0.35 : 0.45 + (i === 2 ? 0.1 : 0); list.push({ t, w, k, lunge: 11, wave: k === 'slam' && (P.sg || 1) >= 3 }); t += [0.55, 0.6, 0.55, 0.9, 0][i]; });
      return strikeSeq(P, list);
    };
    // feinte : marquage d'un coup vertical devant lui… puis toupie à 360° (le vrai coup)
    b.attacks.feint = (P) => {
      const p0 = new V3(P.x, 0, P.z), yaw0 = Math.atan2(P.tx - P.x, P.tz - P.z);
      const fake = S.fx.decal(p0, 'line', { len: 13, width: 3.4, yaw: yaw0, color: RED, dur: 1.3, noWarn: true });
      A.sfx('charge', { len: 0.8, g: 0.5 });
      const inst = { dur: 2.5, main: true, ownsMove: true,
        pose: t => t < 0.75 ? swingPose('slam', ease(t / 0.7), 0, 1) : { ty: t < 1.45 ? 1.2 * ease((t - 0.75) / 0.5) : 1.2, shRx: -1.3, shRz: -1.4, wR: 0.2, wRz: 1.2, py: 4.1, knL: 0.6, knR: 0.6, hipL: -0.5, hipR: -0.5, shLx: -0.5, shLz: 1.1 },
        update(t, dt) {
          if (t < 0.6) b.yaw = yaw0;
          if (t >= 0.75 && !inst.sw) { inst.sw = 1; S.fx.kill(fake.it); S.fx.decal(p0, 'circle', { r: 10.5, color: RED, dur: 0.72 }); A.sfx('roar', { rate: 2.2, g: 0.4 }); }
          if (t >= 1.47 && t < 2.0) {
            b.yaw = yaw0 + (t - 1.47) / 0.53 * Math.PI * 2;
            if (!inst.s) { inst.s = 1; A.sfx('swingBig', { rate: 0.3, g: 1.5 }); A.shake(0.5); }
            if (Math.floor(t * 9) !== inst.q) { inst.q = Math.floor(t * 9); S.fx.slash(p0.clone().setY(2), b.yaw, { r: 10.5, arc: 1.6, color: b.glowCol, life: 0.3, inner: 0.65, world: true }); }
            A.hurtCircle(P.x, P.z, 10.5, 160, { kb: 13, up: 5 }, inst, 'fs');
          }
        } };
      return inst;
    };
    // estoc : ruée en ligne droite, épée tendue
    b.attacks.thrust = (P) => {
      const p0 = new V3(P.x, 0, P.z), dir = new V3(P.tx - P.x, 0, P.tz - P.z); const dist = dir.length(); dir.normalize();
      const yaw = Math.atan2(dir.x, dir.z); let len = Math.min(26, dist + 6);
      for (let k = 0; k < 40 && p0.clone().addScaledVector(dir, len).length() > 27; k++) len -= 1; len = Math.max(6, len);
      S.fx.decal(p0, 'line', { len: len + 6, width: 4, yaw, color: RED, dur: 0.85 });
      A.sfx('charge', { len: 0.85, g: 0.7 });
      const T = len / 30;
      const inst = { dur: 0.85 + T + 0.7, main: true, ownsMove: true,
        pose: t => swingPose('thrust', ease(t / 0.8), ease((t - 0.85) / 0.08), 1 - ease((t - 0.85 - T - 0.2) / 0.4)),
        update(t) {
          b.yaw = yaw; if (t < 0.85) return;
          const k = Math.min(1, (t - 0.85) / T); b.pos.copy(p0).addScaledVector(dir, len * ease(k));
          if (k < 1) { const tip = b.pos.clone().addScaledVector(dir, 5); A.hurtCircle(tip.x, tip.z, 2.6, 160, { kb: 12, up: 3 }, inst, 't'); A.hurtCircle(b.pos.x, b.pos.z, 2.2, 120, { kb: 10 }, inst, 'tb'); if (Math.random() < 0.6) S.fx.burst(b.pos.clone().setY(0.3), { n: 3, color: 0x3a3440, kind: 'smoke', speed: 4, up: 0.5, life: 0.7, size: 1.2, size1: 2.2, world: true }); if (!inst.s) { inst.s = 1; A.sfx('dash', { g: 2, rate: 0.5 }); S.fx.slash(b.pos.clone().setY(2.4), yaw, { r: 8, arc: 0.3, color: b.glowCol, life: 0.3, inner: 0.1, world: true }); } }
        } };
      return inst;
    };
    // ondes d'épée : trois coups qui lancent des croissants rasant le sol (éventail), à sauter ou à traverser en esquive
    const crescentGeo = new THREE.TorusGeometry(1.9, 0.2, 5, 18, Math.PI); b.ownGeos.push(crescentGeo);
    const crescent = col => { const g = new THREE.Group(); const m = new THREE.Mesh(crescentGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = Math.PI / 2; g.add(m); return g; };
    b.attacks.waves = (P, r) => {
      const sg = P.sg || 1, n = sg >= 2 ? 5 : 3, list = [];
      let t = 0.7; for (let i = 0; i < 3; i++) { list.push({ t, w: i ? 0.45 : 0.65, k: i % 2 ? 'sweep' : 'diag' }); t += 0.62; }
      const inst = strikeSeq(P, list);
      const baseUpd = inst.update;
      inst.update = (tt, dt) => {
        list.forEach((s, i) => { if (tt >= s.t && !s.f) { s.f = 1; const F = fwdOf(s.yaw), from = new V3(s.x + F.x * 2, 0.85, s.z + F.z * 2), off = (i % 2 ? 0.16 : -0.16);
          for (let k = 0; k < n; k++) { const a = s.yaw + off + (k / (n - 1) - 0.5) * (sg >= 2 ? 1.3 : 0.9); A.eproj({ pos: from.clone(), vel: fwdOf(a).multiplyScalar(19 * b.speed), r: 1.15, dmg: 85, color: b.glowCol.getHex(), life: 2.2, mesh: crescent(b.glowCol), onUpdate: (p) => { p.mesh.rotation.y = a; } }); } } });
        baseUpd(tt, dt);
      };
      // ces coups ne frappent qu'à distance : pas de dégâts de mêlée
      list.forEach(s => { s.ranged = true; });
      return inst;
    };
    // bond : retombe épée la première, puis fissures en croix (en étoile au stade 2+)
    b.attacks.leap = (P) => {
      const p0 = new V3(P.x, 0, P.z), p1 = new V3(P.tx, 0, P.tz); { const q = H.clampR(p1.x, p1.z, 24); p1.set(q[0], 0, q[1]); }
      const nl = (P.sg || 1) >= 2 ? 8 : 4, a0 = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      S.fx.decal(p1, 'circle', { r: 6.5, color: RED, dur: 1.5 });
      A.sfx('roar', { rate: 1.5, g: 0.7 });
      const inst = { dur: 3.0, main: true, ownsMove: true,
        pose: t => { const c = t < 0.5 ? ease(t / 0.5) : 0, air = t >= 0.5 && t < 1.5, land = ease((t - 1.5) / 0.1) * (1 - ease((t - 2.3) / 0.5));
          return { py: 4.6 - 1.6 * c - 1.6 * land, knL: 1.3 * c + 1.4 * land, knR: 1.3 * c + 1.4 * land, hipL: -1.0 * c - 1.1 * land, hipR: -1.0 * c - 1.1 * land, tx: 0.4 * c + 0.7 * land, shRx: air ? -3.0 : -1.2 * land - 0.3, shLx: air ? -2.6 : -1.0 * land, wR: air ? -0.4 : 0.1 }; },
        update(t) {
          if (t >= 0.5 && t < 1.5) { const k = (t - 0.5) / 1.0; b.pos.lerpVectors(p0, p1, ease(k)); b.airY = Math.sin(k * Math.PI) * 11; b.yaw = a0; } else b.airY = 0;
          if (t >= 1.5 && !inst.h) { inst.h = 1; b.pos.copy(p1); H.blast(b, inst, 'l', p1.x, p1.z, 6.5, 190, b.glowCol, { g: 1, rate: 0.9, shake: 0.9, light: true, smoke: 0x3a3440 }); A.sfx('stomp'); }
          for (let i = 0; i < nl; i++) { const a = a0 + i / nl * Math.PI * 2, tl = 1.85 + (i % 2) * 0.3; if (t >= 1.5 && !inst['d' + i]) { inst['d' + i] = 1; S.fx.decal(p1, 'line', { len: 26, width: 2.6, yaw: a, color: RED, dur: tl - 1.5 }); } if (t >= tl && !inst['f' + i]) { inst['f' + i] = 1; H.strike(b, inst, 'f' + i, p1.x, p1.z, a, 26, 2.6, 120, b.glowCol, { quiet: i > 1 }); } }
        }, end() { b.airY = 0; }, cancel() { b.airY = 0; } };
      return inst;
    };
    // lames spectrales (stade 2+) : un cercle d'épées se forme autour de chaque joueur en le suivant, puis frappe vers le centre
    const ghostSword = () => { const g = new THREE.Group(); const m = new THREE.Mesh(S.fx.geo.box, new THREE.MeshBasicMaterial({ color: b.glowCol.clone().multiplyScalar(2.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.set(0.35, 0.12, 4.2); m.position.z = 1.4; g.add(m); const h2 = new THREE.Mesh(S.fx.geo.box, m.material.clone()); h2.scale.set(1.3, 0.15, 0.25); h2.position.z = -0.8; g.add(h2); return g; };
    b.attacks.swords = (P) => {
      const ids = (P.ids && P.ids.length ? P.ids : [P.tg]).slice(0, 4), rings = (P.sg || 1) >= 3 ? 2 : 1, N = 8, R = 6.5;
      const groups = [];
      ids.forEach((id, gi) => { for (let ri = 0; ri < rings; ri++) groups.push({ id, ri, t0: 0.2 + ri * 0.9, track: 1.0, lock: 0.5, c: null, swords: [], off: (gi * 0.37 + ri * 0.39) }); });
      A.sfx('magic', { rate: 0.3, g: 1 });
      const inst = { dur: 0.2 + (rings - 1) * 0.9 + 1.5 + 1.2, main: true, ownsMove: true,
        pose: t => ({ shLx: -2.6 * ease(t / 0.5), shLz: 0.5, hx: -0.3, shRx: -0.8, wR: 0.6 }),
        update(t, dt) {
          groups.forEach((g, gi) => {
            const pl = A.player(g.id);
            if (t >= g.t0 && !g.c) { g.c = (pl && pl.alive ? pl.pos : new V3(P.tx, 0, P.tz)).clone().setY(0); g.dec = S.fx.decal(g.c, 'circle', { r: R, color: RED, dur: g.track + g.lock }); for (let k = 0; k < N; k++) { const m = ghostSword(); g.swords.push(m); S.fx.add(m, g.track + g.lock + 0.6, null, true); } }
            if (!g.c) return;
            const tt = t - g.t0;
            if (tt < g.track && pl && pl.alive) { g.c.x += (pl.pos.x - g.c.x) * Math.min(1, dt * 4); g.c.z += (pl.pos.z - g.c.z) * Math.min(1, dt * 4); const q = H.clampR(g.c.x, g.c.z, 30); g.c.x = q[0]; g.c.z = q[1]; g.dec.set(g.c); }
            const stab = tt >= g.track + g.lock, sk = BR.clamp((tt - g.track - g.lock) / 0.14, 0, 1);
            g.swords.forEach((m, k) => { const a = g.off + k / N * Math.PI * 2 + (tt < g.track ? tt * 0.8 : g.track * 0.8), rr = R * (1 - sk * 0.85); m.position.set(g.c.x + Math.sin(a) * rr, 1.2 + (1 - Math.min(1, tt * 3)) * 6, g.c.z + Math.cos(a) * rr); m.rotation.set(0, a + Math.PI, 0); });
            if (stab && !g.h) { g.h = 1; A.sfx('swingBig', { rate: 0.8, g: 1 }); A.shake(0.3); S.fx.flash(g.c.clone().setY(1), { color: b.glowCol, r: 2.5, life: 0.3, light: false }); S.fx.burst(g.c.clone().setY(1), { n: 40, color: b.glowCol, speed: 10, life: 0.5, world: true }); A.hurtCircle(g.c.x, g.c.z, R * 0.9, 140, { kb: 3, up: 4 }, inst, 'g' + gi); }
          });
        } };
      return inst;
    };
    // DANGER TOTAL (stade 3) : il s'élève, des lignes de lames balaient l'arène en damier, puis une taille à 300° :
    // seul l'angle mort derrière lui est sûr (ou une esquive parfaite au bon moment)
    b.attacks.judgement = (P, r) => {
      const p0 = new V3(P.x, 0, P.z), c0 = new V3(0, 0, 0), a0 = r() * Math.PI, T = 5.6;
      A.voice(b.faces[0], 0.6, 1.3); A.sfx('roar', { g: 1.3, rate: 0.75 });
      BR.Arena.banner('DANGER TOTAL', 'Réfugie-toi dans son angle mort !', 1.8, 'bad');
      const lines = []; for (let w = 0; w < 2; w++) for (let i = -3; i <= 3; i++) lines.push({ w, off: i * 9 + (w ? 4.5 : 0), t: 1.6 + w * 1.1 });
      let yawF = 0;
      const inst = { dur: T + 1.6, main: true, ownsMove: true,
        pose: t => t < T - 0.9 ? { py: 4.4, shRx: -3.0 * ease(t / 0.6), shRz: -0.1, wR: -0.2, shLx: -2.0, shLz: 0.9, hx: -0.4, knL: 0.3, knR: 0.6, hipL: -0.2, hipR: -0.4 } : swingPose('sweep', ease((t - T + 0.9) / 0.8), ease((t - T) / 0.12), 1 - ease((t - T - 0.5) / 0.6)),
        update(t, dt) {
          if (t < 1.2) { b.pos.lerpVectors(p0, c0, ease(t / 1.2)); b.airY = ease(t / 1.2) * 5; }
          else if (t < T - 0.2) { b.airY = 5 + Math.sin(t * 2) * 0.4; b.pos.copy(c0); }
          else b.airY = Math.max(0, b.airY - dt * 25);
          lines.forEach((L, i) => {
            const d = fwdOf(a0 + Math.PI / 2), s0 = new V3(-d.x * 36 + Math.sin(a0) * 0, 0, -d.z * 36); const x = Math.sin(a0) * L.off + s0.x, z = Math.cos(a0) * L.off + s0.z;
            if (t >= L.t - 1.0 && !L.d) { L.d = 1; S.fx.decal(new V3(x, 0, z), 'line', { len: 72, width: 3.2, yaw: a0 + Math.PI / 2, color: RED, dur: 1.0 }); }
            if (t >= L.t && !L.h) { L.h = 1; H.strike(b, inst, 'j' + i, x, z, a0 + Math.PI / 2, 72, 3.2, 120, b.glowCol, { quiet: i % 3 !== 0, h: 8 }); }
          });
          // la grande taille : il vise le joueur le plus menaçant, l'angle mort est derrière lui
          if (t >= T - 1.7 && !inst.big) {
            inst.big = 1; const tp = tgPos(P); yawF = Math.atan2(tp.x, tp.z); b.yaw = yawF;
            S.fx.decal(c0, 'sector', { r: 36, arc: Math.PI * 2 - 1.15, yaw: yawF, color: RED, dur: 1.7 });
            S.fx.decal(c0, 'sector', { r: 30, arc: 1.05, yaw: yawF + Math.PI, color: 0x60ffb0, dur: 1.7, noWarn: true });
            A.sfx('charge', { len: 1.7, g: 1 });
          }
          if (inst.big && t < T) b.yaw = yawF;
          if (t >= T && !inst.x) {
            inst.x = 1; S.fx.slash(new V3(0, 2, 0), yawF, { r: 34, arc: Math.PI * 2 - 1.15, color: b.glowCol, life: 0.5, inner: 0.15, world: true });
            S.fx.flash(new V3(0, 3, 0), { color: 0xffffff, r: 10, life: 0.5, intensity: 10 }); BR.Audio.fx('boom', { len: 2 }); A.shake(1.1);
            A.hurtSector(0, 0, yawF, 37, Math.PI * 2 - 1.15, 360, { kb: 14, up: 6, unblockable: true }, inst, 'big');
          }
        }, end() { b.airY = 0; }, cancel() { b.airY = 0; } };
      return inst;
    };
    return b;
  }

  /* =====================================================================
     6. LE BÉHÉMOTH — quadrupède cuirassé, cornes, épines de cristal, queue-massue
     ===================================================================== */
  function beast(S, o) {
    const b = AB.base(S, o, 'beast'), A = b.A, accent = 0xffa424;
    const M = H.mats(b, '#5a4e40', accent, { dark: '#2a221c', metalCol: '#8a7a64', metal: 0.3, rough: 0.6 });
    const crys = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffcf6a').convertSRGBToLinear(), emissive: new THREE.Color(accent), emissiveIntensity: 1.2, roughness: 0.25, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 }); b.ownMats.push(crys);
    b.size = 10; b.postureMax = 170; b.pos.set(0, 0, 11); b.vp.copy(b.pos);
    // modèle Blender (outils/blender-boss-a.py) : bête cuirassée, carapace à écailles, collerette de piques, corne nasale,
    // médaillon (photo) sur le front ; BIG : le béhémoth est agrandi (zones de coups avancées en conséquence)
    const MK = window.BOSS_A_KIT ? window.BOSS_A_KIT(b, 'boss_beast') : null;
    const BIG = MK ? 1.35 : 1;
    if (MK) b.size = 13;
    const mk = (geo, mat, opt) => H.mesh(b, geo, mat, opt);
    const root = new THREE.Group(); b.group.add(root);
    // pivot du corps au niveau des hanches arrière (il peut se cabrer)
    const pivot = new THREE.Group(); pivot.position.set(0, 3.6, -2.6); root.add(pivot);
    const body = new THREE.Group(); body.position.set(0, 0.5, 2.6); pivot.add(body);
    if (MK) body.add(MK.get('body'));
    else {
      body.add(mk(H.lumpy(1, 2, 0.12, 51, 3.0, 2.3, 4.8), M.rock));
      body.add(mk(H.lumpy(1, 1, 0.2, 52, 2.4, 1.6, 2.2), M.dark, { p: [0, -0.9, 2.6] }));
    }
    // plaques dorsales (certaines éclatent au stade 3) + fissures dessous
    const plates = [], cracks = [], top = MK ? 0.9 : 0;
    for (let i = 0; i < 5; i++) {
      const z = 3.2 - i * 1.6, w = 2.6 - Math.abs(i - 2) * 0.25;
      let pl;
      if (MK) { pl = MK.get('plate'); pl.position.set(0, 3.0 - Math.abs(i - 2) * 0.2, z); pl.rotation.x = -0.12; pl.scale.set(w / 2.6, 1, 1); }
      else pl = mk(H.lumpy(1, 1, 0.15, 60 + i, w, 0.55, 0.95), M.metal, { p: [0, 2.05 - Math.abs(i - 2) * 0.12, z], r: [0.15, 0, 0] });
      body.add(pl); plates.push(pl);
      const cr = mk(new THREE.BoxGeometry(w * 1.3, 0.12, 0.18), M.glow, { p: [0, 1.85 - Math.abs(i - 2) * 0.12 + top, z + 0.5] }); cr.visible = false; body.add(cr); cracks.push(cr);
    }
    // épines de cristal (grossissent au stade 2)
    const spines = [];
    for (let i = 0; i < 9; i++) { const side = i % 3 - 1, z = 2.6 - Math.floor(i / 3) * 2.2; const m = mk(new THREE.ConeGeometry(0.42, 2.4, 5), crys, { p: [side * (MK ? 1.9 : 1.3), 2.5 + (MK ? (side ? 0.4 : 0.75) : 0), z], r: [-0.35, 0, -side * 0.5], s: side ? 0.8 : 1.1 }); body.add(m); spines.push(m); }
    const spinesBig = [];
    for (let i = 0; i < 6; i++) { const z = 3.2 - i * 1.4; const m = mk(new THREE.ConeGeometry(0.55, 3.4, 5), crys, { p: [(i % 2 ? 0.6 : -0.6) * (MK ? 1.6 : 1), 2.7 + top * 0.8, z], r: [-0.5, 0, (i % 2 ? -0.3 : 0.3)] }); m.visible = false; body.add(m); spinesBig.push(m); }
    // tête
    const neck = new THREE.Group(); neck.position.set(0, 0.6, 4.6); body.add(neck);
    const head = new THREE.Group(); head.position.set(0, -0.3, 1.2); neck.add(head);
    let jaw, face;
    const horns = [], hornTips = [];
    if (MK) {
      // tête de rhinocéros cuirassée (un peu plus grosse), mâchoire articulée, photo dans le médaillon du front
      const hm = MK.get('head'); hm.scale.setScalar(1.2); head.add(hm);
      jaw = MK.node(hm, 'jaw') || new THREE.Group();
      face = MK.round(AB.faceMesh(b.faces[0], 2.15, accent)); const fa = MK.node(hm, 'face'); if (fa) fa.add(face); else { face.position.set(0, 1.6, 1.0); head.add(face); }
      for (const s of [-1, 1]) {
        const anc = MK.node(hm, s < 0 ? 'tipL' : 'tipR') || head;
        const tip = mk(new THREE.ConeGeometry(0.3, 1.6, 6), crys, { p: [0, 0.4, 0.1], r: [0.5, 0, s * -0.5] }); tip.visible = false; anc.add(tip); hornTips.push(tip);
      }
    } else {
      head.add(mk(H.lumpy(1, 1, 0.15, 71, 1.8, 1.5, 1.7), M.rock, { p: [0, 0, 0.4] }));
      head.add(mk(new THREE.BoxGeometry(2.6, 0.5, 1.6), M.metal, { p: [0, 1.25, 0.3], r: [0.2, 0, 0] }));
      jaw = new THREE.Group(); jaw.position.set(0, -0.9, 0.4); head.add(jaw);
      jaw.add(mk(H.lumpy(1, 1, 0.15, 72, 1.4, 0.45, 1.3), M.dark, { p: [0, 0, 0.6] }));
      for (const s of [-1, 1]) jaw.add(mk(new THREE.ConeGeometry(0.2, 0.9, 5), M.metal, { p: [s * 0.9, 0.5, 1.5], r: [0.2, 0, 0] }));
      face = AB.faceMesh(b.faces[0], 2.3, accent); face.position.set(0, 0.15, 2.15); head.add(face);
      // cadre de pierre autour du visage (masque)
      head.add(mk(new THREE.BoxGeometry(2.8, 0.36, 0.5), M.metal, { p: [0, 1.38, 2.0] })); head.add(mk(new THREE.BoxGeometry(2.6, 0.32, 0.5), M.metal, { p: [0, -1.05, 2.0] }));
      for (const s of [-1, 1]) head.add(mk(new THREE.BoxGeometry(0.34, 2.7, 0.5), M.metal, { p: [s * 1.3, 0.15, 2.0] }));
      for (const s of [-1, 1]) {
        const hg = new THREE.Group(); hg.position.set(s * 1.4, 0.9, 0.6); head.add(hg);
        hg.add(mk(new THREE.ConeGeometry(0.55, 3.2, 6), M.metal, { p: [s * 0.9, 1.0, 0.6], r: [0.6, 0, s * -1.0] })); horns.push(hg);
        const tip = mk(new THREE.ConeGeometry(0.3, 1.6, 6), crys, { p: [s * 2.0, 2.2, 1.6], r: [0.9, 0, s * -0.7] }); tip.visible = false; hg.add(tip); hornTips.push(tip);
      }
    }
    b.faceMeshes.push(face);
    // pattes : avant sur le corps (se cabrent avec lui), arrière sur la racine
    const legs = [];
    const mkLeg = (parent, x, y, z, front, ph) => {
      const hip = new THREE.Group(); hip.position.set(x, y, z); parent.add(hip);
      const knee = new THREE.Group(); knee.position.y = -2.0; hip.add(knee);
      if (MK) { const u = MK.get('leg_u'), l = MK.get('leg_l'); if (x < 0) { u.scale.x = -1; l.scale.x = -1; } hip.add(u); knee.add(l); }
      else {
        hip.add(mk(H.lumpy(1, 1, 0.1, 80 + legs.length, 0.85, 1.25, 0.85), M.rock, { p: [0, -1.0, 0] }));
        knee.add(mk(new THREE.CylinderGeometry(0.6, 0.75, 1.9, 7), M.dark, { p: [0, -0.95, 0] }));
        knee.add(mk(new THREE.CylinderGeometry(0.95, 1.05, 0.5, 7), M.metal, { p: [0, -1.85, 0.1] }));
      }
      const L = { hip, knee, front, ph }; legs.push(L); return L;
    };
    mkLeg(body, -2.0, -0.5, 2.8, true, 0); mkLeg(body, 2.0, -0.5, 2.8, true, Math.PI);
    mkLeg(root, -2.0, 3.6, -2.4, false, Math.PI); mkLeg(root, 2.0, 3.6, -2.4, false, 0);
    // queue : segments + massue à pointes
    const tail = []; { let par = body, z = -4.4; for (let i = 0; i < 6; i++) { const g = new THREE.Group(); g.position.set(0, i ? 0 : 0.6, i ? -1.15 : z); par.add(g); if (MK) { const sg = MK.get('tailseg'); sg.scale.setScalar(1 - i * 0.1); g.add(sg); } else g.add(mk(H.lumpy(1, 1, 0.1, 90 + i, 0.75 - i * 0.07, 0.7 - i * 0.06, 0.8), M.rock, { p: [0, 0, -0.55] })); tail.push(g); par = g; } }
    const club = new THREE.Group(); club.position.z = -1.2; tail[5].add(club);
    if (MK) club.add(MK.get('club')); else club.add(mk(H.lumpy(1, 1, 0.2, 99, 1.1, 1.0, 1.2), M.metal));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, cr = MK ? 1.35 : 1.0; club.add(mk(new THREE.ConeGeometry(0.22, 1.0, 5), crys, { p: [Math.sin(a) * cr, Math.cos(a) * cr, 0], r: [0, 0, -a], s: MK ? 1.3 : 1 })); }
    if (MK && MK.mats.skin) b.rockMat = MK.mats.skin;
    // parties touchables (rayons agrandis avec la bête)
    const part = (obj, off, r, weak) => { b.parts.push({ obj, off, r: r * BIG, weak: !!weak }); return b.parts.length - 1; };
    const HEAD = part(head, MK ? new V3(0, 0.5, 2.0) : new V3(0, 0, 0.8), 2.0, false);
    part(body, new V3(0, 0.3, 2.4), 2.6); part(body, new V3(0, 0.3, -1.8), 2.7);
    const CLUB = part(club, new V3(0, 0, 0), 1.4);
    b.focus = () => b.partPos(1);
    b.blockers = () => { const F = fwdOf(b.yaw); return [{ x: b.pos.x + F.x * 1.8 * BIG, z: b.pos.z + F.z * 1.8 * BIG, r: 3.0 * b.sc * BIG, h: 5 * BIG }, { x: b.pos.x - F.x * 2.2 * BIG, z: b.pos.z - F.z * 2.2 * BIG, r: 2.8 * b.sc * BIG, h: 5 * BIG }]; };
    b.onStage = function (s) {
      if (s === 2) { spinesBig.forEach((m, i) => H.grow(b, m, 1.0 + i * 0.08)); hornTips.forEach((m, i) => H.grow(b, m, 1.2 + i * 0.1)); crys.emissiveIntensity = 1.8; }
      if (s === 3) { [1, 3].forEach((i, k) => A.later(1.0 + k * 0.2, () => H.breakOff(b, plates[i], 8))); cracks.forEach((c, i) => H.grow(b, c, 1.1 + i * 0.07)); crys.emissiveIntensity = 2.6; }
    };
    // ---- pose ----
    const pose = { pitch: 0, roll: 0, bodyY: 0, neckX: 0, neckY: 0, jaw: 0.1, tail: 0, tailUp: 0, gait: 0 };
    const blend = poser(pose); let walkPh = 0, moving = 0;
    b.evoPose = t => { const up = ease((t - 0.3) / 0.6) * (1 - ease((t - 2.2) / 0.5)); return { pitch: -0.55 * up, neckX: -0.6 * up, jaw: 0.1 + 0.7 * up, tailUp: 0.6 * up }; };
    b.animate = function (dt) {
      root.position.set(b.vp.x, b.airY || 0, b.vp.z); root.rotation.y = b.vy; root.scale.setScalar(b.sc * BIG);
      if (MK) MK.flash(b.flashT > 0);
      const br = Math.sin(b.t * 1.3);
      const w = { pitch: 0.02 * br, roll: Math.sin(walkPh) * 0.04 * moving, bodyY: br * 0.06 - moving * Math.abs(Math.sin(walkPh)) * 0.15, neckX: 0.1 + br * 0.04, neckY: 0, jaw: 0.1 + Math.max(0, br) * 0.1, tail: Math.sin(b.t * 1.1) * 0.25, tailUp: 0, gait: moving };
      if (b.broken > 0 || b.dazed > 0) Object.assign(w, { pitch: 0.18, bodyY: -1.4, neckX: 0.55, jaw: 0.5, tail: Math.sin(b.t * 4) * 0.2, gait: 0 });
      for (const it of b.insts) if (it.pose) Object.assign(w, it.pose(it.t));
      blend(w, dt, 10);
      pivot.position.y = 3.6 + pose.bodyY; pivot.rotation.set(pose.pitch, 0, pose.roll);
      neck.rotation.set(pose.neckX, pose.neckY, 0); jaw.rotation.x = pose.jaw;
      tail.forEach((g, i) => { g.rotation.y = pose.tail * (0.4 + i * 0.12) + Math.sin(b.t * 2 + i * 0.6) * 0.05; g.rotation.x = -pose.tailUp * 0.25 + 0.06; });
      legs.forEach(L => {
        const ph = walkPh + L.ph + (L.front ? 0 : Math.PI / 2), sw = Math.sin(ph) * 0.45 * pose.gait;
        let hipX = sw, knX = -Math.max(0, Math.cos(ph)) * 0.55 * pose.gait - 0.1;
        if (L.front) { hipX -= pose.pitch * 0.9; knX += pose.pitch < -0.2 ? -0.9 * (-pose.pitch) : 0; }
        L.hip.rotation.x = hipX; L.knee.rotation.x = knX;
      });
      moving = Math.max(0, moving - dt * 2.2);
      b.parts[HEAD].weak = b.broken > 0 || (b.dazed || 0) > 0;
      if ((b.dazed || 0) > 0) { b.dazed -= dt; if (Math.random() < dt * 10) S.fx.spark(b.partPos(HEAD).add(new V3(rnd(Math.random, -1, 1), 1.6, rnd(Math.random, -1, 1))), new V3(0, 1, 0), { color: 0xffe08a, life: 0.6, size: 0.5, world: true }); }
      if (b.stage >= 3 && Math.random() < dt * 10) { const c = cracks[Math.floor(Math.random() * cracks.length)]; if (c.visible) S.fx.spark(c.getWorldPosition(new V3()).add(new V3(rnd(Math.random, -1.2, 1.2), 0.2, 0)), new V3(0, 3, 0), { color: b.glowCol, life: 0.8, size: 0.6, size1: 0.1, world: true }); }
    };
    b.move = function (dt) {
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z);
      b.faceToward(dt, tp, 1.5);
      if (d > 9) { const sp = 4.8 * b.speed; b.pos.addScaledVector(fwdOf(b.yaw), sp * dt); moving = 1; const prev = walkPh; walkPh += dt * 3.0 * b.speed; if (Math.floor(walkPh / Math.PI) !== Math.floor(prev / Math.PI)) { A.sfx('stomp', { g: 0.45, rate: 0.8 }); A.shake(0.1); } }
      const q = H.clampR(b.pos.x, b.pos.z, 25); b.pos.x = q[0]; b.pos.z = q[1];
    };
    b.choose = function () {
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z), sg = b.stage, n = b.nPlayers();
      const L = [['ram', d > 8 ? 3 : 1.2, 1.3], ['stomp', d < 13 ? 2.5 : 0.8, 1.6, { pts: b.rainPts(6 + n * 2, 9) }], ['spines', 2, 1.4, { pts: b.rainPts(8 + n * 3, 8) }], ['roar', d < 14 ? 1.4 : 0.4, 0.6, null, ['ram', null, 0.2, 1]]];
      if (b.behind(13)) L.push(['tail', 5, 1.1]);
      if (sg >= 2) L.push(['quakeline', 2.2, 1.6, { a: +(b.rng() * 6.283).toFixed(2) }], ['ram', 2, 1.1, null, ['stomp', () => ({ pts: b.rainPts(6 + n * 2, 9) }), 0.3, 1]]);
      if (sg >= 3 && b.t - (b.lastRamp || -99) > 24) L.push(['rampage', 4, 1.4]);
      const x = b.weighted(L); if (x[0] === 'rampage') b.lastRamp = b.t;
      return [x[0], x[2], x[3], x[4]];
    };
    const tgPos = P => { const p = A.player(P.tg); return p && p.alive ? p.pos : new V3(P.tx, 0, P.tz); };
    // longueur d'une ruée jusqu'au bord de l'arène
    // la bête agrandie s'arrête un peu plus tôt (sa tête, pas son centre, percute le rempart)
    const RAM_R = 28 - (BIG - 1) * 8;
    const edgeLen = (p, dir, R) => { let len = 2; while (len < 70 && Math.hypot(p.x + dir.x * len, p.z + dir.z * len) < R) len += 0.5; return len; };
    // ruée : fonce jusqu'au rebord, rebondit vers sa cible (1 / 2 / 3 ruées selon le stade), puis reste sonné
    function ramInst(P, count, speed, telegraph, trailCrystals, dmg) {
      dmg = dmg || 165;
      let leg = -1, from = new V3(P.x, 0, P.z), dir = new V3(), len = 0, legT = 0, cur = 0;
      const inst = { dur: 99, main: true, ownsMove: true, phase: 'aim',
        pose: t => ({ pitch: inst.phase === 'aim' ? 0.12 : 0.18, neckX: inst.phase === 'aim' ? 0.45 : 0.55, bodyY: inst.phase === 'aim' ? -0.6 : -0.3, gait: inst.phase === 'run' ? 1.6 : 0, jaw: 0.4, tail: Math.sin(t * 9) * 0.3 }),
        update(t, dt) {
          if (inst.phase === 'aim') {
            if (leg < 0 || t - legT >= telegraph) {
              if (leg < 0) { leg = 0; legT = t; const tp = tgPos(P); dir.set(tp.x - from.x, 0, tp.z - from.z).normalize(); if (dir.lengthSq() < 0.1) dir.copy(fwdOf(b.yaw)); len = edgeLen(from, dir, RAM_R); inst.dec = S.fx.decal(from, 'line', { len, width: 6, yaw: Math.atan2(dir.x, dir.z), color: RED, dur: telegraph }); A.sfx('roar', { rate: 1.3, g: 0.7 }); return; }
              inst.phase = 'run'; legT = t; cur = 0; walkPh = 0; A.sfx('dash', { g: 2, rate: 0.4 });
            }
            b.yaw = Math.atan2(dir.x, dir.z);
            if (Math.random() < 0.5) S.fx.burst(b.pos.clone().addScaledVector(dir, -3).setY(0.3), { n: 2, color: 0x5a4a3a, kind: 'smoke', speed: 3, up: 0.5, life: 0.6, size: 1, size1: 2, world: true });
            return;
          }
          if (inst.phase === 'run') {
            cur = Math.min(len, cur + speed * dt * b.speed); b.pos.copy(from).addScaledVector(dir, cur); b.yaw = Math.atan2(dir.x, dir.z); walkPh += dt * 9;
            A.hurtCircle(b.pos.x + dir.x * 2.5 * BIG, b.pos.z + dir.z * 2.5 * BIG, 3.8 * (1 + (BIG - 1) * 0.5), dmg, { kb: 16, up: 7 }, inst, 'r' + leg);
            if (Math.random() < 0.7) S.fx.burst(b.pos.clone().setY(0.3), { n: 3, color: 0x5a4a3a, kind: 'smoke', speed: 5, up: 0.6, life: 0.9, size: 1.4, size1: 2.6, world: true });
            if (Math.floor(cur / 3) !== inst.st) { inst.st = Math.floor(cur / 3); A.sfx('stomp', { g: 0.6 }); A.shake(0.25); if (trailCrystals) { const q = b.pos.clone(); A.later(0.9, () => H.blast(b, null, null, q.x, q.z, 2.4, 0, b.glowCol, { quiet: true, shake: 0, noHurt: true })); S.fx.decal(q, 'circle', { r: 2.4, color: RED, dur: 0.9 }); const k = 'c' + leg + '_' + inst.st; A.later(0.9, () => A.hurtCircle(q.x, q.z, 2.4, 70, { up: 6 }, inst, k)); } }
            if (cur >= len) {
              H.blast(b, inst, 'w' + leg, b.pos.x + dir.x * 3 * BIG, b.pos.z + dir.z * 3 * BIG, 5, dmg * 0.7, b.glowCol, { g: 1, rate: 0.8, shake: 0.8, light: true, smoke: 0x5a4a3a });
              leg++; from = b.pos.clone();
              if (leg >= count) { inst.phase = 'daze'; legT = t; b.dazed = 1.8 + (count > 3 ? 1.2 : 0); A.sfx('roar', { rate: 0.6, g: 0.6 }); return; }
              inst.phase = 'aim'; legT = t;
              const tp = tgPos(P); dir.set(tp.x - from.x, 0, tp.z - from.z); if (dir.lengthSq() < 1) dir.set(-from.x, 0, -from.z); dir.normalize(); len = edgeLen(from, dir, RAM_R);
              inst.dec = S.fx.decal(from, 'line', { len, width: 6, yaw: Math.atan2(dir.x, dir.z), color: RED, dur: telegraph });
            }
            return;
          }
          if (inst.phase === 'daze' && t - legT > (count > 3 ? 2.8 : 1.6)) inst.dur = t;
        }, end() { }, cancel() { b.dazed = 0; } };
      return inst;
    }
    b.attacks.ram = (P) => { const sg = P.sg || 1; return ramInst(P, sg, 27, sg >= 3 ? 0.6 : 0.85, sg >= 3); };
    b.attacks.rampage = (P) => { A.voice(b.faces[0], 0.6, 1.3); BR.Arena.banner('DANGER TOTAL', 'Il ne s\'arrêtera plus… esquive au dernier moment !', 1.8, 'bad'); return ramInst(P, 5, 32, 0.65, true, 125); };
    // se cabre et écrase le sol : impact devant lui, ondes à sauter, chute de rochers
    b.attacks.stomp = (P) => {
      const sg = P.sg || 1, F = fwdOf(P.yw), c = new V3(P.x + F.x * 5 * BIG, 0, P.z + F.z * 5 * BIG), pts = P.pts || [];
      S.fx.decal(c, 'circle', { r: 7, color: RED, dur: 1.25 });
      A.sfx('roar', { rate: 0.9, g: 0.9 });
      const inst = { dur: 1.3 + 3 + 1.2, main: true, ownsMove: true,
        pose: t => { const up = ease(t / 1.0) * (1 - ease((t - 1.15) / 0.12)), down = ease((t - 1.2) / 0.1) * (1 - ease((t - 2.3) / 0.6)); return { pitch: -0.75 * up + 0.12 * down, neckX: -0.5 * up + 0.4 * down, jaw: 0.6 * up + 0.3, tailUp: 0.8 * up, bodyY: -0.5 * down }; },
        update(t) {
          if (t >= 1.25 && !inst.h) { inst.h = 1; H.blast(b, inst, 's', c.x, c.z, 7, 190, b.glowCol, { g: 1.1, rate: 0.8, shake: 1.0, light: true, smoke: 0x5a4a3a }); A.sfx('stomp'); }
          const nw = sg >= 3 ? 3 : 2; for (let i = 0; i < nw; i++) if (t >= 1.25 + i * 0.6 && !inst['w' + i]) { inst['w' + i] = 1; H.wave(b, c.x, c.z, { r0: 6, rMax: 38, dmg: 110, color: b.glowCol }); A.sfx('stomp', { g: 0.5 }); }
          pts.forEach((q, i) => { const t0 = 1.4 + i * 0.12; if (t >= t0 && !inst['d' + i]) { inst['d' + i] = 1; S.fx.decal({ x: q[0], z: q[1] }, 'circle', { r: 2.8, color: RED, dur: 1.1 }); } if (t >= t0 + 0.8 && t < t0 + 1.1) S.fx.spark(new V3(q[0], 20 * (1 - (t - t0 - 0.8) / 0.3), q[1]), new V3(0, -6, 0), { color: 0x8a7a64, kind: 'smoke', life: 0.12, size: 1.8, world: true }); if (t >= t0 + 1.1 && !inst['h' + i]) { inst['h' + i] = 1; H.blast(b, inst, 'p' + i, q[0], q[1], 2.8, 110, b.glowCol, { quiet: i % 3 !== 0, shake: 0, smoke: 0x5a4a3a }); } });
        } };
      return inst;
    };
    // coup de queue : balayage arrière (à sauter), aller-retour au stade 2
    b.attacks.tail = (P) => {
      const sg = P.sg || 1, back = P.yw + Math.PI, R = 12 * (1 + (BIG - 1) * 0.4), n = sg >= 2 ? 2 : 1;
      const p0 = new V3(P.x, 0, P.z);
      S.fx.decal(p0, 'sector', { r: R, arc: 3.6, yaw: back, color: RED, dur: 0.8, hold: n > 1 ? 0.9 : 0.1 });
      A.sfx('swingBig', { rate: 0.35, g: 1 });
      const inst = { dur: 0.8 + n * 0.75 + 0.4, main: true, ownsMove: true,
        pose: t => ({ tail: t < 0.8 ? -1.2 * ease(t / 0.8) : Math.sin((t - 0.8) / 0.75 * Math.PI - Math.PI / 2) * 1.6 * (Math.floor((t - 0.8) / 0.75) % 2 ? -1 : 1), tailUp: 0.3, pitch: 0.1 }),
        update(t) {
          for (let i = 0; i < n; i++) { const t0 = 0.8 + i * 0.75; if (t >= t0 && t < t0 + 0.35) { if (!inst['s' + i]) { inst['s' + i] = 1; S.fx.slash(p0.clone().setY(1.0), back, { r: R, arc: 3.6, color: b.glowCol, life: 0.35, inner: 0.7, flip: i % 2 === 1, world: true }); A.sfx('swingBig', { rate: 0.3, g: 1.4 }); A.shake(0.4); } A.hurtSector(p0.x, p0.z, back, R, 3.6, 140, { air: true, kb: 14, up: 5, h: 2.5 }, inst, 't' + i); } }
        } };
      return inst;
    };
    // épines : les cristaux du dos jaillissent, se plantent dans le sol puis explosent (attaque retardée)
    b.attacks.spines = (P) => {
      const pts = P.pts || [], sg = P.sg || 1;
      A.sfx('roar', { rate: 1.2, g: 0.6 }); A.sfx('ice', { g: 1 });
      const inst = { dur: 0.7 + pts.length * 0.08 + 2.4, main: true,
        pose: t => ({ pitch: 0.15 * ease(t / 0.5), bodyY: -0.4 * ease(t / 0.5), neckX: 0.4 }),
        update(t) {
          pts.forEach((q, i) => {
            const t0 = 0.6 + i * 0.08, from = b.focus();
            if (t >= t0 && !inst['f' + i]) { inst['f' + i] = 1; const T = 0.7; const qq = new V3(q[0], 0, q[1]); S.fx.decal(qq, 'circle', { r: 2.6, color: RED, dur: T + (sg >= 2 ? 1.0 : 1.3), hold: 0.1 });
              A.eproj({ pos: from.clone().setY(from.y + 2), vel: new V3((q[0] - from.x) / T, (0 - from.y - 2) / T + 0.5 * 26 * T, (q[1] - from.z) / T), grav: 26, r: 0.6, dmg: 60, color: b.glowCol.getHex(), life: T + 0.3,
                onEnd: () => { const m = new THREE.Mesh(S.fx.geo.box, new THREE.MeshBasicMaterial({ color: b.glowCol.clone().multiplyScalar(1.6), transparent: true, opacity: 0.9 })); m.scale.set(0.5, 2.0, 0.5); m.position.set(q[0], 0.9, q[1]); m.rotation.set(0.3, i, 0.2); S.fx.add(m, sg >= 2 ? 1.0 : 1.3, (k, o2) => { o2.material.opacity = 0.5 + 0.5 * Math.sin(k * 40); }, true); } }); }
            const th = t0 + 0.7 + (sg >= 2 ? 1.0 : 1.3);
            if (t >= th && !inst['h' + i]) { inst['h' + i] = 1; H.blast(b, inst, 'x' + i, q[0], q[1], 2.6, 110, b.glowCol, { quiet: i % 3 !== 0, shake: i % 3 ? 0 : 0.2, smoke: 0x5a4a3a }); }
          });
        } };
      return inst;
    };
    // rugissement : souffle en cône qui repousse fort (puis enchaîne une ruée)
    b.attacks.roar = (P) => {
      const yaw = Math.atan2(P.tx - P.x, P.tz - P.z), p0 = new V3(P.x, 0, P.z);
      S.fx.decal(p0, 'sector', { r: 16, arc: 1.3, yaw, color: RED, dur: 0.6 });
      const inst = { dur: 1.4, main: true, ownsMove: true,
        pose: t => ({ neckX: -0.4 * ease(t / 0.5), jaw: 0.9 * ease(t / 0.5), pitch: -0.15 * ease(t / 0.5) }),
        update(t) {
          b.yaw = yaw;
          if (t >= 0.6 && !inst.r) { inst.r = 1; A.voice(b.faces[0], 0.7, 1.1); A.sfx('roar', { g: 1.4, rate: 0.7 }); A.shake(0.6); for (let i = 0; i < 40; i++) { const a = yaw + (Math.random() - 0.5) * 1.3; S.fx.spark(b.partPos(HEAD), new V3(Math.sin(a) * 26, rnd(Math.random, -1, 3), Math.cos(a) * 26), { color: 0xffe0a0, life: 0.5, size: 0.8, drag: 2, world: true, alpha: 0.5 }); } }
          if (t >= 0.6 && t < 0.9) A.hurtSector(P.x, P.z, yaw, 16, 1.3, 40, { kb: 22, up: 4 }, inst, 'r');
        } };
      return inst;
    };
    // lignes de cristal en étoile (stade 2+) : 6 lignes, puis 6 autres décalées
    b.attacks.quakeline = (P) => {
      const a0 = P.a || 0, p0 = new V3(P.x, 0, P.z), sets = [0, 1];
      const inst = { dur: 3.6, main: true, ownsMove: true,
        pose: t => { const up = ease(t / 0.6) * (1 - ease((t - 0.7) / 0.1)); return { pitch: -0.5 * up + 0.1, tailUp: up * 0.5, bodyY: t > 0.75 ? -0.4 : 0 }; },
        update(t) {
          sets.forEach(si => {
            const td = 0.2 + si * 0.7, th = td + 1.0;
            for (let k = 0; k < 6; k++) {
              const a = a0 + k / 6 * Math.PI * 2 + si * Math.PI / 6;
              if (t >= td && !inst['d' + si + k]) { inst['d' + si + k] = 1; S.fx.decal(p0, 'line', { len: 30, width: 3, yaw: a, color: RED, dur: th - td }); }
              if (t >= th && !inst['h' + si + k]) { inst['h' + si + k] = 1; const n = 12; for (let i = 0; i < n; i++) { const q = p0.clone().addScaledVector(fwdOf(a), 3 + i * 2.3); if (Math.hypot(q.x, q.z) > 34) break; A.later(i * 0.03, () => { const m = new THREE.Mesh(S.fx.geo.cone, new THREE.MeshBasicMaterial({ color: b.glowCol.clone().multiplyScalar(1.8), transparent: true, opacity: 0.9, side: THREE.DoubleSide })); m.scale.set(0.7, 0.01, 0.7); m.position.copy(q); m.position.y = 1.3; S.fx.add(m, 0.8, (kk, o2) => { o2.scale.y = 2.6 * Math.sin(Math.min(1, kk * 3) * Math.PI / 2) * (1 - Math.max(0, kk - 0.6) / 0.4); }, true); S.fx.burst(q.clone().setY(0.3), { n: 4, color: b.glowCol, speed: 6, up: 2, life: 0.4, world: true }); }); }
                A.hurtLine(p0.x, p0.z, a, 30, 3, 130, { up: 9, kb: 4 }, inst, 'q' + si + k); if (k === 0) { A.sfx('ice', { g: 0.8 }); A.sfx('boom', { g: 0.5, rate: 1.2 }); A.shake(0.4); } }
            }
          });
        } };
      return inst;
    };
    return b;
  }

  AB.register('knight', knight);
  AB.register('beast', beast);
})();

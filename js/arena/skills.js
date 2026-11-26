/* ===== arena/skills.js : effets et logique des compétences et ultimes =====
   Chaque sort reçoit un contexte (moteur) ; ctx.auth = ce client applique les dégâts (sinon : visuel seul). */
(function () {
  const BR = window.BR, V3 = THREE.Vector3;
  const SK = (BR.ASkills = {});
  const UP = new V3(0, 1, 0);
  const col = c => new THREE.Color(c);
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------------- briques visuelles ---------------- */
  // gros impact : éclair de lumière, ondes, gerbes, poussière, son, tremblement
  function impact(ctx, p, c, k, o) {
    o = o || {}; k = k || 1;
    const g = new V3(p.x, 0.05, p.z);
    ctx.fx.flash(p, { color: c, r: 1.6 * k, life: 0.3, intensity: 6 * k, bright: 3 });
    ctx.fx.flash(p, { color: 0xffffff, r: 0.9 * k, life: 0.14, light: false, bright: 4 });
    ctx.fx.ring(g, { r0: 0.3, r1: 6 * k, color: c, life: 0.45, width: 0.22 });
    ctx.fx.ring(g, { r0: 0.2, r1: 3.5 * k, color: 0xffffff, life: 0.3, width: 0.35 });
    ctx.fx.burst(p, { n: Math.round(50 * k), color: c, speed: 16 * Math.sqrt(k), life: 0.6, size: 0.4, grav: 10, up: 0.2 });
    ctx.fx.burst(g, { n: Math.round(18 * k), color: 0x3a3430, kind: 'smoke', speed: 6 * k, up: 0.4, life: 1.1, size: 1.4 * k, size1: 3 * k, grav: -0.6, drag: 2.2, alpha: 0.7 });
    if (o.debris !== false) ctx.fx.burst(g, { n: Math.round(16 * k), color: 0x6a5e54, kind: 'smoke', speed: 12 * Math.sqrt(k), up: 1.1, life: 1.0, size: 0.35, size1: 0.3, grav: 22, drag: 0.3, alpha: 1 });
    if (o.pillar) ctx.fx.pillar(g, { color: c, r: 1.2 * k, h: 18 * k, life: 0.6 });
    ctx.sfx('boom', { len: 0.6 + 0.4 * k, g: Math.min(1.3, 0.5 + 0.3 * k) });
    ctx.shake(0.25 + 0.25 * k);
  }
  function strike(ctx, from, to, c, o) {
    o = o || {};
    ctx.fx.bolt(from, to, { color: c, life: 0.22, jitter: 1.2, segs: 14 });
    ctx.fx.bolt(from, to, { color: 0xffffff, life: 0.12, jitter: 0.6, segs: 10, light: false });
    ctx.fx.flash(to, { color: c, r: o.r || 0.9, life: 0.18, intensity: 4 });
    ctx.fx.burst(to, { n: 18, color: c, speed: 10, life: 0.35 });
    ctx.sfx('zap', { g: o.g || 0.8 });
  }
  // épée de lumière (géante ou spectrale)
  const swordGeoCache = {};
  function swordMesh(color, len, glow) {
    const k = len.toFixed(1);
    let geo = swordGeoCache[k];
    if (!geo) {
      const parts = [];
      const blade = new THREE.CylinderGeometry(0.02 * len, 0.075 * len, len * 0.78, 4, 1); blade.rotateY(Math.PI / 4); blade.scale(1, 1, 0.25); blade.translate(0, -len * 0.39, 0);
      const tip = new THREE.ConeGeometry(0.02 * len * 1.42, len * 0.1, 4); tip.rotateY(Math.PI / 4); tip.scale(1, 1, 0.25); tip.rotateX(Math.PI); tip.translate(0, -len * 0.83, 0);
      const guard = new THREE.BoxGeometry(len * 0.32, len * 0.035, len * 0.06);
      const grip = new THREE.CylinderGeometry(len * 0.022, len * 0.022, len * 0.16, 6); grip.translate(0, len * 0.095, 0);
      const pommel = new THREE.OctahedronGeometry(len * 0.04); pommel.translate(0, len * 0.19, 0);
      parts.push(blade, tip, guard, grip, pommel);
      geo = mergeGeos(parts); geo.userData.keep = true; swordGeoCache[k] = geo;
    }
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: col(color), emissiveIntensity: glow || 2.2, roughness: 0.3, metalness: 0.6, transparent: true }));
    return m;
  }
  function mergeGeos(list) {
    const pos = [], nrm = [];
    for (let g of list) { g = g.index ? g.toNonIndexed() : g; pos.push(...g.attributes.position.array); nrm.push(...g.attributes.normal.array); }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); return out;
  }
  // coque de lumière (bouclier, dôme) : effet de bord (fresnel)
  function shellMat(color, power, alpha) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: col(color) }, uA: { value: alpha == null ? 1 : alpha }, uP: { value: power || 2.5 }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vN, vV; varying vec3 vW; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); vW = position; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform vec3 uColor; uniform float uA, uP, uTime; varying vec3 vN, vV, vW;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uP);
          float hex = abs(sin(vW.x * 3.0 + uTime * 2.0) * sin(vW.y * 3.0 - uTime) * sin(vW.z * 3.0)); float lines = smoothstep(0.92, 1.0, hex);
          float a = (f * 0.9 + lines * 0.25 + 0.04) * uA; gl_FragColor = vec4(uColor * 2.0, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
  }
  function afterimage(ctx, f, c) { for (let i = 0; i < 10; i++) ctx.fx.spark(f.center().add(new V3(rnd(-0.3, 0.3), rnd(-0.9, 0.9), rnd(-0.3, 0.3))), new V3(0, rnd(0, 1), 0), { color: c, life: 0.45, size: 0.6, size1: 0.1 }); }
  const atkAnim = f => ({ blade: '1H_Melee_Attack_Stab', greatsword: '2H_Melee_Attack_Stab', daggers: 'Dualwield_Melee_Attack_Stab', staff: 'Spellcast_Shoot' })[f.weaponId] || '1H_Melee_Attack_Stab';
  const slashAnim = f => ({ blade: '1H_Melee_Attack_Slice_Horizontal', greatsword: '2H_Melee_Attack_Slice', daggers: 'Dualwield_Melee_Attack_Slice', staff: 'Spellcast_Long' })[f.weaponId] || '1H_Melee_Attack_Slice_Horizontal';

  /* =====================================================================
     COMMUNES
     ===================================================================== */
  SK.fente = { ai: 'gap', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color;
    const dash = (delay) => ctx.later(delay, () => {
      const yaw = ctx.face(), d = ctx.dirToAim(), start = f.pos.clone();
      f.inv = Math.max(f.inv, 0.4);
      ctx.anim(atkAnim(f), 1.9, { fade: 0.03 }); ctx.sfx('dash'); ctx.sfx('swingBig');
      ctx.act({ dur: 0.28, vel: d.clone().multiplyScalar(34), face: yaw, float: true, update: () => afterimage(ctx, f, c), onEnd: () => {
        const end = f.pos.clone();
        fx.slash(start.clone().lerp(end, 0.5).setY(1.1), yaw + Math.PI / 2, { r: start.distanceTo(end) * 0.6 + 1, arc: 1.2, tilt: 0, color: c, life: 0.35, inner: 0.85 });
        fx.burst(end.clone().setY(1), { n: 30, color: c, speed: 10, life: 0.4 });
        const h = ctx.hitLine(start.clone().setY(1), end.clone().setY(1), 1.6, ctx.dmg(160), { kb: 3, posture: 1.5 });
        if (h.length) { ctx.hitstop(0.08); ctx.shake(0.3); }
        if (ctx.lv >= 3) ctx.later(0.35, () => { fx.bolt(start.clone().setY(1), end.clone().setY(1), { color: c, life: 0.3 }); ctx.sfx('zap'); ctx.hitLine(start.clone().setY(1), end.clone().setY(1), 1.6, ctx.dmg(80), {}); });
      } });
    });
    dash(0); if (ctx.lv >= 5) dash(0.42);
  } };

  SK.onde = { ai: 'close', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, r = ctx.lv >= 3 ? 8.4 : 6;
    ctx.anim(f.weaponId === 'greatsword' ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Chop', 1.5);
    ctx.act({ dur: 0.5 });
    const wave = (i) => ctx.later(0.28 + i * 0.28, () => {
      const p = f.pos.clone(), rr = r + i * 3;
      impact(ctx, p.clone().setY(0.4), c, 1 + i * 0.3, {});
      fx.ring(p, { r0: 0.5, r1: rr, color: c, life: 0.5, width: 0.4 });
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; fx.spark(p.clone().setY(0.2), new V3(Math.sin(a) * rr * 2, 6, Math.cos(a) * rr * 2), { color: 0x7a6a5a, kind: 'smoke', life: 0.5, size: 0.6, grav: 20 }); }
      ctx.hitSphere(p.clone().setY(1), rr, ctx.dmg(220), { launch: 8, posture: 3, kb: 5 });
    });
    wave(0); if (ctx.lv >= 5) { wave(1); wave(2); }
  } };

  SK.tourbillon = { ai: 'close', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, n = ctx.lv >= 5 ? 10 : 6, dur = ctx.lv >= 5 ? 2.0 : 1.4;
    ctx.act({ dur, lockMove: false, update: (t) => { f.yaw += 0.6; } });
    const snd = BR.Audio.loopFx('wind'); ctx.later(dur, () => snd.stop());
    ctx.every(dur, dur / n, (i) => {
      ctx.anim('2H_Melee_Attack_Spinning', 2.2, { fade: 0.02 });
      const p = f.pos.clone().setY(1.0);
      fx.slash(p, f.yaw, { r: 3.4, arc: 6.2, tilt: 0.15 * (i % 2 ? 1 : -1), color: c, life: 0.22, inner: 0.6 });
      fx.burst(p, { n: 8, color: c, speed: 9, life: 0.3, flat: true });
      ctx.sfx('swing', { rate: 1.2 });
      ctx.hitSphere(p, 3.4, ctx.dmg(70), { kb: 1 });
      if (ctx.lv >= 5 && i === n - 1) ctx.later(0.15, () => { impact(ctx, p, c, 1.3); ctx.hitSphere(p, 5, ctx.dmg(300), { launch: 6 }); });
    });
  } };

  SK.traits = { ai: 'mid', cast(ctx) {
    const { f } = ctx, n = ctx.lv >= 3 ? 5 : 3;
    ctx.anim('Spellcast_Shoot', 1.8); ctx.act({ dur: 0.3, face: ctx.face() });
    for (let i = 0; i < n; i++) ctx.later(i * 0.07, () => {
      const from = f.center().add(new V3(0, 0.4, 0)), a = (i - (n - 1) / 2) * 0.45;
      const v = ctx.dirToAim().applyAxisAngle(UP, a).multiplyScalar(18).add(new V3(0, 6, 0));
      ctx.sfx('magic', { rate: 1 + i * 0.1 });
      ctx.proj({ pos: from, vel: v, r: 0.45, dmg: ctx.dmg(90), life: 2.2, size: 0.8, homing: 6, onHit: () => { if (ctx.lv >= 5) f.energy = Math.min(100, f.energy + 3); } });
    });
  } };

  SK.bond = { ai: 'gap', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, start = f.pos.clone(), end = ctx.clampAim(16), yaw = ctx.face();
    if (ctx.lv >= 5) { f.inv = Math.max(f.inv, 0.8); }
    ctx.anim('Jump_Full_Long', 1.4); ctx.sfx('jump'); ctx.sfx('swingBig', { rate: 0.6 });
    const D = 0.62;
    ctx.act({ dur: D, face: yaw, float: true, vel: new V3(), update: (t) => {
      const k = Math.min(1, t / D); f.pos.x = start.x + (end.x - start.x) * k; f.pos.z = start.z + (end.z - start.z) * k; f.pos.y = Math.sin(k * Math.PI) * 6; f.vel.y = 0;
      afterimage(ctx, f, c);
    }, onEnd: () => {
      f.pos.y = 0; ctx.anim(f.weaponId === 'greatsword' ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Chop', 2.2);
      impact(ctx, end.clone().setY(0.5), c, 1.5, { pillar: true });
      ctx.hitstop(0.1);
      ctx.hitSphere(end.clone().setY(1), 4.5, ctx.dmg(260), { launch: 9, posture: 3, kb: 6 });
      if (ctx.lv >= 3) ctx.zone({ pos: end, life: 3, iv: 0.5, onTick: z => { ctx.hitSphere(z.pos.clone().setY(0.8), 4, ctx.dmg(30), {}); for (let k = 0; k < 6; k++) fx.spark(z.pos.clone().add(new V3(rnd(-3.5, 3.5), 0.1, rnd(-3.5, 3.5))), new V3(0, rnd(2, 5), 0), { color: 0xff7a2a, life: 0.6, size: 0.6, size1: 0.05 }); } });
      if (ctx.lv >= 5) for (const k in f.cds) f.cds[k] = Math.max(0, f.cds[k] - 1);
    } });
  } };

  SK.garde = { ai: 'self', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color;
    f.shield = ctx.lv >= 3 ? 700 : 400; f.shieldStore = 0;
    ctx.anim('Block', 1.4); ctx.sfx('magic', { rate: 0.5 });
    const mat = shellMat(c, 2.2, 1), m = new THREE.Mesh(new THREE.SphereGeometry(1.25, 28, 18), mat); m.geometry.userData.own = true;
    let last = 0;
    f.onShieldHit = (src) => { if (ctx.S.t - last < 0.25) return; last = ctx.S.t; const t = ctx.nearest(f.pos, 18); if (t) { strike(ctx, f.center(), t.pos, c, { g: 0.6 }); ctx.hitTarget(t, ctx.dmg(120), {}); } };
    fx.add(m, 2.5, (k, o, dt, t) => { o.position.copy(f.center()); mat.uniforms.uTime.value = t; mat.uniforms.uA.value = (f.shield > 0 ? 1 : 0.2) * (k > 0.85 ? (1 - k) / 0.15 : 1); }, false, () => {
      const stored = f.shieldStore || 0; f.shield = 0; f.onShieldHit = null;
      if (ctx.lv >= 5 && stored > 0) { impact(ctx, f.center(), c, 1.2); ctx.hitSphere(f.center(), 5, stored * 2, { raw: true }); }
    });
  } };

  /* =====================================================================
     RARES
     ===================================================================== */
  SK.chaine = { ai: 'mid', cast(ctx) {
    const { f } = ctx, c = ctx.color, n = ctx.lv >= 3 ? 7 : 4;
    ctx.anim('Spellcast_Shoot', 1.6); ctx.act({ dur: 0.35, face: ctx.face() });
    let from = f.tip(0), prev = null;
    const first = ctx.lockTarget(); if (!first) { strike(ctx, from, ctx.aim, c); return; }
    let cur = first;
    for (let i = 0; i <= n; i++) {
      const tgt = cur, a = from.clone();
      ctx.later(0.04 + i * 0.09, () => {
        const p = tgt.pos.clone().add(new V3(rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-0.3, 0.3)));
        strike(ctx, a, p, c, { g: 0.6 });
        ctx.hitTarget(tgt, ctx.dmg(240) * (ctx.lv >= 5 ? Math.pow(1.15, i) : 1) * (i ? 0.7 : 1), { stun: ctx.lv >= 5 ? 0.3 : 0 });
      });
      from = tgt.pos.clone(); prev = tgt;
      const others = ctx.enemies().filter(t => !(t.kind === prev.kind && t.i === prev.i && t.f === prev.f));
      cur = others.length ? others.sort((x, y) => x.pos.distanceTo(from) - y.pos.distanceTo(from))[0] : prev;
    }
  } };

  SK.lance = { ai: 'mid', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, n = ctx.lv >= 5 ? 3 : 1;
    ctx.anim(f.weaponId === 'staff' ? 'Spellcast_Shoot' : 'Throw', 1.5); ctx.act({ dur: 0.35, face: ctx.face() });
    ctx.later(0.12, () => {
      for (let i = 0; i < n; i++) {
        const from = f.center().add(new V3(0, 0.5, 0)), dir = ctx.aim.clone().setY(Math.max(1, ctx.aim.y)).sub(from).normalize().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.22);
        const g = new THREE.ConeGeometry(0.22, 2.6, 6); g.rotateX(Math.PI / 2); g.userData.own = true;
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xdff8ff, emissive: col(c), emissiveIntensity: 2.4, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.92 }));
        ctx.sfx('ice');
        ctx.proj({ pos: from, vel: dir.multiplyScalar(44), r: 0.55, dmg: ctx.dmg(340), life: 1.2, pierce: true, mesh, freeze: 1, posture: 1.5,
          onHit: (p) => { fx.burst(p.pos, { n: 26, color: 0xcff6ff, speed: 10, life: 0.5, size: 0.35, grav: 12 }); if (ctx.lv >= 3) { fx.flash(p.pos, { color: c, r: 1.6, life: 0.2 }); ctx.hitSphere(p.pos, 2.8, ctx.dmg(120), {}); } } });
      }
    });
  } };

  SK.ombre = { ai: 'gap', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color;
    const hop = (delay, n) => ctx.later(delay, () => {
      const t = ctx.lockTarget(); if (!t) return;
      const before = f.center();
      fx.burst(before, { n: 30, color: 0x2a1040, kind: 'smoke', speed: 4, life: 0.8, size: 1, size1: 1.8, grav: -1 });
      fx.burst(before, { n: 20, color: c, speed: 8, life: 0.4 });
      const away = f.pos.clone().sub(t.pos).setY(0).normalize();
      const dst = t.pos.clone().addScaledVector(away, -(t.r + 1.3)); dst.y = 0;
      f.pos.copy(dst); ctx.confine();
      f.yaw = Math.atan2(t.pos.x - f.pos.x, t.pos.z - f.pos.z);
      fx.burst(f.center(), { n: 30, color: 0x2a1040, kind: 'smoke', speed: 4, life: 0.8, size: 1, size1: 1.8, grav: -1 });
      ctx.anim(atkAnim(f), 2.0); ctx.act({ dur: 0.3, face: f.yaw });
      ctx.later(0.1, () => {
        const p = t.pos.clone();
        fx.slash(p, f.yaw, { r: 2.6, arc: 2.2, tilt: 0.8, color: c, life: 0.25 }); fx.slash(p, f.yaw, { r: 2.6, arc: 2.2, tilt: -0.8, color: c, life: 0.25, flip: true });
        fx.flash(p, { color: c, r: 1.2, life: 0.2 }); ctx.sfx('crit'); ctx.hitstop(0.1); ctx.shake(0.3);
        ctx.hitTarget(t, ctx.dmg(380), { crit: true, posture: 2 });
      });
      if (n === 0 && ctx.lv >= 3) { const img = ctx.fighter({ id: 'leurre', look: f.av.look, kind: 'summon', ghost: '#7a40ff' }); img.pos.copy(before).setY(0); img.yaw = f.yaw; img.play('Idle'); ctx.later(2, () => { fx.burst(img.center(), { n: 20, color: c, speed: 5, life: 0.5 }); img.dispose(); }); }
    });
    hop(0, 0); if (ctx.lv >= 5) hop(0.5, 1);
  } };

  SK.tornade = { ai: 'mid', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, n = ctx.lv >= 5 ? 2 : 1;
    ctx.anim('Spellcast_Long', 1.8); ctx.act({ dur: 0.4, face: ctx.face() });
    for (let i = 0; i < n; i++) {
      const dir = ctx.dirToAim().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.4), grp = new THREE.Group();
      const mats = [];
      for (let k = 0; k < 5; k++) { const m = shellMat(c, 1.5, 0.5); mats.push(m); const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + k * 0.45, 0.3 + k * 0.4, 1.6, 16, 1, true), m); cone.geometry.userData.own = true; cone.position.y = 0.8 + k * 1.3; grp.add(cone); }
      const pos = f.pos.clone().addScaledVector(dir, 2); grp.position.copy(pos);
      const snd = BR.Audio.loopFx('wind');
      ctx.fx.add(grp, 3, (k, o, dt, t) => {
        const tg = ctx.lv >= 3 ? ctx.nearest(o.position, 25) : null;
        if (tg) { const d = tg.pos.clone().setY(0).sub(o.position).setY(0); if (d.length() > 0.5) o.position.addScaledVector(d.normalize(), dt * 7); } else o.position.addScaledVector(dir, dt * 6);
        o.children.forEach((ch, j) => { ch.rotation.y += dt * (8 + j * 2); ch.position.x = Math.sin(t * 6 + j) * 0.15 * j; });
        mats.forEach(m => { m.uniforms.uTime.value = t; m.uniforms.uA.value = 0.55 * Math.min(1, t * 4, (3 - t) * 3); });
        for (let s = 0; s < 3; s++) { const a = Math.random() * 6.283, r = rnd(0.5, 2.6), y = rnd(0, 6); fx.spark(o.position.clone().add(new V3(Math.cos(a) * r, y, Math.sin(a) * r)), new V3(-Math.sin(a) * 8, 3, Math.cos(a) * 8), { color: c, life: 0.4, size: 0.3 }); }
      }, false, () => snd.stop());
      ctx.every(3, 0.25, () => ctx.hitSphere(grp.position.clone().setY(2), 2.6, ctx.dmg(60), { kb: -2 }));
    }
  } };

  SK.soin = { ai: 'heal', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, p = f.pos.clone(), pct = ctx.lv >= 3 ? 0.45 : 0.3;
    ctx.anim('Spellcast_Raise', 1.4); ctx.act({ dur: 0.5 }); ctx.sfx('heal');
    fx.pillar(p, { color: c, r: 5, h: 10, life: 0.8, grow: 0.1, alpha: 0.5 });
    const ring = fx.decal(p, 'ring', { r: 5, inner: 0.88, color: c, dur: 0.3, hold: 4.7, world: false });
    ctx.zone({ pos: p, life: 5, iv: 0.5, onTick: z => {
      for (const a of ctx.allies()) if (a.pos.distanceTo(z.pos) < 5.4) { ctx.heal(a, a.maxHp * pct / 10); a.buff.sanct = 1; a.buff.sanctT = 0.6; }
      if (ctx.lv >= 5) for (const a of ctx.S.fighters.values()) if (a.team === f.team && !a.alive && a.pos.distanceTo(z.pos) < 5.4 && a.kind === 'local') { a.alive = true; a.down = false; a.hp = a.maxHp * 0.5; a.play('Lie_StandUp', 1.5); }
      for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283, r = Math.random() * 5; fx.spark(z.pos.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new V3(0, rnd(2, 5), 0), { color: c, life: 0.9, size: 0.45, size1: 0.05 }); }
    } });
    void ring;
  } };

  SK.pluie = { ai: 'mid', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, center = ctx.clampAim(18), n = ctx.lv >= 3 ? 24 : 14;
    ctx.anim('Spellcast_Raise', 1.6); ctx.act({ dur: 0.4, face: ctx.face() }); ctx.sfx('magic', { rate: 0.7 });
    fx.decal(center, 'circle', { r: 4.5, color: c, dur: 0.5, hold: 1.4, world: false });
    for (let i = 0; i < n; i++) ctx.later(0.3 + i * (1.2 / n), () => {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 4.2, p = center.clone().add(new V3(Math.cos(a) * r, 0, Math.sin(a) * r));
      const s = swordMesh(c, 2.6, 2.6); s.rotation.set(rnd(-0.15, 0.15), Math.random() * 6, rnd(-0.15, 0.15)); s.position.set(p.x, 16, p.z);
      fx.add(s, ctx.lv >= 5 ? 1.6 : 0.6, (k, o, dt, t) => {
        if (t < 0.18) o.position.y = 16 - (t / 0.18) * (16 - 2.1);
        else { o.position.y = 2.1; if (!o.userData.hit) { o.userData.hit = true; fx.burst(p.clone().setY(0.2), { n: 12, color: c, speed: 8, life: 0.35, up: 0.5 }); fx.ring(p, { r1: 1.8, color: c, life: 0.25 }); ctx.sfx('hit', { g: 0.4, rate: 1.5 }); ctx.hitSphere(p.clone().setY(1), 1.8, ctx.dmg(55), {}); } }
        o.material.opacity = Math.min(1, (1 - k) * 4);
      }, false, () => { if (ctx.lv >= 5) { fx.flash(p.clone().setY(1), { color: c, r: 1.4, life: 0.2 }); ctx.hitSphere(p.clone().setY(1), 2.2, ctx.dmg(45), {}); } });
    });
  } };

  /* =====================================================================
     ÉPIQUES
     ===================================================================== */
  SK.fantomes = { ai: 'self', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, n = ctx.lv >= 3 ? 10 : 6, dur = 8;
    ctx.anim('Spellcast_Raise', 1.6); ctx.sfx('magic', { rate: 0.8 });
    const blades = [];
    for (let i = 0; i < n; i++) { const s = swordMesh(c, 1.2, 2.4); blades.push({ m: s, ready: true, t: 0 }); }
    const grp = new THREE.Group(); blades.forEach(b => grp.add(b.m));
    let fireT = 0;
    fx.add(grp, dur, (k, o, dt, t) => {
      o.position.copy(f.pos).setY(f.pos.y + 1.6);
      blades.forEach((b, i) => { const a = t * 2.4 + i / n * 6.283; b.m.position.set(Math.cos(a) * 1.6, Math.sin(t * 3 + i) * 0.25, Math.sin(a) * 1.6); b.m.rotation.set(Math.PI / 2, 0, -a); b.m.visible = b.ready; if (!b.ready) { b.t -= dt; if (b.t <= 0) b.ready = true; } });
      fireT -= dt;
      if (fireT <= 0 && f.attacking && f.attacking()) {
        const t2 = ctx.nearest(f.pos, 16), b = blades.find(x => x.ready);
        if (t2 && b) {
          b.ready = false; b.t = 0.9; fireT = 0.16;
          const from = b.m.getWorldPosition(new V3());
          const s = swordMesh(c, 1.2, 3); const dir = t2.pos.clone().sub(from).normalize();
          ctx.proj({ pos: from, vel: dir.multiplyScalar(36), r: 0.5, dmg: ctx.dmg(85), life: 1, mesh: s, homing: 10, onUpdate: p => { s.lookAt(p.pos.clone().add(p.vel)); s.rotateX(Math.PI / 2); },
            onHit: (p) => { if (ctx.lv >= 5) ctx.later(0.25, () => { fx.slash(p.pos, Math.random() * 6, { r: 1.6, arc: 2, color: c, life: 0.2 }); ctx.hitTarget(t2, ctx.dmg(60), {}); }); } });
          ctx.sfx('swing', { rate: 1.5, g: 0.5 });
        }
      }
    });
  } };

  SK.clone = { ai: 'self', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, n = ctx.lv >= 5 ? 2 : 1, mul = ctx.lv >= 3 ? 0.9 : 0.6;
    ctx.anim('Spellcast_Raise', 1.6); ctx.sfx('magic', { rate: 0.6 });
    for (let i = 0; i < n; i++) {
      const cl = ctx.fighter({ id: 'clone' + i, look: f.av.look, kind: 'summon', weapon: f.weaponId, ghost: c });
      cl.owner = f; cl.summonMul = mul; cl.team = f.team; cl.isClone = true; cl.kit = f.kit; cl.lv = f.lv; cl.ctl = { aim: ctx.aim.clone(), move: new V3() };
      const side = i === 0 ? 1 : -1;
      cl.pos.copy(f.pos).add(new V3(side * 1.6, 0, 0)); cl.yaw = f.yaw;
      fx.burst(cl.center(), { n: 40, color: c, speed: 8, life: 0.5 });
      let life = 7, lastAct = null;
      const S = ctx.S;
      const sum = {
        team: f.team, isClone: true, owner: f, f: cl,
        mimicSkill(id, lv, aim) { const impl = SK[id]; if (!impl || id === 'clone') return; cl.ctl.aim = aim.clone(); try { impl.cast(BR.Arena.api(cl, ctx.auth, lv, aim, id)); } catch (e) {} },
        update(dt) {
          life -= dt; if (life <= 0 || !f.alive) return false;
          // suit le joueur sur le côté, copie ses attaques
          const R = new V3(Math.cos(f.yaw), 0, -Math.sin(f.yaw)).multiplyScalar(side * 1.7);
          const want = f.pos.clone().add(R);
          if (!cl.action) { cl.pos.lerp(want, Math.min(1, dt * 8)); cl.yaw = f.yaw; }
          else { cl.action.t += dt; if (cl.action.vel) cl.pos.addScaledVector(cl.action.vel, dt); if (cl.action.update) cl.action.update(cl.action.t, dt); if (cl.action.face != null) cl.yaw = cl.action.face; if (cl.action.t >= cl.action.dur) { const e = cl.action.onEnd; cl.action = null; if (e) e(); } }
          cl.pos.y = Math.max(0, cl.pos.y);
          const A = f.action;
          if (A && A !== lastAct && A.type === 'attack') {
            lastAct = A; const st = A.step; cl.play(st.a, st.sp); cl.yaw = A.face;
            ctx.later(st.hit || 0.2, () => {
              fx.slash(cl.center(), cl.yaw, { r: (st.range || 3), arc: Math.min(st.arc || 120, 220) * Math.PI / 180, tilt: (st.slash || [0])[0], color: c, life: 0.24 });
              if (ctx.auth) BR.Arena.api(cl, true, 1, ctx.aim, 'clone').hitCone(cl.pos, cl.yaw, st.range || 3, (st.arc || 120) * Math.PI / 180, st.dmg || 60, { kind: 'basic' });
            });
          } else if (!A) lastAct = null;
          cl.update(dt, { speed: cl.action ? 0 : f.vel.length() });
          return true;
        },
        dispose() { fx.burst(cl.center(), { n: 30, color: c, speed: 6, life: 0.5 }); cl.dispose(); },
      };
      ctx.summon(sum);
      void S;
    }
  } };

  SK.gravite = { ai: 'mid', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, p = ctx.clampAim(14).setY(1.6);
    ctx.anim('Spellcast_Long', 1.6); ctx.act({ dur: 0.5, face: ctx.face() }); ctx.sfx('charge', { len: 0.6 });
    const grp = new THREE.Group(); grp.position.copy(p);
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: 0x000000 })); core.geometry.userData.own = true; grp.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 20), shellMat(c, 1.6, 1)); halo.geometry.userData.own = true; grp.add(halo);
    const disk = new THREE.Mesh(new THREE.RingGeometry(1.3, 3.6, 64, 1), new THREE.MeshBasicMaterial({ color: col(c).multiplyScalar(2.2), transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); disk.geometry.userData.own = true; disk.rotation.x = -Math.PI / 2 + 0.35; grp.add(disk);
    const snd = BR.Audio.loopFx('beam'); snd.set(0.5);
    fx.add(grp, 4, (k, o, dt, t) => {
      const s = Math.min(1, t * 3) * (1 + Math.sin(t * 20) * 0.04); core.scale.setScalar(s); halo.scale.setScalar(s); disk.rotation.z += dt * 4; disk.scale.setScalar(s);
      halo.material.uniforms.uTime.value = t;
      for (let j = 0; j < 6; j++) { const a = Math.random() * 6.283, r = rnd(4, 7), q = p.clone().add(new V3(Math.cos(a) * r, rnd(-1.5, 1.5), Math.sin(a) * r)); fx.spark(q, p.clone().sub(q).multiplyScalar(2.2).add(new V3(-Math.sin(a) * 3, 0, Math.cos(a) * 3)), { color: c, life: 0.45, size: 0.3 }); }
    }, false, () => {
      snd.stop();
      const k = ctx.lv >= 3 ? 2 : 1;
      impact(ctx, p, c, 1.6, { pillar: true }); ctx.hitstop(0.12);
      ctx.hitSphere(p, 6, ctx.dmg(70) * 4 * k, { posture: 4 * k, stun: ctx.lv >= 5 ? 1.5 : 0, launch: 7 });
    });
    ctx.every(4, 0.25, () => ctx.hitSphere(p, 4.6, ctx.dmg(70), { kb: -3 }));
  } };

  SK.dragon = { ai: 'close', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, yaw = ctx.face(), dir = ctx.dirToAim(), start = f.pos.clone();
    ctx.anim('Unarmed_Melee_Attack_Punch_A', 1.6); f.vel.y = 8;
    ctx.act({ dur: 0.45, face: yaw, vel: new V3() });
    ctx.later(0.12, () => {
      ctx.sfx('fire', { len: 1.6 }); ctx.sfx('roar', { rate: 1.8, g: 0.4 });
      fx.flash(f.center(), { color: c, r: 1.5, life: 0.25 });
      ctx.hitSphere(f.center().addScaledVector(dir, 1.5), 2.6, ctx.dmg(520) * 0.4, { launch: 10 });
      const run = (back) => {
        const hit = new Set(), seg = []; const N = 14;
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x220800, emissive: col(c), emissiveIntensity: 3 })); head.geometry.userData.own = true;
        const L = 30, D = 1.1;
        fx.add(head, D, (k, o, dt, t) => {
          const kk = back ? 1 - k : k;
          const along = kk * L, wig = Math.sin(t * 14) * 1.2;
          const side = new V3(dir.z, 0, -dir.x);
          const p = start.clone().addScaledVector(dir, along).addScaledVector(side, wig).setY(1.6 + Math.sin(t * 9) * 0.6);
          o.position.copy(p); o.lookAt(p.clone().addScaledVector(dir, back ? -1 : 1)); o.rotateX(Math.PI / 2);
          seg.push(p.clone()); if (seg.length > N) seg.shift();
          seg.forEach((q, i) => { fx.spark(q, new V3(rnd(-1, 1), rnd(0, 2), rnd(-1, 1)), { color: i % 3 ? c : 0xffd27a, life: 0.35, size: 0.9 * (i / N + 0.3), size1: 0.1 }); });
          if (ctx.auth) for (const t2 of ctx.enemies()) { const key = BR.Arena.groupKey(t2); if (!hit.has(key) && t2.pos.distanceTo(p) < t2.r + 2) { hit.add(key); ctx.hitTarget(t2, ctx.dmg(520), { posture: 2 }); fx.flash(t2.pos, { color: c, r: 1.6, life: 0.2 }); ctx.shake(0.3); } }
          if (ctx.lv >= 3 && Math.random() < dt * 8) ctx.zone({ pos: p.clone().setY(0), life: 2, iv: 0.5, onTick: z => { ctx.hitSphere(z.pos.clone().setY(0.6), 1.4, ctx.dmg(20), {}); fx.spark(z.pos, new V3(0, 3, 0), { color: c, life: 0.5, size: 0.7 }); } });
        }, false, () => { if (!back && ctx.lv >= 5) run(true); });
      };
      run(false);
    });
  } };

  SK.contre = { ai: 'react', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, hits = ctx.lv >= 3 ? 12 : 8;
    ctx.anim('Block', 1.2); ctx.sfx('magic', { rate: 0.4 });
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), shellMat(0xffffff, 1.5, 0.8)); aura.geometry.userData.own = true;
    const it = fx.add(aura, 1.2, (k, o, dt, t) => { o.position.copy(f.center()); o.material.uniforms.uTime.value = t; });
    f.counter = { t: 1.2, trigger: () => {
      f.counter = null; fx.kill(it);
      ctx.slowmo(1.2); ctx.sfx('parry'); ctx.hitstop(0.1);
      f.inv = Math.max(f.inv, hits * 0.07 + 0.4);
      const t0 = ctx.nearest(f.pos, 14); if (!t0) return;
      for (let i = 0; i < hits; i++) ctx.later(i * 0.06, () => {
        const a = Math.random() * 6.283, p = t0.pos.clone().add(new V3(Math.cos(a) * (t0.r + 1.2), 0, Math.sin(a) * (t0.r + 1.2))); p.y = 0;
        f.pos.copy(p); f.yaw = Math.atan2(t0.pos.x - p.x, t0.pos.z - p.z); ctx.anim(i % 2 ? atkAnim(f) : slashAnim(f), 3);
        fx.slash(t0.pos, f.yaw + rnd(-0.5, 0.5), { r: 2.4, arc: 2.4, tilt: rnd(-1.2, 1.2), color: i % 2 ? c : '#ffd36b', life: 0.18 });
        afterimage(ctx, f, c); ctx.sfx('hit', { rate: 1 + i * 0.05, g: 0.6 });
        ctx.hitTarget(t0, ctx.dmg(110), { crit: i === hits - 1 });
      });
      if (ctx.lv >= 5) f.ult = Math.min(100, f.ult + 25);
    } };
    ctx.later(1.2, () => { f.counter = null; });
  } };

  SK.tempete = { ai: 'mid', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, center = ctx.clampAim(18), n = ctx.lv >= 3 ? 20 : 12;
    ctx.anim('Spellcast_Raise', 1.4); ctx.act({ dur: 0.5, face: ctx.face() }); ctx.sfx('charge', { len: 0.5 });
    const cloud = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshBasicMaterial({ color: 0x0a1020, transparent: true, opacity: 0.6, depthWrite: false })); cloud.geometry.userData.own = true; cloud.rotation.x = Math.PI / 2; cloud.position.set(center.x, 18, center.z);
    fx.add(cloud, 3.6, (k, o) => { o.material.opacity = 0.6 * Math.min(1, k * 8, (1 - k) * 6); });
    for (let i = 0; i < n; i++) ctx.later(0.4 + i * (3 / n), () => {
      const tg = Math.random() < 0.6 ? ctx.nearest(center, 7) : null;
      const p = tg ? tg.pos.clone().setY(0) : center.clone().add(new V3(rnd(-6, 6), 0, rnd(-6, 6)));
      strike(ctx, p.clone().add(new V3(rnd(-2, 2), 18, rnd(-2, 2))), p, c, { g: 0.5 }); fx.ring(p, { r1: 2.4, color: c, life: 0.3 });
      ctx.hitSphere(p.clone().setY(1), 2.3, ctx.dmg(120), { stun: 0.1 });
    });
    if (ctx.lv >= 5) ctx.later(3.7, () => {
      const p = center.clone(); for (let j = 0; j < 4; j++) fx.bolt(p.clone().add(new V3(rnd(-1, 1), 30, rnd(-1, 1))), p, { color: c, life: 0.4, jitter: 1.5 });
      impact(ctx, p.clone().setY(0.5), c, 2.2, { pillar: true }); ctx.hitSphere(p.clone().setY(1), 6, ctx.dmg(120) * 4, { stun: 1, posture: 4 });
    });
  } };

  /* =====================================================================
     ULTIMES
     ===================================================================== */
  SK.u_lame = { ai: 'ult', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, center = ctx.clampAim(22);
    ctx.anim('Spellcast_Raise', 1.2); ctx.act({ dur: 0.7, face: ctx.face() });
    const drop = (p, delay, k) => ctx.later(delay, () => {
      fx.decal(p, 'circle', { r: 7 * k, color: c, dur: 0.75, hold: 0.2, world: false });
      const s = swordMesh(c, 16 * k, 3); s.position.set(p.x, 60, p.z); s.rotation.y = Math.random() * 6;
      fx.pillar(p, { color: c, r: 0.5 * k, h: 60, life: 0.8, grow: 2, alpha: 0.6 });
      ctx.sfx('charge', { len: 0.7 });
      fx.add(s, 2.6, (kk, o, dt, t) => {
        if (t < 0.75) o.position.y = 60 - Math.pow(t / 0.75, 2) * (60 - 16 * k * 0.82);
        else if (!o.userData.hit) {
          o.userData.hit = true; o.position.y = 16 * k * 0.82;
          impact(ctx, p.clone().setY(1), c, 3 * k, { pillar: true });
          fx.ring(p, { r1: 14 * k, color: 0xffffff, life: 0.8, width: 0.08 }); fx.ring(p, { r1: 10 * k, color: c, life: 0.6, width: 0.3 });
          ctx.hitstop(0.18); ctx.shake(1.0);
          ctx.hitSphere(p.clone().setY(1), 7 * k, ctx.dmg(1800) * (k < 1 ? 0.3 : 1), { launch: 12, posture: 6, stun: ctx.lv >= 3 ? 2 : 0 });
        }
        o.material.opacity = kk > 0.8 ? (1 - kk) / 0.2 : 1;
      });
    });
    drop(center, 0.35, 1);
    if (ctx.lv >= 5) { const d = ctx.dirToAim(), side = new V3(d.z, 0, -d.x); drop(center.clone().addScaledVector(side, 6), 0.7, 0.7); drop(center.clone().addScaledVector(side, -6), 0.9, 0.7); }
  } };

  SK.u_temps = { ai: 'ult', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, dur = ctx.lv >= 3 ? 5 : 4;
    ctx.anim('Spellcast_Raise', 1.6);
    // cadran géant qui s'étend au sol
    const g = new THREE.Group(); g.position.copy(f.pos).setY(0.08);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({ color: col(c).multiplyScalar(2), transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); ring.geometry.userData.own = true; ring.rotation.x = -Math.PI / 2; g.add(ring);
    for (let i = 0; i < 12; i++) { const tk = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.14), ring.material); tk.geometry.userData.own = true; tk.rotation.x = -Math.PI / 2; const a = i / 12 * 6.283; tk.position.set(Math.sin(a) * 0.88, 0.01, Math.cos(a) * 0.88); tk.rotation.z = -a; g.add(tk); }
    const hand = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.8), ring.material); hand.geometry.userData.own = true; hand.rotation.x = -Math.PI / 2; g.add(hand);
    fx.add(g, dur + 0.5, (k, o, dt, t) => { const s = Math.min(30, 1 + t * 60); o.scale.setScalar(s); hand.rotation.z = -t * 1.5; ring.material.opacity = Math.min(1, (dur + 0.5 - t) * 2) * 0.8; o.position.x = f.pos.x; o.position.z = f.pos.z; }, false);
    fx.flash(f.center(), { color: 0xffffff, r: 3, life: 0.4, intensity: 6 });
    ctx.timeStop(dur);
  } };

  SK.u_rayon = { ai: 'ult', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, dur = ctx.lv >= 3 ? 4.5 : 3.5, w = ctx.lv >= 3 ? 2.0 : 1.4;
    ctx.anim('Spellcast_Long', 1.0); ctx.sfx('charge', { len: 0.6 });
    const beam = fx.beam({ color: c, width: 0.1 });
    const snd = BR.Audio.loopFx('beam');
    let tick = 0, end = new V3(), done = false;
    const charge = 0.45, stop = () => { if (done) return; done = true; beam.kill(); snd.stop(); };
    // garde-fou : si le sort est interrompu (étourdi, autre action), le rayon et son son s'arrêtent quand même
    ctx.later(dur + charge + 0.25, stop);
    ctx.act({ dur: dur + charge, lockMove: true, vel: new V3(), update: (t, dt) => {
      const aim = (f.ctl && f.ctl.aim) ? f.ctl.aim : ctx.aim;
      f.yaw = BR.lerp(f.yaw, f.yaw + BR.angDiff(f.yaw, Math.atan2(aim.x - f.pos.x, aim.z - f.pos.z)), Math.min(1, dt * 8));
      if (t > 0.5 && f.av.oneShot == null) ctx.anim('Spellcasting', 1, { fade: 0.1 });
      const from = f.center().add(new V3(0, 0.35, 0)).addScaledVector(f.fwd(), 0.8);
      const dir = aim.clone().sub(from).normalize();
      // longueur : jusqu'au sol ou 60 m
      let L = 60; if (dir.y < -0.01) L = Math.min(L, -from.y / dir.y);
      end.copy(from).addScaledVector(dir, L);
      const k = t < charge ? t / charge : 1, ww = t < charge ? 0.15 + k * 0.3 : w * (1 + Math.sin(t * 40) * 0.05);
      beam.set(from, t < charge ? from.clone().addScaledVector(dir, 2 * k) : end, ww, 1);
      snd.set(t < charge ? k * 0.5 : 1);
      for (let j = 0; j < 4; j++) fx.spark(from, new V3(rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)), { color: c, life: 0.25, size: 0.5 });
      if (t >= charge) {
        ctx.shake(0.06); fx.spark(end, new V3(rnd(-8, 8), rnd(2, 10), rnd(-8, 8)), { color: c, life: 0.5, size: 0.6, grav: 12 });
        if (Math.random() < dt * 20) fx.flash(end, { color: c, r: 1.5 * w, life: 0.12, intensity: 4, light: false });
        tick -= dt;
        if (tick <= 0) { tick = 0.12; ctx.hitLine(from, end, w * 0.6, ctx.dmg(220) * 0.28 * (1 + (t - charge) * 0.3), { posture: 0.6 }); }
      }
    }, onEnd: () => {
      stop();
      if (ctx.lv >= 5) { impact(ctx, end.clone(), c, 2.5, { pillar: true }); ctx.hitSphere(end, 8, ctx.dmg(220) * 6, { launch: 10, posture: 6 }); }
    } });
    ctx.later(charge, () => { ctx.sfx('boom', { rate: 1.6, g: 0.8 }); ctx.shake(0.5); fx.flash(f.center(), { color: c, r: 2, life: 0.3 }); });
  } };

  SK.u_lames = { ai: 'ult', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, n = ctx.lv >= 3 ? 20 : 14;
    const t0 = ctx.lockTarget(); if (!t0) { ctx.anim('Cheer'); return; }
    const home = f.pos.clone();
    f.inv = Math.max(f.inv, n * 0.075 + 1.2);
    ctx.slowmo(n * 0.075 + 0.8);
    ctx.act({ dur: n * 0.075 + 0.9, lockMove: true, vel: new V3(), float: true });
    for (let i = 0; i < n; i++) ctx.later(0.1 + i * 0.075, () => {
      const a = Math.random() * 6.283, h = rnd(0, 2.5), p = t0.pos.clone().add(new V3(Math.cos(a) * (t0.r + 1.6), 0, Math.sin(a) * (t0.r + 1.6))); p.y = Math.max(0, t0.pos.y - 1 + h);
      const prev = f.center();
      f.pos.copy(p); f.vel.set(0, 0, 0); f.yaw = Math.atan2(t0.pos.x - p.x, t0.pos.z - p.z);
      fx.bolt(prev, f.center(), { color: c, life: 0.15, jitter: 0.3, light: false });
      ctx.anim(i % 2 ? slashAnim(f) : atkAnim(f), 3.2, { fade: 0.02 });
      fx.slash(t0.pos, f.yaw + Math.PI / 2 * (i % 2), { r: t0.r + 2.2, arc: 2.6, tilt: rnd(-1.4, 1.4), color: i % 3 ? c : '#ffffff', life: 0.2, inner: 0.75 });
      fx.burst(t0.pos, { n: 10, color: c, speed: 10, life: 0.3 });
      ctx.sfx('hit', { rate: 1.1 + (i % 4) * 0.1, g: 0.7 }); ctx.shake(0.12);
      ctx.hitTarget(t0, ctx.dmg(120), { crit: Math.random() < 0.4 });
    });
    ctx.later(0.15 + n * 0.075, () => {
      f.pos.copy(home); f.yaw = Math.atan2(t0.pos.x - home.x, t0.pos.z - home.z);
      ctx.anim('Cheer', 1.6);
      const p = t0.pos.clone();
      fx.slash(p, f.yaw, { r: 9, arc: 1.4, tilt: 0.8, color: c, life: 0.5, inner: 0.9, sweep: 0.12 });
      fx.slash(p, f.yaw, { r: 9, arc: 1.4, tilt: -0.8, color: '#ffffff', life: 0.5, inner: 0.9, sweep: 0.12, flip: true });
      ctx.later(0.45, () => {
        impact(ctx, p, c, 2.6, { pillar: true }); ctx.hitstop(0.2); ctx.shake(1.1);
        ctx.hitTarget(t0, ctx.dmg(120) * (ctx.lv >= 5 ? 6 : 3), { crit: true, posture: 8 });
      });
    });
  } };

  SK.u_domaine = { ai: 'ult', cast(ctx) {
    const { f, fx, S } = ctx, c = ctx.color, p = f.pos.clone().setY(0), R = 14, dur = 9, mul = ctx.lv >= 5 ? 1.7 : 1.4;
    ctx.anim('Spellcast_Raise', 1.2); ctx.sfx('ult', { g: 0.6 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), shellMat(c, 3, 0.9)); dome.geometry.userData.own = true; dome.position.copy(p);
    fx.add(dome, dur, (k, o, dt, t) => { const s = R * Math.min(1, t * 2.5); o.scale.setScalar(s); o.material.uniforms.uTime.value = t; o.material.uniforms.uA.value = Math.min(1, (dur - t) * 1.5) * 0.9; S.domainVis = Math.min(1, t * 2, (dur - t)) * (f.kind === 'local' || f.pos.distanceTo(S.me.pos) < R ? 1 : 0); }, false, () => { S.domainVis = 0; });
    fx.decal(p, 'ring', { r: R, inner: 0.95, color: c, dur: 0.4, hold: dur - 0.4, world: false });
    ctx.zone({ pos: p, life: dur, iv: 0.25, onTick: z => {
      for (const a of S.fighters.values()) {
        const inside = a.pos.distanceTo(z.pos) < R;
        if (a.team === f.team && inside) { a.buff.domain = 1; a.buff.domainT = 0.4; a.buff.domainMul = mul; if (ctx.lv >= 5) { a.buff.domain2 = 1; a.buff.domain2T = 0.4; } }
        if (a.team !== f.team && inside) a.slow = Math.max(a.slow, 0.4);
      }
      if (S.boss) S.boss.domainSlow = S.boss.focus().setY(0).distanceTo(z.pos) < R + 2 ? 0.4 : 0;
      if (z.t > dur - 0.3 && S.boss) S.boss.domainSlow = 0;
      if (ctx.lv >= 3 && Math.round(z.t * 4) % 4 === 0) ctx.hitSphere(z.pos.clone().setY(2), R, ctx.dmg(120), {});
      for (let k = 0; k < 10; k++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R; fx.spark(z.pos.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new V3(0, rnd(1, 4), 0), { color: c, life: 1, size: 0.35, size1: 0.05 }); }
    } });
  } };

  SK.u_meteore = { ai: 'ult', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, center = ctx.clampAim(24);
    ctx.anim('Spellcast_Raise', 1.2); ctx.act({ dur: 0.6, face: ctx.face() }); ctx.sfx('charge', { len: 1.2 });
    const fall = (p, size, delay, dmgK) => ctx.later(delay, () => {
      fx.decal(p, 'circle', { r: 8 * size, color: c, dur: 1.4, hold: 0.2, world: false });
      const g = new THREE.IcosahedronGeometry(1, 1); g.userData.own = true;
      const rock = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: col(c), emissiveIntensity: 1.8, flatShading: true, roughness: 0.8 }));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(1.35, 20, 14), shellMat(c, 1.2, 1)); glow.geometry.userData.own = true; rock.add(glow);
      rock.scale.setScalar(3.2 * size);
      const from = p.clone().add(new V3(-30, 70, -20).multiplyScalar(size > 0.6 ? 1 : 0.6));
      fx.add(rock, 1.4, (k, o, dt, t) => {
        o.position.copy(from).lerp(p, Math.pow(k, 1.4)); o.rotation.x += dt * 3; o.rotation.y += dt * 2;
        for (let j = 0; j < 6; j++) fx.spark(o.position.clone().add(new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(2 * size)), new V3(rnd(-2, 2), rnd(0, 3), rnd(-2, 2)), { color: j % 2 ? c : 0xffcc66, life: 0.6, size: 1.6 * size, size1: 0.2 });
        if (Math.random() < dt * 30) fx.spark(o.position, new V3(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)), { kind: 'smoke', color: 0x1a1210, life: 1.4, size: 2.5 * size, size1: 4 * size, alpha: 0.7, grav: -0.5 });
      }, false, () => {
        impact(ctx, p.clone().setY(1), c, 3.4 * size, { pillar: true });
        fx.ring(p, { r1: 16 * size, color: 0xffd080, life: 0.9, width: 0.06 });
        ctx.hitstop(0.16 * size); ctx.shake(1.2 * size);
        ctx.hitSphere(p.clone().setY(1), 8 * size, ctx.dmg(1500) * dmgK, { launch: 14, posture: 8 * size });
        ctx.zone({ pos: p, life: 4, iv: 0.5, onTick: z => { ctx.hitSphere(z.pos.clone().setY(0.6), (ctx.lv >= 3 ? 7 : 5) * size, ctx.dmg(ctx.lv >= 3 ? 60 : 35), {}); for (let k = 0; k < 10; k++) fx.spark(z.pos.clone().add(new V3(rnd(-5, 5) * size, 0.1, rnd(-5, 5) * size)), new V3(0, rnd(2, 6), 0), { color: k % 2 ? c : 0xffaa40, life: 0.6, size: 0.8, size1: 0.05 }); } });
      });
    });
    fall(center, 1, 0.1, 1);
    if (ctx.lv >= 5) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; fall(center.clone().add(new V3(Math.cos(a) * 9, 0, Math.sin(a) * 9)), 0.45, 0.6 + i * 0.15, 0.2); }
  } };

  SK.u_legion = { ai: 'ult', cast(ctx) {
    const { f, fx } = ctx, c = ctx.color, n = ctx.lv >= 3 ? 8 : 5, skins = ['sk_warrior', 'minion', 'sk_mage', 'reaper'];
    ctx.anim('Spellcast_Raise', 1.2); ctx.sfx('roar', { rate: 1.4, g: 0.5 });
    for (let i = 0; i < n; i++) ctx.later(0.2 + i * 0.12, () => {
      const a = i / n * 6.283, p = f.pos.clone().add(new V3(Math.cos(a) * 3, 0, Math.sin(a) * 3)); p.y = 0;
      const sk = ctx.fighter({ id: 'os' + i, look: { skin: skins[i % skins.length] }, kind: 'summon', weapon: i % 2 ? 'greatsword' : 'blade' });
      sk.owner = f; sk.team = f.team; sk.summonMul = 1; sk.pos.copy(p).setY(-2); sk.yaw = f.yaw;
      fx.pillar(p, { color: c, r: 1, h: 8, life: 0.6 }); fx.burst(p, { n: 30, color: c, speed: 6, up: 1, life: 0.6 });
      sk.play('Lie_StandUp', 1.6);
      let life = 12, atk = 0.8 + Math.random() * 0.5, rise = 0.5;
      const api = BR.Arena.api(sk, ctx.auth, ctx.lv, ctx.aim, 'u_legion');
      ctx.summon({
        team: f.team, f: sk,
        update(dt) {
          life -= dt; if (life <= 0) return false;
          if (rise > 0) { rise -= dt; sk.pos.y = Math.min(0, sk.pos.y + dt * 5); sk.update(dt, { speed: 0 }); return true; }
          for (let k = 0; k < 2; k++) if (Math.random() < dt * 10) fx.spark(sk.center().add(new V3(rnd(-0.4, 0.4), rnd(-0.6, 0.8), rnd(-0.4, 0.4))), new V3(0, rnd(1, 3), 0), { color: c, life: 0.5, size: 0.4, size1: 0.05 });
          const t = api.nearest(sk.pos, 60);
          let sp = 0;
          if (t) {
            const d = t.pos.clone().setY(0).sub(sk.pos).setY(0), dist = d.length() - t.r;
            sk.yaw = Math.atan2(d.x, d.z);
            if (dist > 1.6) { sp = 7; sk.pos.addScaledVector(d.normalize(), sp * dt); }
            else { atk -= dt; if (atk <= 0) { atk = 0.9; sk.play(i % 2 ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Slice_Diagonal', 1.5); ctx.later(0.25, () => { fx.slash(sk.center(), sk.yaw, { r: 2.4, arc: 2, color: c, life: 0.2 }); api.hitCone(sk.pos, sk.yaw, 2.6, 2, ctx.dmg(70), { kind: 'ult' }); }); } }
          }
          sk.update(dt, { speed: sp });
          return true;
        },
        dispose() {
          fx.burst(sk.center(), { n: 30, color: c, speed: 6, life: 0.6 });
          if (ctx.lv >= 5) { impact(ctx, sk.center(), c, 0.9); api.hitSphere(sk.center(), 3.5, ctx.dmg(250), {}); }
          sk.dispose();
        },
      });
    });
  } };
  // outils internes exposés aux fichiers de classe (js/arena/cls-*.js) ; non énumérable pour ne pas passer pour un sort
  Object.defineProperty(SK, '_H', { value: { impact, strike, swordMesh, mergeGeos, shellMat, afterimage, atkAnim, slashAnim }, enumerable: false });
})();

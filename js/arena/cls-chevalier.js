/* ===== arena/cls-chevalier.js : pouvoirs de la classe chevalier (game feel) =====
   Chaque pouvoir est déclaré avec BR.Asc.variant(cls, id, (ctx, orig) => {...}). Voir asc-classes.js pour l API.
   Identité : combattant au contact, robuste. Ses pouvoirs le TRANSFORMENT et font de son épée l'arme :
   la lame grandit (épée réelle agrandie + lame d'énergie qui la prolonge), charges, sauts écrasants,
   parades qui renvoient, formes (orage, flamme, ombre).
   Règles réseau : les visuels se jouent partout (ctx.auth = false chez les autres), les dégâts passent
   uniquement par ctx.hit* / ctx.proj / ctx.zone ; la position du lanceur n'est modifiée que s'il est simulé ici. */
(function () {
  const BR = window.BR, Q = BR && BR.Asc;
  if (!Q || !Q.variant || !BR.ASkills || !BR.ASkills._H || !window.THREE) return;
  const SK = BR.ASkills, H = SK._H, FXH = Q.FXH || {};
  const V3 = THREE.Vector3, UP = new V3(0, 1, 0), TAU = Math.PI * 2, CLS = 'chevalier';
  const C = c => new THREE.Color(c);
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* =====================================================================
     OUTILS
     ===================================================================== */
  const canMove = f => !!f && f.kind !== 'remote';                         // position simulée ici (joueur local, IA, double)
  const isLocal = ctx => ctx.f.kind === 'local';
  const tipOf = f => (f.tip ? f.tip(0) : f.center());
  const swordOf = f => (f && f.weapons && (f.weapons.find(w => w && w.trail) || f.weapons[0])) || null;
  const shieldOf = f => (f && f.weapons && f.weapons.find(w => w && !w.trail)) || null;
  const aimOf = ctx => (ctx.f.ctl && ctx.f.ctl.aim) || ctx.aim;
  const gk = t => (BR.Arena && BR.Arena.groupKey ? BR.Arena.groupKey(t) : t.kind + ':' + (t.i != null ? t.i : (t.f && t.f.id)));
  const kick = (ctx, v) => { if (isLocal(ctx) && ctx.S) ctx.S.fovKick = Math.max(ctx.S.fovKick || 0, v); };
  const banner = (ctx, txt) => { if (isLocal(ctx) && BR.Arena && BR.Arena.banner) BR.Arena.banner(txt, '', 0.8, 'gold'); };
  const zap = (ctx, a, b, c) => { if (FXH.bolt) FXH.bolt(ctx, a, b, c); else { ctx.fx.bolt(a, b, { color: c, life: 0.2, jitter: 1.2, segs: 12 }); ctx.fx.bolt(a, b, { color: 0xffffff, life: 0.1, jitter: 0.6, segs: 8, light: false }); } };
  const puff = (ctx, p, c, k) => { if (FXH.puff) FXH.puff(ctx, p, c, k); else { ctx.fx.flash(p, { color: c, r: 1.2 * k, life: 0.22, intensity: 4 }); ctx.fx.burst(p, { n: Math.round(16 * k), color: c, speed: 7 * k, life: 0.4 }); } };
  const nearSort = (list, p) => list.slice().sort((x, y) => x.pos.distanceTo(p) - y.pos.distanceTo(p));
  // rang d'un nœud de l'arbre de compétences (asc-tree.js) pour ce lanceur (local ou distant : mêmes visuels partout)
  const TR = (f, id) => (Q.treeRank ? Q.treeRank(f, id) : 0);
  // épée spectrale qui tombe du ciel sur p (arbre : « Saut : pluie d'épées »)
  function skySword(ctx, p, delay, dmg) {
    const { fx } = ctx, c = ctx.color;
    ctx.later(delay, () => {
      const m = FXH.SKsword ? FXH.SKsword(c, 2.4) : new THREE.Group(), from = p.clone().add(new V3(rnd(-2, 2), 16, rnd(-2, 2))), q = p.clone().setY(0.2);
      m.position.copy(from); m.lookAt(q);
      fx.add(m, 0.26, (k, o) => { o.position.lerpVectors(from, q, k * k); });
    });
    ctx.later(delay + 0.26, () => {
      fx.flash(p.clone().setY(0.8), { color: c, r: 1.4, life: 0.2, intensity: 5 });
      fx.ring(p.clone().setY(0.06), { r0: 0.3, r1: 2.6, color: c, life: 0.3, width: 0.3 });
      fx.burst(p.clone().setY(0.4), { n: 14, color: c, speed: 7, up: 1, life: 0.4 });
      ctx.sfx('metal', { g: 0.5, rate: 1.3 });
      ctx.hitSphere(p.clone().setY(1), 2.4, ctx.dmg(90), { stun: 0.3, kb: 3, posture: 1 });
    });
  }
  // effet visible chez les autres joueurs (ripostes déclenchées seulement chez le lanceur)
  function netBoom(ctx, p, r, c) {
    try { if (ctx.S.asc && isLocal(ctx) && BR.Arena && BR.Arena.ascTools) BR.Arena.ascTools().send({ k: 'qa', t: 'fx', n: 'boom', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), r, c: C(c).getHex() }); } catch (e) { /* hors Ascension */ }
  }

  /* ---------- géométries partagées (jamais détruites) ---------- */
  const keep = g => { g.userData.keep = true; return g; };
  const G = {
    blade: keep(new THREE.ConeGeometry(0.5, 1, 4, 1).translate(0, 0.5, 0).scale(1, 1, 0.25)),      // lame effilée, base en 0, pointe en +Y
    plane: keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5)),         // ruban au sol, s'étend vers +Z
    sph: keep(new THREE.SphereGeometry(1, 20, 14)),
    ico: keep(new THREE.IcosahedronGeometry(1, 1)),
    funnel: keep(new THREE.CylinderGeometry(1, 0.25, 1, 24, 1, true).translate(0, 0.5, 0)),
    spike: keep(new THREE.ConeGeometry(0.3, 1, 5, 1).translate(0, 0.5, 0)),
    disc: keep(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2)),
    hex: keep(new THREE.CircleGeometry(1, 6)),
    hexRim: keep(new THREE.RingGeometry(0.86, 1, 6)),
  };
  function glow(color, mul, op) {
    return new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(mul == null ? 2 : mul), transparent: true, opacity: op == null ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  }
  function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; return m; }
  function disposeTree(o) {
    if (!o) return;
    o.traverse(m => { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); if (m.geometry && m.geometry.userData.own) m.geometry.dispose(); });
  }
  // épée spectrale lancée (projectile : le moteur l'oriente vers +Z dans le sens du vol)
  function swordProj(color, len) {
    const g = new THREE.Group(), s = H.swordMesh(color, len, 2.8);
    s.rotation.x = -Math.PI / 2; s.position.z = -0.35 * len; g.add(s);
    return g;
  }

  /* ---------- L'ÉPÉE QUI GRANDIT ----------
     L'épée réelle grossit (échelle) et une lame d'énergie la prolonge jusqu'à o.len mètres.
     Un seul effet par combattant : les demandes successives se cumulent (max) et prolongent la durée. */
  function bladeUp(ctx, o) {
    const f = ctx.f, w = swordOf(f);
    if (!w || !w.obj || !w.P || !ctx.S) return;
    const S = ctx.S, now = S.t;
    let st = f._ckBlade;
    if (!st || !st.it || st.it.dead) st = f._ckBlade = { len: 0, grow: 1, until: 0, cur: 0, col: C(o.color || ctx.color), wd: 0.3, it: null };
    else if (now > st.until) { st.len = 0; st.grow = 1; }
    st.len = Math.max(st.len, o.len || 0); st.grow = Math.max(st.grow, o.grow || 1); st.until = Math.max(st.until, now + (o.dur || 0.6));
    st.col.set(o.color || ctx.color); st.wd = o.w || st.wd || 0.3;
    if (st.it) { st.it.life = Math.max(st.it.life, st.it.t + (st.until - now) + 1.2); return; }
    const obj = w.obj, P = w.P;
    if (!obj.userData.ckS0) obj.userData.ckS0 = obj.scale.clone();
    const s0 = obj.userData.ckS0;
    const grp = new THREE.Group(), outer = mesh(G.blade, glow(st.col, 2.4, 0.55)), core = mesh(G.blade, glow(0xffffff, 2.6, 0.95));
    grp.add(outer, core);
    const a = new V3(), b = new V3(), d = new V3();
    st.it = ctx.fx.add(grp, (st.until - now) + 1.2, (k, g, dt, t) => {
      const on = S.t < st.until && f.alive;
      st.cur += ((on ? 1 : 0) - st.cur) * Math.min(1, dt * (on ? 14 : 8));
      obj.scale.copy(s0).multiplyScalar(1 + (st.grow - 1) * st.cur);
      obj.localToWorld(a.copy(P.base)); obj.localToWorld(b.copy(P.tip));
      d.subVectors(b, a); const L = d.length();
      if (L < 1e-4 || st.cur < 0.02) { g.visible = false; return; }
      g.visible = true; d.divideScalar(L);
      const len = Math.max(L * 1.08, L + (st.len - L) * st.cur);
      g.position.copy(a); g.quaternion.setFromUnitVectors(UP, d);
      const wd = st.wd * st.cur, fl = 1 + Math.sin(t * 45) * 0.08;
      outer.scale.set(wd * fl, len * 1.04, wd * fl); core.scale.set(wd * 0.4, len, wd * 0.4);
      outer.material.color.copy(st.col).multiplyScalar(2.4);
      if (Math.random() < dt * 40 * st.cur) ctx.fx.spark(a.clone().addScaledVector(d, len * Math.random()), new V3(rnd(-1, 1), rnd(0, 1.5), rnd(-1, 1)), { color: st.col, life: 0.25, size: 0.22, size1: 0.03 });
    }, false, () => { obj.scale.copy(s0); if (f._ckBlade === st) f._ckBlade = null; });
  }
  // gonfle un objet (le bouclier) puis le ramène à sa taille
  function pump(ctx, obj, k, dur) {
    if (!obj || !ctx.S) return;
    const u = obj.userData, S = ctx.S;
    if (!u.ckS0) u.ckS0 = obj.scale.clone();
    if (!u.ckIt || u.ckIt.dead || S.t > (u.ckUntil || 0)) u.ckK = 1;
    u.ckK = Math.max(u.ckK || 1, k); u.ckUntil = Math.max(u.ckUntil || 0, S.t + dur);
    if (u.ckIt && !u.ckIt.dead) { u.ckIt.life = Math.max(u.ckIt.life, u.ckIt.t + dur + 1); return; }
    let cur = 1;
    u.ckIt = ctx.fx.add(new THREE.Object3D(), dur + 1, (kk, o, dt) => {
      const want = S.t < u.ckUntil ? u.ckK : 1; cur += (want - cur) * Math.min(1, dt * (want > cur ? 16 : 8)); obj.scale.copy(u.ckS0).multiplyScalar(cur);
    }, false, () => { obj.scale.copy(u.ckS0); u.ckIt = null; });
  }
  // anticipation : une lueur monte sur la pointe de l'épée, des étincelles convergent, un anneau se resserre au sol
  function charge(ctx, dur, color, o) {
    o = o || {}; const f = ctx.f, fx = ctx.fx;
    const m = mesh(G.sph, glow(color, 3, 0.9));
    fx.add(m, dur, (k, g, dt) => {
      const p = o.at ? o.at() : tipOf(f); g.position.copy(p); g.scale.setScalar((o.r || 0.35) * (0.15 + 0.85 * k * k));
      g.material.opacity = 0.9 * (k < 0.8 ? 1 : (1 - k) / 0.2);
      if (Math.random() < dt * 70) { const dir = new V3(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1)).normalize(), r = rnd(1.2, 2.4); fx.spark(p.clone().addScaledVector(dir, r), dir.multiplyScalar(-r / 0.2), { color, life: 0.2, size: 0.3, size1: 0.05 }); }
    });
    if (o.ring !== false) fx.ring(f.pos.clone(), { r0: o.ringR || 2.2, r1: 0.3, color, life: dur, width: 0.25 });
    if (o.snd !== false) ctx.sfx('charge', { len: Math.max(0.2, dur + 0.1), g: 0.5 });
  }
  // fissures lumineuses qui rayonnent au sol
  function cracks(ctx, p, n, len, color, life) {
    const grp = new THREE.Group(), mat = glow(color, 2.2, 1);
    grp.position.set(p.x, 0.04, p.z); grp.renderOrder = 3;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU + rnd(-0.25, 0.25), L = len * rnd(0.6, 1.1), segs = 3;
      let x = 0, z = 0;
      for (let s = 0; s < segs; s++) {
        const sl = L / segs, aa = a0 + rnd(-0.4, 0.4), m = mesh(G.plane, mat);
        m.position.set(x, 0, z); m.rotation.y = aa; m.scale.set(0.2 * (1 - s / segs) + 0.05, 1, sl);
        grp.add(m); x += Math.sin(aa) * sl; z += Math.cos(aa) * sl;
      }
    }
    ctx.fx.add(grp, life || 1.4, (k, g, dt, t) => { const e = Math.min(1, t / 0.12); g.scale.set(e, 1, e); mat.opacity = k < 0.6 ? 1 : Math.max(0, (1 - k) / 0.4); });
  }
  // onde de choc au sol : anneaux, poussière, éclats
  function shock(ctx, p, r, color, k) {
    const fx = ctx.fx, g = new V3(p.x, 0.06, p.z); k = k || 1;
    fx.ring(g, { r0: 0.4, r1: r, color, life: 0.45, width: 0.3 });
    fx.ring(g, { r0: 0.3, r1: r * 0.7, color: 0xffffff, life: 0.3, width: 0.18 });
    fx.burst(g.clone().setY(0.3), { n: Math.round(30 * k), color, speed: r * 2.6, life: 0.45, flat: true, size: 0.35 });
    fx.burst(g, { n: Math.round(16 * k), color: 0x6a5e54, kind: 'smoke', speed: r * 1.6, up: 0.25, life: 0.9, size: 0.9, size1: 2, grav: -0.4, drag: 2.5, alpha: 0.6 });
    if (fx.debris) fx.debris(g, { n: Math.round(8 * k), r: 1, speed: 8 + 2 * k, size: 0.25 });
  }
  // traits d'aspiration (lisibilité : « ça tire vers moi »)
  function suck(ctx, p, r, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, rr = r * rnd(0.7, 1.1), q = new V3(p.x + Math.cos(a) * rr, rnd(0.2, 1.6), p.z + Math.sin(a) * rr);
      ctx.fx.spark(q, new V3(p.x - q.x, 1.1 - q.y, p.z - q.z).multiplyScalar(1 / 0.3), { color, life: 0.3, size: 0.35, size1: 0.05 });
    }
    ctx.fx.burst(new V3(p.x, 0.1, p.z), { n: Math.round(n * 0.6), color: 0x6a6058, kind: 'smoke', speed: 2, life: 0.5, size: 0.7, size1: 0.2, grav: 0, alpha: 0.5 });
  }
  // coupure rectiligne (ruban horizontal + vertical qui s'ouvre puis s'efface)
  function cutLine(ctx, a, b, color, w0, life) {
    const d = b.clone().sub(a), L = Math.hypot(d.x, d.z); if (L < 0.1) return;
    const grp = new THREE.Group(); grp.position.copy(a); grp.rotation.y = Math.atan2(d.x, d.z);
    const m1 = mesh(G.plane, glow(color, 2.6, 1)), m2 = mesh(G.plane, glow(0xffffff, 3, 1)), m3 = mesh(G.plane, glow(color, 2.2, 1));
    m3.rotation.z = Math.PI / 2; grp.add(m1, m2, m3);
    ctx.fx.add(grp, life, (k) => {
      const w = w0 * (1 + k * 2.5);
      m1.scale.set(w, 1, L); m3.scale.set(w * 0.8, 1, L); m2.scale.set(Math.max(0.01, w0 * 0.35 * (1 - k)), 1, L);
      m1.material.opacity = 1 - k; m2.material.opacity = 1 - k; m3.material.opacity = 0.8 * (1 - k);
    });
  }
  // pics de lumière qui jaillissent du sol
  function spikes(ctx, pts, color, h, life) {
    const grp = new THREE.Group(), mat = glow(color, 1.8, 0.95), list = [];
    pts.forEach(p => { const m = mesh(G.spike, mat); m.position.set(p.x, 0, p.z); m.rotation.set(rnd(-0.35, 0.35), Math.random() * TAU, rnd(-0.35, 0.35)); m.userData.h = h * rnd(0.6, 1.2); m.scale.set(1, 0.01, 1); grp.add(m); list.push(m); });
    ctx.fx.add(grp, life, (k, g, dt, t) => {
      const e = Math.min(1, t / 0.1), out = k > 0.75 ? (1 - k) / 0.25 : 1;
      list.forEach(m => { m.scale.set(0.6 + 0.4 * out, Math.max(0.01, m.userData.h * e * out), 0.6 + 0.4 * out); });
      mat.opacity = 0.95 * out;
    });
  }
  // cyclone d'acier laissé derrière le tourbillon (niveau 5)
  function steelCyclone(ctx, p, c) {
    const fx = ctx.fx, dur = 3, R = 3.2, grp = new THREE.Group();
    grp.position.set(p.x, 0, p.z);
    const fm = glow(c, 1.4, 0.3), fun = mesh(G.funnel, fm); fun.scale.set(R, 5.5, R); grp.add(fun);
    const f2 = mesh(G.funnel, glow(0xffffff, 1.2, 0.18)); f2.scale.set(R * 0.6, 6, R * 0.6); grp.add(f2);
    const blades = [];
    for (let i = 0; i < 4; i++) { const s = H.swordMesh(c, 1.6, 2.6); s.rotation.order = 'YXZ'; grp.add(s); blades.push(s); }
    const snd = BR.Audio.loopFx ? BR.Audio.loopFx('wind') : null; if (snd) snd.set(0.6);
    fx.add(grp, dur, (k, g, dt, t) => {
      const a = Math.min(1, t * 5, (dur - t) * 3);
      fun.rotation.y += dt * 9; f2.rotation.y -= dt * 13; fm.opacity = 0.3 * a; f2.material.opacity = 0.18 * a;
      blades.forEach((s, i) => { const an = t * 7 + i / 4 * TAU, r = R * 0.8; s.position.set(Math.sin(an) * r, 1 + i * 0.7, Math.cos(an) * r); s.rotation.set(Math.PI / 2, an - Math.PI / 2, 0); s.material.opacity = a; });
      if (Math.random() < dt * 30) { const an = Math.random() * TAU, r = rnd(0.5, R); fx.spark(new V3(p.x + Math.sin(an) * r, rnd(0.2, 5), p.z + Math.cos(an) * r), new V3(Math.cos(an) * 8, 2, -Math.sin(an) * 8), { color: c, life: 0.35, size: 0.3 }); }
    }, false, () => { if (snd) snd.stop(); });
    // (le recul du moteur part du lanceur, pas du cyclone : kb -1.5 annule le bonus de recul pour garder les monstres dedans)
    ctx.every(dur, 0.3, () => ctx.hitSphere(p.clone().setY(1.2), R + 0.4, ctx.dmg(40), { kb: -1.5, stun: 0.2, posture: 0.4 }));
  }

  /* =====================================================================
     KIT DE DÉPART
     ===================================================================== */

  /* ---------- FENTE : estoc fulgurant ---------- */
  Q.setName(CLS, 'fente', 'Fente éclair', 'Tu te ramasses puis transperces tout sur 10 m d\'un estoc fulgurant (invulnérable pendant la ruée). Niv. 3 : la coupure se rouvre et frappe encore. Niv. 5 : enchaîne une 2e fente sur l\'ennemi le plus proche.');
  Q.variant(CLS, 'fente', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, mv = canMove(f), W = 0.14, D = 0.22, L = 10;
    const rebounds = (ctx.lv >= 5 ? 1 : 0) + (TR(f, 'ch_fente2') ? 1 : 0), trail = TR(f, 'ch_fente') > 0;
    const go = (delay, retarget, left) => ctx.later(delay, () => {
      if (!f.alive) return;
      let d = ctx.dirToAim();
      if (retarget) { const t = ctx.nearest(f.pos, 14); if (t) { const q = t.pos.clone().sub(f.pos).setY(0); if (q.lengthSq() > 0.25) d = q.normalize(); } }
      const yaw = Math.atan2(d.x, d.z); f.yaw = yaw;
      let start = null;
      // anticipation : il se ramasse derrière son bouclier, l'épée s'allume
      ctx.anim('Block', 2.2, { fade: 0.05 });
      charge(ctx, W, c, { snd: false, ringR: 1.8 });
      bladeUp(ctx, { len: 2.2, grow: 1.35, dur: W + D + 0.25, color: c, w: 0.28 });
      ctx.sfx('charge', { len: 0.2, g: 0.45 });
      fx.burst(f.pos.clone().setY(0.15), { n: 10, color: 0x6a6058, kind: 'smoke', speed: 3, up: 0.3, life: 0.5, size: 0.6, size1: 1.2, grav: -0.3 });
      const A = ctx.act({ dur: W + D + 0.1, face: yaw, vel: new V3(), update: (t) => {
        if (t >= W && t < W + D) { A.vel.copy(d).multiplyScalar(L / D * 1.15); H.afterimage(ctx, f, c); } else A.vel.set(0, 0, 0);
      } });
      ctx.later(W, () => {
        start = f.pos.clone();
        f.inv = Math.max(f.inv, D + 0.12);
        ctx.anim('1H_Melee_Attack_Stab', 2.4, { fade: 0.03 }); ctx.sfx('dash', { g: 1.1 }); ctx.sfx('swingBig', { rate: 1.5 });
        kick(ctx, 10);
        fx.burst(start.clone().setY(0.4), { n: 18, color: c, speed: 9, life: 0.35, dir: d.clone().negate(), spread: 0.5 });
        fx.ring(start.clone(), { r0: 0.3, r1: 2.6, color: c, life: 0.3, width: 0.3 });
      });
      ctx.later(W + D, () => {
        const s0 = (start || f.pos).clone().setY(0);
        const end = mv ? f.pos.clone().setY(0) : s0.clone().addScaledVector(d, L);
        const a = s0.clone().setY(1), b = end.clone().setY(1);
        cutLine(ctx, a, b, c, 0.4, 0.4);
        fx.burst(b, { n: 30, color: c, speed: 12, life: 0.4, dir: d, spread: 0.7 });
        const h = ctx.hitLine(a, b, 1.7, ctx.dmg(140), { kb: 4, posture: 1.5, stun: 0.25 });
        // l'estoc final : une pointe d'énergie jaillit devant
        const tipP = b.clone().addScaledVector(d, 3.2);
        cutLine(ctx, b, tipP, 0xffffff, 0.25, 0.25); fx.flash(tipP, { color: c, r: 1, life: 0.18, intensity: 4 });
        ctx.hitLine(b, tipP, 1.1, ctx.dmg(50), { kb: 6 });
        if (h.length) { ctx.hitstop(0.08); ctx.shake(0.35); ctx.sfx('crit', { g: 0.7 }); } else ctx.shake(0.12);
        // arbre : 3 éclairs frappent la trajectoire
        if (trail) for (let i = 0; i < 3; i++) ctx.later(0.12 + i * 0.08, () => {
          const q = a.clone().lerp(b, (i + 0.5) / 3);
          fx.bolt(q.clone().add(new V3(rnd(-1, 1), 12, rnd(-1, 1))), q, { color: c, life: 0.22, jitter: 1 });
          fx.flash(q, { color: c, r: 1.2, life: 0.18, intensity: 4 });
          ctx.sfx('zap', { g: 0.5, rate: 1 + i * 0.15 });
          ctx.hitSphere(q, 2.4, ctx.dmg(70), { stun: 0.3, posture: 0.8 });
        });
        if (ctx.lv >= 3) ctx.later(0.3, () => {
          cutLine(ctx, a, b, 0xffffff, 0.15, 0.3); fx.bolt(a, b, { color: c, life: 0.25, jitter: 0.4, segs: 12 });
          for (let i = 0; i <= 10; i++) fx.spark(a.clone().lerp(b, i / 10), new V3(rnd(-1, 1), rnd(3, 6), rnd(-1, 1)), { color: c, life: 0.4, size: 0.4, size1: 0.05 });
          ctx.sfx('zap', { g: 0.7 }); ctx.sfx('swing', { rate: 2 });
          ctx.hitLine(a, b, 1.8, ctx.dmg(80), { stun: 0.4 }); ctx.shake(0.2);
        });
        if (left > 0) go(0.12, true, left - 1);
      });
    });
    go(0, false, rebounds);
  });

  /* ---------- TOURBILLON : la lame d'énergie tournoie, aspire, puis explose ---------- */
  Q.setName(CLS, 'tourbillon', 'Tourbillon d\'acier', 'Ton épée devient une lame d\'énergie : 3 tours en avançant vers la visée ; chaque tour aspire et tranche, le dernier explose et projette tout. Niv. 3 : 4 tours. Niv. 5 : 5 tours et un cyclone d\'acier reste derrière toi.');
  Q.variant(CLS, 'tourbillon', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, mv = canMove(f), lv = ctx.lv;
    const N = (lv >= 5 ? 5 : lv >= 3 ? 4 : 3) + Math.min(2, TR(f, 'ch_tour')), T = 0.3, W = 0.3, R = lv >= 5 ? 4.6 : 4.1, total = W + N * T;
    const yaw0 = ctx.face();
    // anticipation : il lève l'épée, qui s'embrase en lame d'énergie
    ctx.anim('Spellcast_Raise', 1.9, { fade: 0.05 });
    bladeUp(ctx, { len: R - 0.4, grow: 1.6, dur: total + 0.25, color: c, w: 0.42 });
    charge(ctx, W, c, { ringR: R });
    ctx.sfx('magic', { rate: 0.55, g: 0.8 });
    const snd = BR.Audio.loopFx ? BR.Audio.loopFx('wind') : null; if (snd) snd.set(f.kind === 'local' ? 0.2 : 0.1);
    let stopped = false;
    const stopSnd = () => { if (!stopped && snd) { stopped = true; snd.stop(); } };
    // déplacement contrôlé : il avance vers la visée (on peut l'orienter pendant le tourbillon)
    const A = ctx.act({ dur: total + 0.12, vel: new V3(), face: yaw0, update: () => {
      if (!mv || A.t < W) { A.vel.set(0, 0, 0); return; }
      const aim = aimOf(ctx), dx = aim.x - f.pos.x, dz = aim.z - f.pos.z, dl = Math.hypot(dx, dz);
      if (dl > 1.2) { A.vel.set(dx / dl * 7.5, 0, dz / dl * 7.5); A.face = Math.atan2(dx, dz); } else A.vel.set(0, 0, 0);
    } });
    const finale = () => {
      stopSnd();
      if (!f.alive) return;
      const p = f.pos.clone().setY(0);
      ctx.anim('1H_Melee_Attack_Chop', 2.2, { fade: 0.04 });
      fx.flash(p.clone().setY(1), { color: c, r: 2.6, life: 0.3, intensity: 7 });
      fx.flash(p.clone().setY(1), { color: 0xffffff, r: 1.4, life: 0.15, light: false, bright: 4 });
      fx.slash(p.clone().setY(0.9), Math.random() * TAU, { r: R * 1.6, arc: 6.25, inner: 0.82, color: c, life: 0.4, sweep: 0.1 });
      shock(ctx, p, R + 4, c, 1.4);
      cracks(ctx, p, 7, R + 1, c, 1.2);
      ctx.sfx('boom', { rate: 1.3, g: 0.9, len: 0.7 }); ctx.sfx('swingBig', { rate: 0.6, g: 1.2 });
      ctx.shake(0.5); kick(ctx, 8);
      const h = ctx.hitSphere(p.clone().setY(1), R + 2.5, ctx.dmg(180), { launch: 9, kb: 12, stun: 0.7, posture: 2.5 });
      if (h.length) ctx.hitstop(0.08);
      if (lv >= 5 || TR(f, 'ch_cyclone')) steelCyclone(ctx, p, c);
    };
    for (let i = 0; i < N; i++) ctx.later(W + i * T, () => {
      if (!f.alive) { stopSnd(); return; }
      ctx.anim('2H_Melee_Attack_Spin', 3.2, { fade: 0.03 });
      if (snd && !stopped) snd.set((f.kind === 'local' ? 0.6 : 0.3) + i * 0.1);
      ctx.sfx('swingBig', { rate: 0.85 + i * 0.08 }); ctx.sfx('swing', { rate: 1.5 + i * 0.1, g: 0.7 });
      const p = f.pos.clone().setY(1.0), y = Math.random() * TAU, tl = (i % 2 ? 1 : -1) * 0.14;
      fx.slash(p, y, { r: R, arc: 6.2, inner: 0.7, tilt: tl, color: c, life: 0.3, sweep: T * 0.8 });
      fx.slash(p, y + 0.4, { r: R * 0.92, arc: 6.2, inner: 0.9, tilt: -tl, color: 0xffffff, life: 0.22, sweep: T * 0.7 });
      fx.ring(p.clone().setY(0.06), { r0: R * 0.5, r1: R + 0.6, color: c, life: 0.3, width: 0.15 });
      for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; fx.spark(new V3(p.x + Math.sin(a) * R * 0.9, 1 + rnd(-0.2, 0.2), p.z + Math.cos(a) * R * 0.9), new V3(Math.cos(a) * 9, rnd(0, 2), -Math.sin(a) * 9), { color: k % 3 ? c : 0xffffff, life: 0.3, size: 0.3, size1: 0.04, drag: 2 }); }
      suck(ctx, p, R + 3, c, 14);
      const h = ctx.hitSphere(p, R + 0.3, ctx.dmg(90), { kb: -4, stun: 0.15, posture: 0.8 });
      if (h.length) { ctx.hitstop(0.035); ctx.shake(0.12); }
      if (i === N - 1) ctx.later(T * 0.6, finale);
    });
    ctx.later(total + 0.6, stopSnd);     // sécurité (sort interrompu)
  });

  /* ---------- BOND : saut écrasant ---------- */
  Q.setName(CLS, 'bond', 'Saut écrasant', 'Bond jusqu\'à la zone visée, épée géante brandie, et t\'écrases au sol : onde qui projette et étourdit. Niv. 3 : une onde sismique s\'étend ensuite. Niv. 5 : des lames de lumière jaillissent du sol en étoile.');
  Q.variant(CLS, 'bond', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, mv = canMove(f), lv = ctx.lv;
    const start = f.pos.clone().setY(0), end = ctx.clampAim(15), yaw = ctx.face(), W = 0.16, D = 0.55, HT = 6.5;
    // anticipation : il plie les genoux, la poussière se soulève, la zone d'impact s'affiche
    ctx.anim('Jump_Start', 1.4, { fade: 0.05 });
    charge(ctx, W, c, { snd: false, ringR: 1.6 });
    fx.decal(end, 'circle', { r: 4.8, color: c, dur: W + D, hold: 0.15, world: false });
    fx.burst(start.clone().setY(0.1), { n: 14, color: 0x6a6058, kind: 'smoke', speed: 4, up: 0.3, life: 0.6, size: 0.7, size1: 1.5, grav: -0.3 });
    ctx.sfx('charge', { len: 0.25, g: 0.4 });
    bladeUp(ctx, { len: 3.4, grow: 1.7, dur: W + D + 0.35, color: c, w: 0.5 });
    const A = ctx.act({ dur: W + D, face: yaw, float: true, vel: new V3(), update: (t) => {
      if (t < W) return;
      const k = Math.min(1, (t - W) / D);
      if (mv) { f.pos.x = start.x + (end.x - start.x) * k; f.pos.z = start.z + (end.z - start.z) * k; f.pos.y = Math.sin(k * Math.PI) * HT * (1 - 0.25 * k); f.vel.set(0, 0, 0); }
      H.afterimage(ctx, f, c);
      if (k > 0.55 && !A.plunge) { A.plunge = 1; ctx.anim('1H_Melee_Attack_Chop', 1.8, { fade: 0.05 }); ctx.sfx('swingBig', { rate: 0.6, g: 1.2 }); }
    } });
    ctx.later(W, () => {
      ctx.anim('Jump_Full_Long', 1.6, { fade: 0.04 }); ctx.sfx('jump'); ctx.sfx('dash', { rate: 0.7 });
      f.inv = Math.max(f.inv, D * 0.8);
      fx.ring(start.clone(), { r0: 0.3, r1: 3, color: c, life: 0.35, width: 0.3 });
    });
    ctx.later(W + D, () => {
      if (!f.alive) return;
      if (mv) { f.pos.y = 0; f.vel.y = 0; ctx.confine(); }
      const p = (mv ? f.pos.clone() : end.clone()).setY(0);
      H.impact(ctx, p.clone().setY(0.5), c, 1.5, { pillar: true });
      cracks(ctx, p, 8, 5.5, c, 1.5); shock(ctx, p, 6, c, 1.2);
      fx.slash(p.clone().setY(1.2), yaw, { r: 3.6, arc: 1.6, tilt: Math.PI / 2, color: 0xffffff, life: 0.3, inner: 0.6 });
      ctx.sfx('stomp', { g: 1 }); ctx.hitstop(0.1); kick(ctx, 10);
      ctx.hitSphere(p.clone().setY(1), 4.8, ctx.dmg(260), { launch: 9, kb: 7, stun: 0.6, posture: 3 });
      // arbre : 4 épées spectrales tombent autour de l'impact
      if (TR(f, 'ch_bond')) for (let i = 0; i < 4; i++) { const a = yaw + Math.PI / 4 + i / 4 * TAU; skySword(ctx, p.clone().add(new V3(Math.sin(a) * 3.4, 0, Math.cos(a) * 3.4)), 0.08 + i * 0.09, 90); }
      // niveau 3 : l'onde sismique s'étend
      if (lv >= 3) ctx.later(0.22, () => {
        fx.ring(p.clone().setY(0.08), { r0: 4, r1: 9.5, color: c, life: 0.5, width: 0.12 });
        fx.burst(p.clone().setY(0.2), { n: 40, color: 0x6a5e54, kind: 'smoke', speed: 16, up: 0.15, life: 0.8, size: 0.8, size1: 1.6, flat: true, alpha: 0.7, drag: 2 });
        if (fx.debris) fx.debris(p, { n: 14, r: 6, speed: 7, size: 0.3 });
        ctx.sfx('stomp', { g: 0.7 }); ctx.shake(0.3);
        ctx.hitSphere(p.clone().setY(1), 9.5, ctx.dmg(100), { stun: 0.5, kb: 6, posture: 1.5 });
      });
      // niveau 5 : étoile de lames qui jaillissent du sol
      if (lv >= 5) ctx.later(0.12, () => {
        for (let i = 0; i < 6; i++) {
          const a = yaw + i / 6 * TAU, dir = new V3(Math.sin(a), 0, Math.cos(a)), pts = [];
          for (let s = 1.5; s <= 8; s += 1.1) pts.push(p.clone().addScaledVector(dir, s));
          spikes(ctx, pts, c, 2.2, 0.9);
          ctx.hitLine(p.clone().setY(1), p.clone().addScaledVector(dir, 8.5).setY(1), 1.2, ctx.dmg(70), { launch: 6, posture: 1 });
        }
        ctx.sfx('ice', { g: 0.6 }); ctx.sfx('swingBig', { rate: 1.3 });
      });
    });
  });

  /* ---------- GARDE : posture de bouclier + contre-attaque automatique ---------- */
  Q.setName(CLS, 'garde', 'Garde du bastion', 'Lève ton bouclier : tout coup reçu est annulé et déclenche une riposte (ralenti, onde qui repousse et étourdit, taille géante). Sans attaque, coup de bouclier à la fin. Niv. 3 : 2 ripostes, garde plus longue. Niv. 5 : la riposte renvoie 8 lames de lumière.');
  Q.variant(CLS, 'garde', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, tg = TR(f, 'ch_garde') ? 1 : 0, dur = (lv >= 5 ? 1.8 : lv >= 3 ? 1.6 : 1.3) + 0.4 * tg;
    let left = (lv >= 3 ? 2 : 1) + tg, countered = 0, ended = false, flash = 0;
    const yaw = ctx.face();
    ctx.anim('Block', 1.8, { fade: 0.04 });
    const A = ctx.act({ dur, face: yaw, vel: new V3() });
    ctx.every(dur, 0.45, (i) => { if (i > 0 && !countered && f.action === A && f.alive) ctx.anim('Blocking', 1, { fade: 0.08 }); });
    ctx.sfx('block', { g: 1 }); ctx.sfx('magic', { rate: 0.5, g: 0.7 }); ctx.shake(0.1);
    const sh = shieldOf(f); if (sh) pump(ctx, sh.obj, 1.7, dur);
    // bulle de garde (fresnel) + pavois de lumière devant toi
    const bm = H.shellMat(c, 2.2, 1), bub = mesh(G.sph, bm);
    const hexM = glow(c, 1.6, 0.25), hex = mesh(G.hex, hexM), rim = mesh(G.hexRim, glow(0xffffff, 2.2, 0.8));
    const grp = new THREE.Group(); grp.add(bub, hex, rim);
    fx.add(grp, dur, (k, g, dt, t) => {
      const cc = f.center();
      bub.position.copy(cc); bub.scale.setScalar(1.35 + Math.sin(t * 9) * 0.04 + flash * 0.5);
      bm.uniforms.uTime.value = t; bm.uniforms.uA.value = (0.75 + flash) * Math.min(1, t * 8, (dur - t) * 6);
      hex.position.copy(cc).addScaledVector(f.fwd(), 1.05); hex.rotation.set(0, f.yaw, 0); hex.scale.setScalar(1.05 + flash * 0.6);
      rim.position.copy(hex.position); rim.rotation.copy(hex.rotation); rim.scale.copy(hex.scale);
      hexM.opacity = 0.25 + flash * 0.6;
      flash = Math.max(0, flash - dt * 4);
      if (Math.random() < dt * 20) fx.spark(hex.position.clone().add(new V3(rnd(-0.8, 0.8), rnd(-0.8, 0.8), rnd(-0.8, 0.8))), new V3(0, 1, 0), { color: c, life: 0.3, size: 0.25 });
    });
    // riposte (déclenchée par le moteur quand un coup arrive : f.counter)
    function riposte(src) {
      if (!f.alive) return;
      const p = f.pos.clone().setY(0), cc = f.center();
      let tp = null;
      if (src && src.pos) tp = src.pos.clone(); else { const t = ctx.nearest(f.pos, 16); if (t) tp = t.pos.clone(); }
      const yy = tp ? Math.atan2(tp.x - p.x, tp.z - p.z) : f.yaw;
      f.yaw = yy;
      ctx.slowmo(0.6); ctx.hitstop(0.12); kick(ctx, 14); banner(ctx, 'CONTRE !');
      if (isLocal(ctx) && ctx.S.flash) ctx.S.flash.setRGB(0.35, 0.35, 0.42);
      ctx.sfx('parry', { g: 1.2 }); ctx.sfx('perfect', { g: 0.8 }); ctx.sfx('boom', { rate: 1.5, g: 0.7, len: 0.6 });
      ctx.anim('Block_Attack', 2.2, { fade: 0.03 });
      ctx.act({ dur: 0.45, face: yy, vel: new V3() });
      fx.flash(cc, { color: 0xffffff, r: 2.8, life: 0.25, intensity: 8, bright: 4 });
      fx.flash(cc, { color: c, r: 4.5, life: 0.4, intensity: 6 });
      shock(ctx, p, 7.5, c, 1.6);
      fx.ring(cc, { r0: 0.4, r1: 5, color: 0xffffff, life: 0.35, width: 0.2, tilt: Math.PI / 2, rotY: yy });
      ctx.hitSphere(cc, 7, ctx.dmg(200), { kb: 12, launch: 6, stun: 1.0, posture: 4 });
      netBoom(ctx, cc, 7, c);
      // la lame grandit et fauche devant
      bladeUp(ctx, { len: 4.2, grow: 1.8, dur: 0.55, color: c, w: 0.5 });
      ctx.later(0.12, () => {
        const q = f.center().addScaledVector(f.fwd(), 0.6);
        fx.slash(q, yy, { r: 5, arc: 2.4, tilt: 0.35, color: c, life: 0.34, inner: 0.45 });
        fx.slash(q, yy, { r: 4.6, arc: 2.4, tilt: 0.35, color: 0xffffff, life: 0.24, inner: 0.85 });
        ctx.sfx('swingBig', { rate: 0.8, g: 1.2 }); ctx.shake(0.45);
        const h = ctx.hitCone(f.pos, yy, 5.5, 2.4, ctx.dmg(160), { crit: true, posture: 3, kb: 8 });
        if (h.length) ctx.hitstop(0.08);
      });
      // niveau 5 : la parade renvoie l'énergie en 8 lames de lumière
      if (lv >= 5) ctx.later(0.18, () => {
        const o = f.center();
        for (let i = 0; i < 8; i++) { const a = yy + i / 8 * TAU, b = o.clone().add(new V3(Math.sin(a) * 9, 0, Math.cos(a) * 9)); cutLine(ctx, o, b, c, 0.3, 0.35); ctx.hitLine(o, b, 1.2, ctx.dmg(60), { stun: 0.3 }); }
        ctx.sfx('zap', { g: 0.8 }); ctx.sfx('swing', { rate: 2.2 });
        f.energy = Math.min(100, (f.energy || 0) + 20);
      });
    }
    const ctr = { t: dur, trigger: (src) => {
      countered++; left--; flash = 1;
      f.inv = Math.max(f.inv || 0, 0.7);
      if (left <= 0 && f.counter === ctr) f.counter = null;
      ctx.later(0, () => riposte(src));     // hors de la boucle de dégâts du moteur
    } };
    f.counter = ctr;
    // coup de bouclier si personne n'a frappé : la garde n'est jamais inutile
    function bash() {
      if (!f.alive) return;
      const q = f.pos.clone().addScaledVector(f.fwd(), 1.4).setY(0);
      ctx.anim('Block_Attack', 1.8, { fade: 0.04 });
      ctx.sfx('block', { g: 1 }); ctx.sfx('stomp', { g: 0.6 });
      shock(ctx, q, 4.5, c, 0.9); fx.flash(q.clone().setY(1), { color: c, r: 1.6, life: 0.2, intensity: 5 });
      ctx.shake(0.25);
      ctx.hitSphere(q.clone().setY(1), 4.2, ctx.dmg(120), { kb: 9, stun: 0.45, posture: 2 });
    }
    ctx.later(dur, () => { if (f.counter === ctr) f.counter = null; if (!ended) { ended = true; if (!countered) bash(); } });
  });

  /* ---------- ULTIME DE DÉPART : lame céleste ---------- */
  // une épée de lumière colossale se dresse dans les mains du chevalier puis s'abat le long de la ligne visée
  function cleave(ctx, p0, yaw, L, tH, k, main) {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, dir = new V3(Math.sin(yaw), 0, Math.cos(yaw));
    const len = L / 0.88, piv = new THREE.Group(), s = H.swordMesh(c, len, 3.2);
    const halo = mesh(G.blade, glow(c, 2, 0.35)); halo.rotation.x = Math.PI; halo.scale.set(len * 0.16, len * 0.9, len * 0.16); s.add(halo);
    piv.add(s); piv.position.copy(p0).addScaledVector(dir, 0.6).setY(2.2); piv.rotation.y = yaw;
    s.rotation.x = Math.PI; s.scale.setScalar(0.01);
    const rise = tH - 0.22;
    fx.add(piv, tH + 0.8, (kk, g, dt, t) => {
      if (t < rise) {
        const e = Math.min(1, t / Math.max(0.1, rise - 0.1)); s.scale.setScalar(k * (0.05 + 0.95 * (1 - (1 - e) * (1 - e)))); s.rotation.x = Math.PI;
        if (Math.random() < dt * 50) { const h = rnd(0.5, L); fx.spark(piv.position.clone().add(new V3(rnd(-0.6, 0.6), h * k, rnd(-0.6, 0.6))), new V3(0, rnd(3, 8), 0), { color: c, life: 0.4, size: 0.5, size1: 0.05 }); }
      } else if (t < tH) {
        const e = (t - rise) / 0.22; s.scale.setScalar(k); s.rotation.x = Math.PI + (Math.PI / 2 + 0.12) * e * e * e;
      } else {
        const e = Math.min(1, (t - tH) / 0.8); s.rotation.x = Math.PI * 1.5 + 0.12; s.material.opacity = 1 - e; halo.material.opacity = 0.35 * (1 - e);
      }
      if (t < tH) halo.material.opacity = 0.3 + 0.15 * Math.sin(t * 20);
    });
    ctx.later(tH, () => {
      const tip = p0.clone().addScaledVector(dir, L), a = p0.clone().setY(1), b = tip.clone().setY(1);
      ctx.hitstop(main ? 0.16 : 0.08); ctx.shake(main ? 1.1 : 0.6); kick(ctx, main ? 16 : 8);
      ctx.sfx('boom', { len: 1.6, g: main ? 1.2 : 0.7 }); ctx.sfx('swingBig', { rate: 0.4, g: 1.6 });
      fx.flash(p0.clone().lerp(tip, 0.5).setY(1), { color: c, r: 6 * k, life: 0.4, intensity: 10 });
      for (let s2 = 1.5; s2 <= L; s2 += 1.5) {
        const q = p0.clone().addScaledVector(dir, s2);
        ctx.later(s2 * 0.012, () => { fx.pillar(q, { color: c, r: 0.7 * k, h: 9 * k, life: 0.5, grow: 0.8 }); fx.burst(q.clone().setY(0.3), { n: 8, color: c, speed: 7, up: 1, life: 0.5 }); fx.burst(q.clone().setY(0.1), { n: 4, color: 0x6a5e54, kind: 'smoke', speed: 4, up: 0.4, life: 0.8, size: 1, size1: 2, grav: -0.3, alpha: 0.6 }); });
      }
      cutLine(ctx, p0.clone().setY(0.08), tip.clone().setY(0.08), c, 1.2 * k, 1.0);
      H.impact(ctx, tip.clone().setY(0.8), c, 2.2 * k, { pillar: true });
      cracks(ctx, tip, 9, 6 * k, c, 1.8);
      ctx.hitLine(a, b, 3.4 * k, ctx.dmg(1500) * (main ? 1 : 0.35), { launch: 12, kb: 10, posture: 6, stun: lv >= 3 ? 2 : 0.5 });
      ctx.hitSphere(b, 6 * k, ctx.dmg(400) * (main ? 1 : 0.35), { launch: 10, posture: 3 });
      // niveau 3 (ou arbre « faille ») : la faille de lumière continue de brûler
      const rift = TR(f, 'ch_u_faille') > 0;
      if ((lv >= 3 || rift) && main) ctx.zone({ pos: p0.clone(), life: rift ? 6 : 3, iv: 0.5, onTick: () => {
        ctx.hitLine(a, b, 2.2, ctx.dmg(60), {});
        for (let j = 0; j < 8; j++) fx.spark(a.clone().lerp(b, Math.random()).setY(0.1), new V3(rnd(-0.5, 0.5), rnd(2, 5), rnd(-0.5, 0.5)), { color: c, life: 0.6, size: 0.5, size1: 0.05 });
      } });
    });
  }
  Q.setName(CLS, 'u_lame', 'Lame céleste', 'La foudre du ciel frappe ton épée, qui devient une lame de lumière colossale ; tu l\'abats sur 18 m devant toi. Niv. 3 : étourdit 2 s et laisse une faille brûlante. Niv. 5 : deux autres lames célestes s\'abattent en éventail.');
  Q.variant(CLS, 'u_lame', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, d = ctx.dirToAim(), yaw = Math.atan2(d.x, d.z), p0 = f.pos.clone().setY(0), L = 18;
    ctx.act({ dur: lv >= 5 ? 1.75 : 1.45, face: yaw, vel: new V3() });
    ctx.slowmo(1.3); f.inv = Math.max(f.inv, 1.3);
    ctx.anim('Spellcast_Raise', 1.1, { fade: 0.05 });
    ctx.sfx('charge', { len: 0.9 }); ctx.sfx('roar', { rate: 1.7, g: 0.35 });
    fx.pillar(p0, { color: c, r: 1.1, h: 50, life: 0.9, grow: -0.6, alpha: 0.7 });
    for (let i = 0; i < 3; i++) ctx.later(i * 0.12, () => {
      const tp = tipOf(f);
      fx.bolt(tp.clone().add(new V3(rnd(-3, 3), 26, rnd(-3, 3))), tp, { color: c, life: 0.25, jitter: 1 });
      fx.flash(tp, { color: 0xffffff, r: 1.2, life: 0.15, light: false });
      ctx.sfx('zap', { g: 0.8 });
    });
    bladeUp(ctx, { len: 2.6, grow: 1.8, dur: 1.5, color: c, w: 0.45 });
    ctx.later(0.72, () => { ctx.anim('1H_Melee_Attack_Chop', 1.3, { fade: 0.05 }); });
    cleave(ctx, p0, yaw, L, 0.95, 1, true);
    const fan = TR(f, 'ch_u_lame') > 0;
    if (lv >= 5 || fan) {
      const side = new V3(d.z, 0, -d.x);
      cleave(ctx, p0.clone().addScaledVector(side, 2.5), yaw + 0.5, L * 0.85, 1.25, 0.75, false);
      cleave(ctx, p0.clone().addScaledVector(side, -2.5), yaw - 0.5, L * 0.85, 1.45, 0.75, false);
      // arbre « éventail » au niveau 5 : deux lames de plus, plus ouvertes
      if (lv >= 5 && fan) {
        cleave(ctx, p0.clone().addScaledVector(side, 4), yaw + 1, L * 0.7, 1.6, 0.6, false);
        cleave(ctx, p0.clone().addScaledVector(side, -4), yaw - 1, L * 0.7, 1.75, 0.6, false);
      }
    }
  });

  /* =====================================================================
     AUTRES POUVOIRS
     ===================================================================== */

  /* ---------- ONDE : frappe sismique ---------- */
  Q.setName(CLS, 'onde', 'Frappe sismique', 'Tu plantes ton épée dans le sol : une onde de choc fissure le sol, projette et étourdit tout autour. Niv. 3 : onde plus large et des pics de lumière jaillissent des fissures. Niv. 5 : trois ondes successives.');
  Q.variant(CLS, 'onde', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, R = lv >= 3 ? 8.4 : 6, yaw = ctx.face();
    ctx.anim('1H_Melee_Attack_Chop', 1.5, { fade: 0.05 }); ctx.act({ dur: lv >= 5 ? 1.0 : 0.55, face: yaw, vel: new V3() });
    charge(ctx, 0.26, c, { ringR: R * 0.5 }); bladeUp(ctx, { len: 2.6, grow: 1.5, dur: lv >= 5 ? 1.1 : 0.6, color: c, w: 0.4 });
    ctx.later(0.16, () => ctx.sfx('swingBig', { rate: 0.7 }));
    const wave = (i) => ctx.later(0.28 + i * 0.3, () => {
      if (!f.alive) return;
      const p = f.pos.clone().setY(0), q = p.clone().addScaledVector(f.fwd(), 1.2), rr = R + i * 2.5, k = 1 + i * 0.25;
      H.impact(ctx, q.clone().setY(0.4), c, 1.1 * k, {});
      cracks(ctx, q, 9, rr * 0.75, c, 1.4);
      shock(ctx, p, rr, c, k);
      if (i === 0) ctx.hitstop(0.07);
      ctx.hitSphere(p.clone().setY(1), rr, ctx.dmg(220) * (i ? 0.6 : 1), { launch: 8, kb: 8, stun: 0.5, posture: 3 });
      if (lv >= 3) ctx.later(0.25, () => {
        const pts = [];
        for (let j = 0; j < 14; j++) { const a = Math.random() * TAU, r = rnd(1.5, rr * 0.85); pts.push(new V3(q.x + Math.sin(a) * r, 0, q.z + Math.cos(a) * r)); }
        spikes(ctx, pts, c, 1.8, 0.8); ctx.sfx('ice', { g: 0.5 });
        ctx.hitSphere(p.clone().setY(1), rr * 0.85, ctx.dmg(70), { launch: 5, posture: 1 });
      });
    });
    wave(0); if (lv >= 5) { wave(1); wave(2); }
  });

  /* ---------- TRAITS : lames volantes ---------- */
  Q.setName(CLS, 'traits', 'Lames volantes', 'Trois épées spectrales apparaissent derrière toi et fondent sur ta cible (5 au niveau 3). Niv. 5 : chaque épée explose en croix à l\'impact.');
  Q.variant(CLS, 'traits', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 3 ? 5 : 3, W = 0.24, yaw = ctx.face();
    ctx.anim('Spellcast_Raise', 2, { fade: 0.05 }); ctx.act({ dur: W + 0.25, face: yaw, vel: new V3() });
    ctx.sfx('magic', { rate: 0.8 }); ctx.sfx('charge', { len: W, g: 0.35 });
    const side = new V3(Math.cos(yaw), 0, -Math.sin(yaw)), back = new V3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(-0.6);
    const slot = i => { const u = i - (n - 1) / 2; return f.pos.clone().addScaledVector(side, u * 0.9).add(back).setY(f.pos.y + 2.5 - Math.abs(u) * 0.3); };
    for (let i = 0; i < n; i++) {
      const s = H.swordMesh(c, 1.5, 2.8); s.rotation.order = 'YXZ';
      fx.add(s, W + 0.02, (k, o, dt, t) => { const e = Math.min(1, t / 0.12); o.position.copy(slot(i)).add(new V3(0, (1 - e) * -0.8, 0)); o.rotation.set(-Math.PI / 2, f.yaw, 0); o.scale.setScalar(Math.max(0.01, e)); o.material.opacity = e; });
      fx.flash(slot(i), { color: c, r: 0.5, life: 0.15, light: false });
    }
    for (let i = 0; i < n; i++) ctx.later(W + i * 0.06, () => {
      if (i === 0) ctx.anim('1H_Melee_Attack_Slice_Horizontal', 2.2, { fade: 0.03 });
      const from = slot(i), tg = ctx.lockTarget();
      const to = tg ? tg.pos.clone() : ctx.aim.clone().setY(Math.max(1, ctx.aim.y));
      const dir = to.sub(from); if (dir.lengthSq() < 0.01) dir.copy(f.fwd()); dir.normalize();
      const m = swordProj(c, 1.5);
      ctx.sfx('swing', { rate: 1.4 + i * 0.12 }); fx.flash(from, { color: c, r: 0.6, life: 0.12, light: false });
      ctx.proj({ pos: from, vel: dir.multiplyScalar(32), r: 0.6, dmg: ctx.dmg(95), life: 2, size: 0.7, homing: 8, mesh: m, posture: 0.8,
        onHit: (p) => {
          const q = p.pos.clone();
          fx.slash(q, Math.random() * TAU, { r: 1.4, arc: 1.6, tilt: 0.8, color: c, life: 0.18 }); fx.burst(q, { n: 14, color: c, speed: 8, life: 0.3 });
          if (lv >= 5) { fx.slash(q, Math.random() * TAU, { r: 2.2, arc: 2, tilt: -0.8, color: 0xffffff, life: 0.22, flip: true }); fx.flash(q, { color: c, r: 1.2, life: 0.18 }); ctx.hitSphere(q, 2.2, ctx.dmg(35), { stun: 0.2 }); }
        },
        onEnd: () => disposeTree(m) });
    });
  });

  /* ---------- CHAÎNE : lame foudroyante ---------- */
  Q.setName(CLS, 'chaine', 'Lame foudroyante', 'Ton épée se charge de foudre puis tu fends en avant : l\'éclair jaillit de la pointe et saute sur 4 ennemis (7 au niveau 3) en les étourdissant. Niv. 5 : la foudre du ciel achève la dernière cible.');
  Q.variant(CLS, 'chaine', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 3 ? 7 : 4, W = 0.2, d = ctx.dirToAim(), yaw = Math.atan2(d.x, d.z);
    ctx.anim('Block', 2, { fade: 0.05 });
    const A = ctx.act({ dur: W + 0.3, face: yaw, vel: new V3(), update: (t) => { A.vel.copy(d).multiplyScalar(t > W && t < W + 0.16 ? 16 : 0); } });
    bladeUp(ctx, { len: 1.9, grow: 1.3, dur: W + 0.4, color: c, w: 0.3 });
    ctx.sfx('zap', { g: 0.4 }); ctx.sfx('charge', { len: W, g: 0.4 });
    ctx.every(W, 0.04, () => { const tp = tipOf(f); fx.bolt(tp, tp.clone().add(new V3(rnd(-1.2, 1.2), rnd(-0.6, 1.2), rnd(-1.2, 1.2))), { color: c, life: 0.07, light: false, segs: 4, jitter: 0.8 }); });
    ctx.later(W, () => { ctx.anim('1H_Melee_Attack_Stab', 2.2, { fade: 0.03 }); ctx.sfx('swing', { rate: 1.6 }); });
    ctx.later(W + 0.12, () => {
      if (!f.alive) return;
      const from0 = tipOf(f);
      let from = from0, cur = ctx.nearest(f.pos.clone().addScaledVector(d, 3), 7);
      fx.flash(from0, { color: 0xffffff, r: 0.8, life: 0.15 }); ctx.shake(0.2);
      if (!cur) {    // personne devant : la foudre frappe le sol devant toi
        const p = f.pos.clone().addScaledVector(d, 7).setY(0);
        zap(ctx, from0, p.clone().setY(0.2), c); puff(ctx, p.clone().setY(0.4), c, 1.2); fx.ring(p.clone().setY(0.05), { r1: 3, color: c, life: 0.3 });
        ctx.sfx('zap', { g: 0.8 }); ctx.hitSphere(p.clone().setY(1), 3, ctx.dmg(140), { stun: 0.3 });
        return;
      }
      const seen = new Set(); let last = null, steps = 0;
      for (let i = 0; i < n && cur; i++) {
        const tgt = cur, a = from.clone(), b = tgt.pos.clone(), k = i;
        ctx.later(k * 0.07, () => {
          zap(ctx, a, b, c); puff(ctx, b, c, 0.7);
          ctx.hitTarget(tgt, ctx.dmg(240) * (k ? 0.7 : 1) * (lv >= 5 ? 1 + 0.15 * k : 1), { stun: 0.25, posture: 0.6 });
          ctx.sfx('zap', { g: 0.6, rate: 1 + k * 0.1 });
          if (k === 0) ctx.hitstop(0.05);
        });
        seen.add(gk(tgt)); from = b; last = tgt; steps++;
        cur = nearSort(ctx.enemies().filter(e => !seen.has(gk(e))), from)[0];
        if (cur && cur.pos.distanceTo(from) > 12) cur = null;
      }
      if (lv >= 5 && last) { const lt = last; ctx.later(steps * 0.07 + 0.1, () => {
        const p = lt.pos.clone();
        H.strike(ctx, p.clone().add(new V3(rnd(-1, 1), 18, rnd(-1, 1))), p, c, { r: 1.6 });
        fx.ring(new V3(p.x, 0.05, p.z), { r1: 3, color: c, life: 0.3 }); ctx.shake(0.3);
        ctx.hitSphere(p, 2.6, ctx.dmg(160), { stun: 0.5 });
      }); }
    });
  });

  /* ---------- LANCE : charge glaciale au bouclier ---------- */
  Q.setName(CLS, 'lance', 'Charge glaciale', 'Bouclier en avant, tu charges sur 10 m dans un sillage de givre : chaque ennemi percuté est gelé et repoussé. Niv. 3 : explosion de glace à l\'arrivée. Niv. 5 : le sillage de glace se brise et gèle à nouveau.');
  Q.variant(CLS, 'lance', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, d = ctx.dirToAim(), yaw = Math.atan2(d.x, d.z), W = 0.18, D = 0.42, SP = 26, ICE = 0xcff6ff;
    ctx.anim('Block', 1.8, { fade: 0.05 });
    const sh = shieldOf(f); if (sh) pump(ctx, sh.obj, 1.6, W + D + 0.2);
    ctx.sfx('ice', { g: 0.7 });
    charge(ctx, W, c, { snd: false, at: () => f.center().addScaledVector(f.fwd(), 0.7), r: 0.5 });
    fx.burst(f.pos.clone().setY(0.2), { n: 16, color: ICE, kind: 'smoke', speed: 3, up: 0.3, life: 0.6, size: 0.6, size1: 1.2, grav: -0.2, alpha: 0.6 });
    const hit = new Set(); let p0 = null;
    // sillage de pics de glace (un seul matériau pour tout le sillage)
    const grp = new THREE.Group(), sm = new THREE.MeshStandardMaterial({ color: C(0xbfefff), emissive: C(c), emissiveIntensity: 1.3, roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true });
    const spk = [], LIFE = W + D + 2.2;
    fx.add(grp, LIFE, (k, g, dt, t) => {
      sm.opacity = t > LIFE - 0.6 ? Math.max(0, (LIFE - t) / 0.6) : 1;
      spk.forEach(s => { const u = s.userData; u.e = Math.min(1, u.e + dt * 9); s.scale.set(u.w, Math.max(0.01, u.h * u.e), u.w); });
    });
    const A = ctx.act({ dur: W + D + 0.1, face: yaw, vel: new V3(), update: (t, dt) => {
      if (t < W) return;
      if (t >= W + D) { A.vel.set(0, 0, 0); return; }
      if (!p0) { p0 = f.pos.clone(); f.inv = Math.max(f.inv, D); ctx.anim('1H_Melee_Attack_Stab', 1.2, { fade: 0.04 }); ctx.sfx('dash', { g: 1.1 }); ctx.sfx('ice', { rate: 1.2 }); kick(ctx, 9); }
      A.vel.copy(d).multiplyScalar(SP);
      if (Math.random() < dt * 30) { const s = mesh(G.spike, sm); s.position.set(f.pos.x + rnd(-0.8, 0.8), 0, f.pos.z + rnd(-0.8, 0.8)); s.rotation.set(rnd(-0.4, 0.4), Math.random() * TAU, rnd(-0.4, 0.4)); s.userData = { e: 0, w: rnd(0.8, 1.4), h: rnd(0.8, 1.8) }; s.scale.set(1, 0.01, 1); grp.add(s); spk.push(s); }
      fx.burst(f.center().addScaledVector(d, 0.9), { n: 3, color: ICE, speed: 6, life: 0.3, dir: d.clone().negate(), spread: 0.8 });
      // percussion : chaque ennemi touché par le bouclier
      const front = f.pos.clone().addScaledVector(d, 1.1).setY(1);
      for (const e of ctx.enemies()) {
        const key = gk(e); if (hit.has(key) || e.pos.distanceTo(front) > e.r + 1.9) continue;
        hit.add(key);
        ctx.hitTarget(e, ctx.dmg(300), { freeze: 1.4, kb: 10, posture: 2 });
        fx.burst(e.pos, { n: 24, color: ICE, speed: 10, life: 0.45, size: 0.35, grav: 12 });
        ctx.sfx('hit', { rate: 0.8, g: 0.8 }); ctx.sfx('ice', { g: 0.5 }); ctx.hitstop(0.05); ctx.shake(0.2);
      }
    } });
    ctx.later(W + D, () => {
      if (!f.alive) return;
      const p = f.pos.clone().setY(0), a = (p0 || p).clone().setY(1), b = p.clone().setY(1);
      if (lv >= 3) { puff(ctx, p.clone().setY(0.6), ICE, 1.6); shock(ctx, p, 4, c, 0.9); ctx.sfx('ice', { g: 1 }); ctx.sfx('boom', { rate: 1.6, g: 0.5, len: 0.5 }); ctx.hitSphere(f.center(), 4, ctx.dmg(140), { freeze: 1.2, kb: 6 }); ctx.shake(0.3); }
      if (lv >= 5) ctx.later(0.6, () => {
        cutLine(ctx, a, b, ICE, 0.6, 0.5);
        for (let i = 0; i <= 12; i++) fx.burst(a.clone().lerp(b, i / 12), { n: 5, color: ICE, speed: 7, up: 1, life: 0.5, size: 0.3 });
        ctx.sfx('ice', { g: 0.9, rate: 0.8 }); ctx.sfx('break', { g: 0.3 });
        ctx.hitLine(a, b, 2, ctx.dmg(120), { freeze: 1.2 });
      });
    });
  });

  /* ---------- OMBRE : forme d'ombre, coup dans le dos ---------- */
  Q.setName(CLS, 'ombre', 'Pas de l\'ombre', 'Tu te fonds dans l\'ombre et réapparais dans le dos de ta cible pour un coup critique en croix qui l\'étourdit. Niv. 3 : ton ombre reste en leurre puis explose. Niv. 5 : enchaîne sur une 2e cible.');
  Q.variant(CLS, 'ombre', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, mv = canMove(f), SH = 0x1a0a2a;
    const hide = (dt) => { if (!f.group) return; f.group.visible = false; ctx.later(dt, () => { if (f.group) f.group.visible = true; }); };
    const decoy = (pos, yw) => {
      let img = null;
      try { img = ctx.fighter({ id: 'leurre', look: f.av && f.av.look, kind: 'summon', ghost: '#6a30c0' }); } catch (e) { img = null; }
      if (img) { img.pos.copy(pos).setY(0); img.yaw = yw; try { img.play('Idle'); } catch (e) { /* animation absente */ } fx.add(new THREE.Object3D(), 1.6, (k, o, dt) => { try { img.update(dt, { speed: 0 }); } catch (e) { /* rien */ } }); }
      ctx.later(1.6, () => {
        const q = pos.clone().setY(1);
        fx.burst(q, { n: 30, color: SH, kind: 'smoke', speed: 5, life: 0.8, size: 1, size1: 2, grav: -1, alpha: 0.85 });
        fx.flash(q, { color: c, r: 2, life: 0.25, intensity: 5 }); fx.ring(pos.clone().setY(0.05), { r1: 3.4, color: c, life: 0.35 });
        ctx.sfx('boom', { rate: 1.8, g: 0.5, len: 0.4 });
        ctx.hitSphere(q, 3.2, ctx.dmg(120), { stun: 0.4 });
        if (img) img.dispose();
      });
    };
    const hop = (delay, n, exclude) => ctx.later(delay, () => {
      if (!f.alive) return;
      let t = null;
      if (n === 0) t = ctx.lockTarget();
      else t = nearSort(ctx.enemies().filter(e => gk(e) !== exclude && e.pos.distanceTo(f.pos) < 16), f.pos)[0] || null;
      if (n > 0 && !t) return;
      const before = f.pos.clone().setY(0), bc = f.center();
      // anticipation : il se fond dans une volute d'ombre
      ctx.anim('Block', 2.4, { fade: 0.04 }); ctx.act({ dur: 0.5, face: f.yaw, vel: new V3() });
      fx.burst(bc, { n: 26, color: SH, kind: 'smoke', speed: 3, life: 0.7, size: 1, size1: 1.8, grav: -1, alpha: 0.85 });
      suck(ctx, before, 2.5, c, 10);
      ctx.sfx('dash', { rate: 0.6 }); ctx.sfx('magic', { rate: 0.4, g: 0.6 });
      if (n === 0 && lv >= 3) decoy(before, f.yaw);
      ctx.later(0.12, () => {
        if (!f.alive) return;
        let dst, ty;
        if (t) { const away = f.pos.clone().sub(t.pos).setY(0); if (away.lengthSq() < 0.01) away.copy(f.fwd()).negate(); away.normalize(); dst = t.pos.clone().addScaledVector(away, -((t.r || 0.8) + 1.3)); dst.y = 0; ty = Math.atan2(t.pos.x - dst.x, t.pos.z - dst.z); }
        else { const d = ctx.dirToAim(); dst = f.pos.clone().addScaledVector(d, 7).setY(0); ty = Math.atan2(d.x, d.z); }
        fx.burst(f.center(), { n: 20, color: c, speed: 8, life: 0.35 });
        hide(0.1);
        if (mv) { f.pos.copy(dst); f.vel.set(0, 0, 0); ctx.confine(); }
        f.yaw = ty; f.inv = Math.max(f.inv, 0.4);
        ctx.act({ dur: 0.38, face: ty, vel: new V3() });
        for (let i = 0; i <= 8; i++) fx.spark(bc.clone().lerp(dst.clone().setY(1), i / 8), new V3(0, 0.6, 0), { kind: 'smoke', color: SH, life: 0.6, size: 0.9, size1: 1.5, alpha: 0.8 });
        ctx.later(0.1, () => {
          if (!f.alive) return;
          const here = (mv ? f.pos : dst).clone();
          fx.burst(here.clone().setY(1), { n: 24, color: SH, kind: 'smoke', speed: 4, life: 0.7, size: 1, size1: 1.8, grav: -1, alpha: 0.85 });
          ctx.anim('1H_Melee_Attack_Slice_Diagonal', 2.4, { fade: 0.03 });
          const fw = new V3(Math.sin(ty), 0, Math.cos(ty)), p = t ? t.pos.clone() : here.clone().setY(1).addScaledVector(fw, 1.5);
          fx.slash(p, ty, { r: 2.8, arc: 2.2, tilt: 0.8, color: c, life: 0.28 }); fx.slash(p, ty, { r: 2.8, arc: 2.2, tilt: -0.8, color: 0xffffff, life: 0.28, flip: true });
          fx.flash(p, { color: c, r: 1.4, life: 0.2, intensity: 5 }); ctx.sfx('crit', { g: 1 }); ctx.sfx('swing', { rate: 1.8 });
          if (t) { ctx.hitstop(0.1); ctx.shake(0.35); ctx.hitTarget(t, ctx.dmg(380), { crit: true, posture: 2, stun: 0.5 }); }
          else ctx.hitSphere(p, 2.4, ctx.dmg(200), { stun: 0.3 });
          if (lv >= 5 && n === 0 && t) hop(0.3, 1, gk(t));
        });
      });
    });
    hop(0, 0, null);
  });

  /* ---------- TORNADE : ouragan d'acier ---------- */
  Q.setName(CLS, 'tornade', 'Ouragan d\'acier', 'Pendant 3 s, 6 épées tournoient autour de toi au cœur d\'une tornade : tu cours plus vite, elles hachent et aspirent tout ce qui t\'approche. Niv. 3 : 8 épées, rayon plus grand. Niv. 5 : à la fin, les épées partent seules sur les ennemis.');
  Q.variant(CLS, 'tornade', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, dur = lv >= 3 ? 3.5 : 3, n = lv >= 3 ? 8 : 6, R = lv >= 3 ? 3.3 : 2.7;
    ctx.anim('2H_Melee_Attack_Spinning', 1.6, { fade: 0.05 }); ctx.sfx('swingBig', { rate: 0.7 }); ctx.sfx('magic', { rate: 0.6, g: 0.6 });
    ctx.buff('haste', 1, dur);
    bladeUp(ctx, { len: 1.8, grow: 1.3, dur, color: c, w: 0.3 });
    fx.ring(f.pos.clone(), { r0: 0.5, r1: R + 2, color: c, life: 0.35, width: 0.25 });
    const grp = new THREE.Group(), fm = glow(c, 1.3, 0.22), fun = mesh(G.funnel, fm); fun.scale.set(R + 0.6, 6, R + 0.6); grp.add(fun);
    const blades = [];
    for (let i = 0; i < n; i++) { const s = H.swordMesh(c, 1.5, 2.6); s.rotation.order = 'YXZ'; grp.add(s); blades.push(s); }
    const snd = BR.Audio.loopFx ? BR.Audio.loopFx('wind') : null; if (snd) snd.set(f.kind === 'local' ? 0.8 : 0.4);
    let ang = 0;
    fx.add(grp, dur, (k, g, dt, t) => {
      g.position.set(f.pos.x, f.pos.y, f.pos.z);
      const a = Math.min(1, t * 5, (dur - t) * 4); ang += dt * 7;
      fun.rotation.y += dt * 10; fm.opacity = 0.22 * a; fun.scale.y = 6 * (0.3 + 0.7 * Math.min(1, t * 3));
      blades.forEach((s, i) => { const an = ang + i / n * TAU, r = R * (0.5 + 0.5 * Math.min(1, t * 4)); s.position.set(Math.sin(an) * r, 1.1 + Math.sin(t * 5 + i) * 0.35, Math.cos(an) * r); s.rotation.set(Math.PI / 2, an - Math.PI / 2, 0); s.material.opacity = a; });
      for (let j = 0; j < 2; j++) { const an = Math.random() * TAU, r = rnd(0.6, R + 1); fx.spark(new V3(f.pos.x + Math.sin(an) * r, rnd(0.2, 5.5), f.pos.z + Math.cos(an) * r), new V3(Math.cos(an) * 9, 2.5, -Math.sin(an) * 9), { color: j ? c : 0xffffff, life: 0.35, size: 0.28 }); }
    }, false, () => { if (snd) snd.stop(); });
    ctx.every(dur, 0.25, (i) => {
      if (!f.alive) return;
      const h = ctx.hitSphere(f.center(), R + 0.8, ctx.dmg(55), { kb: -3, posture: 0.5 });
      if (h.length && i % 2 === 0) ctx.sfx('hit', { rate: 1.6, g: 0.4 });
      if (i % 3 === 0) { ctx.sfx('swing', { rate: 1.3, g: 0.5 }); suck(ctx, f.pos, R + 3, c, 6); }
    });
    ctx.every(dur, 0.6, () => { if (f.alive && !f.action) ctx.anim('2H_Melee_Attack_Spinning', 1.6, { fade: 0.08 }); });
    if (lv >= 5) ctx.later(dur - 0.05, () => {
      if (!f.alive) return;
      const list = nearSort(ctx.enemies(), f.pos).slice(0, n);
      for (let i = 0; i < n; i++) {
        const an = ang + i / n * TAU, from = f.center().add(new V3(Math.sin(an) * R, 0.2, Math.cos(an) * R)), tg = list.length ? list[i % list.length] : null;
        const dir = tg ? tg.pos.clone().sub(from).normalize() : new V3(Math.sin(an), 0.05, Math.cos(an));
        const m = swordProj(c, 1.5);
        ctx.proj({ pos: from, vel: dir.multiplyScalar(34), r: 0.6, dmg: ctx.dmg(80), life: 1.4, homing: tg ? 6 : 0, mesh: m, onEnd: () => disposeTree(m) });
      }
      ctx.sfx('swingBig', { rate: 1.3 }); fx.ring(f.pos.clone(), { r1: R + 3, color: c, life: 0.35 });
    });
  });

  /* ---------- SOIN : serment du protecteur ---------- */
  Q.setName(CLS, 'soin', 'Serment du protecteur', 'Tu plantes une épée sacrée : pendant 5 s, les alliés dans le cercle regagnent 30 % de leur vie et subissent 20 % de dégâts en moins. Niv. 3 : 45 % et l\'épée repousse les ennemis qui approchent. Niv. 5 : relève les alliés à terre dans le cercle.');
  Q.variant(CLS, 'soin', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, pct = lv >= 3 ? 0.45 : 0.3, R = 5, dur = 5;
    const p = f.pos.clone().setY(0).addScaledVector(f.fwd(), 0.8);
    ctx.anim('1H_Melee_Attack_Chop', 1.4, { fade: 0.05 }); ctx.act({ dur: 0.5, vel: new V3() });
    ctx.sfx('charge', { len: 0.3, g: 0.4 });
    // l'épée sacrée tombe du ciel et se plante
    const s = H.swordMesh(c, 3.2, 2.6); s.rotation.y = Math.random() * TAU;
    fx.add(s, dur + 0.4, (k, o, dt, t) => {
      const e = Math.min(1, t / 0.22); o.position.set(p.x, 2.2 + (1 - e * e) * 12, p.z);
      o.material.opacity = t > dur ? Math.max(0, 1 - (t - dur) / 0.4) : 1;
      if (Math.random() < dt * 12) fx.spark(o.position.clone().add(new V3(rnd(-0.3, 0.3), rnd(-2, 1), rnd(-0.3, 0.3))), new V3(0, rnd(1, 3), 0), { color: c, life: 0.6, size: 0.35, size1: 0.05 });
    });
    ctx.later(0.22, () => {
      fx.flash(p.clone().setY(1), { color: c, r: 2.2, life: 0.3, intensity: 6 });
      shock(ctx, p, R, c, 0.8); fx.pillar(p, { color: c, r: R, h: 10, life: 0.8, grow: 0.1, alpha: 0.4 });
      ctx.sfx('block', { g: 0.8 }); ctx.sfx('heal'); ctx.shake(0.2);
    });
    fx.decal(p, 'ring', { r: R, inner: 0.9, color: c, dur: 0.3, hold: dur - 0.3, world: false });
    ctx.zone({ pos: p, life: dur, iv: 0.5, onTick: z => {
      for (const a of ctx.allies()) if (a.pos.distanceTo(z.pos) < R + 0.4) { ctx.heal(a, a.maxHp * pct / 10); a.buff.sanct = 1; a.buff.sanctT = 0.6; }
      if (lv >= 3 && Math.round(z.t * 2) % 2 === 0) { ctx.hitSphere(z.pos.clone().setY(1), R, ctx.dmg(40), { kb: 8, stun: 0.3 }); fx.ring(z.pos.clone().setY(0.08), { r0: 1, r1: R, color: c, life: 0.35, width: 0.15 }); }
      if (lv >= 5) for (const a of ctx.S.fighters.values()) {
        if (a.team !== f.team || a.alive || a.kind !== 'local' || a.pos.distanceTo(z.pos) > R + 0.4) continue;
        try { if (ctx.S.asc && BR.Arena.ascTools) BR.Arena.ascTools().revive(a, 0.5); else { a.alive = true; a.down = false; a.hp = a.maxHp * 0.5; a.play('Lie_StandUp', 1.5); } } catch (e) { /* rien */ }
      }
      for (let k = 0; k < 8; k++) { const a = Math.random() * TAU, r = Math.random() * R; fx.spark(z.pos.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new V3(0, rnd(2, 5), 0), { color: c, life: 0.9, size: 0.45, size1: 0.05 }); }
    } });
  });

  /* ---------- PLUIE : pluie d'épées ---------- */
  Q.setName(CLS, 'pluie', 'Pluie d\'épées', 'Tu lèves ton épée : 14 épées spectrales s\'abattent sur la zone visée (24 au niveau 3, elles ralentissent). Niv. 5 : les épées plantées explosent ensuite.');
  Q.variant(CLS, 'pluie', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, center = ctx.clampAim(18), n = lv >= 3 ? 24 : 14, R = 4.6;
    ctx.anim('Spellcast_Raise', 1.6, { fade: 0.05 }); ctx.act({ dur: 0.45, face: ctx.face(), vel: new V3() });
    ctx.sfx('magic', { rate: 0.7 }); ctx.sfx('charge', { len: 0.4, g: 0.4 });
    bladeUp(ctx, { len: 1.8, grow: 1.3, dur: 0.6, color: c });
    ctx.later(0.15, () => { const tp = tipOf(f); fx.bolt(tp, tp.clone().add(new V3(0, 20, 0)), { color: c, life: 0.3, jitter: 0.3 }); fx.flash(tp, { color: c, r: 0.8, life: 0.2 }); });
    fx.decal(center, 'circle', { r: R, color: c, dur: 0.5, hold: 1.4, world: false });
    const portal = mesh(G.disc, glow(c, 1.6, 0)); portal.position.set(center.x, 16, center.z);
    fx.add(portal, 1.9, (k, o, dt, t) => { o.scale.setScalar(R * 1.2 * Math.max(0.01, Math.min(1, t * 4))); o.material.opacity = 0.45 * Math.min(1, t * 4, (1.9 - t) * 3); o.rotation.y += dt; });
    const hold = lv >= 5 ? 1.2 : lv >= 3 ? 0.9 : 0.5;
    for (let i = 0; i < n; i++) ctx.later(0.3 + i * (1.2 / n), () => {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (R - 0.3), p = center.clone().add(new V3(Math.cos(a) * r, 0, Math.sin(a) * r));
      const s = H.swordMesh(c, 2.6, 2.8); s.rotation.set(rnd(-0.12, 0.12), Math.random() * TAU, rnd(-0.12, 0.12));
      fx.add(s, 0.16 + hold, (k, o, dt, t) => {
        if (t < 0.16) o.position.set(p.x, 16 - (t / 0.16) * 14, p.z);
        else {
          o.position.set(p.x, 2.0, p.z);
          if (!o.userData.hit) { o.userData.hit = 1; fx.burst(p.clone().setY(0.2), { n: 12, color: c, speed: 8, life: 0.35, up: 0.5 }); fx.ring(p.clone().setY(0.05), { r1: 1.9, color: c, life: 0.25 }); fx.burst(p.clone().setY(0.1), { n: 4, color: 0x6a5e54, kind: 'smoke', speed: 3, up: 0.4, life: 0.6, size: 0.6, size1: 1.2, grav: -0.3, alpha: 0.6 }); }
        }
        o.material.opacity = Math.min(1, (1 - k) * 5);
      });
      ctx.later(0.16, () => {
        ctx.sfx('hit', { g: 0.35, rate: 1.4 + Math.random() * 0.3 }); if (i % 3 === 0) ctx.shake(0.08);
        ctx.hitSphere(p.clone().setY(1), 1.9, ctx.dmg(55), { freeze: lv >= 3 ? 0.4 : 0, posture: 0.5 });
      });
      if (lv >= 5) ctx.later(0.16 + hold, () => { fx.flash(p.clone().setY(1), { color: c, r: 1.4, life: 0.2 }); fx.ring(p.clone().setY(0.05), { r1: 2.4, color: 0xffffff, life: 0.25 }); ctx.sfx('boom', { rate: 2, g: 0.2, len: 0.3 }); ctx.hitSphere(p.clone().setY(1), 2.2, ctx.dmg(45), {}); });
    });
  });

  /* ---------- FANTÔMES : lames gardiennes ---------- */
  Q.setName(CLS, 'fantomes', 'Lames gardiennes', '6 épées spectrales gravitent autour de toi pendant 8 s et partent seules frapper l\'ennemi le plus proche, puis reviennent (10 au niveau 3). Niv. 5 : elles explosent en croix à l\'impact.');
  Q.variant(CLS, 'fantomes', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 3 ? 10 : 6, dur = 8;
    ctx.anim('Spellcast_Raise', 1.6); ctx.sfx('magic', { rate: 0.8 }); ctx.sfx('swingBig', { rate: 1.4, g: 0.6 });
    fx.flash(f.center(), { color: c, r: 1.6, life: 0.25 }); fx.ring(f.pos.clone(), { r1: 3, color: c, life: 0.35 });
    const B = [], grp = new THREE.Group();
    for (let i = 0; i < n; i++) { const s = H.swordMesh(c, 1.2, 2.4); s.rotation.order = 'YXZ'; grp.add(s); B.push({ m: s, back: 0, pop: 0 }); }
    fx.add(grp, dur, (k, g, dt, t) => {
      g.position.set(f.pos.x, f.pos.y + 1.5, f.pos.z); g.visible = f.alive;
      const a = Math.min(1, t * 4, (dur - t) * 3);
      B.forEach((b, i) => {
        const an = t * 2.4 + i / n * TAU;
        b.m.position.set(Math.sin(an) * 1.7, Math.sin(t * 3 + i) * 0.25, Math.cos(an) * 1.7); b.m.rotation.set(Math.PI, an, 0);
        if (b.back > 0) { b.back -= dt; b.m.visible = false; if (b.back <= 0) { b.m.visible = true; b.pop = 0.25; fx.spark(b.m.getWorldPosition(new V3()), new V3(0, 1, 0), { color: c, life: 0.3, size: 0.6 }); } }
        b.pop = Math.max(0, b.pop - dt); b.m.scale.setScalar(1 + b.pop * 2); b.m.material.opacity = a;
      });
    });
    let next = 0.4;
    ctx.every(dur, 0.1, () => {
      if (!f.alive) return;
      next -= 0.1; if (next > 0) return;
      const tg = ctx.nearest(f.pos, 14), i = B.findIndex(b => b.back <= 0);
      if (!tg || i < 0) return;
      next = lv >= 3 ? 0.32 : 0.42;
      const b = B[i]; b.back = 0.9;
      const from = b.m.getWorldPosition(new V3()), m = swordProj(c, 1.2);
      ctx.sfx('swing', { rate: 1.6, g: 0.5 }); fx.flash(from, { color: c, r: 0.5, life: 0.12, light: false });
      ctx.proj({ pos: from, vel: tg.pos.clone().sub(from).normalize().multiplyScalar(34), r: 0.55, dmg: ctx.dmg(85), life: 1.2, homing: 10, mesh: m,
        onHit: (p) => { const q = p.pos.clone(); fx.burst(q, { n: 10, color: c, speed: 8, life: 0.3 }); if (lv >= 5) { fx.slash(q, Math.random() * TAU, { r: 1.8, arc: 1.8, tilt: 0.8, color: c, life: 0.2 }); fx.slash(q, Math.random() * TAU, { r: 1.8, arc: 1.8, tilt: -0.8, color: 0xffffff, life: 0.2, flip: true }); ctx.hitSphere(q, 2, ctx.dmg(40), {}); } },
        onEnd: () => disposeTree(m) });
    });
  });

  /* ---------- CLONE : écuyer spectral ---------- */
  Q.setName(CLS, 'clone', 'Écuyer spectral', 'Un double spectral de toi surgit dans une onde qui étourdit les ennemis proches, puis copie tes attaques et tes pouvoirs pendant 7 s. Niv. 3 : il frappe plus fort. Niv. 5 : deux doubles.');
  Q.variant(CLS, 'clone', (ctx, orig) => {
    const { f, fx } = ctx, c = ctx.color, p = f.pos.clone().setY(0);
    orig(ctx);
    ctx.later(0.05, () => { ctx.anim('Block_Attack', 1.8, { fade: 0.04 }); });
    fx.flash(f.center(), { color: c, r: 2.2, life: 0.3, intensity: 6 }); fx.pillar(p, { color: c, r: 1.4, h: 10, life: 0.5 });
    shock(ctx, p, 5, c, 1);
    ctx.sfx('block'); ctx.sfx('boom', { rate: 1.6, g: 0.5, len: 0.5 }); ctx.shake(0.3);
    ctx.hitSphere(p.clone().setY(1), 5, ctx.dmg(120), { stun: 0.7, kb: 8, posture: 1.5 });
  });

  /* ---------- GRAVITÉ : lame du néant ---------- */
  Q.setName(CLS, 'gravite', 'Lame du néant', 'Tu lances une épée de ténèbres qui se plante là où tu vises et ouvre une faille : elle aspire les ennemis 4 s puis implose. Niv. 3 : implosion doublée. Niv. 5 : l\'implosion étourdit.');
  Q.variant(CLS, 'gravite', (ctx, orig) => {
    const { f, fx } = ctx, c = ctx.color, p = ctx.clampAim(14), yaw = ctx.face(), T = 0.32;
    ctx.anim('Throw', 1.5, { fade: 0.05 }); ctx.act({ dur: 0.5, face: yaw, vel: new V3() });
    ctx.sfx('swingBig', { rate: 0.6 }); charge(ctx, 0.18, c, { snd: false });
    ctx.later(0.18, () => {
      const from = f.center().add(new V3(0, 0.8, 0)), to = p.clone().setY(1.0);
      const s = H.swordMesh(c, 3, 3); s.rotation.order = 'YXZ';
      fx.add(s, T + 4.2, (k, o, dt, t) => {
        if (t < T) { const e = t / T; o.position.lerpVectors(from, to, e); o.position.y += Math.sin(e * Math.PI) * 3; o.rotation.set(t * 25, yaw, 0); fx.spark(o.position, new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)), { color: c, life: 0.3, size: 0.4 }); }
        else { o.position.set(p.x, 2.3 - Math.min(1, (t - T) / 4), p.z); o.rotation.set(0, yaw + (t - T) * 0.6, 0); o.material.opacity = Math.min(1, (T + 4.2 - t) * 3); }
      });
    });
    ctx.later(0.18 + T, () => {
      ctx.sfx('stomp', { g: 0.7 }); fx.flash(p.clone().setY(1.2), { color: c, r: 2, life: 0.25, intensity: 6 }); cracks(ctx, p, 6, 3.5, c, 4);
      orig(FXH.atPoint ? FXH.atPoint(ctx, p) : ctx);
    });
  });

  /* ---------- DRAGON : lame du dragon (forme de flamme) ---------- */
  Q.setName(CLS, 'dragon', 'Lame du dragon', 'Ta lame s\'embrase puis tu tranches vers le haut : un dragon de feu jaillit et fonce sur 30 m en brûlant tout sur son passage. Niv. 3 : il laisse une traînée de flammes. Niv. 5 : il revient vers toi.');
  Q.variant(CLS, 'dragon', (ctx, orig) => {
    const { f, fx } = ctx, W = 0.25, fc = ctx.color || '#ff6a3d', yaw = ctx.face();
    ctx.anim('Block', 1.8, { fade: 0.05 }); ctx.act({ dur: W, face: yaw, vel: new V3() });
    bladeUp(ctx, { len: 2.4, grow: 1.5, dur: W + 0.6, color: fc, w: 0.45 });
    ctx.sfx('fire', { len: 0.6, g: 0.8 }); ctx.sfx('charge', { len: W, g: 0.4 });
    ctx.every(W, 0.03, () => { const tp = tipOf(f), base = f.center(); for (let j = 0; j < 3; j++) fx.spark(base.clone().lerp(tp, Math.random()), new V3(rnd(-0.5, 0.5), rnd(2, 4), rnd(-0.5, 0.5)), { color: j % 2 ? fc : 0xffd060, life: 0.4, size: 0.5, size1: 0.1 }); });
    ctx.later(W, () => {
      if (!f.alive) return;
      orig(ctx);     // le dragon de feu (dégâts, traînée au niv. 3, retour au niv. 5)
      ctx.anim('1H_Melee_Attack_Slice_Diagonal', 2.2, { fade: 0.03 });
      const q = f.center().addScaledVector(f.fwd(), 0.8);
      fx.slash(q, f.yaw, { r: 3.2, arc: 2.4, tilt: 1.2, color: fc, life: 0.3, inner: 0.45 }); fx.slash(q, f.yaw, { r: 3, arc: 2.4, tilt: 1.2, color: 0xffd060, life: 0.22, inner: 0.85 });
      fx.burst(q, { n: 30, color: fc, speed: 10, life: 0.4 }); ctx.sfx('swingBig', { rate: 0.8 }); ctx.shake(0.3); kick(ctx, 8);
    });
  });

  /* ---------- CONTRE : riposte foudroyante ---------- */
  Q.setName(CLS, 'contre', 'Riposte foudroyante', 'Posture de contre (0,9 s) : si un coup arrive, tu l\'esquives et lacères l\'agresseur de 8 coups éclair au ralenti (12 au niveau 3). Sinon, tu termines par un estoc. Niv. 5 : la dernière taille projette et recharge ton ultime.');
  Q.variant(CLS, 'contre', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, hits = lv >= 3 ? 12 : 8, dur = lv >= 3 ? 1.2 : 0.9, mv = canMove(f);
    let done = false;
    const yaw = ctx.face();
    ctx.anim('Block', 1.4, { fade: 0.04 }); ctx.sfx('magic', { rate: 0.4 }); ctx.sfx('block', { g: 0.6 });
    ctx.act({ dur, face: yaw, vel: new V3() });
    bladeUp(ctx, { len: 1.6, grow: 1.25, dur, color: c, w: 0.3 });
    const am = H.shellMat(0xffffff, 1.5, 0.8), aura = mesh(G.sph, am);
    const it = fx.add(aura, dur, (k, o, dt, t) => { o.position.copy(f.center()); o.scale.setScalar(1.15 + Math.sin(t * 25) * 0.05); am.uniforms.uTime.value = t; am.uniforms.uA.value = 0.8 * Math.min(1, t * 10); if (Math.random() < dt * 25) fx.spark(tipOf(f), new V3(rnd(-1, 1), rnd(0, 2), rnd(-1, 1)), { color: c, life: 0.25, size: 0.25 }); });
    function thrust() {
      if (!f.alive) return;
      const d = f.fwd();
      ctx.anim('1H_Melee_Attack_Stab', 2, { fade: 0.03 }); ctx.act({ dur: 0.3, face: f.yaw, vel: d.clone().multiplyScalar(14) }); ctx.sfx('swing', { rate: 1.3 });
      ctx.later(0.12, () => { const a = f.center(), b = a.clone().addScaledVector(d, 4); cutLine(ctx, a, b, c, 0.3, 0.25); fx.flash(b, { color: c, r: 0.9, life: 0.15 }); ctx.hitLine(a, b, 1.3, ctx.dmg(110), { kb: 5, posture: 1 }); });
    }
    function flurry() {
      if (!f.alive) return;
      const t0 = ctx.nearest(f.pos, 14);
      ctx.slowmo(1.1); ctx.hitstop(0.1); kick(ctx, 12); banner(ctx, 'RIPOSTE !');
      ctx.sfx('parry', { g: 1.2 }); ctx.sfx('crit', { g: 0.8 });
      fx.flash(f.center(), { color: 0xffffff, r: 2.4, life: 0.22, intensity: 7, bright: 4 });
      if (!t0) { thrust(); return; }
      const key = gk(t0), tpos = () => { const e = ctx.enemies().find(x => gk(x) === key); return (e || t0).pos.clone(); };
      ctx.act({ dur: hits * 0.07 + 0.35, vel: new V3(), float: true, face: f.yaw });
      for (let i = 0; i < hits; i++) ctx.later(i * 0.07, () => {
        if (!f.alive) return;
        const tp = tpos(), a = i * 2.4 + rnd(-0.3, 0.3), r = (t0.r || 0.8) + 1.3, p = new V3(tp.x + Math.cos(a) * r, 0, tp.z + Math.sin(a) * r);
        const prev = f.center();
        if (mv) { f.pos.copy(p); f.vel.set(0, 0, 0); }
        f.yaw = Math.atan2(tp.x - p.x, tp.z - p.z);
        fx.bolt(prev, p.clone().setY(1.05), { color: c, life: 0.12, jitter: 0.25, light: false });
        ctx.anim(i % 2 ? H.atkAnim(f) : H.slashAnim(f), 3, { fade: 0.02 });
        fx.slash(tp, f.yaw + rnd(-0.5, 0.5), { r: 2.4, arc: 2.4, tilt: rnd(-1.2, 1.2), color: i % 2 ? c : 0xffffff, life: 0.18 });
        H.afterimage(ctx, f, c); ctx.sfx('hit', { rate: 1 + i * 0.05, g: 0.6 }); ctx.sfx('swing', { rate: 1.8 + i * 0.05, g: 0.4 });
        ctx.hitTarget(t0, ctx.dmg(110), { crit: i === hits - 1, stun: 0.2 });
      });
      ctx.later(hits * 0.07 + 0.05, () => {
        if (!f.alive) return;
        const tp = tpos();
        ctx.anim('1H_Melee_Attack_Chop', 2, { fade: 0.03 });
        fx.slash(tp, f.yaw, { r: 3.6, arc: 2, tilt: 0.8, color: c, life: 0.3, inner: 0.7 }); fx.slash(tp, f.yaw, { r: 3.6, arc: 2, tilt: -0.8, color: 0xffffff, life: 0.3, inner: 0.7, flip: true });
        shock(ctx, tp.clone().setY(0), 4, c, 1); ctx.sfx('crit', { g: 1 }); ctx.sfx('boom', { rate: 1.6, g: 0.6, len: 0.5 }); ctx.shake(0.45); ctx.hitstop(0.08);
        ctx.hitSphere(tp, 3.5, ctx.dmg(150), { crit: true, posture: 3, launch: lv >= 5 ? 10 : 4, kb: lv >= 5 ? 10 : 4 });
        if (lv >= 5) f.ult = Math.min(100, (f.ult || 0) + 25);
      });
    }
    const ctr = { t: dur, trigger: () => {
      if (done) return; done = true;
      f.inv = Math.max(f.inv || 0, hits * 0.07 + 0.6);
      if (f.counter === ctr) f.counter = null;
      fx.kill(it);
      ctx.later(0, flurry);       // hors de la boucle de dégâts du moteur
    } };
    f.counter = ctr;
    ctx.later(dur, () => { if (f.counter === ctr) f.counter = null; if (!done) { done = true; thrust(); } });
  });

  /* ---------- TEMPÊTE : forme orageuse ---------- */
  Q.setName(CLS, 'tempete', 'Forme orageuse', 'La foudre te frappe et tu deviens une nuée d\'orage noire pendant 6 s : bien plus rapide, tes coups foudroient, tes esquives deviennent des téléportations éclairs et des arcs frappent les ennemis proches. Niv. 3 : 8 s, arcs plus fréquents. Niv. 5 : tu te décharges en une nova de foudre à la fin.');
  Q.variant(CLS, 'tempete', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, dur = lv >= 3 ? 8 : 6, SM = 0x14121e, T0 = 0.3;
    ctx.anim('Spellcast_Raise', 1.6, { fade: 0.05 }); ctx.act({ dur: 0.45, vel: new V3() });
    ctx.sfx('charge', { len: 0.5 });
    charge(ctx, T0, c, { snd: false, ringR: 3 });
    // la nuée qui enveloppe le chevalier
    const cloud = () => {
      const grp = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: C(0x18141f), transparent: true, opacity: 0, depthWrite: false }), P = [];
      for (let i = 0; i < 9; i++) { const m = mesh(G.ico, mat); m.userData = { a: i / 9 * TAU, h: 0.2 + (i % 3) * 0.75 + Math.random() * 0.3, r: 0.75 + Math.random() * 0.35, s: rnd(0.3, 0.55), w: rnd(2, 4) }; grp.add(m); P.push(m); }
      fx.add(grp, dur, (k, g, dt, t) => {
        if (!f.alive) { g.visible = false; return; }
        g.visible = true; g.position.set(f.pos.x, f.pos.y, f.pos.z); mat.opacity = 0.75 * Math.min(1, t * 4, (dur - t) * 2);
        P.forEach(m => { const u = m.userData, an = u.a + t * u.w; m.position.set(Math.sin(an) * u.r, u.h + Math.sin(t * 3 + u.a) * 0.15, Math.cos(an) * u.r); m.scale.setScalar(u.s * (1 + Math.sin(t * 6 + u.a) * 0.15)); m.rotation.y += dt * 2; });
        if (Math.random() < dt * 30) fx.spark(f.center().add(new V3(rnd(-0.7, 0.7), rnd(-0.9, 0.9), rnd(-0.7, 0.7))), new V3(rnd(-0.6, 0.6), rnd(0.4, 1.4), rnd(-0.6, 0.6)), { kind: 'smoke', color: SM, life: 0.7, size: 0.7, size1: 1.3, alpha: 0.85 });
        if (Math.random() < dt * 9) { const a = f.center().add(new V3(rnd(-0.8, 0.8), rnd(-0.8, 0.9), rnd(-0.8, 0.8))); fx.bolt(a, a.clone().add(new V3(rnd(-1.1, 1.1), rnd(-1.1, 1.1), rnd(-1.1, 1.1))), { color: c, life: 0.08, light: false, segs: 4 }); }
        if (Math.hypot(f.vel.x, f.vel.z) > 6 && Math.random() < dt * 25) fx.spark(f.pos.clone().setY(rnd(0.3, 1.8)), new V3(0, 0.3, 0), { kind: 'smoke', color: SM, life: 0.6, size: 0.9, size1: 1.6, alpha: 0.7 });
      });
    };
    ctx.later(T0, () => {
      if (!f.alive) return;
      const cc = f.center();
      for (let j = 0; j < 5; j++) fx.bolt(cc.clone().add(new V3(rnd(-2.5, 2.5), 20, rnd(-2.5, 2.5))), cc, { color: c, life: 0.3, jitter: 1.2, light: j === 0 });
      fx.flash(cc, { color: 0xffffff, r: 2.5, life: 0.2, intensity: 9, bright: 4 }); fx.flash(cc, { color: c, r: 4, life: 0.4, intensity: 8 });
      shock(ctx, f.pos, 6, c, 1.2);
      fx.burst(cc, { n: 40, color: SM, kind: 'smoke', speed: 7, life: 1, size: 1.2, size1: 2.4, grav: -0.5, alpha: 0.85 });
      ctx.sfx('zap', { g: 1.2 }); ctx.sfx('boom', { rate: 1.4, g: 0.8, len: 0.7 }); ctx.shake(0.5); kick(ctx, 10); ctx.hitstop(0.06);
      ctx.hitSphere(cc, 5.5, ctx.dmg(120), { stun: 0.6, kb: 8, posture: 2 });
      ctx.buff('storm', 1, dur); ctx.buff('haste', 1, dur); f.stormLv = lv;
      bladeUp(ctx, { len: 1.9, grow: 1.35, dur, color: c, w: 0.32 });
      cloud();
      // arcs électriques sur les ennemis proches
      ctx.every(dur, lv >= 3 ? 0.5 : 0.7, () => {
        if (!f.alive) return;
        const t = ctx.nearest(f.pos, 7); if (!t) return;
        zap(ctx, f.center(), t.pos.clone(), c); fx.flash(t.pos, { color: c, r: 0.8, life: 0.15, light: false }); ctx.sfx('zap', { g: 0.35, rate: 1.3 });
        ctx.hitTarget(t, ctx.dmg(60), { stun: 0.15 });
      });
      // niveau 5 : décharge finale
      if (lv >= 5) ctx.later(dur, () => {
        if (!f.alive) return;
        const o = f.center();
        for (let j = 0; j < 8; j++) { const an = j / 8 * TAU; fx.bolt(o, o.clone().add(new V3(Math.sin(an) * 7, -0.8, Math.cos(an) * 7)), { color: c, life: 0.3, light: j === 0 }); }
        for (let j = 0; j < 4; j++) fx.bolt(o.clone().add(new V3(rnd(-2, 2), 22, rnd(-2, 2))), o, { color: c, life: 0.3, light: false });
        H.impact(ctx, o, c, 1.8, { pillar: true });
        ctx.sfx('zap', { g: 1.2 });
        ctx.hitSphere(o, 7, ctx.dmg(300), { stun: 1, kb: 10, posture: 4 });
      });
    });
  });

  /* =====================================================================
     ULTIMES
     ===================================================================== */

  /* ---------- ARRÊT DU TEMPS : instant suspendu ---------- */
  Q.setName(CLS, 'u_temps', 'Instant suspendu', 'Tu figes le temps (4 s, 5 s au niveau 3) : ton épée s\'allonge et tu cours plus vite ; tous tes coups s\'accumulent et explosent quand le temps reprend. Niv. 5 : tes recharges se remettent à zéro.');
  Q.variant(CLS, 'u_temps', (ctx, orig) => {
    const { f, fx } = ctx, c = ctx.color, dur = ctx.lv >= 3 ? 5 : 4;
    orig(ctx);
    bladeUp(ctx, { len: 2.6, grow: 1.6, dur: dur + 0.2, color: c, w: 0.35 });
    ctx.buff('haste', 1, dur);
    fx.ring(f.center(), { r0: 0.3, r1: 6, color: 0xffffff, life: 0.5, width: 0.1, tilt: Math.PI / 2, rotY: f.yaw });
    fx.slash(f.center(), f.yaw, { r: 3, arc: 6.2, inner: 0.9, color: 0xffffff, life: 0.4, tilt: Math.PI / 2 });
    ctx.sfx('parry', { g: 0.8 });
  });

  /* ---------- RAYON : estoc de lumière ---------- */
  Q.setName(CLS, 'u_rayon', 'Estoc de lumière', 'Tu pointes ton épée : elle projette un rayon de lumière continu (3,5 s) qui suit ta visée et traverse tout. Niv. 3 : plus long et plus large. Niv. 5 : explosion finale au bout du rayon.');
  Q.variant(CLS, 'u_rayon', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, dur = lv >= 3 ? 4.5 : 3.5, w = lv >= 3 ? 2.0 : 1.4, CH = 0.5;
    ctx.anim('1H_Melee_Attack_Stab', 0.9, { fade: 0.05 }); ctx.sfx('charge', { len: 0.6 });
    bladeUp(ctx, { len: 2.4, grow: 1.6, dur: dur + CH, color: c, w: 0.45 });
    charge(ctx, CH, c, { snd: false, ringR: 3 });
    ctx.slowmo(0.5);
    const beam = fx.beam({ color: c, width: 0.1 });
    const snd = BR.Audio.loopFx ? BR.Audio.loopFx('beam') : null;
    let tick = 0, alive = true, fired = false;
    const end = new V3();
    const stop = () => { if (!alive) return; alive = false; beam.kill(); if (snd) snd.stop(); };
    ctx.act({ dur: dur + CH, lockMove: true, vel: new V3(), update: (t, dt) => {
      if (!alive) return;
      const aim = aimOf(ctx);
      f.yaw += BR.angDiff(f.yaw, Math.atan2(aim.x - f.pos.x, aim.z - f.pos.z)) * Math.min(1, dt * 8);
      if (t > 0.35 && f.av && f.av.oneShot == null) ctx.anim('1H_Ranged_Aiming', 1, { fade: 0.1 });
      const from = f.center().add(new V3(0, 0.3, 0)).addScaledVector(f.fwd(), 1.3);
      const dir = aim.clone().sub(from); if (dir.lengthSq() < 0.01) dir.copy(f.fwd()); dir.normalize();
      let L = 60; if (dir.y < -0.01) L = Math.min(L, -from.y / dir.y);
      end.copy(from).addScaledVector(dir, L);
      const k = t < CH ? t / CH : 1, ww = t < CH ? 0.12 + k * 0.25 : w * (1 + Math.sin(t * 40) * 0.06);
      beam.set(from, t < CH ? from.clone().addScaledVector(dir, 2.5 * k + 0.1) : end, ww, 1);
      if (snd) snd.set(t < CH ? k * 0.5 : (f.kind === 'local' ? 1 : 0.5));
      for (let j = 0; j < 3; j++) fx.spark(from, new V3(rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)), { color: c, life: 0.22, size: 0.45 });
      if (t >= CH) {
        if (!fired) { fired = true; ctx.sfx('boom', { rate: 1.6, g: 0.8 }); ctx.shake(0.5); fx.flash(from, { color: c, r: 2.2, life: 0.3 }); kick(ctx, 12); }
        ctx.shake(0.05);
        fx.spark(end, new V3(rnd(-8, 8), rnd(2, 10), rnd(-8, 8)), { color: c, life: 0.5, size: 0.6, grav: 12 });
        if (Math.random() < dt * 20) fx.flash(end, { color: c, r: 1.5 * w, life: 0.12, intensity: 4, light: false });
        if (Math.random() < dt * 12) fx.burst(end.clone().setY(0.2), { n: 3, color: 0x6a5e54, kind: 'smoke', speed: 4, up: 0.6, life: 0.7, size: 0.8, size1: 1.6, grav: -0.3, alpha: 0.6 });
        tick -= dt;
        if (tick <= 0) { tick = 0.12; ctx.hitLine(from, end, w * 0.6, ctx.dmg(220) * 0.28 * (1 + (t - CH) * 0.3), { posture: 0.6, kb: 2 }); }
      }
    }, onEnd: () => {
      const wasAlive = alive; stop();
      if (wasAlive && lv >= 5) { H.impact(ctx, end.clone(), c, 2.5, { pillar: true }); ctx.hitSphere(end, 8, ctx.dmg(220) * 6, { launch: 10, posture: 6 }); }
    } });
    ctx.later(dur + CH + 0.25, stop);      // sécurité : rayon coupé si le sort est interrompu
  });

  /* ---------- MILLE LAMES : danse des mille lames ---------- */
  Q.setName(CLS, 'u_lames', 'Danse des mille lames', 'Tu disparais en éclairs autour de ta cible et tailles tout autour d\'elle 14 fois (20 au niveau 3), puis ta lame géante l\'achève d\'une croix de lumière. Niv. 5 : coup final dévastateur.');
  Q.variant(CLS, 'u_lames', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 3 ? 20 : 14, mv = canMove(f), W = 0.25, STEP = 0.075;
    const t0 = ctx.lockTarget();
    ctx.anim('Block', 2, { fade: 0.04 }); charge(ctx, W, c, { ringR: 3 });
    bladeUp(ctx, { len: 2.6, grow: 1.6, dur: W + n * STEP + 1, color: c, w: 0.4 });
    if (!t0) {     // personne : éclatement de lames autour de toi (l'ultime n'est jamais gâché)
      ctx.act({ dur: 0.6, vel: new V3() });
      ctx.later(W, () => {
        const p = f.pos.clone().setY(0);
        ctx.anim('2H_Melee_Attack_Spin', 2.4, { fade: 0.03 });
        fx.slash(p.clone().setY(1), 0, { r: 6, arc: 6.25, inner: 0.7, color: c, life: 0.35 }); shock(ctx, p, 8, c, 1.4);
        ctx.sfx('swingBig', { rate: 0.7 }); ctx.shake(0.5);
        ctx.hitSphere(p.clone().setY(1), 7, ctx.dmg(120) * 4, { launch: 8 });
      });
      return;
    }
    const home = f.pos.clone(), total = W + n * STEP + 0.9, key = gk(t0);
    const tpos = () => { const e = ctx.enemies().find(x => gk(x) === key); return (e || t0).pos.clone(); };
    f.inv = Math.max(f.inv, total + 0.3); ctx.slowmo(total);
    ctx.act({ dur: total, lockMove: true, vel: new V3(), float: true });
    for (let i = 0; i < n; i++) ctx.later(W + i * STEP, () => {
      if (!f.alive) return;
      const tp = tpos(), r0 = (t0.r || 0.8) + 1.6, a = i * 2.39996 + rnd(-0.2, 0.2), h = (i % 3) * 0.8;
      const p = new V3(tp.x + Math.cos(a) * r0, Math.max(0, tp.y - 1 + h), tp.z + Math.sin(a) * r0), prev = f.center();
      if (mv) { f.pos.copy(p); f.vel.set(0, 0, 0); }
      const yy = Math.atan2(tp.x - p.x, tp.z - p.z); f.yaw = yy;
      fx.bolt(prev, p.clone().setY(p.y + 1.05), { color: c, life: 0.15, jitter: 0.3, light: false });
      ctx.anim(i % 2 ? H.slashAnim(f) : H.atkAnim(f), 3.2, { fade: 0.02 });
      fx.slash(tp, yy + Math.PI / 2 * (i % 2), { r: (t0.r || 0.8) + 2.4, arc: 2.6, tilt: rnd(-1.4, 1.4), color: i % 3 ? c : 0xffffff, life: 0.2, inner: 0.75 });
      fx.burst(tp, { n: 10, color: c, speed: 10, life: 0.3 });
      ctx.sfx('hit', { rate: 1.1 + (i % 4) * 0.1, g: 0.7 }); ctx.shake(0.12);
      ctx.hitSphere(tp, (t0.r || 0.8) + 1.8, ctx.dmg(100), { posture: 0.6, stun: 0.15 });
    });
    ctx.later(W + n * STEP + 0.05, () => {
      if (!f.alive) return;
      if (mv) { f.pos.copy(home); f.vel.set(0, 0, 0); ctx.confine(); }
      const tp = tpos(); f.yaw = Math.atan2(tp.x - f.pos.x, tp.z - f.pos.z);
      ctx.anim('1H_Melee_Attack_Chop', 1.6, { fade: 0.04 });
      bladeUp(ctx, { len: 6, grow: 2, dur: 0.8, color: c, w: 0.8 });
      fx.slash(tp, f.yaw, { r: 9, arc: 1.4, tilt: 0.8, color: c, life: 0.5, inner: 0.9, sweep: 0.12 });
      fx.slash(tp, f.yaw, { r: 9, arc: 1.4, tilt: -0.8, color: 0xffffff, life: 0.5, inner: 0.9, sweep: 0.12, flip: true });
      ctx.sfx('swingBig', { rate: 0.5, g: 1.4 });
      ctx.later(0.4, () => {
        H.impact(ctx, tp, c, 2.6, { pillar: true }); ctx.hitstop(0.2); ctx.shake(1.1); kick(ctx, 16);
        ctx.hitSphere(tp, 5, ctx.dmg(120) * (lv >= 5 ? 6 : 3), { crit: true, posture: 8, launch: 10 });
      });
    });
  });

  /* ---------- DOMAINE : bastion souverain ---------- */
  Q.setName(CLS, 'u_domaine', 'Bastion souverain', 'Tu plantes une épée colossale : un dôme de 14 m (9 s) où tes alliés frappent plus fort et se rechargent plus vite et où les ennemis sont ralentis ; l\'épée libère une onde qui repousse toutes les 2 s. Niv. 3 : le dôme blesse les ennemis. Niv. 5 : énergie illimitée dans le dôme.');
  Q.variant(CLS, 'u_domaine', (ctx, orig) => {
    const { f, fx } = ctx, c = ctx.color, dur = 9;
    const p = f.pos.clone().setY(0).addScaledVector(f.fwd(), -1.6), LEN = 9, yR = 0.88 * LEN - 1.5;
    orig(ctx);
    ctx.anim('1H_Melee_Attack_Chop', 1.2, { fade: 0.05 }); ctx.act({ dur: 0.6, vel: new V3() });
    const s = H.swordMesh(c, LEN, 2.6); s.rotation.y = f.yaw + Math.PI / 2;
    fx.add(s, dur, (k, o, dt, t) => {
      const e = Math.min(1, t / 0.3); o.position.set(p.x, yR + (1 - e * e) * 30, p.z);
      o.material.opacity = Math.min(1, (dur - t) * 1.5);
      if (Math.random() < dt * 10) fx.spark(o.position.clone().add(new V3(rnd(-0.5, 0.5), rnd(-4, 2), rnd(-0.5, 0.5))), new V3(0, rnd(1, 3), 0), { color: c, life: 0.8, size: 0.4, size1: 0.05 });
    });
    ctx.later(0.3, () => { H.impact(ctx, p.clone().setY(0.5), c, 2, { pillar: true }); cracks(ctx, p, 10, 7, c, 2.5); ctx.hitstop(0.1); kick(ctx, 10); });
    for (let i = 1; i <= 4; i++) ctx.later(i * 2, () => {
      shock(ctx, p, 9, c, 1); fx.flash(p.clone().setY(3), { color: c, r: 2, life: 0.25, intensity: 4 });
      ctx.sfx('stomp', { g: 0.6 });
      ctx.hitSphere(p.clone().setY(1), 9, ctx.dmg(90), { kb: 10, stun: 0.4, posture: 1 });
    });
  });

  /* ---------- MÉTÉORE : chute du colosse ---------- */
  Q.setName(CLS, 'u_meteore', 'Chute du colosse', 'Tu bondis jusqu\'aux nuages puis t\'abats, lame en avant, comme un météore sur la zone visée : cratère, onde géante et projection. Niv. 3 : le cratère brûle 4 s. Niv. 5 : six répliques explosent autour de l\'impact.');
  Q.variant(CLS, 'u_meteore', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, p = ctx.clampAim(22), p0 = f.pos.clone().setY(0), mv = canMove(f);
    const W = 0.22, UPT = 0.5, HANG = 0.35, FALL = 0.32, TOT = W + UPT + HANG + FALL, HT = 30;
    f.inv = Math.max(f.inv, TOT + 0.4);
    ctx.anim('Jump_Start', 1.2, { fade: 0.05 }); charge(ctx, W, c, { ringR: 2.5 }); ctx.sfx('roar', { rate: 1.6, g: 0.3 });
    bladeUp(ctx, { len: 4, grow: 1.8, dur: TOT + 0.3, color: c, w: 0.55 });
    fx.decal(p, 'circle', { r: 8, color: c, dur: TOT, hold: 0.2, world: false });
    ctx.later(W, () => { ctx.anim('Jump_Full_Long', 1.2, { fade: 0.04 }); ctx.sfx('jump', { g: 1.3 }); ctx.sfx('boom', { rate: 1.8, g: 0.6, len: 0.5 }); shock(ctx, p0, 4, c, 1); kick(ctx, 10); ctx.shake(0.4); });
    ctx.later(W + UPT, () => ctx.slowmo(HANG + FALL));
    ctx.later(W + UPT + HANG - 0.05, () => { ctx.anim('1H_Melee_Attack_Stab', 1.4, { fade: 0.05 }); ctx.sfx('fire', { len: 1, g: 1 }); ctx.sfx('swingBig', { rate: 0.4, g: 1.4 }); });
    ctx.act({ dur: TOT, lockMove: true, float: true, vel: new V3(), face: ctx.face(), update: (t) => {
      let y = 0, u = 0;
      if (t < W) y = 0;
      else if (t < W + UPT) { const e = (t - W) / UPT; y = HT * (1 - (1 - e) * (1 - e)); }
      else if (t < W + UPT + HANG) { y = HT; u = 0.15 * (t - W - UPT) / HANG; }
      else {
        const e = Math.min(1, (t - W - UPT - HANG) / FALL); y = HT * (1 - e * e); u = 0.15 + 0.85 * e;
        for (let j = 0; j < 4; j++) fx.spark(f.center(), new V3(rnd(-2, 2), 6, rnd(-2, 2)), { color: j % 2 ? c : 0xffcc66, life: 0.5, size: 1.1, size1: 0.1 });
      }
      if (mv) { f.pos.set(p0.x + (p.x - p0.x) * u, y, p0.z + (p.z - p0.z) * u); f.vel.set(0, 0, 0); }
    } });
    ctx.later(TOT, () => {
      if (!f.alive) return;
      if (mv) { f.pos.set(p.x, 0, p.z); f.vel.set(0, 0, 0); ctx.confine(); }
      ctx.anim('Jump_Land', 1.2, { fade: 0.04 });
      H.impact(ctx, p.clone().setY(1), c, 3.2, { pillar: true });
      fx.ring(p, { r1: 16, color: 0xffd080, life: 0.9, width: 0.06 });
      cracks(ctx, p, 12, 9, c, 2.4); shock(ctx, p, 12, c, 2);
      if (fx.debris) fx.debris(p, { n: 26, r: 3, speed: 14, size: 0.45 });
      ctx.sfx('boom', { len: 2, g: 1.3 }); ctx.sfx('stomp'); ctx.shake(1.3); ctx.hitstop(0.16); kick(ctx, 18);
      ctx.hitSphere(p.clone().setY(1), 8, ctx.dmg(1500), { launch: 14, kb: 14, stun: 1, posture: 8 });
      if (lv >= 3) ctx.zone({ pos: p.clone(), life: 4, iv: 0.5, onTick: z => {
        ctx.hitSphere(z.pos.clone().setY(0.6), 7, ctx.dmg(60), {});
        for (let k = 0; k < 10; k++) fx.spark(z.pos.clone().add(new V3(rnd(-6, 6), 0.1, rnd(-6, 6))), new V3(0, rnd(2, 6), 0), { color: k % 2 ? c : 0xffaa40, life: 0.6, size: 0.8, size1: 0.05 });
      } });
      if (lv >= 5) for (let i = 0; i < 6; i++) ctx.later(0.25 + i * 0.12, () => {
        const a = i / 6 * TAU, q = p.clone().add(new V3(Math.cos(a) * 9, 0, Math.sin(a) * 9));
        H.impact(ctx, q.clone().setY(0.5), c, 1, {});
        ctx.hitSphere(q.clone().setY(1), 3.6, ctx.dmg(1500) * 0.2, { launch: 8, posture: 2 });
      });
    });
  });

  /* ---------- LÉGION : légion d'acier ---------- */
  Q.setName(CLS, 'u_legion', 'Légion d\'acier', 'Tu frappes le sol de ton épée : 5 chevaliers spectraux (8 au niveau 3) surgissent, chargent en ligne vers la visée en renversant tout, puis combattent à tes côtés 12 s. Niv. 5 : ils explosent en disparaissant.');
  Q.variant(CLS, 'u_legion', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 3 ? 8 : 5, d = ctx.dirToAim(), yaw = Math.atan2(d.x, d.z), side = new V3(d.z, 0, -d.x);
    ctx.anim('1H_Melee_Attack_Chop', 1.3, { fade: 0.05 }); ctx.act({ dur: 0.6, face: yaw, vel: new V3() });
    ctx.sfx('roar', { rate: 1.3, g: 0.5 }); ctx.sfx('charge', { len: 0.4, g: 0.5 });
    bladeUp(ctx, { len: 2.4, grow: 1.6, dur: 0.7, color: c, w: 0.4 });
    ctx.later(0.3, () => { const q = f.pos.clone().setY(0).addScaledVector(d, 1.2); H.impact(ctx, q.clone().setY(0.4), c, 1.3, {}); cracks(ctx, q, 8, 5, c, 1.4); });
    for (let i = 0; i < n; i++) ctx.later(0.35 + i * 0.08, () => {
      const u = i - (n - 1) / 2, p = f.pos.clone().addScaledVector(side, u * 1.6).addScaledVector(d, 1.5 - Math.abs(u) * 0.4); p.y = 0;
      let sk = null;
      try { sk = ctx.fighter({ id: 'ck' + i, look: f.av && f.av.look, kind: 'summon', weapon: 'blade', ghost: c }); } catch (e) { sk = null; }
      if (!sk) return;
      sk.owner = f; sk.team = f.team; sk.summonMul = 1; sk.pos.copy(p).setY(-2); sk.yaw = yaw;
      fx.pillar(p, { color: c, r: 1, h: 8, life: 0.6 }); fx.burst(p.clone().setY(0.3), { n: 30, color: c, speed: 6, up: 1, life: 0.6 });
      ctx.sfx('block', { g: 0.4 });
      try { sk.play('Lie_StandUp', 1.8); } catch (e) { /* animation absente */ }
      let life = 12, atk = 0.6 + i * 0.07, rise = 0.45, chg = 0.7, started = false;
      const api = BR.Arena.api(sk, ctx.auth, lv, ctx.aim, 'u_legion');
      const hitC = new Set(), Rm = (ctx.arenaR || 30) - 1;
      ctx.summon({
        team: f.team, f: sk,
        update(dt) {
          life -= dt; if (life <= 0) return false;
          if (rise > 0) { rise -= dt; sk.pos.y = Math.min(0, sk.pos.y + dt * 5); sk.update(dt, { speed: 0 }); return true; }
          sk.pos.y = 0;
          // charge de la légion vers la visée
          if (chg > 0) {
            chg -= dt; sk.yaw = yaw; sk.pos.addScaledVector(d, 15 * dt);
            const r = Math.hypot(sk.pos.x, sk.pos.z); if (r > Rm) { sk.pos.x *= Rm / r; sk.pos.z *= Rm / r; }
            if (!started) { started = true; try { sk.play('1H_Melee_Attack_Stab', 1.2); } catch (e) { /* rien */ } }
            if (Math.random() < dt * 30) fx.spark(sk.center(), d.clone().multiplyScalar(-4), { color: c, life: 0.35, size: 0.5, size1: 0.1 });
            for (const e of api.enemies()) {
              const key = gk(e); if (hitC.has(key) || e.pos.distanceTo(sk.center()) > e.r + 1.4) continue;
              hitC.add(key); api.hitTarget(e, ctx.dmg(90), { kb: 8, stun: 0.4 }); fx.burst(e.pos, { n: 14, color: c, speed: 8, life: 0.3 });
            }
            sk.update(dt, { speed: 15 }); return true;
          }
          if (Math.random() < dt * 10) fx.spark(sk.center().add(new V3(rnd(-0.4, 0.4), rnd(-0.6, 0.8), rnd(-0.4, 0.4))), new V3(0, rnd(1, 3), 0), { color: c, life: 0.5, size: 0.4, size1: 0.05 });
          const t = api.nearest(sk.pos, 60);
          let sp = 0;
          if (t) {
            const dd = t.pos.clone().setY(0).sub(sk.pos).setY(0), dist = dd.length() - t.r;
            sk.yaw = Math.atan2(dd.x, dd.z);
            if (dist > 1.6) { sp = 7; sk.pos.addScaledVector(dd.normalize(), sp * dt); }
            else { atk -= dt; if (atk <= 0) { atk = 0.9; try { sk.play(i % 2 ? '1H_Melee_Attack_Slice_Diagonal' : '1H_Melee_Attack_Chop', 1.5); } catch (e) { /* rien */ } ctx.later(0.25, () => { fx.slash(sk.center(), sk.yaw, { r: 2.4, arc: 2, color: c, life: 0.2 }); api.hitCone(sk.pos, sk.yaw, 2.6, 2, ctx.dmg(70), {}); }); } }
          }
          sk.update(dt, { speed: sp });
          return true;
        },
        dispose() {
          fx.burst(sk.center(), { n: 30, color: c, speed: 6, life: 0.6 });
          if (lv >= 5) { H.impact(ctx, sk.center(), c, 0.9); api.hitSphere(sk.center(), 3.5, ctx.dmg(250), {}); }
          sk.dispose();
        },
      });
    });
  });

  /* =====================================================================
     ÉVEILS (textes des niveaux 3 et 5, affichés par Q.awText)
     ===================================================================== */
  Q.CLASS_AW = Q.CLASS_AW || {};
  Q.CLASS_AW.chevalier = {
    fente: ['La coupure se rouvre 0,3 s plus tard, frappe et étourdit.', 'Une 2e fente part seule sur l\'ennemi le plus proche.'],
    onde: ['Onde plus large (8,4 m) et des pics de lumière jaillissent des fissures.', 'Trois ondes successives, de plus en plus larges.'],
    tourbillon: ['4 tours au lieu de 3.', '5 tours, et un cyclone d\'acier reste sur place 3 s.'],
    traits: ['5 épées au lieu de 3.', 'Chaque épée explose en croix à l\'impact.'],
    bond: ['Une onde sismique s\'étend ensuite jusqu\'à 9,5 m et étourdit.', 'Six lignes de pics de lumière jaillissent du sol en étoile.'],
    garde: ['Garde de 1,6 s et jusqu\'à 2 ripostes.', 'Garde de 1,8 s ; la riposte renvoie 8 lames de lumière et rend 20 d\'énergie.'],
    chaine: ['L\'éclair saute sur 7 ennemis au lieu de 4.', 'Chaque rebond frappe plus fort et la foudre du ciel achève la dernière cible.'],
    lance: ['Explosion de glace à l\'arrivée qui gèle autour de toi.', 'Le sillage de glace se brise 0,6 s plus tard et gèle à nouveau.'],
    ombre: ['Ton ombre reste en leurre puis explose et étourdit.', 'Tu enchaînes sur une 2e cible.'],
    tornade: ['8 épées, rayon plus grand et durée de 3,5 s.', 'À la fin, les épées partent seules sur les ennemis.'],
    soin: ['Soigne 45 % au lieu de 30 % et l\'épée repousse les ennemis chaque seconde.', 'Relève les alliés à terre dans le cercle.'],
    pluie: ['24 épées au lieu de 14 ; elles ralentissent.', 'Les épées plantées explosent ensuite.'],
    fantomes: ['10 épées au lieu de 6, qui tirent plus vite.', 'Elles explosent en croix à l\'impact.'],
    clone: ['Ton double frappe plus fort.', 'Deux doubles au lieu d\'un.'],
    gravite: ['L\'implosion fait deux fois plus de dégâts.', 'L\'implosion étourdit 1,5 s.'],
    dragon: ['Le dragon laisse une traînée de flammes.', 'Le dragon fait demi-tour et revient vers toi.'],
    contre: ['Posture de 1,2 s et 12 coups au lieu de 8.', 'La dernière taille projette et recharge ton ultime de 25 %.'],
    tempete: ['Dure 8 s et les arcs frappent toutes les 0,5 s.', 'Tu te décharges en une nova de foudre à la fin.'],
    u_lame: ['Étourdit 2 s et la faille brûle 3 s.', 'Deux autres lames célestes s\'abattent en éventail.'],
    u_temps: ['Le temps reste figé 5 s au lieu de 4.', 'Tes recharges se remettent à zéro quand le temps reprend.'],
    u_rayon: ['Rayon de 4,5 s, plus large.', 'Explosion finale au bout du rayon.'],
    u_lames: ['20 tailles au lieu de 14.', 'Le coup final fait deux fois plus de dégâts.'],
    u_domaine: ['Le dôme blesse les ennemis chaque seconde.', 'Énergie illimitée pour tes alliés dans le dôme.'],
    u_meteore: ['Le cratère brûle 4 s.', 'Six répliques explosent autour de l\'impact.'],
    u_legion: ['8 chevaliers au lieu de 5.', 'Ils explosent en disparaissant.'],
  };
})();

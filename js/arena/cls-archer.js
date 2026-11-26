/* ===== arena/cls-archer.js : pouvoirs de la classe archer (game feel) =====
   Chaque pouvoir est déclaré avec BR.Asc.variant(cls, id, (ctx, orig) => {...}). Voir asc-classes.js pour l API.
   L'Archer : arbalète, agile et précis. Chaque tir a du poids : charge lumineuse à la pointe, recul de l'arbalète,
   flash de bouche, traînée de la flèche, impact visible, flèches qui restent plantées un instant.
   Multijoueur : les visuels se jouent partout ; les dégâts passent uniquement par ctx.hit* / ctx.proj / ctx.zone. */
(function () {
  const BR = window.BR, Q = BR.Asc;
  if (!Q || !Q.variant || !Q.FXH) return;
  const V3 = THREE.Vector3, UP = new V3(0, 1, 0), ZP = new V3(0, 0, 1), CLS = 'archer';
  const X = Q.FXH, H = (BR.ASkills && BR.ASkills._H) || {};
  const C = c => new THREE.Color(c);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const own = f => !!f && f.kind !== 'remote';            // position simulée ici (joueur local, bot, double) : on peut la déplacer
  const live = ctx => !ctx.S || !ctx.S.ended;
  const yawOf = d => Math.atan2(d.x, d.z);
  const gk = t => (BR.Arena && BR.Arena.groupKey) ? BR.Arena.groupKey(t) : t;
  const tip = f => (f && f.tip ? f.tip(0) : f.center());
  const def = (id, n, d, fn) => { Q.setName(CLS, id, n, d); Q.variant(CLS, id, fn); };
  // rang d'un nœud de l'arbre de compétences (asc-tree.js) pour ce lanceur (local ou distant : mêmes visuels partout)
  const TR = (f, id) => (Q.treeRank ? Q.treeRank(f, id) : 0);

  /* ---------------- géométries partagées ---------------- */
  const G = { ring: new THREE.RingGeometry(0.72, 1, 48), ice: new THREE.ConeGeometry(0.28, 1.5, 5), puff: new THREE.IcosahedronGeometry(1, 1) };
  Object.values(G).forEach(g => { g.userData.keep = true; });
  const glowMat = (c, k, op) => new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(k || 2), transparent: true, opacity: op == null ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  // les sorts « d'origine » réutilisés parlent en gestes de mage : on les traduit en gestes d'arbalète
  const ANIM_MAP = { Spellcast_Raise: '2H_Ranged_Aiming', Spellcast_Long: '2H_Ranged_Aiming', Spellcasting: '2H_Ranged_Aiming', Spellcast_Shoot: '2H_Ranged_Shoot', Cheer: '2H_Ranged_Reload' };
  const bowCtx = ctx => Object.assign({}, ctx, { anim: (n, s, o) => ctx.anim(ANIM_MAP[n] || n, s, o) });

  /* ---------------- petits outils ---------------- */
  // son limité dans le temps (évite la bouillie sonore quand 30 flèches tombent)
  const lastS = {};
  function snd(ctx, n, o, gap) { const now = performance.now(), k = n + ':' + ((o && o.rate) || 1).toFixed(1); if (gap && lastS[k] && now - lastS[k] < gap) return; lastS[k] = now; ctx.sfx(n, o); }
  // hasard déterministe (même graine chez tous les joueurs : la visée est transmise)
  function rng(ctx, salt) {
    const a = ctx.aim || new V3();
    let s = ((Math.round(a.x * 97) * 73856093) ^ (Math.round(a.z * 89) * 19349663) ^ ((salt || 1) * 83492791)) >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // direction de tir vers la visée (jamais plantée dans les pieds)
  function aimD(ctx, from) {
    from = from || ctx.f.center();
    const a = ctx.aim.clone(); if (a.y < 0.6) a.y = 0.9;
    const d = a.sub(from), h = Math.hypot(d.x, d.z);
    if (h < 2) return ctx.dirToAim();
    d.y = clamp(d.y / h, -0.25, 0.6) * h; return d.normalize();
  }

  // recul de l'arbalète : l'arme part en arrière dans la main puis revient (un seul pilote par combattant)
  function recoil(ctx, amp) {
    const f = ctx.f, w = f && f.weapons && f.weapons[0];
    if (!w || !w.obj || !w.P || !w.P.tip) return;
    const o = w.obj; if (!o.userData.ar0) o.userData.ar0 = o.position.clone();
    const st = f._arRc || (f._arRc = { k: 0, it: null });
    st.k = Math.min(1.8, Math.max(st.k, amp || 1));
    if (st.it && !st.it.dead) return;
    const dir = w.P.tip.clone().normalize().applyQuaternion(o.quaternion), L = (w.P.len || 1) * (o.scale.x || 1) * 0.12;
    st.it = ctx.fx.add(new THREE.Group(), 4, (k, ob, dt) => {
      st.k = Math.max(0, st.k - dt * 6.5);
      o.position.copy(o.userData.ar0).addScaledVector(dir, -L * st.k);
      if (st.k <= 0 && st.it) ctx.fx.kill(st.it);
    }, false, () => { o.position.copy(o.userData.ar0); st.k = 0; st.it = null; });
  }
  // onde orientée (anneau face à une direction)
  function wave(ctx, p, dir, c, o) {
    o = o || {};
    const m = new THREE.Mesh(G.ring, glowMat(c, o.bright || 2.4, 0.9));
    m.position.copy(p); m.quaternion.setFromUnitVectors(ZP, dir.clone().normalize());
    const r0 = o.r0 == null ? 0.15 : o.r0, r1 = o.r1 || 1.4, life = o.life || 0.2;
    m.scale.setScalar(r0);
    return ctx.fx.add(m, life, (k, ob) => { const e = 1 - Math.pow(1 - k, 3); ob.scale.setScalar(r0 + (r1 - r0) * e); ob.material.opacity = 0.9 * (1 - k); });
  }
  // flash de bouche : éclair, onde, gerbe vers l'avant, fumée, recul
  function muzzle(ctx, dir, c, k) {
    k = k || 1; const fx = ctx.fx, p = tip(ctx.f).addScaledVector(dir, 0.25);
    fx.flash(p, { color: c, r: 0.32 * k, life: 0.09, intensity: 2 * k, light: k >= 1.4 });
    wave(ctx, p, dir, c, { r1: 0.9 * k, life: 0.16 });
    if (k >= 1.2) wave(ctx, p.clone().addScaledVector(dir, 0.5 * k), dir, 0xffffff, { r1: 0.6 * k, life: 0.12 });
    fx.burst(p, { n: Math.round(6 * k), color: c, speed: 9 * k, dir, spread: 0.35, life: 0.22, size: 0.22, grav: 0 });
    fx.burst(p, { n: Math.round(2 + 2 * k), color: 0xb8b0a0, kind: 'smoke', speed: 2, dir, spread: 0.6, life: 0.5, size: 0.3, size1: 0.9, grav: -0.5, alpha: 0.3 });
    recoil(ctx, 0.6 * k);
  }
  // charge : lueur qui grossit à la pointe de l'arbalète, étincelles aspirées
  function charge(ctx, c, dur, k) {
    if (!(dur > 0)) return;
    k = k || 1; const f = ctx.f, fx = ctx.fx;
    const m = new THREE.Mesh(fx.geo.sph, glowMat(c, 2.6, 0.85));
    fx.add(m, dur, (kk, o, dt, t) => {
      const p = tip(f); o.position.copy(p); o.scale.setScalar((0.06 + kk * 0.26) * k * (1 + Math.sin(t * 50) * 0.12));
      if (Math.random() < 0.8) { const q = new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(1.3 * k); fx.spark(p.clone().add(q), q.multiplyScalar(-5.5), { color: c, life: 0.18, size: 0.22, size1: 0.04 }); }
    });
  }
  // traînée lumineuse d'une flèche (ruban du moteur), qui s'éteint en douceur
  function streak(ctx, c, w) {
    if (!ctx.fx.trail) return null;
    const tr = ctx.fx.trail(c), a = new V3(), b = new V3(), s = new V3(), ls = new V3(1, 0, 0), last = new V3(); let has = false;
    const put = (p, on, dt) => { s.copy(ls).multiplyScalar(w); tr.push(a.copy(p).addScaledVector(s, -1.5), b.copy(p).addScaledVector(s, 0.5), on, Math.max(1e-3, dt || 0.016)); };
    return {
      push(p, v, dt) { s.set(v.z, 0, -v.x); if (s.lengthSq() > 1e-6) ls.copy(s.normalize()); last.copy(p); has = true; put(p, true, dt); },
      end() { if (!has) { tr.dispose(); return; } const p = last.clone(); ctx.fx.add(new THREE.Group(), 0.2, (k, o, dt) => put(p, false, dt), false, () => tr.dispose()); },
    };
  }
  // flèche plantée qui vibre puis s'efface (sol ou cible)
  let nPlanted = 0;
  function plant(ctx, p, dir, c, life, sc, free) {
    if (nPlanted >= 90 || !(life > 0)) return null;
    sc = sc || 1;
    const d = dir.clone(); if (d.lengthSq() < 1e-6) d.set(0, -1, 0); d.normalize();
    if (!free && d.y > -0.3) { d.y = -0.3; d.normalize(); }
    const m = X.arrowMesh(c, sc), mats = m.userData.mats || [], base = mats.map(x => x.opacity);
    mats.forEach(x => { x.transparent = true; });
    m.position.copy(p).addScaledVector(d, -0.32 * sc);
    m.lookAt(m.position.clone().add(d));
    const q0 = m.quaternion.clone(), ax = new V3(d.z, 0, -d.x); if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0); ax.normalize();
    const ph = Math.random() * 6;
    nPlanted++;
    return ctx.fx.add(m, life, (k, o, dt, t) => {
      const wob = Math.sin(t * 48 + ph) * 0.16 * Math.exp(-t * 6);
      o.quaternion.copy(q0); if (Math.abs(wob) > 1e-4) o.rotateOnWorldAxis(ax, wob);
      const fade = Math.min(1, (life - t) / 0.3);
      mats.forEach((x, i) => { x.opacity = base[i] * fade; });
      if (mats[3]) mats[3].opacity = base[3] * fade * (0.35 + 0.65 * Math.exp(-t * 3));
    }, false, () => { nPlanted--; });
  }
  // poussière d'impact au sol
  function dust(ctx, g, c, k) {
    k = k || 1;
    ctx.fx.burst(g, { n: Math.round(5 * k), color: 0x8a7a6a, kind: 'smoke', speed: 2.5 * k, up: 0.6, life: 0.5, size: 0.3 * k, size1: 0.8 * k, grav: -0.2, alpha: 0.5 });
    ctx.fx.burst(g, { n: Math.round(4 * k), color: c, speed: 4 * k, up: 0.8, life: 0.25 });
  }
  // flèche visuelle en cloche (from -> to en T s) ; à l'arrivée : se plante, puis onHit(to, dir, itemPlanté)
  function lob(ctx, from, to, T, o) {
    o = o || {};
    const fx = ctx.fx, c = o.color || ctx.color, sc = o.scale || 1.2, hgt = o.h == null ? Math.min(6, from.distanceTo(to) * 0.15) : o.h;
    const m = X.arrowMesh(c, sc), tr = o.trail === false ? null : streak(ctx, o.trailColor || c, 0.12 * sc * (o.trailW || 1));
    const prev = from.clone(), cur = new V3(), vel = to.clone().sub(from), look = new V3();
    const at = (k, out) => { out.lerpVectors(from, to, k); out.y += Math.sin(k * Math.PI) * hgt; return out; };
    m.position.copy(from); if (vel.lengthSq() > 1e-8) m.lookAt(look.copy(from).add(vel));
    return fx.add(m, Math.max(0.02, T), (k, ob, dt) => {
      at(o.ease ? k * k : k, cur);
      if (cur.distanceToSquared(prev) > 1e-8) vel.copy(cur).sub(prev);
      ob.position.copy(cur); ob.lookAt(look.copy(cur).add(vel));
      if (tr && dt > 0) tr.push(cur, vel, dt);
      if (o.onUpdate) o.onUpdate(cur, dt);
      prev.copy(cur);
    }, false, () => {
      if (tr) tr.end();
      if (!live(ctx)) return;
      const d = vel.lengthSq() > 1e-8 ? vel.clone().normalize() : new V3(0, -1, 0);
      const it = o.stick !== false ? plant(ctx, to.clone(), d, c, o.stickT || 1.4, sc, o.free) : null;
      if (o.dust !== false && to.y < 0.3) dust(ctx, new V3(to.x, 0.1, to.z), c, Math.min(2.5, 0.7 + sc * 0.25));
      if (o.onHit) o.onHit(to.clone(), d, it);
    });
  }
  // flèche qui tombe du ciel sur le point p (au sol)
  function skyArrow(ctx, p, o) {
    o = o || {}; const sk = o.skew || new V3(), alt = o.alt || 20;
    const from = new V3(p.x + sk.x, alt, p.z + sk.z), to = new V3(p.x, 0.02, p.z);
    return lob(ctx, from, to, o.t || 0.28, Object.assign({}, o, { h: 0, ease: true, onHit: (q, d, it) => { if (o.onHit) o.onHit(q, it, d); } }));
  }
  // vraie flèche (projectile du moteur) : dégâts + options complètes (recul, projection, critique…) via hitTarget
  function arrow(ctx, dir, o) {
    o = o || {};
    const fx = ctx.fx, c = o.color || ctx.color, sc = o.scale || 1, hitO = o.hit || {};
    const tr = o.trail ? streak(ctx, o.trailColor || c, 0.12 * sc * (o.trailW || 1)) : null;
    const lastV = dir.clone();
    const opts = Object.assign({}, o, {
      dmg: 0, color: c, scale: sc, speed: o.speed || 55, life: o.life || 1.4, r: o.r || 0.45 * Math.max(1, sc * 0.8), size: o.size || 0.5 * sc,
      onUpdate: (p, d) => { lastV.copy(p.vel); if (tr && d > 0) tr.push(p.pos, p.vel, d); if (o.onUpdate) o.onUpdate(p, d); },
      onHit: (p, t) => {
        if (o.dmg) ctx.hitTarget(t, o.dmg, Object.assign({}, hitO));
        fx.flash(p.pos, { color: c, r: 0.45 * sc, life: 0.1, light: false });
        if (o.onHit) o.onHit(p, t);
      },
      onEnd: (p) => {
        if (tr) tr.end();
        const ground = p.pos.y < 0.05;
        let it = null;
        if (ground && live(ctx)) {
          const g = new V3(p.pos.x, 0.02, p.pos.z);
          if (o.stick !== false) it = plant(ctx, g, lastV, c, o.stickT || 1.3, sc);
          dust(ctx, g, c, 0.8);
        }
        if (o.onEnd && live(ctx)) o.onEnd(p, ground, it);
      },
    });
    delete opts.hit; delete opts.trail; delete opts.stick;   // « hit » écraserait l'ensemble des cibles touchées du projectile
    return X.shoot(ctx, dir, opts);
  }
  // explosion au sol (visuel complet + dégâts de zone)
  function blast(ctx, p, c, r, dmg, hit, o) {
    o = o || {}; const fx = ctx.fx, g = new V3(p.x, 0.05, p.z), q = new V3(p.x, Math.max(0.5, p.y || 0), p.z);
    fx.flash(q, { color: c, r: r * 0.55, life: 0.22, intensity: 3 + r, light: o.light !== false });
    fx.flash(q, { color: 0xffffff, r: r * 0.3, life: 0.1, light: false });
    fx.ring(g, { r0: 0.2, r1: r * 1.15, color: c, life: 0.32, width: 0.3 });
    fx.burst(q, { n: Math.round(10 + r * 6), color: c, speed: 5 + r * 3, life: 0.45, size: 0.3, grav: 10, up: 0.3 });
    fx.burst(g, { n: Math.round(4 + r * 2), color: 0x3a3430, kind: 'smoke', speed: 2 + r, up: 0.5, life: 0.9, size: 0.6 * r, size1: 1.4 * r, grav: -0.6, drag: 2, alpha: 0.55 });
    if (o.debris && fx.debris) fx.debris(g, { n: Math.round(4 + r * 2), r: r * 0.4, speed: 5 + r * 1.5, size: 0.18 + r * 0.04 });
    snd(ctx, 'boom', { g: Math.min(0.9, 0.25 + r * 0.08), rate: o.rate || 1.5, len: 0.4 + r * 0.08 }, 45);
    if (o.shake !== 0) ctx.shake(o.shake || r * 0.05);
    return dmg ? ctx.hitSphere(q.clone().setY(1), r, dmg, hit || {}) : [];
  }
  // silhouette fantôme (après-image) et fumée d'ombre
  function ghost(ctx, p, c) { for (let i = 0; i < 10; i++) ctx.fx.spark(p.clone().add(new V3(rnd(-0.3, 0.3), rnd(-0.9, 0.9), rnd(-0.3, 0.3))), new V3(0, rnd(0, 1), 0), { color: c, life: 0.5, size: 0.6, size1: 0.1 }); }
  function smoke(ctx, p, c) {
    ctx.fx.burst(p, { n: 26, color: 0x2a1040, kind: 'smoke', speed: 4, life: 0.8, size: 1, size1: 1.8, grav: -1, alpha: 0.8 });
    ctx.fx.burst(p, { n: 18, color: c, speed: 8, life: 0.4 });
  }
  // éclats chercheurs (flèche à fragmentation) vers d'autres ennemis
  function shards(ctx, p, t, c, n, dmg) {
    const key = t ? gk(t) : null, r0 = ((t && t.r) || 1) + 0.7;
    const others = ctx.enemies().filter(e => (key == null || gk(e) !== key) && e.pos.distanceTo(p) < 12).sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p));
    for (let k = 0; k < n; k++) {
      const e = others.length ? others[k % others.length] : null;
      const d = e ? e.pos.clone().sub(p).normalize() : new V3(Math.cos(k * 2.4), 0.3, Math.sin(k * 2.4)).normalize();
      arrow(ctx, d, { from: p.clone().addScaledVector(d, r0), dmg, speed: 40, homing: 9, life: 0.6, scale: 0.6, stick: false, hit: { posture: 0.3 } });
    }
    ctx.fx.burst(p, { n: 12, color: c, speed: 8, life: 0.3 });
  }
  // pic de glace au sol
  function spike(ctx, p, c) {
    const m = new THREE.Mesh(G.ice, new THREE.MeshStandardMaterial({ color: 0xdff8ff, emissive: C(c), emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true }));
    m.position.set(p.x + rnd(-0.5, 0.5), 0.45, p.z + rnd(-0.5, 0.5)); m.rotation.set(rnd(-0.4, 0.4), rnd(0, 6), rnd(-0.4, 0.4));
    const s0 = rnd(0.7, 1.3); m.scale.setScalar(0.01);
    ctx.fx.add(m, 1.5, (k, o) => { o.scale.setScalar(s0 * Math.min(1, k * 10)); o.material.opacity = k > 0.75 ? (1 - k) / 0.25 : 1; });
  }

  /* =====================================================================
     KIT DE DÉPART : traits, fente, tourbillon, pluie + ultime u_lames
     ===================================================================== */

  // ---------- Flèches traqueuses ----------
  def('traits', 'Flèches traqueuses', 'Vise un instant puis décoche 3 flèches chercheuses qui étourdissent brièvement. Niv. 3 : 5 flèches qui ralentissent aussi. Niv. 5 : chaque flèche éclate en 2 éclats chercheurs et te rend de l\'énergie.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = (lv >= 3 ? 5 : 3) + 2 * Math.min(2, TR(f, 'ar_traits')), yaw = ctx.face(), T0 = 0.15;
    ctx.anim('2H_Ranged_Aiming', 2.4, { fade: 0.05 }); ctx.act({ dur: T0 + n * 0.07 + 0.12, face: yaw });
    charge(ctx, c, T0, 0.9); ctx.sfx('charge', { len: 0.18, g: 0.45 });
    let first = true;
    for (let i = 0; i < n; i++) ctx.later(T0 + i * 0.07, () => {
      const d = aimD(ctx).applyAxisAngle(UP, (i - (n - 1) / 2) * (n > 5 ? 0.2 : 0.3)); d.y += 0.2; d.normalize();
      if (i === 0 || i === n - 1) ctx.anim('2H_Ranged_Shoot', 3.2, { fade: 0.03 });
      muzzle(ctx, d, c, 0.85);
      ctx.sfx('swing', { rate: 1.9 + i * 0.12, g: 0.8 }); snd(ctx, 'magic', { rate: 1.6 + i * 0.08, g: 0.3 }, 20);
      arrow(ctx, d, { dmg: ctx.dmg(95), hit: { stun: 0.15, kb: 1.5, posture: 0.8, freeze: lv >= 3 ? 0.4 : 0 }, speed: 34, homing: 7, life: 2.2, scale: 1.1, trail: true,
        onHit: (p, t) => {
          if (first) { first = false; ctx.hitstop(0.035); ctx.shake(0.1); }
          fx.ring(new V3(p.pos.x, 0.05, p.pos.z), { r0: 0.2, r1: 1.6, color: c, life: 0.25, width: 0.3 });
          if (lv >= 5) { if (own(f)) f.energy = Math.min(100, (f.energy || 0) + 3); shards(ctx, p.pos.clone(), t, c, 2, ctx.dmg(35)); }
        } });
    });
  });

  // ---------- Roulade du chasseur ----------
  def('fente', 'Roulade du chasseur', 'Roulade invulnérable (vers où tu te déplaces, sinon en arrière) en décochant 3 flèches qui repoussent les ennemis les plus proches. Niv. 3 : 5 flèches perforantes. Niv. 5 : une flèche piégée explose là où tu étais.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, d = ctx.dirToAim(), yaw = yawOf(d), side = new V3(d.z, 0, -d.x);
    const mv = f.ctl && f.ctl.move ? f.ctl.move.clone().setY(0) : new V3();
    const dir = mv.lengthSq() > 0.05 ? mv.normalize() : d.clone().negate();
    const fw = dir.dot(d), sd = dir.dot(side), D = 0.36, p0 = f.pos.clone();
    let an;
    if (Math.abs(fw) >= Math.abs(sd)) { an = fw > 0 ? 'Dodge_Forward' : 'Dodge_Backward'; f.spin = { kind: fw > 0 ? 'roll' : 'flipB', t: 0, dur: D + 0.08 }; }
    else an = sd > 0 ? 'Dodge_Left' : 'Dodge_Right';
    f.inv = Math.max(f.inv || 0, D + 0.15);
    ctx.anim(an, 1.8, { fade: 0.04 }); ctx.sfx('dash', { g: 0.9 }); ctx.sfx('swing', { rate: 0.7, g: 0.5 });
    if (own(f)) f.vel.y = 7;
    fx.burst(p0.clone().setY(0.2), { n: 12, color: 0x8a7a6a, kind: 'smoke', speed: 5, dir: dir.clone().negate().setY(0.3), spread: 0.7, life: 0.6, size: 0.5, size1: 1.3, grav: -0.3, alpha: 0.5 });
    fx.ring(p0.clone(), { r0: 0.3, r1: 2.2, color: c, life: 0.25, width: 0.25 });
    ctx.act({ dur: D, vel: dir.clone().multiplyScalar(21), face: yaw, lockMove: true,
      update: () => { if (Math.random() < 0.7) fx.spark(f.center().add(new V3(rnd(-0.3, 0.3), rnd(-0.6, 0.6), rnd(-0.3, 0.3))), new V3(0, 0.6, 0), { color: c, life: 0.35, size: 0.5, size1: 0.05 }); },
      onEnd: () => { fx.burst(f.pos.clone().setY(0.15), { n: 8, color: 0x8a7a6a, kind: 'smoke', speed: 3, up: 0.3, life: 0.5, size: 0.4, size1: 1, grav: -0.3, alpha: 0.45 }); ctx.sfx('land', { g: 0.6 }); ctx.anim('2H_Ranged_Aiming', 2.4, { fade: 0.06 }); } });
    const n = (lv >= 3 ? 5 : 3) + (TR(f, 'ar_fente') ? 2 : 0); let first = true;
    for (let i = 0; i < n; i++) ctx.later(0.07 + i * 0.055, () => {
      const from = f.center().add(new V3(0, 0.2, 0));
      const es = ctx.enemies().filter(e => e.pos.distanceTo(f.pos) < 24).sort((a, b) => a.pos.distanceTo(f.pos) - b.pos.distanceTo(f.pos));
      const tg = es.length ? es[i % es.length] : null;
      const dd = tg ? tg.pos.clone().sub(from).normalize() : d.clone().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.18);
      muzzle(ctx, dd, c, 0.8); ctx.sfx('swing', { rate: 2.1 + i * 0.1, g: 0.7 });
      arrow(ctx, dd, { from: from.clone().addScaledVector(dd, 0.6), dmg: ctx.dmg(85), hit: { kb: 4, posture: 1 }, speed: 64, homing: 3, life: 0.9, trail: true, pierce: lv >= 3, grav: 2,
        onHit: () => { if (first) { first = false; ctx.hitstop(0.04); ctx.shake(0.15); } } });
    });
    if (lv >= 5) {
      const tp = p0.clone().setY(0);
      ctx.later(0.05, () => {
        const it = plant(ctx, tp.clone().setY(0.02), new V3(0.15, -1, 0.1), c, 1.0, 1.5);
        fx.decal(tp, 'circle', { r: 3.4, color: c, dur: 0.7, hold: 0.05, world: false, noWarn: true });
        ctx.later(0.7, () => { if (it) fx.kill(it); blast(ctx, tp, c, 3.4, ctx.dmg(160), { kb: 6, launch: 4, stun: 0.4, posture: 2 }, { debris: true, shake: 0.3 }); });
      });
    }
  });

  // ---------- Valse des flèches ----------
  def('tourbillon', 'Valse des flèches', 'Tu tournoies en arrosant tout autour de toi de flèches perforantes ; chaque demi-tour repousse les ennemis collés à toi, et une couronne de flèches finale les projette. Niv. 3 : 20 flèches sur 2 tours. Niv. 5 : les flèches plantées autour de toi explosent.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = (lv >= 3 ? 20 : 12) + 6 * Math.min(2, TR(f, 'ar_valse')), turns = lv >= 3 ? 2 : 1.5, dur = lv >= 3 ? 1.1 : 0.85, T0 = 0.14, y0 = f.yaw;
    ctx.anim('2H_Ranged_Aiming', 2.6, { fade: 0.04 });
    fx.ring(f.pos.clone(), { r0: 3.4, r1: 0.5, color: c, life: T0, width: 0.2, linear: true });
    ctx.sfx('swingBig', { rate: 1.6, g: 0.6 });
    const loop = BR.Audio && BR.Audio.loopFx ? BR.Audio.loopFx('wind') : null;
    if (loop) { loop.set(f.kind === 'local' ? 0.8 : 0.3); ctx.later(T0 + dur + 0.1, () => loop.stop()); }
    const spinYaw = t => y0 + clamp((t - T0) / dur, 0, 1) * turns * 6.283;
    const A = ctx.act({ dur: T0 + dur + 0.2, lockMove: false, face: y0, update: (t) => { if (t >= T0) { const y = spinYaw(t); A.face = y; f.yaw = y; } } });
    const pts = [];
    const keep = (p, ground, it) => { if (ground && lv >= 5) pts.push({ p: new V3(p.pos.x, 0, p.pos.z), it }); };
    let firstHit = true;
    // spirale de flèches
    for (let i = 0; i < n; i++) ctx.later(T0 + (i + 0.5) * dur / n, () => {
      const a = y0 + ((i + 0.5) / n) * turns * 6.283, d = new V3(Math.sin(a), -0.05, Math.cos(a)).normalize();
      if (i % 3 === 0) ctx.anim('2H_Ranged_Shoot', 4, { fade: 0.02 });
      muzzle(ctx, d, c, 0.65); snd(ctx, 'swing', { rate: 1.6 + (i % 4) * 0.15, g: 0.6 }, 25);
      arrow(ctx, d, { from: f.center().add(new V3(0, 0.2, 0)).addScaledVector(d, 0.7), dmg: ctx.dmg(60), hit: { kb: 2.5, posture: 0.6 }, speed: 40, life: 0.9, pierce: true, grav: 12, trail: i % 2 === 0,
        stickT: lv >= 5 ? 1.9 : 1.2, onHit: () => { if (firstHit) { firstHit = false; ctx.hitstop(0.03); } }, onEnd: keep });
    });
    // chaque demi-tour : l'arbalète balaie comme un fléau et repousse ce qui colle
    const halves = Math.round(turns * 2);
    for (let h = 0; h < halves; h++) ctx.later(T0 + (h + 0.5) * dur / halves, () => {
      const p = f.center();
      fx.slash(p, f.yaw + Math.PI / 2, { r: 3.2, arc: 3.4, tilt: h % 2 ? 0.25 : -0.25, color: c, life: 0.24, inner: 0.72 });
      fx.burst(p, { n: 12, color: c, speed: 10, life: 0.3, flat: true });
      ctx.sfx('swing', { rate: 0.9 + h * 0.1, g: 0.7 });
      const hh = ctx.hitSphere(p, 3.2, ctx.dmg(45), { kb: 4, posture: 0.8 });
      if (hh.length) { ctx.hitstop(0.03); ctx.shake(0.12); }
    });
    // couronne finale
    ctx.later(T0 + dur + 0.02, () => {
      const m = lv >= 3 ? 12 : 8, p0 = f.pos.clone();
      ctx.anim('2H_Ranged_Shoot', 2.2, { fade: 0.03 });
      fx.flash(f.center(), { color: c, r: 1.8, life: 0.2, intensity: 5 });
      fx.ring(p0.clone(), { r0: 0.5, r1: 7, color: c, life: 0.4, width: 0.25 });
      fx.ring(p0.clone(), { r0: 0.3, r1: 4, color: 0xffffff, life: 0.25, width: 0.4 });
      ctx.sfx('swingBig', { rate: 1.1 }); ctx.sfx('boom', { rate: 2.2, g: 0.35, len: 0.4 }); ctx.shake(0.3); recoil(ctx, 1.2);
      let fh = true;
      for (let k = 0; k < m; k++) {
        const a = f.yaw + k / m * 6.283, d = new V3(Math.sin(a), -0.03, Math.cos(a)).normalize();
        arrow(ctx, d, { from: f.center().addScaledVector(d, 0.7), dmg: ctx.dmg(70), hit: { kb: 6, launch: 4, posture: 1 }, speed: 50, life: 0.8, pierce: true, grav: 8, scale: 1.3, trail: true, stickT: lv >= 5 ? 1.6 : 1.2,
          onHit: () => { if (fh) { fh = false; ctx.hitstop(0.05); } }, onEnd: keep });
      }
    });
    // éveil niv. 5 : les flèches plantées explosent
    if (lv >= 5) ctx.later(T0 + dur + 0.75, () => {
      pts.slice(0, 16).forEach((q, j) => ctx.later(j * 0.035, () => { if (q.it) fx.kill(q.it); blast(ctx, q.p, c, 2.2, ctx.dmg(45), { kb: 3, posture: 0.5 }, { shake: 0.06 }); }));
    });
  });

  // ---------- Pluie de flèches ----------
  def('pluie', 'Pluie de flèches', 'Une flèche-mère éclate au-dessus de la zone visée et déverse 22 flèches qui blessent et ralentissent la horde. Niv. 3 : 36 flèches et une flèche géante finale qui projette tout. Niv. 5 : les flèches plantées explosent en chaîne.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, center = ctx.clampAim(20), R = 5, n = (lv >= 3 ? 36 : 22) + 10 * Math.min(2, TR(f, 'ar_pluie')), R1 = rng(ctx, 7), yaw = ctx.face(), T0 = 0.22;
    const giant = lv >= 3 || TR(f, 'ar_pluie2') > 0;
    ctx.anim('2H_Ranged_Aiming', 1.8, { fade: 0.05 }); ctx.act({ dur: T0 + 0.3, face: yaw });
    charge(ctx, c, T0, 1.2); ctx.sfx('charge', { len: 0.3, g: 0.55 });
    fx.decal(center, 'circle', { r: R, color: c, dur: 0.8, hold: 1.6, world: false, noWarn: true });
    const sky = center.clone().setY(17), skew = ctx.dirToAim().multiplyScalar(-5);   // la pluie arrive du côté du tireur
    ctx.later(T0, () => {
      ctx.anim('2H_Ranged_Shoot', 2.2, { fade: 0.03 });
      const from = f.center().add(new V3(0, 0.5, 0));
      muzzle(ctx, UP.clone(), c, 1.3); ctx.sfx('swingBig', { rate: 1.4, g: 0.8 }); ctx.sfx('swing', { rate: 0.8 });
      lob(ctx, from, sky, 0.36, { color: c, scale: 2, h: 3, stick: false, dust: false, trailW: 1.6, onHit: (q) => {
        fx.flash(q, { color: c, r: 2.4, life: 0.3, intensity: 5 }); fx.flash(q, { color: 0xffffff, r: 1.2, life: 0.12, light: false });
        fx.ring(q, { r0: 0.4, r1: R * 1.3, color: c, life: 0.5, width: 0.15 });
        fx.burst(q, { n: 40, color: c, speed: 12, life: 0.5, size: 0.3, grav: 14 });
        snd(ctx, 'boom', { rate: 2.4, g: 0.3, len: 0.3 }); ctx.sfx('magic', { rate: 0.7, g: 0.5 });
      } });
    });
    const t1 = T0 + 0.4, span = 1.3, dm = ctx.dmg(48), planted = [];
    for (let i = 0; i < n; i++) ctx.later(t1 + i * span / n, () => {
      const u1 = R1(), u2 = R1(), u3 = R1(), u4 = R1();
      const es = u1 < 0.35 ? ctx.enemies().filter(e => e.pos.distanceTo(center) < R + (e.r || 0)) : [];
      let p;
      if (es.length) { const e = es[Math.floor(u2 * es.length) % es.length]; p = new V3(e.pos.x + (u3 - 0.5) * 1.6, 0, e.pos.z + (u4 - 0.5) * 1.6); }
      else { const a = u2 * 6.283, r = Math.sqrt(u3) * R; p = new V3(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r); }
      skyArrow(ctx, p, { color: c, scale: 1.4, skew, t: 0.26, trail: i % 2 === 0, stickT: lv >= 5 ? 2.4 : 1.3, onHit: (q, it) => {
        snd(ctx, 'hit', { g: 0.35, rate: 1.5 + u4 * 0.4 }, 35);
        ctx.hitSphere(q.clone().setY(0.9), 1.8, dm, { freeze: 0.3, posture: 0.5 });
        if (lv >= 5) planted.push({ p: q.clone(), it });
      } });
    });
    if (giant) ctx.later(t1 + span + 0.1, () => {
      fx.decal(center, 'circle', { r: 4.5, color: 0xffffff, dur: 0.3, hold: 0.05, world: false });
      skyArrow(ctx, center.clone(), { color: c, scale: 3.6, skew, t: 0.32, trailW: 2, stickT: 2, onHit: (q) => {
        blast(ctx, q, c, 4.5, ctx.dmg(160), { launch: 6, kb: 6, stun: 0.3, posture: 2 }, { debris: true, shake: 0.5 });
        ctx.hitstop(0.06);
      } });
    });
    if (lv >= 5) ctx.later(t1 + span + 0.55, () => {
      planted.forEach((q, j) => ctx.later(j * 0.03, () => { if (q.it) fx.kill(q.it); blast(ctx, q.p, c, 1.8, ctx.dmg(30), { posture: 0.3 }, { shake: 0.04 }); }));
    });
  });

  // ---------- Mille flèches (ultime de départ) ----------
  def('u_lames', 'Mille flèches', 'Ralenti : tu bondis de point en point autour de ta cible en la criblant de rafales, puis tu reviens l\'achever d\'un tir chargé dévastateur. Niv. 3 : 8 bonds et le tir final transperce la ligne. Niv. 5 : toutes les flèches plantées dans la cible explosent.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, hops = (lv >= 3 ? 8 : 6) + 2 * Math.min(2, TR(f, 'ar_u_hops')), step = 0.24, T0 = 0.35, R1 = rng(ctx, 11);
    const bouquet = lv >= 5 || TR(f, 'ar_u_final') > 0;
    const tg = ctx.lockTarget(), home = f.pos.clone();
    let tp = tg ? tg.pos.clone() : ctx.clampAim(18).setY(1);
    const tr = tg ? (tg.r || 1) : 1, tEnd = T0 + hops * step, total = tEnd + 1.05;
    const stuck = [];
    f.inv = Math.max(f.inv || 0, total + 0.3);
    ctx.slowmo(tEnd + 0.4);
    ctx.anim('2H_Ranged_Aiming', 1.4, { fade: 0.05 }); ctx.sfx('charge', { len: 0.4 }); ctx.sfx('dash', { rate: 0.6 });
    charge(ctx, c, T0, 1.6);
    fx.flash(f.center(), { color: c, r: 1.6, life: 0.3, intensity: 5 });
    fx.ring(home.clone(), { r0: 0.4, r1: 5, color: c, life: 0.35, width: 0.2 });
    fx.decal(new V3(tp.x, 0, tp.z), 'ring', { r: tr + 7, inner: 0.9, color: c, dur: T0, hold: hops * step, world: false, noWarn: true });
    const A = ctx.act({ dur: total, lockMove: true, vel: new V3(), float: true, face: f.yaw, update: (t, dt) => { if (A.vel.lengthSq() > 0.01) A.vel.multiplyScalar(Math.max(0, 1 - dt * 6)); } });
    const track = () => { const t2 = ctx.nearest(tp, 8); if (t2) tp = t2.pos.clone(); return t2; };
    for (let s = 0; s < hops; s++) ctx.later(T0 + s * step, () => {
      track();
      const a = s / hops * 6.283 * 1.25 + R1() * 0.6, r = tr + 5 + R1() * 2.5, h = 0.4 + R1() * 3.2;
      const p = new V3(tp.x + Math.cos(a) * r, h, tp.z + Math.sin(a) * r);
      const prev = f.center();
      if (own(f)) { f.pos.copy(p); f.vel.set(0, 0, 0); ctx.confine(); }
      const cur = f.center();
      fx.bolt(prev, cur, { color: c, life: 0.18, jitter: 0.12, segs: 5, light: false });
      ghost(ctx, prev, c);
      fx.burst(cur, { n: 14, color: c, speed: 7, life: 0.3 });
      const aimP = tp.clone().setY(Math.max(0.8, tp.y));
      A.face = f.yaw = yawOf(aimP.clone().sub(cur));
      if (s % 3 === 1) f.spin = { kind: 'flip', t: 0, dur: 0.22 };
      ctx.anim(s % 2 ? '2H_Ranged_Shoot' : '2H_Ranged_Shooting', 3, { fade: 0.02 });
      snd(ctx, 'dash', { rate: 1.5, g: 0.6 }, 30);
      for (let k = 0; k < 3; k++) ctx.later(k * 0.045, () => {
        const from = f.center().add(new V3(0, 0.2, 0)), dd = aimP.clone().sub(from).normalize().applyAxisAngle(UP, (k - 1) * 0.05);
        muzzle(ctx, dd, c, 0.9); snd(ctx, 'swing', { rate: 2 + k * 0.2, g: 0.7 }, 20);
        arrow(ctx, dd, { from: from.clone().addScaledVector(dd, 0.6), dmg: ctx.dmg(100), hit: { crit: k === 2, posture: 1 }, speed: 72, homing: 8, life: 0.9, trail: k === 1, stick: false,
          onHit: (pp) => {
            ctx.shake(0.1); if (k === 2) ctx.hitstop(0.025);
            if (stuck.length < 24) { const it = plant(ctx, pp.pos.clone(), pp.vel.clone(), c, total + 1.4 - (T0 + s * step), 1, true); if (it) stuck.push(it); }
          } });
      });
    });
    // retour et tir de grâce
    ctx.later(tEnd + 0.05, () => {
      track();
      const prev = f.center();
      if (own(f)) { f.pos.copy(home); f.vel.set(0, 0, 0); }
      f.spin = { kind: 'flipB', t: 0, dur: 0.35 };
      fx.bolt(prev, f.center(), { color: c, life: 0.2, jitter: 0.1, segs: 6, light: false }); ghost(ctx, prev, c);
      const d0 = tp.clone().sub(f.pos).setY(0); if (d0.lengthSq() > 0.01) A.face = f.yaw = yawOf(d0);
      ctx.anim('2H_Ranged_Aiming', 1.2, { fade: 0.05 });
      charge(ctx, c, 0.42, 2.4); ctx.sfx('charge', { len: 0.45, g: 0.9 });
      fx.decal(new V3(tp.x, 0, tp.z), 'circle', { r: tr + 3, color: c, dur: 0.42, hold: 0.1, world: false });
      ctx.later(0.42, () => {
        track();
        ctx.anim('2H_Ranged_Shoot', 1.6, { fade: 0.02 });
        const from = f.center().add(new V3(0, 0.25, 0)), aimP = tp.clone().setY(Math.max(0.9, tp.y)), d = aimP.clone().sub(from).normalize();
        muzzle(ctx, d, c, 2.2); recoil(ctx, 1.6); ctx.shake(0.5);
        if (own(f)) A.vel.copy(d).setY(0).multiplyScalar(-9);
        ctx.sfx('swingBig', { rate: 0.6, g: 1 }); ctx.sfx('boom', { rate: 1.9, g: 0.6, len: 0.4 });
        lob(ctx, from, aimP, Math.max(0.06, from.distanceTo(aimP) / 120), { color: c, scale: 2.8, h: 0, trailW: 2.2, stick: false, dust: false, onHit: (q) => {
          if (H.impact) H.impact(ctx, q, c, 2.4, { pillar: true }); else blast(ctx, q, c, 5, 0, null, { debris: true });
          fx.ring(new V3(q.x, 0.05, q.z), { r1: 12, color: 0xffffff, life: 0.6, width: 0.08 });
          ctx.hitstop(0.16); ctx.shake(1.0);
          ctx.hitSphere(q, tr + 2.5, ctx.dmg(120) * (lv >= 5 ? 6 : 3), { crit: true, posture: 8, launch: 8, kb: 6 });
          if (lv >= 3) ctx.hitLine(from, from.clone().addScaledVector(d, from.distanceTo(aimP) + 12), 1.4, ctx.dmg(120), { posture: 2, kb: 4 });
          plant(ctx, q.clone(), d, c, 2.5, 2.4, true);
          if (bouquet) stuck.forEach((it, j) => ctx.later(0.25 + j * 0.03, () => { const p = it.obj.position.clone(); fx.kill(it); blast(ctx, p, c, 2.4, ctx.dmg(60), { posture: 1 }, { shake: 0.08 }); }));
        } });
      });
    });
  });

  /* =====================================================================
     AUTRES POUVOIRS
     ===================================================================== */

  // ---------- Flèche sismique ----------
  def('onde', 'Flèche sismique', 'Tir chargé qui se plante dans le sol visé : un séisme projette tout en l\'air. Niv. 3 : zone plus large et une réplique qui étourdit. Niv. 5 : la flèche se divise en 3 séismes de plus.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, p = ctx.clampAim(20), R = lv >= 3 ? 8.4 : 6, yaw = ctx.face(), T0 = 0.24;
    ctx.anim('2H_Ranged_Aiming', 1.6, { fade: 0.05 });
    const A = ctx.act({ dur: T0 + 0.3, face: yaw, vel: new V3(), update: (t, dt) => { A.vel.multiplyScalar(Math.max(0, 1 - dt * 8)); } });
    charge(ctx, c, T0, 1.4); ctx.sfx('charge', { len: 0.3, g: 0.6 });
    const fl = clamp(f.center().distanceTo(p) / 40, 0.18, 0.55);
    fx.decal(p, 'circle', { r: R, color: c, dur: T0 + fl, hold: 0.1, world: false });
    const quake = (q, r, dmg, k) => {
      const g = new V3(q.x, 0.05, q.z);
      fx.flash(g.clone().setY(0.6), { color: c, r: r * 0.4, life: 0.25, intensity: 6 * k });
      fx.ring(g, { r0: 0.4, r1: r, color: c, life: 0.45, width: 0.35 }); fx.ring(g, { r0: 0.2, r1: r * 0.6, color: 0xffffff, life: 0.3, width: 0.4 });
      for (let j = 0; j < 18; j++) { const a = j / 18 * 6.283; fx.spark(g.clone().setY(0.2), new V3(Math.sin(a) * r * 2, 5, Math.cos(a) * r * 2), { color: 0x7a6a5a, kind: 'smoke', life: 0.5, size: 0.7, size1: 1.2, grav: 18, alpha: 0.8 }); }
      fx.burst(g, { n: 16, color: 0x3a3430, kind: 'smoke', speed: 5 * k, up: 0.4, life: 1, size: 1.2 * k, size1: 2.6 * k, grav: -0.5, drag: 2, alpha: 0.6 });
      if (fx.debris) fx.debris(g, { n: Math.round(14 * k), r: 1.2 * k, speed: 11 * k, size: 0.3 * k });
      ctx.sfx('stomp', { g: 0.9 * k }); ctx.sfx('boom', { rate: 1.2, g: 0.5 * k, len: 0.6 }); ctx.shake(0.45 * k);
      const hh = ctx.hitSphere(g.clone().setY(1), r, dmg, { launch: 7 * k, kb: 6, posture: 3 * k });
      if (hh.length) ctx.hitstop(0.07 * k);
    };
    ctx.later(T0, () => {
      ctx.anim('2H_Ranged_Shoot', 1.8, { fade: 0.02 });
      const from = f.center().add(new V3(0, 0.3, 0)), d = p.clone().sub(from).normalize();
      muzzle(ctx, d, c, 1.5); ctx.shake(0.2); ctx.sfx('swingBig', { rate: 0.9 }); ctx.sfx('swing', { rate: 1.4 });
      if (own(f)) A.vel.copy(d).setY(0).normalize().multiplyScalar(-7);
      lob(ctx, from, p.clone().setY(0.02), fl, { color: c, scale: 1.8, h: 2.5, trailW: 1.5, stickT: 1.8, onHit: (q) => {
        quake(q, R, ctx.dmg(220), 1);
        if (lv >= 3) ctx.later(0.35, () => { fx.ring(new V3(q.x, 0.05, q.z), { r0: R * 0.3, r1: R * 0.85, color: c, life: 0.35, width: 0.2 }); ctx.sfx('stomp', { g: 0.5 }); ctx.shake(0.2); ctx.hitSphere(new V3(q.x, 1, q.z), R * 0.8, ctx.dmg(80), { stun: 0.5, posture: 1 }); });
        if (lv >= 5) for (let k = 0; k < 3; k++) {
          const a = yaw + k * 2.094, q2 = new V3(q.x + Math.sin(a) * 4.5, 0.02, q.z + Math.cos(a) * 4.5);
          ctx.later(0.2 + k * 0.1, () => lob(ctx, new V3(q.x, 1.5, q.z), q2, 0.35, { color: c, scale: 1.2, h: 3.5, stickT: 1.2, onHit: (q3) => quake(q3, 3.5, ctx.dmg(110), 0.6) }));
        }
      } });
    });
  });

  // ---------- Saut de l'aigle ----------
  def('bond', 'Saut de l\'aigle', 'Salto arrière de 8 m (invulnérable) en faisant pleuvoir une volée de flèches explosives sur la zone visée. Niv. 3 : 8 flèches à fragmentation, explosions plus larges. Niv. 5 : l\'atterrissage repousse tout et réduit tes recharges.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, d = ctx.dirToAim(), yaw = yawOf(d), p0 = f.pos.clone(), target = ctx.clampAim(20), D = 0.75, R1 = rng(ctx, 5);
    f.inv = Math.max(f.inv || 0, D + 0.1);
    ctx.anim('Jump_Start', 1.6, { fade: 0.04 }); ctx.sfx('jump', { g: 1.2 }); ctx.sfx('dash', { rate: 0.8 });
    f.spin = { kind: 'flipB', t: 0, dur: 0.55 };
    fx.burst(p0.clone().setY(0.2), { n: 14, color: 0x8a7a6a, kind: 'smoke', speed: 5, up: 0.3, life: 0.6, size: 0.5, size1: 1.3, grav: -0.3, alpha: 0.5 });
    fx.ring(p0.clone(), { r0: 0.3, r1: 3, color: c, life: 0.3, width: 0.25 });
    const land = () => {
      ctx.anim('Jump_Land', 1.6); ctx.sfx('land', { g: 0.8 });
      fx.burst(f.pos.clone().setY(0.15), { n: 10, color: 0x8a7a6a, kind: 'smoke', speed: 3, up: 0.3, life: 0.5, size: 0.4, size1: 1.1, grav: -0.3, alpha: 0.45 });
      if (lv >= 5) {
        const q = f.pos.clone();
        fx.ring(q, { r0: 0.4, r1: 5, color: 0xffffff, life: 0.35, width: 0.2 }); fx.burst(q.clone().setY(0.6), { n: 24, color: c, speed: 10, life: 0.4, flat: true });
        ctx.sfx('swingBig', { rate: 1.2 }); ctx.shake(0.2);
        ctx.hitSphere(q.clone().setY(1), 4.5, ctx.dmg(60), { kb: 8, launch: 3 });
        if (own(f) && f.cds) for (const k in f.cds) f.cds[k] = Math.max(0, f.cds[k] - 1);
      }
    };
    ctx.act({ dur: D, lockMove: true, float: true, face: yaw, vel: new V3(), update: (t) => {
      const u = Math.min(1, t / D);
      if (own(f)) { f.pos.x = p0.x - d.x * 8 * u; f.pos.z = p0.z - d.z * 8 * u; f.pos.y = Math.sin(u * Math.PI) * 5; f.vel.set(0, 0, 0); }
      if (Math.random() < 0.6) fx.spark(f.center(), new V3(rnd(-0.5, 0.5), -1, rnd(-0.5, 0.5)), { color: c, life: 0.4, size: 0.45, size1: 0.05 });
    }, onEnd: () => { if (own(f)) { f.pos.y = 0; ctx.confine(); } land(); } });
    const n = lv >= 3 ? 8 : 5, R = lv >= 3 ? 3 : 2.6;
    fx.decal(target, 'circle', { r: 4.5, color: c, dur: 0.6, hold: 0.4, world: false });
    let first = true;
    for (let i = 0; i < n; i++) ctx.later(0.22 + i * 0.05, () => {
      const a = R1() * 6.283, r = Math.sqrt(R1()) * 3.2, q = new V3(target.x + Math.cos(a) * r, 0.02, target.z + Math.sin(a) * r);
      if (i === 0) ctx.anim('2H_Ranged_Shooting', 2.6, { fade: 0.03 });
      const from = f.center().add(new V3(0, 0.2, 0)), dd = q.clone().sub(from).normalize();
      muzzle(ctx, dd, c, 0.8); snd(ctx, 'swing', { rate: 1.8 + i * 0.1, g: 0.6 }, 20);
      lob(ctx, from, q, clamp(from.distanceTo(q) / 48, 0.15, 0.45), { color: c, scale: 1.2, h: 1.2, stick: false, onHit: (pp) => {
        const hh = blast(ctx, pp, c, R, ctx.dmg(110), { kb: 3, posture: 1 }, { debris: lv >= 3, shake: 0.12 });
        if (lv >= 3) for (let k = 0; k < 4; k++) fx.spark(pp.clone().setY(0.5), new V3(Math.cos(k * 1.57 + a) * 9, 6, Math.sin(k * 1.57 + a) * 9), { color: c, life: 0.5, size: 0.35, grav: 20 });
        if (hh.length && first) { first = false; ctx.hitstop(0.05); }
      } });
    });
  });

  // ---------- Rempart de flèches (défense) ----------
  def('garde', 'Rempart de flèches', 'Repousse ce qui te colle et t\'entoure d\'un bouclier hérissé de 8 flèches : chaque coup encaissé en renvoie une sur l\'ennemi le plus proche. Niv. 3 : bouclier plus solide. Niv. 5 : à la fin, les flèches restantes partent toutes et les dégâts absorbés explosent.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, dur = 3, N = 8;
    f.shield = lv >= 3 ? 700 : 400; f.shieldStore = 0;
    ctx.anim('Block', 1.4); ctx.sfx('magic', { rate: 0.5 }); ctx.sfx('block', { g: 0.8 });
    const p0 = f.center();
    fx.ring(f.pos.clone(), { r0: 0.4, r1: 4, color: c, life: 0.3, width: 0.3 }); fx.flash(p0, { color: c, r: 1.6, life: 0.2, intensity: 4 });
    fx.burst(p0, { n: 24, color: c, speed: 10, life: 0.35, flat: true });
    ctx.hitSphere(p0, 3.2, ctx.dmg(40), { kb: 6, posture: 1 });
    const grp = new THREE.Group(), arrows = [];
    for (let i = 0; i < N; i++) { const m = X.arrowMesh(c, 1.1); grp.add(m); arrows.push({ m, ok: true }); }
    let shell = null;
    if (H.shellMat) { shell = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), H.shellMat(c, 2.2, 0.8)); shell.geometry.userData.own = true; grp.add(shell); }
    let last = -9;
    const fire = (a, tgt) => {
      a.ok = false; a.m.visible = false;
      const from = a.m.getWorldPosition(new V3()), dd = tgt.pos.clone().sub(from).normalize();
      fx.flash(from, { color: c, r: 0.5, life: 0.12, light: false });
      snd(ctx, 'swing', { rate: 2.2, g: 0.6 }, 20);
      arrow(ctx, dd, { from, dmg: ctx.dmg(120), hit: { kb: 3, posture: 1 }, speed: 60, homing: 6, life: 0.8, trail: true, stick: false });
    };
    const handler = () => {
      const now = ctx.S ? ctx.S.t : 0; if (now - last < 0.25) return; last = now;
      const t = ctx.nearest(f.pos, 18), a = arrows.find(x => x.ok); if (!t || !a) return;
      fire(a, t);
    };
    f.onShieldHit = handler;
    fx.add(grp, dur, (k, o, dt, t) => {
      o.position.copy(f.center());
      arrows.forEach((a, i) => { const ang = t * 2.2 + i / N * 6.283, cs = Math.cos(ang), sn = Math.sin(ang); a.m.position.set(cs * 1.5, Math.sin(t * 3 + i) * 0.25, sn * 1.5); a.m.rotation.set(0, Math.atan2(cs, sn), 0); });
      if (shell) { shell.material.uniforms.uTime.value = t; shell.material.uniforms.uA.value = (f.shield > 0 ? 0.8 : 0.15) * Math.min(1, t * 5, (dur - t) * 4); }
    }, false, () => {
      if (f.onShieldHit === handler) f.onShieldHit = null;
      const stored = f.shieldStore || 0; f.shield = 0;
      if (lv >= 5 && live(ctx)) {
        const es = ctx.enemies().filter(e => e.pos.distanceTo(f.pos) < 20).sort((a, b) => a.pos.distanceTo(f.pos) - b.pos.distanceTo(f.pos));
        if (es.length) arrows.filter(a => a.ok).forEach((a, i) => fire(a, es[i % es.length]));
        if (stored > 0) { blast(ctx, f.center(), c, 5, 0, null, { shake: 0.4 }); ctx.hitSphere(f.center(), 5, stored * 2, { raw: true }); }
      }
    });
  });

  // ---------- Flèche foudroyante ----------
  def('chaine', 'Flèche foudroyante', 'Une flèche chargée de foudre : à l\'impact, l\'éclair rebondit sur 4 ennemis et les étourdit. Niv. 3 : 7 rebonds. Niv. 5 : un second éclair tombe du ciel sur chaque ennemi touché.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 3 ? 7 : 4, yaw = ctx.face(), T0 = 0.18;
    ctx.anim('2H_Ranged_Aiming', 2, { fade: 0.05 }); ctx.act({ dur: T0 + 0.25, face: yaw });
    charge(ctx, c, T0, 1.1); ctx.sfx('zap', { g: 0.5 });
    ctx.every(T0, 0.05, () => { const p = tip(f); fx.bolt(p, p.clone().add(new V3(rnd(-0.8, 0.8), rnd(-0.8, 0.8), rnd(-0.8, 0.8))), { color: c, life: 0.07, light: false, segs: 4, jitter: 0.8 }); });
    ctx.later(T0, () => {
      ctx.anim('2H_Ranged_Shoot', 2.6, { fade: 0.02 });
      const d = aimD(ctx); muzzle(ctx, d, c, 1.2); ctx.sfx('zap', { g: 0.8 }); ctx.sfx('swing', { rate: 1.8 });
      arrow(ctx, d, { dmg: ctx.dmg(200), hit: { stun: 0.2, posture: 1.2 }, speed: 62, homing: 2.5, life: 1.2, trail: true, scale: 1.2,
        onUpdate: (p) => { if (Math.random() < 0.5) fx.bolt(p.pos, p.pos.clone().add(new V3(rnd(-1, 1), rnd(-0.6, 0.6), rnd(-1, 1))), { color: c, life: 0.06, light: false, segs: 4 }); },
        onHit: (p, t) => {
          ctx.hitstop(0.05); ctx.shake(0.2);
          X.bolt(ctx, t.pos.clone().add(new V3(0, 12, 0)), t.pos.clone(), c); fx.flash(t.pos.clone(), { color: c, r: 1.4, life: 0.2, intensity: 5 });
          const seen = new Set([gk(t)]); let from = t.pos.clone();
          for (let i = 0; i < n; i++) {
            const src = from;
            const nx = ctx.enemies().filter(e => !seen.has(gk(e))).sort((x, y) => x.pos.distanceTo(src) - y.pos.distanceTo(src))[0];
            if (!nx || nx.pos.distanceTo(src) > 12) break;
            seen.add(gk(nx));
            const a = src.clone(), b = nx.pos.clone(), tgt = nx;
            ctx.later(0.06 + i * 0.07, () => {
              X.bolt(ctx, a, b, c); X.puff(ctx, b, c, 0.6); snd(ctx, 'zap', { g: 0.5 }, 30);
              ctx.hitTarget(tgt, ctx.dmg(170) * (1 + (lv >= 5 ? 0.15 * i : 0)), { stun: 0.2, posture: 0.6 });
              if (lv >= 5) ctx.later(0.6, () => { const q = tgt.pos.clone(); X.bolt(ctx, q.clone().add(new V3(rnd(-1, 1), 14, rnd(-1, 1))), q, c); fx.ring(new V3(q.x, 0.05, q.z), { r1: 2.4, color: c, life: 0.3 }); ctx.hitSphere(q, 2, ctx.dmg(80), { stun: 0.3 }); });
            });
            from = b;
          }
        } });
    });
  });

  // ---------- Flèche de givre ----------
  def('lance', 'Flèche de givre', 'Tir chargé perforant qui gèle tout sur sa trajectoire et laisse un sillage de pics de glace. Niv. 3 : chaque impact éclate en zone gelée. Niv. 5 : 3 flèches en éventail.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 5 ? 3 : 1, yaw = ctx.face(), T0 = 0.26;
    ctx.anim('2H_Ranged_Aiming', 1.6, { fade: 0.05 });
    const A = ctx.act({ dur: T0 + 0.3, face: yaw, vel: new V3(), update: (t, dt) => { A.vel.multiplyScalar(Math.max(0, 1 - dt * 8)); } });
    charge(ctx, c, T0, 1.3); ctx.sfx('ice', { g: 0.6 });
    ctx.every(T0, 0.04, () => { const p = tip(f), q = p.clone().add(new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(1.2)); fx.spark(q, p.clone().sub(q).multiplyScalar(5), { color: 0xdff8ff, life: 0.2, size: 0.25 }); });
    ctx.later(T0, () => {
      ctx.anim('2H_Ranged_Shoot', 1.8, { fade: 0.02 }); ctx.sfx('ice', { g: 1 }); ctx.sfx('swingBig', { rate: 1.6, g: 0.6 });
      const d0 = aimD(ctx); muzzle(ctx, d0, c, 1.5); ctx.shake(0.2);
      if (own(f)) A.vel.copy(d0).setY(0).multiplyScalar(-6);
      for (let i = 0; i < n; i++) {
        const d = d0.clone().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.22); let acc = 0, hs = true;
        arrow(ctx, d, { dmg: ctx.dmg(340), hit: { freeze: 1, posture: 1.5, kb: 2 }, speed: 58, pierce: true, life: 1.0, scale: 1.5, trail: true,
          onUpdate: (p, dt) => { acc += dt; if (acc > 0.05 && p.pos.y < 3) { acc = 0; spike(ctx, new V3(p.pos.x, 0, p.pos.z), c); } },
          onHit: (p) => {
            fx.burst(p.pos, { n: 22, color: 0xcff6ff, speed: 10, life: 0.5, size: 0.3, grav: 12 }); snd(ctx, 'ice', { g: 0.5 }, 40);
            if (hs) { hs = false; ctx.hitstop(0.04); }
            if (lv >= 3) { X.puff(ctx, p.pos.clone(), c, 0.9); for (let k = 0; k < 3; k++) spike(ctx, new V3(p.pos.x, 0, p.pos.z), c); ctx.hitSphere(p.pos.clone(), 2.6, ctx.dmg(120), { freeze: 0.8 }); }
          } });
      }
    });
  });

  // ---------- Pas de l'ombre ----------
  def('ombre', 'Pas de l\'ombre', 'Tu disparais dans la fumée et réapparais derrière ta cible pour un tir à bout portant critique qui la repousse. Niv. 3 : laisse un leurre piégé qui explose. Niv. 5 : deux téléportations.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv;
    const decoy = (pos) => {
      let img = null;
      try { img = ctx.fighter({ id: 'leurre', look: (f.av && f.av.look) || undefined, kind: 'summon', ghost: '#7a40ff' }); } catch (e) { img = null; }
      if (img) { img.pos.copy(pos).setY(0); img.yaw = f.yaw; img.play('2H_Ranged_Aiming', 0.5); }
      fx.add(new THREE.Group(), 2, (k, o, dt) => { if (img) img.update(dt, { speed: 0 }); if (Math.random() < 0.3) fx.spark(pos.clone().add(new V3(rnd(-0.4, 0.4), rnd(0.2, 1.8), rnd(-0.4, 0.4))), new V3(0, 1, 0), { color: c, life: 0.5, size: 0.4, size1: 0.05 }); }, false, () => {
        if (img) { try { img.dispose(); } catch (e) { /* déjà détruit */ } }
        if (live(ctx)) { smoke(ctx, pos.clone().setY(1), c); blast(ctx, pos, c, 3, ctx.dmg(120), { stun: 0.4, kb: 4, posture: 1 }, { shake: 0.2 }); }
      });
    };
    const hop = (delay, idx) => ctx.later(delay, () => {
      const t = ctx.lockTarget(), before = f.center();
      smoke(ctx, before, c);
      let dst, look;
      if (t) { const away = f.pos.clone().sub(t.pos).setY(0); if (away.lengthSq() < 0.01) away.copy(f.fwd()).negate(); away.normalize(); dst = t.pos.clone().addScaledVector(away, -((t.r || 1) + 2.2)); dst.y = 0; look = t.pos.clone(); }
      else { const d = ctx.dirToAim(); dst = f.pos.clone().addScaledVector(d, 8); dst.y = 0; look = dst.clone().addScaledVector(d, 5).setY(1); }
      f.inv = Math.max(f.inv || 0, 0.5);
      if (own(f)) { f.pos.copy(dst); f.vel.set(0, 0, 0); ctx.confine(); }
      const yy = yawOf(look.clone().sub(f.pos)); f.yaw = yy;
      smoke(ctx, f.center(), c); fx.bolt(before, f.center(), { color: c, life: 0.15, jitter: 0.3, light: false });
      ctx.sfx('dash', { rate: 0.7 }); ctx.sfx('magic', { rate: 0.5, g: 0.5 });
      ctx.anim('2H_Ranged_Aiming', 3, { fade: 0.02 }); ctx.act({ dur: 0.36, face: yy });
      ctx.later(0.12, () => {
        ctx.anim('2H_Ranged_Shoot', 2.4, { fade: 0.02 });
        const from = f.center().add(new V3(0, 0.2, 0)), aimP = t ? t.pos.clone().setY(Math.max(0.9, t.pos.y)) : look.clone(), d = aimP.clone().sub(from).normalize();
        muzzle(ctx, d, c, 1.6); recoil(ctx, 1.4);
        ctx.sfx('crit'); ctx.sfx('swingBig', { rate: 1.3, g: 0.7 });
        lob(ctx, from, aimP, Math.max(0.05, from.distanceTo(aimP) / 90), { color: c, scale: 1.4, h: 0, stick: false, dust: false, trailW: 1.4, onHit: (q) => {
          fx.flash(q, { color: c, r: 1.4, life: 0.2, intensity: 5 }); fx.burst(q, { n: 24, color: c, speed: 11, life: 0.35 });
          if (t) { ctx.hitTarget(t, ctx.dmg(380), { crit: true, posture: 2, kb: 7 }); ctx.hitstop(0.09); ctx.shake(0.35); }
          else ctx.hitSphere(q, 1.8, ctx.dmg(200), { kb: 5 });
        } });
      });
      if (idx === 0 && lv >= 3) decoy(before.clone().setY(0));
    });
    hop(0, 0); if (lv >= 5) hop(0.55, 1);
  });

  // ---------- Flèche tornade ----------
  def('tornade', 'Flèche tornade', 'La flèche se plante et se change en tornade qui aspire et broie les ennemis, puis explose en les projetant. Niv. 3 : la tornade chasse les ennemis. Niv. 5 : deux tornades.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, p = ctx.clampAim(20), n = lv >= 5 ? 2 : 1, yaw = ctx.face(), T0 = 0.18;
    const dirH = ctx.dirToAim();
    ctx.anim('2H_Ranged_Aiming', 2, { fade: 0.05 }); ctx.act({ dur: T0 + 0.3, face: yaw });
    charge(ctx, c, T0, 1.1); ctx.sfx('swingBig', { rate: 1.8, g: 0.5 });
    const twister = (q0) => {
      const dur = 4, grp = new THREE.Group(), mats = [], caught = [], q = q0.clone();
      if (H.shellMat) for (let k = 0; k < 5; k++) { const m = H.shellMat(c, 1.5, 0.5); mats.push(m); const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + k * 0.45, 0.3 + k * 0.4, 1.6, 16, 1, true), m); cone.geometry.userData.own = true; cone.position.y = 0.8 + k * 1.3; grp.add(cone); }
      for (let k = 0; k < 4; k++) { const a = X.arrowMesh(c, 0.9); grp.add(a); caught.push(a); }
      grp.position.copy(q).setY(0);
      const loop = BR.Audio && BR.Audio.loopFx ? BR.Audio.loopFx('wind') : null; if (loop) loop.set(f.kind === 'local' ? 0.8 : 0.3);
      fx.ring(new V3(q.x, 0.05, q.z), { r0: 0.3, r1: 4, color: c, life: 0.4 }); fx.burst(new V3(q.x, 0.5, q.z), { n: 30, color: c, speed: 9, life: 0.4 });
      const Rm = (ctx.arenaR || 30) - 1;
      fx.add(grp, dur, (k, o, dt, t) => {
        const tg = lv >= 3 ? ctx.nearest(o.position, 25) : null;
        if (tg) { const dd = tg.pos.clone().setY(0).sub(o.position).setY(0); if (dd.length() > 0.5) o.position.addScaledVector(dd.normalize(), dt * 6); }
        else o.position.addScaledVector(dirH, dt * 2.5);
        const r = Math.hypot(o.position.x, o.position.z); if (r > Rm) { o.position.x *= Rm / r; o.position.z *= Rm / r; }
        o.children.forEach((ch, j) => { if (j < mats.length) { ch.rotation.y += dt * (8 + j * 2); ch.position.x = Math.sin(t * 6 + j) * 0.15 * j; } });
        mats.forEach(m => { m.uniforms.uTime.value = t; m.uniforms.uA.value = 0.55 * Math.min(1, t * 4, (dur - t) * 3); });
        caught.forEach((a, j) => { const ang = t * 7 + j * 1.57, rr = 1 + j * 0.45, y = 1.2 + j * 1.2 + Math.sin(t * 3 + j) * 0.4; a.position.set(Math.cos(ang) * rr, y, Math.sin(ang) * rr); a.rotation.set(0.3, Math.atan2(-Math.sin(ang), Math.cos(ang)), 0); });
        for (let s = 0; s < 3; s++) { const a = Math.random() * 6.283, rr = rnd(0.5, 2.6), y = rnd(0, 6); fx.spark(o.position.clone().add(new V3(Math.cos(a) * rr, y, Math.sin(a) * rr)), new V3(-Math.sin(a) * 8, 3, Math.cos(a) * 8), { color: c, life: 0.4, size: 0.3 }); }
        if (Math.random() < dt * 12) fx.spark(o.position.clone().add(new V3(rnd(-1.5, 1.5), 0.2, rnd(-1.5, 1.5))), new V3(rnd(-2, 2), 2, rnd(-2, 2)), { kind: 'smoke', color: 0x8a7a6a, life: 0.8, size: 0.8, size1: 1.6, alpha: 0.5 });
      }, false, () => {
        if (loop) loop.stop();
        if (live(ctx)) blast(ctx, grp.position.clone(), c, 4, ctx.dmg(90), { kb: 8, launch: 5, posture: 2 }, { debris: true, shake: 0.3 });
      });
      ctx.every(dur, 0.3, () => ctx.hitSphere(grp.position.clone().setY(1.5), 3, ctx.dmg(60), { kb: -1.5, freeze: 0.3, posture: 0.4 }));   // recul net nul (le moteur pousse depuis le lanceur) + ralenti : la tornade les retient
    };
    ctx.later(T0, () => {
      ctx.anim('2H_Ranged_Shoot', 2.2, { fade: 0.02 });
      const from = f.center().add(new V3(0, 0.3, 0)), d = p.clone().sub(from).normalize();
      muzzle(ctx, d, c, 1.1); ctx.sfx('swing', { rate: 0.9 });
      lob(ctx, from, p.clone().setY(0.02), clamp(from.distanceTo(p) / 42, 0.15, 0.5), { color: c, scale: 1.4, h: 1.5, stickT: 4.2, onHit: (q) => {
        for (let j = 0; j < n; j++) twister(q.clone().add(new V3(j ? 3 : 0, 0, j ? 1.5 : 0)));
      } });
    });
  });

  // ---------- Flèche de vie (soin) ----------
  def('soin', 'Flèche de vie', 'Plante une flèche de vie là où tu vises (8 m max) : les alliés dans la zone sont soignés pendant 5 s et encaissent moins. Niv. 3 : soin renforcé, les ennemis dans la zone sont ralentis. Niv. 5 : relève aussi les alliés à terre.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, p = ctx.clampAim(8), pct = lv >= 3 ? 0.45 : 0.3, R = 5.4, dur = 5, T0 = 0.2;
    ctx.anim('2H_Ranged_Aiming', 1.8, { fade: 0.05 }); ctx.act({ dur: T0 + 0.3, face: ctx.face() }); ctx.sfx('magic', { rate: 1.2, g: 0.6 });
    charge(ctx, c, T0, 1);
    ctx.later(T0, () => {
      ctx.anim('2H_Ranged_Shoot', 2, { fade: 0.03 });
      const from = f.center().add(new V3(0, 0.4, 0));
      muzzle(ctx, UP.clone(), c, 1); ctx.sfx('swing', { rate: 1.2 });
      lob(ctx, from, p.clone().setY(0.02), 0.45, { color: c, scale: 1.8, h: 5, stickT: dur + 0.3, trailW: 1.4, onHit: (q) => {
        ctx.sfx('heal');
        fx.pillar(q, { color: c, r: R, h: 10, life: 0.8, grow: 0.1, alpha: 0.5 });
        fx.flash(q.clone().setY(1), { color: c, r: 2, life: 0.3, intensity: 4 }); fx.ring(q, { r0: 0.3, r1: R, color: c, life: 0.4, width: 0.25 });
        fx.decal(q, 'ring', { r: R, inner: 0.9, color: c, dur: 0.3, hold: dur - 0.3, world: false, noWarn: true });
        ctx.zone({ pos: q, life: dur, iv: 0.5, onTick: z => {
          for (const a of ctx.allies()) if (a.pos.distanceTo(z.pos) < R) { ctx.heal(a, a.maxHp * pct / 10); a.buff.sanct = 1; a.buff.sanctT = 0.6; fx.spark(a.center(), new V3(rnd(-0.5, 0.5), 3, rnd(-0.5, 0.5)), { color: c, life: 0.6, size: 0.5, size1: 0.05 }); }
          if (lv >= 5 && ctx.S && ctx.S.fighters) for (const a of ctx.S.fighters.values()) if (a.team === f.team && !a.alive && a.kind === 'local' && a.pos.distanceTo(z.pos) < R) { a.alive = true; a.down = false; a.hp = a.maxHp * 0.5; a.play('Lie_StandUp', 1.5); fx.pillar(a.pos.clone(), { color: c, r: 1.2, h: 12, life: 0.8 }); }
          if (lv >= 3 && Math.round(z.t * 2) % 2 === 0) ctx.hitSphere(z.pos.clone().setY(1), R, ctx.dmg(15), { freeze: 0.6 });
          for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283, r = Math.random() * R; fx.spark(z.pos.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new V3(0, rnd(2, 5), 0), { color: c, life: 0.9, size: 0.45, size1: 0.05 }); }
        } });
      } });
    });
  });

  // ---------- Carquois spectral ----------
  def('fantomes', 'Carquois spectral', '6 flèches spectrales tournent autour de toi pendant 8 s et partent seules sur l\'ennemi le plus proche (plus vite quand tu attaques), puis se reforment. Niv. 3 : 10 flèches. Niv. 5 : chaque flèche rebondit en éclair sur un 2e ennemi.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 3 ? 10 : 6, dur = 8, S0 = 1.15;
    ctx.anim('2H_Ranged_Reload', 1.4); ctx.sfx('magic', { rate: 1.4 }); ctx.sfx('reveal', { rate: 1.5, g: 0.4 });
    fx.ring(f.pos.clone(), { r0: 0.3, r1: 3, color: c, life: 0.4, width: 0.25 }); fx.flash(f.center(), { color: c, r: 1.5, life: 0.25 });
    const grp = new THREE.Group(), arr = [];
    for (let i = 0; i < n; i++) { const m = X.arrowMesh(c, S0); m.scale.setScalar(0.01); grp.add(m); arr.push({ m, cd: 0 }); }
    const fire = (a, tg) => {
      a.cd = 1.6;
      const from = a.m.getWorldPosition(new V3()), d = tg.pos.clone().sub(from).normalize();
      a.m.scale.setScalar(0.01);
      fx.flash(from, { color: c, r: 0.5, life: 0.12, light: false }); snd(ctx, 'swing', { rate: 2.3, g: 0.5 }, 30);
      arrow(ctx, d, { from, dmg: ctx.dmg(85) * (lv >= 5 ? 1.3 : 1), hit: { posture: 0.5 }, speed: 42, homing: 8, life: 1.2, scale: 1.1, trail: true, stick: false,
        onHit: (p, t) => {
          if (lv < 5) return;
          const key = gk(t), o2 = ctx.enemies().find(e => gk(e) !== key && e.pos.distanceTo(t.pos) < 9);
          if (o2) { X.bolt(ctx, t.pos.clone(), o2.pos.clone(), c); ctx.hitTarget(o2, ctx.dmg(45), { stun: 0.1 }); }
        } });
    };
    let next = 0.4;
    fx.add(grp, dur, (k, o, dt, t) => {
      o.position.set(f.pos.x, f.pos.y + 1.7, f.pos.z);
      arr.forEach((a, i) => {
        const ang = t * 2.4 + i / n * 6.283, cs = Math.cos(ang), sn = Math.sin(ang);
        a.m.position.set(cs * 1.7, Math.sin(t * 3 + i) * 0.22, sn * 1.7); a.m.rotation.set(0, Math.atan2(-sn, cs), 0);
        if (a.cd > 0) { a.cd -= dt; if (a.cd <= 0) fx.spark(a.m.getWorldPosition(new V3()), new V3(0, 1, 0), { color: c, life: 0.3, size: 0.6, size1: 0.05 }); }
        else a.m.scale.setScalar(Math.min(S0, a.m.scale.x + dt * 6));
      });
      next -= dt;
      if (next <= 0 && f.alive !== false && live(ctx)) {
        const tg = ctx.nearest(f.pos, 22), a = arr.find(x => x.cd <= 0 && x.m.scale.x > S0 * 0.8);
        if (tg && a) { fire(a, tg); next = (f.attacking && f.attacking()) ? 0.25 : 0.55; } else next = 0.1;
      }
    });
  });

  // ---------- Sentinelle spectrale (double) ----------
  def('clone', 'Sentinelle spectrale', 'Un double spectral arbalète en main te suit 8 s : il tire seul sur les ennemis proches, imite tes tirs et relance tes pouvoirs. Niv. 3 : il frappe plus fort. Niv. 5 : deux doubles.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 5 ? 2 : 1, mul = lv >= 3 ? 0.9 : 0.6, dur = 8;
    ctx.anim('2H_Ranged_Reload', 1.6); ctx.sfx('magic', { rate: 0.6 }); ctx.sfx('reveal', { g: 0.4 });
    for (let i = 0; i < n; i++) {
      let cl = null;
      try { cl = ctx.fighter({ id: 'clone' + i, look: (f.av && f.av.look) || undefined, kind: 'summon', weapon: f.weaponId || 'bow', ghost: c }); } catch (e) { cl = null; }
      if (!cl) continue;
      cl.owner = f; cl.summonMul = mul; cl.team = f.team; cl.isClone = true; cl.kit = f.kit; cl.lv = f.lv; cl.ctl = { aim: ctx.aim.clone(), move: new V3() };
      const side = i === 0 ? 1 : -1;
      cl.pos.copy(f.pos).add(new V3(Math.cos(f.yaw) * side * 1.8, 0, -Math.sin(f.yaw) * side * 1.8)); cl.pos.y = 0; cl.yaw = f.yaw;
      fx.burst(cl.center(), { n: 40, color: c, speed: 8, life: 0.5 }); fx.pillar(cl.pos.clone(), { color: c, r: 0.9, h: 6, life: 0.5 });
      const api = BR.Arena && BR.Arena.api ? BR.Arena.api(cl, ctx.auth, ctx.lv, ctx.aim, 'clone') : null;
      let life = dur, lastAct = null, shotT = 0.5 + i * 0.25;
      const shootAt = (tp) => {
        if (!api) return;
        const from = cl.center().add(new V3(0, 0.2, 0)), d = tp.clone().setY(Math.max(0.9, tp.y || 0)).sub(from); if (d.lengthSq() < 0.01) return; d.normalize();
        cl.yaw = yawOf(d); cl.play('2H_Ranged_Shoot', 2.4, { fade: 0.03 });
        muzzle(api, d, c, 0.8); snd(ctx, 'swing', { rate: 2, g: 0.5 }, 30);
        arrow(api, d, { from: from.addScaledVector(d, 0.6), dmg: ctx.dmg(60), hit: { posture: 0.5, kb: 1.5 }, speed: 56, homing: 3, life: 1.1, trail: true, color: c });
      };
      const sum = {
        team: f.team, isClone: true, owner: f, f: cl,
        mimicSkill(id, lv2, aim) { const impl = BR.ASkills && BR.ASkills[id]; if (!impl || id === 'clone') return; cl.ctl.aim = aim.clone(); try { impl.cast(BR.Arena.api(cl, ctx.auth, lv2, aim, id)); } catch (e) { /* sort raté par le double : sans gravité */ } },
        update(dt) {
          life -= dt; if (life <= 0 || !f.alive) return false;
          const Rv = new V3(Math.cos(f.yaw), 0, -Math.sin(f.yaw)).multiplyScalar(side * 1.8), want = f.pos.clone().add(Rv);
          if (!cl.action) cl.pos.lerp(want, Math.min(1, dt * 6));
          else { const ca = cl.action; ca.t += dt; if (ca.vel) cl.pos.addScaledVector(ca.vel, dt); if (ca.update) ca.update(ca.t, dt); if (ca.face != null) cl.yaw = ca.face; if (cl.action === ca && ca.t >= ca.dur) { const e = ca.onEnd; cl.action = null; if (e) e(); } }
          cl.pos.y = Math.max(0, cl.pos.y);
          const A = f.action;
          if (A && A !== lastAct && A.type === 'attack') { lastAct = A; shootAt((f.ctl && f.ctl.aim) ? f.ctl.aim.clone() : ctx.aim.clone()); shotT = Math.max(shotT, 0.35); }
          else if (!A) lastAct = null;
          shotT -= dt;
          if (shotT <= 0) { const t = api ? api.nearest(cl.pos, 24) : null; shotT = t ? 0.7 : 0.25; if (t && !cl.action) shootAt(t.pos); }
          if (Math.random() < dt * 8) fx.spark(cl.center().add(new V3(rnd(-0.4, 0.4), rnd(-0.8, 0.8), rnd(-0.4, 0.4))), new V3(0, 1, 0), { color: c, life: 0.4, size: 0.3, size1: 0.05 });
          cl.update(dt, { speed: cl.action ? 0 : Math.hypot(f.vel.x, f.vel.z) });
          return true;
        },
        dispose() { fx.burst(cl.center(), { n: 30, color: c, speed: 6, life: 0.5 }); cl.dispose(); },
      };
      ctx.summon(sum);
    }
  });

  // ---------- Flèche singularité ----------
  def('gravite', 'Flèche singularité', 'Une flèche lourde se fige dans les airs et ouvre un trou noir qui aspire et broie tout, puis implose. Niv. 3 : implosion doublée. Niv. 5 : l\'implosion étourdit.', (ctx, orig) => {
    const { f, fx } = ctx, c = ctx.color, p = ctx.clampAim(14), yaw = ctx.face(), T0 = 0.3;
    ctx.anim('2H_Ranged_Aiming', 1.4, { fade: 0.05 }); ctx.act({ dur: T0 + 0.3, face: yaw });
    charge(ctx, c, T0, 1.5); ctx.sfx('charge', { len: 0.4, g: 0.6 });
    ctx.later(T0, () => {
      ctx.anim('2H_Ranged_Shoot', 1.8, { fade: 0.02 });
      const from = f.center().add(new V3(0, 0.3, 0)), q = p.clone().setY(1.6), d = q.clone().sub(from).normalize();
      muzzle(ctx, d, c, 1.4); recoil(ctx, 1.2); ctx.sfx('swingBig', { rate: 0.7 }); ctx.sfx('magic', { rate: 0.4 });
      lob(ctx, from, q, clamp(from.distanceTo(q) / 45, 0.12, 0.4), { color: c, scale: 1.6, h: 0.8, stick: false, dust: false, onHit: (pp, dd) => {
        // la flèche reste figée au cœur de la singularité et tourne sur elle-même
        const m = X.arrowMesh(c, 1.6); m.position.copy(pp); m.lookAt(pp.clone().add(dd));
        fx.add(m, 4.1, (k, o, dt, t) => { o.rotateZ(dt * (4 + t * 6)); o.position.set(pp.x + Math.sin(t * 40) * 0.03, pp.y, pp.z); }, false, () => { if (live(ctx)) fx.burst(pp, { n: 30, color: c, speed: 12, life: 0.4 }); });
        fx.flash(pp, { color: c, r: 1.6, life: 0.25, intensity: 5 });
        orig(X.atPoint(ctx, p));
      } });
    });
  });

  // ---------- Flèche du dragon ----------
  def('dragon', 'Flèche du dragon', 'Tir géant de feu qui te repousse en arrière, transperce toute la ligne et projette les ennemis. Niv. 3 : laisse une traînée brûlante. Niv. 5 : deux flèches.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, yaw = ctx.face(), T0 = 0.36, passes = lv >= 5 ? 2 : 1;
    ctx.anim('2H_Ranged_Aiming', 1.2, { fade: 0.05 });
    const A = ctx.act({ dur: T0 + passes * 0.45 + 0.1, face: yaw, vel: new V3(), update: (t, dt) => {
      A.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
      if (t < T0) { const a = t * 18, p = f.center(); for (let j = 0; j < 2; j++) fx.spark(p.clone().add(new V3(Math.cos(a + j * 3.14) * 1.1, rnd(-0.6, 0.8), Math.sin(a + j * 3.14) * 1.1)), new V3(0, 2, 0), { color: j ? c : 0xffd060, life: 0.35, size: 0.5, size1: 0.1 }); }
    } });
    ctx.sfx('fire', { len: 0.6, g: 0.8 }); ctx.sfx('charge', { len: 0.35, g: 0.5 }); charge(ctx, c, T0, 1.8);
    for (let i = 0; i < passes; i++) ctx.later(T0 + i * 0.45, () => {
      ctx.anim('2H_Ranged_Shoot', 1.5, { fade: 0.02 });
      const d = aimD(ctx);
      muzzle(ctx, d, c, 2.2); recoil(ctx, 1.6); ctx.shake(0.5); ctx.sfx('roar', { rate: 1.8, g: 0.4 }); ctx.sfx('fire', { len: 1.4 }); ctx.sfx('boom', { rate: 1.7, g: 0.5, len: 0.4 });
      if (own(f)) A.vel.copy(d).setY(0).multiplyScalar(-10);
      let first = true, acc = 0;
      arrow(ctx, d, { dmg: ctx.dmg(520), hit: { launch: 6, kb: 5, posture: 2 }, speed: 34, pierce: true, r: 1.2, scale: 3, life: 1.4, trail: true, trailW: 2.5, stick: false,
        onUpdate: (p, dt) => {
          for (let j = 0; j < 4; j++) fx.spark(p.pos, new V3(rnd(-2, 2), rnd(0, 3), rnd(-2, 2)), { color: j % 2 ? c : 0xffd060, life: 0.5, size: 1, size1: 0.2 });
          if (Math.random() < 0.4) fx.spark(p.pos, new V3(rnd(-1, 1), rnd(1, 2), rnd(-1, 1)), { kind: 'smoke', color: 0x2a1a12, life: 0.9, size: 0.9, size1: 1.8, alpha: 0.5 });
          acc += dt * 34;
          if (lv >= 3 && acc > 1.6) { acc = 0; ctx.zone({ pos: new V3(p.pos.x, 0, p.pos.z), life: 2, iv: 0.5, onTick: z => { ctx.hitSphere(z.pos.clone().setY(0.6), 1.6, ctx.dmg(30), {}); fx.spark(z.pos.clone().add(new V3(rnd(-1, 1), 0.2, rnd(-1, 1))), new V3(0, 3, 0), { color: c, life: 0.5, size: 0.6 }); } }); }
        },
        onHit: (p, t) => {
          fx.flash(t.pos.clone(), { color: c, r: 1.6, life: 0.2, intensity: 4 }); fx.burst(t.pos.clone(), { n: 20, color: 0xffd060, speed: 10, life: 0.4, up: 0.5 });
          if (first) { first = false; ctx.hitstop(0.07); } ctx.shake(0.3);
        } });
    });
  });

  // ---------- Riposte acrobatique (parade) ----------
  def('contre', 'Riposte acrobatique', 'Posture de 1,2 s : si tu es frappé, tu esquives d\'un salto arrière au ralenti et cribles l\'attaquant de 8 flèches. Niv. 3 : 12 flèches. Niv. 5 : la riposte recharge ton ultime.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, hits = lv >= 3 ? 12 : 8, W = 1.2;
    ctx.anim('2H_Ranged_Aiming', 0.9, { fade: 0.05 }); ctx.sfx('magic', { rate: 0.4 }); ctx.sfx('block', { g: 0.5 });
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(G.ring, glowMat(c, 2.2, 0.8)); ring.rotation.x = -Math.PI / 2; grp.add(ring);
    const ring2 = new THREE.Mesh(G.ring, glowMat(0xffffff, 1.6, 0.5)); grp.add(ring2);
    let shell = null;
    if (H.shellMat) { shell = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), H.shellMat(0xffffff, 1.5, 0.7)); shell.geometry.userData.own = true; grp.add(shell); }
    const it = fx.add(grp, W, (k, o, dt, t) => {
      o.position.copy(f.center());
      ring.scale.setScalar(1.6 - 0.3 * Math.sin(t * 10)); ring.rotation.z += dt * 3; ring.position.y = -0.95;
      ring2.scale.setScalar(0.9 + 0.1 * Math.sin(t * 14)); ring2.rotation.y = t * 6;
      if (shell) shell.material.uniforms.uTime.value = t;
    });
    const trig = () => {
      f.counter = null; fx.kill(it);
      ctx.slowmo(1.1); ctx.sfx('parry'); ctx.sfx('perfect', { g: 0.5 }); ctx.hitstop(0.1); ctx.shake(0.3);
      fx.flash(f.center(), { color: 0xffffff, r: 2, life: 0.2, intensity: 6 }); fx.ring(f.pos.clone(), { r0: 0.4, r1: 5, color: c, life: 0.35, width: 0.2 });
      const t0 = ctx.nearest(f.pos, 16);
      const back = t0 ? f.pos.clone().sub(t0.pos).setY(0) : f.fwd().negate();
      if (back.lengthSq() < 0.01) back.copy(f.fwd()).negate(); back.normalize();
      const D = 0.35 + hits * 0.055 + 0.2, p0 = f.pos.clone(), yy = yawOf(back.clone().negate());
      f.inv = Math.max(f.inv || 0, D + 0.3); f.yaw = yy;
      f.spin = { kind: 'flipB', t: 0, dur: 0.5 };
      ctx.anim('Dodge_Backward', 1.6, { fade: 0.03 });
      ctx.act({ dur: D, lockMove: true, float: true, vel: new V3(), face: yy, update: (t) => {
        if (!own(f)) return;
        const u = Math.min(1, t / 0.45), e = 1 - (1 - u) * (1 - u);
        f.pos.x = p0.x + back.x * 5 * e; f.pos.z = p0.z + back.z * 5 * e; f.pos.y = Math.sin(Math.min(1, t / D) * Math.PI) * 2.6; f.vel.set(0, 0, 0);
      }, onEnd: () => { if (own(f)) { f.pos.y = 0; ctx.confine(); } } });
      if (lv >= 5 && own(f)) f.ult = Math.min(100, (f.ult || 0) + 25);
      if (!t0) return;
      let tp = t0.pos.clone();
      for (let i = 0; i < hits; i++) ctx.later(0.16 + i * 0.055, () => {
        const t2 = ctx.nearest(tp, 4); if (t2) tp = t2.pos.clone();
        const from = f.center().add(new V3(0, 0.2, 0)), d = tp.clone().setY(Math.max(0.9, tp.y)).sub(from).normalize();
        if (i % 3 === 0) ctx.anim('2H_Ranged_Shoot', 3.4, { fade: 0.02 });
        muzzle(ctx, d, c, 0.8); snd(ctx, 'swing', { rate: 1.9 + (i % 4) * 0.1 }, 20);
        const lastOne = i === hits - 1;
        arrow(ctx, d, { from: from.clone().addScaledVector(d, 0.6), dmg: ctx.dmg(110), hit: { crit: lastOne, posture: 1, kb: lastOne ? 6 : 1 }, speed: 75, homing: 10, life: 0.7, trail: i % 2 === 0, scale: lastOne ? 1.6 : 1, stick: false,
          onHit: (p) => { ctx.shake(0.08); if (lastOne) { ctx.hitstop(0.08); X.puff(ctx, p.pos.clone(), c, 1.2); } } });
      });
    };
    f.counter = { t: W, trigger: trig };
    ctx.later(W, () => { if (f.counter && f.counter.trigger === trig) f.counter = null; });
  });

  // ---------- Déluge foudroyant ----------
  def('tempete', 'Déluge foudroyant', 'Ta flèche de foudre déchire le ciel : un nuage d\'orage se forme au-dessus de la zone et y déverse 14 flèches de foudre, chacune frappée par un éclair qui étourdit. Niv. 3 : 22 flèches et les flèches plantées s\'électrifient entre elles. Niv. 5 : une flèche géante finale foudroie tout.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, center = ctx.clampAim(18), R = 6.5, n = lv >= 3 ? 22 : 14, R1 = rng(ctx, 13), yaw = ctx.face(), T0 = 0.35;
    const t1 = T0 + 0.6, span = 2.6, rods = [];
    ctx.anim('2H_Ranged_Aiming', 1.3, { fade: 0.05 }); ctx.act({ dur: T0 + 0.3, face: yaw });
    charge(ctx, c, T0, 1.5); ctx.sfx('charge', { len: 0.45 }); ctx.sfx('zap', { g: 0.5 });
    ctx.every(T0, 0.05, () => { const p = tip(f); fx.bolt(p, p.clone().add(new V3(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1))), { color: c, life: 0.07, light: false, segs: 4, jitter: 0.9 }); });
    fx.decal(center, 'circle', { r: R, color: c, dur: 0.9, hold: span, world: false, noWarn: true });
    // le nuage d'orage
    const cloudLife = t1 + span + 1 - T0;
    ctx.later(T0, () => {
      for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(G.puff, new THREE.MeshStandardMaterial({ color: 0x1a1c26, roughness: 1, transparent: true, opacity: 0, flatShading: true }));
        const a = i / 12 * 6.283, r = 1.5 + Math.random() * 4.5, base = new V3(center.x + Math.cos(a) * r, 15 + Math.random() * 1.5, center.z + Math.sin(a) * r);
        m.scale.set(2.2 + Math.random() * 1.5, 1 + Math.random() * 0.6, 2.2 + Math.random() * 1.5);
        fx.add(m, cloudLife, (k, o, dt, t) => { o.position.set(base.x + Math.sin(t * 0.7 + i) * 0.8, base.y + Math.sin(t * 1.3 + i) * 0.3, base.z + Math.cos(t * 0.7 + i) * 0.8); o.material.opacity = 0.88 * Math.min(1, t * 2, (cloudLife - t) * 2); });
      }
      ctx.every(cloudLife - 0.5, 0.2, () => { if (Math.random() < 0.45) fx.flash(new V3(center.x + rnd(-4, 4), 14.5, center.z + rnd(-4, 4)), { color: c, r: 2.5, life: 0.12, light: false }); });
      ctx.anim('2H_Ranged_Shoot', 2, { fade: 0.02 });
      const from = f.center().add(new V3(0, 0.5, 0));
      muzzle(ctx, UP.clone(), c, 1.6); X.bolt(ctx, tip(f), tip(f).add(new V3(0, 3, 0)), c);
      ctx.sfx('zap'); ctx.sfx('swingBig', { rate: 1.2 }); ctx.shake(0.25);
      lob(ctx, from, center.clone().setY(15), 0.35, { color: c, scale: 1.8, h: 2, stick: false, dust: false, trailW: 1.5, onHit: (q) => {
        fx.flash(q, { color: 0xffffff, r: 4, life: 0.2, intensity: 6 });
        for (let j = 0; j < 3; j++) fx.bolt(q, q.clone().add(new V3(rnd(-5, 5), rnd(-1, 1), rnd(-5, 5))), { color: c, life: 0.2, light: j === 0 });
        ctx.sfx('boom', { rate: 0.7, g: 0.5, len: 1.4 });
      } });
    });
    for (let i = 0; i < n; i++) ctx.later(t1 + i * span / n, () => {
      const u1 = R1(), u2 = R1(), u3 = R1(), u4 = R1();
      const es = u1 < 0.55 ? ctx.enemies().filter(e => e.pos.distanceTo(center) < R + 1) : [];
      let p;
      if (es.length) { const e = es[Math.floor(u2 * es.length) % es.length]; p = new V3(e.pos.x + (u3 - 0.5) * 2, 0, e.pos.z + (u4 - 0.5) * 2); }
      else { const a = u2 * 6.283, r = Math.sqrt(u3) * R; p = new V3(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r); }
      skyArrow(ctx, p, { color: c, scale: 1.7, t: 0.22, alt: 15, skew: new V3((u4 - 0.5) * 4, 0, (u1 - 0.5) * 4), trail: true, stickT: lv >= 3 ? span + 1.4 : 1.4, onHit: (q, it) => {
        X.bolt(ctx, new V3(q.x + (u3 - 0.5) * 2, 15, q.z + (u4 - 0.5) * 2), q.clone().setY(0.6), c);
        fx.ring(q, { r1: 2.4, color: c, life: 0.3 }); fx.flash(q.clone().setY(0.5), { color: c, r: 1.2, life: 0.15, intensity: 4, light: false }); fx.burst(q.clone().setY(0.4), { n: 12, color: c, speed: 9, life: 0.3 });
        snd(ctx, 'zap', { g: 0.45 }, 40); ctx.shake(0.06);
        ctx.hitSphere(q.clone().setY(1), 2.4, ctx.dmg(110), { stun: 0.15, posture: 0.6 });
        if (lv >= 3) rods.push({ p: q.clone().setY(0.7), it });
      } });
    });
    // éveil niv. 3 : réseau électrique entre les flèches plantées
    if (lv >= 3) ctx.later(t1 + 0.3, () => ctx.every(span + 0.9, 0.3, (i) => {
      if (rods.length < 2) return;
      const a = rods[(i * 7) % rods.length]; let b = null, bd = 7;
      for (const r of rods) { if (r === a) continue; const dd = r.p.distanceTo(a.p); if (dd < bd && dd > 0.5) { bd = dd; b = r; } }
      if (!b) return;
      fx.bolt(a.p, b.p, { color: c, life: 0.16, jitter: 0.7, light: false, segs: 8 });
      snd(ctx, 'zap', { g: 0.25 }, 60);
      ctx.hitLine(a.p, b.p, 0.9, ctx.dmg(35), { stun: 0.1 });
    }));
    if (lv >= 5) ctx.later(t1 + span + 0.4, () => {
      fx.decal(center, 'circle', { r: 6, color: 0xffffff, dur: 0.4, hold: 0.05, world: false });
      skyArrow(ctx, center.clone(), { color: c, scale: 6, t: 0.4, alt: 30, trailW: 2.5, stickT: 2.5, onHit: (q) => {
        for (let j = 0; j < 4; j++) X.bolt(ctx, q.clone().add(new V3(rnd(-1, 1), 30, rnd(-1, 1))), q.clone().setY(0.5), c);
        if (H.impact) H.impact(ctx, q.clone().setY(0.5), c, 2.2, { pillar: true }); else blast(ctx, q, c, 6, 0, null, { debris: true });
        ctx.hitstop(0.1);
        ctx.hitSphere(q.clone().setY(1), 6, ctx.dmg(480), { stun: 1, posture: 4, launch: 6 });
      } });
    });
  });

  /* =====================================================================
     ULTIMES
     ===================================================================== */

  // ---------- Flèche céleste ----------
  def('u_lame', 'Flèche céleste', 'Tu tires vers le ciel : une flèche de lumière gigantesque s\'abat sur la zone visée et projette tout. Niv. 3 : elle étourdit et une onde de choc secondaire repousse tout. Niv. 5 : deux flèches de plus sur les côtés.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, center = ctx.clampAim(22), T0 = 0.4;
    ctx.anim('2H_Ranged_Aiming', 1.1, { fade: 0.05 }); ctx.act({ dur: T0 + 0.5, face: ctx.face() }); ctx.sfx('charge', { len: 0.8 });
    charge(ctx, c, T0, 2);
    ctx.later(T0, () => {
      ctx.anim('2H_Ranged_Shoot', 1.6, { fade: 0.02 });
      const from = f.center().add(new V3(0, 0.5, 0));
      muzzle(ctx, UP.clone(), c, 2); ctx.shake(0.35); ctx.sfx('swingBig', { rate: 0.8 }); ctx.sfx('boom', { rate: 2, g: 0.4, len: 0.4 });
      lob(ctx, from, from.clone().add(new V3(0, 40, 0)), 0.4, { color: c, scale: 2.2, h: 0, stick: false, dust: false, trailW: 2 });
    });
    const drop = (p, delay, k) => ctx.later(delay, () => {
      fx.decal(p, 'circle', { r: 7 * k, color: c, dur: 0.8, hold: 0.15, world: false });
      fx.pillar(p, { color: c, r: 0.6 * k, h: 60, life: 1.0, grow: 2, alpha: 0.6 });
      ctx.sfx('charge', { len: 0.7 });
      skyArrow(ctx, p.clone(), { color: c, scale: 11 * k, t: 0.8, alt: 60, trailW: 3, stickT: 3, onHit: (q) => {
        if (H.impact) H.impact(ctx, q.clone().setY(1), c, 3 * k, { pillar: true }); else blast(ctx, q, c, 7 * k, 0, null, { debris: true });
        fx.ring(q, { r1: 14 * k, color: 0xffffff, life: 0.8, width: 0.08 }); fx.ring(q, { r1: 10 * k, color: c, life: 0.6, width: 0.3 });
        if (fx.debris) fx.debris(q, { n: Math.round(24 * k), r: 2 * k, speed: 14, size: 0.4 });
        ctx.hitstop(0.18 * k); ctx.shake(1.1 * k); if (k >= 1) ctx.slowmo(0.5);
        ctx.hitSphere(q.clone().setY(1), 7 * k, ctx.dmg(1800) * (k < 1 ? 0.3 : 1), { launch: 12, posture: 6, stun: lv >= 3 ? 2 : 0, kb: 8 });
        if (lv >= 3 && k >= 1) ctx.later(0.4, () => { fx.ring(q, { r0: 2, r1: 11, color: c, life: 0.45, width: 0.2 }); ctx.sfx('stomp'); ctx.shake(0.4); ctx.hitSphere(q.clone().setY(1), 11, ctx.dmg(200), { kb: 8, posture: 2 }); });
      } });
    });
    drop(center, T0 + 0.35, 1);
    if (lv >= 5) { const d = ctx.dirToAim(), side = new V3(d.z, 0, -d.x); drop(center.clone().addScaledVector(side, 6), T0 + 0.7, 0.6); drop(center.clone().addScaledVector(side, -6), T0 + 0.9, 0.6); }
  });

  // ---------- Instant suspendu (arrêt du temps) ----------
  def('u_temps', 'Instant suspendu', 'Le temps s\'arrête : tes flèches se figent autour des ennemis proches et tous tes dégâts s\'accumulent, puis tout frappe d\'un coup à la reprise. Niv. 3 : arrêt plus long. Niv. 5 : dégâts libérés amplifiés et recharges remises à zéro.', (ctx, orig) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv;
    orig(bowCtx(ctx));   // cadran au sol + arrêt du temps (moteur)
    const D = (ctx.S && ctx.S.stopT > 0 && ctx.S.stopDur) || (lv >= 3 ? 5 : 4);
    ctx.anim('2H_Ranged_Shooting', 2.2, { fade: 0.04 });
    const es = ctx.enemies().filter(e => e.pos.distanceTo(f.pos) < 26).sort((a, b) => a.pos.distanceTo(f.pos) - b.pos.distanceTo(f.pos)).slice(0, 10);
    es.forEach((e, j) => {
      for (let k = 0; k < 2; k++) {
        const dl = 0.05 + j * 0.06 + k * 0.03;
        ctx.later(dl, () => {
          const ang = (j * 2 + k) * 2.39996, ep = e.pos.clone(), hp = ep.clone().add(new V3(Math.cos(ang) * 2.4, 0.4 + k * 0.7, Math.sin(ang) * 2.4));
          const from = f.center().add(new V3(0, 0.2, 0)), d1 = hp.clone().sub(from).normalize(), d2 = ep.clone().sub(hp).normalize();
          muzzle(ctx, d1, c, 0.7); snd(ctx, 'swing', { rate: 2.2, g: 0.5 }, 25);
          const m = X.arrowMesh(c, 1.2), life = Math.max(0.4, D - dl + 0.25), look = new V3();
          m.position.copy(from);
          fx.add(m, life, (kk, o, dt, t) => {
            if (t < 0.12) { o.position.lerpVectors(from, hp, t / 0.12); o.lookAt(look.copy(o.position).add(d1)); }
            else if (t < life - 0.25) { o.position.copy(hp); o.position.x += Math.sin(t * 60) * 0.01; o.lookAt(look.copy(hp).add(d2)); }
            else { const u = Math.min(1, (t - (life - 0.25)) / 0.25); o.position.lerpVectors(hp, ep, u * u); o.lookAt(look.copy(o.position).add(d2)); }
          }, false, () => { if (live(ctx)) { fx.burst(ep, { n: 10, color: c, speed: 8, life: 0.3 }); fx.flash(ep, { color: c, r: 0.8, life: 0.12, light: false }); } });
          ctx.hitTarget(e, ctx.dmg(110), { posture: 1 });   // retenu pendant l'arrêt du temps, libéré à la reprise
        });
      }
    });
  });

  // ---------- Tir annihilateur ----------
  def('u_rayon', 'Tir annihilateur', 'Après une courte charge, ton arbalète crache un rayon dévastateur qui suit ta visée ; le recul te fait glisser. Niv. 3 : rayon plus long et plus large. Niv. 5 : explosion finale.', (ctx, orig) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, dur = lv >= 3 ? 4.5 : 3.5, ch = 0.45;
    orig(bowCtx(ctx));
    ctx.anim('2H_Ranged_Aiming', 0.6, { fade: 0.05 });
    charge(ctx, c, ch, 2.2);
    ctx.later(ch, () => {
      const d = aimD(ctx); muzzle(ctx, d, c, 2.4); recoil(ctx, 1.8);
      ctx.sfx('swingBig', { rate: 0.5, g: 1 }); fx.ring(f.pos.clone(), { r0: 0.5, r1: 6, color: c, life: 0.4, width: 0.2 });
      ctx.every(dur, 0.14, (i) => {
        if (!f.alive) return;
        const aim = (f.ctl && f.ctl.aim) ? f.ctl.aim : ctx.aim, p = tip(f), dd = aim.clone().sub(p); if (dd.lengthSq() < 0.01) return; dd.normalize();
        wave(ctx, p.clone().addScaledVector(dd, 0.6 + (i % 3) * 0.9), dd, c, { r0: 0.4, r1: 1.8, life: 0.2 });
        recoil(ctx, 0.5);
        fx.burst(f.pos.clone().setY(0.15), { n: 2, color: 0x8a7a6a, kind: 'smoke', speed: 3, dir: dd.clone().negate().setY(0.2), spread: 0.5, life: 0.5, size: 0.4, size1: 1, grav: -0.2, alpha: 0.4 });
      });
    });
  });

  // ---------- Territoire du chasseur ----------
  def('u_domaine', 'Territoire du chasseur', 'Un cercle de 14 m hérissé de flèches : tes alliés y frappent plus fort et rechargent 2× plus vite, les ennemis y sont ralentis, et les flèches du cercle tirent seules sur eux. Niv. 3 : la zone blesse aussi. Niv. 5 : pouvoirs gratuits et énergie illimitée.', (ctx, orig) => {
    const { f, fx } = ctx, c = ctx.color, R = 14, dur = 9, p = f.pos.clone().setY(0);
    orig(bowCtx(ctx));
    ctx.anim('2H_Ranged_Shooting', 1.4, { fade: 0.04 });
    muzzle(ctx, UP.clone(), c, 1.6); ctx.sfx('swingBig', { rate: 0.9 });
    const rim = [], N = 20;
    for (let i = 0; i < N; i++) ctx.later(0.3 + i * 0.03, () => {
      const a = i / N * 6.283, q = new V3(p.x + Math.cos(a) * R, 0, p.z + Math.sin(a) * R);
      skyArrow(ctx, q, { color: c, scale: 1.6, t: 0.25, skew: new V3(-Math.cos(a) * 6, 0, -Math.sin(a) * 6), trail: i % 2 === 0, stickT: Math.max(1, dur - 0.6 - i * 0.03), onHit: (qq) => { rim.push(qq.clone().setY(1.2)); snd(ctx, 'hit', { g: 0.3, rate: 1.6 }, 40); } });
    });
    ctx.later(1, () => ctx.every(dur - 1.6, 0.5, (i) => {
      if (!rim.length || !live(ctx)) return;
      const inside = ctx.enemies().filter(e => e.pos.distanceTo(p) < R + 1); if (!inside.length) return;
      const e = inside[i % inside.length]; let src = rim[0], bd = 1e9;
      for (const r of rim) { const dd = r.distanceTo(e.pos); if (dd < bd) { bd = dd; src = r; } }
      const d = e.pos.clone().setY(Math.max(0.8, e.pos.y)).sub(src).normalize();
      fx.flash(src, { color: c, r: 0.6, life: 0.12, light: false }); wave(ctx, src.clone(), d, c, { r1: 1, life: 0.15 }); snd(ctx, 'swing', { rate: 2, g: 0.4 }, 30);
      arrow(ctx, d, { from: src.clone(), dmg: ctx.dmg(70), hit: { posture: 0.6, stun: 0.1 }, speed: 55, homing: 6, life: 0.9, trail: true, stick: false });
    }));
  });

  // ---------- Flèche météore ----------
  def('u_meteore', 'Flèche météore', 'Tu tires une flèche enflammée vers le ciel : elle retombe en météore géant sur la zone visée, projette tout et laisse le sol en feu. Niv. 3 : brasier plus large. Niv. 5 : 6 météores de plus autour.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, center = ctx.clampAim(24), T0 = 0.35;
    ctx.anim('2H_Ranged_Aiming', 1.2, { fade: 0.05 }); ctx.act({ dur: T0 + 0.5, face: ctx.face() }); ctx.sfx('fire', { len: 0.8, g: 0.8 }); ctx.sfx('charge', { len: 0.6 });
    charge(ctx, c, T0, 2);
    ctx.later(T0, () => {
      ctx.anim('2H_Ranged_Shoot', 1.5, { fade: 0.02 });
      const from = f.center().add(new V3(0, 0.5, 0));
      muzzle(ctx, UP.clone(), c, 2); ctx.shake(0.3); ctx.sfx('swingBig', { rate: 0.7 });
      lob(ctx, from, from.clone().add(new V3(3, 45, 2)), 0.45, { color: c, scale: 2.2, h: 0, stick: false, dust: false, trailW: 2, onUpdate: (q) => fx.spark(q, new V3(rnd(-1, 1), -2, rnd(-1, 1)), { color: 0xffd060, life: 0.4, size: 0.8, size1: 0.1 }) });
    });
    const fall = (p, size, delay, dmgK) => ctx.later(delay, () => {
      fx.decal(p, 'circle', { r: 8 * size, color: c, dur: 1.2, hold: 0.2, world: false });
      ctx.sfx('fire', { len: 1.2, g: 0.7 * size });
      const big = size > 0.6;
      skyArrow(ctx, p.clone(), { color: c, scale: 8 * size, t: 1.2, alt: big ? 70 : 42, skew: new V3(-30, 0, -20).multiplyScalar(big ? 1 : 0.6), trailW: 3, stickT: 4,
        onUpdate: (q) => {
          for (let j = 0; j < 3; j++) fx.spark(q.clone().add(new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(2 * size)), new V3(rnd(-2, 2), rnd(0, 3), rnd(-2, 2)), { color: j % 2 ? c : 0xffcc66, life: 0.6, size: 1.6 * size, size1: 0.2 });
          if (Math.random() < 0.5) fx.spark(q, new V3(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)), { kind: 'smoke', color: 0x1a1210, life: 1.4, size: 2.5 * size, size1: 4 * size, alpha: 0.7, grav: -0.5 });
        },
        onHit: (q) => {
          if (H.impact) H.impact(ctx, q.clone().setY(1), c, 3.4 * size, { pillar: true }); else blast(ctx, q, c, 8 * size, 0, null, { debris: true });
          fx.ring(q, { r1: 16 * size, color: 0xffd080, life: 0.9, width: 0.06 });
          if (fx.debris) fx.debris(q, { n: Math.round(26 * size), r: 2.5 * size, speed: 15 * size, size: 0.45 * size });
          ctx.hitstop(0.16 * size); ctx.shake(1.2 * size);
          ctx.hitSphere(q.clone().setY(1), 8 * size, ctx.dmg(1500) * dmgK, { launch: 14, posture: 8 * size, kb: 8 });
          ctx.zone({ pos: q.clone(), life: 4, iv: 0.5, onTick: z => { ctx.hitSphere(z.pos.clone().setY(0.6), (lv >= 3 ? 7 : 5) * size, ctx.dmg(lv >= 3 ? 60 : 35), {}); for (let k = 0; k < 10; k++) fx.spark(z.pos.clone().add(new V3(rnd(-5, 5) * size, 0.1, rnd(-5, 5) * size)), new V3(0, rnd(2, 6), 0), { color: k % 2 ? c : 0xffaa40, life: 0.6, size: 0.8, size1: 0.05 }); } });
        } });
    });
    fall(center, 1, T0 + 0.2, 1);
    if (lv >= 5) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; fall(center.clone().add(new V3(Math.cos(a) * 9, 0, Math.sin(a) * 9)), 0.45, T0 + 0.8 + i * 0.15, 0.2); }
  });

  // ---------- Garnison d'os ----------
  def('u_legion', 'Garnison d\'os', 'Des squelettes arbalétriers sortent de terre derrière toi et criblent les ennemis pendant 12 s. Niv. 3 : 8 tireurs aux flèches perforantes. Niv. 5 : en disparaissant, chacun fait pleuvoir une volée sur l\'ennemi le plus proche.', (ctx) => {
    const { f, fx } = ctx, c = ctx.color, lv = ctx.lv, n = lv >= 3 ? 8 : 5, skins = ['sk_warrior', 'minion', 'sk_mage', 'reaper'], d0 = ctx.dirToAim();
    ctx.anim('2H_Ranged_Reload', 1.2); ctx.sfx('roar', { rate: 1.4, g: 0.5 });
    fx.ring(f.pos.clone(), { r0: 0.5, r1: 6, color: c, life: 0.5, width: 0.2 });
    for (let i = 0; i < n; i++) ctx.later(0.2 + i * 0.12, () => {
      const off = (i - (n - 1) / 2) * (2.4 / Math.max(1, n - 1)), dir = d0.clone().negate().applyAxisAngle(UP, off), p = f.pos.clone().addScaledVector(dir, 3.2); p.y = 0;
      let sk = null;
      try { sk = ctx.fighter({ id: 'os' + i, look: { skin: skins[i % skins.length] }, kind: 'summon', weapon: 'bow' }); } catch (e) { sk = null; }
      if (!sk) return;
      sk.owner = f; sk.team = f.team; sk.summonMul = 1; sk.pos.copy(p).setY(-2); sk.yaw = yawOf(d0);
      fx.pillar(p, { color: c, r: 1, h: 8, life: 0.6 }); fx.burst(p.clone().setY(0.3), { n: 30, color: c, speed: 6, up: 1, life: 0.6 });
      if (fx.debris) fx.debris(p, { n: 8, r: 0.8, speed: 6, size: 0.25 });
      sk.play('Lie_StandUp', 1.6);
      const api = BR.Arena && BR.Arena.api ? BR.Arena.api(sk, ctx.auth, ctx.lv, ctx.aim, 'u_legion') : null;
      let life = 12, atk = 0.9 + i * 0.13, rise = 0.5;
      ctx.summon({
        team: f.team, f: sk,
        update(dt) {
          life -= dt; if (life <= 0) return false;
          if (rise > 0) { rise -= dt; sk.pos.y = Math.min(0, sk.pos.y + dt * 5); sk.update(dt, { speed: 0 }); return true; }
          sk.pos.y = 0;
          const t = api ? api.nearest(sk.pos, 34) : null;
          if (t) {
            const dd = t.pos.clone().sub(sk.pos).setY(0); if (dd.lengthSq() > 0.01) sk.yaw = yawOf(dd);
            atk -= dt;
            if (atk <= 0) {
              atk = 1.0; sk.play('2H_Ranged_Shoot', 1.8, { fade: 0.04 });
              const from = sk.center().add(new V3(0, 0.3, 0)), dir2 = t.pos.clone().setY(Math.max(0.8, t.pos.y)).sub(from).normalize();
              muzzle(api, dir2, c, 0.7); snd(ctx, 'swing', { rate: 1.7, g: 0.45 }, 30);
              arrow(api, dir2, { from: from.addScaledVector(dir2, 0.6), dmg: ctx.dmg(75), hit: { posture: 0.6, kb: 1.5 }, speed: 52, homing: 4, life: 1.1, pierce: lv >= 3, trail: true, color: c });
            }
          }
          if (Math.random() < dt * 6) fx.spark(sk.center().add(new V3(rnd(-0.4, 0.4), rnd(-0.6, 0.8), rnd(-0.4, 0.4))), new V3(0, rnd(1, 3), 0), { color: c, life: 0.5, size: 0.35, size1: 0.05 });
          sk.update(dt, { speed: 0 });
          return true;
        },
        dispose() {
          fx.burst(sk.center(), { n: 30, color: c, speed: 6, life: 0.6 });
          if (lv >= 5 && api && live(ctx)) {
            const t = api.nearest(sk.pos, 30);
            if (t) for (let k = 0; k < 3; k++) { const q = new V3(t.pos.x + rnd(-1.5, 1.5), 0, t.pos.z + rnd(-1.5, 1.5)); skyArrow(api, q, { color: c, scale: 1.6, t: 0.3 + k * 0.08, trail: true, onHit: (qq) => { blast(api, qq, c, 2.2, ctx.dmg(90), { posture: 0.5 }, { shake: 0.05 }); } }); }
          }
          sk.dispose();
        },
      });
    });
  });

  /* ---------------- éveils (textes affichés au passage des niveaux 3 et 5) ---------------- */
  Q.CLASS_AW = Q.CLASS_AW || {};
  Q.CLASS_AW.archer = {
    traits: ['5 flèches chercheuses, qui ralentissent aussi leurs cibles.', 'Chaque flèche éclate en 2 éclats chercheurs et te rend de l\'énergie.'],
    fente: ['5 flèches, qui transpercent les ennemis.', 'Une flèche piégée explose là où tu étais et étourdit.'],
    tourbillon: ['2 tours complets et 20 flèches, couronne finale plus large.', 'Les flèches plantées autour de toi explosent.'],
    pluie: ['36 flèches, puis une flèche géante qui projette tout.', 'Les flèches plantées explosent en chaîne.'],
    u_lames: ['8 bonds, et le tir final transperce toute la ligne.', 'Les flèches plantées dans la cible explosent après le tir final.'],
    onde: ['Séisme plus large, suivi d\'une réplique qui étourdit.', 'La flèche se divise en 3 séismes de plus autour de l\'impact.'],
    bond: ['8 flèches à fragmentation, explosions plus larges.', 'L\'atterrissage repousse tout et retire 1 s à tes recharges.'],
    garde: ['Bouclier bien plus solide (700).', 'À la fin, les flèches restantes partent toutes et les dégâts absorbés explosent.'],
    chaine: ['L\'éclair rebondit sur 7 ennemis.', 'Un second éclair tombe du ciel sur chaque ennemi touché.'],
    lance: ['Chaque impact éclate en zone gelée.', '3 flèches de givre en éventail.'],
    ombre: ['Laisse un leurre piégé qui explose et étourdit.', 'Deux téléportations et deux tirs à bout portant.'],
    tornade: ['La tornade chasse l\'ennemi le plus proche.', 'Deux tornades au lieu d\'une.'],
    soin: ['Soin renforcé, et les ennemis dans la zone sont ralentis.', 'Relève aussi les alliés à terre dans la zone.'],
    fantomes: ['10 flèches spectrales en orbite.', 'Chaque flèche rebondit en éclair sur un 2e ennemi.'],
    clone: ['Le double frappe bien plus fort.', 'Deux doubles au lieu d\'un.'],
    gravite: ['L\'implosion finale fait deux fois plus mal.', 'L\'implosion étourdit tout ce qu\'elle touche.'],
    dragon: ['La flèche laisse une traînée de feu au sol.', 'Deux flèches du dragon d\'affilée.'],
    contre: ['La riposte tire 12 flèches.', 'Chaque riposte recharge 25 % de ton ultime.'],
    tempete: ['22 flèches de foudre, et les flèches plantées s\'électrifient entre elles.', 'Une flèche géante finale foudroie toute la zone.'],
    u_lame: ['Étourdit 2 s, et une onde de choc secondaire repousse tout.', 'Deux flèches célestes de plus sur les côtés.'],
    u_temps: ['Le temps reste figé 5 s au lieu de 4.', 'Dégâts libérés bien plus forts et recharges remises à zéro.'],
    u_rayon: ['Rayon plus long et plus large.', 'Une explosion géante au bout du rayon quand il s\'éteint.'],
    u_domaine: ['La zone blesse aussi les ennemis à l\'intérieur.', 'Pouvoirs gratuits et énergie qui remonte à toute vitesse.'],
    u_meteore: ['Le brasier au sol est plus large et brûle plus fort.', '6 météores de plus tombent autour.'],
    u_legion: ['8 arbalétriers, aux flèches perforantes.', 'En disparaissant, chacun fait pleuvoir une volée sur l\'ennemi le plus proche.'],
  };
})();

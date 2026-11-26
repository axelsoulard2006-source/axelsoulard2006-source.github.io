/* ===== arena/cls-mage.js : pouvoirs de la classe mage (game feel) =====
   Chaque pouvoir est déclaré avec BR.Asc.variant(cls, id, (ctx, orig) => {...}). Voir asc-classes.js pour l API.
   Le Mage incante : chaque sort a un geste lisible (le bâton se charge de lumière, un cercle runique se dessine)
   puis une résolution qui claque (flash, onde, gel, aspiration, foudre…).
   Règles : dégâts uniquement via ctx.hit* / ctx.proj / ctx.zone (rien chez les autres joueurs, ctx.auth = false) ;
   le lanceur n'est déplacé que si sa position est simulée ici (f.kind !== 'remote') ; aléatoire « de jeu » tiré
   d'une graine issue de la visée (identique chez tous les joueurs). */
(function () {
  const BR = window.BR, Q = BR && BR.Asc;
  if (!Q || !Q.variant || !window.THREE) return;
  const V3 = THREE.Vector3, UP = new V3(0, 1, 0), ADD = THREE.AdditiveBlending, CLS = 'mage';
  const C = c => (c && c.isColor) ? c.clone() : new THREE.Color(c == null ? 0xffffff : c);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const H = () => (BR.ASkills && BR.ASkills._H) || {};
  // rang d'un nœud de l'arbre de compétences (asc-tree.js) pour ce lanceur (local ou distant : mêmes visuels partout)
  const TR = (f, id) => (Q.treeRank ? Q.treeRank(f, id) : 0);
  const COL = { arc: 0xb36bff, arc2: 0xe2a8ff, cyan: 0x6fffe0, ice: 0x8fe6ff, fire: 0xff5a1e, ember: 0xffb040, storm: 0x8fc8ff, void: 0x9a5cff, gold: 0xffd76a, heal: 0x7dffa0, star: 0xfff0b8, time: 0x8fb0ff };

  /* =====================================================================
     GÉOMÉTRIES PARTAGÉES (jamais détruites : userData.keep, pas de userData.own)
     ===================================================================== */
  const G = {};
  G.plane = new THREE.PlaneGeometry(2, 2); G.plane.rotateX(-Math.PI / 2);          // disque/cercle au sol (XZ)
  G.sph = new THREE.SphereGeometry(1, 18, 12);
  G.ico = new THREE.IcosahedronGeometry(1, 0);
  G.ico1 = new THREE.IcosahedronGeometry(1, 1);
  G.shard = new THREE.OctahedronGeometry(1, 0); G.shard.scale(0.35, 1, 0.35);      // cristal vertical
  G.shardZ = new THREE.OctahedronGeometry(1, 0); G.shardZ.scale(0.35, 0.35, 1);    // cristal orienté +Z (projectiles)
  G.spike = new THREE.ConeGeometry(0.3, 1, 5); G.spike.translate(0, 0.5, 0);       // pic (base au sol)
  G.lance = new THREE.ConeGeometry(0.22, 2.8, 6); G.lance.rotateX(Math.PI / 2);    // javelot orienté +Z
  G.head = new THREE.ConeGeometry(0.62, 2.0, 6); G.head.rotateX(Math.PI / 2);      // tête de dragon orientée +Z
  G.ring = new THREE.TorusGeometry(1, 0.035, 6, 56);
  G.funnel = new THREE.CylinderGeometry(2.4, 0.55, 7.5, 24, 6, true); G.funnel.translate(0, 3.75, 0);
  G.dome = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  Object.values(G).forEach(g => { g.userData.keep = true; });

  /* =====================================================================
     SHADERS
     ===================================================================== */
  const UV_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  // cercle runique procédural : anneaux, graduations, glyphes, hexagramme ; uProg = tracé (balayage angulaire)
  const RUNE_FS = `varying vec2 vUv; uniform vec3 uColor; uniform float uProg, uAlpha, uSeed, uStar;
    float hsh(float x){ return fract(sin(x * 91.17 + uSeed * 7.31) * 43758.5453); }
    float band(float x, float a, float b, float s){ return smoothstep(a - s, a, x) * (1.0 - smoothstep(b, b + s, x)); }
    float tri(vec2 p, float R, float rot){ float a = atan(p.y, p.x) + rot; float seg = 2.0943951; float d = cos(floor(0.5 + a / seg) * seg - a) * length(p); return abs(d - R * 0.5); }
    void main(){
      vec2 p = vUv * 2.0 - 1.0; float r = length(p);
      if (r > 1.0) discard;
      float u = fract(atan(p.y, p.x) / 6.2831853 + 0.25);
      float vis = 1.0 - smoothstep(uProg * 1.04 - 0.015, uProg * 1.04, u);
      float head = exp(-pow((u - uProg) * 30.0, 2.0)) * step(uProg, 0.999) * band(r, 0.6, 0.98, 0.02);
      float c = 0.0;
      c += band(r, 0.94, 0.975, 0.01);
      c += band(r, 0.895, 0.905, 0.008) * 0.7;
      c += band(fract(u * 72.0), 0.0, 0.14, 0.03) * band(r, 0.905, 0.94, 0.006) * 0.8;
      float rr = (r - 0.7) / 0.17;
      if (rr > 0.0 && rr < 1.0) {
        float cu = u * 24.0, ci = floor(cu), cf = fract(cu), g = hsh(ci);
        float gap = band(cf, 0.18, 0.82, 0.03);
        float s1 = step(0.3, g) * band(cf, 0.46, 0.54, 0.03) * band(rr, 0.1, 0.9, 0.05);
        float y0 = 0.15 + 0.6 * fract(g * 7.0);
        float s2 = band(rr, y0, y0 + 0.1, 0.04) * band(cf, 0.22, 0.78, 0.03);
        float s3 = step(0.5, fract(g * 13.0)) * band(cf, 0.26, 0.32, 0.03) * band(rr, 0.2, 0.85, 0.05);
        float s4 = step(0.55, fract(g * 29.0)) * (1.0 - smoothstep(0.0, 0.08, abs((cf - 0.22) / 0.56 - rr))) * band(cf, 0.22, 0.78, 0.02);
        c += min(1.0, s1 + s2 + s3 + s4) * gap * 0.95;
      }
      c += band(r, 0.66, 0.685, 0.008) * 0.9;
      float st = (1.0 - smoothstep(0.0, 0.016, tri(p, 0.66, 0.0))) + (1.0 - smoothstep(0.0, 0.016, tri(p, 0.66, 1.0471976)));
      c += min(1.0, st) * step(r, 0.67) * uStar * smoothstep(0.35, 0.9, uProg);
      c += band(r, 0.3, 0.318, 0.008) * smoothstep(0.5, 1.0, uProg) * uStar;
      float fill = (1.0 - r) * 0.1 * uProg;
      float a = (min(c, 1.4) * vis + head * 0.9 + fill) * uAlpha;
      vec3 col = uColor * (1.5 + c * 0.7) + vec3(1.2) * head;
      gl_FragColor = vec4(col, a);
    }`;
  // entonnoir de flammes (tornade)
  const VORTEX_FS = `varying vec2 vUv; uniform float uTime, uA; uniform vec3 uC1, uC2;
    void main(){
      float u = vUv.x, v = vUv.y;
      float s1 = 0.5 + 0.5 * sin(u * 25.1327 + v * 10.0 - uTime * 14.0);
      float s2 = 0.5 + 0.5 * sin(u * 43.9823 - v * 6.0 - uTime * 9.0 + 1.7);
      float st = pow(s1, 3.0) * 0.8 + pow(s2, 4.0) * 0.6;
      float edge = smoothstep(0.0, 0.12, v) * (1.0 - smoothstep(0.7, 1.0, v));
      vec3 col = mix(uC1, uC2, v);
      gl_FragColor = vec4(col * (1.3 + st * 1.2), (0.12 + st) * edge * uA);
    }`;
  // disque d'accrétion en spirale (trou noir)
  const SWIRL_FS = `varying vec2 vUv; uniform float uTime, uA, uIn; uniform vec3 uC;
    void main(){
      vec2 p = vUv * 2.0 - 1.0; float r = length(p);
      if (r > 1.0 || r < uIn) discard;
      float a = atan(p.y, p.x), lr = log(r);
      float s1 = 0.5 + 0.5 * sin(a * 3.0 + lr * 9.0 - uTime * 6.0);
      float s2 = 0.5 + 0.5 * sin(a * 7.0 + lr * 15.0 - uTime * 10.0);
      float rad = smoothstep(uIn, uIn + 0.1, r) * (1.0 - smoothstep(0.55, 1.0, r));
      float hot = 1.0 - smoothstep(uIn, uIn + 0.22, r);
      vec3 col = mix(uC * 1.7, vec3(2.8, 2.5, 3.0), hot);
      float al = (pow(s1, 2.0) * 0.75 + pow(s2, 3.0) * 0.45 + hot * 0.9) * rad * uA;
      gl_FragColor = vec4(col * (0.8 + s1 * 0.6), al);
    }`;
  // ombre douce au sol (nuage d'orage)
  const SHADOW_FS = 'varying vec2 vUv; uniform float uA; void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); gl_FragColor = vec4(0.0, 0.0, 0.02, (1.0 - smoothstep(0.55, 1.0, r)) * uA); }';

  const vortexMat = (c1, c2) => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uC1: { value: C(c1) }, uC2: { value: C(c2) } }, vertexShader: UV_VS, fragmentShader: VORTEX_FS, transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide });
  const swirlMat = (c, inner) => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uA: { value: 1 }, uIn: { value: inner == null ? 0.28 : inner }, uC: { value: C(c) } }, vertexShader: UV_VS, fragmentShader: SWIRL_FS, transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide });
  const shell = (c, pw, a) => H().shellMat ? H().shellMat(c, pw, a) : new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(1.6), transparent: true, opacity: 0.3 * (a == null ? 1 : a), blending: ADD, depthWrite: false });
  const addMat = (c, k, op) => new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(k || 2), transparent: true, opacity: op == null ? 0.6 : op, blending: ADD, depthWrite: false });

  /* =====================================================================
     OUTILS
     ===================================================================== */
  const owns = f => !!f && f.kind !== 'remote';                        // position du lanceur simulée sur ce client
  const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const gnd = p => new V3(p.x, 0, p.z);
  const tipOf = f => { try { return f.tip ? f.tip(0) : f.center(); } catch (e) { return f.center(); } };
  const gk = t => (BR.Arena && BR.Arena.groupKey) ? BR.Arena.groupKey(t) : (t.kind + ':' + (t.i != null ? t.i : (t.f && t.f.id)));
  function uniq(list) { const seen = new Set(), out = []; for (const t of list) { const k = gk(t); if (!seen.has(k)) { seen.add(k); out.push(t); } } return out; }
  // ennemis dans un disque (distance horizontale), du plus proche au plus loin
  function near(ctx, p, R) { return ctx.enemies().filter(t => hd(t.pos, p) < R + (t.r || 0)).sort((a, b) => hd(a.pos, p) - hd(b.pos, p)); }
  // position à jour d'une cible mémorisée
  function fresh(ctx, t) { if (!t) return null; const k = gk(t); return ctx.enemies().find(e => gk(e) === k) || null; }
  // son atténué quand le sort est rejoué chez un autre joueur
  function snd(ctx, n, o) { const k = ctx.f && ctx.f.kind === 'local' ? 1 : 0.45; try { ctx.sfx(n, Object.assign({}, o || {}, { g: (o && o.g != null ? o.g : 1) * k })); } catch (e) { /* audio absent */ } }
  function loop(ctx, kind, v) { let s = null; try { s = BR.Audio && BR.Audio.loopFx ? BR.Audio.loopFx(kind) : null; } catch (e) { s = null; } s = s || { set() {}, stop() {} }; s.set((v == null ? 1 : v) * (ctx.f.kind === 'local' ? 1 : 0.4)); let done = false; return { set: x => { if (!done) s.set(x * (ctx.f.kind === 'local' ? 1 : 0.4)); }, stop: () => { if (!done) { done = true; s.stop(); } } }; }
  function flashScreen(ctx, r, g, b) { const S = ctx.S; if (ctx.f.kind === 'local' && S && S.flash && S.flash.setRGB) S.flash.setRGB(r, g, b); }
  const alive = ctx => !!(ctx.S && !ctx.S.ended);
  // graine identique chez tous les joueurs (même visée, même niveau) : positions de chute, choix de points…
  function seeded(ctx) {
    let s = (Math.imul(Math.round(ctx.aim.x * 100) | 0, 73856093) ^ Math.imul(Math.round(ctx.aim.z * 100) | 0, 19349663) ^ Math.imul((ctx.lv | 0) + 7, 83492791)) >>> 0;
    if (!s) s = 0x9e3779b9;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function clampArena(ctx, p, m) { const R = (ctx.arenaR || 30) - (m == null ? 1 : m), r = Math.hypot(p.x, p.z); if (r > R) { p.x *= R / r; p.z *= R / r; } return p; }
  // téléporte le lanceur (seulement si sa position est simulée ici)
  function moveTo(ctx, p) { const f = ctx.f; if (!owns(f)) return; f.pos.set(p.x, 0, p.z); f.vel.set(0, 0, 0); ctx.confine(); }

  /* ---------- cercle runique qui se dessine ----------
     o = { r, r0, color, life, draw (durée du tracé), grow, fade, spin, star, alpha, lift, pulse,
           vertical + yaw | yawF() (cercle dressé face à yaw), follow() -> V3, dir() -> V3 (normale du cercle) } */
  function rune(ctx, p, o) {
    o = o || {};
    const fx = ctx.fx, r = o.r || 3, life = o.life || 1.2, draw = o.draw || 0.3, fade = o.fade || 0.25;
    const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: C(o.color == null ? COL.arc : o.color) }, uProg: { value: 0 }, uAlpha: { value: 0 }, uSeed: { value: Math.random() * 40 }, uStar: { value: o.star == null ? 1 : o.star } },
      vertexShader: UV_VS, fragmentShader: RUNE_FS, transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide });
    const m = new THREE.Mesh(G.plane, mat); m.frustumCulled = false; m.renderOrder = o.vertical || o.dir ? 6 : 3;
    const g = new THREE.Group(); g.add(m); g.rotation.order = 'YXZ';
    const lift = o.lift != null ? o.lift : (o.vertical || o.dir ? 0 : 0.07);
    const place = q => { g.position.set(q.x, (q.y || 0) + lift, q.z); };
    place(p);
    if (o.vertical) { g.rotation.y = o.yawF ? o.yawF() : (o.yaw || 0); g.rotation.x = Math.PI / 2; }
    if (o.dir) { const d = o.dir(); if (d && d.lengthSq() > 1e-6) g.quaternion.setFromUnitVectors(UP, d.clone().normalize()); }
    const r0 = o.r0 == null ? r * 0.7 : o.r0, grow = o.grow || draw, spin = o.spin == null ? 0.6 : o.spin, al = o.alpha == null ? 1 : o.alpha;
    m.scale.set(r0, 1, r0);
    const it = fx.add(g, life, (k, obj, dt, t) => {
      if (o.follow) { const q = o.follow(); if (q) place(q); }
      if (o.vertical && o.yawF) g.rotation.y = o.yawF();
      if (o.dir) { const d = o.dir(); if (d && d.lengthSq() > 1e-6) g.quaternion.setFromUnitVectors(UP, d.clone().normalize()); }
      const e = Math.min(1, t / grow), rr = r0 + (r - r0) * (1 - Math.pow(1 - e, 3));
      m.scale.set(rr, 1, rr); m.rotation.y += dt * spin;
      mat.uniforms.uProg.value = Math.min(1, t / draw);
      const fin = Math.max(0, Math.min(1, (it.life - t) / fade));
      mat.uniforms.uAlpha.value = Math.min(1, t / 0.06) * fin * al * (o.pulse ? 0.75 + 0.25 * Math.sin(t * o.pulse) : 1);
    });
    return { it, g, end(d) { if (it && !it.dead) it.life = Math.min(it.life, it.t + (d == null ? fade : d)); } };
  }

  // le bâton se charge : particules aspirées vers le cristal du bâton, lueur qui gonfle
  function charge(ctx, c, dur, o) {
    o = o || {};
    const f = ctx.f, fx = ctx.fx, steps = Math.max(1, Math.round(dur / 0.04));
    ctx.every(dur, dur / steps, () => {
      const tip = tipOf(f);
      for (let j = 0; j < (o.n || 3); j++) { const d = new V3(rnd(-1, 1), rnd(-0.5, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1.1, 2.0)); fx.spark(tip.clone().add(d), d.clone().multiplyScalar(-1 / 0.26), { color: j ? c : 0xffffff, life: 0.24, size: 0.32, size1: 0.06 }); }
    });
    const mat = addMat(c, 2.6, 0.9), m = new THREE.Mesh(G.sph, mat), sz = o.size || 1;
    fx.add(m, dur + 0.14, (k, ob, dt, t) => { ob.position.copy(tipOf(f)); const e = Math.min(1, t / dur); ob.scale.setScalar((0.1 + 0.32 * e * sz) * (1 + Math.sin(t * 45) * 0.12)); mat.opacity = t > dur ? Math.max(0, 1 - (t - dur) / 0.14) : 0.5 + 0.45 * e; });
    fx.light(tipOf(f), c, 2 * sz, 8, dur + 0.1);
  }

  // explosion arcanique (flash, ondes, gerbes, rune éclair)
  function blast(ctx, p, c, k, o) {
    o = o || {}; k = k || 1;
    const fx = ctx.fx, g = new V3(p.x, 0.06, p.z);
    fx.flash(p, { color: c, r: 1.5 * k, life: 0.28, intensity: 5 * k, bright: 3 });
    fx.flash(p, { color: 0xffffff, r: 0.8 * k, life: 0.12, light: false, bright: 4 });
    fx.ring(g, { r0: 0.3, r1: 4.5 * k, color: c, life: 0.4, width: 0.25 });
    fx.ring(g, { r0: 0.2, r1: 2.8 * k, color: 0xffffff, life: 0.25, width: 0.4 });
    fx.burst(p, { n: Math.round(34 * k), color: c, speed: 13 * Math.sqrt(k), life: 0.55, size: 0.4, grav: 6 });
    fx.burst(p, { n: Math.round(12 * k), color: 0xffffff, speed: 8 * Math.sqrt(k), life: 0.3, size: 0.25 });
    if (o.rune !== false) rune(ctx, g, { r: 2.2 * k, r0: 0.8 * k, color: c, life: 0.45, draw: 0.06, grow: 0.12, spin: 3, star: 0.7, fade: 0.3 });
    if (o.smoke) fx.burst(g, { n: Math.round(10 * k), color: 0x2a2238, kind: 'smoke', speed: 5 * k, up: 0.4, life: 0.9, size: 1.2 * k, size1: 2.4 * k, grav: -0.5, drag: 2.2, alpha: 0.6 });
    if (o.snd !== false) { snd(ctx, 'boom', { len: 0.35 + 0.3 * k, g: Math.min(1.1, 0.3 + 0.25 * k), rate: o.rate || 1.3 }); snd(ctx, 'magic', { rate: 0.5 + 0.3 / k, g: 0.6 }); }
    ctx.shake(Math.min(1.1, 0.1 + 0.18 * k));
  }
  // petit impact
  function pop(ctx, p, c, k) {
    const fx = ctx.fx; k = k || 1;
    fx.flash(p, { color: c, r: 0.9 * k, life: 0.16, intensity: 3 * k, light: k > 0.8 });
    fx.ring(new V3(p.x, 0.06, p.z), { r0: 0.2, r1: 2.2 * k, color: c, life: 0.26, width: 0.3 });
    fx.burst(p, { n: Math.round(14 * k), color: c, speed: 8 * k, life: 0.35, size: 0.3, grav: 4 });
  }
  // éclair du ciel
  function skyBolt(ctx, p, c, h) {
    const fx = ctx.fx, top = new V3(p.x + rnd(-1.5, 1.5), h || 14, p.z + rnd(-1.5, 1.5)), b = new V3(p.x, Math.max(0.1, p.y || 0), p.z);
    fx.bolt(top, b, { color: c, life: 0.25, jitter: 1.2, segs: 16 });
    fx.bolt(top, b, { color: 0xffffff, life: 0.12, jitter: 0.6, segs: 10, light: false });
    fx.flash(b.clone().setY(Math.max(0.8, b.y)), { color: c, r: 1.1, life: 0.18, intensity: 4 });
  }

  // projectile lumineux (cœur + halo + traînée) ; matériaux détruits à la fin du vol
  function orbMesh(color, size, shard) {
    const g = new THREE.Group(), c = C(color);
    const mCore = new THREE.MeshBasicMaterial({ color: C(0xffffff).lerp(c, 0.3).multiplyScalar(2.4) });
    const mHalo = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2), transparent: true, opacity: 0.55, blending: ADD, depthWrite: false });
    const mTail = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.8), transparent: true, opacity: 0.3, blending: ADD, depthWrite: false });
    const core = new THREE.Mesh(shard ? G.shardZ : G.ico, mCore); core.scale.setScalar(size * (shard ? 0.9 : 0.42));
    const halo = new THREE.Mesh(G.sph, mHalo); halo.scale.setScalar(size * 0.8);
    const tail = new THREE.Mesh(G.sph, mTail); tail.scale.set(size * 0.45, size * 0.45, size * 2.4); tail.position.z = -size * 2.0;
    g.add(core, halo, tail); g.userData.mats = [mCore, mHalo, mTail]; g.userData.core = core; g.userData.shard = !!shard;
    return g;
  }
  const disposeMesh = m => { if (m && m.userData && m.userData.mats) { m.userData.mats.forEach(x => x.dispose()); m.userData.mats = null; } };
  // projectile magique ; api = autre lanceur (invocations), sinon ctx
  function missile(ctx, o, api) {
    const mesh = orbMesh(o.color || COL.arc, o.msize || 0.6, o.shard), end = o.onEnd, upd = o.onUpdate;
    return (api || ctx).proj(Object.assign({}, o, { mesh,
      onUpdate: (p, d) => { const cr = mesh.userData.core; if (cr && !mesh.userData.shard) { cr.rotation.x += d * 9; cr.rotation.y += d * 7; } if (upd) upd(p, d); },
      onEnd: p => { disposeMesh(mesh); if (end) end(p); } }));
  }

  // champ de pics (glace ou cristal) qui jaillissent puis éclatent : s = [{ x, z, h, w, rx, rz, d (délai) }]
  function iceField(ctx, spikes, life, o) {
    o = o || {};
    const fx = ctx.fx, col = o.color || 0xc8f6ff, em = o.emissive || COL.ice;
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: C(em), emissiveIntensity: o.glow || 1.1, roughness: 0.12, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.92 });
    const grp = new THREE.Group(), out = 0.22;
    spikes.forEach(s => { const m = new THREE.Mesh(G.spike, mat); m.position.set(s.x, -0.05, s.z); m.rotation.set(s.rx || 0, s.ry || 0, s.rz || 0); m.scale.set(s.w || 1, 0.001, s.w || 1); m.visible = false; m.userData.s = s; grp.add(m); });
    return fx.add(grp, life, (k, obj, dt, t) => {
      const sh = Math.max(0, (t - (life - out)) / out);
      for (const m of obj.children) {
        const s = m.userData.s, tt = t - (s.d || 0);
        if (tt < 0) { m.visible = false; continue; }
        m.visible = true;
        const gr = Math.min(1, tt / 0.07), w = (s.w || 1) * (1 - sh * 0.6);
        m.scale.set(w, Math.max(0.001, s.h * (1 - Math.pow(1 - gr, 3)) * (1 - sh)), w);
      }
      mat.opacity = 0.92 * (1 - sh * 0.5);
    }, false, () => {
      if (o.shatter === false) return;
      const n = Math.min(spikes.length, 14);
      for (let i = 0; i < n; i++) { const s = spikes[Math.floor(i * spikes.length / n)]; fx.burst(new V3(s.x, 0.5 * (s.h || 1), s.z), { n: 5, color: o.shardCol || 0xd8f8ff, speed: 6, life: 0.4, size: 0.22, grav: 14 }); }
    });
  }
  // gel visible sur une cible : petits pics de glace à ses pieds
  function frostOn(ctx, p, k) {
    k = Math.max(0.6, Math.min(1.6, k || 1));
    const s = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + Math.random(), r = 0.5 * k; s.push({ x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, h: rnd(0.8, 1.5) * k, w: rnd(0.7, 1.1) * k, rx: Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.5, d: i * 0.015 }); }
    iceField(ctx, s, 1.1);
    ctx.fx.burst(new V3(p.x, 0.8, p.z), { n: 10, color: 0xd8f8ff, speed: 4, life: 0.4, size: 0.25, grav: 6 });
  }
  // implosion noire + éclat violet
  function voidBurst(ctx, q, k) {
    const fx = ctx.fx; k = k || 1;
    const m = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.92, depthWrite: false }));
    m.position.copy(q); fx.add(m, 0.16, (kk, o) => { o.scale.setScalar(Math.max(0.01, 1.3 * k * (1 - kk * 0.95))); });
    fx.flash(q, { color: COL.void, r: 1.6 * k, life: 0.25, intensity: 5 });
    fx.ring(new V3(q.x, 0.06, q.z), { r0: 0.3, r1: 3.2 * k, color: COL.void, life: 0.3, width: 0.3 });
    fx.burst(q, { n: Math.round(30 * k), color: COL.void, speed: 12, life: 0.45, size: 0.35 });
    fx.burst(q, { n: Math.round(12 * k), color: 0x1a0830, kind: 'smoke', speed: 5, life: 0.7, size: 1, size1: 2, grav: -1, alpha: 0.8 });
  }
  function voidPuff(ctx, q) {
    ctx.fx.burst(q, { n: 22, color: 0x1a0830, kind: 'smoke', speed: 4, life: 0.7, size: 0.9, size1: 1.7, grav: -1, alpha: 0.85 });
    ctx.fx.burst(q, { n: 16, color: COL.void, speed: 7, life: 0.35, size: 0.3 });
  }
  // singularité (visuel) : cœur noir, horizon lumineux, disques d'accrétion, matière aspirée ; s'effondre à la fin
  function singularity(ctx, p, s, dur, o) {
    o = o || {};
    const fx = ctx.fx, c = o.color || COL.void, grp = new THREE.Group(); grp.position.copy(p);
    const core = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const rimM = shell(c, 1.6, 1), rim = new THREE.Mesh(G.sph, rimM); rim.scale.setScalar(1.22);
    const d1M = swirlMat(c, 0.3), d2M = swirlMat(0xe0c0ff, 0.45);
    const disk = new THREE.Mesh(G.plane, d1M); disk.scale.setScalar(4); disk.rotation.x = 0.35; disk.renderOrder = 6;
    const disk2 = new THREE.Mesh(G.plane, d2M); disk2.scale.setScalar(2.3); disk2.rotation.x = -0.9; disk2.rotation.z = 0.4; disk2.renderOrder = 6;
    grp.add(core, rim, disk, disk2);
    const CL = 0.18;
    fx.add(grp, dur, (k, obj, dt, t) => {
      const grow = Math.min(1, t / 0.25), end = Math.max(0, (t - (dur - CL)) / CL);
      obj.scale.setScalar(Math.max(0.001, s * grow * (1 - end * end) * (1 + Math.sin(t * 22) * 0.03)));
      disk.rotation.y += dt * 3; disk2.rotation.y -= dt * 4.5;
      d1M.uniforms.uTime.value = t; d2M.uniforms.uTime.value = t * 1.3;
      if (rimM.uniforms) rimM.uniforms.uTime.value = t;
      if (end > 0) return;
      const n = o.n || 5;
      for (let j = 0; j < n; j++) { const a = Math.random() * 6.283, r = s * rnd(3.5, 6.5), q = p.clone().add(new V3(Math.cos(a) * r, rnd(-1.2, 1.2) * s, Math.sin(a) * r)); fx.spark(q, p.clone().sub(q).multiplyScalar(2.4).add(new V3(-Math.sin(a) * 4 * s, 0, Math.cos(a) * 4 * s)), { color: j % 2 ? c : 0xe0c0ff, life: 0.4, size: 0.3 * Math.max(0.7, s) }); }
      if (o.dust && Math.random() < dt * 14) { const a = Math.random() * 6.283, r = s * rnd(3, 5.5), q = new V3(p.x + Math.cos(a) * r, 0.2, p.z + Math.sin(a) * r); fx.spark(q, p.clone().sub(q).multiplyScalar(1.6), { kind: 'smoke', color: 0x3a3044, life: 0.6, size: 0.5, size1: 0.15, alpha: 0.8 }); }
    });
  }
  // éclat d'étoile qui tombe du ciel (visuel)
  function fallingStar(ctx, from, to, dur, c, sc) {
    sc = sc || 1;
    const fx = ctx.fx, g = new THREE.Group(), mC = new THREE.MeshBasicMaterial({ color: C(0xffffff).multiplyScalar(2.6) }), mG = addMat(c, 2.2, 0.5);
    const core = new THREE.Mesh(G.shardZ, mC); core.scale.setScalar(0.55 * sc);
    const glow = new THREE.Mesh(G.sph, mG); glow.scale.set(0.45 * sc, 0.45 * sc, 2.2 * sc); glow.position.z = -1.0 * sc;
    g.add(core, glow); g.position.copy(from); g.lookAt(to);
    fx.add(g, dur, (k, o, dt) => { o.position.lerpVectors(from, to, Math.pow(k, 1.3)); core.rotation.z += dt * 20; fx.spark(o.position, new V3(rnd(-0.5, 0.5), 1.5, rnd(-0.5, 0.5)), { color: c, life: 0.3, size: 0.35 * sc, size1: 0.05 }); });
  }
  // soin d'un allié : chaque client soigne SON joueur (le cast est rejoué chez tout le monde)
  function healAlly(ctx, a, amount) { if (!a || a.kind === 'remote' || !a.alive) return; ctx.heal(a, amount); }
  function reviveAlly(ctx, a, k) {
    if (!a || a.kind !== 'local' || a.alive) return;
    try { const T = BR.Arena && BR.Arena.ascTools ? BR.Arena.ascTools() : null; if (T && T.revive) { T.revive(a, k); return; } } catch (e) { /* repli */ }
    a.alive = true; a.down = false; a.hp = Math.round(a.maxHp * k); a.play('Lie_StandUp', 1.5);
  }

  /* =====================================================================
     KIT DE DÉPART : traits, onde, fente, pluie (+ ultime u_meteore)
     ===================================================================== */

  /* ---------- Missiles arcaniques ---------- */
  Q.variant(CLS, 'traits', (ctx) => {
    const { f, fx } = ctx, c = COL.arc, n = (ctx.lv >= 3 ? 5 : 3) + Math.min(2, TR(f, 'mg_traits')), yaw = ctx.face(), fw = f.fwd();
    ctx.anim('Spellcast_Shoot', 1.6); ctx.act({ dur: 0.3, face: yaw });
    charge(ctx, c, 0.1, { n: 2 });
    rune(ctx, f.center().addScaledVector(fw, -0.3).add(new V3(0, 0.55, 0)), { r: 1.15, r0: 0.4, color: c, life: 0.25 + n * 0.07 + 0.2, draw: 0.1, vertical: true, yaw, spin: 5, star: 1 });
    snd(ctx, 'magic', { rate: 0.7, g: 0.8 });
    const split = (at, t0) => {
      const k0 = gk(t0), others = uniq(near(ctx, at, 12).filter(e => gk(e) !== k0)).slice(0, 2);
      for (let j = 0; j < 2; j++) {
        const tg = others[j], dir = tg ? tg.pos.clone().sub(at).normalize() : new V3(j ? 1 : -1, 0.8, 0).normalize();
        missile(ctx, { pos: at.clone().addScaledVector(dir, (t0.r || 1) + 0.7), vel: dir.multiplyScalar(22), r: 0.4, dmg: ctx.dmg(30), life: 1.0, size: 0.35, msize: 0.32, homing: 9, color: COL.arc2, target: tg || undefined });
      }
      fx.burst(at, { n: 10, color: COL.arc2, speed: 9, life: 0.3, size: 0.25 });
    };
    for (let i = 0; i < n; i++) ctx.later(0.1 + i * 0.065, () => {
      const off = i - (n - 1) / 2, fw2 = f.fwd(), sd = new V3(fw2.z, 0, -fw2.x);
      const from = f.center().add(new V3(0, 0.75 + Math.abs(off) * 0.12, 0)).addScaledVector(sd, off * 0.42).addScaledVector(fw2, -0.15);
      const v = ctx.dirToAim().applyAxisAngle(UP, off * 0.5).multiplyScalar(17).add(new V3(0, 4.5, 0));
      fx.flash(from, { color: c, r: 0.5, life: 0.12, light: false });
      fx.burst(from, { n: 6, color: c, speed: 4, life: 0.25, size: 0.25 });
      snd(ctx, 'magic', { rate: 1.15 + i * 0.12, g: 0.55 }); snd(ctx, 'zap', { g: 0.18 });
      let tt = 0;
      missile(ctx, { pos: from, vel: v, r: 0.5, dmg: ctx.dmg(80), life: 2.2, size: 0.55, msize: 0.55, homing: 6.5, color: c,
        onUpdate: (p, d) => {
          tt += d;
          const q = p.vel.clone(); if (q.lengthSq() < 1e-6) return; q.normalize();
          const s1 = new V3(q.z, 0, -q.x); if (s1.lengthSq() < 1e-6) s1.set(1, 0, 0); s1.normalize();
          fx.spark(p.pos.clone().addScaledVector(s1, Math.sin(tt * 28 + i) * 0.35).add(new V3(0, Math.cos(tt * 28 + i) * 0.35, 0)), new V3(), { color: i % 2 ? c : COL.arc2, life: 0.3, size: 0.28, size1: 0.04 });
        },
        onHit: (p, t) => {
          const at = p.pos.clone();
          pop(ctx, at, c, 0.75); snd(ctx, 'hit', { rate: 1.5, g: 0.35 });
          ctx.hitSphere(at, 1.9, ctx.dmg(20), { kb: 2 });
          if (ctx.lv >= 5 && t) split(at, t);
        } });
    });
  });

  /* ---------- Nova de givre ---------- */
  Q.variant(CLS, 'onde', (ctx) => {
    const { f, fx } = ctx, c = COL.ice, R = ctx.lv >= 3 ? 8.4 : 6, p0 = gnd(f.pos);
    ctx.anim('Spellcast_Raise', 2.2); ctx.act({ dur: 0.55 });
    charge(ctx, c, 0.2);
    rune(ctx, p0, { r: 2.6, r0: 1.2, color: c, life: 0.5, draw: 0.2, spin: 2.5, follow: () => gnd(f.pos) });
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, q = p0.clone().add(new V3(Math.cos(a) * R * 0.6, 0.3, Math.sin(a) * R * 0.6)); fx.spark(q, new V3(-Math.cos(a), 0.1, -Math.sin(a)).multiplyScalar(R * 0.6 / 0.3), { kind: 'smoke', color: 0xcfefff, life: 0.3, size: 0.9, size1: 0.3, alpha: 0.5 }); }
    snd(ctx, 'ice', { g: 0.6 }); snd(ctx, 'charge', { len: 0.25, g: 0.5 });
    ctx.later(0.19, () => ctx.anim('2H_Melee_Attack_Chop', 2.4));   // le bâton frappe le sol
    const second = ctx.lv >= 5 || TR(f, 'mg_onde') > 0, hold = second ? 1.25 : 1.0;
    ctx.later(0.27, () => {
      const p = gnd(f.pos);
      ctx.hitstop(0.07); ctx.shake(0.5);
      fx.flash(p.clone().setY(1), { color: c, r: 2.2, life: 0.25, intensity: 6 });
      fx.ring(p, { r0: 0.5, r1: R, color: c, life: 0.4, width: 0.3 });
      fx.ring(p, { r0: 0.3, r1: R * 0.7, color: 0xffffff, life: 0.3, width: 0.45 });
      fx.burst(p.clone().setY(0.4), { n: 50, color: 0xd8f8ff, speed: 16, life: 0.5, size: 0.3, flat: true, grav: 2 });
      fx.burst(p.clone().setY(0.3), { n: 24, color: 0xcfefff, kind: 'smoke', speed: 10, flat: true, life: 0.9, size: 1.2, size1: 2.6, alpha: 0.45, drag: 2.5, grav: 0 });
      snd(ctx, 'ice', { g: 1 }); snd(ctx, 'boom', { rate: 1.7, len: 0.5, g: 0.7 }); snd(ctx, 'stomp', { g: 0.6 });
      // couronne de pics de glace qui jaillit du centre vers l'extérieur
      const rows = ctx.lv >= 3 ? 4 : 3, spikes = [];
      for (let r = 0; r < rows; r++) {
        const rad = 1.6 + (R - 1.8) * (r / (rows - 1)), cnt = Math.round(rad * 2.6);
        for (let i = 0; i < cnt; i++) {
          const a = (i + (r % 2) * 0.5) / cnt * 6.283, h = (1.3 + 0.9 * (1 - r / rows)) * (0.7 + 0.3 * Math.abs(Math.sin(a * 3 + r)));
          spikes.push({ x: p.x + Math.cos(a) * rad, z: p.z + Math.sin(a) * rad, h, w: 0.9 + 0.5 * (1 - r / rows), rx: Math.sin(a) * 0.45, rz: -Math.cos(a) * 0.45, d: rad / R * 0.18 });
        }
      }
      iceField(ctx, spikes, hold);
      ctx.hitSphere(p.clone().setY(1), R, ctx.dmg(200), { kb: 9, launch: 3, freeze: 1.4, stun: 0.5, posture: 2 });
      near(ctx, p, R).slice(0, 14).forEach(t => frostOn(ctx, t.pos, t.r || 1));
    });
    // niveau 5 (ou arbre « seconde vague ») : les pics éclatent une seconde fois
    if (second) ctx.later(0.27 + hold - 0.05, () => {
      const p = gnd(f.pos);
      fx.flash(p.clone().setY(1), { color: 0xffffff, r: 2, life: 0.2, intensity: 5 });
      fx.burst(p.clone().setY(0.8), { n: 60, color: 0xd8f8ff, speed: 18, life: 0.6, size: 0.3, grav: 16 });
      fx.ring(p, { r0: R * 0.3, r1: R * 1.1, color: c, life: 0.35, width: 0.2 });
      snd(ctx, 'break', { g: 0.35 }); snd(ctx, 'ice', { g: 0.9, rate: 1.2 });
      ctx.shake(0.35);
      ctx.hitSphere(p.clone().setY(1), R, ctx.dmg(110), { stun: 0.3, freeze: 0.8 });
    });
  });

  /* ---------- Transfert ---------- */
  Q.variant(CLS, 'fente', (ctx) => {
    const { f, fx } = ctx, c = COL.arc, p0 = gnd(f.pos), p1 = ctx.clampAim(11), yaw = ctx.face();
    ctx.anim('Spellcast_Shoot', 2.2); ctx.act({ dur: 0.26, face: yaw });
    f.inv = Math.max(f.inv || 0, 0.45);
    rune(ctx, p0, { r: 1.8, r0: 0.6, color: c, life: 0.45, draw: 0.08, spin: 6 });
    rune(ctx, p1, { r: 2.2, r0: 0.6, color: c, life: 0.6, draw: 0.1, spin: -6 });
    snd(ctx, 'magic', { rate: 1.6 }); snd(ctx, 'dash', { rate: 1.3 });
    const cen0 = f.center();
    for (let i = 0; i < 16; i++) { const d = new V3(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1)).normalize().multiplyScalar(1.8); fx.spark(cen0.clone().add(d), d.clone().multiplyScalar(-1 / 0.09), { color: c, life: 0.09, size: 0.4, size1: 0.1 }); }
    ctx.later(0.08, () => {
      const a = f.center();
      fx.flash(a, { color: c, r: 1.3, life: 0.18, intensity: 4 });
      voidPuff(ctx, a);
      moveTo(ctx, p1);
      const b = new V3(p1.x, 1.05, p1.z);
      fx.bolt(a, b, { color: c, life: 0.22, jitter: 0.35, segs: 12 });
      fx.bolt(a, b, { color: 0xffffff, life: 0.12, jitter: 0.2, segs: 8, light: false });
      for (let k = 0; k <= 10; k++) fx.spark(a.clone().lerp(b, k / 10), new V3(rnd(-1, 1), rnd(0, 2), rnd(-1, 1)), { color: c, life: 0.45, size: 0.4, size1: 0.05 });
      ctx.hitSphere(a, 2.8, ctx.dmg(80), { kb: -3 });
      ctx.later(0.04, () => {
        const q = owns(f) ? f.center() : b;
        blast(ctx, q, c, 1.05, { rate: 1.5 });
        const h = ctx.hitSphere(q, 3.6, ctx.dmg(150), { kb: 8, launch: 2, stun: 0.3, posture: 1.5 });
        if (h.length) ctx.hitstop(0.05);
        const nShard = (ctx.lv >= 5 ? 5 : 0) + (TR(f, 'mg_fente') ? 5 : 0);
        if (nShard) {
          const list = uniq(near(ctx, q, 14));
          for (let i = 0; i < nShard; i++) {
            const tg = list.length ? list[i % list.length] : null, ang = i / nShard * 6.283;
            const dir = tg ? tg.pos.clone().sub(q).normalize() : new V3(Math.cos(ang), 0.3, Math.sin(ang)).normalize();
            missile(ctx, { pos: q.clone().add(new V3(Math.cos(ang) * 0.6, 0.4, Math.sin(ang) * 0.6)), vel: dir.multiplyScalar(24).add(new V3(0, 3, 0)), r: 0.45, dmg: ctx.dmg(45), life: 1.2, size: 0.4, msize: 0.4, homing: 9, color: COL.arc2, shard: true });
          }
        }
      });
    });
    // niveau 3 : rune piégée laissée au départ
    if (ctx.lv >= 3) {
      rune(ctx, p0, { r: 2.4, r0: 1.2, color: COL.arc2, life: 1.0, draw: 0.15, spin: 4, pulse: 30 });
      ctx.later(0.98, () => { blast(ctx, p0.clone().setY(0.8), COL.arc2, 1.2); ctx.hitSphere(p0.clone().setY(1), 3.4, ctx.dmg(150), { stun: 0.6, kb: 6, launch: 3 }); });
    }
  });

  /* ---------- Averse d'étoiles ---------- */
  Q.variant(CLS, 'pluie', (ctx) => {
    const { f, fx } = ctx, c = COL.star, c2 = COL.arc, center = ctx.clampAim(18), R = ctx.lv >= 3 ? 5.2 : 4.6, n = (ctx.lv >= 3 ? 24 : 14) + 6 * Math.min(2, TR(f, 'mg_pluie'));
    const giant = ctx.lv >= 5 || TR(f, 'mg_pluie2') > 0;
    const rng = seeded(ctx), T0 = 0.45, SPAN = 1.3, SKY = 15, FALL = 0.24;
    ctx.anim('Spellcast_Raise', 1.5); ctx.act({ dur: 0.45, face: ctx.face() });
    charge(ctx, c, 0.3);
    snd(ctx, 'magic', { rate: 0.6 }); snd(ctx, 'charge', { len: 0.4, g: 0.5 });
    ctx.later(0.25, () => { const tip = tipOf(f); fx.bolt(tip, tip.clone().add(new V3(0, 16, 0)), { color: c, life: 0.25, jitter: 0.25, light: false }); fx.flash(tip, { color: c, r: 0.7, life: 0.2 }); snd(ctx, 'zap', { g: 0.3, rate: 1.5 }); });
    const life = T0 + SPAN + 0.6 + (giant ? 0.5 : 0);
    rune(ctx, center, { r: R + 0.4, r0: 1.5, color: c2, life, draw: 0.4, spin: 0.8, star: 1 });
    rune(ctx, new V3(center.x, SKY, center.z), { r: R, r0: 1.5, color: c, life: life - 0.2, draw: 0.35, spin: -1.2, star: 1, lift: 0 });
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.283, r = Math.sqrt(rng()) * R * 0.92, a2 = rng() * 6.283, r2 = rng() * R * 0.6;
      ctx.later(T0 + i * (SPAN / n), () => {
        let p = new V3(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r);
        if (i % 3 === 1) { const list = near(ctx, center, R); if (list.length) { const t = list[Math.floor(i / 3) % list.length]; p = gnd(t.pos); } }
        const from = new V3(center.x + Math.cos(a2) * r2, SKY, center.z + Math.sin(a2) * r2);
        fallingStar(ctx, from, p.clone().setY(0.2), FALL, c, 1);
        ctx.later(FALL, () => {
          fx.flash(p.clone().setY(0.6), { color: c, r: 0.9, life: 0.15, intensity: 2.5, light: i % 4 === 0 });
          fx.ring(p, { r0: 0.2, r1: 2, color: c2, life: 0.28, width: 0.3 });
          fx.burst(p.clone().setY(0.3), { n: 12, color: i % 2 ? c : c2, speed: 8, up: 0.6, life: 0.4, size: 0.3, grav: 12 });
          if (i % 2 === 0) snd(ctx, 'hit', { rate: 1.7, g: 0.3 }); else snd(ctx, 'magic', { rate: 1.8, g: 0.22 });
          ctx.shake(0.06);
          ctx.hitSphere(p.clone().setY(1), 1.9, ctx.dmg(55), { freeze: 0.5, posture: 0.6 });
        });
      });
    }
    // niveau 5 (ou arbre « étoile géante ») : une étoile géante s'écrase au centre
    if (giant) {
      const TF = T0 + SPAN + 0.3;
      ctx.later(TF, () => { fallingStar(ctx, new V3(center.x, SKY, center.z), center.clone().setY(0.3), 0.3, c, 3.5); snd(ctx, 'charge', { len: 0.3, g: 0.5 }); });
      ctx.later(TF + 0.3, () => {
        const q = center.clone().setY(0.8);
        blast(ctx, q, c, 1.7, { rate: 1.0, smoke: true });
        fx.pillar(center, { color: c, r: 1.6, h: 16, life: 0.5, grow: 1 });
        ctx.hitstop(0.08); ctx.shake(0.6);
        ctx.hitSphere(q, R, ctx.dmg(55) * 4, { stun: 0.8, kb: 7, launch: 5, posture: 3 });
      });
    }
  });

  /* ---------- Météore arcanique (ultime de départ) ---------- */
  function meteor(ctx, p, size, delay, dmgK, main) {
    const { f, fx } = ctx, c = COL.fire, FALL = main ? 1.4 : 1.1;
    const from = p.clone().add(new V3(-24, 50, -16).multiplyScalar(main ? 1 : 0.6)), fallDir = p.clone().sub(from).normalize();
    ctx.later(delay, () => {
      rune(ctx, p, { r: 8 * size, r0: 3 * size, color: c, life: FALL + 0.3, draw: main ? 0.8 : 0.4, spin: 0.7, star: 1 });
      fx.decal(p, 'circle', { r: 8 * size, color: 0xff3a1a, dur: FALL, hold: 0.15, world: false });
      if (main) { rune(ctx, from, { r: 7, r0: 2, color: c, life: 1.3, draw: 0.35, spin: 2, dir: () => fallDir }); snd(ctx, 'fire', { len: 2.2, g: 0.9 }); }
      const grp = new THREE.Group();
      const rock = new THREE.Mesh(G.ico1, new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: C(c), emissiveIntensity: 1.4, flatShading: true, roughness: 0.85 }));
      const shM = shell(c, 1.2, 1), sh = new THREE.Mesh(G.sph, shM); sh.scale.setScalar(1.35);
      const halo = new THREE.Mesh(G.sph, addMat(COL.ember, 1.6, 0.22)); halo.scale.set(1.9, 1.9, 4.2); halo.position.z = -2.2;
      grp.add(rock, sh, halo); grp.scale.setScalar(3.2 * size); grp.position.copy(from); grp.lookAt(p);
      fx.add(grp, FALL, (k, o, dt, t) => {
        o.position.copy(from).lerp(p, Math.pow(k, 1.5));
        rock.rotation.x += dt * 3; rock.rotation.y += dt * 2;
        if (shM.uniforms) shM.uniforms.uTime.value = t;
        halo.scale.z = 4.2 * (1 + Math.sin(t * 30) * 0.12);
        for (let j = 0; j < (main ? 6 : 3); j++) fx.spark(o.position.clone().add(new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(2 * size)), new V3(rnd(-2, 2), rnd(0, 3), rnd(-2, 2)), { color: j % 2 ? c : 0xffcc66, life: 0.6, size: 1.5 * size, size1: 0.2 });
        if (Math.random() < dt * 30) fx.spark(o.position, new V3(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)), { kind: 'smoke', color: 0x1a1210, life: 1.4, size: 2.5 * size, size1: 4.5 * size, alpha: 0.7, grav: -0.5 });
        if (main && Math.random() < dt * 8) fx.light(o.position, c, 4, 40, 0.2);
      });
    });
    ctx.later(delay + FALL - 0.35, () => ctx.shake(0.3 * size));
    ctx.later(delay + FALL, () => {
      const q = p.clone().setY(1);
      if (main) { ctx.slowmo(0.55); flashScreen(ctx, 0.55, 0.28, 0.12); }
      if (H().impact) H().impact(ctx, q, c, 3.4 * size, { pillar: true }); else blast(ctx, q, c, 3 * size);
      fx.ring(p, { r1: 16 * size, color: 0xffd080, life: 0.9, width: 0.06 });
      fx.ring(p, { r1: 11 * size, color: c, life: 0.7, width: 0.25 });
      if (fx.debris) fx.debris(p, { n: Math.round(26 * size), r: 2.5 * size, speed: 16 * Math.sqrt(size), size: 0.5 * size, up: 1.2 });
      fx.burst(p.clone().setY(1), { n: Math.round(40 * size), color: 0x2a1c18, kind: 'smoke', speed: 5 * size, up: 2.5, life: 1.8, size: 3 * size, size1: 6 * size, grav: -1.2, drag: 1.4, alpha: 0.6 });
      rune(ctx, p, { r: 9 * size, r0: 9 * size, color: 0xffd080, life: 0.5, draw: 0.05, spin: 0 });
      ctx.hitstop(0.16 * size); ctx.shake(1.3 * size);
      snd(ctx, 'boom', { len: 2 * size, rate: 0.8 }); if (main) snd(ctx, 'break', { g: 0.6 });
      ctx.hitSphere(q, 8 * size, ctx.dmg(1500) * dmgK, { launch: 14, posture: 8 * size, kb: 12, stun: main ? 0.6 : 0.2 });
      // cratère brûlant (arbre « brasier » : large dès le niveau 1 et brûle 8 s)
      const blaze = TR(ctx.f, 'mg_u_crat') > 0, crT = blaze ? 8 : 4;
      const cr = (ctx.lv >= 3 || blaze ? 7 : 5) * size;
      fx.decal(p, 'circle', { r: cr + 0.5, color: 0xff5a1a, dur: 0.01, hold: crT, noWarn: true, world: false });
      ctx.zone({ pos: p, life: crT, iv: 0.5, onTick: z => {
        ctx.hitSphere(z.pos.clone().setY(0.6), cr, ctx.dmg(ctx.lv >= 3 ? 60 : 35), {});
        for (let k = 0; k < 10; k++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * cr; fx.spark(z.pos.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new V3(0, rnd(2, 6), 0), { color: k % 2 ? c : 0xffaa40, life: 0.6, size: 0.8, size1: 0.05 }); }
      } });
    });
    void f;
  }
  Q.variant(CLS, 'u_meteore', (ctx) => {
    const { f, fx } = ctx, c = COL.fire, center = ctx.clampAim(24);
    ctx.anim('Spellcast_Raise', 1.0); ctx.act({ dur: 0.9, face: ctx.face() });
    charge(ctx, c, 0.6, { size: 1.6, n: 4 });
    rune(ctx, f.pos, { r: 2.6, r0: 1, color: c, life: 1.3, draw: 0.4, spin: 2, follow: () => gnd(f.pos) });
    snd(ctx, 'charge', { len: 1.3 }); snd(ctx, 'roar', { rate: 0.55, g: 0.35 });
    ctx.later(0.5, () => {
      ctx.anim('Spellcast_Long', 1.2);
      const tip = tipOf(f); fx.bolt(tip, tip.clone().add(new V3(-6, 30, -4)), { color: c, life: 0.3, jitter: 0.3 }); fx.flash(tip, { color: c, r: 1, life: 0.25, intensity: 5 });
      fx.pillar(gnd(f.pos), { color: c, r: 1.2, h: 14, life: 0.5, grow: 0.5, alpha: 0.6 });
    });
    meteor(ctx, center, 1, 0.25, 1, true);
    // niveau 5 et/ou arbre « pluie de braises » : 6 petits météores autour (12 avec les deux)
    const nm = (ctx.lv >= 5 ? 6 : 0) + (TR(f, 'mg_u_pluie') ? 6 : 0);
    for (let i = 0; i < nm; i++) { const ring = i >= 6 ? 1 : 0, a = (i % 6) / 6 * 6.283 + 0.3 + ring * 0.52, rr = ring ? 14 : 9; meteor(ctx, clampArena(ctx, center.clone().add(new V3(Math.cos(a) * rr, 0, Math.sin(a) * rr))), 0.45, 0.9 + i * 0.16, 0.2, false); }
  });

  /* =====================================================================
     AUTRES POUVOIRS
     ===================================================================== */

  /* ---------- Orbes gardiens ---------- */
  Q.variant(CLS, 'tourbillon', (ctx) => {
    const { f, fx } = ctx, c = COL.cyan, n = ctx.lv >= 3 ? 8 : 6, dur = 3.2, RAD = 2.6;
    ctx.anim('Spellcast_Raise', 1.8); ctx.act({ dur: 0.25, lockMove: false });
    charge(ctx, c, 0.15);
    snd(ctx, 'magic', { rate: 1.2 }); snd(ctx, 'charge', { len: 0.3, g: 0.4 });
    const wind = loop(ctx, 'wind', 0.35); ctx.later(dur, () => wind.stop());
    rune(ctx, f.pos, { r: RAD + 0.4, r0: 0.5, color: c, life: dur + 0.2, draw: 0.3, spin: 2.2, star: 0.6, alpha: 0.7, follow: () => gnd(f.pos) });
    const grp = new THREE.Group(), mCore = new THREE.MeshBasicMaterial({ color: C(0xffffff).lerp(C(c), 0.4).multiplyScalar(2.4) }), mHalo = addMat(c, 2.2, 0.5);
    const orbs = [], W = [];
    for (let i = 0; i < n; i++) { const core = new THREE.Mesh(G.ico, mCore), halo = new THREE.Mesh(G.sph, mHalo), o = new THREE.Group(); core.scale.setScalar(0.26); halo.scale.setScalar(0.5); o.add(core, halo); grp.add(o); orbs.push({ o, core }); W.push(f.center()); }
    fx.add(grp, dur, (k, obj, dt, t) => {
      const cx = f.pos.x, cy = f.pos.y + 1.1, cz = f.pos.z, rr = RAD * Math.min(1, t / 0.3) * (1 + 0.12 * Math.sin(t * 4)), fin = t > dur - 0.25 ? Math.max(0.01, (dur - t) / 0.25) : 1;
      orbs.forEach((b, i) => {
        const a = t * 4.2 + i / n * 6.283, y = Math.sin(t * 5 + i * 1.3) * 0.35;
        b.o.position.set(cx + Math.cos(a) * rr, cy + y, cz + Math.sin(a) * rr); b.core.rotation.x += dt * 6; b.core.rotation.y += dt * 4; b.o.scale.setScalar(fin);
        W[i].copy(b.o.position);
        if (Math.random() < dt * 30) fx.spark(b.o.position, new V3(Math.sin(a), 0, -Math.cos(a)).multiplyScalar(2), { color: i % 2 ? c : 0xffffff, life: 0.3, size: 0.32, size1: 0.04 });
      });
    });
    ctx.every(dur - 0.1, 0.25, (j) => {
      if (j < 1) return;
      for (let i = 0; i < n; i++) ctx.hitSphere(W[i].clone(), 1.3, ctx.dmg(34), { kb: ctx.lv >= 3 ? -2 : 1.5 });
      let z = 0;
      for (const t of ctx.enemies()) { if (z > 3) break; for (let i = 0; i < n; i++) if (t.pos.distanceTo(W[i]) < 1.3 + (t.r || 0)) { fx.bolt(W[i], t.pos, { color: c, life: 0.12, jitter: 0.5, segs: 5, light: false }); fx.burst(t.pos, { n: 5, color: c, speed: 5, life: 0.25 }); z++; break; } }
      if (z) snd(ctx, 'zap', { g: 0.3 });
    });
    ctx.later(dur - 0.05, () => {
      if (ctx.lv >= 5) {   // niveau 5 : les orbes foncent exploser sur les ennemis
        const list = uniq(near(ctx, f.pos, 20));
        for (let i = 0; i < n; i++) { const from = W[i].clone(), tg = list.length ? list[i % list.length] : null; const dir = tg ? tg.pos.clone().sub(from).normalize() : from.clone().sub(f.center()).setY(0.2).normalize(); missile(ctx, { pos: from, vel: dir.multiplyScalar(26), r: 0.5, dmg: ctx.dmg(80), life: 1.2, size: 0.5, msize: 0.5, homing: 8, color: c, explode: 2.2 }); }
        snd(ctx, 'magic', { rate: 1.6 });
      } else { pop(ctx, f.center(), c, 0.8); snd(ctx, 'magic', { rate: 1.9, g: 0.5 }); }
    });
  });

  /* ---------- Comète astrale ---------- */
  Q.variant(CLS, 'bond', (ctx) => {
    const { f, fx } = ctx, c = COL.star, c2 = COL.arc, p = ctx.clampAim(14), p0 = gnd(f.pos), yaw = ctx.face(), PRE = 0.16, FLY = 0.55;
    ctx.anim('Spellcast_Raise', 2); snd(ctx, 'charge', { len: 0.5, g: 0.6 }); snd(ctx, 'magic', { rate: 0.8 });
    f.inv = Math.max(f.inv || 0, ctx.lv >= 5 ? 1.1 : 0.85);
    rune(ctx, p0, { r: 1.9, r0: 0.6, color: c2, life: 0.5, draw: 0.14, spin: 5 });
    rune(ctx, p, { r: 4.8, r0: 2, color: c, life: PRE + FLY + 0.35, draw: PRE + FLY, spin: -1.5 });
    fx.pillar(p0, { color: c2, r: 0.9, h: 8, life: 0.4, grow: 0.3 });
    const land = () => {
      moveTo(ctx, p);
      ctx.anim('2H_Melee_Attack_Chop', 2.2);
      const q = new V3(p.x, 0.6, p.z);
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; fx.bolt(q.clone().add(new V3(Math.cos(a) * 2, 14, Math.sin(a) * 2)), new V3(p.x + Math.cos(a) * 2.5, 0.1, p.z + Math.sin(a) * 2.5), { color: i % 2 ? c : c2, life: 0.22, jitter: 0.3, light: i === 0 }); }
      blast(ctx, q, c2, 1.6, { rate: 1.0, smoke: true });
      fx.burst(q, { n: 30, color: c, speed: 14, up: 1, life: 0.7, size: 0.45, grav: 14 });
      if (fx.debris) fx.debris(gnd(p), { n: 10, r: 1.5, speed: 10, size: 0.3 });
      ctx.hitstop(0.09); ctx.shake(0.6);
      ctx.hitSphere(q.clone().setY(1), 4.8, ctx.dmg(250), { launch: 8, kb: 6, posture: 3, stun: 0.35 });
      if (ctx.lv >= 3) {   // puits d'étoiles
        rune(ctx, p, { r: 4, r0: 4, color: c, life: 3, draw: 0.2, spin: 1, alpha: 0.7 });
        ctx.zone({ pos: p, life: 3, iv: 0.5, onTick: z => {
          ctx.hitSphere(z.pos.clone().setY(0.8), 4, ctx.dmg(30), { freeze: 0.6 });
          for (let k = 0; k < 6; k++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 3.8; fx.spark(z.pos.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new V3(0, rnd(2, 5), 0), { color: k % 2 ? c : c2, life: 0.7, size: 0.5, size1: 0.05 }); }
        } });
      }
      if (ctx.lv >= 5 && owns(f) && f.cds) for (const k in f.cds) f.cds[k] = Math.max(0, f.cds[k] - 1);
    };
    ctx.act({ dur: PRE + FLY, lockMove: true, float: true, face: yaw, vel: new V3(), update: (t) => {
      const mine = owns(f);
      if (t < PRE) { if (mine) { f.pos.y = (t / PRE) * 1.2; f.vel.set(0, 0, 0); } }
      else {
        const u = Math.min(1, (t - PRE) / FLY), e = u * u * (3 - 2 * u);
        if (mine) { f.pos.x = p0.x + (p.x - p0.x) * e; f.pos.z = p0.z + (p.z - p0.z) * e; f.pos.y = 1.2 * (1 - u) + Math.sin(u * Math.PI) * 4.5; f.vel.set(0, 0, 0); }
      }
      const cc = f.center();
      for (let j = 0; j < 3; j++) fx.spark(cc.clone().add(new V3(rnd(-0.3, 0.3), rnd(-0.5, 0.5), rnd(-0.3, 0.3))), new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)), { color: j ? c : c2, life: 0.45, size: 0.6, size1: 0.05 });
      if (H().afterimage && Math.random() < 0.4) H().afterimage(ctx, f, c2);
    }, onEnd: land });
    ctx.later(PRE, () => { ctx.anim('Jump_Idle', 1); snd(ctx, 'dash', { rate: 0.8 }); fx.flash(f.center(), { color: c, r: 1.2, life: 0.2 }); });
  });

  /* ---------- Égide de mana (bouclier, partagé avec les alliés proches) ---------- */
  function aegis(ctx, tgt, dur, c, sc, on) {
    const fx = ctx.fx, grp = new THREE.Group(), shM = shell(c, 2.2, 1), sp = new THREE.Mesh(G.sph, shM), rm = addMat(c, 2.2, 0.8);
    sp.scale.setScalar(1.35 * sc);
    const rings = [0, 1, 2].map(i => { const m = new THREE.Mesh(G.ring, rm); m.scale.setScalar((1.5 + i * 0.08) * sc); grp.add(m); return m; });
    grp.add(sp);
    let hf = 0;
    const it = fx.add(grp, dur, (k, o, dt, t) => {
      o.position.copy(tgt.center ? tgt.center() : tgt.pos);
      const v = on ? (on() ? 1 : 0.15) : 1, fin = Math.max(0, Math.min(1, t / 0.15, (dur - t) / 0.3));
      rings.forEach((m, i) => m.rotation.set(t * (1.3 + i * 0.7) + i, t * (0.9 + i * 0.5), i * 1.1));
      if (shM.uniforms) { shM.uniforms.uTime.value = t; shM.uniforms.uA.value = (0.8 + hf * 1.5) * v * fin; } else shM.opacity = 0.3 * v * fin;
      rm.opacity = 0.75 * v * fin; hf = Math.max(0, hf - dt * 5);
      o.scale.setScalar(Math.max(0.01, (t < 0.15 ? 0.5 + t / 0.3 : 1) + hf * 0.12));
    });
    return { it, hit() { hf = 1; } };
  }
  Q.variant(CLS, 'garde', (ctx) => {
    const { f, fx } = ctx, c = COL.arc, dur = 3, val = ctx.lv >= 3 ? 700 : 400, token = {}, S = ctx.S;
    ctx.anim('Spellcast_Raise', 1.7); ctx.act({ dur: 0.3 });
    snd(ctx, 'magic', { rate: 0.5 }); snd(ctx, 'block', { g: 0.6 });
    charge(ctx, c, 0.12);
    f.shield = (f.shield || 0) + val; f.shieldStore = 0; f._mageAegis = token;
    fx.flash(f.center(), { color: c, r: 1.8, life: 0.25, intensity: 4 });
    fx.ring(gnd(f.pos), { r0: 0.4, r1: 8, color: c, life: 0.45, width: 0.15 });
    rune(ctx, f.pos, { r: 1.7, r0: 0.6, color: c, life: dur, draw: 0.2, spin: 1.5, follow: () => gnd(f.pos) });
    const me = aegis(ctx, f, dur, c, 1, () => f.shield > 0 && f._mageAegis === token);
    // alliés proches : la moitié du bouclier (chaque client applique à SON joueur)
    const given = [];
    for (const a of ctx.allies()) {
      if (a === f || a.pos.distanceTo(f.pos) > 8) continue;
      aegis(ctx, a, dur, COL.arc2, 0.9);
      fx.bolt(f.center(), a.center(), { color: COL.arc2, life: 0.2, jitter: 0.3, light: false });
      if (a.kind !== 'remote') { const v = Math.round(val * 0.5); a.shield = (a.shield || 0) + v; given.push([a, v]); }
    }
    let last = -9;
    f.onShieldHit = () => {
      if (f._mageAegis !== token) return;
      const now = S ? S.t : 0; if (now - last < 0.25) return; last = now;
      me.hit(); snd(ctx, 'zap', { g: 0.6 });
      const t = ctx.nearest(f.pos, 18); if (!t) return;
      const a = f.center();
      fx.bolt(a, t.pos.clone(), { color: c, life: 0.2, jitter: 1, segs: 12 }); fx.bolt(a, t.pos.clone(), { color: 0xffffff, life: 0.1, jitter: 0.5, light: false });
      pop(ctx, t.pos.clone(), c, 0.8);
      ctx.hitTarget(t, ctx.dmg(120), { stun: 0.2 });
    };
    ctx.later(dur, () => {
      given.forEach(([a, v]) => { if (a.shield > 0) a.shield = Math.max(0, a.shield - v); });
      if (f._mageAegis !== token) return;
      const stored = f.shieldStore || 0;
      f._mageAegis = null; f.onShieldHit = null; f.shieldStore = 0;
      f.shield = Math.max(0, (f.shield || 0) - Math.max(0, val - stored));
      const q = f.center();
      fx.burst(q, { n: 30, color: c, speed: 8, life: 0.5, size: 0.3 });
      if (ctx.lv >= 5) {   // niveau 5 : l'égide explose (dégâts encaissés ×2)
        blast(ctx, q, c, 1.4);
        ctx.hitSphere(q, 5, stored > 0 ? stored * 2 : ctx.dmg(150), { raw: stored > 0, kb: 9, stun: 0.6 });
      }
    });
  });

  /* ---------- Chaîne d'éclairs ---------- */
  Q.variant(CLS, 'chaine', (ctx) => {
    const { f, fx } = ctx, c = COL.storm, n = ctx.lv >= 3 ? 7 : 4;
    ctx.anim('Spellcast_Shoot', 1.5); ctx.act({ dur: 0.4, face: ctx.face() });
    charge(ctx, c, 0.14); snd(ctx, 'charge', { len: 0.15, g: 0.4 });
    const zap = (a, b, i) => { fx.bolt(a, b, { color: c, life: 0.24, jitter: 1.1, segs: 14 }); fx.bolt(a, b, { color: 0xffffff, life: 0.12, jitter: 0.5, segs: 9, light: false }); fx.flash(b, { color: c, r: 0.9, life: 0.18, intensity: 4 }); fx.burst(b, { n: 16, color: c, speed: 10, life: 0.35, size: 0.3 }); snd(ctx, 'zap', { g: 0.7, rate: 1 + i * 0.1 }); };
    ctx.later(0.14, () => {
      const from0 = tipOf(f), first = ctx.lockTarget();
      fx.flash(from0, { color: c, r: 0.8, life: 0.15 });
      if (!first) { const end = ctx.aim.clone(); if (end.y < 0.5) end.y = 0.5; zap(from0, end, 0); return; }
      const seen = new Set([gk(first)]), chain = [first]; let cur = first;
      for (let i = 0; i < n; i++) {
        const nx = uniq(ctx.enemies().filter(e => !seen.has(gk(e)))).sort((a, b) => a.pos.distanceTo(cur.pos) - b.pos.distanceTo(cur.pos))[0];
        if (!nx || nx.pos.distanceTo(cur.pos) > 12) break;
        seen.add(gk(nx)); chain.push(nx); cur = nx;
      }
      let a = from0;
      chain.forEach((t, i) => {
        const b = t.pos.clone(), aa = a.clone();
        ctx.later(i * 0.075, () => {
          zap(aa, b, i);
          ctx.hitTarget(t, ctx.dmg(240) * (i ? 0.7 : 1) * (ctx.lv >= 5 ? Math.pow(1.15, i) : 1), { stun: ctx.lv >= 5 ? 0.3 : 0.1, posture: 1 });
          if (i === 0) { ctx.hitstop(0.05); ctx.shake(0.25); }
          if (ctx.lv >= 5 && i === chain.length - 1) ctx.later(0.12, () => { skyBolt(ctx, b, c, 16); fx.ring(gnd(b), { r1: 3, color: c, life: 0.3 }); snd(ctx, 'boom', { rate: 2, len: 0.4, g: 0.5 }); ctx.hitSphere(b, 2.6, ctx.dmg(140), { stun: 0.5 }); });
        });
        a = b;
      });
    });
  });

  /* ---------- Lance de givre ---------- */
  function lanceMesh(c) {
    const g = new THREE.Group();
    const m1 = new THREE.MeshStandardMaterial({ color: 0xdff8ff, emissive: C(c), emissiveIntensity: 2.2, roughness: 0.1, metalness: 0.3, flatShading: true, transparent: true, opacity: 0.95 });
    const m2 = addMat(c, 1.8, 0.35);
    const core = new THREE.Mesh(G.lance, m1), halo = new THREE.Mesh(G.lance, m2); halo.scale.set(2, 2, 1.25);
    g.add(core, halo); g.userData.mats = [m1, m2];
    return g;
  }
  Q.variant(CLS, 'lance', (ctx) => {
    const { f, fx } = ctx, c = COL.ice, n = ctx.lv >= 5 ? 3 : 1, yaw = ctx.face();
    ctx.anim('Spellcast_Long', 1.8); ctx.act({ dur: 0.45, face: yaw });
    snd(ctx, 'ice', { g: 0.6 }); snd(ctx, 'charge', { len: 0.22, g: 0.4 });
    const formAt = () => f.center().add(new V3(0, 1.0, 0)).addScaledVector(f.fwd(), 0.4);
    const form = formAt();
    for (let i = 0; i < 18; i++) { const d = new V3(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1.4, 2.4)); fx.spark(form.clone().add(d), d.clone().multiplyScalar(-1 / 0.22), { color: i % 3 ? c : 0xffffff, life: 0.22, size: 0.35, size1: 0.1 }); }
    rune(ctx, form.clone().addScaledVector(f.fwd(), -0.4), { r: 1.0, r0: 0.3, color: c, life: 0.45, draw: 0.18, vertical: true, yaw, spin: 4 });
    const prev = lanceMesh(c); prev.position.copy(form);
    fx.add(prev, 0.22, (k, o) => { o.position.copy(formAt()); const tg = ctx.aim.clone(); tg.y = Math.max(1, tg.y); o.lookAt(tg); o.scale.setScalar(0.2 + 0.8 * k); });
    ctx.later(0.22, () => {
      ctx.anim('Spellcast_Shoot', 2);
      snd(ctx, 'ice', { g: 1 }); snd(ctx, 'swingBig', { rate: 1.5, g: 0.6 });
      for (let i = 0; i < n; i++) {
        const from = formAt(), aim = ctx.aim.clone(); aim.y = Math.max(1, aim.y);
        const dir = aim.sub(from).normalize().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.22);
        const mesh = lanceMesh(c); let lastS = -1;
        fx.flash(from, { color: c, r: 0.9, life: 0.15 });
        ctx.proj({ pos: from, vel: dir.clone().multiplyScalar(46), r: 0.6, dmg: ctx.dmg(340), life: 1.1, pierce: true, mesh, freeze: 1.2, stun: 0.35, posture: 1.5, color: c, size: 0.8,
          onUpdate: (p) => {
            fx.spark(p.pos, new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)), { color: 0xd8f8ff, life: 0.3, size: 0.3, size1: 0.05 });
            if (p.t - lastS > 0.045 && p.pos.y < 4) { lastS = p.t; const s = []; for (let k = 0; k < 2; k++) { const a = Math.random() * 6.283; s.push({ x: p.pos.x + Math.cos(a) * 0.5, z: p.pos.z + Math.sin(a) * 0.5, h: rnd(0.6, 1.1), w: 0.8, rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4 }); } iceField(ctx, s, 0.8, { shatter: false }); }
          },
          onHit: (p, t) => {
            if (t) frostOn(ctx, t.pos, t.r || 1);
            fx.burst(p.pos, { n: 22, color: 0xd8f8ff, speed: 10, life: 0.45, size: 0.3, grav: 12 });
            snd(ctx, 'ice', { g: 0.5, rate: 1.3 }); ctx.hitstop(0.03);
            if (ctx.lv >= 3) { fx.flash(p.pos, { color: c, r: 1.6, life: 0.2 }); fx.ring(gnd(p.pos), { r1: 3, color: c, life: 0.3 }); ctx.hitSphere(p.pos.clone(), 2.8, ctx.dmg(110), { freeze: 0.8 }); }
          },
          onEnd: () => disposeMesh(mesh) });
      }
    });
  });

  /* ---------- Pas du néant ---------- */
  Q.variant(CLS, 'ombre', (ctx) => {
    const { f, fx } = ctx, c = COL.void, p0 = gnd(f.pos), hops = ctx.lv >= 5 ? 2 : 1, used = new Set();
    let hopped = false;
    ctx.anim('Spellcast_Shoot', 2.2); snd(ctx, 'magic', { rate: 0.5 }); snd(ctx, 'dash', { rate: 0.7 });
    f.inv = Math.max(f.inv || 0, 0.5 + hops * 0.42);
    const rift = q => {   // niveau 3 : faille qui aspire
      singularity(ctx, q, 0.45, 1.6, { n: 3 });
      ctx.every(1.6, 0.25, () => ctx.hitSphere(q, 3.2, ctx.dmg(30), { kb: -3, freeze: 0.3 }));
      ctx.later(1.6, () => { pop(ctx, q, c, 1); snd(ctx, 'boom', { rate: 2, len: 0.3, g: 0.4 }); });
    };
    const hop = k => ctx.later(0.06 + k * 0.42, () => {
      const cand = uniq(k === 0 ? [ctx.lockTarget()].filter(Boolean) : near(ctx, f.pos, 16)).filter(e => !used.has(gk(e)));
      const t = cand[0] || (k > 0 ? ctx.lockTarget() : null);
      if (!t) {   // pas de cible : simple saut d'ombre vers la visée
        if (k === 0) { const a = f.center(), dst = ctx.clampAim(6); voidPuff(ctx, a); moveTo(ctx, dst); voidPuff(ctx, new V3(dst.x, 1, dst.z)); fx.bolt(a, new V3(dst.x, 1, dst.z), { color: c, life: 0.2, jitter: 0.3, light: false }); }
        return;
      }
      used.add(gk(t)); hopped = true;
      const before = f.center(), tg = gnd(t.pos), from = gnd(f.pos);
      let away = tg.clone().sub(from); if (away.lengthSq() < 0.01) away.copy(f.fwd()); away.setY(0).normalize();
      const dst = clampArena(ctx, tg.clone().addScaledVector(away, (t.r || 1) + 1.3));
      voidPuff(ctx, before);
      moveTo(ctx, dst);
      const face = Math.atan2(tg.x - dst.x, tg.z - dst.z);
      if (owns(f)) f.yaw = face;
      ctx.act({ dur: 0.3, face }); ctx.anim('Spellcast_Shoot', 2.4);
      fx.bolt(before, new V3(dst.x, 1, dst.z), { color: c, life: 0.2, jitter: 0.3, light: false });
      voidPuff(ctx, new V3(dst.x, 1, dst.z));
      ctx.later(0.09, () => {
        const tt = fresh(ctx, t) || t, q = tt.pos.clone();
        voidBurst(ctx, q, 1);
        ctx.hitTarget(tt, ctx.dmg(380), { crit: true, posture: 2, stun: 0.45 });
        ctx.hitSphere(q, 2.6, ctx.dmg(80), { kb: 4 });
        ctx.hitstop(0.08); ctx.shake(0.35); snd(ctx, 'crit'); snd(ctx, 'boom', { rate: 1.9, len: 0.4, g: 0.6 });
        if (ctx.lv >= 3 && k === 0) rift(new V3(q.x, 1.2, q.z));
      });
    });
    for (let k = 0; k < hops; k++) hop(k);
    // repli : le mage revient à distance (vers son point de départ)
    ctx.later(0.06 + hops * 0.42 + 0.02, () => {
      if (!hopped) return;
      const cur = gnd(f.pos), d = p0.clone().sub(cur), L = d.length(); if (L < 1) return;
      d.normalize(); const dst = clampArena(ctx, cur.clone().addScaledVector(d, Math.min(7, L)));
      const a = f.center();
      voidPuff(ctx, a); moveTo(ctx, dst);
      fx.bolt(a, new V3(dst.x, 1, dst.z), { color: c, life: 0.18, jitter: 0.3, light: false });
      voidPuff(ctx, new V3(dst.x, 1, dst.z)); snd(ctx, 'dash', { rate: 1.4, g: 0.6 });
    });
  });

  /* ---------- Tornade de feu ---------- */
  Q.variant(CLS, 'tornade', (ctx) => {
    const { f, fx } = ctx, c = COL.fire, n = ctx.lv >= 5 ? 2 : 1, dur = 3.2, yaw = ctx.face();
    ctx.anim('Spellcast_Long', 1.7); ctx.act({ dur: 0.45, face: yaw });
    charge(ctx, c, 0.25); snd(ctx, 'fire', { len: 1.2 }); snd(ctx, 'charge', { len: 0.3, g: 0.4 });
    rune(ctx, f.center().addScaledVector(f.fwd(), 1.0), { r: 1.4, r0: 0.4, color: c, life: 0.7, draw: 0.2, vertical: true, yaw, spin: 6 });
    const spawn = (i) => {
      const dir = ctx.dirToAim().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.45), pos = gnd(f.pos).addScaledVector(dir, 2.5);
      const grp = new THREE.Group(); grp.position.copy(pos);
      const m1 = vortexMat(0xffd040, 0xff3a10), m2 = vortexMat(0xff8a20, 0x801008);
      const outer = new THREE.Mesh(G.funnel, m1), inner = new THREE.Mesh(G.funnel, m2); inner.scale.set(0.6, 1.05, 0.6);
      grp.add(outer, inner);
      const wind = loop(ctx, 'wind', 0.8);
      fx.flash(pos.clone().setY(1), { color: c, r: 2, life: 0.25, intensity: 5 }); snd(ctx, 'fire', { len: 2, g: 0.8 });
      fx.add(grp, dur, (k, o, dt, t) => {
        const tg = ctx.lv >= 3 ? ctx.nearest(o.position, 25) : null;
        if (tg) { const d = gnd(tg.pos).sub(o.position).setY(0); if (d.length() > 0.6) o.position.addScaledVector(d.normalize(), dt * 7); }
        else o.position.addScaledVector(dir, dt * 6);
        clampArena(ctx, o.position, 1.5);
        outer.rotation.y += dt * 9; inner.rotation.y -= dt * 13;
        const a = Math.min(1, t * 4, (dur - t) * 3);
        m1.uniforms.uA.value = a; m2.uniforms.uA.value = a; m1.uniforms.uTime.value = t; m2.uniforms.uTime.value = t * 1.3;
        const sc = Math.max(0.01, Math.min(1, t * 5)); o.scale.set(sc * (1 + 0.06 * Math.sin(t * 13)), sc, sc * (1 + 0.06 * Math.cos(t * 11)));
        for (let j = 0; j < 3; j++) { const an = t * 8 + j * 2.1 + Math.random(), r = 0.6 + Math.random() * 2, y = Math.random() * 7; fx.spark(o.position.clone().add(new V3(Math.cos(an) * r, y, Math.sin(an) * r)), new V3(-Math.sin(an) * 8, 3, Math.cos(an) * 8), { color: j ? c : 0xffd060, life: 0.4, size: 0.45, size1: 0.05 }); }
        if (Math.random() < dt * 10) fx.spark(o.position.clone().setY(7), new V3(rnd(-1, 1), 2, rnd(-1, 1)), { kind: 'smoke', color: 0x2a1a14, life: 1.2, size: 1.5, size1: 3, alpha: 0.6, grav: -0.5 });
        if (Math.random() < dt * 4) fx.ring(gnd(o.position), { r0: 0.5, r1: 3, color: c, life: 0.35, width: 0.2 });
        pos.copy(o.position);
      }, false, () => wind.stop());
      ctx.every(dur, 0.25, () => ctx.hitSphere(pos.clone().setY(1.5), 2.8, ctx.dmg(55), { kb: -3, posture: 0.5 }));
    };
    for (let i = 0; i < n; i++) ctx.later(0.25, () => spawn(i));
  });

  /* ---------- Sanctuaire runique ---------- */
  Q.variant(CLS, 'soin', (ctx) => {
    const { f, fx } = ctx, c = COL.heal, cg = COL.gold, p = gnd(f.pos), R = 5.5, life = 5, pct = ctx.lv >= 3 ? 0.45 : 0.3;
    ctx.anim('Spellcast_Raise', 1.3); ctx.act({ dur: 0.5 });
    charge(ctx, c, 0.25); snd(ctx, 'heal'); snd(ctx, 'magic', { rate: 0.6 });
    rune(ctx, p, { r: R, r0: 1.5, color: c, life: life + 0.3, draw: 0.45, spin: 0.5, star: 1 });
    rune(ctx, p, { r: R * 0.45, r0: 0.5, color: cg, life: life + 0.3, draw: 0.6, spin: -0.9, star: 1, lift: 0.09 });
    ctx.later(0.25, () => {
      fx.pillar(p, { color: c, r: R, h: 10, life: 0.9, grow: 0.08, alpha: 0.45 });
      fx.flash(p.clone().setY(1), { color: c, r: 2.5, life: 0.3, intensity: 4 });
      fx.ring(p, { r0: 0.5, r1: R, color: cg, life: 0.5, width: 0.2 });
      if (ctx.lv >= 3) {   // niveau 3 : repousse les ennemis hors du cercle
        ctx.hitSphere(p.clone().setY(1), R, ctx.dmg(60), { kb: 10, launch: 3 });
        fx.burst(p.clone().setY(0.5), { n: 40, color: c, speed: 14, flat: true, life: 0.5, size: 0.35 });
        snd(ctx, 'boom', { rate: 1.8, len: 0.4, g: 0.5 }); ctx.shake(0.3);
      }
    });
    ctx.zone({ pos: p, life, iv: 0.5, onTick: z => {
      for (const a of ctx.allies()) if (hd(a.pos, z.pos) < R + 0.4) {
        if (a.kind !== 'remote') { healAlly(ctx, a, a.maxHp * pct / 10); a.buff.sanct = 1; a.buff.sanctT = 0.6; if (ctx.lv >= 5) { a.buff.haste = 1; a.buff.hasteT = 0.6; } }
        for (let k = 0; k < 4; k++) fx.spark(a.center().add(new V3(rnd(-0.5, 0.5), rnd(-0.8, 0.4), rnd(-0.5, 0.5))), new V3(0, rnd(1.5, 3), 0), { color: k % 2 ? c : 0xffffff, life: 0.7, size: 0.4, size1: 0.05 });
      }
      if (ctx.lv >= 5 && ctx.S && ctx.S.fighters) for (const a of ctx.S.fighters.values()) if (a.team === f.team && !a.alive && hd(a.pos, z.pos) < R + 0.4) { if (a.kind === 'local') reviveAlly(ctx, a, 0.5); fx.pillar(gnd(a.pos), { color: cg, r: 1.2, h: 12, life: 0.6 }); }
      ctx.hitSphere(z.pos.clone().setY(1), R, ctx.dmg(18), { freeze: 0.7 });
      for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283, r = Math.random() * R; fx.spark(z.pos.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new V3(0, rnd(2, 5), 0), { color: k % 3 ? c : cg, life: 0.9, size: 0.45, size1: 0.05 }); }
    } });
  });

  /* ---------- Sentinelles astrales ---------- */
  Q.variant(CLS, 'fantomes', (ctx) => {
    const { f, fx } = ctx, c = COL.arc2, n = ctx.lv >= 3 ? 10 : 6, dur = 8;
    ctx.anim('Spellcast_Raise', 1.6); snd(ctx, 'magic', { rate: 0.8 }); snd(ctx, 'reveal', { rate: 1.4, g: 0.4 });
    charge(ctx, c, 0.2);
    const grp = new THREE.Group(), mC = new THREE.MeshBasicMaterial({ color: C(0xffffff).lerp(C(c), 0.4).multiplyScalar(2.4) }), mH = addMat(c, 2, 0.45);
    const cr = [];
    for (let i = 0; i < n; i++) { const g = new THREE.Group(), core = new THREE.Mesh(G.shard, mC), halo = new THREE.Mesh(G.sph, mH); core.scale.setScalar(0.34); halo.scale.setScalar(0.3); g.add(core, halo); grp.add(g); cr.push({ g, core, ready: true, t: 0 }); }
    let fireT = 0.3;
    fx.add(grp, dur, (k, obj, dt, t) => {
      const cx = f.pos.x, cy = f.pos.y + 1.7, cz = f.pos.z, app = Math.min(1, t / 0.3), fin = Math.max(0.01, Math.min(1, (dur - t) / 0.3));
      cr.forEach((b, i) => {
        const a = t * 2.2 + i / n * 6.283, rr = 1.7 * app;
        b.g.position.set(cx + Math.cos(a) * rr, cy + Math.sin(t * 3 + i) * 0.25, cz + Math.sin(a) * rr);
        b.core.rotation.y += dt * 3; b.core.rotation.z = 0.3 * Math.sin(t * 2 + i);
        b.g.visible = b.ready; b.g.scale.setScalar(fin);
        if (!b.ready) { b.t -= dt; if (b.t <= 0) { b.ready = true; fx.burst(b.g.position, { n: 6, color: c, speed: 3, life: 0.25, size: 0.2 }); } }
      });
      fireT -= dt;
      if (fireT <= 0 && f.attacking && f.attacking()) {
        const tg = ctx.nearest(f.pos, 18), b = cr.find(x => x.ready);
        if (tg && b) {
          b.ready = false; b.t = 0.9; fireT = 0.16;
          const from = b.g.position.clone(), dir = tg.pos.clone().sub(from).normalize();
          fx.flash(from, { color: c, r: 0.5, life: 0.12, light: false }); snd(ctx, 'magic', { rate: 1.8, g: 0.4 });
          missile(ctx, { pos: from, vel: dir.multiplyScalar(34), r: 0.5, dmg: ctx.dmg(85), life: 1.1, size: 0.45, msize: 0.45, shard: true, homing: 10, color: c,
            onHit: (p, t2) => {
              pop(ctx, p.pos.clone(), c, 0.6);
              if (ctx.lv >= 5 && t2) ctx.later(0.25, () => { const tt = fresh(ctx, t2); if (!tt) return; const q = tt.pos.clone(); fx.bolt(q.clone().add(new V3(rnd(-1, 1), 3, rnd(-1, 1))), q, { color: c, life: 0.15, light: false }); fx.flash(q, { color: c, r: 0.8, life: 0.15, light: false }); ctx.hitTarget(tt, ctx.dmg(60), {}); });
            } });
        }
      }
    });
  });

  /* ---------- Double astral ---------- */
  Q.variant(CLS, 'clone', (ctx, orig) => {
    const { f, fx } = ctx, c = COL.cyan, before = new Set(ctx.clones ? ctx.clones() : []);
    snd(ctx, 'reveal', { rate: 1.2, g: 0.5 }); snd(ctx, 'magic', { rate: 0.6 });
    [1, -1].slice(0, ctx.lv >= 5 ? 2 : 1).forEach(side => {
      const q = f.pos.clone().add(new V3(side * 1.6, 1.05, 0));
      rune(ctx, q, { r: 1.2, r0: 0.3, color: c, life: 0.6, draw: 0.12, vertical: true, yaw: f.yaw, spin: 3 });
      fx.burst(q, { n: 30, color: 0xe8fbff, speed: 9, life: 0.45, size: 0.28, grav: 8 });
      fx.flash(q, { color: c, r: 1.2, life: 0.2, intensity: 3 });
    });
    orig(ctx);
    // en disparaissant, chaque double explose (sauf à la fin du combat)
    const mine = (ctx.clones ? ctx.clones() : []).filter(s => !before.has(s));
    mine.forEach(s => {
      const d0 = s.dispose;
      s.dispose = function () {
        try {
          if (alive(ctx)) { const q = s.f && s.f.center ? s.f.center() : f.center(); blast(ctx, q, c, 1.1, { rate: 1.4 }); ctx.hitSphere(q, 3.6, ctx.dmg(160), { kb: 7, stun: 0.4 }); }
        } catch (e) { /* rien */ }
        return d0 ? d0.apply(this, arguments) : undefined;
      };
    });
  });

  /* ---------- Trou noir ---------- */
  Q.variant(CLS, 'gravite', (ctx) => {
    const { f, fx } = ctx, c = COL.void, p = ctx.clampAim(14).setY(1.8), g0 = gnd(p), T0 = 0.3, DUR = 4;
    ctx.anim('Spellcast_Long', 1.5); ctx.act({ dur: 0.5, face: ctx.face() }); snd(ctx, 'charge', { len: 0.6 });
    charge(ctx, c, T0);
    rune(ctx, g0, { r: 5, r0: 1.5, color: c, life: T0 + DUR + 0.2, draw: T0 + 0.1, spin: 1.8, star: 1 });
    ctx.later(T0, () => {
      fx.flash(p, { color: c, r: 2, life: 0.2, intensity: 5 }); snd(ctx, 'boom', { rate: 0.6, len: 0.5, g: 0.5 }); snd(ctx, 'magic', { rate: 0.4 });
      singularity(ctx, p, 1, DUR + 0.05, { n: 6, dust: true });
      const hum = loop(ctx, 'void', 0.7); ctx.later(DUR, () => hum.stop());
    });
    ctx.every(DUR, 0.25, (i) => ctx.later(T0, () => { ctx.hitSphere(p, 5, ctx.dmg(70), { kb: -4, freeze: 0.35 }); if (i % 4 === 0) fx.ring(g0, { r0: 5.5, r1: 0.8, color: c, life: 0.5, width: 0.15 }); }));
    ctx.later(T0 + DUR, () => {
      const k = ctx.lv >= 3 ? 2 : 1;
      blast(ctx, p, c, 1.8, { rate: 0.9, smoke: true });
      fx.pillar(g0, { color: c, r: 1.5, h: 18, life: 0.5, grow: 1.5 });
      fx.ring(g0, { r1: 9, color: 0xffffff, life: 0.5, width: 0.08 });
      ctx.hitstop(0.12); ctx.shake(0.8);
      ctx.hitSphere(p, 6.5, ctx.dmg(70) * 4 * k, { posture: 4 * k, stun: ctx.lv >= 5 ? 1.5 : 0.3, launch: 7, kb: 9 });
    });
  });

  /* ---------- Dragon de flammes ---------- */
  Q.variant(CLS, 'dragon', (ctx) => {
    const { f, fx } = ctx, c = COL.fire, yaw = ctx.face(), dir = ctx.dirToAim(), start = gnd(f.pos).addScaledVector(dir, 1.2);
    ctx.anim('Spellcast_Long', 1.4); ctx.act({ dur: 0.6, face: yaw });
    charge(ctx, c, 0.25, { size: 1.3 });
    const portal = start.clone().setY(1.6).addScaledVector(dir, 0.6);
    rune(ctx, portal, { r: 1.8, r0: 0.5, color: c, life: 1.4, draw: 0.25, vertical: true, yaw, spin: 5 });
    snd(ctx, 'fire', { len: 1.6 }); snd(ctx, 'roar', { rate: 1.6, g: 0.45 });
    const L = 30, D = 1.1, side = new V3(dir.z, 0, -dir.x), N = 12;
    const run = (back) => {
      const hit = new Set();
      const path = (tt) => { const k = Math.max(0, Math.min(1, tt / D)), kk = back ? 1 - k : k; return start.clone().addScaledVector(dir, 0.6 + kk * L).addScaledVector(side, Math.sin(tt * 9) * 1.4 * Math.min(1, k * 4)).setY(1.6 + Math.sin(tt * 7) * 0.7); };
      const body = new THREE.Group();
      const mB = new THREE.MeshStandardMaterial({ color: 0x3a0c02, emissive: C(c), emissiveIntensity: 1.8, flatShading: true, roughness: 0.6 });
      const mE = new THREE.MeshBasicMaterial({ color: C(0xfff0a0).multiplyScalar(3) }), mG = addMat(COL.ember, 1.8, 0.3);
      const head = new THREE.Group(), skull = new THREE.Mesh(G.head, mB), jaw = new THREE.Mesh(G.head, mB), glow = new THREE.Mesh(G.sph, mG);
      jaw.scale.set(0.8, 0.5, 0.85); jaw.position.set(0, -0.35, -0.1); jaw.rotation.x = 0.25;
      glow.scale.set(1.3, 1.1, 1.8);
      const horns = [-1, 1].map(s => { const h = new THREE.Mesh(G.spike, mB); h.scale.set(0.7, 1.3, 0.7); h.position.set(s * 0.35, 0.3, -0.6); h.rotation.set(-2.1, 0, s * 0.35); return h; });
      const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(G.sph, mE); e.scale.setScalar(0.11); e.position.set(s * 0.3, 0.22, 0.1); return e; });
      head.add(skull, jaw, glow, ...horns, ...eyes); body.add(head);
      const segs = [];
      for (let j = 0; j < N; j++) { const s = new THREE.Mesh(G.ico1, mB), sc = 0.78 * (1 - j / N * 0.7); s.scale.setScalar(sc); body.add(s); const fin = j % 2 === 0 ? new THREE.Mesh(G.spike, mB) : null; if (fin) { fin.scale.set(sc * 1.1, sc * 1.5, sc * 1.1); fin.position.y = sc * 0.7; s.add(fin); } segs.push(s); }
      let lastZ = -1, firstHit = true;
      fx.add(body, D + 0.25, (k, o, dt, t) => {
        const hp = path(t), ahead = path(t + 0.03);
        head.position.copy(hp); if (ahead.distanceToSquared(hp) > 1e-6) head.lookAt(ahead);
        const fade = t > D ? Math.max(0.01, 1 - (t - D) / 0.25) : 1;
        head.scale.setScalar(fade);
        segs.forEach((s, j) => { const tj = t - (j + 1) * 0.045; s.visible = tj > 0; s.position.copy(path(Math.max(0, tj))); s.scale.setScalar(0.78 * (1 - j / N * 0.7) * fade); if (s.visible && Math.random() < 0.35) fx.spark(s.position, new V3(rnd(-1, 1), rnd(0, 2), rnd(-1, 1)), { color: j % 3 ? c : 0xffd27a, life: 0.35, size: 0.7 * (1 - j / N) + 0.2, size1: 0.1 }); });
        // souffle devant la gueule
        const fw = ahead.clone().sub(hp); if (fw.lengthSq() > 1e-6) { fw.normalize(); for (let j = 0; j < 2; j++) fx.spark(hp.clone().addScaledVector(fw, 1.2), fw.clone().multiplyScalar(12).add(new V3(rnd(-2, 2), rnd(-1, 2), rnd(-2, 2))), { color: j ? c : 0xffd060, life: 0.3, size: 0.9, size1: 1.8, drag: 2 }); }
        if (t > D) return;
        if (ctx.auth) for (const t2 of ctx.enemies()) { const key = gk(t2); if (!hit.has(key) && t2.pos.distanceTo(hp) < (t2.r || 1) + 2.2) { hit.add(key); ctx.hitTarget(t2, ctx.dmg(520), { posture: 2, launch: 5, kb: 6 }); fx.flash(t2.pos, { color: c, r: 1.6, life: 0.2 }); ctx.shake(0.25); if (firstHit) { firstHit = false; ctx.hitstop(0.05); } } }
        if (ctx.lv >= 3 && t - lastZ > 0.12) {   // niveau 3 : traînée de feu
          lastZ = t; const zp = gnd(hp);
          ctx.zone({ pos: zp, life: 2, iv: 0.5, onTick: z => { ctx.hitSphere(z.pos.clone().setY(0.6), 1.5, ctx.dmg(20), {}); fx.spark(z.pos.clone().add(new V3(rnd(-0.8, 0.8), 0.1, rnd(-0.8, 0.8))), new V3(0, rnd(2, 4), 0), { color: c, life: 0.6, size: 0.8, size1: 0.1 }); } });
        }
      });
    };
    ctx.later(0.28, () => { ctx.anim('Spellcast_Shoot', 1.6); ctx.shake(0.3); fx.flash(portal, { color: c, r: 2, life: 0.25, intensity: 6 }); snd(ctx, 'fire', { len: 1.4, g: 0.9 }); run(false); });
    if (ctx.lv >= 5) ctx.later(0.28 + D + 0.1, () => { snd(ctx, 'roar', { rate: 1.8, g: 0.4 }); run(true); });   // niveau 5 : retour
  });

  /* ---------- Miroir de mana (parade) ---------- */
  Q.variant(CLS, 'contre', (ctx) => {
    const { f, fx } = ctx, c = COL.arc2, hits = ctx.lv >= 3 ? 12 : 8, W = 1.2;
    ctx.anim('Block', 1.3); snd(ctx, 'magic', { rate: 0.45 }); snd(ctx, 'block', { g: 0.4 });
    const mirPos = () => f.center().addScaledVector(f.fwd(), 0.9);
    const mir = rune(ctx, mirPos(), { r: 1.25, r0: 0.4, color: c, life: W, draw: 0.1, vertical: true, yawF: () => f.yaw, spin: 2, star: 1, follow: mirPos });
    const auraM = shell(0xffffff, 1.5, 0.6), aura = new THREE.Mesh(G.sph, auraM); aura.scale.setScalar(1.15);
    const ai = fx.add(aura, W, (k, o, dt, t) => { o.position.copy(f.center()); if (auraM.uniforms) auraM.uniforms.uTime.value = t; });
    const token = { t: W, trigger: () => {
      if (f.counter === token) f.counter = null;
      mir.end(0.05); fx.kill(ai);
      ctx.slowmo(1.0); ctx.hitstop(0.1); snd(ctx, 'parry'); snd(ctx, 'magic', { rate: 2 }); snd(ctx, 'break', { g: 0.25 });
      f.inv = Math.max(f.inv || 0, 1.2);
      const q = f.center();
      fx.flash(q, { color: 0xffffff, r: 2.2, life: 0.25, intensity: 6 });
      fx.burst(q.clone().addScaledVector(f.fwd(), 0.9), { n: 40, color: 0xf0e0ff, speed: 14, life: 0.5, size: 0.3, grav: 10 });
      fx.ring(gnd(f.pos), { r0: 0.5, r1: 5, color: c, life: 0.4, width: 0.3 });
      ctx.hitSphere(q, 4.5, ctx.dmg(110), { kb: 10, stun: 0.6, launch: 3 });
      ctx.shake(0.45);
      const list = uniq(near(ctx, f.pos, 20));
      for (let i = 0; i < hits; i++) ctx.later(0.05 + i * 0.05, () => {
        const tg = list.length ? (fresh(ctx, list[i % list.length]) || list[i % list.length]) : null, a = i / hits * 6.283;
        const from = f.center().add(new V3(Math.cos(a) * 1.2, 0.6 + Math.sin(a * 2) * 0.3, Math.sin(a) * 1.2));
        const dir = tg ? tg.pos.clone().sub(from).normalize() : new V3(Math.cos(a), 0.2, Math.sin(a)).normalize();
        missile(ctx, { pos: from, vel: dir.multiplyScalar(30), r: 0.45, dmg: ctx.dmg(110), life: 1.1, size: 0.4, msize: 0.42, shard: true, homing: 9, color: c });
        snd(ctx, 'magic', { rate: 1.5 + i * 0.05, g: 0.4 });
      });
      if (ctx.lv >= 5) f.ult = Math.min(100, (f.ult || 0) + 25);
    } };
    f.counter = token;
    ctx.later(W, () => { if (f.counter === token) f.counter = null; });
  });

  /* ---------- Nuée d'orage ---------- */
  function stormCloud(ctx, center, R, dur, rng) {
    const fx = ctx.fx, grp = new THREE.Group(); grp.position.set(center.x, 12, center.z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x15141d, emissive: C(0x4a6aff), emissiveIntensity: 0.12, roughness: 1, flatShading: true, transparent: true, opacity: 0 });
    const puffs = [];
    for (let i = 0; i < 18; i++) { const a = rng() * 6.283, r = Math.sqrt(rng()) * R * 0.85, m = new THREE.Mesh(G.ico1, mat); m.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: rng() * 1.2, s: 1.6 + rng() * 1.6, sy: 0.55 + rng() * 0.3, ph: rng() * 6 }; grp.add(m); puffs.push(m); }
    const shM = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, vertexShader: UV_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false });
    const shadow = new THREE.Mesh(G.plane, shM); shadow.scale.setScalar(R * 1.1); shadow.position.set(0, -11.93, 0); shadow.renderOrder = 2; grp.add(shadow);
    let flashT = 0.4;
    fx.add(grp, dur, (k, o, dt, t) => {
      const fin = Math.max(0, Math.min(1, t / 0.6, (dur - t) / 0.6)), grow = Math.min(1, t / 0.7);
      mat.opacity = 0.92 * fin; shM.uniforms.uA.value = 0.4 * fin;
      const sw = t * 0.35, cs = Math.cos(sw), sn = Math.sin(sw);
      puffs.forEach(m => { const u = m.userData; m.position.set((u.x * cs - u.z * sn) * (0.5 + 0.5 * grow), u.y + Math.sin(t * 1.3 + u.ph) * 0.25, (u.x * sn + u.z * cs) * (0.5 + 0.5 * grow)); const s = u.s * (0.3 + 0.7 * grow); m.scale.set(s, s * u.sy, s); m.rotation.y += dt * 0.2; });
      flashT -= dt;
      if (flashT <= 0 && t > 0.4 && t < dur - 0.4) {   // éclairs dans le nuage
        flashT = 0.15 + Math.random() * 0.35; mat.emissiveIntensity = 1.3;
        const q = o.position.clone().add(new V3(rnd(-R, R) * 0.6, 0.4, rnd(-R, R) * 0.6));
        fx.light(q, 0x9ad8ff, 4, 22, 0.12);
        fx.bolt(q, q.clone().add(new V3(rnd(-3, 3), rnd(-1, 1), rnd(-3, 3))), { color: 0x9ad8ff, life: 0.1, jitter: 0.8, segs: 6, light: false });
      }
      mat.emissiveIntensity = Math.max(0.12, mat.emissiveIntensity - dt * 8);
      if (t > 0.5 && t < dur - 0.3) for (let j = 0; j < 5; j++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R * 0.85; fx.spark(new V3(o.position.x + Math.cos(a) * r, 11, o.position.z + Math.sin(a) * r), new V3(0.6, -34, 0.2), { color: 0x8fb0d0, life: 0.32, size: 0.12, size1: 0.1, alpha: 0.6 }); }
    });
  }
  Q.variant(CLS, 'tempete', (ctx) => {
    const { f, fx } = ctx, c = COL.storm, center = ctx.clampAim(18), R = ctx.lv >= 3 ? 7.5 : 6.5, n = ctx.lv >= 3 ? 20 : 12, rng = seeded(ctx);
    const T0 = 0.7, SPAN = 3, dur = T0 + SPAN + (ctx.lv >= 5 ? 1.0 : 0.5);
    ctx.anim('Spellcast_Raise', 1.3); ctx.act({ dur: 0.55, face: ctx.face() });
    charge(ctx, c, 0.3); snd(ctx, 'charge', { len: 0.5 }); snd(ctx, 'roar', { rate: 0.5, g: 0.25 });
    ctx.later(0.3, () => { const tip = tipOf(f); fx.bolt(tip, tip.clone().add(new V3(0, 14, 0)), { color: c, life: 0.25, jitter: 0.4 }); fx.flash(tip, { color: c, r: 0.8, life: 0.2 }); snd(ctx, 'zap', { g: 0.7 }); });
    stormCloud(ctx, center, R, dur, rng);
    rune(ctx, center, { r: R, r0: 2, color: c, life: T0 + SPAN + 0.3, draw: 0.6, spin: 0.4, alpha: 0.5, star: 0 });
    const rumble = loop(ctx, 'rumble', 0.6); ctx.later(dur, () => rumble.stop());
    const strikeAt = (p) => {
      skyBolt(ctx, p, c, 12);
      fx.ring(p, { r1: 2.6, color: c, life: 0.3, width: 0.3 });
      fx.burst(p.clone().setY(0.3), { n: 16, color: c, speed: 9, up: 0.8, life: 0.4 });
      fx.burst(p.clone().setY(0.2), { n: 6, color: 0x2a2a30, kind: 'smoke', speed: 3, up: 0.5, life: 0.7, size: 0.8, size1: 1.6, alpha: 0.6 });
      snd(ctx, 'zap', { g: 0.7 }); snd(ctx, 'boom', { rate: 2.2, len: 0.3, g: 0.35 });
      ctx.shake(0.12);
      ctx.hitSphere(p.clone().setY(1), 2.4, ctx.dmg(120), { stun: 0.25, posture: 1 });
    };
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.283, r = Math.sqrt(rng()) * R * 0.9;
      ctx.later(T0 + i * (SPAN / n), () => {
        const list = near(ctx, center, R);
        let p = new V3(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r);
        if (list.length && i % 4 !== 3) p = gnd(list[i % list.length].pos);
        strikeAt(p);
      });
    }
    if (ctx.lv >= 5) ctx.later(T0 + SPAN + 0.3, () => {   // niveau 5 : éclair géant
      for (let j = 0; j < 5; j++) fx.bolt(center.clone().add(new V3(rnd(-2, 2), 30, rnd(-2, 2))), center.clone().setY(0.2), { color: j % 2 ? c : 0xffffff, life: 0.45, jitter: 1.5, segs: 18, light: j === 0 });
      blast(ctx, center.clone().setY(0.6), c, 2.2, { rate: 0.8, smoke: true });
      fx.pillar(center, { color: c, r: 2, h: 30, life: 0.6, grow: 1.2 });
      ctx.hitstop(0.1); ctx.shake(0.9); snd(ctx, 'zap', { g: 1, rate: 0.7 });
      ctx.hitSphere(center.clone().setY(1), R, ctx.dmg(120) * 4, { stun: 1, posture: 4, launch: 6 });
    });
  });

  /* =====================================================================
     ULTIMES
     ===================================================================== */

  /* ---------- Colonne céleste ---------- */
  Q.variant(CLS, 'u_lame', (ctx) => {
    const { f, fx } = ctx, c = COL.gold, center = ctx.clampAim(22);
    ctx.anim('Spellcast_Raise', 1.1); ctx.act({ dur: 0.9, face: ctx.face() });
    charge(ctx, c, 0.5, { size: 1.5, n: 4 }); snd(ctx, 'charge', { len: 0.9 });
    ctx.later(0.4, () => { const tip = tipOf(f); fx.bolt(tip, tip.clone().add(new V3(0, 30, 0)), { color: c, life: 0.3, jitter: 0.2 }); fx.flash(tip, { color: c, r: 1, life: 0.25, intensity: 5 }); });
    const column = (p, k, delay) => ctx.later(delay, () => {
      rune(ctx, new V3(p.x, 34, p.z), { r: 7 * k, r0: 2, color: c, life: 1.6, draw: 0.45, spin: 1.5, lift: 0 });
      rune(ctx, p, { r: 7 * k, r0: 3, color: c, life: 1.7, draw: 0.7, spin: -1 });
      fx.decal(p, 'circle', { r: 7 * k, color: 0xfff0a0, dur: 0.8, hold: 0.1, world: false });
      const top = new V3(p.x, 34, p.z), bot = gnd(p), guide = fx.beam({ color: c, width: 0.2 });
      fx.add(new THREE.Object3D(), 0.8, (kk) => guide.set(top, bot, 0.15 + 0.3 * kk, 0.5 + 0.5 * kk), false, () => guide.kill());
      snd(ctx, 'charge', { len: 0.8, g: 0.6 });
      ctx.later(0.8, () => {
        const B = fx.beam({ color: c, width: 7 * k }), t2 = new V3(p.x, 40, p.z);
        fx.add(new THREE.Object3D(), 0.9, (kk) => B.set(t2, bot, 7 * k * (1 - kk * 0.85) * (1 + Math.sin(kk * 60) * 0.05), 1 - kk * kk), false, () => B.kill());
        fx.pillar(bot, { color: 0xffffff, r: 3 * k, h: 40, life: 0.5, grow: 1.5 });
        if (H().impact) H().impact(ctx, bot.clone().setY(1), c, 3 * k, { pillar: true }); else blast(ctx, bot.clone().setY(1), c, 3 * k);
        fx.ring(bot, { r1: 15 * k, color: 0xffffff, life: 0.8, width: 0.08 }); fx.ring(bot, { r1: 10 * k, color: c, life: 0.6, width: 0.3 });
        if (fx.debris) fx.debris(bot, { n: Math.round(18 * k), r: 2.5 * k, speed: 14, size: 0.45 * k, up: 1.2 });
        if (k >= 1) { ctx.slowmo(0.5); flashScreen(ctx, 0.5, 0.45, 0.25); }
        ctx.hitstop(0.18 * k); ctx.shake(1.0 * k);
        ctx.hitSphere(bot.clone().setY(1), 7 * k, ctx.dmg(1800) * (k < 1 ? 0.3 : 1), { launch: 12, posture: 6, kb: 8, stun: ctx.lv >= 3 ? 2 : 0.3 });
      });
    });
    column(center, 1, 0.3);
    if (ctx.lv >= 5) { const d = ctx.dirToAim(), sd = new V3(d.z, 0, -d.x); column(clampArena(ctx, center.clone().addScaledVector(sd, 6)), 0.7, 0.65); column(clampArena(ctx, center.clone().addScaledVector(sd, -6)), 0.7, 0.85); }
  });

  /* ---------- Stase temporelle ---------- */
  Q.variant(CLS, 'u_temps', (ctx) => {
    const { f, fx } = ctx, c = COL.time, dur = ctx.lv >= 3 ? 5 : 4;
    ctx.anim('Spellcast_Raise', 1.5); snd(ctx, 'magic', { rate: 0.4 });
    fx.flash(f.center(), { color: 0xffffff, r: 3, life: 0.4, intensity: 6 });
    fx.ring(gnd(f.pos), { r0: 1, r1: 30, color: c, life: 0.8, width: 0.05 });
    rune(ctx, f.pos, { r: 26, r0: 1, color: c, life: dur + 0.5, draw: 0.5, grow: 0.6, spin: -0.15, star: 1, alpha: 0.7, follow: () => gnd(f.pos) });
    rune(ctx, f.pos, { r: 5, r0: 1, color: COL.gold, life: dur + 0.5, draw: 0.8, spin: 0.6, star: 1, alpha: 0.8, lift: 0.1, follow: () => gnd(f.pos) });
    // aiguilles du cadran
    const hm = addMat(c, 2.2, 0.7), grp = new THREE.Group();
    const hand = (len, w) => { const pv = new THREE.Group(), m = new THREE.Mesh(G.plane, hm); m.scale.set(w / 2, 1, len / 2); m.position.z = len / 2; pv.add(m); grp.add(pv); return pv; };
    const hH = hand(15, 0.5), hM = hand(23, 0.3);
    fx.add(grp, dur + 0.5, (k, o, dt, t) => {
      o.position.set(f.pos.x, 0.11, f.pos.z);
      const s = Math.min(1, t / 0.6); o.scale.setScalar(Math.max(0.01, s));
      hH.rotation.y = -t * 0.4; hM.rotation.y = -t * 2.2;
      hm.opacity = 0.7 * Math.min(1, (dur + 0.5 - t) * 2);
      if (Math.random() < dt * 25) { const a = Math.random() * 6.283, r = rnd(0.6, 2.2); fx.spark(f.pos.clone().add(new V3(Math.cos(a) * r, rnd(0, 0.5), Math.sin(a) * r)), new V3(0, rnd(0.6, 1.6), 0), { color: COL.gold, life: 1.2, size: 0.25, size1: 0.05 }); }
    });
    ctx.timeStop(dur);
  });

  /* ---------- Désintégration (rayon) ---------- */
  Q.variant(CLS, 'u_rayon', (ctx) => {
    const { f, fx } = ctx, c = COL.arc, dur = ctx.lv >= 3 ? 4.5 : 3.5, w = ctx.lv >= 3 ? 2.0 : 1.4, CH = 0.6;
    ctx.anim('Spellcast_Long', 1.0); snd(ctx, 'charge', { len: 0.7 });
    const beam = fx.beam({ color: c, width: 0.1 }), hum = loop(ctx, 'beam', 0.2);
    const st = { from: new V3(), dir: new V3(0, 0, 1), end: new V3() };
    const orient = () => {
      const aim = (f.ctl && f.ctl.aim) ? f.ctl.aim : ctx.aim;
      st.from.copy(f.center()).add(new V3(0, 0.35, 0)).addScaledVector(f.fwd(), 0.8);
      st.dir.copy(aim).sub(st.from); if (st.dir.lengthSq() < 1e-4) st.dir.copy(f.fwd()); st.dir.normalize();
    };
    orient();
    const circles = [0.7, 1.6, 2.6].map((dd, i) => rune(ctx, st.from, { r: 0.8 + i * 0.45, r0: 0.2, color: i === 1 ? COL.arc2 : c, life: dur + CH + 0.4, draw: 0.2 + i * 0.12, spin: (i % 2 ? -1 : 1) * (4 + i * 2), star: 1, lift: 0, follow: () => st.from.clone().addScaledVector(st.dir, dd), dir: () => st.dir }));
    let tick = 0, ended = false;
    const finish = () => { if (ended) return; ended = true; beam.kill(); hum.stop(); circles.forEach(h => h.end(0.2)); };
    const A = ctx.act({ dur: dur + CH, lockMove: true, vel: new V3(), update: (t, dt) => {
      const aim = (f.ctl && f.ctl.aim) ? f.ctl.aim : ctx.aim;
      if (BR.angDiff) f.yaw += BR.angDiff(f.yaw, Math.atan2(aim.x - f.pos.x, aim.z - f.pos.z)) * Math.min(1, dt * 8);
      if (t > 0.5 && f.av && f.av.oneShot == null) ctx.anim('Spellcasting', 1, { fade: 0.1 });
      orient();
      let Lb = 60; if (st.dir.y < -0.01) Lb = Math.min(Lb, -st.from.y / st.dir.y);
      st.end.copy(st.from).addScaledVector(st.dir, Lb);
      const k = t < CH ? t / CH : 1, ww = t < CH ? 0.15 + k * 0.3 : w * (1 + Math.sin(t * 40) * 0.05);
      beam.set(st.from, t < CH ? st.from.clone().addScaledVector(st.dir, 2.6 * k) : st.end, ww, 1);
      hum.set(t < CH ? 0.2 + k * 0.4 : 1);
      for (let j = 0; j < 3; j++) fx.spark(st.from, new V3(rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)), { color: j ? c : 0xffffff, life: 0.25, size: 0.5 });
      if (t >= CH) {
        ctx.shake(0.06);
        fx.spark(st.end, new V3(rnd(-8, 8), rnd(2, 10), rnd(-8, 8)), { color: c, life: 0.5, size: 0.6, grav: 12 });
        if (Math.random() < dt * 20) fx.flash(st.end, { color: c, r: 1.5 * w, life: 0.12, intensity: 4, light: false });
        if (Math.random() < dt * 6) fx.ring(gnd(st.end), { r0: 0.5, r1: 2.5 * w, color: c, life: 0.3, width: 0.25 });
        tick -= dt;
        if (tick <= 0) { tick = 0.12; ctx.hitLine(st.from, st.end, w * 0.6, ctx.dmg(220) * 0.28 * (1 + (t - CH) * 0.3), { posture: 0.6 }); }
      }
    }, onEnd: () => {
      finish();
      if (ctx.lv >= 5) { blast(ctx, st.end.clone(), c, 2.5, { smoke: true }); fx.pillar(gnd(st.end), { color: c, r: 2, h: 20, life: 0.5, grow: 1.4 }); ctx.hitstop(0.1); ctx.hitSphere(st.end, 8, ctx.dmg(220) * 6, { launch: 10, posture: 6 }); }
    } });
    // garde-fou : si le sort est interrompu (étourdi…), le rayon s'éteint quand même
    fx.add(new THREE.Object3D(), dur + CH + 0.3, () => { if (!ended && f.action !== A) finish(); }, false, finish);
    ctx.later(CH, () => { snd(ctx, 'boom', { rate: 1.6, g: 0.8 }); ctx.shake(0.5); fx.flash(f.center(), { color: c, r: 2, life: 0.3 }); flashScreen(ctx, 0.25, 0.12, 0.35); });
  });

  /* ---------- Mille éclats ---------- */
  Q.variant(CLS, 'u_lames', (ctx) => {
    const { f, fx } = ctx, c = COL.arc, c2 = COL.cyan, n = ctx.lv >= 3 ? 20 : 14, t0 = ctx.lockTarget(), rng = seeded(ctx);
    const tp = t0 ? t0.pos.clone() : ctx.clampAim(20).setY(1.2), FIRE0 = 0.75, IV = 0.06;
    ctx.anim('Spellcast_Raise', 1.1); ctx.act({ dur: 0.9, face: ctx.face() });
    charge(ctx, c, 0.4, { size: 1.4 }); snd(ctx, 'charge', { len: 0.8 });
    ctx.slowmo(1.2 + n * IV);
    f.inv = Math.max(f.inv || 0, 0.8);
    rune(ctx, gnd(tp), { r: 9.5, r0: 4, color: c, life: FIRE0 + n * IV + 1.0, draw: 0.6, spin: 0.8 });
    const grp = new THREE.Group(), mC = new THREE.MeshBasicMaterial({ color: C(0xffffff).lerp(C(c), 0.3).multiplyScalar(2.4) }), mH = addMat(c, 2, 0.4);
    const cr = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 * 2 + rng(), r = 8 + rng() * 2, y = 2.5 + (i % 4) * 1.5 + rng();
      const pos = gnd(tp).add(new V3(Math.cos(a) * r, y, Math.sin(a) * r));
      const g = new THREE.Group(), core = new THREE.Mesh(G.shardZ, mC), halo = new THREE.Mesh(G.shardZ, mH);
      core.scale.setScalar(0.6); halo.scale.setScalar(1.0); g.add(core, halo); g.position.copy(pos); g.lookAt(tp); g.scale.setScalar(0.001);
      grp.add(g); cr.push({ g, pos, born: 0.1 + i * 0.03, fired: false, shown: false });
    }
    fx.add(grp, FIRE0 + n * IV + 0.2, (k, o, dt, t) => {
      cr.forEach((b, i) => {
        if (b.fired) { b.g.visible = false; return; }
        const e = Math.max(0, Math.min(1, (t - b.born) / 0.12));
        b.g.scale.setScalar(Math.max(0.001, e)); b.g.position.copy(b.pos).add(new V3(0, Math.sin(t * 3 + i) * 0.15, 0));
        if (t > b.born && !b.shown) { b.shown = true; fx.flash(b.pos, { color: c, r: 0.6, life: 0.15, light: false }); if (i % 3 === 0) snd(ctx, 'magic', { rate: 1.8 + (i % 5) * 0.1, g: 0.3 }); }
      });
    });
    for (let i = 0; i < n; i++) ctx.later(FIRE0 + i * IV, () => {
      const b = cr[i]; b.fired = true;
      const tt = fresh(ctx, t0), aimP = tt ? tt.pos.clone() : tp, dir = aimP.sub(b.pos).normalize();
      missile(ctx, { pos: b.pos.clone(), vel: dir.multiplyScalar(40), r: 0.6, dmg: ctx.dmg(120), life: 1.0, size: 0.6, msize: 0.6, shard: true, homing: 12, color: i % 3 ? c : c2 });
      snd(ctx, 'magic', { rate: 1.4 + (i % 5) * 0.1, g: 0.35 }); if (i % 3 === 0) snd(ctx, 'swing', { rate: 2, g: 0.4 });
    });
    // prison de cristal puis explosion finale
    const TF = FIRE0 + n * IV + 0.25;
    ctx.later(TF, () => {
      const tt = fresh(ctx, t0), q = tt ? tt.pos.clone() : tp.clone(), g0 = gnd(q), s = [], R0 = Math.max(1.2, ((tt && tt.r) || 1) + 0.6);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; s.push({ x: g0.x + Math.cos(a) * R0, z: g0.z + Math.sin(a) * R0, h: 3.2, w: 1.6, rx: -Math.sin(a) * 0.35, rz: Math.cos(a) * 0.35, d: i * 0.02 }); }
      iceField(ctx, s, 0.5, { color: 0xf0e0ff, emissive: c, glow: 1.6, shardCol: COL.arc2 });
      snd(ctx, 'ice', { rate: 0.7, g: 0.8 }); snd(ctx, 'charge', { len: 0.35, g: 0.6 });
    });
    ctx.later(TF + 0.42, () => {
      const tt = fresh(ctx, t0), q = tt ? tt.pos.clone() : tp.clone();
      blast(ctx, q, c, 2.4, { smoke: true, rate: 0.9 });
      fx.pillar(gnd(q), { color: c, r: 2, h: 24, life: 0.6, grow: 1.3 });
      ctx.hitstop(0.2); ctx.shake(1.1); ctx.slowmo(0.4); flashScreen(ctx, 0.35, 0.18, 0.45);
      if (tt) ctx.hitTarget(tt, ctx.dmg(120) * (ctx.lv >= 5 ? 6 : 3), { crit: true, posture: 8, stun: 1 });
      ctx.hitSphere(q, 5, ctx.dmg(150), { kb: 8, launch: 4 });
    });
  });

  /* ---------- Domaine arcanique ---------- */
  Q.variant(CLS, 'u_domaine', (ctx) => {
    const { f, fx } = ctx, S = ctx.S, c = COL.arc, p = gnd(f.pos), R = 14, dur = 9, mul = ctx.lv >= 5 ? 1.7 : 1.4;
    ctx.anim('Spellcast_Raise', 1.2); snd(ctx, 'magic', { rate: 0.4 }); snd(ctx, 'reveal', { rate: 0.8, g: 0.5 });
    charge(ctx, c, 0.4, { size: 1.4 });
    const domeM = shell(c, 3, 0.9), dome = new THREE.Mesh(G.dome, domeM); dome.position.copy(p);
    fx.add(dome, dur, (k, o, dt, t) => {
      o.scale.setScalar(Math.max(0.01, R * (1 - Math.pow(1 - Math.min(1, t * 2), 3))));
      if (domeM.uniforms) { domeM.uniforms.uTime.value = t; domeM.uniforms.uA.value = Math.min(1, (dur - t) * 1.5) * 0.9; }
      if (S) S.domainVis = Math.min(1, t * 2, dur - t) * (f.kind === 'local' || (S.me && hd(S.me.pos, p) < R) ? 1 : 0);
    }, false, () => { if (S) S.domainVis = 0; });
    rune(ctx, p, { r: R, r0: 2, color: c, life: dur, draw: 0.7, grow: 0.5, spin: 0.15, star: 1, alpha: 0.8, fade: 0.6 });
    rune(ctx, p, { r: 5, r0: 1, color: COL.gold, life: dur, draw: 0.9, spin: -0.4, lift: 0.1, fade: 0.6 });
    // obélisques de cristal en orbite lente
    const grp = new THREE.Group(), mC = new THREE.MeshBasicMaterial({ color: C(c).lerp(C(0xffffff), 0.3).multiplyScalar(2) }), mH = addMat(c, 1.8, 0.35), obs = [];
    for (let i = 0; i < 8; i++) { const g = new THREE.Group(), core = new THREE.Mesh(G.shard, mC), halo = new THREE.Mesh(G.shard, mH); core.scale.set(0.8, 1.8, 0.8); halo.scale.set(1.4, 2.4, 1.4); g.add(core, halo); grp.add(g); obs.push(g); }
    fx.add(grp, dur, (k, o, dt, t) => {
      const app = Math.min(1, t / 0.8), fin = Math.max(0.01, Math.min(1, (dur - t) / 0.6));
      obs.forEach((g, i) => { const a = t * 0.25 + i / 8 * 6.283; g.position.set(p.x + Math.cos(a) * (R - 1.5), 2.2 + Math.sin(t * 1.5 + i) * 0.4, p.z + Math.sin(a) * (R - 1.5)); g.rotation.y += dt; g.scale.setScalar(Math.max(0.01, app * fin)); if (Math.random() < dt * 6) fx.spark(g.position, new V3(0, -2, 0), { color: c, life: 0.6, size: 0.4, size1: 0.05 }); });
    });
    fx.pillar(p, { color: c, r: 3, h: 20, life: 0.8, grow: 3, alpha: 0.7 });
    ctx.shake(0.5);
    ctx.zone({ pos: p, life: dur, iv: 0.25, onTick: z => {
      if (S && S.fighters) for (const a of S.fighters.values()) {
        const inside = hd(a.pos, z.pos) < R;
        if (a.team === f.team && inside) { a.buff.domain = 1; a.buff.domainT = 0.4; a.buff.domainMul = mul; if (ctx.lv >= 5) { a.buff.domain2 = 1; a.buff.domain2T = 0.4; } }
        if (a.team !== f.team && inside) a.slow = Math.max(a.slow || 0, 0.4);
      }
      if (S && S.boss && S.boss.focus) S.boss.domainSlow = gnd(S.boss.focus()).distanceTo(z.pos) < R + 2 ? 0.4 : 0;
      if (Math.round(z.t * 4) % 4 === 0) {   // pulsation chaque seconde : ralentit (et frappe fort au niveau 3)
        ctx.hitSphere(z.pos.clone().setY(2), R, ctx.dmg(ctx.lv >= 3 ? 120 : 30), { freeze: 0.8 });
        fx.ring(z.pos, { r0: 1, r1: R, color: c, life: 0.6, width: 0.08 });
      }
      for (let k = 0; k < 10; k++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R; fx.spark(z.pos.clone().add(new V3(Math.cos(a) * r, 0.1, Math.sin(a) * r)), new V3(0, rnd(1, 4), 0), { color: k % 3 ? c : COL.gold, life: 1, size: 0.35, size1: 0.05 }); }
    }, onEnd: () => { if (S && S.boss) S.boss.domainSlow = 0; } });
  });

  /* ---------- Cercle des spectres ---------- */
  Q.variant(CLS, 'u_legion', (ctx) => {
    const { f, fx } = ctx, c = COL.arc, n = ctx.lv >= 3 ? 7 : 5, LIFE = 12;
    ctx.anim('Spellcast_Raise', 1.2); snd(ctx, 'roar', { rate: 1.6, g: 0.35 }); snd(ctx, 'reveal', { rate: 0.7, g: 0.5 });
    charge(ctx, c, 0.3);
    rune(ctx, f.pos, { r: 4.2, r0: 1, color: c, life: 1.6, draw: 0.4, spin: 1.5 });
    for (let i = 0; i < n; i++) ctx.later(0.25 + i * 0.12, () => {
      const a0 = i / n * 6.283, p = gnd(f.pos).add(new V3(Math.cos(a0) * 3.2, 0, Math.sin(a0) * 3.2));
      let sk = null;
      try { sk = ctx.fighter({ id: 'mspec' + i, look: { skin: i % 2 ? 'reaper' : 'sk_mage' }, kind: 'summon', weapon: 'staff', ghost: '#c070ff' }); } catch (e) { sk = null; }
      if (!sk) return;
      sk.owner = f; sk.team = f.team; sk.summonMul = 1; sk.pos.copy(p).setY(-2); sk.yaw = f.yaw;
      rune(ctx, p, { r: 1.4, r0: 0.4, color: c, life: 1.2, draw: 0.2, spin: 4 });
      fx.pillar(p, { color: c, r: 0.9, h: 7, life: 0.6 }); fx.burst(p.clone().setY(0.5), { n: 24, color: c, speed: 6, up: 1, life: 0.6 });
      snd(ctx, 'magic', { rate: 0.7 + i * 0.08, g: 0.5 });
      try { sk.play('Lie_StandUp', 1.6); } catch (e) { /* animation absente */ }
      let life = LIFE, atk = 0.6 + i * 0.13, rise = 0.5, age = 0;
      const api = BR.Arena && BR.Arena.api ? BR.Arena.api(sk, ctx.auth, ctx.lv, ctx.aim, 'u_legion') : null;
      if (!api) { sk.dispose(); return; }
      ctx.summon({ team: f.team, f: sk,
        update(dt) {
          life -= dt; age += dt; if (life <= 0) return false;
          if (rise > 0) { rise -= dt; sk.pos.y = Math.min(0, sk.pos.y + dt * 5); sk.update(dt, { speed: 0 }); return true; }
          // escorte : tourne lentement autour du mage en lévitant
          const ang = a0 + age * 0.35, want = new V3(f.pos.x + Math.cos(ang) * 3.4, 0, f.pos.z + Math.sin(ang) * 3.4), d = want.sub(sk.pos).setY(0), dist = d.length();
          if (dist > 0.3) sk.pos.addScaledVector(d.normalize(), Math.min(dist, Math.min(9, dist * 4) * dt));
          sk.pos.y = 0.35 + Math.sin(age * 2 + i) * 0.12;
          const t = api.nearest(sk.pos, 24);
          sk.yaw = t ? Math.atan2(t.pos.x - sk.pos.x, t.pos.z - sk.pos.z) : f.yaw;
          if (Math.random() < dt * 8) fx.spark(sk.center().add(new V3(rnd(-0.4, 0.4), rnd(-0.6, 0.8), rnd(-0.4, 0.4))), new V3(0, rnd(1, 3), 0), { color: c, life: 0.5, size: 0.4, size1: 0.05 });
          atk -= dt;
          if (atk <= 0 && t) {
            atk = 1.0; sk.play('Spellcast_Shoot', 1.8);
            ctx.later(0.15, () => {
              if (life <= 0) return;
              const from = tipOf(sk), tt = api.nearest(sk.pos, 26); if (!tt) return;
              const dir = tt.pos.clone().sub(from).normalize();
              fx.flash(from, { color: c, r: 0.5, life: 0.12, light: false });
              missile(ctx, { pos: from, vel: dir.multiplyScalar(30), r: 0.45, dmg: ctx.dmg(60), life: 1.3, size: 0.45, msize: 0.45, homing: 7, color: c }, api);
              snd(ctx, 'magic', { rate: 1.6 + i * 0.05, g: 0.25 });
            });
          }
          sk.update(dt, { speed: 0 });
          return true;
        },
        dispose() {
          try {
            fx.burst(sk.center(), { n: 30, color: c, speed: 6, life: 0.6 });
            if (ctx.lv >= 5 && alive(ctx)) { blast(ctx, sk.center(), c, 1.0); api.hitSphere(sk.center(), 3.5, ctx.dmg(250), { kb: 6 }); }
          } catch (e) { /* fin de combat */ }
          sk.dispose();
        } });
    });
  });

  /* =====================================================================
     NOMS, DESCRIPTIONS ET ÉVEILS (niveaux 3 et 5) DU MAGE
     ===================================================================== */
  const TXT = {
    traits: ['Missiles arcaniques', '3 missiles à tête chercheuse qui explosent à l\'impact.', ['5 missiles.', 'Chaque missile se divise en 2 éclats qui filent vers d\'autres ennemis.']],
    onde: ['Nova de givre', 'Le bâton frappe le sol : une couronne de pics de glace repousse, étourdit et ralentit tout autour de toi.', ['Rayon +40 %.', 'Les pics éclatent une seconde fois.']],
    fente: ['Transfert', 'Téléportation de 11 m : implosion au départ, explosion arcanique qui repousse à l\'arrivée.', ['Laisse une rune piégée qui explose au départ.', 'L\'arrivée libère 5 éclats chercheurs.']],
    pluie: ['Averse d\'étoiles', 'Un cercle s\'ouvre dans le ciel : des éclats d\'étoile pilonnent la zone et ralentissent les ennemis.', ['24 éclats sur une zone plus grande.', 'Une étoile géante s\'écrase au centre et étourdit.']],
    u_meteore: ['Météore arcanique', 'Un portail s\'ouvre dans le ciel : un météore géant s\'écrase sur la zone et laisse un cratère brûlant.', ['Cratère plus grand, brûle plus fort.', '6 petits météores en plus.']],
    tourbillon: ['Orbes gardiens', '6 orbes tournent autour de toi pendant 3 s et frappent tout ce qui approche.', ['8 orbes qui attirent les ennemis.', 'À la fin, les orbes foncent exploser sur les ennemis.']],
    bond: ['Comète astrale', 'Tu t\'envoles en comète vers la zone visée et t\'écrases dans une gerbe d\'étoiles.', ['Laisse un puits d\'étoiles qui ralentit 3 s.', 'Invulnérable pendant le vol, recharges -1 s.']],
    garde: ['Égide de mana', 'Bouclier de 400 pour toi et de moitié pour les alliés proches ; chaque coup encaissé riposte d\'un éclair.', ['Bouclier de 700.', 'À la fin, l\'égide explose (dégâts encaissés ×2).']],
    chaine: ['Chaîne d\'éclairs', 'Un éclair jaillit du bâton et rebondit sur 4 ennemis.', ['7 rebonds.', 'Paralyse, +15 % par rebond, et la foudre tombe sur la dernière cible.']],
    lance: ['Lance de givre', 'Une lance de glace perforante qui gèle tout sur sa trajectoire.', ['Éclate en givre à chaque impact.', 'Trois lances en éventail.']],
    ombre: ['Pas du néant', 'Te téléporte derrière la cible, la fait exploser (critique garanti) puis te replie à distance.', ['Laisse une faille qui aspire les ennemis.', 'Frappe deux cibles avant le repli.']],
    tornade: ['Tornade de feu', 'Une tornade de flammes avance, aspire et brûle tout sur son passage.', ['La tornade traque ta cible.', 'Deux tornades.']],
    soin: ['Sanctuaire runique', 'Cercle de 5 s : soigne les alliés dedans de 30 %, réduit leurs dégâts subis et ralentit les ennemis.', ['Soigne 45 % et repousse les ennemis à l\'ouverture.', 'Relève les alliés à terre et les accélère.']],
    fantomes: ['Sentinelles astrales', '6 cristaux gravitent autour de toi 8 s et partent seuls sur la cible à chacun de tes coups.', ['10 cristaux.', 'Chaque cristal frappe deux fois.']],
    clone: ['Double astral', 'Un reflet de toi copie tes attaques et tes sorts pendant 7 s, puis explose en disparaissant.', ['Le double fait 90 % des dégâts.', 'Deux doubles.']],
    gravite: ['Trou noir', 'Ouvre un trou noir 4 s qui aspire, ralentit et broie les ennemis, puis implose.', ['Implosion ×2 et gros dégâts de posture.', 'L\'implosion immobilise 1,5 s.']],
    dragon: ['Dragon de flammes', 'Un dragon de feu jaillit d\'un cercle runique et traverse tout en ligne droite.', ['Laisse une traînée de feu.', 'Le dragon revient sur ses pas.']],
    contre: ['Miroir de mana', 'Miroir runique 1,2 s : si tu es frappé, il éclate, repousse tout et renvoie 8 lances arcaniques.', ['12 lances.', 'La riposte remplit 25 % de ton ultime.']],
    tempete: ['Nuée d\'orage', 'Un nuage d\'orage noir se forme au-dessus de la zone et la foudroie pendant 3 s.', ['20 éclairs sur une zone plus grande.', 'Un éclair géant final étourdit tout.']],
    u_lame: ['Colonne céleste', 'Un cercle s\'ouvre dans le ciel et une colonne de lumière écrase la zone visée.', ['Étourdit 2 s.', 'Trois colonnes.']],
    u_temps: ['Stase temporelle', 'Fige le temps 4 s : les dégâts que tu infliges sont libérés d\'un coup à la fin (+30 %).', ['Dure 5 s.', 'Libération +80 % et recharges remises à zéro.']],
    u_rayon: ['Désintégration', 'Trois cercles runiques concentrent un rayon arcanique que tu diriges à la souris.', ['Rayon plus large, 4,5 s.', 'Se termine par une explosion massive.']],
    u_lames: ['Mille éclats', 'Une couronne de cristaux encercle ta cible, la crible, puis l\'emprisonne et explose.', ['20 cristaux.', 'Explosion finale ×2.']],
    u_domaine: ['Domaine arcanique', 'Dôme runique de 14 m pendant 9 s : ennemis ralentis, alliés +40 % de dégâts et recharges 2× plus rapides.', ['Le dôme frappe fort chaque seconde.', '+70 % de dégâts et énergie illimitée.']],
    u_legion: ['Cercle des spectres', '5 mages spectraux t\'escortent 12 s et bombardent les ennemis.', ['7 mages spectraux.', 'Ils explosent en disparaissant.']],
  };
  Q.CLASS_AW = Q.CLASS_AW || {}; Q.CLASS_AW[CLS] = Q.CLASS_AW[CLS] || {};
  Object.keys(TXT).forEach(id => { Q.setName(CLS, id, TXT[id][0], TXT[id][1]); Q.CLASS_AW[CLS][id] = TXT[id][2]; });
})();

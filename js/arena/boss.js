/* ===== arena/boss.js : boss géants (corps modélisés dans Blender, visages = images de monstres) =====
   L'hôte choisit les attaques et diffuse { n, s, tg, tx, tz, x, z, yw } ; chaque client rejoue le même script
   (marquages au sol, effets) et teste uniquement son propre joueur. Positions et PV : état diffusé par l'hôte. */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, AR = BR.ARENA;
  const AB = (BR.ABoss = {});
  const rnd = (r, a, b) => a + r() * (b - a);
  const sm = (a, b, k) => a + (b - a) * k;
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);

  /* ---------------- visage : image de monstre + effets d'horreur (yeux incandescents) ---------------- */
  const FACE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  // visage du boss : l'image telle quelle (sans effet d'horreur), flash blanc à l'impact, fondu à la mort
  const FACE_FS = `uniform sampler2D map; uniform float time, rage, hit, aspect, hasFace, alpha, glitch;
    uniform vec3 eyeL, eyeR, mouth, accent; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(map, vUv);
      if (c.a < 0.08) discard;
      vec3 col = mix(pow(c.rgb, vec3(2.2)), vec3(3.0, 2.8, 2.6), hit);   // image sRGB -> rendu linéaire
      gl_FragColor = vec4(col, c.a * alpha);
    }`;
  // recadrage de l'image sur le visage (yeux + bouche) : les boss ont une tête énorme, pas un personnage en pied
  const cropCache = {};
  function faceCrop(spIdx) {
    if (cropCache[spIdx]) return cropCache[spIdx];
    const sp = BR.Ent && BR.Ent.sprite(spIdx); if (!sp || !sp.canvas) return null;
    const c = sp.canvas, W = c.width, H = c.height, f = sp.face;
    let x0, y0, side;
    if (f) {
      const ey = (f.l[1] + f.r[1]) / 2, cx = (f.l[0] + f.r[0] + f.m[0]) / 3 * W, cy = (ey + f.m[1]) / 2 * H;
      side = Math.max(f.w * W * 1.55, Math.abs(f.m[1] - ey) * H * 3.4, Math.abs(f.r[0] - f.l[0]) * W * 3);
      side = Math.min(side, Math.max(W, H));
      x0 = cx - side / 2; y0 = cy - side * 0.52;
    } else { side = Math.min(W, H); x0 = (W - side) / 2; y0 = 0; }
    const o = document.createElement('canvas'); o.width = o.height = 512;
    o.getContext('2d').drawImage(c, x0, y0, side, side, 0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(o);
    const map = (x, y) => [(x * W - x0) / side, 1 - (y * H - y0) / side];
    const res = { tex, aspect: 1, face: f ? { l: map(f.l[0], f.l[1]), r: map(f.r[0], f.r[1]), m: map(f.m[0], f.m[1]), rad: Math.max(0.025, f.w * W / side * 0.12) } : null };
    return (cropCache[spIdx] = res);
  }
  function faceMesh(spIdx, h, accent) {
    const C = faceCrop(spIdx);
    const asp = 1, w = h;
    const U = { map: { value: C ? C.tex : null }, time: { value: Math.random() * 10 }, rage: { value: 0 }, hit: { value: 0 }, aspect: { value: asp }, hasFace: { value: 0 }, alpha: { value: 1 }, glitch: { value: 0.1 }, eyeL: { value: new V3() }, eyeR: { value: new V3() }, mouth: { value: new V3() }, accent: { value: new THREE.Color(accent) } };
    const f = C && C.face;
    if (f) { const r = f.rad; U.hasFace.value = 1; U.eyeL.value.set(f.l[0], f.l[1], r); U.eyeR.value.set(f.r[0], f.r[1], r); U.mouth.value.set(f.m[0], f.m[1], r * 1.5); }
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: FACE_VS, fragmentShader: FACE_FS, transparent: true, depthWrite: true, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2;
    m.userData.U = U; m.userData.sp = spIdx; m.userData.w = w;
    // position d'un œil dans le repère du plan (pour les rayons)
    m.userData.eye = k => { const e = k ? U.eyeR.value : U.eyeL.value; return U.hasFace.value ? new V3((e.x - 0.5) * w, (e.y - 0.5) * h, 0.05) : new V3((k ? 0.18 : -0.18) * w, 0.15 * h, 0.05); };
    return m;
  }

  /* ---------------- pièces Blender avec matériaux du thème ---------------- */
  function kit(file, accent, rock, S) {
    const g = BR.Assets && BR.Assets.models['bl_' + file];
    const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(rock).convertSRGBToLinear(), vertexColors: true, roughness: 0.78, metalness: 0.08, flatShading: true, emissive: new THREE.Color(0) });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: new THREE.Color(accent), emissiveIntensity: 2.6, roughness: 0.6 });
    return {
      rockMat, glowMat,
      get(name) {
        let src = null; if (g) g.scene.traverse(o => { if (!src && o.name === name) src = o; });
        if (!src) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), rockMat); return m; }
        const c = src.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
        c.traverse(o => { if (o.isMesh) { const n = (o.material && o.material.name) || ''; o.material = /glow/.test(n) ? glowMat : rockMat; o.castShadow = true; o.receiveShadow = true; } });
        return c;
      },
    };
  }

  /* =====================================================================
     OUTILS PARTAGÉS PAR TOUS LES BOSS (AB.H) : chronologie d'attaque, explosions, ondes synchronisées,
     éventails de projectiles, pièces procédurales qui poussent ou se brisent
     ===================================================================== */
  const H = (AB.H = {});
  H.rnd = rnd; H.ease = ease; H.sm = sm;
  /* Pose « organique » : chaque articulation suit sa cible par un ressort légèrement sous-amorti (élan, dépassement,
     retour), et les articulations éloignées du tronc (coudes, poignets, genoux, queue, doigts…) suivent avec un léger
     retard : le coup part du corps et « fouette » jusqu'au bout du membre au lieu d'un déplacement rigide d'un bloc. */
  const DISTAL = /^(el|wr|kn|ank|ft|foot|hand|fing|claw|tail|tip|j2|j3|fore|wing2|wingT|sword|blade|head|hx|neck)/i;
  const HEAVY = /^(py|px|pz|y|h|lift|body)/i;
  H.springPose = function (pose, opt) {
    opt = opt || {};
    const vel = {}, base = opt.w || 11;
    return function (want, dt, k) {
      if (!(dt > 0)) return;
      const w0 = k || base;
      for (const key in pose) {
        const tgt = want[key]; if (tgt == null) continue;
        const distal = DISTAL.test(key), heavy = HEAVY.test(key);
        const w = w0 * (distal ? 0.78 : heavy ? 0.9 : 1), z = heavy ? 0.85 : distal ? 0.5 : 0.62;
        let x = pose[key], v = vel[key] || 0;
        const n = Math.max(1, Math.ceil(dt * w / 0.2)), h = dt / n;
        for (let i = 0; i < n; i++) { v += (w * w * (tgt - x) - 2 * z * w * v) * h; x += v * h; }
        // garde-fou : jamais plus d'un demi-tour d'écart (cibles aberrantes)
        if (Math.abs(x - tgt) > (heavy ? 12 : 3.2) || !isFinite(x)) { x = tgt; v = 0; }
        pose[key] = x; vel[key] = v;
      }
    };
  };
  /* Vecteur à ressort (mains, têtes, griffes) : la position rattrape sa cible avec élan et petit dépassement */
  H.springVec = function (p, v, target, dt, w, z) {
    if (!(dt > 0)) return;
    w = w || 9; z = z == null ? 0.6 : z;
    const n = Math.max(1, Math.ceil(dt * w / 0.2)), h = dt / n;
    for (let i = 0; i < n; i++) {
      v.x += (w * w * (target.x - p.x) - 2 * z * w * v.x) * h; v.y += (w * w * (target.y - p.y) - 2 * z * w * v.y) * h; v.z += (w * w * (target.z - p.z) - 2 * z * w * v.z) * h;
      p.x += v.x * h; p.y += v.y * h; p.z += v.z * h;
    }
    if (p.distanceToSquared(target) > 900) { p.copy(target); v.set(0, 0, 0); }
  };
  /** chronologie : tl.at(t, fn) exécute fn une seule fois quand l'attaque atteint t secondes */
  H.tl = function () { const ev = []; const o = { at(t, fn) { ev.push({ t, fn, done: false }); return o; }, run(t) { for (const e of ev) if (!e.done && t >= e.t) { e.done = true; e.fn(); } } }; return o; };
  H.clampR = (x, z, R) => { const d = Math.hypot(x, z); return d > R ? [x * R / d, z * R / d] : [x, z]; };
  H.pt = (x, z) => [+x.toFixed(2), +z.toFixed(2)];
  /** explosion au sol (visuel + dégâts au joueur local) */
  H.blast = function (b, inst, key, x, z, r, dmg, color, o) {
    o = o || {}; const S = b.S, A = b.A, q = new V3(x, 0.3, z);
    S.fx.flash(q, { color, r: Math.min(5, r * 0.55), life: 0.3, intensity: 6, light: !!o.light });
    S.fx.ring(new V3(x, 0, z), { r1: r * 1.3, color, life: 0.4, world: true });
    S.fx.burst(q, { n: Math.round(10 + r * 3), color, speed: 6 + r, up: 1.2, life: 0.5, world: true });
    if (!o.noSmoke) S.fx.burst(q, { n: Math.round(8 + r * 3), color: o.smoke || 0x4a4246, kind: 'smoke', speed: 4 + r * 1.5, up: 1, life: 0.9, size: 0.5, grav: 18, world: true });
    if (!o.quiet) A.sfx('boom', { g: o.g || 0.4, rate: o.rate || 1.3, len: 0.6 });
    if (o.shake !== 0) A.shake(o.shake || 0.22);
    if (o.noHurt) return false;
    return A.hurtCircle(x, z, r, dmg, Object.assign({ up: 6, kb: 8, h: o.h || 4 }, o.hurt || {}), inst, key);
  };
  /** onde de choc : l'anneau visible avance exactement à la vitesse de la zone de dégâts (11 m/s), un saut l'évite.
      o = { r0, rMax, speed, dmg, color, arc, yaw, kb, up } — arc/yaw : onde partielle (un trou pour passer) */
  H.wave = function (b, x, z, o) {
    const S = b.S, A = b.A, sp = o.speed || 11, r0 = o.r0 == null ? 1 : o.r0, R = o.rMax || 40, life = (R - r0) / sp;
    S.fx.ring(new V3(x, 0, z), { r0, r1: R, color: o.color || b.glowCol, life, linear: true, band: 1.4, world: true, arc: o.arc, rotY: o.arc ? o.yaw : undefined });
    // le sol se soulève vraiment : éclats de roche + poussière qui roule au départ de l'onde
    if (S.fx.debris && !o.noDebris) {
      S.fx.debris(new V3(x, 0, z), { n: 14, r: Math.max(1.2, r0 * 0.8), speed: 11, size: 0.35, world: true });
      S.fx.burst(new V3(x, 0.3, z), { n: 18, color: 0x6a5e52, kind: 'smoke', speed: 7, up: 0.25, flat: true, life: 1.1, size: 1.4, size1: 3.2, grav: -0.4, drag: 2, world: true, alpha: 0.6 });
    }
    A.ezone({ pos: new V3(x, 0, z), life, iv: 1 / 60, onTick: zn => {
      const r = r0 + sp * zn.t, f = A.me();
      if (o.arc && Math.abs(BR.angDiff(o.yaw, Math.atan2(f.pos.x - x, f.pos.z - z))) > o.arc / 2) return;
      A.hurtRing(x, z, r - 0.5, r + 0.5, o.dmg || 100, { kb: o.kb || 6, up: o.up || 5 }, zn, 'w');
    } });
  };
  /** éventail de projectiles horizontaux */
  H.fan = function (b, from, yaw, n, spread, speed, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = yaw + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
      b.A.eproj(Object.assign({ pos: from.clone(), vel: new V3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(speed), r: 0.55, dmg: 60, color: b.glowCol.getHex(), life: 4 }, o));
    }
  };
  /** frappe en ligne : piliers lumineux le long d'un segment + dégâts */
  H.strike = function (b, inst, key, x, z, yaw, len, w, dmg, color, o) {
    o = o || {}; const S = b.S, A = b.A, d = new V3(Math.sin(yaw), 0, Math.cos(yaw));
    for (let s = 0; s <= len; s += 2.2) { const q = new V3(x + d.x * s, 0, z + d.z * s); if (Math.hypot(q.x, q.z) > A.arenaR + 1) break; S.fx.pillar(q, { color, r: w * 0.32, h: o.h || 5, life: 0.4, world: true }); S.fx.burst(q.clone().setY(0.3), { n: 5, color, speed: 6, up: 1.2, life: 0.45, world: true }); }
    if (!o.quiet) A.sfx('zap', { g: 0.6 });
    return A.hurtLine(x, z, yaw, len, w, dmg, Object.assign({ up: 5, kb: 6 }, o.hurt || {}), inst, key);
  };
  /** « danger total » : tout l'arène sauf des cercles sûrs. Renvoie true si le joueur local est à l'abri */
  H.inSafe = (A, safes, r) => { const f = A.me(); return safes.some(s => Math.hypot(f.pos.x - s[0], f.pos.z - s[1]) <= r); };
  H.hurtMe = (A, dmg, o, inst, key) => { const f = A.me(); return A.hurtSphere(f.center(), 0.1, dmg, o || {}, inst, key); };
  /** colonne lumineuse qui matérialise une zone sûre (bien visible de loin, suit la zone quand elle dérive) */
  H.safeColumn = function (b, color, r, life) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(b.S.fx.geo.cyl, mat); m.scale.set(r, 7, r); m.renderOrder = 6;
    b.S.fx.add(m, life, (k, o2, dt, t) => { mat.opacity = (0.16 + 0.08 * Math.sin(t * 8)) * Math.min(1, t * 4) * (k > 0.92 ? (1 - k) / 0.08 : 1); }, true);
    return { set(x, z) { m.position.set(x, 0, z); } };
  };
  /** matériaux procéduraux d'un boss (les couleurs de thème passent en linéaire) */
  H.mats = function (b, rock, accent, o) {
    o = o || {}; const L = c => new THREE.Color(c).convertSRGBToLinear();
    const M = {
      rock: new THREE.MeshStandardMaterial({ color: L(rock), roughness: o.rough == null ? 0.72 : o.rough, metalness: o.metal || 0.12, flatShading: true, emissive: new THREE.Color(0) }),
      dark: new THREE.MeshStandardMaterial({ color: L(o.dark || '#1c1a20'), roughness: 0.6, metalness: 0.35, flatShading: true }),
      metal: new THREE.MeshStandardMaterial({ color: L(o.metalCol || '#8a8a96'), roughness: 0.32, metalness: 0.85, flatShading: true }),
      glow: new THREE.MeshStandardMaterial({ color: 0x050505, emissive: new THREE.Color(accent), emissiveIntensity: 2.6, roughness: 0.5 }),
      glow2: new THREE.MeshStandardMaterial({ color: 0x050505, emissive: new THREE.Color(accent), emissiveIntensity: 2.6, roughness: 0.5, transparent: true, opacity: 0.85 }),
    };
    b.rockMat = M.rock; b.glowMat = M.glow; b.glowMat2 = M.glow2; b.ownMats = (b.ownMats || []).concat(Object.values(M));
    return M;
  };
  /** maillage procédural (la géométrie sera libérée à la fin du combat) */
  H.mesh = function (b, geo, mat, o) {
    b.ownGeos.push(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = !(o && o.noShadow); m.receiveShadow = true;
    if (o) { if (o.p) m.position.set(o.p[0], o.p[1], o.p[2]); if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]); if (o.s) { if (typeof o.s === 'number') m.scale.setScalar(o.s); else m.scale.set(o.s[0], o.s[1], o.s[2]); } }
    return m;
  };
  /** géométrie bosselée (rocher, carapace) : icosaèdre déformé */
  H.lumpy = function (r, det, amt, seed, sx, sy, sz) {
    const g = new THREE.IcosahedronGeometry(r, det || 1), p = g.attributes.position, rr = BR.rngFrom(seed || 7);
    for (let i = 0; i < p.count; i++) { const k = 1 + (rr() - 0.5) * (amt || 0.25); p.setXYZ(i, p.getX(i) * k * (sx || 1), p.getY(i) * k * (sy || 1), p.getZ(i) * k * (sz || 1)); }
    g.computeVertexNormals(); return g;
  };
  /** pièce qui pousse (apparition animée) */
  H.grow = function (b, obj, delay) { obj.visible = false; b.growing.push({ o: obj, t: -(delay || 0), s: obj.scale.clone() }); return obj; };
  /** pièce qui se détache et tombe en rebondissant (armure brisée) */
  H.breakOff = function (b, obj, push) {
    if (!obj || !obj.parent) return;
    const S = b.S; obj.updateMatrixWorld(true);
    const wp = new V3(), wq = new THREE.Quaternion(), ws = new V3(); obj.matrixWorld.decompose(wp, wq, ws);
    obj.parent.remove(obj); obj.position.copy(wp); obj.quaternion.copy(wq); obj.scale.copy(ws);
    obj.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; } });
    const out = wp.clone().sub(b.focus()).setY(0); if (out.lengthSq() < 0.01) out.set(1, 0, 0); out.normalize();
    const v = out.multiplyScalar(push || 7).add(new V3(0, 7 + Math.random() * 5, 0)), av = new V3(rnd(Math.random, -5, 5), rnd(Math.random, -5, 5), rnd(Math.random, -5, 5));
    S.fx.burst(wp, { n: 40, color: b.glowCol, speed: 10, life: 0.6, world: true }); S.fx.burst(wp, { n: 18, color: 0x3a3438, kind: 'smoke', speed: 6, life: 1, size: 0.6, grav: 14, world: true });
    BR.Audio.fx('break', { g: 0.5 });
    S.fx.add(obj, 3.2, (k, o2, dt) => {
      v.y -= 30 * dt; o2.position.addScaledVector(v, dt);
      if (o2.position.y < 0.4) { o2.position.y = 0.4; v.y = Math.abs(v.y) * 0.3; v.x *= 0.6; v.z *= 0.6; av.multiplyScalar(0.6); }
      o2.rotation.x += av.x * dt; o2.rotation.y += av.y * dt; o2.rotation.z += av.z * dt;
      if (k > 0.7) o2.traverse(m => { if (m.isMesh) m.material.opacity = Math.max(0, (1 - k) / 0.3); });
    }, true);
  };
  /** onde « lissée » pour le corps : ressort critique vers une valeur (évite toute saccade) */
  H.damp = (cur, want, k, dt) => cur + (want - cur) * (1 - Math.exp(-k * dt));

  /* ---------------- base commune ---------------- */
  function base(S, o, id) {
    const def = AR.boss(id), A = BR.Arena.bossApi();
    const b = {
      S, A, id, def, group: new THREE.Group(), pos: new V3(0, 0, 8), y: 0, yaw: Math.PI, hp: o.hp, maxHp: o.hp, posture: 0, postureMax: 100,
      broken: 0, phase: 1, dead: false, deadT: 0, parts: [], adds: [], insts: [], cool: 3.5, t: 0, stun: 0, slowT: 0, domainSlow: 0,
      speed: o.speed || 1, faces: o.faces || [0], size: 10, net: null, accent: new THREE.Color(def.color), faceMeshes: [], flashT: 0,
      // évolution : stade 1 à 3 (PV perdus ET temps écoulé), multiplicateurs de dégâts / vitesse / recharge
      stage: 1, maxStage: 3, speed0: o.speed || 1, dmgMul: 1, coolMul: 1, sc: 1, evoScale: [1, 1, 1.08, 1.16], evoT: -1, growing: [], ownGeos: [],
      // rendu lissé : position / orientation affichées (les sauts brusques sont amortis, jamais de téléportation visible)
      vp: new V3(0, 0, 8), vy: Math.PI,
    };
    // nombre de joueurs au départ, palier de difficulté (0 normal, 1 héroïque, 2 cauchemar), résistance aux ultimes (1 = aucune)
    b.nStart = Math.max(1, o.n || 1); b.tier = (S.diff && S.diff.tier) || 0; b.ultRes = 1;
    b.glowCol = new THREE.Color(def.color);
    b.stageCol = [null, new THREE.Color(def.color), new THREE.Color(def.color).lerp(new THREE.Color(0xff2a10), 0.45).multiplyScalar(1.15), new THREE.Color(def.color).lerp(new THREE.Color(0xffffff), 0.38).multiplyScalar(1.2)];
    S.scene.add(b.group);
    b.partPos = i => { const p = b.parts[i]; return p ? p.obj.localToWorld(p.off.clone()) : b.focus(); };
    b.blockers = () => [];
    b.rng = BR.rngFrom((o.seed || 1) >>> 0);
    // ---- dégâts (hôte) ----
    b.damage = function (i, dmg, posture, src, opt) {
      if (b.dead) return;
      opt = opt || {};
      if (i >= 100) { const a = b.adds[i - 100]; if (a && a.alive) { a.hp -= dmg; if (a.hp <= 0) b.killAdd(i - 100); } return; }
      // anti-rafale : chaque ultime reçu rend le boss plus résistant aux suivants (récupère en ~20 s),
      // et aucun coup isolé ne peut retirer plus de 5 % (ultime : 10 %) de ses PV
      if (i >= 0 && dmg > 0) {
        if (opt.kind === 'ult') { dmg *= b.ultRes; b.ultRes = Math.max(0.3, b.ultRes * 0.72); }
        dmg = Math.min(dmg, b.maxHp * (opt.kind === 'ult' ? 0.1 : 0.05));
      }
      // posture : plus dure à briser à plusieurs et en Cauchemar (sinon le boss passait son temps à terre)
      if (posture) posture /= (1 + 0.6 * (b.nStart - 1)) * (b.tier >= 2 ? 1.25 : 1);
      if (i >= 0) { const p = b.parts[i]; if (!p || p.dead) return; if (p.pool) { p.pool.hp -= dmg; if (p.pool.hp <= 0 && !p.pool.dead) b.killPool(p.pool); } b.hp -= dmg; }
      if (src) b.threat[src] = (b.threat[src] || 0) + dmg + (posture || 0) * 25;
      if (opt.stun) b.stun = Math.max(b.stun, opt.stun * 0.6);
      if (opt.freeze) b.slowT = Math.max(b.slowT, opt.freeze);
      if (b.broken <= 0 && posture) { b.posture += posture; if (b.posture >= b.postureMax) { b.posture = 0; b.broken = 4.5; b.onBreak(); } }
      if (b.hp <= 0) { b.hp = 0; b.die(); }
    };
    b.killPool = p => { p.dead = true; };
    b.killAdd = () => {};
    b.onBreak = function () {
      b.insts.forEach(x => x.cancel && x.cancel()); b.insts = [];
      BR.Audio.fx('break'); A.shake(0.6);
      BR.Arena.banner('POSTURE BRISÉE', 'Dégâts +50 % — frappe le point faible !', 1.8, 'gold');
      S.fx.flash(b.focus(), { color: 0xffffff, r: 4, life: 0.4, intensity: 8 });
      S.fx.burst(b.focus(), { n: 80, color: def.color, speed: 16, life: 0.8 });
      // fioles de soin pour l'équipe
      for (const f of A.players()) { if (f.kind === 'local') A.S.fx.num(f.center(), '+15 %', { color: '#7dff9a' }); if (f.kind === 'local') f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.15); }
    };
    /* ---------- évolution ---------- */
    // stade voulu : selon les PV perdus et le temps de combat (le plus avancé des deux)
    b.wantStage = function () {
      const k = b.hp / b.maxHp, byHp = k < 0.38 ? 3 : k < 0.7 ? 2 : 1, byT = b.t > 165 ? 3 : b.t > 80 ? 2 : 1;
      return Math.min(b.maxStage, Math.max(byHp, byT));
    };
    // applique les statistiques d'un stade (appelé chez tous les clients, idempotent)
    b.applyStage = function (s) {
      s = Math.min(b.maxStage, s | 0); if (s <= b.stage) return false;
      const from = b.stage; b.stage = s; b.phase = s >= 2 ? 2 : 1;
      b.dmgMul = [1, 1, 1.15, 1.3][s]; b.speed = b.speed0 * [1, 1, 1.12, 1.24][s]; b.coolMul = [1, 1, 0.9, 0.8][s]; b.glowK = [1, 1, 1.5, 2.1][s];
      b.postureMax = Math.round(b.postureMax * 1.1);
      for (let k = from + 1; k <= s; k++) { try { if (b.onStage) b.onStage(k); } catch (e) { console.error(e); } }
      return true;
    };
    b.onPhase2 = () => {};
    b.attacks = {};
    // transition visible : rugissement, onde de choc (à sauter), court ralenti, bandeau
    b.attacks._evo = (P) => {
      b.insts.forEach(x => x.cancel && x.cancel()); b.insts = [];
      const to = P.to || b.stage + 1; b.applyStage(to);
      const p0 = new V3(P.x, 0, P.z), col = b.stageCol[b.stage] || b.accent;
      const roman = ['', 'I', 'II', 'III'][b.stage] || '';
      const inst = { dur: 2.9, main: true, ownsMove: true, evo: true, pose: b.evoPose ? (t => b.evoPose(t)) : undefined,
        update(t, dt) {
          b.evoT = t;
          if (t < 1.0) { // l'énergie converge vers le boss
            if (Math.random() < 0.8) { const a = Math.random() * 6.283, r = 10 + Math.random() * 8, q = b.focus(); S.fx.spark(new V3(q.x + Math.cos(a) * r, Math.random() * 10, q.z + Math.sin(a) * r), new V3(-Math.cos(a) * r * 1.1, (q.y - 5) * 1.1, -Math.sin(a) * r * 1.1), { color: col, life: 0.9, size: 0.6, size1: 0.1, world: true }); }
          }
          if (t > 0.15 && !inst.a) { inst.a = 1; A.voice(b.faces[0], 0.6, 1.3); BR.Audio.fx('roar', { g: 1.3, rate: 0.8 }); BR.Audio.fx('charge', { len: 0.9, g: 1 }); A.shake(0.4); }
          if (t > 1.0 && !inst.w) {
            inst.w = 1; const q = b.focus();
            BR.Arena.banner('ÉVOLUTION', def.name.replace(/^L[E']\s?|^LA\s/, '') + ' — STADE ' + roman + ' : ' + (AR.STAGES ? AR.STAGES[b.stage] : ''), 2.6, 'evo');
            S.fx.flash(q, { color: col, r: 6, life: 0.6, intensity: 10 }); S.fx.burst(q, { n: 160, color: col, speed: 22, life: 1.1, size: 0.5 });
            S.fx.ring(p0, { r1: 18, color: 0xffffff, life: 0.5, width: 0.3 }); S.fx.pillar(p0, { color: col, r: 4, h: 40, life: 1.2 });
            AB.H.wave(b, p0.x, p0.z, { r0: 2, rMax: 40, dmg: 70, color: col, kb: 8, up: 6 });
            BR.Audio.fx('boom', { len: 2 }); BR.Audio.fx('break', { g: 0.8 }); A.shake(1.1);
            if (S.solo) S.slowT = Math.max(S.slowT, 0.75);
            S.flash.copy(col).multiplyScalar(0.25);
          }
        }, end() { b.evoT = -1; }, cancel() { b.evoT = -1; } };
      return inst;
    };
    /* traque de groupe (commune à tous les boss, en parallèle de l'attaque principale) : chaque joueur visé reçoit
       une marque qui le SUIT, se fige puis explose. v = 0 : pilier ; 1 : croix de deux lames ; 2 : rafale de 3 marques
       qui anticipent ta course (il faut changer de direction au bon rythme). Chaque client ne teste que son joueur. */
    b.attacks._hunt = (P) => {
      const ids = P.ids || [], v = P.v || 0, tk = P.tk || 1.25, lock = 0.45, col = b.glowCol.clone();
      const posOf = id => { const p = A.player(id); return p && p.alive ? p : null; };
      const marks = [];
      ids.forEach((id, j) => {
        const n = v === 2 ? 3 : 1;
        for (let k = 0; k < n; k++) marks.push({ id, j, k, t0: v === 2 ? k * 0.55 : 0, tk: v === 2 ? tk * 0.75 : tk, lead: v === 2 ? 0.25 + k * 0.2 : 0, p: new V3(), d: null, done: false });
      });
      if (!marks.length) return null;
      A.sfx('charge', { len: tk + 0.3, g: 0.55 });
      const inst = { dur: 3.4, main: false,
        update(t) {
          for (const m of marks) {
            if (m.done || t < m.t0) continue;
            const f = posOf(m.id); const lt = t - m.t0;
            if (!m.d) { if (!f) { m.done = true; continue; } m.p.set(f.pos.x, 0, f.pos.z); m.d = S.fx.decal(m.p, 'circle', { r: v === 1 ? 1.6 : 2.5, color: 0xff3020, dur: m.tk + lock, hold: 0.1 }); }
            if (lt < m.tk && f) {
              // la marque colle au joueur (avec une légère anticipation de sa course pour la rafale)
              let x = f.pos.x + f.vel.x * m.lead, z = f.pos.z + f.vel.z * m.lead; [x, z] = H.clampR(x, z, A.arenaR);
              m.p.x += (x - m.p.x) * 0.35; m.p.z += (z - m.p.z) * 0.35; m.d.set(m.p);
              if (Math.random() < 0.3) S.fx.spark(m.p.clone().setY(0.1), new V3(0, 3, 0), { color: col, life: 0.4, size: 0.35, world: true });
            } else if (lt >= m.tk && !m.locked) {
              m.locked = 1; A.sfx('zap', { g: 0.35, rate: 1.6 });
              if (v === 1) { m.a = b.rng() * Math.PI; for (const a of [m.a, m.a + Math.PI / 2]) S.fx.decal(new V3(m.p.x - Math.sin(a) * 11, 0, m.p.z - Math.cos(a) * 11), 'line', { len: 22, width: 2.4, yaw: a, color: 0xff3020, dur: lock, hold: 0.1 }); }
            }
            if (lt >= m.tk + lock && !m.done) {
              m.done = true; const key = 'm' + m.j + '_' + m.k;
              if (v === 1) { for (const [q, a] of [[0, m.a], [1, m.a + Math.PI / 2]]) H.strike(b, inst, key + 'c' + q, m.p.x - Math.sin(a) * 11, m.p.z - Math.cos(a) * 11, a, 22, 2.4, 105, col, { quiet: q === 1, hurt: { up: 6, kb: 7 } }); }
              else { H.blast(b, inst, key, m.p.x, m.p.z, 2.5, v === 2 ? 75 : 115, col, { up: 8, quiet: m.k > 0, shake: 0.15 }); S.fx.pillar(m.p.clone(), { color: col, r: 1.3, h: 14, life: 0.45, world: true }); }
            }
          }
        } };
      return inst;
    };
    b.die = function () {
      if (b.dead) return;
      b.dead = true; b.deadT = 0; b.insts.forEach(x => x.cancel && x.cancel()); b.insts = [];
      A.voice(b.faces[0], 0.55, 1.4); BR.Audio.fx('boom', { len: 2 });
    };
    b.hitFx = function (i, at, crit) { b.flashT = crit ? 0.06 : 0.04; b.faceMeshes.forEach(m => { m.userData.U.hit.value = Math.max(m.userData.U.hit.value, crit ? 0.35 : 0.15); }); BR.Audio.fx('bossHit', { g: 0.5 }); };
    // ---- attaques ----
    b.begin = function (n, extra) {
      const tg = (extra && extra.keep && b.target && b.target.alive) ? b.target : b.pickTarget(); if (!tg) return;
      const P = Object.assign({ k: 'ba', n, s: (Math.random() * 1e9) >>> 0, tg: tg.id, tx: +tg.pos.x.toFixed(2), tz: +tg.pos.z.toFixed(2), x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), yw: +b.yaw.toFixed(3), sg: b.stage }, extra || {});
      A.hostSend(P);
      b.startAttack(n, P);
    };
    b.startAttack = function (n, P) {
      const fn = b.attacks[n]; if (!fn || b.dead) return;
      // un client en retard sur l'évolution la rattrape (sans la cinématique)
      if (n !== '_evo' && P.sg && P.sg > b.stage) b.applyStage(P.sg);
      P.sg = P.sg || b.stage;
      const inst = fn(P, BR.rngFrom(P.s >>> 0)); if (!inst) return;
      inst.t = 0; inst.P = P; inst.atk = n;
      if (inst.ownsMove) { b.pos.x = P.x; b.pos.z = P.z; b.yaw = P.yw; }
      b.insts.push(inst);
    };
    // cible : menace (dégâts reçus de chacun), proximité, et on change souvent de victime quand on est plusieurs
    b.threat = {};
    b.pickTarget = function () {
      const ps = A.players(); if (!ps.length) return null;
      let best = null, bs = -1e9;
      for (const p of ps) {
        const d = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
        const sc = (b.threat[p.id] || 0) * 0.6 + 3000 / (4 + d) + b.rng() * 1600 - (p === b.target && ps.length > 1 ? 1200 : 0);
        if (sc > bs) { bs = sc; best = p; }
      }
      b.target = best; return best;
    };
    // positions de plusieurs joueurs (attaques qui visent tout le monde)
    b.targetsPts = n => { const ps = BR.shuffle(A.players().slice(), b.rng).slice(0, n); return ps.map(p => [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)]); };
    b.nPlayers = () => A.players().length;
    b.spread = () => { const ps = A.players(); let m = 0; for (const a of ps) for (const c of ps) m = Math.max(m, a.pos.distanceTo(c.pos)); return m; };
    b.behind = r => A.players().some(p => { const d = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z); if (d > r) return false; return Math.abs(BR.angDiff(b.yaw, Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z))) > 2.0; });
    b.targetPos = () => { const t = b.target && b.target.alive ? b.target : b.pickTarget(); return t ? t.pos : new V3(); };
    // ---- boucle ----
    // lissage du rendu : un saut de position / d'orientation d'une image à l'autre (début d'attaque, correction réseau)
    // est absorbé puis rattrapé en douceur ; les mouvements continus (charges, bonds) ne sont pas retardés
    const vOff = new V3(), lastP = new V3(); let yOff = 0, lastY = 0, visInit = false;
    function smoothVis(dt) {
      if (!visInit) { visInit = true; lastP.copy(b.pos); lastY = b.yaw; }
      const dx = b.pos.x - lastP.x, dz = b.pos.z - lastP.z;
      if (Math.hypot(dx, dz) > Math.max(0.9, 45 * dt)) { vOff.x -= dx; vOff.z -= dz; }
      const dy = BR.angDiff(lastY, b.yaw); if (Math.abs(dy) > Math.max(0.3, 14 * dt)) yOff -= dy;
      lastP.copy(b.pos); lastY = b.yaw;
      const k = Math.exp(-dt * 9); vOff.multiplyScalar(k); yOff *= Math.exp(-dt * 10);
      if (vOff.lengthSq() < 1e-4) vOff.set(0, 0, 0);
      b.vp.set(b.pos.x + vOff.x, b.pos.y, b.pos.z + vOff.z); b.vy = b.yaw + yOff;
    }
    b.smoothVis = smoothVis;
    const easeBack = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
    // apparence selon le stade : couleur des fissures, taille, pièces qui poussent, aura
    function stageVis(dt) {
      const want = b.stageCol[b.stage] || b.accent;
      b.glowCol.lerp(want, Math.min(1, dt * 1.6));
      if (b.glowMat) b.glowMat.emissive.copy(b.glowCol);
      if (b.glowMat2) b.glowMat2.emissive.copy(b.glowCol);
      b.sc += ((b.evoScale[b.stage] || 1) - b.sc) * Math.min(1, dt * 1.8);
      for (let i = b.growing.length - 1; i >= 0; i--) {
        const g = b.growing[i]; g.t += dt; if (g.t < 0) continue;
        g.o.visible = true; const k = Math.min(1, g.t / 0.7); g.o.scale.copy(g.s).multiplyScalar(Math.max(0.01, easeBack(k)));
        if (k >= 1) b.growing.splice(i, 1);
      }
      if (b.stage >= 2 && !b.dead && Math.random() < dt * (b.stage - 1) * 9) {
        const q = b.focus(), s = b.size * 0.5;
        S.fx.spark(q.clone().add(new V3(rnd(Math.random, -s, s), rnd(Math.random, -s * 1.2, s * 0.4), rnd(Math.random, -s, s))), new V3(0, 2 + Math.random() * 3, 0), { color: b.glowCol, life: 1.2, size: 0.5, size1: 0.05, world: true });
      }
    }
    b.update = function (dt) {
      dt *= (1 - (b.domainSlow || 0)) * (b.slowT > 0 ? 0.5 : 1);
      if (b.slowT > 0) b.slowT -= dt;
      b.t += dt;
      b.faceMeshes.forEach(m => { const U = m.userData.U; U.time.value += dt; U.hit.value = Math.max(0, U.hit.value - dt * 4); U.rage.value = sm(U.rage.value, b.phase > 1 ? 1 : 0.35, dt); U.glitch.value = 0.06 + U.rage.value * 0.25 + (b.broken > 0 ? 0.6 : 0); });
      b.flashT = Math.max(0, b.flashT - dt); b.rockMat && b.rockMat.emissive.setScalar(b.flashT > 0 ? 0.09 : 0);
      if (b.glowMat) b.glowMat.emissiveIntensity = (b.glowK || 1) * (2.3 + Math.sin(b.t * 3) * 0.4) * (b.broken > 0 ? 1.8 : 1) * (b.evoT >= 0 ? 1.6 + Math.sin(b.t * 30) * 0.4 : 1);
      if (b.glowMat2) b.glowMat2.emissiveIntensity = b.glowMat ? b.glowMat.emissiveIntensity : 2.5;
      stageVis(dt);
      if (b.dead) { b.deadT += dt; smoothVis(dt); b.deathAnim(dt); b.group.updateMatrixWorld(true); return; }
      if (b.broken > 0) b.broken -= dt;
      if (b.stun > 0) b.stun -= dt;
      const frozen = b.stun > 0;
      for (let i = b.insts.length - 1; i >= 0; i--) {
        const it = b.insts[i]; if (frozen && it.main) continue;
        it.t += dt;
        let bad = false;
        try { it.update(it.t, dt); } catch (e) { console.error(e); bad = true; }
        // une attaque qui plante ou qui ne se termine jamais (> 30 s) est arrêtée : le boss ne reste plus figé
        if (it.t >= it.dur || bad || it.t > 30) { try { if (it.end) it.end(); } catch (e) { console.error(e); } b.insts.splice(i, 1); }
      }
      if (!S.isHost && b.net && !b.insts.some(x => x.ownsMove)) {
        b.pos.x += (b.net.x - b.pos.x) * Math.min(1, dt * 8); b.pos.z += (b.net.z - b.pos.z) * Math.min(1, dt * 8);
        b.yaw += BR.angDiff(b.yaw, b.net.yw) * Math.min(1, dt * 8);
      }
      smoothVis(dt);
      b.animate(dt);
      b.updateAdds && b.updateAdds(dt);
      b.group.updateMatrixWorld(true);
    };
    b.think = function (dt) {
      if (b.dead || b.broken > 0 || b.stun > 0) return;
      dt *= (1 - (b.domainSlow || 0));
      if (!b.insts.some(x => x.ownsMove || x.main)) b.move(dt);
      b.cool -= dt;
      if (!(b.cool > -1e6 && b.cool < 1e6)) b.cool = 1;           // NaN ou valeur folle : on repart proprement
      if (!isFinite(b.pos.x) || !isFinite(b.pos.z)) b.pos.set(0, 0, 0);
      b.ultRes = Math.min(1, b.ultRes + dt * 0.035);
      for (const k in b.threat) b.threat[k] *= Math.max(0, 1 - dt * 0.15);
      // traque de groupe : pendant qu'il s'occupe de sa cible, le boss marque les AUTRES joueurs (attaque en parallèle)
      const nP = b.nPlayers();
      b.huntT = (b.huntT == null ? 7 : b.huntT) - dt;
      if (b.huntT <= 0) {
        if ((nP >= 2 || b.tier >= 2 || b.stage >= 3) && b.attacks._hunt && !b.insts.some(x => x.evo || x.atk === '_hunt')) {
          const ps = A.players(); let pool = ps.filter(p => p !== b.target); if (!pool.length) pool = ps;
          const v = b.stage >= 2 && b.rng() < 0.35 ? 2 : b.rng() < 0.5 ? 0 : 1;
          b.begin('_hunt', { keep: 1, ids: pool.map(p => p.id), v, tk: b.tier >= 2 ? 1.0 : 1.25 });
        }
        b.huntT = Math.max(4.5, (nP >= 2 ? 12.5 - 1.6 * nP : 14) - b.tier * 1.3 - (b.stage - 1) * 0.8);
      }
      // évolution : dès que le boss est libre (un stade à la fois, au moins 8 s d'écart)
      if (b.stage < b.maxStage && !b.insts.some(x => x.main) && b.t - (b.lastEvo || -99) > 8 && b.wantStage() > b.stage) {
        b.lastEvo = b.t; b.chain = null; b.begin('_evo', { to: b.stage + 1, keep: 1 }); b.cool = Math.max(b.cool, 1.0); return;
      }
      if (b.cool <= 0 && !b.insts.some(x => x.main)) {
        // enchaînement en cours : l'attaque suivante part tout de suite
        if (b.chain) { const c = b.chain; b.chain = c[3] > 1 ? [c[0], c[1], c[2], c[3] - 1] : null; b.begin(c[0], typeof c[1] === 'function' ? c[1]() : c[1]); b.cool = c[2]; return; }
        const pick = b.choose();
        if (pick) {
          b.begin(pick[0], pick[2]); b.chain = pick[3] ? pick[3].slice() : null;
          // Héroïque / Cauchemar : les combos prévus pour chaque boss s'allongent d'un coup et se resserrent
          if (b.chain && b.tier && b.rng() < 0.35 * b.tier) { b.chain[2] *= 1 - 0.15 * b.tier; b.chain[3] = (b.chain[3] || 1) + 1; }
          // plus de joueurs / difficulté plus haute : le boss enchaîne plus vite
          const grp = 1 / (1 + 0.14 * (nP - 1)), tierK = 1 - 0.07 * b.tier;
          b.cool = pick[1] * b.coolMul / b.speed * grp * tierK;
          // « doublé » imprévisible : la même attaque repart aussitôt (seulement les attaques sans paramètres figés)
          if (!b.chain && pick[2] == null && pick[0][0] !== '_' && b.rng() < 0.06 + 0.1 * b.tier + 0.05 * (nP - 1)) b.chain = [pick[0], null, 0.3 + b.rng() * 0.3, 1];
        }
        else b.cool = 0.4;
      }
      b.thinkAdds && b.thinkAdds(dt);
    };
    b.weighted = function (list) {
      const tot = list.reduce((s, x) => s + x[1], 0); let r = b.rng() * tot;
      for (const x of list) { if ((r -= x[1]) <= 0) return x; } return list[0];
    };
    b.getState = () => ({ x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), yw: +b.yaw.toFixed(3), hp: Math.round(b.hp), ps: Math.round(b.posture), br: +b.broken.toFixed(2), ph: b.phase, sg: b.stage, dd: b.dead ? 1 : 0, ex: b.extraState ? b.extraState() : 0 });
    b.setState = function (s) {
      b.net = s; b.hp = s.hp; b.posture = s.ps;
      if (s.br > 0 && b.broken <= 0) b.onBreak();
      b.broken = s.br;
      if (s.sg && s.sg > b.stage) b.applyStage(s.sg);
      if (s.dd && !b.dead) b.die();
      if (b.applyExtra && s.ex) b.applyExtra(s.ex);
    };
    b.dispose = function () {
      S.scene.remove(b.group);
      b.group.traverse(o => { if (o.isMesh && o.material && o.material.isShaderMaterial) o.material.dispose(); if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry') o.geometry.dispose(); });
      b.ownGeos.forEach(g => g.dispose()); (b.ownMats || []).forEach(m => m.dispose());
    };
    b.deathAnim = function (dt) {
      // explosions en chaîne puis effondrement
      if (Math.random() < dt * 9 && b.deadT < 3) { const i = Math.floor(Math.random() * b.parts.length), p = b.partPos(i); S.fx.flash(p, { color: def.color, r: 2, life: 0.3, intensity: 5 }); S.fx.burst(p, { n: 30, color: def.color, speed: 12, life: 0.6 }); BR.Audio.fx('boom', { g: 0.5, len: 0.6 }); }
      if (b.deadT > 2.6 && !b.finalBoom) { b.finalBoom = true; const p = b.focus(); S.fx.flash(p, { color: 0xffffff, r: 8, life: 0.6, intensity: 10 }); S.fx.ring(b.pos.clone(), { r1: 40, color: def.color, life: 1.2, width: 0.08 }); S.fx.burst(p, { n: 300, color: def.color, speed: 25, life: 1.4, size: 0.6 }); A.shake(1.2); BR.Audio.fx('boom', { len: 2.2 }); }
      const k = ease((b.deadT - 2.6) / 1.6);
      const sc = 1 - k * 0.98; b.group.scale.setScalar(sc); b.group.position.set(b.pos.x * (1 - sc), -k * 3, b.pos.z * (1 - sc));
      b.faceMeshes.forEach(m => { m.userData.U.alpha.value = 1 - k; m.userData.U.glitch.value = 1; });
    };
    // marquage + météores (commun : pluie de rochers / venin)
    b.rain = function (P, r, color, n, rockColor) {
      const pts = P.pts || [];
      const inst = { dur: 2.2, main: false, update(t) {
        pts.forEach((p, i) => {
          const t0 = 0.15 + i * 0.07;
          if (t >= t0 && !inst['d' + i]) { inst['d' + i] = 1; S.fx.decal({ x: p[0], z: p[1] }, 'circle', { r: 2.8, color, dur: 1.1 }); }
          if (t >= t0 + 1.1 && !inst['h' + i]) {
            inst['h' + i] = 1; const q = new V3(p[0], 0.3, p[1]);
            S.fx.flash(q, { color, r: 1.6, life: 0.25, light: i % 3 === 0 }); S.fx.ring(q, { r1: 3.5, color, life: 0.3 });
            S.fx.burst(q, { n: 20, color: rockColor || 0x5a4a40, kind: 'smoke', speed: 8, up: 1, life: 0.8, size: 0.4, grav: 20, world: true });
            A.hurtCircle(p[0], p[1], 2.8, 110, { up: 5 }, inst, 'r' + i); if (i % 2 === 0) A.sfx('boom', { g: 0.35, rate: 1.4, len: 0.5 });
          }
          if (t >= t0 + 0.75 && t < t0 + 1.1) { const k = (t - t0 - 0.75) / 0.35; S.fx.spark(new V3(p[0] - 6 * (1 - k), 18 * (1 - k), p[1] - 4 * (1 - k)), new V3(0, -2, 0), { color, life: 0.15, size: 1.6, world: true }); }
        });
      } };
      return inst;
    };
    b.rainPts = function (n, spread) {
      const pts = []; const ps = A.players();
      for (let i = 0; i < n; i++) { const t = ps[i % ps.length] || { pos: b.pos }; const a = b.rng() * 6.283, r = Math.sqrt(b.rng()) * spread; let x = t.pos.x + Math.cos(a) * r, z = t.pos.z + Math.sin(a) * r; const d = Math.hypot(x, z), R = A.arenaR; if (d > R) { x *= R / d; z *= R / d; } pts.push([+x.toFixed(2), +z.toFixed(2)]); }
      return pts;
    };
    b.faceToward = (dt, p, rate) => { const want = Math.atan2(p.x - b.pos.x, p.z - b.pos.z); b.yaw += BR.angDiff(b.yaw, want) * Math.min(1, dt * (rate || 2)); };
    return b;
  }

  /* =====================================================================
     1. LE COLOSSE
     ===================================================================== */
  function titan(S, o) {
    const b = base(S, o, 'titan'), A = b.A, accent = 0xff5a14;
    const K = kit('titan', accent, '#5a4a44', S); b.rockMat = K.rockMat; b.glowMat = K.glowMat;
    b.size = 12; b.postureMax = 140;
    const root = new THREE.Group(); root.scale.setScalar(0.85); b.group.add(root);
    // modèle Blender (outils/blender-boss-a.py) : géant de basalte, fissures de lave (lueur douce couleur du stade),
    // coeur de magma, masque (photo) cerclé de lave ; repli : anciennes pièces
    const MK = window.BOSS_A_KIT ? window.BOSS_A_KIT(b, 'boss_titan') : null;
    const get = n => (MK && MK.get(n)) || K.get(n);
    const J = {};
    J.pelvis = new THREE.Group(); J.pelvis.position.y = 5.35; root.add(J.pelvis); J.pelvis.add(get('pelvis'));
    J.torso = new THREE.Group(); J.torso.position.y = 0.6; J.pelvis.add(J.torso); J.torso.add(get('torso'));
    J.head = new THREE.Group(); J.head.position.y = 4.5; J.torso.add(J.head); const headM = get('head'); J.head.add(headM);
    const faceAnchor = MK && MK.node(headM, 'face');
    const face = faceMesh(b.faces[0], faceAnchor ? 2.25 : 3.6, accent); if (faceAnchor) { MK.round(face); faceAnchor.add(face); } else { face.position.set(0, 1.75, 0.55); J.head.add(face); } b.faceMeshes.push(face);
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'L' : 'R';
      // pièces Blender modélisées côté droit : toutes reflétées à gauche
      const mir = o => { if (s < 0 && (MK || /arm_u|leg_l/.test(o.userData.k))) o.scale.x = -1; return o; };
      const g2 = n => { const o = get(n); o.userData.k = n; return mir(o); };
      const sh = new THREE.Group(); sh.position.set(s * 3.05, 3.75, 0); J.torso.add(sh); sh.add(g2('arm_u'));
      const el = new THREE.Group(); el.position.y = -3.2; sh.add(el); el.add(g2('arm_f'));
      const wr = new THREE.Group(); wr.position.y = -3.1; el.add(wr); wr.add(g2('fist'));
      const hip = new THREE.Group(); hip.position.set(s * 1.25, -0.1, 0); J.pelvis.add(hip); hip.add(g2('leg_u'));
      const kn = new THREE.Group(); kn.position.y = -2.5; hip.add(kn); kn.add(g2('leg_l'));
      J['sh' + k] = sh; J['el' + k] = el; J['wr' + k] = wr; J['hip' + k] = hip; J['kn' + k] = kn;
    }
    const RM = MK && MK.mats.rock ? MK.mats.rock : K.rockMat, RD = MK && MK.mats.rock_d ? MK.mats.rock_d : K.rockMat;
    if (MK && MK.mats.rock) b.rockMat = MK.mats.rock;
    // coeur de magma visible dans la poitrine
    const core = new THREE.PointLight(accent, 3, 18, 2); core.position.set(0, 2.4, MK ? 2.6 : 1.6); J.torso.add(core);
    // ---- pièces d'évolution ----
    // stade 1 : épaulières et plastron de roche (ils éclatent au stade 3)
    const plates = [];
    if (MK) {
      for (const s of [-1, 1]) { const pl = MK.get('pauldron'); pl.position.set(s * 0.4, 1.5, 0); if (s < 0) pl.scale.x = -1; J['sh' + (s < 0 ? 'L' : 'R')].add(pl); plates.push(pl); }
      const cp = MK.get('chestplate'); cp.position.set(0, 2.65, 2.2); J.torso.add(cp); plates.push(cp);
    } else {
      for (const s of [-1, 1]) { const k = s < 0 ? 'L' : 'R'; const pl = H.mesh(b, H.lumpy(1, 1, 0.35, 11 + s, 1.7, 0.85, 1.6), K.rockMat, { p: [s * 0.35, 0.55, 0], r: [0, 0, s * -0.25] }); J['sh' + k].add(pl); plates.push(pl); }
      { const pl = H.mesh(b, H.lumpy(1, 1, 0.3, 21, 2.0, 1.3, 0.7), K.rockMat, { p: [0, 2.7, 1.35] }); J.torso.add(pl); plates.push(pl); }
    }
    // stade 2 : pics de roche incandescents sur les épaules et le dos
    const spikeG = new THREE.ConeGeometry(0.42, 2.2, 5); b.ownGeos.push(spikeG);
    const spikes = [];
    const addSpike = (parent, p, r, sc, d) => { const m = H.mesh(b, spikeG, RD, { p, r, s: sc }); const tip = H.mesh(b, new THREE.ConeGeometry(0.16, 0.7, 5), K.glowMat, { p: [0, 0.95, 0] }); m.add(tip); parent.add(m); spikes.push([m, d]); m.visible = false; };
    const spY = MK ? 1.3 : 0, spZ = MK ? -1.0 : 0;
    for (const s of [-1, 1]) { const k = s < 0 ? 'L' : 'R'; for (let i = 0; i < 3; i++) addSpike(J['sh' + k], [s * (0.2 + i * 0.45), 1.15 - i * 0.12 + spY, -0.3 + i * 0.25], [-0.3 + i * 0.25, 0, s * (-0.5 - i * 0.2)], 0.8 + i * 0.15, i * 0.12); }
    for (let i = 0; i < 4; i++) addSpike(J.torso, [0, 1.2 + i * 1.0, -1.3 + spZ], [-1.0, 0, 0], 1.2 - i * 0.15, 0.3 + i * 0.1);
    // stade 3 : couronne d'éclats de magma autour de la tête, cœurs incandescents aux épaules
    const crown = [], crY = MK ? 2.8 : 3.6, crR = MK ? 1.9 : 2.1;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const m = H.mesh(b, new THREE.OctahedronGeometry(0.45, 0), K.glowMat, { p: [Math.sin(a) * crR, crY + Math.cos(i * 1.7) * 0.25, Math.cos(a) * 1.4 - (MK ? 0.6 : 0.2)], s: [0.6, 1.8, 0.6] }); J.head.add(m); m.visible = false; crown.push(m); }
    const cores = [-1, 1].map(s => { const m = H.mesh(b, new THREE.IcosahedronGeometry(0.75, 1), K.glowMat, { p: MK ? [s * 0.45, 1.45, 0] : [s * 0.35, 0.6, 0] }); J['sh' + (s < 0 ? 'L' : 'R')].add(m); m.visible = false; return m; });
    b.onStage = function (s) {
      if (s === 2) { spikes.forEach(([m, d]) => H.grow(b, m, 1.0 + d)); }
      if (s === 3) { plates.forEach((p, i) => A.later(1.0 + i * 0.12, () => H.breakOff(b, p, 9))); cores.forEach(m => H.grow(b, m, 1.1)); crown.forEach((m, i) => H.grow(b, m, 1.2 + i * 0.06)); }
    };
    b.evoPose = t => { const c = ease(t / 0.8) * (1 - ease((t - 1.0) / 0.2)), up = ease((t - 0.95) / 0.25) * (1 - ease((t - 2.4) / 0.4)); return { py: 5.35 - 1.6 * c, tx: 0.6 * c - 0.35 * up, hx: -0.5 * up, knL: 1.2 * c, knR: 1.2 * c, hipL: -0.9 * c, hipR: -0.9 * c, shLx: -0.6 * c - 2.2 * up, shRx: -0.6 * c - 2.2 * up, shLz: 0.2 + 0.9 * up, shRz: -0.2 - 0.9 * up, elL: -0.4, elR: -0.4 }; };
    const part = (obj, off, r, weak) => { b.parts.push({ obj, off, r, weak: !!weak }); return b.parts.length - 1; };
    part(J.knL, new V3(0, -1.2, 0), 1.25); part(J.knR, new V3(0, -1.2, 0), 1.25);
    part(J.hipL, new V3(0, -1.3, 0), 1.3); part(J.hipR, new V3(0, -1.3, 0), 1.3);
    part(J.pelvis, new V3(0, 0, 0), 2.0); part(J.torso, new V3(0, 2.4, 0), 2.6);
    const HEAD = part(J.head, new V3(0, 1.7, 0), 2.1, true);
    const FL = part(J.wrL, new V3(0, -1.1, 0), 1.4), FR = part(J.wrR, new V3(0, -1.1, 0), 1.4);
    b.focus = () => b.partPos(HEAD);
    b.blockers = () => { if ((b.airY || 0) > 3) return []; const out = []; for (const k of ['L', 'R']) { const p = J['kn' + k].localToWorld(new V3(0, -2, 0.3)); out.push({ x: p.x, z: p.z, r: 1.6, h: 5 }); } out.push({ x: b.pos.x, z: b.pos.z, r: 1.4, h: 4 }); return out; };
    // pose : valeurs courantes et cibles
    const pose = { py: 5.35, tx: 0, ty: 0, hx: 0, shLx: 0, shLz: 0.15, shRx: 0, shRz: -0.15, elL: 0, elR: 0, hipL: 0, hipR: 0, knL: 0, knR: 0 };
    let want = Object.assign({}, pose), walkPh = 0, moving = 0;
    const titanSpring = H.springPose(pose);
    b.animate = function (dt) {
      root.position.set(b.vp.x, b.airY || 0, b.vp.z); root.rotation.y = b.vy; root.scale.setScalar(0.85 * b.sc);
      // pose de base : respiration + marche
      const br = Math.sin(b.t * 1.4);
      const w = { py: 5.35 + br * 0.05 - moving * Math.abs(Math.sin(walkPh)) * 0.2, tx: 0.08 + br * 0.02, ty: Math.sin(walkPh) * 0.08 * moving, hx: -0.05, shLx: -Math.sin(walkPh) * 0.35 * moving + br * 0.03, shLz: 0.18, shRx: Math.sin(walkPh) * 0.35 * moving + br * 0.03, shRz: -0.18, elL: -0.25, elR: -0.25,
        hipL: Math.sin(walkPh) * 0.42 * moving, hipR: -Math.sin(walkPh) * 0.42 * moving, knL: Math.max(0, -Math.cos(walkPh)) * 0.6 * moving, knR: Math.max(0, Math.cos(walkPh)) * 0.6 * moving };
      if (b.broken > 0) Object.assign(w, { py: 2.6, tx: 0.75, hx: 0.3, hipL: -1.2, hipR: -1.2, knL: 1.6, knR: 1.6, shLx: -0.5, shRx: -0.5, elL: -0.6, elR: -0.6 });
      for (const it of b.insts) if (it.pose) Object.assign(w, it.pose(it.t));
      want = w;
      titanSpring(want, dt, 10);
      J.pelvis.position.y = pose.py; J.torso.rotation.set(pose.tx, pose.ty, 0); J.head.rotation.x = pose.hx;
      // (signe de Z inversé : shLz > 0 / shRz < 0 écartent bien les bras vers l'extérieur ; avant, la toupie et le
      // balayage faisaient traverser le torse aux bras)
      J.shL.rotation.set(pose.shLx, 0, -pose.shLz); J.shR.rotation.set(pose.shRx, 0, -pose.shRz); J.elL.rotation.x = pose.elL; J.elR.rotation.x = pose.elR;
      if (MK) { MK.flash(b.flashT > 0); MK.glow(b.glowCol, (0.85 + 0.25 * Math.sin(b.t * 2.3) + (b.stage - 1) * 0.3) * (b.broken > 0 ? 1.6 : 1)); }
      J.hipL.rotation.x = pose.hipL; J.hipR.rotation.x = pose.hipR; J.knL.rotation.x = pose.knL; J.knR.rotation.x = pose.knR;
      moving = Math.max(0, moving - dt * 2);
      core.intensity = 2.5 + Math.sin(b.t * 5) * 0.8 + (b.phase > 1 ? 2 : 0);
      if (Math.random() < dt * 6) S.fx.spark(b.partPos(5).add(new V3(rnd(Math.random, -2, 2), rnd(Math.random, -2, 2), rnd(Math.random, -1, 1))), new V3(0, 2, 0), { color: accent, life: 0.8, size: 0.4, size1: 0.05, world: true });
    };
    b.move = function (dt) {
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z);
      b.faceToward(dt, tp, 1.4);
      if (d > 8) { const sp = 4.4 * b.speed; b.pos.x += Math.sin(b.yaw) * sp * dt; b.pos.z += Math.cos(b.yaw) * sp * dt; moving = 1; walkPh += dt * 3.2 * b.speed; if (Math.floor(walkPh / Math.PI) !== Math.floor((walkPh - dt * 3.2 * b.speed) / Math.PI)) { A.sfx('stomp', { g: 0.5 }); A.shake(0.12); } }
      const r = Math.hypot(b.pos.x, b.pos.z); if (r > 22) { b.pos.x *= 22 / r; b.pos.z *= 22 / r; }
    };
    b.choose = function () {
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z), sg = b.stage, n = b.nPlayers();
      const L = [];
      if (b.behind(13)) L.push(['spin', 5, 1.4, null, ['slam', null, 0.3, 1]]);
      if (d < 11) L.push(['combo', 4, 1.3], ['slam', 2, 1.4, null, ['sweep', null, 0.25, 1]], ['sweep', 1.5, 1.6, null, b.rng() < 0.5 ? ['slam', null, 0.2, 1] : null], ['spin', 1.2, 1.6], ['quake', 1.5, 2.0]);
      else L.push(['charge', 3, 1.3, null, ['quake', null, 0.3, 1]], ['fissure', 2.5, 1.9, { pts: b.targetsPts(3) }], ['beam', 2, 2.1], ['leap', 1.5, 1.4, null, ['combo', null, 0.3, 1]]);
      if (n > 1) L.push(['fissure', 2.5, 2.0, { pts: b.targetsPts(3) }], ['rocks', 1.5, 2.2, { pts: b.rainPts(8 + n * 4, 8) }]);
      if (sg >= 2) L.push(['meteor', 2.2, 1.8, { pts: b.rainPts(12 + n * 4 + (sg - 2) * 6, 9) }], ['eruption', 1.8, 1.8], ['leap', 2, 1.2, null, ['combo', null, 0.3, 1]], ['charge', 1.6, 1.1, null, ['charge', null, 0.25, sg >= 3 ? 2 : 1]]);
      if (sg >= 3 && b.t - (b.lastCata || -99) > 26) L.push(['cataclysm', 4, 1.6]);
      const x = b.weighted(L); if (x[0] === 'cataclysm') b.lastCata = b.t;
      return [x[0], x[2], x[3], x[4]];
    };
    // --- ruée d'épaule à travers l'arène ---
    b.attacks.charge = (P) => {
      const p0 = new V3(P.x, 0, P.z), dir = new V3(P.tx - P.x, 0, P.tz - P.z); const dist = Math.max(1, dir.length()); dir.normalize();
      const yaw = Math.atan2(dir.x, dir.z); let len = Math.min(30, dist + 7);
      for (let k = 0; k < 40 && p0.clone().addScaledVector(dir, len).length() > 23; k++) len -= 1;
      len = Math.max(6, len); const v = 24 * b.speed, T = len / v;
      S.fx.decal(p0, 'line', { len, width: 6.5, yaw, color: 0xff3020, dur: 0.8 });
      A.sfx('roar', { rate: 1.6, g: 0.7 });
      const inst = { dur: 0.8 + T + 0.6, main: true, ownsMove: true,
        pose: t => t < 0.8 ? { tx: 0.55 * ease(t / 0.8), py: 4.5, knL: 0.9, knR: 0.9, hipL: -0.7, hipR: -0.7, shLx: 0.7, shRx: 0.7, shLz: 0.5, shRz: -0.5 }
          : t < 0.8 + T ? { tx: 0.65, py: 5.0, hipL: Math.sin(t * 22) * 0.9, hipR: -Math.sin(t * 22) * 0.9, knL: 0.6, knR: 0.6, shLx: 0.9, shRx: 0.9, shLz: 0.6, shRz: -0.6 } : { tx: 0.2 },
        update(t) {
          b.yaw = yaw;
          if (t < 0.8) return;
          const k = Math.min(1, (t - 0.8) / T); b.pos.copy(p0).addScaledVector(dir, len * k);
          if (k < 1) {
            A.hurtCircle(b.pos.x, b.pos.z, 3.8, 170, { kb: 16, up: 7 }, inst, 'c');
            if (Math.random() < 0.6) S.fx.burst(b.pos.clone().setY(0.3), { n: 4, color: 0x4a3a30, kind: 'smoke', speed: 5, up: 0.6, life: 0.9, size: 1.4, size1: 2.6, world: true, alpha: 0.7 });
            const st = Math.floor(t * 7); if (st !== inst.st) { inst.st = st; A.sfx('stomp', { g: 0.6 }); A.shake(0.25); }
          } else if (!inst.e) { inst.e = 1; S.fx.ring(b.pos.clone(), { r1: 9, color: accent, life: 0.45 }); S.fx.flash(b.pos.clone().setY(1), { color: accent, r: 3, life: 0.3 }); A.sfx('boom', { g: 0.8 }); A.shake(0.6); A.hurtCircle(b.pos.x, b.pos.z, 6, 120, { kb: 10, up: 6 }, inst, 'e'); }
        } };
      return inst;
    };
    // --- fissures de magma qui filent vers chaque joueur ---
    b.attacks.fissure = (P) => {
      const p0 = new V3(P.x, 0, P.z), lines = (P.pts || [[P.tx, P.tz]]).map(q => { const d = new V3(q[0] - P.x, 0, q[1] - P.z); const L = Math.min(30, d.length() + 6); return { dir: d.normalize(), L, yaw: Math.atan2(d.x, d.z) }; });
      lines.forEach(l => S.fx.decal(p0.clone().addScaledVector(l.dir, 3), 'line', { len: l.L, width: 3.2, yaw: l.yaw, color: 0xff3020, dur: 1.0, hold: 0.9 }));
      A.sfx('charge', { len: 1, g: 0.6 });
      const inst = { dur: 2.6, main: true, ownsMove: true,
        pose: t => { const k = ease(t / 0.9), s2 = ease((t - 0.95) / 0.12); return { shLx: -2.7 * k * (1 - s2) - 0.9 * s2, shRx: -2.7 * k * (1 - s2) - 0.9 * s2, py: 5.35 - 1.6 * s2, tx: 0.65 * s2, knL: 1 * s2, knR: 1 * s2, hipL: -0.8 * s2, hipR: -0.8 * s2 }; },
        update(t) {
          if (t >= 1.0 && !inst.s) { inst.s = 1; A.sfx('stomp'); A.sfx('boom', { g: 0.7 }); A.shake(0.7); S.fx.ring(p0, { r1: 7, color: accent, life: 0.4 }); }
          if (t < 1.0) return;
          lines.forEach((l, li) => {
            const n = Math.floor(l.L / 1.3);
            for (let i = 0; i < n; i++) {
              const ti = 1.0 + i * 0.045; if (t < ti || inst['e' + li + '_' + i]) continue;
              inst['e' + li + '_' + i] = 1;
              const q = p0.clone().addScaledVector(l.dir, 3 + i * 1.3);
              S.fx.burst(q.clone().setY(0.2), { n: 8, color: accent, speed: 7, up: 1.4, life: 0.5, world: true });
              if (i % 2 === 0) S.fx.pillar(q, { color: accent, r: 0.7, h: 3.5, life: 0.4, world: true });
              if (i % 3 === 0) S.fx.burst(q.clone().setY(0.2), { n: 6, color: 0x4a3a30, kind: 'smoke', speed: 6, up: 1.2, life: 0.8, size: 0.4, grav: 20, world: true });
              A.hurtCircle(q.x, q.z, 1.7, 120, { up: 9, kb: 4 }, inst, 'f' + li);
            }
          });
        } };
      return inst;
    };
    // --- toupie : bras tendus, deux tours complets (à sauter ou à fuir) ---
    b.attacks.spin = (P) => {
      const p0 = new V3(P.x, 0, P.z);
      S.fx.decal(p0, 'circle', { r: 11, color: 0xff3020, dur: 0.75, hold: 1.5 });
      A.sfx('roar', { rate: 2, g: 0.5 });
      const inst = { dur: 2.6, main: true, ownsMove: true,
        pose: t => { const k = ease(t / 0.7); const sp = t > 0.75 && t < 2.2 ? (t - 0.75) / 1.45 * Math.PI * 4 : t >= 2.2 ? Math.PI * 4 : 0; return { shLz: 0.2 + 1.3 * k, shRz: -0.2 - 1.3 * k, elL: -0.1, elR: -0.1, py: 5.1 }; },
        update(t) {
          if (t > 0.75 && t < 2.2) {
            const a = P.yw + (t - 0.75) / 1.45 * Math.PI * 4;
            b.yaw = a;
            if (Math.floor(t * 4) !== inst.q) { inst.q = Math.floor(t * 4); A.sfx('swingBig', { rate: 0.4, g: 1.2 }); S.fx.slash(p0.clone().setY(2.2), a, { r: 11, arc: 2.4, color: accent, life: 0.35, inner: 0.7, world: true }); A.shake(0.2); }
            A.hurtCircle(P.x, P.z, 11, 140, { air: true, kb: 14, up: 5, h: 3.5 }, inst, 's' + Math.floor(t * 1.5));
          }
        } };
      return inst;
    };
    const fwdOf = P => new V3(Math.sin(P.yw), 0, Math.cos(P.yw)), rightOf = P => new V3(-Math.cos(P.yw), 0, Math.sin(P.yw));
    // --- poing écrasant ---
    b.attacks.slam = (P) => {
      const F = fwdOf(P), Rt = rightOf(P), side = (P.s % 2) ? 1 : -1;
      const c = new V3(P.x, 0, P.z).addScaledVector(F, 4.2).addScaledVector(Rt, -side * 2.5);
      S.fx.decal(c, 'circle', { r: 5.5, color: 0xff3020, dur: 1.15 }); A.sfx('charge', { len: 1.0, g: 0.6 });
      const sk = side > 0 ? 'R' : 'L', F_ID = side > 0 ? FR : FL;
      const inst = { dur: 2.4, main: true, ownsMove: true,
        pose: t => { const k = ease(t / 1.0), s2 = ease((t - 1.05) / 0.15), up = 1 - ease((t - 2.0) / 0.4); const o2 = { py: 5.35 - 1.7 * s2 * up, tx: 0.1 + 0.6 * s2 * up - 0.15 * k * (1 - s2) };
          o2['sh' + sk + 'x'] = (-2.8 * k * (1 - s2) - 1.0 * s2) * up + (1 - up) * 0; o2['el' + sk] = -0.6 * k * (1 - s2); o2.knL = o2.knR = 1.1 * s2 * up; o2.hipL = o2.hipR = -0.9 * s2 * up; return o2; },
        update(t) {
          if (t > 1.15 && !inst.hit) {
            inst.hit = 1; b.parts[F_ID].weak = true;
            S.fx.flash(c.clone().setY(0.5), { color: accent, r: 3, life: 0.35, intensity: 7 }); S.fx.ring(c, { r1: 9, color: accent, life: 0.5 }); S.fx.ring(c, { r1: 5.5, color: 0xffffff, life: 0.3, width: 0.4 });
            S.fx.burst(c.clone().setY(0.3), { n: 60, color: 0x6a5a50, kind: 'smoke', speed: 14, up: 1, life: 1, size: 0.5, grav: 22, world: true });
            S.fx.burst(c.clone().setY(0.3), { n: 30, color: 0x2a2220, kind: 'smoke', speed: 6, up: 0.3, life: 1.4, size: 2, size1: 4, grav: -0.5, world: true, alpha: 0.6 });
            A.sfx('stomp'); A.sfx('boom', { g: 0.8 }); A.shake(0.8);
            A.hurtCircle(c.x, c.z, 5.5, 180, { up: 7, kb: 9 }, inst, 'slam');
          }
          if (t > 2.1) b.parts[F_ID].weak = false;
        }, cancel() { b.parts[F_ID].weak = false; } };
      return inst;
    };
    // --- balayage ---
    b.attacks.sweep = (P) => {
      const p0 = new V3(P.x, 0, P.z);
      S.fx.decal(p0, 'sector', { r: 13, arc: 2.6, yaw: P.yw, color: 0xff3020, dur: 1.0 });
      A.sfx('swingBig', { rate: 0.4, g: 1.2 });
      const inst = { dur: 2.0, main: true, ownsMove: true,
        pose: t => { const k = ease(t / 0.9), s2 = ease((t - 1.0) / 0.35); return { ty: 0.9 * k - 1.8 * s2, shRz: -0.2 - 1.2 * k + 0.0 * s2, shRx: -1.2 * k, elR: -0.2, py: 5.0, knL: 0.4, knR: 0.4, hipL: -0.3, hipR: -0.3 }; },
        update(t) {
          if (t > 1.0 && t < 1.4) {
            if (!inst.fx) { inst.fx = 1; S.fx.slash(p0.clone().setY(1.2), P.yw, { r: 13, arc: 2.6, tilt: 0, color: accent, life: 0.45, inner: 0.75, flip: true, world: true }); A.sfx('swingBig', { rate: 0.3, g: 1.5 }); A.shake(0.4); }
            A.hurtSector(P.x, P.z, P.yw, 13, 2.6, 150, { air: true, kb: 12, up: 4 }, inst, 'sw');
          }
        } };
      return inst;
    };
    // --- onde sismique : anneaux à sauter ---
    b.attacks.quake = (P) => {
      const sg = P.sg || 1, p0 = new V3(P.x, 0, P.z), n = sg >= 3 ? 6 : sg >= 2 ? 5 : 3;
      const gap = sg >= 3 ? 0.7 : sg >= 2 ? 0.85 : 1.0;
      const inst = { dur: 1.0 + n * gap + 3.2, main: true, ownsMove: true,
        pose: t => { const k = ease(t / 0.8), s2 = ease((t - 0.85) / 0.12); return { hipR: -1.1 * k * (1 - s2), knR: 1.2 * k * (1 - s2), py: 5.35 - 0.6 * s2, shLx: -0.8 * k, shRx: -0.8 * k }; },
        update(t) {
          for (let i = 0; i < n; i++) {
            const t0 = 0.9 + i * gap;
            if (t >= t0 && !inst['r' + i]) { inst['r' + i] = 1; S.fx.ring(p0, { r0: 1, r1: 1 + 11 * 3.2, color: accent, life: 3.2, linear: true, band: 1.4, world: true }); A.sfx('stomp', { g: 0.6 }); A.shake(0.35); if (i === 0) S.fx.burst(p0.clone().setY(0.3), { n: 50, color: 0x6a5a50, kind: 'smoke', speed: 12, up: 0.6, life: 1, size: 0.5, grav: 22, world: true }); }
            const r = (t - t0) * 11 + 1;
            if (t >= t0 && r < 36) A.hurtRing(P.x, P.z, r - 0.5, r + 0.5, 110, { kb: 6, up: 5 }, inst, 'q' + i);
          }
        } };
      return inst;
    };
    // --- rayon des yeux qui balaie le sol ---
    b.attacks.beam = (P) => {
      const p0 = new V3(P.x, 0, P.z), d = BR.clamp(Math.hypot(P.tx - P.x, P.tz - P.z), 8, 26), yw0 = Math.atan2(P.tx - P.x, P.tz - P.z);
      const from = -0.95, to = 0.95, beams = [];
      S.fx.decal(p0, 'sector', { r: d + 3, arc: 1.9, yaw: yw0, color: 0xff3020, dur: 1.3, hold: 2.4 });
      A.sfx('charge', { len: 1.3, g: 1 });
      const snd = { s: null };
      const inst = { dur: 3.9, main: true, ownsMove: true,
        pose: t => ({ hx: t < 1.3 ? -0.25 * ease(t / 1.3) : 0.25, tx: 0.05 }),
        update(t, dt) {
          b.yaw = P.yw + BR.angDiff(P.yw, yw0) * Math.min(1, t * 2);
          face.userData.U.rage.value = 1;
          const eyeW = [0, 1].map(k => face.localToWorld(face.userData.eye(k)));
          if (t < 1.3) { if (Math.random() < 0.5) eyeW.forEach(e => S.fx.spark(e, new V3(rnd(Math.random, -2, 2), rnd(Math.random, -2, 2), rnd(Math.random, -2, 2)), { color: accent, life: 0.3, size: 0.8, world: true })); return; }
          if (!beams.length) { beams.push(S.fx.beam({ color: accent, width: 0.7, world: true }), S.fx.beam({ color: accent, width: 0.7, world: true })); snd.s = BR.Audio.loopFx('beam'); A.shake(0.4); }
          const k = ease((t - 1.3) / 2.4), a = yw0 + from + (to - from) * k;
          const end = new V3(P.x + Math.sin(a) * d, 0.1, P.z + Math.cos(a) * d);
          beams.forEach((bm, i) => bm.set(eyeW[i], end, 0.6 + Math.sin(t * 50) * 0.08));
          S.fx.burst(end, { n: 4, color: accent, speed: 8, up: 0.8, life: 0.4, grav: 14, world: true });
          if (Math.random() < 0.6) S.fx.spark(end.clone().add(new V3(rnd(Math.random, -0.5, 0.5), 0, rnd(Math.random, -0.5, 0.5))), new V3(0, 1, 0), { color: 0x2a1a10, kind: 'smoke', life: 1.2, size: 1, size1: 2, world: true, alpha: 0.6 });
          // le rayon fend le sol : on le saute ou on l'esquive
          const bucket = Math.floor(t * 5);
          A.hurtLine(P.x, P.z, a, d + 0.5, 2.0, 45, { air: true, kb: 3 }, inst, 'b' + bucket);
        },
        end() { beams.forEach(x => x.kill()); if (snd.s) snd.s.stop(); }, cancel() { this.end(); } };
      return inst;
    };
    // --- bond écrasant (phase 2) ---
    b.attacks.leap = (P) => {
      const p0 = new V3(P.x, 0, P.z), p1 = new V3(P.tx, 0, P.tz);
      const r = Math.hypot(p1.x, p1.z); if (r > 20) p1.multiplyScalar(20 / r);
      S.fx.decal(p1, 'circle', { r: 8, color: 0xff3020, dur: 1.55 });
      A.sfx('roar', { rate: 1.3, g: 0.8 });
      const inst = { dur: 2.6, main: true, ownsMove: true,
        pose: t => { const c = t < 0.55 ? ease(t / 0.5) : t < 1.55 ? 0 : 1 - ease((t - 1.6) / 0.6); return { py: 5.35 - 2 * c, knL: 1.5 * c, knR: 1.5 * c, hipL: -1.2 * c, hipR: -1.2 * c, tx: 0.5 * c, shLx: t > 0.55 && t < 1.55 ? -2.6 : -0.3, shRx: t > 0.55 && t < 1.55 ? -2.6 : -0.3 }; },
        update(t) {
          if (t >= 0.55 && t < 1.55) { const k = (t - 0.55) / 1.0; b.pos.lerpVectors(p0, p1, ease(k)); b.airY = Math.sin(k * Math.PI) * 9; b.yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z); }
          else b.airY = 0;
          if (t >= 1.55 && !inst.hit) {
            inst.hit = 1; b.pos.copy(p1);
            S.fx.flash(p1.clone().setY(1), { color: accent, r: 5, life: 0.4, intensity: 8 }); S.fx.ring(p1, { r1: 14, color: accent, life: 0.6 }); S.fx.ring(p1, { r1: 8, color: 0xffffff, life: 0.4, width: 0.4 });
            S.fx.burst(p1.clone().setY(0.3), { n: 80, color: 0x6a5a50, kind: 'smoke', speed: 16, up: 1, life: 1.1, size: 0.5, grav: 22, world: true });
            A.sfx('boom', { len: 1.4 }); A.sfx('stomp'); A.shake(1.0);
            A.hurtCircle(p1.x, p1.z, 8, 200, { up: 9, kb: 12 }, inst, 'leap');
          }
        }, end() { b.airY = 0; }, cancel() { b.airY = 0; } };
      return inst;
    };
    b.attacks.rocks = (P) => { A.sfx('roar', { rate: 1.5, g: 0.6 }); const r = b.rain(P, 2.8, accent, 0, 0x5a4a40); r.main = true; r.pose = t => ({ shLx: -2.4, shRx: -2.4, hx: -0.4 }); return r; };

    /* ---------- nouvelles attaques du Colosse ---------- */
    // combo de 4 coups : poing gauche, poing droit, balayage (parfois retardé = feinte), double marteau + séisme
    b.attacks.combo = (P, r) => {
      const feint = r() < 0.5 ? 0.55 : 0, sg = P.sg || 1, strikes = [];
      let t = 0.85; strikes.push({ t, k: 'slam', s: -1, w: 0.8 }); t += 0.8; strikes.push({ t, k: 'slam', s: 1, w: 0.65 });
      t += 0.95 + feint; strikes.push({ t, k: 'sweep', w: 0.75 + feint }); t += 1.05; strikes.push({ t, k: 'hammer', w: 0.9 });
      if (sg >= 3) { t += 0.9; strikes.push({ t, k: 'slam', s: r() < 0.5 ? -1 : 1, w: 0.6 }); }
      const tg = () => { const p = A.player(P.tg); return p && p.alive ? p.pos : new V3(P.tx, 0, P.tz); };
      A.sfx('roar', { rate: 1.4, g: 0.6 });
      const inst = { dur: t + 1.1, main: true, ownsMove: true,
        pose: tt => {
          let cur = strikes[strikes.length - 1]; for (const s of strikes) if (tt < s.t + 0.35) { cur = s; break; }
          const k = ease((tt - (cur.t - cur.w)) / (cur.w * 0.85)), s2 = ease((tt - cur.t) / 0.1), rec = 1 - ease((tt - cur.t - 0.25) / 0.3);
          if (cur.k === 'sweep') return { ty: (0.9 * k - 1.9 * s2) * (tt < cur.t + 0.5 ? 1 : rec), shRz: -0.2 - 1.2 * k, shRx: -1.2 * k, py: 5.0, knL: 0.4, knR: 0.4, hipL: -0.3, hipR: -0.3 };
          if (cur.k === 'hammer') { const a = (-2.9 * k * (1 - s2) - 0.9 * s2) * Math.max(rec, 0.2); return { shLx: a, shRx: a, shLz: 0.1, shRz: -0.1, py: 5.35 - 1.8 * s2 * rec, tx: 0.7 * s2 * rec - 0.2 * k * (1 - s2), knL: 1.1 * s2 * rec, knR: 1.1 * s2 * rec, hipL: -0.9 * s2 * rec, hipR: -0.9 * s2 * rec }; }
          const sk = cur.s > 0 ? 'R' : 'L', o2 = { py: 5.35 - 1.4 * s2 * rec, tx: 0.1 + 0.55 * s2 * rec, ty: cur.s * 0.3 * k };
          o2['sh' + sk + 'x'] = (-2.8 * k * (1 - s2) - 1.0 * s2) * Math.max(rec, 0.15); o2['el' + sk] = -0.6 * k * (1 - s2); o2.knL = o2.knR = 0.9 * s2 * rec; o2.hipL = o2.hipR = -0.7 * s2 * rec; return o2;
        },
        update(tt, dt) {
          for (const [i, s] of strikes.entries()) {
            // l'élan : il se tourne vers sa cible pendant la préparation, puis fige sa visée
            if (tt >= s.t - s.w && tt < s.t - 0.25) b.faceToward(dt, tg(), 5);
            if (tt >= s.t - s.w && !s.d) {
              s.d = 1; const F = new V3(Math.sin(b.yaw), 0, Math.cos(b.yaw)), Rt = new V3(-Math.cos(b.yaw), 0, Math.sin(b.yaw));
              if (s.k === 'sweep') { s.yaw = b.yaw; S.fx.decal(b.pos, 'sector', { r: 13, arc: 2.6, yaw: s.yaw, color: 0xff3020, dur: s.w }); A.sfx('swingBig', { rate: 0.4, g: 1 }); }
              else { const c = b.pos.clone().addScaledVector(F, s.k === 'hammer' ? 5 : 4.3).addScaledVector(Rt, s.k === 'hammer' ? 0 : -(s.s || 0) * 2.3); s.c = c; S.fx.decal(c, 'circle', { r: s.k === 'hammer' ? 6.5 : 5, color: 0xff3020, dur: s.w }); A.sfx('charge', { len: s.w, g: 0.5 }); }
            }
            if (tt >= s.t && !s.h) {
              s.h = 1;
              if (s.k === 'sweep') { S.fx.slash(b.pos.clone().setY(1.2), s.yaw, { r: 13, arc: 2.6, color: accent, life: 0.45, inner: 0.75, flip: true, world: true }); A.sfx('swingBig', { rate: 0.3, g: 1.5 }); A.shake(0.4); A.hurtSector(b.pos.x, b.pos.z, s.yaw, 13, 2.6, 140, { air: true, kb: 12, up: 4, h: 3.5 }, inst, 'c' + i); }
              else {
                H.blast(b, inst, 'c' + i, s.c.x, s.c.z, s.k === 'hammer' ? 6.5 : 5, s.k === 'hammer' ? 190 : 150, accent, { g: 0.8, rate: 1, shake: 0.6, smoke: 0x6a5a50, light: true });
                A.sfx('stomp');
                if (s.k === 'hammer') { H.wave(b, s.c.x, s.c.z, { r0: 4, rMax: 34, dmg: 100, color: accent }); if (sg >= 2) A.later(0.45, () => H.wave(b, s.c.x, s.c.z, { r0: 4, rMax: 34, dmg: 100, color: accent })); }
              }
            }
          }
        } };
      return inst;
    };
    // pluie de météores en spirale autour des joueurs (stade 2+) : les impacts se chevauchent
    b.attacks.meteor = (P, r) => {
      const pts = P.pts || [], p0 = new V3(P.x, 0, P.z);
      A.sfx('roar', { rate: 1.1, g: 0.8 }); A.sfx('charge', { len: 1.2, g: 0.8 });
      const orb = S.fx.flash(p0.clone().setY(9), { color: accent, r: 2.5, life: 1.2, intensity: 6 });
      const inst = { dur: 1.3 + pts.length * 0.085 + 1.4, main: true, ownsMove: true,
        pose: t => { const k = ease(t / 0.7), s2 = ease((t - 1.0) / 0.2); return { shLx: -2.9 * k + 1.6 * s2, shRx: -2.9 * k + 1.6 * s2, shLz: 0.4 * k, shRz: -0.4 * k, hx: -0.4 * k, tx: -0.15 * k + 0.3 * s2 }; },
        update(t) {
          if (t < 1.1 && Math.random() < 0.7) S.fx.spark(p0.clone().add(new V3(rnd(Math.random, -2, 2), 9 + t * 8, rnd(Math.random, -2, 2))), new V3(0, 14, 0), { color: accent, life: 0.6, size: 1.2, world: true });
          pts.forEach((q, i) => {
            const t0 = 1.1 + i * 0.085;
            if (t >= t0 && !inst['d' + i]) { inst['d' + i] = 1; S.fx.decal({ x: q[0], z: q[1] }, 'circle', { r: 3.2, color: 0xff3020, dur: 1.15 }); }
            if (t >= t0 + 0.75 && t < t0 + 1.15) { const k = (t - t0 - 0.75) / 0.4; S.fx.spark(new V3(q[0] + 8 * (1 - k), 26 * (1 - k), q[1] - 5 * (1 - k)), new V3(0, -3, 0), { color: accent, life: 0.12, size: 2.2, world: true }); }
            if (t >= t0 + 1.15 && !inst['h' + i]) { inst['h' + i] = 1; H.blast(b, inst, 'm' + i, q[0], q[1], 3.2, 120, accent, { quiet: i % 3 !== 0, shake: i % 2 ? 0 : 0.25, smoke: 0x5a4a40 }); }
          });
        } };
      return inst;
    };
    // geysers en damier : deux vagues alternées (trois au stade 3) — reste sur une case sûre au bon moment
    b.attacks.eruption = (P, r) => {
      const C = 6, R = A.arenaR, off = r() * C, waves = (P.sg || 1) >= 3 ? 3 : 2, cells = [];
      for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const x = i * C + off - C / 2, z = j * C + off - C / 2; if (Math.hypot(x, z) < R + 1) cells.push({ x, z, par: (i + j + 64) % 2 }); }
      const cellOf = (x, z) => [Math.round((x - off + C / 2) / C), Math.round((z - off + C / 2) / C)];
      A.sfx('roar', { rate: 0.9, g: 0.9 });
      const inst = { dur: 1.0 + waves * 1.2 + 1.0, main: true, ownsMove: true,
        pose: t => { const k = ease(t / 0.6); const s2 = ease((t - 0.8) / 0.15); return { shLx: -2.6 * k * (1 - s2) - 0.8 * s2, shRx: -2.6 * k * (1 - s2) - 0.8 * s2, py: 5.35 - 1.6 * s2, tx: 0.7 * s2, knL: s2, knR: s2, hipL: -0.8 * s2, hipR: -0.8 * s2 }; },
        update(t) {
          if (t >= 0.95 && !inst.s) { inst.s = 1; A.sfx('stomp'); A.shake(0.6); S.fx.ring(new V3(P.x, 0, P.z), { r1: 10, color: accent, life: 0.4 }); }
          for (let w = 0; w < waves; w++) {
            const par = w % 2, td = 0.15 + w * 1.2, th = td + 1.15;
            if (t >= td && !inst['d' + w]) { inst['d' + w] = 1; cells.forEach(c => { if (c.par === par) S.fx.decal({ x: c.x, z: c.z - C / 2 + 0.2 }, 'line', { len: C - 0.4, width: C - 0.4, yaw: 0, color: 0xff3020, dur: th - td, hold: 0.3 }); }); }
            if (t >= th && !inst['h' + w]) {
              inst['h' + w] = 1; A.sfx('boom', { g: 0.7, rate: 0.9 }); A.shake(0.5);
              cells.forEach((c, i) => { if (c.par !== par) return; const q = new V3(c.x, 0, c.z); if (i % 3 === 0) S.fx.pillar(q, { color: accent, r: 1.6, h: 9, life: 0.5, world: true }); S.fx.burst(q.clone().setY(0.4), { n: 7, color: i % 2 ? accent : 0xffd0a0, speed: 12, up: 3, life: 0.6, world: true }); });
            }
            if (t >= th && t < th + 0.3) { const f = A.me(), cc = cellOf(f.pos.x, f.pos.z); if (((cc[0] + cc[1] + 64) % 2 + 2) % 2 === par && f.pos.y < 5) A.hurtSphere(f.center(), 0.1, 130, { up: 9, kb: 3, kbFrom: f.pos.clone().add(new V3(0.01, 0, 0)) }, inst, 'e' + w); }
          }
        } };
      return inst;
    };
    // DANGER TOTAL (stade 3) : bond au centre, toute l'arène explose sauf trois cercles de calme qui tournent, puis séisme
    b.attacks.cataclysm = (P, r) => {
      const p0 = new V3(P.x, 0, P.z), c0 = new V3(0, 0, 0), a0 = r() * 6.283, safes = [0, 1, 2].map(i => ({ a: a0 + i * 2.094, d: 13 + r() * 9 })), SR = 3.4, T = 4.2;
      const pos = s => [Math.sin(s.a + inst.t * 0.22) * s.d, Math.cos(s.a + inst.t * 0.22) * s.d];
      A.voice(b.faces[0], 0.55, 1.4); A.sfx('roar', { g: 1.4, rate: 0.7 });
      BR.Arena.banner('DANGER TOTAL', 'Rejoins un cercle de calme !', 1.8, 'bad');
      let big = null; const marks = [];
      const inst = { dur: T + 4.2, main: true, ownsMove: true,
        pose: t => { const c = t < 0.4 ? ease(t / 0.4) : t < 1.4 ? 0 : 0; const up = ease((t - 1.6) / 0.6) * (1 - ease((t - T) / 0.15)); const sl = ease((t - T) / 0.12) * (1 - ease((t - T - 2.6) / 0.6));
          return { py: 5.35 - 2 * c - 1.8 * sl, knL: 1.5 * c + 1.4 * sl, knR: 1.5 * c + 1.4 * sl, hipL: -1.2 * c - 1.1 * sl, hipR: -1.2 * c - 1.1 * sl, shLx: -3 * up - 0.8 * sl, shRx: -3 * up - 0.8 * sl, shLz: 0.5 * up, shRz: -0.5 * up, hx: -0.5 * up + 0.4 * sl, tx: 0.75 * sl }; },
        update(t, dt) {
          if (t < 1.4) { const k = BR.clamp((t - 0.4) / 1.0, 0, 1); b.pos.lerpVectors(p0, c0, ease(k)); b.airY = Math.sin(k * Math.PI) * 10; if (t > 0.4) b.yaw += dt * 3; }
          else if (!inst.l) { inst.l = 1; b.airY = 0; b.pos.copy(c0); H.blast(b, inst, 'land', 0, 0, 8, 150, accent, { g: 1, rate: 0.8, shake: 0.9, light: true }); }
          if (t >= 1.4 && !big) {
            big = S.fx.decal(c0, 'circle', { r: A.arenaR + 1, color: 0x8a1408, dur: T - 1.4, hold: 0.2 });
            safes.forEach(s => { const q = pos(s); marks.push(S.fx.decal({ x: q[0], z: q[1] }, 'ring', { r: SR, inner: 0.82, color: 0x60ffb0, dur: T - 1.4, hold: 0.1, noWarn: true })); s.col = H.safeColumn(b, 0x60ffb0, SR, T - 1.3); s.col.set(q[0], q[1]); });
          }
          if (t >= 1.4 && t < T) { safes.forEach((s, i) => { const q = pos(s); if (marks[i]) marks[i].set({ x: q[0], z: q[1] }); if (s.col) s.col.set(q[0], q[1]); if (Math.random() < 0.5) S.fx.spark(new V3(q[0] + rnd(Math.random, -SR, SR), 0.2, q[1] + rnd(Math.random, -SR, SR)), new V3(0, 3, 0), { color: 0x80ffc0, life: 0.6, size: 0.4, world: true }); });
            if (Math.random() < 0.9) { const a = Math.random() * 6.283, d = Math.random() * A.arenaR; S.fx.burst(new V3(Math.sin(a) * d, 0.2, Math.cos(a) * d), { n: 2, color: accent, speed: 4, up: 2, life: 0.5, world: true }); }
            if (Math.floor(t * 3) !== inst.q) { inst.q = Math.floor(t * 3); A.shake(0.15); A.sfx('stomp', { g: 0.3 }); } }
          if (t >= T && !inst.x) {
            inst.x = 1; S.fx.flash(new V3(0, 3, 0), { color: 0xffffff, r: 14, life: 0.7, intensity: 12 }); S.fx.ring(c0, { r1: A.arenaR + 4, color: accent, life: 0.6, width: 0.5 });
            for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283, d = 6 + (i % 3) * 9; S.fx.pillar(new V3(Math.sin(a) * d, 0, Math.cos(a) * d), { color: accent, r: 1.8, h: 16, life: 0.7, world: true }); }
            BR.Audio.fx('boom', { len: 2.4 }); A.shake(1.2);
            const sp = safes.map(pos); if (!H.inSafe(A, sp, SR + 0.25)) H.hurtMe(A, 380, { up: 10, kb: 6, kbFrom: new V3(0, 0, 0), unblockable: true }, inst, 'cata');
          }
          for (let i = 0; i < 3; i++) if (t >= T + 0.6 + i * 0.7 && !inst['q' + i]) { inst['q' + i] = 1; H.wave(b, 0, 0, { r0: 3, rMax: 38, dmg: 110, color: accent }); A.sfx('stomp', { g: 0.7 }); A.shake(0.4); }
        }, end() { b.airY = 0; }, cancel() { b.airY = 0; } };
      return inst;
    };
    return b;
  }

  /* =====================================================================
     2. L'HYDRE
     ===================================================================== */
  function hydra(S, o) {
    const b = base(S, o, 'hydra'), A = b.A, accent = 0x40ff90, ACID = 0x7aff40;
    const K = kit('hydra', accent, '#3c5a48', S); b.rockMat = K.rockMat; b.glowMat = K.glowMat;
    b.size = 9; b.postureMax = 160; b.pos.set(0, 0, 0);
    // modèle Blender (outils/blender-boss-a.py) : corps de serpent-dragon enroulé dans la vase, têtes de dragon à
    // médaillon (photo), cous lisses générés à chaque image ; repli : anciennes pièces procédurales
    const MK = window.BOSS_A_KIT ? window.BOSS_A_KIT(b, 'boss_hydra') : null;
    const body = MK ? MK.get('body') : K.get('body'); b.group.add(body);
    if (MK && MK.mats.skin) b.rockMat = MK.mats.skin;
    const NSEG = 11, heads = [];
    // cou lisse (un seul maillage par cou, sommets recalculés à chaque image) : dos sombre, flancs verts, ventre pâle annelé
    const NR = 26, NS = 12, neckMat = MK ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.02 }) : null;
    if (neckMat) b.ownMats.push(neckMat);
    const mkNeck = () => {
      const g = new THREE.BufferGeometry(), pos = new Float32Array(NR * NS * 3), col = new Float32Array(NR * NS * 3), idx = [];
      for (let i = 0; i < NR - 1; i++) for (let k = 0; k < NS; k++) { const a0 = i * NS + k, a1 = i * NS + (k + 1) % NS, c1 = (i + 1) * NS + (k + 1) % NS, c0 = (i + 1) * NS + k; idx.push(a0, a1, c0, a1, c1, c0); }
      const cD = new THREE.Color('#1c4f2c').convertSRGBToLinear(), cF = new THREE.Color('#2f7d3e').convertSRGBToLinear(), cB = new THREE.Color('#d6dc8e').convertSRGBToLinear(), cB2 = new THREE.Color('#aab46a').convertSRGBToLinear(), c = new THREE.Color();
      for (let i = 0; i < NR; i++) for (let k = 0; k < NS; k++) {
        const ca = Math.cos(k / NS * Math.PI * 2);   // 1 = dos, -1 = ventre
        if (ca > 0.45) c.copy(cD).lerp(cF, (1 - ca) / 0.55 * 0.6); else if (ca > -0.45) c.copy(cF); else c.copy(i % 2 ? cB : cB2);
        col.set([c.r, c.g, c.b], (i * NS + k) * 3);
      }
      g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      b.ownGeos.push(g);
      const m = new THREE.Mesh(g, neckMat); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; b.group.add(m);
      return m;
    };
    for (let h = 0; h < 3; h++) {
      const a = h / 3 * Math.PI * 2 + Math.PI;
      // off : point d'attache du cou RELATIF au corps. La base est recalculée à chaque image depuis la position du
      // corps (avant, elle était absolue : si le corps bougeait sans passer par l'enfouissement, les têtes restaient ailleurs)
      const Hd = { i: h, ang: a, off: new V3(Math.sin(a) * 2.6, 3.4, Math.cos(a) * 2.6), base: new V3(), vbase: new V3(), pos: new V3(), vel: new V3(), look: new V3(0, 0, 0), segs: [], hp: o.hp / 3, max: o.hp / 3, dead: false, busy: null };
      Hd.g = new THREE.Group(); b.group.add(Hd.g);
      if (MK) {
        // tête de dragon : mâchoire articulée, yeux lumineux, photo dans le médaillon doré du front
        const hm = MK.get('head'); Hd.g.add(hm); Hd.jaw = MK.node(hm, 'jaw'); Hd.crest = MK.node(hm, 'crest');
        const fm = MK.round(faceMesh(b.faces[h % b.faces.length], 1.8, accent)), anchor = MK.node(hm, 'face');
        if (anchor) anchor.add(fm); else { fm.position.set(0, 1.5, -0.2); hm.add(fm); }
        b.faceMeshes.push(fm); Hd.face = fm;
        Hd.neck = mkNeck();
        for (let s = 0; s < NSEG; s++) { const sg = new THREE.Group(), sp = MK.get('neckspine'); sg.add(sp); sg.userData.sp = sp; if (s === 0) sp.visible = false; b.group.add(sg); Hd.segs.push(sg); }
      } else {
        const hood = K.get('hood'); hood.position.z = -0.3; Hd.g.add(hood);
        const fm = faceMesh(b.faces[h % b.faces.length], 3.4, accent); fm.position.set(0, 0.2, 0.35); Hd.g.add(fm); b.faceMeshes.push(fm); Hd.face = fm;
        for (let s = 0; s < NSEG; s++) { const sg = K.get('seg'); b.group.add(sg); Hd.segs.push(sg); }
      }
      Hd.pool = { hp: Hd.max, max: Hd.max, dead: false, head: Hd };
      // (tête Blender : la sphère de touche avance vers le museau)
      b.parts.push({ obj: Hd.g, off: MK ? new V3(0, 0.2, 0.9) : new V3(0, 0, 0), r: MK ? 2.3 : 2.1, weak: false, pool: Hd.pool, head: Hd });
      b.parts.push({ obj: Hd.segs[3], off: new V3(0, 0, 0), r: 1.4, weak: false, pool: Hd.pool, head: Hd });
      heads.push(Hd);
    }
    b.heads = heads;
    b.hp = heads.reduce((s, h) => s + h.hp, 0); b.maxHp = b.hp;
    // base logique (position du corps côté simulation) et base affichée (position lissée)
    const hb = Hd => Hd.base.set(b.pos.x + Hd.off.x, Hd.off.y, b.pos.z + Hd.off.z);
    const g0Of = Hd => { const q = hb(Hd); return new V3(q.x, 0, q.z); };
    heads.forEach(hb);
    // ---- évolution : crêtes d'épines (stade 2), poches de venin lumineuses sur le corps (stade 3) ----
    const spikeG = new THREE.ConeGeometry(0.3, 1.8, 5); b.ownGeos.push(spikeG);
    const crests = [];
    if (MK) heads.forEach(Hd => { if (Hd.crest) { Hd.crest.visible = false; crests.push(Hd.crest); } });
    else heads.forEach(Hd => { for (let i = 0; i < 4; i++) { const m = H.mesh(b, spikeG, K.rockMat, { p: [(i - 1.5) * 0.55, 1.6 + Math.abs(i - 1.5) * -0.2, -0.7], r: [-0.7, 0, (i - 1.5) * -0.25], s: 1 - Math.abs(i - 1.5) * 0.15 }); const tip = H.mesh(b, new THREE.ConeGeometry(0.12, 0.5, 5), K.glowMat, { p: [0, 0.75, 0] }); m.add(tip); m.visible = false; Hd.g.add(m); crests.push(m); } });
    const sacs = [];
    if (MK) { for (let i = 0; i < 6; i++) { const m = MK.node(body, 'sac' + i); if (m) { m.visible = false; sacs.push(m); } } }
    else for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.4; const m = H.mesh(b, new THREE.IcosahedronGeometry(0.7, 1), K.glowMat, { p: [Math.sin(a) * 3.6, 1.6 + (i % 2) * 0.8, Math.cos(a) * 3.6], s: [1, 1.4, 1] }); m.visible = false; body.add(m); sacs.push(m); }
    b.onStage = function (s) {
      if (s === 2) crests.forEach((m, i) => H.grow(b, m, 1.0 + i * 0.05));
      if (s === 3) sacs.forEach((m, i) => H.grow(b, m, 1.0 + i * 0.1));
    };
    b.killPool = p => {
      p.dead = true; const Hd = p.head; Hd.dead = true; Hd.busy = null;
      b.parts.forEach(pt => { if (pt.head === Hd) pt.dead = true; });
      BR.Audio.bossVoice(b.faces[Hd.i % b.faces.length], 0.6, 1.2); A.shake(0.7);
      S.fx.flash(Hd.pos.clone(), { color: accent, r: 4, life: 0.5, intensity: 8 }); S.fx.burst(Hd.pos.clone(), { n: 120, color: accent, speed: 16, life: 0.9 });
      BR.Arena.banner('TÊTE TRANCHÉE', heads.filter(x => !x.dead).length + ' restante(s)', 1.5, 'gold');
      // la dernière tête tranchée achève l'hydre, quoi qu'il reste dans la barre (le corps seul ne peut pas être frappé)
      if (heads.every(x => x.dead) && !b.dead && S.isHost !== false) { b.hp = 0; b.die(); }
    };
    // la vie de l'hydre = la somme des vies de ses têtes vivantes (un soin ne doit jamais remplir la barre sans les têtes)
    b.syncPools = () => { b.hp = heads.reduce((s, Hd) => s + (Hd.dead ? 0 : Math.max(0, Hd.pool.hp)), 0); };
    b.healPools = amt => { const alive = heads.filter(Hd => !Hd.dead); if (!alive.length) return; alive.forEach(Hd => { Hd.pool.hp = Math.min(Hd.max, Hd.pool.hp + amt / alive.length); }); b.syncPools(); };
    b.focus = () => { const alive = heads.filter(h => !h.dead); const Hd = alive.length ? alive.reduce((a, c) => (c.pos.distanceTo(S.me.pos) < a.pos.distanceTo(S.me.pos) ? c : a)) : heads[0]; return Hd.pos.clone(); };
    b.blockers = () => [{ x: b.pos.x, z: b.pos.z, r: 6.2, h: 4.5 }];
    b.partBars = () => heads.map((Hd, i) => `<div class="pb ${Hd.dead ? 'dead' : ''}"><span>Tête ${i + 1}</span><i style="width:${Math.max(0, Hd.pool.hp / Hd.max) * 100}%"></i></div>`).join('');
    b.extraState = () => heads.map(Hd => Math.round(Hd.pool.hp));
    b.applyExtra = ex => { ex.forEach((v, i) => { const Hd = heads[i]; Hd.pool.hp = v; if (v <= 0 && !Hd.dead) b.killPool(Hd.pool); }); };
    const idlePos = (Hd, t) => { const out = new V3(Math.sin(Hd.ang), 0, Math.cos(Hd.ang)); return hb(Hd).clone().addScaledVector(out, 4.5).add(new V3(Math.sin(t * 0.7 + Hd.i * 2) * 1.2, 8.5 + Math.sin(t * 1.1 + Hd.i) * 0.8, Math.cos(t * 0.6 + Hd.i) * 1.2)); };
    heads.forEach(Hd => Hd.pos.copy(idlePos(Hd, 0)));
    const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return p0.clone().multiplyScalar(u * u * u).addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t); };
    // cou lisse : anneaux le long de la même courbe (Bézier + ondulation) que l'ancien chapelet de segments ;
    // le dos du cou regarde vers le haut / le centre du corps, le ventre vers l'avant. Les 11 segments (parties
    // touchables, épines dorsales) sont posés sur la courbe et orientés le long du cou.
    const cpt = Array.from({ length: NR }, () => new V3()), _T = new V3(), _N = new V3(), _B = new V3(), _ref = new V3(), _m4 = new THREE.Matrix4();
    const neckFrame = (Hd, p0, p1, p2, p3, sway, side) => {
      const bul = Hd.bulge || 0, bT = Hd.bulgeT || 0;
      const at = (t, v) => {
        const u = 1 - t, a = u * u * u, c = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t, s = Math.sin(t * Math.PI), i = t * (NSEG - 1);
        v.set(p0.x * a + p1.x * c + p2.x * d + p3.x * e, p0.y * a + p1.y * c + p2.y * d + p3.y * e, p0.z * a + p1.z * c + p2.z * d + p3.z * e);
        v.addScaledVector(side, Math.sin(b.t * 3.1 - i * 0.55 + Hd.i * 2) * sway * s); v.y += Math.cos(b.t * 2.3 - i * 0.5 + Hd.i) * sway * 0.4 * s;
        return v;
      };
      const rad = t => (1.3 - 0.62 * t) * b.sc * (1 + bul * Math.exp(-Math.pow((t - bT) * 6, 2)));
      _ref.set(-Math.sin(Hd.ang) * 0.8, 1, -Math.cos(Hd.ang) * 0.8).normalize();
      const frame = (i, t) => {
        // tangente, puis normale « dos » (référence projetée), binormale
        const a = cpt[Math.max(0, i - 1)], c = cpt[Math.min(NR - 1, i + 1)];
        _T.subVectors(c, a).normalize();
        _N.copy(_ref).addScaledVector(_T, -_ref.dot(_T)); if (_N.lengthSq() < 1e-4) _N.set(0, 1, 0).addScaledVector(_T, -_T.y); _N.normalize();
        _B.crossVectors(_T, _N);
      };
      for (let i = 0; i < NR; i++) at(i / (NR - 1), cpt[i]);
      const arr = Hd.neck.geometry.attributes.position.array;
      for (let i = 0; i < NR; i++) {
        const t = i / (NR - 1), r = rad(t), q = cpt[i]; frame(i, t);
        for (let k = 0; k < NS; k++) {
          const th = k / NS * Math.PI * 2, cs = Math.cos(th) * r, sn = Math.sin(th) * r, o3 = (i * NS + k) * 3;
          arr[o3] = q.x + _N.x * cs + _B.x * sn; arr[o3 + 1] = q.y + _N.y * cs + _B.y * sn; arr[o3 + 2] = q.z + _N.z * cs + _B.z * sn;
        }
      }
      Hd.neck.geometry.attributes.position.needsUpdate = true; Hd.neck.geometry.computeVertexNormals();
      Hd.segs.forEach((sg, s) => {
        const t = s / (NSEG - 1), fi = t * (NR - 1), i = Math.round(fi); at(t, sg.position); frame(i, t);
        _m4.makeBasis(_B, _N, _T); sg.quaternion.setFromRotationMatrix(_m4);
        const sp = sg.userData.sp; sp.position.set(0, rad(t) * 0.86, 0); sp.scale.setScalar((1.25 - 0.45 * t) * b.sc);
      });
    };
    b.animate = function (dt) {
      if (MK) { MK.flash(b.flashT > 0); neckMat.emissive.setScalar(b.flashT > 0 ? 0.09 : 0); }
      body.rotation.y = Math.sin(b.t * 0.3) * 0.05 + (b.bodyTwist || 0); body.position.set(b.vp.x, Math.sin(b.t * 0.9) * 0.1 - (b.crouch || 0), b.vp.z); body.scale.setScalar(b.sc * (1 + (b.swell || 0))); b.group.position.y = -(b.sink || 0) * 10;
      for (const Hd of heads) {
        hb(Hd); Hd.vbase.set(b.vp.x + Hd.off.x, Hd.off.y - (b.crouch || 0), b.vp.z + Hd.off.z);
        let target;
        if (Hd.dead) target = Hd.base.clone().add(new V3(Math.sin(Hd.ang) * 9, 0.8, Math.cos(Hd.ang) * 9));
        else if (b.broken > 0) target = Hd.base.clone().add(new V3(Math.sin(Hd.ang) * 7, 1.6, Math.cos(Hd.ang) * 7));
        else if (Hd.override) target = Hd.override;
        else target = idlePos(Hd, b.t);
        // la tête est tirée par un ressort : élan, dépassement à l'impact, retour souple (cou « vivant »)
        // Hd.stiff : raideur imposée par l'attaque en cours (détente très sèche pendant une morsure)
        const w = Hd.stiff || (Hd.override ? 13 : 4.5);
        H.springVec(Hd.pos, Hd.vel, target, dt, w, Hd.override ? (Hd.damp || 0.55) : 0.8);
        if (Hd.shake) Hd.pos.add(new V3(rnd(Math.random, -1, 1), rnd(Math.random, -1, 1), rnd(Math.random, -1, 1)).multiplyScalar(Hd.shake));
        let near = null, nd = 1e9; for (const f of A.players()) { const d = f.pos.distanceTo(Hd.pos); if (d < nd) { nd = d; near = f; } }
        const lookAt = Hd.lookOverride || (near ? near.center() : new V3(0, 1, 0));
        Hd.look.lerp(lookAt, Math.min(1, dt * (Hd.lookOverride ? 9 : 5)));
        Hd.g.position.copy(Hd.pos); Hd.g.lookAt(Hd.look); if (Hd.dead) Hd.g.rotation.z = 1.2;
        if (Hd.jaw) {
          // gueule : s'ouvre avec la « gape » de l'attaque, halète au repos, pend une fois la tête tranchée
          Hd.g.scale.setScalar(b.sc * (1 + ((Hd.gape || 1) - 1) * 0.35));
          const jw = Hd.dead ? 0.7 : 0.12 + Math.max(0, (Hd.gape || 1) - 1) * 3.2 + Math.max(0, Math.sin(b.t * 1.7 + Hd.i * 2)) * 0.08;
          Hd.jaw.rotation.x += (jw - Hd.jaw.rotation.x) * Math.min(1, dt * 14);
        } else Hd.g.scale.setScalar(b.sc * (Hd.gape || 1));
        if (Hd.dead && b.stage >= 3 && Math.random() < dt * 14) S.fx.spark(Hd.pos.clone().add(new V3(rnd(Math.random, -0.6, 0.6), 0.3, rnd(Math.random, -0.6, 0.6))), new V3(0, 3, 0), { color: accent, life: 0.7, size: 0.7, size1: 0.1, world: true });
        const fwd = Hd.look.clone().sub(Hd.pos).normalize(), vb = Hd.vbase;
        const p0 = vb, p1 = vb.clone().add(new V3(Math.sin(Hd.ang) * 2, 5, Math.cos(Hd.ang) * 2)), p2 = Hd.pos.clone().addScaledVector(fwd, -3.5).add(new V3(0, -1.5, 0)), p3 = Hd.pos.clone().addScaledVector(fwd, -1.2);
        const sway = 0.25 + Math.min(1.2, Hd.vel.length() * 0.06), side = new V3(fwd.z, 0, -fwd.x).normalize();
        if (Hd.neck) neckFrame(Hd, p0, p1, p2, p3, sway, side);
        else Hd.segs.forEach((sg, i) => { const t = i / (NSEG - 1); sg.position.copy(bez(p0, p1, p2, p3, t)); const wv = Math.sin(b.t * 3.1 - i * 0.55 + Hd.i * 2) * sway * Math.sin(t * Math.PI); sg.position.addScaledVector(side, wv).y += Math.cos(b.t * 2.3 - i * 0.5 + Hd.i) * sway * 0.4 * Math.sin(t * Math.PI); const s = (1.35 - t * 0.55) * b.sc * (1 + (Hd.bulge || 0) * Math.exp(-Math.pow((t - (Hd.bulgeT || 0)) * 6, 2))); sg.scale.setScalar(s); sg.rotation.set(b.t * 0.3 + i, i * 0.7, 0); });
        Hd.face.userData.U.alpha.value = Hd.dead ? Math.max(0.15, Hd.face.userData.U.alpha.value - dt) : 1;
      }
      b.parts.forEach(pt => { if (pt.head && !pt.dead) pt.weak = pt.obj === pt.head.g && (pt.head.rest || b.broken > 0); });
    };
    b.move = () => {};
    // remet une tête au repos (fin ou annulation d'attaque)
    const free = Hd => { Hd.busy = null; Hd.rest = false; Hd.override = null; Hd.lookOverride = null; Hd.stiff = 0; Hd.damp = 0; Hd.shake = 0; Hd.gape = 1; Hd.bulge = 0; };
    const aliveH = () => heads.filter(x => !x.dead);
    const tgPos = (P, fb) => { const p = A.player(P.tg); return p && p.alive ? p.pos : (fb || new V3(P.tx, 0, P.tz)); };
    b.choose = function () {
      const fr = heads.filter(Hd => !Hd.dead && !Hd.busy), alive = aliveH(), aliveN = alive.length, allFree = fr.length === aliveN;
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z), n = b.nPlayers(), sg = b.stage, tier = b.tier;
      // attaque coordonnée des trois têtes, de plus en plus fréquente
      const every = Math.max(4.5, 8 - tier * 1.1 - (sg - 1) * 0.8 - (n - 1) * 0.4);
      if (b.t - (b.lastBig || 0) > every) {
        if (!allFree) return null;
        b.lastBig = b.t;
        const L = [];
        const ids = () => BR.shuffle(A.players().map(p => p.id), b.rng);
        if (aliveN >= 2) L.push(['tribite', 1.6, 2.2, { pts: b.targetsPts(3) }], ['pincer', 2.6, 2.4]);
        L.push(['serpent', 2.2 + (n > 1 ? 1 : 0), 3.0, { ids: ids() }]);
        if (sg >= 2) L.push(['geyser', 2.2, 2.6]);
        if (d > 16 || b.rng() < 0.2) { const a = b.rng() * 6.283, rr = 6 + b.rng() * 9; L.push(['burrow', 1.3, 1.8, { nx: +(Math.cos(a) * rr).toFixed(2), nz: +(Math.sin(a) * rr).toFixed(2) }, ['serpent', () => ({ ids: ids() }), 3.0, 1]]); }
        if (sg >= 3 && aliveN >= 2 && b.t - (b.lastFrenzy || -99) > 22) L.push(['frenzy', 4, 3.2]);
        if (sg >= 3 && b.t - (b.lastStorm || -99) > 24) L.push(['acidstorm', 2.5, 2.0, { w: [0, 1, 2].map(() => b.rainPts(8 + n * 3, 10).concat(Array.from({ length: 6 }, () => { const a = b.rng() * 6.283, rr = Math.sqrt(b.rng()) * 30; return H.pt(Math.cos(a) * rr, Math.sin(a) * rr); }))) }, ['pincer', null, 2.4, 1]]);
        const x = b.weighted(L); if (x[0] === 'acidstorm') b.lastStorm = b.t; if (x[0] === 'frenzy') b.lastFrenzy = b.t;
        return [x[0], x[2], x[3], x[4]];
      }
      if (!fr.length) return null;
      // tête la mieux placée (la plus proche de la cible), parfois une autre pour surprendre
      fr.sort((p, q) => hb(p).distanceTo(tp) - hb(q).distanceTo(tp));
      const Hd = b.rng() < 0.7 ? fr[0] : fr[Math.floor(b.rng() * fr.length)];
      const other = () => { const o2 = heads.filter(x => !x.dead && !x.busy && x !== Hd); return o2.length ? { h: o2[Math.floor(b.rng() * o2.length)].i } : { h: Hd.i }; };
      const L = [['spit', 1.5, 0.9], ['bite', d < 26 ? 3.2 : 0.6, 1.0, null, b.rng() < 0.35 + 0.15 * tier ? ['whip', other, 0.9, 1] : null], ['breath', d < 18 ? 2 : 0.3, 1.2], ['whip', d < 16 ? 2.2 : 0.4, 1.0, null, b.rng() < 0.3 + 0.15 * tier ? ['bite', other, 1.0, 1] : null]];
      if (sg >= 2) L.push(['volley', 2.0, 1.0], ['spit', 1, 0.8, null, ['volley', other, 1.0, 1]]);
      if (sg >= 2 && allFree) L.push(['roar', 0.8, 1.5]);
      const x = b.weighted(L);
      return [x[0], x[2], Object.assign({ h: Hd.i }, x[3] || {}), x[4]];
    };
    const headDir = (Hd, tx, tz) => { const q = hb(Hd), d = new V3(tx - q.x, 0, tz - q.z); if (d.lengthSq() < 0.1) d.set(Math.sin(Hd.ang), 0, Math.cos(Hd.ang)); return d.normalize(); };

    /* ---------- MORSURE : la tête se cabre en tremblant et SUIT la cible (le marquage aussi) jusqu'au dernier instant,
       détente sèche, impact qui fend le sol, la tête glisse encore (suivi), reste au sol (point faible).
       Stade 2+ ou difficulté : seconde morsure rapide sur la position du moment (punit l'attaque gourmande). ---------- */
    b.attacks.bite = (P) => {
      const Hd = heads[P.h]; if (!Hd || Hd.dead || Hd.busy) return null;
      Hd.busy = true;
      const te = P.te || (b.tier >= 2 ? 0.72 : 0.85), lockAt = te - 0.24, lunge = 0.17;
      const dbl = P.dbl != null ? P.dbl : ((P.sg || 1) >= 2 || b.tier >= 1);
      const restT = b.tier >= 2 ? 0.8 : 1.1;
      let dir = headDir(Hd, P.tx, P.tz), len = 12, yaw = 0, g0 = g0Of(Hd);
      const aim = q => { dir = headDir(Hd, q.x, q.z); len = BR.clamp(Math.hypot(q.x - g0.x, q.z - g0.z) + 3, 10, 25); yaw = Math.atan2(dir.x, dir.z); };
      aim(tgPos(P));
      const dec = S.fx.decal(g0, 'line', { len, width: 3.6, yaw, color: 0xff3020, dur: te });
      A.sfx('roar', { rate: 2, g: 0.45 });
      const T1 = te + lunge, T2 = T1 + 0.25 + restT, T3 = T2 + 0.32, T4 = T3 + 0.42 + lunge;
      const inst = { dur: dbl ? T4 + 0.9 : T2 + 0.2, main: false,
        update(t) {
          if (t < te) {
            // anticipation : se cabre très haut, recule, gueule ouverte, tremble de plus en plus
            if (t < lockAt) { aim(tgPos(P)); dec.set(g0, yaw); }
            const k = t / te;
            Hd.override = g0.clone().addScaledVector(dir, -2.5 - k * 1.5).setY(10 + k * 2.5); Hd.lookOverride = g0.clone().addScaledVector(dir, len);
            Hd.stiff = 10; Hd.damp = 0.7; Hd.shake = k > 0.6 ? (k - 0.6) * 0.5 : 0; Hd.gape = 1 + k * 0.18; Hd.bulge = 0.25 * k; Hd.bulgeT = 0.3 + k * 0.6;
          } else if (t < T1) {
            // détente : accélération brutale vers le sol
            const k = Math.pow((t - te) / lunge, 1.6);
            Hd.shake = 0; Hd.stiff = 40; Hd.damp = 0.45; Hd.gape = 1.15;
            Hd.override = g0.clone().addScaledVector(dir, 2 + (len - 2) * k).setY(sm(12.5, 1.4, k));
            if (!inst.s) { inst.s = 1; A.sfx('swingBig', { rate: 0.5, g: 1.2 }); }
            A.hurtLine(g0.x, g0.z, yaw, 2 + (len - 2) * k + 1, 3.6, 165, { kb: 10, up: 4 }, inst, 'bite');
          } else if (t < T2) {
            if (!inst.l) {
              inst.l = 1; Hd.rest = true; A.shake(0.55); const q = g0.clone().addScaledVector(dir, len);
              S.fx.burst(q.clone().setY(0.3), { n: 45, color: 0x3a4a40, kind: 'smoke', speed: 11, up: 0.8, life: 0.9, size: 0.5, grav: 20, world: true });
              if (S.fx.debris) S.fx.debris(q, { n: 10, r: 1.5, speed: 9, size: 0.3, world: true });
              S.fx.ring(q, { r1: 5, color: accent, life: 0.35, world: true }); A.sfx('stomp', { g: 0.7 });
            }
            // suivi : la tête glisse encore un peu, puis s'affaisse (point faible)
            const k = Math.min(1, (t - T1) / 0.25);
            Hd.stiff = 9; Hd.damp = 0.8; Hd.gape = 1;
            Hd.override = g0.clone().addScaledVector(dir, len + 1.4 * k).setY(1.2); Hd.lookOverride = Hd.pos.clone().addScaledVector(dir, 3).setY(0);
          } else if (dbl && t < T3) {
            // se redresse à moitié… et repart
            Hd.rest = false; if (!inst.r) { inst.r = 1; aim(tgPos(P)); len = Math.min(len, 18); inst.d2 = S.fx.decal(g0, 'line', { len, width: 3.0, yaw, color: 0xff3020, dur: 0.42 + (T3 - t) }); A.sfx('roar', { rate: 2.4, g: 0.35 }); }
            const k = (t - T2) / 0.32; Hd.stiff = 14; Hd.override = g0.clone().addScaledVector(dir, len * 0.6).setY(sm(1.2, 6, ease(k))); Hd.lookOverride = g0.clone().addScaledVector(dir, len);
          } else if (dbl && t < T4 - lunge) {
            Hd.shake = 0.25; Hd.override = g0.clone().addScaledVector(dir, len * 0.5).setY(6.5);
          } else if (dbl && t < T4) {
            const k = Math.pow((t - (T4 - lunge)) / lunge, 1.6); Hd.shake = 0; Hd.stiff = 40; Hd.damp = 0.45;
            Hd.override = g0.clone().addScaledVector(dir, len * 0.5 + len * 0.5 * k).setY(sm(6.5, 1.3, k));
            if (!inst.s2) { inst.s2 = 1; A.sfx('swingBig', { rate: 0.6, g: 1 }); }
            A.hurtLine(g0.x, g0.z, yaw, len * 0.5 + len * 0.5 * k + 1, 3.0, 130, { kb: 12, up: 6 }, inst, 'bite2');
          } else if (dbl) {
            if (!inst.l2) { inst.l2 = 1; Hd.rest = true; A.shake(0.4); const q = g0.clone().addScaledVector(dir, len); S.fx.burst(q.clone().setY(0.3), { n: 30, color: 0x3a4a40, kind: 'smoke', speed: 9, up: 0.8, life: 0.8, size: 0.5, grav: 20, world: true }); A.sfx('stomp', { g: 0.5 }); }
            Hd.stiff = 9; Hd.override = g0.clone().addScaledVector(dir, len + 0.8).setY(1.2);
          } else { Hd.rest = false; Hd.override = null; Hd.lookOverride = null; Hd.stiff = 0; }
        }, end() { free(Hd); }, cancel() { this.end(); } };
      return inst;
    };
    /* ---------- CRACHAT : la tête recule et gonfle (le venin remonte le cou), puis bombarde autour de la cible ---------- */
    b.attacks.spit = (P, r) => {
      const Hd = heads[P.h]; if (!Hd || Hd.dead || Hd.busy) return null;
      const n = (b.phase > 1 ? 5 : 3) + b.tier; Hd.busy = true;
      const lead = tgPos(P), f = A.player(P.tg), vx = f ? f.vel.x : 0, vz = f ? f.vel.z : 0;
      const pts = []; for (let i = 0; i < n; i++) { const a = r() * 6.283, d = i ? 1.5 + r() * 4.5 : 0; pts.push(new V3(lead.x + vx * 0.6 + Math.cos(a) * d, 0, lead.z + vz * 0.6 + Math.sin(a) * d)); }
      const inst = { dur: 1.9, main: false,
        update(t) {
          if (t < 0.65) { const k = t / 0.65; Hd.override = idlePos(Hd, b.t).add(new V3(0, 2.5 + k, 0)).addScaledVector(headDir(Hd, lead.x, lead.z), -2 * k); Hd.lookOverride = new V3(lead.x, 6, lead.z); Hd.bulge = 0.5 * k; Hd.bulgeT = k; Hd.gape = 1 + 0.12 * k; return; }
          if (!inst.fire) {
            inst.fire = 1; A.sfx('fire', { g: 0.6 }); Hd.bulge = 0; Hd.gape = 1.2; Hd.override = Hd.pos.clone().addScaledVector(headDir(Hd, lead.x, lead.z), 1.5);
            pts.forEach((q) => {
              S.fx.decal(q, 'circle', { r: 2.6, color: 0x7aff40, dur: 1.0 });
              const from = Hd.pos.clone(), T = 1.0, g = 20;
              A.eproj({ pos: from, vel: new V3((q.x - from.x) / T, (0 - from.y) / T + 0.5 * g * T, (q.z - from.z) / T), grav: g, r: 0.8, dmg: 70, color: ACID, life: T + 0.2,
                onEnd: (p) => {
                  const z0 = new V3(p.pos.x, 0, p.pos.z); S.fx.flash(z0.clone().setY(0.4), { color: ACID, r: 1.5, life: 0.2, light: false }); S.fx.burst(z0, { n: 20, color: ACID, speed: 7, up: 1, life: 0.5, world: true });
                  S.fx.decal(z0, 'circle', { r: 2.6, color: 0x40ff60, dur: 0.15, hold: 3.8 });
                  A.ezone({ pos: z0, life: 4, iv: 0.5, onTick: z => { A.hurtCircle(z.pos.x, z.pos.z, 2.6, 22, { h: 1.2 }); for (let k = 0; k < 3; k++) S.fx.spark(z.pos.clone().add(new V3(rnd(Math.random, -2, 2), 0.1, rnd(Math.random, -2, 2))), new V3(0, 1.5, 0), { color: ACID, life: 0.6, size: 0.4, world: true }); } });
                } });
            });
          }
          if (t > 0.9) Hd.gape = 1;
        }, end() { free(Hd); }, cancel() { this.end(); } };
      return inst;
    };
    /* ---------- SOUFFLE : inspiration (particules aspirées), balayage, puis retour en sens inverse (stade 2+) ---------- */
    b.attacks.breath = (P) => {
      const Hd = heads[P.h]; if (!Hd || Hd.dead || Hd.busy) return null;
      Hd.busy = true;
      const g0 = g0Of(Hd), yaw0 = Math.atan2(P.tx - g0.x, P.tz - g0.z), back = (P.sg || 1) >= 2 || b.tier >= 2, half = 0.75, R = 17;
      S.fx.decal(g0, 'sector', { r: R, arc: half * 2 + 0.5, yaw: yaw0, color: 0xff3020, dur: 0.9, hold: back ? 2.6 : 1.4 });
      A.sfx('charge', { len: 0.9, g: 0.6 });
      const s1 = 0.9, s2 = s1 + 1.1, s3 = s2 + 0.2, s4 = s3 + 0.95;
      const inst = { dur: (back ? s4 : s2) + 0.4, main: false,
        update(t) {
          let yaw;
          if (t < s1) yaw = yaw0 - half; else if (t < s2) yaw = yaw0 - half + 2 * half * ease((t - s1) / (s2 - s1)); else if (!back || t < s3) yaw = yaw0 + half; else yaw = yaw0 + half - 2 * half * ease(Math.min(1, (t - s3) / (s4 - s3)));
          const dir = new V3(Math.sin(yaw), 0, Math.cos(yaw));
          if (t < s1) {
            const k = t / s1; Hd.override = g0.clone().addScaledVector(dir, 1.5).setY(5.5 + k * 1.5); Hd.lookOverride = Hd.pos.clone().add(new V3(0, 4 - k * 6, 0)).addScaledVector(dir, 6); Hd.bulge = 0.4 * k; Hd.bulgeT = 0.2 + 0.7 * k; Hd.gape = 1 + 0.1 * k;
            if (Math.random() < 0.7) { const q = Hd.pos.clone().add(new V3(rnd(Math.random, -5, 5), rnd(Math.random, -3, 4), rnd(Math.random, -5, 5))); S.fx.spark(q, Hd.pos.clone().sub(q).multiplyScalar(2.2), { color: ACID, life: 0.45, size: 0.4, size1: 0.1, world: true }); }
            return;
          }
          Hd.bulge = 0; Hd.gape = 1.22;
          Hd.override = g0.clone().addScaledVector(dir, 3).setY(5); Hd.lookOverride = g0.clone().addScaledVector(dir, 12);
          const firing = t < (back ? s4 : s2) && !(back && t >= s2 && t < s3);
          if (firing) {
            if (!inst.s) { inst.s = 1; A.sfx('fire', { len: back ? 3 : 1.6, g: 1 }); }
            for (let j = 0; j < 5; j++) { const v = dir.clone().multiplyScalar(rnd(Math.random, 15, 24)).add(new V3(rnd(Math.random, -2, 2), rnd(Math.random, -3, 0), rnd(Math.random, -2, 2))); S.fx.spark(Hd.pos.clone().addScaledVector(dir, 1.5), v, { color: j % 2 ? accent : 0xd0ff60, life: 0.7, size: 0.9, size1: 1.9, drag: 1, world: true, bright: 0.55, alpha: 0.7 }); }
            A.hurtSector(g0.x, g0.z, yaw, R, 0.45, 32, { kb: 2 }, inst, 'f' + Math.floor(t * 4));
          }
        }, end() { free(Hd); }, cancel() { this.end(); } };
      return inst;
    };
    /* ---------- FOUET : la tête rase le sol en arc (à sauter) ; stade 2+ : retour de fouet dans l'autre sens ---------- */
    b.attacks.whip = (P, r) => {
      const Hd = heads[P.h]; if (!Hd || Hd.dead || Hd.busy) return null;
      Hd.busy = true;
      const g0 = g0Of(Hd), yc = Math.atan2(P.tx - g0.x, P.tz - g0.z), dir = r() < 0.5 ? 1 : -1, arc = 2.6, R = 15, twice = (P.sg || 1) >= 2 || b.tier >= 2;
      const te = b.tier >= 2 ? 0.85 : 1.0, sw = 0.5, gap = 0.45;
      S.fx.decal(g0, 'sector', { r: R, arc, yaw: yc, color: 0xff3020, dur: te, hold: sw });
      A.sfx('roar', { rate: 1.9, g: 0.4 });
      const pass = (t, t0, d0, key) => {
        const k = BR.clamp((t - t0) / sw, 0, 1), a = yc - d0 * arc / 2 + d0 * arc * ease(k), dv = new V3(Math.sin(a), 0, Math.cos(a));
        Hd.stiff = 22; Hd.override = g0.clone().addScaledVector(dv, R * 0.75).setY(1.3); Hd.lookOverride = g0.clone().addScaledVector(dv, R * 0.75).add(new V3(d0 * Math.cos(a) * 4, 0.5, -d0 * Math.sin(a) * 4));
        if (!inst[key]) { inst[key] = 1; A.sfx('swingBig', { rate: 0.4, g: 1.4 }); A.shake(0.3); }
        S.fx.burst(g0.clone().addScaledVector(dv, R * (0.4 + Math.random() * 0.6)).setY(0.3), { n: 2, color: 0x3a4a40, kind: 'smoke', speed: 3, up: 1, life: 0.7, size: 1, size1: 2, world: true });
        if (k < 1) A.hurtSector(g0.x, g0.z, a, R, 0.6, 130, { air: true, kb: 12, up: 4, h: 2.2 }, inst, key);
      };
      const inst = { dur: te + sw + (twice ? gap + sw : 0) + 0.6, main: false,
        update(t) {
          const a0 = yc - dir * arc / 2;
          if (t < te) { const k = t / te; Hd.stiff = 8; Hd.override = g0.clone().add(new V3(Math.sin(a0) * 6, 3.5 + (1 - k) * 3, Math.cos(a0) * 6)); Hd.lookOverride = g0.clone().add(new V3(Math.sin(a0) * 14, 0, Math.cos(a0) * 14)); Hd.shake = k > 0.7 ? 0.15 : 0; return; }
          Hd.shake = 0;
          if (t < te + sw) { pass(t, te, dir, 'w1'); return; }
          if (twice && t < te + sw + gap) { if (!inst.d2) { inst.d2 = 1; S.fx.decal(g0, 'sector', { r: R, arc, yaw: yc, color: 0xff3020, dur: gap, hold: sw }); } const a1 = yc + dir * arc / 2; Hd.override = g0.clone().add(new V3(Math.sin(a1) * 9, 2.2, Math.cos(a1) * 9)); return; }
          if (twice && t < te + sw * 2 + gap) { pass(t, te + sw + gap, -dir, 'w2'); return; }
          Hd.override = null; Hd.lookOverride = null; Hd.stiff = 0;
        }, end() { free(Hd); }, cancel() { this.end(); } };
      return inst;
    };
    // les têtes mordent l'une après l'autre, chacune vise un joueur différent
    b.attacks.tribite = (P) => {
      const pts = P.pts && P.pts.length ? P.pts : [[P.tx, P.tz]];
      const alive = heads.filter(Hd => !Hd.dead && !Hd.busy);
      const gapT = b.tier >= 2 ? 0.22 : 0.3;
      const inst = { dur: 0.1 + alive.length * gapT, main: false, update(t) {
        alive.forEach((Hd, i) => { if (t >= i * gapT && !inst['b' + i]) { inst['b' + i] = 1; const q = pts[i % pts.length]; b.startAttack('bite', Object.assign({}, P, { h: Hd.i, tx: q[0], tz: q[1], s: (P.s + i) >>> 0, dbl: false })); } });
      } };
      return inst;
    };
    /* ---------- RUÉE SOUTERRAINE : les têtes plongent dans le sol et filent sous terre vers leurs proies (le sol se
       fend au-dessus d'elles), s'arrêtent, puis jaillissent à la verticale. Elles traquent pendant toute la course. ---------- */
    b.attacks.serpent = (P) => {
      const alive = aliveH(); if (!alive.length) return null;
      const ids = P.ids && P.ids.length ? P.ids : [P.tg];
      alive.forEach(Hd => { Hd.busy = true; });
      A.sfx('roar', { rate: 0.9, g: 1.1 }); A.voice(b.faces[0], 0.55, 1.1);
      const dive = 0.75, run = b.tier >= 2 ? 1.35 : 1.6, lock = 0.5, stag = 0.35;
      const st = alive.map((Hd, i) => ({ Hd, id: ids[i % ids.length], t0: i * stag, p: null, dec: null }));
      const inst = { dur: dive + run + lock + stag * (alive.length - 1) + 1.4, main: true,
        update(t, dt) {
          b.crouch = t < dive ? ease(t / dive) * 0.8 : Math.max(0, (b.crouch || 0) - dt * 2);
          for (const s of st) {
            const Hd = s.Hd, lt = t - s.t0, g0 = g0Of(Hd);
            if (lt < 0) { Hd.override = idlePos(Hd, b.t).add(new V3(0, 2, 0)); Hd.shake = 0.12; continue; }
            if (lt < dive) {
              // plongeon : la tête monte puis pique dans le sol au pied du corps
              const k = lt / dive, out = new V3(Math.sin(Hd.ang), 0, Math.cos(Hd.ang));
              Hd.stiff = 16; Hd.shake = 0; Hd.override = g0.clone().addScaledVector(out, 5).setY(k < 0.5 ? 9 + k * 4 : sm(11, -3.5, (k - 0.5) * 2)); Hd.lookOverride = g0.clone().addScaledVector(out, 7).setY(-6);
              if (k > 0.8 && !s.splash) { s.splash = 1; const q = g0.clone().addScaledVector(out, 5); S.fx.burst(q.setY(0.3), { n: 40, color: 0x3a4a40, kind: 'smoke', speed: 10, up: 1, life: 0.9, size: 0.6, grav: 20, world: true }); A.sfx('stomp', { g: 0.5 }); A.shake(0.25); }
              continue;
            }
            const f = A.player(s.id), tp = f && f.alive ? f.pos : null;
            if (!s.p) { const out = new V3(Math.sin(Hd.ang), 0, Math.cos(Hd.ang)); s.p = g0.clone().addScaledVector(out, 5); s.dec = S.fx.decal(s.p, 'circle', { r: 3.2, color: 0xff3020, dur: run + lock }); }
            if (lt < dive + run) {
              // course souterraine qui suit la cible (vitesse limitée : on peut la semer en courant de biais)
              if (tp) { const dx = tp.x - s.p.x, dz = tp.z - s.p.z, d = Math.hypot(dx, dz), sp = Math.min(d, 15 * dt); if (d > 0.01) { s.p.x += dx / d * sp; s.p.z += dz / d * sp; s.dx = dx / d; s.dz = dz / d; } }
              s.dec.set(s.p);
              Hd.stiff = 30; Hd.override = s.p.clone().setY(-3.5); Hd.lookOverride = s.p.clone().setY(-3.5).add(new V3((s.dx || 0) * 3, 0, (s.dz == null ? 1 : s.dz) * 3));
              if (Math.random() < 0.8) S.fx.burst(s.p.clone().add(new V3(rnd(Math.random, -1, 1), 0.2, rnd(Math.random, -1, 1))), { n: 2, color: 0x3a4a40, kind: 'smoke', speed: 3, up: 1.2, life: 0.6, size: 0.8, size1: 1.6, world: true });
              if (Math.random() < 0.3 && S.fx.debris) S.fx.debris(s.p.clone(), { n: 2, r: 0.8, speed: 4, size: 0.2, world: true });
              if (Math.random() < 0.15) A.shake(0.05);
              continue;
            }
            if (lt < dive + run + lock) { Hd.override = s.p.clone().setY(-2.5); Hd.shake = 0.2; if (Math.random() < 0.6) S.fx.spark(s.p.clone().add(new V3(rnd(Math.random, -2.5, 2.5), 0.1, rnd(Math.random, -2.5, 2.5))), new V3(0, 6, 0), { color: ACID, life: 0.4, size: 0.4, world: true }); continue; }
            if (!s.up) {
              s.up = 1; Hd.shake = 0;
              H.blast(b, inst, 'e' + Hd.i, s.p.x, s.p.z, 3.2, 150, accent, { hurt: { up: 12, kb: 10 }, shake: 0.5, g: 0.6 });
              if (S.fx.debris) S.fx.debris(s.p.clone(), { n: 16, r: 2, speed: 13, size: 0.4, world: true });
              S.fx.pillar(s.p.clone(), { color: accent, r: 2, h: 16, life: 0.5, world: true }); A.sfx('roar', { rate: 1.6, g: 0.6 });
            }
            // jaillissement vertical puis retour vers le corps
            const k = Math.min(1, (lt - dive - run - lock) / 0.25);
            Hd.stiff = 26; Hd.damp = 0.5; Hd.override = s.p.clone().setY(sm(-2.5, 9, k)); Hd.lookOverride = s.p.clone().setY(20);
            if (lt > dive + run + lock + 0.7) { Hd.stiff = 6; Hd.override = idlePos(Hd, b.t); Hd.lookOverride = null; }
          }
        }, end() { b.crouch = 0; alive.forEach(free); }, cancel() { this.end(); } };
      return inst;
    };
    /* ---------- ÉTAU : deux têtes se postent de part et d'autre de la cible et se referment au ras du sol en même temps
       (sauter au bon moment), la troisième s'abat au centre juste après (ne pas retomber au même endroit). ---------- */
    b.attacks.pincer = (P) => {
      const alive = heads.filter(Hd => !Hd.dead && !Hd.busy); if (alive.length < 2) return null;
      alive.forEach(Hd => { Hd.busy = true; });
      const c = new V3(b.pos.x, 0, b.pos.z);
      let T = tgPos(P).clone().setY(0); const yawT = () => Math.atan2(T.x - c.x, T.z - c.z);
      const R = () => BR.clamp(Math.hypot(T.x - c.x, T.z - c.z) + 4, 10, 26), open = 1.5;
      const te = b.tier >= 2 ? 1.0 : 1.2, sw = 0.42, lag = 0.12, slamT = te + sw + 0.45;
      const [L1, L2, M] = alive;
      let dl = null, dr = null, ds = null, ya = yawT(), rr = R();
      A.sfx('roar', { rate: 1.3, g: 0.9 });
      const inst = { dur: slamT + 1.4, main: true,
        update(t) {
          if (t < te - 0.3) { const f = A.player(P.tg); if (f && f.alive) T.copy(f.pos).setY(0); ya = yawT(); rr = R(); }
          if (!dl) { dl = S.fx.decal(c, 'sector', { r: rr, arc: open, yaw: ya - open / 2, color: 0xff3020, dur: te, hold: sw + lag }); dr = S.fx.decal(c, 'sector', { r: rr, arc: open, yaw: ya + open / 2, color: 0xff3020, dur: te, hold: sw + lag }); }
          if (t < te - 0.3) { dl.set(c, ya - open / 2); dr.set(c, ya + open / 2); }
          const side = (Hd, s, t0) => {
            const k = BR.clamp((t - t0) / sw, 0, 1), a = ya + s * open * (1 - ease(k)), dv = new V3(Math.sin(a), 0, Math.cos(a));
            if (t < t0) { Hd.stiff = 10; Hd.override = c.clone().addScaledVector(dv, rr * 0.7).setY(2.2 + Math.sin(t * 9 + s) * 0.3); Hd.lookOverride = c.clone().addScaledVector(new V3(Math.sin(ya), 0, Math.cos(ya)), rr * 0.7); Hd.gape = 1.1; return; }
            Hd.stiff = 26; Hd.override = c.clone().addScaledVector(dv, rr * 0.7).setY(1.2); Hd.lookOverride = c.clone().addScaledVector(new V3(Math.sin(a - s * 0.6), 0, Math.cos(a - s * 0.6)), rr * 0.7);
            if (!inst['s' + s]) { inst['s' + s] = 1; A.sfx('swingBig', { rate: 0.45, g: 1.2 }); }
            if (k < 1) A.hurtSector(c.x, c.z, a, rr, 0.5, 120, { air: true, kb: 9, up: 5, h: 2.2 }, inst, 'p' + s);
            else if (!inst['c' + s]) { inst['c' + s] = 1; if (s > 0) { A.shake(0.45); S.fx.flash(c.clone().addScaledVector(new V3(Math.sin(ya), 0, Math.cos(ya)), rr * 0.7).setY(1), { color: accent, r: 2.5, life: 0.25 }); A.sfx('stomp', { g: 0.7 }); } }
          };
          side(L1, -1, te); side(L2, 1, te + lag);
          if (M) {
            if (t < slamT - 0.5) { M.stiff = 8; M.override = g0Of(M).add(new V3(0, 13, 0)); M.lookOverride = T.clone(); M.shake = t > te ? 0.2 : 0; }
            else if (!ds) { ds = S.fx.decal(T.clone(), 'circle', { r: 4, color: 0xff3020, dur: 0.5 }); }
            if (t >= slamT - 0.5 && t < slamT) { M.override = T.clone().setY(11); }
            if (t >= slamT && t < slamT + 0.15) { M.stiff = 40; M.shake = 0; M.override = T.clone().setY(sm(11, 1.3, (t - slamT) / 0.15)); }
            if (t >= slamT + 0.15 && !inst.m) { inst.m = 1; M.rest = true; H.blast(b, inst, 'm', T.x, T.z, 4, 170, accent, { hurt: { up: 9, kb: 11 }, shake: 0.6, g: 0.7 }); if (S.fx.debris) S.fx.debris(T.clone(), { n: 14, r: 2, speed: 11, size: 0.35, world: true }); }
            if (t >= slamT + 0.15) { M.stiff = 9; M.override = T.clone().setY(1.2); }
          }
          if (t > slamT + 0.3) { L1.override = null; L2.override = null; L1.lookOverride = L2.lookOverride = null; L1.stiff = L2.stiff = 0; L1.gape = L2.gape = 1; }
        }, end() { alive.forEach(free); }, cancel() { this.end(); } };
      return inst;
    };
    /* ---------- GEYSERS (stade 2+) : les têtes s'enfoncent au pied du corps, le venin jaillit en anneaux qui
       s'élargissent, chacun avec une BRÈCHE qui tourne : sauter en rythme ou se placer dans la brèche. ---------- */
    b.attacks.geyser = (P, r) => {
      const alive = aliveH(); if (!alive.length) return null;
      alive.forEach(Hd => { Hd.busy = true; });
      const c = new V3(b.pos.x, 0, b.pos.z), nW = 4 + b.tier, iv = b.tier >= 2 ? 0.62 : 0.75, gapW = 1.05;
      const yaw0 = Math.atan2(P.tx - c.x, P.tz - c.z) + Math.PI + (r() - 0.5), spin = (r() < 0.5 ? 1 : -1) * (1.1 + r() * 0.5);
      A.sfx('roar', { g: 1.2, rate: 0.85 }); A.voice(b.faces[0], 0.7, 0.9);
      const inst = { dur: 0.9 + nW * iv + 2.2, main: true,
        update(t, dt) {
          b.crouch = t < 0.9 ? ease(t / 0.9) * 1.2 : Math.max(0, 1.2 - (t - 0.9 - nW * iv) * 1.5);
          b.swell = Math.max(0, Math.sin(t * 9) * 0.03);
          alive.forEach((Hd, i) => { const out = new V3(Math.sin(Hd.ang), 0, Math.cos(Hd.ang)), g0 = g0Of(Hd); Hd.stiff = 12; Hd.override = g0.clone().addScaledVector(out, 3.5).setY(t < 0.9 ? sm(8, 0.5, ease(t / 0.9)) : 0.4 + Math.sin(t * 7 + i) * 0.2); Hd.lookOverride = g0.clone().addScaledVector(out, 6).setY(-5); });
          for (let w = 0; w < nW; w++) {
            const t0 = 0.9 + w * iv; if (t < t0 || inst['g' + w]) continue; inst['g' + w] = 1;
            const gy = yaw0 + spin * w;
            // anneau d'acide partiel (arc = tout sauf la brèche), centré à l'opposé de la brèche
            H.wave(b, c.x, c.z, { r0: 5, rMax: 34, speed: 10, dmg: 95, color: ACID, arc: Math.PI * 2 - gapW, yaw: gy + Math.PI, kb: 6, up: 6, noDebris: w > 0 });
            // repère lumineux de la brèche (colonnes au bord)
            for (const s of [-1, 1]) { const a = gy + s * gapW / 2; S.fx.pillar(new V3(c.x + Math.sin(a) * 7, 0, c.z + Math.cos(a) * 7), { color: 0xffffff, r: 0.35, h: 6, life: 0.6, world: true }); }
            A.sfx('boom', { g: 0.45, rate: 1.4, len: 0.6 }); A.shake(0.2);
            for (let k = 0; k < 14; k++) { const a = gy + Math.PI + (k / 13 - 0.5) * (Math.PI * 2 - gapW); S.fx.spark(new V3(c.x + Math.sin(a) * 5.5, 0.3, c.z + Math.cos(a) * 5.5), new V3(Math.sin(a) * 3, 14 + Math.random() * 6, Math.cos(a) * 3), { color: ACID, life: 0.8, size: 0.8, grav: 26, world: true }); }
          }
        }, end() { b.crouch = 0; b.swell = 0; alive.forEach(free); }, cancel() { this.end(); } };
      return inst;
    };
    /* ---------- FRÉNÉSIE (stade 3, coup signature) : mini-cinématique (rugissement, ralenti), trois morsures de plus
       en plus rapides sur la même proie, puis les trois gueules s'abattent en triangle + onde centrale. ---------- */
    b.attacks.frenzy = (P) => {
      const alive = aliveH(); if (!alive.length) return null;
      const tg = P.tg;
      A.voice(b.faces[0], 0.9, 1.4); A.sfx('roar', { g: 1.5, rate: 0.7 }); A.shake(0.6);
      BR.Arena.banner('FRÉNÉSIE', 'Les trois gueules ne lâchent plus leur proie', 1.6, 'evo');
      if (S.solo) S.slowT = Math.max(S.slowT, 0.5);
      S.flash.copy(new THREE.Color(accent)).multiplyScalar(0.18);
      const tes = [0.62, 0.5, 0.4], t0s = [0.9, 1.75, 2.45], fin = 3.4;
      const inst = { dur: fin + 1.6, main: true,
        update(t) {
          b.swell = t < 0.9 ? Math.sin(t * 20) * 0.04 : 0;
          if (t < 0.9) alive.forEach(Hd => { Hd.busy = true; Hd.override = idlePos(Hd, 0).add(new V3(0, 4, 0)); Hd.lookOverride = Hd.pos.clone().add(new V3(Math.sin(Hd.ang) * 3, 10, Math.cos(Hd.ang) * 3)); Hd.shake = 0.2; Hd.gape = 1.2; });
          if (t >= 0.9 && !inst.rel) { inst.rel = 1; alive.forEach(free); }
          t0s.forEach((t0, i) => {
            if (t < t0 || inst['b' + i]) return; inst['b' + i] = 1;
            const Hd = alive[i % alive.length]; if (Hd.dead) return;
            const f = A.player(tg), q = f && f.alive ? f.pos : new V3(P.tx, 0, P.tz);
            Hd.busy = null; b.startAttack('bite', Object.assign({}, P, { h: Hd.i, tx: q.x, tz: q.z, te: tes[i], dbl: false, s: (P.s + i) >>> 0 }));
          });
          if (t >= fin - 0.8 && !inst.tri) {
            inst.tri = 1;
            // les morsures encore en cours s'interrompent : les trois têtes se replacent pour l'assaut final
            b.insts.forEach(x => { if (x !== inst && x.atk === 'bite') { x.update = () => {}; x.dur = 0; } }); const f = A.player(tg); inst.T = (f && f.alive ? f.pos : new V3(P.tx, 0, P.tz)).clone().setY(0);
            inst.pts = [0, 1, 2].map(k => { const a = k / 3 * 6.283 + 0.5; return new V3(inst.T.x + Math.sin(a) * 5, 0, inst.T.z + Math.cos(a) * 5); });
            inst.pts.forEach(q => S.fx.decal(q, 'circle', { r: 3.3, color: 0xff3020, dur: 0.8 }));
          }
          if (inst.tri && t >= fin - 0.8 && t < fin) aliveH().forEach((Hd, k) => { const q = inst.pts[k % 3]; Hd.busy = true; Hd.stiff = 12; Hd.override = q.clone().setY(10); Hd.lookOverride = q.clone(); Hd.rest = false; });
          if (inst.tri && t >= fin && t < fin + 0.15) aliveH().forEach((Hd, k) => { const q = inst.pts[k % 3]; Hd.stiff = 40; Hd.override = q.clone().setY(sm(10, 1.2, (t - fin) / 0.15)); });
          if (inst.tri && t >= fin + 0.15 && !inst.boom) {
            inst.boom = 1; inst.pts.forEach((q, k) => H.blast(b, inst, 'f' + k, q.x, q.z, 3.3, 150, accent, { hurt: { up: 9, kb: 9 }, quiet: k > 0, shake: 0.7 }));
            H.wave(b, inst.T.x, inst.T.z, { r0: 1, rMax: 22, speed: 11, dmg: 90, color: accent });
            aliveH().forEach(Hd => { Hd.rest = true; });
          }
        }, end() { b.swell = 0; aliveH().forEach(free); }, cancel() { this.end(); } };
      return inst;
    };
    // s'enfouit sous l'arène et ressurgit ailleurs (éruption)
    b.attacks.burrow = (P) => {
      const to = new V3(P.nx, 0, P.nz), from = b.pos.clone();
      heads.forEach(Hd => { Hd.busy = true; });
      A.sfx('roar', { rate: 0.8, g: 1 }); A.sfx('stomp');
      const inst = { dur: 3.0, main: true, ownsMove: true,
        update(t) {
          if (t < 1.0) { b.sink = ease(t / 1.0); if (Math.random() < 0.6) S.fx.burst(from.clone().add(new V3(rnd(Math.random, -5, 5), 0.3, rnd(Math.random, -5, 5))), { n: 3, color: 0x2a3a30, kind: 'smoke', speed: 5, up: 1, life: 1, size: 1.2, size1: 2.5, world: true }); A.shake(0.05); }
          if (t >= 0.6 && !inst.d) { inst.d = 1; S.fx.decal(to, 'circle', { r: 8, color: 0xff3020, dur: 1.2 }); }
          if (t >= 1.0 && t < 1.8) { b.sink = 1; if (Math.random() < 0.4) S.fx.burst(to.clone().add(new V3(rnd(Math.random, -6, 6), 0.2, rnd(Math.random, -6, 6))), { n: 3, color: accent, speed: 4, up: 1.5, life: 0.5, world: true }); }
          if (t >= 1.8 && !inst.u) {
            // les bases des cous suivent le corps automatiquement ; on déplace aussi les têtes (sous terre) pour éviter un cou étiré
            inst.u = 1; const dl = to.clone().sub(b.pos); b.pos.copy(to); heads.forEach(Hd => { Hd.pos.add(dl); hb(Hd); });
            S.fx.flash(to.clone().setY(2), { color: accent, r: 5, life: 0.4, intensity: 8 }); S.fx.ring(to, { r1: 14, color: accent, life: 0.6 });
            S.fx.burst(to.clone().setY(0.5), { n: 90, color: 0x3a4a40, kind: 'smoke', speed: 16, up: 1.2, life: 1.2, size: 0.6, grav: 20, world: true });
            if (S.fx.debris) S.fx.debris(to.clone(), { n: 24, r: 4, speed: 14, size: 0.45, world: true });
            A.sfx('boom', { len: 1.4 }); A.shake(0.9);
            A.hurtCircle(to.x, to.z, 8, 170, { up: 10, kb: 12 }, inst, 'u');
          }
          if (t >= 1.8) b.sink = 1 - ease((t - 1.8) / 0.6);
        }, end() { b.sink = 0; heads.forEach(free); }, cancel() { this.end(); } };
      return inst;
    };
    b.attacks.roar = (P) => {
      const alive = aliveH();
      alive.forEach(Hd => { Hd.busy = true; }); A.voice(b.faces[0], 0.8, 1.0); A.sfx('roar', { g: 1.3 });
      const p0 = b.pos.clone(), nR = 3 + b.tier;
      const inst = { dur: 2.4 + nR * 0.85, main: true,
        update(t) {
          alive.forEach(Hd => { Hd.override = idlePos(Hd, 0).add(new V3(0, 3, 0)); Hd.lookOverride = Hd.pos.clone().add(new V3(Math.sin(Hd.ang) * 5, 6, Math.cos(Hd.ang) * 5)); Hd.gape = 1.2; Hd.shake = 0.08; });
          for (let i = 0; i < nR; i++) { const t0 = 0.8 + i * (b.tier >= 2 ? 0.75 : 0.95); if (t >= t0 && !inst['r' + i]) { inst['r' + i] = 1; S.fx.ring(p0, { r0: 6, r1: 6 + 10 * 3, color: accent, life: 3, linear: true, band: 1.4, world: true }); A.shake(0.4); } const r = 6 + (t - t0) * 10; if (t >= t0) A.hurtRing(p0.x, p0.z, r - 0.5, r + 0.5, 100, { kb: 6, up: 4 }, inst, 'q' + i); }
        }, end() { alive.forEach(free); }, cancel() { this.end(); } };
      return inst;
    };
    // salves d'acide en éventail (stade 2+) : trois volées décalées
    b.attacks.volley = (P, r) => {
      const Hd = heads[P.h]; if (!Hd || Hd.dead || Hd.busy) return null;
      Hd.busy = true; const n = (P.sg || 1) >= 3 ? 7 : 5;
      const inst = { dur: 2.4, main: false,
        update(t) {
          Hd.override = idlePos(Hd, b.t).add(new V3(0, 2, 0)); Hd.lookOverride = new V3(P.tx, 2, P.tz);
          for (let i = 0; i < 3; i++) {
            const t0 = 0.55 + i * 0.5; if (t < t0 || inst['v' + i]) continue; inst['v' + i] = 1;
            A.sfx('fire', { g: 0.4, len: 0.4 }); Hd.gape = 1.25; Hd.vel.addScaledVector(headDir(Hd, P.tx, P.tz), -8);
            const tgt = (() => { const p = A.player(P.tg); return p && p.alive ? p.pos.clone() : new V3(P.tx, 0, P.tz); })();
            const from = Hd.pos.clone(), bse = Math.atan2(tgt.x - from.x, tgt.z - from.z) + (i % 2 ? 0.11 : -0.11), dist = Math.hypot(tgt.x - from.x, tgt.z - from.z), T = Math.max(0.6, dist / 18);
            for (let k = 0; k < n; k++) {
              const a = bse + (k / (n - 1) - 0.5) * 1.1, D = dist * (0.9 + (k % 2) * 0.25);
              const q = new V3(from.x + Math.sin(a) * D, 0, from.z + Math.cos(a) * D);
              A.eproj({ pos: from.clone(), vel: new V3((q.x - from.x) / T, (0.6 - from.y) / T + 0.5 * 14 * T, (q.z - from.z) / T), grav: 14, r: 0.65, dmg: 55, color: ACID, life: T + 0.4,
                onEnd: p => { S.fx.burst(new V3(p.pos.x, 0.2, p.pos.z), { n: 10, color: ACID, speed: 5, up: 1, life: 0.4, world: true }); } });
            }
          }
          if (Hd.gape > 1) Hd.gape = Math.max(1, Hd.gape - 0.03);
        }, end() { free(Hd); }, cancel() { this.end(); } };
      return inst;
    };
    // tempête d'acide (stade 3) : toutes les têtes crachent vers le ciel, trois vagues de pluie qui se chevauchent
    b.attacks.acidstorm = (P) => {
      const alive = aliveH(); alive.forEach(Hd => { Hd.busy = true; });
      const W = P.w || [];
      A.voice(b.faces[0], 0.7, 1.2); A.sfx('roar', { g: 1.2, rate: 0.9 });
      const inst = { dur: 1.2 + W.length * 1.0 + 1.6, main: true,
        update(t) {
          alive.forEach((Hd, i) => { Hd.override = idlePos(Hd, 0).add(new V3(0, 4 + Math.sin(t * 6 + i) * 0.5, 0)); Hd.lookOverride = Hd.pos.clone().add(new V3(Math.sin(Hd.ang) * 2, 12, Math.cos(Hd.ang) * 2)); Hd.gape = 1.2; if (t < 1.2 + W.length * 1.0 && Math.random() < 0.5) S.fx.spark(Hd.pos.clone(), new V3(rnd(Math.random, -2, 2), 22, rnd(Math.random, -2, 2)), { color: 0x9aff40, life: 0.7, size: 1.1, world: true }); });
          W.forEach((pts, w) => pts.forEach((q, i) => {
            const t0 = 0.9 + w * 1.0 + i * 0.03;
            if (t >= t0 && !inst['d' + w + '_' + i]) { inst['d' + w + '_' + i] = 1; S.fx.decal({ x: q[0], z: q[1] }, 'circle', { r: 2.7, color: 0x9aff40, dur: 1.1 }); }
            if (t >= t0 + 0.8 && t < t0 + 1.1 && Math.random() < 0.5) S.fx.spark(new V3(q[0], 14 * (1 - (t - t0 - 0.8) / 0.3), q[1]), new V3(0, -20, 0), { color: 0x9aff40, life: 0.1, size: 1.1, world: true });
            if (t >= t0 + 1.1 && !inst['h' + w + '_' + i]) { inst['h' + w + '_' + i] = 1; H.blast(b, inst, 'a' + w + '_' + i, q[0], q[1], 2.7, 90, 0x9aff40, { quiet: i % 4 !== 0, shake: 0, smoke: 0x2a3a20, h: 3 });
              if (i % 3 === 0) A.ezone({ pos: new V3(q[0], 0, q[1]), life: 2.5, iv: 0.5, onTick: z => { A.hurtCircle(z.pos.x, z.pos.z, 2.3, 18, { h: 1.2 }); S.fx.spark(z.pos.clone().add(new V3(rnd(Math.random, -1.5, 1.5), 0.1, rnd(Math.random, -1.5, 1.5))), new V3(0, 1.5, 0), { color: ACID, life: 0.6, size: 0.4, world: true }); } }); }
          }));
        }, end() { alive.forEach(free); }, cancel() { this.end(); } };
      return inst;
    };
    b.deathAnimBase = b.deathAnim;
    return b;
  }

  /* =====================================================================
     3. L'ARACHNIDE
     ===================================================================== */
  function spider(S, o) {
    const b = base(S, o, 'spider'), A = b.A, accent = 0xb45cff;
    const K = kit('spider', accent, '#4a3e58', S); b.rockMat = K.rockMat; b.glowMat = K.glowMat;
    b.size = 7; b.postureMax = 110; b.pos.set(0, 0, 10); b.vp.copy(b.pos);
    const bodyG = new THREE.Group(); b.group.add(bodyG);
    const inner = new THREE.Group(); bodyG.add(inner);   // l'export glTF place déjà l'avant (−Y Blender) vers +z
    /* reine-araignée modélisée dans Blender (outils/blender-boss-b.py → assets-boss-b.js) : céphalothorax à médaillon
       (photo), abdomen bombé à motifs lumineux, pattes épaisses en 2 segments. Sans le modèle : ancien corps. */
    const KB = (function (key) {
      const g = BR.Assets && BR.Assets.models && BR.Assets.models[key]; if (!g) return null;
      const src = {}; g.scene.traverse(n => { if (n.name && !src[n.name]) src[n.name] = n; });
      const cache = new Map(), skin = [], lum = []; b.ownMats = b.ownMats || [];
      const mat = m => {
        if (/^glow/.test(m.name)) return b.glowMat;            // couleur du stade, pulsation (stageVis)
        if (!cache.has(m)) { const c = m.clone(); if (/^lum/.test(m.name)) { c.emissiveIntensity = 2.4; lum.push(c); } else skin.push(c); b.ownMats.push(c); cache.set(m, c); }
        return cache.get(m);
      };
      return { skin, lum, p0: n => src[n] ? src[n].position.clone() : new V3(),
        get(n, keep) { const s = src[n]; if (!s) return new THREE.Group(); const c = s.clone(true); if (!keep) c.position.set(0, 0, 0);
          c.traverse(m => { if (m.isMesh) { m.material = Array.isArray(m.material) ? m.material.map(mat) : mat(m.material); m.castShadow = true; m.receiveShadow = true; } }); return c; } };
    })('boss_spider_kit');
    const roundFace = (m, r) => { m.geometry.dispose(); m.geometry = new THREE.CircleGeometry(r, 40); b.ownGeos.push(m.geometry); return m; };
    let face, abd = null, silk = null;
    if (KB) {
      const body = KB.get('sp_body'); inner.add(body);
      abd = KB.get('sp_abdomen', true); inner.add(abd);
      face = roundFace(faceMesh(b.faces[0], 1.76, accent), 0.88);
      const fa = body.getObjectByName('sp_face'); if (fa) fa.add(face); else { face.position.set(0, 0.5, 2.8); bodyG.add(face); }
      // fil de soie : quand elle bondit très haut ou tombe du plafond, un fil la relie au ciel
      const sg = new THREE.CylinderGeometry(0.05, 0.05, 1, 5, 1, true), sm2 = new THREE.MeshBasicMaterial({ color: 0xf0e8ff, transparent: true, opacity: 0.7 });
      b.ownGeos.push(sg); b.ownMats.push(sm2); silk = new THREE.Mesh(sg, sm2); silk.visible = false; b.group.add(silk);
    } else {
      inner.add(K.get('body')); inner.add(K.get('abdomen')); inner.add(K.get('fangs'));
      face = faceMesh(b.faces[0], 2.8, accent); face.position.set(0, 0.35, 1.95); bodyG.add(face);
    }
    b.faceMeshes.push(face);
    const legs = [];
    const angs = [32, 72, 108, 148];
    for (const s of [1, -1]) for (const ad of angs) {
      const a = ad * Math.PI / 180;
      const L = { hip: new V3(s * Math.sin(a) * 1.5, 0, Math.cos(a) * 1.6), rest: new V3(s * Math.sin(a) * 6.2, 0, Math.cos(a) * 5.6), foot: new V3(), from: new V3(), to: new V3(), st: 1, grp: (legs.length % 2) ^ (s > 0 ? 0 : 1) };
      L.u = KB ? KB.get('sp_leg_u') : K.get('leg_u'); L.l = KB ? KB.get('sp_leg_l') : K.get('leg_l'); b.group.add(L.u, L.l);
      legs.push(L);
    }
    // orientation d'un segment de patte : X le long du segment, dessus du modèle vers le ciel (pas de roulis arbitraire)
    const _m4 = new THREE.Matrix4(), _ly = new V3(), _lz = new V3(), UPV = new V3(0, 1, 0);
    const aim = (obj, dir) => {
      if (!KB) { obj.quaternion.setFromUnitVectors(X, dir); return; }
      _lz.crossVectors(dir, UPV); if (_lz.lengthSq() < 1e-6) _lz.set(0, 0, 1); _lz.normalize(); _ly.crossVectors(_lz, dir);
      _m4.makeBasis(dir, _ly, _lz); obj.quaternion.setFromRotationMatrix(_m4);
    };
    const L1b = 3.4, L2b = 4.6, X = new V3(1, 0, 0);
    let bodyY = 3.2, stepPh = 0;
    const toWorld = (v, y) => { const s = b.sc, c = Math.cos(b.vy), n = Math.sin(b.vy); return new V3(b.vp.x + (v.x * c + v.z * n) * s, y, b.vp.z + (-v.x * n + v.z * c) * s); };
    // ---- évolution : épines dorsales (stade 2), veines lumineuses + crocs géants (stade 3) ----
    const spines = [], veins = [];
    if (KB) {   // modèle : crête d'épines sur l'abdomen (stade 2) ; veines lumineuses + cornes de reine (stade 3)
      const sp = KB.get('sp_spines', true); sp.position.sub(KB.p0('sp_abdomen')); sp.visible = false; abd.add(sp); spines.push(sp);
      const vn = KB.get('sp_veins', true); vn.visible = false; inner.add(vn); veins.push(vn);
    }
    const spG = new THREE.ConeGeometry(0.28, 1.6, 5); b.ownGeos.push(spG);
    if (!KB) for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.32; const m = H.mesh(b, spG, K.rockMat, { p: [Math.sin(a) * 1.4, 2.2 - Math.abs(i - 3) * 0.12, -3.0 + Math.cos(a) * 0.2], r: [-0.5, 0, -a * 0.9], s: 1.1 - Math.abs(i - 3) * 0.1 }); m.add(H.mesh(b, new THREE.ConeGeometry(0.1, 0.45, 5), K.glowMat, { p: [0, 0.7, 0] })); m.visible = false; inner.add(m); spines.push(m); }
    if (!KB) for (let i = 0; i < 6; i++) { const m = H.mesh(b, new THREE.BoxGeometry(0.12, 0.1, 2.4), K.glowMat, { p: [(i % 2 ? 1 : -1) * (0.9 + (i >> 1) * 0.35), 1.4 + (i >> 1) * 0.3, -2.8], r: [0.2, (i % 2 ? 1 : -1) * 0.35, 0] }); m.visible = false; inner.add(m); veins.push(m); }
    b.onStage = function (s) {
      if (s === 2) spines.forEach((m, i) => H.grow(b, m, 1.0 + i * 0.06));
      if (s === 3) veins.forEach((m, i) => H.grow(b, m, 1.0 + i * 0.08));
    };
    legs.forEach(L => { L.foot.copy(toWorld(L.rest, 0)); });
    b.parts.push({ obj: bodyG, off: new V3(0, 0.3, 1.9), r: 1.3, weak: true });
    b.parts.push({ obj: bodyG, off: new V3(0, 0, 0.4), r: 2.0 });
    b.parts.push({ obj: bodyG, off: new V3(0, 0.8, -3.0), r: 2.6 });
    b.focus = () => b.partPos(1);
    b.blockers = () => (b.airY || 0) > 3 ? [] : [{ x: b.pos.x, z: b.pos.z, r: 2.4 * b.sc, h: bodyY + 1.5 }];
    let moving = 0, stepDip = 0, bodyTilt = 0;
    b.animate = function (dt) {
      const down = b.broken > 0 || b.dead;
      const wantY = down ? 1.4 : (b.crouch ? 2.2 : 3.2) + Math.sin(b.t * 6) * 0.06 - stepDip;
      stepDip = Math.max(0, stepDip - dt * 0.9);
      bodyY += (wantY - bodyY) * Math.min(1, dt * 8);
      // le corps penche dans le sens de la marche et tangue un peu à chaque pas
      bodyTilt += ((moving * 0.12) - bodyTilt) * Math.min(1, dt * 4);
      bodyG.position.set(b.vp.x, bodyY * b.sc + (b.airY || 0), b.vp.z); bodyG.rotation.y = b.vy; bodyG.rotation.x = (b.crouch ? 0.15 : Math.sin(b.t * 3) * 0.03) + bodyTilt; bodyG.rotation.z = Math.sin(b.t * 5.5) * 0.04 * moving; bodyG.scale.setScalar(b.sc);
      const L1 = L1b * b.sc, L2 = L2b * b.sc;
      // pattes : pas alternés quand le pied est trop loin de sa position de repos
      stepPh += dt;
      legs.forEach((L, i) => {
        const restW = toWorld(L.rest, 0);
        if (L.st >= 1) { if ((b.airY || 0) < 0.5 && L.foot.distanceTo(restW) > 2.4 && (Math.floor(stepPh * 6) % 2) === L.grp) { L.st = 0; L.from.copy(L.foot); L.to.copy(restW).add(new V3(Math.sin(b.yaw), 0, Math.cos(b.yaw)).multiplyScalar(moving * 1.2)); } }
        // pas : la patte se soulève vite, file en avant puis se pose en douceur (pas de glissement linéaire)
        if (L.st < 1) { L.st = Math.min(1, L.st + dt / 0.18); const e = L.st * L.st * (3 - 2 * L.st); L.foot.lerpVectors(L.from, L.to, e); L.foot.y = Math.pow(Math.sin(L.st * Math.PI), 0.7) * 1.2; if (L.st >= 1) { L.foot.y = 0; stepDip = Math.min(0.22, stepDip + 0.07); } }
        if ((b.airY || 0) > 0.5) { L.foot.copy(toWorld(L.rest.clone().multiplyScalar(0.6), bodyY * b.sc + b.airY - 2.5 * b.sc)); L.st = 1; }
        // IK à deux segments, genou vers le haut
        const H = toWorld(L.hip, bodyY * b.sc + (b.airY || 0));
        const dh = new V3(L.foot.x - H.x, 0, L.foot.z - H.z); const d = Math.max(0.5, dh.length()); dh.normalize();
        const dy = L.foot.y - H.y, D = Math.min(L1 + L2 - 0.05, Math.hypot(d, dy));
        const a0 = Math.atan2(dy, d), a1 = Math.acos(BR.clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
        const th = a0 + a1;
        const Kp = H.clone().addScaledVector(dh, Math.cos(th) * L1); Kp.y += Math.sin(th) * L1;
        L.u.scale.setScalar(b.sc); L.l.scale.setScalar(b.sc); L.u.position.copy(H); aim(L.u, Kp.clone().sub(H).normalize());
        L.l.position.copy(Kp); aim(L.l, L.foot.clone().sub(Kp).normalize());
      });
      moving = Math.max(0, moving - dt * 2);
      if (KB) {
        // abdomen qui respire et se balance, se dresse quand elle se ramasse ; éclat à l'impact ; yeux qui s'embrasent
        abd.rotation.set(Math.sin(b.t * 2.1) * 0.035 + (b.crouch ? 0.14 : 0), Math.sin(b.t * 1.3) * 0.06, 0);
        abd.scale.setScalar(1 + Math.sin(b.t * 2.4) * 0.018);
        const fl = b.flashT > 0 ? 0.09 : 0; KB.skin.forEach(m => m.emissive.setScalar(fl));
        const li = (2.2 + (b.stage - 1) * 0.9) * (b.broken > 0 ? 0.35 : 1) * (b.evoT >= 0 ? 1.8 : 1); KB.lum.forEach(m => { m.emissiveIntensity = li; });
        const hi = (b.airY || 0) > 6 && !b.dead;
        silk.visible = hi;
        if (hi) { const p = abd.localToWorld(new V3(0, 3.1, -2.3)), top = 46; silk.position.set(p.x, (p.y + top) / 2, p.z); silk.scale.set(b.sc, Math.max(0.1, top - p.y), b.sc); }
      }
    };
    b.move = function (dt) {
      const tp = b.targetPos(), away = b.pos.clone().sub(tp).setY(0); if (away.lengthSq() < 0.01) away.set(1, 0, 0);
      away.normalize(); b.orbit = b.orbit || (b.rng() < 0.5 ? 1 : -1);
      const want = tp.clone().add(away.applyAxisAngle(new V3(0, 1, 0), 0.5 * b.orbit).multiplyScalar(10)); want.y = 0;
      const r = Math.hypot(want.x, want.z); if (r > 26) want.multiplyScalar(26 / r);
      const d = want.clone().sub(b.pos).setY(0), L = d.length();
      if (L > 0.5) { b.pos.addScaledVector(d.normalize(), Math.min(L, 8.5 * b.speed * dt)); moving = 1; }
      b.faceToward(dt, tp, 4);
      if (b.rng() < dt * 0.15) b.orbit *= -1;
      // bonds latéraux imprévisibles
      if (b.rng() < dt * 0.5 && !b.insts.length) { const side = new V3(-Math.cos(b.yaw), 0, Math.sin(b.yaw)).multiplyScalar((b.rng() < 0.5 ? -1 : 1) * (5 + b.rng() * 4)); let q = b.pos.clone().add(side); const r2 = q.length(); if (r2 > 25) q.multiplyScalar(25 / r2); b.begin('skitter', { nx: +q.x.toFixed(2), nz: +q.z.toFixed(2), keep: 1 }); }
    };
    b.choose = function () {
      const tp = b.targetPos(), d = Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z), nAdds = b.adds.filter(a => a.alive).length;
      const n = b.nPlayers();
      const sg = b.stage;
      const L = [['charge', d > 7 ? 3 : 1, 1.5, null, ['stab', null, 0.15, 1]], ['pounce', 2.5, 1.1, null, ['pounce', null, 0.15, sg > 1 ? 3 : 2]], ['web', 1.6, 1.7, { pts: b.targetsPts(4) }], ['stab', d < 8 ? 3 : 0, 1.1, null, ['charge', null, 0.2, 1]], ['frenzy', d < 12 ? 3 : 0.8, 1.2]];
      if (nAdds < 3) L.push(['brood', 1.2, 2.0]);
      if (n > 1) L.push(['pounce', 2, 1.0, null, ['pounce', null, 0.1, Math.min(4, n + 1)]]);
      if (sg >= 2) L.push(['venom', 1.8, 2.0, { pts: b.rainPts(8 + n * 3, 7) }], ['charge', 2, 1.0, null, ['charge', null, 0.15, 2]], ['prison', 2.2, 1.4, { gap: +(b.rng() * 6.283).toFixed(2) }]);
      if (sg >= 3 && b.t - (b.lastDrop || -99) > 18) L.push(['drop', 3, 1.6]);
      const x = b.weighted(L); if (x[0] === 'drop') b.lastDrop = b.t;
      return [x[0], x[2], x[3], x[4]];
    };
    b.attacks.charge = (P) => {
      const p0 = new V3(P.x, 0, P.z), dir = new V3(P.tx - P.x, 0, P.tz - P.z).normalize(), yaw = Math.atan2(dir.x, dir.z);
      let len = 28; for (let k = 0; k < 40; k++) { const q = p0.clone().addScaledVector(dir, len); if (Math.hypot(q.x, q.z) < 30) break; len -= 1; }
      S.fx.decal(p0, 'line', { len, width: 4.6, yaw, color: 0xff3020, dur: 0.9 });
      A.sfx('roar', { rate: 2.2, g: 0.5 });
      const inst = { dur: 0.9 + len / 26 + 0.4, main: true, ownsMove: true,
        update(t, dt) {
          b.yaw = yaw; b.crouch = t < 0.9;
          if (t >= 0.9) { const k = Math.min(1, (t - 0.9) * 26 / len); b.pos.copy(p0).addScaledVector(dir, len * k); A.hurtCircle(b.pos.x, b.pos.z, 3.2, 140, { kb: 12, up: 5 }, inst, 'ch'); if (Math.random() < 0.7) S.fx.burst(b.pos.clone().setY(0.3), { n: 3, color: 0x4a3e58, kind: 'smoke', speed: 4, up: 0.5, life: 0.7, size: 1, size1: 2, world: true }); if (!inst.s) { inst.s = 1; A.sfx('dash', { g: 2, rate: 0.5 }); } }
        }, end() { b.crouch = false; }, cancel() { b.crouch = false; } };
      return inst;
    };
    b.attacks.pounce = (P) => {
      const p0 = new V3(P.x, 0, P.z), p1 = new V3(P.tx, 0, P.tz); const r = Math.hypot(p1.x, p1.z); if (r > 26) p1.multiplyScalar(26 / r);
      const W = 0.35, F = 0.7;     // préparation courte, vol rapide : enchaînable
      S.fx.decal(p1, 'circle', { r: 6, color: 0xff3020, dur: W + F });
      const inst = { dur: W + F + 0.45, main: true, ownsMove: true,
        update(t) {
          b.crouch = t < W;
          if (t >= W && t < W + F) { const k = (t - W) / F; b.pos.lerpVectors(p0, p1, ease(k)); b.airY = Math.sin(k * Math.PI) * 7; b.yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z); }
          else b.airY = 0;
          if (t >= W + F && !inst.hit) { inst.hit = 1; b.pos.copy(p1); S.fx.flash(p1.clone().setY(1), { color: accent, r: 3, life: 0.3, intensity: 6 }); S.fx.ring(p1, { r1: 9, color: accent, life: 0.45 }); S.fx.burst(p1.clone().setY(0.3), { n: 50, color: 0x4a3e58, kind: 'smoke', speed: 12, up: 1, life: 0.9, size: 0.45, grav: 20, world: true }); A.sfx('stomp'); A.shake(0.7); A.hurtCircle(p1.x, p1.z, 6, 170, { up: 7, kb: 10 }, inst, 'p'); }
        }, end() { b.airY = 0; b.crouch = false; }, cancel() { this.end(); } };
      return inst;
    };
    b.attacks.skitter = (P) => {
      const p0 = new V3(P.x, 0, P.z), p1 = new V3(P.nx, 0, P.nz);
      const inst = { dur: 0.28, main: true, ownsMove: true, update(t) { b.pos.lerpVectors(p0, p1, ease(t / 0.28)); if (Math.random() < 0.5) S.fx.burst(b.pos.clone().setY(0.2), { n: 2, color: 0x4a3e58, kind: 'smoke', speed: 3, life: 0.5, size: 1, size1: 1.8, world: true }); } };
      A.sfx('dash', { g: 0.7, rate: 0.6 });
      return inst;
    };
    b.attacks.web = (P, r) => {
      const pts = []; const tgts = P.pts || [[P.tx, P.tz]];
      tgts.forEach(q => { pts.push(new V3(q[0], 0, q[1])); });
      for (let i = pts.length; i < 5; i++) { const q = tgts[i % tgts.length], a = r() * 6.283, d = 2 + r() * 5; pts.push(new V3(q[0] + Math.cos(a) * d, 0, q[1] + Math.sin(a) * d)); }
      const inst = { dur: 1.4, main: true,
        update(t) {
          b.crouch = t < 0.4;
          if (t > 0.4 && !inst.f) {
            inst.f = 1; A.sfx('magic', { rate: 0.4, g: 0.8 });
            pts.forEach(q => {
              const from = b.partPos(2), T = 0.9, g = 18;
              S.fx.decal(q, 'circle', { r: 3.2, color: 0xe0d0ff, dur: T });
              A.eproj({ pos: from, vel: new V3((q.x - from.x) / T, (0 - from.y) / T + 0.5 * g * T, (q.z - from.z) / T), grav: g, r: 0.7, dmg: 40, color: 0xf0e8ff, life: T + 0.2,
                onEnd: p => { const z0 = new V3(p.pos.x, 0, p.pos.z); S.fx.decal(z0, 'ring', { r: 3.2, inner: 0.15, color: 0xe8e0ff, dur: 0.1, hold: 5.9 }); A.ezone({ pos: z0, life: 6, iv: 0.2, onTick: z => { const f = A.me(); if (f.alive && f.pos.y < 0.5 && Math.hypot(f.pos.x - z.pos.x, f.pos.z - z.pos.z) < 3.2) f.slow = Math.max(f.slow, 0.3); } }); } });
            });
          }
        }, end() { b.crouch = false; }, cancel() { this.end(); } };
      return inst;
    };
    b.attacks.stab = (P) => {
      const p0 = new V3(P.x, 0, P.z), yaw = Math.atan2(P.tx - P.x, P.tz - P.z);
      S.fx.decal(p0, 'sector', { r: 8, arc: 1.3, yaw, color: 0xff3020, dur: 0.6, hold: 0.7 });
      const inst = { dur: 1.6, main: true, ownsMove: true,
        update(t) { b.yaw = yaw; for (const t0 of [0.6, 1.05]) if (t >= t0 && !inst['s' + t0]) { inst['s' + t0] = 1; S.fx.slash(p0.clone().setY(2), yaw, { r: 8, arc: 1.3, tilt: 1.2, color: accent, life: 0.25, world: true }); A.sfx('swingBig', { rate: 0.8 }); A.shake(0.3); A.hurtSector(P.x, P.z, yaw, 8, 1.3, 120, { kb: 8 }, inst, 's' + t0); } } };
      return inst;
    };
    b.attacks.venom = (P) => { const r = b.rain(P, 2.8, 0x9aff40, 0, 0x5aff40); r.main = true; A.sfx('roar', { rate: 1.8, g: 0.5 }); return r; };
    // frénésie : 4 à 5 coups de pattes en avançant, rythme irrégulier (le dernier est retardé)
    b.attacks.frenzy = (P, r) => {
      const n = (P.sg || 1) >= 3 ? 5 : 4, hits = []; let t = 0.55;
      for (let i = 0; i < n; i++) { const last = i === n - 1; hits.push({ t, w: last ? 0.75 + r() * 0.3 : 0.42, arc: last ? 2.2 : 1.2, R: last ? 9 : 7, big: last }); if (i < n - 1) t += 0.38 + r() * 0.18 + (i === n - 2 ? 0.55 : 0); }
      const tg = () => { const p = A.player(P.tg); return p && p.alive ? p.pos : new V3(P.tx, 0, P.tz); };
      A.sfx('roar', { rate: 2.3, g: 0.45 });
      const inst = { dur: t + 0.9, main: true, ownsMove: true,
        update(tt, dt) {
          b.crouch = false;
          hits.forEach((h, i) => {
            if (tt >= h.t - h.w && tt < h.t) { b.faceToward(dt, tg(), 7); const fw = new V3(Math.sin(b.yaw), 0, Math.cos(b.yaw)), d = Math.hypot(tg().x - b.pos.x, tg().z - b.pos.z); if (d > 5) b.pos.addScaledVector(fw, Math.min(d - 5, 9 * dt)); const q = H.clampR(b.pos.x, b.pos.z, 26); b.pos.x = q[0]; b.pos.z = q[1]; }
            if (tt >= h.t - h.w && !h.d) { h.d = 1; h.yaw = b.yaw; h.x = b.pos.x; h.z = b.pos.z; h.dec = S.fx.decal(b.pos, 'sector', { r: h.R, arc: h.arc, yaw: b.yaw, color: 0xff3020, dur: h.w, hold: 0.1 }); }
            if (h.dec && tt < h.t) { h.yaw = b.yaw; h.x = b.pos.x; h.z = b.pos.z; h.dec.set(b.pos, b.yaw); }
            if (tt >= h.t && !h.h) { h.h = 1; S.fx.slash(new V3(h.x, 2, h.z), h.yaw, { r: h.R, arc: h.arc, tilt: (i % 2 ? -1 : 1) * 1.1, color: accent, life: 0.25, world: true }); A.sfx('swingBig', { rate: h.big ? 0.6 : 0.9 }); A.shake(h.big ? 0.5 : 0.2); A.hurtSector(h.x, h.z, h.yaw, h.R, h.arc, h.big ? 170 : 95, { kb: h.big ? 12 : 5, up: h.big ? 5 : 2 }, inst, 'f' + i); }
          });
        }, end() { b.crouch = false; }, cancel() { b.crouch = false; } };
      return inst;
    };
    // prison de soie (stade 2+) : un cercle de piliers de toile autour de la cible, une seule sortie, puis bond au centre
    b.attacks.prison = (P) => {
      const c = new V3(P.tx, 0, P.tz), R = 7.5, N = 14, gap = P.gap || 0, posts = [];
      { const q = H.clampR(c.x, c.z, 24); c.x = q[0]; c.z = q[1]; }
      const col = new THREE.Color(0xe8e0ff).multiplyScalar(1.6);
      for (let i = 0; i < N; i++) { const a = gap + (i + 1) / (N + 1.2) * 6.283; const m = new THREE.Mesh(S.fx.geo.cyl, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 })); m.scale.set(0.35, 0.01, 0.35); m.position.set(c.x + Math.sin(a) * R, 0, c.z + Math.cos(a) * R); posts.push({ x: m.position.x, z: m.position.z }); S.fx.add(m, 3.2, (k, o2, dt, t) => { o2.scale.y = Math.min(4, t * 14); o2.material.opacity = 0.85 * (k > 0.85 ? (1 - k) / 0.15 : 1); }, true); }
      S.fx.decal(c, 'circle', { r: R, color: 0xff3020, dur: 1.9, hold: 0.1 });
      S.fx.decal(new V3(c.x + Math.sin(gap) * R, 0, c.z + Math.cos(gap) * R), 'circle', { r: 1.6, color: 0x60ffb0, dur: 1.9, noWarn: true });
      A.sfx('magic', { rate: 0.35, g: 0.9 });
      const p0 = new V3(P.x, 0, P.z), W = 1.1, F = 0.8;
      const inst = { dur: W + F + 1.3, main: true, ownsMove: true,
        update(t) {
          // toucher un pilier : englué et blessé
          if (t < W + F + 1.0) { const f = A.me(); for (const p of posts) if (Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < 0.9 && f.pos.y < 3.5) { if (A.hurtCircle(p.x, p.z, 0.9, 45, { kb: 6, h: 4 }, inst, 'p')) f.slow = Math.max(f.slow, 1.2); break; } }
          b.crouch = t < W;
          if (t >= W && t < W + F) { const k = (t - W) / F; b.pos.lerpVectors(p0, c, ease(k)); b.airY = Math.sin(k * Math.PI) * 9; b.yaw = Math.atan2(c.x - p0.x, c.z - p0.z); }
          else b.airY = 0;
          if (t >= W + F && !inst.h) { inst.h = 1; b.pos.copy(c); H.blast(b, inst, 'pr', c.x, c.z, R - 0.3, 200, accent, { g: 0.9, rate: 1, shake: 0.8, light: true, smoke: 0x4a3e58 }); A.sfx('stomp'); }
        }, end() { b.airY = 0; b.crouch = false; }, cancel() { this.end(); } };
      return inst;
    };
    // chute du plafond (stade 3) : saute hors de vue puis retombe trois fois ; chaque impact suit sa cible avant de se figer
    b.attacks.drop = (P) => {
      const drops = [0, 1, 2].map(i => ({ t: 1.9 + i * 1.3, lock: 0.45, track: 0.95 }));
      A.sfx('roar', { rate: 1.6, g: 0.8 });
      const tg = () => { const p = A.player(P.tg); return p && p.alive ? p.pos : new V3(P.tx, 0, P.tz); };
      const inst = { dur: drops[2].t + 0.9, main: true, ownsMove: true,
        update(t, dt) {
          if (t < 0.9) { b.crouch = t < 0.45; if (t >= 0.45) b.airY = ease((t - 0.45) / 0.45) * 40; }
          drops.forEach((d, i) => {
            const t0 = d.t - d.track - d.lock;
            if (t >= t0 && !d.dec) { const q = tg(); d.x = q.x; d.z = q.z; d.dec = S.fx.decal(q, 'circle', { r: 5.5, color: 0xff3020, dur: d.track + d.lock }); A.sfx('charge', { len: 1.2, g: 0.4 }); }
            if (d.dec && t < d.t - d.lock) { const q = tg(); d.x += (q.x - d.x) * Math.min(1, dt * 5); d.z += (q.z - d.z) * Math.min(1, dt * 5); const c = H.clampR(d.x, d.z, 27); d.x = c[0]; d.z = c[1]; d.dec.set({ x: d.x, z: d.z }); }
            if (t >= d.t - 0.3 && t < d.t) { b.pos.set(d.x, 0, d.z); b.airY = 40 * (1 - ease((t - d.t + 0.3) / 0.3)); }
            if (t >= d.t && !d.h) { d.h = 1; b.pos.set(d.x, 0, d.z); b.airY = 0; H.blast(b, inst, 'dr' + i, d.x, d.z, 5.5, 170, accent, { g: 0.9, rate: 1, shake: 0.8, light: true, smoke: 0x4a3e58 }); A.sfx('stomp'); H.wave(b, d.x, d.z, { r0: 5, rMax: 16, dmg: 70, color: accent }); }
            if (i < 2 && t >= d.t + 0.35 && t < drops[i + 1].t - 0.3) b.airY = Math.min(40, (t - d.t - 0.35) * 90);
          });
        }, end() { b.airY = 0; b.crouch = false; }, cancel() { this.end(); } };
      return inst;
    };
    // --- petites araignées kamikazes ---
    const MAXA = 8;
    function makeAdd(i, x, z) {
      const g = new THREE.Group(); b.group.add(g);
      const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), K.rockMat); bodyM.position.y = 0.6; g.add(bodyM);
      const fm = faceMesh(b.faces[(i + 1) % b.faces.length], 1.3, accent); fm.position.set(0, 0.85, 0.45); g.add(fm); b.faceMeshes.push(fm);
      const lg = []; for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.1, 4), K.rockMat); m.position.set((k % 2 ? 1 : -1) * 0.5, 0.35, (Math.floor(k / 2) - 1) * 0.35); m.rotation.z = (k % 2 ? 1 : -1) * 1.0; g.add(m); lg.push(m); }
      const a = { i, g, fm, lg, pos: new V3(x, 0, z), y: 0.7, r: 0.9, hp: 700 * b.S.diff.hp, alive: true, arm: 0 };
      return a;
    }
    b.killAdd = function (i, silent) {
      const a = b.adds[i]; if (!a || !a.alive) return;
      a.alive = false; b.group.remove(a.g); b.faceMeshes = b.faceMeshes.filter(m => m !== a.fm);
      if (!silent) { S.fx.burst(a.pos.clone().setY(0.6), { n: 30, color: accent, speed: 8, life: 0.5 }); A.sfx('hit', { rate: 0.6 }); }
    };
    b.attacks.brood = (P, r) => {
      const inst = { dur: 1.2, main: true,
        update(t) {
          b.crouch = t < 0.8;
          if (t > 0.8 && !inst.f) { inst.f = 1; A.sfx('roar', { rate: 2.5, g: 0.4 });
            for (let k = 0; k < 4; k++) { let slot = b.adds.findIndex(a => !a || !a.alive); if (slot < 0) slot = b.adds.length; if (slot >= MAXA) break; const ab = b.partPos(2); const a = makeAdd(slot, ab.x + (r() - 0.5) * 4, ab.z + (r() - 0.5) * 4); b.adds[slot] = a; S.fx.burst(a.pos.clone().setY(0.5), { n: 20, color: accent, speed: 6, life: 0.5 }); }
          }
        }, end() { b.crouch = false; }, cancel() { this.end(); } };
      return inst;
    };
    b.attacks._boom = (P) => {
      const p = new V3(P.ax, 0.5, P.az);
      S.fx.flash(p, { color: accent, r: 2.4, life: 0.3, intensity: 5 }); S.fx.ring(p.clone().setY(0.05), { r1: 4, color: accent, life: 0.35 }); S.fx.burst(p, { n: 40, color: accent, speed: 12, life: 0.5 }); A.sfx('boom', { g: 0.6, rate: 1.4, len: 0.6 });
      const inst = { dur: 0.1, main: false, update() { A.hurtCircle(P.ax, P.az, 2.8, 90, { kb: 8, up: 4 }, inst, 'x'); } };
      if (P.ai != null && b.adds[P.ai] && b.adds[P.ai].alive) b.killAdd(P.ai, true);
      return inst;
    };
    b.updateAdds = function (dt) {
      b.adds.forEach(a => {
        if (!a || !a.alive) return;
        a.g.position.copy(a.pos); a.lg.forEach((m, k) => { m.rotation.x = Math.sin(b.t * 20 + k) * 0.5; });
        if (a.arm > 0) { a.fm.userData.U.hit.value = 0.5 + 0.5 * Math.sin(b.t * 40); }
      });
    };
    b.thinkAdds = function (dt) {
      b.adds.forEach(a => {
        if (!a || !a.alive) return;
        let tg = null, td = 1e9; for (const f of A.players()) { const d = f.pos.distanceTo(a.pos); if (d < td) { td = d; tg = f; } }
        if (!tg) return;
        if (a.arm > 0) { a.arm -= dt; if (a.arm <= 0) { const P = { k: 'ba', n: '_boom', s: 1, ax: +a.pos.x.toFixed(2), az: +a.pos.z.toFixed(2), ai: a.i }; A.hostSend(P); b.startAttack('_boom', P); } return; }
        const d = tg.pos.clone().sub(a.pos).setY(0); a.g.rotation.y = Math.atan2(d.x, d.z);
        if (td < 2.2) a.arm = 0.6; else a.pos.addScaledVector(d.normalize(), 6.2 * b.speed * dt);
      });
    };
    b.extraState = () => b.adds.map(a => a && a.alive ? [+a.pos.x.toFixed(1), +a.pos.z.toFixed(1), a.arm > 0 ? 1 : 0] : 0);
    b.applyExtra = ex => {
      ex.forEach((s, i) => {
        const a = b.adds[i];
        if (s && (!a || !a.alive)) b.adds[i] = makeAdd(i, s[0], s[1]);
        else if (!s && a && a.alive) b.killAdd(i);
        if (s && b.adds[i]) { b.adds[i].pos.lerp(new V3(s[0], 0, s[1]), 0.5); b.adds[i].arm = s[2] ? 0.3 : 0; }
      });
      for (let i = ex.length; i < b.adds.length; i++) if (b.adds[i] && b.adds[i].alive) b.killAdd(i);
    };
    return b;
  }

  /* =====================================================================
     4. L'ŒIL ABYSSAL
     ===================================================================== */
  function eye(S, o) {
    const b = base(S, o, 'eye'), A = b.A, accent = 0x3ad6ff;
    const K = kit('eye', accent, '#3a4458', S); b.rockMat = K.rockMat; b.glowMat = K.glowMat;
    b.size = 8; b.postureMax = 120; b.pos.set(0, 0, 10); b.vp.copy(b.pos);
    const G = new THREE.Group(); b.group.add(G);
    /* monstre modélisé dans Blender (outils/blender-boss-b.py → assets-boss-b.js) : globe oculaire géant (iris strié,
       pupille en fente, paupières à cils d'os), carapace couronnée de cornes avec un médaillon (photo), tentacules,
       anneaux runiques, yeux-satellites dont l'iris est une photo. Sans le modèle : ancien corps. */
    const KB = (function (key) {
      const g = BR.Assets && BR.Assets.models && BR.Assets.models[key]; if (!g) return null;
      const src = {}; g.scene.traverse(n => { if (n.name && !src[n.name]) src[n.name] = n; });
      const cache = new Map(), skin = [], lum = []; b.ownMats = b.ownMats || [];
      const mat = m => {
        if (/^glow/.test(m.name)) return b.glowMat;
        if (!cache.has(m)) { const c = m.clone(); if (/^lum/.test(m.name)) { c.emissiveIntensity = 2.4; lum.push(c); } else skin.push(c); b.ownMats.push(c); cache.set(m, c); }
        return cache.get(m);
      };
      return { skin, lum, p0: n => src[n] ? src[n].position.clone() : new V3(),
        get(n, keep) { const s = src[n]; if (!s) return new THREE.Group(); const c = s.clone(true); if (!keep) c.position.set(0, 0, 0);
          c.traverse(m => { if (m.isMesh) { m.material = Array.isArray(m.material) ? m.material.map(mat) : mat(m.material); m.castShadow = true; m.receiveShadow = true; } }); return c; } };
    })('boss_eye_kit');
    const roundFace = (m, r) => { m.geometry.dispose(); m.geometry = new THREE.CircleGeometry(r, 40); b.ownGeos.push(m.geometry); return m; };
    let face; const EYE = {};
    if (KB) {
      const shell = KB.get('ey_shell'); G.add(shell);
      face = roundFace(faceMesh(b.faces[0], 1.8, accent), 0.9);
      const fa = shell.getObjectByName('ey_face'); if (fa) fa.add(face); else { face.position.set(0, 3.4, 2.0); G.add(face); }
      // le globe pivote dans son orbite pour suivre sa cible ; l'iris tourne lentement ; la pupille se dilate
      EYE.look = new THREE.Group(); G.add(EYE.look);
      EYE.iris = KB.get('ey_iris'); EYE.pupil = KB.get('ey_pupil', true); EYE.look.add(KB.get('ey_ball'), EYE.iris, EYE.pupil);
      EYE.lidU = KB.get('ey_lidU'); EYE.lidL = KB.get('ey_lidL'); G.add(EYE.lidU, EYE.lidL);
      EYE.blink = 0; EYE.nextBlink = 2; EYE.pit = 0; EYE.yo = 0; EYE.dil = 1;
      // tentacules : 6 chaînes de 3 segments sous la carapace
      EYE.tents = [];
      for (let i = 0; i < 6; i++) {
        const a = (i + 0.5) / 6 * 6.283, p0 = new THREE.Group(); p0.position.set(Math.sin(a) * 2.1, -2.1, Math.cos(a) * 2.1); p0.rotation.order = 'YXZ'; p0.rotation.y = a; G.add(p0);
        const p1 = new THREE.Group(), p2 = new THREE.Group(); p1.position.y = -1.5; p2.position.y = -1.3;
        p0.add(KB.get('ey_tent_a'), p1); p1.add(KB.get('ey_tent_b'), p2); p2.add(KB.get('ey_tent_c'));
        EYE.tents.push([p0, p1, p2]);
      }
    } else {
      const shell = K.get('shell'); G.add(shell);
      face = faceMesh(b.faces[0], 5.2, accent); face.position.set(0, 0, 2.9); G.add(face);
    }
    b.faceMeshes.push(face);
    const ringPiece = () => { const g = new THREE.Group(); if (KB) g.add(KB.get('ey_ring')); else g.add(K.get('ring'), K.get('ring_core')); return g; };
    const ringG = [ringPiece(), ringPiece()]; ringG.forEach((g, i) => { g.scale.setScalar(i ? 1.15 : 0.95); b.group.add(g); });
    // ---- évolution : troisième anneau (stade 2), éclats de cristal en orbite + pointes sur la coque (stade 3) ----
    { const g = ringPiece(); b.group.add(g); ringG.push(g); g.children.forEach(c => { c.visible = false; }); }
    const shards = [];
    for (let i = 0; i < 8; i++) { const m = H.mesh(b, new THREE.OctahedronGeometry(0.5, 0), K.glowMat, { s: [0.5, 1.4, 0.5] }); m.visible = false; G.add(m); shards.push(m); }
    const horns = [];
    if (KB) { const m = KB.get('ey_horns'); m.visible = false; G.add(m); horns.push(m); }
    else for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; const m = H.mesh(b, new THREE.ConeGeometry(0.45, 2.4, 5), K.rockMat, { p: [Math.sin(a) * 2.9, Math.cos(a) * 2.9, -0.8], r: [Math.cos(a) * -1.3, 0, Math.sin(a) * 1.3] }); m.visible = false; G.add(m); horns.push(m); }
    b.onStage = function (s) {
      if (s === 2) ringG[2].children.forEach(c => H.grow(b, c, 1.0));
      if (s === 3) { shards.forEach((m, i) => H.grow(b, m, 1.0 + i * 0.07)); horns.forEach((m, i) => H.grow(b, m, 1.1 + i * 0.08)); }
    };
    const sats = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(); let fm;
      if (KB) {   // œil-satellite : orbite de chair cerclée d'os, la photo en guise d'iris
        const sp = KB.get('ey_sat'); g.add(sp); fm = roundFace(faceMesh(b.faces[(i + 1) % b.faces.length], 1.6, accent), 0.8);
        const fa = sp.getObjectByName('ey_satface'); if (fa) fa.add(fm); else { fm.position.z = 0.35; g.add(fm); }
      } else { g.add(K.get('sat')); fm = faceMesh(b.faces[(i + 1) % b.faces.length], 1.9, accent); fm.position.z = 1.1; g.add(fm); }
      b.faceMeshes.push(fm); b.group.add(g); sats.push({ g, fm, ph: i / 6 * 6.283, gone: 0 });
    }
    const halo = new THREE.PointLight(accent, 4, 30, 2); G.add(halo);
    let hover = 4.8, wantH = 4.8;
    b.parts.push({ obj: G, off: new V3(0, 0, 0.5), r: 3.4, weak: false });
    b.focus = () => G.position.clone();
    b.blockers = () => [{ x: b.pos.x, z: b.pos.z, r: 2.8, h: hover + 3 }];
    b.animate = function (dt) {
      wantH = b.dead ? 1 : b.broken > 0 || b.tired ? 2.4 : 4.8;
      hover += (wantH - hover) * Math.min(1, dt * 3);
      G.position.set(b.vp.x, hover + Math.sin(b.t * 1.3) * 0.3 + (b.airY || 0), b.vp.z); G.rotation.y = b.vy; G.scale.setScalar(b.sc * (b.gs == null ? 1 : b.gs)); G.rotation.x = Math.sin(b.t * 0.8) * 0.05;
      b.parts[0].weak = b.broken > 0 || !!b.tired;
      ringG.forEach((g, i) => { g.position.copy(G.position); g.scale.setScalar([0.95, 1.15, 1.4][i] * b.sc); });
      ringG[0].rotation.set(b.t * 0.7, b.t * 0.4, 0.3); ringG[1].rotation.set(-b.t * 0.5 + 1, 0.6, b.t * 0.6); ringG[2].rotation.set(1.2, b.t * 1.1, -b.t * 0.35);
      shards.forEach((m, i) => { const a = b.t * 1.4 + i / shards.length * 6.283; m.position.set(Math.sin(a) * 4.2, Math.sin(b.t * 2 + i) * 1.4, Math.cos(a) * 4.2); m.rotation.set(b.t * 2 + i, b.t, 0); });
      sats.forEach((s, i) => { s.gone = Math.max(0, s.gone - dt); s.g.visible = s.gone <= 0; const a = s.ph + b.t * 0.9; s.g.position.set(b.vp.x + Math.cos(a) * 6.5 * b.sc, hover + Math.sin(b.t * 2 + i) * 1.2 + 0.5 + (b.airY || 0), b.vp.z + Math.sin(a) * 6.5 * b.sc); s.g.lookAt(S.me.center()); });
      halo.intensity = 3 + Math.sin(b.t * 4) * 1;
      if (Math.random() < dt * 8) S.fx.spark(G.position.clone().add(new V3(rnd(Math.random, -3, 3), rnd(Math.random, -3, 3), rnd(Math.random, -3, 3))), new V3(0, -1, 0), { color: accent, life: 1, size: 0.4, size1: 0.05, world: true });
      if (KB) {
        // regard : le globe suit sa cible (lacet + tangage), les paupières accompagnent le tangage et clignent
        const tg = b.target && b.target.alive ? b.target.pos : null;
        let wy = 0, wp = 0.2;
        if (tg) { const dx = tg.x - G.position.x, dz = tg.z - G.position.z; wy = BR.clamp(BR.angDiff(b.vy, Math.atan2(dx, dz)), -0.45, 0.45); wp = BR.clamp(Math.atan2(G.position.y - 1.2, Math.max(1, Math.hypot(dx, dz))), -0.1, 0.32); }
        EYE.yo += (wy - EYE.yo) * Math.min(1, dt * 6); EYE.pit += (wp - EYE.pit) * Math.min(1, dt * 5);
        EYE.look.rotation.order = 'YXZ'; EYE.look.rotation.set(EYE.pit, EYE.yo, 0);
        EYE.iris.rotation.z += dt * (0.25 + (b.stage - 1) * 0.2);
        const weak = b.broken > 0 || !!b.tired, busy = b.insts.some(x => x.main);
        EYE.dil += ((weak ? 1.8 : busy ? 0.4 : 0.7 + Math.sin(b.t * 0.7) * 0.12) - EYE.dil) * Math.min(1, dt * 5);
        EYE.pupil.scale.set(EYE.dil, 0.9 + EYE.dil * 0.1, 1);
        EYE.nextBlink -= dt; if (EYE.nextBlink <= 0) { EYE.blink = 0.001; EYE.nextBlink = 2.5 + Math.random() * 3.5; }
        let close = 0; if (EYE.blink > 0) { EYE.blink += dt; close = Math.sin(Math.min(1, EYE.blink / 0.24) * Math.PI); if (EYE.blink > 0.24) EYE.blink = 0; }
        if (b.dead) close = Math.min(1, b.deadT / 1.5); else if (weak) close = -0.1; else if (busy) close = Math.max(close, 0.22);
        EYE.lidU.rotation.x = EYE.pit * 0.6 + close * 0.78; EYE.lidL.rotation.x = EYE.pit * 0.6 - close * 0.78;
        // tentacules en corolle (au-dessus du sol), ondulation décalée segment par segment ; repliées vers le haut près du sol
        const low = BR.clamp((4.8 - hover) / 2.4, 0, 1);
        EYE.tents.forEach((t, i) => { const ph = b.t * 1.7 + i * 1.1; t[0].rotation.x = -1.05 - low * 0.45 + Math.sin(ph) * 0.12; t[0].rotation.z = Math.sin(ph * 0.7) * 0.1; t[1].rotation.x = -0.25 - low * 0.35 + Math.sin(ph - 0.9) * 0.22; t[2].rotation.x = -0.25 - low * 0.4 + Math.sin(ph - 1.8) * 0.32; });
        const fl = b.flashT > 0 ? 0.09 : 0; KB.skin.forEach(m => m.emissive.setScalar(fl));
        const li = (1.6 + (b.stage - 1) * 0.6) * (weak ? 1.8 : 1); KB.lum.forEach(m => { m.emissiveIntensity = li; });
        // aura du vide : volutes sombres autour du globe
        if (!b.dead && Math.random() < dt * 5) S.fx.spark(G.position.clone().add(new V3(rnd(Math.random, -4, 4), rnd(Math.random, -3, 2), rnd(Math.random, -4, 4))), new V3(0, 0.6, 0), { color: 0x1a0a33, kind: 'smoke', life: 1.8, size: 2.2, size1: 3.6, world: true, alpha: 0.45 });
      }
    };
    b.move = function (dt) {
      const tp = b.targetPos(), away = b.pos.clone().sub(tp).setY(0); if (away.lengthSq() < 0.01) away.set(0, 0, 1); away.normalize();
      const want = tp.clone().addScaledVector(away, 7.5); want.y = 0; const r = Math.hypot(want.x, want.z); if (r > 24) want.multiplyScalar(24 / r);
      const d = want.sub(b.pos).setY(0), L = d.length(); if (L > 0.3) b.pos.addScaledVector(d.normalize(), Math.min(L, 4.5 * b.speed * dt));
      b.faceToward(dt, tp, 2.5);
      if (b.rng() < dt * 0.35 && !b.insts.length) { const a = b.rng() * 6.283, rr = 6 + b.rng() * 14; b.begin('blink', { nx: +(Math.cos(a) * rr).toFixed(2), nz: +(Math.sin(a) * rr).toFixed(2), keep: 1 }); }
    };
    b.choose = function () {
      const n = b.nPlayers(), rp = () => { const a = b.rng() * 6.283; return { nx: +(Math.cos(a) * 14).toFixed(2), nz: +(Math.sin(a) * 14).toFixed(2) }; };
      const sg = b.stage;
      const L = [['spiral', 2.2, 1.6], ['rings', 2.2, 1.5], ['sweep', 1.8, 1.8], ['nova', 2, 1.3, rp(), ['dashlaser', null, 0.2, 1]], ['dashlaser', 2.6, 1.3, null, ['rings', null, 0.3, 1]], ['sats', sats.every(s => s.gone <= 0) ? 2 : 0, 1.5], ['cross', 2.2, 1.6]];
      if (n > 1) L.push(['gaze', 2.5, 2.0, { ids: A.players().map(p => p.id) }]);
      if (sg >= 2) L.push(['gaze', 2.2, 1.6, { ids: A.players().map(p => p.id) }, ['spiral', null, 0.2, 1]], ['dashlaser', 1.8, 1.0, null, ['dashlaser', null, 0.2, 2]], ['curtain', 2.4, 1.5, null, ['cross', null, 0.3, 1]]);
      if (sg >= 3 && b.t - (b.lastAbyss || -99) > 22) L.push(['abyss', 4, 1.6]);
      const x = b.weighted(L); if (x[0] === 'abyss') b.lastAbyss = b.t;
      return [x[0], x[2], x[3] || null, x[4]];
    };
    const bullet = (p, v, c, r) => A.eproj({ pos: p, vel: v, r: r || 0.55, dmg: 55, color: c || accent, life: 5 });
    b.attacks.spiral = (P) => {
      const p0 = new V3(P.x, 1.15, P.z), arms = b.phase > 1 ? 5 : 4, dir = (P.s % 2) ? 1 : -1;
      A.sfx('charge', { len: 0.6, g: 0.7 });
      const inst = { dur: 3.6, main: true, acc: 0, n: 0,
        update(t, dt) {
          if (t < 0.6) return;
          inst.acc += dt;
          while (inst.acc >= 0.11) { inst.acc -= 0.11; inst.n++; const base = inst.n * 0.17 * dir; for (let k = 0; k < arms; k++) { const a = base + k / arms * 6.283; bullet(p0.clone(), new V3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(9 * b.speed)); } if (inst.n % 3 === 0) A.sfx('magic', { g: 0.25, rate: 1.6 }); }
        } };
      return inst;
    };
    b.attacks.rings = (P, r) => {
      const p0 = new V3(P.x, 1.15, P.z), n = 30;
      const inst = { dur: 3.2, main: true,
        update(t) {
          for (let i = 0; i < 3; i++) { const t0 = 0.5 + i * 0.75; if (t >= t0 && !inst['r' + i]) { inst['r' + i] = 1; const gap = Math.floor(r() * n), off = r() * 0.2; A.sfx('magic', { g: 0.5, rate: 0.8 }); S.fx.ring(p0.clone().setY(0.1), { r1: 4, color: accent, life: 0.3, world: true }); for (let k = 0; k < n; k++) { if (Math.abs(k - gap) <= 1 || Math.abs(k - gap) >= n - 1) continue; const a = k / n * 6.283 + off; bullet(p0.clone(), new V3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(8 * b.speed), i % 2 ? 0xff60c0 : accent); } } }
        } };
      return inst;
    };
    b.attacks.sweep = (P) => {
      const yaw0 = Math.atan2(P.tx - P.x, P.tz - P.z), dir = (P.s % 2) ? 1 : -1, R = 36;
      const beam = { h: null }, snd = { s: null };
      const inst = { dur: 4.4, main: true,
        update(t) {
          const k = BR.clamp((t - 1.0) / 3.0, 0, 1), a = yaw0 + dir * k * 6.283 * 0.85;
          const end = new V3(b.pos.x + Math.sin(a) * R, 0.5, b.pos.z + Math.cos(a) * R);
          if (t < 1.0) { if (!inst.d) { inst.d = 1; S.fx.decal(new V3(b.pos.x, 0, b.pos.z), 'line', { len: R, width: 1.6, yaw: yaw0, color: 0xff3020, dur: 1.0 }); A.sfx('charge', { len: 1 }); } return; }
          if (!beam.h) { beam.h = S.fx.beam({ color: accent, width: 0.8, world: true }); snd.s = BR.Audio.loopFx('beam'); }
          const from = G.position.clone();
          beam.h.set(from, end, 0.8);
          b.yaw = a;
          for (let j = 0; j < 3; j++) { const q = new V3(b.pos.x + Math.sin(a) * rnd(Math.random, 3, R), 0.1, b.pos.z + Math.cos(a) * rnd(Math.random, 3, R)); S.fx.spark(q, new V3(0, rnd(Math.random, 1, 4), 0), { color: accent, life: 0.5, size: 0.5, world: true }); }
          // la ligne de feu au sol : on saute par-dessus ou on esquive au travers
          A.hurtLine(b.pos.x, b.pos.z, a, R, 1.4, 60, { air: true, kb: 5, up: 4 }, inst, 'b' + Math.floor(t * 3));
        },
        end() { if (beam.h) beam.h.kill(); if (snd.s) snd.s.stop(); b.tired = true; A.later(2.6, () => { b.tired = false; }); }, cancel() { if (beam.h) beam.h.kill(); if (snd.s) snd.s.stop(); } };
      return inst;
    };
    b.attacks.nova = (P) => {
      const to = new V3(P.nx, 0, P.nz);
      // glissement rapide (plus de téléportation) : l'œil file jusqu'au point en laissant une traînée, puis explose
      const from = new V3(P.x, 0, P.z);
      S.fx.decal(to, 'circle', { r: 9, color: 0xff3020, dur: 1.8 }); A.sfx('charge', { len: 1.6 });
      const inst = { dur: 2.6, main: true, ownsMove: true,
        update(t) {
          if (t < 0.6) { const k = ease(t / 0.6); b.pos.lerpVectors(from, to, k); b.gs = 1 - Math.sin(k * Math.PI) * 0.25; if (Math.random() < 0.8) S.fx.spark(G.position.clone(), new V3(rnd(Math.random, -1, 1), rnd(Math.random, -1, 1), rnd(Math.random, -1, 1)), { color: accent, life: 0.45, size: 1.4, size1: 0.2, world: true }); }
          else { b.pos.copy(to); b.gs = 1 + Math.max(0, Math.sin((t - 0.6) / 1.2 * Math.PI)) * 0.15; }
          if (t > 0.6 && t < 1.8 && Math.random() < 0.6) { const a = Math.random() * 6.283; S.fx.spark(to.clone().add(new V3(Math.cos(a) * 9, 0.5, Math.sin(a) * 9)), new V3(-Math.cos(a) * 9, 3, -Math.sin(a) * 9), { color: accent, life: 1, size: 0.5, world: true }); }
          if (t >= 1.8 && !inst.h) { inst.h = 1; b.gs = 1; S.fx.flash(to.clone().setY(3), { color: accent, r: 6, life: 0.4, intensity: 8 }); S.fx.ring(to, { r1: 12, color: accent, life: 0.5 }); S.fx.burst(to.clone().setY(2), { n: 120, color: accent, speed: 18, life: 0.7 }); A.sfx('boom', { len: 1.2 }); A.shake(0.7); A.hurtCircle(to.x, to.z, 9, 160, { kb: 12, up: 6 }, inst, 'n'); if ((P.sg || 1) >= 2) H.wave(b, to.x, to.z, { r0: 9, rMax: 30, dmg: 80, color: accent }); }
        }, end() { b.gs = 1; }, cancel() { b.gs = 1; } };
      return inst;
    };
    b.attacks.sats = (P) => {
      const inst = { dur: 1.2, main: true,
        update(t) {
          if (t > 0.6 && !inst.f) { inst.f = 1; A.sfx('roar', { rate: 2.4, g: 0.4 });
            sats.forEach(s => { s.gone = 7; const p = s.g.position.clone(); A.eproj({ pos: p, vel: new V3(0, 4, 0), r: 0.9, dmg: 80, color: 0xff4080, life: 6, homing: 1.6, accel: 0.25, mesh: (() => { const g = new THREE.Group(); const fm = faceMesh(b.faces[(sats.indexOf(s) + 1) % b.faces.length], 1.6, 0xff4080); g.add(fm); g.userData.fm = fm; return g; })(), onUpdate: (pp, dt) => { pp.mesh.lookAt(S.me.center()); pp.mesh.userData.fm.userData.U.time.value += dt; pp.mesh.userData.fm.userData.U.rage.value = 1; }, onEnd: pp => { S.fx.flash(pp.pos, { color: 0xff4080, r: 1.5, life: 0.2 }); S.fx.burst(pp.pos, { n: 20, color: 0xff4080, speed: 8, life: 0.4 }); } }); });
          }
        } };
      return inst;
    };
    b.attacks.blink = (P) => {
      // déplacement éclair fluide (glissade avec images rémanentes), plus de disparition brutale
      const to = new V3(P.nx, 0, P.nz), from = new V3(P.x, 0, P.z);
      A.sfx('magic', { rate: 0.5, g: 0.6 });
      const inst = { dur: 0.5, main: true, ownsMove: true, update(t) {
        const k = ease(t / 0.5); b.pos.lerpVectors(from, to, k); b.gs = 1 - Math.sin(k * Math.PI) * 0.3;
        S.fx.spark(G.position.clone(), new V3(), { color: accent, life: 0.3, size: 2.2 * b.sc, size1: 0.3, world: true, alpha: 0.5 });
      }, end() { b.gs = 1; }, cancel() { b.gs = 1; } };
      return inst;
    };
    // ruée en ligne droite au ras du sol avec un rayon qui brûle le sol derrière elle
    b.attacks.dashlaser = (P) => {
      const p0 = new V3(P.x, 0, P.z), dir = new V3(P.tx - P.x, 0, P.tz - P.z).normalize(), yaw = Math.atan2(dir.x, dir.z);
      let len = 34; for (let k = 0; k < 40 && p0.clone().addScaledVector(dir, len).length() > 26; k++) len -= 1; len = Math.max(8, len);
      S.fx.decal(p0, 'line', { len, width: 4.4, yaw, color: 0xff3020, dur: 0.9 });
      A.sfx('charge', { len: 0.9 });
      const beam = { h: null }, snd = { s: null };
      const inst = { dur: 0.9 + 0.9 + 0.3, main: true, ownsMove: true,
        update(t) {
          b.yaw = yaw; b.tired = false;
          if (t < 0.9) return;
          const k = Math.min(1, (t - 0.9) / 0.9); b.pos.copy(p0).addScaledVector(dir, len * ease(k));
          if (!beam.h) { beam.h = S.fx.beam({ color: accent, width: 0.9, world: true }); snd.s = BR.Audio.loopFx('beam'); A.shake(0.4); }
          const g0 = b.pos.clone().setY(0.1); beam.h.set(G.position.clone(), g0, 0.9);
          if (k < 1 && Math.floor(t * 12) !== inst.z) { inst.z = Math.floor(t * 12); A.ezone({ pos: g0.clone(), life: 3, iv: 0.3, onTick: z => { A.hurtCircle(z.pos.x, z.pos.z, 1.5, 30, { h: 1 }); S.fx.spark(z.pos.clone().add(new V3(rnd(Math.random, -1, 1), 0.1, rnd(Math.random, -1, 1))), new V3(0, 2.5, 0), { color: accent, life: 0.5, size: 0.6, world: true }); } }); }
          A.hurtCircle(b.pos.x, b.pos.z, 3, 130, { kb: 12, up: 6 }, inst, 'd');
        }, end() { if (beam.h) beam.h.kill(); if (snd.s) snd.s.stop(); }, cancel() { this.end(); } };
      return inst;
    };
    b.attacks.gaze = (P) => {
      if (P.ids && P.ids.length > 1) {      // un regard-rayon par joueur
        const subs = P.ids.map((id, i) => b.attacks.gaze(Object.assign({}, P, { ids: null, tg: id, tx: P.tx + i, tz: P.tz })));
        return { dur: Math.max(...subs.map(x => x.dur)), main: true, update(t, dt) { subs.forEach(x => x.update(t, dt)); }, end() { subs.forEach(x => x.end()); }, cancel() { subs.forEach(x => x.end()); } };
      }
      const beam = { h: null }, snd = { s: null }; let aim = new V3(P.tx, 0, P.tz);
      const inst = { dur: 3.4, main: true,
        update(t, dt) {
          const tg = A.player(P.tg); if (tg && tg.alive) aim.lerp(tg.pos.clone().setY(0), Math.min(1, dt * (t < 1.0 ? 4 : 1.3)));
          b.faceToward(dt, aim, 5);
          const from = G.position.clone(), dir = aim.clone().sub(from).normalize(), end = from.clone().addScaledVector(dir, from.distanceTo(aim) + 2);
          if (t < 1.0) { if (Math.random() < 0.6) S.fx.spark(from.clone().addScaledVector(dir, 3), dir.clone().multiplyScalar(6), { color: 0xff2040, life: 0.3, size: 0.5, world: true }); if (!inst.c) { inst.c = 1; A.sfx('charge', { len: 1 }); } return; }
          if (!beam.h) { beam.h = S.fx.beam({ color: 0xff2040, width: 1.3, world: true }); snd.s = BR.Audio.loopFx('beam'); A.shake(0.4); }
          beam.h.set(from, end, 1.3);
          S.fx.burst(end, { n: 4, color: 0xff2040, speed: 8, up: 0.8, life: 0.4, world: true });
          const f = A.me(); if (f.alive) { const ab = end.clone().sub(from), k = BR.clamp(f.center().sub(from).dot(ab) / ab.lengthSq(), 0, 1), q = from.clone().addScaledVector(ab, k); if (q.distanceTo(f.center()) < 1.5) A.hurtSphere(f.center(), 0.1, 40, { kb: 2 }, inst, 'g' + Math.floor(t * 5)); }
        }, end() { if (beam.h) beam.h.kill(); if (snd.s) snd.s.stop(); }, cancel() { this.end(); } };
      return inst;
    };
    // croix de rayons au sol qui tourne (4 branches, 6 au stade 3) : saute par-dessus au passage
    b.attacks.cross = (P, r) => {
      const arms = (P.sg || 1) >= 3 ? 6 : 4, dir = r() < 0.5 ? 1 : -1, a0 = r() * 6.283, R = 34, spin = (P.sg || 1) >= 2 ? 0.95 : 0.75;
      const p0 = new V3(P.x, 0, P.z), beams = []; let snd = null;
      for (let k = 0; k < arms; k++) S.fx.decal(p0, 'line', { len: R, width: 1.6, yaw: a0 + k / arms * 6.283, color: 0xff3020, dur: 1.1 });
      A.sfx('charge', { len: 1.1 });
      const inst = { dur: 5.6, main: true, ownsMove: true,
        update(t, dt) {
          if (t < 1.1) return;
          if (!beams.length) { for (let k = 0; k < arms; k++) beams.push(S.fx.beam({ color: accent, width: 0.7, world: true })); snd = BR.Audio.loopFx('beam'); A.shake(0.4); }
          const base = a0 + dir * spin * ease(Math.min(1, (t - 1.1) / 0.6)) * (t - 1.1);
          const from = G.position.clone();
          beams.forEach((bm, k) => {
            const a = base + k / arms * 6.283, end = new V3(P.x + Math.sin(a) * R, 0.3, P.z + Math.cos(a) * R);
            bm.set(from, end, 0.7, t > 5.2 ? Math.max(0, (5.6 - t) / 0.4) : 1);
            if (Math.random() < 0.4) S.fx.spark(new V3(P.x + Math.sin(a) * rnd(Math.random, 3, R), 0.15, P.z + Math.cos(a) * rnd(Math.random, 3, R)), new V3(0, rnd(Math.random, 1, 4), 0), { color: accent, life: 0.45, size: 0.5, world: true });
            if (t < 5.2) A.hurtLine(P.x, P.z, a, R, 1.5, 65, { air: true, kb: 5, up: 5 }, inst, 'x' + k + '_' + Math.floor(t * 2.5));
          });
        }, end() { beams.forEach(x => x.kill()); if (snd) snd.stop(); }, cancel() { this.end(); } };
      return inst;
    };
    // murs de projectiles (stade 2+) : trois rideaux traversent l'arène, chacun avec une seule brèche
    b.attacks.curtain = (P, r) => {
      const walls = [0, 1, 2].map(i => ({ t: 0.7 + i * 1.0, yaw: r() * 6.283, gap: (r() - 0.5) * 36 }));
      A.sfx('magic', { rate: 0.4, g: 0.9 });
      const inst = { dur: 0.7 + 3 * 1.0 + 0.6, main: true,
        update(t) {
          walls.forEach((w, i) => {
            if (t >= w.t - 0.6 && !w.d) { w.d = 1; const F = new V3(Math.sin(w.yaw), 0, Math.cos(w.yaw)), Rt = new V3(F.z, 0, -F.x); S.fx.decal(new V3(-F.x * 33 + Rt.x * w.gap, 0, -F.z * 33 + Rt.z * w.gap), 'line', { len: 66, width: 3.2, yaw: w.yaw, color: 0x60ffb0, dur: 0.6, hold: 1.4, noWarn: true }); }
            if (t >= w.t && !w.f) {
              w.f = 1; A.sfx('magic', { g: 0.6, rate: 0.7 });
              const F = new V3(Math.sin(w.yaw), 0, Math.cos(w.yaw)), Rt = new V3(F.z, 0, -F.x);
              for (let s = -34; s <= 34; s += 1.9) { if (Math.abs(s - w.gap) < 2.6) continue; const p = F.clone().multiplyScalar(-36).addScaledVector(Rt, s).setY(1.1); A.eproj({ pos: p, vel: F.clone().multiplyScalar(13 * b.speed), r: 0.6, dmg: 60, color: i % 2 ? 0xff60c0 : accent, life: 6 }); }
            }
          });
        } };
      return inst;
    };
    // DANGER TOTAL (stade 3) : l'arène explose en anneaux successifs (centre, milieu, bord, centre…) — passe d'un anneau à l'autre au bon moment
    b.attacks.abyss = (P) => {
      const zones = [[0, 11], [11, 22], [22, 36], [0, 11], [11, 22]], T0 = 1.6, GAP = 0.95, c = new V3(0, 0, 0);
      A.voice(b.faces[0], 0.6, 1.3); A.sfx('charge', { len: 1.6, g: 1 });
      BR.Arena.banner('DANGER TOTAL', 'Change d\'anneau au bon moment !', 1.8, 'bad');
      const p0 = new V3(P.x, 0, P.z);
      const inst = { dur: T0 + zones.length * GAP + 1.4, main: true, ownsMove: true,
        update(t) {
          if (t < 1.0) { b.pos.lerpVectors(p0, c, ease(t)); b.airY = ease(t) * 6; }
          zones.forEach((z, i) => {
            const th = T0 + i * GAP + 0.6, td = th - 1.5;
            if (t >= td && !inst['d' + i]) { inst['d' + i] = 1; if (z[0] === 0) S.fx.decal(c, 'circle', { r: z[1], color: 0xff2040, dur: 1.5 }); else S.fx.decal(c, 'ring', { r: z[1], inner: z[0] / z[1], color: 0xff2040, dur: 1.5 }); }
            if (t >= th && !inst['h' + i]) {
              inst['h' + i] = 1; A.sfx('boom', { g: 0.7, rate: 1.1 }); A.shake(0.5);
              const mid = (z[0] + Math.min(z[1], 34)) / 2;
              for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283 + i; S.fx.pillar(new V3(Math.sin(a) * mid, 0, Math.cos(a) * mid), { color: accent, r: Math.max(1.5, (Math.min(z[1], 34) - z[0]) * 0.25), h: 10, life: 0.45, world: true }); }
              const f = A.me(), d = Math.hypot(f.pos.x, f.pos.z); if (d >= z[0] - 0.2 && d <= z[1] + 0.2) H.hurtMe(A, 150, { up: 8, kb: 4, kbFrom: new V3(0, 0, 0) }, inst, 'z' + i);
            }
          });
        }, end() { b.airY = 0; }, cancel() { b.airY = 0; } };
      return inst;
    };
    return b;
  }

  // registre : les nouveaux boss (boss2.js, boss3.js) s'y ajoutent avec AB.register
  AB.BUILD = { titan, hydra, spider, eye };
  AB.register = (id, fn) => { AB.BUILD[id] = fn; };
  AB.base = base; AB.faceMesh = faceMesh; AB.faceCrop = faceCrop;
  AB.create = (S, id, o) => (AB.BUILD[id] || titan)(S, o);
})();

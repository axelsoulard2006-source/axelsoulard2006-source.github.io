/* ===== mobs.js : créatures — module branché uniquement par les hooks (aucune modification du moteur)
   Le jour : moutons, cochons, vaches (paisibles). La nuit et dans les grottes sombres : zombis (corps à corps, brûlent au soleil),
   archers squelettes (tirent des flèches) et le Braiseron, petit golem de braise à mèche qui explose.
   Les Braises : feux follets. Les créatures restent locales à chaque joueur ; les blocs détruits par une explosion
   passent par world.set et sont donc relayés en multijoueur. Géométries et matériaux partagés (aucun objet lourd par image). ===== */
(function () {
  const VX = window.VX, B = VX.B, I = VX.I, D = VX.BLOCKS, G = VX.G, H = VX.hooks;
  // objets de survie : déclarés par survie.js (chargé après ce fichier), donc résolus au moment du butin
  const idOf = k => typeof k === 'string' ? (VX.SURV || {})[k] : k;
  const FX = () => VX.FX;

  /* ---------- géométries et matériaux partagés ---------- */
  const GEO = {}, MATS = [];
  const geo = (w, h, d) => GEO[w + ',' + h + ',' + d] || (GEO[w + ',' + h + ',' + d] = new THREE.BoxGeometry(w, h, d));
  const MC = {};
  function mat(col, glow) { const k = col + (glow ? '!' : ''); if (MC[k]) return MC[k]; const m = new THREE.MeshBasicMaterial({ color: col }); m.userData.base = new THREE.Color(col); m.userData.glow = !!glow; MATS.push(m); return (MC[k] = m); }
  const RED = new THREE.MeshBasicMaterial({ color: 0xff4040 }), WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
  // pièces : [largeur, hauteur, profondeur, couleur, x, y, z, lumineux]
  function addBoxes(parent, list) { for (const [w, h, d, c, x, y, z, gl] of list) { const m = new THREE.Mesh(geo(w, h, d), mat(c, gl)); m.position.set(x, y, z); m.userData.mat = m.material; parent.add(m); } }
  // modèle : { body: [...], head: { at: [x,y,z], parts }, legs: [{ at, parts, ph }], arms: [{ at, parts, ph, rest }] } — face vers +z
  function build(spec) {
    const g = new THREE.Group(), rig = { g, head: null, legs: [], arms: [], extra: {} }; addBoxes(g, spec.body || []);
    if (spec.head) { const h = new THREE.Group(); h.position.set(...spec.head.at); addBoxes(h, spec.head.parts); g.add(h); rig.head = h; }
    for (const L of spec.legs || []) { const p = new THREE.Group(); p.position.set(...L.at); addBoxes(p, L.parts); p.userData.ph = L.ph; g.add(p); rig.legs.push(p); }
    for (const A of spec.arms || []) { const p = new THREE.Group(); p.position.set(...A.at); addBoxes(p, A.parts); p.userData.ph = A.ph; p.userData.rest = A.rest || 0; g.add(p); rig.arms.push(p); }
    return rig;
  }
  const leg = (x, y, z, w, h, d, c, ph) => ({ at: [x, y, z], parts: [[w, h, d, c, 0, -h / 2, 0]], ph });

  /* ---------- les créatures (formes et couleurs propres à Blocaria) ---------- */
  const TYPES = {
    mouton: { name: 'Mouton', hp: 8, speed: 1.4, w: 0.45, h: 1.15, dim: 'surface', passive: true, cry: 'mouton',
      drops: [['LAINE', 1, 2], ['GIGOT_CRU', 1, 2]],
      spec: { body: [[0.86, 0.66, 1.12, '#ece5d3', 0, 0.76, 0], [0.62, 0.14, 0.86, '#d9cfba', 0, 1.14, 0], [0.9, 0.2, 0.5, '#d9cfba', 0, 0.62, -0.1]],
        head: { at: [0, 1.0, 0.55], parts: [[0.4, 0.42, 0.38, '#4a3b35', 0, 0, 0.2], [0.48, 0.16, 0.42, '#ece5d3', 0, 0.24, 0.17], [0.12, 0.2, 0.2, '#c8a060', 0.27, 0.06, 0.12], [0.12, 0.2, 0.2, '#c8a060', -0.27, 0.06, 0.12], [0.08, 0.06, 0.02, '#f6f0e0', 0.1, 0.06, 0.4, 1], [0.08, 0.06, 0.02, '#f6f0e0', -0.1, 0.06, 0.4, 1], [0.16, 0.08, 0.02, '#2a201c', 0, -0.12, 0.4]] },
        legs: [leg(0.25, 0.44, 0.36, 0.18, 0.44, 0.18, '#4a3b35', 0), leg(-0.25, 0.44, 0.36, 0.18, 0.44, 0.18, '#4a3b35', 1), leg(0.25, 0.44, -0.36, 0.18, 0.44, 0.18, '#4a3b35', 1), leg(-0.25, 0.44, -0.36, 0.18, 0.44, 0.18, '#4a3b35', 0)] } },
    cochon: { name: 'Cochon', hp: 10, speed: 1.5, w: 0.42, h: 0.95, dim: 'surface', passive: true, cry: 'cochon',
      drops: [['COTE_CRUE', 1, 3]],
      spec: { body: [[0.8, 0.6, 1.08, '#e8a08a', 0, 0.62, 0], [0.3, 0.06, 1.0, '#c4745f', 0, 0.94, 0], [0.22, 0.2, 0.02, '#b8644f', 0.2, 0.7, -0.55], [0.1, 0.1, 0.1, '#c4745f', 0, 0.86, -0.58]],
        head: { at: [0, 0.75, 0.52], parts: [[0.54, 0.48, 0.44, '#eaa892', 0, 0.03, 0.2], [0.28, 0.2, 0.1, '#d77f70', 0, -0.05, 0.46], [0.05, 0.06, 0.02, '#5a2a24', 0.06, -0.05, 0.52], [0.05, 0.06, 0.02, '#5a2a24', -0.06, -0.05, 0.52], [0.16, 0.2, 0.06, '#c4745f', 0.22, 0.3, 0.2], [0.16, 0.2, 0.06, '#c4745f', -0.22, 0.3, 0.2], [0.07, 0.07, 0.02, '#1a1010', 0.14, 0.12, 0.43], [0.07, 0.07, 0.02, '#1a1010', -0.14, 0.12, 0.43], [0.05, 0.1, 0.05, '#f4ecd8', 0.17, -0.14, 0.43], [0.05, 0.1, 0.05, '#f4ecd8', -0.17, -0.14, 0.43]] },
        legs: [leg(0.24, 0.32, 0.34, 0.2, 0.32, 0.2, '#d08c78', 0), leg(-0.24, 0.32, 0.34, 0.2, 0.32, 0.2, '#d08c78', 1), leg(0.24, 0.32, -0.34, 0.2, 0.32, 0.2, '#d08c78', 1), leg(-0.24, 0.32, -0.34, 0.2, 0.32, 0.2, '#d08c78', 0)] } },
    vache: { name: 'Vache', hp: 10, speed: 1.2, w: 0.5, h: 1.45, dim: 'surface', passive: true, cry: 'vache',
      drops: [['PAVE_CRU', 1, 3], ['CUIR', 0, 2]],
      spec: { body: [[0.9, 0.78, 1.3, '#6a4430', 0, 0.98, 0], [0.92, 0.32, 0.46, '#eadcc0', 0, 0.92, -0.1], [0.5, 0.1, 0.5, '#eadcc0', 0.1, 1.38, 0.25], [0.3, 0.14, 0.3, '#f0b8b0', 0, 0.56, -0.25]],
        head: { at: [0, 1.18, 0.66], parts: [[0.56, 0.54, 0.44, '#6a4430', 0, 0, 0.2], [0.46, 0.22, 0.12, '#eadcc0', 0, -0.15, 0.46], [0.07, 0.07, 0.02, '#1a1010', 0.14, 0.08, 0.43], [0.07, 0.07, 0.02, '#1a1010', -0.14, 0.08, 0.43], [0.28, 0.08, 0.08, '#efe6cc', 0.38, 0.24, 0.14], [0.28, 0.08, 0.08, '#efe6cc', -0.38, 0.24, 0.14], [0.08, 0.16, 0.08, '#efe6cc', 0.5, 0.34, 0.14], [0.08, 0.16, 0.08, '#efe6cc', -0.5, 0.34, 0.14], [0.12, 0.12, 0.12, '#c8a040', 0, -0.36, 0.3]] },
        legs: [leg(0.29, 0.6, 0.44, 0.22, 0.6, 0.22, '#5a3828', 0), leg(-0.29, 0.6, 0.44, 0.22, 0.6, 0.22, '#eadcc0', 1), leg(0.29, 0.6, -0.44, 0.22, 0.6, 0.22, '#eadcc0', 1), leg(-0.29, 0.6, -0.44, 0.22, 0.6, 0.22, '#5a3828', 0)] } },
    zombi: { name: 'Zombi', hp: 20, speed: 2.1, w: 0.3, h: 1.85, dim: 'surface', hostile: true, burns: true, dmg: 3, cry: 'zombi',
      drops: [['CHAIR', 0, 2], [I.POMME, 0, 0]],
      spec: { body: [[0.52, 0.72, 0.28, '#9a4a2a', 0, 1.1, 0], [0.54, 0.14, 0.3, '#6e3220', 0, 0.8, 0], [0.18, 0.2, 0.3, '#8aa0a8', 0.12, 1.32, 0.02]],
        head: { at: [0, 1.46, 0], parts: [[0.48, 0.48, 0.48, '#8aa0a8', 0, 0.24, 0], [0.1, 0.07, 0.02, '#ffd84a', 0.11, 0.28, 0.25, 1], [0.1, 0.07, 0.02, '#ffd84a', -0.11, 0.28, 0.25, 1], [0.22, 0.05, 0.02, '#2a2028', 0, 0.12, 0.25], [0.5, 0.1, 0.5, '#5a6a50', 0, 0.48, 0]] },
        arms: [{ at: [0.36, 1.42, 0], parts: [[0.18, 0.7, 0.18, '#8aa0a8', 0, -0.32, 0], [0.2, 0.24, 0.2, '#9a4a2a', 0, -0.06, 0]], ph: 0, rest: -1.45 }, { at: [-0.36, 1.42, 0], parts: [[0.18, 0.7, 0.18, '#8aa0a8', 0, -0.32, 0], [0.2, 0.24, 0.2, '#9a4a2a', 0, -0.06, 0]], ph: 1, rest: -1.35 }],
        legs: [leg(0.13, 0.76, 0, 0.22, 0.76, 0.24, '#3a3448', 0), leg(-0.13, 0.76, 0, 0.22, 0.76, 0.24, '#3a3448', 1)] } },
    squelette: { name: 'Archer squelette', hp: 16, speed: 1.9, w: 0.28, h: 1.85, dim: 'surface', hostile: true, burns: true, archer: true, dmg: 2, cry: 'squelette',
      drops: [['OS', 0, 2], ['FLECHE', 0, 2]],
      spec: { body: [[0.4, 0.66, 0.18, '#e4dcc4', 0, 1.12, 0], [0.08, 0.66, 0.2, '#3a342c', 0, 1.12, 0], [0.46, 0.5, 0.26, '#2a5a5a', 0, 1.22, -0.06], [0.3, 0.1, 0.16, '#e4dcc4', 0, 0.78, 0]],
        head: { at: [0, 1.45, 0], parts: [[0.44, 0.44, 0.44, '#ece4cc', 0, 0.22, 0], [0.12, 0.1, 0.02, '#1a2a30', 0.1, 0.26, 0.23], [0.12, 0.1, 0.02, '#1a2a30', -0.1, 0.26, 0.23], [0.05, 0.04, 0.02, '#7fe8ff', 0.1, 0.26, 0.24, 1], [0.05, 0.04, 0.02, '#7fe8ff', -0.1, 0.26, 0.24, 1], [0.5, 0.26, 0.5, '#2a5a5a', 0, 0.42, -0.03], [0.22, 0.04, 0.02, '#3a342c', 0, 0.08, 0.23]] },
        arms: [{ at: [0.28, 1.4, 0], parts: [[0.1, 0.66, 0.1, '#e4dcc4', 0, -0.3, 0]], ph: 0, rest: -1.4 }, { at: [-0.28, 1.4, 0], parts: [[0.1, 0.66, 0.1, '#e4dcc4', 0, -0.3, 0], [0.06, 0.06, 0.8, '#7a4a20', 0, -0.62, 0.06], [0.02, 0.02, 0.76, '#e8e8e8', 0, -0.62, -0.04]], ph: 1, rest: -1.5 }],
        legs: [leg(0.1, 0.78, 0, 0.11, 0.78, 0.11, '#e4dcc4', 0), leg(-0.1, 0.78, 0, 0.11, 0.78, 0.11, '#e4dcc4', 1)] } },
    // le Braiseron : petit golem de basalte fendu de braises, une mèche sur la tête
    braiseron: { name: 'Braiseron', hp: 14, speed: 2.0, w: 0.38, h: 1.15, dim: 'surface', hostile: true, bomber: true, cry: 'braiseron',
      drops: [['POUDRE', 1, 3]],
      spec: { body: [[0.72, 0.62, 0.62, '#2e2826', 0, 0.56, 0], [0.74, 0.07, 0.3, '#ff7a1a', 0, 0.62, 0.06, 1], [0.08, 0.42, 0.64, '#ff9a2a', 0.22, 0.52, 0, 1], [0.6, 0.14, 0.5, '#3e3632', 0, 0.94, 0],
          [0.12, 0.1, 0.02, '#ffd23a', 0.15, 0.74, 0.32, 1], [0.12, 0.1, 0.02, '#ffd23a', -0.15, 0.74, 0.32, 1], [0.34, 0.05, 0.02, '#ff5a10', 0, 0.56, 0.32, 1], [0.06, 0.32, 0.06, '#c8b48c', 0.06, 1.15, -0.04]],
        head: { at: [0.06, 1.33, -0.04], parts: [[0.12, 0.12, 0.12, '#fff3a0', 0, 0, 0, 1]] },
        arms: [{ at: [0.44, 0.78, 0], parts: [[0.16, 0.36, 0.18, '#3e3632', 0, -0.16, 0], [0.17, 0.08, 0.19, '#ff7a1a', 0, -0.3, 0, 1]], ph: 0 }, { at: [-0.44, 0.78, 0], parts: [[0.16, 0.36, 0.18, '#3e3632', 0, -0.16, 0], [0.17, 0.08, 0.19, '#ff7a1a', 0, -0.3, 0, 1]], ph: 1 }],
        legs: [leg(0.18, 0.26, 0, 0.24, 0.26, 0.3, '#241e1c', 0), leg(-0.18, 0.26, 0, 0.24, 0.26, 0.3, '#241e1c', 1)] } },
    follet: { name: 'Feu follet', hp: 10, speed: 2.2, w: 0.35, h: 0.7, dim: 'braises', hostile: true, fly: true, dmg: 2, drops: [[I.CHARBON, 0, 2]],
      spec: { body: [[0.55, 0.55, 0.55, '#ff8a2a', 0, 0.35, 0, 1], [0.35, 0.35, 0.35, '#ffe14a', 0, 0.35, 0, 1], [0.08, 0.08, 0.02, '#3a1010', 0.1, 0.42, 0.29, 1], [0.08, 0.08, 0.02, '#3a1010', -0.1, 0.42, 0.29, 1]] } },
  };
  for (const k in TYPES) TYPES[k].drops = TYPES[k].drops.filter(d => d[2] > 0);

  /* ---------- monde ---------- */
  const mobs = [];
  const bAt = (x, y, z) => D[G.world.get(Math.floor(x), Math.floor(y), Math.floor(z))];
  const solid = (x, y, z) => { const b = bAt(x, y, z); return !!(b && b.solid); };
  const liquid = (x, y, z) => { const b = bAt(x, y, z); return !!(b && b.liquid); };
  // ciel visible au-dessus de cette case ? (pour brûler au soleil)
  function skyOpen(x, y, z) { const X = Math.floor(x), Z = Math.floor(z); for (let yy = Math.floor(y); yy < VX.H; yy++) { const b = D[G.world.get(X, yy, Z)]; if (b && b.opaque && b.solid) return false; } return true; }
  const day = () => VX.R.uniforms.uDay.value;
  const wrap = a => { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; };

  function spawn(type, x, y, z) {
    const T = TYPES[type], rig = build(T.spec); rig.g.position.set(x, y, z); G.scene.add(rig.g);
    const m = { type, T, rig, x, y, z, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28, hp: T.hp, dim: G.dim, t: Math.random() * 10, phase: 0, dir: Math.random() * 6.28, think: 0, hitT: 0, atkCd: 1, flee: 0, ground: false, fire: 0, sunT: 0, fuse: 0, cryT: 4 + Math.random() * 12, flash: false, swing: 0 };
    mobs.push(m); return m;
  }
  function setMat(m, mt) { m.rig.g.traverse(o => { if (o.isMesh) o.material = mt || o.userData.mat; }); }
  function kill(m, drop) {
    G.scene.remove(m.rig.g); const i = mobs.indexOf(m); if (i >= 0) mobs.splice(i, 1);   // géométries et matériaux partagés : rien à libérer
    if (drop) {
      if (FX()) FX().burst(m.x, m.y + m.T.h * 0.5, m.z, 18, [0.85, 0.85, 0.85], { smoke: true, speed: 1.6, life: 0.7, grav: -0.5, spread: m.T.w * 2 });
      G.sfx('poof', { dist: dist3(m) });
      if (G.mode !== 'creatif' && VX.XP) VX.XP.drop(m.x, m.y + 0.5, m.z, m.T.hostile ? 5 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 3));   // orbes d'expérience
      if (G.mode !== 'creatif') for (const [key, a, b] of m.T.drops) { const id = idOf(key); if (id == null) continue; const n = a + Math.floor(Math.random() * (b - a + 1)); if (n > 0) G.dropItem(id, n, new THREE.Vector3(m.x, m.y + 0.5, m.z)); }
    }
  }
  const dist3 = m => { const P = G.player.pos; return Math.hypot(P.x - m.x, P.y - m.y, P.z - m.z); };
  function damage(m, n, kx, kz) {
    m.hp -= n; m.hitT = 0.3; m.flee = 4; m.vx += kx; m.vz += kz; m.vy = Math.max(m.vy, 5);
    if (FX()) FX().burst(m.x, m.y + m.T.h * 0.6, m.z, 6, m.type === 'squelette' ? [0.9, 0.88, 0.8] : m.T.bomber ? [1, 0.5, 0.1] : [0.75, 0.1, 0.1], { speed: 2, life: 0.4 });
    G.sfx('hit', { dist: dist3(m) });
    if (m.hp <= 0) kill(m, true);
  }

  /* ---------- flèches (réserve de maillages réutilisés) ---------- */
  const arrows = [], ARROW_MAX = 24;
  const arrowProto = (() => { const g = new THREE.Group(); addBoxes(g, [[0.04, 0.04, 0.6, '#8a5f33', 0, 0, 0], [0.07, 0.07, 0.1, '#c8c8d0', 0, 0, 0.33], [0.12, 0.02, 0.12, '#e8e0d0', 0, 0, -0.26], [0.02, 0.12, 0.12, '#e8e0d0', 0, 0, -0.26]]); return g; })();
  function shoot(m, P) {
    let a = arrows.find(x => !x.on);
    if (!a) { if (arrows.length >= ARROW_MAX) a = arrows.reduce((p, c) => (c.age > p.age ? c : p)); else { a = { g: arrowProto.clone(), on: false }; arrows.push(a); G.scene.add(a.g); } }
    const sx = m.x, sy = m.y + 1.45, sz = m.z, tx = P.pos.x - sx, ty = P.eye - 0.25 - sy, tz = P.pos.z - sz, d = Math.hypot(tx, tz), sp = 18;
    const tt = d / sp;   // visée : on compense la chute pendant le vol
    a.p = new THREE.Vector3(sx + tx / (d || 1) * 0.5, sy, sz + tz / (d || 1) * 0.5); a.v = new THREE.Vector3(tx / (d || 1) * sp + (Math.random() - 0.5) * 0.8, ty / Math.max(tt, 0.05) + 0.5 * 14 * tt + (Math.random() - 0.5) * 0.6, tz / (d || 1) * sp + (Math.random() - 0.5) * 0.8);
    a.on = true; a.stuck = false; a.age = 0; a.dim = G.dim; a.g.visible = true; G.sfx('bow', { dist: dist3(m) });
  }
  function arrowsTick(dt, P) {
    for (const a of arrows) {
      if (!a.on) continue; a.age += dt;
      if (a.dim !== G.dim || a.age > (a.stuck ? 6 : 8)) { a.on = false; a.g.visible = false; continue; }
      if (a.stuck) continue;
      a.v.y -= 14 * dt; const nx = a.p.x + a.v.x * dt, ny = a.p.y + a.v.y * dt, nz = a.p.z + a.v.z * dt;
      // le joueur (boîte AABB)
      if (nx > P.pos.x - 0.4 && nx < P.pos.x + 0.4 && nz > P.pos.z - 0.4 && nz < P.pos.z + 0.4 && ny > P.pos.y && ny < P.pos.y + 1.85) {
        const hit = G.hurt(3, 'fleche', { x: P.pos.x - a.v.x, z: P.pos.z - a.v.z }); if (hit !== false) { P.vel.x += a.v.x * 0.15; P.vel.z += a.v.z * 0.15; } G.sfx('arrow'); a.on = false; a.g.visible = false; continue;
      }
      if (solid(nx, ny, nz)) { a.stuck = true; G.sfx('arrow', { dist: Math.hypot(P.pos.x - nx, P.pos.z - nz) }); continue; }
      a.p.set(nx, ny, nz); a.g.position.copy(a.p); a.g.lookAt(nx + a.v.x, ny + a.v.y, nz + a.v.z);
    }
  }

  /* ---------- explosion : détruit les blocs autour (sauf socle, obsidienne et blocs indestructibles), dégâts selon la distance ---------- */
  function explode(x, y, z, r) {
    const w = G.world, cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    G.sfx('explode'); if (FX()) FX().explosion(x, y, z, r);
    {
      for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy + dz * dz; if (d2 > r * r * (0.55 + Math.random() * 0.45)) continue;
        const bx = cx + dx, by = cy + dy, bz = cz + dz; if (by <= 0) continue;
        const id = w.getG(bx, by, bz), b = D[id]; if (!id || !b) continue;
        if (id === B.SOCLE || id === B.OBSIDIENNE || id === B.PORTAIL || b.hard < 0 || b.hard >= 30 || b.liquid) continue;
        G.breakAt(bx, by, bz, { chance: 0.3 });   // passe par world.set : relayé en multijoueur
      }
    }
    // le joueur
    const P = G.player, px = P.pos.x - x, py = P.pos.y + 0.9 - y, pz = P.pos.z - z, d = Math.hypot(px, py, pz), R2 = r * 2.2;
    if (d < R2) { const k = 1 - d / R2; G.hurt(Math.round(k * k * 22 + k * 4), 'explosion', { x, z }); P.vel.x += px / (d || 1) * k * 14; P.vel.z += pz / (d || 1) * k * 14; P.vel.y = Math.max(P.vel.y, k * 9); }
    // les autres créatures
    for (const o of mobs.slice()) { if (o.dim !== G.dim) continue; const ox = o.x - x, oz = o.z - z, od = Math.hypot(ox, o.y - y, oz); if (od < R2) damage(o, Math.round((1 - od / R2) * 20), ox / (od || 1) * 8, oz / (od || 1) * 8); }
  }

  /* ---------- apparition autour du joueur ---------- */
  let spawnT = 0;
  const glowNear = (x, y, z) => { for (let dy = -2; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz += 2) for (let dx = -4; dx <= 4; dx += 2) { const b = D[G.world.get(x + dx, y + dy, z + dz)]; if (b && b.glow) return true; } return false; };
  function trySpawn() {
    const P = G.player, dk = day(), here = mobs.filter(m => m.dim === G.dim);
    const a = Math.random() * 6.283, d = 16 + Math.random() * 20, x = Math.floor(P.pos.x + Math.cos(a) * d), z = Math.floor(P.pos.z + Math.sin(a) * d);
    if (!G.world.chunk(Math.floor(x / 16), Math.floor(z / 16))) return;
    const hostiles = here.filter(m => m.T.hostile).length, pick = () => { const r = Math.random(); return r < 0.45 ? 'zombi' : r < 0.75 ? 'squelette' : 'braiseron'; };
    if (G.dim === 'surface') {
      let y = VX.H - 2; while (y > 1 && !solid(x + 0.5, y, z + 0.5)) y--; const top = G.world.get(x, y, z); if (liquid(x + 0.5, y + 1, z + 0.5)) return;
      if (Math.random() < 0.5) {   // en surface
        if (dk > 0.55 && top === B.HERBE && here.filter(m => m.T.passive).length < 8) { const t = ['mouton', 'cochon', 'vache'][Math.floor(Math.random() * 3)]; for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) spawn(t, x + 0.5 + (Math.random() - 0.5) * 2, y + 1, z + 0.5 + (Math.random() - 0.5) * 2); }
        else if (dk < 0.35 && hostiles < 7 && D[top] && D[top].solid && !glowNear(x, y + 1, z)) spawn(pick(), x + 0.5, y + 1, z + 0.5);
      } else if (hostiles < 7) {   // dans une grotte sombre, sous la surface (jour comme nuit)
        const cand = [];
        for (let yy = 3; yy < y - 6; yy++) if (solid(x + 0.5, yy - 1, z + 0.5) && !solid(x + 0.5, yy, z + 0.5) && !solid(x + 0.5, yy + 1, z + 0.5) && !liquid(x + 0.5, yy, z + 0.5)) cand.push(yy);
        if (cand.length) { const yy = cand[Math.floor(Math.random() * cand.length)]; if (Math.abs(yy - P.pos.y) < 24 && !glowNear(x, yy, z)) spawn(pick(), x + 0.5, yy, z + 0.5); }
      }
    } else if (here.length < 5) {
      for (let y = 20; y < 50; y++) if (solid(x + 0.5, y - 1, z + 0.5) && !solid(x + 0.5, y, z + 0.5) && !solid(x + 0.5, y + 1, z + 0.5) && !liquid(x + 0.5, y, z + 0.5)) { spawn('follet', x + 0.5, y + 1.5, z + 0.5); break; }
    }
  }

  /* ---------- intelligence, physique, animation ---------- */
  H.on('playerTick', ({ dt, player: P }) => {
    if ((spawnT -= dt) <= 0) { spawnT = 1.1; trySpawn(); }
    arrowsTick(dt, P);
    const dk = day(), alive = P.hp > 0 && G.mode !== 'creatif';
    for (const m of mobs.slice()) {
      if (mobs.indexOf(m) < 0) continue;   // déjà tuée pendant cette image (explosion…)
      if (m.dim !== G.dim) { kill(m, false); continue; }
      const T = m.T, dx = P.pos.x - m.x, dz = P.pos.z - m.z, dist = Math.hypot(dx, dz), dy = P.pos.y - m.y;
      if (dist > (T.hostile ? 56 : 80)) { kill(m, false); continue; }
      m.t += dt; m.think -= dt; m.atkCd -= dt; m.flee -= dt; m.hitT -= dt; m.swing = Math.max(0, m.swing - dt * 3);
      // au soleil : zombis et squelettes prennent feu
      if (T.burns && G.dim === 'surface' && dk > 0.6 && (m.sunT -= dt) <= 0) { m.sunT = 0.5; if (skyOpen(m.x, m.y + T.h, m.z) && !liquid(m.x, m.y + 0.5, m.z)) m.fire = Math.max(m.fire, 1.2); }
      if (m.fire > 0) { m.fire -= dt; if (liquid(m.x, m.y + 0.3, m.z)) m.fire = 0; if (FX() && Math.random() < dt * 20) FX().burst(m.x, m.y + Math.random() * T.h, m.z, 1, [1, 0.5 + Math.random() * 0.4, 0.1], { speed: 0.6, up: 2, grav: -2, life: 0.5, spread: T.w * 2 }); if ((m.burnT = (m.burnT || 0) - dt) <= 0) { m.burnT = 1; damage(m, 2, 0, 0); m.flee = 0; if (m.hp <= 0) continue; } }
      // cris de temps en temps
      if ((m.cryT -= dt) <= 0) { m.cryT = 7 + Math.random() * 14; if (T.cry && dist < 20) G.sfx(T.cry, { dist: dist3(m) }); }
      let wx = 0, wz = 0, sp = T.speed;
      const sees = alive && T.hostile && dist < 20 && Math.abs(dy) < 10;
      if (T.archer && sees) {   // garde ses distances et tire
        const want = dist > 11 ? 1 : dist < 6 ? -1 : 0, side = Math.sin(m.t * 0.7) > 0 ? 1 : -1;
        wx = (dx / (dist || 1)) * want + (-dz / (dist || 1)) * side * 0.5; wz = (dz / (dist || 1)) * want + (dx / (dist || 1)) * side * 0.5; sp *= 0.8;
        if (m.atkCd <= 0 && dist < 16) {
          const eye = new THREE.Vector3(m.x, m.y + 1.6, m.z), to = new THREE.Vector3(dx, P.eye - m.y - 1.6, dz), L = to.length(); to.normalize();
          const hit = G.world.raycast(eye, to, L); if (!hit) { shoot(m, P); m.swing = 1; m.atkCd = 1.8 + Math.random() * 1.2; } else m.atkCd = 0.5;
        }
      } else if (T.bomber && sees) {   // s'approche, allume sa mèche, explose
        if (m.fuse > 0 || dist < 2.4) {
          if (m.fuse === 0) { m.fuse = 0.001; G.sfx('braiseron', { dist: dist3(m) }); }
          if (dist > 5) { m.fuse = Math.max(0, m.fuse - dt * 2); }   // trop loin : la mèche s'éteint
          else {
            const before = m.fuse; m.fuse += dt; const tick = before < 0.6 ? 0.3 : before < 1.1 ? 0.15 : 0.07;
            if (Math.floor(before / tick) !== Math.floor(m.fuse / tick)) G.sfx('fuse', { dist: dist3(m) });
            if (FX() && Math.random() < dt * 30) FX().burst(m.x + 0.06, m.y + 1.35, m.z - 0.04, 1, [1, 0.9, 0.4], { speed: 1.5, up: 1.5, life: 0.3, spread: 0.1 });
            if (m.fuse >= 1.5) { kill(m, false); explode(m.x, m.y + 0.5, m.z, 3); continue; }
          }
        } else { wx = dx / (dist || 1); wz = dz / (dist || 1); }
      } else if (T.hostile && sees) {   // poursuite et coup
        wx = dx / (dist || 1); wz = dz / (dist || 1);
        if (dist < 1.3 && Math.abs(dy) < 1.8 && m.atkCd <= 0) { m.atkCd = 1; m.swing = 1; const k = G.hurt(T.dmg, 'mob', m) === false && G.blocking ? 0.4 : 1; P.vel.x += wx * 5 * k; P.vel.z += wz * 5 * k; P.vel.y = Math.max(P.vel.y, 4 * k); if (k < 1) { m.vx -= wx * 6; m.vz -= wz * 6; } }
      } else if (m.flee > 0 && T.passive) { wx = -dx / (dist || 1); wz = -dz / (dist || 1); sp *= 2; if (m.think <= 0) { m.think = 0.6; m.dir = Math.atan2(wz, wx) + (Math.random() - 0.5) * 1.5; } wx = Math.cos(m.dir); wz = Math.sin(m.dir); }
      else { if (m.think <= 0) { m.think = 2 + Math.random() * 4; m.dir = Math.random() < 0.4 ? null : Math.random() * 6.283; } if (m.dir != null) { wx = Math.cos(m.dir); wz = Math.sin(m.dir); sp *= 0.5; } }
      if (m.fuse > 0) { wx = 0; wz = 0; }
      // les paisibles évitent de tomber d'une falaise
      if (T.passive && (wx || wz) && !solid(m.x + wx * 0.8, m.y - 0.5, m.z + wz * 0.8) && !solid(m.x + wx * 0.8, m.y - 1.5, m.z + wz * 0.8) && !solid(m.x + wx * 0.8, m.y - 2.5, m.z + wz * 0.8)) { wx = -wx; wz = -wz; m.dir = m.dir != null ? m.dir + Math.PI : null; }
      m.vx += (wx * sp - m.vx) * Math.min(1, dt * 6); m.vz += (wz * sp - m.vz) * Math.min(1, dt * 6);
      if (T.fly) { const ty = P.pos.y + 1.2 + Math.sin(m.t * 2) * 0.6; m.vy += ((sees ? ty - m.y : Math.sin(m.t) * 0.5) * 2 - m.vy) * Math.min(1, dt * 3); if (sees && dist < 1.3 && Math.abs(dy - 0.5) < 1.6 && m.atkCd <= 0) { m.atkCd = 1; G.hurt(T.dmg, 'mob', m); } }
      else { m.vy -= 28 * dt; if (liquid(m.x, m.y + 0.4, m.z)) m.vy = Math.min(m.vy + 40 * dt, 2); }
      // déplacement avec collisions simples (et petit saut pour franchir une marche)
      const nx = m.x + m.vx * dt, nz = m.z + m.vz * dt, r = T.w;
      const blocked = (x, z) => solid(x + Math.sign(m.vx) * r, m.y + 0.1, z) || solid(x, m.y + 0.1, z + Math.sign(m.vz) * r) || solid(x + Math.sign(m.vx) * r, m.y + T.h - 0.1, z) || solid(x, m.y + T.h - 0.1, z + Math.sign(m.vz) * r);
      if (!blocked(nx, m.z)) m.x = nx; else { m.vx = 0; if (m.ground && !T.fly) m.vy = 7.5; }
      if (!blocked(m.x, nz)) m.z = nz; else { m.vz = 0; if (m.ground && !T.fly) m.vy = 7.5; }
      const ny = m.y + m.vy * dt; m.ground = false;
      if (m.vy <= 0 && solid(m.x, ny, m.z)) { m.y = Math.floor(ny) + 1; m.vy = 0; m.ground = true; } else if (m.vy > 0 && solid(m.x, ny + T.h, m.z)) m.vy = 0; else m.y = ny;
      if (m.y < -10) { kill(m, false); continue; }
      if (G.dim === 'braises' && !T.fly && liquid(m.x, m.y + 0.2, m.z)) { kill(m, false); continue; }
      if (bAt(m.x, m.y + 0.2, m.z) === D[B.LAVE] && !T.fly) m.fire = 3;

      /* --- rendu et animation --- */
      const g = m.rig.g, hs = Math.hypot(m.vx, m.vz);
      g.position.set(m.x, m.y, m.z);
      const face = (sees || (T.passive && dist < 7 && m.flee <= 0 && hs < 0.4)) && !(T.passive && m.flee > 0) ? Math.atan2(dx, dz) : hs > 0.2 ? Math.atan2(m.vx, m.vz) : m.yaw;
      if (hs > 0.2 || T.hostile) m.yaw += wrap((hs > 0.2 ? Math.atan2(m.vx, m.vz) : face) - m.yaw) * Math.min(1, dt * 8);
      g.rotation.y = T.fly ? g.rotation.y + dt : m.yaw;
      m.phase += dt * hs * 4.2; const amp = Math.min(1, hs / 1.5) * 0.75;
      for (const L of m.rig.legs) L.rotation.x = Math.sin(m.phase + L.userData.ph * Math.PI) * amp;
      for (const A of m.rig.arms) A.rotation.x = A.userData.rest + Math.sin(m.phase + A.userData.ph * Math.PI) * amp * 0.4 - m.swing * 0.8;
      if (m.rig.head && !T.bomber) {   // la tête suit le joueur quand il est proche
        const near = dist < 10 && !(T.passive && m.flee > 0);
        const ty = near ? Math.max(-1, Math.min(1, wrap(Math.atan2(dx, dz) - m.yaw))) : Math.sin(m.t * 0.4) * 0.3, tp = near ? Math.max(-0.6, Math.min(0.6, -Math.atan2(P.eye - (m.y + T.h), dist))) : 0;
        m.rig.head.rotation.y += (ty - m.rig.head.rotation.y) * Math.min(1, dt * 6); m.rig.head.rotation.x += (tp - m.rig.head.rotation.x) * Math.min(1, dt * 6);
      }
      if (T.bomber) {   // la mèche clignote ; quand elle brûle, le golem gonfle et blanchit
        m.rig.head.visible = m.fuse > 0 ? Math.floor(m.t * 12) % 2 === 0 : Math.floor(m.t * 1.5) % 3 !== 0;
        g.scale.setScalar(m.fuse > 0 ? 1 + Math.min(1, m.fuse / 1.5) * 0.25 + Math.sin(m.t * 40) * 0.02 : 1);
      }
      const wantFlash = m.hitT > 0 ? RED : m.fuse > 0 && Math.floor(m.fuse * (m.fuse > 1 ? 14 : 7)) % 2 === 0 ? WHITE : null;
      if (wantFlash !== m.flash) { m.flash = wantFlash; setMat(m, wantFlash); }
    }
    // couleur selon le jour (tous les matériaux partagés à la fois)
    const tint = Math.max(0.3, G.dim === 'surface' ? dk : 0.9);
    for (const mt of MATS) if (!mt.userData.glow) mt.color.copy(mt.userData.base).multiplyScalar(tint);
  });

  /* ---------- coups au corps à corps (clic gauche) : prioritaire sur le minage si une créature est visée ---------- */
  H.on('attack', ({ origin, dir, reach }) => {
    let best = null, bt = reach;
    for (const m of mobs) {
      if (m.dim !== G.dim) continue; const r = m.T.w + 0.15, mn = [m.x - r, m.y, m.z - r], mx = [m.x + r, m.y + m.T.h, m.z + r], o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
      let t0 = 0, t1 = bt, ok = true;
      for (let k = 0; k < 3 && ok; k++) { if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) ok = false; continue; } let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) ok = false; }
      if (ok && t0 < bt) { const blk = G.world.raycast(origin, dir, t0); if (!blk) { bt = t0; best = m; } }
    }
    if (!best) return true;
    const st = G.inv[G.sel], tl = st && VX.ITEMS[st.id] && VX.ITEMS[st.id].tool, tier = tl ? VX.TIERS[tl.tier] : null;
    const dmg = tl ? (tl.kind === 'epee' ? tier.dmg : Math.max(2, tier.dmg - 2)) : 1;
    // coup critique : frappé en pleine chute (pas dans l'eau, ni en vol) -> ×1,5 et petites étoiles
    const Pl = G.player, crit = !Pl.onGround && Pl.vel.y < -1 && !Pl.inWater && !Pl.fly;
    damage(best, crit ? Math.round(dmg * 1.5 * 2) / 2 : dmg, dir.x * 7, dir.z * 7);
    if (crit) { if (FX() && FX().stars) FX().stars(best.x, best.y + best.T.h * 0.7, best.z, 14); G.sfx('crit', { dist: dist3(best) }); }
    if (best.T.bomber && best.fuse > 0) best.fuse = Math.max(0.001, best.fuse - 0.4);
    if (tl && st.d != null && G.mode !== 'creatif') { st.d--; if (st.d <= 0) G.inv[G.sel] = null; VX.UI.hud(); }
    G.player.exh += 0.1;
    return false;
  });
  H.on('dimensionChange', () => { for (const m of mobs.slice()) kill(m, false); for (const a of arrows) { a.on = false; a.g.visible = false; } });
  [I.VIANDE, I.STEAK, I.ESSENCE].forEach(id => VX.registry.creative(id));
  VX.Mobs = { list: mobs, spawn, kill, explode, damage, TYPES };
})();

/* ===== mobs.js : créatures — module branché uniquement par les hooks (aucune modification du moteur)
   Le jour : moutons, cochons, vaches (paisibles). La nuit et dans les grottes sombres : zombis (corps à corps, brûlent au soleil),
   archers squelettes (tirent des flèches) et le Braiseron, petit golem de braise à mèche qui explose.
   Les Braises : feux follets. Géométries et matériaux partagés (aucun objet lourd par image).
   MULTIJOUEUR (mp.js) : l'hôte simule les créatures autour de TOUS les joueurs de sa dimension (chaque créature vise le
   joueur le plus proche ; les coups portés aux invités leur sont envoyés), et diffuse leurs positions 10 fois par seconde.
   Un invité dans la même dimension que l'hôte n'en fait apparaître aucune : il affiche des « copies » interpolées,
   et ses coups (épée, flèches) sont envoyés à l'hôte. Dans une autre dimension que l'hôte, l'invité simule les siennes. ===== */
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
  const byNid = new Map();   // copies des créatures de l'hôte (invité) : identifiant réseau -> créature
  let nextNid = 1, wasRemote = false;
  const hostMode = () => !!(VX.MP && VX.MP.on && VX.MP.host);
  const remoteMode = () => !!(VX.MP && VX.MP.remoteMobs && VX.MP.remoteMobs());
  // joueurs visés : le joueur local, plus (chez l'hôte) les joueurs distants de la même dimension
  function targets() {
    const P = G.player, L = [{ id: null, local: true, pos: P.pos, eye: P.eye, alive: P.hp > 0 && G.mode !== 'creatif' }];
    if (hostMode()) for (const t of VX.MP.targets()) L.push(t);
    return L;
  }
  // blesse une cible ; kb = recul [x, y, z] (appliqué par le joueur distant lui-même)
  function hurtTarget(tg, n, kind, src, kb) {
    if (tg.local) return G.hurt(n, kind, src);
    VX.MP.sendTo(tg.id, { k: 'hurt', n, kind, sx: src ? src.x : null, sz: src ? src.z : null, kb: kb || null }); return true;
  }
  const fx = d => { if (hostMode()) VX.MP.relay(Object.assign({ k: 'mfx' }, d)); };
  const bAt = (x, y, z) => D[G.world.get(Math.floor(x), Math.floor(y), Math.floor(z))];
  const solid = (x, y, z) => { const b = bAt(x, y, z); return !!(b && b.solid); };
  const liquid = (x, y, z) => { const b = bAt(x, y, z); return !!(b && b.liquid); };
  // ciel visible au-dessus de cette case ? (pour brûler au soleil)
  function skyOpen(x, y, z) { const X = Math.floor(x), Z = Math.floor(z); for (let yy = Math.floor(y); yy < VX.H; yy++) { const b = D[G.world.get(X, yy, Z)]; if (b && b.opaque && b.solid) return false; } return true; }
  const day = () => VX.R.uniforms.uDay.value;
  const wrap = a => { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; };

  function spawn(type, x, y, z) {
    const T = TYPES[type], rig = build(T.spec); rig.g.position.set(x, y, z); G.scene.add(rig.g);
    const m = { nid: nextNid++, type, T, rig, x, y, z, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28, hp: T.hp, dim: G.dim, t: Math.random() * 10, phase: 0, dir: Math.random() * 6.28, think: 0, hitT: 0, atkCd: 1, flee: 0, ground: false, fire: 0, sunT: 0, fuse: 0, cryT: 4 + Math.random() * 12, flash: false, swing: 0 };
    mobs.push(m); return m;
  }
  function setMat(m, mt) { m.rig.g.traverse(o => { if (o.isMesh) o.material = mt || o.userData.mat; }); }
  function poof(m) {
    if (FX()) FX().burst(m.x, m.y + m.T.h * 0.5, m.z, 18, [0.85, 0.85, 0.85], { smoke: true, speed: 1.6, life: 0.7, grav: -0.5, spread: m.T.w * 2 });
    G.sfx('poof', { dist: dist3(m) });
  }
  // butin d'une créature (orbes d'expérience + objets), pour le joueur local
  function dropLoot(T, x, y, z) {
    if (G.mode === 'creatif') return;
    if (VX.XP) VX.XP.drop(x, y + 0.5, z, T.hostile ? 5 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 3));
    for (const [key, a, b] of T.drops) { const id = idOf(key); if (id == null) continue; const n = a + Math.floor(Math.random() * (b - a + 1)); if (n > 0) G.dropItem(id, n, new THREE.Vector3(x, y + 0.5, z)); }
  }
  // by : id du joueur distant qui a porté le coup fatal (son butin lui est envoyé)
  function kill(m, drop, by) {
    G.scene.remove(m.rig.g); const i = mobs.indexOf(m); if (i >= 0) mobs.splice(i, 1);   // géométries et matériaux partagés : rien à libérer
    if (m.remote) byNid.delete(m.nid);
    if (drop) {
      poof(m); fx({ e: 'die', id: m.nid });
      if (by && hostMode()) VX.MP.sendTo(by, { k: 'mdrop', t: m.type, x: m.x, y: m.y, z: m.z });
      else dropLoot(m.T, m.x, m.y, m.z);
    }
  }
  const dist3 = m => { const P = G.player.pos; return Math.hypot(P.x - m.x, P.y - m.y, P.z - m.z); };
  function damage(m, n, kx, kz, by) {
    if (m.remote) {   // copie d'une créature de l'hôte : le coup est envoyé, l'hôte décide (retour visuel immédiat)
      if (VX.MP && VX.MP.on) VX.MP.sendTo(VX.MP.hostId, { k: 'hit', id: m.nid, n, kx, kz });
      m.hitT = 0.3; if (FX()) FX().burst(m.x, m.y + m.T.h * 0.6, m.z, 6, [0.75, 0.1, 0.1], { speed: 2, life: 0.4 }); G.sfx('hit', { dist: dist3(m) });
      return;
    }
    m.hp -= n; m.hitT = 0.3; m.flee = 4; m.vx += kx; m.vz += kz; m.vy = Math.max(m.vy, 5);
    if (FX()) FX().burst(m.x, m.y + m.T.h * 0.6, m.z, 6, m.type === 'squelette' ? [0.9, 0.88, 0.8] : m.T.bomber ? [1, 0.5, 0.1] : [0.75, 0.1, 0.1], { speed: 2, life: 0.4 });
    G.sfx('hit', { dist: dist3(m) });
    if (m.hp <= 0) kill(m, true, by);
  }
  // hôte : coup d'un invité sur une de nos créatures
  function remoteHit(from, d) {
    const m = mobs.find(x => x.nid === d.id); if (!m || m.remote) return;
    const cl = (v, a) => Math.max(-a, Math.min(a, +v || 0));
    damage(m, Math.max(0, Math.min(30, +d.n || 0)), cl(d.kx, 12), cl(d.kz, 12), from);
    if (m.T.bomber && m.fuse > 0) m.fuse = Math.max(0.001, m.fuse - 0.4);
  }

  /* ---------- flèches (réserve de maillages réutilisés) ---------- */
  const arrows = [], ARROW_MAX = 24;
  const arrowProto = (() => { const g = new THREE.Group(); addBoxes(g, [[0.04, 0.04, 0.6, '#8a5f33', 0, 0, 0], [0.07, 0.07, 0.1, '#c8c8d0', 0, 0, 0.33], [0.12, 0.02, 0.12, '#e8e0d0', 0, 0, -0.26], [0.02, 0.12, 0.12, '#e8e0d0', 0, 0, -0.26]]); return g; })();
  function shoot(m, P) {   // P : cible (joueur local ou distant : { pos, eye })
    let a = arrows.find(x => !x.on);
    if (!a) { if (arrows.length >= ARROW_MAX) a = arrows.reduce((p, c) => (c.age > p.age ? c : p)); else { a = { g: arrowProto.clone(), on: false }; arrows.push(a); G.scene.add(a.g); } }
    const sx = m.x, sy = m.y + 1.45, sz = m.z, tx = P.pos.x - sx, ty = P.eye - 0.25 - sy, tz = P.pos.z - sz, d = Math.hypot(tx, tz), sp = 18;
    const tt = d / sp;   // visée : on compense la chute pendant le vol
    a.p = new THREE.Vector3(sx + tx / (d || 1) * 0.5, sy, sz + tz / (d || 1) * 0.5); a.v = new THREE.Vector3(tx / (d || 1) * sp + (Math.random() - 0.5) * 0.8, ty / Math.max(tt, 0.05) + 0.5 * 14 * tt + (Math.random() - 0.5) * 0.6, tz / (d || 1) * sp + (Math.random() - 0.5) * 0.8);
    a.on = true; a.stuck = false; a.vis = false; a.age = 0; a.dim = G.dim; a.g.visible = true; G.sfx('bow', { dist: dist3(m) });
    fx({ e: 'arrow', p: [a.p.x, a.p.y, a.p.z].map(v => Math.round(v * 100) / 100), v: [a.v.x, a.v.y, a.v.z].map(v => Math.round(v * 100) / 100) });
  }
  // invité : flèche purement visuelle (les dégâts viennent de l'hôte)
  function visArrow(p, v) {
    let a = arrows.find(x => !x.on);
    if (!a) { if (arrows.length >= ARROW_MAX) a = arrows.reduce((q, c) => (c.age > q.age ? c : q)); else { a = { g: arrowProto.clone(), on: false }; arrows.push(a); G.scene.add(a.g); } }
    a.p = new THREE.Vector3(p[0], p[1], p[2]); a.v = new THREE.Vector3(v[0], v[1], v[2]);
    a.on = true; a.stuck = false; a.vis = true; a.age = 0; a.dim = G.dim; a.g.visible = true; G.sfx('bow', { dist: Math.hypot(G.player.pos.x - p[0], G.player.pos.z - p[2]) });
  }
  function arrowsTick(dt, tgs) {
    for (const a of arrows) {
      if (!a.on) continue; a.age += dt;
      if (a.dim !== G.dim || a.age > (a.stuck ? 6 : 8)) { a.on = false; a.g.visible = false; continue; }
      if (a.stuck) continue;
      a.v.y -= 14 * dt; const nx = a.p.x + a.v.x * dt, ny = a.p.y + a.v.y * dt, nz = a.p.z + a.v.z * dt;
      // les joueurs (boîtes AABB) ; flèche visuelle (invité) : jamais de dégâts
      let touched = false;
      if (!a.vis) for (const t of tgs) {
        const q = t.pos; if (!(nx > q.x - 0.4 && nx < q.x + 0.4 && nz > q.z - 0.4 && nz < q.z + 0.4 && ny > q.y && ny < q.y + 1.85)) continue;
        if (t.local) { const P = G.player, hit = G.hurt(3, 'fleche', { x: P.pos.x - a.v.x, z: P.pos.z - a.v.z }); if (hit !== false) { P.vel.x += a.v.x * 0.15; P.vel.z += a.v.z * 0.15; } G.sfx('arrow'); }
        else hurtTarget(t, 3, 'fleche', { x: q.x - a.v.x, z: q.z - a.v.z }, [a.v.x * 0.15, 0, a.v.z * 0.15]);
        touched = true; break;
      }
      if (touched) { a.on = false; a.g.visible = false; continue; }
      if (solid(nx, ny, nz)) { a.stuck = true; G.sfx('arrow', { dist: Math.hypot(G.player.pos.x - nx, G.player.pos.z - nz) }); continue; }
      a.p.set(nx, ny, nz); a.g.position.copy(a.p); a.g.lookAt(nx + a.v.x, ny + a.v.y, nz + a.v.z);
    }
  }

  /* ---------- explosion : détruit les blocs autour (sauf socle, obsidienne et blocs indestructibles), dégâts selon la distance ---------- */
  function explode(x, y, z, r) {
    const w = G.world, cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    G.sfx('explode'); if (FX()) FX().explosion(x, y, z, r); fx({ e: 'boom', x, y, z, r });
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
    // les joueurs distants (hôte) : dégâts et recul envoyés
    if (hostMode()) for (const t of VX.MP.targets()) { const qx = t.pos.x - x, qy = t.pos.y + 0.9 - y, qz = t.pos.z - z, qd = Math.hypot(qx, qy, qz); if (qd < R2) { const k = 1 - qd / R2; hurtTarget(t, Math.round(k * k * 22 + k * 4), 'explosion', { x, z }, [qx / (qd || 1) * k * 14, k * 9, qz / (qd || 1) * k * 14]); } }
    // les autres créatures
    for (const o of mobs.slice()) { if (o.dim !== G.dim) continue; const ox = o.x - x, oz = o.z - z, od = Math.hypot(ox, o.y - y, oz); if (od < R2) damage(o, Math.round((1 - od / R2) * 20), ox / (od || 1) * 8, oz / (od || 1) * 8); }
  }

  /* ---------- apparition autour du joueur ---------- */
  let spawnT = 0;
  const glowNear = (x, y, z) => { for (let dy = -2; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz += 2) for (let dx = -4; dx <= 4; dx += 2) { const b = D[G.world.get(x + dx, y + dy, z + dz)]; if (b && b.glow) return true; } return false; };
  function trySpawn() {
    // autour d'un joueur au hasard (en multijoueur, l'hôte fait aussi apparaître les créatures près des invités)
    const tgs = targets(), anchor = tgs[Math.floor(Math.random() * tgs.length)], P = { pos: anchor.pos };
    if (mobs.length > 16 * Math.min(3, tgs.length)) return;
    const dk = day(), here = mobs.filter(m => m.dim === G.dim && Math.hypot(m.x - P.pos.x, m.z - P.pos.z) < 64);
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
  H.on('playerTick', ({ dt }) => {
    // invité dans la dimension de l'hôte : copies seulement (changement de mode -> on repart de zéro)
    const rm = remoteMode();
    if (rm !== wasRemote) { wasRemote = rm; for (const m of mobs.slice()) kill(m, false); }
    if (rm) { arrowsTick(dt, []); remoteTick(dt); tint(); return; }
    if ((spawnT -= dt) <= 0) { spawnT = 1.1; trySpawn(); }
    const tgs = targets();
    arrowsTick(dt, tgs);
    const dk = day();
    for (const m of mobs.slice()) {
      if (mobs.indexOf(m) < 0) continue;   // déjà tuée pendant cette image (explosion…)
      if (m.dim !== G.dim) { kill(m, false); continue; }
      // cible : le joueur (local ou distant) le plus proche
      let P = tgs[0], dist = Infinity;
      for (const t of tgs) { const d = Math.hypot(t.pos.x - m.x, t.pos.z - m.z); if (d < dist) { dist = d; P = t; } }
      const T = m.T, dx = P.pos.x - m.x, dz = P.pos.z - m.z, dy = P.pos.y - m.y, alive = P.alive;
      if (dist > (T.hostile ? 56 : 80)) { kill(m, false); continue; }
      if (!G.world.chunk(Math.floor(m.x / 16), Math.floor(m.z / 16))) continue;   // terrain pas chargé chez l'hôte : créature figée
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
        if (dist < 1.3 && Math.abs(dy) < 1.8 && m.atkCd <= 0) {
          m.atkCd = 1; m.swing = 1;
          if (P.local) { const L = G.player, k = G.hurt(T.dmg, 'mob', m) === false && G.blocking ? 0.4 : 1; L.vel.x += wx * 5 * k; L.vel.z += wz * 5 * k; L.vel.y = Math.max(L.vel.y, 4 * k); if (k < 1) { m.vx -= wx * 6; m.vz -= wz * 6; } }
          else hurtTarget(P, T.dmg, 'mob', { x: m.x, z: m.z }, [wx * 5, 4, wz * 5]);
        }
      } else if (m.flee > 0 && T.passive) { wx = -dx / (dist || 1); wz = -dz / (dist || 1); sp *= 2; if (m.think <= 0) { m.think = 0.6; m.dir = Math.atan2(wz, wx) + (Math.random() - 0.5) * 1.5; } wx = Math.cos(m.dir); wz = Math.sin(m.dir); }
      else { if (m.think <= 0) { m.think = 2 + Math.random() * 4; m.dir = Math.random() < 0.4 ? null : Math.random() * 6.283; } if (m.dir != null) { wx = Math.cos(m.dir); wz = Math.sin(m.dir); sp *= 0.5; } }
      if (m.fuse > 0) { wx = 0; wz = 0; }
      // les paisibles évitent de tomber d'une falaise
      if (T.passive && (wx || wz) && !solid(m.x + wx * 0.8, m.y - 0.5, m.z + wz * 0.8) && !solid(m.x + wx * 0.8, m.y - 1.5, m.z + wz * 0.8) && !solid(m.x + wx * 0.8, m.y - 2.5, m.z + wz * 0.8)) { wx = -wx; wz = -wz; m.dir = m.dir != null ? m.dir + Math.PI : null; }
      m.vx += (wx * sp - m.vx) * Math.min(1, dt * 6); m.vz += (wz * sp - m.vz) * Math.min(1, dt * 6);
      if (T.fly) { const ty = P.pos.y + 1.2 + Math.sin(m.t * 2) * 0.6; m.vy += ((sees ? ty - m.y : Math.sin(m.t) * 0.5) * 2 - m.vy) * Math.min(1, dt * 3); if (sees && dist < 1.3 && Math.abs(dy - 0.5) < 1.6 && m.atkCd <= 0) { m.atkCd = 1; hurtTarget(P, T.dmg, 'mob', { x: m.x, z: m.z }); } }
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
    tint();
  });
  // couleur selon le jour (tous les matériaux partagés à la fois)
  function tint() {
    const k = Math.max(0.3, G.dim === 'surface' ? day() : 0.9);
    for (const mt of MATS) if (!mt.userData.glow) mt.color.copy(mt.userData.base).multiplyScalar(k);
  }

  /* ---------- invité : copies des créatures de l'hôte (positions reçues 10 fois par seconde, interpolées) ---------- */
  function applySnapshot(d) {
    if (!remoteMode() || d.dim !== G.dim || !Array.isArray(d.l)) return;
    const seen = new Set();
    for (const e of d.l) {
      const [nid, type, x, y, z, yaw, hy, fl, fuse] = e, T = TYPES[type]; if (!T) continue; seen.add(nid);
      let m = byNid.get(nid);
      if (!m) { m = spawn(type, x, y, z); m.remote = true; m.nid = nid; m.yaw = yaw; m.rig.g.rotation.y = yaw; byNid.set(nid, m); }
      m.tx = x; m.ty = y; m.tz = z; m.tyaw = yaw; m.hy = hy || 0; m.fuse = fuse || 0; m.fire = fl & 2 ? 1 : 0;
      if (fl & 1) m.hitT = Math.max(m.hitT, 0.12); if (fl & 8) m.swing = 1;
    }
    for (const m of mobs.slice()) if (m.remote && !seen.has(m.nid)) kill(m, false);
  }
  function remoteTick(dt) {
    const k = Math.min(1, dt * 10);
    for (const m of mobs) {
      if (!m.remote || m.tx == null) continue;
      const T = m.T, g = m.rig.g, ox = m.x, oz = m.z;
      m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k; m.z += (m.tz - m.z) * k; m.yaw += wrap(m.tyaw - m.yaw) * k;
      m.t += dt; m.hitT -= dt; m.swing = Math.max(0, m.swing - dt * 3);
      g.position.set(m.x, m.y, m.z); g.rotation.y = T.fly ? g.rotation.y + dt : m.yaw;
      const hs = Math.hypot(m.x - ox, m.z - oz) / Math.max(dt, 1e-3);
      m.phase += dt * hs * 4.2; const amp = Math.min(1, hs / 1.5) * 0.75;
      for (const L of m.rig.legs) L.rotation.x = Math.sin(m.phase + L.userData.ph * Math.PI) * amp;
      for (const A of m.rig.arms) A.rotation.x = A.userData.rest + Math.sin(m.phase + A.userData.ph * Math.PI) * amp * 0.4 - m.swing * 0.8;
      if (m.rig.head && !T.bomber) m.rig.head.rotation.y += ((m.hy || 0) - m.rig.head.rotation.y) * k;
      if (T.bomber) { m.rig.head.visible = m.fuse > 0 ? Math.floor(m.t * 12) % 2 === 0 : Math.floor(m.t * 1.5) % 3 !== 0; g.scale.setScalar(m.fuse > 0 ? 1 + Math.min(1, m.fuse / 1.5) * 0.25 + Math.sin(m.t * 40) * 0.02 : 1); }
      if (m.fire > 0 && FX() && Math.random() < dt * 20) FX().burst(m.x, m.y + Math.random() * T.h, m.z, 1, [1, 0.5 + Math.random() * 0.4, 0.1], { speed: 0.6, up: 2, grav: -2, life: 0.5, spread: T.w * 2 });
      const want = m.hitT > 0 ? RED : m.fuse > 0 && Math.floor(m.fuse * (m.fuse > 1 ? 14 : 7)) % 2 === 0 ? WHITE : null;
      if (want !== m.flash) { m.flash = want; setMat(m, want); }
    }
  }
  // hôte : état des créatures de sa dimension, pour les invités
  const r2 = v => Math.round(v * 100) / 100;
  function snapshot() {
    if (!hostMode()) return null;
    const l = [];
    for (const m of mobs) if (m.dim === G.dim && !m.remote) l.push([m.nid, m.type, r2(m.x), r2(m.y), r2(m.z), r2(m.yaw), r2(m.rig.head ? m.rig.head.rotation.y : 0), (m.hitT > 0 ? 1 : 0) | (m.fire > 0 ? 2 : 0) | (m.swing > 0.6 ? 8 : 0), r2(m.fuse)]);
    return { k: 'mobs', dim: G.dim, l };
  }
  function remoteFx(d) {
    if (!remoteMode()) return;
    if (d.e === 'die') { const m = byNid.get(d.id); if (m) { poof(m); kill(m, false); } }
    else if (d.e === 'arrow' && Array.isArray(d.p) && Array.isArray(d.v)) visArrow(d.p, d.v);
    else if (d.e === 'boom') { G.sfx('explode', { dist: Math.hypot(G.player.pos.x - d.x, G.player.pos.z - d.z) }); if (FX()) FX().explosion(d.x, d.y, d.z, d.r || 3); }
  }
  // invité : le butin d'une créature qu'il a achevée chez l'hôte
  function remoteDrop(d) { const T = TYPES[d.t]; if (T && isFinite(d.x) && isFinite(d.y) && isFinite(d.z)) dropLoot(T, d.x, d.y, d.z); }
  function resetRemote() { for (const m of mobs.slice()) if (m.remote) kill(m, false); wasRemote = false; }

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
  VX.Mobs = { list: mobs, spawn, kill, explode, damage, TYPES, snapshot, applySnapshot, remoteHit, remoteFx, remoteDrop, resetRemote };
})();

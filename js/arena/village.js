/* ===== arena/village.js : le village, accueil de « COLOSSES : L'ASCENSION » =====
   Un vrai village médiéval low-poly (style KayKit) où l'on se promène avec son personnage :
   place pavée et fontaine, grand-rue jusqu'au grand portail, rue du marché, taverne, forge, temple des âmes,
   ruisseau et pont, palissade et porte, moulin, habitants qui marchent / travaillent / discutent, poules, fumées…
   Lieux d'interaction (touche E) :
   - le grand portail (jouer seul)            - le tableau des aventuriers (jouer entre amis)
   - l'échoppe du tailleur (personnage)        - la roue des âmes, dans son temple (autel des âmes)
   - la pierre des paliers (difficulté)        - le poteau « autres jeux », à la porte (retour à l'accueil)
   Modèles : outils/blender-village.py -> assets-village.js (clés vil_<nom>) ; plan : outils/blender-village/layout.py
   (window.GAME_ASSETS.village). Le décor fixe est fusionné en quelques maillages (une poignée d'appels de dessin). */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, Q = BR.Asc, UI = BR.UI, Au = BR.Audio, Acc = BR.Account;
  const VG = (BR.Village = {});
  let V = null;
  const L = c => new THREE.Color(c).convertSRGBToLinear();
  const DEG = Math.PI / 180, UP = new V3(0, 1, 0);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- lieux d'interaction (textes) ---------- */
  const META = {
    portal: { n: 'Le grand portail', s: 'Jouer seul', col: '#ffd76a' },
    board: { n: 'Tableau des aventuriers', s: 'Jouer entre amis', col: '#7ec8ff' },
    stall: { n: 'Le tailleur', s: 'Personnage', col: '#ff9a6a' },
    wheel: { n: 'La roue des âmes', s: 'Autel des âmes', col: '#b9a6ff' },
    obelisk: { n: 'Pierre des paliers', s: 'Difficulté', col: '#9ad8ff' },
    sign: { n: 'Autres jeux', s: 'Retour à l\'accueil', col: '#cfc6ad' },
    armory: { n: 'Maître d\'armes', s: 'Classe et pouvoirs', col: '#ff7a5a' },
    tree: { n: 'Maître des arts', s: 'Arbres de talents', col: '#6ae0ff' },
  };
  // plan de secours (si assets-village.js est absent) : les lieux restent utilisables
  const FALLBACK = { props: [], cols: [], rects: [], discs: [], paths: [], creek: [], creekW: 3, bridge: [0, -99, 0], wall: 36, spawn: [0, -7], bunting: [], npcs: [], chickens: null,
    spots: { portal: { p: [0, 18], r: 3.6, m: ['portal', 0, 21, 180], h: 10 }, board: { p: [-9, 8], r: 3, m: ['board', -11, 10, 135], h: 4.4 }, stall: { p: [-13, -2], r: 3.2, m: ['tailor', -15, -3, 90], h: 5 },
      wheel: { p: [13, -2], r: 3.4, m: ['temple', 18, -3, -90], h: 6 }, obelisk: { p: [9, 8], r: 3, m: ['obelisk', 11, 10, -135], h: 9 }, sign: { p: [0, -20], r: 2.6, m: ['sign', 0, -22, 0], h: 4.9 } } };

  /* ---------- ambiances (choisies selon l'heure du joueur) ---------- */
  const PRESETS = {
    day: { top: '#3b72c4', mid: '#9fc2e8', hor: '#ffdcae', sun: '#ffd08a', cloud: '#fff2e2', dir: [-0.5, 0.42, -0.76], size: 0.006, glow: 1.6, clouds: 0.42, stars: 0,
      fog: ['#dccfba', 0.0031], hemi: ['#ffe8cc', '#56683a', 0.8], key: ['#ffd9ac', 2.45], amb: 0.1, win: 1.45, lamp: 0.7, flies: 0.35, exp: 1.08 },
    night: { top: '#070d24', mid: '#16274f', hor: '#4e4068', sun: '#dfe8ff', cloud: '#3a4468', dir: [0.38, 0.55, 0.74], size: 0.004, glow: 0.7, clouds: 0.3, stars: 1,
      fog: ['#1c2644', 0.0042], hemi: ['#6278b0', '#1a2418', 0.6], key: ['#a6bcff', 0.8], amb: 0.14, win: 2.7, lamp: 1.5, flies: 1, exp: 1.22 },
  };
  // toujours une fin d'après-midi dorée (fenêtres déjà allumées) ; l'ambiance de nuit existe : BR.Village.preset('night')
  const presetNow = () => 'day';
  const CLS = { chevalier: 'Chevalier', mage: 'Mage', archer: 'Archer' };

  /* ---------- outils ---------- */
  function label(lines, w) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => { const y = lines.length === 1 ? 80 : 52 + i * 60; g.font = i === 0 ? '700 52px Oswald, Arial Narrow, sans-serif' : '500 34px Inter, Arial, sans-serif'; g.lineWidth = 9; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(ln.t, 256, y); g.fillStyle = ln.c || '#fff'; g.fillText(ln.t, 256, y); });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(w || 4, (w || 4) * 160 / 512, 1); s.renderOrder = 12;
    return s;
  }
  // bruit de valeur 2D (bords des pavés, terre) : grille aléatoire n x n agrandie en N x N (interpolation douce)
  function noiseTile(N, n, seed) {
    const r = BR.rngFrom(seed), s = document.createElement('canvas'); s.width = s.height = n; const sg = s.getContext('2d'), im = sg.getImageData(0, 0, n, n);
    for (let i = 0; i < n * n; i++) { const v = r() * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    sg.putImageData(im, 0, 0);
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(s, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data, out = new Float32Array(N * N); for (let i = 0; i < N * N; i++) out[i] = d[i * 4] / 255; return out;
  }
  function noiseField(n, seed) { const r = BR.rngFrom ? BR.rngFrom(seed) : Math.random, a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = r(); return (x, y) => { x = ((x % n) + n) % n; y = ((y % n) + n) % n; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, x1 = (xi + 1) % n, y1 = (yi + 1) % n, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return (a[yi * n + xi] * (1 - u) + a[yi * n + x1] * u) * (1 - v) + (a[y1 * n + xi] * (1 - u) + a[y1 * n + x1] * u) * v; }; }

  /* ---------- géométrie : distances au ruisseau, collisions ---------- */
  function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = clamp(t, 0, 1); const cx = ax + dx * t, cz = az + dz * t; return [Math.hypot(px - cx, pz - cz), cx, cz]; }
  function creekNear(D, x, z) { let best = [1e9, 0, 0]; const C = D.creek; for (let i = 0; i < C.length - 1; i++) { const r = segDist(x, z, C[i][0], C[i][1], C[i + 1][0], C[i + 1][1]); if (r[0] < best[0]) best = r; } return best; }
  function onBridge(D, x, z, m) { const b = D.bridge, a = (b[2] || 0) * DEG, dx = x - b[0], dz = z - b[1], lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a); return Math.abs(lx) < 1.8 + (m || 0) && Math.abs(lz) < 5.4 ? lz : null; }
  // hauteur du sol marchable (pont en dos d'âne, estrade du portail)
  function heightAt(x, z) {
    const D = V.D; let y = 0;
    const lz = onBridge(D, x, z); if (lz !== null) { const a = Math.abs(lz); y = a < 4.6 ? 0.2 + 0.55 * (1 - (lz / 4.6) * (lz / 4.6)) : 0.2 * clamp((5.4 - a) / 0.8, 0, 1); }
    const P = V.portalPos; if (P) { const d = Math.hypot(x - P.x, z - P.z); if (d < 4.75) y = Math.max(y, 0.6); else if (d < 5.45) y = Math.max(y, 0.3); }
    return y;
  }
  // repousse un cercle (x, z, rayon) hors des obstacles ; renvoie [x, z]
  // collisions sûres : plusieurs passes ; si deux obstacles très proches se renvoient le joueur (coin sans place),
  // on refuse d'y entrer (on reste où on était) et, si on y est déjà coincé, on file vers la place libre la plus proche
  function collideSafe(ox, oz, nx, nz, rad, cols) {
    let x = nx, z = nz;
    for (let i = 0; i < 5; i++) {
      const r = collide(x, z, rad, cols);
      x = r[0]; z = r[1];
      if (isFree(x, z, rad, cols)) return r;
    }
    if (isFree(ox, oz, rad, cols)) return [ox, oz];
    return nearestFree(ox, oz, rad, cols) || [x, z];
  }
  // libre = ne mord dans AUCUN obstacle (testés un par un : au fond d'un coin, deux poussées successives peuvent s'annuler)
  function isFree(x, z, rad, cols) {
    const m = rad - 0.01;
    for (let k = 0; k < cols.length; k++) {
      const c = cols[k];
      if (c[0] === 'c') { if (Math.hypot(x - c[1], z - c[2]) < c[3] + m) return false; continue; }
      const dx = x - c[1], dz = z - c[2];
      if (Math.abs(dx) > c[3] + c[4] + rad || Math.abs(dz) > c[3] + c[4] + rad) continue;
      const ca = Math.cos(c[5]), sa = Math.sin(c[5]), lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
      if (Math.hypot(lx - clamp(lx, -c[3], c[3]), lz - clamp(lz, -c[4], c[4])) < m) return false;
    }
    return true;
  }
  function nearestFree(x, z, rad, cols) {
    for (let d = 0.15; d <= 3; d += 0.15) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (isFree(px, pz, rad, cols)) return [px, pz];
    }
    return null;
  }
  function collide(x, z, rad, cols) {
    for (let k = 0; k < cols.length; k++) {
      const c = cols[k];
      if (c[0] === 'c') { const dx = x - c[1], dz = z - c[2], d = Math.hypot(dx, dz), m = c[3] + rad; if (d < m && d > 1e-5) { x = c[1] + dx / d * m; z = c[2] + dz / d * m; } continue; }
      const a = c[5], ca = Math.cos(a), sa = Math.sin(a), dx = x - c[1], dz = z - c[2];
      if (Math.abs(dx) > c[3] + c[4] + rad || Math.abs(dz) > c[3] + c[4] + rad) continue;
      let lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
      const qx = clamp(lx, -c[3], c[3]), qz = clamp(lz, -c[4], c[4]);
      let ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
      if (d >= rad) continue;
      if (d > 1e-5) { lx = qx + ox / d * rad; lz = qz + oz / d * rad; }
      else { const px = c[3] - Math.abs(lx), pz = c[4] - Math.abs(lz); if (px < pz) lx = Math.sign(lx || 1) * (c[3] + rad); else lz = Math.sign(lz || 1) * (c[4] + rad); }
      x = c[1] + lx * ca + lz * sa; z = c[2] - lx * sa + lz * ca;
    }
    return [x, z];
  }
  // grille de 4 m : liste des obstacles proches de chaque case (accélère les tests de la prairie et des lucioles)
  function colGrid(cols, pad) {
    const S = 4, N = 34, off = 68, cells = [];
    cols.forEach(c => { const r = (c[0] === 'c' ? c[3] : Math.hypot(c[3], c[4])) + pad, x0 = Math.max(0, Math.floor((c[1] - r + off) / S)), x1 = Math.min(N - 1, Math.floor((c[1] + r + off) / S)), z0 = Math.max(0, Math.floor((c[2] - r + off) / S)), z1 = Math.min(N - 1, Math.floor((c[2] + r + off) / S));
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) (cells[j * N + i] = cells[j * N + i] || []).push(c); });
    const none = [];
    return (x, z) => { const i = Math.floor((x + off) / S), j = Math.floor((z + off) / S); return i < 0 || j < 0 || i >= N || j >= N ? none : cells[j * N + i] || none; };
  }
  function insideCol(x, z, cols, pad, big) {
    if (typeof cols === 'function') cols = cols(x, z);
    for (let k = 0; k < cols.length; k++) {
      const c = cols[k];
      if (c[0] === 'c') { if (big && c[3] < 1) continue; if (Math.hypot(x - c[1], z - c[2]) < c[3] + pad) return true; continue; }
      if (big && c[3] * c[4] < 1.2) continue;
      const a = c[5], dx = x - c[1], dz = z - c[2], lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
      if (Math.abs(lx) < c[3] + pad && Math.abs(lz) < c[4] + pad) return true;
    }
    return false;
  }

  /* ---------- fusion des modèles : un maillage par famille de matériau ---------- */
  function bucketOf(name) {
    if (/^glow_win/.test(name)) return 'win';
    if (/^glow_pal/.test(name)) return 'pal';
    if (/^glow_/.test(name)) return 'glow';
    if (/^water/.test(name)) return 'water';
    if (/^leaf_/.test(name)) return 'leaf';
    if (/^cloth/.test(name)) return 'cloth';
    if (/^far_/.test(name)) return 'far';
    return 'std';
  }
  function Merger() {
    const parts = {};
    const M = {
      parts,
      /** ajoute une géométrie déjà en coordonnées finales */
      raw(b, pos, nrm, col, sway, idx) { (parts[b] = parts[b] || []).push({ pos, nrm, col, sway, idx }); },
      /** ajoute un maillage : m4 = matrice finale ; couleur unie (sRGB linéaire) ; swayFn(y) -> poids d'ondulation */
      mesh(b, geo, m4, color, swayFn) {
        const pa = geo.attributes.position, na = geo.attributes.normal, n = pa.count;
        const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), v = new V3(), nm = new THREE.Matrix3().getNormalMatrix(m4);
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(m4); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
          if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nrm[i * 3] = v.x; nrm[i * 3 + 1] = v.y; nrm[i * 3 + 2] = v.z; } else nrm[i * 3 + 1] = 1;
        }
        let sway = null; if (swayFn) { sway = new Float32Array(n); for (let i = 0; i < n; i++) sway[i] = swayFn(pos[i * 3 + 1], pos[i * 3], pos[i * 3 + 2]); }
        const e = { pos, nrm, col: color, sway, idx: geo.index ? geo.index.array : null };
        (parts[b] = parts[b] || []).push(e);
        return e;
      },
      /** construit les BufferGeometry finales : { bucket: geometry } */
      build() {
        const out = {};
        for (const b in parts) {
          const P = parts[b]; let nv = 0, ni = 0;
          P.forEach(p => { const c = p.pos.length / 3; nv += c; ni += p.idx ? p.idx.length : c; });
          if (!nv) continue;
          const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3), sw = new Float32Array(nv), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
          let ov = 0, oi = 0, anySway = false;
          P.forEach(p => {
            const c = p.pos.length / 3;
            pos.set(p.pos, ov * 3); nrm.set(p.nrm, ov * 3);
            if (p.col && p.col.isColor) for (let i = 0; i < c; i++) { col[(ov + i) * 3] = p.col.r; col[(ov + i) * 3 + 1] = p.col.g; col[(ov + i) * 3 + 2] = p.col.b; }
            else if (p.col) col.set(p.col, ov * 3);
            if (p.sway) { sw.set(p.sway, ov); anySway = true; }
            if (p.idx) for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + ov; else for (let i = 0; i < c; i++) idx[oi + i] = ov + i;
            oi += p.idx ? p.idx.length : c; ov += c;
          });
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
          if (anySway) g.setAttribute('sway', new THREE.BufferAttribute(sw, 1));
          g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
          out[b] = g;
        }
        return out;
      },
    };
    return M;
  }
  // matériaux des familles
  function swayShader(mat, kind) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = V.uTime;
      sh.vertexShader = 'attribute float sway;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', kind === 'leaf'
        ? `#include <begin_vertex>
          float ph = uTime * 1.35 + position.x * 0.31 + position.z * 0.23;
          transformed.x += sin(ph) * 0.11 * sway; transformed.z += cos(ph * 0.8 + 1.3) * 0.08 * sway; transformed.y += sin(ph * 1.7) * 0.03 * sway;`
        : `#include <begin_vertex>
          float ph = uTime * 3.0 + position.x * 0.8 + position.z * 0.6 - sway * 3.2;
          transformed.x += sin(ph) * 0.16 * sway; transformed.z += cos(ph * 0.9) * 0.16 * sway; transformed.y += sin(ph * 1.3) * 0.05 * sway;`);
    };
    mat.customProgramCacheKey = () => 'vil-' + kind;
  }
  function bucketMat(b) {
    let m;
    if (b === 'win') m = new THREE.MeshBasicMaterial({ vertexColors: true });
    else if (b === 'glow') { m = new THREE.MeshBasicMaterial({ vertexColors: true }); m.color.setScalar(2.2); }
    else if (b === 'pal') { m = new THREE.MeshBasicMaterial({ vertexColors: false }); m.color.copy(L(Q.palCol(Q.selPal()))).multiplyScalar(2.2); V.palMats.push(m); }
    else if (b === 'water') m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.88 });
    else if (b === 'far') m = new THREE.MeshLambertMaterial({ vertexColors: true });
    else if (b === 'cloth') { m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }); swayShader(m, 'cloth'); }
    else if (b === 'leaf') { m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }); swayShader(m, 'leaf'); }
    else m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.0 });
    if (b === 'win') V.winMats.push(m);
    V.mats.push(m);
    return m;
  }
  function meshesOf(geos, parent) {
    const out = [];
    for (const b in geos) {
      const me = new THREE.Mesh(geos[b], bucketMat(b));
      me.frustumCulled = b !== 'far' && !!parent;
      me.castShadow = b === 'std' || b === 'leaf' || b === 'cloth';
      me.receiveShadow = b !== 'far' && b !== 'glow' && b !== 'win' && b !== 'pal';
      me.userData.bucket = b;
      (parent || V.scene).add(me); out.push(me);
    }
    return out;
  }
  const EMPTY = /^(soulfire|smoke|fire|light|lamp|spout|flag|soul|vortex|anvil|work|seat|arcane)/;
  /** place un modèle vil_<nom> : le décor va dans le fusionneur ; renvoie { empties, dyn } */
  function place(MG, name, x, z, rot, s, tint, y) {
    const g = BR.Assets.models['vil_' + name]; if (!g) return null;
    const root = g.scene; root.updateMatrixWorld(true);
    const P = new THREE.Matrix4().compose(new V3(x, y || 0, z), new THREE.Quaternion().setFromAxisAngle(UP, (rot || 0) * DEG), new V3(s || 1, s || 1, s || 1));
    const inst = { name, x, z, rot: rot || 0, P, empties: [], dyn: {} };
    const colorOf = m => (tint && tint[m.name]) ? L(tint[m.name]) : m.color.clone();
    const cloth = [], y0 = y || 0, m4 = new THREE.Matrix4(), inv = new THREE.Matrix4();
    const walk = (o, dynRoot, DM) => {
      if (!dynRoot && /^dyn_/.test(o.name)) {
        // pièce animée : fusion à part, dans son propre repère (pivot)
        const sub = Merger(); inv.copy(o.matrixWorld).invert();
        o.children.forEach(ch => walk(ch, o, sub));
        if (o.isMesh) addMesh(o, sub, inv);
        const grp = new THREE.Group(); new THREE.Matrix4().multiplyMatrices(P, o.matrixWorld).decompose(grp.position, grp.quaternion, grp.scale);
        meshesOf(sub.build(), grp); V.scene.add(grp); inst.dyn[o.name] = grp;
        return;
      }
      if (o.isMesh) addMesh(o, DM || MG, dynRoot ? inv : null);
      else if (!dynRoot && EMPTY.test(o.name) && !o.children.some(c => c.isMesh)) inst.empties.push({ n: o.name.match(EMPTY)[1], p: new V3().setFromMatrixPosition(m4.multiplyMatrices(P, o.matrixWorld)) });
      if (o.isMesh && o.children.length === 0) return;
      o.children.forEach(ch => walk(ch, dynRoot, DM));
    };
    function addMesh(o, target, rel) {
      const mats = Array.isArray(o.material) ? o.material : [o.material], mat = mats[0], b = bucketOf(mat.name || '');
      const M4 = rel ? new THREE.Matrix4().multiplyMatrices(rel, o.matrixWorld) : new THREE.Matrix4().multiplyMatrices(P, o.matrixWorld);
      const sw = b === 'leaf' ? (yy => clamp((yy - y0 - 1.4) / 4, 0, 1)) : null;
      const e = target.mesh(b, o.geometry, M4, colorOf(mat), sw);
      if (b === 'cloth' && !rel) cloth.push(e);
    }
    walk(root, null, null);
    if (cloth.length) { let top = -1e9; cloth.forEach(e => { for (let i = 1; i < e.pos.length; i += 3) top = Math.max(top, e.pos[i]); }); cloth.forEach(e => { const n = e.pos.length / 3; e.sway = new Float32Array(n); for (let i = 0; i < n; i++) e.sway[i] = clamp((top - e.pos[i * 3 + 1]) / 1.7, 0, 1); }); }
    return inst;
  }

  /* ---------- sol : pavés et terre battue (masque peint + texture de pavés répétée) ---------- */
  const MAP = 96, MAPN = 1024;
  function paveMask(D) {
    const N = MAPN, k = N / MAP, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    const P = (x, z) => [(x + MAP / 2) * k, (z + MAP / 2) * k];
    g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
    g.filter = 'blur(2px)'; g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = 'rgb(0,255,0)';
    D.paths.forEach(([kd, w, pts]) => { g.lineWidth = w * k; g.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); });
    g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgb(255,0,0)';
    D.rects.forEach(([kd, x0, z0, x1, z1]) => { const a = P(x0, z0), b = P(x1, z1); g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); });
    D.discs.forEach(([kd, x, z, r]) => { const a = P(x, z); g.beginPath(); g.arc(a[0], a[1], r * k, 0, 7); g.fill(); });
    g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    const id = g.getImageData(0, 0, N, N), d = id.data, A = noiseTile(N, 74, 17), B = noiseTile(N, 228, 29);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4, a = A[y * N + x], b = B[y * N + x], w = (a - 0.5) * 120 + (b - 0.5) * 50;
      if (d[i] > 2) d[i] = clamp(d[i] + w, 0, 255);
      if (d[i + 1] > 2) d[i + 1] = clamp(d[i + 1] + w * 0.9, 0, 255);
      d[i + 2] = clamp(a * 160 + b * 95, 0, 255); d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    return { canvas: c, data: d, at(x, z) { const px = Math.floor((x + MAP / 2) * k), py = Math.floor((z + MAP / 2) * k); if (px < 0 || py < 0 || px >= N || py >= N) return 0; const i = (py * N + px) * 4; return Math.max(d[i], d[i + 1]); } };
  }
  function cobbleTex() {
    const n = 512, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
    g.fillStyle = '#5a5248'; g.fillRect(0, 0, n, n);
    const rows = 8, h = n / rows, cols = ['#a99f8e', '#b8ad9a', '#9c9282', '#c2b7a2', '#8f8676', '#b0a28a'], r = BR.rngFrom ? BR.rngFrom(91) : Math.random;
    for (let j = 0; j < rows; j++) {
      let x = (j % 2) * h * 0.55;
      while (x < n + h) {
        const w = h * (0.8 + r() * 0.5), y = j * h;
        for (const dx of [0, -n]) for (const dy of [0, -n, n]) {
          const X = x + dx + 3, Y = y + dy + 3, W = w - 6, H = h - 6, R = 10;
          g.fillStyle = cols[(r() * cols.length) | 0];
          g.beginPath(); g.moveTo(X + R, Y); g.lineTo(X + W - R, Y); g.quadraticCurveTo(X + W, Y, X + W, Y + R); g.lineTo(X + W, Y + H - R); g.quadraticCurveTo(X + W, Y + H, X + W - R, Y + H); g.lineTo(X + R, Y + H); g.quadraticCurveTo(X, Y + H, X, Y + H - R); g.lineTo(X, Y + R); g.quadraticCurveTo(X, Y, X + R, Y); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(X + 6, Y + 4, W - 12, 5);
          g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(X + 4, Y + H - 7, W - 8, 5);
        }
        x += w;
      }
    }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(90,130,50,${0.2 + r() * 0.4})`; g.beginPath(); g.arc(r() * n, Math.round(r() * rows) * h, 2 + r() * 4, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(MAP / 3.2, MAP / 3.2); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    return t;
  }
  function buildGround(mask) {
    const mk = new THREE.CanvasTexture(mask.canvas); mk.minFilter = THREE.LinearFilter; mk.generateMipmaps = false;
    const mat = new THREE.MeshStandardMaterial({ map: cobbleTex(), roughness: 0.93, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mat.onBeforeCompile = sh => {
      sh.uniforms.maskMap = { value: mk }; sh.uniforms.dirtCol = { value: L('#9b7b52') };
      sh.vertexShader = 'varying vec2 vMk;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMk = uv;');
      sh.fragmentShader = 'uniform sampler2D maskMap; uniform vec3 dirtCol; varying vec2 vMk;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        `vec4 mk = texture2D(maskMap, vMk);
        float a = max(mk.r, mk.g); if (a < 0.5) discard;
        vec4 cb = mapTexelToLinear(texture2D(map, vUv));
        vec3 dirt = dirtCol * (0.72 + 0.55 * mk.b);
        float w = smoothstep(0.35, 0.65, mk.r / max(mk.r + mk.g, 0.001));
        diffuseColor.rgb *= mix(dirt, cb.rgb, w) * mix(1.0, 0.9 + 0.2 * mk.b, w);`);
    };
    mat.customProgramCacheKey = () => 'vil-ground';
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), mat); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.receiveShadow = true;
    V.scene.add(m); V.mats.push(mat); V.texs.push(mk, mat.map);
  }

  /* ---------- ruisseau ---------- */
  function buildCreek(D) {
    const C = D.creek; if (!C || C.length < 2) return;
    const hw = D.creekW / 2, pos = [], uv = [], idx = [];
    let acc = 0;
    for (let i = 0; i < C.length; i++) {
      const a = C[Math.max(0, i - 1)], b = C[Math.min(C.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      if (i) acc += Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]);
      pos.push(C[i][0] + nx * hw, 0.07, C[i][1] + nz * hw, C[i][0] - nx * hw, 0.07, C[i][1] - nz * hw); uv.push(acc / 5, 0, acc / 5, 1);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#2f6f9e'); gr.addColorStop(0.5, '#4aa0d8'); gr.addColorStop(1, '#2f6f9e'); x.fillStyle = gr; x.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(220,240,255,${0.15 + Math.random() * 0.35})`; x.fillRect(Math.random() * 256, 6 + Math.random() * 52, 10 + Math.random() * 40, 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; V.scene.add(m); V.creekTex = t; V.mats.push(mat); V.texs.push(t);
    // berges : galets et roseaux (instanciés)
    const rnd = BR.rngFrom ? BR.rngFrom(7) : Math.random, peb = [], reed = [];
    for (let i = 0; i < C.length - 1; i++) {
      const a = C[i], b = C[i + 1], L2 = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L2, nz = (b[0] - a[0]) / L2;
      for (let s = 0; s < L2; s += 0.75) {
        const px = a[0] + (b[0] - a[0]) * s / L2, pz = a[1] + (b[1] - a[1]) * s / L2;
        if (onBridge(D, px, pz, 0.8) !== null) continue;
        for (const side of [-1, 1]) {
          const o = hw + (rnd() - 0.3) * 0.5;
          peb.push([px + nx * side * o, pz + nz * side * o, 0.25 + rnd() * 0.35, rnd()]);
          if (rnd() < 0.18) for (let k = 0; k < 4; k++) reed.push([px + nx * side * (o + 0.3 + rnd() * 0.4) + (rnd() - 0.5) * 0.5, pz + nz * side * (o + 0.3) + (rnd() - 0.5) * 0.5, 0.6 + rnd() * 0.7]);
        }
      }
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cc = new THREE.Color();
    const pg = new THREE.IcosahedronGeometry(0.5, 0), pm = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    const PI = new THREE.InstancedMesh(pg, pm, peb.length);
    peb.forEach((p, i) => { e.set(p[3] * 3, p[3] * 9, 0); q.setFromEuler(e); m4.compose(new V3(p[0], 0.05, p[1]), q, new V3(p[2] * 1.3, p[2] * 0.7, p[2])); PI.setMatrixAt(i, m4); PI.setColorAt(i, cc.copy(L(['#9a9890', '#b0aca0', '#85827a', '#a8a090'][(p[3] * 4) | 0]))); });
    PI.castShadow = true; PI.receiveShadow = true; V.scene.add(PI);
    const rg = new THREE.ConeGeometry(0.06, 1, 4).translate(0, 0.5, 0), rm = new THREE.MeshStandardMaterial({ color: L('#5f8f36'), roughness: 0.9 });
    const RI = new THREE.InstancedMesh(rg, rm, Math.max(1, reed.length));
    reed.forEach((p, i) => { e.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3); q.setFromEuler(e); m4.compose(new V3(p[0], 0, p[1]), q, new V3(1, p[2], 1)); RI.setMatrixAt(i, m4); });
    RI.count = reed.length; V.scene.add(RI);
    V.mats.push(pm, rm);
  }

  /* ---------- fanions, drapeaux (toiles qui ondulent : famille « cloth ») ---------- */
  const FLAGC = ['#d8423a', '#f0c43a', '#3f7fc0', '#4f9a4a', '#f6f2ea', '#8a5ac0', '#f08a2a'];
  function buildBunting(MG, D) {
    D.bunting.forEach((B, bi) => {
      const a = new V3(B[0], B[1], B[2]), b = new V3(B[3], B[4], B[5]), len = a.distanceTo(b), sag = 0.35 + len * 0.05;
      const at = t => new V3().lerpVectors(a, b, t).add(new V3(0, -sag * 4 * t * (1 - t), 0));
      const dir = new V3().subVectors(b, a).setY(0).normalize(), side = new V3().crossVectors(dir, UP).normalize();
      // corde
      const N = Math.max(6, Math.round(len * 2)), rp = [], rn = [], ri = [];
      for (let i = 0; i <= N; i++) { const p = at(i / N); rp.push(p.x, p.y + 0.02, p.z, p.x, p.y - 0.02, p.z); rn.push(side.x, 0, side.z, side.x, 0, side.z); if (i) { const k = i * 2; ri.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
      MG.raw('cloth', new Float32Array(rp), new Float32Array(rn), L('#4a3a2a'), new Float32Array(rp.length / 3), new Uint16Array(ri));
      // fanions
      const nf = Math.floor(len / 0.55), pos = [], nrm = [], col = [], sw = [];
      for (let k = 0; k < nf; k++) {
        const t0 = (k + 0.15) / nf, t1 = (k + 0.85) / nf, p0 = at(t0), p1 = at(t1), tip = at((t0 + t1) / 2).add(new V3(0, -0.42, 0));
        const c = L(FLAGC[(k + bi * 3) % FLAGC.length]);
        [p0, p1, tip].forEach((p, i) => { pos.push(p.x, p.y, p.z); nrm.push(side.x, 0, side.z); col.push(c.r, c.g, c.b); sw.push(i === 2 ? 0.55 : 0.0); });
      }
      if (nf) MG.raw('cloth', new Float32Array(pos), new Float32Array(nrm), new Float32Array(col), new Float32Array(sw), null);
    });
  }
  function addPennant(MG, p, k) {
    const dir = new V3(Math.cos(0.6 + k), 0, Math.sin(0.6 + k)), side = new V3().crossVectors(dir, UP).normalize(), pos = [], nrm = [], sw = [], idx = [];
    const c = L(k % 2 ? '#d8423a' : '#3f7fc0');
    for (let i = 0; i <= 5; i++) {
      const t = i / 5, base = p.clone().addScaledVector(dir, t * 1.6);
      pos.push(base.x, base.y - 0.02 - 0.32 * t, base.z, base.x, base.y - 0.75 + 0.36 * t, base.z); nrm.push(side.x, 0, side.z, side.x, 0, side.z); sw.push(t, t);
      if (i) { const j = i * 2; idx.push(j - 2, j - 1, j, j - 1, j + 1, j); }
    }
    MG.raw('cloth', new Float32Array(pos), new Float32Array(nrm), c, new Float32Array(sw), new Uint16Array(idx));
  }

  /* ---------- lucioles / poussières dorées, halos des lanternes ---------- */
  function buildFlies(D, n) {
    const pos = [], ph = [], rnd = BR.rngFrom ? BR.rngFrom(3) : Math.random;
    for (let i = 0, t = 0; i < n && t < n * 20; t++) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 36, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (V.mask.at(x, z) > 80 || insideCol(x, z, V.grid, 0.3)) continue;
      pos.push(x, 0.4 + rnd() * 2.2, z); ph.push(rnd(), rnd(), rnd()); i++;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 3));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: V.uTime, uScale: { value: 600 }, uA: { value: 1 }, uCol: { value: L('#e8ff8a') } },
      vertexShader: `attribute vec3 aPh; uniform float uTime, uScale; varying float vA;
        void main(){ vec3 p = position + vec3(sin(uTime * 0.6 + aPh.x * 6.28) * 0.9, sin(uTime * 0.9 + aPh.y * 6.28) * 0.45, cos(uTime * 0.5 + aPh.z * 6.28) * 0.9);
          vA = smoothstep(0.25, 1.0, sin(uTime * (1.2 + aPh.y) + aPh.x * 30.0) * 0.5 + 0.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = 0.11 * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uA; uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(uCol * 2.0, (1.0 - d) * (1.0 - d) * vA * uA); }` });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 6; V.scene.add(pts); V.flies = mat; V.mats.push(mat);
  }
  function buildHalos(list) {
    if (!list.length) return;
    const pos = []; list.forEach(p => pos.push(p.x, p.y, p.z));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 600 }, uA: { value: 0.5 }, uCol: { value: L('#ffc870') } },
      vertexShader: 'uniform float uScale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 1.5 * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uA; uniform vec3 uCol; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(uCol, pow(1.0 - d, 2.2) * uA); }' });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 6; V.scene.add(pts); V.halos = mat; V.mats.push(mat);
  }

  /* ---------- poules ---------- */
  function buildChickens(D) {
    const C = D.chickens, g = BR.Assets.models.vil_chicken; if (!C || !g) return;
    const MG = Merger(); g.scene.updateMatrixWorld(true);
    g.scene.traverse(o => { if (o.isMesh) MG.mesh('std', o.geometry, o.matrixWorld, o.material.color.clone()); });
    const geo = MG.build().std; if (!geo) return;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), im = new THREE.InstancedMesh(geo, mat, C.n);
    im.castShadow = true; im.receiveShadow = true; V.scene.add(im); V.mats.push(mat);
    V.chickens = { im, C, list: [] };
    for (let i = 0; i < C.n; i++) { const a = Math.random() * 6.283, r = Math.random() * C.r * 0.8; V.chickens.list.push({ x: C.x + Math.cos(a) * r, z: C.z + Math.sin(a) * r, yaw: Math.random() * 6.283, tx: 0, tz: 0, t: Math.random() * 2, peck: 0, s: 0.9 + Math.random() * 0.25 }); }
  }
  const _cm4 = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cv = new V3(), _cs = new V3();
  function updateChickens(dt) {
    const H = V.chickens; if (!H) return;
    const m4 = _cm4, q = _cq, e = _ce;
    H.list.forEach((c, i) => {
      c.t -= dt;
      if (c.t <= 0) { if (Math.random() < 0.45) { c.peck = 1.2; c.t = 1.2; c.tx = c.x; c.tz = c.z; } else { const a = Math.random() * 6.283, r = Math.random() * H.C.r * 0.85; c.tx = H.C.x + Math.cos(a) * r; c.tz = H.C.z + Math.sin(a) * r; c.t = 2 + Math.random() * 3; } }
      const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
      let hop = 0;
      if (d > 0.1 && c.peck <= 0) { const sp = Math.min(d, dt * 0.9); c.x += dx / d * sp; c.z += dz / d * sp; c.yaw += BR.angDiff(c.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8); hop = Math.abs(Math.sin(V.t * 14 + i)) * 0.05; }
      // le joueur fait fuir les poules
      const px = c.x - V.pos.x, pz = c.z - V.pos.z, pd = Math.hypot(px, pz);
      if (pd < 1.6) { c.x += px / pd * dt * 2.5; c.z += pz / pd * dt * 2.5; const rr = Math.hypot(c.x - H.C.x, c.z - H.C.z); if (rr > H.C.r) { c.x = H.C.x + (c.x - H.C.x) / rr * H.C.r; c.z = H.C.z + (c.z - H.C.z) / rr * H.C.r; } }
      c.peck = Math.max(0, c.peck - dt);
      const pitch = c.peck > 0 ? Math.max(0, Math.sin(c.peck * 9)) * 0.55 : 0;
      e.set(pitch, c.yaw, 0, 'YXZ'); q.setFromEuler(e);
      m4.compose(_cv.set(c.x, hop, c.z), q, _cs.set(c.s, c.s, c.s)); H.im.setMatrixAt(i, m4);
    });
    H.im.instanceMatrix.needsUpdate = true;
  }

  /* ---------- habitants ---------- */
  function clipOf(names) { for (const n of names) { const c = BR.Assets.clip(n); if (c) return c; } return null; }
  function buildNPCs(D, q) {
    const list = q === 'low' ? D.npcs.filter(n => n.name || n.do === 'smith' || n.do === 'walk') : D.npcs;
    list.forEach((def, i) => {
      let av; try { av = BR.Avatar.build({ skin: def.skin }); } catch (e) { console.warn(e); return; }
      const p0 = def.p || def.path[0];
      av.group.position.set(p0[0], 0, p0[1]);
      if (def.look) av.group.rotation.y = Math.atan2(def.look[0] - p0[0], def.look[1] - p0[1]);
      av.group.traverse(m => { if (m.isMesh) { m.castShadow = true; if (def.tint) { const ms = Array.isArray(m.material) ? m.material : [m.material]; const nm = ms.map(x => { const c = x.clone(); c.color = L(def.tint); c.userData.own = true; return c; }); m.material = Array.isArray(m.material) ? nm : nm[0]; } } });
      V.scene.add(av.group);
      const N = { def, av, t: 2 + Math.random() * 5, wp: 1, wait: 0, speed: 0, custom: null, i };
      if (def.arms) av.weapon(def.arms);
      if (def.do === 'drink') { const w = av.weapon([]); const mug = w.find(n => /mug/i.test(n)); if (mug) av.weapon([mug]); }
      if (def.do === 'smith') { const hm = BR.Assets.models.vil_hammer; if (hm && av.handR) { const h = hm.scene.clone(true); h.scale.setScalar(1 / 0.78); h.traverse(o => { if (o.isMesh) o.castShadow = true; }); av.handR.add(h); } else av.weapon(['1H_Axe']); N.anvil = V.anvil; }
      if (def.do === 'sit' || def.do === 'fish') {
        const clip = av.mixer && clipOf(def.do === 'sit' ? ['Sit_Chair_Idle', 'Sit_Floor_Idle'] : ['Sit_Floor_Idle', 'Sit_Chair_Idle']);
        if (clip) { av.mixer.stopAllAction(); N.custom = av.mixer.clipAction(clip); N.custom.play(); }
      }
      if (def.do === 'fish') {
        const f = new V3(Math.sin(av.group.rotation.y), 0, Math.cos(av.group.rotation.y)), a = new V3(p0[0], 0.75, p0[1]).addScaledVector(f, 0.35), b = a.clone().addScaledVector(f, 2.2).add(new V3(0, 1.5, 0));
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.025, a.distanceTo(b), 5), new THREE.MeshStandardMaterial({ color: L('#7a5232') }));
        rod.position.copy(a).lerp(b, 0.5); rod.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); V.scene.add(rod);
        const bob = b.clone().addScaledVector(f, 0.6).setY(0.1);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([b, bob]), new THREE.LineBasicMaterial({ color: 0xe8e8e8 })); V.scene.add(line);
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: L('#e8453a') })); fl.position.copy(bob); V.scene.add(fl); N.bob = fl;
        V.mats.push(rod.material, line.material, fl.material);
      }
      if (def.name) {
        // le maître d'armes affiche la classe choisie
        const lines = [{ t: def.name, c: '#ffe9a8' }];
        if (def.cls) { let cl = null; try { cl = (Q.data().sel || {}).cls || null; } catch (e) { /* rien */ } lines.push({ t: cl ? 'Classe : ' + (CLS[cl] || cl) : 'Choisis ta classe', c: cl ? '#ffffff' : '#ffd76a' }); }
        const lb = label(lines, lines.length > 1 ? 3.2 : 2.6); lb.position.y = lines.length > 1 ? 2.75 : 2.55; av.group.add(lb); N.label = lb;
      }
      V.npcs.push(N);
    });
  }
  const _sph = new THREE.Sphere(), _pm = new THREE.Matrix4();
  function updateNPCs(dt) {
    const pp = V.pos;
    V.frustum = V.frustum || new THREE.Frustum(); V.cam.updateMatrixWorld(); V.frustum.setFromProjectionMatrix(_pm.multiplyMatrices(V.cam.projectionMatrix, V.cam.matrixWorldInverse));
    V.npcs.forEach(N => {
      const d = N.def, av = N.av, g = av.group, dist = Math.hypot(g.position.x - pp.x, g.position.z - pp.z);
      if (N.label) { N.label.visible = dist < 14; N.label.material.opacity = clamp((14 - dist) / 4, 0, 1); }
      // hors du champ de la caméra ou trop loin : ni dessin ni ombre (les personnages KayKit coûtent plusieurs appels de dessin)
      _sph.center.set(g.position.x, g.position.y + 1, g.position.z); _sph.radius = 1.6;
      g.visible = dist < 70 && V.frustum.intersectsSphere(_sph);
      const sh = dist < 20; if (N.sh !== sh) { N.sh = sh; g.traverse(m => { if (m.isMesh) m.castShadow = sh; }); }
      const far = dist > 40 && !N.custom;
      if (N.custom) { av.mixer.update(dt); if (N.bob) N.bob.position.y = 0.09 + Math.sin(V.t * 2.3 + N.i) * 0.025; return; }
      let speed = 0;
      if (d.do === 'walk') {
        if (N.wait > 0) N.wait -= dt;
        else {
          const tgt = d.path[N.wp], dx = tgt[0] - g.position.x, dz = tgt[1] - g.position.z, dd = Math.hypot(dx, dz);
          const block = dist < 1.3 && ((pp.x - g.position.x) * dx + (pp.z - g.position.z) * dz) > 0;
          if (block) { g.rotation.y += BR.angDiff(g.rotation.y, Math.atan2(pp.x - g.position.x, pp.z - g.position.z)) * Math.min(1, dt * 5); }
          else if (dd < 0.25) { N.wp = (N.wp + 1) % d.path.length; if (Math.random() < 0.3) N.wait = 1 + Math.random() * 2.5; }
          else { speed = 1.55; const s = Math.min(dd, speed * dt); g.position.x += dx / dd * s; g.position.z += dz / dd * s; g.rotation.y += BR.angDiff(g.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 6); }
        }
        g.position.y = heightAt(g.position.x, g.position.z);
      } else {
        N.t -= dt;
        if (N.t <= 0) {
          if (d.do === 'smith') { const k = av.act('1H_Melee_Attack_Chop', { speed: 0.9 }) || av.act('2H_Melee_Attack_Chop', { speed: 0.9 }) || av.act('Unarmed_Melee_Attack_Punch_A'); N.t = Math.max(1.5, k + 0.25); N.hit = 0.42; }
          else if (d.do === 'shop') { av.act(Math.random() < 0.6 ? 'Interact' : 'PickUp'); N.t = 5 + Math.random() * 5; }
          else if (d.do === 'sage') { av.act('Spellcast_Raise'); N.t = 6 + Math.random() * 5; N.cast = 1.2; }
          else if (d.do === 'crier') { av.act(Math.random() < 0.5 ? 'Cheer' : 'Interact'); N.t = 4 + Math.random() * 4; }
          else if (d.do === 'talk') { av.act(Math.random() < 0.7 ? 'Interact' : 'Cheer'); N.t = 3 + Math.random() * 5; }
          else if (d.do === 'drill') { const k = av.act(BR.pick(['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Slice'])) || av.act('1H_Melee_Attack_Chop'); N.t = Math.max(1.6, k) + 0.8 + Math.random() * 1.8; }
          else if (d.do === 'arts') { av.act(Math.random() < 0.6 ? 'Spellcast_Raise' : 'Interact'); N.t = 5 + Math.random() * 4; N.cast = 1.2; N.castCol = 0x6ae0ff; }
          else if (d.do === 'drink') { av.act(Math.random() < 0.5 ? 'Use_Item' : 'Cheer'); N.t = 5 + Math.random() * 5; }
          else N.t = 1e9;
        }
        if (N.hit != null) { N.hit -= dt; if (N.hit <= 0) { N.hit = null; const A = N.anvil || g.position; if (dist < 30) { V.fx.burst(A.clone ? A.clone() : new V3(A.x, 1, A.z), { n: 12, color: 0xffb040, speed: 4, life: 0.5, size: 0.12, grav: 12, up: 1.5 }); if (dist < 16) Au.fx('parry', { g: 0.25 * (1 - dist / 16) }); } } }
        if (N.cast != null) { N.cast -= dt; if (Math.random() < dt * 30) V.fx.spark(g.position.clone().add(new V3((Math.random() - 0.5) * 0.8, 2.2 + Math.random(), (Math.random() - 0.5) * 0.8)), new V3(0, 1.2, 0), { color: N.castCol || 0xb98cff, life: 0.8, size: 0.14 }); if (N.cast <= 0) N.cast = null; }
        // il se tourne vers le joueur quand on s'approche (sauf le forgeron, occupé)
        if (d.look && d.do !== 'smith') { const tgt = dist < 4 ? Math.atan2(pp.x - g.position.x, pp.z - g.position.z) : Math.atan2(d.look[0] - g.position.x, d.look[1] - g.position.z); g.rotation.y += BR.angDiff(g.rotation.y, tgt) * Math.min(1, dt * 3); }
      }
      // au loin : animation une image sur trois (le temps est cumulé)
      N.acc = (N.acc || 0) + dt; N.skip = (N.skip || 0) + 1;
      if (far && N.skip % 3) return;
      av.update(N.acc, speed, {}); N.acc = 0;
    });
  }

  /* ---------- démarrage ---------- */
  VG.start = function (root) {
    VG.stop();
    const q = (BR.settings && BR.settings.quality) || 'high';
    const canvas = BR.el('canvas', { class: 'vil-gl' }); root.prepend(canvas);
    const R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(q === 'low' ? 1 : 1.5, devicePixelRatio || 1)); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.outputEncoding = THREE.LinearEncoding;
    R.shadowMap.enabled = q !== 'low'; R.shadowMap.type = THREE.PCFSoftShadowMap; R.info.autoReset = false;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 900); scene.userData.cam = cam;
    const hudFx = BR.el('div', { class: 'vil-fx' }); root.appendChild(hudFx);
    const fx = BR.AFX.create(scene, cam, hudFx);
    let post = null; try { post = BR.AFX.post(R, scene, cam, q === 'low' ? 'low' : 'high'); } catch (e) { R.outputEncoding = THREE.sRGBEncoding; }
    const D = (window.GAME_ASSETS && window.GAME_ASSETS.village) || FALLBACK;
    V = { root, canvas, R, scene, cam, fx, post, D, q, t: 0, keys: {}, yaw: 0, pitch: 0.32, dist: 7.5, drag: null, spots: [], npcs: [], lights: [], smoke: [], fires: [], souls: [], arcane: [], spouts: [],
      mats: [], texs: [], winMats: [], palMats: [], uTime: { value: 0 }, near: null, busy: false, last: performance.now() };
    const T0 = performance.now(); V.tm = {};
    V.grid = colGrid(D.cols, 0.5);
    V.mask = paveMask(D); V.tm.mask = performance.now() - T0;
    // le décor de la prairie (ciel, collines, herbe, fleurs, moutons…) sans rien sur les rues, les maisons ni le ruisseau
    const exclude = (x, z) => {
      const r = Math.hypot(x, z);
      if (Math.abs(r - 36.4) < 0.35) return true;                    // l'ancienne clôture de la prairie
      if (D.tree && Math.hypot(x - D.tree.T[0], z - D.tree.T[1]) < 15) return true;   // l'Arbre-Monde
      if (r < 50 && V.mask.at(x, z) > 50) return true;
      if (r < 60 && insideCol(x, z, V.grid, 0.35)) return true;
      if (r < 60 && D.creek.length && creekNear(D, x, z)[0] < D.creekW / 2 + 0.35) return true;
      return false;
    };
    const env = BR.ArenaScene.build(scene, 'prairie', q, { exclude });
    V.env = env; V.tm.env = performance.now() - T0;
    build(); V.tm.build = performance.now() - T0;
    applyPreset(presetNow());
    // le joueur
    const av = BR.Avatar.build(Acc.p.look || { skin: 'survivor' }); av.group.traverse(m => { if (m.isMesh) m.castShadow = true; });
    scene.add(av.group); av.group.position.set(D.spawn[0], 0, D.spawn[1]); V.av = av; V.pos = av.group.position; V.vel = new V3(); V.vy = 0;
    V.yaw = V.face = av.group.rotation.y = Math.atan2(V.portalPos.x - D.spawn[0], V.portalPos.z - D.spawn[1]);   // face au portail
    V.pops = []; V.arrive = 0.9;
    try { BR.AscFX.petals(scene).gather(V.pos.clone(), 2.1, 0.5, ['#ffffff', '#ffe9a8', '#ffd76a'], 70, 0.9); popIn(av.group); } catch (e) { console.warn('village petals', e); V.arrive = 0; }
    V.grounded = true; V.airJumps = 1;
    // un champ de texte d'un autre écran ne doit pas garder le clavier
    try { const ae = document.activeElement; if (ae && ae !== document.body && ae.blur) ae.blur(); } catch (e) { /* rien */ }
    bind();
    // retour de l'écran des cartes : on file droit dans le portail
    if (BR.Asc && BR.Asc._goMap) { const id = BR.Asc._goMap; BR.Asc._goMap = null; setTimeout(() => { if (V) { V.mapGo = id; act('portal'); } }, 900); }
    { const b = document.createElement('button'); b.className = 'btn small ghost vil-stuck'; b.textContent = 'Bloqué ?'; b.title = 'Te remet sur la place du village et affiche un diagnostic';
      b.style.cssText = 'position:absolute;left:18px;bottom:18px;z-index:6;opacity:0.85';
      b.onclick = () => { unstuck(); b.blur(); }; root.appendChild(b); V.stuckBtn = b; }
    try { netInit(); } catch (e) { console.warn('village net', e); }
    V.raf = requestAnimationFrame(loop);
    Au.track('music', 'arene_menu', 0.55);
  };
  VG.stop = function () {
    if (!V) return;
    cancelAnimationFrame(V.raf); unbind();
    try { (V.netOff || []).forEach(off => off()); if (BR.VNet) BR.VNet.leave(); } catch (e) { console.warn(e); }
    if (V.remote) [...V.remote.keys()].forEach(id => removeRemote(id, false));
    [V.pkHud, V.countEl, V.logEl, V.chatEl].forEach(el => { if (el) el.remove(); });
    if (V.mgCache) Object.values(V.mgCache).forEach(gs => Object.values(gs).forEach(g => g.dispose()));
    try { V.env.dispose(); V.fx.dispose(); if (V.post) V.post.dispose(); if (V.scene.userData.petals) V.scene.userData.petals.dispose(); } catch (e) { console.warn(e); }
    V.npcs.forEach(N => { try { N.av.dispose(); } catch (e) { /* rien */ } });
    try { V.av.dispose(); } catch (e) { /* rien */ }
    V.scene.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); if (o.isSprite && o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    V.mats.forEach(m => m.dispose()); V.texs.forEach(t => t.dispose());
    if (V.map) V.map.remove();
    V.R.dispose(); V.canvas.remove();
    V = null;
  };
  VG.active = () => !!V;
  VG._v = () => V;   // outil de test
  // outil de test : depuis (x, y, z), avance n pas de physique dans la direction (dx, dz) ; renvoie la distance parcourue
  VG._probe = (x, y, z, dx, dz, n) => {
    if (!V) return null;
    const P = V.pos, s = { x: P.x, y: P.y, z: P.z, vx: V.vel.x, vz: V.vel.z, vy: V.vy, g: V.grounded, gs: V.groundS };
    P.set(x, y, z); V.vy = 0; V.grounded = true; V.groundS = null;
    for (let i = 0; i < (n || 20); i++) { V.vel.set(dx * 6.2, 0, dz * 6.2); physics(1 / 60); }
    const d = Math.hypot(P.x - x, P.z - z), out = [P.x, P.y, P.z];
    P.set(s.x, s.y, s.z); V.vel.x = s.vx; V.vel.z = s.vz; V.vy = s.vy; V.grounded = s.g; V.groundS = s.gs;
    return { d, out };
  };
  VG.preset = name => { if (V && PRESETS[name]) applyPreset(name); };   // outil de test : 'day' / 'night'

  function build() {
    const S = V.scene, D = V.D, MG = Merger();
    const all = [];
    // le décor
    D.props.forEach(p => { const inst = place(MG, p[0], p[1], p[2], p[3], p[4], p[5], p[6]); if (inst) all.push(inst); });
    // les lieux d'interaction sont dans props (layout) ; en secours, on les pose ici
    if (D === FALLBACK) Object.keys(D.spots).forEach(id => { const m = D.spots[id].m, inst = place(MG, m[0], m[1], m[2], m[3], 1); if (inst) all.push(inst); });
    buildBunting(MG, D);
    // repères des modèles : fumées, feux, lanternes, jets d'eau, drapeaux…
    const lamps = [];
    all.forEach(inst => inst.empties.forEach((e, k) => {
      if (e.n === 'smoke') V.smoke.push(e.p);
      else if (e.n === 'fire') V.fires.push({ p: e.p, inst: inst.name });
      else if (e.n === 'lamp') lamps.push(e.p);
      else if (e.n === 'spout') V.spouts.push(e.p);
      else if (e.n === 'flag') addPennant(MG, e.p, k + all.indexOf(inst));
      else if (e.n === 'soul' || e.n === 'soulfire') V.souls.push(e.p);
      else if (e.n === 'arcane') V.arcane.push(e.p);
      else if (e.n === 'anvil') V.anvil = e.p;
      else if (e.n === 'light' && inst.name === 'temple') V.templeLight = e.p;
    }));
    V.geos = MG.build(); V.meshes = meshesOf(V.geos, null);
    // pièces animées
    all.forEach(inst => {
      if (inst.dyn.dyn_wheel) V.wheel = inst.dyn.dyn_wheel;
      if (inst.dyn.dyn_blades) V.blades = inst.dyn.dyn_blades;
      if (inst.dyn.dyn_crystal) { V.crystal = inst.dyn.dyn_crystal; V.crystalY = V.crystal.position.y; }
      if (inst.dyn.dyn_bell) V.bell = inst.dyn.dyn_bell;
    });
    buildGround(V.mask);
    buildCreek(D);
    buildChickens(D);
    buildHalos(lamps);
    if (V.q !== 'low') buildFlies(D, 160);
    // lumières (peu nombreuses : le reste brille par les matériaux et le flou lumineux)
    const light = (p, col, k, dist, kind) => { const l = new THREE.PointLight(L(col), k, dist, 2); l.position.copy(p); S.add(l); V.lights.push({ l, k, kind }); return l; };
    const sp = D.spots, fo = D.props.find(p => p[0] === 'fountain'); if (fo) { V.fountainX = fo[1]; V.fountainZ = fo[2]; }
    const pm = sp.portal.m; V.portalPos = new V3(pm[1], 0, pm[2]); V.portalRot = pm[3];
    light(new V3(pm[1], 4.2, pm[2]).add(new V3(Math.sin(pm[3] * DEG), 0, Math.cos(pm[3] * DEG)).multiplyScalar(1.6)), '#ffd76a', 2.6, 18, 'portal');
    const forge = V.fires.find(f => f.inst === 'forge'); if (forge) light(forge.p.clone().add(new V3(0, 0.6, 0)), '#ff8a3a', 2.2, 11, 'fire');
    if (V.templeLight) light(V.templeLight, '#b98cff', 2.0, 12, 'soul');
    if (V.q !== 'low') {
      lamps.slice().sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).filter(p => Math.hypot(p.x, p.z) < 17.5).slice(0, 4).forEach(p => light(p, '#ffc77a', 1.0, 9, 'lamp'));
      const tav = lamps.filter(p => p.z < -10 && p.z > -13 && p.x < -3).slice(0, 1); tav.forEach(p => light(p, '#ffc77a', 1.0, 9, 'lamp'));
    }
    // portail : tourbillon (forme de l'ouverture : 4,6 m de large, 4,6 m droit + demi-cercle)
    const pg = new THREE.Group(); pg.position.copy(V.portalPos); pg.rotation.y = pm[3] * DEG; S.add(pg);
    const VU = { uTime: V.uTime, uCol: { value: new THREE.Color('#ffd76a') } };
    const vx = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 6.9), new THREE.ShaderMaterial({ uniforms: VU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
        void main(){ vec2 q = vec2((vUv.x - 0.5) * 4.6, vUv.y * 6.9);
          float inA = step(q.y, 4.6) * step(abs(q.x), 2.28); float inT = step(length(q - vec2(0.0, 4.6)), 2.28); if (max(inA, inT) < 0.5) discard;
          vec2 p = (q - vec2(0.0, 3.5)) / 3.2; float r = length(p), a = atan(p.y, p.x);
          float sw = sin(a * 5.0 + r * 9.0 - uTime * 3.0) * 0.5 + 0.5; float core = smoothstep(1.2, 0.0, r);
          gl_FragColor = vec4(mix(uCol * 0.3, uCol * 1.9, sw * 0.6 + core * 0.6) + vec3(1.0) * pow(core, 3.0) * 0.7, 0.93); }` }));
    vx.position.y = 0.6 + 3.45; pg.add(vx); V.mats.push(vx.material);
    // personnages et étiquettes des lieux
    buildNPCs(D, V.q);
    Object.keys(META).forEach(id => {
      const s = sp[id]; if (!s) return; const me = META[id];
      const lb = label([{ t: me.n, c: me.col }, { t: me.s, c: '#ffffff' }], id === 'portal' ? 6 : 4.4);
      const onModel = id === 'portal' || id === 'obelisk' || id === 'sign', lp = onModel ? [s.m[1], s.m[2]] : s.p;
      lb.position.set(lp[0], s.h, lp[1]);
      S.add(lb);
      V.spots.push(Object.assign({ id, p: s.p, r: s.r, h: s.h, mp: [s.m[1], s.m[2]], lp, label: lb }, me));
    });
    paintObelisk();
    // collisions : bâtiments, objets, habitants immobiles
    V.cols = D.cols.slice();
    V.npcs.forEach(N => { if (N.def.do !== 'walk') V.cols.push(['c', N.av.group.position.x, N.av.group.position.z, 0.35]); });
    V.camCols = D.cols.filter(c => (c[0] === 'c' ? c[3] >= 1 : c[3] * c[4] >= 1.2));
    buildTree();
    buildMap();
  }
  function paintObelisk() {
    const sp = V.spots.find(s => s.id === 'obelisk'); if (!sp) return;
    const D = Q.data(), p = Q.selPal();
    V.scene.remove(sp.label); sp.label.material.map.dispose(); sp.label.material.dispose();
    sp.label = label([{ t: Q.PALIERS[p].n, c: Q.palCol(p) }, { t: 'record : ' + (D.best[p] || 0) + '/' + Q.FLOORS + ' · E pour changer', c: '#ffffff' }], 4.6); sp.label.position.set(sp.lp[0], sp.h, sp.lp[1]); V.scene.add(sp.label);
    V.palMats.forEach(m => m.color.copy(L(Q.palCol(p))).multiplyScalar(2.2));
  }
  function applyPreset(name) {
    const P = PRESETS[name], env = V.env; V.preset = name; V.P = P;
    const dir = new V3().fromArray(P.dir).normalize();
    env.group.traverse(o => {
      const u = o.material && o.material.uniforms;
      if (u && u.sunDir && u.top) { u.top.value.copy(L(P.top)); u.mid.value.copy(L(P.mid)); u.hor.value.copy(L(P.hor)); u.sunCol.value.copy(L(P.sun)); u.cloudCol.value.copy(L(P.cloud)); u.sunDir.value.copy(dir); u.sunSize.value = P.size; u.sunGlow.value = P.glow; u.cloudAmt.value = P.clouds; u.stars.value = P.stars; }
      if (o.isHemisphereLight) { o.color.copy(L(P.hemi[0])); o.groundColor.copy(L(P.hemi[1])); o.intensity = P.hemi[2]; }
      if (o.isAmbientLight) o.intensity = P.amb;
    });
    V.sunDir = dir.clone(); V.kx = null;
    if (env.key) { env.key.color.copy(L(P.key[0])); env.key.intensity = P.key[1]; env.key.position.copy(dir).multiplyScalar(90); env.key.target.position.set(0, 0, 0); env.key.target.updateMatrixWorld(); }
    V.scene.background = L(P.fog[0]); if (V.scene.fog) { V.scene.fog.color.copy(L(P.fog[0])); V.scene.fog.density = P.fog[1]; }
    V.R.toneMappingExposure = P.exp;
    V.winMats.forEach(m => m.color.setScalar(P.win));
    if (V.halos) V.halos.uniforms.uA.value = 0.28 * P.lamp;
    if (V.flies) { V.flies.uniforms.uA.value = P.flies; V.flies.uniforms.uCol.value.copy(L(name === 'night' ? '#d8ff7a' : '#ffe6a0')); }
  }

  /* ---------- mini-carte (en haut à droite) : rues, maisons, ruisseau, lieux, joueur ; clic sur un lieu = on y va ---------- */
  const MAPPX = 190, MAPR = 47, MAPK = (MAPPX / 2 - 4) / MAPR;     // pixels par mètre
  const SHORT = { pkup: 'Arbre-Monde', portal: 'Portail', board: 'Entre amis', stall: 'Tailleur', wheel: 'Âmes', obelisk: 'Paliers', sign: 'Sortie', armory: 'Armes', tree: 'Arts' };
  const LBLSIDE = { obelisk: 'r', portal: 'l', wheel: 't', sign: 'r', pkup: 'r' };   // côté du nom (b : dessous par défaut)
  // la carte est « nord en haut » ; vu du nord, l'est (+x) est à gauche, comme à l'écran quand on regarde vers le nord
  const mxy = (x, z) => [MAPPX / 2 - x * MAPK, MAPPX / 2 - z * MAPK];
  const GLYPH = {
    portal: g => { g.moveTo(-4, 4.5); g.lineTo(-4, -0.5); g.arc(0, -0.5, 4, Math.PI, 0); g.lineTo(4, 4.5); },
    board: g => { g.rect(-4.5, -4, 9, 7); g.moveTo(-2.5, -1.5); g.lineTo(2.5, -1.5); g.moveTo(-2.5, 1); g.lineTo(1.5, 1); },
    stall: g => { g.moveTo(-5, -1.5); g.lineTo(-2, -4); g.lineTo(2, -4); g.lineTo(5, -1.5); g.lineTo(3, 0.5); g.lineTo(3, 4.5); g.lineTo(-3, 4.5); g.lineTo(-3, 0.5); g.closePath(); },
    wheel: g => { g.moveTo(4.5, 0); g.arc(0, 0, 4.5, 0, Math.PI * 2); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; g.moveTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5); g.lineTo(-Math.cos(a) * 4.5, -Math.sin(a) * 4.5); } },
    obelisk: g => { g.moveTo(0, -5.5); g.lineTo(2.6, -3); g.lineTo(2.2, 4.5); g.lineTo(-2.2, 4.5); g.lineTo(-2.6, -3); g.closePath(); },
    sign: g => { g.moveTo(-4.5, 0); g.lineTo(4, 0); g.moveTo(1, -3); g.lineTo(4.5, 0); g.lineTo(1, 3); },
    armory: g => { g.moveTo(-4.5, 4.5); g.lineTo(4.5, -4.5); g.moveTo(4.5, 4.5); g.lineTo(-4.5, -4.5); g.moveTo(-4.5, 1.5); g.lineTo(-1.5, 4.5); g.moveTo(4.5, 1.5); g.lineTo(1.5, 4.5); },
    pkup: g => { g.moveTo(3.6, -2); g.arc(0, -2, 3.6, 0, Math.PI * 2); g.moveTo(0, 1.6); g.lineTo(0, 5.2); g.moveTo(-2.4, 5.2); g.lineTo(0, 3.6); g.lineTo(2.4, 5.2); },
    tree: g => { g.moveTo(3.2, -1.5); g.arc(0, -1.5, 3.2, 0, Math.PI * 2); g.moveTo(0, 1.7); g.lineTo(0, 5); g.moveTo(-2, 5); g.lineTo(2, 5); },
  };
  function buildMap() {
    const D = V.D, dpr = Math.min(2, devicePixelRatio || 1), N = Math.round(MAPPX * dpr);
    const cv = document.createElement('canvas'); cv.width = cv.height = N; cv.className = 'vil-map';
    cv.style.cssText = `position:absolute;top:76px;right:18px;width:${MAPPX}px;height:${MAPPX}px;border-radius:50%;cursor:pointer;z-index:3;box-shadow:0 6px 24px rgba(0,0,0,.55),0 0 0 2px rgba(255,215,106,.55),inset 0 0 0 1px rgba(0,0,0,.6);`;
    cv.title = 'Clique sur un lieu pour t\'y rendre';
    V.root.appendChild(cv); V.map = cv; V.mapDpr = dpr;
    // fond fixe
    const bg = document.createElement('canvas'); bg.width = bg.height = N; const g = bg.getContext('2d'); g.scale(dpr, dpr);
    const C = MAPPX / 2;
    g.save(); g.beginPath(); g.arc(C, C, C, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#16130e'; g.fillRect(0, 0, MAPPX, MAPPX);
    g.fillStyle = '#26331e'; g.beginPath(); g.arc(C, C, D.wall * MAPK, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a5040'; g.strokeStyle = '#5a5040';
    D.rects.forEach(([k, x0, z0, x1, z1]) => { const a = mxy(x0, z0), b = mxy(x1, z1); g.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); });
    D.discs.forEach(([k, x, z, r]) => { const a = mxy(x, z); g.beginPath(); g.arc(a[0], a[1], r * MAPK, 0, Math.PI * 2); g.fill(); });
    g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#4a3d2a';
    D.paths.forEach(([k, w, pts]) => { g.lineWidth = w * MAPK; g.beginPath(); pts.forEach((p, i) => { const a = mxy(p[0], p[1]); if (i) g.lineTo(a[0], a[1]); else g.moveTo(a[0], a[1]); }); g.stroke(); });
    if (D.creek.length) { g.strokeStyle = '#3d86c4'; g.lineWidth = D.creekW * MAPK; g.beginPath(); D.creek.forEach((p, i) => { const a = mxy(p[0], p[1]); if (i) g.lineTo(a[0], a[1]); else g.moveTo(a[0], a[1]); }); g.stroke(); }
    // bâtiments (emprises au sol)
    D.cols.forEach(c => {
      if (Math.hypot(c[1], c[2]) > D.wall - 1.2) return;
      const a = mxy(c[1], c[2]);
      g.fillStyle = '#b39468'; g.strokeStyle = '#2a2118'; g.lineWidth = 1;
      if (c[0] === 'c') { if (c[3] < 0.9) return; g.beginPath(); g.arc(a[0], a[1], c[3] * MAPK, 0, Math.PI * 2); g.fill(); g.stroke(); return; }
      if (c[3] * c[4] < 0.9) return;
      g.save(); g.translate(a[0], a[1]); g.rotate(c[5]); g.fillRect(-c[3] * MAPK, -c[4] * MAPK, c[3] * 2 * MAPK, c[4] * 2 * MAPK); g.strokeRect(-c[3] * MAPK, -c[4] * MAPK, c[3] * 2 * MAPK, c[4] * 2 * MAPK); g.restore();
    });
    // palissade et porte
    g.strokeStyle = '#8a6438'; g.lineWidth = 2.5; g.setLineDash([3, 2]); g.beginPath(); g.arc(C, C, D.wall * MAPK, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    if (D.tree) {   // l'Arbre-Monde : canopée, plateau de racines, tronc
      const t = mxy(D.tree.T[0], D.tree.T[1]);
      g.fillStyle = 'rgba(80,150,60,0.28)'; g.beginPath(); g.arc(t[0], t[1], 22 * MAPK, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a5a2c'; g.beginPath(); g.arc(t[0], t[1], D.tree.rp * MAPK, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6e4a30'; g.strokeStyle = '#2a1a10'; g.lineWidth = 1.2; g.beginPath(); g.arc(t[0], t[1], 6.2 * MAPK, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.restore();
    g.font = '700 10px Oswald, Arial Narrow, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd76a'; g.fillText('N', C, 11);
    V.mapBg = bg;
    // lieux : position du bâtiment
    V.mapSpots = V.spots.filter(s => !s.noMap).concat(V.pkSpot ? [V.pkSpot] : []).map(s => { const a = mxy(s.mp[0], s.mp[1]); return { s, x: a[0], y: a[1] }; });
    cv.addEventListener('mousedown', e => e.stopPropagation());
    cv.addEventListener('click', e => {
      if (!V) return;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * MAPPX / r.width, y = (e.clientY - r.top) * MAPPX / r.height;
      let best = null, bd = 16; V.mapSpots.forEach(m => { const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m.s; } });
      if (best) { Au.ui('click'); goTo(best); }
    });
  }
  function drawMap() {
    const cv = V.map, g = cv.getContext('2d'), dpr = V.mapDpr, C = MAPPX / 2;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(V.mapBg, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.save(); g.beginPath(); g.arc(C, C, C - 1, 0, Math.PI * 2); g.clip();
    // trajet de la marche automatique
    if (V.auto) { g.strokeStyle = 'rgba(255,215,106,0.85)'; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); let a = mxy(V.pos.x, V.pos.z); g.moveTo(a[0], a[1]); for (let i = V.auto.i; i < V.auto.pts.length; i++) { a = mxy(V.auto.pts[i][0], V.auto.pts[i][1]); g.lineTo(a[0], a[1]); } g.stroke(); g.setLineDash([]); }
    // habitants
    g.fillStyle = 'rgba(240,230,200,0.75)';
    V.npcs.forEach(N => { const a = mxy(N.av.group.position.x, N.av.group.position.z); g.beginPath(); g.arc(a[0], a[1], 1.6, 0, Math.PI * 2); g.fill(); });
    // les autres joueurs
    if (V.remote) V.remote.forEach(R => { const a = mxy(R.av.group.position.x, R.av.group.position.z); g.beginPath(); g.arc(a[0], a[1], 2.8, 0, Math.PI * 2); g.fillStyle = '#6ae0ff'; g.fill(); g.lineWidth = 1; g.strokeStyle = '#0a1a24'; g.stroke(); });
    // lieux : pastille + pictogramme + nom
    g.font = '700 10px Oswald, Arial Narrow, sans-serif'; g.textBaseline = 'middle';
    V.mapSpots.forEach(m => {
      const near = V.near === m.s;
      g.beginPath(); g.arc(m.x, m.y, near ? 9.5 : 8, 0, Math.PI * 2); g.fillStyle = m.s.col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = near ? '#ffffff' : '#1a140c'; g.stroke();
      g.save(); g.translate(m.x, m.y); g.beginPath(); (GLYPH[m.s.id] || GLYPH.sign)(g); g.strokeStyle = '#1a140c'; g.lineWidth = 1.7; g.lineCap = g.lineJoin = 'round'; g.stroke(); g.restore();
      const t = SHORT[m.s.id] || m.s.n, side = LBLSIDE[m.s.id] || 'b';
      let tx = m.x, ty = m.y + 15; g.textAlign = 'center';
      if (side === 'r') { tx = m.x + 12; ty = m.y; g.textAlign = 'left'; }
      else if (side === 'l') { tx = m.x - 12; ty = m.y; g.textAlign = 'right'; }
      else if (side === 't') ty = m.y - 15;
      const w = g.measureText(t).width;
      if (g.textAlign === 'center') tx = clamp(tx, w / 2 + 6, MAPPX - w / 2 - 6);
      g.lineWidth = 3; g.strokeStyle = 'rgba(10,8,5,0.9)'; g.strokeText(t, tx, ty); g.fillStyle = '#f6e7bd'; g.fillText(t, tx, ty);
    });
    // le joueur : flèche dans la direction de la caméra
    const p = mxy(V.pos.x, V.pos.z), dx = -Math.sin(V.yaw), dy = -Math.cos(V.yaw), ang = Math.atan2(dy, dx);
    g.save(); g.translate(p[0], p[1]); g.rotate(ang);
    g.fillStyle = 'rgba(255,215,106,0.18)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 26, -0.5, 0.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, -5.5); g.lineTo(-2.5, 0); g.lineTo(-5, 5.5); g.closePath(); g.fillStyle = '#ffd76a'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#1a140c'; g.stroke();
    g.restore(); g.restore();
    g.beginPath(); g.arc(C, C, C - 1, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = 'rgba(255,215,106,0.7)'; g.stroke();
  }
  // marche automatique : plus court chemin sur le petit réseau de rues (layout NAV), puis droit vers le lieu
  function goTo(spot) {
    const nav = V.D.nav, P = V.pos; let pts = [spot.p];
    if (nav && nav.nodes[spot.id]) {
      const nodes = nav.nodes, adj = {}; Object.keys(nodes).forEach(k => adj[k] = []);
      nav.edges.forEach(([a, b]) => { const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]); adj[a].push([b, d]); adj[b].push([a, d]); });
      let start = null, sd = 1e9; Object.keys(nodes).forEach(k => { const d = Math.hypot(nodes[k][0] - P.x, nodes[k][1] - P.z); if (d < sd) { sd = d; start = k; } });
      const dist = {}, prev = {}, todo = new Set(Object.keys(nodes)); Object.keys(nodes).forEach(k => dist[k] = 1e9); dist[start] = 0;
      while (todo.size) { let u = null; todo.forEach(k => { if (u === null || dist[k] < dist[u]) u = k; }); todo.delete(u); if (u === spot.id) break; adj[u].forEach(([v, d]) => { if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; } }); }
      const route = []; for (let k = spot.id; k; k = prev[k]) route.unshift(nodes[k]);
      if (route.length) { pts = route.concat([spot.p]); if (route.length > 1 && Math.hypot(route[1][0] - P.x, route[1][1] - P.z) < Math.hypot(route[1][0] - route[0][0], route[1][1] - route[0][1])) pts.shift(); }
    }
    V.auto = { pts, i: 0, spot, stuck: 0, last: P.clone() };
  }
  function autoWalk(dt, mv) {
    const A = V.auto, w = A.pts[A.i], dx = w[0] - V.pos.x, dz = w[1] - V.pos.z, d = Math.hypot(dx, dz), last = A.i === A.pts.length - 1;
    if (d < (last ? Math.max(0.6, A.spot.r * 0.45) : 0.9)) { A.i++; if (A.i >= A.pts.length) { V.auto = null; return; } return; }
    mv.set(dx / d, 0, dz / d);
    if (!V.drag) V.yaw += BR.angDiff(V.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 2.2);
    // bloqué (un passant, un objet) : on passe au point suivant, puis on abandonne
    A.stuck += dt; if (A.stuck > 1.2) { if (A.last.distanceTo(V.pos) < 0.6) { if (last) { V.auto = null; return; } A.i++; } A.stuck = 0; A.last.copy(V.pos); }
  }

  /* ---------- relief de la prairie hors du village (même formule que biomes.js) ---------- */
  const terrainH = (() => {
    const hash2 = (x, z, s) => { let n = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(s, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
    const noise2 = (x, z, s) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
      const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    const fbm2 = (x, z, s) => noise2(x, z, s) * 0.55 + noise2(x * 2.1, z * 2.1, s + 7) * 0.3 + noise2(x * 4.3, z * 4.3, s + 13) * 0.15;
    const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    let seed = 0; for (const ch of 'prairie') seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; const s0 = seed % 997;
    return (x, z) => {
      const R = (BR.ArenaScene && BR.ArenaScene.R) || 34, B = BR.ArenaScene && BR.ArenaScene.BIOMES, amp = (B && B.prairie && B.prairie.ground.amp) || 16, r = Math.hypot(x, z);
      if (r < R + 4) return 0;
      const t = sstep(R + 4, R + 48, r); return t * t * amp * (0.35 + fbm2(x * 0.03, z * 0.03, s0)) + sstep(110, 190, r) * amp * 2.2 * fbm2(x * 0.012, z * 0.012, s0 + 3);
    };
  })();
  // sol « de base » (sans les solides de l'arbre) : pont, estrade du portail, prairie
  const groundBase = (x, z) => Math.max(heightAt(x, z), terrainH(x, z));

  /* ---------- solides de l'Arbre-Monde (cylindres, boîtes, rampes) ---------- */
  const flOf = s => (s[0] === 'c' ? s[6] : s[0] === 'b' ? s[8] : s[9]) || {};
  function solidTop(s, x, z, m) {
    if (s[0] === 'c') return Math.hypot(x - s[1], z - s[2]) <= s[3] + m ? s[5] : null;
    const a = s[5], dx = x - s[1], dz = z - s[2], lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
    if (Math.abs(lx) > s[3] + m || Math.abs(lz) > s[4] + m) return null;
    if (s[0] === 'b') return s[7];
    return s[6] + (s[7] - s[6]) * clamp((lz + s[4]) / (2 * s[4]), 0, 1);
  }
  const solidBottom = (s, top) => (s[0] === 'c' ? s[4] : s[0] === 'b' ? s[6] : top - s[8]);
  function pushOut(x, z, rad, s) {
    if (s[0] === 'c') { const dx = x - s[1], dz = z - s[2], d = Math.hypot(dx, dz), m = s[3] + rad; if (d < m && d > 1e-5) return [s[1] + dx / d * m, s[2] + dz / d * m]; return [x, z]; }
    const a = s[5], ca = Math.cos(a), sa = Math.sin(a), dx = x - s[1], dz = z - s[2];
    let lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;
    const qx = clamp(lx, -s[3], s[3]), qz = clamp(lz, -s[4], s[4]), ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
    if (d >= rad) return [x, z];
    if (d > 1e-5) { lx = qx + ox / d * rad; lz = qz + oz / d * rad; }
    else { const px = s[3] - Math.abs(lx), pz = s[4] - Math.abs(lz); if (px < pz) lx = Math.sign(lx || 1) * (s[3] + rad); else lz = Math.sign(lz || 1) * (s[4] + rad); }
    return [s[1] + lx * ca + lz * sa, s[2] - lx * sa + lz * ca];
  }
  // toutes les pièces actives (fixes + plateformes mobiles à leur position du moment)
  const solids = () => V.TRS || [];
  function insideSolid(x, y, z, pad) {
    const S = solids();
    for (let i = 0; i < S.length; i++) { const s = S[i], top = solidTop(s, x, z, pad); if (top === null) continue; if (y < top + pad && y > solidBottom(s, top) - pad) return true; }
    return false;
  }
  // le sol sous (x, z) : plus haut dessus <= maxY (on monte les marches de 45 cm)
  function groundAt(x, z, maxY) {
    let y = groundBase(x, z), sol = null;
    if (!V.TR) return { y, s: null };
    const S = solids();
    for (let i = 0; i < S.length; i++) {
      const s = S[i], f = flOf(s); if (f.w) continue;
      const top = solidTop(s, x, z, 0.28); if (top === null || top > maxY || top < y) continue;
      y = top; sol = s;
    }
    return { y, s: sol };
  }
  function inTreeZone(x, z) { return V.TR && Math.hypot(x - V.TR.T[0], z - V.TR.T[1]) < 30; }
  /* ---------- physique du joueur : sous-pas (jamais à travers une plateforme, même en chute rapide) ---------- */
  function physics(dt) {
    const P = V.pos, D = V.D;
    // porté par une plateforme mobile
    const gmv = V.grounded && V.groundS && flOf(V.groundS).mv; if (gmv) { P.x += gmv.dx; P.y += gmv.dy; P.z += gmv.dz; }
    const travel = Math.hypot(V.vel.x, V.vel.z) * dt + Math.abs(V.vy) * dt + 0.001, n = Math.min(12, Math.max(1, Math.ceil(travel / 0.22))), h = dt / n;
    const nearTree = V.TR && (P.y > 2.5 || inTreeZone(P.x, P.z));
    V.bounced = false;
    for (let it = 0; it < n; it++) {
      // horizontal : maisons et objets du village, ruisseau, murs de l'arbre
      let nx = P.x + V.vel.x * h, nz = P.z + V.vel.z * h;
      if (P.y < 9) {
        [nx, nz] = collideSafe(P.x, P.z, nx, nz, 0.45, V.cols);
        if (D.creek.length && onBridge(D, nx, nz) === null) { const c = creekNear(D, nx, nz), m = D.creekW / 2 + 0.25; if (c[0] < m && c[0] > 1e-4) { nx = c[1] + (nx - c[1]) / c[0] * m; nz = c[2] + (nz - c[2]) / c[0] * m; } }
      }
      if (nearTree) {
        const S = solids();
        for (let i = 0; i < S.length; i++) {
          const s = S[i], f = flOf(s), top = solidTop(s, nx, nz, 0.4); if (top === null) continue;
          if ((f.w || top > P.y + 0.45) && solidBottom(s, top) < P.y + 1.7) [nx, nz] = pushOut(nx, nz, 0.4, s);
        }
      }
      // limites : le village (palissade) ou les abords de l'Arbre-Monde
      const lim = (D.wall || 36) - 1.3, rr = Math.hypot(nx, nz);
      if (rr > lim && !inTreeZone(nx, nz)) {
        if (V.TR && Math.hypot(nx - V.TR.T[0], nz - V.TR.T[1]) - 30 < rr - lim) { const tx = nx - V.TR.T[0], tz = nz - V.TR.T[1], d = Math.hypot(tx, tz); nx = V.TR.T[0] + tx / d * 29.9; nz = V.TR.T[1] + tz / d * 29.9; }
        else { nx *= lim / rr; nz *= lim / rr; }
      }
      P.x = nx; P.z = nz;
      // vertical : gravité, atterrissage, plafond
      V.vy = Math.max(-42, V.vy - 22 * h);
      let ny = P.y + V.vy * h;
      const g = groundAt(P.x, P.z, P.y + 0.45);
      if (V.vy > 0 && nearTree) {
        const S = solids();
        for (let i = 0; i < S.length; i++) { const s = S[i], top = solidTop(s, P.x, P.z, 0.1); if (top === null) continue; const b = solidBottom(s, top); if (b >= P.y + 1.6 && ny + 1.8 > b) { ny = b - 1.8; V.vy = 0; } }
      }
      if (V.vy <= 0 && (ny <= g.y || (V.grounded && P.y - g.y < 0.42))) {
        const land = -V.vy;
        ny = g.y; V.vy = 0;
        if (!V.grounded && land > 9) Au.fx('land', { g: Math.min(1, land / 25) });
        V.grounded = true; V.groundS = g.s; V.airJumps = 1;
        const f = g.s ? flOf(g.s) : null;
        if (f && f.b) { V.vy = f.b; V.grounded = false; V.groundS = null; V.bounced = true; Au.fx('jump', { g: 0.9, rate: 0.7 }); BR.AscFX.petals(V.scene).burst(new V3(P.x, ny + 0.2, P.z), 0.3, 0.6, ['#7af0ff', '#ffffff'], 18, 0.7); }
      } else if (ny > g.y + 0.001 || V.vy > 0) { if (V.grounded) V.coyote = 0.12; V.grounded = false; V.groundS = null; }
      P.y = ny;
    }
    V.groundY = groundAt(P.x, P.z, P.y + 0.05).y;
    if (P.y < -15) respawn(true);
  }

  /* ---------- l'Arbre-Monde : pièces mobiles, repères, chrono ---------- */
  function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  function pkBest() { try { const d = Q.data(); return d.st && d.st.pk_best ? d.st.pk_best / 10 : null; } catch (e) { return null; } }
  function buildTree() {
    const TR = V.D.tree; if (!TR) return;
    V.TR = TR; V.TRstatic = TR.solids.slice(); V.TRS = V.TRstatic.slice(); V.movers = [];
    TR.movers.forEach((m, i) => {
      const o = mergedGroup(m.k === 'swing' ? 'pk_swing' : 'pk_mover'); if (o) V.scene.add(o);
      const M = { def: m, o, solid: null, mv: { dx: 0, dy: 0, dz: 0 }, last: null, ph: i * 1.7 };
      if (m.k === 'swing') { if (o) o.scale.set(1, m.L / 5, 1); M.solid = ['b', 0, 0, 0.5, 1.5, m.yaw * DEG, 0, 0, { mv: M.mv }]; }
      else { if (o) o.scale.setScalar(m.r / 1.3); M.solid = ['c', 0, 0, m.r, 0, 0, { mv: M.mv }]; }
      V.movers.push(M); V.TRS.push(M.solid);
    });
    updateMovers(0);
    // repères : orbes au-dessus des plateformes (éteints puis dorés), panneau du départ avec le record
    V.ckSprites = TR.checks.map(c => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: L('#9ad8ff'), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(1.1, 1.1, 1); s.position.set(c.p[0], c.p[1] + 2.3, c.p[2]); V.scene.add(s); return s; });
    V.pk = { run: false, t: 0, ck: 0, ckP: null, done: 0 };
    paintPkSign();
    // cloche et coffre : petits lieux d'interaction (seulement en haut)
    V.spots.push({ id: 'bell', p: [TR.bell[0], TR.bell[2]], r: 2.8, n: 'La cloche de la cime', s: 'Sonner', col: '#ffd76a', minY: TR.top.p[1] - 1, mp: [TR.bell[0], TR.bell[2]], noMap: true });
    V.spots.push({ id: 'chest', p: [TR.chest[0], TR.chest[2]], r: 2.2, n: 'Le coffre du sommet', s: 'Ouvrir', col: '#ffc83a', minY: TR.top.p[1] - 1, mp: [TR.chest[0], TR.chest[2]], noMap: true });
    // le marqueur « Arbre-Monde » de la mini-carte (y aller à pied)
    V.pkSpot = { id: 'pkup', p: [TR.start[0], TR.start[2]], r: 2.2, n: 'Arbre-Monde', s: 'Parcours', col: '#7ed957', mp: [TR.start[0], TR.start[2]] };
  }
  // un modèle fusionné réutilisable (géométries partagées entre les copies)
  function mergedGroup(name) {
    V.mgCache = V.mgCache || {};
    if (!V.mgCache[name]) { const MG = Merger(); if (!place(MG, name, 0, 0, 0, 1)) return null; V.mgCache[name] = MG.build(); }
    const g = new THREE.Group(); for (const b in V.mgCache[name]) { const me = new THREE.Mesh(V.mgCache[name][b], bucketMat(b)); me.castShadow = b !== 'glow'; me.receiveShadow = true; g.add(me); } return g;
  }
  let _gt = null;
  function glowTex() {
    if (_gt) return _gt;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    _gt = new THREE.CanvasTexture(c); return _gt;
  }
  function paintPkSign() {
    const TR = V.TR; if (!TR) return;
    if (V.pkSign) { V.scene.remove(V.pkSign); V.pkSign.material.map.dispose(); V.pkSign.material.dispose(); }
    const b = pkBest();
    V.pkSign = label([{ t: 'L\'Arbre-Monde', c: '#9ee87a' }, { t: b ? 'record : ' + fmtTime(b) : 'parcours : à toi de jouer !', c: '#ffffff' }], 4.6);
    V.pkSign.position.set(TR.start[0], TR.start[1] + 6.6, TR.start[2]); V.scene.add(V.pkSign);
  }
  function updateMovers(dt) {
    if (!V.movers) return;
    const t = V.t;
    V.movers.forEach(M => {
      const m = M.def, s = M.solid; let x, y, z;
      if (m.k === 'swing') {
        const a = m.amp * DEG * Math.sin((t + M.ph) * 2 * Math.PI / m.per), yaw = m.yaw * DEG, lx = m.L * Math.sin(a), ly = -m.L * Math.cos(a);
        x = m.piv[0] + lx * Math.cos(yaw); z = m.piv[2] - lx * Math.sin(yaw); y = m.piv[1] + ly + 0.45 * m.L / 5;
        if (M.o) { M.o.position.set(m.piv[0], m.piv[1], m.piv[2]); M.o.quaternion.setFromAxisAngle(UP, yaw).multiply(_q.setFromAxisAngle(_Z, a)); }
        s[1] = x; s[2] = z; s[6] = y - 0.9; s[7] = y;
      } else {
        const k = (1 - Math.cos((t + M.ph) * 2 * Math.PI / m.per)) / 2;
        x = m.a[0] + (m.b[0] - m.a[0]) * k; y = m.a[1] + (m.b[1] - m.a[1]) * k; z = m.a[2] + (m.b[2] - m.a[2]) * k;
        if (M.o) { M.o.position.set(x, y, z); M.o.rotation.y = t * 0.3 + M.ph; }
        s[1] = x; s[2] = z; s[4] = y - 0.5; s[5] = y;
      }
      if (M.last) { M.mv.dx = x - M.last[0]; M.mv.dy = y - M.last[1]; M.mv.dz = z - M.last[2]; } else M.last = [0, 0, 0];
      M.last[0] = x; M.last[1] = y; M.last[2] = z;
    });
  }
  function respawn(hard) {
    const P = V.pos, pk = V.pk;
    const to = !hard && pk && pk.ckP ? pk.ckP : null;
    if (to) P.set(to[0], to[1] + 0.05, to[2]); else P.set(V.D.spawn[0], 0, V.D.spawn[1]);
    V.vel.set(0, 0, 0); V.vy = 0; V.grounded = false; V.groundS = null;
    BR.AscFX.petals(V.scene).gather(P.clone(), 2.0, 0.5, ['#ffffff', '#ffe9a8', '#9ee87a'], 50, 0.7);
    Au.fx('magic', { g: 0.6 });
  }
  function parkourTick(dt) {
    updateMovers(dt);
    const TR = V.TR, pk = V.pk; if (!TR || !pk) return;
    const P = V.pos, f = V.grounded && V.groundS ? flOf(V.groundS) : {};
    // départ : la première branche après l'arche
    if (f.st && !pk.run) { pk.run = true; pk.t = 0; pk.ck = 0; pk.ckP = null; V.ckSprites.forEach(s => { s.material.color.copy(L('#9ad8ff')); s.material.opacity = 0.55; }); Au.fx('tick', { g: 1 }); pkHud(true); }
    // retour sur le plateau (ou au village) sans repère : le chrono s'arrête
    if (pk.run && V.grounded && pk.ck === 0 && (V.groundS === V.TRstatic[0] || !V.groundS) && !f.st) { pk.run = false; pkHud(false); }
    if (f.ck && f.ck > pk.ck) {
      pk.ck = f.ck; const s = V.groundS; pk.ckP = [s[1], s[0] === 'c' ? s[5] : s[7], s[2]];
      const sp = V.ckSprites[f.ck - 1]; if (sp) { sp.material.color.copy(L('#ffd76a')); sp.material.opacity = 1; }
      BR.AscFX.petals(V.scene).burst(new V3(pk.ckP[0], pk.ckP[1] + 1.5, pk.ckP[2]), 1.0, 0.6, ['#ffd76a', '#ffffff'], 30, 0.8); Au.fx('reveal', { rate: 1 + f.ck * 0.04, g: 0.6 });
      if (!pk.run) { pk.run = true; pk.t = 0; pkHud(true); }
    }
    if (pk.run) pk.t += dt;
    // chute : on revient au dernier repère (en pétales)
    if (pk.run && pk.ckP && V.vy < 0 && P.y < pk.ckP[1] - 7) respawn();
    // arrivée
    if (f.top && pk.run) {
      pk.run = false; pk.ck = 0; pk.ckP = null; const t = Math.round(pk.t * 10) / 10, D = Q.data(); D.st = D.st || {};
      const prev = D.st.pk_best || 0, first = !prev, rec = !prev || t * 10 < prev;
      if (rec) { D.st.pk_best = Math.round(t * 10); try { Q.saveData(); } catch (e) { /* rien */ } paintPkSign(); }
      if (first && BR.Asc.emit) BR.Asc.emit('parkour', t);
      pk.done = 6; pkHud(true, 'Arrivé ! ' + fmtTime(t) + (rec ? (first ? ' · premier record !' : ' · nouveau record !') : ' · record ' + fmtTime(prev / 10)));
      Au.fx('win', { g: 0.7 }); ringBell();
      for (let i = 0; i < 4; i++) setTimeout(() => { if (V) V.fx.burst(new V3(P.x + (Math.random() - 0.5) * 6, P.y + 4 + Math.random() * 3, P.z + (Math.random() - 0.5) * 6), { n: 30, color: BR.pick([0xffd76a, 0x9ee87a, 0x7af0ff, 0xff8ac8]), speed: 6, life: 1.1, size: 0.25, grav: 3 }); }, i * 300);
    }
    if (pk.done > 0) { pk.done -= dt; if (pk.done <= 0) pkHud(false); }
    else if (pk.run && V.pkB) V.pkB.textContent = fmtTime(pk.t);
    if (V.bellT > 0 && V.bell) { V.bellT -= dt; V.bell.quaternion.setFromAxisAngle(new V3(1, 0, 0), Math.sin(V.bellT * 9) * V.bellT * 0.35); }
  }
  function ringBell() { V.bellT = 1.6; Au.fx('parry', { g: 0.5 }); setTimeout(() => Au.fx('parry', { g: 0.35, rate: 0.8 }), 350); }
  function pkHud(on, msg) {
    if (!V.pkHud) {
      const el = document.createElement('div'); el.className = 'vil-pk';
      el.style.cssText = 'position:absolute;top:78px;left:50%;transform:translateX(-50%);padding:6px 18px;border-radius:12px;background:rgba(10,8,6,0.72);border:1px solid rgba(255,215,106,0.45);color:#f3ead2;font:600 13px Inter,Arial,sans-serif;text-align:center;pointer-events:none;z-index:3;transition:opacity .2s;opacity:0';
      const sm = document.createElement('small'); sm.style.cssText = 'display:block;letter-spacing:.14em;font-size:10px;color:#9ee87a'; sm.textContent = 'L\'ARBRE-MONDE';
      const b = document.createElement('b'); b.style.cssText = 'display:block;font:700 24px Oswald,Arial Narrow,sans-serif;color:#ffd76a'; b.textContent = '0:00.0';
      const s = document.createElement('span'); s.style.cssText = 'display:block;font-size:11px;opacity:.8';
      el.appendChild(sm); el.appendChild(b); el.appendChild(s); V.root.appendChild(el); V.pkHud = el; V.pkB = b; V.pkS = s;
    }
    const b = pkBest();
    V.pkHud.style.opacity = on ? 1 : 0;
    V.pkS.textContent = msg || (b ? 'record : ' + fmtTime(b) + ' · R : dernier repère' : 'R : revenir au dernier repère');
    if (msg) V.pkB.textContent = fmtTime(V.pk.t);
  }

  /* ---------- les autres joueurs au village (BR.VNet) ---------- */
  const EMOTES = [
    { id: 'salut', clips: ['Interact', 'Cheer'], txt: 'Salut !' },
    { id: 'danse', clips: ['2H_Melee_Attack_Spin', 'Spellcast_Long', 'Cheer'], txt: '♪ ♫ ♪' },
    { id: 'rire', clips: ['Hit_B', 'Hit_A', 'Cheer'], txt: 'Ha ha ha !' },
    { id: 'bravo', clips: ['Cheer', 'Interact'], txt: 'Bravo !' },
  ];
  const LOCO_SPEED = { Idle: 0, Walking_A: 2.4, Walking_B: 2.4, Walking_C: 2, Running_A: 6.2, Running_B: 9.5 };
  function playEmote(av, id) { const E = EMOTES.find(e => e.id === id); if (!E) return 0; for (const c of E.clips) { const d = av.act(c); if (d) return { d, c }; } return 0; }
  function emote(id) {
    if (!V || V.suck) return;
    const r = playEmote(V.av, id), E = EMOTES.find(e => e.id === id);
    if (r) { V.emoteT = r.d; V.emoteClip = r.c; }
    if (E) bubble(V.av.group, E.txt, 2.5, true);
    if (BR.VNet) BR.VNet.emote(id);
  }
  // bulle au-dessus d'une tête (texte court, 2 lignes au plus)
  function bubble(group, text, life, small) {
    if (group.userData.bub) { group.remove(group.userData.bub); group.userData.bub.material.map.dispose(); group.userData.bub.material.dispose(); }
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
    g.font = (small ? '700 40px' : '600 32px') + ' Inter, Arial, sans-serif';
    const words = String(text).split(/\s+/), lines = [''];
    words.forEach(w => { const t = (lines[lines.length - 1] + ' ' + w).trim(); if (g.measureText(t).width > 460 && lines[lines.length - 1]) { if (lines.length < 2) lines.push(w); else lines[1] += '…'; } else lines[lines.length - 1] = t; });
    const wMax = Math.max(...lines.map(l => g.measureText(l).width)) + 40, hh = lines.length * 44 + 26, x0 = 256 - wMax / 2, y0 = 150 - hh;
    g.fillStyle = 'rgba(16,12,8,0.82)'; g.strokeStyle = 'rgba(255,215,106,0.8)'; g.lineWidth = 3;
    g.beginPath(); if (g.roundRect) g.roundRect(x0, y0, wMax, hh - 10, 16); else g.rect(x0, y0, wMax, hh - 10); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(246, 140); g.lineTo(266, 140); g.lineTo(256, 154); g.fill();
    g.fillStyle = '#fff4d8'; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((l, i) => g.fillText(l, 256, y0 + 30 + i * 44));
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(3.2, 1.0, 1); s.position.y = 3.3; s.renderOrder = 13;
    group.add(s); group.userData.bub = s; group.userData.bubT = life || 5;
  }
  function tickBubble(group, dt) { const s = group.userData.bub; if (!s) return; group.userData.bubT -= dt; s.material.opacity = clamp(group.userData.bubT / 0.5, 0, 1); if (group.userData.bubT <= 0) { group.remove(s); s.material.map.dispose(); s.material.dispose(); group.userData.bub = null; } }
  function netInit() {
    const N = BR.VNet; V.remote = new Map(); if (!N) return;
    const P = V.pos;
    V.netOff = [N.on('join', p => addRemote(p)), N.on('leave', p => removeRemote(p.id, true)), N.on('pos', p => { const R = V && V.remote.get(p.id); if (R) Object.assign(R.tgt, { x: p.x, y: p.y, z: p.z, r: p.r, a: p.a }); else addRemote(p); }),
      N.on('emote', m => { const R = V && V.remote.get(m.id); if (!R) return; playEmote(R.av, m.e); const E = EMOTES.find(e => e.id === m.e); if (E) bubble(R.av.group, E.txt, 2.5, true); }),
      N.on('chat', m => chatIn(m)), N.on('reset', () => { if (V) [...V.remote.keys()].forEach(id => removeRemote(id, false)); })];
    N.enter({ x: P.x, y: P.y, z: P.z, r: V.face || 0, a: 'Idle' });
    (N.players || new Map()).forEach(p => addRemote(p));
    countHud();
  }
  function addRemote(p) {
    if (!V || !p || V.remote.has(p.id)) return;
    let av; try { av = BR.Avatar.build(p.look || { skin: 'survivor' }); } catch (e) { console.warn(e); return; }
    av.group.position.set(p.x || 0, p.y || 0, p.z || 0); av.group.rotation.y = p.r || 0; V.scene.add(av.group);
    const lb = label([{ t: String(p.n || 'Aventurier').slice(0, 20), c: '#bfe8ff' }].concat(p.lv ? [{ t: 'niveau ' + p.lv, c: '#ffffff' }] : []), p.lv ? 2.8 : 2.4); lb.position.y = 2.6; av.group.add(lb);
    V.remote.set(p.id, { id: p.id, av, lb, tgt: { x: p.x || 0, y: p.y || 0, z: p.z || 0, r: p.r || 0, a: p.a || 'Idle' }, n: p.n });
    BR.AscFX.petals(V.scene).gather(av.group.position.clone(), 2.1, 0.5, ['#ffffff', '#ffe9a8', '#ffd76a'], 45, 0.9); popIn(av.group);
    countHud();
  }
  function removeRemote(id, fx) {
    const R = V && V.remote.get(id); if (!R) return;
    if (fx) BR.AscFX.petals(V.scene).burst(R.av.group.position.clone(), 2.0, 0.5, ['#ffffff', '#ffd76a'], 45, 1);
    V.scene.remove(R.av.group); R.av.group.traverse(o => { if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } }); try { R.av.dispose(); } catch (e) { /* rien */ }
    V.remote.delete(id); countHud();
  }
  function netTick(dt, speed) {
    const N = BR.VNet;
    if (N && !V.suck) {
      const a = V.emoteT > 0 ? V.emoteClip : !V.grounded ? 'Jump_Idle' : speed < 0.35 ? 'Idle' : speed < 4.2 ? 'Walking_A' : speed > 8 ? 'Running_B' : 'Running_A';
      N.move(V.pos.x, V.pos.y, V.pos.z, V.av.group.rotation.y, a);
    }
    if (!V.remote || !V.remote.size) { tickBubble(V.av.group, dt); return; }
    tickBubble(V.av.group, dt);
    const list = [...V.remote.values()], P = V.pos;
    list.forEach(R => { R.d = Math.hypot(R.av.group.position.x - P.x, R.av.group.position.z - P.z, (R.av.group.position.y - P.y) * 0.5); });
    list.sort((a, b) => a.d - b.d);
    list.forEach((R, rank) => {
      const g = R.av.group, t = R.tgt, k = 1 - Math.exp(-dt * 10);
      const ox = g.position.x, oz = g.position.z;
      if (Math.hypot(t.x - g.position.x, t.y - g.position.y, t.z - g.position.z) > 10) g.position.set(t.x, t.y, t.z);
      else { g.position.x += (t.x - g.position.x) * k; g.position.y += (t.y - g.position.y) * k; g.position.z += (t.z - g.position.z) * k; }
      g.rotation.y += BR.angDiff(g.rotation.y, t.r) * k;
      tickBubble(g, dt);
      // niveau de détail : loin ou hors champ = caché ; effets de skin pour les 6 plus proches seulement
      _sph.center.set(g.position.x, g.position.y + 1, g.position.z); _sph.radius = 1.6;
      g.visible = rank < 12 && R.d < 60 && (!V.frustum || V.frustum.intersectsSphere(_sph));
      if (R.av.aura) R.av.aura.group.visible = rank < 6;
      const sh = R.d < 20 && rank < 6; if (R.sh !== sh) { R.sh = sh; g.traverse(m => { if (m.isMesh) m.castShadow = sh; }); }
      R.lb.material.opacity = clamp((30 - R.d) / 8, 0, 1); R.lb.visible = R.d < 30;
      if (!g.visible) return;
      const sp = LOCO_SPEED[t.a]; const air = /^Jump/.test(t.a);
      const moved = Math.hypot(g.position.x - ox, g.position.z - oz) / Math.max(dt, 1e-3);
      R.av.update(dt, sp != null ? sp : (air ? 0 : Math.min(moved, 9)), { air, sprint: sp > 8 });
    });
  }
  function countHud() {
    if (!V || !BR.VNet) return;
    if (!V.countEl) { const el = document.createElement('div'); el.className = 'vil-count'; el.style.cssText = `position:absolute;top:${76 + MAPPX + 10}px;right:18px;width:${MAPPX}px;text-align:center;font:600 12px Inter,Arial,sans-serif;color:#e8dcc0;pointer-events:none;z-index:3;text-shadow:0 1px 3px #000`; V.root.appendChild(el); V.countEl = el; }
    const n = V.remote.size + 1;
    V.countEl.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#7ed957;margin-right:6px;box-shadow:0 0 6px #7ed957"></span>${n} ${n > 1 ? 'aventuriers' : 'aventurier'} au village`;
  }
  // discussion : Entrée pour écrire, bulles au-dessus des têtes, petit journal en bas à gauche
  function openChat() {
    if (!V || V.chatEl) return;
    V.keys = {};
    const w = document.createElement('div'); w.style.cssText = 'position:absolute;left:50%;bottom:64px;transform:translateX(-50%);z-index:5;width:min(520px,80vw)';
    const inp = document.createElement('input'); inp.maxLength = 120; inp.placeholder = 'Message au village… (Entrée : envoyer · Échap : fermer)';
    inp.style.cssText = 'width:100%;box-sizing:border-box;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,215,106,0.6);background:rgba(10,8,6,0.85);color:#f6ecd2;font:500 14px Inter,Arial,sans-serif;outline:none';
    w.appendChild(inp); V.root.appendChild(w); V.chatEl = w;
    const close = () => { if (V && V.chatEl === w) { w.remove(); V.chatEl = null; } };
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Enter') { e.preventDefault(); const t = inp.value.trim(); if (t && V) { if (BR.VNet) BR.VNet.chat(t); bubble(V.av.group, t, 5); chatLog((Acc.p && Acc.p.name) || 'Moi', t, true); } close(); }
    });
    inp.addEventListener('keyup', e => e.stopPropagation());
    inp.addEventListener('blur', () => setTimeout(close, 0));
    setTimeout(() => inp.focus(), 0);
  }
  function chatIn(m) {
    if (!V || !m || m.me) return;
    const R = V.remote.get(m.id); if (R) bubble(R.av.group, m.m, 5);
    chatLog(m.n || (R && R.n) || '?', m.m, false);
  }
  function chatLog(name, text, me) {
    if (!V.logEl) { const el = document.createElement('div'); el.style.cssText = 'position:absolute;left:22px;bottom:108px;max-width:420px;display:flex;flex-direction:column;gap:3px;pointer-events:none;z-index:3;font:500 12.5px Inter,Arial,sans-serif'; V.root.appendChild(el); V.logEl = el; }
    const ln = document.createElement('div'); ln.style.cssText = 'padding:3px 10px;border-radius:8px;background:rgba(10,8,6,0.6);color:#efe4c8;transition:opacity 1s';
    const b = document.createElement('b'); b.style.color = me ? '#ffd76a' : '#bfe8ff'; b.textContent = name + ' : '; ln.appendChild(b); ln.appendChild(document.createTextNode(text));
    V.logEl.appendChild(ln); while (V.logEl.children.length > 5) V.logEl.firstChild.remove();
    setTimeout(() => { ln.style.opacity = 0; }, 9000); setTimeout(() => ln.remove(), 10000);
  }

  /* ---------- entrées ---------- */
  let H = null;
  // vrai seulement si on tape dans un champ de texte visible ; un champ caché (écran précédent) qui a gardé le focus est relâché
  function typing(t) {
    if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) return false;
    if (t.getClientRects().length && document.contains(t)) return true;
    try { t.blur(); } catch (e) { /* rien */ }
    return false;
  }
  // apparition par les pétales : le modèle reste invisible pendant que les pétales arrivent, puis « éclot »
  function popIn(g) { g.scale.setScalar(0.001); V.pops.push({ g, t: 0 }); }
  function tickPops(dt) {
    for (let i = V.pops.length - 1; i >= 0; i--) {
      const P = V.pops[i]; P.t += dt;
      const k = Math.min(1, Math.max(0, (P.t - 0.6) / 0.35));
      if (P.t > 0.6 && !P.pop) {
        P.pop = true;
        try { const p = P.g.position; V.fx.ring(new V3(p.x, p.y + 0.06, p.z), { r1: 3, color: 0xffffff, life: 0.45 }); V.fx.burst(new V3(p.x, p.y + 1, p.z), { n: 26, color: 0xffe9a8, speed: 6, life: 0.5 }); } catch (e) { /* rien */ }
        if (P.g === V.av.group) Au.fx('reveal', { g: 0.45 });
      }
      P.g.scale.setScalar(Math.max(0.001, (1 - Math.pow(1 - k, 3)) * (1 + Math.sin(k * Math.PI) * 0.15)));
      if (k >= 1) { P.g.scale.setScalar(1); V.pops.splice(i, 1); }
    }
  }
  function bind() {
    H = {
      kd: e => {
        if (!V || typing(e.target)) return;
        if (/^Arrow/.test(e.code)) e.preventDefault();
        const code = BR.Keys ? BR.Keys.canon(e.code, 'v') : e.code;   // touches choisies dans les paramètres
        if (code === 'Space') { e.preventDefault(); if (!V.keys.Space) V.jumpBuf = 0.15; }
        V.keys[code] = true;
        if (e.repeat) return;
        if (code === 'KeyE') act();
        if (code === 'KeyR') { if (V.near && V.near.id === 'board') { Au.ui('click'); UI.show('multi'); } else if (V.pk && V.pk.ck > 0) respawn(); }
        if (code === 'Enter' || code === 'NumpadEnter') { e.preventDefault(); openChat(); }
        const em = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[code];
        if (em != null) emote(EMOTES[em].id);
      },
      ku: e => { if (!V) return; const code = BR.Keys ? BR.Keys.canon(e.code, 'v') : e.code; V.keys[code] = false; if (code === 'Space' && V.vy > 3 && !V.bounced) V.vy *= 0.55; },   // saut plus court si on relâche tôt
      md: e => { if (!V || e.button !== 0 && e.button !== 2) return; const ae = document.activeElement; if (ae && ae !== document.body && ae.blur && !(V.chatEl && V.chatEl.contains(ae))) ae.blur(); V.drag = { x: e.clientX, y: e.clientY }; V.lastDrag = V.t; },
      mm: e => { if (!V || !V.drag) return; const dx = e.clientX - V.drag.x, dy = e.clientY - V.drag.y; V.drag.x = e.clientX; V.drag.y = e.clientY; V.yaw -= dx * 0.006; V.pitch = BR.clamp(V.pitch + dy * 0.004, -0.35, 1.15); V.lastDrag = V.t; },
      mu: () => { if (V) { V.drag = null; V.lastDrag = V.t; } },
      wh: e => { if (V) V.dist = BR.clamp(V.dist + e.deltaY * 0.006, 2.5, 16); },
      bl: () => { if (V) V.keys = {}; },
      cm: e => e.preventDefault(),
    };
    // écoute au niveau de la fenêtre, en premier : aucun autre écouteur de la page ne peut avaler les touches du village
    H.log = e => { if (!V) return; (V.klog = V.klog || []).push((e.type === 'keydown' ? '↓' : '↑') + e.code + (e.target && e.target !== document.body ? '@' + e.target.tagName : '')); if (V.klog.length > 8) V.klog.shift(); };
    window.addEventListener('keydown', H.log, true); window.addEventListener('keyup', H.log, true);
    window.addEventListener('keydown', H.kd, true); window.addEventListener('keyup', H.ku, true);
    V.canvas.addEventListener('mousedown', H.md); document.addEventListener('mousemove', H.mm); document.addEventListener('mouseup', H.mu);
    V.canvas.addEventListener('wheel', H.wh, { passive: true }); V.canvas.addEventListener('contextmenu', H.cm); window.addEventListener('blur', H.bl);
  }
  function unbind() {
    if (!H) return;
    window.removeEventListener('keydown', H.kd, true); window.removeEventListener('keyup', H.ku, true); window.removeEventListener('keydown', H.log, true); window.removeEventListener('keyup', H.log, true); document.removeEventListener('mousemove', H.mm); document.removeEventListener('mouseup', H.mu); window.removeEventListener('blur', H.bl);
    H = null;
  }

  /* ---------- actions ---------- */
  function act(id) {
    const sp = id ? V.spots.find(s => s.id === id) : V.near; if (!sp || V.busy) return;
    V.auto = null;
    Au.ui('ok');
    if ((sp.id === 'portal' || sp.id === 'board') && !(Q.data().sel || {}).cls) { UI.toast("Choisis d'abord ta classe chez le Maître d'armes !"); UI.show('asc-armory'); return; }
    if (sp.id === 'portal' && !V.mapGo) { UI.show('asc-maps'); return; }
    if (sp.id === 'portal') {
      // on est aspiré dans le portail, puis la course commence (sur la carte choisie)
      const mapId = V.mapGo; V.mapGo = null;
      const c = V.portalPos.clone().add(new V3(0, 3.6, 0));
      V.busy = true; V.suck = { t: 0, p0: V.pos.clone(), c };
      BR.Audio.fx('charge', { len: 1.2, g: 0.9 });
      BR.AscFX.petals(V.scene).suck(V.pos.clone(), c, ['#ffffff', '#ffd76a'], 90, 1.1);
      setTimeout(() => { const f = BR.$('#asc-flash') || BR.el('div', { id: 'asc-flash' }); if (!f.parentNode) document.body.appendChild(f); f.classList.add('on'); }, 900);
      setTimeout(() => { Q.startSolo(mapId); setTimeout(() => { const f = BR.$('#asc-flash'); if (f) f.classList.remove('on'); }, 250); }, 1350);
      return;
    }
    if (sp.id === 'board') { Q.friends(); return; }
    if (sp.id === 'stall') { UI.show('char', { back: 'asc' }); return; }
    if (sp.id === 'wheel') { V.spin = 1.6; V.busy = true; BR.Audio.fx('spin', { v: 1 }); setTimeout(() => { if (V) V.busy = false; UI.show('asc-altar'); }, 1300); return; }
    if (sp.id === 'obelisk') { const D = Q.data(); let p = Q.selPal() + 1; if (p > D.pal) p = 0; BR.store.set('br_asc_pal', p); paintObelisk(); VG.onChange && VG.onChange(); BR.Audio.fx('reveal', { rate: 1 + p * 0.05 }); V.fx.pillar(new V3(sp.mp[0], 0, sp.mp[1]), { color: Q.palCol(p), r: 1.4, h: 14, life: 0.6 }); return; }
    if (sp.id === 'sign') { BR.ascMode = false; UI.show('hub'); return; }
    if (sp.id === 'bell') { ringBell(); V.fx.burst(new V3(sp.p[0], V.pos.y + 3, sp.p[1]), { n: 24, color: 0xffd76a, speed: 4, life: 0.9, size: 0.2, grav: 2 }); return; }
    if (sp.id === 'chest') { V.fx.burst(new V3(sp.p[0], V.pos.y + 1.2, sp.p[1]), { n: 40, color: 0xffc83a, speed: 6, life: 1.2, size: 0.22, grav: 8, up: 3 }); Au.fx('reveal', { g: 0.8 }); UI.toast && UI.toast('Le coffre de la cime brille pour ceux qui grimpent jusqu\'ici !'); return; }
    if (sp.id === 'armory') { UI.show('asc-armory'); return; }
    if (sp.id === 'tree') { UI.show('asc-tree'); }
  }
  VG.act = id => { if (V) act(id); };
  VG.goTo = id => { if (!V) return; const s = V.spots.find(x => x.id === id) || (V.pkSpot && (id === 'parkour' || id === V.pkSpot.id) ? V.pkSpot : null); if (s) goTo(s); };   // y aller à pied (comme un clic sur la mini-carte)

  /* ---------- boucle ---------- */
  const _F = new V3(), _R = new V3(), _mv = new V3(), _t = new V3(), _c = new V3(), _q = new THREE.Quaternion(), _Z = new V3(0, 0, 1);
  // garde-fou : une erreur dans une image ne doit jamais figer le village ; on l'affiche (une fois) pour pouvoir la signaler
  function loop(now) {
    if (!V) return;
    V.raf = requestAnimationFrame(loop);
    try { frame(now); }
    catch (e) {
      reportErr(e);
      try { if (V) { V.last = now; if (V.post) V.post.render(0.016); else V.R.render(V.scene, V.cam); } } catch (e2) { /* rien */ }
    }
  }
  function reportErr(e) {
    if (!V) return;
    const msg = String((e && e.message) || e).slice(0, 160), at = ((e && e.stack) || '').split('\n').slice(1, 3).map(s => s.trim().replace(/^at\s+/, '').replace(/^.*\/(js\/[^:]+:\d+).*$/, '$1')).join(' ← ');
    V.errN = (V.errN || 0) + 1;
    if (V.errMsg === msg) { if (V.errEl) V.errEl.querySelector('i').textContent = '×' + V.errN; return; }
    V.errMsg = msg; console.error('village', e);
    if (!V.errEl) { const el = document.createElement('div'); el.style.cssText = 'position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:9;max-width:min(680px,90vw);padding:8px 14px;border-radius:10px;background:rgba(80,0,0,0.85);border:1px solid #ff6b6b;color:#ffe0e0;font:500 12px Inter,Arial,sans-serif;user-select:text;cursor:text'; V.root.appendChild(el); V.errEl = el; }
    V.errEl.innerHTML = `<b>Erreur du village</b> (envoie une capture) <i></i><br>${BR.esc ? BR.esc(msg) : msg}<br><small>${BR.esc ? BR.esc(at) : at}</small>`;
  }
  function unstuck() {
    if (!V) return;
    const S = V.D.spawn; V.pos.set(S[0], 0, S[1]); V.vel.set(0, 0, 0); V.vy = 0; V.grounded = true; V.groundS = null;
    V.auto = null; V.suck = null; V.busy = false; V.arrive = 0; V.keys = {}; V.drag = null; V.av.group.scale.setScalar(1); V.pops.length = 0;
    try { const ae = document.activeElement; if (ae && ae !== document.body && ae.blur) ae.blur(); } catch (e) { /* rien */ }
    V.diag = true; Au.ui('ok');
    if (!V.diagEl) { const el = document.createElement('div'); el.style.cssText = 'position:absolute;left:18px;bottom:56px;z-index:6;width:330px;padding:8px 12px;border-radius:10px;background:rgba(10,8,6,0.85);border:1px solid rgba(255,215,106,0.5);color:#f6ecd2;font:500 11px/1.45 Consolas,monospace;user-select:text;white-space:pre-wrap'; V.root.appendChild(el); V.diagEl = el; }
  }
  function diagTick(dt, mv) {
    V.diagT = (V.diagT || 0) - dt; if (V.diagT > 0 || !V.diagEl) return; V.diagT = 0.25;
    const f = n => (+n).toFixed(2), ae = document.activeElement, held = Object.keys(V.keys).filter(k => V.keys[k]);
    V.diagEl.textContent = `DIAGNOSTIC (fais une capture d'écran)\n`
      + `touches reçues : ${(V.klog || []).join(' ') || 'aucune'}\n`
      + `touches tenues : ${held.join(' ') || 'aucune'} · direction ${f(mv.x)},${f(mv.z)}\n`
      + `position ${f(V.pos.x)}, ${f(V.pos.y)}, ${f(V.pos.z)} · vitesse ${f(Math.hypot(V.vel.x, V.vel.z))} · vy ${f(V.vy)}\n`
      + `au sol ${V.grounded ? 'oui' : 'non'} · sol ${f(V.groundY || 0)} · libre ${isFree(V.pos.x, V.pos.z, 0.45, V.cols) ? 'oui' : 'non'}\n`
      + `auto ${V.auto ? 'oui' : 'non'} · occupé ${V.busy ? 'oui' : 'non'} · portail ${V.suck ? 'oui' : 'non'} · arrivée ${f(V.arrive || 0)} · émote ${f(V.emoteT || 0)}\n`
      + `focus ${ae ? ae.tagName + (ae.className ? '.' + String(ae.className).split(' ')[0] : '') : '-'} · fenêtre active ${document.hasFocus() ? 'oui' : 'non'} · ${Math.round(1 / Math.max(dt, 1e-3))} i/s · erreurs ${V.errN || 0}${V.errMsg ? ' (' + V.errMsg.slice(0, 60) + ')' : ''}`;
  }
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - V.last) / 1000)); V.last = now;
    if (document.hidden) return;
    V.t += dt; V.uTime.value = V.t;
    const w = innerWidth, h = innerHeight; if (V.w !== w || V.h !== h) { V.w = w; V.h = h; V.R.setSize(w, h, false); V.cam.aspect = w / h; V.cam.updateProjectionMatrix(); if (V.post) V.post.setSize(w, h); }
    // déplacement (relatif à la caméra) : ZQSD / WASD (touches physiques) ou flèches
    const k = V.keys, fw = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), st = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    if (fw || st) V.auto = null;
    const mv = _mv.set(0, 0, 0);
    if (V.auto && !V.suck) autoWalk(dt, mv);
    const F = _F.set(Math.sin(V.yaw), 0, Math.cos(V.yaw)), Rt = _R.set(-Math.cos(V.yaw), 0, Math.sin(V.yaw));
    mv.addScaledVector(F, fw).addScaledVector(Rt, st); if (mv.lengthSq() > 1) mv.normalize();
    const moving = mv.lengthSq() > 0.01;
    V.arrive = Math.max(0, (V.arrive || 0) - dt);
    if (V.pops.length) tickPops(dt);
    const sp = (k.ShiftLeft || k.ShiftRight ? 10 : 6.2) * (V.suck || V.arrive > 0 ? 0 : 1);
    // accélération / freinage progressifs (moins de prise en l'air)
    { const tx = mv.x * sp, tz = mv.z * sp, ax = V.grounded ? (moving ? 38 : 30) : (moving ? 16 : 20), dx = tx - V.vel.x, dz = tz - V.vel.z, dl = Math.hypot(dx, dz), st2 = ax * dt;
      if (dl <= st2) { V.vel.x = tx; V.vel.z = tz; } else { V.vel.x += dx / dl * st2; V.vel.z += dz / dl * st2; } }
    // saut : tampon (on peut appuyer juste avant d'atterrir), temps de grâce au bord (coyote), double saut
    V.jumpBuf = Math.max(0, (V.jumpBuf || 0) - dt); V.coyote = Math.max(0, (V.coyote || 0) - dt);
    if (V.jumpBuf > 0 && !V.suck && !(V.arrive > 0)) {
      if (V.grounded || V.coyote > 0) { V.vy = 8.4; V.jumpBuf = 0; V.coyote = 0; V.grounded = false; V.groundS = null; V.airJumps = 1; Au.fx('jump', { g: 0.5 }); }
      else if (V.airJumps > 0) { V.vy = 7.6; V.jumpBuf = 0; V.airJumps = 0; Au.fx('jump', { g: 0.6 }); BR.AscFX.petals(V.scene).burst(V.pos.clone(), 0.3, 0.4, ['#ffffff', '#ffe9a8'], 14, 0.5); }
    }
    // filet de sécurité : une vitesse ou une position invalide (NaN) figerait le joueur pour toujours
    if (!isFinite(V.vel.x) || !isFinite(V.vel.z)) V.vel.set(0, 0, 0);
    if (!isFinite(V.vy)) V.vy = 0;
    if (!isFinite(V.pos.x) || !isFinite(V.pos.y) || !isFinite(V.pos.z)) V.pos.set(V.D.spawn[0], 0, V.D.spawn[1]);
    const px0 = V.pos.x, pz0 = V.pos.z;
    physics(dt);
    if (moving && !V.suck && !(V.arrive > 0) && V.grounded && Math.hypot(V.pos.x - px0, V.pos.z - pz0) < 0.004) {
      V.stuckT = (V.stuckT || 0) + dt;
      // contre un simple mur on peut repartir ailleurs : on ne dégage que si aucune direction n'est libre (ou après 3 s)
      const boxed = () => { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = collideSafe(V.pos.x, V.pos.z, V.pos.x + Math.cos(a) * 0.15, V.pos.z + Math.sin(a) * 0.15, 0.45, V.cols); if (Math.hypot(r[0] - V.pos.x, r[1] - V.pos.z) > 0.1) return false; } return true; };
      if ((V.stuckT > 1 && V.stuckT - dt <= 1 && boxed()) || V.stuckT > 3) {
        V.stuckT = 0;
        const f = nearestFree(V.pos.x - mv.x * 0.6, V.pos.z - mv.z * 0.6, 0.6, V.cols) || [V.pos.x - mv.x * 0.8, V.pos.z - mv.z * 0.8];
        V.pos.x = f[0]; V.pos.z = f[1]; V.vel.set(0, 0, 0); V.grounded = false; V.vy = 2;
        console.warn('village : joueur débloqué', px0.toFixed(2), pz0.toFixed(2));
      }
    } else V.stuckT = 0;
    const gy = V.groundY || 0;
    const speed = Math.hypot(V.vel.x, V.vel.z);
    if (speed > 0.3) V.face = Math.atan2(V.vel.x, V.vel.z);
    V.av.group.rotation.y += BR.angDiff(V.av.group.rotation.y, V.face) * Math.min(1, dt * 12);
    // la caméra revient doucement derrière le joueur qui avance (1 s après le dernier glisser)
    if (!V.drag && V.t - (V.lastDrag || -9) > 1 && speed > 1.5 && fw >= 0 && !V.auto) V.yaw += BR.angDiff(V.yaw, V.face) * Math.min(1, dt * 1.1);
    // aspiration dans le portail
    if (V.suck) { V.suck.t += dt; const e = Math.min(1, V.suck.t / 1.2); V.pos.lerpVectors(V.suck.p0, V.suck.c, e * e); V.av.group.rotation.y += dt * (6 + e * 30); V.av.group.scale.setScalar(Math.max(0.05, 1 - e * e)); }
    V.emoteT = Math.max(0, (V.emoteT || 0) - dt);
    V.av.update(dt, speed, { air: !V.grounded && V.pos.y - gy > 0.15, sprint: speed > 8 });
    parkourTick(dt);
    netTick(dt, speed);
    updateNPCs(dt);
    updateChickens(dt);
    // décor vivant
    // (rotations en quaternions : autour de l'axe propre de la roue / des ailes, et de la verticale pour le cristal)
    if (V.wheel) { V.spin = Math.max(0, (V.spin || 0) - dt * 0.9); V.wheel.quaternion.multiply(_q.setFromAxisAngle(_Z, dt * (0.25 + V.spin * 9))); }
    if (V.blades) V.blades.quaternion.multiply(_q.setFromAxisAngle(_Z, -dt * 0.45));
    if (V.crystal) { V.crystal.position.y = V.crystalY + Math.sin(V.t * 1.3) * 0.18; V.crystal.quaternion.premultiply(_q.setFromAxisAngle(UP, dt * 0.8)); }
    if (V.creekTex) V.creekTex.offset.x -= dt * 0.12;
    V.lights.forEach((o, i) => { const f = V.P ? (o.kind === 'lamp' ? V.P.lamp : o.kind === 'portal' ? 1 : 0.8 + V.P.lamp * 0.2) : 1; o.l.intensity = o.k * f * (o.kind === 'fire' ? 0.85 + Math.sin(V.t * 17) * 0.08 + Math.random() * 0.1 : 0.95 + Math.sin(V.t * 5 + i) * 0.05); });
    const cp = V.cam.position, near2 = (p, r) => (p.x - cp.x) * (p.x - cp.x) + (p.z - cp.z) * (p.z - cp.z) < r * r;
    // fumées de cheminée (seulement autour de la caméra)
    V.smoke.forEach((p, i) => { if (near2(p, 55) && Math.random() < dt * 1.3) V.fx.spark(_t.set(p.x + (Math.random() - 0.5) * 0.3, p.y, p.z + (Math.random() - 0.5) * 0.3), _c.set(0.35 + Math.random() * 0.2, 0.9 + Math.random() * 0.4, 0.15), { kind: 'smoke', color: V.preset === 'night' ? 0x8a8e9a : 0xe6dcd0, life: 4.2, size: 0.7, size1: 2.4, alpha: 0.32, world: true }); });
    // feux (forge, braseros) et âmes (temple)
    V.fires.forEach(f => { if (near2(f.p, 40) && Math.random() < dt * 14) V.fx.spark(_t.copy(f.p).add(_c.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)), _c.set((Math.random() - 0.5) * 0.4, 1.3 + Math.random() * 1.4, (Math.random() - 0.5) * 0.4), { color: 0xff9a3a, life: 0.7, size: 0.3, size1: 0.04, drag: 0.5 }); });
    V.arcane.forEach(p => { if (near2(p, 45) && Math.random() < dt * 6) V.fx.spark(_t.copy(p).add(_c.set((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2.2)), _c.set(0, 0.5 + Math.random() * 0.6, 0), { color: 0x6ae0ff, life: 1.4, size: 0.2, size1: 0.02 }); });
    V.souls.forEach(p => { if (near2(p, 45) && Math.random() < dt * 8) V.fx.spark(_t.copy(p).add(_c.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)), _c.set(0, 0.8 + Math.random(), 0), { color: 0xb98cff, life: 1.1, size: 0.22, size1: 0.03 }); });
    // jets d'eau de la fontaine
    V.spouts.forEach(p => { if (near2(p, 40) && Math.random() < dt * 9) { const dx = p.x - (V.fountainX || 0), dz = p.z - (V.fountainZ || 0), l = Math.hypot(dx, dz) || 1; V.fx.spark(_t.copy(p), _c.set(dx / l * 1.1, 1.6, dz / l * 1.1), { color: 0xbfe6ff, life: 0.65, size: 0.16, size1: 0.1, grav: 9, bright: 1.1 }); } });
    // portail : étincelles dorées autour de l'arche
    V.vortexT = (V.vortexT || 0) + dt;
    if (Math.random() < dt * 10) { const a = Math.random() * Math.PI, r = 2.4 + Math.random() * 0.6, s = Math.sin(V.portalRot * DEG), c = Math.cos(V.portalRot * DEG), lx = Math.cos(a) * r; V.fx.spark(_t.set(V.portalPos.x + lx * c, 5.2 + Math.sin(a) * r, V.portalPos.z - lx * s), _c.set(s * 1.2, 0.4, c * 1.2), { color: 0xffd76a, life: 0.9, size: 0.25 }); }
    // les étiquettes s'effacent quand la caméra passe tout près (sinon on voit des lettres géantes)
    V.spots.forEach(s => { if (!s.label) return; s.label.position.y = s.h + Math.sin(V.t * 2 + s.p[0]) * 0.08; const d = V.cam.position.distanceTo(s.label.position); s.label.material.opacity = BR.clamp((d - 3.5) / 4, 0, 1) * BR.clamp((60 - d) / 15, 0, 1); s.label.visible = d > 3.5 && d < 60; });
    // lieu le plus proche : carte d'action
    let near = null, bd = 1e9; for (const s of V.spots) { if (s.minY != null && V.pos.y < s.minY) continue; const d = Math.hypot(V.pos.x - s.p[0], V.pos.z - s.p[1]); if (d < s.r && d < bd) { bd = d; near = s; } }
    if (near !== V.near) { V.near = near; showPrompt(near); }
    // caméra (suit le joueur, reste au-dessus du sol, ne traverse pas les maisons)
    const tgt = _t.copy(V.pos).add(_c.set(0, 1.6, 0)), pc = V.pitch;
    let dist = V.dist;
    const nearTree = V.TR && Math.hypot(V.pos.x - V.TR.T[0], V.pos.z - V.TR.T[1]) < 40;
    for (let s = 1.2; s <= V.dist; s += 0.4) {
      const x = tgt.x - F.x * s * Math.cos(pc), z = tgt.z - F.z * s * Math.cos(pc), yy = tgt.y + s * Math.sin(pc);
      if ((yy < 9 && insideCol(x, z, V.camCols, 0.25, true)) || (nearTree && insideSolid(x, yy, z, 0.3))) { dist = Math.max(1.2, s - 0.5); break; }
    }
    V.camD = V.camD == null ? dist : V.camD + (dist - V.camD) * Math.min(1, dt * (dist < V.camD ? 12 : 3));
    const camP = new V3(tgt.x - F.x * V.camD * Math.cos(pc), tgt.y + V.camD * Math.sin(pc), tgt.z - F.z * V.camD * Math.cos(pc));
    camP.y = Math.max(camP.y, groundBase(camP.x, camP.z) + 0.35);
    if (!V.camP) V.camP = camP.clone(); V.camP.lerp(camP, Math.min(1, dt * 10));
    // ombres : la lumière du soleil suit le joueur (utile dans l'arbre)
    if (V.env.key) { const kx = Math.round(V.pos.x / 4) * 4, ky = Math.round(V.pos.y / 4) * 4, kz = Math.round(V.pos.z / 4) * 4; if (kx !== V.kx || ky !== V.ky || kz !== V.kz) { V.kx = kx; V.ky = ky; V.kz = kz; V.env.key.target.position.set(kx, ky, kz); V.env.key.target.updateMatrixWorld(); V.env.key.position.copy(V.sunDir).multiplyScalar(90).add(V.env.key.target.position); } }
    V.cam.position.copy(V.camP); V.cam.lookAt(tgt);
    if (V.flies) V.flies.uniforms.uScale.value = innerHeight * 0.9;
    if (V.halos) V.halos.uniforms.uScale.value = innerHeight * 0.9;
    V.env.update(dt, V.fx); V.fx.update(dt, dt);
    if (V.scene.userData.petals) V.scene.userData.petals.update(dt);
    V.R.info.reset();
    if (V.post) V.post.render(dt); else V.R.render(V.scene, V.cam);
    V.calls = V.R.info.render.calls;
    V.mapT = (V.mapT || 0) - dt; if (V.map && V.mapT <= 0) { V.mapT = 1 / 20; drawMap(); }
    if (V.diag) diagTick(dt, mv);
  }
  function showPrompt(sp) {
    const el = V.root.querySelector('.vil-prompt'); if (!el) return;
    if (!sp) { el.classList.remove('on'); return; }
    const extra = sp.id === 'board' ? '<span><b>E</b> créer un salon privé · <b>R</b> rejoindre un salon</span>' : sp.id === 'obelisk' ? '<span><b>E</b> palier suivant</span>' : `<span><b>E</b> ${sp.s.toLowerCase()}</span>`;
    el.innerHTML = `<div class="ap-card small" style="--rc:${sp.col}"><div class="ap-b"><b>${sp.n}</b><p>${extra}</p></div></div>`;
    el.classList.add('on');
    el.onclick = () => act();
  }
})();

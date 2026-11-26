/* ===== arena/maps/grotte.js : thème de la carte « La Grotte aux Cristaux » (niveau 1) — voir README-CARTES.md =====
   Une vraie caverne : parois organiques qui se referment en voûte (aucun mur droit), stalactites, stalagmites,
   cristaux et champignons géants lumineux, ruisseau, cascade, racines, terrasses rocheuses sur le pourtour,
   boyaux de roche entre les salles, galeries sombres et grande ouverture vers une caverne lointaine.
   Tout est fusionné en quelques maillages à couleurs de sommets (style KayKit, pas de texture) :
     shell (parois, sol, voûte), rock (rochers, cristaux… : ombres), soft (champignons, racines), glow (lumineux),
     add (halos et rayons, additifs), water (eau).
   La lumière des cristaux est « cuite » dans les sommets (attribut bake, ajouté à l'émission du matériau),
   en plus des sources B.spot (la réserve fixe de lampes du moteur). Modèles Blender : outils/blender-map-grotte.py. */
(function () {
  const BR = window.BR, DG = BR && BR.Dungeon; if (!DG || !DG.api) return;
  DG.THEMES = DG.THEMES || {};
  const A = DG.api, L = A.L, V3 = THREE.Vector3, TAU = Math.PI * 2, norm2 = A.norm2;
  const M = DG.mapOf('grotte');

  /* =====================================================================
     AMBIANCES : étages 1-5 grotte de cristal bleue, 6-10 grotte aux champignons verte, 11+ profondeurs ambrées
     (les clés du moteur sont gardées ; rk/fl/mos/crys/cap/stem/gill/wat/root/shaft sont propres à ce thème)
     ===================================================================== */
  M.exp = 1.22;
  M.tiers = [
    { n: 'Les Galeries de cristal', stone: '#6a6660', mortar: '#26231f', floor: '#5c544a', trim: '#8a8478', wood: '#5a3c22', metal: '#3a3a42', accent: '#6ad8ff', banner: '#2a5a7a', moss: 0.55, glow: '#5ad1ff',
      sky: ['#03060b', '#060a12', '#0a1220'], fog: ['#0a1222', 0.0085], hemi: ['#7f9cc8', '#6a4a30', 1.1], moon: ['#bcd8ff', 0.35],
      rk: ['#2a2838', '#57566e', '#8e8aa2'], fl: ['#6a5440', '#8e7454'], mos: '#5f9a5c', crys: ['#4fd0ff', '#38f0cc', '#a47cff'], cap: ['#3fa4d0', '#7c66ee'],
      stem: '#e6dccb', gill: '#8af2ff', wat: '#2c86a8', root: '#7a5e42', shaft: '#bfe4ff', mush: 3, crysN: 12 },
    { n: 'La Grotte aux champignons', stone: '#5e6452', mortar: '#1e2218', floor: '#4e5240', trim: '#848a70', wood: '#4a3420', metal: '#38403a', accent: '#8affb0', banner: '#2a6a3a', moss: 0.8, glow: '#7affb8',
      sky: ['#030805', '#061009', '#0a1a10'], fog: ['#0a1610', 0.009], hemi: ['#9cb4b2', '#5a4228', 1.1], moon: ['#d0ffd0', 0.35],
      rk: ['#2a2a2a', '#58564c', '#8e8a74'], fl: ['#5e4a34', '#806646'], mos: '#6fb04c', crys: ['#a77bff', '#62ffb4', '#ff7ad6'], cap: ['#e0509e', '#40d0a4', '#f0a63a'],
      stem: '#ece4cf', gill: '#c4ff8a', wat: '#2f8a72', root: '#76603e', shaft: '#f0ffd0', mush: 9, crysN: 8 },
    { n: 'Les Profondeurs ardentes', stone: '#5a4038', mortar: '#1c100c', floor: '#43302a', trim: '#8a6a58', wood: '#4a2a1a', metal: '#3a302c', accent: '#ffb04a', banner: '#7a3a12', moss: 0.12, glow: '#ffa040',
      sky: ['#070302', '#0e0604', '#1a0c06'], fog: ['#170c08', 0.0095], hemi: ['#9a8aa8', '#4a2616', 1.15], moon: ['#ffc890', 0.35],
      rk: ['#2a1a1c', '#5a3c3a', '#93705e'], fl: ['#56402c', '#78583a'], mos: '#8a7a3a', crys: ['#ff9418', '#ff4a1a', '#ffbe2a'], cap: ['#ff8a3a', '#c8502a'],
      stem: '#e8d2b4', gill: '#ffc46a', wat: '#3a5a6a', root: '#6a4430', shaft: null, mush: 2, crysN: 13 },
  ];

  /* ---------- couleurs (linéaires), mises en cache par ambiance ---------- */
  const CC = {}, LIN = {};
  const lin = h => LIN[h] || (LIN[h] = (c => [c.r, c.g, c.b])(L(h)));
  function cols(P) {
    if (CC[P.id]) return CC[P.id];
    return (CC[P.id] = { rk: P.rk.map(lin), fl: P.fl.map(lin), mos: lin(P.mos), crys: P.crys.map(lin), cap: P.cap.map(lin), stem: lin(P.stem), gill: lin(P.gill), wat: lin(P.wat), root: lin(P.root), shaft: P.shaft ? lin(P.shaft) : null });
  }

  /* ---------- bruit déterministe (entiers : identique chez tous les joueurs) ---------- */
  function hashI(i, j, k, s) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(k | 0, 1440670441) + Math.imul(s | 0, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const sm = t => t * t * (3 - 2 * t), c01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
  function noise3(x, y, z, s) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
    const h = (a, b, c) => hashI(ix + a, iy + b, iz + c, s);
    const l = (a, b, t) => a + (b - a) * t;
    const v = l(l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy), l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy), fz);
    return v * 2 - 1;
  }
  const fbm = (x, y, z, s) => noise3(x, y, z, s) * 0.68 + noise3(x * 2.3 + 17, y * 2.3, z * 2.3, s + 7) * 0.32;

  /* ---------- matériau « cuit » : la lumière stockée dans les sommets s'ajoute à l'émission ---------- */
  function bakeMat(flat, rough) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: flat, roughness: rough, metalness: 0 });
    m.userData.bake = true;
    m.onBeforeCompile = sh => {
      sh.vertexShader = 'attribute vec3 bake;\nvarying vec3 vBake;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBake = bake;');
      sh.fragmentShader = 'varying vec3 vBake;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vBake * diffuseColor.rgb;');
    };
    m.customProgramCacheKey = () => 'grotteBake' + (flat ? 'F' : 'S');
    return m;
  }

  /* ---------- modèles Blender : géométrie par matériau, gardée en cache (jamais libérée) ---------- */
  const PARTS = {};
  function modelParts(key) {
    if (PARTS[key]) return PARTS[key];
    const sc = A.model('map_grotte_' + key); if (!sc) return null;
    sc.updateMatrixWorld(true); const by = {};
    sc.traverse(o => {
      if (!o.isMesh) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      const n = ((mat && mat.name) || 'rock').replace(/\.\d+$/, '');
      (by[n] = by[n] || []).push(g);
    });
    const out = Object.keys(by).map(n => { const g = by[n].length === 1 ? by[n][0] : A.mergeGeos(by[n], 4); g.computeBoundingBox(); g.userData.keep = true; return { mat: n, geo: g }; });
    return (PARTS[key] = out);
  }
  // secours si les modèles manquent : formes simples
  const FB = {};
  function fallbackParts(key) {
    if (FB[key]) return FB[key];
    const P = [], add = (mat, g) => { g = g.index ? g.toNonIndexed() : g; g.computeBoundingBox(); g.userData.keep = true; P.push({ mat, geo: g }); };
    const T = (g, x, y, z, sx, sy, sz, rx, rz) => { g.scale(sx, sy, sz); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; };
    if (key.startsWith('cristal')) { add('rock', T(new THREE.DodecahedronGeometry(1, 0), 0, 0.1, 0, 1.2, 0.4, 1.1)); const cs = []; for (let i = 0; i < 5; i++) { const a = i * 1.3; cs.push(T(new THREE.OctahedronGeometry(0.4, 0), Math.cos(a) * 0.5 * (i ? 1 : 0), 1, Math.sin(a) * 0.5 * (i ? 1 : 0), 0.7, i ? 2.2 : 3.4, 0.7, i ? 0.4 : 0, i ? 0.3 : 0)); } add('crys', A.mergeGeos(cs.map(g => g.toNonIndexed()), 4)); }
    else if (key.startsWith('champi')) { add('stem', T(new THREE.CylinderGeometry(0.35, 0.5, 4, 8), 0, 2, 0, 1, 1, 1)); add('cap', T(new THREE.SphereGeometry(2, 12, 6, 0, TAU, 0, Math.PI / 2), 0, 3.9, 0, 1, 0.5, 1)); add('gill', T(new THREE.CylinderGeometry(1.9, 1.9, 0.1, 12), 0, 3.85, 0, 1, 1, 1)); }
    else if (key.startsWith('stalag')) add('rock', T(new THREE.ConeGeometry(1, 4.2, 7), 0, 2.1, 0, 1, 1, 1));
    else add('rock', T(new THREE.DodecahedronGeometry(1, 0), 0, 0.55, 0, 1.3, 0.8, 1.1));
    return (FB[key] = P);
  }

  /* ---------- textures partagées (jamais libérées) ---------- */
  const TX = {};
  function floorTex(P) {
    const key = 'gf' + P.id; if (TX[key]) return TX[key];
    const r = A.rnd(23), c = A.cv(256, (g, n) => {
      g.fillStyle = P.fl[0]; g.fillRect(0, 0, n, n);
      const b = new THREE.Color(P.fl[1]), a = new THREE.Color(P.fl[0]);
      // grandes plaques de terre plus claire (facettes franches), quelques cailloux discrets
      for (let i = 0; i < 26; i++) {
        const cc = b.clone().lerp(a, r() * 0.6).multiplyScalar(0.92 + r() * 0.14), x = r() * n, y = r() * n, rr = 18 + r() * 40, k = 5 + Math.floor(r() * 3);
        g.fillStyle = '#' + cc.getHexString(); g.globalAlpha = 0.55 + r() * 0.35;
        for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) { g.beginPath(); for (let j = 0; j < k; j++) { const t = j / k * 6.283 + r() * 0.5, q = rr * (0.7 + r() * 0.4); j ? g.lineTo(x + dx + Math.cos(t) * q, y + dy + Math.sin(t) * q) : g.moveTo(x + dx + Math.cos(t) * q, y + dy + Math.sin(t) * q); } g.closePath(); g.fill(); }
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 30; i++) { const cc = b.clone().multiplyScalar(1.0 + r() * 0.2); g.fillStyle = '#' + cc.getHexString(); g.beginPath(); g.ellipse(r() * n, r() * n, 1.5 + r() * 3, 1 + r() * 2, r() * 3, 0, 7); g.fill(); }
    });
    return (TX[key] = A.mkTex(c));
  }
  function rippleTex() {
    if (TX.rip) return TX.rip;
    const r = A.rnd(5), c = A.cv(128, (g, n) => {
      g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, n, n); g.lineCap = 'round';
      for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(255,255,255,${0.25 + r() * 0.4})`; g.lineWidth = 1 + r() * 2; let x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += 8 + r() * 14; y += (r() - 0.5) * 8; g.lineTo(x, y); } g.stroke(); }
    });
    return (TX.rip = A.mkTex(c));
  }
  function fallTex() {
    if (TX.fall) return TX.fall;
    const r = A.rnd(9), c = A.cv(64, (g, n, h) => {
      g.clearRect(0, 0, n, h); g.fillStyle = 'rgba(150,175,195,0.42)'; g.fillRect(0, 0, n, h);
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.6})`; const x = Math.floor(r() * n), y = r() * h, l = 10 + r() * 40, w = 1 + Math.floor(r() * 3); g.fillRect(x, y, w, l); if (y + l > h) g.fillRect(x, y - h, w, l); }
    }, 128);
    const t = A.mkTex(c); t.repeat.set(1.5, 1.2);
    return (TX.fall = t);
  }

  /* =====================================================================
     LE KIT : accumule les triangles (couleurs de sommets), les lumières cuites, puis construit les maillages
     ===================================================================== */
  const ICO = [new THREE.IcosahedronGeometry(1, 1), new THREE.IcosahedronGeometry(1, 2)]; ICO.forEach(g => { g.userData.keep = true; });
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); CYL.translate(0, 0.5, 0); CYL.userData.keep = true;
  const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _u = new V3(), _y = new V3(0, 1, 0);
  function Kit(B) {
    const P = B.P, C = cols(P), seed = (((B.room && B.room.seed) || 7) % 99991) + 13;
    const tier = +(String(P.id).slice(-1)) || 0;
    const K = { B, P, C, seed, tier, bk: {}, lights: [], wet: [], occ: [], views: [], ci: 0, filt: 0 };
    const OUT = [0, 0, 0], T = new Float32Array(9), LY = [0, 0, 0], NN = new Float32Array(9);
    K.rnd = () => B.rnd();
    K.crysIdx = () => (K.ci++) % P.crys.length;
    // couleur des cristaux par zone (les lumières voisines ont la même teinte : des ambiances nettes, pas un mélange blanchâtre)
    K.zoneOff = Math.floor(hashI(seed, 1, 2, 3) * 6);
    K.zone = (x, z) => K.rect ? Math.floor((z + 300) / 11) % P.crys.length : (Math.floor((Math.atan2(x, z) / TAU + 1) * 6) + K.zoneOff) % P.crys.length;
    function push(name, colFn, smooth) {
      const b = K.bk[name] || (K.bk[name] = { p: [], n: [], c: [] });
      const ux = T[3] - T[0], uy = T[4] - T[1], uz = T[5] - T[2], vx = T[6] - T[0], vy = T[7] - T[1], vz = T[8] - T[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-7) return;
      nx /= l; ny /= l; nz /= l;
      const fh = hashI(Math.round((T[0] + T[3] + T[6]) * 5), Math.round((T[1] + T[4] + T[7]) * 5), Math.round((T[2] + T[5] + T[8]) * 5), 11);
      for (let k = 0; k < 3; k++) {
        const x = T[k * 3], y = T[k * 3 + 1], z = T[k * 3 + 2];
        b.p.push(x, y, z);
        if (smooth) b.n.push(NN[k * 3], NN[k * 3 + 1], NN[k * 3 + 2]); else b.n.push(nx, ny, nz);
        colFn(OUT, x, y, z, nx, ny, nz, fh, LY[k]); b.c.push(OUT[0], OUT[1], OUT[2]);
      }
    }
    /** triangle (sommets [x,y,z]) orienté vers le point ref (intérieur de la paroi) */
    K.tri = function (name, a, b, c, colFn, ref, ly) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      let p = [a, b, c];
      if (ref && nx * (ref[0] - a[0]) + ny * (ref[1] - a[1]) + nz * (ref[2] - a[2]) < 0) p = [a, c, b];
      for (let k = 0; k < 3; k++) { T[k * 3] = p[k][0]; T[k * 3 + 1] = p[k][1]; T[k * 3 + 2] = p[k][2]; LY[k] = ly ? ly[k] : 0; }
      push(name, colFn, false);
    };
    K.quad = function (name, a, b, c, d, colFn, ref) { K.tri(name, a, b, c, colFn, ref); K.tri(name, a, c, d, colFn, ref); };
    /** géométrie Three.js transformée par m4 */
    K.geo = function (name, geo, m4, colFn, smooth) {
      const pa = geo.attributes.position, na = geo.attributes.normal, ix = geo.index, n = ix ? ix.count : pa.count, e = m4.elements;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const y0 = geo.boundingBox.min.y, yh = Math.max(1e-6, geo.boundingBox.max.y - y0);
      for (let t = 0; t + 2 < n; t += 3) {
        for (let k = 0; k < 3; k++) {
          const i = ix ? ix.getX(t + k) : t + k, x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
          T[k * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; T[k * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; T[k * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          LY[k] = (y - y0) / yh;
          if (smooth && na) { const a = na.getX(i), b = na.getY(i), c = na.getZ(i); let qx = e[0] * a + e[4] * b + e[8] * c, qy = e[1] * a + e[5] * b + e[9] * c, qz = e[2] * a + e[6] * b + e[10] * c; const l = Math.hypot(qx, qy, qz) || 1; NN[k * 3] = qx / l; NN[k * 3 + 1] = qy / l; NN[k * 3 + 2] = qz / l; }
        }
        push(name, colFn, smooth && !!na);
      }
    };
    K.mat4 = function (x, y, z, o) { _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e); const s = o.s || 1; _s.set(s * (o.sx || 1), s * (o.sy || 1), s * (o.sz || 1)); _p.set(x, y, z); return _m.compose(_p, _q, _s); };

    /* ---------- couleurs ---------- */
    // roche : dégradé (sombre en bas, claire en haut), strates, facettes, mousse sur le dessus, pied sombre
    K.rockFn = function (o) {
      o = o || {}; const d = C.rk[0], m = C.rk[1], l = C.rk[2], mos = C.mos, ma = (P.moss || 0) * (o.moss == null ? 1 : o.moss), y0 = o.y0 || 0, yh = o.yh || 10, k0 = o.k || 1;
      return (out, x, y, z, nx, ny, nz, fh, ly) => {
        let t = o.tf ? o.tf(x, y, z, ly) : o.ly ? ly : (y - y0) / yh; t = c01(t);
        let r, g, b;
        if (t < 0.5) { const k = t * 2; r = d[0] + (m[0] - d[0]) * k; g = d[1] + (m[1] - d[1]) * k; b = d[2] + (m[2] - d[2]) * k; }
        else { const k = t * 2 - 1; r = m[0] + (l[0] - m[0]) * k; g = m[1] + (l[1] - m[1]) * k; b = m[2] + (l[2] - m[2]) * k; }
        const band = hashI(Math.floor(y * 0.6 + noise3(x * 0.05, 0.5, z * 0.05, seed) * 1.6), 3, 5, seed);
        const f = (0.86 + 0.2 * fh) * (0.9 + 0.2 * band) * k0;
        r *= f; g *= f; b *= f;
        if (ma > 0 && ny > 0.4) { const pm = c01((ny - 0.4) * 2.4) * ma * c01(0.45 + noise3(x * 0.35, y * 0.35, z * 0.35, seed + 5) * 0.9); r += (mos[0] - r) * pm; g += (mos[1] - g) * pm; b += (mos[2] - b) * pm; }
        if (o.ao !== false && !o.ly) { const k2 = 0.6 + 0.4 * c01(y / 1.5); r *= k2; g *= k2; b *= k2; }
        if (o.dark) { const k3 = o.dark(x, y, z); r *= k3; g *= k3; b *= k3; }
        out[0] = r; out[1] = g; out[2] = b;
      };
    };
    K.rockProp = K.rockFn({ ly: true });
    // cristal : facettes plus ou moins claires, pointe presque blanche (le bloom les fait rayonner)
    K.glowFn = (col, I) => (out, x, y, z, nx, ny, nz, fh, ly) => {
      const k = I * (0.45 + 0.6 * ly) * (0.7 + 0.6 * fh), w = ly * ly * ly * 0.3;
      out[0] = (col[0] * (1 - w) + w) * k; out[1] = (col[1] * (1 - w) + w) * k; out[2] = (col[2] * (1 - w) + w) * k;
    };
    K.softFn = (col, lo) => (out, x, y, z, nx, ny, nz, fh, ly) => { const k = (lo + (1 - lo) * ly) * (0.94 + 0.12 * fh); out[0] = col[0] * k; out[1] = col[1] * k; out[2] = col[2] * k; };
    K.flat = col => (out) => { out[0] = col[0]; out[1] = col[1]; out[2] = col[2]; };

    /* ---------- modèles ---------- */
    K.model = function (key, x, y, z, o) {
      o = o || {}; const parts = modelParts(key) || fallbackParts(key), m4 = K.mat4(x, y, z, o);
      const ccol = o.col != null ? C.crys[o.col] : C.crys[0], gcol = o.gcol || C.gill;
      for (const pt of parts) {
        const n = pt.mat;
        if (n.startsWith('crys')) K.geo('glow', pt.geo, m4, K.glowFn(ccol, (o.gi || 2.1) * 0.72));
        else if (n.startsWith('gill')) K.geo('glow', pt.geo, m4, K.glowFn(gcol, o.gli || 1.6));
        else if (n.startsWith('spot')) K.geo('glow', pt.geo, m4, K.glowFn(gcol, (o.gli || 1.6) * 0.9));
        else if (n.startsWith('stem')) K.geo('soft', pt.geo, m4, K.softFn(C.stem, 0.5), true);
        else if (n.startsWith('cap')) K.geo('soft', pt.geo, m4, K.softFn(o.cap || C.cap[0], 0.45), true);
        else K.geo(o.bucket || 'rock', pt.geo, m4, o.rf || K.rockProp);
      }
    };

    /* ---------- primitives procédurales ---------- */
    // bloc de roche bosselé (icosaèdre déformé) ; o.minY : dessous plat (monde) ; o.maxLZ : face avant plate (repère local)
    K.blob = function (name, x, y, z, sx, sy, sz, ry, o) {
      o = o || {}; const g = ICO[o.det || 0], pa = g.attributes.position, c = Math.cos(ry || 0), sn = Math.sin(ry || 0), j = o.j == null ? 0.24 : o.j;
      const s0 = seed + (o.salt || 0) + ((x * 13.1 + z * 7.3) | 0), rf = o.rf || K.rockFn({ ly: true, moss: o.moss });
      for (let t = 0; t < pa.count; t += 3) {
        for (let k = 0; k < 3; k++) {
          const px = pa.getX(t + k), py = pa.getY(t + k), pz = pa.getZ(t + k);
          const nn = noise3(px * 1.4 + 3, py * 1.4, pz * 1.4, s0), f = 1 + (o.out ? Math.max(0, nn) : nn) * j;
          let lx = px * f * sx, ly = py * f * sy, lz = pz * f * sz;
          if (o.maxLZ != null && lz > o.maxLZ) lz = o.maxLZ;
          if (o.minY != null && y + ly < o.minY) ly = o.minY - y;
          if (o.maxY != null && y + ly > o.maxY) ly = o.maxY - y;
          T[k * 3] = x + lx * c + lz * sn; T[k * 3 + 1] = y + ly; T[k * 3 + 2] = z - lx * sn + lz * c; LY[k] = py * 0.5 + 0.5;
        }
        push(name, rf, false);
      }
    };
    // pointe (stalactite dir = -1, stalagmite dir = +1) : couronnes irrégulières
    K.spike = function (name, x, y, z, h, r, dir, o) {
      o = o || {}; const n = 6, ts = [0, 0.3, 0.62, 1], rs = [1, 0.62, 0.3, 0], rings = [];
      const s0 = (x * 31.7 + z * 17.3) | 0, lx = (hashI(s0, 1, 0, seed) - 0.5) * h * 0.12, lz = (hashI(s0, 2, 0, seed) - 0.5) * h * 0.12;
      for (let j = 0; j < ts.length; j++) {
        const ring = [], yy = y + dir * (ts[j] * h - (j === 0 ? 0.8 : 0));
        if (rs[j] === 0) { ring.push([x + lx, yy, z + lz]); rings.push(ring); continue; }
        for (let k = 0; k < n; k++) { const a = (k + j * 0.5) / n * TAU, q = r * rs[j] * (0.8 + 0.4 * hashI(s0, j, k, seed)); ring.push([x + Math.cos(a) * q + lx * ts[j] * ts[j], yy, z + Math.sin(a) * q + lz * ts[j] * ts[j]]); }
        rings.push(ring);
      }
      const rf = o.rf || K.rockFn({ ly: true, moss: dir > 0 ? 0.6 : 0 });
      for (let j = 0; j < rings.length - 1; j++) {
        const A0 = rings[j], A1 = rings[j + 1], ly0 = dir > 0 ? ts[j] : 1 - ts[j] * 0.7, ly1 = dir > 0 ? ts[j + 1] : 1 - ts[j + 1] * 0.7;
        for (let k = 0; k < n; k++) {
          const k2 = (k + 1) % n, ref = [x, A0[k][1], z];
          if (A1.length === 1) { K.tri(name, A0[k], A0[k2], A1[0], rf, null, [ly0, ly0, ly1]); fixOut(name, ref); }
          else { K.tri(name, A0[k], A0[k2], A1[k2], rf, null, [ly0, ly0, ly1]); fixOut(name, ref); K.tri(name, A0[k], A1[k2], A1[k], rf, null, [ly0, ly1, ly1]); fixOut(name, ref); }
        }
      }
    };
    // retourne le dernier triangle s'il regarde vers ref (on veut des normales vers l'extérieur)
    function fixOut(name, ref) {
      const b = K.bk[name]; if (!b) return; const i = b.p.length - 9; if (i < 0) return;
      const p = b.p, nx = b.n[i], ny = b.n[i + 1], nz = b.n[i + 2];
      if (nx * (ref[0] - p[i]) + ny * (ref[1] - p[i + 1]) + nz * (ref[2] - p[i + 2]) <= 0) return;
      for (let a = 0; a < 3; a++) { const t1 = p[i + 3 + a]; p[i + 3 + a] = p[i + 6 + a]; p[i + 6 + a] = t1; const t2 = b.c[i + 3 + a]; b.c[i + 3 + a] = b.c[i + 6 + a]; b.c[i + 6 + a] = t2; }
      for (let a = 0; a < 9; a++) b.n[i + a] = -b.n[i + a];
    }
    K.fixOut = fixOut;
    // colonne (tour) : profil de rayon rf(t) entre y0 et y1, déformé
    K.lathe = function (name, x, z, y0, y1, rfun, n, rf) {
      const rows = 12, s0 = (x * 11 + z * 5) | 0, G = [];
      for (let j = 0; j <= rows; j++) {
        const t = j / rows, y = y0 + (y1 - y0) * t, r = rfun(t), ring = [];
        for (let k = 0; k < n; k++) { const a = (k + (j % 2) * 0.5) / n * TAU, q = r * (0.86 + 0.28 * hashI(s0, j, k, seed)) + noise3(Math.cos(a) * 2, y * 0.3, Math.sin(a) * 2, seed + s0) * r * 0.15; ring.push([x + Math.sin(a) * q, y, z + Math.cos(a) * q]); }
        G.push(ring);
      }
      for (let j = 0; j < rows; j++) for (let k = 0; k < n; k++) {
        const k2 = (k + 1) % n, yA = G[j][k][1];
        K.tri(name, G[j][k], G[j][k2], G[j + 1][k2], rf, null); fixOut(name, [x, yA, z]);
        K.tri(name, G[j][k], G[j + 1][k2], G[j + 1][k], rf, null); fixOut(name, [x, yA, z]);
      }
    };
    // dalle / terrasse : prisme irrégulier, dessus plat en y = top (on peut marcher dessus)
    K.slab = function (x, z, r, top, o) {
      o = o || {}; const n = 9, s0 = (x * 7 + z * 3) | 0, rings = [], hs = [top, top - 0.32, top * 0.5, -0.4], ks = [0.95, 1.04, 1.08, 1.14];
      const rk = []; for (let k = 0; k < n; k++) rk.push(0.92 + 0.14 * hashI(s0, k, 1, seed));
      for (let j = 0; j < hs.length; j++) { const ring = []; for (let k = 0; k < n; k++) { const a = (k + 0.2 * hashI(s0, k, 2, seed)) / n * TAU + (o.a0 || 0), q = r * rk[k] * ks[j] + (j === 2 ? (hashI(s0, k, 3, seed) - 0.3) * 0.4 : 0); ring.push([x + Math.sin(a) * q, hs[j], z + Math.cos(a) * q]); } rings.push(ring); }
      const rf = K.rockFn({ y0: -0.5, yh: top + 1.2, ao: false, moss: o.moss == null ? 1 : o.moss }), ctr = [x, top, z];
      for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; K.tri('rock', ctr, rings[0][k], rings[0][k2], rf, [x, top + 5, z]); }
      for (let j = 0; j < hs.length - 1; j++) for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; K.tri('rock', rings[j][k], rings[j][k2], rings[j + 1][k2], rf, null); fixOut('rock', [x, hs[j + 1], z]); K.tri('rock', rings[j][k], rings[j + 1][k2], rings[j + 1][k], rf, null); fixOut('rock', [x, hs[j + 1], z]); }
      B.cyl(x, z, r * 0.95, -1, top);
      if (o.obstacle !== false) B.obstacles.push({ x, z, r: r * 0.95, h: top - 0.15 });
      K.occ.push({ x, z, r: r * 1.05 });
    };
    // racine pendante (chaîne de cylindres) ; bulbe lumineux au bout
    K.root = function (x, y, z, len, o) {
      o = o || {}; const n = Math.max(3, Math.round(len / 1.1)), s0 = (x * 9 + z * 13) | 0, col = K.softFn(C.root, 0.65);
      let px = x, py = y, pz = z, r = o.r || 0.17;
      for (let i = 0; i < n; i++) {
        const dx = (hashI(s0, i, 1, seed) - 0.5) * 0.9 + (o.dx || 0), dz = (hashI(s0, i, 2, seed) - 0.5) * 0.9 + (o.dz || 0), dy = -len / n;
        const l = Math.hypot(dx, dy, dz); _u.set(dx / l, dy / l, dz / l); _q.setFromUnitVectors(_y, _u); _s.set(r, l * 1.04, r); _p.set(px, py, pz); _m.compose(_p, _q, _s);
        K.geo('soft', CYL, _m, col, true);
        px += dx; py += dy; pz += dz; r = Math.max(0.045, r * 0.82);
      }
      if (o.bulb) { K.blob('glow', px, py - 0.12, pz, 0.16, 0.22, 0.16, 0, { rf: K.glowFn(o.bulb, 1.8), j: 0.1 }); }
    };
    // place libre ?
    K.free = (x, z, r) => K.occ.every(q => (q.x - x) * (q.x - x) + (q.z - z) * (q.z - z) > (q.r + r) * (q.r + r));
    K.take = (x, z, r) => { K.occ.push({ x, z, r }); };

    /* ---------- lumières : cuites (bake) + source pour la réserve de lampes du moteur ---------- */
    K.light = function (x, y, z, hex, I, rad, spot) {
      K.lights.push({ x, y, z, c: lin(hex), I, rad, r2: rad * rad });
      if (spot) B.spot(x, y, z, hex, (spot.base || 2) * 0.72, { dist: spot.dist || 15 });
    };

    /* ---------- eau (ruisseau, flaques), halos additifs ---------- */
    K.pool = function (x, z, r, o) {   // flaque : disque irrégulier
      o = o || {}; const n = 14, s0 = (x * 5 + z * 3) | 0, y = 0.04, ctr = [x, y, z], pts = [];
      for (let k = 0; k < n; k++) { const a = k / n * TAU, q = r * (0.75 + 0.4 * hashI(s0, k, 4, seed)); pts.push([x + Math.sin(a) * q, y, z + Math.cos(a) * q]); }
      for (let k = 0; k < n; k++) K.tri('water', ctr, pts[k], pts[(k + 1) % n], K.flat([1, 1, 1]), [x, 5, z]);
      K.wet.push({ t: 'c', x, z, r: r * 1.05 });
    };
    K.stream = function (pts) {   // ruban d'eau [x, z, largeur, y]
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, z0, w0, y0] = pts[i], [x1, z1, w1, y1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        const a = [x0 + nx * w0, (y0 || 0) + 0.045, z0 + nz * w0], b = [x0 - nx * w0, (y0 || 0) + 0.045, z0 - nz * w0], c = [x1 - nx * w1, (y1 || 0) + 0.045, z1 - nz * w1], d = [x1 + nx * w1, (y1 || 0) + 0.045, z1 + nz * w1];
        K.quad('water', a, b, c, d, K.flat([1, 1, 1]), [x0, 10, z0]);
        K.wet.push({ t: 's', x0, z0, x1, z1, w: Math.max(w0, w1) + 0.25 });
      }
    };
    K.wetAt = function (x, z) {
      let best = 0;
      for (const w of K.wet) {
        let d;
        if (w.t === 'c') d = Math.hypot(x - w.x, z - w.z) - w.r;
        else { const vx = w.x1 - w.x0, vz = w.z1 - w.z0, t = c01(((x - w.x0) * vx + (z - w.z0) * vz) / (vx * vx + vz * vz || 1)); d = Math.hypot(x - w.x0 - vx * t, z - w.z0 - vz * t) - w.w; }
        const k = c01(1 - d / 1.6); if (k > best) best = k;
      }
      return best;
    };
    K.halo = function (x, y, z, r, hex, a) {   // halo au sol (additif) : disque dégradé
      const n = 16, c = lin(hex), ctr = [x, y, z], col0 = [c[0] * a, c[1] * a, c[2] * a], pts = [];
      for (let k = 0; k < n; k++) { const ang = k / n * TAU; pts.push([x + Math.sin(ang) * r, y, z + Math.cos(ang) * r]); }
      const f = (out, px, py, pz) => { const k = Math.hypot(px - x, pz - z) < r * 0.5 ? 1 : 0; out[0] = col0[0] * k; out[1] = col0[1] * k; out[2] = col0[2] * k; };
      for (let k = 0; k < n; k++) K.tri('add', ctr, pts[k], pts[(k + 1) % n], f, [x, y + 5, z]);
    };
    K.shaft = function (x, z, y0, y1, r0, r1, hex, a) {   // rayon de lumière (cône ouvert additif)
      const n = 18, c = lin(hex), segs = [];
      for (let k = 0; k <= n; k++) { const ang = k / n * TAU; segs.push([[x + Math.sin(ang) * r1, y0, z + Math.cos(ang) * r1], [x + Math.sin(ang) * r0, y1, z + Math.cos(ang) * r0]]); }
      const f = (out, px, py) => { const t = c01((py - y0) / (y1 - y0)), k = a * (0.25 + 0.75 * t); out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k; };
      for (let k = 0; k < n; k++) { const [a0, b0] = segs[k], [a1, b1] = segs[k + 1]; K.tri('add', a0, a1, b1, f, null); K.tri('add', a0, b1, b0, f, null); }
    };

    /* ---------- construction finale ---------- */
    function bakeOf(b) {
      const n = b.p.length / 3, out = new Float32Array(n * 3), Ls = K.lights, p = b.p, nn = b.n;
      for (let i = 0; i < n; i++) {
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2], nx = nn[i * 3], ny = nn[i * 3 + 1], nz = nn[i * 3 + 2];
        let r = 0, g = 0, bb = 0;
        for (let j = 0; j < Ls.length; j++) {
          const l = Ls[j], dx = l.x - x, dy = l.y - y, dz = l.z - z, d2 = dx * dx + dy * dy + dz * dz; if (d2 > l.r2) continue;
          const d = Math.sqrt(d2) + 1e-4, ndl = (nx * dx + ny * dy + nz * dz) / d, w0 = 1 - d / l.rad, w = w0 * w0 * (0.18 + 0.82 * (ndl > 0 ? ndl : 0)) * l.I;
          r += l.c[0] * w; g += l.c[1] * w; bb += l.c[2] * w;
        }
        out[i * 3] = Math.min(r, 2.5); out[i * 3 + 1] = Math.min(g, 2.5); out[i * 3 + 2] = Math.min(bb, 2.5);
      }
      return out;
    }
    K.build = function () {
      const geoOf = (b, bake) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
        if (bake) g.setAttribute('bake', new THREE.BufferAttribute(bakeOf(b), 3));
        g.computeBoundingSphere(); B.disposables.push(g); return g;
      };
      const mk = (name, mat, cast, o) => {
        const b = K.bk[name]; if (!b || !b.p.length) return null;
        const g = geoOf(b, !!mat.userData.bake);
        if (o && o.uv) { const n = b.p.length / 3, uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uv[i * 2] = b.p[i * 3] / 4; uv[i * 2 + 1] = b.p[i * 3 + 2] / 4; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
        const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = !(o && o.noRecv); if (o && o.order) m.renderOrder = o.order; B.g.add(m); return m;
      };
      const rockM = bakeMat(true, 0.95), softM = bakeMat(false, 0.72);
      const glowM = new THREE.MeshBasicMaterial({ vertexColors: true });
      const addM = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const w = C.wat, watM = new THREE.MeshStandardMaterial({ color: new THREE.Color(w[0], w[1], w[2]), emissive: new THREE.Color(w[0] * 0.4, w[1] * 0.4, w[2] * 0.4), map: rippleTex(), emissiveMap: rippleTex(), roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.84, depthWrite: false });
      B.disposables.push(rockM, softM, glowM, addM, watM);
      mk('shell', rockM, false); mk('rock', rockM, true); mk('soft', softM, true); mk('glow', glowM, false, { noRecv: true });
      mk('water', watM, false, { uv: true, order: 1 }); mk('add', addM, false, { noRecv: true, order: 2 });
      const rip = rippleTex(), fall = K.fallMesh ? fallTex() : null;
      B.anims.push((dt, t) => {
        glowM.color.setScalar(0.92 + Math.sin(t * 1.4) * 0.08);
        rip.offset.set(t * 0.05, t * 0.11);
        if (fall) fall.offset.y = t * 1.6;
      });
    };
    return K;
  }

  /* =====================================================================
     PAROI ORGANIQUE : anneaux au pied (distance foot(a)), qui montent puis se referment en voûte jusqu'à un pôle
     o : { foot(a), segs, Hw (haut de paroi), Ht (sommet), wall: [[y, dr], …], amp, hole(x, y, z), salt }
     ===================================================================== */
  function Shell(K, o) {
    const segs = o.segs, Hw = o.Hw, Ht = o.Ht, hv = Ht - Hw, s = K.seed + (o.salt || 0), amp = o.amp || 1.4, wall = o.wall, drTop = wall[wall.length - 1][1];
    const vf = o.vault || [0.9, 0.77, 0.62, 0.46, 0.3, 0.15];
    const S = { Hw, Ht, foot: o.foot };
    function disp(x, y, z, nx, ny, nz) {
      let d = amp * fbm(x / 7.5, y / 6, z / 7.5, s) + amp * 0.3 * noise3(x / 2.2, y / 2.2, z / 2.2, s + 3);
      if (y < 4.2 && y > -1.5) d = Math.max(d * 0.8, -0.2);
      return [x + nx * d, y + ny * d, z + nz * d];
    }
    // point de la paroi à l'angle a, hauteur y (≤ Hw) ; puis voûte (fraction f du rayon)
    S.wallAt = function (a, y) {
      let dr = wall[0][1];
      for (let i = 0; i < wall.length - 1; i++) if (y >= wall[i][0] && y <= wall[i + 1][0]) { const t = (y - wall[i][0]) / (wall[i + 1][0] - wall[i][0]); dr = wall[i][1] + (wall[i + 1][1] - wall[i][1]) * t; }
      if (y > wall[wall.length - 1][0]) dr = drTop;
      const d = o.foot(a) + dr, sx = Math.sin(a), cz = Math.cos(a);
      return disp(sx * d, y, cz * d, sx, 0, cz);
    };
    S.vaultAt = function (a, f) {
      const D = o.foot(a) + drTop, sx = Math.sin(a), cz = Math.cos(a), r = D * f, y = Hw + hv * Math.sqrt(Math.max(0, 1 - f * f));
      let gx = sx * f / D, gy = (y - Hw) / (hv * hv), gz = cz * f / D; const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
      return disp(sx * r, y, cz * r, gx, gy, gz);
    };
    S.surfAt = (a, y) => y <= Hw ? S.wallAt(a, y) : S.vaultAt(a, Math.sqrt(Math.max(0, 1 - ((y - Hw) / hv) * ((y - Hw) / hv))));
    S.ceilAt = (x, z) => { const a = Math.atan2(x, z), f = Math.min(0.97, Math.hypot(x, z) / (o.foot(a) + drTop)); return S.vaultAt(a, f); };
    // grille
    const rows = [];
    wall.forEach(([y]) => rows.push(i => S.wallAt(i, y)));
    vf.forEach(f => rows.push(i => S.vaultAt(i, f)));
    const G = rows.map((fn, j) => { const row = []; for (let i = 0; i < segs; i++) { const a = (i + (j % 2) * 0.5 + (hashI(i, j, 7, s) - 0.5) * 0.3) / segs * TAU + (o.a0 || 0); row.push(fn(a)); } return row; });
    const pole = disp(0, Ht, 0, 0, 1, 0);
    const rf = K.rockFn({ tf: (x, y) => y < 5.5 ? y / 5.5 * 0.82 : 0.82 - Math.min(0.32, (y - 5.5) / hv * 0.36), ao: true, moss: 0.8 });
    const cen = (a, b, c, d) => [(a[0] + b[0] + c[0] + (d ? d[0] : 0)) / (d ? 4 : 3), (a[1] + b[1] + c[1] + (d ? d[1] : 0)) / (d ? 4 : 3), (a[2] + b[2] + c[2] + (d ? d[2] : 0)) / (d ? 4 : 3)];
    const refOf = p => [0, Math.min(Math.max(p[1], -60), Hw * 0.6), 0];
    for (let j = 0; j < G.length - 1; j++) for (let i = 0; i < segs; i++) {
      const i2 = (i + 1) % segs, a = G[j][i], b = G[j][i2], c = G[j + 1][i2], d = G[j + 1][i], ce = cen(a, b, c, d);
      if (o.hole && o.hole(ce[0], ce[1], ce[2])) continue;
      K.quad('shell', a, b, c, d, rf, refOf(ce));
    }
    const last = G[G.length - 1];
    for (let i = 0; i < segs; i++) { const a = last[i], b = last[(i + 1) % segs]; if (o.hole && o.hole(...cen(a, b, pole))) continue; K.tri('shell', a, b, pole, rf, [0, Hw * 0.5, 0]); }
    return S;
  }

  /* ---------- boyau de roche le long d'un axe horizontal (o.x0, o.z0) + s·(o.ox, o.oz) ---------- */
  function Tube(K, o) {
    const ox = o.ox, oz = o.oz, ux = oz, uz = -ox, n = o.n || 12, s = K.seed + (o.salt || 0), ss = [];
    for (let v = o.s0; v < o.s1 - 1e-3; v += o.step) ss.push(v); ss.push(o.s1);
    const sOf = (x, z) => (x - o.x0) * ox + (z - o.z0) * oz;
    const rf = K.rockFn({ tf: (x, y) => c01(0.25 + y / 9), moss: 0.5, dark: o.dark ? (x, y, z) => o.dark(sOf(x, z)) : null });
    const R = ss.map(sv => {
      const pr = o.prof(sv), off = o.off ? o.off(sv) : 0, cx = o.x0 + ox * sv + ux * off, cz = o.z0 + oz * sv + uz * off, yc = pr.yb + (pr.top - pr.yb) * 0.4, row = [];
      for (let k = 0; k <= n; k++) {
        const ph = k / n * Math.PI, c = Math.cos(ph), sn = Math.sin(ph);
        const u = pr.hw * Math.sign(c) * Math.pow(Math.abs(c), 0.45), y = pr.yb + (pr.top - pr.yb) * Math.pow(sn, 0.75);
        let x = cx + ux * u, z = cz + uz * u;
        let nu = u, ny = (y - yc) * 0.8; const l = Math.hypot(nu, ny) || 1; nu /= l; ny /= l;
        let d = (o.amp || 0.7) * fbm(x / 3.2, y / 3.2, z / 3.2, s); if (y < 3.4) d = Math.abs(d) * 0.7;
        row.push([x + ux * nu * d, y + ny * d, z + uz * nu * d]);
      }
      return { row, ref: [cx, yc, cz], pr, cx, cz };
    });
    for (let j = 0; j < R.length - 1; j++) for (let k = 0; k < n; k++) {
      const A0 = R[j].row, A1 = R[j + 1].row, ref = [(R[j].ref[0] + R[j + 1].ref[0]) / 2, R[j].ref[1], (R[j].ref[2] + R[j + 1].ref[2]) / 2];
      K.quad('shell', A0[k], A0[k + 1], A1[k + 1], A1[k], rf, ref);
    }
    if (o.floor) for (let j = 0; j < R.length - 1; j++) {   // sol du boyau (galeries)
      const A0 = R[j].row, A1 = R[j + 1].row, fy0 = R[j].pr.yb, fy1 = R[j + 1].pr.yb;
      const a = [A0[0][0], fy0, A0[0][2]], b = [A0[n][0], fy0, A0[n][2]], c = [A1[n][0], fy1, A1[n][2]], d = [A1[0][0], fy1, A1[0][2]];
      K.quad('shell', a, b, c, d, rf, [R[j].cx, fy0 + 5, R[j].cz]);
    }
    if (o.cap) { const E = R[R.length - 1], tip = [E.cx + ox * 3, E.ref[1], E.cz + oz * 3]; for (let k = 0; k < n; k++) K.tri('shell', E.row[k], E.row[k + 1], tip, rf, E.ref); if (o.floor) K.tri('shell', [E.row[0][0], E.pr.yb, E.row[0][2]], [E.row[n][0], E.pr.yb, E.row[n][2]], tip, rf, [E.cx, E.ref[1] + 3, E.cz]); }
    return { R, sOf };
  }

  /* ---------- habillage d'une porte : boyau de roche, linteau, piliers, cristaux ---------- */
  function doorDress(K, x, z, ry, W) {
    const ox = Math.sin(ry), oz = Math.cos(ry), ux = Math.cos(ry), uz = -Math.sin(ry), hw = W / 2;
    const P3 = (u, y, s) => [x + ux * u + ox * s, y, z + uz * u + oz * s];
    Tube(K, { x0: x, z0: z, ox, oz, s0: -1.3, s1: A.CORR + 0.9, step: 1.3, n: 12, amp: 0.65, salt: Math.round(x + z),
      prof: s => ({ hw: hw + 0.62 + 0.15 * Math.sin(s * 1.3), top: 7.7 + 0.4 * Math.sin(s * 0.9 + 1), yb: -0.6 }), dark: s => 0.98 - 0.4 * c01(s / 9) });
    K.blob('shell', ...P3(0, 10.0, 0.15), hw + 3.1, 3.7, 2.5, ry, { minY: 6.5, det: 1, salt: 31 });
    for (const sd of [-1, 1]) {
      K.blob('shell', ...P3(sd * (hw + 1.8), 4.7, -0.15), 1.55, 5.4, 2.0, ry, { minY: -0.4, out: true, salt: 40 + sd });
      K.model('roc_a', ...P3(sd * (hw + 3.6), -0.1, -1.1), { s: 1.25, ry: ry + sd });
      // cristaux dans le boyau
      const s = sd > 0 ? 3.0 : 5.6, ci = K.zone(...[P3(0, 0, s)[0], P3(0, 0, s)[2]]);
      K.model('cristal_b', ...P3(sd * (hw + 0.65), 0.0, s), { s: 0.75, ry: ry - sd * Math.PI / 2, rx: 0.55, col: ci, gi: 2.2 });
      K.light(...P3(sd * (hw - 0.3), 1.6, s), K.P.crys[ci], 0.9, 6.5);
    }
    K.light(...P3(0, 4.2, 4.3), K.P.crys[K.ci % K.P.crys.length], 0.35, 9, { base: 1.4, dist: 11 });
    // le pas de la porte : quelques cailloux sur les bords
    for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, s = 1.5 + i * 1.6; K.model('roc_c', ...P3(sd * (hw + 0.1), -0.05, s), { s: 0.28 + 0.1 * (i % 3), ry: i * 1.7 }); }
  }
  // demi-largeur intérieure d'une arche de boyau (même profil que Tube) à la hauteur y
  const archHalf = (y, hw, yb, top) => { if (y <= yb || y >= top) return 0; const sn = Math.pow((y - yb) / (top - yb), 1 / 0.75); return hw * Math.pow(Math.sqrt(Math.max(0, 1 - sn * sn)), 0.45); };
  const doorHole = (x, z, ry, W) => { const ox = Math.sin(ry), oz = Math.cos(ry), ux = Math.cos(ry), uz = -Math.sin(ry); return (px, py, pz) => { const dx = px - x, dz = pz - z, u = dx * ux + dz * uz, s = dx * ox + dz * oz; return Math.abs(u) < W / 2 + 2.3 && py < 9.2 && s > -5 && s < 6; }; };

  // applique de cristal (remplace les torches du moteur) : petit amas planté dans la roche, penché vers la salle
  function sconce(K, x, y, z, ry, light) {
    const ci = K.zone(x, z), sx = Math.sin(ry), cz = Math.cos(ry);
    K.blob('rock', x - sx * 0.25, y - 1.0, z - cz * 0.25, 0.75, 0.55, 0.65, ry, { salt: 5 });
    K.model('cristal_b', x, y - 0.95, z, { s: 0.85, ry, rx: 0.8, col: ci, gi: 2.4 });
    K.light(x + sx * 0.8, y - 0.2, z + cz * 0.8, K.P.crys[ci], 1.0, 10, light ? { base: 2.3, dist: 15 } : null);
  }

  /* ---------- anneau de solides (on reste dans la salle), sauf devant les portes ---------- */
  function ringSolids(B, R, dr, rr, gapX) {
    const d = R + dr, n = Math.ceil(TAU * d / (rr * 1.6));
    for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.sin(a) * d, z = Math.cos(a) * d; if (Math.abs(x) < gapX) continue; B.cyl(x, z, rr, -2, 40); }
  }
  // ouverture haute (vers la caverne lointaine) : un court boyau en arche qui traverse la paroi, quelques rochers sur le rebord
  function windowFrame(K, S, a, y0, y1, wHalf) {
    const D = S.foot(a), ox = Math.sin(a), oz = Math.cos(a);
    Tube(K, { x0: 0, z0: 0, ox, oz, s0: D - 1.6, s1: D + 7, step: 2.2, n: 12, amp: 1.0, salt: 120, floor: true,
      prof: s => ({ hw: wHalf + 0.6 + 0.5 * Math.sin(s), top: y1 + 0.8, yb: y0 }), dark: s => 0.95 - 0.5 * c01((s - D + 2) / 9) });
    const ux = oz, uz = -ox;
    for (const [u, s, sc] of [[-wHalf * 0.7, D - 0.6, 1.1], [wHalf * 0.55, D - 0.9, 0.9], [-wHalf * 0.15, D + 0.2, 0.7]]) K.model('roc_a', ox * s + ux * u, y0 - 0.2, oz * s + uz * u, { s: sc, ry: u });
    K.views.push(a);
  }
  // cascade : ruban d'eau qui tombe d'une ouverture jusqu'à une vasque au sol
  function waterfall(K, a, rTop, yTop, rBot, width) {
    const sx = Math.sin(a), cz = Math.cos(a), ux = cz, uz = -sx, n = 10, pos = [], uv = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, r = rTop - (rTop - rBot) * Math.sqrt(t), y = yTop * (1 - t * t * 0.15 - t * 0.85), w = width * (0.8 + 0.35 * t);
      pos.push([sx * r - ux * w / 2, y, cz * r - uz * w / 2], [sx * r + ux * w / 2, y, cz * r + uz * w / 2]); uv.push(t);
    }
    const P = [], U = [];
    for (let i = 0; i < n; i++) { const a0 = pos[i * 2], b0 = pos[i * 2 + 1], a1 = pos[i * 2 + 2], b1 = pos[i * 2 + 3]; P.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0); U.push(0, uv[i], 0, uv[i + 1], 1, uv[i + 1], 0, uv[i], 1, uv[i + 1], 1, uv[i]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
    const w = K.C.wat, mat = new THREE.MeshBasicMaterial({ map: fallTex(), color: new THREE.Color(0.55 + w[0] * 1.6, 0.6 + w[1] * 1.6, 0.65 + w[2] * 1.6), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g, mat); m.renderOrder = 2; K.B.g.add(m); K.B.disposables.push(g, mat); K.fallMesh = m;
    // écume au pied (+ halo clair dans la vasque)
    K.halo(sx * (rBot - 0.6), 0.06, cz * (rBot - 0.6), width * 1.1, '#cfefff', 0.25);
    for (let i = 0; i < 6; i++) { const t = (i - 2.5) / 2.5, x = sx * (rBot - 0.3) + ux * t * width * 0.55, z = cz * (rBot - 0.3) + uz * t * width * 0.55; K.blob('glow', x, 0.05, z, 0.5 + 0.2 * (i % 2), 0.22, 0.45, i, { rf: K.glowFn([0.55, 0.7, 0.8], 0.9), j: 0.3 }); }
  }

  /* ---------- peuplement commun des salles rondes ---------- */
  // amas de cristaux au pied de la paroi (+ lumière)
  function wallCrystal(K, S, a, o) {
    o = o || {}; const D = S.foot(a), ci = o.col != null ? o.col : K.zone(Math.sin(a), Math.cos(a)), big = o.big !== false;
    const r = D + (o.dr != null ? o.dr : -0.2), x = Math.sin(a) * r, z = Math.cos(a) * r, key = o.key || (big ? (K.rnd() < 0.5 ? 'cristal_a' : 'cristal_c') : 'cristal_b');
    const s = o.s || (big ? 1.15 + K.rnd() * 0.55 : 0.9 + K.rnd() * 0.4);
    K.model(key, x, -0.15, z, { s, ry: a + Math.PI + (K.rnd() - 0.5) * 1.2, rx: key === 'cristal_c' ? 0 : 0.12, col: ci, gi: 2.2 });
    const lr = r - 2.2 * s, lx = Math.sin(a) * lr, lz = Math.cos(a) * lr;
    K.light(lx, 2.2 * s, lz, K.P.crys[ci], 1.8, 13 + 3 * s, o.spot === false ? null : { base: 2.5, dist: 15 });
    K.take(x, z, 2.2 * s);
    return ci;
  }
  function giantMushroom(K, x, z, o) {
    o = o || {}; const P = K.P, C = K.C, cap = C.cap[o.cap != null ? o.cap : Math.floor(K.rnd() * C.cap.length)], key = o.key || (K.rnd() < 0.6 ? 'champi_a' : 'champi_c'), s = o.s || (0.85 + K.rnd() * 0.45);
    const ry = o.ry != null ? o.ry : K.rnd() * TAU;
    K.model(key, x, o.y || 0, z, { s, ry, cap, gcol: C.gill, gli: 1.7 });
    if (!o.y) { K.B.cyl(x, z, 0.55 * s, -1, 13); K.B.obstacles.push({ x, z, r: 0.6 * s, h: 13 }); }
    const hy = (key === 'champi_a' ? 4.0 : 5.4) * s + (o.y || 0);
    K.light(x, hy - 0.8, z, P.gill, 0.9, 9 * s, o.spot ? { base: 1.9, dist: 13 } : null);
    K.take(x, z, 2.2 * s);
  }
  // corniches de roche accrochées aux parois (en hauteur), mousse dessus, parfois un cristal ou des champignons
  function wallLedges(K, S, n, y0, y1, avoid, angleOf) {
    for (let i = 0, tries = 0; i < n && tries < n * 4; tries++) {
      const a = angleOf ? angleOf() : K.rnd() * TAU; if (avoid && avoid(a)) continue;
      const y = y0 + K.rnd() * (y1 - y0), p = S.surfAt(a, y), sx = Math.sin(a), cz = Math.cos(a), w = 2.4 + K.rnd() * 2, h = 0.35, d = 1.5 + K.rnd() * 0.8;
      const x = p[0] - sx * d * 0.05, z = p[2] - cz * d * 0.05;
      K.blob('shell', x, y - 2.2, z, w, 2.8, d, a, { salt: 300 + i, moss: 1.4, maxY: y, det: 1 });
      const r = K.rnd();
      if (r < 0.35) { const ci = K.zone(x, z); K.model('cristal_b', x - sx * 0.7, y - 0.1, z - cz * 0.7, { s: 0.7 + K.rnd() * 0.3, ry: a + Math.PI, col: ci, gi: 2.2 }); K.light(x - sx * 1.2, y + 1.2, z - cz * 1.2, K.P.crys[ci], 0.9, 8); }
      else if (r < 0.6) { K.model('champi_b', x - sx * 0.6, y - 0.1, z - cz * 0.6, { s: 0.6, ry: a + Math.PI, cap: K.C.cap[i % K.C.cap.length], gcol: K.C.gill }); K.light(x - sx * 0.8, y + 1.0, z - cz * 0.8, K.P.gill, 0.6, 5); }
      i++;
    }
  }
  function stalactites(K, S, n, fMin, fMax, hMax) {
    for (let i = 0; i < n; i++) {
      const a = K.rnd() * TAU, f = fMin + K.rnd() * (fMax - fMin), p = S.vaultAt(a, f), h = (1.2 + K.rnd() * hMax) * (0.5 + 0.7 * (1 - f)), r = h * (0.16 + K.rnd() * 0.08);
      K.spike('rock', p[0], p[1] + 0.9, p[2], h + 0.9, r, -1);
      if (K.rnd() < 0.18) K.blob('glow', p[0], p[1] - h + 0.5, p[2], 0.09, 0.14, 0.09, 0, { rf: K.glowFn(K.C.gill, 1.4), j: 0 });   // goutte lumineuse
    }
  }
  function hangingCrystals(K, S, n, fMin, fMax) {
    for (let i = 0; i < n; i++) {
      const a = K.rnd() * TAU, f = fMin + K.rnd() * (fMax - fMin), p = S.vaultAt(a, f), ci = K.zone(p[0], p[2]), s = 0.9 + K.rnd() * 0.7;
      K.model(K.rnd() < 0.5 ? 'cristal_a' : 'cristal_c', p[0], p[1] + 0.7, p[2], { s, rx: Math.PI, ry: K.rnd() * TAU, col: ci, gi: 2.3 });
      K.light(p[0], p[1] - 2.5 * s, p[2], K.P.crys[ci], 1.3, 13);
    }
  }
  function roots(K, S, n, fMin, fMax, len) {
    for (let i = 0; i < n; i++) {
      const a = K.rnd() * TAU, f = fMin + K.rnd() * (fMax - fMin), p = S.vaultAt(a, f), cnt = 2 + Math.floor(K.rnd() * 3);
      for (let k = 0; k < cnt; k++) K.root(p[0] + (K.rnd() - 0.5) * 1.6, p[1] + 0.5, p[2] + (K.rnd() - 0.5) * 1.6, len * (0.4 + K.rnd() * 0.7), { r: 0.13 + K.rnd() * 0.08, dx: -Math.sin(a) * 0.12, dz: -Math.cos(a) * 0.12, bulb: K.rnd() < 0.5 ? K.C.gill : null });
    }
  }
  function rubble(K, S, n, rMin, rMax, sMax, avoid) {
    for (let i = 0; i < n; i++) {
      const a = K.rnd() * TAU; if (avoid && avoid(a)) continue;
      const r = S.foot(a) + rMin + K.rnd() * (rMax - rMin), s = 0.25 + K.rnd() * sMax;
      K.model(K.rnd() < 0.6 ? 'roc_c' : 'roc_a', Math.sin(a) * r, -0.1, Math.cos(a) * r, { s, ry: K.rnd() * TAU });
    }
  }
  // sol visuel d'une salle ronde (le sol physique est un disque) : couleurs, mousse au bord, humidité, lumière cuite
  function floorDisc(K, Rf, R0, gapZ, o) {
    const C = K.C, P = K.P, rings = Math.ceil(Rf / 1.6), segs = 84, seed = K.seed;
    const ff = (out, x, y, z, nx, ny, nz, fh) => {
      const r = Math.hypot(x, z), n1 = noise3(x * 0.09, 0.3, z * 0.09, seed + 3), n2 = noise3(x * 0.45, 0.7, z * 0.45, seed + 4);
      const t = c01(0.5 + n1 * 1.3), a = C.fl[0], b = C.fl[1];
      let cr = a[0] + (b[0] - a[0]) * t, cg = a[1] + (b[1] - a[1]) * t, cb = a[2] + (b[2] - a[2]) * t;
      const k0 = (0.9 + 0.14 * n2) * (0.95 + 0.1 * fh) * (1.12 - 0.12 * c01(r / 20)); cr *= k0; cg *= k0; cb *= k0;
      const e = c01((r - (R0 - 6)) / 7);
      const pm = c01(e * 1.4 + n1 * 0.6 - 0.35) * (P.moss || 0) * 0.7;
      cr += (C.mos[0] * 0.8 - cr) * pm; cg += (C.mos[1] * 0.8 - cg) * pm; cb += (C.mos[2] * 0.8 - cb) * pm;
      const k = (1 - 0.42 * e) * (1 - 0.45 * K.wetAt(x, z));
      out[0] = cr * k; out[1] = cg * k; out[2] = cb * k;
    };
    // dalles naturelles à fleur de sol (purement visuelles, 5 cm) : rompent la monotonie du grand disque
    if (o && o.slabs) for (let i = 0, tries = 0; i < o.slabs && tries < 80; tries++) {
      const a = K.rnd() * TAU, r = o.r0 + K.rnd() * (o.r1 - o.r0), x = Math.sin(a) * r, z = Math.cos(a) * r, rr = 1.1 + K.rnd() * 1.6;
      if (!K.free(x, z, rr) || K.wetAt(x, z) > 0) continue; K.take(x, z, rr * 0.8);
      const n = 5 + Math.floor(K.rnd() * 3), pts = [], a0 = K.rnd() * TAU, top = [x, 0.05, z], el = 0.55 + K.rnd() * 0.4, ca = Math.cos(a0), sa = Math.sin(a0);
      for (let k = 0; k < n; k++) { const t = (k + (K.rnd() - 0.5) * 0.6) / n * TAU, q = rr * (0.55 + 0.55 * K.rnd()), lx = Math.sin(t) * q, lz = Math.cos(t) * q * el; pts.push([x + lx * ca + lz * sa, 0.05, z - lx * sa + lz * ca]); }
      const tone = 0.68 + K.rnd() * 0.18, f1 = C.fl[1], f0 = C.fl[0], m1 = C.rk[1], fh0 = K.rnd();
      const sf = (out, X, Y, Z, nx, ny, nz, fh, ly) => { const k = tone * (0.93 + 0.12 * fh) * (ly > 0.5 ? 1.12 : 0.7); for (let c = 0; c < 3; c++) out[c] = (f1[c] * 0.72 + m1[c] * 0.28 + (f1[c] - f0[c]) * 0.4 * fh0) * k; };
      for (let k = 0; k < n; k++) { const p0 = pts[k], p1 = pts[(k + 1) % n]; K.tri('shell', top, p0, p1, (out, X, Y, Z, nx, ny, nz, fh) => sf(out, X, Y, Z, nx, ny, nz, fh, 0.62), [x, 3, z]); K.quad('shell', p0, p1, [p1[0], -0.05, p1[2]], [p0[0], -0.05, p0[2]], (out, X, Y, Z, nx, ny, nz, fh) => sf(out, X, Y, Z, nx, ny, nz, fh, 0.35), [2 * p0[0] - x, 0, 2 * p0[2] - z]); }
    }
    const G = [[[0, 0, 0]]];
    for (let j = 1; j <= rings; j++) {
      const r = Rf * j / rings, row = [];
      for (let i = 0; i < segs; i++) { const a = (i + (j % 2) * 0.5) / segs * TAU; let x = Math.sin(a) * r, z = Math.cos(a) * r; const y = (Math.abs(x) < 3.2 && Math.abs(z) > gapZ) ? -0.035 : 0; row.push([x, y, z]); }
      G.push(row);
    }
    for (let i = 0; i < segs; i++) K.tri('shell', G[0][0], G[1][i], G[1][(i + 1) % segs], ff, [0, 5, 0]);
    for (let j = 1; j < rings; j++) for (let i = 0; i < segs; i++) {
      const i2 = (i + 1) % segs, a = G[j][i], b = G[j][i2], c = G[j + 1][i2], d = G[j + 1][i], up = [a[0], 5, a[2]];
      if (j % 2) { K.tri('shell', a, b, d, ff, up); K.tri('shell', b, c, d, ff, up); } else { K.tri('shell', a, b, c, ff, up); K.tri('shell', a, c, d, ff, up); }
    }
  }
  // lumière zénithale (puits de lumière) ou cœur de cristal suspendu (profondeurs)
  function zenith(K, S, rBeam, yFloor) {
    const P = K.P, top = S.vaultAt(0, 0)[1];
    if (P.shaft) {
      K.blob('glow', 0, top - 0.4, 0, rBeam * 0.95, 0.28, rBeam * 0.95, 0, { rf: K.glowFn(K.C.shaft, 1.7), j: 0.25 });
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, p = S.vaultAt(a, 0.12); K.blob('shell', p[0], p[1] - 0.3, p[2], 1.6, 0.9, 1.4, a, { salt: 200 + i }); }
      K.shaft(0, 0, yFloor, top - 0.8, rBeam * 0.75, rBeam * 1.35, P.shaft, 0.075);
      K.halo(0, 0.05, 0, rBeam * 1.7, P.shaft, 0.22);
      K.light(0, 2.5, 0, P.shaft, 0.75, rBeam * 3.2, { base: 1.6, dist: 20 });
    } else {
      const ci = 0, s = 1.7;
      K.model('cristal_c', 0, top + 0.6, 0, { s, rx: Math.PI, ry: 0.4, col: ci, gi: 2.6 });
      K.model('cristal_a', 1.2, top + 0.4, -0.8, { s: 1.1, rx: Math.PI, ry: 2.1, col: 1, gi: 2.4 });
      K.light(0, top - 6, 0, P.crys[0], 1.6, 22);
      K.light(0, 6, 0, P.crys[0], 0.3, 18, { base: 1.6, dist: 22 });
    }
  }

  /* =====================================================================
     LE THÈME
     ===================================================================== */
  DG.THEMES.grotte = {
    signWall: true,
    setup(B, room, rng, A2) {
      const K = B.gk = Kit(B), P = B.P;
      // matériaux du moteur (portes, mécanismes d'énigme) : roche unie à facettes, sol de terre
      const old = ['wall', 'trim', 'floor', 'glow'].map(k => B.mats[k]);
      B.mats.wall = new THREE.MeshStandardMaterial({ color: L(P.rk[1]), roughness: 0.95, flatShading: true });
      B.mats.trim = new THREE.MeshStandardMaterial({ color: L(P.rk[2]).multiplyScalar(0.85), roughness: 0.92, flatShading: true });
      B.mats.floor = new THREE.MeshStandardMaterial({ map: floorTex(P), roughness: 0.92 });
      const g = L(P.crys[0]); B.mats.glow = new THREE.MeshStandardMaterial({ color: g.clone().multiplyScalar(0.5), emissive: g, emissiveIntensity: 1.3, roughness: 0.3 });
      old.forEach(m => m && m.dispose());
      // portes : on garde les solides, le sol et la herse du moteur, mais on remplace l'habillage (boîtes) par de la roche
      const add0 = B.add;
      B.add = function (mat) { if (K.filt && (mat === 'wall' || mat === 'trim' || mat === 'gold')) return null; return add0.apply(this, arguments); };
      B.torch = function (x, y, z, ry, light) { sconce(K, x, y, z, ry, light); if (K.filt > 0 && K.filt < 50) K.filt--; };
    },

    /* ---------- grande salle de combat ---------- */
    hall(B, room, rng, o, A2) {
      const K = B.gk, P = B.P, R = A.ROOM_R + 0.9, boss = o && o.pillars === false, side = K.rnd() < 0.5 ? 1 : -1;
      B.floors.push({ t: 'd', x: 0, z: 0, r: R + 0.5 });
      const ag = side * (Math.PI / 2 + 0.14), aw = -side * (Math.PI / 2 + 0.1);     // galerie (au sol) et grande ouverture (en hauteur)
      const foot = a => R + 1.15 + 0.85 * (0.5 + 0.5 * noise3(Math.sin(a) * 2.2, 0.5, Math.cos(a) * 2.2, K.seed + 1));
      const dN = doorHole(0, R + 0.2, 0, 4.6), dS = doorHole(0, -(R + 0.2), Math.PI, 4.6);
      const hole = (x, y, z) => {
        if (dN(x, y, z) || dS(x, y, z)) return true;
        const a = Math.atan2(x, z), r = Math.hypot(x, z);
        if (r > R - 4 && Math.abs(norm2(a - ag)) * r < archHalf(y, 4.6, -0.05, 8.6) - 1.0) return true;
        if (Math.abs(norm2(a - aw)) * r < archHalf(y, 7.6, 8.4, 20.3) - 1.2) return true;
        return false;
      };
      const S = Shell(K, { foot, segs: 88, Hw: 9.5, Ht: 27, amp: 1.7, hole, wall: [[-0.7, 0.55], [1.3, 1.15], [3.4, 0.8], [6.0, 0.1], [9.5, -0.7]] });
      K.S = S;
      // portes (habillage maison + porte du moteur)
      K.filt = 99;
      const entrance = A.door(B, 0, -(R + 0.2), Math.PI, { open: true });
      const exit = A.door(B, 0, R + 0.2, 0);
      K.filt = 0;
      doorDress(K, 0, -(R + 0.2), Math.PI, 4.6); doorDress(K, 0, R + 0.2, 0, 4.6);
      ringSolids(B, R, 1.7, 1.5, 3.75);
      // galerie sombre (au sol) : boyau qui s'enfonce, éboulis à l'entrée, ruisseau qui en sort
      const gox = Math.sin(ag), goz = Math.cos(ag), gux = goz, guz = -gox, GP = (u, s, y) => [gox * s + gux * u, y || 0, goz * s + guz * u];
      Tube(K, { x0: 0, z0: 0, ox: gox, oz: goz, s0: R - 2.5, s1: R + 28, step: 2.2, n: 12, amp: 0.9, salt: 77, floor: true, cap: true,
        prof: s => { const k = c01((s - R) / 28); return { hw: 4.6 - 1.6 * k, top: 8.6 - 3 * k, yb: -0.05 - 3.2 * k * k }; },
        off: s => 3.2 * Math.sin(c01((s - R) / 28) * 2.4) * side, dark: s => Math.max(0.1, Math.exp(-Math.max(0, s - R + 1) / 9)) });
      for (const [u, s, sc, key] of [[-3.6, R + 0.6, 1.25, 'roc_a'], [3.4, R + 1.0, 1.1, 'roc_a'], [-1.6, R + 2.2, 0.8, 'roc_c'], [1.9, R + 2.8, 0.7, 'roc_c'], [0.2, R + 1.6, 1.5, 'roc_b']]) K.model(key, ...GP(u, s, -0.1), { s: sc, ry: u * 2 });
      for (const [u, s] of [[-2.2, R + 9], [2.0, R + 17]]) { const ci = K.crysIdx(), p = GP(u + 3.2 * Math.sin(c01((s - R) / 28) * 2.4) * side, s, -0.2 - 3.2 * Math.pow((s - R) / 28, 2)); K.model('cristal_a', ...p, { s: 1.1, ry: s, col: ci, gi: 1.9 }); K.light(p[0], p[1] + 2.5, p[2], P.crys[ci], 1.0, 10); }
      const goff = s => 3.2 * Math.sin(c01((s - R) / 28) * 2.4) * side;
      K.stream([[GP(goff(R + 7), R + 7)[0], GP(goff(R + 7), R + 7)[2], 0.9, -0.2], [GP(goff(R + 2) + 0.2, R + 2)[0], GP(goff(R + 2) + 0.2, R + 2)[2], 0.85], [GP(0.6, R - 1)[0], GP(0.6, R - 1)[2], 0.8], ...[[ag + side * 0.04, R - 3.2], [ag + side * 0.1, R - 4.6]].map(([a, r]) => [Math.sin(a) * r, Math.cos(a) * r, 0.75])]);
      const pa = ag + side * 0.17; K.pool(Math.sin(pa) * (R - 4.4), Math.cos(pa) * (R - 4.4), 2.6);
      K.take(GP(0, R)[0], GP(0, R)[2], 4.5);
      // grande ouverture en hauteur vers la caverne lointaine, cascade et vasque au pied
      windowFrame(K, S, aw, 8.4, 19.5, 7.2);
      waterfall(K, aw, foot(aw) - 1.4, 8.6, R - 1.6, 3.2);
      K.pool(Math.sin(aw) * (R - 2.0), Math.cos(aw) * (R - 2.0), 3.3);
      K.take(Math.sin(aw) * (R - 1.5), Math.cos(aw) * (R - 1.5), 3.5);
      // terrasses sur le pourtour (on y grimpe : marches de 1,1 m)
      for (const [a0, sg] of [[1.0, 1], [-1.0, -1], [2.22, -1], [-2.22, 1]]) {
        const pt = (da, r) => [Math.sin(a0 + da * sg) * r, Math.cos(a0 + da * sg) * r];
        let [x, z] = pt(0, R - 2.6); K.slab(x, z, 3.0, 3.3, { a0: a0 });
        [x, z] = pt(0.075, R - 5.4); K.slab(x, z, 2.0, 2.2, { a0: a0 + 1 });
        [x, z] = pt(0.135, R - 6.9); K.slab(x, z, 1.3, 1.1, { a0: a0 + 2 });
        [x, z] = pt(-0.065, R - 0.9); K.slab(x, z, 1.6, 4.4, { a0: a0 + 3 });
        // un amas de cristaux sur la corniche, des champignons sur la grande terrasse
        [x, z] = pt(-0.07, R - 0.6); const ci = K.zone(x, z);
        K.model('cristal_b', x, 4.35, z, { s: 1.0, ry: a0 + Math.PI, col: ci, gi: 2.3 }); K.light(x - Math.sin(a0) * 1.2, 5.4, z - Math.cos(a0) * 1.2, P.crys[ci], 1.0, 10, { base: 2.0, dist: 13 });
        [x, z] = pt(0.03, R - 1.6); K.model('champi_b', x, 3.25, z, { s: 0.9, ry: a0, cap: K.C.cap[K.tier === 1 ? 0 : 0], gcol: K.C.gill });
        K.light(x, 4.6, z, P.gill, 0.6, 6);
      }
      // colonnes (stalactite + stalagmite soudées) : couvert pour les combats
      if (!boss) for (const a of [0.62, -0.62, 2.5, -2.5]) {
        const r = 18 + (K.rnd() - 0.5) * 1.5, x = Math.sin(a) * r, z = Math.cos(a) * r, top = S.ceilAt(x, z)[1] + 1.5;
        K.lathe('rock', x, z, -0.3, top, t => t < 0.06 ? 2.1 - t * 6 : t < 0.5 ? 1.75 - (t - 0.06) * 1.6 : t < 0.8 ? 1.05 + (t - 0.5) * 2.4 : 1.77 + (t - 0.8) * 8, 9, K.rockFn({ y0: -2, yh: 14, moss: 0.6, k: 1.15 }));
        B.cyl(x, z, 1.6, -2, 40); B.obstacles.push({ x, z, r: 1.7, h: 40 });
        K.take(x, z, 2.4);
        if (K.rnd() < 0.7) { const ci = K.zone(x, z), aa = a + 1.2; K.model('cristal_b', x + Math.sin(aa) * 1.5, 0, z + Math.cos(aa) * 1.5, { s: 0.8, ry: aa, rx: 0.3, col: ci, gi: 2.1 }); K.light(x + Math.sin(aa) * 2.4, 1.5, z + Math.cos(aa) * 2.4, P.crys[ci], 0.9, 8); }
      }
      // cristaux géants au pied de la paroi
      const nC = P.crysN, avoidA = a => Math.abs(norm2(a)) < 0.2 || Math.abs(norm2(a - Math.PI)) < 0.2 || Math.abs(norm2(a - ag)) < 0.2;
      for (let i = 0; i < nC; i++) { const a = (i + 0.5) / nC * TAU + (K.rnd() - 0.5) * 0.15; if (avoidA(a)) continue; const r = foot(a) - 0.2; if (!K.free(Math.sin(a) * r, Math.cos(a) * r, 1.6)) continue; wallCrystal(K, S, a, { spot: i % 2 === 0 }); }
      // champignons géants
      for (let i = 0, tries = 0; i < P.mush && tries < 40; tries++) {
        const a = K.rnd() * TAU; if (avoidA(a) || Math.abs(norm2(a - aw)) < 0.15) continue;
        const r = R - 1.4 - K.rnd() * 1.2, x = Math.sin(a) * r, z = Math.cos(a) * r; if (!K.free(x, z, 2.2)) continue;
        giantMushroom(K, x, z, { spot: i % 2 === 0, ry: a + Math.PI }); i++;
      }
      // stalagmites entre 26 m et le bord (les monstres les contournent)
      for (let i = 0, tries = 0; i < 12 && tries < 60; tries++) {
        const a = K.rnd() * TAU; if (avoidA(a) || Math.abs(norm2(a)) < 0.3 || Math.abs(norm2(a - Math.PI)) < 0.3) continue;
        const r = 27.5 + K.rnd() * 5.5, x = Math.sin(a) * r, z = Math.cos(a) * r, big = K.rnd() < 0.45, s = big ? 0.8 + K.rnd() * 0.4 : 0.7 + K.rnd() * 0.5;
        if (!K.free(x, z, big ? 1.4 : 1.1)) continue;
        K.model(big ? 'stalag_a' : 'stalag_b', x, -0.1, z, { s, ry: K.rnd() * TAU });
        const rr = big ? 0.95 * s : 0.75 * s; B.cyl(x, z, rr, -1, 13); B.obstacles.push({ x, z, r: rr, h: 13 }); K.take(x, z, rr + 0.6); i++;
      }
      // éboulis, cailloux, mousse
      rubble(K, S, 46, -0.9, 0.4, 0.55, a => Math.abs(norm2(a)) < 0.12 || Math.abs(norm2(a - Math.PI)) < 0.12);
      for (let i = 0; i < 26; i++) { const a = K.rnd() * TAU, r = 24 + K.rnd() * 9, x = Math.sin(a) * r, z = Math.cos(a) * r; if (Math.abs(x) < 4 && Math.abs(z) > 24) continue; K.model('roc_c', x, -0.06, z, { s: 0.12 + K.rnd() * 0.16, ry: K.rnd() * 6 }); }
      wallLedges(K, S, 9, 4.5, 8.5, a => avoidA(a) || Math.abs(norm2(a - aw)) < 0.3 || Math.abs(norm2(a)) < 0.3 || Math.abs(norm2(a - Math.PI)) < 0.3);
      // la voûte : stalactites, cristaux suspendus, racines
      stalactites(K, S, 74, 0.1, 0.95, 6);
      hangingCrystals(K, S, 5, 0.35, 0.8);
      roots(K, S, K.tier === 1 ? 12 : 8, 0.82, 0.96, 7);
      zenith(K, S, 3.2, 0);
      floorDisc(K, R + 3.2, R, R - 1.2, { slabs: 12, r0: 7, r1: 25 });
      return { R, entrance, exits: [exit], spawn: { x: 0, z: -(R - 7.5), yaw: 0 }, rewardAt: new A.V3(0, 0, 0) };
    },

    /* ---------- salle calme (feu de camp, marchand, autel) : grotte intime avec cascade ---------- */
    chapel(B, room, rng, A2) {
      const K = B.gk, P = B.P, R = 17, side = K.rnd() < 0.5 ? 1 : -1;
      B.floors.push({ t: 'd', x: 0, z: 0, r: R + 0.5 });
      const aw = side * (Math.PI / 2 + 0.12);
      const foot = a => R + 1.0 + 0.7 * (0.5 + 0.5 * noise3(Math.sin(a) * 2, 0.5, Math.cos(a) * 2, K.seed + 2));
      const dN = doorHole(0, R + 0.2, 0, 4.2), dS = doorHole(0, -(R + 0.2), Math.PI, 4.6);
      const hole = (x, y, z) => dN(x, y, z) || dS(x, y, z) || Math.abs(norm2(Math.atan2(x, z) - aw)) * Math.hypot(x, z) < archHalf(y, 4.2, 6.2, 12.4) - 1.0;
      const S = Shell(K, { foot, segs: 64, Hw: 7, Ht: 15.5, amp: 1.3, hole, wall: [[-0.7, 0.5], [1.3, 1.0], [3.3, 0.7], [5.2, 0.0], [7, -0.6]] });
      K.S = S;
      K.filt = 99;
      const entrance = A.door(B, 0, -(R + 0.2), Math.PI, { open: true });
      const exit = A.door(B, 0, R + 0.2, 0, { w: 4.2 });
      K.filt = 0;
      doorDress(K, 0, -(R + 0.2), Math.PI, 4.6); doorDress(K, 0, R + 0.2, 0, 4.2);
      ringSolids(B, R, 1.55, 1.3, 3.6);
      // cascade et vasque
      windowFrame(K, S, aw, 6.2, 11.6, 3.8);
      waterfall(K, aw, foot(aw) - 1.4, 6.4, R - 1.3, 2.6);
      K.pool(Math.sin(aw) * (R - 2.2), Math.cos(aw) * (R - 2.2), 2.9);
      K.stream([[Math.sin(aw + side * 0.25) * (R - 3.4), Math.cos(aw + side * 0.25) * (R - 3.4), 0.45], [Math.sin(aw + side * 0.5) * (R - 3.0), Math.cos(aw + side * 0.5) * (R - 3.0), 0.4], [Math.sin(aw + side * 0.68) * (R - 1.2), Math.cos(aw + side * 0.68) * (R - 1.2), 0.35]]);
      K.take(Math.sin(aw) * (R - 1.6), Math.cos(aw) * (R - 1.6), 3.2);
      // corniche basse en face
      const at = -side * 2.25, pt = (da, r) => [Math.sin(at + da) * r, Math.cos(at + da) * r];
      let [x, z] = pt(0, R - 1.8); K.slab(x, z, 2.2, 2.2, { a0: at });
      [x, z] = pt(-side * 0.17, R - 3.4); K.slab(x, z, 1.4, 1.1, { a0: at + 1 });
      { const ci = K.crysIdx(); [x, z] = pt(0.04, R - 1.2); K.model('cristal_a', x, 2.1, z, { s: 0.95, ry: at + Math.PI, col: ci, gi: 2.3 }); K.light(x - Math.sin(at) * 1.6, 3.6, z - Math.cos(at) * 1.6, P.crys[ci], 1.1, 11, { base: 2.2, dist: 14 }); }
      // cristaux et champignons au pied de la paroi
      const avoidA = a => Math.abs(norm2(a)) < 0.3 || Math.abs(norm2(a - Math.PI)) < 0.3 || Math.abs(norm2(a - aw)) < 0.3;
      for (let i = 0; i < 7; i++) { const a = (i + 0.3) / 7 * TAU; if (avoidA(a)) continue; const r = foot(a) - 0.2; if (!K.free(Math.sin(a) * r, Math.cos(a) * r, 1.4)) continue; wallCrystal(K, S, a, { big: i % 2 === 0, spot: true, s: i % 2 === 0 ? 1.1 : 1.0 }); }
      const nm = Math.max(2, Math.round(P.mush * 0.5));
      for (let i = 0, tries = 0; i < nm && tries < 30; tries++) {
        const a = K.rnd() * TAU; if (avoidA(a)) continue;
        const r = R - 1.2 - K.rnd() * 0.8, x2 = Math.sin(a) * r, z2 = Math.cos(a) * r; if (!K.free(x2, z2, 1.8)) continue;
        if (i % 2 === 0) giantMushroom(K, x2, z2, { s: 0.75 + K.rnd() * 0.25, spot: i === 0, ry: a + Math.PI });
        else { K.model('champi_b', x2, 0, z2, { s: 1.1, ry: a + Math.PI, cap: K.C.cap[1 % K.C.cap.length], gcol: K.C.gill }); K.light(x2, 1.4, z2, P.gill, 0.7, 6); K.take(x2, z2, 1.4); }
        i++;
      }
      for (let i = 0, tries = 0; i < 5 && tries < 30; tries++) {
        const a = K.rnd() * TAU; if (avoidA(a)) continue; const r = 12 + K.rnd() * 3.5, x2 = Math.sin(a) * r, z2 = Math.cos(a) * r; if (!K.free(x2, z2, 1.1)) continue;
        const s = 0.55 + K.rnd() * 0.35; K.model('stalag_b', x2, -0.1, z2, { s, ry: K.rnd() * 6 }); B.cyl(x2, z2, 0.7 * s, -1, 13); K.take(x2, z2, 1.1); i++;
      }
      rubble(K, S, 22, -0.8, 0.4, 0.45, a => Math.abs(norm2(a)) < 0.2 || Math.abs(norm2(a - Math.PI)) < 0.2);
      stalactites(K, S, 34, 0.12, 0.95, 4);
      hangingCrystals(K, S, 2, 0.4, 0.75);
      roots(K, S, 6, 0.8, 0.95, 5);
      zenith(K, S, 2.4, 0);
      floorDisc(K, R + 3, R, R - 1.2, { slabs: 4, r0: 9.5, r1: 14 });
      return { R, entrance, exits: [exit], spawn: { x: 0, z: -13, yaw: 0 }, rewardAt: new A.V3(0, 0, 0) };
    },

    /* ---------- bord d'une salle d'énigme rectangulaire ---------- */
    rectShell(B, W, Lz, H, full, A2) {
      const K = B.gk, hx = W / 2, hz = Lz / 2;
      const rd = a => { const sx = Math.abs(Math.sin(a)), cz = Math.abs(Math.cos(a)); return Math.min(sx > 1e-6 ? hx / sx : 1e9, cz > 1e-6 ? hz / cz : 1e9); };
      const foot = a => rd(a) + 0.35 + 0.55 * (0.5 + 0.5 * noise3(Math.sin(a) * 3, 0.5, Math.cos(a) * 3, K.seed + 4));
      const dN = doorHole(0, hz, 0, 4.6), dS = doorHole(0, -hz, Math.PI, 4.6);
      const wall = full ? [[-0.7, 0.3], [1.3, 0.85], [3.4, 0.55], [6.0, 0.0], [8.5, -0.6]]
        : [[-46, 0.9], [-26, 1.4], [-12, 0.5], [-4, 0.9], [-0.7, 0.4], [1.3, 0.85], [3.4, 0.55], [6.0, 0.0], [8.5, -0.6]];
      const S = Shell(K, { foot, segs: 104, Hw: 8.5, Ht: 16, amp: 1.2, wall, hole: (x, y, z) => dN(x, y, z) || dS(x, y, z) });
      K.S = S; K.rect = { hx, hz, full, W, Lz };
      doorDress(K, 0, -hz, Math.PI, 4.6); doorDress(K, 0, hz, 0, 4.6);
      K.filt = 4;   // les 2 portes que le moteur pose juste après (4 torches) : on remplace leur habillage
      // solides tout autour (on reste dans le rectangle), ouverts devant les portes
      const rr = 1.2, step = 1.9;
      for (const sz of [-1, 1]) for (let x = -hx; x <= hx + 1e-3; x += step) { if (Math.abs(x) < 4.6) continue; B.cyl(x, sz * (hz + rr), rr, -50, 40); }
      for (const sx of [-1, 1]) for (let z = -hz - rr; z <= hz + rr + 1e-3; z += step) B.cyl(sx * (hx + rr), z, rr, -50, 40);
      // rocher plat derrière le panneau de consigne (-7,5 ; 3,3 ; -hz + 0,8)
      K.blob('shell', -7.5, 2.6, -hz - 0.55, 3.5, 3.4, 1.15, 0, { maxLZ: 1.08, minY: full ? -0.4 : -6, det: 1, salt: 90, j: 0.18 });
      B.solid(-7.5, -hz - 0.2, 3.1, 0.72, 0, -6, 40);
      // sol entre le rectangle et la paroi (sous le niveau du sol du jeu : il ne recouvre jamais le vrai sol)
      if (full) {
        const segs = 104, ff = (out, x, y, z) => { const a = K.C.fl[0], k = 0.55 + 0.2 * noise3(x * 0.3, 0, z * 0.3, K.seed); out[0] = a[0] * k; out[1] = a[1] * k; out[2] = a[2] * k; };
        for (let i = 0; i < segs; i++) {
          const a0 = i / segs * TAU, a1 = (i + 1) / segs * TAU, p = (a, d) => [Math.sin(a) * d, -0.025, Math.cos(a) * d];
          const in0 = p(a0, rd(a0) - 0.6), in1 = p(a1, rd(a1) - 0.6), o0 = p(a0, foot(a0) + 1.4), o1 = p(a1, foot(a1) + 1.4);
          K.quad('shell', in0, in1, o1, o0, ff, [in0[0], 5, in0[2]]);
        }
      }
    },

    /* ---------- décor d'une salle d'énigme : près des parois et en hauteur ---------- */
    roomDecor(B, W, Lz, H, A2) {
      const K = B.gk, S = K.S, P = B.P, hx = W / 2, hz = Lz / 2, full = K.rect ? K.rect.full : true;
      K.filt = 0;
      if (!S) return;
      // cristaux le long des grands côtés (plantés dans la paroi) + halos au sol
      const n = Math.max(2, Math.floor(Lz / 8.5));
      for (let i = 0; i < n; i++) for (const sx of [-1, 1]) {
        const z = -hz + (i + 0.5) * Lz / n + (K.rnd() - 0.5) * 2, ci = K.zone(0, z), big = (i + (sx > 0 ? 1 : 0)) % 2 === 0;
        if (Math.abs(z - -hz) < 4 && sx < 0) continue;   // panneau de consigne
        if (full) {
          K.model(big ? 'cristal_a' : 'cristal_c', sx * (hx + 1.25), -0.15, z, { s: big ? 1.05 : 0.85, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2, rx: 0.25, col: ci, gi: 2.2 });
          K.halo(sx * (hx - 0.7), 0.035, z, 3.2, P.crys[ci], 0.28);
        } else {
          const y = -2 - K.rnd() * 7; K.model('cristal_b', sx * (hx + 0.9), y, z, { s: 1.3, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2, rx: 1.0, col: ci, gi: 2.2 });
          K.light(sx * (hx - 0.6), y + 0.8, z, P.crys[ci], 1.0, 9);
        }
        K.light(sx * (hx - 0.9), 2.4, z, P.crys[ci], 1.1, 12, i % 2 === (sx > 0 ? 0 : 1) ? { base: 2.4, dist: 15 } : null);
      }
      if (!full) {   // le gouffre : des cristaux tout au fond des parois, de plus en plus bas
        for (let i = 0; i < 10; i++) { const sx = i % 2 ? 1 : -1, z = -hz + 10 + K.rnd() * (Lz - 22), y = -12 - K.rnd() * 22, ci = K.crysIdx(); K.model('cristal_a', sx * (hx + 1.2), y, z, { s: 1.4, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2, rx: 1.1, col: ci, gi: 1.8 }); K.light(sx * (hx - 1), y + 1, z, P.crys[ci], 1.2, 12); }
      }
      // champignons en console sur les parois (en hauteur)
      for (let i = 0; i < Math.floor(Lz / 7); i++) {
        const sx = K.rnd() < 0.5 ? -1 : 1, z = -hz + 3 + K.rnd() * (Lz - 6), y = 3 + K.rnd() * 3.5, p = S.surfAt(Math.atan2(sx * hx, z), y);
        const cap = K.C.cap[Math.floor(K.rnd() * K.C.cap.length)];
        for (let k = 0; k < 3; k++) {
          const yy = y - k * 0.55, rr = 0.9 - k * 0.22, xx = p[0] - sx * (0.1 + rr * 0.55), zz = p[2] + (k - 1) * 0.5;
          K.blob('soft', xx, yy, zz, rr, 0.2, rr * 0.9, 0, { rf: K.softFn(cap, 0.55), j: 0.12 });
          K.blob('glow', xx, yy - 0.16, zz, rr * 0.85, 0.06, rr * 0.75, 0, { rf: K.glowFn(K.C.gill, 1.5), j: 0.05 });
        }
        K.light(p[0] - sx * 1.2, y - 0.6, p[2], P.gill, 0.5, 6);
      }
      // coins : stalagmites et grands cristaux
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const ci = K.crysIdx();
        K.model('cristal_c', cx * (hx + 1.6), full ? -0.15 : -1.5, cz * (hz + 1.4), { s: 1.35, ry: Math.atan2(-cx, -cz), rx: 0.35, col: ci, gi: 2.2 });
        K.light(cx * (hx - 1.5), 3, cz * (hz - 1.5), P.crys[ci], 1.1, 12);
        if (full) { const s = 0.75; K.model('stalag_b', cx * (hx - 0.9), -0.1, cz * (hz - 0.9), { s, ry: cx + cz * 2 }); B.cyl(cx * (hx - 0.9), cz * (hz - 0.9), 0.6, -1, 13); }
      }
      // éboulis au pied des parois
      if (full) for (let i = 0; i < Math.floor(Lz / 2.2); i++) { const sx = i % 2 ? 1 : -1, z = -hz + 1 + K.rnd() * (Lz - 2); if (Math.abs(z + hz) < 4 && sx < 0) continue; K.model(K.rnd() < 0.6 ? 'roc_c' : 'roc_a', sx * (hx + 0.35 + K.rnd() * 0.6), -0.1, z, { s: 0.25 + K.rnd() * 0.35, ry: K.rnd() * 6 }); }
      // la voûte
      for (let i = 0; i < Math.round(W * Lz / 26); i++) { const x = (K.rnd() - 0.5) * W * 1.05, z = (K.rnd() - 0.5) * Lz * 1.02, p = S.ceilAt(x, z), h = 1 + K.rnd() * 3.5; K.spike('rock', p[0], p[1] + 0.9, p[2], h + 0.9, h * 0.2, -1); }
      for (let i = 0; i < Math.max(2, Math.floor(Lz / 18)); i++) { const z = -hz + (i + 0.5) * Lz / Math.max(2, Math.floor(Lz / 18)), x = (K.rnd() - 0.5) * W * 0.5, p = S.ceilAt(x, z), ci = K.crysIdx(); K.model('cristal_a', p[0], p[1] + 0.6, p[2], { s: 1.0, rx: Math.PI, ry: K.rnd() * 6, col: ci, gi: 2.3 }); K.light(p[0], p[1] - 2.5, p[2], P.crys[ci], 1.3, 13); }
      for (let i = 0; i < Math.floor(Lz / 6); i++) { const sx = K.rnd() < 0.5 ? -1 : 1, z = (K.rnd() - 0.5) * Lz, p = S.ceilAt(sx * hx * 0.85, z); K.root(p[0], p[1] + 0.4, p[2], 3 + K.rnd() * 4, { r: 0.14, dx: -sx * 0.1, bulb: K.rnd() < 0.5 ? K.C.gill : null }); }
    },

    /* ---------- le lointain : la grande caverne vue par les ouvertures ---------- */
    skyline(B, R, seed, A2, L0) {
      const K = B.gk; if (!K || !K.views.length) return;
      const P = B.P;
      K.views.forEach((a0, vi) => {
        for (let i = 0; i < 5; i++) {
          const a = a0 + (i - 2) * 0.16 + (K.rnd() - 0.5) * 0.08; if (Math.abs(norm2(a)) < 0.8 || Math.abs(norm2(a - Math.PI)) < 0.8) continue;
          const d = R + 34 + K.rnd() * 55, x = Math.sin(a) * d, z = Math.cos(a) * d, s = 4 + K.rnd() * 4, ci = (vi + i) % P.crys.length, y = -6 + K.rnd() * 12;
          K.model(i % 2 ? 'cristal_c' : 'cristal_a', x, y, z, { s, ry: K.rnd() * TAU, col: ci, gi: 1.25 });
          K.light(x, y + 4 * s, z, P.crys[ci], 1.5, 8 * s);
          K.spike('rock', x + (K.rnd() - 0.5) * 20, 44 + K.rnd() * 10, z + (K.rnd() - 0.5) * 20, 18 + K.rnd() * 16, 3 + K.rnd() * 2, -1);
        }
        // colonnes géantes au loin
        for (let i = 0; i < 3; i++) { const a = a0 + (i - 1) * 0.3, d = R + 60 + K.rnd() * 40; if (Math.abs(norm2(a)) < 0.8 || Math.abs(norm2(a - Math.PI)) < 0.8) continue; K.lathe('rock', Math.sin(a) * d, Math.cos(a) * d, -20, 70, t => 7 - Math.sin(t * Math.PI) * 4, 8, K.rockFn({ y0: -10, yh: 60, moss: 0 })); }
      });
    },

    finish(B, room, L0, A2) { if (B.gk) B.gk.build(); },
  };
})();

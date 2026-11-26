/* ===== arena/maps/citadelle.js : thème de la carte « citadelle » (voir js/arena/maps/README-CARTES.md) =====
   L'intérieur d'une forteresse : une cour d'honneur entourée d'arcades, avec une galerie à l'étage (deux grands escaliers),
   de hauts murs percés de vitraux, des tours d'entrée ; une chapelle-salle du trône voûtée ; des salles d'armes charpentées.
   Modèles Blender : outils/blender-map-citadelle.py → assets-map-citadelle.js. Leur géométrie est FUSIONNÉE avec le reste de
   la salle par matériau (le nom de chaque matériau Blender est une clé de B.mats) : peu d'appels de dessin.
   Ambiances : 1-5 la cour au soleil doré, 6-10 les remparts au crépuscule, 11+ la citadelle assiégée, de nuit. */
(function () {
  const BR = window.BR, DG = BR.Dungeon, A = DG.api, L = A.L, BOX = A.BOX;
  const M = DG.mapOf('citadelle');
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, DEG = PI / 180;
  DG.THEMES = DG.THEMES || {};

  /* =====================================================================
     AMBIANCES (étages 1-5, 6-10, 11+)
     champs en plus du moteur : stone2 (pierre foncée), wood2, roof, carpet, glass (4 verres), glassK (éclat des vitraux),
     pool (taches colorées au sol), shaft (rayons), vault (voûte peinte), lamp (lanternes), fire (incendies au loin)
     ===================================================================== */
  M.stars = false; M.exp = 0.9; M.d = 'Cour d\'honneur, galeries et salle du trône d\'une forteresse de pierre dorée.';
  M.tiers = [
    { n: 'La Cour d\'honneur', stone: '#c9b28c', stone2: '#9c8466', mortar: '#6a5640', floor: '#a08462', trim: '#efe2c6', wood: '#8a5a32', wood2: '#5a3820', metal: '#5c606c',
      accent: '#ffb35a', banner: '#b3262a', carpet: '#9a1f28', roof: '#4d6aa0', moss: 0,
      glass: ['#2f63d8', '#e0402e', '#f4c444', '#3cb062'], glassK: 0.85, cloud: '#fff6ea', pool: 0.32, shaft: 0.16, vault: '#243a78', lamp: '#ffc070',
      sky: ['#3c6cb4', '#9cc0e0', '#ffe0a8'], fog: ['#e2c8a0', 0.0052], hemi: ['#fff1da', '#6e5236', 0.78], moon: ['#ffd9a0', 2.1] },
    { n: 'Les Remparts au crépuscule', stone: '#c0a490', stone2: '#8a6e66', mortar: '#4e3a36', floor: '#9c8476', trim: '#f0d2bc', wood: '#7a4a30', wood2: '#4a2a1e', metal: '#4e4c5a',
      accent: '#ff9448', banner: '#2a56a6', carpet: '#7a1a3a', roof: '#3c4a74', moss: 0, stars: true,
      glass: ['#3a5ae0', '#ff5a36', '#ffc84a', '#9a4ae0'], glassK: 1.5, cloud: '#e8a0a8', pool: 0.5, shaft: 0.24, vault: '#1c2458', lamp: '#ffa850',
      sky: ['#1a1c4a', '#7a4a7c', '#ff9a58'], fog: ['#6a4a5c', 0.0062], hemi: ['#b4a6e0', '#4a2c30', 0.9], moon: ['#ffb27e', 1.85] },
    { n: 'La Citadelle assiégée', stone: '#8a8e9e', stone2: '#565a6c', mortar: '#262a34', floor: '#666c7c', trim: '#d4c8dc', wood: '#5a3a28', wood2: '#34201a', metal: '#44424e',
      accent: '#ff7a36', banner: '#6e1a2a', carpet: '#5a1424', roof: '#2c3248', moss: 0, stars: true, fire: true,
      glass: ['#3a4ad8', '#ff4a2a', '#ffb43a', '#c03ad8'], glassK: 2.1, cloud: '#3a3450', pool: 0.75, shaft: 0.3, vault: '#10142e', lamp: '#ff9a44',
      sky: ['#05060f', '#1a1634', '#7a2a22'], fog: ['#1c1622', 0.0078], hemi: ['#7088cc', '#262024', 0.85], moon: ['#b0c4ff', 1.35] },
  ];

  /* =====================================================================
     TEXTURES (dessinées une fois par ambiance, gardées)
     ===================================================================== */
  const TC = {};
  const hexc = c => '#' + c.getHexString();
  function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }
  // une pierre taillée : à plat, biseau clair en haut / sombre en bas (style KayKit, pas de bruit photo)
  function stoneBlock(g, x, y, w, h, col, pad) {
    g.fillStyle = hexc(col); rrect(g, x + pad, y + pad, w - pad * 2, h - pad * 2, 6);
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(x + pad + 3, y + pad + 1, w - pad * 2 - 6, 4);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + pad + 1, y + pad + 3, 3, h - pad * 2 - 6);
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x + pad + 3, y + h - pad - 6, w - pad * 2 - 6, 5);
    g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x + w - pad - 4, y + pad + 3, 3, h - pad * 2 - 6);
  }
  // rangées de pierres de largeurs variées qui bouclent exactement (texture sans couture)
  function courses(g, n, rows, nMin, nMax, base, r, pad, vary) {
    const h = n / rows;
    for (let y = 0; y < rows; y++) {
      const k = nMin + Math.floor(r() * (nMax - nMin + 1)), ws = []; let sum = 0;
      for (let i = 0; i < k; i++) { const w = 0.7 + r() * 0.6; ws.push(w); sum += w; }
      let x = r() * n;
      ws.forEach(w0 => {
        const w = w0 / sum * n, cc = base.clone().multiplyScalar(1 - vary / 2 + r() * vary); cc.offsetHSL((r() - 0.5) * 0.012, 0, 0);
        for (const ox of [-n, 0]) stoneBlock(g, x + ox, y * h, w, h, cc, pad);
        x += w; if (x > n) x -= n;
      });
    }
  }
  function wallTex(P) {
    const key = 'w' + P.id; if (TC[key]) return TC[key];
    const r = A.rnd(311), base = new THREE.Color(P.stone);
    const c = A.cv(512, (g, n) => { g.fillStyle = hexc(base.clone().multiplyScalar(0.6)); g.fillRect(0, 0, n, n); courses(g, n, 6, 3, 4, base, r, 3, 0.2); });
    return (TC[key] = A.mkTex(c));
  }
  function floorTex(P) {
    const key = 'f' + P.id; if (TC[key]) return TC[key];
    const r = A.rnd(97), base = new THREE.Color(P.floor);
    const c = A.cv(512, (g, n) => {
      g.fillStyle = hexc(base.clone().multiplyScalar(0.5)); g.fillRect(0, 0, n, n); courses(g, n, 6, 4, 6, base, r, 3, 0.28);
      for (let i = 0; i < 10; i++) { g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1.5; g.beginPath(); let x = r() * n, y = r() * n; g.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    });
    return (TC[key] = A.mkTex(c));
  }
  // grain léger (pierre claire, ardoise) : casse l'aspect plastique sans faire « photo »
  function grainTex() {
    if (TC.grain) return TC.grain;
    const r = A.rnd(5), c = A.cv(128, (g, n) => {
      g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 260; i++) { const v = 205 + r() * 50; g.fillStyle = `rgba(${v},${v},${v},0.6)`; g.fillRect(r() * n, r() * n, 2 + r() * 7, 2 + r() * 5); }
    });
    return (TC.grain = A.mkTex(c));
  }
  // tuiles d'ardoise (toits)
  function slateTex() {
    if (TC.slate) return TC.slate;
    const r = A.rnd(23), c = A.cv(128, (g, n) => {
      g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, n, n);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 200 + r() * 55; g.fillStyle = `rgb(${v},${v},${v})`; rrect(g, x * 16 + (y % 2) * 8 + 1, y * 16 + 1, 14, 14, 4); }
    });
    return (TC.slate = A.mkTex(c));
  }
  // voûte peinte : bleu nuit semé d'étoiles d'or, frise rouge et or à la naissance
  function vaultTex(P) {
    const key = 'v' + P.id; if (TC[key]) return TC[key];
    const r = A.rnd(71), c = A.cv(256, (g, n) => {
      g.fillStyle = P.vault; g.fillRect(0, 0, n, n);
      const star = (x, y, s) => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - PI / 2, d = k % 2 ? s * 0.42 : s; g.lineTo(x + cos(a) * d, y + sin(a) * d); } g.closePath(); g.fill(); };
      g.fillStyle = '#e8b84a';
      for (let i = 0; i < 22; i++) { const x = r() * n, y = r() * n * 0.82; for (const ox of [-n, 0, n]) star(x + ox, y, 4 + r() * 4); }
      g.fillStyle = '#a82a2a'; g.fillRect(0, n * 0.88, n, n * 0.12);
      g.fillStyle = '#e8b84a'; g.fillRect(0, n * 0.86, n, 5); g.fillRect(0, n * 0.97, n, 4);
      for (let x = 8; x < n; x += 32) { g.beginPath(); g.moveTo(x, n * 0.9); g.lineTo(x + 8, n * 0.925); g.lineTo(x, n * 0.95); g.lineTo(x - 8, n * 0.925); g.fill(); }
    });
    c.getContext('2d');
    const t = A.mkTex(c); t.repeat.set(5, 1); t.wrapT = THREE.ClampToEdgeWrapping; t.flipY = false;
    return (TC[key] = t);
  }
  // rayon de lumière : bandes aux couleurs des vitraux, s'estompe sur les bords et vers le bout (u : en travers, v : le long)
  function shaftTex(P) {
    const key = 's' + P.id; if (TC[key]) return TC[key];
    const cols = [P.glass[0], P.glass[1], P.glass[2], P.glass[3], P.glass[0]].map(c => new THREE.Color(c).lerp(new THREE.Color('#fff2d8'), 0.45));
    const c = A.cv(64, (g, n, h) => {
      const im = g.createImageData(n, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < n; x++) {
        const u = x / (n - 1), v = y / (h - 1), a = Math.pow(sin(u * PI), 1.2) * Math.min(1, v * 8) * Math.pow(1 - v, 1.8) * (0.75 + 0.25 * sin(u * 31 + v * 5));
        const cc = cols[Math.min(4, Math.floor(u * 5))], i = (y * n + x) * 4;
        im.data[i] = cc.r * 255; im.data[i + 1] = cc.g * 255; im.data[i + 2] = cc.b * 255; im.data[i + 3] = Math.round(a * 255);
      }
      g.putImageData(im, 0, 0);
    }, 128);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (TC[key] = t);
  }
  // tache de lumière colorée (le vitrail projeté au sol)
  function poolTex(P) {
    const key = 'p' + P.id; if (TC[key]) return TC[key];
    const G = P.glass, c = A.cv(128, (g, n, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, n, h);
      if ('filter' in g) g.filter = 'blur(5px)';
      const cw = n / 4, rh = h / 6;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { g.fillStyle = (i === 0 || i === 3) ? G[0] : (j === 2 || j === 3) ? ((i + j) % 2 ? G[2] : G[1]) : ((i + j) % 2 ? G[1] : G[3]); g.fillRect(i * cw + 4, j * rh + 4, cw - 8, rh - 8); }
      if ('filter' in g) g.filter = 'none';
      // bords doux
      const im = g.getImageData(0, 0, n, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < n; x++) { const k = Math.min(1, x / 18, (n - 1 - x) / 18, y / 26, (h - 1 - y) / 26), i = (y * n + x) * 4; for (let q = 0; q < 3; q++) im.data[i + q] = Math.round(im.data[i + q] * Math.max(0, k)); }
      g.putImageData(im, 0, 0);
    }, 192);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (TC[key] = t);
  }

  /* =====================================================================
     MODÈLES BLENDER → géométries par matériau (mises en cache), fusionnées dans la salle
     ===================================================================== */
  const GEO = {};
  function parts(name) {
    if (GEO[name]) return GEO[name];
    const sc = A.model('map_citadelle_' + name); if (!sc) return null;
    sc.updateMatrixWorld(true);
    const list = [];
    sc.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const src = o.geometry, g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position.clone());
      if (src.attributes.normal) g.setAttribute('normal', src.attributes.normal.clone());
      if (src.index) g.setIndex(src.index.clone());
      g.applyMatrix4(o.matrixWorld);
      if (!src.attributes.normal) g.computeVertexNormals();
      const k = String((o.material && o.material.name) || 'trim').split('.')[0];
      list.push({ k, g: g.index ? g.toNonIndexed() : g });   // non indexée une fois pour toutes (B.add n'a plus qu'à copier)
    });
    return (GEO[name] = list);
  }
  /** pose un modèle (fusionné par matériau) ; o : { sx, sy, sz, rx, rz } */
  function put(B, name, x, y, z, ry, s, o) {
    const ps = parts(name); if (!ps) return false;
    s = s || 1; o = o || {};
    for (const p of ps) B.add(B.mats[p.k] ? p.k : 'trim', p.g, x, y, z, ry || 0, o.rx || 0, o.rz || 0, (o.sx || 1) * s, (o.sy || 1) * s, (o.sz || 1) * s);
    return true;
  }

  /* =====================================================================
     OUTILS DE CONSTRUCTION
     ===================================================================== */
  const at = (a, r) => [sin(a) * r, cos(a) * r];
  // mur courbe (boîtes) : face intérieure au rayon R0, de l'angle a0 à a1
  function ringWall(B, R0, T, H, a0, a1, step) {
    const n = Math.max(1, Math.ceil((a1 - a0) * R0 / step)), da = (a1 - a0) / n;
    for (let i = 0; i < n; i++) {
      const am = a0 + (i + 0.5) * da, len = 2 * (R0 + T) * Math.tan(da / 2) + 0.06, [x, z] = at(am, R0 + T / 2);
      B.add('wall', BOX, x, H / 2, z, am, 0, 0, len, H, T);
      B.solid(x, z, len / 2, T / 2, am, -2, H + 30);
    }
  }
  // bandeau le long d'un mur courbe (corniche, plinthe), en saillie de d vers la salle
  function ringBand(B, mat, R0, d, y0, y1, a0, a1, step) {
    const n = Math.max(1, Math.ceil((a1 - a0) * R0 / step)), da = (a1 - a0) / n;
    for (let i = 0; i < n; i++) { const am = a0 + (i + 0.5) * da, len = 2 * R0 * Math.tan(da / 2) + 0.04, [x, z] = at(am, R0 - d / 2 + 0.05); B.add(mat, BOX, x, (y0 + y1) / 2, z, am, 0, 0, len, y1 - y0, d + 0.1); }
  }
  // merlons sur le haut d'un mur courbe
  function merlons(B, Rm, y, a0, a1, T) {
    const n = Math.max(1, Math.floor((a1 - a0) * Rm / 2.4));
    for (let i = 0; i < n; i++) { const a = a0 + (i + 0.5) * (a1 - a0) / n, [x, z] = at(a, Rm); B.add('wall', BOX, x, y + 0.6, z, a, 0, 0, 1.25, 1.2, T); B.add('trim', BOX, x, y + 1.25, z, a, 0, 0, 1.4, 0.12, T + 0.15); }
  }
  // décor plat posé au sol (dallage, tapis) : fusionné à part, sans ombre portée
  function dec(B, key, geo, x, y, z, ry) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0), new THREE.Vector3(1, 1, 1)));
    (B._cit.dec[key] = B._cit.dec[key] || []).push(g);
  }
  function decBox(B, key, x, y, z, w, h, d, ry) { const g = new THREE.BoxGeometry(w, h, d); dec(B, key, g, x, y, z, ry); g.dispose(); }
  function decRing(B, key, r0, r1, y, seg) { const g = new THREE.RingGeometry(r0, r1, seg || 64); g.rotateX(-PI / 2); dec(B, key, g, 0, y, 0); g.dispose(); }
  // grand brasero (modèle) + flamme + lumière
  function brazier(B, x, z, s, light) {
    s = s || 1.2;
    if (!put(B, 'brasero', x, 0, z, B.rnd() * 6, s)) A.brazier(B, x, z, light);
    else { B.flame(x, 1.75 * s + 0.35, z, 1.5 * s, light); B.cyl(x, z, 0.7 * s, -1, 1.8 * s); B.obstacles.push({ x, z, r: 0.75 * s, h: 1.8 * s }); }
  }
  function candelabre(B, x, y, z, light) {
    put(B, 'candelabre', x, y, z, B.rnd() * 6, 1);
    B.cyl(x, z, 0.4, -1, y + 2.4);
    if (light) B.spot(x, y + 2.5, z, B.P.lamp, 1.5, { dist: 11, flick: true });
  }
  // rayons de lumière (vitraux) : prismes additifs depuis le rectangle de la fenêtre, suivant la direction d, jusqu'au sol
  const SUN = new THREE.Vector3(30, -60, -40).normalize();   // la lumière principale du moteur vient de (-30, 60, 40)
  function shafts(B, wins, k, floorY) {
    if (!wins.length || k <= 0) return;
    const pos = [], uv = [], ppos = [], puv = [], d = SUN, fy = floorY == null ? 0.04 : floorY;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const w of wins) {
      const c = [V(w.x, 0, w.z).addScaledVector(w.t, -w.w / 2), V(w.x, 0, w.z).addScaledVector(w.t, w.w / 2)];
      const n0 = [c[0].clone().setY(w.y0), c[1].clone().setY(w.y0), c[1].clone().setY(w.y1), c[0].clone().setY(w.y1)];   // bas-g, bas-d, haut-d, haut-g
      const f0 = n0.map(p => p.clone().addScaledVector(d, (p.y - fy) / -d.y));
      const quad = (a, b, A2, B2) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, B2.x, B2.y, B2.z, a.x, a.y, a.z, B2.x, B2.y, B2.z, A2.x, A2.y, A2.z); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(n0[i], n0[j], f0[i], f0[j]); }
      if (w.pool !== false) { const p = f0.map(q => q.clone().setY(fy)); ppos.push(p[0].x, fy, p[0].z, p[1].x, fy, p[1].z, p[2].x, fy, p[2].z, p[0].x, fy, p[0].z, p[2].x, fy, p[2].z, p[3].x, fy, p[3].z); puv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
    }
    const mk = (P2, U2, map, col, op) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2));
      const m = new THREE.MeshBasicMaterial({ map, color: L(col).multiplyScalar(op), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const me = new THREE.Mesh(g, m); me.renderOrder = 4; me.frustumCulled = false; B.g.add(me); B.disposables.push(g, m);
    };
    mk(pos, uv, shaftTex(B.P), '#ffffff', k * 2.0);
    if (ppos.length) mk(ppos, puv, poolTex(B.P), '#ffffff', Math.min(1.6, k * 5));
  }
  // taches de vitrail sur un sol (devant une fenêtre) : { x, z, a (orientation), w, d, y }
  function pools(B, list, k) {
    if (!list.length || k <= 0) return;
    const pos = [], uv = [];
    for (const p of list) {
      const t = [cos(p.a), -sin(p.a)], n = [-sin(p.a), -cos(p.a)];      // tangente, vers le centre
      const C = (u, v) => [p.x + t[0] * u + n[0] * v, p.z + t[1] * u + n[1] * v];
      const q = [C(-p.w / 2, 0), C(p.w / 2, 0), C(p.w / 2 + 0.4, p.d), C(-p.w / 2 - 0.4, p.d)];
      [[0, 1, 2], [0, 2, 3]].forEach(tri => tri.forEach(i => { pos.push(q[i][0], p.y, q[i][1]); uv.push([0, 1, 1, 0][i], [1, 1, 0, 0][i]); }));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.MeshBasicMaterial({ map: poolTex(B.P), color: new THREE.Color(k, k, k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const me = new THREE.Mesh(g, m); me.renderOrder = 3; B.g.add(me); B.disposables.push(g, m);
  }
  // nervure (boîte orientée entre deux points)
  const _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
  function beam(B, mat, a, b, w, h) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length(); d.normalize();
    _q.setFromUnitVectors(_z, d);
    const g = new THREE.BoxGeometry(w, h, len + 0.08); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1)));
    B.add(mat, g, 0, 0, 0); g.dispose();
  }
  function ownMesh(B, geo, mat, shadow) { const m = new THREE.Mesh(geo, mat); m.castShadow = !!shadow; m.receiveShadow = true; B.g.add(m); B.disposables.push(geo, mat); return m; }

  /* =====================================================================
     LA COUR D'HONNEUR (grande salle de combat)
     ===================================================================== */
  const HW = 15, RC = 30, D10 = 10 * DEG, BAL = 6.73;   // hauteur des murs, rayon des colonnes, une travée = 10°, niveau du balcon
  // le moteur ne monte pas les marches en marchant (une marche se saute) : l'escalier d'honneur est fait de six
  // gradins de 1,12 m (un saut simple chacun), dont la face avant porte deux contremarches sculptées
  function stairs(B, ac) {
    const rIn = 26.3, rOut = 29.2, rm = (rIn + rOut) / 2, wd = rOut - rIn, span = 9.6 / rm, lh = 2.5 / rm, NV = 6;
    for (const f of [-1, 1]) {
      for (let k = 1; k <= NV; k++) {
        const t0 = (NV - k) / NV, t1 = (NV - k + 1) / NV, a = ac + f * (lh + (t0 + t1) / 2 * span), top = BAL * k / (NV + 1) * (NV + 1) / NV, [x, z] = at(a, rm), w = span / NV * rOut + 0.04;
        B.add('wall', BOX, x, (top - 0.14) / 2, z, a, 0, 0, w, top - 0.14, wd);
        B.add('trim', BOX, x, top - 0.07, z, a, 0, 0, w + 0.06, 0.14, wd + 0.14);
        // contremarche sculptée (fausse marche) au pied de chaque gradin
        const af = ac + f * (lh + t1 * span) - f * 0.22 / rm, [fx, fz] = at(af, rm);
        B.add('pierre2', BOX, fx, top - BAL / NV / 2, fz, a, 0, 0, 0.44, 0.12, wd + 0.02);
        for (const rr of [rIn + 0.12, rOut - 0.12]) { const [px, pz] = at(a, rr); B.add('trim', BOX, px, top + 0.14, pz, a, 0, 0, w, 0.28, 0.26); }
        B.solid(x, z, w / 2, wd / 2, a, -1, top);
        for (const dr of [-0.75, 0.75]) { const [ox, oz] = at(a, rm + dr); B.obstacles.push({ x: ox, z: oz, r: 0.8, h: top - 0.06 }); }   // les monstres (sans physique) contournent
        if (k % 2 === 0) { const [lx, lz] = at(ac + f * (lh + t0 * span) + f * 0.3 / rm, rIn + 0.2); put(B, 'candelabre', lx, top, lz, a, 0.9); B.spot(lx, top + 2.4, lz, B.P.lamp, 1.2, { dist: 9, flick: true }); }
      }
    }
    // palier (pont au-dessus d'un passage) relié au balcon
    const rL = 29.6, [x, z] = at(ac, (rIn + rL) / 2), wl = 2 * lh * rL + 0.12, dl = rL - rIn;
    B.add('pierre2', BOX, x, BAL - 0.33, z, ac, 0, 0, wl, 0.6, dl);
    B.add('floor', BOX, x, BAL - 0.02, z, ac, 0, 0, wl, 0.06, dl);
    B.add('trim', BOX, x, BAL - 0.62, z, ac, 0, 0, wl + 0.1, 0.12, dl + 0.1);
    B.solid(x, z, wl / 2, dl / 2, ac, 6.0, BAL + 0.01);
    const [bx, bz] = at(ac, rIn + 0.2), lb = 2 * lh * rIn;
    put(B, 'balustrade', bx, BAL, bz, ac + PI, 1, { sx: lb / 5.24 }); B.solid(bx, bz, lb / 2, 0.24, ac, BAL, BAL + 1.1);
    const [lx, lz] = at(ac, rm); put(B, 'lanterne', lx, BAL - 0.65, lz, 0, 1); B.spot(lx, 4.6, lz, B.P.lamp, 1.4, { dist: 10 });
  }
  function hall(B, room, rng, o, A2) {
    const R = A.ROOM_R + 0.9, P = B.P, boss = !!(o && (o.boss || o.pillars === false)), gd = 3.45 / R;
    B.floorDisc(0, 0, R + 0.5);
    const winList = [];
    for (const s of [1, -1]) {
      const a0 = s > 0 ? gd : -PI + gd, a1 = s > 0 ? PI - gd : -gd;
      ringWall(B, R, 1.8, HW, a0, a1, 4.6);
      ringBand(B, 'trim', R, 0.55, HW - 0.6, HW - 0.05, a0, a1, 4.6);
      ringBand(B, 'pierre2', R, 0.3, 0, 0.55, a0, a1, 4.6);
      merlons(B, R + 1.2, HW, s > 0 ? 0.2 : -PI + 0.2, s > 0 ? PI - 0.2 : -0.2, 1.2);
      // arcade : colonnes à 20°..160°, pilastres au mur, poutres sous le balcon
      for (let k = 2; k <= 16; k++) {
        const a = s * k * D10, [x, z] = at(a, RC);
        put(B, 'colonne', x, 0, z, a + PI);
        B.cyl(x, z, 0.55, -1, 6.0); B.obstacles.push({ x, z, r: 0.7, h: 6 });
        const [wx, wz] = at(a, R - 0.2); B.add('pierre2', BOX, wx, 3.0, wz, a, 0, 0, 0.95, 6.0, 0.5);
        const [ux, uz] = at(a, R - 0.25); B.add('trim', BOX, ux, (BAL + HW - 0.6) / 2, uz, a, 0, 0, 1.0, HW - 0.6 - BAL, 0.6);
        const [bx, bz] = at(a, (RC + R) / 2 + 0.2); B.add('bois2', BOX, bx, 5.84, bz, a, 0, 0, 0.36, 0.4, R - RC - 0.4);
      }
      for (let k = 2; k < 16; k++) {
        const am = s * (k + 0.5) * D10, [x, z] = at(am, RC * cos(D10 / 2));
        put(B, 'arcade', x, 0, z, am + PI);
        // lanterne sous la galerie
        const [lx, lz] = at(am, (RC + R) / 2 + 0.3); put(B, 'lanterne', lx, 6.0, lz, am, 1);
        if (k % 2 === 0) B.spot(lx, 4.5, lz, P.lamp, 1.5, { dist: 12 });
        // mur du haut : vitrail (travées paires) ou bannière + armure (impaires)
        if (k % 2 === 0) {
          const [vx, vz] = at(am, R - 0.24); put(B, 'vitrail', vx, BAL + 0.85, vz, am + PI, 1);
          const [px, pz] = at(am, R - 0.5); winList.push({ x: px, z: pz, a: am, w: 2.4, d: 3.6, y: BAL + 0.04 });
          const [sx, sz] = at(am, R - 3); B.spot(sx, BAL + 3.5, sz, P.glass[(k / 2) % 4], 0.9 * P.glassK, { dist: 9 });
        } else {
          const [bx, bz] = at(am, R - 0.14); put(B, 'banniere', bx, HW - 1.3, bz, am + PI, 1.25);
          const [ax, az] = at(am, R - 0.95); put(B, 'armure', ax, BAL, az, am + PI, 1.05); B.cyl(ax, az, 0.45, BAL - 0.1, BAL + 2.3);
        }
        // galerie du bas : râteliers, tonneaux, armures, tables, trophées
        const kind = (k + (s > 0 ? 0 : 2)) % 5, [gx, gz] = at(am, R - 0.75);
        if (kind === 0) { put(B, 'ratelier', gx, 0, gz, am + PI); B.solid(gx, gz, 1.45, 0.4, am, -1, 2.3); for (const t of [-0.8, 0.8]) { const [ox, oz] = at(am + t / (R - 0.75), R - 0.75); B.obstacles.push({ x: ox, z: oz, r: 0.6, h: 2.3 }); } const [tx, tz] = at(am, R - 0.08); put(B, 'trophee', tx, 3.9, tz, am + PI); }
        else if (kind === 1) { const [cx, cz] = at(am, R - 1.0); put(B, 'tonneaux', cx, 0, cz, am + PI + 0.3); B.cyl(cx, cz, 1.25, -1, 2.2); B.obstacles.push({ x: cx, z: cz, r: 1.3, h: 2.2 }); }
        else if (kind === 2) { for (const t of [-1.1, 1.1]) { const a2 = am + t / (R - 0.9), [ax, az] = at(a2, R - 0.9); put(B, 'armure', ax, 0, az, a2 + PI); B.cyl(ax, az, 0.45, -1, 2.3); B.obstacles.push({ x: ax, z: az, r: 0.5, h: 2.3 }); } const [tx, tz] = at(am, R - 0.08); put(B, 'trophee', tx, 3.9, tz, am + PI); }
        else if (kind === 3) { const [cx, cz] = at(am, R - 1.85); put(B, 'banc', cx, 0, cz, am + PI); B.solid(cx, cz, 1.45, 1.1, am, -1, 1.0); for (const t of [-0.8, 0.8]) { const [ox, oz] = at(am + t / (R - 1.85), R - 1.85); B.obstacles.push({ x: ox, z: oz, r: 1.0, h: 1.0 }); } }
        else { const [tx, tz] = at(am, R - 0.08); put(B, 'trophee', tx, 3.6, tz, am + PI, 1.2); const [cx, cz] = at(am, R - 0.8); candelabre(B, cx, 0, cz, false); }
      }
      // balcon (dalle + garde-corps), du bord de la tour d'entrée à l'autre
      const segs = [[13.5, 20]]; for (let k = 2; k < 16; k++) segs.push([k * 10, k * 10 + 10]); segs.push([160, 166.5]);
      for (const [d0, d1] of segs) {
        const a0b = s * d0 * DEG, a1b = s * d1 * DEG, am = (a0b + a1b) / 2, da = Math.abs(a1b - a0b);
        const r0 = 29.45, r1 = R + 0.4, rm = (r0 + r1) / 2, w = 2 * r1 * Math.tan(da / 2) + 0.12, d = r1 - r0, [x, z] = at(am, rm);
        B.add('pierre2', BOX, x, BAL - 0.33, z, am, 0, 0, w, 0.6, d);
        B.add('floor', BOX, x, BAL - 0.02, z, am, 0, 0, w, 0.06, d);
        B.add('bois2', BOX, x, BAL - 0.66, z, am, 0, 0, w - 0.06, 0.1, d - 0.5);
        B.solid(x, z, w / 2, d / 2, am, 5.6, BAL + 0.01);
        if (d0 === 90) continue;     // le palier de l'escalier
        const rb = 29.72, len = 2 * rb * sin(da / 2), [bx, bz] = at(am, rb * cos(da / 2));
        put(B, 'balustrade', bx, BAL, bz, am + PI, 1, { sx: len / 5.24 });
        B.solid(bx, bz, len / 2, 0.24, am, BAL, BAL + 1.1);
      }
      stairs(B, s * 95 * DEG);
      // le balcon s'arrête contre les tours d'entrée : garde-corps de bout
      for (const d of [13.7, 166.3]) { const a = s * d * DEG, [x, z] = at(a, 31.2); put(B, 'balustrade', x, BAL, z, a + PI / 2, 1, { sx: 0.62 }); B.solid(x, z, 0.24, 1.65, a, BAL, BAL + 1.1); }
      // échauguettes sur le haut du mur
      for (const d of [50, 130]) { const a = s * d * DEG, [x, z] = at(a, R + 0.55); put(B, 'tourelle', x, HW + 0.4, z, a + PI, 1); }
    }
    // portes et tours d'entrée (nord et sud) : deux grosses tours rondes, archivolte, rosace, bannières
    const entrance = A.door(B, 0, -(R + 0.2), PI, { open: true });
    const exit = A.door(B, 0, R + 0.2, 0);
    for (const ad of [0, PI]) {
      const zs = cos(ad);
      for (const sx of [-1, 1]) {
        const x = sx * 6.6, z = zs * (R - 1.0);
        put(B, 'tour', x, 0, z, ad + PI + sx * 0.3, 1);
        B.cyl(x, z, 2.45, -2, 60); B.obstacles.push({ x, z, r: 2.6, h: 60 });
        put(B, 'banniere', x - sx * 0.2, 16.6, z - zs * 2.42, ad + PI + sx * 0.1, 1.2);
        // statue du gardien de la porte
        const sxp = sx * 8.1, szp = zs * 26.4, as = Math.atan2(sxp, szp);
        put(B, 'statue', sxp, 0, szp, as + PI);
        B.cyl(sxp, szp, 0.95, -1, 13); B.obstacles.push({ x: sxp, z: szp, r: 1.1, h: 13 });
      }
      B.add('wall', BOX, 0, 14.6, zs * (R - 0.45), 0, 0, 0, 9.6, 13.2, 1.3);
      B.solid(0, zs * (R - 0.45), 4.8, 0.65, 0, 8.0, 40);
      B.add('trim', BOX, 0, 21.2, zs * (R - 0.5), 0, 0, 0, 10.0, 0.3, 1.6);
      for (let i = 0; i < 4; i++) B.add('wall', BOX, -3.6 + i * 2.4, 21.9, zs * (R - 0.5), 0, 0, 0, 1.3, 1.2, 1.3);
      put(B, 'portail', 0, 0, zs * (R - 1.1), ad + PI, 1);
      put(B, 'rosace', 0, 16.3, zs * (R - 1.15), ad + PI, 1.05);
      // tapis jusqu'à la porte
      decBox(B, 'carpet', 0, 0.015, zs * (R + 10.8) / 2 - zs * 0.6, 3.4, 0.03, R - 12.0, 0);
      for (const sx of [-1, 1]) decBox(B, 'gold', sx * 1.6, 0.02, zs * (R + 10.8) / 2 - zs * 0.6, 0.14, 0.03, R - 12.0, 0);
    }
    // dallage : médaillon central, étoile, cercle de combat
    decRing(B, 'pierre2', 0, 2.6, 0.012, 32);
    decRing(B, 'gold', 2.6, 2.9, 0.016, 32);
    { const sh = new THREE.Shape(); sh.moveTo(0, 2.9); sh.lineTo(1.0, 5.2); sh.lineTo(0, 9.6); sh.lineTo(-1.0, 5.2); sh.closePath(); const g = new THREE.ShapeGeometry(sh); g.rotateX(-PI / 2);
      for (let i = 0; i < 8; i++) dec(B, i % 2 ? 'pierre2' : 'gold', g, 0, 0.014, 0, i * PI / 4 + PI / 8); g.dispose(); }
    decRing(B, 'pierre2', 9.6, 10.6, 0.012, 64);
    decRing(B, 'gold', 9.9, 10.15, 0.016, 64);
    decRing(B, 'pierre2', 25.6, 26.3, 0.012, 96);
    for (let i = 0; i < 8; i++) {      // allées rayonnantes de pierre sombre entre le médaillon et le cercle de combat
      const a = i * PI / 4 + PI / 8, sh = new THREE.Shape(); sh.moveTo(-0.55, -10.6); sh.lineTo(-1.3, -25.6); sh.lineTo(1.3, -25.6); sh.lineTo(0.55, -10.6); sh.closePath();
      const g = new THREE.ShapeGeometry(sh); g.rotateX(-PI / 2); dec(B, 'pierre2', g, 0, 0.011, 0, a); g.dispose();
    }
    decRing(B, 'trim', 29.0, 29.3, 0.012, 96);
    // braseros : quatre au milieu (sauf boss), quatre en bordure (diagonales)
    for (const a of [PI / 4, 3 * PI / 4, -PI / 4, -3 * PI / 4]) {
      if (!boss) brazier(B, sin(a) * 14, cos(a) * 14, 1.15, true);
      brazier(B, sin(a) * 27.3, cos(a) * 27.3, 1.3, true);
    }
    B._cit.pools = winList;
    return { R, entrance, exits: [exit], spawn: { x: 0, z: -(R - 7.5), yaw: 0 }, rewardAt: new A.V3(0, 0, 0), citHall: true };
  }

  /* =====================================================================
     LA CHAPELLE / SALLE DU TRÔNE (salle calme) : rotonde voûtée d'ogives peinte, vitraux, rayons de lumière
     ===================================================================== */
  function chapel(B, room, rng) {
    const R = 17, H = 13, P = B.P, gd = 3.45 / R, VS = 9.8, APEX = 21;
    B.floorDisc(0, 0, R + 0.5);
    for (const s of [1, -1]) {
      const a0 = s > 0 ? gd : -PI + gd, a1 = s > 0 ? PI - gd : -gd;
      ringWall(B, R, 1.4, H, a0, a1, 3.2);
      ringBand(B, 'pierre2', R, 0.3, 0, 0.6, a0, a1, 3.2);
      ringBand(B, 'trim', R, 0.35, VS - 0.2, VS + 0.15, a0, a1, 3.2);
    }
    const entrance = A.door(B, 0, -(R + 0.2), PI, { open: true });
    const exit = A.door(B, 0, R + 0.2, 0, { w: 4.2 });
    // piliers + nervures jusqu'à la clé de voûte
    const piers = [20, 45, 75, 105, 135, 160, -20, -45, -75, -105, -135, -160];
    for (const d of piers) {
      const a = d * DEG, [x, z] = at(a, R - 0.5);
      put(B, 'pilier', x, 0, z, a + PI, 1, { sy: VS / 8.16 });
      B.cyl(x, z, 0.75, -1, 40); B.obstacles.push({ x, z, r: 0.8, h: 40 });
      let prev = null;
      for (let i = 0; i <= 9; i++) {
        const t = i / 9 * PI / 2, rr = (R - 1.0) * cos(t), y = VS + 0.2 + (APEX - VS - 0.2) * sin(t), p = new THREE.Vector3(sin(a) * rr, y, cos(a) * rr);
        if (prev) beam(B, i % 3 === 0 ? 'pierre2' : 'trim', prev, p, 0.55, 0.6);
        prev = p;
      }
    }
    // voûte peinte (vue de l'intérieur) et toit conique (vu de l'extérieur) : sans ombre portée
    { const g = new THREE.SphereGeometry(1, 36, 10, 0, TAU, 0, PI / 2); g.scale(R - 0.85, APEX - VS, R - 0.85); g.translate(0, VS, 0);
      ownMesh(B, g, new THREE.MeshStandardMaterial({ map: vaultTex(P), side: THREE.BackSide, roughness: 1, emissive: L(P.vault), emissiveIntensity: 0.25 }), true); }
    // intérieur plus sombre que la cour : les vitraux, les rayons et les cierges ressortent
    B.mats.floor.color.setScalar(0.66); B.mats.wall.color.setScalar(0.82); B.mats.trim.color.multiplyScalar(0.85);
    { const g = new THREE.ConeGeometry(R + 2.4, 12, 24, 1, true); g.translate(0, H + 6, 0); const t = slateTex();
      ownMesh(B, g, new THREE.MeshStandardMaterial({ map: t, color: L(P.roof), roughness: 0.8 }), false);
      put(B, 'tourelle', 0, H + 11.4, 0, 0, 1.1); }
    // vitraux (+ rayons sur le côté du soleil)
    const wins = [];
    for (const d of [32.5, 60, 120, 147.5, -32.5, -60, -120, -147.5]) {
      const a = d * DEG, [x, z] = at(a, R - 0.24); put(B, 'vitrail', x, 2.5, z, a + PI, 1.05);
      const sunny = sin(a) * -0.6 + cos(a) * 0.8 > 0.3;
      const [gx, gz] = at(a, R - 0.12);
      if (sunny) wins.push({ x: gx, z: gz, t: new THREE.Vector3(cos(a), 0, -sin(a)), w: 2.2, y0: 2.6, y1: 9.0 });
      if (d === 60 || d === -120 || d === 147.5 || d === -32.5) { const [sx, sz] = at(a, R - 3); B.spot(sx, 5.5, sz, P.glass[(Math.abs(d) | 0) % 4], 0.8 * P.glassK, { dist: 10 }); }
    }
    // l'est : le trône sur son estrade, sous une grande tenture
    { const a = PI / 2;
      for (const [r0, w, top] of [[12.2, 7.2, 0.3], [13.0, 6.0, 0.6], [13.8, 4.8, 0.9]]) { const r1 = R - 0.1, [x, z] = at(a, (r0 + r1) / 2); B.add('pierre2', BOX, x, top / 2, z, a, 0, 0, w, top, r1 - r0); B.add('trim', BOX, x, top - 0.04, z, a, 0, 0, w + 0.08, 0.08, r1 - r0 + 0.08); B.solid(x, z, w / 2, (r1 - r0) / 2, a, -1, top); }
      decBox(B, 'carpet', (13.8 + R) / 2 - 0.4, 0.93, 0, R - 14.2, 0.04, 3.2, 0);
      const [tx, tz] = at(a, 15.2); put(B, 'trone', tx, 0.9, tz, a + PI, 1.15); B.cyl(tx, tz, 1.0, -1, 13);
      const [bx, bz] = at(a, R - 0.16); put(B, 'banniere', bx, 9.5, bz, a + PI, 1.6);
      for (const t of [-1, 1]) { const a2 = a + t * 0.19, [cx, cz] = at(a2, 13.4); candelabre(B, cx, 0.6, cz, t > 0); const a3 = a + t * 0.27, [hx, hz] = at(a3, R - 0.1); put(B, 'trophee', hx, 5.2, hz, a3 + PI, 1.1); } }
    // l'ouest : statue du chevalier fondateur devant une rosace, cierges
    { const a = -PI / 2, [sx, sz] = at(a, 14.9); put(B, 'statue', sx, 0, sz, a + PI, 1.05); B.cyl(sx, sz, 1.0, -1, 13); B.obstacles.push({ x: sx, z: sz, r: 1.1, h: 13 });
      const [rx, rz] = at(a, R - 0.3); put(B, 'rosace', rx, 6.9, rz, a + PI, 0.95);
      wins.push({ x: rx, z: rz, t: new THREE.Vector3(cos(a), 0, -sin(a)), w: 3.6, y0: 5.1, y1: 8.7 });
      for (const t of [-1, 1]) { const a2 = a + t * 0.16, [cx, cz] = at(a2, 14.6); candelabre(B, cx, 0, cz, t > 0); } }
    // les autres travées
    for (const s of [1, -1]) {
      { const a = s * 60 * DEG, [x, z] = at(a, R - 0.8); if (s > 0) { put(B, 'ratelier', x, 0, z, a + PI); B.solid(x, z, 1.45, 0.4, a, -1, 2.3); } else { put(B, 'tonneaux', x, 0, z, a + PI + 0.4); B.cyl(x, z, 1.2, -1, 2.2); } }
      { const a = s * 120 * DEG; for (const t of [-1.1, 1.1]) { const a2 = a + t / (R - 1), [x, z] = at(a2, R - 1.0); put(B, 'armure', x, 0, z, a2 + PI); B.cyl(x, z, 0.45, -1, 2.3); } }
      for (const d of [32.5, 147.5]) { const a = s * d * DEG, [x, z] = at(a, R - 1.4); candelabre(B, x, 0, z, false); }
    }
    // autour du foyer central (rayon 8 libre) : quatre cierges et un liseré
    for (const d of [40, 140, -40, -140]) { const a = d * DEG; candelabre(B, sin(a) * 9.8, 0, cos(a) * 9.8, true); }
    decRing(B, 'pierre2', 8.0, 8.7, 0.012, 64); decRing(B, 'gold', 8.25, 8.4, 0.016, 64);
    decBox(B, 'carpet', 0, 0.015, -12.6, 3.0, 0.03, 8.8, 0); decBox(B, 'carpet', 0, 0.015, 12.6, 3.0, 0.03, 8.8, 0);
    decBox(B, 'carpet', 10.4, 0.015, 0, 3.6, 0.03, 3.0, 0);
    for (const z0 of [-12.6, 12.6]) for (const sx of [-1, 1]) decBox(B, 'gold', sx * 1.42, 0.02, z0, 0.12, 0.03, 8.8, 0);
    // le grand lustre
    put(B, 'lustre', 0, 15.2, 0, 0, 1.7); B.add('metal', BOX, 0, (15.2 + APEX) / 2, 0, 0, 0, 0, 0.12, APEX - 15.2, 0.12);
    B.spot(0, 9.6, 0, P.lamp, 2.6, { dist: 22, flick: true });
    B._cit.shafts = wins; B._cit.shaftK = 1.5;
    return { R, entrance, exits: [exit], spawn: { x: 0, z: -13, yaw: 0 }, rewardAt: new A.V3(0, 0, 0) };
  }

  /* =====================================================================
     SALLES D'ÉNIGME (rectangulaires) : salle d'armes charpentée, piliers, vitraux, rayons de soleil
     ===================================================================== */
  function rectShell(B, W, Lz, H, full) {
    const hx = W / 2, hz = Lz / 2, T = 1.4, fg = 3.45, HV = H + 4, y0 = full ? 0 : -26, P = B.P;
    const n = Math.max(3, Math.round(Lz / 6.6)), bay = Lz / n;
    B._citRect = { full, hx, hz, H, HV, n, bay };
    const wseg = (x0, z0, x1, z1) => {
      const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      B.add('wall', BOX, cx, (y0 + HV) / 2, cz, ry, 0, 0, T, HV - y0, len + T);
      B.solid(cx, cz, T / 2, len / 2 + T / 2, ry, y0 - 2, HV + 30);
    };
    wseg(-hx, -hz, -fg, -hz); wseg(fg, -hz, hx, -hz); wseg(-hx, hz, -fg, hz); wseg(fg, hz, hx, hz); wseg(-hx, -hz, -hx, hz); wseg(hx, -hz, hx, hz);
    const fi = hx - T / 2, fz = hz - T / 2;          // faces intérieures
    // plinthe et corniche
    for (const sx of [-1, 1]) {
      if (full) B.add('pierre2', BOX, sx * (fi - 0.12), 0.32, 0, 0, 0, 0, 0.26, 0.64, Lz - T);
      B.add('trim', BOX, sx * (fi - 0.2), HV - 0.3, 0, 0, 0, 0, 0.42, 0.6, Lz - T);
    }
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      const xa = fg + 1.1, xb = fi, cx = sx * (xa + xb) / 2;
      if (full) B.add('pierre2', BOX, cx, 0.32, sz * (fz - 0.12), 0, 0, 0, xb - xa, 0.64, 0.26);
      B.add('trim', BOX, cx, HV - 0.3, sz * (fz - 0.2), 0, 0, 0, xb - xa, 0.6, 0.42);
    }
    for (const sz of [-1, 1]) B.add('trim', BOX, 0, HV - 0.3, sz * (fz - 0.2), 0, 0, 0, 2 * fg + 2.2, 0.6, 0.42);
    // piliers engagés, vitraux entre eux
    const base = full ? 0 : -8, sy = (H + 1 - base) / 8.16, wins = [];
    for (let i = 1; i < n; i++) {
      const z = -hz + i * bay;
      for (const sx of [-1, 1]) {
        const x = sx * (fi - 0.3);
        put(B, 'pilier', x, base, z, -sx * PI / 2, 1, { sy, sz: 0.65 });
        B.solid(x - sx * 0.05, z, 0.36, 0.9, 0, -30, HV + 30);
      }
    }
    for (let i = 0; i < n; i++) {
      const z = -hz + (i + 0.5) * bay;
      for (const sx of [-1, 1]) {
        put(B, 'vitrail', sx * (fi - 0.2), 3.2, z, -sx * PI / 2, 0.92);
        if (sx < 0) wins.push({ x: -(fi - 0.08), z, t: new THREE.Vector3(0, 0, 1), w: 2.0, y0: 3.3, y1: 9.3, pool: full });
      }
    }
    // portails au-dessus des portes
    for (const sz of [-1, 1]) put(B, 'portail', 0, 0, sz * (hz - 1.1), sz > 0 ? PI : 0, 1);
    // charpente : entraits, poinçons, arbalétriers, pannes ; plafond de planches et toit d'ardoise
    const RH = 4.6, xr = fi, slope = Math.atan2(RH, xr);
    for (let i = 1; i < n; i++) {
      const z = -hz + i * bay;
      B.add('bois2', BOX, 0, H + 1.45, z, 0, 0, 0, 2 * fi, 0.5, 0.55);
      B.add('bois2', BOX, 0, (H + 1.7 + HV + RH) / 2, z, 0, 0, 0, 0.42, HV + RH - H - 1.7, 0.42);
      for (const sx of [-1, 1]) {
        const L2 = Math.hypot(xr, RH);
        B.add('bois2', BOX, sx * xr / 2, HV + RH / 2 - 0.25, z, 0, 0, -sx * slope, L2, 0.45, 0.45);
        B.add('bois2', BOX, sx * fi * 0.45, H + 1.7 + (HV - H - 1.7) * 0.5 + 0.6, z, 0, 0, sx * 0.75, 3.2, 0.3, 0.3);
      }
      if (i % 2 === 1) { put(B, 'lustre', 0, H + 1.25, z, (i * 0.7) % 3, 0.8); B.spot(0, H - 1.6, z, P.lamp, 2.0, { dist: 16, flick: true }); }
    }
    for (const sx of [-1, 1]) for (const k of [0.33, 0.66]) B.add('bois2', BOX, sx * xr * (1 - k), HV + RH * k - 0.5, 0, 0, 0, -sx * slope, 0.35, 0.35, Lz - T);
    { // plafond (planches, vu de dessous) et toit (ardoise, vu de dessus)
      const mk = (yOff, ext) => {
        const p = [], u = [], X = xr + ext, Z = hz + ext, k = RH / xr;
        for (const sx of [-1, 1]) {
          const a = [sx * X, HV - ext * k + yOff, -Z], b = [0, HV + RH + yOff, -Z], c = [0, HV + RH + yOff, Z], d = [sx * X, HV - ext * k + yOff, Z];
          p.push(...a, ...b, ...c, ...a, ...c, ...d);
        }
        for (let i = 0; i < p.length; i += 3) u.push(p[i + 2] / 2, Math.abs(p[i]) * Math.hypot(1, k) / 2);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.computeVertexNormals();
        return g;
      };
      ownMesh(B, mk(0.3, 0), new THREE.MeshStandardMaterial({ map: A.planks(P), color: L('#c8a888'), roughness: 0.9, side: THREE.DoubleSide }), true);
      ownMesh(B, mk(0.6, 0.9), new THREE.MeshStandardMaterial({ map: slateTex(), color: L(P.roof), roughness: 0.8, side: THREE.DoubleSide }), false);
      B.mats.floor.color.setScalar(0.74); B.mats.wall.color.setScalar(0.88);
      // pignons
      for (const sz of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(-hx - 0.7, 0); sh.lineTo(hx + 0.7, 0); sh.lineTo(0, RH + 0.6); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false }); g.translate(0, HV, sz * hz - T / 2); B.add('wall', g, 0, 0, 0); g.dispose(); }
    }
    // lumière : torches sur un pilier sur deux
    for (let i = 1; i < n; i++) { const z = -hz + i * bay; for (const sx of [-1, 1]) if ((i + (sx > 0 ? 1 : 0)) % 2 === 0) B.torch(sx * (fi - 0.95), 4.6, z, -sx * PI / 2, true); }
    B._cit.shafts = wins; B._cit.shaftFloor = full ? 0.04 : 0; B._cit.shaftK = 1.3;
  }
  // décor des salles d'énigme : contre les murs (moins de 2 m) et en hauteur, jamais au sol au-dessus d'un gouffre
  function roomDecor(B, W, Lz, H) {
    const C = B._citRect || { full: true, hx: W / 2, hz: Lz / 2, n: Math.max(3, Math.round(Lz / 6.6)), bay: Lz / Math.max(3, Math.round(Lz / 6.6)) };
    const hx = W / 2, hz = Lz / 2, fi = hx - 0.7, fz = hz - 0.7, P = B.P;
    // bannières sur les piliers (en hauteur) et sur les murs des portes
    for (let i = 1; i < C.n; i++) { const z = -hz + i * C.bay; for (const sx of [-1, 1]) if ((i + (sx > 0 ? 0 : 1)) % 2 === 0) put(B, 'banniere', sx * (fi - 0.98), H + 0.2, z, -sx * PI / 2, 0.9); }
    for (const [x, sz] of [[8, -1], [-8.5, 1], [8.5, 1]]) put(B, 'banniere', x, H + 1.6, sz * (fz - 0.1), sz > 0 ? PI : 0, 1.15);
    for (const [x, sz] of [[-11, 1], [11, 1], [11.5, -1]]) if (Math.abs(x) < fi - 1) put(B, 'trophee', x, 5.0, sz * (fz - 0.05), sz > 0 ? PI : 0, 1.0);
    if (!C.full) return;
    // au pied des murs, sous les vitraux : râteliers, armures, tonneaux (une travée sur deux)
    for (let i = 0; i < C.n; i++) {
      const z = -hz + (i + 0.5) * C.bay;
      for (const sx of [-1, 1]) {
        const k = (i * 2 + (sx > 0 ? 1 : 0)) % 6, x = sx * (fi - 0.75), ry = -sx * PI / 2;
        if (k === 0) { put(B, 'ratelier', x, 0, z, ry); B.solid(x, z, 0.4, 1.45, 0, -1, 2.3); }
        else if (k === 2) { for (const t of [-1, 1]) { put(B, 'armure', x, 0, z + t * 1.0, ry); B.cyl(x, z + t * 1.0, 0.45, -1, 2.3); } }
        else if (k === 4) { put(B, 'tonneaux', sx * (fi - 1.05), 0, z, ry + 0.3); B.cyl(sx * (fi - 1.05), z, 1.2, -1, 2.2); }
      }
    }
  }

  /* =====================================================================
     AU LOIN : tours, courtines et donjons ; montagnes très loin ; incendies quand la citadelle est assiégée
     ===================================================================== */
  function skyline(B, R, seed, A2, L0) {
    if (!L0 || !L0.citHall) return;
    const r = A.rnd(seed * 7 + 13), P = B.P;
    const near = [];
    for (const s of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const a = s * (0.98 + i * 0.4 + (r() - 0.5) * 0.08), d = R + 14 + r() * 6, sc = 1.0 + r() * 0.3;
        put(B, 'tour', sin(a) * d, -1, cos(a) * d, a + PI + r(), sc); near.push({ a, d, sc });
      }
      for (let i = 0; i < 3; i++) {     // courtines entre les tours
        const p = near[near.length - 4 + i], q = near[near.length - 3 + i];
        const x0 = sin(p.a) * p.d, z0 = cos(p.a) * p.d, x1 = sin(q.a) * q.d, z1 = cos(q.a) * q.d, len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
        B.add('wall', BOX, (x0 + x1) / 2, 8, (z0 + z1) / 2, ry, 0, 0, 2.4, 18, len);
        const nm = Math.floor(len / 2.4); for (let k = 0; k < nm; k++) { const t = (k + 0.5) / nm; B.add('wall', BOX, x0 + (x1 - x0) * t, 17.6, z0 + (z1 - z0) * t, ry, 0, 0, 2.6, 1.2, 1.2); }
      }
      // le donjon
      const a = s * (1.45 + r() * 0.3), d = 100 + r() * 20, x = sin(a) * d, z = cos(a) * d, ry = a + r();
      B.add('wall', BOX, x, 19, z, ry, 0, 0, 18, 40, 18);
      B.add('trim', BOX, x, 38.6, z, ry, 0, 0, 19.2, 0.8, 19.2);
      const cr = cos(ry), sr = sin(ry);
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) put(B, 'tourelle', x + (u * cr + v * sr) * 9, 40, z + (-u * sr + v * cr) * 9, ry, 1.7);
      { const g = new THREE.ConeGeometry(8, 22, 8); B.add('roof', g, x, 50, z, ry); g.dispose(); }
      for (let k = 0; k < 8; k++) { const u = (k % 4 - 1.5) * 3.6, h = 14 + Math.floor(k / 4) * 12; B.add('flame', BOX, x + (u * cr + 9.05 * sr), h, z + (-u * sr + 9.05 * cr), ry, 0, 0, 1.0, 2.2, 0.3); }
      // tours lointaines
      for (let i = 0; i < 5; i++) {
        const a3 = s * (0.82 + r() * 1.5), d3 = 70 + r() * 60, sc = 1.3 + r() * 0.9, x3 = sin(a3) * d3, z3 = cos(a3) * d3;
        put(B, 'tour', x3, -2, z3, r() * 6, sc);
        if (P.fire && r() < 0.6) { B.flame(x3, 31 * sc, z3, 7 * sc, false); B.add('braise', BOX, x3, 26 * sc, z3, 0, 0, 0, 3, 1, 3); }
      }
    }
    // montagnes très loin (au-delà de 180 m, tout autour)
    B.mats.mont = new THREE.MeshStandardMaterial({ color: L(P.fog[0]).multiplyScalar(0.62), roughness: 1 });
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * TAU + r() * 0.2, d = 230 + r() * 60, h = 30 + r() * 45, w = 70 + r() * 50, g = new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, PI / 2);
      B.add('mont', g, sin(a) * d, -4, cos(a) * d, r() * 6, 0, 0, w, h, w * (0.6 + r() * 0.4)); g.dispose();
    }
    // nuages bas-poly (hors brouillard), teintés par l'ambiance
    B.mats.cloud = new THREE.MeshLambertMaterial({ color: L(P.cloud || '#ffffff'), emissive: L(P.cloud || '#ffffff').multiplyScalar(0.35), fog: false });
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU, d = 170 + r() * 110, y = 70 + r() * 50, s = 7 + r() * 8, g = new THREE.IcosahedronGeometry(1, 0), x = sin(a) * d, z = cos(a) * d;
      for (let k = 0; k < 4; k++) B.add('cloud', g, x + (k - 1.5) * s * 0.9, y + r() * s * 0.3, z + (r() - 0.5) * s, r() * 6, 0, 0, s * (0.9 + r() * 0.6), s * 0.55, s * (0.8 + r() * 0.4));
      g.dispose();
    }
    if (P.fire) for (let i = 0; i < 5; i++) { const a = (r() < 0.5 ? 1 : -1) * (0.9 + r() * 1.3), d = 150 + r() * 40; B.flame(sin(a) * d, 8, cos(a) * d, 16 + r() * 10, false); }
  }

  /* =====================================================================
     LE THÈME
     ===================================================================== */
  DG.THEMES.citadelle = {
    signWall: true,
    setup(B) {
      const P = B.P, mt = B.mats;
      B._cit = { dec: {} };
      mt.wall.map = wallTex(P); mt.wall.color.set(0xffffff); mt.wall.roughness = 0.92; mt.wall.needsUpdate = true;
      mt.floor.map = floorTex(P); mt.floor.roughness = 0.85; mt.floor.needsUpdate = true;
      mt.trim.map = grainTex(); mt.trim.color.copy(L(P.trim)); mt.trim.roughness = 0.85; mt.trim.needsUpdate = true;
      mt.metal.color.copy(L(P.metal)); mt.metal.metalness = 0.4; mt.metal.roughness = 0.45;
      mt.gold.color.copy(L('#e2aa3c')); mt.gold.metalness = 0.55; mt.gold.roughness = 0.35; mt.gold.emissive.copy(L('#4a3006'));
      const S = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: L(c), roughness: 0.85 }, o || {}));
      mt.pierre2 = S(P.stone2, { map: grainTex() });
      mt.bois2 = S(P.wood2);
      mt.cloth = S(P.banner, { roughness: 0.95, side: THREE.DoubleSide });
      mt.carpet = S(P.carpet, { roughness: 1 });
      mt.candle = S('#f4e8cc', { emissive: L('#7a5a30'), roughness: 0.7 });
      mt.flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.24).multiplyScalar(1.5), toneMapped: false });
      mt.braise = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.36, 0.08).multiplyScalar(1.5), toneMapped: false });
      mt.roof = S(P.roof, { map: slateTex(), roughness: 0.75 });
      P.glass.forEach((c, i) => { mt['v' + (i + 1)] = new THREE.MeshStandardMaterial({ color: L(c).multiplyScalar(0.3), emissive: L(c), emissiveIntensity: P.glassK, roughness: 0.3 }); });
    },
    hall, chapel, rectShell, roomDecor, skyline,
    finish(B) {
      const C = B._cit; if (!C) return;
      // décor plat au sol : fusionné par matériau, sans ombre portée (pas d'acné d'ombre)
      for (const k in C.dec) {
        const g = A.mergeGeos(C.dec[k], 4); C.dec[k].forEach(x => x.dispose());
        const m = new THREE.Mesh(g, B.mats[k]); m.receiveShadow = true; B.g.add(m); B.disposables.push(g);   // le matériau est libéré par le moteur
      }
      if (C.pools) pools(B, C.pools, B.P.pool);
      if (C.shafts) shafts(B, C.shafts, B.P.shaft * (C.shaftK || 1), C.shaftFloor);
    },
  };
})();

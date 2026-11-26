/* ===== arena/maps/montagne.js : thème de la carte « montagne » — Le Bastion des Cimes (voir js/arena/maps/README-CARTES.md) =====
   Chaque salle est un plateau rocheux au sommet d'une aiguille de pierre, au-dessus d'une mer de nuages.
   - le plateau : dallage enneigé, bord de gros rochers, sapins, congères, balcons en bois (drapeaux de prières), ruines de monastère,
     tables de roche praticables (altitude), lanternes de pierre ; dessous, la falaise qui plonge (corniches enneigées)
   - entre deux salles : pont de planches et de cordes, toit de monastère sur l'arche
   - au loin (une seule fois par scène, suit la caméra) : chaîne de pics, mer de nuages qui défile, vallée boisée loin en dessous,
     soleil rasant / coucher de soleil rose / nuit à aurore boréale selon la profondeur
   - modèles Blender : outils/blender-map-montagne.py → assets-map-montagne.js ; leur géométrie est fusionnée par matériau (B.add) */
(function () {
  const BR = window.BR, DG = BR.Dungeon; DG.THEMES = DG.THEMES || {};
  const A = DG.api, L = A.L, V3 = A.V3, BOX = A.BOX;
  const M = DG.mapOf('montagne');
  const TAU = Math.PI * 2, norm2 = a => Math.atan2(Math.sin(a), Math.cos(a));
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* =====================================================================
     AMBIANCES : matin clair → coucher de soleil rose → nuit à aurore boréale
     (sky / fog / hemi / moon = moteur ; sun, snow, cloud, far… = ce thème)
     ===================================================================== */
  M.exp = 0.95;
  M.d = 'Des plateaux suspendus au sommet des pics, reliés par des ponts de cordes au-dessus d\'une mer de nuages.';
  Object.assign(M.tiers[0], {
    stone: '#9aa3b2', mortar: '#3a3f4a', floor: '#8f97a3', trim: '#c4bcad', wood: '#7a5234', metal: '#3c4048', accent: '#ffb35a', banner: '#2a6a4a', moss: 0, stars: false,
    sky: ['#2462b8', '#6a9fd8', '#b9d0e6'], fog: ['#b9d0e6', 0.0022], hemi: ['#cfe0ff', '#7a8494', 0.55], moon: ['#fff0d8', 1.25],
    sun: [0.82, 0.42, 0.38], sunSize: 48, snowCol: '#e1e9f3', cloud: '#f4f7fb', cloudSh: '#a9bdd6', farRock: '#56637b', farSnow: '#e6edf6',
    forest: '#2e4a3a', meadow: '#4f6a4a', aurora: false,
  });
  Object.assign(M.tiers[1], {
    n: 'Le Crépuscule', stone: '#a49aa6', mortar: '#3e3440', floor: '#8f8f9a', trim: '#cdbfb8', wood: '#6e4630', metal: '#40384a', accent: '#ffa04a', banner: '#7a2a4a', moss: 0, stars: false,
    sky: ['#26306a', '#9c6298', '#e8a58e'], fog: ['#e8a58e', 0.0017], hemi: ['#f4c8d0', '#5a4a6a', 0.62], moon: ['#ffb684', 1.45],
    sun: [-0.86, 0.26, 0.42], sunSize: 70, snowCol: '#f1e6ec', cloud: '#ffd8cc', cloudSh: '#9a6e96', farRock: '#4e4064', farSnow: '#f6d2d0',
    forest: '#3a3a4a', meadow: '#5a4a5a', aurora: false,
  });
  Object.assign(M.tiers[2], {
    stone: '#8a93a6', mortar: '#22283a', floor: '#8a92a2', trim: '#b4b8c4', wood: '#5a3e2c', metal: '#30343c', accent: '#ffc46a', banner: '#5a1a1a', moss: 0, stars: true,
    sky: ['#040a1c', '#10285a', '#2d5784'], fog: ['#2d5784', 0.0028], hemi: ['#9ec2ff', '#2a3452', 0.95], moon: ['#bcd6ff', 1.05],
    sun: [0.38, 0.72, -0.58], sunSize: 46, snowCol: '#dfe8f6', cloud: '#7f9cc4', cloudSh: '#2e4266', farRock: '#465472', farSnow: '#c0d2ee',
    forest: '#1a2a34', meadow: '#22343c', aurora: true,
  });

  /* =====================================================================
     MATÉRIAUX (couleurs unies, facettes franches)
     ===================================================================== */
  const COL = {
    rock: '#727d8f', rock_d: '#4e5767', snow: '#e9eff7', pine: '#2d5f47', pine_d: '#22493a', bark: '#5b3f2b', wood: '#8c5c36', wood_d: '#5a3a23',
    red: '#b23e2e', gold: '#e2b443', white: '#ebe3d1', stone: '#aaa497', stone_d: '#8f8a7f', slate: '#46546b', moss: '#7a8a5c', glow_lamp: '#ffc870',
    rope: '#c8a870', cloud: '#ffffff',
  };
  function mt(B, name) {
    const k = 'mt_' + name; if (B.mats[k]) return k;
    const P = B.P, glow = name.indexOf('glow') === 0;
    let c = COL[name] || '#ff00ff';
    if (name === 'snow') c = P.snowCol || c;
    const o = { color: L(c), roughness: name === 'gold' ? 0.38 : name === 'snow' ? 0.82 : 0.9, metalness: name === 'gold' ? 0.55 : 0, flatShading: !glow };
    if (glow) Object.assign(o, { emissive: L(c), emissiveIntensity: 1.7 });
    if (name === 'cloud') Object.assign(o, { color: L(P.cloud || '#ffffff'), emissive: L(P.cloudSh || '#8899aa'), emissiveIntensity: 0.55, roughness: 1 });
    if (name === 'snow') Object.assign(o, { map: snowTex(), emissive: L(P.hemi[0]), emissiveIntensity: 0.03 });
    B.mats[k] = new THREE.MeshStandardMaterial(o);
    return k;
  }
  // dallage de pierre irrégulier, joints pleins de neige, plaques de neige (texture qui se répète tous les 6 m)
  function floorTex(P) {
    const key = 'montFloor' + P.id; if (A.texCache[key]) return A.texCache[key];
    const n = 512, G = 5, cell = n / G, r = A.rnd(4242);
    const c = A.cv(n, (g) => {
      const pts = [];
      const base = new THREE.Color(P.floor), sn = new THREE.Color(P.snowCol || '#e9eff7');
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const c0 = base.clone().multiplyScalar(0.84 + r() * 0.24); c0.offsetHSL((r() - 0.5) * 0.02, 0, 0); pts.push([(i + 0.18 + r() * 0.64) * cell, (j + 0.18 + r() * 0.64) * cell, c0]); }
      const im = g.createImageData(n, n), d = im.data;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const ci = Math.floor(x / cell), cj = Math.floor(y / cell); let d1 = 1e9, d2 = 1e9, best = null, bx = 0, by = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = ci + di, jj = cj + dj, p = pts[((jj + G) % G) * G + ((ii + G) % G)];
          const px = p[0] + Math.floor(ii / G) * n, py = p[1] + Math.floor(jj / G) * n;
          const dx = x - px, dy = y - py, dd = Math.sqrt(dx * dx + dy * dy);
          if (dd < d1) { d2 = d1; d1 = dd; best = p; bx = dx; by = dy; } else if (dd < d2) d2 = dd;
        }
        const e = d2 - d1, o = (y * n + x) * 4;
        let cr, cg, cb, k = 1;
        if (e < 7) { k = 0.9 + Math.min(1, e / 7) * 0.08; cr = sn.r; cg = sn.g; cb = sn.b; }
        else { const c0 = best[2]; cr = c0.r; cg = c0.g; cb = c0.b; if (e < 13) k = by + bx < 0 ? 1.07 : 0.93; }
        d[o] = Math.min(255, cr * k * 255); d[o + 1] = Math.min(255, cg * k * 255); d[o + 2] = Math.min(255, cb * k * 255); d[o + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      // plaques de neige (raccords sur les bords)
      for (let i = 0; i < 4; i++) {
        const x = r() * n, y = r() * n, rr = 40 + r() * 50;
        for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const gr = g.createRadialGradient(x + ox, y + oy, rr * 0.2, x + ox, y + oy, rr); gr.addColorStop(0, 'rgba(236,242,250,0.6)'); gr.addColorStop(0.6, 'rgba(236,242,250,0.3)'); gr.addColorStop(1, 'rgba(236,242,250,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x + ox, y + oy, rr * 1.3, rr, r() * 3, 0, 7); g.fill(); }
      }
      A.shade(g, n, r, 10);
    });
    return (A.texCache[key] = A.mkTex(c));
  }

  // neige : grandes ondulations bleutées et quelques paillettes (multipliée par la couleur de la neige)
  function snowTex() {
    if (A.texCache.montSnow) return A.texCache.montSnow;
    const r = A.rnd(31), c = A.cv(256, (g, n) => {
      g.fillStyle = '#f2f5f9'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 26; i++) { const x = r() * n, y = r() * n, rr = 20 + r() * 50; for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gr.addColorStop(0, 'rgba(196,212,236,0.32)'); gr.addColorStop(1, 'rgba(196,212,236,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x + ox, y + oy, rr * 1.5, rr, 0.4, 0, 7); g.fill(); } }
      for (let i = 0; i < 420; i++) { g.fillStyle = r() < 0.5 ? '#ffffff' : 'rgba(180,200,230,0.5)'; g.fillRect(r() * n, r() * n, 1.5, 1.5); }
    });
    return (A.texCache.montSnow = A.mkTex(c));
  }

  /* =====================================================================
     OUTILS DE MODÉLISATION
     ===================================================================== */
  // géométrie des modèles Blender (une liste { m: nom du matériau, g } par modèle, transformations déjà appliquées)
  const PC = {};
  function parts(name) {
    if (PC[name]) return PC[name];
    const sc = A.model('map_montagne_' + name); if (!sc) return null;
    sc.updateMatrixWorld(true); const out = [];
    sc.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      Object.keys(g.attributes).forEach(a => { if (a !== 'position' && a !== 'normal') g.deleteAttribute(a); });
      const ng = g.index ? g.toNonIndexed() : g; if (ng !== g) g.dispose();
      ng.userData.keep = true; out.push({ m: (o.material && o.material.name) || 'rock', g: ng });
    });
    return (PC[name] = out);
  }
  function put(B, name, x, y, z, ry, sx, sy, sz) {
    const P = parts(name); if (!P) return false;
    sx = sx || 1; for (const p of P) B.add(mt(B, p.m), p.g, x, y, z, ry || 0, 0, 0, sx, sy || sx, sz || sx);
    return true;
  }
  // seau « sans ombre portée » (lointain, falaises, neige au sol) : fusionné par matériau dans finish
  function putOwn(B, name, x, y, z, ry, s) {
    const P = parts(name); if (!P) return;
    _m4.compose(_p.set(x, y, z), _q.setFromAxisAngle(_y, ry || 0), _sc.set(s, s, s));
    P.forEach(p => { const g = p.g.clone(); g.applyMatrix4(_m4); own(B, p.m, g); });
  }
  function own(B, name, geo) { const k = mt(B, name); (B._own = B._own || {}); (B._own[k] = B._own[k] || []).push(geo); }
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 6).toNonIndexed(); CYL.userData.keep = true;
  const DOME = new THREE.SphereGeometry(1, 9, 4, 0, TAU, 0, Math.PI / 2).toNonIndexed(); DOME.userData.keep = true;
  const PUFF = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(); PUFF.userData.keep = true;
  const _a = new V3(), _y = new V3(0, 1, 0), _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _sc = new V3(), _p = new V3();
  // poutre / corde entre deux points
  function seg(B, mk, x0, y0, z0, x1, y1, z1, r) {
    _a.set(x1 - x0, y1 - y0, z1 - z0); const len = _a.length(); if (len < 1e-3) return;
    _q.setFromUnitVectors(_y, _a.multiplyScalar(1 / len)); _m4.compose(_p.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), _q, _sc.set(r, len, r));
    const g = CYL.clone(); g.applyMatrix4(_m4); B.add(mk, g, 0, 0, 0); g.dispose();
  }
  function rope(B, x0, y0, z0, x1, y1, z1, sag, r) {
    const n = 6; let px = x0, py = y0, pz = z0;
    for (let i = 1; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - sag * 4 * t * (1 - t); seg(B, mt(B, 'rope'), px, py, pz, x, y, z, r || 0.035); px = x; py = y; pz = z; }
  }
  function drift(B, x, z, s, ry) { B.add(mt(B, 'snow'), DOME, x, -0.06, z, ry || 0, 0, 0, s * 1.5, s * 0.4, s); }
  // drapeaux de prières : une seule géométrie par salle (couleurs par sommet), qui flotte au vent
  const FLAGC = ['#2f6fc0', '#f2efe6', '#c83a30', '#3a9a50', '#f0c43a'].map(c => L(c));
  const ROPEC = L('#5a4a3a'), FT = { value: 0 };
  function flagLine(B, x0, y0, z0, x1, y1, z1, sag) {
    const F = B._flags = B._flags || { p: [], c: [], f: [] };
    const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.max(3, Math.floor(len / 0.62)), at = t => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), z0 + (z1 - z0) * t];
    const quad = (a, b, c, d, col, fa, fb) => { [a, b, c, a, c, d].forEach((p, k) => { F.p.push(p[0], p[1], p[2]); F.c.push(col.r, col.g, col.b); F.f.push([fa, fa, fb, fa, fb, fb][k]); }); };
    for (let i = 0; i < n; i++) { const a = at(i / n), b = at((i + 1) / n); quad(a, b, [b[0], b[1] - 0.045, b[2]], [a[0], a[1] - 0.045, a[2]], ROPEC, 0, 0); }
    for (let i = 0; i < n; i++) {
      const tc = (i + 0.5) / n, hw = 0.2 / len, a = at(tc - hw), b = at(tc + hw), h = 0.36 + (i % 3) * 0.04, col = FLAGC[i % 5];
      quad([a[0], a[1] - 0.03, a[2]], [b[0], b[1] - 0.03, b[2]], [b[0], b[1] - h, b[2]], [a[0], a[1] - h, a[2]], col, 0, 1);
    }
  }
  function flushFlags(B) {
    const F = B._flags; if (!F || !F.p.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(F.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(F.c, 3)); g.setAttribute('flap', new THREE.Float32BufferAttribute(F.f, 1));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    m.onBeforeCompile = sh => { sh.uniforms.uFT = FT; sh.vertexShader = 'attribute float flap;\nuniform float uFT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  float ph = uFT * 3.2 + position.x * 0.9 + position.z * 0.7;\n  transformed.x += sin(ph) * 0.13 * flap; transformed.z += cos(ph * 0.9) * 0.13 * flap; transformed.y += sin(ph * 1.3) * 0.03 * flap;'); };
    m.customProgramCacheKey = () => 'montFlags';
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; B.g.add(mesh); B.disposables.push(g, m);
    B._flags = null;
  }
  function flushOwn(B) {
    if (!B._own) return;
    for (const k in B._own) {
      const geo = A.mergeGeos(B._own[k], 4); B._own[k].forEach(x => x.dispose());
      const mesh = new THREE.Mesh(geo, B.mats[k]); mesh.castShadow = false; mesh.receiveShadow = true; B.g.add(mesh); B.disposables.push(geo);
    }
    B._own = null;
  }
  // géométrie non indexée à partir d'une liste de triangles, triée par matériau selon la normale (neige sur ce qui regarde le ciel)
  function triSorter() {
    const T = { snow: [], rock: [], rock_d: [] }, va = new V3(), vb = new V3(), vc = new V3(), e1 = new V3(), e2 = new V3();
    return {
      // ref : direction attendue de la normale (pour l'orientation des faces)
      tri(a, b, c, ref, force) {
        va.fromArray(a); vb.fromArray(b); vc.fromArray(c); e1.subVectors(vb, va); e2.subVectors(vc, va); e1.cross(e2);
        if (e1.dot(ref) < 0) { const t = b; b = c; c = t; e1.negate(); }
        const ny = e1.y / (e1.length() || 1), y = (a[1] + b[1] + c[1]) / 3;
        const k = force || (ny > 0.42 ? 'snow' : y < -70 ? 'rock_d' : 'rock');
        T[k].push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      },
      flush(B) { for (const k in T) { if (!T[k].length) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(T[k], 3)); g.computeVertexNormals(); own(B, k, g); } },
    };
  }
  // l'aiguille de pierre sous le plateau : contour du dessus (points, normales vers l'extérieur, marge) → falaise à corniches
  // [y, élargissement, désordre, corniche ?]
  const PROF = [[0, 0, 0], [-0.9, 0.4, 0.3], [-3.6, -0.5, 0.8], [-7, 0.3, 1.0], [-7.7, 2.6, 1.0, 1], [-14, 1.2, 1.4], [-22, 0.6, 1.6], [-23, 3.4, 1.6, 1], [-34, 2.2, 2.2], [-47, 3.2, 2.4], [-48.2, 6.0, 2.4, 1], [-68, 4.8, 3], [-100, 7.5, 3.5], [-140, 10, 4], [-188, 13, 4]];
  function pedestal(B, pts, hollow) {
    const n = pts.length, S = triSorter(), rings = [], up = new V3(0, 1, 0);
    const col = pts.map(() => (B.rnd() - 0.5) * 2.4), nl = ringNoise(B, 1), ledgeW = pts.map(p => Math.max(0, 0.55 + nl(p.a * 2.3) * 1.2));
    const ledges = [];
    PROF.forEach(([y, ex, jt, ledge], j) => {
      rings.push(pts.map((p, i) => {
        const f = 0.3 + 0.7 * Math.abs(p.nx), lw = ledge ? ledgeW[i] : 1, prevEx = j ? PROF[j - 1][1] : 0;
        const e = j ? ((ledge ? prevEx + (ex - prevEx) * lw : ex) * f + (j > 1 ? col[i] * Math.min(1, j / 4) : 0) + (B.rnd() - 0.4) * jt) : 0, yy = j ? y + (B.rnd() - 0.5) * jt * 0.5 : -0.04;
        const v = [p.ox + p.nx * e, yy, p.oz + p.nz * e];
        if (ledge && lw > 1.0 && j < 12) ledges.push(v);
        return v;
      }));
    });
    // quelques sapins accrochés aux corniches
    ledges.forEach(v => { if (B.rnd() < 0.3) putOwn(B, PINES[Math.floor(B.rnd() * 3)], v[0], v[1] - 0.3, v[2], B.rnd() * TAU, 0.7 + B.rnd() * 0.6); });
    const ref = new V3();
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n, a = rings[j][i], b = rings[j][i2], c = rings[j + 1][i2], d = rings[j + 1][i];
      ref.set(pts[i].nx + pts[i2].nx, 0, pts[i].nz + pts[i2].nz);
      S.tri(a, b, c, ref); S.tri(a, c, d, ref);
    }
    if (!hollow) { const ctr = [0, -0.04, 0]; for (let i = 0; i < n; i++) S.tri(ctr, rings[0][i], rings[0][(i + 1) % n], up, 'snow'); }
    else {
      // le puits du gouffre : parois déchiquetées qui s'assombrissent avec la profondeur (couleurs par sommet)
      const inn = pts.map(p => [p.ix, -0.04, p.iz]);
      for (let i = 0; i < n; i++) { const i2 = (i + 1) % n; S.tri(inn[i], rings[0][i], rings[0][i2], up, 'snow'); S.tri(inn[i], rings[0][i2], inn[i2], up, 'snow'); }
      const lv = [-0.04, -1.2, -4, -9, -15, -24, -36, -52, -75, -100], wr = lv.map((y, j) => pts.map(p => { const e = j ? 0.3 + B.rnd() * 1.6 + (j % 3 === 1 ? 0.8 : 0) : 0; return [p.ix + p.nx * e, j ? y + (B.rnd() - 0.5) * 1.2 : y, p.iz + p.nz * e]; }));
      const pos = [], colA = [], base = L(COL.rock), cc = new THREE.Color(), e1 = new V3(), e2 = new V3(), va = new V3(), vb = new V3(), vc = new V3();
      const push = (a, b, c, rx, rz) => { va.fromArray(a); vb.fromArray(b); vc.fromArray(c); e1.subVectors(vb, va).cross(e2.subVectors(vc, va)); if (e1.x * rx + e1.z * rz < 0) { const t = b; b = c; c = t; } [a, b, c].forEach(v => { const k = 1 - 0.9 * sstep(0, 55, -v[1]); cc.copy(base).multiplyScalar(k); pos.push(v[0], v[1], v[2]); colA.push(cc.r, cc.g, cc.b); }); };
      for (let j = 0; j < lv.length - 1; j++) for (let i = 0; i < n; i++) { const i2 = (i + 1) % n, rx = -(pts[i].nx + pts[i2].nx), rz = -(pts[i].nz + pts[i2].nz); push(wr[j][i], wr[j][i2], wr[j + 1][i2], rx, rz); push(wr[j][i], wr[j + 1][i2], wr[j + 1][i], rx, rz); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3)); g.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; B.g.add(mesh); B.disposables.push(g, m);
    }
    S.flush(B);
  }
  // contour rond (rayon r0 + marge(a)) ; points en partant du nord, dans le sens des x positifs
  function roundOutline(r0, margin, n) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, s = Math.sin(a), c = Math.cos(a), m = margin(a); pts.push({ a, nx: s, nz: c, ox: s * (r0 + m), oz: c * (r0 + m), ix: s * r0, iz: c * r0, m }); }
    return pts;
  }
  // contour rectangulaire arrondi (bord de la salle + marge)
  function rectOutline(hx, hz, margin, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, s = Math.sin(a), c = Math.cos(a), t = Math.min(hx / Math.max(1e-6, Math.abs(s)), hz / Math.max(1e-6, Math.abs(c)));
      const ix = s * t, iz = c * t; let nx = Math.sign(ix) * Math.pow(Math.abs(ix / hx), 8), nz = Math.sign(iz) * Math.pow(Math.abs(iz / hz), 8); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const m = margin(a); pts.push({ a, nx, nz, ix, iz, ox: ix + nx * m, oz: iz + nz * m, m });
    }
    return pts;
  }
  // bruit doux sur le cercle (déterministe)
  function ringNoise(B, k) { const ph = [B.rnd() * TAU, B.rnd() * TAU, B.rnd() * TAU]; return a => (Math.sin(a * 3 + ph[0]) * 0.5 + Math.sin(a * 5 + ph[1]) * 0.3 + Math.sin(a * 11 + ph[2]) * 0.2) * (k || 1); }
  // neige au sol, en anneau (bord intérieur irrégulier)
  function snowRing(B, rin, rout, n) {
    const P = [], ring = (r, y) => { const out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([Math.sin(a) * r(a), y, Math.cos(a) * r(a)]); } return out; };
    const r0 = ring(rin, 0.012), r1 = ring(a => rin(a) + 1.6, 0.04), r2 = ring(() => rout, 0.04);
    for (const [u, v] of [[r0, r1], [r1, r2]]) for (let i = 0; i < n; i++) { const i2 = (i + 1) % n; P.push(...u[i], ...v[i2], ...u[i2], ...u[i], ...v[i], ...v[i2]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); own(B, 'snow', g);
  }
  function flatRing(B, name, r0, r1, y) { const g = new THREE.RingGeometry(r0, r1, 72, 1); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); own(B, name, g.toNonIndexed()); g.dispose(); }
  // garde-fou invisible en anneau (on ne tombe pas par accident) ; ouvert devant les portes (|x| < gap)
  function guardRing(B, R, gap) {
    const rr = R + 0.45, ag = Math.asin(Math.min(1, gap / rr));   // face intérieure vers R - 0,05 : le sol (R + 0,5) dépasse toujours
    for (const [a0, a1] of [[ag, Math.PI - ag], [Math.PI + ag, TAU - ag]]) {
      const k = Math.ceil((a1 - a0) * rr / 3);
      for (let i = 0; i < k; i++) { const b0 = a0 + (a1 - a0) * i / k, b1 = a0 + (a1 - a0) * (i + 1) / k, am = (b0 + b1) / 2, len = 2 * rr * Math.sin((b1 - b0) / 2) + 0.5; B.solid(Math.sin(am) * rr, Math.cos(am) * rr, len / 2, 0.5, am, -2, 14); }
    }
  }

  /* =====================================================================
     ÉLÉMENTS DU DÉCOR
     ===================================================================== */
  const ROCKS = ['rocher_a', 'rocher_b', 'rocher_c'], PINES = ['sapin', 'sapin', 'sapin_b'];
  function boulder(B, x, z, s, solidIn) {
    const nm = ROCKS[Math.floor(B.rnd() * 3)], ry = B.rnd() * TAU, sy = s * (0.8 + B.rnd() * 0.4);
    put(B, nm, x, -0.1, z, ry, s, sy, s * (0.85 + B.rnd() * 0.3));
    if (solidIn) { B.cyl(x, z, s * 0.82, -1, Math.min(4.5, sy * (nm === 'rocher_c' ? 1.25 : 0.9))); }
    if (B.rnd() < 0.55) drift(B, x - Math.sin(ry) * s * 0.6, z - Math.cos(ry) * s * 0.6, s * 0.7, ry);
  }
  function pine(B, x, z, s) { put(B, PINES[Math.floor(B.rnd() * 3)], x, -0.15, z, B.rnd() * TAU, s * (0.9 + B.rnd() * 0.2), s, s * (0.9 + B.rnd() * 0.2)); }
  function lantern(B, x, z, ry, y0) { y0 = y0 || 0; put(B, 'lanterne', x, y0, z, ry || 0, 1); B.cyl(x, z, 0.5, y0 - 1, y0 + 2.3); B.spot(x, y0 + 1.7, z, B.P.accent, 2.1, { flick: true, dist: 14 }); }
  function pole(B, x, z, y0, s) { put(B, 'mat', x, y0 || 0, z, B.rnd() * TAU, s || 1); return [x, (y0 || 0) + 5.95 * (s || 1), z]; }
  // table de roche praticable (cylindre de collision : on marche sur le dessus)
  function slab(B, x, z, r, h, solid) {
    put(B, 'dalle', x, 0, z, B.rnd() * TAU, r, h, r);
    if (solid !== false) { B.cyl(x, z, r * 0.92, -1, h); B.obstacles.push({ x, z, r: r * 0.95, h }); }
  }
  // clôture de bois (poteaux, deux lisses, neige) le long d'une liste de points
  function fence(B, pts) {
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i]; B.add(mt(B, 'wood_d'), BOX, x, 0.65, z, 0, 0, 0, 0.22, 1.3, 0.22); B.add(mt(B, 'snow'), BOX, x, 1.33, z, 0, 0, 0, 0.28, 0.08, 0.28);
      if (i) { const [x0, z0] = pts[i - 1]; seg(B, mt(B, 'wood'), x0, 1.12, z0, x, 1.12, z, 0.07); seg(B, mt(B, 'wood'), x0, 0.62, z0, x, 0.62, z, 0.06); seg(B, mt(B, 'snow'), x0, 1.2, z0, x, 1.2, z, 0.05); }
    }
  }
  // pont : planches, longerons, poteaux et cordes ; toit de monastère sur l'arche ; drapeaux
  function dressDoor(B, D) {
    const { x, z, ox, oz, ux, uz, W, H, ry } = D, CORR = A.CORR;
    put(B, 'toit_porte', x, H + 1.2, z, ry, (W + 3.8) / 8.4, 1, 1);
    for (let t = 0.95; t < CORR - 0.1; t += 0.52) { const j = (B.rnd() - 0.5) * 0.12; B.add(mt(B, B.rnd() < 0.3 ? 'wood_d' : 'wood'), BOX, x + ox * t + ux * j, 0.0, z + oz * t + uz * j, ry + (B.rnd() - 0.5) * 0.05, 0, 0, W + 0.45 + B.rnd() * 0.25, 0.08, 0.46); }
    const posts = [1.3, 4.5, CORR - 0.25];
    for (const s of [-1, 1]) {
      const px = t => x + ox * t + ux * s * (W / 2 + 0.55), pz = t => z + oz * t + uz * s * (W / 2 + 0.55);
      B.add(mt(B, 'wood_d'), BOX, x + ox * (CORR / 2 + 0.4) + ux * s * (W / 2 + 0.3), -0.22, z + oz * (CORR / 2 + 0.4) + uz * s * (W / 2 + 0.3), ry, 0, 0, 0.32, 0.44, CORR - 0.6);
      posts.forEach(t => { B.add(mt(B, 'wood_d'), BOX, px(t), 0.6, pz(t), ry, 0, 0, 0.2, 1.6, 0.2); B.add(mt(B, 'snow'), BOX, px(t), 1.44, pz(t), ry, 0, 0, 0.26, 0.08, 0.26); });
      for (let k = 0; k < posts.length - 1; k++) { rope(B, px(posts[k]), 1.3, pz(posts[k]), px(posts[k + 1]), 1.3, pz(posts[k + 1]), 0.18); rope(B, px(posts[k]), 0.75, pz(posts[k]), px(posts[k + 1]), 0.75, pz(posts[k + 1]), 0.12, 0.028); }
      // drapeaux : du coin du toit au poteau du milieu du pont
      flagLine(B, x + ux * s * (W / 2 + 1.7), H + 1.5, z + uz * s * (W / 2 + 1.7), px(posts[1]), 1.5, pz(posts[1]), 0.5);
    }
  }
  // rochers + sapins le long d'un bord (points { x, z, nx, nz, m }), en évitant certaines zones
  function rimRocks(B, list, R) {
    list.forEach(p => {
      const s = 1.25 + B.rnd() * 1.25, d1 = p.out ? s * 0.8 + 0.2 + B.rnd() * 0.6 : 0.7 + B.rnd() * 1.2;
      boulder(B, p.x + p.nx * d1, p.z + p.nz * d1, s, !p.out && d1 - s * 0.82 < 0.5);
      if (B.rnd() < 0.62 && p.m > 3) { const d2 = 2.6 + B.rnd() * Math.max(0.2, p.m - 3.4); pine(B, p.x + p.nx * d2 + (B.rnd() - 0.5) * 1.5, p.z + p.nz * d2 + (B.rnd() - 0.5) * 1.5, 0.75 + B.rnd() * 0.6); }
      if (B.rnd() < 0.3 && p.m > 4) { const d3 = 1.8 + B.rnd() * (p.m - 2.4); boulder(B, p.x + p.nx * d3, p.z + p.nz * d3, 0.8 + B.rnd() * 0.9, false); }
      if (B.rnd() < 0.45) drift(B, p.x - p.nx * (p.out ? 0.1 : 0.4), p.z - p.nz * (p.out ? 0.1 : 0.4), p.out ? 0.55 + B.rnd() * 0.3 : 0.9 + B.rnd() * 0.8, Math.atan2(p.nx, p.nz));
    });
    void R;
  }

  /* =====================================================================
     LE LOINTAIN (une fois par scène, suit la caméra) : pics, mer de nuages, vallée, soleil, aurore
     ===================================================================== */
  function hash(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function fbm(x, y) { return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 1, y * 4.3 + 9) * 0.15; }
  function cloudTex() {
    if (A.texCache.montCloud) return A.texCache.montCloud;
    const r = A.rnd(99), c = A.cv(512, (g, n) => {
      g.clearRect(0, 0, n, n);
      for (let i = 0; i < 70; i++) {
        const x = r() * n, y = r() * n, rr = 26 + r() * 64, al = 0.35 + r() * 0.5;
        for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gr.addColorStop(0, `rgba(255,255,255,${al})`); gr.addColorStop(0.6, `rgba(255,255,255,${al * 0.6})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x + ox, y + oy, rr * 1.6, rr, 0, 0, 7); g.fill(); }
      }
    });
    return (A.texCache.montCloud = A.mkTex(c));
  }
  const TERR_N = 64, TERR_C = 26;   // vallée : 64 x 64 cases de 26 m
  function farInit(B) {
    const scene = B.g.parent, W = scene && scene.userData.dgWorld; if (!W) return null;
    if (W.mont) return W.mont;
    const F = W.mont = { g: new THREE.Group(), wx: 0, wz: 0, pal: null, tsx: NaN, tsz: NaN, last: 0, env: null, nbEnv: null, nbx: 0, nbz: 0 };
    W.g.add(F.g); const keep = x => { W.disp.push(x); return x; };
    // la chaîne de pics (fusionnée par matériau)
    F.mats = { rock: keep(new THREE.MeshStandardMaterial({ color: L('#7d889c'), roughness: 1, flatShading: true })), rock_d: keep(new THREE.MeshStandardMaterial({ color: L('#5a6476'), roughness: 1, flatShading: true })), snow: keep(new THREE.MeshStandardMaterial({ color: L('#eef3fa'), roughness: 0.9, flatShading: true })) };
    const r = A.rnd(777), lists = {}, mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler();
    for (let i = 0; i < 40; i++) {
      const near = i >= 24, a = (near ? (i - 24) / 16 : i / 24) * TAU + (r() - 0.5) * 0.25, d = near ? 250 + r() * 70 : 360 + r() * 130;
      const top = near ? -75 + r() * 35 : 5 + r() * 60, h = top + 175, nm = r() < 0.5 ? 'pic_a' : 'pic_b', w = h * (near ? 0.7 + r() * 0.4 : 1.0 + r() * 0.7), ry = r() * TAU;
      const P = parts(nm); if (!P) continue;
      mm.compose(_p.set(Math.sin(a) * d, -175, Math.cos(a) * d), qq.setFromEuler(ee.set(0, ry, 0)), _sc.set(w, h, w * (0.8 + r() * 0.4)));
      P.forEach(p => { const g = p.g.clone(); g.applyMatrix4(mm); (lists[p.m] = lists[p.m] || []).push(g); });
    }
    F.peaks = new THREE.Group(); F.g.add(F.peaks);
    for (const k in lists) { const geo = keep(A.mergeGeos(lists[k], 40)); lists[k].forEach(g => g.dispose()); F.peaks.add(new THREE.Mesh(geo, F.mats[k] || F.mats.rock)); }
    // la vallée (loin en dessous) : relief à facettes, forêts, alpages, neige ; recalculé quand la caméra change de case
    const NV = TERR_N * TERR_N * 6, tg = keep(new THREE.BufferGeometry());
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NV * 3), 3)); tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NV * 3), 3)); tg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(NV * 3), 3));
    F.terr = new THREE.Mesh(tg, keep(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }))); F.terr.frustumCulled = false; F.g.add(F.terr);
    // la mer de nuages (deux couches qui défilent, fixes dans le monde)
    const ct = cloudTex(), mk = (y, rep, op) => { const t = keep(ct.clone()); t.needsUpdate = true; t.repeat.set(rep, rep); const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(2000, 2000)), keep(new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: op, depthWrite: false, color: 0xffffff }))); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = -1; F.g.add(m); return { m, t, rep, y }; };
    F.clouds = [mk(-112, 8, 0.6), mk(-78, 6, 0.72)];
    // aurore boréale (nuit)
    F.aurU = { uT: { value: 0 }, uA: { value: L('#3aff9a') }, uB: { value: L('#7a5aff') }, uI: { value: 1 } };
    const am = keep(new THREE.ShaderMaterial({ uniforms: F.aurU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uT, uI; uniform vec3 uA, uB; varying vec2 vUv; void main(){ float x = vUv.x; float band = 0.5 + 0.5 * sin(x * 40.0 + uT * 0.5 + sin(x * 11.0 - uT * 0.35) * 2.5); float cur = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.3, 1.0, vUv.y)); float edge = smoothstep(0.0, 0.12, x) * (1.0 - smoothstep(0.88, 1.0, x)); vec3 c = mix(uA, uB, smoothstep(0.2, 1.0, vUv.y)); gl_FragColor = vec4(c * (0.25 + 0.75 * band) * cur * edge * uI * 0.55, 1.0); }' }));
    F.aur = new THREE.Group(); F.g.add(F.aur);
    [[0.9, 330, 80, 0.95], [2.3, 360, 95, 0.75], [-1.6, 340, 85, 0.7]].forEach(([a0, rad, y0, span]) => {
      const nx = 64, pos = [], uv = [];
      for (let i = 0; i <= nx; i++) { const t = i / nx, a = a0 - span / 2 + span * t, w = Math.sin(t * 9 + a0) * 18; for (const v of [0, 1]) { pos.push(Math.sin(a) * (rad + w), y0 + v * 110 + Math.sin(t * 5) * 12, Math.cos(a) * (rad + w)); uv.push(t, v); } }
      const idx = []; for (let i = 0; i < nx; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      const mesh = new THREE.Mesh(g, am); mesh.frustumCulled = false; F.aur.add(mesh);
    });
    F.W = W;
    F.terrain = function (wx0, wz0) {
      const P = F.pal || W.pal, pos = tg.attributes.position.array, col = tg.attributes.color.array, cF = L(P.forest || '#2e4a3a'), cM = L(P.meadow || '#4f6a4a'), cR = L(P.farRock || '#7d889c'), cS = L(P.farSnow || '#eef3fa'), cc = new THREE.Color();
      const half = TERR_N * TERR_C / 2, hgt = (x, z) => { const X = x + wx0, Z = z + wz0, n = fbm(X / 260, Z / 260), ridge = 1 - Math.abs(vnoise(X / 170 + 11, Z / 170 + 5) * 2 - 1); return (n - 0.5) * 120 + ridge * ridge * 70; };
      let o = 0;
      for (let j = 0; j < TERR_N; j++) for (let i = 0; i < TERR_N; i++) {
        const x0 = -half + i * TERR_C, z0 = -half + j * TERR_C, x1 = x0 + TERR_C, z1 = z0 + TERR_C;
        const h00 = hgt(x0, z0), h10 = hgt(x1, z0), h01 = hgt(x0, z1), h11 = hgt(x1, z1);
        const tris = [[[x0, h00, z0], [x0, h01, z1], [x1, h10, z0]], [[x1, h10, z0], [x0, h01, z1], [x1, h11, z1]]];
        for (let q = 0; q < 2; q++) {
          const tri = tris[q], hm = (tri[0][1] + tri[1][1] + tri[2][1]) / 3, sl = Math.abs(tri[0][1] - tri[1][1]) + Math.abs(tri[1][1] - tri[2][1]), k = hash(Math.floor((x0 + wx0) / TERR_C) * 2 + q, Math.floor((z0 + wz0) / TERR_C));
          if (hm > 62 - k * 18) cc.copy(cS); else if (sl > 34) cc.copy(cR); else if (hm > 20) cc.copy(cR).lerp(cF, 0.35); else cc.copy(k < 0.32 ? cM : cF);
          cc.multiplyScalar(0.92 + k * 0.16);
          for (const v of tri) { pos[o] = v[0]; pos[o + 1] = v[1]; pos[o + 2] = v[2]; col[o] = cc.r; col[o + 1] = cc.g; col[o + 2] = cc.b; o += 3; }
        }
      }
      tg.attributes.position.needsUpdate = true; tg.attributes.color.needsUpdate = true; tg.computeVertexNormals(); tg.computeBoundingSphere();
    };
    F.applyPal = function (P) {
      F.pal = P;
      F.mats.rock.color.copy(L(P.farRock)); F.mats.rock_d.color.copy(L(P.farRock)).multiplyScalar(0.72); F.mats.snow.color.copy(L(P.farSnow));
      F.clouds.forEach((c, i) => { c.m.material.color.copy(L(i ? P.cloud : P.cloudSh)); });
      F.aur.visible = !!P.aurora;
      const d = _a.set(P.sun[0], P.sun[1], P.sun[2]).normalize();
      W.key.position.copy(d).multiplyScalar(90); W.key.target.position.set(0, 0, 0);
      W.moon.position.copy(d).multiplyScalar(340); W.moon.scale.setScalar(P.sunSize || 60);
      F.tsx = NaN;   // la vallée change de couleurs
    };
    F.update = function () {
      const now = performance.now(); if (now - F.last < 2) return; F.last = now;
      const S = BR.Arena && BR.Arena.session && BR.Arena.session(); if (!S || !S.cam || !S.env) return;
      // changement de salle (le monde est recentré sur la nouvelle) : la vallée et les nuages restent fixes
      if (S.env !== F.env) { if (F.env && S.env === F.nbEnv) { F.wx += F.nbx; F.wz += F.nbz; } F.env = S.env; }
      const nb = S.env.nb; F.nbEnv = nb ? nb.env : null; if (nb) { F.nbx = nb.off.x; F.nbz = nb.off.z; }
      if (W.pal && W.pal.map === M && (!F.pal || W.pal.id !== F.pal.id)) F.applyPal(W.pal);
      const cx = S.cam.position.x, cz = S.cam.position.z, t = now / 1000;
      F.peaks.position.set(cx, 0, cz); F.aur.position.set(cx, 0, cz); F.aurU.uT.value = t;
      F.clouds.forEach((c, i) => { c.m.position.set(cx, c.y, cz); c.t.offset.set((cx + F.wx) * c.rep / 2000 + t * (i ? 0.0016 : 0.0009), -(cz + F.wz) * c.rep / 2000 + t * 0.0004); });
      const G = TERR_C * 2, sx = Math.round(cx / G) * G, sz = Math.round(cz / G) * G;
      if (sx !== F.tsx || sz !== F.tsz || F.twx !== F.wx || F.twz !== F.wz) { F.tsx = sx; F.tsz = sz; F.twx = F.wx; F.twz = F.wz; F.terrain(sx + F.wx, sz + F.wz); F.terr.position.set(sx, -178, sz); }
      FT.value = t;
    };
    return F;
  }

  // satellites : aiguilles de pierre plus basses que le plateau (on les voit d'en haut), nuages bas qui s'y accrochent
  function satellites(B, R) {
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1, a = side * (0.8 + B.rnd() * (Math.PI - 1.6)), d = R + 30 + B.rnd() * 95, top = -5 - B.rnd() * 38 + (d > R + 90 ? 20 : 0), h = top + 182, s = h * (0.75 + B.rnd() * 0.4);
      const P = parts('aiguille'); if (!P) break;
      const ry = B.rnd() * TAU;
      P.forEach(p => { const g = p.g.clone(); g.applyMatrix4(_m4.compose(_p.set(Math.sin(a) * d, -182, Math.cos(a) * d), _q.setFromAxisAngle(_y, ry), _sc.set(s * 0.5, h, s * 0.5))); own(B, p.m, g); });
    }
    for (let i = 0; i < 12; i++) {
      const a = B.rnd() * TAU, d = R + 34 + B.rnd() * 130, y = -34 - B.rnd() * 36, s = 5 + B.rnd() * 8, x = Math.sin(a) * d, z = Math.cos(a) * d;
      for (let k = 0; k < 5; k++) { const g = PUFF.clone(); g.applyMatrix4(_m4.compose(_p.set(x + (B.rnd() - 0.5) * s * 3, y + B.rnd() * s * 0.4, z + (B.rnd() - 0.5) * s * 2), _q.setFromAxisAngle(_y, B.rnd() * TAU), _sc.set(s * (1.2 + B.rnd() * 0.8), s * (0.45 + B.rnd() * 0.3), s * (0.9 + B.rnd() * 0.6)))); own(B, 'cloud', g); }
    }
  }

  /* =====================================================================
     LE THÈME
     ===================================================================== */
  DG.THEMES.montagne = {
    signWall: false,
    setup(B) {
      const P = B.P;
      // sol : dallage enneigé ; roche : couleur unie à facettes ; neige légèrement bleutée
      B.mats.floor.dispose(); B.mats.floor = new THREE.MeshStandardMaterial({ map: floorTex(P), roughness: 0.9 });
      B.mats.wall.dispose(); B.mats.wall = new THREE.MeshStandardMaterial({ color: L(COL.rock), roughness: 0.95, flatShading: true });
      B.mats.snow.color.copy(L(P.snowCol));
      const F = farInit(B);
      if (F) { if (!F.pal) F.applyPal(F.W.pal && F.W.pal.map === M ? F.W.pal : P); B.anims.push(() => F.update()); }
    },

    /* ---------- grande salle de combat : le plateau au sommet du pic ---------- */
    hall(B, room, rng, o) {
      const R = A.ROOM_R + 0.9, boss = o && o.pillars === false;
      // chaque grande salle tire son plan : en miroir ou non, couverts en colonnes ou en menhirs
      const fl = rng() < 0.5 ? 1 : -1, menhirs = rng() < 0.5, mir = ([a0, a1]) => fl > 0 ? [a0, a1] : [-a1, -a0];
      B.floorDisc(0, 0, R + 0.5);
      // le plan du bord : balcons (vue sur le vide), tables de roche (altitude), ruine, chorten
      const balc = [[0.24, 0.64], [2.5, 2.9], [-1.42, -0.98]].map(mir), inBalc = a => balc.some(([a0, a1]) => norm2(a - a0) > 0 && norm2(a1 - a) > 0);
      const nz = ringNoise(B);
      const margin = a => {
        let m = 3.6 + nz(a) * 1.8; const dn = Math.min(Math.abs(norm2(a)), Math.abs(norm2(a - Math.PI)));
        m = m + (2.2 - m) * (1 - sstep(0.12, 0.35, dn));
        balc.forEach(([a0, a1]) => { const c = (a0 + a1) / 2, w = Math.abs(a1 - a0) / 2; m = m + (1.3 - m) * (1 - sstep(w - 0.02, w + 0.14, Math.abs(norm2(a - c)))); });
        return m;
      };
      const outline = roundOutline(R + 0.5, margin, 112);
      pedestal(B, outline, false);
      guardRing(B, R, 3.45);
      // neige au sol sur le pourtour, anneaux de dallage sombre
      snowRing(B, a => 27.6 + nz(a * 1.7 + 1) * 1.2, R + 0.6, 96);
      flatRing(B, 'stone_d', 25.6, 26.2, 0.008); flatRing(B, 'stone_d', 9.7, 10.2, 0.008); flatRing(B, 'gold', 1.6, 1.9, 0.01);
      // portes et ponts
      const ent = A.door(B, 0, -(R + 0.2), Math.PI, { open: true });
      const exit = A.door(B, 0, R + 0.2, 0);
      dressDoor(B, ent); dressDoor(B, exit);
      for (const dz of [-1, 1]) for (const s of [-1, 1]) { const a = (dz > 0 ? 0 : Math.PI) + s * 0.19; boulder(B, Math.sin(a) * (R + 1.6), Math.cos(a) * (R + 1.6), 2.4, true); pine(B, Math.sin(a + s * 0.05) * (R + 3.6), Math.cos(a + s * 0.05) * (R + 3.6), 1.2); }
      // rochers et sapins tout autour (sauf balcons et portes)
      const rimPts = [];
      for (let a = 0.3; a < Math.PI - 0.28; a += 0.088) for (const s of [1, -1]) {
        const aa = s * (a + (B.rnd() - 0.5) * 0.03); if (inBalc(aa)) continue;
        rimPts.push({ x: Math.sin(aa) * (R + 0.4), z: Math.cos(aa) * (R + 0.4), nx: Math.sin(aa), nz: Math.cos(aa), m: margin(aa) - 0.4 });
      }
      rimRocks(B, rimPts, R);
      // balcons : clôture au ras du vide, mâts et drapeaux
      const poles = [];
      balc.forEach(([a0, a1]) => {
        const n = Math.max(2, Math.round(Math.abs(a1 - a0) * R / 2.3)), pts = [];
        for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([Math.sin(a) * (R + 0.3), Math.cos(a) * (R + 0.3)]); }
        fence(B, pts);
        const p0 = pole(B, Math.sin(a0) * (R + 1.1), Math.cos(a0) * (R + 1.1)), p1 = pole(B, Math.sin(a1) * (R + 1.1), Math.cos(a1) * (R + 1.1));
        flagLine(B, ...p0, ...p1, 1.4); poles.push(p0, p1);
        for (let k = 0; k < 3; k++) { const a = a0 + (a1 - a0) * (0.2 + B.rnd() * 0.6); drift(B, Math.sin(a) * (R - 0.4), Math.cos(a) * (R - 0.4), 0.8 + B.rnd() * 0.6, a); }
      });
      // tables de roche praticables (3 niveaux : 1,05 / 2,15 / 3,2 m) avec lanterne, cairn, mât
      const terr = [1.04, 2.2, -0.62, -2.3].map(a => a * fl);
      terr.forEach((a, i) => {
        const ox = Math.sin(a), oz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a), sg = i % 2 ? -1 : 1, at = (d, t) => [ox * d + tx * t * sg, oz * d + tz * t * sg];
        const [x1, z1] = at(R - 6.3, 0.8), [x2, z2] = at(R - 3.5, -1.7), [x3, z3] = at(R - 1.6, 1.9);
        slab(B, x1, z1, 2.9, 1.05); slab(B, x2, z2, 2.6, 2.15); slab(B, x3, z3, 2.0, 3.2);
        lantern(B, x2 + ox * 0.8, z2 + oz * 0.8, a + Math.PI, 2.15);
        put(B, 'cairn', x1 - ox * 0.6 + tx * 0.9, 1.05, z1 - oz * 0.6 + tz * 0.9, B.rnd() * TAU, 0.9); B.cyl(x1 - ox * 0.6 + tx * 0.9, z1 - oz * 0.6 + tz * 0.9, 0.45, 0.9, 2.2);
        poles.push(pole(B, x3 + ox * 0.5, z3 + oz * 0.5, 3.2, 0.9)); B.cyl(x3 + ox * 0.5, z3 + oz * 0.5, 0.35, 3.1, 9);
        for (const [x, z, r] of [[x1, z1, 2.9], [x2, z2, 2.6]]) { const b = B.rnd() * TAU; drift(B, x + Math.sin(b) * r * 0.9, z + Math.cos(b) * r * 0.9, 1.1, b); }
      });
      // ruine de monastère (est) avec sa terrasse de pierre
      {
        const a = 1.6 * fl, x = Math.sin(a) * (R - 0.2), z = Math.cos(a) * (R - 0.2), ry = a + Math.PI, ox = Math.sin(a), oz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
        put(B, 'ruine', x, 0, z, ry, 1.1); B.solid(x, z, 3.9, 0.7, ry, -1, 14);
        for (const s of [-1, 1]) B.cyl(x - tx * s * 4.6 - ox * 0.45, z - tz * s * 4.6 - oz * 0.45, 0.62, -1, s < 0 ? 4.2 : 2.6);
        const px = Math.sin(a) * (R - 3.1), pz = Math.cos(a) * (R - 3.1);
        B.box(mt(B, 'stone'), px, 0.55, pz, 6.4, 1.1, 2.6, ry, true); B.add(mt(B, 'snow'), BOX, px, 1.12, pz, ry, 0, 0, 6.2, 0.06, 2.4);
        B.box(mt(B, 'stone_d'), px - ox * 1.8, 0.28, pz - oz * 1.8, 2.4, 0.56, 1.1, ry, true);
        B.obstacles.push({ x: px, z: pz, r: 3.3, h: 1.1 });
        for (const s of [-1, 1]) lantern(B, Math.sin(a + s * 0.17) * (R - 2.6), Math.cos(a + s * 0.17) * (R - 2.6), ry);
      }
      // chorten (ouest), sur un socle de rochers, drapeaux en étoile
      {
        const a = -1.76 * fl, x = Math.sin(a) * (R - 1.4), z = Math.cos(a) * (R - 1.4);
        put(B, 'stupa', x, 0, z, a + Math.PI, 1.0); B.cyl(x, z, 2.35, -1, 14); B.obstacles.push({ x, z, r: 2.4, h: 14 });
        const top = [x, 6.6, z];
        poles.forEach(p => { if (Math.hypot(p[0] - x, p[2] - z) < 26) flagLine(B, ...top, ...p, 1.2); });
        for (const s of [-1, 1]) { put(B, 'cairn', Math.sin(a + s * 0.13) * (R - 2.2), 0, Math.cos(a + s * 0.13) * (R - 2.2), B.rnd() * TAU, 1.0); B.cyl(Math.sin(a + s * 0.13) * (R - 2.2), Math.cos(a + s * 0.13) * (R - 2.2), 0.5, -1, 1.3); }
        drift(B, x - Math.sin(a) * 2.6, z - Math.cos(a) * 2.6, 1.4, a);
      }
      // drapeaux le long du bord, d'un mât à l'autre
      const byA = poles.slice().sort((p, q) => Math.atan2(p[0], p[2]) - Math.atan2(q[0], q[2]));
      for (let i = 0; i < byA.length; i++) { const p = byA[i], q = byA[(i + 1) % byA.length], d = Math.hypot(p[0] - q[0], p[2] - q[2]); if (d > 4 && d < 24) flagLine(B, ...p, ...q, 1.5); }
      // couverts : colonnes brisées d'un ancien temple (pas dans la salle du gardien)
      if (!boss) {
        const off = (rng() - 0.5) * 0.12, cols = [0.74 + off, -0.74 + off, 2.4 - off, -2.4 - off].map(a => [Math.sin(a) * 18.5, Math.cos(a) * 18.5]);
        cols.forEach(([x, z]) => {
          if (menhirs) { put(B, 'rocher_c', x, -0.2, z, B.rnd() * TAU, 1.45, 4.1, 1.35); B.cyl(x, z, 1.05, -2, 40); B.obstacles.push({ x, z, r: 1.05, h: 40 }); }
          else { put(B, 'colonne', x, 0, z, B.rnd() * TAU, 1.0); B.cyl(x, z, 0.95, -2, 40); B.obstacles.push({ x, z, r: 0.95, h: 40 }); }
          drift(B, x + 0.8, z - 0.6, 0.9, B.rnd() * 3);
        });
        flagLine(B, cols[0][0], 5.0, cols[0][1], cols[1][0], 5.0, cols[1][1], 0.8); flagLine(B, cols[2][0], 5.0, cols[2][1], cols[3][0], 5.0, cols[3][1], 0.8);
      } else {
        // salle du gardien : quatre grands braseros sur le pourtour du disque
        for (const a of [0.78, -0.78, 2.36, -2.36]) { const x = Math.sin(a) * 27.4, z = Math.cos(a) * 27.4; A.brazier(B, x, z, true); B.add(mt(B, 'stone_d'), BOX, x, 0.05, z, a, 0, 0, 1.8, 0.1, 1.8); }
      }
      return { R, entrance: ent, exits: [exit], spawn: { x: 0, z: -(R - 7.5), yaw: 0 }, rewardAt: new V3(0, 0, 0) };
    },

    /* ---------- salle calme : le refuge et son petit temple ---------- */
    chapel(B, room, rng) {
      const R = 17; void rng;
      B.floorDisc(0, 0, R + 0.5);
      const nz = ringNoise(B);
      const margin = a => { let m = 4.2 + nz(a) * 1.6; const dn = Math.min(Math.abs(norm2(a)), Math.abs(norm2(a - Math.PI))); return m + (2.4 - m) * (1 - sstep(0.2, 0.55, dn)); };
      pedestal(B, roundOutline(R + 0.5, margin, 84), false);
      guardRing(B, R, 3.45);
      snowRing(B, a => 12.8 + nz(a * 2 + 3) * 0.9, R + 0.6, 72);
      flatRing(B, 'stone_d', 7.7, 8.1, 0.008);
      const ent = A.door(B, 0, -(R + 0.2), Math.PI, { open: true });
      const exit = A.door(B, 0, R + 0.2, 0, { w: 4.2 });
      dressDoor(B, ent); dressDoor(B, exit);
      // le bord : rochers, sapins (sauf devant le refuge, le chorten et les portes)
      const rimPts = [];
      for (let a = 0.42; a < Math.PI - 0.4; a += 0.16) for (const s of [1, -1]) {
        const aa = s * (a + (B.rnd() - 0.5) * 0.05); if (Math.abs(Math.abs(aa) - Math.PI / 2) < 0.3) continue;
        rimPts.push({ x: Math.sin(aa) * (R + 0.4), z: Math.cos(aa) * (R + 0.4), nx: Math.sin(aa), nz: Math.cos(aa), m: margin(aa) - 0.4 });
      }
      rimRocks(B, rimPts, R);
      for (const dz of [-1, 1]) for (const s of [-1, 1]) { const a = (dz > 0 ? 0 : Math.PI) + s * 0.34; boulder(B, Math.sin(a) * (R + 1.5), Math.cos(a) * (R + 1.5), 2.0, true); }
      // le chorten (est)
      const sx = Math.sin(Math.PI / 2) * 13.4, top = [sx, 6.6, 0];
      put(B, 'stupa', sx, 0, 0, -Math.PI / 2, 0.95); B.cyl(sx, 0, 2.25, -1, 14); B.obstacles.push({ x: sx, z: 0, r: 2.3, h: 14 });
      for (const s of [-1, 1]) { put(B, 'cairn', sx - 0.6, 0, s * 3.4, B.rnd() * TAU, 0.8); B.cyl(sx - 0.6, s * 3.4, 0.42, -1, 1.1); drift(B, sx + 1.6, s * 2.6, 1.1, 0); }
      // le refuge (ouest), sa façade vers le centre
      const rx = -14.4, ry = Math.PI / 2;
      put(B, 'refuge', rx, 0, 0, ry, 1.0); B.solid(rx, 0, 2.9, 2.5, ry, -1, 14); B.obstacles.push({ x: rx, z: 0, r: 3.2, h: 14 });
      B.spot(rx + 2.6, 2.0, 1.2, '#ffb060', 2.0, { flick: true, dist: 12 });
      pine(B, rx - 2.2, 4.4, 1.1); pine(B, rx - 1.6, -4.8, 0.9); drift(B, rx + 2.9, 2.9, 1.0, 0.4);
      // moulins à prières (sud-est), lanternes, mâts
      { const a = 2.36, x = Math.sin(a) * 13.6, z = Math.cos(a) * 13.6, r2 = a + Math.PI; put(B, 'moulins', x, 0, z, r2, 1); B.solid(x, z, 2.1, 0.55, r2, -1, 3); B.obstacles.push({ x, z, r: 2.2, h: 3 }); }
      for (const a of [0.78, -0.78, -2.36]) lantern(B, Math.sin(a) * 12.4, Math.cos(a) * 12.4, a + Math.PI);
      const poles = [-0.5, 0.55, -2.65, 2.75].map(a => pole(B, Math.sin(a) * (R + 1.0), Math.cos(a) * (R + 1.0)));
      poles.forEach(p => flagLine(B, ...top, ...p, 1.5));
      flagLine(B, rx + 0.5, 4.6, 0.4, poles[0][0], poles[0][1], poles[0][2], 1.2); flagLine(B, rx + 0.5, 4.6, -0.4, poles[2][0], poles[2][1], poles[2][2], 1.2);
      return { R, entrance: ent, exits: [exit], spawn: { x: 0, z: -13, yaw: 0 }, rewardAt: new V3(0, 0, 0) };
    },

    /* ---------- salles d'énigme : plateau rectangulaire ; full === false → l'aiguille est creuse (gouffre) ---------- */
    rectShell(B, W, Lz, H, full) {
      const hx = W / 2, hz = Lz / 2; B._montFull = full;
      const nz = ringNoise(B);
      const margin = a => { const m = 3.4 + nz(a) * 1.4, c = Math.abs(Math.cos(a)); return m + (2.2 - m) * sstep(0.85, 0.97, c); };
      const outline = rectOutline(hx, hz, margin, 128);
      pedestal(B, outline, !full);
      // garde-fous invisibles (côtés, et bouts de part et d'autre des portes)
      for (const s of [-1, 1]) {
        B.solid(s * (hx + 0.1), 0, 0.6, hz + 0.6, 0, -2, 14);
        B.solid(s * (3.45 + (hx + 0.7 - 3.45) / 2), -(hz + 0.1), (hx + 0.7 - 3.45) / 2, 0.6, 0, -2, 14);
        B.solid(s * (3.45 + (hx + 0.7 - 3.45) / 2), hz + 0.1, (hx + 0.7 - 3.45) / 2, 0.6, 0, -2, 14);
      }
      // les grands côtés : rochers et sapins, avec un balcon de bois au milieu
      const rim = [];
      for (const s of [-1, 1]) {
        const bz0 = -hz * 0.22 + s * hz * 0.12, bz1 = bz0 + Math.min(12, Lz * 0.28), pts = [];
        for (let z = -hz + 2.6; z < hz - 2.4; z += 3.1) { const zz = z + (B.rnd() - 0.5) * 0.6; if (zz > bz0 - 1 && zz < bz1 + 1) continue; rim.push({ x: s * (hx + 0.3), z: zz, nx: s, nz: 0, out: true, m: 3.4 + nz(Math.atan2(s, zz / hz)) * 1.3 }); }
        for (let z = bz0; z <= bz1 + 0.01; z += (bz1 - bz0) / Math.max(2, Math.round((bz1 - bz0) / 2.3))) pts.push([s * (hx + 0.28), z]);
        fence(B, pts);
        const p0 = pole(B, s * (hx + 1.1), bz0 - 0.6), p1 = pole(B, s * (hx + 1.1), bz1 + 0.6); flagLine(B, ...p0, ...p1, 1.2);
        // lanternes sur le bord (hors de la salle)
        for (let z = -hz + 5; z < hz - 3; z += 11) { const zz = z > bz0 - 1.5 && z < bz1 + 1.5 ? bz1 + 3 : z; if (zz > hz - 3) continue; put(B, 'lanterne', s * (hx + 1.25), 0, zz, s > 0 ? -Math.PI / 2 : Math.PI / 2, 1); B.spot(s * (hx + 1.25), 1.7, zz, B.P.accent, 2.1, { flick: true, dist: 14 }); }
      }
      // les petits côtés : rochers de part et d'autre des portes
      for (const sz of [-1, 1]) for (let x = 5.2; x < hx - 0.5; x += 3.2) for (const s of [-1, 1]) rim.push({ x: s * x, z: sz * (hz + 0.3), nx: 0, nz: sz, out: true, m: 2.6 });
      rimRocks(B, rim, Math.max(hx, hz));
      // coins : gros rochers et sapins
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { boulder(B, sx * (hx + 1.4), sz * (hz + 1.2), 2.4, false); pine(B, sx * (hx + 3.2), sz * (hz + 2.2), 1.15); pine(B, sx * (hx + 2.0), sz * (hz + 3.6), 0.9); }
    },
    roomDecor(B, W, Lz, H) {
      const hx = W / 2, hz = Lz / 2, full = B._montFull !== false;
      B.doors.forEach(D => dressDoor(B, D));
      // petit toit de bois sur la stèle de la consigne
      { const x = -7.5, z = -hz + 0.55; for (const s of [-1, 1]) B.add(mt(B, 'wood_d'), BOX, x + s * 3.0, 2.25, z, 0, 0, 0, 0.26, 4.5, 0.26); B.add(mt(B, 'red'), BOX, x, 4.5, z, 0, 0, 0, 6.6, 0.22, 0.4); for (const s of [-1, 1]) { B.add(mt(B, 'slate'), BOX, x, 4.85, z + s * 0.42, 0, s * 0.5, 0, 7.0, 0.14, 1.0); B.add(mt(B, 'snow'), BOX, x, 4.95, z + s * 0.36, 0, s * 0.5, 0, 6.8, 0.1, 0.75); } }
      // drapeaux de prières au-dessus de la salle, d'un bord à l'autre (haut, au-dessus des mécanismes)
      const nf = Math.max(2, Math.floor(Lz / 17));
      for (let i = 0; i < nf; i++) {
        const z = -hz + (i + 0.5) * Lz / nf + (B.rnd() - 0.5) * 2, z2 = z + (B.rnd() - 0.5) * 6;
        const p0 = pole(B, -(hx + 1.6), z, 0, 1.35), p1 = pole(B, hx + 1.6, z2, 0, 1.35);
        flagLine(B, ...p0, ...p1, 2.2);
      }
      // neige le long des bords et congères (seulement s'il y a un sol partout)
      if (full) {
        for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(1.0, Lz - 1, 1, 1); g.rotateX(-Math.PI / 2); g.translate(s * (hx - 0.5), 0.012, 0); own(B, 'snow', g.toNonIndexed()); g.dispose(); }
        for (let i = 0; i < Math.floor(Lz / 6); i++) for (const s of [-1, 1]) drift(B, s * (hx - 0.1), -hz + 3 + i * 6 + B.rnd() * 3, 0.5 + B.rnd() * 0.3, Math.PI / 2);
      }
      void H;
    },

    /* ---------- au loin ---------- */
    skyline(B, R) { satellites(B, R); },

    finish(B) { flushOwn(B); flushFlags(B); },
  };
})();

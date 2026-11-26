/* ===== arena/maps/forge.js : thème de la carte « forge » — La Forge des Abysses (voir js/arena/maps/README-CARTES.md) =====
   Une forge naine au cœur d'un volcan : chaque salle est une île de basalte (colonnes hexagonales de hauteurs variées)
   entourée d'un fossé de lave ; au-delà, des plateaux de basalte coupés de rivières de lave, des cascades de lave,
   des fonderies naines qui fument, et au loin les parois du cratère.
   - matériaux unis (style KayKit), ombrés en facettes ; la roche rougeoie près de la lave (petit ajout au shader : « chaleur »)
   - modèles Blender (assets-map-forge.js, outils/blender-map-forge.py) fusionnés avec le décor (1 appel de dessin par matériau)
   - particules (fumées, braises) : 2 nuages de points par salle, animés sans état (déterministes)
   - lumière : contre-jour orange (lumière principale), ombres violettes (ciel), braseros et cascades comme sources (B.spot) */
(function () {
  const BR = window.BR, DG = BR.Dungeon; DG.THEMES = DG.THEMES || {};
  const A = DG.api, L = A.L, V3 = THREE.Vector3, PI = Math.PI, TAU = PI * 2;
  const M = DG.mapOf('forge');
  const n2 = a => Math.atan2(Math.sin(a), Math.cos(a));
  const nearNS = (a, w) => Math.abs(n2(a)) < w || Math.abs(n2(a - PI)) < w;

  /* ---------------------------------------------------------------- ambiances (étages 1-5, 6-10, 11+) */
  Object.assign(M.tiers[0], { n: 'Les Fonderies naines', stone: '#1e1b24', btop: '#3a3440', mortar: '#0e0a0c', floor: '#38343f', trim: '#56484a', statue: '#4c4448', wood: '#5a3a24', metal: '#36323c', accent: '#ff9a4a', banner: '#8a2a10', moss: 0, glow: '#ff5a10', hot: '#ffc060', lava: '#ff5a10', crust: '#3a0c06', smoke: '#6a5450',
    sky: ['#14081a', '#4a1a24', '#f8742a'], fog: ['#8e3818', 0.0062], hemi: ['#8a78e0', '#2a1418', 0.82], moon: ['#ffaa60', 1.6] });
  Object.assign(M.tiers[1], { n: 'Le Cœur du volcan', stone: '#1c161e', btop: '#3a3038', mortar: '#0a0606', floor: '#3c3540', trim: '#504040', statue: '#4a3e40', wood: '#4a2c1c', metal: '#342e36', accent: '#ff7a3a', banner: '#6a1a08', moss: 0, glow: '#ff3a0a', hot: '#ffb050', lava: '#f03a0a', crust: '#2e0604', smoke: '#5e4642',
    sky: ['#12040a', '#46101a', '#ff5a20'], fog: ['#86200e', 0.0066], hemi: ['#9a78d8', '#240a10', 0.85], moon: ['#ff9050', 1.6] });
  Object.assign(M.tiers[2], { n: "L'Abîme de magma", stone: '#1a1828', btop: '#302c44', mortar: '#06040a', floor: '#302c40', trim: '#4a4462', statue: '#46405e', wood: '#2e2232', metal: '#30303e', accent: '#a08aff', banner: '#3a1a7a', moss: 0, glow: '#5a4aff', hot: '#b0e8ff', lava: '#5060ff', crust: '#100828', smoke: '#4a4470',
    sky: ['#06040e', '#1e1248', '#8a64ff'], fog: ['#3a2480', 0.0066], hemi: ['#7a90e0', '#140c28', 0.75], moon: ['#b8a0ff', 1.45] });
  M.exp = 1.12;

  /* ---------------------------------------------------------------- textures (dessinées une fois par ambiance) */
  const TC = {};
  const hx = c => '#' + c.getHexString();
  // dalles hexagonales (sol) : chanfrein clair, joints sombres
  function hexFloorTex(P) {
    const key = 'fgHex' + P.id; if (TC[key]) return TC[key];
    const r = A.rnd(53), N = 512, s = N / 6, rowH = N / 3, sv = s * (rowH / (Math.sqrt(3) * s));
    const c = A.cv(N, (g) => {
      g.fillStyle = hx(new THREE.Color(P.floor).multiplyScalar(0.35)); g.fillRect(0, 0, N, N);
      const base = new THREE.Color(P.floor);
      const hexp = (cx, cy, k) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const x = cx + Math.cos(a) * s * k, y = cy + Math.sin(a) * sv * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill(); };
      for (let ci = 0; ci < 4; ci++) for (let ri = -1; ri <= 3; ri++) {
        const cx = ci * 1.5 * s, cy = ri * rowH + (ci % 2) * rowH / 2;
        const v = 0.8 + r() * 0.34, cc = base.clone().multiplyScalar(v); cc.offsetHSL((r() - 0.5) * 0.02, 0, 0);
        const edge = cc.clone().multiplyScalar(0.78), top = cc.clone(), crack = r() < 0.22;
        for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
          g.fillStyle = hx(edge); hexp(cx + dx, cy + dy, 0.93);
          g.fillStyle = hx(top); hexp(cx + dx, cy + dy, 0.82);
          if (crack) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + dx - s * 0.5, cy + dy - sv * 0.2); g.lineTo(cx + dx, cy + dy + sv * 0.1); g.lineTo(cx + dx + s * 0.3, cy + dy + sv * 0.55); g.stroke(); }
        }
      }
      A.shade(g, N, r, 10);
    });
    return (TC[key] = A.mkTex(c));
  }
  // lave : plaques de croûte (cellules) séparées de fissures brûlantes — dessin stylisé, pas de photo
  function lavaTex(P) {
    const key = 'fgLava' + P.id; if (TC[key]) return TC[key];
    const r = A.rnd(71), N = 256, G = 6, cs = N / G, seeds = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) seeds.push({ x: (i + 0.15 + r() * 0.7) * cs, y: (j + 0.15 + r() * 0.7) * cs, m: r() });
    const hot = new THREE.Color(P.hot), lav = new THREE.Color(P.lava), cru = new THREE.Color(P.crust);
    const c = A.cv(N, (g) => {
      const im = g.createImageData(N, N), d = im.data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const ci = Math.floor(x / cs), cj = Math.floor(y / cs); let d1 = 1e9, d2 = 1e9, m1 = 0;
        for (let oj = -1; oj <= 1; oj++) for (let oi = -1; oi <= 1; oi++) {
          const ii = (ci + oi + G) % G, jj = (cj + oj + G) % G, sd = seeds[jj * G + ii];
          const sx = sd.x + (ci + oi < 0 ? -N : ci + oi >= G ? N : 0), sy = sd.y + (cj + oj < 0 ? -N : cj + oj >= G ? N : 0);
          const dd = Math.hypot(x - sx, y - sy);
          if (dd < d1) { d2 = d1; d1 = dd; m1 = sd.m; } else if (dd < d2) d2 = dd;
        }
        const e = d2 - d1, crack = 1 - Math.min(1, e / 4), glow = 1 - Math.min(1, e / 13);
        const molten = Math.min(1, m1 * m1 * 0.45 + glow * 0.8);
        let R = cru.r + (lav.r - cru.r) * molten, Gc = cru.g + (lav.g - cru.g) * molten, Bc = cru.b + (lav.b - cru.b) * molten;
        const k = crack * crack; R += (hot.r - R) * k; Gc += (hot.g - Gc) * k; Bc += (hot.b - Bc) * k;
        const o = (y * N + x) * 4; d[o] = R * 255; d[o + 1] = Gc * 255; d[o + 2] = Bc * 255; d[o + 3] = 255;
      }
      g.putImageData(im, 0, 0);
    });
    const t = A.mkTex(c); t.repeat.set(1 / 3, 1 / 3);         // UV « monde » / 4 m → motif de 12 m
    return (TC[key] = t);
  }
  function lavaFallTex(P) {
    const key = 'fgFall' + P.id; if (TC[key]) return TC[key];
    const t = lavaTex(P).clone(); t.needsUpdate = true; t.repeat.set(0.5, 0.18);   // étiré vers le bas : ça coule
    return (TC[key] = t);
  }

  /* ---------------------------------------------------------------- matériaux */
  // « chaleur » : la roche rougeoie près de la surface de la lave (et sous le sol)
  function heatify(m, col, k) {
    const U = { value: col.clone().multiplyScalar(k) };
    m.onBeforeCompile = sh => {
      sh.uniforms.uHeat = U;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFgY;').replace('#include <fog_vertex>', '#include <fog_vertex>\nvFgY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFgY;\nuniform vec3 uHeat;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uHeat * (smoothstep(0.5, -1.4, vFgY) * 0.75 + smoothstep(-1.2, -5.0, vFgY) * 0.5);');
    };
    m.customProgramCacheKey = () => 'forgeHeat';
    return m;
  }
  const std = (col, o) => new THREE.MeshStandardMaterial(Object.assign({ color: L(col), roughness: 0.9, metalness: 0, flatShading: true }, o || {}));

  /* ---------------------------------------------------------------- géométries partagées : colonne de basalte */
  const HEX_SIDE = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); HEX_SIDE.translate(0, 0.5, 0);
  const HEX_CH = new THREE.CylinderGeometry(0.8, 1, 1, 6, 1, true); HEX_CH.translate(0, 0.5, 0);
  const HEX_TOP = new THREE.CircleGeometry(0.8, 6); HEX_TOP.rotateX(-PI / 2); HEX_TOP.rotateY(PI / 6);
  /** colonne hexagonale (corps basalte, chanfrein, dessus plus clair) ; o.solid : on bute dessus / on marche dessus */
  function col(B, x, z, r, top, o) {
    o = o || {}; const y0 = o.y0 != null ? o.y0 : -3, c = Math.min(0.24, r * 0.2), ry = o.ry != null ? o.ry : B.rnd() * 1.05;
    const h = top - c - y0;
    if (h > 0.02) B.add(o.mat || 'wall', HEX_SIDE, x, y0, z, ry, 0, 0, r, h, r);
    B.add(o.mat || 'wall', HEX_CH, x, top - c, z, ry, 0, 0, r, c, r);
    B.add(o.top || 'btop', HEX_TOP, x, top, z, ry, 0, 0, r, 1, r);
    if (o.solid) B.cyl(x, z, r * 0.92, y0, top);
  }
  const loc = (x, z, ry, lx, lz) => ({ x: x + lx * Math.cos(ry) + lz * Math.sin(ry), z: z - lx * Math.sin(ry) + lz * Math.cos(ry) });
  const faceIn = (x, z) => Math.atan2(-x, -z);

  /* ---------------------------------------------------------------- modèles Blender → géométrie fusionnée */
  const MATKEY = { basalt: 'wall', btop: 'btop', stone: 'trim', statue: 'statue', iron: 'metal', brass: 'gold', wood: 'wood', hot: 'glow', coal: 'dark' };
  const MC = {};
  function mdl(name) {
    if (name in MC) return MC[name];
    const sc = A.model('map_forge_' + name); if (!sc) return (MC[name] = null);
    sc.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(sc.matrixWorld).invert(), R = { base: [], dyn: [], fx: {} };
    const dynOf = o => { let p = o; while (p && p !== sc) { if (p.name && p.name.indexOf('dyn_') === 0) return p; p = p.parent; } return null; };
    sc.traverse(o => {
      if (o.isMesh) {
        const key = MATKEY[((o.material && o.material.name) || '').replace(/[.\d]+$/, '')] || 'wall', d = dynOf(o), g = o.geometry.clone(); g.userData.keep = true;
        if (d) {
          g.applyMatrix4(new THREE.Matrix4().copy(d.matrixWorld).invert().multiply(o.matrixWorld));
          let e = R.dyn.find(x => x.name === d.name);
          if (!e) { e = { name: d.name, pivot: new V3().setFromMatrixPosition(new THREE.Matrix4().copy(inv).multiply(d.matrixWorld)), parts: [] }; R.dyn.push(e); }
          e.parts.push({ key, geo: g });
        } else { g.applyMatrix4(new THREE.Matrix4().copy(inv).multiply(o.matrixWorld)); R.base.push({ key, geo: g }); }
      } else if (o.name && o.name.indexOf('fx_') === 0) R.fx[o.name.replace(/[.\d]+$/, '')] = new V3().setFromMatrixPosition(new THREE.Matrix4().copy(inv).multiply(o.matrixWorld));
    });
    return (MC[name] = R);
  }
  /** pose un modèle (fusionné) ; renvoie ses pièces animées et ses repères en coordonnées de la salle */
  function put(B, name, x, y, z, ry, s) {
    const R = mdl(name); if (!R) return null;
    s = s || 1;
    R.base.forEach(p => B.add(p.key, p.geo, x, y, z, ry, 0, 0, s, s, s));
    const fx = {}; for (const k in R.fx) { const v = R.fx[k], q = loc(x, z, ry, v.x * s, v.z * s); fx[k] = new V3(q.x, y + v.y * s, q.z); }
    const dyn = R.dyn.map(d => {
      const g = new THREE.Group(), q = loc(x, z, ry, d.pivot.x * s, d.pivot.z * s);
      g.position.set(q.x, y + d.pivot.y * s, q.z); g.rotation.y = ry; g.scale.setScalar(s);
      d.parts.forEach(p => { const m = new THREE.Mesh(p.geo, B.mats[p.key]); m.castShadow = true; m.receiveShadow = true; g.add(m); });
      B.g.add(g); return { obj: g, y0: g.position.y };
    });
    return { fx, dyn };
  }
  /** modèle entier en objet séparé (pour l'animer) */
  function putObj(B, name, x, y, z, ry, s) {
    const R = mdl(name); if (!R) return null;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0;
    const inner = new THREE.Group(); inner.scale.setScalar(s || 1); g.add(inner);
    R.base.forEach(p => { const m = new THREE.Mesh(p.geo, B.mats[p.key]); m.castShadow = true; m.receiveShadow = true; inner.add(m); });
    B.g.add(g); return inner;
  }
  function gear(B, x, y, z, ry, s, speed) { const g = putObj(B, 'engrenage', x, y, z, ry, s); if (g) B.anims.push((dt, t) => { g.rotation.z = t * speed; }); }

  /* ---------------------------------------------------------------- particules (fumée, braises) */
  const src = (B, kind, x, y, z, o) => { (B._fg.src[kind]).push(Object.assign({ x, y, z }, o || {})); };
  const PV = 'attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;\n#include <fog_pars_vertex>\nvoid main(){ vA = aAlpha; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale * projectionMatrix[1][1] / max(0.5, -mvPosition.z); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}';
  const PF = 'uniform vec3 uCol; uniform vec3 uCol2; varying float vA;\n#include <fog_pars_fragment>\nvoid main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); a *= a * vA; if (a < 0.01) discard; gl_FragColor = vec4(mix(uCol2, uCol, smoothstep(0.45, 0.0, d)), a);\n#include <fog_fragment>\n}';
  function particles(B, list, n, add, c1, c2) {
    if (!list.length) return;
    const ex = []; list.forEach(s => { for (let i = 0; i < (s.k || 1); i++) ex.push(s); });
    const pos = new Float32Array(n * 3), sz = new Float32Array(n), al = new Float32Array(n), Pp = [];
    for (let i = 0; i < n; i++) Pp.push({ s: ex[i % ex.length], ph: B.rnd(), dx: B.rnd() - 0.5, dz: B.rnd() - 0.5, sp: 0.75 + B.rnd() * 0.5, w: B.rnd() * TAU });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(al, 1));
    const mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCol: { value: L(c1) }, uCol2: { value: L(c2) }, uScale: { value: 500 } }]), vertexShader: PV, fragmentShader: PF,
      transparent: true, depthWrite: false, fog: true, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = add ? 3 : 2; B.g.add(pts); B.disposables.push(geo, mat);
    const U = mat.uniforms;
    const upd = (dt, t) => {
      const R0 = BR.Arena && BR.Arena.renderer && BR.Arena.renderer(); if (R0) U.uScale.value = R0.domElement.height * 0.5;
      for (let i = 0; i < n; i++) {
        const p = Pp[i], s = p.s, life = s.life * p.sp, k = ((t / life) + p.ph) % 1, age = k * life, wob = s.wob ? s.wob * k : 0;
        pos[i * 3] = s.x + p.dx * s.w + (p.dx * s.spread + (s.wx || 0)) * age + Math.sin(t * 2.1 + p.w) * wob;
        pos[i * 3 + 1] = s.y + s.vy * age;
        pos[i * 3 + 2] = s.z + p.dz * s.w + p.dz * s.spread * age + Math.cos(t * 1.7 + p.w) * wob;
        sz[i] = s.s0 + (s.s1 - s.s0) * k; al[i] = s.a * Math.min(1, k * 6) * (1 - k);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true;
    };
    upd(0, 0); B.anims.push(upd);
  }
  const SMOKE = { w: 0.5, vy: 1.5, spread: 0.3, life: 7, s0: 1.4, s1: 5, a: 0.5, wx: 0.3 };
  const PLUME = { w: 6, vy: 2.6, spread: 1.4, life: 18, s0: 14, s1: 42, a: 0.55, wx: 1.2, k: 5 };
  const EMBER = { w: 1.4, vy: 2.0, spread: 0.2, life: 4, s0: 0.26, s1: 0.06, a: 1, wob: 0.8 };

  /* ---------------------------------------------------------------- pièces de décor */
  // fissures incandescentes dans le sol (bordure de la salle seulement)
  function crack(B, x, z, a, n, rMin) {
    for (let i = 0; i < n; i++) {
      const len = 0.6 + B.rnd() * 0.9; a += (B.rnd() - 0.5) * 1.1;
      const x1 = x + Math.sin(a) * len, z1 = z + Math.cos(a) * len;
      if (Math.hypot(x1, z1) < rMin) break;
      const ry = Math.atan2(x1 - x, z1 - z), mx = (x + x1) / 2, mz = (z + z1) / 2, w = 0.26 * (1 - i / n) + 0.09;
      B.add('dark', A.BOX, mx, 0.012, mz, ry, 0, 0, w * 3.2, 0.024, len + 0.1);
      B.add('glow', A.BOX, mx, 0.03, mz, ry, 0, 0, w, 0.02, len + 0.05);
      if (B.rnd() < 0.18 && i < n - 2) crack(B, x1, z1, a + (B.rnd() < 0.5 ? 0.9 : -0.9), Math.floor((n - i) / 2), rMin);
      x = x1; z = z1;
    }
  }
  function cracks(B, R, cnt, rMin) {
    for (let i = 0; i < cnt; i++) {
      const a = (i + B.rnd() * 0.7) / cnt * TAU; if (nearNS(a, 0.22)) continue;
      crack(B, Math.sin(a) * (R - 0.6), Math.cos(a) * (R - 0.6), a + PI + (B.rnd() - 0.5) * 0.6, 6 + Math.floor(B.rnd() * 5), rMin);
    }
  }
  // médaillon nain incrusté au centre (laiton, à plat : n'encombre pas le combat)
  function ringFlat(B, mat, r0, r1, y, seg) { const g = new THREE.RingGeometry(r0, r1, seg || 64); g.rotateX(-PI / 2); B.add(mat, g, 0, y, 0); g.dispose(); }
  function medallion(B, big) {
    const k = big ? 1 : 0.75;
    ringFlat(B, 'gold', 9.6 * k, 9.9 * k, 0.014); ringFlat(B, 'gold', 4.05 * k, 4.25 * k, 0.014, 6);
    const hexR = 7 * k;
    for (let i = 0; i < 6; i++) {
      const a0 = i / 6 * TAU + PI / 6, a1 = a0 + TAU / 6, x0 = Math.sin(a0) * hexR, z0 = Math.cos(a0) * hexR, x1 = Math.sin(a1) * hexR, z1 = Math.cos(a1) * hexR;
      B.add('gold', A.BOX, (x0 + x1) / 2, 0.016, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), 0, 0, 0.13, 0.02, hexR + 0.05);
    }
    if (big) ringFlat(B, 'gold', 25.9, 26.08, 0.014, 96);
  }
  // portail nain autour d'une porte (ry : la face décorée regarde vers +z local)
  function portal(B, x, z, ry) {
    if (!put(B, 'portail', x, 0, z, ry, 1)) for (const s of [-1, 1]) { const q = loc(x, z, ry, s * 5.2, 0); B.box('trim', q.x, 4.3, q.z, 1.8, 8.6, 2.2, ry); }
    for (const s of [-1, 1]) { const q = loc(x, z, ry, s * 5.2, 0); B.solid(q.x, q.z, 1.2, 1.4, ry, -3, 40); }
  }
  function statue(B, x, z, s, ry) {
    if (ry == null) ry = faceIn(x, z);
    if (!put(B, 'statue', x, 0, z, ry, s)) return;
    B.cyl(x, z, 1.1 * s, -3, 0.5 * s); B.cyl(x, z, 0.62 * s, -3, 40);
    B.obstacles.push({ x, z, r: 1.2 * s, h: 40 });
  }
  function brazier(B, x, z, s, light, y) {
    y = y || 0; s = s || 1;
    if (!put(B, 'brasero', x, y, z, B.rnd() * TAU, s)) A.brazier(B, x, z, light);
    B.flame(x, y + 2.05 * s, z, 1.45 * s, light);
    B.cyl(x, z, 0.62 * s, -3, y + 1.95 * s); B.obstacles.push({ x, z, r: 0.8 * s, h: 2 });
    src(B, 'ember', x, y + 2 * s, z, { w: 0.5, vy: 2.4, spread: 0.15, life: 2.2, s0: 0.2, s1: 0.05, a: 1, wob: 0.3 });
  }
  function cauldron(B, x, z, s) {
    const o = put(B, 'chaudron', x, 0, z, B.rnd() * TAU, s); if (!o) return;
    B.cyl(x, z, 1.25 * s, -3, 1.9 * s); B.obstacles.push({ x, z, r: 1.5 * s, h: 2 });
    const p = o.fx.fx_smoke || new V3(x, 2 * s, z);
    src(B, 'smoke', p.x, p.y, p.z, { w: 0.6 * s, vy: 1.2, spread: 0.25, life: 5, s0: 1.2 * s, s1: 3.6 * s, a: 0.32, wx: 0.2 });
    src(B, 'ember', p.x, p.y, p.z, { w: 0.9 * s, vy: 1.6, spread: 0.2, life: 2.6, s0: 0.2, s1: 0.05, a: 1, wob: 0.4, k: 2 });
    B.spot(x, 3.4 * s, z, B.P.glow, 1.1, { dist: 14, flick: true });
  }
  function anvil(B, x, z, s, ry) {
    if (ry == null) ry = faceIn(x, z) + PI / 2;
    const o = put(B, 'enclume', x, 0, z, ry, s); if (!o) { A.anvil(B, x, z); return; }
    B.cyl(x, z, 1.3 * s, -3, 2.35 * s); B.obstacles.push({ x, z, r: 1.6 * s, h: 2.4 * s });
    const p = o.fx.fx_spark; if (p) B.spot(p.x, p.y + 0.6, p.z, '#ff8a3a', 1.1, { dist: 10, flick: true });
  }
  // marteau-pilon animé (le pilon monte lentement, retombe d'un coup : gerbe d'étincelles)
  function pilon(B, x, z, ry, s) {
    const o = put(B, 'pilon', x, 0, z, ry, s); if (!o) return;
    for (const sx of [-1, 1]) { const q = loc(x, z, ry, sx * 2.0 * s, 0); B.solid(q.x, q.z, 0.7 * s, 0.95 * s, ry, -3, 40); }
    B.solid(x, z, 2.7 * s, 1.6 * s, ry, -3, 0.5 * s); B.solid(x, z, 0.95 * s, 0.85 * s, ry, -3, 1.75 * s);
    B.obstacles.push({ x, z, r: 3 * s, h: 9 });
    const sp = o.fx.fx_spark || new V3(x, 1.75 * s, z), st = o.fx.fx_smoke;
    let hit = -9;
    B.spot(sp.x, sp.y + 0.8, sp.z, '#ff9a4a', t => 1.2 + Math.max(0, 1 - (t - hit) * 2.5) * 3.5, { dist: 16 });
    if (st) src(B, 'smoke', st.x, st.y, st.z, { w: 0.4, vy: 2.2, spread: 0.35, life: 4, s0: 1, s1: 4.5, a: 0.4, wx: 0.3, k: 2 });
    const ram = o.dyn[0]; if (!ram) return;
    const ph = B.rnd() * 3, T = 2.8; let last = -1;
    B.anims.push((dt, t) => {
      const u = t + ph, k = (u % T) / T, cyc = Math.floor(u / T); let off;
      if (k < 0.6) { const e = k / 0.6; off = -0.37 + 1.95 * e * e * (3 - 2 * e); }
      else if (k < 0.9) off = 1.58 + Math.sin((k - 0.6) * 60) * 0.015;
      else { const e = (k - 0.9) / 0.1; off = 1.58 - 1.95 * e * e; }
      ram.obj.position.y = ram.y0 + off * s;
      if (cyc !== last) {
        if (last >= 0 && k < 0.3) {
          hit = t;
          const S = BR.Arena.session && BR.Arena.session();
          if (S && S.fx && S.me) { const gp = B.g.position, wx = sp.x + gp.x, wz = sp.z + gp.z; if (Math.hypot(S.me.pos.x - wx, S.me.pos.z - wz) < 50) S.fx.burst(new V3(wx, sp.y + 0.1, wz), { n: 26, color: 0xffb040, speed: 8, life: 0.7 }); }
        }
        last = cyc;
      }
    });
  }
  function orgue(B, name, x, z, s, solidR) {
    put(B, name, x, 0, z, B.rnd() * TAU, s);
    if (solidR) { B.cyl(x, z, solidR * s, -3, 40); B.obstacles.push({ x, z, r: solidR * s, h: 40 }); }
  }

  /* ---------------------------------------------------------------- bord de l'île : colonnes de basalte en 3 rangs */
  // rangée intérieure (solide, 0,5-1,3 m : on y monte), rangée extérieure (pied dans la lave), éboulis à demi noyés
  function rimRing(B, R, gapX) {
    const ring = (rr, step, fn) => { const n = Math.ceil(TAU * rr / step); for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU, x = Math.sin(a) * rr, z = Math.cos(a) * rr; if (Math.abs(x) < gapX && Math.abs(z) > R * 0.6) continue; fn(x, z, a); } };
    ring(R + 0.15, 1.45, (x, z) => { const t = B.rnd(); col(B, x, z, 0.8 + B.rnd() * 0.22, t < 0.12 ? 1.6 + B.rnd() * 0.5 : 0.5 + B.rnd() * 0.7, { solid: true }); });
    ring(R + 1.65, 1.7, (x, z) => { const t = B.rnd(); col(B, x, z, 0.95 + B.rnd() * 0.3, t < 0.16 ? 2.6 + B.rnd() * 3.2 : t < 0.5 ? -0.4 + B.rnd() * 0.6 : 0.5 + B.rnd() * 1.4, { solid: true }); });
    ring(R + 3.3, 2.4, (x, z) => { if (B.rnd() < 0.45) return; col(B, x, z, 1 + B.rnd() * 0.5, -1.0 + B.rnd() * 0.8, { y0: -4 }); });
  }
  // gradins de colonnes (praticables) dans l'anneau 27-33,5 m : on grimpe, marches ≤ 0,8 m
  function terrace(B, a, R) {
    const rows = [[27.9, 0.5, 2], [29.45, 1.15, 3], [31.0, 1.85, 3], [32.55, 2.6, 4]];
    rows.forEach(([rr, h, n], k) => {
      for (let j = 0; j < n; j++) {
        const off = (j - (n - 1) / 2) * 1.62 / rr, aa = a + off + (k % 2 ? 0.3 / rr : 0), x = Math.sin(aa) * rr, z = Math.cos(aa) * rr;
        col(B, x, z, 0.92, h + B.rnd() * 0.25, { solid: true });
      }
    });
    B.obstacles.push({ x: Math.sin(a) * 30.3, z: Math.cos(a) * 30.3, r: 3.8, h: 3 });
    void R;
  }

  // positions des pylônes le long d'une salle d'énigme (les braseros sont à z + 3,2)
  const rectZs = Lz => { const n = Math.max(2, Math.round(Lz / 16)), out = []; for (let i = 0; i < n; i++) out.push(-Lz / 2 + Lz * (i + 0.5) / n); return out; };

  /* ---------------------------------------------------------------- les salles */
  DG.THEMES.forge = {
    signWall: true,
    setup(B) {
      const P = B.P, heat = L(P.glow);
      B._fg = { src: { smoke: [], ember: [] }, ly: (B.room && B.room.fl % 2) ? -1.3 : -1.42 };
      B.mats.wall = heatify(std(P.stone, { roughness: 0.95 }), heat, 1.0);
      B.mats.far = heatify(std(P.stone, { roughness: 0.95 }), heat, 0.8);
      B.mats.btop = heatify(std(P.btop), heat, 0.8);
      B.mats.trim = heatify(std(P.trim, { roughness: 0.85 }), heat, 0.7);
      B.mats.statue = heatify(std(P.statue, { roughness: 0.85 }), heat, 0.7);
      B.mats.metal = std(P.metal, { roughness: 0.55, metalness: 0.35 });
      B.mats.gold = std('#b07a34', { roughness: 0.45, metalness: 0.5, emissive: L('#1e0e02') });
      B.mats.wood = std(P.wood);
      B.mats.dark = std('#120c0e', { roughness: 1 });
      B.mats.glow = new THREE.MeshStandardMaterial({ color: heat.clone().multiplyScalar(0.22), emissive: L(P.hot).lerp(heat, 0.82), emissiveIntensity: 1.35, roughness: 0.5, flatShading: true });
      B.mats.floor = new THREE.MeshStandardMaterial({ map: hexFloorTex(P), roughness: 0.52, metalness: 0.08 });
      const lt = lavaTex(P), ft = lavaFallTex(P);
      B.mats.lava = new THREE.MeshBasicMaterial({ map: lt, color: new THREE.Color(1.05, 1.05, 1.05), toneMapped: false });
      B.mats.lavafall = new THREE.MeshBasicMaterial({ map: ft, color: new THREE.Color(1.3, 1.3, 1.3), toneMapped: false });
      B.anims.push(() => { const t = performance.now() / 1000; lt.offset.set(t * 0.006, Math.sin(t * 0.13) * 0.02); ft.offset.set(0, t * 0.22); });
    },

    // grande salle de combat : île ronde, gradins de colonnes, enclume géante, marteau-pilon, statues des rois nains
    hall(B, room, rng, o, A2) {
      const R = A.ROOM_R + 0.9, boss = o && o.pillars === false;
      B.floorDisc(0, 0, R + 0.5);
      medallion(B, true);
      cracks(B, R, 16, 27.6);
      const ent = A.door(B, 0, -(R + 0.2), PI, { open: true }), exit = A.door(B, 0, R + 0.2, 0);
      portal(B, 0, R + 0.2, PI); portal(B, 0, -(R + 0.2), 0);
      rimRing(B, R, 6.9);
      for (const a of [0.95, -0.95, 2.25, -2.25]) terrace(B, a, R);
      // piliers de basalte (abris) — pas dans les salles de boss
      if (!boss) for (let i = 0; i < 4; i++) {
        const a = PI / 4 + i * PI / 2 + (rng() - 0.5) * 0.2, x = Math.sin(a) * 18, z = Math.cos(a) * 18;
        [[0, 0, 1.1, 6.8], [1.35, 0.55, 0.85, 4.4], [-1.1, 0.85, 0.8, 3.1], [0.15, -1.35, 0.82, 5.3]].forEach(([dx, dz, r, h]) => { const q = loc(x, z, a, dx, dz); col(B, q.x, q.z, r, h, { y0: -1 }); });
        B.cyl(x, z, 1.95, -2, 40); B.obstacles.push({ x, z, r: 2.2, h: 40 });
        crack(B, x + Math.sin(a) * 2, z + Math.cos(a) * 2, a, 3, 0);
      }
      // enclume géante (ouest), marteau-pilon sur son îlot (est)
      anvil(B, -30.2, 0, 1.75);
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, rr = (i % 2 ? 2.2 : 3.6), x = R + 4.6 + Math.sin(a) * rr, z = Math.cos(a) * rr * 1.25; col(B, x, z, 1.15, 0.15 + B.rnd() * 0.1, { solid: true }); }
      col(B, R + 4.6, 0, 1.15, 0.2, { solid: true });
      pilon(B, R + 4.8, 0, -PI / 2, 1.05);
      gear(B, R + 3.85, 6.0, -2.3, -PI / 2, 1.25, 0.6); gear(B, R + 3.85, 6.9, 2.4, -PI / 2, 0.85, -0.9);
      // chaudrons de métal en fusion, braseros, rois nains qui gardent la sortie
      for (const a of [2.72, -2.72]) cauldron(B, Math.sin(a) * 30, Math.cos(a) * 30, 1.25);
      for (const a of [0.5, -0.5, 1.32, -1.32, 1.84, -1.84]) brazier(B, Math.sin(a) * 32.2, Math.cos(a) * 32.2, 1.1, true);
      statue(B, 12.5, R + 5.2, 3.6); statue(B, -12.5, R + 5.2, 3.6);
      for (const s of [-1, 1]) brazier(B, s * 8.6, -(R - 1.6), 1.5, true);
      B._fg.R = R;
      return { R, entrance: ent, exits: [exit], spawn: { x: 0, z: -(R - 7.5), yaw: 0 }, rewardAt: new V3(0, 0, 0) };
    },

    // salle calme : l'atelier du forgeron (foyer, enclume, établi, râtelier, chaudron)
    chapel(B, room, rng) {
      const R = 17;
      B.floorDisc(0, 0, R + 0.5);
      medallion(B, false);
      cracks(B, R, 7, 12.5);
      const ent = A.door(B, 0, -(R + 0.2), PI, { open: true }), exit = A.door(B, 0, R + 0.2, 0, { w: 4.2 });
      portal(B, 0, R + 0.2, PI); portal(B, 0, -(R + 0.2), 0);
      rimRing(B, R, 6.9);
      // le foyer (nord-ouest) et son enclume
      { const a = -0.78, x = Math.sin(a) * 13.6, z = Math.cos(a) * 13.6, ry = faceIn(x, z);
        const o = put(B, 'forge', x, 0, z, ry, 1);
        if (o) {
          B.solid(x, z, 2.05, 1.45, ry, -3, 40); const qb = loc(x, z, ry, 2.75, 0.1); B.solid(qb.x, qb.z, 0.5, 0.9, ry, -3, 1.5);
          B.obstacles.push({ x, z, r: 2.6, h: 40 });
          const f = o.fx.fx_fire, sm = o.fx.fx_smoke;
          if (f) { B.flame(f.x, f.y - 0.1, f.z, 1.1, false); B.spot(f.x, f.y + 0.6, f.z, '#ff8a3a', 2.8, { dist: 18, flick: true }); src(B, 'ember', f.x, f.y, f.z, { w: 1.2, vy: 1.8, spread: 0.2, life: 2.2, s0: 0.18, s1: 0.05, a: 1, wob: 0.3, k: 2 }); }
          if (sm) src(B, 'smoke', sm.x, sm.y, sm.z, { w: 0.5, vy: 1.8, spread: 0.35, life: 8, s0: 1.4, s1: 6, a: 0.55, wx: 0.4, k: 4 });
          const qg = loc(x, z, ry, 0, -0.85); gear(B, qg.x, 6.4, qg.z, ry + PI, 0.62, 0.5);
        }
        anvil(B, Math.sin(-0.5) * 10.4, Math.cos(-0.5) * 10.4, 1.0);
      }
      { const a = 0.85, x = Math.sin(a) * 13.9, z = Math.cos(a) * 13.9; if (put(B, 'etabli', x, 0, z, faceIn(x, z), 1)) { B.cyl(x, z, 1.55, -3, 1.05); B.obstacles.push({ x, z, r: 1.7, h: 1.1 }); } }
      { const a = 1.5, x = Math.sin(a) * 15.2, z = Math.cos(a) * 15.2; if (put(B, 'ratelier', x, 0, z, faceIn(x, z), 1)) { B.solid(x, z, 1.3, 0.35, faceIn(x, z), -3, 2.2); } }
      cauldron(B, Math.sin(2.25) * 13.2, Math.cos(2.25) * 13.2, 0.95);
      for (const [a, k] of [[2.7, 0], [2.85, 1], [-2.62, 0], [-2.4, 2], [1.95, 1]]) {
        const x = Math.sin(a) * 14.8, z = Math.cos(a) * 14.8;
        if (k === 1) B.crate(x, z, 1 + B.rnd() * 0.3, B.rnd() * 3, true); else B.barrel(x, z, true);
      }
      for (const a of [-1.55, 2.45, -2.1]) brazier(B, Math.sin(a) * 14.6, Math.cos(a) * 14.6, 1, true);
      statue(B, 9.5, R + 4.6, 2.7); statue(B, -9.5, R + 4.6, 2.7);
      B._fg.R = R;
      return { R, entrance: ent, exits: [exit], spawn: { x: 0, z: -13, yaw: 0 }, rewardAt: new V3(0, 0, 0) };
    },

    // salle d'énigme : rebord de colonnes autour du rectangle, la lave dessous (rien d'autre sous la salle)
    rectShell(B, W, Lz, H, full) {
      const hx = W / 2, hz = Lz / 2;
      B._fg.rect = { hx, hz, full };
      const zb = rectZs(Lz).map(z => z + 3.2);
      const line = (x0, z0, x1, z1, step, fn) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / step)); for (let i = 0; i <= n; i++) fn(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n); };
      for (const s of [-1, 1]) {
        line(s * (hx + 0.25), -hz - 0.5, s * (hx + 0.25), hz + 0.5, 1.45, (x, z) => col(B, x, z, 0.8 + B.rnd() * 0.2, B.rnd() < 0.12 ? 1.6 + B.rnd() * 0.4 : 0.5 + B.rnd() * 0.7, { solid: true }));
        line(s * (hx + 1.8), -hz - 1.6, s * (hx + 1.8), hz + 1.6, 1.7, (x, z) => { if (zb.some(q => Math.abs(q - z) < 1.8)) return; const t = B.rnd(); col(B, x, z, 0.95 + B.rnd() * 0.3, t < 0.16 ? 2.6 + B.rnd() * 3 : t < 0.5 ? -0.4 + B.rnd() * 0.6 : 0.5 + B.rnd() * 1.3, { solid: true }); });
        line(s * (hx + 3.4), -hz - 2, s * (hx + 3.4), hz + 2, 2.4, (x, z) => { if (B.rnd() < 0.5) col(B, x, z, 1 + B.rnd() * 0.5, -1 + B.rnd() * 0.8, { y0: -4 }); });
        for (const sz of [-1, 1]) {
          line(s * 6.9, sz * (hz + 0.25), s * (hx + 0.25), sz * (hz + 0.25), 1.45, (x, z) => col(B, x, z, 0.8 + B.rnd() * 0.2, 0.5 + B.rnd() * 0.7, { solid: true }));
          line(s * 7.6, sz * (hz + 1.8), s * (hx + 1.8), sz * (hz + 1.8), 1.7, (x, z) => col(B, x, z, 0.95 + B.rnd() * 0.3, B.rnd() < 0.2 ? 2.4 + B.rnd() * 2.5 : -0.3 + B.rnd() * 1.5, { solid: true }));
        }
        orgue(B, 'orgue', s * (hx + 5), -hz - 3.2, 0.85 + B.rnd() * 0.2, 2.6);
      }
      portal(B, 0, hz, PI); portal(B, 0, -hz - 1.3, 0);
      // stèle de la consigne (le panneau est posé devant par l'énigme)
      B.box('trim', -7.5, 2.3, -hz + 0.42, 6.2, 4.6, 0.55, 0, true);
      B.add('gold', A.BOX, -7.5, 4.72, -hz + 0.42, 0, 0, 0, 6.5, 0.24, 0.7); B.add('gold', A.BOX, -7.5, 0.25, -hz + 0.42, 0, 0, 0, 6.5, 0.5, 0.7);
      for (const sx of [-11, -4]) col(B, sx, -hz + 0.42, 0.62, 5.4, { solid: true, y0: -2 });
      void H;
    },
    // décor des salles d'énigme : pylônes de basalte, chaînes géantes et braseros suspendus, engrenages, rois nains
    roomDecor(B, W, Lz) {
      const hx = W / 2, hz = Lz / 2, full = !B._fg.rect || B._fg.rect.full !== false;
      const zs = rectZs(Lz);
      zs.forEach((z, i) => {
        for (const s of [-1, 1]) {
          const x = s * (hx + 3.6);
          col(B, x, z, 1.15, 16 + B.rnd() * 2, { y0: -3 }); col(B, x + s * 1.3, z + 1.1, 0.85, 10.5 + B.rnd() * 2, { y0: -3 }); col(B, x + s * 0.9, z - 1.3, 0.8, 7.5 + B.rnd() * 2, { y0: -3 });
          B.cyl(x + s * 0.4, z, 2.0, -3, 40);
          if ((i + (s > 0 ? 1 : 0)) % 2 === 0) gear(B, x - s * 1.25, 8.5, z, s > 0 ? -PI / 2 : PI / 2, 1.2, 0.35 * s);
          col(B, s * (hx + 1.8), z + 3.2, 1.05, 0.6, { solid: true });
          brazier(B, s * (hx + 1.8), z + 3.2, 0.9, (i + (s > 0 ? 0 : 1)) % 2 === 0, 0.6);
        }
        // chaîne géante d'un pylône à l'autre, brasero suspendu au milieu
        const span = 2 * (hx + 3.6), N = Math.round(span / 1.0);
        for (let k = 0; k <= N; k++) { const u = k / N, x = -span / 2 + span * u, y = 15.2 - Math.sin(u * PI) * 2.6; B.add('metal', A.LINK, x, y, z, 0, k % 2 ? PI / 2 : 0, Math.cos(u * PI) * -0.45, 4.6, 4.6, 4.6); }
        const yb = 11.2; for (const dx of [-0.7, 0.7]) B.chain(dx, 12.55, z, 1.25);
        const bowl = new THREE.CylinderGeometry(1.1, 0.5, 0.7, 8); B.add('metal', bowl, 0, yb - 0.1, z); bowl.dispose();
        B.add('gold', A.BOX, 0, yb + 0.27, z, 0, 0, 0, 2.3, 0.12, 2.3);
        B.add('glow', A.BOX, 0, yb + 0.2, z, 0.5, 0, 0, 1.4, 0.15, 1.4);
        B.flame(0, yb + 0.75, z, 1.9, true);
        src(B, 'ember', 0, yb + 0.6, z, { w: 0.6, vy: 2.2, spread: 0.2, life: 2.5, s0: 0.22, s1: 0.05, a: 1, wob: 0.4 });
      });
      // rois nains qui encadrent la sortie (dehors, sur la lave)
      for (const s of [-1, 1]) statue(B, s * (hx + 5.2), hz + 2.4, 2.5);
      if (full) for (const [sx, sz] of [[-1, 1], [1, 1], [1, -1]]) { const x = sx * (hx - 1.2), z = sz * (hz - 2.2); B.barrel(x, z, true); B.barrel(x - sx * 1.1, z - sz * 0.3, true); B.crate(x, z - sz * 1.3, 1, 0.3, true); }
    },

    // le lointain : fossé de lave, plateaux de basalte coupés de rivières, cascades, fonderies, parois du cratère
    skyline(B, R, seed, A2, L0) {
      const ly = B._fg.ly, isRect = !!(L0 && L0.hx != null);
      const r0 = isRect ? Math.hypot(L0.hx, L0.hz) + 7 : R + 12;
      // la mer de lave
      { const g = new THREE.CircleGeometry(260, 72); g.rotateX(-PI / 2); B.add('lava', g, 0, ly, 0); g.dispose(); }
      B.spot(0, 0.5, R + 4, B.P.glow, 1.4, { dist: 26 }); B.spot(0, 0.5, -(R + 4), B.P.glow, 1.4, { dist: 26 });
      // braises qui montent du fossé
      for (let i = 0; i < 14; i++) { const a = (i + B.rnd()) / 14 * TAU, rr = (isRect ? r0 - 8 : R + 3) + B.rnd() * 7; src(B, 'ember', Math.sin(a) * rr, ly + 0.2, Math.cos(a) * rr, Object.assign({}, EMBER, { k: 2 })); }
      // plateaux (est et ouest seulement : le nord et le sud restent libres pour les salles voisines)
      let falls = 0, shops = 0;
      for (const side of [1, -1]) {
        let a = 0.84;
        while (a < PI - 0.84 - 0.12) {
          const a0 = a, a1 = Math.min(PI - 0.84, a + 0.3 + B.rnd() * 0.32); a = a1 + 0.06 + B.rnd() * 0.07;
          const h = [0.5, 1.3, 2.4, 3.6, 5.2][Math.floor(B.rnd() * 5)], rin = r0 + B.rnd() * 3, rout = r0 + 30 + B.rnd() * 10;
          const pts = [], ns = Math.max(4, Math.round((a1 - a0) / 0.05)), inner = [];
          for (let k = 0; k <= ns; k++) { const aa = side * (a0 + (a1 - a0) * k / ns), rr = rin + (B.rnd() - 0.5) * 3; pts.push([Math.sin(aa) * rr, Math.cos(aa) * rr]); inner.push([aa, rr]); }
          for (let k = ns; k >= 0; k--) { const aa = side * (a0 + (a1 - a0) * k / ns), rr = rout + (B.rnd() - 0.5) * 8; pts.push([Math.sin(aa) * rr, Math.cos(aa) * rr]); }
          const shp = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
          const ex = new THREE.ExtrudeGeometry(shp, { depth: h + 4, bevelEnabled: false }); ex.rotateX(-PI / 2); B.add('far', ex, 0, -4, 0); ex.dispose();
          const cap = new THREE.ShapeGeometry(shp); cap.rotateX(-PI / 2); B.add('btop', cap, 0, h + 0.02, 0); cap.dispose();
          // cascade de lave : un chenal sur le plateau qui se jette dans le fossé
          const am = side * (a0 + a1) / 2, withFall = h >= 2.2 && falls < (isRect ? 2 : 3) && B.rnd() < 0.75;
          if (withFall) {
            falls++;
            const rf = rin - 0.2, xf = Math.sin(am) * rf, zf = Math.cos(am) * rf, len = rout - rin - 4, rc = rin + len / 2;
            B.add('lava', A.BOX, Math.sin(am) * rc, h + 0.06, Math.cos(am) * rc, am, 0, 0, 3.2, 0.1, len);
            for (const s of [-1, 1]) { const q = loc(Math.sin(am) * rc, Math.cos(am) * rc, am, s * 1.9, 0); B.add('glow', A.BOX, q.x, h + 0.1, q.z, am, 0, 0, 0.35, 0.16, len); }
            B.add('lavafall', A.BOX, xf, (h + ly) / 2, zf, am, -0.08, 0, 3.4, h - ly + 0.2, 0.6);
            const xb = Math.sin(am) * (rf - 1.5), zb = Math.cos(am) * (rf - 1.5);
            B.spot(xb, 1.2, zb, B.P.glow, 2.4, { dist: 26, flick: true });
            src(B, 'smoke', xb, ly + 0.3, zb, { w: 1.6, vy: 1.6, spread: 0.5, life: 6, s0: 2, s1: 7, a: 0.35, wx: 0.3, k: 3 });
            src(B, 'ember', xb, ly + 0.3, zb, Object.assign({}, EMBER, { w: 2.2, vy: 3, k: 4 }));
            src(B, 'ember', xf, h, zf, Object.assign({}, EMBER, { w: 1.5, vy: 1.5, k: 1 }));
          }
          // bord du plateau : des colonnes de basalte (falaise hexagonale)
          inner.forEach(([aa, rr], k) => {
            if (k % 2) return;
            if (withFall && Math.abs(n2(aa - am)) * rr < 3.2) return;
            col(B, Math.sin(aa) * (rr - 0.4), Math.cos(aa) * (rr - 0.4), 1.1 + B.rnd() * 0.5, h + (B.rnd() - 0.35) * 2.2, { y0: -4, mat: 'far' });
            if (B.rnd() < 0.5) col(B, Math.sin(aa) * (rr - 2), Math.cos(aa) * (rr - 2), 0.9 + B.rnd() * 0.4, ly + 0.1 + B.rnd() * 1.4, { y0: -4, mat: 'far' });
          });
          for (const ae of [a0, a1]) for (let d = 1; d < 16; d += 2.6) { const aa = side * ae, rr = rin + d; col(B, Math.sin(aa) * rr, Math.cos(aa) * rr, 1 + B.rnd() * 0.4, h + (B.rnd() - 0.4) * 1.6, { y0: -4, mat: 'far' }); }
          // second gradin (plus haut, plus loin) bordé de colonnes, pour casser les grands aplats
          if (!withFall || B.rnd() < 0.5) {
            const b0 = a0 + 0.04, b1 = a1 - 0.04, r2 = rin + 11 + B.rnd() * 6, h2 = h + 1.8 + B.rnd() * 3.4, p2 = [], m2 = Math.max(3, Math.round((b1 - b0) / 0.05));
            if (b1 > b0 + 0.08) {
              for (let k = 0; k <= m2; k++) { const aa = side * (b0 + (b1 - b0) * k / m2), rr = r2 + (B.rnd() - 0.5) * 2.5; p2.push([Math.sin(aa) * rr, Math.cos(aa) * rr]); if (k % 2 === 0) col(B, Math.sin(aa) * (rr - 0.3), Math.cos(aa) * (rr - 0.3), 1 + B.rnd() * 0.4, h2 + (B.rnd() - 0.4) * 1.8, { y0: h - 0.5, mat: 'far' }); }
              for (let k = m2; k >= 0; k--) { const aa = side * (b0 + (b1 - b0) * k / m2), rr = rout - 1; p2.push([Math.sin(aa) * rr, Math.cos(aa) * rr]); }
              const s2 = new THREE.Shape(p2.map(p => new THREE.Vector2(p[0], -p[1])));
              const e2 = new THREE.ExtrudeGeometry(s2, { depth: h2 - h + 0.5, bevelEnabled: false }); e2.rotateX(-PI / 2); B.add('far', e2, 0, h - 0.5, 0); e2.dispose();
              const c2 = new THREE.ShapeGeometry(s2); c2.rotateX(-PI / 2); B.add('btop', c2, 0, h2 + 0.02, 0); c2.dispose();
            }
          }
          // fissures incandescentes et petits orgues sur le dessus
          for (let k = 0; k < 3; k++) { const aa = side * (a0 + (a1 - a0) * (0.15 + B.rnd() * 0.7)), rr = rin + 2 + B.rnd() * 7, x = Math.sin(aa) * rr, z = Math.cos(aa) * rr, ry = B.rnd() * PI; B.add('dark', A.BOX, x, h + 0.04, z, ry, 0, 0, 1.2, 0.06, 4 + B.rnd() * 4); B.add('glow', A.BOX, x, h + 0.08, z, ry, 0, 0, 0.35, 0.06, 3.6 + B.rnd() * 3); }
          for (let k = 0; k < 2; k++) { const aa = side * (a0 + (a1 - a0) * B.rnd()), rr = rin + 4 + B.rnd() * 6, x = Math.sin(aa) * rr, z = Math.cos(aa) * rr; for (let j = 0; j < 3; j++) col(B, x + (B.rnd() - 0.5) * 3, z + (B.rnd() - 0.5) * 3, 0.8 + B.rnd() * 0.4, h + 0.6 + B.rnd() * 3.5, { y0: h - 0.5, mat: 'far' }); }
          // fonderie naine (cheminée qui fume) ou orgue basaltique
          const ab = side * (a0 + (a1 - a0) * (0.3 + B.rnd() * 0.4)), rb = rin + 9 + B.rnd() * 9, xb = Math.sin(ab) * rb, zb = Math.cos(ab) * rb;
          if (shops < 4 && B.rnd() < 0.7) {
            shops++;
            const ry = ab + PI, w = 6 + B.rnd() * 3, d = 5 + B.rnd() * 2, hh = 4.5 + B.rnd() * 3;
            B.add('trim', A.BOX, xb, h + hh / 2, zb, ry, 0, 0, w, hh, d);
            B.add('gold', A.BOX, xb, h + hh - 0.4, zb, ry, 0, 0, w + 0.2, 0.3, d + 0.2);
            const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.75, 2.6, 4); B.add('metal', roof, xb, h + hh + 1.3, zb, ry + PI / 4); roof.dispose();
            const qd = loc(xb, zb, ry, 0, d / 2 + 0.05); B.add('glow', A.BOX, qd.x, h + 1.4, qd.z, ry, 0, 0, 2.0, 2.8, 0.1);
            for (const s of [-1, 1]) { const qw = loc(xb, zb, ry, s * w * 0.32, d / 2 + 0.05); B.add('glow', A.BOX, qw.x, h + hh * 0.62, qw.z, ry, 0, 0, 0.8, 1.1, 0.1); }
            const qc = loc(xb, zb, ry, w * 0.25, -d * 0.2), ch = hh + 6 + B.rnd() * 4;
            B.add('trim', A.BOX, qc.x, h + ch / 2, qc.z, ry, 0, 0, 1.5, ch, 1.5); B.add('metal', A.BOX, qc.x, h + ch, qc.z, ry, 0, 0, 1.9, 0.5, 1.9);
            src(B, 'smoke', qc.x, h + ch + 0.5, qc.z, { w: 0.6, vy: 2.2, spread: 0.6, life: 10, s0: 2.5, s1: 11, a: 0.55, wx: 0.6, k: 4 });
          } else orgue(B, B.rnd() < 0.5 ? 'orgue' : 'orgue_bas', xb, zb, 1.1 + B.rnd() * 0.8);
        }
      }
      // îlots et aiguilles dans le fossé (hors des bandes nord/sud)
      for (let i = 0; i < 10; i++) {
        const a = B.rnd() * TAU; if (nearNS(a, 0.8)) continue;
        const rr = (isRect ? r0 - 4 : R + 6) + B.rnd() * 4, x = Math.sin(a) * rr, z = Math.cos(a) * rr;
        if (B.rnd() < 0.4) orgue(B, 'orgue', x, z, 0.6 + B.rnd() * 0.4); else for (let k = 0; k < 4; k++) col(B, x + (B.rnd() - 0.5) * 3, z + (B.rnd() - 0.5) * 3, 0.9 + B.rnd() * 0.5, ly + 0.2 + B.rnd() * 2.2, { y0: -4 });
      }
      // parois du cratère (plus loin au nord et au sud), coulées de lave, panaches de fumée
      const nW = 70;
      for (let i = 0; i < nW; i++) {
        const a = (i + B.rnd() * 0.6) / nW * TAU, ns = nearNS(a, 0.8), rr = (ns ? 160 : 118) + B.rnd() * 22, h = (ns ? 70 : 48) + B.rnd() * 45, w = 20 + B.rnd() * 14;
        const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
        const c = new THREE.CylinderGeometry(w * (0.22 + B.rnd() * 0.15), w * 0.62, h, 5); B.add('far', c, x, h / 2 - 4, z, B.rnd() * TAU); c.dispose();
        if (B.rnd() < 0.35) { const c2 = new THREE.CylinderGeometry(w * 0.5, w * 0.9, h * 0.4, 6); B.add('far', c2, x * 0.94, h * 0.2 - 4, z * 0.94, B.rnd() * TAU); c2.dispose(); }
        if (i % 8 === 3) {
          const rf = rr - w * 0.42, xf = Math.sin(a) * rf, zf = Math.cos(a) * rf;
          void xf; void zf;
          src(B, 'smoke', xf, h * 0.85, zf, Object.assign({}, PLUME, { k: 3 }));
        }
        if (i % 8 === 7) src(B, 'smoke', x, h - 4, z, Object.assign({}, PLUME));
      }
    },

    finish(B) {
      const P = B.P, S = B._fg.src;
      particles(B, S.smoke, 170, false, P.smoke, new THREE.Color(P.smoke).multiplyScalar(0.55).getStyle());
      particles(B, S.ember, 260, true, P.hot, P.glow);
      if (P.id === 'forge2') B.flames.forEach(F => F.sp.material.color.copy(L('#b8c8ff')));
      // pas d'ombres portées pour la lave et le lointain (beaucoup de triangles, aucune utilité)
      const f0 = B.finish;
      B.finish = function () { f0(); B.g.children.forEach(m => { if (m.isMesh && (m.material === B.mats.far || m.material === B.mats.lava || m.material === B.mats.lavafall)) { m.castShadow = false; if (m.material !== B.mats.far) m.receiveShadow = false; } }); };
    },
  };
})();

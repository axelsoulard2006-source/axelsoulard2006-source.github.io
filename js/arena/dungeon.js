/* ===== arena/dungeon.js : les donjons de L'Ascension — chaque étage est une vraie salle fermée =====
   5 cartes de difficulté croissante (Grotte, Citadelle, Bastion des Cimes, Forge des Abysses, Néant).
   Un seul chemin : on entre par la porte sud, on ressort par la porte nord. La salle suivante est construite
   pendant qu'on termine la salle actuelle, raccordée par un couloir : on y entre à pied, sans chargement
   (le moteur « recentre » ensuite le monde sur la nouvelle salle : BR.Arena.swapRoom).
   - construction : murs, sols, piliers, torches, bannières… fusionnés par matériau (peu d'appels de dessin)
   - lumières : une réserve FIXE de lampes (DG.world) placées chaque image sur les sources les plus proches
     (torches, cristaux, braseros…) : le nombre de lumières ne change jamais → aucune recompilation (pas de saccade)
   - physique : sols à plusieurs hauteurs, gouffres, plateformes, murs (boîtes orientées et cylindres), salle voisine
   - énigmes : DG.PUZZLES (dungeon-puzzles*.js) ; questions : DG.QUIZ (dungeon-gmp.js) */
(function () {
  const BR = window.BR, V3 = THREE.Vector3;
  const DG = (BR.Dungeon = BR.Dungeon || {});
  const L = c => new THREE.Color(c).convertSRGBToLinear();
  DG.PUZZLES = DG.PUZZLES || {};
  DG.QUIZ = DG.QUIZ || {};

  /* =====================================================================
     LES CARTES (de la plus facile à la plus dure) et leurs ambiances (3 par carte, selon la profondeur)
     ===================================================================== */
  const MAPS = [
    { id: 'grotte', lvl: 1, n: 'La Grotte aux Cristaux', d: 'Des galeries humides où brillent des cristaux géants. Idéal pour débuter.', diff: 0.75, col: '#5ad1ff', style: 'rock', floor: 'dirt', cave: true, shell: 'cave', exp: 1.35,
      tiers: [
        { n: 'Les Galeries', stone: '#7a7468', mortar: '#2a2620', floor: '#6a5e4c', trim: '#a69e90', wood: '#5a3c22', metal: '#3a3a40', accent: '#7ad8ff', banner: '#2a5a7a', moss: 0.7, glow: '#5ad1ff', sky: ['#020304', '#05070a', '#0a0d12'], fog: ['#0a0e14', 0.011], hemi: ['#6a8aaa', '#2a2014', 1.05], moon: ['#9adfff', 0.35] },
        { n: 'Le Lac souterrain', stone: '#6a6e78', mortar: '#1e2028', floor: '#545c66', trim: '#9aa2ae', wood: '#4a3420', metal: '#3a3a44', accent: '#a58aff', banner: '#3a2a7a', moss: 0.5, glow: '#a58aff', sky: ['#020204', '#06060c', '#0c0c18'], fog: ['#0c0c20', 0.011], hemi: ['#7a7ab8', '#1e1824', 1.0], moon: ['#c0b0ff', 0.35] },
        { n: 'Le Cœur de cristal', stone: '#6a5a6e', mortar: '#1c141e', floor: '#4e4052', trim: '#a890ae', wood: '#4a2a30', metal: '#3a3040', accent: '#ff8ad8', banner: '#7a2a5a', moss: 0.3, glow: '#ff7ad0', sky: ['#040204', '#0c060c', '#180c18'], fog: ['#160a16', 0.011], hemi: ['#a87aa8', '#24161f', 1.0], moon: ['#ffb8e8', 0.35] },
      ] },
    { id: 'citadelle', lvl: 2, n: 'La Citadelle', d: 'Cachots, remparts et salle du trône d\'une forteresse oubliée.', diff: 1, col: '#ffb35a', style: 'brick', floor: 'flags', stars: true, shell: 'walls', exp: 1.15,
      tiers: [
        { n: 'Les Cachots', stone: '#8a877c', mortar: '#34322d', floor: '#76716a', trim: '#e8e0d2', wood: '#6b4a2e', metal: '#3a3a40', accent: '#ffa24a', banner: '#8a2020', moss: 0.55, sky: ['#05070d', '#0f1424', '#1d2238'], fog: ['#0b0d14', 0.011], hemi: ['#5a6a9a', '#2a2418', 0.62], moon: ['#9fb2ff', 0.85] },
        { n: 'Les Remparts', stone: '#a8987f', mortar: '#3e352a', floor: '#8c7d69', trim: '#efe4d0', wood: '#5e4026', metal: '#40424a', accent: '#ffb35a', banner: '#24529e', moss: 0.25, sky: ['#050816', '#14204a', '#30406e'], fog: ['#0d1226', 0.009], hemi: ['#6a7ab0', '#2c2418', 0.7], moon: ['#b8c6ff', 1.0] },
        { n: 'La Salle du Trône', stone: '#6a6470', mortar: '#1e1a22', floor: '#4a4450', trim: '#d4cade', wood: '#4a2e22', metal: '#2e2a34', accent: '#c58aff', banner: '#5a1f86', moss: 0, sky: ['#06030c', '#1a0e30', '#3a1a4a'], fog: ['#0c0814', 0.012], hemi: ['#7a5aa8', '#20141e', 0.62], moon: ['#d8b8ff', 0.8] },
      ] },
    { id: 'montagne', lvl: 3, n: 'Le Bastion des Cimes', d: 'Une forteresse accrochée à la montagne, battue par la neige et le vent.', diff: 1.35, col: '#cfe8ff', style: 'brick', floor: 'snow', snow: true, shell: 'cliff', exp: 1.0,
      tiers: [
        { n: 'Le Col', stone: '#a4a4aa', mortar: '#3a3c44', floor: '#9aa0ac', trim: '#dfe4ec', wood: '#5a3e28', metal: '#40444c', accent: '#ffb35a', banner: '#2a6a4a', moss: 0, sky: ['#1c2c4c', '#5a7aa8', '#c8d8ea'], fog: ['#7a8aa8', 0.011], hemi: ['#bcd0f0', '#3a3a44', 0.55], moon: ['#ffe2c0', 0.72] },
        { n: 'Les Glaciers', stone: '#9aa4b4', mortar: '#2a3240', floor: '#aab6c8', trim: '#eef4fc', wood: '#4a3424', metal: '#3a4250', accent: '#9adfff', banner: '#1a4a7a', moss: 0, stars: true, sky: ['#0a1430', '#26406e', '#7a9ac8'], fog: ['#3a4a6a', 0.012], hemi: ['#9ab4e0', '#2a2c38', 0.55], moon: ['#cfe0ff', 0.7] },
        { n: 'Le Pic', stone: '#8a8e9a', mortar: '#22262e', floor: '#9aa0ae', trim: '#e4e8f0', wood: '#3a2a20', metal: '#30343c', accent: '#ffd76a', banner: '#5a1a1a', moss: 0, sky: ['#0a0c18', '#1a2236', '#3a4458'], fog: ['#2a3040', 0.015], hemi: ['#7a8ab0', '#1a1c24', 0.5], moon: ['#b0c0ff', 0.6] },
      ] },
    { id: 'forge', lvl: 4, n: 'La Forge des Abysses', d: 'Basalte, lave et enclumes géantes, au cœur d\'un volcan. Ça chauffe.', diff: 1.75, col: '#ff7a2a', style: 'basalt', floor: 'obsidian', lava: true, shell: 'lava', exp: 1.05,
      tiers: [
        { n: 'Les Fonderies', stone: '#4a3e40', mortar: '#120c0c', floor: '#342a2c', trim: '#8a7a74', wood: '#3a2418', metal: '#2a2428', accent: '#ff7a2a', banner: '#8a2a10', moss: 0, glow: '#ff6a1a', sky: ['#1a0604', '#4a1408', '#a83a10'], fog: ['#2a0e08', 0.012], hemi: ['#ff9a5a', '#1a0a06', 0.6], moon: ['#ffa06a', 0.85] },
        { n: 'Le Fleuve de lave', stone: '#3e3234', mortar: '#0e0808', floor: '#2c2224', trim: '#7a6a64', wood: '#2e1c14', metal: '#262024', accent: '#ff5a1a', banner: '#6a1a08', moss: 0, glow: '#ff4a10', sky: ['#140402', '#3a0e06', '#8a2a08'], fog: ['#240a06', 0.013], hemi: ['#ff7a4a', '#14080a', 0.58], moon: ['#ff8a5a', 0.8] },
        { n: 'Le Cœur du volcan', stone: '#36282e', mortar: '#0c0608', floor: '#281c22', trim: '#7a6070', wood: '#2a1418', metal: '#241c22', accent: '#ff3a4a', banner: '#5a0a2a', moss: 0, glow: '#ff2a3a', sky: ['#120206', '#360812', '#7a1a20'], fog: ['#200810', 0.014], hemi: ['#ff6a6a', '#140810', 0.56], moon: ['#ff7a8a', 0.75] },
      ] },
    { id: 'neant', lvl: 5, n: 'Le Néant', d: 'Là où la réalité s\'effrite. Seuls les meilleurs en reviennent.', diff: 2.2, col: '#c58aff', style: 'crystal', floor: 'void', voidm: true, stars: true, shell: 'void', exp: 1.15,
      tiers: [
        { n: 'La Brèche', stone: '#4a3c5e', mortar: '#0c0812', floor: '#2c2238', trim: '#a08ac8', wood: '#2a1a3a', metal: '#2a2436', accent: '#c58aff', banner: '#4a1a7a', moss: 0, glow: '#b06bff', sky: ['#05020a', '#1a0a30', '#3a1a5a'], fog: ['#0c0618', 0.011], hemi: ['#9a6aff', '#120a1a', 0.62], moon: ['#d8b8ff', 0.85] },
        { n: 'Les Ruines flottantes', stone: '#3c3a5e', mortar: '#08081a', floor: '#242440', trim: '#8a8ad8', wood: '#1a1a3a', metal: '#22243a', accent: '#7a9aff', banner: '#1a2a7a', moss: 0, glow: '#6a8aff', sky: ['#02030a', '#0a1030', '#1a2a5a'], fog: ['#060a1a', 0.011], hemi: ['#6a8aff', '#0a0a1a', 0.62], moon: ['#b8c8ff', 0.85] },
        { n: 'Le Trône du Néant', stone: '#2e2236', mortar: '#060208', floor: '#1c1424', trim: '#7a5a8a', wood: '#1a0e22', metal: '#1e1626', accent: '#ff5ad8', banner: '#5a0a4a', moss: 0, glow: '#ff3ad0', sky: ['#020004', '#14041a', '#2a0a30'], fog: ['#0a020e', 0.012], hemi: ['#c05aff', '#0a040e', 0.6], moon: ['#ffa8f0', 0.8] },
      ] },
  ];
  DG.MAPS = MAPS;
  DG.mapOf = id => MAPS.find(m => m.id === id) || MAPS[1];
  const tierOf = fl => fl >= 11 ? 2 : fl >= 6 ? 1 : 0;
  DG.palOf = function (fl, mapId) { const M = DG.mapOf(mapId), P = M.tiers[tierOf(fl || 1)]; return Object.assign({ map: M, id: M.id + tierOf(fl || 1) }, P); };
  DG.tierName = (fl, mapId) => DG.palOf(fl, mapId).n;

  /* =====================================================================
     TEXTURES (dessinées une fois, gardées entre les salles)
     ===================================================================== */
  const texCache = {};
  function cv(n, draw, h) { const c = document.createElement('canvas'); c.width = n; c.height = h || n; draw(c.getContext('2d'), n, h || n); return c; }
  function rnd(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function mkTex(c, lin) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (!lin) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
  function shade(g, n, r, k) { const im = g.getImageData(0, 0, n, n), d = im.data; for (let i = 0; i < d.length; i += 4) { const v = (r() - 0.5) * k; d[i] += v; d[i + 1] += v; d[i + 2] += v; } g.putImageData(im, 0, 0); }
  const hex = c => '#' + c.getHexString();
  // briques de pierre (Citadelle, Bastion)
  function bricks(P, snow) {
    const key = 'b' + P.id; if (texCache[key]) return texCache[key];
    const r = rnd(91), c = cv(512, (g, n) => {
      g.fillStyle = P.mortar; g.fillRect(0, 0, n, n);
      const rows = 8, h = n / rows, base = new THREE.Color(P.stone);
      for (let y = 0; y < rows; y++) {
        const w0 = n / 4, off = (y % 2) * w0 / 2; let x = -off;
        while (x < n) {
          const w = w0 * (0.75 + r() * 0.5), cc = base.clone().multiplyScalar(0.82 + r() * 0.3); cc.offsetHSL((r() - 0.5) * 0.02, 0, 0);
          g.fillStyle = hex(cc); const pad = 3;
          g.beginPath(); if (g.roundRect) g.roundRect(x + pad, y * h + pad, w - pad * 2, h - pad * 2, 5); else g.rect(x + pad, y * h + pad, w - pad * 2, h - pad * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + pad, y * h + pad, w - pad * 2, 4);
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + pad, y * h + h - pad - 5, w - pad * 2, 5);
          if (r() < 0.25) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.beginPath(); let px = x + w * r(), py = y * h + pad; g.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 18; py += h / 5; g.lineTo(px, py); } g.stroke(); }
          if (snow && r() < 0.5) { g.fillStyle = 'rgba(245,250,255,0.75)'; g.fillRect(x + pad, y * h + pad, w - pad * 2, 3 + r() * 5); }
          x += w;
        }
      }
      shade(g, n, r, 26);
      if (P.moss > 0) { for (let i = 0; i < 260 * P.moss; i++) { const x = r() * n, y = n * (0.72 + r() * 0.28); g.fillStyle = `rgba(${60 + r() * 40},${90 + r() * 50},${40 + r() * 20},${0.25 + r() * 0.35})`; g.beginPath(); g.arc(x, y, 3 + r() * 9, 0, 7); g.fill(); } }
    });
    return (texCache[key] = mkTex(c));
  }
  // roche brute (Grotte) : gros blocs arrondis, fissures, mousse et petits cristaux
  function rock(P) {
    const key = 'r' + P.id; if (texCache[key]) return texCache[key];
    const r = rnd(13), c = cv(512, (g, n) => {
      g.fillStyle = P.mortar; g.fillRect(0, 0, n, n);
      const base = new THREE.Color(P.stone);
      for (let i = 0; i < 70; i++) {
        const x = r() * n, y = r() * n, rx = 30 + r() * 60, ry = 20 + r() * 40, cc = base.clone().multiplyScalar(0.7 + r() * 0.4);
        for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) { g.fillStyle = hex(cc); g.beginPath(); g.ellipse(x + dx, y + dy, rx, ry, r() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.ellipse(x + dx - rx * 0.2, y + dy - ry * 0.3, rx * 0.6, ry * 0.4, 0, 0, 7); g.fill(); }
      }
      shade(g, n, r, 30);
      for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.beginPath(); let px = r() * n, py = r() * n; g.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 40; py += (r() - 0.5) * 40; g.lineTo(px, py); } g.stroke(); }
      if (P.moss > 0) for (let i = 0; i < 300 * P.moss; i++) { g.fillStyle = `rgba(${50 + r() * 40},${90 + r() * 60},${50 + r() * 30},${0.2 + r() * 0.35})`; g.beginPath(); g.arc(r() * n, n * (0.6 + r() * 0.4), 3 + r() * 10, 0, 7); g.fill(); }
    });
    return (texCache[key] = mkTex(c));
  }
  // lueurs (cristaux, lave, runes) : texture d'émission (linéaire), noire sauf les veines
  function glowMap(P, kind) {
    const key = 'gl' + kind + P.id; if (texCache[key]) return texCache[key];
    const r = rnd(kind.length * 7 + 3), c = cv(512, (g, n) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
      g.lineCap = 'round';
      if (kind === 'lava' || kind === 'lavafloor') {
        for (let i = 0; i < (kind === 'lava' ? 9 : 14); i++) { let x = r() * n, y = r() * n; g.lineWidth = 2 + r() * 4; g.strokeStyle = `rgba(255,${140 + r() * 80},60,${0.7 + r() * 0.3})`; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 70; y += (kind === 'lava' ? 20 + r() * 30 : (r() - 0.5) * 70); g.lineTo(x, y); } g.stroke(); }
      } else if (kind === 'crystal') {
        for (let i = 0; i < 26; i++) { const x = r() * n, y = r() * n, h = 10 + r() * 30; g.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * 0.3, y); g.lineTo(x, y + h * 0.4); g.lineTo(x - h * 0.3, y); g.fill(); }
      } else if (kind === 'rune') {
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
        for (let i = 0; i < 6; i++) { const x = 40 + r() * (n - 80), y = 40 + r() * (n - 80), s = 14 + r() * 16; g.beginPath(); g.arc(x, y, s, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x - s * 0.6, y); g.lineTo(x + s * 0.6, y); g.moveTo(x, y - s * 0.6); g.lineTo(x, y + s * 0.6); g.stroke(); }
        for (let i = 0; i < 10; i++) { let x = r() * n, y = r() * n; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
      }
    });
    return (texCache[key] = mkTex(c, true));
  }
  // basalte (Forge) : colonnes hexagonales sombres
  function basalt(P) {
    const key = 'ba' + P.id; if (texCache[key]) return texCache[key];
    const r = rnd(29), c = cv(512, (g, n) => {
      g.fillStyle = P.mortar; g.fillRect(0, 0, n, n);
      const base = new THREE.Color(P.stone), cols = 8, w = n / cols;
      for (let i = 0; i < cols; i++) { let y = -r() * 60; while (y < n) { const h = 50 + r() * 90, cc = base.clone().multiplyScalar(0.75 + r() * 0.4); g.fillStyle = hex(cc); g.fillRect(i * w + 3, y + 3, w - 6, h - 6); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(i * w + 3, y + 3, 5, h - 6); y += h; } }
      shade(g, n, r, 24);
    });
    return (texCache[key] = mkTex(c));
  }
  // cristal noir (Néant) : facettes sombres, veines claires
  function crystalWall(P) {
    const key = 'cw' + P.id; if (texCache[key]) return texCache[key];
    const r = rnd(41), c = cv(512, (g, n) => {
      g.fillStyle = P.mortar; g.fillRect(0, 0, n, n);
      const base = new THREE.Color(P.stone);
      for (let i = 0; i < 90; i++) { const x = r() * n, y = r() * n, s = 20 + r() * 60, cc = base.clone().multiplyScalar(0.6 + r() * 0.6); g.fillStyle = hex(cc); g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.5, y - s * 0.1); g.lineTo(x + s * 0.2, y + s * 0.6); g.lineTo(x - s * 0.45, y + s * 0.3); g.closePath(); g.fill(); }
      shade(g, n, r, 20);
    });
    return (texCache[key] = mkTex(c));
  }
  // sols : dalles (Citadelle), terre et cailloux (Grotte), dalles enneigées, obsidienne, néant
  function flags(P, style) {
    const key = 'f' + (style || '') + P.id; if (texCache[key]) return texCache[key];
    const r = rnd(37), c = cv(512, (g, n) => {
      g.fillStyle = P.mortar; g.fillRect(0, 0, n, n);
      const base = new THREE.Color(P.floor);
      if (style === 'dirt') {
        g.fillStyle = P.floor; g.fillRect(0, 0, n, n);
        for (let i = 0; i < 900; i++) { const cc = base.clone().multiplyScalar(0.7 + r() * 0.5); g.fillStyle = hex(cc); g.beginPath(); g.arc(r() * n, r() * n, 2 + r() * 9, 0, 7); g.fill(); }
        for (let i = 0; i < 60; i++) { const cc = base.clone().multiplyScalar(1.1 + r() * 0.3); g.fillStyle = hex(cc); g.beginPath(); g.ellipse(r() * n, r() * n, 6 + r() * 14, 4 + r() * 8, r() * 3, 0, 7); g.fill(); }
      } else {
        const N = 4, s = n / N;
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
          const cc = base.clone().multiplyScalar(0.8 + r() * 0.34); g.fillStyle = hex(cc);
          const pad = 3 + r() * 2; g.beginPath(); if (g.roundRect) g.roundRect(i * s + pad, j * s + pad, s - pad * 2, s - pad * 2, 7); else g.rect(i * s + pad, j * s + pad, s - pad * 2, s - pad * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(i * s + pad + 4, j * s + pad + 4, s - pad * 2 - 8, 3);
          if (r() < 0.3) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(i * s + s * r(), j * s + pad); g.lineTo(i * s + s * r(), j * s + s - pad); g.stroke(); }
        }
        if (style === 'snow') for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(240,246,255,${0.25 + r() * 0.35})`; g.beginPath(); g.ellipse(r() * n, r() * n, 10 + r() * 40, 6 + r() * 18, r() * 3, 0, 7); g.fill(); }
      }
      shade(g, n, r, 22);
      if (P.moss > 0) for (let i = 0; i < 120 * P.moss; i++) { g.fillStyle = `rgba(70,100,50,${0.15 + r() * 0.25})`; g.fillRect(Math.floor(r() * 4) * n / 4, r() * n, 4, 6 + r() * 14); }
    });
    return (texCache[key] = mkTex(c));
  }
  function planks(P) {
    const key = 'w' + P.id; if (texCache[key]) return texCache[key];
    const r = rnd(5), c = cv(256, (g, n) => {
      const base = new THREE.Color(P.wood);
      for (let i = 0; i < 4; i++) { const cc = base.clone().multiplyScalar(0.8 + r() * 0.35); g.fillStyle = hex(cc); g.fillRect(0, i * n / 4, n, n / 4 - 3); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, i * n / 4 + n / 4 - 3, n, 3);
        for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); const y = i * n / 4 + r() * n / 4; g.moveTo(0, y); g.bezierCurveTo(n / 3, y + 3, n * 2 / 3, y - 3, n, y); g.stroke(); } }
      shade(g, n, r, 18);
    });
    return (texCache[key] = mkTex(c));
  }
  function bannerTex(col) {
    const key = 'n' + col; if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 2, 256);
    g.fillStyle = '#d8b04a'; g.fillRect(0, 0, 128, 10); g.fillRect(10, 0, 6, 236); g.fillRect(112, 0, 6, 236);
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, 256); g.lineTo(64, 214); g.lineTo(128, 256); g.fill(); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#d8b04a'; g.beginPath(); g.moveTo(64, 60); g.lineTo(98, 74); g.lineTo(94, 118); g.quadraticCurveTo(84, 146, 64, 158); g.quadraticCurveTo(44, 146, 34, 118); g.lineTo(30, 74); g.closePath(); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(64, 70); g.lineTo(88, 80); g.lineTo(85, 116); g.quadraticCurveTo(78, 138, 64, 147); g.quadraticCurveTo(50, 138, 43, 116); g.lineTo(40, 80); g.closePath(); g.fill();
    g.fillStyle = '#e8c868'; g.fillRect(61, 76, 6, 64); g.fillRect(50, 92, 28, 6); g.beginPath(); g.arc(64, 74, 5, 0, 7); g.fill();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    return (texCache[key] = t);
  }
  function flameTex() {
    if (texCache.flame) return texCache.flame;
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 92, 2, 32, 80, 50); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,0.95)'); gr.addColorStop(0.6, 'rgba(255,110,30,0.5)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(54, 50, 60, 84, 32, 124); g.bezierCurveTo(4, 84, 10, 50, 32, 4); g.fill();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    return (texCache.flame = t);
  }
  DG.flameTex = flameTex;
  DG.textTex = function (lines, o) {
    o = o || {}; const W = o.w || 1024, H = o.h || 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    if (o.bg !== false) {
      g.fillStyle = o.bg || '#2a2520'; g.fillRect(0, 0, W, H);
      g.strokeStyle = o.border || '#c9a24a'; g.lineWidth = 14; g.strokeRect(14, 14, W - 28, H - 28);
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 3; g.strokeRect(34, 34, W - 68, H - 68);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const total = lines.reduce((s, l) => s + (l.s || 48) * 1.25, 0); let y = H / 2 - total / 2;
    lines.forEach(l => {
      const s = l.s || 48; g.font = `${l.b === false ? 600 : 800} ${s}px Inter, Arial, sans-serif`; g.fillStyle = l.c || '#f3e6c4';
      const words = String(l.t).split(' '), out = []; let cur = '';
      words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > W - 110 && cur) { out.push(cur); cur = w; } else cur = t; }); if (cur) out.push(cur);
      out.forEach((t, k) => { g.fillText(t, W / 2, y + s * 0.62 + k * s * 1.12); }); y += s * 1.25 + (out.length - 1) * s * 1.12;
    });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  };

  /* =====================================================================
     CONSTRUCTION
     ===================================================================== */
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();
  function Builder(scene, P, quality) {
    const M = P.map, g = new THREE.Group(); scene.add(g);
    const wallMap = M.style === 'rock' ? rock(P) : M.style === 'basalt' ? basalt(P) : M.style === 'crystal' ? crystalWall(P) : bricks(P, M.snow);
    const wallGlow = M.style === 'basalt' ? glowMap(P, 'lava') : M.style === 'crystal' ? glowMap(P, 'crystal') : null;
    const floorGlow = M.floor === 'obsidian' ? glowMap(P, 'lavafloor') : M.floor === 'void' ? glowMap(P, 'rune') : null;
    const gcol = L(P.glow || P.accent);
    const mats = {
      wall: new THREE.MeshStandardMaterial(Object.assign({ map: wallMap, roughness: M.style === 'crystal' ? 0.5 : 0.92, metalness: M.style === 'crystal' ? 0.2 : 0 }, wallGlow ? { emissive: gcol.clone(), emissiveMap: wallGlow, emissiveIntensity: 1.4 } : {})),
      floor: new THREE.MeshStandardMaterial(Object.assign({ map: flags(P, M.floor), roughness: M.floor === 'obsidian' || M.floor === 'void' ? 0.45 : 0.85, metalness: 0.02 }, floorGlow ? { emissive: gcol.clone(), emissiveMap: floorGlow, emissiveIntensity: 1.2 } : {})),
      trim: new THREE.MeshStandardMaterial({ map: M.style === 'rock' ? rock(P) : flags(P), color: L(P.trim), roughness: 0.8 }),
      wood: new THREE.MeshStandardMaterial({ map: planks(P), roughness: 0.8 }),
      metal: new THREE.MeshStandardMaterial({ color: L(P.metal), roughness: 0.45, metalness: 0.75 }),
      gold: new THREE.MeshStandardMaterial({ color: L('#c9a24a'), roughness: 0.35, metalness: 0.9, emissive: L('#3a2a08') }),
      dark: new THREE.MeshStandardMaterial({ color: L('#050608'), roughness: 1 }),
      glow: new THREE.MeshStandardMaterial({ color: gcol.clone().multiplyScalar(0.5), emissive: gcol.clone(), emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.1 }),
      snow: new THREE.MeshStandardMaterial({ color: L('#f4f8ff'), roughness: 0.95 }),
    };
    const tile = { wall: 4, floor: 6, trim: 3, wood: 2, metal: 1, gold: 1, dark: 4, glow: 2, snow: 3 };
    const parts = {};
    const B = {
      g, P, M, mats, quality, solids: [], floors: [], obstacles: [], spots: [], flames: [], anims: [], doors: [], banners: [], disposables: [],
      add(mat, geo, x, y, z, ry, rx, rz, sx, sy, sz) {
        _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _s.set(sx || 1, sy || 1, sz || 1); _p.set(x, y, z);
        _m4.compose(_p, _q, _s);
        const gg = (geo.index ? geo.toNonIndexed() : geo.clone()); gg.applyMatrix4(_m4);
        (parts[mat] = parts[mat] || []).push(gg);
        return gg;
      },
      box(mat, x, y, z, w, h, d, ry, solid) {
        B.add(mat, BOX, x, y, z, ry || 0, 0, 0, w, h, d);
        if (solid) return B.solid(x, z, w / 2, d / 2, ry || 0, y - h / 2, y + h / 2);
        return null;
      },
      solid(x, z, hx, hz, ry, y0, y1, o) { const s = Object.assign({ t: 'b', x, z, hx, hz, ry: ry || 0, c: Math.cos(ry || 0), s: Math.sin(ry || 0), y0, y1, off: false }, o || {}); B.solids.push(s); return s; },
      cyl(x, z, r, y0, y1, o) { const s = Object.assign({ t: 'c', x, z, r, y0, y1, off: false }, o || {}); B.solids.push(s); return s; },
      floorRect(x0, z0, x1, z1, o) { B.floors.push({ t: 'r', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) }); if (!(o && o.hide)) B.box('floor', (x0 + x1) / 2, -0.5, (z0 + z1) / 2, Math.abs(x1 - x0), 1, Math.abs(z1 - z0)); },
      floorDisc(x, z, r) { B.floors.push({ t: 'd', x, z, r }); const geo = new THREE.CylinderGeometry(r, r, 1, 48); B.add('floor', geo, x, -0.5, z); geo.dispose(); },
      /** mur droit (épaisseur t, hauteur h) : créneaux en ville, roche bosselée en grotte, neige au sommet en montagne */
      wall(x0, z0, x1, z1, h, t, o) {
        o = o || {}; t = t || 1.2; const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); if (len < 0.05) return;
        const ry = Math.atan2(dx, dz), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ux = dx / len, uz = dz / len;
        B.add('wall', BOX, cx, h / 2, cz, ry, 0, 0, t, h, len + t);
        B.solid(cx, cz, t / 2, len / 2 + t / 2, ry, -2, h + 30);
        if (M.style === 'rock') {
          // gros rochers collés au mur (côté salle et côté extérieur) : silhouette naturelle
          const n = Math.max(1, Math.floor(len / 2.6));
          for (let i = 0; i < n; i++) { const k = (i + 0.5) / n - 0.5, s = 1 + rndB() * 1.4, y = rndB() * h; B.add('wall', ROCK, cx + ux * k * len, y, cz + uz * k * len, rndB() * 6, rndB() * 6, 0, s * 1.2, s, s * 1.1); }
          B.add('wall', ROCK, cx, h, cz, ry, 0.3, 0, t * 1.4, 1.6, len * 0.8);
        } else if (o.cren !== false) {
          B.add('trim', BOX, cx, h + 0.15, cz, ry, 0, 0, t + 0.5, 0.3, len + t + 0.2);
          const n = Math.max(1, Math.floor(len / 2.2));
          for (let i = 0; i < n; i++) { const k = (i + 0.5) / n - 0.5; B.add('wall', BOX, cx + ux * k * len, h + 0.85, cz + uz * k * len, ry, 0, 0, t + 0.1, 1.1, 1.1); if (M.snow) B.add('snow', BOX, cx + ux * k * len, h + 1.45, cz + uz * k * len, ry, 0, 0, t + 0.2, 0.18, 1.2); }
          if (M.snow) B.add('snow', BOX, cx, h + 0.34, cz, ry, 0, 0, t + 0.6, 0.12, len + t + 0.2);
        }
        if (M.style !== 'rock') B.add('trim', BOX, cx, 0.3, cz, ry, 0, 0, t + 0.35, 0.6, len + t);
        if (M.lava) B.add('glow', BOX, cx, 0.03, cz, ry, 0, 0, t + 0.9, 0.06, len + t);
      },
      pillar(x, z, r, h, o) {
        o = o || {};
        if (M.style === 'rock') { B.add('wall', ROCK, x, h * 0.25, z, rndB() * 6, 0, 0, r * 2.4, h * 0.5, r * 2.4); const st = new THREE.ConeGeometry(r * 1.1, h * 0.9, 7); B.add('trim', st, x, h * 0.45, z, rndB() * 6); st.dispose(); const sl = new THREE.ConeGeometry(r * 1.2, h * 0.6, 7); B.add('trim', sl, x, h * 1.1, z, 0, Math.PI, 0); sl.dispose(); }
        else {
          const geo = new THREE.CylinderGeometry(r * 0.86, r, h, 8); B.add('trim', geo, x, h / 2, z, Math.PI / 8); geo.dispose();
          B.add('wall', BOX, x, 0.35, z, 0, 0, 0, r * 2.4, 0.7, r * 2.4); B.add('wall', BOX, x, h - 0.3, z, 0, 0, 0, r * 2.3, 0.6, r * 2.3);
          if (o.cap !== false) B.add(M.snow ? 'snow' : 'trim', BOX, x, h + 0.1, z, 0, 0, 0, r * 2.6, 0.25, r * 2.6);
          if (M.voidm) B.add('glow', BOX, x, h * 0.55, z, 0, 0, 0, r * 0.4, h * 0.6, r * 2.05);
        }
        B.cyl(x, z, r * 1.05, -2, h + 30);
        if (o.obstacle !== false) B.obstacles.push({ x, z, r: r * 1.05, h: h + 30 });
      },
      torch(x, y, z, ry, light) {
        const fx = x + Math.sin(ry) * 0.45, fz = z + Math.cos(ry) * 0.45;
        if (M.cave || M.voidm) {
          // grotte / néant : un cristal lumineux planté dans la paroi au lieu d'une torche
          const cr = new THREE.OctahedronGeometry(0.42, 0); B.add('glow', cr, fx, y, fz, ry, 0.5, 0.3, 1, 1.9, 1); B.add('glow', cr, fx + Math.cos(ry) * 0.3, y - 0.4, fz - Math.sin(ry) * 0.3, ry, -0.4, 0.6, 0.6, 1.2, 0.6); cr.dispose();
          if (light) B.spot(fx, y, fz, P.glow || P.accent, 1.8);
          return;
        }
        B.add('metal', BOX, x + Math.sin(ry) * 0.12, y - 0.35, z + Math.cos(ry) * 0.12, ry, 0, 0, 0.3, 0.12, 0.3);
        const st = new THREE.CylinderGeometry(0.07, 0.05, 0.75, 6); B.add('wood', st, fx, y - 0.1, fz, ry, 0.35, 0); st.dispose();
        const cup = new THREE.CylinderGeometry(0.16, 0.08, 0.2, 8); B.add('metal', cup, fx, y + 0.28, fz); cup.dispose();
        B.flame(fx, y + 0.62, fz, 0.9, light);
      },
      /** source de lumière (une lampe de la réserve viendra s'y placer si elle est proche) */
      spot(x, y, z, col, base, o) { const s = Object.assign({ x, y, z, col: L(col), base, k: 1, off: false }, o || {}); B.spots.push(s); return s; },
      flame(x, y, z, s, light) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), color: M.voidm ? L('#e0b0ff') : 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        sp.scale.set(0.55 * s, 1.1 * s, 1); sp.position.set(x, y, z); g.add(sp); B.disposables.push(sp.material);
        const F = { sp, x, y, z, s, ph: Math.random() * 9, k: 1 };
        if (light) { F.spot = B.spot(x, y + 0.2, z, P.accent, s > 1.2 ? 2.8 : 2.3, { F }); }
        B.flames.push(F); return F;
      },
      banner(x, y, z, ry, col, w, h) {
        w = w || 1.6; h = h || 3.4;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 6), new THREE.MeshStandardMaterial({ map: bannerTex(col || P.banner), side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, roughness: 0.9 }));
        m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; g.add(m); B.disposables.push(m.material, m.geometry);
        B.add('metal', BOX, x, y + h / 2 + 0.05, z, ry, 0, 0, w + 0.3, 0.08, 0.08);
        B.banners.push({ m, ph: Math.random() * 6 });
        return m;
      },
      stained(x, y, z, ry, col) {
        const key = 'sg' + col; let tex = texCache[key];
        if (!tex) {
          const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g2 = c.getContext('2d');
          const base = new THREE.Color(col), rr = rnd(col.length * 31);
          for (let yy = 0; yy < 256; yy += 32) for (let xx = 0; xx < 128; xx += 32) { const cc = base.clone().offsetHSL((rr() - 0.5) * 0.12, 0, (rr() - 0.5) * 0.25); g2.fillStyle = hex(cc); g2.fillRect(xx, yy, 32, 32); }
          g2.strokeStyle = '#141414'; g2.lineWidth = 5; for (let yy = 0; yy <= 256; yy += 32) { g2.beginPath(); g2.moveTo(0, yy); g2.lineTo(128, yy); g2.stroke(); } for (let xx = 0; xx <= 128; xx += 32) { g2.beginPath(); g2.moveTo(xx, 0); g2.lineTo(xx, 256); g2.stroke(); }
          g2.globalCompositeOperation = 'destination-in'; g2.beginPath(); g2.moveTo(0, 256); g2.lineTo(0, 70); g2.quadraticCurveTo(0, 0, 64, 0); g2.quadraticCurveTo(128, 0, 128, 70); g2.lineTo(128, 256); g2.closePath(); g2.fill();
          tex = texCache[key] = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
        }
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
        m.position.set(x, y, z); m.rotation.y = ry; g.add(m); B.disposables.push(m.geometry, m.material);
        B.add('trim', BOX, x, y - 1.6, z, ry, 0, 0, 1.9, 0.25, 0.4);
      },
      crate(x, z, s, ry, solid) { B.box('wood', x, s / 2, z, s, s, s, ry || 0, solid); B.add('metal', BOX, x, s / 2, z, ry || 0, 0, 0, s * 1.02, s * 0.12, s * 1.02); if (M.snow) B.add('snow', BOX, x, s + 0.06, z, ry || 0, 0, 0, s * 1.02, 0.12, s * 1.02); },
      barrel(x, z, solid) { const geo = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10); B.add('wood', geo, x, 0.55, z); geo.dispose(); const h = new THREE.CylinderGeometry(0.47, 0.47, 0.08, 10); B.add('metal', h, x, 0.3, z); B.add('metal', h, x, 0.8, z); h.dispose(); if (solid) B.cyl(x, z, 0.5, -1, 1.1); },
      chain(x, y, z, len) { for (let i = 0; i < len / 0.22; i++) B.add('metal', LINK, x, y - i * 0.22, z, (i % 2) * Math.PI / 2); },
      /** petit décor selon la carte (au sol, sans collision) */
      prop(x, z, solid) {
        const k = rndB();
        if (M.cave) { if (k < 0.5) crystalCluster(B, x, z, 0.8 + rndB() * 0.8); else { const c = new THREE.ConeGeometry(0.5 + rndB() * 0.4, 1.5 + rndB() * 2, 6); B.add('trim', c, x, 0.8, z, rndB() * 6); c.dispose(); if (solid) B.cyl(x, z, 0.6, -1, 2.5); } return; }
        if (M.voidm) { if (k < 0.6) crystalCluster(B, x, z, 0.7 + rndB() * 0.9); else B.add('wall', ROCK, x, 0.4, z, rndB() * 6, rndB(), rndB(), 0.9, 0.6, 0.9); return; }
        if (M.lava) { if (k < 0.4) { anvil(B, x, z); if (solid) B.cyl(x, z, 0.7, -1, 1.2); } else if (k < 0.7) B.barrel(x, z, solid); else B.crate(x, z, 0.9 + rndB() * 0.3, rndB() * 3, solid); return; }
        if (M.snow && k < 0.35) { const sp = new THREE.SphereGeometry(0.8, 8, 6); B.add('snow', sp, x, 0, z, 0, 0, 0, 1.3, 0.55, 1.1); sp.dispose(); return; }
        if (k < 0.5) B.crate(x, z, 0.9 + rndB() * 0.4, rndB() * 3, solid); else B.barrel(x, z, solid);
      },
      finish() {
        for (const k in parts) {
          const geo = mergeGeos(parts[k], tile[k] || 4); parts[k].forEach(x => x.dispose());
          const m = new THREE.Mesh(geo, mats[k]); m.castShadow = k !== 'floor' && k !== 'glow'; m.receiveShadow = true; g.add(m); B.disposables.push(geo);
        }
        for (const k in mats) B.disposables.push(mats[k]);
      },
    };
    let rs = 7; const rndB = () => { rs = (rs * 16807) % 2147483647; return (rs % 100000) / 100000; };
    B.rnd = rndB; B.reseed = n => { rs = ((n >>> 0) % 2147483645) + 1; };
    return B;
  }
  const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.userData.keep = true;
  const LINK = new THREE.TorusGeometry(0.09, 0.03, 4, 8); LINK.userData.keep = true;
  const ROCK = new THREE.DodecahedronGeometry(0.6, 0); ROCK.userData.keep = true;
  const SPIKE = new THREE.ConeGeometry(0.1, 0.4, 4); SPIKE.userData.keep = true;
  function crystalCluster(B, x, z, s) {
    const g = new THREE.OctahedronGeometry(0.35, 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + B.rnd(), d = i ? 0.35 * s : 0; B.add('glow', g, x + Math.cos(a) * d, 0.4 * s, z + Math.sin(a) * d, a, (B.rnd() - 0.5) * 0.8, (B.rnd() - 0.5) * 0.8, s * 0.8, s * (i ? 1.8 : 2.8), s * 0.8); }
    g.dispose();
    if (B.rnd() < 0.5) B.spot(x, 1.2 * s, z, B.P.glow || B.P.accent, 1.2);
  }
  function anvil(B, x, z) { B.add('metal', BOX, x, 0.35, z, 0, 0, 0, 0.6, 0.7, 0.6); B.add('metal', BOX, x, 0.85, z, 0.3, 0, 0, 1.3, 0.35, 0.5); const h = new THREE.ConeGeometry(0.25, 0.6, 6); B.add('metal', h, x + Math.cos(0.3) * 0.9, 0.85, z - Math.sin(0.3) * 0.9, 0.3, 0, Math.PI / 2); h.dispose(); }
  DG.crystalCluster = crystalCluster;
  function mergeGeos(list, tileSize) {
    let n = 0; list.forEach(x => { n += x.attributes.position.count; });
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    list.forEach(x => {
      const pa = x.attributes.position, na = x.attributes.normal;
      for (let i = 0; i < pa.count; i++, o++) {
        const px = pa.getX(i), py = pa.getY(i), pz = pa.getZ(i), nx = na ? na.getX(i) : 0, ny = na ? na.getY(i) : 1, nz = na ? na.getZ(i) : 0;
        pos[o * 3] = px; pos[o * 3 + 1] = py; pos[o * 3 + 2] = pz; nrm[o * 3] = nx; nrm[o * 3 + 1] = ny; nrm[o * 3 + 2] = nz;
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        if (ay >= ax && ay >= az) { uv[o * 2] = px / tileSize; uv[o * 2 + 1] = pz / tileSize; }
        else if (ax >= az) { uv[o * 2] = pz / tileSize; uv[o * 2 + 1] = py / tileSize; }
        else { uv[o * 2] = px / tileSize; uv[o * 2 + 1] = py / tileSize; }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    return geo;
  }

  /* =====================================================================
     LE MONDE (un par scène, gardé d'une salle à l'autre) : ciel, brouillard, lumières fixes
     ===================================================================== */
  function world(scene, P, quality) {
    let W = scene.userData.dgWorld; if (W) return W;
    const g = new THREE.Group(); scene.add(g);
    W = { g, disp: [] };
    // ciel (dégradé) + étoiles + lune ; en grotte : une voûte noire
    const U = { top: { value: L(P.sky[0]) }, mid: { value: L(P.sky[1]) }, hor: { value: L(P.sky[2]) } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top, mid, hor; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h)) : mix(hor, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }' }));
    g.add(sky); W.disp.push(sky.geometry, sky.material); W.U = U;
    const N = 900, sp = new Float32Array(N * 3), r = rnd(17);
    for (let i = 0; i < N; i++) { const a = r() * 6.283, y = 0.12 + r() * 0.88, rr = Math.sqrt(1 - y * y); sp[i * 3] = Math.cos(a) * rr * 380; sp[i * 3 + 1] = y * 380; sp[i * 3 + 2] = Math.sin(a) * rr * 380; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    W.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false })); g.add(W.stars); W.disp.push(sg, W.stars.material);
    const mc = document.createElement('canvas'); mc.width = mc.height = 128; const mg = mc.getContext('2d'); const gr = mg.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.45, 'rgba(240,240,255,0.95)'); gr.addColorStop(0.5, 'rgba(200,210,255,0.25)'); gr.addColorStop(1, 'rgba(200,210,255,0)'); mg.fillStyle = gr; mg.fillRect(0, 0, 128, 128);
    const mt = new THREE.CanvasTexture(mc); W.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, fog: false, depthWrite: false, toneMapped: false })); W.moon.scale.setScalar(60); W.moon.position.set(-120, 200, 230); g.add(W.moon); W.disp.push(mt, W.moon.material);
    W.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1); g.add(W.hemi);
    W.amb = new THREE.AmbientLight(L('#2a2c3a'), 0.4); g.add(W.amb);
    W.key = new THREE.DirectionalLight(0xffffff, 1); W.key.position.set(-30, 60, 40); W.key.target.position.set(0, 0, 0); g.add(W.key, W.key.target);
    if (quality !== 'low') { W.key.castShadow = true; W.key.shadow.mapSize.set(2048, 2048); const sc = W.key.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 1; sc.far = 160; W.key.shadow.bias = -0.0006; W.key.shadow.normalBias = 0.03; }
    // réserve FIXE de lampes (jamais ajoutées ni retirées pendant la course : pas de recompilation des shaders)
    W.pool = [];
    for (let i = 0; i < (quality === 'low' ? 4 : 8); i++) { const l = new THREE.PointLight(0xffffff, 0, 15, 2); g.add(l); W.pool.push(l); }
    W.apply = function (P2) {
      scene.background = L(P2.fog[0]); if (!scene.fog) scene.fog = new THREE.FogExp2(L(P2.fog[0]), P2.fog[1]); else { scene.fog.color.copy(L(P2.fog[0])); scene.fog.density = P2.fog[1]; }
      U.top.value.copy(L(P2.sky[0])); U.mid.value.copy(L(P2.sky[1])); U.hor.value.copy(L(P2.sky[2]));
      W.stars.visible = !!(P2.stars || P2.map.stars); W.moon.visible = !P2.map.cave; W.moon.material.color.copy(L(P2.moon[0]));
      W.hemi.color.copy(L(P2.hemi[0])); W.hemi.groundColor.copy(L(P2.hemi[1])); W.hemi.intensity = P2.hemi[2];
      W.key.color.copy(L(P2.moon[0])); W.key.intensity = P2.moon[1];
      W.pal = P2;
      const R0 = BR.Arena && BR.Arena.renderer && BR.Arena.renderer(); if (R0) R0.toneMappingExposure = P2.map.exp || 1.15;
    };
    W.dispose = function () { scene.remove(g); W.disp.forEach(d => d.dispose && d.dispose()); scene.userData.dgWorld = null; };
    scene.userData.dgWorld = W;
    W.apply(P);
    return W;
  }
  DG.world = world;

  /* ---------- au loin : tours (Citadelle), stalactites (Grotte), montagnes (Cimes), volcans (Forge), rochers flottants (Néant) ---------- */
  function skyline(B, R, seed) {
    const r = rnd(seed), M = B.M;
    if (M.cave) {
      // la voûte : des stalactites géantes qui pendent dans le noir
      for (let i = 0; i < 26; i++) { const a = r() * 6.283, d = R * (0.3 + r() * 0.9), h = 6 + r() * 14, c = new THREE.ConeGeometry(1 + r() * 2.2, h, 6); B.add('trim', c, Math.sin(a) * d, 26 - h / 2 + r() * 4, Math.cos(a) * d, r() * 6, Math.PI, 0); c.dispose(); }
      for (let i = 0; i < 10; i++) { const a = r() * 6.283, d = R + 6 + r() * 18; crystalCluster(B, Math.sin(a) * d, Math.cos(a) * d, 2 + r() * 2); }
      return;
    }
    if (M.snow) {
      for (let i = 0; i < 11; i++) { const a = i / 11 * 6.283 + r() * 0.3, d = R + 60 + r() * 80, h = 50 + r() * 70, w = 30 + r() * 30, c = new THREE.ConeGeometry(w, h, 7); B.add('trim', c, Math.sin(a) * d, h / 2 - 4, Math.cos(a) * d, r() * 6); c.dispose(); const cap = new THREE.ConeGeometry(w * 0.36, h * 0.36, 7); B.add('snow', cap, Math.sin(a) * d, h * 0.82 - 4, Math.cos(a) * d, r() * 6); cap.dispose(); }
      for (let i = 0; i < 30; i++) { const a = r() * 6.283, d = R + 5 + r() * 22, h = 5 + r() * 6, x = Math.sin(a) * d, z = Math.cos(a) * d; const t = new THREE.ConeGeometry(h * 0.32, h, 7); B.add('wood', t, x, h * 0.5, z); B.add('snow', t, x, h * 0.62, z, 0, 0, 0, 0.8, 0.5, 0.8); t.dispose(); }
      return;
    }
    if (M.lava) {
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + r() * 0.4, d = R + 50 + r() * 70, h = 40 + r() * 50, w = 26 + r() * 20, c = new THREE.CylinderGeometry(w * 0.2, w, h, 8); B.add('wall', c, Math.sin(a) * d, h / 2 - 3, Math.cos(a) * d); c.dispose(); const top = new THREE.CylinderGeometry(w * 0.18, w * 0.18, 1, 8); B.add('glow', top, Math.sin(a) * d, h - 2.6, Math.cos(a) * d); top.dispose(); }
      const ring = new THREE.RingGeometry(R + 8, R + 16, 48, 1); ring.rotateX(-Math.PI / 2); B.add('glow', ring, 0, -1.5, 0); ring.dispose();
      return;
    }
    if (M.voidm) {
      for (let i = 0; i < 24; i++) { const a = r() * 6.283, d = R + 10 + r() * 60, y = 4 + r() * 40, s = 2 + r() * 6; B.add('wall', ROCK, Math.sin(a) * d, y, Math.cos(a) * d, r() * 6, r() * 6, r() * 6, s * 1.6, s, s * 1.4); if (r() < 0.5) crystalCluster(B, Math.sin(a) * d, Math.cos(a) * d, 1); }
      return;
    }
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + r() * 0.3, d = R + 22 + r() * 30, x = Math.sin(a) * d, z = Math.cos(a) * d, h = 18 + r() * 22, w = 5 + r() * 4;
      const geo = new THREE.CylinderGeometry(w * 0.5, w * 0.55, h, 8); B.add('wall', geo, x, h / 2 - 2, z); geo.dispose();
      const roof = new THREE.ConeGeometry(w * 0.7, h * 0.35, 8); B.add('dark', roof, x, h - 2 + h * 0.17, z); roof.dispose();
      if (r() < 0.7) B.flame(x + Math.sin(a + Math.PI) * w * 0.52, h * 0.6, z + Math.cos(a + Math.PI) * w * 0.52, 0.7, false);
    }
  }

  /* ---------- porte : arche + herse ; derrière, un couloir (Citadelle), un tunnel de roche (Grotte)
     ou un pont suspendu au-dessus de la lave, du vide ou du précipice (Forge, Néant, Cimes) ---------- */
  const L2 = 7, TD = 1.6, CORR = L2 + TD / 2;      // longueur du couloir depuis le milieu du mur
  const isBridge = M => M.shell === 'lava' || M.shell === 'void' || M.shell === 'cliff';
  function door(B, x, z, ry, o) {
    o = o || {}; const W = o.w || 4.6, H = o.h || 6.2, T = TD, M = B.M, bridge = isBridge(M);
    const ux = Math.cos(ry), uz = -Math.sin(ry), ox = Math.sin(ry), oz = Math.cos(ry);
    const mx = x + ox * (L2 / 2 + T / 2), mz = z + oz * (L2 / 2 + T / 2);
    for (const s of [-1, 1]) { B.box('trim', x + ux * s * (W / 2 + 0.55), H / 2, z + uz * s * (W / 2 + 0.55), 1.1, H, T + 0.5, ry, true); }
    B.box('trim', x, H + 0.6, z, W + 2.2, 1.2, T + 0.5, ry);
    B.add('gold', BOX, x + ox * -(T / 2 + 0.26), H + 0.6, z + oz * -(T / 2 + 0.26), ry, 0, 0, 0.8, 0.8, 0.06);
    if (!bridge) {
      for (const s of [-1, 1]) B.box('wall', x + ux * s * (W / 2 + 0.4) + ox * (L2 / 2 + T / 2), H / 2, z + uz * s * (W / 2 + 0.4) + oz * (L2 / 2 + T / 2), 0.8, H + 1, L2, ry, true);
      B.box('wall', mx, H + 0.5, mz, W + 1.6, 1, L2, ry);
      if (M.shell === 'cave') {
        // la bouche du tunnel : gros rochers autour de l'arche
        for (const s of [-1, 1]) { B.add('wall', ROCK, x + ux * s * (W / 2 + 3) - ox * 0.6, 3.5, z + uz * s * (W / 2 + 3) - oz * 0.6, B.rnd() * 6, B.rnd(), B.rnd(), 6, 8, 5); B.add('wall', ROCK, x + ux * s * (W / 2 + 2.4) + ox * 3, 4, z + uz * s * (W / 2 + 2.4) + oz * 3, B.rnd() * 6, 0, 0, 4, 9, 6); }
        B.add('wall', ROCK, x - ox * 0.5, H + 2.6, z - oz * 0.5, ry, 0.4, 0, 11, 4, 5);
      }
    } else {
      // pont : garde-corps (on ne tombe pas par accident), dessous en pierre, piles qui plongent
      for (const s of [-1, 1]) { B.box(M.shell === 'void' ? 'glow' : 'trim', x + ux * s * (W / 2 + 0.3) + ox * (L2 / 2 + T / 2), 0.55, z + uz * s * (W / 2 + 0.3) + oz * (L2 / 2 + T / 2), 0.3, 0.2, L2 + 0.4, ry); B.box('trim', x + ux * s * (W / 2 + 0.3) + ox * (L2 / 2 + T / 2), 0.25, z + uz * s * (W / 2 + 0.3) + oz * (L2 / 2 + T / 2), 0.35, 0.5, L2, ry, true); }
      B.box('wall', mx, -1.6, mz, W + 0.8, 1.2, L2 + 0.6, ry);
      if (M.shell !== 'void') B.box('wall', mx, -9, mz, W * 0.5, 14, 1.4, ry);
      else { const c = new THREE.ConeGeometry(2.4, 7, 6); B.add('wall', c, mx, -5.6, mz, ry, Math.PI, 0); c.dispose(); }
    }
    B.box('floor', mx, -0.5, mz, W + 0.2, 1, L2 + 0.4, ry);
    B.floors.push({ t: 'o', x: x + ox * (L2 / 2), z: z + oz * (L2 / 2), hx: W / 2 + 0.1, hz: L2 / 2 + T, c: Math.cos(ry), s: Math.sin(ry) });
    // fond amovible (couloir) ; sur un pont, seulement une barrière invisible tant que la salle suivante n'existe pas
    const cap = new THREE.Mesh(BOX, B.mats.dark); cap.scale.set(W + 0.8, H + 1, 0.4); cap.position.set(x + ox * CORR, H / 2, z + oz * CORR); cap.rotation.y = ry; B.g.add(cap);
    const capS = B.solid(x + ox * CORR, z + oz * CORR, (W + 0.8) / 2, 0.2, ry, -2, H + 20);
    const gate = new THREE.Group(); gate.position.set(x - ox * 0.1, 0, z - oz * 0.1); gate.rotation.y = ry; B.g.add(gate);
    const bm = B.mats.metal;
    for (let i = 0; i <= 6; i++) { const m = new THREE.Mesh(BOX, bm); m.scale.set(0.14, H, 0.14); m.position.set(-W / 2 + 0.25 + i * (W - 0.5) / 6, H / 2, 0); m.castShadow = true; gate.add(m); }
    for (let j = 0; j < 4; j++) { const m = new THREE.Mesh(BOX, bm); m.scale.set(W - 0.2, 0.12, 0.18); m.position.set(0, 0.8 + j * (H - 1.2) / 3, 0); m.castShadow = true; gate.add(m); }
    for (let i = 0; i <= 6; i++) { const sp = new THREE.Mesh(SPIKE, bm); sp.position.set(-W / 2 + 0.25 + i * (W - 0.5) / 6, -0.15, 0); sp.rotation.x = Math.PI; gate.add(sp); }
    const solid = B.solid(x, z, W / 2, 0.35, ry, -2, H + 20);
    const D = { x, z, ry, ox, oz, ux, uz, W, H, gate, solid, cap, capS, bridge, open: 0, want: 0, end: new V3(x + ox * CORR, 0, z + oz * CORR) };
    D.set = (open, instant) => { D.want = open ? 1 : 0; if (instant) { D.open = D.want; gate.position.y = D.open * (H - 0.4); solid.off = D.open > 0.5; } };
    D.setCap = on => { cap.visible = !!on && !bridge; capS.off = !on; };
    D.setCap(true);
    D.set(!!o.open, true);
    B.doors.push(D);
    // éclairage de la porte : torches murales, cristaux, ou lanternes sur poteau
    for (const s of [-1, 1]) {
      const px = x + ux * s * (W / 2 + 1.5) - ox * 1.1, pz = z + uz * s * (W / 2 + 1.5) - oz * 1.1;
      if (bridge) lampPost(B, px, pz, true); else B.torch(x + ux * s * (W / 2 + 1.4) - ox * 0.9, 4.2, z + uz * s * (W / 2 + 1.4) - oz * 0.9, ry + Math.PI, true);
    }
    return D;
  }
  DG.door = door;
  // lanterne sur poteau (lieux ouverts) : feu, ou cristal dans le Néant
  function lampPost(B, x, z, light) {
    const M = B.M;
    if (M.shell === 'void') { const c = new THREE.OctahedronGeometry(0.4, 0); B.add('trim', BOX, x, 1.1, z, 0, 0, 0, 0.35, 2.2, 0.35); B.add('glow', c, x, 2.7, z, B.rnd() * 3, 0, 0, 1, 1.8, 1); c.dispose(); if (light) B.spot(x, 2.8, z, B.P.glow || B.P.accent, 2.4); B.cyl(x, z, 0.3, -1, 3); return; }
    B.add('metal', BOX, x, 1.4, z, 0, 0, 0, 0.18, 2.8, 0.18);
    B.add('metal', BOX, x, 0.1, z, 0, 0, 0, 0.6, 0.2, 0.6);
    const cup = new THREE.CylinderGeometry(0.32, 0.18, 0.3, 8); B.add('metal', cup, x, 2.95, z); cup.dispose();
    B.flame(x, 3.35, z, 1.1, light);
    B.cyl(x, z, 0.3, -1, 3.2);
  }
  DG.lampPost = lampPost;

  /* ---------- les bords de salle selon la carte ---------- */
  // Grotte : une paroi de rochers énormes, irréguliers, qui se chevauchent (aucun mur droit)
  function rockRing(B, R, doorAng, hMin, hMax) {
    const n = Math.ceil(Math.PI * 2 * R / 3.6), gap = 5.2 / R;
    for (let i = 0; i < n; i++) {
      const a = (i + B.rnd() * 0.5) / n * Math.PI * 2;
      if (doorAng.some(da => Math.abs(norm2(a - da)) < gap)) continue;
      const rr = R + 1.6 + B.rnd() * 2.2, s = 2.6 + B.rnd() * 2.2, h = hMin + B.rnd() * (hMax - hMin), x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      B.add('wall', ROCK, x, h * 0.42, z, B.rnd() * 6, (B.rnd() - 0.5) * 0.5, (B.rnd() - 0.5) * 0.5, s * 1.7, h * 0.85, s * 1.5);
      B.cyl(x, z, s * 0.95, -2, h + 30);
      // éboulis au pied, côté salle
      if (B.rnd() < 0.7) { const s2 = 0.6 + B.rnd() * 1.1, r2 = rr - s - 0.6; B.add('wall', ROCK, Math.sin(a + 0.04) * r2, s2 * 0.3, Math.cos(a + 0.04) * r2, B.rnd() * 6, B.rnd(), 0, s2 * 1.6, s2, s2 * 1.4); }
    }
    // les rochers qui encadrent les tunnels
    doorAng.forEach(da => { for (const s of [-1, 1]) { const a = da + s * 4.4 / R, x = Math.sin(a) * (R + 1.2), z = Math.cos(a) * (R + 1.2); B.add('wall', ROCK, x, 4, z, B.rnd() * 6, 0, 0, 4.2, 10, 4); B.cyl(x, z, 2, -2, 40); } });
  }
  // bordure basse (Forge, Néant) : on ne tombe pas sans le vouloir, mais on peut sauter par-dessus
  function curbRing(B, R, doorAng, mat) {
    const n = 40, gap = 3.6 / R;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, am = (a0 + a1) / 2;
      if (doorAng.some(da => Math.abs(norm2(am - da)) < gap)) continue;
      const len = 2 * R * Math.sin(Math.PI / n) + 0.4, x = Math.sin(am) * (R + 0.2), z = Math.cos(am) * (R + 0.2);
      B.box(mat, x, 0.4, z, len, 0.8, 0.7, am + Math.PI / 2, true);
      if (i % 3 === 0) B.add('wall', ROCK, Math.sin(am) * (R + 1.3), -0.2, Math.cos(am) * (R + 1.3), B.rnd() * 6, B.rnd(), 0, 2.4, 1.4, 2);
    }
  }
  // mer de lave (animée) entre deux rayons, ou rectangle
  function lavaMat(B) {
    if (B.mats.lava) return B.mats.lava;
    const m = B.mats.lava = new THREE.MeshBasicMaterial({ map: lavaTex(), color: new THREE.Color(1.6, 1.25, 1.0), toneMapped: false });
    B.anims.push((dt, t) => { if (m.map) { m.map.offset.x = t * 0.012; m.map.offset.y = Math.sin(t * 0.2) * 0.02; } });
    return m;
  }
  function lavaTex() {
    if (texCache.lava) return texCache.lava;
    const r = rnd(77), c = cv(512, (g, n) => {
      const gr = g.createLinearGradient(0, 0, n, n); gr.addColorStop(0, '#ff5a10'); gr.addColorStop(0.5, '#ff8a20'); gr.addColorStop(1, '#ff4a08'); g.fillStyle = gr; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,${200 + r() * 55},${80 + r() * 60},${0.3 + r() * 0.4})`; g.beginPath(); g.arc(r() * n, r() * n, 10 + r() * 30, 0, 7); g.fill(); }
      // croûtes sombres qui dérivent
      for (let i = 0; i < 55; i++) { const x = r() * n, y = r() * n, s = 14 + r() * 40; g.fillStyle = `rgba(${30 + r() * 30},${8 + r() * 10},4,${0.75 + r() * 0.25})`; g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283, d = s * (0.6 + r() * 0.5); k ? g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) : g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } g.closePath(); g.fill(); }
    });
    const t = mkTex(c); t.repeat.set(6, 6);
    return (texCache.lava = t);
  }
  function lavaRing(B, r0, r1) {
    const geo = new THREE.RingGeometry(r0, r1, 72, 1); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, lavaMat(B)); m.position.y = (B.room && B.room.fl % 2) ? -1.3 : -1.42; B.g.add(m); B.disposables.push(geo);
    B.spot(0, 1, r0 + 4, '#ff6a1a', 1.6, { dist: 30 });
  }
  function lavaRect(B, W, Lz) {
    const geo = new THREE.PlaneGeometry(W, Lz); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, lavaMat(B)); m.position.y = (B.room && B.room.fl % 2) ? -1.3 : -1.42; B.g.add(m); B.disposables.push(geo);
  }
  // falaises de basalte (Forge) : grandes aiguilles irrégulières au loin, autour du lac de lave
  function spires(B, R, doorAng, n) {
    for (let i = 0; i < n; i++) {
      const a = (i + B.rnd() * 0.6) / n * Math.PI * 2; if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.42)) continue;
      const rr = R + B.rnd() * 10, h = 14 + B.rnd() * 26, w = 4 + B.rnd() * 5, c = new THREE.CylinderGeometry(w * 0.25, w, h, 6);
      B.add('wall', c, Math.sin(a) * rr, h / 2 - 2, Math.cos(a) * rr, B.rnd() * 6, (B.rnd() - 0.5) * 0.2, (B.rnd() - 0.5) * 0.2); c.dispose();
    }
  }
  // dessous de l'île (Néant) : une pointe de roche qui pend dans le vide
  function underRock(B, R, x, z) {
    const c = new THREE.ConeGeometry(R + 1, R * 0.9, 9); B.add('wall', c, x || 0, -R * 0.45 - 1, z || 0, B.rnd() * 3, Math.PI, 0); c.dispose();
    for (let i = 0; i < 10; i++) { const a = B.rnd() * 6.283, d = R * (0.4 + B.rnd() * 0.6); B.add('wall', ROCK, (x || 0) + Math.sin(a) * d, -2 - B.rnd() * 5, (z || 0) + Math.cos(a) * d, B.rnd() * 6, B.rnd(), B.rnd(), 2, 3 + B.rnd() * 4, 2); }
  }
  // falaise (Cimes) : la paroi qui plonge sous le plateau, vers la vallée
  function cliffFace(B, R) {
    const geo = new THREE.CylinderGeometry(R + 0.8, R + 6, 90, 40, 1, true); B.add('wall', geo, 0, -45.4, 0); geo.dispose();
    for (let i = 0; i < 26; i++) { const a = B.rnd() * 6.283, d = R + 1.5 + B.rnd() * 3; B.add('wall', ROCK, Math.sin(a) * d, -2 - B.rnd() * 30, Math.cos(a) * d, B.rnd() * 6, B.rnd(), B.rnd(), 3, 4 + B.rnd() * 5, 3); }
  }
  // tours sur le parapet (Cimes)
  function towers(B, R, doorAng) {
    for (const a of [0.85, 2.3, -0.85, -2.3]) {
      if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.3)) continue;
      const x = Math.sin(a) * (R + 1.2), z = Math.cos(a) * (R + 1.2), geo = new THREE.CylinderGeometry(2.6, 3, 13, 10); B.add('wall', geo, x, 6.5, z); geo.dispose();
      const roof = new THREE.ConeGeometry(3.6, 5, 10); B.add('dark', roof, x, 15.5, z); roof.dispose();
      const sn = new THREE.ConeGeometry(2.6, 2.2, 10); B.add('snow', sn, x, 17.4, z); sn.dispose();
      B.cyl(x, z, 3, -2, 40);
    }
  }
  // terrasses : de l'altitude au bord de la salle (on y saute), le centre reste plat pour les combats
  function terraces(B, R, doorAng) {
    const M = B.M, mat = M.shell === 'walls' || M.shell === 'cliff' ? 'trim' : 'wall';
    for (const a of [1.05, 2.15, -1.05, -2.15]) {
      if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.5)) continue;
      const d = R - 6.5, x = Math.sin(a) * d, z = Math.cos(a) * d, ox = Math.sin(a), oz = Math.cos(a);
      B.box(mat, x, 0.55, z, 6.5, 1.1, 4.4, a, true);
      B.box(mat, x + ox * 1.6, 1.1, z + oz * 1.6, 4, 2.2, 3, a + 0.25, true);
      if (M.shell === 'cave' || M.shell === 'void' || M.shell === 'lava') { B.add('wall', ROCK, x - ox * 2.2, 0.4, z - oz * 2.2, B.rnd() * 6, 0, 0, 2.2, 1.1, 2); B.add('wall', ROCK, x + ox * 2.6, 2.3, z + oz * 2.6, B.rnd() * 6, 0, 0, 2.4, 1.2, 2.2); }
      else { B.box('trim', x - ox * 2.6, 0.28, z - oz * 2.6, 3, 0.55, 1.2, a); }
      if (M.snow) B.add('snow', BOX, x + ox * 1.6, 2.26, z + oz * 1.6, a + 0.25, 0, 0, 4.1, 0.12, 3.1);
      if (M.cave || M.voidm) crystalCluster(B, x + ox * 1.6, z + oz * 1.6, 0.9);
      B.obstacles.push({ x: x + ox * 0.8, z: z + oz * 0.8, r: 3.2, h: 2.2 });
    }
  }

  /* =====================================================================
     LES SALLES (une porte au sud, une porte au nord) — la forme dépend de la carte
     ===================================================================== */
  const ROOM_R = 34;
  const norm = a => { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; };
  const norm2 = a => Math.atan2(Math.sin(a), Math.cos(a));
  function ringWalls(B, R, H, T, doorAng, fw) {
    const half = fw / 2 / R, blocks = [];
    doorAng.forEach(a => { const a0 = norm(a - half), a1 = a0 + half * 2; if (a1 > Math.PI * 2) { blocks.push([a0, Math.PI * 2]); blocks.push([0, a1 - Math.PI * 2]); } else blocks.push([a0, a1]); });
    blocks.sort((x, y) => x[0] - y[0]);
    const free = []; let cur = 0;
    blocks.forEach(([b0, b1]) => { if (b0 > cur) free.push([cur, b0]); cur = Math.max(cur, b1); });
    if (cur < Math.PI * 2) free.push([cur, Math.PI * 2]);
    if (free.length > 1 && free[0][0] === 0 && free[free.length - 1][1] === Math.PI * 2) { const last = free.pop(); free[0] = [last[0] - Math.PI * 2, free[0][1]]; }
    free.forEach(([a0, a1]) => {
      if (a1 - a0 < 0.02) return;
      const n = Math.max(1, Math.ceil((a1 - a0) * R / 5));
      for (let i = 0; i < n; i++) { const p0 = a0 + (a1 - a0) * i / n, p1 = a0 + (a1 - a0) * (i + 1) / n; B.wall(Math.sin(p0) * R, Math.cos(p0) * R, Math.sin(p1) * R, Math.cos(p1) * R, H, T); }
    });
  }
  DG.ringWalls = ringWalls;
  function brazier(B, x, z, light) {
    const geo = new THREE.CylinderGeometry(0.7, 0.35, 0.6, 8); B.add('metal', geo, x, 1.3, z); geo.dispose();
    const leg = new THREE.CylinderGeometry(0.12, 0.2, 1.1, 6); B.add('metal', leg, x, 0.55, z); leg.dispose();
    B.add('metal', BOX, x, 0.06, z, 0, 0, 0, 1, 0.12, 1);
    B.cyl(x, z, 0.75, -1, 1.6);
    B.obstacles.push({ x, z, r: 0.75, h: 1.6 });
    return B.flame(x, 2.0, z, 1.7, light);
  }
  DG.brazier = brazier;
  // le bord d'une salle ronde (rayon R) selon la carte : murs, paroi de grotte, parapet, île
  function ringShell(B, R, H, big) {
    const M = B.M, sh = M.shell, doorAng = [Math.PI, 0], N = big ? 14 : 9;
    if (sh === 'walls') {
      ringWalls(B, R, H, big ? 1.6 : 1.4, doorAng, big ? 6.9 : 6.4);
      for (let i = 0; i < N; i++) {
        const a = (i + 0.5) / N * Math.PI * 2; if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.2 * (big ? 1 : 2))) continue;
        if (big) B.box('trim', Math.sin(a) * (R - 0.9), H / 2, Math.cos(a) * (R - 0.9), 1.4, H, 1.0, a, true);
        B.torch(Math.sin(a) * (R - (big ? 1.5 : 0.9)), big ? 4.2 : 3.8, Math.cos(a) * (R - (big ? 1.5 : 0.9)), a + Math.PI, i % 2 === 0);
        if (i % 2) B.banner(Math.sin(a + 0.11) * (R - 0.85), big ? 6.6 : 5.6, Math.cos(a + 0.11) * (R - 0.85), a + Math.PI, null, 1.8, big ? 4 : 3.4);
      }
    } else if (sh === 'cave') {
      rockRing(B, R, doorAng, big ? 9 : 7, big ? 20 : 13);
      for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * Math.PI * 2; if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.3)) continue; crystalCluster(B, Math.sin(a) * (R - 1.2), Math.cos(a) * (R - 1.2), 1.1 + B.rnd() * 0.8); if (i % 2 === 0) B.spot(Math.sin(a) * (R - 1.5), 2, Math.cos(a) * (R - 1.5), B.P.glow || B.P.accent, 2.2); }
    } else if (sh === 'cliff') {
      ringWalls(B, R, 1.4, 1.0, doorAng, big ? 6.9 : 6.4);
      cliffFace(B, R); towers(B, R, doorAng);
      for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * Math.PI * 2; if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.3)) continue; if (i % 2 === 0) lampPost(B, Math.sin(a) * (R - 1.6), Math.cos(a) * (R - 1.6), true); }
    } else if (sh === 'lava') {
      curbRing(B, R, doorAng, 'trim');
      lavaRing(B, R + 0.6, R + 40);
      spires(B, R + 22, doorAng, big ? 22 : 14);
      for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * Math.PI * 2; if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.3)) continue; if (i % 2 === 0) lampPost(B, Math.sin(a) * (R - 1.6), Math.cos(a) * (R - 1.6), true); }
    } else if (sh === 'void') {
      curbRing(B, R, doorAng, 'glow');
      underRock(B, R);
      for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * Math.PI * 2; if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.3)) continue; if (i % 2 === 0) lampPost(B, Math.sin(a) * (R - 1.6), Math.cos(a) * (R - 1.6), true); }
    }
    return doorAng;
  }
  // grande salle de combat (rayon 34 m : les boss et les vagues en ont besoin)
  function hall(B, room, rng, o) {
    o = o || {};
    const R = ROOM_R + 0.9, M = B.M, H = M.cave ? 14 : 11;
    B.floorDisc(0, 0, R + 0.5);
    const ring = new THREE.RingGeometry(9.5, 10.3, 48); ring.rotateX(-Math.PI / 2); B.add(M.shell === 'walls' ? 'gold' : 'glow', ring, 0, 0.02, 0); ring.dispose();
    if (M.shell === 'walls' || M.shell === 'cliff') { const ring2 = new THREE.RingGeometry(R - 3.2, R - 2.7, 64); ring2.rotateX(-Math.PI / 2); B.add('trim', ring2, 0, 0.015, 0); ring2.dispose(); }
    const doorAng = ringShell(B, R, H, true);
    const ent = door(B, 0, -(R + 0.2), Math.PI, { open: true });
    const exit = door(B, 0, R + 0.2, 0);
    if (o.pillars !== false) {
      const np = 6, rr = 19, off = rng() * 0.5;
      for (let i = 0; i < np; i++) { const a = off + i / np * Math.PI * 2; if (Math.abs(norm2(a - Math.PI)) < 0.35 || Math.abs(norm2(a)) < 0.25) continue; B.pillar(Math.sin(a) * rr, Math.cos(a) * rr, 1.25, M.cave ? 12 : 9); }
    }
    terraces(B, R, doorAng);
    for (const a of [Math.PI * 0.75, -Math.PI * 0.75, Math.PI * 0.25, -Math.PI * 0.25]) { if (M.cave || M.voidm) { crystalCluster(B, Math.sin(a) * 15, Math.cos(a) * 15, 1.4); B.cyl(Math.sin(a) * 15, Math.cos(a) * 15, 0.9, -1, 3); B.obstacles.push({ x: Math.sin(a) * 15, z: Math.cos(a) * 15, r: 0.9, h: 3 }); } else brazier(B, Math.sin(a) * 14, Math.cos(a) * 14, true); }
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2; if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.25)) continue;
      if (M.shell === 'walls' && rng() > 0.75) B.chain(Math.sin(a) * (R - 0.9), 9, Math.cos(a) * (R - 0.9), 3 + rng() * 3); else B.prop(Math.sin(a) * (R - 3.2), Math.cos(a) * (R - 3.2), false);
    }
    return { R, entrance: ent, exits: [exit], spawn: { x: 0, z: -(R - 7.5), yaw: 0 }, rewardAt: new V3(0, 0, 0) };
  }
  // salle calme (feu de camp, marchand, autel)
  function chapel(B, room, rng) {
    const R = 17, H = 9, M = B.M;
    B.floorDisc(0, 0, R + 0.5);
    const doorAng = ringShell(B, R, H, false);
    const ent = door(B, 0, -(R + 0.2), Math.PI, { open: true });
    const exit = door(B, 0, R + 0.2, 0, { w: 4.2 });
    for (let i = 0; i < 6; i++) { const a = rng() * Math.PI * 2; if (doorAng.some(da => Math.abs(norm2(a - da)) < 0.5)) continue; B.prop(Math.sin(a) * (R - 2.6), Math.cos(a) * (R - 2.6), true); }
    void M;
    return { R, entrance: ent, exits: [exit], spawn: { x: 0, z: -(R - 4), yaw: 0 }, rewardAt: new V3(0, 0, 0) };
  }
  // bord d'une salle rectangulaire (énigmes) selon la carte — les murs droits restent pour la Citadelle
  DG.rectShell = function (B, W, Lz, H, full) {
    if (B.theme && B.theme.rectShell) return B.theme.rectShell(B, W, Lz, H, full, DG.api);
    const M = B.M, sh = M.shell, hx = W / 2, hz = Lz / 2, fg = 3.6;
    const seg = (x0, z0, x1, z1, fn) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3.4)); for (let i = 0; i <= n; i++) { const t = i / n; fn(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, x1 - x0, z1 - z0); } };
    const edges = [[-hx, -hz, -fg, -hz], [fg, -hz, hx, -hz], [-hx, hz, -fg, hz], [fg, hz, hx, hz], [-hx, -hz, -hx, hz], [hx, -hz, hx, hz]];
    if (sh === 'cave') {
      edges.forEach(([x0, z0, x1, z1]) => seg(x0, z0, x1, z1, (x, z) => {
        const s = 2.2 + B.rnd() * 1.8, h = 7 + B.rnd() * 9, nx = Math.abs(x) >= hx - 0.01 ? Math.sign(x) : 0, nz = nx ? 0 : Math.sign(z), px = x + nx * (s * 0.7), pz = z + nz * (s * 0.7);
        B.add('wall', ROCK, px, h * 0.42, pz, B.rnd() * 6, (B.rnd() - 0.5) * 0.4, 0, s * 1.7, h * 0.85, s * 1.5); B.cyl(px, pz, s * 0.95, -2, h + 30);
      }));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.add('wall', ROCK, sx * (fg + 1.4), 4, sz * (hz + 1.2), B.rnd() * 6, 0, 0, 4, 10, 4); B.cyl(sx * (fg + 1.4), sz * (hz + 1.2), 2, -2, 40); }
      for (let i = 0; i < Math.floor(Lz / 8); i++) for (const sx of [-1, 1]) { const z = -hz + 4 + i * 8 + B.rnd() * 3; crystalCluster(B, sx * (hx - 1.3), z, 0.9 + B.rnd() * 0.6); if (i % 2 === 0) B.spot(sx * (hx - 1.5), 2, z, B.P.glow || B.P.accent, 2.2); }
      return;
    }
    if (sh === 'cliff') {
      edges.forEach(([x0, z0, x1, z1]) => B.wall(x0, z0, x1, z1, 1.4, 1.0));
      // falaise sous la salle
      if (full) { const geo = new THREE.BoxGeometry(W + 2, 80, Lz + 2); B.add('wall', geo, 0, -40.5, 0); geo.dispose(); }
      else for (const [x, z, w, d] of [[-hx - 0.5, 0, 1, Lz + 2], [hx + 0.5, 0, 1, Lz + 2], [0, -hz - 0.5, W + 2, 1], [0, hz + 0.5, W + 2, 1]]) B.box('wall', x, -40.5, z, w, 80, d);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * (hx + 0.8), z = sz * (hz * 0.45), g2 = new THREE.CylinderGeometry(2.2, 2.6, 11, 10); B.add('wall', g2, x, 5.5, z); g2.dispose(); const rf = new THREE.ConeGeometry(3, 4.5, 10); B.add('dark', rf, x, 13.2, z); rf.dispose(); const sn = new THREE.ConeGeometry(2.1, 2, 10); B.add('snow', sn, x, 14.9, z); sn.dispose(); B.cyl(x, z, 2.6, -2, 40); }
      for (let i = 0; i < Math.floor(Lz / 10); i++) for (const sx of [-1, 1]) lampPost(B, sx * (hx - 1.6), -hz + 5 + i * 10, i % 2 === 0);
      return;
    }
    // Forge et Néant : une île rectangulaire bordée d'une margelle basse ; dessous, la lave ou le vide
    edges.forEach(([x0, z0, x1, z1]) => { const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0); B.box(sh === 'void' ? 'glow' : 'trim', (x0 + x1) / 2, 0.4, (z0 + z1) / 2, 0.7, 0.8, len, ry, true); });
    if (sh === 'lava') { lavaRect(B, W + 90, Lz + 90); spires(B, Math.max(hx, hz) + 26, [Math.PI, 0], 16); }
    else if (full) underRock(B, Math.max(hx, hz) * 0.7, 0, 0);
    for (let i = 0; i < Math.floor(Lz / 10); i++) for (const sx of [-1, 1]) lampPost(B, sx * (hx - 1.6), -hz + 5 + i * 10, i % 2 === 0);
  };

  /* =====================================================================
     PHYSIQUE (sol, murs, caméra) — avec la salle voisine pendant le passage
     ===================================================================== */
  function inSolidXZ(s, x, z, pad) {
    if (s.t === 'c') { const dx = x - s.x, dz = z - s.z; return dx * dx + dz * dz < (s.r + pad) * (s.r + pad); }
    const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
    return Math.abs(lx) < s.hx + pad && Math.abs(lz) < s.hz + pad;
  }
  function onFloor(F, x, z) {
    for (let i = 0; i < F.length; i++) {
      const f = F[i];
      if (f.t === 'r') { if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return true; }
      else if (f.t === 'd') { if ((x - f.x) * (x - f.x) + (z - f.z) * (z - f.z) <= f.r * f.r) return true; }
      else { const dx = x - f.x, dz = z - f.z, lx = dx * f.c - dz * f.s, lz = dx * f.s + dz * f.c; if (Math.abs(lx) <= f.hx && Math.abs(lz) <= f.hz) return true; }
    }
    return false;
  }
  function pushOut(s, p, rad) {
    if (s.t === 'c') {
      const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), m = s.r + rad;
      if (d < m) { if (d < 1e-4) { p.x = s.x + m; } else { p.x = s.x + dx / d * m; p.z = s.z + dz / d * m; } return true; }
      return false;
    }
    const dx = p.x - s.x, dz = p.z - s.z;
    let lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
    const qx = Math.max(-s.hx, Math.min(s.hx, lx)), qz = Math.max(-s.hz, Math.min(s.hz, lz));
    const ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
    if (d >= rad) return false;
    if (d > 1e-5) { lx = qx + ox / d * rad; lz = qz + oz / d * rad; }
    else { const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz); if (px < pz) lx = Math.sign(lx || 1) * (s.hx + rad); else lz = Math.sign(lz || 1) * (s.hz + rad); }
    p.x = s.x + lx * s.c + lz * s.s; p.z = s.z - lx * s.s + lz * s.c;
    return true;
  }
  const _pp = new V3();
  DG.physics = function (env) {
    const B = env.B;
    // requêtes « locales » (coordonnées de cette salle)
    env.groundLocal = function (x, z, y) {
      let best = -Infinity, ls = null;
      if (onFloor(B.floors, x, z) && y >= -0.6) best = 0;
      const S = B.solids;
      for (let i = 0; i < S.length; i++) {
        const s = S[i]; if (s.off || s.y1 > y + 0.02 || s.y1 <= best || s.y1 > 12) continue;
        if (inSolidXZ(s, x, z, 0.18)) { best = s.y1; ls = s; }   // les pieds débordent un peu : on tient au bord d'une marche
      }
      env._ls = ls; return best;
    };
    // st : hauteur de marche franchissable en marchant (0 en l'air)
    env.pushLocal = function (p, rad, st) {
      const S = B.solids;
      if (st) for (let i = 0; i < S.length; i++) {
        const s = S[i]; if (s.off || s.y1 > 12 || s.y1 <= p.y + 0.05 || s.y1 > p.y + st || p.y + 1.75 <= s.y0) continue;
        if (!inSolidXZ(s, p.x, p.z, rad + 0.02)) continue;
        p.y = s.y1;   // on monte la marche et on pose les pieds dessus
        if (s.t === 'c') { const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), m = s.r + 0.1; if (d > m) { p.x = s.x + dx / d * m; p.z = s.z + dz / d * m; } }
        else { const dx = p.x - s.x, dz = p.z - s.z; let lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c; lx = Math.max(-s.hx - 0.1, Math.min(s.hx + 0.1, lx)); lz = Math.max(-s.hz - 0.1, Math.min(s.hz + 0.1, lz)); p.x = s.x + lx * s.c + lz * s.s; p.z = s.z - lx * s.s + lz * s.c; }
      }
      for (let k = 0; k < 2; k++) for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.off || p.y >= s.y1 - 0.05 || p.y + 1.75 <= s.y0) continue; pushOut(s, p, rad); }
    };
    env.camHitLocal = function (x, y, z) { const S = B.solids; for (let j = 0; j < S.length; j++) { const s = S[j]; if (s.off || s.y1 < 3 || y > s.y1 || y < s.y0) continue; if (inSolidXZ(s, x, z, 0.35)) return true; } return false; };
    // requêtes du moteur : cette salle + la salle voisine (décalée), s'il y en a une
    env.groundAt = function (x, z, y) {
      let best = env.groundLocal(x, z, y); env.lastS = env._ls;
      const N = env.nb; if (N) { const g2 = N.env.groundLocal(x - N.off.x, z - N.off.z, y); if (g2 > best) { best = g2; env.lastS = null; } }
      return best;
    };
    env.confine = function (f) {
      const p = f.pos, gy = f.gy == null ? 0 : f.gy, grounded = p.y - gy < 0.06;
      if (grounded && f.gs && f.gs.mv && !f.gs.off) { p.x += f.gs.mv.x; p.z += f.gs.mv.z; if (f.gs.mv.y) p.y += f.gs.mv.y; }
      const st = grounded && f.kind !== 'boss' ? 0.62 : 0, y0 = p.y;
      env.pushLocal(p, 0.42, st);
      const N = env.nb; if (N) { _pp.set(p.x - N.off.x, p.y, p.z - N.off.z); N.env.pushLocal(_pp, 0.42, st); p.x = _pp.x + N.off.x; p.z = _pp.z + N.off.z; p.y = _pp.y; }
      if (p.y > y0) { f.gy = p.y; if (f.vel.y < 0) f.vel.y = 0; }
      const lim = N ? 200 : 60, r = Math.hypot(p.x, p.z); if (r > lim) { p.x *= lim / r; p.z *= lim / r; }
      if (f.kind === 'local' && grounded && isFinite(gy) && !(f.gs && f.gs.mv) && !(f.gs && f.gs.crumble)) {
        env.safeT = (env.safeT || 0) + 1;
        if (env.safeT % 10 === 0) {
          let ok = true; for (let a = 0; a < 6 && ok; a++) { const xx = p.x + Math.cos(a) * 0.9, zz = p.z + Math.sin(a) * 0.9; if (!isFinite(env.groundAt(xx, zz, p.y + 0.3))) ok = false; }
          if (ok) { (f.safe = f.safe || new V3()).copy(p); }
        }
      }
    };
    env.camClip = function (tgt, pos) {
      const dx = pos.x - tgt.x, dy = pos.y - tgt.y, dz = pos.z - tgt.z, len = Math.hypot(dx, dy, dz), n = Math.ceil(len / 0.25), N = env.nb;
      let k = 1;
      for (let i = 1; i <= n; i++) {
        const t = i / n, x = tgt.x + dx * t, y = tgt.y + dy * t, z = tgt.z + dz * t;
        if (env.camHitLocal(x, y, z) || (N && N.env.camHitLocal(x - N.off.x, y, z - N.off.z))) { k = Math.max(0.12, (i - 1) / n - 0.02); break; }
      }
      if (k < 1) pos.set(tgt.x + dx * k, tgt.y + dy * k, tgt.z + dz * k);
      return pos;
    };
    env.onFall = function (f) {
      if (f.kind !== 'local') return;
      const S = env.S; const back = f.safe ? f.safe.clone() : new V3(env.spawn.x, 0, env.spawn.z);
      f.pos.copy(back).setY(back.y + 0.3); f.vel.set(0, 0, 0); f.gs = null; f.inv = Math.max(f.inv, 1.2);
      const lava = env.map && env.map.shell === 'lava', dmg = Math.round(f.maxHp * (lava ? 0.1 : 0.07)); f.hp = Math.max(1, f.hp - dmg);
      if (S) { S.fx.num(f.center(), '-' + dmg, { color: '#ff7a7a' }); S.camTgt = null; BR.Arena.banner(lava ? 'BRÛLÉ !' : 'CHUTE !', 'Retour au dernier endroit sûr', 1.1, 'bad'); if (lava) S.fx.burst(f.center(), { n: 40, color: 0xff6a1a, speed: 6, life: 0.7 }); }
      BR.Audio.fx('hurt', { g: 0.8 });
      if (env.onPlayerFall) env.onPlayerFall(f);
    };
  };

  /* =====================================================================
     CONSTRUCTION D'UNE SALLE
     opt.preview : construite à l'avance (salle suivante), décalée de opt.offset, sans toucher au ciel ni au brouillard
     ===================================================================== */
  DG.build = function (scene, room, quality, opt) {
    opt = opt || {};
    const P = DG.palOf(room.fl || 1, room.map), rng = BR.rngFrom(((room.seed || 1) * 2654435761 ^ 0x5bd1e995) >>> 0);
    const W = world(scene, P, quality);
    if (!opt.preview) W.apply(P);
    const B = Builder(scene, P, quality); B.room = room; B.rng = rng; B.reseed(room.seed || 7);
    // thème de la carte (js/arena/maps/<carte>.js) : il peut remplacer les matériaux, la grande salle, la chapelle,
    // le bord des salles d'énigme, le décor lointain et ajouter ses propres animations
    const TH = DG.THEMES[P.map.id] || null; B.theme = TH;
    if (TH && TH.setup) TH.setup(B, room, rng, DG.api);
    const kind = room.kind;
    let L0;
    if (kind === 'enigme' && DG.PUZZLES[room.puz]) L0 = DG.PUZZLES[room.puz].layout(B, room, rng);
    else if (kind === 'savoir' && DG.QUIZ[room.quiz]) L0 = DG.QUIZ[room.quiz].layout(B, room, rng);
    else if (kind === 'repos' || kind === 'marchand' || kind === 'autel') L0 = TH && TH.chapel ? TH.chapel(B, room, rng, DG.api) : chapel(B, room, rng);
    else L0 = TH && TH.hall ? TH.hall(B, room, rng, { pillars: !(kind === 'gardien' || kind === 'final'), boss: kind === 'gardien' || kind === 'final' }, DG.api) : hall(B, room, rng, { pillars: !(kind === 'gardien' || kind === 'final') });
    if (TH && TH.skyline) TH.skyline(B, L0.R || 34, (room.seed || 3) % 997, DG.api, L0); else skyline(B, L0.R || 34, (room.seed || 3) % 997);
    if (TH && TH.finish) TH.finish(B, room, L0, DG.api);
    B.finish();
    const env = {
      dungeon: true, B, group: B.g, theme: { accent: P.accent }, key: W.key, biome: P.map.id, pal: P, map: P.map, world: W, obstacles: B.obstacles, hazards: [], room,
      R: L0.R, spawn: L0.spawn, entrance: L0.entrance, exits: L0.exits, rewardAt: L0.rewardAt || new V3(), rewardW: L0.rewardW, layout: L0, t: 0, S: null,
      offset: (opt.offset || new V3()).clone(), nb: null, extraSpots: [],
      /** source de lumière ajoutée en cours de route (coffre, autel, professeur…) : jamais une vraie lampe en plus */
      addSpot(x, y, z, col, base, o) { const s = Object.assign({ x, y, z, col: new THREE.Color(col), base, k: 1, off: false }, o || {}); env.extraSpots.push(s); return s; },
      /** visuel seulement (flammes, bannières, herses) : appelé aussi pour la salle voisine */
      visual(dt, fx) {
        env.t += dt; const t = env.t, ox = env.offset.x, oz = env.offset.z;
        B.flames.forEach(F => { const k = 0.85 + Math.sin(t * 13 + F.ph) * 0.08 + Math.sin(t * 7.3 + F.ph * 2) * 0.06 + Math.random() * 0.06; F.k = k; F.sp.scale.set(0.55 * F.s * (0.9 + k * 0.15), 1.1 * F.s * k, 1);
          if (fx && F.sp.visible && Math.random() < dt * 3 * F.s) fx.spark(new V3(F.x + ox + (Math.random() - 0.5) * 0.2 * F.s, F.y + 0.2, F.z + oz + (Math.random() - 0.5) * 0.2 * F.s), new V3((Math.random() - 0.5) * 0.5, 1.4 + Math.random(), (Math.random() - 0.5) * 0.5), { color: env.map.voidm ? 0xc08aff : 0xffa040, life: 0.6, size: 0.1 }); });
        B.banners.forEach(b => { b.m.rotation.x = Math.sin(t * 1.3 + b.ph) * 0.04; });
        B.doors.forEach(D => {
          if (Math.abs(D.want - D.open) > 0.001) {
            const was = D.open; D.open += Math.sign(D.want - D.open) * Math.min(Math.abs(D.want - D.open), dt * (D.want > D.open ? 0.9 : 3.2));
            D.gate.position.y = D.open * (D.H - 0.4); D.solid.off = D.open > 0.5;
            if (was === 0 && D.open > 0 && env.S) BR.Audio.fx('charge', { len: 1.1, g: 0.35, rate: 0.6 });
            if (D.open === 0 && was > 0) { BR.Audio.fx('land', { g: 1 }); if (fx) for (let i = 0; i < 12; i++) fx.spark(new V3(D.x + ox + D.ux * (Math.random() - 0.5) * D.W, 0.2, D.z + oz + D.uz * (Math.random() - 0.5) * D.W), new V3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3), { color: 0x9a8a70, life: 0.6, size: 0.18, kind: 'smoke' }); if (env.S) BR.Arena.shake(0.25); }
          }
        });
        B.anims.forEach(a => a(dt, t));
      },
      update(dt, fx) {
        env.visual(dt, fx);
        if (env.nb) env.nb.env.visual(dt, fx);
        if (env.puzzle && env.puzzle.update) env.puzzle.update(dt, env.t);
        lights(env);
        ambient(env, dt, fx);
      },
      dispose(o2) {
        if (env.puzzle && env.puzzle.dispose) try { env.puzzle.dispose(); } catch (e) { console.warn(e); }
        scene.remove(B.g);
        B.g.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); });
        B.disposables.forEach(d => { try { d.dispose(); } catch (e) { /* rien */ } });
        (B.extraDispose || []).forEach(d => { try { d.dispose(); } catch (e) { /* rien */ } });
        if (env.nb && !(o2 && o2.keepNb)) { try { env.nb.env.dispose({ keepWorld: true }); } catch (e) { /* rien */ } env.nb = null; }
        if (!(o2 && o2.keepWorld) && scene.userData.dgWorld === W) W.dispose();
      },
    };
    env.puzzleData = L0.data || null;
    env.fallY = P.map.shell === 'lava' ? -1.1 : -14;
    if (opt.offset) B.g.position.copy(opt.offset);
    DG.physics(env);
    return env;
  };

  /* ---------- boîte à outils des thèmes de carte (js/arena/maps/*.js) ---------- */
  DG.THEMES = DG.THEMES || {};
  DG.api = { L, V3, BOX, ROCK, LINK, SPIKE, rnd, cv, mkTex, shade, texCache, mergeGeos, bricks, rock, basalt, crystalWall, flags, planks, glowMap, bannerTex, flameTex,
    door, lampPost, ringWalls, brazier, crystalCluster, anvil, rockRing, curbRing, lavaRing, lavaRect, lavaMat, spires, underRock, cliffFace, towers, terraces, hall, chapel, ringShell, skyline,
    norm2, ROOM_R, CORR, model: name => { const g = BR.Assets && BR.Assets.models && BR.Assets.models[name]; return g ? g.scene : null; } };

  /* ---------- lumières : les lampes de la réserve vont sur les sources les plus proches du joueur ---------- */
  const _cand = [];
  function lights(env) {
    const S = env.S, W = env.world; if (!W || !W.pool) return;
    const me = S && S.me, px = me ? me.pos.x : 0, pz = me ? me.pos.z : 0;
    _cand.length = 0;
    const take = (list, ox, oz) => { for (const s of list) { if (s.off) continue; let x = s.x + ox, y = s.y, z = s.z + oz; if (s.obj) { const w = s.obj.getWorldPosition(_pp); x = w.x; y = w.y; z = w.z; } const d = (x - px) * (x - px) + (z - pz) * (z - pz); _cand.push({ s, x, y, z, d }); } };
    take(env.B.spots, 0, 0); take(env.extraSpots, 0, 0);
    if (env.nb) { take(env.nb.env.B.spots, env.nb.off.x, env.nb.off.z); }
    _cand.sort((a, b) => a.d - b.d);
    const t = env.t;
    W.pool.forEach((l, i) => {
      const c = _cand[i];
      if (!c) { l.intensity = 0; return; }
      const s = c.s, fl = s.F ? s.F.k : s.flick ? 0.9 + Math.sin(t * 9 + i) * 0.1 : 1;
      l.position.set(c.x, c.y, c.z); l.color.copy(s.col);
      const base = typeof s.base === 'function' ? s.base(t) : s.base;
      l.intensity = (s.F && !s.F.sp.visible) ? 0 : base * fl * Math.min(1, 1.6 - Math.sqrt(c.d) / 40);
      l.distance = s.dist || 15;
    });
  }
  // particules d'ambiance autour du joueur : neige, braises, poussière de cristal, éclats du Néant
  function ambient(env, dt, fx) {
    const S = env.S; if (!fx || !S || !S.me) return; const M = env.map, p = S.me.pos;
    const rate = M.snow ? 40 : M.lava ? 18 : M.voidm ? 14 : M.cave ? 8 : 0; if (!rate) return;
    let n = rate * dt; while (n > 0) {
      if (Math.random() > n) break; n -= 1;
      const x = p.x + (Math.random() - 0.5) * 30, z = p.z + (Math.random() - 0.5) * 30;
      if (M.snow) fx.spark(new V3(x, 9 + Math.random() * 5, z), new V3(1.5 + Math.random(), -2.2 - Math.random(), (Math.random() - 0.5)), { color: 0xffffff, life: 4, size: 0.12 });
      else if (M.lava) fx.spark(new V3(x, 0.2, z), new V3((Math.random() - 0.5) * 0.6, 1.6 + Math.random() * 2, (Math.random() - 0.5) * 0.6), { color: 0xff7a2a, life: 2.2, size: 0.12 });
      else if (M.voidm) fx.spark(new V3(x, Math.random() * 6, z), new V3((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4), { color: 0xc08aff, life: 3, size: 0.14 });
      else fx.spark(new V3(x, 3 + Math.random() * 6, z), new V3(0, -0.4, 0), { color: 0x9adfff, life: 3, size: 0.08 });
    }
  }

  /* ---------- la porte de sortie : une seule, sans texte ; la salle suivante est construite derrière ---------- */
  // décalage pour que le couloir de sortie (ici) rejoigne le couloir d'entrée de la salle suivante
  function linkOffset(A, envB) {
    const Da = A.exits[0], Db = envB.entrance;
    return new V3((Da.x + Da.ox * CORR) - (Db.x + Db.ox * CORR), 0, (Da.z + Da.oz * CORR) - (Db.z + Db.oz * CORR));
  }
  DG.prebuild = function (env, room) {
    if (env.nb && env.nb.room === room) return env.nb.env;
    const S = env.S, q = (S && S.quality) || 'high';
    const B2 = DG.build(S.scene, room, q, { preview: true, offset: new V3() });
    const off = linkOffset(env, B2);
    B2.B.g.position.copy(off); B2.offset.copy(off); B2.S = S;
    env.nb = { env: B2, off, room };
    env.exits[0].setCap(false); B2.entrance.setCap(false); B2.entrance.set(true, true);
    return B2;
  };
  DG.makeExits = function (env, list, h) {
    const D = env.exits && env.exits[0], d = list[0]; if (!D || !d) return [];
    let ready = false;
    const go = () => { if (ready || BR.Arena.session() !== env.S) return; if (d.room) DG.prebuild(env, d.room); ready = true; };
    // construite un peu plus tard (pas en même temps que l'apparition du coffre)
    setTimeout(go, 700);
    const P = { kind: 'portal', tag: 'portal', d, i: 0, door: D, pos: new V3(D.x + D.ox * (CORR + 4), 0, D.z + D.oz * (CORR + 4)), r: 3.4, group: null, color: '#ffffff', U: { uPull: { value: 0 } }, light: null, votes: null, onVote: h.onVote,
      update() {
        if (!ready) return;
        D.set(!h.sealed());
        // entrer dans la salle suivante = choisir la porte (un seul chemin)
        if (env.nb) { const Db = env.nb.env.entrance, o = env.nb.off; P.pos.set(Db.x + o.x - Db.ox * 3.2, 0, Db.z + o.z - Db.oz * 3.2); }
      },
      dispose() {} };
    return [P];
  };

  /* ---------- changement de salle sans chargement : appelé par le moteur (BR.Arena.swapRoom) ---------- */
  // renvoie la salle suivante (déjà construite) et son décalage ; null si elle n'existe pas
  DG.takeNext = function (env, room) { if (!env || !env.nb || (room && env.nb.room !== room && env.nb.room.seed !== room.seed)) return null; return env.nb; };
  // la nouvelle salle devient la salle courante, centrée : son décor revient à l'origine
  DG.activate = function (env, S) {
    env.B.g.position.set(0, 0, 0); env.offset.set(0, 0, 0); env.S = S; env.nb = null;
    env.world.apply(env.pal);
    // la porte d'entrée se referme derrière nous, puis le fond du couloir se ferme
    const D = env.entrance;
    setTimeout(() => { if (BR.Arena.session() === S && S.env === env) { D.set(false); setTimeout(() => { if (S.env === env) D.setCap(true); }, 900); } }, 700);
  };
  // lumières créées par d'autres modules (boss, salles calmes…) : cachées (la scène garde le même nombre de lampes),
  // remplacées par une source qui suit l'objet
  DG.absorbLights = function (root, env) {
    if (!root || !env || !env.addSpot) return;
    const found = []; root.traverse(o => { if (o.isPointLight || o.isSpotLight) found.push(o); });
    found.forEach(l => { l.visible = false; env.addSpot(0, 0, 0, l.color.clone(), () => l.intensity * (l.parent && l.parent.visible === false ? 0 : 1), { obj: l, dist: l.distance || 15 }); });
  };
  // arrivée au premier étage (porte sud ouverte qui se referme)
  DG.arrive = function (S) {
    const env = S.env; env.S = S;
    const el = BR.$('#asc-flash'); if (el) { el.classList.add('dark'); setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.classList.remove('dark'), 400); }, 60); }
    const D = env.entrance;
    if (D) setTimeout(() => { if (BR.Arena.session() === S && S.env === env) D.set(false); }, 900);
    S.fighters.forEach(f => { f.sizeMul = f.sizeBase || f.sizeMul || 1; });
  };
})();

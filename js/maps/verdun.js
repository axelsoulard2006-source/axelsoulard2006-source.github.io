/* ===== maps/verdun.js : VERDUN, 1916 — champ de bataille de nuit, à ciel ouvert
   Niveau 0 = fond des tranchées (4 m sous le terrain), niveau 1 = surface (no man's land, arrières, village en ruine).
   Tranchées de tir en créneaux (pare-éclats / traverses), tranchée de soutien et de réserve, boyaux de communication
   en zigzag, sapes avancées vers des postes d'écoute, abris souterrains boisés, rampes de sortie, grand entonnoir de mine
   noyé d'eau. En surface : boue labourée par les obus, cratères, réseaux de barbelés et chevaux de frise, arbres morts,
   ruines d'un village (Fleury-devant-Douaumont), brouillard rampant et fusées éclairantes qui retombent lentement.
   Ton sobre : un décor, aucune violence montrée. Dépend de BR.CarteKit (maps/halle6.js).                       ===== */
(function () {
  const BR = window.BR, K = BR.CarteKit, Tx = BR.Tex, mk = K.mk;
  const C = 2, SH = 4, VOID = 0, FLOOR = 1, WALL = 2, RAMP = 3;
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* =====================================================================
     TEXTURES (128 px = 1 m ; murs : 512 px = 4 m de large × 4 m de haut)
     ===================================================================== */
  function bags(g, w, y0, y1, dark) {        // sacs de terre empilés en quinconce
    const bh = 26, bw = 72;
    for (let y = y0, r = 0; y < y1; y += bh, r++) for (let x = -(r % 2) * bw / 2 - 10; x < w + bw; x += bw) {
      const c = K.vary(dark ? '#4c4436' : '#5e5545', 0.16);
      g.fillStyle = 'rgba(28,22,15,0.8)'; g.beginPath(); g.ellipse(x + bw / 2, y + bh / 2 + 1.5, bw / 2, bh / 2, 0, 0, 7); g.fill();
      g.fillStyle = c; g.beginPath(); g.ellipse(x + bw / 2, y + bh / 2, bw / 2 - 2, bh / 2 - 2, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,240,200,0.05)'; g.beginPath(); g.ellipse(x + bw / 2, y + bh / 2 - 5, bw / 2 - 10, 3, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(30,25,15,0.2)'; g.lineWidth = 1; for (let k = 6; k < bw - 6; k += 4) { g.beginPath(); g.moveTo(x + k, y + 5); g.lineTo(x + k, y + bh - 5); g.stroke(); }
      if (Math.random() < 0.6) { g.fillStyle = 'rgba(50,38,26,0.55)'; g.beginPath(); g.ellipse(x + Math.random() * bw, y + bh * (0.3 + Math.random() * 0.5), 10 + Math.random() * 12, 4 + Math.random() * 4, 0, 0, 7); g.fill(); }
    }
  }
  function wattle(g, w, y0, y1) {            // clayonnage : branches tressées entre des piquets
    g.fillStyle = '#3e3022'; g.fillRect(0, y0, w, y1 - y0);
    for (let y = y0; y < y1; y += 9) {
      const ph = Math.floor((y - y0) / 9) % 2;
      for (let x = 0; x < w; x += 64) {
        g.strokeStyle = K.vary('#6b5236', 0.3); g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x - 4, y + 4 + (ph ? 2 : -1)); g.quadraticCurveTo(x + 32, y + 4 + (ph ? -3 : 3), x + 68, y + 4 + (ph ? 2 : -1)); g.stroke();
      }
    }
    for (let x = 0; x < w; x += 64) { g.fillStyle = '#2e2216'; g.fillRect(x - 6, y0 - 8, 12, y1 - y0 + 8); g.fillStyle = 'rgba(255,230,190,0.08)'; g.fillRect(x - 6, y0 - 8, 3, y1 - y0 + 8); }
  }
  function earth(g, x0, y0, w, h, base) {    // terre argileuse, cailloux, racines, coulures
    g.fillStyle = base || '#5b4b38'; g.fillRect(x0, y0, w, h);
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    for (let k = 0; k < 14; k++) { const x = x0 + Math.random() * w, y = y0 + Math.random() * h, r = 20 + Math.random() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${Math.random() < 0.5 ? '30,22,14' : '120,100,70'},0.18)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let k = 0; k < 120; k++) { g.fillStyle = K.vary(Math.random() < 0.4 ? '#6a6154' : '#3e3326', 0.25); const s = 1.5 + Math.random() * 4; g.beginPath(); g.ellipse(x0 + Math.random() * w, y0 + Math.random() * h, s, s * 0.7, Math.random() * 3, 0, 7); g.fill(); }
    for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(150,130,100,0.08)'; g.fillRect(x0 + Math.random() * w, y0 + Math.random() * h, 3, 2); }
    g.strokeStyle = 'rgba(35,26,16,0.55)'; for (let k = 0; k < 6; k++) { g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let x = x0 + Math.random() * w, y = y0 + Math.random() * h * 0.5; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 30; y += 8 + Math.random() * 14; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(20,15,8,0.12)'; for (let k = 0; k < 10; k++) { const x = x0 + Math.random() * w; g.fillRect(x, y0, 2 + Math.random() * 3, h * (0.3 + Math.random() * 0.7)); }
    g.restore();
  }
  function mudBottom(g, w, h, y0) {          // pied de mur boueux
    const gr = g.createLinearGradient(0, y0, 0, h); gr.addColorStop(0, 'rgba(40,30,20,0)'); gr.addColorStop(1, 'rgba(40,30,20,0.9)'); g.fillStyle = gr; g.fillRect(0, y0, w, h - y0);
  }
  Object.assign(Tx.MAKE, {
    // tranchée de tir française : sacs de terre en haut, clayonnage, boue au pied
    vd_tir: () => mk(512, 512, (g, w, h) => { earth(g, 0, 0, w, h); bags(g, w, 0, 190); wattle(g, w, 196, 470); mudBottom(g, w, h, 400); K.grain(g, w, h, 6); }),
    // boyau : planches et piquets en bas, terre nue au-dessus
    vd_boyau: () => mk(512, 512, (g, w, h) => {
      earth(g, 0, 0, w, h);
      for (let y = 230; y < 480; y += 30) { g.fillStyle = K.vary('#5d4630', 0.25); g.fillRect(0, y, w, 27); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 27, w, 3); g.fillStyle = 'rgba(255,230,190,0.07)'; g.fillRect(0, y, w, 3); }
      for (let x = 30; x < w; x += 128) { g.fillStyle = '#2e2216'; g.fillRect(x - 7, 200, 14, 290); }
      g.strokeStyle = 'rgba(70,70,70,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 250); for (let x = 0; x <= w; x += 64) g.lineTo(x, 250 + (x % 128 ? 6 : 0)); g.stroke();
      mudBottom(g, w, h, 420); K.grain(g, w, h, 6);
    }),
    // tôle ondulée et poteaux
    vd_tole: () => mk(512, 512, (g, w, h) => {
      earth(g, 0, 0, w, h); bags(g, w, 0, 110, true);
      for (let x = 0; x < w; x += 12) { const gr = g.createLinearGradient(x, 0, x + 12, 0); gr.addColorStop(0, '#3e3b36'); gr.addColorStop(0.5, '#56524b'); gr.addColorStop(1, '#3e3b36'); g.fillStyle = gr; g.fillRect(x, 150, 12, 330); }
      for (let k = 0; k < 26; k++) { const x = Math.random() * w, y = 150 + Math.random() * 250, gr = g.createLinearGradient(0, y, 0, y + 80 + Math.random() * 120); gr.addColorStop(0, 'rgba(105,58,28,0.3)'); gr.addColorStop(1, 'rgba(105,58,28,0)'); g.fillStyle = gr; g.fillRect(x, y, 4 + Math.random() * 14, 200); }
      K.blot(g, w, h, 8, '80,50,25', 0.08, 0.16, 20, 60);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 300, w, 3); for (let x = 60; x < w; x += 170) { g.fillStyle = '#2e2216'; g.fillRect(x, 140, 16, 350); }
      mudBottom(g, w, h, 420); K.grain(g, w, h, 6);
    }),
    vd_abri: () => mk(512, 512, (g, w, h) => {      // intérieur d'abri : cadres de bois et planches
      g.fillStyle = '#3a2c1e'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 22) { g.fillStyle = K.vary('#5a4430', 0.25); g.fillRect(0, y, w, 20); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, y + 20, w, 2); }
      for (let x = 0; x < w; x += 128) { g.fillStyle = '#2a1f14'; g.fillRect(x, 0, 22, h); g.fillStyle = 'rgba(255,230,190,0.07)'; g.fillRect(x, 0, 4, h); }
      g.fillStyle = '#2a1f14'; g.fillRect(0, 150, w, 18); K.grain(g, w, h, 6); mudBottom(g, w, h, 470);
    }),
    vd_beton: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#7d7b74'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 40) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, y, w, 2); }
      K.blot(g, w, h, 12, '30,28,20', 0.06, 0.16, 30, 120); K.blot(g, w, h, 6, '70,80,50', 0.05, 0.1, 30, 100);
      for (let k = 0; k < 8; k++) { g.strokeStyle = 'rgba(30,28,24,0.5)'; g.lineWidth = 1.5; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let s = 0; s < 5; s++) { x += (Math.random() - 0.5) * 50; y += Math.random() * 40; g.lineTo(x, y); } g.stroke(); }
      mudBottom(g, w, h, 430); K.grain(g, w, h, 7);
    }),
    vd_terreM: () => mk(512, 512, (g, w, h) => { earth(g, 0, 0, w, h, '#54463a'); mudBottom(g, w, h, 380); K.grain(g, w, h, 6); }),
    // sols
    vd_boue: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#4d4033'; g.fillRect(0, 0, w, h);
      K.blot(g, w, h, 40, '30,23,16', 0.12, 0.32, 15, 80); K.blot(g, w, h, 26, '104,90,70', 0.08, 0.2, 15, 70); K.blot(g, w, h, 10, '70,70,62', 0.06, 0.14, 20, 70);
      // mottes et ornières (taches allongées, pas de traits)
      for (let k = 0; k < 160; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(30,24,16,0.35)' : 'rgba(110,95,74,0.25)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 9, 2 + Math.random() * 4, Math.random() * 3, 0, 7); g.fill(); }
      for (let k = 0; k < 3; k++) { const x = Math.random() * w, y = Math.random() * h, rx = 10 + Math.random() * 22, ry = rx * (0.4 + Math.random() * 0.4); g.fillStyle = 'rgba(34,30,25,0.65)'; g.beginPath(); g.ellipse(x, y, rx, ry, Math.random() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(120,125,130,0.08)'; g.beginPath(); g.ellipse(x - rx * 0.2, y - ry * 0.2, rx * 0.5, ry * 0.3, 0, 0, 7); g.fill(); }
      for (let k = 0; k < 18; k++) { g.save(); g.translate(Math.random() * w, Math.random() * h); g.rotate(Math.random() * 3); g.fillStyle = K.vary('#3e3022', 0.3); g.fillRect(-8, -2, 10 + Math.random() * 18, 2 + Math.random() * 3); g.restore(); }
      for (let k = 0; k < 4000; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(140,120,95,0.08)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      K.grain(g, w, h, 6);
    }),
    vd_terre: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#52473a'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 20, '30,24,16', 0.1, 0.25, 20, 80); K.blot(g, w, h, 12, '100,92,70', 0.08, 0.16, 20, 70);
      for (let k = 0; k < 500; k++) { const x = Math.random() * w, y = Math.random() * h; g.strokeStyle = Math.random() < 0.6 ? 'rgba(120,110,80,0.5)' : 'rgba(80,75,55,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y - 4 - Math.random() * 6); g.stroke(); }
      K.grain(g, w, h, 8);
    }),
    vd_gravats: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#48433c'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 18, '28,24,18', 0.12, 0.28, 20, 80);
      for (let k = 0; k < 520; k++) { const s = 3 + Math.random() * 10; g.fillStyle = K.vary(BR.pick(['#6a645b', '#6f5444', '#5f5a53', '#7a7266', '#55493b']), 0.2); g.save(); g.translate(Math.random() * w, Math.random() * h); g.rotate(Math.random() * 3); g.fillRect(-s / 2, -s / 3, s, s * 0.7); g.restore(); }
      K.blot(g, w, h, 10, '40,34,26', 0.15, 0.3, 15, 50);
      K.grain(g, w, h, 8);
    }),
    vd_caillebotis: () => mk(256, 256, (g, w, h) => {      // caillebotis : lattes en travers sur deux longerons, boue entre
      g.fillStyle = '#3a3026'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 8, '60,66,70', 0.12, 0.25, 10, 40); K.blot(g, w, h, 6, '20,16,10', 0.2, 0.35, 10, 40);
      g.fillStyle = '#33281c'; g.fillRect(40, 0, 18, h); g.fillRect(w - 58, 0, 18, h);
      for (let y = 4; y < h; y += 16) { g.fillStyle = K.vary('#54442f', 0.22); g.fillRect(28, y, w - 56, 11); g.fillStyle = 'rgba(255,230,190,0.06)'; g.fillRect(28, y, w - 56, 2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(28, y + 11, w - 56, 2); g.fillStyle = 'rgba(40,32,22,0.55)'; if (Math.random() < 0.5) g.fillRect(28 + Math.random() * 120, y, 30 + Math.random() * 60, 11); }
      K.grain(g, w, h, 6);
    }),
    vd_fond: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#3b3128'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 8, '25,20,14', 0.15, 0.3, 15, 50); for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(30,36,40,0.85)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 30, 10 + Math.random() * 15, Math.random() * 3, 0, 7); g.fill(); } K.grain(g, w, h, 8); }),
    vd_plancher: () => mk(256, 256, (g, w, h) => { for (let y = 0; y < h; y += 32) { g.fillStyle = K.vary('#5a4430', 0.2); g.fillRect(0, y, w, 30); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y + 30, w, 2); } K.blot(g, w, h, 6, '30,22,14', 0.15, 0.3, 10, 40); K.grain(g, w, h, 6); }),
    vd_eau: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#1e2428'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 8, '60,70,70', 0.08, 0.2, 20, 70); for (let k = 0; k < 20; k++) { g.strokeStyle = 'rgba(150,160,165,0.12)'; g.lineWidth = 1; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 3 + Math.random() * 8, 0, 0, 7); g.stroke(); } }),
    vd_betonS: () => Tx.P.concrete('#6f6d66', true),
    vd_plafond: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#2a2016'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 42) { g.fillStyle = K.vary('#4e3a28', 0.25); g.fillRect(x, 0, 38, h); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + 38, 0, 4, h); } K.grain(g, w, h, 6); }),
    vd_bord: () => mk(256, 64, (g, w, h) => { earth(g, 0, 0, w, h, '#4e4134'); }),
    vd_marche: () => mk(128, 128, (g, w, h) => { earth(g, 0, 0, w, h, '#4e4134'); g.fillStyle = '#4b3a28'; g.fillRect(0, 0, w, 16); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 16, w, 4); }),
    vd_flanc: () => mk(256, 256, (g, w, h) => earth(g, 0, 0, w, h, '#4e4134')),
    vd_sacs: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#3a3226'; g.fillRect(0, 0, w, h); bags(g, w, 0, h); K.grain(g, w, h, 6); }),
    vd_pierre: () => mk(256, 256, (g, w, h) => {      // maçonnerie de moellons (murs du village)
      g.fillStyle = '#3c3833'; g.fillRect(0, 0, w, h);
      for (let y = 0, r = 0; y < h; y += 22 + (r % 3) * 4, r++) for (let x = -Math.random() * 40; x < w; ) { const sw = 26 + Math.random() * 34, sh = 16 + Math.random() * 8; g.fillStyle = K.vary(BR.pick(['#6e675d', '#665f56', '#746c61', '#5e574e']), 0.12); g.beginPath(); g.ellipse(x + sw / 2, y + sh / 2 + 2, sw / 2 - 2, sh / 2, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,245,225,0.06)'; g.fillRect(x + 4, y + 3, sw - 10, 3); x += sw + 2; }
      K.blot(g, w, h, 6, '20,18,14', 0.12, 0.25, 20, 60); K.grain(g, w, h, 8);
    }),
  });
  const ZF = { boue: 1, terre: 2, gravats: 3, caillebotis: 4, fond: 5, plancher: 6, eau: 7, beton: 8 };
  const ZW = { tir: 1, boyau: 2, tole: 3, abri: 4, beton: 5, terre: 6 };
  Tx.THEMES.verdun = {
    name: 'Verdun', fog: 0x1b1e22, fogDensity: 0.034, ambient: 0x4c5462, ambientI: 0.34, hemi: [0x7f8ea6, 0x2a2118, 0.4], exposure: 1.05,
    lightColor: 0xff9c50, panel: '#ffcf8a', flicker: 0.35, deadLights: 0.1, outdoor: true, sky: 0x101318, moon: 0x8a9cc0, lightI: 0.6, flashI: 0.85,
    tex: {
      floor: {
        0: { t: 'vd_boue', rep: [0.25, 0.25], rough: 0.85 }, 1: { t: 'vd_boue', rep: [0.25, 0.25], rough: 0.85 }, 2: { t: 'vd_terre', rep: [0.25, 0.25] }, 3: { t: 'vd_gravats', rep: [0.25, 0.25] },
        4: { t: 'vd_caillebotis', rough: 0.8, surf: 'wood' }, 5: { t: 'vd_fond', rough: 0.45, surf: 'mud' }, 6: { t: 'vd_plancher', surf: 'wood' }, 7: { t: 'vd_eau', rough: 0.12, metal: 0.1, surf: 'mud' }, 8: { t: 'vd_betonS' },
        40: { t: 'vd_sacs', rough: 0.95 }, 41: { t: 'vd_flanc' }, 42: { t: 'vd_pierre', rough: 0.95 },
      },
      wall: { 0: { t: 'vd_terreM' }, 1: { t: 'vd_tir' }, 2: { t: 'vd_boyau' }, 3: { t: 'vd_tole', metal: 0.2, rough: 0.7 }, 4: { t: 'vd_abri' }, 5: { t: 'vd_beton' }, 6: { t: 'vd_terreM' } },
      ci: { t: 'vd_plafond' }, co: { t: 'vd_plafond' }, e: { t: 'vd_bord' }, r: { t: 'vd_marche', surf: 'mud' }, rs: { t: 'vd_flanc' },
    },
  };

  /* =====================================================================
     GÉNÉRATEUR
     ===================================================================== */
  function genVerdun(def, seed, diff, rng, H) {
    const W = 60, Hh = 60, F = 2, ri = (a, b) => K.ri(rng, a, b);
    const m = H.newMap('verdun', def, W, Hh, F, seed);
    const T = (f, x, y) => (x < 0 || y < 0 || x >= W || y >= Hh) ? WALL : m.t[f][y * W + x];
    const V = { trenches: [], dugouts: [], saps: [], signs: [], crater: null, bunker: null, kind: new Uint8Array(W * Hh), lights: [] };
    m.vd = V;
    for (let i = 0; i < m.WH; i++) { m.t[0][i] = WALL; m.zone[0][i] = ZW.terre; m.t[1][i] = FLOOR; m.zone[1][i] = ZF.boue; }
    // arrières plus calmes (terre et herbe morte), village au nord
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (y >= 46) m.zone[1][i] = rng() < 0.75 ? ZF.terre : ZF.boue; if (y <= 11) m.zone[1][i] = ZF.gravats; }
    // creuse une case de tranchée ; kind : 1 tir, 2 boyau, 3 sape, 4 allemand
    const dig = (x, y, kind) => {
      if (x < 2 || y < 2 || x >= W - 2 || y >= Hh - 2) return;
      const i = y * W + x;
      if (m.t[0][i] !== FLOOR) { m.t[0][i] = FLOOR; m.t[1][i] = VOID; }
      m.zone[0][i] = kind === 2 || kind === 3 ? (rng() < 0.35 ? ZF.fond : ZF.caillebotis) : ZF.caillebotis;
      if (!V.kind[i] || kind === 1) V.kind[i] = kind;
    };
    const line = (pts, kind) => {         // chemin en L entre les points
      for (let k = 1; k < pts.length; k++) {
        let [x, y] = pts[k - 1]; const [x1, y1] = pts[k];
        dig(x, y, kind);
        while (x !== x1) { x += Math.sign(x1 - x); dig(x, y, kind); }
        while (y !== y1) { y += Math.sign(y1 - y); dig(x, y, kind); }
      }
    };
    // tranchée de tir en créneaux : alvéoles de tir et traverses
    const fireTrench = (Y, back, kind) => {
      const pts = [[3, Y]]; let x = 3;
      while (x < W - 6) { x += ri(3, 5); if (x > W - 4) x = W - 4; pts.push([x, Y]); if (x >= W - 5) break; pts.push([x, Y + back * 2]); x += 2; pts.push([x, Y + back * 2]); pts.push([x, Y]); }
      line(pts, kind); V.trenches.push({ Y, kind, back });
    };
    // tranchée sinueuse (soutien, réserve)
    const wavyTrench = (Y, kind) => {
      const pts = [[3, Y]]; let x = 3, y = Y;
      while (x < W - 4) { x = Math.min(W - 4, x + ri(3, 6)); pts.push([x, y]); y = BR.clamp(Y + ri(-1, 1), Y - 1, Y + 1); pts.push([x, y]); }
      line(pts, kind); V.trenches.push({ Y, kind });
    };
    const yR = ri(51, 53), yS = ri(43, 45), yF = ri(34, 36), yG = ri(16, 18);
    wavyTrench(yR, 2); wavyTrench(yS, 1); fireTrench(yF, 1, 1); fireTrench(yG, -1, 4);
    // boyaux de communication en zigzag
    const boyau = (x0, ya, yb, kind) => {
      let x = x0, y = ya; const pts = [[x, y]];
      while (y > yb) { const run = Math.min(y - yb, ri(2, 4)); y -= run; pts.push([x, y]); if (y > yb + 1 && rng() < 0.75) { x = BR.clamp(x + (rng() < 0.5 ? -1 : 1) * ri(1, 3), 4, W - 5); pts.push([x, y]); } }
      line(pts, kind);
    };
    const bx = [ri(7, 12), ri(24, 32), ri(44, 52)];
    for (const x of bx) boyau(x, yR, yF, 2);
    boyau(ri(16, 20), yS, yF, 2);
    // boyaux allemands vers le village (débouchent par une rampe)
    const gx = [ri(10, 20), ri(36, 48)];
    for (const x of gx) boyau(x, yG, 13, 4);
    // sapes vers le no man's land, postes d'écoute
    const saps = [ri(12, 22), ri(36, 46)];
    for (const sx of saps) { const len = ri(5, 7), top = yF - len; line([[sx, yF], [sx, top]], 3); line([[sx - 1, top], [sx + 1, top]], 3); V.saps.push({ x: sx, y: top }); }
    // grand entonnoir de mine dans le no man's land, relié à une sape
    const cx0 = ri(24, 30), cy0 = ri(23, 26), cr = { x0: cx0, y0: cy0, x1: cx0 + 4, y1: cy0 + 3 };
    for (let y = cr.y0; y <= cr.y1; y++) for (let x = cr.x0; x <= cr.x1; x++) { const i = y * W + x; m.t[0][i] = FLOOR; m.t[1][i] = VOID; m.zone[0][i] = ZF.eau; V.kind[i] = 5; }
    line([[cx0 + 2, cr.y1 + 1], [cx0 + 2, yF]], 3);
    V.crater = cr;
    // rampes de sortie : bout de tranchée qui remonte vers la surface (4 cases droites)
    const ramps = [];
    const tryRamp = (x, y, dx, dy) => {
      // couloir : 4 cases de terre plein, entourées de terre, arrivée en surface hors tranchée
      for (let k = 1; k <= 5; k++) {
        const cx = x + dx * k, cy = y + dy * k; if (cx < 3 || cy < 3 || cx >= W - 3 || cy >= Hh - 3) return false;
        if (T(0, cx, cy) !== WALL || T(1, cx, cy) !== FLOOR) return false;
        if (k <= 4) for (const s of [-1, 1]) if (T(0, cx + dy * s, cy + dx * s) !== WALL) return false;
      }
      if (T(0, x + dx * 6, y + dy * 6) !== WALL && T(1, x + dx * 6, y + dy * 6) !== FLOOR) return false;
      for (let k = 1; k <= 4; k++) { const cx = x + dx * k, cy = y + dy * k, i = cy * W + cx; m.t[0][i] = FLOOR; m.t[1][i] = VOID; m.zone[0][i] = ZF.fond; }
      if (!H.addRamp(m, 0, x + dx, y + dy, dx, dy, 4, { zone: ZF.fond })) { for (let k = 1; k <= 4; k++) { const i = (y + dy * k) * W + x + dx * k; m.t[0][i] = WALL; m.t[1][i] = FLOOR; } return false; }
      ramps.push({ x, y, dx, dy }); return true;
    };
    // rampe d'un entonnoir : le long de son bord nord
    if (!H.addRamp(m, 0, cr.x0 + 1, cr.y0, 1, 0, 4, { zone: ZF.fond })) {}
    const placeRamps = (cells, n, dirs) => {
      BR.shuffle(cells, rng); let got = 0;
      for (const [x, y] of cells) { if (got >= n) break; if (ramps.some(r => Math.abs(r.x - x) + Math.abs(r.y - y) < 8)) continue; for (const [dx, dy] of dirs) if (tryRamp(x, y, dx, dy)) { got++; break; } }
    };
    const cellsOf = test => { const a = []; for (let y = 2; y < Hh - 2; y++) for (let x = 2; x < W - 2; x++) if (m.t[0][y * W + x] === FLOOR && test(x, y)) a.push([x, y]); return a; };
    placeRamps(cellsOf((x, y) => Math.abs(y - yF) <= 2 && V.kind[y * W + x] === 1), 4, [[0, -1]]);
    placeRamps(cellsOf((x, y) => Math.abs(y - yS) <= 1), 3, [[0, -1], [0, 1]]);
    placeRamps(cellsOf((x, y) => Math.abs(y - yR) <= 1), 3, [[0, 1], [0, -1]]);
    placeRamps(cellsOf((x, y) => Math.abs(y - yG) <= 2 && V.kind[y * W + x] === 4), 4, [[0, 1], [0, -1]]);
    placeRamps(cellsOf((x, y) => y <= 14 && V.kind[y * W + x] === 4), 2, [[0, -1], [1, 0], [-1, 0]]);
    placeRamps(cellsOf((x, y) => V.kind[y * W + x] === 3), 2, [[1, 0], [-1, 0], [0, -1]]);
    V.ramps = ramps;
    // abris souterrains (sapes boisées) : salles couvertes à côté des tranchées
    const dugout = (x, y, dx, dy) => {
      // entrée en (x+dx, y+dy), salle de 3×2 au-delà
      const ex = x + dx, ey = y + dy, w = dx ? 2 : 3, h = dx ? 3 : 2;
      const ox = dx > 0 ? ex + 1 : dx < 0 ? ex - w : ex - 1, oy = dy > 0 ? ey + 1 : dy < 0 ? ey - h : ey - 1;
      for (let yy = oy - 1; yy <= oy + h; yy++) for (let xx = ox - 1; xx <= ox + w; xx++) if (T(0, xx, yy) !== WALL || T(1, xx, yy) !== FLOOR) return false;
      if (T(0, ex, ey) !== WALL || T(1, ex, ey) !== FLOOR) return false;
      for (const s of [-1, 1]) if (T(0, ex + dy * s, ey + dx * s) !== WALL) return false;
      const set0 = (xx, yy, z) => { const i = yy * W + xx; m.t[0][i] = FLOOR; m.zone[0][i] = z; m.indoor[0][i] = 1; m.indoor[1][i] = 0; };
      set0(ex, ey, ZF.plancher);
      for (let yy = oy; yy < oy + h; yy++) for (let xx = ox; xx < ox + w; xx++) set0(xx, yy, ZF.plancher);
      for (let yy = oy - 1; yy <= oy + h; yy++) for (let xx = ox - 1; xx <= ox + w; xx++) { const i = yy * W + xx; if (m.t[0][i] === WALL) m.zone[0][i] = ZW.abri; }
      for (const s of [-1, 1]) m.zone[0][(ey + dx * s) * W + ex + dy * s] = ZW.abri;
      V.dugouts.push({ x0: ox, y0: oy, x1: ox + w - 1, y1: oy + h - 1, ex, ey, dx, dy, tx: x, ty: y });
      return true;
    };
    let nd = 0;
    const tc = cellsOf((x, y) => V.kind[y * W + x] === 1 || V.kind[y * W + x] === 2 || V.kind[y * W + x] === 4); BR.shuffle(tc, rng);
    for (const [x, y] of tc) { if (nd >= 7) break; if (V.dugouts.some(d => Math.abs(d.tx - x) + Math.abs(d.ty - y) < 9)) continue; const dirs = BR.shuffle(D4.slice(), rng); for (const [dx, dy] of dirs) if (dugout(x, y, dx, dy)) { nd++; break; } }
    // zones de murs selon le type de tranchée
    for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (m.t[0][i] !== WALL || m.zone[0][i] === ZW.abri) continue;
      let k = 0; for (const [dx, dy] of D4) { const j = (y + dy) * W + x + dx; if (m.t[0][j] !== WALL && V.kind[j]) k = Math.max(k, V.kind[j]); }
      m.zone[0][i] = k === 1 ? (rng() < 0.82 ? ZW.tir : ZW.tole) : k === 4 ? (rng() < 0.7 ? ZW.boyau : ZW.tole) : k === 2 ? (rng() < 0.85 ? ZW.boyau : ZW.tole) : ZW.terre;
    }
    // chaque morceau de tranchée doit avoir une rampe (sinon : piège -> rebouché)
    const comp = new Int32Array(m.WH).fill(-1); let nc = 0;
    for (let i = 0; i < m.WH; i++) {
      if (comp[i] >= 0 || (m.t[0][i] !== FLOOR && m.t[0][i] !== RAMP)) continue;
      const st = [i], cells = []; comp[i] = nc; let hasRamp = false;
      while (st.length) { const c = st.pop(); cells.push(c); if (m.t[0][c] === RAMP) hasRamp = true; const x = c % W, y = (c / W) | 0; for (const [dx, dy] of D4) { const j = (y + dy) * W + x + dx; if (comp[j] < 0 && (m.t[0][j] === FLOOR || m.t[0][j] === RAMP)) { comp[j] = nc; st.push(j); } } }
      if (!hasRamp) {
        let ok = false; BR.shuffle(cells, rng);
        for (const c of cells) { for (const [dx, dy] of D4) if (tryRamp(c % W, (c / W) | 0, dx, dy)) { ok = true; break; } if (ok) break; }
        if (!ok) for (const c of cells) { m.t[0][c] = WALL; m.t[1][c] = FLOOR; m.indoor[0][c] = 0; }
      }
      nc++;
    }
    // départ : tranchée de réserve ; sortie : porte d'un blockhaus dans la première ligne allemande
    const sp = cellsOf((x, y) => Math.abs(y - yR) <= 1 && Math.abs(x - W / 2) < 10 && m.rampAt[0][y * W + x] < 0).sort((a, b) => Math.abs(a[0] - W / 2) - Math.abs(b[0] - W / 2))[0];
    if (!sp) return null;
    m.spawn = { f: 0, cx: sp[0], cy: sp[1] };
    const ex = cellsOf((x, y) => V.kind[y * W + x] === 4 && y <= yG + 2 && m.rampAt[0][y * W + x] < 0 && T(0, x, y - 1) === WALL && T(0, x - 1, y - 1) === WALL && T(0, x + 1, y - 1) === WALL && T(1, x, y - 1) === FLOOR)
      .filter(([x, y]) => !V.dugouts.some(d => Math.abs(d.ex - x) + Math.abs(d.ey - y) < 3) && !ramps.some(r => Math.abs(r.x - x) + Math.abs(r.y - y) < 3));
    if (!ex.length) return null;
    ex.sort((a, b) => Math.abs(b[0] - sp[0]) - Math.abs(a[0] - sp[0]));
    const e = ex[Math.floor(rng() * Math.min(4, ex.length))];
    m.exit = { cx: e[0], cy: e[1], dx: 0, dy: -1 };
    for (const dx of [-1, 0, 1]) m.zone[0][(e[1] - 1) * W + e[0] + dx] = ZW.beton;
    V.bunker = { x: e[0], y: e[1] - 1 };
    // ---- objets : banquettes de tir, barbelés, arbres morts, ruines ----
    obstacles(m, H, rng, { yF, yG, yS, yR });
    if (!H.finalize(m, rng, diff)) return null;
    // éclairage : lanternes dans les tranchées et les abris, braseros
    const lantern = (x, y, px, pz, ly, deco) => { const r = rng(); m.lights.push({ f: 0, cx: x, cy: y, y: ly, kind: 'lamp', px, pz, dead: r < 0.08, flicker: r < 0.55, phase: rng() * 100, deco }); };
    for (const d of V.dugouts) lantern(d.x0, d.y0, ((d.x0 + d.x1 + 1) / 2) * C, ((d.y0 + d.y1 + 1) / 2) * C, 2.15, 'abri');
    const tl = cellsOf((x, y) => (V.kind[y * W + x] === 1 || V.kind[y * W + x] === 2) && m.t[0][y * W + x] === FLOOR && m.propAt[0][y * W + x] < 0); BR.shuffle(tl, rng);
    const lit = [];
    for (const [x, y] of tl) {
      if (lit.length >= 16) break; if (lit.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) < 9)) continue;
      const w = D4.find(([dx, dy]) => T(0, x + dx, y + dy) === WALL); if (!w) continue;
      lit.push([x, y]); lantern(x, y, (x + 0.5) * C + w[0] * 0.72, (y + 0.5) * C + w[1] * 0.72, 2.3, 'poteau');
    }
    const gl = cellsOf((x, y) => V.kind[y * W + x] === 4 && m.propAt[0][y * W + x] < 0); BR.shuffle(gl, rng);
    for (let k = 0, n = 0; k < gl.length && n < 3; k++) { const [x, y] = gl[k]; const w = D4.find(([dx, dy]) => T(0, x + dx, y + dy) === WALL); if (!w || Math.abs(x - e[0]) + Math.abs(y - e[1]) < 4) continue; lantern(x, y, (x + 0.5) * C + w[0] * 0.72, (y + 0.5) * C + w[1] * 0.72, 2.3, 'poteau'); n++; }
    lantern(e[0], e[1], (e[0] + 0.5) * C + 1.0, (e[1] + 0.5) * C - 0.75, 2.5, 'bunker');
    return m;
  }

  function obstacles(m, H, rng, L) {
    const W = m.W, V = m.vd, ri = (a, b) => K.ri(rng, a, b);
    const T = (f, x, y) => (x < 0 || y < 0 || x >= W || y >= m.H) ? WALL : m.t[f][y * W + x];
    const surf = (x, y) => { if (x < 1 || y < 1 || x >= W - 1 || y >= m.H - 1) return false; const i = y * W + x; return m.t[1][i] === FLOOR && m.t[0][i] === WALL && m.propAt[1][i] < 0 && !m.ramps.some(r => r.landing === i); };
    const nearTrench = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (T(1, x + dx, y + dy) === VOID) return true; return false; };
    const nearRamp = (x, y, r) => m.ramps.some(q => { const lx = q.landing % W, ly = (q.landing / W) | 0; return Math.abs(lx - x) <= r && Math.abs(ly - y) <= r; });
    const nearSpawn = (x, y) => Math.abs(x - m.spawn.cx) + Math.abs(y - m.spawn.cy) <= 4;
    // banquettes de tir le long du parapet des tranchées de tir (marche de 45 cm)
    for (let y = 2; y < m.H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x; if (m.t[0][i] !== FLOOR || (V.kind[i] !== 1 && V.kind[i] !== 4) || m.propAt[0][i] >= 0 || m.rampAt[0][i] >= 0 || nearSpawn(x, y)) continue;
      if (m.ramps.some(r => r.approach === i)) continue;
      const front = V.kind[i] === 1 ? -1 : 1;    // côté ennemi
      if (T(0, x, y + front) !== WALL || T(0, x - 1, y) !== FLOOR && T(0, x + 1, y) !== FLOOR) continue;
      if (T(0, x, y - front) !== WALL) continue;    // seulement dans les alvéoles d'une case de large
      if ((x === m.exit.cx && y === m.exit.cy)) continue;
      K.solid(m, H, 0, x, y, 'banquette', 0.45, 2, 0.55, { oz: front * 0.72, v: front });
    }
    // réseaux de barbelés devant les premières lignes, avec des passages
    const wireRow = (y0, y1) => {
      let gap = ri(2, 5);
      for (let x = 2; x < W - 2; x++) {
        if (--gap <= 0) { gap = ri(5, 9); x += ri(1, 2); continue; }
        const y = ri(y0, y1);
        if (!surf(x, y) || nearRamp(x, y, 1) || nearTrench(x, y, 1)) continue;
        K.solid(m, H, 1, x, y, rng() < 0.82 ? 'barbele' : 'frise', 1.25, 2, 0.9, { v: ri(0, 1000) });
      }
    };
    wireRow(L.yF - 5, L.yF - 3); wireRow(L.yG + 3, L.yG + 5);
    for (let k = 0; k < 18; k++) { const x = ri(3, W - 4), y = ri(L.yG + 6, L.yF - 6); if (surf(x, y) && !nearRamp(x, y, 2) && !nearTrench(x, y, 1)) K.solid(m, H, 1, x, y, rng() < 0.7 ? 'barbele' : 'frise', 1.25, 2, 0.9, { v: ri(0, 1000) }); }
    // arbres morts
    for (let k = 0, n = 0; k < 400 && n < 34; k++) { const x = ri(2, W - 3), y = ri(2, m.H - 3); if (!surf(x, y) || nearTrench(x, y, 1) || nearRamp(x, y, 1)) continue; K.solid(m, H, 1, x, y, 'arbre', 3 + rng() * 6, 0.7, 0.7, { v: ri(0, 1000), ox: (rng() - 0.5) * 0.8, oz: (rng() - 0.5) * 0.8 }); n++; }
    // ruines du village (au nord, derrière les lignes allemandes)
    V.houses = [];
    const house = (x0, y0, w, h, church) => {
      for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) if (!surf(x, y) || nearRamp(x, y, 1)) return false;
      const isWall = (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h && (x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1);
      const gaps = new Set(); for (let k = 0; k < (church ? 3 : 2); k++) { const s = ri(0, 3), t = s < 2 ? ri(x0 + 1, x0 + w - 2) : ri(y0 + 1, y0 + h - 2); gaps.add(s === 0 ? t + ',' + y0 : s === 1 ? t + ',' + (y0 + h - 1) : s === 2 ? x0 + ',' + t : (x0 + w - 1) + ',' + t); }
      const hb = church ? 3.5 : 1.6;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        if (!isWall(x, y) || gaps.has(x + ',' + y)) continue;
        // bras du mur vers les voisins (pour une boîte de collision qui suit le mur)
        const e = isWall(x + 1, y) && !gaps.has((x + 1) + ',' + y), wv = isWall(x - 1, y) && !gaps.has((x - 1) + ',' + y), s = isWall(x, y + 1) && !gaps.has(x + ',' + (y + 1)), n = isWall(x, y - 1) && !gaps.has(x + ',' + (y - 1));
        const t = 0.3, X0 = wv ? -1 : -t, X1 = e ? 1 : t, Z0 = n ? -1 : -t, Z1 = s ? 1 : t;
        const hgt = hb + rng() * (church ? 4.5 : 2.4);
        K.solid(m, H, 1, x, y, 'ruine', hgt, X1 - X0, Z1 - Z0, { ox: (X0 + X1) / 2, oz: (Z0 + Z1) / 2, data: { e, w: wv, s, n, church: !!church }, v: ri(0, 1000) });
      }
      for (let k = 0; k < (church ? 6 : 3); k++) { const x = ri(x0 + 1, x0 + w - 2), y = ri(y0 + 1, y0 + h - 2); if (surf(x, y)) K.solid(m, H, 1, x, y, 'gravats', 0.45, 1.9, 1.9, { v: ri(0, 1000) }); }
      V.houses.push({ x0, y0, w, h, church: !!church });
      return true;
    };
    let placed = 0;
    for (let k = 0; k < 60 && !V.houses.some(h => h.church); k++) house(ri(18, 36), ri(2, 5), 6, 7, true);
    for (let k = 0; k < 300 && placed < 9; k++) { const w = ri(3, 5), h = ri(3, 4); if (house(ri(2, W - 3 - w), ri(2, 12 - h), w, h, false)) placed++; }
    for (let k = 0; k < 4; k++) { const w = 3, h = 3, x = ri(3, W - 7), y = ri(L.yR + 3, m.H - 6); house(x, y, w, h, false); }
    // caisses, tonneaux dans les tranchées (contre les parois)
    let nb = 0;
    for (let k = 0; k < 600 && nb < 26; k++) {
      const x = ri(3, W - 4), y = ri(3, m.H - 4), i = y * W + x;
      if (m.t[0][i] !== FLOOR || m.propAt[0][i] >= 0 || m.rampAt[0][i] >= 0 || nearSpawn(x, y) || m.ramps.some(r => r.approach === i) || (x === m.exit.cx && y === m.exit.cy) || V.dugouts.some(d => d.ex === x && d.ey === y)) continue;
      const w = D4.filter(([dx, dy]) => T(0, x + dx, y + dy) === WALL); if (w.length !== 2 || (w[0][0] === -w[1][0] && w[0][1] === -w[1][1]) === false) { if (!(m.indoor[0][i] && w.length >= 1)) continue; }
      const side = w[0];
      K.solid(m, H, 0, x, y, BR.pick(['caisse', 'caisse', 'tonneau', 'outils'], rng), 0.5, side[0] ? 0.7 : 1.6, side[0] ? 1.6 : 0.7, { ox: side[0] * 0.6, oz: side[1] * 0.6, v: ri(0, 1000) });
      nb++;
    }
  }

  /* =====================================================================
     DÉCOR
     ===================================================================== */
  function decorVerdun(m, B, inst, rng, H, group) {
    const W = m.W, V = m.vd, PB = B('p'), col = K.col;
    const T = (f, x, y) => (x < 0 || y < 0 || x >= W || y >= m.H) ? (f ? FLOOR : WALL) : m.t[f][y * W + x];
    const wood = col('#5a4430'), woodD = col('#3a2c1e'), sand = col('#6e604a');
    // ---- parapets de sacs de terre sur les lèvres des tranchées (cachent la tranche du terrain) ----
    const BAG = B('f40'), TOP = B('f1');
    // rangée de sacs : flancs en sacs de terre, dessus en terre (bombé)
    const bagRow = (x0, z0, x1, z1, y0, h) => {
      const y1 = y0 + h, along = x1 - x0 > z1 - z0, L = along ? x1 - x0 : z1 - z0, u = s => [[0, 0], [L * 0.5, 0], [L * 0.5, h * 0.5], [0, h * 0.5]];
      if (along) { K.face(BAG, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0.95, [0, 0, 1], u()); K.face(BAG, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0.95, [0, 0, -1], u()); }
      else { K.face(BAG, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 0.95, [1, 0, 0], u()); K.face(BAG, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 0.95, [-1, 0, 0], u()); }
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, yt = y1 + 0.06;
      if (along) { K.face(TOP, [x0, y1, z0], [x1, y1, z0], [x1, yt, mz], [x0, yt, mz], 0.7, [0, 1, -0.3]); K.face(TOP, [x0, yt, mz], [x1, yt, mz], [x1, y1, z1], [x0, y1, z1], 0.7, [0, 1, 0.3]); }
      else { K.face(TOP, [x0, y1, z0], [mx, yt, z0], [mx, yt, z1], [x0, y1, z1], 0.7, [-0.3, 1, 0]); K.face(TOP, [mx, yt, z0], [x1, y1, z0], [x1, y1, z1], [mx, yt, z1], 0.7, [0.3, 1, 0]); }
    };
    for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (m.t[1][i] !== FLOOR) continue;
      for (const [dx, dy] of D4) {
        if (T(1, x + dx, y + dy) !== VOID) continue;
        const ramp = m.t[0][(y + dy) * W + x + dx] === RAMP;
        const X0 = x * C, Z0 = y * C, e = 0.12, d = 0.42, hh = ramp ? 0.15 : 0.26 + ((x * 7 + y * 13) % 5) * 0.035;
        if (dx === 1) bagRow(X0 + C - d, Z0, X0 + C + e, Z0 + C, SH - 0.35, hh + 0.35);
        else if (dx === -1) bagRow(X0 - e, Z0, X0 + d, Z0 + C, SH - 0.35, hh + 0.35);
        else if (dy === 1) bagRow(X0, Z0 + C - d, X0 + C, Z0 + C + e, SH - 0.35, hh + 0.35);
        else bagRow(X0, Z0 - e, X0 + C, Z0 + d, SH - 0.35, hh + 0.35);
      }
    }
    // ---- piquets de soutènement le long des parois (tous les mètres) ----
    for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (m.t[0][i] !== FLOOR || m.indoor[0][i]) continue;
      for (const [dx, dy] of D4) {
        const j = (y + dy) * W + x + dx; if (m.t[0][j] !== WALL || m.zone[0][j] === 5) continue;
        for (const t of [0.5, 1.5]) {
          const px = dx ? x * C + (dx > 0 ? C - 0.07 : 0.07) : x * C + t, pz = dy ? y * C + (dy > 0 ? C - 0.07 : 0.07) : y * C + t;
          K.box(PB, px - 0.06, 0, pz - 0.06, px + 0.06, 3.0 + ((x + y + t * 2) % 3) * 0.15, pz + 0.06, (x + y) % 2 ? wood : woodD);
        }
      }
    }
    // ---- abris : poutres du plafond bas, couchettes, table, poêle, rideau anti-gaz ----
    for (const d of V.dugouts) {
      const X0 = d.x0 * C, X1 = (d.x1 + 1) * C, Z0 = d.y0 * C, Z1 = (d.y1 + 1) * C, along = X1 - X0 > Z1 - Z0;
      K.face(B('f6'), [X0, 2.35, Z0], [X1, 2.35, Z0], [X1, 2.35, Z1], [X0, 2.35, Z1], 0.8, [0, -1, 0], 0.5);    // plafond de rondins (cache la dalle haute)
      if (along) for (let x = X0 + 0.5; x < X1; x += 1.0) K.box(PB, x - 0.11, 2.12, Z0, x + 0.11, 2.35, Z1, woodD);
      else for (let z = Z0 + 0.5; z < Z1; z += 1.0) K.box(PB, X0, 2.12, z - 0.11, X1, 2.35, z + 0.11, woodD);
      // couchettes superposées contre le mur du fond
      const bx0 = along ? X0 + 0.2 : X1 - 0.95, bz0 = along ? Z1 - 0.95 : Z0 + 0.2, bx1 = along ? X1 - 0.6 : X1 - 0.2, bz1 = along ? Z1 - 0.2 : Z1 - 0.6;
      for (const yy of [0.45, 1.3]) { K.box(PB, bx0, yy, bz0, bx1, yy + 0.08, bz1, wood); K.box(PB, bx0 + 0.05, yy + 0.08, bz0 + 0.05, bx1 - 0.05, yy + 0.18, bz1 - 0.05, col('#5c5a4a')); }
      for (const [px, pz] of [[bx0, bz0], [bx1, bz0], [bx0, bz1], [bx1, bz1]]) K.box(PB, px - 0.04, 0, pz - 0.04, px + 0.04, 1.6, pz + 0.04, woodD);
      // petite table, banc, bougie
      const tx = along ? X0 + (X1 - X0) * 0.6 : X0 + 0.7, tz = along ? Z0 + 0.7 : Z0 + (Z1 - Z0) * 0.6;
      K.box(PB, tx - 0.45, 0.72, tz - 0.3, tx + 0.45, 0.78, tz + 0.3, wood); for (const [a, b] of [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]]) K.box(PB, tx + a - 0.03, 0, tz + b - 0.03, tx + a + 0.03, 0.72, tz + b + 0.03, woodD);
      K.cyl(PB, [tx + 0.2, 0.78, tz], [tx + 0.2, 0.86, tz], 0.04, 6, col('#3a3a36'), true); K.cyl(PB, [tx + 0.2, 0.86, tz], [tx + 0.2, 0.93, tz], 0.012, 5, col('#e8dfc8'), true);
      // poêle et son tuyau
      const sx = along ? X1 - 0.5 : X0 + 0.5, sz = along ? Z0 + 0.5 : Z1 - 0.5;
      K.cyl(PB, [sx, 0, sz], [sx, 0.7, sz], 0.22, 10, col('#2a2a28'), true); K.cyl(PB, [sx, 0.7, sz], [sx, 2.35, sz], 0.06, 8, col('#2f2f2c'));
      K.cyl(B('glow'), [sx + 0.0, 0.25, sz + 0.0], [sx, 0.35, sz], 0.226, 10, [1, 0.45, 0.15]);
      // rideau de couverture à l'entrée
      const ex = (d.ex + 0.5) * C, ez = (d.ey + 0.5) * C;
      if (d.dx) K.box(PB, ex - 0.02, 0.15, ez - 0.95, ex + 0.02, 2.2, ez - 0.35, col('#4b4636')); else K.box(PB, ex - 0.95, 0.15, ez - 0.02, ex - 0.35, 2.2, ez + 0.02, col('#4b4636'));
      // cadre de l'entrée
      const fr = [[ex - 0.9, ez - 0.9], [ex + 0.9, ez + 0.9]];
      // passage : coffrage de planches + cadres de rondins à chaque bout
      const AB = B('w4i'), pl = (a, b2, out) => { const L = Math.hypot(b2[0] - a[0], b2[2] - a[2]); K.face(AB, [a[0], 0, a[2]], [b2[0], 0, b2[2]], [b2[0], 2.45, b2[2]], [a[0], 2.45, a[2]], 0.75, out, [[0, 0], [L / 4, 0], [L / 4, 0.61], [0, 0.61]]); };
      if (d.dx) { pl([ex - 1, 0, ez - 0.99], [ex + 1, 0, ez - 0.99], [0, 0, 1]); pl([ex - 1, 0, ez + 0.99], [ex + 1, 0, ez + 0.99], [0, 0, -1]); for (const xx of [ex - 0.92, ex + 0.92]) { for (const z of [ez - 0.92, ez + 0.92]) K.box(PB, xx - 0.09, 0, z - 0.09, xx + 0.09, 2.3, z + 0.09, woodD); K.box(PB, xx - 0.1, 2.2, ez - 1.0, xx + 0.1, 2.45, ez + 1.0, woodD); } }
      else { pl([ex - 0.99, 0, ez - 1], [ex - 0.99, 0, ez + 1], [1, 0, 0]); pl([ex + 0.99, 0, ez - 1], [ex + 0.99, 0, ez + 1], [-1, 0, 0]); for (const zz of [ez - 0.92, ez + 0.92]) { for (const x of [ex - 0.92, ex + 0.92]) K.box(PB, x - 0.09, 0, zz - 0.09, x + 0.09, 2.3, zz + 0.09, woodD); K.box(PB, ex - 1.0, 2.2, zz - 0.1, ex + 1.0, 2.45, zz + 0.1, woodD); } }
      K.face(B('f6'), [ex - 1, 2.45, ez - 1], [ex + 1, 2.45, ez - 1], [ex + 1, 2.45, ez + 1], [ex - 1, 2.45, ez + 1], 0.7, [0, -1, 0], 0.5);
    }
    // ---- blockhaus allemand (sortie) : façade béton, meurtrière, chicane de sacs ----
    if (V.bunker) {
      const bxc = (V.bunker.x + 0.5) * C, bz = (V.bunker.y + 1) * C;
      K.box(PB, bxc - 3.2, SH - 0.1, bz - 3.5, bxc + 3.2, SH + 1.1, bz + 0.15, col('#6f6d66'));
      K.box(PB, bxc - 1.2, SH + 0.45, bz - 3.55, bxc + 1.2, SH + 0.7, bz - 3.45, col('#141414'));
      K.box(PB, bxc - 3.0, SH + 1.1, bz - 3.3, bxc + 3.0, SH + 1.35, bz - 0.1, col('#4a4c3e'));
    }
    // ---- objets (props invisibles dessinés ici) ----
    for (const p of m.props) if (p.sub) drawProp(p, B, PB, inst, H, group);
    // ---- surface : cratères d'obus (bourrelets de terre + flaques), souches, débris ----
    const R2 = BR.rngFrom((m.seed ^ 0x51ed27) >>> 0), WATER = B('f7'), MUD = B('f2');
    const freeSurf = (x, y) => { const cx = Math.floor(x / C), cy = Math.floor(y / C); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (T(1, cx + dx, cy + dy) !== FLOOR) return false; const i = (cy + dy) * W + cx + dx; if (i >= 0 && i < m.WH && m.propAt[1][i] >= 0) return false; } return true; };
    // cratère : bourrelet de terre rejetée (anneau irrégulier) autour d'une flaque boueuse irrégulière
    const crater = (x, z, r, Bf) => {
      const n = 16, jit = []; for (let k = 0; k <= n; k++) jit.push(k === n ? jit[0] : 0.8 + R2() * 0.4);
      const P = (k, rr, y) => { const a = k / n * 6.283; return [x + Math.cos(a) * rr * jit[k], y, z + Math.sin(a) * rr * jit[k]]; };
      const hR = 0.14 + R2() * 0.14, wet = R2() < 0.7;
      for (let k = 0; k < n; k++) {
        K.face(Bf, P(k, r * 0.92, SH + 0.02), P(k + 1, r * 0.92, SH + 0.02), P(k + 1, r * 1.15, SH + hR), P(k, r * 1.15, SH + hR), [0.62, 0.6, 0.57], [0, 1, 0], 0.5);
        K.face(Bf, P(k, r * 1.15, SH + hR), P(k + 1, r * 1.15, SH + hR), P(k + 1, r * 1.6, SH + 0.004), P(k, r * 1.6, SH + 0.004), [0.85, 0.83, 0.8], [0, 1, 0], 0.5);
      }
      const inner = wet ? WATER : Bf, ci = wet ? 1 : [0.5, 0.48, 0.45];
      for (let k = 0; k < n; k += 2) K.face(inner, [x, SH + 0.022, z], P(k, r * 0.95, SH + 0.022), P(k + 1, r * 0.95, SH + 0.022), P(k + 2, r * 0.95, SH + 0.022), ci, [0, 1, 0], 0.25);
    };
    for (let k = 0; k < 150; k++) { const x = 4 + R2() * (W * C - 8), z = 4 + R2() * (m.H * C - 8), r = 0.7 + R2() * 1.3; if (freeSurf(x, z)) crater(x, z, r, B('f1')); }
    // débris : planches, roues, souches
    for (let k = 0; k < 90; k++) {
      const x = 2 + R2() * (W * C - 4), z = 2 + R2() * (m.H * C - 4); if (!freeSurf(x, z)) continue;
      const t = R2();
      if (t < 0.45) K.rbox(PB, x, z, R2() * 6, -0.6 - R2() * 0.6, SH, -0.1, 0.6 + R2() * 0.6, SH + 0.05, 0.1, R2() < 0.5 ? '#5a4632' : '#4a3a28');
      else if (t < 0.75) { const h = 0.3 + R2() * 0.7; K.cyl(B('bark'), [x, SH - 0.1, z], [x + (R2() - 0.5) * 0.2, SH + h, z], 0.18 + R2() * 0.12, 7, col('#3a3026'), true, 0.1); }
      else if (t < 0.85) { const a = R2() * 6; K.cyl(PB, [x, SH + 0.05, z], [x + Math.cos(a) * 0.08, SH + 0.13, z + Math.sin(a) * 0.08], 0.55, 12, col('#4a3a28'), true); }
      else K.rbox(PB, x, z, R2() * 6, -0.3, SH, -0.25, 0.3, SH + 0.35, 0.25, '#4f4535');
    }
    // ---- au-delà des limites : terrain dévasté, barbelés, arbres morts, ruines lointaines ----
    const Wm = W * C, Hm = m.H * C, G = B('f1');
    const quad = (Bf, x0, z0, x1, z1, y) => K.face(Bf, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], 1, [0, 1, 0], 0.5);
    quad(G, -120, -120, Wm + 120, 0, SH); quad(G, -120, Hm, Wm + 120, Hm + 120, SH); quad(G, -120, 0, 0, Hm, SH); quad(G, Wm, 0, Wm + 120, Hm, SH);
    for (let k = 0; k < 120; k++) { const side = k % 4, t = R2() * (side < 2 ? Wm + 60 : Hm + 60) - 30, d = 3 + R2() * 60; const x = side === 2 ? -d : side === 3 ? Wm + d : t, z = side === 0 ? -d : side === 1 ? Hm + d : t; crater(x, z, 0.8 + R2() * 2.2, MUD); }
    for (let k = 0; k < 70; k++) { const side = k % 4, t = R2() * (side < 2 ? Wm + 80 : Hm + 80) - 40, d = 4 + R2() * 70; const x = side === 2 ? -d : side === 3 ? Wm + d : t, z = side === 0 ? -d : side === 1 ? Hm + d : t; deadTree(B, PB, x, SH, z, 3 + R2() * 8, R2, col); }
    // barbelés de ceinture tout autour (juste au-delà du bord)
    const WB = H.Buf();
    const wireLine = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.4); for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; picket(PB, x, SH, z, 1.3, R2, col); } wires(WB, ax, az, bx, bz, SH, R2); };
    wireLine(-0.8, -0.8, Wm + 0.8, -0.8); wireLine(-0.8, Hm + 0.8, Wm + 0.8, Hm + 0.8); wireLine(-0.8, -0.8, -0.8, Hm + 0.8); wireLine(Wm + 0.8, -0.8, Wm + 0.8, Hm + 0.8);
    wireLine(-3.5, -3.5, Wm + 3.5, -3.5); wireLine(-3.5, Hm + 3.5, Wm + 3.5, Hm + 3.5); wireLine(-3.5, -3.5, -3.5, Hm + 3.5); wireLine(Wm + 3.5, -3.5, Wm + 3.5, Hm + 3.5);
    for (const p of m.props) if (p.sub === 'barbele' || p.sub === 'frise') { const L = p.x0, R = p.x1; wires(WB, L, p.z - 0.25, R, p.z + 0.25, SH, R2); wires(WB, L, p.z + 0.25, R, p.z - 0.25, SH, R2); }
    const wm = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x4a4640).convertSRGBToLinear(), roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide });
    K.addMesh(group, WB, wm);
    // ruines lointaines (silhouettes de murs dans le brouillard)
    for (let k = 0; k < 16; k++) { const a = R2() * 6.283, d = 75 + R2() * 40, x = Wm / 2 + Math.cos(a) * d, z = Hm / 2 + Math.sin(a) * d; for (let j = 0; j < 3; j++) { const ry = a + j * 1.57 + (R2() - 0.5) * 0.3; for (let s = -2; s <= 2; s++) K.rbox(B('f42'), x + Math.cos(ry) * s * 1.2, z - Math.sin(ry) * s * 1.2, ry, -0.6, SH - 0.1, -0.3, 0.6, SH + 0.6 + R2() * (s === 0 ? 4 : 2.2), 0.3, [0.7, 0.68, 0.65]); } }
    // ---- panneaux de bois (noms des tranchées) ----
    const S = K.signs(), sg = { bg: '#5b4630', fg: '#e8dcc0', font: "Georgia, 'Times New Roman', serif", border: false, weight: 700 };
    const signAt = (x, y, text, sub) => {
      const w = D4.find(([dx, dy]) => T(0, x + dx, y + dy) === WALL); if (!w) return;
      const px = (x + 0.5) * C + w[0] * 0.95, pz = (y + 0.5) * C + w[1] * 0.95;
      S.add(Object.assign({ text, sub, w: 1.2, h: 0.32, x: px - w[0] * 0.03, y: 2.1, z: pz - w[1] * 0.03, ry: Math.atan2(-w[0], -w[1]) }, sg));
      K.box(PB, px - 0.62 * Math.abs(w[1]) - 0.03, 1.92, pz - 0.62 * Math.abs(w[0]) - 0.03, px + 0.62 * Math.abs(w[1]) + 0.03, 2.28, pz + 0.62 * Math.abs(w[0]) + 0.03, woodD);
    };
    const tr = V.trenches;
    const firstCell = (test) => { for (let k = 0; k < 400; k++) { const x = K.ri(R2, 4, W - 5), y = K.ri(R2, 3, m.H - 4), i = y * W + x; if (m.t[0][i] === FLOOR && !m.indoor[0][i] && test(x, y, i)) return [x, y]; } return null; };
    const names = [['TRANCHÉE DE RÉSERVE', 'Vers l\'arrière'], ['TRANCHÉE DE SOUTIEN', null], ['1re LIGNE', 'Silence'], ['BOYAU DE LA REDOUTE', 'Vers la 1re ligne'], ['BOYAU DES ZOUAVES', null], ['POSTE DE SECOURS', null], ['P.C. DU BATAILLON', null], ['ABRI', 'Couvre-toi'], ['DANGER', 'Ne pas stationner']];
    for (let k = 0; k < names.length; k++) { const c = firstCell((x, y, i) => k < 3 ? Math.abs(y - tr[k].Y) <= 1 && m.vd.kind[i] !== 4 && m.vd.kind[i] !== 3 : k <= 4 ? m.vd.kind[i] === 2 : m.vd.kind[i] === 1 || m.vd.kind[i] === 2); if (c) signAt(c[0], c[1], names[k][0], names[k][1]); }
    for (const d of V.dugouts) { const x = d.tx, y = d.ty; S.add(Object.assign({ text: R2() < 0.5 ? 'ABRI' : 'P.C.', w: 0.7, h: 0.25, x: (d.ex + 0.5) * C - d.dx * 0.99, y: 2.62, z: (d.ey + 0.5) * C - d.dy * 0.99, ry: Math.atan2(-d.dx, -d.dy) + Math.PI }, sg)); }
    if (V.bunker) S.add({ text: 'SORTIE', bg: '#0d7a3a', fg: '#fff', w: 1.2, h: 0.4, x: (V.bunker.x + 0.5) * C, y: 3.3, z: (V.bunker.y + 1) * C + 0.04, ry: 0, glow: true });
    S.build(group);
    // ---- lanternes ----
    const glow = B('glow');
    for (const l of m.lights) {
      if (!l.deco) continue;
      const x = l.px, z = l.pz, y = l.y;
      if (l.deco === 'poteau') { K.box(PB, x - 0.05, y + 0.18, z - 0.05, x + 0.05, y + 0.22, z + 0.05, woodD); }
      K.box(PB, x - 0.09, y - 0.14, z - 0.09, x + 0.09, y - 0.12, z + 0.09, col('#2a2a26'));
      K.box(PB, x - 0.09, y + 0.1, z - 0.09, x + 0.09, y + 0.13, z + 0.09, col('#2a2a26'));
      K.cyl(PB, [x, y + 0.13, z], [x, y + 0.2, z], 0.03, 6, col('#2a2a26'));
      if (!l.dead) K.box(glow, x - 0.07, y - 0.12, z - 0.07, x + 0.07, y + 0.1, z + 0.07, [1, 0.62, 0.25]);
    }
    // ---- fusées éclairantes, brouillard rampant (animés) ----
    animated(m, group, R2);
  }

  // arbre mort : tronc éclaté, quelques branches nues
  function deadTree(B, PB, x, y0, z, h, R2, col) {
    const TB = B('bark'), c = col(R2() < 0.5 ? '#5a5046' : '#4d443a'), cd = col('#3a332b');
    h = Math.min(h, 7.5);
    const lean = [(R2() - 0.5) * 0.4, (R2() - 0.5) * 0.4];
    const top = [x + lean[0] * h * 0.3, y0 + h, z + lean[1] * h * 0.3];
    K.cyl(TB, [x, y0 - 0.2, z], top, 0.17 + h * 0.012, 7, c, true, 0.09);
    // éclats au sommet
    for (let k = 0; k < 3; k++) { const a = R2() * 6.283; K.cyl(TB, top, [top[0] + Math.cos(a) * 0.15, top[1] + 0.4 + R2() * 0.5, top[2] + Math.sin(a) * 0.15], 0.07, 4, cd, false, 0.01); }
    const nb = Math.floor(R2() * 4);
    for (let k = 0; k < nb; k++) { const t = 0.45 + R2() * 0.45, a = R2() * 6.283, L = 0.8 + R2() * 1.8, p0 = [x + (top[0] - x) * t, y0 + h * t, z + (top[2] - z) * t]; const p1 = [p0[0] + Math.cos(a) * L, p0[1] + L * (0.3 + R2() * 0.5), p0[2] + Math.sin(a) * L]; K.cyl(TB, p0, p1, 0.08, 5, c, false, 0.025); if (R2() < 0.6) { const b = a + (R2() - 0.5) * 1.5; K.cyl(TB, p1, [p1[0] + Math.cos(b) * 0.7, p1[1] + 0.4, p1[2] + Math.sin(b) * 0.7], 0.025, 4, c, false, 0.01); } }
  }
  // piquet de barbelé « queue de cochon » (fer) ou poteau de bois
  function picket(PB, x, y0, z, h, R2, col) {
    const lean = (R2() - 0.5) * 0.25;
    if (R2() < 0.5) K.cyl(PB, [x, y0 - 0.1, z], [x + lean, y0 + h, z + lean * 0.5], 0.035, 5, col('#3a3530'));
    else K.box(PB, x - 0.05, y0 - 0.1, z - 0.05, x + 0.05, y0 + h * 0.95, z + 0.05, col('#4a3a28'));
  }
  // fils de fer barbelés : plusieurs brins affaissés entre a et b + spirales
  // brin de fil : deux rubans croisés (léger, visible sous tous les angles ; matériau double face)
  function strand(WB, p0, p1, w) {
    const d = K.v3.nrm(K.v3.sub(p1, p0)); let s = K.v3.cross(d, [0, 1, 0]); if (Math.hypot(s[0], s[1], s[2]) < 1e-4) s = [1, 0, 0]; s = K.v3.nrm(s); const u = K.v3.nrm(K.v3.cross(s, d));
    for (const v of [s, u]) { const o = K.v3.scl(v, w / 2); BR.World.H.quad(WB, [K.v3.sub(p0, o), K.v3.add(p0, o), K.v3.add(p1, o), K.v3.sub(p1, o)], K.v3.cross(v, d), [[0, 0], [1, 0], [1, 1], [0, 1]], 1); }
  }
  function wires(WB, ax, az, bx, bz, y0, R2) {
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.1) return;
    const n = Math.max(2, Math.ceil(L / 0.6)), ux = (bx - ax) / L, uz = (bz - az) / L;
    for (const hh of [0.3, 0.7, 1.15]) {
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, sag = s => -Math.sin(s * Math.PI) * 0.12;
        const p0 = [ax + (bx - ax) * t0, y0 + hh + sag(t0) + (R2() - 0.5) * 0.04, az + (bz - az) * t0], p1 = [ax + (bx - ax) * t1, y0 + hh + sag(t1) + (R2() - 0.5) * 0.04, az + (bz - az) * t1];
        strand(WB, p0, p1, 0.022);
        if (k % 2 === 0) { const m0 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2]; strand(WB, [m0[0] - uz * 0.05, m0[1] - 0.04, m0[2] + ux * 0.05], [m0[0] + uz * 0.05, m0[1] + 0.04, m0[2] - ux * 0.05], 0.016); }
      }
    }
    // concertina (spirale) au sol
    const turns = Math.ceil(L / 0.45), r = 0.38, sg = 6;
    let prev = null;
    for (let k = 0; k <= turns * sg; k++) {
      const t = k / (turns * sg), a = k / sg * 6.283, cx = ax + (bx - ax) * t, cz = az + (bz - az) * t;
      const p = [cx - uz * Math.cos(a) * r, y0 + r + Math.sin(a) * r, cz + ux * Math.cos(a) * r];
      if (prev) strand(WB, prev, p, 0.02);
      prev = p;
    }
  }

  function drawProp(p, B, PB, inst, H, group) {
    const col = K.col, b = p.base, x = p.x, z = p.z, R2 = BR.rngFrom((p.v * 7919 + p.i) >>> 0);
    switch (p.sub) {
      case 'banquette': {        // marche de tir en planches sur piquets
        const hw = p.w / 2, hd = p.d / 2;
        K.box(PB, x - hw, b + 0.38, z - hd, x + hw, b + 0.45, z + hd, col('#6e5a40'));
        for (const s of [-0.8, 0, 0.8]) K.box(PB, x + s - 0.05, b, z - hd + 0.05, x + s + 0.05, b + 0.38, z + hd - 0.05, col('#3a2c1e'));
        K.box(PB, x - hw, b, z - hd, x + hw, b + 0.38, z - hd + 0.04, col('#4a3a28')); K.box(PB, x - hw, b, z + hd - 0.04, x + hw, b + 0.38, z + hd, col('#4a3a28'));
        // échelle d'assaut appuyée de temps en temps
        if (R2() < 0.25) { const zs = p.v < 0 ? z - hd - 0.05 : z + hd + 0.05, zt = p.v < 0 ? z - hd - 0.35 : z + hd + 0.35; for (const s of [-0.25, 0.25]) K.bar(PB, [x + s, b + 0.45, z], [x + s, SH + 0.6, zt], 0.06, 0.06, col('#5a4430')); for (let k = 1; k < 9; k++) { const t = k / 9; K.bar(PB, [x - 0.25, b + 0.45 + (SH + 0.15 - b) * t, z + (zt - z) * t], [x + 0.25, b + 0.45 + (SH + 0.15 - b) * t, z + (zt - z) * t], 0.04, 0.04, col('#5a4430')); } }
        return;
      }
      case 'barbele': {
        for (const [dx, dz] of [[-0.9, -0.3], [-0.9, 0.3], [0, 0], [0.9, -0.3], [0.9, 0.3]]) picket(PB, x + dx, b, z + dz, 1.25, R2, col);
        return;
      }
      case 'frise': {           // cheval de frise : poutre et croisillons de bois
        K.cyl(PB, [x - 0.95, b + 0.55, z], [x + 0.95, b + 0.55, z], 0.08, 6, col('#4a3a28'), true);
        for (let k = -2; k <= 2; k++) { const xx = x + k * 0.42, a = k % 2 ? 0.8 : 0; for (const s of [-1, 1]) K.bar(PB, [xx, b + 0.55 - Math.cos(a + (s > 0 ? 0 : 1.57)) * 0.6, z - Math.sin(a + (s > 0 ? 0 : 1.57)) * 0.6], [xx, b + 0.55 + Math.cos(a + (s > 0 ? 0 : 1.57)) * 0.6, z + Math.sin(a + (s > 0 ? 0 : 1.57)) * 0.6], 0.05, 0.05, col('#4a3a28')); }
        return;
      }
      case 'arbre': deadTree(B, PB, x, b, z, p.h, R2, col); return;
      case 'ruine': {            // pan de mur en moellons, sommet déchiqueté
        const d = p.data || {}, t = 0.34, ST = B('f42'), sh = () => { const k = 0.8 + R2() * 0.25; return [k, k * 0.98, k * 0.95]; };
        const cx = (p.cx + 0.5) * C, cz = (p.cy + 0.5) * C;
        const arms = []; if (d.e) arms.push([1, 0]); if (d.w) arms.push([-1, 0]); if (d.s) arms.push([0, 1]); if (d.n) arms.push([0, -1]); if (!arms.length) arms.push([1, 0]);
        for (const [ax, az] of arms) {
          const n = 4;
          let hp = p.h * (0.7 + R2() * 0.3);
          for (let k = 0; k < n; k++) {
            const s0 = k / n, s1 = (k + 1) / n;
            hp = BR.clamp(hp + (R2() - 0.5) * 1.4, 0.6, p.h);
            const x0 = cx + ax * s0, x1 = cx + ax * s1, z0 = cz + az * s0, z1 = cz + az * s1;
            const X0 = Math.min(x0, x1) - (ax ? 0 : t / 2), X1 = Math.max(x0, x1) + (ax ? 0 : t / 2), Z0 = Math.min(z0, z1) - (az ? 0 : t / 2), Z1 = Math.max(z0, z1) + (az ? 0 : t / 2);
            K.box(ST, X0, b - 0.05, Z0, X1, b + hp, Z1, sh(), 0.5);
            // pierres arrachées au sommet
            if (R2() < 0.6) K.box(ST, X0 + (X1 - X0) * R2() * 0.5, b + hp, Z0 + (Z1 - Z0) * R2() * 0.5, X1 - (X1 - X0) * R2() * 0.4, b + hp + 0.15 + R2() * 0.3, Z1 - (Z1 - Z0) * R2() * 0.4, sh(), 0.5);
          }
        }
        K.box(ST, cx - t / 2 - 0.02, b - 0.05, cz - t / 2 - 0.02, cx + t / 2 + 0.02, b + p.h * 0.85, cz + t / 2 + 0.02, sh(), 0.5);
        if (d.church && R2() < 0.45) K.box(ST, cx - 0.5, b - 0.05, cz - 0.5, cx + 0.5, b + p.h, cz + 0.5, sh(), 0.5);   // contrefort / pile du clocher
        for (let k = 0; k < 3; k++) K.rbox(PB, cx + (R2() - 0.5) * 1.4, cz + (R2() - 0.5) * 1.4, R2() * 6, -0.25, b - 0.05, -0.18, 0.25, b + 0.12 + R2() * 0.2, 0.18, BR.pick(['#5e574e', '#665f56', '#5a4c3e'], R2));
        return;
      }
      case 'gravats': {
        for (let k = 0; k < 9; k++) K.rbox(PB, x + (R2() - 0.5) * 1.4, z + (R2() - 0.5) * 1.4, R2() * 6, -0.3 - R2() * 0.3, b - 0.1, -0.2 - R2() * 0.2, 0.3 + R2() * 0.3, b + 0.15 + R2() * 0.3, 0.2 + R2() * 0.2, BR.pick(['#8a8378', '#9b6a4f', '#77716a', '#6a5a48'], R2));
        if (R2() < 0.5) K.rbox(PB, x, z, R2() * 6, -0.9, b + 0.1, -0.08, 0.9, b + 0.2, 0.08, '#4a3a28');
        return;
      }
      case 'caisse': { const hw = p.w / 2, hd = p.d / 2; K.box(PB, x - hw, b, z - hd, x + hw, b + 0.5, z + hd, col('#6b5638')); K.box(PB, x - hw - 0.01, b + 0.22, z - hd - 0.01, x + hw + 0.01, b + 0.28, z + hd + 0.01, col('#4a3a28')); if (R2() < 0.5) K.box(PB, x - hw * 0.6, b + 0.5, z - hd * 0.6, x + hw * 0.4, b + 0.85, z + hd * 0.6, col('#5e4c32')); return; }
      case 'tonneau': { K.cyl(PB, [x, b, z], [x, b + 0.5, z], 0.3, 10, col('#5a4430'), true); for (const y of [0.08, 0.4]) K.cyl(PB, [x, b + y, z], [x, b + y + 0.05, z], 0.315, 10, col('#2e2c28')); return; }
      case 'outils': { const hw = p.w / 2, hd = p.d / 2; K.box(PB, x - hw, b, z - hd, x + hw, b + 0.3, z + hd, col('#5e4c32')); for (let k = 0; k < 3; k++) { const a = R2() - 0.5; K.bar(PB, [x + (R2() - 0.5) * hw, b + 0.3, z + (R2() - 0.5) * hd], [x + (R2() - 0.5) * hw + a * 0.3, b + 1.3, z + (R2() - 0.5) * hd], 0.035, 0.035, col('#6b5236')); } return; }
      default: return;
    }
  }

  // fusées éclairantes qui montent puis retombent sous parachute ; une seule lumière réelle suit la plus brillante
  function animated(m, group, R2) {
    const Wm = m.W * C, Hm = m.H * C;
    const glowTex = new THREE.CanvasTexture(BR.Tex.glow(235, 255, 225)); glowTex.encoding = THREE.sRGBEncoding;
    const flares = [];
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xe8ffd8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sp.scale.set(10, 10, 1); sp.frustumCulled = false; sp.userData.flare = 1; group.add(sp);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      core.scale.set(1.8, 1.8, 1); core.frustumCulled = false; group.add(core);
      flares.push({ sp, core, period: 13 + R2() * 14, off: R2() * 30, seed: R2() * 1000 });
    }
    const light = new THREE.PointLight(0xd8ffe0, 0, 95, 1.3); group.add(light);
    // ciel couvert (nuages bas éclairés par les incendies lointains) : couvre le ciel étoilé générique
    const skyTex = new THREE.CanvasTexture(K.mk(1024, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0c0e12'); gr.addColorStop(0.3, '#111418'); gr.addColorStop(0.47, '#1d1f22'); gr.addColorStop(0.5, '#25241f'); gr.addColorStop(0.52, '#1b1e22'); gr.addColorStop(1, '#1b1e22');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // nuages : bandes sombres et claires très douces (raccord horizontal)
      for (let k = 0; k < 120; k++) {
        const x = Math.random() * w, y = h * (0.1 + Math.random() * 0.36), rx = 40 + Math.random() * 140, c = Math.random() < 0.5 ? '34,36,40' : '6,7,9';
        for (const ox of [-w, 0, w]) { const g2 = g.createRadialGradient(x + ox, y, 0, x + ox, y, rx); g2.addColorStop(0, `rgba(${c},0.22)`); g2.addColorStop(1, `rgba(${c},0)`); g.save(); g.translate(x + ox, y); g.scale(1, 0.22); g.translate(-x - ox, -y); g.fillStyle = g2; g.fillRect(x + ox - rx, y - rx, rx * 2, rx * 2); g.restore(); }
      }
      // lueur lointaine des incendies, très basse sur l'horizon
      for (let k = 0; k < 4; k++) { const x = Math.random() * w; for (const ox of [-w, 0, w]) { const gl = g.createRadialGradient(x + ox, h * 0.5, 0, x + ox, h * 0.5, 120); gl.addColorStop(0, 'rgba(110,55,22,0.14)'); gl.addColorStop(1, 'rgba(110,55,22,0)'); g.save(); g.translate(x + ox, h * 0.5); g.scale(1, 0.25); g.translate(-x - ox, -h * 0.5); g.fillStyle = gl; g.fillRect(x + ox - 120, h * 0.5 - 120, 240, 240); g.restore(); } }
      K.grain(g, w, h, 5);      // tramage : évite les bandes dans les dégradés sombres
    }));
    skyTex.encoding = THREE.sRGBEncoding;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -9; sky.frustumCulled = false; sky.onBeforeRender = (r, sc, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };
    group.add(sky);
    const fogTex = new THREE.CanvasTexture(K.mk(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(200,205,210,0.55)'); gr.addColorStop(0.6, 'rgba(190,195,200,0.18)'); gr.addColorStop(1, 'rgba(190,195,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
    const mists = [];
    for (let k = 0; k < 46; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogTex, color: 0x9aa3ab, transparent: true, opacity: 0.16 + R2() * 0.1, depthWrite: false }));
      const big = 10 + R2() * 14; s.scale.set(big, big * 0.32, 1);
      const inT = R2() < 0.3; s.position.set(R2() * Wm, inT ? 1.2 : SH + 0.6 + R2() * 0.8, R2() * Hm); s.frustumCulled = false;
      group.add(s); mists.push({ s, vx: 0.15 + R2() * 0.25, x0: s.position.x });
    }
    let last = -1;
    const tick = () => {
      const t = performance.now() / 1000; if (t === last) return; last = t;
      let best = null, bi = 0;
      for (const f of flares) {
        const cyc = Math.floor((t + f.off) / f.period), ph = ((t + f.off) % f.period), life = 9.5;
        const r = BR.rngFrom(((cyc * 977 + f.seed * 13) >>> 0) || 1);
        const side = r(); const fx = side < 0.6 ? r() * Wm : (side < 0.8 ? -20 - r() * 40 : Wm + 20 + r() * 40), fz = side < 0.6 ? -25 - r() * 55 + (r() < 0.3 ? Hm * 0.55 : 0) : r() * Hm * 0.7;
        if (ph > life) { f.sp.material.opacity = 0; f.core.material.opacity = 0; continue; }
        const up = Math.min(1, ph / 1.1), y = ph < 1.1 ? 8 + 38 * (1 - (1 - up) * (1 - up)) : 46 - (ph - 1.1) * 2.6;
        const k = (ph < 1.1 ? 0.4 : 1) * (ph > life - 1.5 ? (life - ph) / 1.5 : 1) * (0.85 + 0.15 * Math.sin(t * 23 + f.seed));
        f.sp.position.set(fx + Math.sin(ph * 0.4 + f.seed) * 2, y, fz); f.core.position.copy(f.sp.position);
        f.sp.material.opacity = 0.75 * k; f.core.material.opacity = k;
        const near = Math.max(0, 1 - Math.max(0, Math.max(-fx, fx - Wm, -fz - 20, fz - Hm)) / 80);
        if (k * near > bi) { bi = k * near; best = f; }
      }
      if (best) { light.position.copy(best.sp.position); light.intensity = 1.25 * bi; } else light.intensity = 0;
      for (const o of mists) { o.s.position.x = ((o.x0 + t * o.vx) % (Wm + 20)) - 10; }
    };
    flares[0].sp.onBeforeRender = tick;
  }

  BR.World.gens.verdun = genVerdun;
  BR.World.decor.verdun = decorVerdun;
  BR.Maps2 = BR.Maps2 || {}; BR.Maps2.verdun = { gen: genVerdun };
})();

/* ===== maps/bowling.js : BOWLING — fermé pour la nuit
   Rez-de-chaussée : hall d'accueil + comptoir de location de chaussures, 12 pistes en bois verni (quilles, retours de boules,
   banquettes, écrans de score), salle des machines derrière les quilles (requilleuses), bar, toilettes, salle d'arcade,
   salle de billard, bureau du personnel, réserve.
   Étage : mezzanine-salon au-dessus de l'accueil, salle des anniversaires au-dessus du bar, passerelle technique au-dessus
   de l'allée nord, grenier de la salle des machines. Trois escaliers. ===== */
(function () {
  const BR = window.BR, TX = BR.Tex, P = TX.P, Wd = BR.World;

  /* ---------------- textures ---------------- */
  // moquette « cosmique » des bowlings : fond bleu nuit, planètes, étoiles, zigzags fluo
  const cosmic = (bg, cols, n) => P.mk(256, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); P.fine(g, w, h, 10);
    const draw = (fn) => { for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
    for (let k = 0; k < n; k++) {
      const x = Math.random() * w, y = Math.random() * h, c = cols[k % cols.length], t = k % 4, r = 6 + Math.random() * 12, a = Math.random() * 6.28;
      draw(() => {
        g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 3;
        if (t === 0) { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.stroke(); g.beginPath(); g.ellipse(x, y, r * 1.7, r * 0.45, a, 0, 6.283); g.stroke(); }
        else if (t === 1) { g.beginPath(); for (let s = 0; s < 10; s++) { const rr = s % 2 ? r * 0.4 : r, aa = a + s / 10 * 6.283; g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); } g.closePath(); g.fill(); }
        else if (t === 2) { g.beginPath(); g.moveTo(x, y); for (let s = 1; s < 6; s++) g.lineTo(x + Math.cos(a) * s * 6 + (s % 2 ? 6 : -6) * Math.sin(a), y + Math.sin(a) * s * 6 - (s % 2 ? 6 : -6) * Math.cos(a)); g.stroke(); }
        else { g.beginPath(); g.arc(x, y, r * 0.35, 0, 6.283); g.fill(); }
      });
    }
    P.speckle(g, w, h, 900, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.2)'], 1, 2);
    P.soft(g, w, h, 4, '0,0,0', 0.1, 0.2, 20, 60);
  });
  // piste : en travers d'une case de 2 m (axe z) : demi-chapeau 0,245 m | gouttière 0,23 | piste 1,05 | gouttière | demi-chapeau
  const lane = (wood, pinDeck) => P.mk(256, 256, (g, w, h) => {
    const cap = 31, gut = 29, L = 134;
    g.fillStyle = '#16161a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2d33'; g.fillRect(0, cap, w, gut); g.fillRect(0, cap + gut + L, w, gut);
    for (const y0 of [cap, cap + gut + L]) { const gr = g.createLinearGradient(0, y0, 0, y0 + gut); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = gr; g.fillRect(0, y0, w, gut); }
    const y0 = cap + gut;
    for (let y = y0, k = 0; y < y0 + L; y += 3.45, k++) { g.fillStyle = P.vary(wood, 0.07 + (k % 13 === 0 ? 0.1 : 0)); g.fillRect(0, y, w, 3.45); g.fillStyle = 'rgba(70,40,15,0.18)'; g.fillRect(0, y, w, 0.7); }
    g.strokeStyle = 'rgba(120,75,30,0.12)'; g.lineWidth = 1; for (let k = 0; k < 20; k++) { g.beginPath(); const yy = y0 + Math.random() * L; g.moveTo(0, yy); for (let x = 0; x <= w; x += 16) g.lineTo(x, yy + Math.sin(x * 0.04 + k) * 1.5); g.stroke(); }
    if (pinDeck) { P.soft(g, w, h, 6, '60,40,20', 0.08, 0.16, 10, 30); }
    // chapeaux de séparation (noir brillant) avec liseré
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, cap - 2, w, 2); g.fillRect(0, cap + gut + L + gut, w, 2);
  });
  Object.assign(TX.MAKE, {
    bwCarpet: () => cosmic('#12163a', ['#2bb0c8', '#c43a90', '#c9b23e', '#5fc054', '#8357c9'], 22),
    bwArcadeCarpet: () => cosmic('#0b0b12', ['#c42a5c', '#28b8c4', '#c4c234', '#6c48c4'], 30),
    bwBilliardCarpet: () => P.mk(256, 256, (g, w, h) => { g.fillStyle = '#4a1520'; g.fillRect(0, 0, w, h); P.fine(g, w, h, 10); g.strokeStyle = 'rgba(220,170,80,0.35)'; g.lineWidth = 3; for (let y = 0; y <= h; y += 64) for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 20, y); g.lineTo(x, y + 20); g.lineTo(x - 20, y); g.closePath(); g.stroke(); } P.soft(g, w, h, 5, '0,0,0', 0.1, 0.2, 20, 60); }),
    bwLane: () => lane('#d9ae72'),
    bwApproach: () => lane('#e0b97f'),
    bwDeck: () => lane('#cfa36a', true),
    bwBarFloor: () => P.wood('#4a3020'),
    bwToiletFloor: () => P.tiles('#2c2f36', '#3a3e46', 4, 'rgba(10,10,12,0.7)'),
    bwConcrete: () => P.concrete('#6c6e72', true),
    bwOffice: () => P.mk(256, 256, (g, w, h) => { g.fillStyle = '#4b4f57'; g.fillRect(0, 0, w, h); P.fine(g, w, h, 14); P.grid(g, w, h, 64, 'rgba(0,0,0,0.25)', 2); P.soft(g, w, h, 4, '0,0,0', 0.08, 0.16, 20, 60); }),
    // mur principal : peinture violet sombre, frise fluo, lambris bas
    bwWall: () => P.mk(512, 512, (g, w, h) => {
      g.fillStyle = '#2a1f3d'; g.fillRect(0, 0, w, h); P.soft(g, w, h, 8, '0,0,0', 0.06, 0.14, 40, 120); P.fine(g, w, h, 5);
      const band = (y, c) => { g.fillStyle = c; g.fillRect(0, y, w, 10); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y + 3, w, 2); };
      band(250, '#ff3fb4'); band(272, '#36e3ff');
      g.fillStyle = '#3b2b22'; g.fillRect(0, 380, w, 132); for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, 380, 3, 132); } g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 380, w, 3);
      P.grime(g, w, h, 0.8, 0.15); P.skirting(g, w, h, '#151515', 14);
    }),
    bwInner: () => P.paint('#5a4a6e', '#1d1724'),
    bwBlock: () => P.mk(512, 512, (g, w, h) => { P.pavers(g, w, h, 128, 64, '#7a7c80', '#55575b', 0.06, 0.5, 3); P.grime(g, w, h, 1, 0.3); P.speckle(g, w, h, 2500, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.06)'], 1, 2); P.fine(g, w, h, 5); }),
    bwFaience: () => P.faience('#20232a', '#4a4e57'),
    // façade des requilleuses : fosse sombre en bas, panneau décoré au-dessus (512 px = 4 m de large = 2 pistes)
    bwMask: () => P.mk(512, 512, (g, w, h) => {
      g.fillStyle = '#0a0a0e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#101018'; g.fillRect(0, 390, w, 122);                       // fosse (sous le masque)
      const gr = g.createLinearGradient(0, 120, 0, 380); gr.addColorStop(0, '#1b1446'); gr.addColorStop(1, '#3a1058'); g.fillStyle = gr; g.fillRect(0, 120, w, 270);
      for (let k = 0; k < 2; k++) {
        const cx = 128 + k * 256;
        g.strokeStyle = k ? '#36e3ff' : '#ff3fb4'; g.lineWidth = 6; g.beginPath(); g.arc(cx, 255, 70, 0, 6.283); g.stroke();
        g.strokeStyle = '#ffe34a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 110, 330); for (let x = -110; x <= 110; x += 20) g.lineTo(cx + x, 330 + (x / 20 % 2 ? -14 : 14)); g.stroke();
        g.fillStyle = '#f2f2f2'; for (const [px, py] of [[0, -40], [-14, -10], [14, -10], [-28, 20], [0, 20], [28, 20]]) { g.beginPath(); g.ellipse(cx + px, 255 + py, 7, 14, 0, 0, 6.283); g.fill(); }
      }
      g.fillStyle = '#222'; g.fillRect(0, 380, w, 12); g.fillRect(0, 110, w, 12);
      for (let x = 0; x < w; x += 256) g.fillRect(x - 4, 110, 8, 280);
    }),
    bwMaskE: () => P.mk(512, 512, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 2; k++) {
        const cx = 128 + k * 256;
        g.strokeStyle = k ? '#36e3ff' : '#ff3fb4'; g.lineWidth = 6; g.beginPath(); g.arc(cx, 255, 70, 0, 6.283); g.stroke();
        g.strokeStyle = '#ffe34a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 110, 330); for (let x = -110; x <= 110; x += 20) g.lineTo(cx + x, 330 + (x / 20 % 2 ? -14 : 14)); g.stroke();
      }
      g.fillStyle = 'rgba(60,40,140,0.35)'; g.fillRect(0, 120, w, 270);
    }),
    bwCeil: () => P.ceilTiles('#26222c', '#141218'),
    bwStairs: () => P.stairs('#2a2a32', '#c9a227'),
    bwEdge: () => P.edge('#2d2836', '#ff3fb4'),
    bwFelt: () => P.mk(128, 128, (g, w, h) => { g.fillStyle = '#1f6b45'; g.fillRect(0, 0, w, h); P.fine(g, w, h, 14); P.soft(g, w, h, 3, '0,0,0', 0.05, 0.1, 15, 40); }),
    bwChrome: () => P.metal('#c9cdd2'),
    bwWoodDark: () => P.wood('#5a3622'),
  });

  /* ---------------- thème ---------------- */
  TX.THEMES.bowling = {
    name: 'Bowling', fog: 0x0d0814, fogDensity: 0.04, ambient: 0x5a4a78, ambientI: 0.26, hemi: [0xb59cff, 0x1a1020, 0.18], exposure: 0.95,
    lightColor: 0xffe2b8, panel: '#fff3dc', flicker: 0.16, deadLights: 0.2, outdoor: false, lightI: 0.85, flashI: 0.9,
    env: { kind: 'indoor', wall: '#2d2340', floor: '#5a3a20', ceil: '#1c1822', panel: '#fff0d8' },
    tex: {
      floor: {
        1: { t: 'bwCarpet', rough: 1, n: 0.8 }, 2: { t: 'bwApproach', rough: 0.14, env: 2.6, n: 0.5, rv: 0.3 }, 3: { t: 'bwLane', rough: 0.08, env: 3, n: 0.4, rv: 0.25 }, 4: { t: 'bwDeck', rough: 0.2, env: 2.2, n: 0.6 },
        5: { t: 'bwConcrete', rough: 0.8 }, 6: { t: 'bwBarFloor', rough: 0.4, env: 1.4 }, 7: { t: 'bwArcadeCarpet', rough: 1, n: 0.8 }, 8: { t: 'bwBilliardCarpet', rough: 1, n: 0.8 },
        9: { t: 'bwToiletFloor', rough: 0.25, env: 1.6 }, 10: { t: 'bwConcrete', rough: 0.85 }, 11: { t: 'bwCarpet', rough: 1, n: 0.8 }, 12: { t: 'bwOffice', rough: 0.9 }, 0: { t: 'bwCarpet', rough: 1 },
      },
      wall: { 1: { t: 'bwWall', rough: 0.85 }, 2: { t: 'bwMask', em: 'bwMaskE', ei: 1.2, rough: 0.6 }, 3: { t: 'bwInner' }, 4: { t: 'bwFaience', rough: 0.18, env: 1.8 }, 5: { t: 'bwBlock', rough: 0.9, n: 1.4 }, 0: { t: 'bwInner' } },
      ci: { t: 'bwCeil' }, co: { t: 'bwCeil' }, e: { t: 'bwEdge' }, r: { t: 'bwStairs', rough: 0.6 }, rs: { t: 'bwEdge' }, rr: { t: 'bwEdge' },
    },
    mats: {
      chrome: { t: 'bwChrome', rough: 0.18, metal: 0.9, env: 1.6, n: 0.2 },
      gloss: { t: 'noise', rough: 0.22, env: 1.4, n: 0 },          // plastiques, carrosseries des bornes (couleurs de sommet)
      matte: { t: 'noise', rough: 0.85, n: 0 },
      felt: { t: 'bwFelt', rough: 1, n: 0.6 },
      wood: { t: 'bwWoodDark', rough: 0.35, env: 1.2 },
      pin: { color: '#f4f2ec', rough: 0.15, env: 1.8 },
      neon: { basic: true },
      screen: { basic: true },
      ceram: { color: '#f3f3ef', rough: 0.12, env: 1.6 },
    },
  };

  /* ---------------- génération ---------------- */
  function genBowling(def, seed, diff, rng, H) {
    const { FLOOR, WALL, VOID } = H;
    const W = 36, Hh = 34, F = 2;
    const m = H.newMap('bowling', def, W, Hh, F, seed);
    const Z = { carpet: 1, appr: 2, lane: 3, deck: 4, machine: 5, bar: 6, arcade: 7, billiard: 8, tile: 9, store: 10, mezz: 11, office: 12 };
    const WZ = { outer: 1, mask: 2, inner: 3, tileW: 4, block: 5 };
    const R = (f, x0, y0, x1, y1, t, z) => H.rect(m, f, x0, y0, x1, y1, t, z);
    const S = (f, x, y, t, z) => H.set(m, f, x, y, t, z);
    for (let f = 0; f < F; f++) for (let i = 0; i < m.WH; i++) m.zone[f][i] = WZ.inner;
    for (let f = 0; f < F; f++) { R(f, 0, 0, W - 1, 0, WALL, WZ.outer); R(f, 0, Hh - 1, W - 1, Hh - 1, WALL, WZ.outer); R(f, 0, 0, 0, Hh - 1, WALL, WZ.outer); R(f, W - 1, 0, W - 1, Hh - 1, WALL, WZ.outer); }
    // --- rez-de-chaussée ---
    R(0, 1, 1, 25, 16, FLOOR, Z.carpet);                 // accueil + pistes
    R(0, 13, 3, 15, 14, FLOOR, Z.appr); R(0, 16, 3, 24, 14, FLOOR, Z.lane); R(0, 25, 3, 25, 14, FLOOR, Z.deck);
    R(0, 26, 1, 26, 16, WALL, WZ.block); R(0, 26, 3, 26, 14, WALL, WZ.mask);
    R(0, 27, 1, 34, 16, FLOOR, Z.machine); S(0, 26, 16, FLOOR, Z.machine);
    R(0, 1, 17, 34, 17, WALL, WZ.inner);
    R(0, 1, 18, 9, 23, FLOOR, Z.bar); R(0, 3, 17, 8, 17, FLOOR, Z.bar);
    R(0, 1, 24, 9, 24, WALL, WZ.inner); R(0, 1, 25, 4, 32, FLOOR, Z.tile); R(0, 5, 25, 5, 32, WALL, WZ.tileW); R(0, 6, 25, 9, 32, FLOOR, Z.tile);
    S(0, 2, 24, FLOOR, Z.tile); S(0, 8, 24, FLOOR, Z.tile);
    R(0, 10, 18, 10, 32, WALL, WZ.inner);
    R(0, 11, 18, 19, 26, FLOOR, Z.arcade); S(0, 14, 17, FLOOR, Z.arcade); S(0, 15, 17, FLOOR, Z.arcade); S(0, 10, 20, FLOOR, Z.arcade);
    R(0, 20, 18, 20, 32, WALL, WZ.inner); R(0, 11, 27, 34, 27, WALL, WZ.inner);
    R(0, 21, 18, 34, 26, FLOOR, Z.billiard); S(0, 24, 17, FLOOR, Z.billiard); S(0, 25, 17, FLOOR, Z.billiard); S(0, 20, 22, FLOOR, Z.billiard); S(0, 30, 17, FLOOR, Z.machine);
    R(0, 11, 28, 19, 32, FLOOR, Z.office); S(0, 15, 27, FLOOR, Z.office);
    R(0, 21, 28, 34, 32, FLOOR, Z.store); S(0, 28, 27, FLOOR, Z.store); S(0, 20, 30, FLOOR, Z.store);
    // --- étage ---
    R(1, 1, 1, 9, 16, FLOOR, Z.mezz);                    // mezzanine-salon
    R(1, 1, 18, 9, 32, FLOOR, Z.mezz); S(1, 5, 17, FLOOR, Z.mezz);   // salle des anniversaires
    R(1, 10, 1, 26, 2, FLOOR, Z.store);                  // passerelle technique
    R(1, 27, 1, 34, 16, FLOOR, Z.store);                 // grenier des machines
    R(1, 10, 3, 25, 16, VOID);                           // double hauteur au-dessus des pistes
    // escaliers
    if (!H.addRamp(m, 0, 5, 15, 0, -1, 4, { zone: Z.carpet })) return null;
    if (!H.addRamp(m, 0, 8, 18, 0, 1, 4, { zone: Z.bar })) return null;
    if (!H.addRamp(m, 0, 33, 12, 0, -1, 4, { zone: Z.machine })) return null;
    // départ : hall d'accueil
    m.spawn = { f: 0, cx: 8, cy: 9 };
    // sortie : issue de secours sur un mur extérieur, loin du départ
    const id = (x, y) => y * W + x;
    const dist = new Int16Array(m.WH).fill(-1), q = [id(8, 9)]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const c = q[h], x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = id(x + dx, y + dy); if (dist[j] < 0 && (m.t[0][j] === FLOOR || m.t[0][j] === H.RAMP)) { dist[j] = dist[c] + 1; q.push(j); } } }
    let maxD = 0; for (const c of q) maxD = Math.max(maxD, dist[c]);
    const ex = [];
    for (let y = 1; y < Hh - 1; y++) { ex.push({ cx: 1, cy: y, dx: -1, dy: 0 }, { cx: W - 2, cy: y, dx: 1, dy: 0 }); }
    for (let x = 1; x < W - 1; x++) { ex.push({ cx: x, cy: 1, dx: 0, dy: -1 }, { cx: x, cy: Hh - 2, dx: 0, dy: 1 }); }
    const good = ex.filter(e => { const i = id(e.cx, e.cy); return m.t[0][i] === FLOOR && dist[i] >= maxD * 0.75 && m.zone[0][i] !== Z.tile; });
    if (!good.length) return null;
    m.exit = good[Math.floor(rng() * good.length)];
    const e = m.exit;
    const keep = (x, y) => Math.abs(x - e.cx) + Math.abs(y - e.cy) > 2 && Math.abs(x - m.spawn.cx) + Math.abs(y - m.spawn.cy) > 2;
    const prop = (f, x, y, kind, h, w, d, o) => (f > 0 || keep(x, y)) ? H.addProp(m, f, x, y, kind, h, w, d, Object.assign({ nodraw: true }, o || {})) : null;

    /* ---- objets ---- */
    for (let y = 3; y <= 14; y++) prop(0, 25, y, 'pins', 0.75, 1.6, 1.4, { data: { lane: y - 2 } });
    for (let y = 3; y <= 13; y += 2) prop(0, 12, y, 'ballret', 0.95, 1.1, 1.0, { oz: 0.5 });
    for (let y = 3; y <= 14; y += 2) prop(0, 10, y, 'couch', 0.8, 1.0, 1.9, { ox: -0.3 });
    for (const y of [4, 8, 12]) prop(0, 11, y, 'console', 0.8, 0.8, 1.2);
    for (let y = 2; y <= 8; y++) prop(0, 6, y, 'counter', 1.1, 0.7, 2, { ox: 0.3, data: { first: y === 2, last: y === 8 } });
    for (let y = 2; y <= 8; y++) prop(0, 1, y, 'shoes', 2.3, 0.7, 2, { ox: -0.6 });
    for (let y = 10; y <= 14; y++) prop(0, 1, y, 'ballrack', 1.15, 0.8, 2, { ox: -0.55 });
    for (const y of [11, 14]) prop(0, 3, y, 'lbench', 0.45, 1.6, 0.5);
    prop(0, 9, 1, 'vending', 1.9, 1.0, 0.85, { oz: -0.5, data: { hue: 200 } }); prop(0, 8, 1, 'vending', 1.9, 1.0, 0.85, { oz: -0.5, data: { hue: 0 } });
    // bar
    for (let y = 19; y <= 22; y++) prop(0, 3, y, 'bar', 1.1, 0.8, 2, { data: { first: y === 19, last: y === 22 } });
    for (let y = 18; y <= 23; y++) prop(0, 1, y, 'backbar', 2.2, 0.6, 2, { ox: -0.65 });
    for (let y = 19; y <= 22; y++) prop(0, 4, y, 'stool', 0.75, 0.42, 0.42, { ox: 0.1 });
    for (const [x, y] of [[6, 19], [6, 22]]) prop(0, x, y, 'btable', 0.75, 0.9, 0.9);
    // toilettes
    for (let y = 28; y <= 31; y++) { prop(0, 1, y, 'stall', 2.1, 2, 2, { data: { back: -1 } }); prop(0, 9, y, 'stall', 2.1, 2, 2, { data: { back: 1 } }); }
    prop(0, 3, 32, 'sink', 0.9, 1.6, 0.55, { oz: 0.7 }); prop(0, 7, 32, 'sink', 0.9, 1.6, 0.55, { oz: 0.7 });
    for (const y of [27, 29]) prop(0, 4, y, 'urinal', 0.6, 0.35, 0.5, { ox: 0.8 });
    // arcade : bornes contre les murs
    const cab = (x, y, face, o) => prop(0, x, y, o || 'arcade', o === 'claw' ? 2.0 : 1.9, face[0] ? 0.9 : 0.85, face[1] ? 0.9 : 0.85, { ox: -face[0] * 0.5, oz: -face[1] * 0.5, data: { fx: face[0], fz: face[1], hue: Math.floor(rng() * 360) } });
    for (const x of [11, 12, 13, 16, 17, 18, 19]) cab(x, 18, [0, 1]);
    for (const y of [21, 22, 23, 24, 25]) cab(11, y, [1, 0]);
    for (const x of [11, 12, 13, 14, 16, 17, 18, 19]) cab(x, 26, [0, -1]);
    for (const y of [19, 20, 21, 23, 24, 25]) cab(19, y, [-1, 0]);
    prop(0, 14, 22, 'hockey', 0.85, 1.2, 1.9); prop(0, 16, 22, 'dance', 0.3, 1.8, 1.4); prop(0, 17, 24, 'claw', 2.0, 1.1, 1.1, { data: { hue: 320 } }); prop(0, 13, 24, 'pinball', 1.25, 0.75, 1.5, { data: { hue: 40 } });
    // billard
    for (const y of [20, 24]) for (const x of [22, 27, 32]) { const lk = Math.floor(rng() * 1e6); prop(0, x, y, 'pool', 0.85, 2, 1.45, { ox: 1, data: { part: 0, link: lk } }); prop(0, x + 1, y, 'pool', 0.85, 2, 1.45, { ox: -1, data: { part: 1, link: lk } }); }
    for (const x of [22, 26, 32]) prop(0, x, 18, 'cuerack', 1.9, 1.2, 0.3, { oz: -0.8 });
    for (const y of [19, 25]) prop(0, 34, y, 'armchair', 0.9, 1, 1);
    // bureau du personnel / réserve
    prop(0, 12, 29, 'desk', 0.78, 1.8, 0.9); prop(0, 12, 31, 'desk', 0.78, 1.8, 0.9);
    for (const y of [28, 29, 31, 32]) prop(0, 19, y, 'locker', 2.0, 0.6, 1.9, { ox: 0.65 });
    prop(0, 16, 30, 'btable', 0.75, 0.9, 0.9); prop(0, 11, 32, 'safe', 1.0, 0.8, 0.8, { ox: -0.4, oz: 0.4 });
    for (const y of [29, 31]) for (let x = 23; x <= 32; x++) prop(0, x, y, 'rack', 2.4, 2, 0.9, { data: { k: Math.floor(rng() * 1e6) } });
    // salle des machines : requilleuses derrière chaque piste
    for (let y = 3; y <= 14; y++) prop(0, 27, y, 'pinsetter', 2.8, 2, 2, { data: { lane: y - 2 } });
    prop(0, 34, 2, 'bench', 0.95, 0.9, 2, { ox: 0.4 }); prop(0, 34, 4, 'compressor', 1.4, 1.2, 1.4, { ox: 0.2 });
    for (const [x, y] of [[29, 2], [31, 2], [29, 15], [31, 15]]) prop(0, x, y, 'crate', 0.9, 1.3, 1.3, { data: { k: Math.floor(rng() * 1e6) } });
    // étage : garde-corps (bord de la mezzanine, passerelle, trémies d'escalier)
    const rail = (f, x, y, sx, sy) => prop(f, x, y, 'rail', 1.05, sx ? 0.14 : 2, sy ? 0.14 : 2, { ox: sx * 0.93, oz: sy * 0.93, data: { sx, sy } });
    for (let y = 3; y <= 16; y++) rail(1, 9, y, 1, 0);
    for (let x = 10; x <= 25; x++) rail(1, x, 2, 0, 1);
    for (let y = 12; y <= 15; y++) { rail(1, 4, y, 1, 0); rail(1, 6, y, -1, 0); }
    rail(1, 5, 16, 0, -1);
    for (let y = 18; y <= 21; y++) { rail(1, 7, y, 1, 0); rail(1, 9, y, -1, 0); }
    for (let y = 9; y <= 12; y++) { rail(1, 32, y, 1, 0); rail(1, 34, y, -1, 0); }
    rail(1, 33, 13, 0, -1);
    // mezzanine-salon et salle des anniversaires
    for (const [x, y] of [[2, 3], [2, 7], [6, 3], [6, 7], [2, 11]]) prop(1, x, y, 'mtable', 0.75, 0.9, 0.9);
    for (const [x, y] of [[3, 24], [3, 28], [6, 26], [6, 30]]) prop(1, x, y, 'ptable', 0.75, 1.8, 1.0, { data: { hue: Math.floor(rng() * 360) } });
    prop(1, 1, 31, 'couch', 0.8, 1.0, 1.9, { ox: -0.3 }); prop(1, 9, 31, 'couch', 0.8, 1.0, 1.9, { ox: 0.3 });
    for (const [x, y] of [[28, 3], [30, 3], [28, 14], [31, 6], [29, 10]]) prop(1, x, y, 'crate', 0.9, 1.3, 1.3, { data: { k: Math.floor(rng() * 1e6) } });

    if (!H.finalize(m, rng, diff)) return null;
    /* ---- éclairage : luminaires suspendus au-dessus des pistes, dalles ailleurs ---- */
    const th = TX.theme('bowling');
    const hall = (f, i) => { const x = i % W, y = (i / W) | 0; return f === 0 && x >= 10 && x <= 25 && y >= 3 && y <= 16; };
    H.panelLights(m, rng, th, (f, i) => !hall(f, i));
    for (const x of [11, 14, 19, 23]) for (const y of [4, 8, 12]) m.lights.push({ f: 0, cx: x, cy: y, y: 4.6, kind: 'panel', hang: true, dead: rng() < th.deadLights * 0.6, flicker: rng() < th.flicker, phase: rng() * 100 });
    for (const y of [6, 11]) m.lights.push({ f: 0, cx: 25, cy: y, y: 3.4, kind: 'panel', hang: true, dead: false, flicker: rng() < 0.3, phase: rng() * 100 });
    return m;
  }
  Wd.gens.bowling = genBowling;

  /* ---------------- décor ---------------- */
  function bowlDecor(m, B, inst, rng, H, group) {
    const { C, SH } = H, W = m.W;
    const bx = (Bf, x0, y0, z0, x1, y1, z1, col, s) => H.box(Bf, x0, y0, z0, x1, y1, z1, col || [1, 1, 1], s || 0.5);
    const CH = B('chrome'), GL = B('gloss'), MT = B('matte'), FE = B('felt'), WO = B('wood'), PN = B('pin'), NE = B('neon'), SC = B('screen'), PB = B('p');
    const hsl = (hh, s, l) => { const c = new THREE.Color().setHSL(hh / 360, s, l); return [c.r, c.g, c.b]; };
    const sign = (txt, w, h, x, y, z, ry, bg, fg, glow) => {
      const cv = P.mk(Math.round(w * 160), Math.round(h * 160), (g, cw, ch) => {
        g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
        g.font = `bold ${Math.floor(ch * 0.62)}px 'Segoe UI', Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (glow) { g.shadowColor = fg; g.shadowBlur = ch * 0.25; }
        g.fillStyle = fg; g.fillText(txt, cw / 2, ch / 2 + 2);
      });
      const me = H.signMesh(cv, w, h, {}); me.position.set(x, y, z); me.rotation.y = ry || 0; group.add(me); return me;
    };
    // --- marquages des pistes : ligne de faute, flèches, points d'approche ---
    const paint = B('paint'), Y = 0.006;
    const strip = (x0, z0, x1, z1, col) => H.quad(paint, [[x0, Y, z1], [x1, Y, z1], [x1, Y, z0], [x0, Y, z0]], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], col);
    for (let ln = 0; ln < 12; ln++) {
      const zc = (3 + ln) * C + 1;
      strip(16 * C - 0.025, zc - 0.53, 16 * C + 0.025, zc + 0.53, [0.05, 0.05, 0.05]);
      for (let k = -3; k <= 3; k++) { const ax = 16 * C + 4.6 + Math.abs(k) * 0.3, az = zc + k * 0.13; H.quad(paint, [[ax, Y, az - 0.035], [ax + 0.35, Y, az], [ax, Y, az + 0.035], [ax - 0.02, Y, az]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.15, 0.12, 0.35]); }
      for (const d of [0.6, 2.2]) for (let k = -2; k <= 2; k++) { const px = 16 * C - d, pz = zc + k * 0.2; strip(px - 0.03, pz - 0.03, px + 0.03, pz + 0.03, [0.2, 0.15, 0.4]); }
      for (let k = -4; k <= 4; k++) { const px = 16 * C + 2.1, pz = zc + k * 0.12; strip(px - 0.02, pz - 0.02, px + 0.02, pz + 0.02, [0.25, 0.2, 0.4]); }
      // quilles en triangle (la tête de quille vers les joueurs)
      const px0 = 25 * C + 0.35;
      for (let row = 0; row < 4; row++) for (let k = 0; k <= row; k++) {
        if (rng() < 0.06) continue;      // quelques quilles déjà tombées
        const qx = px0 + row * 0.26, qz = zc + (k - row / 2) * 0.305;
        H.tube(PN, [[qx, 0, qz], [qx, 0.05, qz], [qx, 0.13, qz], [qx, 0.2, qz], [qx, 0.26, qz], [qx, 0.31, qz], [qx, 0.36, qz], [qx, 0.38, qz]], [0.03, 0.05, 0.06, 0.045, 0.026, 0.03, 0.03, 0.012], 8, [1, 1, 1], 1);
        H.tube(B('neon'), [[qx, 0.235, qz], [qx, 0.255, qz]], [0.036, 0.031], 8, [0.85, 0.08, 0.1], 1);
      }
      if (rng() < 0.3) { const qx = px0 - 0.9, qz = zc + (rng() - 0.5) * 0.6; H.tube(PN, [[qx - 0.19, 0.06, qz], [qx + 0.19, 0.06, qz + 0.05]], [0.05, 0.03], 8, [1, 1, 1], 1); }
      // numéro de piste sur la façade des requilleuses
      sign(String(ln + 1), 0.5, 0.36, 26 * C - 0.02, 3.35, zc, -Math.PI / 2, '#0b0b12', '#f6f0d0', true);
    }
    // gouttières : rigoles creuses (sous le niveau du sol, vues de dessus) — on assombrit seulement
    // retours de boules, banquettes, consoles, écrans suspendus
    for (const p of m.props) {
      const x = p.x, z = p.z, b = p.base;
      switch (p.kind) {
        case 'ballret': {
          bx(GL, p.x0, b, p.z0, p.x1, b + 0.55, p.z1, [0.12, 0.1, 0.2]);
          H.tube(GL, [[p.x0 + 0.05, b + 0.55, z], [x, b + 0.95, z], [p.x1 - 0.05, b + 0.55, z]], [0.35, 0.42, 0.35], 10, [0.35, 0.12, 0.55], 1);
          bx(CH, p.x0 - 0.4, b + 0.55, z - 0.32, p.x1 + 0.3, b + 0.6, z + 0.32, [1, 1, 1]);
          for (let k = 0; k < 5; k++) { const c = hsl(Math.floor(rng() * 360), 0.75, 0.45); H.icoBlob(GL, p.x0 - 0.25 + k * 0.26 + (rng() - 0.5) * 0.02, b + 0.72, z + (k % 2 ? 0.13 : -0.13), 0.11, c, 1, 1); }
          break;
        }
        case 'couch': { const s = p.ox < 0 ? -1 : 1, c = [0.55, 0.12, 0.5]; bx(GL, p.x0, b, p.z0, p.x1, b + 0.45, p.z1, c); bx(GL, s < 0 ? p.x0 : p.x1 - 0.22, b + 0.45, p.z0, s < 0 ? p.x0 + 0.22 : p.x1, b + 0.95, p.z1, c.map(v => v * 0.85)); for (const zz of [p.z0, p.z1 - 0.18]) bx(GL, p.x0, b + 0.45, zz, p.x1, b + 0.65, zz + 0.18, c.map(v => v * 0.9)); break; }
        case 'console': bx(MT, p.x0 + 0.1, b, p.z0 + 0.1, p.x1 - 0.1, b + 0.72, p.z1 - 0.1, [0.15, 0.15, 0.18]); bx(GL, p.x0, b + 0.72, p.z0, p.x1, b + 0.78, p.z1, [0.25, 0.22, 0.3]); bx(SC, x - 0.05, b + 0.78, z - 0.25, x + 0.05, b + 1.1, z + 0.25, [0.2, 0.5, 0.9]); break;
        case 'counter': case 'bar': {
          const top = p.kind === 'bar' ? [0.25, 0.16, 0.1] : [0.85, 0.85, 0.85];
          bx(p.kind === 'bar' ? WO : GL, p.x0, b, p.z0, p.x1, b + 1.02, p.z1, p.kind === 'bar' ? [0.9, 0.8, 0.75] : [0.2, 0.12, 0.35]);
          bx(p.kind === 'bar' ? WO : GL, p.x0 - 0.06, b + 1.02, p.z0, p.x1 + 0.06, b + 1.1, p.z1, top);
          bx(NE, p.x1 + 0.001, b + 0.08, p.z0, p.x1 + 0.012, b + 0.13, p.z1, p.kind === 'bar' ? [1, 0.3, 0.75] : [0.3, 0.9, 1]);
          if (p.kind === 'counter' && p.data.first) { bx(MT, x - 0.2, b + 1.1, z - 0.3, x + 0.2, b + 1.15, z + 0.3, [0.1, 0.1, 0.1]); bx(SC, x - 0.03, b + 1.15, z - 0.28, x + 0.03, b + 1.5, z + 0.28, [0.2, 0.45, 0.8]); }
          if (p.kind === 'bar' && rng() < 0.7) for (let k = 0; k < 2; k++) H.cyl(B('glass'), x + (rng() - 0.5) * 0.4, z + (rng() - 0.5) * 1.4, b + 1.1, b + 1.25, 0.04, 0.035, 8, [1, 1, 1]);
          break;
        }
        case 'shoes': {   // casiers à chaussures : grille de cases avec paires colorées
          bx(WO, p.x0, b, p.z0, p.x1, b + 2.3, p.z1, [0.6, 0.5, 0.45]);
          for (let r = 0; r < 6; r++) for (let k = 0; k < 5; k++) {
            const y0 = b + 0.12 + r * 0.36, z0 = p.z0 + 0.05 + k * 0.38;
            bx(MT, p.x1 - 0.02, y0, z0, p.x1 + 0.005, y0 + 0.3, z0 + 0.33, [0.05, 0.05, 0.05]);
            if (rng() < 0.8) { const c = rng() < 0.5 ? [0.7, 0.1, 0.12] : [0.12, 0.25, 0.6]; bx(GL, p.x1 - 0.3, y0, z0 + 0.04, p.x1 - 0.02, y0 + 0.1, z0 + 0.15, c); bx(GL, p.x1 - 0.3, y0, z0 + 0.18, p.x1 - 0.02, y0 + 0.1, z0 + 0.29, c); }
          }
          break;
        }
        case 'ballrack': {
          bx(CH, p.x0, b + 0.45, p.z0, p.x1, b + 0.5, p.z1, [1, 1, 1]); bx(CH, p.x0, b + 0.95, p.z0, p.x1, b + 1.0, p.z1, [1, 1, 1]);
          for (const zz of [p.z0 + 0.05, p.z1 - 0.05]) bx(CH, p.x0, b, zz - 0.03, p.x1, b + 1.15, zz + 0.03, [1, 1, 1]);
          for (const yy of [b + 0.62, b + 1.12]) for (let k = 0; k < 7; k++) H.icoBlob(GL, x + 0.05, yy, p.z0 + 0.18 + k * 0.26, 0.11, hsl(Math.floor(rng() * 360), 0.7, 0.42), 1, 1);
          break;
        }
        case 'lbench': bx(WO, p.x0, b + 0.38, p.z0, p.x1, b + 0.45, p.z1, [0.8, 0.7, 0.65]); for (const s of [-1, 1]) bx(CH, x + s * 0.65 - 0.03, b, p.z0 + 0.05, x + s * 0.65 + 0.03, b + 0.38, p.z1 - 0.05, [1, 1, 1]); break;
        case 'vending': {
          const c = hsl(p.data.hue, 0.7, 0.4);
          bx(GL, p.x0, b, p.z0, p.x1, b + 1.9, p.z1, c);
          bx(SC, p.x0 + 0.08, b + 0.55, p.z1 + 0.001, p.x0 + 0.65, b + 1.75, p.z1 + 0.01, [0.85, 0.85, 0.75]);
          for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) bx(GL, p.x0 + 0.12 + k * 0.13, b + 0.62 + r * 0.23, p.z1 + 0.012, p.x0 + 0.2 + k * 0.13, b + 0.75 + r * 0.23, p.z1 + 0.02, hsl(Math.floor(rng() * 360), 0.8, 0.5));
          bx(MT, p.x0 + 0.72, b + 1.0, p.z1, p.x1 - 0.08, b + 1.4, p.z1 + 0.02, [0.1, 0.1, 0.1]);
          break;
        }
        case 'backbar': {
          bx(WO, p.x0, b, p.z0, p.x1, b + 0.95, p.z1, [0.7, 0.6, 0.55]);
          bx(B('glass'), p.x0, b + 1.0, p.z0, p.x0 + 0.03, b + 2.2, p.z1, [1, 1, 1]);
          for (const yy of [b + 1.35, b + 1.8]) { bx(WO, p.x0, yy - 0.03, p.z0, p.x1, yy, p.z1, [0.7, 0.6, 0.55]); for (let k = 0; k < 7; k++) { const zz = p.z0 + 0.15 + k * 0.26, c = [[0.2, 0.45, 0.2], [0.55, 0.3, 0.1], [0.8, 0.8, 0.85], [0.35, 0.1, 0.1]][Math.floor(rng() * 4)]; H.cyl(B('glass'), p.x0 + 0.3, zz, yy, yy + 0.26, 0.04, 0.04, 8, c); H.cyl(B('glass'), p.x0 + 0.3, zz, yy + 0.26, yy + 0.36, 0.04, 0.012, 8, c); } }
          bx(NE, p.x1 - 0.02, b + 2.15, p.z0, p.x1, b + 2.2, p.z1, [1, 0.35, 0.8]);
          break;
        }
        case 'stool': H.cyl(CH, x, z, b, b + 0.7, 0.03, 0.03, 6, [1, 1, 1], false); H.cyl(CH, x, z, b, b + 0.02, 0.2, 0.2, 10, [1, 1, 1]); H.cyl(GL, x, z, b + 0.66, b + 0.75, 0.19, 0.19, 12, [0.7, 0.12, 0.2]); break;
        case 'btable': case 'mtable': H.cyl(CH, x, z, b, b + 0.72, 0.04, 0.04, 6, [1, 1, 1], false); H.cyl(CH, x, z, b, b + 0.03, 0.26, 0.26, 10, [1, 1, 1]); H.cyl(WO, x, z, b + 0.72, b + 0.76, 0.45, 0.45, 16, [0.9, 0.85, 0.8]);
          if (inst) for (let k = 0; k < 2; k++) H.put(inst, 'furn_chair_stool', x + (k ? 0.75 : -0.75), b, z, rng() * 6, 0.9); break;
        case 'stall': {
          const s = p.data.back, X0 = p.x0, X1 = p.x1, Z0 = p.z0, Z1 = p.z1, c = [0.15, 0.13, 0.2], fx = s < 0 ? X1 - 0.06 : X0 + 0.06, zm = (Z0 + Z1) / 2;
          bx(GL, fx - 0.02, b + 0.15, Z0 + 0.03, fx + 0.02, b + 2.05, Z1 - 0.03, c);
          bx(GL, Math.min(fx, s < 0 ? X0 : X1), b + 0.15, Z0 + 0.03, Math.max(fx, s < 0 ? X0 : X1), b + 2.05, Z0 + 0.07, c);
          bx(GL, Math.min(fx, s < 0 ? X0 : X1), b + 0.15, Z1 - 0.07, Math.max(fx, s < 0 ? X0 : X1), b + 2.05, Z1 - 0.03, c);
          bx(CH, fx - s * 0.03 - 0.02, b + 0.95, zm + 0.55, fx - s * 0.03 + 0.02, b + 1.1, zm + 0.63, [1, 1, 1]);
          break;
        }
        case 'sink': { const wz = (p.cy + 1) * C; bx(GL, p.x0, b + 0.82, p.z0, p.x1, b + 0.9, p.z1, [0.1, 0.1, 0.12]); for (const xx of [p.x0 + 0.4, p.x1 - 0.4]) { bx(B('ceram'), xx - 0.22, b + 0.74, p.z0 + 0.08, xx + 0.22, b + 0.83, p.z1 - 0.08, [1, 1, 1]); H.cyl(CH, xx, wz - 0.1, b + 0.9, b + 1.08, 0.015, 0.015, 6, [1, 1, 1]); } bx(B('glass'), p.x0 + 0.05, b + 1.15, wz - 0.015, p.x1 - 0.05, b + 1.95, wz, [1, 1, 1]); break; }
        case 'urinal': bx(B('ceram'), p.x0, b + 0.45, p.z0, p.x1, b + 1.1, p.z1, [1, 1, 1]); break;
        case 'arcade': case 'claw': case 'pinball': {
          const fx = p.data ? p.data.fx || 0 : 0, fz = p.data ? p.data.fz || 0 : 0, c = hsl(p.data.hue, 0.7, 0.35);
          if (p.kind === 'pinball') {
            for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(CH, x + sx * 0.32 - 0.03, b, z + sz * 0.68 - 0.03, x + sx * 0.32 + 0.03, b + 0.8, z + sz * 0.68 + 0.03, [1, 1, 1]);
            H.quadN(SC, [[x - 0.34, b + 0.85, z + 0.7], [x + 0.34, b + 0.85, z + 0.7], [x + 0.34, b + 1.0, z - 0.7], [x - 0.34, b + 1.0, z - 0.7]], [0, 1, 0.1], [[0, 0], [1, 0], [1, 1], [0, 1]], hsl(p.data.hue, 0.8, 0.5));
            bx(GL, x - 0.37, b + 0.75, z - 0.75, x + 0.37, b + 0.85, z + 0.75, c); bx(GL, x - 0.37, b + 0.85, z - 0.78, x + 0.37, b + 1.6, z - 0.68, c); bx(SC, x - 0.3, b + 1.0, z - 0.67, x + 0.3, b + 1.5, z - 0.66, hsl(p.data.hue + 40, 0.9, 0.55));
            break;
          }
          if (p.kind === 'claw') {
            bx(GL, p.x0, b, p.z0, p.x1, b + 0.85, p.z1, c); bx(GL, p.x0, b + 1.85, p.z0, p.x1, b + 2.0, p.z1, c);
            for (const [sx, sz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const xx = sx ? p.x1 - 0.05 : p.x0, zz = sz ? p.z1 - 0.05 : p.z0; bx(CH, xx, b + 0.85, zz, xx + 0.05, b + 1.85, zz + 0.05, [1, 1, 1]); }
            bx(B('glass'), p.x0 + 0.02, b + 0.85, p.z0 + 0.02, p.x1 - 0.02, b + 1.85, p.z1 - 0.02, [1, 1, 1]);
            for (let k = 0; k < 14; k++) H.icoBlob(GL, p.x0 + 0.2 + rng() * 0.7, b + 0.95 + rng() * 0.15, p.z0 + 0.2 + rng() * 0.7, 0.09 + rng() * 0.05, hsl(Math.floor(rng() * 360), 0.6, 0.6), 1, 0);
            bx(NE, p.x0, b + 1.86, p.z0 - 0.001, p.x1, b + 1.99, p.z0, hsl(p.data.hue, 1, 0.6));
            break;
          }
          // borne d'arcade : caisse, écran incliné lumineux, panneau de commandes, fronton éclairé
          const ux = fx, uz = fz, cx2 = x, cz2 = z, hw = 0.4, dp = 0.42;
          const X0 = cx2 - (uz ? hw : dp), X1 = cx2 + (uz ? hw : dp), Z0 = cz2 - (ux ? hw : dp), Z1 = cz2 + (ux ? hw : dp);
          bx(GL, X0, b, Z0, X1, b + 1.9, Z1, c.map(v => v * 0.7));
          const fxp = cx2 + ux * (dp + 0.005), fzp = cz2 + uz * (dp + 0.005), lat = (a, yy, d) => ux ? [fxp + ux * d, yy, cz2 + a] : [cx2 + a, yy, fzp + uz * d];
          H.quadN(SC, [lat(-0.3, b + 1.15, 0), lat(0.3, b + 1.15, 0), lat(0.3, b + 1.6, -0.12), lat(-0.3, b + 1.6, -0.12)], [ux, 0.3, uz], [[0, 0], [1, 0], [1, 1], [0, 1]], hsl((p.data.hue + 180) % 360, 0.7, 0.55));
          H.quadN(NE, [lat(-0.38, b + 1.7, 0.01), lat(0.38, b + 1.7, 0.01), lat(0.38, b + 1.88, 0.01), lat(-0.38, b + 1.88, 0.01)], [ux, 0, uz], [[0, 0], [1, 0], [1, 1], [0, 1]], hsl(p.data.hue, 1, 0.6));
          const pa = lat(-0.38, b + 0.95, 0.18), pb2 = lat(0.38, b + 1.02, 0);
          bx(GL, Math.min(pa[0], pb2[0]), b + 0.92, Math.min(pa[2], pb2[2]), Math.max(pa[0], pb2[0]), b + 1.0, Math.max(pa[2], pb2[2]), [0.1, 0.1, 0.12]);
          for (let k = 0; k < 3; k++) { const q2 = lat(-0.15 + k * 0.15, b + 1.02, 0.09); H.cyl(GL, q2[0], q2[2], b + 1.0, b + 1.03, 0.025, 0.025, 8, hsl(k * 120, 0.9, 0.5)); }
          break;
        }
        case 'hockey': bx(GL, p.x0, b, p.z0, p.x1, b + 0.78, p.z1, [0.15, 0.2, 0.55]); bx(B('ceram'), p.x0 + 0.06, b + 0.78, p.z0 + 0.06, p.x1 - 0.06, b + 0.8, p.z1 - 0.06, [0.9, 0.95, 1]); bx(GL, p.x0, b + 0.78, p.z0, p.x1, b + 0.86, p.z0 + 0.06, [0.9, 0.2, 0.2]); bx(GL, p.x0, b + 0.78, p.z1 - 0.06, p.x1, b + 0.86, p.z1, [0.9, 0.2, 0.2]); H.cyl(GL, x, z - 0.6, b + 0.8, b + 0.86, 0.06, 0.06, 10, [0.9, 0.2, 0.2]); H.cyl(GL, x, z + 0.6, b + 0.8, b + 0.86, 0.06, 0.06, 10, [0.2, 0.5, 0.9]); break;
        case 'dance': { bx(MT, p.x0, b, p.z0, p.x1, b + 0.25, p.z1, [0.12, 0.12, 0.14]); for (let k = 0; k < 4; k++) { const ax = x + (k % 2 ? 0.4 : -0.4), az = z + (k < 2 ? -0.35 : 0.35); bx(NE, ax - 0.25, b + 0.25, az - 0.25, ax + 0.25, b + 0.26, az + 0.25, hsl(k * 90, 1, 0.55)); } bx(GL, p.x1 - 0.3, b, z - 0.6, p.x1 + 0.4, b + 2.3, z + 0.6, [0.5, 0.15, 0.55]); bx(SC, p.x1 - 0.31, b + 1.2, z - 0.45, p.x1 - 0.3, b + 1.9, z + 0.45, [0.4, 0.8, 1]); break; }
        case 'pool': {
          if (p.data.part) break;
          const cx2 = p.x + 1, X0 = cx2 - 1.32, X1 = cx2 + 1.32, Z0 = z - 0.76, Z1 = z + 0.76;
          bx(WO, X0, b + 0.62, Z0, X1, b + 0.8, Z1, [0.8, 0.6, 0.45]);
          bx(FE, X0 + 0.12, b + 0.8, Z0 + 0.12, X1 - 0.12, b + 0.81, Z1 - 0.12, [1, 1, 1]);
          for (const [x0, z0, x1, z1] of [[X0, Z0, X1, Z0 + 0.12], [X0, Z1 - 0.12, X1, Z1], [X0, Z0, X0 + 0.12, Z1], [X1 - 0.12, Z0, X1, Z1]]) bx(WO, x0, b + 0.8, z0, x1, b + 0.86, z1, [0.7, 0.5, 0.38]);
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(WO, cx2 + sx * 1.15 - 0.09, b, z + sz * 0.6 - 0.09, cx2 + sx * 1.15 + 0.09, b + 0.62, z + sz * 0.6 + 0.09, [0.6, 0.45, 0.35]);
          for (let k = 0; k < 8; k++) H.icoBlob(GL, X0 + 0.4 + rng() * 1.8, b + 0.85, Z0 + 0.3 + rng() * 0.9, 0.028, hsl(Math.floor(rng() * 360), 0.8, 0.5), 1, 1);
          H.tube(WO, [[X0 + 0.3, b + 0.87, Z0 + 0.4], [X0 + 1.7, b + 0.87, Z0 + 0.9]], [0.012, 0.006], 5, [0.85, 0.7, 0.5], 1);
          // lampe de billard suspendue
          bx(GL, cx2 - 0.9, 2.6, z - 0.22, cx2 + 0.9, 2.78, z + 0.22, [0.1, 0.35, 0.2]); bx(B('glow'), cx2 - 0.85, 2.59, z - 0.18, cx2 + 0.85, 2.6, z + 0.18, [1, 0.92, 0.75]);
          for (const s of [-1, 1]) H.cyl(CH, cx2 + s * 0.6, z, 2.78, 3.7, 0.006, 0.006, 4, [1, 1, 1], false);
          break;
        }
        case 'cuerack': bx(WO, p.x0, b + 0.6, p.z0, p.x1, b + 1.9, p.z0 + 0.06, [0.7, 0.55, 0.45]); for (let k = 0; k < 6; k++) H.tube(WO, [[p.x0 + 0.12 + k * 0.19, b + 0.25, p.z0 + 0.1], [p.x0 + 0.12 + k * 0.19, b + 1.75, p.z0 + 0.1]], [0.016, 0.008], 5, [0.85, 0.7, 0.5], 1); break;
        case 'armchair': if (inst) H.put(inst, 'furn_armchair', x, b, z, -Math.PI / 2, 0.95); break;
        case 'desk': bx(WO, p.x0, b + 0.72, p.z0, p.x1, b + 0.78, p.z1, [0.7, 0.62, 0.55]); for (const s of [-1, 1]) bx(MT, x + s * 0.8 - 0.03, b, p.z0, x + s * 0.8 + 0.03, b + 0.72, p.z1, [0.2, 0.2, 0.22]); bx(MT, x - 0.25, b + 0.78, z - 0.05, x + 0.25, b + 1.12, z + 0.0, [0.1, 0.1, 0.1]); bx(SC, x - 0.23, b + 0.8, z + 0.001, x + 0.23, b + 1.1, z + 0.005, [0.15, 0.25, 0.4]); if (inst) H.put(inst, 'furn_chair_A', x, b, z + 0.8, Math.PI, 0.9); break;
        case 'locker': for (let k = 0; k < 3; k++) { const z0 = p.z0 + k * 0.63; bx(GL, p.x0, b, z0 + 0.01, p.x1, b + 2.0, z0 + 0.62, [0.3, 0.38, 0.5]); for (let s = 0; s < 4; s++) bx(MT, p.x0 - 0.005, b + 1.6 + s * 0.06, z0 + 0.15, p.x0, b + 1.63 + s * 0.06, z0 + 0.47, [0.08, 0.08, 0.1]); } break;
        case 'safe': bx(CH, p.x0, b, p.z0, p.x1, b + 1.0, p.z1, [0.35, 0.35, 0.38]); H.cyl(CH, p.x0 - 0.02, z, b + 0.5, b + 0.56, 0.08, 0.08, 10, [1, 1, 1]); break;
        case 'rack': {   // étagère métallique chargée de cartons
          for (const xx of [p.x0 + 0.04, p.x1 - 0.04]) for (const zz of [p.z0 + 0.04, p.z1 - 0.04]) bx(CH, xx - 0.03, b, zz - 0.03, xx + 0.03, b + 2.4, zz + 0.03, [0.55, 0.6, 0.7]);
          for (let k = 0; k < 4; k++) { const yy = b + 0.1 + k * 0.75; bx(CH, p.x0, yy, p.z0, p.x1, yy + 0.04, p.z1, [0.6, 0.62, 0.66]); for (let s = 0; s < 3; s++) if (rng() < 0.75) { const bw = 0.4 + rng() * 0.2, bh = 0.25 + rng() * 0.35, cx3 = p.x0 + 0.35 + s * 0.65; bx(PB, cx3 - bw / 2, yy + 0.04, z - 0.3, cx3 + bw / 2, yy + 0.04 + bh, z + 0.3, [0.62 + rng() * 0.1, 0.48, 0.32]); } }
          break;
        }
        case 'pinsetter': {   // requilleuse : châssis, plateau tournant, tapis, moteur
          bx(MT, p.x0 + 0.1, b, p.z0 + 0.1, p.x1 - 0.2, b + 2.8, p.z1 - 0.1, [0.2, 0.22, 0.26]);
          bx(CH, p.x0 + 0.05, b + 0.9, p.z0 + 0.05, p.x1 - 0.15, b + 1.0, p.z1 - 0.05, [0.9, 0.5, 0.15]);
          H.cyl(CH, x, z, b + 1.9, b + 2.0, 0.85, 0.85, 16, [0.5, 0.52, 0.55]);
          bx(GL, p.x1 - 0.25, b + 1.2, z - 0.25, p.x1 - 0.05, b + 1.7, z + 0.25, [0.15, 0.3, 0.6]);
          for (let k = 0; k < 4; k++) H.tube(PN, [[x - 0.4 + k * 0.25, b + 2.05, z + 0.5], [x - 0.4 + k * 0.25, b + 2.05, z + 0.12]], [0.05, 0.03], 6, [1, 1, 1], 1);
          bx(NE, p.x1 - 0.21, b + 1.75, z - 0.05, p.x1 - 0.19, b + 1.8, z + 0.05, rng() < 0.7 ? [0.2, 1, 0.3] : [1, 0.2, 0.1]);
          break;
        }
        case 'bench': bx(WO, p.x0, b + 0.88, p.z0, p.x1, b + 0.95, p.z1, [0.75, 0.6, 0.45]); bx(MT, p.x0 + 0.05, b, p.z0 + 0.05, p.x1 - 0.05, b + 0.88, p.z1 - 0.05, [0.3, 0.32, 0.36]); bx(B('p'), p.x0 + 0.1, b + 0.95, z - 0.2, p.x0 + 0.4, b + 1.15, z + 0.3, [0.7, 0.15, 0.1]); break;
        case 'compressor': H.cyl(MT, x, z, b + 0.2, b + 1.0, 0.35, 0.35, 12, [0.75, 0.2, 0.15]); bx(MT, p.x0, b, p.z0, p.x1, b + 0.2, p.z1, [0.2, 0.2, 0.22]); bx(MT, x - 0.25, b + 1.0, z - 0.2, x + 0.25, b + 1.4, z + 0.2, [0.25, 0.25, 0.28]); break;
        case 'crate': bx(PB, p.x0, b, p.z0, p.x1, b + 0.9, p.z1, [0.6, 0.5, 0.36]); for (let k = 0; k < 5; k++) H.tube(PN, [[p.x0 + 0.2 + k * 0.22, b + 0.95, p.z0 + 0.2], [p.x0 + 0.25 + k * 0.2, b + 0.95, p.z1 - 0.2]], [0.05, 0.03], 6, [1, 1, 1], 1); break;
        case 'rail': { const d = p.data; bx(CH, p.x0, b + 0.98, p.z0, p.x1, b + 1.05, p.z1, [1, 1, 1]); bx(B('glass'), p.x0 + (d.sx ? 0.05 : 0), b + 0.1, p.z0 + (d.sy ? 0.05 : 0), p.x1 - (d.sx ? 0.05 : 0), b + 0.95, p.z1 - (d.sy ? 0.05 : 0), [1, 1, 1]); for (const t of [0.05, 0.95]) { const px = d.sx ? (p.x0 + p.x1) / 2 : p.x0 + (p.x1 - p.x0) * t, pz = d.sy ? (p.z0 + p.z1) / 2 : p.z0 + (p.z1 - p.z0) * t; bx(CH, px - 0.03, b, pz - 0.03, px + 0.03, b + 1.0, pz + 0.03, [1, 1, 1]); } break; }
        case 'ptable': { const c = hsl(p.data.hue, 0.6, 0.5); bx(GL, p.x0, b + 0.72, p.z0, p.x1, b + 0.76, p.z1, c); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(CH, x + sx * 0.8 - 0.02, b, z + sz * 0.4 - 0.02, x + sx * 0.8 + 0.02, b + 0.72, z + sz * 0.4 + 0.02, [1, 1, 1]); for (let k = 0; k < 3; k++) { const bxx = x - 0.6 + k * 0.6; H.tube(MT, [[bxx, b + 0.76, z], [bxx + 0.05, b + 1.5, z + 0.05]], [0.003, 0.003], 3, [0.9, 0.9, 0.9], 1); H.icoBlob(GL, bxx + 0.05, b + 1.68, z + 0.05, 0.18, hsl(Math.floor(rng() * 360), 0.75, 0.5), 1.2, 1); } break; }
      }
    }
    // écrans de score suspendus (un par paire de pistes)
    for (let k = 0; k < 6; k++) {
      const zc = (3 + k * 2 + 1) * C, xs = 13 * C + 0.2;
      bx(MT, xs - 0.08, 3.0, zc - 0.75, xs + 0.02, 3.85, zc + 0.75, [0.06, 0.06, 0.07]);
      for (const s of [-1, 1]) H.cyl(CH, xs, zc + s * 0.5, 3.85, 8, 0.012, 0.012, 4, [1, 1, 1], false);
      const cv = P.mk(384, 216, (g, w, h) => {
        g.fillStyle = '#071233'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd84a'; g.font = "bold 26px 'Segoe UI', Arial"; g.fillText('PISTES ' + (k * 2 + 1) + ' - ' + (k * 2 + 2), 14, 32);
        g.strokeStyle = '#4a6cff'; g.lineWidth = 2; for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) g.strokeRect(14 + c * 35, 60 + r * 70, 35, 60);
        g.fillStyle = '#ffffff'; g.font = "bold 22px 'Segoe UI', Arial"; for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) g.fillText(['X', '9', '7', '/', '8', 'X', '6', '-'][Math.floor(Math.random() * 8)], 24 + c * 35, 95 + r * 70);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, h);
      });
      const me = H.signMesh(cv, 1.4, 0.78, {}); me.position.set(xs - 0.09, 3.42, zc); me.rotation.y = -Math.PI / 2; group.add(me);
    }
    // luminaires suspendus (les lumières « hang » sont dessinées par le monde à leur hauteur) : tiges jusqu'au plafond
    for (const l of m.lights) if (l.hang) { const cx = (l.cx + 0.5) * C, cz = (l.cy + 0.5) * C; for (const s of [-1, 1]) H.cyl(CH, cx + s * 0.5, cz, l.y, 8, 0.01, 0.01, 4, [1, 1, 1], false); bx(MT, cx - 0.66, l.y - 0.01, cz - 0.38, cx + 0.66, l.y + 0.12, cz + 0.38, [0.1, 0.1, 0.12]); }
    // gouttières en relief : petites rigoles le long de chaque piste
    for (let ln = 0; ln < 12; ln++) { const zc = (3 + ln) * C + 1; for (const s of [-1, 1]) { const z0 = zc + s * 0.64; bx(MT, 16 * C, 0, z0 - 0.115, 25 * C, 0.004, z0 + 0.115, [0.15, 0.15, 0.17]); } }
    // néons et enseignes
    sign('BOWLING', 3.4, 0.8, C + 0.02, 2.95, 9 * C + 1, Math.PI / 2, '#100818', '#ff4fc4', true);
    sign('LOCATION DE CHAUSSURES', 3.2, 0.45, 6.5 * C + 0.38, 2.4, 5 * C, Math.PI / 2, '#1a1430', '#7fe8ff', true); for (const s of [-1, 1]) H.cyl(CH, 6.5 * C + 0.36, 5 * C + s * 1.4, 2.62, 4 - 0.3, 0.01, 0.01, 4, [1, 1, 1], false);
    sign('BAR', 1.6, 0.55, 5.5 * C + 1, 3.35, 17 * C + 1, Math.PI, '#170812', '#ff6fd0', true);
    sign('ARCADE', 1.8, 0.5, 13 * C + 1, 3.0, 17 * C - 0.02, Math.PI, '#0b0b18', '#59f2ff', true);
    sign('BILLARD', 1.8, 0.5, 23 * C + 1, 3.0, 17 * C - 0.02, Math.PI, '#0b1810', '#7dff8a', true);
    sign('HOMMES', 1.0, 0.3, 3 * C + 1, 2.5, 24 * C - 0.02, Math.PI, '#e9ecee', '#20384a', false);
    sign('FEMMES', 1.0, 0.3, 7 * C + 1, 2.5, 24 * C - 0.02, Math.PI, '#e9ecee', '#4a2038', false);
    sign('ACCÈS RÉSERVÉ AU PERSONNEL', 2.2, 0.35, 26 * C + 1, 2.7, 16 * C + 2 - 0.02, Math.PI, '#e8c21c', '#1a1a1a', false);
    sign('RÉSERVE', 1.3, 0.35, 29 * C + 1, 2.6, 27 * C - 0.02, Math.PI, '#e9ecee', '#202020', false);
    sign('PERSONNEL', 1.3, 0.35, 16 * C + 1, 2.6, 27 * C - 0.02, Math.PI, '#e9ecee', '#202020', false);
    sign('ANNIVERSAIRES', 1.8, 0.45, 6 * C + 1, SH + 2.6, 17 * C - 0.02, Math.PI, '#1a0b22', '#ffd84a', true);
  }
  Wd.decor.bowling = bowlDecor;
})();

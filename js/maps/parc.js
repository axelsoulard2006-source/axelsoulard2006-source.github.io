/* ===== maps/parc.js : PARC — grand jardin public, la nuit, à ciel ouvert
   Allées de gravier, pelouses, grands arbres, jardin à la française (haies formant un labyrinthe), kiosque à musique,
   aire de jeux clôturée, bassin avec jet d'eau et petit pont, buvette + toilettes publiques dont le toit-terrasse
   est accessible par deux escaliers, lampadaires, bancs, grille d'enceinte.
   Haies, bassin, clôtures : murs « logiques » (m.noWall) dessinés par le décor, pas comme des murs de 4 m. ===== */
(function () {
  const BR = window.BR, TX = BR.Tex, P = TX.P, Wd = BR.World;

  /* ---------------- textures ---------------- */
  Object.assign(TX.MAKE, {
    parkGrass: () => P.mk(512, 512, (g, w, h) => {
      g.fillStyle = '#466f33'; g.fillRect(0, 0, w, h);
      P.soft(g, w, h, 18, '28,55,18', 0.1, 0.22, 30, 110); P.soft(g, w, h, 12, '140,180,85', 0.05, 0.12, 30, 90); P.soft(g, w, h, 6, '95,80,45', 0.08, 0.16, 15, 45);
      for (let k = 0; k < 4200; k++) { const x = Math.random() * w, y = Math.random() * h, l = 4 + Math.random() * 8; g.strokeStyle = ['rgba(30,62,22,0.55)', 'rgba(120,165,75,0.45)', 'rgba(70,110,45,0.5)'][k % 3]; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y - l); g.stroke(); }
      P.speckle(g, w, h, 60, ['rgba(245,245,215,0.7)', 'rgba(235,215,90,0.6)', 'rgba(200,170,220,0.6)'], 1.5, 2.8);
      // feuilles mortes
      for (let k = 0; k < 40; k++) { g.fillStyle = ['rgba(150,95,40,0.7)', 'rgba(180,130,50,0.6)', 'rgba(110,70,35,0.7)'][k % 3]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3, 1.6, Math.random() * 3, 0, 6.283); g.fill(); }
    }),
    parkGravel: () => P.gravel('#a89b83'),
    // touffe d'herbe haute : brins qui partent du bas (fond transparent)
    grassCard: () => P.mk(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.lineCap = 'round';
      for (let k = 0; k < 70; k++) { const x0 = w * (0.3 + Math.random() * 0.4), x1 = x0 + (Math.random() - 0.5) * w * 0.8, y1 = h * (0.05 + Math.random() * 0.5); g.strokeStyle = ['#5f9440', '#76a84e', '#4c7a34', '#8cb85c', '#a3ad68'][k % 5]; g.lineWidth = 1.5 + Math.random() * 2; g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo((x0 + x1) / 2, h * 0.6, x1, y1); g.stroke(); }
    }),
    parkPavers: () => P.mk(256, 256, (g, w, h) => { P.pavers(g, w, h, 32, 32, '#8f8a80', '#55524c', 0.18, 0.5, 2); P.soft(g, w, h, 6, '30,28,22', 0.06, 0.14, 15, 50); P.speckle(g, w, h, 1500, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.12)'], 1, 2); P.fine(g, w, h, 5); }),
    parkRubber: () => P.rubber('#8e3a2e'),
    parkSand: () => TX.MAKE.sand(),
    parkPlank: () => P.mk(256, 256, (g, w, h) => {
      for (let x = 0; x < w; x += 32) { g.fillStyle = P.vary('#7a5a3c', 0.18); g.fillRect(x, 0, 32, h); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, 0, 3, h); g.strokeStyle = 'rgba(50,30,15,0.25)'; g.lineWidth = 1; for (let s = 0; s < 3; s++) { g.beginPath(); const xx = x + 6 + Math.random() * 20; g.moveTo(xx, 0); for (let y = 0; y <= h; y += 16) g.lineTo(xx + Math.sin(y * 0.05 + s) * 2, y); g.stroke(); } g.fillStyle = 'rgba(30,30,30,0.6)'; g.fillRect(x + 8, 20, 3, 3); g.fillRect(x + 22, 20, 3, 3); g.fillRect(x + 8, 148, 3, 3); g.fillRect(x + 22, 148, 3, 3); }
      P.soft(g, w, h, 6, '20,30,10', 0.08, 0.16, 15, 50); P.fine(g, w, h, 6);
    }),
    parkTerrace: () => P.mk(256, 256, (g, w, h) => { P.pavers(g, w, h, 64, 64, '#b9ad97', '#7c7366', 0.08, 0, 2); P.soft(g, w, h, 6, '40,35,25', 0.06, 0.14, 15, 50); P.speckle(g, w, h, 1200, ['rgba(0,0,0,0.1)', 'rgba(255,255,255,0.08)'], 1, 2); P.fine(g, w, h, 4); }),
    parkTerracotta: () => P.mk(256, 256, (g, w, h) => { P.pavers(g, w, h, 64, 64, '#a8583a', '#d8cbb4', 0.12, 0, 3); P.soft(g, w, h, 5, '40,25,15', 0.06, 0.12, 15, 50); P.fine(g, w, h, 4); }),
    parkToiletFloor: () => P.tiles('#c9ced0', '#b6bcbf', 4, 'rgba(70,74,78,0.6)'),
    parkFaience: () => P.faience('#e4ecee', '#9ba5a8'),
    parkPlaster: () => P.paint('#e6dcc6', '#4b5a4f'),
    parkHedge: () => P.leafDense('#24391a'),
    parkStone: () => P.mk(256, 256, (g, w, h) => { g.fillStyle = '#a49d90'; g.fillRect(0, 0, w, h); P.soft(g, w, h, 10, '60,55,45', 0.08, 0.16, 15, 60); P.soft(g, w, h, 5, '70,90,50', 0.08, 0.16, 10, 30); P.speckle(g, w, h, 2000, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.1)'], 1, 2.5); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 3, h); P.fine(g, w, h, 6); }),
    parkZinc: () => P.mk(256, 256, (g, w, h) => { g.fillStyle = '#5f6b70'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 3, 0, 2, h); } P.soft(g, w, h, 6, '40,70,60', 0.1, 0.2, 15, 60); P.fine(g, w, h, 5); }),
    parkIron: () => P.metal('#4a554c'),
    parkPaintMetal: () => P.mk(64, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); P.soft(g, w, h, 4, '90,60,30', 0.1, 0.25, 5, 14); P.fine(g, w, h, 10); }),
    parkAsphalt: () => TX.MAKE.asphalt(),
  });
  TX.FACADES.pavilion = { wall: '#d6cbb2', stone: true, band: '#e9e1cf', frameOut: '#3d5a48', frameIn: '#2f4638', sillCol: '#e9e1cf', glass: ['#2c3b4a', '#151d26'], ww: 1.25, wh: 2.0, sill: 0.7, lit: 0.2, transom: 0.25 };

  /* ---------------- thème ---------------- */
  TX.THEMES.park = {
    name: 'Parc', fog: 0x0a1018, fogDensity: 0.026, ambient: 0x46566c, ambientI: 0.22, hemi: [0x7488b4, 0x18200f, 0.3], exposure: 1.1,
    lightColor: 0xffcf8a, panel: '#f4f7ff', flicker: 0.12, deadLights: 0.15, outdoor: true, sky: 0x070b16, moon: 0x6a7ea8, lightI: 1.15, flashI: 1,
    env: { kind: 'night', glow: '#ff9a4a' },
    tex: {
      floor: {
        1: { t: 'parkGrass', rep: [0.5, 0.5], rough: 0.95, n: 1.2 }, 2: { t: 'parkGravel', rough: 0.9, n: 2, puddle: 0.25 }, 3: { t: 'parkPavers', rough: 0.7, n: 1.8, puddle: 0.3 },
        4: { t: 'parkRubber', rough: 0.85, n: 1.2 }, 5: { t: 'parkSand', rough: 1, n: 1.5 }, 7: { t: 'parkPlank', rough: 0.75, n: 2 }, 8: { t: 'parkToiletFloor', rough: 0.25, env: 1.8, wet: 0 },
        9: { t: 'parkTerrace', rough: 0.7, puddle: 0.35, n: 1.5 }, 10: { t: 'parkTerracotta', rough: 0.4, env: 1.2, wet: 0 }, 0: { t: 'parkGrass', rep: [0.5, 0.5], rough: 0.95 },
      },
      wall: { 1: { facade: 'pavilion' }, 2: { t: 'parkFaience', rough: 0.2, env: 1.6, wet: 0 }, 0: { t: 'parkStone' } },
      wallIn: { t: 'parkPlaster', wet: 0 },
      ci: { t: 'ceilC' }, co: { t: 'parkStone' }, e: { t: 'parkStone' }, r: { t: 'stairsPark', rough: 0.8 }, rs: { t: 'parkStone' }, rr: { t: 'parkStone' },
    },
    mats: {
      hedge: { t: 'parkHedge', rough: 0.9, n: 1.8 },
      stone: { t: 'parkStone', rough: 0.8, n: 1.6 },
      plank: { t: 'parkPlank', rough: 0.75, n: 1.6 },
      iron: { t: 'parkIron', rough: 0.45, metal: 0.6, env: 1, n: 0.4 },
      zinc: { t: 'parkZinc', rough: 0.4, metal: 0.55, env: 1.2, n: 1 },
      pmetal: { t: 'parkPaintMetal', rough: 0.4, metal: 0.2, env: 1, n: 0.6 },
      ceram: { color: '#f3f3ef', rough: 0.12, env: 1.6 },
      mud: { color: '#14120d', rough: 1, env: 0 },
      out: { t: 'parkAsphalt', rep: [0.25, 0.25], rough: 0.85, puddle: 0.35, n: 1.4 },
      lantern: { basic: true, color: '#ffe0a0' },
      jet: { color: '#cfe8ff', rough: 0.05, transparent: true, opacity: 0.45, env: 2, emissive: '#16283a' },
      tuft: { t: 'grassCard', rough: 0.95, alphaTest: 0.4, env: 0, n: 0, double: true },
      water: { color: '#0d1a22', rough: 0.03, metal: 0.05, transparent: true, opacity: 0.92, nmap: 'water', nrep: [0.35, 0.35], n: 0.5, env: 1.1, flow: [0.01, 0.006], emissive: '#02070b' },
    },
  };
  TX.MAKE.stairsPark = () => P.stairs('#a39c8f', '#6d675d');

  /* ---------------- génération ---------------- */
  const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  function genPark(def, seed, diff, rng, H) {
    const { FLOOR, WALL, VOID } = H;
    const W = 58, Hh = 58, F = 2;
    const m = H.newMap('park', def, W, Hh, F, seed);
    const Z = { grass: 1, path: 2, paved: 3, rubber: 4, sand: 5, bridge: 7, tile: 8, terrace: 9, cafe: 10 };
    const WZ = { facade: 1, tileW: 2, hedge: 3, fence: 4, pond: 5, pfence: 6 };
    m.noWall = [new Uint8Array(m.WH), new Uint8Array(m.WH)];
    const id = (x, y) => y * W + x;
    const hide = (x, y, z) => { H.set(m, 0, x, y, WALL, z); m.noWall[0][id(x, y)] = 1; };
    for (let i = 0; i < m.WH; i++) { m.t[0][i] = FLOOR; m.zone[0][i] = Z.grass; m.t[1][i] = VOID; }
    // grille d'enceinte
    for (let x = 0; x < W; x++) for (const y of [0, Hh - 1]) { hide(x, y, WZ.fence); m.t[1][id(x, y)] = WALL; m.noWall[1][id(x, y)] = 1; }
    for (let y = 0; y < Hh; y++) for (const x of [0, W - 1]) { hide(x, y, WZ.fence); m.t[1][id(x, y)] = WALL; m.noWall[1][id(x, y)] = 1; }
    const path = (x0, y0, x1, y1, z) => H.rect(m, 0, x0, y0, x1, y1, FLOOR, z || Z.path);
    // allées : tour du parc, grande croix, place centrale
    path(3, 3, 54, 4); path(3, 53, 54, 54); path(3, 3, 4, 54); path(53, 3, 54, 54);
    path(5, 28, 52, 29); path(28, 5, 29, 52);
    H.rect(m, 0, 23, 23, 34, 34, FLOOR, Z.paved);
    // --- jardin à la française : labyrinthe de haies (pièces de 2×2 cases, haies d'une case) ---
    const MX = 6, MY = 6, NX = 6, NY = 5;
    for (let y = MY; y <= MY + NY * 3; y++) for (let x = MX; x <= MX + NX * 3; x++) {
      if ((x - MX) % 3 === 0 || (y - MY) % 3 === 0) hide(x, y, WZ.hedge); else H.set(m, 0, x, y, FLOOR, Z.path);
    }
    const seen = new Uint8Array(NX * NY), st = [[ri(rng, 0, NX - 1), ri(rng, 0, NY - 1)]]; seen[st[0][1] * NX + st[0][0]] = 1;
    const open = (i, j, di, dj) => { // ouvre la haie entre la pièce (i,j) et sa voisine
      if (di) { const x = MX + 3 * Math.max(i, i + di); for (let k = 1; k <= 2; k++) H.set(m, 0, x, MY + 3 * j + k, FLOOR, Z.path), m.noWall[0][id(x, MY + 3 * j + k)] = 0; }
      else { const y = MY + 3 * Math.max(j, j + dj); for (let k = 1; k <= 2; k++) H.set(m, 0, MX + 3 * i + k, y, FLOOR, Z.path), m.noWall[0][id(MX + 3 * i + k, y)] = 0; }
    };
    while (st.length) {
      const [i, j] = st[st.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => i + a >= 0 && j + b >= 0 && i + a < NX && j + b < NY && !seen[(j + b) * NX + i + a]);
      if (!nb.length) { st.pop(); continue; }
      const [a, b] = nb[Math.floor(rng() * nb.length)]; open(i, j, a, b); seen[(j + b) * NX + i + a] = 1; st.push([i + a, j + b]);
    }
    for (let k = 0; k < 5; k++) { const i = ri(rng, 0, NX - 2), j = ri(rng, 0, NY - 1); open(i, j, 1, 0); }   // boucles
    for (let k = 0; k < 3; k++) { const i = ri(rng, 0, NX - 1), j = ri(rng, 0, NY - 2); open(i, j, 0, 1); }
    // entrées du jardin
    const gate = (x, y) => { H.set(m, 0, x, y, FLOOR, Z.path); m.noWall[0][id(x, y)] = 0; };
    for (const k of [1, 2]) { gate(MX + 3 * 2 + k, MY + NY * 3); gate(MX + 3 * 4 + k, MY + NY * 3); gate(MX + NX * 3, MY + 3 + k); gate(MX + 3 + k, MY); gate(MX, MY + 9 + k); }
    // --- bassin (forme organique) traversé par un petit pont ---
    const PX = 41, PY = 14, RX = 8.6, RY = 5.4, ph1 = rng() * 6, ph2 = rng() * 6;
    for (let y = 6; y <= 24; y++) for (let x = 30; x <= 52; x++) {
      const a = Math.atan2(y - PY, x - PX), k = 1 + 0.13 * Math.sin(a * 3 + ph1) + 0.08 * Math.sin(a * 5 + ph2);
      if (((x - PX) / RX) ** 2 + ((y - PY) / RY) ** 2 < k * k) hide(x, y, WZ.pond);
    }
    for (let y = 5; y <= 27; y++) for (let x = 40; x <= 41; x++) { const i = id(x, y), wasPond = m.t[0][i] === WALL; H.set(m, 0, x, y, FLOOR, wasPond ? Z.bridge : Z.path); m.noWall[0][i] = 0; }
    // --- aire de jeux clôturée ---
    const AX0 = 9, AY0 = 33, AX1 = 22, AY1 = 46;
    for (let y = AY0; y <= AY1; y++) for (let x = AX0; x <= AX1; x++) {
      if (x === AX0 || x === AX1 || y === AY0 || y === AY1) hide(x, y, WZ.pfence); else H.set(m, 0, x, y, FLOOR, Z.rubber);
    }
    for (const k of [15, 16]) { H.set(m, 0, k, AY0, FLOOR, Z.rubber); m.noWall[0][id(k, AY0)] = 0; }
    for (const k of [39, 40]) { H.set(m, 0, AX1, k, FLOOR, Z.rubber); m.noWall[0][id(AX1, k)] = 0; }
    path(15, 30, 16, AY0 - 1); path(AX1 + 1, 39, 27, 40);
    H.rect(m, 0, 18, 41, 21, 44, FLOOR, Z.sand);
    // --- buvette + toilettes publiques (toit-terrasse) ---
    const BX0 = 36, BY0 = 41, BX1 = 47, BY1 = 48;
    H.rect(m, 0, BX0, BY0, BX1, BY1, WALL, WZ.facade);
    H.rect(m, 0, BX0 + 1, BY0 + 1, BX1 - 1, BY1 - 1, FLOOR, Z.cafe);
    for (let y = BY0; y <= BY1; y++) for (let x = BX0; x <= BX1; x++) m.indoor[0][id(x, y)] = 1;
    H.rect(m, 0, 42, BY0 + 1, 42, BY1 - 1, WALL, WZ.tileW);          // cloison buvette / toilettes
    H.rect(m, 0, 43, 44, 46, 44, WALL, WZ.tileW);                    // cloison hommes / femmes
    H.rect(m, 0, 43, 42, 46, 43, FLOOR, Z.tile); H.rect(m, 0, 43, 45, 46, 47, FLOOR, Z.tile);
    H.set(m, 0, BX0, 46, FLOOR, Z.cafe); H.set(m, 0, 39, BY1, FLOOR, Z.cafe); H.set(m, 0, 40, BY1, FLOOR, Z.cafe);
    H.set(m, 0, BX1, 42, FLOOR, Z.tile); H.set(m, 0, BX1, 46, FLOOR, Z.tile);
    H.rect(m, 1, BX0, BY0, BX1, BY1, FLOOR, Z.terrace);
    path(38, 49, 41, 52); path(30, 44, 31, 44); path(52, 44, 52, 44);
    path(48, 41, 49, 42); path(48, 46, 49, 47); path(34, 46, 35, 46);      // abords des portes (rien n'y sera posé)
    if (!H.addRamp(m, 0, 32, 44, 1, 0, 4, { zone: Z.paved })) return null;
    if (!H.addRamp(m, 0, 51, 44, -1, 0, 4, { zone: Z.paved })) return null;
    // départ : entrée sud ; sortie : une grille de l'enceinte, le plus loin possible
    m.spawn = { f: 0, cx: 29, cy: 53 };
    const dist = new Int16Array(m.WH).fill(-1), q = [id(29, 53)]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const c = q[h], x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = id(x + dx, y + dy); if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= Hh) continue; if (dist[j] < 0 && (m.t[0][j] === FLOOR || m.t[0][j] === H.RAMP)) { dist[j] = dist[c] + 1; q.push(j); } } }
    let maxD = 0; for (const c of q) maxD = Math.max(maxD, dist[c]);
    const ex = [];
    for (let k = 3; k < W - 3; k++) { ex.push({ cx: k, cy: 1, dx: 0, dy: -1 }, { cx: 1, cy: k, dx: -1, dy: 0 }, { cx: W - 2, cy: k, dx: 1, dy: 0 }); }
    const good = ex.filter(e => dist[id(e.cx, e.cy)] >= maxD * 0.8);
    if (!good.length) return null;
    m.exit = good[Math.floor(rng() * good.length)];
    // allée jusqu'à la sortie
    const e = m.exit;
    if (e.dy) path(e.cx - 1, 1, e.cx, 2); else path(e.dx < 0 ? 1 : W - 3, e.cy - 1, e.dx < 0 ? 2 : W - 2, e.cy);

    /* ---- mobilier (objets : collisions) ---- */
    const keep = (x, y) => Math.abs(x - m.spawn.cx) + Math.abs(y - m.spawn.cy) > 3 && Math.abs(x - e.cx) + Math.abs(y - e.cy) > 3;
    const free = (x, y) => H.inb(m, x, y) && H.freeCell(m, 0, id(x, y)) && keep(x, y);
    const isZ = (x, y, z) => H.inb(m, x, y) && m.t[0][id(x, y)] === FLOOR && m.zone[0][id(x, y)] === z;
    const nearPath = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isZ(x + a, y + b, Z.path) || isZ(x + a, y + b, Z.paved));
    // kiosque à musique : plancher surélevé de 50 cm (on y monte d'un pas)
    for (let y = 27; y <= 30; y++) for (let x = 27; x <= 30; x++) H.addProp(m, 0, x, y, 'bandstand', 0.5, 2, 2, { nodraw: true });
    // lampadaires le long des allées
    const lamp = (x, y) => { if (!free(x, y)) return; const p = H.addProp(m, 0, x, y, 'plamp', 3.9, 0.32, 0.32, { nodraw: true }); if (p) H.lampLight(m, p.x, 3.55, p.z, rng, { dead: 0.1, flicker: 0.14 }); };
    for (let k = 7; k < 52; k += 8) { lamp(5, k); lamp(52, k + 4); lamp(k, 5); lamp(k + 4, 52); }
    for (let k = 7; k < 52; k += 7) { if (Math.abs(k - 28) > 6) { lamp(k, k % 14 ? 27 : 30); lamp(k % 14 ? 27 : 30, k); } }
    for (const [x, y] of [[23, 23], [34, 23], [23, 34], [34, 34]]) lamp(x, y);
    lamp(39, 26); lamp(42, 6); lamp(35, 50); lamp(48, 50); lamp(16, 31); lamp(23, 41);
    // arbres d'alignement le long de la grande croix
    const tree = (x, y, o) => { if (!free(x, y)) return null; for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) { if (!H.inb(m, xx, yy)) return null; const j = id(xx, yy); if (m.t[0][j] === H.RAMP || m.rampAt[0][j] >= 0) return null; const pi = m.propAt[0][j]; if (pi >= 0 && m.props[pi].kind === 'tree') return null; } return H.addProp(m, 0, x, y, 'tree', 6, 0.7, 0.7, { ox: (rng() - 0.5) * 0.6, oz: (rng() - 0.5) * 0.6, data: { tree: o || { kind: rng() < 0.15 ? 'conifer' : 'broad', scale: 1 + rng() * 0.35 } } }); };
    for (let x = 6; x <= 51; x += 4) if (Math.abs(x - 28) > 6 && !(x >= 39 && x <= 42)) { tree(x, 26); tree(x, 31); }
    for (let y = 6; y <= 51; y += 4) if (Math.abs(y - 28) > 6) { tree(26, y); tree(31, y); }
    // grands arbres le long de la grille
    for (let k = 3; k < W - 3; k += 3) { if (rng() < 0.75) tree(k, 1, { kind: rng() < 0.3 ? 'conifer' : 'broad', scale: 1.2 + rng() * 0.4 }); if (rng() < 0.75) tree(1, k, { kind: rng() < 0.3 ? 'conifer' : 'broad', scale: 1.2 + rng() * 0.4 }); if (rng() < 0.75) tree(W - 2, k, { kind: rng() < 0.3 ? 'conifer' : 'broad', scale: 1.2 + rng() * 0.4 }); if (rng() < 0.75 && Math.abs(k - 29) > 3) tree(k, Hh - 2, { kind: 'broad', scale: 1.2 + rng() * 0.4 }); }
    // bosquets sur les pelouses
    for (let k = 0, n = 0; k < 900 && n < 70; k++) {
      const x = ri(rng, 5, W - 6), y = ri(rng, 5, Hh - 6);
      if (!isZ(x, y, Z.grass) || nearPath(x, y)) continue;
      if (tree(x, y)) n++;
    }
    // bancs face aux allées
    for (let k = 0, n = 0; k < 600 && n < 34; k++) {
      const x = ri(rng, 5, W - 6), y = ri(rng, 5, Hh - 6);
      if (!isZ(x, y, Z.grass) || !free(x, y)) continue;
      const horiz = isZ(x, y - 1, Z.path) || isZ(x, y + 1, Z.path) || isZ(x, y - 1, Z.paved) || isZ(x, y + 1, Z.paved), vert = isZ(x - 1, y, Z.path) || isZ(x + 1, y, Z.path) || isZ(x - 1, y, Z.paved) || isZ(x + 1, y, Z.paved);
      if (!horiz && !vert) continue;
      if (H.addProp(m, 0, x, y, 'bench', 0.45, horiz ? 1.7 : 0.7, horiz ? 0.7 : 1.7)) n++;
    }
    // poubelles
    for (let k = 0, n = 0; k < 400 && n < 16; k++) { const x = ri(rng, 5, W - 6), y = ri(rng, 5, Hh - 6); if (isZ(x, y, Z.grass) && nearPath(x, y) && free(x, y) && H.addProp(m, 0, x, y, 'pbin', 0.95, 0.55, 0.55, { nodraw: true, ox: (rng() - 0.5) * 0.4, oz: (rng() - 0.5) * 0.4 })) n++; }
    // statue au centre du jardin à la française
    H.addProp(m, 0, MX + 3 * 3 + 1, MY + 3 * 2 + 1, 'statue', 2.6, 1.3, 1.3, { nodraw: true });
    // aire de jeux
    H.addProp(m, 0, 11, 35, 'swing', 2.4, 2, 1.0, { nodraw: true, data: { part: 0 } }); H.addProp(m, 0, 12, 35, 'swing', 2.4, 2, 1.0, { nodraw: true, data: { part: 1 } });
    H.addProp(m, 0, 17, 36, 'slideT', 1.3, 1.5, 1.5, { nodraw: true }); H.addProp(m, 0, 17, 37, 'chute', 0.5, 0.8, 2, { nodraw: true });
    H.addProp(m, 0, 13, 39, 'spring', 0.75, 0.5, 0.9, { nodraw: true, data: { col: [0.85, 0.25, 0.2] } }); H.addProp(m, 0, 11, 41, 'spring', 0.75, 0.5, 0.9, { nodraw: true, data: { col: [0.2, 0.5, 0.85] } });
    H.addProp(m, 0, 13, 43, 'seesaw', 0.55, 1.9, 0.4, { nodraw: true }); H.addProp(m, 0, 16, 42, 'merry', 0.35, 1.9, 1.9, { nodraw: true });
    H.addProp(m, 0, 20, 36, 'climb', 2.0, 1.9, 1.9, { nodraw: true });
    for (const [x, y] of [[10, 45], [21, 34], [10, 37]]) H.addProp(m, 0, x, y, 'bench', 0.45, 0.7, 1.7);
    // buvette : comptoir, tables ; toilettes : cabines, lavabos
    for (let y = 42; y <= 43; y++) H.addProp(m, 0, 38 + (y - 42), 42, 'counter', 1.05, 2, 0.8, { nodraw: true, oz: -0.55 });
    H.addProp(m, 0, 41, 42, 'fridge', 1.9, 0.9, 0.8, { nodraw: true, oz: -0.55 });
    for (const [x, y] of [[38, 45], [40, 46], [38, 47]]) H.addProp(m, 0, x, y, 'ctable', 0.75, 1.0, 1.0, { nodraw: true });
    // cabines contre la cloison ouest (portes d'entrée des toilettes à l'est), lavabos contre les murs nord / sud
    for (const y of [42, 43, 45, 46, 47]) H.addProp(m, 0, 43, y, 'stall', 2.1, 2, 2, { nodraw: true });
    H.addProp(m, 0, 45, 42, 'sink', 0.9, 1.6, 0.55, { nodraw: true, oz: -0.7, data: { sz: -1 } }); H.addProp(m, 0, 45, 47, 'sink', 0.9, 1.6, 0.55, { nodraw: true, oz: 0.7, data: { sz: 1 } });
    // garde-corps du toit-terrasse (sauf aux arrivées d'escalier)
    for (let x = BX0; x <= BX1; x++) for (let y = BY0; y <= BY1; y++) {
      if (x !== BX0 && x !== BX1 && y !== BY0 && y !== BY1) continue;
      if ((x === BX0 || x === BX1) && Math.abs(y - 44) <= 0) continue;
      const side = x === BX0 ? [-1, 0] : x === BX1 ? [1, 0] : y === BY0 ? [0, -1] : [0, 1];
      H.addProp(m, 1, x, y, 'rail', 1.05, side[0] ? 0.16 : 2, side[1] ? 0.16 : 2, { nodraw: true, ox: side[0] * 0.92, oz: side[1] * 0.92, data: { sx: side[0], sy: side[1] } });
    }
    // tables de pique-nique sur la terrasse et les pelouses
    for (const [x, y] of [[39, 44], [44, 45], [41, 47]]) H.addProp(m, 1, x, y, 'picnic', 0.78, 1.8, 1.6, { nodraw: true });
    for (let k = 0, n = 0; k < 300 && n < 6; k++) { const x = ri(rng, 31, 52), y = ri(rng, 31, 52); if (isZ(x, y, Z.grass) && free(x, y) && !nearPath(x, y) && H.addProp(m, 0, x, y, 'picnic', 0.78, 1.8, 1.6, { nodraw: true })) n++; }
    // lumières de la buvette et du kiosque
    const before = m.t[0].slice();
    if (!H.finalize(m, rng, diff)) return null;
    // cases devenues inaccessibles : dessinées comme des massifs d'arbustes
    for (let i = 0; i < m.WH; i++) if (before[i] === FLOOR && m.t[0][i] === WALL) { m.noWall[0][i] = 1; m.zone[0][i] = WZ.hedge; }
    for (let i = 0; i < m.WH; i++) if (m.t[1][i] === WALL && m.noWall[0][i]) m.noWall[1][i] = 1;
    H.panelLights(m, rng, TX.theme('park'), (f, i) => f === 0 && m.indoor[0][i] === 1 && m.t[0][i] === FLOOR, 2);
    H.lampLight(m, 29 * 2, 4.2, 29 * 2, rng, { dead: 0, flicker: 0.3 });
    return m;
  }
  Wd.gens.park = genPark;

  /* ---------------- décor ---------------- */
  function parkDecor(m, B, inst, rng, H, group) {
    const { C, WALL } = H, W = m.W, Hh = m.H;
    const id = (x, y) => y * W + x;
    const hidZ = (x, y, z) => x >= 0 && y >= 0 && x < W && y < Hh && m.t[0][id(x, y)] === WALL && m.noWall[0][id(x, y)] && (z == null || m.zone[0][id(x, y)] === z);
    const bx = (Bf, x0, y0, z0, x1, y1, z1, col, s) => H.box(Bf, x0, y0, z0, x1, y1, z1, col || [1, 1, 1], s || 0.5);
    const hi = !BR.settings || BR.settings.quality !== 'low';
    const HB = B('hedge'), ST = B('stone'), IR = B('iron'), PL = B('plank'), WA = B('water'), MU = B('mud'), PM = B('pmetal'), ZN = B('zinc'), LT = B('lantern'), PB = B('p');
    const grassQ = (x, y, h) => { const X0 = x * C, Z0 = y * C; H.quad(B('f1'), [[X0, h, Z0 + C], [X0 + C, h, Z0 + C], [X0 + C, h, Z0], [X0, h, Z0]], [0, 1, 0], [[X0 / 2, (Z0 + C) / 2], [(X0 + C) / 2, (Z0 + C) / 2], [(X0 + C) / 2, Z0 / 2], [X0 / 2, Z0 / 2]], 0.85); };
    // --- haies (labyrinthe + massifs) : volume irrégulier, sol de pelouse dessous ---
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      if (!hidZ(x, y, 3)) continue;
      grassQ(x, y, 0);
      const X0 = x * C, Z0 = y * C, h = 1.85 + rng() * 0.15;
      const ins = d => hidZ(x + d[0], y + d[1], 3) ? 0 : 0.12 + rng() * 0.06;
      const x0 = X0 + ins([-1, 0]), x1 = X0 + C - ins([1, 0]), z0 = Z0 + ins([0, -1]), z1 = Z0 + C - ins([0, 1]);
      bx(HB, x0, 0, z0, x1, h, z1, [0.85 + rng() * 0.15, 0.9 + rng() * 0.1, 0.85], 0.6);
      if (hi) H.leafCards(B('leafc'), (x0 + x1) / 2, h - 0.1, (z0 + z1) / 2, 0.8, 3, [0.55, 0.62, 0.5], rng);
    }
    // --- grille d'enceinte : grille en fer forgé + haute haie derrière ---
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      if (!hidZ(x, y, 4)) continue;
      grassQ(x, y, 0);
      const X0 = x * C, Z0 = y * C, X1 = X0 + C, Z1 = Z0 + C;
      // côté intérieur
      const inX = x === 0 ? 1 : x === W - 1 ? -1 : 0, inY = y === 0 ? 1 : y === Hh - 1 ? -1 : 0;
      if (inX && inY) { bx(ST, X0 + 0.6, 0, Z0 + 0.6, X1 - 0.6, 2.5, Z1 - 0.6, [0.9, 0.88, 0.84]); continue; }
      const along = inY !== 0;   // la grille court selon x
      const fx = inX > 0 ? X1 - 0.5 : inX < 0 ? X0 + 0.5 : 0, fz = inY > 0 ? Z1 - 0.5 : inY < 0 ? Z0 + 0.5 : 0;
      if (along) {
        bx(ST, X0, 0, fz - 0.18, X1, 0.45, fz + 0.18, [0.85, 0.83, 0.8]);
        bx(IR, X0, 2.05, fz - 0.03, X1, 2.12, fz + 0.03, [1, 1, 1]); bx(IR, X0, 0.6, fz - 0.03, X1, 0.66, fz + 0.03, [1, 1, 1]);
        for (let k = 0; k < 14; k++) { const px = X0 + (k + 0.5) * C / 14; bx(IR, px - 0.018, 0.45, fz - 0.018, px + 0.018, 2.25, fz + 0.018, [1, 1, 1]); }
        if (x % 4 === 0) bx(ST, X0 - 0.25, 0, fz - 0.25, X0 + 0.25, 2.4, fz + 0.25, [0.9, 0.88, 0.84]);
        bx(HB, X0, 0, fz + (inY > 0 ? -1.3 : 0.35), X1, 2.7 + rng() * 0.2, fz + (inY > 0 ? -0.35 : 1.3), [0.75, 0.82, 0.75], 0.6);
      } else {
        bx(ST, fx - 0.18, 0, Z0, fx + 0.18, 0.45, Z1, [0.85, 0.83, 0.8]);
        bx(IR, fx - 0.03, 2.05, Z0, fx + 0.03, 2.12, Z1, [1, 1, 1]); bx(IR, fx - 0.03, 0.6, Z0, fx + 0.03, 0.66, Z1, [1, 1, 1]);
        for (let k = 0; k < 14; k++) { const pz = Z0 + (k + 0.5) * C / 14; bx(IR, fx - 0.018, 0.45, pz - 0.018, fx + 0.018, 2.25, pz + 0.018, [1, 1, 1]); }
        if (y % 4 === 0) bx(ST, fx - 0.25, 0, Z0 - 0.25, fx + 0.25, 2.4, Z0 + 0.25, [0.9, 0.88, 0.84]);
        bx(HB, fx + (inX > 0 ? -1.3 : 0.35), 0, Z0, fx + (inX > 0 ? -0.35 : 1.3), 2.7 + rng() * 0.2, Z1, [0.75, 0.82, 0.75], 0.6);
      }
    }
    // piliers du portail de sortie
    { const e = m.exit, cx = (e.cx + 0.5) * C + e.dx * C, cz = (e.cy + 0.5) * C + e.dy * C;
      for (const s of [-1, 1]) { const px = cx + (e.dy ? s * 1.05 : 0), pz = cz + (e.dx ? s * 1.05 : 0); bx(ST, px - 0.3, 0, pz - 0.3, px + 0.3, 3.0, pz + 0.3, [0.92, 0.9, 0.86]); bx(ST, px - 0.36, 3.0, pz - 0.36, px + 0.36, 3.15, pz + 0.36, [0.85, 0.83, 0.8]); H.cyl(LT, px, pz, 3.15, 3.45, 0.12, 0.12, 8, [1, 1, 1]); } }
    // portail d'entrée (sud)
    for (const s of [-1, 1]) { const px = 29 * C + s * 2.3, pz = (Hh - 1) * C + 0.5; bx(ST, px - 0.35, 0, pz - 0.35, px + 0.35, 3.2, pz + 0.35, [0.92, 0.9, 0.86]); bx(ST, px - 0.42, 3.2, pz - 0.42, px + 0.42, 3.35, pz + 0.42, [0.85, 0.83, 0.8]); }
    // sol extérieur (rue autour du parc) + silhouettes d'immeubles
    { const O = B('out'), Wm = W * C, Hm = Hh * C, R = 70;
      const q = (x0, z0, x1, z1) => H.quad(O, [[x0, -0.02, z1], [x1, -0.02, z1], [x1, -0.02, z0], [x0, -0.02, z0]], [0, 1, 0], [[x0 / 2, z1 / 2], [x1 / 2, z1 / 2], [x1 / 2, z0 / 2], [x0 / 2, z0 / 2]], 0.8);
      q(-R, -R, Wm + R, 0); q(-R, Hm, Wm + R, Hm + R); q(-R, 0, 0, Hm); q(Wm, 0, Wm + R, Hm);
      if (inst) H.skyline(m, inst, rng);
    }
    // --- bassin : eau, fond, margelle de pierre, jet d'eau, nénuphars, roseaux ---
    { let sx = 0, sz = 0, n = 0;
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        if (!hidZ(x, y, 5)) continue;
        const X0 = x * C, Z0 = y * C, X1 = X0 + C, Z1 = Z0 + C; sx += X0 + 1; sz += Z0 + 1; n++;
        H.quad(WA, [[X0, -0.14, Z1], [X1, -0.14, Z1], [X1, -0.14, Z0], [X0, -0.14, Z0]], [0, 1, 0], [[X0 / 2, Z1 / 2], [X1 / 2, Z1 / 2], [X1 / 2, Z0 / 2], [X0 / 2, Z0 / 2]], 1);
        H.quad(MU, [[X0, -0.75, Z1], [X1, -0.75, Z1], [X1, -0.75, Z0], [X0, -0.75, Z0]], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], 1);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (hidZ(x + dx, y + dy, 5)) continue;
          const bridge = m.zone[0][id(x + dx, y + dy)] === 7;
          // paroi intérieure du bassin
          const ex0 = dx === 1 ? X1 : dx === -1 ? X0 : X0, ex1 = dx === 1 ? X1 : dx === -1 ? X0 : X1, ez0 = dy === 1 ? Z1 : dy === -1 ? Z0 : Z0, ez1 = dy === 1 ? Z1 : dy === -1 ? Z0 : Z1;
          H.quadN(ST, [[ex0, -0.75, ez0], [ex1, -0.75, ez1], [ex1, 0.02, ez1], [ex0, 0.02, ez0]], [-dx, 0, -dy], [[0, 0], [1, 0], [1, 0.4], [0, 0.4]], 0.6);
          if (bridge) continue;
          // margelle (côté bassin)
          const t = 0.42;
          const c0 = [dx === 1 ? X1 - t : X0, dy === 1 ? Z1 - t : Z0], c1 = [dx === -1 ? X0 + t : X1, dy === -1 ? Z0 + t : Z1];
          bx(ST, c0[0], -0.2, c0[1], c1[0], 0.32, c1[1], [0.92, 0.9, 0.86]);
          // roseaux
          if (hi && rng() < 0.3) for (let k = 0; k < 6; k++) { const rx = (c0[0] + c1[0]) / 2 - dx * 0.6 + (rng() - 0.5) * 1.4 * (dy ? 1 : 0.2), rz = (c0[1] + c1[1]) / 2 - dy * 0.6 + (rng() - 0.5) * 1.4 * (dx ? 1 : 0.2), hh = 0.6 + rng() * 0.7; H.tube(B('leaf'), [[rx, -0.2, rz], [rx + (rng() - 0.5) * 0.2, hh, rz + (rng() - 0.5) * 0.2]], [0.025, 0.006], 4, [0.55, 0.62, 0.4], 1); }
        }
        if (hi && rng() < 0.18) { const lx = X0 + 0.4 + rng() * 1.2, lz = Z0 + 0.4 + rng() * 1.2; H.disk(B('leaf'), lx, -0.12, lz, 0.22 + rng() * 0.15, 9, false, [0.5, 0.7, 0.42]); }
      }
      // jet d'eau central
      if (n) {
        const cx = 45.5 * C / 2 + 0, fx = 41 * C + 6, fz = 14 * C + 1;
        bx(ST, fx - 0.7, -0.75, fz - 0.7, fx + 0.7, 0.05, fz + 0.7, [0.85, 0.83, 0.8]);
        H.cyl(B('jet'), fx, fz, 0.05, 2.6, 0.09, 0.03, 8, [1, 1, 1], false);
        H.cyl(B('jet'), fx, fz, 0.05, 1.2, 0.5, 0.06, 10, [1, 1, 1], false);
        void cx;
      }
    }
    // --- petit pont de bois : garde-corps, longerons ---
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = id(x, y); if (m.t[0][i] !== H.FLOOR || m.zone[0][i] !== 7) continue;
      const X0 = x * C, Z0 = y * C;
      for (const s of [-1, 1]) {
        const nx = x + s; if (!hidZ(nx, y, 5) && m.zone[0][id(nx, y)] === 7) continue;
        const px = s < 0 ? X0 + 0.08 : X0 + C - 0.08;
        bx(PL, px - 0.08, -0.35, Z0, px + 0.08, 0.06, Z0 + C, [0.7, 0.62, 0.55]);
        bx(PL, px - 0.05, 0.95, Z0, px + 0.05, 1.05, Z0 + C, [0.9, 0.85, 0.8]);
        bx(PL, px - 0.03, 0.5, Z0, px + 0.03, 0.56, Z0 + C, [0.85, 0.8, 0.75]);
        for (const pz of [Z0 + 0.08, Z0 + 1]) bx(PL, px - 0.07, 0, pz - 0.07, px + 0.07, 1.1, pz + 0.07, [0.8, 0.72, 0.65]);
      }
    }
    // --- clôture basse de l'aire de jeux (lisses en bois peint) ---
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      if (!hidZ(x, y, 6)) continue;
      grassQ(x, y, 0);
      const X0 = x * C, Z0 = y * C, cxm = X0 + 1, czm = Z0 + 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!hidZ(x + dx, y + dy, 6)) continue;
        const x0 = Math.min(cxm, cxm + dx), x1 = Math.max(cxm, cxm + dx), z0 = Math.min(czm, czm + dy), z1 = Math.max(czm, czm + dy);
        bx(PM, x0 - 0.04, 0.95, z0 - 0.04, x1 + 0.04, 1.02, z1 + 0.04, [0.2, 0.42, 0.25]);
        for (let k = 0; k < 6; k++) { const t = k / 6; const px = cxm + dx * t, pz = czm + dy * t; bx(PM, px - 0.035, 0, pz - 0.035, px + 0.035, 1.0, pz + 0.035, [0.25, 0.48, 0.3]); }
      }
      bx(PM, cxm - 0.07, 0, czm - 0.07, cxm + 0.07, 1.12, czm + 0.07, [0.2, 0.4, 0.24]);
    }
    // bordure du bac à sable
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = id(x, y); if (m.t[0][i] !== H.FLOOR || m.zone[0][i] !== 5) continue;
      const X0 = x * C, Z0 = y * C;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = id(x + dx, y + dy); if (m.zone[0][j] === 5) continue; const x0 = dx === 1 ? X0 + C - 0.12 : X0, x1 = dx === -1 ? X0 + 0.12 : X0 + C, z0 = dy === 1 ? Z0 + C - 0.12 : Z0, z1 = dy === -1 ? Z0 + 0.12 : Z0 + C; bx(PL, x0, 0, z0, x1, 0.22, z1, [0.85, 0.75, 0.6]); }
    }
    // --- objets dessinés ici (nodraw) ---
    for (const p of m.props) {
      const x = p.x, z = p.z, b = p.base;
      switch (p.kind) {
        case 'plamp': {   // réverbère de parc : fût cannelé vert sombre, lanterne à 4 pans
          H.cyl(IR, x, z, b, b + 0.5, 0.17, 0.13, 10, [1, 1, 1]);
          H.cyl(IR, x, z, b + 0.5, b + 3.2, 0.065, 0.05, 8, [1, 1, 1], false);
          bx(IR, x - 0.16, b + 3.2, z - 0.16, x + 0.16, b + 3.28, z + 0.16, [1, 1, 1]);
          bx(LT, x - 0.13, b + 3.28, z - 0.13, x + 0.13, b + 3.72, z + 0.13, [1, 1, 1]);
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(IR, x + sx * 0.13 - 0.015, b + 3.28, z + sz * 0.13 - 0.015, x + sx * 0.13 + 0.015, b + 3.72, z + sz * 0.13 + 0.015, [1, 1, 1]);
          H.cyl(IR, x, z, b + 3.72, b + 3.95, 0.21, 0.02, 8, [1, 1, 1]);
          break;
        }
        case 'pbin': H.cyl(IR, x, z, b, b + 0.9, 0.26, 0.28, 12, [0.9, 0.9, 0.9]); H.disk(MU, x, b + 0.86, z, 0.24, 12, false, [1, 1, 1]); bx(IR, x - 0.03, b, z - 0.3, x + 0.03, b + 0.7, z - 0.26, [1, 1, 1]); break;
        case 'statue': {
          bx(ST, x - 0.65, b, z - 0.65, x + 0.65, b + 1.3, z + 0.65, [0.95, 0.93, 0.9]); bx(ST, x - 0.75, b + 1.3, z - 0.75, x + 0.75, b + 1.42, z + 0.75, [0.9, 0.88, 0.85]);
          const gc = [0.55, 0.68, 0.6];   // bronze vert-de-grisé
          H.cyl(PM, x, z, b + 1.42, b + 2.5, 0.22, 0.18, 10, gc); H.icoBlob(PM, x, b + 2.72, z, 0.17, gc, 1.1, 1);
          H.tube(PM, [[x, b + 2.35, z], [x + 0.35, b + 2.6, z + 0.1], [x + 0.5, b + 3.05, z + 0.12]], [0.07, 0.06, 0.05], 6, gc, 1);
          H.tube(PM, [[x, b + 2.35, z], [x - 0.3, b + 2.0, z]], [0.07, 0.06], 6, gc, 1);
          break;
        }
        case 'bandstand': {
          if (!(p.cx === 27 && p.cy === 27)) break;
          const cx = 29 * C, cz = 29 * C, R = 3.9, N = 8;
          // socle octogonal en pierre + plancher
          H.tube(ST, [[cx, b, cz], [cx, b + 0.5, cz]], [R + 0.1, R + 0.1], N, [0.9, 0.88, 0.84], 1);
          H.disk(PL, cx, b + 0.5, cz, R + 0.1, N, false, [0.9, 0.85, 0.8]);
          for (let k = 0; k < N; k++) {
            const a = (k + 0.5) / N * Math.PI * 2, px = cx + Math.cos(a) * R * 0.95, pz = cz + Math.sin(a) * R * 0.95;
            H.cyl(IR, px, pz, b + 0.5, b + 4.0, 0.09, 0.09, 8, [1, 1, 1], false);
            // garde-corps entre les colonnes (sauf l'entrée)
            if (k % 4 !== 1) { const a2 = (k + 1.5) / N * Math.PI * 2, qx = cx + Math.cos(a2) * R * 0.95, qz = cz + Math.sin(a2) * R * 0.95; H.tube(IR, [[px, b + 1.45, pz], [qx, b + 1.45, qz]], [0.03, 0.03], 5, [1, 1, 1], 1); H.tube(IR, [[px, b + 0.6, pz], [qx, b + 0.6, qz]], [0.02, 0.02], 5, [1, 1, 1], 1); for (let s = 1; s < 8; s++) { const t = s / 8, sx2 = px + (qx - px) * t, sz2 = pz + (qz - pz) * t; H.tube(IR, [[sx2, b + 0.6, sz2], [sx2, b + 1.45, sz2]], [0.012, 0.012], 4, [1, 1, 1], 1); } }
          }
          // toit en zinc + frise + lanterne de faîtage
          H.tube(ZN, [[cx, b + 4.0, cz], [cx, b + 4.35, cz]], [R + 0.35, R + 0.35], N, [0.85, 0.9, 0.88], 1);
          H.disk(ZN, cx, b + 4.0, cz, R + 0.35, N, true, [0.6, 0.62, 0.6]);
          H.tube(ZN, [[cx, b + 4.35, cz], [cx, b + 5.4, cz], [cx, b + 6.4, cz]], [R + 0.35, 1.4, 0.05], N, [1, 1, 1], 1);
          H.cyl(IR, cx, cz, b + 6.3, b + 7.0, 0.04, 0.02, 6, [1, 1, 1]);
          bx(LT, cx - 0.15, b + 3.62, cz - 0.15, cx + 0.15, b + 3.95, cz + 0.15, [1, 1, 1]);
          break;
        }
        case 'swing': {
          if (p.data.part) break;
          const x0 = x - 0.9, x1 = x + 2.9, y1 = b + 2.35, cz = z;
          H.tube(PM, [[x1 + 0.6, y1, cz]].concat([[x0 - 0.6, y1, cz]]), [0.06, 0.06], 8, [0.75, 0.25, 0.2], 1);
          for (const ex of [x0 - 0.5, x1 + 0.5]) for (const s of [-1, 1]) H.tube(PM, [[ex, y1, cz], [ex + (ex < x ? -0.25 : 0.25), b, cz + s * 0.85]], [0.05, 0.05], 6, [0.75, 0.25, 0.2], 1);
          for (const sx of [x - 0.1, x + 1.9]) { for (const s of [-1, 1]) H.tube(IR, [[sx + s * 0.22, y1, cz], [sx + s * 0.22, b + 0.48, cz]], [0.008, 0.008], 3, [1, 1, 1], 1); bx(B('p'), sx - 0.25, b + 0.42, cz - 0.1, sx + 0.25, b + 0.48, cz + 0.1, [0.15, 0.15, 0.16]); }
          break;
        }
        case 'slideT': {
          const h = b + 1.3;
          for (const [sx, sz] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) H.cyl(PM, x + sx, z + sz, b, b + 2.6, 0.06, 0.06, 8, [0.95, 0.75, 0.15], false);
          bx(PL, x - 0.7, h - 0.08, z - 0.7, x + 0.7, h, z + 0.7, [0.9, 0.8, 0.65]);
          H.tube(ZN, [[x, b + 2.6, z], [x, b + 3.4, z]], [1.05, 0.05], 4, [0.85, 0.3, 0.25], 1);
          for (let k = 0; k < 5; k++) bx(PM, x - 0.72, b + 0.25 + k * 0.25, z - 0.75, x - 0.62, b + 0.29 + k * 0.25, z - 0.62, [0.3, 0.5, 0.8]);
          bx(PM, x - 0.72, h, z - 0.72, x + 0.72, h + 0.06, z - 0.66, [0.95, 0.75, 0.15]); bx(PM, x - 0.72, h + 0.6, z - 0.72, x + 0.72, h + 0.66, z - 0.66, [0.95, 0.75, 0.15]);
          break;
        }
        case 'chute': {   // toboggan : descend vers +z
          const z0 = z - 1.0, z1 = z + 1.4, y0 = b + 1.25, y1 = b + 0.25;
          H.quadN(PM, [[x - 0.32, y0, z0], [x + 0.32, y0, z0], [x + 0.32, y1, z1], [x - 0.32, y1, z1]], [0, 1, 0.4], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.25, 0.55, 0.9]);
          H.quadN(PM, [[x - 0.32, y0 - 0.05, z0], [x + 0.32, y0 - 0.05, z0], [x + 0.32, y1 - 0.05, z1], [x - 0.32, y1 - 0.05, z1]], [0, -1, -0.4], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.2, 0.45, 0.75]);
          for (const s of [-1, 1]) H.tube(PM, [[x + s * 0.34, y0 + 0.18, z0], [x + s * 0.34, y1 + 0.18, z1]], [0.035, 0.035], 6, [0.25, 0.55, 0.9], 1);
          H.cyl(PM, x, z1 - 0.2, b, y1, 0.04, 0.04, 6, [0.6, 0.6, 0.6], false);
          break;
        }
        case 'spring': { const c = p.data.col; H.cyl(IR, x, z, b, b + 0.35, 0.06, 0.06, 8, [0.4, 0.4, 0.4], false); H.icoBlob(PM, x, b + 0.55, z, 0.25, c, 1.2, 1); bx(PM, x - 0.06, b + 0.55, z - 0.42, x + 0.06, b + 0.62, z - 0.3, c); H.icoBlob(PM, x, b + 0.86, z - 0.3, 0.13, c, 1, 1); bx(B('p'), x - 0.2, b - 0.01, z - 0.2, x + 0.2, b + 0.03, z + 0.2, [0.3, 0.3, 0.3]); break; }
        case 'seesaw': { bx(PM, x - 0.12, b, z - 0.12, x + 0.12, b + 0.35, z + 0.12, [0.6, 0.6, 0.6]); H.tube(PL, [[x - 1.6, b + 0.15, z], [x + 1.6, b + 0.55, z]], [0.1, 0.1], 4, [0.85, 0.35, 0.25], 1); for (const s of [-1, 1]) bx(PM, x + s * 1.3 - 0.04, b + 0.35 + s * 0.05, z - 0.2, x + s * 1.3 + 0.04, b + 0.65 + s * 0.05, z + 0.2, [0.95, 0.75, 0.15]); break; }
        case 'merry': { H.cyl(PM, x, z, b, b + 0.35, 0.9, 0.9, 16, [0.85, 0.3, 0.25]); H.cyl(IR, x, z, b + 0.35, b + 1.05, 0.05, 0.05, 8, [1, 1, 1], false); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; H.tube(IR, [[x, b + 1.0, z], [x + Math.cos(a) * 0.8, b + 0.75, z + Math.sin(a) * 0.8], [x + Math.cos(a) * 0.8, b + 0.35, z + Math.sin(a) * 0.8]], [0.025, 0.025, 0.025], 5, [0.3, 0.55, 0.85], 1); } break; }
        case 'climb': { const h = b + 2.0; for (const [sx, sz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) H.tube(PM, [[x + sx, b, z + sz], [x, h, z]], [0.04, 0.04], 6, [0.3, 0.55, 0.85], 1); for (let k = 1; k < 5; k++) { const t = k / 5, r = 0.85 * (1 - t), y = b + 2.0 * t; for (const [ax, az, bx2, bz] of [[-r, -r, r, -r], [r, -r, r, r], [r, r, -r, r], [-r, r, -r, -r]]) H.tube(IR, [[x + ax, y, z + az], [x + bx2, y, z + bz]], [0.015, 0.015], 4, [0.85, 0.75, 0.2], 1); } break; }
        case 'picnic': { const c = [0.85, 0.75, 0.62]; bx(PL, x - 0.9, b + 0.72, z - 0.42, x + 0.9, b + 0.78, z + 0.42, c); for (const s of [-1, 1]) { bx(PL, x - 0.9, b + 0.42, z + s * 0.75 - 0.15, x + 0.9, b + 0.47, z + s * 0.75 + 0.15, c); bx(PL, x + s * 0.7 - 0.05, b, z - 0.85, x + s * 0.7 + 0.05, b + 0.06, z + 0.85, c); bx(PL, x + s * 0.7 - 0.05, b, z - 0.06, x + s * 0.7 + 0.05, b + 0.72, z + 0.06, c); } break; }
        case 'rail': { const d = p.data, X0 = p.x0, X1 = p.x1, Z0 = p.z0, Z1 = p.z1; bx(ST, X0, b, Z0, X1, b + 0.22, Z1, [0.88, 0.86, 0.82]); bx(IR, X0 + (d.sx ? 0.04 : 0), b + 0.98, Z0 + (d.sy ? 0.04 : 0), X1 - (d.sx ? 0.04 : 0), b + 1.05, Z1 - (d.sy ? 0.04 : 0), [1, 1, 1]); for (let k = 0; k < 9; k++) { const t = (k + 0.5) / 9; const px = d.sx ? (X0 + X1) / 2 : X0 + (X1 - X0) * t, pz = d.sy ? (Z0 + Z1) / 2 : Z0 + (Z1 - Z0) * t; bx(IR, px - 0.02, b + 0.22, pz - 0.02, px + 0.02, b + 1.0, pz + 0.02, [1, 1, 1]); } break; }
        case 'counter': bx(PL, p.x0, b, p.z0, p.x1, b + 1.0, p.z1, [0.55, 0.38, 0.25]); bx(ST, p.x0 - 0.03, b + 1.0, p.z0 - 0.05, p.x1 + 0.03, b + 1.06, p.z1 + 0.05, [0.4, 0.38, 0.36]); break;
        case 'fridge': bx(PB, p.x0, b, p.z0, p.x1, b + 1.9, p.z1, [0.82, 0.84, 0.86]); bx(B('glass'), p.x0 + 0.06, b + 0.2, p.z1, p.x1 - 0.06, b + 1.75, p.z1 + 0.02, [1, 1, 1]); bx(B('glow'), p.x0 + 0.1, b + 0.25, p.z1 - 0.05, p.x1 - 0.1, b + 1.7, p.z1 - 0.02, [0.6, 0.75, 0.8]); break;
        case 'ctable': H.cyl(PB, x, z, b, b + 0.72, 0.05, 0.05, 8, [0.2, 0.2, 0.2], false); H.cyl(PB, x, z, b + 0.72, b + 0.75, 0.42, 0.42, 14, [0.85, 0.85, 0.82]); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.4, cx2 = x + Math.cos(a) * 0.62, cz2 = z + Math.sin(a) * 0.62; bx(PB, cx2 - 0.2, b + 0.44, cz2 - 0.2, cx2 + 0.2, b + 0.48, cz2 + 0.2, [0.25, 0.45, 0.35]); bx(PB, cx2 - 0.2 - Math.cos(a) * 0.0, b + 0.48, cz2 - 0.2, cx2 + 0.2, b + 0.9, cz2 - 0.16, [0.25, 0.45, 0.35]); for (const [sx, sz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) bx(PB, cx2 + sx - 0.015, b, cz2 + sz - 0.015, cx2 + sx + 0.015, b + 0.44, cz2 + sz + 0.015, [0.2, 0.2, 0.2]); } break;
        case 'stall': {   // cabine fermée, adossée à la cloison ouest, porte côté est
          const X0 = p.x0, X1 = p.x1, Z0 = p.z0, Z1 = p.z1, c = [0.5, 0.58, 0.66], zm = (Z0 + Z1) / 2;
          bx(PB, X1 - 0.08, b + 0.15, Z0 + 0.03, X1 - 0.04, b + 2.05, Z1 - 0.03, c);
          bx(PB, X1 - 0.1, b + 0.18, Z0 + 0.22, X1 - 0.08, b + 2.0, Z1 - 0.22, [0.6, 0.68, 0.75]);
          bx(PB, X0, b + 0.15, Z0 + 0.03, X1 - 0.08, b + 2.05, Z0 + 0.07, c); bx(PB, X0, b + 0.15, Z1 - 0.07, X1 - 0.08, b + 2.05, Z1 - 0.03, c);
          bx(IR, X1 - 0.14, b + 0.95, zm + 0.55, X1 - 0.1, b + 1.1, zm + 0.63, [1, 1, 1]);
          bx(B('glow'), X1 - 0.12, b + 1.15, zm + 0.5, X1 - 0.1, b + 1.2, zm + 0.62, rng() < 0.5 ? [0.9, 0.2, 0.15] : [0.2, 0.8, 0.3]);
          for (const zz of [Z0 + 0.05, Z1 - 0.05]) bx(IR, X1 - 0.12, b, zz - 0.03, X1 - 0.06, b + 0.15, zz + 0.03, [1, 1, 1]);
          break;
        }
        case 'sink': {   // plan de toilette, deux vasques, miroir au mur
          const sz = p.data.sz, Z0 = p.z0, Z1 = p.z1, wz = sz < 0 ? p.cy * C : (p.cy + 1) * C;
          bx(ST, p.x0, b + 0.82, Z0, p.x1, b + 0.9, Z1, [0.95, 0.95, 0.95]);
          for (const xx of [p.x0 + 0.4, p.x1 - 0.4]) { bx(B('ceram'), xx - 0.22, b + 0.74, Z0 + 0.08, xx + 0.22, b + 0.83, Z1 - 0.08, [1, 1, 1]); H.cyl(IR, xx, wz - sz * 0.1, b + 0.9, b + 1.08, 0.015, 0.015, 6, [1, 1, 1]); }
          bx(B('glass'), p.x0 + 0.05, b + 1.15, Math.min(wz, wz - sz * 0.015), p.x1 - 0.05, b + 1.95, Math.max(wz, wz - sz * 0.015), [1, 1, 1]);
          break;
        }
      }
    }
    // auvent de la buvette + enseignes
    { const y0 = 3.05;
      bx(ZN, 37.2 * C, y0, 48.95 * C, 41.4 * C, y0 + 0.08, 48.95 * C + 1.4, [0.35, 0.45, 0.38]);
      const s1 = H.signMesh(BR.Tex.sign('BUVETTE', '#24382c', '#efe6c8', 384, 96), 1.9, 0.48, { lit: true, emissive: '#3a3528' }); s1.position.set(39.5 * C + 0.5, 3.45, 49 * C + 0.03); group.add(s1);
      const s2 = H.signMesh(BR.Tex.sign('TOILETTES', '#e9ecee', '#20384a', 384, 96), 1.4, 0.36, { lit: true }); s2.position.set(48 * C + 0.03, 2.75, 44.5 * C); s2.rotation.y = Math.PI / 2; group.add(s2);
      const s3 = H.signMesh(BR.Tex.sign('JARDIN DES TILLEULS', '#1f3328', '#e8dcb8', 512, 110), 3.2, 0.7, { lit: true }); s3.position.set(29 * C, 3.6, (Hh - 1) * C + 0.08); s3.rotation.y = Math.PI; group.add(s3);
      // panneau d'information près de l'entrée
      const pnl = H.signMesh(BR.Tex.sign('PLAN DU PARC', '#2a3d30', '#e9e1c6', 384, 96), 1.2, 0.3, { lit: true }); pnl.position.set(31.6 * C, 1.75, 52.2 * C); group.add(pnl);
      bx(IR, 31.6 * C - 0.7, 0, 52.2 * C - 0.08, 31.6 * C - 0.62, 2.1, 52.2 * C - 0.02, [1, 1, 1]); bx(IR, 31.6 * C + 0.62, 0, 52.2 * C - 0.08, 31.6 * C + 0.7, 2.1, 52.2 * C - 0.02, [1, 1, 1]); bx(IR, 31.6 * C - 0.66, 0.8, 52.2 * C - 0.06, 31.6 * C + 0.66, 1.6, 52.2 * C - 0.02, [0.8, 0.85, 0.8]);
    }
    // touffes d'herbe haute et massifs de fleurs (qualité moyenne / haute)
    if (hi) {
      const TF = B('tuft');
      for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = id(x, y); if (m.t[0][i] !== H.FLOOR || m.zone[0][i] !== 1 || m.propAt[0][i] >= 0) continue;
        for (let k = 0; k < 2; k++) if (rng() < 0.4) {
          const tx = x * C + 0.2 + rng() * 1.6, tz = y * C + 0.2 + rng() * 1.6, s = 0.22 + rng() * 0.2, a = rng() * 3, sh = 0.9 + rng() * 0.25;
          for (const q of [0, Math.PI / 2]) { const dx = Math.cos(a + q) * s, dz = Math.sin(a + q) * s; H.quad(TF, [[tx - dx, 0, tz - dz], [tx + dx, 0, tz + dz], [tx + dx, s * 1.5, tz + dz], [tx - dx, s * 1.5, tz - dz]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [sh, sh * 1.05, sh * 0.9]); }
        }
      }
      // massifs autour de la place
      for (const [x0, z0, x1, z1] of [[23, 22.2, 35, 22.8], [23, 35.2, 35, 35.8], [22.2, 23, 22.8, 35], [35.2, 23, 35.8, 35]]) {
        bx(ST, x0 * C, 0, z0 * C, x1 * C, 0.25, z1 * C, [0.85, 0.82, 0.78]);
        const n = Math.round(Math.max(x1 - x0, z1 - z0) * 3);
        for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, fx = (x0 + (x1 - x0) * t) * C, fz = (z0 + (z1 - z0) * t) * C; H.leafCards(B('leafc'), fx, 0.45, fz, 0.35, 2, rng() < 0.5 ? [0.95, 0.4, 0.45] : [0.95, 0.85, 0.4], rng); }
      }
    }
    // arbustes (modèle KayKit) au pied des arbres d'alignement
    if (inst) for (const p of m.props) if (p.kind === 'tree' && rng() < 0.25) H.put(inst, 'city_bush', p.x + 0.9, 0, p.z + 0.4, rng() * 6, 2.2 + rng());
  }
  Wd.decor.park = parkDecor;
})();

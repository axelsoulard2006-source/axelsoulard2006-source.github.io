/* ===== maps/tilted.js : TILTED TOWERS — petit centre-ville dense, la nuit, à ciel ouvert
   Inspiré du quartier du même nom : une place centrale avec sa tour de l'horloge, entourée d'immeubles de 2 à 4 étages
   tous traversables (portes, escaliers intérieurs, fenêtres soufflées d'où sauter, toits accessibles, passerelles entre
   toits), rues encombrées de voitures, un parking et un square. Aucun logo ni marque. ===== */
(function () {
  const BR = window.BR, TX = BR.Tex, P = TX.P, Wd = BR.World;

  /* ---------------- façades et textures ---------------- */
  Object.assign(TX.FACADES, {
    tiltBrick: { wall: '#9a4934', brick: true, band: '#e8dcc6', frameOut: '#efe6d4', frameIn: '#f5efe2', sillCol: '#efe6d4', glass: ['#2c3c52', '#151d29'], ww: 1.1, wh: 1.85, sill: 0.9, lit: 0.3, curtains: true, transom: 0.3 },
    tiltBlue: { wall: '#647d93', siding: true, band: '#e6e2d8', frameOut: '#f1ede4', frameIn: '#f7f4ee', sillCol: '#ece7dc', glass: ['#2b3a4e', '#151c27'], ww: 1.0, wh: 1.7, sill: 1.0, lit: 0.28, curtains: true, transom: 0.3 },
    tiltCream: { wall: '#cdbf9f', stone: true, band: '#e8dfca', frameOut: '#3d4652', frameIn: '#2c333c', sillCol: '#e8dfca', glass: ['#2e3f55', '#18212d'], ww: 1.15, wh: 2.0, sill: 0.85, lit: 0.3, curtains: true, transom: 0.25 },
    tiltOffice: { wall: '#4f5d6b', panels: true, band: '#aeb8c2', frameOut: '#252b33', frameIn: '#2f363f', sillCol: '#9aa4ae', glass: ['#3a5672', '#1b2838'], ww: 1.8, wh: 2.6, sill: 0.6, lit: 0.35, litTones: ['#e9f0ff', '#fff1d0', '#dfe9f7'], mull: 6, spandrel: '#3c4752' },
    tiltShopA: { wall: '#8e4a36', brick: true, band: '#d9ccb3', frameOut: '#22262b', frameIn: '#32373e', sillCol: '#d9ccb3', glass: ['#2b3b50', '#151d28'], ww: 1.05, wh: 1.75, sill: 0.95, lit: 0.35, curtains: true, transom: 0.3, shop: true },
    tiltShopB: { wall: '#bfb193', stone: true, band: '#e2d8c4', frameOut: '#2c3036', frameIn: '#3a3e44', sillCol: '#e2d8c4', glass: ['#2b3b50', '#151d28'], ww: 1.05, wh: 1.75, sill: 0.95, lit: 0.35, curtains: true, transom: 0.3, shop: true },
  });
  Object.assign(TX.MAKE, {
    tiltOfficeCarpet: () => P.mk(256, 256, (g, w, h) => { g.fillStyle = '#3d4450'; g.fillRect(0, 0, w, h); P.fine(g, w, h, 16); P.grid(g, w, h, 128, 'rgba(0,0,0,0.25)', 2); P.soft(g, w, h, 5, '0,0,0', 0.06, 0.14, 15, 60); }),
    tiltShopTile: () => P.tiles('#d8d2c6', '#b9b2a4', 4, 'rgba(80,74,66,0.6)'),
    tiltWood: () => P.wood('#8a5a38'),
    tiltClock: () => P.brick('#8a5a45', '#b7ab98'),
    tiltBarrier: () => P.concrete('#b5b5ae'),
  });

  /* ---------------- thème ---------------- */
  TX.THEMES.tilted = {
    name: 'Tilted Towers', fog: 0x0b1222, fogDensity: 0.02, ambient: 0x56637e, ambientI: 0.32, hemi: [0x8496c4, 0x1a1916, 0.42], exposure: 1.1,
    lightColor: 0xffc77a, panel: '#fff1d0', flicker: 0.12, deadLights: 0.2, outdoor: true, sky: 0x0a0f1e, moon: 0x8597c4, lightI: 1.1, flashI: 1,
    env: { kind: 'night', glow: '#ff9a4a' },
    tex: {
      floor: {
        1: { t: 'asphalt', rep: [0.25, 0.25], rough: 0.85, puddle: 0.5, n: 1.6 }, 2: { t: 'sidewalk', rough: 0.8, puddle: 0.15 }, 3: { t: 'plaza', rep: [0.5, 0.5], rough: 0.7, puddle: 0.25 },
        4: { t: 'tiltWood', rep: [0.5, 0.5], rough: 0.5, wet: 0, env: 0.9 }, 5: { t: 'roof', rough: 0.8, puddle: 0.3 }, 6: { t: 'concreteJ', rough: 0.75, wet: 0 }, 7: { t: 'tiltShopTile', rough: 0.25, env: 1.6, wet: 0 },
        8: { t: 'grate', rough: 0.5, metal: 0.5 }, 9: { t: 'grass', rough: 0.95, n: 1.2 }, 10: { t: 'tiltOfficeCarpet', rough: 1, wet: 0 }, 0: { t: 'asphalt', rep: [0.25, 0.25] },
      },
      wall: { 1: { facade: 'tiltBrick' }, 2: { facade: 'tiltBlue' }, 3: { facade: 'tiltCream' }, 4: { facade: 'tiltOffice', env: 2 }, 5: { facade: 'tiltShopA' }, 6: { facade: 'tiltShopB' }, 7: { t: 'paintW', wet: 0 }, 0: { facade: 'tiltBrick' } },
      wallIn: { t: 'paintW', wet: 0 },
      ci: { t: 'ceilC' }, co: { t: 'concrete' }, e: { t: 'edgeC' }, rs: { t: 'concrete' }, r: { t: 'stairsC', rough: 0.8 }, rr: { t: 'concrete' },
    },
    mats: {
      stone: { t: 'tiltClock', rough: 0.85, n: 1.6 },
      stoneL: { t: 'concrete', color: '#d9d2c2', rough: 0.8 },
      barrier: { t: 'tiltBarrier', rough: 0.85, n: 1.4 },
      iron: { t: 'metal', color: '#3a3f44', rough: 0.45, metal: 0.6, env: 1 },
      zinc: { t: 'metal', color: '#4a5a62', rough: 0.35, metal: 0.6, env: 1.3 },
      clockface: { color: '#f3ecd6', rough: 0.4, emissive: '#e9d9a8', ei: 0.55, env: 0.5 },
      fence: { t: 'grate', color: '#c9ccd0', rough: 0.5, metal: 0.6, transparent: true, opacity: 0.55, double: true },
      gloss: { t: 'noise', rough: 0.25, env: 1.3, n: 0 },
    },
  };

  /* ---------------- génération ---------------- */
  const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  const FURN = [
    ['furn_couch', 0.8, 1.9, 0.9, 0.9], ['furn_armchair', 0.9, 0.9, 0.9, 0.9], ['furn_table_medium', 0.8, 1.6, 0.9, 0.88],
    ['furn_shelf_B_large_decorated', 2.0, 1.6, 0.55, 0.9], ['furn_cabinet_medium_decorated', 1.2, 1.0, 0.55, 0.85], ['furn_shelf_A_big', 1.9, 1.4, 0.5, 0.9],
  ];
  function genTilted(def, seed, diff, rng, H) {
    const { FLOOR, WALL, VOID } = H;
    const BS = 10, SW = 3, NB = 3, W = 1 + SW + NB * (BS + SW) + 1, Hh = W, F = 5;
    const m = H.newMap('tilted', def, W, Hh, F, seed);
    const Z = { asphalt: 1, sidewalk: 2, plaza: 3, wood: 4, roof: 5, concrete: 6, shop: 7, bridge: 8, grass: 9, office: 10 };
    const WZ = { brick: 1, blue: 2, cream: 3, office: 4, shopA: 5, shopB: 6, int: 7, bound: 8, clock: 9 };
    m.noWall = []; for (let f = 0; f < F; f++) m.noWall.push(new Uint8Array(m.WH));
    const id = (x, y) => y * W + x;
    for (let i = 0; i < m.WH; i++) { m.t[0][i] = FLOOR; m.zone[0][i] = Z.asphalt; for (let f = 1; f < F; f++) m.t[f][i] = VOID; }
    // limite de la carte : barrières de chantier (murs « logiques »)
    for (let f = 0; f < F; f++) for (let k = 0; k < W; k++) for (const [x, y] of [[k, 0], [k, Hh - 1], [0, k], [W - 1, k]]) { H.set(m, f, x, y, WALL, WZ.bound); m.noWall[f][id(x, y)] = 1; }
    const blocks = [], pdoors = [];
    for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) { const x0 = 1 + SW + bx * (BS + SW), y0 = 1 + SW + by * (BS + SW); blocks.push({ bx, by, x0, y0, x1: x0 + BS - 1, y1: y0 + BS - 1 }); }
    const center = blocks.find(b => b.bx === 1 && b.by === 1);
    const types = ['tower', 'tower', 'tower', 'mid', 'mid', 'low', 'lot', 'square'];
    BR.shuffle(types, rng);
    blocks.forEach(b => { b.type = b === center ? 'plaza' : types.pop(); });
    for (const b of blocks) {
      H.rect(m, 0, b.x0, b.y0, b.x1, b.y1, FLOOR, Z.sidewalk);
      const fx0 = b.x0 + 1, fy0 = b.y0 + 1, fx1 = b.x1 - 1, fy1 = b.y1 - 1;
      if (b.type === 'tower' || b.type === 'mid' || b.type === 'low') {
        const T = b.type === 'tower' ? 4 : b.type === 'mid' ? 3 : 2;
        const up = b.type === 'tower' && rng() < 0.5 ? WZ.office : BR.pick([WZ.brick, WZ.blue, WZ.cream], rng), ground = up === WZ.office ? WZ.office : rng() < 0.5 ? WZ.shopA : WZ.shopB;
        const inner = up === WZ.office ? Z.office : Z.wood;
        b.office = up === WZ.office;
        for (let f = 0; f < T; f++) {
          H.rect(m, f, fx0, fy0, fx1, fy1, WALL, f === 0 ? ground : up);
          H.rect(m, f, fx0 + 1, fy0 + 1, fx1 - 1, fy1 - 1, FLOOR, f === 0 && ground !== WZ.office ? Z.shop : inner);
          for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) m.indoor[f][id(x, y)] = 1;
        }
        H.rect(m, T, fx0, fy0, fx1, fy1, FLOOR, Z.roof);
        // escaliers intérieurs, un par étage jusqu'au toit, le long de deux murs opposés en alternance :
        // le départ et l'arrivée donnent toujours sur la partie dégagée de l'étage (sinon des étages entiers devenaient inaccessibles)
        const rot = rng() < 0.5, flip = rng() < 0.5;
        for (let f = 0; f < T; f++) {
          const side = (f + (flip ? 1 : 0)) % 2;
          let ok;
          if (!rot) ok = side ? H.addRamp(m, f, fx1 - 1, fy1 - 2, 0, -1, 4, { zone: Z.concrete }) : H.addRamp(m, f, fx0 + 1, fy0 + 2, 0, 1, 4, { zone: Z.concrete });
          else ok = side ? H.addRamp(m, f, fx1 - 2, fy1 - 1, -1, 0, 4, { zone: Z.concrete }) : H.addRamp(m, f, fx0 + 2, fy0 + 1, 1, 0, 4, { zone: Z.concrete });
          if (!ok) return null;
        }
        // cloison avec passage
        for (let f = 0; f < T; f++) if (rng() < 0.55) {
          const vx = ri(rng, fx0 + 3, fx1 - 3), cells = [];
          for (let y = fy0 + 1; y <= fy1 - 1; y++) { const i = id(vx, y); if (m.t[f][i] === FLOOR && m.rampAt[f][i] < 0 && !m.ramps.some(r => (r.f === f && r.approach === i) || (r.f + 1 === f && r.landing === i))) cells.push(y); }
          if (cells.length >= fy1 - fy0 - 1) { for (const y of cells) H.set(m, f, vx, y, WALL, WZ.int); const d = cells[ri(rng, 1, cells.length - 2)]; H.set(m, f, vx, d, FLOOR, inner); H.set(m, f, vx, d + 1, FLOOR, inner); pdoors.push([f, vx, d], [f, vx, d + 1]); }
        }
        // portes au rez-de-chaussée (une par façade, jamais sur le flanc d'un escalier), fenêtres soufflées aux étages
        const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]], n = fx1 - fx0 - 1;
        const along = (dx, dy, k) => dy ? [fx0 + 1 + k, dy < 0 ? fy0 : fy1] : [dx < 0 ? fx0 : fx1, fy0 + 1 + k];
        const innerOk = (f, x, y, dx, dy) => { const i = id(x - dx, y - dy); return m.t[f][i] === FLOOR && m.rampAt[f][i] < 0; };
        b.doors = [];
        for (const [dx, dy] of sides) {
          for (let tr = 0; tr < 12; tr++) {
            const d0 = ri(rng, 1, n - 3), wide = rng() < 0.45, ks = wide ? [d0, d0 + 1] : [d0];
            if (!ks.every(k => { const [x, y] = along(dx, dy, k); return innerOk(0, x, y, dx, dy); })) continue;
            for (const k of ks) { const [x, y] = along(dx, dy, k); H.set(m, 0, x, y, FLOOR, Z.shop); b.doors.push([x, y, dx, dy]); }
            break;
          }
          for (let f = 1; f < T; f++) if (rng() < 0.55) { const [x, y] = along(dx, dy, ri(rng, 0, n - 1)); if (innerOk(f, x, y, dx, dy)) H.set(m, f, x, y, FLOOR, inner); }
        }
        b.roof = T;
      } else if (b.type === 'plaza') {
        H.rect(m, 0, fx0, fy0, fx1, fy1, FLOOR, Z.plaza);
        // tour de l'horloge (2×2 cases, sur toute la hauteur)
        for (let f = 0; f < F; f++) for (let y = 21; y <= 22; y++) for (let x = 21; x <= 22; x++) { H.set(m, f, x, y, WALL, WZ.clock); m.noWall[f][id(x, y)] = 1; }
      } else if (b.type === 'square') {
        H.rect(m, 0, fx0, fy0, fx1, fy1, FLOOR, Z.grass);
        H.rect(m, 0, fx0 + 3, fy0, fx0 + 4, fy1, FLOOR, Z.plaza); H.rect(m, 0, fx0, fy0 + 3, fx1, fy0 + 4, FLOOR, Z.plaza);
      } else if (b.type === 'lot') {
        H.rect(m, 0, fx0, fy0, fx1, fy1, FLOOR, Z.asphalt);
        b.lot = true;
      }
    }
    // passerelles entre toits de même hauteur
    const at = (bx, by) => blocks.find(b => b.bx === bx && b.by === by);
    for (const b of blocks) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const o = at(b.bx + dx, b.by + dy); if (!o || !b.roof || !o.roof || rng() < 0.3) continue;
      const f = Math.min(b.roof, o.roof);
      // à des hauteurs différentes : passerelle depuis le dernier étage du plus haut (par une fenêtre ouverte)
      // la passerelle doit déboucher sur du plancher libre des deux côtés (pas sur une trémie d'escalier)
      const okIn = (x, y) => m.t[f][id(x, y)] === FLOOR && m.rampAt[f][id(x, y)] < 0;
      for (let tr = 0; tr < 10; tr++) {
        if (dx) {
          const y = ri(rng, b.y0 + 2, b.y1 - 3);
          if (![y, y + 1].every(yy => okIn(b.x1 - 2, yy) && okIn(o.x0 + 2, yy))) continue;
          for (let x = b.x1 - 1; x <= o.x0 + 1; x++) for (let yy = y; yy <= y + 1; yy++) { const i = id(x, yy); if (m.t[f][i] === VOID || m.t[f][i] === WALL) H.set(m, f, x, yy, FLOOR, Z.bridge); }
        } else {
          const x = ri(rng, b.x0 + 2, b.x1 - 3);
          if (![x, x + 1].every(xx => okIn(xx, b.y1 - 2) && okIn(xx, o.y0 + 2))) continue;
          for (let y = b.y1 - 1; y <= o.y0 + 1; y++) for (let xx = x; xx <= x + 1; xx++) { const i = id(xx, y); if (m.t[f][i] === VOID || m.t[f][i] === WALL) H.set(m, f, xx, y, FLOOR, Z.bridge); }
        }
        break;
      }
    }
    // départ : sur la place, au pied de l'horloge ; sortie : au bout d'une rue
    m.spawn = { f: 0, cx: 19, cy: 23 };
    const streetRows = []; for (let k = 0; k <= NB; k++) streetRows.push(1 + k * (BS + SW) + 1);
    const exits = [];
    for (const r of streetRows) exits.push({ cx: 1, cy: r, dx: -1, dy: 0 }, { cx: W - 2, cy: r, dx: 1, dy: 0 }, { cx: r, cy: 1, dx: 0, dy: -1 }, { cx: r, cy: Hh - 2, dx: 0, dy: 1 });
    exits.sort((a, b) => Math.hypot(b.cx - m.spawn.cx, b.cy - m.spawn.cy) - Math.hypot(a.cx - m.spawn.cx, a.cy - m.spawn.cy));
    m.exit = exits[Math.floor(rng() * 6)];
    const e = m.exit;
    const keep = (x, y) => Math.abs(x - m.spawn.cx) + Math.abs(y - m.spawn.cy) > 3 && Math.abs(x - e.cx) + Math.abs(y - e.cy) > 4;
    const free = (f, x, y) => H.inb(m, x, y) && H.freeCell(m, f, id(x, y)) && (f > 0 || keep(x, y));
    // portes : on garde leurs abords dégagés
    const nearDoor = (x, y) => blocks.some(b => b.doors && b.doors.some(([dx2, dy2]) => Math.abs(dx2 - x) + Math.abs(dy2 - y) <= 1));
    // abords d'un escalier (départ, arrivée, marches) : rien ne doit en bloquer l'accès
    const nearRamp = (f, x, y) => m.ramps.some(r => !r.dead && [...(r.f === f ? r.cells.concat([r.approach]) : []), ...(r.f + 1 === f ? [r.landing] : [])].some(i => Math.max(Math.abs(i % W - x), Math.abs(((i / W) | 0) - y)) <= 1));
    // voitures garées et abandonnées en travers des rues
    for (const r of streetRows) for (let k = 3; k < W - 4; k += ri(rng, 4, 7)) {
      if (rng() < 0.6 && keep(k, r - 1)) H.carProps(m, 0, k, r - 1, rng, true);
      if (rng() < 0.6 && keep(r - 1, k)) H.carProps(m, 0, r - 1, k, rng, false);
      if (rng() < 0.2 && keep(k, r + 1)) H.carProps(m, 0, k, r + 1, rng, true);
    }
    for (const b of blocks) {
      // lampadaires aux coins
      for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y1], [b.x0, b.y1], [b.x1, b.y0]]) if (rng() < 0.85 && free(0, x, y) && !nearDoor(x, y)) {
        const dx = x === b.x0 ? -1 : 1, dz = y === b.y0 ? -1 : 1, horiz = rng() < 0.5;
        const ax = horiz ? dx : 0, az = horiz ? 0 : dz, ry = Math.atan2(az, -ax);
        const p = H.addProp(m, 0, x, y, 'lamp', 6.0, 0.3, 0.3, { rot: ry });
        if (p) { p.hx = p.x + ax * 1.35; p.hz = p.z + az * 1.35; m.lights.push({ f: 0, cx: x, cy: y, y: 5.5, kind: 'lamp', dead: rng() < 0.15, flicker: rng() < 0.18, phase: rng() * 100, px: p.hx, pz: p.hz }); }
      }
      const fx0 = b.x0 + 1, fy0 = b.y0 + 1, fx1 = b.x1 - 1, fy1 = b.y1 - 1;
      if (rng() < 0.6) { const x = ri(rng, b.x0 + 1, b.x1 - 1), y = rng() < 0.5 ? b.y0 : b.y1; if (free(0, x, y) && !nearDoor(x, y)) H.addProp(m, 0, x, y, 'dumpster', 1.3, 1.8, 1.2); }
      if (rng() < 0.7) { const x = ri(rng, b.x0 + 1, b.x1 - 1), y = rng() < 0.5 ? b.y0 : b.y1; if (free(0, x, y) && !nearDoor(x, y)) H.addProp(m, 0, x, y, 'hydrant', 0.95, 0.5, 0.5); }
      if (b.type === 'plaza') {
        for (const [x, y] of [[18, 18], [25, 18], [18, 25], [25, 25]]) if (free(0, x, y)) H.addProp(m, 0, x, y, 'tree', 6, 0.7, 0.7, { data: { tree: { kind: 'broad', scale: 1.0 + rng() * 0.25 } } });
        for (const [x, y, w] of [[20, 18, 1], [23, 18, 1], [20, 25, 1], [23, 25, 1], [18, 20, 0], [18, 23, 0], [25, 20, 0], [25, 23, 0]]) if (free(0, x, y)) H.addProp(m, 0, x, y, 'bench', 0.45, w ? 1.7 : 0.7, w ? 0.7 : 1.7);
        for (const [x, y] of [[20, 20], [23, 20], [20, 23], [23, 23]]) if (free(0, x, y)) H.addProp(m, 0, x, y, 'planter', 0.55, 1.2, 1.2, { nodraw: true });
        for (const [x, y] of [[19, 21], [24, 22]]) if (free(0, x, y)) { const p = H.addProp(m, 0, x, y, 'plamp', 4.2, 0.3, 0.3, { nodraw: true }); if (p) H.lampLight(m, p.x, 3.9, p.z, rng, { dead: 0, flicker: 0.1 }); }
      } else if (b.type === 'square') {
        for (let k = 0; k < 10; k++) { const x = ri(rng, fx0, fx1), y = ri(rng, fy0, fy1); if (m.zone[0][id(x, y)] === Z.grass && free(0, x, y)) H.addProp(m, 0, x, y, 'tree', 6, 0.7, 0.7, { data: { tree: { kind: rng() < 0.2 ? 'conifer' : 'broad' } } }); }
        for (let k = 0; k < 6; k++) { const x = ri(rng, fx0, fx1), y = ri(rng, fy0, fy1); if (m.zone[0][id(x, y)] === Z.plaza && free(0, x, y)) H.addProp(m, 0, x, y, 'bench', 0.45, 1.7, 0.7); }
      } else if (b.lot) {
        for (let y = fy0 + 1; y <= fy1 - 1; y += 3) for (let x = fx0; x <= fx1 - 1; x += 2) if (rng() < 0.55 && keep(x, y)) H.carProps(m, 0, x, y, rng, false);
      }
      if (b.roof) {
        const f = b.roof;
        const tryRoof = (kind, h, w, d, o) => { for (let k = 0; k < 14; k++) { const x = ri(rng, fx0 + 1, fx1 - 1), y = ri(rng, fy0 + 1, fy1 - 1); if (free(f, x, y) && !nearRamp(f, x, y)) return H.addProp(m, f, x, y, kind, h, w, d, o); } return null; };
        if (rng() < 0.55) tryRoof('tower', 3.6, 1.9, 1.9);
        for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) tryRoof('ac', 1.0, 1.5, 1.1);
        if (rng() < 0.5) tryRoof('antenna', 3.0, 0.3, 0.3, { nodraw: true });
        // mobilier intérieur (modèles KayKit), un peu à chaque étage
        for (let fl = 0; fl < f; fl++) for (let k = 0, n = 0; k < 40 && n < (fl === 0 ? 4 : 5); k++) {
          const x = ri(rng, fx0 + 1, fx1 - 1), y = ri(rng, fy0 + 1, fy1 - 1);
          if (!free(fl, x, y) || nearDoor(x, y) || nearRamp(fl, x, y)) continue;
          // ni à côté d'un autre meuble (coins enfermés), ni devant le passage d'une cloison
          let crowd = false;
          for (let yy = y - 1; yy <= y + 1 && !crowd; yy++) for (let xx = x - 1; xx <= x + 1; xx++) { const j = id(xx, yy); if (m.propAt[fl][j] >= 0 || m.t[fl][j] === VOID || m.t[fl][j] === H.RAMP) { crowd = true; break; } }
          if (crowd || pdoors.some(([pf, px, py]) => pf === fl && Math.max(Math.abs(px - x), Math.abs(py - y)) <= 1)) continue;
          // pas devant une ouverture de façade (porte, fenêtre soufflée, arrivée de passerelle)
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => { const xx = x + a, yy = y + c; return (xx === fx0 || xx === fx1 || yy === fy0 || yy === fy1) && m.t[fl][id(xx, yy)] !== WALL; })) continue;
          // pas devant une fenêtre soufflée ni contre un passage de cloison
          const wallN = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, c]) => m.t[fl][id(x + a, y + c)] === WALL).length; if (wallN !== 1) continue;
          const fu = fl === 0 && m.zone[0][id(x, y)] === Z.shop ? (rng() < 0.6 ? FURN[5] : FURN[4]) : FURN[Math.floor(rng() * FURN.length)];
          const wd = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([a, c]) => m.t[fl][id(x + a, y + c)] === WALL);
          // bureaux : postes de travail (bureau, écran, fauteuil) plutôt que des meubles de salon
          if (b.office && fl > 0 && rng() < 0.7) { if (H.addProp(m, fl, x, y, 'odesk', 0.78, wd[0] ? 0.8 : 1.6, wd[0] ? 1.6 : 0.8, { nodraw: true, ox: wd[0] * 0.55, oz: wd[1] * 0.55, data: { wx: wd[0], wz: wd[1] } })) n++; continue; }
          if (H.addProp(m, fl, x, y, 'furn', fu[1], Math.min(1.9, wd[0] ? fu[3] : fu[2]), Math.min(1.9, wd[0] ? fu[2] : fu[3]), { nodraw: true, ox: wd[0] * (1 - fu[3] / 2 - 0.05), oz: wd[1] * (1 - fu[3] / 2 - 0.05), data: { model: fu[0], sc: fu[4], ry: Math.atan2(-wd[0], -wd[1]) } })) n++;
        }
      }
    }
    // sécurité : un meuble qui isole une partie d'un étage est retiré (contrôle sur le vrai graphe de navigation)
    for (let pass = 0; pass < 4; pass++) {
      Wd.buildNav(m);
      const reach = Wd.forward(m, m.spawn.f * m.WH + id(m.spawn.cx, m.spawn.cy));
      let removed = 0;
      for (let n = 0; n < m.nav.N; n++) {
        if (!m.nav.walk[n] || reach[n] >= 0) continue;
        const f = Math.floor(n / m.WH), i = n - f * m.WH, x = i % W, y = (i / W) | 0;
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
          const j = id(xx, yy), pi = m.propAt[f][j]; if (pi < 0) continue;
          const p = m.props[pi]; if (p.kind !== 'furn' && p.kind !== 'odesk' && p.kind !== 'ac' && p.kind !== 'tower' && p.kind !== 'antenna') continue;
          p.dead = true; m.propAt[f][j] = -1; removed++;
        }
      }
      if (!removed) break;
    }
    if (!H.finalize(m, rng, diff)) return null;
    // murs « logiques » restés vides au-dessus : rien à dessiner
    for (let f = 1; f < F; f++) for (let i = 0; i < m.WH; i++) if (m.t[f][i] === WALL && m.noWall[f - 1][i]) m.noWall[f][i] = 1;
    H.panelLights(m, rng, TX.theme('tilted'), (f, i) => m.indoor[f][i] === 1);
    m.blocks = blocks.map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, type: b.type, roof: b.roof || 0 }));
    return m;
  }
  Wd.gens.tilted = genTilted;

  /* ---------------- décor ---------------- */
  const SHOPN = ['BOULANGERIE', 'PHARMACIE', 'CAFÉ', 'PIZZERIA', 'LAVERIE', 'FLEURISTE', 'QUINCAILLERIE', 'BOUCHERIE', 'LIBRAIRIE', 'COIFFEUR', 'ÉPICERIE', 'OPTICIEN', 'TABAC - PRESSE', 'BRASSERIE'];
  function tiltDecor(m, B, inst, rng, H, group) {
    const { C, SH, WALL } = H, W = m.W, Hh = m.H;
    const id = (x, y) => y * W + x;
    const bx = (Bf, x0, y0, z0, x1, y1, z1, col, s) => H.box(Bf, x0, y0, z0, x1, y1, z1, col || [1, 1, 1], s || 0.5);
    const ST = B('stone'), SL = B('stoneL'), BA = B('barrier'), IR = B('iron'), ZN = B('zinc'), GL = B('gloss');
    H.cityDecor(m, B, inst, rng);                 // marquages au sol, passages piétons, bordures
    // sol extérieur et silhouettes au loin
    { const O = B('f1'), Wm = W * C, Hm = Hh * C, R = 70;
      const q = (x0, z0, x1, z1) => H.quad(O, [[x0, -0.02, z1], [x1, -0.02, z1], [x1, -0.02, z0], [x0, -0.02, z0]], [0, 1, 0], [[x0 / 2, z1 / 2], [x1 / 2, z1 / 2], [x1 / 2, z0 / 2], [x0 / 2, z0 / 2]], 0.7);
      q(-R, -R, Wm + R, 0); q(-R, Hm, Wm + R, Hm + R); q(-R, 0, 0, Hm); q(Wm, 0, Wm + R, Hm);
      if (inst) H.skyline(m, inst, rng);
    }
    // limite : sol sous les barrières, blocs béton (GBA) + palissade grillagée
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = id(x, y); if (m.t[0][i] !== WALL || !m.noWall[0][i] || m.zone[0][i] !== 8) continue;
      const X0 = x * C, Z0 = y * C, X1 = X0 + C, Z1 = Z0 + C;
      H.quad(B('f1'), [[X0, 0, Z1], [X1, 0, Z1], [X1, 0, Z0], [X0, 0, Z0]], [0, 1, 0], [[X0 / 2, Z1 / 2], [X1 / 2, Z1 / 2], [X1 / 2, Z0 / 2], [X0 / 2, Z0 / 2]], 0.8);
      const along = y === 0 || y === Hh - 1, corner = (x === 0 || x === W - 1) && along;
      if (corner) continue;
      const cx = X0 + 1, cz = Z0 + 1;
      // bloc béton profilé
      if (along) { bx(BA, X0 + 0.05, 0, cz - 0.3, X1 - 0.05, 0.25, cz + 0.3, [0.95, 0.95, 0.92]); bx(BA, X0 + 0.05, 0.25, cz - 0.12, X1 - 0.05, 0.85, cz + 0.12, [0.95, 0.95, 0.92]); bx(B('fence'), X0, 0.85, cz - 0.01, X1, 2.4, cz + 0.01, [1, 1, 1]); bx(IR, X0 - 0.03, 0.85, cz - 0.03, X0 + 0.03, 2.45, cz + 0.03, [1, 1, 1]); if (x % 3 === 0) bx(B('glow'), cx - 0.6, 0.55, cz + (y === 0 ? 0.13 : -0.14), cx + 0.6, 0.65, cz + (y === 0 ? 0.14 : -0.13), [1, 0.5, 0.1]); }
      else { bx(BA, cx - 0.3, 0, Z0 + 0.05, cx + 0.3, 0.25, Z1 - 0.05, [0.95, 0.95, 0.92]); bx(BA, cx - 0.12, 0.25, Z0 + 0.05, cx + 0.12, 0.85, Z1 - 0.05, [0.95, 0.95, 0.92]); bx(B('fence'), cx - 0.01, 0.85, Z0, cx + 0.01, 2.4, Z1, [1, 1, 1]); bx(IR, cx - 0.03, 0.85, Z0 - 0.03, cx + 0.03, 2.45, Z0 + 0.03, [1, 1, 1]); }
    }
    // tour de l'horloge (place centrale)
    { const cx = 22 * C, cz = 22 * C, h0 = 0;
      bx(ST, cx - 2.2, h0, cz - 2.2, cx + 2.2, 1.2, cz + 2.2, [0.85, 0.85, 0.85]);
      bx(ST, cx - 1.95, 1.2, cz - 1.95, cx + 1.95, 15.5, cz + 1.95, [1, 1, 1]);
      for (const yy of [5.5, 10.5]) bx(SL, cx - 2.05, yy, cz - 2.05, cx + 2.05, yy + 0.3, cz + 2.05, [1, 1, 1]);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(SL, cx + sx * 1.95 - 0.25, 1.2, cz + sz * 1.95 - 0.25, cx + sx * 1.95 + 0.25, 15.6, cz + sz * 1.95 + 0.25, [0.95, 0.95, 0.95]);
      bx(SL, cx - 2.3, 15.5, cz - 2.3, cx + 2.3, 16.0, cz + 2.3, [1, 1, 1]);
      // beffroi ajouré
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(ST, cx + sx * 1.7 - 0.3, 16, cz + sz * 1.7 - 0.3, cx + sx * 1.7 + 0.3, 19, cz + sz * 1.7 + 0.3, [1, 1, 1]);
      bx(ST, cx - 1.2, 16, cz - 1.2, cx + 1.2, 18.6, cz + 1.2, [0.35, 0.33, 0.32]);
      bx(SL, cx - 2.2, 19, cz - 2.2, cx + 2.2, 19.4, cz + 2.2, [1, 1, 1]);
      H.tube(ZN, [[cx, 19.4, cz], [cx, 21.5, cz], [cx, 24.5, cz]], [3.0, 1.2, 0.05], 4, [0.8, 0.9, 0.9], 1);
      H.cyl(IR, cx, cz, 24.4, 26, 0.05, 0.02, 6, [1, 1, 1]);
      // cadrans éclairés (une même heure sur les 4 faces : 23 h 58)
      const face = P.mk(256, 256, (g, w, h) => {
        g.fillStyle = '#f3ecd6'; g.beginPath(); g.arc(128, 128, 124, 0, 6.283); g.fill();
        g.strokeStyle = '#2a2622'; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 118, 0, 6.283); g.stroke();
        g.fillStyle = '#2a2622'; for (let k = 0; k < 60; k++) { const a = k / 60 * 6.283, r0 = k % 5 ? 104 : 92; g.save(); g.translate(128, 128); g.rotate(a); g.fillRect(-(k % 5 ? 1.5 : 4), -110, k % 5 ? 3 : 8, 110 - r0); g.restore(); }
        g.font = "bold 22px Georgia, serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; const RN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
        for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.fillText(RN[k], 128 + Math.sin(a) * 74, 128 - Math.cos(a) * 74); }
        const hand = (a, L, wd) => { g.save(); g.translate(128, 128); g.rotate(a); g.fillRect(-wd / 2, -L, wd, L + 12); g.restore(); };
        hand((11 + 58 / 60) / 12 * 6.283, 58, 9); hand(58 / 60 * 6.283, 92, 6); g.beginPath(); g.arc(128, 128, 9, 0, 6.283); g.fill();
      });
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2, me = H.signMesh(face, 2.6, 2.6, { lit: true, emissive: '#d9c78f', transparent: true });
        me.material.alphaTest = 0.5; me.position.set(cx + Math.sin(a) * 1.98, 13.2, cz + Math.cos(a) * 1.98); me.rotation.y = a; group.add(me);
        const fr = H.signMesh(P.mk(16, 16, g => { g.fillStyle = '#3a3226'; g.fillRect(0, 0, 16, 16); }), 3.0, 3.0, { lit: true }); fr.position.set(cx + Math.sin(a) * 1.965, 13.2, cz + Math.cos(a) * 1.965); fr.rotation.y = a; group.add(fr);
      }
      // plaque
      const pl = H.signMesh(BR.Tex.sign('PLACE DE L\'HORLOGE', '#2c2a26', '#e8dcb8', 512, 96), 2.6, 0.5, { lit: true }); pl.position.set(cx, 2.6, cz + 1.97); group.add(pl);
      // bassin octogonal au pied de la tour
      H.tube(SL, [[cx, 0, cz], [cx, 0.55, cz]], [3.6, 3.6], 8, [0.95, 0.95, 0.95], 1);
      H.disk(B('water'), cx, 0.45, cz, 3.4, 8, false, [1, 1, 1]);
    }
    // toits : acrotères, passerelles (garde-corps), antennes, enseignes des commerces
    for (const b of m.blocks) {
      if (!b.roof) continue;
      const f = b.roof, Y = f * SH, x0 = (b.x0 + 1) * C, x1 = b.x1 * C, z0 = (b.y0 + 1) * C, z1 = b.y1 * C, t = 0.25;
      for (const [a0, c0, a1, c1] of [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0, x0 + t, z1], [x1 - t, z0, x1, z1]]) bx(SL, a0, Y, c0, a1, Y + 0.32, c1, [0.85, 0.85, 0.82]);
      // corniche sous le toit
      bx(SL, x0 - 0.18, Y - 0.45, z0 - 0.18, x1 + 0.18, Y - 0.05, z1 + 0.18, [0.9, 0.88, 0.85]);
      // enseignes au-dessus des vitrines (deux par façade sur rue)
      for (const [nx, nz, ry, px, pz] of [[0, -1, Math.PI, (x0 + x1) / 2, z0 - 0.05], [0, 1, 0, (x0 + x1) / 2, z1 + 0.05], [-1, 0, -Math.PI / 2, x0 - 0.05, (z0 + z1) / 2], [1, 0, Math.PI / 2, x1 + 0.05, (z0 + z1) / 2]]) {
        if (rng() < 0.35) continue;
        const name = SHOPN[Math.floor(rng() * SHOPN.length)], hue = Math.floor(rng() * 360);
        const me = H.signMesh(BR.Tex.shopSign(name, hue), 3.0, 0.62, { lit: true, emissive: '#ffffff' });
        me.material.emissiveIntensity = 0.7;
        const off = (rng() - 0.5) * 6;
        me.position.set(px + (nz ? off : 0), 3.55, pz + (nx ? off : 0)); me.rotation.y = ry; group.add(me);
      }
    }
    for (let f = 1; f < m.F; f++) for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = id(x, y); if (m.t[f][i] !== H.FLOOR || m.zone[f][i] !== 8) continue;
      const X0 = x * C, Z0 = y * C, Y = f * SH;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = id(x + dx, y + dy); if (m.t[f][j] !== H.VOID) continue;
        const ex0 = dx === 1 ? X0 + C - 0.06 : X0, ex1 = dx === -1 ? X0 + 0.06 : X0 + C, ez0 = dy === 1 ? Z0 + C - 0.06 : Z0, ez1 = dy === -1 ? Z0 + 0.06 : Z0 + C;
        bx(IR, ex0, Y + 1.0, ez0, ex1, Y + 1.06, ez1, [1, 1, 1]); bx(IR, ex0, Y + 0.5, ez0, ex1, Y + 0.54, ez1, [1, 1, 1]);
        bx(IR, ex0, Y, ez0, ex0 + 0.06, Y + 1.06, ez0 + 0.06, [1, 1, 1]);
        // poutres sous la passerelle
        bx(IR, ex0, Y - 0.5, ez0, ex1, Y - SH * 0.075, ez1, [0.7, 0.7, 0.7]);
      }
    }
    for (const p of m.props) {
      switch (p.kind) {
        case 'antenna': H.cyl(IR, p.x, p.z, p.base, p.base + 3, 0.04, 0.02, 6, [1, 1, 1]); for (let k = 0; k < 3; k++) H.tube(IR, [[p.x - 0.6, p.base + 1.6 + k * 0.45, p.z], [p.x + 0.6, p.base + 1.6 + k * 0.45, p.z]], [0.015, 0.015], 4, [1, 1, 1], 1); bx(B('glow'), p.x - 0.05, p.base + 3, p.z - 0.05, p.x + 0.05, p.base + 3.1, p.z + 0.05, [1, 0.15, 0.1]); break;
        case 'planter': bx(SL, p.x0, p.base, p.z0, p.x1, p.base + 0.55, p.z1, [0.9, 0.88, 0.84]); bx(B('p'), p.x0 + 0.08, p.base + 0.5, p.z0 + 0.08, p.x1 - 0.08, p.base + 0.54, p.z1 - 0.08, [0.2, 0.15, 0.1]); H.treeMesh(B, p.x, p.base + 0.5, p.z, rng, { kind: 'shrub', scale: 0.9 }); break;
        case 'plamp': H.cyl(IR, p.x, p.z, p.base, p.base + 0.5, 0.16, 0.12, 10, [1, 1, 1]); H.cyl(IR, p.x, p.z, p.base + 0.5, p.base + 3.6, 0.06, 0.05, 8, [1, 1, 1], false); for (const s of [-1, 1]) { H.tube(IR, [[p.x, p.base + 3.5, p.z], [p.x + s * 0.5, p.base + 3.75, p.z]], [0.03, 0.03], 5, [1, 1, 1], 1); bx(B('glow'), p.x + s * 0.5 - 0.12, p.base + 3.75, p.z - 0.12, p.x + s * 0.5 + 0.12, p.base + 4.05, p.z + 0.12, [1, 0.88, 0.62]); } break;
        case 'odesk': {
          const d = p.data, b = p.base, PB = B('p');
          bx(PB, p.x0, b + 0.72, p.z0, p.x1, b + 0.78, p.z1, [0.75, 0.72, 0.68]);
          for (const [sx, sz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const xx = sx ? p.x1 - 0.06 : p.x0, zz = sz ? p.z1 - 0.06 : p.z0; bx(PB, xx, b, zz, xx + 0.06, b + 0.72, zz + 0.06, [0.25, 0.25, 0.27]); }
          // écran (dos au mur) + clavier
          const mx = p.x + d.wx * 0.25, mz = p.z + d.wz * 0.25;
          bx(GL, mx - (d.wz ? 0.3 : 0.03), b + 0.95, mz - (d.wx ? 0.3 : 0.03), mx + (d.wz ? 0.3 : 0.03), b + 1.3, mz + (d.wx ? 0.3 : 0.03), [0.08, 0.08, 0.09]);
          bx(PB, mx - 0.04, b + 0.78, mz - 0.04, mx + 0.04, b + 0.95, mz + 0.04, [0.15, 0.15, 0.16]);
          bx(B('glow'), mx - (d.wz ? 0.27 : 0) - d.wx * 0.035, b + 0.98, mz - (d.wx ? 0.27 : 0) - d.wz * 0.035, mx + (d.wz ? 0.27 : 0) - d.wx * 0.031, b + 1.27, mz + (d.wx ? 0.27 : 0) - d.wz * 0.031, rng() < 0.3 ? [0.25, 0.45, 0.8] : [0.03, 0.04, 0.06]);
          bx(PB, p.x - d.wx * 0.1 - (d.wz ? 0.22 : 0.08), b + 0.78, p.z - d.wz * 0.1 - (d.wx ? 0.22 : 0.08), p.x - d.wx * 0.1 + (d.wz ? 0.22 : 0.08), b + 0.8, p.z - d.wz * 0.1 + (d.wx ? 0.22 : 0.08), [0.12, 0.12, 0.13]);
          if (inst) H.put(inst, 'furn_chair_A', p.x - d.wx * 0.75, b, p.z - d.wz * 0.75, Math.atan2(d.wx, d.wz) + (rng() - 0.5) * 0.6, 0.9);
          break;
        }
        case 'furn': if (inst) H.put(inst, p.data.model, p.x, p.base, p.z, p.data.ry, p.data.sc); else bx(B('p'), p.x0, p.base, p.z0, p.x1, p.base + p.h, p.z1, [0.55, 0.45, 0.35]); break;
      }
    }
    // panneau d'entrée de ville
    const pnl = H.signMesh(BR.Tex.sign('BIENVENUE À TILTED', '#1d4a2a', '#f2f2ea', 512, 110), 3.0, 0.65, { lit: true });
    pnl.position.set(22 * C, 2.6, 1.5); group.add(pnl);
    bx(IR, 22 * C - 1.45, 0, 1.43, 22 * C - 1.38, 2.95, 1.48, [1, 1, 1]); bx(IR, 22 * C + 1.38, 0, 1.43, 22 * C + 1.45, 2.95, 1.48, [1, 1, 1]);
  }
  Wd.decor.tilted = tiltDecor;
})();

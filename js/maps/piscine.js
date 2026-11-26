/* ===== maps/piscine.js : PISCINE — niveau 37 des Backrooms (« Poolrooms »)
   Grandes halles carrelées blanc et bleu pâle, sans fin, éclairées au néon. Trois niveaux :
     étage 0 : salles basses et couloirs INONDÉS (eau à 50 cm) + fond des bassins profonds (3,80 m d'eau) ;
               on se réveille au fond d'un bassin VIDÉ ;
     étage 1 : halles avec bassins (marches immergées, plage en pente douce), halles au sol couvert d'une pellicule d'eau ;
     étage 2 : mezzanine du grand bassin, d'où partent deux TOBOGGANS qui jettent dans l'eau.
   L'eau est une donnée de la carte : m.wl[f * WH + i] = hauteur de la surface au-dessus du nœud (−1 : pas d'eau).
   Le jeu (game.js) s'en sert : ralentissement, nage (Espace), hissage au bord, vue sous l'eau, pas qui clapotent.
   Rampes particulières : r.style = 'beach' (plage lisse) ou 'slide' (toboggan), r.nodraw = dessinées ici. ===== */
(function () {
  const BR = window.BR, TX = BR.Tex, P = TX.P, Wd = BR.World;
  const WL0 = 0.5, WLP = 3.78, WLF = 4.05;          // eau : salles inondées, bassins, pellicule des halles
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  // zones de sol (FZ) et de mur (WZ) : même tableau m.zone, lu selon le type de la case
  const FZ = { DECK: 1, BASIN: 2, FLOOD: 3, CORR: 4, DRY: 5, GAL: 6, FILM: 7 };
  const WZ = { HALL: 1, BASIN: 2, FLOOD: 3, PILLAR: 4, UPPER: 5 };

  /* ---------------- textures (dessinées par code) ----------------
     Sols : 256 px = 2 m. Murs : 256 × 512 px = 4 m de large × un étage (4 m), la rangée du bas est au niveau du sol. */
  const tilesOn = (g, w, h, nx, ny, colFn, grout, v) => {
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    const tw = w / nx, th = h / ny, gw = Math.max(1.4, Math.min(tw, th) * 0.09);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      g.fillStyle = P.vary(colFn(i, j), v);
      g.fillRect(i * tw + gw / 2, j * th + gw / 2, tw - gw, th - gw);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(i * tw + gw / 2, j * th + gw / 2, tw - gw, Math.max(1, (th - gw) * 0.22));   // émail
    }
  };
  // rangée j (0 = haut du canvas) d'un mur à 20 carreaux de 20 cm : hauteur de son bas au-dessus du sol
  const rowY = j => 4 - (j + 1) * 0.2;
  Object.assign(TX.MAKE, {
    pwDeck: () => P.mk(256, 256, (g, w, h) => { tilesOn(g, w, h, 10, 10, (i, j) => (i * 7 + j * 3) % 11 ? '#eef3f3' : '#e2ebec', '#b4c3c6', 0.035); P.soft(g, w, h, 5, '90,110,110', 0.03, 0.07, 20, 70); P.fine(g, w, h, 3); }),
    pwFilm: () => P.mk(256, 256, (g, w, h) => { tilesOn(g, w, h, 10, 10, (i, j) => (i + j) % 2 ? '#d5ebf0' : '#cde6ec', '#93b5be', 0.03); P.soft(g, w, h, 6, '60,110,120', 0.03, 0.08, 20, 70); P.fine(g, w, h, 3); }),
    pwBasin: () => P.mk(256, 256, (g, w, h) => { tilesOn(g, w, h, 10, 10, (i, j) => (i * 3 + j) % 5 ? '#a6d7e4' : '#98cddd', '#74aabb', 0.04); P.fine(g, w, h, 3); }),
    pwDry: () => P.mk(256, 256, (g, w, h) => {
      tilesOn(g, w, h, 10, 10, (i, j) => (i * 3 + j) % 5 ? '#a9cfd8' : '#9cc3cc', '#7a9ea6', 0.06);
      P.soft(g, w, h, 10, '95,85,60', 0.08, 0.2, 15, 60); P.soft(g, w, h, 4, '40,45,30', 0.08, 0.16, 10, 30);
      P.cracks(g, w, h, 2, 'rgba(40,50,50,0.5)', 1.2); P.speckle(g, w, h, 300, ['rgba(60,50,30,0.35)', 'rgba(255,255,255,0.2)'], 1, 2.5); P.fine(g, w, h, 6);
    }),
    pwFlood: () => P.mk(256, 256, (g, w, h) => { tilesOn(g, w, h, 10, 10, (i, j) => (i + j * 2) % 7 ? '#bccbc7' : '#aebfba', '#71837e', 0.06); P.soft(g, w, h, 12, '40,70,55', 0.06, 0.16, 15, 60); P.fine(g, w, h, 6); }),
    pwCorr: () => P.mk(256, 256, (g, w, h) => { tilesOn(g, w, h, 12, 12, (i, j) => (j === 0 || j === 11) ? '#7fbad3' : '#f0f4f4', '#b7c5c8', 0.03); P.soft(g, w, h, 4, '90,110,110', 0.03, 0.06, 20, 60); P.fine(g, w, h, 3); }),
    pwWall: () => P.mk(256, 512, (g, w, h) => {
      tilesOn(g, w, h, 20, 20, (i, j) => { const y = rowY(j); return y >= 0.99 && y < 1.19 ? '#2f7ea6' : y >= 1.19 && y < 1.39 ? '#8ccbe0' : y < 0.19 ? '#9fc3cf' : '#f0f5f5'; }, '#bccacd', 0.03);
      P.grime(g, w, h, 0.35, 0.12); P.fine(g, w, h, 3);
    }),
    pwBasinWall: () => P.mk(256, 512, (g, w, h) => {
      tilesOn(g, w, h, 20, 20, (i, j) => { const y = rowY(j); return y >= 3.79 ? '#f2f6f6' : y >= 3.59 ? '#3d8fb3' : '#a9d9e6'; }, '#7cb0c0', 0.035);
      P.fine(g, w, h, 3);
    }),
    pwFloodWall: () => P.mk(256, 512, (g, w, h) => {
      tilesOn(g, w, h, 20, 20, (i, j) => rowY(j) >= 1.99 && rowY(j) < 2.19 ? '#6f9a92' : '#cdd7d3', '#8b9a96', 0.05);
      // marque de l'eau à 50 cm, algues et coulures
      const wy = h * (1 - 0.55 / 4), gr = g.createLinearGradient(0, wy - 10, 0, h);
      gr.addColorStop(0, 'rgba(40,70,50,0)'); gr.addColorStop(0.12, 'rgba(40,70,50,0.45)'); gr.addColorStop(1, 'rgba(25,45,35,0.6)');
      g.fillStyle = gr; g.fillRect(0, wy - 10, w, h - wy + 10);
      g.fillStyle = 'rgba(30,50,40,0.5)'; g.fillRect(0, wy - 2, w, 3);
      P.streaks(g, 0, 0, w, 160, 0.12); P.soft(g, w, h, 8, '40,60,45', 0.05, 0.14, 15, 60); P.fine(g, w, h, 6);
    }),
    pwUpper: () => P.mk(256, 512, (g, w, h) => { tilesOn(g, w, h, 20, 20, () => '#f1f5f5', '#c3d0d2', 0.025); P.fine(g, w, h, 3); }),
    pwCeil: () => P.ceilTiles('#f2f6f6', '#c7d1d3'),
    pwStairs: () => P.stairs('#eef3f4', '#2f78a0'),
    pwEdge: () => P.edge('#f3f6f6', '#3b86ad'),
    pwWindow: () => P.mk(256, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d9eef8'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#b9cbd3'; for (let x = 0; x <= w; x += 64) g.fillRect(x - 4, 0, 8, h); for (let y = 0; y <= h; y += 85) g.fillRect(0, y - 4, w, 8);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 0, w, 10);
    }),
  });

  /* ---------------- thème ---------------- */
  TX.THEMES.piscine = {
    name: 'Piscine', fog: 0x86b3bb, fogDensity: 0.015, ambient: 0xcfe8ed, ambientI: 0.42, hemi: [0xffffff, 0x6fa6b3, 0.34], exposure: 0.85,
    lightColor: 0xeef9ff, panel: '#f5fdff', flicker: 0.06, deadLights: 0.05, outdoor: false, lightI: 0.85, flashI: 0.55,
    env: { kind: 'indoor', wall: '#d2e5e9', floor: '#8dbdc8', ceil: '#e9f1f2', panel: '#ffffff' },
    tex: {
      floor: {
        1: { t: 'pwDeck', rough: 0.16, env: 1.5, surf: 'tile' }, 2: { t: 'pwBasin', rough: 0.22, env: 1.0, surf: 'tile' }, 3: { t: 'pwFlood', rough: 0.3, env: 1.1, surf: 'tile' },
        4: { t: 'pwCorr', rough: 0.18, env: 1.4, surf: 'tile' }, 5: { t: 'pwDry', rough: 0.65, env: 0.5, surf: 'tile' }, 6: { t: 'pwDeck', rough: 0.2, env: 1.4, surf: 'tile' },
        7: { t: 'pwFilm', rough: 0.06, env: 2.2, surf: 'tile' }, 0: { t: 'pwDeck', rough: 0.16, surf: 'tile' },
      },
      wall: { 1: { t: 'pwWall', rough: 0.2, env: 1.2 }, 2: { t: 'pwBasinWall', rough: 0.2, env: 1.0 }, 3: { t: 'pwFloodWall', rough: 0.35, env: 0.8 }, 4: { t: 'pwWall', rough: 0.2, env: 1.2 }, 5: { t: 'pwUpper', rough: 0.22, env: 1.1 }, 0: { t: 'pwWall', rough: 0.2 } },
      ci: { t: 'pwCeil', n: 0.8 }, co: { t: 'pwCeil' }, e: { t: 'pwEdge', rough: 0.3 }, r: { t: 'pwStairs', rough: 0.25, env: 1.2, surf: 'tile' }, rs: { t: 'pwUpper', rough: 0.22 }, rr: { t: 'pwUpper', rough: 0.22 },
    },
    mats: {
      pwater: { color: '#0f8fab', rough: 0.04, metal: 0.05, transparent: true, opacity: 0.7, nmap: 'water', nrep: [0.45, 0.45], n: 1.0, env: 1.1, flow: [0.011, 0.007], emissive: '#0a5a6c', double: true },
      pdeep: { color: '#0b7d97', rough: 0.5, transparent: true, opacity: 0.32, emissive: '#06414f', env: 0, double: true },
      fwater: { color: '#2b6a5d', rough: 0.06, metal: 0.05, transparent: true, opacity: 0.78, nmap: 'water', nrep: [0.5, 0.5], n: 0.8, env: 0.9, flow: [0.006, 0.004], emissive: '#062a22', double: true },
      film: { color: '#c3e9f0', rough: 0.02, metal: 0.05, transparent: true, opacity: 0.22, nmap: 'water', nrep: [0.6, 0.6], n: 0.45, env: 2.6, flow: [0.004, 0.003], double: true },
      inox: { t: 'metal', color: '#d3dadd', rough: 0.22, metal: 0.85, env: 1.6 },
      plast: { t: 'noise', color: '#f3f4ef', rough: 0.42, env: 0.6 },
      slide: { t: 'noise', rough: 0.32, env: 0.35, double: true },
      coping: { t: 'pwUpper', color: '#f7f9f9', rough: 0.35, env: 0.9 },
      glassR: { color: '#d5f1f6', rough: 0.04, metal: 0.1, transparent: true, opacity: 0.22, env: 2.2, double: true },
      window: { t: 'pwWindow', basic: true },
      grate: { t: 'grate', color: '#9aa7ab', rough: 0.5, metal: 0.5 },
      pipe: { t: 'metal', color: '#8a9ba0', rough: 0.45, metal: 0.6, env: 0.8 },
      pot: { t: 'noise', color: '#e9e6dc', rough: 0.6 },
      buoy: { t: 'noise', color: '#ffffff', rough: 0.5 },
    },
  };

  /* ---------------- génération ---------------- */
  function genPiscine(def, seed, diff, rng, H) {
    const { FLOOR, WALL, VOID, RAMP } = H;
    const BS = 15, SW = 3, NB = 3, W = 1 + SW + NB * (BS + SW) + 1, Hh = W, F = 3;    // 59 × 59 cases (118 m)
    const m = H.newMap('piscine', def, W, Hh, F, seed);
    const WH = m.WH, id = (x, y) => y * W + x;
    for (let i = 0; i < WH; i++) { m.zone[0][i] = WZ.FLOOD; m.zone[1][i] = WZ.HALL; m.zone[2][i] = WZ.UPPER; }
    const prot = new Uint8Array(WH);     // étage 0 : bassins et leurs parois (jamais percés pour relier le réseau inondé)
    const net = new Uint8Array(WH);      // étage 0 : réseau inondé (salles basses + couloirs)
    const bas = new Uint8Array(WH);      // étage 0 : 1 = bassin plein, 2 = bassin vidé
    const holes = [];

    /* --- halles (étage 1), une par bloc d'une grille 3 × 3 --- */
    const blocks = [];
    for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) { const x0 = 1 + SW + bx * (BS + SW), y0 = 1 + SW + by * (BS + SW); blocks.push({ bx, by, x0, y0, x1: x0 + BS - 1, y1: y0 + BS - 1 }); }
    const at = (bx, by) => blocks.find(b => b.bx === bx && b.by === by);
    const corners = blocks.filter(b => b.bx !== 1 && b.by !== 1);
    const drained = corners[Math.floor(rng() * corners.length)], grand = at(1, 1);
    const types = ['pool', 'beach', 'pool', 'film', 'film', 'hall', 'hall']; BR.shuffle(types, rng);
    blocks.forEach(b => { b.type = b === drained ? 'drained' : b === grand ? 'grand' : types.pop(); });
    for (const b of blocks) {
      const ins = () => b.type === 'grand' ? 0 : ri(rng, 0, b.type === 'hall' || b.type === 'film' ? 2 : 1);
      b.hx0 = b.x0 + ins(); b.hy0 = b.y0 + ins(); b.hx1 = b.x1 - ins(); b.hy1 = b.y1 - ins();
      H.rect(m, 1, b.hx0, b.hy0, b.hx1, b.hy1, FLOOR, b.type === 'film' ? FZ.FILM : FZ.DECK);
      b.reserved = new Set();
      // piliers carrelés (halles inondées : forêt de piliers ; halles simples : parfois)
      const step = b.type === 'film' ? 4 : b.type === 'hall' && rng() < 0.6 ? 5 : 0;
      if (step) for (let y = b.hy0 + 2; y <= b.hy1 - 2; y += step) for (let x = b.hx0 + 2; x <= b.hx1 - 2; x += step) H.set(m, 1, x, y, WALL, WZ.PILLAR);
    }
    /* --- bassins : trou dans la halle (étage 1), cuve fermée par des parois à l'étage 0 --- */
    const basin = (b, x0, y0, x1, y1, dry) => {
      const h = { x0, y0, x1, y1, dry, type: b.type, ramps: [] }; b.hole = h; holes.push(h);
      for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
        const i = id(x, y); prot[i] = 1;
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { m.t[0][i] = FLOOR; m.zone[0][i] = dry ? FZ.DRY : FZ.BASIN; m.t[1][i] = VOID; bas[i] = dry ? 2 : 1; }
        else { m.t[0][i] = WALL; m.zone[0][i] = WZ.BASIN; }
      }
      return h;
    };
    for (const b of blocks) {
      if (b.type === 'grand') basin(b, b.x0 + 2, b.y0 + 7, b.x0 + 12, b.y0 + 12, false);
      else if (b.type === 'pool' || b.type === 'beach' || b.type === 'drained') basin(b, b.hx0 + 2, b.hy0 + 2, b.hx1 - 2, b.hy1 - 2, b.type === 'drained');
    }
    /* --- grand bassin : mezzanine (étage 2) sur le côté nord, double hauteur au-dessus du reste --- */
    {
      const b = grand, x0 = b.x0, y0 = b.y0;
      for (let y = y0; y <= b.y1; y++) for (let x = x0; x <= b.x1; x++) H.set(m, 2, x, y, VOID);
      H.rect(m, 2, x0, y0, b.x1, y0 + 1, FLOOR, FZ.GAL); H.rect(m, 2, x0, y0 + 2, x0 + 1, y0 + 2, FLOOR, FZ.GAL);
      for (let y = y0 + 2; y <= y0 + 7; y++) b.reserved.add(id(x0, y));      // escalier de la mezzanine, le long du mur ouest
    }
    /* --- couloirs de l'étage 1 entre halles voisines : arbre couvrant + quelques boucles --- */
    const links = [];
    for (const b of blocks) { const r = at(b.bx + 1, b.by), d = at(b.bx, b.by + 1); if (r) links.push([b, r, 1]); if (d) links.push([b, d, 0]); }
    BR.shuffle(links, rng);
    const par = new Map(blocks.map(b => [b, b])), find = b => { while (par.get(b) !== b) b = par.get(b); return b; };
    const used = [];
    for (const L of links) { const a = find(L[0]), c = find(L[1]); if (a !== c) { par.set(a, c); used.push(L); } else if (rng() < 0.45) used.push(L); }
    for (const [a, c, horiz] of used) {
      for (let tr = 0; tr < 24; tr++) {
        if (horiz) {
          const lo = Math.max(a.hy0, c.hy0) + 1, hi = Math.min(a.hy1, c.hy1) - 2; if (hi < lo) break;
          const y = ri(rng, lo, hi), door = [[a.hx1, y], [a.hx1, y + 1], [c.hx0, y], [c.hx0, y + 1]];
          if (door.some(([x, yy]) => a.reserved.has(id(x, yy)) || c.reserved.has(id(x, yy)) || m.t[1][id(x, yy)] !== FLOOR)) continue;
          for (let x = a.hx1 + 1; x <= c.hx0 - 1; x++) for (let k = 0; k < 2; k++) H.set(m, 1, x, y + k, FLOOR, FZ.CORR);
        } else {
          const lo = Math.max(a.hx0, c.hx0) + 1, hi = Math.min(a.hx1, c.hx1) - 2; if (hi < lo) break;
          const x = ri(rng, lo, hi), door = [[x, a.hy1], [x + 1, a.hy1], [x, c.hy0], [x + 1, c.hy0]];
          if (door.some(([xx, y]) => a.reserved.has(id(xx, y)) || c.reserved.has(id(xx, y)) || m.t[1][id(xx, y)] !== FLOOR)) continue;
          for (let y = a.hy1 + 1; y <= c.hy0 - 1; y++) for (let k = 0; k < 2; k++) H.set(m, 1, x + k, y, FLOOR, FZ.CORR);
        }
        break;
      }
    }
    /* --- étage 0 : réseau inondé. Couloirs dans les bandes entre les blocs, salles basses sous les halles sans bassin --- */
    const netSet = (x, y, z) => { if (!H.inb(m, x, y)) return; const i = id(x, y); if (prot[i]) return; m.t[0][i] = FLOOR; m.zone[0][i] = z || FZ.FLOOD; net[i] = 1; };
    const lines = [2, 1 + SW + BS, 1 + SW + BS + (BS + SW), 1 + SW + NB * (BS + SW)];   // 2, 19, 37, 55
    for (const L of lines) for (let k = 2; k <= W - 3; k++) for (let w = 0; w < 2; w++) { netSet(L + w, k); netSet(k, L + w); }
    // cloisons qui coupent quelques couloirs (le réseau est ensuite reconnecté si besoin)
    for (let k = 0, n = 0; k < 40 && n < 5; k++) {
      const L = lines[ri(rng, 0, 3)], p = ri(rng, 4, W - 6), vert = rng() < 0.5;
      const cells = [0, 1].map(w => vert ? [L + w, p] : [p, L + w]);
      if (cells.some(([x, y]) => lines.some(L2 => (vert ? y : x) >= L2 - 1 && (vert ? y : x) <= L2 + 2))) continue;   // pas aux carrefours
      for (const [x, y] of cells) { const i = id(x, y); m.t[0][i] = WALL; m.zone[0][i] = WZ.FLOOD; net[i] = 0; }
      n++;
    }
    for (const b of blocks) {
      if (b.hole) continue;
      const x0 = b.x0 + 1, y0 = b.y0 + 1, x1 = b.x1 - 1, y1 = b.y1 - 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) netSet(x, y);
      if (rng() < 0.6) for (let y = y0 + 2; y <= y1 - 2; y += 3) for (let x = x0 + 2; x <= x1 - 2; x += 3) { const i = id(x, y); m.t[0][i] = WALL; m.zone[0][i] = WZ.PILLAR; net[i] = 0; }
      // portes vers les couloirs (2 cases), sur 2 à 4 côtés
      const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]]; BR.shuffle(sides, rng);
      sides.slice(0, ri(rng, 2, 4)).forEach(([dx, dy]) => {
        const k = ri(rng, 2, BS - 4);
        for (let w = 0; w < 2; w++) { if (dy) netSet(b.x0 + k + w, dy < 0 ? b.y0 : b.y1); else netSet(dx < 0 ? b.x0 : b.x1, b.y0 + k + w); }
      });
    }
    // reconnexion du réseau inondé (on ne perce jamais un bassin)
    {
      const comp = new Int32Array(WH).fill(-1), sizes = [];
      for (let i = 0; i < WH; i++) {
        if (!net[i] || comp[i] >= 0) continue;
        const cid = sizes.length; let n = 0; const st = [i]; comp[i] = cid;
        while (st.length) { const c = st.pop(); n++; const x = c % W, y = (c / W) | 0; for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (!H.inb(m, nx, ny)) continue; const j = id(nx, ny); if (net[j] && comp[j] < 0) { comp[j] = cid; st.push(j); } } }
        sizes.push(n);
      }
      const main = sizes.indexOf(Math.max(...sizes));
      for (let cid = 0; cid < sizes.length; cid++) {
        if (cid === main) continue;
        const prev = new Int32Array(WH).fill(-2), q = []; let hit = -1;
        for (let i = 0; i < WH; i++) if (comp[i] === cid) { prev[i] = -1; q.push(i); }
        for (let h = 0; h < q.length && hit < 0; h++) {
          const c = q[h], x = c % W, y = (c / W) | 0;
          for (const [dx, dy] of D4) {
            const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= Hh - 1) continue;
            const j = id(nx, ny); if (prev[j] !== -2 || prot[j]) continue;
            prev[j] = c; if (comp[j] === main) { hit = j; break; } q.push(j);
          }
        }
        if (hit < 0) { for (let i = 0; i < WH; i++) if (comp[i] === cid) { m.t[0][i] = WALL; net[i] = 0; } continue; }
        for (let c = prev[hit]; c >= 0 && prev[c] !== -1; c = prev[c]) if (!net[c]) netSet(c % W, (c / W) | 0);
        for (let i = 0; i < WH; i++) if (comp[i] === cid) comp[i] = main;
      }
    }

    /* --- rampes des bassins : marches immergées ('steps') ou plage en pente douce ('beach') --- */
    const bRamp = (f, h, side, lane, L, style) => {
      let x, y, dx = 0, dy = 0;
      if (side === 'W') { dx = -1; x = h.x0 + L - 1; y = lane; } else if (side === 'E') { dx = 1; x = h.x1 - L + 1; y = lane; }
      else if (side === 'N') { dy = -1; y = h.y0 + L - 1; x = lane; } else { dy = 1; y = h.y1 - L + 1; x = lane; }
      if (!H.addRamp(m, f, x, y, dx, dy, L)) return null;
      const r = m.ramps[m.ramps.length - 1]; r.style = style; r.nodraw = style !== 'steps'; h.ramps.push(r);
      return r;
    };
    const span = (h, side) => side === 'W' || side === 'E' ? h.x1 - h.x0 + 1 : h.y1 - h.y0 + 1;
    const lanesOf = (h, side) => { const out = []; if (side === 'W' || side === 'E') for (let y = h.y0; y <= h.y1; y++) out.push(y); else for (let x = h.x0; x <= h.x1; x++) out.push(x); return out; };
    for (const b of blocks) {
      const h = b.hole; if (!h || b.type === 'grand') continue;
      const sides = ['W', 'E', 'N', 'S']; BR.shuffle(sides, rng);
      if (b.type === 'beach') {
        const side = sides[0], L = Math.min(6, span(h, side) - 3);
        h.beach = side; lanesOf(h, side).forEach(l => bRamp(0, h, side, l, L, 'beach'));
        const opp = { W: 'E', E: 'W', N: 'S', S: 'N' }[side], ln = lanesOf(h, opp);
        bRamp(0, h, opp, rng() < 0.5 ? ln[0] : ln[ln.length - 1], 4, 'steps');
      } else {
        const ln = lanesOf(h, sides[0]);
        bRamp(0, h, sides[0], rng() < 0.5 ? ln[0] : ln[ln.length - 1], 4, 'steps');
        if (b.type === 'pool' && rng() < 0.6) { const l2 = lanesOf(h, sides[1]); bRamp(0, h, sides[1], rng() < 0.5 ? l2[0] : l2[l2.length - 1], 4, 'steps'); }
      }
      if (!h.ramps.length) return null;
    }
    {
      // grand bassin : plage à l'est, marches à l'ouest ; escalier de la mezzanine ; deux toboggans qui plongent vers le bassin
      const b = grand, x0 = b.x0, y0 = b.y0, h = b.hole;
      h.beach = 'E'; lanesOf(h, 'E').forEach(l => bRamp(0, h, 'E', l, 5, 'beach'));
      if (!bRamp(0, h, 'W', h.y1, 4, 'steps')) return null;
      if (!H.addRamp(m, 1, x0, y0 + 6, 0, -1, 4)) return null;
      m.ramps[m.ramps.length - 1].style = 'steps';
      for (const sx of [x0 + 4, x0 + 7]) {
        if (!H.addRamp(m, 1, sx, y0 + 5, 0, -1, 4)) return null;
        const r = m.ramps[m.ramps.length - 1]; r.style = 'slide'; r.nodraw = true;
      }
      m.slides = true;
    }
    /* --- escaliers qui sortent de l'eau : du réseau inondé (étage 0) vers les halles (étage 1) --- */
    {
      const cand = [];
      for (let y = 2; y < Hh - 2; y++) for (let x = 2; x < W - 2; x++) if (net[id(x, y)]) for (const [dx, dy] of D4) cand.push([x, y, dx, dy, rng()]);
      cand.sort((a, b) => a[4] - b[4]);
      const done = [];
      for (const [x, y, dx, dy] of cand) {
        if (done.length >= 6) break;
        if (done.some(([a, c]) => Math.abs(a - x) + Math.abs(c - y) < 14)) continue;
        // ni sous un couloir de l'étage 1 (on le couperait), ni sous une case réservée
        let bad = false;
        for (let k = -1; k <= 4 && !bad; k++) { const xx = x + dx * k, yy = y + dy * k; if (!H.inb(m, xx, yy)) { bad = true; break; } const j = id(xx, yy); if (m.zone[1][j] === FZ.CORR && m.t[1][j] === FLOOR) bad = true; if (blocks.some(b => b.reserved.has(j))) bad = true; if (k >= 0 && k < 4 && !net[j]) bad = true; }
        if (bad) continue;
        if (H.addRamp(m, 0, x, y, dx, dy, 4)) { done.push([x, y]); m.ramps[m.ramps.length - 1].style = 'steps'; }
      }
      if (done.length < 3) return null;
    }
    H.connectLayer(m, 1);

    /* --- départ : au fond du bassin vidé ; sortie : dans le réseau inondé, le plus loin possible --- */
    {
      const h = drained.hole, cx = (h.x0 + h.x1) >> 1, cy = (h.y0 + h.y1) >> 1;
      m.spawn = { f: 0, cx, cy };
      if (m.t[0][id(cx, cy)] !== FLOOR) { const c = H.nearestFloor(m, 0, cx, cy); if (!c) return null; m.spawn.cx = c.x; m.spawn.cy = c.y; }
    }
    Wd.buildNav(m);
    {
      const reach = Wd.forward(m, id(m.spawn.cx, m.spawn.cy));
      let maxD = 0; for (let i = 0; i < WH; i++) if (net[i] && reach[i] > maxD) maxD = reach[i];
      if (!maxD) return null;
      const approach = new Set(m.ramps.filter(r => r.f === 0).map(r => r.approach));
      const cands = [];
      for (let i = 0; i < WH; i++) {
        if (!net[i] || m.t[0][i] !== FLOOR || reach[i] < maxD * 0.8 || approach.has(i)) continue;
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of D4) { const j = id(x + dx, y + dy); if (m.t[0][j] === WALL && !prot[j] && m.t[1][j] !== VOID && m.rampAt[0][j] < 0) cands.push({ cx: x, cy: y, dx, dy }); }
      }
      if (!cands.length) return null;
      m.exit = cands[Math.floor(rng() * cands.length)];
    }

    /* --- mobilier : transats, chaises d'arbitre, plantes --- */
    const keepSp = (x, y) => Math.abs(x - m.spawn.cx) + Math.abs(y - m.spawn.cy) > 3;
    const nearRamp = (f, x, y) => m.ramps.some(r => !r.dead && [...(r.f === f ? r.cells.concat([r.approach]) : []), ...(r.f + 1 === f ? [r.landing] : [])].some(i => Math.max(Math.abs(i % W - x), Math.abs(((i / W) | 0) - y)) <= 1));
    const near8 = (f, x, y, fn) => { for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (H.inb(m, xx, yy) && fn(id(xx, yy), xx, yy)) return true; return false; };
    const doorish = (x, y) => near8(1, x, y, j => m.zone[1][j] === FZ.CORR && m.t[1][j] === FLOOR);
    const okCell = (f, x, y) => H.inb(m, x, y) && H.freeCell(m, f, id(x, y)) && !nearRamp(f, x, y) && !(f === 1 && doorish(x, y)) && !(f === 1 && blocks.some(b => b.reserved.has(id(x, y)))) && (f > 0 || keepSp(x, y));
    const wallDirs = (f, x, y) => D4.filter(([a, c]) => m.t[f][id(x + a, y + c)] === WALL);
    const holeDir = (x, y) => D4.find(([a, c]) => m.t[1][id(x + a, y + c)] === VOID && bas[id(x + a, y + c)]);
    for (const b of blocks) {
      const inHall = () => [ri(rng, b.hx0, b.hx1), ri(rng, b.hy0, b.hy1)];
      // transats alignés contre les murs (assez bas pour être enjambés)
      const nT = b.type === 'film' ? 2 : b.type === 'drained' ? 3 : 6;
      for (let k = 0, n = 0; k < 80 && n < nT; k++) {
        const [x, y] = inHall(); if (!okCell(1, x, y) || holeDir(x, y)) continue;
        const wd = wallDirs(1, x, y); if (wd.length !== 1) continue;
        const [a, c] = wd[0];
        if (m.zone[1][id(x + a, y + c)] === WZ.PILLAR) continue;
        if (H.addProp(m, 1, x, y, 'transat', 0.42, a ? 1.85 : 0.72, a ? 0.72 : 1.85, { nodraw: true, ox: a * 0.05, oz: c * 0.05, data: { wx: a, wz: c } })) n++;
      }
      // chaise d'arbitre au bord des bassins pleins
      if (b.hole && !b.hole.dry) for (let k = 0; k < 60; k++) {
        const [x, y] = inHall(); if (!okCell(1, x, y)) continue;
        const hd = holeDir(x, y); if (!hd || wallDirs(1, x, y).length) continue;
        if (H.addProp(m, 1, x, y, 'chaise', 2.3, 0.95, 0.95, { nodraw: true, data: { hx: hd[0], hz: hd[1] } })) break;
      }
      // plantes en pot dans les coins
      for (const [x, y] of [[b.hx0, b.hy0], [b.hx1, b.hy0], [b.hx0, b.hy1], [b.hx1, b.hy1]]) if (rng() < 0.55 && okCell(1, x, y) && !holeDir(x, y)) H.addProp(m, 1, x, y, 'plante', 1.7, 0.8, 0.8, { nodraw: true });
    }
    // sécurité : un objet qui isole une partie de la carte est retiré (contrôle sur le vrai graphe de navigation)
    for (let pass = 0; pass < 4; pass++) {
      Wd.buildNav(m);
      const reach = Wd.forward(m, id(m.spawn.cx, m.spawn.cy));
      let removed = 0;
      for (let n = 0; n < m.nav.N; n++) {
        if (!m.nav.walk[n] || reach[n] >= 0) continue;
        const f = Math.floor(n / WH), i = n - f * WH, x = i % W, y = (i / W) | 0;
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
          if (!H.inb(m, xx, yy)) continue;
          const j = id(xx, yy), pi = m.propAt[f][j]; if (pi < 0) continue;
          const p = m.props[pi]; if (p.kind !== 'chaise' && p.kind !== 'plante') continue;
          p.dead = true; m.propAt[f][j] = -1; removed++;
        }
      }
      if (!removed) break;
    }

    /* --- lumières des bassins (projecteurs immergés) --- */
    for (const h of holes) {
      if (h.dry) continue;
      const long = h.x1 - h.x0 >= h.y1 - h.y0;
      for (const t of [0.3, 0.7]) {
        const cx = long ? Math.round(h.x0 + (h.x1 - h.x0) * t) : (h.x0 + h.x1) >> 1, cy = long ? (h.y0 + h.y1) >> 1 : Math.round(h.y0 + (h.y1 - h.y0) * t);
        m.lights.push({ f: 0, cx, cy, y: 2.0, kind: 'lamp', dead: false, flicker: false, phase: rng() * 100, px: (cx + 0.5) * H.C, pz: (cy + 0.5) * H.C, pool: true });
      }
    }

    if (!H.finalize(m, rng, diff)) return null;
    // un bassin plein ne doit pas avoir perdu ses marches (la finalisation mure les culs-de-sac)
    for (const h of holes) if (!h.ramps.some(r => !r.dead)) return null;

    /* --- niveaux d'eau (après finalisation : des cases ont pu être murées) --- */
    const wl = new Float32Array(F * WH).fill(-1);
    const film = new Set(blocks.filter(b => b.type === 'film').map(b => b));
    for (let i = 0; i < WH; i++) {
      const t0 = m.t[0][i], x = i % W, y = (i / W) | 0;
      if (t0 === FLOOR || t0 === RAMP) { if (bas[i] === 1) wl[i] = WLP; else if (net[i]) wl[i] = WL0; }
      if (m.t[1][i] === FLOOR) for (const b of film) if (x >= b.hx0 && x <= b.hx1 && y >= b.hy0 && y <= b.hy1) wl[WH + i] = WLF;
    }
    m.wl = wl; m.bas = bas; m.net = net; m.holes = holes;
    m.halls = blocks.map(b => ({ type: b.type, x0: b.hx0, y0: b.hy0, x1: b.hx1, y1: b.hy1, bx: b.x0, by: b.y0 }));

    /* --- néons --- */
    const th = TX.theme('piscine');
    H.panelLights(m, rng, th);
    for (const l of m.lights) {
      if (l.kind !== 'panel') continue;
      if (l.y > 9) l.kind = 'sky';                         // grand bassin : grands caissons lumineux sous la verrière, à 12 m
      else if (l.f === 0 && net[l.cy * W + l.cx]) {        // sous-sol inondé : plus sombre, plus de néons qui grésillent
        const r = rng(); l.dead = r < 0.3; l.flicker = !l.dead && r < 0.5;
      }
    }
    return m;
  }
  Wd.gens.piscine = genPiscine;

  /* ---------------- décor ---------------- */
  let causticCv = null;
  function causticCanvas() {
    if (causticCv) return causticCv;
    const N = 256, pts = []; let s = 98765;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 20; k++) pts.push([r() * N, r() * N]);
    causticCv = P.mk(N, N, g => {
      const im = g.createImageData(N, N), d = im.data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let d1 = 1e9, d2 = 1e9;
        for (const [px, py] of pts) { let dx = Math.abs(x - px), dy = Math.abs(y - py); if (dx > N / 2) dx = N - dx; if (dy > N / 2) dy = N - dy; const dd = dx * dx + dy * dy; if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd; }
        const e = Math.sqrt(d2) - Math.sqrt(d1), v = Math.pow(Math.max(0, 1 - e / 10), 2.4) * 255, j = (y * N + x) * 4;
        d[j] = d[j + 1] = d[j + 2] = v; d[j + 3] = 255;
      }
      g.putImageData(im, 0, 0);
    });
    return causticCv;
  }
  const labelCache = {};
  function labelCanvas(text) {
    return labelCache[text] || (labelCache[text] = P.mk(256, 80, g => {
      g.clearRect(0, 0, 256, 80); g.fillStyle = '#1f4f77'; g.font = "bold 50px 'Segoe UI', Arial"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 42);
    }));
  }

  function pwDecor(m, B, inst, rng, H, group) {
    const { C, SH, FLOOR, WALL, VOID, RAMP } = H, W = m.W, Hh = m.H, WH = m.WH;
    const id = (x, y) => y * W + x;
    const bx = (Bf, x0, y0, z0, x1, y1, z1, col) => H.box(Bf, Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), col || [1, 1, 1], 0.5);
    const tAt = (f, x, y) => (x < 0 || y < 0 || x >= W || y >= Hh) ? WALL : m.t[f][id(x, y)];
    const IR = B('inox'), PL = B('plast'), GL = B('glow');

    /* --- surfaces d'eau --- */
    const WP = B('pwater'), WF = B('fwater'), WM = B('film');
    for (let f = 0; f < m.F; f++) for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = id(x, y), lv = m.wl[f * WH + i]; if (lv < 0) continue;
      const X0 = x * C, X1 = X0 + C, Z0 = y * C, Z1 = Z0 + C, Bf = f === 1 ? WM : m.bas[i] === 1 ? WP : WF;
      H.quad(Bf, [[X0, lv, Z1], [X1, lv, Z1], [X1, lv, Z0], [X0, lv, Z0]], [0, 1, 0], [[X0 / 4, Z1 / 4], [X1 / 4, Z1 / 4], [X1 / 4, Z0 / 4], [X0 / 4, Z0 / 4]], 1);
      // bassins : voile à mi-profondeur, le fond paraît plus loin et plus bleu (sauf au-dessus des marches et de la plage)
      if (f === 0 && m.bas[i] === 1 && m.t[0][i] === FLOOR) H.quad(B('pdeep'), [[X0, 1.7, Z1], [X1, 1.7, Z1], [X1, 1.7, Z0], [X0, 1.7, Z0]], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], 1);
    }

    /* --- caustiques : reflets de la surface qui ondulent au fond (deux couches qui glissent en sens inverse) --- */
    {
      const deep = H.Buf(), flood = H.Buf();
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const i = id(x, y); if (m.t[0][i] !== FLOOR || m.wl[i] < 0) continue;
        const X0 = x * C, X1 = X0 + C, Z0 = y * C, Z1 = Z0 + C, Bf = m.bas[i] === 1 ? deep : flood;
        H.quad(Bf, [[X0, 0.015, Z1], [X1, 0.015, Z1], [X1, 0.015, Z0], [X0, 0.015, Z0]], [0, 1, 0], [[X0 / 3.2, Z1 / 3.2], [X1 / 3.2, Z1 / 3.2], [X1 / 3.2, Z0 / 3.2], [X0 / 3.2, Z0 / 3.2]], 1);
      }
      const layer = (Bf, color, op, sp, rep, rot) => {
        if (!Bf.i.length) return;
        const t = new THREE.CanvasTexture(causticCanvas()); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.repeat.set(rep, rep); t.rotation = rot; t.center.set(0.5, 0.5);
        const mat = new THREE.MeshBasicMaterial({ map: t, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, vertexColors: false });
        mat.addEventListener('dispose', () => t.dispose());
        const me = new THREE.Mesh(H.geo(Bf), mat); me.matrixAutoUpdate = false; me.renderOrder = -1;     // avant l'eau : les reflets restent sous la surface
        me.onBeforeRender = () => { const s = performance.now() / 1000; t.offset.set(s * sp[0], s * sp[1]); };
        group.add(me);
      };
      layer(deep, 0xc4fbff, 0.38, [0.021, 0.013], 1, 0); layer(deep, 0x9eefff, 0.3, [-0.016, 0.019], 0.77, 0.7);
      layer(flood, 0xa9e6cf, 0.16, [0.012, 0.008], 1, 0.3); layer(flood, 0x8fd6bf, 0.12, [-0.009, 0.011], 0.8, 1.1);
    }

    /* --- plages (pente lisse) et toboggans (goulotte) --- */
    let slideN = 0;
    for (const r of m.ramps) {
      if (r.dead || !r.nodraw) continue;
      const len = r.L * C, base = r.f * SH;
      if (r.style === 'beach') {
        const BF = B('f2'), nl = Math.hypot(r.dx * 0.45, 1, r.dy * 0.45), n = [-r.dx * 0.45 / nl, 1 / nl, -r.dy * 0.45 / nl];
        for (const i of r.cells) {
          const x = i % W, y = (i / W) | 0, X0 = x * C, X1 = X0 + C, Z0 = y * C, Z1 = Z0 + C, h = (a, b) => H.rampH(r, a, b);
          H.quadN(BF, [[X0, h(X0, Z1), Z1], [X1, h(X1, Z1), Z1], [X1, h(X1, Z0), Z0], [X0, h(X0, Z0), Z0]], n, [[X0 / 2, Z1 / 2], [X1 / 2, Z1 / 2], [X1 / 2, Z0 / 2], [X0 / 2, Z0 / 2]], 1);
          // flanc visible si la voisine latérale n'est ni un mur ni une autre voie de la plage
          for (const sd of [-1, 1]) {
            const nx = r.dx ? x : x + sd, ny = r.dx ? y + sd : y, t = tAt(0, nx, ny);
            if (t === WALL || (t === RAMP && m.ramps[m.rampAt[0][id(nx, ny)]].style === 'beach')) continue;
            const l = sd < 0 ? (r.dx ? Z0 : X0) : (r.dx ? Z1 : X1), a = r.dx ? [X0, l] : [l, Z0], b2 = r.dx ? [X1, l] : [l, Z1];
            H.quadN(B('rs'), [[a[0], 0, a[1]], [b2[0], 0, b2[1]], [b2[0], h(b2[0], b2[1]), b2[1]], [a[0], h(a[0], a[1]), a[1]]], r.dx ? [0, 0, sd] : [sd, 0, 0], [[0, 0], [0.5, 0], [0.5, 1], [0, 1]], 0.9);
          }
        }
        // bande bleue au début de la pente (repère de profondeur)
        const P2 = (s, l, yy) => r.dx ? [r.sx + r.dx * s, yy, l] : [l, yy, r.sz + r.dy * s];
        const c0 = r.cells[0], lx = c0 % W, ly = (c0 / W) | 0, l0 = r.dx ? ly * C : lx * C, l1 = l0 + C;
        for (const s of [0.6 * len]) { const yy = base + SH * s / len + 0.012; H.quadN(B('paint'), [P2(s - 0.15, l0, yy - 0.04), P2(s - 0.15, l1, yy - 0.04), P2(s + 0.15, l1, yy + 0.04), P2(s + 0.15, l0, yy + 0.04)], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.15, 0.35, 0.6]); }
      } else if (r.style === 'slide') {
        const c0 = r.cells[0], lx0 = (c0 % W + 0.5) * C, lz0 = (((c0 / W) | 0) + 0.5) * C;
        const P3 = (s, l, yy) => r.dx ? [r.sx + r.dx * s, yy, lz0 + l] : [lx0 + l, yy, r.sz + r.dy * s];
        const hs = s => base + SH * Math.max(0, Math.min(1, s / len));
        const col = slideN++ % 2 ? [0.08, 0.38, 0.95] : [1, 0.62, 0.04];
        const Bf = B('slide'), NA = 10, samples = [];
        for (let s = -1.1; s <= len + 0.25; s += 0.4) samples.push(s);
        const o = Bf.p.length / 3;
        for (const s of samples) for (let j = 0; j <= NA; j++) {
          const a = j / NA * Math.PI, l = -Math.cos(a) * 0.82, up = (1 - Math.sin(a)) * 0.55 + 0.03;
          const p = P3(s, l, hs(s) + up), nl = Math.hypot(Math.cos(a) / 0.82, Math.sin(a) / 0.55), nlat = Math.cos(a) / 0.82 / nl, nup = Math.sin(a) / 0.55 / nl;
          Bf.p.push(p[0], p[1], p[2]); Bf.n.push(r.dx ? 0 : nlat, nup, r.dx ? nlat : 0); Bf.u.push(j / NA, s / 2); Bf.c.push(col[0], col[1], col[2]);
        }
        for (let k = 0; k + 1 < samples.length; k++) for (let j = 0; j < NA; j++) { const a = o + k * (NA + 1) + j, b2 = a + NA + 1; Bf.i.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
        // rebords en tube, piliers inox, garde-corps du départ
        for (const l of [-0.84, 0.84]) H.tube(IR, samples.map(s => P3(s, l, hs(s) + 0.6)), samples.map(() => 0.045), 6, [1, 1, 1], 1);
        for (const s of [len * 0.3, len * 0.62, len * 0.92]) for (const l of [-0.55, 0.55]) { const p = P3(s, l, 0); H.cyl(IR, p[0], p[2], base, hs(s) + 0.02, 0.06, 0.06, 8, [1, 1, 1], false); }
        for (const s of [len * 0.3, len * 0.62, len * 0.92]) { const a = P3(s, -0.55, hs(s) - 0.12), b2 = P3(s, 0.55, hs(s) - 0.05); bx(IR, a[0], a[1], a[2] - (r.dx ? 0 : 0.04), b2[0] + (r.dx ? 0.06 : 0), b2[1], b2[2] + (r.dx ? 0 : 0.04)); }
      }
    }

    /* --- bassins : margelle, goulotte, lignes d'eau, échelles, projecteurs, marques de profondeur --- */
    const PA = B('paint'), CP = B('coping'), GR = B('grate');
    const decals = [];
    for (const h of m.holes) {
      const X0 = h.x0 * C, X1 = (h.x1 + 1) * C, Z0 = h.y0 * C, Z1 = (h.y1 + 1) * C;
      const landingOf = new Set(h.ramps.filter(r => !r.dead).map(r => r.landing));
      // margelle + goulotte de débordement (sauf au débouché des marches et de la plage)
      for (let y = h.y0 - 1; y <= h.y1 + 1; y++) for (let x = h.x0 - 1; x <= h.x1 + 1; x++) {
        const i = id(x, y); if (m.t[1][i] !== FLOOR) continue;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy; if (nx < h.x0 || nx > h.x1 || ny < h.y0 || ny > h.y1) continue;
          if (landingOf.has(i)) continue;
          const ex = dx ? (dx > 0 ? (x + 1) * C : x * C) : null, ez = dy ? (dy > 0 ? (y + 1) * C : y * C) : null;
          if (dx) { bx(CP, ex - dx * 0.32, 3.97, y * C, ex + dx * 0.07, 4.05, (y + 1) * C); H.quad(GR, dx > 0 ? [[ex - 0.6, 4.004, (y + 1) * C], [ex - 0.34, 4.004, (y + 1) * C], [ex - 0.34, 4.004, y * C], [ex - 0.6, 4.004, y * C]] : [[ex + 0.34, 4.004, (y + 1) * C], [ex + 0.6, 4.004, (y + 1) * C], [ex + 0.6, 4.004, y * C], [ex + 0.34, 4.004, y * C]], [0, 1, 0], [[0, 0], [0.13, 0], [0.13, 1], [0, 1]], 1); }
          else { bx(CP, x * C, 3.97, ez - dy * 0.32, (x + 1) * C, 4.05, ez + dy * 0.07); H.quad(GR, dy > 0 ? [[x * C, 4.004, ez - 0.34], [(x + 1) * C, 4.004, ez - 0.34], [(x + 1) * C, 4.004, ez - 0.6], [x * C, 4.004, ez - 0.6]] : [[x * C, 4.004, ez + 0.6], [(x + 1) * C, 4.004, ez + 0.6], [(x + 1) * C, 4.004, ez + 0.34], [x * C, 4.004, ez + 0.34]], [0, 1, 0], [[0, 0], [1, 0], [1, 0.13], [0, 0.13]], 1); }
        }
      }
      // projecteurs encastrés dans les parois (éteints dans le bassin vidé)
      const lc = h.dry ? [0.12, 0.16, 0.17] : [0.8, 0.97, 1];
      for (let x = h.x0; x <= h.x1; x += 2) { const cx = (x + 0.5) * C; bx(GL, cx - 0.2, 2.1, Z0, cx + 0.2, 2.5, Z0 + 0.03, lc); bx(GL, cx - 0.2, 2.1, Z1 - 0.03, cx + 0.2, 2.5, Z1, lc); }
      for (let y = h.y0; y <= h.y1; y += 2) { const cz = (y + 0.5) * C; bx(GL, X0, 2.1, cz - 0.2, X0 + 0.03, 2.5, cz + 0.2, lc); bx(GL, X1 - 0.03, 2.1, cz - 0.2, X1, 2.5, cz + 0.2, lc); }
      // lignes d'eau au fond (dans le sens de la longueur), seulement sur le fond plat
      const long = h.x1 - h.x0 >= h.y1 - h.y0, wid = long ? Z1 - Z0 : X1 - X0, nL = Math.max(1, Math.floor((wid - 1.5) / 2.5));
      const lcol = h.dry ? [0.25, 0.33, 0.4] : [0.1, 0.22, 0.44];
      for (let k = 1; k <= nL; k++) {
        const lat = (long ? Z0 : X0) + wid * k / (nL + 1);
        for (let a = long ? h.x0 : h.y0; a <= (long ? h.x1 : h.y1); a++) {
          const cx = long ? a : Math.floor(lat / C), cy = long ? Math.floor(lat / C) : a, i = id(cx, cy);
          if (m.t[0][i] !== FLOOR || !m.bas[i]) continue;
          const a0 = a * C + (a === (long ? h.x0 : h.y0) ? 1.2 : 0), a1 = (a + 1) * C - (a === (long ? h.x1 : h.y1) ? 1.2 : 0), y = 0.01;
          if (long) H.quad(PA, [[a0, y, lat + 0.13], [a1, y, lat + 0.13], [a1, y, lat - 0.13], [a0, y, lat - 0.13]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], lcol);
          else H.quad(PA, [[lat - 0.13, y, a1], [lat + 0.13, y, a1], [lat + 0.13, y, a0], [lat - 0.13, y, a0]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], lcol);
        }
      }
      // grille de vidange au centre
      { const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2; H.quad(GR, [[cx - 0.45, 0.012, cz + 0.45], [cx + 0.45, 0.012, cz + 0.45], [cx + 0.45, 0.012, cz - 0.45], [cx - 0.45, 0.012, cz - 0.45]], [0, 1, 0], [[0, 0], [0.4, 0], [0.4, 0.4], [0, 0.4]], 1); }
      // échelles inox (sur les grands côtés, loin des marches)
      const edges = [];
      for (let x = h.x0 + 1; x < h.x1; x++) { edges.push([x, h.y0 - 1, 0, 1]); edges.push([x, h.y1 + 1, 0, -1]); }
      for (let y = h.y0 + 1; y < h.y1; y++) { edges.push([h.x0 - 1, y, 1, 0]); edges.push([h.x1 + 1, y, -1, 0]); }
      BR.shuffle(edges, rng);
      let nLad = 0; const lad = [];
      for (const [x, y, dx, dy] of edges) {
        if (nLad >= (h.dry ? 1 : 2)) break;
        const i = id(x, y); if (m.t[1][i] !== FLOOR || m.propAt[1][i] >= 0 || landingOf.has(i)) continue;
        const hc = id(x + dx, y + dy); if (m.t[0][hc] !== FLOOR) continue;            // pas au-dessus d'une marche ou de la plage
        if (lad.some(([a, c]) => Math.abs(a - x) + Math.abs(c - y) < 4)) continue;
        lad.push([x, y]); nLad++;
        const ex = dx ? (dx > 0 ? (x + 1) * C : x * C) : (x + 0.5) * C, ez = dy ? (dy > 0 ? (y + 1) * C : y * C) : (y + 0.5) * C;
        const pt = (back, l, yy) => [ex - dx * back + (dy ? l : 0), yy, ez - dy * back + (dx ? l : 0)];
        for (const l of [-0.28, 0.28]) H.tube(IR, [pt(0.5, l, 4.0), pt(0.42, l, 4.75), pt(0.2, l, 4.95), pt(-0.05, l, 4.8), pt(-0.12, l, 4.3), pt(-0.12, l, 1.9)], [0.025, 0.025, 0.025, 0.025, 0.025, 0.025], 6, [1, 1, 1], 1);
        for (const yy of [3.55, 3.05, 2.55, 2.05]) { const a = pt(-0.06, -0.28, yy), b2 = pt(-0.2, 0.28, yy + 0.04); bx(IR, a[0], a[1], a[2], b2[0], b2[1], b2[2]); }
      }
      // marques de profondeur peintes sur la plage du bassin (côté plage : peu profond)
      if (!h.dry) {
        const mid = [[(h.x0 + h.x1) >> 1, h.y0 - 1, 0, 1, 'N'], [(h.x0 + h.x1) >> 1, h.y1 + 1, 0, -1, 'S'], [h.x0 - 1, (h.y0 + h.y1) >> 1, 1, 0, 'W'], [h.x1 + 1, (h.y0 + h.y1) >> 1, -1, 0, 'E']];
        for (const [x, y, dx, dy, sd] of mid) {
          const i = id(x, y); if (m.t[1][i] !== FLOOR || m.propAt[1][i] >= 0) continue;
          const ex = dx ? (dx > 0 ? (x + 1) * C : x * C) : (x + 0.5) * C, ez = dy ? (dy > 0 ? (y + 1) * C : y * C) : (y + 0.5) * C;
          decals.push({ x: ex - dx * 0.95, z: ez - dy * 0.95, dx, dy, text: h.beach === sd ? '0,20 m' : '3,80 m' });
        }
      }
    }
    for (const d of decals) {
      const t = new THREE.CanvasTexture(labelCanvas(d.text)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
      mat.addEventListener('dispose', () => t.dispose());
      const me = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.36), mat);
      me.rotation.order = 'YXZ'; me.rotation.set(-Math.PI / 2, Math.atan2(-d.dx, -d.dy), 0); me.position.set(d.x, 4.007, d.z); group.add(me);
    }

    /* --- garde-corps : mezzanine et trémies d'escalier (étage 1) --- */
    const GLR = B('glassR');
    const rail = (f, x, y, dx, dy) => {
      const Y = f * SH, X0 = x * C, Z0 = y * C;
      const ex0 = dx === 1 ? X0 + C - 0.06 : X0, ex1 = dx === -1 ? X0 + 0.06 : X0 + C, ez0 = dy === 1 ? Z0 + C - 0.06 : Z0, ez1 = dy === -1 ? Z0 + 0.06 : Z0 + C;
      bx(IR, ex0, Y + 1.0, ez0, ex1, Y + 1.06, ez1); bx(IR, ex0, Y, ez0, ex0 + 0.06, Y + 1.06, ez0 + 0.06);
      const gx0 = dx ? ex0 + 0.02 : ex0, gx1 = dx ? ex1 - 0.02 : ex1, gz0 = dy ? ez0 + 0.02 : ez0, gz1 = dy ? ez1 - 0.02 : ez1;
      bx(GLR, gx0, Y + 0.08, gz0, gx1, Y + 0.98, gz1);
    };
    for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = id(x, y);
      if (m.t[1][i] === FLOOR) for (const [dx, dy] of D4) {
        const j = id(x + dx, y + dy); if (m.t[1][j] !== VOID || m.t[0][j] !== RAMP || m.bas[j]) continue;
        const r = m.ramps[m.rampAt[0][j]]; if (r && r.landing === i) continue;
        rail(1, x, y, dx, dy);
      }
      if (m.t[2][i] === FLOOR) for (const [dx, dy] of D4) {
        const j = id(x + dx, y + dy); if (m.t[2][j] !== VOID) continue;
        const r = m.rampAt[1][j] >= 0 ? m.ramps[m.rampAt[1][j]] : null; if (r && r.landing === i) continue;
        rail(2, x, y, dx, dy);
      }
    }

    /* --- grand bassin : verrières dans les murs hauts (lumière blanche, aveuglante) --- */
    const WIN = B('window');
    for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = id(x, y); if (m.t[2][i] === WALL || m.t[2][i] === RAMP) continue;
      if (m.t[2][i] === VOID && m.t[1][i] === WALL) continue;
      if ((x + y) % 2) continue;
      for (const [dx, dy] of D4) {
        if (tAt(2, x + dx, y + dy) !== WALL) continue;
        const X0 = x * C, Z0 = y * C, y0 = 9.0, y1 = 11.5;
        if (dx === 1) H.quadN(WIN, [[X0 + C - 0.02, y0, Z0 + 0.25], [X0 + C - 0.02, y0, Z0 + C - 0.25], [X0 + C - 0.02, y1, Z0 + C - 0.25], [X0 + C - 0.02, y1, Z0 + 0.25]], [-1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
        else if (dx === -1) H.quadN(WIN, [[X0 + 0.02, y0, Z0 + 0.25], [X0 + 0.02, y0, Z0 + C - 0.25], [X0 + 0.02, y1, Z0 + C - 0.25], [X0 + 0.02, y1, Z0 + 0.25]], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
        else if (dy === 1) H.quadN(WIN, [[X0 + 0.25, y0, Z0 + C - 0.02], [X0 + C - 0.25, y0, Z0 + C - 0.02], [X0 + C - 0.25, y1, Z0 + C - 0.02], [X0 + 0.25, y1, Z0 + C - 0.02]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
        else H.quadN(WIN, [[X0 + 0.25, y0, Z0 + 0.02], [X0 + C - 0.25, y0, Z0 + 0.02], [X0 + C - 0.25, y1, Z0 + 0.02], [X0 + 0.25, y1, Z0 + 0.02]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
      }
    }

    /* --- sous-sol inondé : tuyaux au plafond des couloirs, bouées qui flottent --- */
    const PI = B('pipe');
    for (const L of [2, 19, 37, 55]) {
      const a = 2 * C, b2 = (W - 3) * C, p = (L + 1) * C;
      H.tube(PI, [[p - 0.55, 3.3, a], [p - 0.55, 3.3, b2]], [0.1, 0.1], 8, [1, 1, 1], 1);
      H.tube(PI, [[a, 3.42, p + 0.6], [b2, 3.42, p + 0.6]], [0.07, 0.07], 8, [0.8, 0.85, 0.85], 1);
    }
    const BU = B('buoy');
    const ring = (cx, y, cz, col) => { const pts = [], rad = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 2; pts.push([cx + Math.cos(a) * 0.33, y, cz + Math.sin(a) * 0.33]); rad.push(0.085); } H.tube(BU, pts, rad, 6, col, 1); };
    for (let k = 0, n = 0; k < 400 && n < 8; k++) {
      const x = 2 + Math.floor(rng() * (W - 4)), y = 2 + Math.floor(rng() * (Hh - 4)), i = id(x, y);
      if (m.t[0][i] !== FLOOR || m.wl[i] < 0) continue;
      ring((x + 0.3 + rng() * 0.4) * C, m.wl[i] + 0.02, (y + 0.3 + rng() * 0.4) * C, rng() < 0.6 ? [0.92, 0.18, 0.12] : [0.95, 0.95, 0.92]); n++;
    }

    /* --- panneaux muraux (étage 1) --- */
    const TXT = { grand: 'GRAND BASSIN', pool: 'BASSIN PROFOND — 3,80 m', beach: 'BASSIN D\'APPRENTISSAGE', film: 'DÉFENSE DE COURIR', hall: 'DOUCHE OBLIGATOIRE', drained: 'BASSIN FERMÉ' };
    const EXTRA = ['NIVEAU 37', 'BAIGNADE SURVEILLÉE', 'NE PAS PLONGER', 'PIEDS NUS UNIQUEMENT'];
    for (const hl of m.halls) {
      const texts = [TXT[hl.type], EXTRA[Math.floor(rng() * EXTRA.length)]];
      for (const text of texts) for (let tr = 0; tr < 12; tr++) {
        const side = Math.floor(rng() * 4), Y = SH + 2.5;
        let x, y, wx, wy;
        if (side === 0) { x = ri2(hl.x0 + 1, hl.x1 - 1); y = hl.y0; wx = 0; wy = -1; } else if (side === 1) { x = ri2(hl.x0 + 1, hl.x1 - 1); y = hl.y1; wx = 0; wy = 1; }
        else if (side === 2) { x = hl.x0; y = ri2(hl.y0 + 1, hl.y1 - 1); wx = -1; wy = 0; } else { x = hl.x1; y = ri2(hl.y0 + 1, hl.y1 - 1); wx = 1; wy = 0; }
        if (tAt(1, x + wx, y + wy) !== WALL || m.t[1][id(x, y)] !== FLOOR || (m.t[2][id(x, y)] !== WALL && hl.type !== 'grand')) continue;
        if (hl.type === 'grand' && wy === -1) continue;          // pas sous la mezzanine
        const me = H.signMesh(BR.Tex.sign(text, '#eef6f8', '#1d5f86', 512, 96), 2.4, 0.45, { lit: true });
        me.position.set((x + 0.5) * C + wx * (C / 2 - 0.03), Y, (y + 0.5) * C + wy * (C / 2 - 0.03));
        me.rotation.y = Math.atan2(-wx, -wy); group.add(me);
        break;
      }
    }
    function ri2(a, b) { return a + Math.floor(rng() * (b - a + 1)); }

    /* --- objets --- */
    for (const p of m.props) {
      const b = p.base;
      switch (p.kind) {
        case 'transat': {
          // repère local : u le long du transat (vers le mur = dossier), v en travers
          const d = p.data, ax = d.wx, az = d.wz;
          const Lb = (u0, y0, v0, u1, y1, v1, Bf, col) => { const x0 = p.x + (ax ? ax * u0 : v0), x1 = p.x + (ax ? ax * u1 : v1), z0 = p.z + (az ? az * u0 : v0), z1 = p.z + (az ? az * u1 : v1); bx(Bf || PL, x0, b + y0, z0, x1, b + y1, z1, col); };
          for (const u of [-0.82, 0.55]) for (const v of [-0.3, 0.27]) Lb(u, 0, v, u + 0.05, 0.3, v + 0.05);
          for (let k = 0; k < 6; k++) Lb(-0.9 + k * 0.24, 0.3, -0.33, -0.9 + k * 0.24 + 0.2, 0.36, 0.33);
          for (let k = 0; k < 4; k++) Lb(0.55 + k * 0.1, 0.36 + k * 0.14, -0.33, 0.65 + k * 0.1, 0.42 + k * 0.14 + 0.06, 0.33);
          if (rng() < 0.4) Lb(-0.6, 0.36, -0.28, 0.1, 0.42, 0.28, PL, rng() < 0.5 ? [0.35, 0.65, 0.9] : [0.95, 0.85, 0.4]);   // serviette oubliée
          break;
        }
        case 'chaise': {
          const d = p.data, x = p.x, z = p.z;
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) H.tube(IR, [[x + sx * 0.42, b, z + sz * 0.42], [x + sx * 0.3, b + 1.6, z + sz * 0.3]], [0.035, 0.035], 6, [1, 1, 1], 1);
          for (const yy of [0.45, 0.9, 1.3]) { bx(IR, x - 0.4, b + yy, z - 0.4 * (1 - yy / 3) - (d.hz ? 0 : 0), x + 0.4, b + yy + 0.04, z - 0.36); }
          bx(PL, x - 0.34, b + 1.6, z - 0.34, x + 0.34, b + 1.68, z + 0.34, [0.95, 0.95, 0.95]);
          const bk = [-d.hx, -d.hz];
          bx(PL, x + bk[0] * 0.34 - (bk[1] ? 0.34 : 0.02), b + 1.68, z + bk[1] * 0.34 - (bk[0] ? 0.34 : 0.02), x + bk[0] * 0.34 + (bk[1] ? 0.34 : 0.02) + (bk[0] ? 0 : 0), b + 2.25, z + bk[1] * 0.34 + (bk[0] ? 0.34 : 0.02), [0.95, 0.95, 0.95]);
          // bouée accrochée à la chaise
          ring(x + d.hx * 0.45, b + 1.2, z + d.hz * 0.45, [0.92, 0.18, 0.12]);
          break;
        }
        case 'plante': {
          H.cyl(B('pot'), p.x, p.z, b, b + 0.55, 0.26, 0.34, 12, [1, 1, 1]);
          bx(B('p'), p.x - 0.24, b + 0.5, p.z - 0.24, p.x + 0.24, b + 0.54, p.z + 0.24, [0.2, 0.15, 0.1]);
          H.treeMesh(B, p.x, b + 0.52, p.z, rng, { kind: 'shrub', scale: 0.85 });
          break;
        }
      }
    }
  }
  Wd.decor.piscine = pwDecor;
})();

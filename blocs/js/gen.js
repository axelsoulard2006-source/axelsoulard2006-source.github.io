/* ===== gen.js : génération pure du terrain (Surface et Braises) — utilisée par le Worker et, en secours, par le thread principal
   Surface : climat par bruits lents (continentalité, température, humidité, relief) → océans, plages, plaines, forêts,
   déserts, montagnes enneigées ; transitions douces (les poids de biome sont continus, la hauteur aussi).
   Sous-sol : galeries « spaghetti » (intersection de deux surfaces de bruit 3D), grandes cavernes en profondeur,
   lacs de lave (y ≤ 10), filons de minerais et poches de gravier. ===== */
(function () {
  const VX = self.VX, B = VX.B;
  const CS = 16, H = 64, SEA = 24, LAVA_LV = 13, LAVA_LAKE = 10;
  VX.CS = CS; VX.H = H; VX.SEA = SEA; VX.LAVA_LV = LAVA_LV;
  const idx = (x, y, z) => x + z * CS + y * CS * CS;
  // transition douce de 0 (v ≤ a) à 1 (v ≥ b) ; marche aussi avec a > b (transition inversée)
  const smooth = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const M = 4, TM = 3, RS = CS + 2 * M;   // marge autour du chunk (pentes) ; TM : marge des arbres qui débordent
  // types de surface d'une colonne
  const S_GRASS = 0, S_SAND = 1, S_DESERT = 2, S_ROCK = 3, S_SNOW = 4, S_SNOWROCK = 5, S_SEA = 6;
  /* structures rares : une chance par cellule de la grille (taille « cell »), position tirée dans la cellule.
     reach = demi-largeur maximale (elles débordent sur les chunks voisins, chacun dessine sa part) */
  const STRUCTS = {
    ruine: { cell: 150, chance: 0.6, reach: 6, salt: 301 },     // ruines de pierre moussue avec un coffre au trésor
    puits: { cell: 104, chance: 0.65, reach: 3, salt: 302 },    // puits de grès dans le désert
    geant: { cell: 52, chance: 0.5, reach: 7, salt: 303 },      // arbres géants des forêts
    portail: { cell: 176, chance: 0.6, reach: 7, salt: 304 },   // ancien portail en ruine (vers les Braises)
  };
  // rotation d'un décalage (dx, dz) d'un quart de tour r
  const rot = (dx, dz, r) => r === 1 ? [-dz, dx] : r === 2 ? [-dx, -dz] : r === 3 ? [dz, -dx] : [dx, dz];
  class Gen {
    constructor(seed, dim) {
      this.seed = seed | 0; this.dim = dim; this.n = VX.makeNoise(this.seed + (dim === 'braises' ? 7777 : 0));
      // colonnes de la zone du chunk en cours (réutilisées d'un chunk à l'autre)
      this.cH = new Int16Array(RS * RS); this.cS = new Uint8Array(RS * RS); this.cF = new Float32Array(RS * RS);
      this.cD = new Float32Array(RS * RS); this.cT = new Float32Array(RS * RS); this.cM = new Float32Array(RS * RS);
      this.sCache = new Map();   // structures déjà évaluées (cellule -> structure ou null)
    }
    generate(cx, cz) { const c = { cx, cz, data: new Uint8Array(CS * CS * H) }; if (this.dim === 'braises') this.genBraises(c); else this.genSurface(c); return c.data; }

    /* ---------- climat et relief d'une colonne ---------- */
    climate(x, z, o) {
      const n = this.n, dist = Math.sqrt(x * x + z * z);
      const C = n.fbm2(x / 420 + 11.3, z / 420 - 7.7, 3) + 0.24 * Math.max(0, 1 - dist / 320);   // continents (le départ est sur la terre ferme)
      const T = n.fbm2(x / 380 - 50.1, z / 380 + 90.7, 2), Hm = n.fbm2(x / 300 + 300.3, z / 300 + 300.9, 2), Mo = n.fbm2(x / 260 + 200.5, z / 260 - 120.2, 3);
      const land = smooth(-0.2, -0.04, C);
      const dw = smooth(0.05, 0.19, T) * smooth(0.06, -0.08, Hm);                 // désert : chaud et sec
      const mw = smooth(0.08, 0.28, Mo) * land * (1 - dw * 0.8);                    // montagnes
      const hills = n.fbm2(x / 110, z / 110, 4) * 11 + n.fbm2(x / 28 + 100, z / 28, 2) * 3;
      const dn = n.n2(x / 24 + 9.5, z / 15 - 4.5) * 0.5 + 0.5, dune = dn * dn * 7;   // dunes allongées
      const landH = SEA + 4 + hills * (1 - 0.75 * dw) + dune * dw;
      let ridge = 1 - Math.abs(n.fbm2(x / 90 + 500, z / 90 - 40, 3) * 1.8); ridge = ridge < 0 ? 0 : ridge;
      const mount = mw * (5 + ridge * ridge * 30 + n.fbm2(x / 18, z / 18, 2) * 6);   // crêtes escarpées
      const oceanH = SEA - 6 - 8 * smooth(-0.22, -0.42, C) + n.fbm2(x / 50 + 70, z / 50, 2) * 6;   // plus profond au large
      const h = oceanH + (landH + mount - oceanH) * land;
      o.h = Math.max(3, Math.min(H - 5, Math.floor(h)));
      o.dw = dw; o.mw = mw; o.T = T;
      o.fw = smooth(-0.02, 0.18, Hm) * (1 - dw) * (1 - mw * 0.7);                   // forêt : humide, ni désert ni montagne
      return o;
    }
    heightAt(x, z) { return this.climate(x, z, {}).h; }
    // nom du biome (utile aux autres modules : créatures, musique…)
    biomeAt(x, z) {
      const o = this.climate(x, z, {});
      if (o.h < SEA - 1) return 'ocean'; if (o.h <= SEA + 1 && o.mw < 0.4) return 'plage';
      if (o.dw > 0.5) return 'desert'; if (o.mw > 0.5 || o.h > 46) return 'montagne'; return o.fw > 0.5 ? 'foret' : 'plaine';
    }
    // la colonne est-elle creusée à cette hauteur ? (fonction pure : sert aussi pour les arbres des chunks voisins)
    carved(x, y, z, h) {
      if (y < 1 || y > h) return false;
      if (h <= SEA + 1 && y > h - 5) return false;   // pas de trou sous la mer ni sous les plages
      const n = this.n, a = n.n3(x / 36, y / 22, z / 36), b = n.n3(x / 36 + 71.3, y / 22 + 13.1, z / 36 - 37.7);
      if (a * a + b * b < (h - y < 4 ? 0.006 : 0.0105)) return true;     // galeries connectées (entrées plus étroites près de la surface)
      if (y < h - 8 && n.n3(x / 58 + 17.1, y / 30 - 5.3, z / 58 + 3.7) > 0.36 + Math.max(0, y - 14) * 0.012) return true;   // cavernes
      return false;
    }
    floorAt(x, z) { return Math.floor(16 + this.n.fbm2(x / 50, z / 50, 3) * 12); }
    ceilAt(x, z) { return Math.floor(52 + this.n.fbm2(x / 40 + 300, z / 40, 2) * 8); }

    /* ---------- structures (fonctions pures de la graine : le Worker et le thread principal trouvent les mêmes) ---------- */
    structAt(kind, gx, gz) {
      const key = kind + gx + ',' + gz; if (this.sCache.has(key)) return this.sCache.get(key);
      const T = STRUCTS[kind], S = this.seed, hs = VX.hash; let st = null;
      if (this.dim === 'surface' && hs(gx, T.salt, gz, S) < T.chance) {
        const m = T.reach + 2, x = gx * T.cell + m + Math.floor(hs(gx, T.salt + 1, gz, S) * (T.cell - 2 * m)), z = gz * T.cell + m + Math.floor(hs(gx, T.salt + 2, gz, S) * (T.cell - 2 * m));
        const o = this.climate(x, z, {}), y = o.h, r = T.reach - 1;
        let flat = 0; for (const [ax, az] of [[r, r], [-r, r], [r, -r], [-r, -r]]) flat = Math.max(flat, Math.abs(this.heightAt(x + ax, z + az) - y));
        let ok = false;
        if (kind === 'ruine') ok = o.dw < 0.35 && o.mw < 0.45 && y > SEA + 2 && y < 46 && flat <= 3;
        else if (kind === 'puits') ok = o.dw > 0.6 && o.mw < 0.3 && y > SEA + 2 && flat <= 3;
        else if (kind === 'geant') ok = o.fw > 0.5 && o.dw < 0.2 && o.mw < 0.35 && y > SEA + 2 && y <= 44 && flat <= 4;
        else if (kind === 'portail') ok = y > SEA + 1 && y < 50 && o.mw < 0.6 && flat <= 3;
        if (ok && !this.carved(x, y, z, y) && !this.carved(x, y - 1, z, y)) st = { kind, x, z, y, rot: Math.floor(hs(gx, T.salt + 3, gz, S) * 4), r: hs(gx, T.salt + 4, gz, S) };
      }
      if (this.sCache.size > 6000) this.sCache.clear();
      this.sCache.set(key, st); return st;
    }
    // structures dont l'emprise touche le rectangle [x0..x1] × [z0..z1]
    structuresIn(x0, z0, x1, z1, only) {
      const out = [];
      for (const kind in STRUCTS) {
        if (only && kind !== only) continue;
        const T = STRUCTS[kind], R = T.reach;
        for (let gz = Math.floor((z0 - R) / T.cell); gz <= Math.floor((z1 + R) / T.cell); gz++) for (let gx = Math.floor((x0 - R) / T.cell); gx <= Math.floor((x1 + R) / T.cell); gx++) {
          const st = this.structAt(kind, gx, gz); if (st && st.x + R >= x0 && st.x - R <= x1 && st.z + R >= z0 && st.z - R <= z1) out.push(st);
        }
      }
      return out;
    }
    // la plus proche d'un type donné (commande /localiser, tests)
    nearestStructure(x, z, maxD, kind) {
      const T = STRUCTS[kind]; if (!T) return null; let best = null, bd = Infinity;
      for (let gz = Math.floor((z - maxD) / T.cell); gz <= Math.floor((z + maxD) / T.cell); gz++) for (let gx = Math.floor((x - maxD) / T.cell); gx <= Math.floor((x + maxD) / T.cell); gx++) {
        const st = this.structAt(kind, gx, gz); if (!st) continue; const d = Math.hypot(st.x - x, st.z - z); if (d < bd && d <= maxD) { bd = d; best = st; }
      }
      return best;
    }
    // emplacement du coffre d'une structure (ou null)
    chestPos(st, hAt) {
      if (st.kind === 'ruine') { const [a, b] = rot(2, 2, st.rot); return [st.x + a, st.y + 1, st.z + b]; }
      if (st.kind === 'portail') { const ax = st.rot & 1, cx = st.x + (ax ? 2 : 3), cz = st.z + (ax ? 3 : 2); return [cx, (hAt ? hAt(cx, cz) : this.heightAt(cx, cz)) + 1, cz]; }
      return null;
    }
    // type de trésor du coffre généré à cette position (ruine / portail) : utilisé par survie.js à l'ouverture
    chestKindAt(x, y, z) {
      for (const st of this.structuresIn(x, z, x, z)) { const p = this.chestPos(st); if (p && p[0] === x && p[1] === y && p[2] === z) return st.kind; }
      return null;
    }
    // dessine une structure ; put(x, y, z, id, mode) en coordonnées du monde — mode 0 : seulement dans l'air (ou une plante), 1 : écrase tout
    buildStruct(st, put, hAt) {
      const Bk = B, S = this.seed, X = st.x, Z = st.z, Y = st.y, hs = (a, b, c) => VX.hash(X * 3 + a, b, Z * 3 + c, S + 77);
      if (st.kind === 'ruine') {
        const at = (dx, dz) => { const [a, b] = rot(dx, dz, st.rot); return [X + a, Z + b]; };
        const mossy = r => r < 0.45 ? Bk.BRIQUES_M : r < 0.78 ? Bk.P_MOUSSUE : r < 0.92 ? Bk.GALETS : Bk.BRIQUES;
        for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
          const [x, z] = at(dx, dz), h0 = hAt(x, z), edge = Math.abs(dx) === 4 || Math.abs(dz) === 4, corner = Math.abs(dx) === 4 && Math.abs(dz) === 4;
          for (let y = h0 + 1; y < Y; y++) put(x, y, z, Bk.GALETS, 1);   // fondations
          const r = hs(dx, 1, dz); put(x, Y, z, r < 0.4 ? Bk.BRIQUES_M : r < 0.72 ? Bk.P_MOUSSUE : r < 0.9 ? Bk.GALETS : Bk.GRAVIER, 1);   // dallage
          for (let y = Y + 1; y <= Y + 7; y++) put(x, y, z, Bk.AIR, 1);   // on dégage l'intérieur (herbes, troncs)
          if (edge) {
            const door = dz === -4 && Math.abs(dx) <= 1;
            let wh = corner ? 3 + Math.floor(hs(dx, 2, dz) * 3) : Math.floor(hs(dx, 3, dz) * 4.4);
            if (door) wh = dx === 0 ? 0 : Math.min(wh, 1);
            for (let k = 1; k <= wh; k++) put(x, Y + k, z, mossy(hs(dx, 10 + k, dz)), 1);
            if (wh > 0 && hs(dx, 4, dz) < 0.35) put(x, Y + wh + 1, z, Bk.FEUILLES, 1);   // la végétation reprend ses droits
          } else if (hs(dx, 5, dz) < 0.1) put(x, Y + 1, z, hs(dx, 6, dz) < 0.5 ? Bk.GALETS : Bk.P_MOUSSUE, 1);   // gravats
          else if (hs(dx, 7, dz) < 0.12) put(x, Y + 1, z, Bk.HERBES, 1);
        }
        // deux piliers brisés et le coffre
        for (const [dx, dz] of [[-2, 1], [2, -1]]) { const [x, z] = at(dx, dz), ph = 1 + Math.floor(hs(dx, 8, dz) * 4); for (let k = 1; k <= ph; k++) put(x, Y + k, z, k === ph ? Bk.BRIQUES_M : Bk.BRIQUES, 1); }
        const c = this.chestPos(st); put(c[0], c[1], c[2], Bk.COFFRE, 1);
      } else if (st.kind === 'puits') {
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          const x = X + dx, z = Z + dz, h0 = hAt(x, z), inner = Math.abs(dx) <= 1 && Math.abs(dz) <= 1, center = !dx && !dz;
          for (let y = h0 + 1; y < Y; y++) put(x, y, z, Bk.GRES, 1);
          for (let y = Y + 1; y <= Y + 5; y++) put(x, y, z, Bk.AIR, 1);
          if (center) { put(x, Y - 5, z, Bk.GRES, 1); for (let y = Y - 4; y <= Y; y++) put(x, y, z, Bk.EAU, 1); }
          else {
            put(x, Y, z, Bk.GRES, 1);
            if (inner) { for (let y = Y - 5; y < Y; y++) put(x, y, z, Bk.GRES, 1); put(x, Y + 1, z, Bk.GRES, 1); }   // margelle
            if (Math.abs(dx) === 1 && Math.abs(dz) === 1) { put(x, Y + 2, z, Bk.GRES, 1); put(x, Y + 3, z, Bk.GRES, 1); }   // piliers
          }
          if (inner) put(x, Y + 4, z, Bk.GRES, 1);   // toit
        }
        for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) put(X + dx, Y + 4, Z + dz, Bk.GRES, 1);
      } else if (st.kind === 'geant') {
        const top = Math.min(Y + 14 + Math.floor(st.r * 7), H - 8);
        for (let dz = 0; dz <= 1; dz++) for (let dx = 0; dx <= 1; dx++) { const x = X + dx, z = Z + dz; for (let y = Math.min(hAt(x, z), Y) - 1; y <= top; y++) if (y > 0) put(x, y, z, y < Y ? Bk.TERRE : y === Y ? Bk.TERRE : Bk.TRONC, 1); }
        // racines qui s'étalent
        for (const [dx, dz] of [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]]) {
          if (hs(dx, 20, dz) < 0.7) { const rh = 1 + Math.floor(hs(dx, 21, dz) * 3); for (let k = 0; k <= rh; k++) put(X + dx, Y + k, Z + dz, Bk.TRONC, 1); }
          const ex = dx < 0 ? dx - 1 : dx > 1 ? dx + 1 : dx, ez = dz < 0 ? dz - 1 : dz > 1 ? dz + 1 : dz;
          if (hs(dx, 22, dz) < 0.4) put(X + ex, hAt(X + ex, Z + ez), Z + ez, Bk.TRONC, 1);
        }
        // branches maîtresses, chacune terminée par une touffe de feuillage
        const nb = 3 + Math.floor(st.r * 2);
        for (let i = 0; i < nb; i++) {
          const a = (i / nb + hs(i, 23, 0)) * 6.2832, y0 = top - 4 - Math.floor(hs(i, 24, 0) * 5), len = 3 + Math.floor(hs(i, 25, 0) * 2);
          let bx = X, bz = Z, by = y0;
          for (let k = 1; k <= len; k++) { bx = X + Math.round(0.5 + Math.cos(a) * (k + 0.6)); bz = Z + Math.round(0.5 + Math.sin(a) * (k + 0.6)); by = y0 + (k >> 1); put(bx, by, bz, Bk.TRONC, 1); }
          for (let dy = -1; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dz * dz + dy * dy * 1.5 <= 5 + hs(bx + dx, by + dy, bz + dz) * 2) put(bx + dx, by + dy, bz + dz, Bk.FEUILLES, 0);
        }
        // grande couronne (ellipsoïde irrégulière)
        const R = 5 + Math.floor(st.r * 2);
        for (let dy = -3; dy <= 3; dy++) for (let dz = -R; dz <= R + 1; dz++) for (let dx = -R; dx <= R + 1; dx++) {
          const ux = dx - 0.5, uz = dz - 0.5, e = (ux * ux + uz * uz) / (R * R) + (dy * dy) / 10;
          if (e <= 1 - hs(dx, 30 + dy, dz) * 0.3 && top + 1 + dy < H - 1) put(X + dx, top + 1 + dy, Z + dz, Bk.FEUILLES, 0);
        }
      } else if (st.kind === 'portail') {
        const ax = st.rot & 1, P = (u, w) => ax ? [X + w, Z + u] : [X + u, Z + w];
        // sol brûlé : roche des Braises, braisiers et un peu de lave autour du cadre
        for (let w = -6; w <= 6; w++) for (let u = -6; u <= 7; u++) {
          const [x, z] = P(u, w), d = Math.hypot(u - 0.5, w), h0 = hAt(x, z); if (d > 6.2 - hs(u, 40, w) * 2.6 || Math.abs(h0 - Y) > 3) continue;
          const r = hs(u, 41, w);
          put(x, h0, z, d < 3 && r < 0.07 ? Bk.LAVE : r < 0.16 ? Bk.BRAISIER : r < 0.55 ? Bk.CENDRITE : r < 0.75 ? Bk.MOUSSE : Bk.BASALTE, 1);
          put(x, h0 + 1, z, Bk.AIR, 0);   // brûle les herbes
          if (d < 2.2 && r > 0.6) put(x, h0 - 1, z, Bk.CENDRITE, 1);
        }
        // le cadre d'obsidienne (4 × 5), incomplet : il faudra le réparer pour l'allumer
        let missing = 0;
        for (let v = 0; v <= 4; v++) for (let u = -1; u <= 2; u++) {
          const [x, z] = P(u, 0), inside = u >= 0 && u <= 1 && v >= 1 && v <= 3, corner = (u === -1 || u === 2) && (v === 0 || v === 4);
          if (v === 0) for (let y = hAt(x, z) + 1; y < Y; y++) put(x, y, z, Bk.PIERRE, 1);
          if (inside) { put(x, Y + v, z, Bk.AIR, 1); continue; }
          const gone = hs(u, 50 + v, 0) < (corner ? 0.5 : 0.24) || (v === 4 && u === 1);
          if (gone) { missing++; const [fx, fz] = P(u + Math.round((hs(u, 51, v) - 0.5) * 5), (hs(u, 52, v) < 0.5 ? -1 : 1) * (2 + Math.floor(hs(u, 53, v) * 3))); if (hs(u, 54, v) < 0.6) put(fx, hAt(fx, fz) + 1, fz, Bk.OBSIDIENNE, 1); }
          else put(x, Y + v, z, Bk.OBSIDIENNE, 1);
        }
        for (const w of [-1, 1]) for (let v = 1; v <= 4; v++) for (let u = -1; u <= 2; u++) { const [x, z] = P(u, w); if (v > 0) put(x, Y + v, z, Bk.AIR, 0); }
        if (st.r < 0.5) { const [x, z] = P(-3, 1); put(x, hAt(x, z), z, Bk.B_OR, 1); }   // un bloc d'or à demi enfoui
        const c = this.chestPos(st, hAt); put(c[0], c[1], c[2], Bk.COFFRE, 1); put(c[0], c[1] + 1, c[2], Bk.AIR, 1);
      }
    }

    genSurface(c) {
      const d = c.data, n = this.n, X0 = c.cx * CS, Z0 = c.cz * CS, S = this.seed, hash = VX.hash;
      const cH = this.cH, cS = this.cS, cF = this.cF, cD = this.cD, cT = this.cT, cM = this.cM, o = {};
      const ci = (x, z) => (x + M) + (z + M) * RS;   // x, z locaux au chunk (-M .. CS+M-1)
      // 1) climat et hauteur de la zone (chunk + marge)
      for (let z = -M; z < CS + M; z++) for (let x = -M; x < CS + M; x++) {
        this.climate(X0 + x, Z0 + z, o); const i = ci(x, z);
        cH[i] = o.h; cF[i] = o.fw; cD[i] = o.dw; cT[i] = o.T; cM[i] = o.mw;
      }
      // 2) type de surface (pente → roche apparente, altitude → neige)
      for (let z = -TM; z < CS + TM; z++) for (let x = -TM; x < CS + TM; x++) {
        const i = ci(x, z), h = cH[i], j = hash(X0 + x, 5, Z0 + z, S) - 0.5;
        const sl = Math.max(Math.abs(h - cH[i - 1]), Math.abs(h - cH[i + 1]), Math.abs(h - cH[i - RS]), Math.abs(h - cH[i + RS]));
        let s;
        if (h < SEA - 1) s = S_SEA;
        else if (h <= SEA + 1 + (j > 0.3 ? 1 : 0) && cM[i] < 0.4) s = S_SAND;
        else if (cD[i] + j * 0.15 > 0.5) s = S_DESERT;
        else {
          const rocky = (sl >= 3 && h > SEA + 5) || (cM[i] > 0.55 && h > 44 + j * 6), snowy = h >= 48 + j * 4;
          s = snowy ? (rocky ? S_SNOWROCK : S_SNOW) : rocky ? S_ROCK : S_GRASS;
        }
        cS[i] = s;
      }
      // 3) remplissage des colonnes, grottes, minerais
      for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
        const wx = X0 + x, wz = Z0 + z, i = ci(x, z), h = cH[i], s = cS[i];
        // couches : surface, remplissage, sous-couche (grès sous le désert), puis roche
        let top, fill, fillD, sub = B.PIERRE, subD = 0;
        if (s === S_SEA) {
          const fl = n.n2(wx / 14 + 33.3, wz / 14 - 8.1);
          top = h < SEA - 5 ? (fl > 0.22 ? B.ARGILE : fl < -0.3 ? B.GRAVIER : B.SABLE) : B.SABLE; fill = h < SEA - 5 && fl > 0.22 ? B.ARGILE : B.SABLE; fillD = 2;
        } else if (s === S_SAND) { top = fill = B.SABLE; fillD = 4; }
        else if (s === S_DESERT) { top = fill = B.SABLE; fillD = 3 + (hash(wx, 6, wz, S) < 0.5 ? 1 : 0); sub = B.GRES; subD = 4; }
        else if (s === S_ROCK) { top = fill = B.PIERRE; fillD = 0; }
        else if (s === S_SNOWROCK) { top = B.NEIGE_BLOC; fill = B.PIERRE; fillD = 0; }
        else if (s === S_SNOW) { top = B.NEIGE; fill = B.TERRE; fillD = 2; }
        else { top = B.HERBE; fill = B.TERRE; fillD = 3; }
        const lake = n.n2(wx / 48 + 300.5, wz / 48 - 11.5) > -0.15;   // zones de lacs de lave en profondeur
        for (let y = 0; y < H; y++) {
          let id;
          if (y === 0 || (y === 1 && hash(wx, 1, wz, S) < 0.5) || (y === 2 && hash(wx, 2, wz, S) < 0.2)) { d[idx(x, y, z)] = B.SOCLE; continue; }
          if (y > h) id = y <= SEA ? B.EAU : B.AIR;
          else if (y === h) id = top;
          else if (y >= h - fillD) id = fill;
          else if (y >= h - fillD - subD) id = sub;
          else id = B.PIERRE;
          if (y <= h && this.carved(wx, y, wz, h)) id = y <= 4 || (y <= LAVA_LAKE && lake) ? B.LAVE : B.AIR;
          else if (id === B.PIERRE) {
            // filons (bruits étirés) et poches de gravier / terre
            if (y < 56 && n.n3(wx / 6 + 11, y / 3.5, wz / 6) > 0.52) id = B.M_CHARBON;
            else if (y < 44 && n.n3(wx / 4.5 + 23, y / 3.2 + 7, wz / 4.5) > 0.57) id = B.M_FER;
            else if (y < 26 && n.n3(wx / 3.5 + 41, y / 3.5, wz / 3.5 + 9) > 0.63) id = B.M_OR;
            else if (y < 15 && n.n3(wx / 3 + 71, y / 3 + 3, wz / 3 + 5) > 0.65) id = B.M_SAPHIR;
            else if (y < 50 && n.n3(wx / 8 + 5, y / 7, wz / 8 - 9) > 0.6) id = y < 30 ? B.GRAVIER : B.TERRE;
          }
          d[idx(x, y, z)] = id;
        }
      }
      const D = VX.BLOCKS;
      const put = (x, y, z, id, over) => { if (x < 0 || z < 0 || x >= CS || z >= CS || y < 1 || y >= H) return; const i = idx(x, y, z); if (over || d[i] === B.AIR || (D[d[i]] && D[d[i]].replace)) d[i] = id; };
      // 4) arbres : chênes et bouleaux (on regarde aussi autour du chunk : les feuillages débordent)
      for (let tz = -TM; tz < CS + TM; tz++) for (let tx = -TM; tx < CS + TM; tx++) {
        const i = ci(tx, tz), s = cS[i]; if (s !== S_GRASS) continue;
        const wx = X0 + tx, wz = Z0 + tz, h = cH[i]; if (h <= SEA + 1 || h > 46) continue;
        if (hash(wx, 7, wz, S) > 0.003 + cF[i] * 0.021) continue;
        if (this.carved(wx, h, wz, h) || this.carved(wx, h - 1, wz, h)) continue;   // pas d'arbre au-dessus d'un trou
        const birch = hash(wx, 9, wz, S) < 0.15 + smooth(0.05, -0.15, cT[i]) * 0.65;
        if (birch) {
          const th = 5 + Math.floor(hash(wx, 8, wz, S) * 3), top = h + th;
          for (let dy = -3; dy <= 1; dy++) {
            const rad = dy <= -1 && dy >= -2 ? 2 : 1;
            for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
              if (Math.abs(dx) === rad && Math.abs(dz) === rad && (rad === 2 || dy === 1 || hash(wx + dx, top + dy, wz + dz, S) < 0.6)) continue;
              if (dy === -3 && (Math.abs(dx) + Math.abs(dz) > 1)) continue;
              put(tx + dx, top + dy, tz + dz, B.F_BOULEAU);
            }
          }
          if (tx >= 0 && tz >= 0 && tx < CS && tz < CS) { d[idx(tx, h, tz)] = B.TERRE; for (let y = h + 1; y <= top; y++) put(tx, y, tz, B.BOULEAU, true); }
        } else {
          const th = 4 + Math.floor(hash(wx, 8, wz, S) * 3), top = h + th;
          for (let dy = -2; dy <= 1; dy++) { const rad = dy <= -1 ? 2 : 1; for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || hash(wx + dx, top + dy, wz + dz, S) < 0.5)) continue; put(tx + dx, top + dy, tz + dz, B.FEUILLES); } }
          if (tx >= 0 && tz >= 0 && tx < CS && tz < CS) { d[idx(tx, h, tz)] = B.TERRE; for (let y = h + 1; y <= top; y++) put(tx, y, tz, B.TRONC, true); }
        }
      }
      // 5) petite végétation : herbes hautes, fleurs (en massifs de même couleur), cactus et arbustes secs
      for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
        const i = ci(x, z), s = cS[i], h = cH[i], wx = X0 + x, wz = Z0 + z; if (h + 1 >= H) continue;
        const ground = d[idx(x, h, z)], above = idx(x, h + 1, z); if (d[above] !== B.AIR) continue;
        const r = hash(wx, 21, wz, S);
        if (s === S_GRASS && ground === B.HERBE) {
          const patch = n.n2(wx / 11 + 40.5, wz / 11 - 20.5);
          if ((patch > 0.3 && r < 0.2) || r < 0.006) d[above] = n.n2(wx / 30 + 3.3, wz / 30 + 7.7) > 0 ? B.FLEUR_R : B.FLEUR_J;
          else if (r < 0.1 + 0.2 * (1 - cF[i])) d[above] = B.HERBES;
        } else if (s === S_DESERT && ground === B.SABLE && h > SEA + 1) {
          if (r < 0.006 && x > 0 && z > 0 && x < CS - 1 && z < CS - 1 && d[above - 1] !== B.CACTUS && d[above + 1] !== B.CACTUS && d[above - CS] !== B.CACTUS && d[above + CS] !== B.CACTUS) {
            const len = 1 + Math.floor(hash(wx, 22, wz, S) * 3); for (let k = 1; k <= len && h + k < H; k++) d[idx(x, h + k, z)] = B.CACTUS;
          } else if (r > 0.985) d[above] = B.ARBUSTE;
        } else if (s === S_SAND && ground === B.SABLE && h > SEA && r < 0.004) d[above] = B.ARBUSTE;
      }
      // 6) structures rares (ruines, puits, arbres géants, portails en ruine) : chaque chunk dessine la part qui le touche
      const sts = this.structuresIn(X0, Z0, X0 + CS - 1, Z0 + CS - 1);
      if (sts.length) {
        const o2 = {}, hAt = (x, z) => { const lx = x - X0, lz = z - Z0; return lx >= -M && lz >= -M && lx < CS + M && lz < CS + M ? cH[ci(lx, lz)] : this.climate(x, z, o2).h; };
        const wput = (x, y, z, id, mode) => {
          const lx = x - X0, lz = z - Z0; if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 1 || y >= H - 1) return;
          const i = idx(lx, y, lz); if (mode === 1 || d[i] === B.AIR || (D[d[i]] && D[d[i]].replace)) d[i] = id;
        };
        for (const st of sts) this.buildStruct(st, wput, hAt);
      }
    }
    genBraises(c) {
      const d = c.data, n = this.n, X0 = c.cx * CS, Z0 = c.cz * CS, S = this.seed;
      for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
        const wx = X0 + x, wz = Z0 + z, fl = this.floorAt(wx, wz), ce = this.ceilAt(wx, wz), bas = n.n2(wx / 34, wz / 34 + 80) > 0.33;
        for (let y = 0; y < H; y++) {
          let id = B.AIR;
          if (y === 0 || y === H - 1) id = B.SOCLE;
          else if (y <= fl) id = bas ? B.BASALTE : B.CENDRITE;
          else if (y >= ce) id = B.CENDRITE;
          else if (n.n3(wx / 21, y / 15, wz / 21) > 0.44) id = B.CENDRITE;
          else if (y <= LAVA_LV) id = B.LAVE;
          if (id === B.CENDRITE) {
            if (y < 36 && n.n3(wx / 3 + 91, y / 3, wz / 3 + 17) > 0.64) id = B.M_ASTRIUM;
            else if (n.n3(wx / 5 + 33, y / 5 + 9, wz / 5) > 0.55) id = B.BRAISIER;
          }
          d[idx(x, y, z)] = id;
        }
        // surface : mousse ardente ; plafond : lumicristaux suspendus
        for (let y = 1; y < H - 2; y++) {
          const i = idx(x, y, z), up = d[idx(x, y + 1, z)];
          if (d[i] === B.CENDRITE && up === B.AIR && n.n2(wx / 26, wz / 26 + 40) > -0.08) d[i] = B.MOUSSE;
        }
        if (VX.hash(wx, 3, wz, S) < 0.035) { let y = ce - 1; while (y > fl && d[idx(x, y, z)] !== B.AIR) y--; const len = 1 + Math.floor(VX.hash(wx, 4, wz, S) * 3); for (let k = 0; k < len && y - k > fl + 2; k++) if (d[idx(x, y - k, z)] === B.AIR) d[idx(x, y - k, z)] = B.LUMICRISTAL; }
      }
      // champignons géants
      for (let tz = -4; tz < CS + 4; tz++) for (let tx = -4; tx < CS + 4; tx++) {
        const wx = X0 + tx, wz = Z0 + tz; if (VX.hash(wx, 11, wz, S) > 0.012) continue;
        const fl = this.floorAt(wx, wz); if (fl <= LAVA_LV + 1 || n.n2(wx / 26, wz / 26 + 40) <= -0.08) continue;
        const th = 4 + Math.floor(VX.hash(wx, 12, wz, S) * 4), top = fl + th, rad = 2 + Math.floor(VX.hash(wx, 13, wz, S) * 2);
        const put = (x, y, z, id, over) => { if (x < 0 || z < 0 || x >= CS || z >= CS || y >= H - 1) return; const i = idx(x, y, z); if (over || d[i] === B.AIR) d[i] = id; };
        for (let y = fl + 1; y <= top; y++) put(tx, y, tz, B.TIGE, true);
        for (let dy = 0; dy <= 1; dy++) for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { const rr = dx * dx + dz * dz; if (rr > rad * rad + 1 || (dy === 1 && rr > (rad - 1) * (rad - 1) + 1)) continue; put(tx + dx, top + 1 + dy, tz + dz, B.CHAPEAU); }
        if (rad > 2) for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) put(tx + dx, top, tz + dz, B.LUMICRISTAL);
      }
    }
  }
  VX.Gen = Gen;
})();

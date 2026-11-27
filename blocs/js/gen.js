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
  class Gen {
    constructor(seed, dim) {
      this.seed = seed | 0; this.dim = dim; this.n = VX.makeNoise(this.seed + (dim === 'braises' ? 7777 : 0));
      // colonnes de la zone du chunk en cours (réutilisées d'un chunk à l'autre)
      this.cH = new Int16Array(RS * RS); this.cS = new Uint8Array(RS * RS); this.cF = new Float32Array(RS * RS);
      this.cD = new Float32Array(RS * RS); this.cT = new Float32Array(RS * RS); this.cM = new Float32Array(RS * RS);
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

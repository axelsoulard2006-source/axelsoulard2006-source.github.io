/* ===== gen.js : génération pure du terrain (Surface et Braises) — utilisée par le Worker et, en secours, par le thread principal ===== */
(function () {
  const VX = self.VX, B = VX.B;
  const CS = 16, H = 64, SEA = 24, LAVA_LV = 13;
  VX.CS = CS; VX.H = H; VX.SEA = SEA; VX.LAVA_LV = LAVA_LV;
  const idx = (x, y, z) => x + z * CS + y * CS * CS;
  class Gen {
    constructor(seed, dim) { this.seed = seed | 0; this.dim = dim; this.n = VX.makeNoise(this.seed + (dim === 'braises' ? 7777 : 0)); }
    generate(cx, cz) { const c = { cx, cz, data: new Uint8Array(CS * CS * H) }; if (this.dim === 'braises') this.genBraises(c); else this.genSurface(c); return c.data; }
    heightAt(x, z) {
      const n = this.n; let h = 31 + n.fbm2(x / 120, z / 120, 4) * 22 + n.fbm2(x / 32 + 100, z / 32, 2) * 4;
      const m = n.n2(x / 260 + 40, z / 260); if (m > 0.2) h += (m - 0.2) * 40;   // montagnes
      return Math.max(4, Math.min(H - 6, Math.floor(h)));
    }
    floorAt(x, z) { return Math.floor(16 + this.n.fbm2(x / 50, z / 50, 3) * 12); }
    ceilAt(x, z) { return Math.floor(52 + this.n.fbm2(x / 40 + 300, z / 40, 2) * 8); }
    genSurface(c) {
      const d = c.data, n = this.n, X0 = c.cx * CS, Z0 = c.cz * CS, S = this.seed;
      for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
        const wx = X0 + x, wz = Z0 + z, h = this.heightAt(wx, wz), beach = h <= SEA + 1, snow = h > 47;
        for (let y = 0; y < H; y++) {
          let id;
          if (y === 0) id = B.SOCLE;
          else if (y < h - 3) id = B.PIERRE;
          else if (y < h) id = beach ? B.SABLE : B.TERRE;
          else if (y === h) id = beach ? B.SABLE : snow ? B.NEIGE : B.HERBE;
          else if (y <= SEA) id = B.EAU;
          else id = B.AIR;
          if (id !== B.AIR && id !== B.EAU && y > 0 && y < h - (beach ? 4 : 0)) {
            const a = n.n3(wx / 26, y / 17, wz / 26), b = n.n3(wx / 26 + 50, y / 17 + 50, wz / 26 + 50);
            if (a * a + b * b < 0.011 || (y < h - 6 && n.n3(wx / 46, y / 30, wz / 46) > 0.5)) id = y <= 5 ? B.LAVE : B.AIR;
          }
          if (id === B.PIERRE) {
            if (y < 56 && n.n3(wx / 4.5 + 11, y / 4.5, wz / 4.5) > 0.5) id = B.M_CHARBON;
            else if (y < 42 && n.n3(wx / 4 + 23, y / 4 + 7, wz / 4) > 0.54) id = B.M_FER;
            else if (y < 26 && n.n3(wx / 3.5 + 41, y / 3.5, wz / 3.5 + 9) > 0.58) id = B.M_OR;
            else if (y < 15 && n.n3(wx / 3 + 71, y / 3 + 3, wz / 3 + 5) > 0.6) id = B.M_SAPHIR;
          }
          d[idx(x, y, z)] = id;
        }
      }
      // arbres (on regarde aussi un peu autour du chunk : les feuillages débordent)
      for (let tz = -3; tz < CS + 3; tz++) for (let tx = -3; tx < CS + 3; tx++) {
        const wx = X0 + tx, wz = Z0 + tz, fo = this.n.n2(wx / 90 + 7, wz / 90 - 3); if (VX.hash(wx, 7, wz, S) > (fo > 0.12 ? 0.022 : fo > -0.1 ? 0.004 : 0.0012)) continue;
        const h = this.heightAt(wx, wz); if (h <= SEA + 1 || h > 46) continue;
        const th = 4 + Math.floor(VX.hash(wx, 8, wz, S) * 3), top = h + th;
        const put = (x, y, z, id, over) => { if (x < 0 || z < 0 || x >= CS || z >= CS || y >= H) return; const i = idx(x, y, z); if (over || d[i] === B.AIR) d[i] = id; };
        for (let dy = -2; dy <= 1; dy++) { const rad = dy <= -1 ? 2 : 1; for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || VX.hash(wx + dx, top + dy, wz + dz, S) < 0.5)) continue; put(tx + dx, top + dy, tz + dz, B.FEUILLES); } }
        if (tx >= 0 && tz >= 0 && tx < CS && tz < CS && d[idx(tx, h, tz)] === B.HERBE) { d[idx(tx, h, tz)] = B.TERRE; for (let y = h + 1; y <= top; y++) put(tx, y, tz, B.TRONC, true); }
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

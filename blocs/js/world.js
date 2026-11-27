/* ===== world.js : monde en chunks 16×64×16, génération (Surface / Braises), maillage optimisé ===== */
(function () {
  const VX = window.VX, B = VX.B, D = VX.BLOCKS;
  const CS = 16, H = 64, SEA = 24, LAVA_LV = 13;
  VX.CS = CS; VX.H = H; VX.SEA = SEA;
  const key = (cx, cz) => cx + ',' + cz;
  const idx = (x, y, z) => x + z * CS + y * CS * CS;

  // faces : normale, axes u/v (u×v = normale), origine du quad
  const FACES = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], o: [1, 0, 1], sh: 0.8, t: 'side' },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], o: [0, 0, 0], sh: 0.8, t: 'side' },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], o: [0, 0, 1], sh: 0.68, t: 'side' },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], o: [1, 0, 0], sh: 0.68, t: 'side' },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], o: [0, 1, 1], sh: 1, t: 'top' },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], o: [0, 0, 0], sh: 0.55, t: 'bottom' },
  ];
  const AO = [0.48, 0.64, 0.82, 1];

  class World {
    constructor(seed, dim, mods) {
      this.seed = seed | 0; this.dim = dim; this.n = VX.makeNoise(this.seed + (dim === 'braises' ? 7777 : 0));
      this.chunks = new Map(); this.mods = mods || {}; this.group = new THREE.Group();
      this.matO = new THREE.MeshBasicMaterial({ map: VX.TEX.tex, vertexColors: true, alphaTest: 0.5 });
      this.matG = new THREE.MeshBasicMaterial({ map: VX.TEX.tex, vertexColors: true, alphaTest: 0.5 });
      this.matT = new THREE.MeshBasicMaterial({ map: VX.TEX.tex, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      this.light = 1;
    }
    /* ---------- accès aux blocs ---------- */
    chunk(cx, cz) { return this.chunks.get(key(cx, cz)); }
    ensure(cx, cz) { let c = this.chunk(cx, cz); if (!c) { c = { cx, cz, data: new Uint8Array(CS * CS * H), meshes: null, dirty: true }; this.generate(c); this.chunks.set(key(cx, cz), c); } return c; }
    get(x, y, z) {
      if (y < 0) return B.SOCLE; if (y >= H) return B.AIR;
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = this.chunk(cx, cz); if (!c) return B.AIR;
      return c.data[idx(x - cx * CS, y, z - cz * CS)];
    }
    getG(x, y, z) {   // comme get, mais génère le chunk au besoin (collisions, rayons)
      if (y < 0) return B.SOCLE; if (y >= H) return B.AIR;
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = this.ensure(cx, cz);
      return c.data[idx(x - cx * CS, y, z - cz * CS)];
    }
    set(x, y, z, id) {
      if (y < 0 || y >= H) return false;
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = this.ensure(cx, cz), lx = x - cx * CS, lz = z - cz * CS, i = idx(lx, y, lz);
      if (c.data[i] === id) return false;
      c.data[i] = id; const k = key(cx, cz); (this.mods[k] = this.mods[k] || {})[i] = id;
      c.dirty = true;
      if (lx === 0) this.markDirty(cx - 1, cz); if (lx === CS - 1) this.markDirty(cx + 1, cz);
      if (lz === 0) this.markDirty(cx, cz - 1); if (lz === CS - 1) this.markDirty(cx, cz + 1);
      return true;
    }
    markDirty(cx, cz) { const c = this.chunk(cx, cz); if (c) c.dirty = true; }
    /* ---------- génération ---------- */
    heightAt(x, z) {
      const n = this.n; let h = 31 + n.fbm2(x / 120, z / 120, 4) * 22 + n.fbm2(x / 32 + 100, z / 32, 2) * 4;
      const m = n.n2(x / 260 + 40, z / 260); if (m > 0.2) h += (m - 0.2) * 40;   // montagnes
      return Math.max(4, Math.min(H - 6, Math.floor(h)));
    }
    floorAt(x, z) { return Math.floor(16 + this.n.fbm2(x / 50, z / 50, 3) * 12); }
    ceilAt(x, z) { return Math.floor(52 + this.n.fbm2(x / 40 + 300, z / 40, 2) * 8); }
    generate(c) { if (this.dim === 'braises') this.genBraises(c); else this.genSurface(c); const m = this.mods[key(c.cx, c.cz)]; if (m) for (const i in m) c.data[i] = m[i]; }
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
    /* ---------- maillage ---------- */
    buildMesh(c) {
      const X0 = c.cx * CS, Z0 = c.cz * CS, data = c.data;
      const get = (x, y, z) => (x >= 0 && x < CS && z >= 0 && z < CS) ? (y < 0 ? B.SOCLE : y >= H ? 0 : data[idx(x, y, z)]) : this.get(X0 + x, y, Z0 + z);
      const opaq = (x, y, z) => { const b = D[get(x, y, z)]; return b && b.opaque && !b.liquid ? 1 : 0; };
      const out = { o: { p: [], u: [], c: [], i: [] }, g: { p: [], u: [], c: [], i: [] }, t: { p: [], u: [], c: [], i: [] } };
      const quad = (buf, pts, uv, cols, flip) => {
        const b = buf.p.length / 3; for (const p of pts) buf.p.push(p[0], p[1], p[2]);
        buf.u.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
        for (const k of cols) buf.c.push(k, k, k);
        if (flip) buf.i.push(b + 1, b + 2, b + 3, b + 1, b + 3, b); else buf.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
      };
      for (let y = 0; y < H; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
        const id = data[idx(x, y, z)]; if (!id) continue; const b = D[id]; if (!b) continue;
        const buf = b.transparent ? out.t : b.glow ? out.g : out.o;
        if (b.shape === 'torch') { this.torchQuads(buf, x, y, z, quad); continue; }
        const lowTop = b.liquid && get(x, y + 1, z) !== id ? 0.88 : 1;
        for (const f of FACES) {
          const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2], nid = get(nx, ny, nz);
          if (nid === id && (b.liquid || b.transparent || b.cutout)) continue;
          const nb = D[nid]; if (nb && nb.opaque) continue;
          if (b.liquid && nb && nb.liquid) continue;
          const uv = VX.TEX.uv(b.tex[f.t]), pts = [], cols = [], aos = [];
          for (let k = 0; k < 4; k++) {
            const du = k === 1 || k === 2 ? 1 : 0, dv = k >= 2 ? 1 : 0;
            let px = f.o[0] + f.u[0] * du + f.v[0] * dv, py = f.o[1] + f.u[1] * du + f.v[1] * dv, pz = f.o[2] + f.u[2] * du + f.v[2] * dv;
            if (py === 1 && lowTop < 1) py = lowTop;
            pts.push([x + px, y + py, z + pz]);
            if (b.glow || b.liquid) { aos.push(3); cols.push(b.glow ? 1 : f.sh); continue; }
            const su = du ? 1 : -1, sv = dv ? 1 : -1;
            const s1 = opaq(nx + f.u[0] * su, ny + f.u[1] * su, nz + f.u[2] * su), s2 = opaq(nx + f.v[0] * sv, ny + f.v[1] * sv, nz + f.v[2] * sv);
            const cr = opaq(nx + f.u[0] * su + f.v[0] * sv, ny + f.u[1] * su + f.v[1] * sv, nz + f.u[2] * su + f.v[2] * sv);
            const ao = s1 && s2 ? 0 : 3 - s1 - s2 - cr; aos.push(ao); cols.push(f.sh * AO[ao]);
          }
          quad(buf, pts, uv, cols, aos[0] + aos[2] < aos[1] + aos[3]);
        }
      }
      // remplace les anciens maillages
      this.disposeMesh(c);
      c.meshes = []; const pos = [X0, 0, Z0];
      for (const [k, mat, order] of [['o', this.matO, 0], ['g', this.matG, 0], ['t', this.matT, 2]]) {
        const bf = out[k]; if (!bf.i.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(bf.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(bf.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(bf.c, 3));
        g.setIndex(bf.i); g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mat); m.position.set(pos[0], pos[1], pos[2]); m.renderOrder = order; m.matrixAutoUpdate = false; m.updateMatrix();
        this.group.add(m); c.meshes.push(m);
      }
      c.dirty = false;
    }
    torchQuads(buf, x, y, z, quad) {
      const a = 7 / 16, b2 = 9 / 16, h = 10 / 16, t = VX.TEX.uv('torch'), du = (t[2] - t[0]) / 16, dv = (t[3] - t[1]) / 16;
      const side = [t[0] + 7 * du, t[1], t[0] + 9 * du, t[1] + 10 * dv], top = [t[0] + 7 * du, t[1] + 8 * dv, t[0] + 9 * du, t[1] + 10 * dv];
      const P = (px, py, pz) => [x + px, y + py, z + pz];
      quad(buf, [P(b2, 0, b2), P(b2, 0, a), P(b2, h, a), P(b2, h, b2)], side, [1, 1, 1, 1]);
      quad(buf, [P(a, 0, a), P(a, 0, b2), P(a, h, b2), P(a, h, a)], side, [1, 1, 1, 1]);
      quad(buf, [P(a, 0, b2), P(b2, 0, b2), P(b2, h, b2), P(a, h, b2)], side, [1, 1, 1, 1]);
      quad(buf, [P(b2, 0, a), P(a, 0, a), P(a, h, a), P(b2, h, a)], side, [1, 1, 1, 1]);
      quad(buf, [P(a, h, b2), P(b2, h, b2), P(b2, h, a), P(a, h, a)], top, [1, 1, 1, 1]);
    }
    disposeMesh(c) { if (c.meshes) for (const m of c.meshes) { this.group.remove(m); m.geometry.dispose(); } c.meshes = null; }
    /* ---------- chargement autour du joueur ---------- */
    update(px, pz, R, budget) {
      const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
      let gen = 0, built = 0;
      // données jusqu'à R+1, maillages jusqu'à R (du plus proche au plus loin)
      const order = [];
      for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) order.push([dx * dx + dz * dz, pcx + dx, pcz + dz, Math.max(Math.abs(dx), Math.abs(dz)) <= R]);
      order.sort((a, b) => a[0] - b[0]);
      for (const [, cx, cz, inner] of order) {
        let c = this.chunk(cx, cz);
        if (!c) { if (gen >= budget.gen) continue; c = this.ensure(cx, cz); gen++; }
        if (inner && c.dirty && built < budget.mesh) {
          if (this.chunk(cx + 1, cz) && this.chunk(cx - 1, cz) && this.chunk(cx, cz + 1) && this.chunk(cx, cz - 1)) { this.buildMesh(c); built++; }
        }
      }
      // déchargement
      for (const [k, c] of this.chunks) if (Math.abs(c.cx - pcx) > R + 3 || Math.abs(c.cz - pcz) > R + 3) { this.disposeMesh(c); this.chunks.delete(k); }
      return gen + built;
    }
    unloadAll() { for (const c of this.chunks.values()) this.disposeMesh(c); this.chunks.clear(); }
    /* ---------- rayon (sélection du bloc visé) ---------- */
    raycast(o, dir, maxD) {
      let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
      const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
      const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
      let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
      let nx = 0, ny = 0, nz = 0, t = 0;
      for (let i = 0; i < 64 && t <= maxD; i++) {
        const id = this.getG(x, y, z), b = D[id];
        if (id && b && !b.liquid) return { x, y, z, nx, ny, nz, id, t };
        if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
        else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
        else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
      }
      return null;
    }
    // point d'apparition sûr près de (x, z)
    findSpawn(x0, z0) {
      for (let r = 0; r < 40; r++) for (let a = 0; a < Math.max(1, r * 6); a++) {
        const x = Math.round(x0 + Math.cos(a / Math.max(1, r * 6) * 6.283) * r), z = Math.round(z0 + Math.sin(a / Math.max(1, r * 6) * 6.283) * r);
        if (this.dim === 'braises') {
          for (let y = 50; y > LAVA_LV + 1; y--) { const g = this.getG(x, y - 1, z); if (D[g] && D[g].solid && this.getG(x, y, z) === 0 && this.getG(x, y + 1, z) === 0 && this.getG(x, y + 2, z) === 0) return { x: x + 0.5, y, z: z + 0.5 }; }
        } else {
          for (let y = H - 2; y > SEA; y--) { const g = this.getG(x, y - 1, z); if (g !== B.AIR) { if (D[g].solid && this.getG(x, y, z) === 0 && this.getG(x, y + 1, z) === 0) return { x: x + 0.5, y, z: z + 0.5 }; break; } }
        }
      }
      return { x: x0 + 0.5, y: 40, z: z0 + 0.5 };
    }
  }
  VX.World = World;
  VX.LAVA_LV = LAVA_LV;
})();

/* ===== world.js : chunks 16×64×16 d'une dimension — données, modifications, chargement asynchrone (Workers),
   maillages réutilisés (pool), rayon de visée, point d'apparition ===== */
(function () {
  const VX = window.VX, B = VX.B, D = VX.BLOCKS;
  const CS = VX.CS, H = VX.H, P = VX.MESH_PAD, W = VX.MESH_W, LAVA_LV = VX.LAVA_LV;
  const key = (cx, cz) => cx + ',' + cz;
  const idx = (x, y, z) => x + z * CS + y * CS * CS;
  const LIGHT_IDS = new Set([B.TORCHE, B.LUMICRISTAL, B.BRAISIER, B.PORTAIL, B.LAVE]);

  /* ---------- Workers (génération + maillage) ---------- */
  const WK = VX.Workers = { list: [], cb: new Map(), seq: 0, ok: false, rr: 0, inited: false };
  try {
    const n = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 4) - 2));
    for (let i = 0; i < n; i++) {
      const w = new Worker('js/worker.js?v=3');
      w.onmessage = e => { const f = WK.cb.get(e.data.id); if (f) { WK.cb.delete(e.data.id); f(e.data); } };
      w.onerror = err => { console.warn('Worker indisponible, calcul sur le thread principal', err.message); WK.ok = false; WK.cb.clear(); if (VX.G && VX.G.world) VX.G.world.resetPending(); };
      WK.list.push(w);
    }
    WK.ok = WK.list.length > 0;
  } catch (e) { WK.ok = false; }
  WK.init = () => { if (WK.inited || !WK.ok) return; WK.inited = true; const t = VX.TEX.workerTiles(); for (const w of WK.list) w.postMessage({ type: 'init', tiles: t.tiles, origins: t.origins }); };
  WK.send = (msg, transfer, cb) => { const id = ++WK.seq; msg.id = id; WK.cb.set(id, cb); WK.list[WK.rr++ % WK.list.length].postMessage(msg, transfer || []); };

  class World {
    constructor(seed, dim, mods) {
      this.seed = seed | 0; this.dim = dim; this.mods = mods || {}; this.gen = new VX.Gen(this.seed, dim);
      this.chunks = new Map(); this.group = new THREE.Group(); this.pool = []; this.pendGen = new Set(); this.inflight = 0; this.results = []; this.alive = true;
      this.order = null; this.orderR = -1; WK.init();
    }
    /* ---------- accès aux blocs ---------- */
    chunk(cx, cz) { return this.chunks.get(key(cx, cz)); }
    makeChunk(cx, cz, data) {
      const m = this.mods[key(cx, cz)]; if (m) for (const i in m) data[i] = m[i];
      const c = { cx, cz, data, meshes: [], dirty: true, ver: 0, busy: false };
      this.chunks.set(key(cx, cz), c); this.pendGen.delete(key(cx, cz));
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = (dx || dz) && this.chunk(cx + dx, cz + dz); if (n && n.meshed) { n.dirty = true; n.ver++; } }
      return c;
    }
    ensure(cx, cz) { return this.chunk(cx, cz) || this.makeChunk(cx, cz, this.gen.generate(cx, cz)); }
    get(x, y, z) {
      if (y < 0) return B.SOCLE; if (y >= H) return B.AIR;
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = this.chunk(cx, cz); if (!c) return B.AIR;
      return c.data[idx(x - cx * CS, y, z - cz * CS)];
    }
    getG(x, y, z) {   // génère le chunk si besoin (collisions, visée) : jamais de trou sous les pieds
      if (y < 0) return B.SOCLE; if (y >= H) return B.AIR;
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = this.ensure(cx, cz);
      return c.data[idx(x - cx * CS, y, z - cz * CS)];
    }
    set(x, y, z, id) {
      if (y < 0 || y >= H) return false;
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS), c = this.ensure(cx, cz), lx = x - cx * CS, lz = z - cz * CS, i = idx(lx, y, lz), old = c.data[i];
      if (old === id) return false;
      c.data[i] = id; const k = key(cx, cz); (this.mods[k] = this.mods[k] || {})[i] = id;
      VX.hooks.emit('worldSet', { dim: this.dim, x, y, z, id, old });
      this.markDirty(cx, cz);
      if (LIGHT_IDS.has(id) || LIGHT_IDS.has(old) || lx < 8 || lx > 7) {   // lumière et ombres débordent jusqu'à 8 blocs
        const nx = lx < 8 ? -1 : 1, nz = lz < 8 ? -1 : 1, far = LIGHT_IDS.has(id) || LIGHT_IDS.has(old);
        if (far || lx === 0 || lx === CS - 1) this.markDirty(cx + nx, cz);
        if (far || lz === 0 || lz === CS - 1) this.markDirty(cx, cz + nz);
        if (far) this.markDirty(cx + nx, cz + nz);
      }
      return true;
    }
    markDirty(cx, cz) { const c = this.chunk(cx, cz); if (c) { c.dirty = true; c.ver++; } }
    remeshAll() { for (const c of this.chunks.values()) { c.dirty = true; c.ver++; } }
    resetPending() { this.pendGen.clear(); this.inflight = 0; for (const c of this.chunks.values()) c.busy = false; }
    /* ---------- maillage ---------- */
    volume(c) {
      const vol = new Uint8Array(W * W * H);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const n = this.chunk(c.cx + dx, c.cz + dz); if (!n) continue; const d = n.data;
        const x0 = dx < 0 ? CS - P : 0, x1 = dx > 0 ? P : CS, z0 = dz < 0 ? CS - P : 0, z1 = dz > 0 ? P : CS;
        for (let y = 0; y < H; y++) for (let z = z0; z < z1; z++) {
          const vz = z + dz * CS + P, src = z * CS + y * CS * CS, dst = vz * W + y * W * W + dx * CS + P;
          for (let x = x0; x < x1; x++) vol[dst + x] = d[src + x];
        }
      }
      return vol;
    }
    neighbors(c) { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!this.chunk(c.cx + dx, c.cz + dz)) return false; return true; }
    requestMesh(c) {
      const ver = c.ver, vol = this.volume(c); c.busy = true;
      if (WK.ok && WK.inited) { this.inflight++; WK.send({ type: 'mesh', vol, dim: this.dim, fast: !!VX.fastMesh }, [vol.buffer], m => { this.inflight = Math.max(0, this.inflight - 1); this.results.push([c, ver, m.r]); }); }
      else { const t = VX.TEX.workerTiles(); this.applyMesh(c, ver, VX.Mesher.build(vol, this.dim, t.tiles, t.origins, !!VX.fastMesh)); }
    }
    applyMesh(c, ver, r) {
      c.busy = false; if (!this.alive || this.chunk(c.cx, c.cz) !== c) return;
      this.freeMeshes(c);
      for (const k of ['o', 't']) {
        const b = r[k]; if (!b.i.length) continue;
        const m = this.pool.pop() || new THREE.Mesh(new THREE.BufferGeometry(), VX.R.mats.o);
        const g = m.geometry; g.dispose();
        g.setAttribute('position', new THREE.BufferAttribute(b.p, 3)); g.setAttribute('uv', new THREE.BufferAttribute(b.u, 2));
        g.setAttribute('tile', new THREE.BufferAttribute(b.t, 2)); g.setAttribute('color', new THREE.BufferAttribute(b.c, 3)); g.setAttribute('lit', new THREE.BufferAttribute(b.l, 2));
        g.setIndex(new THREE.BufferAttribute(b.i, 1)); g.computeBoundingSphere();
        m.material = VX.R.mats[k]; m.renderOrder = k === 't' ? 2 : 0;
        m.position.set(c.cx * CS, 0, c.cz * CS); m.matrixAutoUpdate = false; m.updateMatrix(); m.frustumCulled = true;
        this.group.add(m); c.meshes.push(m);
      }
      c.meshed = true; if (ver === c.ver) c.dirty = false;
    }
    freeMeshes(c) { for (const m of c.meshes) { this.group.remove(m); if (this.pool.length < 96) this.pool.push(m); else m.geometry.dispose(); } c.meshes = []; }
    /* ---------- chargement autour du joueur ---------- */
    update(px, pz, R) {
      const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
      if (this.orderR !== R) { this.orderR = R; this.order = []; for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) this.order.push([dx * dx + dz * dz, dx, dz, Math.max(Math.abs(dx), Math.abs(dz)) <= R]); this.order.sort((a, b) => a[0] - b[0]); }
      let genBudget = WK.ok ? 8 - this.pendGen.size : 1, meshBudget = WK.ok ? 4 - this.inflight : 1;
      for (const [, dx, dz, inner] of this.order) {
        const cx = pcx + dx, cz = pcz + dz, k = key(cx, cz); let c = this.chunk(cx, cz);
        if (!c) {
          if (genBudget <= 0 || this.pendGen.has(k)) continue; genBudget--;
          if (WK.ok && WK.inited) { this.pendGen.add(k); WK.send({ type: 'gen', seed: this.seed, dim: this.dim, cx, cz }, null, m => { if (this.alive && !this.chunk(cx, cz)) this.makeChunk(cx, cz, m.data); else this.pendGen.delete(k); }); }
          else this.ensure(cx, cz);
          continue;
        }
        if (inner && c.dirty && !c.busy && meshBudget > 0 && this.neighbors(c)) { meshBudget--; this.requestMesh(c); }
      }
      // on applique quelques maillages par image (pas de pic)
      for (let n = 0; n < 3 && this.results.length; n++) { const [c, ver, r] = this.results.shift(); this.applyMesh(c, ver, r); }
      for (const [k, c] of this.chunks) if (Math.abs(c.cx - pcx) > R + 3 || Math.abs(c.cz - pcz) > R + 3) { this.freeMeshes(c); this.chunks.delete(k); }
    }
    // chargement immédiat autour d'un point (arrivée, téléportation) : pas d'écran vide
    preload(px, pz, r) {
      const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS), t = VX.TEX.workerTiles();
      for (let dz = -r - 1; dz <= r + 1; dz++) for (let dx = -r - 1; dx <= r + 1; dx++) this.ensure(pcx + dx, pcz + dz);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const c = this.chunk(pcx + dx, pcz + dz); if (c.dirty && !c.busy) this.applyMesh(c, c.ver, VX.Mesher.build(this.volume(c), this.dim, t.tiles, t.origins, !!VX.fastMesh)); }
    }
    unloadAll() { this.alive = false; for (const c of this.chunks.values()) this.freeMeshes(c); this.chunks.clear(); for (const m of this.pool) m.geometry.dispose(); this.pool = []; this.results = []; }
    /* ---------- rayon (bloc visé) ---------- */
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
    findSpawn(x0, z0) {
      for (let r = 0; r < 40; r++) for (let a = 0; a < Math.max(1, r * 6); a++) {
        const x = Math.round(x0 + Math.cos(a / Math.max(1, r * 6) * 6.283) * r), z = Math.round(z0 + Math.sin(a / Math.max(1, r * 6) * 6.283) * r);
        if (this.dim === 'braises') {
          for (let y = 50; y > LAVA_LV + 1; y--) { const g = this.getG(x, y - 1, z); if (D[g] && D[g].solid && this.getG(x, y, z) === 0 && this.getG(x, y + 1, z) === 0 && this.getG(x, y + 2, z) === 0) return { x: x + 0.5, y, z: z + 0.5 }; }
        } else {
          for (let y = H - 2; y > VX.SEA; y--) { const g = this.getG(x, y - 1, z); if (g !== B.AIR) { if (D[g].solid && this.getG(x, y, z) === 0 && this.getG(x, y + 1, z) === 0) return { x: x + 0.5, y, z: z + 0.5 }; break; } }
        }
      }
      return { x: x0 + 0.5, y: 40, z: z0 + 0.5 };
    }
  }
  VX.World = World;
})();

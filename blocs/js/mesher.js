/* ===== mesher.js : maillage d'un chunk (sans DOM : tourne dans le Worker)
   - greedy meshing : les faces voisines identiques (même tuile, même ombre, même lumière) sont fusionnées en rectangles
   - occlusion ambiante par sommet, ombrage par orientation
   - lumière du ciel (colonnes) et lumière des blocs (torches, cristaux, lave…) sur un volume avec 8 blocs de marge
   Entrée : vol = Uint8Array (16+2P) × 64 × (16+2P), P = 8 ; tiles = { nom: index } ; origins = [[u0, v0], …]
   Sortie : { o: buffers opaques (+ lumineux), t: buffers transparents } en tableaux typés transférables ===== */
(function () {
  const VX = self.VX, D = VX.BLOCKS, B = VX.B;
  const CS = 16, H = 64, P = 8, W = CS + 2 * P;
  VX.MESH_PAD = P; VX.MESH_W = W;
  const AO = [0.48, 0.64, 0.82, 1];
  // faces : normale, axes u/v (u × v = normale), origine du quad unité, ombrage
  const FACES = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], sh: 0.8, t: 'side' },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], sh: 0.8, t: 'side' },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], sh: 0.68, t: 'side' },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], sh: 0.68, t: 'side' },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], sh: 1, t: 'top' },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], sh: 0.55, t: 'bottom' },
  ].map(f => { const ax = a => a.findIndex(c => c !== 0); return Object.assign(f, { na: ax(f.n), ns: f.n[ax(f.n)], ua: ax(f.u), us: f.u[ax(f.u)], va: ax(f.v), vs: f.v[ax(f.v)] }); });
  const SIZE = [CS, H, CS];
  const LIGHTS = { [B.TORCHE]: 8, [B.LUMICRISTAL]: 7, [B.BRAISIER]: 5, [B.PORTAIL]: 5, [B.LAVE]: 6 };

  function makeBuf() { return { p: [], u: [], t: [], c: [], l: [], i: [] }; }
  function finish(b) {
    const nv = b.p.length / 3;
    return { p: new Float32Array(b.p), u: new Float32Array(b.u), t: new Float32Array(b.t), c: new Float32Array(b.c), l: new Float32Array(b.l), i: nv > 65535 ? new Uint32Array(b.i) : new Uint16Array(b.i) };
  }

  VX.Mesher = {
    build(vol, dim, tiles, origins, fast) {   // fast : sans ombre aux coins, lumière en 4 paliers → fusion maximale
      const get = (x, y, z) => y < 0 ? B.SOCLE : y >= H ? 0 : vol[(x + P) + (z + P) * W + y * W * W];
      const opaq = (x, y, z) => { const b = D[get(x, y, z)]; return b && b.opaque && !b.liquid ? 1 : 0; };
      // lumière du ciel : hauteur du premier bloc qui arrête la lumière, par colonne du volume
      const top = new Int16Array(W * W), leaf = new Int16Array(W * W);
      if (dim !== 'braises') for (let z = -P; z < CS + P; z++) for (let x = -P; x < CS + P; x++) { let y = H - 1, lf = -1; for (; y > 0; y--) { const b = D[get(x, y, z)]; if (b && b.id === B.FEUILLES && lf < 0) lf = y; if (b && b.opaque && !b.liquid) break; } top[(x + P) + (z + P) * W] = y; leaf[(x + P) + (z + P) * W] = lf; }
      const sky = (x, y, z) => { if (dim === 'braises') return 1; const i = (x + P) + (z + P) * W, t = top[i]; const s = y > t ? 1 : Math.max(0.05, 1 - (t - y) * 0.14); return y < leaf[i] ? s * 0.74 : s; };
      // sources de lumière dans le volume
      const src = [];
      for (let y = 1; y < H - 1; y++) for (let z = -P; z < CS + P; z++) for (let x = -P; x < CS + P; x++) {
        const id = get(x, y, z), r = LIGHTS[id]; if (!r) continue;
        if (id === B.LAVE && (dim === 'braises' || get(x, y + 1, z) !== 0)) continue;
        src.push(x + 0.5, y + 0.5, z + 0.5, r);
      }
      const blk = (x, y, z) => { let m = 0; const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5; for (let k = 0; k < src.length; k += 4) { const dx = src[k] - cx, dy = src[k + 1] - cy, dz = src[k + 2] - cz, r = src[k + 3], d2 = dx * dx + dy * dy + dz * dz; if (d2 >= r * r) continue; const v = 1 - Math.sqrt(d2) / r; if (v > m) m = v; } return m; };
      const out = { o: makeBuf(), t: makeBuf() };
      // un quad : coins (du,dv) = (0,0) (1,0) (1,1) (0,1)
      const quad = (buf, pts, lu, tile, cols, lit, flip) => {
        const b = buf.p.length / 3, o = origins[tile];
        for (let k = 0; k < 4; k++) { const q = pts[k]; buf.p.push(q[0], q[1], q[2]); buf.u.push(lu[k][0], lu[k][1]); buf.t.push(o[0], o[1]); buf.c.push(cols[k], cols[k], cols[k]); buf.l.push(lit[0], lit[1]); }
        if (flip) buf.i.push(b + 1, b + 2, b + 3, b + 1, b + 3, b); else buf.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
      };
      const pos = [0, 0, 0];
      for (const f of FACES) {
        const SU = SIZE[f.ua], SV = SIZE[f.va], SN = SIZE[f.na];
        const mask = new Int32Array(SU * SV);
        for (let s = 0; s < SN; s++) {
          mask.fill(0);
          for (let b = 0; b < SV; b++) for (let a = 0; a < SU; a++) {
            pos[f.na] = s; pos[f.ua] = a; pos[f.va] = b;
            const x = pos[0], y = pos[1], z = pos[2], id = get(x, y, z); if (!id) continue;
            const bd = D[id]; if (!bd || bd.shape === 'torch') continue;
            const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2], nid = get(nx, ny, nz), nb = D[nid];
            if (nid === id && (bd.liquid || bd.transparent || bd.cutout)) continue;
            if (nb && nb.opaque) continue;
            if (bd.liquid && nb && nb.liquid) continue;
            const tile = tiles[bd.tex[f.t]] || 0, low = bd.liquid && get(x, y + 1, z) !== id ? 1 : 0, glow = bd.glow ? 1 : 0, trans = bd.transparent ? 1 : 0;
            // ombre aux coins
            const ao = [3, 3, 3, 3];
            if (!glow && !bd.liquid && !fast) for (let k = 0; k < 4; k++) {
              const du = k === 1 || k === 2 ? 1 : -1, dv = k >= 2 ? 1 : -1;
              const s1 = opaq(nx + f.u[0] * du, ny + f.u[1] * du, nz + f.u[2] * du), s2 = opaq(nx + f.v[0] * dv, ny + f.v[1] * dv, nz + f.v[2] * dv);
              const cr = opaq(nx + f.u[0] * du + f.v[0] * dv, ny + f.u[1] * du + f.v[1] * dv, nz + f.u[2] * du + f.v[2] * dv);
              ao[k] = s1 && s2 ? 0 : 3 - s1 - s2 - cr;
            }
            const q = v => fast ? Math.round(v * 3) * 5 : Math.round(v * 15), sq = glow ? 15 : q(sky(nx, ny, nz)), bq = glow ? 15 : q(blk(nx, ny, nz));
            const uniform = ao[0] === ao[1] && ao[1] === ao[2] && ao[2] === ao[3];
            if (!uniform || (low && f.na !== 1)) { emit(f, x, y, z, 1, 1, tile, ao, sq, bq, glow, low, trans, true); continue; }
            mask[a + b * SU] = 1 + tile + (ao[0] << 8) + (sq << 10) + (bq << 14) + (glow << 18) + (low << 19) + (trans << 20);
          }
          // fusion gloutonne
          for (let b = 0; b < SV; b++) for (let a = 0; a < SU;) {
            const k = mask[a + b * SU]; if (!k) { a++; continue; }
            let w = 1; while (a + w < SU && mask[a + w + b * SU] === k) w++;
            let h = 1; grow: while (b + h < SV) { for (let q = 0; q < w; q++) if (mask[a + q + (b + h) * SU] !== k) break grow; h++; }
            for (let hh = 0; hh < h; hh++) for (let q = 0; q < w; q++) mask[a + q + (b + hh) * SU] = 0;
            const v = k - 1, tile = v & 255, ao0 = (v >> 8) & 3, sq = (v >> 10) & 15, bq = (v >> 14) & 15, glow = (v >> 18) & 1, low = (v >> 19) & 1, trans = (v >> 20) & 1;
            pos[f.na] = s; pos[f.ua] = a; pos[f.va] = b;
            emit(f, pos[0], pos[1], pos[2], w, h, tile, [ao0, ao0, ao0, ao0], sq, bq, glow, low, trans, false, a, b);
            a += w;
          }
        }
      }
      function emit(f, x, y, z, w, h, tile, ao, sq, bq, glow, low, trans, single, a, b) {
        if (a === undefined) { a = [x, y, z][f.ua]; b = [x, y, z][f.va]; }
        const nC = [x, y, z][f.na] + (f.ns > 0 ? 1 : 0), pts = [], lu = [], cols = [];
        for (let k = 0; k < 4; k++) {
          const du = k === 1 || k === 2 ? 1 : 0, dv = k >= 2 ? 1 : 0, q = [0, 0, 0];
          q[f.na] = nC; q[f.ua] = f.us > 0 ? (du ? a + w : a) : (du ? a : a + w); q[f.va] = f.vs > 0 ? (dv ? b + h : b) : (dv ? b : b + h);
          if (low) { if (f.na === 1 && f.ns > 0) q[1] -= 0.12; else if (f.na !== 1 && q[1] === y + 1) q[1] -= 0.12; }
          pts.push(q); lu.push([du * w, dv * h]); cols.push(glow ? 1 : f.sh * AO[ao[k]]);
        }
        const lit = glow ? [2, 1] : [sq / 15, bq / 15];
        quad(trans ? out.t : out.o, pts, lu, tile, cols, lit, single && ao[0] + ao[2] < ao[1] + ao[3]);
      }
      // torches (forme spéciale, non fusionnée)
      const tt = tiles.torch || 0;
      for (let y = 0; y < H; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
        if (get(x, y, z) !== B.TORCHE) continue;
        const a = 7 / 16, b2 = 9 / 16, hh = 10 / 16, Pt = (px, py, pz) => [x + px, y + py, z + pz], one = [1, 1, 1, 1], L = [2, 1];
        const side = [[a, 0], [b2, 0], [b2, hh], [a, hh]], topu = [[a, 8 / 16], [b2, 8 / 16], [b2, hh], [a, hh]];
        quad(out.o, [Pt(b2, 0, b2), Pt(b2, 0, a), Pt(b2, hh, a), Pt(b2, hh, b2)], side, tt, one, L);
        quad(out.o, [Pt(a, 0, a), Pt(a, 0, b2), Pt(a, hh, b2), Pt(a, hh, a)], side, tt, one, L);
        quad(out.o, [Pt(a, 0, b2), Pt(b2, 0, b2), Pt(b2, hh, b2), Pt(a, hh, b2)], side, tt, one, L);
        quad(out.o, [Pt(b2, 0, a), Pt(a, 0, a), Pt(a, hh, a), Pt(b2, hh, a)], side, tt, one, L);
        quad(out.o, [Pt(a, hh, b2), Pt(b2, hh, b2), Pt(b2, hh, a), Pt(a, hh, a)], topu, tt, one, L);
      }
      return { o: finish(out.o), t: finish(out.t) };
    },
  };
})();

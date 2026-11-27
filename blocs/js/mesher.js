/* ===== mesher.js : maillage d'un chunk (sans DOM : tourne dans le Worker)
   - lumière voxel 0..15 calculée sur un volume avec P = 14 blocs de marge :
       · lumière du ciel : colonnes éclairées depuis le haut (l'eau et le feuillage l'atténuent), puis remplissage
         en largeur (BFS par paliers) dans les grottes, sous les surplombs, dans les abris → l'intérieur devient sombre
       · lumière des blocs (torche 14, lave et lumicristal 13, braisier et portail 11) propagée de la même façon
   - lumière lissée par sommet (moyenne des 4 cases qui touchent le coin) + occlusion ambiante par sommet
   - greedy meshing : les faces voisines identiques (même tuile, même ombre, même lumière) sont fusionnées en rectangles
   - formes spéciales non fusionnées : torche, plantes en croix (2 quads diagonaux), cactus (un peu plus fin)
   Entrée : vol = Uint8Array W × 64 × W (W = 16 + 2P), tiles = { nom: index }, origins = [[u0, v0], …], fast, ox/oz = coin du chunk
   Sortie : { o: buffers opaques (+ lumineux), t: buffers transparents } en tableaux typés transférables
   Attribut « l » (3 nombres par sommet) : lumière du ciel 0..1, lumière des blocs 0..1 (x = 2 : bloc lumineux), animation
     (0 rien, 1 feuillage qui se balance, 2 sommet haut d'une plante, 3 surface de l'eau, 4 autre face d'eau) ===== */
(function () {
  const VX = self.VX, D = VX.BLOCKS, B = VX.B;
  const CS = 16, H = 64, P = 14, W = CS + 2 * P, WW = W * W, NV = WW * H;
  VX.MESH_PAD = P; VX.MESH_W = W;
  const AO = [0.48, 0.64, 0.82, 1];
  // faces : normale, axes u/v (u × v = normale), ombrage ; dN/dU/dV : décalages d'index dans le volume
  const FACES = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], sh: 0.8, t: 'side' },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], sh: 0.8, t: 'side' },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], sh: 0.68, t: 'side' },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], sh: 0.68, t: 'side' },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], sh: 1, t: 'top' },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], sh: 0.55, t: 'bottom' },
  ].map(f => {
    const ax = a => a.findIndex(c => c !== 0), off = a => a[0] + a[2] * W + a[1] * WW;
    return Object.assign(f, { na: ax(f.n), ns: f.n[ax(f.n)], ua: ax(f.u), us: f.u[ax(f.u)], va: ax(f.v), vs: f.v[ax(f.v)], dN: off(f.n), dU: off(f.u), dV: off(f.v) });
  });
  const SIZE = [CS, H, CS];
  const FRONT_ORDER = [2, 3, 0, 1];   // face avant d'un coffre : la première face dégagée dans cet ordre (+z, -z, +x, -x)

  /* ---------- tables par id (tableaux typés : bien plus rapides que les objets dans les boucles) ---------- */
  const OPQ = new Uint8Array(256), AOQ = new Uint8Array(256), BLK = new Uint8Array(256), EMI = new Uint8Array(256), SHD = new Uint8Array(256);
  let tablesOk = false;
  function tables() {
    if (tablesOk) return; tablesOk = true;
    for (let id = 0; id < 256; id++) {
      const b = D[id]; if (!b) continue;
      OPQ[id] = b.opaque ? 1 : 0;                 // cache la face voisine
      AOQ[id] = b.opaque && !b.liquid ? 1 : 0;    // assombrit les coins
      BLK[id] = b.opaque ? 1 : 0;                 // arrête la lumière
      EMI[id] = b.light || 0;                     // lumière émise
      SHD[id] = b.liquid ? 1 : b.shade ? 2 : 0;   // atténuation du ciel en demi-niveaux (eau : 1 niveau tous les 2 blocs)
    }
  }
  // animation par tuile (dépend de l'atlas : recalculée si les tuiles changent)
  let animTiles = null, animFor = null, waterTile = -1;
  function anims(tiles) {
    if (animFor === tiles) return; animFor = tiles; animTiles = new Uint8Array(256);
    for (const b of D) if (b && b.tex && b.leaves) for (const k of ['top', 'side', 'bottom']) animTiles[tiles[b.tex[k]] || 0] = 1;
    waterTile = tiles[D[B.EAU].tex.top];
  }

  /* ---------- lumière voxel ---------- */
  const SKY = new Uint8Array(NV), BL = new Uint8Array(NV), TOPC = new Int16Array(WW), FULLC = new Int16Array(WW);
  const BK = []; for (let i = 0; i < 16; i++) BK.push([]);
  // remplissage par paliers décroissants : chaque case est fixée la première fois qu'elle est atteinte (pas de retraitement)
  function propagate(L, vol) {
    for (let lv = 15; lv > 1; lv--) {
      const q = BK[lv], nl = lv - 1, nq = BK[nl];
      for (let k = 0; k < q.length; k++) {
        const v = q[k]; if (L[v] !== lv) continue;
        const x = v % W, z = ((v / W) | 0) % W, y = (v / WW) | 0; let j;
        if (x > 0 && L[j = v - 1] < nl && !BLK[vol[j]]) { L[j] = nl; nq.push(j); }
        if (x < W - 1 && L[j = v + 1] < nl && !BLK[vol[j]]) { L[j] = nl; nq.push(j); }
        if (z > 0 && L[j = v - W] < nl && !BLK[vol[j]]) { L[j] = nl; nq.push(j); }
        if (z < W - 1 && L[j = v + W] < nl && !BLK[vol[j]]) { L[j] = nl; nq.push(j); }
        if (y > 0 && L[j = v - WW] < nl && !BLK[vol[j]]) { L[j] = nl; nq.push(j); }
        if (y < H - 1 && L[j = v + WW] < nl && !BLK[vol[j]]) { L[j] = nl; nq.push(j); }
      }
      q.length = 0;
    }
    BK[1].length = 0; BK[0].length = 0;
  }
  function computeLight(vol, dim) {
    if (dim === 'braises') SKY.fill(15);   // les Braises baignent dans une lueur diffuse (teintée par le renderer)
    else {
      SKY.fill(0);
      // 1) colonnes : la lumière descend sans perte dans l'air, s'atténue dans l'eau et le feuillage, s'arrête sur un bloc opaque
      for (let c = 0; c < WW; c++) {
        let acc = 0, y = H - 1, full = H;
        for (; y >= 0; y--) {
          const v = c + y * WW, id = vol[v]; if (BLK[id]) break;
          acc += SHD[id]; const L = 15 - (acc >> 1);
          SKY[v] = L > 0 ? L : 0; if (L === 15) full = y;
        }
        TOPC[c] = y; FULLC[c] = full;
      }
      // 2) graines : seules les cases qui peuvent éclairer une colonne voisine plus sombre
      for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
        const c = x + z * W; let hi = 0;
        if (x > 0 && FULLC[c - 1] > hi) hi = FULLC[c - 1];
        if (x < W - 1 && FULLC[c + 1] > hi) hi = FULLC[c + 1];
        if (z > 0 && FULLC[c - W] > hi) hi = FULLC[c - W];
        if (z < W - 1 && FULLC[c + W] > hi) hi = FULLC[c + W];
        if (FULLC[c] > hi) hi = FULLC[c];
        for (let y = TOPC[c] + 1; y < hi; y++) { const v = c + y * WW, L = SKY[v]; if (L > 1) BK[L].push(v); }
        if (hi < H && hi > TOPC[c]) { const v = c + hi * WW; if (SKY[v] > 1) BK[SKY[v]].push(v); }
      }
      propagate(SKY, vol);
    }
    // 3) lumière des blocs
    BL.fill(0);
    for (let v = 0; v < NV; v++) { const e = EMI[vol[v]]; if (e) { BL[v] = e; BK[e].push(v); } }
    propagate(BL, vol);
  }

  function makeBuf() { return { p: [], u: [], t: [], c: [], l: [], i: [] }; }
  function finish(b) {
    const nv = b.p.length / 3;
    return { p: new Float32Array(b.p), u: new Float32Array(b.u), t: new Float32Array(b.t), c: new Float32Array(b.c), l: new Float32Array(b.l), i: nv > 65535 ? new Uint32Array(b.i) : new Uint16Array(b.i) };
  }

  VX.Mesher = {
    // fast : sans ombre aux coins ni lumière lissée, lumière en 4 paliers → fusion maximale
    build(vol, dim, tiles, origins, fast, ox, oz) {
      tables(); anims(tiles); ox = ox || 0; oz = oz || 0;
      computeLight(vol, dim);
      const vi = (x, y, z) => (x + P) + (z + P) * W + y * WW;
      const out = { o: makeBuf(), t: makeBuf() };
      // un quad : coins (du,dv) = (0,0) (1,0) (1,1) (0,1) ; L = 12 nombres (lumière ciel, blocs, animation par coin)
      const quad = (buf, pts, lu, tile, cols, L, flip) => {
        const b = buf.p.length / 3, o = origins[tile];
        for (let k = 0; k < 4; k++) { const q = pts[k]; buf.p.push(q[0], q[1], q[2]); buf.u.push(lu[k][0], lu[k][1]); buf.t.push(o[0], o[1]); buf.c.push(cols[k], cols[k], cols[k]); buf.l.push(L[k * 3], L[k * 3 + 1], L[k * 3 + 2]); }
        if (flip) buf.i.push(b + 1, b + 2, b + 3, b + 1, b + 3, b); else buf.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
      };
      const animOf = (tile, f) => tile === waterTile ? (f.na === 1 && f.ns > 0 ? 3 : 4) : animTiles[tile];
      // face avant d'un bloc orienté (coffre)
      const frontFace = v => { for (const fi of FRONT_ORDER) if (!OPQ[vol[v + FACES[fi].dN]]) return fi; return 2; };
      const pos = [0, 0, 0], ao = [3, 3, 3, 3], sq = [0, 0, 0, 0], bq = [0, 0, 0, 0];
      for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi], SU = SIZE[f.ua], SV = SIZE[f.va], SN = SIZE[f.na];
        const mask = new Int32Array(SU * SV);
        for (let s = 0; s < SN; s++) {
          mask.fill(0);
          for (let b = 0; b < SV; b++) for (let a = 0; a < SU; a++) {
            pos[f.na] = s; pos[f.ua] = a; pos[f.va] = b;
            const x = pos[0], y = pos[1], z = pos[2], v = vi(x, y, z), id = vol[v]; if (!id) continue;
            const bd = D[id]; if (!bd || bd.shape) continue;
            const ny = y + f.n[1], nv = v + f.dN, nid = ny >= H ? 0 : ny < 0 ? B.SOCLE : vol[nv];
            if (nid === id && (bd.liquid || bd.transparent || bd.cutout)) continue;
            if (OPQ[nid]) continue;
            const nb = D[nid];
            if (bd.liquid && nb && nb.liquid) continue;
            let tex = bd.tex[f.t]; if (bd.tex.front && fi < 4 && frontFace(v) === fi) tex = bd.tex.front;
            const tile = tiles[tex] || 0, low = bd.liquid && (y + 1 >= H || vol[v + WW] !== id) ? 1 : 0, glow = bd.glow ? 1 : 0, trans = bd.transparent ? 1 : 0;
            let uniform = true;
            if (glow || ny >= H) { for (let k = 0; k < 4; k++) { ao[k] = 3; sq[k] = glow ? 15 : 15; bq[k] = glow ? 15 : 0; } }
            else if (fast) {
              const s5 = Math.round(SKY[nv] / 5) * 5, b5 = Math.round(BL[nv] / 5) * 5;
              for (let k = 0; k < 4; k++) { ao[k] = 3; sq[k] = s5; bq[k] = b5; }
            } else {
              const s0 = SKY[nv], b0 = BL[nv];
              for (let k = 0; k < 4; k++) {
                const du = k === 1 || k === 2 ? 1 : -1, dv = k >= 2 ? 1 : -1;
                const y1 = ny + f.u[1] * du, y2 = ny + f.v[1] * dv, y3 = y1 + f.v[1] * dv;
                const c1 = nv + f.dU * du, c2 = nv + f.dV * dv, c3 = c1 + f.dV * dv;
                const i1 = y1 < 0 ? B.SOCLE : y1 >= H ? 0 : vol[c1], i2 = y2 < 0 ? B.SOCLE : y2 >= H ? 0 : vol[c2], i3 = y3 < 0 ? B.SOCLE : y3 >= H ? 0 : vol[c3];
                // ombre aux coins
                if (bd.liquid) ao[k] = 3;
                else { const o1 = AOQ[i1], o2 = AOQ[i2], o3 = AOQ[i3]; ao[k] = o1 && o2 ? 0 : 3 - o1 - o2 - o3; }
                // lumière lissée : moyenne des cases ouvertes autour du coin
                let ss = s0, sb = b0, cnt = 1;
                const open1 = !BLK[i1], open2 = !BLK[i2];
                if (open1) { ss += y1 >= H ? 15 : SKY[c1]; sb += y1 >= H ? 0 : BL[c1]; cnt++; }
                if (open2) { ss += y2 >= H ? 15 : SKY[c2]; sb += y2 >= H ? 0 : BL[c2]; cnt++; }
                if ((open1 || open2) && !BLK[i3]) { ss += y3 >= H ? 15 : SKY[c3]; sb += y3 >= H ? 0 : BL[c3]; cnt++; }
                sq[k] = Math.round(ss / cnt); bq[k] = Math.round(sb / cnt);
              }
              uniform = ao[0] === ao[1] && ao[1] === ao[2] && ao[2] === ao[3] && sq[0] === sq[1] && sq[1] === sq[2] && sq[2] === sq[3] && bq[0] === bq[1] && bq[1] === bq[2] && bq[2] === bq[3];
            }
            if (!uniform || (low && f.na !== 1)) { emit(f, x, y, z, 1, 1, tile, ao, sq, bq, glow, low, trans, true); continue; }
            mask[a + b * SU] = 1 + tile + (ao[0] << 8) + (sq[0] << 10) + (bq[0] << 14) + (glow << 18) + (low << 19) + (trans << 20);
          }
          // fusion gloutonne
          for (let b = 0; b < SV; b++) for (let a = 0; a < SU;) {
            const k = mask[a + b * SU]; if (!k) { a++; continue; }
            let w = 1; while (a + w < SU && mask[a + w + b * SU] === k) w++;
            let h = 1; grow: while (b + h < SV) { for (let q = 0; q < w; q++) if (mask[a + q + (b + h) * SU] !== k) break grow; h++; }
            for (let hh = 0; hh < h; hh++) for (let q = 0; q < w; q++) mask[a + q + (b + hh) * SU] = 0;
            const v = k - 1, tile = v & 255, ao0 = (v >> 8) & 3, s0 = (v >> 10) & 15, b0 = (v >> 14) & 15, glow = (v >> 18) & 1, low = (v >> 19) & 1, trans = (v >> 20) & 1;
            pos[f.na] = s; pos[f.ua] = a; pos[f.va] = b;
            emit(f, pos[0], pos[1], pos[2], w, h, tile, [ao0, ao0, ao0, ao0], [s0, s0, s0, s0], [b0, b0, b0, b0], glow, low, trans, false, a, b);
            a += w;
          }
        }
      }
      function emit(f, x, y, z, w, h, tile, ao, sq, bq, glow, low, trans, single, a, b) {
        if (a === undefined) { a = [x, y, z][f.ua]; b = [x, y, z][f.va]; }
        const nC = [x, y, z][f.na] + (f.ns > 0 ? 1 : 0), pts = [], lu = [], cols = [], L = [], an = animOf(tile, f), br = [];
        for (let k = 0; k < 4; k++) {
          const du = k === 1 || k === 2 ? 1 : 0, dv = k >= 2 ? 1 : 0, q = [0, 0, 0];
          q[f.na] = nC; q[f.ua] = f.us > 0 ? (du ? a + w : a) : (du ? a : a + w); q[f.va] = f.vs > 0 ? (dv ? b + h : b) : (dv ? b : b + h);
          if (low) { if (f.na === 1 && f.ns > 0) q[1] -= 0.12; else if (f.na !== 1 && q[1] === y + 1) q[1] -= 0.12; }
          pts.push(q); lu.push([du * w, dv * h]); cols.push(glow ? 1 : f.sh * AO[ao[k]]);
          if (glow) L.push(2, 1, an); else L.push(sq[k] / 15, bq[k] / 15, an);
          br.push(AO[ao[k]] * (0.2 + Math.max(sq[k], bq[k])));
        }
        quad(trans ? out.t : out.o, pts, lu, tile, cols, L, single && br[0] + br[2] < br[1] + br[3]);
      }

      /* ---------- formes spéciales (non fusionnées) ---------- */
      const tt = tiles.torch || 0, LG = [2, 1, 0, 2, 1, 0, 2, 1, 0, 2, 1, 0];
      for (let y = 0; y < H; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
        const v = vi(x, y, z), id = vol[v], bd = D[id]; if (!bd || !bd.shape) continue;
        const Pt = (px, py, pz) => [x + px, y + py, z + pz];
        if (bd.shape === 'torch') {
          // hauteur 11/16 ; la tuile (manche + flamme, 14 pixels) y est un peu étirée pour que la flamme soit visible
          const a = 7 / 16, b2 = 9 / 16, hh = 11 / 16, tv = 14 / 16, one = [1, 1, 1, 1];
          const side = [[a, 0], [b2, 0], [b2, tv], [a, tv]], topu = [[a, 11 / 16], [b2, 11 / 16], [b2, 13 / 16], [a, 13 / 16]];
          quad(out.o, [Pt(b2, 0, b2), Pt(b2, 0, a), Pt(b2, hh, a), Pt(b2, hh, b2)], side, tt, one, LG);
          quad(out.o, [Pt(a, 0, a), Pt(a, 0, b2), Pt(a, hh, b2), Pt(a, hh, a)], side, tt, one, LG);
          quad(out.o, [Pt(a, 0, b2), Pt(b2, 0, b2), Pt(b2, hh, b2), Pt(a, hh, b2)], side, tt, one, LG);
          quad(out.o, [Pt(b2, 0, a), Pt(a, 0, a), Pt(a, hh, a), Pt(b2, hh, a)], side, tt, one, LG);
          quad(out.o, [Pt(a, hh, b2), Pt(b2, hh, b2), Pt(b2, hh, a), Pt(a, hh, a)], topu, tt, one, LG);
        } else if (bd.shape === 'cross') {
          // plante : 2 quads diagonaux, visibles des deux côtés, légèrement décalés au hasard (stable) ; le haut se balance
          const tile = tiles[bd.tex.side] || 0, s = SKY[v] / 15, l = BL[v] / 15, hsh = VX.hash(ox + x, y, oz + z, 99);
          const jx = (hsh - 0.5) * 0.3, jz = ((hsh * 7.31) % 1 - 0.5) * 0.3, e = 0.05, lo = e, hi = 1 - e, c = 0.94 - (hsh * 13.7 % 1) * 0.1;
          const L = [s, l, 0, s, l, 0, s, l, 2, s, l, 2], cols = [c, c, c, c], uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
          const A = (px, py, pz) => Pt(px + jx, py, pz + jz);
          for (const [x0, z0, x1, z1] of [[lo, lo, hi, hi], [lo, hi, hi, lo]]) {
            quad(out.o, [A(x0, 0, z0), A(x1, 0, z1), A(x1, 1, z1), A(x0, 1, z0)], uv, tile, cols, L);
            quad(out.o, [A(x1, 0, z1), A(x0, 0, z0), A(x0, 1, z0), A(x1, 1, z1)], uv, tile, cols, L);
          }
        } else if (bd.shape === 'cactus') {
          // cactus : côtés rentrés de 1/16 ; dessus et dessous seulement s'ils sont visibles
          const e = 1 / 16, f1 = 1 - e, s = SKY[v] / 15, l = BL[v] / 15, L = [s, l, 0, s, l, 0, s, l, 0, s, l, 0];
          const ts = tiles[bd.tex.side] || 0, sh = k => [FACES[k].sh, FACES[k].sh, FACES[k].sh, FACES[k].sh], uv = [[0, 0], [1, 0], [1, 1], [0, 1]], ui = [[e, e], [f1, e], [f1, f1], [e, f1]];
          const nb = (k, yy) => yy < 0 || (yy < H && OPQ[vol[v + FACES[k].dN]]);
          if (!nb(0, y)) quad(out.o, [Pt(f1, 0, 1), Pt(f1, 0, 0), Pt(f1, 1, 0), Pt(f1, 1, 1)], uv, ts, sh(0), L);
          if (!nb(1, y)) quad(out.o, [Pt(e, 0, 0), Pt(e, 0, 1), Pt(e, 1, 1), Pt(e, 1, 0)], uv, ts, sh(1), L);
          if (!nb(2, y)) quad(out.o, [Pt(0, 0, f1), Pt(1, 0, f1), Pt(1, 1, f1), Pt(0, 1, f1)], uv, ts, sh(2), L);
          if (!nb(3, y)) quad(out.o, [Pt(1, 0, e), Pt(0, 0, e), Pt(0, 1, e), Pt(1, 1, e)], uv, ts, sh(3), L);
          const up = y + 1 >= H ? 0 : vol[v + WW], dn = y - 1 < 0 ? B.SOCLE : vol[v - WW];
          if (up !== id && !OPQ[up]) { const us = y + 1 >= H ? 1 : SKY[v + WW] / 15, ul = y + 1 >= H ? 0 : BL[v + WW] / 15; quad(out.o, [Pt(e, 1, f1), Pt(f1, 1, f1), Pt(f1, 1, e), Pt(e, 1, e)], ui, tiles[bd.tex.top] || 0, sh(4), [us, ul, 0, us, ul, 0, us, ul, 0, us, ul, 0]); }
          if (dn !== id && !OPQ[dn]) quad(out.o, [Pt(e, 0, e), Pt(f1, 0, e), Pt(f1, 0, f1), Pt(e, 0, f1)], ui, tiles[bd.tex.bottom] || 0, sh(5), L);
        }
      }
      return { o: finish(out.o), t: finish(out.t) };
    },
    // lumière d'une case du dernier volume maillé (débogage) : [ciel, blocs]
    _light(x, y, z) { const v = (x + P) + (z + P) * W + y * WW; return [SKY[v], BL[v]]; },
  };
})();

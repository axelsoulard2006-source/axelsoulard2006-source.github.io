/* ===== world.js : cartes à étages (grille de cellules × étages), physique, navigation, maillage =====
   Une carte = W×H cellules de 2 m, F étages de 4 m. Chaque (étage, cellule) vaut :
     VOID  : rien (vide au-dessus d'un étage inférieur : on peut y tomber)
     FLOOR : dalle praticable à y = étage × 4 m
     WALL  : mur plein sur toute la hauteur de l'étage
     RAMP  : escalier / rampe qui monte vers l'étage supérieur
   Les objets (voitures, bancs, caisses…) sont des boîtes sur lesquelles on peut sauter.          */
(function () {
  const BR = window.BR;
  const W_ = (BR.World = {});
  const C = 2, SH = 4, STEP = 0.55, SLAB = 0.3, BODY = 1.75;
  const VOID = 0, FLOOR = 1, WALL = 2, RAMP = 3;
  Object.assign(W_, { C, SH, STEP, SLAB, BODY, VOID, FLOOR, WALL, RAMP });
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

  /* =====================================================================
     CRÉATION
     ===================================================================== */
  function newMap(kind, def, W, H, F, seed) {
    const N = W * H;
    const out = kind === 'city' || !!(def && def.outdoor);   // def.outdoor : carte à ciel ouvert (pluie/orage possibles)
    const m = { kind, id: def.id, theme: def.theme, W, H, F, SH, WH: N, seed, outdoor: out, t: [], zone: [], indoor: [], rampAt: [], propAt: [], ramps: [], props: [], lights: [], signs: [] };
    for (let f = 0; f < F; f++) {
      m.t.push(new Uint8Array(N).fill(WALL)); m.zone.push(new Uint8Array(N)); m.indoor.push(new Uint8Array(N).fill(out ? 0 : 1));
      m.rampAt.push(new Int16Array(N).fill(-1)); m.propAt.push(new Int16Array(N).fill(-1));
    }
    return m;
  }
  const inb = (m, x, y) => x >= 0 && y >= 0 && x < m.W && y < m.H;
  function set(m, f, x, y, t, z) { if (!inb(m, x, y)) return; const i = y * m.W + x; m.t[f][i] = t; if (z != null) m.zone[f][i] = z; }
  function rect(m, f, x0, y0, x1, y1, t, z) { for (let y = Math.max(0, y0); y <= Math.min(m.H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(m.W - 1, x1); x++) set(m, f, x, y, t, z); }
  W_.cellOf = (m, x, z) => ({ cx: Math.floor(x / C), cy: Math.floor(z / C) });
  W_.center = (cx, cy) => ({ x: (cx + 0.5) * C, z: (cy + 0.5) * C });

  /* ---------- rampes ---------- */
  function rampH(r, x, z) {
    let s = (x - r.sx) * r.dx + (z - r.sz) * r.dy;
    s = s < 0 ? 0 : s > r.L * C ? r.L * C : s;
    return r.f * SH + SH * s / (r.L * C);
  }
  W_.rampH = rampH;
  // vérifie / pose une rampe de L cellules sur l'étage f, de (x0,y0) dans la direction (dx,dy)
  function addRamp(m, f, x0, y0, dx, dy, L, opt) {
    opt = opt || {};
    if (f + 1 >= m.F) return false;
    const cells = [];
    for (let k = 0; k < L; k++) {
      const x = x0 + dx * k, y = y0 + dy * k; if (!inb(m, x, y)) return false;
      const i = y * m.W + x;
      if (m.t[f][i] !== FLOOR || m.propAt[f][i] >= 0 || m.rampAt[f][i] >= 0) return false;
      if (m.rampAt[f + 1][i] >= 0) return false;
      cells.push(i);
    }
    const ax = x0 - dx, ay = y0 - dy, ex = x0 + dx * L, ey = y0 + dy * L;
    if (!inb(m, ax, ay) || !inb(m, ex, ey)) return false;
    const ai = ay * m.W + ax, li = ey * m.W + ex;
    if (m.t[f][ai] !== FLOOR || m.rampAt[f][ai] >= 0 || m.propAt[f][ai] >= 0) return false;
    if (m.t[f + 1][li] !== FLOOR) { if (opt.carve && m.t[f + 1][li] === WALL && ex > 0 && ey > 0 && ex < m.W - 1 && ey < m.H - 1) { m.t[f + 1][li] = FLOOR; m.zone[f + 1][li] = opt.zone || 0; } else return false; }
    if (m.rampAt[f + 1][li] >= 0 || m.propAt[f + 1][li] >= 0) return false;
    if (opt.dry) return true;
    const r = { f, cells, dx, dy, L, x0, y0, sx: (x0 + 0.5) * C - dx * C / 2, sz: (y0 + 0.5) * C - dy * C / 2, landing: li, approach: ai, dead: false, id: m.ramps.length };
    for (const i of cells) { m.t[f][i] = RAMP; m.rampAt[f][i] = r.id; if (opt.zone != null) m.zone[f][i] = opt.zone; m.t[f + 1][i] = VOID; }
    m.ramps.push(r);
    return true;
  }
  W_.addRamp = addRamp;

  /* ---------- objets (boîtes) ---------- */
  function addProp(m, f, cx, cy, kind, h, w, d, o) {
    if (!inb(m, cx, cy)) return null;
    const i = cy * m.W + cx;
    if (m.t[f][i] !== FLOOR || m.propAt[f][i] >= 0 || m.rampAt[f][i] >= 0) return null;
    o = o || {};
    const x = (cx + 0.5) * C + (o.ox || 0), z = (cy + 0.5) * C + (o.oz || 0);
    const p = { f, cx, cy, i, kind, h, w, d, x, z, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, base: f * SH, rot: o.rot || 0, color: o.color, link: o.link, part: o.part || 0, id: m.props.length };
    // nodraw : objet dessiné par le décor de la carte (BR.World.decor), pas par propMesh ; data : infos libres pour ce décor
    if (o.nodraw) p.nodraw = true;
    if (o.data != null) p.data = o.data;
    m.props.push(p); m.propAt[f][i] = p.id;
    return p;
  }
  W_.addProp = addProp;
  // cellule libre pour un objet (pas d'approche / arrivée de rampe)
  function freeCell(m, f, i) {
    if (m.t[f][i] !== FLOOR || m.propAt[f][i] >= 0 || m.rampAt[f][i] >= 0) return false;
    for (const r of m.ramps) if (!r.dead && ((r.f === f && r.approach === i) || (r.f + 1 === f && r.landing === i))) return false;
    return true;
  }

  /* =====================================================================
     PHYSIQUE (joueurs et entités)
     ===================================================================== */
  // surface d'appui la plus haute ≤ y + STEP au point (x,z)
  W_.support = function (m, x, z, y, r, step) {
    const cx = Math.floor(x / C), cy = Math.floor(z / C);
    if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return -Infinity;
    const i = cy * m.W + cx, lim = y + (step == null ? STEP : step);
    let best = -Infinity;
    for (let f = 0; f < m.F; f++) {
      const t = m.t[f][i];
      let s;
      if (t === FLOOR) s = f * SH; else if (t === RAMP) s = rampH(m.ramps[m.rampAt[f][i]], x, z); else continue;
      if (s <= lim && s > best) best = s;
    }
    const e = (r || 0.3) * 0.7;
    for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= m.W || yy >= m.H) continue;
      const j = yy * m.W + xx;
      for (let f = 0; f < m.F; f++) {
        const pi = m.propAt[f][j]; if (pi < 0) continue;
        const P = m.props[pi];
        if (x > P.x0 - e && x < P.x1 + e && z > P.z0 - e && z < P.z1 + e) { const top = P.base + P.h; if (top <= lim && top > best) best = top; }
      }
    }
    return best;
  };
  W_.blocked = function (m, x, z, y, r) {
    if (x < r || z < r || x > m.W * C - r || z > m.H * C - r) return true;
    const lo = y + STEP, hi = y + BODY;
    const x0 = Math.floor((x - r) / C), x1 = Math.floor((x + r) / C), y0 = Math.floor((z - r) / C), y1 = Math.floor((z + r) / C);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return true;
      const nx = x < cx * C ? cx * C : x > cx * C + C ? cx * C + C : x, nz = z < cy * C ? cy * C : z > cy * C + C ? cy * C + C : z;
      if ((x - nx) * (x - nx) + (z - nz) * (z - nz) >= r * r) continue;
      const i = cy * m.W + cx;
      for (let f = 0; f < m.F; f++) {
        if (m.t[f][i] !== WALL) {
          // tranche d'une dalle : la tête ne peut pas s'enfoncer dans le bord d'un étage quand on monte un escalier (sinon on voit à travers)
          if (f > 0 && (m.t[f][i] === FLOOR || m.t[f][i] === RAMP) && y < f * SH - 0.5 && y > f * SH - 2.05) return true;
          continue;
        }
        const wb = f === 0 ? -99 : f * SH - SLAB, wt = f === m.F - 1 ? 999 : (f + 1) * SH;
        if (hi > wb && lo < wt) return true;
      }
    }
    for (let cy = y0 - 1; cy <= y1 + 1; cy++) for (let cx = x0 - 1; cx <= x1 + 1; cx++) {
      if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) continue;
      const j = cy * m.W + cx;
      for (let f = 0; f < m.F; f++) {
        const pi = m.propAt[f][j]; if (pi < 0) continue;
        const P = m.props[pi];
        if (P.base + P.h <= lo || P.base >= hi) continue;
        const nx = x < P.x0 ? P.x0 : x > P.x1 ? P.x1 : x, nz = z < P.z0 ? P.z0 : z > P.z1 ? P.z1 : z;
        if ((x - nx) * (x - nx) + (z - nz) * (z - nz) < r * r) return true;
      }
    }
    return W_.support(m, x, z, y, r) === -Infinity;      // marche trop haute (flanc de rampe, etc.)
  };
  W_.ceiling = function (m, x, z, y) {
    const cx = Math.floor(x / C), cy = Math.floor(z / C);
    if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return Infinity;
    const i = cy * m.W + cx;
    for (let f = 1; f < m.F; f++) { const b = f * SH - SLAB; if (b > y + 0.3 && m.t[f][i] !== VOID) return b; }
    return m.outdoor ? Infinity : m.F * SH;
  };
  // déplacement horizontal avec glissement le long des obstacles
  W_.move = function (m, b, dx, dz, r) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.2));
    const sx = dx / n, sz = dz / n;
    for (let k = 0; k < n; k++) {
      if (!W_.blocked(m, b.x + sx, b.z, b.y, r)) b.x += sx;
      if (!W_.blocked(m, b.x, b.z + sz, b.y, r)) b.z += sz;
      if (b.ground) { const g = W_.support(m, b.x, b.z, b.y, r); if (g > b.y && g - b.y <= STEP + 0.01) b.y = g; }
    }
  };
  // gravité, atterrissage, plafond ; retourne la vitesse d'impact à l'atterrissage (0 sinon)
  W_.vertical = function (m, b, dt, r, grav) {
    let g = W_.support(m, b.x, b.z, b.y, r);
    if (b.ground && b.vy <= 0) {
      if (g >= b.y - 0.6) { b.y = g; return 0; }
      b.ground = false;
    }
    const prevY = b.y;
    b.vy -= grav * dt; b.y += b.vy * dt;
    // plafond testé sur tout le corps (centre + 4 points du rayon) : la tête ne doit jamais s'enfoncer dans la tranche d'une dalle (vue à travers les murs près des escaliers)
    const q = r * 0.95;
    const c = Math.min(W_.ceiling(m, b.x, b.z, b.y), W_.ceiling(m, b.x + q, b.z, b.y), W_.ceiling(m, b.x - q, b.z, b.y), W_.ceiling(m, b.x, b.z + q, b.y), W_.ceiling(m, b.x, b.z - q, b.y));
    if (b.y + BODY > c) { b.y = c - BODY; if (b.vy > 0) b.vy = 0; }
    // en l'air : on se pose sur la surface la plus haute accessible depuis la hauteur précédente
    // (les entités ne se dirigent pas en vol, elles ne « remontent » donc pas sur le rebord qu'elles viennent de quitter)
    g = W_.support(m, b.x, b.z, prevY, r);
    if (b.y <= g) { const imp = -b.vy; b.y = g; b.vy = 0; b.ground = true; return imp; }
    return 0;
  };
  // ligne de vue 3D (murs, dalles, dessous des rampes)
  W_.los = function (m, x0, y0, z0, x1, y1, z1) {
    const d = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.ceil(d / 0.45);
    for (let k = 1; k < n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
      const cx = Math.floor(x / C), cy = Math.floor(z / C); if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return false;
      const f = Math.floor(y / SH); if (f < 0 || f >= m.F) continue;
      const i = cy * m.W + cx, tt = m.t[f][i];
      if (tt === WALL) return false;
      if (tt === RAMP && y < rampH(m.ramps[m.rampAt[f][i]], x, z) - 0.05) return false;
      if (f + 1 < m.F && y > (f + 1) * SH - SLAB && m.t[f + 1][i] !== VOID) return false;
    }
    return true;
  };

  /* =====================================================================
     NAVIGATION (graphe orienté : marche, rampes, sauts dans le vide)
     ===================================================================== */
  W_.walkable = (m, f, i) => { const t = m.t[f][i]; if (t === RAMP) return true; if (t !== FLOOR) return false; const p = m.propAt[f][i]; return p < 0 || m.props[p].h <= STEP; };
  function buildNav(m) {
    const W = m.W, H = m.H, WH = W * H, N = m.F * WH;
    const walk = new Uint8Array(N);
    for (let f = 0; f < m.F; f++) for (let i = 0; i < WH; i++) if (W_.walkable(m, f, i)) walk[f * WH + i] = 1;
    const fw = [], bw = [];
    for (let n = 0; n < N; n++) { fw.push(null); }
    const edge = (a, b) => { (fw[a] || (fw[a] = [])).push(b); (bw[b] || (bw[b] = [])).push(a); };
    for (let f = 0; f < m.F; f++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, n = f * WH + i;
      if (!walk[n] || m.t[f][i] !== FLOOR) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!walk[f * WH + j] || m.t[f][j] !== FLOOR) continue;
        if (dx && dy && (!walk[f * WH + y * W + nx] || m.t[f][y * W + nx] !== FLOOR || !walk[f * WH + ny * W + x] || m.t[f][ny * W + x] !== FLOOR)) continue;
        edge(n, f * WH + j);
      }
      // sauter dans le vide
      if (f > 0) for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (m.t[f][j] !== VOID) continue;
        for (let g = f - 1; g >= 0; g--) { const tt = m.t[g][j]; if (tt === WALL) break; if ((tt === FLOOR || tt === RAMP) && walk[g * WH + j]) { edge(n, g * WH + j); break; } if (tt !== VOID) break; }
      }
    }
    for (const r of m.ramps) {
      if (r.dead) continue;
      const base = r.f * WH;
      for (let k = 0; k + 1 < r.cells.length; k++) { edge(base + r.cells[k], base + r.cells[k + 1]); edge(base + r.cells[k + 1], base + r.cells[k]); }
      if (walk[base + r.approach]) { edge(base + r.approach, base + r.cells[0]); edge(base + r.cells[0], base + r.approach); }
      const ln = (r.f + 1) * WH + r.landing;
      if (walk[ln]) { edge(base + r.cells[r.cells.length - 1], ln); edge(ln, base + r.cells[r.cells.length - 1]); }
    }
    const csr = lists => { const off = new Int32Array(N + 1); let e = 0; for (let n = 0; n < N; n++) { off[n] = e; e += lists[n] ? lists[n].length : 0; } off[N] = e; const to = new Int32Array(e); for (let n = 0; n < N; n++) if (lists[n]) to.set(lists[n], off[n]); return { off, to }; };
    m.nav = { N, walk, fw: csr(fw), bw: csr(bw) };
  }
  W_.buildNav = buildNav;
  W_.nodePos = function (m, n) {
    const f = Math.floor(n / m.WH), i = n - f * m.WH, cx = i % m.W, cy = (i / m.W) | 0, x = (cx + 0.5) * C, z = (cy + 0.5) * C;
    const t = m.t[f][i];
    return { x, z, y: t === RAMP ? rampH(m.ramps[m.rampAt[f][i]], x, z) : f * SH, f, i, cx, cy };
  };
  // nœud sous un point (la surface praticable la plus haute sous y)
  W_.nodeAt = function (m, x, y, z) {
    const cx = Math.floor(x / C), cy = Math.floor(z / C); if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return -1;
    const i = cy * m.W + cx;
    for (let f = m.F - 1; f >= 0; f--) {
      const t = m.t[f][i]; if (t !== FLOOR && t !== RAMP) continue;
      const s = t === RAMP ? rampH(m.ramps[m.rampAt[f][i]], x, z) : f * SH;
      if (s <= y + 0.9) return f * m.WH + i;
    }
    return -1;
  };
  // champ de distance (en pas) de chaque nœud VERS le nœud but (parcours des arêtes inversées)
  W_.field = function (m, goal, out) {
    const N = m.nav.N, walk = m.nav.walk, bw = m.nav.bw;
    out = out || new Int16Array(N); out.fill(-1);
    if (goal < 0) return out;
    const q = new Int32Array(N); let h = 0, t = 0;
    if (walk[goal]) { out[goal] = 0; q[t++] = goal; }
    else { // but non praticable (joueur sur une caisse) : ses voisins deviennent les buts
      const f = Math.floor(goal / m.WH), i = goal - f * m.WH, cx = i % m.W, cy = (i / m.W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (!inb(m, nx, ny)) continue; const n = f * m.WH + ny * m.W + nx; if (walk[n] && out[n] < 0) { out[n] = 0; q[t++] = n; } }
    }
    while (h < t) {
      const n = q[h++], d = out[n] + 1;
      for (let e = bw.off[n]; e < bw.off[n + 1]; e++) { const p = bw.to[e]; if (out[p] < 0) { out[p] = d; q[t++] = p; } }
    }
    return out;
  };
  // parcours direct (distances DEPUIS un nœud)
  function forward(m, start) {
    const N = m.nav.N, fw = m.nav.fw, out = new Int16Array(N).fill(-1); if (start < 0) return out;
    const q = new Int32Array(N); let h = 0, t = 0; out[start] = 0; q[t++] = start;
    while (h < t) { const n = q[h++], d = out[n] + 1; for (let e = fw.off[n]; e < fw.off[n + 1]; e++) { const p = fw.to[e]; if (out[p] < 0) { out[p] = d; q[t++] = p; } } }
    return out;
  }
  W_.forward = forward;
  W_.neighbors = function (m, n, fn) { const fw = m.nav.fw; for (let e = fw.off[n]; e < fw.off[n + 1]; e++) fn(fw.to[e]); };

  /* =====================================================================
     FINALISATION : cohérence, pièges, fusibles, lumières
     ===================================================================== */
  function enforce(m) {
    const WH = m.WH;
    for (let i = 0; i < WH; i++) if (m.t[0][i] === VOID) m.t[0][i] = WALL;
    // intérieur : une dalle étroite posée sur un mur, avec du vide des deux côtés, laisserait voir par-dessus
    // le mur d'une salle à l'autre -> le mur monte jusqu'au plafond
    if (!m.outdoor) for (let f = 1; f < m.F; f++) for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 1; x++) {
      const i = y * m.W + x; if (m.t[f][i] !== FLOOR || m.t[f - 1][i] !== WALL || m.propAt[f][i] >= 0) continue;
      const v = k => m.t[f][k] === VOID;
      if ((v(i - 1) && v(i + 1)) || (v(i - m.W) && v(i + m.W))) { if (!m.ramps.some(r => !r.dead && r.f + 1 === f && r.landing === i)) m.t[f][i] = WALL; }
    }
    for (let f = 1; f < m.F; f++) for (let i = 0; i < WH; i++) if (m.t[f][i] === VOID && m.t[f - 1][i] === WALL) m.t[f][i] = WALL;
    for (const r of m.ramps) {
      if (r.dead) continue;
      const ok = r.cells.every(i => m.t[r.f][i] === RAMP) && m.t[r.f + 1][r.landing] === FLOOR && m.t[r.f][r.approach] === FLOOR;
      if (!ok) { r.dead = true; for (const i of r.cells) { if (m.t[r.f][i] === RAMP) m.t[r.f][i] = FLOOR; m.rampAt[r.f][i] = -1; } }
    }
    for (let f = 0; f < m.F; f++) for (let i = 0; i < WH; i++) if (m.t[f][i] !== FLOOR && m.propAt[f][i] >= 0) { m.props[m.propAt[f][i]].dead = true; m.propAt[f][i] = -1; }
  }
  function finalize(m, rng, diff) {
    const WH = m.WH;
    m.spawnNode = m.spawn.f * WH + m.spawn.cy * m.W + m.spawn.cx;
    m.exitNode = m.exit.cy * m.W + m.exit.cx;
    for (let it = 0; it < 8; it++) {
      enforce(m); buildNav(m);
      const reach = forward(m, m.spawnNode), toExit = W_.field(m, m.exitNode);
      let traps = 0;
      for (let n = 0; n < m.nav.N; n++) if (reach[n] >= 0 && toExit[n] < 0) {
        const f = Math.floor(n / WH), i = n - f * WH;
        if (m.t[f][i] === RAMP) { const r = m.ramps[m.rampAt[f][i]]; r.dead = true; }
        else { m.t[f][i] = WALL; }
        traps++;
      }
      m.distSpawn = reach;
      if (!traps) break;
    }
    m.props = m.props.filter(p => !p.dead);
    // ré-indexe les objets
    for (let f = 0; f < m.F; f++) m.propAt[f].fill(-1);
    m.props.forEach((p, k) => { p.id = k; m.propAt[p.f][p.i] = k; });
    buildNav(m);
    m.distSpawn = forward(m, m.spawnNode);
    m.reach = []; let maxD = 0;
    for (let n = 0; n < m.nav.N; n++) if (m.distSpawn[n] >= 0 && m.nav.walk[n]) { m.reach.push(n); if (m.distSpawn[n] > maxD) maxD = m.distSpawn[n]; }
    m.maxDist = maxD;
    if (m.reach.length < 200) return false;
    if (m.distSpawn[m.exitNode] < 0) return false;
    // départ : cellules proches du point d'apparition
    m.spawnCells = m.reach.filter(n => n < WH && m.distSpawn[n] <= 4 && m.t[0][n] === FLOOR && m.propAt[0][n] < 0).sort((a, b) => m.distSpawn[a] - m.distSpawn[b]).slice(0, 10).map(n => ({ f: 0, cx: n % m.W, cy: (n / m.W) | 0 }));
    if (m.spawnCells.length < 6) return false;
    // fusibles
    const need = (diff && diff.fuses) || 4;
    const isFree = n => { const f = Math.floor(n / WH), i = n - f * WH; return m.t[f][i] === FLOOR && freeCell(m, f, i); };
    const ex = W_.nodePos(m, m.exitNode);
    let cand = m.reach.filter(n => m.distSpawn[n] >= maxD * 0.22 && isFree(n)).map(n => W_.nodePos(m, n)).filter(p => Math.hypot(p.x - ex.x, p.z - ex.z) > 14);
    BR.shuffle(cand, rng);
    const upper = cand.filter(p => p.f > 0), wantUp = upper.length ? Math.min(Math.ceil(need / 2), upper.length) : 0;
    const fuses = [];
    const far = (p, sep) => fuses.every(q => Math.hypot(q.x - p.x, q.z - p.z, (q.y - p.y) * 2) >= sep);
    for (let sep = 30; sep >= 8 && fuses.length < need; sep -= 4) {
      for (const p of upper) { if (fuses.filter(q => q.f > 0).length >= wantUp || fuses.length >= need) break; if (!fuses.includes(p) && far(p, sep)) fuses.push(p); }
      for (const p of cand) { if (fuses.length >= need) break; if (!fuses.includes(p) && far(p, sep)) fuses.push(p); }
    }
    if (fuses.length < need) return false;
    m.fuses = fuses.map(p => ({ f: p.f, cx: p.cx, cy: p.cy, x: p.x, y: p.y, z: p.z }));
    // apparition des entités : loin du départ
    m.monNodes = m.reach.filter(n => m.distSpawn[n] >= Math.max(14, maxD * 0.4) && m.nav.walk[n]);
    if (m.monNodes.length < 10) m.monNodes = m.reach.slice(-50);
    return true;
  }

  // relie toutes les zones d'un étage à la plus grande en creusant à travers les murs
  function connectLayer(m, f, zone) {
    const W = m.W, H = m.H, WH = W * H, comp = new Int32Array(WH).fill(-1), sizes = [];
    for (let i = 0; i < WH; i++) {
      if (m.t[f][i] !== FLOOR || comp[i] >= 0) continue;
      const id = sizes.length; let n = 0; const st = [i]; comp[i] = id;
      while (st.length) { const c = st.pop(); n++; const x = c % W, y = (c / W) | 0; for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (!inb(m, nx, ny)) continue; const j = ny * W + nx; if (comp[j] < 0 && m.t[f][j] === FLOOR) { comp[j] = id; st.push(j); } } }
      sizes.push(n);
    }
    if (sizes.length <= 1) return;
    const main = sizes.indexOf(Math.max(...sizes));
    for (let id = 0; id < sizes.length; id++) {
      if (id === main) continue;
      // BFS depuis la composante id, à travers les murs (pas le vide), jusqu'à la principale
      const prev = new Int32Array(WH).fill(-2), q = [];
      for (let i = 0; i < WH; i++) if (comp[i] === id) { prev[i] = -1; q.push(i); }
      let hit = -1;
      for (let h = 0; h < q.length && hit < 0; h++) {
        const c = q[h], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
          const j = ny * W + nx; if (prev[j] !== -2) continue;
          if (m.t[f][j] === VOID || m.t[f][j] === RAMP || m.rampAt[f][j] >= 0) continue;
          if (f > 0 && m.t[f - 1][j] === RAMP) continue;
          prev[j] = c; if (comp[j] === main) { hit = j; break; } q.push(j);
        }
      }
      for (let c = hit; c >= 0 && prev[c] !== -1; c = prev[c]) if (m.t[f][c] === WALL) { m.t[f][c] = FLOOR; if (zone != null) m.zone[f][c] = zone; }
      if (hit >= 0) for (let i = 0; i < WH; i++) if (comp[i] === id) comp[i] = main;
    }
  }
  function ceilY(m, f, i) {
    for (let g = f + 1; g < m.F; g++) if (m.t[g][i] !== VOID) return g * SH - SLAB;
    return m.F * SH;
  }
  W_.ceilY = ceilY;
  // néons au plafond, un tous les ~3 m
  function panelLights(m, rng, th, test, step) {
    step = step || 3;
    const taken = new Uint8Array(m.WH * m.F);
    for (let f = 0; f < m.F; f++) for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 1; x++) {
      const i = y * m.W + x;
      if ((m.t[f][i] !== FLOOR && m.t[f][i] !== RAMP) || !m.indoor[f][i] || (test && !test(f, i))) continue;
      if ((x + (y % 2 ? 1 : 0) * 1) % step || y % step) continue;
      const cy = ceilY(m, f, i); if (taken[Math.round(cy / SH) * m.WH + i]) continue; taken[Math.round(cy / SH) * m.WH + i] = 1;
      const r = rng();
      m.lights.push({ f, cx: x, cy: y, y: cy, kind: 'panel', dead: r < th.deadLights, flicker: r >= th.deadLights && r < th.deadLights + th.flicker, phase: rng() * 100 });
    }
  }

  /* =====================================================================
     GÉNÉRATEUR 1 : BACKROOMS À ÉTAGES
     ===================================================================== */
  function roomsLayer(W, H, rng, o) {
    const g = new Uint8Array(W * H), rooms = [];
    const sep = (a0, a1, b0, b1) => a0 > b1 + o.gap || b0 > a1 + o.gap;
    for (let k = 0; k < o.tries && rooms.length < o.count; k++) {
      const w = ri(rng, o.rmin, o.rmax), h = ri(rng, o.rmin, o.rmax), x = ri(rng, 2, W - w - 2), y = ri(rng, 2, H - h - 2);
      if (rooms.some(r => !(sep(x, x + w - 1, r.x, r.x + r.w - 1) || sep(y, y + h - 1, r.y, r.y + r.h - 1)))) continue;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g[yy * W + xx] = 1;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    }
    const carve = (x, y) => { if (x >= 1 && y >= 1 && x < W - 1 && y < H - 1) g[y * W + x] = 1; };
    const corridor = (a, b) => {
      const cw = o.cw[Math.floor(rng() * o.cw.length)];
      let x = a.cx, y = a.cy; const hf = rng() < 0.5;
      const stepX = () => { while (x !== b.cx) { for (let k = 0; k < cw; k++) carve(x, y + k); x += Math.sign(b.cx - x); } };
      const stepY = () => { while (y !== b.cy) { for (let k = 0; k < cw; k++) carve(x + k, y); y += Math.sign(b.cy - y); } };
      if (hf) { stepX(); stepY(); } else { stepY(); stepX(); }
      for (let k = 0; k < cw; k++) carve(x + k, y + k);
    };
    const order = rooms.slice().sort((a, b) => a.cx - b.cx);
    for (let i = 1; i < order.length; i++) {
      let best = null, bd = 1e9;
      for (let j = 0; j < i; j++) { const d = Math.abs(order[i].cx - order[j].cx) + Math.abs(order[i].cy - order[j].cy); if (d < bd) { bd = d; best = order[j]; } }
      corridor(order[i], best);
    }
    for (let k = 0; k < rooms.length * o.loops; k++) corridor(rooms[Math.floor(rng() * rooms.length)], rooms[Math.floor(rng() * rooms.length)]);
    if (o.pillars) for (const r of rooms) if (r.w >= 7 && r.h >= 7 && rng() < 0.6) for (let y = r.y + 2; y < r.y + r.h - 2; y += 3) for (let x = r.x + 2; x < r.x + r.w - 2; x += 3) g[y * W + x] = 0;
    return { g, rooms };
  }
  function genBackrooms(def, seed, diff, rng) {
    const W = def.size || 46, H = W, F = 2, th = BR.Tex.theme(def.theme);
    const m = newMap('backrooms', def, W, H, F, seed);
    const L0 = roomsLayer(W, H, rng, { count: 16, tries: 500, rmin: 3, rmax: 9, gap: 1, loops: 0.35, cw: [1, 2, 2], pillars: true });
    const L1 = roomsLayer(W, H, rng, { count: 12, tries: 400, rmin: 3, rmax: 7, gap: 2, loops: 0.3, cw: [1, 2] });
    if (L0.rooms.length < 8) return null;
    for (let i = 0; i < m.WH; i++) { m.t[0][i] = L0.g[i] ? FLOOR : WALL; m.t[1][i] = L1.g[i] ? FLOOR : WALL; }
    const spawnRoom = L0.rooms.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0];
    // grandes salles « atrium » : ouvertes sur 8 m de haut, avec un balcon autour à l'étage
    const atr = L0.rooms.filter(r => r !== spawnRoom && r.w >= 4 && r.h >= 4).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 4);
    // la salle est fermée par de vrais murs sur toute sa hauteur (8 m) ; seules quelques ouvertures
    // en hauteur donnent sur le vide : ce sont les couloirs de l'étage d'où l'on peut sauter
    for (const r of atr) {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(m, 1, x, y, VOID);
      const ring = [];
      for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
        if (x > r.x - 1 && x < r.x + r.w && y > r.y - 1 && y < r.y + r.h) continue;
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        const corner = (x === r.x - 1 || x === r.x + r.w) && (y === r.y - 1 || y === r.y + r.h);
        set(m, 1, x, y, WALL);
        if (!corner) ring.push([x, y]);
      }
      // ouvertures : de préférence là où un couloir de l'étage arrive
      BR.shuffle(ring, rng);
      const outward = (x, y) => { const dx = x < r.x ? -1 : x >= r.x + r.w ? 1 : 0, dy = y < r.y ? -1 : y >= r.y + r.h ? 1 : 0; return [x + dx, y + dy]; };
      let nOpen = 0;
      for (const [x, y] of ring) { if (nOpen >= 3) break; const [ox, oy] = outward(x, y); if (inb(m, ox, oy) && L1.g[oy * W + ox]) { set(m, 1, x, y, FLOOR); nOpen++; } }
      for (const [x, y] of ring) { if (nOpen >= 2) break; set(m, 1, x, y, FLOOR); nOpen++; }
      if (rng() < 0.6) { // passerelle qui traverse la salle, reliée aux deux murs
        if (rng() < 0.5) { for (let x = r.x - 1; x <= r.x + r.w; x++) set(m, 1, x, r.cy, FLOOR); }
        else { for (let y = r.y - 1; y <= r.y + r.h; y++) set(m, 1, r.cx, y, FLOOR); }
      }
    }
    connectLayer(m, 1);
    // escaliers : de préférence vers les balcons
    const ramps = [];
    const tryRamps = (carve, max) => {
      const cand = [];
      for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) for (const [dx, dy] of D4) cand.push([x, y, dx, dy, rng()]);
      cand.sort((a, b) => a[4] - b[4]);
      for (const [x, y, dx, dy] of cand) {
        if (ramps.length >= max) break;
        if (ramps.some(r => Math.abs(r[0] - x) + Math.abs(r[1] - y) < 12)) continue;
        if (Math.abs(x - spawnRoom.cx) + Math.abs(y - spawnRoom.cy) < 5) continue;
        if (addRamp(m, 0, x, y, dx, dy, 4, { carve })) { ramps.push([x, y]); if (carve) connectLayer(m, 1); }
      }
    };
    tryRamps(false, 4);
    if (ramps.length < 3) tryRamps(true, 4);
    if (!ramps.length) return null;
    connectLayer(m, 1);
    // trous dans le sol de l'étage : raccourcis pour redescendre
    let holes = 0;
    for (let k = 0; k < 400 && holes < 6; k++) {
      const x = ri(rng, 2, W - 3), y = ri(rng, 2, H - 3), i = y * W + x;
      if (m.t[1][i] !== FLOOR || m.t[0][i] !== FLOOR || m.rampAt[0][i] >= 0) continue;
      if (m.ramps.some(r => r.landing === i || Math.abs((r.landing % W) - x) + Math.abs(((r.landing / W) | 0) - y) < 3)) continue;
      set(m, 1, x, y, VOID); holes++;
    }
    connectLayer(m, 1);
    // départ, sortie
    m.spawn = { f: 0, cx: spawnRoom.cx, cy: spawnRoom.cy };
    if (m.t[0][spawnRoom.cy * W + spawnRoom.cx] !== FLOOR) { const c = nearestFloor(m, 0, spawnRoom.cx, spawnRoom.cy); if (!c) return null; m.spawn.cx = c.x; m.spawn.cy = c.y; }
    m.exit = farExit(m, rng, m.spawn);
    if (!m.exit) return null;
    // caisses / cartons
    for (let k = 0; k < 400 && m.props.length < 26; k++) {
      const f = rng() < 0.6 ? 0 : 1, x = ri(rng, 2, W - 3), y = ri(rng, 2, H - 3), i = y * W + x;
      if (!freeCell(m, f, i) || (f === 0 && Math.abs(x - m.spawn.cx) + Math.abs(y - m.spawn.cy) < 4)) continue;
      const wallN = D4.filter(([dx, dy]) => m.t[f][(y + dy) * W + x + dx] === WALL).length; if (wallN !== 1) continue;
      const tall = rng() < 0.45;
      addProp(m, f, x, y, 'box', tall ? 1.15 : 0.55, 1.2, 1.2, { ox: (rng() - 0.5) * 0.3, oz: (rng() - 0.5) * 0.3, rot: (rng() - 0.5) * 0.3 });
    }
    if (!finalize(m, rng, diff)) return null;
    panelLights(m, rng, th);
    return m;
  }
  function nearestFloor(m, f, x0, y0) {
    for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = x0 + dx, y = y0 + dy; if (inb(m, x, y) && m.t[f][y * m.W + x] === FLOOR && m.rampAt[f][y * m.W + x] < 0) return { x, y }; }
    return null;
  }
  // sortie : cellule du rez-de-chaussée la plus éloignée du départ, collée à un mur
  function farExit(m, rng, sp, filter) {
    const W = m.W, dist = new Int16Array(m.WH).fill(-1), q = [sp.cy * W + sp.cx]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const c = q[h], x = c % W, y = (c / W) | 0; for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (!inb(m, nx, ny)) continue; const j = ny * W + nx; if (dist[j] < 0 && (m.t[0][j] === FLOOR || m.t[0][j] === RAMP)) { dist[j] = dist[c] + 1; q.push(j); } } }
    let maxD = 0; for (const c of q) maxD = Math.max(maxD, dist[c]);
    const cands = [];
    for (const c of q) {
      if (dist[c] < maxD * 0.72 || m.t[0][c] !== FLOOR || m.propAt[0][c] >= 0) continue;
      const x = c % W, y = (c / W) | 0;
      if (filter && !filter(x, y)) continue;
      for (const [dx, dy] of D4) { const j = (y + dy) * W + x + dx; if (m.t[0][j] === WALL && (m.F < 2 || m.t[1][j] !== VOID)) cands.push({ cx: x, cy: y, dx, dy }); }
    }
    if (!cands.length) return null;
    const e = cands[Math.floor(rng() * cands.length)];
    // dégage les abords de la porte
    return e;
  }

  /* =====================================================================
     GÉNÉRATEUR 2 : CENTRE COMMERCIAL
     ===================================================================== */
  const SHOPS = ['MODE', 'SPORT', 'JOUETS', 'CAFÉ', 'LIBRAIRIE', 'TECH', 'PHARMACIE', 'CHAUSSURES', 'BIJOUX', 'MUSIQUE', 'PARFUMS', 'JEUX VIDÉO', 'OPTIQUE', 'BOULANGERIE', 'FLEURS', 'CINÉMA'];
  function genMall(def, seed, diff, rng) {
    const W = 56, H = 40, F = 2, th = BR.Tex.theme(def.theme);
    const m = newMap('mall', def, W, H, F, seed);
    const mid = H >> 1, ay0 = mid - 3, ay1 = mid + 2, ax0 = 7, ax1 = W - 8;
    const Z = { tile: 1, shopA: 2, shopB: 3, service: 4, bridge: 5 };
    for (let f = 0; f < F; f++) {
      // galerie principale (+ allées couvertes) et halls aux extrémités
      rect(m, f, 2, ay0 - 2, W - 3, ay1 + 2, FLOOR, Z.tile);
      rect(m, f, 1, 1, 5, H - 2, FLOOR, Z.tile); rect(m, f, W - 6, 1, W - 2, H - 2, FLOOR, Z.tile);
      // couloirs de service
      rect(m, f, 1, 1, W - 2, 2, FLOOR, Z.service); rect(m, f, 1, H - 3, W - 2, H - 2, FLOOR, Z.service);
      // boutiques : deux rangées
      for (const band of [[4, ay0 - 4, ay0 - 3, 3], [ay1 + 4, H - 5, ay1 + 3, H - 4]]) {
        const [iy0, iy1, frontY, backY] = band;
        let x = ax0;
        while (x < ax1 - 4) {
          const w = Math.min(ri(rng, 5, 8), ax1 - x - 1); if (w < 4) break;
          const z = rng() < 0.5 ? Z.shopA : Z.shopB;
          rect(m, f, x, iy0, x + w - 1, iy1, FLOOR, z);
          for (let k = x; k < x + w; k++) if (m.t[f][frontY * W + k] === WALL) m.zone[f][frontY * W + k] = 7;
          // vitrine (ouverture sur la galerie)
          const ow = Math.min(w - 2, ri(rng, 2, 4)), ox = x + ri(rng, 1, Math.max(1, w - ow - 1));
          rect(m, f, ox, frontY, ox + ow - 1, frontY, FLOOR, z);
          if (rng() < 0.5) set(m, f, x + ri(rng, 1, w - 2), backY, FLOOR, z);    // porte de service
          m.signs.push({ f, cx: ox - 1 >= x ? ox - 1 : ox + ow, cy: frontY, side: frontY < mid ? 1 : -1, text: SHOPS[Math.floor(rng() * SHOPS.length)], hue: Math.floor(rng() * 360) });
          // réserve au fond
          if (w >= 6 && rng() < 0.4) { const wy = frontY < mid ? iy0 + 3 : iy1 - 3; rect(m, f, x, wy, x + w - 1, wy, WALL); set(m, f, x + ri(rng, 1, w - 2), wy, FLOOR, z); }
          x += w + 1;
        }
      }
    }
    // l'étage : le vide de la galerie (sauf passerelles), hall d'entrée sur double hauteur
    rect(m, 1, ax0, ay0, ax1, ay1, VOID);
    rect(m, 1, 1, ay0 - 2, 5, ay1 + 2, VOID);
    const bridges = [];
    for (let k = 0; k < 3; k++) {
      const bx = Math.round(ax0 + 6 + (ax1 - ax0 - 14) * (k + 0.5) / 3 + (rng() - 0.5) * 4);
      rect(m, 1, bx, ay0, bx + 1, ay1, FLOOR, Z.bridge); bridges.push(bx);
    }
    // escalators vers les passerelles (un de chaque côté, en quinconce)
    bridges.forEach((bx, k) => {
      if (k % 2 === 0) addRamp(m, 0, bx - 4, ay0 + 1, 1, 0, 4, { zone: Z.bridge });
      else addRamp(m, 0, bx + 5, ay1 - 1, -1, 0, 4, { zone: Z.bridge });
    });
    // escaliers de service
    addRamp(m, 0, 10, 1, 1, 0, 4, { zone: Z.service });
    addRamp(m, 0, W - 11, H - 2, -1, 0, 4, { zone: Z.service });
    addRamp(m, 0, W - 4, 4, 0, 1, 4, { zone: Z.tile });
    connectLayer(m, 1, Z.tile);
    // planchers effondrés dans quelques boutiques de l'étage
    for (let k = 0, n = 0; k < 300 && n < 5; k++) {
      const x = ri(rng, ax0, ax1), y = rng() < 0.5 ? ri(rng, 5, ay0 - 5) : ri(rng, ay1 + 5, H - 6), i = y * W + x;
      if (m.t[1][i] === FLOOR && m.t[0][i] === FLOOR && m.t[1][i + 1] === FLOOR && m.t[0][i + 1] === FLOOR) { set(m, 1, x, y, VOID); set(m, 1, x + 1, y, VOID); n++; }
    }
    connectLayer(m, 1, Z.tile);
    m.spawn = { f: 0, cx: W - 4, cy: mid };
    m.exit = { cx: 1, cy: mid, dx: -1, dy: 0 };
    // mobilier
    const tryProp = (f, x, y, kind, h, w, d, o) => { const i = y * W + x; if (inb(m, x, y) && freeCell(m, f, i) && Math.abs(x - m.spawn.cx) + Math.abs(y - m.spawn.cy) > 3 && Math.abs(x - m.exit.cx) + Math.abs(y - m.exit.cy) > 3) return addProp(m, f, x, y, kind, h, w, d, o); return null; };
    for (let x = ax0 + 2; x < ax1 - 1; x += ri(rng, 3, 6)) {
      tryProp(0, x, mid, rng() < 0.5 ? 'planter' : 'kiosk', rng() < 0.5 ? 0.7 : 1.15, 1.4, 1.4);
      tryProp(0, x + 1, ay0, 'bench', 0.45, 1.6, 0.7);
      tryProp(0, x, ay1, 'bench', 0.45, 1.6, 0.7);
    }
    for (let k = 0; k < 220; k++) {
      const f = rng() < 0.5 ? 0 : 1, x = ri(rng, ax0, ax1), y = rng() < 0.5 ? ri(rng, 4, ay0 - 4) : ri(rng, ay1 + 4, H - 5), i = y * W + x;
      if (m.zone[f][i] !== Z.shopA && m.zone[f][i] !== Z.shopB) continue;
      const nearFront = Math.abs(y - (ay0 - 3)) <= 1 || Math.abs(y - (ay1 + 3)) <= 1; if (nearFront) continue;
      tryProp(f, x, y, rng() < 0.6 ? 'shelf' : 'counter', rng() < 0.6 ? 1.9 : 1.05, 1.7, 0.8);
    }
    for (let k = 0; k < 40; k++) { const x = ri(rng, 3, W - 4), y = rng() < 0.5 ? ay0 - 2 : ay1 + 2; tryProp(1, x, y, 'bin', 0.9, 0.6, 0.6); }
    if (!finalize(m, rng, diff)) return null;
    panelLights(m, rng, th);
    // verrière au-dessus de la galerie
    for (let x = ax0; x <= ax1; x += 4) m.lights.push({ f: 0, cx: x, cy: mid, y: F * SH, kind: 'sky', dead: false, flicker: false, phase: 0 });
    return m;
  }

  /* =====================================================================
     GÉNÉRATEUR 3 : VILLE (rues, immeubles, toits, parkings, passerelles)
     ===================================================================== */
  function genCity(def, seed, diff, rng) {
    const BS = 11, SW = 3, NB = 4, W = 1 + SW + NB * (BS + SW) + 1, H = W, F = 3, th = BR.Tex.theme(def.theme);
    const m = newMap('city', def, W, H, F, seed);
    const Z = { asphalt: 1, sidewalk: 2, plaza: 3, wood: 4, roof: 5, concrete: 6, deck: 7, bridge: 8, grass: 9 };
    const WZ = { ext: 1, bound: 2, pillar: 3, int: 4 };
    // sol : rue partout, cases vides aux étages
    for (let i = 0; i < m.WH; i++) { m.t[0][i] = FLOOR; m.zone[0][i] = Z.asphalt; m.t[1][i] = VOID; m.t[2][i] = VOID; }
    for (let f = 0; f < F; f++) { rect(m, f, 0, 0, W - 1, 0, WALL, WZ.bound); rect(m, f, 0, H - 1, W - 1, H - 1, WALL, WZ.bound); rect(m, f, 0, 0, 0, H - 1, WALL, WZ.bound); rect(m, f, W - 1, 0, W - 1, H - 1, WALL, WZ.bound); }
    for (let i = 0; i < m.WH; i++) if (m.t[0][i] === WALL && rng() < 0.14) m.zone[0][i] = 5;   // quelques graffitis sur l'enceinte
    const blocks = [];
    for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
      const x0 = 1 + SW + bx * (BS + SW), y0 = 1 + SW + by * (BS + SW);
      blocks.push({ bx, by, x0, y0, x1: x0 + BS - 1, y1: y0 + BS - 1 });
    }
    // types d'îlots : place centrale pour le départ, le reste au hasard
    const centerB = blocks.find(b => b.bx === 1 && b.by === 1);
    const types = ['tall', 'tall', 'tall', 'short', 'short', 'garage', 'garage', 'plaza', 'lot', 'tall', 'short', 'tall', 'park', 'tall', 'garage'];
    BR.shuffle(types, rng);
    blocks.forEach(b => { b.type = b === centerB ? 'plaza' : types.pop() || 'tall'; });
    for (const b of blocks) {
      rect(m, 0, b.x0, b.y0, b.x1, b.y1, FLOOR, Z.sidewalk);
      const fx0 = b.x0 + 1, fy0 = b.y0 + 1, fx1 = b.x1 - 1, fy1 = b.y1 - 1;
      if (b.type === 'tall' || b.type === 'short') {
        const top = b.type === 'tall' ? 2 : 1, ez = BR.pick([WZ.ext, 6, 10, 11], rng);   // brique, bureaux, enduit à volets, peint
        for (let f = 0; f < top; f++) {
          rect(m, f, fx0, fy0, fx1, fy1, WALL, ez);
          rect(m, f, fx0 + 1, fy0 + 1, fx1 - 1, fy1 - 1, FLOOR, Z.wood);
          for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) m.indoor[f][y * W + x] = 1;
        }
        rect(m, top, fx0, fy0, fx1, fy1, FLOOR, Z.roof);
        // portes au rez-de-chaussée, fenêtres cassées à l'étage
        const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const [dx, dy] of sides) {
          const n = dy ? fx1 - fx0 - 1 : fy1 - fy0 - 1;
          const along = k => dy ? [fx0 + 1 + k, dy < 0 ? fy0 : fy1] : [dx < 0 ? fx0 : fx1, fy0 + 1 + k];
          const d0 = ri(rng, 1, n - 3); for (let k = d0; k < d0 + (rng() < 0.5 ? 2 : 1); k++) { const [x, y] = along(k); set(m, 0, x, y, FLOOR, Z.wood); }
          if (top === 2) for (let w = 0; w < 2; w++) if (rng() < 0.6) { const [x, y] = along(ri(rng, 0, n - 1)); set(m, 1, x, y, FLOOR, Z.wood); }
        }
        // escaliers intérieurs
        const placeRamp = f => {
          for (let k = 0; k < 40; k++) {
            const horiz = rng() < 0.5, dir = rng() < 0.5 ? 1 : -1;
            const x = horiz ? (dir > 0 ? fx0 + 2 : fx1 - 2) : ri(rng, fx0 + 1, fx1 - 1), y = horiz ? ri(rng, fy0 + 1, fy1 - 1) : (dir > 0 ? fy0 + 2 : fy1 - 2);
            if (addRamp(m, f, x, y, horiz ? dir : 0, horiz ? 0 : dir, 4, { zone: Z.concrete })) return true;
          }
          return false;
        };
        placeRamp(0); if (top === 2) placeRamp(1);
        // cloison intérieure avec passage
        for (let f = 0; f < top; f++) if (rng() < 0.6) {
          const vx = ri(rng, fx0 + 3, fx1 - 3);
          const cells = []; for (let y = fy0 + 1; y <= fy1 - 1; y++) { const i = y * W + vx; if (m.t[f][i] === FLOOR && m.rampAt[f][i] < 0 && !m.ramps.some(r => (r.f === f && r.approach === i) || (r.f + 1 === f && r.landing === i))) cells.push(y); }
          if (cells.length >= fy1 - fy0 - 1) { for (const y of cells) set(m, f, vx, y, WALL, WZ.int); const d = cells[ri(rng, 1, cells.length - 2)]; set(m, f, vx, d, FLOOR, Z.wood); set(m, f, vx, d + 1, FLOOR, Z.wood); }
        }
        b.roof = top;
      } else if (b.type === 'garage') {
        rect(m, 0, fx0, fy0, fx1, fy1, FLOOR, Z.concrete);
        rect(m, 1, fx0, fy0, fx1, fy1, FLOOR, Z.deck);
        for (let y = fy0 + 2; y <= fy1 - 2; y += 3) for (let x = fx0 + 2; x <= fx1 - 2; x += 3) set(m, 0, x, y, WALL, WZ.pillar);
        for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) m.indoor[0][y * W + x] = 1;
        const dir = rng() < 0.5 ? 1 : -1;
        addRamp(m, 0, dir > 0 ? fx0 + 1 : fx1 - 1, rng() < 0.5 ? fy0 : fy1, dir, 0, 4, { zone: Z.concrete }) || addRamp(m, 0, rng() < 0.5 ? fx0 : fx1, fy0 + 1, 0, 1, 4, { zone: Z.concrete });
        for (let k = 0; k < 6; k++) { const x = ri(rng, fx0, fx1), y = ri(rng, fy0, fy1); if (rng() < 0.5) carProps(m, 1, x, y, rng, rng() < 0.5); }
        b.roof = 1;
      } else if (b.type === 'plaza' || b.type === 'park') {
        rect(m, 0, fx0, fy0, fx1, fy1, FLOOR, b.type === 'park' ? Z.grass : Z.plaza);
      } else if (b.type === 'lot') {
        rect(m, 0, fx0, fy0, fx1, fy1, FLOOR, Z.asphalt);
      }
    }
    // passerelles entre toits de même hauteur, au-dessus des rues
    const at = (bx, by) => blocks.find(b => b.bx === bx && b.by === by);
    let nb = 0;
    for (const b of blocks) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const o = at(b.bx + dx, b.by + dy); if (!o || !b.roof || b.roof !== o.roof || rng() < 0.35) continue;
      const f = b.roof;
      if (dx) { const y = ri(rng, b.y0 + 3, b.y1 - 4); rect(m, f, b.x1, y, o.x0, y + 1, FLOOR, Z.bridge); }
      else { const x = ri(rng, b.x0 + 3, b.x1 - 4); rect(m, f, x, b.y1, x + 1, o.y0, FLOOR, Z.bridge); }
      nb++;
    }
    // rampes extérieures (escaliers de secours) vers quelques toits bas
    for (const b of blocks) if (b.roof === 1 && b.type === 'short' && rng() < 0.7) {
      const y = b.y1; // trottoir sud
      for (let x = b.x0 + 1; x <= b.x1 - 5; x++) if (addRamp(m, 0, x, y, 1, 0, 4, { zone: Z.concrete, dry: true })) { set(m, 1, x + 4, y, FLOOR, Z.deck); addRamp(m, 0, x, y, 1, 0, 4, { zone: Z.concrete }); break; }
    }
    // départ : place centrale ; sortie : grille dans le mur d'enceinte, au bout d'une rue
    const pc = centerB;
    m.spawn = { f: 0, cx: (pc.x0 + pc.x1) >> 1, cy: (pc.y0 + pc.y1) >> 1 };
    const streetRows = []; for (let k = 0; k <= NB; k++) streetRows.push(1 + k * (BS + SW) + 1);
    const exits = [];
    for (const r of streetRows) { exits.push({ cx: 1, cy: r, dx: -1, dy: 0 }, { cx: W - 2, cy: r, dx: 1, dy: 0 }, { cx: r, cy: 1, dx: 0, dy: -1 }, { cx: r, cy: H - 2, dx: 0, dy: 1 }); }
    exits.sort((a, b) => Math.hypot(b.cx - m.spawn.cx, b.cy - m.spawn.cy) - Math.hypot(a.cx - m.spawn.cx, a.cy - m.spawn.cy));
    m.exit = exits[Math.floor(rng() * 4)];
    // mobilier urbain : voitures, lampadaires, bancs, arbres, bennes
    const keep = (x, y) => Math.abs(x - m.spawn.cx) + Math.abs(y - m.spawn.cy) > 3 && Math.abs(x - m.exit.cx) + Math.abs(y - m.exit.cy) > 4;
    for (const r of streetRows) for (let k = 3; k < W - 4; k += ri(rng, 5, 9)) {
      if (rng() < 0.55 && keep(k, r - 1)) carProps(m, 0, k, r - 1, rng, true);
      if (rng() < 0.55 && keep(r - 1, k)) carProps(m, 0, r - 1, k, rng, false);
    }
    for (const b of blocks) {
      // lampadaires aux coins des trottoirs
      for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y1], [b.x0, b.y1], [b.x1, b.y0]]) if (rng() < 0.75 && keep(x, y)) {
        const dx = x === b.x0 ? -1 : 1, dz = y === b.y0 ? -1 : 1, horiz = rng() < 0.5;
        const ax = horiz ? dx : 0, az = horiz ? 0 : dz, ry = Math.atan2(az, -ax);
        const p = addProp(m, 0, x, y, 'lamp', 6.0, 0.3, 0.3, { rot: ry });
        if (p) { p.hx = p.x + ax * 1.35; p.hz = p.z + az * 1.35; m.lights.push({ f: 0, cx: x, cy: y, y: 5.5, kind: 'lamp', dead: rng() < 0.12, flicker: rng() < 0.18, phase: rng() * 100, px: p.hx, pz: p.hz, prop: p.id }); }
      }
      const fx0 = b.x0 + 1, fy0 = b.y0 + 1, fx1 = b.x1 - 1, fy1 = b.y1 - 1;
      if (b.type === 'plaza' || b.type === 'park') {
        for (let k = 0; k < (b.type === 'park' ? 9 : 4); k++) { const x = ri(rng, fx0, fx1), y = ri(rng, fy0, fy1); if (keep(x, y)) addProp(m, 0, x, y, 'tree', 6, 0.6, 0.6); }
        for (let k = 0; k < 5; k++) { const x = ri(rng, fx0, fx1), y = ri(rng, fy0, fy1); if (keep(x, y)) addProp(m, 0, x, y, 'bench', 0.45, 1.6, 0.7, { rot: rng() < 0.5 ? 0 : 1 }); }
        if (b.type === 'plaza' && b !== centerB) { const cx = (fx0 + fx1) >> 1, cy = (fy0 + fy1) >> 1; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) addProp(m, 0, cx + dx, cy + dy, 'fountain', 0.75, 2, 2, { part: dx + dy * 2 }); }
      } else if (b.type === 'lot') {
        for (let y = fy0 + 1; y <= fy1 - 1; y += 3) for (let x = fx0; x <= fx1 - 1; x += 2) if (rng() < 0.6 && keep(x, y)) carProps(m, 0, x, y, rng, false);
      }
      if (rng() < 0.6) { const x = ri(rng, b.x0, b.x1), y = rng() < 0.5 ? b.y0 : b.y1; if (keep(x, y)) addProp(m, 0, x, y, 'dumpster', 1.3, 1.8, 1.2); }
      if (rng() < 0.7) { const x = ri(rng, b.x0 + 1, b.x1 - 1), y = rng() < 0.5 ? b.y0 : b.y1; if (keep(x, y) && freeCell(m, 0, y * W + x)) addProp(m, 0, x, y, 'hydrant', 0.95, 0.5, 0.5); }
      if (rng() < 0.5) { const x = rng() < 0.5 ? b.x0 : b.x1, y = rng() < 0.5 ? b.y0 : b.y1; if (keep(x, y) && freeCell(m, 0, y * W + x)) addProp(m, 0, x, y, 'tlight', 4.6, 0.35, 0.35, { rot: Math.floor(rng() * 4) }); }
      if (b.roof) {
        const f = b.roof, rx0 = b.x0 + 2, rx1 = b.x1 - 2, ry0 = b.y0 + 2, ry1 = b.y1 - 2;
        const tryRoof = (kind, h, w, d) => { for (let k = 0; k < 12; k++) { const x = ri(rng, rx0, rx1), y = ri(rng, ry0, ry1), i = y * W + x; if (freeCell(m, f, i)) return addProp(m, f, x, y, kind, h, w, d); } return null; };
        if (b.type === 'tall' && rng() < 0.6) tryRoof('tower', 3.6, 1.9, 1.9);
        for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) tryRoof('ac', 1.0, 1.5, 1.1);
      }
    }
    if (!finalize(m, rng, diff)) return null;
    panelLights(m, rng, th, (f, i) => m.indoor[f][i] === 1);
    return m;
  }
  // voiture sur deux cellules
  function carProps(m, f, x, y, rng, alongX) {
    const x2 = alongX ? x + 1 : x, y2 = alongX ? y : y + 1;
    if (!inb(m, x2, y2) || !freeCell(m, f, y * m.W + x) || !freeCell(m, f, y2 * m.W + x2)) return false;
    const colors = ['#b8312f', '#2d5f9a', '#e0b000', '#d8d8d8', '#2a2a2a', '#3c7a3c', '#7b4fa0', '#c06a1c'];
    const color = colors[Math.floor(rng() * colors.length)], link = Math.floor(rng() * 1e9);
    const w = alongX ? 2.0 : 1.7, d = alongX ? 1.7 : 2.0;
    addProp(m, f, x, y, 'car', 1.3, w, d, { ox: alongX ? 0.0 : 0, oz: 0, color, link, part: 0, rot: alongX ? 0 : 1 });
    addProp(m, f, x2, y2, 'car', 1.3, w, d, { color, link, part: 1, rot: alongX ? 0 : 1 });
    return true;
  }

  /* =====================================================================
     POINT D'ENTRÉE
     ===================================================================== */
  /* ---- extensions : chaque nouvelle carte vit dans son propre fichier (js/maps/*.js) ----
     BR.World.gens[kind]  = function (def, seed, diff, rng, H) -> carte finalisée (comme genCity)
     BR.World.decor[kind] = function (m, B, inst, rng, H, group) -> décor supplémentaire au maillage
     H = BR.World.H : fonctions internes partagées (newMap, rect, set, addRamp, addProp, finalize, farExit, nearestFloor,
     connectLayer, panelLights, roomsLayer, carProps, quad, tri, box, hex, put, Buf, geo, cityDecor, skyline, C, SH, …) */
  W_.gens = W_.gens || {};
  W_.decor = W_.decor || {};
  W_.generate = function (def, seed, diff) {
    const gen = W_.gens[def.kind] ? ((d, s, df, r) => W_.gens[def.kind](d, s, df, r, W_.H)) : def.kind === 'mall' ? genMall : def.kind === 'city' ? genCity : genBackrooms;
    for (let attempt = 0; attempt < 40; attempt++) {
      const rng = BR.rngFrom((seed + attempt * 7919) >>> 0);
      let m = null;
      try { m = gen(def, seed, diff, rng); } catch (e) { if (attempt === 39) throw e; m = null; }
      if (m) { m.attempt = attempt; return m; }
    }
    throw new Error('Génération de carte impossible (' + def.id + ')');
  };

  /* =====================================================================
     MAILLAGE
     ===================================================================== */
  function Buf() { return { p: [], n: [], u: [], c: [], i: [] }; }
  function quad(B, v, n, uv, col) {
    const o = B.p.length / 3;
    // col : nombre (gris), [r,g,b] (couleur unie) ou tableau de 4 valeurs (une par sommet)
    for (let k = 0; k < 4; k++) { B.p.push(v[k][0], v[k][1], v[k][2]); B.n.push(n[0], n[1], n[2]); B.u.push(uv[k][0], uv[k][1]); const c = col == null ? 1 : (Array.isArray(col) && col.length === 4) ? col[k] : col; if (typeof c === 'number') B.c.push(c, c, c); else B.c.push(c[0], c[1], c[2]); }
    B.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  function tri(B, v, n, uv, col) {
    const o = B.p.length / 3;
    for (let k = 0; k < 3; k++) { B.p.push(v[k][0], v[k][1], v[k][2]); B.n.push(n[0], n[1], n[2]); B.u.push(uv[k][0], uv[k][1]); const c = col == null ? 1 : col; B.c.push(c, c, c); }
    B.i.push(o, o + 1, o + 2);
  }
  function geo(B) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
    g.setIndex(B.i);
    return g;
  }
  // boîte (pour les objets) ; col = [r,g,b]
  function box(B, x0, y0, z0, x1, y1, z1, col, uvs) {
    const s = uvs || 1, c = col, cd = [col[0] * 0.78, col[1] * 0.78, col[2] * 0.78], ct = [Math.min(1, col[0] * 1.08), Math.min(1, col[1] * 1.08), Math.min(1, col[2] * 1.08)];
    const U = (a, b) => [[0, 0], [a * s, 0], [a * s, b * s], [0, b * s]];
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    quad(B, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], U(w, d), ct);
    quad(B, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], U(w, h), c);
    quad(B, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], U(w, h), c);
    quad(B, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], U(d, h), cd);
    quad(B, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], U(d, h), cd);
  }
  const hex = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

  W_.build = function (m, T) {
    const rng = BR.rngFrom(m.seed ^ 0x9e3779b9);
    const group = new THREE.Group(), bufs = {};
    const B = key => bufs[key] || (bufs[key] = Buf());
    const W = m.W, H = m.H, WH = m.WH;
    const tAt = (f, x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? WALL : m.t[f][y * W + x];
    const wallAt = (f, x, y) => tAt(f, x, y) === WALL;
    const shade = () => 0.88 + rng() * 0.12;
    // m.noWall[f][i] = 1 : mur « logique » (haie, bassin, clôture…) dessiné par le décor de la carte et non comme un mur de 4 m
    const hid = (f, i) => !!(m.noWall && m.noWall[f] && m.noWall[f][i]);
    curT = T;
    for (let f = 0; f < m.F; f++) {
      const y0 = f * SH;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, t = m.t[f][i], X0 = x * C, X1 = X0 + C, Z0 = y * C, Z1 = Z0 + C, zone = m.zone[f][i];
        if (t === FLOOR) {
          const ao = (vx, vz) => { let n = 0; if (wallAt(f, vx - 1, vz - 1)) n++; if (wallAt(f, vx, vz - 1)) n++; if (wallAt(f, vx - 1, vz)) n++; if (wallAt(f, vx, vz)) n++; return 1 - 0.13 * n; };
          const s = shade();
          quad(B('f' + zone), [[X0, y0, Z1], [X1, y0, Z1], [X1, y0, Z0], [X0, y0, Z0]], [0, 1, 0], [[X0 / 2, Z1 / 2], [X1 / 2, Z1 / 2], [X1 / 2, Z0 / 2], [X0 / 2, Z0 / 2]], [ao(x, y + 1) * s, ao(x + 1, y + 1) * s, ao(x + 1, y) * s, ao(x, y) * s]);
        }
        if ((t === FLOOR || t === RAMP) && f > 0) {
          // dessous de la dalle (plafond de l'étage inférieur) + tranches au bord du vide
          if (m.t[f - 1][i] !== WALL) quad(B('c' + (m.indoor[f - 1][i] ? 'i' : 'o')), [[X1, y0 - SLAB, Z1], [X0, y0 - SLAB, Z1], [X0, y0 - SLAB, Z0], [X1, y0 - SLAB, Z0]], [0, -1, 0], [[X1 / 2, Z1 / 2], [X0 / 2, Z1 / 2], [X0 / 2, Z0 / 2], [X1 / 2, Z0 / 2]], 0.9);
          for (const [dx, dy] of D4) {
            if (tAt(f, x + dx, y + dy) !== VOID) continue;
            edgeQuad(B('e'), x, y, dx, dy, y0 - SLAB, y0);
          }
        }
        if (t === RAMP) rampMesh(m, B, f, i, x, y);
        if (t === WALL && !hid(f, i)) {
          // dessous d'un bloc de mur posé au-dessus d'une pièce ouverte : c'est le plafond de cette pièce
          if (f > 0 && m.t[f - 1][i] !== WALL) quad(B('c' + (m.indoor[f - 1][i] ? 'i' : 'o')), [[X1, y0 - SLAB, Z1], [X0, y0 - SLAB, Z1], [X0, y0 - SLAB, Z0], [X1, y0 - SLAB, Z0]], [0, -1, 0], [[X1 / 2, Z1 / 2], [X0 / 2, Z1 / 2], [X0 / 2, Z0 / 2], [X1 / 2, Z0 / 2]], 0.9);
          const top = f === m.F - 1 ? (m.outdoor ? (f + 1) * SH : m.F * SH) : (f + 1) * SH;
          const bot = f === 0 ? 0 : y0 - SLAB;
          for (const [dx, dy] of D4) {
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const nt = m.t[f][ny * W + nx]; if (nt === WALL && !hid(f, ny * W + nx)) continue;
            const io = m.indoor[f][ny * W + nx] ? 'i' : 'o';
            wallQuad(B('w' + zone + io), x, y, dx, dy, bot, top);
          }
          if (m.outdoor && (f === m.F - 1 || m.t[f + 1][i] === VOID)) quad(B('e'), [[X0, top, Z1], [X1, top, Z1], [X1, top, Z0], [X0, top, Z0]], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], 0.8);
        }
      }
    }
    // toit des cartes intérieures
    if (!m.outdoor) for (let i = 0; i < WH; i++) {
      if (m.t[m.F - 1][i] === WALL) continue;
      const x = i % W, y = (i / W) | 0, X0 = x * C, X1 = X0 + C, Z0 = y * C, Z1 = Z0 + C, Y = m.F * SH;
      const sky = m.kind === 'mall' && m.t[1][i] === VOID && m.t[0][i] !== WALL && m.zone[0][i] === 1;
      quad(B(sky ? 'sky' : 'ci'), [[X1, Y, Z1], [X0, Y, Z1], [X0, Y, Z0], [X1, Y, Z0]], [0, -1, 0], [[X1 / 2, Z1 / 2], [X0 / 2, Z1 / 2], [X0 / 2, Z0 / 2], [X1 / 2, Z0 / 2]], 0.85);
    }
    // objets
    const PB = B('p'), inst = {};
    const AS = BR.Assets && BR.Assets.ready ? BR.Assets : null;
    for (const p of m.props) { if (p.nodraw) continue; if (!(AS && modelProp(m, p, rng, inst))) propMesh(PB, B, p, rng); }
    if (AS) { for (const name in inst) addInstances(group, name, inst[name]); }
    if (m.kind === 'city') cityDecor(m, B, AS ? inst : null, rng);
    for (const p of m.props) if (p.kind === 'lamp' && p.hx != null) box(B('glow'), p.hx - 0.22, 5.62, p.hz - 0.22, p.hx + 0.22, 5.7, p.hz + 0.22, [1, 0.85, 0.55]);
    if (AS && m.kind === 'city') { const sky = {}; skyline(m, sky, rng); for (const name in sky) addInstances(group, name, sky[name]); }
    if (W_.decor[m.kind]) { const ex = {}; W_.decor[m.kind](m, B, AS ? ex : null, rng, W_.H, group); for (const name in ex) addInstances(group, name, ex[name]); }
    // néons
    const onB = Buf(), offB = Buf(), frame = Buf(), flick = [];
    const panelQ = (Bf, cx, cz, hw, hd, y) => quad(Bf, [[cx + hw, y, cz + hd], [cx - hw, y, cz + hd], [cx - hw, y, cz - hd], [cx + hw, y, cz - hd]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    for (const l of m.lights) {
      if (l.kind === 'lamp') continue;
      const cx = (l.cx + 0.5) * C, cz = (l.cy + 0.5) * C, big = l.kind === 'sky' ? 1.6 : 1;
      panelQ(frame, cx, cz, 0.62 * big, 0.34 * big, l.y - 0.012);
      if (l.dead) panelQ(offB, cx, cz, 0.55 * big, 0.27 * big, l.y - 0.025);
      else if (l.flicker) { const Bf = Buf(); panelQ(Bf, cx, cz, 0.55 * big, 0.27 * big, l.y - 0.025); flick.push({ B: Bf, light: l }); }
      else panelQ(onB, cx, cz, 0.55 * big, 0.27 * big, l.y - 0.025);
    }
    // assemblage
    for (const key in bufs) {
      const b = bufs[key]; if (!b.i.length) continue;
      const mat = T.mat(key), me = new THREE.Mesh(geo(b), mat); me.matrixAutoUpdate = false; group.add(me);
      // eau : les vaguelettes (carte de relief) glissent lentement
      if (mat.userData.flow && mat.normalMap) { const nm = mat.normalMap, fl = mat.userData.flow; me.onBeforeRender = () => { const t = performance.now() / 1000; nm.offset.set(t * fl[0], t * fl[1]); }; }
    }
    curT = null;
    const bm = c => new THREE.MeshBasicMaterial({ color: c });
    if (frame.i.length) group.add(new THREE.Mesh(geo(frame), bm(0x3a3a34)));
    if (offB.i.length) group.add(new THREE.Mesh(geo(offB), bm(0x5a5a52)));
    const onMat = bm(new THREE.Color(T.panel)), dimMat = bm(0x4a4a40);
    if (onB.i.length) group.add(new THREE.Mesh(geo(onB), onMat));
    const flickMeshes = flick.map(o => { const me = new THREE.Mesh(geo(o.B), onMat); group.add(me); return { mesh: me, light: o.light }; });
    // enseignes
    for (const s of m.signs) {
      const i = s.cy * W + s.cx; if (m.t[s.f][i] !== WALL) continue;
      const tex = new THREE.CanvasTexture(BR.Tex.shopSign(s.text, s.hue));
      const me = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.55), new THREE.MeshBasicMaterial({ map: tex }));
      me.position.set((s.cx + 0.5) * C, s.f * SH + 2.9, (s.cy + 0.5) * C + s.side * (C / 2 + 0.02));
      me.rotation.y = s.side > 0 ? 0 : Math.PI;
      group.add(me);
    }
    return { group, flickMeshes, onMat, dimMat };
  };
  function wallQuad(B, x, y, dx, dy, bot, top) {
    const X0 = x * C, X1 = X0 + C, Z0 = y * C, Z1 = Z0 + C, h0 = bot / SH, h1 = top / SH;
    const wc = [0.78, 0.78, 1, 1];
    if (dx === 1) quad(B, [[X1, bot, Z1], [X1, bot, Z0], [X1, top, Z0], [X1, top, Z1]], [1, 0, 0], [[Z1 / 4, h0], [Z0 / 4, h0], [Z0 / 4, h1], [Z1 / 4, h1]], wc);
    else if (dx === -1) quad(B, [[X0, bot, Z0], [X0, bot, Z1], [X0, top, Z1], [X0, top, Z0]], [-1, 0, 0], [[Z0 / 4, h0], [Z1 / 4, h0], [Z1 / 4, h1], [Z0 / 4, h1]], wc);
    else if (dy === 1) quad(B, [[X0, bot, Z1], [X1, bot, Z1], [X1, top, Z1], [X0, top, Z1]], [0, 0, 1], [[X0 / 4, h0], [X1 / 4, h0], [X1 / 4, h1], [X0 / 4, h1]], wc);
    else quad(B, [[X1, bot, Z0], [X0, bot, Z0], [X0, top, Z0], [X1, top, Z0]], [0, 0, -1], [[X1 / 4, h0], [X0 / 4, h0], [X0 / 4, h1], [X1 / 4, h1]], wc);
  }
  function edgeQuad(B, x, y, dx, dy, bot, top) {
    const X0 = x * C, X1 = X0 + C, Z0 = y * C, Z1 = Z0 + C;
    const uv = [[0, 0], [1, 0], [1, 0.15], [0, 0.15]];
    if (dx === 1) quad(B, [[X1, bot, Z1], [X1, bot, Z0], [X1, top, Z0], [X1, top, Z1]], [1, 0, 0], uv, 0.9);
    else if (dx === -1) quad(B, [[X0, bot, Z0], [X0, bot, Z1], [X0, top, Z1], [X0, top, Z0]], [-1, 0, 0], uv, 0.9);
    else if (dy === 1) quad(B, [[X0, bot, Z1], [X1, bot, Z1], [X1, top, Z1], [X0, top, Z1]], [0, 0, 1], uv, 0.9);
    else quad(B, [[X1, bot, Z0], [X0, bot, Z0], [X0, top, Z0], [X1, top, Z0]], [0, 0, -1], uv, 0.9);
  }
  // quadrilatère orienté automatiquement : l'ordre des sommets est inversé si la face regarderait à l'opposé de n
  // (évite les faces invisibles à cause du « backface culling »)
  function quadN(B, v, n, uv, col) {
    const ax = v[1][0] - v[0][0], ay = v[1][1] - v[0][1], az = v[1][2] - v[0][2], bx = v[2][0] - v[0][0], by = v[2][1] - v[0][1], bz = v[2][2] - v[0][2];
    if ((ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2] < 0) {
      v = [v[0], v[3], v[2], v[1]]; uv = [uv[0], uv[3], uv[2], uv[1]];
      if (Array.isArray(col) && col.length === 4) col = [col[0], col[3], col[2], col[1]];
    }
    quad(B, v, n, uv, col);
  }
  /* escalier : vraies marches (giron 50 cm) posées sur la pente physique (elles la suivent à ±rise/2 près),
     contremarches, flancs en dents de scie, et dos de l'escalier sous le palier (avant : face absente -> on voyait au travers
     alors qu'on s'y cognait). Tous les quadrilatères passent par quadN : aucune face à l'envers. */
  function rampMesh(m, Bk, f, i, x, y) {
    const r = m.ramps[m.rampAt[f][i]]; if (!r || r.dead || r.nodraw) return;     // r.nodraw : dessinée par le décor de la carte (plage, toboggan…)
    const k = r.cells.indexOf(i); if (k < 0) return;
    const X0 = x * C, X1 = X0 + C, Z0 = y * C, Z1 = Z0 + C, base = f * SH;
    const len = r.L * C, nSt = Math.max(1, Math.round(len / 0.5)), run = len / nSt, rise = SH / nSt;
    const lat0 = r.dx ? Z0 : X0, lat1 = r.dx ? Z1 : X1;
    const P = (s, l, yy) => r.dx ? [r.sx + r.dx * s, yy, l] : [l, yy, r.sz + r.dy * s];
    const fwd = [r.dx, 0, r.dy], back = [-r.dx, 0, -r.dy];
    const RT = Bk('r'), RR = Bk('rr'), RS = Bk('rs');
    const j0 = Math.round(k * C / run), j1 = Math.round((k + 1) * C / run);
    // côtés ouverts (pas de mur, pas la même rampe)
    const open = [];
    for (const sd of [-1, 1]) {
      const nx = r.dx ? x : x + sd, ny = r.dx ? y + sd : y;
      if (inb(m, nx, ny)) { const j = ny * m.W + nx; if (m.t[f][j] === WALL && !(m.noWall && m.noWall[f] && m.noWall[f][j])) continue; if (m.rampAt[f][j] === r.id) continue; }
      open.push(sd);
    }
    for (let j = j0; j < j1; j++) {
      const sa = j * run, sb = sa + run, top = base + (j + 0.5) * rise, prev = j === 0 ? base : base + (j - 0.5) * rise;
      // giron (le nez de marche est en v = 1 dans la texture)
      quadN(RT, [P(sa, lat0, top), P(sa, lat1, top), P(sb, lat1, top), P(sb, lat0, top)], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], 1);
      // contremarche
      quadN(RR, [P(sa, lat0, prev), P(sa, lat1, prev), P(sa, lat1, top), P(sa, lat0, top)], back, [[0, 0], [1, 0], [1, 0.25], [0, 0.25]], 0.82);
      // flancs
      for (const sd of open) {
        const l = sd < 0 ? lat0 : lat1, n = r.dx ? [0, 0, sd] : [sd, 0, 0];
        quadN(RS, [P(sa, l, base), P(sb, l, base), P(sb, l, top), P(sa, l, top)], n, [[sa / 4, base / SH], [sb / 4, base / SH], [sb / 4, top / SH], [sa / 4, top / SH]], 0.8);
      }
    }
    if (k === r.cells.length - 1) {
      const topL = base + SH, last = base + (nSt - 0.5) * rise;
      // dernière demi-contremarche, jusqu'au palier
      quadN(RR, [P(len, lat0, last), P(len, lat1, last), P(len, lat1, topL), P(len, lat0, topL)], back, [[0, 0], [1, 0], [1, 0.12], [0, 0.12]], 0.82);
      // dos de l'escalier, visible depuis le dessous du palier
      if (m.t[f][r.landing] !== WALL || (m.noWall && m.noWall[f] && m.noWall[f][r.landing]))
        quadN(RS, [P(len, lat0, base), P(len, lat1, base), P(len, lat1, topL), P(len, lat0, topL)], fwd, [[0, base / SH], [0.5, base / SH], [0.5, topL / SH], [0, topL / SH]], 0.8);
    }
  }
  W_.rampMesh = rampMesh;

  /* ---------- arbres : tronc effilé posé AU SOL (avant : le tronc flottait entre 0,8 et 1,8 m), racines, branches,
     houppier en « cartes » de feuillage + volume intérieur sombre. Variantes : feuillu, conifère, arbuste ---------- */
  const _nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const _crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // tube lissé le long d'une polyligne (rayon par point), normales lisses, UV : u autour (×uw), v le long (1 unité = 2 m)
  function tube(B, pts, rad, sides, col, uw) {
    sides = sides || 8; uw = uw || 2;
    let u = null, along = 0;
    const rings = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
      const t = _nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      if (!u) u = _nrm(_crs(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      else { const d = u[0] * t[0] + u[1] * t[1] + u[2] * t[2]; u = _nrm([u[0] - t[0] * d, u[1] - t[1] * d, u[2] - t[2] * d]); }
      const w = _crs(t, u);
      if (k) along += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]);
      rings.push({ p: pts[k], u: u.slice(), w, r: rad[k], v: along / 2 });
    }
    const o0 = B.p.length / 3, cc = Array.isArray(col) ? col : [col, col, col];
    for (const R of rings) for (let s = 0; s <= sides; s++) {
      const a = s / sides * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const d = [R.u[0] * ca + R.w[0] * sa, R.u[1] * ca + R.w[1] * sa, R.u[2] * ca + R.w[2] * sa];
      B.p.push(R.p[0] + d[0] * R.r, R.p[1] + d[1] * R.r, R.p[2] + d[2] * R.r); B.n.push(d[0], d[1], d[2]); B.u.push(s / sides * uw, R.v);
      B.c.push(cc[0], cc[1], cc[2]);
    }
    const S1 = sides + 1;
    for (let k = 0; k + 1 < rings.length; k++) for (let s = 0; s < sides; s++) {
      const a = o0 + k * S1 + s, b = a + 1, c = a + S1 + 1, d = a + S1;
      B.i.push(a, b, c, a, c, d);
    }
  }
  // cartes de feuillage (recto + verso, normales « en boule » pour un éclairage de houppier arrondi)
  function leafCards(B, cx, cy, cz, R, n, col, rng) {
    for (let k = 0; k < n; k++) {
      const th = rng() * 6.283, ph = Math.acos(1 - 2 * rng()), rr = R * (0.35 + 0.55 * rng());
      const c = [cx + Math.sin(ph) * Math.cos(th) * rr, cy + Math.cos(ph) * rr * 0.8, cz + Math.sin(ph) * Math.sin(th) * rr];
      const nn = _nrm([rng() - 0.5, rng() - 0.5, rng() - 0.5]);
      const u = _nrm(_crs(nn, Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), w = _crs(nn, u), s = R * (0.55 + rng() * 0.35);
      const v = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c[0] + (u[0] * a + w[0] * b) * s, c[1] + (u[1] * a + w[1] * b) * s, c[2] + (u[2] * a + w[2] * b) * s]);
      const sh = 0.75 + 0.35 * ((c[1] - cy) / R + 1) / 2 + (rng() - 0.5) * 0.15;
      for (const flip of [0, 1]) {
        const o = B.p.length / 3, order = flip ? [0, 3, 2, 1] : [0, 1, 2, 3], uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (const q of order) {
          const p = v[q], nv = _nrm([p[0] - cx, (p[1] - cy) + R * 0.35, p[2] - cz]);
          B.p.push(p[0], p[1], p[2]); B.n.push(nv[0], nv[1], nv[2]); B.u.push(uvs[q][0], uvs[q][1]); B.c.push(col[0] * sh, col[1] * sh, col[2] * sh);
        }
        B.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
    }
  }
  // o = { kind: 'broad' | 'conifer' | 'shrub', scale, hue: [r,g,b] (couleur du feuillage) }
  function treeMesh(B, x, b, z, rng, o) {
    o = o || {};
    const kind = o.kind || 'broad', sc = o.scale || (0.85 + rng() * 0.35);
    const TB = B('bark'), LB = B('leaf'), CB = B('leafc');
    // couleurs de sommet = teinte multipliée par la texture (écorce / feuilles dessinées dans textures.js)
    const g0 = 0.85 + rng() * 0.3, hue = o.hue || [0.66 * g0, 0.8 * g0, 0.6 * g0];
    const barkC = [0.8 + rng() * 0.12, 0.76 + rng() * 0.1, 0.72 + rng() * 0.08];
    if (kind === 'shrub') {
      const R = 0.7 * sc;
      icoBlob(LB, x, b + R * 0.75, z, R * 0.85, hue.map(v => v * 0.6), 0.85, 1);
      leafCards(CB, x, b + R * 0.8, z, R * 1.1, 10, hue, rng);
      return;
    }
    const th = (kind === 'conifer' ? 1.4 : 2.3 + rng() * 0.8) * sc, r0 = (kind === 'conifer' ? 0.17 : 0.2) * sc;
    const lx = (rng() - 0.5) * 0.35 * sc, lz = (rng() - 0.5) * 0.35 * sc;
    const H = kind === 'conifer' ? th + 4.2 * sc : th + 0.6;
    const pts = [], rad = [];
    const N = 6;
    for (let k = 0; k <= N; k++) {
      const t = k / N, bend = Math.sin(t * Math.PI * 0.8);
      pts.push([x + lx * bend, b - 0.12 + H * t, z + lz * bend]);
      rad.push(r0 * (k === 0 ? 1.55 : k === 1 ? 1.12 : 1 - t * 0.55));
    }
    tube(TB, pts, rad, 9, barkC, 2);
    // racines : contreforts qui plongent dans le sol
    const nr = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < nr; k++) {
      const a = k / nr * 6.283 + rng() * 0.6, L = (0.45 + rng() * 0.3) * sc;
      tube(TB, [[x, b + 0.35 * sc, z], [x + Math.cos(a) * L * 0.55, b + 0.06, z + Math.sin(a) * L * 0.55], [x + Math.cos(a) * L, b - 0.08, z + Math.sin(a) * L]], [r0 * 0.55, r0 * 0.32, r0 * 0.08], 5, barkC.map(v => v * 0.9), 1);
    }
    if (kind === 'conifer') {
      // étages de branches en cônes, du plus large au plus étroit
      const layers = 5;
      for (let k = 0; k < layers; k++) {
        const t = k / layers, y0 = b + th + t * (H - th) * 0.92, R = (1.9 - t * 1.45) * sc, h = (1.5 - t * 0.5) * sc;
        const c = hue.map(v => v * (0.75 + t * 0.25));
        tube(LB, [[x + lx, y0, z + lz], [x + lx, y0 + h * 0.25, z + lz], [x + lx, y0 + h, z + lz]], [R, R * 0.72, 0.05], 9, c, 3);
        leafCards(CB, x + lx, y0 + h * 0.3, z + lz, R * 0.8, 5, c, rng);
      }
      return;
    }
    // branches maîtresses
    const top = pts[N], nb = 4 + Math.floor(rng() * 3), ends = [];
    for (let k = 0; k < nb; k++) {
      const a = k / nb * 6.283 + rng() * 0.8, t0 = 0.55 + rng() * 0.35, base = [x + lx * t0, b + H * t0 - 0.1, z + lz * t0];
      const L = (1.1 + rng() * 0.8) * sc, up = 0.55 + rng() * 0.45;
      const mid = [base[0] + Math.cos(a) * L * 0.5, base[1] + up * L * 0.45, base[2] + Math.sin(a) * L * 0.5];
      const end = [base[0] + Math.cos(a) * L, base[1] + up * L, base[2] + Math.sin(a) * L];
      tube(TB, [base, mid, end], [r0 * 0.45, r0 * 0.3, r0 * 0.1], 6, barkC, 1);
      ends.push(end);
    }
    // houppier : volume sombre + cartes de feuillage autour des bouts de branches
    const cr = (1.35 + rng() * 0.35) * sc;
    // le volume intérieur reste petit (les cartes le recouvrent) : sinon ses facettes apparaissent comme des plaques sombres
    icoBlob(LB, top[0], top[1] + cr * 0.55, top[2], cr * 0.68, hue.map(v => v * 0.7), 0.85, 1);
    leafCards(CB, top[0], top[1] + cr * 0.6, top[2], cr * 1.15, 18, hue, rng);
    for (const e of ends) {
      const R = (0.85 + rng() * 0.35) * sc;
      icoBlob(LB, e[0], e[1] + R * 0.25, e[2], R * 0.48, hue.map(v => v * 0.7), 0.8, 1);
      leafCards(CB, e[0], e[1] + R * 0.3, e[2], R, 9, hue, rng);
    }
  }
  W_.treeMesh = treeMesh;
  // disque horizontal (éventail) ; down : face vers le bas
  function disk(B, cx, y, cz, r, sides, down, col) {
    const c = col == null ? [1, 1, 1] : Array.isArray(col) ? col : [col, col, col], ny = down ? -1 : 1;
    const o = B.p.length / 3;
    B.p.push(cx, y, cz); B.n.push(0, ny, 0); B.u.push(cx / 2, cz / 2); B.c.push(c[0], c[1], c[2]);
    for (let s = 0; s <= sides; s++) { const a = s / sides * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; B.p.push(x, y, z); B.n.push(0, ny, 0); B.u.push(x / 2, z / 2); B.c.push(c[0], c[1], c[2]); }
    for (let s = 0; s < sides; s++) { if (down) B.i.push(o, o + 1 + s, o + 2 + s); else B.i.push(o, o + 2 + s, o + 1 + s); }
  }
  // cylindre / tronc de cône vertical avec couvercles
  function cyl(B, cx, cz, y0, y1, r0, r1, sides, col, caps) {
    tube(B, [[cx, y0, cz], [cx, y1, cz]], [r0, r1 == null ? r0 : r1], sides || 8, col == null ? 1 : col, 1);
    if (caps !== false) { if (r1 == null || r1 > 0.001) disk(B, cx, y1, cz, r1 == null ? r0 : r1, sides || 8, false, col); if (caps === 'both') disk(B, cx, y0, cz, r0, sides || 8, true, col); }
  }
  // panneau texte (plan vertical) : la texture est libérée avec le matériau
  function signMesh(canvas, w, h, opt) {
    opt = opt || {};
    const t = new THREE.CanvasTexture(canvas); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    const mat = opt.lit ? new THREE.MeshStandardMaterial({ map: t, roughness: opt.rough != null ? opt.rough : 0.6, emissive: opt.emissive ? new THREE.Color(opt.emissive) : new THREE.Color(0), emissiveMap: opt.emissive ? t : null, side: opt.double ? THREE.DoubleSide : THREE.FrontSide })
      : new THREE.MeshBasicMaterial({ map: t, side: opt.double ? THREE.DoubleSide : THREE.FrontSide, transparent: !!opt.transparent });
    if (opt.color) mat.color = new THREE.Color(opt.color);
    mat.addEventListener('dispose', () => t.dispose());
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  }
  // lampadaire : lumière ponctuelle gérée par le jeu (les plus proches s'allument)
  function lampLight(m, x, y, z, rng, o) {
    o = o || {};
    const L = { f: Math.max(0, Math.floor((y - 0.5) / SH)), cx: Math.floor(x / C), cy: Math.floor(z / C), y, kind: 'lamp', dead: rng() < (o.dead != null ? o.dead : 0.1), flicker: rng() < (o.flicker != null ? o.flicker : 0.15), phase: rng() * 100, px: x, pz: z };
    m.lights.push(L); return L;
  }
  function propMesh(PB, B, p, rng) {
    const { x, z, base: b } = p, hw = p.w / 2, hd = p.d / 2;
    const bx = (x0, y0, z0, x1, y1, z1, col) => box(PB, x0, y0, z0, x1, y1, z1, typeof col === 'string' ? hex(col) : col, 0.5);
    switch (p.kind) {
      case 'box': {
        const c = hex(rng() < 0.5 ? '#9c7a4b' : '#86663c');
        if (p.h > 1) { bx(x - hw, b, z - hd, x + hw, b + 0.58, z + hd, c); bx(x - hw * 0.85, b + 0.58, z - hd * 0.8, x + hw * 0.8, b + p.h, z + hd * 0.85, hex('#a5834f')); }
        else bx(x - hw, b, z - hd, x + hw, b + p.h, z + hd, c);
        break;
      }
      case 'bench': {
        const along = p.w >= p.d;
        bx(x - hw, b + 0.36, z - hd, x + hw, b + 0.45, z + hd, '#7a5532');
        for (const s of [-1, 1]) along ? bx(x + s * hw * 0.8 - 0.06, b, z - hd * 0.8, x + s * hw * 0.8 + 0.06, b + 0.36, z + hd * 0.8, '#333') : bx(x - hw * 0.8, b, z + s * hd * 0.8 - 0.06, x + hw * 0.8, b + 0.36, z + s * hd * 0.8 + 0.06, '#333');
        break;
      }
      case 'planter': bx(x - hw, b, z - hd, x + hw, b + p.h, z + hd, '#b9b4a8'); bx(x - hw * 0.85, b + p.h - 0.02, z - hd * 0.85, x + hw * 0.85, b + p.h + 0.02, z + hd * 0.85, '#3b2a1c'); if (!(BR.Assets && BR.Assets.ready)) bx(x - hw * 0.8, b + p.h, z - hd * 0.8, x + hw * 0.8, b + p.h + 0.7, z + hd * 0.8, '#2f6b33'); break;
      case 'kiosk': bx(x - hw, b, z - hd, x + hw, b + p.h, z + hd, '#e6e1d4'); bx(x - hw, b + p.h - 0.08, z - hd, x + hw, b + p.h, z + hd, '#c43b2d'); bx(x - 0.05, b + p.h, z - 0.05, x + 0.05, b + 2.4, z + 0.05, '#888'); bx(x - hw, b + 2.4, z - hd, x + hw, b + 2.5, z + hd, '#c43b2d'); break;
      case 'shelf': {
        const col = hex(['#3f6fa3', '#a33f3f', '#3fa36b', '#a3893f'][Math.floor(rng() * 4)]);
        bx(x - hw, b, z - hd, x + hw, b + p.h, z + hd, '#5a5a5a');
        for (let k = 0; k < 4; k++) bx(x - hw * 0.95, b + 0.15 + k * 0.45, z - hd - 0.01, x + hw * 0.95, b + 0.45 + k * 0.45, z + hd + 0.01, col.map(v => v * (0.8 + rng() * 0.4)));
        break;
      }
      case 'counter': bx(x - hw, b, z - hd, x + hw, b + p.h, z + hd, '#d9d2c3'); bx(x - hw, b + p.h - 0.05, z - hd, x + hw, b + p.h, z + hd, '#3b3b3b'); break;
      case 'bin': bx(x - hw, b, z - hd, x + hw, b + p.h, z + hd, '#2d4d36'); break;
      case 'dumpster': bx(x - hw, b, z - hd, x + hw, b + p.h, z + hd, '#2e5a2e'); bx(x - hw - 0.02, b + p.h - 0.1, z - hd - 0.02, x + hw + 0.02, b + p.h, z + hd + 0.02, '#1f3d1f'); break;
      case 'lamp': bx(x - 0.12, b, z - 0.12, x + 0.12, b + 5.8, z + 0.12, '#3a3d40'); bx(x - 0.35, b + 5.6, z - 0.35, x + 0.35, b + 5.8, z + 0.35, '#2b2d30'); box(B('glow'), x - 0.28, b + 5.5, z - 0.28, x + 0.28, b + 5.6, z + 0.28, [1, 0.92, 0.7]); break;
      case 'tree': treeMesh(B, x, b, z, rng, p.data && p.data.tree); break;
      case 'ac': bx(x - hw, b, z - hd, x + hw, b + p.h, z + hd, '#8d9296'); bx(x - hw * 0.7, b + p.h, z - hd * 0.7, x + hw * 0.7, b + p.h + 0.05, z + hd * 0.7, '#2a2d30'); break;
      case 'fountain': { if (p.part) break; const cx = x + 1, cz = z + 1; bx(cx - 1.8, b, cz - 1.8, cx + 1.8, b + p.h, cz + 1.8, '#9e9a90'); box(B('water'), cx - 1.55, b + p.h - 0.08, cz - 1.55, cx + 1.55, b + p.h - 0.02, cz + 1.55, [0.6, 0.8, 1]); bx(cx - 0.25, b, cz - 0.25, cx + 0.25, b + 1.6, cz + 0.25, '#8c887e'); break; }
      case 'car': {
        if (p.part) break;
        const col = hex(p.color || '#b8312f'), along = p.rot === 0;
        const L = 4.0, Wd = 1.75, cx = along ? x + 1 : x, cz = along ? z : z + 1;
        const ex = along ? L / 2 : Wd / 2, ez = along ? Wd / 2 : L / 2;
        bx(cx - ex, b + 0.3, cz - ez, cx + ex, b + 0.9, cz + ez, col);
        const cex = along ? ex * 0.55 : ex * 0.92, cez = along ? ez * 0.92 : ez * 0.55;
        bx(cx - cex, b + 0.9, cz - cez, cx + cex, b + 1.3, cz + cez, col.map(v => v * 0.85));
        box(B('glass'), cx - cex * 1.01, b + 0.95, cz - cez * 1.01, cx + cex * 1.01, b + 1.25, cz + cez * 1.01, [0.25, 0.35, 0.45]);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wx = cx + sx * (along ? ex * 0.65 : ex), wz = cz + sz * (along ? ez : ez * 0.65); bx(wx - 0.32, b, wz - 0.32, wx + 0.32, b + 0.6, wz + 0.32, '#151515'); }
        break;
      }
      default: bx(x - hw, b, z - hd, x + hw, b + p.h, z + hd, '#888');
    }
  }

  // polyèdre (feuillage, tronc) ajouté au tampon ; sy : étirement vertical, det : niveau de détail
  const icoCache = {};
  function icoBlob(B, x, y, z, r, col, sy, det) {
    const k = 'd' + det; const g = icoCache[k] || (icoCache[k] = (g0 => g0.index ? g0.toNonIndexed() : g0)(new THREE.IcosahedronGeometry(1, det)));
    const P = g.attributes.position.array;
    for (let i = 0; i < P.length; i += 9) {
      const v = [0, 1, 2].map(j => [x + P[i + j * 3] * r, y + P[i + j * 3 + 1] * r * sy, z + P[i + j * 3 + 2] * r]);
      const e1 = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]], e2 = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0], nl = Math.hypot(nx, ny, nz) || 1;
      const sh = 0.85 + Math.random() * 0.3;
      const o = B.p.length / 3;
      for (const q of v) { B.p.push(q[0], q[1], q[2]); B.n.push(nx / nl, ny / nl, nz / nl); B.u.push(q[0] * 0.5, q[2] * 0.5); B.c.push(col[0] * sh, col[1] * sh, col[2] * sh); }
      B.i.push(o, o + 1, o + 2);
    }
  }
  /* ---------- modèles 3D (KayKit CC0) pour les objets du décor ---------- */
  let curT = null;     // thème de la carte en cours de construction (pour addInstances)
  const CARS = ['city_car_sedan', 'city_car_hatchback', 'city_car_taxi', 'city_car_stationwagon', 'city_car_police'];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function put(inst, name, x, y, z, ry, sc, sy) {
    if (!BR.Assets.models[name]) return false;
    _e.set(0, ry || 0, 0); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sc, sy || sc, sc);
    (inst[name] || (inst[name] = [])).push(new THREE.Matrix4().compose(_p, _q, _s));
    return true;
  }
  function modelProp(m, p, rng, inst) {
    const b = p.base, PI2 = Math.PI / 2;
    switch (p.kind) {
      case 'car': {
        if (p.part) return true;
        const name = CARS[Math.abs(p.link || 0) % CARS.length], along = p.rot === 0;
        const cx = along ? p.x + 1 : p.x, cz = along ? p.z : p.z + 1;
        return put(inst, name, cx, b, cz, (along ? PI2 : 0) + ((p.link || 0) % 2 ? Math.PI : 0), 4.4);
      }
      case 'lamp': return put(inst, 'city_streetlight', p.x, b, p.z, p.rot || 0, 6.2);
      case 'bench': return put(inst, 'city_bench', p.x, b, p.z, p.w >= p.d ? 0 : PI2, 4.4);
      case 'dumpster': return put(inst, 'city_dumpster', p.x, b, p.z, rng() < 0.5 ? 0 : Math.PI, 3.3);
      case 'hydrant': return put(inst, 'city_firehydrant', p.x, b, p.z, rng() * 6, 4.4);
      case 'tlight': return put(inst, 'city_trafficlight_A', p.x, b, p.z, (p.rot || 0) * PI2, 6.2);
      case 'tower': return put(inst, 'city_watertower', p.x, b, p.z, rng() * 6, 5.4);
      case 'box': { const n = rng() < 0.5 ? 'city_box_A' : 'city_box_B'; put(inst, n, p.x, b, p.z, rng() * 0.6, 5.5); if (p.h > 1) put(inst, n === 'city_box_A' ? 'city_box_B' : 'city_box_A', p.x + (rng() - 0.5) * 0.1, b + 1.0, p.z, rng() * 0.8, 4.6); return true; }
      case 'shelf': return put(inst, 'furn_cabinet_medium_decorated', p.x, b, p.z, p.w >= p.d ? 0 : PI2, 0.85);
      case 'counter': return put(inst, 'furn_table_medium', p.x, b, p.z, 0, 0.88);
      case 'planter': put(inst, 'furn_cactus_medium_A', p.x, b + p.h, p.z, rng() * 6, 0.9); return false;
      default: return false;
    }
  }
  function addInstances(group, name, mats) {
    const g = BR.Assets.models[name]; if (!g || !mats.length) return;
    const root = g.scene; root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh) return;
      // matériau adapté au thème (carrosseries et vitres qui reflètent, mouillé sous la pluie…) — voir BR.Tex.modelMat
      const mat = curT && curT.modelMat ? curT.modelMat(o.material, name) : o.material;
      const im = new THREE.InstancedMesh(o.geometry, mat, mats.length);
      for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, _m.multiplyMatrices(mats[i], o.matrixWorld));
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false;
      group.add(im);
    });
  }
  // marquages routiers, passages piétons, bordures de trottoir
  function cityDecor(m, B, inst, rng) {
    const W = m.W, paint = B('paint'), curb = B('curb'), Y = 0.012;
    const strip = (Bf, x0, z0, x1, z1, y, col) => quad(Bf, [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], col || 1);
    const isAsph = (x, y) => inb(m, x, y) && m.t[0][y * W + x] === FLOOR && m.zone[0][y * W + x] === 1 && m.t[1][y * W + x] === VOID;
    const isWalk = (x, y) => inb(m, x, y) && m.t[0][y * W + x] === FLOOR && m.zone[0][y * W + x] === 2;
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      if (!isAsph(x, y)) continue;
      const X = x * C, Z = y * C;
      const horiz = isAsph(x - 1, y) && isAsph(x + 1, y) && !isAsph(x, y - 2) && !isAsph(x, y + 2), vert = isAsph(x, y - 1) && isAsph(x, y + 1) && !isAsph(x - 2, y) && !isAsph(x + 2, y);
      // ligne centrale en pointillés (cellule du milieu de la rue de 3 cases)
      if (horiz && isAsph(x, y - 1) && isAsph(x, y + 1)) strip(paint, X + 0.2, Z + C / 2 - 0.08, X + 1.2, Z + C / 2 + 0.08, Y, [0.95, 0.8, 0.25]);
      if (vert && isAsph(x - 1, y) && isAsph(x + 1, y)) strip(paint, X + C / 2 - 0.08, Z + 0.2, X + C / 2 + 0.08, Z + 1.2, Y, [0.95, 0.8, 0.25]);
    }
    // passages piétons : bandes blanches devant chaque carrefour
    for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 1; x++) {
      if (!isAsph(x, y)) continue;
      const X = x * C, Z = y * C;
      // cellule de rue bordée de trottoirs des deux côtés (rue verticale) et carrefour juste au nord ou au sud
      if (isWalk(x - 1, y) && isAsph(x + 1, y) && isAsph(x + 2, y) && isWalk(x + 3, y) && (isAsph(x - 1, y - 1) || isAsph(x - 1, y + 1)))
        for (let k = 0; k < 6; k++) strip(paint, X + 0.15 + k, Z + 0.4, X + 0.55 + k, Z + 1.6, Y, [0.92, 0.92, 0.9]);
      if (isWalk(x, y - 1) && isAsph(x, y + 1) && isAsph(x, y + 2) && isWalk(x, y + 3) && (isAsph(x - 1, y - 1) || isAsph(x + 1, y - 1)))
        for (let k = 0; k < 6; k++) strip(paint, X + 0.4, Z + 0.15 + k, X + 1.6, Z + 0.55 + k, Y, [0.92, 0.92, 0.9]);
    }
    // bordures : petite marche visuelle entre trottoir et chaussée
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      if (!isWalk(x, y)) continue;
      const X = x * C, Z = y * C, h = 0.1, t = 0.18;
      if (isAsph(x + 1, y)) box(curb, X + C - t, 0, Z, X + C, h, Z + C, [0.75, 0.75, 0.74], 0.5);
      if (isAsph(x - 1, y)) box(curb, X, 0, Z, X + t, h, Z + C, [0.75, 0.75, 0.74], 0.5);
      if (isAsph(x, y + 1)) box(curb, X, 0, Z + C - t, X + C, h, Z + C, [0.75, 0.75, 0.74], 0.5);
      if (isAsph(x, y - 1)) box(curb, X, 0, Z, X + C, h, Z + t, [0.75, 0.75, 0.74], 0.5);
    }
  }
  // silhouette de la ville au-delà du mur d'enceinte
  function skyline(m, inst, rng) {
    const names = ['city_building_C', 'city_building_D', 'city_building_G', 'city_building_H', 'city_building_E', 'city_building_F'];
    const Wm = m.W * C, Hm = m.H * C;
    for (let ring = 0; ring < 2; ring++) {
      const d = 14 + ring * 22, step = 18 + ring * 6;
      for (let t = -d; t < Wm + d; t += step) {
        for (const [x, z, ry] of [[t, -d, 0], [t, Hm + d, Math.PI], [-d, t, Math.PI / 2], [Wm + d, t, -Math.PI / 2]]) {
          if (rng() < 0.15) continue;
          const sc = 8 + rng() * 4;
          put(inst, names[Math.floor(rng() * names.length)], x + (rng() - 0.5) * 4, 0, z + (rng() - 0.5) * 4, ry, sc, sc * (1 + ring * 0.8 + rng() * 0.8));
        }
      }
    }
  }

  /* ---------- tirage d'un emplacement libre près d'un point (pour les objets lancés) ---------- */
  W_.free = (m, x, y, z, r) => !W_.blocked(m, x, z, y, r);

  // fonctions internes exposées aux cartes des fichiers js/maps/*.js
  W_.H = { C, SH, STEP, SLAB, BODY, VOID, FLOOR, WALL, RAMP, inb, newMap, set, rect, rampH, addRamp, addProp, freeCell, finalize, connectLayer, ceilY, panelLights, roomsLayer,
    nearestFloor, farExit, carProps, genCity, genMall, genBackrooms, Buf, quad, tri, geo, box, hex, put, icoBlob, cityDecor, skyline, propMesh, modelProp, addInstances,
    quadN, tube, leafCards, treeMesh, rampMesh, disk, cyl, signMesh, lampLight };
})();

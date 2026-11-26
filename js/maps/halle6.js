/* ===== maps/halle6.js : HALLE 6 OUEST (Île de Nantes, quartier de la Création)
   Ancienne halle industrielle Alstom (chantiers navals puis mécanique lourde), reconvertie en pôle universitaire
   des cultures numériques (Nantes Université) : grande nef centrale de plus de 1000 m² sur toute la hauteur,
   poteaux béton au rez-de-chaussée, charpente métallique et toiture en sheds vitrés, longues coursives et
   passerelles métalliques, « cube » suspendu dans la nef, Manufacturing Lab (fablab), Experience Lab, salles,
   coworking, studio du Digital Learning Lab. Tout est reconstruit en géométrie et textures dessinées par code.

   Ce fichier contient aussi BR.CarteKit, la boîte à outils commune aux cartes Halle 6 / IUT / Verdun :
   objets invisibles (collision) dessinés à la main, garde-corps (collision joueurs + retrait des sauts des entités),
   géométrie libre (poutres, cylindres), panneaux de texte regroupés dans une seule texture.               ===== */
(function () {
  const BR = window.BR;
  const K = (BR.CarteKit = BR.CarteKit || {});
  const C = 2, SH = 4, VOID = 0, FLOOR = 1, WALL = 2, RAMP = 3;
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* =====================================================================
     BOÎTE À OUTILS COMMUNE
     ===================================================================== */
  K.ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  K.mk = function (w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
  // grain très léger
  K.grain = function (g, w, h, amt) {
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
  };
  // taches douces
  K.blot = function (g, w, h, n, col, amin, amax, rmin, rmax) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = rmin + Math.random() * (rmax - rmin), a = amin + Math.random() * (amax - amin);
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {     // raccord sans couture
        const cx = x + ox, cy = y + oy; if (cx + r < 0 || cx - r > w || cy + r < 0 || cy - r > h) continue;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
  };
  K.shade = function (c, k) { const n = parseInt(c.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  K.vary = (c, a) => K.shade(c, 1 + (Math.random() - 0.5) * a);
  // couleur de sommet « correcte » (sRGB -> linéaire) : les teintes sortent comme dessinées
  const colCache = {};
  K.col = function (h) { if (Array.isArray(h)) return h; if (colCache[h]) return colCache[h]; const c = new THREE.Color(h).convertSRGBToLinear(); return (colCache[h] = [c.r, c.g, c.b]); };
  K.mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  // objet invisible : collision + navigation ; le dessin est fait par le décor de la carte (p.sub)
  // (p.nodraw, et par sécurité type « fountain » + part=1 : le moteur ne dessine rien pour cet objet)
  K.solid = function (m, H, f, cx, cy, sub, h, w, d, o) {
    o = o || {};
    const p = H.addProp(m, f, cx, cy, 'fountain', h, w, d, { ox: o.ox || 0, oz: o.oz || 0, rot: o.rot || 0, part: 1 });
    if (p) { p.sub = sub; p.nodraw = true; p.ry = o.ry || 0; p.v = o.v != null ? o.v : 0; p.data = o.data; }
    return p;
  };
  // objet posé à la main (base et boîte libres, dans une seule case)
  K.pushProp = function (m, f, i, x0, z0, x1, z1, base, h, sub) {
    const cx = i % m.W, cy = (i / m.W) | 0;
    const p = { f, cx, cy, i, kind: 'fountain', h, w: x1 - x0, d: z1 - z0, x: (x0 + x1) / 2, z: (z0 + z1) / 2, x0, x1, z0, z1, base, rot: 0, part: 1, id: m.props.length, sub, nodraw: true };
    m.props.push(p); m.propAt[f][i] = p.id;
    return p;
  };

  /* ---------- garde-corps ----------
     Chaque bord entre une dalle praticable (étage ≥ 1) et le vide reçoit une lisse de 0,5 m posée à 0,6 m au-dessus de la dalle :
     elle arrête les joueurs (on peut l'enjamber d'un saut) sans rendre la case impraticable pour les entités (hauteur ≤ STEP).
     La collision est rangée dans la case du dessous (sous le vide) ou, à défaut, dans la dalle elle-même. Après finalize,
     K.cutJumps retire des chemins des entités les sauts qui traversent un garde-corps.                                     */
  K.rails = function (m, opt) {
    opt = opt || {};
    const W = m.W, WH = m.WH, groups = new Map(), T = 0.08;
    const arrival = (fu, U, V) => m.ramps.some(r => !r.dead && r.f + 1 === fu && r.landing === U && r.cells.includes(V));
    for (let f = 1; f < m.F; f++) for (let y = 0; y < m.H; y++) for (let x = 0; x < W; x++) {
      const U = y * W + x; if (m.t[f][U] !== FLOOR) continue;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= m.H) continue;
        const V = ny * W + nx; if (m.t[f][V] !== VOID) continue;
        if (arrival(f, U, V)) continue;
        if (opt.skip && opt.skip(f, x, y, nx, ny)) continue;
        const key = f * WH + V; if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ U, V, x, y, nx, ny, dx, dy });
      }
    }
    const rails = [];
    const strip = (cx, cy, sx, sy) => {   // bande dans la case (cx,cy), le long de son côté (sx,sy)
      const X0 = cx * C, Z0 = cy * C;
      if (sx === 1) return [X0 + C - T, Z0, X0 + C, Z0 + C];
      if (sx === -1) return [X0, Z0, X0 + T, Z0 + C];
      if (sy === 1) return [X0, Z0 + C - T, X0 + C, Z0 + C];
      return [X0, Z0, X0 + C, Z0 + T];
    };
    for (const [key, es] of groups) {
      const fu = Math.floor(key / WH), V = key - fu * WH;
      let fv = -1; for (let g = fu - 1; g >= 0; g--) { const t = m.t[g][V]; if (t === VOID) continue; if (t === FLOOR) fv = g; break; }
      const base = fu * SH + 0.6, h = 0.5;
      if (fv >= 0 && m.propAt[fv][V] < 0) {
        let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
        for (const e of es) { const s = strip(e.nx, e.ny, -e.dx, -e.dy); x0 = Math.min(x0, s[0]); z0 = Math.min(z0, s[1]); x1 = Math.max(x1, s[2]); z1 = Math.max(z1, s[3]); }
        K.pushProp(m, fv, V, x0, z0, x1, z1, base, h, 'rail');
        for (const e of es) rails.push(Object.assign({ f: fu }, e));
      } else {
        for (const e of es) {
          if (m.propAt[fu][e.U] >= 0) continue;
          const s = strip(e.x, e.y, e.dx, e.dy);
          K.pushProp(m, fu, e.U, s[0], s[1], s[2], s[3], base, h, 'rail');
          rails.push(Object.assign({ f: fu }, e));
        }
      }
    }
    m.rails = rails;
    return rails;
  };
  // retire les sauts « à travers » un garde-corps du graphe des entités, puis revérifie la carte
  K.cutJumps = function (m) {
    const W_ = BR.World, WH = m.WH, nav = m.nav, N = nav.N, cut = new Set();
    for (const r of m.rails || []) cut.add((r.f * WH + r.U) * 8192 + r.V);
    if (!cut.size) return true;
    const fwL = [];
    for (let n = 0; n < N; n++) {
      const f = Math.floor(n / WH), a = [];
      for (let e = nav.fw.off[n]; e < nav.fw.off[n + 1]; e++) {
        const t = nav.fw.to[e], g = Math.floor(t / WH), j = t - g * WH;
        if (g < f && cut.has(n * 8192 + j)) continue;
        a.push(t);
      }
      fwL.push(a);
    }
    const bwL = []; for (let n = 0; n < N; n++) bwL.push([]);
    fwL.forEach((a, n) => a.forEach(t => bwL[t].push(n)));
    const csr = L => { const off = new Int32Array(N + 1); let e = 0; for (let n = 0; n < N; n++) { off[n] = e; e += L[n].length; } off[N] = e; const to = new Int32Array(e); for (let n = 0; n < N; n++) to.set(L[n], off[n]); return { off, to }; };
    nav.fw = csr(fwL); nav.bw = csr(bwL);
    // revérification : tout ce qui est atteignable doit encore pouvoir rejoindre la sortie
    m.distSpawn = W_.forward(m, m.spawnNode);
    const toExit = W_.field(m, m.exitNode);
    m.reach = []; let maxD = 0;
    for (let n = 0; n < N; n++) if (m.distSpawn[n] >= 0 && nav.walk[n]) { if (toExit[n] < 0) return false; m.reach.push(n); if (m.distSpawn[n] > maxD) maxD = m.distSpawn[n]; }
    m.maxDist = maxD;
    if (m.distSpawn[m.exitNode] < 0) return false;
    for (const fu of m.fuses) { const n = fu.f * WH + fu.cy * m.W + fu.cx; if (m.distSpawn[n] < 0) return false; }
    m.monNodes = m.reach.filter(n => m.distSpawn[n] >= Math.max(14, maxD * 0.4));
    if (m.monNodes.length < 10) m.monNodes = m.reach.slice(-50);
    return true;
  };

  /* ---------- géométrie libre ---------- */
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scl3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  K.v3 = { sub: sub3, add: add3, scl: scl3, cross: cross3, dot: dot3, nrm: nrm3 };
  // quadrilatère quelconque ; `out` (facultatif) = direction extérieure, corrige l'ordre des sommets
  // `us` : échelle des uv projetées (1 unité = 1/us m), ou tableau explicite de 4 uv
  K.face = function (B, a, b, c, d, col, out, us) {
    let n = nrm3(cross3(sub3(b, a), sub3(c, a)));
    let UV = Array.isArray(us) ? us.slice() : null;
    if (out && dot3(n, out) < 0) { const t = b; b = d; d = t; n = [-n[0], -n[1], -n[2]]; if (UV) { const u = UV[1]; UV[1] = UV[3]; UV[3] = u; } }
    if (!UV) {
      const s = us || 0.5, ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
      const uv = p => ay >= ax && ay >= az ? [p[0] * s, p[2] * s] : ax >= az ? [p[2] * s, p[1] * s] : [p[0] * s, p[1] * s];
      UV = [uv(a), uv(b), uv(c), uv(d)];
    }
    BR.World.H.quad(B, [a, b, c, d], n, UV, col == null ? 1 : col);
  };
  // poutre à section rectangulaire de p0 à p1 (w : largeur horizontale, h : hauteur)
  K.bar = function (B, p0, p1, w, h, col, us) {
    const d = nrm3(sub3(p1, p0));
    let s = cross3(d, [0, 1, 0]); if (Math.hypot(s[0], s[1], s[2]) < 1e-4) s = [1, 0, 0]; s = nrm3(s);
    const u = nrm3(cross3(s, d)), hw = w / 2, hh = h / 2;
    const P = (p, a, b) => add3(add3(p, scl3(s, a * hw)), scl3(u, b * hh));
    const A = [P(p0, -1, -1), P(p0, 1, -1), P(p0, 1, 1), P(p0, -1, 1)], Bq = [P(p1, -1, -1), P(p1, 1, -1), P(p1, 1, 1), P(p1, -1, 1)];
    const outs = [scl3(u, -1), s, u, scl3(s, -1)];
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; K.face(B, A[k], A[k2], Bq[k2], Bq[k], col, outs[k], us); }
    K.face(B, A[0], A[1], A[2], A[3], col, scl3(d, -1), us); K.face(B, Bq[0], Bq[1], Bq[2], Bq[3], col, d, us);
  };
  // cylindre (prisme à `seg` côtés) de p0 à p1
  K.cyl = function (B, p0, p1, r, seg, col, caps, r1) {
    seg = seg || 8; r1 = r1 == null ? r : r1;
    const d = nrm3(sub3(p1, p0));
    let s = cross3(d, [0, 1, 0]); if (Math.hypot(s[0], s[1], s[2]) < 1e-4) s = [1, 0, 0]; s = nrm3(s);
    const u = nrm3(cross3(s, d));
    const ring = (p, rr, k) => { const a = k / seg * Math.PI * 2; return add3(p, add3(scl3(s, Math.cos(a) * rr), scl3(u, Math.sin(a) * rr))); };
    for (let k = 0; k < seg; k++) {
      const a = ring(p0, r, k), b = ring(p0, r, k + 1), c = ring(p1, r1, k + 1), e = ring(p1, r1, k);
      const mid = (k + 0.5) / seg * Math.PI * 2, out = add3(scl3(s, Math.cos(mid)), scl3(u, Math.sin(mid)));
      K.face(B, a, b, c, e, col, out);
    }
    if (caps) for (const [p, rr, sg] of [[p0, r, -1], [p1, r1, 1]]) for (let k = 0; k < seg; k += 2) K.face(B, p, ring(p, rr, k), ring(p, rr, k + 1), ring(p, rr, k + 2), col, scl3(d, sg));
  };
  K.box = (B, x0, y0, z0, x1, y1, z1, col, us) => BR.World.H.box(B, Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), typeof col === 'string' ? K.col(col) : col, us || 0.5);
  // boîte tournée d'un angle ry autour de (cx, cz) ; dimensions w (x local) × d (z local)
  K.rbox = function (B, cx, cz, ry, lx0, y0, lz0, lx1, y1, lz1, col) {
    const c = Math.cos(ry), s = Math.sin(ry), T = (x, z) => [cx + x * c + z * s, cz - x * s + z * c];
    const cl = typeof col === 'string' ? K.col(col) : col, top = cl.map(v => Math.min(1, v * 1.08)), side = cl.map(v => v * 0.82);
    const P = (x, y, z) => { const t = T(x, z); return [t[0], y, t[1]]; };
    const a = P(lx0, y0, lz0), b = P(lx1, y0, lz0), cc = P(lx1, y0, lz1), d = P(lx0, y0, lz1), e = P(lx0, y1, lz0), f = P(lx1, y1, lz0), g = P(lx1, y1, lz1), h = P(lx0, y1, lz1);
    const mid = P((lx0 + lx1) / 2, (y0 + y1) / 2, (lz0 + lz1) / 2), o = q => sub3(q, mid);
    const F = (p, q, r, t, cc2) => K.face(B, p, q, r, t, cc2, o(scl3(add3(add3(p, q), add3(r, t)), 0.25)));
    F(e, f, g, h, top); F(a, b, cc, d, side); F(a, b, f, e, cl); F(d, cc, g, h, cl); F(a, d, h, e, side); F(b, cc, g, f, side);
  };

  /* ---------- panneaux de texte (une seule texture par carte) ---------- */
  K.signs = function () {
    const list = [];
    return {
      add(o) { list.push(o); },   // { text, sub, bg, fg, w, h, x, y, z, ry, glow, font, border }
      build(group) {
        if (!list.length) return;
        const CW = 512, CH = 128, cols = 2, rows = Math.ceil(list.length / cols), AH = rows * CH;
        const cv = K.mk(CW * cols, AH, (g) => {
          list.forEach((o, k) => {
            const x0 = (k % cols) * CW, y0 = Math.floor(k / cols) * CH;
            g.save(); g.beginPath(); g.rect(x0, y0, CW, CH); g.clip();
            g.fillStyle = o.bg || '#20262c'; g.fillRect(x0, y0, CW, CH);
            if (o.border !== false) { g.strokeStyle = o.fg || '#fff'; g.lineWidth = 5; g.strokeRect(x0 + 8, y0 + 8, CW - 16, CH - 16); }
            g.fillStyle = o.fg || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
            let fs = o.sub ? 50 : 62; g.font = `${o.weight || 700} ${fs}px ${o.font || "'Segoe UI', Arial, sans-serif"}`;
            while (g.measureText(o.text).width > CW - 50 && fs > 18) { fs -= 2; g.font = `${o.weight || 700} ${fs}px ${o.font || "'Segoe UI', Arial, sans-serif"}`; }
            g.fillText(o.text, x0 + CW / 2, y0 + (o.sub ? CH * 0.38 : CH / 2 + 3));
            if (o.sub) { g.font = `500 26px 'Segoe UI', Arial, sans-serif`; g.globalAlpha = 0.85; g.fillText(o.sub, x0 + CW / 2, y0 + CH * 0.75); g.globalAlpha = 1; }
            if (o.arrow) { g.beginPath(); const ax = x0 + (o.arrow < 0 ? 44 : CW - 44), ay = y0 + CH / 2; g.moveTo(ax + o.arrow * 22, ay); g.lineTo(ax - o.arrow * 6, ay - 22); g.lineTo(ax - o.arrow * 6, ay + 22); g.fill(); }
            g.restore();
          });
        });
        const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.anisotropy = 4;
        const mk = glow => {
          const Bf = BR.World.H.Buf();
          list.forEach((o, k) => {
            if (!!o.glow !== glow) return;
            const u0 = (k % cols) / cols, u1 = u0 + 1 / cols, v1 = 1 - Math.floor(k / cols) * CH / AH, v0 = v1 - CH / AH;
            const c = Math.cos(o.ry || 0), s = Math.sin(o.ry || 0), hw = o.w / 2, hh = o.h / 2;
            const P = (a, b) => [o.x + a * c, o.y + b, o.z - a * s];
            BR.World.H.quad(Bf, [P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)], [s, 0, c], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 1);
          });
          if (!Bf.i.length) return;
          const mat = glow ? new THREE.MeshBasicMaterial({ map: tex, vertexColors: true }) : new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, emissive: 0x222222, emissiveMap: tex });
          mat.polygonOffset = true; mat.polygonOffsetFactor = -2;
          const me = new THREE.Mesh(BR.World.H.geo(Bf), mat); me.matrixAutoUpdate = false; group.add(me);
        };
        mk(false); mk(true);
      },
    };
  };
  // matériau « grillage / tôle déployée » transparent (garde-corps, clôtures)
  const meshTexCache = {};
  K.meshMat = function (kind, color) {
    const key = kind;
    const t = meshTexCache[key] || (meshTexCache[key] = (() => {
      const cv = K.mk(128, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        if (kind === 'losange') {       // tôle déployée
          g.strokeStyle = '#fff'; g.lineWidth = 5;
          for (let k = -2; k < 6; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 + 64, 128); g.stroke(); g.beginPath(); g.moveTo(k * 32 + 64, 0); g.lineTo(k * 32, 128); g.stroke(); }
        } else if (kind === 'barreaux') { g.fillStyle = '#fff'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 4, h); }
        else if (kind === 'treillis') { g.fillStyle = '#fff'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 4, h); for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 5); g.fillRect(0, 16, w, 3); }   // panneau rigide de clôture
        else { g.fillStyle = '#fff'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2); }
      });
      const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 4; return tx;
    })());
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(color || 0x8a9096).convertSRGBToLinear(), alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
  };
  // panneau plat (grillage) : quad double face avec uv à l'échelle (1 unité = us m)
  K.panel = function (Bf, a, b, h, us) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), s = us || 1;
    const n = nrm3(cross3(sub3(b, a), [0, 1, 0]));
    BR.World.H.quad(Bf, [a, b, [b[0], b[1] + h, b[2]], [a[0], a[1] + h, a[2]]], n, [[0, 0], [L / s, 0], [L / s, h / s], [0, h / s]], 1);
  };
  K.addMesh = function (group, Bf, mat) { if (!Bf.i.length) return null; const me = new THREE.Mesh(BR.World.H.geo(Bf), mat); me.matrixAutoUpdate = false; group.add(me); return me; };

  // dessin d'un garde-corps standard (poteaux, main courante, plinthe, remplissage grillagé)
  K.drawRails = function (m, B, group, o) {
    o = o || {};
    const PB = B('p'), steel = K.col(o.color || '#3d454d'), MB = BR.World.H.Buf();
    const top = o.top ? K.col(o.top) : steel;
    for (const r of m.rails || []) {
      const y = r.f * SH, X0 = r.x * C, Z0 = r.y * C;
      // ligne du bord (côté dalle, 4 cm en retrait), de a à b
      let ax, az, bx, bz;
      if (r.dx === 1) { ax = bx = X0 + C - 0.04; az = Z0; bz = Z0 + C; }
      else if (r.dx === -1) { ax = bx = X0 + 0.04; az = Z0; bz = Z0 + C; }
      else if (r.dy === 1) { az = bz = Z0 + C - 0.04; ax = X0; bx = X0 + C; }
      else { az = bz = Z0 + 0.04; ax = X0; bx = X0 + C; }
      const ex = r.dx ? 0.025 : 0, ez = r.dy ? 0.025 : 0;      // demi-épaisseur perpendiculaire au bord
      for (const t of [0.25, 0.75]) { const px = ax + (bx - ax) * t, pz = az + (bz - az) * t; K.box(PB, px - 0.03, y, pz - 0.03, px + 0.03, y + 1.04, pz + 0.03, steel); }
      K.box(PB, Math.min(ax, bx) - ex * 1.4, y + 1.03, Math.min(az, bz) - ez * 1.4, Math.max(ax, bx) + ex * 1.4, y + 1.09, Math.max(az, bz) + ez * 1.4, top);
      K.box(PB, Math.min(ax, bx) - ex, y, Math.min(az, bz) - ez, Math.max(ax, bx) + ex, y + 0.12, Math.max(az, bz) + ez, steel);
      K.panel(MB, [ax, y + 0.12, az], [bx, y + 0.12, bz], 0.9, 0.25);
    }
    K.addMesh(group, MB, K.meshMat(o.mesh || 'losange', o.meshColor || '#7d868e'));
  };

  /* =====================================================================
     TEXTURES DE LA HALLE 6
     ===================================================================== */
  const Tx = BR.Tex, P = Tx.P, MK = Tx.MAKE, mk = K.mk;
  // fenêtre de nuit : dégradé bleu nuit, reflets, quelques lumières lointaines
  function nightGlass(g, e, x, y, w, h, lights) {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#0b1220'); gr.addColorStop(1, '#18243a'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    if (e) { const ge = e.createLinearGradient(0, y, 0, y + h); ge.addColorStop(0, 'rgba(20,30,55,1)'); ge.addColorStop(1, 'rgba(35,45,70,1)'); e.fillStyle = ge; e.fillRect(x, y, w, h); }
    for (let k = 0; k < lights; k++) {
      const lx = x + Math.random() * w, ly = y + h * (0.55 + Math.random() * 0.4), r = 1 + Math.random() * 2.2, c = Math.random() < 0.6 ? '255,196,120' : '210,225,255';
      for (const G of [g, e]) { if (!G) continue; G.fillStyle = `rgba(${c},0.95)`; G.beginPath(); G.arc(lx, ly, r, 0, 7); G.fill(); }
    }
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = 'rgba(255,255,255,0.06)';
    const rx = x + w * Math.random(); g.beginPath(); g.moveTo(rx, y); g.lineTo(rx + w * 0.25, y); g.lineTo(rx - w * 0.3, y + h); g.lineTo(rx - w * 0.55, y + h); g.fill(); g.restore();
  }
  const h6 = {};
  function facadePair() {       // murs longs extérieurs, vus de l'intérieur : allège béton, grandes baies, poteaux tous les 4 m
    if (h6.fa) return h6.fa;
    const col = mk(512, 512, () => {}), em = mk(512, 512, () => {}), g = col.getContext('2d'), e = em.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, 512, 512);
    g.fillStyle = '#a6a49e'; g.fillRect(0, 0, 512, 512); K.blot(g, 512, 512, 6, '0,0,0', 0.03, 0.07, 30, 120);
    const top = 70, bot = 398;
    nightGlass(g, e, 40, top, 432, bot - top, 7);
    g.fillStyle = '#2f353b'; for (const xx of [40, 184, 328, 466]) g.fillRect(xx, top, 7, bot - top);
    g.fillRect(40, top, 432, 7); g.fillRect(40, bot - 7, 432, 7); g.fillRect(40, top + 92, 432, 5);
    // poteaux béton (raccord aux bords) + linteau
    g.fillStyle = '#b4b2ab'; g.fillRect(0, 0, 40, 512); g.fillRect(472, 0, 40, 512);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(36, 0, 4, 512); g.fillRect(472, 0, 4, 512);
    g.fillStyle = '#9d9b95'; g.fillRect(40, bot, 432, 512 - bot); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(40, bot, 432, 3);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(40, top - 6, 432, 6);
    K.grain(g, 512, 512, 5);
    g.fillStyle = '#55524c'; g.fillRect(0, 496, 512, 16);
    return (h6.fa = { col, em });
  }
  function pignonPair() {       // pignons entièrement vitrés : trame acier 1 m × 1,33 m
    if (h6.pi) return h6.pi;
    const col = mk(512, 512, () => {}), em = mk(512, 512, () => {}), g = col.getContext('2d'), e = em.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, 512, 512);
    nightGlass(g, e, 0, 0, 512, 512, 14);
    g.fillStyle = '#39424b'; for (let x = 0; x < 512; x += 128) g.fillRect(x - 5, 0, 10, 512);
    for (const y of [0, 170, 341]) g.fillRect(0, y - 4, 512, 8);
    g.fillStyle = 'rgba(255,255,255,0.08)'; for (let x = 0; x < 512; x += 128) g.fillRect(x + 5, 0, 2, 512);
    g.fillStyle = '#2b3036'; g.fillRect(0, 490, 512, 22);
    return (h6.pi = { col, em });
  }
  function vitragePair() {      // cloisons vitrées des salles : allège stratifiée, vitrage, bande dépolie
    if (h6.vi) return h6.vi;
    const col = mk(512, 512, () => {}), em = mk(512, 512, () => {}), g = col.getContext('2d'), e = em.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, 512, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#46525c'); gr.addColorStop(1, '#5c6770'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    // lueur chaude de la salle derrière le verre
    const ge = e.createLinearGradient(0, 60, 0, 380); ge.addColorStop(0, 'rgba(90,80,60,1)'); ge.addColorStop(1, 'rgba(50,45,35,1)'); e.fillStyle = ge; e.fillRect(0, 50, 512, 335);
    g.fillStyle = 'rgba(255,255,255,0.07)'; for (let k = 0; k < 3; k++) { const x = 40 + k * 170 + Math.random() * 40; g.beginPath(); g.moveTo(x, 50); g.lineTo(x + 50, 50); g.lineTo(x - 30, 384); g.lineTo(x - 80, 384); g.fill(); }
    // bande dépolie
    g.fillStyle = 'rgba(235,238,240,0.82)'; g.fillRect(0, 300, 512, 30); e.fillStyle = 'rgba(70,70,70,1)'; e.fillRect(0, 300, 512, 30);
    g.fillStyle = 'rgba(160,170,178,0.9)'; for (let x = 8; x < 512; x += 24) g.fillRect(x, 309, 12, 12);
    // allège
    g.fillStyle = '#d9dcd9'; g.fillRect(0, 384, 512, 128); g.fillStyle = 'rgba(0,0,0,0.06)'; for (let x = 0; x < 512; x += 170) g.fillRect(x, 384, 3, 128);
    // montants alu
    g.fillStyle = '#a9afb4'; for (let x = 0; x < 512; x += 170.6) g.fillRect(x - 5, 0, 10, 512);
    g.fillRect(0, 44, 512, 10); g.fillRect(0, 380, 512, 10);
    g.fillStyle = '#7d8388'; g.fillRect(0, 498, 512, 14);
    return (h6.vi = { col, em });
  }
  function cubePair() {        // le cube suspendu : polycarbonate laiteux éclairé de l'intérieur
    if (h6.cu) return h6.cu;
    const col = mk(256, 512, () => {}), em = mk(256, 512, () => {}), g = col.getContext('2d'), e = em.getContext('2d');
    g.fillStyle = '#d9dfe4'; g.fillRect(0, 0, 256, 512);
    for (let x = 0; x < 256; x += 16) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x, 0, 3, 512); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 3, 0, 2, 512); }
    g.fillStyle = '#b9c0c6'; g.fillRect(0, 168, 256, 8); g.fillRect(0, 336, 256, 8); g.fillRect(124, 0, 8, 512);
    const ge = e.createLinearGradient(0, 0, 0, 512); ge.addColorStop(0, '#9ab'); ge.addColorStop(0.5, '#cfe0ec'); ge.addColorStop(1, '#8a9aa8'); e.fillStyle = ge; e.fillRect(0, 0, 256, 512);
    g.fillStyle = '#f4f6f7'; g.fillRect(0, 0, 256, 10); g.fillRect(0, 502, 256, 10); g.fillRect(0, 0, 8, 512); g.fillRect(248, 0, 8, 512);
    e.fillStyle = '#000'; e.fillRect(0, 0, 256, 10); e.fillRect(0, 502, 256, 10);
    K.grain(g, 256, 512, 3);
    return (h6.cu = { col, em });
  }
  function noirPair() {        // salle immersive : panneaux acoustiques noirs + filet LED
    if (h6.no) return h6.no;
    const col = mk(256, 512, (g, w, h) => { g.fillStyle = '#17181b'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.03)'; for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 * 4; x < w; x += 8) g.fillRect(x, y, 3, 3); g.fillStyle = '#3cc8ff'; g.fillRect(0, 148, w, 4); g.fillStyle = '#0c0c0d'; g.fillRect(0, h - 14, w, 14); });
    const em = mk(256, 512, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#3cc8ff'; g.fillRect(0, 148, w, 4); g.fillStyle = 'rgba(60,200,255,0.25)'; g.fillRect(0, 140, w, 20); });
    return (h6.no = { col, em });
  }
  function ecranTex() {        // grand écran LED de l'agora
    if (h6.ec) return h6.ec;
    return (h6.ec = mk(512, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0b2a4a'); gr.addColorStop(1, '#3a1450'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(${120 + Math.random() * 120},${180 + Math.random() * 70},255,0.25)`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); g.moveTo(0, Math.random() * h); g.bezierCurveTo(w * 0.3, Math.random() * h, w * 0.6, Math.random() * h, w, Math.random() * h); g.stroke(); }
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.font = "800 58px 'Segoe UI', Arial"; g.fillText('HALLE 6 OUEST', w / 2, 108);
      g.font = "500 24px 'Segoe UI', Arial"; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText('Pôle universitaire des cultures numériques', w / 2, 150);
      g.font = "400 20px 'Segoe UI', Arial"; g.fillText('Quartier de la Création — Île de Nantes', w / 2, 184);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    }));
  }
  // tableau blanc couvert de notes (traits manuscrits génériques)
  K.whiteboard = function (theme) {
    return mk(512, 256, (g, w, h) => {
      g.fillStyle = '#f4f5f2'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.04)'; g.fillRect(0, 0, w, h * 0.3);
      const inks = ['#1d3f8a', '#202020', '#b3261e', '#1e7a3a'];
      g.lineCap = 'round';
      for (let l = 0; l < 7; l++) {
        g.strokeStyle = inks[Math.floor(Math.random() * (l ? 4 : 2))]; g.lineWidth = 2.2;
        let x = 30 + Math.random() * 40; const y = 34 + l * 30;
        const end = 140 + Math.random() * 300;
        g.beginPath(); g.moveTo(x, y);
        while (x < end) { const s = 4 + Math.random() * 7; g.lineTo(x + s * 0.5, y - 6 - Math.random() * 5); g.lineTo(x + s, y + Math.random() * 3); x += s + (Math.random() < 0.18 ? 9 : 0); if (Math.random() < 0.18) g.moveTo(x, y); }
        g.stroke();
      }
      if (theme === 'meca') {     // croquis de pièce : arbre épaulé avec cotes
        g.strokeStyle = '#1d3f8a'; g.lineWidth = 2.5; const x0 = 300, y0 = 120;
        g.strokeRect(x0, y0 - 18, 60, 36); g.strokeRect(x0 + 60, y0 - 28, 70, 56); g.strokeRect(x0 + 130, y0 - 14, 50, 28);
        g.setLineDash([8, 4, 2, 4]); g.beginPath(); g.moveTo(x0 - 15, y0); g.lineTo(x0 + 195, y0); g.stroke(); g.setLineDash([]);
        g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, y0 + 50); g.lineTo(x0 + 180, y0 + 50); g.stroke();
        g.font = "italic 18px 'Segoe Print', 'Comic Sans MS', cursive"; g.fillStyle = '#1d3f8a'; g.fillText('Ø40 h7', x0 + 70, y0 - 36); g.fillText('180 ±0,1', x0 + 60, y0 + 70); g.fillText('Ra 0,8', x0 + 140, y0 - 24);
      } else if (theme === 'num') {
        g.strokeStyle = '#1e7a3a'; g.lineWidth = 2.5;
        for (const [x, y] of [[330, 70], [420, 70], [375, 150], [460, 160]]) { g.beginPath(); g.arc(x, y, 18, 0, 7); g.stroke(); }
        g.beginPath(); g.moveTo(348, 70); g.lineTo(402, 70); g.moveTo(337, 86); g.lineTo(368, 133); g.moveTo(413, 86); g.lineTo(382, 133); g.moveTo(393, 152); g.lineTo(442, 158); g.stroke();
      }
      g.strokeStyle = '#9aa0a4'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
    });
  };

  Object.assign(MK, {
    h6_beton: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#8e908e'; g.fillRect(0, 0, w, h);
      K.blot(g, w, h, 10, '0,0,0', 0.03, 0.07, 40, 160); K.blot(g, w, h, 8, '255,255,255', 0.03, 0.06, 40, 140);
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 6; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 40 + Math.random() * 90, Math.random() * 6, Math.random() * 6 + 1.5); g.stroke(); }
      K.grain(g, w, h, 6);
      g.fillStyle = 'rgba(25,25,25,0.4)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
    }),
    h6_parquet: () => P.wood(),
    h6_lino: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#5d6a76'; g.fillRect(0, 0, w, h); for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } K.grain(g, w, h, 4); }),
    h6_grate: () => P.grate(),
    h6_resine: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#7f8a83'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 5, '0,0,0', 0.03, 0.06, 30, 90); K.blot(g, w, h, 4, '255,255,255', 0.03, 0.05, 30, 80); K.grain(g, w, h, 3); }),
    h6_moquette: () => mk(256, 256, (g, w, h) => {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = K.vary('#3d4553', 0.08); g.fillRect(x * 64, y * 64, 64, 64); g.fillStyle = 'rgba(255,255,255,0.03)'; for (let k = 0; k < 8; k++) (x + y) % 2 ? g.fillRect(x * 64 + k * 8, y * 64, 3, 64) : g.fillRect(x * 64, y * 64 + k * 8, 64, 3); }
      K.grain(g, w, h, 10);
    }),
    h6_brut: () => P.concrete('#8a8985', true),
    h6_facade: () => facadePair().col, h6_facadeE: () => facadePair().em,
    h6_pignon: () => pignonPair().col, h6_pignonE: () => pignonPair().em,
    h6_vitre: () => vitragePair().col, h6_vitreE: () => vitragePair().em,
    h6_platre: () => P.paint('#e4e1da', '#7e7c77'),
    h6_banche: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#9c9a94'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) { g.fillStyle = K.vary('#9c9a94', 0.07); g.fillRect(0, y, w, 15); g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, y + 15, w, 1); }
      K.blot(g, w, h, 6, '0,0,0', 0.03, 0.06, 30, 100); K.grain(g, w, h, 6);
      g.fillStyle = 'rgba(40,40,40,0.55)'; for (let y = 48; y < h; y += 128) for (let x = 64; x < w; x += 128) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, 0, w, 3); g.fillRect(255, 0, 2, h);
    }),
    h6_tole: () => mk(256, 512, (g, w, h) => { g.fillStyle = '#a2a8ac'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(30,34,38,0.55)'; for (let y = 4; y < h; y += 9) for (let x = (y % 18 ? 2 : 6); x < w; x += 9) g.fillRect(x, y, 4, 4); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 0, 3, h); g.fillRect(128, 0, 2, h); K.grain(g, w, h, 4); }),
    h6_osb: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#c9a46c'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 1400; k++) { g.save(); g.translate(Math.random() * w, Math.random() * h); g.rotate(Math.random() * 3); g.fillStyle = K.vary(Math.random() < 0.5 ? '#b88c52' : '#d8b67e', 0.15); g.fillRect(-14, -4, 18 + Math.random() * 16, 5 + Math.random() * 4); g.restore(); }
      g.fillStyle = 'rgba(60,40,20,0.45)'; g.fillRect(0, 0, 3, h); g.fillRect(0, 300, w, 3); K.grain(g, w, h, 6);
      g.fillStyle = '#6b5434'; g.fillRect(0, h - 14, w, 14);
    }),
    h6_noir: () => noirPair().col, h6_noirE: () => noirPair().em,
    h6_cube: () => cubePair().col, h6_cubeE: () => cubePair().em,
    h6_nervure: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#a19f99'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 4, '0,0,0', 0.03, 0.06, 30, 80);
      for (let y = 0; y < h; y += 64) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, w, 6); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, y + 22, w, 3); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y + 25, w, 14); }
      K.grain(g, w, h, 5);
    }),
    h6_edge: () => P.edge('#8f8e89', '#3d454d'),
    h6_marche: () => P.stairs('#4b4f55', '#d6b23c'),
    h6_limon: () => P.concrete('#3d454d'),
    h6_shed: () => mk(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a2a44'); gr.addColorStop(1, '#0c1424'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let k = 0; k < 18; k++) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } g.fillStyle = '#3d454d'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 6, h); g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); }),
    h6_shedE: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#26344c'; g.fillRect(0, 0, w, h); g.fillStyle = '#000'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 6, h); }),
    h6_bac: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#d3d5d2'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, 0, 10, h); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 10, 0, 3, h); } K.grain(g, w, h, 4); }),
    h6_ecran: () => ecranTex(),
    h6_tableau: () => K.whiteboard('num'),
  });

  Tx.THEMES.halle6 = {
    name: 'Halle 6', fog: 0x0c0f15, fogDensity: 0.026, ambient: 0x5d6575, ambientI: 0.3, hemi: [0xb4c0d8, 0x24201c, 0.24], exposure: 1.0,
    lightColor: 0xffe8c8, panel: '#fff3df', flicker: 0.1, deadLights: 0.16, outdoor: false, lightI: 1.35, flashI: 0.9,
    tex: {
      floor: {
        0: { t: 'h6_beton', rep: [0.5, 0.5], rough: 0.38 }, 1: { t: 'h6_beton', rep: [0.5, 0.5], rough: 0.38 }, 2: { t: 'h6_parquet', rough: 0.6 }, 3: { t: 'h6_lino', rough: 0.55 },
        4: { t: 'h6_grate', rough: 0.5, metal: 0.5 }, 5: { t: 'h6_resine', rough: 0.4 }, 6: { t: 'h6_moquette', rough: 1 }, 7: { t: 'h6_brut', rough: 0.85 },
        40: { t: 'h6_shed', em: 'h6_shedE', ei: 0.55, rough: 0.15, metal: 0.3 }, 41: { t: 'h6_bac', rough: 0.6, metal: 0.3 }, 42: { t: 'h6_ecran', em: 'h6_ecran', ei: 1.1, rough: 0.3 },
        43: { t: 'h6_tableau', rough: 0.3 }, 44: { t: 'h6_tole', rough: 0.5, metal: 0.4 }, 45: { t: 'h6_osb', rough: 0.85 },
      },
      wall: {
        0: { t: 'h6_banche' }, 1: { t: 'h6_facade', em: 'h6_facadeE', ei: 0.8, rough: 0.6 }, 2: { t: 'h6_pignon', em: 'h6_pignonE', ei: 0.8, rough: 0.2, metal: 0.2 },
        3: { t: 'h6_vitre', em: 'h6_vitreE', ei: 0.55, rough: 0.25 }, 4: { t: 'h6_platre' }, 5: { t: 'h6_banche' }, 6: { t: 'h6_tole', rough: 0.5, metal: 0.4 },
        7: { t: 'h6_osb' }, 8: { t: 'h6_noir', em: 'h6_noirE', ei: 1 }, 9: { t: 'h6_cube', em: 'h6_cubeE', ei: 0.32, rough: 0.4 },
      },
      ci: { t: 'h6_nervure' }, co: { t: 'h6_nervure' }, e: { t: 'h6_edge' }, r: { t: 'h6_marche', metal: 0.4, rough: 0.5, surf: 'metal' }, rs: { t: 'h6_limon', metal: 0.3, rough: 0.6 },
    },
  };

  /* =====================================================================
     GÉNÉRATEUR
     ===================================================================== */
  const ZF = { beton: 1, parquet: 2, lino: 3, grate: 4, resine: 5, moquette: 6, brut: 7 };
  const ZW = { facade: 1, pignon: 2, vitre: 3, platre: 4, banche: 5, tole: 6, osb: 7, noir: 8, cube: 9 };
  const ROOMS = {
    fablab: { name: 'MANUFACTURING LAB', sub: 'Fabrication numérique', floor: ZF.resine, wall: ZW.osb, front: ZW.vitre },
    lounge: { name: 'LOUNGE', floor: ZF.parquet, wall: ZW.platre, front: 0 },
    studio: { name: 'DIGITAL LEARNING LAB', sub: 'Studio vidéo', floor: ZF.moquette, wall: ZW.noir, front: ZW.tole },
    exp: { name: 'EXPERIENCE LAB', sub: 'Salle d\'expérience', floor: ZF.lino, wall: ZW.platre, front: ZW.vitre },
    regie: { name: 'EXPERIENCE LAB', sub: 'Salle de contrôle', floor: ZF.moquette, wall: ZW.platre, front: ZW.vitre },
    immersif: { name: 'CUBE IMMERSIF', sub: 'Réalité virtuelle', floor: ZF.moquette, wall: ZW.noir, front: ZW.tole },
    cowork: { name: 'CARRÉ ENTREPRISES', sub: 'Coworking', floor: ZF.parquet, wall: ZW.platre, front: ZW.vitre },
    cours: { name: 'SALLE', floor: ZF.lino, wall: ZW.platre, front: ZW.vitre },
    info: { name: 'SALLE INFORMATIQUE', floor: ZF.moquette, wall: ZW.platre, front: ZW.vitre },
    reunion: { name: 'SALLE DE RÉUNION', floor: ZF.moquette, wall: ZW.platre, front: ZW.vitre },
    bureau: { name: 'BUREAUX', sub: 'Laboratoires de recherche', floor: ZF.moquette, wall: ZW.platre, front: ZW.vitre },
    reserve: { name: 'RÉSERVE', sub: 'Matériel', floor: ZF.brut, wall: ZW.banche, front: ZW.tole },
  };

  function genHalle6(def, seed, diff, rng, H) {
    const W = 46, Hh = 28, F = 3, ri = (a, b) => K.ri(rng, a, b);
    const m = H.newMap('halle6', def, W, Hh, F, seed);
    const set = (f, x, y, t, z) => H.set(m, f, x, y, t, z), rect = (f, x0, y0, x1, y1, t, z) => H.rect(m, f, x0, y0, x1, y1, t, z);
    const T = (f, x, y) => m.t[f][y * W + x];
    m.h6 = { rooms: [], doors: [], cube: null, stairs: [] };
    // enveloppe : murs longs (façades) et pignons vitrés
    for (let f = 0; f < F; f++) {
      rect(f, 0, 0, W - 1, Hh - 1, WALL, ZW.banche);
      rect(f, 1, 0, W - 2, 0, WALL, ZW.facade); rect(f, 1, Hh - 1, W - 2, Hh - 1, WALL, ZW.facade);
      rect(f, 0, 1, 0, Hh - 2, WALL, ZW.pignon); rect(f, W - 1, 1, W - 1, Hh - 2, WALL, ZW.pignon);
      rect(f, 1, 8, W - 2, 8, WALL, ZW.vitre); rect(f, 1, 19, W - 2, 19, WALL, ZW.vitre);
    }
    // nef : rez-de-chaussée sur toute la longueur ; coursives (2 cases au 1er, 1 case au 2e) et galeries de pignon
    rect(0, 1, 9, W - 2, 18, FLOOR, ZF.beton);
    rect(1, 1, 9, W - 2, 18, FLOOR, ZF.brut); rect(1, 3, 11, W - 4, 16, VOID);
    rect(2, 1, 9, W - 2, 18, FLOOR, ZF.brut); rect(2, 2, 10, W - 3, 17, VOID);
    // le cube suspendu (salle au 1er étage, toit-terrasse au 2e) et ses passerelles
    const cx0 = ri(18, 21), cube = { x0: cx0, x1: cx0 + 4, y0: 12, y1: 15 }; m.h6.cube = cube;
    rect(1, cube.x0, cube.y0, cube.x1, cube.y1, WALL, ZW.cube); rect(1, cube.x0 + 1, cube.y0 + 1, cube.x1 - 1, cube.y1 - 1, FLOOR, ZF.moquette);
    rect(2, cube.x0, cube.y0, cube.x1, cube.y1, FLOOR, ZF.brut);
    const gx1 = cube.x0 + 2; set(1, gx1, cube.y0, FLOOR, ZF.moquette); set(1, gx1, cube.y1, FLOOR, ZF.moquette); set(1, gx1, 11, FLOOR, ZF.grate); set(1, gx1, 16, FLOOR, ZF.grate);
    const gx2 = ri(36, 39); for (let y = 11; y <= 16; y++) set(1, gx2, y, FLOOR, ZF.grate);
    m.h6.gangways = [{ x: gx1, f: 1 }, { x: gx2, f: 1 }];
    // grands escaliers de la nef (rez -> 1er), avec palier relié à la coursive
    const sN = ri(7, 10), sS = ri(32, 34);
    set(1, sN + 5, 12, FLOOR, ZF.grate); set(1, sN + 5, 11, FLOOR, ZF.grate); set(0, sN + 5, 12, WALL, ZW.banche);   // massif béton sous le palier
    if (!H.addRamp(m, 0, sN + 1, 12, 1, 0, 4, { zone: ZF.beton })) return null;
    set(1, sS - 5, 15, FLOOR, ZF.grate); set(1, sS - 5, 16, FLOOR, ZF.grate); set(0, sS - 5, 15, WALL, ZW.banche);
    if (!H.addRamp(m, 0, sS - 1, 15, -1, 0, 4, { zone: ZF.beton })) return null;
    m.h6.stairs.push({ y: 12, x0: sN + 1, dx: 1 }, { y: 15, x0: sS - 1, dx: -1 });
    // cages d'escalier en béton banché (rez -> 1er -> 2e), aux deux bouts de la halle
    const core = (c, rA, rB, rP, sideRows) => {
      for (let f = 0; f < F; f++) { rect(f, c - 1, Math.min(...sideRows), c + 6, Math.max(...sideRows), WALL, ZW.banche); rect(f, c - 1, rP, c + 6, rP, WALL, ZW.banche); }
      // rez : rampe A + palier bas
      rect(0, c, rA, c, rA, FLOOR, ZF.brut); rect(0, c + 1, rA, c + 4, rA, FLOOR, ZF.brut); rect(0, c, rB, c + 5, rB, FLOOR, ZF.brut);
      set(0, c, rP, FLOOR, ZF.beton);
      // 1er : arrivée de A, départ de B
      set(1, c + 5, rA, FLOOR, ZF.brut); set(1, c + 5, rB, FLOOR, ZF.brut); rect(1, c + 1, rB, c + 4, rB, FLOOR, ZF.brut); set(1, c + 5, rP, FLOOR, ZF.brut);
      // 2e : palier en U
      rect(2, c, rA, c + 5, rA, FLOOR, ZF.brut); rect(2, c, rB, c + 5, rB, FLOOR, ZF.brut); set(2, c, rP, FLOOR, ZF.brut);
      const ok = H.addRamp(m, 0, c + 1, rA, 1, 0, 4, { zone: ZF.brut }) && H.addRamp(m, 1, c + 4, rB, -1, 0, 4, { zone: ZF.brut });
      m.h6.doors.push({ f: 0, x: c, y: rP, kind: 'esc' }, { f: 1, x: c + 5, y: rP, kind: 'esc' }, { f: 2, x: c, y: rP, kind: 'esc' });
      return ok;
    };
    if (!core(2, 6, 7, 8, [1, 7])) return null;
    if (!core(38, 21, 20, 19, [20, 26])) return null;
    // ailes : salles le long de la nef, découpées étage par étage
    const plans = {
      N: [['fablab', 'lounge', 'studio', 'reserve'], ['cours', 'info', 'cours', 'reunion', 'cours'], ['bureau', 'reunion', 'cours', 'bureau', 'info']],
      S: [['exp', 'exp', 'regie', 'immersif', 'cowork', 'exp'], ['cours', 'studio', 'cours', 'info', 'cours'], ['bureau', 'cours', 'reunion', 'bureau']],
    };
    let salle = 0;
    for (const side of ['N', 'S']) for (let f = 0; f < F; f++) {
      const y0 = side === 'N' ? 1 : 20, y1 = side === 'N' ? 7 : 26, front = side === 'N' ? 8 : 19, xa = side === 'N' ? 9 : 1, xb = side === 'N' ? W - 2 : 36;
      const types = plans[side][f].slice(); BR.shuffle(types, rng);
      if (f === 0 && side === 'N') { types.splice(types.indexOf('fablab'), 1); types.unshift('fablab'); }
      // largeurs
      const n = types.length, span = xb - xa + 1, widths = [];
      let rest = span - (n - 1);
      for (let k = 0; k < n; k++) { const left = n - k - 1, base = Math.floor(rest / (left + 1)); let w = k === n - 1 ? rest : BR.clamp(base + ri(-1, 1) + (types[k] === 'fablab' ? 4 : 0), 4, rest - left * 4); widths.push(w); rest -= w; }
      let x = xa;
      types.forEach((type, k) => {
        const w = widths[k], R = ROOMS[type], a = x, b = x + w - 1;
        rect(f, a, y0, b, y1, FLOOR, R.floor);
        if (k < n - 1) rect(f, b + 1, y0, b + 1, y1, WALL, type === 'fablab' ? ZW.osb : ZW.platre);
        // façade sur la nef / coursive
        for (let xx = a; xx <= b; xx++) m.zone[f][front * W + xx] = R.front || ZW.vitre;
        const room = { f, side, type, x0: a, x1: b, y0, y1, front, num: '' };
        if (R.front === 0) { rect(f, a, front, b, front, FLOOR, R.floor); room.open = true; }
        else {
          const dw = w >= 7 && rng() < 0.5 ? 2 : 1, dx = ri(a + 1, Math.max(a + 1, b - dw));
          for (let d = 0; d < dw; d++) { set(f, dx + d, front, FLOOR, R.floor); m.h6.doors.push({ f, x: dx + d, y: front, kind: 'salle' }); }
          room.door = dx; room.dw = dw;
          if (w >= 9 && rng() < 0.6) { const d2 = dx + dw + 3 <= b ? b - 1 : a + 1; if (Math.abs(d2 - dx) > 2) { set(f, d2, front, FLOOR, R.floor); m.h6.doors.push({ f, x: d2, y: front, kind: 'salle' }); } }
        }
        // bureaux : couloir côté nef, petits bureaux côté façade
        if (type === 'bureau' && w >= 5) {
          const wy = side === 'N' ? y1 - 2 : y0 + 2;
          rect(f, a, wy, b, wy, WALL, ZW.vitre);
          // cloisons tous les 3 m environ (aucune cellule de moins de 2 cases), une porte par bureau
          const offs = []; let s0 = a;
          while (s0 <= b) { let e = Math.min(b, s0 + 1 + ri(0, 1)); if (b - e < 3) e = b; offs.push({ a: s0, b: e }); if (e < b) rect(f, e + 1, side === 'N' ? y0 : wy + 1, e + 1, side === 'N' ? wy - 1 : y1, WALL, ZW.platre); s0 = e + 2; }
          for (const o of offs) set(f, o.a + ri(0, o.b - o.a), wy, FLOOR, R.floor);
          room.corridor = wy; room.offices = offs;
        }
        if (type === 'cours' || type === 'info') room.num = (f + 1) + String(++salle).padStart(2, '0');
        m.h6.rooms.push(room);
        x = b + 2;
      });
    }
    // relie chaque étage (portes de secours si une salle se retrouve isolée)
    for (let f = 0; f < F; f++) H.connectLayer(m, f, f ? ZF.brut : ZF.beton);
    // départ dans la nef (côté est), sortie : grande porte du pignon ouest
    m.spawn = { f: 0, cx: W - 5, cy: 13 + ri(0, 1) };
    m.exit = { cx: 1, cy: 13 + ri(0, 1), dx: -1, dy: 0 };
    // garde-corps (avant le mobilier : leurs collisions occupent des cases)
    K.rails(m);
    // poteaux béton sous les coursives (rez-de-chaussée)
    for (let xx = 4; xx <= W - 5; xx += 4) for (const yy of [10, 17]) {
      const i = yy * W + xx; if (m.t[0][i] !== FLOOR || m.propAt[0][i] >= 0) continue;
      K.solid(m, H, 0, xx, yy, 'colonne', 3.7, 0.6, 0.6, { oz: yy === 10 ? 0.7 : -0.7 });
    }
    furnish(m, H, rng);
    if (!H.finalize(m, rng, diff)) return null;
    if (!K.cutJumps(m)) return null;
    // néons : partout où le plafond est à hauteur d'étage (pas dans la nef, éclairée par les suspensions)
    const nave = i => { const y = (i / W) | 0; return y >= 9 && y <= 18; };
    H.panelLights(m, rng, BR.Tex.theme(def.theme), (f, i) => { const c = H.ceilY(m, f, i); return c - f * SH < 4.5 && !(nave(i) && c > 11); });
    // suspensions industrielles de la nef
    for (let xx = 4; xx <= W - 5; xx += 4) for (const zz of [23.2, 28, 32.8]) {
      const cell = { cx: Math.floor(xx * C / C), cy: Math.floor(zz / C) };
      const cb = m.h6.cube; if (xx >= cb.x0 - 1 && xx <= cb.x1 + 1 && zz > 22 && zz < 34) continue;
      const r = rng();
      m.lights.push({ f: 0, cx: cell.cx, cy: cell.cy, y: 9.3, kind: 'lamp', px: xx * C + 1, pz: zz, dead: r < 0.12, flicker: r > 0.12 && r < 0.22, phase: rng() * 100, pend: true });
    }
    return m;
  }

  /* ---------- mobilier ---------- */
  function furnish(m, H, rng) {
    const W = m.W, ri = (a, b) => K.ri(rng, a, b);
    const doorNear = (f, x, y, r) => m.h6.doors.some(d => d.f === f && Math.abs(d.x - x) <= r && Math.abs(d.y - y) <= r);
    const free = (f, x, y) => { if (x < 1 || y < 1 || x >= W - 1 || y >= m.H - 1) return false; const i = y * W + x; return m.t[f][i] === FLOOR && m.propAt[f][i] < 0 && m.rampAt[f][i] < 0 && !m.ramps.some(r => (r.f === f && r.approach === i) || (r.f + 1 === f && r.landing === i)); };
    const near = (x, y, p, r) => Math.abs(x - p.cx) + Math.abs(y - p.cy) <= r;
    const put = (f, x, y, sub, h, w, d, o) => { if (!free(f, x, y) || doorNear(f, x, y, 1)) return null; if (f === 0 && (near(x, y, m.spawn, 3) || near(x, y, m.exit, 3))) return null; return K.solid(m, H, f, x, y, sub, h, w, d, o); };
    // --- nef : agora, salons, accueil ---
    const ex = m.exit, ay = ex.cy === 13 ? 15 : 12;
    put(0, 4, ay, 'accueil', 1.1, 1.9, 1.0, { ry: ay === 12 ? 0 : Math.PI });
    put(0, 5, ay, 'accueil', 1.1, 1.9, 1.0, { ry: ay === 12 ? 0 : Math.PI, v: 1 });
    // gradins de l'agora (bois), face au grand écran
    const gx = ri(16, 18);
    put(0, gx + 1, 12, 'ecran', 3.4, 1.9, 0.5, { oz: -0.6 });
    put(0, gx + 2, 12, 'ecran', 3.4, 1.9, 0.5, { oz: -0.6, v: 1 });
    for (let k = 0; k < 4; k++) for (let s = 0; s < 3; s++) put(0, gx + k, 13 + s, 'gradin', 0.45 * (s + 1), 2, 2, { v: s });
    // salons : canapés, fauteuils, tables basses
    for (let k = 0; k < 7; k++) {
      const x = ri(23, 40), y = ri(12, 14);
      if (!free(0, x, y) || !free(0, x + 1, y) || !free(0, x, y + 1)) continue;
      put(0, x, y, 'canape', 0.85, 1.9, 0.9, { oz: -0.45, ry: 0 });
      put(0, x + 1, y, 'fauteuil', 0.85, 0.9, 0.9, { ry: -Math.PI / 2 });
      put(0, x, y + 1, 'tablebasse', 0.42, 1.2, 0.7, { oz: -0.5 });
    }
    // mange-debout et grandes jardinières
    for (let k = 0; k < 6; k++) { const x = ri(5, 42), y = rng() < 0.5 ? 12 : 15; put(0, x, y, rng() < 0.5 ? 'hautetable' : 'jardiniere', 1.05, 1.0, 1.0); }
    for (const yy of [9, 18]) for (let x = 6; x < W - 6; x += ri(5, 8)) put(0, x, yy, rng() < 0.5 ? 'jardiniere' : 'banc', rng() < 0.5 ? 1.0 : 0.45, 1.6, 0.6, { oz: yy === 9 ? -0.55 : 0.55 });
    // --- salles ---
    for (const R of m.h6.rooms) {
      const f = R.f, inner = R.side === 'N' ? 1 : -1;     // +1 : vers la nef (y croissant) pour l'aile nord
      const backY = R.side === 'N' ? R.y0 : R.y1, frontY = R.side === 'N' ? R.y1 : R.y0;
      const yy0 = R.corridor != null ? (R.side === 'N' ? R.y0 : R.corridor + 1) : R.y0, yy1 = R.corridor != null ? (R.side === 'N' ? R.corridor - 1 : R.y1) : R.y1;
      switch (R.type) {
        case 'fablab': {
          const kinds = ['imprimante3d', 'imprimante3d', 'laser', 'jetdeau', 'robot', 'etabli', 'etabli', 'electronique'];
          const mr = R.side === 'N' ? [R.y0 + 2, R.y0 + 4] : [R.y1 - 2, R.y1 - 4];       // deux rangées de machines, allées entre elles
          for (let x = R.x0 + 1; x <= R.x1 - 1; x += 2) for (const y of mr) {
            const k = kinds[ri(0, kinds.length - 1)], dims = { imprimante3d: [1.2, 0.9, 0.9], laser: [1.15, 1.8, 1.1], jetdeau: [1.3, 1.95, 1.7], robot: [1.6, 1.4, 1.4], etabli: [0.95, 1.9, 0.8], electronique: [1.25, 1.9, 0.8] }[k];
            put(f, x, y, k, dims[0], dims[1], dims[2], { ry: rng() < 0.5 ? 0 : Math.PI });
          }
          for (let x = R.x0; x <= R.x1; x += 2) put(f, x, backY, 'rayonnage', 2.2, 1.9, 0.6, { oz: inner * -0.65 });
          break;
        }
        case 'lounge': {
          for (let x = R.x0 + 1; x <= R.x1 - 1; x += 3) { put(f, x, R.y0 + 2, 'canape', 0.85, 1.9, 0.9, { ry: 0 }); put(f, x, R.y0 + 3, 'tablebasse', 0.42, 1.2, 0.7); put(f, x + 1, R.y0 + 3, 'fauteuil', 0.85, 0.9, 0.9, { ry: -Math.PI / 2 }); }
          for (let x = R.x0; x <= R.x1; x += 3) put(f, x, backY, 'bibliotheque', 2.0, 1.9, 0.5, { oz: inner * -0.7 });
          break;
        }
        case 'studio': {
          const cx = (R.x0 + R.x1) >> 1;
          put(f, cx, backY, 'fondvert', 2.6, 1.9, 0.4, { oz: inner * -0.75 });
          put(f, cx, R.side === 'N' ? R.y0 + 2 : R.y1 - 2, 'bureauprof', 0.78, 1.8, 0.8);
          put(f, cx, R.side === 'N' ? R.y0 + 4 : R.y1 - 4, 'camera', 1.7, 0.7, 0.7);
          put(f, cx - 2, R.side === 'N' ? R.y0 + 3 : R.y1 - 3, 'projecteur', 2.1, 0.6, 0.6);
          put(f, cx + 2, R.side === 'N' ? R.y0 + 3 : R.y1 - 3, 'projecteur', 2.1, 0.6, 0.6);
          break;
        }
        case 'exp': case 'regie': {
          const cx = (R.x0 + R.x1) >> 1, cy = (R.y0 + R.y1) >> 1;
          if (R.type === 'regie') { for (let x = R.x0 + 1; x <= R.x1 - 1; x++) put(f, x, cy, 'console', 1.05, 1.9, 0.8); }
          else { put(f, cx, cy, 'tableexp', 0.76, 1.8, 0.9); put(f, cx, cy - inner * 2, 'casque', 1.3, 0.6, 0.6); }
          for (let x = R.x0; x <= R.x1; x += 3) put(f, x, backY, 'armoire', 1.9, 1.0, 0.5, { oz: inner * -0.7 });
          break;
        }
        case 'immersif': {
          const cx = (R.x0 + R.x1) >> 1, cy = (R.y0 + R.y1) >> 1;
          put(f, cx, cy, 'plateforme', 0.25, 1.9, 1.9);
          break;
        }
        case 'cowork': {
          for (let x = R.x0 + 1; x <= R.x1 - 1; x += 2) for (let y = R.y0 + 1; y <= R.y1 - 1; y += 3) put(f, x, y, 'ilot', 0.76, 1.9, 1.5);
          break;
        }
        case 'cours': case 'info': {
          // tableau sur un mur latéral (cloison), tables en rangs face à lui, allée centrale
          const sub = R.type === 'info' ? 'postepc' : 'pupitre';
          const bs = R.x0 <= 1 || m.t[f][R.y0 * W + R.x0 - 1] !== WALL ? 1 : -1;      // côté du tableau (-1 : vers x0)
          R.board = bs;
          const bx = bs < 0 ? R.x0 : R.x1, aisle = (R.y0 + R.y1) >> 1;
          put(f, bx, aisle, 'bureauprof', 0.78, 0.8, 1.6, { ry: bs < 0 ? -Math.PI / 2 : Math.PI / 2 });
          for (let x = bx - bs * 2; bs < 0 ? x <= R.x1 : x >= R.x0; x -= bs) for (let y = R.y0; y <= R.y1; y++) {
            if (y === aisle || y === frontY) continue;
            put(f, x, y, sub, 0.76, 1.25, 1.9, { ox: -bs * 0.05, ry: bs < 0 ? Math.PI / 2 : -Math.PI / 2 });
          }
          break;
        }
        case 'reunion': {
          const cx = (R.x0 + R.x1) >> 1;
          for (let y = R.y0 + 2; y <= R.y1 - 2; y++) put(f, cx, y, 'tablereunion', 0.76, 1.8, 2.0, { v: y === R.y0 + 2 ? 1 : y === R.y1 - 2 ? 2 : 0 });
          break;
        }
        case 'bureau': {
          // un bureau par cellule de bureau (entre deux cloisons)
          for (const o of R.offices || []) { if (o.b - o.a < 1) continue; const y = R.side === 'N' ? R.y0 + 1 : R.y1 - 1; put(f, o.a + ri(0, o.b - o.a), y, 'bureau', 0.76, 1.5, 0.75, { ry: R.side === 'N' ? 0 : Math.PI }); }
          break;
        }
        case 'reserve': {
          // rayonnages en épis, allée le long de la façade sur la nef
          const ys = R.side === 'N' ? [R.y0, R.y0 + 1, R.y0 + 2, R.y0 + 3] : [R.y1, R.y1 - 1, R.y1 - 2, R.y1 - 3];
          for (let x = R.x0 + 1; x <= R.x1; x += 2) for (const y of ys) put(f, x, y, rng() < 0.7 ? 'rayonnage' : 'caisse', rng() < 0.7 ? 2.2 : 1.0, 0.8, 1.8);
          break;
        }
      }
    }
    // coursives : bancs et plantes
    for (let k = 0; k < 14; k++) { const f = rng() < 0.6 ? 1 : 2, x = ri(4, W - 5), y = rng() < 0.5 ? 9 : 18; put(f, x, y, rng() < 0.5 ? 'jardiniere' : 'banc', rng() < 0.5 ? 1.0 : 0.45, 1.6, 0.6, { oz: y === 9 ? -0.55 : 0.55 }); }
  }

  /* =====================================================================
     DÉCOR (charpente, sheds, garde-corps, mobilier, signalétique)
     ===================================================================== */
  function decorHalle6(m, B, inst, rng, H, group) {
    const W = m.W, PB = B('p'), col = K.col;
    const steel = col('#46525e'), steelD = col('#2f3840'), white = col('#e6e6e2'), concrete = col('#a9a8a2');
    const X1 = (W - 1) * C, Zn = 9 * C, Zs = 19 * C;
    // ---- toiture en sheds au-dessus de la nef (cache le plafond plat à 12 m) ----
    const GL = B('f40'), BAC = B('f41');
    const yLo = 10.65, yHi = 11.97;
    for (let xa = C; xa < X1; xa += 4) {
      const xb = Math.min(X1, xa + 4);
      // pan opaque (bac acier) : du haut du vitrage en xa vers le bas en xb
      K.face(BAC, [xa, yHi, Zs], [xa, yHi, Zn], [xb, yLo, Zn], [xb, yLo, Zs], 1, [0.3, -1, 0]);
      // vitrage vertical en xb (de yLo à yHi), tourné vers +x
      if (xb < X1) K.face(GL, [xb, yLo, Zn], [xb, yLo, Zs], [xb, yHi, Zs], [xb, yHi, Zn], 1, [1, 0, 0], 0.25);
    }
    // ---- charpente : fermes treillis tous les 8 m, pannes, poteaux acier ----
    for (let x = C; x <= X1; x += 8) {
      const yb = 9.75, yt = 10.6;
      K.bar(PB, [x, yb, Zn], [x, yb, Zs], 0.18, 0.18, steel);
      K.bar(PB, [x, yt, Zn], [x, yt, Zs], 0.18, 0.16, steel);
      const n = 12, dz = (Zs - Zn) / n;
      for (let k = 0; k < n; k++) { const z0 = Zn + k * dz, z1 = z0 + dz; K.bar(PB, [x, k % 2 ? yt : yb, z0], [x, k % 2 ? yb : yt, z1], 0.08, 0.08, steel); K.bar(PB, [x, yb, z0], [x, yt, z0], 0.07, 0.07, steel); }
      for (const z of [Zn - 0.05, Zs + 0.05]) { K.box(PB, x - 0.2, 0, z - 0.17, x + 0.2, yt + 0.1, z + 0.17, steelD); K.box(PB, x - 0.32, yt - 0.1, z - 0.25, x + 0.32, yt + 0.12, z + 0.25, steelD); }
    }
    for (const z of [Zn + 0.4, (Zn + Zs) / 2, Zs - 0.4]) K.bar(PB, [C, 10.5, z], [X1, 10.5, z], 0.14, 0.22, steel);
    // poutres de rive le long des coursives (sous les dalles)
    for (const [f, z] of [[1, 11 * C], [1, 17 * C], [2, 10 * C], [2, 18 * C]]) K.box(PB, C, f * SH - 0.62, z - 0.12, X1, f * SH - 0.3, z + 0.12, steel);
    // ---- passerelles : longerons métalliques et sous-face en caillebotis ----
    const GR = B('f4');
    for (const g of m.h6.gangways) {
      const x0 = g.x * C, x1 = x0 + C;
      for (let y = 11; y <= 16; y++) {
        const i = y * W + g.x; if (m.t[1][i] !== FLOOR) continue;
        const z0 = y * C, z1 = z0 + C, yy = SH - SLAB_ - 0.02;
        K.face(GR, [x0, yy, z0], [x1, yy, z0], [x1, yy, z1], [x0, yy, z1], 0.9, [0, -1, 0]);
        K.box(PB, x0 - 0.04, SH - 0.62, z0, x0 + 0.1, SH + 0.02, z1, steel); K.box(PB, x1 - 0.1, SH - 0.62, z0, x1 + 0.04, SH + 0.02, z1, steel);
      }
    }
    // ---- le cube : cadre blanc, tirants accrochés à la charpente, lueur ----
    const cb = m.h6.cube, cX0 = cb.x0 * C, cX1 = (cb.x1 + 1) * C, cZ0 = cb.y0 * C, cZ1 = (cb.y1 + 1) * C;
    for (const [x, z] of [[cX0, cZ0], [cX1, cZ0], [cX0, cZ1], [cX1, cZ1]]) { K.box(PB, x - 0.12, SH - 0.32, z - 0.12, x + 0.12, 2 * SH + 0.06, z + 0.12, white); K.cyl(PB, [x, 2 * SH + 0.06, z], [x, 9.75, z], 0.035, 6, steelD); }
    for (const [a, b] of [[[cX0, cZ0], [cX1, cZ0]], [[cX0, cZ1], [cX1, cZ1]], [[cX0, cZ0], [cX0, cZ1]], [[cX1, cZ0], [cX1, cZ1]]]) for (const y of [SH - 0.32, 2 * SH - 0.05]) K.bar(PB, [a[0], y, a[1]], [b[0], y, b[1]], 0.2, 0.14, white);
    // ---- grands escaliers : garde-corps latéraux + limon ----
    for (const s of m.h6.stairs) {
      const xs = s.dx > 0 ? s.x0 * C : (s.x0 + 1) * C, xe = xs + s.dx * 4 * C;
      for (const z of [s.y * C + 0.06, (s.y + 1) * C - 0.06]) {
        K.bar(PB, [xs, 1.0, z], [xe, SH + 1.0, z], 0.05, 0.05, steelD);
        for (let k = 0; k <= 8; k++) { const t = k / 8, x = xs + (xe - xs) * t, y = SH * t; K.box(PB, x - 0.025, y, z - 0.025, x + 0.025, y + 1.0, z + 0.025, steelD); }
      }
    }
    // ---- habillages des salles : tableaux blancs, panneaux acoustiques noirs (studio, salle immersive) ----
    const TB = B('f43'), NO = B('w8i');
    for (const R of m.h6.rooms) {
      const y0 = R.f * SH, zA = R.y0 * C, zB = (R.y1 + 1) * C, xA = R.x0 * C, xB = (R.x1 + 1) * C;
      if (R.board) {
        const xw = R.board < 0 ? xA + 0.025 : xB - 0.025, zc = (((R.y0 + R.y1) >> 1) + 0.5) * C, hw = 1.8;
        K.face(TB, [xw, y0 + 0.9, zc - hw], [xw, y0 + 0.9, zc + hw], [xw, y0 + 2.15, zc + hw], [xw, y0 + 2.15, zc - hw], 1, [-R.board, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        K.box(PB, xw - 0.04, y0 + 0.86, zc - hw, xw + 0.04, y0 + 0.9, zc + hw, col('#9aa0a4'));
      }
      if (R.type === 'studio' || R.type === 'immersif') {
        const hgt = 3.55, v1 = hgt / SH, wallS = (a, b, out) => { const L = Math.hypot(b[0] - a[0], b[2] - a[2]); K.face(NO, [a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y0 + hgt, b[2]], [a[0], y0 + hgt, a[2]], 1, out, [[0, 0], [L / 4, 0], [L / 4, v1], [0, v1]]); };
        const e = 0.02, back = R.side === 'N' ? zA + e : zB - e;
        wallS([xA + e, 0, zA], [xA + e, 0, zB], [1, 0, 0]); wallS([xB - e, 0, zA], [xB - e, 0, zB], [-1, 0, 0]);
        wallS([xA, 0, back], [xB, 0, back], [0, 0, R.side === 'N' ? 1 : -1]);
      }
    }
    // ---- garde-corps ----
    K.drawRails(m, B, group, { color: '#2f3840', top: '#9aa3ab', mesh: 'losange', meshColor: '#858d94' });
    // ---- suspensions de la nef ----
    const glow = B('glow');
    for (const l of m.lights) {
      if (!l.pend) continue;
      const x = l.px, z = l.pz, y = l.y;
      K.cyl(PB, [x, y + 0.35, z], [x, 9.75, z], 0.012, 4, steelD);
      K.cyl(PB, [x, y - 0.05, z], [x, y + 0.35, z], 0.42, 12, col('#2a2f33'), false, 0.09);
      if (!l.dead) K.cyl(glow, [x, y - 0.06, z], [x, y - 0.02, z], 0.36, 12, [1, 0.92, 0.78], true);
    }
    // ---- rubans LED sous les coursives ----
    for (const [f, z] of [[1, 11 * C - 0.25], [1, 17 * C + 0.25]]) K.box(glow, 3 * C, f * SH - 0.66, z - 0.03, (W - 3) * C, f * SH - 0.63, z + 0.03, [0.55, 0.75, 1]);
    // ---- grandes lettres sur le pignon ouest ----
    const S = K.signs();
    S.add({ text: 'HALLE 6', bg: '#1b2128', fg: '#f2f2ee', w: 6.4, h: 1.6, x: C + 0.06, y: 6.4, z: 14 * C, ry: Math.PI / 2, border: false, weight: 900 });
    S.add({ text: 'HALLE 6 OUEST', sub: 'Nantes Université — cultures numériques', bg: '#1b2128', fg: '#f2f2ee', w: 3.4, h: 0.85, x: (W - 1) * C - 0.06, y: 3.0, z: 14 * C, ry: -Math.PI / 2 });
    // panneaux de salles au-dessus des portes
    for (const R of m.h6.rooms) {
      const info = ROOMS[R.type]; if (!info) continue;
      const zf = R.side === 'N' ? (R.front + 1) * C + 0.03 : R.front * C - 0.03;
      const wallAt = x => m.t[R.f][R.front * W + x] === WALL;
      // panneau sur le mur à côté de la porte (ou sur le linteau pour une salle ouverte)
      const sx = R.door == null ? (R.x0 + R.x1 + 1) / 2 : wallAt(R.door - 1) ? R.door - 0.5 : R.door + (R.dw || 1) + 0.5;
      let text = info.name; if (R.num) text = 'SALLE ' + R.num;
      S.add({ text, sub: R.type === 'cours' ? 'Enseignement' : info.sub, bg: '#20262c', fg: '#e9edf0', w: 1.6, h: 0.4, x: sx * C, y: R.f * SH + (R.door == null ? 3.88 : 2.1), z: zf, ry: R.side === 'N' ? 0 : Math.PI });
    }
    // escaliers de secours (vert), à côté de la porte
    for (const d of m.h6.doors) if (d.kind === 'esc') {
      const zf = d.y === 8 ? 9 * C + 0.03 : 19 * C - 0.03, sx = m.t[d.f][d.y * W + d.x + 1] === WALL ? d.x + 1.5 : d.x - 0.5;
      S.add({ text: 'ESCALIER', sub: 'Sortie de secours', bg: '#0d7a3a', fg: '#ffffff', w: 1.0, h: 0.32, x: sx * C, y: d.f * SH + 2.3, z: zf, ry: d.y === 8 ? 0 : Math.PI, glow: true });
    }
    S.add({ text: 'SORTIE', bg: '#0d7a3a', fg: '#ffffff', w: 1.2, h: 0.4, x: C + 0.05, y: 3.25, z: (m.exit.cy + 0.5) * C, ry: Math.PI / 2, glow: true, arrow: 1 });
    S.build(group);
    // ---- mobilier ----
    for (const p of m.props) if (p.sub) furniture(p, B, PB, inst, H, rng);
  }
  const SLAB_ = 0.3;

  // dessin du mobilier (repère local : x le long de w, z le long de d, ry = rotation)
  function furniture(p, B, PB, inst, H, rng) {
    const col = K.col, b = p.base, x = p.x, z = p.z, ry = p.ry || 0;
    const R = (lx0, y0, lz0, lx1, y1, lz1, c) => K.rbox(PB, x, z, ry, lx0, b + y0, lz0, lx1, b + y1, lz1, c);
    const Rg = (lx0, y0, lz0, lx1, y1, lz1, c) => K.rbox(B('glow'), x, z, ry, lx0, b + y0, lz0, lx1, b + y1, lz1, c);
    const turned = Math.abs(Math.sin(ry)) > 0.7, hw = (turned ? p.d : p.w) / 2, hd = (turned ? p.w : p.d) / 2;
    const put = (name, lx, lz, rot, sc) => { if (!inst) return false; const c = Math.cos(ry), s = Math.sin(ry); return H.put(inst, name, x + lx * c + lz * s, b, z - lx * s + lz * c, ry + (rot || 0), sc); };
    switch (p.sub) {
      case 'rail': return;
      case 'colonne': {
        R(-0.3, 0, -0.3, 0.3, 3.4, 0.3, '#b3b1aa'); R(-0.45, 3.4, -0.45, 0.45, 3.7, 0.45, '#aaa8a1'); R(-0.32, 0, -0.32, 0.32, 0.12, 0.32, '#7d7b75');
        return;
      }
      case 'accueil': {
        R(-hw, 0, -hd, hw, 1.05, hd * 0.2, '#e6e3dc'); R(-hw - 0.02, 1.05, -hd - 0.02, hw + 0.02, 1.1, hd * 0.25, '#8a6b47');
        R(-hw, 0, hd * 0.2, hw, 0.74, hd, '#d8d4cc'); R(-hw, 0.74, hd * 0.15, hw, 0.78, hd, '#8a6b47');
        R(-0.3, 0.78, 0.25, 0.25, 1.15, 0.3, '#1c1f22'); Rg(-0.26, 0.82, 0.24, 0.21, 1.11, 0.245, [0.45, 0.65, 0.95]);
        if (p.v) put('furn_chair_A', 0, 0.85, Math.PI, 0.75);
        return;
      }
      case 'gradin': {
        const h = p.h; R(-1, 0, -1, 1, h, 1, '#a57a4c');
        for (let k = 0; k < 9; k++) R(-1, h - 0.02, -1 + k * 0.222, 1, h + 0.005, -1 + k * 0.222 + 0.2, k % 2 ? '#b98b58' : '#ae8150');
        R(-1.001, 0, -1.001, 1.001, 0.06, 1.001, '#6b5235');
        return;
      }
      case 'ecran': {
        if (p.v) return;     // l'écran couvre deux cases, dessiné par la première
        const sx = x + 1;
        K.box(PB, sx - 2.0, b + 1.0, z - 0.15, sx + 2.0, b + 3.3, z + 0.05, col('#15181b'));
        K.face(B('f42'), [sx - 1.92, b + 1.08, z + 0.055], [sx + 1.92, b + 1.08, z + 0.055], [sx + 1.92, b + 3.22, z + 0.055], [sx - 1.92, b + 3.22, z + 0.055], 1, [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        for (const s of [-1.3, 1.3]) { K.box(PB, sx + s - 0.06, b, z - 0.06, sx + s + 0.06, b + 1.0, z + 0.06, col('#2b2f33')); K.box(PB, sx + s - 0.35, b, z - 0.35, sx + s + 0.35, b + 0.05, z + 0.35, col('#2b2f33')); }
        return;
      }
      case 'canape': {
        if (put('furn_couch', 0, 0, 0, 0.85)) return;
        R(-hw, 0, -hd, hw, 0.45, hd, '#4d6273'); R(-hw, 0.45, -hd, hw, 0.85, -hd + 0.25, '#4d6273'); R(-hw, 0.45, -hd, -hw + 0.2, 0.65, hd, '#46596a'); R(hw - 0.2, 0.45, -hd, hw, 0.65, hd, '#46596a');
        return;
      }
      case 'fauteuil': { if (put('furn_armchair', 0, 0, 0, 0.85)) return; R(-0.45, 0, -0.45, 0.45, 0.45, 0.45, '#7a4a3a'); R(-0.45, 0.45, -0.45, 0.45, 0.85, -0.25, '#7a4a3a'); return; }
      case 'tablebasse': { if (put('furn_table_low', 0, 0, 0, 0.85)) return; R(-hw, 0.36, -hd, hw, 0.42, hd, '#8a6b47'); R(-hw + 0.05, 0, -hd + 0.05, hw - 0.05, 0.36, hd - 0.05, '#3a3a3a'); return; }
      case 'hautetable': {
        K.cyl(PB, [x, b + 1.02, z], [x, b + 1.06, z], 0.45, 14, col('#e8e5de'), true); K.cyl(PB, [x, b, z], [x, b + 1.02, z], 0.05, 8, col('#2b2f33')); K.cyl(PB, [x, b, z], [x, b + 0.04, z], 0.28, 12, col('#2b2f33'), true);
        for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4, sx = x + Math.cos(a) * 0.72, sz = z + Math.sin(a) * 0.72; if (inst) H.put(inst, 'furn_chair_stool', sx, b, sz, a, 1.0); else { K.cyl(PB, [sx, b, sz], [sx, b + 0.75, sz], 0.03, 6, col('#2b2f33')); K.cyl(PB, [sx, b + 0.72, sz], [sx, b + 0.78, sz], 0.2, 10, col('#c44b3a'), true); } }
        return;
      }
      case 'jardiniere': {
        K.cyl(PB, [x, b, z], [x, b + 0.75, z], 0.48, 12, col('#6e6e69'), true, 0.55);
        K.cyl(PB, [x, b + 0.7, z], [x, b + 0.74, z], 0.5, 12, col('#3a2c1e'), true);
        K.cyl(B('bark'), [x, b + 0.7, z], [x + 0.05, b + 1.9, z], 0.05, 6, [0.36, 0.27, 0.18]);
        for (let k = 0; k < 4; k++) H.icoBlob(B('leaf'), x + (rng() - 0.5) * 0.6, b + 1.9 + rng() * 0.6, z + (rng() - 0.5) * 0.6, 0.35 + rng() * 0.2, K.col('#4f7a3e'), 1, 1);
        return;
      }
      case 'banc': { R(-hw, 0.38, -hd, hw, 0.45, hd, '#9a7449'); for (const s of [-1, 1]) R(s * hw * 0.8 - 0.05, 0, -hd * 0.8, s * hw * 0.8 + 0.05, 0.38, hd * 0.8, '#2b2f33'); return; }
      case 'bibliotheque': {
        R(-hw, 0, -hd, hw, p.h, hd, '#e2ddd2');
        for (let k = 0; k < 5; k++) { const y0 = 0.08 + k * 0.38; for (let j = 0; j < 14; j++) { const bw = 0.09 + rng() * 0.04, lx = -hw + 0.06 + j * 0.13; if (rng() < 0.15) continue; R(lx, y0, -hd + 0.03, lx + bw, y0 + 0.24 + rng() * 0.08, hd + 0.01, ['#a33f3f', '#3f6fa3', '#d9c27a', '#3fa36b', '#594a7a', '#c7c2b5'][j % 6]); } }
        return;
      }
      case 'rayonnage': {
        for (const s of [-1, 1]) for (const t of [-1, 1]) R(s * hw - (s > 0 ? 0.05 : 0), 0, t * hd - (t > 0 ? 0.05 : 0), s * hw + (s < 0 ? 0.05 : 0), p.h, t * hd + (t < 0 ? 0.05 : 0), '#2f6fb0');
        for (let k = 0; k < 4; k++) { const y = 0.15 + k * 0.62; R(-hw, y, -hd, hw, y + 0.05, hd, '#e07b1c'); if (k < 3) for (let j = 0; j < 3; j++) if (rng() < 0.75) R(-hw + 0.08 + j * 0.6, y + 0.05, -hd + 0.06, -hw + 0.6 + j * 0.6, y + 0.05 + 0.25 + rng() * 0.25, hd - 0.06, ['#9c7a4b', '#7d8a93', '#b5b2a6', '#3a5a7a'][Math.floor(rng() * 4)]); }
        return;
      }
      case 'caisse': { R(-hw, 0, -hd, hw, p.h, hd, '#9c7a4b'); R(-hw - 0.01, p.h * 0.45, -hd - 0.01, hw + 0.01, p.h * 0.55, hd + 0.01, '#7e5f36'); return; }
      case 'armoire': { R(-hw, 0, -hd, hw, p.h, hd, '#b9bdc0'); R(-0.01, 0.1, hd, 0.01, p.h - 0.1, hd + 0.01, '#6b7075'); R(-0.12, 0.95, hd, -0.05, 1.15, hd + 0.03, '#2b2f33'); return; }
      // --- Manufacturing Lab ---
      case 'imprimante3d': {
        R(-hw, 0, -hd, hw, 0.75, hd, '#d9d6cf'); R(-hw, 0.75, -hd, hw, 0.79, hd, '#4a4e52');
        for (const s of [-0.3, 0.3]) {
          R(s - 0.22, 0.79, -0.22, s + 0.22, 1.18, 0.22, '#25282b'); R(s - 0.18, 0.83, -0.18, s + 0.18, 0.86, 0.18, '#3a3f44');
          R(s - 0.05, 0.86, -0.05, s + 0.05, 0.86 + 0.05 + rng() * 0.18, 0.05, ['#e8743b', '#3b8ee8', '#f2f2f2', '#5ac46a'][Math.floor(rng() * 4)]);
          Rg(s + 0.08, 0.8, 0.22, s + 0.18, 0.86, 0.225, [0.4, 0.8, 1]);
        }
        return;
      }
      case 'laser': {
        R(-hw, 0, -hd, hw, 0.85, hd, '#2d3236'); R(-hw, 0.85, -hd, hw, 1.05, hd, '#c8312b'); R(-hw + 0.1, 1.05, -hd + 0.1, hw - 0.1, 1.12, hd - 0.1, '#5d3b1d');
        Rg(-hw + 0.12, 1.06, -hd + 0.12, hw - 0.12, 1.08, hd - 0.12, [0.9, 0.45, 0.15]);
        R(hw - 0.3, 0.85, hd - 0.02, hw - 0.05, 1.0, hd + 0.01, '#15181b'); Rg(hw - 0.28, 0.9, hd + 0.01, hw - 0.07, 0.97, hd + 0.015, [0.3, 0.9, 0.5]);
        return;
      }
      case 'jetdeau': {
        R(-hw, 0, -hd, hw, 0.9, hd, '#8a949b'); R(-hw + 0.06, 0.9, -hd + 0.06, hw - 0.06, 0.92, hd - 0.06, '#3b5f78');
        for (const s of [-1, 1]) R(s * hw - 0.06, 0.9, -hd, s * hw + 0.06, 1.3, hd, '#e6b32c');
        R(-hw, 1.2, -0.12, hw, 1.38, 0.12, '#e6b32c'); R(-0.15, 0.95, -0.18, 0.15, 1.3, 0.18, '#2d3236'); K.cyl(PB, [x, b + 0.95, z], [x, b + 1.02, z], 0.03, 6, col('#ccc'));
        return;
      }
      case 'robot': {
        R(-0.7, 0, -0.7, 0.7, 0.75, 0.7, '#3a3f44');
        const bx = x, bz = z, base = b + 0.75;
        K.cyl(PB, [bx, base, bz], [bx, base + 0.25, bz], 0.22, 12, col('#e8892b'), true);
        const a = rng() * 6, s1 = [bx + Math.cos(a) * 0.35, base + 0.85, bz + Math.sin(a) * 0.35], s2 = [bx + Math.cos(a) * 0.75, base + 0.6, bz + Math.sin(a) * 0.75];
        K.bar(PB, [bx, base + 0.25, bz], s1, 0.16, 0.16, col('#e8892b')); K.bar(PB, s1, s2, 0.12, 0.12, col('#e8892b')); K.cyl(PB, s2, [s2[0], s2[1] - 0.18, s2[2]], 0.05, 8, col('#2b2f33'));
        for (const [u, v] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) R(u - 0.03, 0.75, v - 0.03, u + 0.03, 1.4, v + 0.03, '#e6b32c');
        return;
      }
      case 'etabli': case 'electronique': {
        R(-hw, 0.85, -hd, hw, 0.92, hd, p.sub === 'etabli' ? '#a57a4c' : '#d9d6cf');
        for (const s of [-1, 1]) R(s * hw - (s > 0 ? 0.08 : 0), 0, -hd, s * hw + (s < 0 ? 0.08 : 0), 0.85, hd, '#3a5f8a');
        R(-hw, 0.2, -hd, hw, 0.24, hd, '#3a5f8a');
        if (p.sub === 'etabli') { R(-hw + 0.2, 0.92, -0.1, -hw + 0.45, 1.05, 0.12, '#2f6fb0'); R(0.2, 0.92, -0.2, 0.6, 0.95, 0.2, '#8a8a8a'); R(-hw, 0.92, -hd, hw, 1.9, -hd + 0.03, '#9aa0a4'); for (let k = 0; k < 10; k++) R(-hw + 0.1 + k * 0.17, 1.3 + (k % 3) * 0.15, -hd + 0.03, -hw + 0.14 + k * 0.17, 1.5 + (k % 3) * 0.15, -hd + 0.06, '#2b2f33'); }
        else { R(-0.5, 0.92, -0.25, -0.1, 1.08, 0.1, '#2b3a4a'); Rg(-0.48, 0.95, 0.1, -0.12, 1.06, 0.105, [0.3, 1, 0.6]); R(0.1, 0.92, -0.2, 0.5, 0.94, 0.15, '#1f6b3a'); K.cyl(PB, [x + 0.7, b + 0.92, z], [x + 0.7, b + 1.3, z], 0.02, 6, col('#2b2f33')); }
        return;
      }
      // --- studio / expériences ---
      case 'fondvert': { R(-hw, 0, -hd, hw, 2.6, hd, '#2fa84a'); R(-hw, 2.5, -hd - 0.05, hw, 2.6, hd, '#2b2f33'); return; }
      case 'camera': { K.cyl(PB, [x, b, z], [x, b + 1.3, z], 0.03, 6, col('#2b2f33')); for (let k = 0; k < 3; k++) { const a = k * 2.09; K.bar(PB, [x, b + 0.7, z], [x + Math.cos(a) * 0.45, b, z + Math.sin(a) * 0.45], 0.025, 0.025, col('#2b2f33')); } R(-0.15, 1.3, -0.25, 0.15, 1.55, 0.2, '#1a1c1e'); K.cyl(PB, [x, b + 1.42, z + 0.2], [x, b + 1.42, z + 0.4], 0.09, 10, col('#111'), true); Rg(-0.1, 1.5, -0.26, -0.05, 1.53, -0.255, [1, 0.2, 0.15]); return; }
      case 'projecteur': { K.cyl(PB, [x, b, z], [x, b + 1.8, z], 0.03, 6, col('#2b2f33')); R(-0.3, 1.8, -0.3, 0.3, 2.1, 0.1, '#1a1c1e'); Rg(-0.26, 1.83, 0.1, 0.26, 2.07, 0.11, [1, 0.95, 0.85]); return; }
      case 'bureauprof': case 'bureau': case 'ilot': case 'tableexp': {
        const top = p.sub === 'ilot' ? '#e8e5de' : '#c9b38f';
        R(-hw, 0.72, -hd, hw, 0.76, hd, top);
        for (const s of [-1, 1]) R(s * hw - (s > 0 ? 0.05 : 0), 0, -hd + 0.05, s * hw + (s < 0 ? 0.05 : 0), 0.72, hd - 0.05, '#55595d');
        if (p.sub !== 'tableexp') { R(-0.3, 0.76, -0.15, 0.3, 1.14, -0.1, '#1a1c1e'); Rg(-0.28, 0.78, -0.1, 0.28, 1.12, -0.095, [0.55, 0.7, 0.95]); R(-0.04, 0.76, -0.2, 0.04, 0.9, -0.12, '#2b2f33'); }
        else { R(-0.3, 0.76, -0.2, 0.3, 0.8, 0.2, '#2b2f33'); K.cyl(PB, [x + 0.5, b + 0.76, z], [x + 0.5, b + 1.2, z], 0.015, 6, col('#888')); R(0.42, 1.2, -0.08, 0.58, 1.3, 0.08, '#1a1c1e'); }
        if (inst) { const n = p.sub === 'ilot' ? 2 : 1; for (let k = 0; k < n; k++) put('furn_chair_A', n > 1 ? (k ? 0.45 : -0.45) : 0, k ? -hd - 0.35 : hd + 0.35, k ? 0 : Math.PI, 0.75); }
        return;
      }
      case 'casque': { K.cyl(PB, [x, b, z], [x, b + 1.1, z], 0.04, 6, col('#2b2f33')); R(-0.18, 1.1, -0.12, 0.18, 1.26, 0.12, '#f2f2f2'); R(-0.15, 1.12, 0.12, 0.15, 1.24, 0.14, '#1a1c1e'); return; }
      case 'console': {
        R(-hw, 0.72, -hd, hw, 0.76, hd, '#3a3f44'); R(-hw, 0, -hd, hw, 0.72, -hd + 0.06, '#2b2f33');
        for (const s of [-0.6, 0, 0.6]) { R(s - 0.27, 0.8, -0.2, s + 0.27, 1.12, -0.16, '#111'); Rg(s - 0.25, 0.82, -0.16, s + 0.25, 1.1, -0.155, [0.35 + rng() * 0.3, 0.6, 0.9]); }
        if (inst) put('furn_chair_A', 0, hd + 0.4, Math.PI, 0.75);
        return;
      }
      case 'plateforme': { R(-hw, 0, -hd, hw, 0.22, hd, '#202226'); Rg(-hw - 0.01, 0.18, -hd - 0.01, hw + 0.01, 0.2, hd + 0.01, [0.25, 0.75, 1]); K.cyl(PB, [x, b + 0.22, z], [x, b + 1.0, z], 0.05, 8, col('#3a3f44')); R(-0.25, 1.0, -0.03, 0.25, 1.05, 0.03, '#3a3f44'); return; }
      case 'pupitre': case 'postepc': {
        R(-hw, 0.72, -0.55, hw, 0.76, 0.05, '#d8d2c4');
        for (const s of [-1, 1]) R(s * hw - (s > 0 ? 0.05 : 0), 0, -0.5, s * hw + (s < 0 ? 0.05 : 0), 0.72, 0.0, '#45494d');
        if (p.sub === 'postepc') for (const s of [-0.45, 0.45]) { R(s - 0.24, 0.76, -0.45, s + 0.24, 1.1, -0.41, '#141618'); Rg(s - 0.22, 0.78, -0.41, s + 0.22, 1.08, -0.405, [0.35, 0.55, 0.85]); R(s - 0.2, 0.76, -0.25, s + 0.2, 0.78, -0.1, '#202224'); }
        for (const s of [-0.45, 0.45]) { if (!put('furn_chair_A', s, 0.45, Math.PI, 0.72)) { R(s - 0.2, 0.42, 0.25, s + 0.2, 0.46, 0.65, '#3a5f8a'); R(s - 0.2, 0.46, 0.6, s + 0.2, 0.9, 0.64, '#3a5f8a'); } }
        return;
      }
      case 'tablereunion': {
        R(-hw, 0.72, -1, hw, 0.76, 1, '#5b4632');
        if (p.v === 1 || p.v === 2) R(-0.3, 0, -0.3, 0.3, 0.72, 0.3, '#2b2f33');
        if (inst) for (const s of [-1, 1]) put('furn_chair_A', s * (hw + 0.35), 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0.9);
        return;
      }
      default: R(-hw, 0, -hd, hw, p.h, hd, '#888');
    }
  }

  BR.World.gens.halle6 = genHalle6;
  BR.World.decor.halle6 = decorHalle6;
  BR.Maps2 = BR.Maps2 || {}; BR.Maps2.halle6 = { gen: genHalle6, furniture };
})();

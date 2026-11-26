/* ===== textures.js : textures dessinées par code (aucune photo), matériaux PBR et reflets
   Chaque texture couleur dessinée sur canvas donne aussi, automatiquement :
     - une carte de relief (normalMap) calculée depuis la luminance (joints creux, briques, écorce…) ;
     - une carte de rugosité (roughnessMap) : joints mats, surfaces lisses brillantes, usure, flaques ;
   et les matériaux reçoivent un environnement de reflets (cube dessiné par code : ciel nocturne et
   fenêtres pour l'extérieur, plafond à néons pour l'intérieur). Qualité « basse » : rien de tout ça.
   UV du monde : sols = 1 unité pour 2 m ; murs = 1 unité pour 4 m de large et 1 étage (4 m) de haut ;
   marches = 1 unité par giron (nez de marche en haut du dessin). Échelle des dessins : 128 px = 1 m (sauf mention).
   Pluie : BR.Tex.setWet(T, k) rend les matériaux du thème mouillés (k de 0 à 1). ===== */
(function () {
  const BR = window.BR;
  const T = (BR.Tex = {});
  const cache = {};
  const PXM = 128;            // pixels par mètre
  const qual = () => (BR.settings && BR.settings.quality) || 'high';

  function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
  function tex(c, rep, linear) {
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = qual() === 'low' ? 2 : 8;
    if (!linear) t.encoding = THREE.sRGBEncoding;
    if (rep) t.repeat.set(rep[0], rep[1]);
    return t;
  }
  // très léger grain
  function fine(g, w, h, amt) {
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
  }
  // taches douces (dessinées aussi de l'autre côté des bords : la texture reste raccordable)
  function soft(g, w, h, n, col, amin, amax, rmin, rmax) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = rmin + Math.random() * (rmax - rmin), a = amin + Math.random() * (amax - amin);
      for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) {
        const X = x + ox, Y = y + oy; if (X + r < 0 || X - r > w || Y + r < 0 || Y - r > h) continue;
        const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2);
      }
    }
  }
  // petits points (granulats, poussière)
  function speckle(g, w, h, n, cols, smin, smax) {
    for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const s = smin + Math.random() * (smax - smin); g.fillRect(Math.random() * w, Math.random() * h, s, s); }
  }
  // fissures ramifiées (restent loin des bords)
  function cracks(g, w, h, n, col, lw) {
    g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    const walk = (x, y, a, len, width, depth) => {
      g.lineWidth = width; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < len; s++) {
        a += (Math.random() - 0.5) * 0.9; x += Math.cos(a) * 7; y += Math.sin(a) * 7;
        if (x < 6 || y < 6 || x > w - 6 || y > h - 6) break;
        g.lineTo(x, y);
        if (depth < 2 && Math.random() < 0.06) { g.stroke(); walk(x, y, a + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.6), len * 0.4, width * 0.6, depth + 1); g.lineWidth = width; g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    };
    for (let k = 0; k < n; k++) walk(w * (0.2 + Math.random() * 0.6), h * (0.2 + Math.random() * 0.6), Math.random() * 6.28, 14 + Math.random() * 20, lw, 0);
  }
  // coulures verticales (sous les appuis de fenêtre, en haut des murs)
  function streaks(g, x0, y0, wd, len, a) {
    for (let k = 0; k < wd / 3; k++) {
      const x = x0 + Math.random() * wd, l = len * (0.3 + Math.random() * 0.7);
      const gr = g.createLinearGradient(0, y0, 0, y0 + l); gr.addColorStop(0, `rgba(30,25,20,${a})`); gr.addColorStop(1, 'rgba(30,25,20,0)');
      g.fillStyle = gr; g.fillRect(x, y0, 1 + Math.random() * 2.5, l);
    }
  }
  // saleté générale : taches sombres, assombrissement du bas
  function grime(g, w, h, amt, bottom) {
    soft(g, w, h, Math.round(6 * amt), '30,26,20', 0.04 * amt, 0.1 * amt, 20, 90);
    if (bottom) { const gr = g.createLinearGradient(0, h * (1 - bottom), 0, h); gr.addColorStop(0, 'rgba(25,20,15,0)'); gr.addColorStop(1, `rgba(25,20,15,${0.22 * amt})`); g.fillStyle = gr; g.fillRect(0, h * (1 - bottom), w, h * bottom); }
  }
  const hex = (c, k) => { const n = parseInt(c.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const vary = (c, a) => hex(c, 1 + (Math.random() - 0.5) * a);
  // dalles / pavés en appareil (rangées décalées) : couleur variée, joints, petit biseau
  function pavers(g, w, h, bw, bh, col, joint, va, offset, jw) {
    jw = jw || 2;
    g.fillStyle = joint; g.fillRect(0, 0, w, h);
    for (let y = 0, r = 0; y < h; y += bh, r++) {
      const off = offset ? (r % 2) * bw * offset : 0;
      for (let x = -bw + off; x < w; x += bw) {
        g.fillStyle = vary(col, va); g.fillRect(x + jw, y + jw, bw - jw * 2, bh - jw * 2);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + jw, y + jw, bw - jw * 2, 3);
        g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(x + jw, y + bh - jw - 3, bw - jw * 2, 3);
      }
    }
  }
  function grid(g, w, h, step, col, lw) { g.fillStyle = col; for (let p = 0; p < w; p += step) g.fillRect(p - lw / 2, 0, lw, h); for (let p = 0; p < h; p += step) g.fillRect(0, p - lw / 2, w, lw); }
  // plinthe (bas d'un mur couvrant un étage de 4 m = 512 px)
  function skirting(g, w, h, col, hpx) { hpx = hpx || 16; g.fillStyle = col; g.fillRect(0, h - hpx, w, hpx); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, h - hpx, w, 2); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h - hpx - 6, w, 6); }
  // feuilles (ellipses avec nervure)
  function leaves(g, n, cx, cy, R, cols, smin, smax) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, r = R * Math.sqrt(Math.random()), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, s = smin + Math.random() * (smax - smin);
      g.save(); g.translate(x, y); g.rotate(Math.random() * 6.283);
      g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(20,35,10,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
      g.fillStyle = 'rgba(255,255,220,0.10)'; g.beginPath(); g.ellipse(-s * 0.2, -s * 0.12, s * 0.5, s * 0.15, 0, 0, 6.283); g.fill();
      g.restore();
    }
  }

  /* ---------- façades d'immeubles : 1024 px = 8 m de large × 2 étages, fenêtres centrées sur les cases de 2 m ---------- */
  const facadeCache = {};
  function facade(id) {
    if (facadeCache[id]) return facadeCache[id];
    const o = FACADES[id] || FACADES.brick, W = 1024, H = 1024, SP = 512;
    const col = mk(W, H, () => {}), em = mk(W, H, () => {}), ro = mk(W, H, () => {});
    const g = col.getContext('2d'), e = em.getContext('2d'), r = ro.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
    r.fillStyle = 'rgb(225,225,225)'; r.fillRect(0, 0, W, H);
    g.fillStyle = o.wall; g.fillRect(0, 0, W, H);
    if (o.brick) {                                   // briques : rangs, teinte qui varie, joints creux
      const bh = 32, bw = 96;
      g.fillStyle = o.mortar || hex(o.wall, 1.35); g.fillRect(0, 0, W, H);
      for (let y = 0, k = 0; y < H; y += bh, k++) for (let x = -(k % 2) * bw / 2; x < W; x += bw) { g.fillStyle = vary(o.wall, 0.16); g.fillRect(x + 3, y + 3, bw - 5, bh - 5); if (Math.random() < 0.08) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 3, y + 3, bw - 5, bh - 5); } }
      speckle(g, W, H, 2500, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.07)'], 1, 3);
    }
    if (o.stone) {                                   // pierre de taille : grands blocs
      g.fillStyle = hex(o.wall, 0.78); g.fillRect(0, 0, W, H);
      for (let y = 0, k = 0; y < H; y += 64, k++) for (let x = -(k % 2) * 80; x < W; x += 160) { g.fillStyle = vary(o.wall, 0.08); g.fillRect(x + 2, y + 2, 156, 60); }
      speckle(g, W, H, 3000, ['rgba(0,0,0,0.07)', 'rgba(255,255,255,0.06)'], 1, 3);
    }
    if (o.siding) {                                  // bardage horizontal
      for (let y = 0; y < H; y += 24) { g.fillStyle = vary(o.wall, 0.05); g.fillRect(0, y, W, 24); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + 21, W, 3); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, y, W, 2); }
    }
    if (o.panels) { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < W; x += 256) g.fillRect(x - 1, 0, 3, H); for (let y = 0; y < H; y += 256) g.fillRect(0, y - 1, W, 2); }
    fine(g, W, H, 5);
    soft(g, W, H, 10, '35,30,25', 0.04, 0.1, 40, 160);       // salissures
    for (let s = 0; s < 2; s++) {
      const floorY = H - s * SP, topY = floorY - SP;
      // bandeau d'étage (au niveau de la dalle) + ombre portée
      g.fillStyle = o.band; g.fillRect(0, topY, W, 40); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, topY + 36, W, 4); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, topY + 40, W, 8);
      streaks(g, 0, topY + 48, W, 60, 0.12);
      if (o.spandrel) { g.fillStyle = o.spandrel; g.fillRect(0, floorY - o.sill * PXM - 10, W, 10); }
      if (o.shop && s === 0) {                          // rez-de-chaussée commerçant : grandes vitrines + store
        for (let i = 0; i < 4; i++) {
          const x0 = i * 256 + 16, x1 = x0 + 224, y0 = floorY - 400, y1 = floorY - 24;
          g.fillStyle = o.frameOut; g.fillRect(x0 - 8, y0 - 8, 240, y1 - y0 + 16);
          const lit = Math.random() < o.lit;
          const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, lit ? '#f4dfb0' : o.glass[0]); gr.addColorStop(1, lit ? '#c99e62' : o.glass[1]);
          g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); if (lit) { e.fillStyle = gr; e.fillRect(x0, y0, x1 - x0, y1 - y0); }
          r.fillStyle = 'rgb(30,30,30)'; r.fillRect(x0, y0, x1 - x0, y1 - y0);
          g.fillStyle = o.frameIn; g.fillRect(x0 + 108, y0, 8, y1 - y0); e.fillStyle = '#000'; e.fillRect(x0 + 108, y0, 8, y1 - y0);
          // store rayé
          const ac = BR.pick(['#b33a32', '#2f6a5a', '#c99a2e', '#3a4f7a']);
          for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#e9e2d0' : ac; g.fillRect(x0 - 8 + k * 30, y0 - 60, 30, 46); }
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0 - 8, y0 - 14, 240, 8);
        }
        continue;
      }
      for (let i = 0; i < 4; i++) {
        const cx = (i * 2 + 1) * PXM, ww = o.ww * PXM, wh = o.wh * PXM, x0 = Math.round(cx - ww / 2), y1 = Math.round(floorY - o.sill * PXM), y0 = y1 - wh;
        if (o.shutter) for (const sx of [-1, 1]) {
          const vx = sx < 0 ? x0 - ww / 2 - 14 : x0 + ww + 14;
          g.fillStyle = o.shutter; g.fillRect(vx, y0, ww / 2, wh);
          g.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = y0 + 10; y < y0 + wh - 6; y += 14) g.fillRect(vx + 6, y, ww / 2 - 12, 4);
        }
        g.fillStyle = o.frameOut; g.fillRect(x0 - 12, y0 - 12, ww + 24, wh + 24);
        const lit = Math.random() < o.lit;
        if (lit) {
          const tone = BR.pick(o.litTones || ['#ffd994', '#ffcf7a', '#ffe7b8']);
          const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, hex(tone, 1.02)); gr.addColorStop(1, hex(tone, 0.8));
          g.fillStyle = gr; g.fillRect(x0, y0, ww, wh);
          e.fillStyle = gr; e.fillRect(x0, y0, ww, wh);
          if (o.curtains && Math.random() < 0.6) {
            const cc = BR.pick(['#c75b4a', '#5b7fb5', '#d9c9a3', '#6e9b6a']), cw = ww * (0.18 + Math.random() * 0.12);
            g.fillStyle = cc; g.fillRect(x0, y0, cw, wh); g.fillRect(x0 + ww - cw, y0, cw, wh);
            e.fillStyle = 'rgba(0,0,0,0.55)'; e.fillRect(x0, y0, cw, wh); e.fillRect(x0 + ww - cw, y0, cw, wh);
          }
          if (Math.random() < 0.3) { const bh = wh * (0.2 + Math.random() * 0.3); g.fillStyle = '#efe6d2'; g.fillRect(x0, y0, ww, bh); e.fillStyle = 'rgba(0,0,0,0.6)'; e.fillRect(x0, y0, ww, bh); }
        } else {
          // vitre sombre : le reflet vient de l'environnement (rugosité très basse), on garde un léger dégradé
          const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, o.glass[0]); gr.addColorStop(1, o.glass[1]);
          g.fillStyle = gr; g.fillRect(x0, y0, ww, wh);
          g.save(); g.beginPath(); g.rect(x0, y0, ww, wh); g.clip();
          g.fillStyle = 'rgba(255,255,255,0.07)'; const rx = x0 + ww * (0.2 + Math.random() * 0.4);
          g.beginPath(); g.moveTo(rx, y0); g.lineTo(rx + ww * 0.28, y0); g.lineTo(rx - ww * 0.2, y1); g.lineTo(rx - ww * 0.48, y1); g.fill();
          if (Math.random() < 0.12) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.beginPath(); const px = x0 + Math.random() * ww, py = y0 + Math.random() * wh; for (let k = 0; k < 6; k++) { g.moveTo(px, py); g.lineTo(px + (Math.random() - 0.5) * ww, py + (Math.random() - 0.5) * wh); } g.stroke(); }
          g.restore();
        }
        r.fillStyle = 'rgb(18,18,18)'; r.fillRect(x0, y0, ww, wh);
        g.fillStyle = o.frameIn; e.fillStyle = '#000';
        const mw = o.mull || 8;
        g.fillRect(x0, y0, ww, mw); g.fillRect(x0, y1 - mw, ww, mw); g.fillRect(x0, y0, mw, wh); g.fillRect(x0 + ww - mw, y0, mw, wh);
        g.fillRect(Math.round(cx - mw / 2), y0, mw, wh); e.fillRect(Math.round(cx - mw / 2), y0, mw, wh);
        r.fillStyle = 'rgb(150,150,150)'; r.fillRect(Math.round(cx - mw / 2), y0, mw, wh);
        if (o.transom) { const ty = Math.round(y0 + wh * o.transom); g.fillRect(x0, ty, ww, mw); e.fillRect(x0, ty, ww, mw); }
        // appui de fenêtre + coulures en dessous
        g.fillStyle = o.sillCol; g.fillRect(x0 - 18, y1 + 10, ww + 36, 14); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x0 - 18, y1 + 24, ww + 36, 7);
        streaks(g, x0 - 10, y1 + 30, ww + 20, 90 + Math.random() * 80, 0.16);
      }
    }
    if (o.graffiti) for (let k = 0; k < 2; k++) {
      const cols = ['#e2384d', '#3fb4e6', '#f2c12e', '#7be34a', '#c94ae3'];
      g.save(); g.translate(40 + k * 512 + Math.random() * 180, 900 + Math.random() * 60); g.rotate((Math.random() - 0.5) * 0.2);
      const t = BR.pick(['RUN', 'NO EXIT', 'FUIS', 'HELP', 'ILS ARRIVENT', 'COURS']);
      g.font = "900 78px 'Arial Black', Impact, sans-serif"; g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#141414'; g.strokeText(t, 0, 0);
      g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.strokeText(t, 0, 0); g.fillStyle = BR.pick(cols); g.fillText(t, 0, 0); g.restore();
    }
    // pied de façade sali (éclaboussures)
    const gb = g.createLinearGradient(0, H - 120, 0, H); gb.addColorStop(0, 'rgba(30,25,20,0)'); gb.addColorStop(1, 'rgba(30,25,20,0.35)'); g.fillStyle = gb; g.fillRect(0, H - 120, W, 120);
    return (facadeCache[id] = { col, em, ro });
  }
  const FACADES = {
    brick:  { wall: '#a5523d', brick: true, band: '#e4d6bf', frameOut: '#e9ddc6', frameIn: '#f1e8d8', sillCol: '#efe4cf', glass: ['#30425a', '#1a2534'], ww: 1.05, wh: 1.75, sill: 0.95, lit: 0.42, curtains: true, transom: 0.3 },
    office: { wall: '#6e7c8c', panels: true, band: '#cfd5db', frameOut: '#2f353d', frameIn: '#3a414a', sillCol: '#c3c9cf', glass: ['#3c5875', '#1d2b3c'], ww: 1.7, wh: 2.25, sill: 0.8, lit: 0.5, litTones: ['#e9f0ff', '#fff1d0', '#dfe9f7'], mull: 7, spandrel: '#58636f' },
    stucco: { wall: '#e2d3b4', band: '#f4ecdc', frameOut: '#f7f1e4', frameIn: '#fbf7ee', sillCol: '#f4ecdc', glass: ['#34465c', '#1c2635'], ww: 0.95, wh: 1.8, sill: 0.95, lit: 0.38, curtains: true, shutter: '#3f6e5a', transom: 0.32 },
    teal:   { wall: '#4f8a8b', band: '#e8e1cf', frameOut: '#ece6d6', frameIn: '#f5f0e4', sillCol: '#ece6d6', glass: ['#2f4157', '#18222f'], ww: 1.05, wh: 1.8, sill: 0.95, lit: 0.4, curtains: true, transom: 0.3 },
    graffiti: { wall: '#5d4038', brick: true, band: '#8c7a6c', frameOut: '#a89888', frameIn: '#b5a796', sillCol: '#a89888', glass: ['#263445', '#141b25'], ww: 1.05, wh: 1.75, sill: 0.95, lit: 0.12, curtains: true, transom: 0.3, graffiti: true },
    dark:   { wall: '#5d4038', brick: true, band: '#8c7a6c', frameOut: '#a89888', frameIn: '#b5a796', sillCol: '#a89888', glass: ['#263445', '#141b25'], ww: 1.05, wh: 1.75, sill: 0.95, lit: 0.12, curtains: true, transom: 0.3 },
    stone:  { wall: '#c9bda6', stone: true, band: '#e2d8c4', frameOut: '#ddd2bd', frameIn: '#2c3036', sillCol: '#e6dcc8', glass: ['#2e3f55', '#18212d'], ww: 1.1, wh: 1.95, sill: 0.9, lit: 0.35, curtains: true, transom: 0.28 },
    siding: { wall: '#7d8f9a', siding: true, band: '#e6e2d8', frameOut: '#f0ece2', frameIn: '#f5f2ea', sillCol: '#ece7dc', glass: ['#2f4157', '#18222f'], ww: 1.0, wh: 1.7, sill: 1.0, lit: 0.35, curtains: true, transom: 0.3 },
    shopBrick: { wall: '#8e4a36', brick: true, band: '#d9ccb3', frameOut: '#2a2d31', frameIn: '#3a3e44', sillCol: '#d9ccb3', glass: ['#2b3b50', '#151d28'], ww: 1.05, wh: 1.75, sill: 0.95, lit: 0.45, curtains: true, transom: 0.3, shop: true },
  };
  T.FACADES = FACADES;     // registre ouvert : T.FACADES.monStyle = {...} puis { facade: 'monStyle' } dans un thème

  /* ---------------- dessins réutilisables ---------------- */
  const P = {
    // Backrooms : papier peint jaune, rayures, lés, taches d'humidité, plinthe (512 px = 4 m × 1 étage)
    wallpaper: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#cdb763'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(140,115,40,0.13)'; g.fillRect(x, 0, 6, h); g.fillStyle = 'rgba(255,245,190,0.12)'; g.fillRect(x + 14, 0, 3, h); }
      g.fillStyle = 'rgba(140,115,40,0.12)';
      for (let y = 20; y < h - 40; y += 40) for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x + 16, y); g.lineTo(x + 22, y + 7); g.lineTo(x + 16, y + 14); g.lineTo(x + 10, y + 7); g.fill(); }
      // lés de papier peint (raccords tous les 64 cm) légèrement décollés
      for (let x = 0; x < w; x += 82) { g.fillStyle = 'rgba(90,70,20,0.18)'; g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(255,250,210,0.12)'; g.fillRect(x + 2, 0, 2, h); }
      // auréoles d'humidité (bord plus foncé)
      // une seule auréole, irrégulière et discrète (sinon le motif se répète tous les 4 m)
      { const x = 80 + Math.random() * (w - 160), y = 40 + Math.random() * 120;
        for (let k = 0; k < 4; k++) { const ox = x + (Math.random() - 0.5) * 60, oy = y + (Math.random() - 0.5) * 30, r = 18 + Math.random() * 30; const gr = g.createRadialGradient(ox, oy, r * 0.4, ox, oy, r); gr.addColorStop(0, 'rgba(150,120,50,0.04)'); gr.addColorStop(0.85, 'rgba(110,80,25,0.1)'); gr.addColorStop(1, 'rgba(110,80,25,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(ox, oy, r * 1.4, r, Math.random() * 3, 0, 6.283); g.fill(); }
        streaks(g, x - 40, y + 20, 80, 200, 0.08); }
      soft(g, w, h, 3, '120,95,30', 0.05, 0.1, 40, 120);
      const gr = g.createLinearGradient(0, h * 0.75, 0, h); gr.addColorStop(0, 'rgba(90,70,20,0)'); gr.addColorStop(1, 'rgba(90,70,20,0.22)'); g.fillStyle = gr; g.fillRect(0, h * 0.75, w, h * 0.25);
      fine(g, w, h, 5); skirting(g, w, h, '#6d5a26', 14);
    }),
    // moquette humide : fibres, taches sombres
    carpet: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#ad9555'; g.fillRect(0, 0, w, h); fine(g, w, h, 16);
      speckle(g, w, h, 1800, ['rgba(80,62,25,0.25)', 'rgba(220,200,140,0.18)'], 1, 2);
      soft(g, w, h, 4, '90,72,30', 0.08, 0.16, 30, 80); soft(g, w, h, 2, '60,48,20', 0.16, 0.25, 12, 30);
    }),
    ceilTiles: (base, line) => mk(256, 256, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.06)'; for (let y = 6; y < h; y += 10) for (let x = 6; x < w; x += 10) g.fillRect(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3, 2, 2);
      soft(g, w, h, 2, '120,95,40', 0.06, 0.14, 20, 50);      // auréoles d'infiltration
      grid(g, w, h, 128, line, 5); fine(g, w, h, 4);
    }),
    // sols intérieurs / extérieurs
    asphalt: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#36383c'; g.fillRect(0, 0, w, h);
      soft(g, w, h, 14, '0,0,0', 0.04, 0.1, 40, 160); soft(g, w, h, 8, '255,255,255', 0.015, 0.035, 40, 140);
      speckle(g, w, h, 9000, ['rgba(255,255,255,0.09)', 'rgba(0,0,0,0.2)', 'rgba(160,150,140,0.12)'], 1, 2.2);
      // rapiéçages
      for (let k = 0; k < 2; k++) { const x = Math.random() * (w - 160) + 20, y = Math.random() * (h - 120) + 20, pw = 60 + Math.random() * 100, ph = 40 + Math.random() * 70; g.fillStyle = 'rgba(20,20,22,0.35)'; g.fillRect(x, y, pw, ph); g.strokeStyle = 'rgba(10,10,10,0.45)'; g.lineWidth = 2; g.strokeRect(x, y, pw, ph); }
      soft(g, w, h, 4, '12,10,6', 0.18, 0.3, 8, 26);       // taches d'huile
      cracks(g, w, h, 4, 'rgba(14,14,16,0.7)', 2.2);
      fine(g, w, h, 6);
    }),
    // trottoir : dalles de béton de 1 m, joints, taches, chewing-gums
    sidewalk: () => mk(256, 256, (g, w, h) => {
      pavers(g, w, h, 128, 128, '#b0aea7', '#7e7c76', 0.06, 0, 2);
      speckle(g, w, h, 1500, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.1)'], 1, 2);
      soft(g, w, h, 4, '40,35,30', 0.06, 0.14, 10, 40);
      speckle(g, w, h, 10, ['rgba(40,40,40,0.4)', 'rgba(200,200,200,0.35)'], 3, 5);
      cracks(g, w, h, 1, 'rgba(60,58,54,0.6)', 1.4);
      fine(g, w, h, 5);
    }),
    plaza: () => mk(512, 512, (g, w, h) => { pavers(g, w, h, 64, 32, '#a99b87', '#5f574c', 0.14, 0.5, 2); soft(g, w, h, 6, '30,25,20', 0.05, 0.12, 20, 70); speckle(g, w, h, 2500, ['rgba(0,0,0,0.1)', 'rgba(255,255,255,0.08)'], 1, 2); fine(g, w, h, 4); }),
    // parquet / plancher : lames, fil du bois, nœuds
    wood: (base) => mk(512, 512, (g, w, h) => {
      const pw = 26, col = base || '#9b6a42';
      for (let y = 0, k = 0; y < h; y += pw, k++) {
        let x = -Math.random() * 300;
        while (x < w) {
          const L = 220 + Math.random() * 200; g.fillStyle = vary(col, 0.16); g.fillRect(x, y, L, pw);
          g.strokeStyle = 'rgba(60,35,15,0.18)'; g.lineWidth = 1;
          for (let s = 0; s < 4; s++) { g.beginPath(); const yy = y + 3 + Math.random() * (pw - 6); g.moveTo(x, yy); for (let xx = x; xx < x + L; xx += 20) g.lineTo(xx, yy + Math.sin(xx * 0.03 + s) * 2); g.stroke(); }
          if (Math.random() < 0.25) { g.fillStyle = 'rgba(60,35,15,0.35)'; g.beginPath(); g.ellipse(x + Math.random() * L, y + pw / 2, 4, 2.5, 0, 0, 6.283); g.fill(); }
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y, 2, pw); x += L;
        }
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, y + 2, w, 2);
      }
      soft(g, w, h, 5, '40,25,10', 0.05, 0.12, 30, 100);
      fine(g, w, h, 5);
    }),
    // toit-terrasse : membrane bitumée en lés, gravillons, flaques sèches
    roof: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#56595e'; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 4000, ['rgba(255,255,255,0.12)', 'rgba(0,0,0,0.25)', 'rgba(140,130,120,0.2)'], 1, 2.5);
      g.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < h; y += 128) g.fillRect(0, y, w, 4); g.fillStyle = 'rgba(255,255,255,0.06)'; for (let y = 4; y < h; y += 128) g.fillRect(0, y, w, 2);
      soft(g, w, h, 4, '0,0,0', 0.06, 0.12, 30, 70); fine(g, w, h, 6);
    }),
    concrete: (base, joints) => mk(256, 256, (g, w, h) => {
      g.fillStyle = base || '#8e9196'; g.fillRect(0, 0, w, h);
      soft(g, w, h, 6, '0,0,0', 0.03, 0.08, 30, 90); soft(g, w, h, 3, '255,255,255', 0.03, 0.06, 30, 80);
      speckle(g, w, h, 700, ['rgba(0,0,0,0.16)', 'rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)'], 0.8, 1.6);     // bullage
      fine(g, w, h, 6);
      if (joints) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 3, w, 1); g.fillRect(3, 0, 1, h); }
    }),
    grate: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#5a5f65'; g.fillRect(0, 0, w, h); g.fillStyle = '#24272b'; for (let y = 6; y < h; y += 16) for (let x = 6; x < w; x += 16) g.fillRect(x, y, 9, 9); g.fillStyle = 'rgba(255,255,255,0.1)'; for (let y = 4; y < h; y += 16) g.fillRect(0, y, w, 2); soft(g, w, h, 4, '90,50,20', 0.1, 0.2, 20, 60); }),
    grass: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#4a7536'; g.fillRect(0, 0, w, h); soft(g, w, h, 10, '30,60,20', 0.1, 0.2, 20, 60); soft(g, w, h, 8, '150,190,90', 0.06, 0.14, 20, 50); soft(g, w, h, 3, '90,70,40', 0.1, 0.2, 10, 30);
      for (let k = 0; k < 900; k++) { const x = Math.random() * w, y = Math.random() * h, l = 4 + Math.random() * 6; g.strokeStyle = Math.random() < 0.5 ? 'rgba(35,70,24,0.55)' : 'rgba(125,170,80,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 5, y - l); g.stroke(); }
      speckle(g, w, h, 30, ['rgba(240,240,200,0.6)', 'rgba(230,210,80,0.5)'], 1.5, 2.5);   // petites fleurs
    }),
    tiles: (a, b, n, grout) => mk(256, 256, (g, w, h) => {
      const s = w / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = vary((x + y) % 2 ? a : b, 0.04); g.fillRect(x * s, y * s, s, s); }
      soft(g, w, h, 5, '60,55,45', 0.04, 0.1, 15, 60);                         // traces de pas, usure
      grid(g, w, h, s, grout, 3);
      g.fillStyle = 'rgba(0,0,0,0.06)'; for (let k = 0; k < 6; k++) { g.save(); g.translate(Math.random() * w, Math.random() * h); g.rotate(Math.random() * 3); g.fillRect(0, 0, 20 + Math.random() * 40, 1.2); g.restore(); }   // rayures
      fine(g, w, h, 3);
    }),
    // murs intérieurs : peinture + plinthe + éraflures
    paint: (col, sk) => mk(256, 512, (g, w, h) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0.06)'); gr.addColorStop(0.15, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      soft(g, w, h, 4, '60,50,40', 0.03, 0.07, 20, 80); grime(g, w, h, 0.8, 0.2);
      g.fillStyle = 'rgba(0,0,0,0.08)'; for (let k = 0; k < 5; k++) g.fillRect(Math.random() * w, h - 40 - Math.random() * 120, 10 + Math.random() * 30, 1.5);
      fine(g, w, h, 4); skirting(g, w, h, sk || '#5a4a3a', 16);
    }),
    mallWall: (col, line) => mk(512, 512, (g, w, h) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h);
      g.fillStyle = line; for (let x = 0; x < w; x += 256) g.fillRect(x, 0, 3, h); g.fillRect(0, 150, w, 3);
      grime(g, w, h, 0.6, 0.15);
      fine(g, w, h, 3); skirting(g, w, h, '#7c8288', 18);
    }),
    pillar: () => mk(256, 512, (g, w, h) => {
      g.fillStyle = '#a7aaae'; g.fillRect(0, 0, w, h); soft(g, w, h, 4, '0,0,0', 0.03, 0.06, 30, 80); speckle(g, w, h, 700, ['rgba(0,0,0,0.2)'], 1, 2.5); fine(g, w, h, 4);
      const y0 = h - 56; g.fillStyle = '#e8c21c'; g.fillRect(0, y0, w, 56); g.fillStyle = '#25272a';
      for (let x = -56; x < w; x += 40) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 20, h); g.lineTo(x + 76, y0); g.lineTo(x + 56, y0); g.fill(); }
      soft(g, w, h, 3, '0,0,0', 0.1, 0.18, 10, 30);    // éraflures de pare-chocs
    }),
    graffitiWall: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#8c9095'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 3, h); g.fillRect(0, 256, w, 3);
      speckle(g, w, h, 1500, ['rgba(0,0,0,0.18)'], 1, 2.5); grime(g, w, h, 1, 0.3); fine(g, w, h, 4);
      const cols = ['#e2384d', '#3fb4e6', '#f2c12e', '#7be34a', '#c94ae3'];
      g.save(); g.translate(50 + Math.random() * 160, 360 + Math.random() * 60); g.rotate((Math.random() - 0.5) * 0.25);
      const t = BR.pick(['RUN', 'NO EXIT', 'FUIS', 'HELP', 'ILS ARRIVENT', 'COURS']);
      g.font = "900 72px 'Arial Black', Impact, sans-serif"; g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#141414'; g.strokeText(t, 0, 0);
      g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.strokeText(t, 0, 0); g.fillStyle = BR.pick(cols); g.fillText(t, 0, 0); g.restore();
      skirting(g, w, h, '#5d6166', 14);
    }),
    // marche : nez de marche (bande antidérapante) en haut du dessin, usure au centre
    stairs: (base, edge) => mk(128, 128, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h); fine(g, w, h, 5);
      soft(g, w, h, 2, '0,0,0', 0.08, 0.14, 20, 40); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(w * 0.3, 16, w * 0.4, h - 20);
      g.fillStyle = edge; g.fillRect(0, 0, w, 14); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 0; x < w; x += 6) g.fillRect(x, 2, 2, 10);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 14, w, 3); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, h - 3, w, 3);
    }),
    edge: (base, stripe) => mk(256, 64, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); fine(g, w, h, 4); soft(g, w, h, 3, '0,0,0', 0.06, 0.12, 10, 30); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, w, 3); if (stripe) { g.fillStyle = stripe; g.fillRect(0, h - 10, w, 6); } }),
    noise: () => mk(64, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); fine(g, w, h, 8); }),
    skylight: () => mk(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#22344a'); gr.addColorStop(1, '#101a27'); g.fillStyle = gr; g.fillRect(0, 0, w, h); grid(g, w, h, 64, '#6b7682', 7); for (let k = 0; k < 30; k++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }),
    // vitrine de boutique (512 px = 4 m × 1 étage) : verre dépoli éclairé, montants alu, bandeau ; rien de visible au travers
    storefront: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#2a2d33'; g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, 128, 0, h - 20); gr.addColorStop(0, '#f3ead8'); gr.addColorStop(0.6, '#e7d7b8'); gr.addColorStop(1, '#cdb894'); g.fillStyle = gr; g.fillRect(0, 128, w, h - 148);
      g.fillStyle = 'rgba(255,255,255,0.22)'; for (let k = 0; k < 2; k++) { const x = 60 + k * 230 + Math.random() * 60; g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 60, 128); g.lineTo(x - 40, h - 20); g.lineTo(x - 100, h - 20); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.55)'; for (let x = 12; x < w; x += 22) g.fillRect(x, 300, 10, 10);
      g.fillStyle = '#b9c0c7'; g.fillRect(0, 120, w, 12); g.fillRect(0, h - 24, w, 12); g.fillRect(0, 120, 12, h - 140); g.fillRect(w - 12, 120, 12, h - 140); g.fillRect(w / 2 - 6, 120, 12, h - 140);
      g.fillStyle = '#30343b'; g.fillRect(0, 0, w, 120); g.fillStyle = '#c9a227'; g.fillRect(0, 108, w, 6);
      g.fillStyle = '#4a4e55'; g.fillRect(0, h - 12, w, 12);
    }),
    storefrontE: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, 128, 0, h - 20); gr.addColorStop(0, 'rgba(255,240,215,0.85)'); gr.addColorStop(1, 'rgba(255,225,180,0.45)'); g.fillStyle = gr; g.fillRect(12, 132, w - 24, h - 156);
      g.fillStyle = '#000'; g.fillRect(w / 2 - 6, 120, 12, h - 140);
      g.fillStyle = 'rgba(255,214,120,0.9)'; g.fillRect(0, 108, w, 6);
    }),
    /* ---- nature ---- */
    // écorce : crevasses verticales sinueuses, plaques (256 px de tour × 512 px = 2 m)
    bark: (base) => mk(256, 512, (g, w, h) => {
      g.fillStyle = base || '#7a6a5a'; g.fillRect(0, 0, w, h);
      soft(g, w, h, 8, '40,32,24', 0.1, 0.22, 20, 60); soft(g, w, h, 5, '150,140,120', 0.06, 0.12, 20, 50);
      for (let k = 0; k < 22; k++) {
        let x = Math.random() * w; const lw = 2 + Math.random() * 4;
        g.strokeStyle = `rgba(28,20,14,${0.45 + Math.random() * 0.35})`; g.lineWidth = lw; g.beginPath(); g.moveTo(x, -10);
        for (let y = -10; y <= h + 10; y += 16) { x += (Math.random() - 0.5) * 8; g.lineTo(x, y); }
        g.stroke();
        g.strokeStyle = 'rgba(200,185,160,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + lw, -10); g.lineTo(x + lw + 2, h + 10); g.stroke();
      }
      soft(g, w, h, 4, '80,110,60', 0.12, 0.22, 10, 40);   // mousse
      fine(g, w, h, 10);
    }),
    // feuillage dense (volumes intérieurs, haies) : opaque
    leafDense: (base) => mk(256, 256, (g, w, h) => {
      g.fillStyle = base || '#2f4a22'; g.fillRect(0, 0, w, h);
      for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) { g.save(); g.translate(ox, oy); leaves(g, 260, w / 2, h / 2, w * 0.75, ['#3d6129', '#4d7533', '#5b8a3a', '#34552a', '#6b9645'], 5, 10); g.restore(); }
      soft(g, w, h, 8, '10,20,5', 0.15, 0.3, 10, 30);
    }),
    // carte de feuillage : grappe de feuilles sur fond transparent (alphaTest)
    leafCard: (cols) => mk(256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(70,50,30,0.9)'; g.lineWidth = 3;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(w / 2, h / 2); const a = Math.random() * 6.283; g.lineTo(w / 2 + Math.cos(a) * 90, h / 2 + Math.sin(a) * 90); g.stroke(); }
      leaves(g, 330, w / 2, h / 2, 112, cols || ['#4b7a30', '#5d8e3a', '#3c6628', '#6fa045', '#7fae52', '#42702c'], 6, 13);
    }),
    // eau : vaguelettes (sert surtout de carte de relief)
    water: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#1b3440'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 90; k++) { const x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * 26; for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.03)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } }
    }),
    gravel: (base) => mk(256, 256, (g, w, h) => {
      g.fillStyle = base || '#a39784'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 2600; k++) { const x = Math.random() * w, y = Math.random() * h, r = 1 + Math.random() * 2.6; g.fillStyle = vary(base || '#a39784', 0.45); g.beginPath(); g.ellipse(x, y, r, r * 0.8, Math.random() * 3, 0, 6.283); g.fill(); if (r > 2) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - r * 0.6, y + r * 0.5, r * 1.2, 1); } }
      soft(g, w, h, 6, '40,35,25', 0.06, 0.14, 15, 50); fine(g, w, h, 6);
    }),
    sand: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#c9b48a'; g.fillRect(0, 0, w, h); fine(g, w, h, 22); soft(g, w, h, 10, '120,100,60', 0.06, 0.16, 15, 50); speckle(g, w, h, 600, ['rgba(255,255,255,0.25)', 'rgba(80,60,30,0.25)'], 1, 2); }),
    // sol souple d'aire de jeux (granulés EPDM)
    rubber: (base) => mk(256, 256, (g, w, h) => { g.fillStyle = base || '#9c3b2f'; g.fillRect(0, 0, w, h); speckle(g, w, h, 6000, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.12)', 'rgba(40,90,140,0.35)', 'rgba(230,200,60,0.3)'], 1, 2.5); soft(g, w, h, 5, '0,0,0', 0.05, 0.12, 20, 60); }),
    brick: (base, mortar) => mk(512, 512, (g, w, h) => {
      g.fillStyle = mortar || '#9a9286'; g.fillRect(0, 0, w, h);
      for (let y = 0, k = 0; y < h; y += 32, k++) for (let x = -(k % 2) * 48; x < w; x += 96) { g.fillStyle = vary(base || '#9a4a36', 0.18); g.fillRect(x + 3, y + 3, 91, 27); }
      speckle(g, w, h, 2500, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.08)'], 1, 3); grime(g, w, h, 1, 0.25); fine(g, w, h, 6);
    }),
    // tôle / métal brossé
    metal: (base) => mk(256, 256, (g, w, h) => { g.fillStyle = base || '#7d8288'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`; g.fillRect(0, y, w, 1); } soft(g, w, h, 4, '90,60,30', 0.06, 0.14, 15, 40); }),
    // carrelage mural (faïence) : petits carreaux 15 cm
    faience: (col, grout) => mk(256, 512, (g, w, h) => { pavers(g, w, h, 19, 19, col || '#dfe6e8', grout || '#9aa3a6', 0.04, 0, 1); grime(g, w, h, 0.7, 0.2); fine(g, w, h, 3); }),
    // tableau de bord / numéros / panneaux : texte sur fond (utilitaire)
    label: (text, bg, fg, w, h, font) => mk(w || 256, h || 64, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.font = font || `bold ${Math.floor(H * 0.6)}px 'Segoe UI', Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + 2); }),
  };
  // outils de dessin exposés aux cartes (js/maps/*.js)
  Object.assign(P, { mk, fine, soft, speckle, cracks, streaks, grime, pavers, grid, skirting, leaves, vary, hex });

  /* ---------------- cartes dérivées : relief, rugosité, flaques ---------------- */
  function lumOf(c) {
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
    for (let i = 0, j = 0; j < L.length; i += 4, j++) L[j] = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255 * (d[i + 3] / 255);
    return L;
  }
  // bruit de valeur basse fréquence, raccordable
  function lowNoise(w, h, cells) {
    const n = cells, G = new Float32Array(n * n); for (let i = 0; i < G.length; i++) G[i] = Math.random();
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = x / w * n, fy = y / h * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const a = G[(y0 % n) * n + x0 % n], b = G[(y0 % n) * n + (x0 + 1) % n], c = G[((y0 + 1) % n) * n + x0 % n], d = G[((y0 + 1) % n) * n + (x0 + 1) % n];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      out[y * w + x] = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    }
    return out;
  }
  // masque de flaques (1 = eau stagnante) : seuil doux sur du bruit basse fréquence
  function puddleMask(w, h, amt) {
    const n1 = lowNoise(w, h, 4), n2 = lowNoise(w, h, 9), M = new Float32Array(w * h), th = 1 - amt * 0.55;
    for (let i = 0; i < M.length; i++) { const v = n1[i] * 0.7 + n2[i] * 0.3; M[i] = Math.max(0, Math.min(1, (v - th) / 0.06)); }
    return M;
  }
  function normalFrom(c, strength, mask) {
    const w = c.width, h = c.height, L = lumOf(c), out = mk(w, h, () => {}), g = out.getContext('2d'), id = g.createImageData(w, h), d = id.data;
    // lissage léger du relief (évite le crénelage)
    const S = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const xl = (x - 1 + w) % w, xr = (x + 1) % w; S[y * w + x] = (L[y * w + xl] + 2 * L[y * w + x] + L[y * w + xr]) * 0.25; }
    for (let y = 0; y < h; y++) {
      const yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w;
      for (let x = 0; x < w; x++) {
        const xl = (x - 1 + w) % w, xr = (x + 1) % w, i = y * w + x;
        let nx = -(S[y * w + xr] - S[y * w + xl]) * strength, ny = -(S[yu + x] - S[yd + x]) * strength, nz = 1;
        if (mask) { const m = 1 - mask[i]; nx *= m; ny *= m; }
        const l = Math.hypot(nx, ny, nz); d[i * 4] = (nx / l * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; d[i * 4 + 2] = (nz / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    return out;
  }
  // rugosité : base, joints (sombres) plus mats, zones claires plus lisses, usure en grandes taches, flaques très lisses
  function roughFrom(c, base, vari, mask) {
    const w = c.width, h = c.height, L = lumOf(c), N = lowNoise(w, h, 5), out = mk(w, h, () => {}), g = out.getContext('2d'), id = g.createImageData(w, h), d = id.data;
    let mean = 0; for (let i = 0; i < L.length; i++) mean += L[i]; mean /= L.length;
    for (let i = 0; i < L.length; i++) {
      let r = base + (mean - L[i]) * vari + (N[i] - 0.5) * 0.22 * Math.min(1, base * 1.6);
      if (mask) r = r * (1 - mask[i]) + 0.05 * mask[i];
      r = Math.max(0.03, Math.min(1, r)) * 255;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = r; d[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    return out;
  }

  /* ---------------- environnement de reflets (cube dessiné par code) ----------------
     th.env = { kind: 'night' | 'indoor', panel, wall, floor, ceil, glow } (déduit du thème sinon) */
  const envCache = {};
  function envCube(th, size) {
    const e = Object.assign({ kind: th.outdoor ? 'night' : 'indoor' }, th.env || {});
    const key = JSON.stringify(e) + size + (th.panel || '');
    if (envCache[key]) return envCache[key];
    const c3 = s => { const c = new THREE.Color(s); return [c.r * 255, c.g * 255, c.b * 255]; };
    const panel = c3(e.panel || th.panel || '#fff4dc'), wall = c3(e.wall || '#45423b'), floor = c3(e.floor || '#18171a'), ceil = c3(e.ceil || '#2c2b29'), glow = c3(e.glow || '#ff9a4a');
    const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
    const lampDirs = []; for (let k = 0; k < 14; k++) { const az = k / 14 * 6.283 + hash(k, 3) * 0.4, el = 0.03 + hash(k, 7) * 0.12; lampDirs.push([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]); }
    const fn = e.kind === 'night' ? d => {
      const y = d[1], az = Math.atan2(d[2], d[0]);
      let c;
      if (y >= 0) {
        const t = Math.min(1, y / 0.55), hz = Math.max(0, 1 - y * 5);
        // halo orangé de l'éclairage urbain à l'horizon : c'est lui que reflètent les sols mouillés et les vitres
        c = [30 + (6 - 30) * t + glow[0] * 0.3 * hz, 30 + (10 - 30) * t + glow[1] * 0.24 * hz, 40 + (24 - 40) * t + glow[2] * 0.14 * hz];
        // silhouettes d'immeubles et fenêtres éclairées
        const col = Math.floor((az + 3.1416) * 9), hgt = 0.05 + hash(col, 1) * 0.22;
        if (y < hgt) {
          c = [18, 18, 24];
          const wx = Math.floor((az + 3.1416) * 70), wy = Math.floor(y * 60);
          if ((wx % 3) && (wy % 2) && hash(wx, wy) < 0.3) { const k = 0.55 + hash(wy, wx) * 0.45; c = [255 * k, 205 * k, 140 * k]; }
        }
      } else {
        c = [14 + glow[0] * 0.03, 14 + glow[1] * 0.025, 17];
      }
      // lampadaires (points chauds) et lune
      for (const L of lampDirs) { const dd = d[0] * L[0] + d[1] * L[1] + d[2] * L[2]; if (dd > 0.9975) { c = [255, 214, 150]; } else if (dd > 0.985) { const k = (dd - 0.985) / 0.0125; c = [c[0] + 160 * k * k, c[1] + 110 * k * k, c[2] + 60 * k * k]; } }
      const md = -0.45 * d[0] + 0.55 * d[1] - 0.7 * d[2]; if (md > 0.9985) c = [230, 236, 255]; else if (md > 0.98) { const k = (md - 0.98) / 0.0185; c = [c[0] + 50 * k, c[1] + 60 * k, c[2] + 90 * k]; }
      return c;
    } : d => {
      const y = d[1];
      if (y > 0.2) {
        // plafond à 2,5 m au-dessus de l'œil : dalles lumineuses en grille de 3 m
        const t = 2.5 / y, px = d[0] * t, pz = d[2] * t, fx = ((px % 3) + 3) % 3, fz = ((pz % 3) + 3) % 3;
        const fade = Math.min(1, (y - 0.2) * 4);
        if (fx > 0.9 && fx < 2.1 && fz > 1.2 && fz < 1.8) return [panel[0] * fade + ceil[0] * (1 - fade), panel[1] * fade + ceil[1] * (1 - fade), panel[2] * fade + ceil[2] * (1 - fade)];
        return ceil;
      }
      if (y < -0.15) return floor;
      const k = 0.65 + 0.35 * (y + 0.15) / 0.35;
      return [wall[0] * k, wall[1] * k, wall[2] * k];
    };
    // faces dans l'ordre +X, -X, +Y, -Y, +Z, -Z (convention des cubemaps OpenGL)
    const dirOf = [(u, v) => [1, -v, -u], (u, v) => [-1, -v, u], (u, v) => [u, 1, v], (u, v) => [u, -1, -v], (u, v) => [u, -v, 1], (u, v) => [-u, -v, -1]];
    const imgs = dirOf.map(df => mk(size, size, (g, w, h) => {
      const id = g.createImageData(w, h), dd = id.data;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w * 2 - 1, v = (py + 0.5) / h * 2 - 1, r = df(u, v), l = Math.hypot(r[0], r[1], r[2]);
        const c = fn([r[0] / l, r[1] / l, r[2] / l]), i = (py * w + px) * 4;
        dd[i] = Math.min(255, c[0]); dd[i + 1] = Math.min(255, c[1]); dd[i + 2] = Math.min(255, c[2]); dd[i + 3] = 255;
      }
      g.putImageData(id, 0, 0);
    }));
    const cube = new THREE.CubeTexture(imgs);
    cube.encoding = THREE.sRGBEncoding; cube.needsUpdate = true;
    return (envCache[key] = cube);
  }
  T.envCube = envCube;

  /* ---------------- thèmes ----------------
     Surface : nom de texture, ou { t: nom, rep: [ru, rv], rough, metal, color, em: carte d'émission, ei: intensité,
       n: force du relief (0 = aucun, 1 par défaut), rv: variation de rugosité selon le dessin (0.6 par défaut),
       puddle: quantité de flaques 0..1, env: intensité des reflets, wet: sensibilité à la pluie 0..1 (setWet),
       transparent, opacity, double (deux faces), alphaTest, basic (non éclairé), emissive: couleur, flow: [vu, vv] (eau) }
     th.mats = { clé: surface } : matériaux libres pour le décor des cartes (B('clé')).
     th.env : voir envCube. */
  const THEMES = {
    backrooms: {
      name: 'Backrooms', fog: 0x1c1708, fogDensity: 0.05, ambient: 0x8a7b45, ambientI: 0.16, hemi: [0xfff0b0, 0x4a3c16, 0.1], exposure: 0.8,
      lightColor: 0xfff0b8, panel: '#fff6cf', flicker: 0.3, deadLights: 0.24, outdoor: false, lightI: 0.5, flashI: 0.75,
      env: { kind: 'indoor', wall: '#5e5434', floor: '#3a3220', ceil: '#6b6448' },
      tex: {
        floor: { 0: { t: 'carpet', rough: 1, n: 1.4 } },
        wall: { 0: { t: 'wallpaper', rough: 0.9, n: 0.8 } },
        ci: { t: 'ceilY', n: 1.2 }, co: { t: 'ceilY' },
        e: { t: 'edgeY' }, r: { t: 'stairsY', rough: 0.95 }, rs: { t: 'edgeY' },
      },
    },
    mall: {
      name: 'Centre commercial', fog: 0x0a0d12, fogDensity: 0.03, ambient: 0x6a7280, ambientI: 0.42, hemi: [0xc8d4ee, 0x201c18, 0.35], exposure: 1.0,
      lightColor: 0xf2f5ff, panel: '#f4f8ff', flicker: 0.14, deadLights: 0.22, outdoor: false,
      env: { kind: 'indoor', wall: '#4f545c', floor: '#2c2a27', ceil: '#3a3d42' },
      tex: {
        floor: { 0: { t: 'mallTile', rough: 0.22, env: 2.2 }, 1: { t: 'mallTile', rough: 0.22, env: 2.2 }, 2: { t: 'wood', rough: 0.45, env: 1.2 }, 3: { t: 'darkTile', rough: 0.25, env: 2 }, 4: { t: 'concreteJ', rough: 0.8 }, 5: { t: 'grate', rough: 0.5, metal: 0.5 } },
        wall: { 7: { t: 'storefront', em: 'storefrontE', ei: 0.9, rough: 0.12, env: 1.6, n: 0.3 }, 0: { t: 'mallWall', rough: 0.6 }, 1: { t: 'mallWall', rough: 0.6 }, 2: { t: 'shopWallA', rough: 0.65 }, 3: { t: 'shopWallB', rough: 0.65 }, 4: { t: 'concreteWall' } },
        ci: { t: 'ceilW' }, co: { t: 'ceilW' },
        e: { t: 'edgeMall', rough: 0.4 }, rs: { t: 'edgeMall', rough: 0.4, metal: 0.3 }, r: { t: 'escalator', metal: 0.5, rough: 0.4 }, rr: { t: 'escalatorR', metal: 0.5, rough: 0.4 },
      },
    },
    city: {
      name: 'Ville', fog: 0x0c1222, fogDensity: 0.017, ambient: 0x5a6680, ambientI: 0.5, hemi: [0x8ea2d0, 0x1c1a18, 0.6], exposure: 1.15,
      lightColor: 0xffc77a, panel: '#fff1d0', flicker: 0.12, deadLights: 0.2, outdoor: true, sky: 0x0b1020, moon: 0x9fb4e0,
      env: { kind: 'night' },
      tex: {
        floor: { 0: { t: 'asphalt', rep: [0.25, 0.25], rough: 0.85, puddle: 0.5, n: 1.6 }, 1: { t: 'asphalt', rep: [0.25, 0.25], rough: 0.85, puddle: 0.5, n: 1.6 }, 2: { t: 'sidewalk', rough: 0.8, puddle: 0.15 }, 3: { t: 'plaza', rep: [0.5, 0.5], rough: 0.75, puddle: 0.2 }, 4: { t: 'wood', rep: [0.5, 0.5], rough: 0.55, wet: 0, env: 0.8 }, 5: { t: 'roof', rough: 0.8, puddle: 0.25 }, 6: { t: 'concreteJ', rough: 0.75, wet: 0.3 }, 7: { t: 'deck', rough: 0.75, puddle: 0.2 }, 8: { t: 'grate', rough: 0.5, metal: 0.5 }, 9: { t: 'grass', rough: 0.95, n: 1.2 } },
        wall: { 1: { facade: 'brick' }, 6: { facade: 'office' }, 10: { facade: 'stucco' }, 11: { facade: 'teal' }, 2: { facade: 'dark' }, 0: { facade: 'dark' }, 3: { t: 'pillar', wet: 0 }, 4: { t: 'paintW', wet: 0 }, 5: { facade: 'graffiti' } },
        wallIn: { t: 'paintW', wet: 0 },
        ci: { t: 'ceilC' }, co: { t: 'concrete' }, e: { t: 'edgeC' }, rs: { t: 'concrete' }, r: { t: 'stairsC', rough: 0.8 },
      },
    },
  };
  const MAKE = {
    carpet: () => P.carpet(), wallpaper: () => P.wallpaper(), ceilY: () => P.ceilTiles('#e6dcb0', '#b6a978'), stairsY: () => P.stairs('#a48d4f', '#7a6834'), edgeY: () => P.edge('#c9b46a'),
    mallTile: () => P.tiles('#e7e2d8', '#d9d3c7', 2, 'rgba(110,102,90,0.55)'), darkTile: () => P.tiles('#474b53', '#3d4148', 2, 'rgba(15,15,15,0.6)'), wood: () => P.wood(),
    concrete: () => P.concrete('#8e9196'), concreteJ: () => P.concrete('#8e9196', true), deck: () => P.concrete('#80848a', true), grate: () => P.grate(),
    mallWall: () => P.mallWall('#ece8df', 'rgba(0,0,0,0.06)'), shopWallA: () => P.mallWall('#cfe0ea', 'rgba(0,0,0,0.06)'), shopWallB: () => P.mallWall('#efd9c9', 'rgba(0,0,0,0.06)'),
    concreteWall: () => P.paint('#9a9da1', '#4f5357'), ceilW: () => P.ceilTiles('#eff1f3', '#c3c8cd'), edgeMall: () => P.edge('#c9ced3', '#8e959c'), escalator: () => P.stairs('#8a9097', '#d8b13a'),
    escalatorR: () => P.metal('#6f757c'),
    asphalt: () => P.asphalt(), sidewalk: () => P.sidewalk(), plaza: () => P.plaza(), roof: () => P.roof(), grass: () => P.grass(),
    pillar: () => P.pillar(), graffiti: () => P.graffitiWall(), paintW: () => P.paint('#d8d1c2', '#5a4a3a'), ceilC: () => P.ceilTiles('#e3ddd0', '#bdb6a6'),
    edgeC: () => P.edge('#a3a6aa'), stairsC: () => P.stairs('#9a9da1', '#d0a92a'), skylight: () => P.skylight(), noise: () => P.noise(), storefront: () => P.storefront(), storefrontE: () => P.storefrontE(),
    bark: () => P.bark(), leafDense: () => P.leafDense(), leafCard: () => P.leafCard(), water: () => P.water(), gravel: () => P.gravel(), sand: () => P.sand(), rubber: () => P.rubber(),
    brick: () => P.brick(), metal: () => P.metal(), faience: () => P.faience(),
  };

  // registres ouverts : les fichiers js/maps/*.js ajoutent leurs thèmes (T.THEMES.x = …), leurs dessins de textures (T.MAKE.y = () => canvas)
  // et peuvent réutiliser les pinceaux procéduraux (T.P.concrete, T.P.tiles, T.P.wood, T.P.grass…)
  T.THEMES = THEMES; T.MAKE = MAKE; T.P = P;
  T.theme = id => THEMES[id] || THEMES.backrooms;

  // sensibilité à la pluie par défaut selon la clé de matériau
  function wetDefault(key, th) {
    if (!th.outdoor) return 0;
    const c = key[0];
    if (c === 'f' || key === 'curb' || key === 'paint' || key === 'e') return 1;
    if (key === 'r' || key === 'rr' || key === 'rs' || key === 'p' || key === 'glass') return 0.6;
    if (key === 'leaf' || key === 'leafc' || key === 'bark') return 0.7;
    if (c === 'w') return key[key.length - 1] === 'i' ? 0 : 0.5;
    return 0;
  }

  T.build = function (id) {
    const q = qual(), ck = id + '|' + q;
    if (cache[ck]) return cache[ck];
    const th = T.theme(id), hi = q !== 'low', canvases = {}, texCache = {}, matCache = {}, mats = [];
    const env = hi ? envCube(th, q === 'high' ? 128 : 64) : null;
    const canvasOf = name => canvases[name] || (canvases[name] = (MAKE[name] || MAKE.noise)());
    const masks = {};
    const maskOf = (name, amt) => { const k = name + amt; if (!masks[k]) { const c = canvasOf(name); masks[k] = puddleMask(c.width, c.height, amt); } return masks[k]; };
    const getTex = (name, rep) => { const k = name + (rep ? rep.join('x') : ''); return texCache[k] || (texCache[k] = tex(canvasOf(name), rep)); };
    const getNorm = (name, rep, n, pud) => { const k = 'n_' + name + (rep ? rep.join('x') : '') + n + '_' + (pud || 0); return texCache[k] || (texCache[k] = tex(normalFrom(canvasOf(name), n * 4, pud ? maskOf(name, pud) : null), rep, true)); };
    const getRough = (name, rep, r, rv, pud) => { const k = 'r_' + name + (rep ? rep.join('x') : '') + r + '_' + rv + '_' + (pud || 0); return texCache[k] || (texCache[k] = tex(roughFrom(canvasOf(name), r, rv, pud ? maskOf(name, pud) : null), rep, true)); };
    const finish = (m, spec, key) => {
      m.userData.keep = true;
      m.userData.base = { rough: m.roughness, env: m.envMapIntensity != null ? m.envMapIntensity : 1, color: m.color ? m.color.clone() : null, wet: spec && spec.wet != null ? spec.wet : wetDefault(key, th) };
      mats.push(m);
      return m;
    };
    const make = (spec, key) => {
      if (typeof spec === 'string') spec = { t: spec };
      let m;
      if (spec.facade) {
        const f = facade(spec.facade), rep = [0.5, 0.5];
        const k = 'fa_' + spec.facade;
        const map = texCache[k] || (texCache[k] = tex(f.col, rep)), em = texCache[k + 'e'] || (texCache[k + 'e'] = tex(f.em, rep)), ro = texCache[k + 'r'] || (texCache[k + 'r'] = tex(f.ro, rep, true));
        m = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.0, roughnessMap: ro, roughness: 1, metalness: 0.05, vertexColors: true });
        if (hi) {
          m.normalMap = texCache[k + 'n'] || (texCache[k + 'n'] = tex(normalFrom(f.col, 3), rep, true));
          if (env) { m.envMap = env; m.envMapIntensity = spec.env != null ? spec.env : 1.4; }
        }
        return finish(m, spec, key);
      }
      if (spec.basic) {
        m = new THREE.MeshBasicMaterial({ map: spec.t ? getTex(spec.t, spec.rep) : null, color: new THREE.Color(spec.color || '#ffffff'), vertexColors: spec.vc !== false, transparent: !!spec.transparent, opacity: spec.opacity != null ? spec.opacity : 1, side: spec.double ? THREE.DoubleSide : THREE.FrontSide, depthWrite: spec.depthWrite !== false });
        if (spec.blend === 'add') m.blending = THREE.AdditiveBlending;
        return finish(m, spec, key);
      }
      const rough = spec.rough != null ? spec.rough : 0.88;
      m = new THREE.MeshStandardMaterial({ map: spec.t ? getTex(spec.t, spec.rep) : null, vertexColors: spec.vc !== false, roughness: rough, metalness: spec.metal || 0 });
      if (spec.color) m.color = new THREE.Color(spec.color);
      if (spec.em) { m.emissiveMap = getTex(spec.em, spec.rep); m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = spec.ei || 1; }
      if (spec.emissive) { m.emissive = new THREE.Color(spec.emissive); m.emissiveIntensity = spec.ei || 1; }
      if (spec.transparent) { m.transparent = true; m.opacity = spec.opacity != null ? spec.opacity : 0.8; m.depthWrite = spec.depthWrite === true; }
      if (spec.alphaTest) m.alphaTest = spec.alphaTest;
      if (spec.double) m.side = THREE.DoubleSide;
      if (spec.flat) m.flatShading = true;
      if (hi && spec.t) {
        const n = spec.n != null ? spec.n : 1;
        if (n > 0) m.normalMap = getNorm(spec.t, spec.rep, n, spec.puddle);
        if (rough < 0.97 || spec.puddle) { m.roughnessMap = getRough(spec.t, spec.rep, rough, spec.rv != null ? spec.rv : 0.6, spec.puddle); m.roughness = 1; }
      }
      if (hi && spec.nmap) m.normalMap = getNorm(spec.nmap, spec.nrep || spec.rep, spec.n || 1);
      if (env && spec.env !== 0) { m.envMap = env; m.envMapIntensity = spec.env != null ? spec.env : rough < 0.5 ? 1.5 : 0.6; }
      if (spec.flow) m.userData.flow = spec.flow;
      return finish(m, spec, key);
    };
    const out = Object.assign({ id }, th);
    const DEF = {
      water: { color: '#2a4a5a', rough: 0.04, metal: 0.1, transparent: true, opacity: 0.88, nmap: 'water', nrep: [0.5, 0.5], n: 1.2, env: 2.2, flow: [0.012, 0.007], emissive: '#03101a' },
      glass: { color: '#1c2a36', rough: 0.05, metal: 0.6, env: 2, emissive: '#040608' },
      leaf: { t: 'leafDense', rough: 0.85, env: 0.3, n: 1.5 },
      leafc: { t: 'leafCard', rough: 0.8, alphaTest: 0.45, env: 0.3, n: 0 },
      bark: { t: 'bark', rough: 0.95, n: 2.2 },
      curb: { t: 'concrete', color: '#c9cbcd', rough: 0.8 },
    };
    out.mat = function (key) {
      if (matCache[key]) return matCache[key];
      let m;
      const c0 = key[0];
      if (th.mats && th.mats[key]) m = make(th.mats[key], key);
      else if (key === 'p') { m = new THREE.MeshStandardMaterial({ map: getTex('noise'), vertexColors: true, roughness: 0.75 }); if (env) { m.envMap = env; m.envMapIntensity = 0.5; } m = finish(m, null, key); }
      else if (key === 'glow') m = finish(new THREE.MeshBasicMaterial({ color: 0xfff2c8, vertexColors: true }), null, key);
      else if (key === 'sky') m = finish(new THREE.MeshBasicMaterial({ map: getTex('skylight') }), null, key);
      else if (key === 'paint') { m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }); if (env) { m.envMap = env; m.envMapIntensity = 0.8; } m = finish(m, null, key); }
      else if (DEF[key]) m = make(DEF[key], key);
      else if (c0 === 'f') m = make(th.tex.floor[+key.slice(1)] || th.tex.floor[0], key);
      else if (c0 === 'w') {
        const zone = parseInt(key.slice(1), 10), io = key[key.length - 1];
        let spec = th.tex.wall[zone] || th.tex.wall[0];
        if (io === 'i' && th.tex.wallIn && spec.facade) spec = th.tex.wallIn;
        m = make(spec, key);
      }
      else if (key === 'ci') m = make(th.tex.ci, key);
      else if (key === 'co') m = make(th.tex.co, key);
      else if (key === 'e') m = make(th.tex.e, key);
      else if (key === 'r') m = make(th.tex.r, key);
      else if (key === 'rs') m = make(th.tex.rs || th.tex.e, key);
      else if (key === 'rr') m = make(th.tex.rr || th.tex.rs || th.tex.e, key);
      else m = make('noise', key);
      m.userData.keep = true;
      return (matCache[key] = m);
    };
    // matériaux des modèles 3D (KayKit) : carrosseries vernies et vitres qui reflètent, mobilier urbain légèrement satiné
    const mm = {};
    out.modelMat = function (mat, name) {
      if (!mat || !mat.isMeshStandardMaterial) return mat;
      const cls = /^city_car/.test(name) ? 'car' : /^city_(streetlight|trafficlight|firehydrant|dumpster|bench|trash)/.test(name) ? 'street' : '';
      if (!cls || !hi) return mat;
      const k = mat.uuid + cls;
      if (mm[k]) return mm[k];
      const m = mat.clone();
      if (cls === 'car') { m.roughness = 0.3; m.metalness = 0.45; if (env) { m.envMap = env; m.envMapIntensity = 1.6; } }
      else { m.roughness = Math.min(m.roughness, 0.6); m.metalness = Math.max(m.metalness, 0.2); if (env) { m.envMap = env; m.envMapIntensity = 0.7; } }
      return (mm[k] = finish(m, { wet: th.outdoor ? 0.6 : 0 }, 'model'));
    };
    out.env = env; out._mats = mats; out.wet = 0;
    cache[ck] = out;
    return out;
  };

  // pluie : rend les matériaux mouillés (k de 0 à 1) — plus sombres, plus lisses, plus de reflets. T = BR.Tex.build(...) ou id de thème.
  T.setWet = function (Tb, k) {
    if (typeof Tb === 'string') Tb = cache[Tb + '|' + qual()];
    if (!Tb || !Tb._mats) return;
    k = Math.max(0, Math.min(1, +k || 0)); Tb.wet = k;
    for (const m of Tb._mats) {
      const b = m.userData.base; if (!b || !b.wet) continue;
      const w = b.wet * k;
      if (m.roughness != null) m.roughness = b.rough * (1 - 0.62 * w);
      if (b.color && m.color) m.color.copy(b.color).multiplyScalar(1 - 0.3 * w);
      if (m.envMap) m.envMapIntensity = b.env * (1 + 2.4 * w);
    }
  };

  /* ---------------- petits visuels ---------------- */
  T.sign = function (text, bg, fg, w, h) {
    w = w || 256; h = h || 96;
    return mk(w, h, g => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = fg; g.font = `bold ${Math.floor(h * 0.42)}px 'Segoe UI', Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); });
  };
  T.shopSign = function (text, hue) {
    return mk(512, 156, g => {
      g.fillStyle = `hsl(${hue},45%,14%)`; g.fillRect(0, 0, 512, 156);
      g.strokeStyle = `hsl(${hue},90%,60%)`; g.lineWidth = 6; g.strokeRect(8, 8, 496, 140);
      g.font = "bold 70px 'Segoe UI', Arial"; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = `hsl(${hue},100%,60%)`; g.shadowBlur = 24; g.fillStyle = `hsl(${hue},100%,78%)`; g.fillText(text, 256, 82);
      if (Math.random() < 0.5) { g.shadowBlur = 0; g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(256 + (Math.random() - 0.5) * 300, 20, 40, 120); }
    });
  };
  T.glow = function (r, g2, b) {
    return mk(128, 128, c => { const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${r},${g2},${b},1)`); gr.addColorStop(0.25, `rgba(${r},${g2},${b},0.55)`); gr.addColorStop(1, `rgba(${r},${g2},${b},0)`); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); });
  };
})();

/* ---------- ciel nocturne (dôme dégradé, étoiles, lune) ---------- */
(function () {
  const BR = window.BR;
  BR.Tex.skyDome = function (T) {
    const g = new THREE.SphereGeometry(150, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x050914) }, mid: { value: new THREE.Color(0x101a33) }, low: { value: new THREE.Color(T.fog) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top, mid, low; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          float y = vP.y;
          vec3 c = mix(low, mid, smoothstep(-0.05, 0.25, y)); c = mix(c, top, smoothstep(0.25, 0.9, y));
          vec3 q = floor(vP * 260.0); float s = step(0.9965, h(q)) * smoothstep(0.08, 0.4, y);
          c += vec3(s) * (0.6 + 0.4 * h(q + 1.0));
          // lune
          vec3 md = normalize(vec3(-0.45, 0.55, -0.7)); float d = dot(vP, md);
          c += vec3(0.95, 0.97, 1.0) * smoothstep(0.9993, 0.9996, d) + vec3(0.25, 0.32, 0.5) * pow(max(d, 0.0), 220.0);
          // halo de la ville à l'horizon
          c += vec3(0.35, 0.22, 0.1) * (1.0 - smoothstep(0.0, 0.18, abs(y))) * 0.35;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const m = new THREE.Mesh(g, mat); m.renderOrder = -10; m.frustumCulled = false;
    m.onBeforeRender = (r, sc, cam) => { m.position.copy(cam.position); };
    return m;
  };
})();

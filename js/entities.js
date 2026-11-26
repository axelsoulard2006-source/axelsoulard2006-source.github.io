/* ===== entities.js : sprites de monstres (tirage sans répétition), rendu glitch, IA (hôte) ===== */
(function () {
  const BR = window.BR;
  const E = (BR.Ent = {});
  const WD = () => BR.World;

  /* =====================================================================
     1. SPRITES
     ===================================================================== */
  E.sprites = [];            // { name, tex, aspect, h, kind }
  let ready = false, bag = [], lastDrawn = -1, jbag = [], jlast = -1;

  /* ---- sprites procéduraux (canvas 256x512, fond transparent) ---- */
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function noiseOver(g, w, h, a) {
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; const n = (Math.random() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
  }
  function smiler() {
    const c = cv(256, 512), g = c.getContext('2d');
    // silhouette sombre et floue
    const gr = g.createRadialGradient(128, 230, 20, 128, 250, 200); gr.addColorStop(0, '#0a0a0c'); gr.addColorStop(1, 'rgba(4,4,6,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(128, 260, 118, 240, 0, 0, 7); g.fill();
    g.fillStyle = '#050507'; g.beginPath(); g.moveTo(40, 512); g.quadraticCurveTo(60, 200, 128, 140); g.quadraticCurveTo(196, 200, 216, 512); g.fill();
    // yeux lumineux
    [-1, 1].forEach(s => {
      const x = 128 + s * 42, y = 190, e = g.createRadialGradient(x, y, 1, x, y, 30); e.addColorStop(0, '#ffffff'); e.addColorStop(0.35, '#fff4c8'); e.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = e; g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, 13, 18, s * 0.25, 0, 7); g.fill();
    });
    // sourire immense
    g.fillStyle = '#fff'; g.strokeStyle = '#e8e8e8'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(34, 262); g.quadraticCurveTo(128, 400, 222, 262); g.quadraticCurveTo(128, 330, 34, 262); g.fill();
    g.fillStyle = '#050507';
    for (let i = 0; i < 14; i++) { const t = (i + 0.5) / 14, x = 34 + t * 188, y = 262 + Math.sin(t * Math.PI) * 80 * 0.62; g.fillRect(x - 1.2, y - 6, 2.4, 22); }
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.moveTo(34, 262); g.quadraticCurveTo(128, 360, 222, 262); g.lineTo(222, 258); g.quadraticCurveTo(128, 345, 34, 258); g.fill();
    noiseOver(g, 256, 512, 26);
    return c;
  }
  function stalker() {
    const c = cv(256, 512), g = c.getContext('2d');
    const skin = g.createLinearGradient(0, 0, 0, 512); skin.addColorStop(0, '#cfc9be'); skin.addColorStop(1, '#8c8578');
    g.fillStyle = skin; g.strokeStyle = '#6d675c'; g.lineWidth = 2;
    // tronc fin
    g.beginPath(); g.moveTo(104, 140); g.lineTo(152, 140); g.lineTo(160, 330); g.lineTo(150, 420); g.lineTo(158, 512); g.lineTo(134, 512); g.lineTo(128, 440); g.lineTo(122, 512); g.lineTo(98, 512); g.lineTo(106, 420); g.lineTo(96, 330); g.closePath(); g.fill(); g.stroke();
    // bras interminables
    [-1, 1].forEach(s => { g.beginPath(); g.moveTo(128 + s * 26, 160); g.quadraticCurveTo(128 + s * 100, 300, 128 + s * 86, 470); g.lineTo(128 + s * 76, 470); g.quadraticCurveTo(128 + s * 84, 300, 128 + s * 20, 175); g.fill(); g.stroke();
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(128 + s * (82 + i * 3), 468); g.lineTo(128 + s * (96 + i * 6), 508); g.lineWidth = 3; g.stroke(); } g.lineWidth = 2; });
    // tête allongée sans visage
    g.beginPath(); g.ellipse(128, 86, 34, 78, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#1b1a18'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(128 + s * 14, 74, 6, 11, 0, 0, 7); g.fill(); });
    g.beginPath(); g.ellipse(128, 128, 4, 12, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(40,30,25,0.25)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(80 + Math.random() * 96, 150 + Math.random() * 300); g.lineTo(80 + Math.random() * 96, 150 + Math.random() * 300); g.stroke(); }
    noiseOver(g, 256, 512, 30);
    return c;
  }
  function wretch() {
    const c = cv(256, 512), g = c.getContext('2d');
    const skin = g.createLinearGradient(0, 100, 0, 512); skin.addColorStop(0, '#b9a79a'); skin.addColorStop(1, '#5e5048');
    g.fillStyle = skin; g.strokeStyle = '#3b2f29'; g.lineWidth = 2;
    // corps voûté
    g.beginPath(); g.moveTo(70, 512); g.quadraticCurveTo(34, 330, 78, 210); g.quadraticCurveTo(128, 150, 190, 205); g.quadraticCurveTo(232, 330, 196, 512); g.closePath(); g.fill(); g.stroke();
    // bras pendants
    [-1, 1].forEach(s => { g.beginPath(); g.moveTo(128 + s * 78, 240); g.quadraticCurveTo(128 + s * 120, 380, 128 + s * 104, 500); g.lineTo(128 + s * 84, 500); g.quadraticCurveTo(128 + s * 92, 380, 128 + s * 62, 270); g.fill(); g.stroke(); });
    // tête tombante
    g.beginPath(); g.ellipse(128, 160, 52, 58, 0, 0, 7); g.fill(); g.stroke();
    // yeux creux
    g.fillStyle = '#050505'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(128 + s * 22, 150, 14, 20, s * 0.2, 0, 7); g.fill(); });
    g.fillStyle = '#ff3b3b'; [-1, 1].forEach(s => { g.beginPath(); g.arc(128 + s * 22, 152, 3, 0, 7); g.fill(); });
    // bouche béante qui coule
    g.fillStyle = '#150404'; g.beginPath(); g.ellipse(128, 196, 22, 34, 0, 0, 7); g.fill();
    g.fillStyle = '#d9d2c6'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(112 + i * 6.4, 170); g.lineTo(115 + i * 6.4, 182); g.lineTo(118 + i * 6.4, 170); g.fill(); }
    g.strokeStyle = 'rgba(120,0,0,0.7)'; g.lineWidth = 4; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(112 + i * 10, 220); g.lineTo(112 + i * 10 + (Math.random() - 0.5) * 6, 260 + Math.random() * 60); g.stroke(); }
    noiseOver(g, 256, 512, 34);
    return c;
  }
  const PROC = [['Sourire', smiler, 2.5], ['Le Grand', stalker, 3.1], ['Le Misérable', wretch, 2.2]];

  function toTex(canvasOrImg) {
    const t = new THREE.Texture(canvasOrImg); t.needsUpdate = true;
    t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
    return t;
  }
  /** Détourage automatique des images opaques (photos, captures) :
      1) si le bord est d'une couleur à peu près uniforme, on la rend transparente par remplissage depuis les bords ;
      2) sinon, fondu sur les bords pour éviter l'effet « rectangle collé dans le couloir ». */
  function cutout(c) {
    const w = c.width, h = c.height, g = c.getContext('2d'), id = g.getImageData(0, 0, w, h), d = id.data;
    // déjà transparent ? (on regarde le bord)
    let transp = 0, tot = 0;
    const edge = [];
    for (let x = 0; x < w; x += 2) edge.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y += 2) edge.push(y * w, y * w + w - 1);
    for (const i of edge) { tot++; if (d[i * 4 + 3] < 128) transp++; }
    if (transp / tot > 0.5) return;
    // couleur dominante du bord
    let r = 0, gg = 0, b = 0;
    for (const i of edge) { r += d[i * 4]; gg += d[i * 4 + 1]; b += d[i * 4 + 2]; }
    r /= tot; gg /= tot; b /= tot;
    const near = (i, tol) => { const dr = d[i * 4] - r, dg = d[i * 4 + 1] - gg, db = d[i * 4 + 2] - b; return dr * dr + dg * dg + db * db < tol * tol; };
    let uni = 0; for (const i of edge) if (near(i, 40)) uni++;
    if (uni / tot > 0.8) {
      const seen = new Uint8Array(w * h), q = new Int32Array(w * h); let qh = 0, qt = 0;
      for (const i of edge) if (!seen[i] && near(i, 48)) { seen[i] = 1; q[qt++] = i; }
      while (qh < qt) {
        const i = q[qh++], x = i % w;
        d[i * 4 + 3] = 0;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
        for (const j of nb) if (j >= 0 && j < w * h && !seen[j]) { seen[j] = 1; if (near(j, 48)) q[qt++] = j; }
      }
      // adoucit le contour détouré
      for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] && ((i % w > 0 && !d[(i - 1) * 4 + 3]) || (i % w < w - 1 && !d[(i + 1) * 4 + 3]) || (i >= w && !d[(i - w) * 4 + 3]) || (i < w * h - w && !d[(i + w) * 4 + 3]))) d[i * 4 + 3] = 140;
    } else {
      const fx = w * 0.12, fy = h * 0.08;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = Math.min(1, x / fx, (w - 1 - x) / fx, y / fy, (h - 1 - y) / (fy * 0.4));
        if (k < 1) d[(y * w + x) * 4 + 3] *= k * k * (3 - 2 * k);
      }
    }
    g.putImageData(id, 0, 0);
  }

  /** Recadre l'image sur sa partie visible (les entités touchent ainsi le sol au lieu de flotter) */
  function cropAlpha(c) {
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return c;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    if (cw > w * 0.97 && ch > h * 0.97) return c;
    const o = cv(cw, ch); o.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
    return o;
  }

  /** Charge les images utilisateur + les sprites procéduraux. Retourne une Promise. */
  E.init = function () {
    if (ready) return Promise.resolve(E.sprites.length);
    const imgs = (window.MONSTER_IMAGES || []).filter(o => o && o.d);
    // les images sont ajoutées dans l'ordre du fichier (et non dans l'ordre de chargement) :
    // l'indice d'un sprite envoyé par l'hôte désigne ainsi la même image chez tous les joueurs
    return Promise.all(imgs.map(o => new Promise(res => {
      const im = new Image();
      im.onload = () => {
        // recadre / limite la taille pour rester léger
        const max = 768, k = Math.min(1, max / Math.max(im.width, im.height));
        const c = cv(Math.max(2, Math.round(im.width * k)), Math.max(2, Math.round(im.height * k))); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        try { cutout(c); } catch (_) {}
        let cc = c;
        try { cc = cropAlpha(c); } catch (_) {}
        const c2 = cc, aspect = c2.width / c2.height;
        // grande image plate façon « nextbot » : ~2,6 m de haut, 2,6 m de large au maximum
        res({ name: o.n || 'monstre', tex: toTex(c2), aspect, h: Math.max(1.8, Math.min(2.9, 2.6 / aspect)), kind: 'img', canvas: c2, face: E.parseFace(o.f), sound: o.s || null, key: (o.n || '') + ':' + c2.width + 'x' + c2.height });
      };
      im.onerror = () => res(null);
      im.src = o.d;
    }))).then(list => {
      list.forEach(s => { if (s) E.sprites.push(s); });
      // les entités procédurales ne servent que s'il n'y a aucune image de monstre
      if (!E.sprites.length) PROC.forEach(([name, fn, h]) => { const c = fn(); E.sprites.push({ name, tex: toTex(c), aspect: c.width / c.height, h, kind: 'proc', canvas: c }); });
      ready = true; return E.sprites.length;
    });
  };
  E.count = () => E.sprites.length;

  /** tirage "sac mélangé" : tous les sprites passent avant la moindre répétition, jamais deux fois de suite */
  // le sac est mémorisé d'une partie à l'autre (et d'une session à l'autre) : une image ne revient
  // qu'une fois que TOUTES les autres sont apparues ; on évite aussi les images déjà en jeu
  function drawFrom(bagArr, lastRef, n, exclude, saveKey) {
    if (n <= 0) return -1;
    if (saveKey && !bagArr.length && !bagArr._loaded) {
      bagArr._loaded = true;
      try { const s = BR.store.get(saveKey, null); if (s && s.n === n && Array.isArray(s.b)) s.b.forEach(v => { if (v >= 0 && v < n) bagArr.push(v); }); } catch (e) {}
    }
    if (!bagArr.length) {
      for (let i = 0; i < n; i++) bagArr.push(i);
      BR.shuffle(bagArr);
      if (n > 1 && bagArr[bagArr.length - 1] === lastRef.v) { const j = BR.randInt(0, n - 2); const t = bagArr[j]; bagArr[j] = bagArr[bagArr.length - 1]; bagArr[bagArr.length - 1] = t; }
    }
    let k = bagArr.length - 1;
    if (exclude && exclude.length) { for (let j = bagArr.length - 1; j >= 0; j--) if (!exclude.includes(bagArr[j])) { k = j; break; } }
    const v = bagArr.splice(k, 1)[0]; lastRef.v = v;
    if (saveKey) try { BR.store.set(saveKey, { n, b: bagArr.slice() }); } catch (e) {}
    return v;
  }
  const _lm = { get v() { return lastDrawn; }, set v(x) { lastDrawn = x; } }, _lj = { get v() { return jlast; }, set v(x) { jlast = x; } };
  E.draw = exclude => drawFrom(bag, _lm, E.sprites.length, exclude, 'br_bag');
  E.drawJump = () => drawFrom(jbag, _lj, E.sprites.length);
  E.sprite = i => E.sprites.length ? E.sprites[((i % E.sprites.length) + E.sprites.length) % E.sprites.length] : null;
  /** image plein écran pour le jumpscare (canvas) */
  E.jumpCanvas = i => { const s = E.sprite(i); return s ? s.canvas : null; };

  /* ---- données de visage (yeux, bouche) : [lx, ly, rx, ry, mx, my, largeur] en coordonnées image normalisées ---- */
  E.parseFace = function (f) {
    if (!f || f.length < 7) return null;
    return { l: [f[0], f[1]], r: [f[2], f[3]], m: [f[4], f[5]], w: f[6] };
  };
  E.setFace = function (i, f) { const s = E.sprites[i]; if (s) { s.face = f; s.scary = null; } };
})();

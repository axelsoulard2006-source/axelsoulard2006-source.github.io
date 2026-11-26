/* ===== maps/cimetiere.js : CIMETIÈRE — vieux cimetière de village, la nuit, dans la brume (carte à ciel ouvert)
   Le cimetière est à flanc de colline, sur deux terrasses reliées par un grand escalier et deux escaliers latéraux :
   - terrasse basse (niveau 0) : grand portail enchaîné (la sortie est la petite porte à côté), maison du gardien,
     tombes récentes en granit, carré militaire, point d'eau, fosses fraîchement creusées ;
   - terrasse haute (niveau 1) : chapelle gothique (vitraux sombres, charpente, clocheton), vieilles tombes penchées
     ou brisées, croix de fer, anges qui pleurent, mausolées où l'on entre, chapelle funéraire avec escalier ;
   - sous la terrasse haute (niveau 0) : la CRYPTE — caveau central sous la chapelle (on s'y réveille), galeries
     d'enfeus, ossuaire, salle des sarcophages, caveau de famille ; reliée à la chapelle et à la chapelle funéraire par
     des escaliers, et à la terrasse basse par une porte dans le mur de soutènement.
   Mur d'enceinte, mausolées, fosses : murs « logiques » (m.noWall) dessinés par le décor. Lanternes et bougies
   vacillantes, corbeaux, nappes de brume au ras du sol. Aucun gore. Dépend de BR.CarteKit (maps/halle6.js).  ===== */
(function () {
  const BR = window.BR, K = BR.CarteKit, TX = BR.Tex, mk = K.mk;
  const C = 2, SH = 4, VOID = 0, FLOOR = 1, WALL = 2, RAMP = 3;
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const rnd = a => (Math.random() - 0.5) * 2 * a;
  const lowQ = () => !!(BR.settings && BR.settings.quality === 'low');

  /* =====================================================================
     TEXTURES (128 px = 1 m ; murs : 512 px = 4 m × 1 étage)
     ===================================================================== */
  // hauteurs de rangées dont la somme fait exactement h (raccord vertical)
  function rowsFit(h, avg, v) { const r = []; let s = 0; while (s < h - avg * 0.6) { const x = avg + rnd(v); r.push(x); s += x; } const k = h / s; return r.map(x => x * k); }
  function block(g, x, y, bw, rh, o) {
    const j = o.j || 3;
    g.fillStyle = K.vary(o.base || '#77716a', o.va || 0.2);
    g.beginPath(); g.moveTo(x + j + rnd(1.5), y + j + rnd(1.5)); g.lineTo(x + bw - j + rnd(1.5), y + j + rnd(1.5)); g.lineTo(x + bw - j + rnd(1.5), y + rh - j + rnd(1.5)); g.lineTo(x + j + rnd(1.5), y + rh - j + rnd(1.5)); g.closePath(); g.fill();
    const gr = g.createLinearGradient(0, y, 0, y + rh); gr.addColorStop(0, 'rgba(255,248,230,0.1)'); gr.addColorStop(0.3, 'rgba(255,248,230,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = gr; g.fillRect(x + j, y + j, bw - 2 * j, rh - 2 * j);
    if (Math.random() < (o.pits == null ? 0.5 : o.pits)) for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + j + Math.random() * (bw - 2 * j), y + j + Math.random() * (rh - 2 * j), 0.8 + Math.random() * 1.6, 0, 7); g.fill(); }
  }
  // appareil de pierres raccordable : rangées, blocs de longueur variable, joints creux
  function ashlar(g, w, h, o) {
    g.fillStyle = o.mortar || '#3a3630'; g.fillRect(0, 0, w, h);
    let y = 0;
    for (const rh of rowsFit(h, o.rh || 48, o.rv || 10)) {
      const n = Math.max(2, Math.round(w / ((o.bw || 100) + rnd(o.bv || 30)))), L = []; let s = 0;
      for (let k = 0; k < n; k++) { const l = 0.6 + Math.random() * 0.8; L.push(l); s += l; }
      let x = Math.random() * w;
      for (const l of L) { const bw = l / s * w; for (const ox of [0, -w]) block(g, x + ox, y, bw, rh, o); x += bw; }
      y += rh;
    }
  }
  function moss(g, w, h, amt) { K.blot(g, w, h, Math.round(12 * amt), '52,70,34', 0.12, 0.32, 6, 34); K.blot(g, w, h, Math.round(6 * amt), '78,92,46', 0.1, 0.22, 4, 18); }
  function lichen(g, w, h, n) { for (let k = 0; k < n; k++) { const x = Math.random() * w, y = Math.random() * h, r = 1.5 + Math.random() * 5; g.fillStyle = Math.random() < 0.6 ? 'rgba(178,176,120,0.42)' : 'rgba(150,160,140,0.38)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(210,205,150,0.3)'; g.lineWidth = 0.8; g.stroke(); } }
  function streaksDown(g, w, y0, len, n, a) { for (let k = 0; k < n; k++) { const x = Math.random() * w, l = len * (0.3 + Math.random() * 0.7), gr = g.createLinearGradient(0, y0, 0, y0 + l); gr.addColorStop(0, `rgba(20,18,14,${a})`); gr.addColorStop(1, 'rgba(20,18,14,0)'); g.fillStyle = gr; g.fillRect(x, y0, 1.5 + Math.random() * 4, l); } }
  function leafIvy(g, x, y, s) {
    g.fillStyle = BR.pick(['#1f3418', '#2a4420', '#18291a', '#34502a']);
    g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.5, y - s * 0.3); g.lineTo(x + s, y - s * 0.2); g.lineTo(x + s * 0.5, y + s * 0.4); g.lineTo(x, y + s * 0.8); g.lineTo(x - s * 0.5, y + s * 0.4); g.lineTo(x - s, y - s * 0.2); g.lineTo(x - s * 0.5, y - s * 0.3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,150,90,0.3)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y + s * 0.7); g.lineTo(x, y - s * 0.6); g.stroke();
  }
  // lierre qui retombe du haut du mur
  function ivy(g, w, n, ymax) {
    for (let k = 0; k < n; k++) {
      let x = Math.random() * w, y = -5; const len = ymax * (0.4 + Math.random() * 0.6), pts = [];
      g.strokeStyle = 'rgba(40,34,22,0.8)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y);
      while (y < len) { x += rnd(6); y += 5 + Math.random() * 6; g.lineTo(x, y); pts.push([x, y]); }
      g.stroke();
      for (const [px, py] of pts) if (Math.random() < 0.8) for (let l = 0; l < 2; l++) leafIvy(g, px + rnd(9), py + rnd(6), 4 + Math.random() * 4);
    }
  }
  function skull2D(g, x, y, s, a) {
    g.save(); g.globalAlpha = a == null ? 1 : a;
    const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.4, s * 0.1, x, y, s * 1.1); gr.addColorStop(0, '#e2d7bb'); gr.addColorStop(1, '#857858');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - s * 0.15, s, s * 0.9, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(x, y + s * 0.5, s * 0.6, s * 0.42, 0, 0, 7); g.fill();
    g.fillStyle = '#1a140e';
    g.beginPath(); g.ellipse(x - s * 0.38, y + s * 0.02, s * 0.26, s * 0.3, 0.2, 0, 7); g.fill();
    g.beginPath(); g.ellipse(x + s * 0.38, y + s * 0.02, s * 0.26, s * 0.3, -0.2, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x, y + s * 0.28); g.lineTo(x - s * 0.1, y + s * 0.48); g.lineTo(x + s * 0.1, y + s * 0.48); g.fill();
    g.fillStyle = 'rgba(30,22,14,0.7)'; for (let k = -3; k <= 3; k++) g.fillRect(x + k * s * 0.12 - 0.5, y + s * 0.6, 1, s * 0.18);
    g.restore();
  }
  function boneEnd(g, x, y, r) {
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, '#ded2b2'); gr.addColorStop(1, '#76694f');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x - r * 0.35, y, r * 0.7, r * 0.8, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + r * 0.35, y, r * 0.7, r * 0.8, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(40,30,20,0.35)'; g.beginPath(); g.arc(x, y + r * 0.1, r * 0.18, 0, 7); g.fill();
  }
  function engrave(g, text, x, y, size, col, weight) {
    g.font = `${weight || 600} ${size}px Georgia, 'Times New Roman', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,250,235,0.2)'; g.fillText(text, x, y + 1.3); g.fillStyle = col; g.fillText(text, x, y);
  }
  // taches locales (dans un rectangle, sans raccord)
  function blotIn(g, x0, y0, w, h, n, col, amin, amax, rmin, rmax) {
    for (let k = 0; k < n; k++) { const x = x0 + Math.random() * w, y = y0 + Math.random() * h, r = rmin + Math.random() * (rmax - rmin), a = amin + Math.random() * (amax - amin), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  }
  function stoneFill(g, x0, y0, w, h, base) {
    g.fillStyle = base; g.fillRect(x0, y0, w, h);
    blotIn(g, x0, y0, w, h, 14, '40,36,30', 0.08, 0.2, 10, 50); blotIn(g, x0, y0, w, h, 8, '200,195,180', 0.05, 0.12, 10, 40);
    blotIn(g, x0, y0 + h * 0.6, w, h * 0.4, 8, '50,68,32', 0.15, 0.35, 6, 26);            // mousse en bas
    for (let k = 0; k < 40; k++) { g.fillStyle = Math.random() < 0.6 ? 'rgba(178,176,120,0.4)' : 'rgba(150,160,140,0.35)'; g.beginPath(); g.arc(x0 + Math.random() * w, y0 + Math.random() * h, 1 + Math.random() * 4, 0, 7); g.fill(); }
    for (let k = 0; k < 500; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.08)'; g.fillRect(x0 + Math.random() * w, y0 + Math.random() * h, 1.5, 1.5); }
  }
  function granFill(g, x0, y0, w, h) {
    g.fillStyle = '#1c1c1f'; g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 2600; k++) { g.fillStyle = BR.pick(['rgba(255,255,255,0.18)', 'rgba(150,150,160,0.25)', 'rgba(0,0,0,0.4)', 'rgba(110,100,90,0.25)']); g.fillRect(x0 + Math.random() * w, y0 + Math.random() * h, 1 + Math.random(), 1 + Math.random()); }
    const gr = g.createLinearGradient(x0, y0, x0 + w, y0 + h); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x0, y0, w, h);
  }
  const NOMS = ['MARTIN', 'BERNARD', 'DUBOIS', 'THOMAS', 'ROBERT', 'RICHARD', 'PETIT', 'DURAND', 'LEROY', 'MOREAU', 'SIMON', 'LAURENT', 'LEFEBVRE', 'MICHEL', 'BERTRAND', 'ROUX', 'VINCENT', 'FOURNIER', 'MOREL', 'GIRARD', 'MERCIER', 'DUPONT', 'LAMBERT', 'BONNET', 'LEGRAND', 'GAUTHIER', 'PERRIN', 'ROUSSEL', 'MARCHAND', 'FAUCHER'];
  const PRENOMS = ['Jean', 'Marie', 'Louis', 'Joseph', 'Marguerite', 'Henri', 'Jeanne', 'Pierre', 'Germaine', 'Eugène', 'Augustine', 'Émile', 'Léonie', 'Camille', 'Victor', 'Alphonse', 'Lucien', 'Berthe', 'Albert', 'Suzanne', 'Gaston', 'Madeleine', 'Octave', 'Hortense'];
  const EPI = ['ICI REPOSE', 'À LA MÉMOIRE DE', 'REGRETS ÉTERNELS', 'IN MEMORIAM', 'PRIEZ POUR NOUS', 'ICI REPOSENT'];
  const ODD = ['IL N\'EST PAS PARTI', 'ELLE NOUS ATTEND', 'NE LE RÉVEILLEZ PAS', 'IL VOUS VOIT', 'ELLE REVIENDRA'];
  // épitaphes : atlas 4×4 tuiles (1 tuile = 1 m × 1 m de pierre) ; 0-7 calcaire gravé, 8-15 granit noir lettres dorées
  let atlasC = null;
  function atlas() {
    if (atlasC) return atlasC;
    return (atlasC = mk(1024, 1024, g => {
      for (let k = 0; k < 16; k++) {
        const x0 = (k % 4) * 256, y0 = Math.floor(k / 4) * 256, gran = k >= 8, cx = x0 + 128, Y = v => y0 + 256 - v * 256;
        g.save(); g.beginPath(); g.rect(x0, y0, 256, 256); g.clip();
        if (gran) granFill(g, x0, y0, 256, 256); else stoneFill(g, x0, y0, 256, 256, K.vary('#a29d91', 0.1));
        const ink = gran ? '#c7a24c' : 'rgba(30,27,23,0.88)';
        // croix gravée
        g.fillStyle = ink; g.fillRect(cx - 3, Y(0.9), 6, 30); g.fillRect(cx - 11, Y(0.86), 22, 6);
        const odd = !gran && (k === 3 || k === 6);
        engrave(g, odd ? 'ICI REPOSE' : BR.pick(EPI), cx, Y(0.74), 15, ink, 500);
        const nom = BR.pick(NOMS);
        engrave(g, nom, cx, Y(0.635), nom.length > 8 ? 25 : 29, ink, 700);
        engrave(g, BR.pick(PRENOMS) + (Math.random() < 0.4 ? ' ' + BR.pick(PRENOMS) : ''), cx, Y(0.55), 19, ink, 500);
        const a = 1820 + Math.floor(Math.random() * 120), d = a + 3 + Math.floor(Math.random() * 80);
        engrave(g, a + ' — ' + d, cx, Y(0.475), 17, ink, 500);
        if (odd) engrave(g, BR.pick(ODD), cx, Y(0.39), 13, ink, 600);
        else if (Math.random() < 0.6) { g.fillStyle = ink; for (let l = 0; l < 2; l++) { const lw = 50 + Math.random() * 60; g.fillRect(cx - lw / 2, Y(0.4 - l * 0.05), lw, 2); } }
        if (!gran) {
          // usure : lettres effacées par endroits, fissure, mousse au pied
          blotIn(g, x0, y0 + 60, 256, 120, 5, '160,155,140', 0.25, 0.45, 8, 22);
          if (Math.random() < 0.45) { g.strokeStyle = 'rgba(25,22,18,0.75)'; g.lineWidth = 1.4; g.beginPath(); let x = x0 + 40 + Math.random() * 170, y = y0 + 20; g.moveTo(x, y); for (let s = 0; s < 9; s++) { x += rnd(14); y += 10 + Math.random() * 14; g.lineTo(x, y); } g.stroke(); }
          blotIn(g, x0, y0 + 190, 256, 66, 10, '46,64,30', 0.25, 0.5, 6, 30);
        } else {
          // médaillon (photo émaillée effacée)
          if (Math.random() < 0.4) { g.fillStyle = '#d7cfbf'; g.beginPath(); g.ellipse(cx, Y(0.22), 18, 23, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(80,70,60,0.5)'; g.beginPath(); g.ellipse(cx, Y(0.23), 10, 13, 0, 0, 7); g.fill(); g.strokeStyle = '#a88a3e'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, Y(0.22), 18, 23, 0, 0, 7); g.stroke(); }
        }
        g.restore();
      }
      K.grain(g, 1024, 1024, 4);
    }));
  }
  // mur de la chapelle : pierre de taille + lancette gothique à vitrail sombre (couleur + émission)
  let chapC = null;
  function chapelle() {
    if (chapC) return chapC;
    const col = mk(512, 512, () => {}), em = mk(512, 512, () => {}), g = col.getContext('2d'), e = em.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, 512, 512);
    ashlar(g, 512, 512, { base: '#726c62', mortar: '#34302a', rh: 40, rv: 6, bw: 110, bv: 30, va: 0.14 });
    moss(g, 512, 512, 0.8); lichen(g, 512, 512, 60);
    // lancette : de y = 5,1 m à 7,6 m au-dessus du sol de la chapelle (étage 1 : la tuile couvre 4 à 8 m)
    const cxw = 256, hw = 54, yb = (8 - 5.1) * 128, ys = (8 - 7.0) * 128, yt = (8 - 7.65) * 128;
    const arch = (G, pad) => { G.beginPath(); G.moveTo(cxw - hw - pad, yb + pad); G.lineTo(cxw - hw - pad, ys); G.quadraticCurveTo(cxw - hw - pad, yt - pad * 0.6, cxw, yt - pad); G.quadraticCurveTo(cxw + hw + pad, yt - pad * 0.6, cxw + hw + pad, ys); G.lineTo(cxw + hw + pad, yb + pad); G.closePath(); };
    g.fillStyle = '#9b958a'; arch(g, 12); g.fill(); g.fillStyle = 'rgba(0,0,0,0.35)'; arch(g, 5); g.fill();
    // vitrail : losanges de verre teinté, plomb
    g.save(); arch(g, 0); g.clip(); e.save(); arch(e, 0); e.clip();
    const glass = ['#4a0d16', '#13245a', '#5c3d0e', '#16351f', '#331245', '#55101a', '#0f2f4f'];
    for (let y = yt - 10; y < yb + 10; y += 16) for (let x = cxw - hw - 10; x < cxw + hw + 10; x += 16) {
      const c = BR.pick(glass);
      for (const G of [g, e]) { G.fillStyle = c; G.beginPath(); G.moveTo(x, y - 9); G.lineTo(x + 9, y); G.lineTo(x, y + 9); G.lineTo(x - 9, y); G.closePath(); G.fill(); }
    }
    g.strokeStyle = '#0b0a0a'; g.lineWidth = 2; for (let y = yt - 10; y < yb + 10; y += 16) for (let x = cxw - hw - 10; x < cxw + hw + 10; x += 16) { g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 9, y); g.lineTo(x, y + 9); g.lineTo(x - 9, y); g.closePath(); g.stroke(); }
    // silhouette centrale (personnage nimbé) très sombre
    g.fillStyle = 'rgba(10,8,8,0.55)'; g.beginPath(); g.ellipse(cxw, yt + 70, 12, 14, 0, 0, 7); g.fill(); g.fillRect(cxw - 16, yt + 84, 32, 120);
    e.fillStyle = 'rgba(0,0,0,0.6)'; e.fillRect(cxw - 16, yt + 84, 32, 120);
    g.restore(); e.restore();
    // meneau et remplage
    g.fillStyle = '#8f897d'; g.fillRect(cxw - 4, ys - 10, 8, yb - ys + 10); e.fillStyle = '#000'; e.fillRect(cxw - 4, ys - 10, 8, yb - ys + 10);
    g.strokeStyle = '#8f897d'; g.lineWidth = 7; g.beginPath(); g.arc(cxw, ys - 22, 22, 0, 7); g.stroke(); e.strokeStyle = '#000'; e.lineWidth = 7; e.beginPath(); e.arc(cxw, ys - 22, 22, 0, 7); e.stroke();
    // appui, coulures sous l'appui, lierre
    g.fillStyle = '#a39d91'; g.fillRect(cxw - hw - 18, yb + 10, hw * 2 + 36, 12); streaksDown(g, 512, yb + 22, 140, 10, 0.25);
    ivy(g, 512, 4, 140);
    K.grain(g, 512, 512, 5);
    return (chapC = { col, em });
  }
  // rosace de la façade (disque de verre teinté)
  let roseC = null;
  function rosace() {
    if (roseC) return roseC;
    return (roseC = mk(256, 256, g => {
      g.fillStyle = '#060506'; g.fillRect(0, 0, 256, 256);
      const cx = 128, cy = 128, glass = ['#5a0f1c', '#142c66', '#6a4a10', '#1b3f25', '#3a1550'];
      for (let ring = 0; ring < 4; ring++) {
        const r0 = 16 + ring * 28, r1 = r0 + 28, n = 8 * (ring + 1);
        for (let k = 0; k < n; k++) { const a0 = k / n * 6.283, a1 = (k + 1) / n * 6.283; g.fillStyle = BR.pick(glass); g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath(); g.fill(); }
      }
      g.fillStyle = '#7a1218'; g.beginPath(); g.arc(cx, cy, 16, 0, 7); g.fill();
      g.strokeStyle = '#0a0909'; g.lineWidth = 3; for (let ring = 0; ring <= 4; ring++) { g.beginPath(); g.arc(cx, cy, 16 + ring * 28, 0, 7); g.stroke(); }
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; g.beginPath(); g.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16); g.lineTo(cx + Math.cos(a) * 128, cy + Math.sin(a) * 128); g.stroke(); }
      g.strokeStyle = '#8a8478'; g.lineWidth = 6; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; g.beginPath(); g.moveTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44); g.lineTo(cx + Math.cos(a) * 128, cy + Math.sin(a) * 128); g.stroke(); }
    }));
  }
  let mistC = null;
  function mistCanvas() {
    if (mistC) return mistC;
    return (mistC = mk(256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      K.blot(g, w, h, 90, '255,255,255', 0.12, 0.3, 20, 70);
      K.blot(g, w, h, 40, '255,255,255', 0.1, 0.25, 40, 110);
    }));
  }

  Object.assign(TX.MAKE, {
    // ---- sols ----
    cmGravier: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#46433e'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 2800; k++) { const x = Math.random() * w, y = Math.random() * h, r = 0.9 + Math.random() * 2.4; g.fillStyle = K.vary(BR.pick(['#5f5b55', '#55514b', '#6b665e', '#4a4640']), 0.35); g.beginPath(); g.ellipse(x, y, r, r * 0.8, Math.random() * 3, 0, 7); g.fill(); if (r > 2) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - r * 0.6, y + r * 0.5, r * 1.2, 1); } }
      K.blot(g, w, h, 8, '30,28,22', 0.08, 0.18, 15, 50); K.blot(g, w, h, 5, '50,62,32', 0.08, 0.16, 10, 40);
      for (let k = 0; k < 14; k++) { g.fillStyle = BR.pick(['rgba(92,62,32,0.75)', 'rgba(70,50,28,0.75)', 'rgba(110,80,40,0.6)']); g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 4, 2, Math.random() * 3, 0, 7); g.fill(); }
      K.grain(g, w, h, 6);
    }),
    cmHerbe: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#2b2f20'; g.fillRect(0, 0, w, h);
      K.blot(g, w, h, 26, '62,50,34', 0.12, 0.3, 20, 80); K.blot(g, w, h, 18, '44,60,28', 0.12, 0.25, 20, 70);
      for (let k = 0; k < 5200; k++) { const x = Math.random() * w, y = Math.random() * h, l = 3 + Math.random() * 7; g.strokeStyle = ['rgba(118,108,70,0.5)', 'rgba(66,76,42,0.55)', 'rgba(38,44,26,0.6)', 'rgba(146,136,92,0.32)'][k % 4]; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(3), y - l); g.stroke(); }
      for (let k = 0; k < 110; k++) { g.fillStyle = BR.pick(['rgba(96,58,28,0.8)', 'rgba(70,44,24,0.8)', 'rgba(120,84,40,0.65)', 'rgba(60,40,20,0.85)']); g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 2, 1.6, Math.random() * 3, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(40,30,20,0.7)'; g.lineWidth = 1.2; for (let k = 0; k < 30; k++) { const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); }
      K.grain(g, w, h, 6);
    }),
    cmTerre: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#3a2a1d'; g.fillRect(0, 0, w, h);
      K.blot(g, w, h, 20, '22,15,10', 0.15, 0.3, 10, 40); K.blot(g, w, h, 14, '92,70,48', 0.1, 0.2, 8, 30);
      for (let k = 0; k < 220; k++) { const s = 2 + Math.random() * 6; g.fillStyle = K.vary(BR.pick(['#4c3826', '#2e2016', '#5a4430']), 0.25); g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, s, s * 0.7, Math.random() * 3, 0, 7); g.fill(); }
      for (let k = 0; k < 30; k++) { g.fillStyle = K.vary('#8a8378', 0.2); g.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
      K.grain(g, w, h, 8);
    }),
    cmDalles: () => mk(256, 256, (g, w, h) => {
      TX.P.pavers(g, w, h, 64, 64, '#6b675f', '#26241f', 0.2, 0.5, 3);
      g.strokeStyle = 'rgba(52,72,34,0.6)'; g.lineWidth = 2.5; for (let k = 0; k < 18; k++) { const y = Math.floor(Math.random() * 4) * 64, x = Math.random() * w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + Math.random() * 30, y); g.stroke(); }
      K.blot(g, w, h, 8, '20,20,16', 0.08, 0.16, 15, 50); lichen(g, w, h, 30); K.grain(g, w, h, 6);
    }),
    cmPavement: () => mk(512, 512, (g, w, h) => {
      TX.P.pavers(g, w, h, 128, 128, '#7a756b', '#2d2a25', 0.12, 0.5, 3);
      const tomb = (x, y, ww, hh) => {
        g.fillStyle = '#6f6a60'; g.fillRect(x + 3, y + 3, ww - 6, hh - 6); g.strokeStyle = 'rgba(25,22,18,0.75)'; g.lineWidth = 2; g.strokeRect(x + 14, y + 14, ww - 28, hh - 28);
        g.fillStyle = 'rgba(25,22,18,0.75)'; g.fillRect(x + ww / 2 - 3, y + 34, 6, 60); g.fillRect(x + ww / 2 - 18, y + 52, 36, 6);
        for (let l = 0; l < 6; l++) { const lw = 40 + Math.random() * 40; g.fillRect(x + (ww - lw) / 2, y + 116 + l * 18, lw, 3); }
        blotIn(g, x, y, ww, hh, 6, '200,190,170', 0.08, 0.16, 15, 40);
      };
      tomb(64, 0, 128, 256); tomb(320, 256, 128, 256);
      K.blot(g, w, h, 10, '0,0,0', 0.05, 0.12, 30, 90); K.blot(g, w, h, 6, '160,150,130', 0.05, 0.1, 30, 80); K.grain(g, w, h, 5);
    }),
    cmCrypteSol: () => mk(512, 512, (g, w, h) => {
      TX.P.pavers(g, w, h, 96, 72, '#55504a', '#1d1b18', 0.25, 0.5, 4);
      K.blot(g, w, h, 14, '10,10,8', 0.12, 0.25, 20, 80); K.blot(g, w, h, 8, '60,70,50', 0.06, 0.14, 15, 50); K.blot(g, w, h, 6, '150,140,120', 0.06, 0.12, 20, 60);
      for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(180,170,150,0.1)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      K.grain(g, w, h, 7);
    }),
    cmOssSol: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#3d362c'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 20, '20,16,12', 0.12, 0.3, 20, 70); K.blot(g, w, h, 10, '120,108,86', 0.08, 0.16, 20, 60);
      for (let k = 0; k < 260; k++) { const s = 2 + Math.random() * 5; g.fillStyle = K.vary(BR.pick(['#6a6156', '#4e463b', '#8a8070']), 0.2); g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, s, s * 0.7, Math.random() * 3, 0, 7); g.fill(); }
      for (let k = 0; k < 40; k++) { g.save(); g.translate(Math.random() * w, Math.random() * h); g.rotate(Math.random() * 3); g.fillStyle = 'rgba(205,192,160,0.75)'; g.fillRect(-9, -1.5, 18, 3); g.beginPath(); g.arc(-9, 0, 2.6, 0, 7); g.arc(9, 0, 2.6, 0, 7); g.fill(); g.restore(); }
      K.grain(g, w, h, 7);
    }),
    cmTomettes: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#2e1d14'; g.fillRect(0, 0, w, h);
      const nx = 9, ny = 5, sx = w / nx, r = h / (ny * 3);         // tomettes hexagonales (≈ 25 cm), légèrement écrasées pour raccorder
      for (let row = -1; row <= ny * 2 + 1; row++) for (let k = -1; k <= nx; k++) {
        const cx = k * sx + (row % 2 ? sx / 2 : 0), cy = row * r * 1.5;
        g.fillStyle = K.vary('#8e4429', 0.22); g.beginPath(); for (let s = 0; s < 6; s++) { const a = Math.PI / 6 + s * Math.PI / 3, px = cx + Math.cos(a) * (sx / 2 - 2) / Math.cos(Math.PI / 6), py = cy + Math.sin(a) * (r - 2); s ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fill();
      }
      K.blot(g, w, h, 8, '20,12,8', 0.08, 0.16, 20, 60); K.blot(g, w, h, 5, '200,170,140', 0.05, 0.1, 30, 80); K.grain(g, w, h, 6);
    }),
    cmDamier: () => mk(256, 256, (g, w, h) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const dark = (x + y) % 2; g.fillStyle = dark ? '#1c1b1d' : '#bdb7ab'; g.fillRect(x * 128, y * 128, 128, 128); g.strokeStyle = dark ? 'rgba(160,160,170,0.18)' : 'rgba(90,85,80,0.3)'; g.lineWidth = 1.2; for (let v = 0; v < 3; v++) { g.beginPath(); let px = x * 128 + Math.random() * 128, py = y * 128; g.moveTo(px, py); for (let s = 0; s < 6; s++) { px += rnd(20); py += 21; g.lineTo(px, py); } g.stroke(); } }
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(0, 127, w, 2); g.fillRect(127, 0, 2, h);
      K.blot(g, w, h, 6, '40,35,28', 0.08, 0.18, 15, 50); K.grain(g, w, h, 4);
    }),
    // ---- murs ----
    cmSout: () => mk(512, 512, (g, w, h) => {
      ashlar(g, w, h, { base: '#655f55', mortar: '#2b2823', rh: 44, rv: 10, bw: 96, bv: 30, va: 0.24 });
      moss(g, w, h, 1.6); lichen(g, w, h, 140); streaksDown(g, w, 0, 260, 40, 0.18);
      const gb = g.createLinearGradient(0, h - 90, 0, h); gb.addColorStop(0, 'rgba(20,24,14,0)'); gb.addColorStop(1, 'rgba(20,24,14,0.55)'); g.fillStyle = gb; g.fillRect(0, h - 90, w, 90);
      ivy(g, w, 9, 300); K.grain(g, w, h, 6);
    }),
    cmEnceinte: () => mk(256, 256, (g, w, h) => { ashlar(g, w, h, { base: '#5f5a51', mortar: '#2a2722', rh: 26, rv: 6, bw: 46, bv: 16, va: 0.28, j: 2 }); moss(g, w, h, 1.2); lichen(g, w, h, 70); streaksDown(g, w, 0, 120, 16, 0.2); K.grain(g, w, h, 6); }),
    cmNiches: () => mk(512, 512, (g, w, h) => {
      ashlar(g, w, h, { base: '#5a544b', mortar: '#28251f', rh: 38, rv: 6, bw: 72, bv: 20, va: 0.18 });
      for (const yb of [0.55, 1.3, 2.05]) for (let k = 0; k < 4; k++) {
        const x0 = k * 128 + 12, x1 = x0 + 104, y1 = (4 - yb) * 128, y0 = y1 - 68;
        g.fillStyle = '#736b5f'; g.fillRect(x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16);
        g.fillStyle = 'rgba(255,245,225,0.12)'; g.fillRect(x0 - 8, y0 - 8, x1 - x0 + 16, 3); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x0 - 8, y1 + 5, x1 - x0 + 16, 3);
        const r = Math.random();
        if (r < 0.15) {                // niche ouverte : noir, un crâne affleure
          g.fillStyle = '#090807'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
          if (Math.random() < 0.7) skull2D(g, x0 + 28 + Math.random() * 46, y1 - 20, 15, 0.6);
          g.fillStyle = 'rgba(120,110,95,0.6)'; for (let s = 0; s < 6; s++) g.fillRect(x0 + Math.random() * 100, y1 - 4, 6, 4);
        } else {                       // plaque scellée gravée
          g.fillStyle = K.vary(r < 0.6 ? '#948e82' : '#aaa497', 0.12); g.fillRect(x0, y0, x1 - x0, y1 - y0);
          g.fillStyle = 'rgba(30,26,22,0.65)'; g.fillRect(x0 + 50, y0 + 6, 3, 11); g.fillRect(x0 + 46, y0 + 9, 11, 3);
          for (let l = 0; l < 3; l++) { const lw = 26 + Math.random() * 50; g.fillRect(x0 + (104 - lw) / 2, y0 + 24 + l * 13, lw, 2.5); }
          g.fillStyle = 'rgba(40,35,28,0.8)'; for (const [px, py] of [[x0 + 6, y0 + 6], [x1 - 6, y0 + 6], [x0 + 6, y1 - 6], [x1 - 6, y1 - 6]]) { g.beginPath(); g.arc(px, py, 2.4, 0, 7); g.fill(); }
          if (Math.random() < 0.35) { g.strokeStyle = 'rgba(20,18,15,0.8)'; g.lineWidth = 1.3; g.beginPath(); let x = x0 + Math.random() * 104, y = y0; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += rnd(12); y += 12; g.lineTo(x, y); } g.stroke(); }
          blotIn(g, x0, y0, 104, 68, 3, '40,34,26', 0.1, 0.25, 8, 26);
        }
      }
      // plinthe, voûte qui naît en haut (assombrie), suie, humidité
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 40, w, 40);
      const gt = g.createLinearGradient(0, 0, 0, 130); gt.addColorStop(0, 'rgba(8,7,6,0.7)'); gt.addColorStop(1, 'rgba(8,7,6,0)'); g.fillStyle = gt; g.fillRect(0, 0, w, 130);
      K.blot(g, w, h, 10, '40,50,30', 0.08, 0.18, 20, 60); streaksDown(g, w, 0, 220, 24, 0.22); K.grain(g, w, h, 6);
    }),
    cmCrypte: () => mk(512, 512, (g, w, h) => {
      ashlar(g, w, h, { base: '#544f47', mortar: '#25221d', rh: 46, rv: 8, bw: 104, bv: 30, va: 0.2 });
      const gt = g.createLinearGradient(0, 0, 0, 160); gt.addColorStop(0, 'rgba(6,5,4,0.75)'); gt.addColorStop(1, 'rgba(6,5,4,0)'); g.fillStyle = gt; g.fillRect(0, 0, w, 160);
      g.fillStyle = 'rgba(25,22,18,0.7)'; for (let k = 0; k < 2; k++) { const x = 60 + Math.random() * 390, y = 150 + Math.random() * 120; g.fillRect(x - 3, y, 6, 34); g.fillRect(x - 12, y + 9, 24, 6); }
      K.blot(g, w, h, 12, '45,56,34', 0.08, 0.2, 20, 70); streaksDown(g, w, 0, 260, 30, 0.2);
      const gb = g.createLinearGradient(0, h - 100, 0, h); gb.addColorStop(0, 'rgba(15,18,12,0)'); gb.addColorStop(1, 'rgba(15,18,12,0.6)'); g.fillStyle = gb; g.fillRect(0, h - 100, w, 100);
      K.grain(g, w, h, 6);
    }),
    cmOssuaire: () => mk(512, 512, (g, w, h) => {
      g.fillStyle = '#211b14'; g.fillRect(0, 0, w, h);
      for (let y = 4, r = 0; y < h + 8; y += 12, r++) for (let x = (r % 2) * 7 - 7; x < w + 8; x += 14) boneEnd(g, x + rnd(1.5), y + rnd(1.5), 5.5 + Math.random() * 1.5);
      for (const yb of [0.6, 1.65, 2.7]) { const yc = (4 - yb) * 128; g.fillStyle = 'rgba(15,12,8,0.9)'; g.fillRect(0, yc - 17, w, 34); for (let x = 13; x < w; x += 25.6) skull2D(g, x + rnd(1), yc + rnd(1.5), 11.5); }
      // croix de crânes au centre
      for (let k = -3; k <= 3; k++) { skull2D(g, 256, (4 - 2.15) * 128 + k * 24, 10.5); if (Math.abs(k) <= 2 && k) skull2D(g, 256 + k * 24, (4 - 2.15) * 128 - 24, 10.5); }
      K.blot(g, w, h, 16, '10,8,6', 0.12, 0.3, 20, 70); K.blot(g, w, h, 8, '120,110,90', 0.06, 0.12, 20, 60);
      const gt = g.createLinearGradient(0, 0, 0, 120); gt.addColorStop(0, 'rgba(5,4,3,0.8)'); gt.addColorStop(1, 'rgba(5,4,3,0)'); g.fillStyle = gt; g.fillRect(0, 0, w, 120);
      K.grain(g, w, h, 6);
    }),
    cmChapelle: () => chapelle().col,
    cmChapelleE: () => chapelle().em,
    cmMaisonIn: () => mk(256, 512, (g, w, h) => {
      g.fillStyle = '#6e604a'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(60,40,20,0.18)'; g.fillRect(x, 0, 10, h); }
      g.fillStyle = 'rgba(70,50,30,0.25)'; for (let y = 20; y < h - 140; y += 44) for (let x = 16; x < w; x += 32) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
      K.blot(g, w, h, 10, '40,30,20', 0.1, 0.25, 20, 70); streaksDown(g, w, 0, 200, 12, 0.2);
      g.fillStyle = '#3e2c1c'; g.fillRect(0, h - 128, w, 128); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 0; x < w; x += 64) g.fillRect(x, h - 128, 3, 128); g.fillStyle = '#2c1f14'; g.fillRect(0, h - 132, w, 6);
      K.grain(g, w, h, 6);
    }),
    // ---- plafonds, marches, bords ----
    cmVoute: () => mk(512, 512, (g, w, h) => { ashlar(g, w, h, { base: '#4a453d', mortar: '#201e1a', rh: 40, rv: 6, bw: 90, bv: 30, va: 0.2 }); K.blot(g, w, h, 18, '5,4,3', 0.12, 0.3, 20, 90); K.blot(g, w, h, 6, '60,70,50', 0.06, 0.14, 20, 60); K.grain(g, w, h, 6); }),
    cmBord: () => mk(256, 64, (g, w, h) => { g.fillStyle = '#5c574e'; g.fillRect(0, 0, w, h); for (let k = 0; k < 400; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } K.blot(g, w, h, 4, '50,66,32', 0.15, 0.3, 6, 20); }),
    cmMarche: () => mk(128, 128, (g, w, h) => {
      g.fillStyle = '#6a655c'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 6, '30,28,24', 0.1, 0.2, 8, 30);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(w * 0.25, 16, w * 0.5, h - 20);           // usure au centre
      g.fillStyle = '#7c766b'; g.fillRect(0, 0, w, 12); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 12, w, 3);
      K.blot(g, w, h, 4, '48,66,30', 0.2, 0.4, 4, 14); K.grain(g, w, h, 6);
    }),
    // ---- matières du décor ----
    cmPierre: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#7b766b'; g.fillRect(0, 0, w, h);
      K.blot(g, w, h, 16, '40,36,30', 0.08, 0.2, 10, 50); K.blot(g, w, h, 10, '210,205,190', 0.05, 0.12, 10, 40); moss(g, w, h, 1.1); lichen(g, w, h, 90);
      for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.08)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      streaksDown(g, w, 0, 150, 12, 0.16); K.grain(g, w, h, 6);
    }),
    cmGranit: () => mk(256, 256, (g, w, h) => granFill(g, 0, 0, w, h)),
    cmMarbre: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#c4bfb3'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(90,88,84,0.35)'; for (let v = 0; v < 9; v++) { g.lineWidth = 0.8 + Math.random() * 1.6; g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < h) { x += rnd(18); y += 12 + Math.random() * 10; g.lineTo(x, y); } g.stroke(); }
      K.blot(g, w, h, 12, '60,55,45', 0.06, 0.16, 15, 50); K.blot(g, w, h, 5, '50,66,32', 0.08, 0.2, 8, 24); streaksDown(g, w, 0, 120, 10, 0.14); K.grain(g, w, h, 4);
    }),
    cmArdoise: () => mk(256, 256, (g, w, h) => {
      g.fillStyle = '#17191d'; g.fillRect(0, 0, w, h);
      for (let y = 0, r = 0; y < h; y += 26, r++) for (let x = (r % 2) * 16 - 16; x < w; x += 32) { g.fillStyle = K.vary('#3a3f47', 0.22); g.fillRect(x + 1.5, y, 29, 24); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x + 1.5, y + 21, 29, 3); }
      K.blot(g, w, h, 10, '60,74,40', 0.08, 0.2, 10, 40); lichen(g, w, h, 30); K.grain(g, w, h, 5);
    }),
    cmBois: () => mk(256, 256, (g, w, h) => {
      for (let x = 0; x < w; x += 32) { g.fillStyle = K.vary('#3b2a1c', 0.2); g.fillRect(x, 0, 32, h); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, 0, 2, h); g.strokeStyle = 'rgba(20,12,6,0.35)'; g.lineWidth = 1; for (let s = 0; s < 3; s++) { g.beginPath(); const xx = x + 5 + Math.random() * 22; g.moveTo(xx, 0); for (let y = 0; y <= h; y += 16) g.lineTo(xx + Math.sin(y * 0.05 + s) * 2, y); g.stroke(); } }
      K.blot(g, w, h, 8, '10,8,5', 0.1, 0.25, 15, 50); K.grain(g, w, h, 6);
    }),
    cmFer: () => TX.P.metal('#2a2b2d'),
    cmEcorce: () => TX.P.bark('#4f4a43'),
    cmOs: () => mk(128, 128, (g, w, h) => { g.fillStyle = '#c9bc9c'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 10, '90,78,56', 0.1, 0.25, 6, 24); for (let k = 0; k < 200; k++) { g.fillStyle = 'rgba(60,50,35,0.3)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } K.grain(g, w, h, 6); }),
    cmEpitaphe: () => atlas(),
    cmRosace: () => rosace(),
    cmToile: () => mk(256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(230,230,225,0.85)'; g.lineWidth = 1.2;
      const n = 9, ang = k => k / (n - 1) * Math.PI / 2;
      for (let k = 0; k < n; k++) { g.beginPath(); g.moveTo(0, h); g.lineTo(Math.cos(ang(k)) * w * 1.1, h - Math.sin(ang(k)) * h * 1.1); g.stroke(); }
      for (let r = 18; r < w * 1.05; r += 14 + Math.random() * 8) { g.lineWidth = 0.8 + Math.random() * 0.6; g.beginPath(); for (let k = 0; k < n; k++) { const rr = r * (0.92 + Math.random() * 0.12), px = Math.cos(ang(k)) * rr, py = h - Math.sin(ang(k)) * rr; k ? g.quadraticCurveTo((px + Math.cos(ang(k - 0.5)) * rr * 0.9) / 2 + px / 2, (py + h - Math.sin(ang(k - 0.5)) * rr * 0.9) / 2, px, py) : g.moveTo(px, py); } g.stroke(); }
      g.fillStyle = 'rgba(220,220,215,0.15)'; g.beginPath(); g.moveTo(0, h); g.arc(0, h, w * 0.5, -Math.PI / 2, 0); g.fill();
    }),
    cmLierre: () => mk(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(40,30,18,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 0); g.quadraticCurveTo(50, 64, 70, 128); g.stroke(); for (let k = 0; k < 40; k++) leafIvy(g, 30 + Math.random() * 68, 6 + Math.random() * 116, 7 + Math.random() * 6); }),
  });
  TX.FACADES.gardien = { wall: '#a69a84', stone: true, band: '#bdb19b', frameOut: '#3a362f', frameIn: '#2b2722', sillCol: '#bdb19b', glass: ['#161b22', '#0b0e12'], ww: 0.9, wh: 1.35, sill: 0.95, lit: 0.5, litTones: ['#ffb760', '#ffc272', '#ffa850'], shutter: '#34432f', curtains: true, transom: 0.3 };

  /* =====================================================================
     THÈME
     ===================================================================== */
  TX.THEMES.cimetiere = {
    name: 'Cimetière', fog: 0x12161c, fogDensity: 0.05, ambient: 0x3b4458, ambientI: 0.17, hemi: [0x5d6c8c, 0x15130f, 0.2], exposure: 1.0,
    lightColor: 0xffa458, panel: '#ffcf96', flicker: 0.3, deadLights: 0.1, outdoor: true, sky: 0x06090f, moon: 0x7a8db8, lightI: 0.85, flashI: 1,
    env: { kind: 'night', glow: '#7a5a40' },
    tex: {
      floor: {
        0: { t: 'cmHerbe', rep: [0.5, 0.5], rough: 0.95, n: 1.3, surf: 'grass' },
        1: { t: 'cmGravier', rough: 0.9, n: 2, puddle: 0.2, surf: 'gravel' },
        2: { t: 'cmHerbe', rep: [0.5, 0.5], rough: 0.95, n: 1.3, surf: 'grass' },
        3: { t: 'cmTerre', rough: 1, n: 1.8, surf: 'mud' },
        4: { t: 'cmDalles', rough: 0.75, n: 1.6, puddle: 0.3, surf: 'concrete' },
        5: { t: 'cmPavement', rep: [0.5, 0.5], color: '#8a857c', rough: 0.6, n: 1.2, env: 0.5, wet: 0, surf: 'concrete' },
        6: { t: 'cmCrypteSol', rep: [0.5, 0.5], rough: 0.7, n: 1.6, puddle: 0.3, wet: 0, surf: 'concrete' },
        7: { t: 'cmOssSol', rep: [0.5, 0.5], rough: 0.9, n: 1.6, wet: 0, surf: 'gravel' },
        8: { t: 'cmTomettes', rough: 0.55, n: 1.2, wet: 0, surf: 'tile' },
        9: { t: 'cmDamier', rough: 0.3, n: 0.6, env: 0.8, wet: 0, surf: 'tile' },
      },
      wall: {
        0: { t: 'cmSout', rough: 0.92, n: 1.6 }, 1: { t: 'cmSout', rough: 0.92, n: 1.6 }, 3: { t: 'cmNiches', rough: 0.85, n: 1.4, wet: 0 }, 4: { t: 'cmCrypte', rough: 0.9, n: 1.5, wet: 0 },
        5: { t: 'cmOssuaire', rough: 0.85, n: 2, wet: 0 }, 6: { t: 'cmChapelle', em: 'cmChapelleE', ei: 0.38, color: '#a29c92', rough: 0.85, n: 1.3 }, 7: { facade: 'gardien' },
      },
      wallIn: { t: 'cmMaisonIn', wet: 0 },
      ci: { t: 'cmVoute', rep: [0.5, 0.5], n: 1.4 }, co: { t: 'cmVoute', rep: [0.5, 0.5] }, e: { t: 'cmBord' }, r: { t: 'cmMarche', rough: 0.85, surf: 'concrete' }, rs: { t: 'cmSout' }, rr: { t: 'cmPierre' },
    },
    mats: {
      pierre: { t: 'cmPierre', rough: 0.92, n: 1.6, env: 0.25 },
      mur: { t: 'cmEnceinte', rough: 0.95, n: 1.8, env: 0.2 },
      granit: { t: 'cmGranit', rough: 0.3, n: 0.3, env: 1.1 },
      marbre: { t: 'cmMarbre', rough: 0.45, n: 0.5, env: 0.7 },
      epitaphe: { t: 'cmEpitaphe', rough: 0.85, n: 1.3, env: 0.3 },
      epitapheG: { t: 'cmEpitaphe', rough: 0.3, n: 0.4, env: 1.1 },
      ardoise: { t: 'cmArdoise', rough: 0.55, n: 1.4, env: 0.6 },
      bois: { t: 'cmBois', rough: 0.85, n: 1.4, env: 0.2 },
      fer: { t: 'cmFer', rough: 0.55, metal: 0.6, env: 0.8, n: 0.3 },
      ecorce: { t: 'cmEcorce', rough: 0.95, n: 2, env: 0.1 },
      terre: { t: 'cmTerre', rough: 1, n: 1.8, env: 0 },
      trou: { color: '#040303', rough: 1, env: 0 },
      os: { t: 'cmOs', rough: 0.75, n: 0.8, env: 0.2 },
      corbeau: { color: '#09090c', rough: 0.35, env: 0.7 },
      vitrail: { t: 'cmRosace', em: 'cmRosace', ei: 0.75, rough: 0.2, env: 0.5, n: 0 },
      toile: { t: 'cmToile', rough: 0.9, alphaTest: 0.3, double: true, env: 0, n: 0 },
      lierre: { t: 'cmLierre', rough: 0.85, alphaTest: 0.45, double: true, env: 0.1, n: 0 },
      cire: { color: '#e3d8bc', rough: 0.6, env: 0.2 },
      drap: { color: '#2a0d10', rough: 1, env: 0 },
      lumignon: { basic: true, color: '#ff4a26' },
      verre: { basic: true, color: '#ffd9a0' },
      verreMort: { color: '#2a2620', rough: 0.2, env: 0.8 },
    },
  };

  /* =====================================================================
     GÉNÉRATEUR
     ===================================================================== */
  const ZF = { gravier: 1, herbe: 2, terre: 3, dalles: 4, chapelle: 5, crypte: 6, ossuaire: 7, maison: 8, marbre: 9 };
  const ZW = { soutien: 1, enceinte: 2, niches: 3, crypte: 4, ossuaire: 5, chapelle: 6, maison: 7, mausolee: 8, fosse: 9, buisson: 10 };
  const FAMILLES = ['FAMILLE MOREAU', 'FAMILLE DELACROIX', 'FAMILLE VERNIER', 'FAMILLE DE LA ROCHE', 'FAMILLE LEMAIRE', 'FAMILLE BEAUMONT', 'FAMILLE DUVERGER', 'FAMILLE SAINT-AUBIN', 'FAMILLE MONTALEMBERT', 'FAMILLE CHARRIER'];

  function genCimetiere(def, seed, diff, rng, H) {
    const W = 58, Hh = 62, F = 2, ri = (a, b) => K.ri(rng, a, b);
    const m = H.newMap('cimetiere', def, W, Hh, F, seed);
    const id = (x, y) => y * W + x, inb = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh;
    m.noWall = [new Uint8Array(m.WH), new Uint8Array(m.WH)];
    const cx = 28, Rc = 31, Rw = 31 + ri(1, 3), Re = 31 + ri(0, 2);
    const Rof = x => x <= 12 ? Rw : x >= 45 ? Re : Rc;
    const up = (x, y) => y < Rof(x), fOf = (x, y) => up(x, y) ? 1 : 0;
    const CM = (m.cm = { cx, Rc, Rw, Re, crypt: new Uint8Array(m.WH), ckind: new Uint8Array(m.WH), lower: new Uint8Array(m.WH), keep: [new Uint8Array(m.WH), new Uint8Array(m.WH)],
      maus: [], fosses: [], alcoves: [], chapel: null, house: null, red: !!(diff && (diff.id === 'hard' || diff.id === 'nightmare')) });
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = id(x, y);
      if (up(x, y)) { m.t[0][i] = WALL; m.zone[0][i] = ZW.soutien; m.t[1][i] = FLOOR; m.zone[1][i] = ZF.herbe; }
      else { m.t[0][i] = FLOOR; m.zone[0][i] = ZF.herbe; m.t[1][i] = VOID; CM.lower[i] = 1; }
    }
    // mur d'enceinte (dessiné par le décor)
    const encl = i => { m.t[0][i] = WALL; m.t[1][i] = WALL; m.zone[0][i] = m.zone[1][i] = ZW.enceinte; m.noWall[0][i] = m.noWall[1][i] = 1; };
    for (let x = 0; x < W; x++) { encl(id(x, 0)); encl(id(x, Hh - 1)); }
    for (let y = 0; y < Hh; y++) { encl(id(0, y)); encl(id(W - 1, y)); }
    // ---- allées ----
    const setZ = (x, y, z) => { if (!inb(x, y)) return; const f = fOf(x, y), i = id(x, y); if (m.t[f][i] === FLOOR) m.zone[f][i] = z; };
    const zRect = (x0, y0, x1, y1, z) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setZ(x, y, z); };
    zRect(2, 2, W - 3, 3, ZF.gravier); zRect(7, 2, 8, Rw - 1, ZF.gravier); zRect(48, 2, 49, Re - 1, ZF.gravier);
    zRect(2, 25, W - 3, 26, ZF.gravier); zRect(cx, 19, cx + 1, Rc - 1, ZF.gravier);
    zRect(22, 3, 35, 4, ZF.dalles); zRect(22, 4, 24, 20, ZF.dalles); zRect(33, 4, 35, 20, ZF.dalles); zRect(22, 19, 35, 23, ZF.dalles);
    zRect(7, Rw, 8, Hh - 3, ZF.gravier); zRect(48, Re, 49, Hh - 3, ZF.gravier); zRect(cx, Rc, cx + 1, Hh - 2, ZF.gravier);
    zRect(2, 40, W - 3, 41, ZF.gravier); zRect(2, 49, 47, 50, ZF.gravier); zRect(2, 58, W - 3, 59, ZF.gravier);
    for (let x = 2; x <= W - 3; x++) { setZ(x, Rof(x), ZF.gravier); setZ(x, Rof(x) + 1, ZF.gravier); }
    zRect(23, Rc + 4, 34, Rc + 6, ZF.dalles);
    // ---- chapelle (terrasse haute) ----
    const X0c = cx - 3, X1c = cx + 4, Y0c = 5, Y1c = 18;
    CM.chapel = { X0: X0c, X1: X1c, Y0: Y0c, Y1: Y1c };
    for (let y = Y0c; y <= Y1c; y++) for (let x = X0c; x <= X1c; x++) {
      const i = id(x, y);
      if (x === X0c || x === X1c || y === Y0c || y === Y1c) { m.t[1][i] = WALL; m.zone[1][i] = ZW.chapelle; }
      else { m.t[1][i] = FLOOR; m.zone[1][i] = ZF.chapelle; m.indoor[1][i] = 1; }
    }
    for (const x of [cx, cx + 1]) { const i = id(x, Y1c); m.t[1][i] = FLOOR; m.zone[1][i] = ZF.chapelle; m.indoor[1][i] = 1; CM.keep[1][id(x, Y1c + 1)] = 1; CM.keep[1][id(x, Y1c - 1)] = 1; }
    // ---- chapelle funéraire (escalier vers le caveau de famille) ----
    const fx0 = 39, fx1 = 41, fy0 = 18, fy1 = 24;
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
      const i = id(x, y);
      if (x === 40 && y > fy0) { m.t[1][i] = FLOOR; m.zone[1][i] = ZF.marbre; m.indoor[1][i] = 1; }
      else { m.t[1][i] = WALL; m.zone[1][i] = ZW.mausolee; m.noWall[1][i] = 1; }
    }
    CM.maus.push({ f: 1, x0: fx0, y0: fy0, x1: fx1, y1: fy1, door: { x: 40, y: fy1 }, dir: 0, long: true, name: 'FAMILLE DELACROIX', style: 1, mat: 'pierre', tint: 0.92 });
    CM.keep[1][id(40, fy1 + 1)] = 1;
    // ---- crypte (niveau 0, sous la terrasse haute) ----
    const crypt = (x, y, z, kind) => { if (x < 2 || y < 2 || x > W - 3 || !up(x, y)) return false; const i = id(x, y); m.t[0][i] = FLOOR; m.zone[0][i] = z || ZF.crypte; m.indoor[0][i] = 1; CM.crypt[i] = 1; if (kind != null && kind > CM.ckind[i]) CM.ckind[i] = kind; return true; };
    const cRect = (x0, y0, x1, y1, z, k) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) crypt(x, y, z, k == null ? 2 : k); };
    const cLine = (x0, y0, x1, y1, z) => { let x = x0, y = y0; crypt(x, y, z, 1); while (x !== x1) { x += Math.sign(x1 - x); crypt(x, y, z, 1); } while (y !== y1) { y += Math.sign(y1 - y); crypt(x, y, z, 1); } };
    cRect(26, 6, 30, 14);                                     // caveau central, sous la nef
    crypt(30, 5, null, 1); crypt(31, 5, null, 1);
    for (let y = 6; y <= 9; y++) crypt(31, y, null, 1);       // escalier vers le chœur de la chapelle
    cRect(12, 6, 16, 10, ZF.ossuaire, 3);                     // ossuaire
    cLine(25, 9, 17, 9);                                      // galerie ouest
    cLine(14, 11, 14, Rof(14) - 1);                           // galerie des enfeus → porte du mur de soutènement
    cLine(27, 15, 27, 20); cLine(26, 20, 15, 20);             // boucle sud
    cLine(31, 12, 37, 12);                                    // galerie est
    cRect(38, 10, 42, 13);                                    // salle des sarcophages
    crypt(40, 14, null, 1);
    cRect(39, 15, 41, 18);                                    // caveau de famille
    for (let y = 19; y <= 22; y++) crypt(40, y, null, 1);
    // ---- escaliers ----
    const ramp = (x, y, dx, dy, z) => H.addRamp(m, 0, x, y, dx, dy, 4, { zone: z });
    if (!ramp(31, 6, 0, 1, ZF.crypte)) return null;
    if (!ramp(40, 19, 0, 1, ZF.crypte)) return null;
    for (const x of [cx, cx + 1]) if (!ramp(x, Rc + 3, 0, -1, ZF.dalles)) return null;
    if (!ramp(8, Rw + 3, 0, -1, ZF.gravier)) return null;
    if (!ramp(49, Re + 3, 0, -1, ZF.gravier)) return null;
    // alcôves (enfeus ouverts) le long des galeries
    for (let y = 3; y < Rc - 1; y++) for (let x = 3; x < W - 3; x++) {
      const i = id(x, y); if (!CM.crypt[i] || CM.ckind[i] !== 1 || m.rampAt[0][i] >= 0 || m.ramps.some(r => r.approach === i) || rng() > 0.1) continue;
      for (const [dx, dy] of BR.shuffle(D4.slice(), rng)) {
        const ax = x + dx, ay = y + dy, j = id(ax, ay);
        if (!up(ax, ay) || m.t[0][j] !== WALL || CM.crypt[j]) continue;
        let ok = true; for (const [ex, ey] of D4) { const k = id(ax + ex, ay + ey); if (k === i) continue; if (CM.crypt[k] || !up(ax + ex, ay + ey) || m.t[0][k] !== WALL) ok = false; }
        if (!ok || CM.alcoves.some(a => Math.abs(a.x - ax) + Math.abs(a.y - ay) < 3)) continue;
        crypt(ax, ay, null, 4); CM.alcoves.push({ x: ax, y: ay, dx, dy }); break;
      }
    }
    // ---- maison du gardien (terrasse basse) ----
    const hx0 = 50, hx1 = 55, hy0 = 52, hy1 = 56;
    for (let y = hy0; y <= hy1; y++) for (let x = hx0; x <= hx1; x++) {
      const i = id(x, y);
      if (x === hx0 || x === hx1 || y === hy0 || y === hy1) { m.t[0][i] = WALL; m.zone[0][i] = ZW.maison; }
      else { m.zone[0][i] = ZF.maison; m.indoor[0][i] = 1; }
    }
    { const i = id(hx0, 54); m.t[0][i] = FLOOR; m.zone[0][i] = ZF.maison; m.indoor[0][i] = 1; CM.keep[0][id(hx0 - 1, 54)] = 1; CM.keep[0][id(hx0 + 1, 54)] = 1; }
    CM.house = { x0: hx0, y0: hy0, x1: hx1, y1: hy1, door: { x: hx0, y: 54 } };
    // ---- départ (caveau central) / sortie (petite porte à côté du grand portail) ----
    m.spawn = { f: 0, cx: 28, cy: 10 };
    m.exit = { cx: 32, cy: Hh - 2, dx: 0, dy: 1 };
    zRect(25, 57, 34, 60, ZF.gravier);
    for (let y = 56; y <= 60; y++) for (let x = 24; x <= 35; x++) CM.keep[0][id(x, y)] = 1;
    // ---- mausolées ----
    const isGrass = (f, x, y) => inb(x, y) && x > 1 && y > 1 && x < W - 2 && y < Hh - 2 && fOf(x, y) === f && m.t[f][id(x, y)] === FLOOR && m.zone[f][id(x, y)] === ZF.herbe && !CM.keep[f][id(x, y)] && m.propAt[f][id(x, y)] < 0 && m.rampAt[f][id(x, y)] < 0 && (f || !CM.crypt[id(x, y)]);
    const isPath = (f, x, y) => inb(x, y) && fOf(x, y) === f && m.t[f][id(x, y)] === FLOOR && m.zone[f][id(x, y)] === ZF.gravier && m.rampAt[f][id(x, y)] < 0;
    const nearRamp = (x, y, r) => m.ramps.some(q => q.cells.concat([q.approach, q.landing]).some(c => Math.abs(c % W - x) <= r && Math.abs(((c / W) | 0) - y) <= r));
    const tryMaus = (f, x0, y0, dir) => {
      const ax = dir < 2, w = ax ? 3 : 4, d = ax ? 4 : 3, x1 = x0 + w - 1, y1 = y0 + d - 1;
      for (let yy = y0 - 1; yy <= y1 + 1; yy++) for (let xx = x0 - 1; xx <= x1 + 1; xx++) {
        const inside = xx >= x0 && xx <= x1 && yy >= y0 && yy <= y1;
        if (inside && !isGrass(f, xx, yy)) return false;
        if (!inside && inb(xx, yy) && fOf(xx, yy) === f && m.t[f][id(xx, yy)] === WALL && m.zone[f][id(xx, yy)] !== ZW.enceinte) return false;
      }
      if (nearRamp(x0 + 1, y0 + 1, 3)) return false;
      const door = dir === 0 ? [x0 + 1, y1] : dir === 1 ? [x0 + 1, y0] : dir === 2 ? [x1, y0 + 1] : [x0, y0 + 1];
      const front = [door[0] + (dir === 2 ? 1 : dir === 3 ? -1 : 0), door[1] + (dir === 0 ? 1 : dir === 1 ? -1 : 0)];
      if (!isPath(f, front[0], front[1])) return false;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const i = id(xx, yy), edge = xx === x0 || xx === x1 || yy === y0 || yy === y1;
        if (edge && !(xx === door[0] && yy === door[1])) { m.t[f][i] = WALL; m.zone[f][i] = ZW.mausolee; m.noWall[f][i] = 1; }
        else { m.zone[f][i] = ZF.marbre; m.indoor[f][i] = 1; CM.keep[f][i] = 1; }
      }
      CM.keep[f][id(front[0], front[1])] = 1;
      // autel adossé au mur du fond (collision : boîte peu profonde dans la case du fond)
      const dx = dir === 2 ? 1 : dir === 3 ? -1 : 0, dz = dir === 0 ? 1 : dir === 1 ? -1 : 0;
      const bxc = dz ? door[0] : (dx > 0 ? x0 + 1 : x1 - 1), byc = dz ? (dz > 0 ? y0 + 1 : y1 - 1) : door[1];
      const bx = dz ? (bxc + 0.5) * C : (dx > 0 ? bxc * C : (bxc + 1) * C), bz = dz ? (dz > 0 ? byc * C : (byc + 1) * C) : (byc + 0.5) * C;
      const al = dz ? [bx - 0.7, dz > 0 ? bz : bz - 0.5, bx + 0.7, dz > 0 ? bz + 0.5 : bz] : [dx > 0 ? bx : bx - 0.5, bz - 0.7, dx > 0 ? bx + 0.5 : bx, bz + 0.7];
      K.pushProp(m, f, id(bxc, byc), al[0], al[1], al[2], al[3], f * SH, 1.0, 'autelM');
      CM.maus.push({ f, x0, y0, x1, y1, door: { x: door[0], y: door[1] }, dir, name: FAMILLES[ri(0, FAMILLES.length - 1)], style: ri(0, 2), mat: rng() < 0.4 ? 'marbre' : 'pierre', tint: 0.8 + rng() * 0.2, altar: al, back: { x: bx, z: bz } });
      return true;
    };
    for (let k = 0, nU = 0, nL = 0; k < 900 && (nU < 5 || nL < 2); k++) {
      const f = nU < 5 ? (rng() < 0.75 ? 1 : 0) : 0; if (f === 0 && nL >= 2) continue;
      const x = ri(2, W - 7), y = f ? ri(2, 27) : ri(Rc + 2, Hh - 7), dir = ri(0, 3);
      if (tryMaus(f, x, y, dir)) { if (f) nU++; else nL++; }
    }
    // ---- fosses fraîchement creusées ----
    const tryFosse = (f, x, y) => {
      if (!isGrass(f, x, y) || nearRamp(x, y, 2)) return false;
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) { if (!inb(xx, yy) || fOf(xx, yy) !== f) return false; const j = id(xx, yy); if (m.t[f][j] === WALL) return false; if (f === 1 && (CM.crypt[j] || m.t[0][j] !== WALL)) return false; }
      const i = id(x, y); m.t[f][i] = WALL; m.zone[f][i] = ZW.fosse; m.noWall[f][i] = 1;
      CM.fosses.push({ f, x, y, ax: rng() < 0.5 ? 1 : 0, v: ri(0, 1000) });
      return true;
    };
    for (let k = 0, n = 0; k < 400 && n < 5; k++) { const f = n < 3 ? 1 : 0, x = ri(3, W - 4), y = f ? ri(3, 28) : ri(Rc + 3, Hh - 5); if (tryFosse(f, x, y)) n++; }
    // ---- garde-corps (balustrades de la terrasse, trémies d'escaliers) ----
    K.rails(m);
    // ---- objets ----
    const sol = (f, x, y, sub, h, w, d, o) => { if (!inb(x, y)) return null; const i = id(x, y); if (m.t[f][i] !== FLOOR || !H.freeCell(m, f, i) || CM.keep[f][i]) return null; return K.solid(m, H, f, x, y, sub, h, w, d, o); };
    // contreforts de la chapelle
    for (const zc of [12, 16, 20, 24, 28, 32]) {
      const cy = zc / 2;
      for (const [cxl, x0, x1] of [[X0c - 1, X0c * C - 0.9, X0c * C], [X1c + 1, (X1c + 1) * C, (X1c + 1) * C + 0.9]]) { const i = id(cxl, cy); if (m.t[1][i] === FLOOR && m.propAt[1][i] < 0) K.pushProp(m, 1, i, x0, zc - 0.35, x1, zc + 0.35, SH, 3.6, 'contrefort'); }
    }
    // chapelle : autel, catafalque, bancs, lutrin, grand chandelier
    sol(1, 28, 6, 'autel', 1.05, 1.9, 0.95, { oz: -0.35, data: { part: 0 } }); sol(1, 29, 6, 'autel', 1.05, 1.9, 0.95, { oz: -0.35, data: { part: 1 } });
    sol(1, 27, 6, 'cierges', 1.7, 0.45, 0.45, { ox: 0.2, oz: -0.2 });
    sol(1, 28, 9, 'catafalque', 1.05, 0.8, 2.05, { ox: 1.0 });
    sol(1, 27, 9, 'lutrin', 1.3, 0.5, 0.5, { ox: -0.2 });
    for (let y = 11; y <= 16; y++) for (const x of [26, 27, 30, 31]) sol(1, x, y, 'banc_eglise', 0.95, 1.85, 0.55, { oz: 0.25, data: { tip: rng() < 0.12, ry: (rng() - 0.5) * 0.08 } });
    // crypte : sarcophages, ossements, étagères à cercueils, autels
    for (const [x, y] of [[26, 7], [26, 12], [30, 8], [29, 13]]) sol(0, x, y, 'sarco', 1.0, 1.0, 2.05, { data: { open: rng() < 0.35, ax: 0 } });
    sol(0, 14, 8, 'pyramide', 1.3, 1.5, 1.5);
    for (const [x, y] of [[12, 6], [16, 6], [12, 10], [16, 10], [13, 6], [12, 7]]) sol(0, x, y, 'ossements', 0.75, 1.7, 1.7, { v: ri(0, 1000) });
    for (const [x, y] of [[39, 10], [41, 10]]) sol(0, x, y, 'sarco', 1.0, 1.0, 2.05, { data: { open: rng() < 0.4, ax: 0 } });
    sol(0, 42, 11, 'autelC', 1.0, 0.9, 1.8, { ox: 0.45 });
    sol(0, 38, 13, 'sarco', 1.0, 2.05, 1.0, { data: { open: false, ax: 1 } });
    for (const [x, y, s] of [[39, 15, -1], [41, 15, 1], [39, 17, -1], [41, 17, 1]]) sol(0, x, y, 'etagere', 2.2, 0.95, 1.95, { ox: s * 0.5, data: { s } });
    for (const a of CM.alcoves) {
      const i = id(a.x, a.y), X0 = a.x * C, Z0 = a.y * C, dp = 0.6;
      const x0 = a.dx > 0 ? X0 + C - dp : X0 + 0.05, x1 = a.dx < 0 ? X0 + dp : X0 + C - 0.05, z0 = a.dy > 0 ? Z0 + C - dp : Z0 + 0.05, z1 = a.dy < 0 ? Z0 + dp : Z0 + C - 0.05;
      if (a.dx) K.pushProp(m, 0, i, x0, Z0 + 0.05, x1, Z0 + C - 0.05, 0, 0.85, 'alcove'); else K.pushProp(m, 0, i, X0 + 0.05, z0, X0 + C - 0.05, z1, 0, 0.85, 'alcove');
      m.props[m.propAt[0][i]].data = { dx: a.dx, dy: a.dy, v: ri(0, 1000) };
    }
    // maison du gardien
    sol(0, 53, 54, 'table', 0.78, 1.3, 0.85); sol(0, 52, 55, 'chaise', 0.9, 0.45, 0.45, { ox: 0.3, oz: -0.2 }); sol(0, 54, 53, 'poele', 1.0, 0.6, 0.6, { ox: 0.3, oz: -0.3 });
    sol(0, 54, 55, 'lit', 0.62, 0.95, 1.95, { ox: 0.45 }); sol(0, 51, 53, 'armoire', 2.0, 1.1, 0.55, { oz: -0.7 });
    // allées : lanternes, bancs, anges, points d'eau
    const lights = [];
    const lantern = (f, x, y) => { const p = sol(f, x, y, 'lanterne', 2.9, 0.32, 0.32, { ox: 0, oz: 0 }); if (!p) return; const L = { f, cx: x, cy: y, y: f * SH + 2.62, kind: 'lamp', px: p.x, pz: p.z, dead: rng() < 0.12, flicker: rng() < 0.35, phase: rng() * 100, deco: 'lanterne', prop: p }; m.lights.push(L); p.data = { light: L }; };
    for (const [x, y] of [[27, 19], [30, 19], [27, 29], [30, 29], [27, 36], [30, 36], [27, 44], [30, 47], [27, 53], [30, 55], [9, 12], [9, 22], [47, 10], [47, 21], [9, 45], [6, 54], [47, 44], [46, 54], [20, 27], [37, 27], [16, 42], [40, 42], [12, 32], [34, 2], [21, 2], [16, 24], [36, 39]]) lantern(fOf(x, y), x, y);
    for (const [x, y] of [[27, 46], [30, 51], [26, 24], [31, 24], [6, 27], [50, 27]]) sol(fOf(x, y), x, y, 'banc', 0.45, x === 27 || x === 30 ? 0.55 : 1.6, x === 27 || x === 30 ? 1.6 : 0.55, { ox: x === 27 ? 0.35 : x === 30 ? -0.35 : 0 });
    for (const [x, y] of [[23, 24], [34, 24], [27, 38], [30, 38], [9, 29]]) sol(fOf(x, y), x, y, 'ange', 2.9, 0.9, 0.9, { data: { ry: rng() * 6.28 } });
    sol(0, 31, 42, 'eau', 1.0, 0.55, 0.55); sol(1, 9, 24, 'eau', 1.0, 0.55, 0.55);
    for (const fs of CM.fosses) for (const [dx, dy] of D4) { if (sol(fs.f, fs.x + dx, fs.y + dy, 'brouette', 0.7, 0.7, 1.3, { data: { ry: rng() * 6.28 } })) break; }
    // ---- tombes ----
    const graveRow = (f, y) => f ? y % 2 === 0 : y % 2 === 1;
    for (let y = 2; y < Hh - 2; y++) for (let x = 2; x < W - 2; x++) {
      const f = fOf(x, y), i = id(x, y);
      if (!isGrass(f, x, y) || !graveRow(f, y) || !H.freeCell(m, f, i) || nearRamp(x, y, 1)) continue;
      if (rng() > (f ? 0.86 : 0.8)) continue;
      // arbres morts à la place de quelques tombes
      if (rng() < (f ? 0.06 : 0.035)) { K.solid(m, H, f, x, y, 'arbre', 7, 0.6, 0.6, { ox: (rng() - 0.5) * 0.6, oz: (rng() - 0.5) * 0.6, v: ri(0, 100000) }); continue; }
      const old = f === 1, mil = !old && x >= 36 && x <= 46 && y >= 42 && y <= 48;
      let style;
      if (mil) style = 'militaire';
      else if (old) style = BR.pick(['stele', 'stele', 'croix', 'croix', 'fer', 'fer', 'celtique', 'dalle', 'coffre', 'brisee', 'brisee', 'obelisque', 'ange', 'stele'], rng);
      else style = BR.pick(['stele_g', 'stele_g', 'stele_g', 'dalle_g', 'dalle_g', 'croix', 'stele', 'coffre', 'brisee', 'ange'], rng);
      const tall = { stele: 1.15, stele_g: 1.2, croix: 1.5, fer: 1.3, celtique: 1.7, dalle: 0.32, dalle_g: 0.95, coffre: 1.0, brisee: 0.75, obelisque: 2.6, ange: 2.7, militaire: 1.0 }[style];
      const faceN = rng() < 0.12 ? -1 : 1;
      const d = {
        style, face: faceN, jit: (rng() - 0.5) * (old ? 0.12 : 0.04), tilt: (old ? (rng() < 0.45 ? (rng() - 0.3) * 0.32 : 0) : (rng() < 0.1 ? (rng() - 0.5) * 0.12 : 0)), roll: old && rng() < 0.3 ? (rng() - 0.5) * 0.2 : 0,
        prof: BR.pick(['ronde', 'ogive', 'epaule', 'droite'], rng), hw: 0.3 + rng() * 0.12, h: 0.75 + rng() * 0.35, tex: style === 'stele_g' || style === 'dalle_g' ? 8 + ri(0, 7) : ri(0, 7),
        tint: old ? 0.62 + rng() * 0.3 : 0.8 + rng() * 0.2, kerb: rng() < 0.6, lum: rng() < 0.2, lumLit: rng() < 0.5, fleurs: rng() < 0.25, corbeau: rng() < 0.03, v: ri(0, 100000),
      };
      K.solid(m, H, f, x, y, 'tombe', tall, 1.05, 2.0, { ox: (rng() - 0.5) * 0.1, data: d });
    }
    // grands arbres morts contre l'enceinte
    for (let k = 0; k < 60; k++) { const side = ri(0, 3), t = ri(3, (side < 2 ? W : Hh) - 4), x = side === 0 ? 1 : side === 1 ? W - 2 : t, y = side < 2 ? t : side === 2 ? 1 : Hh - 2; const f = fOf(x, y); if (isGrass(f, x, y) && H.freeCell(m, f, id(x, y))) K.solid(m, H, f, x, y, 'arbre', 8, 0.7, 0.7, { v: ri(0, 100000), data: { big: true } }); }
    // ---- finalisation ----
    const before = [m.t[0].slice(), m.t[1].slice()];
    if (!H.finalize(m, rng, diff)) return null;
    if (m.ramps.some(r => r.dead)) return null;
    if (!K.cutJumps(m)) return null;
    for (let f = 0; f < 2; f++) for (let i = 0; i < m.WH; i++) if (before[f][i] === FLOOR && m.t[f][i] === WALL) {
      if (f === 0 && CM.crypt[i]) { m.zone[0][i] = ZW.crypte; CM.crypt[i] = 0; }
      else { m.zone[f][i] = ZW.buisson; m.noWall[f][i] = 1; }
    }
    for (let i = 0; i < m.WH; i++) if (CM.lower[i] && m.t[1][i] === WALL) m.noWall[1][i] = 1;
    // murs de la crypte : enfeus dans les galeries, pierre nue dans les salles, ossements dans l'ossuaire
    for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = id(x, y); if (m.t[0][i] !== WALL || m.zone[0][i] !== ZW.soutien) continue;
      let low = false, oss = false, room = false, cor = false;
      for (const [dx, dy] of D4) { const j = id(x + dx, y + dy); if (m.t[0][j] === WALL) continue; if (CM.lower[j]) low = true; else if (CM.crypt[j]) { const k = CM.ckind[j]; if (k === 3) oss = true; else if (k === 2) room = true; else cor = true; } }
      if (low) continue;
      m.zone[0][i] = oss ? ZW.ossuaire : room ? ZW.crypte : cor ? ZW.niches : ZW.soutien;
    }
    m.lights = m.lights.filter(l => !l.prop || !l.prop.dead);
    for (const l of m.lights) delete l.prop;
    // ---- éclairage : bougies et lanternes ----
    const lamp = (x, z, y, deco, o) => { const L = Object.assign({ f: Math.max(0, Math.floor((y - 0.5) / SH)), cx: Math.floor(x / C), cy: Math.floor(z / C), y, kind: 'lamp', px: x, pz: z, dead: rng() < 0.06, flicker: rng() < 0.5, phase: rng() * 100, deco }, o || {}); m.lights.push(L); return L; };
    lamp(57, 21, 3.05, 'lustre', { dead: false });                                  // caveau central
    lamp(29, 17, 1.5, 'bougies', { dead: false, cb: 1.12 });                        // ossuaire (sur la pyramide de crânes)
    lamp(85.45, 23, 1.5, 'halo', { dead: false });                                  // salle des sarcophages (bougies de l'autel)
    lamp(81, 35, 0.45, 'bougies', { dead: false, cb: 0 });                          // caveau de famille
    lamp(58, 13.0, SH + 1.45, 'autel', { dead: false, flicker: true });             // chapelle : cierges de l'autel
    lamp(58, 26, SH + 3.0, 'lustre', { dead: false });                              // chapelle : couronne de lumière
    lamp(105, 109.5, 2.75, 'ampoule', { dead: false, flicker: true });              // maison du gardien
    lamp(14 * C + 1 + 1.45, 31 * C + 0.28, 2.6, 'applique', { sx: 0, sz: 1, dead: false });  // porte de la crypte
    // appliques dans les galeries de la crypte
    const lit = [[28, 10], [14, 8], [42, 11], [40, 16]];
    const cc = []; for (let y = 2; y < Rc; y++) for (let x = 2; x < W - 2; x++) { const i = id(x, y); if (CM.crypt[i] && m.t[0][i] === FLOOR && CM.ckind[i] === 1) cc.push([x, y]); }
    BR.shuffle(cc, rng);
    for (const [x, y] of cc) {
      if (lit.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) < 6)) continue;
      const w = BR.shuffle(D4.slice(), rng).find(([dx, dy]) => m.t[0][id(x + dx, y + dy)] === WALL); if (!w) continue;
      lit.push([x, y]); lamp((x + 0.5) * C + w[0] * 0.86, (y + 0.5) * C + w[1] * 0.86, 2.2, 'applique', { sx: -w[0], sz: -w[1] });
    }
    for (const a of CM.alcoves) if (rng() < 0.4) { const L = lamp((a.x + 0.5) * C + a.dx * 0.7, (a.y + 0.5) * C + a.dy * 0.7, 1.15, 'bougies', { cb: 0.85 }); a.lit = !L.dead; }
    for (const M of CM.maus) if (!M.long && M.altar && rng() < 0.45) { const al = M.altar; lamp((al[0] + al[2]) / 2, (al[1] + al[3]) / 2, M.f * SH + 1.35, 'halo', { flicker: true, dead: false }); M.lit = true; }
    return m;
  }

  /* =====================================================================
     GÉOMÉTRIE : repères locaux (tombes penchées), dalles profilées, petits personnages
     ===================================================================== */
  const v3 = K.v3;
  const IDF = { o: [0, 0, 0], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1] };
  const LP = (F, x, y, z) => [F.o[0] + F.ax[0] * x + F.ay[0] * y + F.az[0] * z, F.o[1] + F.ax[1] * x + F.ay[1] * y + F.az[1] * z, F.o[2] + F.ax[2] * x + F.ay[2] * y + F.az[2] * z];
  const LD = (F, x, y, z) => v3.nrm([F.ax[0] * x + F.ay[0] * y + F.az[0] * z, F.ax[1] * x + F.ay[1] * y + F.az[1] * z, F.ax[2] * x + F.ay[2] * y + F.az[2] * z]);
  // sous-repère : origine (lx,ly,lz) du repère F, puis lacet (yaw, autour de y), inclinaison (tilt, vers l'avant) et roulis (roll)
  function sub(F, lx, ly, lz, tilt, roll, yaw) {
    let ax = F.ax, ay = F.ay, az = F.az;
    if (yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); const nax = v3.add(v3.scl(ax, c), v3.scl(az, -s)), naz = v3.add(v3.scl(ax, s), v3.scl(az, c)); ax = nax; az = naz; }
    if (tilt) { const c = Math.cos(tilt), s = Math.sin(tilt); const nay = v3.add(v3.scl(ay, c), v3.scl(az, s)), naz = v3.add(v3.scl(az, c), v3.scl(ay, -s)); ay = nay; az = naz; }
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const nax = v3.add(v3.scl(ax, c), v3.scl(ay, s)), nay = v3.add(v3.scl(ay, c), v3.scl(ax, -s)); ax = nax; ay = nay; }
    return { o: LP(F, lx, ly, lz), ax, ay, az };
  }
  const frameAt = (x, y, z, ry) => sub(IDF, x, y, z, 0, 0, ry);
  function tri3(B, a, b, c, n, ua, ub, uc, col) {
    const cr = v3.cross(v3.sub(b, a), v3.sub(c, a));
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { const t = b; b = c; c = t; const tu = ub; ub = uc; uc = tu; }
    const o = B.p.length / 3;
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) { B.p.push(p[0], p[1], p[2]); B.n.push(n[0], n[1], n[2]); B.u.push(u[0], u[1]); B.c.push(col[0], col[1], col[2]); }
    B.i.push(o, o + 1, o + 2);
  }
  // pavé dans un repère quelconque (uv projetées : texture continue)
  function obox(B, F, x0, y0, z0, x1, y1, z1, col, us) {
    const p = (x, y, z) => LP(F, x, y, z);
    const a = p(x0, y0, z0), b = p(x1, y0, z0), c = p(x1, y0, z1), d = p(x0, y0, z1), e = p(x0, y1, z0), f = p(x1, y1, z0), g = p(x1, y1, z1), h = p(x0, y1, z1);
    const cl = typeof col === 'string' ? K.col(col) : col, top = cl.map(v => Math.min(1, v * 1.08)), side = cl.map(v => v * 0.86);
    K.face(B, e, f, g, h, top, F.ay, us); K.face(B, a, b, c, d, side, LD(F, 0, -1, 0), us);
    K.face(B, d, c, g, h, cl, F.az, us); K.face(B, a, b, f, e, cl, LD(F, 0, 0, -1), us);
    K.face(B, b, c, g, f, side, F.ax, us); K.face(B, a, d, h, e, side, LD(F, -1, 0, 0), us);
  }
  const wbox = (B, x0, y0, z0, x1, y1, z1, col, us) => obox(B, IDF, Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), col, us);
  // dalle verticale de profil convexe (plan local XY), épaisseur z0..z1 ; face avant dans BF avec uv d'atlas
  function slabP(B, BF, F, pts, z0, z1, cl, uvf, cen) {
    const n = pts.length, side = cl.map(v => v * 0.86);
    for (let k = 0; k < n; k++) { const p = pts[k], q = pts[(k + 1) % n]; K.face(B, LP(F, p[0], p[1], z0), LP(F, q[0], q[1], z0), LP(F, q[0], q[1], z1), LP(F, p[0], p[1], z1), side, LD(F, q[1] - p[1], -(q[0] - p[0]), 0), 0.5); }
    const c = cen || [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
    const nf = F.az, nb = LD(F, 0, 0, -1), pu = (x, y) => [x * 0.5 + 0.25, y * 0.5];
    for (let k = 0; k < n; k++) {
      const p = pts[k], q = pts[(k + 1) % n];
      if (BF && uvf) tri3(BF, LP(F, c[0], c[1], z1), LP(F, p[0], p[1], z1), LP(F, q[0], q[1], z1), nf, uvf(c[0], c[1]), uvf(p[0], p[1]), uvf(q[0], q[1]), cl);
      else tri3(B, LP(F, c[0], c[1], z1), LP(F, p[0], p[1], z1), LP(F, q[0], q[1], z1), nf, pu(c[0], c[1]), pu(p[0], p[1]), pu(q[0], q[1]), cl);
      tri3(B, LP(F, c[0], c[1], z0), LP(F, p[0], p[1], z0), LP(F, q[0], q[1], z0), nb, pu(c[0], c[1]), pu(p[0], p[1]), pu(q[0], q[1]), side);
    }
  }
  // polygone plan double face (ailes, queue d'oiseau, toiles)
  function polyFan(B, pts, cl, uvs) {
    const n = v3.nrm(v3.cross(v3.sub(pts[1], pts[0]), v3.sub(pts[2], pts[0]))), m = v3.scl(n, -1), U = uvs || pts.map(p => [p[0] * 0.5, p[2] * 0.5 + p[1] * 0.5]);
    for (let k = 1; k + 1 < pts.length; k++) { tri3(B, pts[0], pts[k], pts[k + 1], n, U[0], U[k], U[k + 1], cl); tri3(B, pts[0], pts[k], pts[k + 1], m, U[0], U[k], U[k + 1], cl); }
  }
  function profile(kind, hw, h) {
    const pts = [[-hw, 0], [hw, 0]];
    if (kind === 'ronde') { const rv = Math.min(hw * 0.8, h * 0.3), ys = h - rv; pts.push([hw, ys]); for (let k = 1; k < 8; k++) { const a = k / 8 * Math.PI; pts.push([Math.cos(a) * hw, ys + Math.sin(a) * rv]); } pts.push([-hw, ys]); }
    else if (kind === 'ogive') { const rv = hw * 1.15, ys = h - rv; pts.push([hw, ys], [hw * 0.86, ys + rv * 0.4], [hw * 0.55, ys + rv * 0.75], [0, h], [-hw * 0.55, ys + rv * 0.75], [-hw * 0.86, ys + rv * 0.4], [-hw, ys]); }
    else if (kind === 'epaule') pts.push([hw, h * 0.78], [hw * 0.55, h * 0.82], [hw * 0.3, h * 0.95], [0, h], [-hw * 0.3, h * 0.95], [-hw * 0.55, h * 0.82], [-hw, h * 0.78]);
    else if (kind === 'brisee') pts.push([hw, h * 0.45], [hw * 0.55, h * 0.62], [hw * 0.2, h * 0.38], [-hw * 0.12, h * 0.72], [-hw * 0.5, h * 0.5], [-hw, h * 0.58]);
    else pts.push([hw, h - 0.03], [hw - 0.03, h], [-hw + 0.03, h], [-hw, h - 0.03]);
    return pts;
  }
  const tileUV = (t, lx, ly, sx, oy) => { const c = t % 4, r = Math.floor(t / 4); return [c / 4 + (0.5 + lx / sx) * 0.25, 1 - (r + 1) / 4 + ((ly - oy) / sx) * 0.25]; };
  // plaque gravée (rectangle du plan local z = zf) : bande de texte de la tuile
  function plaque(BF, F, x0, y0, x1, y1, zf, t, cl) {
    const sx = Math.max((y1 - y0) / 0.34, (x1 - x0) / 0.92), oy = (y0 + y1) / 2 - 0.575 * sx, uv = (x, y) => tileUV(t, x, y, sx, oy);
    K.face(BF, LP(F, x0, y0, zf), LP(F, x1, y0, zf), LP(F, x1, y1, zf), LP(F, x0, y1, zf), cl, F.az, [uv(x0, y0), uv(x1, y0), uv(x1, y1), uv(x0, y1)]);
  }
  // ange qui pleure (mains sur le visage, ailes repliées) ; wings=false : saint en robe à capuche
  function angel(B, F, s, cl, wings) {
    const P = (x, y, z) => LP(F, x * s, y * s, z * s);
    const T = (pts, rad, sides) => BR.World.H.tube(B, pts.map(p => P(p[0], p[1], p[2])), rad.map(r => r * s), sides || 8, cl, 1);
    T([[0, 0, 0], [0, 0.5, 0.01], [0, 1.0, 0.03]], [0.3, 0.24, 0.19], 11);
    T([[0, 1.0, 0.03], [0, 1.25, 0.04], [0, 1.42, 0.03]], [0.19, 0.2, 0.15], 9);
    BR.World.H.icoBlob(B, ...P(0, 1.55, 0.09), 0.12 * s, cl, 1.15, 1);
    if (!wings) T([[0, 1.42, -0.05], [0, 1.62, 0.02], [0, 1.72, 0.1]], [0.17, 0.16, 0.06], 8);       // capuche
    for (const sx of [-1, 1]) T([[sx * 0.17, 1.38, 0.0], [sx * 0.2, 1.22, 0.17], [sx * 0.07, 1.5, 0.21]], [0.058, 0.05, 0.042], 6);
    T([[0, 0.02, 0.02], [0, 0.0, 0.32]], [0.12, 0.04], 6);         // pli du bas de la robe
    if (wings) for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
      const o = k * 0.035;
      polyFan(B, [P(sx * 0.1, 1.42 - o, -0.1 - o), P(sx * (0.44 - o), 1.98 - k * 0.09, -0.27 - o), P(sx * (0.37 - o), 1.12, -0.31 - o), P(sx * (0.22 - o * 0.5), 0.42 + k * 0.12, -0.24 - o), P(sx * 0.08, 0.98, -0.12 - o)], cl);
    }
  }
  function raven(B, x, y, z, ry, s, pose) {
    const F = frameAt(x, y, z, ry), P = (a, b, c) => LP(F, a * s, b * s, c * s), cl = [1, 1, 1], HH = BR.World.H;
    HH.tube(B, [P(0, 0.085, -0.16), P(0, 0.1, -0.05), P(0, 0.12, 0.06), P(0, 0.155, 0.12)], [0.012 * s, 0.07 * s, 0.066 * s, 0.03 * s], 7, cl, 1);
    HH.icoBlob(B, ...P(0, 0.2, 0.135), 0.05 * s, cl, 1.05, 1);
    HH.tube(B, [P(0, 0.2, 0.175), P(0, 0.188, 0.25)], [0.017 * s, 0.002 * s], 5, cl, 1);
    polyFan(B, [P(-0.03, 0.085, -0.12), P(0.03, 0.085, -0.12), P(0.05, 0.05, -0.3), P(-0.05, 0.05, -0.3)], cl);
    if (pose === 'vol') for (const sx of [-1, 1]) polyFan(B, [P(sx * 0.05, 0.12, 0.06), P(sx * 0.42, 0.2, 0.0), P(sx * 0.55, 0.16, -0.08), P(sx * 0.3, 0.1, -0.12), P(sx * 0.05, 0.1, -0.06)], cl);
    else {
      for (const sx of [-1, 1]) { polyFan(B, [P(sx * 0.066, 0.15, 0.06), P(sx * 0.075, 0.11, -0.04), P(sx * 0.05, 0.08, -0.24), P(sx * 0.06, 0.13, -0.06)], cl); HH.tube(B, [P(sx * 0.025, 0.07, 0.02), P(sx * 0.025, 0.0, 0.03)], [0.006 * s, 0.005 * s], 3, cl, 1); }
    }
  }
  // arbre mort : tronc noueux, branches nues qui se divisent ; renvoie les bouts de branches
  function deadTree(B, x, b, z, rng, s, depthMax) {
    const HH = BR.World.H, bark = [0.78, 0.76, 0.72], H0 = (3.0 + rng() * 2.4) * s, r0 = 0.24 * s, lx = (rng() - 0.5) * 0.9, lz = (rng() - 0.5) * 0.9, pts = [], rad = [], ends = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([x + lx * t * t + (k && k < 6 ? (rng() - 0.5) * 0.18 : 0), b - 0.12 + H0 * t, z + lz * t * t + (k && k < 6 ? (rng() - 0.5) * 0.18 : 0)]); rad.push(r0 * (k === 0 ? 1.6 : k === 1 ? 1.15 : 1 - t * 0.62)); }
    HH.tube(B, pts, rad, 9, bark, 2);
    for (let k = 0, n = 3 + Math.floor(rng() * 3); k < n; k++) { const a = k / n * 6.283 + rng(), L = (0.5 + rng() * 0.4) * s; HH.tube(B, [[x, b + 0.3 * s, z], [x + Math.cos(a) * L * 0.55, b + 0.05, z + Math.sin(a) * L * 0.55], [x + Math.cos(a) * L, b - 0.1, z + Math.sin(a) * L]], [r0 * 0.6, r0 * 0.32, r0 * 0.08], 5, bark, 1); }
    const branch = (p, dir, len, r, depth) => {
      const n = 4, ps = [p], rs = [r]; let q = p, d = dir;
      for (let k = 1; k <= n; k++) { d = v3.nrm([d[0] + (rng() - 0.5) * 0.7, d[1] + (rng() - 0.5) * 0.5 - 0.04, d[2] + (rng() - 0.5) * 0.7]); q = [q[0] + d[0] * len / n, q[1] + d[1] * len / n, q[2] + d[2] * len / n]; ps.push(q); rs.push(Math.max(0.008, r * (1 - k / n * 0.8))); }
      HH.tube(B, ps, rs, depth === 0 ? 6 : 4, bark, 1);
      if (depth < depthMax) { const nb = 2 + (rng() < 0.4 ? 1 : 0); for (let j = 0; j < nb; j++) { const idx = 2 + Math.floor(rng() * (n - 1)), a = rng() * 6.283; branch(ps[idx], v3.nrm([d[0] + Math.cos(a) * 0.9, d[1] + 0.15 + rng() * 0.45, d[2] + Math.sin(a) * 0.9]), len * (0.48 + rng() * 0.2), rs[idx] * 0.72, depth + 1); } }
      else ends.push(q);
    };
    const top = pts[6], nb = 3 + Math.floor(rng() * 2);
    for (let k = 0; k < nb; k++) { const t = 0.55 + rng() * 0.4, base = [x + lx * t * t, b + H0 * t, z + lz * t * t], a = k / nb * 6.283 + rng() * 0.8; branch(base, v3.nrm([Math.cos(a), 0.5 + rng() * 0.6, Math.sin(a)]), (1.4 + rng() * 1.2) * s, r0 * 0.55, 0); }
    branch(top, v3.nrm([lx, 1.4, lz]), 1.2 * s, r0 * 0.4, 1);
    return ends;
  }
  const arcPts = (xa, xb, ys, yt, n) => { const pts = []; for (let k = 0; k <= n; k++) { const t = k / n, x = xa + (xb - xa) * t, u = Math.abs(t - 0.5) * 2; pts.push([x, ys + (yt - ys) * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.18 * (1 - u))]); } return pts; };

  /* =====================================================================
     DÉCOR
     ===================================================================== */
  let glowTex = null;
  function decorCimetiere(m, B, inst, rng, H, group) {
    const W = m.W, Hh = m.H, CM = m.cm, id = (x, y) => y * W + x, col = K.col, lq = lowQ(), red = CM.red;
    const ST = B('pierre'), MU = B('mur'), GR = B('granit'), MA = B('marbre'), EP = B('epitaphe'), EPG = B('epitapheG'), FE = B('fer'), BO = B('bois'), AR = B('ardoise'), TE = B('terre'), EC = B('ecorce'), OS = B('os'), CB = B('corbeau'), TR = B('trou');
    const flames = H.Buf(), halos = [], signs = K.signs(), ravens = [];
    const warm = red ? [1, 0.25, 0.15] : [1, 0.78, 0.45], fl = (x, y, z, s) => { s = s || 1; K.face(flames, [x - 0.018 * s, y, z], [x + 0.018 * s, y, z], [x + 0.005 * s, y + 0.07 * s, z], [x - 0.005 * s, y + 0.07 * s, z], warm, [0, 0, 1]); K.face(flames, [x, y, z - 0.018 * s], [x, y, z + 0.018 * s], [x, y + 0.07 * s, z + 0.005 * s], [x, y + 0.07 * s, z - 0.005 * s], warm, [1, 0, 0]); };
    const candle = (x, y, z, h, r, lit) => { K.cyl(B('cire'), [x, y, z], [x, y + h, z], r || 0.025, 6, [1, 1, 1], true); if (lit) fl(x, y + h + 0.005, z, (r || 0.025) / 0.025); };
    const tH = (f, x, y) => (x < 0 || y < 0 || x >= W || y >= Hh) ? WALL : m.t[f][id(x, y)];
    const ground = (x, y) => m.t[1][id(x, y)] === FLOOR || (m.t[1][id(x, y)] === WALL && !CM.lower[id(x, y)]) ? SH : 0;   // hauteur du sol d'une case

    /* ---------- mur d'enceinte, grand portail, extérieur ---------- */
    const gate = { x0: 27, x1: 30 };
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      if (!(x === 0 || y === 0 || x === W - 1 || y === Hh - 1)) continue;
      if (y === Hh - 1 && x >= gate.x0 && x <= gate.x1) continue;
      const ix = x === 0 ? 1 : x === W - 1 ? -1 : 0, iy = y === 0 ? 1 : y === Hh - 1 ? -1 : 0;
      const nx = BR.clamp(x + ix, 1, W - 2), ny = BR.clamp(y + iy, 1, Hh - 2), base = ground(nx, ny), top = base + 3.4;
      const X0 = x * C, Z0 = y * C, X1 = X0 + C, Z1 = Z0 + C, th = 0.8;
      const sh = 0.82 + ((x * 7 + y * 13) % 5) * 0.04, cl = [sh, sh, sh * 0.97];
      let bx0 = X0, bx1 = X1, bz0 = Z0, bz1 = Z1;
      if (ix > 0) bx0 = X1 - th; if (ix < 0) bx1 = X0 + th; if (iy > 0) bz0 = Z1 - th; if (iy < 0) bz1 = Z0 + th;
      wbox(MU, bx0, 0, bz0, bx1, top, bz1, cl, 0.5);
      // chaperon (dalles débordantes) + pile tous les 6 m
      wbox(ST, bx0 - 0.08, top, bz0 - 0.08, bx1 + 0.08, top + 0.14, bz1 + 0.08, [0.75, 0.74, 0.72], 0.5);
      const pier = ((iy ? x : y) % 3 === 0) || (ix && iy);
      if (pier) { const px = ix ? (ix > 0 ? X1 - 0.5 : X0 + 0.5) : X0, pz = iy ? (iy > 0 ? Z1 - 0.5 : Z0 + 0.5) : Z0; wbox(MU, px - 0.5, 0, pz - 0.5, px + 0.5, top + 0.45, pz + 0.5, cl, 0.5); wbox(ST, px - 0.6, top + 0.45, pz - 0.6, px + 0.6, top + 0.62, pz + 0.6, [0.72, 0.71, 0.7], 0.5); }
      // lierre qui pend côté intérieur
      if (!lq && rng() < 0.35) for (let k = 0; k < 3; k++) {
        const t = rng() * C, hy = top - 0.1, len = 0.8 + rng() * 1.8;
        const px = iy ? X0 + t : (ix > 0 ? X1 + 0.02 : X0 - 0.02), pz = iy ? (iy > 0 ? Z1 + 0.02 : Z0 - 0.02) : Z0 + t;
        if (iy) K.face(B('lierre'), [px - 0.35, hy - len, pz], [px + 0.35, hy - len, pz], [px + 0.35, hy, pz], [px - 0.35, hy, pz], [0.8, 0.85, 0.8], [0, 0, iy], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        else K.face(B('lierre'), [px, hy - len, pz - 0.35], [px, hy - len, pz + 0.35], [px, hy, pz + 0.35], [px, hy, pz - 0.35], [0.8, 0.85, 0.8], [ix, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      }
    }
    // grand portail en fer forgé, fermé par une chaîne
    {
      const zg = (Hh - 1) * C + 0.35, xa = gate.x0 * C, xb = (gate.x1 + 1) * C, xm = (xa + xb) / 2;
      for (const px of [xa - 0.45, xb + 0.45]) { wbox(MU, px - 0.6, 0, zg - 0.6, px + 0.6, 4.3, zg + 0.6, [0.9, 0.9, 0.88], 0.5); wbox(ST, px - 0.72, 4.3, zg - 0.72, px + 0.72, 4.5, zg + 0.72, [0.8, 0.79, 0.76], 0.5); H.icoBlob(ST, px, 4.85, zg, 0.32, [0.78, 0.77, 0.74], 1.1, 1); }
      const ironC = [1, 1, 1];
      for (let x = xa + 0.08; x < xb - 0.05; x += 0.15) { const t = (x - xa) / (xb - xa), hb = 2.7 + 0.7 * Math.sin(Math.PI * t); wbox(FE, x - 0.016, 0.08, zg - 0.016, x + 0.016, hb, zg + 0.016, ironC, 0.5); K.cyl(FE, [x, hb, zg], [x, hb + 0.14, zg], 0.035, 4, ironC, true, 0.002); }
      for (const yy of [0.18, 1.35, 2.5]) wbox(FE, xa, yy, zg - 0.03, xb, yy + 0.06, zg + 0.03, ironC, 0.5);
      for (let k = 0; k < 24; k++) { const t = (k + 0.5) / 24, x = xa + (xb - xa) * t, y0 = 2.56 + 0.7 * Math.sin(Math.PI * t) * 0.9; H.tube(FE, [[x - 0.12, 2.56, zg], [x - 0.05, y0 * 0.98, zg], [x + 0.06, y0, zg], [x + 0.12, 2.56, zg]], [0.012, 0.012, 0.012, 0.012], 4, ironC, 1); }
      wbox(FE, xm - 0.04, 0.08, zg - 0.04, xm + 0.04, 3.3, zg + 0.04, ironC, 0.5);
      // chaîne et cadenas
      for (let k = 0; k < 9; k++) { const a = (k - 4) * 0.11, cy = 1.25 + Math.cos(a * 3) * 0.15 - Math.abs(k - 4) * 0.03; H.tube(FE, [[xm + a - 0.04, cy, zg - 0.07], [xm + a, cy + 0.035, zg - 0.07], [xm + a + 0.04, cy, zg - 0.07], [xm + a, cy - 0.035, zg - 0.07], [xm + a - 0.04, cy, zg - 0.07]], [0.009, 0.009, 0.009, 0.009, 0.009], 4, [0.8, 0.75, 0.7], 1); }
      wbox(FE, xm - 0.07, 0.95, zg - 0.12, xm + 0.07, 1.1, zg - 0.06, [0.7, 0.6, 0.4], 0.5);
      // arc en fer avec l'inscription
      const ap = []; for (let k = 0; k <= 16; k++) { const t = k / 16; ap.push([xa - 0.45 + (xb - xa + 0.9) * t, 4.5 + 1.1 * Math.sin(Math.PI * t), zg]); }
      H.tube(FE, ap, ap.map(() => 0.04), 5, ironC, 1);
      signs.add({ text: 'CIMETIÈRE DU VIEUX-BOURG', bg: '#15171a', fg: '#c9c2b0', w: 4.2, h: 0.55, x: xm, y: 4.95, z: zg - 0.06, ry: Math.PI, font: "Georgia, 'Times New Roman', serif" });
      signs.add({ text: 'FERMETURE DES PORTES À 18 H', sub: 'Le gardien décline toute responsabilité', bg: '#e6e0cf', fg: '#2a2620', w: 1.1, h: 0.28, x: xa - 1.12, y: 1.65, z: zg - 0.62, ry: Math.PI });
      // encadrement de la petite porte (sortie)
      const e = m.exit, ex = (e.cx + 0.5) * C, ez = (e.cy + 1) * C;
      wbox(ST, ex - 1.08, 0, ez - 0.16, ex - 0.86, 2.95, ez + 0.05, [0.85, 0.84, 0.8], 0.5); wbox(ST, ex + 0.86, 0, ez - 0.16, ex + 1.08, 2.95, ez + 0.05, [0.85, 0.84, 0.8], 0.5);
      wbox(ST, ex - 1.18, 2.95, ez - 0.22, ex + 1.18, 3.18, ez + 0.05, [0.8, 0.79, 0.76], 0.5);
    }
    // sol extérieur, route devant le portail, arbres morts au-delà du mur
    { const O = B('f2'), Wm = W * C, Hm = Hh * C, R = 70;
      const q = (x0, z0, x1, z1) => H.quad(O, [[x0, -0.03, z1], [x1, -0.03, z1], [x1, -0.03, z0], [x0, -0.03, z0]], [0, 1, 0], [[x0 / 4, z1 / 4], [x1 / 4, z1 / 4], [x1 / 4, z0 / 4], [x0 / 4, z0 / 4]], 0.55);
      q(-R, -R, Wm + R, 0); q(-R, Hm, Wm + R, Hm + R); q(-R, 0, 0, Hm); q(Wm, 0, Wm + R, Hm);
      const road = B('f1'); H.quad(road, [[-R, -0.02, Hm + 9], [Wm + R, -0.02, Hm + 9], [Wm + R, -0.02, Hm + 2.5], [-R, -0.02, Hm + 2.5]], [0, 1, 0], [[-R / 2, (Hm + 9) / 2], [(Wm + R) / 2, (Hm + 9) / 2], [(Wm + R) / 2, (Hm + 2.5) / 2], [-R / 2, (Hm + 2.5) / 2]], 0.7);
      for (let k = 0; k < 26; k++) {
        const side = k % 4, t = rng(), d = 3 + rng() * 22;
        const x = side === 0 ? -d : side === 1 ? Wm + d : t * Wm, z = side === 2 ? -d : side === 3 ? Hm + 12 + d : t * Hm;
        deadTree(EC, x, 0, z, rng, 1.3 + rng() * 0.7, 1);
      }
      // vieux réverbère éteint sur la route, de l'autre côté
      const lx = 64, lz = Hm + 10.5; K.cyl(FE, [lx, 0, lz], [lx, 4.2, lz], 0.07, 8, [1, 1, 1]); wbox(FE, lx - 0.25, 4.2, lz - 0.25, lx + 0.25, 4.25, lz + 0.25, [1, 1, 1], 0.5); wbox(B('verreMort'), lx - 0.2, 3.75, lz - 0.2, lx + 0.2, 4.2, lz + 0.2, [1, 1, 1], 0.5);
    }

    /* ---------- balustrades (bord de la terrasse haute) et garde-corps de la chapelle ---------- */
    for (const r of m.rails || []) {
      const y = r.f * SH, X0 = r.x * C, Z0 = r.y * C, inside = m.indoor[r.f][r.U];
      let ax, az, bx, bz; const d = 0.2;
      if (r.dx === 1) { ax = bx = X0 + C - d; az = Z0; bz = Z0 + C; } else if (r.dx === -1) { ax = bx = X0 + d; az = Z0; bz = Z0 + C; }
      else if (r.dy === 1) { az = bz = Z0 + C - d; ax = X0; bx = X0 + C; } else { az = bz = Z0 + d; ax = X0; bx = X0 + C; }
      const ex = r.dx ? 0.2 : 0, ez = r.dy ? 0.2 : 0;
      if (inside) {   // fer forgé
        wbox(FE, Math.min(ax, bx) - ex * 0.2, y + 0.95, Math.min(az, bz) - ez * 0.2, Math.max(ax, bx) + ex * 0.2, y + 1.0, Math.max(az, bz) + ez * 0.2, [1, 1, 1], 0.5);
        wbox(FE, Math.min(ax, bx) - ex * 0.1, y + 0.08, Math.min(az, bz) - ez * 0.1, Math.max(ax, bx) + ex * 0.1, y + 0.12, Math.max(az, bz) + ez * 0.1, [1, 1, 1], 0.5);
        for (let k = 0; k < 13; k++) { const t = (k + 0.5) / 13, px = ax + (bx - ax) * t, pz = az + (bz - az) * t; wbox(FE, px - 0.013, y, pz - 0.013, px + 0.013, y + 0.96, pz + 0.013, [1, 1, 1], 0.5); if (k % 3 === 1) H.tube(FE, [[px, y + 0.45, pz], [px + (r.dy ? 0.06 : 0), y + 0.55, pz + (r.dx ? 0.06 : 0)], [px, y + 0.65, pz]], [0.01, 0.01, 0.01], 4, [1, 1, 1], 1); }
        continue;
      }
      const c0 = [0.78, 0.77, 0.74];
      wbox(ST, Math.min(ax, bx) - ex, y, Math.min(az, bz) - ez, Math.max(ax, bx) + ex, y + 0.2, Math.max(az, bz) + ez, c0, 0.5);
      wbox(ST, Math.min(ax, bx) - ex * 1.1, y + 0.86, Math.min(az, bz) - ez * 1.1, Math.max(ax, bx) + ex * 1.1, y + 1.0, Math.max(az, bz) + ez * 1.1, [0.82, 0.81, 0.78], 0.5);
      for (let k = 0; k < 5; k++) { const t = (k + 0.5) / 5, px = ax + (bx - ax) * t, pz = az + (bz - az) * t; K.cyl(ST, [px, y + 0.2, pz], [px, y + 0.5, pz], 0.06, 7, c0, false, 0.11); K.cyl(ST, [px, y + 0.5, pz], [px, y + 0.86, pz], 0.11, 7, c0, false, 0.055); }
      if ((r.x + r.y) % 3 === 0) wbox(ST, (ax + bx) / 2 - 0.24 + (r.dy ? -0.8 : 0), y, (az + bz) / 2 - 0.24 + (r.dx ? -0.8 : 0), (ax + bx) / 2 + 0.24 + (r.dy ? -0.8 : 0), y + 1.08, (az + bz) / 2 + 0.24 + (r.dx ? -0.8 : 0), c0, 0.5);
    }

    /* ---------- chapelle gothique ---------- */
    {
      const ch = CM.chapel, XA = ch.X0 * C, XB = (ch.X1 + 1) * C, ZA = ch.Y0 * C, ZB = (ch.Y1 + 1) * C, top = 2 * SH, xm = (XA + XB) / 2, half = (XB - XA) / 2, pitch = 1.15, ridge = top + half * pitch, ov = 0.6;
      const slate = [0.82, 0.85, 0.92], wood = [0.55, 0.5, 0.45], stc = [0.9, 0.88, 0.84];
      // toit d'ardoise : deux pans passant par l'arête extérieure du haut des murs (pas de jour entre mur et toit)
      for (const sg of [-1, 1]) {
        const xe = sg < 0 ? XA - ov : XB + ov, ye = top - ov * pitch;
        K.face(AR, [xe, ye, ZA - ov], [xe, ye, ZB + ov], [xm, ridge, ZB + ov], [xm, ridge, ZA - ov], slate, [sg * pitch, 1, 0], 0.5);
        K.face(BO, [xe, ye - 0.06, ZA - ov], [xe, ye - 0.06, ZB + ov], [xm, ridge - 0.06, ZB + ov], [xm, ridge - 0.06, ZA - ov], wood, [-sg * pitch, -1, 0], 0.5);
        K.face(BO, [xe, ye - 0.06, ZA - ov], [xe, ye - 0.06, ZB + ov], [xe, ye + 0.02, ZB + ov], [xe, ye + 0.02, ZA - ov], wood, [sg, 0, 0], 0.5);
      }
      K.bar(AR, [xm, ridge + 0.05, ZA - ov], [xm, ridge + 0.05, ZB + ov], 0.22, 0.18, [0.6, 0.62, 0.66]);
      // pignons (avant et arrière), épaisseur du mur
      for (const [z0, z1, out] of [[ZB - C, ZB, 1], [ZA, ZA + C, -1]]) {
        for (const [zz, n] of [[out > 0 ? z1 : z0, out], [out > 0 ? z0 : z1, -out]]) tri3(ST, [XA, top, zz], [XB, top, zz], [xm, ridge, zz], [0, 0, n], [XA / 2, top / 2], [XB / 2, top / 2], [xm / 2, ridge / 2], stc);
        // rampants en pierre (couronnement du pignon)
        K.bar(ST, [XA - 0.1, top + 0.05, (z0 + z1) / 2], [xm, ridge + 0.2, (z0 + z1) / 2], 0.6, 0.3, [0.8, 0.78, 0.75]); K.bar(ST, [XB + 0.1, top + 0.05, (z0 + z1) / 2], [xm, ridge + 0.2, (z0 + z1) / 2], 0.6, 0.3, [0.8, 0.78, 0.75]);
      }
      // croix sur le pignon arrière
      wbox(ST, xm - 0.08, ridge + 0.2, ZA + 0.9, xm + 0.08, ridge + 1.6, ZA + 1.1, stc, 0.5); wbox(ST, xm - 0.45, ridge + 1.0, ZA + 0.9, xm + 0.45, ridge + 1.16, ZA + 1.1, stc, 0.5);
      // rosace (dehors et dedans)
      const ry0 = 11.6, rr = 1.65, VI = B('vitrail');
      for (const [zz, n] of [[ZB + 0.03, 1], [ZB - C - 0.03, -1]]) {
        const o = VI.p.length / 3; VI.p.push(xm, ry0, zz); VI.n.push(0, 0, n); VI.u.push(0.5, 0.5); VI.c.push(1, 1, 1);
        for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; VI.p.push(xm + Math.cos(a) * rr, ry0 + Math.sin(a) * rr, zz); VI.n.push(0, 0, n); VI.u.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5); VI.c.push(1, 1, 1); }
        for (let k = 0; k < 24; k++) { if (n > 0) VI.i.push(o, o + 1 + k, o + 2 + k); else VI.i.push(o, o + 2 + k, o + 1 + k); }
        const ring = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; ring.push([xm + Math.cos(a) * (rr + 0.12), ry0 + Math.sin(a) * (rr + 0.12), zz + n * 0.06]); }
        H.tube(ST, ring, ring.map(() => 0.13), 6, stc, 1);
      }
      // contreforts
      for (const zc of [12, 16, 20, 24, 28, 32]) for (const sg of [-1, 1]) {
        const xw = sg < 0 ? XA : XB, xo = xw + sg * 0.9;
        wbox(ST, Math.min(xw, xo), SH, zc - 0.35, Math.max(xw, xo), SH + 2.6, zc + 0.35, stc, 0.5);
        wbox(ST, Math.min(xw, xw + sg * 0.6), SH + 2.6, zc - 0.33, Math.max(xw, xw + sg * 0.6), SH + 3.5, zc + 0.33, stc, 0.5);
        K.face(ST, [xo, SH + 2.6, zc - 0.35], [xo, SH + 2.6, zc + 0.35], [xw + sg * 0.6, SH + 2.9, zc + 0.35], [xw + sg * 0.6, SH + 2.9, zc - 0.35], [0.8, 0.78, 0.75], [sg, 1, 0]);
        K.face(ST, [xw + sg * 0.6, SH + 3.5, zc - 0.33], [xw + sg * 0.6, SH + 3.5, zc + 0.33], [xw, SH + 3.95, zc + 0.33], [xw, SH + 3.95, zc - 0.33], [0.8, 0.78, 0.75], [sg, 1, 0]);
      }
      // clocheton sur le faîtage + flèche d'ardoise + croix ; corbeaux qui tournent autour
      { const zt = ZB - 4.2, b0 = ridge - 1.15 * pitch - 0.03, b1 = ridge + 3.0;
        wbox(ST, xm - 1.15, b0, zt - 1.15, xm + 1.15, b1, zt + 1.15, stc, 0.5);
        for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const fx = xm + nx * 1.16, fz = zt + nz * 1.16;
          if (nx) K.face(TR, [fx, b1 - 2.0, zt - 0.55], [fx, b1 - 2.0, zt + 0.55], [fx, b1 - 0.4, zt + 0.55], [fx, b1 - 0.4, zt - 0.55], [1, 1, 1], [nx, 0, 0]);
          else K.face(TR, [xm - 0.55, b1 - 2.0, fz], [xm + 0.55, b1 - 2.0, fz], [xm + 0.55, b1 - 0.4, fz], [xm - 0.55, b1 - 0.4, fz], [1, 1, 1], [0, 0, nz]);
          for (let k = 0; k < 5; k++) { const yy = b1 - 1.85 + k * 0.3; if (nx) wbox(BO, fx - 0.04, yy, zt - 0.55, fx + 0.02, yy + 0.08, zt + 0.55, wood, 0.5); else wbox(BO, xm - 0.55, yy, fz - 0.04, xm + 0.55, yy + 0.08, fz + 0.02, wood, 0.5); }
        }
        wbox(ST, xm - 1.3, b1, zt - 1.3, xm + 1.3, b1 + 0.22, zt + 1.3, [0.8, 0.78, 0.75], 0.5);
        const apex = [xm, b1 + 7.5, zt], N = 8, r0 = 1.45;
        for (let k = 0; k < N; k++) { const a0 = (k + 0.5) / N * Math.PI * 2, a1 = (k + 1.5) / N * Math.PI * 2, p0 = [xm + Math.cos(a0) * r0, b1 + 0.22, zt + Math.sin(a0) * r0], p1 = [xm + Math.cos(a1) * r0, b1 + 0.22, zt + Math.sin(a1) * r0], mid = (a0 + a1) / 2; tri3(AR, p0, p1, apex, v3.nrm([Math.cos(mid), 0.2, Math.sin(mid)]), [0, 0], [1.4, 0], [0.7, 3.8], slate); }
        wbox(FE, xm - 0.04, b1 + 7.4, zt - 0.04, xm + 0.04, b1 + 8.6, zt + 0.04, [1, 1, 1], 0.5); wbox(FE, xm - 0.32, b1 + 8.1, zt - 0.04, xm + 0.32, b1 + 8.18, zt + 0.04, [1, 1, 1], 0.5);
        // vol de corbeaux autour de la flèche
        const fB = H.Buf();
        for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + rng() * 0.6, rad = 7 + rng() * 6; raven(fB, Math.cos(a) * rad, (rng() - 0.5) * 3, Math.sin(a) * rad, -a, 2.4, 'vol'); }
        const flock = new THREE.Mesh(H.geo(fB), new THREE.MeshStandardMaterial({ color: 0x09090c, roughness: 0.5, side: THREE.DoubleSide }));
        flock.position.set(xm, b1 + 6, zt); flock.frustumCulled = false;
        flock.onBeforeRender = () => { const t = performance.now() / 1000; flock.rotation.y = t * 0.22; flock.position.y = b1 + 6 + Math.sin(t * 0.7) * 0.8; flock.updateMatrix(); };
        group.add(flock);
      }
      // portail : colonnettes, arc brisé, tympan, vantaux ouverts contre la façade, seuil
      { const xa = 28 * C, xb = 30 * C, ys = SH + 2.7, yt = SH + 3.65, a = arcPts(xa, xb, ys, yt, 12);
        for (const [zz, n] of [[ZB, 1], [ZB - C, -1]]) {
          for (let k = 0; k + 1 < a.length; k++) { const p = a[k], q = a[k + 1]; K.face(ST, [p[0], p[1], zz], [q[0], q[1], zz], [q[0], top, zz], [p[0], top, zz], stc, [0, 0, n]); }
          for (const rr2 of [0, 0.16, 0.32]) H.tube(ST, a.map(p => [xm + (p[0] - xm) * (1 + rr2 * 0.25), p[1] + rr2, zz + n * 0.08]), a.map(() => 0.09), 6, [0.82, 0.8, 0.77], 1);
          for (const px of [xa + 0.1, xb - 0.1]) K.cyl(ST, [px, SH, zz + n * 0.1], [px, ys, zz + n * 0.1], 0.11, 8, [0.85, 0.83, 0.8], true);
        }
        for (let k = 0; k + 1 < a.length; k++) { const p = a[k], q = a[k + 1]; K.face(ST, [p[0], p[1], ZB - C], [q[0], q[1], ZB - C], [q[0], q[1], ZB], [p[0], p[1], ZB], [0.7, 0.68, 0.65], [0, -1, 0]); }
        for (const [hx, s] of [[xa, -1], [xb, 1]]) { wbox(BO, Math.min(hx, hx + s * 1.95), SH, ZB + 0.02, Math.max(hx, hx + s * 1.95), SH + 2.75, ZB + 0.1, [0.6, 0.52, 0.45], 0.5); for (const yy of [SH + 0.5, SH + 2.2]) wbox(FE, Math.min(hx, hx + s * 1.8), yy, ZB + 0.1, Math.max(hx, hx + s * 1.8), yy + 0.07, ZB + 0.13, [1, 1, 1], 0.5); }
        wbox(ST, xa, SH, ZB - 0.4, xb, SH + 0.05, ZB + 0.3, [0.85, 0.83, 0.8], 0.5);
        signs.add({ text: 'CHAPELLE SAINT-LAZARE', bg: '#4a463e', fg: '#d8d0bc', w: 2.4, h: 0.4, x: xm, y: top + 0.55, z: ZB + 0.04, ry: 0, border: false, font: "Georgia, 'Times New Roman', serif" });
      }
      // intérieur : charpente (entraits, poinçons, arbalétriers), colonnes engagées, statues voilées, toiles d'araignée
      for (const zc of [14, 20, 26, 32]) {
        K.bar(BO, [XA + C, top + 0.15, zc], [XB - C, top + 0.15, zc], 0.26, 0.3, wood);
        K.bar(BO, [xm, top + 0.3, zc], [xm, ridge - 0.4, zc], 0.22, 0.22, wood);
        for (const sg of [-1, 1]) { const xw = sg < 0 ? XA + C : XB - C; K.bar(BO, [xw, top + 0.3, zc], [xm + sg * 0.15, ridge - 0.45, zc], 0.2, 0.22, wood); K.bar(BO, [xm, top + 1.6, zc], [xm + sg * 3.2, top + 0.35, zc], 0.14, 0.14, wood); }
      }
      K.bar(BO, [xm, ridge - 0.5, ZA + C], [xm, ridge - 0.5, ZB - C], 0.24, 0.24, wood);
      for (const zc of [12, 16, 20, 24, 28, 32]) for (const xw of [XA + C + 0.12, XB - C - 0.12]) { K.cyl(ST, [xw, SH, zc], [xw, top, zc], 0.17, 8, stc, false); wbox(ST, xw - 0.22, top - 0.3, zc - 0.22, xw + 0.22, top - 0.1, zc + 0.22, stc, 0.5); }
      for (const sx of [-1, 1]) { const px = xm + sx * 4.6, pz = ZA + C + 0.45; wbox(ST, px - 0.35, SH + 2.1, pz - 0.3, px + 0.35, SH + 2.3, pz + 0.3, stc, 0.5); angel(ST, frameAt(px, SH + 2.3, pz, 0), 0.95, [0.7, 0.7, 0.68], false); }
      if (!lq) { const TO = B('toile'); for (const [x, z, sx, sz] of [[XA + C, ZA + C, 1, 1], [XB - C, ZA + C, -1, 1], [XA + C, ZB - C, 1, -1], [XB - C, ZB - C, -1, -1]]) polyFan(TO, [[x, top - 1.1, z], [x + sx * 1.3, top - 0.02, z], [x, top - 0.02, z + sz * 1.3]], [0.9, 0.9, 0.9], [[0, 0], [1, 1], [0, 1]]); }
    }

    /* ---------- crypte : voûtes en berceau, nervures, porte du mur de soutènement, alcôves ---------- */
    {
      const VB = B('ci'), isC = (x, y) => x > 0 && y > 0 && x < W - 1 && y < Hh - 1 && CM.crypt[id(x, y)] && m.t[0][id(x, y)] === FLOOR && m.indoor[0][id(x, y)];
      const ys = 2.75, yt = 3.66;
      const vault = (x, y, alongZ) => {
        const X0 = x * C, Z0 = y * C, n = 7, pts = [];
        for (let k = 0; k <= n; k++) { const a = k / n * Math.PI; pts.push([1 - Math.cos(a), ys + Math.sin(a) * (yt - ys)]); }
        for (let k = 0; k < n; k++) {
          const p = pts[k], q = pts[k + 1], mx = (p[0] + q[0]) / 2 - 1, my = (p[1] + q[1]) / 2;
          const nn = [-(mx), -(my - ys) * 1.2, 0];
          if (alongZ) K.face(VB, [X0 + p[0], p[1], Z0], [X0 + q[0], q[1], Z0], [X0 + q[0], q[1], Z0 + C], [X0 + p[0], p[1], Z0 + C], [0.9, 0.9, 0.9], nn, 0.5);
          else K.face(VB, [X0, p[1], Z0 + p[0]], [X0, q[1], Z0 + q[0]], [X0 + C, q[1], Z0 + q[0]], [X0 + C, p[1], Z0 + p[0]], [0.9, 0.9, 0.9], [0, nn[1], nn[0]], 0.5);
        }
        return pts;
      };
      for (let y = 2; y < Hh - 2; y++) for (let x = 2; x < W - 2; x++) {
        if (!isC(x, y)) continue;
        const wx = tH(0, x - 1, y) === WALL && tH(0, x + 1, y) === WALL, wz = tH(0, x, y - 1) === WALL && tH(0, x, y + 1) === WALL;
        if (wx && !wz) { const pts = vault(x, y, true); for (const dz of [-1, 1]) if (!(isC(x, y + dz) && tH(0, x - 1, y + dz) === WALL && tH(0, x + 1, y + dz) === WALL)) { const zz = dz < 0 ? y * C : (y + 1) * C; for (let k = 0; k + 1 < pts.length; k++) { const p = pts[k], q = pts[k + 1]; K.face(VB, [x * C + p[0], p[1], zz], [x * C + q[0], q[1], zz], [x * C + q[0], 3.7, zz], [x * C + p[0], 3.7, zz], [0.85, 0.85, 0.85], [0, 0, dz]); } } }
        else if (wz && !wx) { const pts = vault(x, y, false); for (const dx of [-1, 1]) if (!(isC(x + dx, y) && tH(0, x + dx, y - 1) === WALL && tH(0, x + dx, y + 1) === WALL)) { const xx = dx < 0 ? x * C : (x + 1) * C; for (let k = 0; k + 1 < pts.length; k++) { const p = pts[k], q = pts[k + 1]; K.face(VB, [xx, p[1], y * C + p[0]], [xx, q[1], y * C + q[0]], [xx, 3.7, y * C + q[0]], [xx, 3.7, y * C + p[0]], [0.85, 0.85, 0.85], [dx, 0, 0]); } } }
        else if (!wx && !wz) {   // salles : nervures sur la grille des cases
          if (isC(x + 1, y)) wbox(ST, (x + 1) * C - 0.13, 3.42, y * C, (x + 1) * C + 0.13, 3.7, (y + 1) * C, [0.55, 0.53, 0.5], 0.5);
          if (isC(x, y + 1)) wbox(ST, x * C, 3.42, (y + 1) * C - 0.13, (x + 1) * C, 3.7, (y + 1) * C + 0.13, [0.55, 0.53, 0.5], 0.5);
        }
        // toiles d'araignée dans les angles
        if (!lq) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          if (tH(0, x + dx, y) !== WALL || tH(0, x, y + dy) !== WALL || rng() > 0.4) continue;
          const cxw = dx < 0 ? x * C : (x + 1) * C, czw = dy < 0 ? y * C : (y + 1) * C, top2 = wx || wz ? ys + 0.1 : 3.66, s = 0.6 + rng() * 0.5;
          polyFan(B('toile'), [[cxw, top2 - s, czw], [cxw - dx * s, top2, czw], [cxw, top2, czw - dy * s]], [0.85, 0.85, 0.85], [[0, 0], [1, 1], [0, 1]]);
        }
      }
      // porte de la crypte dans le mur de soutènement (arc, grille ouverte, inscription)
      const dx0 = 14 * C, zf = 31 * C;
      { const a = arcPts(dx0, dx0 + C, 2.3, 3.0, 10), stc = [0.8, 0.78, 0.75];
        for (const [zz, n] of [[zf + 0.01, 1], [zf - 0.01, -1]]) for (let k = 0; k + 1 < a.length; k++) { const p = a[k], q = a[k + 1]; K.face(ST, [p[0], p[1], zz], [q[0], q[1], zz], [q[0], 3.7, zz], [p[0], 3.7, zz], stc, [0, 0, n]); }
        H.tube(ST, a.map(p => [p[0], p[1] + 0.08, zf + 0.08]), a.map(() => 0.12), 6, stc, 1);
        for (const px of [dx0 + 0.1, dx0 + C - 0.1]) wbox(ST, px - 0.16, 0, zf - 0.02, px + 0.16, 2.35, zf + 0.18, stc, 0.5);
        for (let k = 0; k < 7; k++) { const x = dx0 + C + 0.1 + k * 0.15; wbox(FE, x - 0.015, 0.05, zf + 0.1, x + 0.015, 2.3, zf + 0.13, [1, 1, 1], 0.5); }
        for (const yy of [0.3, 1.2, 2.1]) wbox(FE, dx0 + C + 0.05, yy, zf + 0.09, dx0 + C + 1.05, yy + 0.05, zf + 0.14, [1, 1, 1], 0.5);
        signs.add({ text: 'CRYPTE — OSSUAIRE', bg: '#5b564d', fg: '#1d1a16', w: 1.8, h: 0.34, x: dx0 + 1, y: 3.35, z: zf + 0.04, ry: 0, border: false, font: "Georgia, 'Times New Roman', serif" });
      }
      signs.add({ text: 'MEMENTO MORI', bg: '#3a342b', fg: '#cbbf9f', w: 1.6, h: 0.36, x: 14.5 * C, y: 3.05, z: 6 * C + 0.04, ry: 0, border: false, font: "Georgia, 'Times New Roman', serif" });
      signs.add({ text: 'ICI REPOSENT LES ANCIENS', sub: 'Restes exhumés de l\'ancien cimetière, 1789', bg: '#47423a', fg: '#d2c7ab', w: 1.6, h: 0.42, x: 12 * C + 0.04, y: 2.4, z: 8.5 * C, ry: Math.PI / 2, border: false, font: "Georgia, 'Times New Roman', serif" });
    }

    /* ---------- mausolées et chapelle funéraire ---------- */
    for (const M of CM.maus) {
      const b = M.f * SH, X0 = M.x0 * C, X1 = (M.x1 + 1) * C, Z0 = M.y0 * C, Z1 = (M.y1 + 1) * C, MAT = M.mat === 'marbre' ? MA : ST, t = M.tint, cl = [t, t, t * 0.97], wallH = 3.3;
      const dx = M.dir === 2 ? 1 : M.dir === 3 ? -1 : 0, dz = M.dir === 0 ? 1 : M.dir === 1 ? -1 : 0, alongZ = dz !== 0;
      for (let y = M.y0; y <= M.y1; y++) for (let x = M.x0; x <= M.x1; x++) {
        const i = id(x, y); if (m.t[M.f][i] !== WALL || m.zone[M.f][i] !== ZW.mausolee) continue;
        wbox(MAT, x * C, b, y * C, (x + 1) * C, b + wallH, (y + 1) * C, cl, 0.5);
      }
      wbox(MAT, X0 - 0.12, b, Z0 - 0.12, X1 + 0.12, b + 0.3, Z1 + 0.12, cl.map(v => v * 0.85), 0.5);                // soubassement
      wbox(MAT, X0 - 0.15, b + wallH, Z0 - 0.15, X1 + 0.15, b + wallH + 0.25, Z1 + 0.15, cl.map(v => v * 0.92), 0.5); // corniche
      // plafond intérieur
      for (let y = M.y0; y <= M.y1; y++) for (let x = M.x0; x <= M.x1; x++) { const i = id(x, y); if (m.t[M.f][i] === WALL) continue; K.face(MAT, [x * C, b + wallH, y * C], [(x + 1) * C, b + wallH, y * C], [(x + 1) * C, b + wallH, (y + 1) * C], [x * C, b + wallH, (y + 1) * C], cl.map(v => v * 0.6), [0, -1, 0]); }
      // toit à deux pans (faîtage dans la profondeur) + frontons
      const yb = b + wallH + 0.25, wdt = alongZ ? X1 - X0 : Z1 - Z0, rh = yb + wdt / 2 * 0.5, oo = 0.2;
      if (alongZ) { const xm2 = (X0 + X1) / 2; for (const sg of [-1, 1]) K.face(MAT, [sg < 0 ? X0 - oo : X1 + oo, yb - 0.08, Z0 - oo], [sg < 0 ? X0 - oo : X1 + oo, yb - 0.08, Z1 + oo], [xm2, rh, Z1 + oo], [xm2, rh, Z0 - oo], cl.map(v => v * 0.8), [sg, 1.2, 0]); for (const [zz, n] of [[Z1 + oo, 1], [Z0 - oo, -1]]) tri3(MAT, [X0 - oo, yb - 0.08, zz], [X1 + oo, yb - 0.08, zz], [xm2, rh, zz], [0, 0, n], [0, 0], [1, 0], [0.5, 0.5], cl); }
      else { const zm2 = (Z0 + Z1) / 2; for (const sg of [-1, 1]) K.face(MAT, [X0 - oo, yb - 0.08, sg < 0 ? Z0 - oo : Z1 + oo], [X1 + oo, yb - 0.08, sg < 0 ? Z0 - oo : Z1 + oo], [X1 + oo, rh, zm2], [X0 - oo, rh, zm2], cl.map(v => v * 0.8), [0, 1.2, sg]); for (const [xx, n] of [[X1 + oo, 1], [X0 - oo, -1]]) tri3(MAT, [xx, yb - 0.08, Z0 - oo], [xx, yb - 0.08, Z1 + oo], [xx, rh, zm2], [n, 0, 0], [0, 0], [1, 0], [0.5, 0.5], cl); }
      // porte : encadrement, colonnes, nom de la famille, vantail de bronze entrouvert
      const DX = M.door.x * C, DZ = M.door.y * C, fx = dz ? null : (dx > 0 ? (M.door.x + 1) * C : DX), fz = dz ? (dz > 0 ? (M.door.y + 1) * C : DZ) : null;
      const bronze = [0.42, 0.5, 0.42];
      if (dz) {
        for (const px of [DX + 0.12, DX + C - 0.12]) K.cyl(MAT, [px, b, fz + dz * 0.25], [px, b + wallH, fz + dz * 0.25], 0.16, 10, cl, false);
        wbox(MAT, DX - 0.2, b + 2.55, Math.min(fz, fz + dz * 0.4), DX + C + 0.2, b + wallH, Math.max(fz, fz + dz * 0.4), cl, 0.5);
        wbox(MAT, DX, b + 2.55, M.door.y * C, DX + C, b + wallH, (M.door.y + 1) * C, cl, 0.5);
        // vantaux de bronze grands ouverts, rabattus contre la façade
        wbox(FE, DX - 0.92, b + 0.05, Math.min(fz + dz * 0.03, fz + dz * 0.09), DX - 0.02, b + 2.5, Math.max(fz + dz * 0.03, fz + dz * 0.09), bronze, 0.5);
        wbox(FE, DX + C + 0.02, b + 0.05, Math.min(fz + dz * 0.03, fz + dz * 0.09), DX + C + 0.92, b + 2.5, Math.max(fz + dz * 0.03, fz + dz * 0.09), bronze, 0.5);
        signs.add({ text: M.name, bg: M.mat === 'marbre' ? '#bdb8ac' : '#7a756a', fg: '#25211c', w: 1.9, h: 0.3, x: DX + 1, y: b + 2.95, z: fz + dz * 0.42, ry: dz > 0 ? 0 : Math.PI, border: false, font: "Georgia, 'Times New Roman', serif" });
      } else {
        for (const pz of [DZ + 0.12, DZ + C - 0.12]) K.cyl(MAT, [fx + dx * 0.25, b, pz], [fx + dx * 0.25, b + wallH, pz], 0.16, 10, cl, false);
        wbox(MAT, Math.min(fx, fx + dx * 0.4), b + 2.55, DZ - 0.2, Math.max(fx, fx + dx * 0.4), b + wallH, DZ + C + 0.2, cl, 0.5);
        wbox(MAT, M.door.x * C, b + 2.55, DZ, (M.door.x + 1) * C, b + wallH, DZ + C, cl, 0.5);
        wbox(FE, Math.min(fx + dx * 0.03, fx + dx * 0.09), b + 0.05, DZ - 0.92, Math.max(fx + dx * 0.03, fx + dx * 0.09), b + 2.5, DZ - 0.02, bronze, 0.5);
        wbox(FE, Math.min(fx + dx * 0.03, fx + dx * 0.09), b + 0.05, DZ + C + 0.02, Math.max(fx + dx * 0.03, fx + dx * 0.09), b + 2.5, DZ + C + 0.92, bronze, 0.5);
        signs.add({ text: M.name, bg: M.mat === 'marbre' ? '#bdb8ac' : '#7a756a', fg: '#25211c', w: 1.9, h: 0.3, x: fx + dx * 0.42, y: b + 2.95, z: DZ + 1, ry: dx > 0 ? Math.PI / 2 : -Math.PI / 2, border: false, font: "Georgia, 'Times New Roman', serif" });
      }
      // sommet : croix, urne ou ange
      const cxr = (X0 + X1) / 2, czr = (Z0 + Z1) / 2, rt = rh;
      if (M.style === 0) { wbox(MAT, cxr - 0.07, rt - 0.1, czr - 0.07, cxr + 0.07, rt + 1.0, czr + 0.07, cl, 0.5); wbox(MAT, cxr - 0.35, rt + 0.55, czr - 0.07, cxr + 0.35, rt + 0.69, czr + 0.07, cl, 0.5); }
      else if (M.style === 1) { K.cyl(MAT, [cxr, rt - 0.1, czr], [cxr, rt + 0.2, czr], 0.2, 10, cl, true); H.icoBlob(MAT, cxr, rt + 0.45, czr, 0.25, cl, 1.25, 1); K.cyl(MAT, [cxr, rt + 0.7, czr], [cxr, rt + 0.82, czr], 0.12, 8, cl, true); }
      else angel(MAT, frameAt(cxr, rt - 0.2, czr, dz ? (dz > 0 ? 0 : Math.PI) : (dx > 0 ? Math.PI / 2 : -Math.PI / 2)), 0.75, cl, true);
      // intérieur : vitrail du fond, plaques, bougies
      if (!M.long) {
        const bx = dz ? DX + 1 : (dx > 0 ? X0 + C : X1 - C), bz = dz ? (dz > 0 ? Z0 + C : Z1 - C) : DZ + 1, n = dz ? [0, 0, dz] : [dx, 0, 0];
        const VI = B('vitrail');
        if (dz) { K.face(VI, [bx - 0.35, b + 1.3, bz + dz * 0.01], [bx + 0.35, b + 1.3, bz + dz * 0.01], [bx + 0.35, b + 2.6, bz + dz * 0.01], [bx - 0.35, b + 2.6, bz + dz * 0.01], [0.9, 0.9, 0.9], n, [[0.2, 0], [0.8, 0], [0.8, 1], [0.2, 1]]); K.face(VI, [bx - 0.35, b + 1.3, bz - dz * C - dz * 0.01], [bx + 0.35, b + 1.3, bz - dz * C - dz * 0.01], [bx + 0.35, b + 2.6, bz - dz * C - dz * 0.01], [bx - 0.35, b + 2.6, bz - dz * C - dz * 0.01], [0.6, 0.6, 0.6], [0, 0, -dz], [[0.2, 0], [0.8, 0], [0.8, 1], [0.2, 1]]); }
        else { K.face(VI, [bx + dx * 0.01, b + 1.3, bz - 0.35], [bx + dx * 0.01, b + 1.3, bz + 0.35], [bx + dx * 0.01, b + 2.6, bz + 0.35], [bx + dx * 0.01, b + 2.6, bz - 0.35], [0.9, 0.9, 0.9], n, [[0.2, 0], [0.8, 0], [0.8, 1], [0.2, 1]]); K.face(VI, [bx - dx * C - dx * 0.01, b + 1.3, bz - 0.35], [bx - dx * C - dx * 0.01, b + 1.3, bz + 0.35], [bx - dx * C - dx * 0.01, b + 2.6, bz + 0.35], [bx - dx * C - dx * 0.01, b + 2.6, bz - 0.35], [0.6, 0.6, 0.6], [-dx, 0, 0], [[0.2, 0], [0.8, 0], [0.8, 1], [0.2, 1]]); }
        // autel adossé au fond (même boîte que la collision)
        const [ax0, az0, ax1, az1] = M.altar;
        wbox(MA, ax0, b, az0, ax1, b + 0.95, az1, [0.85, 0.84, 0.8], 0.5); wbox(MA, ax0 - 0.05, b + 0.95, az0 - 0.05, ax1 + 0.05, b + 1.02, az1 + 0.05, [0.9, 0.89, 0.86], 0.5);
        const cxa = (ax0 + ax1) / 2, cza = (az0 + az1) / 2;
        wbox(FE, cxa - 0.02, b + 1.02, cza - 0.02, cxa + 0.02, b + 1.5, cza + 0.02, [0.8, 0.7, 0.4], 0.5); wbox(FE, cxa - (dz ? 0.12 : 0.02), b + 1.33, cza - (dz ? 0.02 : 0.12), cxa + (dz ? 0.12 : 0.02), b + 1.37, cza + (dz ? 0.02 : 0.12), [0.8, 0.7, 0.4], 0.5);
        for (const s of [-0.45, 0.45]) candle(cxa + (dz ? s : 0), b + 1.02, cza + (dz ? 0 : s), 0.2 + rng() * 0.1, 0.03, M.lit);
      }
    }

    /* ---------- maison du gardien : toit, cheminée, plafond, porte ---------- */
    if (CM.house) {
      const h = CM.house, X0 = h.x0 * C, X1 = (h.x1 + 1) * C, Z0 = h.y0 * C, Z1 = (h.y1 + 1) * C, zm = (Z0 + Z1) / 2, yb = SH, rh = SH + (Z1 - Z0) / 2 * 0.72, oo = 0.45;
      for (const sg of [-1, 1]) { K.face(AR, [X0 - oo, yb - 0.3, sg < 0 ? Z0 - oo : Z1 + oo], [X1 + oo, yb - 0.3, sg < 0 ? Z0 - oo : Z1 + oo], [X1 + oo, rh, zm], [X0 - oo, rh, zm], [0.72, 0.62, 0.58], [0, 1, sg * 0.72]); K.face(BO, [X0 - oo, yb - 0.36, sg < 0 ? Z0 - oo : Z1 + oo], [X1 + oo, yb - 0.36, sg < 0 ? Z0 - oo : Z1 + oo], [X1 + oo, rh - 0.06, zm], [X0 - oo, rh - 0.06, zm], [0.5, 0.45, 0.4], [0, -1, -sg]); }
      for (const [xx, n] of [[X0, -1], [X1, 1]]) { tri3(ST, [xx, yb, Z0], [xx, yb, Z1], [xx, rh, zm], [n, 0, 0], [Z0 / 2, yb / 2], [Z1 / 2, yb / 2], [zm / 2, rh / 2], [0.8, 0.76, 0.7]); }
      wbox(ST, X1 - 2.2, rh - 1.4, zm + 0.8, X1 - 1.4, rh + 1.1, zm + 1.6, [0.7, 0.6, 0.55], 0.5); wbox(ST, X1 - 2.3, rh + 1.1, zm + 0.7, X1 - 1.3, rh + 1.25, zm + 1.7, [0.6, 0.55, 0.5], 0.5);
      // dessus des murs sous le toit
      wbox(ST, X0, SH - 0.01, Z0, X1, SH + 0.02, Z1, [0.6, 0.58, 0.55], 0.5);
      // plafond à poutres
      const yc = 3.05; K.face(BO, [X0 + C, yc, Z0 + C], [X1 - C, yc, Z0 + C], [X1 - C, yc, Z1 - C], [X0 + C, yc, Z1 - C], [0.55, 0.5, 0.45], [0, -1, 0]);
      for (let x = X0 + C + 0.8; x < X1 - C; x += 1.6) wbox(BO, x - 0.1, yc - 0.18, Z0 + C, x + 0.1, yc, Z1 - C, [0.45, 0.4, 0.35], 0.5);
      // porte d'entrée (linteau + vantail ouvert)
      const DZ = h.door.y * C; wbox(ST, X0, 2.35, DZ, X0 + C, SH, DZ + C, [0.78, 0.74, 0.68], 0.5);
      wbox(BO, X0 - 0.1, 0.02, DZ + C + 0.02, X0 - 0.04, 2.3, DZ + C + 0.95, [0.5, 0.42, 0.35], 0.5);       // vantail ouvert contre la façade
      for (const zz of [DZ + 0.02, DZ + C - 0.14]) wbox(BO, X0 - 0.06, 0, zz, X0 + C, 2.4, zz + 0.12, [0.4, 0.33, 0.26], 0.5);   // chambranle
      signs.add({ text: 'CONCIERGERIE', bg: '#2d3a2c', fg: '#e0d8c2', w: 1.3, h: 0.3, x: X0 - 0.03, y: 2.65, z: DZ + 1, ry: -Math.PI / 2, border: true });
      // pendule, crucifix et clés au mur
      wbox(BO, X1 - C - 0.1, 1.7, Z0 + C + 0.6, X1 - C, 2.15, Z0 + C + 0.95, [0.5, 0.4, 0.3], 0.5);
      for (let k = 0; k < 6; k++) wbox(FE, X0 + C + 0.02, 1.5, Z0 + C + 1.6 + k * 0.12, X0 + C + 0.05, 1.62, Z0 + C + 1.63 + k * 0.12, [0.8, 0.7, 0.4], 0.5);
    }

    /* ---------- fosses fraîchement creusées ---------- */
    for (const fs of CM.fosses) {
      const b = fs.f * SH, X0 = fs.x * C, Z0 = fs.y * C, depth = 1.9;
      // fosse de 0,9 × 1,9 m ; tas de terre sur le côté
      const hx0 = fs.ax ? X0 + 0.05 : X0 + 0.2, hx1 = fs.ax ? X0 + 1.95 : X0 + 1.1, hz0 = fs.ax ? Z0 + 0.2 : Z0 + 0.05, hz1 = fs.ax ? Z0 + 1.1 : Z0 + 1.95;
      const FL = B('f3'), y = b;
      const q = (x0, z0, x1, z1) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) H.quad(FL, [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], [[x0 / 2, z1 / 2], [x1 / 2, z1 / 2], [x1 / 2, z0 / 2], [x0 / 2, z0 / 2]], 0.9); };
      q(X0, Z0, X0 + C, hz0); q(X0, hz1, X0 + C, Z0 + C); q(X0, hz0, hx0, hz1); q(hx1, hz0, X0 + C, hz1);
      K.face(TE, [hx0, y - depth, hz0], [hx1, y - depth, hz0], [hx1, y - depth, hz1], [hx0, y - depth, hz1], [0.6, 0.6, 0.6], [0, 1, 0]);
      K.face(TE, [hx0, y - depth, hz0], [hx1, y - depth, hz0], [hx1, y, hz0], [hx0, y, hz0], [0.55, 0.55, 0.55], [0, 0, 1]);
      K.face(TE, [hx0, y - depth, hz1], [hx1, y - depth, hz1], [hx1, y, hz1], [hx0, y, hz1], [0.5, 0.5, 0.5], [0, 0, -1]);
      K.face(TE, [hx0, y - depth, hz0], [hx0, y - depth, hz1], [hx0, y, hz1], [hx0, y, hz0], [0.5, 0.5, 0.5], [1, 0, 0]);
      K.face(TE, [hx1, y - depth, hz0], [hx1, y - depth, hz1], [hx1, y, hz1], [hx1, y, hz0], [0.45, 0.45, 0.45], [-1, 0, 0]);
      K.face(TR, [hx0 + 0.02, y - depth + 0.02, hz0 + 0.02], [hx1 - 0.02, y - depth + 0.02, hz0 + 0.02], [hx1 - 0.02, y - depth + 0.02, hz1 - 0.02], [hx0 + 0.02, y - depth + 0.02, hz1 - 0.02], [1, 1, 1], [0, 1, 0]);
      // planches au bord, tas de terre, pelle plantée
      for (const [x0, z0, x1, z1] of fs.ax ? [[hx0, hz0 - 0.22, hx1, hz0], [hx0, hz1, hx1, hz1 + 0.22]] : [[hx0 - 0.22, hz0, hx0, hz1], [hx1, hz0, hx1 + 0.22, hz1]]) wbox(BO, x0, y, z0, x1, y + 0.04, z1, [0.7, 0.62, 0.52], 0.5);
      const mx = fs.ax ? (X0 + 1) : (X0 + 1.55), mz = fs.ax ? (Z0 + 1.55) : (Z0 + 1), along = fs.ax ? [1, 0] : [0, 1];
      H.tube(TE, [[mx - along[0] * 0.85, y - 0.05, mz - along[1] * 0.85], [mx, y + 0.42, mz], [mx + along[0] * 0.85, y - 0.05, mz + along[1] * 0.85]], [0.15, 0.36, 0.15], 8, [0.75, 0.72, 0.7], 2);
      H.icoBlob(TE, mx + along[0] * 0.3, y + 0.25, mz + along[1] * 0.3, 0.32, [0.7, 0.66, 0.62], 0.6, 1);
      K.bar(BO, [mx + 0.1, y + 0.3, mz + 0.05], [mx + 0.35, y + 1.45, mz - 0.1], 0.04, 0.04, [0.6, 0.5, 0.4]); K.face(FE, [mx + 0.02, y + 0.0, mz + 0.0], [mx + 0.22, y - 0.02, mz + 0.1], [mx + 0.16, y + 0.32, mz + 0.06], [mx + 0.04, y + 0.32, mz + 0.03], [0.7, 0.7, 0.7], [1, 0, -1]);
      K.face(FE, [mx + 0.02, y + 0.0, mz + 0.0], [mx + 0.22, y - 0.02, mz + 0.1], [mx + 0.16, y + 0.32, mz + 0.06], [mx + 0.04, y + 0.32, mz + 0.03], [0.7, 0.7, 0.7], [-1, 0, 1]);
    }

    /* ---------- buissons de ronces (cases devenues inaccessibles) ---------- */
    for (let f = 0; f < 2; f++) for (let i = 0; i < m.WH; i++) {
      if (m.t[f][i] !== WALL || m.zone[f][i] !== ZW.buisson || !m.noWall[f][i]) continue;
      const x = i % W, y = (i / W) | 0, b = f * SH, X0 = x * C, Z0 = y * C;
      H.quad(B('f2'), [[X0, b, Z0 + C], [X0 + C, b, Z0 + C], [X0 + C, b, Z0], [X0, b, Z0]], [0, 1, 0], [[X0 / 2, (Z0 + C) / 2], [(X0 + C) / 2, (Z0 + C) / 2], [(X0 + C) / 2, Z0 / 2], [X0 / 2, Z0 / 2]], 0.85);
      for (let k = 0; k < 4; k++) H.icoBlob(B('ecorce'), X0 + 0.4 + rng() * 1.2, b + 0.4 + rng() * 0.5, Z0 + 0.4 + rng() * 1.2, 0.5 + rng() * 0.3, [0.4, 0.36, 0.3], 0.8, 1);
      for (let k = 0; k < 10; k++) { const sx = X0 + rng() * C, sz = Z0 + rng() * C; H.tube(EC, [[sx, b, sz], [sx + (rng() - 0.5) * 0.8, b + 0.8 + rng() * 0.9, sz + (rng() - 0.5) * 0.8]], [0.03, 0.005], 3, [0.6, 0.55, 0.5], 1); }
    }

    /* ---------- objets ---------- */
    for (const p of m.props) {
      if (!p.sub) continue;
      const x = p.x, z = p.z, b = p.base, d = p.data || {};
      switch (p.sub) {
        case 'tombe': graveMesh(p); break;
        case 'arbre': { const ends = deadTree(EC, x, b, z, BR.rngFrom(p.v || 1), d.big ? 1.45 : 1.0 + (p.v % 7) * 0.06, lq ? 1 : 2); if (rng() < 0.25 && ends.length) { const e = ends[Math.floor(rng() * ends.length)]; ravens.push([e[0], e[1] - 0.02, e[2], rng() * 6]); } break; }
        case 'lanterne': {
          const L = d.light, on = L && !L.dead;
          K.cyl(FE, [x, b, z], [x, b + 0.4, z], 0.13, 8, [1, 1, 1], true, 0.09); K.cyl(FE, [x, b + 0.4, z], [x, b + 2.35, z], 0.05, 6, [1, 1, 1], false);
          wbox(FE, x - 0.14, b + 2.35, z - 0.14, x + 0.14, b + 2.4, z + 0.14, [1, 1, 1], 0.5);
          wbox(on ? B('verre') : B('verreMort'), x - 0.11, b + 2.4, z - 0.11, x + 0.11, b + 2.78, z + 0.11, on ? (red ? [1, 0.3, 0.2] : [1, 0.85, 0.6]) : [1, 1, 1], 0.5);
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) wbox(FE, x + sx * 0.12 - 0.012, b + 2.4, z + sz * 0.12 - 0.012, x + sx * 0.12 + 0.012, b + 2.78, z + sz * 0.12 + 0.012, [1, 1, 1], 0.5);
          K.cyl(FE, [x, b + 2.78, z], [x, b + 2.98, z], 0.18, 4, [1, 1, 1], true, 0.02);
          if (on) halos.push({ x, y: b + 2.6, z, s: 1.3, L });
          if (rng() < 0.12) ravens.push([x, b + 2.98, z, rng() * 6]);
          break;
        }
        case 'banc': { const al = p.w > p.d; wbox(ST, p.x0, b + 0.38, p.z0, p.x1, b + 0.46, p.z1, [0.78, 0.76, 0.72], 0.5); for (const s of [-1, 1]) { const px = al ? x + s * (p.w / 2 - 0.2) : x, pz = al ? z : z + s * (p.d / 2 - 0.2); wbox(ST, px - (al ? 0.08 : p.w / 2 - 0.04), b, pz - (al ? p.d / 2 - 0.04 : 0.08), px + (al ? 0.08 : p.w / 2 - 0.04), b + 0.38, pz + (al ? p.d / 2 - 0.04 : 0.08), [0.7, 0.68, 0.65], 0.5); } break; }
        case 'ange': { wbox(ST, x - 0.42, b, z - 0.42, x + 0.42, b + 0.15, z + 0.42, [0.7, 0.7, 0.68], 0.5); wbox(ST, x - 0.33, b + 0.15, z - 0.33, x + 0.33, b + 1.05, z + 0.33, [0.78, 0.77, 0.74], 0.5); wbox(ST, x - 0.4, b + 1.05, z - 0.4, x + 0.4, b + 1.15, z + 0.4, [0.72, 0.71, 0.68], 0.5); angel(ST, frameAt(x, b + 1.15, z, d.ry || 0), 0.95, [0.82, 0.82, 0.8], true); break; }
        case 'eau': { K.cyl(ST, [x, b, z], [x, b + 0.75, z], 0.2, 8, [0.75, 0.73, 0.7], true); K.bar(FE, [x, b + 0.75, z], [x, b + 0.95, z], 0.05, 0.05, [1, 1, 1]); K.bar(FE, [x, b + 0.95, z], [x + 0.22, b + 0.92, z], 0.04, 0.04, [1, 1, 1]); wbox(ST, x - 0.27, b, z + 0.05, x + 0.27, b + 0.12, z + 0.27, [0.7, 0.7, 0.7], 0.5); for (let k = 0; k < 2; k++) { const ax2 = x - 0.18 + k * 0.4, az2 = z - 0.32; K.cyl(B('p'), [ax2, b, az2], [ax2, b + 0.3, az2], 0.12, 10, k ? [0.2, 0.35, 0.25] : [0.55, 0.3, 0.2], true); } break; }
        case 'brouette': { const F2 = frameAt(x, b, z, d.ry || 0); obox(B('p'), F2, -0.32, 0.35, -0.45, 0.32, 0.65, 0.35, [0.3, 0.38, 0.3]); K.cyl(FE, LP(F2, -0.05, 0.18, 0.55), LP(F2, 0.05, 0.18, 0.55), 0.18, 10, [0.3, 0.3, 0.3], true); for (const s of [-1, 1]) K.bar(FE, LP(F2, s * 0.25, 0.4, -0.4), LP(F2, s * 0.28, 0.5, -0.95), 0.04, 0.04, [1, 1, 1]); break; }
        case 'contrefort': break;
        case 'autel': {
          if (d.part) break;
          const x0 = 28 * C + 0.1, x1 = 30 * C - 0.1, z0 = p.z0, z1 = p.z1;
          wbox(MA, x0, b, z0, x1, b + 0.95, z1, [0.82, 0.8, 0.76], 0.5); wbox(MA, x0 - 0.06, b + 0.95, z0 - 0.06, x1 + 0.06, b + 1.05, z1 + 0.06, [0.9, 0.88, 0.85], 0.5);
          K.face(B('drap'), [x0 + 0.2, b + 0.3, z1 + 0.07], [x1 - 0.2, b + 0.3, z1 + 0.07], [x1 - 0.2, b + 1.05, z1 + 0.07], [x0 + 0.2, b + 1.05, z1 + 0.07], [0.6, 0.15, 0.15], [0, 0, 1]);
          const cxa = (x0 + x1) / 2, cza = (z0 + z1) / 2 - 0.15;
          wbox(FE, cxa - 0.03, b + 1.05, cza - 0.03, cxa + 0.03, b + 1.85, cza + 0.03, [0.85, 0.72, 0.4], 0.5); wbox(FE, cxa - 0.22, b + 1.52, cza - 0.03, cxa + 0.22, b + 1.57, cza + 0.03, [0.85, 0.72, 0.4], 0.5);
          for (const s of [-1.4, -1.0, 1.0, 1.4]) { const px = cxa + s; K.cyl(FE, [px, b + 1.05, cza], [px, b + 1.35, cza], 0.03, 6, [0.85, 0.72, 0.4], true, 0.02); candle(px, b + 1.35, cza, 0.22, 0.026, true); }
          break;
        }
        case 'cierges': { K.cyl(FE, [x, b, z], [x, b + 0.08, z], 0.2, 8, [1, 1, 1], true); K.cyl(FE, [x, b + 0.08, z], [x, b + 1.2, z], 0.03, 6, [1, 1, 1], false); K.cyl(FE, [x, b + 1.2, z], [x, b + 1.25, z], 0.3, 10, [1, 1, 1], true); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; candle(x + Math.cos(a) * 0.2, b + 1.25, z + Math.sin(a) * 0.2, 0.1 + rng() * 0.25, 0.02, rng() < 0.6); } candle(x, b + 1.25, z, 0.4, 0.03, true); break; }
        case 'catafalque': {
          for (const s of [-1, 1]) { K.bar(BO, [x - 0.35, b, z + s * 0.75], [x + 0.35, b + 0.55, z + s * 0.75], 0.05, 0.05, [0.5, 0.45, 0.4]); K.bar(BO, [x + 0.35, b, z + s * 0.75], [x - 0.35, b + 0.55, z + s * 0.75], 0.05, 0.05, [0.5, 0.45, 0.4]); }
          K.face(B('drap'), [x - 0.45, b + 0.55, z - 1.02], [x + 0.45, b + 0.55, z - 1.02], [x + 0.45, b + 0.55, z + 1.02], [x - 0.45, b + 0.55, z + 1.02], [0.7, 0.2, 0.2], [0, 1, 0]);
          // cercueil ouvert (vide), couvercle posé de travers contre le tréteau
          const cf = [0.45, 0.33, 0.25]; wbox(BO, x - 0.32, b + 0.56, z - 0.95, x + 0.32, b + 0.62, z + 0.95, cf, 0.5);
          for (const [a0, a1, c0, c1] of [[-0.32, -0.28, -0.95, 0.95], [0.28, 0.32, -0.95, 0.95], [-0.32, 0.32, -0.95, -0.91], [-0.32, 0.32, 0.91, 0.95]]) wbox(BO, x + a0, b + 0.56, z + c0, x + a1, b + 0.95, z + c1, cf, 0.5);
          K.face(B('drap'), [x - 0.27, b + 0.63, z - 0.9], [x + 0.27, b + 0.63, z - 0.9], [x + 0.27, b + 0.63, z + 0.9], [x - 0.27, b + 0.63, z + 0.9], [0.9, 0.85, 0.8], [0, 1, 0]);
          obox(BO, sub(IDF, x + 0.62, b, z, 1.15, 0, 0), -0.32, 0, -0.04, 0.32, 1.95, 0.04, cf, 0.5);
          for (const s of [-1, 1]) { K.cyl(FE, [x + 0.6 * s * 0, b, z + s * 1.25], [x, b + 1.3, z + s * 1.25], 0.03, 6, [1, 1, 1], false); candle(x, b + 1.3, z + s * 1.25, 0.35, 0.035, rng() < 0.7); }
          break;
        }
        case 'lutrin': { K.cyl(BO, [x, b, z], [x, b + 1.05, z], 0.05, 6, [0.5, 0.42, 0.35], true); obox(BO, sub(IDF, x, b + 1.05, z, -0.5, 0, 0), -0.28, 0, -0.2, 0.28, 0.04, 0.2, [0.5, 0.42, 0.35], 0.5); obox(B('cire'), sub(IDF, x, b + 1.1, z, -0.5, 0, 0), -0.24, 0, -0.16, 0.24, 0.03, 0.16, [0.85, 0.8, 0.7], 0.5); break; }
        case 'banc_eglise': {
          const F2 = sub(IDF, x, b, z, 0, 0, d.ry || 0), wd = [0.42, 0.33, 0.25];
          if (d.tip) { obox(BO, sub(F2, 0, 0.25, 0, 1.45, 0, 0), -0.9, -0.22, -0.2, 0.9, 0.22, 0.2, wd, 0.5); break; }
          obox(BO, F2, -0.92, 0.42, -0.22, 0.92, 0.47, 0.2, wd, 0.5); obox(BO, F2, -0.92, 0.47, 0.18, 0.92, 0.95, 0.24, wd, 0.5);
          for (const s of [-1, 1]) obox(BO, F2, s * 0.9 - 0.03, 0, -0.24, s * 0.9 + 0.03, 0.95, 0.24, wd, 0.5);
          obox(BO, F2, -0.92, 0.75, -0.3, 0.92, 0.79, -0.24, wd, 0.5);
          break;
        }
        case 'sarco': {
          const F2 = frameAt(x, b, z, d.ax ? Math.PI / 2 : 0), sc = [0.75, 0.73, 0.7];
          obox(ST, F2, -0.5, 0, -1.02, 0.5, 0.12, 1.02, sc, 0.5); obox(ST, F2, -0.44, 0.12, -0.95, 0.44, 0.78, 0.95, sc, 0.5);
          for (const zz of [-0.6, 0, 0.6]) obox(ST, F2, -0.47, 0.25, zz - 0.04, 0.47, 0.65, zz + 0.04, sc.map(v => v * 0.9), 0.5);
          const lid = d.open ? sub(F2, 0.25, 0.78, 0.1, 0, 0, 0.35) : sub(F2, 0, 0.78, 0, 0, 0, 0);
          obox(ST, lid, -0.5, 0, -1.0, 0.5, 0.14, 1.0, sc, 0.5);
          // gisant (silhouette couchée, mains jointes)
          H.tube(ST, [LP(lid, 0, 0.18, -0.72), LP(lid, 0, 0.24, -0.2), LP(lid, 0, 0.22, 0.45), LP(lid, 0, 0.17, 0.82)], [0.12, 0.2, 0.16, 0.1], 8, sc, 1);
          H.icoBlob(ST, ...LP(lid, 0, 0.26, -0.82), 0.12, sc, 0.9, 1); H.icoBlob(ST, ...LP(lid, 0, 0.36, -0.15), 0.06, sc, 1.3, 1);
          if (d.open) K.face(TR, LP(F2, -0.4, 0.79, -0.9), LP(F2, 0.4, 0.79, -0.9), LP(F2, 0.4, 0.79, 0.9), LP(F2, -0.4, 0.79, 0.9), [1, 1, 1], F2.ay);
          break;
        }
        case 'pyramide': {
          for (let lay = 0; lay < 4; lay++) { const n = 4 - lay, s0 = 0.34; for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) skull3D(x + (a - (n - 1) / 2) * s0, b + 0.13 + lay * 0.27, z + (c - (n - 1) / 2) * s0, (a * 7 + c * 3 + lay) % 4 * 1.57 + Math.PI / 4, 1); }
          wbox(ST, x - 0.7, b, z - 0.7, x + 0.7, b + 0.06, z + 0.7, [0.6, 0.58, 0.55], 0.5);
          for (let k = 0; k < 5; k++) candle(x - 0.5 + rng(), b + 0.06, z + 0.6 + rng() * 0.12, 0.1 + rng() * 0.2, 0.025, true);
          break;
        }
        case 'ossements': {
          const r2 = BR.rngFrom(p.v || 7);
          H.icoBlob(B('f7'), x, b + 0.05, z, 0.75, [0.7, 0.66, 0.6], 0.35, 1);
          for (let k = 0; k < 16; k++) { const a = r2() * 6.28, rr = r2() * 0.65, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, py = b + 0.12 + (0.65 - rr) * 0.45 * r2(); const ang = r2() * 6.28; H.tube(OS, [[px - Math.cos(ang) * 0.22, py, pz - Math.sin(ang) * 0.22], [px + Math.cos(ang) * 0.22, py + (r2() - 0.5) * 0.1, pz + Math.sin(ang) * 0.22]], [0.03, 0.03], 5, [0.95, 0.92, 0.85], 1); }
          for (let k = 0; k < 3; k++) skull3D(x + (r2() - 0.5) * 0.8, b + 0.3 + r2() * 0.2, z + (r2() - 0.5) * 0.8, r2() * 6.28, 1);
          break;
        }
        case 'etagere': {
          const s = d.s || 1, X0 = p.x0, X1 = p.x1, Z0 = p.z0, Z1 = p.z1;
          for (const yy of [0, 0.95, 1.9]) wbox(ST, X0, b + yy, Z0, X1, b + yy + 0.1, Z1, [0.62, 0.6, 0.56], 0.5);
          for (const zz of [Z0, Z1 - 0.12]) wbox(ST, X0, b, zz, X1, b + 2.0, zz + 0.12, [0.58, 0.56, 0.52], 0.5);
          for (const yy of [0.1, 1.05]) { const cx2 = (X0 + X1) / 2; obox(BO, frameAt(cx2, b + yy, (Z0 + Z1) / 2, 0), -0.3, 0, -0.85, 0.3, 0.42, 0.85, [0.4, 0.3, 0.22], 0.5); wbox(FE, cx2 - 0.05, b + yy + 0.2, Z0 + 0.4, cx2 + 0.05, b + yy + 0.44, Z0 + 0.44, [0.7, 0.6, 0.35], 0.5); }
          void s; break;
        }
        case 'autelC': { wbox(ST, p.x0, b, p.z0, p.x1, b + 0.95, p.z1, [0.7, 0.68, 0.64], 0.5); wbox(ST, p.x0 - 0.05, b + 0.95, p.z0 - 0.05, p.x1 + 0.05, b + 1.02, p.z1 + 0.05, [0.75, 0.73, 0.7], 0.5); for (let k = 0; k < 6; k++) candle(p.x0 + 0.2 + rng() * 0.5, b + 1.02, p.z0 + 0.2 + rng() * 1.4, 0.08 + rng() * 0.3, 0.025, rng() < 0.7); skull3D(x, b + 1.12, z, -Math.PI / 2, 1.1); break; }
        case 'alcove': {
          wbox(ST, p.x0, b, p.z0, p.x1, b + 0.85, p.z1, [0.6, 0.58, 0.55], 0.5);
          const r2 = BR.rngFrom(d.v || 3), kind = Math.floor(r2() * 3), cx2 = (p.x0 + p.x1) / 2, cz2 = (p.z0 + p.z1) / 2;
          if (kind === 0) { K.cyl(ST, [cx2, b + 0.85, cz2], [cx2, b + 1.15, cz2], 0.14, 10, [0.7, 0.68, 0.65], true, 0.1); H.icoBlob(ST, cx2, b + 1.25, cz2, 0.16, [0.7, 0.68, 0.65], 1.1, 1); }
          else if (kind === 1) skull3D(cx2, b + 0.95, cz2, Math.atan2(-d.dx, -d.dy), 1.1);
          else for (let k = 0; k < 3; k++) skull3D(cx2 + (k - 1) * 0.28 * (d.dy ? 1 : 0), b + 0.95, cz2 + (k - 1) * 0.28 * (d.dx ? 1 : 0), Math.atan2(-d.dx, -d.dy), 0.95);
          for (let k = 0; k < 3; k++) candle(cx2 + (r2() - 0.5) * 0.9 * (d.dy ? 1 : 0.4), b + 0.85, cz2 + (r2() - 0.5) * 0.9 * (d.dx ? 1 : 0.4), 0.06 + r2() * 0.15, 0.022, false);
          break;
        }
        case 'table': { wbox(BO, p.x0, b + 0.72, p.z0, p.x1, b + 0.78, p.z1, [0.55, 0.42, 0.3], 0.5); for (const [a, c] of [[p.x0 + 0.06, p.z0 + 0.06], [p.x1 - 0.06, p.z0 + 0.06], [p.x0 + 0.06, p.z1 - 0.06], [p.x1 - 0.06, p.z1 - 0.06]]) wbox(BO, a - 0.035, b, c - 0.035, a + 0.035, b + 0.72, c + 0.035, [0.5, 0.38, 0.28], 0.5); candle(x + 0.3, b + 0.78, z, 0.12, 0.03, false); wbox(B('cire'), x - 0.4, b + 0.78, z - 0.2, x, b + 0.8, z + 0.1, [0.9, 0.86, 0.75], 0.5); break; }
        case 'chaise': { wbox(BO, p.x0, b + 0.44, p.z0, p.x1, b + 0.48, p.z1, [0.5, 0.38, 0.28], 0.5); wbox(BO, p.x0, b + 0.48, p.z0, p.x1, b + 0.95, p.z0 + 0.04, [0.5, 0.38, 0.28], 0.5); for (const [a, c] of [[p.x0 + 0.04, p.z0 + 0.04], [p.x1 - 0.04, p.z0 + 0.04], [p.x0 + 0.04, p.z1 - 0.04], [p.x1 - 0.04, p.z1 - 0.04]]) wbox(BO, a - 0.02, b, c - 0.02, a + 0.02, b + 0.44, c + 0.02, [0.5, 0.38, 0.28], 0.5); break; }
        case 'poele': { K.cyl(FE, [x, b, z], [x, b + 0.85, z], 0.26, 10, [0.6, 0.6, 0.6], true); K.cyl(FE, [x, b + 0.85, z], [x, 3.05, z], 0.06, 8, [0.6, 0.6, 0.6], false); K.cyl(B('glow'), [x, b + 0.25, z], [x, b + 0.4, z], 0.262, 10, red ? [1, 0.2, 0.1] : [1, 0.45, 0.15], false); break; }
        case 'lit': { wbox(BO, p.x0, b, p.z0, p.x1, b + 0.42, p.z1, [0.45, 0.35, 0.26], 0.5); wbox(B('cire'), p.x0 + 0.05, b + 0.42, p.z0 + 0.05, p.x1 - 0.05, b + 0.58, p.z1 - 0.05, [0.75, 0.72, 0.66], 0.5); wbox(B('drap'), p.x0 + 0.04, b + 0.5, p.z0 + 0.6, p.x1 - 0.04, b + 0.6, p.z1 - 0.04, [0.6, 0.55, 0.6], 0.5); wbox(BO, p.x0, b, p.z0, p.x1, b + 1.0, p.z0 + 0.06, [0.45, 0.35, 0.26], 0.5); break; }
        case 'armoire': { wbox(BO, p.x0, b, p.z0, p.x1, b + 2.0, p.z1, [0.42, 0.32, 0.24], 0.5); wbox(BO, x - 0.01, b + 0.15, p.z1, x + 0.01, b + 1.9, p.z1 + 0.01, [0.2, 0.15, 0.1], 0.5); break; }
        case 'rail': break;
        default: break;
      }
    }
    function skull3D(x, y, z, ry, s) {
      const F = frameAt(x, y, z, ry), P = (a, b2, c) => LP(F, a * s, b2 * s, c * s), bc = [0.95, 0.9, 0.8];
      H.icoBlob(OS, ...P(0, 0.07, -0.01), 0.1 * s, bc, 0.95, 1); H.icoBlob(OS, ...P(0, 0.0, 0.05), 0.065 * s, bc, 0.8, 1);
      for (const sx of [-1, 1]) H.icoBlob(TR, ...P(sx * 0.038, 0.045, 0.085), 0.026 * s, [1, 1, 1], 1, 0);
      H.icoBlob(TR, ...P(0, 0.005, 0.1), 0.014 * s, [1, 1, 1], 1.4, 0);
    }
    function graveMesh(p) {
      const d = p.data, b = p.base, ry = (d.face === 1 ? 0 : Math.PI) + d.jit, Fp = frameAt(p.x, b, p.z, ry), t = d.tint, sc = [t, t * 0.98, t * 0.94];
      const gran = d.style === 'stele_g' || d.style === 'dalle_g', M = gran ? GR : ST, cl = gran ? [0.95, 0.95, 0.95] : sc, EPB = gran ? EPG : EP;
      let topY = 0.15, headTop = null;
      const kerb = (h) => { obox(M, Fp, -0.5, 0, -0.95, 0.5, h, -0.84, cl, 0.5); obox(M, Fp, -0.5, 0, 0.84, 0.5, h, 0.95, cl, 0.5); obox(M, Fp, -0.5, 0, -0.84, -0.39, h, 0.84, cl, 0.5); obox(M, Fp, 0.39, 0, -0.84, 0.5, h, 0.84, cl, 0.5); K.face(B(gran ? 'f1' : 'f3'), LP(Fp, -0.39, h - 0.04, -0.84), LP(Fp, 0.39, h - 0.04, -0.84), LP(Fp, 0.39, h - 0.04, 0.84), LP(Fp, -0.39, h - 0.04, 0.84), [0.8, 0.8, 0.8], Fp.ay); };
      switch (d.style) {
        case 'stele': case 'stele_g': {
          if (gran) { obox(GR, Fp, -0.52, 0, -0.98, 0.52, 0.12, 0.98, cl, 0.5); obox(GR, Fp, -0.47, 0.12, -0.7, 0.47, 0.26, 0.93, cl, 0.5); topY = 0.26; }
          else if (d.kerb) { kerb(0.16); topY = 0.12; } else topY = 0.02;
          obox(M, Fp, -0.42, 0, -0.98, 0.42, 0.16, -0.72, cl, 0.5);
          const Fs = sub(Fp, 0, 0.16, -0.86, d.tilt, d.roll), hh = gran ? d.h + 0.15 : d.h;
          slabP(M, EPB, Fs, profile(gran ? 'droite' : d.prof, d.hw, hh), -0.07, 0.07, cl, (lx, ly) => tileUV(d.tex, lx, ly, 1, 0));
          headTop = LP(Fs, 0, hh, 0);
          if (gran) { K.cyl(GR, LP(Fp, 0.3, topY, 0.6), LP(Fp, 0.3, topY + 0.25, 0.6), 0.07, 8, cl, true); for (let k = 0; k < 4; k++) BR.World.H.icoBlob(B('p'), ...LP(Fp, 0.3 + (rng() - 0.5) * 0.12, topY + 0.3 + rng() * 0.1, 0.6 + (rng() - 0.5) * 0.12), 0.05, BR.pick([[0.6, 0.2, 0.25], [0.7, 0.6, 0.3], [0.5, 0.25, 0.5], [0.8, 0.8, 0.75]], rng), 1, 0); }
          break;
        }
        case 'dalle': case 'dalle_g': {
          obox(M, Fp, -0.5, 0, -0.97, 0.5, gran ? 0.22 : 0.3, 0.97, cl, 0.5);
          const yt = gran ? 0.221 : 0.301;
          const uv = (lx, lz) => tileUV(d.tex, lx, 0.62 - lz * 0.4, 0.78, 0);
          K.face(EPB, LP(Fp, -0.42, yt, 0.6), LP(Fp, 0.42, yt, 0.6), LP(Fp, 0.42, yt, -0.85), LP(Fp, -0.42, yt, -0.85), cl, Fp.ay, [uv(-0.42, 0.6), uv(0.42, 0.6), uv(0.42, -0.85), uv(-0.42, -0.85)]);
          if (gran) { const Fs = sub(Fp, 0, 0.22, -0.88, 0, 0, 0); obox(GR, Fs, -0.45, 0, -0.08, 0.45, 0.7, 0.08, cl, 0.5); K.face(EPG, LP(Fs, -0.45, 0, 0.081), LP(Fs, 0.45, 0, 0.081), LP(Fs, 0.45, 0.7, 0.081), LP(Fs, -0.45, 0.7, 0.081), cl, Fs.az, [tileUV(d.tex, -0.45, 0, 0.9, -0.2), tileUV(d.tex, 0.45, 0, 0.9, -0.2), tileUV(d.tex, 0.45, 0.7, 0.9, -0.2), tileUV(d.tex, -0.45, 0.7, 0.9, -0.2)]); headTop = LP(Fs, 0, 0.7, 0); topY = 0.22; }
          else { const Fb = sub(Fp, 0, 0.3, -0.62, -0.5, 0, 0); for (const s of [-1, 1]) obox(ST, sub(Fb, s * 0.14, 0, 0, 0, s * 0.18, 0), -0.14, 0, -0.1, 0.14, 0.04, 0.1, cl, 0.5); topY = 0.3; }
          break;
        }
        case 'croix': case 'militaire': {
          const mil = d.style === 'militaire', mc = mil ? [1, 1, 1] : cl;
          if (!mil) { obox(ST, Fp, -0.5, 0, -0.95, 0.5, 0.18, 0.95, mc, 0.5); obox(ST, Fp, -0.38, 0.18, -0.98, 0.38, 0.44, -0.6, mc, 0.5); plaque(EP, Fp, -0.3, 0.22, 0.3, 0.42, -0.594, d.tex, mc); topY = 0.18; }
          else { obox(ST, Fp, -0.16, 0, -0.92, 0.16, 0.12, -0.6, mc, 0.5); }
          const Fc = sub(Fp, 0, mil ? 0.12 : 0.44, mil ? -0.76 : -0.8, d.tilt, d.roll), hh = mil ? 0.85 : d.h + 0.25;
          obox(ST, Fc, -0.065, 0, -0.065, 0.065, hh, 0.065, mc, 0.5); obox(ST, Fc, -0.3, hh * 0.66, -0.065, 0.3, hh * 0.66 + 0.12, 0.065, mc, 0.5);
          if (mil) K.face(EP, LP(Fc, -0.08, hh * 0.45, 0.066), LP(Fc, 0.08, hh * 0.45, 0.066), LP(Fc, 0.08, hh * 0.55, 0.066), LP(Fc, -0.08, hh * 0.55, 0.066), mc, Fc.az, [[0.05, 0.62], [0.2, 0.62], [0.2, 0.66], [0.05, 0.66]]);
          headTop = LP(Fc, 0, hh, 0);
          break;
        }
        case 'celtique': {
          obox(ST, Fp, -0.5, 0, -0.95, 0.5, 0.15, 0.95, cl, 0.5); obox(ST, Fp, -0.4, 0.15, -0.98, 0.4, 0.5, -0.58, cl, 0.5); plaque(EP, Fp, -0.32, 0.2, 0.32, 0.45, -0.574, d.tex, cl);
          const Fc = sub(Fp, 0, 0.5, -0.78, d.tilt, d.roll), hh = 1.25, cy = hh * 0.72;
          obox(ST, Fc, -0.08, 0, -0.07, 0.08, hh, 0.07, cl, 0.5); obox(ST, Fc, -0.36, cy - 0.07, -0.07, 0.36, cy + 0.07, 0.07, cl, 0.5);
          const ring = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 2; ring.push(LP(Fc, Math.cos(a) * 0.22, cy + Math.sin(a) * 0.22, 0)); }
          H.tube(ST, ring, ring.map(() => 0.04), 6, cl, 1); headTop = LP(Fc, 0, hh, 0); topY = 0.15;
          break;
        }
        case 'coffre': {
          obox(ST, Fp, -0.56, 0, -1.0, 0.56, 0.14, 1.0, cl, 0.5); obox(ST, Fp, -0.45, 0.14, -0.9, 0.45, 0.82, 0.9, cl, 0.5); obox(ST, Fp, -0.53, 0.82, -0.98, 0.53, 0.96, 0.98, cl, 0.5);
          obox(ST, Fp, -0.04, 0.96, -0.7, 0.04, 1.0, 0.7, cl, 0.5); obox(ST, Fp, -0.25, 0.96, -0.45, 0.25, 1.0, -0.37, cl, 0.5);
          plaque(EP, Fp, -0.38, 0.3, 0.38, 0.7, 0.906, d.tex, cl); headTop = LP(Fp, 0, 1.0, -0.5); topY = 0.96;
          break;
        }
        case 'obelisque': {
          obox(ST, Fp, -0.5, 0, -0.95, 0.5, 0.15, 0.95, cl, 0.5); obox(ST, Fp, -0.38, 0.15, -0.95, 0.38, 0.35, -0.2, cl, 0.5); obox(ST, Fp, -0.28, 0.35, -0.85, 0.28, 0.95, -0.3, cl, 0.5);
          plaque(EP, Fp, -0.24, 0.45, 0.24, 0.85, -0.294, d.tex, cl);
          const Fo = sub(Fp, 0, 0.95, -0.575, d.tilt * 0.5, d.roll * 0.5), y1 = 1.5, r0 = 0.2, r1 = 0.12;
          const P0 = [[-r0, 0, -r0], [r0, 0, -r0], [r0, 0, r0], [-r0, 0, r0]], P1 = [[-r1, y1, -r1], [r1, y1, -r1], [r1, y1, r1], [-r1, y1, r1]];
          for (let k = 0; k < 4; k++) { const a = P0[k], bq = P0[(k + 1) % 4], c = P1[(k + 1) % 4], e = P1[k]; K.face(ST, LP(Fo, ...a), LP(Fo, ...bq), LP(Fo, ...c), LP(Fo, ...e), cl, LD(Fo, (a[0] + bq[0]) / 2, 0.1, (a[2] + bq[2]) / 2), 0.5); }
          for (let k = 0; k < 4; k++) { const a = P1[k], bq = P1[(k + 1) % 4], mid = [(a[0] + bq[0]) / 2, 0.5, (a[2] + bq[2]) / 2]; tri3(ST, LP(Fo, ...a), LP(Fo, ...bq), LP(Fo, 0, y1 + 0.22, 0), LD(Fo, ...mid), [0, 0], [0.2, 0], [0.1, 0.2], cl); }
          headTop = LP(Fo, 0, y1 + 0.22, 0); topY = 0.15;
          break;
        }
        case 'ange': {
          obox(ST, Fp, -0.5, 0, -0.95, 0.5, 0.15, 0.95, cl, 0.5); obox(ST, Fp, -0.36, 0.15, -0.95, 0.36, 1.2, -0.3, cl, 0.5); plaque(EP, Fp, -0.3, 0.45, 0.3, 0.9, -0.294, d.tex, cl);
          angel(ST, sub(Fp, 0, 1.2, -0.62, d.tilt * 0.3, 0, 0), 0.85, cl.map(v => Math.min(1, v * 1.1)), true); topY = 0.15;
          break;
        }
        case 'brisee': {
          if (d.kerb) kerb(0.14); obox(ST, Fp, -0.42, 0, -0.98, 0.42, 0.15, -0.72, cl, 0.5);
          const Fs = sub(Fp, 0, 0.15, -0.86, d.tilt * 0.5, 0);
          slabP(ST, EP, Fs, profile('brisee', d.hw, d.h), -0.07, 0.07, cl, (lx, ly) => tileUV(d.tex, lx, ly, 1, 0), [0, d.h * 0.2]);
          obox(ST, sub(Fp, 0.1, 0.12, 0.25, -1.45, 0.3, 0.4), -d.hw * 0.9, 0, -0.07, d.hw * 0.6, d.h * 0.5, 0.07, cl, 0.5);
          topY = 0.1;
          break;
        }
        case 'fer': {
          H.tube(TE, [LP(Fp, 0, -0.05, -0.95), LP(Fp, 0, 0.16, -0.3), LP(Fp, 0, 0.16, 0.3), LP(Fp, 0, -0.05, 0.95)], [0.25, 0.4, 0.4, 0.25], 8, [0.8, 0.78, 0.75], 2);
          const Fc = sub(Fp, 0, 0, -0.8, d.tilt, d.roll), hh = 1.25, ic = [1, 1, 1];
          obox(FE, Fc, -0.025, 0, -0.025, 0.025, hh, 0.025, ic, 0.5); obox(FE, Fc, -0.32, hh * 0.68, -0.025, 0.32, hh * 0.68 + 0.05, 0.025, ic, 0.5);
          const ring = []; for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI * 2; ring.push(LP(Fc, Math.cos(a) * 0.14, hh * 0.69 + Math.sin(a) * 0.14, 0)); } H.tube(FE, ring, ring.map(() => 0.012), 4, ic, 1);
          for (const s of [-1, 1]) H.tube(FE, [LP(Fc, s * 0.32, hh * 0.7, 0), LP(Fc, s * 0.38, hh * 0.76, 0), LP(Fc, s * 0.33, hh * 0.8, 0)], [0.012, 0.012, 0.012], 4, ic, 1);
          obox(B('epitaphe'), Fc, -0.09, hh * 0.45, 0.026, 0.09, hh * 0.56, 0.03, [0.75, 0.75, 0.7], 0.5);
          for (const [a, c] of [[-0.55, -1.0], [0.55, -1.0], [-0.55, 1.0], [0.55, 1.0]]) obox(FE, Fp, a - 0.02, 0, c - 0.02, a + 0.02, 0.55, c + 0.02, ic, 0.5);
          for (const yy of [0.15, 0.5]) { obox(FE, Fp, -0.55, yy, -1.01, 0.55, yy + 0.025, -0.99, ic, 0.5); obox(FE, Fp, -0.55, yy, 0.99, 0.55, yy + 0.025, 1.01, ic, 0.5); obox(FE, Fp, -0.56, yy, -1.0, -0.54, yy + 0.025, 1.0, ic, 0.5); obox(FE, Fp, 0.54, yy, -1.0, 0.56, yy + 0.025, 1.0, ic, 0.5); }
          headTop = LP(Fc, 0, hh, 0); topY = 0.12;
          break;
        }
      }
      // lumignon (bougie rouge sous verre), fleurs fanées, corbeau
      if (d.lum) { const P = LP(Fp, -0.25, topY, 0.65); K.cyl(B('lumignon'), P, [P[0], P[1] + 0.13, P[2]], 0.045, 8, red ? [1, 0.3, 0.2] : (d.lumLit ? [1, 0.55, 0.4] : [0.35, 0.12, 0.1]), true); if (d.lumLit) { fl(P[0], P[1] + 0.06, P[2], 0.7); if (halos.length < 60 && rng() < 0.5) halos.push({ x: P[0], y: P[1] + 0.12, z: P[2], s: 0.55, red: true }); } }
      if (d.fleurs) { const P = LP(Fp, 0.2, topY, 0.4); K.cyl(B('p'), P, [P[0], P[1] + 0.18, P[2]], 0.06, 8, [0.45, 0.25, 0.18], true, 0.08); for (let k = 0; k < 5; k++) { const q = [P[0] + (rng() - 0.5) * 0.15, P[1] + 0.25 + rng() * 0.12, P[2] + (rng() - 0.5) * 0.15]; H.tube(B('p'), [[P[0], P[1] + 0.15, P[2]], q], [0.006, 0.006], 3, [0.3, 0.28, 0.2], 1); H.icoBlob(B('p'), q[0], q[1], q[2], 0.035, BR.pick([[0.35, 0.18, 0.15], [0.4, 0.3, 0.15], [0.3, 0.2, 0.28]], rng), 1, 0); } }
      if ((d.corbeau || (headTop && rng() < 0.04)) && headTop) ravens.push([headTop[0], headTop[1], headTop[2], rng() * 6]);
    }

    /* ---------- lumières : lanternes murales, bougies, couronnes de lumière ---------- */
    for (const L of m.lights) {
      const on = !L.dead, x = L.px, y = L.y, z = L.pz;
      switch (L.deco) {
        case 'applique': {
          const sx = L.sx || 0, sz = L.sz || 0;
          wbox(FE, x - sx * 0.55 - 0.05, y - 0.05, z - sz * 0.55 - 0.05, x - sx * 0.5 + 0.05, y + 0.05, z - sz * 0.5 + 0.05, [1, 1, 1], 0.5);
          K.bar(FE, [x - sx * 0.52, y + 0.02, z - sz * 0.52], [x, y + 0.02, z], 0.03, 0.03, [1, 1, 1]);
          wbox(on ? B('verre') : B('verreMort'), x - 0.09, y - 0.25, z - 0.09, x + 0.09, y + 0.05, z + 0.09, on ? (red ? [1, 0.3, 0.2] : [1, 0.82, 0.55]) : [1, 1, 1], 0.5);
          K.cyl(FE, [x, y + 0.05, z], [x, y + 0.2, z], 0.13, 4, [1, 1, 1], true, 0.02); wbox(FE, x - 0.1, y - 0.3, z - 0.1, x + 0.1, y - 0.25, z + 0.1, [1, 1, 1], 0.5);
          if (on) halos.push({ x, y: y - 0.1, z, s: 1.1, L });
          break;
        }
        case 'bougies': { const cb = L.cb != null ? L.cb : y - 0.35, n = 4 + Math.floor(rng() * 4); for (let k = 0; k < n; k++) { const a = rng() * 6.28, r = rng() * 0.2; candle(x + Math.cos(a) * r, cb, z + Math.sin(a) * r, 0.08 + rng() * 0.22, 0.02 + rng() * 0.012, on && rng() < 0.85); } if (on) halos.push({ x, y: cb + 0.3, z, s: 0.9, L }); break; }
        case 'halo': if (on) halos.push({ x, y, z, s: 1.0, L }); break;
        case 'lustre': {
          const top = L.y > SH ? 2 * SH + 0.15 : 3.68, rr = 0.75;
          K.cyl(FE, [x, y + 0.05, z], [x, top, z], 0.012, 4, [1, 1, 1], false);
          const ring = []; for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI * 2; ring.push([x + Math.cos(a) * rr, y, z + Math.sin(a) * rr]); } H.tube(FE, ring, ring.map(() => 0.025), 5, [1, 1, 1], 1);
          for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; K.bar(FE, [x, y + 0.6, z], [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr], 0.012, 0.012, [1, 1, 1]); }
          for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; candle(x + Math.cos(a) * rr, y + 0.02, z + Math.sin(a) * rr, 0.12 + rng() * 0.1, 0.024, on && rng() < 0.8); }
          if (on) halos.push({ x, y: y + 0.15, z, s: 2.2, L });
          break;
        }
        case 'ampoule': { K.cyl(FE, [x, y + 0.1, z], [x, 3.05, z], 0.006, 3, [1, 1, 1], false); K.cyl(FE, [x, y + 0.02, z], [x, y + 0.12, z], 0.17, 10, [0.3, 0.35, 0.3], false, 0.04); BR.World.H.icoBlob(on ? B('verre') : B('verreMort'), x, y - 0.02, z, 0.045, [1, 0.9, 0.7], 1.2, 1); if (on) halos.push({ x, y: y - 0.02, z, s: 0.8, L }); break; }
        case 'autel': if (on) halos.push({ x, y, z, s: 1.6, L }); break;
        default: break;
      }
    }

    /* ---------- corbeaux posés ---------- */
    {
      // sur le chaperon du mur d'enceinte et les balustrades
      for (let k = 0; k < 10; k++) { const side = Math.floor(rng() * 4), t = 4 + rng() * ((side < 2 ? W : Hh) - 8); const x = side === 0 ? 1.62 : side === 1 ? W * C - 1.62 : t * C, z = side === 2 ? 1.62 : side === 3 ? Hh * C - 1.62 : t * C; const gx = Math.floor(x / C), gz = Math.floor(z / C); ravens.push([x, ground(BR.clamp(gx, 1, W - 2), BR.clamp(gz, 1, Hh - 2)) + 3.54, z, rng() * 6]); }
      for (const r of (m.rails || []).filter(r => !m.indoor[r.f][r.U])) if (rng() < 0.04) ravens.push([(r.x + 0.5) * C + r.dx * 0.8, r.f * SH + 1.0, (r.y + 0.5) * C + r.dy * 0.8, rng() * 6]);
      for (const [x, y, z, a] of ravens) raven(CB, x, y, z, a, 1, 'pose');
    }

    /* ---------- brume au ras du sol (nappes horizontales qui dérivent) ---------- */
    {
      const layers = lq ? [[0.4, 0.55]] : [[0.3, 0.6], [0.9, 0.42], [1.8, 0.24]];
      const mt = mistCanvas();
      layers.forEach(([hgt, op], li) => {
        const Bm = H.Buf();
        for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
          const i = id(x, y); let base = -1;
          if (CM.lower[i]) { const t0 = m.t[0][i]; if (m.indoor[0][i]) continue; if (t0 === FLOOR || t0 === RAMP || (t0 === WALL && m.noWall[0][i] && m.zone[0][i] !== ZW.mausolee)) base = 0; }
          else { const t1 = m.t[1][i]; if (m.indoor[1][i]) continue; if (t1 === FLOOR || (t1 === WALL && m.noWall[1][i] && m.zone[1][i] !== ZW.mausolee)) base = SH; }
          if (base < 0) continue;
          const X0 = x * C, Z0 = y * C, Y = base + hgt + (li === 2 ? Math.sin(x * 0.7 + y * 0.4) * 0.25 : 0);
          H.quad(Bm, [[X0, Y, Z0 + C], [X0 + C, Y, Z0 + C], [X0 + C, Y, Z0], [X0, Y, Z0]], [0, 1, 0], [[X0 / 18, (Z0 + C) / 18], [(X0 + C) / 18, (Z0 + C) / 18], [(X0 + C) / 18, Z0 / 18], [X0 / 18, Z0 / 18]], 1);
        }
        if (!Bm.i.length) return;
        const tx = new THREE.CanvasTexture(mt); tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        const mat = new THREE.MeshBasicMaterial({ map: tx, color: new THREE.Color(red ? 0x3a1614 : 0x2b323c), transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
        mat.addEventListener('dispose', () => tx.dispose());
        const me = new THREE.Mesh(H.geo(Bm), mat); me.renderOrder = 3; me.frustumCulled = false; me.matrixAutoUpdate = false;
        const sp = [[0.012, 0.005], [-0.008, 0.01], [0.006, -0.007]][li];
        me.onBeforeRender = () => { const t = performance.now() / 1000; tx.offset.set(t * sp[0], t * sp[1]); };
        group.add(me);
      });
    }

    /* ---------- voile de brume sur le ciel (le dôme étoilé n'est pas touché par le brouillard) ---------- */
    {
      const cv = mk(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.32, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.46, 'rgba(255,255,255,0.97)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.clearRect(0, 0, w, h); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const tx = new THREE.CanvasTexture(cv), fc = new THREE.Color(TX.theme('cimetiere').fog); if (red) fc.lerp(new THREE.Color(0x260303), 0.75);
      const mat = new THREE.MeshBasicMaterial({ map: tx, color: fc, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide });
      mat.addEventListener('dispose', () => tx.dispose());
      const veil = new THREE.Mesh(new THREE.SphereGeometry(130, 24, 12), mat); veil.position.set(W, 0, Hh); veil.renderOrder = 8; veil.frustumCulled = false;
      group.add(veil);
    }

    /* ---------- flammes (vacillantes), halos ---------- */
    if (flames.i.length) {
      const fm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, color: 0xffffff });
      const me = new THREE.Mesh(H.geo(flames), fm); me.matrixAutoUpdate = false;
      me.onBeforeRender = () => { const t = performance.now() / 1000; const k = 0.82 + 0.12 * Math.sin(t * 9.1) + 0.08 * Math.sin(t * 23.7 + 1.3); fm.color.setScalar(k); };
      group.add(me);
    }
    if (halos.length) {
      if (!glowTex) { glowTex = new THREE.CanvasTexture(TX.glow(255, 200, 140)); glowTex.encoding = THREE.sRGBEncoding; }
      for (const h of halos) {
        const c = red || h.red ? 0xff4a30 : 0xffb070;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: h.red ? 0.35 : 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
        sp.position.set(h.x, h.y, h.z); sp.scale.set(h.s, h.s, 1);
        const ph = rng() * 100, base = sp.material.opacity, L = h.L;
        sp.onBeforeRender = () => { const t = performance.now() / 1000; let k = 0.85 + 0.15 * Math.sin(t * 11 + ph); if (L && L.flicker && Math.sin(t * 13 + L.phase) <= -0.8) k *= 0.25; sp.material.opacity = base * k; };
        group.add(sp);
      }
    }
    signs.build(group);
  }

  BR.World.gens.cimetiere = genCimetiere;
  BR.World.decor.cimetiere = decorCimetiere;
})();

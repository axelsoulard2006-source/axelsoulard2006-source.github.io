/* ===== stage3d.js : petites scènes 3D des menus =====
   BR.Stage3D.lounge(container, opt) -> { update(room, selfId), dispose() }
     Le salon d'une partie de l'Ascension : la salle des aventuriers d'une taverne (cheminée qui crépite, grande carte,
     bannières, lanternes, tonneaux…). Chaque joueur du salon y est en 3D (BR.Avatar.build(look)) : assis sur un banc
     tant qu'il n'est pas prêt, debout et fier (Cheer puis pose) sur un anneau doré quand il l'est ; l'hôte a une couronne.
     Arrivées : par la porte du fond (ou en pétales dorés à l'ouverture du salon) ; départs : en pétales.
     Les étiquettes (nom, niveau, état, bouton « exclure ») sont en HTML, recalées sur la 3D à chaque image.
   BR.Stage3D.dressing(canvas, opt) -> { setLook, setWalk, spin, celebrate, dispose }   (même API que BR.Avatar.Preview)
     La cabine d'essayage du tailleur : estrade ronde, rideaux de velours, grand miroir (vrai reflet), mannequin, portant,
     projecteurs chauds et poussières dans la lumière. La scène est gardée quelques secondes après dispose() :
     si l'aperçu est recréé aussitôt, on la réutilise et seul le personnage change.
   Chaque scène : son propre renderer (ACES + bloom de BR.AFX.post), une boucle qui ne dessine que si le canvas est affiché,
   et un nettoyage complet (géométries, matériaux, textures, cibles de rendu, contexte WebGL). */
(function () {
  const BR = window.BR;
  const S = (BR.Stage3D = BR.Stage3D || {});
  const V3 = THREE.Vector3, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
  const L = c => new THREE.Color(c).convertSRGBToLinear();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = k => k * k * (3 - 2 * k);
  const quality = () => (BR.settings && BR.settings.quality) || 'high';
  const lookKey = l => (l && l.skin || '') + '|' + (l && l.aura || '');
  function srng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

  /* ---------- ressources : tout ce qui est créé est rangé ici pour être libéré ---------- */
  function Bag() {
    const B = { geos: new Set(), mats: new Set(), texs: new Set(), rts: new Set() };
    B.g = x => (B.geos.add(x), x); B.m = x => (B.mats.add(x), x); B.t = x => (B.texs.add(x), x); B.rt = x => (B.rts.add(x), x);
    B.dispose = () => { B.geos.forEach(x => x.dispose()); B.mats.forEach(x => x.dispose()); B.texs.forEach(x => x.dispose()); B.rts.forEach(x => x.dispose()); B.geos.clear(); B.mats.clear(); B.texs.clear(); B.rts.clear(); };
    return B;
  }

  /* ---------- textures peintes (le dessin est gardé : une scène recréée le réutilise) ---------- */
  const CV = {};
  function painted(key, w, h, draw) {
    if (CV[key]) return CV[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    return (CV[key] = c);
  }
  function ctex(B, key, w, h, draw, o) {
    const t = B.t(new THREE.CanvasTexture(painted(key, w, h, draw))); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    if (o && o.wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function drawGlow(g, w) { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.65)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }
  function drawFlame(g, w, h) {
    const gr = g.createRadialGradient(w / 2, h * 0.74, 1, w / 2, h * 0.62, h * 0.6);
    gr.addColorStop(0, 'rgba(255,252,230,1)'); gr.addColorStop(0.22, 'rgba(255,214,110,1)'); gr.addColorStop(0.5, 'rgba(255,128,36,0.7)'); gr.addColorStop(1, 'rgba(190,40,8,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2, 0); g.bezierCurveTo(w * 0.9, h * 0.42, w * 0.98, h * 0.94, w / 2, h * 0.99); g.bezierCurveTo(w * 0.02, h * 0.94, w * 0.1, h * 0.42, w / 2, 0); g.fill();
  }
  // parquet / planches (rangées, joints décalés, veines)
  function drawPlanks(g, w, h, o) {
    const r = srng(o.seed || 3), rows = o.rows || 8, rh = h / rows;
    for (let k = 0; k < rows; k++) {
      let x = -r() * w * 0.6;
      while (x < w) {
        const len = w * (0.3 + r() * 0.45), y = k * rh;
        g.fillStyle = `hsl(${o.hue + (r() - 0.5) * 8},${o.sat + (r() - 0.5) * 14}%,${o.lum + (r() - 0.5) * 9}%)`; g.fillRect(x, y, len, rh);
        g.strokeStyle = 'rgba(40,20,8,0.16)'; g.lineWidth = 1.2;
        for (let j = 0; j < 5; j++) { const yy = y + rh * (0.15 + r() * 0.7); g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 6, x + len * 0.6, yy + (r() - 0.5) * 6, x + len, yy + (r() - 0.5) * 4); g.stroke(); }
        if (r() < 0.35) { g.fillStyle = 'rgba(40,20,8,0.25)'; g.beginPath(); g.ellipse(x + len * r(), y + rh * (0.3 + r() * 0.4), 5 + r() * 4, 2.5, 0, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(10,5,2,0.55)'; g.fillRect(x, y, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(10,5,2,0.6)'; g.fillRect(0, k * rh, w, 2.5);
      g.fillStyle = 'rgba(255,225,180,0.07)'; g.fillRect(0, k * rh + 2.5, w, 2);
    }
  }
  // enduit chaud (taches douces)
  function drawPlaster(g, w, h) {
    const r = srng(11); g.fillStyle = '#d5bd92'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const x = r() * w, y = r() * h, s = 8 + r() * 46, l = r() < 0.5; g.fillStyle = l ? `rgba(255,240,210,${0.04 + r() * 0.06})` : `rgba(120,80,40,${0.03 + r() * 0.05})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(90,60,30,0.18)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (r() - 0.5) * 30; y += 6 + r() * 12; g.lineTo(x, y); } g.stroke(); }
  }
  // pierres maçonnées
  function drawStone(g, w, h) {
    const r = srng(5); g.fillStyle = '#3a322b'; g.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let k = 0; k < rows; k++) {
      let x = -r() * 40;
      while (x < w) {
        const sw = 46 + r() * 60, y = k * rh, l = 38 + r() * 18;
        g.fillStyle = `hsl(${24 + r() * 14},${8 + r() * 10}%,${l}%)`;
        g.beginPath(); const p = 4; g.moveTo(x + p + r() * 3, y + p); g.lineTo(x + sw - p, y + p + r() * 2); g.lineTo(x + sw - p - r() * 3, y + rh - p); g.lineTo(x + p, y + rh - p - r() * 2); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,240,220,0.08)'; g.fillRect(x + p, y + p, sw - 2 * p, 3);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + p, y + rh - p - 4, sw - 2 * p, 4);
        x += sw;
      }
    }
  }
  // tapis (rectangulaire ou rond) : bordures dorées, médaillon
  function drawRug(round) {
    return (g, w, h) => {
      const cx = w / 2, cy = h / 2;
      if (round) {
        const ring = (R, c) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill(); };
        ring(w * 0.5, '#c99a3e'); ring(w * 0.47, '#6e1022'); ring(w * 0.43, '#d9b25a'); ring(w * 0.415, '#8c1a2e'); ring(w * 0.25, '#e0bb62'); ring(w * 0.235, '#5c0d1d');
        g.fillStyle = '#e0bb62';
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.save(); g.translate(cx + Math.cos(a) * w * 0.33, cy + Math.sin(a) * w * 0.33); g.rotate(a); g.beginPath(); g.moveTo(-14, 0); g.lineTo(0, -8); g.lineTo(14, 0); g.lineTo(0, 8); g.closePath(); g.fill(); g.restore(); }
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.save(); g.translate(cx, cy); g.rotate(a); g.beginPath(); g.moveTo(0, -w * 0.2); g.quadraticCurveTo(w * 0.05, -w * 0.08, 0, 0); g.quadraticCurveTo(-w * 0.05, -w * 0.08, 0, -w * 0.2); g.fill(); g.restore(); }
        g.fillStyle = '#5c0d1d'; g.beginPath(); g.arc(cx, cy, w * 0.04, 0, TAU); g.fill();
      } else {
        g.fillStyle = '#d6aa4e'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#7a1424'; g.fillRect(10, 10, w - 20, h - 20);
        g.strokeStyle = '#e2bd66'; g.lineWidth = 6; g.strokeRect(28, 28, w - 56, h - 56);
        g.fillStyle = '#e2bd66';
        for (let x = 46; x < w - 40; x += 34) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 12, 50); g.lineTo(x, 60); g.lineTo(x - 12, 50); g.fill(); g.beginPath(); g.moveTo(x, h - 40); g.lineTo(x + 12, h - 50); g.lineTo(x, h - 60); g.lineTo(x - 12, h - 50); g.fill(); }
        g.fillStyle = '#25406a'; g.beginPath(); g.ellipse(cx, cy, w * 0.26, h * 0.3, 0, 0, TAU); g.fill();
        g.strokeStyle = '#e2bd66'; g.lineWidth = 5; g.stroke();
        g.fillStyle = '#e2bd66'; for (let i = 0; i < 4; i++) { g.save(); g.translate(cx, cy); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(0, -h * 0.22); g.lineTo(w * 0.04, 0); g.lineTo(0, h * 0.22); g.lineTo(-w * 0.04, 0); g.fill(); g.restore(); }
        g.fillStyle = '#7a1424'; g.beginPath(); g.arc(cx, cy, 16, 0, TAU); g.fill();
      }
      const r = srng(9); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,230,190' : '0,0,0'},${0.03 + r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
    };
  }
  // la grande carte des terres des colosses (route des 15 étages jusqu'à la tour)
  function drawMap(g, w, h) {
    const r = srng(7);
    g.fillStyle = '#e6cf9a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 240; i++) { g.fillStyle = `rgba(${130 + r() * 50 | 0},${86 + r() * 40 | 0},34,${0.025 + r() * 0.05})`; g.beginPath(); g.arc(r() * w, r() * h, 8 + r() * 60, 0, TAU); g.fill(); }
    const land = (cx, cy, R, n, sd) => { const q = srng(sd); g.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * TAU, k = R * (0.78 + 0.16 * Math.sin(a * 3 + sd) + 0.1 * Math.sin(a * 7 + sd * 2) + 0.06 * (q() - 0.5)); const x = cx + Math.cos(a) * k * 1.5, y = cy + Math.sin(a) * k; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); };
    g.save(); g.setLineDash([5, 7]); g.lineWidth = 1.6; g.strokeStyle = 'rgba(70,80,100,0.35)'; land(w * 0.47, h * 0.52, h * 0.41, 70, 3); g.stroke(); land(w * 0.47, h * 0.52, h * 0.45, 70, 3); g.stroke(); g.restore();
    land(w * 0.47, h * 0.52, h * 0.36, 70, 3); g.fillStyle = 'rgba(214,186,124,0.95)'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#5e3f1c'; g.stroke();
    [[0.86, 0.2, 0.06, 9], [0.12, 0.8, 0.05, 11], [0.89, 0.78, 0.045, 13], [0.08, 0.3, 0.035, 17]].forEach(([x, y, R, sd]) => { land(w * x, h * y, h * R, 26, sd); g.fillStyle = 'rgba(214,186,124,0.95)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#5e3f1c'; g.stroke(); });
    // forêts, montagnes, rivière
    for (let i = 0; i < 46; i++) { const x = w * (0.5 + r() * 0.2), y = h * (0.56 + r() * 0.2); g.fillStyle = 'rgba(64,96,48,0.6)'; g.beginPath(); g.arc(x, y, 5 + r() * 4, 0, TAU); g.fill(); }
    for (let i = 0; i < 30; i++) { const x = w * (0.24 + r() * 0.24), y = h * (0.26 + r() * 0.2), s = 12 + r() * 12; g.fillStyle = 'rgba(120,88,48,0.35)'; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * 1.3); g.lineTo(x + s, y); g.fill(); g.strokeStyle = '#4e3418'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * 1.3); g.lineTo(x + s, y); g.stroke(); }
    g.strokeStyle = 'rgba(52,96,140,0.75)'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(w * 0.36, h * 0.38); g.bezierCurveTo(w * 0.42, h * 0.5, w * 0.3, h * 0.62, w * 0.36, h * 0.82); g.stroke();
    // la route (15 étapes) jusqu'à la tour
    const pts = []; for (let i = 0; i < 15; i++) { const k = i / 14; pts.push([w * (0.2 + k * 0.52 + Math.sin(k * 9) * 0.04), h * (0.78 - k * 0.52 + Math.cos(k * 7) * 0.05)]); }
    g.save(); g.setLineDash([12, 9]); g.strokeStyle = '#9e2218'; g.lineWidth = 4.5; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore();
    pts.forEach((p, i) => { g.fillStyle = i === 14 ? '#9e2218' : '#f3e2b4'; g.strokeStyle = '#6a1a10'; g.lineWidth = 2.5; g.beginPath(); g.arc(p[0], p[1], i === 14 ? 11 : 7, 0, TAU); g.fill(); g.stroke(); });
    const tw = pts[14]; g.fillStyle = '#4e3418'; g.fillRect(tw[0] + 14, tw[1] - 58, 22, 52); g.beginPath(); g.moveTo(tw[0] + 10, tw[1] - 58); g.lineTo(tw[0] + 25, tw[1] - 82); g.lineTo(tw[0] + 40, tw[1] - 58); g.fill();
    g.fillStyle = '#f0c040'; g.fillRect(tw[0] + 22, tw[1] - 46, 6, 9);
    // rose des vents
    g.save(); g.translate(w * 0.1, h * 0.17); g.strokeStyle = '#5e3f1c'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 44, 0, TAU); g.stroke();
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillStyle = i % 2 ? '#5e3f1c' : '#9e2218'; g.beginPath(); g.moveTo(0, -(i % 2 ? 30 : 56)); g.lineTo(7, 0); g.lineTo(-7, 0); g.fill(); }
    g.restore();
    // cartouche
    g.fillStyle = 'rgba(240,222,176,0.92)'; g.strokeStyle = '#5e3f1c'; g.lineWidth = 3; g.fillRect(w * 0.56, h * 0.06, w * 0.38, h * 0.13); g.strokeRect(w * 0.56, h * 0.06, w * 0.38, h * 0.13);
    g.fillStyle = '#4a2c10'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(h * 0.062)}px Georgia, 'Times New Roman', serif`; g.fillText('TERRES DES COLOSSES', w * 0.75, h * 0.125);
    // usure + cadre double
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(96,56,14,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5e3f1c'; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24); g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
  }
  // bannière (fond, bordure dorée, emblème) ; le bas en queue d'aronde est transparent
  function drawBanner(field, kind) {
    return (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(w / 2, h * 0.84); g.lineTo(0, h); g.closePath();
      g.fillStyle = field; g.fill(); g.save(); g.clip();
      const sh = g.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.06)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
      g.restore();
      g.strokeStyle = '#e8b84a'; g.lineWidth = 12; g.beginPath(); g.moveTo(10, 0); g.lineTo(10, h - 22); g.lineTo(w / 2, h * 0.84 - 14); g.lineTo(w - 10, h - 22); g.lineTo(w - 10, 0); g.stroke();
      g.fillStyle = '#f0c454'; g.strokeStyle = '#8a5a12'; g.lineWidth = 4; g.save(); g.translate(w / 2, h * 0.4);
      if (kind === 'crown') {
        g.beginPath(); g.moveTo(-70, 40); g.lineTo(-80, -40); g.lineTo(-40, 0); g.lineTo(0, -60); g.lineTo(40, 0); g.lineTo(80, -40); g.lineTo(70, 40); g.closePath(); g.fill(); g.stroke();
        g.fillRect(-72, 46, 144, 18); g.strokeRect(-72, 46, 144, 18);
        g.fillStyle = '#c8282e'; [[-80, -40], [0, -60], [80, -40]].forEach(p => { g.beginPath(); g.arc(p[0], p[1], 10, 0, TAU); g.fill(); });
      } else {
        g.rotate(Math.PI / 4); g.fillRect(-8, -95, 16, 150); g.strokeRect(-8, -95, 16, 150); g.fillRect(-34, 40, 68, 12); g.rotate(-Math.PI / 2); g.fillRect(-8, -95, 16, 150); g.strokeRect(-8, -95, 16, 150); g.fillRect(-34, 40, 68, 12);
        g.rotate(Math.PI / 4); g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, R = i % 2 ? 14 : 34; g.lineTo(Math.cos(a) * R, Math.sin(a) * R - 4); } g.closePath(); g.fillStyle = '#fff2c0'; g.fill();
      }
      g.restore();
    };
  }
  // tableau de liège : avis épinglés, affiche « RECHERCHÉ », sceaux de cire
  function drawBoard(g, w, h) {
    const r = srng(21); g.fillStyle = '#9c6c40'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,32,12' : '210,160,100'},${0.15 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 2, 2); }
    const note = (x, y, nw, nh, a, poster) => {
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-nw / 2 + 4, -nh / 2 + 5, nw, nh);
      g.fillStyle = poster ? '#efd9a6' : '#f4e7c8'; g.fillRect(-nw / 2, -nh / 2, nw, nh);
      g.fillStyle = 'rgba(70,40,15,0.75)';
      if (poster) {
        g.font = `700 ${Math.round(nw * 0.13)}px Georgia, serif`; g.textAlign = 'center'; g.fillText('RECHERCHÉ', 0, -nh * 0.32);
        g.fillStyle = '#3a2a1c'; g.beginPath(); g.ellipse(0, nh * 0.02, nw * 0.3, nh * 0.24, 0, 0, TAU); g.fill();
        g.fillStyle = '#ff5a2a'; g.beginPath(); g.arc(-nw * 0.1, -nh * 0.02, nw * 0.05, 0, TAU); g.arc(nw * 0.1, -nh * 0.02, nw * 0.05, 0, TAU); g.fill();
        g.fillStyle = 'rgba(70,40,15,0.75)'; g.fillRect(-nw * 0.3, nh * 0.32, nw * 0.6, 4);
      } else for (let k = 0; k < 6; k++) g.fillRect(-nw / 2 + 10, -nh / 2 + 14 + k * (nh - 24) / 6, (nw - 20) * (0.5 + r() * 0.5), 3);
      g.fillStyle = r() < 0.5 ? '#b0202a' : '#2a6ab0'; g.beginPath(); g.arc(0, -nh / 2 + 7, 6, 0, TAU); g.fill();
      if (!poster && r() < 0.6) { g.fillStyle = '#a01a1a'; g.beginPath(); g.arc(nw * 0.28, nh * 0.32, 10, 0, TAU); g.fill(); }
      g.restore();
    };
    note(w * 0.22, h * 0.3, 120, 150, -0.08); note(w * 0.5, h * 0.44, 150, 200, 0.03, true); note(w * 0.8, h * 0.3, 110, 130, 0.1);
    note(w * 0.24, h * 0.74, 130, 110, 0.06); note(w * 0.78, h * 0.72, 120, 120, -0.07);
    g.strokeStyle = '#4a2c12'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
  }
  // ciel du soir vu par la porte
  function drawDusk(g, w, h) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a2a6a'); gr.addColorStop(0.5, '#c8604a'); gr.addColorStop(0.75, '#ffc070'); gr.addColorStop(1, '#5a4030'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1e1a'; g.beginPath(); g.moveTo(0, h * 0.8); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.74 + 0.05 * Math.sin(x * 0.05) + 0.03 * Math.sin(x * 0.17))); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  }
  // fond d'alcôve (lueur chaude derrière les rideaux)
  function drawAlcove(g, w, h) {
    const gr = g.createRadialGradient(w / 2, h * 0.55, 4, w / 2, h * 0.55, h * 0.62); gr.addColorStop(0, '#ffe7b0'); gr.addColorStop(0.35, '#e8963c'); gr.addColorStop(0.75, '#6a2a14'); gr.addColorStop(1, '#1a0a06'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,220,150,0.22)'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { const x = w * (0.1 + i * 0.1); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }

  /* ---------- géométries ---------- */
  // boîte dont les UV suivent la taille réelle (une texture répétée tous les « sc » mètres)
  function tbox(w, h, d, sc) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / sc, uv.getY(i) * dims[f][1] / sc); }
    return g;
  }
  function tplane(w, h, su, sv) { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / su, uv.getY(i) * h / (sv || su)); return g; }
  /** rideau plissé : u (0 -> 1) en travers, v (0 -> 1) de bas en haut ; shape(u, v) -> [x, y, amplitude] ; couleurs : creux plus sombres */
  function drape(segX, segY, folds, amp, shape) {
    const g = new THREE.PlaneGeometry(1, 1, segX, segY), pa = g.attributes.position, col = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) {
      const u = pa.getX(i) + 0.5, v = pa.getY(i) + 0.5, s = shape(u, v), ph = u * folds * TAU;
      pa.setXYZ(i, s[0], s[1], Math.sin(ph) * amp * s[2]);
      const k = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(ph + 0.5)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    return g;
  }
  function archShape(w, h, inset) {
    const s = new THREE.Shape(), r = w / 2 - inset, x0 = -w / 2 + inset, x1 = w / 2 - inset, yTop = h - w / 2;
    s.moveTo(x0, inset); s.lineTo(x1, inset); s.lineTo(x1, yTop); s.absarc(0, yTop, r, 0, Math.PI, false); s.lineTo(x0, inset);
    return s;
  }
  function shirtShape(long) {
    const s = new THREE.Shape(), b = long ? -1.05 : -0.74;
    s.moveTo(-0.11, 0); s.lineTo(-0.29, -0.05); s.lineTo(-0.41, -0.3); s.lineTo(-0.33, -0.35); s.lineTo(-0.23, -0.2); s.lineTo(-0.23 - (long ? 0.08 : 0), b); s.lineTo(0.23 + (long ? 0.08 : 0), b); s.lineTo(0.23, -0.2); s.lineTo(0.33, -0.35); s.lineTo(0.41, -0.3); s.lineTo(0.29, -0.05); s.lineTo(0.11, 0); s.quadraticCurveTo(0, -0.1, -0.11, 0);
    return s;
  }

  /* ---------- fusion : un seul maillage par matériau (quelques appels de dessin pour tout le décor) ---------- */
  function Batch() {
    const parts = {}, nm = new THREE.Matrix3(), v = new V3(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new V3(), sv = new V3();
    function push(key, geo, m4, color) {
      const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv, ca = geo.attributes.color, ix = geo.index, n = ix ? ix.count : pa.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
      nm.getNormalMatrix(m4);
      for (let i = 0; i < n; i++) {
        const k = ix ? ix.getX(i) : i;
        v.fromBufferAttribute(pa, k).applyMatrix4(m4); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        if (na) v.fromBufferAttribute(na, k).applyMatrix3(nm).normalize(); else v.set(0, 1, 0);
        nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z;
        if (ua) { uv[i * 2] = ua.getX(k); uv[i * 2 + 1] = ua.getY(k); }
        const sh = ca ? ca.getX(k) : 1; col[i * 3] = color.r * sh; col[i * 3 + 1] = color.g * (ca ? ca.getY(k) : 1); col[i * 3 + 2] = color.b * (ca ? ca.getZ(k) : 1);
      }
      (parts[key] = parts[key] || []).push({ pos, nor, uv, col });
    }
    const MB = {
      /** primitive (libérée ensuite) : p = position, r = rotation y ou [x, y, z], s = échelle (nombre ou [x, y, z]) */
      add(key, geo, p, r, s, color) {
        if (typeof r === 'number' || r == null) e.set(0, r || 0, 0); else e.set(r[0], r[1], r[2]);
        q.setFromEuler(e); if (s == null) s = 1; if (typeof s === 'number') sv.set(s, s, s); else sv.set(s[0], s[1], s[2]);
        M.compose(pv.set(p[0], p[1], p[2]), q, sv);
        push(key, geo, M, typeof color === 'string' ? L(color) : color); geo.dispose();
        return MB;
      },
      /** primitive avec une matrice déjà calculée (repère d'un objet tourné) */
      addM(key, geo, m4, color) { push(key, geo, m4, typeof color === 'string' ? L(color) : color); geo.dispose(); return MB; },
      box(key, size, p, r, color) { return MB.add(key, new THREE.BoxGeometry(size[0], size[1], size[2]), p, r, 1, color); },
      cyl(key, r0, r1, h, seg, p, r, color) { return MB.add(key, new THREE.CylinderGeometry(r0, r1, h, seg), p, r, 1, color); },
      /** modèle glTF du jeu (vil_*, asc_*) : chaque morceau avec la couleur de son matériau (les « glow_ » brillent) */
      model(name, p, ry, s) {
        const G = BR.Assets && BR.Assets.models && BR.Assets.models[name]; if (!G) return false;
        const root = G.scene; root.updateMatrixWorld(true);
        const P = new THREE.Matrix4().compose(new V3(p[0], p[1], p[2]), new THREE.Quaternion().setFromAxisAngle(UP, ry || 0), new V3(s || 1, s || 1, s || 1));
        root.traverse(o => {
          if (!o.isMesh) return;
          const mat = Array.isArray(o.material) ? o.material[0] : o.material, nmn = mat.name || '', glow = /^glow_/.test(nmn);
          let c = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
          if (glow && mat.emissive && mat.emissive.r + mat.emissive.g + mat.emissive.b > 0) c = mat.emissive.clone();
          push(glow ? 'glow' : 'std', o.geometry, new THREE.Matrix4().multiplyMatrices(P, o.matrixWorld), c);
        });
        return true;
      },
      /** construit les maillages fusionnés ; cast = clés qui projettent une ombre */
      build(B, mats, parent, cast) {
        const out = {};
        for (const key in parts) {
          const list = parts[key]; if (!list.length || !mats[key]) continue;
          let n = 0; list.forEach(x => { n += x.pos.length / 3; });
          const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 3); let o = 0;
          list.forEach(x => { P.set(x.pos, o * 3); N.set(x.nor, o * 3); U.set(x.uv, o * 2); C.set(x.col, o * 3); o += x.pos.length / 3; });
          const g = B.g(new THREE.BufferGeometry());
          g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
          g.computeBoundingSphere();
          const mesh = new THREE.Mesh(g, mats[key]); mesh.castShadow = !!(cast && cast[key]); mesh.receiveShadow = key !== 'glow';
          parent.add(mesh); out[key] = mesh; parts[key] = [];
        }
        return out;
      },
    };
    return MB;
  }

  /* ---------- vue : renderer + post-traitement + taille ---------- */
  function makeView(canvas, o) {
    const q = quality();
    const R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    R.setPixelRatio(o.pr ? o.pr(q) : Math.min(q === 'low' ? 1 : 1.5, window.devicePixelRatio || 1));
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = o.exp || 1.1; R.outputEncoding = THREE.LinearEncoding;
    R.shadowMap.enabled = q !== 'low'; R.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(o.fov || 40, 1, 0.1, 80); scene.userData.cam = cam;
    let post = null;
    try { post = BR.AFX && BR.AFX.post ? BR.AFX.post(R, scene, cam, q === 'low' ? 'low' : 'high') : null; } catch (e) { post = null; }
    if (!post) R.outputEncoding = THREE.sRGBEncoding;
    const V = { R, scene, cam, post, q, w: 0, h: 0 };
    V.fit = () => {
      // (le canvas est posé en absolu dans son cadre : sa taille ne dépend pas de son contenu, pas d'emballement)
      const w = Math.min(4096, Math.round(canvas.clientWidth)) || 0, h = Math.min(4096, Math.round(canvas.clientHeight)) || 0;
      if (!w || !h || (w === V.w && h === V.h)) return;
      V.w = w; V.h = h; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); if (post) post.setSize(w, h);
    };
    V.render = dt => { if (post) post.render(dt); else R.render(scene, cam); };
    V.dispose = () => { try { if (post) post.dispose(); } catch (e) { /* rien */ } R.dispose(); try { R.forceContextLoss(); } catch (e) { /* rien */ } };
    return V;
  }
  // éclairage d'ambiance pour les métaux (or, cuivre) : un petit ciel chaud passé dans PMREM
  function warmEnv(R, B, top, mid, low, spots) {
    const es = new THREE.Scene(), sg = new THREE.SphereGeometry(10, 24, 12), pa = sg.attributes.position, col = new Float32Array(pa.count * 3);
    const T = L(top), M = L(mid), Lo = L(low), c = new THREE.Color();
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 10; if (y > 0) c.copy(M).lerp(T, y); else c.copy(M).lerp(Lo, -y); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    es.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    (spots || []).forEach(s => { const m = new THREE.Mesh(new THREE.SphereGeometry(s[4], 10, 8), new THREE.MeshBasicMaterial({ color: L(s[3]).multiplyScalar(s[5] || 4) })); m.position.set(s[0], s[1], s[2]); es.add(m); });
    let tex = null;
    try { const pm = new THREE.PMREMGenerator(R); const rt = pm.fromScene(es, 0.04); pm.dispose(); B.rt(rt); tex = rt.texture; } catch (e) { tex = null; }
    es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return tex;
  }

  /* ---------- particules (étincelles, braises, poussières) : un seul Points, couleur qui s'éteint (additif) ---------- */
  function Sparks(B, parent, n, size, tex) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const g = B.g(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = B.m(new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; parent.add(pts);
    const P = []; for (let i = 0; i < n; i++) { P.push({ life: 0, max: 1, p: new V3(), v: new V3(), c: new THREE.Color(), grav: 0, drag: 0, wob: 0, ph: Math.random() * 6 }); pos[i * 3 + 1] = -99; }
    let cursor = 0;
    return {
      pts,
      /** o : { v (vitesse), spread, life, color, grav, drag, wob } */
      emit(p, o) {
        const k = P[cursor]; cursor = (cursor + 1) % n;
        k.p.copy(p); const sp = o.spread || 0; if (sp) k.p.add(new V3(rnd(-sp, sp), rnd(-sp, sp) * (o.flatY ? 0.1 : 1), rnd(-sp, sp)));
        k.v.copy(o.v || new V3()); if (o.vr) k.v.add(new V3(rnd(-o.vr, o.vr), rnd(-o.vr, o.vr) * 0.5, rnd(-o.vr, o.vr)));
        k.max = k.life = (o.life || 1) * rnd(0.7, 1.2); k.c.copy(o.color); k.grav = o.grav || 0; k.drag = o.drag || 0; k.wob = o.wob || 0;
      },
      update(dt, t) {
        for (let i = 0; i < n; i++) {
          const k = P[i];
          if (k.life <= 0) { if (pos[i * 3 + 1] !== -99) { pos[i * 3 + 1] = -99; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; } continue; }
          k.life -= dt; k.v.y -= k.grav * dt; if (k.drag) k.v.multiplyScalar(Math.max(0, 1 - k.drag * dt));
          k.p.addScaledVector(k.v, dt);
          if (k.wob) { k.p.x += Math.sin(t * 2.1 + k.ph) * k.wob * dt; k.p.z += Math.cos(t * 1.7 + k.ph) * k.wob * dt; }
          const a = clamp(k.life / k.max, 0, 1), f = Math.min(1, (1 - a) * 8) * a;   // apparition puis extinction douces
          pos[i * 3] = k.p.x; pos[i * 3 + 1] = k.p.y; pos[i * 3 + 2] = k.p.z;
          col[i * 3] = k.c.r * f; col[i * 3 + 1] = k.c.g * f; col[i * 3 + 2] = k.c.b * f;
        }
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      },
    };
  }
  // flammes : quelques sprites additifs qui dansent
  function Flames(B, parent, tex, list) {
    const out = list.map(f => {
      const sp = new THREE.Sprite(B.m(new THREE.SpriteMaterial({ map: tex, color: L(f.c || '#ffb050').multiplyScalar(f.k || 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      sp.position.set(f.p[0], f.p[1], f.p[2]); sp.scale.set(f.w, f.h, 1); sp.center.set(0.5, 0.06); parent.add(sp);
      return { sp, f, ph: Math.random() * 10 };
    });
    return { update(t) { out.forEach(o => { const k = 0.82 + 0.18 * Math.sin(t * (9 + o.ph) + o.ph) * Math.sin(t * 5.3 + o.ph * 2); o.sp.scale.set(o.f.w * (0.9 + 0.1 * Math.sin(t * 7 + o.ph)), o.f.h * k, 1); }); } };
  }
  const flick = (t, s) => 0.78 + 0.12 * Math.sin(t * 11 + s) + 0.07 * Math.sin(t * 23 + s * 3) + 0.05 * Math.sin(t * 3.1 + s);

  /* ---------- miroir : reflet plan (rendu dans une texture depuis une caméra symétrique) ---------- */
  function Mirror(B, geo, size, o) {
    const rt = B.rt(new THREE.WebGLRenderTarget(o.res[0], o.res[1], { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }));
    const tm = new THREE.Matrix4(), vcam = new THREE.PerspectiveCamera();
    const mat = B.m(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: rt.texture }, textureMatrix: { value: tm }, uTint: { value: L(o.tint || '#e8eef2') }, uMin: { value: new THREE.Vector2(size[0], size[1]) }, uSize: { value: new THREE.Vector2(size[2], size[3]) }, uOn: { value: 1 } },
      vertexShader: 'uniform mat4 textureMatrix; uniform vec2 uMin, uSize; varying vec4 vUv; varying vec2 vU; void main(){ vU = (position.xy - uMin) / uSize; vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uTint; uniform float uOn; varying vec4 vUv; varying vec2 vU;
        void main(){
          vec3 c = texture2DProj(tDiffuse, vUv).rgb * uOn + vec3(0.05, 0.045, 0.04) * (1.0 - uOn);
          c *= uTint * 0.86;
          float e = min(min(vU.x, 1.0 - vU.x), min(vU.y, 1.0 - vU.y));
          c *= mix(0.45, 1.0, smoothstep(0.0, 0.1, e));                                   // bords ternis
          c += vec3(1.0, 0.93, 0.8) * 0.07 * smoothstep(0.09, 0.0, abs(vU.x - vU.y * 0.55 - 0.12));   // reflet en biais
          c += vec3(1.0, 0.93, 0.8) * 0.035 * smoothstep(0.05, 0.0, abs(vU.x - vU.y * 0.55 - 0.3));
          gl_FragColor = vec4(c, 1.0);
          #include <encodings_fragment>
        }`,
    }));
    const mesh = new THREE.Mesh(geo, mat);
    const rp = new V3(), cp = new V3(), nrm = new V3(), view = new V3(), look = new V3(), tgt = new V3(), rot = new THREE.Matrix4(), plane = new THREE.Plane(), clip = new THREE.Vector4(), qq = new THREE.Vector4();
    mesh.userData.update = (R, scene, cam) => {
      rp.setFromMatrixPosition(mesh.matrixWorld); cp.setFromMatrixPosition(cam.matrixWorld);
      rot.extractRotation(mesh.matrixWorld); nrm.set(0, 0, 1).applyMatrix4(rot);
      view.subVectors(rp, cp); if (view.dot(nrm) > 0) return;
      view.reflect(nrm).negate(); view.add(rp);
      rot.extractRotation(cam.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot); look.add(cp);
      tgt.subVectors(rp, look); tgt.reflect(nrm).negate(); tgt.add(rp);
      vcam.position.copy(view); vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(nrm); vcam.lookAt(tgt);
      vcam.far = cam.far; vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(cam.projectionMatrix);
      tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1); tm.multiply(vcam.projectionMatrix); tm.multiply(vcam.matrixWorldInverse); tm.multiply(mesh.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(nrm, rp); plane.applyMatrix4(vcam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const pm = vcam.projectionMatrix.elements;
      qq.x = (Math.sign(clip.x) + pm[8]) / pm[0]; qq.y = (Math.sign(clip.y) + pm[9]) / pm[5]; qq.z = -1; qq.w = (1 + pm[10]) / pm[14];
      clip.multiplyScalar(2 / clip.dot(qq)); pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1 - 0.003; pm[14] = clip.w;
      mesh.visible = false;
      const prev = R.getRenderTarget(), au = R.shadowMap.autoUpdate; R.shadowMap.autoUpdate = false;
      R.setRenderTarget(rt); R.clear(); R.render(scene, vcam); R.setRenderTarget(prev);
      R.shadowMap.autoUpdate = au; mesh.visible = true;
    };
    mesh.userData.off = () => { mat.uniforms.uOn.value = 0; };
    return mesh;
  }

  // retire et libère un personnage (avatar.dispose ne libère pas les matériaux de ses sprites : yeux, halo)
  function killAv(av) {
    if (!av) return;
    if (av.group.parent) av.group.parent.remove(av.group);
    av.group.traverse(o => { if (o.isSprite && o.material) o.material.dispose(); });
    av.dispose();
  }

  /* ---------- couronne de l'hôte (or + gemmes) ---------- */
  function crownGeo(B) {
    const MB = Batch(), gold = L('#ffc94a'), gem = L('#ff3a4a');
    MB.add('k', new THREE.CylinderGeometry(0.15, 0.13, 0.08, 14, 1, true), [0, 0, 0], 0, 1, gold);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; MB.add('k', new THREE.ConeGeometry(0.035, 0.11, 4), [Math.cos(a) * 0.14, 0.085, Math.sin(a) * 0.14], 0, 1, gold); MB.add('k', new THREE.SphereGeometry(0.02, 6, 4), [Math.cos(a) * 0.15, 0.145, Math.sin(a) * 0.15], 0, 1, gold); }
    for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; MB.add('k', new THREE.OctahedronGeometry(0.025), [Math.cos(a) * 0.148, 0, Math.sin(a) * 0.148], 0, 1, i % 2 ? gem : L('#4ab0ff')); }
    const grp = new THREE.Group();
    MB.build(B, { k: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.28, emissive: L('#5a3a00'), side: THREE.DoubleSide })) }, grp);
    return grp;
  }

  /* =====================================================================
     LE SALON : salle des aventuriers d'une taverne
     ===================================================================== */
  // caméra et lieux (mètres) : les joueurs sont au centre, devant la cheminée du fond
  const LG = { cam: new V3(0, 2.25, 7.0), look: new V3(0, 1.3, -0.45), door: new V3(-3.4, 0, -4.6), wallZ: -4.6 };
  // hauteur du sommet du personnage au-dessus de l'os de la tête (casques, chapeaux, cornes…), mesurée debout
  const _bb = new THREE.Box3(), _tb = new THREE.Box3(), _hp = new V3();
  function headroom(av) {
    av.group.updateMatrixWorld(true); _bb.makeEmpty();
    av.group.traverseVisible(o => {
      if (!o.isMesh || !o.geometry || o.isSprite) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && (m.transparent || m.blending === THREE.AdditiveBlending)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); _bb.union(_tb);
    });
    if (!av.head || _bb.isEmpty()) return 0.75;
    av.head.getWorldPosition(_hp); return clamp(_bb.max.y - _hp.y, 0.35, 1.4);
  }
  S.lounge = function (container, opt) {
    opt = opt || {};
    const B = Bag();
    const canvas = document.createElement('canvas'); canvas.className = 'l3-gl'; container.appendChild(canvas);
    const tags = BR.el('div', { class: 'l3-tags' }); container.appendChild(tags);
    const V = makeView(canvas, { fov: 38, exp: 1.15 }), scene = V.scene, cam = V.cam;
    if (V.post) { V.post.grade.uVig.value = 0.62; V.post.bloom.strength = 0.55; V.post.bloom.threshold = 0.85; V.post.bloom.radius = 0.6; }
    scene.background = L('#0c0705'); scene.fog = new THREE.Fog(L('#140b06'), 13, 26);
    scene.environment = warmEnv(V.R, B, '#2a1a10', '#6a3a1c', '#1a0e08', [[0, 0.6, -4.4, '#ff8a2a', 1.2, 5], [2.6, 3.3, 1.4, '#ffc070', 0.5, 4], [-2.6, 3.3, 1.4, '#ffc070', 0.5, 4]]);
    const T = { glow: ctex(B, 'glow', 64, 64, drawGlow), flame: ctex(B, 'flame', 64, 128, drawFlame) };

    /* --- lumières --- */
    scene.add(new THREE.HemisphereLight(L('#ffcf9a'), L('#24140a'), 0.5));
    const fireL = new THREE.PointLight(L('#ff8030'), 2.6, 12, 1.5); fireL.position.set(0, 0.75, -3.55); scene.add(fireL);
    const key = new THREE.SpotLight(L('#ffd9a8'), 1.35, 24, 0.62, 0.7, 1.1); key.position.set(2.4, 4.3, 5.6); key.target.position.set(0, 0.7, -0.6); scene.add(key, key.target);
    if (V.R.shadowMap.enabled) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.camera.near = 2; key.shadow.camera.far = 16; }
    const rim = new THREE.DirectionalLight(L('#7f9cff'), 0.32); rim.position.set(-4, 5, -6); scene.add(rim);
    const lampL = [-2.7, 2.7].map(x => { const l = new THREE.PointLight(L('#ffb466'), 0.9, 8, 1.6); l.position.set(x, 3.2, 1.3); scene.add(l); return l; });
    const doorL = new THREE.PointLight(L('#ffc890'), 0, 6, 1.5); doorL.position.set(LG.door.x, 1.6, LG.door.z + 0.6); scene.add(doorL);

    /* --- matériaux --- */
    const tPlank = ctex(B, 'plank', 512, 512, (g, w, h) => drawPlanks(g, w, h, { hue: 26, sat: 42, lum: 34, seed: 3 }), { wrap: true });
    const tPlaster = ctex(B, 'plaster', 512, 512, drawPlaster, { wrap: true });
    const tStone = ctex(B, 'stone', 512, 512, drawStone, { wrap: true });
    const M = {
      std: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.45 })),
      deco: null,
      plank: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, map: tPlank, roughness: 0.72, envMapIntensity: 0.5 })),
      plaster: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, map: tPlaster, roughness: 0.95, envMapIntensity: 0.3 })),
      stone: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, map: tStone, roughness: 0.95, envMapIntensity: 0.3 })),
      gold: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.75, emissive: L('#2a1600'), envMapIntensity: 1.2 })),
      glow: B.m(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.7, 1.7, 1.7) })),
    };
    M.deco = M.std;
    const W = { dark: '#3e2614', mid: '#6e4526', light: '#9a6a3c', soot: '#120a06', iron: '#2e2a28' };

    /* --- le décor (fusionné) --- */
    const MB = Batch(), root = new THREE.Group(); scene.add(root);
    // sol, plafond, poutres
    MB.add('plank', tplane(16, 15, 2.2), [0, 0, 2.3], [-Math.PI / 2, 0, 0], 1, '#c89a72');
    MB.add('plank', tplane(16, 15, 2.6), [0, 4.85, 2.3], [Math.PI / 2, 0, 0], 1, '#5a4030');
    [-3.3, -0.4, 2.5].forEach(z => MB.box('deco', [16, 0.32, 0.34], [0, 4.55, z], 0, W.dark));
    // mur du fond : enduit + colombages, ouverture de la porte (x -4.05 … -2.75, y < 2.35)
    const dx0 = LG.door.x - 0.65, dx1 = LG.door.x + 0.65, dh = 2.35, wz = LG.wallZ;
    const wall = (x0, x1, y0, y1) => MB.add('plaster', tplane(x1 - x0, y1 - y0, 2.5), [(x0 + x1) / 2, (y0 + y1) / 2, wz], 0, 1, '#ffffff');
    wall(-8, dx0, 0, 4.9); wall(dx1, 8, 0, 4.9); wall(dx0, dx1, dh, 4.9);
    [[-7.2], [-4.95], [4.7], [7.2]].forEach(([x]) => MB.box('std', [0.3, 4.9, 0.3], [x, 2.45, wz + 0.1], 0, W.dark));
    MB.box('std', [16, 0.3, 0.3], [0, 4.3, wz + 0.1], 0, W.dark);
    MB.box('std', [16, 0.22, 0.26], [0, 2.95, wz + 0.08], 0, W.mid);
    [[-6.1, 2.95, 0.6], [6.05, 2.95, -0.6]].forEach(([x, y, a]) => MB.box('std', [0.22, 1.9, 0.24], [x, y + 0.5, wz + 0.08], [0, 0, a], W.mid));
    // lambris bas (coupé par la porte)
    [[-8, dx0], [dx1, 8]].forEach(([a, b]) => { MB.box('std', [b - a, 1.05, 0.1], [(a + b) / 2, 0.525, wz + 0.05], 0, W.mid); MB.box('std', [b - a, 0.08, 0.16], [(a + b) / 2, 1.08, wz + 0.08], 0, W.dark); });
    // murs de côté
    [-7.6, 7.6].forEach(x => { MB.add('plaster', tplane(15, 4.9, 2.5), [x, 2.45, 2.9], [0, -Math.sign(x) * Math.PI / 2, 0], 1, '#e8d8c0'); MB.box('std', [0.12, 1.05, 15], [x - Math.sign(x) * 0.05, 0.525, 2.9], 0, W.mid); [-2.5, 1.5, 5.5].forEach(z => MB.box('std', [0.3, 4.9, 0.3], [x - Math.sign(x) * 0.12, 2.45, z], 0, W.dark)); });
    // cheminée : manteau de pierre, foyer, linteau en bois
    const cz = wz + 0.3;
    MB.add('stone', tbox(0.75, 1.4, 0.62, 1.4), [-1.27, 0.7, cz], 0, 1, '#ffffff');
    MB.add('stone', tbox(0.75, 1.4, 0.62, 1.4), [1.27, 0.7, cz], 0, 1, '#ffffff');
    MB.add('stone', tbox(3.3, 3.5, 0.62, 1.4), [0, 3.15, cz], 0, 1, '#ffffff');
    MB.box('std', [1.8, 1.4, 0.1], [0, 0.7, wz + 0.04], 0, W.soot);
    MB.box('std', [0.1, 1.4, 0.55], [-0.86, 0.7, cz], 0, W.soot); MB.box('std', [0.1, 1.4, 0.55], [0.86, 0.7, cz], 0, W.soot); MB.box('std', [1.8, 0.1, 0.55], [0, 1.36, cz], 0, W.soot);
    MB.add('stone', tbox(3.0, 0.14, 0.75, 1.4), [0, 0.07, wz + 0.95], 0, 1, '#d8ccc0');
    MB.box('std', [3.6, 0.2, 0.5], [0, 1.5, wz + 0.78], 0, W.dark);
    [-1.55, 1.55].forEach(x => MB.box('std', [0.18, 0.28, 0.3], [x, 1.32, wz + 0.78], 0, W.dark));
    // bûches et braises
    MB.cyl('std', 0.08, 0.08, 1.1, 7, [0, 0.14, wz + 0.42], [0, 0.25, Math.PI / 2], '#3a2414');
    MB.cyl('std', 0.07, 0.07, 1.0, 7, [0.05, 0.27, wz + 0.4], [0, -0.35, Math.PI / 2], '#4a2c16');
    MB.cyl('std', 0.065, 0.065, 0.9, 7, [-0.1, 0.36, wz + 0.45], [0.2, 0.1, Math.PI / 2 - 0.15], '#33200f');
    MB.box('glow', [1.3, 0.05, 0.35], [0, 0.1, wz + 0.42], 0, '#ff5a14');
    // sur le manteau : bougies, chopes, coupe dorée
    [-1.35, 1.35].forEach(x => { MB.cyl('std', 0.045, 0.045, 0.22, 8, [x, 1.71, wz + 0.78], 0, '#efe2c2'); MB.cyl('gold', 0.08, 0.1, 0.04, 10, [x, 1.62, wz + 0.78], 0, '#ffc94a'); });
    [-0.9, -0.72].forEach(x => MB.cyl('std', 0.07, 0.07, 0.16, 9, [x, 1.68, wz + 0.82], 0, '#8a6038'));
    MB.cyl('gold', 0.09, 0.05, 0.14, 10, [0.85, 1.67, wz + 0.8], 0, '#ffc94a'); MB.cyl('gold', 0.025, 0.025, 0.08, 6, [0.85, 1.63, wz + 0.8], 0, '#ffc94a'); MB.cyl('gold', 0.07, 0.07, 0.02, 10, [0.85, 1.6, wz + 0.8], 0, '#ffc94a');
    // la grande carte au-dessus du manteau (cadre en bois)
    MB.box('std', [2.66, 1.8, 0.08], [0, 2.62, wz + 0.64], 0, W.dark);
    // porte : encadrement, seuil
    MB.box('std', [0.2, dh + 0.1, 0.36], [dx0 - 0.08, (dh + 0.1) / 2, wz + 0.05], 0, W.dark); MB.box('std', [0.2, dh + 0.1, 0.36], [dx1 + 0.08, (dh + 0.1) / 2, wz + 0.05], 0, W.dark);
    MB.box('std', [1.7, 0.24, 0.4], [LG.door.x, dh + 0.08, wz + 0.05], 0, W.dark); MB.box('std', [1.4, 0.04, 0.5], [LG.door.x, 0.02, wz + 0.1], 0, '#5a4a3e');
    MB.box('glow', [0.28, 0.34, 0.06], [dx1 + 0.42, 2.2, wz + 0.16], 0, '#ffc070'); MB.box('std', [0.34, 0.06, 0.2], [dx1 + 0.42, 2.0, wz + 0.16], 0, W.iron); MB.box('std', [0.34, 0.06, 0.12], [dx1 + 0.42, 2.4, wz + 0.16], 0, W.iron);
    // tableau de liège (à droite de la cheminée)
    MB.box('std', [1.9, 1.38, 0.08], [3.55, 1.95, wz + 0.05], 0, W.dark);
    // tringles des bannières
    [-2.3, 2.3].forEach(x => { MB.cyl('gold', 0.03, 0.03, 1.15, 8, [x, 4.12, wz + 0.2], [0, 0, Math.PI / 2], '#ffc94a'); MB.add('gold', new THREE.SphereGeometry(0.05, 8, 6), [x - 0.6, 4.12, wz + 0.2], 0, 1, '#ffc94a'); MB.add('gold', new THREE.SphereGeometry(0.05, 8, 6), [x + 0.6, 4.12, wz + 0.2], 0, 1, '#ffc94a'); });
    // lanternes suspendues
    [-2.7, 2.7].forEach(x => {
      MB.box('deco', [0.03, 1.15, 0.03], [x, 4.0, 1.3], 0, W.iron);
      MB.box('std', [0.34, 0.05, 0.34], [x, 3.43, 1.3], 0, W.iron); MB.box('std', [0.3, 0.05, 0.3], [x, 2.95, 1.3], 0, W.iron); MB.add('std', new THREE.ConeGeometry(0.24, 0.16, 4), [x, 3.52, 1.3], Math.PI / 4, 1, W.iron);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => MB.box('std', [0.03, 0.46, 0.03], [x + a * 0.14, 3.19, 1.3 + b * 0.14], 0, W.iron));
      MB.box('glow', [0.2, 0.36, 0.2], [x, 3.19, 1.3], 0, '#ffb45a');
    });
    // meubles du village (fusionnés) : tables, tonneaux, caisses, bûches
    MB.model('vil_table', [-4.7, 0, -0.9], 0.25, 0.85); MB.model('vil_table', [4.8, 0, -0.7], -0.3, 0.85);
    MB.model('vil_barrels', [5.5, 0, -3.5], -0.5, 0.8); MB.model('vil_crates', [-5.9, 0, -3.6], 0.35, 0.75);
    MB.model('vil_woodpile', [2.35, 0, wz + 0.5], 0, 0.36);
    // bougies sur les tables
    [[-4.7, -0.9], [4.8, -0.7]].forEach(([x, z]) => { MB.cyl('std', 0.04, 0.04, 0.16, 8, [x + 0.25, 1.03, z + 0.1], 0, '#efe2c2'); });
    MB.build(B, M, root, { std: true });

    // textures : carte, bannières, tableau, tapis, ciel de la porte
    const plane = (tex, w, h, p, r, o) => { const m = new THREE.Mesh(B.g(new THREE.PlaneGeometry(w, h, (o && o.sx) || 1, (o && o.sy) || 1)), B.m(new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: 0.9, envMapIntensity: 0.4 }, (o && o.mat) || {})))); m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); m.receiveShadow = true; root.add(m); return m; };
    plane(ctex(B, 'map', 1024, 680, drawMap), 2.46, 1.6, [0, 2.62, wz + 0.69]);
    plane(ctex(B, 'board', 512, 384, drawBoard), 1.76, 1.24, [3.55, 1.95, wz + 0.1]);
    plane(ctex(B, 'rug', 1024, 512, drawRug(false)), 6.2, 3.1, [0, 0.012, -0.15], [-Math.PI / 2, 0, 0], { mat: { roughness: 1 } });
    const sky = new THREE.Mesh(B.g(new THREE.PlaneGeometry(1.6, 2.6)), B.m(new THREE.MeshBasicMaterial({ map: ctex(B, 'dusk', 128, 256, drawDusk), color: new THREE.Color(1.4, 1.3, 1.2) }))); sky.position.set(LG.door.x, 1.25, wz - 0.25); root.add(sky);
    const banners = [['#8c1424', 'crown', -2.3], ['#1c3a7a', 'swords', 2.3]].map(([c, k, x]) => {
      const m = plane(ctex(B, 'ban_' + k, 256, 512, drawBanner(c, k)), 0.95, 2.05, [x, 4.1 - 1.02, wz + 0.24], null, { sx: 4, sy: 10, mat: { side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.85 } });
      m.castShadow = false; const pa = m.geometry.attributes.position; m.userData.base = Float32Array.from(pa.array); return m;
    });
    // porte : battant qui pivote sur ses gonds
    const door = new THREE.Group(); door.position.set(dx0 + 0.02, 0, wz + 0.06); root.add(door);
    { const DB = Batch(); for (let i = 0; i < 5; i++) DB.box('std', [0.24, dh - 0.04, 0.07], [0.14 + i * 0.25, (dh - 0.04) / 2, 0], 0, i % 2 ? '#6a4224' : '#77492a'); [0.5, 1.75].forEach(y => DB.box('std', [1.22, 0.08, 0.09], [0.62, y, 0.02], 0, W.iron)); DB.add('std', new THREE.TorusGeometry(0.07, 0.015, 6, 12), [1.08, 1.15, 0.07], 0, 1, W.iron); DB.build(B, M, door, { std: true }); }
    let doorT = 0, doorOpen = 0;

    /* --- feu, braises, poussières --- */
    const fire = Flames(B, root, T.flame, [
      { p: [0, 0.12, wz + 0.45], w: 0.65, h: 0.95, k: 2.4 }, { p: [-0.32, 0.12, wz + 0.42], w: 0.45, h: 0.7, k: 2.0 }, { p: [0.33, 0.12, wz + 0.42], w: 0.42, h: 0.62, k: 2.0, c: '#ff9a3a' },
      { p: [0.12, 0.1, wz + 0.5], w: 0.3, h: 0.45, k: 2.6, c: '#ffd070' },
      { p: [-1.35, 1.82, wz + 0.78], w: 0.07, h: 0.14, k: 2.4, c: '#ffc060' }, { p: [1.35, 1.82, wz + 0.78], w: 0.07, h: 0.14, k: 2.4, c: '#ffc060' },
      { p: [-4.45, 1.11, -0.8], w: 0.07, h: 0.14, k: 2.4, c: '#ffc060' }, { p: [5.05, 1.11, -0.6], w: 0.07, h: 0.14, k: 2.4, c: '#ffc060' },
    ]);
    const embers = Sparks(B, root, 70, 0.07, T.glow), dust = Sparks(B, root, 110, 0.05, T.glow), sparks = Sparks(B, root, 160, 0.09, T.glow);
    const petals = BR.AscFX && BR.AscFX.petals ? BR.AscFX.petals(scene) : null;

    /* --- bancs et places --- */
    const benchG = new THREE.Group(); root.add(benchG);
    const ringGeo = B.g(new THREE.RingGeometry(0.42, 0.52, 48)), discGeo = B.g(new THREE.CircleGeometry(0.62, 40)), pillarGeo = B.g(new THREE.CylinderGeometry(0.5, 0.58, 2.6, 24, 1, true));
    { const pa = pillarGeo.attributes.position, col = new Float32Array(pa.count * 3); for (let i = 0; i < pa.count; i++) { const k = Math.pow(1 - (pa.getY(i) + 1.3) / 2.6, 1.6); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; } pillarGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    const G = { slots: [], n: 0, players: new Map(), first: true, self: null, host: null, t: 0 };
    let benchMesh = [];
    function buildSlots(n) {
      benchMesh.forEach(m => { benchG.remove(m); m.geometry.dispose(); B.geos.delete(m.geometry); }); benchMesh = [];
      G.slots.forEach(s => { root.remove(s.fx); s.tag.remove(); s.mats.forEach(m => { m.dispose(); B.mats.delete(m); }); });
      G.slots = []; G.n = n;
      const nb = Math.ceil(n / 2), SB = Batch(), sp = n > 4 ? 2.0 : 2.3;
      for (let b = 0; b < nb; b++) {
        const bx = (b - (nb - 1) / 2) * sp, bz = -0.75 - Math.abs(bx) * 0.16, ry = -Math.atan2(bx, LG.cam.z - bz) * 0.6;
        if (!SB.model('vil_bench', [bx, 0, bz], ry, 1)) { SB.box('std', [1.9, 0.08, 0.42], [bx, 0.46, bz], ry, W.light); SB.box('std', [0.1, 0.46, 0.36], [bx - 0.8, 0.23, bz], ry, W.dark); SB.box('std', [0.1, 0.46, 0.36], [bx + 0.8, 0.23, bz], ry, W.dark); }
        const fw = new V3(Math.sin(ry), 0, Math.cos(ry)), rt = new V3(Math.cos(ry), 0, -Math.sin(ry));
        [-1, 1].forEach(sd => {
          if (G.slots.length >= n) return;
          const seat = new V3(bx, 0, bz).addScaledVector(rt, sd * 0.48), pos = seat.clone().addScaledVector(fw, 0.42);
          const mats = [B.m(new THREE.MeshBasicMaterial({ color: L('#ffc84a').multiplyScalar(2), map: null, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })),
            B.m(new THREE.MeshBasicMaterial({ color: L('#ffb030'), map: T.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })),
            B.m(new THREE.MeshBasicMaterial({ color: L('#ffcf6a'), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide }))];
          const fx = new THREE.Group(); fx.position.copy(pos); fx.position.y = 0.02;
          const ring = new THREE.Mesh(ringGeo, mats[0]); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01;
          const disc = new THREE.Mesh(discGeo, mats[1]); disc.rotation.x = -Math.PI / 2; disc.scale.setScalar(1.5);
          const pillar = new THREE.Mesh(pillarGeo, mats[2]); pillar.position.y = 1.3;
          fx.add(disc, ring, pillar); root.add(fx);
          const tag = BR.el('div', { class: 'l3-tag empty' }, BR.el('div', { class: 'l3-n' }, 'Place libre')); tags.appendChild(tag);
          G.slots.push({ pos, ry: Math.atan2(LG.cam.x - pos.x, LG.cam.z - pos.z), fx, ring, mats, tag, glow: 0, empty: 0, owner: null });
        });
      }
      benchMesh = Object.values(SB.build(B, M, benchG, { std: true, glow: false }));
    }

    /* --- les joueurs --- */
    const crownTpl = crownGeo(B);
    const tmp = new V3(), tmp2 = new V3();
    function makeAvatar(P, look) {
      killAv(P.av);
      const av = BR.Avatar.build(look); av.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
      av.update(0.01, 0, {}); P.top = headroom(av);
      av.group.position.copy(P.pos); av.group.rotation.y = P.ry; av.group.scale.setScalar(Math.max(0.001, P.scale)); scene.add(av.group);
      av.base = P.sit ? 'Sit_Chair_Idle' : P.ready || P.host ? '2H_Melee_Idle' : null; av.update(0.01, 0, {});
      P.av = av; P.key = lookKey(look);
    }
    function addPlayer(p, slot, viaDoor) {
      const s = G.slots[slot];
      const P = { id: p.id, slot, av: null, key: '', pos: s.pos.clone(), ry: s.ry, scale: viaDoor ? 1 : 0.001, grow: viaDoor ? 1 : 0, sit: false, ready: !!p.ready, host: p.id === G.host, wasReady: false, fresh: true, path: [], queue: [], leaving: 0, t: rnd(0, 4), flourish: rnd(7, 12), crown: null, tag: null };
      P.sit = !(p.ready || p.id === G.host) && !viaDoor;
      if (viaDoor) { P.pos.set(LG.door.x + rnd(-0.15, 0.15), 0, LG.wallZ - 0.4); P.path = pathTo(s); P.ry = 0; doorT = 3.2; }
      makeAvatar(P, p.look);
      P.tag = BR.el('div', { class: 'l3-tag' }); tags.appendChild(P.tag);
      if (!viaDoor && petals) petals.gather(P.pos.clone().setY(0), 1.9, 0.45, ['#ffffff', '#ffe9a8', '#ffd76a'], 80, 1.1);
      s.owner = P.id; G.players.set(p.id, P);
      return P;
    }
    // de la porte du fond jusqu'à sa place, en contournant les bancs par l'avant
    function pathTo(s) {
      const front = Math.max(...G.slots.map(x => x.pos.z)) + 0.85, left = Math.min(...G.slots.map(x => x.pos.x)) - 1.1;
      return [new V3(LG.door.x, 0, LG.wallZ + 1.1), new V3(Math.min(left, LG.door.x + 0.6), 0, front - 0.3), new V3(s.pos.x, 0, front), s.pos.clone()];
    }
    function leave(P) {
      P.leaving = 0.55; P.path = []; if (G.slots[P.slot] && G.slots[P.slot].owner === P.id) G.slots[P.slot].owner = null;
      if (petals) petals.burst(P.av.group.position.clone(), 1.8, 0.4, ['#ffffff', '#ffe9a8', '#ffd76a'], 90, 1);
      if (P.tag) { P.tag.remove(); P.tag = null; }
    }
    function drop(P) {
      killAv(P.av); P.av = null;
      if (P.crown) { scene.remove(P.crown); P.crown = null; }
      if (P.tag) P.tag.remove();
      G.players.delete(P.id);
    }
    const esc = BR.esc || (s => String(s));
    function paintTag(P, p, canKick) {
      const st = P.host ? 'Hôte' : P.ready ? '<em>PRÊT</em>' : 'En attente…';
      const html = `<div class="l3-n">${P.host ? BR.Icons.svg('crown', 15, 'gold') : ''}<span>${esc(p.name)}</span></div><div class="l3-s">Niv. ${esc(p.level || 1)}${P.me ? ' · toi' : ''} · ${st}</div>` + (canKick && !P.me ? `<button class="l3-k" data-l="kick" data-id="${esc(p.id)}" title="Exclure">${BR.Icons.svg('x', 12)}</button>` : '');
      if (P.tag.dataset.h !== html) { P.tag.innerHTML = html; P.tag.dataset.h = html; }
      P.tag.className = 'l3-tag' + (P.ready || P.host ? ' rdy' : '') + (P.host ? ' host' : '') + (P.me ? ' me' : '');
    }
    // posture voulue : debout si prêt ou hôte, assis sinon (avec transitions animées)
    function posture(P, anim) {
      const av = P.av; if (!av || P.path.length || P.leaving) return;
      if (!(P.ready || P.host)) { if (!P.sit) { P.sit = true; P.queue = []; av.base = 'Sit_Chair_Idle'; if (anim) av.act('Sit_Chair_Down', { fade: 0.2 }); } }
      else {
        av.base = '2H_Melee_Idle';
        if (P.sit) { P.sit = false; if (anim) av.act('Sit_Chair_StandUp', { fade: 0.15 }); if (P.ready) P.queue = anim ? ['Cheer'] : []; }
        else if (P.ready && !P.wasReady) P.queue = ['Cheer'];
      }
      P.wasReady = P.ready;
    }

    function update(room, selfId) {
      if (!room || dead) return;
      G.host = room.host; G.self = selfId;
      const n = clamp(Math.max(room.max || 4, room.players.length), 1, 8);
      if (n !== G.n) {
        buildSlots(n);
        G.players.forEach(P => { if (!P.leaving) P.slot = -1; });
      }
      const canKick = room.host === selfId, seen = new Set();
      room.players.forEach(p => {
        seen.add(p.id);
        let P = G.players.get(p.id);
        if (P && P.leaving) { drop(P); P = null; }
        if (!P) {
          const slot = G.slots.findIndex(s => !s.owner); if (slot < 0) return;
          P = addPlayer(p, slot, !G.first && !!LG.door);
        } else if (P.slot < 0 || P.slot >= G.slots.length) {
          const slot = G.slots.findIndex(s => !s.owner); if (slot < 0) return;
          // nouvelle disposition des places : il réapparaît à la sienne dans un tourbillon de pétales
          const s = G.slots[slot]; P.slot = slot; s.owner = P.id; P.path = []; P.pos.copy(s.pos); P.ry = s.ry; P.grow = 0; P.scale = 0.001;
          if (petals) petals.gather(s.pos.clone(), 1.9, 0.45, ['#ffffff', '#ffe9a8', '#ffd76a'], 60, 0.9);
        }
        if (P.key !== lookKey(p.look)) { makeAvatar(P, p.look); if (petals) petals.gather(P.pos.clone(), 1.9, 0.45, ['#ffffff', '#ffe9a8', '#ffd76a'], 60, 0.9); }
        P.ready = !!p.ready; P.host = p.id === room.host; P.me = p.id === selfId;
        paintTag(P, p, canKick); posture(P, !P.fresh); P.fresh = false;
      });
      G.players.forEach(P => { if (!seen.has(P.id) && !P.leaving) leave(P); });
      G.first = false;
    }

    /* --- caméra (légère dérive + parallaxe à la souris) --- */
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = e => { const r = container.getBoundingClientRect(); mouse.tx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); mouse.ty = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1); };
    window.addEventListener('pointermove', onMove);

    /* --- boucle --- */
    let raf = 0, last = performance.now(), dead = false, gone = 0;
    const proj = new V3();
    function frame(now) {
      if (dead) return; raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      if (!canvas.isConnected) { if (++gone > 90) api.dispose(); return; }
      gone = 0; if (document.hidden || !canvas.offsetParent) return;
      V.fit(); if (!V.w) return;
      tick(dt); V.render(dt);
    }
    function tick(dt) {
      const t = (G.t += dt);
      // caméra : on recadre selon la largeur (les panneaux HTML couvrent les côtés)
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 2); mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 2);
      const narrow = clamp(1.78 / Math.max(0.8, cam.aspect), 1, 1.7);
      cam.position.set(LG.cam.x + Math.sin(t * 0.13) * 0.3 + mouse.x * 0.45, LG.cam.y + Math.sin(t * 0.21) * 0.06 - mouse.y * 0.18, LG.cam.z * (0.88 + 0.12 * narrow) + Math.sin(t * 0.1) * 0.15);
      cam.lookAt(LG.look.x + mouse.x * 0.15, LG.look.y, LG.look.z);
      // feu et lumières
      fireL.intensity = 2.6 * flick(t, 0); lampL.forEach((l, i) => { l.intensity = 0.9 * (0.92 + 0.08 * flick(t * 0.6, i * 3)); });
      fire.update(t);
      if (Math.random() < dt * 22) embers.emit(new V3(rnd(-0.5, 0.5), 0.35, LG.wallZ + 0.5), { v: new V3(rnd(-0.1, 0.1), rnd(0.5, 0.9), rnd(0.15, 0.4)), life: 2.2, color: L('#ff9030').multiplyScalar(2.5), wob: 0.4, drag: 0.2 });
      if (Math.random() < dt * 18) dust.emit(new V3(rnd(-5, 5), rnd(0.3, 4), rnd(-4, 4)), { v: new V3(rnd(-0.04, 0.04), rnd(-0.02, 0.04), rnd(-0.04, 0.04)), life: 7, color: L('#ffd8a0').multiplyScalar(0.55), wob: 0.08 });
      embers.update(dt, t); dust.update(dt, t); sparks.update(dt, t); if (petals) petals.update(dt);
      // bannières qui ondulent doucement
      banners.forEach((m, bi) => { const pa = m.geometry.attributes.position, b0 = m.userData.base; for (let i = 0; i < pa.count; i++) { const y = b0[i * 3 + 1], k = (1.02 - y) / 2.05; pa.array[i * 3 + 2] = b0[i * 3 + 2] + Math.sin(t * 1.3 + y * 2.2 + bi + b0[i * 3] * 1.5) * 0.05 * k; } pa.needsUpdate = true; });
      // porte (s'ouvre pour laisser entrer)
      doorT = Math.max(0, doorT - dt); doorOpen += ((doorT > 0 ? 1 : 0) - doorOpen) * Math.min(1, dt * 3.2);
      door.rotation.y = -1.5 * smooth(clamp(doorOpen, 0, 1)); doorL.intensity = 1.4 * doorOpen;
      // places : anneau doré / place libre
      G.slots.forEach(s => {
        const P = s.owner && G.players.get(s.owner), on = P && !P.path.length && !P.leaving ? (P.ready ? 1 : P.host ? 0.45 : 0) : 0;
        s.glow += (on - s.glow) * Math.min(1, dt * 3);
        s.mats[0].opacity = s.glow * 0.85 + (P ? 0 : 0.14); s.mats[1].opacity = s.glow * 0.55; s.mats[2].opacity = s.glow * 0.13;
        s.ring.rotation.z += dt * 0.6; s.ring.scale.setScalar(1 + Math.sin(t * 2.4 + s.pos.x) * 0.03 * s.glow);
        if (s.glow > 0.5 && Math.random() < dt * 9) sparks.emit(tmp.copy(s.pos).setY(0.05), { spread: 0.45, flatY: true, v: new V3(0, rnd(0.6, 1.3), 0), life: 1.4, color: L('#ffc84a').multiplyScalar(2), wob: 0.3 });
        // étiquette « place libre »
        s.empty += ((P ? 0 : 1) - s.empty) * Math.min(1, dt * 4);
        if (s.empty > 0.02) { tmp.copy(s.pos).setY(1.0); placeTag(s.tag, tmp, s.empty * 0.85); } else if (s.tag.style.opacity !== '0') s.tag.style.opacity = '0';
      });
      // joueurs
      G.players.forEach(P => {
        const av = P.av; if (!av) return;
        let speed = 0;
        if (P.leaving) { P.leaving -= dt; P.scale = Math.max(0.001, P.leaving / 0.55); if (P.leaving <= 0) { drop(P); return; } }
        else if (P.path.length) {
          const tg = P.path[0]; tmp.subVectors(tg, P.pos); tmp.y = 0; const d = tmp.length();
          if (d < 0.06) { P.path.shift(); if (!P.path.length) { P.sit = false; posture(P, true); } }
          else { speed = 1.7; P.pos.addScaledVector(tmp, Math.min(d, speed * dt) / d); P.ry += BR.angDiff(P.ry, Math.atan2(tmp.x, tmp.z)) * Math.min(1, dt * 8); }
        } else {
          const s = G.slots[P.slot]; if (s) P.ry += BR.angDiff(P.ry, s.ry) * Math.min(1, dt * 5);
          // de temps en temps, un geste (debout)
          if (!P.sit && !av.oneShot && !P.queue.length && (P.flourish -= dt) <= 0) { P.flourish = rnd(8, 14); P.queue = [BR.pick(P.ready ? ['Cheer', 'Interact', '2H_Melee_Idle'] : ['Interact', 'Cheer'])]; if (P.queue[0] === '2H_Melee_Idle') P.queue = []; }
        }
        if (P.grow < 1) { P.grow = Math.min(1, P.grow + dt * 1.6); P.scale = smooth(P.grow); }
        if (P.queue.length && (!av.oneShot || av.oneShot.t < 0.15)) av.act(P.queue.shift(), { fade: 0.2 });
        av.group.position.copy(P.pos); av.group.rotation.y = P.ry; av.group.scale.setScalar(P.scale);
        av.update(dt, speed, {});
        // tête -> couronne et étiquette
        if (av.head) av.head.getWorldPosition(tmp2); else tmp2.copy(P.pos).setY(1.8 * P.scale);
        if (P.host) {
          if (!P.crown) { P.crown = crownTpl.clone(); scene.add(P.crown); }
          P.crown.position.set(tmp2.x, tmp2.y + (P.top + 0.16) * P.scale + Math.sin(t * 2.2) * 0.03, tmp2.z); P.crown.rotation.y = t * 0.9; P.crown.scale.setScalar(P.scale * 1.15);
        } else if (P.crown) { scene.remove(P.crown); P.crown = null; }
        if (P.tag) { tmp.copy(tmp2); tmp.y += (P.top + (P.host ? 0.5 : 0.18)) * P.scale; placeTag(P.tag, tmp, Math.min(1, P.scale * 1.2)); }
      });
    }
    function placeTag(el, p, op) {
      proj.copy(p).project(cam);
      if (proj.z > 1) { el.style.opacity = '0'; return; }
      const x = (proj.x * 0.5 + 0.5) * V.w, y = (-proj.y * 0.5 + 0.5) * V.h;
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`; el.style.opacity = String(op.toFixed(2));
    }

    const api = {
      update,
      dispose() {
        if (dead) return; dead = true; cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onMove);
        G.players.forEach(P => { try { killAv(P.av); } catch (e) { console.warn(e); } });
        G.players.clear();
        try { if (petals) petals.dispose(); } catch (e) { /* rien */ }
        scene.traverse(o => { if (o.isSprite && o.material) o.material.dispose(); });
        B.dispose(); V.dispose(); canvas.remove(); tags.remove();
      },
      _v: () => ({ V, G, scene }),   // outils de test
      _step(n, dt) { V.fit(); for (let i = 0; i < n; i++) tick(dt || 1 / 30); V.render(dt || 1 / 30); },
    };
    raf = requestAnimationFrame(frame);
    return api;
  };

  /* =====================================================================
     LA CABINE D'ESSAYAGE : chez le tailleur
     ===================================================================== */
  let DR = null, drKill = 0;
  S.dressing = function (hostCanvas) {
    clearTimeout(drKill);
    if (!DR) DR = buildDressing();
    const D = DR;
    const c = D.canvas; c.className = hostCanvas.className || 'pv';
    if (hostCanvas.parentNode) hostCanvas.replaceWith(c);
    const h = {
      stage: 'dressing',
      setLook(look) { if (D.owner === h) D.setLook(look); },
      setWalk(v) { if (D.owner === h) D.walk = v === true ? 4 : v === 2 ? 9 : 0; },
      spin() { if (D.owner === h) D.auto = true; },
      celebrate() { if (D.owner === h) D.celebrate(); },
      dispose() {
        if (D.owner !== h) return;
        D.owner = null; D.stop(); c.remove();
        // gardée un instant : un aperçu recréé tout de suite la retrouve telle quelle
        drKill = setTimeout(() => { if (DR === D && !D.owner) { D.destroy(); DR = null; } }, 4000);
      },
    };
    D.owner = h; D.start();
    return h;
  };
  S._dressing = () => DR;   // outil de test

  function buildDressing() {
    const D = {}, B = Bag(), canvas = document.createElement('canvas');
    const V = makeView(canvas, { fov: 34, exp: 0.98, pr: q => q === 'low' ? 1 : Math.max(1.25, Math.min(2, window.devicePixelRatio || 1)) }), scene = V.scene, cam = V.cam;
    if (V.post) { V.post.grade.uVig.value = 0.5; V.post.bloom.strength = 0.24; V.post.bloom.threshold = 0.96; V.post.bloom.radius = 0.45; }
    scene.background = L('#0e0806'); scene.fog = new THREE.Fog(L('#120906'), 9, 18);
    scene.environment = warmEnv(V.R, B, '#24140e', '#5a3020', '#140a06', [[0, 4, 2, '#ffe0b0', 0.8, 5], [0, 1.5, -2.6, '#ff9a40', 1.2, 3], [-2.8, 1.6, -1.8, '#ffc070', 0.3, 4], [2.8, 1.6, -1.8, '#ffc070', 0.3, 4]]);
    const T = { glow: ctex(B, 'glow', 64, 64, drawGlow), flame: ctex(B, 'flame', 64, 128, drawFlame) };

    /* --- lumières --- */
    scene.add(new THREE.HemisphereLight(L('#ffe0c0'), L('#2a160c'), 0.45));
    const key = new THREE.SpotLight(L('#fff0d8'), 1.7, 16, 0.4, 0.55, 1); key.position.set(0.8, 5.2, 3.4); key.target.position.set(0, 0.9, 0); scene.add(key, key.target);
    if (V.R.shadowMap.enabled) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.camera.near = 2; key.shadow.camera.far = 12; }
    const rims = [-1, 1].map(s => { const l = new THREE.SpotLight(L('#ffbf70'), 1.4, 9, 0.45, 0.6, 1); l.position.set(s * 1.5, 4.3, -1.4); l.target.position.set(0, 0.8, 0); scene.add(l, l.target); return l; });
    const alcL = new THREE.PointLight(L('#ff9a48'), 1.1, 5.5, 1.6); alcL.position.set(0, 1.6, -2.3); scene.add(alcL);
    const fill = new THREE.DirectionalLight(L('#9ab4ff'), 0.28); fill.position.set(-4, 2.5, 3); scene.add(fill);
    const candL = [-1, 1].map(s => { const l = new THREE.PointLight(L('#ffb060'), 0.7, 5, 1.7); l.position.set(s * 2.95, 1.95, -1.75); scene.add(l); return l; });

    /* --- matériaux --- */
    const tPlank = ctex(B, 'plank_d', 512, 512, (g, w, h) => drawPlanks(g, w, h, { hue: 22, sat: 40, lum: 26, seed: 8 }), { wrap: true });
    const M = {
      std: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, envMapIntensity: 0.5 })),
      plank: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, map: tPlank, roughness: 0.55, envMapIntensity: 0.7 })),
      gold: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.8, emissive: L('#2a1600'), envMapIntensity: 1.3 })),
      velvet: B.m(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.78, sheen: L('#ff7a8a'), side: THREE.DoubleSide, envMapIntensity: 0.4 })),
      cloth: B.m(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.4 })),
      glow: B.m(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) })),
    };
    const W = { dark: '#3a2212', mid: '#6a4024', light: '#9a6838', gold: '#ffc94a', vel: '#7c1028', vel2: '#5a0a1c' };
    const root = new THREE.Group(); scene.add(root);
    const MB = Batch();
    // sol, murs, plafond
    MB.add('plank', tplane(14, 12, 2), [0, 0, 0], [-Math.PI / 2, 0, 0], 1, '#ffffff');
    MB.box('std', [12, 5, 0.2], [0, 2.5, -3.2], 0, '#2a1810');
    [-4.8, 4.8].forEach(x => { MB.box('std', [0.2, 5, 9], [x, 2.5, 0.5], 0, '#3a2416'); MB.box('std', [0.14, 1.0, 9], [x - Math.sign(x) * 0.1, 0.5, 0.5], 0, W.mid); });
    // estrade ronde : bois sombre, plateau clair, filets dorés, marche
    MB.cyl('std', 1.32, 1.38, 0.08, 40, [0, 0.04, 0], 0, W.dark);
    MB.cyl('std', 1.12, 1.18, 0.14, 40, [0, 0.15, 0], 0, '#5a341c');
    MB.cyl('std', 1.06, 1.06, 0.02, 40, [0, 0.215, 0], 0, '#a06a3a');
    MB.add('gold', new THREE.TorusGeometry(1.12, 0.022, 6, 64), [0, 0.22, 0], [Math.PI / 2, 0, 0], 1, W.gold);
    MB.add('gold', new THREE.TorusGeometry(1.35, 0.018, 6, 64), [0, 0.08, 0], [Math.PI / 2, 0, 0], 1, W.gold);
    // fond : alcôve lumineuse derrière les rideaux
    MB.box('std', [3.6, 0.2, 0.6], [0, 3.6, -2.75], 0, W.dark);
    // tringle dorée et embouts
    MB.cyl('gold', 0.04, 0.04, 9.2, 10, [0, 3.62, -2.35], [0, 0, Math.PI / 2], W.gold);
    [-4.6, 4.6].forEach(x => MB.add('gold', new THREE.SphereGeometry(0.09, 10, 8), [x, 3.62, -2.35], 0, 1, W.gold));
    // rideaux de velours (deux pans retenus par des embrasses) + lambrequin festonné
    const tieY = 1.25, half = sd => drape(90, 18, 9, 0.11, (u, v) => {
      const y = v * 3.6, inner = v > tieY / 3.6 ? lerp(-1.55, -0.32, Math.pow((v - tieY / 3.6) / (1 - tieY / 3.6), 0.8)) : lerp(-1.0, -1.55, Math.pow(v / (tieY / 3.6), 0.6));
      const x = lerp(-4.6, inner, u), bunch = 1 + 0.9 * Math.exp(-Math.pow((y - tieY) / 0.35, 2)) * u;
      return [sd * x, y, bunch];
    });
    MB.add('velvet', half(1), [0, 0, -2.3], 0, 1, W.vel); MB.add('velvet', half(-1), [0, 0, -2.3], 0, 1, W.vel);
    MB.add('velvet', drape(160, 6, 24, 0.05, (u, v) => { const f = (u * 5) % 1, x = (u - 0.5) * 9.2, bot = 3.0 - 0.26 * Math.sin(f * Math.PI); return [x, lerp(bot, 3.66, v), 1 + 1.6 * Math.sin(f * Math.PI) * (1 - v)]; }), [0, 0, -2.2], 0, 1, W.vel2);
    // embrasses : cordon doré serré sur le pan, gland qui pend
    [-1, 1].forEach(sd => {
      MB.add('gold', new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), [sd * 1.92, tieY + 0.02, -2.1], [0, 0, Math.PI / 2 + sd * 0.12], 1, W.gold);
      MB.add('gold', new THREE.SphereGeometry(0.06, 8, 6), [sd * 1.58, tieY, -2.08], 0, 1, W.gold);
      MB.add('gold', new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), [sd * 1.58, tieY - 0.13, -2.08], 0, 1, W.gold);
      MB.add('gold', new THREE.ConeGeometry(0.055, 0.2, 8), [sd * 1.58, tieY - 0.32, -2.08], 0, 1, W.gold);
    });
    // miroir sur pied (à gauche), tourné vers l'estrade
    const mir = new THREE.Group(); mir.position.set(-1.72, 0, -0.95); mir.rotation.y = 0.62; root.add(mir);
    const mirFrame = new THREE.Group(); mirFrame.position.y = 0.36; mirFrame.rotation.x = -0.05; mir.add(mirFrame);
    {
      const MW = 0.95, MH = 1.95, IN = 0.075, outer = archShape(MW, MH, 0); outer.holes.push(archShape(MW, MH, IN));
      const FB = Batch();
      FB.add('gold', new THREE.ExtrudeGeometry(outer, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 1, curveSegments: 20 }), [0, 0, -0.025], 0, 1, W.gold);
      FB.add('gold', new THREE.SphereGeometry(0.06, 10, 8), [0, MH + 0.04, 0], 0, 1, W.gold);
      FB.build(B, M, mirFrame, { gold: true });
      const glass = Mirror(B, B.g(new THREE.ShapeGeometry(archShape(MW, MH, IN), 24)), [-MW / 2 + IN, IN, MW - 2 * IN, MH - 2 * IN], { res: V.q === 'low' ? [256, 512] : [512, 1024], tint: '#eef2f4' });
      glass.position.z = 0.01; mirFrame.add(glass); D.mirror = glass;
      if (V.q === 'low') glass.userData.off();
      // montants et pieds (dans le repère du miroir)
      const mm = new THREE.Matrix4().compose(mir.position, mir.quaternion, new V3(1, 1, 1));
      const at = (geo, p, color) => MB.addM('std', geo, new THREE.Matrix4().multiplyMatrices(mm, new THREE.Matrix4().makeTranslation(p[0], p[1], p[2])), color);
      [-1, 1].forEach(sd => { at(new THREE.BoxGeometry(0.07, 1.5, 0.07), [sd * (MW / 2 + 0.09), 0.75, 0], W.dark); at(new THREE.BoxGeometry(0.08, 0.06, 0.55), [sd * (MW / 2 + 0.09), 0.03, 0], W.dark); at(new THREE.SphereGeometry(0.045, 8, 6), [sd * (MW / 2 + 0.09), 1.53, 0], W.gold); });
      at(new THREE.BoxGeometry(MW + 0.25, 0.05, 0.06), [0, 0.12, 0], W.dark);
    }
    // mannequin de couturière (à droite) : trépied, buste en lin, jupe teal, ceinture dorée, mètre ruban
    {
      const mm = new THREE.Matrix4().compose(new V3(1.62, 0, -0.85), new THREE.Quaternion().setFromAxisAngle(UP, -0.55), new V3(1, 1, 1));
      const at = (geo, p, r, color, k) => { const e = new THREE.Euler(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0), m = new THREE.Matrix4().compose(new V3(p[0], p[1], p[2]), new THREE.Quaternion().setFromEuler(e), new V3(1, 1, 1)); MB.addM(k || 'std', geo, new THREE.Matrix4().multiplyMatrices(mm, m), color); };
      [0, 1, 2].forEach(i => { const a = i / 3 * TAU; at(new THREE.BoxGeometry(0.05, 0.04, 0.5), [Math.sin(a) * 0.22, 0.05, Math.cos(a) * 0.22], [0, a, 0], W.dark); });
      at(new THREE.CylinderGeometry(0.025, 0.03, 0.9, 8), [0, 0.5, 0], 0, W.gold, 'gold');
      const prof = [[0.001, 0.86], [0.16, 0.88], [0.19, 0.98], [0.165, 1.12], [0.2, 1.28], [0.215, 1.38], [0.17, 1.47], [0.07, 1.52], [0.05, 1.56], [0.05, 1.6], [0.001, 1.62]].map(p => new THREE.Vector2(p[0], p[1]));
      at(new THREE.LatheGeometry(prof, 16), [0, 0, 0], [0, 0, 0], '#e6d6b8');
      at(new THREE.SphereGeometry(0.06, 10, 8), [0, 1.64, 0], 0, W.light);
      const skirt = [[0.17, 1.0], [0.21, 0.92], [0.3, 0.74], [0.36, 0.55], [0.37, 0.5]].map(p => new THREE.Vector2(p[0], p[1]));
      at(new THREE.LatheGeometry(skirt, 18), [0, 0, 0], 0, '#226a78', 'cloth');
      at(new THREE.TorusGeometry(0.18, 0.02, 6, 20), [0, 1.0, 0], [Math.PI / 2, 0, 0], W.gold, 'gold');
      at(new THREE.TorusGeometry(0.09, 0.012, 5, 16, Math.PI * 1.4), [0, 1.48, 0.02], [Math.PI / 2 - 0.4, 0, 0.6], '#f0d050');
      at(new THREE.BoxGeometry(0.025, 0.28, 0.006), [0.09, 1.34, 0.12], [0.2, 0, 0.1], '#f0d050'); at(new THREE.BoxGeometry(0.025, 0.24, 0.006), [-0.09, 1.36, 0.12], [0.2, 0, -0.1], '#f0d050');
      at(new THREE.SphereGeometry(0.035, 8, 6), [0.12, 1.32, 0.14], 0, '#c82a3a');
    }
    // portant de vêtements (derrière, à droite)
    {
      const rm = new THREE.Matrix4().compose(new V3(2.55, 0, -1.75), new THREE.Quaternion().setFromAxisAngle(UP, -0.42), new V3(1, 1, 1));
      const at = (geo, p, r, color, k) => { const e = new THREE.Euler(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0), m = new THREE.Matrix4().compose(new V3(p[0], p[1], p[2]), new THREE.Quaternion().setFromEuler(e), new V3(1, 1, 1)); MB.addM(k || 'std', geo, new THREE.Matrix4().multiplyMatrices(rm, m), color); };
      [-0.85, 0.85].forEach(x => { at(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8), [x, 0.9, 0], 0, W.gold, 'gold'); at(new THREE.BoxGeometry(0.05, 0.05, 0.5), [x, 0.03, 0], 0, W.dark); });
      at(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8), [0, 1.78, 0], [0, 0, Math.PI / 2], W.gold, 'gold');
      const cols = ['#b8322f', '#d9a338', '#3f7d4e', '#5a3f8e', '#2f5f9e', '#e8e0d0'];
      cols.forEach((c, i) => {
        const x = -0.66 + i * 0.27, a = 1.15 + (i % 2 ? 0.12 : -0.08);
        at(new THREE.TorusGeometry(0.06, 0.008, 4, 10, Math.PI), [x, 1.73, 0], [0, a, 0], W.gold, 'gold');
        at(new THREE.ExtrudeGeometry(shirtShape(i === 3), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 }), [x, 1.7, 0], [0, a, 0], c, 'cloth');
      });
    }
    // petite table ronde : rouleaux de tissu, pelote, ciseaux dorés (à gauche devant)
    {
      MB.cyl('std', 0.42, 0.42, 0.05, 20, [-2.55, 0.78, 0.45], 0, W.mid); MB.cyl('std', 0.04, 0.05, 0.76, 8, [-2.55, 0.39, 0.45], 0, W.dark); MB.cyl('std', 0.22, 0.26, 0.04, 14, [-2.55, 0.02, 0.45], 0, W.dark);
      [['#8e2440', 0], ['#2a6a8a', 0.13], ['#c8a040', 0.26]].forEach(([c, dz], i) => MB.add('cloth', new THREE.CylinderGeometry(0.07, 0.07, 0.62, 12), [-2.6, 0.88 + (i === 2 ? 0.12 : 0), 0.32 + dz - (i === 2 ? 0.07 : 0)], [0, 0.3, Math.PI / 2], 1, c));
      MB.add('std', new THREE.SphereGeometry(0.07, 10, 8), [-2.32, 0.86, 0.62], 0, 1, '#c82a3a');
      MB.add('gold', new THREE.TorusGeometry(0.035, 0.01, 5, 10), [-2.42, 0.81, 0.72], [Math.PI / 2, 0, 0], 1, W.gold); MB.add('gold', new THREE.TorusGeometry(0.035, 0.01, 5, 10), [-2.36, 0.81, 0.74], [Math.PI / 2, 0, 0], 1, W.gold);
      MB.add('gold', new THREE.BoxGeometry(0.02, 0.008, 0.18), [-2.38, 0.81, 0.62], [0, 0.4, 0], 1, W.gold);
    }
    // chandeliers sur pied (bougies)
    [-1, 1].forEach(s => {
      const x = s * 2.95, z = -1.75;
      MB.cyl('gold', 0.03, 0.04, 1.6, 8, [x, 0.8, z], 0, W.gold); MB.cyl('gold', 0.18, 0.22, 0.05, 12, [x, 0.03, z], 0, W.gold);
      MB.box('gold', [0.5, 0.03, 0.03], [x, 1.6, z], 0, W.gold);
      [-0.22, 0, 0.22].forEach(o => { MB.cyl('std', 0.03, 0.03, 0.2, 8, [x + o, 1.72 + (o ? 0 : 0.06), z], 0, '#f2e6c8'); });
    });
    MB.build(B, M, root, { std: true, gold: true, cloth: true });
    // tapis rond
    const rug = new THREE.Mesh(B.g(new THREE.CircleGeometry(2.3, 48)), B.m(new THREE.MeshStandardMaterial({ map: ctex(B, 'rug_r', 512, 512, drawRug(true)), roughness: 1, envMapIntensity: 0.3 })));
    rug.rotation.x = -Math.PI / 2; rug.position.y = 0.006; rug.receiveShadow = true; root.add(rug);
    // alcôve lumineuse
    const alc = new THREE.Mesh(B.g(new THREE.PlaneGeometry(3.4, 3.6)), B.m(new THREE.MeshBasicMaterial({ map: ctex(B, 'alcove', 256, 256, drawAlcove), color: new THREE.Color(1.05, 0.98, 0.92) })));
    alc.position.set(0, 1.8, -2.9); root.add(alc);
    // anneau doré tournant et lueur au sol de l'estrade
    const ring = new THREE.Mesh(B.g(new THREE.RingGeometry(0.86, 0.9, 64)), B.m(new THREE.MeshBasicMaterial({ color: L('#ffd24a').multiplyScalar(1.8), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.228; root.add(ring);
    const disc = new THREE.Mesh(B.g(new THREE.CircleGeometry(1.0, 40)), B.m(new THREE.MeshBasicMaterial({ color: L('#ffb040'), map: T.glow, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.226; disc.scale.setScalar(1.3); root.add(disc);
    // faisceaux des projecteurs (cônes additifs, plus clairs en haut)
    const beams = [-1, 1].map(s => {
      const g = B.g(new THREE.CylinderGeometry(0.06, 0.95, 4.6, 24, 6, true)), pa = g.attributes.position, col = new Float32Array(pa.count * 3);
      for (let i = 0; i < pa.count; i++) { const k = Math.pow((pa.getY(i) + 2.3) / 4.6, 1.3) * 0.9 + 0.1; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, B.m(new THREE.MeshBasicMaterial({ color: L('#ffcf8a'), vertexColors: true, transparent: true, opacity: 0.075, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
      const from = new V3(s * 1.5, 4.5, -1.5), to = new V3(0, 0.2, 0), mid = from.clone().lerp(to, 0.5);
      m.position.copy(mid); m.quaternion.setFromUnitVectors(UP, from.clone().sub(to).normalize()); m.scale.y = from.distanceTo(to) / 4.6; root.add(m);
      return m;
    });
    // flammes des bougies
    const flames = Flames(B, root, T.flame, [-1, 1].flatMap(s => [-0.22, 0, 0.22].map(o => ({ p: [s * 2.95 + o, 1.82 + (o ? 0 : 0.06), -1.75], w: 0.07, h: 0.15, k: 2.4, c: '#ffc060' }))));
    const dust = Sparks(B, root, 120, 0.035, T.glow), sparks = Sparks(B, root, 220, 0.07, T.glow);

    /* --- état, interactions --- */
    Object.assign(D, { canvas, V, B, av: null, key: null, rotY: 0.5, auto: true, drag: false, lx: 0, zoom: 1, walk: 0, showT: 4, myth: 0, mythT: 0, flash: 0, t: 0, raf: 0, last: 0, gone: 0, owner: null, frame: 0 });
    const pd = e => { D.drag = true; D.lx = e.clientX; D.auto = false; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* rien */ } };
    const pm = e => { if (D.drag) { D.rotY += (e.clientX - D.lx) * 0.012; D.lx = e.clientX; } };
    const pu = () => { D.drag = false; };
    const wh = e => { D.zoom = clamp(D.zoom + e.deltaY * 0.001, 0.6, 1.4); e.preventDefault(); };
    canvas.addEventListener('pointerdown', pd); canvas.addEventListener('pointermove', pm); canvas.addEventListener('pointerup', pu); canvas.addEventListener('pointercancel', pu);
    canvas.addEventListener('wheel', wh, { passive: false });
    const poses = ['Cheer', '1H_Melee_Attack_Slice_Diagonal', 'Spellcast_Shoot', '2H_Melee_Attack_Spin', 'Block'];
    const puff = (n, cols, up) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = rnd(0.3, 1.05); sparks.emit(new V3(Math.cos(a) * r, 0.25, Math.sin(a) * r), { v: new V3(Math.cos(a) * rnd(0.1, 0.6), rnd(0.8, 2.4) * (up || 1), Math.sin(a) * rnd(0.1, 0.6)), life: rnd(0.9, 1.8), color: L(BR.pick(cols)).multiplyScalar(2.2), grav: 0.6, drag: 0.6, wob: 0.4 }); } };
    D.setLook = function (look) {
      const k = lookKey(look); if (k === D.key && D.av) return;
      const had = !!D.av;
      killAv(D.av); D.av = null;
      const av = BR.Avatar.build(look); av.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
      av.group.position.y = 0.226; av.group.rotation.y = D.rotY; root.add(av.group); D.av = av; D.key = k; D.showT = 1.2;
      const sk = BR.skinById(look && look.skin); D.myth = sk && sk.rarity === 'mythique' ? 1 : 0;
      if (had) { puff(70, ['#ffe9a8', '#ffd24a', '#ffffff'], 1); D.flash = 0.6; }
    };
    D.celebrate = function () {
      const av = D.av; if (!av) return; D.auto = true; D.showT = 7; av.act('Cheer');
      if (av.skinfx && av.skinfx.kick) av.skinfx.kick('reveal'); if (av.aura && av.aura.kick) av.aura.kick(1.2);
      puff(200, ['#ffd24a', '#ff6a8a', '#7ad8ff', '#ffffff', '#b98cff'], 1.5); D.flash = 1.4;
    };
    function frame(now) {
      if (!D.owner) return; D.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - D.last) / 1000)); D.last = now;
      if (!canvas.isConnected) { if (++D.gone > 90 && D.owner) D.owner.dispose(); return; }   // écran quitté sans dispose : on libère
      D.gone = 0; if (document.hidden || !canvas.offsetParent) return;
      V.fit(); if (!V.w) return;
      tick(dt); draw(dt, false);
    }
    // reflet du miroir (une image sur deux suffit) puis rendu
    function draw(dt, force) {
      D.frame++;
      if (D.mirror && V.q !== 'low' && (force || D.frame % 2 === 0)) { scene.updateMatrixWorld(); cam.updateMatrixWorld(); D.mirror.userData.update(V.R, scene, cam); }
      V.render(dt);
    }
    function tick(dt) {
      const t = (D.t += dt);
      if (D.auto) D.rotY += dt * 0.5;
      const av = D.av;
      if (av) {
        av.group.rotation.y = D.rotY;
        D.showT -= dt; if (D.showT <= 0 && !D.walk) { D.showT = 6 + Math.random() * 4; av.act(BR.pick(poses)); }
        av.update(dt, D.walk, { sprint: D.walk > 6 });
      }
      // caméra : recule pour les skins mythiques (ailes, cornes, halos), molette = zoom, petite dérive
      D.mythT += (D.myth - D.mythT) * Math.min(1, dt * 4);
      const z = D.zoom * (1 + 0.22 * D.mythT), ly = 1.08 + 0.12 * D.mythT;
      cam.position.set(Math.sin(t * 0.17) * 0.12, ly + 0.42 * z + Math.sin(t * 0.23) * 0.03, 5.3 * z);
      cam.lookAt(0, ly, 0);
      // lumières vivantes
      D.flash = Math.max(0, D.flash - dt * 1.2);
      key.intensity = 1.7 + D.flash * 1.6; rims.forEach((l, i) => { l.intensity = 1.4 * (0.95 + 0.05 * Math.sin(t * 1.3 + i * 2)); });
      candL.forEach((l, i) => { l.intensity = 0.7 * flick(t, i * 5); }); alcL.intensity = 1.1 + 0.08 * Math.sin(t * 0.8);
      beams.forEach((b, i) => { b.material.opacity = 0.07 + 0.012 * Math.sin(t * 0.9 + i * 1.7) + D.flash * 0.05; });
      ring.rotation.z += dt * 0.3; ring.material.opacity = 0.6 + 0.15 * Math.sin(t * 2) + D.flash * 0.3; disc.material.opacity = 0.3 + D.flash * 0.35;
      flames.update(t);
      if (Math.random() < dt * 16) dust.emit(new V3(rnd(-1.6, 1.6), rnd(0.4, 3.6), rnd(-1.6, 1.0)), { v: new V3(rnd(-0.03, 0.03), rnd(-0.03, 0.03), rnd(-0.03, 0.03)), life: 6, color: L('#ffe0b0').multiplyScalar(0.7), wob: 0.06 });
      if (Math.random() < dt * 5) { const a = Math.random() * TAU; sparks.emit(new V3(Math.cos(a) * 0.95, 0.24, Math.sin(a) * 0.95), { v: new V3(0, rnd(0.25, 0.6), 0), life: 1.6, color: L('#ffd24a').multiplyScalar(1.6), wob: 0.2 }); }
      dust.update(dt, t); sparks.update(dt, t);
    }
    D._step = (n, dt) => { V.fit(); for (let i = 0; i < n; i++) tick(dt || 1 / 30); draw(dt || 1 / 30, true); };   // outil de test
    D.start = () => { cancelAnimationFrame(D.raf); D.rotY = 0.5; D.auto = true; D.zoom = 1; D.walk = 0; D.gone = 0; D.last = performance.now(); D.raf = requestAnimationFrame(frame); };
    D.stop = () => { cancelAnimationFrame(D.raf); D.raf = 0; D.drag = false; };
    D.destroy = () => {
      D.stop();
      killAv(D.av); D.av = null;
      canvas.removeEventListener('pointerdown', pd); canvas.removeEventListener('pointermove', pm); canvas.removeEventListener('pointerup', pu); canvas.removeEventListener('pointercancel', pu); canvas.removeEventListener('wheel', wh);
      scene.traverse(o => { if (o.isSprite && o.material) o.material.dispose(); });
      B.dispose(); V.dispose(); canvas.remove();
    };
    return D;
  }
})();

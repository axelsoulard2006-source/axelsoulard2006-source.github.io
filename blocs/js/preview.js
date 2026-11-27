/* ===== preview.js : aperçu 3D animé du personnage dans l'inventaire
   Petit renderer Three.js à part (son propre canvas), modèle cubique propre à Blocaria (tunique sarcelle comme la main de fx.js),
   la tête suit la souris, on peut le faire pivoter en le glissant. Il porte l'armure équipée (couleurs tirées des icônes
   de survie.js), l'objet tenu dans la main droite et la main secondaire (VX.G.offhand) dans la main gauche.
   API : VX.Preview.mount(div), VX.Preview.unmount() — appelés par ui.js. ===== */
(function () {
  const VX = window.VX;
  if (!window.THREE) return;
  const PX = 1 / 16;   // un pixel du modèle

  /* ---------- textures en pixels ---------- */
  function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function hex2(c, k) { const n = parseInt(c.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
  // une face de w×h pixels : fn(x, y) → couleur (ou null = transparent)
  function face(w, h, fn, seed) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const col = fn(x, y); if (!col) continue; g.fillStyle = col[0] === '#' ? hex2(col, 0.93 + hash(x, y, seed || 1) * 0.12) : col; g.fillRect(x, y, 1, 1); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.userData = { own: true }; return t;
  }
  const mats = [];
  function lam(tex, transparent) { const m = new THREE.MeshLambertMaterial({ map: tex, transparent: !!transparent, alphaTest: transparent ? 0.5 : 0 }); mats.push(m); return m; }
  // boîte W×H×D (pixels) ; faces : fonction (nom de face, w, h) → fn(x, y)
  function box(W, H, D, painter, transparent, seed) {
    const dims = { px: [D, H], nx: [D, H], py: [W, D], ny: [W, D], pz: [W, H], nz: [W, H] };
    const m = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((f, i) => lam(face(dims[f][0], dims[f][1], painter(f, dims[f][0], dims[f][1]), (seed || 3) + i), transparent));
    return new THREE.Mesh(new THREE.BoxGeometry(W * PX, H * PX, D * PX), m);
  }

  /* ---------- palette du personnage (originale) ---------- */
  const C = { skin: '#e0b48c', skinD: '#c89a72', hair: '#5a3418', hairH: '#7a4a22', eyeW: '#f4f0e8', eye: '#2f6a8a', mouth: '#a0604a',
    tunic: '#2f7d7a', tunicD: '#235e5c', trim: '#e8c870', belt: '#5a3a1c', pants: '#3a3550', pantsD: '#2e2a42', boot: '#4a2e18', bootD: '#33200f' };
  const headP = f => (x, y) => {
    if (f === 'py') return x === 2 && y === 3 ? C.hairH : C.hair;
    if (f === 'ny') return C.skinD;
    if (f === 'nz') return y < 7 ? (y === 2 && x === 5 ? C.hairH : C.hair) : C.skin;
    if (f === 'px' || f === 'nx') return y < 2 ? C.hair : y < 4 && (f === 'px' ? x < 3 : x > 4) ? C.hair : (y === 4 && x === 4) ? C.skinD : C.skin;
    // visage
    if (y < 2) return y === 1 && (x === 3) ? C.hairH : C.hair;
    if (y === 2) return x === 0 || x === 7 ? C.hair : C.skin;
    if (y === 4) return x === 1 || x === 6 ? C.eyeW : x === 2 || x === 5 ? C.eye : C.skin;
    if (y === 5) return x === 3 || x === 4 ? C.skinD : C.skin;
    if (y === 6) return x >= 3 && x <= 4 ? C.mouth : C.skin;
    return C.skin;
  };
  const bodyP = f => (x, y) => {
    if (f === 'py') return C.tunicD; if (f === 'ny') return C.pants;
    if (y === 8) return f === 'pz' && (x === 3 || x === 4) ? C.trim : C.belt;
    if (y >= 10) return C.tunicD;
    if (f === 'pz') { if (y === 0 && x >= 2 && x <= 5) return x === 2 || x === 5 ? C.trim : C.skin; if (y === 1 && x >= 3 && x <= 4) return C.trim; }
    return C.tunic;
  };
  const armP = f => (x, y) => { if (f === 'py') return C.tunic; if (f === 'ny') return C.skin; return y < 5 ? C.tunic : y === 5 ? C.trim : C.skin; };
  const legP = f => (x, y) => { if (f === 'py') return C.pants; if (f === 'ny') return C.bootD; return y < 9 ? (y === 8 ? C.pantsD : C.pants) : y === 11 ? C.bootD : C.boot; };

  /* ---------- scène ---------- */
  let renderer = null, scene, camera, root, parts = {}, armorG, heldR, heldL, host = null, raf = 0, sigLast = '';
  const look = { yaw: 0, pitch: 0, spin: 0, drag: null };
  function init() {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(26, 0.625, 0.1, 50); camera.position.set(0, 1.12, 5.4); camera.lookAt(0, 1.0, 0);
    scene.add(new THREE.AmbientLight(0xffe6c8, 0.62));
    const key = new THREE.DirectionalLight(0xfff4e0, 0.62); key.position.set(-2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb070, 0.35); rim.position.set(3, 2, -3); scene.add(rim);
    root = new THREE.Group(); scene.add(root);
    // pivots : jambes aux hanches, bras aux épaules, tête au cou
    const piv = (x, y, mesh, oy) => { const g = new THREE.Group(); g.position.set(x * PX, y * PX, 0); mesh.position.y = oy * PX; g.add(mesh); root.add(g); return g; };
    parts.legR = piv(-2, 12, box(4, 12, 4, legP, false, 11), -6);
    parts.legL = piv(2, 12, box(4, 12, 4, legP, false, 12), -6);
    parts.body = piv(0, 18, box(8, 12, 4, bodyP, false, 13), 0);
    parts.armR = piv(-6, 22, box(4, 12, 4, armP, false, 14), -4);
    parts.armL = piv(6, 22, box(4, 12, 4, armP, false, 15), -4);
    parts.head = piv(0, 24, box(8, 8, 8, headP, false, 16), 4);
    // ombre douce au sol
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.005; sh.scale.set(1, 0.6, 1); scene.add(sh);
    armorG = new THREE.Group(); root.add(armorG);
    // glisser pour faire pivoter le personnage
    const cv = renderer.domElement;
    cv.addEventListener('mousedown', e => { look.drag = { x: e.clientX, s: look.spin }; e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', e => { if (look.drag) look.spin = look.drag.s + (e.clientX - look.drag.x) * 0.012; });
    window.addEventListener('mouseup', () => { look.drag = null; });
  }

  /* ---------- armure et objets tenus ---------- */
  function palOf(id) { const a = VX.itemArt && VX.itemArt[id]; const p = a && a[1]; const l = (p && p.x) || '#d8d8e0', n = parseInt(l.slice(1), 16), up = v => Math.min(255, Math.round(v * 1.18 + 12)); return { d: (p && p.X) || '#6a6a74', l, h: '#' + ((up(n >> 16) << 16) | (up((n >> 8) & 255) << 8) | up(n & 255)).toString(16).padStart(6, '0') }; }
  function shell(W, H, D, id, kind, seed) {
    const p = palOf(id);
    return box(W, H, D, (f, w, h) => (x, y) => {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (kind === 'helm' && f === 'pz' && y >= 3 && x >= 1 && x <= W - 2) return null;              // visage dégagé
      if (kind === 'helm' && f === 'ny') return null;
      if (kind === 'plate' && (f === 'py' || f === 'ny') && x > 1 && x < W - 2) return null;
      if (edge) return p.d;
      return y === 1 ? p.h : (kind === 'plate' && f === 'pz' && (x === Math.floor(w / 2))) ? p.d : p.l;   // reflet en haut, arête centrale du plastron
    }, true, seed);
  }
  function addTo(parent, mesh, x, y, z) { mesh.position.set(x * PX, y * PX, (z || 0) * PX); parent.add(mesh); return mesh; }
  function heldMesh(id) {
    if (!id || !VX.iconTex) return null;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10 * PX, 10 * PX), new THREE.MeshLambertMaterial({ map: VX.iconTex(id), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
    mats.push(m.material); return m;
  }
  function clearGroup(g) { for (const c of g.children.slice()) { g.remove(c); disposeObj(c); } }
  function disposeObj(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); const ms = Array.isArray(c.material) ? c.material : c.material ? [c.material] : []; for (const m of ms) { const i = mats.indexOf(m); if (i >= 0) mats.splice(i, 1); if (m.map && m.map.userData && m.map.userData.own) m.map.dispose(); /* les icônes (VX.iconTex) sont partagées : on les garde */ m.dispose(); } }); }
  function rebuildGear(G) {
    // nettoie les anciennes pièces accrochées aux membres
    for (const k of ['head', 'body', 'armR', 'armL', 'legR', 'legL']) for (const c of parts[k].children.slice()) if (c.userData.gear) { parts[k].remove(c); disposeObj(c); }
    clearGroup(armorG);
    const A = G.armor || [], tag = m => { m.userData.gear = true; return m; };
    if (A[0]) addTo(parts.head, tag(shell(9, 9, 9, A[0].id, 'helm', 41)), 0, 4.2);
    if (A[1]) { addTo(parts.body, tag(shell(9, 13, 5, A[1].id, 'plate', 42)), 0, 0.5); addTo(parts.armR, tag(shell(5, 6, 5, A[1].id, 'pad', 43)), 0, -1.2); addTo(parts.armL, tag(shell(5, 6, 5, A[1].id, 'pad', 44)), 0, -1.2); }
    if (A[2]) { addTo(parts.legR, tag(shell(5, 8, 5, A[2].id, 'pad', 45)), 0, -3.6); addTo(parts.legL, tag(shell(5, 8, 5, A[2].id, 'pad', 46)), 0, -3.6); addTo(parts.body, tag(shell(9, 3, 5, A[2].id, 'pad', 47)), 0, -4.6); }
    if (A[3]) { addTo(parts.legR, tag(shell(5, 4, 5, A[3].id, 'pad', 48)), 0, -10.2); addTo(parts.legL, tag(shell(5, 4, 5, A[3].id, 'pad', 49)), 0, -10.2); }
    // objet tenu (main droite) et main secondaire (main gauche)
    const held = G.inv && G.inv[G.sel], off = G.offhand;
    const r = held && heldMesh(held.id); if (r) { tag(r); r.position.set(-1 * PX, -11 * PX, 3 * PX); r.rotation.set(-0.25, 0.45, 0.15); parts.armR.add(r); }
    const l = off && heldMesh(off.id); if (l) { tag(l); l.position.set(1 * PX, -11 * PX, 3 * PX); l.rotation.set(-0.25, -0.45, -0.15); l.scale.x = -1; parts.armL.add(l); }
  }

  /* ---------- animation ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let t0 = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!host || !host.isConnected) { VX.Preview.unmount(); return; }
    const G = VX.G, dt = Math.min(0.05, (now - t0) / 1000); t0 = now; const t = now / 1000;
    // taille du canvas = taille de la case d'aperçu
    const w = host.clientWidth, h = host.clientHeight;
    if (w && h && (renderer._w !== w || renderer._h !== h)) { renderer._w = w; renderer._h = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (G) {
      const s = (G.armor || []).map(a => a ? a.id : 0).join(',') + '|' + ((G.inv[G.sel] || {}).id || 0) + '|' + ((G.offhand || {}).id || 0);
      if (s !== sigLast) { sigLast = s; rebuildGear(G); }
    }
    // la tête suit la souris (repère : la tête, vers le haut de l'aperçu)
    const m = VX.UI && VX.UI.mouse, rc = host.getBoundingClientRect();
    let ty = 0, tp = 0;
    if (m && rc.width) { const dx = m.x - (rc.left + rc.width / 2), dy = m.y - (rc.top + rc.height * 0.22); ty = clamp(dx / 170, -1, 1) * 0.95; tp = clamp(dy / 170, -1, 1) * 0.6; }
    const k = Math.min(1, dt * 10); look.yaw += (ty - look.yaw) * k; look.pitch += (tp - look.pitch) * k;
    if (!look.drag) look.spin *= 1 - Math.min(1, dt * 0.8);   // revient doucement de face
    root.rotation.y = look.spin + look.yaw * 0.3;
    parts.head.rotation.set(look.pitch, look.yaw * 0.7, 0);
    // respiration et balancement léger des bras
    const br = Math.sin(t * 1.9);
    parts.armR.rotation.set(br * 0.05 + (G && G.inv[G.sel] ? -0.25 : 0), 0, -0.06 - br * 0.03);
    parts.armL.rotation.set(-br * 0.05 + (G && G.offhand ? -0.25 : 0), 0, 0.06 + br * 0.03);
    parts.body.position.y = (18 + br * 0.12) * PX; parts.head.position.y = (24 + br * 0.12) * PX;
    // teinte rouge quand le joueur est blessé
    const hurt = G && G.player && G.player.hurtT > 0 ? Math.min(1, G.player.hurtT * 2.5) : 0;
    for (const mt of mats) if (mt.emissive) mt.emissive.setRGB(hurt * 0.6, 0, 0);
    renderer.render(scene, camera);
  }

  VX.Preview = {
    mount(div) {
      try { if (!renderer) init(); } catch (e) { console.warn('[preview] WebGL indisponible', e); div.classList.add('static'); return; }
      host = div; div.appendChild(renderer.domElement); renderer._w = 0; sigLast = ''; look.spin = 0;
      cancelAnimationFrame(raf); t0 = performance.now(); raf = requestAnimationFrame(frame);
    },
    unmount() { cancelAnimationFrame(raf); raf = 0; if (renderer && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); host = null; },
    get active() { return !!host; },
  };
})();

/* ===== fx.js : retours visuels — fissures progressives, particules de débris, objets au sol en relief,
   main / outil à la première personne (balancement, frappe). Tout est créé une fois et réutilisé (pas d'allocation par image). ===== */
(function () {
  const VX = window.VX, D = VX.BLOCKS, G = VX.G, H = VX.hooks, R = VX.R, scene = R.scene;
  const FX = VX.FX = {};
  const dayK = () => G.dim === 'surface' ? Math.max(0.28, R.uniforms.uDay.value) : 0.9;

  /* ---------- couleurs d'un bloc (échantillonnées dans l'atlas de textures) ---------- */
  let atlasPx = null; const colCache = {};
  function blockColors(id) {
    if (colCache[id]) return colCache[id];
    const b = D[id], out = [];
    try {
      const at = VX.TEX.atlas; if (!atlasPx) atlasPx = at.getContext('2d').getImageData(0, 0, at.width, at.height);
      for (const face of [b.tex.side, b.tex.top]) {
        const [sx, sy] = VX.TEX.src(face);
        for (let i = 0; i < 24; i++) { const x = sx + ((Math.random() * 16) | 0), y = sy + ((Math.random() * 16) | 0), k = (y * atlasPx.width + x) * 4; if (atlasPx.data[k + 3] > 100) out.push([atlasPx.data[k] / 255, atlasPx.data[k + 1] / 255, atlasPx.data[k + 2] / 255]); }
      }
    } catch (e) {}
    if (!out.length) out.push([0.5, 0.5, 0.5]);
    return (colCache[id] = out);
  }
  FX.blockColors = blockColors;

  /* ---------- particules : deux nuages de points (débris fins, fumée épaisse), tampons fixes ---------- */
  function cloud(N, size, opts) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    pos.fill(-9999); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial(Object.assign({ size, vertexColors: true, sizeAttenuation: true }, opts || {}));
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    return { N, pos, col, geo, mat, pts, vel: new Float32Array(N * 3), life: new Float32Array(N), grav: new Float32Array(N), next: 0, alive: 0 };
  }
  const debris = cloud(600, 0.11), smoke = cloud(220, 0.55, { transparent: true, opacity: 0.75, depthWrite: false });
  // petites étoiles lumineuses (coups critiques, étincelles) : texture d'étoile à 4 branches, additive
  const starCv = document.createElement('canvas'); starCv.width = starCv.height = 16;
  (function () { const g = starCv.getContext('2d'); g.fillStyle = '#fff'; for (const [x, y, w, h] of [[7, 1, 2, 14], [1, 7, 14, 2], [6, 5, 4, 6], [5, 6, 6, 4]]) g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(4, 4, 1, 1); g.fillRect(11, 4, 1, 1); g.fillRect(4, 11, 1, 1); g.fillRect(11, 11, 1, 1); })();
  const starTex = new THREE.CanvasTexture(starCv); starTex.magFilter = starTex.minFilter = THREE.NearestFilter; starTex.generateMipmaps = false;
  const stars = cloud(160, 0.22, { map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, alphaTest: 0.05 });
  function emit(c, x, y, z, vx, vy, vz, r, g, b, life, grav) {
    const i = c.next; c.next = (c.next + 1) % c.N; const k = i * 3;
    c.pos[k] = x; c.pos[k + 1] = y; c.pos[k + 2] = z; c.vel[k] = vx; c.vel[k + 1] = vy; c.vel[k + 2] = vz;
    c.col[k] = r; c.col[k + 1] = g; c.col[k + 2] = b; c.life[i] = life; c.grav[i] = grav; c.alive = c.N;
  }
  const solidAt = (x, y, z) => { const w = G.world; if (!w) return false; const b = D[w.get(Math.floor(x), Math.floor(y), Math.floor(z))]; return !!(b && b.solid); };
  function stepCloud(c, dt, collide) {
    if (!c.alive) return; let any = 0;
    for (let i = 0; i < c.N; i++) {
      if (c.life[i] <= 0) continue; const k = i * 3;
      c.life[i] -= dt; if (c.life[i] <= 0) { c.pos[k + 1] = -9999; continue; }
      any++; c.vel[k + 1] -= c.grav[i] * dt;
      const nx = c.pos[k] + c.vel[k] * dt, ny = c.pos[k + 1] + c.vel[k + 1] * dt, nz = c.pos[k + 2] + c.vel[k + 2] * dt;
      if (collide && solidAt(nx, ny, nz)) { c.vel[k] *= 0.3; c.vel[k + 2] *= 0.3; c.vel[k + 1] = 0; }
      else { c.pos[k] = nx; c.pos[k + 1] = ny; c.pos[k + 2] = nz; }
      if (!collide) { c.vel[k] *= 1 - dt * 1.5; c.vel[k + 2] *= 1 - dt * 1.5; }
    }
    c.alive = any; c.geo.attributes.position.needsUpdate = true; c.geo.attributes.color.needsUpdate = true;
  }
  // éclats d'un bloc cassé, aux couleurs de sa texture
  FX.blockBreak = function (x, y, z, id) {
    const cols = blockColors(id);
    for (let i = 0; i < 26; i++) { const c = cols[(Math.random() * cols.length) | 0]; emit(debris, x + 0.15 + Math.random() * 0.7, y + 0.15 + Math.random() * 0.7, z + 0.15 + Math.random() * 0.7, (Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4, c[0], c[1], c[2], 0.5 + Math.random() * 0.6, 16); }
  };
  // quelques miettes pendant le minage, sur la face visée
  FX.dig = function (t) {
    const cols = blockColors(t.id);
    for (let i = 0; i < 4; i++) {
      const c = cols[(Math.random() * cols.length) | 0];
      const px = t.x + 0.5 + (t.nx ? t.nx * 0.52 : (Math.random() - 0.5) * 0.8), py = t.y + 0.5 + (t.ny ? t.ny * 0.52 : (Math.random() - 0.5) * 0.8), pz = t.z + 0.5 + (t.nz ? t.nz * 0.52 : (Math.random() - 0.5) * 0.8);
      emit(debris, px, py, pz, t.nx * 1.5 + (Math.random() - 0.5) * 1.5, Math.random() * 2 + 0.5, t.nz * 1.5 + (Math.random() - 0.5) * 1.5, c[0], c[1], c[2], 0.35 + Math.random() * 0.3, 14);
    }
  };
  // nuage générique (créatures touchées, mort, braises, feu)
  FX.burst = function (x, y, z, n, rgb, o) {
    o = o || {}; const sp = o.speed || 2.5, c = o.smoke ? smoke : debris;
    for (let i = 0; i < n; i++) { const v = o.vary ? 1 - Math.random() * o.vary : 1; emit(c, x + (Math.random() - 0.5) * (o.spread || 0.6), y + (Math.random() - 0.5) * (o.spread || 0.6), z + (Math.random() - 0.5) * (o.spread || 0.6), (Math.random() - 0.5) * sp, (o.up != null ? o.up : 1) * Math.random() * sp, (Math.random() - 0.5) * sp, rgb[0] * v, rgb[1] * v, rgb[2] * v, (o.life || 0.6) * (0.6 + Math.random() * 0.6), o.grav != null ? o.grav : 10); }
  };
  // étoiles d'un coup critique (blanches, jaunes, cyan) ; sp = vitesse
  FX.stars = function (x, y, z, n, sp) {
    sp = sp == null ? 3 : sp;
    for (let i = 0; i < n; i++) { const k = Math.random(), c = k < 0.4 ? [1, 1, 0.85] : k < 0.75 ? [1, 0.85, 0.3] : [0.6, 0.95, 1]; emit(stars, x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * sp * 2, Math.random() * sp + 0.5 * sp, (Math.random() - 0.5) * sp * 2, c[0], c[1], c[2], 0.45 + Math.random() * 0.4, 6); }
  };
  // poussière d'un bloc qui jaillit vers le haut (labour, semis)
  FX.dust = function (x, y, z, id, n) {
    const cols = blockColors(id);
    for (let i = 0; i < n; i++) { const c = cols[(Math.random() * cols.length) | 0]; emit(debris, x + (Math.random() - 0.5) * 0.9, y, z + (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 1.6, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 1.6, c[0], c[1], c[2], 0.4 + Math.random() * 0.35, 12); }
  };
  FX.explosion = function (x, y, z, r) {
    for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283, e = Math.random() * 3.14 - 1.57, s = 2 + Math.random() * 7, k = Math.random();
      emit(smoke, x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s * 0.7 + 1.5, Math.sin(a) * Math.cos(e) * s, 0.25 + k * 0.3, 0.22 + k * 0.25, 0.2 + k * 0.22, 0.9 + Math.random() * 0.9, -1.2); }
    for (let i = 0; i < 60; i++) { const a = Math.random() * 6.283, s = 3 + Math.random() * 9;
      emit(debris, x, y, z, Math.cos(a) * s, Math.random() * 8, Math.sin(a) * s, 1, 0.45 + Math.random() * 0.45, 0.1, 0.4 + Math.random() * 0.5, 9); }
    flash.position.set(x, y, z); flash.visible = true; flashT = 0.25; flash.scale.setScalar(r * 0.6);
  };
  // éclair lumineux de l'explosion (sphère additive qui s'efface)
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  flash.visible = false; scene.add(flash); let flashT = 0;

  /* ---------- fissures : un cube à peine plus grand, texture de fissures en 10 étapes ---------- */
  const STAGES = 10, crackCv = document.createElement('canvas'); crackCv.width = 16; crackCv.height = 16 * STAGES;
  (function drawCracks() {
    const g = crackCv.getContext('2d'), rnd = VX.rng ? VX.rng(4242) : Math.random;
    // quelques chemins de fissure qui partent du centre ; chaque étape en dessine un peu plus
    const walks = [];
    for (let w = 0; w < 7; w++) { let x = 6 + rnd() * 4, y = 6 + rnd() * 4, a = rnd() * 6.283; const pts = []; for (let s = 0; s < 22; s++) { a += (rnd() - 0.5) * 1.3; x += Math.cos(a); y += Math.sin(a); pts.push([Math.floor(x), Math.floor(y)]); if (rnd() < 0.12) a += (rnd() < 0.5 ? 1 : -1) * 1.2; } walks.push(pts); }
    for (let s = 0; s < STAGES; s++) {
      const oy = s * 16, len = Math.floor((s + 1) / STAGES * 22), nw = Math.min(walks.length, 2 + Math.floor(s * 0.6));
      for (let w = 0; w < nw; w++) for (let i = 0; i < len; i++) {
        const [x, y] = walks[w][i]; if (x < 0 || y < 0 || x > 15 || y > 15) continue;
        g.fillStyle = 'rgba(12,8,6,0.78)'; g.fillRect(x, oy + y, 1, 1);
        if (x < 15 && y < 15) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 1, oy + y + 1, 1, 1); }
      }
    }
  })();
  const crackTex = new THREE.CanvasTexture(crackCv); crackTex.magFilter = crackTex.minFilter = THREE.NearestFilter; crackTex.generateMipmaps = false; crackTex.repeat.set(1, 1 / STAGES);
  const crack = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
  crack.visible = false; crack.renderOrder = 2; scene.add(crack);

  /* ---------- géométries d'objets : petit cube texturé (blocs) ou icône en relief (objets) ---------- */
  const blockMat = new THREE.MeshBasicMaterial({ map: VX.TEX.tex, vertexColors: true, alphaTest: 0.5 });
  const itemMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const geoCache = {};
  function cubeGeo(id) {
    const b = D[id], g = new THREE.BoxGeometry(1, 1, 1), uv = g.attributes.uv, n = uv.count, col = new Float32Array(n * 3);
    const faces = [b.tex.side, b.tex.side, b.tex.top, b.tex.bottom, b.tex.side, b.tex.side], shade = [0.8, 0.8, 1, 0.55, 0.9, 0.9];
    for (let f = 0; f < 6; f++) { const [u0, v0, u1, v1] = VX.TEX.uv(faces[f]); for (let j = 0; j < 4; j++) { const i = f * 4 + j; uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade[f]; } }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }
  // icône 2D → volume de pixels (faces avant/arrière + côtés là où le voisin est vide)
  function pixelGeo(id) {
    const cv = VX.icon(id).canvas, S = cv.width, px = cv.getContext('2d').getImageData(0, 0, S, S).data, pos = [], col = [];
    const op = (x, y) => x >= 0 && y >= 0 && x < S && y < S && px[(y * S + x) * 4 + 3] > 100;
    const s = 1 / S, dz = 1 / 32;
    const quad = (a, b, c, d, r, g, bl) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) col.push(r, g, bl); };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!op(x, y)) continue; const k = (y * S + x) * 4, r = px[k] / 255, g = px[k + 1] / 255, b = px[k + 2] / 255;
      const x0 = x * s - 0.5, x1 = x0 + s, y1 = 0.5 - y * s, y0 = y1 - s;
      quad([x0, y0, dz], [x1, y0, dz], [x1, y1, dz], [x0, y1, dz], r, g, b);
      quad([x1, y0, -dz], [x0, y0, -dz], [x0, y1, -dz], [x1, y1, -dz], r * 0.8, g * 0.8, b * 0.8);
      if (!op(x, y - 1)) quad([x0, y1, dz], [x1, y1, dz], [x1, y1, -dz], [x0, y1, -dz], r * 0.95, g * 0.95, b * 0.95);
      if (!op(x, y + 1)) quad([x0, y0, -dz], [x1, y0, -dz], [x1, y0, dz], [x0, y0, dz], r * 0.6, g * 0.6, b * 0.6);
      if (!op(x - 1, y)) quad([x0, y0, -dz], [x0, y0, dz], [x0, y1, dz], [x0, y1, -dz], r * 0.75, g * 0.75, b * 0.75);
      if (!op(x + 1, y)) quad([x1, y0, dz], [x1, y0, -dz], [x1, y1, -dz], [x1, y1, dz], r * 0.7, g * 0.7, b * 0.7);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return geo;
  }
  const isCube = id => VX.isBlock(id) && D[id] && D[id].tex && D[id].shape !== 'torch';
  function geoOf(id) { return geoCache[id] || (geoCache[id] = isCube(id) ? cubeGeo(id) : pixelGeo(id)); }
  FX.meshOf = (id, sz) => { const m = new THREE.Mesh(geoOf(id), isCube(id) ? blockMat : itemMat); m.scale.setScalar(sz); return m; };
  // objet posé au sol : groupe (1 à 3 exemplaires selon la pile), géométrie et matériau partagés
  FX.itemObj = function (id, n) {
    const g = new THREE.Group(), cube = isCube(id), sz = cube ? 0.26 : 0.42, copies = n >= 16 ? 3 : n >= 2 ? 2 : 1;
    for (let i = 0; i < copies; i++) { const m = FX.meshOf(id, sz); m.position.set(i * 0.07, (cube ? 0.13 : 0.2) + i * 0.05, i * -0.06); g.add(m); }
    return g;
  };
  // ramassage : l'objet file vers le joueur en rapetissant, puis disparaît
  const flying = [];
  FX.collect = obj => { flying.push({ obj, t: 0, from: obj.position.clone() }); };

  /* ---------- main à la première personne (scène à part, dessinée par-dessus, sans traverser les murs) ---------- */
  const hScene = new THREE.Scene(), hCam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
  const rig = new THREE.Group(); hScene.add(rig);
  const skinMat = new THREE.MeshBasicMaterial({ color: 0xe0b48c }), sleeveMat = new THREE.MeshBasicMaterial({ color: 0x2f7d7a });
  const arm = new THREE.Group(); rig.add(arm);
  const armSkin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.4), skinMat); armSkin.position.set(0, 0, -0.2); arm.add(armSkin);
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.155, 0.3), sleeveMat); sleeve.position.set(0, 0, 0.14); arm.add(sleeve);
  arm.rotation.set(0.32, 0.38, 0); arm.position.set(0.52, -0.52, -1.15); arm.scale.setScalar(0.5);   // épaule en bas à droite, la main remonte vers le centre
  const held = new THREE.Group(); rig.add(held);
  let heldId = -1, heldMesh = null;
  function setHeld(id) {
    if (id === heldId) return; heldId = id;
    if (heldMesh) { held.remove(heldMesh); heldMesh = null; }
    arm.visible = true;
    if (id == null) return;
    const cube = isCube(id); heldMesh = FX.meshOf(id, cube ? 0.32 : 0.55);
    if (cube) { heldMesh.position.set(0.34, -0.3, -0.78); heldMesh.rotation.set(0.15, 0.75, 0); }
    else { heldMesh.position.set(0.36, -0.2, -0.82); heldMesh.rotation.set(0, -1.35, 0.35); const it = VX.ITEMS[id]; if (it && it.tool) heldMesh.rotation.set(-0.15, -1.45, 0.55); }
    held.add(heldMesh); arm.visible = !cube;   // un bloc tenu cache le bras (il est « dans la main »)
  }
  // bouclier en volume (planches cerclées de fer, umbo central), tenu à gauche ; levé devant soi pour parer
  const shieldMats = { wood: new THREE.MeshBasicMaterial({ color: 0xb07a40 }), seam: new THREE.MeshBasicMaterial({ color: 0x7a5028 }), iron: new THREE.MeshBasicMaterial({ color: 0x8a8e96 }), boss: new THREE.MeshBasicMaterial({ color: 0xc8ccd4 }) };
  function shieldModel() {
    const g = new THREE.Group(), add = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shieldMats[m]); o.position.set(x, y, z); g.add(o); };
    add(0.5, 0.62, 0.05, 'wood', 0, 0, 0); add(0.02, 0.6, 0.055, 'seam', -0.09, 0, 0); add(0.02, 0.6, 0.055, 'seam', 0.09, 0, 0);
    add(0.54, 0.04, 0.07, 'iron', 0, 0.31, 0); add(0.54, 0.04, 0.07, 'iron', 0, -0.31, 0); add(0.04, 0.62, 0.07, 'iron', 0.25, 0, 0); add(0.04, 0.62, 0.07, 'iron', -0.25, 0, 0);
    add(0.14, 0.14, 0.09, 'boss', 0, 0, -0.03); return g;
  }
  const off = shieldModel(); off.visible = false; off.scale.setScalar(0.7); hScene.add(off);
  let blockK = 0, drawK = 0;
  let swingT = 1, equipT = 0, lastSel = -1, bob = 0;
  H.on('swing', () => { if (swingT > 0.55) swingT = 0; });
  FX.swing = () => H.emit('swing');
  // mise à jour à chaque image (avant le rendu de la scène principale)
  H.on('renderFrame', ({ dt }) => {
    stepCloud(debris, dt, true); stepCloud(smoke, dt, false); stepCloud(stars, dt, false);
    const k = dayK(); debris.mat.color.setScalar(k); smoke.mat.color.setScalar(Math.min(1, k + 0.2));
    if (flashT > 0) { flashT -= dt; flash.material.opacity = Math.max(0, flashT / 0.25) * 0.8; flash.scale.multiplyScalar(1 + dt * 4); if (flashT <= 0) flash.visible = false; }
    // fissures
    const m = G.mine;
    if (m && m.f > 0.02) { crack.visible = true; crack.position.set(m.x + 0.5, m.y + 0.5, m.z + 0.5); crackTex.offset.y = 1 - (Math.min(STAGES - 1, Math.floor(m.f * STAGES)) + 1) / STAGES; } else crack.visible = false;
    // objets au sol et ramassés
    blockMat.color.setScalar(k); itemMat.color.setScalar(k);
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i], P = G.player; f.t += dt / 0.15;
      if (f.t >= 1) { scene.remove(f.obj); flying.splice(i, 1); continue; }
      f.obj.position.set(f.from.x + (P.pos.x - f.from.x) * f.t, f.from.y + (P.pos.y + 1 - f.from.y) * f.t, f.from.z + (P.pos.z - f.from.z) * f.t); f.obj.scale.setScalar(1 - f.t * 0.7);
    }
    // main : objet tenu, balancement de marche, frappe, changement d'objet
    const P = G.player, st = G.inv[G.sel];
    if (G.sel !== lastSel || (st ? st.id : null) !== heldId) { if (lastSel !== -1) equipT = 1; lastSel = G.sel; setHeld(st ? st.id : null); }
    const hs = Math.hypot(P.vel.x, P.vel.z); if (P.onGround && hs > 0.5) bob += dt * hs * 2.1; else bob += (Math.round(bob / Math.PI) * Math.PI - bob) * Math.min(1, dt * 6);
    swingT = Math.min(1, swingT + dt / 0.28); equipT = Math.max(0, equipT - dt * 5);
    const s = Math.sin(swingT * Math.PI), s2 = Math.sin(Math.sqrt(swingT) * Math.PI);
    // frappe : la main part vers le centre et l'avant, puis redescend (translation surtout : elle reste à l'écran)
    rig.position.set(Math.sin(bob) * 0.025 - s2 * 0.13, -Math.abs(Math.cos(bob)) * 0.025 + s * 0.07 - s * s * 0.08 - equipT * 0.35, -s * 0.16);
    rig.rotation.set(s * 0.1, s2 * 0.12, s * 0.22);
    const hk = Math.min(1, k + 0.12); skinMat.color.setRGB(0.88 * hk, 0.7 * hk, 0.55 * hk); sleeveMat.color.setRGB(0.18 * hk, 0.49 * hk, 0.48 * hk);
    rig.visible = G.player.hp > 0;
    // arc tendu : l'arc remonte au centre et tremble à pleine tension ; bouclier levé : il passe devant
    const bd = G.bowDraw || 0; drawK += ((bd > 0 ? 1 : 0) - drawK) * Math.min(1, dt * 14);
    if (drawK > 0.01 && heldMesh) { const sh = bd >= 1 ? Math.sin(performance.now() * 0.06) * 0.004 : 0; rig.position.x += -0.1 * drawK + sh; rig.position.y += 0.03 * drawK; rig.position.z += 0.03 * drawK + bd * 0.06; rig.rotation.z += 0.18 * drawK; rig.rotation.y -= 0.1 * drawK; }
    blockK += ((G.blocking ? 1 : 0) - blockK) * Math.min(1, dt * 16);
    const offSh = G.offhand && G.offhand.id === (VX.I.BOUCLIER || -1), mainSh = st && st.id === (VX.I.BOUCLIER || -1);
    off.visible = !!(rig.visible && (offSh || mainSh)); held.visible = !mainSh;
    if (off.visible) {
      const sx = mainSh ? 0.5 : -0.6;   // à droite si tenu en main principale
      off.position.set(sx + (mainSh ? -0.42 : 0.5) * blockK + Math.sin(bob) * 0.02, -0.56 + 0.34 * blockK - Math.abs(Math.cos(bob)) * 0.02 - equipT * 0.3, -0.85 + 0.12 * blockK);
      off.rotation.set(0, (mainSh ? -0.5 : 0.5) * (1 - blockK), 0);
      for (const k in shieldMats) { const m = shieldMats[k]; if (!m.userData.base) m.userData.base = m.color.clone(); m.color.copy(m.userData.base).multiplyScalar(hk); }
    }
  });
  // la main est dessinée après le monde, sur un tampon de profondeur vidé
  H.on('afterRender', ({ gl, camera }) => {
    if (!rig.visible) return;
    if (hCam.aspect !== camera.aspect) { hCam.aspect = camera.aspect; hCam.updateProjectionMatrix(); }
    if (VX.UI && VX.UI.menuOpen) return;   // pas de main sur l'écran titre ni dans les menus
    const ac = gl.autoClear; gl.autoClear = false; gl.clearDepth(); gl.render(hScene, hCam); gl.autoClear = ac;
  });
})();

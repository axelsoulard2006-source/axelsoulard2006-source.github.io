/* ===== weather.js : météo de la Surface — périodes de pluie fine, orages (éclairs, tonnerre), retour au beau temps
   VX.G.weather = { rain: 0..1, storm: 0..1, flash: 0..1, mode } (lu par le rendu pour assombrir ciel et nuages ; 0 dans les Braises)
   Gouttes 3D autour du joueur (rubans fins, un seul maillage), éclaboussures au sol, bruit de pluie étouffé sous un toit.
   La pluie s'arrête au premier bloc de chaque colonne (hauteurs mises en cache, invalidées par worldSet) : rien ne tombe sous un toit.
   Pas de pluie visible dans le désert. Commande : /meteo pluie | orage | clair. ===== */
(function () {
  const VX = window.VX, B = VX.B, D = VX.BLOCKS, G = VX.G, H = VX.hooks, R = VX.R, scene = R.scene;
  const rand = (a, b) => a + Math.random() * (b - a);
  const Wt = G.weather = { rain: 0, storm: 0, flash: 0, mode: 'clair' };
  // état : mode courant, temps restant (s), niveaux lissés
  const S = { mode: 'clair', t: rand(300, 900), rain: 0, storm: 0 };
  const DUR = { clair: [600, 1500], pluie: [180, 420], orage: [150, 300] };
  function setMode(m, dur) { S.mode = m; S.t = dur || rand(DUR[m][0], DUR[m][1]); Wt.mode = m; }

  /* ---------- hauteur de la pluie par colonne (premier bloc qui l'arrête), cache 64 × 64 ---------- */
  const CN = 64, NONE = 0x7fffffff, tagX = new Int32Array(CN * CN).fill(NONE), tagZ = new Int32Array(CN * CN), topY = new Int16Array(CN * CN);
  function topAt(x, z) {
    const i = (x & 63) + ((z & 63) << 6);
    if (tagX[i] === x && tagZ[i] === z) return topY[i];
    const w = G.world; if (!w || !w.chunk(Math.floor(x / 16), Math.floor(z / 16))) return -1000;   // pas encore chargé : pas de cache
    let y = VX.H - 1; for (; y > 0; y--) { const id = w.get(x, y, z); if (id && !(D[id] && D[id].plant)) break; }
    tagX[i] = x; tagZ[i] = z; topY[i] = y; return y;
  }
  H.on('worldSet', e => { const i = (e.x & 63) + ((e.z & 63) << 6); if (tagX[i] === e.x && tagZ[i] === e.z) tagX[i] = NONE; });
  H.on('dimensionChange', () => { tagX.fill(NONE); });
  const skyOpen = (x, y, z) => topAt(Math.floor(x), Math.floor(z)) < y;

  /* ---------- gouttes : rubans verticaux tournés vers la caméra (un seul tampon, plage de dessin variable) ---------- */
  const N = 1600, RAD = 18;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N), vy = new Float32Array(N), ln = new Float32Array(N);
  const pos = new Float32Array(N * 12), alpha = new Float32Array(N * 4), ind = new Uint16Array(N * 6);
  for (let i = 0; i < N; i++) { ind.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); alpha.set([0.7, 0.7, 0, 0], i * 4); py[i] = -9999; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('a', new THREE.BufferAttribute(alpha, 1)); geo.setIndex(new THREE.BufferAttribute(ind, 1)); geo.setDrawRange(0, 0);
  const rainMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(0xb4cdf2) }, uK: { value: 1 } },
    vertexShader: 'attribute float a; varying float vA; void main(){ vA = a; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; uniform float uK; varying float vA; void main(){ gl_FragColor = vec4(uCol * uK, vA * 0.9); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const rainMesh = new THREE.Mesh(geo, rainMat); rainMesh.frustumCulled = false; rainMesh.renderOrder = 3; scene.add(rainMesh);
  // éclaboussures : petit nuage de points à part
  const SN = 260, sPos = new Float32Array(SN * 3).fill(-9999), sVel = new Float32Array(SN * 3), sLife = new Float32Array(SN); let sNext = 0;
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sMat = new THREE.PointsMaterial({ color: 0xc8dcff, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false });
  const splashPts = new THREE.Points(sGeo, sMat); splashPts.frustumCulled = false; scene.add(splashPts);
  function splash(x, y, z, water) {
    for (let k = 0; k < (water ? 3 : 2); k++) { const i = sNext; sNext = (sNext + 1) % SN; sPos[i * 3] = x; sPos[i * 3 + 1] = y + 0.02; sPos[i * 3 + 2] = z; sVel[i * 3] = rand(-0.9, 0.9); sVel[i * 3 + 1] = rand(1.2, water ? 2.8 : 2.2); sVel[i * 3 + 2] = rand(-0.9, 0.9); sLife[i] = rand(0.15, 0.32); }
  }
  function respawn(i, P, fill) {
    const a = Math.random() * 6.2832, r = Math.sqrt(Math.random()) * RAD, x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
    const y = fill ? P.eye - 6 + Math.random() * 24 : P.eye + 5 + Math.random() * 13;
    if (topAt(Math.floor(x), Math.floor(z)) + 1 >= y) { py[i] = -9999; return; }   // sous un toit / dans la roche : réessai à l'image suivante
    px[i] = x; py[i] = y; pz[i] = z; vy[i] = rand(15, 20); ln[i] = rand(0.55, 0.95);
  }
  let active = 0, dry = 0, dryT = 0, local = 0, wasActive = 0;
  function drawRain(dt) {
    const P = G.player, cam = R.camera, want = Math.round(N * local * (0.5 + 0.5 * Wt.storm));
    if (want > active) { for (let i = active; i < want; i++) respawn(i, P, true); }
    active = want; geo.setDrawRange(0, active * 6); rainMesh.visible = active > 0;
    if (!active) return;
    const rx = Math.cos(cam.rotation.y) * 0.019, rz = -Math.sin(cam.rotation.y) * 0.019, wx = Wt.storm * 3.5 + 0.6, wz = Wt.storm * 1.2;
    for (let i = 0; i < active; i++) {
      if (py[i] < -9000) { respawn(i, P, false); if (py[i] < -9000) { pos.fill(0, i * 12, i * 12 + 12); continue; } }
      py[i] -= vy[i] * dt; px[i] += wx * dt; pz[i] += wz * dt;
      const X = Math.floor(px[i]), Z = Math.floor(pz[i]), top = topAt(X, Z);
      if (py[i] <= top + 1) {   // touche le sol (ou l'eau) : éclaboussure près du joueur
        const dx = px[i] - P.pos.x, dz = pz[i] - P.pos.z;
        if (top > -999 && dx * dx + dz * dz < 140 && Math.random() < 0.55) splash(px[i], top + 1, pz[i], G.world.get(X, top, Z) === B.EAU);
        respawn(i, P, false); if (py[i] < -9000) { pos.fill(0, i * 12, i * 12 + 12); continue; }
      } else if (py[i] < P.eye - 14 || Math.abs(px[i] - P.pos.x) > RAD + 6 || Math.abs(pz[i] - P.pos.z) > RAD + 6) { respawn(i, P, false); if (py[i] < -9000) { pos.fill(0, i * 12, i * 12 + 12); continue; } }
      // ruban : bas (tête de la goutte, opaque) -> haut (traînée transparente), un peu penché par le vent
      const k = i * 12, x = px[i], y = py[i], z = pz[i], L = ln[i], tx = x - wx * L / vy[i], tz = z - wz * L / vy[i];
      pos[k] = x - rx; pos[k + 1] = y; pos[k + 2] = z - rz; pos[k + 3] = x + rx; pos[k + 4] = y; pos[k + 5] = z + rz;
      pos[k + 6] = tx + rx; pos[k + 7] = y + L; pos[k + 8] = tz + rz; pos[k + 9] = tx - rx; pos[k + 10] = y + L; pos[k + 11] = tz - rz;
    }
    geo.attributes.position.needsUpdate = true;
  }
  function stepSplash(dt) {
    let any = false;
    for (let i = 0; i < SN; i++) {
      if (sLife[i] <= 0) continue; sLife[i] -= dt; if (sLife[i] <= 0) { sPos[i * 3 + 1] = -9999; continue; }
      any = true; sVel[i * 3 + 1] -= 12 * dt; sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt; sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
    }
    if (any || wasActive) sGeo.attributes.position.needsUpdate = true; wasActive = any;
  }

  /* ---------- éclairs : rubans lumineux brisés (cœur blanc + halo bleuté), réutilisés ---------- */
  const MAXSEG = 90, bPos = new Float32Array(MAXSEG * 2 * 12), bCol = new Float32Array(MAXSEG * 2 * 12), bInd = new Uint16Array(MAXSEG * 2 * 6);
  for (let i = 0; i < MAXSEG * 2; i++) bInd.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3)); bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3)); bGeo.setIndex(new THREE.BufferAttribute(bInd, 1));
  const bolt = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  bolt.frustumCulled = false; bolt.visible = false; bolt.renderOrder = 4; scene.add(bolt);
  let boltT = -1, nextStrike = rand(4, 10); const pending = [];
  // at : [x, z] facultatif (sinon au hasard à 16–60 blocs du joueur)
  function strike(P, at) {
    const a = Math.random() * 6.2832, x = at ? Math.floor(at[0]) : Math.floor(P.pos.x + Math.cos(a) * rand(16, 60)), z = at ? Math.floor(at[1]) : Math.floor(P.pos.z + Math.sin(a) * rand(16, 60)), d = Math.hypot(x - P.pos.x, z - P.pos.z);
    let gy = topAt(x, z); if (gy < -999) gy = Math.floor(P.pos.y) - 1;
    // tracé : on descend par segments de 2 à 5 blocs en déviant au hasard ; 2 ou 3 branches
    const cam = R.camera.position, segs = [], main = [[x + rand(-3, 3), 94, z + rand(-3, 3)]];
    while (main[main.length - 1][1] > gy + 1) { const p = main[main.length - 1], ny = Math.max(gy + 1, p[1] - rand(2, 5)); main.push([p[0] + rand(-1.6, 1.6), ny, p[2] + rand(-1.6, 1.6)]); }
    main[main.length - 1] = [x + 0.5, gy + 1, z + 0.5];
    for (let i = 1; i < main.length; i++) segs.push([main[i - 1], main[i], 0.45]);
    const nb = 2 + Math.floor(Math.random() * 2);
    for (let b = 0; b < nb; b++) { let p = main[1 + Math.floor(Math.random() * Math.max(1, main.length - 4))]; const dx = rand(-1, 1), dz = rand(-1, 1); for (let k = 0; k < 4 + Math.random() * 4; k++) { const q = [p[0] + dx * rand(1, 2.5) + rand(-0.6, 0.6), p[1] - rand(1.5, 4), p[2] + dz * rand(1, 2.5) + rand(-0.6, 0.6)]; segs.push([p, q, 0.22]); p = q; } }
    let n = 0;
    const quad = (a, b, w, c) => {
      if (n >= MAXSEG * 2) return;
      const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], vx = cam.x - a[0], vy2 = cam.y - a[1], vz = cam.z - a[2];
      let sx = ay * vz - az * vy2, sy = az * vx - ax * vz, sz = ax * vy2 - ay * vx; const l = Math.hypot(sx, sy, sz) || 1; sx *= w / l; sy *= w / l; sz *= w / l;
      const k = n * 12; bPos.set([a[0] - sx, a[1] - sy, a[2] - sz, a[0] + sx, a[1] + sy, a[2] + sz, b[0] + sx, b[1] + sy, b[2] + sz, b[0] - sx, b[1] - sy, b[2] - sz], k);
      for (let j = 0; j < 4; j++) bCol.set(c, k + j * 3); n++;
    };
    for (const [a, b, w] of segs) quad(a, b, w * 3.2, [0.16, 0.2, 0.34]);   // halo
    for (const [a, b, w] of segs) quad(a, b, w, [1, 1, 1]);                // cœur
    bGeo.setDrawRange(0, n * 6); bGeo.attributes.position.needsUpdate = true; bGeo.attributes.color.needsUpdate = true;
    boltT = 0; Wt.flash = Math.max(Wt.flash, d < 35 ? 1 : 0.7);
    pending.push({ t: d / 85, near: Math.max(0, 1 - d / 60) });   // le son arrive après la lumière
    if (VX.FX) VX.FX.burst(x + 0.5, gy + 1.2, z + 0.5, 20, [1, 0.95, 0.7], { speed: 5, life: 0.5, up: 1.5 });
  }

  /* ---------- évolution du temps (en jeu, hors pause) ---------- */
  let biomeT = 0;
  H.on('playerTick', ({ dt, player: P }) => {
    S.t -= dt;
    if (S.t <= 0) setMode(S.mode === 'clair' ? (Math.random() < 0.28 ? 'orage' : 'pluie') : 'clair');
    const tr = S.mode === 'clair' ? 0 : 1, ts = S.mode === 'orage' ? 1 : 0;
    S.rain += Math.max(-dt / 15, Math.min(dt / 15, tr - S.rain)); S.storm += Math.max(-dt / 12, Math.min(dt / 12, ts - S.storm));
    const surf = G.dim === 'surface';
    Wt.rain = surf ? S.rain : 0; Wt.storm = surf ? S.storm : 0; Wt.mode = S.mode;
    // désert : la pluie n'y tombe pas (le ciel reste couvert)
    if ((biomeT -= dt) <= 0) { biomeT = 2; dry = surf && G.world.gen && G.world.gen.biomeAt(Math.floor(P.pos.x), Math.floor(P.pos.z)) === 'desert' ? 1 : 0; }
    dryT += ((dry ? 1 : 0) - dryT) * Math.min(1, dt * 0.5);
    local = surf ? Wt.rain * (1 - dryT) : 0;
    // orage : éclairs de temps en temps
    if (surf && Wt.storm > 0.5) { nextStrike -= dt; if (nextStrike <= 0) { nextStrike = rand(3, 12) * (1.6 - Wt.storm * 0.6); strike(P); } }
    for (let i = pending.length - 1; i >= 0; i--) { pending[i].t -= dt; if (pending[i].t <= 0) { G.sfx('thunder', { near: pending[i].near }); pending.splice(i, 1); } }
  });
  /* ---------- rendu à chaque image ---------- */
  H.on('renderFrame', ({ dt }) => {
    const P = G.player, dk = G.dim === 'surface' ? Math.max(0.22, R.uniforms.uDay.value) : 0.9;
    rainMat.uniforms.uK.value = Math.min(1.4, dk * 0.9 + Wt.flash * 0.6); sMat.color.setRGB(0.78 * dk, 0.86 * dk, dk);
    drawRain(dt); stepSplash(dt);
    // éclair : 3 battements rapides
    if (boltT >= 0) { boltT += dt; bolt.visible = boltT < 0.07 || (boltT > 0.12 && boltT < 0.18) || (boltT > 0.25 && boltT < 0.34); if (boltT > 0.34) { boltT = -1; bolt.visible = false; } }
    Wt.flash = Math.max(0, Wt.flash - dt * 3.2) * (Wt.flash > 0.05 && Math.random() < 0.12 ? 0.6 : 1);
    // son : étouffé sous un toit, presque rien au fond d'une grotte
    const top = topAt(Math.floor(P.pos.x), Math.floor(P.pos.z)), indoor = top >= P.eye, deep = indoor && top - P.pos.y > 10;
    if (VX.Audio && VX.Audio.rain) VX.Audio.rain(local * (deep ? 0.2 : 1), indoor);
  });

  VX.Weather = {
    set(m) { setMode(m); if (m !== 'clair') nextStrike = Math.min(nextStrike, rand(2, 5)); },
    mode: () => S.mode,
    save: () => ({ mode: S.mode, t: Math.round(S.t), rain: Math.round(S.rain * 100) / 100, storm: Math.round(S.storm * 100) / 100 }),
    load(o) { if (!o || !DUR[o.mode]) return; setMode(o.mode, o.t > 0 ? o.t : 0); S.rain = +o.rain || 0; S.storm = +o.storm || 0; },
    skyOpen, topAt, strike: at => strike(G.player, at), state: S,
  };
})();

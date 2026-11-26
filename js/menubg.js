/* ===== menubg.js : fond animé des menus (déambulation lente dans une carte, escaliers compris) ===== */
(function () {
  const BR = window.BR, Wd = () => BR.World;
  const MB = (BR.MenuBG = { running: false });
  let R = null, scene, cam, map, built, pool = [], path = [], pi = 0, pos = { x: 0, y: 0, z: 0 }, yaw = 0, t = 0, last = 0, raf = 0, curId = '';
  let ghost = null, ghostT = 30, views = null, flick = [], lights = [];
  // bruit de gradient 1D (deux octaves) : balancement de caméra naturel
  const GR = new Float32Array(256); for (let i = 0, s = 98765; i < 256; i++) { s = (s * 16807) % 2147483647; GR[i] = (s / 2147483647) * 2 - 1; }
  const pn = x => { const i = Math.floor(x), f = x - i, a = GR[i & 255] * f, b = GR[(i + 1) & 255] * (f - 1), u = f * f * f * (f * (f * 6 - 15) + 10); return (a + (b - a) * u) * 2; };
  const nz = (x, s) => pn(x + s * 13.7) * 0.67 + pn(x * 2.1 + s * 7.3) * 0.33;

  function setup(mapId) {
    const W = Wd(), def = BR.MAPS.find(m => m.id === mapId) || BR.MAPS[0];
    const T = BR.Tex.build(def.theme);
    if (scene) dispose();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(T.sky || T.fog);
    scene.fog = new THREE.FogExp2(T.fog, T.fogDensity * 1.1);
    scene.add(new THREE.AmbientLight(T.ambient, T.ambientI), new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));
    if (T.moon) { const mo = new THREE.DirectionalLight(T.moon, 0.35); mo.position.set(-0.5, 1, 0.3); scene.add(mo); }
    map = W.generate(def, 4242 + Math.floor(Math.random() * 100000), BR.DIFFS.easy);
    built = W.build(map, T); scene.add(built.group);
    flick = built.flickMeshes.map(f => ({ f, on: true }));
    lights = map.lights.filter(l => !l.dead).map(l => ({ l, x: l.kind === 'lamp' ? l.px : (l.cx + 0.5) * W.C, y: l.kind === 'lamp' ? l.y : l.y - 0.35, z: l.kind === 'lamp' ? l.pz : (l.cy + 0.5) * W.C }));
    cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 160); cam.rotation.order = 'YXZ';
    pool = []; for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(T.lightColor, 0.9, 10, 2); scene.add(l); pool.push(l); }
    const s = W.nodePos(map, map.spawnNode); pos = { x: s.x, y: s.y, z: s.z }; path = []; pi = 0;
    views = new BR.Ent.Views(scene, { fogColor: new THREE.Color(T.fog), fogDensity: T.fogDensity });
    views.brightFn = () => 0.6;
    ghost = null; ghostT = 20 + Math.random() * 20;
    curId = mapId;
  }
  function dispose() {
    if (views) views.clear();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    scene = null;
  }
  // trajet vers un nœud lointain en suivant le champ de navigation (escaliers et chutes compris)
  function newPath() {
    const W = Wd();
    const start = W.nodeAt(map, pos.x, pos.y + 0.5, pos.z);
    let goal = map.reach[Math.floor(Math.random() * map.reach.length)];
    for (let k = 0; k < 10; k++) { const g = map.reach[Math.floor(Math.random() * map.reach.length)], p = W.nodePos(map, g); if (Math.hypot(p.x - pos.x, p.z - pos.z) > 30) { goal = g; break; } }
    const f = W.field(map, goal);
    const pts = []; let n = start;
    for (let k = 0; k < 300 && n >= 0 && f[n] > 0; k++) {
      let best = -1, bv = f[n];
      W.neighbors(map, n, q => { if (f[q] >= 0 && f[q] < bv) { bv = f[q]; best = q; } });
      if (best < 0) break; n = best; pts.push(W.nodePos(map, n));
    }
    path = pts; pi = 0;
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!MB.running || (BR.Game && BR.Game.active) || document.hidden || !scene) return;
    t += dt;
    if (pi >= path.length) newPath();
    if (!path.length) return;
    const aim = path[Math.min(path.length - 1, pi)];
    if (Math.hypot(aim.x - pos.x, aim.z - pos.z) < 1.1) pi++;
    const look = path[Math.min(path.length - 1, pi + 2)] || aim;
    const dx = aim.x - pos.x, dz = aim.z - pos.z, d = Math.hypot(dx, dz) || 1, sp = 1.5;
    pos.x += dx / d * Math.min(d, sp * dt); pos.z += dz / d * Math.min(d, sp * dt);
    pos.y += (aim.y - pos.y) * Math.min(1, dt * 2.5);
    const want = Math.atan2(-(look.x - pos.x), -(look.z - pos.z));
    yaw += BR.angDiff(yaw, want) * Math.min(1, dt * 1.3);
    // caméra portée : pas lents (creux à chaque appui) + dérive organique (bruit de Perlin), comme un enregistrement à l'épaule
    const ph = t * 3.6, dip = Math.pow(1 - Math.abs(Math.sin(ph)), 2.5);
    cam.position.set(pos.x + Math.cos(yaw) * Math.cos(ph) * 0.012, pos.y + 1.65 - dip * 0.02 + nz(t * 0.5, 1) * 0.01, pos.z - Math.sin(yaw) * Math.cos(ph) * 0.012);
    cam.rotation.set(nz(t * 0.23, 2) * 0.035 + (look.y - pos.y) * 0.06 - 0.02 - dip * 0.004, yaw + nz(t * 0.17, 3) * 0.05, Math.cos(ph) * 0.004 + nz(t * 0.31, 4) * 0.008);
    const L = lights.map(o => ({ o, d: Math.hypot(o.x - pos.x, (o.y - pos.y) * 1.5, o.z - pos.z) })).sort((a, b) => a.d - b.d);
    pool.forEach((pl, i) => { const o = L[i]; if (o && o.d < 26) { pl.position.set(o.o.x, o.o.y, o.o.z); pl.intensity = o.o.l.kind === 'lamp' ? 1.3 : 0.9; pl.distance = o.o.l.kind === 'lamp' ? 17 : 10; } else pl.intensity = 0; });
    flick.forEach(o => { const l = o.f.light, n = Math.sin(t * 13 + l.phase) + Math.sin(t * 5.3 + l.phase * 2) * 0.8; const on = n > -0.9; if (on !== o.on) { o.on = on; o.f.mesh.material = on ? built.onMat : built.dimMat; } });
    // apparition furtive d'une entité au loin
    ghostT -= dt;
    if (ghostT <= 0 && !ghost && BR.Ent.count() > 0 && path.length - pi > 7) {
      const q = path[Math.min(path.length - 1, pi + 7)];
      if (Wd().los(map, pos.x, pos.y + 1.6, pos.z, q.x, q.y + 1.4, q.z)) ghost = { id: 1, x: q.x, y: q.y, z: q.z, st: 'chase', sp: Math.floor(Math.random() * BR.Ent.count()), t: 2.2 };
      ghostT = 30 + Math.random() * 35;
    }
    if (ghost) { ghost.t -= dt; if (ghost.t <= 0 || Math.hypot(ghost.x - pos.x, ghost.z - pos.z) < 6) ghost = null; }
    views.sync(ghost ? [ghost] : [], dt, cam.position);
    R.render(scene, cam);
  }
  function resize() { if (!R) return; R.setSize(innerWidth, innerHeight, false); if (cam) { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); } }

  MB.start = function (mapId) {
    mapId = mapId || 'backrooms';
    if (!R) {
      R = new THREE.WebGLRenderer({ canvas: BR.$('#bg'), antialias: false, powerPreference: 'low-power' });
      R.setPixelRatio(Math.min(1, window.devicePixelRatio || 1)); R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.1;
      window.addEventListener('resize', resize);
    }
    if (mapId !== curId) { try { setup(mapId); } catch (e) { console.warn('fond de menu', e); return; } }
    resize();
    MB.running = true;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  MB.setTheme = function (mapId) { if (mapId && mapId !== curId && MB.running) { try { setup(mapId); } catch (e) {} } };
  MB.stop = function () { MB.running = false; };
})();

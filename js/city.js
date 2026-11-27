/* ===== city.js : LA VILLE DES JEUX — l'accueil du jeu global
   Une ville 3D partagée : on s'y promène avec son personnage, on voit les autres joueurs connectés (présence « city »),
   et chaque bâtiment ouvre un jeu : Stade (Bousculade), Tour jaune (Backrooms), Citadelle (Colosses : L'Ascension),
   Tour aux portes (Les Portes), Chantier (Blocaria). Au centre : fontaine et grand panneau (en ligne, salons, défis).
   ZQSD / flèches : marcher · Espace : sauter · Maj : courir · clic + glisser : caméra · molette : zoom · E : entrer
   1-4 : émotes · Entrée : discuter ===== */
(function () {
  const BR = window.BR, Au = BR.Audio, Acc = BR.Account, V3 = THREE.Vector3;
  const C = (BR.City = {}); let V = null;
  const L = c => new THREE.Color(c);
  const DEST = [
    { id: 'bousculade', name: 'BOUSCULADE', sub: 'Le Stade · party game jusqu\'à 8', col: '#ff4f9e', ang: 0 },
    { id: 'backrooms', name: 'BACKROOMS', sub: 'La Tour jaune · survie à plusieurs', col: '#e8cf62', ang: 72 },
    { id: 'ascension', name: 'COLOSSES', sub: 'La Citadelle · L\'Ascension', col: '#ffb24a', ang: 144 },
    { id: 'portes', name: 'LES PORTES', sub: 'La Tour aux portes · défis', col: '#5fe08c', ang: 216 },
    { id: 'blocs', name: 'BLOCARIA', sub: 'Le Chantier · bac à sable', col: '#6cc04a', ang: 288 },
  ];
  const RING = 50, PLAZA = 17, BOUND = 115;
  DEST.forEach(d => { const a = d.ang * Math.PI / 180; d.dir = [Math.sin(a), -Math.cos(a)]; d.pos = [d.dir[0] * RING, d.dir[1] * RING]; d.door = [d.dir[0] * (RING - 13), d.dir[1] * (RING - 13)]; d.yaw = Math.atan2(-d.dir[0], -d.dir[1]); });
  function goGame(id) {
    if (id === 'blocs') { Au.ui('ok'); location.href = 'blocs/index.html'; return; }
    Au.ui('ok'); BR.ascMode = id === 'ascension';
    BR.UI.show(id === 'ascension' ? 'asc' : id === 'portes' ? 'portes' : id === 'bousculade' ? 'party' : 'main');
  }
  /* ---------- petites briques ---------- */
  function M(geo, col, o) { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(Object.assign({ color: L(col), roughness: 0.75, flatShading: true }, o || {}))); m.castShadow = m.receiveShadow = true; V.disp.push(geo, m.material); return m; }
  const box = (w, h, d, col, o) => M(new THREE.BoxGeometry(w, h, d), col, o);
  const cyl = (r1, r2, h, col, seg, o) => M(new THREE.CylinderGeometry(r1, r2, h, seg || 12), col, o);
  const at = (m, x, y, z, g) => { m.position.set(x, y, z); (g || V.scene).add(m); return m; };
  function textTex(lines, w, h, bg, fg) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    lines.forEach(([t, size, col, y]) => { g.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = size / 7; g.strokeStyle = 'rgba(30,15,60,0.85)'; g.strokeText(t, w / 2, y); g.fillStyle = col || fg || '#fff'; g.fillText(t, w / 2, y); });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; V.disp.push(t); return { t, c, g };
  }
  function sign(d, g, y, w) {
    const T = textTex([[d.name, 120, '#ffffff', 92], [d.sub, 46, '#ffe9a8', 200]], 1024, 256, null);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: T.t, transparent: true, side: THREE.DoubleSide })); V.disp.push(m.geometry, m.material);
    m.position.set(0, y, 0); g.add(m); return m;
  }
  function label(text, col) {
    const T = textTex([[text, 54, col || '#fff', 48]], 512, 96, null);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.t, transparent: true, depthWrite: false })); s.scale.set(2.6, 0.5, 1); V.disp.push(s.material); return s;
  }
  /* ---------- les bâtiments (groupe local : la porte regarde +z, vers la place) ---------- */
  const BUILD = {
    bousculade(g, d) {
      const wall = cyl(11, 12, 8, '#ff7ab8', 28); at(wall, 0, 4, -2, g);
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, s = box(1, 8.2, 0.4, '#ffffff'); s.position.set(Math.sin(a) * 11.6, 4.1, -2 + Math.cos(a) * 11.6); s.rotation.y = a; g.add(s); }
      const rim = M(new THREE.TorusGeometry(11.4, 0.7, 8, 32), '#7a6cff'); rim.rotation.x = Math.PI / 2; at(rim, 0, 8.2, -2, g);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, p = cyl(0.12, 0.12, 5, '#ffffff', 6); at(p, Math.sin(a) * 11.4, 10.5, -2 + Math.cos(a) * 11.4, g); const f = box(1.6, 1, 0.06, ['#ffe14a', '#3fd0ff', '#47d16c'][i % 3]); at(f, Math.sin(a) * 11.4 + 0.8, 12.4, -2 + Math.cos(a) * 11.4, g); V.flags.push(f); }
      const arch = M(new THREE.TorusGeometry(3, 0.6, 8, 16, Math.PI), '#ffe14a'); at(arch, 0, 0, 9.6, g);
      sign(d, g, 13.5, 13);
    },
    backrooms(g, d) {
      at(box(14, 18, 10, '#d8c26a'), 0, 9, -1, g); at(box(14.4, 0.6, 10.4, '#8a7a3a'), 0, 18.3, -1, g);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) { const w = box(2, 1.6, 0.2, '#fff6b8', { emissive: L('#fff3a0'), emissiveIntensity: 0.9 }); at(w, -4.5 + x * 3, 4 + y * 3, 4.05, g); V.flick.push(w.material); }
      at(box(3, 4, 0.3, '#3a3320'), 0, 2, 4.1, g);
      sign(d, g, 21, 13);
    },
    ascension(g, d) {
      at(box(14, 10, 12, '#9c958a'), 0, 5, -2, g);
      for (const [x, z] of [[-7.5, 4.5], [7.5, 4.5], [-7.5, -8.5], [7.5, -8.5]]) { at(cyl(2.4, 2.6, 15, '#8a847a', 10), x, 7.5, z, g); at(M(new THREE.ConeGeometry(3, 4.5, 10), '#c0532a'), x, 17.2, z, g); }
      for (let i = -6; i <= 6; i += 2) at(box(1, 1.2, 1, '#9c958a'), i, 10.6, 4, g);
      at(box(4, 6, 0.4, '#3a2a1a'), 0, 3, 4.05, g); at(M(new THREE.TorusGeometry(2, 0.35, 6, 12, Math.PI), '#6a645a'), 0, 6, 4.1, g);
      for (const x of [-3.5, 3.5]) { const b = box(1.6, 4, 0.08, '#ffb24a'); at(b, x, 6.5, 4.3, g); V.flags.push(b); }
      sign(d, g, 21.5, 13);
    },
    portes(g, d) {
      at(cyl(6, 7, 26, '#ece6f6', 14), 0, 13, -2, g); at(M(new THREE.ConeGeometry(7.5, 6, 14), '#5fe08c'), 0, 29, -2, g);
      const cols = ['#ff4f9e', '#3fd0ff', '#ffe14a', '#7a6cff', '#47d16c', '#ff8a3d'];
      for (let i = 0; i < 40; i++) { const a = i * 0.9, y = 2 + (i * 0.55) % 22, dd = box(1.1, 1.9, 0.2, cols[i % cols.length]); dd.position.set(Math.sin(a) * 6.45, y, -2 + Math.cos(a) * 6.45); dd.rotation.y = a; g.add(dd); }
      const beacon = cyl(0.8, 0.8, 1.4, '#c8ffd8', 8, { emissive: L('#5fe08c'), emissiveIntensity: 1.5 }); at(beacon, 0, 32.5, -2, g); V.beacons.push(beacon);
      at(box(2.6, 3.8, 0.3, '#5fe08c', { emissive: L('#2a8a4a'), emissiveIntensity: 0.6 }), 0, 1.9, 4.7, g);
      sign(d, g, 9, 12).position.z = 5.5;
    },
    blocs(g, d) {
      const cols = ['#6cc04a', '#8a5a33', '#8b8b90', '#e2d39c', '#3fa6ff'], r = BR.rng ? BR.rng(5) : Math.random;
      for (let x = -5; x <= 5; x++) for (let z = -8; z <= 0; z++) { const h = Math.max(1, Math.round(4 - Math.hypot(x, z + 4) * 0.55 + (Math.sin(x * 1.7 + z) + 1))); for (let y = 0; y < h; y++) { const b = box(1.98, 1.98, 1.98, y === h - 1 ? cols[0] : y > h - 3 ? cols[1] : cols[2]); at(b, x * 2, 1 + y * 2, z * 2, g); } }
      at(box(0.8, 22, 0.8, '#ffb13d'), 9, 11, -6, g); at(box(16, 0.8, 0.8, '#ffb13d'), 3, 22, -6, g); at(box(0.12, 8, 0.12, '#333'), -3, 18, -6, g); at(box(2, 2, 2, cols[4]), -3, 13.5, -6, g);
      sign(d, g, 16, 13).position.z = 3;
    },
  };
  /* ---------- construction de la ville ---------- */
  function build() {
    const S = V.scene;
    S.background = L('#9fdcff'); S.fog = new THREE.Fog(0xbfe8ff, 90, 240);
    S.add(new THREE.HemisphereLight(0xdfefff, 0x5a7a3a, 0.55));
    const sun = new THREE.DirectionalLight(0xfff0d6, 1.1); sun.position.set(-40, 80, 30); sun.castShadow = V.q !== 'low';
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004;
    S.add(sun); S.add(sun.target); V.sun = sun;
    const ground = M(new THREE.CircleGeometry(260, 48), '#7cc35a'); ground.rotation.x = -Math.PI / 2; ground.castShadow = false; S.add(ground);
    const plaza = cyl(PLAZA, PLAZA, 0.2, '#e8cfa8', 40); plaza.castShadow = false; at(plaza, 0, 0.1, 0);
    const ring = M(new THREE.TorusGeometry(PLAZA, 0.35, 6, 48), '#d8c4a0'); ring.rotation.x = Math.PI / 2; at(ring, 0, 0.2, 0);
    // fontaine
    at(cyl(4.4, 4.8, 1, '#c8d4e0', 24), 0, 0.5, 0); const water = cyl(3.9, 3.9, 0.15, '#4fb8ff', 24, { emissive: L('#1a5aa0'), emissiveIntensity: 0.3 }); at(water, 0, 0.95, 0); at(cyl(0.6, 0.9, 3, '#c8d4e0', 12), 0, 1.5, 0);
    V.jets = []; for (let i = 0; i < 24; i++) { const j = M(new THREE.SphereGeometry(0.16, 6, 4), '#bfe8ff', { emissive: L('#7fd0ff'), emissiveIntensity: 0.6 }); j.castShadow = false; S.add(j); V.jets.push({ m: j, t: i / 24 }); }
    // boulevards, réverbères, panneaux indicateurs
    DEST.forEach(d => {
      const len = RING - 13 - PLAZA + 1, mid = PLAZA + len / 2 - 0.5, road = box(7, 0.12, len, '#5a5a66'); road.castShadow = false; road.position.set(d.dir[0] * mid, 0.06, d.dir[1] * mid); road.rotation.y = d.yaw; S.add(road);
      for (let k = 0; k < len; k += 4) { const dash = box(0.3, 0.13, 2, '#ffffff'); dash.castShadow = false; const p = PLAZA + k + 1; dash.position.set(d.dir[0] * p, 0.07, d.dir[1] * p); dash.rotation.y = d.yaw; S.add(dash); }
      for (const sd of [-1, 1]) for (let k = 8; k < len; k += 10) { const p = PLAZA + k, px = d.dir[0] * p + Math.cos(d.yaw) * sd * 4.6, pz = d.dir[1] * p - Math.sin(d.yaw) * sd * 4.6; at(cyl(0.12, 0.15, 4.5, '#3a3a46', 6), px, 2.25, pz); const bulb = M(new THREE.SphereGeometry(0.4, 8, 6), '#fff3c0', { emissive: L('#ffe08a'), emissiveIntensity: 0.9 }); bulb.castShadow = false; at(bulb, px, 4.6, pz); V.colliders.push({ x: px, z: pz, r: 0.4 }); }
      // panneau indicateur au bord de la place
      const sp = PLAZA - 1.5, sx = d.dir[0] * sp + Math.cos(d.yaw) * 4.5, sz = d.dir[1] * sp - Math.sin(d.yaw) * 4.5;
      at(cyl(0.1, 0.1, 3, '#8a6238', 6), sx, 1.5, sz); const pl = box(2.8, 0.7, 0.12, d.col); pl.position.set(sx, 2.8, sz); pl.rotation.y = d.yaw; S.add(pl);
      const lb = label('→ ' + d.name, '#fff'); lb.position.set(sx, 3.6, sz); lb.scale.set(3.4, 0.65, 1); S.add(lb);
      // le bâtiment
      const g = new THREE.Group(); g.position.set(d.pos[0], 0, d.pos[1]); g.rotation.y = d.yaw; S.add(g); BUILD[d.id](g, d);
      V.colliders.push({ x: d.pos[0], z: d.pos[1], r: 11.5, b: d });
      // la porte : anneau lumineux au sol
      const pad = M(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 28), d.col, { emissive: L(d.col), emissiveIntensity: 0.55, transparent: true, opacity: 0.85 }); pad.castShadow = false; at(pad, d.door[0], 0.1, d.door[1]); V.pads.push({ m: pad, d });
    });
    // arbres, bancs, ballons, collines
    const rr = (BR.rng ? BR.rng(77) : Math.random);
    for (let i = 0; i < 140; i++) {
      const a = rr() * Math.PI * 2, r = 22 + rr() * 90, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (DEST.some(d => Math.hypot(x - d.pos[0], z - d.pos[1]) < 17)) continue;
      if (DEST.some(d => { const t = x * d.dir[0] + z * d.dir[1], o = Math.abs(x * d.dir[1] - z * d.dir[0]); return t > 0 && t < RING && o < 7; })) continue;
      const h = 2 + rr() * 2.5; at(cyl(0.3, 0.4, h, '#8a5a33', 6), x, h / 2, z); const top = M(rr() < 0.5 ? new THREE.ConeGeometry(1.8, 3.5, 7) : new THREE.IcosahedronGeometry(1.9, 0), ['#3f9a3a', '#5cb84a', '#2f8a5a'][i % 3]); at(top, x, h + 1.4, z); V.colliders.push({ x, z, r: 0.7 });
    }
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2 + 0.2; if (DEST.some(d => Math.abs(BR.angDiff(a, Math.atan2(d.dir[0], -d.dir[1]))) < 0.3)) continue; const x = Math.sin(a) * (PLAZA - 2.5), z = -Math.cos(a) * (PLAZA - 2.5); const b = box(3, 0.3, 1, '#a8743f'); b.position.set(x, 0.6, z); b.rotation.y = -a; S.add(b); }
    V.balloons = []; for (let i = 0; i < 9; i++) { const b = M(new THREE.SphereGeometry(0.9, 10, 8), ['#ff4f9e', '#3fd0ff', '#ffe14a', '#7a6cff', '#47d16c'][i % 5]); b.castShadow = false; const a = i / 9 * Math.PI * 2; S.add(b); V.balloons.push({ m: b, x: Math.cos(a) * 9, z: Math.sin(a) * 9, ph: i }); }
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, h = 25 + rr() * 30, hill = M(new THREE.ConeGeometry(30 + rr() * 20, h, 7), '#6aae4e'); hill.castShadow = false; at(hill, Math.cos(a) * 190, h / 2 - 2, Math.sin(a) * 190); }
    // le grand panneau (en ligne, salons, défis)
    const board = new THREE.Group(); board.position.set(-10.5, 0, 6); board.rotation.y = 0.75; S.add(board);
    for (const x of [-3.6, 3.6]) at(cyl(0.15, 0.15, 6.5, '#3a3a46', 6), x, 3.25, 0, board);
    V.boardT = textTex([], 1024, 640, '#2a1f4a'); const bp = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.75), new THREE.MeshBasicMaterial({ map: V.boardT.t, side: THREE.DoubleSide })); V.disp.push(bp.geometry, bp.material); bp.position.set(0, 4.3, 0); board.add(bp);
    V.colliders.push({ x: 0, z: 0, r: 4.9 }, { x: -10.5 - 2.4, z: 6 + 2.4, r: 0.35 }, { x: -10.5 + 2.4, z: 6 - 2.4, r: 0.35 });
    paintBoard();
  }
  function paintBoard() {
    if (!V) return; const { g, c, t } = V.boardT, N = BR.Net, P = V.pres || {};
    g.fillStyle = '#2a1f4a'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#ff4f9e'; g.fillRect(0, 0, c.width, 92);
    g.font = '900 56px "Trebuchet MS", system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('LA VILLE DES JEUX', 512, 64);
    g.textAlign = 'left'; g.font = '700 38px "Trebuchet MS", system-ui';
    const here = (V.remote ? V.remote.size : 0) + 1, online = N && N.status === 'on' ? N.online : null;
    const rows = [['🏙️ En ville', here + ' joueur' + (here > 1 ? 's' : '')], ['🌐 Connectés au serveur', online == null ? 'connexion…' : String(online)]];
    const cnt = k => (P[k] || []).length; rows.push(['🎉 Backrooms', cnt('backrooms') + ' en jeu'], ['⚔️ Colosses', cnt('colosses') + ' en jeu'], ['🚪 Les Portes', cnt('portes') + ' en jeu']);
    const rooms = (N && N.rooms) || []; rows.push(['🏠 Salons ouverts', String(rooms.filter(r => r.state === 'lobby').length)]);
    try { if (BR.Party && BR.Party.dailyInfo) { const d = BR.Party.dailyInfo(); rows.push(['⏱ Défi du jour', d.name]); } } catch (e) {}
    if (V.top) rows.push(['🏆 Champion classé', V.top]);
    rows.slice(0, 8).forEach(([a, b], i) => { const y = 150 + i * 62; g.fillStyle = '#ffe9a8'; g.fillText(a, 40, y); g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(b, 984, y); g.textAlign = 'left'; });
    t.needsUpdate = true;
  }
  /* ---------- les autres joueurs (présence partagée « city ») ---------- */
  function netInit() {
    const N = BR.VNet; V.remote = new Map(); if (!N) return;
    V.netOff = [N.on('join', p => addRemote(p)), N.on('leave', p => removeRemote(p.id)), N.on('pos', p => { const R = V && V.remote.get(p.id); if (R) Object.assign(R.tgt, { x: p.x, y: p.y, z: p.z, r: p.r, a: p.a }); }),
      N.on('emote', m => { const R = V && V.remote.get(m.id); if (R) try { R.av.act(m.e); } catch (e) {} }), N.on('chat', m => chatIn(m)), N.on('reset', () => { if (V) [...V.remote.keys()].forEach(removeRemote); })];
    N.enter({ x: V.pos.x, y: V.pos.y, z: V.pos.z, r: V.face, a: 'Idle', w: 'city' });
    (N.players || new Map()).forEach(p => addRemote(p));
  }
  function addRemote(p) {
    if (!V || !p || V.remote.has(p.id)) return; let av; try { av = BR.Avatar.build(p.look || { skin: 'survivor' }); } catch (e) { return; }
    av.group.position.set(p.x || 0, p.y || 0, p.z || 0); V.scene.add(av.group); const lb = label(String(p.n || 'Joueur').slice(0, 18), '#bfe8ff'); lb.position.y = 2.5; av.group.add(lb);
    V.remote.set(p.id, { av, lb, tgt: { x: p.x || 0, y: p.y || 0, z: p.z || 0, r: p.r || 0, a: p.a || 'Idle' } }); paintBoard();
  }
  function removeRemote(id) { const R = V && V.remote.get(id); if (!R) return; V.scene.remove(R.av.group); try { R.av.dispose(); } catch (e) {} V.remote.delete(id); paintBoard(); }
  function chatIn(m) {
    if (!V) return; const line = document.createElement('div'); line.innerHTML = `<b>${BR.esc(m.n || '?')}</b> ${BR.esc(m.m)}`; V.log.appendChild(line); while (V.log.children.length > 6) V.log.firstChild.remove(); setTimeout(() => line.remove(), 15000);
    const R = m.me ? { av: V.av } : V.remote.get(m.id); if (R) bubble(R.av.group, m.m);
  }
  function bubble(g, text) { if (g.userData.bub) g.remove(g.userData.bub); const s = label(String(text).slice(0, 40), '#ffffff'); s.position.y = 3.1; s.scale.set(4.2, 0.8, 1); g.add(s); g.userData.bub = s; setTimeout(() => { if (g.userData.bub === s) { g.remove(s); g.userData.bub = null; } }, 4500); }
  /* ---------- démarrage / arrêt ---------- */
  C.start = function (root) {
    C.stop();
    const q = (BR.settings && BR.settings.quality) || 'high';
    const canvas = BR.el('canvas', { class: 'city-gl' }); root.prepend(canvas);
    const R = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(q === 'low' ? 1 : 1.5, devicePixelRatio || 1)); R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.NoToneMapping;
    R.shadowMap.enabled = q !== 'low'; R.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 600);
    V = { root, canvas, R, scene, cam, q, disp: [], colliders: [], pads: [], flags: [], flick: [], beacons: [], keys: {}, yaw: Math.PI, pitch: 0.38, dist: 9, vy: 0, t: 0, last: performance.now(), face: Math.PI, near: null };
    build();
    const av = BR.Avatar.build(Acc.p.look || { skin: 'survivor' }); av.group.traverse(m => { if (m.isMesh) m.castShadow = true; }); scene.add(av.group); V.av = av;
    const back = C._back; C._back = null; const from = back && DEST.find(d => d.id === back);
    if (from) { av.group.position.set(from.door[0] - from.dir[0] * 3, 0, from.door[1] - from.dir[1] * 3); V.face = Math.atan2(-from.dir[0], -from.dir[1]); }
    else { av.group.position.set(0, 0, 13); V.face = Math.PI; }
    V.pos = av.group.position; V.yaw = V.face + Math.PI; av.group.rotation.y = V.face;
    // interface
    const hud = BR.el('div', { class: 'city-hud' }); hud.innerHTML = `<div class="ch-title"><small>Promène-toi et entre dans un bâtiment… ou clique sur un jeu à droite pour y aller</small></div>
      <div class="ch-go">${DEST.map(d => `<button data-go="${d.id}" style="--c:${d.col}"><b>${d.name}</b><span>${d.sub}</span></button>`).join('')}<button data-quick="1" class="ch-quick">⚡ Accès rapide (liste des jeux)</button><button data-char="1" class="ch-quick">🧑 Personnage</button></div>
      <div class="ch-prompt"></div><div class="ch-log"></div><div class="ch-keys">ZQSD marcher · Maj courir · Espace sauter · clic-glisser caméra · E entrer · 1-4 émotes · Entrée discuter</div>`;
    root.appendChild(hud); V.hud = hud; V.prompt = hud.querySelector('.ch-prompt'); V.log = hud.querySelector('.ch-log');
    hud.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const d = DEST.find(x => x.id === b.dataset.go); walkTo(d); });
    hud.querySelector('[data-quick]').onclick = () => { Au.ui('click'); BR.UI.show('games'); };
    hud.querySelector('[data-char]').onclick = () => { Au.ui('click'); BR.UI.show('char', { back: 'hub' }); };
    V.prompt.onclick = () => { if (V.near) enter(V.near); };
    bind(); try { netInit(); } catch (e) { console.warn('ville réseau', e); }
    V.presT = 0; V.raf = requestAnimationFrame(loop);
    loadTop();
  };
  C.stop = function () {
    if (!V) return; cancelAnimationFrame(V.raf); unbind();
    try { (V.netOff || []).forEach(off => off()); if (BR.VNet) BR.VNet.leave(); } catch (e) {}
    if (V.remote) [...V.remote.keys()].forEach(removeRemote);
    try { V.av.dispose(); } catch (e) {}
    V.disp.forEach(o => { try { o.dispose(); } catch (e) {} }); V.R.dispose(); V.canvas.remove(); if (V.hud) V.hud.remove(); V = null;
  };
  C.active = () => !!V;
  C._v = () => V;
  function loadTop() { try { BR.Net.api('/api/leaderboard', { retries: 1, timeout: 30000 }).then(j => { if (!V) return; const t = j && j.bz && j.bz.top && j.bz.top[0]; V.top = t ? t.name + ' · ' + t.rp + ' RP' : null; paintBoard(); }).catch(() => {}); } catch (e) {} }
  function enter(d) { if (!V || V.leaving) return; V.leaving = true; C._back = d.id; goGame(d.id); }
  function walkTo(d) { Au.ui('click'); V.auto = d; }
  /* ---------- entrées ---------- */
  const H = {
    kd: e => { if (!V || /^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName)) return; V.keys[e.code] = true;
      if (e.code === 'KeyE' && V.near) enter(V.near);
      if (/^Digit[1-4]$/.test(e.code)) { const E = ['Cheer', 'Spellcast_Raise', '2H_Melee_Attack_Spin', 'Interact'][+e.code.slice(5) - 1]; try { V.av.act(E); } catch (x) {} if (BR.VNet) BR.VNet.emote(E); }
      if (e.code === 'Enter') { e.preventDefault(); openChat(); }
      if (e.code === 'Space') e.preventDefault(); },
    ku: e => { if (V) V.keys[e.code] = false; },
    md: e => { if (!V || e.target !== V.canvas) return; V.drag = { x: e.clientX, y: e.clientY }; },
    mm: e => { if (!V || !V.drag) return; V.yaw -= (e.clientX - V.drag.x) * 0.006; V.pitch = Math.max(0.05, Math.min(1.2, V.pitch + (e.clientY - V.drag.y) * 0.004)); V.drag = { x: e.clientX, y: e.clientY }; },
    mu: () => { if (V) V.drag = null; },
    wh: e => { if (!V || e.target !== V.canvas) return; V.dist = Math.max(4, Math.min(22, V.dist + Math.sign(e.deltaY) * 1.2)); },
    rs: () => { if (!V) return; V.R.setSize(innerWidth, innerHeight, false); V.cam.aspect = innerWidth / innerHeight; V.cam.updateProjectionMatrix(); },
  };
  function bind() { addEventListener('keydown', H.kd); addEventListener('keyup', H.ku); addEventListener('mousedown', H.md); addEventListener('mousemove', H.mm); addEventListener('mouseup', H.mu); addEventListener('wheel', H.wh, { passive: true }); addEventListener('resize', H.rs); H.rs(); }
  function unbind() { removeEventListener('keydown', H.kd); removeEventListener('keyup', H.ku); removeEventListener('mousedown', H.md); removeEventListener('mousemove', H.mm); removeEventListener('mouseup', H.mu); removeEventListener('wheel', H.wh); removeEventListener('resize', H.rs); }
  function openChat() {
    if (!V || V.chatEl) return; V.keys = {};
    const inp = BR.el('input', { class: 'ch-chat', maxlength: '120', placeholder: 'Message à la ville… (Entrée : envoyer · Échap : fermer)' }); V.hud.appendChild(inp); V.chatEl = inp; inp.focus();
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const t = inp.value.trim(); if (t) { if (BR.VNet && BR.VNet.inside && BR.Net.status === 'on') BR.VNet.chat(t); else chatIn({ n: Acc.p.name, m: t, me: true }); } inp.remove(); V.chatEl = null; } else if (e.key === 'Escape') { inp.remove(); V.chatEl = null; } });
  }
  /* ---------- boucle ---------- */
  function loop(now) { if (!V) return; V.raf = requestAnimationFrame(loop); tick(now); }
  C._step = dt => V && tick(V.last + dt * 1000);   // test
  function tick(now) {
    const dt = Math.min(0.05, (now - V.last) / 1000); V.last = now; V.t += dt;
    const k = V.keys, P = V.pos;
    let ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), iz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    if (ix || iz) V.auto = null;
    const run = k.ShiftLeft || k.ShiftRight, spd = run ? 8.5 : 5;
    let wx = 0, wz = 0;
    if (V.auto) { const d = V.auto, dx = d.door[0] - P.x, dz = d.door[1] - P.z, dd = Math.hypot(dx, dz); if (dd < 1.2) V.auto = null; else { wx = dx / dd; wz = dz / dd; } }
    else if (ix || iz) { const f = [-Math.sin(V.yaw), -Math.cos(V.yaw)], r = [Math.cos(V.yaw), -Math.sin(V.yaw)]; wx = f[0] * iz + r[0] * ix; wz = f[1] * iz + r[1] * ix; const l = Math.hypot(wx, wz); wx /= l; wz /= l; }
    const sp = V.auto ? 8.5 : spd; P.x += wx * sp * dt; P.z += wz * sp * dt;
    if (wx || wz) { const tf = Math.atan2(wx, wz); V.face += BR.angDiff(V.face, tf) * Math.min(1, dt * 12); V.av.group.rotation.y = V.face; if (V.auto) V.yaw += BR.angDiff(V.yaw, V.face + Math.PI) * Math.min(1, dt * 2); }
    // saut
    if (k.Space && P.y <= 0.001) V.vy = 7; V.vy -= 22 * dt; P.y = Math.max(0, P.y + V.vy * dt); if (P.y === 0) V.vy = Math.max(0, V.vy);
    // collisions (cercles) et limites
    for (const c of V.colliders) { const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz), r = c.r + 0.45; if (d < r && d > 1e-4) { P.x = c.x + dx / d * r; P.z = c.z + dz / d * r; } }
    const pr = Math.hypot(P.x, P.z); if (pr > BOUND) { P.x *= BOUND / pr; P.z *= BOUND / pr; }
    const moving = Math.hypot(wx, wz) > 0;
    V.av.update(dt, moving ? sp : 0, { air: P.y > 0.05, sprint: sp > 8 });
    // porte la plus proche
    let near = null; for (const pd of V.pads) { const dd = Math.hypot(P.x - pd.d.door[0], P.z - pd.d.door[1]); pd.m.material.emissiveIntensity = 0.45 + Math.sin(V.t * 4) * 0.2; if (dd < 3) near = pd.d; }
    if (near !== V.near) { V.near = near; V.prompt.classList.toggle('on', !!near); if (near) { V.prompt.innerHTML = `<kbd>E</kbd> Entrer : <b style="color:${near.col}">${near.name}</b>`; Au.ui('hover'); } }
    if (near && V.auto === near) { V.auto = null; }
    // animations du décor
    for (const j of V.jets) { j.t = (j.t + dt * 0.6) % 1; const a = j.t * Math.PI * 2 * 3 + j.t * 9, r = 0.4 + j.t * 2.6; j.m.position.set(Math.cos(a) * r, 3 + j.t * 2.4 - j.t * j.t * 4.2, Math.sin(a) * r); }
    for (const b of V.balloons) b.m.position.set(b.x, 9 + Math.sin(V.t * 0.8 + b.ph) * 0.8, b.z);
    for (const f of V.flags) f.rotation.y = Math.sin(V.t * 3 + f.position.x) * 0.4;
    for (const m of V.flick) m.emissiveIntensity = Math.random() < 0.02 ? 0.1 : 0.9;
    for (const b of V.beacons) b.rotation.y += dt;
    for (const R of (V.remote || new Map()).values()) { const g = R.av.group, t = R.tgt, kk = 1 - Math.exp(-dt * 10), ox = g.position.x, oz = g.position.z; if (Math.hypot(t.x - ox, t.z - oz) > 12) g.position.set(t.x, t.y, t.z); else { g.position.x += (t.x - ox) * kk; g.position.y += (t.y - g.position.y) * kk; g.position.z += (t.z - oz) * kk; } g.rotation.y += BR.angDiff(g.rotation.y, t.r) * kk; const mv = Math.hypot(g.position.x - ox, g.position.z - oz) / Math.max(dt, 1e-3); R.av.update(dt, Math.min(mv, 9), { air: /^Jump/.test(t.a) }); }
    if (BR.VNet) BR.VNet.move(P.x, P.y, P.z, V.face, P.y > 0.05 ? 'Jump_Idle' : moving ? (sp > 8 ? 'Running_B' : 'Running_A') : 'Idle');
    // présence / panneau
    if ((V.presT -= dt) <= 0) { V.presT = 6; const N = BR.Net; if (N && N.status === 'on') N.send({ t: 'presence' }); paintBoard(); }
    // caméra
    const cx = P.x + Math.sin(V.yaw) * Math.cos(V.pitch) * V.dist, cz = P.z + Math.cos(V.yaw) * Math.cos(V.pitch) * V.dist, cy = P.y + 1.6 + Math.sin(V.pitch) * V.dist;
    V.cam.position.set(cx, cy, cz); V.cam.lookAt(P.x, P.y + 1.5, P.z);
    V.sun.position.set(P.x - 40, 80, P.z + 30); V.sun.target.position.set(P.x, 0, P.z);
    V.R.render(V.scene, V.cam);
  }
  // présence par jeu (réponse du serveur)
  if (BR.Net && BR.Net.on) BR.Net.on('presence', m => { if (V) { V.pres = m.p || {}; paintBoard(); } });
})();

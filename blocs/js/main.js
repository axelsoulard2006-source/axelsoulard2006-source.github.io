/* ===== main.js : boucle de jeu, contrôles, minage, pose, objets au sol, faim, portails, fours, sauvegarde ===== */
(function () {
  const VX = window.VX, B = VX.B, I = VX.I, D = VX.BLOCKS;
  const SAVE_KEY = 'blocaria_save_v1', SET_KEY = 'blocaria_set_v1';
  const canvas = document.getElementById('gl');
  const R3 = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  R3.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400);
  const resize = () => { R3.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); };
  window.addEventListener('resize', resize); resize();
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x101010 }));
  outline.visible = false; scene.add(outline);
  // étoiles (surface, la nuit)
  const stars = (() => { const g = new THREE.BufferGeometry(), p = [], r = VX.rng(5); for (let i = 0; i < 500; i++) { const a = r() * 6.283, e = r() * 1.3 + 0.1, d = 300; p.push(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d); } g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true })); })();
  scene.add(stars);
  const sunM = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false })); scene.add(sunM);

  const G = VX.G = {
    inv: Array(36).fill(null), sel: 0, cursor: null, craft2: Array(4).fill(null), craft3: Array(9).fill(null),
    mode: 'survie', R: 4, seed: 0, dim: 'surface', mods: { surface: {}, braises: {} }, worlds: {}, furnaces: {}, links: {}, items: [], time: 0.28,
    player: new VX.Player(), spawn: null, world: null,
  };
  try { const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}'); if (s.R) G.R = s.R; } catch (e) {}
  G.saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify({ R: G.R })); } catch (e) {} };
  G.dimName = () => G.dim === 'braises' ? 'Les Braises' : 'La Surface';

  /* ---------- sons (petit synthé) ---------- */
  let AC = null;
  G.sfx = function (k) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, g = AC.createGain(); g.connect(AC.destination);
      const tone = (f, f2, dur, type, vol) => { const o = AC.createOscillator(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur); const gg = AC.createGain(); gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(gg); gg.connect(g); o.start(t); o.stop(t + dur); };
      const noise = (dur, vol, freq) => { const n = AC.createBufferSource(), b = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); n.buffer = b; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const gg = AC.createGain(); gg.gain.value = vol; n.connect(f); f.connect(gg); gg.connect(g); n.start(t); };
      if (k === 'dig') noise(0.08, 0.15, 900); else if (k === 'break') noise(0.18, 0.25, 1400); else if (k === 'place') noise(0.1, 0.25, 500);
      else if (k === 'pop') tone(500, 900, 0.08, 'sine', 0.12); else if (k === 'craft') tone(700, 1100, 0.07, 'triangle', 0.1);
      else if (k === 'eat') noise(0.25, 0.2, 2200); else if (k === 'hurt') tone(240, 120, 0.2, 'sawtooth', 0.12);
      else if (k === 'portal') { tone(120, 480, 1.2, 'sine', 0.1); tone(180, 60, 1.2, 'triangle', 0.08); } else if (k === 'fizz') noise(0.4, 0.15, 3000);
    } catch (e) {}
  };

  /* ---------- inventaire ---------- */
  G.giveRange = function (st, a, b) {
    st = Object.assign({}, st); const max = VX.stackOf(st.id);
    if (st.d == null) for (let i = a; i < b && st.n > 0; i++) { const s = G.inv[i]; if (s && s.id === st.id && s.d == null && s.n < max) { const m = Math.min(st.n, max - s.n); s.n += m; st.n -= m; } }
    for (let i = a; i < b && st.n > 0; i++) if (!G.inv[i]) { const m = Math.min(st.n, max); G.inv[i] = { id: st.id, n: m, d: st.d }; st.n -= m; }
    return st.n > 0 ? st : null;
  };
  G.canGive = (id, n) => { let room = 0; const max = VX.stackOf(id); for (const s of G.inv) { if (!s) room += max; else if (s.id === id && s.d == null) room += max - s.n; } return room >= n; };
  G.give = function (id, n, d) { const left = G.giveRange({ id, n, d: d != null ? d : VX.duraOf(id) || undefined }, 0, 36); if (left) dropItem(left.id, left.n, G.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), null, left.d); UI.hud(); return !left; };
  const UI = VX.UI;

  /* ---------- mondes et dimensions ---------- */
  const SKY = { surface: { day: new THREE.Color('#8fd0ff'), night: new THREE.Color('#0b1030') }, braises: new THREE.Color('#3a1838') };
  function useWorld(dim) {
    if (G.world) { scene.remove(G.world.group); G.world.unloadAll(); }
    G.dim = dim; G.world = new VX.World(G.seed, dim, G.mods[dim] = G.mods[dim] || {}); scene.add(G.world.group);
    for (const it of G.items) if (it.sprite) it.sprite.visible = it.dim === dim;
    stars.visible = sunM.visible = dim === 'surface';
    scene.fog = new THREE.Fog(0x000000, 10, 100);
  }
  function preload() { const p = G.player.pos; for (let k = 0; k < 40; k++) if (!G.world.update(p.x, p.z, Math.min(2, G.R), { gen: 30, mesh: 30 })) break; }

  /* ---------- objets au sol ---------- */
  function dropItem(id, n, pos, vel, d) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: VX.iconTex(id), transparent: true, alphaTest: 0.3 })); sp.scale.set(0.42, 0.42, 1); sp.position.copy(pos); scene.add(sp);
    G.items.push({ id, n, d, pos: pos.clone(), vel: vel || new THREE.Vector3((Math.random() - 0.5) * 2.5, 3.5, (Math.random() - 0.5) * 2.5), age: 0, sprite: sp, dim: G.dim, pick: vel ? 1.2 : 0.35 });
  }
  function itemsTick(dt) {
    const P = G.player, w = G.world;
    for (let i = G.items.length - 1; i >= 0; i--) {
      const it = G.items[i]; if (it.dim !== G.dim) continue; it.age += dt;
      if (it.age > 300) { scene.remove(it.sprite); G.items.splice(i, 1); continue; }
      it.vel.y -= 18 * dt; it.vel.x *= 1 - dt * 2; it.vel.z *= 1 - dt * 2;
      const nx = it.pos.x + it.vel.x * dt, nz = it.pos.z + it.vel.z * dt, ny = it.pos.y + it.vel.y * dt;
      const sol = (x, y, z) => { const b = D[w.get(Math.floor(x), Math.floor(y), Math.floor(z))]; return b && b.solid; };
      if (!sol(nx, it.pos.y, it.pos.z)) it.pos.x = nx; else it.vel.x = 0;
      if (!sol(it.pos.x, it.pos.y, nz)) it.pos.z = nz; else it.vel.z = 0;
      if (!sol(it.pos.x, ny - 0.18, it.pos.z)) it.pos.y = ny; else { it.pos.y = Math.floor(ny - 0.18) + 1.18; it.vel.y = 0; }
      it.sprite.position.set(it.pos.x, it.pos.y + Math.sin(it.age * 3) * 0.06, it.pos.z);
      const dx = P.pos.x - it.pos.x, dy = P.pos.y + 0.8 - it.pos.y, dz = P.pos.z - it.pos.z;
      if (it.age > it.pick && dx * dx + dy * dy + dz * dz < 2.6 && G.canGive(it.id, it.n)) { G.giveRange({ id: it.id, n: it.n, d: it.d }, 0, 36); scene.remove(it.sprite); G.items.splice(i, 1); G.sfx('pop'); UI.hud(); }
    }
  }

  /* ---------- minage et pose ---------- */
  const heldTool = () => { const s = G.inv[G.sel]; return s && VX.ITEMS[s.id] && VX.ITEMS[s.id].tool; };
  function canHarvest(b, t) { return b.tier < 0 || (t && t.kind === b.tool && t.tier >= b.tier); }
  function breakTime(id) {
    const b = D[id]; if (!b || b.hard < 0) return Infinity; if (G.mode === 'creatif') return 0;
    const t = heldTool(); let time = b.hard * (canHarvest(b, t) ? 1.5 : 5); if (t && t.kind === b.tool) time /= t.speed;
    if (G.player.inWater) time *= 2.5; if (!G.player.onGround && !G.player.inWater) time *= 1.6;
    return Math.max(0.05, time);
  }
  function wearTool() { const s = G.inv[G.sel]; if (!s || s.d == null || G.mode === 'creatif') return; s.d--; if (s.d <= 0) { G.inv[G.sel] = null; UI.toast('Ton outil s\'est cassé !'); G.sfx('break'); } }
  function blockDrops(b) { if (G.mode === 'creatif') return; if (!canHarvest(b, heldTool())) return; const r = Math.random; let dr = typeof b.drop === 'function' ? b.drop(r) : b.drop != null ? [b.drop, 1] : null; return dr; }
  function removePortalAround(x, y, z) {
    const w = G.world, todo = [[x, y, z]], seen = new Set();
    while (todo.length) { const [a, b2, c] = todo.pop(); const k = a + ',' + b2 + ',' + c; if (seen.has(k) || seen.size > 600) continue; seen.add(k); if (w.getG(a, b2, c) !== B.PORTAIL) continue; w.set(a, b2, c, B.AIR); todo.push([a + 1, b2, c], [a - 1, b2, c], [a, b2 + 1, c], [a, b2 - 1, c], [a, b2, c + 1], [a, b2, c - 1]); }
  }
  function breakBlock(t) {
    const w = G.world, b = D[t.id]; w.set(t.x, t.y, t.z, B.AIR); G.sfx('break');
    const dr = blockDrops(b); if (dr) dropItem(dr[0], dr[1], new THREE.Vector3(t.x + 0.5, t.y + 0.5, t.z + 0.5));
    if (t.id === B.FOUR) { const k = fKey(t.x, t.y, t.z), f = G.furnaces[k]; if (f) { for (const s of [f.in, f.fuel, f.out]) if (s) dropItem(s.id, s.n, new THREE.Vector3(t.x + 0.5, t.y + 0.5, t.z + 0.5)); delete G.furnaces[k]; } }
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const id = w.getG(t.x + dx, t.y + dy, t.z + dz); if (id === B.PORTAIL) removePortalAround(t.x + dx, t.y + dy, t.z + dz); if (id === B.TORCHE && dy === 1) { w.set(t.x, t.y + 1, t.z, B.AIR); if (G.mode !== 'creatif') dropItem(B.TORCHE, 1, new THREE.Vector3(t.x + 0.5, t.y + 1.5, t.z + 0.5)); } }
    if (b.hard > 0) wearTool(); G.player.exh += 0.005; UI.hud();
  }
  const fKey = (x, y, z) => G.dim + ':' + x + ',' + y + ',' + z;
  function intersectsPlayer(x, y, z) { const p = G.player.pos; return x + 1 > p.x - 0.3 && x < p.x + 0.3 && z + 1 > p.z - 0.3 && z < p.z + 0.3 && y + 1 > p.y && y < p.y + 1.8; }
  function useItem() {
    const w = G.world, t = target, st = G.inv[G.sel], P = G.player;
    if (t && !P.sneak) {
      if (t.id === B.ETABLI) { UI.openInv({ kind: 'table' }); return; }
      if (t.id === B.FOUR) { const k = fKey(t.x, t.y, t.z); const f = G.furnaces[k] = G.furnaces[k] || { in: null, fuel: null, out: null, burn: 0, burnMax: 0, prog: 0 }; UI.openInv({ kind: 'four', furnace: f }); return; }
    }
    if (!st) return;
    const itd = VX.ITEMS[st.id];
    if (itd && itd.food) { if (P.food < 20 || G.mode === 'creatif') { P.food = Math.min(20, P.food + itd.food); P.sat = Math.min(P.food, P.sat + itd.food * 0.6); if (G.mode !== 'creatif') { st.n--; if (st.n <= 0) G.inv[G.sel] = null; } G.sfx('eat'); UI.hud(); } return; }
    if (!t) return;
    if (st.id === I.ALLUMEUR) { if (lightPortal(t.x + t.nx, t.y + t.ny, t.z + t.nz)) { G.sfx('portal'); wearTool(); UI.toast('Le portail s\'allume !'); } else UI.toast('Il faut un cadre d\'obsidienne fermé (intérieur 2×3 minimum).'); UI.hud(); return; }
    if (!VX.isBlock(st.id)) return;
    const x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz, cur = D[w.getG(x, y, z)];
    if (y < 0 || y >= VX.H || (cur && cur.id !== B.AIR && !cur.liquid)) return;
    const nb = D[st.id]; if (nb.solid && intersectsPlayer(x, y, z)) return;
    if (st.id === B.TORCHE && !(D[w.getG(x, y - 1, z)] || {}).solid) return;
    w.set(x, y, z, st.id); G.sfx('place');
    if (G.mode !== 'creatif') { st.n--; if (st.n <= 0) G.inv[G.sel] = null; }
    UI.hud();
  }
  // cadre d'obsidienne : on cherche un rectangle fermé autour de la case et on le remplit de portail
  function lightPortal(x, y, z) {
    const w = G.world, O = B.OBSIDIENNE, at = (a, b2, c) => w.getG(a, b2, c);
    if (at(x, y, z) !== B.AIR) return false;
    for (const ax of [[1, 0], [0, 1]]) {
      let by = y; while (by > 0 && at(x, by - 1, z) === B.AIR && y - by < 21) by--; if (at(x, by - 1, z) !== O) continue;
      let l = 0; while (l < 21 && at(x - ax[0] * (l + 1), by, z - ax[1] * (l + 1)) === B.AIR) l++;
      const x0 = x - ax[0] * l, z0 = z - ax[1] * l; if (at(x0 - ax[0], by, z0 - ax[1]) !== O) continue;
      let wd = 1; while (wd < 22 && at(x0 + ax[0] * wd, by, z0 + ax[1] * wd) === B.AIR) wd++; if (at(x0 + ax[0] * wd, by, z0 + ax[1] * wd) !== O || wd < 2) continue;
      let h = 1; while (h < 22 && at(x0, by + h, z0) === B.AIR) h++; if (h < 3) continue;
      let good = true;
      for (let i = 0; i < wd && good; i++) { if (at(x0 + ax[0] * i, by - 1, z0 + ax[1] * i) !== O || at(x0 + ax[0] * i, by + h, z0 + ax[1] * i) !== O) good = false; for (let j = 0; j < h && good; j++) if (at(x0 + ax[0] * i, by + j, z0 + ax[1] * i) !== B.AIR) good = false; }
      for (let j = 0; j < h && good; j++) if (at(x0 - ax[0], by + j, z0 - ax[1]) !== O || at(x0 + ax[0] * wd, by + j, z0 + ax[1] * wd) !== O) good = false;
      if (!good) continue;
      for (let i = 0; i < wd; i++) for (let j = 0; j < h; j++) w.set(x0 + ax[0] * i, by + j, z0 + ax[1] * i, B.PORTAIL);
      return true;
    }
    return false;
  }
  function travel() {
    const P = G.player, from = G.dim, to = from === 'surface' ? 'braises' : 'surface';
    const lk = from + ':' + Math.floor(P.pos.x / 8) + ',' + Math.floor(P.pos.z / 8), link = G.links[lk];
    useWorld(to);
    let dest;
    if (link) dest = { x: link.x, y: link.y, z: link.z };
    else {
      const s = G.world.findSpawn(Math.floor(P.pos.x), Math.floor(P.pos.z)), bx = Math.floor(s.x) - 1, by = Math.floor(s.y), bz = Math.floor(s.z), w = G.world;
      for (let i = -1; i <= 2; i++) for (let j = -1; j <= 3; j++) w.set(bx + i, by + j, bz, (i === -1 || i === 2 || j === -1 || j === 3) ? B.OBSIDIENNE : B.PORTAIL);
      for (let i = -1; i <= 2; i++) for (let j = 0; j <= 2; j++) for (const dz of [1, 2]) { w.set(bx + i, by + j, bz + dz, B.AIR); if (!(D[w.getG(bx + i, by - 1, bz + dz)] || {}).solid) w.set(bx + i, by - 1, bz + dz, to === 'braises' ? B.CENDRITE : B.GALETS); }
      dest = { x: bx + 1, y: by, z: bz + 1.6 };
      G.links[lk] = { x: dest.x, y: dest.y, z: dest.z }; G.links[to + ':' + Math.floor(dest.x / 8) + ',' + Math.floor(dest.z / 8)] = { x: P.pos.x, y: P.pos.y, z: P.pos.z + 1.6 };
    }
    P.pos.set(dest.x, dest.y, dest.z); P.vel.set(0, 0, 0); P.yaw = 0; P.fallTop = null;
    preload(); G.portalCd = 4; G.portalT = 0; UI.toast('Bienvenue dans ' + G.dimName()); G.save(true);
  }

  /* ---------- entrées ---------- */
  const keys = {}; let locked = false, mining = false, mineT = 0, mineKey = '', lastSpace = 0, useCd = 0, breakCd = 0;
  let target = null;
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (!locked && !UI.open && !UI.menuOpen && G.player.hp > 0) UI.menu('pause'); });
  canvas.addEventListener('mousedown', e => {
    if (!locked) { if (!UI.open && !UI.menuOpen) canvas.requestPointerLock(); return; }
    if (e.button === 0) mining = true; else if (e.button === 2) { useItem(); useCd = 0.25; G.rmb = true; }
  });
  document.addEventListener('mouseup', e => { if (e.button === 0) { mining = false; mineT = 0; UI.mining(0); } if (e.button === 2) G.rmb = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('mousemove', e => { if (!locked) return; const P = G.player; P.yaw -= e.movementX * 0.0024; P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - e.movementY * 0.0024)); });
  document.addEventListener('wheel', e => { if (!locked) return; G.sel = (G.sel + (e.deltaY > 0 ? 1 : 8)) % 9; UI.hud(); });
  document.addEventListener('keydown', e => {
    if (UI.menuOpen) return;
    if (e.code === 'KeyE' || (e.code === 'Escape' && UI.open)) { e.preventDefault(); if (UI.open) { UI.closeInv(); canvas.requestPointerLock(); } else if (locked) UI.openInv({ kind: 'inv' }); return; }
    if (UI.open) return;
    keys[e.code] = true;
    if (/^Digit[1-9]$/.test(e.code)) { G.sel = +e.code.slice(5) - 1; UI.hud(); }
    if (e.code === 'Space') { e.preventDefault(); const now = performance.now(); if (G.mode === 'creatif' && now - lastSpace < 300) { G.player.fly = !G.player.fly; UI.toast(G.player.fly ? 'Vol activé' : 'Vol désactivé'); } lastSpace = now; }
    if (e.code === 'KeyQ') { const s = G.inv[G.sel]; if (s) { const P = G.player, d = new THREE.Vector3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)); const n = e.ctrlKey ? s.n : 1; dropItem(s.id, n, new THREE.Vector3(P.pos.x, P.eye - 0.3, P.pos.z), d.multiplyScalar(6).add(new THREE.Vector3(0, 1.5, 0)), s.d); s.n -= n; if (s.n <= 0) G.inv[G.sel] = null; UI.hud(); } }
    if (e.code === 'KeyG') setMode(G.mode === 'creatif' ? 'survie' : 'creatif');
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });
  function setMode(m) { G.mode = m; if (m === 'survie') G.player.fly = false; else { G.player.hp = 20; G.player.food = 20; } UI.toast(m === 'creatif' ? 'Mode créatif : blocs infinis, vol (Espace ×2), casse instantanée' : 'Mode survie'); UI.hud(); if (UI.menuOpen === 'pause') UI.menu('pause'); }

  G.menuAction = function (a) {
    if (a === 'play') { UI.menu(null); canvas.requestPointerLock(); }
    else if (a === 'respawn') { const P = G.player; P.hp = 20; P.food = 20; P.sat = 5; if (G.dim !== 'surface') useWorld('surface'); P.pos.set(G.spawn.x, G.spawn.y + 0.2, G.spawn.z); P.vel.set(0, 0, 0); P.fallTop = null; preload(); UI.menu(null); UI.hud(); canvas.requestPointerLock(); }
    else if (a === 'mode') setMode(G.mode === 'creatif' ? 'survie' : 'creatif');
    else if (a === 'save') { G.save(); }
    else if (a === 'export') { G.save(true); const blob = new Blob([localStorage.getItem(SAVE_KEY) || JSON.stringify(state())], { type: 'application/json' }), u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'blocaria-monde-' + G.seed + '.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
    else if (a === 'import') { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.onchange = () => { const file = f.files[0]; if (!file) return; file.text().then(t => { try { const j = JSON.parse(t); if (!j || j.v !== 1 || !j.seed) throw new Error('fichier'); localStorage.setItem(SAVE_KEY, t); location.reload(); } catch (e) { UI.toast('Fichier de monde invalide.'); } }); }; f.click(); }
    else if (a === 'new') { const s = prompt('Graine du nouveau monde (laisse vide pour du hasard). Ton monde actuel sera remplacé — exporte-le avant si tu veux le garder.', ''); if (s === null) return; localStorage.removeItem(SAVE_KEY); localStorage.setItem('blocaria_newseed', s.trim()); location.reload(); }
    else if (a === 'quit') { G.save(true); location.href = '../index.html'; }
  };

  /* ---------- sauvegarde ---------- */
  function state() {
    const P = G.player, r = v => Math.round(v * 100) / 100;
    return { v: 1, seed: G.seed, dim: G.dim, mode: G.mode, time: r(G.time), spawn: G.spawn, player: { x: r(P.pos.x), y: r(P.pos.y), z: r(P.pos.z), yaw: r(P.yaw), pitch: r(P.pitch), hp: P.hp, food: P.food, sat: r(P.sat), fly: P.fly }, inv: G.inv, sel: G.sel, mods: G.mods, furnaces: G.furnaces, links: G.links };
  }
  G.save = function (quiet) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state())); if (!quiet) UI.toast('Monde sauvegardé ✔'); }
    catch (e) { UI.toast('Sauvegarde impossible (monde trop gros) : utilise « Exporter le monde ».'); }
  };
  function load() {
    let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
    if (s && s.v === 1) {
      G.seed = s.seed; G.mode = s.mode || 'survie'; G.time = s.time || 0.3; G.mods = s.mods || { surface: {}, braises: {} }; G.furnaces = s.furnaces || {}; G.links = s.links || {};
      G.inv = (s.inv || []).concat(Array(36).fill(null)).slice(0, 36); G.sel = s.sel || 0; G.spawn = s.spawn;
      useWorld(s.dim || 'surface'); const P = G.player, p = s.player || {}; P.pos.set(p.x || 0.5, p.y || 40, p.z || 0.5); P.yaw = p.yaw || 0; P.pitch = p.pitch || 0; P.hp = p.hp || 20; P.food = p.food != null ? p.food : 20; P.sat = p.sat || 5; P.fly = !!p.fly && G.mode === 'creatif';
      if (!G.spawn) G.spawn = { x: 0.5, y: 40, z: 0.5 };
      return true;
    }
    let seedTxt = ''; try { seedTxt = localStorage.getItem('blocaria_newseed') || ''; localStorage.removeItem('blocaria_newseed'); } catch (e) {}
    G.seed = seedTxt ? (/^-?\d+$/.test(seedTxt) ? +seedTxt : [...seedTxt].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)) : (Math.random() * 2e9) | 0;
    useWorld('surface'); G.spawn = G.world.findSpawn(0, 0); G.player.pos.set(G.spawn.x, G.spawn.y, G.spawn.z);
    return false;
  }

  /* ---------- boucle ---------- */
  const dirV = new THREE.Vector3(), eyeV = new THREE.Vector3();
  let last = performance.now(), saveT = 0, regenT = 0, starveT = 0, lavaT = 0, uiT = 0;
  function hurt(n) { const P = G.player; if (G.mode === 'creatif' || n <= 0) return; P.hp = Math.max(0, P.hp - n); P.hurtT = 0.4; G.sfx('hurt'); UI.hud(); if (P.hp <= 0) { UI.closeInv(); UI.menu('mort'); } }
  function frame(now) { requestAnimationFrame(frame); tick(now); }
  function tick(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.wantTravel) { G.wantTravel = false; travel(); }
    const P = G.player, w = G.world, paused = !!UI.menuOpen;
    if (!paused) {
      const inp = locked && !UI.open ? { f: keys.KeyW, b: keys.KeyS, l: keys.KeyA, r: keys.KeyD, jump: keys.Space, sneak: keys.ShiftLeft || keys.ShiftRight, sprint: keys.ControlLeft || keys.ControlRight } : {};
      const fall = P.step(w, inp, dt, G.mode === 'creatif'); if (fall) hurt(fall);
      // faim et vie
      if (G.mode === 'survie') {
        P.exh += dt * 0.04;
        while (P.exh >= 4) { P.exh -= 4; if (P.sat > 0) P.sat = Math.max(0, P.sat - 1); else if (P.food > 0) { P.food--; UI.hud(); } }
        if (P.food >= 18 && P.hp < 20) { regenT += dt; if (regenT > 3) { regenT = 0; P.hp++; P.exh += 1.5; UI.hud(); } } else regenT = 0;
        if (P.food <= 0) { starveT += dt; if (starveT > 4) { starveT = 0; if (P.hp > 1) hurt(1); } }
        if (P.inLava) { lavaT += dt; if (lavaT > 0.5) { lavaT = 0; hurt(2); } } else lavaT = 0;
      }
      // portail
      G.portalCd = Math.max(0, (G.portalCd || 0) - dt);
      if (P.inPortal && G.portalCd <= 0) { G.portalT = (G.portalT || 0) + dt; if (G.portalT > 2.2) G.wantTravel = true; } else G.portalT = Math.max(0, (G.portalT || 0) - dt * 2);
      // fours (tous, même loin)
      for (const k in G.furnaces) if (VX.furnaceTick(G.furnaces[k], dt) && UI.open && UI.open.furnace === G.furnaces[k]) UI.refresh();
      if (UI.open && UI.open.kind === 'four' && (uiT += dt) > 0.25) { uiT = 0; UI.refresh(); }
      itemsTick(dt);
      // visée, minage
      eyeV.set(P.pos.x, P.eye, P.pos.z); dirV.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
      target = locked ? w.raycast(eyeV, dirV, G.mode === 'creatif' ? 6 : 5) : null;
      if (target) { outline.visible = true; outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5); } else outline.visible = false;
      breakCd -= dt; useCd -= dt;
      if (G.rmb && useCd <= 0 && locked) { useItem(); useCd = 0.25; }
      if (mining && target && breakCd <= 0) {
        const k = target.x + ',' + target.y + ',' + target.z; if (k !== mineKey) { mineKey = k; mineT = 0; }
        const bt = breakTime(target.id);
        if (bt === 0) { breakBlock(target); breakCd = 0.2; mineT = 0; UI.mining(0); }
        else if (isFinite(bt)) { mineT += dt; if (Math.floor((mineT - dt) * 4) !== Math.floor(mineT * 4)) G.sfx('dig'); UI.mining(mineT / bt); if (mineT >= bt) { breakBlock(target); mineT = 0; mineKey = ''; UI.mining(0); breakCd = 0.15; } }
      } else if (!mining || !target) { if (mineT) { mineT = 0; UI.mining(0); } }
      // jour / nuit
      if (G.dim === 'surface') G.time = (G.time + dt / 1200) % 1;
      saveT += dt; if (saveT > 30) { saveT = 0; G.save(true); }
      P.hurtT = Math.max(0, P.hurtT - dt);
    }
    // monde autour du joueur
    w.update(P.pos.x, P.pos.z, G.R, { gen: 2, mesh: 2 });
    // ciel, lumière, brouillard
    let sky, light;
    if (G.dim === 'surface') {
      const s = Math.sin(G.time * Math.PI * 2), k = Math.max(0, Math.min(1, s * 2.2 + 0.45)); light = 0.22 + 0.78 * k;
      sky = SKY.surface.night.clone().lerp(SKY.surface.day, k); stars.material.opacity = 1 - k;
      const ang = G.time * Math.PI * 2; sunM.position.set(P.pos.x + Math.cos(ang) * 250, Math.sin(ang) * 250, P.pos.z + 40); sunM.lookAt(P.pos.x, P.eye, P.pos.z);
      sunM.material.color.set(s > 0 ? 0xfff3b0 : 0xdde6ff);
      w.matO.color.setScalar(light); w.matT.color.setScalar(Math.max(0.35, light));
    } else { light = 0.9; sky = SKY.braises; w.matO.color.setRGB(1, 0.9, 0.92); w.matT.color.setRGB(1, 0.92, 0.95); }
    const under = P.eyeWater;
    scene.background = under === 1 ? new THREE.Color('#1c3f8a') : under === 2 ? new THREE.Color('#c84a10') : sky;
    scene.fog.color.copy(scene.background); scene.fog.near = under ? 1 : G.dim === 'braises' ? 8 : G.R * 16 * 0.55; scene.fog.far = under ? (under === 2 ? 3 : 14) : G.dim === 'braises' ? G.R * 16 * 0.75 : G.R * 16 * 0.95;
    camera.position.set(P.pos.x, P.eye, P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    camera.fov += ((P.sprint ? 84 : 75) - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
    UI.fx(under, P.hurtT > 0 ? P.hurtT * 1.5 : 0, Math.min(1, (G.portalT || 0) / 2.2));
    if ((G.infoT = (G.infoT || 0) - dt) <= 0) { G.infoT = 0.25; UI.info(`${G.dimName()} · X ${Math.floor(P.pos.x)}  Y ${Math.floor(P.pos.y)}  Z ${Math.floor(P.pos.z)} · ${G.mode === 'creatif' ? 'Créatif' + (P.fly ? ' (vol)' : '') : 'Survie'}`); }
    R3.render(scene, camera);
  }

  G._dbg = { breakBlock: t => breakBlock(t), useItem: () => useItem(), lightPortal, travel, setTarget: t => { target = t; }, dropItem, useWorld, tick: dt => tick(last + dt * 1000) };   // tests
  /* ---------- démarrage ---------- */
  UI.init(G);
  const had = load();
  preload();
  if (!had) UI.menu('aide'); else UI.menu('pause');
  UI.hud();
  window.addEventListener('beforeunload', () => G.save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(true); });
  document.getElementById('boot').remove();
  requestAnimationFrame(frame);
})();

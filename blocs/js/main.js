/* ===== main.js : boucle de jeu, contrôles, minage, pose, objets au sol, faim, oxygène, armure, portails, fours, coffres, chat, sauvegarde ===== */
(function () {
  const VX = window.VX, B = VX.B, I = VX.I, D = VX.BLOCKS;
  const SAVE_KEY = 'blocaria_save_v1', SET_KEY = 'blocaria_set_v1';
  const R = VX.R, canvas = R.gl.domElement, scene = R.scene, camera = R.camera, outline = R.outline;
  const H = VX.hooks;
  const COFFRE = () => (B.COFFRE != null ? B.COFFRE : 40);   // le bloc coffre est déclaré par registry.js (id 40)
  const AIR_MAX = VX.AIR_MAX = 15;                            // secondes d'oxygène sous l'eau (10 bulles)

  const G = VX.G = {
    inv: Array(36).fill(null), sel: 0, cursor: null, craft2: Array(4).fill(null), craft3: Array(9).fill(null),
    armor: [null, null, null, null],   // casque, plastron, jambières, bottes
    offhand: null,                      // main secondaire (bouclier, torches…) : même format qu'une case d'inventaire
    mode: 'survie', R: 4, seed: 0, dim: 'surface', mods: { surface: {}, braises: {} }, worlds: {}, furnaces: {}, chests: {}, links: {}, items: [], time: 0.28,
    known: {},                          // objets déjà possédés (livre de recettes)
    player: new VX.Player(), spawn: null, world: null, mine: null,
  };
  try { const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}'); if (s.R) G.R = s.R; VX.fastMesh = !!s.fast; } catch (e) {}
  G.saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify({ R: G.R, fast: !!VX.fastMesh })); } catch (e) {} };
  G.dimName = () => G.dim === 'braises' ? 'Les Braises' : 'La Surface';

  /* ---------- sons : remplacés par audio.js (même signature : G.sfx(nom, options)) ---------- */
  G.sfx = function () {};

  /* ---------- inventaire ---------- */
  G.giveRange = function (st, a, b) {
    st = Object.assign({}, st); const max = VX.stackOf(st.id);
    if (st.d == null) for (let i = a; i < b && st.n > 0; i++) { const s = G.inv[i]; if (s && s.id === st.id && s.d == null && s.n < max) { const m = Math.min(st.n, max - s.n); s.n += m; st.n -= m; } }
    for (let i = a; i < b && st.n > 0; i++) if (!G.inv[i]) { const m = Math.min(st.n, max); G.inv[i] = { id: st.id, n: m, d: st.d }; st.n -= m; }
    G.known[st.id] = 1;
    return st.n > 0 ? st : null;
  };
  G.canGive = (id, n) => { let room = 0; const max = VX.stackOf(id); for (const s of G.inv) { if (!s) room += max; else if (s.id === id && s.d == null) room += max - s.n; } return room >= n; };
  G.give = function (id, n, d) { const left = G.giveRange({ id, n, d: d != null ? d : VX.duraOf(id) || undefined }, 0, 36); if (left) dropItem(left.id, left.n, G.player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), null, left.d); UI.hud(); return !left; };
  const UI = VX.UI;

  /* ---------- mondes et dimensions ---------- */
  function useWorld(dim) {
    if (G.world) { scene.remove(G.world.group); G.world.unloadAll(); }
    if (G.guest && !G._guestInit) { G._guestInit = true; G.chests = {}; }   // invité : on ne mélange pas ses coffres avec le monde de l'hôte
    G.dim = dim; G.world = new VX.World(G.seed, dim, G.mods[dim] = G.mods[dim] || {}); scene.add(G.world.group);
    for (const it of G.items) if (it.obj) it.obj.visible = it.dim === dim;
  }
  function preload() { const p = G.player.pos; G.world.preload(p.x, p.z, 1); }

  /* ---------- objets au sol (petits blocs 3D ou objets en relief, qui tournent et flottent) ---------- */
  function itemObj(id, n) {
    if (VX.FX && VX.FX.itemObj) return VX.FX.itemObj(id, n);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: VX.iconTex(id), transparent: true, alphaTest: 0.3 })); sp.scale.set(0.42, 0.42, 1); return sp;
  }
  function dropItem(id, n, pos, vel, d) {
    const obj = itemObj(id, n); obj.position.copy(pos); obj.scale.setScalar(0.01); scene.add(obj);
    G.items.push({ id, n, d, pos: pos.clone(), vel: vel || new THREE.Vector3((Math.random() - 0.5) * 2.5, 3.5, (Math.random() - 0.5) * 2.5), age: 0, obj, rot: Math.random() * 6.28, dim: G.dim, pick: vel ? 1.2 : 0.35 });
  }
  const backOut = t => { const c = 2.2; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; };   // « pop » d'apparition
  function itemsTick(dt) {
    const P = G.player, w = G.world;
    const sol = (x, y, z) => { const b = D[w.get(Math.floor(x), Math.floor(y), Math.floor(z))]; return b && b.solid; };
    for (let i = G.items.length - 1; i >= 0; i--) {
      const it = G.items[i]; if (it.dim !== G.dim) continue; it.age += dt;
      if (it.age > 300) { scene.remove(it.obj); G.items.splice(i, 1); continue; }
      it.vel.y -= 18 * dt; it.vel.x *= 1 - dt * 2; it.vel.z *= 1 - dt * 2;
      const nx = it.pos.x + it.vel.x * dt, nz = it.pos.z + it.vel.z * dt, ny = it.pos.y + it.vel.y * dt;
      if (!sol(nx, it.pos.y, it.pos.z)) it.pos.x = nx; else it.vel.x = 0;
      if (!sol(it.pos.x, it.pos.y, nz)) it.pos.z = nz; else it.vel.z = 0;
      if (!sol(it.pos.x, ny - 0.18, it.pos.z)) it.pos.y = ny; else { it.pos.y = Math.floor(ny - 0.18) + 1.18; it.vel.y = 0; }
      it.obj.position.set(it.pos.x, it.pos.y - 0.04 + Math.sin(it.age * 2.6 + it.rot) * 0.07, it.pos.z);
      it.obj.rotation.y = it.rot + it.age * 1.7;
      it.obj.scale.setScalar(it.age < 0.32 ? Math.max(0.01, backOut(it.age / 0.32)) : 1);
      const dx = P.pos.x - it.pos.x, dy = P.pos.y + 0.8 - it.pos.y, dz = P.pos.z - it.pos.z;
      if (it.age > it.pick && P.hp > 0 && dx * dx + dy * dy + dz * dz < 2.6 && G.canGive(it.id, it.n)) {
        G.giveRange({ id: it.id, n: it.n, d: it.d }, 0, 36); H.emit('itemPickup', { id: it.id, n: it.n });
        if (VX.FX && VX.FX.collect) VX.FX.collect(it.obj); else scene.remove(it.obj);
        G.items.splice(i, 1); G.sfx('pop'); UI.hud();
      }
    }
  }

  /* ---------- minage et pose ---------- */
  const heldTool = () => { const s = G.inv[G.sel]; return s && VX.ITEMS[s.id] && VX.ITEMS[s.id].tool; };
  function canHarvest(b, t) { return b.tier < 0 || (t && t.kind === b.tool && t.tier >= b.tier); }
  function breakTime(id) {
    const b = D[id]; if (!b || b.hard < 0) return Infinity; if (G.mode === 'creatif') return 0;
    const t = heldTool(), ok = canHarvest(b, t);
    // sans le bon outil, un bloc qui en exige un (pierre, minerais…) est très lent et ne donne rien
    let time = b.hard * (ok ? 1.5 : b.tier >= 0 ? 7 : 5); if (t && t.kind === b.tool) time /= t.speed;
    if (G.player.inWater) time *= 2.5; if (!G.player.onGround && !G.player.inWater) time *= 1.6;
    return Math.max(0.05, time);
  }
  function wearTool() { const s = G.inv[G.sel]; if (!s || s.d == null || G.mode === 'creatif') return; s.d--; if (s.d <= 0) { G.inv[G.sel] = null; UI.toast('Ton outil s\'est cassé !'); G.sfx('toolbreak'); } }
  function blockDrops(b) { if (G.mode === 'creatif') return; if (!canHarvest(b, heldTool())) return; const r = Math.random; let dr = typeof b.drop === 'function' ? b.drop(r) : b.drop != null ? [b.drop, 1] : null; return dr; }
  function removePortalAround(x, y, z) {
    const w = G.world, todo = [[x, y, z]], seen = new Set();
    while (todo.length) { const [a, b2, c] = todo.pop(); const k = a + ',' + b2 + ',' + c; if (seen.has(k) || seen.size > 600) continue; seen.add(k); if (w.getG(a, b2, c) !== B.PORTAIL) continue; w.set(a, b2, c, B.AIR); todo.push([a + 1, b2, c], [a - 1, b2, c], [a, b2 + 1, c], [a, b2 - 1, c], [a, b2, c + 1], [a, b2, c - 1]); }
  }
  const fKey = (x, y, z) => G.dim + ':' + x + ',' + y + ',' + z;
  // vide un conteneur (four, coffre) au sol quand son bloc disparaît
  function spillContainer(x, y, z, id) {
    const k = fKey(x, y, z), at = () => new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
    if (id === B.FOUR) { const f = G.furnaces[k]; if (f) { for (const s of [f.in, f.fuel, f.out]) if (s) dropItem(s.id, s.n, at(), null, s.d); delete G.furnaces[k]; } }
    if (id === COFFRE()) { const c = G.chests[k]; if (c) { for (const s of c) if (s) dropItem(s.id, s.n, at(), null, s.d); delete G.chests[k]; if (UI.open && UI.open.chest === c) UI.closeInv(); } }
  }
  // retire un bloc du monde avec tous ses effets (conteneurs, portail, torche posée dessus) — partagé avec les explosions
  function destroyBlock(x, y, z, id, drops) {
    const w = G.world;
    if (id === COFFRE() && VX.ensureChestLoot) VX.ensureChestLoot(x, y, z);   // coffre d'une structure jamais ouvert : son trésor tombe aussi
    w.set(x, y, z, B.AIR);
    if (drops) dropItem(drops[0], drops[1], new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
    spillContainer(x, y, z, id);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const nid = w.getG(x + dx, y + dy, z + dz); if (nid === B.PORTAIL) removePortalAround(x + dx, y + dy, z + dz); if (nid === B.TORCHE && dy === 1) { w.set(x, y + 1, z, B.AIR); if (G.mode !== 'creatif') dropItem(B.TORCHE, 1, new THREE.Vector3(x + 0.5, y + 1.5, z + 0.5)); } }
  }
  // utilisé par les explosions : opts.chance = probabilité de lâcher le bloc (sans condition d'outil)
  G.breakAt = function (x, y, z, opts) {
    const id = G.world.getG(x, y, z), b = D[id]; if (!id || !b) return false;
    let dr = null;
    if (opts && opts.chance && G.mode !== 'creatif' && Math.random() < opts.chance) dr = typeof b.drop === 'function' ? b.drop(Math.random) : b.drop != null ? [b.drop, 1] : null;
    destroyBlock(x, y, z, id, dr); return true;
  };
  function breakBlock(t) {
    if (!H.emit('blockBreak', { x: t.x, y: t.y, z: t.z, id: t.id, dim: G.dim, player: G.player })) return;
    const b = D[t.id];
    destroyBlock(t.x, t.y, t.z, t.id, blockDrops(b));
    G.sfx('break', { id: t.id }); if (VX.FX) VX.FX.blockBreak(t.x, t.y, t.z, t.id);
    if (b.hard > 0) wearTool(); G.player.exh += 0.005; UI.hud();
  }
  function intersectsPlayer(x, y, z) { const p = G.player.pos; return x + 1 > p.x - 0.3 && x < p.x + 0.3 && z + 1 > p.z - 0.3 && z < p.z + 0.3 && y + 1 > p.y && y < p.y + 1.8; }
  function useItem() {
    const w = G.world, t = target, st = G.inv[G.sel], P = G.player;
    if (t && !P.sneak) {
      if (t.id === B.ETABLI) { UI.openInv({ kind: 'table' }); return; }
      if (t.id === B.FOUR) { const k = fKey(t.x, t.y, t.z); const f = G.furnaces[k] = G.furnaces[k] || { in: null, fuel: null, out: null, burn: 0, burnMax: 0, prog: 0 }; UI.openInv({ kind: 'four', furnace: f }); return; }
      if (t.id === COFFRE()) { const k = fKey(t.x, t.y, t.z); const c = G.chests[k] = G.chests[k] || (VX.ensureChestLoot && VX.ensureChestLoot(t.x, t.y, t.z)) || Array(27).fill(null); G.sfx('chest'); UI.openInv({ kind: 'coffre', chest: c }); return; }
    }
    if (!st) return;
    // modules (agriculture, arc, bouclier…) : un écouteur qui renvoie false a consommé l'action
    if (!H.emit('use', { target: t, stack: st, player: P, world: w })) { UI.hud(); return; }
    const itd = VX.ITEMS[st.id];
    if (itd && itd.food) { if (P.food < 20 || G.mode === 'creatif') { P.food = Math.min(20, P.food + itd.food); P.sat = Math.min(P.food, P.sat + itd.food * 0.6); if (G.mode !== 'creatif') { st.n--; if (st.n <= 0) G.inv[G.sel] = null; } G.sfx('eat'); H.emit('swing'); UI.hud(); } return; }
    // armure : clic droit = l'enfiler (échange avec la pièce portée)
    const ar = VX.ARMOR && VX.ARMOR[st.id];
    if (ar) { const old = G.armor[ar.slot]; G.armor[ar.slot] = st; G.inv[G.sel] = old; G.sfx('equip'); H.emit('swing'); UI.hud(); return; }
    if (!t) return;
    if (st.id === I.ALLUMEUR) { H.emit('swing'); if (lightPortal(t.x + t.nx, t.y + t.ny, t.z + t.nz)) { G.sfx('portal'); wearTool(); UI.toast('Le portail s\'allume !'); } else UI.toast('Il faut un cadre d\'obsidienne fermé (intérieur 2×3 minimum).'); UI.hud(); return; }
    if (!VX.isBlock(st.id)) return;
    const x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz, cur = D[w.getG(x, y, z)];
    if (y < 0 || y >= VX.H || (cur && cur.id !== B.AIR && !cur.liquid && !cur.replace)) return;   // on peut poser à la place d'une plante
    const nb = D[st.id]; if (nb.solid && intersectsPlayer(x, y, z)) return;
    if (st.id === B.TORCHE && !(D[w.getG(x, y - 1, z)] || {}).solid) return;
    if (!H.emit('blockPlace', { x, y, z, id: st.id, dim: G.dim, player: P })) return;
    w.set(x, y, z, st.id); G.sfx('place', { id: st.id }); H.emit('swing');
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
    useWorld(to); H.emit('dimensionChange', { from, to });
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
  const keys = {}; let locked = false, mining = false, mineT = 0, mineKey = '', lastSpace = 0, lastW = 0, sprintTap = false, useCd = 0, breakCd = 0, swingCd = 0;
  let target = null;
  // verrouillage de la souris (la promesse peut être refusée hors d'un geste du joueur : on l'ignore)
  function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  G.relock = () => { if (!UI.open && !UI.menuOpen && !UI.chatOpen) lock(); };
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (!locked) { mining = false; sprintTap = false; for (const k in keys) keys[k] = false; } if (!locked && !UI.open && !UI.menuOpen && !UI.chatOpen && G.player.hp > 0) UI.menu('pause'); });
  canvas.addEventListener('mousedown', e => {
    if (!locked) { if (!UI.open && !UI.menuOpen && !UI.chatOpen) lock(); return; }
    if (e.button === 0) { H.emit('swing'); if (!H.emit('attack', { origin: eyeV.clone(), dir: dirV.clone(), reach: 3.5 })) return; mining = true; } else if (e.button === 2) { useItem(); useCd = 0.25; G.rmb = true; }
  });
  document.addEventListener('mouseup', e => { if (e.button === 0) { mining = false; mineT = 0; UI.mining(0); } if (e.button === 2) G.rmb = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('mousemove', e => { if (!locked) return; const P = G.player; P.yaw -= e.movementX * 0.0024; P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - e.movementY * 0.0024)); });
  document.addEventListener('wheel', e => { if (!locked) return; G.sel = (G.sel + (e.deltaY > 0 ? 1 : 8)) % 9; UI.hud(); });
  document.addEventListener('keydown', e => {
    if (UI.menuOpen || UI.chatOpen) return;
    if (e.code === 'KeyE' || (e.code === 'Escape' && UI.open)) { e.preventDefault(); if (UI.open) { UI.closeInv(); lock(); } else if (locked) UI.openInv({ kind: 'inv' }); return; }
    if (UI.open) return;
    // chat : T (ou / pour taper directement une commande)
    if ((e.code === 'KeyT' || e.code === 'Slash' || e.key === '/') && locked) { e.preventDefault(); UI.openChat(e.code === 'KeyT' ? '' : '/'); return; }
    keys[e.code] = true;
    if (/^Digit[1-9]$/.test(e.code)) { G.sel = +e.code.slice(5) - 1; UI.hud(); }
    if (e.code === 'Space') { e.preventDefault(); const now = performance.now(); if (G.mode === 'creatif' && now - lastSpace < 300) { G.player.fly = !G.player.fly; UI.toast(G.player.fly ? 'Vol activé' : 'Vol désactivé'); } lastSpace = now; }
    // sprint : double appui sur Z (touche physique « W » en QWERTY)
    if (e.code === 'KeyW' && !e.repeat) { const now = performance.now(); if (now - lastW < 300) sprintTap = true; lastW = now; }
    // F : échange l'objet tenu et la main secondaire
    if (e.code === 'KeyF' && !e.repeat) { const s = G.inv[G.sel]; G.inv[G.sel] = G.offhand || null; G.offhand = s || null; if (G.offhand || G.inv[G.sel]) G.sfx('equip'); UI.hud(); }
    if (e.code === 'KeyQ') { const s = G.inv[G.sel]; if (s) { const P = G.player, d = new THREE.Vector3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)); const n = e.ctrlKey ? s.n : 1; dropItem(s.id, n, new THREE.Vector3(P.pos.x, P.eye - 0.3, P.pos.z), d.multiplyScalar(6).add(new THREE.Vector3(0, 1.5, 0)), s.d); s.n -= n; if (s.n <= 0) G.inv[G.sel] = null; H.emit('swing'); UI.hud(); } }
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyW') sprintTap = false; });
  function setMode(m) { G.mode = m; if (m === 'survie') G.player.fly = false; else { G.player.hp = 20; G.player.food = 20; G.player.air = AIR_MAX; } UI.toast(m === 'creatif' ? 'Mode créatif : blocs infinis, vol (Espace ×2), casse instantanée' : 'Mode survie'); UI.hud(); if (UI.menuOpen === 'pause') UI.menu('pause'); }
  G.setMode = setMode;

  /* ---------- chat et commandes ---------- */
  G.command = function (txt) {
    txt = String(txt || '').trim(); if (!txt) return;
    if (txt[0] !== '/') { UI.say('<' + (G.pname ? G.pname() : 'Toi') + '> ' + txt); H.emit('chat', { text: txt }); return; }
    const [cmd, ...args] = txt.slice(1).split(/\s+/), a = (args[0] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (cmd === 'mode') {
      const m = a === 'survie' || a === 's' ? 'survie' : a === 'creatif' || a === 'c' ? 'creatif' : null;
      if (!m) UI.say('Utilisation : /mode survie  ou  /mode creatif', 'err'); else { setMode(m); UI.say('Mode ' + (m === 'creatif' ? 'créatif' : 'survie') + ' activé.', 'ok'); }
    } else if (cmd === 'temps') {
      if (G.dim !== 'surface') { UI.say('Il n\'y a pas de ciel dans les Braises.', 'err'); return; }
      const v = a === 'jour' ? 0.3 : a === 'nuit' ? 0.8 : a === 'aube' ? 0.02 : parseFloat(a);
      if (!isFinite(v)) UI.say('Utilisation : /temps jour | nuit | aube | 0 à 1', 'err'); else { G.time = ((v % 1) + 1) % 1; UI.say('Le temps file… (' + G.time.toFixed(2) + ')', 'ok'); }
    } else if (cmd === 'graine') UI.say('Graine du monde : ' + G.seed, 'ok');
    else if (cmd === 'meteo') {
      const m = a === 'pluie' ? 'pluie' : a === 'orage' ? 'orage' : a === 'clair' || a === 'soleil' ? 'clair' : null;
      if (!VX.Weather) UI.say('La météo n’est pas chargée.', 'err');
      else if (!m) UI.say('Utilisation : /meteo pluie | orage | clair (actuellement : ' + VX.Weather.mode() + ')', 'err');
      else { VX.Weather.set(m); UI.say(m === 'clair' ? 'Le ciel se dégage.' : m === 'pluie' ? 'Il commence à pleuvoir…' : 'Un orage gronde !', 'ok'); }
    } else if (cmd === 'xp') {
      if (G.mode !== 'creatif') { UI.say('/xp : seulement en mode créatif.', 'err'); return; }
      const n = parseInt(a, 10); if (!isFinite(n)) { UI.say('Utilisation : /xp 50', 'err'); return; }
      G.player.xp = Math.max(0, (G.player.xp || 0) + n); UI.hud(); UI.say('Expérience : ' + G.player.xp + ' (niveau ' + VX.xpLevel(G.player.xp).level + ')', 'ok');
    } else if (cmd === 'localiser') {
      if (G.mode !== 'creatif') { UI.say('/localiser : seulement en mode créatif.', 'err'); return; }
      const g = G.world.gen, P = G.player.pos, kinds = { ruine: 'ruine', ruines: 'ruine', puits: 'puits', arbre: 'geant', geant: 'geant', portail: 'portail' };
      if (!g || !g.nearestStructure || !kinds[a] || G.dim !== 'surface') { UI.say('Utilisation (Surface) : /localiser ruine | puits | arbre | portail', 'err'); return; }
      const s = g.nearestStructure(P.x, P.z, 1500, kinds[a]); if (!s) { UI.say('Rien de tel à moins de 1500 blocs.', 'err'); return; }
      UI.say('Le plus proche : X ' + s.x + '  Z ' + s.z + ' (à ' + Math.round(Math.hypot(s.x - P.x, s.z - P.z)) + ' blocs)', 'ok');
    }
    else if (cmd === 'aide' || cmd === '?') UI.say('Commandes : /mode survie|creatif · /temps jour|nuit · /meteo pluie|orage|clair · /graine · /localiser · /xp · /aide', 'ok');
    else UI.say('Commande inconnue : /' + cmd + ' (essaie /aide)', 'err');
  };

  G.menuAction = function (a) {
    if (a === 'play') { UI.menu(null); lock(); }
    else if (a === 'respawn') { H.emit('respawn', { player: G.player }); const P = G.player; P.hp = 20; P.food = 20; P.sat = 5; P.air = AIR_MAX; if (G.dim !== 'surface') useWorld('surface'); P.pos.set(G.spawn.x, G.spawn.y + 0.2, G.spawn.z); P.vel.set(0, 0, 0); P.fallTop = null; preload(); UI.menu(null); UI.hud(); lock(); }
    else if (a === 'mphost') VX.MP.host_();
    else if (a === 'mpjoin') VX.MP.join();
    else if (a === 'mpleave') { VX.MP.leave(); UI.menu('pause'); }
    else if (a === 'shaders') { if (VX.Shaders) VX.Shaders.openPanel(); }
    else if (a === 'gfx') { VX.fastMesh = !VX.fastMesh; G.saveSettings(); G.world.remeshAll(); UI.menu('pause'); }
    else if (a === 'mode') setMode(G.mode === 'creatif' ? 'survie' : 'creatif');
    else if (a === 'save') { G.save(); }
    else if (a === 'export') { G.save(true); const blob = new Blob([localStorage.getItem(SAVE_KEY) || JSON.stringify(state())], { type: 'application/json' }), u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'blocaria-monde-' + G.seed + '.json'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
    else if (a === 'import') { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.onchange = () => { const file = f.files[0]; if (!file) return; file.text().then(t => { try { const j = JSON.parse(t); if (!j || j.v !== 1 || !j.seed) throw new Error('fichier'); G._noSave = true; localStorage.setItem(SAVE_KEY, t); location.reload(); } catch (e) { UI.toast('Fichier de monde invalide.'); } }); }; f.click(); }
    else if (a === 'new') { const s = prompt('Graine du nouveau monde (laisse vide pour du hasard). Ton monde actuel sera remplacé — exporte-le avant si tu veux le garder.', ''); if (s === null) return; G._noSave = true; localStorage.removeItem(SAVE_KEY); localStorage.setItem('blocaria_newseed', s.trim()); location.reload(); }
    else if (a === 'quit') { G.save(true); location.href = '../index.html'; }
  };

  /* ---------- sauvegarde (v1 : les anciens champs restent lisibles, les nouveaux sont facultatifs) ---------- */
  function state() {
    const P = G.player, r = v => Math.round(v * 100) / 100;
    return { v: 1, seed: G.seed, dim: G.dim, mode: G.mode, time: r(G.time), spawn: G.spawn,
      player: { x: r(P.pos.x), y: r(P.pos.y), z: r(P.pos.z), yaw: r(P.yaw), pitch: r(P.pitch), hp: P.hp, food: P.food, sat: r(P.sat), fly: P.fly, air: r(P.air), xp: P.xp || 0 },
      inv: G.inv, sel: G.sel, armor: G.armor, offhand: G.offhand || null, weather: VX.Weather ? VX.Weather.save() : undefined, mods: G.mods, furnaces: G.furnaces, chests: G.chests, links: G.links, known: Object.keys(G.known).map(Number) };
  }
  G.save = function (quiet) {
    if (G.guest) return;   // invité dans le monde d'un pote : on ne touche pas à sa propre sauvegarde
    if (G._noSave) return;   // nouveau monde / import en cours : la sauvegarde de « beforeunload » écraserait le nouveau monde
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state())); if (!quiet) UI.toast('Monde sauvegardé ✔'); }
    catch (e) { UI.toast('Sauvegarde impossible (monde trop gros) : utilise « Exporter le monde ».'); }
  };
  function load() {
    let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
    if (s && s.v === 1) {
      G.seed = s.seed; G.mode = s.mode || 'survie'; G.time = s.time || 0.3; G.mods = s.mods || { surface: {}, braises: {} }; G.furnaces = s.furnaces || {}; G.links = s.links || {};
      G.chests = s.chests || {}; G.armor = (Array.isArray(s.armor) ? s.armor : []).concat([null, null, null, null]).slice(0, 4);
      G.inv = (s.inv || []).concat(Array(36).fill(null)).slice(0, 36); G.sel = s.sel || 0; G.spawn = s.spawn;
      G.known = {}; for (const id of s.known || []) G.known[id] = 1;
      useWorld(s.dim || 'surface'); const P = G.player, p = s.player || {}; P.pos.set(p.x || 0.5, p.y || 40, p.z || 0.5); P.yaw = p.yaw || 0; P.pitch = p.pitch || 0; P.hp = p.hp || 20; P.food = p.food != null ? p.food : 20; P.sat = p.sat || 5; P.fly = !!p.fly && G.mode === 'creatif';
      P.air = p.air != null ? Math.max(0, Math.min(AIR_MAX, p.air)) : AIR_MAX;
      P.xp = Math.max(0, +p.xp || 0); G.offhand = s.offhand && s.offhand.id ? s.offhand : null;   // champs facultatifs (anciennes sauvegardes)
      if (s.weather && VX.Weather) VX.Weather.load(s.weather);
      if (!G.spawn) G.spawn = { x: 0.5, y: 40, z: 0.5 };
      return true;
    }
    let seedTxt = ''; try { seedTxt = localStorage.getItem('blocaria_newseed') || ''; localStorage.removeItem('blocaria_newseed'); } catch (e) {}
    G.seed = seedTxt ? (/^-?\d+$/.test(seedTxt) ? +seedTxt : [...seedTxt].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)) : (Math.random() * 2e9) | 0;
    useWorld('surface'); G.spawn = G.world.findSpawn(0, 0); G.player.pos.set(G.spawn.x, G.spawn.y, G.spawn.z);
    return false;
  }

  /* ---------- dégâts et armure ---------- */
  // types de dégâts que l'armure réduit (pas la chute, la noyade, la faim ni la lave)
  const ARMORED = { mob: 1, fleche: 1, explosion: 1 };
  // bouclier levé (G.blocking, géré par combat.js) : un coup venu de face (src = {x, z}) est entièrement paré
  function parried(n, kind, src) {
    const P = G.player; if (!G.blocking || !src || !ARMORED[kind]) return false;
    const dx = src.x - P.pos.x, dz = src.z - P.pos.z, d = Math.hypot(dx, dz) || 1, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    if ((dx * fx + dz * fz) / d < 0.2) return false;   // de côté ou de dos : le bouclier ne protège pas
    const sh = VX.Combat && VX.Combat.shieldStack(); if (sh && sh.d != null) { sh.d -= 1 + Math.floor(n / 3); if (sh.d <= 0) { VX.Combat.breakShield(); UI.toast('Ton bouclier s’est brisé !'); G.sfx('toolbreak'); } }
    G.sfx('shield'); H.emit('parry', { n, kind, src }); UI.hud(); return true;
  }
  G.armorPts = () => { let p = 0; if (VX.ARMOR) for (const s of G.armor) if (s && VX.ARMOR[s.id]) p += VX.ARMOR[s.id].pts; return p; };
  // renvoie false si le coup n'a rien fait (paré, créatif…), true sinon
  function hurt(n, kind, src) {
    const P = G.player; if (G.mode === 'creatif' || n <= 0 || P.hp <= 0) return false;
    if (parried(n, kind, src)) return false;
    if (ARMORED[kind]) {
      const pts = G.armorPts();
      if (pts > 0) {
        n = n * (1 - Math.min(0.8, pts * 0.04)); n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);   // arrondi aléatoire : pas de demi-cœur perdu
        for (let i = 0; i < 4; i++) { const s = G.armor[i]; if (s && s.d != null) { s.d--; if (s.d <= 0) { G.armor[i] = null; UI.toast('Une pièce d\'armure s\'est brisée !'); G.sfx('toolbreak'); } } }
        if (n <= 0) { G.sfx('block'); UI.hud(); return false; }
      }
    }
    P.hp = Math.max(0, P.hp - n); P.hurtT = 0.4; G.sfx(kind === 'fall' ? 'fall' : 'hurt'); UI.flashHearts(); UI.hud();
    if (P.hp <= 0) { H.emit('death', { player: P, kind }); UI.closeInv(); UI.closeChat && UI.closeChat(); UI.menu('mort'); }
    return true;
  }

  /* ---------- boucle ---------- */
  const dirV = new THREE.Vector3(), eyeV = new THREE.Vector3();
  let last = performance.now(), saveT = 0, regenT = 0, starveT = 0, lavaT = 0, uiT = 0, drownT = 0, bubbles = -1;
  function frame(now) { requestAnimationFrame(frame); tick(now); }
  function tick(now) {
    let dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);   // jamais de dt négatif (tick de test en avance sur l'horloge)
    if (G.wantTravel) { G.wantTravel = false; travel(); }
    const P = G.player, w = G.world, paused = !!UI.menuOpen;
    if (!paused) {
      const inp = locked && !UI.open && !UI.chatOpen ? { f: keys.KeyW, b: keys.KeyS, l: keys.KeyA, r: keys.KeyD, jump: keys.Space, sneak: keys.ShiftLeft || keys.ShiftRight, sprint: keys.ControlLeft || keys.ControlRight || sprintTap } : {};
      inp.slow = !!(G.blocking || G.bowDraw > 0);   // bouclier levé, arc tendu : on avance au pas
      const fall = P.step(w, inp, dt, G.mode === 'creatif'); if (fall) hurt(fall, 'fall');
      H.emit('playerTick', { dt, player: P });
      // faim, vie, oxygène
      if (G.mode === 'survie') {
        P.exh += dt * 0.04;
        while (P.exh >= 4) { P.exh -= 4; if (P.sat > 0) P.sat = Math.max(0, P.sat - 1); else if (P.food > 0) { P.food--; UI.hud(); } }
        if (P.food >= 18 && P.hp < 20 && P.hp > 0) { regenT += dt; if (regenT > 3) { regenT = 0; P.hp++; P.exh += 1.5; UI.hud(); } } else regenT = 0;
        if (P.food <= 0) { starveT += dt; if (starveT > 4) { starveT = 0; if (P.hp > 1) hurt(1, 'faim'); } }
        if (P.inLava) { lavaT += dt; if (lavaT > 0.5) { lavaT = 0; hurt(2, 'lave'); } } else lavaT = 0;
        if (P.eyeWater === 1) {
          P.air = Math.max(0, P.air - dt);
          if (P.air <= 0) { drownT += dt; if (drownT > 1) { drownT = 0; hurt(2, 'noyade'); G.sfx('bubble'); } } else drownT = 0;
        } else { P.air = Math.min(AIR_MAX, P.air + dt * 6); drownT = 0; }
      } else P.air = AIR_MAX;
      const bb = P.air >= AIR_MAX && P.eyeWater !== 1 ? -1 : Math.ceil(P.air / AIR_MAX * 10);
      if (bb !== bubbles) { if (bubbles > bb && bb >= 0) G.sfx('bubble'); bubbles = bb; UI.bubbles(bb); }
      // portail
      G.portalCd = Math.max(0, (G.portalCd || 0) - dt);
      if (P.inPortal && G.portalCd <= 0) { G.portalT = (G.portalT || 0) + dt; if (G.portalT > 2.2) G.wantTravel = true; } else G.portalT = Math.max(0, (G.portalT || 0) - dt * 2);
      // fours (tous, même loin)
      if (!(VX.MP && VX.MP.on && VX.MP.joined)) for (const k in G.furnaces) if (VX.furnaceTick(G.furnaces[k], dt) && UI.open && UI.open.furnace === G.furnaces[k]) UI.refresh();   // invité en ligne : l'hôte fait cuire et diffuse
      if (UI.open && UI.open.kind === 'four' && (uiT += dt) > 0.25) { uiT = 0; UI.refresh(); }
      itemsTick(dt);
      // visée, minage
      eyeV.set(P.pos.x, P.eye, P.pos.z); dirV.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
      if (G._dbgTarget && w.getG(G._dbgTarget.x, G._dbgTarget.y, G._dbgTarget.z) !== G._dbgTarget.id) G._dbgTarget = null;   // cible de test périmée
      target = locked ? w.raycast(eyeV, dirV, G.mode === 'creatif' ? 6 : 5) : (G._dbgTarget || null);
      if (target) { outline.visible = true; outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5); } else outline.visible = false;
      breakCd -= dt; useCd -= dt; swingCd -= dt;
      if (G.rmb && useCd <= 0 && locked) { useItem(); useCd = 0.25; }
      G.mine = null;
      if (mining && target && breakCd <= 0) {
        const k = target.x + ',' + target.y + ',' + target.z; if (k !== mineKey) { mineKey = k; mineT = 0; }
        const bt = breakTime(target.id);
        if (swingCd <= 0) { swingCd = 0.25; H.emit('swing'); }
        if (bt === 0) { breakBlock(target); breakCd = 0.2; mineT = 0; UI.mining(0); }
        else if (isFinite(bt)) {
          mineT += dt;
          if (Math.floor((mineT - dt) * 4) !== Math.floor(mineT * 4)) { G.sfx('dig', { id: target.id }); if (VX.FX) VX.FX.dig(target); }
          UI.mining(mineT / bt); G.mine = { x: target.x, y: target.y, z: target.z, f: mineT / bt };
          if (mineT >= bt) { breakBlock(target); mineT = 0; mineKey = ''; UI.mining(0); breakCd = 0.15; G.mine = null; }
        }
      } else if (!mining || !target) { if (mineT) { mineT = 0; UI.mining(0); } }
      G.mining = mining && !!target;
      // jour / nuit
      if (G.dim === 'surface') G.time = (G.time + dt / 1200) % 1;
      saveT += dt; if (saveT > 30) { saveT = 0; G.save(true); }
      P.hurtT = Math.max(0, P.hurtT - dt);
    }
    // monde autour du joueur
    G.world.update(P.pos.x, P.pos.z, G.R);
    // ciel, lumière, brouillard (renderer.js)
    const under = P.eyeWater; R.sky(G.dim, G.time, P, G.R, under);
    camera.position.set(P.pos.x, P.eye, P.pos.z); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    camera.fov += ((P.sprint ? 84 : 75) - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
    UI.fx(under, P.hurtT > 0 ? P.hurtT * 1.5 : 0, Math.min(1, (G.portalT || 0) / 2.2));
    if ((G.infoT = (G.infoT || 0) - dt) <= 0) { G.infoT = 0.25; UI.info(`${VX.MP && VX.MP.on ? '🌐 Salon ' + VX.MP.room.code + ' (' + VX.MP.room.players.length + ') · ' : ''}${G.dimName()} · X ${Math.floor(P.pos.x)}  Y ${Math.floor(P.pos.y)}  Z ${Math.floor(P.pos.z)} · ${G.mode === 'creatif' ? 'Créatif' + (P.fly ? ' (vol)' : '') : 'Survie'}`); }
    H.emit('renderFrame', { dt, time: G.time, scene, camera });
    R.render();
    H.emit('afterRender', { dt, gl: R.gl, camera });   // fx.js : la main à la première personne par-dessus la scène
  }

  G.hurt = (n, kind, src) => hurt(n, kind || 'mob', src); G.dropItem = dropItem; G.scene = scene;
  G._dbg = { breakBlock: t => breakBlock(t), useItem: () => useItem(), lightPortal, travel, setTarget: t => { target = t; G._dbgTarget = t; }, dropItem, useWorld, breakTime, tick: dt => tick(last + dt * 1000), keys, setMining: v => { mining = v; } };   // tests
  /* ---------- démarrage : après le chargement de tous les scripts (les modules ajoutent objets et icônes avant le premier affichage) ---------- */
  function start() {
    UI.init(G);
    const had = load();
    preload();
    for (const s of G.inv.concat(G.armor, [G.offhand])) if (s) G.known[s.id] = 1;
    if (!had) UI.menu('aide'); else UI.menu('pause');
    UI.hud();
    window.addEventListener('beforeunload', () => G.save(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(true); });
    const boot = document.getElementById('boot'); if (boot) boot.remove();
    last = performance.now(); requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

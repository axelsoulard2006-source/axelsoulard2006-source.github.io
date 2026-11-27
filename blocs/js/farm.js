/* ===== farm.js : agriculture — module branché par les hooks
   Houe : transforme l'herbe / la terre en terre labourée (humide et plus sombre à ≤ 4 blocs d'eau, ou sous la pluie).
   Graines de blé (hautes herbes) : se plantent sur la terre labourée ; le blé pousse en 4 stades, plus vite s'il est arrosé.
   Récolte du blé mûr : blé + graines. Les cultures et labours sont suivis à partir des modifications du monde
   (G.mods + évènement worldSet) : aucun balayage des chunks, coût négligeable. ===== */
(function () {
  const VX = window.VX, B = VX.B, I = VX.I, D = VX.BLOCKS, G = VX.G, H = VX.hooks;
  const FARM = new Set([B.LABOUR, B.LABOUR_H]), CROPS = [B.BLE_0, B.BLE_1, B.BLE_2, B.BLE_3];
  const isCrop = id => id >= B.BLE_0 && id <= B.BLE_3;
  const FX = () => VX.FX;
  const K = (x, y, z) => x + ',' + y + ',' + z;

  /* ---------- suivi des labours et des cultures de la dimension courante ---------- */
  const farm = new Map(), crops = new Map();   // clé "x,y,z" -> { x, y, z, dry }
  let world = null, list = [], cursor = 0;
  function track(x, y, z, id) {
    const k = K(x, y, z);
    if (FARM.has(id)) { if (!farm.has(k)) farm.set(k, { x, y, z, dry: 0 }); } else farm.delete(k);
    if (isCrop(id)) { if (!crops.has(k)) crops.set(k, { x, y, z }); } else crops.delete(k);
  }
  // relit toutes les modifications (chargement d'un monde, changement de dimension)
  function rescan() {
    world = G.world; farm.clear(); crops.clear();
    const mods = G.mods[G.dim] || {};
    for (const ck in mods) {
      const [cx, cz] = ck.split(',').map(Number), m = mods[ck];
      for (const i in m) { const id = m[i]; if (!FARM.has(id) && !isCrop(id)) continue; const n = +i, y = n >> 8, r = n & 255; track(cx * 16 + (r & 15), y, cz * 16 + (r >> 4), id); }
    }
  }
  H.on('worldSet', e => {
    if (!world || e.dim !== G.dim) return;
    track(e.x, e.y, e.z, e.id);
    const w = G.world;
    // la terre labourée ne porte une culture que si elle reste labourée
    if (FARM.has(e.old) && !FARM.has(e.id)) { const up = w.get(e.x, e.y + 1, e.z); if (isCrop(up)) { w.set(e.x, e.y + 1, e.z, B.AIR); if (G.mode !== 'creatif') G.dropItem(I.GRAINES, 1, new THREE.Vector3(e.x + 0.5, e.y + 1.3, e.z + 0.5)); } }
    // un bloc plein posé sur un labour le retasse en terre
    if (e.id && D[e.id] && D[e.id].solid && D[e.id].opaque && FARM.has(w.get(e.x, e.y - 1, e.z))) w.set(e.x, e.y - 1, e.z, B.TERRE);
  });

  /* ---------- humidité : eau à 4 blocs ou moins (même niveau ou un au-dessus), ou pluie sur un labour à ciel ouvert ---------- */
  function wet(x, y, z) {
    const w = G.world;
    for (let dy = 0; dy <= 1; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (w.get(x + dx, y + dy, z + dz) === B.EAU) return true;
    const Wt = G.weather; if (Wt && Wt.rain > 0.3 && G.dim === 'surface' && VX.Weather && VX.Weather.skyOpen(x, y + 1, z)) return true;
    return false;
  }
  const tillTo = (x, y, z) => wet(x, y, z) ? B.LABOUR_H : B.LABOUR;

  /* ---------- houe et graines (clic droit) ---------- */
  H.on('use', ({ target: t, stack: st, world: w }) => {
    const itd = VX.ITEMS[st.id];
    if (itd && itd.tool && itd.tool.kind === 'houe') {
      if (!t || (t.id !== B.HERBE && t.id !== B.TERRE) || t.ny < 0) return true;
      const up = w.getG(t.x, t.y + 1, t.z), ub = D[up];
      if (up && !(ub && ub.plant)) return true;   // il faut de l'air (ou une herbe) au-dessus
      if (up) w.set(t.x, t.y + 1, t.z, B.AIR);
      w.set(t.x, t.y, t.z, tillTo(t.x, t.y, t.z));
      G.sfx('till'); H.emit('swing');
      if (FX() && FX().dust) FX().dust(t.x + 0.5, t.y + 1.02, t.z + 0.5, B.TERRE, 14);
      if (G.mode !== 'creatif' && st.d != null) { st.d--; if (st.d <= 0) { G.inv[G.sel] = null; VX.UI.toast('Ta houe s\'est cassée !'); G.sfx('toolbreak'); } }
      return false;
    }
    if (st.id === I.GRAINES) {
      if (!t) return false;
      // on vise le labour, ou la culture / l'air juste au-dessus
      const fx = t.x, fz = t.z, fy = FARM.has(t.id) ? t.y : -1; if (fy < 0) return false;
      if (w.getG(fx, fy + 1, fz) !== B.AIR) return false;
      w.set(fx, fy + 1, fz, B.BLE_0); G.sfx('plant'); H.emit('swing');
      if (FX() && FX().dust) FX().dust(fx + 0.5, fy + 1.02, fz + 0.5, B.TERRE, 6);
      if (G.mode !== 'creatif') { st.n--; if (st.n <= 0) G.inv[G.sel] = null; }
      return false;   // les graines ne se posent jamais comme un bloc
    }
    return true;
  });

  /* ---------- récolte : le blé mûr donne aussi des graines ---------- */
  H.on('blockBreak', e => {
    if (!isCrop(e.id)) return;
    G.sfx('harvest', { ripe: e.id === B.BLE_3 });
    if (e.id === B.BLE_3) {
      if (FX()) FX().burst(e.x + 0.5, e.y + 0.6, e.z + 0.5, 12, [0.95, 0.8, 0.35], { speed: 2.2, life: 0.6, up: 1.4, spread: 0.7 });
      if (G.mode !== 'creatif') { const n = Math.floor(Math.random() * 4); if (n) G.dropItem(I.GRAINES, n, new THREE.Vector3(e.x + 0.5, e.y + 0.5, e.z + 0.5)); }
    }
  });

  /* ---------- pousse et humidité (quelques entrées à la fois, chunks chargés seulement) ---------- */
  let growT = 0, wetT = 0;
  H.on('playerTick', ({ dt }) => {
    if (G.world !== world) rescan();
    const w = G.world;
    // pousse : en moyenne un stade toutes les ~35 s sur labour humide, ~90 s sur labour sec (un peu plus vite sous la pluie)
    if ((growT += dt) >= 1) {
      growT -= 1; const rainK = G.weather && G.weather.rain > 0.3 ? 1.3 : 1;
      for (const c of crops.values()) {
        if (!w.chunk(Math.floor(c.x / 16), Math.floor(c.z / 16))) continue;
        const id = w.get(c.x, c.y, c.z); if (!isCrop(id) || id === B.BLE_3) continue;
        const below = w.get(c.x, c.y - 1, c.z), p = (below === B.LABOUR_H ? 1 / 35 : 1 / 90) * rainK;
        if (Math.random() < p) {
          w.set(c.x, c.y, c.z, id + 1);
          if (FX() && Math.hypot(c.x - G.player.pos.x, c.z - G.player.pos.z) < 24) FX().burst(c.x + 0.5, c.y + 0.4, c.z + 0.5, 4, id + 1 === B.BLE_3 ? [1, 0.85, 0.3] : [0.45, 0.85, 0.35], { speed: 0.8, life: 0.6, up: 1.5, grav: -1, spread: 0.6 });
        }
      }
    }
    // humidité : 40 labours par quart de seconde (tour à tour)
    if ((wetT += dt) >= 0.25) {
      wetT = 0; if (cursor >= list.length) { list = [...farm.values()]; cursor = 0; }
      for (let n = 0; n < 40 && cursor < list.length; n++, cursor++) {
        const f = list[cursor]; if (!w.chunk(Math.floor(f.x / 16), Math.floor(f.z / 16))) continue;
        const id = w.get(f.x, f.y, f.z); if (!FARM.has(id)) continue;
        const want = tillTo(f.x, f.y, f.z);
        if (want !== id) w.set(f.x, f.y, f.z, want);
        // labour sec et nu : il finit par se retasser en terre (~2 min)
        if (want === B.LABOUR && !isCrop(w.get(f.x, f.y + 1, f.z))) { if (++f.dry > 3 && Math.random() < 0.04) w.set(f.x, f.y, f.z, B.TERRE); } else f.dry = 0;
      }
    }
  });
  H.on('dimensionChange', () => { world = null; });
  VX.Farm = { crops, farm, rescan, wet };
})();

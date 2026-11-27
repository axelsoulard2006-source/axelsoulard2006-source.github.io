/* ===== mobs.js : créatures — module branché uniquement par les hooks (aucune modification du moteur)
   Bouffi (paisible, Surface, le jour) · Ombre (hostile, Surface, la nuit) · Feu follet (hostile, Braises) ===== */
(function () {
  const VX = window.VX, B = VX.B, I = VX.I, D = VX.BLOCKS, G = VX.G, H = VX.hooks;
  const box = (w, h, d, col, x, y, z, basic) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, y, z); m.userData.base = new THREE.Color(col); m.userData.glow = !!basic; return m; };
  const TYPES = {
    bouffi: { hp: 8, speed: 1.5, w: 0.45, h: 0.95, dim: 'surface', drops: [[I.VIANDE, 1, 2]],
      build() { const g = new THREE.Group(); g.add(box(0.9, 0.7, 1.1, '#f4efe6', 0, 0.62, 0), box(0.5, 0.45, 0.4, '#e8c9a8', 0, 0.8, 0.68), box(0.08, 0.08, 0.02, '#202020', 0.12, 0.88, 0.89, 1), box(0.08, 0.08, 0.02, '#202020', -0.12, 0.88, 0.89, 1));
        for (const [x, z] of [[0.28, 0.35], [-0.28, 0.35], [0.28, -0.35], [-0.28, -0.35]]) { const l = box(0.18, 0.3, 0.18, '#7a6a5a', x, 0.15, z); l.userData.leg = true; g.add(l); } return g; } },
    ombre: { hp: 14, speed: 2.5, w: 0.3, h: 1.8, dim: 'surface', hostile: true, dmg: 3, drops: [[I.ESSENCE, 0, 1]],
      build() { const g = new THREE.Group(); g.add(box(0.55, 0.9, 0.3, '#241a3a', 0, 1.05, 0), box(0.5, 0.5, 0.5, '#1a1230', 0, 1.75, 0), box(0.1, 0.06, 0.02, '#7ff0ff', 0.12, 1.8, 0.26, 1), box(0.1, 0.06, 0.02, '#7ff0ff', -0.12, 1.8, 0.26, 1));
        for (const x of [0.14, -0.14]) { const l = box(0.2, 0.6, 0.2, '#1a1230', x, 0.3, 0); l.userData.leg = true; g.add(l); } for (const x of [0.38, -0.38]) g.add(box(0.16, 0.75, 0.16, '#241a3a', x, 1.05, 0)); return g; } },
    follet: { hp: 10, speed: 2.2, w: 0.35, h: 0.7, dim: 'braises', hostile: true, fly: true, dmg: 2, drops: [[I.CHARBON, 0, 2]],
      build() { const g = new THREE.Group(); g.add(box(0.55, 0.55, 0.55, '#ff8a2a', 0, 0.35, 0, 1), box(0.35, 0.35, 0.35, '#ffe14a', 0, 0.35, 0, 1), box(0.08, 0.08, 0.02, '#3a1010', 0.1, 0.42, 0.29, 1), box(0.08, 0.08, 0.02, '#3a1010', -0.1, 0.42, 0.29, 1)); return g; } },
  };
  const mobs = [];
  const solid = (x, y, z) => { const b = D[G.world.get(Math.floor(x), Math.floor(y), Math.floor(z))]; return !!(b && b.solid); };
  const liquid = (x, y, z) => { const b = D[G.world.get(Math.floor(x), Math.floor(y), Math.floor(z))]; return !!(b && b.liquid); };
  function spawn(type, x, y, z) {
    const T = TYPES[type], g = T.build(); g.position.set(x, y, z); G.scene.add(g);
    mobs.push({ type, T, g, x, y, z, vx: 0, vy: 0, vz: 0, hp: T.hp, dim: G.dim, t: 0, dir: Math.random() * 6.28, think: 0, hitT: 0, atkCd: 0, flee: 0, ground: false });
  }
  function kill(m, drop) {
    G.scene.remove(m.g); m.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); mobs.splice(mobs.indexOf(m), 1);
    if (drop && G.mode !== 'creatif') for (const [id, a, b] of m.T.drops) { const n = a + Math.floor(Math.random() * (b - a + 1)); if (n > 0) G.dropItem(id, n, new THREE.Vector3(m.x, m.y + 0.5, m.z)); }
  }
  // apparition autour du joueur
  let spawnT = 0;
  function trySpawn() {
    const P = G.player, day = VX.R.uniforms.uDay.value, here = mobs.filter(m => m.dim === G.dim);
    const a = Math.random() * 6.283, d = 18 + Math.random() * 18, x = Math.floor(P.pos.x + Math.cos(a) * d), z = Math.floor(P.pos.z + Math.sin(a) * d);
    if (!G.world.chunk(Math.floor(x / 16), Math.floor(z / 16))) return;
    if (G.dim === 'surface') {
      let y = VX.H - 2; while (y > 1 && !solid(x + 0.5, y, z + 0.5)) y--; const top = G.world.get(x, y, z); if (liquid(x + 0.5, y + 1, z + 0.5)) return;
      if (day > 0.55 && top === B.HERBE && here.filter(m => m.type === 'bouffi').length < 7) spawn('bouffi', x + 0.5, y + 1, z + 0.5);
      else if (day < 0.35 && here.filter(m => m.T.hostile).length < 6 && D[top] && D[top].solid) spawn('ombre', x + 0.5, y + 1, z + 0.5);
    } else if (here.length < 5) {
      for (let y = 20; y < 50; y++) if (solid(x + 0.5, y - 1, z + 0.5) && !solid(x + 0.5, y, z + 0.5) && !solid(x + 0.5, y + 1, z + 0.5) && !liquid(x + 0.5, y, z + 0.5)) { spawn('follet', x + 0.5, y + 1.5, z + 0.5); break; }
    }
  }
  H.on('playerTick', ({ dt, player: P }) => {
    if ((spawnT -= dt) <= 0) { spawnT = 1.2; trySpawn(); }
    const day = VX.R.uniforms.uDay.value, tint = Math.max(0.3, G.dim === 'surface' ? day : 0.9);
    for (const m of mobs.slice()) {
      if (m.dim !== G.dim) { kill(m, false); continue; }
      const dx = P.pos.x - m.x, dz = P.pos.z - m.z, dist = Math.hypot(dx, dz);
      if (dist > 70 || (m.type === 'ombre' && day > 0.6 && Math.random() < dt * 0.5)) { kill(m, false); continue; }
      m.t += dt; m.think -= dt; m.atkCd -= dt; m.flee -= dt; m.hitT -= dt;
      let wx = 0, wz = 0, sp = m.T.speed;
      const chase = m.T.hostile && dist < 22 && G.mode !== 'creatif' && P.hp > 0;
      if (chase) { wx = dx / (dist || 1); wz = dz / (dist || 1); if (dist < 1.3 && Math.abs(P.pos.y - m.y) < 1.8 && m.atkCd <= 0) { m.atkCd = 1; G.hurt(m.T.dmg); P.vel.x += wx * 5; P.vel.z += wz * 5; P.vel.y = Math.max(P.vel.y, 4); } }
      else if (m.flee > 0) { wx = -dx / (dist || 1); wz = -dz / (dist || 1); sp *= 1.8; }
      else { if (m.think <= 0) { m.think = 2 + Math.random() * 4; m.dir = Math.random() < 0.35 ? null : Math.random() * 6.283; } if (m.dir != null) { wx = Math.cos(m.dir); wz = Math.sin(m.dir); sp *= 0.6; } }
      m.vx += (wx * sp - m.vx) * Math.min(1, dt * 6); m.vz += (wz * sp - m.vz) * Math.min(1, dt * 6);
      if (m.T.fly) { const ty = P.pos.y + 1.2 + Math.sin(m.t * 2) * 0.6; m.vy += ((chase ? ty - m.y : Math.sin(m.t) * 0.5) * 2 - m.vy) * Math.min(1, dt * 3); }
      else { m.vy -= 28 * dt; if (liquid(m.x, m.y + 0.3, m.z)) m.vy = Math.min(m.vy + 40 * dt, 2); }
      // déplacement avec collisions simples (et petits sauts pour franchir une marche)
      const nx = m.x + m.vx * dt, nz = m.z + m.vz * dt, r = m.T.w;
      const blocked = (x, z) => solid(x + Math.sign(m.vx) * r, m.y + 0.1, z) || solid(x, m.y + 0.1, z + Math.sign(m.vz) * r) || solid(x + Math.sign(m.vx) * r, m.y + m.T.h - 0.1, z) || solid(x, m.y + m.T.h - 0.1, z + Math.sign(m.vz) * r);
      if (!blocked(nx, m.z)) m.x = nx; else { m.vx = 0; if (m.ground && !m.T.fly) m.vy = 7.5; }
      if (!blocked(m.x, nz)) m.z = nz; else { m.vz = 0; if (m.ground && !m.T.fly) m.vy = 7.5; }
      const ny = m.y + m.vy * dt; m.ground = false;
      if (m.vy <= 0 && solid(m.x, ny, m.z)) { m.y = Math.floor(ny) + 1; m.vy = 0; m.ground = true; } else if (m.vy > 0 && solid(m.x, ny + m.T.h, m.z)) m.vy = 0; else m.y = ny;
      if (m.y < -10) { kill(m, false); continue; }
      if (G.dim === 'braises' && !m.T.fly && liquid(m.x, m.y + 0.2, m.z)) { kill(m, false); continue; }
      // rendu
      m.g.position.set(m.x, m.y, m.z); const sp2 = Math.hypot(m.vx, m.vz); if (sp2 > 0.2) m.g.rotation.y = Math.atan2(m.vx, m.vz);
      m.g.children.forEach(o => { if (o.userData.leg) o.rotation.x = Math.sin(m.t * 10) * Math.min(1, sp2 / 2) * 0.7; if (!o.userData.glow) o.material.color.copy(o.userData.base).multiplyScalar(m.hitT > 0 ? 1 : tint); if (m.hitT > 0 && !o.userData.glow) o.material.color.setRGB(1, 0.3, 0.3); });
      if (m.T.fly) m.g.rotation.y += dt;
    }
  });
  // coups au corps à corps (clic gauche) : prioritaire sur le minage si une créature est visée
  H.on('attack', ({ origin, dir, reach }) => {
    let best = null, bt = reach;
    for (const m of mobs) {
      if (m.dim !== G.dim) continue; const r = m.T.w + 0.15, mn = [m.x - r, m.y, m.z - r], mx = [m.x + r, m.y + m.T.h, m.z + r], o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
      let t0 = 0, t1 = bt, ok = true;
      for (let k = 0; k < 3 && ok; k++) { if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) ok = false; continue; } let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) ok = false; }
      if (ok && t0 < bt) { bt = t0; best = m; }
    }
    if (!best) return true;
    const st = G.inv[G.sel], tl = st && VX.ITEMS[st.id] && VX.ITEMS[st.id].tool, tier = tl ? VX.TIERS[tl.tier] : null;
    const dmg = tl ? (tl.kind === 'epee' ? tier.dmg : Math.max(2, tier.dmg - 2)) : 1;
    best.hp -= dmg; best.hitT = 0.25; best.flee = 3; best.vx += dir.x * 7; best.vz += dir.z * 7; best.vy = 5; G.sfx('hurt');
    if (tl && st.d != null && G.mode !== 'creatif') { st.d--; if (st.d <= 0) G.inv[G.sel] = null; VX.UI.hud(); }
    if (best.hp <= 0) { kill(best, true); G.sfx('pop'); }
    return false;
  });
  H.on('dimensionChange', () => { for (const m of mobs.slice()) kill(m, false); });
  [I.VIANDE, I.STEAK, I.ESSENCE].forEach(id => VX.registry.creative(id));
  VX.Mobs = { list: mobs, spawn, TYPES };
})();

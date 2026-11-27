/* ===== combat.js : arc (tension, flèches paraboliques plantées et ramassables), bouclier (main secondaire, parade frontale),
   expérience (orbes lumineux qui volent vers le joueur, VX.G.player.xp, VX.xpLevel). (Armures des joueurs en ligne : mp.js.)
   Module branché par les hooks ; toutes les géométries / matériaux sont partagés et réutilisés (pas d'allocation par image). ===== */
(function () {
  const VX = window.VX, B = VX.B, I = VX.I, D = VX.BLOCKS, G = VX.G, H = VX.hooks, UI = VX.UI;
  const FLECHE = () => (VX.SURV && VX.SURV.FLECHE) || 124;
  const FX = () => VX.FX;
  if (!('offhand' in G)) G.offhand = null;
  G.bowDraw = 0; G.blocking = false;
  const solid = (x, y, z) => { const b = D[G.world.get(Math.floor(x), Math.floor(y), Math.floor(z))]; return !!(b && b.solid); };

  /* ---------- objets tenus ---------- */
  const held = () => G.inv[G.sel];
  const shieldStack = () => (G.offhand && G.offhand.id === I.BOUCLIER ? G.offhand : held() && held().id === I.BOUCLIER ? held() : null);
  function breakShield() { if (G.offhand && G.offhand.id === I.BOUCLIER) G.offhand = null; else if (held() && held().id === I.BOUCLIER) G.inv[G.sel] = null; UI.hud(); }
  // l'objet en main a-t-il son propre clic droit ? (alors le bouclier de la main secondaire ne se lève pas)
  function mainUsable(st) {
    if (!st) return false; const it = VX.ITEMS[st.id];
    return VX.isBlock(st.id) || st.id === I.ARC || st.id === I.GRAINES || st.id === I.ALLUMEUR || !!(it && (it.food || (it.tool && it.tool.kind === 'houe'))) || !!(VX.ARMOR && VX.ARMOR[st.id]);
  }
  function arrowSlot() { const id = FLECHE(); if (G.offhand && G.offhand.id === id) return -2; for (let i = 0; i < 36; i++) if (G.inv[i] && G.inv[i].id === id) return i; return -1; }
  function useArrow() {
    const i = arrowSlot(); if (i === -1) return false;
    const s = i === -2 ? G.offhand : G.inv[i]; s.n--; if (s.n <= 0) { if (i === -2) G.offhand = null; else G.inv[i] = null; }
    return true;
  }
  // l'arc et le bouclier n'ont pas d'action « poser » : le clic droit sert à tendre / parer (géré à chaque image)
  H.on('use', ({ stack: st }) => (st.id === I.ARC || st.id === I.BOUCLIER) ? false : true);

  /* ---------- indicateur de tension (au centre de l'écran, sous le viseur) ---------- */
  const gauge = document.createElement('div');
  gauge.style.cssText = 'position:fixed;left:50%;top:50%;width:56px;height:8px;margin:18px 0 0 -28px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.55);pointer-events:none;z-index:30;display:none;image-rendering:pixelated';
  const gfill = document.createElement('div'); gfill.style.cssText = 'height:100%;width:0;background:#e8e0c0'; gauge.appendChild(gfill);
  (document.body || document.documentElement).appendChild(gauge);
  let gaugeShown = -1;
  function showGauge(f) {
    const k = f > 0 ? Math.round(f * 40) : -1; if (k === gaugeShown) return; gaugeShown = k;
    gauge.style.display = f > 0 ? 'block' : 'none'; gfill.style.width = Math.round(f * 100) + '%';
    gfill.style.background = f >= 1 ? '#ffd23a' : '#e8e0c0'; gauge.style.boxShadow = f >= 1 ? '0 0 8px #ffd23a' : 'none';
  }

  /* ---------- flèches du joueur (réserve de maillages) ---------- */
  const arrows = [], MAXA = 32;
  const mats = {}, mat = c => mats[c] || (mats[c] = new THREE.MeshBasicMaterial({ color: c }));
  const box = (w, h, d, c, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.z = z || 0; return m; };
  const proto = new THREE.Group(); proto.add(box(0.04, 0.04, 0.62, '#8a5f33'), box(0.07, 0.07, 0.1, '#c8c8d0', 0.34), box(0.14, 0.02, 0.13, '#efe8da', -0.25), box(0.02, 0.14, 0.13, '#efe8da', -0.25));
  const tmpV = new THREE.Vector3();
  function fire(t) {
    const P = G.player, cre = G.mode === 'creatif';
    if (!cre && !useArrow()) return;
    let a = arrows.find(x => !x.on);
    if (!a) { if (arrows.length >= MAXA) a = arrows.reduce((p, c) => (c.age > p.age ? c : p)); else { a = { g: proto.clone(), on: false }; arrows.push(a); G.scene.add(a.g); } }
    const dir = new THREE.Vector3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)), sp = 10 + 32 * t;
    a.p = new THREE.Vector3(P.pos.x, P.eye - 0.1, P.pos.z).addScaledVector(dir, 0.5);
    a.v = dir.multiplyScalar(sp).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3).multiplyScalar(1 - t));
    a.dmg = Math.round(1 + 7 * t * t); a.crit = t >= 1 && Math.random() < 0.3; if (a.crit) a.dmg += 1 + Math.floor(Math.random() * 3);
    a.on = true; a.stuck = false; a.age = 0; a.dim = G.dim; a.pick = !cre; a.g.visible = true; a.g.position.copy(a.p); a.g.lookAt(a.p.x + a.v.x, a.p.y + a.v.y, a.p.z + a.v.z);
    G.sfx('bow', { k: t }); H.emit('swing'); P.exh += 0.1;
    const st = held(); if (st && st.id === I.ARC && st.d != null && !cre) { st.d--; if (st.d <= 0) { G.inv[G.sel] = null; UI.toast('Ton arc s\'est cassé !'); G.sfx('toolbreak'); } }
    UI.hud();
  }
  function hitMob(x, y, z) {
    const L = VX.Mobs && VX.Mobs.list; if (!L) return null;
    for (const m of L) { if (m.dim !== G.dim) continue; const r = m.T.w + 0.1; if (x > m.x - r && x < m.x + r && z > m.z - r && z < m.z + r && y > m.y && y < m.y + m.T.h) return m; }
    return null;
  }
  function arrowsTick(dt) {
    const P = G.player;
    for (const a of arrows) {
      if (!a.on) continue; a.age += dt;
      if (a.dim !== G.dim || a.age > (a.stuck ? 60 : 12)) { a.on = false; a.g.visible = false; continue; }
      if (a.stuck) {   // flèche plantée : on la ramasse en passant dessus
        if (a.age > 0.4 && Math.abs(P.pos.x - a.p.x) < 1.1 && Math.abs(P.pos.z - a.p.z) < 1.1 && a.p.y > P.pos.y - 0.6 && a.p.y < P.pos.y + 2.2) {
          if (!a.pick || G.canGive(FLECHE(), 1)) { if (a.pick) { G.give(FLECHE(), 1); H.emit('itemPickup', { id: FLECHE(), n: 1 }); } a.on = false; a.g.visible = false; G.sfx('pop'); }
        }
        continue;
      }
      if (G.world.get(Math.floor(a.p.x), Math.floor(a.p.y), Math.floor(a.p.z)) === B.EAU) { a.v.multiplyScalar(1 - dt * 3); }
      a.v.y -= 16 * dt;
      const len = a.v.length() * dt, n = Math.max(1, Math.ceil(len / 0.2)); let done = false;
      for (let k = 0; k < n && !done; k++) {
        const nx = a.p.x + a.v.x * dt / n, ny = a.p.y + a.v.y * dt / n, nz = a.p.z + a.v.z * dt / n;
        const m = hitMob(nx, ny, nz);
        if (m) {
          VX.Mobs.damage(m, a.dmg, a.v.x * 0.25, a.v.z * 0.25);
          if (a.crit && FX() && FX().stars) FX().stars(nx, ny, nz, 10);
          G.sfx('arrowhit'); a.on = false; a.g.visible = false; done = true; break;
        }
        if (solid(nx, ny, nz)) { a.stuck = true; a.age = 0; G.sfx('arrow', { dist: Math.hypot(P.pos.x - nx, P.pos.z - nz) }); done = true; break; }
        a.p.set(nx, ny, nz);
      }
      if (!a.on) continue;
      a.g.position.copy(a.p); if (!a.stuck) a.g.lookAt(a.p.x + a.v.x, a.p.y + a.v.y, a.p.z + a.v.z);
      if (a.crit && !a.stuck && FX() && FX().stars && Math.random() < 0.6) FX().stars(a.p.x, a.p.y, a.p.z, 1, 0.2);
    }
  }
  // une flèche plantée disparaît avec son bloc
  H.on('worldSet', e => { if (e.id) return; for (const a of arrows) if (a.on && a.stuck && Math.floor(a.p.x) === e.x && Math.floor(a.p.y) === e.y && Math.floor(a.p.z) === e.z) { a.stuck = false; a.v.set(0, 0, 0); } });

  /* ---------- tension de l'arc, bouclier ---------- */
  let drawing = false, drawT = 0, noArrowT = 0, raiseT = 0;
  H.on('playerTick', ({ dt, player: P }) => {
    const st = held(), isBow = !!(st && st.id === I.ARC), free = !UI.open && !UI.menuOpen && !UI.chatOpen && P.hp > 0;
    noArrowT -= dt;
    // arc : on tend tant que le clic droit est maintenu (1 s pour la pleine tension), on tire en relâchant
    if (G.rmb && isBow && free) {
      if (!drawing) {
        if (G.mode !== 'creatif' && arrowSlot() === -1) { if (noArrowT <= 0) { UI.toast('Il te faut des flèches.'); noArrowT = 3; } }
        else { drawing = true; drawT = 0; G.sfx('bowdraw'); }
      }
      if (drawing) { drawT += dt; const f = Math.min(1, drawT / 1); if (G.bowDraw < 1 && f >= 1) G.sfx('bowready'); G.bowDraw = f; }
    } else if (drawing) {
      if (isBow && !G.rmb && free && G.bowDraw >= 0.12) fire(G.bowDraw);
      drawing = false; G.bowDraw = 0;
    }
    showGauge(G.bowDraw);
    // bouclier : clic droit maintenu sans arc (et sans objet qui a son propre clic droit en main)
    const sh = shieldStack(), want = !!(G.rmb && sh && !isBow && free && (sh === st || !mainUsable(st)));
    raiseT = want ? raiseT + dt : 0;
    const was = G.blocking; G.blocking = want && raiseT > 0.12;
    if (G.blocking && !was) G.sfx('shieldup');
    arrowsTick(dt);
  });
  H.on('parry', ({ src }) => { if (FX() && src) { const P = G.player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); FX().burst(P.pos.x + fx * 0.7, P.eye - 0.3, P.pos.z + fz * 0.7, 6, [0.85, 0.85, 0.9], { speed: 2, life: 0.3 }); } });
  H.on('dimensionChange', () => { for (const a of arrows) { a.on = false; a.g.visible = false; } for (const o of orbs) o.on = false; });

  /* ---------- expérience : orbes lumineux ---------- */
  // orbe en pixels (grille 8×8) : contour vert sombre, cœur vert-jaune, reflet clair ; lumineux la nuit (non teinté par le jour)
  const ORB = ['..oooo..', '.oyyyyo.', 'oyWwyyyo', 'oyWyyyyo', 'oyyyyGyo', 'oyyyGGyo', '.oyyyyo.', '..oooo..'], ORBPAL = { o: '#2f6e14', y: '#9cf03c', G: '#5cc022', W: '#ffffd0', w: '#e8ff90' };
  const orbCv = document.createElement('canvas'); orbCv.width = orbCv.height = 8;
  (function () { const g = orbCv.getContext('2d'); ORB.forEach((r, y) => [...r].forEach((c, x) => { if (ORBPAL[c]) { g.fillStyle = ORBPAL[c]; g.fillRect(x, y, 1, 1); } })); })();
  const orbTex = new THREE.CanvasTexture(orbCv); orbTex.magFilter = orbTex.minFilter = THREE.NearestFilter; orbTex.generateMipmaps = false;
  const orbMats = [0xffffff, 0xf0ffb0, 0xfff4a0].map(c => new THREE.SpriteMaterial({ map: orbTex, color: c, transparent: true, alphaTest: 0.4, fog: false }));
  const orbs = [], MAXO = 80;
  function spawnOrb(x, y, z, val) {
    let o = orbs.find(q => !q.on);
    if (!o) {
      if (orbs.length >= MAXO) { // trop d'orbes : on fusionne avec le plus proche
        let best = orbs[0], bd = Infinity; for (const q of orbs) { const d = Math.hypot(q.x - x, q.y - y, q.z - z); if (d < bd) { bd = d; best = q; } } best.val += val; return;
      }
      o = { s: new THREE.Sprite(orbMats[orbs.length % 3]), on: false }; orbs.push(o); G.scene.add(o.s);
    }
    Object.assign(o, { on: true, x, y, z, vx: (Math.random() - 0.5) * 3, vy: 2.5 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, val, age: 0, dim: G.dim, ph: Math.random() * 6 });
    o.s.visible = true; o.s.position.set(x, y, z);
  }
  // une quantité d'XP éclatée en quelques orbes (valeurs 1, 3, 7, 17…)
  function dropXP(x, y, z, amount) {
    amount = Math.round(amount); let guard = 0;
    while (amount > 0 && guard++ < 20) { const v = amount >= 17 ? 17 : amount >= 7 ? 7 : amount >= 3 ? 3 : 1; spawnOrb(x, y, z, v); amount -= v; }
  }
  function gainXP(v) {
    const P = G.player, before = VX.xpLevel(P.xp || 0).level; P.xp = (P.xp || 0) + v;
    const after = VX.xpLevel(P.xp).level;
    G.sfx('xp'); if (after > before) { G.sfx('levelup', { level: after }); UI.toast('Niveau ' + after + ' !'); }
    H.emit('xp', { xp: P.xp, gained: v, level: after }); UI.hud();
  }
  function orbsTick(dt) {
    const P = G.player;
    for (const o of orbs) {
      if (!o.on) continue; o.age += dt;
      if (o.dim !== G.dim || o.age > 300) { o.on = false; o.s.visible = false; continue; }
      const dx = P.pos.x - o.x, dy = P.pos.y + 0.9 - o.y, dz = P.pos.z - o.z, d = Math.hypot(dx, dy, dz);
      if (o.age > 0.6 && d < 7 && P.hp > 0) {   // attiré par le joueur, de plus en plus vite
        const k = (1 - d / 7); o.vx += dx / d * k * 40 * dt; o.vy += dy / d * k * 40 * dt; o.vz += dz / d * k * 40 * dt;
        o.vx *= 1 - dt * 3; o.vy *= 1 - dt * 3; o.vz *= 1 - dt * 3;
        if (d < 0.75) { o.on = false; o.s.visible = false; gainXP(o.val); continue; }
      } else { o.vy -= 12 * dt; o.vx *= 1 - dt * 1.5; o.vz *= 1 - dt * 1.5; }
      const nx = o.x + o.vx * dt, ny = o.y + o.vy * dt, nz = o.z + o.vz * dt;
      if (!solid(nx, o.y, o.z)) o.x = nx; else o.vx *= -0.3;
      if (!solid(o.x, o.y, nz)) o.z = nz; else o.vz *= -0.3;
      if (!solid(o.x, ny - 0.1, o.z)) o.y = ny; else { o.vy = o.vy < -2 ? -o.vy * 0.35 : 0; o.y = Math.floor(ny - 0.1) + 1.1; }
      const sz = (0.24 + Math.min(0.22, Math.sqrt(o.val) * 0.05)) * (1 + Math.sin(o.age * 7 + o.ph) * 0.1);
      o.s.position.set(o.x, o.y + 0.05 + Math.sin(o.age * 3 + o.ph) * 0.04, o.z); o.s.scale.set(sz, sz, 1);
    }
  }
  H.on('renderFrame', ({ dt }) => { if (!UI.menuOpen) orbsTick(dt); });
  // minerais : un peu d'expérience quand on les récolte avec le bon outil
  const ORE_XP = { [B.M_CHARBON]: [0, 2], [B.M_FER]: [0, 1], [B.M_OR]: [1, 3], [B.M_SAPHIR]: [3, 7], [B.M_ASTRIUM]: [2, 5], [B.LUMICRISTAL]: [1, 2] };
  H.on('blockBreak', e => {
    const r = ORE_XP[e.id]; if (!r || G.mode === 'creatif') return;
    const b = D[e.id], st = held(), t = st && VX.ITEMS[st.id] && VX.ITEMS[st.id].tool;
    if (b.tier >= 0 && !(t && t.kind === b.tool && t.tier >= b.tier)) return;
    const n = r[0] + Math.floor(Math.random() * (r[1] - r[0] + 1)); if (n > 0) dropXP(e.x + 0.5, e.y + 0.5, e.z + 0.5, n);
  });
  // mort : une partie de l'expérience reste sur place
  H.on('death', ({ player: P }) => { const L = VX.xpLevel(P.xp || 0).level, n = Math.min(P.xp || 0, L * 7, 100); if (n > 0) dropXP(P.pos.x, P.pos.y + 0.6, P.pos.z, n); P.xp = 0; UI.hud(); });

  /* ---------- armures visibles sur les joueurs en ligne : gérées par mp.js (message « look », VX.armorLook de survie.js) ---------- */

  VX.Combat = { fire, dropXP, gainXP, shieldStack, breakShield, arrows, orbs, mainUsable };
  VX.XP = { drop: dropXP, gain: gainXP };
})();

/* ===== arena/dungeon-puzzles.js : les énigmes de la Citadelle =====
   Chaque énigme : { n, d, layout(B, room, rng) → plan de la salle, start(P), update(P, dt, t) }.
   Les objets à actionner (E) passent par P.use(...) ; une action est envoyée aux autres joueurs et rejouée chez eux
   à l'identique (les énigmes sont tirées avec la même graine pour tout le monde). Une énigme résolue ouvre le coffre,
   puis les portes. Un levier « passer son chemin » près de l'entrée ouvre les portes sans récompense. */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, DG = BR.Dungeon;
  const L = c => new THREE.Color(c).convertSRGBToLinear();
  const BOX = new THREE.BoxGeometry(1, 1, 1);

  /* =====================================================================
     CADRE COMMUN
     ===================================================================== */
  DG.startRoom = function (S, room, api) {
    const env = S.env; env.S = S;
    const def = room.kind === 'enigme' ? DG.PUZZLES[room.puz] : DG.QUIZ[room.quiz];
    if (!def) { api.skip(); return; }
    const prompt = BR.el('div', { class: 'asc-prompt dg-prompt' }); S.hud.appendChild(prompt);
    let lastHtml = '', near = null;
    const P = env.puzzle = {
      S, env, room, api, def, data: env.puzzleData || {}, uses: [], solved: false, t: 0, mine: {}, rng: BR.rngFrom(((room.seed || 1) ^ 0x9e3779b9) >>> 0),
      /** objet actionnable : { id, pos, r, label() -> texte, act(fromMe, from) } */
      use(o) { o.r = o.r || 2.2; P.uses.push(o); return o; },
      /** j'actionne : je joue l'action tout de suite et je la partage */
      fire(id, v) { const o = P.uses.find(u => u.id === id); if (!o || o.off) return; o.act(true, S.selfId, v); BR.Arena.send({ k: 'dg', e: 'use', id, v }); },
      send(d) { BR.Arena.send(Object.assign({ k: 'dg' }, d)); },
      /** énigme résolue : une seule fois, chez tout le monde */
      solve(score, fromNet) {
        if (P.solved) return; P.solved = true;
        if (!fromNet && def.shared !== false) P.send({ e: 'solved' });
        BR.Audio.fx('reveal', { rate: 0.9, g: 0.9 }); BR.Audio.fx('levelup', { g: 0.5 });
        BR.Arena.banner(def.win || 'MÉCANISME ACTIVÉ', def.winSub || 'Le trésor est à toi', 2.2, 'gold');
        S.fx.burst(S.me.center(), { n: 60, color: 0xffd76a, speed: 9, life: 1 });
        if (skipLever) skipLever.off = true;
        api.solved(score);
      },
      banner(t, s, d, c) { BR.Arena.banner(t, s || '', d || 1.6, c || ''); },
      say(t) { const m = S.hud.querySelector('.a-msgs'); if (m) { const e = BR.el('div', null, t); m.appendChild(e); setTimeout(() => e.remove(), 5000); } },
      meNear(pos, r) { const me = S.me; return me.alive && Math.hypot(me.pos.x - pos.x, me.pos.z - pos.z) < r; },
    };
    // levier de secours : passer son chemin (sans récompense)
    let skipLever = null;
    if (def.skippable !== false && env.entrance) {
      const D = env.entrance, pos = new V3(D.x - D.ox * 3.2 + D.ux * 4.6, 0, D.z - D.oz * 3.2 + D.uz * 4.6);
      const lv = DG.lever(S.scene, pos, D.ry + Math.PI, '#8a8a8a'); env.B.extraDispose = (env.B.extraDispose || []).concat([lv]);
      let armed = 0;
      skipLever = P.use({ id: '__skip', pos, r: 2, label: () => armed > S.t ? 'Confirmer : passer sans récompense' : 'Passer cette salle (sans récompense)', act(mine) {
        if (!mine) return;
        if (armed > S.t) { armed = 0; lv.set(true); skipLever.off = true; P.say('Tu passes ton chemin… les portes s\'ouvrent.'); api.skip(); }
        else { armed = S.t + 4; BR.Audio.ui('click'); }
      } });
      skipLever.local = true;
    }
    env.wantsKey = code => {
      if (!(BR.Keys ? BR.Keys.is('interact', code) : code === 'KeyE') || !near || near.off || !S.me.alive) return false;
      if (near.local) near.act(true, S.selfId); else P.fire(near.id);
      return true;
    };
    env.onNet = (from, d) => {
      if (d.e === 'use') { const o = P.uses.find(u => u.id === d.id); if (o && !o.local) o.act(false, from, d.v); }
      else if (d.e === 'solved') P.solve(1, true);
      else if (def.net) def.net(P, from, d);
    };
    P.update = (dt, t) => {
      P.t += dt;
      if (def.update) def.update(P, dt, t);
      // objet le plus proche : bulle d'aide
      let best = null, bd = 1e9;
      for (const o of P.uses) { if (o.off) continue; const d = Math.hypot(S.me.pos.x - o.pos.x, S.me.pos.z - o.pos.z); if (d < o.r && d < bd && Math.abs(S.me.pos.y - (o.pos.y || 0)) < 2.5) { bd = d; best = o; } }
      near = best;
      const html = best ? `<div class="ap-card small" style="--rc:${best.col || '#5ad1ff'}"><div class="ap-b"><b>${BR.esc(best.title || 'Mécanisme')}</b><p><kbd>${BR.Keys ? BR.Keys.label('interact') : 'E'}</kbd> ${BR.esc(best.label())}</p></div></div>` : '';
      if (html !== lastHtml) { lastHtml = html; prompt.innerHTML = html; prompt.classList.toggle('on', !!html); }
    };
    P.dispose = () => { prompt.remove(); if (def.dispose) def.dispose(P); };
    env.puzzle = P;
    def.start(P);
    // consigne de la salle
    if (def.hint) setTimeout(() => { if (BR.Arena.session() === S) P.say(def.hint); }, 2600);
  };

  /* ---------- pièces de mécanisme réutilisables ---------- */
  // levier : socle + manche qui bascule
  DG.lever = function (scene, pos, ry, col) {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = ry || 0; scene.add(g);
    const stone = new THREE.MeshStandardMaterial({ color: L('#5e5a52'), roughness: 0.9 }), metal = new THREE.MeshStandardMaterial({ color: L('#3a3a40'), roughness: 0.4, metalness: 0.8 }), knob = new THREE.MeshStandardMaterial({ color: L(col || '#c9302a'), roughness: 0.4, emissive: L(col || '#c9302a').multiplyScalar(0.25) });
    const base = new THREE.Mesh(BOX, stone); base.scale.set(1.1, 0.9, 0.8); base.position.y = 0.45; base.castShadow = true; g.add(base);
    const slot = new THREE.Mesh(BOX, metal); slot.scale.set(0.18, 0.06, 0.6); slot.position.y = 0.92; g.add(slot);
    const arm = new THREE.Group(); arm.position.y = 0.92; g.add(arm);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), metal); stick.position.y = 0.55; stick.castShadow = true; arm.add(stick);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), knob); ball.position.y = 1.12; arm.add(ball);
    let on = false, cur = -0.6;
    arm.rotation.x = cur;
    const o = { g, set(v) { on = !!v; }, get on() { return on; }, tick(dt) { const w = on ? 0.6 : -0.6; cur += (w - cur) * Math.min(1, dt * 14); arm.rotation.x = cur; },
      dispose() { scene.remove(g); [stone, metal, knob].forEach(m => m.dispose()); stick.geometry.dispose(); ball.geometry.dispose(); } };
    o.tickId = setInterval(() => o.tick(0.03), 30);
    const d0 = o.dispose; o.dispose = () => { clearInterval(o.tickId); d0(); };
    return o;
  };
  // cristal qui s'allume (lampe d'énigme)
  DG.crystal = function (scene, pos, col, size) {
    const c = L(col || '#5ad1ff');
    const mat = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.3), emissive: c.clone(), emissiveIntensity: 0.05, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 });
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(size || 0.6, 0), mat); m.position.copy(pos); m.scale.y = 1.6; m.castShadow = true; scene.add(m);
    let on = false, k = 0;
    return { m, set(v) { on = !!v; }, get on() { return on; }, tick(dt, t) { k += ((on ? 1 : 0) - k) * Math.min(1, dt * 8); mat.emissiveIntensity = 0.05 + k * 2.6; m.rotation.y += dt * (0.3 + k * 1.5); m.position.y = pos.y + Math.sin(t * 2 + pos.x) * 0.08 * (0.3 + k); },
      dispose() { scene.remove(m); m.geometry.dispose(); mat.dispose(); } };
  };
  // panneau de consigne (bois sombre, lettres dorées)
  DG.sign = function (scene, pos, ry, lines, w, h) {
    const tex = DG.textTex(lines, { w: 1024, h: Math.round(1024 * (h || 1.6) / (w || 3.2)) });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w || 3.2, h || 1.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.62 }));
    m.position.copy(pos); m.rotation.y = ry || 0; scene.add(m);
    return { m, dispose() { scene.remove(m); m.geometry.dispose(); m.material.dispose(); if (m.material.map) m.material.map.dispose(); }, set(lines2) { const t2 = DG.textTex(lines2, { w: 1024, h: Math.round(1024 * (h || 1.6) / (w || 3.2)) }); m.material.map.dispose(); m.material.map = t2; m.material.emissiveMap = t2; m.material.needsUpdate = true; } };
  };

  /* ---------- salle rectangulaire : porte au sud, 3 portes au nord ---------- */
  function rectRoom(B, W, Lz, o) {
    o = o || {}; const H = o.H || 9, hx = W / 2, hz = Lz / 2, T = 1.4, fg = 3.45, sh = (B.M && B.M.shell) || 'walls';
    if (o.floor !== false) B.floorRect(-hx, -hz, hx, hz);
    if (sh === 'walls' && !(B.theme && B.theme.rectShell)) {
      B.wall(-hx, -hz, -fg, -hz, H, T); B.wall(fg, -hz, hx, -hz, H, T);
      B.wall(-hx, hz, -fg, hz, H, T); B.wall(fg, hz, hx, hz, H, T);
      B.wall(-hx, -hz, -hx, hz, H, T); B.wall(hx, -hz, hx, hz, H, T);
      const nT = Math.max(2, Math.floor(Lz / 9));
      for (let i = 0; i < nT; i++) {
        const z = -hz + (i + 0.5) * Lz / nT;
        B.torch(-hx + 0.75, 4, z, Math.PI / 2, i % 2 === 0); B.torch(hx - 0.75, 4, z, -Math.PI / 2, i % 2 === 1);
        if (i % 2) { B.banner(-hx + 0.72, 6.2, z + 3, Math.PI / 2, null, 1.4, 3); B.banner(hx - 0.72, 6.2, z - 3, -Math.PI / 2, null, 1.4, 3); }
      }
    } else {
      DG.rectShell(B, W, Lz, H, o.floor !== false);
      // une stèle porte le panneau de consigne (sauf si le thème a mis un mur derrière)
      if (!(B.theme && B.theme.signWall)) B.box('trim', -7.5, 1.9, -hz + 0.55, 5.6, 3.8, 0.4, 0, true);
    }
    const ent = DG.door(B, 0, -hz, Math.PI, { open: true });
    const exits = [DG.door(B, 0, hz, 0)];
    if (o.decor !== false) { if (B.theme && B.theme.roomDecor) B.theme.roomDecor(B, W, Lz, H, DG.api); else roomDecor(B, W, Lz, H); }
    return { R: Math.hypot(hx, hz), entrance: ent, exits, spawn: { x: 0, z: -hz + 3.4, yaw: 0 }, hx, hz, H };
  }
  DG.rectRoom = rectRoom;
  // décor commun : poutres et lustres au-dessus, contreforts, vitraux, gravats dans les coins
  function roomDecor(B, W, Lz, H) {
    const hx = W / 2, hz = Lz / 2, r = B.rng || Math.random;
    const nb = Math.max(2, Math.floor(Lz / 10));
    const M = B.M || {}, walls = (M.shell || 'walls') === 'walls';
    for (let i = 0; i < nb; i++) {
      const z = -hz + (i + 0.5) * Lz / nb;
      if (!walls) continue;
      B.box('wood', 0, H - 0.2, z, W, 0.55, 0.7);
      if (i % 2 === 0) chandelier(B, 0, H - 0.5, z);
    }
    // contreforts (en saillie) et vitraux entre eux
    const nw = Math.max(2, Math.floor(Lz / 7));
    const glass = ['#c9302a', '#2a6ac9', '#d8b04a', '#3ac95a', '#a04ad8'];
    for (let i = 1; i < nw; i++) {
      const z = -hz + i * Lz / nw;
      for (const sx of [-1, 1]) {
        if (walls) B.box('trim', sx * (hx - 0.55), H / 2, z, 1.1, H, 1.2, 0, true);
        if (i < nw - 1) { const zg = z + Lz / nw / 2;
          if (!walls) { if (M.voidm) DG.crystalCluster(B, sx * (hx - 2.2), zg, 0.8); else if (M.lava) B.prop(sx * (hx - 2.4), zg, false); else if (M.snow) B.prop(sx * (hx - 2.4), zg, false); }
          else B.stained(sx * (hx - 0.7), 5.6, zg, sx > 0 ? -Math.PI / 2 : Math.PI / 2, glass[(i + (sx > 0 ? 2 : 0)) % glass.length]); }
      }
    }
    // gravats dans les coins
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      for (let k = 0; k < 5; k++) { const s = 0.3 + r() * 0.5; B.add('wall', BOX, cx * (hx - 1.6 - r() * 1.5), s / 2, cz * (hz - 2.5 - r() * 1.5), r() * 3, r(), r(), s, s * 0.7, s); }
    }
  }
  // lustre suspendu : cercle de fer, bougies
  function chandelier(B, x, y, z) {
    const ring = new THREE.TorusGeometry(1.1, 0.07, 6, 18); ring.rotateX(Math.PI / 2); B.add('metal', ring, x, y - 2.2, z); ring.dispose();
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; B.chain(x + Math.cos(a) * 0.9, y, z + Math.sin(a) * 0.9, 2.2); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, c = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6); B.add('trim', c, x + Math.cos(a) * 1.1, y - 2.0, z + Math.sin(a) * 1.1); c.dispose(); B.flame(x + Math.cos(a) * 1.1, y - 1.75, z + Math.sin(a) * 1.1, 0.35, i === 0); }
  }

  /* =====================================================================
     1. LES LEVIERS DU PONT-LEVIS — 4 cristaux à allumer ; chaque levier en bascule plusieurs
     ===================================================================== */
  DG.PUZZLES.leviers = {
    n: 'Les leviers du gardien', d: 'Allume les 4 cristaux : chaque levier en bascule plusieurs',
    hint: 'Énigme : allume les 4 cristaux au-dessus des portes. Attention, chaque levier en bascule plusieurs à la fois !',
    layout(B, room, rng) {
      const Lr = rectRoom(B, 28, 36);
      // galerie des cristaux (socles devant le mur nord)
      const cx = [-9, -3, 3, 9], cz = Lr.hz - 4;
      cx.forEach(x => { B.pillar(x, cz, 0.6, 2.4, { cap: true, obstacle: false }); });
      // matrice : chaque levier bascule son cristal et parfois des voisins ; état de départ = solution aléatoire « défaite »
      const M = [0, 1, 2, 3].map(i => [0, 1, 2, 3].map(j => i === j || rng() < 0.38));
      let x; do { x = [0, 1, 2, 3].map(() => rng() < 0.5); } while (!x.some(Boolean) || x.filter(Boolean).length < 2);
      const s0 = [true, true, true, true];
      x.forEach((on, i) => { if (on) M[i].forEach((b, j) => { if (b) s0[j] = !s0[j]; }); });
      if (s0.every(Boolean)) { M[0].forEach((b, j) => { if (b) s0[j] = !s0[j]; }); }
      B.box('trim', 0, 0.04, -2, 20, 0.08, 4.6);
      Lr.rewardAt = new V3(0, 0, 7.5); Lr.rewardW = 13;
      Lr.data = { M, s0, cx, cz, lx: [7.5, 2.5, -2.5, -7.5], lz: -2 };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S; const st = D.s0.slice();
      P.cr = D.cx.map((x, i) => { const c = DG.crystal(S.scene, new V3(x, 3.5, D.cz), '#5ad1ff', 0.6); c.set(st[i]); return c; });
      P.lv = D.lx.map((x, i) => DG.lever(S.scene, new V3(x, 0.08, D.lz), 0, ['#c9302a', '#2a8ac9', '#d8b04a', '#3ac95a'][i]));
      P.sign = DG.sign(S.scene, new V3(-7.5, 3.3, -S.env.layout.hz + 0.8), 0, [{ t: 'LES LEVIERS DU GARDIEN', s: 64, c: '#ffd76a' }, { t: 'Allume les quatre cristaux.', s: 44 }, { t: 'Chaque levier en bascule plusieurs…', s: 38, c: '#cfc2a0' }], 5, 2.2);
      D.lx.forEach((x, i) => P.use({ id: 'l' + i, title: 'Levier ' + (i + 1), pos: new V3(x, 0, D.lz), r: 1.9, col: '#5ad1ff', label: () => 'Basculer le levier', act() {
        if (P.solved) return;
        P.lv[i].set(!P.lv[i].on); BR.Audio.fx('parry', { g: 0.5, rate: 0.8 });
        D.M[i].forEach((b, j) => { if (b) { st[j] = !st[j]; P.cr[j].set(st[j]); S.fx.burst(P.cr[j].m.position.clone(), { n: 12, color: st[j] ? 0x5ad1ff : 0x444444, speed: 3, life: 0.4 }); } });
        if (st.every(Boolean)) P.solve(1);
      } }));
    },
    update(P, dt, t) { if (P.cr) P.cr.forEach(c => c.tick(dt, t)); },
    dispose(P) { (P.cr || []).forEach(c => c.dispose()); (P.lv || []).forEach(l => l.dispose()); if (P.sign) P.sign.dispose(); },
  };

  /* =====================================================================
     2. LE GOUFFRE — plateformes fixes, mobiles et friables au-dessus du vide
     ===================================================================== */
  DG.PUZZLES.gouffre = {
    n: 'Le gouffre sans fond', d: 'Traverse le gouffre de plateforme en plateforme', win: 'GOUFFRE TRAVERSÉ', winSub: 'Personne n\'a vu le fond… tant mieux',
    hint: 'Traverse le gouffre ! Les plateformes fissurées s\'effondrent, les autres bougent. Espace pour sauter, deux fois pour un double saut.',
    layout(B, room, rng) {
      const W = 28, Lz = 66, hx = W / 2, hz = Lz / 2;
      const Lr = rectRoom(B, W, Lz, { floor: false });
      // berges : entrée et sortie
      B.floorRect(-hx, -hz, hx, -hz + 9); B.floorRect(-hx, hz - 12, hx, hz);
      B.box('trim', 0, -0.2, -hz + 9, W, 0.4, 0.6); B.box('trim', 0, -0.2, hz - 12, W, 0.4, 0.6);
      // le fond du gouffre : lueur rouge très loin en bas
      B.box('dark', 0, -40, 0, W, 2, Lz - 20);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(W, Lz - 21), new THREE.MeshBasicMaterial({ color: L('#ff4a1a').multiplyScalar(0.5), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = -38.9; B.g.add(glow); B.disposables.push(glow.geometry, glow.material);
      const plats = [];
      const stone = (x, z, w, d, y, kind) => {
        const top = y || 0;
        if (kind === 'move' || kind === 'crumble') {
          const m = new THREE.Mesh(BOX, kind === 'crumble' ? B.mats.wood : B.mats.trim); m.scale.set(w, 0.8, d); m.position.set(x, top - 0.4, z); m.castShadow = true; m.receiveShadow = true; B.g.add(m);
          const s = B.solid(x, z, w / 2, d / 2, 0, top - 0.8, top, { mv: kind === 'move' ? { x: 0, y: 0, z: 0 } : null, crumble: kind === 'crumble' });
          plats.push({ kind, m, s, x0: x, z0: z, top });
          if (kind === 'crumble') { for (let i = 0; i < 3; i++) { const cr = new THREE.Mesh(BOX, B.mats.dark); cr.scale.set(0.06, 0.82, d * 0.8); cr.position.set((i - 1) * w / 3.5, 0, 0); cr.rotation.y = (i - 1) * 0.3; m.add(cr); } }
          return s;
        }
        B.box('trim', x, top - 15, z, w, 30, d, 0, true);
        B.add('trim', BOX, x, top + 0.05, z, 0, 0, 0, w + 0.2, 0.1, d + 0.2);
        return null;
      };
      // un parcours tiré au sort parmi des variantes (même graine pour tous)
      const v = Math.floor(rng() * 3);
      let z = -hz + 12.5;
      const xs = v === 0 ? [-4, 3, -2] : v === 1 ? [4, -3, 1] : [0, -5, 4];
      stone(xs[0], z, 3.4, 3.4); z += 5.6; stone(xs[1], z, 3, 3); z += 5.4;
      // plateforme mobile (de gauche à droite)
      stone(0, z, 3.8, 3.8, 0, 'move'); plats[plats.length - 1].ax = 'x'; plats[plats.length - 1].amp = 8; plats[plats.length - 1].per = 4.2; z += 6;
      stone(xs[2], z, 3, 3, 1.4); z += 5.2;                          // marche haute : il faut sauter
      // rangée friable
      for (let i = 0; i < 3; i++) { stone((i - 1) * 4.2 * (v === 1 ? -1 : 1), z, 2.6, 2.6, 0, 'crumble'); z += 3.7; }
      z += 1.6; stone(v === 2 ? 5 : -5, z, 3.2, 3.2); z += 5.8;
      // ascenseur (monte et descend)
      stone(0, z, 3.6, 3.6, 0, 'move'); Object.assign(plats[plats.length - 1], { ax: 'y', amp: 2.2, per: 3.6 }); z += 5.4;
      stone(rng() < 0.5 ? -3 : 3, z, 3, 3, 1.2);
      Lr.rewardAt = new V3(0, 0, hz - 6.5); Lr.rewardW = 13;
      Lr.data = { plats, goalZ: hz - 11.5 };
      // le moteur interroge le sol : on ajoute les berges comme « sol »
      return Lr;
    },
    start(P) {
      const D = P.data; P.reached = false;
      P.sign = DG.sign(P.S.scene, new V3(-7.5, 3.3, -P.S.env.layout.hz + 0.8), 0, [{ t: 'LE GOUFFRE SANS FOND', s: 64, c: '#ffd76a' }, { t: 'Saute de pierre en pierre.', s: 44 }, { t: 'Le bois fissuré ne tient pas longtemps !', s: 38, c: '#cfc2a0' }], 5, 2.2);
      D.plats.forEach(p => { p.t = 0; p.fall = 0; });
    },
    update(P, dt, t) {
      const D = P.data, S = P.S, me = S.me;
      D.plats.forEach(p => {
        if (p.kind === 'move') {
          const ph = Math.sin(t / p.per * Math.PI * 2), nx = p.ax === 'x' ? p.x0 + ph * p.amp : p.x0, ny = p.ax === 'y' ? p.top + (ph * 0.5 + 0.5) * p.amp : p.top, nz = p.z0;
          const s = p.s; s.mv.x = nx - s.x; s.mv.z = nz - s.z; s.mv.y = ny - s.y1;
          s.x = nx; s.z = nz; s.y0 = ny - 0.8; s.y1 = ny; p.m.position.set(nx, ny - 0.4, nz);
        } else if (p.kind === 'crumble') {
          const s = p.s, on = me.gs === s && me.pos.y - (me.gy || 0) < 0.1;
          if (p.fall > 0) { p.fall += dt; p.m.position.y = p.top - 0.4 - p.fall * p.fall * 18; if (p.fall > 3) { p.fall = 0; p.t = 0; s.off = false; p.m.position.set(p.x0, p.top - 0.4, p.z0); p.m.visible = true; } else if (p.fall > 1.2) p.m.visible = false; }
          else if (on || p.t > 0) { p.t += dt; p.m.position.x = p.x0 + Math.sin(t * 60) * 0.05 * Math.min(1, p.t * 3); if (p.t > 0.55) { p.fall = 0.001; s.off = true; BR.Audio.fx('land', { g: 0.5, rate: 0.7 }); S.fx.burst(new V3(p.x0, p.top, p.z0), { n: 18, color: 0x8a6a40, speed: 4, life: 0.6 }); } }
        }
      });
      if (!P.solved && me.alive && me.pos.z > D.goalZ && isFinite(me.gy == null ? 0 : me.gy) && me.pos.y > -1) P.solve(1);
    },
    dispose(P) { if (P.sign) P.sign.dispose(); },
  };
})();

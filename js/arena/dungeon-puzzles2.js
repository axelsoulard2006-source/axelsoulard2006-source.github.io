/* ===== arena/dungeon-puzzles2.js : d'autres énigmes de la Citadelle =====
   la clé du geôlier (coffres et mimiques), le couloir des lames, les braseros, la mémoire des dalles,
   les miroirs, le chemin piégé. */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, DG = BR.Dungeon;
  const L = c => new THREE.Color(c).convertSRGBToLinear();
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const rect = (B, W, Lz, o) => DG.rectRoom(B, W, Lz, o);
  const signAt = (P, lines) => DG.sign(P.S.scene, new V3(-7.5, 3.3, -P.S.env.layout.hz + 0.8), 0, lines, 5, 2.2);

  // blessure du joueur local (pièges) : dégâts, recul, petit flash rouge
  function hurtMe(P, k, dir, up) {
    const S = P.S, me = S.me; if (!me.alive || me.inv > 0) return false;
    const dmg = Math.max(1, Math.round(me.maxHp * k)); me.hp = Math.max(1, me.hp - dmg); me.inv = 0.9;
    if (dir) { me.vel.x = dir.x * 13; me.vel.z = dir.z * 13; me.vel.y = up == null ? 7 : up; }
    S.fx.num(me.center(), '-' + dmg, { color: '#ff6a6a' }); BR.Audio.fx('hurt'); BR.Arena.shake(0.35); if (S.flash) S.flash.setRGB(0.35, 0, 0);
    try { me.play('Hit_A', 1.4); } catch (e) { /* rien */ }
    return true;
  }
  DG.hurtMe = hurtMe;
  const fighterOf = (S, id) => S.fighters.get(id);

  /* ---------- coffre (procédural) : couvercle qui s'ouvre ; un mimique montre ses dents ---------- */
  function chestMesh(scene, pos, ry) {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = ry || 0; scene.add(g);
    const wood = new THREE.MeshStandardMaterial({ color: L('#7a4f2a'), roughness: 0.8 }), band = new THREE.MeshStandardMaterial({ color: L('#c9a24a'), roughness: 0.35, metalness: 0.85 });
    const body = new THREE.Mesh(BOX, wood); body.scale.set(1.5, 0.8, 1); body.position.y = 0.4; body.castShadow = true; g.add(body);
    const lidG = new THREE.Group(); lidG.position.set(0, 0.8, -0.5); g.add(lidG);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 12, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.rotation.y = 0; lid.position.set(0, 0, 0.5); lid.castShadow = true; lidG.add(lid);
    for (const x of [-0.55, 0.55]) { const b = new THREE.Mesh(BOX, band); b.scale.set(0.1, 0.82, 1.04); b.position.set(x, 0.4, 0); g.add(b); }
    const lock = new THREE.Mesh(BOX, band); lock.scale.set(0.22, 0.26, 0.08); lock.position.set(0, 0.7, 0.52); g.add(lock);
    // dents (cachées tant que ce n'est pas un mimique ouvert)
    const teeth = new THREE.Group(); teeth.visible = false; g.add(teeth);
    const tm = new THREE.MeshStandardMaterial({ color: 0xf4f0e0, roughness: 0.5 }), tg = new THREE.ConeGeometry(0.07, 0.22, 4);
    for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(tg, tm); t.position.set(-0.6 + i * 0.17, 0.92, 0.45); t.rotation.x = Math.PI; teeth.add(t); const t2 = new THREE.Mesh(tg, tm); t2.position.set(-0.52 + i * 0.17, 0.72, 0.45); teeth.add(t2); }
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), new THREE.MeshStandardMaterial({ color: 0xc8304a, roughness: 0.5 })); tongue.scale.set(1.4, 0.3, 1); tongue.position.set(0, 0.82, 0.2); teeth.add(tongue);
    let open = 0, want = 0, chomp = 0;
    return { g, open(mimic) { want = 1; if (mimic) { teeth.visible = true; chomp = 2.2; } },
      tick(dt, t) { open += (want - open) * Math.min(1, dt * 8); let a = -open * 1.9; if (chomp > 0) { chomp -= dt; a = -0.5 - Math.abs(Math.sin(t * 18)) * 0.9; g.position.y = pos.y + Math.abs(Math.sin(t * 9)) * 0.25; } else g.position.y = pos.y; lidG.rotation.x = a; },
      dispose() { scene.remove(g); [wood, band, tm, tongue.material].forEach(m => m.dispose()); lid.geometry.dispose(); tg.dispose(); tongue.geometry.dispose(); } };
  }
  // la clé dorée
  function keyMesh(scene) {
    const g = new THREE.Group(); scene.add(g);
    const m = new THREE.MeshStandardMaterial({ color: L('#ffd76a'), roughness: 0.25, metalness: 0.95, emissive: L('#6a4a08') });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), m); ring.position.y = 0.45; g.add(ring);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), m); stem.position.y = 0; g.add(stem);
    for (let i = 0; i < 2; i++) { const t = new THREE.Mesh(BOX, m); t.scale.set(0.18, 0.08, 0.05); t.position.set(0.1, -0.2 - i * 0.13, 0); g.add(t); }
    return { g, dispose() { scene.remove(g); m.dispose(); ring.geometry.dispose(); stem.geometry.dispose(); } };
  }

  /* =====================================================================
     3. LA CLÉ DU GEÔLIER — trois coffres en hauteur : un seul contient la clé, les autres mordent
     ===================================================================== */
  const MIMIC = ['C\'était un mimique ! Il a un faible pour les mollets.', 'Un coffre qui mord… le geôlier a de l\'humour.', 'Aïe ! Ce coffre n\'avait pas mangé depuis 300 ans.', 'Mauvais coffre. Il garde ton doigt en souvenir.'];
  DG.PUZZLES.cle = {
    n: 'La clé du geôlier', d: 'Trouve la clé parmi les coffres… sans te faire mordre', win: 'SERRURE OUVERTE', winSub: 'Le geôlier n\'a plus qu\'à bien se tenir',
    hint: 'Énigme : la clé de la serrure est dans un des coffres perchés. Les autres sont des mimiques… ils mordent !',
    layout(B, room, rng) {
      const Lr = rect(B, 30, 40), hx = 15;
      // balcon ouest (3,6 m) et son escalier de caisses
      B.box('wall', -12.7, 1.8, 3, 4.6, 3.6, 18, 0, true); B.add('trim', BOX, -12.7, 3.65, 3, 0, 0, 0, 4.8, 0.12, 18.2);
      B.crate(-7, -9, 1.3, 0.1, true); B.box('wood', -9.6, 1.2, -9, 2.4, 2.4, 2.4, 0, true);
      B.add('metal', BOX, -9.6, 2.42, -9, 0, 0, 0, 2.45, 0.1, 2.45);
      // tour est : trois caisses de plus en plus hautes
      B.crate(7.5, -5, 1.3, 0, true); B.box('wood', 10.4, 1.2, -2.2, 2.4, 2.4, 2.4, 0.2, true); B.box('trim', 12.3, 1.8, 2, 3, 3.6, 3, 0, true); B.add('trim', BOX, 12.3, 3.65, 2, 0, 0, 0, 3.2, 0.12, 3.2);
      // estrade de la serrure, devant la porte du milieu
      B.box('trim', 0, 0.5, Lr.hz - 5, 3, 1, 2, 0, true);
      for (let i = 0; i < 4; i++) B.barrel(-hx + 1.6 + rng() * 1.4, Lr.hz - 4 - i * 1.2, true);
      const spots = [{ x: -13, y: 3.6, z: 9, ry: Math.PI / 2 }, { x: 12.3, y: 3.6, z: 2, ry: -Math.PI / 2 }, { x: 5.5, y: 0, z: 12, ry: Math.PI }];
      Lr.rewardAt = new V3(0, 0, 4); Lr.rewardW = 10;
      Lr.data = { spots, key: Math.floor(rng() * 3), lockAt: new V3(0, 1, Lr.hz - 5) };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S; P.holder = null;
      P.sign = signAt(P, [{ t: 'LA CLÉ DU GEÔLIER', s: 64, c: '#ffd76a' }, { t: 'Une clé, trois coffres.', s: 44 }, { t: 'Les deux autres ont faim.', s: 38, c: '#cfc2a0' }]);
      P.chests = D.spots.map((sp, i) => {
        const c = chestMesh(S.scene, new V3(sp.x, sp.y, sp.z), sp.ry); c.done = false;
        P.use({ id: 'c' + i, title: 'Coffre', pos: new V3(sp.x, sp.y, sp.z), r: 2.1, col: '#ffd76a', label: () => 'Ouvrir le coffre', act(mine, from) {
          if (c.done) return; c.done = true;
          if (i === D.key) {
            c.open(false); P.holder = from; BR.Audio.fx('reveal', { rate: 1.3 });
            if (mine) P.banner('LA CLÉ !', 'Apporte-la à la serrure, devant les portes', 2, 'gold');
            else P.say((fighterOf(S, from) || {}).name + ' a trouvé la clé !');
          } else {
            c.open(true); BR.Audio.fx('parry', { rate: 0.6 });
            if (mine) { hurtMe(P, 0.06, new V3(Math.sin(sp.ry + Math.PI), 0, Math.cos(sp.ry + Math.PI)), 6); P.say(MIMIC[Math.floor(Math.random() * MIMIC.length)]); }
          }
        } });
        return c;
      });
      P.key = keyMesh(S.scene); P.key.g.visible = false;
      P.lockM = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16), new THREE.MeshStandardMaterial({ color: L('#ffd76a'), metalness: 0.9, roughness: 0.3, emissive: L('#3a2a08') })); P.lockM.rotation.x = Math.PI / 2; P.lockM.position.set(D.lockAt.x, 1.6, D.lockAt.z); S.scene.add(P.lockM);
      P.use({ id: 'lock', title: 'Serrure', pos: new V3(D.lockAt.x, 1, D.lockAt.z), r: 2.4, col: '#ffd76a', label: () => P.holder === S.selfId ? 'Tourner la clé' : P.holder ? 'C\'est ' + ((fighterOf(S, P.holder) || {}).name || 'un autre') + ' qui a la clé' : 'Il faut d\'abord trouver la clé', act(mine, from) {
        if (P.holder !== from) { if (mine) BR.Audio.ui('error'); return; }
        P.holder = null; P.key.g.visible = false; BR.Audio.fx('levelup', { g: 0.4 }); P.solve(1);
      } });
    },
    update(P, dt, t) {
      (P.chests || []).forEach(c => c.tick(dt, t));
      if (P.key) {
        const f = P.holder && fighterOf(P.S, P.holder);
        P.key.g.visible = !!f && !P.solved;
        if (f) { P.key.g.position.set(f.pos.x, f.pos.y + 3.1 + Math.sin(t * 3) * 0.1, f.pos.z); P.key.g.rotation.y += dt * 3; }
      }
      if (P.lockM) P.lockM.rotation.z += dt * (P.holder ? 2 : 0.2);
    },
    dispose(P) { (P.chests || []).forEach(c => c.dispose()); if (P.key) P.key.dispose(); if (P.sign) P.sign.dispose(); if (P.lockM) { P.S.scene.remove(P.lockM); P.lockM.geometry.dispose(); P.lockM.material.dispose(); } },
  };

  /* =====================================================================
     4. LE COULOIR DES LAMES — haches pendulaires, pics qui sortent du sol, jets de flammes
     ===================================================================== */
  DG.PUZZLES.lames = {
    n: 'Le couloir des lames', d: 'Traverse le couloir sans te faire hacher', win: 'COULOIR TRAVERSÉ', winSub: 'Tous tes membres sont encore là',
    hint: 'Traverse le couloir ! Observe le rythme des lames et des pics avant de foncer. L\'esquive (Maj) aide beaucoup.',
    layout(B, room, rng) {
      const Lr = rect(B, 26, 64), hz = Lr.hz;
      // poutres du plafond qui portent les haches
      const zs = [-16, -2, 12], blades = [], spikes = [], jets = [];
      // le passage piégé est étroit (les lames balaient toute sa largeur)
      B.wall(-6.6, -21, -6.6, 23, 4.6, 0.9); B.wall(6.6, -21, 6.6, 23, 4.6, 0.9);
      zs.forEach((z, i) => { B.box('wood', 0, 10.2, z, 26, 0.7, 0.8); blades.push({ z, ph: rng() * 6.28, sp: 1.6 + i * 0.25 + rng() * 0.3, A: 1.15 }); });
      // champs de pics
      [[-10, -6.5], [4, 7.5], [17, 21]].forEach(([z0, z1], i) => { spikes.push({ z0, z1, ph: rng() * 3, per: 2.6 + i * 0.3 }); B.box('metal', 0, 0.02, (z0 + z1) / 2, 12.2, 0.04, z1 - z0); });
      // buses de flammes dans les murs
      [-12.5, 9, 15.5].forEach((z, i) => { const side = i % 2 ? 1 : -1; jets.push({ z, side, ph: rng() * 3, per: 3.2 }); B.box('metal', side * 6.1, 1.2, z, 0.5, 0.9, 0.9); });
      Lr.rewardAt = new V3(0, 0, hz - 6); Lr.rewardW = 12;
      Lr.data = { blades, spikes, jets, goalZ: hz - 9 };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S;
      P.sign = signAt(P, [{ t: 'LE COULOIR DES LAMES', s: 64, c: '#ffd76a' }, { t: 'Observe le rythme…', s: 44 }, { t: '…puis fonce.', s: 40, c: '#cfc2a0' }]);
      const metal = new THREE.MeshStandardMaterial({ color: L('#8a8e96'), roughness: 0.25, metalness: 0.9 }), chainM = new THREE.MeshStandardMaterial({ color: L('#3a3a40'), roughness: 0.5, metalness: 0.8 });
      P.mats = [metal, chainM];
      D.blades.forEach(b => {
        const g = new THREE.Group(); g.position.set(0, 9.8, b.z); S.scene.add(g);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7.6, 6), chainM); rod.position.y = -3.8; g.add(rod);
        const head = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.18, 24, 1, false, -Math.PI / 2, Math.PI), metal); head.rotation.x = Math.PI / 2; head.rotation.z = Math.PI / 2; head.position.y = -8.1; head.castShadow = true; g.add(head);
        b.g = g; b.geos = [rod.geometry, head.geometry];
      });
      D.spikes.forEach(sp => {
        const g = new THREE.Group(); S.scene.add(g); const cg = new THREE.ConeGeometry(0.16, 0.9, 5);
        for (let x = -5.6; x <= 5.6; x += 1.12) for (let z = sp.z0 + 0.4; z <= sp.z1 - 0.3; z += 1.1) { const c = new THREE.Mesh(cg, metal); c.position.set(x, 0, z); g.add(c); }
        sp.g = g; sp.cg = cg; sp.up = 0;
      });
      D.jets.forEach(j => { j.on = false; });
    },
    update(P, dt, t) {
      const D = P.data, S = P.S, me = S.me, mp = me.pos;
      D.blades.forEach(b => {
        if (!b.g) return;
        const th = Math.sin(t * b.sp + b.ph) * b.A; b.g.rotation.z = th;
        const tx = Math.sin(th) * 8.1, ty = 9.8 - Math.cos(th) * 8.1;
        if (me.alive && Math.abs(mp.z - b.z) < 0.9 && Math.hypot(mp.x - tx, (mp.y + 0.9) - ty) < 1.7) {
          const dir = new V3(Math.sign(mp.x - tx) || 1, 0, -1).normalize(); hurtMe(P, 0.1, dir, 6);
        }
      });
      D.spikes.forEach(sp => {
        if (!sp.g) return;
        const c = ((t + sp.ph) % sp.per) / sp.per, want = c > 0.62 ? 1 : c > 0.5 ? 0.25 : 0;
        if (want > sp.up && want === 1 && sp.up < 0.5) BR.Audio.fx('parry', { g: 0.25, rate: 1.4 });
        sp.up += (want - sp.up) * Math.min(1, dt * (want > sp.up ? 22 : 6)); sp.g.position.y = -0.95 + sp.up * 0.95;
        if (sp.up > 0.8 && me.alive && mp.z > sp.z0 && mp.z < sp.z1 && mp.y - (me.gy || 0) < 0.4) hurtMe(P, 0.08, new V3(0, 0, -1), 9);
      });
      D.jets.forEach(j => {
        const c = ((t + j.ph) % j.per) / j.per, on = c > 0.6;
        if (on && Math.random() < dt * 60) S.fx.spark(new V3(j.side * 5.9, 1.2, j.z), new V3(-j.side * (9 + Math.random() * 5), (Math.random() - 0.3) * 1.5, (Math.random() - 0.5) * 1.5), { color: 0xff7a2a, life: 0.55, size: 0.5 });
        if (on && !j.on) BR.Audio.fx('fire', { g: 0.35 });
        j.on = on;
        if (on && me.alive && Math.abs(mp.z - j.z) < 1.1 && mp.y < 2.2 && c > 0.64) hurtMe(P, 0.07, new V3(0, 0, -1), 5);
      });
      if (!P.solved && me.alive && mp.z > D.goalZ) P.solve(1);
    },
    dispose(P) {
      const D = P.data, S = P.S;
      D.blades.forEach(b => { if (b.g) { S.scene.remove(b.g); b.geos.forEach(g => g.dispose()); } });
      D.spikes.forEach(sp => { if (sp.g) { S.scene.remove(sp.g); sp.cg.dispose(); } });
      (P.mats || []).forEach(m => m.dispose()); if (P.sign) P.sign.dispose();
    },
  };

  /* =====================================================================
     5. LES BRASEROS — à allumer du plus petit au plus grand… mais chaque nombre est un petit calcul
     ===================================================================== */
  const EXPR = { 1: ['3 − 2', '√1', '7 ÷ 7', '2⁰', '0,5 × 2'], 2: ['√4', '6 ÷ 3', '1 + 1', '2¹', '10 − 8'], 3: ['9 ÷ 3', '√9', '1 + 2', '6 × 0,5', '15 ÷ 5'], 4: ['2²', '√16', '8 ÷ 2', '2 × 2', '12 ÷ 3'], 5: ['10 ÷ 2', '√25', '2 + 3', '0,5 × 10', '25 ÷ 5'] };
  DG.PUZZLES.braseros = {
    n: 'Les braseros du savant', d: 'Allume les braseros dans l\'ordre croissant des calculs', win: 'LES FLAMMES CHANTENT', winSub: 'Le savant serait fier de toi',
    hint: 'Énigme : allume les 5 braseros du plus petit au plus grand résultat. Une erreur et tout s\'éteint !',
    layout(B, room, rng) {
      const Lr = rect(B, 28, 34);
      const vals = BR.shuffle([1, 2, 3, 4, 5], rng), pos = [], exprs = [];
      vals.forEach((v, i) => { const a = (i - 2) * 0.55, x = Math.sin(a) * 9, z = 4 - Math.cos(a) * 9 + 6; pos.push(new V3(x, 0, z)); const L2 = EXPR[v]; exprs.push(L2[Math.floor(rng() * L2.length)]); });
      const flames = pos.map(p => DG.brazier(B, p.x, p.z, true));
      flames.forEach(F => { F.sp.visible = false; });
      Lr.rewardAt = new V3(0, 0, -4); Lr.rewardW = 12;
      Lr.data = { vals, pos, exprs, flames };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S; let next = 1;
      P.sign = signAt(P, [{ t: 'LES BRASEROS DU SAVANT', s: 60, c: '#ffd76a' }, { t: 'Du plus petit au plus grand.', s: 44 }, { t: 'Une erreur, et tout s\'éteint.', s: 38, c: '#cfc2a0' }]);
      P.tabs = D.pos.map((p, i) => DG.sign(S.scene, new V3(p.x, 1.25, p.z - 1.35), Math.PI, [{ t: D.exprs[i], s: 150, c: '#ffe9a8' }], 1.6, 1.1));
      const light = (i, on) => { D.flames[i].sp.visible = on; };
      D.pos.forEach((p, i) => P.use({ id: 'b' + i, title: 'Brasero', pos: p, r: 2.3, col: '#ffa24a', label: () => D.flames[i].sp.visible ? 'Déjà allumé' : 'Allumer', act(mine) {
        if (P.solved || D.flames[i].sp.visible) return;
        if (D.vals[i] === next) { light(i, true); next++; BR.Audio.fx('fire', { g: 0.6 }); S.fx.burst(p.clone().setY(2), { n: 26, color: 0xffa040, speed: 5, life: 0.6 }); if (next > 5) P.solve(1); }
        else {
          next = 1; D.flames.forEach((_, k) => light(k, false)); BR.Audio.fx('parry', { g: 0.5, rate: 0.5 });
          D.pos.forEach(q => S.fx.burst(q.clone().setY(1.8), { n: 14, color: 0x666666, speed: 3, life: 0.8 }));
          if (mine) P.say('Pfffff… mauvais ordre, tout s\'est éteint. Recommence !');
        }
      } }));
    },
    dispose(P) { (P.tabs || []).forEach(t => t.dispose()); if (P.sign) P.sign.dispose(); },
  };

  /* =====================================================================
     6. LA MÉMOIRE DES DALLES — le cristal montre une suite de dalles, il faut la refaire en marchant dessus
     ===================================================================== */
  const GLY = ['⚙', '▲', '●', '■', '◆', '✚'], GCOL = ['#ff5a5a', '#5ad1ff', '#7dff9a', '#ffd84a', '#c58aff', '#ff9a3a'];
  DG.PUZZLES.simon = {
    n: 'La mémoire des dalles', d: 'Refais la suite montrée par le cristal en marchant sur les dalles', win: 'MÉMOIRE D\'ÉLÉPHANT', winSub: 'Trois suites sans faute',
    hint: 'Énigme : regarde le cristal montrer une suite de dalles, puis marche dessus dans le même ordre. 3 manches !',
    layout(B, room, rng) {
      const Lr = rect(B, 28, 34);
      const tiles = GLY.map((_, i) => { const a = i / 6 * Math.PI * 2, x = Math.sin(a) * 6.5, z = 2 + Math.cos(a) * 6.5; return new V3(x, 0, z); });
      B.pillar(0, 2, 0.7, 2.2, { obstacle: true });
      const seq = []; for (let i = 0; i < 5; i++) seq.push(Math.floor(rng() * 6));
      Lr.rewardAt = new V3(0, 0, 11); Lr.rewardW = 12;
      Lr.data = { tiles, seq };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S;
      P.sign = signAt(P, [{ t: 'LA MÉMOIRE DES DALLES', s: 62, c: '#ffd76a' }, { t: 'Regarde le cristal…', s: 44 }, { t: '…et refais la suite.', s: 40, c: '#cfc2a0' }]);
      P.cr = DG.crystal(S.scene, new V3(0, 3.4, 2), '#ffffff', 0.7);
      P.tm = D.tiles.map((p, i) => {
        const tex = DG.textTex([{ t: GLY[i], s: 300, c: '#ffffff' }], { w: 512, h: 512, bg: '#1a1814', border: GCOL[i] });
        const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: L(GCOL[i]), emissiveIntensity: 0.08, roughness: 0.6 });
        const m = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 3), mat); m.position.set(p.x, 0.06, p.z); m.receiveShadow = true; S.scene.add(m);
        return { m, mat, tex, glow: 0 };
      });
      P.round = 0; P.inp = 0; P.phase = 'wait'; P.pt = 1.8; P.inside = -1;
    },
    net(P, from, d) { if (d.e === 'step') stepTile(P, d.i, from === P.S.selfId); },
    update(P, dt, t) {
      const D = P.data, S = P.S, me = S.me;
      P.tm.forEach((T, i) => { T.glow = Math.max(0, T.glow - dt * 2.2); T.mat.emissiveIntensity = 0.08 + T.glow * 1.8; T.m.position.y = 0.06 - T.glow * 0.05; });
      P.cr.tick(dt, t);
      if (P.solved) return;
      const len = 3 + P.round;
      if (P.phase === 'wait') { P.pt -= dt; if (P.pt <= 0) { P.phase = 'show'; P.si = 0; P.pt = 0.2; P.cr.set(true); } }
      else if (P.phase === 'show') {
        P.pt -= dt;
        if (P.pt <= 0) {
          if (P.si >= len) { P.phase = 'input'; P.inp = 0; P.cr.set(false); if (P.round === 0) P.say('À toi ! Marche sur les dalles dans le même ordre.'); }
          else { const k = D.seq[P.si]; P.tm[k].glow = 1; BR.Audio.fx('reveal', { rate: 0.8 + k * 0.12, g: 0.5 }); P.cr.m.material.emissive.copy(L(GCOL[k])); P.si++; P.pt = 0.75; }
        }
      }
      // ma dalle : entrée = un pas
      let cur = -1; D.tiles.forEach((p, i) => { if (Math.abs(me.pos.x - p.x) < 1.5 && Math.abs(me.pos.z - p.z) < 1.5 && me.pos.y < 0.6) cur = i; });
      if (cur !== P.inside) { P.inside = cur; if (cur >= 0 && P.phase === 'input') { stepTile(P, cur, true); P.send({ e: 'step', i: cur }); } }
    },
    dispose(P) { (P.tm || []).forEach(T => { P.S.scene.remove(T.m); T.m.geometry.dispose(); T.mat.dispose(); T.tex.dispose(); }); if (P.cr) P.cr.dispose(); if (P.sign) P.sign.dispose(); },
  };
  function stepTile(P, i, mine) {
    if (P.solved || P.phase !== 'input') return;
    const D = P.data, len = 3 + P.round; P.tm[i].glow = 1;
    if (D.seq[P.inp] === i) {
      BR.Audio.fx('reveal', { rate: 0.8 + i * 0.12, g: 0.6 }); P.inp++;
      if (P.inp >= len) { P.round++; if (P.round >= 3) { P.solve(1); return; } P.phase = 'wait'; P.pt = 1.2; BR.Arena.banner('MANCHE ' + (P.round + 1), 'Une dalle de plus…', 1.2, ''); }
    } else {
      BR.Audio.ui('error'); BR.Audio.fx('parry', { rate: 0.5, g: 0.4 }); P.phase = 'wait'; P.pt = 1.5;
      if (mine) P.say('Raté ! Le cristal recommence la suite.');
    }
  }

  /* =====================================================================
     7. LES MIROIRS — oriente les miroirs pour guider le rayon jusqu'au cristal
     ===================================================================== */
  DG.PUZZLES.miroirs = {
    n: 'La salle des miroirs', d: 'Guide le rayon de lumière jusqu\'au cristal du nord', win: 'LUMIÈRE !', winSub: 'Le rayon a trouvé son chemin',
    hint: 'Énigme : tourne les miroirs (E) pour envoyer le rayon de lumière jusqu\'au cristal au-dessus des portes.',
    layout(B, room, rng) {
      const Lr = rect(B, 30, 36), C = 4, cols = [-10, -6, -2, 2, 6, 10], rows = [-8, -4, 0, 4, 8];
      // chemin : est sur la ligne r0 → miroir 1 → vers r2 → miroir 2 → est → miroir 3 → nord
      let ok = false, M = [], r0, c1, r2, c3, tries = 0;
      while (!ok && tries++ < 200) {
        r0 = Math.floor(rng() * 5); c1 = Math.floor(rng() * 3); r2 = Math.floor(rng() * 5); c3 = c1 + 1 + Math.floor(rng() * (5 - c1));
        if (r2 === r0 || c3 > 5) continue;
        const up = r2 > r0;   // les lignes vont vers le nord quand l'indice augmente
        M = [{ c: c1, r: r0, s: up ? '/' : '\\' }, { c: c1, r: r2, s: up ? '/' : '\\' }, { c: c3, r: r2, s: '/' }];
        // le chemin nord depuis le miroir 3 ne doit croiser aucun autre miroir
        ok = !M.some((m, k) => k !== 2 && m.c === c3 && m.r > r2);
      }
      // leurres
      const busy = new Set(M.map(m => m.c + ',' + m.r));
      for (let k = 0; k < 2; k++) { for (let tt = 0; tt < 40; tt++) { const c = Math.floor(rng() * 6), r = Math.floor(rng() * 5); if (busy.has(c + ',' + r)) continue; if (r === r0 && c < c1) continue; if (c === c3 && r > r2) continue; if (r === r2 && c > c1 && c < c3) continue; if (c === c1 && Math.min(r0, r2) < r && r < Math.max(r0, r2)) continue; busy.add(c + ',' + r); M.push({ c, r, s: rng() < 0.5 ? '/' : '\\', decoy: true }); break; } }
      const sol = M.map(m => m.s), start = M.map(m => rng() < 0.5 ? '/' : '\\');
      if (start.every((s, i) => s === sol[i] || M[i].decoy)) start[0] = sol[0] === '/' ? '\\' : '/';
      M.forEach(m => B.cyl(cols[m.c], rows[m.r], 0.75, -1, 2.4));
      // émetteur (mur ouest) et cristal cible (au-dessus du mur nord)
      B.box('metal', -14.2, 1.6, rows[r0], 0.8, 1.2, 1.2);
      Lr.rewardAt = new V3(0, 0, -11.5); Lr.rewardW = 13;
      Lr.data = { M, start, cols, rows, r0, c3, C };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S, st = D.start.slice();
      P.sign = signAt(P, [{ t: 'LA SALLE DES MIROIRS', s: 62, c: '#ffd76a' }, { t: 'Guide le rayon', s: 44 }, { t: 'jusqu\'au cristal du nord.', s: 40, c: '#cfc2a0' }]);
      const frame = new THREE.MeshStandardMaterial({ color: L('#c9a24a'), metalness: 0.9, roughness: 0.3 }), glass = new THREE.MeshStandardMaterial({ color: L('#cfe8ff'), metalness: 1, roughness: 0.05, emissive: L('#203040') });
      P.mats = [frame, glass];
      P.mir = D.M.map((m, i) => {
        const g = new THREE.Group(); g.position.set(D.cols[m.c], 0, D.rows[m.r]); S.scene.add(g);
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.5, 10), frame); ped.position.y = 0.25; g.add(ped);
        const pl = new THREE.Group(); pl.position.y = 1.5; g.add(pl);
        const gl = new THREE.Mesh(BOX, glass); gl.scale.set(2, 1.8, 0.12); pl.add(gl); const fr = new THREE.Mesh(BOX, frame); fr.scale.set(2.15, 1.95, 0.08); fr.position.z = -0.06; pl.add(fr);
        pl.rotation.y = st[i] === '/' ? -Math.PI / 4 : Math.PI / 4;
        P.use({ id: 'm' + i, title: 'Miroir', pos: g.position.clone(), r: 2.2, col: '#cfe8ff', label: () => 'Tourner le miroir', act() { if (P.solved) return; st[i] = st[i] === '/' ? '\\' : '/'; BR.Audio.fx('parry', { g: 0.3, rate: 1.5 }); trace(); } });
        return { g, pl, geos: [ped.geometry] };
      });
      P.target = DG.crystal(S.scene, new V3(D.cols[D.c3], 2.2, 16.4), '#ffd76a', 0.8);
      P.beamM = new THREE.MeshBasicMaterial({ color: L('#ffe9a8').multiplyScalar(2.5), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      P.beams = [];
      function trace() {
        P.beams.forEach(b => { S.scene.remove(b); }); P.beams = [];
        let c = -1, r = D.r0, dx = 1, dz = 0, x0 = -14, z0 = D.rows[D.r0], hit = false;
        const seg = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az); if (len < 0.01) return; const m = new THREE.Mesh(BOX, P.beamM); m.scale.set(0.14, 0.14, len); m.position.set((ax + bx) / 2, 1.5, (az + bz) / 2); m.rotation.y = Math.atan2(bx - ax, bz - az); S.scene.add(m); P.beams.push(m); };
        for (let k = 0; k < 40; k++) {
          c += dx; r += dz;
          if (c < 0 || c > 5 || r < 0 || r > 4) {
            const ex = dx ? (dx > 0 ? 14.2 : -14.2) : D.cols[Math.max(0, Math.min(5, c))], ez = dz ? (dz > 0 ? 17 : -17) : D.rows[Math.max(0, Math.min(4, r))];
            seg(x0, z0, dx ? ex : x0, dz ? ez : z0); hit = dz > 0 && c === D.c3; break;
          }
          const mi = D.M.findIndex(m => m.c === c && m.r === r);
          if (mi >= 0) {
            const x = D.cols[c], z = D.rows[r]; seg(x0, z0, x, z); x0 = x; z0 = z;
            const s = st[mi];
            if (s === '/') { const t = dx; dx = dz; dz = t; } else { const t = dx; dx = -dz; dz = -t; }
          }
        }
        P.target.set(hit);
        if (hit && !P.solved) setTimeout(() => { if (BR.Arena.session() === S && !P.solved) P.solve(1); }, 700);
      }
      P.trace = trace;
      // appliquer l'orientation visible quand l'état change
      const prevTrace = trace;
      P.trace = () => { prevTrace(); P.mir.forEach((m, i) => { m.pl.rotation.y = st[i] === '/' ? -Math.PI / 4 : Math.PI / 4; }); };
      P.uses.forEach(u => { if (/^m\d/.test(u.id)) { const a0 = u.act; u.act = (...a) => { a0(...a); P.trace(); }; } });
      P.trace();
    },
    update(P, dt, t) { if (P.target) P.target.tick(dt, t); if (P.beamM) P.beamM.opacity = 0.7 + Math.sin(t * 9) * 0.15; },
    dispose(P) { const S = P.S; (P.mir || []).forEach(m => { S.scene.remove(m.g); m.geos.forEach(g => g.dispose()); m.g.traverse(o => { if (o.geometry && o.geometry !== BOX) o.geometry.dispose(); }); }); (P.beams || []).forEach(b => S.scene.remove(b)); if (P.beamM) P.beamM.dispose(); (P.mats || []).forEach(m => m.dispose()); if (P.target) P.target.dispose(); if (P.sign) P.sign.dispose(); },
  };

  /* =====================================================================
     8. LE CHEMIN PIÉGÉ — des dalles au-dessus du vide ; seul un chemin tient. Il s'illumine un instant.
     ===================================================================== */
  DG.PUZZLES.dalles = {
    n: 'Le chemin piégé', d: 'Mémorise le chemin sûr au-dessus du vide', win: 'CHEMIN TROUVÉ', winSub: 'Mémoire et sang-froid',
    hint: 'Énigme : le chemin sûr s\'illumine quelques secondes au début (et quand tu tires le levier). Les autres dalles s\'effondrent !',
    layout(B, room, rng) {
      const W = 28, Lz = 54, hx = 14, hz = 27, Lr = rect(B, W, Lz, { floor: false });
      const NC = 5, NR = 8, s = 4.2, x0 = -(NC - 1) / 2 * s, z0 = -hz + 9 + s / 2, zEnd = -hz + 9 + NR * s;
      B.floorRect(-hx, -hz, hx, -hz + 9); B.floorRect(-hx, zEnd, hx, hz);
      B.box('dark', 0, -40, 0, W, 2, Lz - 18);
      // chemin : on avance d'une ligne, avec des pas de côté
      let c = Math.floor(rng() * NC); const safe = new Set();
      for (let r = 0; r < NR; r++) { safe.add(c + ',' + r); if (r < NR - 1 && rng() < 0.6) { const nc = Math.max(0, Math.min(NC - 1, c + (rng() < 0.5 ? -1 : 1))); safe.add(nc + ',' + r); c = nc; } }
      const tiles = [];
      for (let r = 0; r < NR; r++) for (let cc = 0; cc < NC; cc++) {
        const x = x0 + cc * s, z = z0 + r * s, ok = safe.has(cc + ',' + r);
        const m = new THREE.Mesh(BOX, B.mats.trim); m.scale.set(s - 0.08, 0.6, s - 0.08); m.position.set(x, -0.3, z); m.castShadow = true; m.receiveShadow = true; B.g.add(m);
        const sol = B.solid(x, z, s / 2, s / 2, 0, -0.6, 0, { crumble: !ok });
        tiles.push({ x, z, ok, m, s: sol, fall: 0 });
      }
      // bords du gouffre sur les côtés : rien ; sortie et entrée = berges
      Lr.rewardAt = new V3(0, 0, hz - 5.5); Lr.rewardW = 12;
      Lr.data = { tiles, goalZ: zEnd + 0.8, leverAt: new V3(-9, 0, -hz + 5) };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S;
      P.sign = signAt(P, [{ t: 'LE CHEMIN PIÉGÉ', s: 64, c: '#ffd76a' }, { t: 'Un seul chemin tient.', s: 44 }, { t: 'Le levier le montre à nouveau.', s: 38, c: '#cfc2a0' }]);
      P.glowM = new THREE.MeshBasicMaterial({ color: L('#7dff9a').multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      P.glows = D.tiles.filter(T => T.ok).map(T => { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), P.glowM); m.rotation.x = -Math.PI / 2; m.position.set(T.x, 0.03, T.z); S.scene.add(m); return m; });
      P.show = 4.5; P.cool = 0;
      P.lv = DG.lever(S.scene, D.leverAt.clone(), 0, '#7dff9a');
      P.use({ id: 'show', title: 'Levier de la vérité', pos: D.leverAt.clone(), r: 2, col: '#7dff9a', label: () => P.cool > 0 ? 'Le mécanisme se recharge…' : 'Montrer le chemin', act() { if (P.cool > 0) return; P.show = 3; P.cool = 9; P.lv.set(!P.lv.on); BR.Audio.fx('reveal', { g: 0.5 }); } });
    },
    update(P, dt, t) {
      const D = P.data, S = P.S, me = S.me;
      P.show = Math.max(0, P.show - dt); P.cool = Math.max(0, P.cool - dt);
      P.glowM.opacity = Math.min(1, P.show) * (0.55 + Math.sin(t * 8) * 0.2);
      D.tiles.forEach(T => {
        if (T.ok) return;
        const on = me.gs === T.s && me.pos.y - (me.gy || 0) < 0.1;
        if (T.fall > 0) { T.fall += dt; T.m.position.y = -0.3 - T.fall * T.fall * 20; if (T.fall > 2.5) { T.fall = 0; T.s.off = false; T.m.position.y = -0.3; T.m.visible = true; } else if (T.fall > 1) T.m.visible = false; }
        else if (on) { T.fall = 0.001; T.s.off = true; BR.Audio.fx('land', { g: 0.6, rate: 0.6 }); S.fx.burst(new V3(T.x, 0, T.z), { n: 20, color: 0x8a8070, speed: 4, life: 0.6 }); }
      });
      if (!P.solved && me.alive && me.pos.z > D.goalZ && me.pos.y > -1 && isFinite(me.gy == null ? 0 : me.gy)) P.solve(1);
    },
    dispose(P) { const S = P.S; (P.glows || []).forEach(m => { S.scene.remove(m); m.geometry.dispose(); }); if (P.glowM) P.glowM.dispose(); if (P.lv) P.lv.dispose(); if (P.sign) P.sign.dispose(); },
  };
})();

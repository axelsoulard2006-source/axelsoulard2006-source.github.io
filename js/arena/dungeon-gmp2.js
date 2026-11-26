/* ===== arena/dungeon-gmp2.js : les énigmes mécaniques (GMP) de la Citadelle =====
   les engrenages (rapport de transmission), la balance (moments), le pied à coulisse géant (lecture au vernier),
   l'automate (logique ET / OU / NON). */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, DG = BR.Dungeon;
  const L = c => new THREE.Color(c).convertSRGBToLinear();
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const signAt = (P, lines) => DG.sign(P.S.scene, new V3(-7.5, 3.3, -P.S.env.layout.hz + 0.8), 0, lines, 5, 2.2);
  const fmt = v => (Math.round(v * 100) / 100).toString().replace('.', ',');

  /* =====================================================================
     9. LES ENGRENAGES — choisir les roues A et B pour obtenir la bonne vitesse de sortie
     ===================================================================== */
  const ZS = [12, 24, 36, 48], ZM = 24, ZP = 12, NM = 60, MOD = 0.11;
  const nOut = (za, zb) => NM * ZM / za * ZP / zb;
  DG.PUZZLES.engrenages = {
    n: 'La salle des engrenages', d: 'Choisis les roues pour que la sortie tourne à la bonne vitesse', win: 'TRANSMISSION RÉGLÉE', winSub: 'N₂ = N₁ × Z₁ / Z₂ : du grand art',
    hint: 'Énigme GMP : choisis les roues A et B (manivelles, E) pour que l\'arbre de sortie tourne exactement à la vitesse demandée.',
    layout(B, room, rng) {
      const Lr = DG.rectRoom(B, 28, 34);
      const targets = [120, 60, 40, 30, 20, 15, 10, 7.5];
      const target = targets[Math.floor(rng() * targets.length)];
      let za = 0, zb = 0; do { za = Math.floor(rng() * 4); zb = Math.floor(rng() * 4); } while (Math.abs(nOut(ZS[za], ZS[zb]) - target) < 0.01);
      // bâti des engrenages contre le mur ouest
      B.box('trim', -13.1, 0.6, 0, 1, 1.2, 20, 0, true);
      B.box('metal', -13.35, 5, 0, 0.3, 8, 18);
      Lr.rewardAt = new V3(3, 0, 2); Lr.rewardW = 9;
      Lr.data = { target, za, zb, cranks: [new V3(-10, 0, -4), new V3(-10, 0, 4)] };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S; let za = D.za, zb = D.zb;
      P.sign = signAt(P, [{ t: 'LA SALLE DES ENGRENAGES', s: 58, c: '#ffd76a' }, { t: 'N₂ = N₁ × Z₁ / Z₂', s: 50 }, { t: 'Le pignon tourne avec la roue A.', s: 36, c: '#cfc2a0' }]);
      const steel = new THREE.MeshStandardMaterial({ color: L('#9aa0aa'), metalness: 0.85, roughness: 0.35 }), brass = new THREE.MeshStandardMaterial({ color: L('#c9a24a'), metalness: 0.9, roughness: 0.3 }), red = new THREE.MeshStandardMaterial({ color: L('#c9302a'), metalness: 0.5, roughness: 0.4 });
      P.mats = [steel, brass, red];
      const wall = new THREE.Group(); wall.position.set(-12.9, 0, 0); wall.rotation.y = Math.PI / 2; S.scene.add(wall); P.wall = wall;
      P.gM = DG.gearMesh(ZM, MOD, red); wall.add(P.gM);
      const build = () => {
        [P.gA, P.gP, P.gB].forEach(g => { if (g) { wall.remove(g); g.traverse(o => { if (o.geometry && o.geometry !== BOX) o.geometry.dispose(); }); } });
        P.gA = DG.gearMesh(ZS[za], MOD, steel); P.gP = DG.gearMesh(ZP, MOD, brass); P.gB = DG.gearMesh(ZS[zb], MOD, steel);
        const rm = MOD * ZM / 2, ra = MOD * ZS[za] / 2, rp = MOD * ZP / 2, rb = MOD * ZS[zb] / 2;
        P.gM.position.set(-7, 6, 0);
        P.gA.position.set(-7 + rm + ra, 6, 0); P.gP.position.copy(P.gA.position).setZ(0.45);
        const a = -0.6; P.gB.position.set(P.gA.position.x + Math.cos(a) * (rp + rb), 6 + Math.sin(a) * (rp + rb), 0.45);
        wall.add(P.gA, P.gP, P.gB);
      };
      build();
      const info = () => [{ t: 'Moteur : ' + NM + ' tr/min · Z = ' + ZM, s: 40 }, { t: 'Roue A : Z = ' + ZS[za] + '  ·  pignon de A : Z = ' + ZP, s: 40 }, { t: 'Roue B (sortie) : Z = ' + ZS[zb], s: 40 }, { t: 'Sortie : ' + fmt(nOut(ZS[za], ZS[zb])) + ' tr/min', s: 50, c: Math.abs(nOut(ZS[za], ZS[zb]) - D.target) < 0.01 ? '#7dff9a' : '#ff9a6a' }, { t: 'Objectif : ' + fmt(D.target) + ' tr/min', s: 50, c: '#ffd76a' }];
      P.info = DG.sign(S.scene, new V3(-12.7, 2.6, -9), Math.PI / 2, info(), 6, 3.2);
      const check = () => { P.info.set(info()); if (Math.abs(nOut(ZS[za], ZS[zb]) - D.target) < 0.01) setTimeout(() => { if (BR.Arena.session() === S) P.solve(1); }, 900); };
      P.cr = D.cranks.map((p, i) => DG.lever(S.scene, p.clone(), Math.PI / 2, i ? '#5ad1ff' : '#ffd76a'));
      D.cranks.forEach((p, i) => P.use({ id: 'z' + i, title: i ? 'Roue B (sortie)' : 'Roue A', pos: p.clone(), r: 2, col: '#ffd76a', label: () => 'Changer de roue (Z = ' + ZS[i ? zb : za] + ' → ' + ZS[((i ? zb : za) + 1) % 4] + ')', act() {
        if (P.solved) return;
        if (i) zb = (zb + 1) % 4; else za = (za + 1) % 4;
        P.cr[i].set(!P.cr[i].on); BR.Audio.fx('parry', { g: 0.4, rate: 0.7 }); build(); check();
      } }));
      P.getZ = () => [za, zb];
    },
    update(P, dt, t) {
      if (!P.gA) return;
      const [za, zb] = P.getZ(), k = 0.4 * Math.PI * 2 / 60;
      const wM = NM * k, wA = -NM * ZM / ZS[za] * k, wB = nOut(ZS[za], ZS[zb]) * k;
      P.gM.rotation.z += wM * dt; P.gA.rotation.z += wA * dt; P.gP.rotation.z += wA * dt; P.gB.rotation.z += wB * dt;
    },
    dispose(P) { const S = P.S; if (P.wall) { S.scene.remove(P.wall); P.wall.traverse(o => { if (o.geometry && o.geometry !== BOX) o.geometry.dispose(); }); } (P.mats || []).forEach(m => m.dispose()); (P.cr || []).forEach(c => c.dispose()); if (P.info) P.info.dispose(); if (P.sign) P.sign.dispose(); },
  };

  /* =====================================================================
     10. LA BALANCE — accrocher des poids pour équilibrer les moments (masse × distance)
     ===================================================================== */
  const WM = [10, 20, 40], HOOKS = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5], SP = 1.2, BZ = 4, BY = 4.2;
  DG.PUZZLES.balance = {
    n: 'La balance du maître forgeron', d: 'Équilibre la balance : masse × distance à gauche = à droite', win: 'ÉQUILIBRE PARFAIT', winSub: 'Somme des moments = 0',
    hint: 'Énigme GMP : prends des poids (E) et accroche-les sous la poutre pour l\'équilibrer. Moment = masse × distance au pivot.',
    layout(B, room, rng) {
      const Lr = DG.rectRoom(B, 28, 34);
      let m0, d0, ok = false;
      while (!ok) {
        m0 = [20, 30, 40][Math.floor(rng() * 3)]; d0 = -(2 + Math.floor(rng() * 4));
        const T = -m0 * d0, free = HOOKS.filter(h => h !== d0);
        // au moins une solution avec les poids disponibles (chaque crochet porte un seul poids)
        outer: for (let a = -1; a < free.length; a++) for (let b = -1; b < free.length; b++) for (let c = -1; c < free.length; c++) {
          const hs = [a, b, c].filter(x => x >= 0); if (new Set(hs).size !== hs.length) continue;
          const s = (a >= 0 ? WM[0] * free[a] : 0) + (b >= 0 ? WM[1] * free[b] : 0) + (c >= 0 ? WM[2] * free[c] : 0);
          if (s === T && hs.length) { ok = true; break outer; }
        }
      }
      B.box('trim', 0, BY / 2 - 0.2, BZ, 1, BY - 0.4, 1, 0, true);           // pied de la balance
      const peds = WM.map((_, i) => new V3((i - 1) * 4, 0, -5));
      peds.forEach(p => B.box('trim', p.x, 0.5, p.z, 1.4, 1, 1.4, 0, true));
      Lr.rewardAt = new V3(0, 0, 10.5); Lr.rewardW = 12;
      Lr.data = { m0, d0, peds };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S;
      P.sign = signAt(P, [{ t: 'LA BALANCE DU FORGERON', s: 58, c: '#ffd76a' }, { t: 'Σ (masse × distance) = 0', s: 48 }, { t: 'Les crochets sont espacés d\'un mètre.', s: 36, c: '#cfc2a0' }]);
      const iron = new THREE.MeshStandardMaterial({ color: L('#4a4a52'), metalness: 0.8, roughness: 0.4 }), wood = new THREE.MeshStandardMaterial({ color: L('#7a4f2a'), roughness: 0.8 }), gold = new THREE.MeshStandardMaterial({ color: L('#c9a24a'), metalness: 0.9, roughness: 0.3 });
      P.mats = [iron, wood, gold];
      const beam = new THREE.Group(); beam.position.set(0, BY, BZ); S.scene.add(beam); P.beam = beam;
      const bm = new THREE.Mesh(BOX, wood); bm.scale.set(12.8, 0.35, 0.5); bm.castShadow = true; beam.add(bm);
      HOOKS.forEach(h => { const hk = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 10), gold); hk.position.set(-h * SP, -0.35, 0); beam.add(hk); });
      // graduations
      { // graduations : un nombre exactement au-dessus de chaque crochet
        const c = document.createElement('canvas'); c.width = 1024; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(20,16,12,0.85)'; g.fillRect(0, 0, 1024, 64); g.fillStyle = '#ffe9a8'; g.font = '800 40px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        HOOKS.forEach(h => g.fillText(String(Math.abs(h)), (h * SP + 6.4) / 12.8 * 1024, 34)); g.fillText('▲', 512, 34);
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 0.8), new THREE.MeshBasicMaterial({ map: t, transparent: true })); m.position.set(0, BY + 0.75, BZ - 0.3); m.rotation.y = Math.PI; S.scene.add(m);
        P.ticks = { dispose() { S.scene.remove(m); m.geometry.dispose(); m.material.dispose(); t.dispose(); } };
      }
      const mkW = (m, col) => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28 + m / 100, 0.32 + m / 100, 0.5 + m / 80, 12), iron); c.castShadow = true; g.add(c); const lb = DG.sign(S.scene, new V3(), 0, [{ t: m + ' kg', s: 150, c: col }], 0.9, 0.45); lb.m.position.set(0, 0, 0.36 + m / 100); g.add(lb.m); g.userData.lb = lb; S.scene.add(g); return g; };
      P.fixed = mkW(D.m0, '#ff9a6a');
      P.W = WM.map((m, i) => ({ m, loc: 'ped', hook: null, holder: null, g: mkW(m, '#ffd76a') }));
      P.hooks = {}; P.hooks[D.d0] = 'fixed';
      P.carry = {};
      const sum = () => D.m0 * D.d0 + P.W.reduce((s, w) => s + (w.loc === 'hook' ? w.m * w.hook : 0), 0);
      const moments = () => { let l = -D.m0 * D.d0, r = 0; P.W.forEach(w => { if (w.loc === 'hook') { if (w.hook < 0) l += -w.m * w.hook; else r += w.m * w.hook; } }); return [l, r]; };
      P.info = DG.sign(S.scene, new V3(0, 2.2, -5.9), 0, [{ t: 'Gauche : ' + moments()[0] + ' kg·m', s: 54 }, { t: 'Droite : ' + moments()[1] + ' kg·m', s: 54 }], 4.4, 1.4);
      const refresh = () => { const [l, r] = moments(); P.info.set([{ t: 'Gauche : ' + l + ' kg·m', s: 54, c: l === r ? '#7dff9a' : '#ffe9a8' }, { t: 'Droite : ' + r + ' kg·m', s: 54, c: l === r ? '#7dff9a' : '#ffe9a8' }]); if (sum() === 0 && P.W.some(w => w.loc === 'hook')) setTimeout(() => { if (BR.Arena.session() === S && sum() === 0) P.solve(1); }, 1200); };
      P.sum = sum;
      D.peds.forEach((p, i) => P.use({ id: 'p' + i, title: 'Poids de ' + WM[i] + ' kg', pos: p.clone(), r: 1.8, col: '#ffd76a', label: () => P.W[i].loc === 'ped' ? (P.carry[S.selfId] != null ? 'Tu portes déjà un poids' : 'Prendre le poids') : P.carry[S.selfId] === i ? 'Reposer le poids' : 'Le socle est vide', act(mine, from) {
        if (P.solved) return; const w = P.W[i];
        if (w.loc === 'ped' && P.carry[from] == null) { w.loc = 'hand'; w.holder = from; P.carry[from] = i; BR.Audio.fx('parry', { g: 0.3, rate: 1.2 }); }
        else if (w.loc === 'hand' && w.holder === from) { w.loc = 'ped'; w.holder = null; delete P.carry[from]; }
        refresh();
      } }));
      HOOKS.forEach(h => P.use({ id: 'h' + h, title: 'Crochet ' + (h < 0 ? 'gauche' : 'droit') + ' à ' + Math.abs(h) + ' m', pos: new V3(-h * SP, 0, BZ), r: 0.62, col: '#ffd76a',
        label: () => { const occ = P.hooks[h]; if (occ === 'fixed') return 'Contrepoids fixé'; if (occ != null) return P.carry[S.selfId] == null ? 'Décrocher le poids (' + P.W[occ].m + ' kg)' : 'Crochet occupé'; return P.carry[S.selfId] != null ? 'Accrocher ton poids ici' : 'Crochet libre'; },
        act(mine, from) {
          if (P.solved) return; const occ = P.hooks[h];
          if (occ === 'fixed') return;
          if (occ == null && P.carry[from] != null) { const i = P.carry[from], w = P.W[i]; delete P.carry[from]; w.loc = 'hook'; w.hook = h; w.holder = null; P.hooks[h] = i; BR.Audio.fx('land', { g: 0.5 }); }
          else if (occ != null && P.carry[from] == null) { const w = P.W[occ]; delete P.hooks[h]; w.loc = 'hand'; w.holder = from; w.hook = null; P.carry[from] = occ; }
          refresh();
        } }));
      P.ang = 0;
    },
    update(P, dt, t) {
      if (!P.beam) return;
      const D = P.data, S = P.S, s = P.sum();
      const want = Math.max(-0.28, Math.min(0.28, s / 160));
      P.ang += (want - P.ang) * Math.min(1, dt * 3); P.beam.rotation.z = P.ang;
      const hookPos = h => new V3(-Math.cos(P.ang) * h * SP, BY - Math.sin(P.ang) * h * SP - 1.3, BZ);
      P.fixed.position.copy(hookPos(D.d0));
      P.W.forEach((w, i) => {
        if (w.loc === 'ped') w.g.position.set(D.peds[i].x, 1.3, D.peds[i].z);
        else if (w.loc === 'hook') w.g.position.copy(hookPos(w.hook));
        else { const f = S.fighters.get(w.holder); if (f) w.g.position.set(f.pos.x, f.pos.y + 3, f.pos.z); }
      });
    },
    dispose(P) { const S = P.S; if (P.beam) { S.scene.remove(P.beam); P.beam.traverse(o => { if (o.geometry && o.geometry !== BOX) o.geometry.dispose(); }); } [P.fixed].concat((P.W || []).map(w => w.g)).forEach(g => { if (!g) return; S.scene.remove(g); g.userData.lb && g.userData.lb.dispose(); g.traverse(o => { if (o.geometry && o.geometry !== BOX) o.geometry.dispose(); }); }); (P.mats || []).forEach(m => m.dispose()); [P.info, P.ticks, P.sign].forEach(x => x && x.dispose()); },
  };

  /* =====================================================================
     11. LE PIED À COULISSE GÉANT — lire la cote au vernier (1/10) et la composer sur les tambours
     ===================================================================== */
  function caliperTex(V) {
    const W = 2048, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const x0 = 120, k = 24;   // px par mm
    g.fillStyle = '#1c1a17'; g.fillRect(0, 0, W, H);
    // règle (corps fixe) et bec fixe
    const steel = g.createLinearGradient(0, 180, 0, 330); steel.addColorStop(0, '#dfe4ea'); steel.addColorStop(1, '#9aa2ac');
    g.fillStyle = steel; g.fillRect(40, 180, W - 80, 150);
    g.fillStyle = '#b8c0ca'; g.fillRect(40, 40, 80, 290); g.fillRect(40, 330, 80, 150);    // bec fixe (haut et bas)
    // pièce mesurée entre les becs
    g.fillStyle = '#6a4a2e'; g.fillRect(x0, 360, V * k, 110); g.strokeStyle = '#3a2814'; g.lineWidth = 3; g.strokeRect(x0, 360, V * k, 110);
    g.fillStyle = '#e8d8b8'; g.font = '700 34px Inter, Arial'; g.textAlign = 'center'; g.fillText('?', x0 + V * k / 2, 428);
    // graduations du corps : mm, 5 mm, 10 mm (avec les nombres)
    g.strokeStyle = '#111'; g.fillStyle = '#111'; g.textAlign = 'center'; g.font = '700 30px Inter, Arial';
    for (let mm = 0; mm <= 76; mm++) { const x = x0 + mm * k, h = mm % 10 === 0 ? 62 : mm % 5 === 0 ? 46 : 32; g.lineWidth = mm % 10 === 0 ? 4 : 2.5; g.beginPath(); g.moveTo(x, 182); g.lineTo(x, 182 + h); g.stroke(); if (mm % 10 === 0) g.fillText(String(mm / 10), x, 280); }
    g.font = '600 22px Inter, Arial'; g.textAlign = 'left'; g.fillText('cm', x0 + 76 * k + 12, 280);
    // coulisseau (vernier) : son zéro est à V mm ; 10 divisions = 9 mm
    const xv = x0 + V * k;
    g.fillStyle = 'rgba(70, 120, 200, 0.92)'; g.fillRect(xv - 30, 230, 9.6 * k + 60, 150);
    g.fillStyle = '#9ab8e0'; g.fillRect(xv - 30, 330, 30, 150);   // bec mobile
    g.fillStyle = '#9ab8e0'; g.fillRect(xv - 30, 40, 30, 190);
    g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.font = '700 26px Inter, Arial'; g.textAlign = 'center';
    for (let i = 0; i <= 10; i++) { const x = xv + i * 0.9 * k, h = i % 5 === 0 ? 50 : 34; g.lineWidth = i % 5 === 0 ? 4 : 2.5; g.beginPath(); g.moveTo(x, 232); g.lineTo(x, 232 + h); g.stroke(); if (i % 5 === 0) g.fillText(String(i), x, 318); }
    g.font = '600 20px Inter, Arial'; g.fillText('1/10', xv + 9.6 * k - 10, 362);
    // vis de blocage
    g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(xv + 4.5 * k, 222, 18, 0, 7); g.fill();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    return t;
  }
  DG.PUZZLES.coulisse = {
    n: 'Le pied à coulisse du géant', d: 'Lis la cote au vernier et compose-la sur les tambours', win: 'LECTURE PARFAITE', winSub: 'Le dixième de millimètre près',
    hint: 'Énigme GMP : lis la cote de la pièce sur le pied à coulisse géant (vernier au 1/10), règle les 3 tambours (E), puis tire le levier.',
    layout(B, room, rng) {
      const Lr = DG.rectRoom(B, 28, 34);
      const V = Math.round((12 + rng() * 55) * 10) / 10;
      B.box('trim', 0, 0.8, 9, 15, 1.6, 1.2, 0, true);                     // socle du pied à coulisse
      const drums = [4, 0, -4].map(x => new V3(x, 0, 1.5));   // dizaines, unités, dixièmes de gauche à droite
      drums.forEach(p => B.box('trim', p.x, 0.5, p.z, 1.6, 1, 1.2, 0, true));
      Lr.rewardAt = new V3(0, 0, -6); Lr.rewardW = 12;
      Lr.data = { V, drums, lever: new V3(-7.5, 0, 1.5) };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S, dig = [0, 0, 0];
      P.sign = signAt(P, [{ t: 'LE PIED À COULISSE DU GÉANT', s: 54, c: '#ffd76a' }, { t: 'Cote = mm du corps + dixièmes', s: 44 }, { t: 'du trait du vernier qui coïncide.', s: 40, c: '#cfc2a0' }]);
      P.tex = caliperTex(D.V);
      P.cal = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.375), new THREE.MeshStandardMaterial({ map: P.tex, roughness: 0.6, metalness: 0.1, emissive: 0xffffff, emissiveMap: P.tex, emissiveIntensity: 0.7 }));
      P.cal.position.set(0, 4.25, 8.38); P.cal.rotation.y = Math.PI; S.scene.add(P.cal);
      const names = ['Dizaines', 'Unités', 'Dixièmes'];
      P.dr = D.drums.map((p, i) => DG.sign(S.scene, new V3(p.x, 1.6, p.z - 0.62), Math.PI, [{ t: String(dig[i]), s: 300, c: '#ffe9a8' }], 1.3, 1.3));
      P.read = DG.sign(S.scene, new V3(D.lever.x, 2.6, D.lever.z + 0.3), Math.PI, [{ t: 'Ta lecture : 00,0 mm', s: 64, c: '#ffe9a8' }], 4.2, 0.65);
      const show = () => { P.dr.forEach((d, i) => d.set([{ t: String(dig[i]), s: 300, c: '#ffe9a8' }])); P.read.set([{ t: 'Ta lecture : ' + dig[0] + dig[1] + ',' + dig[2] + ' mm', s: 64, c: '#ffe9a8' }]); };
      D.drums.forEach((p, i) => P.use({ id: 'd' + i, title: 'Tambour des ' + names[i].toLowerCase(), pos: p.clone(), r: 1.7, col: '#ffd76a', label: () => 'Tourner (' + dig[i] + ' → ' + ((dig[i] + 1) % 10) + ')', act() { if (P.solved) return; dig[i] = (dig[i] + 1) % 10; BR.Audio.ui('click'); show(); } }));
      P.lv = DG.lever(S.scene, D.lever.clone(), Math.PI, '#7dff9a');
      P.use({ id: 'ok', title: 'Levier de validation', pos: D.lever.clone(), r: 1.8, col: '#7dff9a', label: () => 'Valider ' + dig[0] + dig[1] + ',' + dig[2] + ' mm', act(mine) {
        if (P.solved) return; P.lv.set(!P.lv.on);
        const v = dig[0] * 10 + dig[1] + dig[2] / 10;
        if (Math.abs(v - D.V) < 0.05) P.solve(1);
        else { BR.Audio.ui('error'); if (mine) { DG.hurtMe && DG.hurtMe(P, 0.03, null); P.say('Raté (' + fmt(v) + ' mm). Les millimètres entiers se lisent sur le corps avant le zéro du vernier ; les dixièmes, au trait du vernier aligné avec un trait du corps.'); } }
      } });
    },
    dispose(P) { const S = P.S; if (P.cal) { S.scene.remove(P.cal); P.cal.geometry.dispose(); P.cal.material.dispose(); P.tex.dispose(); } (P.dr || []).forEach(d => d.dispose()); [P.read, P.sign].forEach(x => x && x.dispose()); if (P.lv) P.lv.dispose(); },
  };

  /* =====================================================================
     12. L'AUTOMATE — trois leviers logiques A, B, C : VÉRIN allumé, ALARME éteinte
     ===================================================================== */
  const FORMS = [
    ['x ET y', (x, y) => x && y], ['x OU y', (x, y) => x || y], ['x ET NON y', (x, y) => x && !y], ['NON x OU y', (x, y) => !x || y],
    ['(x OU y) ET z', (x, y, z) => (x || y) && z], ['x ET (y OU z)', (x, y, z) => x && (y || z)], ['(x ET y) OU z', (x, y, z) => (x && y) || z],
    ['x OU (y ET NON z)', (x, y, z) => x || (y && !z)], ['NON (x ET y)', (x, y) => !(x && y)], ['x OU EXCLUSIF y', (x, y) => x !== y], ['x ET y ET NON z', (x, y, z) => x && y && !z],
  ];
  DG.PUZZLES.logique = {
    n: 'L\'automate du gardien', d: 'Règle les leviers A, B, C : le VÉRIN doit s\'allumer, l\'ALARME rester éteinte', win: 'VÉRIN ACTIONNÉ', winSub: 'Logique imparable',
    hint: 'Énigme GMP : lis les équations du tableau. Règle les leviers A, B et C pour allumer le VÉRIN sans déclencher l\'ALARME.',
    layout(B, room, rng) {
      const Lr = DG.rectRoom(B, 28, 34);
      const V = ['A', 'B', 'C'];
      let e1, e2, sol = null;
      for (let tries = 0; tries < 400 && !sol; tries++) {
        const f1 = FORMS[Math.floor(rng() * FORMS.length)], f2 = FORMS[Math.floor(rng() * FORMS.length)];
        const p1 = BR.shuffle([0, 1, 2], rng), p2 = BR.shuffle([0, 1, 2], rng);
        const ev = (f, p, s) => !!f[1](s[p[0]], s[p[1]], s[p[2]]);
        const good = [];
        for (let m = 0; m < 8; m++) { const s = [!!(m & 1), !!(m & 2), !!(m & 4)]; if (ev(f1, p1, s) && !ev(f2, p2, s)) good.push(m); }
        if (good.length === 1 && good[0] !== 0) {
          sol = good[0];
          const txt = (f, p) => f[0].replace(/x|y|z/g, c => V[p['xyz'.indexOf(c)]]);
          e1 = { f: FORMS.indexOf(f1), p: p1, t: txt(f1, p1) }; e2 = { f: FORMS.indexOf(f2), p: p2, t: txt(f2, p2) };
        }
      }
      if (!sol) { e1 = { f: 0, p: [0, 1, 2], t: 'A ET B' }; e2 = { f: 0, p: [2, 0, 1], t: 'C ET A' }; }
      B.box('trim', 0, 0.6, 8.5, 14, 1.2, 1, 0, true);
      const lev = [5, 0, -5].map(x => new V3(x, 0, -1));
      Lr.rewardAt = new V3(0, 0, -7.5); Lr.rewardW = 12;
      Lr.data = { e1, e2, lev };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S, st = [false, false, false];
      P.sign = signAt(P, [{ t: 'L\'AUTOMATE DU GARDIEN', s: 58, c: '#ffd76a' }, { t: '1 = levier levé, 0 = baissé', s: 44 }, { t: 'VÉRIN à 1, ALARME à 0.', s: 40, c: '#cfc2a0' }]);
      P.board = DG.sign(S.scene, new V3(0, 3.6, 7.95), Math.PI, [{ t: 'VÉRIN = ' + D.e1.t, s: 64, c: '#7dff9a' }, { t: 'ALARME = ' + D.e2.t, s: 64, c: '#ff7a6a' }, { t: 'But : VÉRIN = 1 et ALARME = 0', s: 40, c: '#ffe9a8' }], 11, 3.2);
      P.lampV = DG.crystal(S.scene, new V3(-6.3, 2.2, 8.4), '#7dff9a', 0.55); P.lampA = DG.crystal(S.scene, new V3(6.3, 2.2, 8.4), '#ff4a3a', 0.55);
      const ev = (e, s) => !!FORMS[e.f][1](s[e.p[0]], s[e.p[1]], s[e.p[2]]);
      const refresh = () => { const v = ev(D.e1, st), a = ev(D.e2, st); P.lampV.set(v); P.lampA.set(a); if (v && !a) setTimeout(() => { if (BR.Arena.session() === S && ev(D.e1, st) && !ev(D.e2, st)) P.solve(1); }, 900); };
      P.lv = D.lev.map((p, i) => DG.lever(S.scene, p.clone(), 0, ['#ff6a5a', '#5ad1ff', '#ffd76a'][i]));
      P.tags = D.lev.map((p, i) => DG.sign(S.scene, new V3(p.x, 2.4, p.z + 0.1), Math.PI, [{ t: 'ABC'[i], s: 300, c: ['#ff6a5a', '#5ad1ff', '#ffd76a'][i] }], 0.9, 0.9));
      D.lev.forEach((p, i) => P.use({ id: 'v' + i, title: 'Levier ' + 'ABC'[i], pos: p.clone(), r: 1.9, col: '#7dff9a', label: () => 'Basculer ' + 'ABC'[i] + ' (' + (st[i] ? 1 : 0) + ' → ' + (st[i] ? 0 : 1) + ')', act() { if (P.solved) return; st[i] = !st[i]; P.lv[i].set(st[i]); BR.Audio.fx('parry', { g: 0.35, rate: 1.1 }); refresh(); } }));
      refresh();
    },
    update(P, dt, t) { if (P.lampV) { P.lampV.tick(dt, t); P.lampA.tick(dt, t); } },
    dispose(P) { [P.lampV, P.lampA, P.board, P.sign].forEach(x => x && x.dispose()); (P.lv || []).forEach(l => l.dispose()); (P.tags || []).forEach(t => t.dispose()); },
  };
})();

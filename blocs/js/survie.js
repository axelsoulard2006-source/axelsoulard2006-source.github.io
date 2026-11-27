/* ===== survie.js : contenu de survie ajouté par l'API du registre (sans toucher au moteur)
   Objets 114 à 137 : laine, cuir, viandes crues et cuites, os, flèche, poudre de braise, armures en cuir et en fer.
   Recette du coffre (bloc 40 déclaré par registry.js). Les icônes sont dessinées ici (VX.itemArt). ===== */
(function () {
  const VX = window.VX, B = VX.B, I = VX.I, REG = VX.registry;
  const COFFRE = B.COFFRE != null ? B.COFFRE : 40;
  VX.itemArt = VX.itemArt || {};
  // une icône : 16 lignes (complétées à 16 caractères), « . » = transparent
  const art = (id, rows, pal) => { const r = rows.map(s => (s + '................').slice(0, 16)); while (r.length < 16) r.push('................'); VX.itemArt[id] = [r, pal]; };

  /* ---------- identifiants ---------- */
  const S = VX.SURV = {
    LAINE: 114, CUIR: 115, GIGOT_CRU: 116, GIGOT_CUIT: 117, COTE_CRUE: 118, COTE_CUITE: 119, PAVE_CRU: 120, PAVE_CUIT: 121,
    CHAIR: 122, OS: 123, FLECHE: 124, POUDRE: 125,
    CASQUE_CUIR: 130, PLASTRON_CUIR: 131, JAMBIERES_CUIR: 132, BOTTES_CUIR: 133,
    CASQUE_FER: 134, PLASTRON_FER: 135, JAMBIERES_FER: 136, BOTTES_FER: 137,
  };

  /* ---------- matières premières ---------- */
  REG.item(S.LAINE, 'Touffe de laine', 'laine', { fuel: 5 });
  art(S.LAINE, ['', '', '.....wwww', '...wwWWwwww', '..wWWwwwwWww', '.wwwwwwWwwwwww', '.wWwwwwwwwWwww', '.wwwwWwwwwwwws', '..wwwwwwwWwwss', '..swwwwwwwwss', '...sswwwwsss', '.....ssss'], { w: '#efe8da', W: '#ffffff', s: '#c4b9a8' });
  REG.item(S.CUIR, 'Cuir', 'cuir');
  art(S.CUIR, ['', '', '...b........b', '..bLLLLLLLLLLb', '...LlLLLLLLlL', '...LLLLlLLLLL', '..LLLLLLLLLLLL', '..LLlLLLLLLlLL', '..LLLLLLLLLLLL', '...LLLLLlLLLL', '...LlLLLLLLLL', '..bLLLLLLLLLLb', '...b........b'], { L: '#9a5a2c', l: '#bd7840', b: '#6a3a18' });
  REG.item(S.OS, 'Os', 'os', {});
  art(S.OS, ['', '..oo', '.oOOo', '.oOOOo', '..oOOOo', '...oOOo', '....oOOo', '.....oOOo', '......oOOo', '.......oOOo', '........oOOOo', '.........oOOOo', '..........oOOo', '...........oo'], { o: '#c8bea2', O: '#f2ecda' });
  REG.item(S.FLECHE, 'Flèche', 'fleche');
  art(S.FLECHE, ['', '.............tt', '............tTt', '...........tTt', '..........hTt', '.........h', '........h', '.......h', '......h', '.....h', '..fFh', '..ffF', '.fFf', '.ff'], { t: '#7a7a84', T: '#d8d8e0', h: '#8a5f33', f: '#e8e0d0', F: '#a8a088' });
  REG.item(S.POUDRE, 'Poudre de braise', 'poudre', { fuel: 20 });
  art(S.POUDRE, ['', '', '', '', '', '.......o', '......oOo', '.....oOrOo', '....ooOrrOo', '...oorOOrOoo', '..oorrOOrrOoo', '..kkkkkkkkkkkk'], { o: '#ff7a2a', O: '#ffc84a', r: '#c8401a', k: '#3a2a24' });

  /* ---------- nourriture (crue → cuite au four) ---------- */
  const GIGOT = ['', '', '......mmmm', '....mmMMmmmm', '...mMMmmmmmmm', '...mMmmmmmmmmd', '...mmmmmmmmmdd', '....mmmmmmmdd', '.....dmmmmdd', '......dddd', '.......oo', '.......oo', '......oOOo', '......o..o'];
  const COTE = ['', '', '....ffffff', '...fmmmmmmff', '..fmmMMmmmmmf', '..fmMmmmmmmmmf', '..fmmmmmmmmmmf', '..fmmmmmmmmmf', '...fmmmmmmmf', '....ffmmmmf', '......ffmf', '........ff'];
  const PAVE = ['', '', '', '....dddddddd', '...dmmmmmmmmd', '..dmmMMmmmwmmd', '..dmMmmmmmwwmd', '..dmmmmmmmmwmd', '..dmmmmwmmmmmd', '...dmmmmmmmmd', '....dddddddd'];
  const BONE = { o: '#f0ead8', O: '#d0c6aa' };
  const food = (id, name, icon, rows, pal, n) => { REG.item(id, name, icon, { food: n }); art(id, rows, pal); };
  food(S.GIGOT_CRU, 'Gigot de mouton cru', 'gigot_cru', GIGOT, Object.assign({ m: '#e86a70', M: '#ffa4a4', d: '#b8404a' }, BONE), 2);
  food(S.GIGOT_CUIT, 'Gigot de mouton rôti', 'gigot_cuit', GIGOT, Object.assign({ m: '#a8582a', M: '#d08848', d: '#6a3010' }, BONE), 6);
  food(S.COTE_CRUE, 'Côte de cochon crue', 'cote_crue', COTE, { f: '#f6e0d0', m: '#f08a8a', M: '#ffb8b0' }, 3);
  food(S.COTE_CUITE, 'Côte de cochon grillée', 'cote_cuite', COTE, { f: '#e8c890', m: '#b8683a', M: '#d89058' }, 8);
  food(S.PAVE_CRU, 'Pavé de vache cru', 'pave_cru', PAVE, { m: '#d8424a', M: '#f07a7a', w: '#f8e0d8', d: '#902028' }, 3);
  food(S.PAVE_CUIT, 'Pavé de vache grillé', 'pave_cuit', PAVE, { m: '#8a4420', M: '#b06a38', w: '#e0c8a0', d: '#5a2a10' }, 8);
  food(S.CHAIR, 'Chair de zombi', 'chair', PAVE, { m: '#7a8a6a', M: '#9aa888', w: '#5a6a3a', d: '#4a4a3a' }, 2);
  REG.smelt(S.GIGOT_CRU, S.GIGOT_CUIT); REG.smelt(S.COTE_CRUE, S.COTE_CUITE); REG.smelt(S.PAVE_CRU, S.PAVE_CUIT);
  REG.smelt(S.CHAIR, S.CUIR);   // la chair séchée au four donne du cuir

  /* ---------- armures : slot 0 casque, 1 plastron, 2 jambières, 3 bottes ; pts = protection (4 % par point, 80 % max) ---------- */
  const ARMOR = VX.ARMOR = {};
  const SHAPES = [
    ['', '', '', '....XXXXXXXX', '...XxxxxxxxxX', '..XxxxxxxxxxxX', '..XxXXXXXXXXxX', '..XxX......XxX', '..XxX......XxX', '..XXX......XXX'],
    ['', '..XXX......XXX', '..XxXX....XXxX', '..XxxXXXXXXxxX', '..XxxxxxxxxxxX', '...XXxxxxxxXX', '....XxxxxxxX', '....XxxxxxxX', '....XxxxxxxX', '....XxxxxxxX', '....XXXXXXXX'],
    ['', '....XXXXXXXX', '....XxxxxxxX', '....XxxXXxxX', '....XxX..XxX', '....XxX..XxX', '....XxX..XxX', '....XxX..XxX', '....XxX..XxX', '....XXX..XXX'],
    ['', '', '', '', '...XXX....XXX', '...XxX....XxX', '...XxX....XxX', '..XXxX....XxXX', '..XxxX....XxxX', '..XXXX....XXXX'],
  ];
  const PIECE = ['Casque', 'Plastron', 'Jambières', 'Bottes'];
  const MATS = [
    { name: 'en cuir', ing: S.CUIR, pts: [1, 3, 2, 1], dura: [55, 80, 75, 65], pal: { X: '#5a3216', x: '#a8642e' }, ids: [S.CASQUE_CUIR, S.PLASTRON_CUIR, S.JAMBIERES_CUIR, S.BOTTES_CUIR] },
    { name: 'en fer', ing: I.L_FER, pts: [2, 6, 5, 2], dura: [165, 240, 225, 195], pal: { X: '#6a6a74', x: '#e0e0e6' }, ids: [S.CASQUE_FER, S.PLASTRON_FER, S.JAMBIERES_FER, S.BOTTES_FER] },
    // ids 143 à 154 : or (léger, peu solide), saphir, astrium (le meilleur : 20 points = 80 %)
    { name: 'en or', ing: I.L_OR, pts: [2, 5, 3, 1], dura: [77, 112, 105, 91], pal: { X: '#a8801a', x: '#f6d33c' }, ids: [143, 144, 145, 146] },
    { name: 'en saphir', ing: I.SAPHIR, pts: [3, 7, 5, 2], dura: [363, 528, 495, 429], pal: { X: '#1c5fb8', x: '#5ac0ff' }, ids: [147, 148, 149, 150] },
    { name: 'en astrium', ing: I.L_ASTRIUM, pts: [3, 8, 6, 3], dura: [407, 592, 555, 481], pal: { X: '#6a2a90', x: '#d07aff' }, ids: [151, 152, 153, 154] },
  ];
  ['OR', 'SAPHIR', 'ASTRIUM'].forEach((m, k) => ['CASQUE', 'PLASTRON', 'JAMBIERES', 'BOTTES'].forEach((p, i) => { S[p + '_' + m] = 143 + k * 4 + i; }));
  const RECIPE = [['XXX', 'X X'], ['X X', 'XXX', 'XXX'], ['XXX', 'X X', 'X X'], ['X X', 'X X']];
  for (const m of MATS) m.ids.forEach((id, slot) => {
    REG.item(id, PIECE[slot] + ' ' + m.name, 'armure', { stack: 1, dura: m.dura[slot] });
    art(id, SHAPES[slot], m.pal);
    ARMOR[id] = { slot, pts: m.pts[slot], col: m.pal.x, dark: m.pal.X, mat: m.name.replace('en ', '') };
    REG.shaped(RECIPE[slot], { X: m.ing }, id);
    REG.creative(id);
  });

  /* ---------- coffre (8 planches en anneau) ---------- */
  REG.shaped(['PPP', 'P P', 'PPP'], { P: [B.PLANCHES] }, COFFRE);
  if (VX.BLOCKS[COFFRE]) { REG.creative(COFFRE); REG.fuel(COFFRE, 15); }

  /* ---------- recettes utiles ---------- */
  REG.shaped(['O', 'S'], { O: S.OS, S: I.BATON }, S.FLECHE, 4);
  REG.shaped(['P', 'S'], { P: S.POUDRE, S: I.BATON }, B.TORCHE, 3);         // la poudre de braise fait aussi des torches

  [S.LAINE, S.CUIR, S.OS, S.FLECHE, S.POUDRE, S.GIGOT_CRU, S.GIGOT_CUIT, S.COTE_CRUE, S.COTE_CUITE, S.PAVE_CRU, S.PAVE_CUIT, S.CHAIR].forEach(id => REG.creative(id));

  /* ---------- combat : arc (laine torsadée en guise de corde), flèches de gravier, bouclier ---------- */
  if (I.ARC) {
    REG.shaped([' SL', 'S L', ' SL'], { S: I.BATON, L: S.LAINE }, I.ARC);
    REG.shaped(['G', 'S', 'L'], { G: B.GRAVIER, S: I.BATON, L: S.LAINE }, S.FLECHE, 4);
    REG.shaped(['PFP', 'PPP', ' P '], { P: B.PLANCHES, F: I.L_FER }, I.BOUCLIER);
  }

  /* ---------- aspect des armures portées : couleurs par emplacement (aperçu 3D de l'interface, joueurs en ligne) ----------
     VX.armorLook() -> { casque, plastron, jambieres, bottes } ; chaque valeur : null ou { id, col (clair), dark (contour), mat }
     (aussi en tableau : look.slots[0..3]) */
  VX.armorLook = function (armor) {
    armor = armor || (VX.G && VX.G.armor) || [];
    const slots = [0, 1, 2, 3].map(i => { const s = armor[i], a = s && ARMOR[s.id]; return a ? { id: s.id, col: a.col, dark: a.dark, mat: a.mat } : null; });
    return { casque: slots[0], plastron: slots[1], jambieres: slots[2], bottes: slots[3], slots };
  };

  /* ---------- trésors des structures générées : coffre rempli à la première ouverture (ou à sa casse) ---------- */
  // [id, min, max, poids]
  const LOOT = {
    ruine: { rolls: [5, 9], items: [[I.PAIN, 1, 3, 10], [I.BLE, 2, 5, 8], [I.GRAINES, 2, 6, 10], [I.POMME, 1, 3, 8], [I.CHARBON, 2, 6, 8], [I.L_FER, 1, 4, 7], [I.L_OR, 1, 3, 4],
      [S.OS, 1, 4, 6], [S.FLECHE, 2, 8, 6], [I.SAPHIR, 1, 2, 2], [I.ARC, 1, 1, 2], [I.BOUCLIER, 1, 1, 1], [S.CASQUE_FER, 1, 1, 1], [B.TORCHE, 2, 6, 5], [S.LAINE, 1, 3, 4], [B.P_MOUSSUE, 2, 5, 3]] },
    portail: { rolls: [4, 8], items: [[B.OBSIDIENNE, 1, 3, 10], [I.L_OR, 2, 6, 8], [I.ECLAT, 1, 3, 6], [I.ALLUMEUR, 1, 1, 5], [S.POUDRE, 1, 4, 6], [I.POMME, 1, 2, 5], [I.CHARBON, 2, 5, 5],
      [B.B_OR, 1, 1, 1], [S.CASQUE_OR, 1, 1, 2], [S.PLASTRON_OR, 1, 1, 1], [S.JAMBIERES_OR, 1, 1, 1], [S.BOTTES_OR, 1, 1, 2], [I.PAIN, 1, 2, 3], [B.LUMICRISTAL, 1, 3, 3]] },
  };
  VX.LOOT = LOOT;
  // contenu (27 cases) tiré avec un hasard stable par position : deux joueurs trouvent le même trésor
  VX.chestLoot = function (kind, x, y, z, seed) {
    const T = LOOT[kind]; if (!T) return null;
    const rnd = VX.rng(Math.floor(VX.hash(x, y, z, (seed | 0) + 4321) * 4294967296)), out = Array(27).fill(null);
    const tot = T.items.reduce((a, e) => a + e[3], 0), n = T.rolls[0] + Math.floor(rnd() * (T.rolls[1] - T.rolls[0] + 1));
    for (let k = 0; k < n; k++) {
      let r = rnd() * tot, e = T.items[0]; for (const it of T.items) { r -= it[3]; if (r < 0) { e = it; break; } }
      const id = e[0]; if (id == null) continue;
      const cnt = e[1] + Math.floor(rnd() * (e[2] - e[1] + 1)), d = VX.duraOf(id) || undefined;
      let slot = Math.floor(rnd() * 27); for (let t = 0; t < 27 && out[slot]; t++) slot = (slot + 1) % 27;
      if (!out[slot]) out[slot] = { id, n: Math.min(cnt, VX.stackOf(id)), d };
    }
    return out;
  };
  // coffre d'origine (généré, jamais modifié par un joueur) ? -> on le remplit une seule fois
  VX.ensureChestLoot = function (x, y, z) {
    const G = VX.G; if (!G || !G.world || G.world.getG(x, y, z) !== COFFRE) return null;
    const k = G.dim + ':' + x + ',' + y + ',' + z; if (G.chests[k]) return G.chests[k];
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16), m = (G.mods[G.dim] || {})[cx + ',' + cz], i = (x - cx * 16) + (z - cz * 16) * 16 + y * 256;
    if (m && m[i] != null) return null;   // posé par un joueur
    const kind = G.world.gen && G.world.gen.chestKindAt ? G.world.gen.chestKindAt(x, y, z) : null; if (!kind) return null;
    const c = VX.chestLoot(kind, x, y, z, G.seed); if (c) G.chests[k] = c;
    return c;
  };
})();

/* ===== ajouts d'intégration : recettes des nouveaux blocs du monde, piqûres du cactus ===== */
(function () {
  const VX = window.VX, B = VX.B, R = VX.registry; if (!R) return;
  if (B.BOULEAU != null) { R.shapeless([B.BOULEAU], B.PLANCHES, 4); R.fuel(B.BOULEAU, 15); R.smelt(B.BOULEAU, VX.I.CHARBON); }
  if (B.GRES != null) R.shaped(['SS', 'SS'], { S: B.SABLE }, B.GRES, 1);
  if (B.NEIGE_BLOC != null) R.shapeless([B.NEIGE_BLOC], B.NEIGE_BLOC, 1);
  if (B.CACTUS != null) { let t = 0; VX.hooks.on('playerTick', ({ dt, player: P }) => {
    const G = VX.G; if (!G || !G.world || G.mode === 'creatif') return; t -= dt; if (t > 0) return;
    for (const [dx, dz] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) for (const dy of [0.2, 1.2]) if (G.world.get(Math.floor(P.pos.x + dx), Math.floor(P.pos.y + dy), Math.floor(P.pos.z + dz)) === B.CACTUS) { t = 0.6; G.hurt(1); return; }
  }); }
})();

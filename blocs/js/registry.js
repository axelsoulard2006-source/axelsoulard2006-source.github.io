/* ===== registry.js : registre central — blocs, objets, outils, recettes, cuisson, combustibles (sans DOM : utilisable dans le Worker) ===== */
(function () {
  const VX = self.VX;
  // tool : outil qui va vite ; tier : niveau d'outil minimum pour récupérer le bloc (-1 = à la main)
  // drop : ce que donne le bloc (id, ou fonction(rnd) -> [id, n] / null)
  const B = {
    AIR: 0, HERBE: 1, TERRE: 2, PIERRE: 3, GALETS: 4, TRONC: 5, PLANCHES: 6, FEUILLES: 7, SABLE: 8, EAU: 9,
    M_CHARBON: 10, M_FER: 11, M_OR: 12, M_SAPHIR: 13, VERRE: 14, FOUR: 15, ETABLI: 16, OBSIDIENNE: 17,
    CENDRITE: 18, MOUSSE: 19, TIGE: 20, CHAPEAU: 21, BASALTE: 22, LUMICRISTAL: 23, M_ASTRIUM: 24, B_ASTRIUM: 25,
    PORTAIL: 26, TORCHE: 27, LAVE: 28, B_FER: 29, B_OR: 30, B_SAPHIR: 31, BRIQUES: 32, SOCLE: 33, NEIGE: 34, BRAISIER: 35,
    // biomes et coffre (ids 36 à 63 réservés au terrain / aux blocs)
    BOULEAU: 36, F_BOULEAU: 37, GRES: 38, ARGILE: 39, COFFRE: 40, HERBES: 41, FLEUR_R: 42, FLEUR_J: 43, ARBUSTE: 44, CACTUS: 45,
    NEIGE_BLOC: 46, GRAVIER: 47,
    // agriculture et structures (ids 48 à 55)
    LABOUR: 48, LABOUR_H: 49, BLE_0: 50, BLE_1: 51, BLE_2: 52, BLE_3: 53, P_MOUSSUE: 54, BRIQUES_M: 55,
  };
  const I = {
    BATON: 100, CHARBON: 101, L_FER: 102, L_OR: 103, SAPHIR: 104, ECLAT: 105, L_ASTRIUM: 106, POMME: 107, ALLUMEUR: 108, MORCEAU: 109, ROTI: 110, VIANDE: 111, STEAK: 112, ESSENCE: 113,
    // agriculture et combat (138 à 159 ; 114 à 137 : survie.js)
    GRAINES: 138, BLE: 139, PAIN: 140, ARC: 141, BOUCLIER: 142,
  };
  VX.B = B; VX.I = I;
  const D = VX.BLOCKS = [];
  const def = (id, name, tex, o) => { D[id] = Object.assign({ id, name, tex, solid: true, opaque: true, hard: 1, tool: null, tier: -1, drop: id }, o || {}); };
  const T = (all, top, bottom, side) => ({ top: top || all, bottom: bottom || top || all, side: side || all });
  def(B.AIR, 'Air', null, { solid: false, opaque: false, hard: 0, drop: null });
  def(B.HERBE, 'Herbe', T('grass_side', 'grass_top', 'dirt'), { hard: 0.6, tool: 'pelle', drop: B.TERRE });
  def(B.TERRE, 'Terre', T('dirt'), { hard: 0.5, tool: 'pelle' });
  def(B.PIERRE, 'Pierre', T('stone'), { hard: 1.5, tool: 'pioche', tier: 0, drop: B.GALETS });
  def(B.GALETS, 'Galets', T('cobble'), { hard: 2, tool: 'pioche', tier: 0 });
  def(B.TRONC, 'Tronc', T('log_side', 'log_top'), { hard: 2, tool: 'hache' });
  def(B.PLANCHES, 'Planches', T('planks'), { hard: 2, tool: 'hache' });
  def(B.FEUILLES, 'Feuillage', T('leaves'), { opaque: false, cutout: true, hard: 0.2, tool: 'hache', drop: r => r() < 0.06 ? [I.POMME, 1] : r() < 0.05 ? [I.BATON, 1] : null });
  def(B.SABLE, 'Sable', T('sand'), { hard: 0.5, tool: 'pelle' });
  def(B.EAU, 'Eau', T('water'), { solid: false, opaque: false, liquid: true, transparent: true, hard: -1, drop: null });
  def(B.M_CHARBON, 'Minerai de charbon', T('ore_coal'), { hard: 3, tool: 'pioche', tier: 0, drop: I.CHARBON });
  def(B.M_FER, 'Minerai de fer', T('ore_iron'), { hard: 3, tool: 'pioche', tier: 1 });
  def(B.M_OR, 'Minerai d\'or', T('ore_gold'), { hard: 3, tool: 'pioche', tier: 2 });
  def(B.M_SAPHIR, 'Minerai de saphir', T('ore_sapphire'), { hard: 3, tool: 'pioche', tier: 2, drop: I.SAPHIR });
  def(B.VERRE, 'Verre', T('glass'), { opaque: false, cutout: true, hard: 0.3, drop: null });
  def(B.FOUR, 'Four', T('furnace_front', 'furnace_top', 'furnace_top'), { hard: 3.5, tool: 'pioche', tier: 0 });
  def(B.ETABLI, 'Établi', T('bench_side', 'bench_top', 'planks'), { hard: 2.5, tool: 'hache' });
  def(B.OBSIDIENNE, 'Obsidienne', T('obsidian'), { hard: 30, tool: 'pioche', tier: 3 });
  def(B.CENDRITE, 'Cendrite', T('cendrite'), { hard: 0.5, tool: 'pioche', tier: 0 });
  def(B.MOUSSE, 'Mousse ardente', T('moss_side', 'moss_top', 'cendrite'), { hard: 0.5, tool: 'pioche', tier: 0, drop: B.CENDRITE });
  def(B.TIGE, 'Tige de champignon', T('stalk', 'stalk_top'), { hard: 2, tool: 'hache' });
  def(B.CHAPEAU, 'Chapeau de champignon', T('cap'), { hard: 0.8, tool: 'hache', drop: r => r() < 0.45 ? [I.MORCEAU, 1] : [B.CHAPEAU, 1] });
  def(B.BASALTE, 'Basalte', T('basalt_side', 'basalt_top'), { hard: 1.25, tool: 'pioche', tier: 0 });
  def(B.LUMICRISTAL, 'Lumicristal', T('glowcrystal'), { hard: 0.3, glow: true });
  def(B.M_ASTRIUM, 'Minerai d\'astrium', T('ore_astrium'), { hard: 30, tool: 'pioche', tier: 3 });
  def(B.B_ASTRIUM, 'Bloc d\'astrium', T('astrium_block'), { hard: 50, tool: 'pioche', tier: 3 });
  def(B.PORTAIL, 'Portail', T('portal'), { solid: false, opaque: false, transparent: true, glow: true, hard: 0, drop: null });
  def(B.TORCHE, 'Torche', T('torch'), { solid: false, opaque: false, cutout: true, glow: true, shape: 'torch', hard: 0 });
  def(B.LAVE, 'Lave', T('lava'), { solid: false, opaque: true, liquid: true, glow: true, hard: -1, drop: null });
  def(B.B_FER, 'Bloc de fer', T('iron_block'), { hard: 5, tool: 'pioche', tier: 1 });
  def(B.B_OR, 'Bloc d\'or', T('gold_block'), { hard: 3, tool: 'pioche', tier: 2 });
  def(B.B_SAPHIR, 'Bloc de saphir', T('sapphire_block'), { hard: 5, tool: 'pioche', tier: 2 });
  def(B.BRIQUES, 'Briques de pierre', T('bricks'), { hard: 1.5, tool: 'pioche', tier: 0 });
  def(B.SOCLE, 'Socle', T('bedrock'), { hard: -1, drop: null });
  def(B.NEIGE, 'Neige tassée', T('snow_side', 'snow', 'dirt'), { hard: 0.6, tool: 'pelle', drop: B.TERRE });
  def(B.BRAISIER, 'Braisier', T('ember'), { hard: 0.8, tool: 'pioche', glow: true });
  // --- biomes (forêts, désert, montagnes, océans) ---
  // shape 'cross' : plante rendue en deux quads diagonaux ; plant : tombe si le bloc dessous disparaît ; replace : la pose d'un bloc la remplace
  // light : lumière émise (0..15) ; shade : atténuation supplémentaire de la lumière du ciel en la traversant
  const PLANT = { solid: false, opaque: false, cutout: true, shape: 'cross', plant: true, replace: true, hard: 0 };
  def(B.BOULEAU, 'Tronc de bouleau', T('birch_side', 'birch_top'), { hard: 2, tool: 'hache' });
  def(B.F_BOULEAU, 'Feuillage de bouleau', T('birch_leaves'), { opaque: false, cutout: true, leaves: true, hard: 0.2, tool: 'hache', drop: r => r() < 0.05 ? [I.BATON, 1] : null });
  def(B.GRES, 'Grès', T('sandstone_side', 'sandstone_top', 'sandstone_bottom'), { hard: 0.8, tool: 'pioche', tier: 0 });
  def(B.ARGILE, 'Argile', T('clay'), { hard: 0.6, tool: 'pelle' });
  // coffre : comportement (inventaire) géré côté jeu ; tex.front = face avant (orientée vers le côté le plus dégagé)
  def(B.COFFRE, 'Coffre', { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, { hard: 2.5, tool: 'hache' });
  // les hautes herbes lâchent parfois des graines de blé
  def(B.HERBES, 'Hautes herbes', T('tallgrass'), Object.assign({}, PLANT, { drop: r => r() < 0.14 ? [I.GRAINES, 1] : null }));
  def(B.FLEUR_R, 'Fleur rubis', T('flower_red'), PLANT);
  def(B.FLEUR_J, 'Fleur d\'ambre', T('flower_yellow'), PLANT);
  def(B.ARBUSTE, 'Arbuste sec', T('deadbush'), Object.assign({}, PLANT, { drop: r => r() < 0.6 ? [I.BATON, 1] : null }));
  // cactus : solide mais un peu plus fin que le bloc (forme 'cactus'), pique au contact (hurt, à gérer côté jeu)
  def(B.CACTUS, 'Cactus', T('cactus_side', 'cactus_top', 'cactus_bottom'), { opaque: false, shape: 'cactus', hard: 0.4, hurt: 1 });
  def(B.NEIGE_BLOC, 'Bloc de neige', T('snow'), { hard: 0.4, tool: 'pelle' });
  def(B.GRAVIER, 'Gravier', T('gravel'), { hard: 0.6, tool: 'pelle' });
  // --- agriculture : terre labourée (sèche / hydratée près de l'eau) et blé en 4 stades (forme en croix, tombe sans support) ---
  def(B.LABOUR, 'Terre labourée', T('dirt', 'farmland'), { hard: 0.6, tool: 'pelle', drop: B.TERRE });
  def(B.LABOUR_H, 'Terre labourée humide', T('dirt', 'farmland_wet'), { hard: 0.6, tool: 'pelle', drop: B.TERRE });
  const CROP = Object.assign({}, PLANT, { replace: false, crop: true });
  def(B.BLE_0, 'Pousse de blé', T('wheat_0'), Object.assign({}, CROP, { drop: I.GRAINES, stage: 0 }));
  def(B.BLE_1, 'Jeune blé', T('wheat_1'), Object.assign({}, CROP, { drop: I.GRAINES, stage: 1 }));
  def(B.BLE_2, 'Blé en herbe', T('wheat_2'), Object.assign({}, CROP, { drop: I.GRAINES, stage: 2 }));
  def(B.BLE_3, 'Blé mûr', T('wheat_3'), Object.assign({}, CROP, { drop: I.BLE, stage: 3 }));   // + graines : farm.js
  // --- pierre moussue des ruines ---
  def(B.P_MOUSSUE, 'Pierre moussue', T('mossy_cobble'), { hard: 2, tool: 'pioche', tier: 0 });
  def(B.BRIQUES_M, 'Briques moussues', T('mossy_bricks'), { hard: 1.5, tool: 'pioche', tier: 0 });
  D[B.FEUILLES].leaves = true;
  D[B.EAU].shade = 1; D[B.FEUILLES].shade = 1; D[B.F_BOULEAU].shade = 1;
  // lumière des blocs (0..15), propagée par le mesher
  D[B.TORCHE].light = 14; D[B.LUMICRISTAL].light = 13; D[B.LAVE].light = 13; D[B.BRAISIER].light = 11; D[B.PORTAIL].light = 11;

  // objets (non posables) et outils
  const IT = VX.ITEMS = {};
  const it = (id, name, icon, o) => { IT[id] = Object.assign({ id, name, icon, stack: 64 }, o || {}); };
  it(I.BATON, 'Bâton', 'stick', { fuel: 2.5 });
  it(I.CHARBON, 'Charbon', 'coal', { fuel: 40 });
  it(I.L_FER, 'Lingot de fer', 'ingot_iron');
  it(I.L_OR, 'Lingot d\'or', 'ingot_gold');
  it(I.SAPHIR, 'Saphir', 'sapphire');
  it(I.ECLAT, 'Éclat d\'astrium', 'shard');
  it(I.L_ASTRIUM, 'Lingot d\'astrium', 'ingot_astrium');
  it(I.POMME, 'Pomme', 'apple', { food: 4 });
  it(I.ALLUMEUR, 'Allumeur de portail', 'igniter', { stack: 1, dura: 64 });
  it(I.MORCEAU, 'Morceau de chapeau', 'cap_piece', { food: 2 });
  it(I.ROTI, 'Champignon rôti', 'roast', { food: 7 });
  it(I.VIANDE, 'Viande de bouffi', 'meat', { food: 3 });
  it(I.STEAK, 'Bouffi rôti', 'steak', { food: 8 });
  it(I.ESSENCE, 'Essence d’ombre', 'essence', { fuel: 60 });
  it(I.GRAINES, 'Graines de blé', 'seeds', { plant: B.BLE_0 });
  it(I.BLE, 'Blé', 'wheat');
  it(I.PAIN, 'Pain', 'bread', { food: 5 });
  it(I.ARC, 'Arc', 'bow', { stack: 1, dura: 384, bow: true, fuel: 5 });
  it(I.BOUCLIER, 'Bouclier', 'shield', { stack: 1, dura: 336, shield: true });
  VX.TIERS = [
    { key: 'bois', name: 'en bois', col: '#b08a52', speed: 2, dura: 60, dmg: 4 },
    { key: 'pierre', name: 'en pierre', col: '#8d8d92', speed: 4, dura: 132, dmg: 5 },
    { key: 'fer', name: 'en fer', col: '#e6e6ea', speed: 6, dura: 250, dmg: 6 },
    { key: 'saphir', name: 'en saphir', col: '#3fa6ff', speed: 8, dura: 1560, dmg: 7 },
    { key: 'astrium', name: 'en astrium', col: '#d46bff', speed: 10, dura: 2030, dmg: 8 },
  ];
  VX.TOOLS = ['pioche', 'hache', 'pelle', 'epee'];
  const TN = { pioche: 'Pioche', hache: 'Hache', pelle: 'Pelle', epee: 'Épée' };
  VX.toolId = (tier, kind) => 200 + tier * 4 + VX.TOOLS.indexOf(kind);
  VX.TIERS.forEach((t, ti) => VX.TOOLS.forEach(k => { const id = VX.toolId(ti, k); IT[id] = { id, name: TN[k] + ' ' + t.name, icon: 'tool_' + k + '_' + ti, stack: 1, tool: { kind: k === 'epee' ? 'epee' : k, tier: ti, speed: t.speed }, dura: t.dura, fuel: ti === 0 ? 10 : 0 }; }));
  // houes des 5 matériaux (ids 155 à 159 : hors de la grille 200+ des outils, pour garder les anciennes sauvegardes)
  VX.HOE0 = 155; VX.hoeId = tier => VX.HOE0 + tier;
  VX.TIERS.forEach((t, ti) => { const id = VX.hoeId(ti); IT[id] = { id, name: 'Houe ' + t.name, icon: 'tool_houe_' + ti, stack: 1, tool: { kind: 'houe', tier: ti, speed: t.speed }, dura: t.dura, fuel: ti === 0 ? 10 : 0 }; });
  // combustibles et nourriture des blocs
  const FUEL = { [B.PLANCHES]: 15, [B.TRONC]: 15, [B.ETABLI]: 15, [B.TIGE]: 15 };
  VX.fuelOf = id => FUEL[id] || (IT[id] && IT[id].fuel) || 0;
  VX.isBlock = id => id > 0 && id < 100 && !!D[id];
  VX.nameOf = id => (D[id] && id < 100 ? D[id].name : IT[id] ? IT[id].name : '?');
  VX.stackOf = id => (IT[id] ? IT[id].stack : 64);
  VX.duraOf = id => (IT[id] && IT[id].dura) || 0;
  // ordre de la palette du mode créatif
  VX.CREATIVE = [B.HERBE, B.TERRE, B.PIERRE, B.GALETS, B.BRIQUES, B.TRONC, B.PLANCHES, B.FEUILLES, B.SABLE, B.VERRE, B.NEIGE, B.OBSIDIENNE, B.ETABLI, B.FOUR, B.TORCHE,
    B.M_CHARBON, B.M_FER, B.M_OR, B.M_SAPHIR, B.B_FER, B.B_OR, B.B_SAPHIR, B.CENDRITE, B.MOUSSE, B.TIGE, B.CHAPEAU, B.BASALTE, B.LUMICRISTAL, B.BRAISIER, B.M_ASTRIUM, B.B_ASTRIUM,
    I.BATON, I.CHARBON, I.L_FER, I.L_OR, I.SAPHIR, I.ECLAT, I.L_ASTRIUM, I.POMME, I.ROTI, I.ALLUMEUR].concat(VX.TIERS.flatMap((t, ti) => VX.TOOLS.map(k => VX.toolId(ti, k))));
  // blocs des biomes : rangés avec les autres blocs (avant les objets)
  VX.CREATIVE.splice(VX.CREATIVE.indexOf(I.BATON), 0, B.COFFRE, B.BOULEAU, B.F_BOULEAU, B.GRES, B.ARGILE, B.GRAVIER, B.NEIGE_BLOC, B.CACTUS, B.HERBES, B.FLEUR_R, B.FLEUR_J, B.ARBUSTE,
    B.P_MOUSSUE, B.BRIQUES_M, B.LABOUR, B.LABOUR_H);
  // agriculture et combat : à la suite des objets
  VX.CREATIVE.push(I.GRAINES, I.BLE, I.PAIN, I.ARC, I.BOUCLIER, ...VX.TIERS.map((t, ti) => VX.hoeId(ti)));

  /* ---------- recettes ---------- */
  const R = VX.RECIPES = [];
  // forme : lignes de caractères, clé : caractère -> id (ou liste d'ids acceptés)
  const shaped = (rows, keys, out, n) => R.push({ rows, keys, out, n: n || 1 });
  const shapeless = (items, out, n) => R.push({ items, out, n: n || 1 });

  shapeless([B.TRONC], B.PLANCHES, 4);
  shapeless([B.TIGE], B.PLANCHES, 4);
  shaped(['P', 'P'], { P: B.PLANCHES }, I.BATON, 4);
  shaped(['PP', 'PP'], { P: B.PLANCHES }, B.ETABLI);
  shaped(['GGG', 'G G', 'GGG'], { G: [B.GALETS, B.CENDRITE] }, B.FOUR);
  shaped(['C', 'S'], { C: I.CHARBON, S: I.BATON }, B.TORCHE, 4);
  shaped(['C', 'S'], { C: B.LUMICRISTAL, S: I.BATON }, B.TORCHE, 6);
  shaped(['PP', 'PP'], { P: B.PIERRE }, B.BRIQUES, 4);
  shaped(['F ', ' C'], { F: I.L_FER, C: [I.CHARBON, I.ECLAT] }, I.ALLUMEUR);
  shapeless([I.ECLAT, I.ECLAT, I.ECLAT, I.ECLAT, I.L_OR], I.L_ASTRIUM);
  // blocs de stockage et retour
  for (const [ing, blk] of [[I.L_FER, B.B_FER], [I.L_OR, B.B_OR], [I.SAPHIR, B.B_SAPHIR], [I.L_ASTRIUM, B.B_ASTRIUM]]) {
    shaped(['XXX', 'XXX', 'XXX'], { X: ing }, blk);
    shapeless([blk], ing, 9);
  }
  shaped(['XXX', 'XXX', 'XXX'], { X: I.CHARBON }, B.BRAISIER);
  // outils des 5 matériaux
  const MAT = [[B.PLANCHES, B.TIGE], [B.GALETS, B.CENDRITE, B.BASALTE], I.L_FER, I.SAPHIR, I.L_ASTRIUM];
  const SHAPES = { pioche: ['XXX', ' S ', ' S '], hache: ['XX', 'XS', ' S'], pelle: ['X', 'S', 'S'], epee: ['X', 'X', 'S'] };
  MAT.forEach((m, ti) => VX.TOOLS.forEach(k => shaped(SHAPES[k], { X: m, S: I.BATON }, VX.toolId(ti, k))));
  MAT.forEach((m, ti) => shaped(['XX', ' S', ' S'], { X: m, S: I.BATON }, VX.hoeId(ti)));
  // agriculture, pierre moussue
  shaped(['BBB'], { B: I.BLE }, I.PAIN);
  shapeless([B.GALETS, [B.FEUILLES, B.F_BOULEAU]], B.P_MOUSSUE);
  shapeless([B.BRIQUES, [B.FEUILLES, B.F_BOULEAU]], B.BRIQUES_M);

  // cuisson : entrée -> sortie
  VX.SMELT = {
    [B.SABLE]: B.VERRE, [B.GALETS]: B.PIERRE, [B.M_FER]: I.L_FER, [B.M_OR]: I.L_OR, [B.M_CHARBON]: I.CHARBON, [B.M_SAPHIR]: I.SAPHIR,
    [B.TRONC]: I.CHARBON, [B.TIGE]: I.CHARBON, [B.M_ASTRIUM]: I.ECLAT, [I.MORCEAU]: I.ROTI, [I.VIANDE]: I.STEAK, [B.CHAPEAU]: I.ROTI, [B.CENDRITE]: B.BRIQUES,
  };

  /* ---------- API du registre : ajouter du contenu sans toucher au moteur ---------- */
  VX.registry = {
    block(id, name, tex, opts) { def(id, name, typeof tex === 'string' ? T(tex) : tex, opts); return D[id]; },
    item(id, name, icon, opts) { it(id, name, icon, opts); return IT[id]; },
    shaped(rows, keys, out, n) { shaped(rows, keys, out, n); },
    shapeless(items, out, n) { shapeless(items, out, n); },
    smelt(input, output) { VX.SMELT[input] = output; },
    fuel(id, seconds) { FUEL[id] = seconds; },
    creative(id) { if (!VX.CREATIVE.includes(id)) VX.CREATIVE.push(id); },
  };
})();

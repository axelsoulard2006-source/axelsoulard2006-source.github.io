/* ===== catalog.js : jeux, cartes, difficultés, skins, accessoires, consommables ===== */
(function () {
  const BR = window.BR;

  BR.GAMES = [
    { id: 'backrooms', name: 'BACKROOMS', tag: 'Survie coopérative', desc: 'Fuyez les entités, trouvez les fusibles, échappez-vous ensemble.', ready: true, hue: 48 },
    { id: 'ascension', name: 'COLOSSES', sub: 'L\'ASCENSION', tag: 'Roguelite en équipe · 10 étages', desc: 'Grimpez une tour de 10 étages entre amis : hordes, élites, gardiens géants. Choisissez des bénédictions qui se combinent, votez pour la prochaine porte, relevez vos potes. Chaque course est différente.', ready: true, hue: 28, pres: 'colosses', isNew: true },
    { id: 'colosses', name: 'COLOSSES', sub: 'CLASSIQUE', tag: 'Boss en équipe · Duels', desc: 'La version d\'origine : boss géants, duels entre amis, compétences à la roulette.', ready: true, hue: 18, old: true },
    { id: 'bousculade', name: 'BOUSCULADE', tag: 'Party game · jusqu\'à 8 potes', desc: 'Course d\'obstacles ultra rapide : sauts muraux, toboggans, trampolines, un parcours différent à chaque partie, puis survie sur un plateau qui s\'effrite. Saute, plonge, bouscule… le dernier debout gagne !', ready: true, hue: 320, isNew: true },
    { id: 'portes', name: 'PORTES', tag: 'Salles à défis · quiz BUT GMP', desc: 'Une suite de salles toutes différentes : lave, plancher pourri, 1-2-3 soleil, lasers, labyrinthe, digicode… entre deux questions de génie mécanique. Attention à ce qui te poursuit.', ready: true, hue: 135 },
  ];

  BR.RARITY = {
    commun: { label: 'Commun', color: '#9aa4b2' },
    rare: { label: 'Rare', color: '#4aa3ff' },
    epique: { label: 'Épique', color: '#b66bff' },
    legendaire: { label: 'Légendaire', color: '#ffb52e' },
    mythique: { label: 'Mythique', color: '#ff3d6e' },
  };

  /* ---------- Difficultés (style nextbot : les entités te traquent en permanence ; le sprint reste ta meilleure arme) ---------- */
  BR.DIFFS = {
    easy:      { id: 'easy', name: 'Facile', color: '#6fd37a', desc: 'Entités plus lentes que ta course, elles abandonnent si tu es loin.', chase: 8.6, wander: 4.8, hunt: 34, monMul: 0.8, fuses: 3, mult: 0.7, grace: 10 },
    normal:    { id: 'normal', name: 'Normal', color: '#ffd24a', desc: 'Elles te repèrent de loin et ne lâchent pas. Cours, saute, glisse.', chase: 9.8, wander: 5.2, hunt: 55, monMul: 1.0, fuses: 4, mult: 1.0, grace: 7 },
    hard:      { id: 'hard', name: 'Difficile', color: '#ff8a3d', desc: 'Presque aussi rapides que toi, et une de plus.', chase: 10.8, wander: 5.8, hunt: 85, monMul: 1.35, fuses: 5, mult: 1.45, grace: 5 },
    nightmare: { id: 'nightmare', name: 'Cauchemar', color: '#ff4a5e', desc: 'Plus rapides que ta course. Seuls les sauts et les glissades te sauvent.', chase: 11.8, wander: 6.4, hunt: 999, monMul: 1.7, fuses: 5, mult: 2.0, grace: 3 },
  };

  /* ---------- Joueur ---------- */
  BR.PLAYER = { walk: 6.6, sprint: 11.6, crouch: 3.4, slide: 15.5, dash: 22, radius: 0.32, eye: 1.62, eyeCrouch: 1.0, jump: 7.7, grav: 18 };

  /* ---------- Cartes (toutes sur plusieurs étages) ---------- */
  BR.MAPS = [
    { id: 'backrooms', kind: 'backrooms', theme: 'backrooms', name: 'Backrooms', sub: 'Niveau 0 — à étages', size: 46, desc: 'Papier peint jaune, néons qui grésillent, salles de 8 m de haut, balcons et trous dans le plancher.', color: '#d9c25a' },
    { id: 'mall', kind: 'mall', theme: 'mall', name: 'Centre commercial', sub: 'Galerie fermée la nuit', desc: 'Deux niveaux de boutiques, escalators, passerelles au-dessus du vide et musique d\'ascenseur.', color: '#7fb8e6' },
    { id: 'ville', kind: 'city', theme: 'city', name: 'Ville', sub: 'Quartier abandonné', desc: 'Rues, immeubles à traverser, toits, parkings et passerelles d\'où sauter.', color: '#e07a5a' },
    { id: 'parc', kind: 'park', theme: 'park', outdoor: true, name: 'Parc', sub: 'Jardin public, la nuit', desc: 'Allées sous les arbres, labyrinthe de haies, kiosque à musique, bassin et petit pont, aire de jeux, buvette au toit-terrasse.', color: '#6fbf73' },
    { id: 'bowling', kind: 'bowling', theme: 'bowling', name: 'Bowling', sub: 'Fermé pour la nuit', desc: 'Pistes cirées, salle d\'arcade, billards, bar, vestiaire à chaussures, mezzanine et salle des machines derrière les quilles.', color: '#c76bd8' },
    { id: 'tilted', kind: 'tilted', theme: 'tilted', outdoor: true, name: 'Tilted Towers', sub: 'Le quartier des tours', desc: 'Place de l\'horloge, immeubles de trois étages à traverser, toits, rues encombrées de voitures.', color: '#5aa0e0' },
    { id: 'halle6', kind: 'halle6', theme: 'halle6', name: 'Halle 6', sub: 'Île de Nantes, la nuit', desc: 'Ancienne halle Alstom : grande nef sous les sheds vitrés, coursives et passerelles métalliques, cube suspendu, fablab, salles et studio.', color: '#8fb4d8' },
    { id: 'iut', kind: 'iut', theme: 'iut', outdoor: true, name: 'IUT de Nantes', sub: 'Campus de la Fleuriaye — Carquefou', desc: 'Hall technologique du département GMP (tours, fraiseuses, centres d\'usinage), amphi, couloirs, salles de TP, parkings et pelouses.', color: '#e0a84a' },
    { id: 'verdun', kind: 'verdun', theme: 'verdun', outdoor: true, name: 'Verdun', sub: 'Champ de bataille, 1916', desc: 'Tranchées en zigzag, boyaux, abris souterrains, cratères d\'obus, barbelés et no man\'s land dans le brouillard, sous les fusées éclairantes.', color: '#9a8a6a' },
    { id: 'cimetiere', kind: 'cimetiere', theme: 'cimetiere', outdoor: true, name: 'Cimetière', sub: 'Vieux cimetière, la nuit, dans la brume', desc: 'On se réveille dans la crypte. Tombes penchées, anges qui pleurent, mausolées, chapelle gothique, ossuaire, fosses fraîchement creusées et corbeaux dans le brouillard.', color: '#8c95a6' },
    { id: 'piscine', kind: 'piscine', theme: 'piscine', name: 'Piscine', sub: 'Niveau 37 — Poolrooms', desc: 'On se réveille au fond d\'un bassin vidé. Halles carrelées sans fin, bassins profonds où l\'on peut plonger et nager, sous-sol inondé, plages en pente douce et toboggans.', color: '#7cc7d8' },
  ];

  /* ---------- Consommables ---------- */
  BR.ITEMS = {
    energy:  { id: 'energy', name: 'Boisson Énergisante', price: 120, desc: '+25 % de vitesse pendant 8 s.', max: 3 },
    flare:   { id: 'flare', name: 'Fusée Éblouissante', price: 90, desc: 'Lancez-la : éblouit les entités proches pendant 4 s.', max: 3 },
    decoy:   { id: 'decoy', name: 'Leurre Sonore', price: 90, desc: 'Lancez-le : les entités proches le poursuivent pendant 10 s.', max: 3 },
    medkit:  { id: 'medkit', name: 'Kit de Secours', price: 160, desc: 'Vous relève automatiquement la première fois que vous tombez.', max: 2 },
    radar:   { id: 'radar', name: 'Détecteur', price: 140, desc: 'Révèle les entités sur la carte pendant 15 s.', max: 3 },
    smoke:   { id: 'smoke', name: 'Fumigène', price: 110, desc: 'Les entités perdent votre trace pendant 6 s.', max: 3 },
    compass: { id: 'compass', name: 'Boussole', price: 110, desc: 'Indique la direction du prochain objectif pendant 25 s.', max: 3 },
  };
  BR.ITEM_ORDER = ['energy', 'flare', 'decoy', 'medkit', 'radar', 'smoke', 'compass'];
  BR.LOADOUT_SLOTS = 3;

  /* ---------- Personnages : plus ils sont rares, plus ils ont d'aura (yeux lumineux, aura de base) ---------- */
  BR.SKINS = [
    { id: 'survivor', model: 'char_knight', name: 'Chevalier', rarity: 'commun', price: 0, desc: 'Casque, cape et sang-froid. Le héros de base, déjà classe.', sig: null },
    { id: 'barbarian', model: 'char_barbarian', name: 'Barbare', rarity: 'commun', price: 300, desc: 'Torse nu, cornes, aucune peur. Fonce d\'abord, réfléchit jamais.', sig: null },
    { id: 'rogue', model: 'char_rogue', name: 'Voleuse', rarity: 'commun', price: 350, desc: 'Rapide, discrète, toujours un coup d\'avance.', sig: null },
    { id: 'minion', model: 'char_skeleton_minion', name: 'Squelette', rarity: 'rare', price: 600, desc: 'Il a déjà fui les Backrooms une fois. Ça s\'est mal fini.', sig: null },
    { id: 'mage', model: 'char_mage', name: 'Mage', rarity: 'rare', price: 750, desc: 'Chapeau pointu, grimoire et beaucoup trop de confiance.', sig: null },
    { id: 'hooded', model: 'char_rogue_hooded', name: 'Assassin', rarity: 'rare', price: 900, desc: 'Capuche, cape, regard dans l\'ombre.', sig: null },
    { id: 'sk_warrior', model: 'char_skeleton_warrior', name: 'Guerrier d\'Os', rarity: 'epique', price: 1500, desc: 'Ses os brûlent encore. Des braises infernales le suivent.', sig: 'inferno', eyes: '#ff7a1a' },
    { id: 'sk_mage', model: 'char_skeleton_mage', name: 'Nécromancien', rarity: 'epique', price: 1700, desc: 'Une fumée d\'encre s\'échappe de ses côtes.', sig: 'shadow', eyes: '#b77dff' },
    { id: 'darkknight', model: 'char_knight', tint: 'brightness(0.42) saturate(0.35) contrast(1.35)', name: 'Chevalier Noir', rarity: 'epique', price: 1900, desc: 'Armure d\'encre, la foudre bleue au poing.', sig: 'thunder', eyes: '#58c8ff' },
    { id: 'reaper', model: 'char_skeleton_rogue', tint: 'hue-rotate(250deg) saturate(1.7) brightness(0.75)', name: 'Faucheuse', rarity: 'legendaire', price: 3200, desc: 'Là où elle passe, l\'espace se tord et les orbes noirs tournent.', sig: 'void', eyes: '#c58bff' },
    { id: 'archmage', model: 'char_mage', tint: 'sepia(0.85) saturate(2.4) hue-rotate(-14deg) brightness(1.12)', name: 'Archimage Doré', rarity: 'legendaire', price: 3500, desc: 'Un pilier de lumière, une auréole. Les dieux prennent des notes.', sig: 'divine', eyes: '#ffe27a' },
    { id: 'monarch', model: 'char_rogue_hooded', tint: 'brightness(0.3) saturate(2) hue-rotate(-28deg) contrast(1.5)', name: 'Monarque des Ombres', rarity: 'legendaire', price: 3800, desc: 'Éclairs noirs et rouges, ondes de choc. Le roi devant qui tout s\'agenouille.', sig: 'conqueror', eyes: '#ff2a3a' },
    /* MYTHIQUES : accessoires Blender + effets dédiés (js/skins-fx.js, champ fx) ; eyePos = yeux (repère de l'os de la tête) */
    { id: 'lich', model: 'char_skeleton_mage', tint: 'hue-rotate(170deg) saturate(1.5) brightness(1.1)', name: 'Roi-Liche', rarity: 'mythique', price: 9000, fx: 'lich', sig: 'm_lich', eyes: '#9ff6ff', eyePos: [0.17, 0.42, 0.36],
      desc: 'Sa couronne de glace ne fond jamais. Le sol gèle sous ses pas, trois éclats veillent sur lui et son regard laisse un sillage d\'hiver.',
      feats: ['Couronne & épaules de glace', 'Givre qui s\'étend au sol', 'Éclats en orbite', 'Empreintes de givre', 'Regard à traînée'] },
    { id: 'magma', model: 'char_barbarian', tint: 'brightness(0.3) saturate(0.5) contrast(1.5)', name: 'Titan de Magma', rarity: 'mythique', price: 16000, fx: 'magma', sig: 'm_magma', eyes: '#ffb03a', eyePos: [0.19, 0.48, 0.56],
      desc: 'Une armure d\'obsidienne fendue de lave qui bat comme un cœur. Couronne de feu, rochers arrachés au sol, empreintes brûlantes.',
      feats: ['Cornes d\'obsidienne', 'Fissures de lave qui pulsent', 'Couronne de feu', 'Rochers en lévitation', 'Sol qui se fend'] },
    { id: 'valkyrie', model: 'char_rogue', tint: 'grayscale(0.75) sepia(0.35) brightness(1.4) contrast(0.95)', name: 'Valkyrie Céleste', rarity: 'mythique', price: 28000, fx: 'valk', sig: 'm_valk', eyes: '#ffe9a0', eyePos: [0.19, 0.5, 0.55],
      desc: 'Des ailes de lumière pure, un halo de runes, des plumes d\'or qui tombent du ciel. C\'est elle qui choisit qui tombe au combat.',
      feats: ['Ailes d\'énergie qui battent', 'Halo de runes', 'Diadème ailé', 'Plumes de lumière', 'Cercle runique au sol'] },
    { id: 'voidwalker', model: 'char_rogue_hooded', tint: 'brightness(0.16) saturate(2) hue-rotate(240deg)', name: 'Spectre du Néant', rarity: 'mythique', price: 50000, fx: 'void', sig: 'm_void', eyes: '#c58bff', eyePos: [0.17, 0.44, 0.66],
      desc: 'Pas de visage, juste le vide et deux yeux. Son corps est une galaxie, sa cape un lambeau d\'ombre, et ses échos le suivent partout.',
      feats: ['Corps-galaxie', 'Cape spectrale qui flotte', 'Échos fantômes', 'Couronne brisée', 'Flaque d\'ombre vivante'] },
    { id: 'eclipse', model: 'char_knight', tint: 'brightness(0.24) sepia(0.6) saturate(2) hue-rotate(-20deg) contrast(1.6)', name: 'Éclipse', rarity: 'mythique', price: 100000, fx: 'eclipse', sig: 'm_eclipse', eyes: '#ff3a2a', eyePos: [0.18, 0.5, 0.72],
      desc: 'Le Dernier Souverain. Un soleil noir derrière la tête, six lames dans son dos, la foudre noire autour de lui et la terre qui se fend sous ses pas. Il n\'y en aura qu\'un.',
      feats: ['Soleil noir', 'Six lames flottantes', 'Couronne & cornes du roi', 'Foudre noire', 'Échos écarlates', 'Cercle d\'éclipse au sol'] },
  ];

  /* ---------- Auras (remplacent les accessoires) : effets autour du personnage, plus fort quand il bouge ---------- */
  BR.AURAS = [
    { id: 'embers', name: 'Braises', rarity: 'commun', price: 300, desc: 'Des étincelles orangées s\'élèvent de vous.', fx: { c: '#ff8a2a', c2: '#ffd36a', parts: 'ember', n: 40 } },
    { id: 'wind', name: 'Bourrasque', rarity: 'commun', price: 300, desc: 'Un vent blanc tourne autour de vous.', fx: { c: '#dfefff', c2: '#ffffff', parts: 'wind', n: 46 } },
    { id: 'frost', name: 'Givre', rarity: 'rare', price: 800, desc: 'Cristaux de glace et brume froide à vos pieds.', fx: { c: '#7fd7ff', c2: '#e9fbff', parts: 'frost', n: 80, ring: true } },
    { id: 'spark', name: 'Étincelles', rarity: 'rare', price: 900, desc: 'Des arcs électriques crépitent sur votre corps.', fx: { c: '#ffd75e', c2: '#ffffff', parts: 'spark', n: 70, bolts: 1, ring: true } },
    { id: 'sakura', name: 'Sakura', rarity: 'rare', price: 850, desc: 'Des pétales de cerisier tourbillonnent autour de vous.', fx: { c: '#ff9ccf', c2: '#ffe3f1', parts: 'petal', n: 70 } },
    { id: 'inferno', name: 'Inferno', rarity: 'epique', price: 1600, desc: 'Une flamme vous enveloppe entièrement.', fx: { c: '#ff4a12', c2: '#ffd24a', parts: 'ember', n: 130, shell: 1, ring: true } },
    { id: 'shadow', name: 'Ombre Vivante', rarity: 'epique', price: 1700, desc: 'Une fumée d\'encre se tord autour de vous.', fx: { c: '#7b3cff', c2: '#1a0b2e', parts: 'smoke', n: 120, shell: 1, dark: true, ring: true } },
    { id: 'thunder', name: 'Tempête', rarity: 'epique', price: 1800, desc: 'La foudre bleue vous traverse en permanence.', fx: { c: '#4fb6ff', c2: '#e9f6ff', parts: 'spark', n: 120, bolts: 3, shell: 1, ring: true } },
    { id: 'conqueror', name: 'Volonté du Conquérant', rarity: 'legendaire', price: 3500, desc: 'Éclairs noirs et rouges, ondes de choc à chaque pas. Les faibles s\'évanouissent.', fx: { c: '#ff1d2e', c2: '#0a0003', parts: 'spark', n: 200, bolts: 5, blackBolts: true, shell: 2, ring: true, shock: true, dark: true } },
    { id: 'divine', name: 'Lumière Divine', rarity: 'legendaire', price: 3600, desc: 'Un pilier de lumière dorée, une auréole, des particules sacrées.', fx: { c: '#ffd34a', c2: '#ffffff', parts: 'mote', n: 220, shell: 2, ring: true, halo: true, pillar: true, shock: true } },
    { id: 'void', name: 'Néant', rarity: 'legendaire', price: 3800, desc: 'Flammes violettes, orbes noirs en orbite, l\'espace se tord autour de vous.', fx: { c: '#9b4dff', c2: '#12001f', parts: 'void', n: 220, shell: 2, ring: true, orbs: 4, bolts: 2, shock: true, dark: true } },
    // auras de base des skins mythiques (skinOnly : pas en vente, portées uniquement par leur personnage)
    { id: 'm_lich', skinOnly: true, name: 'Hiver Éternel', rarity: 'mythique', price: 0, desc: 'Le givre du Roi-Liche.', fx: { c: '#6fdcff', c2: '#effcff', parts: 'frost', n: 110, shell: 1, ring: true, shock: true } },
    { id: 'm_magma', skinOnly: true, name: 'Cœur de Magma', rarity: 'mythique', price: 0, desc: 'La fournaise du Titan.', fx: { c: '#ff3a0a', c2: '#ffb02e', parts: 'ember', n: 140, shell: 1, ring: true, shock: true } },
    { id: 'm_valk', skinOnly: true, name: 'Lumière Céleste', rarity: 'mythique', price: 0, desc: 'La lumière de la Valkyrie.', fx: { c: '#ffd45a', c2: '#ffffff', parts: 'mote', n: 150, ring: true, pillar: true, shock: true } },
    { id: 'm_void', skinOnly: true, name: 'Néant Absolu', rarity: 'mythique', price: 0, desc: 'Le vide du Spectre.', fx: { c: '#8f4dff', c2: '#12001f', parts: 'void', n: 160, ring: true, bolts: 2, dark: true } },
    { id: 'm_eclipse', skinOnly: true, name: 'Couronne d\'Éclipse', rarity: 'mythique', price: 0, desc: 'La foudre noire du Dernier Souverain.', fx: { c: '#ff2418', c2: '#0a0003', parts: 'spark', n: 180, bolts: 5, blackBolts: true, shell: 1, ring: true, shock: true, dark: true } },
  ];
  BR.skinById = id => BR.SKINS.find(s => s.id === id) || BR.SKINS[0];
  BR.auraById = id => BR.AURAS.find(a => a.id === id) || null;
  // aura réellement affichée : celle équipée, sinon la signature du personnage (épique / légendaire)
  BR.auraOf = look => BR.auraById(look && look.aura) || BR.auraById(BR.skinById(look && look.skin).sig);
  // anciens accessoires (remboursés automatiquement)
  BR.OLD_ACC = { cap: 150, beanie: 120, party: 100, cowboy: 380, headphones: 300, horns: 520, halo: 700, crown: 1200, shades: 180, goggles: 220, mustache: 130, clownnose: 160, gasmask: 480, scarf: 200, bowtie: 150, medal: 320, backpack: 250, cape: 500, wings: 1000, jetpack: 1100 };
  BR.OLD_SKINS = { guard: 200, explorer: 450, scientist: 600, hazmat: 750, raincoat: 700, neon: 1200, ninja: 1400, astro: 2200, robot: 2800, vagabond: 300, agent: 700, hunter: 800, paladin: 900, specter: 1500, shogun: 1700, captain: 1900, emperor: 3200 };

  /* ---------- Niveaux ---------- */
  BR.xpForLevel = lv => Math.round(80 * Math.pow(lv, 1.5));   // XP nécessaire pour passer du niveau lv au suivant
  BR.levelFromXp = function (xp) {
    let lv = 1, rest = xp;
    while (rest >= BR.xpForLevel(lv)) { rest -= BR.xpForLevel(lv); lv++; }
    return { level: lv, into: rest, need: BR.xpForLevel(lv) };
  };
  BR.RANKS = [[1, 'Égaré'], [4, 'Rôdeur'], [8, 'Explorateur'], [13, 'Survivant'], [20, 'Vétéran'], [30, 'Insomniaque'], [45, 'Légende des Backrooms']];
  BR.rankName = lv => { let r = BR.RANKS[0][1]; for (const [l, n] of BR.RANKS) if (lv >= l) r = n; return r; };

  BR.TIPS = [
    'Accroupi en pleine course : vous glissez et gagnez de la vitesse.',
    'Les entités ne savent pas sauter : un saut au bon moment peut vous sauver.',
    'Un joueur à terre peut être relevé : restez près de vos coéquipiers.',
    'Sautez d\'un balcon ou d\'un toit : les entités doivent faire le tour par les escaliers.',
    'Plus vous êtes loin, moins elles vous sentent : la distance est votre amie.',
    'Prendre le dernier fusible déclenche l\'alarme : toutes les entités accourent.',
    'Un Leurre Sonore peut sauver toute l\'équipe.',
    'Un joueur isolé attire plus l\'attention. Restez groupés !',
    'Un Fumigène au bon moment fait perdre votre trace à toutes les entités.',
    'Appuyez sur V pour marquer un endroit à vos coéquipiers.',
  ];
  BR.QUICKCHAT = ['Par ici !', 'Attention !', 'Courez !', 'J\'ai un fusible', 'Besoin d\'aide', 'Merci !'];
})();

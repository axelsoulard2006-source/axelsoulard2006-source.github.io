/* ===== arena/data.js : jeu 2 « COLOSSES » — armes, compétences, ultimes, boss, roulettes, icônes ===== */
(function () {
  const BR = window.BR;
  const AR = (BR.ARENA = {});

  /* ---------------- styles d'arme (attaque de base) ----------------
     combo : coups enchaînés au clic gauche ; heavy : clic maintenu ; air : attaque en l'air (plongeon) */
  AR.WEAPONS = {
    blade: {
      name: 'Lame & Bouclier', tag: 'Équilibrée · parade facile', stats: [3, 3, 2], desc: 'Équilibré. Parade facile (fenêtre plus large), combos rapides et fiables.', color: '#7ec8ff',
      models: [['char_knight', '1H_Sword', 'R'], ['char_knight', 'Round_Shield', 'L']], parry: 0.26,
      combo: [
        { a: '1H_Melee_Attack_Slice_Diagonal', sp: 1.5, hit: 0.2, dur: 0.42, dmg: 62, range: 2.9, arc: 120, lunge: 3.5, slash: [0.6, -0.5] },
        { a: '1H_Melee_Attack_Slice_Horizontal', sp: 1.6, hit: 0.18, dur: 0.4, dmg: 66, range: 2.9, arc: 140, lunge: 3, slash: [0, 1] },
        { a: '1H_Melee_Attack_Chop', sp: 1.5, hit: 0.22, dur: 0.46, dmg: 78, range: 2.8, arc: 90, lunge: 3.5, slash: [1.4, 0] },
        { a: '1H_Melee_Attack_Stab', sp: 1.3, hit: 0.24, dur: 0.6, dmg: 120, range: 3.4, arc: 60, lunge: 7, slash: [0.2, 1], fin: true },
      ],
      heavy: { a: 'Block_Attack', sp: 1.2, hit: 0.3, dur: 0.75, dmg: 210, range: 3.6, arc: 160, lunge: 5, shock: 4 },
      air: { dmg: 140, r: 3.6 },
    },
    greatsword: {
      name: 'Espadon', tag: 'Lente · coups dévastateurs', stats: [1, 5, 3], desc: 'Lent mais dévastateur. Coups larges, gros dégâts de posture : brise les boss plus vite.', color: '#ff9a4a',
      models: [['char_knight', '2H_Sword', 'R']], parry: 0.18, posture: 1.6,
      combo: [
        { a: '2H_Melee_Attack_Slice', sp: 1.35, hit: 0.3, dur: 0.62, dmg: 118, range: 3.6, arc: 170, lunge: 3, slash: [0.3, 1], big: 1.3 },
        { a: '2H_Melee_Attack_Chop', sp: 1.35, hit: 0.32, dur: 0.66, dmg: 138, range: 3.6, arc: 90, lunge: 3.5, slash: [1.5, 0], big: 1.3 },
        { a: '2H_Melee_Attack_Spin', sp: 1.3, hit: 0.34, dur: 0.8, dmg: 190, range: 3.9, arc: 360, lunge: 2, slash: [0, 1], big: 1.6, fin: true },
      ],
      heavy: { a: '2H_Melee_Attack_Spinning', sp: 1.4, hit: 0.25, dur: 1.0, dmg: 95, hits: 4, range: 3.8, arc: 360, lunge: 2.5 },
      air: { dmg: 220, r: 4.6 },
    },
    daggers: {
      name: 'Dagues jumelles', tag: 'Très rapide · critiques', stats: [5, 2, 1], desc: 'Très rapide. Coups critiques fréquents, esquives rechargées plus vite.', color: '#c27bff',
      models: [['char_rogue', 'Knife', 'R'], ['char_rogue', 'Knife_Offhand', 'L']], parry: 0.2, crit: 0.25, dashCd: 0.75,
      combo: [
        { a: 'Dualwield_Melee_Attack_Slice', sp: 1.9, hit: 0.13, dur: 0.3, dmg: 44, range: 2.5, arc: 130, lunge: 3.5, slash: [0.5, 1], small: 1 },
        { a: 'Dualwield_Melee_Attack_Chop', sp: 1.9, hit: 0.14, dur: 0.3, dmg: 46, range: 2.5, arc: 100, lunge: 3, slash: [1.3, 0], small: 1 },
        { a: 'Dualwield_Melee_Attack_Stab', sp: 2.0, hit: 0.12, dur: 0.28, dmg: 48, range: 2.7, arc: 70, lunge: 4, slash: [0.1, 1], small: 1 },
        { a: 'Dualwield_Melee_Attack_Slice', sp: 2.1, hit: 0.12, dur: 0.28, dmg: 50, range: 2.5, arc: 140, lunge: 3, slash: [-0.6, 1], small: 1 },
        { a: 'Unarmed_Melee_Attack_Kick', sp: 1.6, hit: 0.18, dur: 0.45, dmg: 96, range: 2.8, arc: 90, lunge: 6, slash: [0.2, 1], fin: true },
      ],
      heavy: { a: 'Dualwield_Melee_Attack_Stab', sp: 1.0, hit: 0.2, dur: 0.6, dmg: 70, hits: 5, range: 3.2, arc: 80, lunge: 9 },
      air: { dmg: 110, r: 3.2 },
    },
    staff: {
      name: 'Bâton arcanique', tag: 'Tire à distance · magie', stats: [3, 2, 5], desc: 'Attaques à distance (projectiles). Plus d\'énergie générée, compétences rechargées plus vite.', color: '#6fffe0',
      models: [['char_mage', '2H_Staff', 'R']], parry: 0.18, ranged: true, cdr: 0.12, energy: 1.5,
      combo: [
        { a: 'Spellcast_Shoot', sp: 2.0, hit: 0.14, dur: 0.34, dmg: 54, bolt: 1 },
        { a: 'Spellcast_Shoot', sp: 2.0, hit: 0.14, dur: 0.34, dmg: 54, bolt: 1 },
        { a: 'Spellcast_Raise', sp: 1.8, hit: 0.22, dur: 0.5, dmg: 46, bolt: 3, fin: true },
      ],
      heavy: { a: 'Spellcast_Long', sp: 1.4, hit: 0.5, dur: 0.95, dmg: 260, orb: 1 },
      air: { dmg: 120, r: 3.6 },
    },
  };

  // tempo global des attaques de base (plus haut = plus nerveux)
  const TEMPO = 1.25;
  for (const W of Object.values(AR.WEAPONS)) for (const st of W.combo.concat([W.heavy])) { st.sp *= TEMPO; st.hit /= TEMPO; st.dur /= TEMPO; if (st.lunge) st.lunge *= 1.35; }

  /* ---------------- compétences ----------------
     rarity : commun | rare | epique | legendaire ; type : skill | ult
     cd (s), cost (énergie), base : dégâts niveau 1 ; aw : éveils débloqués aux niveaux 3 et 5 */
  AR.SKILLS = [
    // ----- communes -----
    { id: 'fente', name: 'Fente Éclair', rarity: 'commun', type: 'skill', icon: 'dash', color: '#7ec8ff', cd: 5, cost: 15, base: 160,
      desc: 'Fonce de 9 m en traversant les ennemis, taille tout ce qui est sur la trajectoire. Invulnérable pendant la ruée.', aw: ['Laisse une traînée électrique qui frappe une 2e fois.', 'Peut être relancée une fois dans les 2 s (double fente).'] },
    { id: 'onde', name: 'Onde de Choc', rarity: 'commun', type: 'skill', icon: 'shock', color: '#ffd36b', cd: 7, cost: 20, base: 220,
      desc: 'Frappe le sol : onde de 6 m qui projette en l\'air. Gros dégâts de posture.', aw: ['Rayon +40 %.', 'Trois ondes successives.'] },
    { id: 'tourbillon', name: 'Lames Tournoyantes', rarity: 'commun', type: 'skill', icon: 'spin', color: '#9ee6ff', cd: 8, cost: 20, base: 70,
      desc: 'Tourbillon de lames pendant 1,4 s (6 coups), tu peux te déplacer en tournant.', aw: ['Aspire les petits ennemis vers toi.', '10 coups, la dernière rotation explose.'] },
    { id: 'traits', name: 'Traits Arcaniques', rarity: 'commun', type: 'skill', icon: 'bolt3', color: '#b58cff', cd: 4, cost: 12, base: 90,
      desc: 'Trois projectiles à tête chercheuse vers la cible visée.', aw: ['5 projectiles.', 'Chaque impact rend 3 d\'énergie.'] },
    { id: 'bond', name: 'Bond du Colosse', rarity: 'commun', type: 'skill', icon: 'leap', color: '#ff9a4a', cd: 9, cost: 22, base: 260,
      desc: 'Bondit vers la zone visée (16 m max) et retombe en écrasant le sol.', aw: ['Laisse le sol en fusion 3 s (brûlure).', 'Le saut te rend invulnérable et réduit les cooldowns de 1 s.'] },
    { id: 'garde', name: 'Garde de Fer', rarity: 'commun', type: 'skill', icon: 'shield', color: '#cfd8e6', cd: 12, cost: 15, base: 120,
      desc: 'Bouclier pendant 2,5 s qui absorbe 400 dégâts. Chaque coup encaissé renvoie une décharge.', aw: ['Absorbe 700 dégâts.', 'À la fin, le bouclier explose (dégâts stockés ×2).'] },
    // ----- rares -----
    { id: 'chaine', name: 'Chaîne Foudroyante', rarity: 'rare', type: 'skill', icon: 'lightning', color: '#7fd8ff', cd: 6, cost: 22, base: 240,
      desc: 'Un éclair frappe la cible et rebondit 4 fois entre les ennemis et les parties du boss.', aw: ['7 rebonds.', 'Chaque rebond paralyse 0,3 s et inflige +15 %.'] },
    { id: 'lance', name: 'Lance de Givre', rarity: 'rare', type: 'skill', icon: 'ice', color: '#a8f0ff', cd: 7, cost: 20, base: 340,
      desc: 'Lance de glace perforante. Gèle 1 s ce qu\'elle touche (ralentit les boss).', aw: ['Explose en éclats à l\'impact.', 'Trois lances en éventail.'] },
    { id: 'ombre', name: 'Pas de l\'Ombre', rarity: 'rare', type: 'skill', icon: 'shadow', color: '#a070ff', cd: 8, cost: 18, base: 380,
      desc: 'Te téléporte derrière la cible et frappe dans le dos (coup critique garanti).', aw: ['Laisse un leurre qui attire le boss 2 s.', 'Deux téléportations enchaînées.'] },
    { id: 'tornade', name: 'Tornade', rarity: 'rare', type: 'skill', icon: 'tornado', color: '#9fffc8', cd: 10, cost: 25, base: 60,
      desc: 'Envoie une tornade qui avance lentement, aspire et frappe 12 fois.', aw: ['La tornade suit ta cible.', 'Deux tornades.'] },
    { id: 'soin', name: 'Sanctuaire', rarity: 'rare', type: 'skill', icon: 'heal', color: '#8dffa0', cd: 16, cost: 30, base: 0,
      desc: 'Cercle sacré 5 s : soigne 30 % de la vie des alliés dedans et réduit leurs dégâts subis de 20 %.', aw: ['Soigne 45 %.', 'Réanime instantanément un allié à terre dans le cercle.'] },
    { id: 'pluie', name: 'Pluie de Lames', rarity: 'rare', type: 'skill', icon: 'swords', color: '#ffe08a', cd: 12, cost: 28, base: 55,
      desc: '14 épées spectrales tombent du ciel sur la zone visée.', aw: ['24 épées.', 'Les épées restent plantées et explosent après 1 s.'] },
    // ----- épiques -----
    { id: 'fantomes', name: 'Lames Fantômes', rarity: 'epique', type: 'skill', icon: 'orbit', color: '#c8a0ff', cd: 15, cost: 30, base: 85,
      desc: '6 lames orbitent autour de toi 8 s et se lancent seules sur la cible à chacun de tes coups.', aw: ['10 lames.', 'Les lames reviennent et frappent deux fois.'] },
    { id: 'clone', name: 'Double Spectral', rarity: 'epique', type: 'skill', icon: 'clone', color: '#6fe7ff', cd: 18, cost: 32, base: 0,
      desc: 'Invoque un double qui copie toutes tes attaques et compétences pendant 7 s (60 % des dégâts).', aw: ['Le double fait 90 % des dégâts.', 'Deux doubles.'] },
    { id: 'gravite', name: 'Faille Gravitationnelle', rarity: 'epique', type: 'skill', icon: 'hole', color: '#b06bff', cd: 16, cost: 35, base: 70,
      desc: 'Ouvre un trou noir 4 s : aspire et broie (16 coups), puis implose.', aw: ['Implosion ×2 et gros dégâts de posture.', 'Le trou noir immobilise le boss 1,5 s.'] },
    { id: 'dragon', name: 'Poing du Dragon', rarity: 'epique', type: 'skill', icon: 'dragon', color: '#ff6a3d', cd: 12, cost: 32, base: 520,
      desc: 'Uppercut enflammé qui te propulse en l\'air et libère un dragon de feu en ligne droite.', aw: ['Le dragon laisse une traînée de feu.', 'Le dragon revient sur ses pas (2e passage).'] },
    { id: 'contre', name: 'Posture du Contre', rarity: 'epique', type: 'skill', icon: 'counter', color: '#ff5a7a', cd: 10, cost: 20, base: 110,
      desc: 'Posture de 1,2 s : si tu es frappé, le temps ralentit et tu ripostes avec 8 coups éclairs.', aw: ['12 coups.', 'La riposte remplit 25 % de ton ultime.'] },
    { id: 'tempete', name: 'Tempête de Foudre', rarity: 'epique', type: 'skill', icon: 'storm', color: '#9ad8ff', cd: 18, cost: 40, base: 120,
      desc: '12 éclairs s\'abattent autour de la zone visée pendant 3 s.', aw: ['20 éclairs.', 'Le dernier éclair est géant (×5).'] },
    // ----- ultimes -----
    { id: 'u_lame', name: 'Lame Céleste', rarity: 'commun', type: 'ult', icon: 'sky', color: '#ffe9a8', base: 1800,
      desc: 'Une épée géante tombe du ciel sur la zone visée. Énorme explosion.', aw: ['Onde de choc qui étourdit.', 'Trois épées géantes.'] },
    { id: 'u_temps', name: 'Arrêt du Temps', rarity: 'legendaire', type: 'ult', icon: 'clock', color: '#8fb0ff', base: 0,
      desc: 'Fige le temps 4 s : les ennemis et leurs projectiles sont gelés, tu agis librement. Les dégâts infligés se libèrent d\'un coup à la fin (+30 %). En duel : fige l\'adversaire 2 s.', aw: ['Dure 5 s.', 'Libération +80 % et tes cooldowns sont réinitialisés.'] },
    { id: 'u_rayon', name: 'Rayon Annihilateur', rarity: 'legendaire', type: 'ult', icon: 'beam', color: '#7af0ff', base: 220,
      desc: 'Canalise un rayon gigantesque pendant 3,5 s, dirigeable à la souris. Les dégâts augmentent tant qu\'il touche.', aw: ['Rayon plus large et 4,5 s.', 'Se termine par une explosion massive.'] },
    { id: 'u_lames', name: 'Danse des Mille Lames', rarity: 'legendaire', type: 'ult', icon: 'thousand', color: '#ff4a6a', base: 120,
      desc: 'Deviens intouchable et frappe 14 fois en te téléportant autour de la cible, puis tranche en croix géante.', aw: ['20 frappes.', 'La croix finale fait ×3 dégâts.'] },
    { id: 'u_domaine', name: 'Domaine Souverain', rarity: 'legendaire', type: 'ult', icon: 'domain', color: '#ffcf4a', base: 120,
      desc: 'Déploie un dôme de 14 m pendant 9 s : ennemis ralentis de 50 %, toi et tes alliés +40 % dégâts et cooldowns 2× plus rapides.', aw: ['Le dôme frappe chaque seconde.', '+70 % dégâts et énergie illimitée.'] },
    { id: 'u_meteore', name: 'Météore Écarlate', rarity: 'epique', type: 'ult', icon: 'meteor', color: '#ff5a2a', base: 1500,
      desc: 'Un météore géant s\'écrase sur la zone après 1,4 s. Laisse un cratère brûlant.', aw: ['Cratère plus grand, brûle plus fort.', 'Pluie de 6 petits météores en plus.'] },
    { id: 'u_legion', name: 'Légion d\'Os', rarity: 'epique', type: 'ult', icon: 'skull', color: '#7dffb0', base: 70,
      desc: 'Fait surgir 5 guerriers squelettes à flammes vertes qui combattent pour toi 12 s.', aw: ['8 guerriers.', 'Les guerriers explosent en mourant.'] },
  ];
  AR.skill = id => AR.SKILLS.find(s => s.id === id) || null;
  AR.STARTER = { owned: { fente: { lv: 1, xp: 0 }, onde: { lv: 1, xp: 0 }, u_lame: { lv: 1, xp: 0 } }, equip: ['fente', 'onde', null, null], ult: 'u_lame', weapon: 'blade' };
  AR.MAXLV = 5;
  AR.RMULT = { commun: 1, rare: 1.6, epique: 2.4, legendaire: 3.5 };
  AR.xpNeed = lv => [0, 100, 220, 380, 600][lv] || 999999;          // XP pour passer au niveau suivant
  AR.upCost = (s, lv) => Math.round([0, 200, 450, 900, 1600][lv] * AR.RMULT[s.rarity]);   // prix en points du niveau suivant
  AR.dmgMult = lv => 1 + 0.15 * (lv - 1);
  AR.cdMult = lv => 1 - 0.06 * (lv - 1);

  /* ---------------- roulettes ---------------- */
  AR.ROULETTES = [
    { id: 'commune', name: 'Roulette Commune', price: 250, color: '#9aa4b2', odds: { commun: 72, rare: 24, epique: 4, legendaire: 0 } },
    { id: 'rare', name: 'Roulette Rare', price: 800, color: '#4aa3ff', odds: { commun: 0, rare: 62, epique: 31, legendaire: 7 } },
    { id: 'epique', name: 'Roulette Épique', price: 2000, color: '#b66bff', odds: { commun: 0, rare: 0, epique: 72, legendaire: 28 } },
  ];
  // XP gagnée quand on tire une compétence déjà possédée
  AR.DUPE_XP = { commun: 120, rare: 160, epique: 220, legendaire: 320 };
  AR.roll = function (rid, rng) {
    rng = rng || Math.random;
    const R = AR.ROULETTES.find(r => r.id === rid); let x = rng() * 100, rar = 'commun';
    for (const k of ['commun', 'rare', 'epique', 'legendaire']) { if (x < R.odds[k]) { rar = k; break; } x -= R.odds[k]; }
    const pool = AR.SKILLS.filter(s => s.rarity === rar && s.id !== 'u_lame');
    return pool[Math.floor(rng() * pool.length)];
  };

  /* ---------------- boss ---------------- */
  AR.BOSSES = [
    { id: 'titan', name: 'LE COLOSSE', sub: 'Titan de magma', hp: 26000, color: '#ff6a2a', music: 'boss_titan', faces: 1,
      desc: 'Un géant de roche en fusion. Saute par-dessus ses ondes sismiques, esquive ses poings. Brise sa posture : il s\'effondre et sa tête devient vulnérable.' },
    { id: 'hydra', name: 'L\'HYDRE', sub: 'Trois têtes, trois cauchemars', hp: 28000, color: '#57ff9a', music: 'boss_hydra', faces: 3,
      desc: 'Trois têtes attaquent chacune de leur côté. Après une morsure, la tête reste au sol : frappe-la. Tranche les trois pour gagner.' },
    { id: 'spider', name: 'L\'ARACHNIDE', sub: 'Reine des toiles', hp: 24000, color: '#c070ff', music: 'boss_spider', faces: 5,
      desc: 'Rapide et imprévisible : charges, bonds, toiles qui ralentissent et petites araignées kamikazes.' },
    { id: 'eye', name: 'L\'ŒIL ABYSSAL', sub: 'Le regard du vide', hp: 25000, color: '#4ad8ff', music: 'boss_eye', faces: 7,
      desc: 'Un enfer de projectiles. Saute par-dessus ses rayons, faufile-toi entre les spirales, abats ses satellites.' },
    // ----- nouveaux colosses (js/arena/boss2.js et boss3.js) -----
    { id: 'knight', name: 'LE CHEVALIER DÉCHU', sub: 'Lame du serment brisé', hp: 27500, color: '#ff3a5a', music: 'duel', faces: 1, isNew: true,
      desc: 'Un maître d\'armes géant. Combos de 3 à 5 coups, feintes, ondes d\'épée et lames spectrales qui te traquent. Lis sa garde avant de frapper.' },
    { id: 'beast', name: 'LE BÉHÉMOTH', sub: 'Fléau cuirassé', hp: 30000, color: '#ffb02e', music: 'boss_hydra', faces: 1, isNew: true,
      desc: 'Une bête cuirassée de cristal. Charges en rebond, séismes à sauter, épines qui explosent. Son dos se fend quand il s\'enrage.' },
    { id: 'frost', name: 'LA SORCIÈRE DE GIVRE', sub: 'Les mains de l\'hiver', hp: 26500, color: '#9fdcff', music: 'boss_eye', faces: 1, isNew: true,
      desc: 'Deux mains géantes qui te suivent et t\'écrasent, des éclats de glace en éventail et un froid absolu où seuls quelques cercles te protègent.' },
    { id: 'storm', name: 'L\'OISEAU-TONNERRE', sub: 'Seigneur de l\'orage', hp: 25500, color: '#ffe14a', music: 'boss_spider', faces: 1, isNew: true,
      desc: 'Il plonge du ciel, frappe de la foudre là où tu vas et déchaîne des cyclones. Ne reste jamais immobile.' },
  ];
  AR.XBOSS = {};   // « boss » hors du sélecteur (la horde de l'Ascension), ajoutés par js/arena/horde.js
  AR.boss = id => AR.BOSSES.find(b => b.id === id) || AR.XBOSS[id] || AR.BOSSES[0];
  // noms des stades d'évolution (affichés dans le bandeau et sous la barre de vie)
  AR.STAGES = ['', 'ÉVEIL', 'FUREUR', 'CATACLYSME'];
  /* tirage de 4 boss différents (sans répéter exactement le tirage précédent) */
  let lastOffer = '';
  AR.bossOffer = function (n) {
    n = n || 4; let ids = [];
    for (let k = 0; k < 6; k++) {
      ids = BR.shuffle(AR.BOSSES.map(b => b.id)).slice(0, n);
      // au moins un boss différent du tirage précédent
      const key = ids.slice().sort().join(','); if (key !== lastOffer || AR.BOSSES.length <= n) break;
    }
    lastOffer = ids.slice().sort().join(',');
    return ids;
  };
  AR.DIFFS = {
    normal: { id: 'normal', name: 'Normal', color: '#57d68d', hp: 1, dmg: 1, speed: 1, reward: 1, tier: 0 },
    // tier : niveau d'agressivité des motifs d'attaque (enchaînements, attaques de groupe, feintes)
    heroique: { id: 'heroique', name: 'Héroïque', color: '#ffb52e', hp: 1.9, dmg: 1.35, speed: 1.12, reward: 1.6, tier: 1 },
    cauchemar: { id: 'cauchemar', name: 'Cauchemar', color: '#ff3b4f', hp: 3.2, dmg: 1.8, speed: 1.25, reward: 2.2, tier: 2 },
  };
  // salons : identifiant de « carte » côté serveur
  // 4 boss tirés au hasard par salon (+ aléatoire + duel). Le tirage reste le même tant qu'on est dans le même salon ;
  // le combat déjà choisi par le salon reste toujours dans la liste.
  const roomOffer = { code: null, ids: null };
  Object.defineProperty(AR, 'ROOM_MAPS', { configurable: true, get() {
    const room = BR.Net && BR.Net.room, code = room ? room.code : null;
    if (BR.ascMode) return ['a_asc'];
    // tous les colosses sont proposés dans les salons (avant : 4 au hasard, certains semblaient introuvables)
    void roomOffer; void code;
    const list = AR.BOSSES.map(b => 'a_' + b.id);
    if (room && AR.isArenaMap(room.map) && room.map !== 'a_random' && room.map !== 'a_duel' && !list.includes(room.map)) list.unshift(room.map);
    return list.concat(['a_random', 'a_duel']);
  } });
  AR.isArenaMap = m => typeof m === 'string' && m.startsWith('a_');
  AR.mapLabel = m => m === 'a_asc' ? 'L\'Ascension' : m === 'a_duel' ? 'Duel en équipes' : m === 'a_random' ? 'Boss aléatoire' : (AR.boss(m.slice(2)) || {}).name || m;
  // difficultés proposées dans un salon : paliers pour l'Ascension, sinon Normal / Héroïque / Cauchemar
  AR.roomDiffList = m => m === 'a_asc' && BR.Asc ? BR.Asc.palierList() : Object.values(AR.DIFFS);
  AR.roomDiff = (m, id) => m === 'a_asc' && BR.Asc ? BR.Asc.palierDiff(id) : (AR.DIFFS[id] || AR.DIFFS.normal);
  // équipes du mode Duel (jusqu'à 6 : de 1 contre 1 à 1v1v1v1v1v1, ou 2 contre 2, 3 contre 3…)
  AR.TEAMS = [
    { id: 'A', name: 'Rouge', color: '#ff4d5e' }, { id: 'B', name: 'Bleue', color: '#4da3ff' }, { id: 'C', name: 'Verte', color: '#4dff88' },
    { id: 'D', name: 'Jaune', color: '#ffd84d' }, { id: 'E', name: 'Violette', color: '#c77dff' }, { id: 'F', name: 'Orange', color: '#ff9a3c' },
  ];
  // équipes par défaut : chacun pour soi (au-delà de 6 joueurs, on reboucle)
  AR.defaultTeams = ids => { const o = {}; ids.forEach((id, i) => { o[id] = i % 6; }); return o; };

  /* ---------------- touches (affichage selon le clavier : AZERTY par défaut) ---------------- */
  let layout = null;
  try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then(m => { layout = m; }).catch(() => {}); } catch (e) {}
  const AZ = { KeyQ: 'A', KeyW: 'Z', KeyA: 'Q', KeyS: 'S', KeyD: 'D', KeyE: 'E', KeyR: 'R', KeyF: 'F', KeyX: 'X', KeyC: 'C', KeyV: 'V', Tab: 'Tab', Space: 'Espace', ShiftLeft: 'Maj' };
  AR.key = code => { if (layout && layout.get(code)) return layout.get(code).toUpperCase(); return AZ[code] || code.replace(/^Key/, ''); };
  // touches choisies par le joueur (js/keys.js, réglables dans les paramètres) ; ici la touche principale de chaque action
  const KP = id => (BR.Keys && BR.Keys.get(id)[0]) || '';
  AR.KEYS = { get skills() { return ['sk1', 'sk2', 'sk3', 'sk4'].map(KP); }, get ult() { return KP('ult'); }, get dash() { return KP('dash'); }, get jump() { return KP('jump'); }, get lock() { return KP('lock'); } };

  /* ---------------- icônes des pouvoirs : rendu en couches (fond d'énergie, glyphe en relief lumineux, cadre de rareté) ---------------- */
  const iconCache = {};
  const cv = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  const hx = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => { const A = hx(a), B = hx(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  const rgba = (h, a) => `rgba(${hx(h).join(',')},${a})`;
  function tint(mask, fill) { const c = cv(mask.width), g = c.getContext('2d'); g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = fill; g.fillRect(0, 0, c.width, c.height); return c; }
  function star(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); }
  // la rareté se voit au premier coup d'œil : commun sobre (pierre), rare (halo bleu), épique (rayons, rune, gemme), légendaire (or, flammes, éclats)
  const TIER = { commun: 0, rare: 1, epique: 2, legendaire: 3 };
  AR.icon = function (id, size, locked) {
    const key = id + (locked ? 'L' : '');
    if (iconCache[key]) return iconCache[key];
    const s = AR.skill(id); if (!s) return '';
    const T = TIER[s.rarity] || 0;
    const N = 256, k = N / 96, C = N / 2, R = BR.RARITY[s.rarity] || BR.RARITY.commun, rc = R.color;
    const sc = T === 0 ? mix(s.color, '#8a8f98', 0.55).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m0, r, g2, b) => '#' + [r, g2, b].map(v => (+v).toString(16).padStart(2, '0')).join('')) : s.color;
    const rnd = BR.rngFrom(BR.hashStr(id));
    const c = cv(N), g = c.getContext('2d');
    // ---- 1. fond ----
    g.save(); rr(g, 8, 8, N - 16, N - 16, 38); g.clip();
    const bg = g.createRadialGradient(C, C * 0.95, 4, C, C, N * 0.72);
    if (T === 0) { bg.addColorStop(0, '#3a3d44'); bg.addColorStop(1, '#16181d'); }
    else { bg.addColorStop(0, mix(sc, '#000000', T === 1 ? 0.45 : 0.25)); bg.addColorStop(0.45, mix(sc, '#06070c', 0.8)); bg.addColorStop(1, '#030409'); }
    g.fillStyle = bg; g.fillRect(0, 0, N, N);
    if (T === 0) { g.globalAlpha = 0.18; for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.5 ? '#000' : '#fff'; g.fillRect(rnd() * N, rnd() * N, 2, 2); } g.globalAlpha = 1; }
    g.globalCompositeOperation = 'lighter';
    if (T >= 2) {
      const a0 = rnd() * 6.28, n = T === 3 ? 24 : 14;
      for (let i = 0; i < n; i++) {
        const a = a0 + i / n * Math.PI * 2, w = 0.04 + rnd() * 0.06;
        const gr = g.createRadialGradient(C, C, 0, C, C, N * 0.75); gr.addColorStop(0, rgba(T === 3 ? (i % 2 ? '#ffd24a' : sc) : sc, 0.2 + rnd() * 0.14)); gr.addColorStop(1, rgba(sc, 0));
        g.fillStyle = gr; g.beginPath(); g.moveTo(C, C); g.arc(C, C, N, a - w, a + w); g.closePath(); g.fill();
      }
    }
    if (T >= 1) for (let i = 0; i < [0, 25, 60, 110][T]; i++) { const a = rnd() * 6.28, r = (0.2 + rnd() * 0.6) * N * 0.5; g.fillStyle = rgba(i % 4 ? sc : '#ffffff', 0.12 + rnd() * 0.45); g.beginPath(); g.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, 0.6 + rnd() * 2.2, 0, 7); g.fill(); }
    if (T >= 2) { g.strokeStyle = rgba(sc, 0.4); g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath(); g.arc(C, C, N * 0.37, 0, 7); g.stroke(); g.setLineDash([]); }
    if (T === 3) {
      g.strokeStyle = rgba('#ffd24a', 0.35); g.lineWidth = 3; g.beginPath(); g.arc(C, C, N * 0.42, 0, 7); g.stroke();
      // flammes d'énergie qui montent du bas
      for (let i = 0; i < 9; i++) { const x = N * (0.1 + i * 0.1), h = N * (0.25 + rnd() * 0.3); const fg = g.createLinearGradient(0, N, 0, N - h); fg.addColorStop(0, rgba('#ffb52e', 0.55)); fg.addColorStop(1, rgba('#ff5a1e', 0)); g.fillStyle = fg; g.beginPath(); g.moveTo(x - 16, N); g.quadraticCurveTo(x - 10 + rnd() * 20, N - h * 0.6, x + rnd() * 10 - 5, N - h); g.quadraticCurveTo(x + 10, N - h * 0.5, x + 16, N); g.fill(); }
    }
    g.globalCompositeOperation = 'source-over';
    // ---- 2. glyphe ----
    const m = cv(N), mg = m.getContext('2d');
    mg.translate(C, C); mg.scale(k * 1.06, k * 1.06); mg.strokeStyle = mg.fillStyle = '#ffffff'; mg.lineWidth = 6.5; mg.lineCap = 'round'; mg.lineJoin = 'round';
    (GLYPH[s.icon] || GLYPH.orb)(mg);
    const id2 = mg.getImageData(0, 0, N, N), d = id2.data;
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 765; d[i + 3] = d[i + 3] * Math.min(1, l * 1.4); d[i] = d[i + 1] = d[i + 2] = 255; }
    mg.putImageData(id2, 0, 0);
    g.filter = 'blur(5px)'; g.globalAlpha = 0.95; g.drawImage(tint(m, '#000000'), 0, 6); g.drawImage(tint(m, '#000000'), 0, 2);
    g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
    if (T >= 2) { g.filter = 'blur(16px)'; g.globalAlpha = T === 3 ? 1 : 0.8; g.drawImage(tint(m, sc), 0, 0); g.globalAlpha = 1; }
    if (T >= 1) { g.filter = 'blur(6px)'; g.globalAlpha = T === 1 ? 0.6 : 1; g.drawImage(tint(m, mix(sc, '#ffffff', 0.3)), 0, 0); g.globalAlpha = 1; }
    if (T === 3) { g.filter = 'blur(3px)'; g.drawImage(tint(m, '#ffe9a0'), 0, 0); }
    g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    const body = g.createLinearGradient(0, N * 0.18, 0, N * 0.85);
    if (T === 0) { body.addColorStop(0, '#e8eaee'); body.addColorStop(0.5, sc); body.addColorStop(1, mix(sc, '#000000', 0.5)); }
    else { body.addColorStop(0, '#ffffff'); body.addColorStop(0.3, mix(sc, '#ffffff', 0.55)); body.addColorStop(0.65, sc); body.addColorStop(1, mix(sc, '#000000', 0.45)); }
    g.drawImage(tint(m, body), 0, 0);
    const spec = g.createLinearGradient(N * 0.2, N * 0.15, N * 0.62, N * 0.6); spec.addColorStop(0, `rgba(255,255,255,${0.3 + T * 0.15})`); spec.addColorStop(0.5, 'rgba(255,255,255,0.1)'); spec.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'lighter'; g.drawImage(tint(m, spec), 0, 0); g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < [0, 1, 4, 8][T]; i++) {
      const x = N * (0.16 + rnd() * 0.68), y = N * (0.14 + rnd() * 0.62), r = 4 + rnd() * (T === 3 ? 10 : 7);
      g.shadowColor = T === 3 ? '#ffd24a' : sc; g.shadowBlur = 14; g.fillStyle = '#ffffff'; star(g, x, y, r); g.shadowBlur = 0;
    }
    const vg = g.createRadialGradient(C, C, N * 0.3, C, C, N * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${T === 0 ? 0.35 : 0.55})`);
    g.fillStyle = vg; g.fillRect(0, 0, N, N);
    g.restore();
    // ---- 3. cadre ----
    const fr = g.createLinearGradient(0, 0, 0, N);
    if (T === 0) { fr.addColorStop(0, '#9aa0a8'); fr.addColorStop(1, '#4a4e55'); }
    else { fr.addColorStop(0, mix(rc, '#ffffff', 0.55)); fr.addColorStop(0.45, rc); fr.addColorStop(1, mix(rc, '#000000', 0.55)); }
    g.lineWidth = [7, 9, 10, 13][T]; g.strokeStyle = fr; rr(g, 8, 8, N - 16, N - 16, 38); g.stroke();
    if (T >= 1) { g.lineWidth = 2; g.strokeStyle = `rgba(255,255,255,${0.2 + T * 0.08})`; rr(g, 15, 15, N - 30, N - 30, 32); g.stroke(); }
    const gem = (x, y, r) => { g.fillStyle = fr; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(x, y - r * 0.6); g.lineTo(x + r * 0.35, y - r * 0.1); g.lineTo(x, y); g.closePath(); g.fill(); };
    if (T >= 2) gem(C, 9, T === 3 ? 16 : 12);
    if (T === 3) {
      gem(9, C, 11); gem(N - 9, C, 11);
      // coins ornés
      g.fillStyle = fr; for (const [x, y, sx, sy] of [[14, 14, 1, 1], [N - 14, 14, -1, 1], [14, N - 14, 1, -1], [N - 14, N - 14, -1, -1]]) { g.beginPath(); g.moveTo(x - sx * 8, y - sy * 8); g.lineTo(x + sx * 30, y - sy * 8); g.quadraticCurveTo(x + sx * 4, y + sy * 4, x - sx * 8, y + sy * 30); g.closePath(); g.fill(); }
      g.shadowColor = '#ffb52e'; g.shadowBlur = 26; g.lineWidth = 3; g.strokeStyle = '#ffe9a0'; rr(g, 5, 5, N - 10, N - 10, 41); g.stroke(); g.shadowBlur = 0;
    }
    if (s.type === 'ult') {
      const w = 120, h = 34, x = C - w / 2, y = N - 50;
      g.fillStyle = 'rgba(8,6,4,0.88)'; rr(g, x, y, w, h, 10); g.fill(); g.lineWidth = 3; g.strokeStyle = fr; rr(g, x, y, w, h, 10); g.stroke();
      g.fillStyle = T === 0 ? '#d8dbe0' : mix(rc, '#ffffff', 0.4); g.font = '900 22px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ULTIME', C, y + h / 2 + 1);
    }
    if (locked) {
      const L = cv(N), lg = L.getContext('2d'); lg.filter = 'grayscale(1) brightness(0.45)'; lg.drawImage(c, 0, 0);
      lg.filter = 'none'; lg.fillStyle = 'rgba(255,255,255,0.75)'; lg.strokeStyle = 'rgba(255,255,255,0.75)'; lg.lineWidth = 9;
      lg.beginPath(); lg.arc(C, C - 14, 22, Math.PI, 0); lg.stroke(); rr(lg, C - 34, C - 14, 68, 54, 10); lg.fill();
      return (iconCache[key] = L.toDataURL());
    }
    return (iconCache[key] = c.toDataURL());
  };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`; }
  const blade = (g, x0, y0, x1, y1, w) => { const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0); g.save(); g.translate(x0, y0); g.rotate(a); g.beginPath(); g.moveTo(0, -w); g.lineTo(L * 0.8, -w); g.lineTo(L, 0); g.lineTo(L * 0.8, w); g.lineTo(0, w); g.closePath(); g.fill(); g.fillRect(-4, -w * 2.4, 4, w * 4.8); g.fillRect(-14, -w * 0.6, 10, w * 1.2); g.restore(); };
  const bolt = (g, pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
  const GLYPH = {
    dash: g => { blade(g, -26, 22, 26, -22, 4); g.globalAlpha = 0.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-34 + i * 8, 4 + i * 8); g.lineTo(-14 + i * 8, 4 + i * 8); g.stroke(); } },
    shock: g => { g.beginPath(); g.moveTo(-30, 18); g.lineTo(30, 18); g.stroke(); for (let r = 10; r <= 30; r += 10) { g.globalAlpha = 1 - r / 40; g.beginPath(); g.arc(0, 18, r, Math.PI, 0); g.stroke(); } g.globalAlpha = 1; g.beginPath(); g.moveTo(0, -30); g.lineTo(0, 6); g.stroke(); g.beginPath(); g.moveTo(-8, -2); g.lineTo(0, 8); g.lineTo(8, -2); g.stroke(); },
    spin: g => { for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * 2.094); blade(g, 6, 0, 32, 0, 3); g.restore(); } g.beginPath(); g.arc(0, 0, 22, 0.3, 2.2); g.stroke(); g.beginPath(); g.arc(0, 0, 22, 3.4, 5.3); g.stroke(); },
    bolt3: g => { for (const [x, y] of [[-18, 14], [0, -4], [18, 14]]) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.globalAlpha = 0.5; g.beginPath(); g.moveTo(x - 6, y + 10); g.lineTo(x - 14, y + 24); g.stroke(); g.globalAlpha = 1; } },
    leap: g => { g.beginPath(); g.moveTo(-30, 26); g.quadraticCurveTo(0, -46, 26, 18); g.stroke(); g.beginPath(); g.moveTo(14, 14); g.lineTo(26, 20); g.lineTo(28, 6); g.stroke(); g.fillRect(-34, 26, 68, 4); },
    shield: g => { g.beginPath(); g.moveTo(0, -30); g.lineTo(26, -20); g.quadraticCurveTo(24, 16, 0, 32); g.quadraticCurveTo(-24, 16, -26, -20); g.closePath(); g.stroke(); g.globalAlpha = 0.35; g.fill(); },
    lightning: g => { g.lineWidth = 6; bolt(g, [-8, -32, 10, -6, -6, -2, 12, 32]); g.lineWidth = 3; g.globalAlpha = 0.6; bolt(g, [6, -10, 26, -16, 22, 4]); bolt(g, [-4, 2, -24, 8, -20, 24]); },
    ice: g => { g.beginPath(); g.moveTo(-30, 30); g.lineTo(26, -26); g.stroke(); g.beginPath(); g.moveTo(30, -30); g.lineTo(14, -24); g.lineTo(24, -14); g.closePath(); g.fill(); for (let i = 0; i < 6; i++) { g.save(); g.translate(-14, 14); g.rotate(i * 1.047); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 12); g.stroke(); g.restore(); } },
    shadow: g => { g.beginPath(); g.arc(0, -14, 10, 0, 7); g.fill(); g.beginPath(); g.moveTo(-16, 30); g.quadraticCurveTo(-14, -2, 0, -2); g.quadraticCurveTo(14, -2, 16, 30); g.fill(); g.globalAlpha = 0.4; g.translate(-16, 0); g.beginPath(); g.arc(0, -14, 10, 0, 7); g.fill(); },
    tornado: g => { for (let i = 0; i < 5; i++) { const y = -26 + i * 12, w = 30 - i * 5; g.beginPath(); g.ellipse(i * 2, y, w, 5, 0, 0, 7); g.stroke(); } },
    heal: g => { g.fillRect(-7, -26, 14, 52); g.fillRect(-26, -7, 52, 14); g.globalAlpha = 0.4; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.stroke(); },
    swords: g => { for (const x of [-20, 0, 20]) blade(g, x, -34, x, 26, 3.4); },
    orbit: g => { g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * 1.047); blade(g, 18, -8, 32, 4, 2.4); g.restore(); } },
    clone: g => { for (const [x, a] of [[-10, 0.45], [10, 1]]) { g.globalAlpha = a; g.beginPath(); g.arc(x, -14, 9, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 14, 30); g.quadraticCurveTo(x - 12, 0, x, 0); g.quadraticCurveTo(x + 12, 0, x + 14, 30); g.fill(); } },
    hole: g => { for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 0, 30 - i * 6, i, i + 3.6); g.stroke(); } g.shadowBlur = 0; g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); },
    dragon: g => { g.beginPath(); g.moveTo(-30, 28); g.bezierCurveTo(-30, -10, 10, 20, 4, -10); g.bezierCurveTo(0, -30, 26, -34, 30, -16); g.stroke(); g.beginPath(); g.moveTo(30, -16); g.lineTo(18, -12); g.lineTo(26, -4); g.closePath(); g.fill(); for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-22 + i * 9, 18 - i * 8, 3, 0, 7); g.fill(); } },
    counter: g => { g.beginPath(); g.moveTo(-26, -26); g.lineTo(26, 26); g.stroke(); g.beginPath(); g.moveTo(26, -26); g.lineTo(-26, 26); g.stroke(); g.globalAlpha = 0.5; g.beginPath(); g.arc(0, 0, 32, 0, 7); g.stroke(); },
    storm: g => { g.beginPath(); g.ellipse(0, -20, 30, 12, 0, 0, 7); g.fill(); g.lineWidth = 4; bolt(g, [-12, -10, -4, 6, -14, 8, -6, 30]); bolt(g, [12, -10, 18, 4, 10, 6, 16, 26]); },
    sky: g => { blade(g, 0, -36, 0, 22, 7); g.globalAlpha = 0.5; g.beginPath(); g.ellipse(0, 28, 26, 6, 0, 0, 7); g.stroke(); },
    clock: g => { g.beginPath(); g.arc(0, 0, 28, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -18); g.moveTo(0, 0); g.lineTo(13, 8); g.stroke(); for (let i = 0; i < 12; i++) { g.save(); g.rotate(i * 0.5236); g.fillRect(-1.5, -34, 3, 6); g.restore(); } },
    beam: g => { g.beginPath(); g.arc(-22, 0, 10, 0, 7); g.fill(); g.lineWidth = 12; g.beginPath(); g.moveTo(-14, 0); g.lineTo(34, 0); g.stroke(); g.shadowBlur = 0; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(-14, 0); g.lineTo(34, 0); g.stroke(); },
    thousand: g => { for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * 0.785 + 0.2); g.globalAlpha = 0.4 + (i % 2) * 0.6; blade(g, 8, 0, 34, 0, 2.2); g.restore(); } },
    domain: g => { g.beginPath(); g.arc(0, 14, 32, Math.PI, 0); g.stroke(); g.globalAlpha = 0.25; g.fill(); g.globalAlpha = 1; g.fillRect(-34, 14, 68, 4); g.beginPath(); g.moveTo(0, -18); g.lineTo(8, 0); g.lineTo(0, 10); g.lineTo(-8, 0); g.closePath(); g.fill(); },
    meteor: g => { g.beginPath(); g.arc(12, 12, 14, 0, 7); g.fill(); g.lineWidth = 6; g.globalAlpha = 0.6; for (const o of [-8, 0, 8]) { g.beginPath(); g.moveTo(2 + o, 2 - o); g.lineTo(-30 + o, -30 - o); g.stroke(); } },
    skull: g => { g.beginPath(); g.arc(0, -6, 22, 0, 7); g.fill(); g.fillRect(-12, 10, 24, 16); g.shadowBlur = 0; g.fillStyle = '#0b0d14'; g.beginPath(); g.arc(-9, -6, 6, 0, 7); g.arc(9, -6, 6, 0, 7); g.fill(); g.fillRect(-8, 16, 4, 10); g.fillRect(4, 16, 4, 10); },
    orb: g => { g.beginPath(); g.arc(0, 0, 20, 0, 7); g.fill(); },
  };
})();

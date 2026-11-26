/* ===== arena/asc-data.js : « COLOSSES : L'ASCENSION » — données (bénédictions, malédictions, salles, paliers, autel) =====
   Une course = 10 étages. Chaque course repart de zéro (pouvoirs niveau 1) : la puissance vient des bénédictions
   choisies entre les étages, qui se combinent (familles, duos). Les éclats d'âme gagnés débloquent de nouvelles
   bénédictions et des avantages de départ : de la variété, pas de puissance brute. */
(function () {
  const BR = window.BR;
  const Q = (BR.Asc = BR.Asc || {});

  /* ---------------- familles ---------------- */
  // glyphes 24×24 : f = rempli, s = trait
  Q.FAM = {
    braise: { n: 'Braise', col: '#ff7a2a', g: ['f', 'M12 2c1.2 4-3.2 6-3.2 10.2a3.2 3.2 0 0 0 6.4 0c0-2.1-1-3.2-1-5.3 3.2 2.1 5.3 5.3 5.3 8.5a7.5 7.5 0 0 1-15 0c0-6.4 7.5-8.5 7.5-13.4z'] },
    foudre: { n: 'Foudre', col: '#6fc8ff', g: ['f', 'M13.5 1.5L3.5 14h6.5l-1.5 8.5 10-12.8h-6.6z'] },
    givre: { n: 'Givre', col: '#a8f0ff', g: ['s', 'M12 2v20M3.4 7l17.2 10M20.6 7L3.4 17M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5'] },
    sang: { n: 'Sang', col: '#ff3a5a', g: ['f', 'M12 2c4.2 6.2 7.2 9.3 7.2 13.2a7.2 7.2 0 0 1-14.4 0C4.8 11.3 7.8 8.2 12 2z'] },
    vent: { n: 'Vent', col: '#7dffb0', g: ['s', 'M3 8h10.5a3 3 0 1 0-3-3M3 12.5h15a3 3 0 1 1-3 3M3 17h7'] },
    acier: { n: 'Acier', col: '#cfd8e6', g: ['f', 'M12 2l8.5 3.2v6.2c0 5.3-3.6 9.3-8.5 11.1-4.9-1.8-8.5-5.8-8.5-11.1V5.2z'] },
    univ: { n: 'Arcane', col: '#ffd76a', g: ['f', 'M12 1.8l3 6.7 7.2.7-5.5 4.8 1.6 7.2L12 17.4l-6.3 3.8 1.6-7.2-5.5-4.8 7.2-.7z'] },
    coop: { n: 'Groupe', col: '#ffa8e0', g: ['s', 'M8 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M10.5 20c.4-3.2 2.7-6 5.5-6 3 0 5.5 2.7 5.5 6'] },
    duo: { n: 'Duo', col: '#ffffff', g: ['f', 'M12 2a10 10 0 1 0 0 20 5 5 0 0 1 0-10 5 5 0 0 0 0-10zm0 3.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm0 12a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z'] },
    maudit: { n: 'Malédiction', col: '#b06bff', g: ['f', 'M12 2a8.2 8.2 0 0 0-8.2 8.2c0 3 1.5 5.1 3.2 6.2V21h10v-4.6c1.7-1.1 3.2-3.2 3.2-6.2A8.2 8.2 0 0 0 12 2zM8.6 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6.8 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'] },
  };
  Q.glyph = function (fam, size, color) {
    const F = Q.FAM[fam] || Q.FAM.univ, c = color || F.col, sz = size || 24;
    return F.g[0] === 's'
      ? `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${F.g[1]}"/></svg>`
      : `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}"><path d="${F.g[1]}" fill="${c}"/></svg>`;
  };

  /* ---------------- bénédictions ----------------
     f : famille · r : rareté · max : niveau max · d(lv) : description · lock : déblocage requis (autel des âmes)
     coop : seulement à plusieurs · duo : [familleA, familleB] requises · fun : effet visible (taille…) */
  const pct = v => Math.round(v * 100) + ' %';
  /* Chaque bénédiction TRANSFORME une action : ton attaque, ton esquive, tes pouvoirs ou ton ultime.
     Une seule bénédiction par action (en prendre une autre remplace l'ancienne) ; les passifs se cumulent.
     Les bonus de pure statistique (PV, dégâts, critique…) ne sont vendus que par le marchand (shop: 1). */
  // une course : 3 actes de 5 étages (gardiens aux étages 5 et 10, colosse final au 15)
  Q.FLOORS = 15;
  const BIOME_OF = ['prairie', 'prairie', 'foret', 'ruines', 'temple', 'marais', 'marais', 'neige', 'neige', 'citadelle', 'cimetiere', 'cimetiere', 'volcan', 'volcan', 'neant'];
  const INF_BIOMES = ['neant', 'volcan', 'citadelle', 'cimetiere', 'marais', 'neige', 'temple', 'ruines'];
  Q.biomeOf = fl => (fl | 0) > Q.FLOORS ? INF_BIOMES[((fl | 0) - Q.FLOORS - 1) % INF_BIOMES.length] : BIOME_OF[Math.max(0, Math.min(BIOME_OF.length - 1, (fl | 0) - 1))];
  /* collection : chaque classe commence avec son kit de base (4 pouvoirs + ultime) ; les autres se trouvent en course (coffres) */
  Q.isUnlocked = (cls, id) => { const C = Q.CLASSES && Q.CLASSES[cls]; if (!C) return false; if (C.kit.includes(id) || C.ult === id) return true; const D = Q.data(); return !!(D.cls[cls] && D.cls[cls].pw.includes(id)); };
  Q.unlockPower = (cls, id) => { if (!cls || Q.isUnlocked(cls, id)) return false; const D = Q.data(); D.cls[cls].pw.push(id); Q.saveData(); return true; };
  Q.unlockedList = cls => (BR.ARENA.SKILLS || []).filter(s => Q.isUnlocked(cls, s.id)).map(s => s.id);
  Q.SLOTS = {
    atk: { n: 'Attaque', ico: 'sword', d: 'Tes coups de base' },
    dash: { n: 'Esquive', ico: 'dash', d: 'Ton esquive' },
    pouv: { n: 'Pouvoirs', ico: 'bolt', d: 'Chaque pouvoir lancé' },
    ult: { n: 'Ultime', ico: 'star', d: 'Ton ultime' },
    passif: { n: 'Passif', ico: 'shield', d: 'Toujours actif' },
  };
  Q.BOONS = [
    // ----- ATTAQUE -----
    { id: 'b_brul', f: 'braise', s: 'atk', r: 'commun', n: 'Lame ardente', max: 3, d: lv => `Tes coups <b>enflamment</b> l'ennemi : ${36 * lv} dégâts par seconde pendant 3 s.` },
    { id: 'b_chain', f: 'foudre', s: 'atk', r: 'commun', n: 'Arc électrique', max: 3, d: lv => `Un coup sur trois fait jaillir un <b>éclair</b> qui saute sur 3 ennemis (${70 * lv}).` },
    { id: 'b_froid', f: 'givre', s: 'atk', r: 'commun', n: 'Morsure du givre', max: 3, lock: 'givre', d: lv => `Un coup sur quatre <b>gèle</b> la cible pendant ${(0.6 + 0.3 * lv).toFixed(1)} s.` },
    { id: 'b_lvent', f: 'vent', s: 'atk', r: 'rare', n: 'Lames de vent', max: 3, d: lv => `Un coup sur trois projette une <b>lame de vent</b> qui traverse tout sur 12 m (${90 * lv}).` },
    { id: 'b_vamp', f: 'sang', s: 'atk', r: 'commun', n: 'Soif', max: 3, lock: 'sang', d: lv => `Tes coups te <b>soignent</b> de ${3 * lv} % des dégâts infligés.` },
    { id: 'b_belier', f: 'acier', s: 'atk', r: 'rare', n: 'Coups de bélier', max: 3, d: lv => `Tes coups <b>repoussent deux fois plus loin</b> ; un coup sur quatre libère une onde de choc (${120 * lv}).` },
    // ----- ESQUIVE -----
    { id: 'b_expl', f: 'braise', s: 'dash', r: 'rare', n: 'Esquive explosive', max: 3, d: lv => `Ton esquive laisse une <b>explosion</b> derrière toi (${110 * lv}).` },
    { id: 'b_dashz', f: 'foudre', s: 'dash', r: 'rare', n: 'Pas de foudre', max: 3, d: lv => `Esquiver à travers un ennemi le <b>foudroie</b> (${120 * lv}).` },
    { id: 'b_trail', f: 'vent', s: 'dash', r: 'commun', n: 'Sillage tranchant', max: 3, d: lv => `Ton esquive laisse une <b>lame de vent</b> qui tranche tout sur le trajet (${140 * lv}).` },
    { id: 'b_glace', f: 'givre', s: 'dash', r: 'rare', n: 'Pas glacé', max: 3, lock: 'givre', d: lv => `Ton esquive laisse un <b>sillage de glace</b> qui gèle ceux qui le touchent (${80 * lv}).` },
    { id: 'b_ruee', f: 'sang', s: 'dash', r: 'rare', n: 'Ruée vampirique', max: 3, lock: 'sang', d: lv => `Traverser un ennemi en esquivant te <b>rend ${2 * lv} %</b> de tes PV.` },
    { id: 'b_charge', f: 'acier', s: 'dash', r: 'rare', n: 'Charge au bouclier', max: 3, d: lv => `Ton esquive <b>bouscule</b> tout sur son passage (${90 * lv}) et te donne un bouclier (${5 * lv} % PV).` },
    // ----- POUVOIRS -----
    { id: 'b_meteo', f: 'braise', s: 'pouv', r: 'epique', n: 'Pluie de braises', max: 3, d: lv => `Chaque pouvoir lancé fait <b>pleuvoir 3 braises</b> sur les ennemis proches (${130 * lv} chacune).` },
    { id: 'b_orage', f: 'foudre', s: 'pouv', r: 'epique', n: 'Surtension', max: 3, d: lv => `Chaque pouvoir lancé fait <b>tomber la foudre</b> sur les 3 ennemis les plus proches (${200 * lv}).` },
    { id: 'b_nova', f: 'givre', s: 'pouv', r: 'rare', n: 'Nova glaciale', max: 3, lock: 'givre', d: lv => `Chaque pouvoir lancé libère une <b>onde de givre</b> qui ralentit tout à 7 m (${100 * lv}).` },
    { id: 'b_cd', f: 'vent', s: 'pouv', r: 'commun', n: 'Esprit vif', max: 3, d: lv => `Pouvoirs rechargés <b>${12 * lv} % plus vite</b> ; chaque pouvoir lancé te donne un élan de vitesse.` },
    { id: 'b_rituel', f: 'sang', s: 'pouv', r: 'rare', n: 'Rituel', max: 3, lock: 'sang', d: lv => `Chaque ennemi touché par un pouvoir te <b>soigne de ${lv} %</b> de tes PV (10 % max par pouvoir).` },
    { id: 'b_echo', f: 'univ', s: 'pouv', r: 'legendaire', n: 'Écho', max: 1, d: () => `Chaque pouvoir se <b>relance tout seul</b> 0,6 s plus tard.` },
    // ----- ULTIME -----
    { id: 'b_apoc', f: 'braise', s: 'ult', r: 'epique', n: 'Apocalypse', max: 3, d: lv => `Ton ultime fait <b>exploser un anneau de feu</b> géant autour de toi (${400 * lv}).` },
    { id: 'b_ultf', f: 'foudre', s: 'ult', r: 'rare', n: 'Surcharge', max: 3, d: lv => `Ton ultime se charge <b>${35 * lv} % plus vite</b> et déclenche 8 éclairs autour de toi.` },
    { id: 'b_hiver', f: 'givre', s: 'ult', r: 'epique', n: 'Hiver éternel', max: 3, lock: 'givre', d: lv => `Ton ultime <b>gèle tous les ennemis</b> à 15 m pendant ${(1.5 + 0.5 * lv).toFixed(1)} s.` },
    { id: 'b_cyclone', f: 'vent', s: 'ult', r: 'epique', n: 'Œil du cyclone', max: 3, d: lv => `Ton ultime invoque un <b>cyclone</b> qui te suit 6 s et hache tout autour (${60 * lv} par coup).` },
    { id: 'b_festin', f: 'sang', s: 'ult', r: 'rare', n: 'Festin', max: 3, lock: 'sang', d: lv => `Ton ultime te <b>rend ${15 * lv} %</b> de tes PV.` },
    { id: 'c_cri', f: 'coop', s: 'ult', r: 'epique', n: 'Cri de guerre', max: 1, coop: 1, lock: 'coop', d: () => `Ton ultime donne <b>+30 % de dégâts</b> à toute l'équipe pendant 8 s.` },
    // ----- PASSIFS -----
    { id: 'b_phenix', f: 'braise', s: 'passif', r: 'legendaire', n: 'Cœur de phénix', max: 1, d: () => `Une fois par étage, au lieu de tomber, tu <b>explose et renais</b> avec 50 % de tes PV.` },
    { id: 'b_saut', f: 'vent', s: 'passif', r: 'commun', n: 'Ressort', max: 1, d: () => `<b>Triple saut</b> : un saut de plus en l'air.` },
    { id: 'b_dash3', f: 'vent', s: 'passif', r: 'rare', n: 'Troisième souffle', max: 1, d: () => `<b>Une esquive de plus</b> avant de devoir recharger.` },
    { id: 'b_orbes', f: 'univ', s: 'passif', r: 'epique', n: 'Lames orbitales', max: 3, d: lv => `<b>${2 + lv} lames</b> tournent autour de toi et coupent ce qu'elles touchent (${55 * lv}).` },
    { id: 'b_epines', f: 'acier', s: 'passif', r: 'rare', n: 'Épines', max: 3, d: lv => `Quand tu es touché, tout ce qui est à 4 m subit <b>${90 * lv}</b> dégâts.` },
    { id: 'b_contre', f: 'acier', s: 'passif', r: 'rare', n: 'Contre parfait', max: 3, d: lv => `Après une esquive ou une parade parfaite, ton coup suivant fait <b>+${80 * lv} %</b>.` },
    { id: 'b_armure', f: 'givre', s: 'passif', r: 'rare', n: 'Armure de givre', max: 3, lock: 'givre', d: lv => `Toutes les 12 s, un <b>bouclier de glace</b> absorbe ${10 * lv} % de tes PV.` },
    { id: 'b_zero', f: 'givre', s: 'passif', r: 'epique', n: 'Zéro absolu', max: 3, lock: 'givre', d: lv => `Une esquive parfaite <b>gèle tout</b> à 8 m (${260 * lv}).` },
    { id: 'b_bris', f: 'givre', s: 'passif', r: 'rare', n: 'Bris de glace', max: 3, lock: 'givre', d: lv => `<b>+${35 * lv} % de dégâts</b> sur les ennemis gelés.` },
    { id: 'b_rage', f: 'sang', s: 'passif', r: 'rare', n: 'Rage', max: 3, lock: 'sang', d: lv => `Plus tu es blessé, plus tu frappes fort (jusqu'à <b>+${45 * lv} %</b>).` },
    { id: 'b_sacri', f: 'sang', s: 'passif', r: 'epique', n: 'Pacte de sang', max: 1, lock: 'sang', d: () => `<b>+60 % de dégâts</b>, mais −30 % de PV max.` },
    { id: 'b_dern', f: 'sang', s: 'passif', r: 'legendaire', n: 'Dernier souffle', max: 1, lock: 'sang', d: () => `Sous 35 % de PV : <b>+80 % de dégâts</b> et tes coups te soignent.` },
    { id: 'b_geant', f: 'univ', s: 'passif', r: 'rare', n: 'Taille XXL', max: 1, fun: 1, d: () => `Tu deviens <b>énorme</b> : +25 % de dégâts, +20 % de PV, un peu plus lent.` },
    { id: 'b_mini', f: 'univ', s: 'passif', r: 'rare', n: 'Format poche', max: 1, fun: 1, d: () => `Tu deviens <b>minuscule</b> : plus rapide, une esquive de plus, un peu moins de PV.` },
    { id: 'c_lien', f: 'coop', s: 'passif', r: 'rare', n: 'Lien d\'âmes', max: 3, coop: 1, lock: 'coop', d: lv => `Près d'un allié (8 m) : <b>+${15 * lv} % de dégâts</b>.` },
    { id: 'c_ange', f: 'coop', s: 'passif', r: 'epique', n: 'Ange gardien', max: 1, coop: 1, lock: 'coop', d: () => `Tu relèves tes alliés <b>2× plus vite</b> et ils reviennent avec 60 % de PV.` },
    { id: 'c_partage', f: 'coop', s: 'passif', r: 'commun', n: 'Partage', max: 3, coop: 1, lock: 'coop', d: lv => `Tes soins soignent aussi les alliés proches (<b>${30 * lv} %</b>).` },
    // ----- duos (deux familles déjà prises) -----
    { id: 'd_plasma', f: 'duo', s: 'passif', r: 'legendaire', n: 'Plasma', max: 1, duo: ['braise', 'foudre'], lock: 'duo', d: () => `Les brûlures propagent des <b>arcs électriques</b> aux ennemis voisins.` },
    { id: 'd_vapeur', f: 'duo', s: 'passif', r: 'legendaire', n: 'Choc thermique', max: 1, duo: ['braise', 'givre'], lock: 'duo', d: () => `Geler un ennemi qui brûle provoque une <b>explosion de vapeur</b> (400).` },
    { id: 'd_ouragan', f: 'duo', s: 'passif', r: 'legendaire', n: 'Ouragan', max: 1, duo: ['vent', 'foudre'], lock: 'duo', d: () => `Chaque esquive libère aussi un <b>anneau d'éclairs</b> (220).` },
    { id: 'd_saignee', f: 'duo', s: 'passif', r: 'legendaire', n: 'Saignée', max: 1, duo: ['sang', 'acier'], lock: 'duo', d: () => `Les épines te <b>soignent</b> et touchent 2× plus loin.` },
    // ----- vendus par le marchand seulement -----
    { id: 'b_pv', f: 'acier', s: 'passif', r: 'commun', n: 'Constitution', max: 3, shop: 1, d: lv => `+<b>${18 * lv} %</b> de PV max.` },
    { id: 'b_garde', f: 'acier', s: 'passif', r: 'rare', n: 'Rempart', max: 3, shop: 1, d: lv => `−<b>${10 * lv} %</b> de dégâts subis.` },
    { id: 'b_dmg', f: 'univ', s: 'passif', r: 'rare', n: 'Force brute', max: 3, shop: 1, d: lv => `+<b>${12 * lv} %</b> de dégâts.` },
    { id: 'b_crit', f: 'univ', s: 'passif', r: 'commun', n: 'Œil du chasseur', max: 3, shop: 1, d: lv => `+<b>${8 * lv} %</b> de coups critiques.` },
    { id: 'b_en', f: 'univ', s: 'passif', r: 'commun', n: 'Source vive', max: 3, shop: 1, d: lv => `+<b>${40 * lv} %</b> de régénération d'énergie.` },
    { id: 'b_vit', f: 'vent', s: 'passif', r: 'commun', n: 'Pieds légers', max: 3, shop: 1, d: lv => `+<b>${8 * lv} %</b> de vitesse de course.` },
  ];
  // la bénédiction actuellement posée sur une action (ou null)
  Q.boonOnSlot = (M, slot) => { if (!M || slot === 'passif') return null; for (const id in M.boons) { const B = Q.BOONS.find(x => x.id === id); if (B && B.s === slot) return B; } return null; };
  Q.boon = id => Q.BOONS.find(b => b.id === id);

  /* ---------------- malédictions (autel maudit, palier 9) — souvent visibles par tout le monde ---------------- */
  Q.CURSES = [
    { id: 'm_tete', n: 'Grosse tête', d: 'Ta tête triple de volume. Tu encaisses +25 % de dégâts.' },
    { id: 'm_verre', n: 'Corps de verre', d: '−40 % de PV max.' },
    { id: 'm_glisse', n: 'Savon', d: 'Tu glisses partout : impossible de t\'arrêter net.' },
    { id: 'm_lent', n: 'Boulet', d: '−15 % de vitesse de course.' },
    { id: 'm_avare', n: 'Bourse percée', d: 'Tu ne gagnes plus d\'or.' },
    { id: 'm_rouille', n: 'Esquive rouillée', d: '−1 charge d\'esquive.' },
    { id: 'm_nain', n: 'Rétréci', d: 'Tu rapetisses de moitié et tes coups font −25 % de dégâts.' },
  ];
  Q.curse = id => Q.CURSES.find(c => c.id === id);

  /* ---------------- affixes d'élite / de gardien ---------------- */
  Q.AFFIX = {
    enrage: { n: 'Enragé', d: 'Commence au stade II, attaque plus souvent' },
    carapace: { n: 'Carapace', d: '−50 % de dégâts subis tant que sa posture tient' },
    regen: { n: 'Régénérant', d: 'Se soigne s\'il n\'est pas frappé pendant 3 s' },
    rapide: { n: 'Véloce', d: '+25 % de vitesse' },
    geant: { n: 'Gigantesque', d: '+30 % de taille, frappe plus fort' },
    frenetique: { n: 'Frénétique', d: 'Enchaînements plus longs et plus rapides' },
  };

  /* ---------------- défis ---------------- */
  Q.DEFIS = {
    geants: { n: 'Horde de géants', d: 'Serviteurs énormes et résistants' },
    nodash: { n: 'Sans esquive', d: 'Impossible d\'esquiver : saute et pare !' },
    rapide: { n: 'Accéléré', d: 'Tout le monde va 30 % plus vite' },
  };

  /* ---------------- paliers d'Ascension (cumulatifs) ---------------- */
  Q.PALIERS = [
    { n: 'Palier 0', d: 'L\'Ascension telle quelle.' },
    { n: 'Palier 1', d: 'Ennemis +20 % de PV.' },
    { n: 'Palier 2', d: 'Les élites ont 2 affixes.' },
    { n: 'Palier 3', d: 'Le repos ne soigne plus que 25 %.' },
    { n: 'Palier 4', d: 'Ennemis +15 % de dégâts.' },
    { n: 'Palier 5', d: 'Les gardiens sont enragés.' },
    { n: 'Palier 6', d: 'Une vague de plus dans chaque horde.' },
    { n: 'Palier 7', d: 'Le marchand est 35 % plus cher.' },
    { n: 'Palier 8', d: 'Gardiens et colosse final +25 % de PV.' },
    { n: 'Palier 9', d: 'Tu commences avec une malédiction.' },
    { n: 'Palier 10', d: 'Le colosse final a un affixe de plus.' },
  ];
  const PCOL = ['#57d68d', '#8ee05a', '#c8e04a', '#ffd84a', '#ffb52e', '#ff8a3d', '#ff6a3d', '#ff4a4f', '#ff3b6f', '#e03bff', '#ffffff'];
  Q.palCol = p => PCOL[Math.max(0, Math.min(10, p | 0))];

  /* ---------------- autel des âmes (méta-progression) ---------------- */
  // la roue de l'autel des âmes : 26 bonus, 105 niveaux en tout (cost = un élément par niveau ; le prix d'un tour dépend du nombre total de niveaux déjà obtenus)
  const LV = n => new Array(n).fill(1);
  Q.UNLOCKS = [
    { id: 'givre', n: 'Famille du Givre', d: 'Nouvelles bénédictions de givre : coups qui gèlent, sillage de glace, nova, hiver éternel…', cost: LV(1), fam: 'givre' },
    { id: 'coop', n: 'Bénédictions de groupe', d: 'Des bénédictions qui ne servent qu\'à plusieurs : cri de guerre, ange gardien…', cost: LV(1), fam: 'coop' },
    { id: 'sang', n: 'Famille du Sang', d: 'Nouvelles bénédictions de sang : coups qui soignent, ruée vampirique, festin, rage…', cost: LV(1), fam: 'sang' },
    { id: 'duo', n: 'Bénédictions duo', d: 'Des bénédictions légendaires qui combinent deux familles.', cost: LV(1), fam: 'duo' },
    { id: 'bourse', n: 'Bourse de départ', d: 'Commence chaque course avec +40 d\'or par niveau.', cost: LV(5), fam: 'univ' },
    { id: 'vital', n: 'Vitalité', d: '+8 % de PV max par niveau.', cost: LV(5), fam: 'acier' },
    { id: 'force', n: 'Force brute', d: '+5 % de dégâts par niveau.', cost: LV(5), fam: 'braise' },
    { id: 'garde', n: 'Peau de pierre', d: '-4 % de dégâts subis par niveau.', cost: LV(5), fam: 'acier' },
    { id: 'vivacite', n: 'Pas léger', d: '+3 % de vitesse de déplacement par niveau.', cost: LV(5), fam: 'vent' },
    { id: 'oeil', n: 'Œil du faucon', d: '+3 % de chances de coup critique par niveau.', cost: LV(5), fam: 'foudre' },
    { id: 'ardeur', n: 'Âme ardente', d: 'L\'ultime se charge 6 % plus vite par niveau.', cost: LV(5), fam: 'foudre' },
    { id: 'ombre', n: 'Pas de l\'ombre', d: 'L\'esquive se recharge 5 % plus vite par niveau.', cost: LV(5), fam: 'vent' },
    { id: 'colosse', n: 'Tueur de colosses', d: '+5 % de dégâts contre les élites et les gardiens par niveau.', cost: LV(5), fam: 'braise' },
    { id: 'recup', n: 'Second souffle', d: 'Chaque salle terminée te rend 4 % de tes PV par niveau.', cost: LV(5), fam: 'sang' },
    { id: 'feu', n: 'Feu sacré', d: 'Les feux de camp soignent 8 % de plus par niveau.', cost: LV(5), fam: 'braise' },
    { id: 'flair', n: 'Flair du trésor', d: '+10 % d\'or gagné par niveau.', cost: LV(5), fam: 'univ' },
    { id: 'marchand', n: 'Ami des marchands', d: '-6 % sur les prix du marchand par niveau.', cost: LV(5), fam: 'univ' },
    { id: 'coffre', n: 'Clé dorée', d: 'Chaque coffre a 5 % de chances par niveau d\'être d\'une rareté au-dessus.', cost: LV(5), fam: 'univ' },
    { id: 'forge', n: 'Main du forgeron', d: 'La forge automatique a 15 % de chances par niveau de donner un niveau de plus.', cost: LV(5), fam: 'acier' },
    { id: 'mecano', n: 'Mécanicien', d: 'Les énigmes rapportent 12 % d\'or en plus par niveau.', cost: LV(5), fam: 'acier' },
    { id: 'savoir', n: 'Mémoire vive', d: 'Grand Oral : +1 s au sablier par niveau ; salles du Savoir : +10 % d\'or par niveau.', cost: LV(5), fam: 'givre' },
    { id: 'moisson', n: 'Moisson d\'âmes', d: '+8 % d\'éclats en fin de course par niveau.', cost: LV(5), fam: 'univ' },
    { id: 'relance', n: 'Œil du destin', d: 'Niveau 1 : un 4e choix de récompense. Niveaux 2 et 3 : coffres plus souvent rares.', cost: LV(3), fam: 'univ' },
    { id: 'ultdep', n: 'Ultime chargé', d: 'Ton ultime commence chargé (40 %, 70 %, puis 100 %).', cost: LV(3), fam: 'foudre' },
    { id: 'legend', n: 'Âme légendaire', d: 'Les bénédictions épiques et légendaires apparaissent plus souvent (cumulable).', cost: LV(3), fam: 'univ' },
    { id: 'chance', n: 'Seconde chance', d: 'Une renaissance automatique par course et par niveau.', cost: LV(2), fam: 'braise' },
  ];


  /* ---------------- trophées de fin de course (multijoueur) ---------------- */
  Q.AWARDS = [
    { id: 'boucher', n: 'LE BOUCHER', k: 'dmg', best: 'max', t: (v) => `${BR.fmt(v)} dégâts infligés` },
    { id: 'paillasson', n: 'LE PAILLASSON', k: 'taken', best: 'max', t: (v) => `a encaissé ${BR.fmt(v)} dégâts (aïe)` },
    { id: 'lazare', n: 'LAZARE', k: 'downs', best: 'max', min: 1, t: (v) => `est tombé ${v} fois… et s'est relevé` },
    { id: 'infirmier', n: 'L\'INFIRMIER', k: 'revives', best: 'max', min: 1, t: (v) => `a relevé ses potes ${v} fois` },
    { id: 'danseur', n: 'LE DANSEUR', k: 'perfect', best: 'max', min: 1, t: (v) => `${v} esquives parfaites, la classe` },
    { id: 'mur', n: 'LE MUR', k: 'parries', best: 'max', min: 1, t: (v) => `${v} parades parfaites` },
    { id: 'flambeur', n: 'LE FLAMBEUR', k: 'spent', best: 'max', min: 1, t: (v) => `a claqué ${v} pièces d'or` },
    { id: 'maudit', n: 'LE MAUDIT', k: 'curses', best: 'max', min: 1, t: (v) => `${v} malédiction${v > 1 ? 's' : ''} acceptée${v > 1 ? 's' : ''} sans trembler` },
    { id: 'collection', n: 'LE COLLECTIONNEUR', k: 'nboons', best: 'max', t: (v) => `${v} bénédictions sur le dos` },
    { id: 'touriste', n: 'LE TOURISTE', k: 'dmg', best: 'min', multi: 1, t: () => `était surtout là pour la vue` },
  ];
})();

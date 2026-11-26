/* ===== arena/asc-tree.js : arbres de compétences des classes (Chevalier, Mage, Archer) =====
   Chaque classe a un arbre en 3 branches : ARME (attaque de base), POUVOIRS, ULTIME. Les nœuds donnent des effets
   CONCRETS (flèche en plus, onde de choc, charge d'esquive, ultime préchargé…), jamais des pourcentages de dégâts.
   - Niveau de classe : xp gagnée en fin de course (asc-run.js endRun) → Q.clsLevel(xp) ; 1 point par niveau
     + 1 point bonus tous les 5 niveaux. Réinitialisation gratuite.
   - Données : D.cls[cls].nodes = { idNœud: rang } (Q.data / Q.saveData).
   - En course : M.tree (copie faite au départ) ; les effets s'abonnent aux évènements de combat (Q.on, asc-combat.js)
     et ne s'appliquent qu'au joueur local (il fait autorité sur ses dégâts). Les visuels importants partent aux autres
     joueurs par { k: 'qa', t: 'tree' } et sont rejoués sans dégâts (Q.on('net')).
   - Pouvoirs précis (tourbillon, météore…) : lus dans les fichiers de classe via Q.treeRank(f, id).
   - Écran : UI.screen('asc-tree') (ouvert par le vendeur du village : UI.show('asc-tree') ou Q.openTree(cls)). */
(function () {
  const BR = window.BR, Q = BR && BR.Asc; if (!Q || !Q.on) return;
  const AR = BR.ARENA, UI = BR.UI, Au = BR.Audio, esc = BR.esc || (s => String(s));
  const V3 = THREE.Vector3;
  const T = () => BR.Arena.ascTools();
  const keyOf = t => BR.Arena.groupKey(t);
  const CLS = ['chevalier', 'mage', 'archer'];

  /* =====================================================================
     1. NIVEAU DE CLASSE
     ===================================================================== */
  const LV_MAX = 40;
  const ROWLV = [1, 2, 4, 7, 11, 16];                         // niveau de classe requis pour chaque rangée de l'arbre
  const needOf = lv => Math.round(600 + 80 * (lv - 1) + 3 * (lv - 1) * (lv - 1));   // xp pour passer de lv à lv+1
  Q.CLS_LV_MAX = LV_MAX; Q.TREE_ROWLV = ROWLV;
  Q.clsLevel = function (xp) {
    xp = Math.max(0, Math.floor(Number(xp) || 0)); let lv = 1;
    while (lv < LV_MAX && xp >= needOf(lv)) { xp -= needOf(lv); lv++; }
    const max = lv >= LV_MAX;
    return { lv, cur: max ? 0 : xp, need: max ? 0 : needOf(lv), max };
  };
  const ptsAt = lv => lv + Math.floor(lv / 5);                // points gagnés au total à ce niveau
  Q.treePtsAt = ptsAt;

  /* =====================================================================
     2. ICÔNES DES NŒUDS (traits, 24×24)
     ===================================================================== */
  const IC = {
    blade: '<path d="M19 5L8 16"/><path d="M14.5 4.5H19.5V9.5"/><path d="M5.5 13.5l5 5M4 20l3-3"/>',
    blade2: '<path d="M12 21L4.5 6.5M12 21l7.5-14.5"/><path d="M3 9.5l1.5-3 3.2.8M21 9.5l-1.5-3-3.2.8"/>',
    swords: '<path d="M4 4l11 11M4 4h4.5M4 4v4.5"/><path d="M20 4L9 15M20 4h-4.5M20 4v4.5"/><path d="M13 17l4 4M7 21l4-4"/>',
    wave: '<circle cx="12" cy="14" r="2.2"/><path d="M6.5 14a5.5 5.5 0 0 1 11 0M3 14a9 9 0 0 1 18 0"/><path d="M2 20h20"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/>',
    shield2: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/><path d="M12 7.5v9M8.5 11h7"/>',
    ghost: '<path d="M6 20.5V10a6 6 0 0 1 12 0v10.5l-2-1.8-2 1.8-2-1.8-2 1.8-2-1.8z"/><circle cx="10" cy="10.5" r=".9"/><circle cx="14" cy="10.5" r=".9"/>',
    hammer: '<path d="M4 20.5l8-8"/><path d="M10.5 6.5l4-4 7 7-4 4z"/>',
    cross: '<path d="M5 5l14 14M19 5L5 19"/><path d="M3 9V3h6M21 15v6h-6"/>',
    dash: '<path d="M3 12h11M2 7.5h7M5 16.5h8"/><path d="M14 6l6 6-6 6"/>',
    boot: '<path d="M8 3v8.5L4.5 17h12.5a3 3 0 0 0-3-3H11V3z"/><path d="M3 21h18"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    heart: '<path d="M12 20s-7.5-4.5-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.5 12 20 12 20z"/>',
    heart2: '<path d="M12 20s-7.5-4.5-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.5 12 20 12 20z"/><path d="M12 10v6M9 13h6"/>',
    star: '<path d="M12 2.5l2.8 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.8 6 20.3l1.6-6.6-5.1-4.4 6.7-.6z"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2.5h6"/>',
    spark: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/>',
    spin: '<path d="M20 12a8 8 0 1 1-2.8-6.1"/><path d="M17.5 2v4.2h4.2"/><circle cx="12" cy="12" r="2.2"/>',
    skull: '<path d="M12 3a8 8 0 0 0-5 14.2V20.5h10v-3.3A8 8 0 0 0 12 3z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10.5 20.5v-2.5M13.5 20.5v-2.5"/>',
    echo: '<circle cx="8.5" cy="12" r="4.5"/><path d="M14.5 7a6.5 6.5 0 0 1 0 10M18 4.5a10 10 0 0 1 0 15"/>',
    echo2: '<path d="M12 6.5l1.6 3.6 3.9.4-3 2.6.9 3.8L12 15l-3.4 1.9.9-3.8-3-2.6 3.9-.4z"/><path d="M3.5 12a8.5 8.5 0 0 1 17 0M3.5 12a8.5 8.5 0 0 0 17 0" stroke-dasharray="2.2 2.6"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12.5h15a3 3 0 1 1-3 3M3 17h8"/>',
    orbit: '<circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><circle cx="20.5" cy="9.8" r="1.4"/><circle cx="3.5" cy="14.2" r="1.4"/>',
    battery: '<rect x="2.5" y="7" width="16.5" height="10" rx="2"/><path d="M22 10.5v3M6 10v4M9.5 10v4M13 10v4"/>',
    circle: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.4"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M4 3v5h5M20 21v-5h-5"/>',
    flame: '<path d="M12 22c4 0 7-2.8 7-6.8 0-4.4-4-6.2-4.6-11.2-2 1.4-3.4 3.7-3.4 6.3-1.3-.8-2-2.3-2.1-3.8C6.6 8.6 5 11.3 5 15.2 5 19.2 8 22 12 22z"/>',
    roar: '<path d="M3.5 9v6h4l5.5 4.5v-15L7.5 9z"/><path d="M16.5 9a4 4 0 0 1 0 6M19.5 6a8 8 0 0 1 0 12"/>',
    drop: '<path d="M12 3c3.5 5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6 6-11z"/>',
    crown: '<path d="M3 17.5l1.5-10 5 4.5L12 4.5l2.5 7.5 5-4.5 1.5 10z"/><path d="M3 21h18"/>',
    bounce: '<path d="M3 18.5l6-10.5 5 7 7-11"/><circle cx="9" cy="8" r="1.5"/><circle cx="14" cy="15" r="1.5"/>',
    orbs: '<circle cx="6.5" cy="16" r="3.2"/><circle cx="16" cy="7.5" r="3.2"/><circle cx="17.5" cy="18" r="2.2"/><path d="M9 13.5l4.3-3.6"/>',
    snow: '<path d="M12 2v20M3.4 7l17.2 10M20.6 7L3.4 17M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>',
    snow2: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><circle cx="12" cy="12" r="4"/>',
    burst: '<path d="M12 2l1.8 6 5.2-3.4-3.2 5.4 6.2 1-6 2.2 3.8 5-5.6-2.6L12 22l-1.6-6.4-5.6 2.6 3.8-5L2.6 11l6.2-1L5.6 4.6l4.6 3.4z"/>',
    lance: '<path d="M3 21L17.5 6.5"/><path d="M14 4l6.5-1-1 6.5z"/><path d="M5.5 15.5l3 3"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    storm: '<path d="M6 14.5a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 17 7a3.8 3.8 0 0 1 1 7.5z"/><path d="M12.5 13l-2.2 4h3.2l-2.2 4.5"/>',
    prism: '<path d="M12 3l8.5 15h-17z"/><path d="M1.5 12.5H9M15.5 11l6.5-3M16 13.5l6 3"/>',
    hole: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3a9 9 0 0 1 9 9M12 21a9 9 0 0 1-9-9M19.2 5.5a9 9 0 0 1-2.2 13M4.8 18.5a9 9 0 0 1 2.2-13"/>',
    arrows: '<path d="M3 15L15 3"/><path d="M10 3h5v5"/><path d="M9 21L21 9"/><path d="M16 9h5v5"/>',
    arrows3: '<path d="M3 9l9-6M3 15l15-10M9 21l12-8"/><path d="M8.5 3H12v3.2M14.5 5H18v3.2M17.5 13H21v3.2"/>',
    fan: '<path d="M12 21V6M12 21L5 8.5M12 21l7-12.5"/><path d="M10 7.5l2-3.5 2 3.5M3.4 10.6l1-4 3.4 1.6M16.2 8.2l3.4-1.6 1 4"/>',
    trap: '<path d="M12 3v12"/><path d="M9 6l3-3 3 3"/><path d="M4 18c2.5 2.5 13.5 2.5 16 0M6 15.5l-2 2.5M18 15.5l2 2.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    feather: '<path d="M20 4c-8 0-14 6-14 14v2.5"/><path d="M20 4c0 7-5 12-12 12M11.5 12.5H7.5M15 9h-4"/>',
    rain: '<path d="M7 3l-2 5M13 3l-2 5M19 3l-2 5M10 11l-2 5M16 11l-2 5M7 19l-1 2.5M13 19l-1 2.5M19 19l-1 2.5"/>',
  };
  const icon = (name, sz, col) => `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="${col || 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[name] || IC.star}</svg>`;
  Q.treeIcon = icon;

  /* =====================================================================
     3. LES ARBRES
     id : identifiant sauvegardé (ne jamais le renommer) · br : w (arme) | p (pouvoirs) | u (ultime)
     r : rangée 0..5 (niveau requis ROWLV[r]) · c : colonne 0..2 · d : texte de chaque rang (le 1er complet, les suivants = ce qui change)
     req : il faut au moins 1 rang dans UN de ces nœuds · sk : pouvoir concerné (effet seulement s'il est équipé)
     key : nœud clé (coût 2 points, un seul rang)
     ===================================================================== */
  const N = (br, r, c, id, ic, n, d, o) => Object.assign({ id, br, r, c, ic, n, d: Array.isArray(d) ? d : [d], req: null, key: false, cost: 1 }, o || {});
  const KEY = (br, r, c, id, ic, n, d, req) => N(br, r, c, id, ic, n, d, { key: true, cost: 2, req });
  // nœuds communs (textes identiques d'une classe à l'autre)
  const G = {
    rech: (p, n) => N('p', 0, 0, p + '_p_rech', 'clock', n, ['Chaque recharge de pouvoir dure 0,5 s de moins.', '1 s de moins sur chaque recharge.']),
    kill: (p, n, req) => N('p', 2, 0, p + '_p_kill', 'skull', n, ['Chaque ennemi éliminé : −0,25 s sur la recharge de tes 4 pouvoirs.', '−0,5 s par ennemi éliminé.'], { req }),
    echo: (p, n, req) => N('p', 2, 2, p + '_p_echo', 'echo', n, 'Le premier pouvoir de chaque étage est lancé deux fois.', { req }),
    dbl: (p, n, req) => KEY('p', 5, 0, p + '_k_double', 'echo2', n, 'Un pouvoir sur trois est relancé une seconde fois, gratuitement.', req),
    upret: (p, n) => N('u', 0, 0, p + '_u_pret', 'battery', n, ['Chaque étage commence avec l\'ultime chargé à 20 %.', 'Chargé à 40 %.']),
    ukill: (p, n) => N('u', 0, 1, p + '_u_kill', 'skull', n, ['Chaque ennemi éliminé charge ton ultime de 1 %.', '2 % par ennemi éliminé.']),
    uinv: (p, n) => N('u', 0, 2, p + '_u_inv', 'shield', n, ['Après ton ultime, tu es intouchable 1,5 s.', 'Intouchable 3 s.']),
    ureset: (p, n, req) => N('u', 1, 2, p + '_u_reset', 'refresh', n, 'Ton ultime recharge instantanément tes 4 pouvoirs.', { req }),
    uzone: (p, n, req) => N('u', 1, 1, p + '_u_zone', 'circle', n, 'Ton ultime laisse au sol une zone de 6 m qui ralentit et blesse les ennemis pendant 5 s.', { req }),
    ucast: (p, n, req) => N('u', 4, 1, p + '_u_cast', 'battery', n, ['Chaque pouvoir lancé charge ton ultime de 3 %.', '6 % par pouvoir lancé.'], { req }),
    uecho: (p, n, req) => KEY('u', 5, 0, p + '_k_echo', 'echo2', n, 'Ton premier ultime de chaque étage se relance tout seul 2 s plus tard.', req),
  };

  Q.TREES = {
    /* ------------------------------ CHEVALIER ------------------------------ */
    chevalier: [
      // ARME
      N('w', 0, 0, 'ch_lame', 'blade', 'Lame d\'énergie', ['Tous les 4 coups d\'épée, une lame d\'énergie file droit devant sur 10 m et traverse tout.', 'Tous les 3 coups d\'épée.', 'Tous les 2 coups d\'épée.']),
      N('w', 0, 1, 'ch_estoc', 'wave', 'Estoc sismique', ['Ton 4e coup (l\'estoc) libère une onde de choc de 4 m qui repousse.', 'Onde de 6 m qui étourdit 0,5 s.']),
      N('w', 0, 2, 'ch_ecu', 'shield', 'Écu d\'acier', ['Toutes les 6 touches d\'épée : bouclier de 60 PV.', 'Bouclier de 120 PV.']),
      N('w', 1, 0, 'ch_fant', 'ghost', 'Entaille fantôme', 'Après une esquive, ton prochain coup d\'épée est doublé par une entaille fantôme.', { req: ['ch_lame'] }),
      N('w', 1, 1, 'ch_lourd', 'hammer', 'Coup de bouclier', ['Ton coup chargé (clic maintenu) projette en l\'air et étourdit 1 s tout autour de toi.', 'Il fend aussi le sol : 3 explosions en ligne devant toi.'], { req: ['ch_estoc'] }),
      N('w', 1, 2, 'ch_parade', 'cross', 'Riposte du bastion', 'Après une parade ou une esquive parfaite, ton prochain coup d\'épée est un critique garanti qui projette.', { req: ['ch_ecu'] }),
      N('w', 2, 0, 'ch_danse', 'boot', 'Danse de lame', ['Toutes les 10 touches d\'épée : +1 charge d\'esquive.', 'Toutes les 6 touches.'], { req: ['ch_fant'] }),
      N('w', 2, 1, 'ch_foudre', 'bolt', 'Estoc foudroyant', ['Ton 4e coup appelle la foudre sur l\'ennemi touché.', 'L\'éclair saute ensuite sur 2 autres ennemis.'], { req: ['ch_lourd'] }),
      N('w', 2, 2, 'ch_avide', 'heart', 'Lame avide', ['Chaque ennemi achevé à l\'épée te soigne de 20 PV.', '40 PV par ennemi achevé.'], { req: ['ch_parade'] }),
      N('w', 3, 0, 'ch_echo', 'swords', 'Écho d\'acier', ['Ton 4e coup est répété par une épée spectrale 0,3 s plus tard.', 'Répété par deux épées spectrales.'], { req: ['ch_danse'] }),
      N('w', 3, 1, 'ch_seisme', 'star', 'Chute sismique', 'Ton attaque plongeante (attaque en l\'air) fait jaillir 6 lames de lumière du sol, en étoile.', { req: ['ch_foudre'] }),
      N('w', 3, 2, 'ch_fer', 'shield2', 'Garde de fer', 'Tant que tu lèves ta garde (clic droit), tu gagnes 40 PV de bouclier par seconde (jusqu\'à 160).', { req: ['ch_avide'] }),
      N('w', 4, 0, 'ch_vague', 'blade2', 'Lames jumelles', 'Tes lames d\'énergie partent en double, en V.', { req: ['ch_echo'] }),
      N('w', 4, 2, 'ch_rempart', 'heart2', 'Rempart vivant', ['+150 PV max.', '+300 PV max.'], { req: ['ch_fer', 'ch_seisme'] }),
      KEY('w', 5, 0, 'ch_colosse', 'crown', 'Épée colossale', 'Tous les 12 coups d\'épée, ta lame devient géante pendant 4 s : chaque coup fauche aussi un grand arc de 5 m.', ['ch_vague']),
      KEY('w', 5, 2, 'ch_acier', 'swords', 'Pluie d\'acier', 'Ton coup chargé fait tomber 5 épées spectrales sur l\'ennemi visé.', ['ch_rempart']),
      // POUVOIRS
      G.rech('ch', 'Discipline'),
      N('p', 0, 1, 'ch_p_bouc', 'shield', 'Serment', ['Chaque pouvoir lancé te donne un bouclier de 50 PV.', 'Bouclier de 100 PV.']),
      N('p', 0, 2, 'ch_p_crit', 'spark', 'Lame chargée', 'Après un pouvoir, ton prochain coup d\'épée est un critique garanti qui projette.'),
      N('p', 1, 0, 'ch_tour', 'spin', 'Tourbillon : +1 tour', ['Ton Tourbillon d\'acier fait 1 tour de plus.', '2 tours de plus.'], { req: ['ch_p_rech'], sk: 'tourbillon' }),
      N('p', 1, 1, 'ch_fente', 'bolt', 'Fente : sillage de foudre', '3 éclairs frappent la trajectoire de ta Fente éclair.', { req: ['ch_p_bouc'], sk: 'fente' }),
      N('p', 1, 2, 'ch_bond', 'swords', 'Saut : pluie d\'épées', 'À l\'impact du Saut écrasant, 4 épées spectrales tombent autour de toi.', { req: ['ch_p_crit'], sk: 'bond' }),
      G.kill('ch', 'Moisson', ['ch_tour']),
      N('p', 2, 1, 'ch_garde', 'shield2', 'Garde : riposte de plus', 'Ta Garde du bastion encaisse 1 coup de plus et dure 0,4 s de plus.', { req: ['ch_fente'], sk: 'garde' }),
      G.echo('ch', 'Premier élan', ['ch_bond']),
      N('p', 3, 0, 'ch_cyclone', 'wind', 'Tourbillon : cyclone', 'Le Tourbillon laisse derrière toi un cyclone d\'acier (comme au niveau 5).', { req: ['ch_p_kill'], sk: 'tourbillon' }),
      N('p', 3, 1, 'ch_p_onde', 'wave', 'Choc des arcanes', 'Lancer 3 pouvoirs différents en 8 s libère une onde de 7 m qui étourdit 1 s.', { req: ['ch_garde'] }),
      N('p', 3, 2, 'ch_fente2', 'dash', 'Fente : rebond', 'Ta Fente éclair rebondit sur l\'ennemi le plus proche : une fente de plus.', { req: ['ch_p_echo'], sk: 'fente' }),
      N('p', 4, 1, 'ch_p_ener', 'boot', 'Second souffle', ['Chaque pouvoir lancé te rend 1 charge d\'esquive.', 'Et 15 points d\'énergie.'], { req: ['ch_cyclone', 'ch_p_onde', 'ch_fente2'] }),
      G.dbl('ch', 'Double frappe', ['ch_p_ener']),
      KEY('p', 5, 2, 'ch_k_lames', 'orbit', 'Lames gardiennes', 'Tous les 4 pouvoirs lancés, 6 épées spectrales gravitent autour de toi 8 s et frappent seules.', ['ch_p_ener']),
      // ULTIME
      G.upret('ch', 'Cœur vaillant'), G.ukill('ch', 'Gloire'), G.uinv('ch', 'Égide'),
      N('u', 1, 0, 'ch_u_parry', 'cross', 'Fureur du bastion', ['Chaque parade ou esquive parfaite charge ton ultime de 8 %.', '15 % par parade parfaite.'], { req: ['ch_u_pret'] }),
      G.uzone('ch', 'Terre sacrée', ['ch_u_kill']),
      G.ureset('ch', 'Renouveau', ['ch_u_inv']),
      N('u', 2, 0, 'ch_u_lame', 'swords', 'Lame céleste : éventail', 'Deux lames célestes de plus s\'abattent en éventail (au niveau 5 : quatre).', { req: ['ch_u_parry'], sk: 'u_lame' }),
      N('u', 2, 1, 'ch_u_faille', 'flame', 'Lame céleste : faille', 'La faille brûlante apparaît dès le niveau 1 et dure 6 s.', { req: ['ch_u_zone'], sk: 'u_lame' }),
      N('u', 2, 2, 'ch_u_heal', 'heart', 'Sang royal', ['Ton ultime te soigne de 150 PV.', 'Il soigne 300 PV.'], { req: ['ch_u_reset'] }),
      N('u', 3, 0, 'ch_u_post', 'blade', 'Après la tempête', ['Pendant 6 s après ton ultime, chaque coup d\'épée lance une lame d\'énergie.', 'Pendant 10 s.'], { req: ['ch_u_lame'] }),
      N('u', 3, 2, 'ch_u_cri', 'roar', 'Cri du colosse', 'Ton ultime étourdit tous les ennemis à 12 m pendant 1,5 s.', { req: ['ch_u_heal', 'ch_u_faille'] }),
      N('u', 4, 1, 'ch_u_hurt', 'drop', 'Rancune', ['Chaque tranche de 100 dégâts reçus charge ton ultime de 4 %.', '8 % par tranche de 100 dégâts.'], { req: ['ch_u_post', 'ch_u_cri'] }),
      G.uecho('ch', 'Écho céleste', ['ch_u_hurt']),
      KEY('u', 5, 2, 'ch_k_avatar', 'crown', 'Avatar', 'Pendant 8 s après ton ultime, tu deviens géant et chaque coup d\'épée frappe tout autour de toi.', ['ch_u_hurt']),
    ],

    /* ------------------------------ MAGE ------------------------------ */
    mage: [
      // ARME
      N('w', 0, 0, 'mg_rebond', 'bounce', 'Ricochet', ['Tes projectiles de bâton rebondissent sur un 2e ennemi.', 'Ils rebondissent encore une fois (3 ennemis).']),
      N('w', 0, 1, 'mg_trio', 'orbs', 'Salve', ['Tous les 4 tirs, ton bâton tire 2 projectiles en plus.', 'Tous les 3 tirs.']),
      N('w', 0, 2, 'mg_givre', 'snow', 'Bâton de givre', 'Ta triple salve (3e tir du combo) ralentit les ennemis touchés.'),
      N('w', 1, 0, 'mg_mana', 'drop', 'Canalisation', ['Toutes les 5 touches de bâton : +8 énergie.', '+15 énergie.'], { req: ['mg_rebond'] }),
      N('w', 1, 1, 'mg_orbe', 'burst', 'Orbe instable', ['Ton tir chargé (l\'orbe) éclate en 4 éclats chercheurs.', '7 éclats chercheurs.'], { req: ['mg_trio'] }),
      N('w', 1, 2, 'mg_brul', 'flame', 'Flamme arcanique', 'Tous les 5 tirs, ton projectile explose à l\'impact (zone de 3 m).', { req: ['mg_givre'] }),
      N('w', 2, 0, 'mg_perce', 'lance', 'Lance arcanique', 'Après une esquive, ton prochain tir est accompagné d\'une lance qui traverse tout.', { req: ['mg_mana'] }),
      N('w', 2, 1, 'mg_orbe2', 'orbs', 'Orbe jumelle', 'Ton tir chargé tire une 2e orbe juste après.', { req: ['mg_orbe'] }),
      N('w', 2, 2, 'mg_bouclier', 'shield', 'Égide de mana', ['Toutes les 8 touches de bâton : bouclier de 50 PV.', 'Bouclier de 100 PV.'], { req: ['mg_brul'] }),
      N('w', 3, 0, 'mg_chaine', 'bolt', 'Arc électrique', ['Tous les 6 tirs, un éclair saute de la cible vers 3 ennemis.', 'Vers 5 ennemis.'], { req: ['mg_perce'] }),
      N('w', 3, 1, 'mg_blink', 'boot', 'Pas de côté', '+1 charge d\'esquive.', { req: ['mg_orbe2'] }),
      N('w', 3, 2, 'mg_nova', 'snow2', 'Cœur de givre', 'Quand tu es touché, une nova de givre ralentit les ennemis à 5 m (au plus toutes les 5 s).', { req: ['mg_bouclier'] }),
      N('w', 4, 1, 'mg_fam', 'eye', 'Familier arcanique', ['Un orbe flotte près de toi et tire seul sur l\'ennemi le plus proche toutes les 1,5 s.', 'Il tire toutes les 0,9 s.'], { req: ['mg_chaine', 'mg_blink', 'mg_nova'] }),
      KEY('w', 5, 0, 'mg_k_tempete', 'storm', 'Bâton-tempête', 'Tous les 10 tirs, 6 éclairs frappent les ennemis autour de toi.', ['mg_fam']),
      KEY('w', 5, 2, 'mg_k_prisme', 'prism', 'Prisme', 'Chaque projectile de bâton qui touche se divise en 2 éclats chercheurs.', ['mg_fam']),
      // POUVOIRS
      G.rech('mg', 'Concentration'),
      N('p', 0, 1, 'mg_p_ener', 'drop', 'Source', ['Chaque pouvoir lancé te rend 8 énergie.', '15 énergie.']),
      N('p', 0, 2, 'mg_p_crit', 'spark', 'Résonance', 'Après un pouvoir, ton prochain tir de bâton est critique et explose (3 m).'),
      N('p', 1, 0, 'mg_traits', 'orbs', 'Missiles : +1 missile', ['Tes Missiles arcaniques tirent 1 missile de plus.', '2 missiles de plus.'], { req: ['mg_p_rech'], sk: 'traits' }),
      N('p', 1, 1, 'mg_onde', 'snow', 'Nova : seconde vague', 'Les pics de ta Nova de givre éclatent une seconde fois (comme au niveau 5).', { req: ['mg_p_ener'], sk: 'onde' }),
      N('p', 1, 2, 'mg_fente', 'burst', 'Transfert : éclats', 'À l\'arrivée du Transfert, 5 éclats chercheurs partent sur les ennemis proches (10 au niveau 5).', { req: ['mg_p_crit'], sk: 'fente' }),
      G.kill('mg', 'Siphon', ['mg_traits']),
      N('p', 2, 1, 'mg_pluie', 'rain', 'Averse : +6 étoiles', ['Ton Averse d\'étoiles fait tomber 6 étoiles de plus.', '12 étoiles de plus.'], { req: ['mg_onde'], sk: 'pluie' }),
      G.echo('mg', 'Écho arcanique', ['mg_fente']),
      N('p', 3, 0, 'mg_p_combo', 'wave', 'Harmonie', 'Lancer 3 pouvoirs différents en 8 s libère une explosion arcanique de 7 m.', { req: ['mg_p_kill'] }),
      N('p', 3, 1, 'mg_pluie2', 'star', 'Averse : étoile géante', 'Une étoile géante clôt toujours l\'Averse d\'étoiles (comme au niveau 5).', { req: ['mg_pluie'], sk: 'pluie' }),
      N('p', 3, 2, 'mg_p_blink', 'boot', 'Distorsion', 'Chaque pouvoir lancé te rend 1 charge d\'esquive.', { req: ['mg_p_echo'] }),
      N('p', 4, 1, 'mg_p_gel', 'snow2', 'Givre éternel', ['Tes pouvoirs ralentissent les ennemis touchés 0,5 s.', 'Pendant 1 s.'], { req: ['mg_p_combo', 'mg_pluie2', 'mg_p_blink'] }),
      G.dbl('mg', 'Double incantation', ['mg_p_gel']),
      KEY('p', 5, 2, 'mg_k_sent', 'orbit', 'Sentinelles', 'Tous les 4 pouvoirs lancés, des sentinelles astrales t\'entourent 8 s et tirent seules.', ['mg_p_gel']),
      // ULTIME
      G.upret('mg', 'Étoile du matin'), G.ukill('mg', 'Moisson d\'âmes'), G.uinv('mg', 'Voile astral'),
      N('u', 1, 0, 'mg_u_mana', 'drop', 'Flux infini', 'Pendant 6 s après ton ultime, tes pouvoirs ne coûtent plus d\'énergie.', { req: ['mg_u_pret'] }),
      G.uzone('mg', 'Cercle de stase', ['mg_u_kill']),
      G.ureset('mg', 'Renouveau', ['mg_u_inv']),
      N('u', 2, 0, 'mg_u_pluie', 'rain', 'Météore : pluie de braises', '6 petits météores tombent autour du grand (au niveau 5 : 12).', { req: ['mg_u_mana'], sk: 'u_meteore' }),
      N('u', 2, 1, 'mg_u_crat', 'flame', 'Météore : brasier', 'Le cratère brûlant est large dès le niveau 1 et brûle 8 s.', { req: ['mg_u_zone'], sk: 'u_meteore' }),
      N('u', 2, 2, 'mg_u_heal', 'shield', 'Égide astrale', ['Ton ultime te donne un bouclier de 200 PV.', 'Bouclier de 400 PV.'], { req: ['mg_u_reset'] }),
      N('u', 3, 0, 'mg_u_post', 'orbs', 'Surcharge', ['Pendant 6 s après ton ultime, chaque tir de bâton part en triple.', 'Pendant 10 s.'], { req: ['mg_u_pluie'] }),
      N('u', 3, 2, 'mg_u_freeze', 'snow', 'Hiver', 'Ton ultime gèle tous les ennemis à 12 m pendant 1,5 s.', { req: ['mg_u_crat', 'mg_u_heal'] }),
      G.ucast('mg', 'Flux', ['mg_u_post', 'mg_u_freeze']),
      G.uecho('mg', 'Écho du cataclysme', ['mg_u_cast']),
      KEY('u', 5, 2, 'mg_k_trou', 'hole', 'Singularité', 'Ton ultime ouvre aussi un trou noir sur la zone visée.', ['mg_u_cast']),
    ],

    /* ------------------------------ ARCHER ------------------------------ */
    archer: [
      // ARME
      N('w', 0, 0, 'ar_plus', 'arrows', 'Carreau de plus', ['Tous les 4 tirs, tu décoches 1 flèche en plus.', 'Tous les 3 tirs.', 'Tous les 2 tirs.']),
      N('w', 0, 1, 'ar_feu', 'flame', 'Pointes incendiaires', ['Tous les 6 tirs, ta flèche explose à l\'impact (zone de 3 m).', 'Tous les 4 tirs.']),
      N('w', 0, 2, 'ar_crit', 'eye', 'Œil de lynx', ['Une flèche sur 5 qui touche est un critique garanti.', 'Une sur 4.']),
      N('w', 1, 0, 'ar_trait3', 'fan', 'Éventail', 'Ton 3e tir du combo décoche 5 flèches au lieu de 3.', { req: ['ar_plus'] }),
      N('w', 1, 1, 'ar_givre', 'snow', 'Pointes de givre', 'Tes flèches de base ralentissent les ennemis touchés.', { req: ['ar_feu'] }),
      N('w', 1, 2, 'ar_tete', 'ghost', 'Tir fantôme', ['Ton tir chargé est suivi de 2 flèches fantômes perforantes.', '4 flèches fantômes.'], { req: ['ar_crit'] }),
      N('w', 2, 0, 'ar_ricoche', 'bounce', 'Ricochet', ['Une flèche sur 3 qui touche ricoche vers un 2e ennemi.', 'Une sur 2.'], { req: ['ar_trait3'] }),
      N('w', 2, 1, 'ar_mine', 'trap', 'Flèche piège', 'Quand tu esquives, une flèche piégée reste derrière toi et explose 1 s plus tard (4 m).', { req: ['ar_givre'] }),
      N('w', 2, 2, 'ar_vent', 'boot', 'Pas léger', '+1 charge d\'esquive.', { req: ['ar_tete'] }),
      N('w', 3, 0, 'ar_grele', 'rain', 'Grêle', ['Tous les 8 tirs, 5 flèches tombent du ciel sur ta cible.', '8 flèches.'], { req: ['ar_ricoche'] }),
      N('w', 3, 1, 'ar_marque', 'target', 'Marque du chasseur', 'La 4e flèche sur un même ennemi l\'étourdit 0,8 s.', { req: ['ar_mine'] }),
      N('w', 3, 2, 'ar_saut', 'feather', 'Salto', '+1 saut ; chaque saut en l\'air décoche 3 flèches sur les ennemis proches.', { req: ['ar_vent'] }),
      N('w', 4, 1, 'ar_rafale', 'arrows3', 'Rafale', ['Après une esquive parfaite, tes 5 prochains tirs décochent 2 flèches de plus.', 'Tes 8 prochains tirs.'], { req: ['ar_grele', 'ar_marque', 'ar_saut'] }),
      KEY('w', 5, 0, 'ar_k_baliste', 'lance', 'Baliste', 'Ton tir chargé devient une flèche géante qui transperce tout sur 40 m et explose au bout.', ['ar_rafale']),
      KEY('w', 5, 2, 'ar_k_carquois', 'orbit', 'Carquois sans fond', 'Toutes les 25 touches, des flèches spectrales t\'entourent 8 s et partent seules sur les ennemis.', ['ar_rafale']),
      // POUVOIRS
      G.rech('ar', 'Rechargement'),
      N('p', 0, 1, 'ar_p_dash', 'boot', 'Repli', 'Chaque pouvoir lancé te rend 1 charge d\'esquive.'),
      N('p', 0, 2, 'ar_p_crit', 'spark', 'Visée', 'Après un pouvoir, ton prochain tir est un critique garanti qui repousse.'),
      N('p', 1, 0, 'ar_traits', 'arrows', 'Traqueuses : +2 flèches', ['Tes Flèches traqueuses tirent 2 flèches de plus.', '4 flèches de plus.'], { req: ['ar_p_rech'], sk: 'traits' }),
      N('p', 1, 1, 'ar_fente', 'dash', 'Roulade : +2 flèches', 'Ta Roulade du chasseur décoche 2 flèches de plus.', { req: ['ar_p_dash'], sk: 'fente' }),
      N('p', 1, 2, 'ar_valse', 'spin', 'Valse : +6 flèches', ['Ta Valse des flèches tire 6 flèches de plus.', '12 flèches de plus.'], { req: ['ar_p_crit'], sk: 'tourbillon' }),
      G.kill('ar', 'Chasseur', ['ar_traits']),
      N('p', 2, 1, 'ar_pluie', 'rain', 'Pluie : +10 flèches', ['Ta Pluie de flèches fait tomber 10 flèches de plus.', '20 flèches de plus.'], { req: ['ar_fente'], sk: 'pluie' }),
      G.echo('ar', 'Réflexe', ['ar_valse']),
      N('p', 3, 0, 'ar_p_combo', 'rain', 'Volée', 'Lancer 3 pouvoirs différents en 8 s fait tomber 12 flèches autour de toi.', { req: ['ar_p_kill'] }),
      N('p', 3, 1, 'ar_pluie2', 'lance', 'Pluie : flèche géante', 'Une flèche géante clôt toujours la Pluie de flèches (comme au niveau 3).', { req: ['ar_pluie'], sk: 'pluie' }),
      N('p', 3, 2, 'ar_p_trap', 'trap', 'Pièges', 'Chaque pouvoir lancé laisse une flèche piégée à tes pieds (elle explose 1 s plus tard).', { req: ['ar_p_echo'] }),
      N('p', 4, 1, 'ar_p_ener', 'drop', 'Carquois léger', ['Chaque pouvoir lancé te rend 8 énergie.', '15 énergie.'], { req: ['ar_p_combo', 'ar_pluie2', 'ar_p_trap'] }),
      G.dbl('ar', 'Double tir', ['ar_p_ener']),
      KEY('p', 5, 2, 'ar_k_spectre', 'ghost', 'Sentinelle', 'Tous les 4 pouvoirs lancés, une sentinelle spectrale te rejoint 8 s et tire avec toi.', ['ar_p_ener']),
      // ULTIME
      G.upret('ar', 'Patience'), G.ukill('ar', 'Trophées'), G.uinv('ar', 'Disparition'),
      N('u', 1, 0, 'ar_u_hops', 'dash', 'Mille flèches : +2 bonds', ['2 bonds de plus pendant Mille flèches.', '4 bonds de plus.'], { req: ['ar_u_pret'], sk: 'u_lames' }),
      G.uzone('ar', 'Champ de ronces', ['ar_u_kill']),
      G.ureset('ar', 'Renouveau', ['ar_u_inv']),
      N('u', 2, 0, 'ar_u_final', 'burst', 'Mille flèches : bouquet', 'Toutes les flèches plantées dans la cible explosent à la fin (comme au niveau 5).', { req: ['ar_u_hops'], sk: 'u_lames' }),
      N('u', 2, 1, 'ar_u_pluie', 'rain', 'Déluge', 'Ton ultime est suivi d\'une Pluie de flèches sur la zone visée.', { req: ['ar_u_zone'] }),
      N('u', 2, 2, 'ar_u_heal', 'heart', 'Second souffle', ['Ton ultime te soigne de 150 PV.', 'Il soigne 300 PV.'], { req: ['ar_u_reset'] }),
      N('u', 3, 0, 'ar_u_post', 'arrows3', 'Frénésie', ['Pendant 6 s après ton ultime, chaque tir décoche 2 flèches de plus.', 'Pendant 10 s.'], { req: ['ar_u_final'] }),
      N('u', 3, 2, 'ar_u_parf', 'eye', 'Instinct', 'Chaque esquive parfaite charge ton ultime de 10 %.', { req: ['ar_u_pluie', 'ar_u_heal'] }),
      G.ucast('ar', 'Concentration', ['ar_u_post', 'ar_u_parf']),
      G.uecho('ar', 'Écho du chasseur', ['ar_u_cast']),
      KEY('u', 5, 2, 'ar_k_legion', 'skull', 'Garnison d\'os', 'Ton ultime fait aussi surgir des squelettes arbalétriers qui tirent 12 s.', ['ar_u_cast']),
    ],
  };
  // index et rangs max
  const IDX = {};
  for (const cls of CLS) { IDX[cls] = {}; for (const n of Q.TREES[cls]) { n.max = n.key ? 1 : n.d.length; IDX[cls][n.id] = n; } }
  Q.treeNode = (cls, id) => (IDX[cls] && IDX[cls][id]) || null;
  Q.TREE_BRANCHES = { w: 'Arme', p: 'Pouvoirs', u: 'Ultime' };

  /* =====================================================================
     4. RÈGLES (points, prérequis, apprentissage)
     ===================================================================== */
  const spentOf = (cls, nodes) => { let s = 0; for (const id in nodes || {}) { const n = IDX[cls] && IDX[cls][id]; if (n) s += Math.min(n.max, nodes[id] | 0) * n.cost; } return s; };
  const clsData = cls => { const D = Q.data(); return D.cls && D.cls[cls] ? D.cls[cls] : { xp: 0, nodes: {} }; };
  Q.treeHas = (nodes, id) => (nodes && nodes[id] | 0) || 0;
  Q.treePoints = function (cls) {
    const c = clsData(cls), L = Q.clsLevel(c.xp), total = ptsAt(L.lv), spent = spentOf(cls, c.nodes);
    return { lv: L.lv, total, spent, free: total - spent };
  };
  Q.treeSpent = (cls, br) => { const c = clsData(cls); let s = 0; for (const id in c.nodes) { const n = IDX[cls][id]; if (n && (!br || n.br === br)) s += Math.min(n.max, c.nodes[id] | 0) * n.cost; } return s; };
  // peut-on apprendre le rang suivant ? → { ok, why }
  Q.treeCan = function (cls, id) {
    const n = Q.treeNode(cls, id); if (!n) return { ok: false, why: 'Nœud inconnu' };
    const c = clsData(cls), rk = c.nodes[id] | 0, P = Q.treePoints(cls);
    if (rk >= n.max) return { ok: false, why: 'Rang maximum atteint' };
    if (P.lv < ROWLV[n.r]) return { ok: false, why: 'Niveau de classe ' + ROWLV[n.r] + ' requis' };
    if (n.req && !n.req.some(r => (c.nodes[r] | 0) > 0)) return { ok: false, why: 'Apprends d\'abord : ' + n.req.map(r => IDX[cls][r].n).join(' ou ') };
    if (P.free < n.cost) return { ok: false, why: n.cost > 1 ? 'Il faut ' + n.cost + ' points' : 'Plus de point disponible : monte de niveau' };
    return { ok: true, why: '' };
  };
  Q.treeLearn = function (cls, id) {
    if (!Q.treeCan(cls, id).ok) return false;
    const D = Q.data(), c = D.cls[cls]; c.nodes[id] = (c.nodes[id] | 0) + 1; Q.saveData(); return true;
  };
  Q.treeReset = function (cls) { const D = Q.data(); if (!D.cls[cls]) return; D.cls[cls].nodes = {}; Q.saveData(); };
  // nœuds valides (ids connus, rangs bornés, prérequis et niveau respectés, budget de points) ; lv : niveau de classe (null = pas de contrôle)
  Q.treeClean = function (cls, nodes, lv) {
    const out = {}; if (!IDX[cls] || !nodes) return out;
    const list = Q.TREES[cls].filter(n => (nodes[n.id] | 0) > 0).sort((a, b) => a.r - b.r);
    let budget = lv == null ? 1e9 : ptsAt(lv);
    for (const n of list) {
      if (lv != null && lv < ROWLV[n.r]) continue;
      if (n.req && !n.req.some(r => (out[r] | 0) > 0)) continue;
      let rk = Math.min(n.max, nodes[n.id] | 0);
      while (rk > 0 && rk * n.cost > budget) rk--;
      if (rk > 0) { out[n.id] = rk; budget -= rk * n.cost; }
    }
    return out;
  };
  // rang d'un nœud pour un combattant (joueur local ou distant) : utilisé par les fichiers de classe
  const NT = {};                                     // arbres reçus des autres joueurs (par id)
  Q.treeOf = function (f) {
    if (!f) return null;
    if (f.kind === 'local') { const M = Q.me && Q.me(); return M && Q.running ? M.tree || null : null; }
    const t = (f.kit && f.kit.tree) || NT[f.id];
    if (t) return t;
    return f.owner && f.owner !== f ? Q.treeOf(f.owner) : null;
  };
  Q.treeRank = (f, id) => { const t = Q.treeOf(f); return t ? (t[id] | 0) : 0; };
  // gain d'xp de classe pour l'écran de fin : Q.clsGain(cls, cxp) → { n, lv0, lv1, cur, need, pts }
  Q.clsGain = function (cls, cxp) {
    const c = clsData(cls), after = Q.clsLevel(c.xp), before = Q.clsLevel(Math.max(0, c.xp - (cxp | 0)));
    return { n: (Q.CLASSES[cls] || {}).n || cls, col: (Q.CLASSES[cls] || {}).col || '#ffd76a', lv0: before.lv, lv1: after.lv, cur: after.cur, need: after.need, max: after.max, pts: ptsAt(after.lv) - ptsAt(before.lv), free: Q.treePoints(cls).free };
  };
  // petit encart prêt à insérer dans l'écran de fin de course (R.rewards.cls, R.rewards.cxp)
  Q.treeEndHtml = function (cls, cxp) {
    if (!cls || !Q.CLASSES[cls]) return '';
    const g = Q.clsGain(cls, cxp), pct = g.max ? 100 : Math.round(g.cur / Math.max(1, g.need) * 100);
    return `<div class="tr-end" style="--cc:${g.col}"><div class="tr-end-h"><b>${esc(g.n)}</b><span>+${cxp | 0} XP de classe</span></div>
      <div class="tr-end-l"><em>Niv. ${g.lv1}</em><div class="tr-bar"><i style="width:${pct}%"></i></div></div>
      ${g.lv1 > g.lv0 ? `<div class="tr-end-up">NIVEAU ${g.lv1} ! +${g.pts} point${g.pts > 1 ? 's' : ''} d'arbre</div>` : ''}
      ${g.free > 0 ? `<div class="tr-end-f">${g.free} point${g.free > 1 ? 's' : ''} à dépenser chez le Maître des arts du village</div>` : ''}</div>`;
  };
  // à chaque choix de classe : l'arbre de la course est nettoyé (nœuds invalides retirés)
  Q.on('classSet', M => {
    if (!M || !M.cls) return;
    const c = clsData(M.cls); M.tree = Q.treeClean(M.cls, M.tree || c.nodes, Q.clsLevel(c.xp).lv);
  });

  /* =====================================================================
     5. EFFETS EN COURSE (joueur local)
     ===================================================================== */
  const r2 = v => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
  const flr = S => (S.asc && S.asc.floor) || 1;
  const DK = S => 1 + 0.05 * (flr(S) - 1);                              // les dégâts des nœuds suivent la difficulté de l'étage
  const opt = (kind, o) => Object.assign({ kind, skill: 'tree' }, o || {});
  const later = (t, fn) => T().later(t, fn, 'A');
  const alive = S => S && !S.ended && S.me && S.me.alive;
  function send(o) { try { T().send(Object.assign({ k: 'qa', t: 'tree' }, o)); } catch (e) { /* hors ligne */ } }
  // visuels envoyés aux autres : au plus ~14 messages par seconde (au-delà, l'effet n'est visible que chez toi)
  let netW = 0, netN = 0;
  function sendFx(S, o) { const t = S ? S.t : 0; if (t - netW > 1 || t < netW) { netW = t; netN = 0; } if (++netN > 14) return; send(o); }
  function hitZ(S, c, r, dmg, kind, o) { return T().hitSphere(S.me, c, r, Math.round(dmg * DK(S)), opt(kind, o)); }
  function hitL(S, a, b, w, dmg, kind, o) { return T().hitLine(S.me, a, b, w, Math.round(dmg * DK(S)), opt(kind, o)); }
  function hitT(S, t, dmg, kind, o) { T().applyHit(S.me, t, Math.round(dmg * DK(S)), opt(kind, o), t.pos); }
  const enemies = S => T().enemiesOf(S.me);
  // les n ennemis (groupes distincts) les plus proches de from, hors des clés exclues
  function nearE(S, from, max, n, excl) {
    const seen = new Set(excl || []), out = [];
    enemies(S).map(e => [e, e.pos.distanceTo(from) - (e.r || 0)]).filter(x => x[1] < max).sort((a, b) => a[1] - b[1])
      .forEach(([e]) => { const k = keyOf(e); if (seen.has(k) || out.length >= n) return; seen.add(k); out.push(e); });
    return out;
  }
  const aimOf = f => (f.ctl && f.ctl.aim ? f.ctl.aim.clone() : f.pos.clone().add(f.fwd().multiplyScalar(8)));
  const aimYaw = f => (f.action && f.action.face != null ? f.action.face : f.yaw);
  const fwdOf = f => { const y = aimYaw(f); return new V3(Math.sin(y), 0, Math.cos(y)); };
  const clampA = p => { const R = (BR.ArenaScene && BR.ArenaScene.R ? BR.ArenaScene.R : 40) - 1.5, r = Math.hypot(p.x, p.z); if (r > R) { p.x *= R / r; p.z *= R / r; } return p; };
  const COL = { chevalier: 0x7ec8ff, mage: 0xc070ff, archer: 0x9aff7a };
  const colOf = S => COL[(L0 && L0.cls) || 'chevalier'];

  // ---------- petits effets de jeu ----------
  function addShield(S, f, amt, cap) {
    const s = f.shield || 0; if (s >= cap) return;
    f.shield = Math.min(cap, s + amt);
    S.fx.ring(f.center(), { r0: 0.5, r1: 1.9, color: 0xcfe0ff, life: 0.3, width: 0.25 });
    S.fx.num(f.center(), '+' + Math.round(f.shield - s), { color: '#cfe0ff' });
  }
  function heal(S, f, amt) {
    if (Q.heal && S.ascL) Q.heal(S, amt); else f.hp = Math.min(f.maxHp, f.hp + amt);
    S.fx.num(f.center(), '+' + Math.round(amt), { color: '#7dff9a' });
  }
  const addUlt = (f, v) => { f.ult = Math.min(100, (f.ult || 0) + v); };
  const addDash = (S, f) => { const mx = f.dashMax == null ? 2 : f.dashMax; if (f.dashN < mx) { f.dashN++; S.fx.ring(f.pos.clone().setY(0.1), { r0: 0.4, r1: 1.6, color: 0x9ad8ff, life: 0.25, width: 0.3 }); } };
  const cutCds = (f, s) => { for (const k in f.cds) f.cds[k] = Math.max(0, f.cds[k] - s); };
  const addEn = (f, v) => { f.energy = Math.min(100, (f.energy || 0) + v); };
  function recast(S, f, id, aim, delay) {
    later(delay || 0.45, () => {
      if (!alive(S)) return;
      const lv = (f.lv && f.lv[id]) || 1;
      S.fx.ring(f.center(), { r0: 0.4, r1: 2.6, color: 0xffd76a, life: 0.3, width: 0.25 });
      T().recast(f, id, lv, aim || aimOf(f));
    });
  }
  // projectile en plus (flèche ou trait de magie) : dégâts ici, visuel chez les autres
  function shot(S, kind, from, dir, o) {
    const f = S.me; o = o || {};
    const ctx = BR.Arena.api(f, true, 1, aimOf(f), null);
    const col = o.col == null ? colOf(S) : o.col, life = o.life || 1.2, sp = o.sp || (kind === 'arrow' ? 62 : 40);
    const base = { dmg: Math.round((o.dmg || 0) * DK(S)), kind: o.k || 'basic', skill: 'tree', color: col, homing: o.hom || 0, pierce: !!o.pierce, life,
      freeze: o.freeze, stun: o.stun, posture: o.posture || 1, onHit: o.onHit, onEnd: o.onEnd, target: o.target };
    if (kind === 'arrow' && Q.FXH && Q.FXH.shoot) Q.FXH.shoot(ctx, dir, Object.assign(base, { from: from.clone(), speed: sp, scale: o.sc || 1, r: o.r || 0.45 }));
    else ctx.proj(Object.assign(base, { pos: from.clone(), vel: dir.clone().normalize().multiplyScalar(sp), r: o.r || 0.4, size: o.size || 0.7, explode: o.explode || 0 }));
    if (o.net !== false) sendFx(S, { e: 'p', s: kind === 'arrow' ? 1 : 0, a: [from.x, from.y, from.z, dir.x, dir.y, dir.z, sp, col, o.sc || o.size || (kind === 'arrow' ? 1 : 0.7), life].map(r2) });
  }
  function remoteShot(S, f, d) {
    const a = d.a; if (!f || !Array.isArray(a) || a.length < 10) return;
    const ctx = BR.Arena.api(f, false, 1, f.pos.clone(), null), from = new V3(a[0], a[1], a[2]), dir = new V3(a[3], a[4], a[5]).normalize();
    if (d.s === 1 && Q.FXH && Q.FXH.shoot) Q.FXH.shoot(ctx, dir, { from, dmg: 0, speed: a[6], color: a[7], scale: a[8], life: a[9] });
    else ctx.proj({ pos: from, vel: dir.multiplyScalar(a[6]), dmg: 0, color: a[7], size: a[8], life: a[9], r: 0.4 });
  }

  // ---------- visuels (joués ici puis chez les autres, sans dégâts) ----------
  const glowMat = (c, k, op) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k || 2), transparent: true, opacity: op == null ? 0.9 : op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const VIS = {
    // lame d'énergie qui file : [x,y,z, dx,dz, longueur, couleur]
    blade(S, f, a) {
      const d = new V3(a[3], 0, a[4]).normalize(), yaw = Math.atan2(d.x, d.z), col = a[6];
      const m = new THREE.Mesh(S.fx.geo.sph, glowMat(col, 2.2)); m.scale.set(2.3, 0.12, 0.45); m.rotation.y = yaw + Math.PI / 2; m.position.set(a[0], a[1], a[2]);
      S.fx.add(m, a[5] / 42, (k, o, dt) => { o.position.addScaledVector(d, dt * 42); o.material.opacity = 0.9 * (1 - k * k); if (Math.random() < 0.6) S.fx.spark(o.position.clone(), new V3(0, 0.5, 0), { color: col, life: 0.25, size: 0.35, size1: 0.02 }); }, true);
      S.fx.slash(new V3(a[0], a[1], a[2]), yaw, { r: 2.2, arc: 1.4, color: col, life: 0.2, inner: 0.75 });
    },
    // explosion / onde : [x,y,z, rayon, couleur]
    boom(S, f, a) {
      const p = new V3(a[0], a[1], a[2]), r = a[3], c = a[4];
      S.fx.flash(p, { color: c, r: r * 0.5, life: 0.22, intensity: 5 });
      S.fx.ring(new V3(p.x, 0.06, p.z), { r0: 0.4, r1: r * 1.1, color: c, life: 0.35, width: 0.3 });
      S.fx.burst(p, { n: Math.round(14 + r * 4), color: c, speed: 6 + r, up: 1, life: 0.45 });
    },
    // nova au sol : [x,z, rayon, couleur]
    nova(S, f, a) {
      const p = new V3(a[0], 0.08, a[1]), r = a[2], c = a[3];
      S.fx.ring(p, { r0: 0.5, r1: r, color: c, life: 0.45, width: 0.35 }); S.fx.ring(p, { r0: 0.3, r1: r * 0.7, color: 0xffffff, life: 0.3, width: 0.45 });
      S.fx.burst(p.clone().setY(0.4), { n: 40, color: c, speed: r * 2.2, life: 0.5, flat: true });
      S.fx.flash(p.clone().setY(1), { color: c, r: 2, life: 0.25, intensity: 5 });
    },
    // foudre du ciel : [x,y,z, couleur]
    bolt(S, f, a) { const p = new V3(a[0], a[1], a[2]); S.fx.bolt(new V3(p.x + (Math.random() - 0.5) * 2, p.y + 14, p.z), p, { color: a[3], life: 0.25, jitter: 1.1 }); S.fx.flash(p, { color: a[3], r: 1.4, life: 0.2, intensity: 5 }); },
    // éclair entre deux points : [ax,ay,az, bx,by,bz, couleur]
    zap(S, f, a) { S.fx.bolt(new V3(a[0], a[1], a[2]), new V3(a[3], a[4], a[5]), { color: a[6], life: 0.2, light: false }); },
    // entaille : [x,y,z, yaw, rayon, arc, couleur]
    slash(S, f, a) { const p = new V3(a[0], a[1], a[2]); S.fx.slash(p, a[3], { r: a[4], arc: a[5], color: a[6], life: 0.3, inner: 0.6 }); S.fx.slash(p, a[3] + 0.3, { r: a[4] * 0.92, arc: a[5], color: 0xffffff, life: 0.2, inner: 0.85 }); },
    // objet qui tombe du ciel : [x,z, type (0 épée, 1 flèche, 2 étoile), couleur, durée]
    fall(S, f, a) {
      const p = new V3(a[0], 0.15, a[1]), kind = a[2], col = a[3], t = a[4];
      let m;
      if (kind === 1 && Q.FXH && Q.FXH.arrowMesh) m = Q.FXH.arrowMesh(col, 1.7);
      else if (kind === 0 && Q.FXH && Q.FXH.SKsword) m = Q.FXH.SKsword(col, 2.4);
      else { m = new THREE.Mesh(S.fx.geo.sph, glowMat(col, 2.4, 1)); m.scale.setScalar(0.5); }
      const from = p.clone().add(new V3((Math.random() - 0.5) * 4, 18, (Math.random() - 0.5) * 4));
      m.position.copy(from); m.lookAt(p);
      S.fx.decal(p, 'circle', { r: 1.8, color: col, dur: t, hold: 0.05, noWarn: true });
      S.fx.add(m, t, (k, o) => { o.position.lerpVectors(from, p, k * k); }, true, () => { VIS.boom(S, f, [p.x, 0.5, p.z, 2, col]); });
    },
    // étoile de lames qui jaillissent du sol : [x,z, yaw, couleur]
    star6(S, f, a) {
      const p = new V3(a[0], 0, a[1]), c = a[3];
      for (let i = 0; i < 6; i++) {
        const y = a[2] + i / 6 * Math.PI * 2, d = new V3(Math.sin(y), 0, Math.cos(y));
        for (let s = 1.5; s <= 7.5; s += 1.5) { const q = p.clone().addScaledVector(d, s); S.fx.pillar(q, { color: c, r: 0.35, h: 3.2, life: 0.35 + s * 0.02, grow: 0.5 }); }
      }
      S.fx.ring(p.clone().setY(0.06), { r0: 0.5, r1: 8, color: c, life: 0.4, width: 0.2 });
    },
    // flèche piégée plantée : [x,z, couleur, délai]
    trap(S, f, a) {
      const p = new V3(a[0], 0, a[1]), c = a[2], t = a[3];
      S.fx.decal(p, 'circle', { r: 4, color: c, dur: t, hold: 0.05, noWarn: true });
      let m = null;
      if (Q.FXH && Q.FXH.arrowMesh) { m = Q.FXH.arrowMesh(c, 1.3); m.position.set(p.x, 0.5, p.z); m.lookAt(p.x + 0.1, -2, p.z + 0.05); S.fx.add(m, t, (k, o) => { o.scale.setScalar(1.3 * (1 + 0.15 * Math.sin(k * 40))); }, true, () => VIS.boom(S, f, [p.x, 0.6, p.z, 4, c])); }
      else later(t, () => VIS.boom(S, f, [p.x, 0.6, p.z, 4, c]));
    },
    // zone au sol qui ralentit : [x,z, rayon, couleur, durée]
    zone(S, f, a) {
      const p = new V3(a[0], 0, a[1]), r = a[2], c = a[3], dur = a[4];
      S.fx.decal(p, 'circle', { r, color: c, dur: 0.25, hold: dur, noWarn: true });
      const g = new THREE.Group(); g.position.copy(p);
      S.fx.add(g, dur, (k, o, dt) => { if (Math.random() < dt * 30) { const an = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * r; S.fx.spark(p.clone().add(new V3(Math.cos(an) * rr, 0.15, Math.sin(an) * rr)), new V3(0, 1.5 + Math.random() * 2, 0), { color: c, life: 0.6, size: 0.45, size1: 0.05 }); } }, true);
    },
    // aura (joueur) : [x,y,z, couleur]
    aura(S, f, a) { const p = new V3(a[0], a[1], a[2]); S.fx.ring(p.clone().setY(0.08), { r0: 0.4, r1: 3, color: a[3], life: 0.4, width: 0.3 }); S.fx.burst(p, { n: 26, color: a[3], speed: 6, life: 0.5 }); },
  };
  function show(S, name, a) {
    try { VIS[name](S, S.me, a); } catch (e) { console.error('arbre (visuel)', name, e); }
    sendFx(S, { e: 'v', n: name, a: a.map(r2) });
  }

  // ---------- briques d'effets réutilisées ----------
  // lame d'énergie droit devant (chevalier)
  function energyBlade(S, f, kind) {
    const d = fwdOf(f), twin = rk('ch_vague') > 0, yaws = twin ? [-0.22, 0.22] : [0];
    for (const dy of yaws) {
      const dd = d.clone().applyAxisAngle(new V3(0, 1, 0), dy), a0 = f.pos.clone().setY(1), a1 = a0.clone().addScaledVector(dd, 10);
      hitL(S, a0, a1, 1.5, 55, kind || 'basic', { kb: 3, color: '#7ec8ff' });
      show(S, 'blade', [a0.x, a0.y, a0.z, dd.x, dd.z, 10, 0x9ad8ff]);
    }
    Au.fx('swing', { g: 0.6, rate: 0.75 });
  }
  // épées / flèches / étoiles qui tombent sur un point
  function skyFall(S, p, kind, col, delay, dmg, r, hitKind, o) {
    later(delay, () => {
      if (!S || S.ended) return;
      show(S, 'fall', [p.x, p.z, kind, col, 0.3]);
      later(0.3, () => { if (S.ended) return; hitZ(S, p.clone().setY(0.8), r, dmg, hitKind, o); });
    });
  }
  function trapAt(S, p, kind) {
    const c = colOf(S); show(S, 'trap', [p.x, p.z, c, 1]);
    later(1, () => { if (S.ended) return; hitZ(S, p.clone().setY(0.8), 4, 120, kind || 'basic', { kb: 6, launch: 4, color: '#9aff7a' }); Au.fx('boom', { g: 0.35, rate: 1.6, len: 0.5 }); });
  }
  function slowZone(S, f) {
    const p = clampA(aimOf(f).setY(0)), c = colOf(S); if (p.distanceTo(f.pos) > 24) p.copy(f.pos).setY(0);
    show(S, 'zone', [p.x, p.z, 6, c, 5]);
    for (let i = 0; i < 10; i++) later(0.3 + i * 0.5, () => { if (S.ended) return; hitZ(S, p.clone().setY(0.8), 6, 35, 'skill', { freeze: 0.6, kb: -0.01 }); });
  }
  function nova(S, f, r, dmg, col, o, kind) {
    const c = f.pos.clone(); show(S, 'nova', [c.x, c.z, r, col]);
    hitZ(S, c.clone().setY(1), r, dmg, kind || 'skill', o); T().shake(0.3); Au.fx('boom', { g: 0.5, rate: 1.4, len: 0.6 });
  }
  function chain(S, from, t0, n, dmg, col, kind) {
    const list = nearE(S, t0 ? t0.pos : from, 11, n, t0 ? [keyOf(t0)] : []);
    let a = from.clone();
    list.forEach((e, i) => later(0.06 * (i + 1), () => { if (S.ended) return; const b = e.pos.clone(); show(S, 'zap', [a.x, a.y, a.z, b.x, b.y, b.z, col]); hitT(S, e, dmg, kind || 'basic', { stun: 0.2, color: '#9ad8ff' }); a = b; }));
    if (list.length) Au.fx('zap', { g: 0.5, rate: 1.3 });
  }
  function bolts(S, f, n, dmg) {
    const list = nearE(S, f.pos, 14, n);
    for (let i = 0; i < n; i++) {
      const e = list[i], p = e ? e.pos.clone() : f.pos.clone().add(new V3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)).setY(0.5);
      later(0.08 + i * 0.07, () => { if (S.ended) return; show(S, 'bolt', [p.x, Math.max(0.5, p.y), p.z, 0xbfe6ff]); if (e) hitT(S, e, dmg, 'basic', { stun: 0.3, color: '#bfe6ff' }); else hitZ(S, p, 2, dmg, 'basic', { stun: 0.3 }); Au.fx('zap', { g: 0.5, rate: 0.9 + i * 0.1 }); });
    }
  }
  // éclats chercheurs qui partent d'un point vers d'autres ennemis
  function shards(S, at, t0, n, dmg, col) {
    const list = nearE(S, at, 14, n, t0 ? [keyOf(t0)] : []);
    for (let i = 0; i < n; i++) {
      const e = list[i % Math.max(1, list.length)], ang = i / n * 6.283;
      const dir = e ? e.pos.clone().sub(at).normalize() : new V3(Math.cos(ang), 0.2, Math.sin(ang)).normalize();
      shot(S, 'bolt', at.clone().addScaledVector(dir, 0.9), dir, { dmg, sp: 26, hom: 8, life: 0.9, size: 0.4, col, target: e, net: false });
    }
  }

  /* ---------- état par étage ---------- */
  let LS = null, L0 = null;
  function rk(id) { return L0 && L0.nodes ? (L0.nodes[id] | 0) : 0; }
  function state(S) {
    if (!S || !S.asc || !S.me) return null;
    if (LS === S) return L0;
    if (L0 && L0.fam) { try { if (L0.fam.parent) L0.fam.parent.remove(L0.fam); L0.fam.traverse(o => { if (o.material) o.material.dispose(); }); } catch (e) { /* scène déjà détruite */ } }
    const M = Q.me && Q.me(); LS = S;
    const cls = M && M.cls, nodes = cls && M.tree ? M.tree : {};
    const list = []; for (const id in nodes) if ((nodes[id] | 0) > 0 && EFX[id]) list.push([EFX[id], nodes[id] | 0, id]);
    L0 = { S, cls, nodes, list, c: {}, lastHit: new Map(), marks: new Map(), casts: [], started: false, kitT: [0.4, 2, 5, 10], t: 0 };
    return L0;
  }
  const count = (L, k, n) => { L.c[k] = (L.c[k] || 0) + 1; if (L.c[k] >= n) { L.c[k] = 0; return true; } return false; };
  function dispatch(S, ev, args) {
    const L = state(S); if (!L || !L.list.length && ev !== 'tick') return null;
    for (const [e, r] of L.list) if (e[ev]) e[ev].apply(null, [r, L].concat(args));
    return L;
  }

  /* ---------- effets génériques ---------- */
  const GEN = {
    rech: { cast(r, L, S, f, id, slot) { if (slot !== 'ult' && f.cds[slot] > 0) f.cds[slot] = Math.max(0.3, f.cds[slot] - 0.5 * r); } },
    shieldCast: (amt, cap) => ({ cast(r, L, S, f, id, slot) { if (slot !== 'ult') addShield(S, f, amt * r, cap * r); } }),
    critCast: { cast(r, L, S, f, id, slot) { if (slot !== 'ult') { L.critArm = S.t + 6; show(S, 'aura', [f.pos.x, 1, f.pos.z, 0xffd23a]); } } },
    killCd: { killMine(r, L, S, f) { cutCds(f, 0.25 * r); } },
    echoFirst: { cast(r, L, S, f, id, slot) { if (slot === 'ult' || L.echoed) return; L.echoed = true; recast(S, f, id, aimOf(f), 0.5); T().banner('PREMIER ÉLAN', 'Pouvoir relancé', 0.9, 'gold'); } },
    combo3: fn => ({ cast(r, L, S, f, id, slot) {
      if (slot === 'ult') return;
      L.casts = L.casts.filter(c => S.t - c.t < 8 && c.id !== id); L.casts.push({ id, t: S.t });
      if (L.casts.length >= 3) { L.casts = []; later(0.35, () => { if (alive(S)) fn(S, f); }); }
    } }),
    dashCast: { cast(r, L, S, f, id, slot) { if (slot !== 'ult') addDash(S, f); } },
    enCast: (a, b) => ({ cast(r, L, S, f, id, slot) { if (slot !== 'ult') addEn(f, r > 1 ? b : a); } }),
    double: { cast(r, L, S, f, id, slot) { if (slot !== 'ult' && count(L, 'dbl', 3)) recast(S, f, id, aimOf(f), 0.45); } },
    summon4: sid => ({ cast(r, L, S, f, id, slot) { if (slot !== 'ult' && count(L, 'sum', 4)) { recast(S, f, sid, aimOf(f), 0.3); } } }),
    upret: { start(r, L, S, f) { f.ult = Math.max(f.ult || 0, 20 * r); } },
    ukill: { killMine(r, L, S, f) { addUlt(f, r); } },
    uinv: { cast(r, L, S, f, id, slot) { if (slot === 'ult') f.inv = Math.max(f.inv || 0, 1.5 * r); } },
    ureset: { cast(r, L, S, f, id, slot) { if (slot === 'ult') { later(0.1, () => { for (const k in f.cds) f.cds[k] = 0; }); } } },
    uzone: { cast(r, L, S, f, id, slot) { if (slot === 'ult') slowZone(S, f); } },
    uheal: { cast(r, L, S, f, id, slot) { if (slot === 'ult') heal(S, f, 150 * r); } },
    ucast: { cast(r, L, S, f, id, slot) { if (slot !== 'ult') addUlt(f, 3 * r); } },
    uecho: { cast(r, L, S, f, id, slot) { if (slot !== 'ult' || L.uechoed) return; L.uechoed = true; recast(S, f, id, aimOf(f), 2); later(1.9, () => T().banner('ÉCHO', 'L\'ultime frappe encore', 0.9, 'gold')); } },
    upost: { cast(r, L, S, f, id, slot) { if (slot === 'ult') L.postU = S.t + (r > 1 ? 10 : 6); } },
    uparf: per => ({ perfect(r, L, S, f) { addUlt(f, per(r)); } }),
    urecast: (sid, delay) => ({ cast(r, L, S, f, id, slot) { if (slot === 'ult') recast(S, f, sid, aimOf(f), delay); } }),
    ustun: (col, o) => ({ cast(r, L, S, f, id, slot) { if (slot === 'ult') later(0.25, () => { if (alive(S)) nova(S, f, 12, 40, col, Object.assign({ kb: -0.01 }, o), 'ult'); }); } }),
  };

  /* ---------- effets nœud par nœud ---------- */
  const EFX = {};
  const fin = st => !!(st && st.fin), heavy = st => !!(st && st.heavy);
  const basicHit = o => o && o.kind === 'basic' && o.skill !== 'tree';
  // ===== CHEVALIER — arme =====
  EFX.ch_lame = { swing(r, L, S, f, st) { if (!heavy(st) && count(L, 'lame', [4, 3, 2][r - 1])) energyBlade(S, f); } };
  EFX.ch_estoc = { swing(r, L, S, f, st) {
    if (!fin(st)) return;
    later(0.05, () => { if (!alive(S)) return; const c = f.pos.clone().addScaledVector(fwdOf(f), 2).setY(0.6), R = r > 1 ? 6 : 4;
      hitZ(S, c, R, r > 1 ? 110 : 80, 'basic', { kb: 7, stun: r > 1 ? 0.5 : 0, color: '#e8eef8' }); show(S, 'boom', [c.x, c.y, c.z, R, 0xe8eef8]); T().shake(0.2); Au.fx('stomp', { g: 0.5, rate: 1.2 }); });
  } };
  EFX.ch_ecu = { hit(r, L, S, f, t, dmg, crit, o) { if (basicHit(o) && count(L, 'ecu', 6)) addShield(S, f, 60 * r, 240); } };
  EFX.ch_fant = {
    dash(r, L, S) { L.fant = S.t + 3; },
    swing(r, L, S, f, st) {
      if (!(L.fant > S.t)) return; L.fant = 0;
      later(0.15, () => { if (!alive(S)) return; const d = fwdOf(f), c = f.pos.clone().addScaledVector(d, 1.6).setY(1), y = Math.atan2(d.x, d.z);
        show(S, 'slash', [c.x, c.y, c.z, y, 3, 2.2, 0xc8e6ff]); hitZ(S, c, 2.6, (st.dmg || 70) * 0.8, 'basic', { kb: 2 }); Au.fx('swing', { g: 0.7, rate: 1.4 }); });
    } };
  EFX.ch_lourd = { swing(r, L, S, f, st) {
    if (!heavy(st)) return;
    later(0.02, () => {
      if (!alive(S)) return; const c = f.pos.clone().setY(0.8);
      hitZ(S, c, 4.6, 40, 'basic', { stun: 1, launch: 7, kb: 2, color: '#e8eef8' }); show(S, 'nova', [c.x, c.z, 4.6, 0xe8eef8]);
      if (r > 1) { const d = fwdOf(f); for (let i = 0; i < 3; i++) later(0.1 + i * 0.1, () => { if (S.ended) return; const p = f.pos.clone().addScaledVector(d, 2.5 + i * 2).setY(0.5); hitZ(S, p, 2.4, 70, 'basic', { launch: 5 }); show(S, 'boom', [p.x, p.y, p.z, 2.4, 0x7ec8ff]); Au.fx('stomp', { g: 0.4, rate: 1.3 }); }); }
    });
  } };
  EFX.ch_parade = { perfect(r, L, S, f) { L.critArm = S.t + 6; show(S, 'aura', [f.pos.x, 1, f.pos.z, 0xffd23a]); } };
  EFX.ch_danse = { hit(r, L, S, f, t, dmg, crit, o) { if (basicHit(o) && count(L, 'danse', r > 1 ? 6 : 10)) addDash(S, f); } };
  EFX.ch_foudre = { swing(r, L, S, f, st) {
    if (!fin(st)) return;
    later(0.12, () => {
      if (!alive(S)) return; const p0 = f.pos.clone().addScaledVector(fwdOf(f), 2.5), t = nearE(S, p0, 3.5, 1)[0]; if (!t) return;
      const p = t.pos.clone(); show(S, 'bolt', [p.x, p.y, p.z, 0x9ad8ff]); hitT(S, t, 100, 'basic', { stun: 0.3, color: '#9ad8ff' }); Au.fx('zap', { g: 0.7 });
      if (r > 1) chain(S, p, t, 2, 70, 0x9ad8ff);
    });
  } };
  EFX.ch_avide = { killMine(r, L, S, f, a, kind) { if (kind === 'basic') heal(S, f, 20 * r); } };
  EFX.ch_echo = { swing(r, L, S, f, st) {
    if (!fin(st)) return;
    for (let i = 0; i < r; i++) later(0.3 + i * 0.22, () => { if (!alive(S)) return; const d = fwdOf(f), c = f.pos.clone().addScaledVector(d, 1.8).setY(1), y = Math.atan2(d.x, d.z) + (i ? 0.5 : -0.5);
      show(S, 'slash', [c.x, c.y, c.z, y, 3.4, 2.4, 0x9ad8ff]); hitZ(S, c, 2.8, (st.dmg || 120) * 0.7, 'basic', { kb: 4 }); Au.fx('swingBig', { g: 0.5, rate: 1.3 }); });
  } };
  EFX.ch_seisme = { land(r, L, S, f) {
    const p = f.pos.clone().setY(0), y0 = aimYaw(f); show(S, 'star6', [p.x, p.z, y0, 0x9ad8ff]);
    for (let i = 0; i < 6; i++) { const y = y0 + i / 6 * Math.PI * 2, d = new V3(Math.sin(y), 0, Math.cos(y)); hitL(S, p.clone().setY(1), p.clone().addScaledVector(d, 8).setY(1), 1.2, 70, 'basic', { launch: 5 }); }
    Au.fx('ice', { g: 0.5 });
  } };
  EFX.ch_fer = { tick(r, L, S, f, dt) { if (f.guard && (f.shield || 0) < 160) f.shield = Math.min(160, (f.shield || 0) + 40 * dt); } };
  EFX.ch_rempart = { stats(r, st) { st.maxHp += 150 * r; } };
  EFX.ch_vague = {};      // lu par energyBlade
  EFX.ch_colosse = { swing(r, L, S, f, st) {
    if (L.colT > S.t) {
      later(0.04, () => { if (!alive(S)) return; const d = fwdOf(f), c = f.pos.clone().addScaledVector(d, 2.4).setY(1), y = Math.atan2(d.x, d.z);
        show(S, 'slash', [c.x, c.y, c.z, y, 5.2, 2.8, 0xbfe6ff]); hitZ(S, c, 3.6, (st.dmg || 70) * 0.7, 'basic', { kb: 4 }); });
      return;
    }
    if (count(L, 'col', 12)) { L.colT = S.t + 4; show(S, 'aura', [f.pos.x, 1.2, f.pos.z, 0xbfe6ff]); T().banner('ÉPÉE COLOSSALE', '4 s', 0.9, 'gold'); Au.fx('charge', { len: 0.3, g: 0.6 }); }
  } };
  EFX.ch_acier = { swing(r, L, S, f, st) {
    if (!heavy(st)) return;
    const aim = aimOf(f), t = nearE(S, aim, 6, 1)[0] || nearE(S, f.pos, 14, 1)[0], c = t ? t.pos.clone().setY(0) : clampA(f.pos.clone().addScaledVector(fwdOf(f), 6).setY(0));
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283, p = i === 0 ? c.clone() : c.clone().add(new V3(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4)); skyFall(S, p, 0, 0x9ad8ff, 0.2 + i * 0.1, 90, 2.3, 'basic', { stun: 0.3, kb: 3 }); }
  } };
  // ===== CHEVALIER — pouvoirs =====
  EFX.ch_p_rech = GEN.rech;
  EFX.ch_p_bouc = GEN.shieldCast(50, 200);
  EFX.ch_p_crit = GEN.critCast;
  EFX.ch_p_kill = GEN.killCd;
  EFX.ch_p_echo = GEN.echoFirst;
  EFX.ch_p_onde = GEN.combo3((S, f) => { nova(S, f, 7, 150, 0x9ad8ff, { stun: 1, kb: 6 }); T().banner('CHOC DES ARCANES', '', 0.8, 'gold'); });
  EFX.ch_p_ener = { cast(r, L, S, f, id, slot) { if (slot === 'ult') return; addDash(S, f); if (r > 1) addEn(f, 15); } };
  EFX.ch_k_double = GEN.double;
  EFX.ch_k_lames = GEN.summon4('fantomes');
  // ===== CHEVALIER — ultime =====
  EFX.ch_u_pret = GEN.upret; EFX.ch_u_kill = GEN.ukill; EFX.ch_u_inv = GEN.uinv; EFX.ch_u_reset = GEN.ureset; EFX.ch_u_zone = GEN.uzone; EFX.ch_u_heal = GEN.uheal;
  EFX.ch_u_parry = GEN.uparf(r => (r > 1 ? 15 : 8));
  EFX.ch_u_post = Object.assign({ swing(r, L, S, f, st) { if (L.postU > S.t && !heavy(st)) energyBlade(S, f); } }, GEN.upost);
  EFX.ch_u_cri = GEN.ustun(0xffd76a, { stun: 1.5 });
  EFX.ch_u_hurt = { hurt(r, L, S, f, dmg) { L.hurtAcc = (L.hurtAcc || 0) + dmg; while (L.hurtAcc >= 100) { L.hurtAcc -= 100; addUlt(f, 4 * r); } } };
  EFX.ch_k_echo = GEN.uecho;
  EFX.ch_k_avatar = {
    cast(r, L, S, f, id, slot) {
      if (slot !== 'ult') return;
      if (!(L.avatar > S.t)) { L.size0 = f.sizeMul || 1; f.sizeMul = L.size0 * 1.4; send({ e: 'size', k: 1.4, d: 8 }); }
      L.avatar = S.t + 8;
    },
    tick(r, L, S, f) { if (L.size0 && !(L.avatar > S.t)) { f.sizeMul = L.size0; L.size0 = 0; } },
    swing(r, L, S, f, st) {
      if (!(L.avatar > S.t)) return;
      later(0.05, () => { if (!alive(S)) return; const c = f.pos.clone().setY(1); show(S, 'slash', [c.x, c.y, c.z, aimYaw(f), 4.2, 6.2, 0xffd76a]); hitZ(S, c, 4, (st.dmg || 70) * 0.6, 'basic', { kb: 5 }); });
    } };
  // ===== MAGE — arme =====
  const ricochet = (S, from, t0, depth, dmg) => {
    const e = nearE(S, from, 10, 1, [keyOf(t0)])[0]; if (!e) return;
    const dir = e.pos.clone().sub(from).normalize();
    shot(S, 'bolt', from.clone().addScaledVector(dir, (t0.r || 0.8) + 0.4), dir, { dmg, sp: 36, hom: 6, life: 0.8, size: 0.5, col: 0x6fffe0, target: e, net: false,
      onHit: (p, t) => { if (depth > 1 && t) ricochet(S, p.pos.clone(), t, depth - 1, dmg); } });
  };
  EFX.mg_rebond = { hit(r, L, S, f, t, dmg, crit, o, at) { if (basicHit(o)) ricochet(S, (at || t.pos).clone(), t, r, 38); } };
  EFX.mg_trio = { swing(r, L, S, f, st) {
    if (!st.bolt || !count(L, 'trio', r > 1 ? 3 : 4)) return;
    const from = f.tip ? f.tip(0) : f.center(), aim = aimOf(f); if (aim.y < 0.5) aim.y = 1;
    const d = aim.sub(from).normalize();
    for (const s of [-1, 1]) shot(S, 'bolt', from, d.clone().applyAxisAngle(new V3(0, 1, 0), s * 0.24), { dmg: 45, sp: 42, hom: 4, life: 1.3, size: 0.7, col: 0x6fffe0 });
  } };
  EFX.mg_givre = {
    swing(r, L, S, f, st) { if (fin(st)) L.frostW = S.t + 1.2; },
    out(r, L, S, f, t, o) { if (basicHit(o) && L.frostW > S.t) o.freeze = Math.max(o.freeze || 0, 0.7); } };
  EFX.mg_mana = { hit(r, L, S, f, t, dmg, crit, o) { if (basicHit(o) && count(L, 'mana', 5)) { addEn(f, r > 1 ? 15 : 8); S.fx.burst(f.center(), { n: 10, color: 0x6fffe0, speed: 4, life: 0.4 }); } } };
  EFX.mg_orbe = {
    swing(r, L, S, f, st) { if (st.orb) L.orbW = S.t + 1.6; },
    hit(r, L, S, f, t, dmg, crit, o, at) { if (basicHit(o) && L.orbW > S.t) { L.orbW = 0; const p = (at || t.pos).clone(); later(0.02, () => { if (!S.ended) shards(S, p, t, r > 1 ? 7 : 4, 40, 0xb0fff0); }); } } };
  EFX.mg_brul = {
    swing(r, L, S, f, st) { if (!st.orb && count(L, 'brul', 5)) L.boomW = S.t + 1.4; },
    hit(r, L, S, f, t, dmg, crit, o, at) { if (basicHit(o) && L.boomW > S.t) { L.boomW = 0; const p = (at || t.pos).clone(); later(0.02, () => { if (S.ended) return; hitZ(S, p, 3, 70, 'basic', { color: '#ff8a3a', kb: 3 }); show(S, 'boom', [p.x, p.y, p.z, 3, 0xff8a3a]); Au.fx('boom', { g: 0.3, rate: 1.7, len: 0.4 }); }); } } };
  EFX.mg_perce = {
    dash(r, L, S) { L.lance = S.t + 3; },
    swing(r, L, S, f, st) {
      if (!(L.lance > S.t)) return; L.lance = 0;
      const from = f.tip ? f.tip(0) : f.center(), aim = aimOf(f); if (aim.y < 0.5) aim.y = 1;
      shot(S, 'bolt', from, aim.sub(from).normalize(), { dmg: 120, sp: 55, pierce: true, life: 0.9, size: 1.1, col: 0xe0b0ff, posture: 2 });
    } };
  EFX.mg_orbe2 = { swing(r, L, S, f, st) {
    if (!st.orb) return;
    later(0.25, () => { if (!alive(S)) return; const from = f.tip ? f.tip(0) : f.center(), aim = aimOf(f); if (aim.y < 0.5) aim.y = 1;
      shot(S, 'bolt', from, aim.sub(from).normalize(), { dmg: 170, sp: 26, hom: 4, life: 1.4, size: 1.6, explode: 4.5, col: 0x6fffe0, r: 0.9 }); Au.fx('magic', { g: 0.6, rate: 0.7 }); });
  } };
  EFX.mg_bouclier = { hit(r, L, S, f, t, dmg, crit, o) { if (basicHit(o) && count(L, 'bouc', 8)) addShield(S, f, 50 * r, 200); } };
  EFX.mg_chaine = {
    swing(r, L, S, f, st) { if (count(L, 'chain', 6)) L.chainW = S.t + 1.4; },
    hit(r, L, S, f, t, dmg, crit, o, at) { if (basicHit(o) && L.chainW > S.t) { L.chainW = 0; const p = (at || t.pos).clone(); chain(S, p, t, r > 1 ? 5 : 3, 60, 0x9ad8ff); } } };
  EFX.mg_blink = { stats(r, st) { st.dashMax += 1; } };
  EFX.mg_nova = { hurt(r, L, S, f) { if (L.novaT > S.t) return; L.novaT = S.t + 5; later(0.01, () => { if (alive(S)) nova(S, f, 5, 60, 0xa8f0ff, { freeze: 1.2, kb: 4 }); }); } };
  EFX.mg_fam = { tick(r, L, S, f, dt) {
    if (!L.fam) {
      const g = new THREE.Group(), core = new THREE.Mesh(S.fx.geo.sph, glowMat(0x6fffe0, 2.4, 1)), halo = new THREE.Mesh(S.fx.geo.sph, glowMat(0x6fffe0, 1.4, 0.3));
      core.scale.setScalar(0.22); halo.scale.setScalar(0.5); g.add(core, halo); S.scene.add(g); L.fam = g; L.famT = 1;
    }
    const a = S.t * 1.7, p = f.center().add(new V3(Math.cos(a) * 1.3, 0.9 + Math.sin(S.t * 3) * 0.15, Math.sin(a) * 1.3));
    L.fam.position.lerp(p, Math.min(1, dt * 10));
    if (Math.random() < dt * 12) S.fx.spark(L.fam.position.clone(), new V3(0, 0.6, 0), { color: 0x6fffe0, life: 0.3, size: 0.2, size1: 0.02 });
    L.famT -= dt; if (L.famT > 0) return; L.famT = r > 1 ? 0.9 : 1.5;
    const e = nearE(S, L.fam.position, 16, 1)[0]; if (!e) return;
    const from = L.fam.position.clone(), dir = e.pos.clone().sub(from).normalize();
    shot(S, 'bolt', from, dir, { dmg: 40, sp: 38, hom: 7, life: 1, size: 0.5, col: 0x6fffe0, target: e });
  } };
  EFX.mg_k_tempete = { swing(r, L, S, f) { if (count(L, 'tmp', 10)) { bolts(S, f, 6, 110); T().banner('BÂTON-TEMPÊTE', '', 0.7, 'gold'); } } };
  EFX.mg_k_prisme = { hit(r, L, S, f, t, dmg, crit, o, at) { if (basicHit(o)) { const p = (at || t.pos).clone(); later(0.01, () => { if (!S.ended) shards(S, p, t, 2, 22, 0xe0c0ff); }); } } };
  // ===== MAGE — pouvoirs =====
  EFX.mg_p_rech = GEN.rech;
  EFX.mg_p_ener = GEN.enCast(8, 15);
  EFX.mg_p_crit = Object.assign({}, GEN.critCast, { critHit(r, L, S, f, t, at) { const p = (at || t.pos).clone(); later(0.02, () => { if (S.ended) return; hitZ(S, p, 3, 80, 'basic', { kb: 4 }); show(S, 'boom', [p.x, p.y, p.z, 3, 0xffd23a]); }); } });
  EFX.mg_p_kill = GEN.killCd;
  EFX.mg_p_echo = GEN.echoFirst;
  EFX.mg_p_combo = GEN.combo3((S, f) => { nova(S, f, 7, 180, 0xc070ff, { kb: 8, launch: 3 }); T().banner('HARMONIE', '', 0.8, 'gold'); });
  EFX.mg_p_blink = GEN.dashCast;
  EFX.mg_p_gel = { out(r, L, S, f, t, o) { if (o.kind === 'skill' && o.skill !== 'tree') o.freeze = Math.max(o.freeze || 0, 0.5 * r); } };
  EFX.mg_k_double = GEN.double;
  EFX.mg_k_sent = GEN.summon4('fantomes');
  // ===== MAGE — ultime =====
  EFX.mg_u_pret = GEN.upret; EFX.mg_u_kill = GEN.ukill; EFX.mg_u_inv = GEN.uinv; EFX.mg_u_reset = GEN.ureset; EFX.mg_u_zone = GEN.uzone;
  EFX.mg_u_mana = { cast(r, L, S, f, id, slot) { if (slot === 'ult') { f.buff.domain2 = 1; f.buff.domain2T = 6; } } };
  EFX.mg_u_heal = { cast(r, L, S, f, id, slot) { if (slot === 'ult') addShield(S, f, 200 * r, 400 * r); } };
  EFX.mg_u_post = Object.assign({ swing(r, L, S, f, st) {
    if (!(L.postU > S.t) || !st.bolt) return;
    const from = f.tip ? f.tip(0) : f.center(), aim = aimOf(f); if (aim.y < 0.5) aim.y = 1; const d = aim.sub(from).normalize();
    for (const s of [-1, 1]) shot(S, 'bolt', from, d.clone().applyAxisAngle(new V3(0, 1, 0), s * 0.3), { dmg: 45, sp: 42, hom: 4, life: 1.3, size: 0.7, col: 0xffd76a });
  } }, GEN.upost);
  EFX.mg_u_freeze = GEN.ustun(0xa8f0ff, { freeze: 1.5, stun: 1.5 });
  EFX.mg_u_cast = GEN.ucast;
  EFX.mg_k_echo = GEN.uecho;
  EFX.mg_k_trou = GEN.urecast('gravite', 0.5);
  // ===== ARCHER — arme =====
  const bowFrom = f => f.center().add(new V3(0, 0.3, 0));
  const bowDir = (f, from) => { const a = aimOf(f); if (a.y < 0.5) a.y = 1; return a.sub(from).normalize(); };
  function extraArrows(S, f, n, spread, dmg, o) {
    const from = bowFrom(f), d = bowDir(f, from);
    for (let i = 0; i < n; i++) { const k = n === 1 ? (Math.random() < 0.5 ? -1 : 1) : (i - (n - 1) / 2) * 2; shot(S, 'arrow', from.clone().addScaledVector(d, 0.7), d.clone().applyAxisAngle(new V3(0, 1, 0), k * spread), Object.assign({ dmg, sp: 62, hom: 1.6, life: 1.1, col: 0x9aff7a }, o)); }
  }
  EFX.ar_plus = { swing(r, L, S, f, st) { if (!heavy(st) && count(L, 'plus', [4, 3, 2][r - 1])) extraArrows(S, f, 1, 0.09, 50); } };
  EFX.ar_feu = {
    swing(r, L, S, f, st) { if (count(L, 'feu', r > 1 ? 4 : 6)) L.boomW = S.t + 1.2; },
    hit(r, L, S, f, t, dmg, crit, o, at) { if (basicHit(o) && L.boomW > S.t) { L.boomW = 0; const p = (at || t.pos).clone(); later(0.02, () => { if (S.ended) return; hitZ(S, p, 3, 75, 'basic', { color: '#ff8a3a', kb: 3 }); show(S, 'boom', [p.x, p.y, p.z, 3, 0xff8a3a]); Au.fx('boom', { g: 0.3, rate: 1.7, len: 0.4 }); }); } } };
  EFX.ar_crit = { out(r, L, S, f, t, o) { if (basicHit(o) && count(L, 'crit', r > 1 ? 4 : 5)) o.crit = true; } };
  EFX.ar_trait3 = { swing(r, L, S, f, st) { if (fin(st)) extraArrows(S, f, 2, 0.15, st.dmg || 40); } };
  EFX.ar_givre = { out(r, L, S, f, t, o) { if (basicHit(o)) o.freeze = Math.max(o.freeze || 0, 0.4); } };
  EFX.ar_tete = { swing(r, L, S, f, st) {
    if (!heavy(st)) return;
    for (let i = 0; i < 2 * r; i++) later(0.12 + i * 0.07, () => { if (!alive(S)) return; const from = bowFrom(f), d = bowDir(f, from).applyAxisAngle(new V3(0, 1, 0), (i % 2 ? 1 : -1) * 0.04 * (1 + (i >> 1)));
      shot(S, 'arrow', from.clone().addScaledVector(d, 0.7), d, { dmg: 90, sp: 70, pierce: true, life: 0.9, col: 0xd8ffd0, sc: 1.2 }); });
  } };
  EFX.ar_ricoche = { hit(r, L, S, f, t, dmg, crit, o, at) {
    if (!basicHit(o) || !count(L, 'rico', r > 1 ? 2 : 3)) return;
    const from = (at || t.pos).clone(), e = nearE(S, from, 10, 1, [keyOf(t)])[0]; if (!e) return;
    const dir = e.pos.clone().sub(from).normalize(); later(0.01, () => { if (!S.ended) shot(S, 'arrow', from.clone().addScaledVector(dir, (t.r || 0.8) + 0.3), dir, { dmg: 45, sp: 55, hom: 6, life: 0.7, col: 0x9aff7a, target: e, net: false }); });
  } };
  EFX.ar_mine = { dash(r, L, S, f) { if (L.mineT > S.t) return; L.mineT = S.t + 0.6; trapAt(S, f.pos.clone().setY(0), 'basic'); } };
  EFX.ar_vent = { stats(r, st) { st.dashMax += 1; } };
  EFX.ar_grele = { swing(r, L, S, f) {
    if (!count(L, 'grele', 8)) return;
    const t = nearE(S, aimOf(f), 6, 1)[0] || nearE(S, f.pos, 18, 1)[0]; if (!t) return;
    const c = t.pos.clone().setY(0), n = r > 1 ? 8 : 5;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, d = i === 0 ? 0 : Math.random() * 2.2; skyFall(S, c.clone().add(new V3(Math.cos(a) * d, 0, Math.sin(a) * d)), 1, 0x9aff7a, 0.1 + i * 0.07, 50, 1.8, 'basic', {}); }
  } };
  EFX.ar_marque = { out(r, L, S, f, t, o) {
    if (!basicHit(o)) return; const k = keyOf(t), n = (L.marks.get(k) || 0) + 1;
    if (n >= 4) { L.marks.set(k, 0); o.stun = Math.max(o.stun || 0, 0.8); S.fx.ring(t.pos.clone(), { r0: 0.3, r1: 2.2, color: 0xffd23a, life: 0.3, width: 0.35 }); } else L.marks.set(k, n);
  } };
  EFX.ar_saut = {
    stats(r, st) { st.jumpMax += 1; },
    airJump(r, L, S, f) {
      const list = nearE(S, f.pos, 16, 3); if (!list.length) return; const from = bowFrom(f);
      list.forEach((e, i) => later(i * 0.05, () => { if (!alive(S)) return; const d = e.pos.clone().sub(from).normalize(); shot(S, 'arrow', from.clone().addScaledVector(d, 0.6), d, { dmg: 50, sp: 60, hom: 5, life: 1, col: 0x9aff7a, target: e }); }));
      Au.fx('swing', { g: 0.6, rate: 2 });
    } };
  EFX.ar_rafale = {
    perfect(r, L, S) { L.raf = r > 1 ? 8 : 5; },
    swing(r, L, S, f, st) { if (L.raf > 0 && !heavy(st)) { L.raf--; extraArrows(S, f, 2, 0.12, 45); } } };
  EFX.ar_k_baliste = { swing(r, L, S, f, st) {
    if (!heavy(st)) return;
    const from = bowFrom(f), d = bowDir(f, from);
    shot(S, 'arrow', from.clone().addScaledVector(d, 0.8), d, { dmg: 260, sp: 75, pierce: true, life: 0.55, sc: 2.6, r: 0.9, col: 0xd8ffb0, posture: 3,
      onEnd: p => { const q = p.pos.clone(); if (S.ended) return; hitZ(S, q, 4.5, 160, 'basic', { kb: 8, launch: 4 }); show(S, 'boom', [q.x, q.y, q.z, 4.5, 0xd8ffb0]); Au.fx('boom', { g: 0.5, rate: 1.4, len: 0.6 }); } });
    T().shake(0.3); Au.fx('swingBig', { g: 0.8, rate: 0.7 });
  } };
  EFX.ar_k_carquois = { hit(r, L, S, f, t, dmg, crit, o) { if (basicHit(o) && !(L.carqT > S.t) && count(L, 'carq', 25)) { L.carqT = S.t + 8; recast(S, f, 'fantomes', aimOf(f), 0.05); } } };
  // ===== ARCHER — pouvoirs =====
  EFX.ar_p_rech = GEN.rech;
  EFX.ar_p_dash = GEN.dashCast;
  EFX.ar_p_crit = GEN.critCast;
  EFX.ar_p_kill = GEN.killCd;
  EFX.ar_p_echo = GEN.echoFirst;
  EFX.ar_p_combo = GEN.combo3((S, f) => { const c = f.pos.clone().setY(0); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + Math.random() * 0.3, d = 2.5 + Math.random() * 5; skyFall(S, clampA(c.clone().add(new V3(Math.cos(a) * d, 0, Math.sin(a) * d))), 1, 0x9aff7a, i * 0.06, 70, 2, 'skill', { kb: 2 }); } T().banner('VOLÉE', '', 0.8, 'gold'); });
  EFX.ar_p_trap = { cast(r, L, S, f, id, slot) { if (slot !== 'ult') trapAt(S, f.pos.clone().setY(0), 'skill'); } };
  EFX.ar_p_ener = GEN.enCast(8, 15);
  EFX.ar_k_double = GEN.double;
  EFX.ar_k_spectre = GEN.summon4('clone');
  // ===== ARCHER — ultime =====
  EFX.ar_u_pret = GEN.upret; EFX.ar_u_kill = GEN.ukill; EFX.ar_u_inv = GEN.uinv; EFX.ar_u_reset = GEN.ureset; EFX.ar_u_zone = GEN.uzone; EFX.ar_u_heal = GEN.uheal;
  EFX.ar_u_pluie = GEN.urecast('pluie', 0.6);
  EFX.ar_u_post = Object.assign({ swing(r, L, S, f, st) { if (L.postU > S.t && !heavy(st)) extraArrows(S, f, 2, 0.12, 45, { col: 0xffd76a }); } }, GEN.upost);
  EFX.ar_u_parf = { perfect(r, L, S, f, kind) { if (kind === 'dodge') addUlt(f, 10); } };
  EFX.ar_u_cast = GEN.ucast;
  EFX.ar_k_echo = GEN.uecho;
  EFX.ar_k_legion = GEN.urecast('u_legion', 0.4);
  Q.TREE_FX = EFX;

  /* ---------- branchement sur les évènements de combat ---------- */
  const mine = (S, f) => S && S.asc && f && S.me === f && Q.running;
  Q.on('stats', (st, M) => {
    if (!M || !M.cls || !M.tree) return;
    for (const id in M.tree) { const e = EFX[id], r = M.tree[id] | 0; if (e && e.stats && r > 0) e.stats(r, st); }
  });
  Q.on('start', (S) => { state(S); });
  Q.on('swing', (S, f, st, k) => { if (!mine(S, f) || k) return; dispatch(S, 'swing', [S, f, st || {}]);
    const L = L0; if (L && L.critArm > S.t) { L.critArm = 0; const melee = !(st && (st.arrow || st.bolt || st.orb)); L.critW = S.t + (melee ? 0.15 : 1.6); L.critOne = !melee; } });
  Q.on('out', (S, f, t, o) => {
    if (!mine(S, f) || !o) return;
    const L = dispatch(S, 'out', [S, f, t, o]); if (!L) return;
    if (L.critW > S.t && basicHit(o)) {
      o.crit = true; o.kb = Math.max(typeof o.kb === 'number' ? o.kb : 0, 8); o.launch = Math.max(o.launch || 0, 4);
      if (L.critOne) { L.critW = 0; for (const [e, r] of L.list) if (e.critHit) e.critHit(r, L, S, f, t, t.pos); }
    }
  });
  Q.on('hit', (S, f, t, dmg, crit, o, at) => {
    if (!mine(S, f) || !t) return;
    const L = state(S); if (!L) return;
    L.lastHit.set(keyOf(t), { t: S.t, kind: o && o.kind });
    dispatch(S, 'hit', [S, f, t, dmg, crit, o || {}, at]);
  });
  Q.on('cast', (S, f, id, slot, lv) => { if (mine(S, f)) dispatch(S, 'cast', [S, f, id, slot, lv]); });
  Q.on('dash', (S, f, dir, kind) => { if (mine(S, f)) dispatch(S, 'dash', [S, f, dir, kind]); });
  Q.on('perfect', (S, f, kind) => { if (mine(S, f)) dispatch(S, 'perfect', [S, f, kind]); });
  Q.on('hurt', (S, f, dmg) => { if (mine(S, f)) dispatch(S, 'hurt', [S, f, dmg]); });
  Q.on('kill', (S, a, silent) => {
    if (silent || !S || !S.asc || !S.me || !Q.running) return;
    const L = state(S); if (!L || !L.list.length) return;
    const i = S.boss && S.boss.adds ? S.boss.adds.indexOf(a) : -1; if (i < 0) return;
    const h = L.lastHit.get('add' + i); if (!h || S.t - h.t > 1.5) return;
    L.lastHit.delete('add' + i);
    dispatch(S, 'killMine', [S, S.me, a, h.kind]);
  });
  Q.on('tick', (S, dt) => {
    if (!S || !S.asc || !S.me || !Q.running) return;
    const L = state(S); if (!L) return; const f = S.me;
    L.t += dt;
    if (!L.started) { L.started = true; dispatch(S, 'start', [S, f]); }
    // l'arbre part chez les autres (plusieurs fois : ils n'arrivent pas tous en même temps)
    if (L.kitT.length && L.t > L.kitT[0]) { L.kitT.shift(); if (L.cls) send({ e: 'kit', c: L.cls, n: L.nodes }); }
    if (!L.list.length) return;
    // atterrissage d'une attaque plongeante, saut en l'air
    const act = f.action ? f.action.type : null;
    if (L.prevAct === 'air' && act !== 'air') dispatch(S, 'land', [S, f]);
    L.prevAct = act;
    const j = f.jumps | 0; if (j > (L.prevJ | 0) && j >= 2 && f.pos.y > 0.3) dispatch(S, 'airJump', [S, f]); L.prevJ = j;
    dispatch(S, 'tick', [S, f, dt]);
  });
  Q.on('runEnd', () => { LS = null; L0 = null; });

  /* ---------- réseau : rejouer les visuels des autres ---------- */
  Q.on('net', (S, f, d) => {
    if (!d || !S) return;
    try {
      if (d.e === 'kit') { if (f && CLS.includes(d.c) && d.n && typeof d.n === 'object') { NT[f.id] = Q.treeClean(d.c, d.n, null); if (f.kit && !f.kit.tree) f.kit.tree = NT[f.id]; } return; }
      if (!f) return;
      if (d.e === 'v' && VIS[d.n] && Array.isArray(d.a) && d.a.every(x => typeof x === 'number' && isFinite(x))) VIS[d.n](S, f, d.a);
      else if (d.e === 'p') remoteShot(S, f, d);
      else if (d.e === 'size' && typeof d.k === 'number') {
        const base = f.sizeBase || f.sizeMul || 1; f.sizeMul = base * BR.clamp(d.k, 1, 1.6);
        later(BR.clamp(+d.d || 0, 0, 12), () => { f.sizeMul = f.sizeBase || base; });
      }
    } catch (e) { console.error('arbre (réseau)', e); }
  });

  /* =====================================================================
     6. ÉCRAN DE L'ARBRE (chez le Maître des arts du village) : un arbre magique en 3D
        Tronc noueux → 3 grosses branches (Arme à gauche, Pouvoirs au centre, Ultime à droite) ; chaque nœud est une gemme
        posée sur ses rameaux (rangée = hauteur, prérequis = rameau qui relie les nœuds). Racines lumineuses, feuillage,
        lucioles, feuilles qui tombent. Survol (projection écran) = surbrillance + panneau HTML ; glisser = tourner ;
        molette = zoom ; clic sur une branche / une étiquette / une puce = cadrage. En-tête et panneau restent en HTML.
        Sans WebGL : l'ancienne présentation en 3 colonnes (repli).
     ===================================================================== */
  const ICO = (n, sz, c) => (BR.Icons && BR.Icons.svg ? BR.Icons.svg(n, sz, c) : '');
  const BRS = ['w', 'p', 'u'];
  let curCls = null;
  Q.openTree = cls => { if (cls && CLS.includes(cls)) curCls = cls; UI.show('asc-tree'); };
  const rankTxt = (n, i) => n.d[Math.min(i, n.d.length - 1)];

  /* ---------- disposition dans l'espace (unités 3D ≈ mètres) ---------- */
  const L3 = { Y0: 3.7, DY: 1.28, FORK: 2.25, BX: 6.2 };
  const BSIGN = { w: -1, p: 0, u: 1 };
  const bandX = (br, r) => BSIGN[br] * (L3.BX + 0.22 * r);
  const colSp = r => 1.7 + 0.05 * r;
  const curveZ = x => -x * x / 48;                       // la couronne s'arrondit vers l'arrière
  const rowY = r => L3.Y0 + r * L3.DY;
  const gemR = nd => (nd.key ? 0.64 : 0.46);
  function nodeXYZ(nd) {
    const x = bandX(nd.br, nd.r) + (nd.c - 1) * colSp(nd.r);
    const y = rowY(nd.r) + 0.14 * (1 - Math.abs(nd.c - 1));
    const z = curveZ(x) + 0.2 * Math.sin(nd.r * 1.9 + nd.c * 2.4 + BSIGN[nd.br] * 1.3) + (nd.key ? 0.3 : 0);
    return new V3(x, y, z);
  }
  const anchorOf = br => { const x = bandX(br, 0); return new V3(x, L3.Y0 - 1.0, curveZ(x) - 0.25); };
  // teintes de l'arbre par classe : écorce, feuillage, lueur, ciel, sol
  const TINT = {
    chevalier: { bark: 0x6a7488, leaf: 0x33557e, leaf2: 0xa8ccf2, glow: 0x7ec8ff, sky: 0x060b18, hor: 0x1a2c4a, ground: 0x2c4238, hemi: 0x9fbaff },
    mage: { bark: 0x6a4f78, leaf: 0x55367e, leaf2: 0xd8b0ff, glow: 0xc070ff, sky: 0x0b0716, hor: 0x2c1a48, ground: 0x332c44, hemi: 0xc8a8ff },
    archer: { bark: 0x7a5e40, leaf: 0x37672c, leaf2: 0xb8e890, glow: 0x9aff7a, sky: 0x050f0a, hor: 0x18361f, ground: 0x2e4626, hemi: 0xc8f0b0 },
  };
  // (couleurs données en sRGB, converties en linéaire comme celles des modèles glTF : le post-traitement repasse en sRGB)
  const lin = h => new THREE.Color(h).convertSRGBToLinear();
  const GOLD = lin(0xffd76a), STONE = lin(0x6a6474);

  /* ---------- planche d'images (icônes des nœuds, pastilles de rang, halos) : dessinée une fois ---------- */
  const ATL = { cols: 16, rows: 8, cell: 64, idx: {}, cv: null };
  function svgDraw(g, svg, x, y, size, col, lw) {
    const s = size / 24; g.save(); g.translate(x, y); g.scale(s, s);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; g.lineWidth = lw;
    const re = /<(path|circle|ellipse|rect)\b([^>]*?)\/?>/g; let m;
    while ((m = re.exec(svg))) {
      const A = {}; m[2].replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { A[k] = v; return ''; });
      let p;
      if (m[1] === 'path') p = new Path2D(A.d);
      else {
        p = new Path2D();
        if (m[1] === 'circle') p.arc(+A.cx, +A.cy, +A.r, 0, Math.PI * 2);
        else if (m[1] === 'ellipse') p.ellipse(+A.cx, +A.cy, +A.rx, +A.ry, 0, 0, Math.PI * 2);
        else { const X = +A.x, Y = +A.y, W = +A.width, H = +A.height, r = Math.min(+A.rx || 0, W / 2, H / 2);
          p.moveTo(X + r, Y); p.lineTo(X + W - r, Y); p.arcTo(X + W, Y, X + W, Y + r, r); p.lineTo(X + W, Y + H - r); p.arcTo(X + W, Y + H, X + W - r, Y + H, r);
          p.lineTo(X + r, Y + H); p.arcTo(X, Y + H, X, Y + H - r, r); p.lineTo(X, Y + r); p.arcTo(X, Y, X + r, Y, r); p.closePath(); }
      }
      g.setLineDash(A['stroke-dasharray'] ? A['stroke-dasharray'].split(/[\s,]+/).map(Number) : []);
      g.stroke(p);
    }
    g.restore();
  }
  function atlas() {
    if (ATL.cv) return ATL.cv;
    const cv = document.createElement('canvas'); cv.width = ATL.cols * ATL.cell; cv.height = ATL.rows * ATL.cell;
    const g = cv.getContext('2d'); let k = 0;
    const cell = (name, draw) => { const cx = (k % ATL.cols) * ATL.cell, cy = Math.floor(k / ATL.cols) * ATL.cell; ATL.idx[name] = k++; g.save(); g.translate(cx, cy); draw(g); g.restore(); };
    for (const name in IC) cell('i:' + name, c => { svgDraw(c, IC[name], 7, 7, 50, 'rgba(8,5,16,0.8)', 4.4); svgDraw(c, IC[name], 7, 7, 50, '#fff', 2.1); });
    const pill = (c, txt, light) => {
      c.beginPath(); const x = 3, y = 17, w = 58, h = 30, r = 15;
      c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
      c.fillStyle = light ? '#ffffff' : '#15111f'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = light ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.55)'; c.stroke();
      c.font = '800 21px system-ui, Segoe UI, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = light ? '#111' : '#fff'; c.fillText(txt, 32, 33);
    };
    for (let mx = 1; mx <= 3; mx++) for (let r = 0; r <= mx; r++) { cell('r:' + r + '/' + mx, c => pill(c, r + '/' + mx, false)); cell('R:' + r + '/' + mx, c => pill(c, r + '/' + mx, true)); }
    cell('halo', c => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
    cell('orb', c => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
    cell('ring', c => { c.strokeStyle = '#fff'; c.lineWidth = 3; c.setLineDash([16, 7]); c.beginPath(); c.arc(32, 32, 27, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.lineWidth = 1.5; c.globalAlpha = 0.6; c.beginPath(); c.arc(32, 32, 22, 0, Math.PI * 2); c.stroke(); });
    cell('spark', c => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 12); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(32, 2); c.quadraticCurveTo(35, 29, 62, 32); c.quadraticCurveTo(35, 35, 32, 62); c.quadraticCurveTo(29, 35, 2, 32); c.quadraticCurveTo(29, 29, 32, 2); c.fill(); });
    cell('kstar', c => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; c.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); } c.closePath();
      c.lineWidth = 5; c.strokeStyle = 'rgba(20,12,0,0.85)'; c.lineJoin = 'round'; c.stroke(); c.fillStyle = '#ffd76a'; c.fill(); });
    cell('dot', c => { c.beginPath(); c.arc(32, 32, 15, 0, Math.PI * 2); c.fillStyle = '#b9a6ff'; c.fill(); c.lineWidth = 4; c.strokeStyle = 'rgba(15,8,30,0.85)'; c.stroke(); });
    ATL.cv = cv; return cv;
  }

  /* ---------- petits outils de géométrie ---------- */
  const rng = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const bez = (a, m, b, n) => { const out = []; for (let i = 0; i <= n; i++) { const u = i / n, k0 = (1 - u) * (1 - u), k1 = 2 * (1 - u) * u, k2 = u * u; out.push(new V3(a.x * k0 + m.x * k1 + b.x * k2, a.y * k0 + m.y * k1 + b.y * k2, a.z * k0 + m.z * k1 + b.z * k2)); } return out; };
  const spline = (arr, n) => new THREE.CatmullRomCurve3(arr).getSpacedPoints(n);
  const Builder = () => ({ p: [], c: [], t: [], s: [], h: [], v: [], idx: [] });
  // tube noueux le long d'une suite de points (écorce facettée) ; o = { rad, seg, gn (nœuds), twist, seed, bulge, tip, pw }
  function tube(B, pts, r0, r1, o) {
    const n = pts.length, rad = o.rad || 6, base = B.p.length / 3, T = new V3(), Nn = new V3(), Bn = new V3(), tmp = new V3();
    let r = r0;
    for (let i = 0; i < n; i++) {
      if (i === 0) T.subVectors(pts[1], pts[0]); else if (i === n - 1) T.subVectors(pts[n - 1], pts[n - 2]); else T.subVectors(pts[i + 1], pts[i - 1]);
      T.normalize();
      if (i === 0) { tmp.set(0, 1, 0); if (Math.abs(T.y) > 0.9) tmp.set(1, 0, 0); Nn.crossVectors(tmp, T).normalize(); }
      else Nn.addScaledVector(T, -Nn.dot(T)).normalize();
      Bn.crossVectors(T, Nn);
      const u = i / (n - 1);
      r = (r0 + (r1 - r0) * Math.pow(u, o.pw || 1)) * (o.bulge ? 1 + o.bulge * Math.max(0, 1 - u * 5) : 1);
      for (let j = 0; j < rad; j++) {
        const a = j / rad * Math.PI * 2 + (o.twist || 0) * u, kk = 1 + (o.gn || 0) * Math.sin(a * 3 + u * 11 + (o.seed || 0) * 3.1);
        const ca = Math.cos(a) * r * kk, sa = Math.sin(a) * r * kk, P = pts[i];
        const x = P.x + Nn.x * ca + Bn.x * sa, y = P.y + Nn.y * ca + Bn.y * sa, z = P.z + Nn.z * ca + Bn.z * sa;
        B.p.push(x, y, z);
        const sh = 0.74 + 0.26 * (((j * 7 + i * 3) % 5) / 4);
        B.c.push(sh, sh * 0.97, sh * 0.93); B.t.push(u); B.s.push(o.seg); B.h.push(y); B.v.push(j % 3 === 0 ? 1 : 0.16);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < rad; j++) {
      const a = base + i * rad + j, b = base + i * rad + (j + 1) % rad, c = a + rad, d = b + rad;
      B.idx.push(a, b, c, b, d, c);
    }
    if (o.tip) {
      const L = pts[n - 1].clone().addScaledVector(T, Math.max(0.05, r) * 2.5), ti = B.p.length / 3;
      B.p.push(L.x, L.y, L.z); B.c.push(0.8, 0.78, 0.74); B.t.push(1); B.s.push(o.seg); B.h.push(L.y); B.v.push(0.2);
      for (let j = 0; j < rad; j++) B.idx.push(base + (n - 1) * rad + j, base + (n - 1) * rad + (j + 1) % rad, ti);
    }
  }
  // nœud de bois (boule facettée) pour cacher les jonctions
  function blob(B, c, r, seg, sq) {
    const g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position, base = B.p.length / 3;
    for (let i = 0; i < P.count; i++) {
      const x = c.x + P.getX(i) * r, y = c.y + P.getY(i) * r * (sq || 1), z = c.z + P.getZ(i) * r;
      B.p.push(x, y, z); B.c.push(0.82, 0.8, 0.76); B.t.push(0.5); B.s.push(seg); B.h.push(y); B.v.push(0.16); B.idx.push(base + i);
    }
    g.dispose();
  }
  function geoOf(B) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(B.h, 1));
    const em = new THREE.BufferAttribute(new Float32Array(B.p.length), 3); em.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aEm', em);
    g.setIndex(B.idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return { g, em, n: B.p.length / 3, seg: Uint16Array.from(B.s), t: Float32Array.from(B.t), vein: Float32Array.from(B.v), pos: Float32Array.from(B.p) };
  }
  // lueur par sommet / par instance (aEm) + pousse (aH > uGrow : invisible) — même code pour tous les matériaux de l'arbre
  function patchEm(mat, grow) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uGrow = grow;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aEm;\nattribute float aH;\nvarying vec3 vEm;\nvarying float vH;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEm = aEm;\nvH = aH;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEm;\nvarying float vH;\nuniform float uGrow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (vH > uGrow) discard;\ntotalEmissiveRadiance += vEm;');
    };
    mat.customProgramCacheKey = () => 'tree3d-em';
    return mat;
  }
  // points texturés (icônes, pastilles, halos) : taille en unités 3D, bornée en pixels ; décalage dans le repère caméra
  const PT_VS = `attribute vec3 aCol; attribute float aA, aCell, aRot; attribute vec3 aOff; attribute vec2 aSz;
    uniform float uProj, uPR, uMax, uCols; varying vec3 vCol; varying float vA, vRot; varying vec2 vCell;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xyz += aOff; gl_Position = projectionMatrix * mv;
      float s = aSz.x * uProj / max(0.1, -mv.z); gl_PointSize = clamp(s, aSz.y, uMax) * uPR * step(0.002, aA);
      vCol = aCol; vA = aA; vRot = aRot; vCell = vec2(mod(aCell, uCols), floor(aCell / uCols + 0.001)); }`;
  const PT_FS = add => `uniform sampler2D uMap; uniform float uCols, uRows; varying vec3 vCol; varying float vA, vRot; varying vec2 vCell;
    void main(){ vec2 pc = gl_PointCoord - 0.5; float c = cos(vRot), s = sin(vRot); pc = vec2(c * pc.x - s * pc.y, s * pc.x + c * pc.y) + 0.5;
      if (pc.x < 0.0 || pc.y < 0.0 || pc.x > 1.0 || pc.y > 1.0) discard;
      vec4 t = texture2D(uMap, vec2((vCell.x + pc.x) / uCols, 1.0 - (vCell.y + pc.y) / uRows)); float a = t.a * vA; if (a < 0.01) discard;
      ${add ? 'gl_FragColor = vec4(t.rgb * vCol * a, 1.0);' : 'gl_FragColor = vec4(t.rgb * vCol, a);'} }`;

  /* ---------- la scène 3D ---------- */
  function Tree3D(root, H) {
    if (!window.THREE || !BR.AFX || !BR.AFX.create) return null;
    const canvas = root.querySelector('.tr-gl'), lblBox = root.querySelector('.tr-lbls'), stageEl = root.querySelector('.tr-stage');
    if (!canvas) return null;
    const q = (BR.settings && BR.settings.quality) || 'high';
    let R;
    try { R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) { return null; }
    R.setPixelRatio(Math.min(q === 'low' ? 1 : 1.5, devicePixelRatio || 1)); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.1; R.outputEncoding = THREE.LinearEncoding;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 500); scene.userData.cam = cam;
    scene.fog = new THREE.Fog(0x0a0f1c, 34, 120);
    const fx = BR.AFX.create(scene, cam, null);
    let post = null; try { post = BR.AFX.post(R, scene, cam, q === 'low' ? 'low' : 'high'); } catch (e) { post = null; }
    if (!post) R.outputEncoding = THREE.sRGBEncoding; else { post.grade.uVig.value = 0.55; if (post.bloom) post.bloom.strength = 0.8; }
    const own = { geo: [], mat: [], tex: [] };
    const OG = g => (own.geo.push(g), g), OM = m => (own.mat.push(m), m);
    const G = { t: 0, last: performance.now(), raf: 0, dead: false, W: 0, H: 0, sw: 0, sh: 0, scx: 0, scy: 0, lay: 0, nodes: [], byId: {}, twigs: [], orbs: [], cls: null, hov: null, sel: null,
      grow: 99, trans: null, ratio: { w: 0, p: 0, u: 0, all: 0 }, bgOff: false };
    const growU = { value: -1 }, noGrowU = { value: 1e4 };

    /* --- teintes (transition douce au changement de classe) --- */
    const TT = k => { const T = TINT[k] || TINT.chevalier, o = {}; for (const key in T) o[key] = lin(T[key]); return o; };
    const TC = TT('chevalier'), TF = TT('chevalier'), TG = TT('chevalier'); let tintK = 1;

    /* --- lumières --- */
    const hemi = new THREE.HemisphereLight(0x9fbaff, 0x2a1e14, 0.75); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffe2b8, 1.15); key.position.set(7, 15, 12); scene.add(key);
    const rim = new THREE.DirectionalLight(0x7ec8ff, 1.3); rim.position.set(-5, 7, -12); scene.add(rim);
    const rootL = new THREE.PointLight(0x7ec8ff, 1.6, 11, 2); rootL.position.set(0, 0.9, 1.2); scene.add(rootL);

    /* --- ciel, étoiles, grande lueur derrière l'arbre --- */
    const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } };
    const sky = new THREE.Mesh(OG(new THREE.SphereGeometry(300, 24, 12)), OM(new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uTop, uHor; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.7 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(uHor, uTop, sqrt(h)), 1.0); }' })));
    sky.renderOrder = -10; scene.add(sky);
    { const r = rng(3), N = 420, a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const th = r() * Math.PI * 2, ph = 0.06 + r() * 1.3, d = 240; a[i * 3] = Math.cos(th) * Math.cos(ph) * d; a[i * 3 + 1] = Math.sin(ph) * d; a[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * d - 40; }
      const g = OG(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      G.stars = new THREE.Points(g, OM(new THREE.PointsMaterial({ color: 0xdde6ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.75, depthWrite: false, fog: false })));
      G.stars.renderOrder = -9; scene.add(G.stars); }
    const backU = { uCol: { value: new THREE.Color() }, uT: { value: 0 } };
    const back = new THREE.Mesh(OG(new THREE.PlaneGeometry(52, 34)), OM(new THREE.ShaderMaterial({ uniforms: backU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uT; varying vec2 vUv; void main(){ vec2 d = (vUv - vec2(0.5, 0.42)) * vec2(1.0, 1.5); float r = length(d) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.4) * (0.85 + 0.15 * sin(uT * 0.6)); gl_FragColor = vec4(uCol * a, 1.0); }' })));
    back.position.set(0, 7.5, -12); back.renderOrder = -8; scene.add(back);

    /* --- sol : îlot moussu, cercle de runes --- */
    const groundMat = OM(new THREE.MeshStandardMaterial({ color: 0x2c4238, flatShading: true, roughness: 1 }));
    { const g = OG(new THREE.CylinderGeometry(9.5, 10.4, 1.2, 34, 3)); g.translate(0, -0.6, 0); const P = g.attributes.position, r = rng(11);
      for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y > -0.01) { const x = P.getX(i), z = P.getZ(i), d = Math.hypot(x, z); P.setY(i, d < 0.5 ? 0 : (r() - 0.5) * 0.12 - Math.max(0, d - 7) * 0.08); } else if (y > -1.1) { P.setX(i, P.getX(i) * (0.97 + r() * 0.06)); P.setZ(i, P.getZ(i) * (0.97 + r() * 0.06)); } }
      g.computeVertexNormals(); const m = new THREE.Mesh(g, groundMat); scene.add(m); }
    const runeU = { uCol: { value: new THREE.Color() }, uT: { value: 0 } };
    { const g = OG(new THREE.RingGeometry(1.2, 8.2, 96, 1)); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, OM(new THREE.ShaderMaterial({ uniforms: runeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 uCol; uniform float uT; varying vec2 vP;
          void main(){ float r = length(vP), a = atan(vP.y, vP.x) / 6.28318 + 0.5;
            float l1 = smoothstep(0.07, 0.0, abs(r - 6.0)), l2 = smoothstep(0.05, 0.0, abs(r - 7.4));
            float s = fract(a * 36.0 + uT * 0.05), id = floor(a * 36.0 + uT * 0.05);
            float rune = step(0.18, s) * step(s, 0.82) * smoothstep(0.32, 0.12, abs(r - 6.7)) * (0.35 + 0.65 * step(0.45, fract(sin(id * 12.9898) * 43758.5)));
            float glyph = rune * (0.5 + 0.5 * step(0.5, fract(s * 3.0 + id * 0.37)));
            float inner = smoothstep(3.2, 1.2, r) * 0.25;
            float pulse = 0.7 + 0.3 * sin(uT * 1.3 - r * 0.8);
            gl_FragColor = vec4(uCol * ((l1 + l2 * 0.7 + glyph * 0.55) * pulse + inner), 1.0); }` })));
      m.position.y = 0.03; m.renderOrder = 1; scene.add(m); G.rune = m; }
    // un peu de décor du village autour (rochers, fleurs, buissons), s'ils sont chargés (partagés : jamais libérés ici)
    if (BR.Assets && BR.Assets.prop) {
      [['vil_rocks', -7.2, 2.6, 0.4, 1], ['vil_rocks', 7.6, 1.2, 2.1, 0.9], ['vil_flowers', -4.2, 5.6, 0.2, 1], ['vil_flowers', 4.6, 5.2, 1.3, 1], ['vil_flowers', 1.2, 7.2, 2.5, 0.9],
        ['vil_bush', -8.3, -2.4, 0.3, 1.1], ['vil_bush', 8.4, -3.2, 1.8, 1.1]].forEach(([nm, x, z, ry, s]) => {
        try { const o = BR.Assets.prop(nm); if (!o) return; o.position.set(x, 0, z); o.rotation.y = ry; o.scale.setScalar(s); scene.add(o); } catch (e) { /* modèle absent */ }
      });
    }

    /* --- bois : tronc, 3 branches, rameaux décoratifs, racines (fixe) --- */
    const woodMat = OM(patchEm(new THREE.MeshStandardMaterial({ color: 0x6a7488, vertexColors: true, flatShading: true, roughness: 0.92, side: THREE.DoubleSide }), noGrowU));
    const twigMat = OM(patchEm(new THREE.MeshStandardMaterial({ color: 0x6a7488, vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide }), growU));
    const FORK = new V3(0, L3.FORK, 0);
    const WS = [];                       // segments du bois fixe : { k: 0 tronc | 1 branche | 2 rameau | 3 racine | 4 nœud, br, ph }
    const paths = { trunk: null, limb: {}, roots: [] };
    {
      const B = Builder(), r = rng(5);
      const seg = (k, br) => { WS.push({ k, br: br || null, ph: r() * 6.28 }); return WS.length - 1; };
      const trunk = spline([new V3(0, -0.5, 0), new V3(0.16, 0.55, 0.08), new V3(-0.13, 1.25, -0.06), new V3(0.07, 1.85, 0.03), FORK], 16);
      tube(B, trunk, 1.0, 0.52, { rad: 9, seg: seg(0), gn: 0.15, twist: 1.7, seed: 1, bulge: 0.45 });
      paths.trunk = trunk.filter(p => p.y > 0.2);
      blob(B, FORK.clone().add(new V3(0, 0.1, 0)), 0.66, seg(4), 0.75);
      for (const br of BRS) {
        const A = anchorOf(br), s = BSIGN[br];
        const ctl = s ? [FORK, new V3(s * 1.3, 2.62, 0.12), new V3(s * 3.3, 2.5, -0.2), new V3(s * 5.0, 2.58, -0.62), A] : [FORK, new V3(0.14, 2.5, 0.02), A];
        const P = spline(ctl, s ? 16 : 6); paths.limb[br] = P;
        const ext = spline(ctl.concat([A.clone().add(new V3(s * 0.45, 0.5, -0.15))]), s ? 18 : 8);
        tube(B, ext, s ? 0.5 : 0.48, s ? 0.2 : 0.26, { rad: 7, seg: seg(1, br), gn: 0.12, twist: 1.1, seed: 2 + s });
        blob(B, A, s ? 0.3 : 0.34, seg(4), 0.9);
        // rameau qui monte derrière la branche jusqu'au feuillage
        const x2 = bandX(br, 2), x4 = bandX(br, 4), x5 = bandX(br, 5) + s * 0.4;
        const sp = spline([A.clone().add(new V3(0, 0.25, -0.2)), new V3(x2 + (s ? 0 : 0.35), rowY(2), curveZ(x2) - 1.15), new V3(x4 + (s ? 0 : -0.3), rowY(4), curveZ(x4) - 1.5), new V3(x5, rowY(5) + 1.3, curveZ(x5) - 1.9)], 14);
        tube(B, sp, 0.22, 0.05, { rad: 6, seg: seg(2, br), gn: 0.1, twist: 2, seed: 4 + s, tip: true });
        for (const u of [0.35, 0.62]) {             // deux brindilles de part et d'autre
          const i0 = Math.round(u * (sp.length - 1)), p0 = sp[i0], dir = (u < 0.5 ? -1 : 1) * (s || 1);
          const p2 = p0.clone().add(new V3(dir * 1.3, 0.9, -0.35)), p1 = p0.clone().lerp(p2, 0.5).add(new V3(0, 0.25, 0));
          tube(B, bez(p0, p1, p2, 5), 0.09, 0.03, { rad: 5, seg: seg(2, br), gn: 0.1, seed: 7 + u, tip: true });
        }
      }
      // racines : elles rampent sur le sol, leurs veines pulsent vers le tronc
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + 0.25 + (r() - 0.5) * 0.35, L = 3.4 + r() * 2.4, w = (r() - 0.5) * 0.5;
        const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(a + w), sb = Math.sin(a + w);
        const P = spline([new V3(ca * 0.4, 0.45, sa * 0.4), new V3(ca * 1.25, 0.16, sa * 1.25), new V3(cb * L * 0.6, 0.05 + r() * 0.08, sb * L * 0.6), new V3(Math.cos(a + w * 2) * L, -0.12, Math.sin(a + w * 2) * L)], 14);
        tube(B, P, 0.44, 0.05, { rad: 6, seg: seg(3), gn: 0.16, twist: 1, seed: 9 + i, tip: true });
        paths.roots.push(P);
      }
      G.wood = geoOf(B); own.geo.push(G.wood.g);
      G.woodMesh = new THREE.Mesh(G.wood.g, woodMat); scene.add(G.woodMesh);
    }

    /* --- feuillage stylisé : touffes facettées derrière les nœuds (une seule géométrie) --- */
    const leafMat = OM(new THREE.MeshStandardMaterial({ color: 0x4f7fb8, vertexColors: true, flatShading: true, roughness: 0.8, emissive: 0x000000 }));
    G.foliage = new THREE.Group(); G.foliage.position.set(0, L3.FORK, 0); scene.add(G.foliage);
    {
      const r = rng(17), puffs = [];
      for (let i = 0; i < 19; i++) { const u = i / 18 * 2 - 1, x = u * 11.6 + (r() - 0.5) * 0.9; puffs.push([x, 9.9 + 2.3 * Math.cos(u * 1.4) + (r() - 0.5) * 0.9, curveZ(x) - 3.0 - r() * 1.3, 1.6 + r() * 0.9, 1]); }
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const x = s * (10.9 + r() * 1.3); puffs.push([x, 4.4 + i * 1.6 + r() * 0.5, curveZ(x) - 2.9 - r(), 1.3 + r() * 0.6, 0.9]); }
      for (let i = 0; i < 9; i++) { const x = (i / 8 * 2 - 1) * 9.5; puffs.push([x, 5.6 + r() * 3.2, curveZ(x) - 4.6 - r() * 1.2, 1.5 + r() * 0.8, 0.42]); }
      const pos = [], col = [], gI = new THREE.IcosahedronGeometry(1, 1), P = gI.attributes.position, m4 = new THREE.Matrix4(), v = new V3(), e = new THREE.Euler();
      for (const [x, y, z, s, tone] of puffs) {
        m4.compose(new V3(x, y - L3.FORK, z), new THREE.Quaternion().setFromEuler(e.set(r() * 3, r() * 3, r() * 3)), new V3(s * (1 + r() * 0.25), s * (0.8 + r() * 0.2), s));
        const tn = tone * (0.85 + r() * 0.3);
        for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const ly = v.y; v.applyMatrix4(m4); pos.push(v.x, v.y, v.z); const k = tn * (0.45 + 0.65 * (ly + 1) / 2); col.push(k, k, k); }
      }
      gI.dispose();
      const g = OG(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
      G.foliage.add(new THREE.Mesh(g, leafMat));
    }

    /* --- feuilles qui tombent (instanciées) --- */
    const fallMat = OM(new THREE.MeshStandardMaterial({ color: 0xa8ccf2, flatShading: true, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x000000 }));
    {
      const g = OG(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.1, 0.14, 0.02, 0, 0.34, 0, -0.1, 0.14, 0.02], 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
      const N = 46; G.fall = new THREE.InstancedMesh(g, fallMat, N); G.fall.frustumCulled = false; scene.add(G.fall);
      const r = rng(23); G.leaves = [];
      for (let i = 0; i < N; i++) G.leaves.push({ p: new V3((r() - 0.5) * 22, r() * 12, (r() - 0.5) * 4 - 1.5), v: 0.35 + r() * 0.45, ph: r() * 6.28, rs: 0.8 + r() * 1.6, s: 0.8 + r() * 0.6 });
    }

    /* --- nœuds : gemmes instanciées (normales / clés), anneaux des nœuds clés --- */
    const capN = Math.max(...CLS.map(c => Q.TREES[c].filter(n => !n.key).length)), capK = Math.max(...CLS.map(c => Q.TREES[c].filter(n => n.key).length));
    const mkGems = (geo, cap) => {
      geo.setAttribute('aEm', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const m = new THREE.InstancedMesh(geo, OM(patchEm(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.3, metalness: 0.12 }), noGrowU)), cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false;
      for (let i = 0; i < cap; i++) { m.setColorAt(i, STONE); m.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
      scene.add(m); return m;
    };
    const gN = OG(new THREE.IcosahedronGeometry(0.46, 0)); gN.scale(1, 1.1, 0.92);
    const gK = OG(new THREE.OctahedronGeometry(0.64, 0)); gK.scale(1, 1.4, 1);
    G.gemN = mkGems(gN, capN); G.gemK = mkGems(gK, capK);
    G.rings = new THREE.InstancedMesh(OG(new THREE.TorusGeometry(0.88, 0.035, 5, 32)), OM(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), capK * 2);
    G.rings.frustumCulled = false; for (let i = 0; i < capK * 2; i++) { G.rings.setColorAt(i, GOLD); G.rings.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); } scene.add(G.rings);

    /* --- icônes, pastilles, halos : deux nuages de points texturés --- */
    const atlasTex = new THREE.CanvasTexture(atlas()); atlasTex.minFilter = THREE.LinearMipmapLinearFilter; atlasTex.anisotropy = 1; own.tex.push(atlasTex);
    const ptU = { uMap: { value: atlasTex }, uProj: { value: 600 }, uPR: { value: R.getPixelRatio() }, uMax: { value: 96 }, uCols: { value: ATL.cols }, uRows: { value: ATL.rows } };
    const mkPts = (cap, add) => {
      const g = OG(new THREE.BufferGeometry()), A = {};
      const at = (n, sz) => { A[n] = new THREE.BufferAttribute(new Float32Array(cap * sz), sz).setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, A[n]); };
      at('position', 3); at('aCol', 3); at('aA', 1); at('aCell', 1); at('aRot', 1); at('aOff', 3); at('aSz', 2);
      const m = new THREE.Points(g, OM(new THREE.ShaderMaterial({ uniforms: ptU, vertexShader: PT_VS, fragmentShader: PT_FS(add), transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false })));
      m.frustumCulled = false; m.renderOrder = add ? 6 : 10; scene.add(m);
      const set = (i, p, cell, col, a, sz, mn, ox, oy, oz, rot) => {
        A.position.array[i * 3] = p.x; A.position.array[i * 3 + 1] = p.y; A.position.array[i * 3 + 2] = p.z;
        A.aCol.array[i * 3] = col.r; A.aCol.array[i * 3 + 1] = col.g; A.aCol.array[i * 3 + 2] = col.b;
        A.aA.array[i] = a; A.aCell.array[i] = cell; A.aRot.array[i] = rot || 0; A.aSz.array[i * 2] = sz; A.aSz.array[i * 2 + 1] = mn;
        A.aOff.array[i * 3] = ox || 0; A.aOff.array[i * 3 + 1] = oy || 0; A.aOff.array[i * 3 + 2] = oz || 0;
      };
      const hide = i => { A.aA.array[i] = 0; };
      const flush = () => { for (const k in A) A[k].needsUpdate = true; };
      return { m, set, hide, flush, cap };
    };
    const MAXN = 64;
    const GP = mkPts(MAXN * 2 + 16, true), IP = mkPts(MAXN * 4, false);
    const SLOT = { sel: MAXN * 2, hov: MAXN * 2 + 1, orb: MAXN * 2 + 2 };

    /* --- arbre d'une classe : nœuds + rameaux (prérequis) --- */
    let twigGeo = null;
    function build(cls) {
      if (twigGeo) { scene.remove(G.twigMesh); twigGeo.g.dispose(); own.geo.splice(own.geo.indexOf(twigGeo.g), 1); twigGeo = null; }
      G.nodes = []; G.byId = {}; G.twigs = [];
      for (let i = 0; i < IP.cap; i++) IP.hide(i);
      for (let i = 0; i < MAXN * 2 + 2; i++) GP.hide(i);
      let iN = 0, iK = 0;
      Q.TREES[cls].slice(0, MAXN).forEach((nd, k) => {
        const N = { nd, id: nd.id, k, key: nd.key, inst: nd.key ? iK++ : iN++, pos: nodeXYZ(nd), st: 'lk', r: 0, pst: null, pr: 0, holdT: 0,
          base: STONE.clone(), em: new THREE.Color(0, 0, 0), pop: 0, gr: 0, hv: 0, seed: (k * 2.399) % 6.28, sx: -999, sy: -999, sr: 0, vis: false };
        G.nodes.push(N); G.byId[N.id] = N;
      });
      G.gemN.count = iN; G.gemK.count = iK; G.rings.count = iK * 2;
      const B = Builder();
      for (const N of G.nodes) {
        const nd = N.nd, reqs = (nd.req || []).map(id => G.byId[id]).filter(Boolean);
        if (reqs.length) reqs.forEach(P => addTwig(B, P, N)); else addTwig(B, null, N);
      }
      twigGeo = geoOf(B); own.geo.push(twigGeo.g);
      G.twigMesh = new THREE.Mesh(twigGeo.g, twigMat); scene.add(G.twigMesh);
      G.sel = null; G.hov = null;
      labelsHtml();
    }
    function addTwig(B, P, N) {
      const a = P ? P.pos.clone() : anchorOf(N.nd.br), b = N.pos.clone(), seg = G.twigs.length;
      let m;
      if (!P) m = new V3(a.x + (b.x - a.x) * 0.85, a.y + (b.y - a.y) * 0.2, (a.z + b.z) / 2 - 0.12);
      else if (Math.abs(b.x - a.x) > 0.5) m = new V3(a.x + (b.x - a.x) * 0.22, a.y + (b.y - a.y) * 0.62, (a.z + b.z) / 2 - 0.22);
      else m = a.clone().lerp(b, 0.5).add(new V3((seg % 2 ? 0.2 : -0.2), 0, -0.2));
      const pts = bez(a, m, b, 9), r0 = P ? 0.1 - 0.006 * P.nd.r : 0.15;
      tube(B, pts, r0, Math.max(0.05, r0 * 0.62), { rad: 5, seg, gn: 0.1, twist: 0.8, seed: seg * 1.7 });
      G.twigs.push({ from: P ? P.id : null, to: N.id, br: N.nd.br, pts, on: false, av: false, f: -0.12, delay: 0, ph: (seg * 1.37) % 6.28 });
    }
    const rankAny = N => (N.pst ? N.pr : N.r);
    function refreshTwigs(delay) {
      for (const T of G.twigs) {
        const A = T.from ? G.byId[T.from] : null, B = G.byId[T.to];
        const on = B.r > 0 && (!A || A.r > 0), av = !on && (!A || A.r > 0) && B.st !== 'lk' && B.r < 1;
        if (on !== T.on) { T.on = on; T.delay = delay ? delay(T) : 0; }
        T.av = av;
      }
      const sp = { w: 0, p: 0, u: 0 }; let all = 0;
      for (const N of G.nodes) { const v = Math.min(N.nd.max, N.r) * N.nd.cost; sp[N.nd.br] += v; all += v; }
      G.ratio = { w: Math.min(1, sp.w / 12), p: Math.min(1, sp.p / 12), u: Math.min(1, sp.u / 12), all: Math.min(1, all / 30) };
    }

    /* --- étiquettes HTML posées sur la 3D (branches, rangées verrouillées, nom du nœud survolé) --- */
    const LB = { br: {}, rows: [], tip: null };
    function labelsHtml() {
      lblBox.innerHTML = ''; LB.br = {}; LB.rows = [];
      for (const br of BRS) {
        const e = document.createElement('button'); e.className = 't3-br'; e.dataset.focus = br; e.dataset.b = br; e.type = 'button'; e._ax = 'translate(-50%,-100%)';
        lblBox.appendChild(e); const x = bandX(br, 5); LB.br[br] = { el: e, p: new V3(x, rowY(5) + 0.85, curveZ(x) - 0.1) };
      }
      for (const br of BRS) for (let r = 1; r < 6; r++) {
        const e = document.createElement('div'); e.className = 't3-row'; e._ax = 'translate(-100%,-50%)'; e.innerHTML = `${ICO('lock', 11)}<span>Niv. ${ROWLV[r]}</span>`; lblBox.appendChild(e);
        const x = bandX(br, r) - colSp(r) - 1.05; LB.rows.push({ el: e, br, r, p: new V3(x, rowY(r), curveZ(x)), on: false });
      }
      LB.tip = document.createElement('div'); LB.tip.className = 't3-tip'; LB.tip._ax = 'translate(-50%,-100%)'; lblBox.appendChild(LB.tip); LB.tipId = null;
    }
    const _p = new V3();
    function place(e, p, show) {
      if (!show) { if (e.style.display !== 'none') e.style.display = 'none'; return; }
      _p.copy(p).project(cam);
      if (_p.z > 1 || _p.x < -1.3 || _p.x > 1.3 || _p.y < -1.3 || _p.y > 1.3) { if (e.style.display !== 'none') e.style.display = 'none'; return; }
      if (e.style.display === 'none') e.style.display = '';
      e.style.transform = `translate(${((_p.x * 0.5 + 0.5) * G.W).toFixed(1)}px,${((-_p.y * 0.5 + 0.5) * G.H).toFixed(1)}px) ${e._ax || ''}`;
    }
    function labelsStep() {
      const lv = G.lv || 1;
      for (const br of BRS) { const L = LB.br[br]; place(L.el, L.p, true); L.el.classList.toggle('dim', !!(G.C.focus && G.C.focus !== br)); L.el.classList.toggle('on', G.C.focus === br); }
      for (const L of LB.rows) place(L.el, L.p, lv < ROWLV[L.r] && (G.C.focus ? L.br === G.C.focus : L.br === 'w'));
      const N = G.hov && G.byId[G.hov];
      if (N && N.vis) { if (LB.tipId !== N.id) { LB.tipId = N.id; LB.tip.innerHTML = H.tip(N.id); } place(LB.tip, _tip.copy(N.pos).add(_up.set(0, gemR(N.nd) + 0.42, 0)), true); }
      else { LB.tipId = null; place(LB.tip, N ? N.pos : _p, false); }
    }
    const _tip = new V3(), _up = new V3();

    /* --- caméra : orbite douce, cadrage d'une branche, zoom --- */
    const C = G.C = { yaw: 0.25, pitch: -0.04, dist: 60, tgt: new V3(0, 5, 0), gYaw: 0, gPitch: 0.1, gTgt: new V3(0, 5.6, 0), focus: null, zoom: 1, idle: 0 };
    function fitDist(focus) {
      const fv = 2 * Math.tan(cam.fov * Math.PI / 360), H0 = G.H || 720, fh = (G.sh || H0 * 0.7) / H0, fw = (G.sw || H0 * 1.2) / H0;
      const w = focus ? 2 * colSp(3) + 3.6 : 21, h = focus ? 9.6 : 12.7;
      return Math.max(h / (fv * fh), w / (fv * fw));
    }
    function focusGoal(br) {
      if (!br) { C.gTgt.set(0, 6.2, 0); C.gYaw = 0; }
      else { const x = bandX(br, 2.5); C.gTgt.set(x, 7.0, curveZ(x)); C.gYaw = Math.atan2(x / 24, 1); }
      C.gPitch = 0.1; C.zoom = 1;
    }
    G.focus = br => { C.focus = br || null; focusGoal(C.focus); C.idle = 0; };
    function camStep(dt) {
      C.idle += dt;
      const k = 1 - Math.exp(-dt * 4), fd = fitDist(C.focus) * C.zoom;
      C.yaw += (C.gYaw - C.yaw) * k; C.pitch += (C.gPitch - C.pitch) * k; C.dist += (fd - C.dist) * k; C.tgt.lerp(C.gTgt, k);
      const sw = BR.clamp((C.idle - 2.5) / 3, 0, 1), yaw = C.yaw + sw * 0.07 * Math.sin(G.t * 0.16), pitch = C.pitch + sw * 0.025 * Math.sin(G.t * 0.21);
      cam.position.set(C.tgt.x + Math.sin(yaw) * Math.cos(pitch) * C.dist, C.tgt.y + Math.sin(pitch) * C.dist, C.tgt.z + Math.cos(yaw) * Math.cos(pitch) * C.dist);
      cam.lookAt(C.tgt); cam.updateMatrixWorld();
    }

    /* --- souris : survol (projection), glisser (tourner), molette (zoom), clic (choisir / cadrer) --- */
    const ptr = { in: false, x: 0, y: 0, down: false, drag: false, x0: 0, y0: 0, lx: 0, ly: 0 };
    const rel = e => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    function pick(mx, my) {
      let best = null, bd = 1e9;
      for (const N of G.nodes) {
        if (!N.vis || N.gr < 0.5) continue;
        const d = Math.hypot(mx - N.sx, my - N.sy), rr = Math.max(15, N.sr * 1.2);
        if (d < rr && d / rr < bd) { bd = d / rr; best = N; }
      }
      return best;
    }
    const ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
    function pickBranch(mx, my) {
      _ndc.set(mx / G.W * 2 - 1, -(my / G.H) * 2 + 1); ray.setFromCamera(_ndc, cam);
      const hit = ray.intersectObjects([G.woodMesh, G.twigMesh].filter(Boolean), false)[0];
      if (!hit || !hit.face) return undefined;
      if (hit.object === G.twigMesh) { const T = G.twigs[twigGeo.seg[hit.face.a]]; return T ? T.br : undefined; }
      const S = WS[G.wood.seg[hit.face.a]]; return S ? S.br : null;
    }
    const onDown = e => { if (e.target !== canvas) return; const [x, y] = rel(e); Object.assign(ptr, { down: true, drag: false, x0: x, y0: y, lx: x, ly: y }); };
    const onMove = e => {
      const [x, y] = rel(e); ptr.x = x; ptr.y = y; ptr.in = e.target === canvas;
      if (!ptr.down) return;
      if (!ptr.drag && Math.hypot(x - ptr.x0, y - ptr.y0) > 5) { ptr.drag = true; canvas.classList.add('drag'); }
      if (ptr.drag) {
        C.gYaw = BR.clamp(C.gYaw - (x - ptr.lx) * 0.005, -0.95, 0.95); C.gPitch = BR.clamp(C.gPitch + (y - ptr.ly) * 0.004, -0.06, 0.5);
        C.idle = 0;
      }
      ptr.lx = x; ptr.ly = y;
    };
    const onUp = e => {
      if (!ptr.down) return; ptr.down = false; canvas.classList.remove('drag');
      if (ptr.drag || e.target !== canvas) { ptr.drag = false; return; }
      const [x, y] = rel(e), N = pick(x, y);
      if (N) { H.onPick(N.id); return; }
      const br = pickBranch(x, y); if (br !== undefined) H.onFocus(br);
    };
    const onLeave = () => { ptr.in = false; };
    const onWheel = e => { e.preventDefault(); C.zoom = BR.clamp(C.zoom * Math.exp(BR.clamp(e.deltaY, -200, 200) * 0.0011), 0.42, 1.3); C.idle = 0; };
    const onDbl = e => { const [x, y] = rel(e); if (!pick(x, y)) H.onFocus(null); };
    canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('dblclick', onDbl);
    function hoverStep() {
      const N = ptr.in && !ptr.drag && !G.trans ? pick(ptr.x, ptr.y) : null, id = N ? N.id : null;
      canvas.classList.toggle('pt', !!N);
      if (id !== G.hov) { G.hov = id; H.onHover(id); }
    }

    /* --- état affiché des nœuds (avec délai : l'onde de lumière arrive avant que le nœud ne s'allume) --- */
    function release(N, quiet) {
      if (!N.pst) return false;
      const was = N.r; N.st = N.pst; N.r = N.pr; N.pst = null; N.holdT = 0;
      if (quiet) return true;
      if (N.r > was) bloom(N); else if (N.r < was) wither(N);
      return true;
    }
    function bloom(N) {
      const c = TC.glow, big = N.key ? 1.5 : 1;
      N.pop = 1;
      fx.burst(N.pos, { n: Math.round(26 * big), color: c, speed: 5.5 * big, life: 0.75, size: 0.24, grav: 3, up: 0.6, drag: 1.8 });
      fx.burst(N.pos, { n: Math.round(12 * big), color: GOLD, speed: 3, life: 0.9, size: 0.3, grav: 0, drag: 2 });
      fx.flash(N.pos, { color: c, r: 1.1 * big, life: 0.35, intensity: 6 });
      fx.ring(N.pos, { r0: 0.3, r1: 1.9 * big, color: c, life: 0.55, width: 0.22, tilt: Math.PI / 2, y: 0 });
      Au.fx('reveal', { rate: 0.9 + N.r * 0.12, g: 0.75 });
      if (N.key) Au.fx('perfect', { g: 0.7 });
    }
    function wither(N) { fx.burst(N.pos, { n: 10, color: 0x8a8296, speed: 1.6, life: 0.8, size: 0.16, grav: 6, kind: 'add', bright: 0.6 }); }

    // chemin de l'onde : bout d'une racine → tronc → branche → rameaux des prérequis appris → nœud
    function pathTo(N, shown) {
      const chain = [N]; let cur = N, guard = 0;
      while (cur.nd.req && guard++ < 12) {
        const P = cur.nd.req.map(id => G.byId[id]).find(p => p && (shown ? p.r : rankAny(p)) > 0); if (!P) break;
        chain.push(P); cur = P;
      }
      chain.reverse();
      const root = paths.roots[(N.k * 3) % paths.roots.length].slice().reverse();
      const pts = root.concat(paths.trunk, paths.limb[N.nd.br]);
      let prev = null;
      for (const M of chain) {
        const T = G.twigs.find(t => t.to === M.id && t.from === (prev ? prev.id : null));
        if (T) pts.push(...T.pts); else pts.push(M.pos.clone());
        prev = M;
      }
      return pts;
    }
    function orb(pts, o) {
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const L = cum[cum.length - 1] || 1, dur = o.dur || BR.clamp(L / 19, 0.6, 1.25);
      G.orbs.push({ pts, cum, L, t: -(o.delay || 0), dur, c: o.col.clone(), i0: o.i, i: 0, fade: !!o.fade, p: pts[0].clone(), end: o.end });
      return dur + (o.delay || 0);
    }
    function orbStep(dt) {
      for (let k = G.orbs.length - 1; k >= 0; k--) {
        const O = G.orbs[k]; O.t += dt; if (O.t < 0) { O.i = 0; continue; }
        const u = Math.min(1, O.t / O.dur), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, s = e * O.L;
        let i = 1; while (i < O.cum.length - 1 && O.cum[i] < s) i++;
        const a = O.cum[i - 1], b = O.cum[i], f = b > a ? (s - a) / (b - a) : 0;
        O.p.copy(O.pts[i - 1]).lerp(O.pts[i], f);
        O.i = O.i0 * (O.fade ? 1 - u * 0.85 : 1) * Math.min(1, O.t * 8);
        for (let j = 0; j < 2; j++) fx.spark(O.p, new V3((Math.random() - 0.5) * 1.2, (Math.random() - 0.2) * 1.2, (Math.random() - 0.5) * 1.2), { color: O.c, life: 0.5, size: 0.24, size1: 0.02, drag: 1 });
        if (u >= 1) { G.orbs.splice(k, 1); if (O.end) O.end(); }
      }
    }

    G.sync = function (o) {
      o = o || {};
      if (!G.cls || G.cls !== H.cls() || (G.trans && G.trans.ph === 'out')) return;
      const S = H.snap(); G.lv = S.P.lv;
      const changed = [];
      for (const N of G.nodes) {
        const st = S.st(N.nd), r = S.nodes[N.id] | 0, cs = N.pst ? N.pst : N.st, cr = N.pst ? N.pr : N.r;
        if (cs === st && cr === r) continue;
        N.pst = st; N.pr = r; changed.push(N);
      }
      const L = o.learn && G.byId[o.learn];
      if (L) {
        const dur = orb(pathTo(L, false), { col: TC.glow.clone().multiplyScalar(3), i: 1.6 });
        Au.fx('charge', { len: dur, g: 0.45 });
        for (const M of changed) M.holdT = M === L ? dur : Math.max(M.holdT, dur + 0.15);
      } else if (o.reset) {
        const top = rowY(5) + 0.2;
        const fall = {};                       // le nœud appris le plus haut de chaque branche : sa lumière redescend aux racines
        for (const N of G.nodes) if (N.r > 0 && (!fall[N.nd.br] || N.pos.y > fall[N.nd.br].pos.y)) fall[N.nd.br] = N;
        for (const M of changed) M.holdT = 0.05 + (top - M.pos.y) * 0.1;
        let first = true;
        for (const br in fall) {
          const N = fall[br], d = 0.05 + (top - N.pos.y) * 0.1;
          orb(pathTo(N, true).reverse(), { col: TC.glow.clone().multiplyScalar(2.2), i: 1.2, fade: true, delay: d, dur: 1.3,
            end: first ? () => { fx.ring(new V3(0, 0.05, 0), { r0: 0.6, r1: 7.5, color: TC.glow, life: 0.9, width: 0.2 }); Au.fx('land', { g: 0.8 }); } : null });
          first = false;
        }
        if (Object.keys(fall).length) Au.fx('magic', { rate: 0.55, g: 0.8 });
      } else for (const M of changed) M.holdT = 0;
      for (const M of changed) if (M.holdT <= 0) release(M, true);   // sans onde : changement immédiat et silencieux
      refreshTwigs();
      for (const br of BRS) if (LB.br[br]) LB.br[br].el.innerHTML = H.brLabel(br);
      LB.tipId = null;
    };
    G.setSel = id => { G.sel = id; };
    G.setClass = function (cls, anim) {
      const T = TT(cls); for (const k in TC) { TF[k].copy(TC[k]); TG[k].copy(T[k]); }
      if (!G.cls || !anim) { tintK = G.cls ? 0 : 1; if (tintK) for (const k in TC) TC[k].copy(TG[k]); applyTint(); build(cls); G.cls = cls; G.trans = { ph: 'in', t: 0 }; G.grow = -0.6; G.sync(); return; }
      tintK = 0; G.trans = { ph: 'out', t: 0, cls };
      fx.burst(FORK.clone().add(new V3(0, 0.6, 0)), { n: 60, color: T.glow, speed: 7, life: 1, size: 0.3, grav: -1, up: 1.5, drag: 1.5 });
      fx.ring(new V3(0, 0.05, 0), { r0: 0.5, r1: 8, color: T.glow, life: 0.8, width: 0.25 });
      Au.fx('magic', { rate: 0.85, g: 0.9 });
    };
    function transStep(dt) {
      const T = G.trans; if (!T) return; T.t += dt;
      if (T.ph === 'out') {
        G.grow = 12.5 * (1 - Math.min(1, T.t / 0.38));
        if (T.t >= 0.38) { build(T.cls); G.cls = T.cls; G.grow = -0.6; G.trans = { ph: 'in', t: 0 }; G.sync(); }
      } else {
        const u = Math.min(1, T.t / 1.2); G.grow = -0.6 + 13.4 * (1 - Math.pow(1 - u, 2.2));
        if (u >= 1) { G.grow = 99; G.trans = null; }
      }
    }
    function applyTint() {
      woodMat.color.copy(TC.bark); twigMat.color.copy(TC.bark).multiplyScalar(1.1);
      leafMat.color.copy(TC.leaf); leafMat.emissive.copy(TC.leaf).multiplyScalar(0.035); fallMat.color.copy(TC.leaf2); fallMat.emissive.copy(TC.leaf2).multiplyScalar(0.12);
      groundMat.color.copy(TC.ground); skyU.uTop.value.copy(TC.sky); skyU.uHor.value.copy(TC.hor);
      backU.uCol.value.copy(TC.glow).multiplyScalar(0.22); runeU.uCol.value.copy(TC.glow).multiplyScalar(1.3);
      rim.color.copy(TC.glow); rootL.color.copy(TC.glow); hemi.color.copy(TC.hemi); scene.fog.color.copy(TC.sky).lerp(TC.hor, 0.5);
    }
    function tintStep(dt) {
      if (tintK >= 1) return;
      tintK = Math.min(1, tintK + dt / 0.9); const e = tintK * tintK * (3 - 2 * tintK);
      for (const k in TC) TC[k].copy(TF[k]).lerp(TG[k], e);
      applyTint();
    }

    /* --- image par image : gemmes, halos, icônes --- */
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _v = new V3(), _c = new THREE.Color(), _bc = new THREE.Color(), _ec = new THREE.Color();
    const WHITE = new THREE.Color(1, 1, 1), ICOL = { lk: new THREE.Color(0.55, 0.53, 0.6), op: new THREE.Color(0.9, 0.86, 0.76), av: new THREE.Color(1, 0.96, 0.82) };
    function nodesStep(dt) {
      const t = G.t, glow = TC.glow, proj = ptU.uProj.value;
      const camInv = cam.matrixWorldInverse;
      let rel = false;
      for (const N of G.nodes) if (N.pst) { N.holdT -= dt; if (N.holdT <= 0 && release(N)) rel = true; }
      if (rel) refreshTwigs();
      for (const N of G.nodes) {
        const st = N.st, on = N.r > 0, mx = st === 'mx', av = st.indexOf('av') >= 0, lk = st === 'lk';
        const p1 = 0.5 + 0.5 * Math.sin(t * 2.3 + N.seed), p2 = 0.5 + 0.5 * Math.sin(t * 4.1 + N.seed * 1.7);
        // couleurs cibles
        if (on) { _bc.copy(glow).multiplyScalar(mx ? 0.8 : 0.6).lerp(WHITE, mx ? 0.18 : 0.04); _ec.copy(glow).multiplyScalar(mx ? 0.95 : 0.5 + 0.28 * p1); }
        else if (av) { _bc.setRGB(0.42, 0.28, 0.06); _ec.copy(GOLD).multiplyScalar(0.3 + 0.4 * p2); }
        else if (lk) { _bc.copy(STONE).multiplyScalar(0.72); _ec.setRGB(0, 0, 0); }
        else { _bc.copy(STONE).lerp(glow, 0.2); _ec.copy(glow).multiplyScalar(0.05); }
        if (N.id === G.hov) _ec.addScalar(0.12);
        const k = 1 - Math.exp(-dt * 7); N.base.lerp(_bc, k); N.em.lerp(_ec, k);
        // pousse (changement de classe), éclosion, survol
        const g0 = BR.clamp((G.grow - (N.pos.y - 0.6)) / 1.1, 0, 1);
        N.gr = g0 <= 0 ? 0 : g0 >= 1 ? 1 : 1 + Math.pow(2, -10 * g0) * Math.sin((g0 * 10 - 0.75) * 2.094);
        if (N.pop > 0) N.pop = Math.max(0, N.pop - dt * 1.6);
        N.hv += ((N.id === G.hov ? 1 : 0) - N.hv) * Math.min(1, dt * 12);
        const pop = 1 + 0.5 * Math.sin((1 - N.pop) * Math.PI * 2.5) * N.pop;
        const sc = N.gr * pop * (lk ? 0.84 : 1) * (1 + 0.16 * N.hv + (N.id === G.sel ? 0.05 : 0)) * (av && !on ? 1 + 0.04 * p2 : 1);
        _v.copy(N.pos); _v.y += 0.05 * Math.sin(t * 1.3 + N.seed);
        _e.set(N.key ? 0 : 0.12 * Math.sin(t * 0.7 + N.seed), t * (N.key ? 0.7 : 0.25) + N.seed, 0);
        _m.compose(_v, _q.setFromEuler(_e), _s.setScalar(Math.max(0.0001, sc)));
        const M = N.key ? G.gemK : G.gemN;
        M.setMatrixAt(N.inst, _m); M.setColorAt(N.inst, N.base);
        M.geometry.attributes.aEm.setXYZ(N.inst, N.em.r, N.em.g, N.em.b);
        if (N.key) for (let j = 0; j < 2; j++) {
          _e.set(1.15 + j * 0.9 + 0.15 * Math.sin(t + j), t * (j ? -0.8 : 0.6) + N.seed, 0.3 * j);
          _m.compose(N.pos, _q.setFromEuler(_e), _s.setScalar(Math.max(0.0001, sc * (j ? 0.8 : 1))));
          G.rings.setMatrixAt(N.inst * 2 + j, _m);
          G.rings.setColorAt(N.inst * 2 + j, lk ? _c.setRGB(0.18, 0.17, 0.2) : on ? _c.copy(glow).multiplyScalar(2.2) : av ? _c.copy(GOLD).multiplyScalar(1.5 + p2) : _c.copy(glow).multiplyScalar(0.35));
        }
        // halo + scintillement
        const R0 = gemR(N.nd), vis = N.gr > 0.02;
        if (vis && !lk) {
          const hk = on ? (mx ? 0.75 : 0.45 + 0.2 * p1) : av ? 0.3 + 0.35 * p2 : 0.08;
          _c.copy(on ? glow : av ? GOLD : glow).multiplyScalar(hk * (1 + 0.8 * N.hv));
          GP.set(N.k, N.pos, ATL.idx.halo, _c, Math.min(1, N.gr), (N.key ? 2.7 : 1.75) * (1 + 0.15 * N.hv), 10, 0, 0, -0.3, 0);
        } else GP.hide(N.k);
        if (vis && av) {
          const tw = Math.pow(Math.max(0, Math.sin(t * 2.1 + N.seed * 3)), 6), a = N.seed * 5 + Math.floor(t * 2.1 / 6.28 + N.seed);
          GP.set(MAXN + N.k, N.pos, ATL.idx.spark, _c.copy(GOLD).multiplyScalar(2.2), tw, 0.9 * tw + 0.01, 4, Math.cos(a) * R0 * 0.9, Math.sin(a) * R0 * 0.9 + 0.1, R0 + 0.15, t * 1.4);
          if (Math.random() < dt * 0.9) fx.spark(_v.copy(N.pos).add(new V3((Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6)), new V3(0, 0.6 + Math.random() * 0.5, 0), { color: GOLD, life: 1.2, size: 0.13, size1: 0.02 });
        } else GP.hide(MAXN + N.k);
        if (vis && on && Math.random() < dt * (mx ? 0.9 : 0.5)) fx.spark(_v.copy(N.pos).add(new V3((Math.random() - 0.5) * 0.5, 0.1, (Math.random() - 0.5) * 0.5)), new V3(0, 0.5 + Math.random() * 0.4, 0), { color: glow, life: 1.4, size: 0.14, size1: 0.02 });
        // icône, pastille de rang, étoile des nœuds clés, pastille « pouvoir »
        const ia = Math.min(1, N.gr * 1.3);
        if (vis) {
          const ic = lk ? ICOL.lk : on ? WHITE : av ? ICOL.av : ICOL.op;
          IP.set(N.k, N.pos, ATL.idx['i:' + N.nd.ic] != null ? ATL.idx['i:' + N.nd.ic] : ATL.idx['i:star'], ic, ia * (lk ? 0.55 : 1), N.key ? 1.06 : 0.84, N.key ? 28 : 23, 0, 0, R0 + 0.06);
          const mxR = N.nd.max;
          if ((mxR > 1 && !lk) || N.r) {
            const light = mx, cell = ATL.idx[(light ? 'R:' : 'r:') + Math.min(N.r, mxR) + '/' + Math.min(3, mxR)];
            if (cell != null) IP.set(MAXN + N.k, N.pos, cell, light ? _c.copy(glow).lerp(WHITE, 0.3) : WHITE, ia * (lk ? 0.5 : on ? 1 : 0.8), 0.98, 31, 0, -(R0 + 0.1), R0 + 0.3);
            else IP.hide(MAXN + N.k);
          } else IP.hide(MAXN + N.k);
          if (N.key) IP.set(MAXN * 2 + N.k, N.pos, ATL.idx.kstar, WHITE, ia * (lk ? 0.6 : 1), 0.5, 15, -R0 * 0.85, R0 * 0.9, R0 + 0.2); else IP.hide(MAXN * 2 + N.k);
          if (N.nd.sk && !N.key) IP.set(MAXN * 3 + N.k, N.pos, ATL.idx.dot, WHITE, ia * (lk ? 0.5 : 1), 0.26, 9, R0 * 0.78, R0 * 0.78, R0 + 0.1); else IP.hide(MAXN * 3 + N.k);
        } else { IP.hide(N.k); IP.hide(MAXN + N.k); IP.hide(MAXN * 2 + N.k); IP.hide(MAXN * 3 + N.k); }
        // position à l'écran (survol, étiquettes)
        _v.copy(N.pos).applyMatrix4(camInv); const depth = -_v.z;
        _p.copy(N.pos).project(cam);
        N.vis = vis && depth > 0.1 && _p.z < 1;
        N.sx = (_p.x * 0.5 + 0.5) * G.W; N.sy = (-_p.y * 0.5 + 0.5) * G.H; N.sr = depth > 0.1 ? R0 * proj / depth : 0;
      }
      // anneaux de sélection et de survol
      const S = G.sel && G.byId[G.sel];
      if (S && S.gr > 0.3) GP.set(SLOT.sel, S.pos, ATL.idx.ring, _c.setRGB(1.6, 1.4, 0.9), 0.9, gemR(S.nd) * 3, 20, 0, 0, gemR(S.nd) + 0.25, -t * 0.7); else GP.hide(SLOT.sel);
      const Hn = G.hov && G.byId[G.hov];
      if (Hn && Hn !== S) GP.set(SLOT.hov, Hn.pos, ATL.idx.ring, _c.setRGB(1.2, 1.2, 1.3), 0.55, gemR(Hn.nd) * 2.7, 18, 0, 0, gemR(Hn.nd) + 0.25, t * 0.9); else GP.hide(SLOT.hov);
      for (let i = 0; i < 12; i++) {
        const O = G.orbs[i];
        if (O && O.i > 0.01) GP.set(SLOT.orb + i, O.p, ATL.idx.orb, _c.copy(O.c), Math.min(1, O.i), 1.3, 12, 0, 0, 0.2, 0); else GP.hide(SLOT.orb + i);
      }
      G.gemN.instanceMatrix.needsUpdate = true; G.gemK.instanceMatrix.needsUpdate = true; G.rings.instanceMatrix.needsUpdate = true;
      if (G.gemN.instanceColor) G.gemN.instanceColor.needsUpdate = true; if (G.gemK.instanceColor) G.gemK.instanceColor.needsUpdate = true; if (G.rings.instanceColor) G.rings.instanceColor.needsUpdate = true;
      G.gemN.geometry.attributes.aEm.needsUpdate = true; G.gemK.geometry.attributes.aEm.needsUpdate = true;
      GP.flush(); IP.flush();
    }

    /* --- lueur du bois : racines qui pulsent, veines du tronc (selon les points dépensés), rameaux allumés, onde --- */
    function emWood(W, segs, twig) {
      const em = W.em.array, P = W.pos, t = G.t, gc = TC.glow, orbs = G.orbs, all = G.ratio.all;
      for (let v = 0; v < W.n; v++) {
        const S = segs[W.seg[v]]; if (!S) continue;
        const u = W.t[v], vein = W.vein[v];
        let k = 0, ka = 0;
        if (twig) {
          if (S.f > -0.1) { const lit = BR.clamp((S.f - u) * 8 + 0.5, 0, 1); if (lit > 0) k = lit * (0.5 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.6 - u * 6 + S.ph), 3)) * (0.4 + 0.6 * vein) * 1.5; }
          if (S.av) ka = (0.05 + 0.4 * Math.pow(0.5 + 0.5 * Math.sin(t * 3.2 - u * 9 + S.ph), 6)) * (0.4 + 0.6 * vein);
        } else if (S.k === 3) k = vein * (0.08 + 1.25 * Math.pow(0.5 + 0.5 * Math.sin(t * 2 + u * 7 + S.ph), 6)) * (0.75 + 0.5 * all);
        else if (S.k !== 4) { const lv = S.br ? G.ratio[S.br] : all; k = vein * (0.06 + 0.95 * lv) * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.7 - u * 6 + S.ph), 4)); }
        let r = gc.r * k + GOLD.r * ka, g = gc.g * k + GOLD.g * ka, b = gc.b * k + GOLD.b * ka;
        for (let i = 0; i < orbs.length; i++) {
          const O = orbs[i]; if (O.i <= 0.01) continue;
          const dx = P[v * 3] - O.p.x, dy = P[v * 3 + 1] - O.p.y, dz = P[v * 3 + 2] - O.p.z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 3) { const w = Math.exp(-d2 * 2.4) * O.i; r += O.c.r * w; g += O.c.g * w; b += O.c.b * w; }
        }
        em[v * 3] = r; em[v * 3 + 1] = g; em[v * 3 + 2] = b;
      }
      W.em.needsUpdate = true;
    }
    function twigStep(dt) {
      for (const T of G.twigs) {
        if (T.delay > 0) { T.delay -= dt; continue; }
        if (T.on) T.f = Math.min(1.12, T.f + dt * 2.6); else T.f = Math.max(-0.12, T.f - dt * 2.0);
      }
      emWood(G.wood, WS, false);
      if (twigGeo) emWood(twigGeo, G.twigs, true);
      growU.value = G.grow;
    }

    /* --- vie : l'arbre respire, lucioles, feuilles, étincelles des racines --- */
    function ambientStep(dt) {
      const t = G.t;
      G.foliage.scale.setScalar(1 + 0.012 * Math.sin(t * 0.9)); G.foliage.rotation.z = 0.006 * Math.sin(t * 0.55);
      backU.uT.value = t; runeU.uT.value = t; G.rune.rotation.y = t * 0.02;
      G.stars.material.opacity = 0.6 + 0.15 * Math.sin(t * 0.7);
      rootL.intensity = 1.3 + 0.5 * Math.sin(t * 1.4) + 0.8 * G.ratio.all;
      // lucioles
      if (Math.random() < dt * 9) {
        const x = (Math.random() - 0.5) * 23, warm = Math.random() < 0.55;
        fx.spark(new V3(x, 0.6 + Math.random() * 11, curveZ(x) + (Math.random() - 0.35) * 5), new V3((Math.random() - 0.5) * 0.5, (Math.random() - 0.3) * 0.35, (Math.random() - 0.5) * 0.5),
          { color: warm ? 0xffe9a0 : TC.glow, life: 2.5 + Math.random() * 2.5, size: 0.17, size1: 0.04 });
      }
      // étincelles qui montent des racines
      if (Math.random() < dt * 5) { const P = paths.roots[Math.floor(Math.random() * paths.roots.length)], p = P[Math.floor(Math.random() * P.length)];
        fx.spark(p.clone().add(new V3(0, 0.15, 0)), new V3((Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3), { color: TC.glow, life: 1.6, size: 0.16, size1: 0.02 }); }
      // feuilles qui tombent en tournoyant
      for (let i = 0; i < G.leaves.length; i++) {
        const L = G.leaves[i];
        L.p.y -= L.v * dt; L.p.x += (Math.sin(t * 0.8 + L.ph) * 0.5 + 0.15) * dt; L.p.z += Math.cos(t * 0.6 + L.ph) * 0.25 * dt;
        if (L.p.y < 0.05) { L.p.set((Math.random() - 0.5) * 22, 9.5 + Math.random() * 3.5, 0); L.p.z = curveZ(L.p.x) - 2.2 + Math.random() * 3.6; }
        _e.set(t * L.rs + L.ph, t * L.rs * 0.7, L.ph + Math.sin(t * 2 + L.ph) * 0.6);
        _m.compose(L.p, _q.setFromEuler(_e), _s.setScalar(L.s * Math.min(1, L.p.y * 2)));
        G.fall.setMatrixAt(i, _m);
      }
      G.fall.instanceMatrix.needsUpdate = true;
    }

    /* --- taille, zone libre (entre l'en-tête et le panneau) --- */
    function layout() {
      const w = root.clientWidth, h = root.clientHeight;
      if (!w || !h) return false;
      if (w !== G.W || h !== G.H) { G.W = w; G.H = h; R.setSize(w, h, false); cam.aspect = w / h; if (post) post.setSize(w, h); G.lay = 0; }
      if (--G.lay <= 0) {
        G.lay = 30;
        const rb = root.getBoundingClientRect(), sb = stageEl.getBoundingClientRect();
        G.sw = Math.max(200, sb.width); G.sh = Math.max(160, sb.height); G.scx = sb.left - rb.left + sb.width / 2; G.scy = sb.top - rb.top + sb.height / 2;
        cam.setViewOffset(w, h, w / 2 - G.scx, h / 2 - G.scy, w, h); cam.updateProjectionMatrix();
        ptU.uProj.value = h / (2 * Math.tan(cam.fov * Math.PI / 360)); ptU.uPR.value = R.getPixelRatio();
      }
      return true;
    }
    G.relayout = () => { G.lay = 0; };

    function loop(now) {
      if (G.dead) return;
      G.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - G.last) / 1000)); G.last = now;
      if (document.hidden) return;
      if (!G.bgOff && BR.ArenaUI && BR.ArenaUI.bg) { G.bgOff = true; try { BR.ArenaUI.bg(false); } catch (e) { /* rien */ } }   // le fond animé des menus est inutile ici
      if (!layout()) return;
      G.t += dt;
      tintStep(dt); transStep(dt); camStep(dt);
      nodesStep(dt); orbStep(dt); twigStep(dt); ambientStep(dt);
      fx.update(dt, dt);
      labelsStep(); hoverStep();
      if (post) post.render(dt); else R.render(scene, cam);
    }

    G.dispose = function () {
      if (G.dead) return; G.dead = true; cancelAnimationFrame(G.raf);
      canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('dblclick', onDbl);
      try { fx.dispose(); } catch (e) { /* rien */ }
      try { if (post) post.dispose(); } catch (e) { /* rien */ }
      own.geo.forEach(g => g.dispose()); own.mat.forEach(m => m.dispose()); own.tex.forEach(x => x.dispose());
      try { R.dispose(); R.forceContextLoss(); } catch (e) { /* rien */ }
      lblBox.innerHTML = ''; G.orbs.length = 0; G.nodes = []; G.twigs = [];
    };
    G.scene = scene;
    applyTint();
    G.raf = requestAnimationFrame(loop);
    return G;
  }

  UI.screen('asc-tree', {
    enter(n) {
      BR.curGame = 'arena'; BR.ascMode = true;
      if (!curCls) { const D = Q.data(); curCls = (D.sel && D.sel.cls) || 'chevalier'; }
      let sel = null, armed = null, hover = null, confirmReset = false, focus = null;   // armed : nœud choisi d'un clic (un 2e clic l'apprend)
      const nodesOf = () => clsData(curCls).nodes;
      const state0 = (nd, nodes, P) => {
        const r = nodes[nd.id] | 0;
        if (r >= nd.max) return 'mx';
        if (r > 0) return Q.treeCan(curCls, nd.id).ok ? 'on av' : 'on';
        if (P.lv < ROWLV[nd.r] || (nd.req && !nd.req.some(x => (nodes[x] | 0) > 0))) return 'lk';
        return P.free >= nd.cost ? 'av' : 'op';
      };
      const brHead = br => {
        const C = Q.CLASSES[curCls];
        if (br === 'w') return { n: 'Arme', sub: (AR.WEAPONS[C.weapon] || {}).name || 'Attaque de base', ic: 'blade' };
        if (br === 'p') return { n: 'Pouvoirs', sub: 'Tes 4 pouvoirs', ic: 'spark' };
        return { n: 'Ultime', sub: Q.skillName(C.ult, curCls), ic: 'crown' };
      };
      // --- repli sans WebGL : 3 colonnes de ronds ---
      const pos = nd => ({ x: (nd.c + 0.5) / 3 * 100, y: (nd.r + 0.5) / 6 * 100 });
      function branchHtml(br, nodes, P) {
        const H = brHead(br), list = Q.TREES[curCls].filter(nd => nd.br === br);
        const lines = [];
        for (const nd of list) for (const rq of nd.req || []) {
          const pn = IDX[curCls][rq]; if (!pn) continue; const a = pos(pn), b = pos(nd);
          const cl = (nodes[nd.id] | 0) > 0 && (nodes[rq] | 0) > 0 ? 'on' : (nodes[rq] | 0) > 0 ? 'av' : '';
          lines.push(`<line class="${cl}" x1="${a.x}%" y1="${a.y}%" x2="${b.x}%" y2="${b.y}%"/>`);
        }
        const rows = ROWLV.map((lv, i) => `<span class="tr-row ${P.lv >= lv ? 'ok' : ''}" style="top:${(i + 0.5) / 6 * 100}%">${P.lv >= lv ? '' : ICO('lock', 10)}${lv}</span>`).join('');
        const btns = list.map(nd => {
          const r = nodes[nd.id] | 0, p = pos(nd), stt = state0(nd, nodes, P);
          return `<button class="tn ${stt}${nd.key ? ' key' : ''}${sel === nd.id ? ' sel' : ''}${nd.sk ? ' sk' : ''}" data-id="${nd.id}" style="left:${p.x}%;top:${p.y}%" aria-label="${esc(nd.n)}">
            <span class="tn-i">${icon(nd.ic, nd.key ? 30 : 24)}</span>${nd.max > 1 || r ? `<i class="tn-r">${r}/${nd.max}</i>` : ''}${nd.key ? '<em class="tn-k">★</em>' : ''}</button>`;
        }).join('');
        return `<div class="tr-br" data-b="${br}"><div class="tr-bh"><span class="tr-bi">${icon(H.ic, 20)}</span><div><b>${H.n}</b><span>${esc(H.sub)}</span></div><em>${Q.treeSpent(curCls, br)} pts</em></div>
          <div class="tr-grid"><svg class="tr-lines">${lines.join('')}</svg>${rows}${btns}</div></div>`;
      }
      function detailHtml(id, nodes, P) {
        const nd = IDX[curCls][id];
        if (!nd) return `<div class="td td-empty"><b>Choisis un nœud</b><p>Survole ou clique une gemme de l'arbre pour voir ce qu'elle fait.</p>
          <ul class="td-help"><li><i class="dot av"></i>Disponible</li><li><i class="dot on"></i>Appris</li><li><i class="dot lk"></i>Verrouillé</li><li><i class="dot key"></i>Nœud clé (2 points)</li></ul></div>`;
        const r = nodes[id] | 0, can = Q.treeCan(curCls, id), H = brHead(nd.br);
        const ranks = nd.d.map((t, i) => `<li class="${i < r ? 'on' : i === r ? 'next' : ''}"><b>${nd.max > 1 ? 'Rang ' + (i + 1) : nd.key ? 'Nœud clé' : 'Effet'}</b><span>${esc(t)}</span></li>`).join('');
        const reqs = [];
        reqs.push(`<li class="${P.lv >= ROWLV[nd.r] ? 'ok' : 'no'}">${ICO(P.lv >= ROWLV[nd.r] ? 'check' : 'lock', 12)} Niveau de classe ${ROWLV[nd.r]}</li>`);
        if (nd.req) { const ok = nd.req.some(x => (nodes[x] | 0) > 0); reqs.push(`<li class="${ok ? 'ok' : 'no'}">${ICO(ok ? 'check' : 'lock', 12)} ${nd.req.map(x => esc(IDX[curCls][x].n)).join(' <i>ou</i> ')}</li>`); }
        const skName = nd.sk ? Q.skillName(nd.sk, curCls) : '';
        return `<div class="td${nd.key ? ' key' : ''}">
          <div class="td-h"><div class="td-i ${r ? 'on' : ''}">${icon(nd.ic, 34)}</div><div><small>${H.n}${nd.key ? ' · nœud clé' : ''}</small><b>${esc(nd.n)}</b>${nd.max > 1 ? `<div class="td-pips">${nd.d.map((x, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div>` : r ? '<div class="td-got">Appris</div>' : ''}</div></div>
          ${nd.sk ? `<div class="td-sk"><img src="${AR.icon(nd.sk, 64)}" alt=""><span>Pouvoir : <b>${esc(skName)}</b><br><i>N'agit que si ce pouvoir est équipé.</i></span></div>` : ''}
          <ul class="td-ranks">${ranks}</ul>
          <ul class="td-req">${reqs.join('')}</ul>
          ${r < nd.max ? `<button class="btn primary td-go" data-a="learn" data-id="${id}" ${can.ok ? '' : 'disabled'}>Apprendre · ${nd.cost} point${nd.cost > 1 ? 's' : ''}</button>${can.ok ? '' : `<span class="td-why">${esc(can.why)}</span>`}` : '<div class="td-max">Rang maximum atteint</div>'}
        </div>`;
      }

      // --- squelette : canevas 3D, étiquettes, interface HTML par-dessus ---
      n.innerHTML = `<div class="tr"><canvas class="tr-gl"></canvas><div class="tr-lbls"></div>
        <div class="tr-ui"><div class="tr-head"></div><div class="tr-body"><div class="tr-stage"></div><div class="tr-det"></div></div></div></div>`;
      const root = n.querySelector('.tr'), headEl = root.querySelector('.tr-head'), stageEl = root.querySelector('.tr-stage'), detEl = root.querySelector('.tr-det');
      const snap = () => { const c = clsData(curCls), P = Q.treePoints(curCls); return { nodes: c.nodes, P, st: nd => state0(nd, c.nodes, P) }; };
      let G = null;
      try {
        G = Tree3D(root, {
          cls: () => curCls,
          snap,
          brLabel: br => { const H = brHead(br); return `<span class="t3-bi">${icon(H.ic, 18)}</span><span class="t3-bt"><b>${H.n}</b><small>${esc(H.sub)}</small></span><em>${Q.treeSpent(curCls, br)} pts</em>`; },
          tip: id => { const nd = IDX[curCls][id]; if (!nd) return ''; const r = nodesOf()[id] | 0; return `<b>${esc(nd.n)}</b>${nd.max > 1 || r ? `<i>${r}/${nd.max}</i>` : ''}`; },
          onHover: id => { if (id !== hover) { hover = id; paintDet(); } },
          onPick: id => pickNode(id),
          onFocus: br => setFocus(br),
        });
      } catch (e) { console.error('arbre 3D', e); if (G && G.dispose) G.dispose(); G = null; }
      this._g = G;
      if (!G) { const cv = root.querySelector('.tr-gl'); if (cv) cv.remove(); root.classList.add('flat'); }

      function paintHead() {
        const C = Q.CLASSES[curCls], c = clsData(curCls), Lv = Q.clsLevel(c.xp), P = Q.treePoints(curCls);
        const nxt = Lv.max ? 0 : ptsAt(Lv.lv + 1) - ptsAt(Lv.lv);
        const tabs = CLS.map(k => { const K = Q.CLASSES[k], l = Q.clsLevel(clsData(k).xp).lv, fr = Q.treePoints(k).free;
          return `<button class="tr-tab ${k === curCls ? 'on' : ''}" data-cls="${k}" style="--tc:${K.col}"><b>${esc(K.n)}</b><span>Niv. ${l}</span>${fr > 0 ? `<em>${fr}</em>` : ''}</button>`; }).join('');
        root.style.setProperty('--cc', C.col);
        headEl.innerHTML = `<div class="tr-top">
            <button class="btn ghost back" data-a="back" title="Retour au village">${ICO('back', 18)}</button>
            <div class="tr-title"><small>Maître des arts</small><b>Arbre de compétences</b></div>
            <div class="tr-tabs">${tabs}</div>
            <div class="tr-pts ${P.free > 0 ? 'has' : ''}"><b>${Math.max(0, P.free)}</b><span>point${P.free > 1 ? 's' : ''}<br>à dépenser</span></div>
          </div>
          <div class="tr-lv">
            <div class="tr-badge"><small>NIV.</small><b>${Lv.lv}</b></div>
            <div class="tr-xp"><div class="tr-bar"><i style="width:${Lv.max ? 100 : Math.round(Lv.cur / Lv.need * 100)}%"></i></div>
              <span>${Lv.max ? 'Niveau maximum !' : `<b>${Lv.cur}</b> / ${Lv.need} XP · niveau ${Lv.lv + 1} : +${nxt} point${nxt > 1 ? 's' : ''}`}</span></div>
            <p class="tr-hint">Joue ${curCls === 'archer' ? 'l\'archer' : 'le ' + esc(C.n.toLowerCase())} pour gagner de l'XP de classe : étages franchis, boss vaincus, victoires. Un point par niveau, un bonus tous les 5 niveaux.</p>
            <button class="btn ghost tr-reset ${confirmReset ? 'warn' : ''}" data-a="reset" ${P.spent ? '' : 'disabled'}>${ICO('refresh', 14)} ${confirmReset ? 'Confirmer ?' : 'Réinitialiser (gratuit)'}</button>
          </div>`;
      }
      function paintStage() {
        if (!G) { const c = clsData(curCls), P = Q.treePoints(curCls); stageEl.innerHTML = `<div class="tr-brs">${BRS.map(b => branchHtml(b, c.nodes, P)).join('')}</div>`; return; }
        const chips = [[null, 'Tout l\'arbre', 'target'], ['w', 'Arme', 'blade'], ['p', 'Pouvoirs', 'spark'], ['u', 'Ultime', 'crown']];
        stageEl.innerHTML = `<div class="tr-nav">${chips.map(([b, t, ic]) => `<button class="tr-fc ${focus === b ? 'on' : ''}" data-focus="${b || ''}">${icon(ic, 15)}<span>${t}</span></button>`).join('')}
          <small class="tr-help">Glisser : tourner · Molette : zoom · Clic : choisir · 2<sup>e</sup> clic : apprendre</small></div>`;
      }
      function paintDet() {
        const c = clsData(curCls), P = Q.treePoints(curCls);
        if (!sel || !IDX[curCls][sel]) { const f = Q.TREES[curCls].find(nd => Q.treeCan(curCls, nd.id).ok); sel = f ? f.id : Q.TREES[curCls][0].id; if (G) G.setSel(sel); }
        detEl.innerHTML = detailHtml(hover || sel, c.nodes, P);
      }
      function paint(o) { paintHead(); paintStage(); paintDet(); if (G) { G.setSel(sel); G.sync(o); G.relayout(); } }
      function learn(id) {
        if (!Q.treeLearn(curCls, id)) { Au.ui('error'); return; }
        Au.ui('buy'); sel = id; hover = null; paintHead(); paintDet();
        if (G) { G.setSel(id); G.sync({ learn: id }); }
        else { paintStage(); const b = stageEl.querySelector(`.tn[data-id="${id}"]`); if (b) b.classList.add('pop'); }
      }
      function pickNode(id) {
        if (confirmReset) { confirmReset = false; paintHead(); }
        if (armed === id && Q.treeCan(curCls, id).ok) { learn(id); return; }   // un second clic sur le nœud déjà choisi l'apprend
        sel = id; armed = id; hover = null; Au.ui('click'); paintDet();
        if (G) G.setSel(id); else paintStage();
      }
      function setFocus(br) {
        br = br || null; if (br === focus && br) br = null;     // re-cliquer la branche cadrée revient à la vue d'ensemble
        focus = br; if (G) G.focus(focus); Au.ui('click'); paintStage();
      }
      if (G) G.setClass(curCls, false);
      paint();
      n.onclick = e => {
        const a = e.target.closest('[data-a]'), tb = e.target.closest('[data-cls]'), fc = e.target.closest('[data-focus]'), nd = !G && e.target.closest('.tn');
        if (a && a.dataset.a === 'back') { Au.ui('back'); UI.show('asc'); return; }
        if (tb) {
          if (tb.dataset.cls !== curCls) {
            curCls = tb.dataset.cls; sel = null; armed = null; hover = null; confirmReset = false; Au.ui('click');
            if (G) G.setClass(curCls, true);
            paint();
          }
          return;
        }
        if (fc) { setFocus(fc.dataset.focus || null); return; }
        if (a && a.dataset.a === 'reset') {
          if (!confirmReset) { confirmReset = true; Au.ui('click'); paintHead(); return; }
          Q.treeReset(curCls); confirmReset = false; Au.ui('back'); UI.toast && UI.toast('Arbre réinitialisé : tes points sont rendus.', 'good');
          paint({ reset: true }); return;
        }
        if (a && a.dataset.a === 'learn') { learn(a.dataset.id); return; }
        if (nd) pickNode(nd.dataset.id);
      };
      if (!G) {
        n.onmouseover = e => { const nd = e.target.closest('.tn'); const id = nd ? nd.dataset.id : null; if (id !== hover) { hover = id; paintDet(); } };
        n.onmouseleave = () => { if (hover) { hover = null; paintDet(); } };
      }
      this._key = e => {
        if (!UI.current || UI.current() !== 'asc-tree') return;
        if (e.key === 'Escape') { Au.ui('back'); UI.show('asc'); return; }
        if (G && /^[0-3]$/.test(e.key) && !(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))) { const b = [null, 'w', 'p', 'u'][+e.key]; focus = null; setFocus(b); }
      };
      document.addEventListener('keydown', this._key);
    },
    leave() {
      if (this._key) document.removeEventListener('keydown', this._key); this._key = null;
      if (this._g) { try { this._g.dispose(); } catch (e) { console.warn(e); } } this._g = null;
    },
  });
})();

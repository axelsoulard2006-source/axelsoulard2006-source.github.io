/* ===== Mod d'exemple « Lanternes » : des blocs lumineux décoratifs
   Ce fichier sert de MODÈLE pour écrire un mod de blocs. Il montre :
     - blocs(api) : dessiner des tuiles (api.addTile) et déclarer des blocs (api.registry.block) ;
       cette partie tourne AUSSI dans le Worker (génération + maillage) : n'y mets que du contenu « monde » ;
     - init(api) : recettes, palette du mode créatif, et un hook (étincelles quand on pose une lanterne).
   Ids réservés aux mods : blocs 64 à 99 (ici 64, 65, 66), objets 300 à 499. ===== */
VX.mod({
  id: 'lanternes',                  // = nom du fichier (mods/lanternes.js)
  nom: 'Lanternes',
  version: '1.0',
  auteur: 'Équipe Blocaria',
  description: 'Lanternes de fer et de braise, pavés lumineux : de quoi éclairer un village avec style.',

  /* ---------- contenu « monde » (thread principal ET Worker) ---------- */
  blocs(api) {
    // Une tuile = 16 lignes de 16 caractères. Chaque caractère renvoie à une couleur de la palette ;
    // l'espace ' ' = pixel transparent (visible seulement si le bloc est « cutout »).
    const CORPS = [
      '      kkkk      ',
      '      k  k      ',
      '    kkkkkkkk    ',
      '   kKKKKKKKKk   ',
      '   kkkkkkkkkk   ',
      '   kyyyyyyyyk   ',
      '   kyyyowyyyk   ',
      '   kyyoowoyyk   ',
      '   kyyowwoyyk   ',
      '   kyyowwoyyk   ',
      '   kyyyoooyyk   ',
      '   kyyyhhyyyk   ',
      '   kyyyyyyyyk   ',
      '   kkkkkkkkkk   ',
      '   kKKKKKKKKk   ',
      '   kkkkkkkkkk   ',
    ];
    const DESSUS = [
      '                ',
      '                ',
      '                ',
      '   kkkkkkkkkk   ',
      '   kKKKKKKKKk   ',
      '   kKKKKKKKKk   ',
      '   kKKKkkKKKk   ',
      '   kKKk  kKKk   ',
      '   kKKk  kKKk   ',
      '   kKKKkkKKKk   ',
      '   kKKKKKKKKk   ',
      '   kKKKKKKKKk   ',
      '   kkkkkkkkkk   ',
      '                ',
      '                ',
      '                ',
    ];
    // même dessin, deux palettes : fer (lumière dorée) et braise (lumière orangée)
    const FER = { k: '#2e2a28', K: '#5a5450', y: '#ffd06a', o: '#ff9a3a', w: '#fff6d0', h: '#7a5230' };
    const BRAISE = { k: '#3a2018', K: '#6a3424', y: '#ff8a3a', o: '#ffd23a', w: '#ffffff', h: '#4a2a18' };
    api.addTile('lanterne_fer_cote', FER, CORPS);
    api.addTile('lanterne_fer_haut', FER, DESSUS);
    api.addTile('lanterne_braise_cote', BRAISE, CORPS);
    api.addTile('lanterne_braise_haut', BRAISE, DESSUS);
    api.addTile('pave_lumineux', { m: '#5e5e64', '.': '#8f8f95', a: '#a4a4aa', c: '#7ff0ff', C: '#e8ffff' }, [
      'mmmmmmmmmmmmmmmm',
      'm.a....mm....a.m',
      'm......mm......m',
      'm..c...mm...c..m',
      'm.cCc..mm..cCc.m',
      'm..c...mm...c..m',
      'm......mm......m',
      'mmmmmmmmmmmmmmmm',
      'mmmmmmmmmmmmmmmm',
      'm......mm......m',
      'm..c...mm...c..m',
      'm.cCc..mm..cCc.m',
      'm..c...mm...c..m',
      'm......mm......m',
      'm.a....mm....a.m',
      'mmmmmmmmmmmmmmmm',
    ]);

    // Propriétés utiles d'un bloc : hard (dureté), tool / tier (outil), light (lumière émise 0..15),
    // glow (rendu sans ombre, lumineux), opaque, cutout (pixels transparents), solid, drop…
    const LANTERNE = { opaque: false, cutout: true, glow: true, hard: 1, tool: 'pioche' };
    api.registry.block(64, 'Lanterne de fer', { top: 'lanterne_fer_haut', bottom: 'lanterne_fer_haut', side: 'lanterne_fer_cote' }, Object.assign({ light: 15 }, LANTERNE));
    api.registry.block(65, 'Lanterne de braise', { top: 'lanterne_braise_haut', bottom: 'lanterne_braise_haut', side: 'lanterne_braise_cote' }, Object.assign({ light: 12 }, LANTERNE));
    api.registry.block(66, 'Pavé lumineux', 'pave_lumineux', { hard: 1.5, tool: 'pioche', tier: 0, light: 9 });
  },

  /* ---------- jeu (thread principal seulement) ---------- */
  init(api) {
    const { registry: REG, I, B } = api, S = VX.SURV || {};
    // recettes : lignes de la grille + clé (caractère -> id) + résultat + quantité
    REG.shaped(['F', 'T'], { F: I.L_FER, T: B.TORCHE }, 64, 2);
    if (S.POUDRE) REG.shaped(['P', 'T'], { P: S.POUDRE, T: B.TORCHE }, 65, 2);
    REG.shapeless([B.BRIQUES, B.LUMICRISTAL], 66, 4);
    [64, 65, 66].forEach(id => REG.creative(id));

    // un hook : petites étincelles quand on pose une lanterne
    api.hooks.on('blockPlace', e => {
      if (e.id !== 64 && e.id !== 65) return;
      const FX = api.FX; if (FX) FX.burst(e.x + 0.5, e.y + 0.6, e.z + 0.5, 10, e.id === 64 ? [1, 0.85, 0.4] : [1, 0.5, 0.15], { speed: 1.5, life: 0.5, up: 1.5, spread: 0.4 });
    });
    api.log('prêt : 3 blocs lumineux');
  },
});

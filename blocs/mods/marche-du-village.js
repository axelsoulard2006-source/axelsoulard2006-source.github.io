/* ===== Mod d'exemple « Marché du village » : des pièces d'or, un étal, des commandes de chat
   Ce fichier sert de MODÈLE pour un mod qui mêle bloc, objet, commandes et interaction. Il montre :
     - un bloc décoratif (id 70) déclaré dans blocs(api) ;
     - un objet (pièce d'or, id 310) et son icône ;
     - des commandes du chat : /vendre, /prix, /acheter, /bourse (api.command) ;
     - un hook « use » : clic droit sur l'étal avec un objet en main = le vendre. ===== */
VX.mod({
  id: 'marche-du-village',
  nom: 'Marché du village',
  version: '1.0',
  auteur: 'Équipe Blocaria',
  description: 'Vends tes récoltes contre des pièces d\'or (/vendre, /prix, /acheter) ou sur un étal du marché.',

  blocs(api) {
    const P = { r: '#c8303a', w: '#f4ecd8', R: '#9a2028', W: '#d8d0bc', d: '#3a2a1a', a: '#e0302a', b: '#d8a050', c: '#5cab3c', p: '#b88a4f', P: '#8a6232', s: '#6e4c2a' };
    // côté : auvent rayé, étagère de marchandises, comptoir en planches
    api.addTile('marche_etal_cote', P, [
      'rrrwwwrrrwwwrrrw',
      'rrrwwwrrrwwwrrrw',
      'rrrwwwrrrwwwrrrw',
      'RRRWWWRRRWWWRRRW',
      'dddddddddddddddd',
      'ddaadbbdddccddad',
      'daaaabbbbdcccaaa',
      'PPPPPPPPPPPPPPPP',
      'pppppppppppppppp',
      'pspppppsppppppsp',
      'pppppppppppppppp',
      'PPPPPPPPPPPPPPPP',
      'pppspppppppsppps',
      'pppppppppppppppp',
      'pppppspppppppppp',
      'ssssssssssssssss',
    ]);
    // dessus : l'auvent vu du ciel
    const bande = 'rrrwwwrrrwwwrrrw';
    api.addTile('marche_etal_haut', P, ['RRRWWWRRRWWWRRRW'].concat(Array(14).fill(bande), ['RRRWWWRRRWWWRRRW']));
    api.registry.block(70, 'Étal du marché', { top: 'marche_etal_haut', side: 'marche_etal_cote', bottom: 'planks' }, { hard: 2, tool: 'hache' });
  },

  init(api) {
    const { registry: REG, I, B } = api, S = VX.SURV || {};
    const PIECE = 310, ETAL = 70;

    REG.item(PIECE, 'Pièce d\'or', null, {});
    api.addItemArt(PIECE, [
      '................',
      '................',
      '.....oooooo.....',
      '....oyyyyyyo....',
      '...oyYYyyyyyo...',
      '..oyYyyyyyyyyo..',
      '..oyYyyOOyyyyo..',
      '..oyyyyOyyyyyo..',
      '..oyyyyOOyyyyo..',
      '..oyyyyyOyyyyo..',
      '..oyyyyOOyyyyo..',
      '...oyyyyyyyyo...',
      '....oyyyyyyo....',
      '.....oooooo.....',
    ], { o: '#a87a10', y: '#f6d33c', Y: '#fff3a0', O: '#c8a020' });
    // change : un lingot d'or = 8 pièces, 9 pièces = un lingot (pas de profit en boucle)
    REG.shapeless([I.L_OR], PIECE, 8);
    REG.shaped(['PPP', 'PPP', 'PPP'], { P: PIECE }, I.L_OR);
    REG.shaped(['LLL', 'Q Q', 'Q Q'], { L: S.LAINE || B.PLANCHES, Q: B.PLANCHES }, ETAL);
    [ETAL, PIECE].forEach(id => REG.creative(id));

    // prix de rachat (pièces pour UN objet) ; ce qui n'est pas listé ne se vend pas
    const PRIX = {
      [I.BLE]: 2, [I.PAIN]: 5, [I.POMME]: 2, [I.GRAINES]: 1, [I.CHARBON]: 1, [I.L_FER]: 4, [I.L_OR]: 8, [I.SAPHIR]: 15, [I.ECLAT]: 10,
      [B.TRONC]: 1, [B.LUMICRISTAL]: 3, [B.CACTUS]: 1, [B.FLEUR_R]: 1, [B.FLEUR_J]: 1,
    };
    if (S.LAINE) Object.assign(PRIX, { [S.LAINE]: 2, [S.CUIR]: 3, [S.OS]: 1, [S.GIGOT_CUIT]: 4, [S.COTE_CUITE]: 5, [S.PAVE_CUIT]: 5 });
    // catalogue du marchand : nom tapé -> [id, quantité, prix]
    const CATALOGUE = { pain: [I.PAIN, 1, 7], torches: [B.TORCHE, 4, 3], graines: [I.GRAINES, 3, 2], fer: [I.L_FER, 1, 7], pommes: [I.POMME, 2, 5] };

    const bourse = G => G.inv.reduce((n, s) => n + (s && s.id === PIECE ? s.n : 0), 0);
    function payer(G, n) {   // retire n pièces (on a vérifié avant qu'il y en a assez)
      for (let i = 0; i < G.inv.length && n > 0; i++) { const s = G.inv[i]; if (s && s.id === PIECE) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) G.inv[i] = null; } }
    }
    // vend l'objet tenu (combien : nombre, ou toute la pile) ; renvoie le message à afficher
    function vendre(combien) {
      const G = api.G, s = G.inv[G.sel];
      if (!s) return ['Prends en main ce que tu veux vendre.', 'err'];
      const p = PRIX[s.id]; if (!p) return ['Le marchand n\'achète pas : ' + VX.nameOf(s.id) + '.', 'err'];
      const n = Math.max(1, Math.min(s.n, combien === 'tout' || combien == null ? s.n : parseInt(combien, 10) || 1));
      s.n -= n; if (s.n <= 0) G.inv[G.sel] = null;
      G.give(PIECE, n * p); G.sfx('pop'); VX.UI.hud();
      return [n + ' × ' + VX.nameOf(s.id) + ' vendu(s) pour ' + n * p + ' pièce(s). Bourse : ' + bourse(G) + '.', 'ok'];
    }

    api.command('vendre', (args, ctx) => { const [t, k] = vendre(args[0]); ctx.say(t, k); }, '[nombre|tout]');
    api.command('prix', (args, ctx) => {
      const G = api.G, s = G.inv[G.sel];
      if (!s) { ctx.say('Le marchand achète : ' + Object.keys(PRIX).slice(0, 12).map(id => VX.nameOf(+id) + ' ' + PRIX[id]).join(', ') + '…'); return; }
      ctx.say(PRIX[s.id] ? VX.nameOf(s.id) + ' : ' + PRIX[s.id] + ' pièce(s) l\'unité.' : 'Le marchand n\'achète pas cet objet.', PRIX[s.id] ? 'ok' : 'err');
    });
    api.command('acheter', (args, ctx) => {
      const G = api.G, nom = (args[0] || '').toLowerCase(), e = CATALOGUE[nom];
      if (!e) { ctx.say('À vendre : ' + Object.keys(CATALOGUE).map(k => k + ' (' + CATALOGUE[k][2] + ' pièces)').join(', ') + '. Exemple : /acheter pain', 'err'); return; }
      const [id, n, prix] = e;
      if (bourse(G) < prix) { ctx.say('Il te faut ' + prix + ' pièces (tu en as ' + bourse(G) + ').', 'err'); return; }
      payer(G, prix); G.give(id, n); G.sfx('pop'); VX.UI.hud();
      ctx.say('Acheté : ' + n + ' × ' + VX.nameOf(id) + '. Bourse : ' + bourse(G) + '.');
    }, '<pain|torches|graines|fer|pommes>');
    api.command('bourse', (args, ctx) => ctx.say('Tu as ' + bourse(api.G) + ' pièce(s) d\'or.'));

    // clic droit sur un étal avec un objet en main : on vend toute la pile (accroupi : on pose normalement)
    api.hooks.on('use', ({ target, player }) => {
      if (!target || target.id !== ETAL || player.sneak) return true;
      const [t, k] = vendre('tout'); VX.UI.say(t, k); if (k === 'ok') VX.UI.toast(t);
      return false;   // false = action consommée (le bloc tenu n'est pas posé)
    });
  },
});

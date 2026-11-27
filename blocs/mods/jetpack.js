/* ===== Mod d'exemple « Réacteur dorsal » (jetpack) : un OBJET qui fait voler en survie en brûlant du charbon
   Ce fichier sert de MODÈLE pour un mod sans bloc (pas de blocs(api), seulement init(api)). Il montre :
     - un objet (id 300, dans la plage 300 à 499 réservée aux mods) avec son icône dessinée (api.addItemArt) ;
     - une recette ;
     - un hook « playerTick » (appelé à chaque image) qui lit l'état du joueur et le modifie ;
     - des particules (api.FX.burst) et un petit affichage HTML.
   Utilisation : tiens le réacteur en main (ou en main secondaire, touche F), saute puis garde Espace enfoncé.
   Chaque charbon de l'inventaire donne 6 secondes de poussée. ===== */
VX.mod({
  id: 'jetpack',
  nom: 'Réacteur dorsal',
  version: '1.0',
  auteur: 'Équipe Blocaria',
  description: 'Un réacteur à charbon pour voler en survie (tiens-le en main, saute et garde Espace enfoncé).',

  init(api) {
    const { registry: REG, I } = api, S = VX.SURV || {};
    const REACTEUR = 300, SECONDES_PAR_CHARBON = 6;

    /* ---------- l'objet, son icône, sa recette ---------- */
    REG.item(REACTEUR, 'Réacteur dorsal', null, { stack: 1 });
    api.addItemArt(REACTEUR, [
      '................',
      '...kk......kk...',
      '..kMMk....kMMk..',
      '..kMmkkkkkkMmk..',
      '..kMmkbbbbkMmk..',
      '..kMmkbbbbkMmk..',
      '..kMmkbggbkMmk..',
      '..kMmkbbbbkMmk..',
      '..kMmkkkkkkMmk..',
      '..kMmk....kMmk..',
      '..kMmk....kMmk..',
      '..kkkk....kkkk..',
      '...oo......oo...',
      '...yo......oy...',
      '....o......o....',
      '................',
    ], { k: '#3a3a42', M: '#e8e8ee', m: '#9a9aa2', b: '#6a4c2a', g: '#ffd23a', o: '#ff8a2a', y: '#ffe14a' });
    REG.shaped(['FCF', 'FOF', 'P P'], { F: I.L_FER, C: I.CHARBON, O: I.L_OR, P: S.POUDRE || I.CHARBON }, REACTEUR);
    REG.creative(REACTEUR);

    /* ---------- touche Espace (on suit nous-mêmes la touche, sans dépendre du moteur) ---------- */
    let espace = false;
    document.addEventListener('keydown', e => { if (e.code === 'Space' && !(VX.UI && VX.UI.chatOpen)) espace = true; });
    document.addEventListener('keyup', e => { if (e.code === 'Space') espace = false; });
    window.addEventListener('blur', () => { espace = false; });

    /* ---------- jauge à l'écran (seulement quand le réacteur est en main) ---------- */
    const jauge = document.createElement('div');
    jauge.style.cssText = 'position:fixed;left:12px;bottom:86px;padding:4px 8px;background:rgba(0,0,0,.55);color:#ffe9b0;font:12px monospace;border:1px solid rgba(255,255,255,.25);pointer-events:none;z-index:25;display:none';
    document.body.appendChild(jauge);

    let reserve = 0, avertiT = 0, flammeT = 0, txt = '';
    const charbons = G => G.inv.reduce((n, s) => n + (s && s.id === I.CHARBON ? s.n : 0), 0);
    function bruler(G) {   // retire un charbon de l'inventaire
      for (let i = 0; i < G.inv.length; i++) { const s = G.inv[i]; if (s && s.id === I.CHARBON) { s.n--; if (s.n <= 0) G.inv[i] = null; VX.UI.hud(); return true; } }
      return false;
    }

    api.hooks.on('playerTick', ({ dt, player: P }) => {
      const G = api.G, UI = api.ui, tenu = G.inv[G.sel], enMain = (tenu && tenu.id === REACTEUR) || (G.offhand && G.offhand.id === REACTEUR);
      avertiT -= dt;
      // affichage de la jauge
      const t = enMain ? 'Réacteur : ' + reserve.toFixed(1) + ' s · ' + charbons(G) + ' charbon(s)' : '';
      if (t !== txt) { txt = t; jauge.textContent = t; jauge.style.display = t ? 'block' : 'none'; }
      if (!enMain || G.mode !== 'survie' || P.hp <= 0 || P.onGround || P.inWater || !espace || UI.open || UI.menuOpen || UI.chatOpen) return;
      // carburant : un charbon = 6 secondes
      if (reserve <= 0) {
        if (bruler(G)) reserve += SECONDES_PAR_CHARBON;
        else { if (avertiT <= 0) { UI.toast('Le réacteur n\'a plus de charbon !'); avertiT = 3; } return; }
      }
      reserve = Math.max(0, reserve - dt);
      // poussée : plus forte que la gravité (30), vitesse de montée limitée ; pas de dégâts de chute pendant le vol
      P.vel.y = Math.min(P.vel.y + 42 * dt, 6.5);
      P.fallTop = P.pos.y;
      P.exh += dt * 0.05;
      // flammes et fumée dans le dos du joueur
      if ((flammeT -= dt) <= 0 && api.FX) {
        flammeT = 0.035;
        const bx = P.pos.x + Math.sin(P.yaw) * 0.32, bz = P.pos.z + Math.cos(P.yaw) * 0.32, by = P.pos.y + 0.75;
        api.FX.burst(bx, by, bz, 2, [1, 0.55 + Math.random() * 0.35, 0.12], { speed: 0.8, up: -5, grav: 2, life: 0.35, spread: 0.18 });
        if (Math.random() < 0.4) api.FX.burst(bx, by - 0.3, bz, 1, [0.4, 0.4, 0.42], { smoke: true, speed: 0.6, up: -1.5, grav: -0.6, life: 0.9, spread: 0.2 });
      }
    });
  },
});

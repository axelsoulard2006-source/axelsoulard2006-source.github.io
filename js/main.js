/* ===== main.js : démarrage ===== */
(function () {
  const BR = window.BR;
  window.addEventListener('error', e => console.error('Erreur :', e.message, e.filename + ':' + e.lineno));

  async function boot() {
    if (!window.THREE) { document.body.innerHTML = '<p style="color:#fff;padding:40px;font:16px sans-serif">Fichier lib/three.min.js introuvable : vérifie que le dossier du jeu est complet.</p>'; return; }
    BR.UI.show('boot');
    BR.UI.bootProgress(0.1, 'Profil…');
    await BR.Account.init();
    BR.UI.bootProgress(0.15, 'Personnages et décors 3D…');
    try { await BR.Assets.load(k => BR.UI.bootProgress(0.15 + k * 0.1)); } catch (e) { console.warn(e); }
    BR.UI.init();
    BR.UI.bootProgress(0.25, 'Réveil des entités…');
    BR.Net.connect().catch(() => {});        // le serveur gratuit peut dormir : réveil en arrière-plan
    try { await BR.Ent.init(); } catch (e) { console.warn(e); }
    BR.UI.bootProgress(0.5, 'Cris et musiques…');
    try { await BR.Audio.loadSamples(); } catch (e) { console.warn(e); }
    BR.UI.bootProgress(0.75, 'Construction des étages…');
    await BR.sleep(30);
    try { BR.MenuBG.start(); } catch (e) { console.warn(e); }
    BR.UI.bootProgress(1, 'Prêt.');
    BR.UI.bootReady(() => BR.UI.show('hub'));
    // yeux et bouches des entités (détection en arrière-plan, résultat mis en cache)
    BR.Faces.run().catch(() => {});
    // miniatures 3D des niveaux : calculées une fois en tâche de fond, puis gardées en mémoire du navigateur
    if (BR.Thumbs) setTimeout(() => { try { BR.Thumbs.warm(); } catch (e) { console.warn(e); } }, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

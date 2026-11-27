/* ===== hooks.js : évènements du jeu pour greffer des fonctionnalités sans toucher au moteur
   VX.hooks.on('blockBreak', ({ x, y, z, id, dim, player }) => …)
   évènements : blockBreak, blockPlace, playerTick ({ dt, player }), renderFrame ({ dt, time, scene, camera }),
                dimensionChange ({ from, to }), itemPickup ({ id, n }), craft ({ id, n }),
                worldSet ({ dim, x, y, z, id, old }) : tout changement de bloc (joueur, portail, réseau…)
   Un écouteur qui renvoie false sur blockBreak / blockPlace annule l'action. ===== */
(function () {
  const VX = window.VX, L = {};
  VX.hooks = {
    on(evt, fn) { (L[evt] = L[evt] || []).push(fn); return () => this.off(evt, fn); },
    off(evt, fn) { const a = L[evt]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    emit(evt, data) { const a = L[evt]; if (!a) return true; let ok = true; for (const fn of a.slice()) { try { if (fn(data) === false) ok = false; } catch (e) { console.error('[hook ' + evt + ']', e); } } return ok; },
  };
})();

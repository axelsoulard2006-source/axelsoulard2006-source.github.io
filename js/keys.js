/* ===== keys.js : touches configurables (Colosses / L'Ascension, village, Backrooms) =====
   Chaque action a jusqu'à 2 touches (codes physiques KeyboardEvent.code : ZQSD en AZERTY = WASD en QWERTY).
   Les choix sont gardés sur l'ordinateur (BR.store 'br_keys').
     BR.Keys.is(action, code)        cette touche déclenche-t-elle l'action ?
     BR.Keys.held(keysMap, action)   une des touches de l'action est-elle enfoncée ?
     BR.Keys.canon(code, ctx)        traduit une touche vers le code « par défaut » de son action (pour le code existant)
     BR.Keys.label(action)           texte à afficher (« A », « Espace », « Maj »…)
     BR.Keys.set(action, i, code) · BR.Keys.reset() */
(function () {
  const BR = window.BR;
  const ACTIONS = [
    { id: 'up', g: 'Déplacement', n: 'Avancer', def: ['KeyW', 'ArrowUp'], ctx: 'avb' },
    { id: 'down', g: 'Déplacement', n: 'Reculer', def: ['KeyS', 'ArrowDown'], ctx: 'avb' },
    { id: 'left', g: 'Déplacement', n: 'Aller à gauche', def: ['KeyA', 'ArrowLeft'], ctx: 'avb' },
    { id: 'right', g: 'Déplacement', n: 'Aller à droite', def: ['KeyD', 'ArrowRight'], ctx: 'avb' },
    { id: 'jump', g: 'Déplacement', n: 'Sauter (Colosses)', def: ['Space', null], ctx: 'av' },
    { id: 'dash', g: 'Déplacement', n: 'Esquiver (combat) / courir (village)', def: ['ShiftLeft', 'ShiftRight'], ctx: 'av' },
    { id: 'sk1', g: 'Combat', n: 'Pouvoir 1', def: ['KeyQ', null], ctx: 'a' },
    { id: 'sk2', g: 'Combat', n: 'Pouvoir 2', def: ['KeyE', null], ctx: 'a' },
    { id: 'sk3', g: 'Combat', n: 'Pouvoir 3', def: ['KeyR', null], ctx: 'a' },
    { id: 'sk4', g: 'Combat', n: 'Pouvoir 4', def: ['KeyF', null], ctx: 'a' },
    { id: 'ult', g: 'Combat', n: 'Ultime', def: ['KeyX', null], ctx: 'a' },
    { id: 'lock', g: 'Combat', n: 'Verrouiller la cible', def: ['Tab', null], ctx: 'a' },
    { id: 'help', g: 'Combat', n: 'Afficher l\'aide', def: ['KeyH', null], ctx: 'a' },
    { id: 'interact', g: 'Village et reliques', n: 'Interagir / prendre une relique', def: ['KeyE', null], ctx: 'av' },
    { id: 'respawn', g: 'Village et reliques', n: 'Revenir au repère (Arbre-Monde)', def: ['KeyR', null], ctx: 'v' },
    { id: 'chat', g: 'Village et reliques', n: 'Discuter', def: ['Enter', 'NumpadEnter'], ctx: 'v' },
    { id: 'em1', g: 'Village et reliques', n: 'Émote : salut', def: ['Digit1', 'Numpad1'], ctx: 'v' },
    { id: 'em2', g: 'Village et reliques', n: 'Émote : danse', def: ['Digit2', 'Numpad2'], ctx: 'v' },
    { id: 'em3', g: 'Village et reliques', n: 'Émote : rire', def: ['Digit3', 'Numpad3'], ctx: 'v' },
    { id: 'em4', g: 'Village et reliques', n: 'Émote : bravo', def: ['Digit4', 'Numpad4'], ctx: 'v' },
    { id: 'b_run', g: 'Backrooms', n: 'Courir', def: ['ShiftLeft', 'ShiftRight'], ctx: 'b' },
    { id: 'b_jump', g: 'Backrooms', n: 'Sauter / remonter dans l\'eau', def: ['Space', null], ctx: 'b' },
    { id: 'b_crouch', g: 'Backrooms', n: 'S\'accroupir (en courant : glissade)', def: ['KeyC', 'ControlLeft'], ctx: 'b' },
    { id: 'b_dash', g: 'Backrooms', n: 'Dash (aussi clic droit)', def: ['KeyQ', null], ctx: 'b' },
    { id: 'b_use', g: 'Backrooms', n: 'Interagir (maintenir)', def: ['KeyE', null], ctx: 'b' },
    { id: 'b_flash', g: 'Backrooms', n: 'Lampe', def: ['KeyF', null], ctx: 'b' },
    { id: 'b_ping', g: 'Backrooms', n: 'Marquer un endroit', def: ['KeyV', null], ctx: 'b' },
    { id: 'b_cam', g: 'Backrooms', n: 'Vue 3e personne', def: ['KeyH', null], ctx: 'b' },
  ];
  // touches qui peuvent volontairement servir à deux actions (contextes différents ou priorité claire)
  const SHARE = [['sk2', 'interact'], ['sk3', 'respawn']];
  const A = {}; ACTIONS.forEach(a => { A[a.id] = a; });
  let map = {};
  function load() {
    map = {};
    let saved = null; try { saved = BR.store ? BR.store.get('br_keys', null) : JSON.parse(localStorage.getItem('br_keys') || 'null'); } catch (e) { saved = null; }
    ACTIONS.forEach(a => {
      const s = saved && Array.isArray(saved[a.id]) ? saved[a.id] : null;
      map[a.id] = [0, 1].map(i => s ? (typeof s[i] === 'string' && s[i].length < 32 ? s[i] : null) : a.def[i]);
    });
  }
  function save() { try { if (BR.store) BR.store.set('br_keys', map); else localStorage.setItem('br_keys', JSON.stringify(map)); } catch (e) {} }
  load();

  const K = BR.Keys = { ACTIONS };
  K.get = id => (map[id] || []).filter(Boolean);
  K.is = (id, code) => !!code && (map[id] || []).includes(code);
  K.held = (keys, id) => (map[id] || []).some(c => c && keys[c]);
  K.actionsOf = code => ACTIONS.filter(a => K.is(a.id, code)).map(a => a.id);
  // pour le code existant qui teste des codes fixes (V.keys.KeyW, e.code === 'Space'…) : on traduit la touche appuyée
  // vers le premier code par défaut de son action ; une touche par défaut qui n'est plus attribuée est neutralisée
  K.canon = function (code, ctx) {
    for (const a of ACTIONS) if (a.ctx.includes(ctx) && K.is(a.id, code)) return a.def[0];
    for (const a of ACTIONS) if (a.ctx.includes(ctx) && a.def.includes(code)) return '_' + code;
    return code;
  };
  const NAMES = { Space: 'Espace', ShiftLeft: 'Maj', ShiftRight: 'Maj D', ControlLeft: 'Ctrl', ControlRight: 'Ctrl D', AltLeft: 'Alt', AltRight: 'Alt Gr', Tab: 'Tab', Enter: 'Entrée', NumpadEnter: 'Entrée (pavé)',
    Backspace: 'Retour', CapsLock: 'Verr. maj', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Échap', Delete: 'Suppr', Insert: 'Inser', Home: 'Début', End: 'Fin', PageUp: 'Pg ↑', PageDown: 'Pg ↓' };
  K.name = code => {
    if (!code) return '—';
    if (NAMES[code]) return NAMES[code];
    if (/^Numpad\d$/.test(code)) return 'Pavé ' + code.slice(6);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (BR.ARENA && BR.ARENA.key && /^Key[A-Z]$/.test(code)) return BR.ARENA.key(code);
    return code.replace(/^Key/, '');
  };
  K.label = id => K.name(K.get(id)[0]);
  K.set = function (id, i, code) {
    if (!map[id]) return;
    map[id][i] = code || null;
    if (!map[id][0] && map[id][1]) { map[id][0] = map[id][1]; map[id][1] = null; }
    save(); K.onChange && K.onChange();
  };
  K.reset = function () { ACTIONS.forEach(a => { map[a.id] = a.def.slice(); }); save(); K.onChange && K.onChange(); };
  // conflits : une même touche pour deux actions qui peuvent servir en même temps
  K.conflicts = function () {
    const out = new Set(), shareOk = (x, y) => SHARE.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
    ACTIONS.forEach((a, i) => ACTIONS.slice(i + 1).forEach(b => {
      const ctxOverlap = [...a.ctx].some(c => b.ctx.includes(c)); if (!ctxOverlap || shareOk(a.id, b.id)) return;
      K.get(a.id).forEach(c => { if (K.is(b.id, c)) { out.add(a.id + '|' + c); out.add(b.id + '|' + c); } });
    }));
    return out;
  };
})();

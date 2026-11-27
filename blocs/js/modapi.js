/* ===== modapi.js : cœur du système de mods (sans DOM : chargé AUSSI par le Worker, juste après registry.js)
   Un mod est un fichier blocs/mods/<id>.js qui appelle :
     VX.mod({ id, nom, version, auteur, description,
              blocs(api) { … },   // contenu « monde » : blocs (VX.registry.block) et tuiles — tourne aussi dans le Worker
              init(api)  { … } }) // thread principal seulement : objets, recettes, hooks, commandes, interface
   Ici : enregistrement du mod, registre « surveillé » (plages d'ids réservées, conflits), exécution de blocs(api).
   Le thread principal (mods.js) complète l'api (tuiles, icônes, commandes, hooks protégés…) et lance init(api).
   Plages réservées aux mods : blocs 64 à 99, objets 300 à 499. ===== */
(function () {
  const VX = self.VX;
  const RANGE = { bloc: [64, 99], objet: [300, 499] };
  const inWorker = typeof document === 'undefined';
  const M = VX.Mods = VX.Mods || {};
  Object.assign(M, {
    RANGE, inWorker,
    list: [],            // définitions des mods chargés (dans l'ordre)
    byId: {},
    owner: { bloc: {}, objet: {} },   // id -> id du mod qui l'a déclaré
    problems: [],        // conflits et refus (affichés dans l'écran Mods / la console)
    pendingTiles: [],    // tuiles dessinées avant la création de l'atlas (textures.js les dessine)
    current: null,       // mod en cours de chargement (pour attribuer les erreurs)
  });
  // complété par mods.js sur le thread principal : (api, def) => void
  M.extendApi = M.extendApi || null;
  // appelé par mods.js quand un mod plante (thread principal) ; dans le Worker : simple avertissement
  M.fail = M.fail || function (def, phase, err) { console.warn('[mod ' + (def && def.id) + '] ' + phase + ' :', err); };

  function problem(def, msg) {
    const txt = '[' + def.id + '] ' + msg; M.problems.push(txt);
    console.warn('[Mods] ' + txt);
  }

  /* ---------- registre surveillé : vérifie les plages d'ids et refuse les conflits ---------- */
  function guardedRegistry(def) {
    const REG = VX.registry;
    const check = (kind, id) => {
      const [a, b] = RANGE[kind];
      if (!Number.isInteger(id) || id < a || id > b) { problem(def, kind + ' ' + id + ' refusé : les mods doivent utiliser les ids ' + a + ' à ' + b + '.'); return false; }
      const own = M.owner[kind][id];
      const taken = kind === 'bloc' ? VX.BLOCKS[id] && !VX.BLOCKS[id].modPlaceholder : VX.ITEMS[id];
      if (taken && own !== def.id) { problem(def, kind + ' ' + id + ' refusé : déjà pris par ' + (own ? 'le mod « ' + own + ' »' : 'le jeu') + '.'); return false; }
      M.owner[kind][id] = def.id; return true;
    };
    return {
      // tex : nom d'une tuile (même tuile sur toutes les faces) ou { top, side, bottom, front }
      block(id, name, tex, opts) { if (!check('bloc', id)) return null; const b = REG.block(id, name, tex, opts); b.mod = def.id; return b; },
      item(id, name, icon, opts) { if (!check('objet', id)) return null; const it = REG.item(id, name, icon || ('mod_' + id), opts); it.mod = def.id; return it; },
      shaped: (rows, keys, out, n) => REG.shaped(rows, keys, out, n),
      shapeless: (items, out, n) => REG.shapeless(items, out, n),
      smelt: (input, output) => REG.smelt(input, output),
      fuel: (id, seconds) => REG.fuel(id, seconds),
      creative: id => REG.creative(id),
      raw: REG,   // le registre d'origine (à éviter : pas de contrôle des ids)
    };
  }

  /* ---------- api de base (Worker et thread principal) ---------- */
  function baseApi(def) {
    const api = {
      mod: def, registry: guardedRegistry(def), B: VX.B, I: VX.I, BLOCKS: VX.BLOCKS, ITEMS: VX.ITEMS, worker: inWorker,
      log: (...a) => console.log('[mod ' + def.id + ']', ...a),
      // dans le Worker, les tuiles ne servent à rien (l'atlas vient du thread principal) : on les ignore
      addTile() {}, addItemArt() {}, command() {},
    };
    if (M.extendApi) M.extendApi(api, def);
    return api;
  }

  /* ---------- VX.mod : point d'entrée des fichiers de mods ---------- */
  VX.mod = function (def) {
    if (!def || typeof def !== 'object' || !/^[a-z0-9][a-z0-9_-]{0,40}$/.test(def.id || '')) { console.warn('[Mods] VX.mod : il faut un objet avec un « id » (minuscules, chiffres, - ou _).', def); return; }
    if (M.byId[def.id]) { console.warn('[Mods] mod « ' + def.id + ' » déclaré deux fois : ignoré.'); return; }
    def.nom = def.nom || def.id; def.version = String(def.version || '1.0'); def.ok = true;
    M.list.push(def); M.byId[def.id] = def;
    def.api = baseApi(def);   // même objet api pour blocs() et init()
    if (typeof def.blocs === 'function') {
      M.current = def;
      try { def.blocs(def.api); }
      catch (e) { def.ok = false; M.fail(def, 'blocs', e); }
      finally { M.current = null; }
    }
  };

  /* ---------- blocs inconnus : un monde garde les ids d'un mod désactivé -> bloc « ? » visible et cassable ---------- */
  M.placeholders = function () {
    for (let id = RANGE.bloc[0]; id <= RANGE.bloc[1]; id++) if (!VX.BLOCKS[id]) {
      VX.registry.block(id, 'Bloc de mod inconnu (#' + id + ')', 'mod_inconnu', { hard: 0.5, drop: null });
      VX.BLOCKS[id].modPlaceholder = true;
    }
  };
})();

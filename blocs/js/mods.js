/* ===== mods.js : chargeur de mods (thread principal), chargé juste après modapi.js
   1. Lit la liste des mods activés (localStorage « blocaria_mods ») et insère leurs <script> tout de suite
      (document.write pendant le chargement de la page : ils s'exécutent AVANT textures.js et world.js,
      donc leurs blocs et leurs tuiles existent avant l'atlas et avant le premier maillage).
   2. Complète l'api des mods : addTile, addItemArt, command, hooks protégés, G, R, ui, log.
   3. VX.Mods.initAll() (appelé à la fin d'index.html) lance init(api) de chaque mod.
   Un mod qui plante (erreur de syntaxe, exception dans blocs / init / un hook / une commande) est désactivé
   (retiré de la liste, message conservé pour l'écran Mods) sans casser le jeu. ===== */
(function () {
  const VX = window.VX, M = VX.Mods;
  const KEY = 'blocaria_mods', ERR_KEY = 'blocaria_mods_err', V = '9';
  const okId = s => typeof s === 'string' && /^[a-z0-9][a-z0-9_-]{0,40}$/.test(s);
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // liste des mods activés par le joueur (ids = noms de fichiers sans .js)
  M.enabled = () => lsGet(KEY, []).filter(okId);
  M.setEnabled = ids => lsSet(KEY, [...new Set(ids.filter(okId))]);
  M.errors = () => lsGet(ERR_KEY, {});
  M.clearError = id => { const e = M.errors(); delete e[id]; lsSet(ERR_KEY, e); };
  M.messages = [];   // messages à montrer au joueur une fois le jeu lancé
  const wanted = M.enabled();
  M.wanted = wanted;

  /* ---------- désactivation d'un mod qui plante ---------- */
  const offs = {};   // id du mod -> fonctions qui retirent ses hooks / commandes
  M.fail = function (def, phase, err) {
    const id = def && def.id; if (!id) return;
    const msg = (err && err.message) || String(err);
    console.error('[Mods] le mod « ' + id + ' » a planté (' + phase + ') :', err);
    if (def.ok === false && def.failed) return;   // déjà traité
    def.ok = false; def.failed = phase;
    for (const f of offs[id] || []) { try { f(); } catch (e) {} } offs[id] = [];
    M.setEnabled(M.enabled().filter(x => x !== id));
    const errs = M.errors(); errs[id] = phase + ' : ' + msg.slice(0, 200); lsSet(ERR_KEY, errs);
    const txt = 'Le mod « ' + (def.nom || id) + ' » a planté (' + phase + ') et a été désactivé : ' + msg;
    M.messages.push(txt);
    if (VX.UI && VX.UI.toast && M.started) { VX.UI.toast(txt); VX.UI.say && VX.UI.say(txt, 'err'); }
  };

  /* ---------- api complète (thread principal) ---------- */
  M.commands = {};   // nom -> { fn, def, aide }
  M.extendApi = function (api, def) {
    const reg = f => (offs[def.id] = offs[def.id] || []).push(f);
    // addTile(nom, palette, 16 lignes de 16 caractères) : ' ' = transparent ; avant OU après la création de l'atlas
    api.addTile = (name, pal, rows) => {
      if (typeof name !== 'string' || !pal || !Array.isArray(rows)) { console.warn('[mod ' + def.id + '] addTile(nom, palette, lignes) : paramètres invalides'); return; }
      if (VX.TEX && VX.TEX.addTile) VX.TEX.addTile(name, pal, rows); else M.pendingTiles.push({ name, pal, rows, mod: def.id });
    };
    // addItemArt(id, lignes, palette) : icône 16×16 d'un objet ('.' ou absent de la palette = transparent)
    api.addItemArt = (id, rows, pal) => {
      const r = rows.map(s => (String(s) + '................').slice(0, 16)); while (r.length < 16) r.push('................');
      VX.itemArt = VX.itemArt || {}; VX.itemArt[id] = [r, pal]; if (VX.iconReset) VX.iconReset(id);
    };
    // command('vendre', (args, ctx) => …) : commande /vendre du chat (ctx.say(texte, 'ok'|'err'))
    api.command = (name, fn, aide) => {
      name = String(name || '').replace(/^\//, '').toLowerCase();
      if (!name || typeof fn !== 'function') return;
      if (M.commands[name] && M.commands[name].def !== def) { console.warn('[Mods] commande /' + name + ' déjà prise par « ' + M.commands[name].def.id + ' »'); return; }
      M.commands[name] = { fn, def, aide: aide || '' }; reg(() => { if (M.commands[name] && M.commands[name].def === def) delete M.commands[name]; });
    };
    // hooks protégés : une exception dans un écouteur désactive le mod (au lieu de répéter l'erreur à chaque image)
    api.hooks = {
      on(evt, fn) {
        const w = data => { if (def.ok === false) return; try { return fn(data); } catch (e) { M.fail(def, 'hook ' + evt, e); } };
        VX.hooks.on(evt, w); const off = () => VX.hooks.off(evt, w); reg(off); return off;
      },
      off: (evt, fn) => VX.hooks.off(evt, fn),
      emit: (evt, data) => VX.hooks.emit(evt, data),
    };
    // G et R n'existent qu'après main.js / renderer.js : accès paresseux
    Object.defineProperty(api, 'G', { get: () => VX.G, enumerable: true });
    Object.defineProperty(api, 'R', { get: () => VX.R, enumerable: true });
    Object.defineProperty(api, 'ui', { get: () => VX.UI, enumerable: true });
    Object.defineProperty(api, 'FX', { get: () => VX.FX, enumerable: true });
    api.toast = t => VX.UI && VX.UI.toast(t);
    api.say = (t, kind) => VX.UI && VX.UI.say(t, kind);
    api.every = (sec, fn) => { let t = 0; return api.hooks.on('playerTick', e => { t += e.dt; if (t >= sec) { t = 0; fn(e); } }); };
  };

  /* ---------- tuile des blocs de mods inconnus (damier violet) ---------- */
  M.pendingTiles.push({ name: 'mod_inconnu', pal: { a: '#c040c0', b: '#201020', w: '#ffffff' }, rows: ['aaaaaaaabbbbbbbb', 'aaaaaaaabbbbbbbb', 'aaaaaaaabbbbbbbb', 'aaaaawwwwwwbbbbb', 'aaaawwaaabwwbbbb', 'aaaaaaaabbwwbbbb', 'aaaaaaaabwwbbbbb', 'aaaaaaaawwbbbbbb', 'bbbbbbbwwaaaaaaa', 'bbbbbbbwwaaaaaaa', 'bbbbbbbbbaaaaaaa', 'bbbbbbbwwaaaaaaa', 'bbbbbbbwwaaaaaaa', 'bbbbbbbbaaaaaaaa', 'bbbbbbbbaaaaaaaa', 'bbbbbbbbaaaaaaaa'] });

  /* ---------- chargement des fichiers : erreurs de syntaxe / d'exécution attrapées par fichier ---------- */
  const loadErr = {};
  window.addEventListener('error', e => {
    const f = String(e.filename || ''), m = f.match(/\/mods\/([a-z0-9_-]+)\.js/);
    if (m) { loadErr[m[1]] = e.message || 'erreur'; e.preventDefault && e.preventDefault(); }
  }, true);
  M._missing = id => { loadErr[id] = loadErr[id] || 'fichier introuvable (mods/' + id + '.js)'; };
  if (wanted.length && document.readyState === 'loading') {
    let html = '';
    for (const id of wanted) html += '<script src="mods/' + id + '.js?v=' + V + '" onerror="VX.Mods._missing(\'' + id + '\')"><\/script>';
    html += '<script>VX.Mods.afterLoad()<\/script>';
    document.write(html);
  }

  // juste après les fichiers des mods (avant textures.js) : contrôle, puis blocs « inconnus » pour les ids libres
  M.afterLoad = function () {
    for (const id of wanted) {
      const def = M.byId[id];
      if (loadErr[id] || !def) M.fail(def || { id, nom: id }, 'chargement', new Error(loadErr[id] || 'le fichier n\'appelle pas VX.mod({ id: \'' + id + '\', … })'));
      else if (def.id !== id) M.fail(def, 'chargement', new Error('id « ' + def.id + ' » différent du nom du fichier'));
    }
    M.placeholders();
  };
  if (!wanted.length) M.placeholders();

  // mods effectivement chargés et sains (envoyés au Worker et à l'hôte multijoueur)
  M.active = () => M.list.filter(d => d.ok !== false && wanted.includes(d.id));
  M.workerQuery = () => { const ids = M.active().map(d => d.id); return ids.length ? '&mods=' + ids.join(',') : ''; };
  M.summary = () => M.active().map(d => ({ id: d.id, nom: d.nom, version: d.version }));

  /* ---------- init(api) de chaque mod : à la fin du chargement de la page (VX.G, VX.R, VX.UI existent) ---------- */
  M.initAll = function () {
    const G = VX.G;
    // commandes des mods dans le chat (les commandes du jeu restent prioritaires sauf /aide qu'on complète)
    if (G && G.command && !G.command._mods) {
      const orig = G.command;
      G.command = function (txt) {
        const t = String(txt || '').trim();
        if (t[0] === '/') {
          const [cmd, ...args] = t.slice(1).split(/\s+/), c = M.commands[(cmd || '').toLowerCase()];
          if (c) {
            const ctx = { say: (s, k) => VX.UI.say(s, k || 'ok'), raw: t, G: VX.G };
            try { c.fn(args, ctx); } catch (e) { M.fail(c.def, 'commande /' + cmd, e); }
            return;
          }
          if ((cmd === 'aide' || cmd === '?') && Object.keys(M.commands).length) {
            orig.call(this, txt);
            VX.UI.say('Commandes des mods : ' + Object.keys(M.commands).map(k => '/' + k + (M.commands[k].aide ? ' ' + M.commands[k].aide : '')).join(' · '), 'ok');
            return;
          }
        }
        return orig.call(this, txt);
      };
      G.command._mods = true;
    }
    for (const def of M.active()) {
      if (typeof def.init !== 'function') continue;
      try { def.init(def.api); } catch (e) { M.fail(def, 'init', e); }
    }
    M.started = true;
    // messages (mods désactivés) : affichés quand l'interface est prête
    const show = () => { for (const t of M.messages) { VX.UI.toast(t); VX.UI.say(t, 'err'); } };
    if (M.messages.length) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(show, 600)); else setTimeout(show, 600); }
    const act = M.active(); if (act.length) console.log('[Mods] actifs : ' + act.map(d => d.id + ' ' + d.version).join(', '));
  };
})();

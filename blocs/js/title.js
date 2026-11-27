/* ===== title.js : écran titre de Blocaria
   Remplace l'écran d'aide du premier lancement et le menu Pause (UI.menu('aide') / UI.menu('pause')).
   Le monde tourne lentement en fond (la caméra pivote via le hook renderFrame tant que le titre est affiché),
   logo « BLOCARIA » en relief, boutons de pierre texturés, sous-pages Options / Multijoueur / Monde / Aide.
   Toutes les actions passent par G.menuAction (mêmes actions que l'ancien menu Pause). ===== */
(function () {
  const VX = window.VX, UI = VX.UI; if (!UI || !UI.menu) return;
  const orig = UI.menu;
  let shown = false, kindNow = null, page = 'main', box = null, ang = 0, lift = 0, liftT = 0, tipI = 0;
  const lib = () => UI._lib || { esc: s => String(s), sfx: () => {} };

  // conseils qui défilent sous les boutons
  const TIPS = [
    'Un coffre posé à côté d\'un autre forme un grand coffre de 54 cases.',
    'Le livre de recettes (bouton vert) remplit la grille pour toi.',
    'La nuit, les créatures hostiles sortent : construis un abri avant le coucher du soleil.',
    'Sous l\'eau, surveille tes bulles d\'oxygène.',
    'Un cadre d\'obsidienne allumé ouvre un passage vers les Braises.',
    'Maj + clic range un objet d\'un seul geste.',
    'F3 affiche les informations de débogage, F7 les réglages des shaders.',
    'Survole une case et appuie sur 1-9 pour l\'envoyer dans la barre rapide.',
  ];

  UI.menu = function (kind) {
    if (kind === 'aide' || kind === 'pause') { show(kind); return; }
    hide(); orig.call(UI, kind);
  };

  function show(kind) {
    const G = VX.G; if (!G) return;
    orig.call(UI, null);                  // ferme l'ancien panneau de menu
    UI.menuOpen = kind; kindNow = kind;
    document.exitPointerLock && document.exitPointerLock();
    UI.closeChat && UI.closeChat(); UI.hideTip && UI.hideTip();
    if (!shown) { shown = true; page = 'main'; ang = 0; tipI = Math.floor(Math.random() * TIPS.length); computeLift(); }
    document.body.classList.add('title-on');
    if (!box) { box = document.createElement('div'); box.className = 'title'; document.body.appendChild(box); }
    box.style.display = 'flex';
    render();
  }
  function hide() {
    if (!shown) return; shown = false; kindNow = null;
    document.body.classList.remove('title-on'); if (box) box.style.display = 'none';
  }
  // caméra un peu plus haute si la place est libre au-dessus du joueur
  function computeLift() {
    const G = VX.G, P = G.player, w = G.world; lift = 0; if (!w) return;
    for (let dy = 1; dy <= 4; dy++) { const id = w.get(Math.floor(P.pos.x), Math.floor(P.eye + dy), Math.floor(P.pos.z)); const b = VX.BLOCKS[id]; if (b && b.solid) break; lift = dy - 0.5; }
  }

  const btn = (label, a, cls) => `<button class="btn${cls ? ' ' + cls : ''}" ${a}>${label}</button>`;
  function render() {
    const G = VX.G, esc = lib().esc, MP = VX.MP, first = kindNow === 'aide';
    const logo = `<div class="logo">${[...'BLOCARIA'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</div><div class="tsub">Bac à sable de blocs · <i>Surface</i> et <i>Braises</i></div>`;
    let body = '';
    if (page === 'main') {
      body = `<div class="tmenu">
        ${btn(first ? 'Jouer' : 'Reprendre la partie', 'data-a="play"', 'big green')}
        <div class="pair">${btn('Options', 'data-p="options"')}${btn('Multijoueur', 'data-p="multi"')}</div>
        <div class="pair">${btn('Shaders', 'data-a="shaders"' + (VX.Shaders ? '' : ' disabled'))}${btn('Monde', 'data-p="monde"')}</div>
        <div class="pair">${btn('Mods', 'data-p="mods"')}${btn('Aide', 'data-p="aide"')}</div>
        ${btn('Retour au site', 'data-a="quit"')}
      </div><div class="ttip">${first ? 'Première partie ? Jette un œil à l\'aide avant de te lancer.' : esc(TIPS[tipI % TIPS.length])}</div>`;
    } else if (page === 'options') {
      const A = VX.Audio, vol = (k, label) => A ? `<label class="dist">${label} <input type="range" data-vol="${k}" min="0" max="1" step="0.05" value="${A.vol[k]}"></label>` : '';
      body = `<div class="tpanel"><h2>Options</h2>
        <div class="row">${btn('Mode : ' + (G.mode === 'creatif' ? 'Créatif' : 'Survie'), 'data-a="mode"')}${btn('Rendu : ' + (VX.fastMesh ? 'Rapide' : 'Beau'), 'data-a="gfx"')}</div>
        <div class="row">${btn('Shaders (F7)', 'data-a="shaders"' + (VX.Shaders ? '' : ' disabled'))}</div>
        <div class="row"><label class="dist">Distance de vue <input type="range" class="vd" min="2" max="7" step="1" value="${G.R}"> <b class="vdv">${G.R}</b></label></div>
        <div class="row">${vol('music', 'Musique')}${vol('sfx', 'Effets')}</div>
        <div class="row">${btn('Retour', 'data-p="main"')}</div></div>`;
    } else if (page === 'multi') {
      const on = MP && MP.on;
      body = `<div class="tpanel"><h2>Multijoueur</h2>
        ${on ? `<p>Salon ouvert</p><p class="code">${esc(MP.room.code)}</p><p>${MP.room.players.length} joueur(s)${MP.host ? ' · donne ce code à tes potes' : ''}</p>
          <p class="small">${MP.room.players.map(p => esc(p.name) + (p.id === MP.room.host ? ' ★' : '') + (p.id === MP.id ? ' (toi)' : '')).join(' · ')}</p>
          <div class="row">${MP.host ? btn('JcJ : ' + (MP.pvp ? 'activé' : 'désactivé'), 'data-a="mppvp"') : `<p class="small">JcJ : ${MP.pvp ? 'activé' : 'désactivé'} (choix de l'hôte)</p>`}</div>
          <p class="small">Touche <b>Tab</b> en jeu : liste des joueurs · <b>T</b> : chat partagé</p>
          <div class="row">${btn('Quitter le salon', 'data-a="mpleave"', 'warn')}</div>`
        : `<p>Joue à plusieurs dans le même monde, par un salon privé.</p><div class="row">${btn('Ouvrir mon monde', 'data-a="mphost"' + (MP ? '' : ' disabled'), 'green')}${btn('Rejoindre un pote', 'data-a="mpjoin"' + (MP ? '' : ' disabled'))}</div>`}
        <div class="row">${btn('Retour', 'data-p="main"')}</div></div>`;
    } else if (page === 'monde') {
      body = `<div class="tpanel"><h2>Monde</h2><p>Graine : <b>${esc(G.seed)}</b> · ${esc(G.dimName())}</p>
        <div class="row">${btn('Sauvegarder', 'data-a="save"', 'green')}${btn('Exporter', 'data-a="export"')}${btn('Importer', 'data-a="import"')}</div>
        <div class="row">${btn('Nouveau monde', 'data-a="new"', 'warn')}</div>
        <div class="row">${btn('Retour', 'data-p="main"')}</div></div>`;
    } else if (page === 'mods') {
      body = modsPage(esc);
    } else if (page === 'aide') {
      body = `<div class="tpanel"><h2>Aide</h2><div class="keys"><b>ZQSD</b> se déplacer · <b>Espace</b> sauter / nager (2× en créatif : voler) · <b>Maj</b> s'accroupir · <b>Ctrl</b> ou <b>Z</b>×2 courir<br>
        <b>Clic gauche</b> casser / frapper · <b>Clic droit</b> poser / utiliser / manger / enfiler · <b>E</b> inventaire · <b>1-9</b> ou molette : barre rapide · <b>A</b> jeter · <b>T</b> chat (<b>/mode survie</b>, <b>/mode creatif</b>, <b>/aide</b>) · <b>F3</b> débogage · <b>F7</b> shaders</div>
        <p>Fabrique un établi (4 planches), des outils, un four, un coffre… Le livre de recettes (bouton vert à gauche de la grille) montre ce que tu peux fabriquer. La nuit, les créatures hostiles sortent : construis un abri ! Trouve de l'obsidienne, construis un cadre (4 de large, 5 de haut) et allume-le avec l'<b>allumeur</b> pour passer dans <b>les Braises</b>.</p>
        <div class="row">${btn('Retour', 'data-p="main"')}${first ? btn('Jouer', 'data-a="play"', 'green') : ''}</div></div>`;
    }
    box.innerHTML = logo + body + `<div class="tfoot"><span>Blocaria · graine ${esc(G.seed)}</span><span>${G.mode === 'creatif' ? 'Créatif' : 'Survie'} · ${esc(G.dimName())}</span></div>`;
    box.querySelectorAll('button').forEach(b => {
      b.addEventListener('mouseenter', () => lib().sfx('uihover'));
      b.addEventListener('click', () => {
        lib().sfx('uiclick');
        if (b.dataset.p) { page = b.dataset.p; render(); return; }
        if (b.dataset.mod) { toggleMod(b.dataset.mod); render(); return; }
        if (b.dataset.r === 'reload') { try { G.save(true); } catch (e) {} location.reload(); return; }
        const a = b.dataset.a; if (!a) return;
        G.menuAction(a);
        // certaines actions changent l'état sans rouvrir le menu (mode au premier lancement, salon…)
        setTimeout(() => { if (shown) render(); }, 0);
      });
    });
    const d = box.querySelector('.vd'); if (d) d.addEventListener('input', () => { G.R = +d.value; G.saveSettings(); const v = box.querySelector('.vdv'); if (v) v.textContent = d.value; });
    box.querySelectorAll('[data-vol]').forEach(r => r.addEventListener('input', () => VX.Audio && VX.Audio.setVol(r.dataset.vol, +r.value)));
  }

  /* ---------- écran « Mods » : liste de blocs/mods/liste.json, activation gardée dans localStorage ---------- */
  let modList = null, modListErr = '', modLoading = false;
  function loadModList() {
    if (modList || modLoading) return; modLoading = true;
    fetch('mods/liste.json?v=' + Date.now()).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => { modList = Array.isArray(j) ? j : (j && j.mods) || []; }).catch(e => { modListErr = 'Liste des mods illisible (' + e.message + ').'; modList = []; })
      .finally(() => { modLoading = false; if (shown && page === 'mods') render(); });
  }
  function toggleMod(id) {
    const M = VX.Mods; if (!M) return; const on = M.enabled();
    M.setEnabled(on.includes(id) ? on.filter(x => x !== id) : on.concat(id)); M.clearError(id);
  }
  function modsPage(esc) {
    const M = VX.Mods; if (!M) return '<div class="tpanel"><h2>Mods</h2><p>Système de mods indisponible.</p></div>';
    loadModList();
    const on = M.enabled(), loaded = M.active().map(d => d.id), errs = M.errors();
    const changed = on.some(id => !loaded.includes(id)) || loaded.some(id => !on.includes(id));
    const rows = (modList || []).map(m => {
      const id = String(m.id || ''), act = on.includes(id), now = loaded.includes(id), err = errs[id];
      const state = err ? `<span style="color:#ff9a8a">désactivé après un plantage : ${esc(err)}</span>` : now && act ? '<span style="color:#9cf07c">actif</span>' : act ? '<span style="color:#ffd23a">activé au prochain chargement</span>' : now ? '<span style="color:#ffd23a">désactivé au prochain chargement</span>' : '<span style="opacity:.7">inactif</span>';
      return `<div style="display:flex;gap:10px;align-items:center;margin:6px 0;padding:6px 8px;background:rgba(0,0,0,.25);border:2px solid rgba(0,0,0,.35)">
        <div style="flex:1;text-align:left"><b>${esc(m.nom || id)}</b> <span style="opacity:.7">v${esc(m.version || '1.0')} · ${esc(m.auteur || '?')}</span><br><span style="font-size:13px">${esc(m.description || '')}</span><br><span style="font-size:12px">${state}</span></div>
        ${btn(act ? 'Désactiver' : 'Activer', 'data-mod="' + esc(id) + '" style="flex:0 0 auto;min-width:110px"', act ? 'warn' : 'green')}</div>`;
    }).join('');
    const probs = M.problems.length ? `<p class="small" style="color:#ffb0a0">Conflits : ${M.problems.map(esc).join(' · ')}</p>` : '';
    return `<div class="tpanel"><h2>Mods</h2>
      <p class="small">Les mods sont des fichiers du dossier <b>blocs/mods/</b> (voir LISEZ-MOI.md).</p>
      ${modList ? (rows || '<p>Aucun mod listé dans mods/liste.json.</p>') : '<p>Chargement de la liste…</p>'}${modListErr ? `<p>${esc(modListErr)}</p>` : ''}${probs}
      ${changed ? `<p style="color:#ffd23a">Recharge la page pour appliquer les changements (ton monde est sauvegardé avant).</p><div class="row">${btn('Recharger maintenant', 'data-r="reload"', 'green')}</div>` : '<p class="small">Un changement demande de recharger la page.</p>'}
      <div class="row">${btn('Retour', 'data-p="main"')}</div></div>`;
  }

  // le monde tourne lentement derrière le titre
  if (VX.hooks) VX.hooks.on('renderFrame', ({ dt, camera }) => {
    if (!shown || !VX.G || !camera) return;
    const P = VX.G.player; ang += (dt || 0.016) * 0.045; liftT += ((lift || 0) - liftT) * Math.min(1, (dt || 0.016) * 2);
    camera.position.set(P.pos.x, P.eye + liftT, P.pos.z);
    camera.rotation.set(-0.12 + Math.sin(ang * 0.7) * 0.04, P.yaw + ang, 0, 'YXZ');
  });
  // les conseils changent toutes les 7 secondes
  setInterval(() => { if (shown && page === 'main' && kindNow !== 'aide' && box) { tipI++; const t = box.querySelector('.ttip'); if (t) t.textContent = TIPS[tipI % TIPS.length]; } }, 7000);
  // Échap sur une sous-page : retour à l'accueil du titre
  document.addEventListener('keydown', e => { if (shown && e.code === 'Escape' && page !== 'main' && !(document.getElementById('sxPanel') && document.getElementById('sxPanel').style.display === 'block')) { e.preventDefault(); page = 'main'; render(); } });

  VX.Title = { get shown() { return shown; }, page: p => { page = p; if (shown) render(); } };
})();

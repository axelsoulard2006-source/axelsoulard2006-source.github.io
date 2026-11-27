/* ===== ui.js : menus (hub, Backrooms, solo, multijoueur, salon, personnage, boutique, classement, paramètres, résultats, compte) ===== */
(function () {
  const BR = window.BR, el = BR.el, esc = BR.esc, Au = BR.Audio, N = BR.Net, Acc = BR.Account, Av = BR.Avatar;
  const UI = (BR.UI = {});
  const SCR = {};
  let cur = null, curId = '', lobbyReturn = null;
  const inGame = () => BR.Game.active || !!(BR.Arena && BR.Arena.active) || !!(BR.Doors && BR.Doors.active) || !!(BR.Asc && BR.Asc.running);
  const AR = () => BR.ARENA;
  const arenaGame = () => BR.curGame === 'arena';
  const arenaRoom = r => !!(r && AR().isArenaMap(r.map));
  // jeu 3 « LES PORTES » : salons dont la carte commence par « d_ »
  const doorsGame = () => BR.curGame === 'portes';
  const isDoorsMap = m => /^d_/.test(String(m || ''));
  // marque invisible ajoutée au nom des salons des Portes : l'ancien serveur (liste blanche de cartes)
  // remplace « d_portes » par « backrooms », mais conserve le nom du salon tel quel
  const DOOR_MARK = '⁣';
  const doorsRoom = r => !!(r && (isDoorsMap(r.map) || String(r.name || '').includes(DOOR_MARK)));
  const DD = () => BR.Doors.DIFFS;
  // jeu 4 « BOUSCULADE » : salons dont la carte commence par « p_ »
  const partyGame = () => BR.curGame === 'bousculade';
  const isPartyMap = m => /^p_/.test(String(m || ''));
  const partyRoom = r => !!(r && isPartyMap(r.map));
  const PDIFF = { id: 'normal', name: 'Fiesta', color: '#ff4f9e', desc: '2 manches : la Course d’adresse (les premiers arrivés passent), puis la Toupie (le dernier debout gagne).' };
  const gameOfRoom = r => arenaRoom(r) ? (r.map === 'a_asc' ? 'asc' : 'arena') : partyRoom(r) ? 'bousculade' : doorsRoom(r) ? 'portes' : 'backrooms';
  const curKind = () => arenaGame() ? (BR.ascMode ? 'asc' : 'arena') : partyGame() ? 'bousculade' : doorsGame() ? 'portes' : 'backrooms';
  const brandName = () => BR.curGame === 'arena' ? (BR.ascMode ? 'COLOSSES · L\'ASCENSION' : 'COLOSSES') : BR.curGame === 'portes' ? 'LES PORTES' : BR.curGame === 'bousculade' ? 'BOUSCULADE' : 'BACKROOMS';
  const ui = () => BR.$('#ui');
  const ICO = (n, sz, c) => BR.Icons.svg(n, sz, c), COIN = sz => BR.Icons.coin(sz);
  const ico = (n, sz) => el('span', { class: 'icw', html: ICO(n, sz) }), coinEl = sz => el('span', { class: 'icw', html: COIN(sz) });

  /* ================= outils ================= */
  function screen(id, def) { SCR[id] = def; }
  // choix de niveau en vignettes (miniatures 3D pour le jeu 1, couleur du boss pour Colosses)
  function mapChoices(kind) {
    if (kind === 'arena') return AR().ROOM_MAPS.map(id => { const b = AR().BOSSES.find(x => 'a_' + x.id === id); return { id, name: AR().mapLabel(id), sub: id === 'a_duel' ? 'Premier à 2 manches' : b ? b.sub : 'Surprise…', color: b ? b.color : '#ffc84a', thumb: false }; });
    return BR.MAPS.map(m => ({ id: m.id, name: m.name, sub: m.sub, color: m.color, thumb: true })).concat([{ id: 'random', name: 'Aléatoire', sub: 'Surprise…', color: '#cfc6ad', thumb: false, rnd: true }]);
  }
  function mapTiles(kind, selId, enabled) {
    return mapChoices(kind).map(m => `<button class="mtile${m.id === selId ? ' on' : ''}" ${enabled ? '' : 'disabled'} data-pick="map" data-v="${m.id}" style="--mc:${m.color}" title="${esc(m.name + ' — ' + m.sub)}">
      <span class="mt-img${m.rnd ? ' rnd' : ''}" ${m.thumb ? `data-thumb="${m.id}"` : ''}>${m.rnd ? '?' : ''}</span><span class="mt-n">${esc(m.name)}</span></button>`).join('');
  }
  function diffChips(list, selId, enabled) {
    return list.map(x => `<button class="dchip${x.id === selId ? ' on' : ''}" ${enabled ? '' : 'disabled'} data-pick="diff" data-v="${x.id}" style="--dc:${x.color}">${esc(x.name)}</button>`).join('');
  }
  function stepper(n, enabled, mx) {
    mx = mx || 8;
    return `<div class="ls-step"><button ${enabled && n > 2 ? '' : 'disabled'} data-pick="max" data-v="${n - 1}">−</button><b>${n}</b><button ${enabled && n < mx ? '' : 'disabled'} data-pick="max" data-v="${n + 1}">+</button></div>`;
  }
  function privToggle(on, enabled) {
    return `<button class="ls-tog${on ? ' on' : ''}" ${enabled ? '' : 'disabled'} data-pick="priv" data-v="${on ? 0 : 1}"><i></i><span>${on ? 'Privé (code seulement)' : 'Public'}</span></button>`;
  }
  UI.show = function (id, opt) {
    const def = SCR[id]; if (!def) return;
    if (cur && cur.leave) cur.leave();
    BR.$$('.screen').forEach(s => s.classList.remove('on'));
    // page neuve à chaque affichage : sinon les écouteurs de clic s'accumulent (doubles actions, double tirage…)
    let node = BR.$('#s-' + id);
    const fresh = el('div', { class: 'screen', id: 's-' + id });
    if (node) node.replaceWith(fresh); else ui().appendChild(fresh);
    node = fresh;
    cur = def; curId = id; def.node = node;
    def.enter(node, opt || {});
    // (fenêtre en arrière-plan : les images d'animation arrivent toutes d'un coup ; seul l'écran encore actuel s'affiche)
    requestAnimationFrame(() => { if (curId === id && def.node === node) node.classList.add('on'); });
    BR.$('#topbar').style.display = def.noTop ? 'none' : '';
    reportWhere(id === 'hub' || id === 'boot' ? null : BR.curGame === 'arena' ? 'colosses' : BR.curGame === 'portes' ? 'portes' : 'backrooms');
    const brand = BR.$('#topbar .tb-brand'); if (brand) brand.textContent = brandName(); document.body.classList.toggle('arenamenu', BR.curGame === 'arena' && id !== 'hub');
    document.body.classList.toggle('doorsmenu', BR.curGame === 'portes' && id !== 'hub' && id !== 'boot');
    if (def.ownBg && def.ownBg()) { if (BR.ArenaUI) BR.ArenaUI.bg(false); BR.MenuBG.stop(); }   // l'écran dessine son propre décor 3D
    else if (BR.ArenaUI && !(id === 'asc' || ['asc-armory', 'asc-tree', 'asc-altar', 'asc-quests', 'asc-chal', 'asc-ach'].includes(id))) { const ar = BR.curGame === 'arena' && id !== 'hub' && id !== 'boot'; BR.ArenaUI.bg(ar); if (!ar && !BR.MenuBG.running && !inGame()) BR.MenuBG.start(); }
    document.body.dataset.screen = id;
  };
  UI.current = () => curId;
  UI.screen = (id, def) => screen(id, def);
  UI.thumb = (look, w, h) => thumb(look, w, h);
  UI.rarityTag = r => rarityTag(r);

  UI.toast = function (text, kind) {
    const box = BR.$('#toasts'), t = el('div', { class: 'tst ' + (kind || '') }, text);
    box.appendChild(t); while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3800);
    if (kind === 'error') Au.ui('error');
  };

  function modal(content, opts) {
    opts = opts || {};
    const back = el('div', { class: 'modal-back' });
    const box = el('div', { class: 'modal ' + (opts.cls || '') });
    const close = () => { back.classList.remove('on'); setTimeout(() => back.remove(), 200); if (opts.onClose) opts.onClose(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape' && !opts.locked) close(); };
    if (!opts.locked) box.appendChild(el('button', { class: 'modal-x', title: 'Fermer', onclick: () => { Au.ui('back'); close(); } }, ico('x', 16)));
    if (typeof content === 'function') content(box, close); else box.appendChild(content);
    back.appendChild(box);
    back.addEventListener('mousedown', e => { if (e.target === back && !opts.locked) close(); });
    BR.$('#modals').appendChild(back);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => back.classList.add('on'));
    return { close, box };
  }
  UI.modal = modal;
  UI.confirm = function (title, text, okLabel, danger) {
    return new Promise(res => {
      let done = false;
      const m = modal((box, close) => {
        box.append(el('h3', null, title), el('p', { class: 'muted' }, text || ''),
          el('div', { class: 'row end' },
            el('button', { class: 'btn ghost', onclick: () => { done = true; res(false); close(); } }, 'Annuler'),
            el('button', { class: 'btn ' + (danger === false ? 'primary' : 'danger'), onclick: () => { done = true; res(true); close(); } }, okLabel || 'Confirmer')));
      }, { cls: 'small', onClose: () => { if (!done) res(false); } });
      return m;
    });
  };

  const fmtPts = n => BR.fmt(n) + ' pts';
  const thumb = (look, w, h) => { try { return Av.thumb(look, w, h); } catch (e) { return ''; } };
  const rarityTag = r => { const R = BR.RARITY[r] || BR.RARITY.commun; return `<span class="rar" style="--rc:${R.color}">${R.label}</span>`; };
  function lvl() { return Acc.level(); }

  /* ================= barre du haut (profil) ================= */
  function renderTop() {
    const p = Acc.p, L = lvl();
    const sync = { local: ['Invité', 'grey'], ok: ['En ligne', 'ok'], saving: ['Sauvegarde…', 'busy'], offline: ['Hors ligne', 'warn'], error: ['Erreur de sauvegarde', 'bad'] }[Acc.sync] || ['', 'grey'];
    BR.$('#topbar').innerHTML = `
      <div class="tb-left"><span class="tb-brand">${brandName()}</span><span class="tb-online" title="Joueurs connectés au serveur">${N.status === 'on' ? '<i class="dot ok"></i>' + N.online + ' en ligne' : ''}</span></div>
      <div class="tb-right">
        <div class="tb-pts" title="Points">${COIN(18)} <b>${BR.fmt(p.points)}</b></div>
        <button class="tb-chip" data-act="account">
          <img src="${thumb(p.look, 64, 80)}" alt="">
          <div class="tb-who"><b>${esc(p.name)}</b><span><i class="dot ${sync[1]}"></i>${sync[0]}</span></div>
          <div class="tb-lv"><span>NIV. ${L.level}</span><div class="xpb"><i style="width:${(L.into / L.need) * 100}%"></i></div></div>
        </button>
        <button class="tb-ic" data-act="settings" title="Paramètres">${ICO('gear', 20)}</button>
      </div>`;
  }

  /* ================= écran de démarrage ================= */
  screen('boot', {
    noTop: true,
    enter(n) {
      n.innerHTML = `<div class="boot">
        <div class="boot-logo glitch" data-t="BACKROOMS">BACKROOMS</div>
        <div class="boot-sub">Ne restez pas seuls dans le noir.</div>
        <div class="boot-bar"><i></i></div><div class="boot-msg">Chargement…</div>
        <button class="btn primary big boot-go" style="visibility:hidden">CLIQUER POUR ENTRER</button>
        <div class="boot-warn">Jeu d'horreur : sons forts, apparitions soudaines. Casque conseillé.</div></div>`;
    },
  });
  UI.bootProgress = function (k, msg) { const b = BR.$('.boot-bar i'); if (b) b.style.width = Math.round(k * 100) + '%'; const m = BR.$('.boot-msg'); if (m && msg) m.textContent = msg; };
  UI.bootReady = function (cb) {
    const b = BR.$('.boot-go'); if (!b) return cb();
    BR.$('.boot-msg').textContent = 'Prêt.';
    b.style.visibility = 'visible';
    b.onclick = () => { Au.unlock(); BR.saveSettings(); Au.ui('ok'); Au.track('music', 'menu', 0.8); cb(); };
  };

  /* ---------- présence : à quel jeu je joue (pour les compteurs de l'accueil) ---------- */
  let whereSent, whereWant;
  function reportWhere(g) { whereWant = g; if (g === whereSent) return; if (N.send({ t: 'where', g })) whereSent = g; }
  N.on('welcome', () => { whereSent = undefined; if (whereWant !== undefined) reportWhere(whereWant); });
  /* qui joue à quoi : liste reçue du serveur, rafraîchie toutes les 8 s tant que l'accueil est affiché */
  let presence = null, presTimer = null, presAsked = 0;
  N.on('presence', m => { presence = m.p || null; paintPresence(); });
  function paintPresence() {
    const n = SCR.hub && SCR.hub.node; if (!n || curId !== 'hub') return;
    n.querySelectorAll('.gc-pl').forEach(b => {
      const L = presence && presence[b.dataset.pg];
      if (!L) { b.innerHTML = `${ICO('users', 14)} <span>${N.status !== 'on' ? 'hors ligne' : presAsked && performance.now() - presAsked > 6000 ? 'indisponible' : '…'}</span>`; b.classList.add('off'); return; }
      const inGame = L.filter(p => p.s === 'game').length;
      b.classList.toggle('off', !L.length);
      b.innerHTML = `${ICO('users', 14)} <b>${L.length}</b> <span>joueur${L.length > 1 ? 's' : ''}${inGame ? ' · ' + inGame + ' en partie' : ''}</span>`;
    });
  }
  function presenceList(gid, anchor) {
    const L = (presence && presence[gid]) || [], g = BR.GAMES.find(x => x.id === gid);
    BR.$$('.pres-pop').forEach(x => x.remove());
    const st = { game: 'en partie', lobby: 'dans un salon', menu: 'dans les menus' };
    const pop = el('div', { class: 'pres-pop', html: `<div class="pp-h"><b>${esc(g ? g.name : gid)}</b><span>${L.length} joueur${L.length > 1 ? 's' : ''}</span></div>` +
      (L.length ? `<div class="pp-l">${L.map(p => `<div class="pp-r"><i class="pp-${p.s}"></i><b>${esc(p.n)}</b><span>${st[p.s] || ''}</span></div>`).join('')}</div>` : `<div class="pp-e muted">Personne pour l'instant… lance une partie !</div>`) });
    document.body.appendChild(pop);
    // au-dessus du bouton s'il y a la place, sinon en dessous
    const r = anchor.getBoundingClientRect(), h = pop.offsetHeight, w = pop.offsetWidth;
    pop.style.left = Math.min(innerWidth - w - 10, Math.max(10, r.left + r.width / 2 - w / 2)) + 'px';
    pop.style.top = (r.top - h - 8 >= 10 ? r.top - h - 8 : Math.min(innerHeight - h - 10, r.bottom + 8)) + 'px';
    const close = e => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', close, true); } };
    setTimeout(() => document.addEventListener('mousedown', close, true), 0);
  }

  /* ---------- fond de l'accueil : fondu enchaîné entre les mondes des jeux (niveaux des Backrooms + arènes de COLOSSES) ---------- */
  const HB = { timer: null, step: 0, list: [] };
  function hubBgName(k) {
    if (k === 'arena') return 'COLOSSES — l\'arène';
    const m = BR.MAPS.find(x => x.id === k); return m ? 'BACKROOMS — ' + m.name : '';
  }
  function hubBgShow(k) {
    try {
      if (k === 'arena' && BR.ArenaUI) { BR.MenuBG.stop(); BR.ArenaUI.bg(true); }
      else { if (BR.ArenaUI) BR.ArenaUI.bg(false); BR.MenuBG.start(k); }
    } catch (e) { console.warn('fond accueil', e); }
    const cap = BR.$('#s-hub .hub-bgcap'); if (cap) { cap.classList.remove('on'); void cap.offsetWidth; cap.textContent = hubBgName(k); cap.classList.add('on'); }
  }
  function hubBgStart() {
    hubBgStop();
    let fade = BR.$('#bgfade'); if (!fade) { fade = el('div', { id: 'bgfade' }); document.body.insertBefore(fade, ui()); }
    // ordre : niveaux mélangés, avec l'arène de COLOSSES tous les 3 décors
    const maps = BR.shuffle(BR.MAPS.map(m => m.id)); HB.list = [];
    maps.forEach((id, i) => { HB.list.push(id); if (i % 3 === 2) HB.list.push('arena'); });
    HB.step = 0;
    const cap = BR.$('#s-hub .hub-bgcap'); if (cap) { cap.textContent = hubBgName(BR.MAPS[0].id); cap.classList.add('on'); }
    HB.timer = setInterval(() => {
      if (curId !== 'hub' || inGame() || document.hidden) return;
      const k = HB.list[HB.step++ % HB.list.length];
      fade.classList.add('on');
      setTimeout(() => { if (curId !== 'hub') { fade.classList.remove('on'); return; } hubBgShow(k); setTimeout(() => fade.classList.remove('on'), 120); }, 750);
    }, 13000);
  }
  function hubBgStop() {
    clearInterval(HB.timer); HB.timer = null;
    const fade = BR.$('#bgfade'); if (fade) fade.classList.remove('on');
  }

  /* ================= hub ================= */
  // anciens jeux : cachés, révélés par le code secret GMP (champ en bas de l'accueil, ou en tapant G-M-P au clavier)
  let oldGames = false, codeBuf = '';
  function gameCard(g) {
    return `
          <div class="gcard ${g.ready ? '' : 'locked'} ${g.old ? 'oldg' : ''}" data-game="${g.id}" style="--h:${g.hue}">
            <div class="gc-art"><div class="gc-glow"></div><div class="gc-name">${g.name}${g.sub ? `<small>${g.sub}</small>` : ''}</div>${g.isNew ? '<span class="gc-new">NOUVEAU</span>' : ''}</div>
            <div class="gc-body"><div class="gc-tag">${g.tag}</div><p>${g.desc}</p>
            ${g.ready ? '<button class="btn primary">JOUER</button>' : '<div class="gc-soon">' + ICO('lock', 15) + ' Bientôt disponible</div>'}
            <button class="gc-pl off" data-pg="${g.pres || g.id}" title="Voir qui joue"></button></div>
          </div>`;
  }
  function toggleOld() {
    oldGames = !oldGames; Au.ui(oldGames ? 'buy' : 'back');
    UI.toast(oldGames ? 'Code accepté : les anciens jeux sont de retour !' : 'Anciens jeux cachés.', oldGames ? 'good' : '');
    if (curId === 'hub') { UI.show('hub'); if (oldGames) setTimeout(() => { const o = BR.$('#s-hub .hub-old'); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80); }
  }
  document.addEventListener('keydown', e => {
    if (curId !== 'hub' || inGame() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (!/^[a-zA-Z]$/.test(e.key)) return;
    codeBuf = (codeBuf + e.key.toLowerCase()).slice(-3);
    if (codeBuf === 'gmp') { codeBuf = ''; toggleOld(); }
  });
  screen('hub', {
    leave() { clearInterval(presTimer); presTimer = null; BR.$$('.pres-pop').forEach(x => x.remove()); hubBgStop(); if (BR.ArenaUI) BR.ArenaUI.bg(false); },
    enter(n) {
      BR.MenuBG.start(); Au.track('music', 'menu', 0.8);
      const L = lvl();
      n.innerHTML = `<div class="hub">
        <div class="hub-head"><h1>CHOISIS TON CAUCHEMAR</h1><p class="muted">Bienvenue, <b>${esc(Acc.p.name)}</b> — niveau ${L.level} · ${BR.rankName(L.level)}</p></div>
        <div class="hub-cards">${BR.GAMES.filter(g => !g.old).map(g => gameCard(g)).join('')}</div>
        ${oldGames ? `<div class="hub-old"><div class="ho-h"><b>ANCIENS JEUX</b><span>Code GMP accepté — retape-le pour les cacher</span></div><div class="hub-cards old">${BR.GAMES.filter(g => g.old).map(g => gameCard(g)).join('')}</div></div>` : ''}
        ${Acc.logged ? '' : `<div class="hub-acc"><span>${ICO('cloud', 18)} Joue en invité ou <b>crée un compte</b> pour retrouver ta progression sur n'importe quel PC.</span><button class="btn small" data-act="account">Créer un compte</button></div>`}
      <label class="hub-code" title="Code secret">${ICO('lock', 14)}<input maxlength="10" placeholder="Code secret" spellcheck="false" autocomplete="off"></label>
      </div><div class="hub-bgcap"></div>`;
      hubBgStart();
      const codeIn = n.querySelector('.hub-code input');
      codeIn.addEventListener('input', () => { if (codeIn.value.trim().toLowerCase() === 'gmp') { codeIn.value = ''; codeIn.blur(); toggleOld(); } });
      codeIn.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = codeIn.value.trim(); codeIn.value = ''; if (v.toLowerCase() === 'gmp') toggleOld(); else if (v) { Au.ui('error'); UI.toast('Code inconnu.', 'error'); } } });
      // joueurs par jeu (cliquer = liste des noms) ; la connexion au serveur se fait en arrière-plan
      n.querySelectorAll('.gc-pl').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); Au.ui('click'); presenceList(b.dataset.pg, b); }));
      paintPresence();
      // un serveur ancien (avant v3) ne répond pas : après 6 s on affiche « indisponible » au lieu de « … »
      const ask = () => { if (!presAsked) presAsked = performance.now(); paintPresence(); if (N.status === 'on') N.send({ t: 'presence' }); else N.connect().then(() => N.send({ t: 'presence' })).catch(() => paintPresence()); };
      ask(); clearInterval(presTimer); presTimer = setInterval(ask, 8000);
      n.querySelectorAll('.gcard').forEach(c => c.addEventListener('click', () => {
        const g = BR.GAMES.find(x => x.id === c.dataset.game);
        if (!g.ready) { Au.ui('error'); UI.toast('Ce jeu arrive bientôt !'); return; }
        if (g.id === 'blocs') { Au.ui('ok'); location.href = 'blocs/index.html'; return; }
        Au.ui('ok'); BR.ascMode = g.id === 'ascension';
        UI.show(g.id === 'ascension' ? 'asc' : g.id === 'colosses' ? 'arena' : g.id === 'portes' ? 'portes' : g.id === 'bousculade' ? 'party' : 'main');
      }));
    },
  });

  /* ================= menu principal Backrooms ================= */
  let preview = null;
  function killPreview() { if (preview) { preview.dispose(); preview = null; } }
  screen('main', {
    enter(n) {
      BR.MenuBG.start(); BR.curGame = 'backrooms'; Au.track('music', 'menu', 0.8);
      const p = Acc.p, L = lvl(), d = Acc.dailyState();
      n.innerHTML = `<div class="main">
        <div class="main-left">
          <div class="logo"><div class="logo-t glitch" data-t="THE BACKROOMS">THE BACKROOMS</div><div class="logo-s">S U R V I V R E &nbsp; E N S E M B L E</div></div>
          <nav class="menu">
            <button class="mi" data-go="solo"><span>Jouer en solo</span><small>Seul face aux entités</small></button>
            <button class="mi hot" data-go="multi"><span>Multijoueur</span><small>Jusqu'à 8 survivants</small></button>
            <button class="mi" data-go="char"><span>Personnage</span><small>Skins & accessoires</small></button>
            <button class="mi" data-go="shop"><span>Boutique</span><small>Objets à emporter</small></button>
            <button class="mi" data-go="lb"><span>Classement</span><small>Les meilleurs survivants</small></button>
            <button class="mi" data-go="settings"><span>Paramètres</span></button>
            <button class="mi back" data-go="hub"><span>${ICO('back', 16)} Changer de jeu</span></button>
          </nav>
        </div>
        <div class="main-right">
          <div class="pcard">
            <canvas class="pv"></canvas>
            <div class="pc-info">
              <div class="pc-name">${esc(p.name)}</div>
              <div class="pc-rank">${BR.rankName(L.level)} · Niveau ${L.level}</div>
              <div class="xpbar"><i style="width:${(L.into / L.need) * 100}%"></i><span>${BR.fmt(L.into)} / ${BR.fmt(L.need)} XP</span></div>
              <div class="pc-stats"><div><b>${p.stats.escapes}</b><span>Évasions</span></div><div><b>${p.stats.games}</b><span>Parties</span></div><div><b>${p.stats.revives}</b><span>Relevés</span></div><div><b>${p.stats.fuses}</b><span>Fusibles</span></div></div>
            </div>
          </div>
          <div class="daily ${d.available ? 'avail' : ''}">
            <div><b>Récompense quotidienne</b><span>${d.available ? `+${d.reward} points · série de ${d.streak} jour${d.streak > 1 ? 's' : ''}` : 'Reviens demain ! Série : ' + Acc.p.streak + ' j'}</span></div>
            <button class="btn ${d.available ? 'primary' : 'ghost'}" ${d.available ? '' : 'disabled'} data-act="daily">${d.available ? 'Récupérer' : ICO('check', 16)}</button>
          </div>
          <div class="tipbox">${ICO('bulb', 16)} ${esc(BR.pick(BR.TIPS))}</div>
        </div>
      </div>`;
      n.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { Au.ui(b.dataset.go === 'hub' ? 'back' : 'click'); UI.show(b.dataset.go); }));
      killPreview();
      preview = Av.Preview(n.querySelector('.pv')); preview.setLook(p.look);
    },
    leave() { killPreview(); },
  });

  /* ================= chargement (objets emportés) ================= */
  function loadoutBox(onChange) {
    const box = el('div', { class: 'loadout' });
    function render() {
      const p = Acc.p, sel = p.loadout;
      const owned = BR.ITEM_ORDER.filter(id => (p.inv[id] || 0) > 0);
      box.innerHTML = `<div class="lo-head"><b>Objets emportés</b><span>${sel.filter(id => p.inv[id] > 0).length}/${BR.LOADOUT_SLOTS}</span></div>`;
      const grid = el('div', { class: 'lo-grid' });
      if (!owned.length) grid.appendChild(el('div', { class: 'muted lo-empty' }, 'Aucun objet. Achète-en à la boutique avec tes points !'));
      owned.forEach(id => {
        const it = BR.ITEMS[id], on = sel.includes(id);
        grid.appendChild(el('button', { class: 'lo-it' + (on ? ' on' : ''), title: it.desc, onclick: () => { const r = Acc.toggleLoadout(id); if (!r.ok) UI.toast(r.msg, 'error'); else Au.ui('click'); render(); onChange && onChange(); } },
          el('img', { class: 'ic', src: BR.Icons.item(id), alt: '' }), el('span', { class: 'nm' }, it.name), el('span', { class: 'ct' }, '×' + Math.min(p.inv[id], it.max) + (p.inv[id] > it.max ? ' (' + p.inv[id] + ')' : ''))));
      });
      box.appendChild(grid);
      box.appendChild(el('button', { class: 'btn small ghost', onclick: () => { Au.ui('click'); UI.show('shop', { back: curId }); } }, ico('cart', 15), ' Boutique'));
    }
    render();
    box.refresh = render;
    return box;
  }

  /* ================= solo ================= */
  let soloSel = BR.store.get('br_solo', { map: 'backrooms', diff: 'normal' });
  if (!BR.MAPS.some(m => m.id === soloSel.map)) soloSel.map = BR.MAPS[0].id;
  if (!BR.DIFFS[soloSel.diff]) soloSel.diff = 'normal';
  screen('solo', {
    enter(n) {
      n.innerHTML = `<div class="panel wide">
        <div class="ph"><button class="btn ghost back" data-act="back">${ICO('back', 18)}</button><h2>Partie solo</h2></div>
        <div class="solo">
          <div class="col">
            <h4>Niveau</h4><div class="maps"></div>
            <h4>Difficulté</h4><div class="diffs"></div><p class="ddesc muted"></p>
          </div>
          <div class="col side">
            <div class="lo-slot"></div>
            <div class="best muted"></div>
            <button class="btn primary big go">LANCER LA PARTIE</button>
          </div>
        </div></div>`;
      const maps = n.querySelector('.maps'), diffs = n.querySelector('.diffs');
      BR.MAPS.forEach(m => maps.appendChild(el('button', { class: 'mapc', 'data-id': m.id, style: { '--mc': m.color } },
        el('div', { class: 'mc-art', 'data-thumb': m.id, html: `<div class="mc-name">${m.name}</div>` }), el('div', { class: 'mc-body' }, el('b', null, m.sub), el('p', null, m.desc)))));
      if (BR.Thumbs) BR.Thumbs.fill(maps);
      Object.values(BR.DIFFS).forEach(d => diffs.appendChild(el('button', { class: 'diffc', 'data-id': d.id, style: { '--dc': d.color } }, d.name)));
      const sync = () => {
        maps.querySelectorAll('.mapc').forEach(b => b.classList.toggle('on', b.dataset.id === soloSel.map));
        diffs.querySelectorAll('.diffc').forEach(b => b.classList.toggle('on', b.dataset.id === soloSel.diff));
        const d = BR.DIFFS[soloSel.diff];
        n.querySelector('.ddesc').innerHTML = `${esc(d.desc)}<br><span class="tiny">${d.fuses} fusibles · gains ×${d.mult}</span>`;
        const b = Acc.p.stats.best[soloSel.map + '_' + soloSel.diff];
        n.querySelector('.best').textContent = b ? 'Meilleur temps d\'évasion : ' + BR.fmtTime(b) : 'Pas encore d\'évasion sur ce niveau dans cette difficulté.';
        BR.store.set('br_solo', soloSel);
        const m = BR.MAPS.find(x => x.id === soloSel.map); if (m) BR.MenuBG.setTheme(m.id);
      };
      maps.addEventListener('click', e => { const b = e.target.closest('.mapc'); if (b) { soloSel.map = b.dataset.id; Au.ui('click'); sync(); } });
      diffs.addEventListener('click', e => { const b = e.target.closest('.diffc'); if (b) { soloSel.diff = b.dataset.id; Au.ui('click'); sync(); } });
      n.querySelector('.lo-slot').appendChild(loadoutBox());
      n.querySelector('.go').addEventListener('click', startSolo);
      sync();
    },
  });
  function startSolo() {
    Au.ui('ok');
    const p = Acc.p;
    launch({ mode: 'solo', mapId: soloSel.map, diffId: soloSel.diff, seed: (Math.random() * 2 ** 31) >>> 0, roster: [{ id: 'me', name: p.name, look: p.look, level: lvl().level }], selfId: 'me', hostId: 'me' });
    BR.Game.lock();
  }
  function launch(o) {
    BR.$$('.modal-back').forEach(m => m.remove());
    o.loadout = Acc.loadoutForGame();
    o.onEnd = showResults;
    killPreview();
    document.body.classList.add('ingame');
    BR.MenuBG.stop();
    try { BR.Game.start(o); }
    catch (e) { console.error(e); document.body.classList.remove('ingame'); UI.toast('Erreur au lancement : ' + e.message, 'error'); UI.show(o.mode === 'solo' ? 'solo' : 'lobby'); }
  }

  /* ================= multijoueur : liste des salons ================= */
  let listTimer = null;
  const statusText = () => N.outdated ? 'Serveur Render pas à jour : voir LISEZ-MOI' : ({ off: N.lastError ? 'Déconnecté — nouvelle tentative…' : 'Déconnecté', waking: 'Réveil du serveur…', connecting: 'Connexion…', on: 'Connecté' })[N.status];
  screen('multi', {
    enter(n) {
      n.innerHTML = `<div class="panel wide">
        <div class="ph"><button class="btn ghost back" data-act="back">${ICO('back', 18)}</button><h2>Multijoueur — ${arenaGame() ? 'Colosses' : doorsGame() ? 'Les Portes' : partyGame() ? 'Bousculade' : 'Backrooms'}</h2><div class="srv"><i class="dot"></i><span class="st"></span></div></div>
        <div class="multi">
          <div class="col">
            <div class="mactions">
              <button class="btn primary big" data-m="quick">${ICO('bolt', 18)} Partie rapide</button>
              <button class="btn big" data-m="create">${ICO('plus', 18)} Créer un salon</button>
            </div>
            <div class="joincode"><input maxlength="4" placeholder="CODE" class="code-in" autocomplete="off"><button class="btn" data-m="join">Rejoindre</button></div>
            ${doorsGame() ? `<div class="why">
              <h4>Les Portes à plusieurs</h4>
              <ul><li>${ICO('door', 16)} <b>Mêmes salles, mêmes questions</b> pour tout le monde.</li>
              <li>${ICO('users', 16)} <b>Chacun choisit sa porte</b> : si quelqu'un ouvre la bonne, les autres peuvent le suivre.</li>
              <li>${ICO('skull', 16)} <b>La mauvaise porte</b> ne tue que celui qui l'ouvre… sous les yeux des autres.</li>
              <li>${ICO('trophy', 16)} La salle suivante commence quand <b>tous les survivants</b> y sont. Le dernier debout gagne.</li></ul>
            </div>` : `<div class="why">
              <h4>Pourquoi jouer à plusieurs ?</h4>
              <ul><li>${ICO('heart', 16)} <b>Relevez-vous</b> : un joueur attrapé tombe à terre, un coéquipier peut le sauver.</li>
              <li>${ICO('pin', 16)} <b>Marquez</b> fusibles et dangers (touche V) et parlez avec le chat rapide.</li>
              <li>${COIN(16)} <b>Bonus d'équipe</b> : +50 pts si quelqu'un s'échappe, +60 pts par coéquipier relevé, MVP.</li>
              <li>${ICO('trophy', 16)} Grimpez dans le <b>classement</b> mondial des évasions et des sauvetages.</li></ul>
            </div>`}
          </div>
          <div class="col">
            <div class="rl-head"><h4>Salons publics</h4><button class="btn small ghost" data-m="refresh">${ICO('refresh', 14)} Actualiser</button></div>
            <div class="rooms"></div>
          </div>
        </div></div>`;
      n.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const a = b.dataset.m;
        if (N.status !== 'on') { UI.toast('Connexion au serveur en cours, patiente quelques secondes…'); return; }
        Au.ui('click');
        if (a === 'quick') {
          // partie rapide : uniquement un salon ouvert du jeu affiché (le serveur, lui, ne distingue pas les jeux)
          const kind = curKind(), cand = N.rooms.filter(r => gameOfRoom(r) === kind && r.state === 'lobby' && r.n < r.max).sort((x, y) => y.n - x.n)[0];
          if (cand) N.join(cand.code); else UI.toast('Aucun salon public ouvert pour ce jeu : crée le tien !');
        }
        if (a === 'create') createRoomModal();
        if (a === 'join') { const c = n.querySelector('.code-in').value.trim().toUpperCase(); if (c.length < 4) UI.toast('Le code fait 4 caractères.', 'error'); else N.join(c); }
        if (a === 'refresh') N.list();
      });
      n.querySelector('.code-in').addEventListener('keydown', e => { if (e.key === 'Enter') n.querySelector('[data-m=join]').click(); });
      n.querySelector('.code-in').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      renderStatus(); renderRooms();
      N.connect().then(() => N.list()).catch(() => {});
      clearInterval(listTimer); listTimer = setInterval(() => { if (N.status === 'on') N.list(); }, 5000);
    },
    leave() { clearInterval(listTimer); },
  });
  function renderStatus() {
    const n = SCR.multi.node; if (!n || curId !== 'multi') return;
    const s = n.querySelector('.srv'); if (!s) return;
    s.className = 'srv ' + N.status;
    s.querySelector('.st').textContent = statusText() + (N.status === 'on' ? ' · ' + N.online + ' joueur' + (N.online > 1 ? 's' : '') + ' en ligne · ' + N.rtt + ' ms' : '');
    if (N.status === 'waking') s.querySelector('.st').textContent += ' (le serveur gratuit dort quand personne ne joue : jusqu\'à 1 min)';
  }
  function renderRooms() {
    const n = SCR.multi.node; if (!n || curId !== 'multi') return;
    const box = n.querySelector('.rooms');
    if (N.status !== 'on') { box.innerHTML = `<div class="empty"><div class="spin"></div>${statusText()}</div>`; return; }
    if (!N.rooms.length) { box.innerHTML = `<div class="empty">Aucun salon public pour l'instant.<br><b>Crée le tien</b> et partage le code à tes amis !</div>`; return; }
    box.innerHTML = '';
    const list = N.rooms.filter(r => gameOfRoom(r) === curKind());
    if (!list.length) { box.innerHTML = `<div class="empty">Aucun salon public pour ce jeu.<br><b>Crée le tien</b> et partage le code à tes amis !</div>`; return; }
    list.forEach(r => {
      const ar = arenaRoom(r), pr = partyRoom(r), dr = doorsRoom(r) || pr, bd = ar && r.map !== 'a_duel' && r.map !== 'a_random' ? AR().boss(r.map.slice(2)) : null;
      const m = pr ? { name: 'Bousculade', color: '#ff4f9e' } : dr ? { name: 'Les Portes', color: '#7dffa8' } : ar ? { name: AR().mapLabel(r.map), color: bd ? bd.color : '#ffc84a' } : BR.MAPS.find(x => x.id === r.map), d = pr ? PDIFF : dr ? (DD()[r.diff] || DD().normal) : ar ? AR().roomDiff(r.map, r.diff) : (BR.DIFFS[r.diff] || BR.DIFFS.normal), full = r.n >= r.max, ing = r.state !== 'lobby';
      box.appendChild(el('div', { class: 'room' + (full || ing ? ' dis' : '') },
        el('div', Object.assign({ class: 'r-map', style: { '--mc': m ? m.color : '#888' } }, !ar && !dr && m && m.id ? { 'data-thumb': m.id } : {}), el('span', null, m ? m.name : 'Aléatoire')),
        el('div', { class: 'r-info' }, el('b', null, r.name), el('span', null, 'Hôte : ' + r.hostName + ' · ', el('i', { style: { color: d.color } }, d.name))),
        el('div', { class: 'r-n' }, r.n + '/' + r.max),
        el('button', { class: 'btn small ' + (full || ing ? 'ghost' : 'primary'), disabled: full || ing, onclick: () => { Au.ui('click'); N.join(r.code); } }, ing ? 'En partie' : full ? 'Plein' : 'Rejoindre')));
    });
    if (BR.Thumbs) BR.Thumbs.fill(box);
  }
  function createRoomModal() {
    let sel = { map: 'l0', diff: 'normal', max: 6, priv: false };
    const ag = arenaGame(), pg = partyGame(), dg = doorsGame() || pg;
    const mapSel = dg ? '<option value="d_portes">Les Portes — couloir sans fin</option>' : ag ? AR().ROOM_MAPS.map(id => `<option value="${id}">${AR().mapLabel(id)}</option>`).join('') : BR.MAPS.map(m => `<option value="${m.id}">${m.name} — ${m.sub}</option>`).join('') + '<option value="random">Aléatoire</option>';
    const diffs = pg ? [PDIFF] : dg ? Object.values(DD()) : ag ? AR().roomDiffList(BR.ascMode ? 'a_asc' : '') : Object.values(BR.DIFFS);
    void mapSel;
    const kind = ag ? 'arena' : 'backrooms';
    const cfg = { map: pg ? 'p_bousc' : dg ? 'd_portes' : ag ? (AR().ROOM_MAPS[0] || 'a_random') : (BR.store.get('br_solo', {}).map || BR.MAPS[0].id), diff: ag && BR.ascMode && BR.Asc ? 'p' + BR.Asc.selPal() : 'normal', max: ag ? 4 : pg ? 8 : 6, priv: false };
    if (!dg && !ag && !BR.MAPS.some(m => m.id === cfg.map)) cfg.map = BR.MAPS[0].id;
    modal((box, close) => {
      box.innerHTML = `<h3>Créer un salon${ag ? (BR.ascMode ? ' — L\'Ascension' : ' — Colosses') : pg ? ' — Bousculade' : dg ? ' — Les Portes' : ''}</h3>
        <label class="fld">Nom du salon<input class="rn" maxlength="28" value="${esc(Acc.p.name)} — salon"></label>
        ${dg || (ag && BR.ascMode) ? '' : `<div class="ls-lbl">${ag ? 'Combat' : 'Niveau'}</div><div class="ls-tiles cr-tiles"></div>`}
        <div class="ls-opts">
          <div class="ls-o"><div class="ls-lbl">${ag && BR.ascMode ? 'Palier' : 'Difficulté'}</div><div class="ls-chips cr-diff"></div></div>
          <div class="ls-o sm"><div class="ls-lbl">Joueurs</div><div class="cr-max"></div></div>
          <div class="ls-o sm"><div class="ls-lbl">Salon</div><div class="cr-priv"></div></div>
        </div>
        <div class="row end"><button class="btn primary big ok">Créer le salon</button></div>`;
      const paint = () => {
        const t = box.querySelector('.cr-tiles'); if (t) { t.innerHTML = mapTiles(kind, cfg.map, true); if (BR.Thumbs) BR.Thumbs.fill(t); }
        box.querySelector('.cr-diff').innerHTML = diffChips(diffs, cfg.diff, true);
        box.querySelector('.cr-max').innerHTML = stepper(cfg.max, true);
        box.querySelector('.cr-priv').innerHTML = privToggle(cfg.priv, true);
      };
      box.addEventListener('click', e => { const pk = e.target.closest('[data-pick]'); if (!pk || pk.disabled) return; const k = pk.dataset.pick, v = pk.dataset.v; cfg[k] = k === 'max' ? +v : k === 'priv' ? v === '1' : v; Au.ui('click'); paint(); });
      paint();
      box.querySelector('.ok').addEventListener('click', () => {
        sel = { name: box.querySelector('.rn').value.trim() || Acc.p.name + ' — salon', map: cfg.map, diff: cfg.diff, max: cfg.max, priv: cfg.priv };
        if (dg && !pg) sel.name = sel.name.replace(/⁣/g, '').slice(0, 27) + DOOR_MARK;
        if (!N.create(sel)) { UI.toast('Pas connecté au serveur : réessaie dans quelques secondes.', 'error'); return; }
        Au.ui('ok'); close();
        const was = N.room && N.room.code;
        setTimeout(() => { if (!inGame() && curId === 'multi' && !(N.room && N.room.code !== was)) UI.toast('Le serveur ne répond pas. Réessaie (le serveur gratuit peut mettre 1 minute à se réveiller).', 'error'); }, 10000);
      });
    }, { cls: 'roomnew' });
  }

  /* ================= salon ================= */
  const lobbyChat = [];
  function lobbyLine(html) { lobbyChat.push(html); while (lobbyChat.length > 60) lobbyChat.shift(); const log = BR.$('#s-lobby .lchat .log'); if (log && curId === 'lobby') { log.appendChild(el('div', { class: 'cl', html })); log.scrollTop = log.scrollHeight; } }
  // Ascension : le salon est une salle d'aventuriers en 3D (js/stage3d.js) ; les autres jeux gardent le salon classique
  let lounge = null, lobby3d = false;
  const asc3d = r => !!(r && r.map === 'a_asc' && BR.Asc && BR.Stage3D && BR.Stage3D.lounge);
  function killLounge() { if (lounge) { try { lounge.dispose(); } catch (e) { console.warn(e); } lounge = null; } }
  const lobbyChatHtml = () => `<div class="lchat"><div class="log"></div><div class="qrow">${BR.QUICKCHAT.map(q => `<button class="q" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div><input class="in" maxlength="160" placeholder="Écrire un message…"></div>`;
  const lobbyBtnsHtml = () => `<div class="lbtns"><button class="btn ghost" data-l="char">${ICO('shirt', 16)} Personnage</button><button class="btn big ready" data-l="ready">PRÊT</button><button class="btn primary big start" data-l="start">LANCER LA PARTIE</button></div>`;
  screen('lobby', {
    ownBg: () => lobby3d,
    enter(n) {
      killLounge();
      lobby3d = asc3d(N.room);
      n.classList.toggle('l3d', lobby3d);
      if (lobby3d) n.innerHTML = `<div class="lob3d">
        <div class="l3-stage"></div>
        <div class="l3-top"><button class="btn ghost back" data-l="leave">${ICO('back', 16)} Quitter</button>
          <div class="l3-title"><small>TABLEAU DES AVENTURIERS</small><h2 class="lname"></h2></div>
          <button class="lcode l3-code" title="Copier le code"><small>CODE DU SALON</small><b></b><span>${ICO('copy', 13)} cliquer pour copier</span></button></div>
        <div class="l3-left"><div class="lset"></div><div class="lo-slot"></div></div>
        <div class="l3-right">${lobbyChatHtml()}</div>
        <div class="l3-bottom"><div class="l3-status"></div>${lobbyBtnsHtml()}</div>
      </div>`;
      else n.innerHTML = `<div class="panel wide lobby">
        <div class="ph"><button class="btn ghost back" data-l="leave">${ICO('back', 16)} Quitter</button><h2 class="lname"></h2>
          <div class="lcode" title="Copier le code">CODE <b></b> ${ICO('copy', 16)}</div></div>
        <div class="lgrid">
          <div class="col">
            <div class="lset"></div>
            <div class="lplayers"></div>
          </div>
          <div class="col side">
            <div class="lo-slot"></div>
            ${lobbyBtnsHtml()}
            ${lobbyChatHtml()}
          </div>
        </div></div>`;
      n.querySelector('.lo-slot').appendChild(partyRoom(N.room) ? partyRulesBox() : doorsRoom(N.room) ? doorsRulesBox() : N.room && N.room.map === 'a_asc' && BR.Asc ? BR.Asc.lobbyBox() : arenaRoom(N.room) && BR.ArenaUI ? BR.ArenaUI.kitBox('lobby') : loadoutBox());
      const log = n.querySelector('.lchat .log'); lobbyChat.forEach(h => log.appendChild(el('div', { class: 'cl', html: h }))); log.scrollTop = log.scrollHeight;
      n.querySelector('.lcode').addEventListener('click', () => { const r = N.room; if (!r) return; try { navigator.clipboard.writeText(r.code); UI.toast('Code ' + r.code + ' copié !', 'good'); } catch (e) { UI.toast('Code : ' + r.code); } Au.ui('ok'); });
      const inp = n.querySelector('.lchat .in');
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && inp.value.trim()) { N.chat(inp.value.trim()); inp.value = ''; } });
      n.querySelector('.qrow').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) { N.chat(b.dataset.q, true); Au.ui('click'); } });
      n.addEventListener('click', e => {
        // équipes (hôte) : pastille de couleur sous un joueur, ou formule rapide
        const td = e.target.closest('[data-tof]');
        if (td && N.room && N.isHost()) { const t = roomTeams(N.room); t[td.dataset.tof] = +td.dataset.tk; Au.ui('click'); setTeams(t); return; }
        const tp = e.target.closest('[data-tp]');
        if (tp && N.room && N.isHost()) { Au.ui('click'); teamPreset(tp.dataset.tp); return; }
        const pk = e.target.closest('[data-pick]');
        if (pk && !pk.disabled && N.room && N.isHost()) {
          const k = pk.dataset.pick, v = pk.dataset.v;
          N.send({ t: 'settings', [k]: k === 'max' ? +v : k === 'priv' ? v === '1' : v }); Au.ui('click'); return;
        }
        const b = e.target.closest('[data-l]'); if (!b) return; const a = b.dataset.l, r = N.room; if (!r) return;
        if (a === 'leave') { Au.ui('back'); N.leave(); lobbyChat.length = 0; UI.show('multi'); }
        if (a === 'char') { Au.ui('click'); UI.show('char', { back: 'lobby' }); }
        if (a === 'ready') { const me = r.players.find(p => p.id === N.id); Au.ui('click'); N.send({ t: 'ready', v: !(me && me.ready) }); }
        if (a === 'start') hostStart();
        if (a === 'kick') { const id = b.dataset.id, p = r.players.find(x => x.id === id); UI.confirm('Exclure ' + (p ? p.name : '') + ' ?', 'Il ne pourra plus revenir dans ce salon.', 'Exclure').then(ok => { if (ok) N.send({ t: 'kick', id }); }); }
      });
      n.addEventListener('change', e => {
        const s = e.target.closest('[data-set]'); if (!s || !N.isHost()) return;
        const k = s.dataset.set, v = s.type === 'checkbox' ? s.checked : s.value;
        N.send({ t: 'settings', [k]: k === 'max' ? +v : v }); Au.ui('click');
      });
      if (lobby3d) { try { lounge = BR.Stage3D.lounge(n.querySelector('.l3-stage'), {}); } catch (e) { console.warn('salon 3D', e); lounge = null; } }
      renderLobby();
    },
    leave() { killLounge(); lobby3d = false; },
  });
  function renderLobby() {
    const n = SCR.lobby.node, r = N.room; if (!n || curId !== 'lobby') return;
    if (!r) { UI.show('multi'); return; }
    if (asc3d(r) !== lobby3d) { UI.show('lobby'); return; }     // le salon change de jeu : on reconstruit l'écran
    const host = N.isHost(), me = r.players.find(p => p.id === N.id);
    n.querySelector('.lname').textContent = r.name;
    n.querySelector('.lcode b').textContent = r.code;
    const dis = host ? '' : 'disabled';
    const ar = arenaRoom(r), pr = partyRoom(r), dr = doorsRoom(r) || pr;
    const mapOpts = dr ? '<option value="d_portes" selected>Les Portes</option>' : ar ? AR().ROOM_MAPS.map(id => `<option value="${id}" ${r.map === id ? 'selected' : ''}>${AR().mapLabel(id)}</option>`).join('') : BR.MAPS.map(m => `<option value="${m.id}" ${r.map === m.id ? 'selected' : ''}>${m.name} — ${m.sub}</option>`).join('') + `<option value="random" ${r.map === 'random' ? 'selected' : ''}>Aléatoire</option>`;
    const bd = ar && AR().BOSSES.some(x => 'a_' + x.id === r.map) ? AR().boss(r.map.slice(2)) : null;
    const m = pr ? { name: 'Bousculade', sub: 'Course d\'obstacles puis survie · jusqu\'à 8', color: '#ff4f9e' } : dr ? { name: 'Les Portes', sub: 'Couloir sans fin · quiz BUT GMP', color: '#7dffa8' } : ar ? { name: AR().mapLabel(r.map), sub: r.map === 'a_asc' ? '15 étages · bénédictions · entraide' : r.map === 'a_duel' ? 'Premier à 2 manches' : bd ? bd.sub : 'Surprise…', color: r.map === 'a_asc' ? '#ffb24a' : bd ? bd.color : '#ffc84a' } : BR.MAPS.find(x => x.id === r.map);
    const d = pr ? PDIFF : dr ? (DD()[r.diff] || DD().normal) : ar ? AR().roomDiff(r.map, r.diff) : (BR.DIFFS[r.diff] || BR.DIFFS.normal);
    const diffList = pr ? [PDIFF] : dr ? Object.values(DD()) : ar ? AR().roomDiffList(r.map) : Object.values(BR.DIFFS);
    void mapOpts; void dis;
    const kind = ar ? 'arena' : 'backrooms', thumbId = !ar && !dr && r.map !== 'random' ? r.map : null;
    if (lobby3d) { renderLobby3d(n, r, host, me, diffList, d); return; }
    // en-tête : grande vue du niveau choisi ; l'hôte choisit dans les vignettes, la difficulté en pastilles, le nombre de places au +/−
    n.querySelector('.lset').innerHTML = `
      <div class="ls-hero" style="--mc:${m ? m.color : '#888'}">
        <div class="lh-img${thumbId ? '' : ' plain'}" ${thumbId ? `data-thumb="${thumbId}"` : ''}></div>
        <div class="lh-txt"><small>${dr || r.map === 'a_asc' ? 'MODE' : ar ? 'COMBAT' : 'NIVEAU'}</small><b>${esc(m ? m.name : 'Niveau aléatoire')}</b><span>${esc(m ? m.sub : 'Surprise à chaque partie…')}</span></div>
        ${host ? '' : '<div class="lh-note">L\'hôte choisit le niveau</div>'}
      </div>
      ${host && !dr && r.map !== 'a_asc' ? `<div class="ls-tiles">${mapTiles(kind, r.map, true)}</div>` : ''}
      <div class="ls-opts">
        <div class="ls-o"><div class="ls-lbl">${r.map === 'a_asc' ? 'Palier' : 'Difficulté'}</div><div class="ls-chips">${diffChips(diffList, r.diff, host)}</div></div>
        <div class="ls-o sm"><div class="ls-lbl">Joueurs</div>${stepper(r.max, host)}</div>
        <div class="ls-o sm"><div class="ls-lbl">Salon</div>${privToggle(!!r.priv, host)}</div>
      </div>
      ${d.desc ? `<div class="ls-d"><b style="color:${d.color}">${esc(d.name)}</b> — <span class="muted">${esc(d.desc)}</span></div>` : ''}`;
    if (BR.Thumbs) BR.Thumbs.fill(n.querySelector('.lset'));
    const pl = n.querySelector('.lplayers'); pl.innerHTML = '';
    // duel en équipes : l'hôte répartit les joueurs (6 couleurs), formules rapides au-dessus des joueurs
    const duelR = ar && r.map === 'a_duel', TT = duelR ? roomTeams(r) : null, TEAMS = AR() && AR().TEAMS;
    if (duelR) {
      const nT = new Set(r.players.map(p => TT[p.id])).size;
      pl.appendChild(el('div', { class: 'lteams-h', html: `<b>Équipes</b><span class="muted">${nT} équipe${nT > 1 ? 's' : ''} · ${r.players.map(p => TT[p.id]).reduce((m, t, i, a) => Math.max(m, a.filter(x => x === t).length), 0)} joueur(s) max par équipe</span>` +
        (host ? `<div class="lt-pre"><button class="btn small" data-tp="ffa">Chacun pour soi</button><button class="btn small" data-tp="2">2 équipes</button><button class="btn small" data-tp="3">3 équipes</button></div>` : '<span class="muted">L\'hôte répartit les équipes</span>') }));
    }
    r.players.forEach(p => {
      const T = duelR ? TEAMS[TT[p.id]] : null;
      pl.appendChild(el('div', { class: 'lp' + (p.ready || p.id === r.host ? ' rdy' : '') + (p.id === N.id ? ' me' : '') + (T ? ' team' : ''), style: T ? { '--tc': T.color } : {} },
        el('img', { src: thumb(p.look, 120, 150), alt: '' }),
        el('div', { class: 'lp-n', html: (p.id === r.host ? ICO('crown', 15, 'gold') + ' ' : '') + esc(p.name) }),
        el('div', { class: 'lp-l' }, 'Niv. ' + p.level + (p.acc ? ' · compte' : ' · invité')),
        T ? el('div', { class: 'lp-t', html: host ? TEAMS.map((x, k) => `<button class="tdot ${TT[p.id] === k ? 'on' : ''}" style="--tc:${x.color}" data-tof="${p.id}" data-tk="${k}" title="Équipe ${x.name}"></button>`).join('') : `<span class="tname">Équipe ${T.name}</span>` }) : null,
        el('div', { class: 'lp-s' }, p.id === r.host ? 'Hôte' : p.ready ? 'PRÊT' : 'En attente…'),
        host && p.id !== N.id ? el('button', { class: 'lp-k', 'data-l': 'kick', 'data-id': p.id, title: 'Exclure' }, ico('x', 13)) : null));
    });
    for (let i = r.players.length; i < r.max; i++) pl.appendChild(el('div', { class: 'lp empty' }, el('div', { class: 'lp-n' }, 'Place libre')));
    const rb = n.querySelector('.ready'), sb = n.querySelector('.start');
    rb.style.display = host ? 'none' : ''; sb.style.display = host ? '' : 'none';
    if (me) { rb.classList.toggle('on', !!me.ready); rb.innerHTML = me.ready ? ICO('check', 18) + ' PRÊT' : 'PRÊT'; }
    const others = r.players.filter(p => p.id !== r.host), allReady = others.every(p => p.ready);
    sb.textContent = allReady ? 'LANCER LA PARTIE' : 'LANCER (' + others.filter(p => p.ready).length + '/' + others.length + ' prêts)';
    sb.classList.toggle('primary', allReady);
  }
  // salon 3D de l'Ascension : réglages compacts à gauche, joueurs en 3D (étiquettes, bouton exclure), boutons en bas
  function renderLobby3d(n, r, host, me, diffList, d) {
    n.querySelector('.lset').innerHTML = `<div class="l3-card">
        <div class="l3-mode"><small>MODE</small><b>L'Ascension</b><span>15 étages · bénédictions · entraide</span></div>
        <div class="ls-o"><div class="ls-lbl">Palier</div><div class="ls-chips">${diffChips(diffList, r.diff, host)}</div></div>
        ${d.desc ? `<div class="ls-d"><b style="color:${d.color}">${esc(d.name)}</b> — <span class="muted">${esc(d.desc)}</span></div>` : ''}
        <div class="l3-row"><div class="ls-o sm"><div class="ls-lbl">Joueurs</div>${stepper(r.max, host, 4)}</div><div class="ls-o sm"><div class="ls-lbl">Salon</div>${privToggle(!!r.priv, host)}</div></div>
        ${host ? '' : '<div class="lh-note">L\'hôte choisit le palier</div>'}
      </div>`;
    if (lounge) lounge.update(r, N.id);
    const others = r.players.filter(p => p.id !== r.host), nr = others.filter(p => p.ready).length, allReady = others.every(p => p.ready);
    n.querySelector('.l3-status').innerHTML = `<b>${r.players.length}</b>/${r.max} aventuriers · ${others.length ? `<b>${nr}</b>/${others.length} prêt${nr > 1 ? 's' : ''}` : 'en attente de compagnons'}`;
    const rb = n.querySelector('.ready'), sb = n.querySelector('.start');
    rb.style.display = host ? 'none' : ''; sb.style.display = host ? '' : 'none';
    if (me) { rb.classList.toggle('on', !!me.ready); rb.classList.toggle('primary', !me.ready); rb.innerHTML = me.ready ? ICO('check', 18) + ' PRÊT !' : 'JE SUIS PRÊT'; }
    sb.textContent = allReady ? 'LANCER L\'ASCENSION' : 'LANCER (' + nr + '/' + others.length + ' prêts)';
    sb.classList.toggle('primary', allReady);
  }
  /* équipes du duel : gardées par le serveur (room.teams, serveur v3+) et, chez l'hôte, en local (secours avec un ancien serveur).
     Tout joueur sans équipe reçoit la première couleur libre (chacun pour soi par défaut). */
  let lobbyTeams = {};
  function roomTeams(r) {
    const src = (r.teams && Object.keys(r.teams).length) ? r.teams : lobbyTeams, out = {}, used = new Set();
    r.players.forEach(p => { const v = src[p.id]; if (Number.isInteger(v) && v >= 0 && v < 6) { out[p.id] = v; used.add(v); } });
    r.players.forEach(p => { if (out[p.id] == null) { let k = 0; while (used.has(k) && k < 5) k++; out[p.id] = k; used.add(k); } });
    return out;
  }
  function setTeams(t) { lobbyTeams = t; N.send({ t: 'settings', teams: t }); renderLobby(); }
  function teamPreset(kind) {
    const r = N.room; if (!r) return; const t = {};
    const ids = r.players.map(p => p.id);
    if (kind === 'ffa') ids.forEach((id, i) => { t[id] = i % 6; });
    else { const k = +kind, sh = BR.shuffle(ids.slice()); sh.forEach((id, i) => { t[id] = i % k; }); }
    setTeams(t);
  }
  // fin de partie en salon : « Rejouer » relance tout de suite pour l'hôte ; pour les autres, ils se mettent prêts
  const roomEndButtons = () => N.isHost()
    ? '<button class="btn primary big" data-r="replay">Rejouer</button><button class="btn big" data-r="lobby">Retour au salon</button>'
    : '<button class="btn primary big" data-r="replay">Rejouer (prêt)</button><button class="btn big" data-r="lobby">Retour au salon</button>';
  function roomReplay() {
    if (!N.room) { UI.show('multi'); return; }
    if (N.isHost()) { UI.show('lobby'); setTimeout(() => hostStart(true), 250); }
    else { N.send({ t: 'ready', v: true }); UI.show('lobby'); UI.toast('Tu es prêt : la partie repart dès que l\'hôte relance.', 'ok'); }
  }
  function hostStart(force) {
    const r = N.room; if (!r || !N.isHost()) return;
    const others = r.players.filter(p => p.id !== r.host);
    const go = () => {
      if (partyRoom(r)) { N.send({ t: 'start', seed: BR.Party.pickSeed(), map: 'p_bousc' }); Au.ui('ok'); return; }
      if (doorsRoom(r)) {
        // l'hôte tire les images des portes (sans répétition) : tout le monde voit les mêmes
        N.send({ t: 'start', seed: (Math.random() * 2 ** 31) >>> 0, map: 'd_portes', cfg: { imgs: BR.Doors.planImages(150) } }); Au.ui('ok'); return;
      }
      if (arenaRoom(r)) {
        let teams = null;
        if (r.map === 'a_duel') {
          teams = roomTeams(r);
          if (r.players.length < 2) { UI.toast('Il faut au moins 2 joueurs pour un duel.', 'error'); return; }
          if (new Set(Object.values(teams)).size < 2) { UI.toast('Mets les joueurs dans au moins 2 équipes différentes.', 'error'); return; }
        }
        const map = r.map === 'a_random' ? 'a_' + BR.pick(AR().BOSSES).id : r.map;
        N.send({ t: 'start', seed: (Math.random() * 2 ** 31) >>> 0, map, cfg: { faces: BR.ArenaUI.pickFaces(8), teams, amap: r.map === 'a_asc' && BR.Asc && BR.Asc.selMap ? BR.Asc.selMap() : undefined } }); Au.ui('ok'); return;
      }
      const map = r.map === 'random' ? BR.pick(BR.MAPS).id : r.map;
      N.send({ t: 'start', seed: (Math.random() * 2 ** 31) >>> 0, map }); Au.ui('ok');
    };
    if (!force && others.some(p => !p.ready)) UI.confirm('Tout le monde n\'est pas prêt', 'Lancer la partie quand même ?', 'Lancer', false).then(ok => { if (ok) go(); });
    else go();
  }

  /* ================= personnage ================= */
  let charTab = 'skins', charSel = null, charBack = 'main';
  screen('char', {
    enter(n, o) {
      charBack = o.back || (curId === 'char' ? charBack : 'main');
      n.innerHTML = `<div class="panel wide">
        <div class="ph"><button class="btn ghost back" data-act="back">${ICO('back', 18)}</button><h2>Personnage</h2><div class="pts">${COIN(18)} <b class="ptsv"></b></div></div>
        <div class="char">
          <div class="cview"><canvas class="pv"></canvas><div class="chint">Glisse pour tourner · molette pour zoomer</div></div>
          <div class="cside">
            <div class="tabs"><button data-tab="skins">Personnages</button><button data-tab="auras">Auras</button></div>
            <div class="cgrid"></div>
            <div class="cdetail"></div>
          </div>
        </div></div>`;
      killPreview(); preview = Av.Preview(n.querySelector('.pv'), { stage: 'dressing' });
      n.querySelector('.cview').classList.toggle('d3', !!(preview && preview.stage));
      n.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { charTab = b.dataset.tab; charSel = null; Au.ui('click'); renderChar(); } });
      n.querySelector('.cgrid').addEventListener('click', e => { const b = e.target.closest('[data-it]'); if (b) { charSel = b.dataset.it; Au.ui('click'); renderChar(); } });
      n.querySelector('[data-act=back]').onclick = e => { e.stopPropagation(); Au.ui('back'); UI.show(charBack); };
      renderChar();
    },
    leave() { killPreview(); },
  });
  function renderChar() {
    const n = SCR.char.node, p = Acc.p; if (!n || curId !== 'char') return;
    n.querySelector('.ptsv').textContent = BR.fmt(p.points);
    n.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === charTab));
    const grid = n.querySelector('.cgrid'); grid.innerHTML = '';
    const tryLook = Object.assign({}, p.look);
    if (charTab === 'skins') {
      BR.SKINS.forEach(s => {
        const own = p.ownedSkins.includes(s.id), eq = p.look.skin === s.id;
        const myth = s.rarity === 'mythique';
        grid.appendChild(el('button', { class: 'citem' + (myth ? ' myth' : '') + (charSel === s.id ? ' sel' : '') + (eq ? ' eq' : ''), 'data-it': s.id, style: { '--rc': BR.RARITY[s.rarity].color, '--mc': s.eyes || BR.RARITY[s.rarity].color } },
          el('img', { src: thumb({ skin: s.id }, 120, 150), alt: '' }), el('b', null, s.name),
          el('span', { class: 'cprice', html: eq ? 'Équipé' : own ? 'Possédé' : s.price ? COIN(12) + ' ' + BR.fmt(s.price) : 'Gratuit' })));
      });
      if (charSel) tryLook.skin = charSel;
    } else {
      grid.appendChild(el('button', { class: 'citem none' + (charSel === '__none' ? ' sel' : '') + (!p.look.aura ? ' eq' : ''), 'data-it': '__none' }, el('div', { class: 'noimg', html: ICO('x', 40) }), el('b', null, 'Aucune'), el('span', { class: 'cprice' }, !p.look.aura ? 'Équipée' : '')));
      BR.AURAS.filter(a => !a.skinOnly).forEach(a => {
        const own = p.ownedAcc.includes(a.id), eq = p.look.aura === a.id;
        grid.appendChild(el('button', { class: 'citem' + (charSel === a.id ? ' sel' : '') + (eq ? ' eq' : ''), 'data-it': a.id, style: { '--rc': BR.RARITY[a.rarity].color } },
          el('img', { src: thumb({ skin: p.look.skin, aura: a.id }, 120, 150), alt: '' }), el('b', null, a.name),
          el('span', { class: 'cprice', html: eq ? 'Équipée' : own ? 'Possédée' : COIN(12) + ' ' + BR.fmt(a.price) })));
      });
      if (charSel) tryLook.aura = charSel === '__none' ? null : charSel;
    }
    if (preview) preview.setLook(tryLook);
    { const ts = BR.skinById(tryLook.skin), cv = n.querySelector('.cview'); cv.classList.toggle('myth', ts.rarity === 'mythique'); cv.style.setProperty('--mc', ts.eyes || '#ffd24a'); }
    // détail / action
    const det = n.querySelector('.cdetail'); det.innerHTML = ''; det.classList.remove('myth');
    if (!charSel) { det.innerHTML = '<span class="muted">Sélectionne un objet pour l\'essayer.</span>'; return; }
    if (charTab === 'skins') {
      const s = BR.skinById(charSel), own = p.ownedSkins.includes(s.id), eq = p.look.skin === s.id;
      det.innerHTML = `<div><b>${esc(s.name)}</b> ${rarityTag(s.rarity)}<p class="muted">${esc(s.desc)}${s.sig ? '<br><span class="tiny">Aura de base : ' + esc(BR.auraById(s.sig).name) + '</span>' : ''}</p>${s.feats ? `<div class="mfeats" style="--mc:${s.eyes || '#ff3d6e'}">${s.feats.map(f => `<span>${esc(f)}</span>`).join('')}</div>` : ''}</div>`;
      det.classList.toggle('myth', s.rarity === 'mythique');
      det.appendChild(actionBtn(own, eq, s.price, () => { const r = Acc.buySkin(s.id); if (r.ok && s.rarity === 'mythique') mythReveal(s); return r; }, () => Acc.equipSkin(s.id)));
    } else if (charSel === '__none') {
      const sig = BR.auraById(BR.skinById(p.look.skin).sig);
      det.innerHTML = `<div><b>Aucune aura équipée</b><p class="muted">${sig ? 'Ton personnage garde son aura de base : ' + esc(sig.name) + '.' : 'Ton personnage n\'aura pas d\'effet.'}</p></div>`;
      det.appendChild(el('button', { class: 'btn primary', onclick: () => { Acc.equipAura(null); Au.ui('ok'); renderChar(); } }, 'Retirer'));
    } else {
      const a = BR.auraById(charSel), own = p.ownedAcc.includes(a.id), eq = p.look.aura === a.id;
      det.innerHTML = `<div><b>${esc(a.name)}</b> ${rarityTag(a.rarity)}<p class="muted">${esc(a.desc)}</p></div>`;
      det.appendChild(actionBtn(own, eq, a.price, () => Acc.buyAura(a.id), () => Acc.equipAura(a.id)));
    }
  }
  // achat d'un skin mythique : écran de révélation + le personnage célèbre dans l'aperçu
  function mythReveal(s) {
    const c = s.eyes || BR.RARITY.mythique.color;
    const o = el('div', { class: 'myth-reveal', style: { '--mc': c } });
    o.innerHTML = `<div class="mr-rays"></div><div class="mr-ring"></div><div class="mr-card"><div class="mr-tag">${esc(BR.RARITY.mythique.label)} débloqué</div><div class="mr-name">${esc(s.name)}</div><div class="mr-sub">${esc(s.desc)}</div></div>`;
    const close = () => { o.classList.add('out'); setTimeout(() => o.remove(), 450); };
    o.addEventListener('click', close); document.body.appendChild(o); setTimeout(close, 3600);
    try { Au.fx('reveal', { rate: 1.6 }); Au.fx('boom', { g: 0.7, rate: 0.8 }); } catch (e) {}
    setTimeout(() => { if (preview && preview.celebrate) preview.celebrate(); }, 80);
  }
  function actionBtn(own, eq, price, buy, equip) {
    if (eq) return el('button', { class: 'btn ghost', disabled: true }, ico('check', 16), ' Équipé');
    if (own) return el('button', { class: 'btn primary', onclick: () => { equip(); Au.ui('ok'); renderChar(); } }, 'Équiper');
    const can = Acc.p.points >= price;
    return el('button', { class: 'btn ' + (can ? 'primary' : 'ghost'), onclick: () => {
      if (!can) { UI.toast('Il te manque ' + BR.fmt(price - Acc.p.points) + ' points.', 'error'); return; }
      UI.confirm('Acheter pour ' + BR.fmt(price) + ' points ?', '', 'Acheter', false).then(ok => { if (!ok) return; const r = buy(); if (r.ok) { Au.ui('buy'); UI.toast('Acheté et équipé !', 'good'); } else UI.toast(r.msg, 'error'); renderChar(); });
    } }, coinEl(14), ' Acheter ' + BR.fmt(price));
  }

  /* ================= boutique ================= */
  let shopBack = 'main';
  screen('shop', {
    enter(n, o) {
      if (o.back) shopBack = o.back; else if (!o.keep) shopBack = 'main';
      const d = Acc.dailyState();
      n.innerHTML = `<div class="panel wide">
        <div class="ph"><button class="btn ghost back">${ICO('back', 18)}</button><h2>Boutique</h2><div class="pts">${COIN(18)} <b class="ptsv"></b></div></div>
        <div class="shop">
          <div class="col"><p class="muted">Les objets s'achètent avec tes points. Choisis jusqu'à <b>3</b> objets à emporter : ils ne sont consommés que lorsque tu les utilises en partie.</p><div class="sgrid"></div></div>
          <div class="col side"><div class="lo-slot"></div>
            <div class="daily ${d.available ? 'avail' : ''}"><div><b>Récompense quotidienne</b><span>${d.available ? '+' + d.reward + ' points' : 'Déjà récupérée aujourd\'hui'}</span></div><button class="btn ${d.available ? 'primary' : 'ghost'}" ${d.available ? '' : 'disabled'} data-act="daily">${d.available ? 'Récupérer' : ICO('check', 16)}</button></div>
            <div class="earn"><h4>Gagner des points</h4><ul><li>Fusible : 40</li><li>Coéquipier relevé : 60</li><li>Évasion : 150</li><li>Équipe évadée : 50</li><li>MVP : 40</li><li>× multiplicateur de difficulté (jusqu'à ×2)</li></ul></div>
          </div>
        </div></div>`;
      n.querySelector('.back').onclick = () => { Au.ui('back'); UI.show(shopBack); };
      const lo = loadoutBox(); n.querySelector('.lo-slot').appendChild(lo);
      const render = () => {
        n.querySelector('.ptsv').textContent = BR.fmt(Acc.p.points);
        const g = n.querySelector('.sgrid'); g.innerHTML = '';
        BR.ITEM_ORDER.forEach(id => {
          const it = BR.ITEMS[id], have = Acc.p.inv[id] || 0, can = Acc.p.points >= it.price;
          g.appendChild(el('div', { class: 'sitem' },
            el('div', { class: 'si-ic' }, el('img', { src: BR.Icons.item(id), alt: '' })), el('div', { class: 'si-b' }, el('b', null, it.name), el('p', { class: 'muted' }, it.desc), el('span', { class: 'si-h' }, 'En stock : ' + have + ' · max ' + it.max + ' par partie')),
            el('button', { class: 'btn ' + (can ? 'primary' : 'ghost'), onclick: () => { const r = Acc.buyItem(id); if (r.ok) { Au.ui('buy'); UI.toast(it.name + ' acheté', 'good'); } else UI.toast(r.msg, 'error'); render(); lo.refresh(); } }, coinEl(14), ' ' + it.price)));
        });
      };
      render();
    },
  });

  /* ================= classement ================= */
  let lbTab = 'xp';
  screen('lb', {
    enter(n) {
      const p = Acc.p, s = p.stats, L = lvl();
      if (partyGame()) lbTab = 'bz'; else if (lbTab === 'bz') lbTab = 'xp';
      n.innerHTML = `<div class="panel wide">
        <div class="ph"><button class="btn ghost back" data-act="back">${ICO('back', 18)}</button><h2>Classement</h2></div>
        <div class="lb">
          <div class="col"><div class="tabs">${partyGame() ? '<button data-t="bz">🏆 Classé Bousculade</button>' : ''}<button data-t="xp">Expérience</button><button data-t="escapes">Évasions</button><button data-t="revives">Sauvetages</button></div><div class="lbl"><div class="empty"><div class="spin"></div>Chargement…</div></div></div>
          <div class="col side"><h4>Mes statistiques</h4>
            <div class="mystats">
              <div><b>${L.level}</b><span>Niveau</span></div><div><b>${BR.fmt(p.xp)}</b><span>XP totale</span></div>
              <div><b>${s.games}</b><span>Parties</span></div><div><b>${s.escapes}</b><span>Évasions</span></div>
              <div><b>${s.games ? Math.round(100 * s.escapes / s.games) : 0} %</b><span>Taux d'évasion</span></div><div><b>${s.fuses}</b><span>Fusibles</span></div>
              <div><b>${s.revives}</b><span>Relevés</span></div><div><b>${s.downs}</b><span>Chutes</span></div>
              <div><b>${BR.fmtTime(s.time)}</b><span>Temps de jeu</span></div><div><b>${s.multi}</b><span>Parties multi</span></div>
            </div>
            ${Acc.logged ? '' : '<p class="muted tiny">Tu joues en invité : crée un compte pour apparaître dans le classement.</p>'}
          </div>
        </div></div>`;
      let data = null;
      const render = () => {
        n.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === lbTab));
        const box = n.querySelector('.lbl'); if (!data) return;
        const list = lbTab === 'bz' ? (data.bz ? data.bz.top : []) : data[lbTab] || [];
        if (!list.length) { box.innerHTML = '<div class="empty">Personne pour l\'instant. Sois le premier !</div>'; return; }
        if (lbTab === 'bz') { box.innerHTML = `<div class="muted tiny" style="margin-bottom:6px">Saison ${esc(data.bz.season)} · remise à zéro partielle chaque mois</div><div class="lbt">${list.map((e, i) => { const t = BR.Party.tier(e.rp); return `<div class="lbr ${e.name.toLowerCase() === Acc.p.name.toLowerCase() ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}"><span class="rk">${i + 1}</span><img src="${thumb({ skin: e.skin }, 48, 60)}" alt=""><span class="nm">${esc(e.name)}<small style="color:${t.col}">${t.label} · ${e.w} victoire${e.w > 1 ? 's' : ''} / ${e.g}</small></span><span class="v">${BR.fmt(e.rp)} <small>RP</small></span></div>`; }).join('')}</div>`; return; }
        const unit = { xp: 'XP', escapes: 'évasions', revives: 'relevés' }[lbTab];
        box.innerHTML = `<div class="lbt">${list.map((e, i) => `<div class="lbr ${e.name.toLowerCase() === Acc.p.name.toLowerCase() ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}"><span class="rk">${i + 1}</span><img src="${thumb({ skin: e.skin }, 48, 60)}" alt=""><span class="nm">${esc(e.name)}<small>Niv. ${BR.levelFromXp(e.xp).level}</small></span><span class="v">${BR.fmt(e[lbTab])} <small>${unit}</small></span></div>`).join('')}</div><div class="muted tiny">${data.total} survivant${data.total > 1 ? 's' : ''} inscrit${data.total > 1 ? 's' : ''}</div>`;
      };
      n.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { lbTab = b.dataset.t; Au.ui('click'); render(); } });
      render();
      N.api('/api/leaderboard', { retries: 2, timeout: 60000 }).then(j => { data = j; if (curId === 'lb') render(); })
        .catch(e => { const box = n.querySelector('.lbl'); if (box) box.innerHTML = `<div class="empty">Classement indisponible.<br><span class="muted">${esc(e.message)}</span></div>`; });
    },
  });

  /* ================= paramètres ================= */
  let setBack = 'main';
  screen('settings', {
    enter(n, o) {
      if (o.back) setBack = o.back;
      const s = BR.settings;
      const rng = (k, label, min, max, step, fmt) => `<label class="sl"><span>${label}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><em data-v="${k}">${fmt(s[k])}</em></label>`;
      const pc = v => Math.round(v * 100) + ' %';
      n.innerHTML = `<div class="panel">
        <div class="ph"><button class="btn ghost back">${ICO('back', 18)}</button><h2>Paramètres</h2></div>
        <div class="settings">
          <h4>Son</h4>${rng('master', 'Volume général', 0, 1, 0.05, pc)}${rng('sfx', 'Effets', 0, 1, 0.05, pc)}${rng('amb', 'Ambiance', 0, 1, 0.05, pc)}${rng('mus', 'Musique', 0, 1, 0.05, pc)}
          <h4>Contrôles</h4>${rng('sens', 'Sensibilité souris', 0.2, 3, 0.05, v => (+v).toFixed(2))}
          <label class="chk"><input type="checkbox" data-c="invertY" ${s.invertY ? 'checked' : ''}> Inverser l'axe vertical</label>
          <h4>Touches <small class="muted">(Colosses, village et Backrooms)</small></h4>
          <p class="muted tiny">Clique sur une touche puis appuie sur la nouvelle. <b>Échap</b> : annuler · <b>Retour</b> ou <b>Suppr</b> : effacer la 2ᵉ touche.</p>
          <div class="keymap"></div>
          <div class="row"><button class="btn small ghost" data-kreset>Touches par défaut</button></div>
          <label class="chk"><input type="checkbox" data-c="autorun" ${s.autorun ? 'checked' : ''}> Backrooms : course automatique <span class="muted tiny">(on court dès qu'on avance, la touche de course fait marcher ; à cocher si ton clavier ne prend pas le saut pendant la course)</span></label>
          <h4>Affichage</h4>${rng('fov', 'Champ de vision', 60, 110, 1, v => v + '°')}
          <label class="sl"><span>Qualité</span><select data-q><option value="low">Basse (PC modeste)</option><option value="med">Moyenne</option><option value="high">Haute</option></select><em></em></label>
          <label class="chk"><input type="checkbox" data-c="bob" ${s.bob ? 'checked' : ''}> Balancement de la caméra</label>
          ${BR.Hud && BR.Hud.fxSettings ? BR.Hud.fxSettings() : ''}
          <label class="chk"><input type="checkbox" data-c="fps" ${s.fps ? 'checked' : ''}> Afficher les FPS</label>
          <h4>Serveur multijoueur</h4>
          <div class="srvset"><input class="srv-in" placeholder="${N.DEFAULT_SERVER}" value="${esc(BR.store.get('br_server', ''))}"><button class="btn small" data-s="test">Tester</button><button class="btn small ghost" data-s="def">Par défaut</button></div>
          <p class="muted tiny srv-res">Laisse vide pour utiliser le serveur officiel. Serveur actuel : ${esc(N.url || N.DEFAULT_SERVER)}</p>
          <h4>Données</h4>
          <div class="row"><button class="btn small ghost" data-s="reset">Réinitialiser les réglages</button></div>
        </div></div>`;
      n.querySelector('[data-q]').value = s.quality;
      // ---- touches : 2 par action, regroupées, conflits en rouge, capture de la prochaine touche ----
      const KB = BR.Keys, km = n.querySelector('.keymap');
      let capture = null;
      const paintKeys = () => {
        if (!KB || !km) return;
        const bad = KB.conflicts(), groups = [];
        KB.ACTIONS.forEach(a => { let g = groups.find(x => x.n === a.g); if (!g) groups.push(g = { n: a.g, list: [] }); g.list.push(a); });
        km.innerHTML = groups.map(g => `<div class="km-g"><b>${g.n}</b>${g.list.map(a => { const ks = [0, 1].map(i => (KB.get(a.id)[i]) || null);
          return `<div class="km-r"><span>${esc(a.n)}</span>${ks.map((c, i) => `<button class="km-k ${c && bad.has(a.id + '|' + c) ? 'bad' : ''} ${capture && capture.id === a.id && capture.i === i ? 'wait' : ''}" data-ka="${a.id}" data-ki="${i}">${capture && capture.id === a.id && capture.i === i ? 'Appuie…' : c ? esc(KB.name(c)) : '—'}</button>`).join('')}</div>`; }).join('')}</div>`).join('')
          + (bad.size ? '<p class="km-warn">Une même touche sert à deux actions en même temps (en rouge) : change l\'une des deux.</p>' : '');
      };
      paintKeys();
      const onCap = e => {
        if (!capture) return;
        e.preventDefault(); e.stopPropagation();
        if (e.code === 'Escape') { capture = null; paintKeys(); return; }
        if (e.code === 'Backspace' || e.code === 'Delete') { if (capture.i === 1) KB.set(capture.id, 1, null); capture = null; Au.ui('back'); paintKeys(); return; }
        KB.set(capture.id, capture.i, e.code); capture = null; Au.ui('ok'); paintKeys();
      };
      window.addEventListener('keydown', onCap, true);
      n._keysOff = () => window.removeEventListener('keydown', onCap, true);
      if (km) km.addEventListener('click', e => { const b = e.target.closest('[data-ka]'); if (!b) return; capture = { id: b.dataset.ka, i: +b.dataset.ki }; Au.ui('click'); paintKeys(); });
      const kr = n.querySelector('[data-kreset]'); if (kr) kr.onclick = () => { KB.reset(); capture = null; Au.ui('ok'); paintKeys(); UI.toast('Touches par défaut rétablies.', 'good'); };
      n.querySelector('.back').onclick = () => { if (n._keysOff) n._keysOff(); Au.ui('back'); UI.show(setBack); };
      n.addEventListener('input', e => {
        const k = e.target.dataset.k; if (!k) return;
        s[k] = +e.target.value; const v = n.querySelector(`[data-v="${k}"]`);
        if (v) v.textContent = k === 'sens' ? (+s[k]).toFixed(2) : k === 'fov' ? s[k] + '°' : Math.round(s[k] * 100) + ' %';
        BR.saveSettings();
      });
      n.addEventListener('change', e => {
        const c = e.target.dataset.c; if (c) { s[c] = e.target.checked; BR.saveSettings(); }
        if (e.target.dataset.q != null) { s.quality = e.target.value; BR.saveSettings(); UI.toast('Qualité appliquée (l\'anticrénelage change au prochain lancement).'); }
      });
      n.querySelector('.srvset').addEventListener('click', e => {
        const a = e.target.dataset.s; if (!a) return;
        const inp = n.querySelector('.srv-in'), res = n.querySelector('.srv-res');
        if (a === 'def') { inp.value = ''; N.setServer(''); res.textContent = 'Serveur officiel rétabli.'; }
        if (a === 'test') {
          N.setServer(inp.value.trim()); res.textContent = 'Test en cours… (réveil possible : jusqu\'à 1 minute)';
          N.resolve(true).then(() => N.wake()).then(j => { res.textContent = `Serveur joignable (v${j.v}) — ${j.online} en ligne, ${j.accounts} comptes, stockage : ${j.storage}${j.storageOk ? '' : ' (erreur de stockage)'}`; })
            .catch(err => { res.textContent = 'Échec : ' + err.message; });
        }
      });
      n.querySelector('[data-s=reset]').onclick = () => UI.confirm('Réinitialiser les réglages ?', 'Volume, souris et affichage reprennent leurs valeurs par défaut.', 'Réinitialiser').then(ok => {
        if (!ok) return; Object.assign(BR.settings, { sens: 1, fov: 80, quality: 'high', fps: false, invertY: false, master: 0.8, sfx: 1, amb: 0.8, mus: 0.6, bob: true, autorun: false }); BR.saveSettings(); UI.show('settings');
      });
    },
  });

  /* ================= résultats ================= */
  function showResults(sum) {
    document.body.classList.remove('ingame');
    BR.MenuBG.start();
    UI.show('results', sum);
  }
  screen('results', {
    enter(n, sum) {
      const res = sum.res, me = res.players[sum.selfId] || {}, rw = sum.reward, lv = sum.level;
      const title = res.aborted ? 'PARTIE INTERROMPUE' : me.e ? 'ÉVADÉ !' : sum.solo ? 'DISPARU…' : res.won ? 'TON ÉQUIPE S\'EST ÉCHAPPÉE' : 'PERSONNE N\'EST SORTI';
      const cls = me.e ? 'win' : res.won ? 'mid' : 'lose';
      const multi = Object.keys(res.players).length > 1;
      const rows = Object.entries(res.players).map(([id, p]) => `<tr class="${id === sum.selfId ? 'me' : ''}"><td><img src="${thumb({ skin: p.sk || 'survivor' }, 40, 50)}" alt="">${esc(p.n)}${res.mvp === id && multi ? ' <span class="mvp">MVP</span>' : ''}</td><td>${p.e ? '<span class="ok">Évadé</span>' : p.x ? '<span class="bad">Disparu</span>' : '—'}</td><td>${p.f}</td><td>${p.r}</td><td>${p.d}</td></tr>`).join('');
      const inRoom = !sum.solo && N.room && N.status === 'on';
      n.innerHTML = `<div class="panel results ${cls}">
        <div class="r-title">${title}</div>
        <div class="r-sub">${esc(sum.map.name)} — ${esc(sum.map.sub)} · <span style="color:${sum.diff.color}">${sum.diff.name}</span> · ${BR.fmtTime(res.time)}${sum.reason ? ' · ' + esc(sum.reason) : ''}${sum.newBest ? ' · nouveau record !' : ''}</div>
        <div class="r-grid">
          ${multi ? `<div class="col"><table class="rtab"><tr><th>Joueur</th><th>Issue</th><th>Fusibles</th><th>Relevés</th><th>Chutes</th></tr>${rows}</table></div>` : ''}
          <div class="col">
            <div class="rlines">${rw.lines.map(l => `<div><span>${esc(l.label)}</span><b>+${l.v}</b></div>`).join('') || '<div class="muted">Aucun gain cette fois…</div>'}
              ${rw.mult !== 1 ? `<div class="mul"><span>Multiplicateur ${esc(sum.diff.name)}</span><b>×${rw.mult}</b></div>` : ''}</div>
            <div class="rtotal"><span>Points gagnés</span><b class="cnt">0</b></div>
            <div class="rxp"><div class="lvl">Niveau <b class="lvn">${lv.before.level}</b></div><div class="xpbar"><i style="width:${(lv.before.into / lv.before.need) * 100}%"></i><span>+${rw.xp} XP</span></div></div>
            <div class="lvup">NIVEAU SUPÉRIEUR ! <b></b></div>
          </div>
        </div>
        <div class="row center">
          ${sum.solo ? '<button class="btn primary big" data-r="again">Rejouer</button>' : inRoom ? roomEndButtons() : '<button class="btn primary big" data-r="multi">Multijoueur</button>'}
          <button class="btn big" data-r="main">Menu principal</button>
        </div></div>`;
      // animations
      const cnt = n.querySelector('.cnt'), t0 = performance.now(), dur = 1200;
      const tick = now => { const k = Math.min(1, (now - t0) / dur); cnt.textContent = BR.fmt(rw.points * (1 - Math.pow(1 - k, 3))); if (k < 1 && cnt.isConnected) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      setTimeout(() => {
        const bar = n.querySelector('.rxp .xpbar i'); if (!bar) return;
        if (lv.levelUp) {
          bar.style.width = '100%';
          setTimeout(() => { if (!bar.isConnected) return; bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = ''; bar.style.width = (lv.after.into / lv.after.need) * 100 + '%'; n.querySelector('.lvn').textContent = lv.after.level; const u = n.querySelector('.lvup'); u.querySelector('b').textContent = lv.after.level + ' — ' + BR.rankName(lv.after.level); u.classList.add('on'); Au.ui('buy'); }, 900);
        } else bar.style.width = (lv.after.into / lv.after.need) * 100 + '%';
      }, 600);
      if (me.e) Au.ui('ok');
      n.addEventListener('click', e => {
        const b = e.target.closest('[data-r]'); if (!b) return; const a = b.dataset.r; Au.ui('click');
        if (a === 'again') startSolo();
        else if (a === 'replay') roomReplay();
        else if (a === 'lobby') UI.show(N.room ? 'lobby' : 'multi');
        else UI.show(a);
      });
    },
  });

  /* ================= jeu 3 : LES PORTES ================= */
  let dDiff = BR.store.get('br_doors_diff', 'normal');
  const doorsBest = id => (((Acc.p.stats || {}).best) || {})['portes_' + id] || 0;
  const plural = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');
  const monURL = {};
  function monsterURL(i) {   // petite vignette d'une image de monstre (menu)
    if (monURL[i] != null) return monURL[i];
    const s = BR.Ent.sprite(i); if (!s || !s.canvas) return '';
    try {
      const c = document.createElement('canvas'), k = Math.min(1, 240 / Math.max(s.canvas.width, s.canvas.height));
      c.width = Math.max(1, (s.canvas.width * k) | 0); c.height = Math.max(1, (s.canvas.height * k) | 0); c.getContext('2d').drawImage(s.canvas, 0, 0, c.width, c.height);
      return (monURL[i] = c.toDataURL('image/png'));
    } catch (e) { return ''; }
  }
  const doorsRules = () => `<ul class="d-rl">
      <li>${ICO('door', 18)} <span><b>Questions de BUT GMP</b> : deux portes, une réponse sur chaque. Fonce dans la bonne. La mauvaise s'ouvre sur le noir… et l'image collée dessus te poursuit.</span></li>
      <li>${ICO('run', 18)} <span><b>Toutes les 5 questions, une salle à thème</b> : plateformes au-dessus de la lave, plancher qui s'effondre, lasers, 1-2-3 soleil, labyrinthe éteint, poursuite…</span></li>
      <li>${ICO('lock', 18)} <span><b>Ou une énigme</b> : bonne clé à trouver, digicode, interrupteurs, portes piégées à indices. Trop lent ? Le gardien de la salle arrive.</span></li>
      <li>${ICO('eye', 18)} <span><b>Entités</b> : ne regarde pas celle qui flotte, cache-toi dans une armoire quand les lumières clignotent.</span></li>
      <li>${ICO('heart', 18)} <span><b>Vies</b> (Calme 5 · Normal 3 · Panique 1) : un échec coûte une vie et te renvoie au début de la salle. La salle de pause en offre une.</span></li>
      <li>${ICO('users', 18)} <span><b>À plusieurs</b> : mêmes salles pour tous. La porte s'ouvre quand tous les survivants sont dans la salle ; une énigme résolue l'est pour tout le monde.</span></li>
      <li>${COIN(18)} <span><b>10 points par salle</b>, +50 toutes les 10 salles, multipliés par la difficulté (Calme ×0,7 · Normal ×1 · Panique ×1,5).</span></li>
    </ul>`;
  function doorsRulesBox() {
    return el('div', { class: 'd-lrules', html: `<h4>Règles des Portes</h4>${doorsRules()}` });
  }
  function doorsRulesModal() {
    modal(box => {
      box.insertAdjacentHTML('beforeend', `<h3>Les Portes — règles</h3>${doorsRules()}
        <h4>Contrôles</h4><div class="d-keys"><span><b>Z Q S D</b> / flèches : avancer</span><span><b>Souris</b> : regarder</span><span><b>Maj</b> : courir</span><span><b>Espace</b> : sauter</span><span><b>C</b> : s'accroupir (en courant : glisser)</span><span><b>E</b> : prendre, actionner, se cacher</span><span><b>Chiffres</b> : digicode</span><span><b>Échap</b> : pause</span></div>
        <p class="muted tiny">12 salles à thème tirées au hasard, de plus en plus dures, et une salle de pause de temps en temps. ${BR.Doors.QUESTIONS.length} questions de BUT GMP (usinage, métrologie, RDM, matériaux, cotation, CAO, automatisme…) pour les salles « question ».</p>`);
    }, { cls: 'd-rules' });
  }
  function launchDoors(o) {
    BR.$$('.modal-back').forEach(m => m.remove());
    killPreview(); BR.MenuBG.stop(); if (BR.ArenaUI) BR.ArenaUI.bg(false);
    o.onEnd = sum => { BR.MenuBG.start(); UI.show('d-end', sum); };
    try { BR.Doors.start(o); }
    catch (e) { console.error(e); try { BR.Doors.stop(); } catch (_) {} UI.toast('Erreur au lancement : ' + e.message, 'error'); UI.show(o.mode === 'multi' ? (N.room ? 'lobby' : 'multi') : 'portes'); }
  }
  function startDoorsSolo() {
    Au.ui('ok');
    const p = Acc.p;
    launchDoors({ mode: 'solo', diff: dDiff, seed: (Math.random() * 2 ** 31) >>> 0, roster: [{ id: 'me', name: p.name, look: p.look, level: lvl().level }], selfId: 'me', hostId: 'me' });
    if (BR.Doors.active) BR.Doors.lock();
  }
  UI.startDoorsSolo = startDoorsSolo;

  /* ================= jeu 4 : BOUSCULADE ================= */
  function partyRules() {
    return `<ul class="d-rules"><li><b>Une partie = 4 manches</b> à 8 joueurs (les places libres sont prises par des bots) : <b>course</b> → <b>survie</b> → <b>course</b> → <b>finale</b>. À chaque manche, une partie des joueurs est éliminée.</li>
      <li><b>Courses</b> : 27 cartes (dont 16 grands tracés : Grand Tour, Temple perdu, Volcan, Base spatiale, Jungle, Château, Plage, Cité néon, Désert, Nuages, Port pirate, Usine à robots…), jamais deux fois la même. Les premiers arrivés passent.</li>
      <li><b>Manches de survie</b> : <b>La Toupie</b>, <b>Les Trois Étages</b>, <b>L'Île qui rétrécit</b> (le poteau du milieu ne tombe jamais… si tu arrives à y rester), <b>La Bombe</b> (refile-la au toucher avant le BOUM). Elles s'arrêtent dès qu'il ne reste que la moitié des joueurs.</li>
      <li><b>Manches à score</b> : <b>La Couronne</b> (garde-la le plus longtemps : plonge ou attrape celui qui l'a pour la voler), <b>Le Roi de la colline</b> (reste dans la zone qui se déplace), <b>Le Foot fou</b> (en équipe, ballon géant, but en or en cas d'égalité), <b>La Chasse aux œufs</b> (rapporte les œufs dans le nid de ton équipe, vole ceux d'en face) et <b>La Guerre des couleurs</b> (2 équipes peignent le sol ; l'équipe qui en a le moins est éliminée). En finale, le dernier qualifié gagne la couronne 👑.</li>
      <li><b>Classé</b> (avec un compte) : gagne des points de rang selon ta place, de Bronze à Champion. Saison mensuelle, classement mondial.</li>
      <li><b>Cours sur les murs</b> : saute contre un mur en allant vite, tu cours dessus 0,8 s puis tu glisses ; ressaute pour rebondir. <b>Plonge</b> (Maj ou A) pour aller plus loin ou faire tomber les autres. <b>Attrape</b> (clic gauche, toutes les 3,5 s) pour ralentir et tirer quelqu'un. Tomber pendant la course = retour au dernier point de passage.</li></ul>`;
  }
  function partyRulesBox() { return el('div', { class: 'd-lrules', html: `<h4>Règles de la Bousculade</h4>${partyRules()}` }); }
  function launchParty(o) {
    BR.$$('.modal-back').forEach(m => m.remove());
    killPreview(); BR.MenuBG.stop(); if (BR.ArenaUI) BR.ArenaUI.bg(false);
    o.onEnd = a => { BR.MenuBG.start(); if (a === 'trial') { startTrial(); return; } if (a === 'replay') startPartySolo(o.tuto ? undefined : o.forceMap); else UI.show(o.mode === 'multi' && N.room ? 'lobby' : 'party'); };
    try { BR.Party.start(o); }
    catch (e) { console.error(e); try { BR.Party.stop(); } catch (_) {} UI.toast('Erreur au lancement : ' + e.message, 'error'); UI.show(o.mode === 'multi' ? (N.room ? 'lobby' : 'multi') : 'party'); }
  }
  // récompenses de la Bousculade : quêtes du jour, passe de saison, chapeaux, traînées
  function partyRewards() {
    Au.ui('click');
    modal(box => {
      const draw = () => {
        const R = BR.Party.rewards(), b = R.b, lvx = R.sx - R.lv * R.PASS_XP;
        const ic = r => r[0] === 'pts' ? '🪙' : r[0] === 'hat' ? R.HATS[r[1]].ico : R.TRAILS[r[1]].ico, nm = r => r[0] === 'pts' ? r[1] + ' pts' : r[0] === 'hat' ? R.HATS[r[1]].n : R.TRAILS[r[1]].n;
        const cos = (kind, D) => `<div class="rw-cos">${[['', { n: 'Aucun', ico: '🚫' }]].concat(Object.entries(D)).map(([id, d]) => { const own = !id || b.own.includes(id), on = (kind === 'hat' ? b.hat || '' : b.trail || '') === id; return `<button data-k="${kind}" data-id="${id}" class="${on ? 'on' : ''}" ${own ? '' : 'disabled'} title="${esc(d.n)}"><b>${own ? d.ico : '🔒'}</b>${esc(d.n)}</button>`; }).join('')}</div>`;
        box.innerHTML = `<h3>🎁 Récompenses de la Bousculade</h3><div class="rw">
          <div><h4>QUÊTES DU JOUR <small class="muted">(nouvelles chaque jour · +120 points et +100 XP de saison chacune)</small></h4>${R.quests.map(q => `<div class="rw-q ${q.c ? 'ok' : ''}"><span>${q.c ? '✅ ' : ''}${esc(q.t)}</span><b>${q.p} / ${q.n}</b><i><u style="width:${Math.round(q.p / q.n * 100)}%"></u></i></div>`).join('')}</div>
          <div><h4>PASSE DE SAISON · palier ${R.lv} / ${R.PASS.length}</h4>${R.lv < R.PASS.length ? `<div class="rw-bar"><u style="width:${Math.round(lvx / R.PASS_XP * 100)}%"></u></div><small class="muted">${R.PASS_XP - lvx} XP avant le palier ${R.lv + 1} · on gagne de l'XP en jouant, en se qualifiant et avec les quêtes</small>` : '<small>Passe terminé, bravo !</small>'}
            <div class="rw-pass" style="margin-top:8px">${R.PASS.map((r, i) => `<div class="${i < R.lv ? 'got' : i === R.lv ? 'nx' : ''}"><b>${ic(r)}</b>${i + 1}<br>${esc(nm(r))}</div>`).join('')}</div></div>
          <div><h4>RÉCOMPENSES DU CLASSÉ</h4><div class="rw-pass">${R.RANK_REW.map(([rp, k, id]) => { const d = k === 'hat' ? R.HATS[id] : R.TRAILS[id], got = b.own.includes(id), t = BR.Party.tier(rp); return `<div class="${got ? 'got' : ''}" style="min-width:110px"><b>${d.ico}</b>${esc(d.n)}<br><span style="color:${t.col}">${t.label}</span></div>`; }).join('')}</div></div>
          <div><h4>CHAPEAU</h4>${cos('hat', R.HATS)}</div>
          <div><h4>TRAÎNÉE <small class="muted">(derrière toi quand tu cours vite)</small></h4>${cos('trail', R.TRAILS)}</div>
        </div>`;
        box.querySelectorAll('.rw-cos button').forEach(bt => bt.addEventListener('click', () => { if (BR.Party.equip(bt.dataset.k, bt.dataset.id)) { Au.ui('ok'); draw(); } }));
      };
      draw();
    });
  }
  // file classée : il faut un compte ; le serveur nous place dans un salon classé (ou en ouvre un)
  let rkWant = false;
  function rankedQueue() {
    if (!Acc.logged) { Au.ui('err'); UI.toast('Le mode classé demande un compte (gratuit) : crée-le dans Compte.', 'error'); return; }
    Au.ui('click'); UI.toast('🏆 Recherche d’une partie classée…', 'ok'); rkWant = true;
    const go = () => N.rquick();
    if (N.status === 'on') go(); else N.connect().then(go).catch(() => { rkWant = false; UI.toast('Serveur injoignable, réessaie dans un instant.', 'error'); });
  }
  // salon classé : l'hôte lance tout seul (salon plein, ou 30 s d'attente : les bots complètent)
  let rkT0 = 0, rkRoomState = '';
  setInterval(() => {
    const r = N.room; if (!r || !r.ranked) { rkRoomState = ''; return; }
    const st = BR.Party.session() ? 'game' : r.state;
    if (st !== rkRoomState) { rkRoomState = st; rkT0 = Date.now(); }
    if (st !== 'lobby' || curId !== 'lobby') return;
    const left = Math.max(0, 30 - Math.floor((Date.now() - rkT0) / 1000)), full = r.players.length >= (r.max || 8);
    const n = SCR.lobby && SCR.lobby.node; if (n) { let b = n.querySelector('.rk-banner'); if (!b) { b = el('div', { class: 'rk-banner' }); n.prepend(b); } b.innerHTML = `🏆 <b>Partie classée</b> · ${r.players.length}/${r.max || 8} joueurs · départ ${full ? 'immédiat' : 'dans ' + left + ' s'} <small>(les places vides sont prises par des bots)</small>`; }
    if (N.isHost() && (full || left <= 0) && !inGame() && !BR.Party.session()) { rkT0 = Date.now() + 1e9; hostStart(true); }
  }, 1000);
  function startTuto() { Au.ui('ok'); const p = Acc.p; launchParty({ mode: 'solo', tuto: true, forceMap: BR.Party.tutoIdx(), seed: 99, roster: [{ id: 'me', name: p.name, look: p.look, level: lvl().level }], selfId: 'me', hostId: 'me' }); }
  function startPartySolo(forceMap) {
    if (forceMap == null && !BR.store.get('bz_tuto', 0) && BR.Party.progress().games === 0) { startTuto(); return; }   // toute première partie : le tutoriel
    Au.ui('ok');
    const p = Acc.p;
    launchParty({ mode: 'solo', forceMap: typeof forceMap === 'number' ? forceMap : undefined, seed: BR.Party.pickSeed(), roster: [{ id: 'me', name: p.name, look: p.look, level: lvl().level }], selfId: 'me', hostId: 'me' });
  }
  UI.startPartySolo = startPartySolo;
  function startTrial() { Au.ui('ok'); const p = Acc.p; launchParty({ mode: 'solo', trial: true, forceMap: BR.Party.dailyMap(), seed: 777, roster: [{ id: 'me', name: p.name, look: p.look, level: lvl().level }], selfId: 'me', hostId: 'me' }); }
  screen('party', {
    enter(n) {
      BR.curGame = 'bousculade'; Au.track('music', 'menu', 0.8); try { BR.Party.prep(); } catch (e) {}
      const pg = BR.Party.progress(), fm = t => Math.floor(t / 60) + ':' + String((t % 60).toFixed(1)).padStart(4, '0');
      n.innerHTML = `<div class="main pt-main">
        <div class="main-left">
          <div class="logo"><div class="logo-t">BOUSCULADE</div><div class="logo-s">C O U R S , &nbsp; S A U T E , &nbsp; P L O N G E , &nbsp; B O U S C U L E .</div></div>
          <nav class="menu">
            <button class="mi d-hot pt-rkbtn" data-go="ranked"><span>🏆 Classé</span><small>${N.rk ? BR.Party.tier(N.rk.rp).label + ' · ' + N.rk.rp + ' RP' : 'Grimpe de Bronze à Champion · saison mensuelle'}</small></button>
            <button class="mi d-hot" data-go="multi"><span>Multijoueur</span><small>Jusqu'à 8 potes · le dernier debout gagne</small></button>
            <button class="mi d-hot" data-go="solo"><span>▶ Jouer contre des bots</span><small>4 manches · 27 cartes, 10 manches spéciales</small></button>
            <button class="mi d-hot" data-go="trial"><span>⏱ Défi du jour</span><small>${(() => { const d = BR.Party.dailyInfo(); return esc(d.name) + (d.best ? ' · ton record : ' + d.best.toFixed(1) + ' s' : ' · seul contre le chrono'); })()}</small></button>
            <button class="mi d-hot" data-go="rewards"><span>🎁 Récompenses</span><small>${(() => { const R = BR.Party.rewards(); return R.quests.filter(q => !q.c).length + ' quête(s) du jour · passe palier ' + R.lv + '/' + R.PASS.length; })()}</small></button>
            <button class="mi" data-go="tuto"><span>🎓 Tutoriel</span><small>Apprends les mouvements en 1 minute</small></button>
            <button class="mi" data-go="lb"><span>Classement mondial</span><small>Les meilleurs joueurs de la saison</small></button>
            <button class="mi" data-go="char"><span>Personnage</span><small>Ce que voient les autres joueurs</small></button>
            <button class="mi back" data-go="hub"><span>${ICO('back', 16)} Changer de jeu</span></button>
          </nav>
        </div>
        <div class="main-right"><div class="d-lrules" style="max-width:520px"><h4>Comment ça marche</h4>${partyRules()}
          <p style="margin-top:10px;font-weight:800">👑 <b>${pg.crowns}</b> couronne${pg.crowns > 1 ? 's' : ''} · titre : <b style="color:#ff4f9e">${BR.Party.title(pg.crowns)}</b> · ${pg.games} partie${pg.games > 1 ? 's' : ''} · ${pg.quals} finale${pg.quals > 1 ? 's' : ''}</p>
          <div class="muted" style="display:grid;grid-template-columns:1fr auto;gap:2px 14px;font-size:13px;margin:6px 0 8px;max-height:150px;overflow:auto;padding-right:6px">${pg.maps.map(m => `<span>${esc(m.name)}</span><b>${m.t ? fm(m.t) : '—'}</b>`).join('')}</div>
          <p class="muted"><b>ZQSD</b> courir · <b>Espace</b> sauter · <b>Maj / A</b> plonger · <b>Clic gauche</b> attraper · <b>1-4</b> émotes · <b>Souris</b> caméra</p></div>
          <button class="btn primary big pt-go" style="margin-top:14px">${ICO('play', 18)} JOUER EN MULTIJOUEUR</button></div></div>`;
      n.querySelectorAll('[data-go]').forEach(bt => bt.addEventListener('click', () => {
        const go = bt.dataset.go;
        if (go === 'ranked') { rankedQueue(); return; }
        if (go === 'rewards') { partyRewards(); return; }
        if (go === 'trial') { startTrial(); return; }
        if (go === 'tuto') { startTuto(); return; }
        if (go === 'solo') { startPartySolo(); return; }
        if (go === 'tour') { const pm = BR.Party.pathMaps(); startPartySolo(pm[Math.floor(Math.random() * pm.length)]); return; }
        if (go === 'rules') { Au.ui('click'); modal(box => box.insertAdjacentHTML('beforeend', `<h3>Bousculade — règles</h3>${partyRules()}`)); return; }
        Au.ui(go === 'hub' ? 'back' : 'click');
        UI.show(go, go === 'char' ? { back: 'party' } : {});
      }));
      n.querySelector('.pt-go').addEventListener('click', () => { Au.ui('click'); UI.show('multi'); });
    },
  });

  screen('portes', {
    enter(n) {
      BR.curGame = 'portes'; Au.track('music', 'menu', 0.8);
      if (!DD()[dDiff]) dDiff = 'normal';
      // illustration : une vraie question et deux vraies images du jeu
      const cnt = BR.Ent.count(), a = cnt ? BR.randInt(0, cnt - 1) : -1, b = cnt > 1 ? (a + 1 + BR.randInt(0, cnt - 2)) % cnt : a;
      const q = BR.pick(BR.Doors.QUESTIONS.filter(x => x[3] === 1)), g = Math.random() < 0.5 ? 0 : 1, ans = g === 0 ? [q[1], q[2]] : [q[2], q[1]];
      n.innerHTML = `<div class="main d-main">
        <div class="main-left">
          <div class="logo"><div class="logo-t d-logo glitch" data-t="LES PORTES">LES PORTES</div><div class="logo-s">U N E &nbsp; S A L L E , &nbsp; U N &nbsp; D É F I . &nbsp; E N C O R E &nbsp; U N E .</div></div>
          <nav class="menu">
            <button class="mi" data-go="solo"><span>Jouer en solo</span><small>Toi contre une infinité de salles</small></button>
            <button class="mi d-hot" data-go="multi"><span>Multijoueur</span><small>Mêmes salles pour tous</small></button>
            <button class="mi" data-go="rules"><span>Règles</span><small>Lave, lasers, clés, entités…</small></button>
            <button class="mi" data-go="char"><span>Personnage</span><small>Ce que voient les autres joueurs</small></button>
            <button class="mi back" data-go="hub"><span>${ICO('back', 16)} Changer de jeu</span></button>
          </nav>
        </div>
        <div class="main-right">
          <div class="d-art">
            <div class="d-art-q"><i>SALLE 1</i><span>${esc(q[0])}</span></div>
            <div class="d-art-doors">${[a, b].map((im, s) => `<div class="d-art-door"><div class="pl">${esc(ans[s])}</div><div class="im">${im >= 0 && monsterURL(im) ? `<img src="${monsterURL(im)}" alt="">` : ''}</div><i class="hd"></i></div>`).join('')}</div>
          </div>
          <div class="d-diffs">${Object.values(DD()).map(d => { const bst = doorsBest(d.id); return `<button class="d-dc ${d.id === dDiff ? 'on' : ''}" data-d="${d.id}" style="--dc:${d.color}"><b>${d.name}</b><span>${esc(d.desc)}</span><em>${bst ? ICO('trophy', 13) + ' Record : ' + plural(bst, 'salle') : 'Pas encore de record'}</em></button>`; }).join('')}</div>
          <button class="btn primary big d-go">${ICO('play', 18)} JOUER EN SOLO</button>
        </div></div>`;
      n.querySelectorAll('[data-go]').forEach(bt => bt.addEventListener('click', () => {
        const go = bt.dataset.go;
        if (go === 'solo') { startDoorsSolo(); return; }
        if (go === 'rules') { Au.ui('click'); doorsRulesModal(); return; }
        Au.ui(go === 'hub' ? 'back' : 'click');
        UI.show(go, go === 'char' ? { back: 'portes' } : {});
      }));
      n.querySelector('.d-diffs').addEventListener('click', e => {
        const bt = e.target.closest('[data-d]'); if (!bt) return;
        dDiff = bt.dataset.d; BR.store.set('br_doors_diff', dDiff); Au.ui('click');
        n.querySelectorAll('.d-dc').forEach(x => x.classList.toggle('on', x.dataset.d === dDiff));
      });
      n.querySelector('.d-go').addEventListener('click', startDoorsSolo);
    },
  });

  screen('d-end', {
    enter(n, sum) {
      sum = sum || {};
      const rw = sum.reward || { points: 0, xp: 0, lines: [], mult: 1 }, lv = sum.level || { before: lvl(), after: lvl(), levelUp: false };
      const d = sum.diff || DD().normal, res = sum.res || { players: {} }, dth = sum.death, score = sum.score || 0;
      const multi = !sum.solo && Object.keys(res.players).length > 1;
      const title = sum.aborted ? 'PARTIE INTERROMPUE' : sum.newBest ? 'NOUVEAU RECORD' : sum.title || (score >= 10 ? 'ATTRAPÉ… APRÈS UN BEAU PARCOURS' : 'ATTRAPÉ');
      const why = !dth ? '' : dth.why ? dth.why : dth.reason === 'time' ? 'Temps écoulé' : dth.reason === 'dark' ? 'Tu es entré dans le noir' : dth.reason === 'quit' ? '' : 'Mauvaise porte';
      const rows = Object.entries(res.players).sort((x, y) => (y[1].s || 0) - (x[1].s || 0)).map(([id, p], i) => `<tr class="${id === sum.selfId ? 'me' : ''}"><td>${i + 1}</td><td><img src="${thumb({ skin: p.sk || 'survivor' }, 40, 50)}" alt="">${esc(p.n)}</td><td><b>${p.s || 0}</b></td><td>${p.x ? '<span class="bad">Disparu</span>' : '<span class="ok">Debout</span>'}</td></tr>`).join('');
      const inRoom = !sum.solo && N.room && N.status === 'on';
      n.innerHTML = `<div class="panel results d-end ${sum.newBest ? 'win' : 'lose'}">
        <div class="r-title">${title}</div>
        <div class="r-sub">Les Portes · <span style="color:${d.color}">${esc(d.name)}</span>${why ? ' · ' + esc(why) : ''}${sum.reason ? ' · ' + esc(sum.reason) : ''}</div>
        <div class="r-grid">
          <div class="col">
            <div class="d-big"><b>${score}</b><span>${sum.unit ? sum.unit[score > 1 ? 1 : 0] : score > 1 ? 'portes franchies' : 'porte franchie'}</span><small>Record (${esc(d.name)}) : ${sum.best || score}${sum.newBest && sum.prevBest ? ' · ancien : ' + sum.prevBest : ''}</small></div>
            ${dth && dth.q ? `<div class="d-death"><div class="dq"><i>SALLE ${dth.k + 1}</i>${esc(dth.q)}</div>
              <div class="da ok">${ICO('check', 16)} Bonne réponse : <b>${esc(dth.good)}</b></div>
              ${dth.reason === 'wrong' || dth.reason === 'dark' ? `<div class="da bad">${ICO('x', 16)} Ta porte : ${esc(dth.bad)}</div>` : dth.reason === 'time' ? `<div class="da bad">${ICO('x', 16)} Tu n'as pas choisi à temps</div>` : ''}</div>` : ''}
            ${multi ? `<table class="rtab"><tr><th>#</th><th>Joueur</th><th>Portes</th><th>Issue</th></tr>${rows}</table>` : ''}
          </div>
          <div class="col">
            <div class="rlines">${rw.lines.map(l => `<div><span>${esc(l.label)}</span><b>+${l.v}</b></div>`).join('') || '<div class="muted">Aucun gain cette fois…</div>'}
              ${rw.mult !== 1 ? `<div class="mul"><span>Multiplicateur ${esc(d.name)}</span><b>×${String(rw.mult).replace('.', ',')}</b></div>` : ''}</div>
            <div class="rtotal"><span>Points gagnés</span><b class="cnt">0</b></div>
            <div class="rxp"><div class="lvl">Niveau <b class="lvn">${lv.before.level}</b></div><div class="xpbar"><i style="width:${(lv.before.into / lv.before.need) * 100}%"></i><span>+${rw.xp} XP</span></div></div>
            <div class="lvup">NIVEAU SUPÉRIEUR ! <b></b></div>
          </div>
        </div>
        <div class="row center">
          ${sum.solo ? '<button class="btn primary big" data-r="again">Rejouer</button>' : inRoom ? roomEndButtons() : '<button class="btn primary big" data-r="multi">Multijoueur</button>'}
          <button class="btn big" data-r="portes">Menu des Portes</button>
        </div></div>`;
      const cnt = n.querySelector('.cnt'), t0 = performance.now(), dur = 1200;
      const tick = now => { const k = Math.min(1, (now - t0) / dur); cnt.textContent = BR.fmt(rw.points * (1 - Math.pow(1 - k, 3))); if (k < 1 && cnt.isConnected) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      setTimeout(() => {
        const bar = n.querySelector('.rxp .xpbar i'); if (!bar) return;
        if (lv.levelUp) {
          bar.style.width = '100%';
          setTimeout(() => { if (!bar.isConnected) return; bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = ''; bar.style.width = (lv.after.into / lv.after.need) * 100 + '%'; n.querySelector('.lvn').textContent = lv.after.level; const u = n.querySelector('.lvup'); u.querySelector('b').textContent = lv.after.level + ' — ' + BR.rankName(lv.after.level); u.classList.add('on'); Au.ui('buy'); }, 900);
        } else bar.style.width = (lv.after.into / lv.after.need) * 100 + '%';
      }, 600);
      if (sum.newBest) Au.ui('ok');
      n.addEventListener('click', e => {
        const bt = e.target.closest('[data-r]'); if (!bt) return; const a = bt.dataset.r;
        if (a === 'again') { startDoorsSolo(); return; }
        Au.ui('click');
        if (a === 'replay') roomReplay();
        else if (a === 'lobby') UI.show(N.room ? 'lobby' : 'multi');
        else UI.show(a);
      });
    },
  });

  /* ================= compte ================= */
  function accountModal() {
    modal((box, close) => {
      const render = () => {
        box.querySelectorAll(':scope > :not(.modal-x)').forEach(x => x.remove());
        if (Acc.logged) {
          const p = Acc.p, L = lvl();
          const syncTxt = { ok: 'Progression sauvegardée en ligne', saving: 'Sauvegarde en cours…', offline: 'Serveur injoignable : sauvegarde locale, envoi dès que possible', error: 'Erreur de sauvegarde, nouvel essai bientôt' }[Acc.sync] || '';
          box.append(
            el('div', { class: 'acc-h' }, el('img', { src: thumb(p.look, 96, 120), alt: '' }), el('div', null, el('h3', null, p.name), el('p', { class: 'muted' }, 'Niveau ' + L.level + ' · ' + BR.rankName(L.level)), el('p', { class: 'tiny' }, syncTxt))),
            el('p', { class: 'muted' }, 'Ton compte est enregistré sur le serveur : connecte-toi avec ce pseudo et ce mot de passe sur n\'importe quel PC pour retrouver ta progression.'),
            el('details', { class: 'pw' }, el('summary', null, 'Changer le mot de passe'),
              el('input', { type: 'password', class: 'o', placeholder: 'Mot de passe actuel', autocomplete: 'current-password' }),
              el('input', { type: 'password', class: 'nw', placeholder: 'Nouveau mot de passe (4 caractères min.)', autocomplete: 'new-password' }),
              el('button', { class: 'btn small', onclick: async e => {
                const b = e.target; b.disabled = true;
                try { await Acc.changePassword(box.querySelector('.o').value, box.querySelector('.nw').value); UI.toast('Mot de passe modifié.', 'good'); render(); }
                catch (err) { UI.toast(err.message, 'error'); } finally { b.disabled = false; }
              } }, 'Valider')),
            el('div', { class: 'row end' }, el('button', { class: 'btn danger', onclick: () => UI.confirm('Se déconnecter ?', 'Tu repasseras sur le profil invité de ce PC.', 'Se déconnecter').then(ok => { if (ok) { Acc.logout(); close(); UI.toast('Déconnecté.'); } }) }, 'Se déconnecter')));
          return;
        }
        let mode = box.dataset.mode || 'login';
        box.append(...[
          el('h3', null, 'Compte en ligne'),
          el('p', { class: 'muted' }, 'Un compte garde tes points, skins, objets et statistiques pour toujours, sur tous tes PC. Aucune adresse e-mail n\'est demandée.'),
          el('div', { class: 'tabs' }, el('button', { class: mode === 'login' ? 'on' : '', onclick: () => { box.dataset.mode = 'login'; render(); } }, 'Se connecter'), el('button', { class: mode === 'reg' ? 'on' : '', onclick: () => { box.dataset.mode = 'reg'; render(); } }, 'Créer un compte')),
          el('label', { class: 'fld' }, 'Pseudo', el('input', { class: 'u', maxlength: 16, autocomplete: 'username', value: mode === 'reg' && /^Invité\d+$/.test(Acc.p.name) ? '' : Acc.p.name })),
          el('label', { class: 'fld' }, 'Mot de passe', el('input', { class: 'pw1', type: 'password', maxlength: 72, autocomplete: mode === 'reg' ? 'new-password' : 'current-password' })),
          mode === 'reg' ? el('label', { class: 'fld' }, 'Confirmer le mot de passe', el('input', { class: 'pw2', type: 'password', maxlength: 72, autocomplete: 'new-password' })) : null,
          mode === 'reg' ? el('p', { class: 'tiny ok' }, 'Ta progression actuelle d\'invité (' + BR.fmt(Acc.p.points) + ' points, niveau ' + lvl().level + ') sera transférée sur le nouveau compte.') : null,
          el('div', { class: 'acc-msg tiny' }),
          el('div', { class: 'row end' }, el('button', { class: 'btn primary go' }, mode === 'reg' ? 'Créer mon compte' : 'Se connecter'))].filter(Boolean));
        const go = box.querySelector('.go'), msg = box.querySelector('.acc-msg');
        const submit = async () => {
          const u = box.querySelector('.u').value.trim(), p1 = box.querySelector('.pw1').value;
          if (mode === 'reg' && p1 !== box.querySelector('.pw2').value) { msg.textContent = 'Les mots de passe ne correspondent pas.'; msg.className = 'acc-msg tiny bad'; return; }
          go.disabled = true; msg.className = 'acc-msg tiny'; msg.innerHTML = '<span class="spin sm"></span> Connexion au serveur… (jusqu\'à 1 min si le serveur se réveille)';
          try {
            if (mode === 'reg') await Acc.register(u, p1); else await Acc.login(u, p1);
            Au.ui('ok'); UI.toast(mode === 'reg' ? 'Compte créé ! Bienvenue ' + Acc.p.name + '.' : 'Connecté. Bon retour ' + Acc.p.name + ' !', 'good'); close();
          } catch (err) { msg.textContent = err.message; msg.className = 'acc-msg tiny bad'; Au.ui('error'); }
          finally { go.disabled = false; }
        };
        go.addEventListener('click', submit);
        box.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
        if (!Acc.logged) {
          const gn = el('details', { class: 'pw' }, el('summary', null, 'Juste changer mon pseudo d\'invité'),
            el('input', { class: 'gname', maxlength: 16, value: Acc.p.name }),
            el('button', { class: 'btn small', onclick: () => { if (Acc.setGuestName(box.querySelector('.gname').value)) { UI.toast('Pseudo modifié.', 'good'); render(); } else UI.toast('Pseudo : 3 à 16 caractères.', 'error'); } }, 'Valider'));
          box.appendChild(gn);
        }
      };
      render();
    }, { cls: 'small acc' });
  }

  /* ================= événements globaux ================= */
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'account') { Au.ui('click'); accountModal(); }
    if (act === 'settings') { Au.ui('click'); if (curId !== 'settings') UI.show('settings', { back: curId === 'results' || curId === 'boot' ? 'main' : curId === 'd-end' ? 'portes' : curId }); }
    if (act === 'back') { Au.ui('back'); UI.show(curId === 'main' || curId === 'arena' || curId === 'portes' || curId === 'party' || curId === 'asc' ? 'hub' : partyGame() && (curId === 'multi' || curId === 'lb') ? 'party' : doorsGame() && (curId === 'multi' || curId === 'lb' || curId.startsWith('d-')) ? 'portes' : arenaGame() && (curId === 'multi' || curId === 'lb' || curId.startsWith('a-') || curId.startsWith('asc')) ? (BR.ascMode ? 'asc' : 'arena') : 'main'); }
    if (act === 'daily') { const r = Acc.claimDaily(); if (r.ok) { Au.ui('buy'); UI.toast('+' + r.reward + ' points ! Série : ' + r.streak + ' jour' + (r.streak > 1 ? 's' : ''), 'good'); if (cur && curId) UI.show(curId, curId === 'shop' ? { keep: true } : {}); } else UI.toast(r.msg); }
  });
  let lastHover = 0;
  document.addEventListener('mouseover', e => {
    const b = e.target.closest('.btn, .mi, .gcard, .mapc, .diffc, .citem, .room .btn, .tabs button'); if (!b || b.disabled) return;
    const now = performance.now(); if (now - lastHover < 60) return; lastHover = now; Au.ui('hover');
  });

  UI.init = function () {
    renderTop();
    Acc.on('change', () => { renderTop(); if (curId === 'char') renderChar(); });
    Acc.on('sync', renderTop);
    Acc.on('expired', msg => UI.toast(msg || 'Session expirée, reconnecte-toi.', 'error'));
    N.on('status', () => { renderTop(); renderStatus(); renderRooms(); });
    N.on('pong', () => { renderStatus(); });
    N.on('welcome', () => { renderTop(); renderRooms(); });
    N.on('rooms', () => { renderRooms(); renderStatus(); });
    N.on('error', m => { UI.toast(m.msg || 'Erreur', 'error'); });
    N.on('room', () => {
      if (inGame()) return;
      if (curId === 'lobby') renderLobby();
      else if (curId === 'multi' || rkWant) { rkWant = false; Au.ui('join'); UI.show('lobby'); }
    });
    N.on('chat', m => { if (!inGame()) Au.ui('msg'); lobbyLine(`<b>${esc(m.n)}</b> : ${esc(m.m)}`); });
    N.on('sys', m => lobbyLine(`<i>${esc(m.m)}</i>`));
    N.on('left', m => { if (!inGame()) lobbyLine(`<i>${esc(m.name)} ${m.reason === 'kick' ? 'a été exclu' : 'est parti'}.</i>`); });
    N.on('kicked', m => { lobbyChat.length = 0; if (!inGame()) { UI.toast(m.msg, 'error'); UI.show('multi'); } });
    N.on('lost', () => { if (!inGame()) { UI.toast('Connexion perdue. Reconnexion…', 'error'); if (curId === 'lobby') UI.show('multi'); } });
    // coupure courte : on garde sa place, la reconnexion est automatique
    N.on('unstable', () => UI.toast('Connexion instable… reconnexion en cours (ta place est gardée)', 'error'));
    N.on('resumed', () => UI.toast('Reconnecté : tu reprends la partie.', 'ok'));
    N.on('start', m => {
      if (inGame()) return;
      const room = m.room;
      if (isPartyMap(m.map)) { launchParty({ mode: 'multi', ranked: !!room.ranked, seed: m.seed, roster: room.players.map(p => ({ id: p.id, name: p.name, look: p.look, level: p.level })), selfId: N.id, hostId: room.host }); return; }
      if (isDoorsMap(m.map)) {
        launchDoors({ mode: 'multi', diff: m.diff, seed: m.seed, imgs: m.cfg && Array.isArray(m.cfg.imgs) ? m.cfg.imgs : null, roster: room.players.map(p => ({ id: p.id, name: p.name, look: p.look, level: p.level })), selfId: N.id, hostId: room.host });
        return;
      }
      if (AR().isArenaMap(m.map)) { BR.ArenaUI.launchNet(m); return; }
      launch({ mode: 'multi', mapId: m.map, diffId: m.diff, seed: m.seed, roster: room.players.map(p => ({ id: p.id, name: p.name, look: p.look, level: p.level })), selfId: N.id, hostId: room.host });
    });
  };
})();

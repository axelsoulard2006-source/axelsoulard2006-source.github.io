/* ===== hud.js : interface pendant la partie ===== */
(function () {
  const BR = window.BR, el = BR.el, Wd = BR.World, C = Wd.C, SH = Wd.SH, Ic = BR.Icons;
  const H = (BR.Hud = {});
  let root = null, D = {}, mounted = false;
  let miniBase = [], miniT = 0, teamT = 0, bigOpen = false, quickOn = false, fps = { n: 0, t: 0, v: 0 }, baseFloor = -1;
  const WX_OPTS = [['auto', 'Aléatoire'], ['clear', 'Temps clair'], ['rain', 'Pluie'], ['storm', 'Orage']].map(o => `<option value="${o[0]}">${o[1]}</option>`).join('');
  // intensité de la peur : fréquence des frayeurs, lumières qui baissent (en multijoueur, l'hôte décide pour les entités)
  const FEAR_OPTS = [['normal', 'Normale'], ['strong', 'Forte']].map(o => `<option value="${o[0]}">${o[1]}</option>`).join('');

  /* ---------------- réglages d'ambiance (bodycam, tremblement, météo) : écran Paramètres + menu pause ---------------- */
  H.fxSettings = function () {
    const s = BR.settings, sh = s.shake == null ? 1 : +s.shake;
    return `<label class="chk"><input type="checkbox" data-fx="bodycam" ${s.bodycam !== false ? 'checked' : ''}> Effet bodycam (objectif grand-angle, incrustation REC)</label>
      <label class="sl"><span>Tremblement de la caméra</span><input type="range" data-fx="shake" min="0" max="1.5" step="0.05" value="${sh}"><em data-fxv>${Math.round(sh * 100)} %</em></label>
      <label class="sl"><span>Météo (cartes extérieures)</span><select data-fx="weather">${WX_OPTS.replace(`value="${s.weather || 'auto'}"`, `value="${s.weather || 'auto'}" selected`)}</select><em></em></label>
      <label class="sl"><span>Intensité de la peur</span><select data-fx="fear">${FEAR_OPTS.replace(`value="${s.fear || 'normal'}"`, `value="${s.fear || 'normal'}" selected`)}</select><em></em></label>`;
  };
  function onFx(e) {
    const t = e.target; if (!t || !t.dataset || !t.dataset.fx) return;
    const k = t.dataset.fx;
    BR.settings[k] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
    const em = t.parentNode && t.parentNode.querySelector('em[data-fxv]'); if (em) em.textContent = Math.round(+t.value * 100) + ' %';
    BR.saveSettings();
    if (k === 'weather' && e.type === 'change' && BR.Game.setWeather) BR.Game.setWeather(t.value);
  }
  document.addEventListener('change', onFx); document.addEventListener('input', onFx);

  function mount() {
    if (mounted) return; mounted = true;
    root = BR.$('#hud');
    const ring = `<svg viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="19"/><circle class="fg" cx="22" cy="22" r="19"/></svg>`;
    root.innerHTML = `
      <div class="h-grain"></div>
      <div class="h-vig"></div>
      <div class="h-bloodw"><canvas class="h-blood"></canvas></div>
      <div class="h-bc"><div class="r1"><i class="dot"></i><b>REC</b><span class="el">00:00:00</span></div><div class="r2"><span class="cam">CAM-04</span><span class="ts"></span></div></div>
      <div class="h-down"><div class="h-down-t">À TERRE</div><div class="h-down-s"></div></div>
      <div class="h-top"><div class="h-obj"></div><div class="h-sub"></div></div>
      <div class="h-compass"><div class="arrow">${Ic.svg('up', 34)}</div><div class="dist"></div></div>
      <div class="h-team"></div>
      <div class="h-minimap"><canvas width="190" height="190"></canvas><div class="h-floor"></div><div class="h-mini-key">M — carte</div></div>
      <div class="h-feed"></div>
      <div class="h-toasts"></div>
      <div class="h-cross"></div>
      <div class="h-hold">souffle retenu</div>
      <div class="h-prompt"><div class="ring">${ring}<span>E</span></div><div class="txt"></div></div>
      <div class="h-bottom"><div class="h-fx"></div><div class="h-items"></div><div class="h-stam"><div class="fill"></div></div><div class="h-dash">DASH <small>A / clic droit</small></div></div>
      <div class="h-spec"></div>
      <div class="h-chat"><div class="log"></div><input class="in" maxlength="160" placeholder="Message… (Entrée pour envoyer, Échap pour annuler)"></div>
      <div class="h-quick"></div>
      <div class="h-banner"><div class="t"></div><div class="s"></div></div>
      <div class="h-big"><canvas></canvas><div class="legend"><span class="lg fuse">Fusible</span><span class="lg exit">Sortie</span><span class="lg mate">Coéquipier</span><span class="lg ping">Marqueur</span><span class="lg mon">Entité (détecteur)</span><span class="lg up">Autre étage</span></div></div>
      <div class="h-score"></div>
      <div class="h-click">Clique pour jouer</div>
      <div class="h-pause">
        <div class="box">
          <h2>PAUSE</h2>
          <button class="btn primary" data-a="resume">Reprendre</button>
          <div class="h-pause-set">
            <label>Sensibilité <input type="range" min="0.2" max="3" step="0.05" data-s="sens"></label>
            <label>Champ de vision <input type="range" min="60" max="110" step="1" data-s="fov"></label>
            <label>Volume <input type="range" min="0" max="1" step="0.05" data-s="master"></label>
            <label>Musique <input type="range" min="0" max="1" step="0.05" data-s="mus"></label>
            <label>Tremblement <input type="range" min="0" max="1.5" step="0.05" data-s="shake"></label>
            <label>Effet bodycam <span class="h-chk"><input type="checkbox" data-fx="bodycam"> objectif grand-angle et incrustation REC</span></label>
            <label class="h-wx">Météo <select data-fx="weather">${WX_OPTS}</select></label>
            <label class="h-fear">Peur <select data-fx="fear">${FEAR_OPTS}</select></label>
          </div>
          <div class="h-keys"></div>
          <button class="btn danger" data-a="quit">Quitter la partie</button>
        </div>
      </div>
      <div class="h-jump"><canvas></canvas></div>
      <div class="h-title"><div class="lv"></div><div class="sb"></div><div class="df"></div><div class="tip"></div></div>
      <div class="h-fade"></div>
      <div class="h-fps"></div>`;
    const q = s => root.querySelector(s);
    D = {
      vig: q('.h-vig'), down: q('.h-down'), downS: q('.h-down-s'), obj: q('.h-obj'), sub: q('.h-sub'),
      compass: q('.h-compass'), arrow: q('.h-compass .arrow'), cdist: q('.h-compass .dist'), team: q('.h-team'),
      mini: q('.h-minimap canvas'), floor: q('.h-floor'), feed: q('.h-feed'), toasts: q('.h-toasts'), prompt: q('.h-prompt'), ptxt: q('.h-prompt .txt'),
      pring: q('.h-prompt .fg'), dash: q('.h-dash'), fx: q('.h-fx'), items: q('.h-items'), stam: q('.h-stam'), stamFill: q('.h-stam .fill'),
      spec: q('.h-spec'), chat: q('.h-chat'), log: q('.h-chat .log'), input: q('.h-chat .in'), quick: q('.h-quick'), banner: q('.h-banner'),
      bt: q('.h-banner .t'), bs: q('.h-banner .s'), big: q('.h-big'), bigC: q('.h-big canvas'), score: q('.h-score'), click: q('.h-click'), pause: q('.h-pause'),
      jump: q('.h-jump'), jumpC: q('.h-jump canvas'), title: q('.h-title'), fade: q('.h-fade'), fps: q('.h-fps'), cross: q('.h-cross'),
      hold: q('.h-hold'),
    };
    D.click.addEventListener('click', () => BR.Game.lock());
    D.pause.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); const a = b && b.dataset.a;
      if (a === 'resume') { BR.Audio.ui('click'); BR.Game.resume(); }
      if (a === 'quit') { BR.Audio.ui('back'); if (BR.UI && BR.UI.confirm) BR.UI.confirm('Quitter la partie ?', 'Ta progression de cette manche sera partiellement comptée.', 'Quitter').then(ok => { if (ok) BR.Game.quit(); }); else BR.Game.quit(); }
    });
    root.querySelectorAll('.h-pause input[data-s]').forEach(inp => inp.addEventListener('input', () => { BR.settings[inp.dataset.s] = +inp.value; BR.saveSettings(); }));
    D.input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') closeChat(D.input.value.trim());
      else if (e.key === 'Escape') { e.preventDefault(); closeChat(''); }
    });
    const g = document.createElement('canvas'); g.width = g.height = 192;
    const c = g.getContext('2d'), id = c.createImageData(192, 192);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    c.putImageData(id, 0, 0);
    root.querySelector('.h-grain').style.backgroundImage = `url(${g.toDataURL()})`;
  }

  /* ---------------- (ré)initialisation ---------------- */
  H.reset = function (S, partial) {
    mount();
    if (!partial) {
      root.classList.add('on');
      D.feed.innerHTML = ''; D.toasts.innerHTML = ''; D.log.innerHTML = '';
      D.banner.classList.remove('on'); D.big.classList.remove('on'); bigOpen = false; D.score.classList.remove('on');
      D.jump.classList.remove('on'); D.pause.classList.remove('on'); D.fade.classList.remove('on', 'out');
      D.chat.classList.toggle('solo', S.solo); D.chat.classList.remove('typing'); D.quick.classList.remove('on'); quickOn = false;
      D.fps.style.display = BR.settings.fps ? '' : 'none';
      miniBase = []; for (let f = 0; f < S.map.F; f++) { const cv = document.createElement('canvas'); cv.width = S.map.W * 4; cv.height = S.map.H * 4; miniBase.push(cv); }
      miniT = 0; baseFloor = -1;
      root.querySelectorAll('.h-pause input[data-s]').forEach(inp => { inp.value = BR.settings[inp.dataset.s]; });
      root.querySelector('.h-pause [data-fx=bodycam]').checked = BR.settings.bodycam !== false;
      // météo : seulement sur les cartes à ciel ouvert, et c'est l'hôte qui choisit
      const wx = root.querySelector('.h-pause [data-fx=weather]'), outdoor = !!(S.map.outdoor || S.T.outdoor);
      wx.value = BR.settings.weather || 'auto'; wx.disabled = !S.isHost;
      root.querySelector('.h-pause .h-wx').style.display = outdoor ? '' : 'none';
      wx.title = S.isHost ? '' : 'Choisie par l\'hôte de la partie';
      const fe = root.querySelector('.h-pause [data-fx=fear]'); fe.value = BR.settings.fear || 'normal';
      fe.title = S.solo || S.isHost ? '' : 'Les frayeurs des entités suivent le réglage de l\'hôte ; le reste suit le tien';
      // incrustation bodycam : numéro de caméra générique, constant pour un joueur
      let h = 0; for (const ch of String(S.selfId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      root.querySelector('.h-bc .cam').textContent = 'CAM-' + String(1 + (h % 24)).padStart(2, '0');
      bcT = 0; bcBase = null; bcOn = bcLens = null; H.bloodClear(true);
      H.items(S);
      D.quick.innerHTML = '<div class="qt">Message rapide</div>' + BR.QUICKCHAT.map((m, i) => `<div><b>${i + 1}</b> ${BR.esc(m)}</div>`).join('') + '<div class="qx">Échap / B pour fermer</div>';
    }
    D.team.innerHTML = '';
    D.team.style.display = S.players.size > 1 ? '' : 'none';
    S.order.forEach(id => {
      const p = S.players.get(id); if (!p) return;
      let thumb = ''; try { thumb = BR.Avatar.thumb(p.look, 64, 80); } catch (e) {}
      const row = el('div', { class: 'tm' + (id === S.selfId ? ' me' : '') }, el('img', { src: thumb, alt: '' }), el('div', { class: 'tn' }, el('div', { class: 'nm' }, p.name), el('div', { class: 'st' }, '')));
      row.dataset.id = id; D.team.appendChild(row);
    });
    teamT = 0;
  };
  H.hide = function () { if (root) { root.classList.remove('on'); D.pause.classList.remove('on'); D.fade.classList.remove('on', 'out'); H.bloodClear(true); } bigOpen = false; quickOn = false; };

  H.items = function (S) {
    D.items.innerHTML = '';
    for (let i = 0; i < BR.LOADOUT_SLOTS; i++) {
      const it = S.items[i], def = it ? BR.ITEMS[it.id] : null;
      D.items.appendChild(el('div', { class: 'slot' + (!it ? ' empty' : it.n <= 0 ? ' used' : ''), title: def ? def.name + ' — ' + def.desc : 'Emplacement vide' },
        el('span', { class: 'k' }, String(i + 1)), def ? el('img', { class: 'ic', src: Ic.item(it.id), alt: '' }) : null, it ? el('span', { class: 'n' }, 'x' + it.n) : null));
    }
  };

  /* ---------------- messages ---------------- */
  H.toast = function (text, kind) {
    if (!root) return;
    const t = el('div', { class: 'toast ' + (kind || '') }, text);
    D.toasts.appendChild(t);
    while (D.toasts.children.length > 3) D.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3200);
  };
  H.feed = function (text, kind) {
    if (!root) return;
    const t = el('div', { class: 'fd ' + (kind || '') }, text);
    D.feed.appendChild(t);
    while (D.feed.children.length > 5) D.feed.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 6000); setTimeout(() => t.remove(), 6700);
  };
  let bannerTO = null;
  H.banner = function (t, s, kind) {
    if (!root) return;
    D.bt.textContent = t; D.bs.textContent = s || '';
    D.banner.className = 'h-banner on ' + (kind || '');
    clearTimeout(bannerTO); bannerTO = setTimeout(() => D.banner.classList.remove('on'), 4200);
  };
  H.title = function (name, sub, diff) {
    D.title.querySelector('.lv').textContent = name;
    D.title.querySelector('.sb').textContent = sub;
    const df = D.title.querySelector('.df'); df.textContent = diff.name.toUpperCase(); df.style.color = diff.color;
    D.title.querySelector('.tip').textContent = BR.pick(BR.TIPS);
    D.title.classList.remove('out'); D.title.classList.add('on');
    setTimeout(() => D.title.classList.add('out'), 3200);
    setTimeout(() => D.title.classList.remove('on', 'out'), 5000);
  };
  H.fadeOut = function (cb) { D.fade.classList.add('on'); setTimeout(() => { cb && cb(); }, 900); };
  H.jumpscare = function (cv) {
    if (!root) return;
    const c = D.jumpC, W = window.innerWidth, Hh = window.innerHeight;
    c.width = W; c.height = Hh;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
    if (cv) { const k = Math.min(W / cv.width, Hh / cv.height) * 1.25; const w = cv.width * k, h = cv.height * k; g.drawImage(cv, (W - w) / 2, (Hh - h) / 2 + Hh * 0.04, w, h); }
    D.jump.classList.remove('on'); void D.jump.offsetWidth; D.jump.classList.add('on');
    setTimeout(() => D.jump.classList.remove('on'), 1200);
  };
  H.locker = () => {};
  // aide des touches du menu pause : suit les touches choisies dans les paramètres
  function keysHelp() {
    const L = BR.Keys.label, B = s => `<b>${s}</b>`;
    return `<span>${B(['up', 'left', 'down', 'right'].map(L).join(' '))} se déplacer</span><span>${B(L('b_run'))} ${BR.settings.autorun ? 'marcher (course auto)' : 'courir'}</span><span>${B(L('b_crouch'))} en courant : glissade</span><span>${B(L('b_dash') + ' / clic droit')} dash</span><span>${B(L('b_jump'))} sauter</span>
      <span>${B(L('b_use'))} interagir (maintenir)</span><span>${B(L('b_flash'))} lampe</span><span>${B('1 2 3')} objets</span><span>${B(L('b_ping'))} marquer</span>
      <span>${B('M')} carte</span><span>${B(L('b_cam'))} vue 3e personne</span><span>${B('Tab')} scores</span><span>${B('Entrée / B')} chat</span><span class="muted">touches modifiables dans les paramètres</span>`;
  }
  H.pause = on => { if (!root) return; if (on) { const k = D.pause.querySelector('.h-keys'); if (k) k.innerHTML = keysHelp(); } D.pause.classList.toggle('on', !!on); if (on) BR.Audio.ui('back'); };
  H.scoreboard = function (on) {
    const S = BR.Game.session(); if (!S || !root) return;
    D.score.classList.toggle('on', !!on);
    if (!on) return;
    const rows = S.order.map(id => S.players.get(id)).filter(Boolean).map(p =>
      `<tr class="${p.id === S.selfId ? 'me' : ''}"><td>${BR.esc(p.name)}</td><td>${p.level}</td><td>${statusOf(p)}</td><td>${p.fuses}</td><td>${p.revives}</td><td>${p.downs}</td></tr>`).join('');
    D.score.innerHTML = `<div class="box"><h3>${BR.esc(S.def.name)} — ${BR.esc(S.def.sub)} <span style="color:${S.diff.color}">${S.diff.name}</span></h3>
      <table><tr><th>Joueur</th><th>Niv.</th><th>État</th><th>Fusibles</th><th>Relevés</th><th>Chutes</th></tr>${rows}</table>
      <div class="ft">Temps : ${BR.fmtTime(S.time)} · Fusibles ${S.fuseTaken.filter(Boolean).length}/${S.fuseTaken.length}</div></div>`;
  };
  function statusOf(p) {
    if (p.escaped) return '<span class="ok">Évadé</span>';
    if (p.dead) return '<span class="bad">Disparu</span>';
    if (p.down) return '<span class="warn">À terre ' + Math.max(0, Math.ceil(p.bleed)) + ' s</span>';
    return 'Debout';
  }
  H.bigMap = function () { bigOpen = !bigOpen; D.big.classList.toggle('on', bigOpen); BR.Audio.ui('click'); };
  H.quick = function (on) { quickOn = !!on && !quickOn; D.quick.classList.toggle('on', quickOn); };
  H.quickOpen = () => quickOn;

  /* ---------------- chat ---------------- */
  let chatCb = null;
  H.chatInput = function (on, cb) { chatCb = cb; D.chat.classList.toggle('typing', on); if (on) { D.input.value = ''; setTimeout(() => D.input.focus(), 0); } };
  function closeChat(v) { D.chat.classList.remove('typing'); D.input.blur(); const cb = chatCb; chatCb = null; cb && cb(v); }
  H.chatLine = function (name, msg, quick) {
    if (!root) return;
    const l = el('div', { class: 'cl' + (quick ? ' q' : '') }, el('b', null, name + ' : '), msg);
    D.log.appendChild(l);
    while (D.log.children.length > 8) D.log.firstChild.remove();
    setTimeout(() => l.classList.add('old'), 9000);
  };
  window.addEventListener('keydown', e => { if (quickOn && e.key === 'Escape') { quickOn = false; D.quick.classList.remove('on'); } });

  /* ---------------- image par image ---------------- */
  const floorOf = y => Math.max(0, Math.round(y / SH));
  const floorName = f => f === 0 ? 'Rez-de-chaussée' : f === 1 ? '1er étage' : f + 'e étage';
  H.frame = function (S, dt) {
    if (!root) return;
    const me = S.me;
    if (BR.settings.fps) { fps.n++; fps.t += dt; if (fps.t >= 0.5) { fps.v = Math.round(fps.n / fps.t); fps.n = 0; fps.t = 0; D.fps.textContent = fps.v + ' FPS'; } }
    const taken = S.fuseTaken.filter(Boolean).length, need = S.fuseTaken.length;
    let obj, sub = '';
    if (me.escaped) { obj = 'ÉVADÉ'; sub = 'En attente des autres survivants…'; }
    else if (me.dead) { obj = 'SPECTATEUR'; }
    else if (S.exitOpen) { obj = 'REJOIGNEZ LA SORTIE !'; sub = 'Elle est au rez-de-chaussée. Les entités sont déchaînées.'; }
    else { obj = `FUSIBLES  ${taken} / ${need}`; sub = 'Trouvez-les (ils brillent, parfois en hauteur) pour ouvrir la sortie.'; }
    if (S.grace > 0 && !S.exitOpen) sub = 'Les entités se mettent en chasse dans ' + Math.ceil(S.grace) + ' s';
    if (D.obj.textContent !== obj) { D.obj.textContent = obj; D.obj.classList.remove('pop'); void D.obj.offsetWidth; D.obj.classList.add('pop'); }
    if (D.sub.textContent !== sub) D.sub.textContent = sub;
    D.obj.classList.toggle('alarm', S.exitOpen && !me.escaped && !me.dead);

    // vitesse (remplace l'endurance : la course est illimitée)
    const spd = Math.hypot(me.vx, me.vz), k = Math.min(1, spd / BR.PLAYER.slide);
    D.stamFill.style.transform = `scaleX(${k})`;
    D.stam.classList.toggle('boost', S.fx.energy > 0); D.stam.classList.toggle('slide', S.slide > 0 || S.dash > 0); D.stam.classList.toggle('cd', S.dashCd > 0);
    D.dash.style.setProperty('--p', String(1 - S.dashCd / 2.0)); D.dash.classList.toggle('ready', S.dashCd <= 0);
    let fx = '';
    const FXN = { energy: 8, smoke: 6, radar: 15, compass: 25 };
    for (const id in FXN) if (S.fx[id] > 0) fx += `<span class="fxi"><img src="${Ic.item(id)}" alt=""><em style="width:${(S.fx[id] / FXN[id]) * 100}%"></em></span>`;
    if (D.fx._h !== fx) { D.fx.innerHTML = fx; D.fx._h = fx; }
    const showPlay = !me.dead && !me.escaped;
    D.items.style.display = showPlay ? '' : 'none'; D.stam.style.display = showPlay ? '' : 'none';
    D.cross.style.display = showPlay && S.camMode === 'fp' ? '' : 'none';
    const hid = !!(showPlay && S.fear && S.fear.hide);      // caché dans le noir : petit rappel discret sous le viseur
    if (D.hold._on !== hid) { D.hold._on = hid; D.hold.classList.toggle('on', hid); }
    const it = S.inter;
    if (it && showPlay && !S.paused) {
      D.prompt.classList.add('on'); D.prompt.classList.toggle('info', it.kind === 'info');
      if (D.ptxt.textContent !== it.text) D.ptxt.textContent = it.text;
      const pr = S.hold ? Math.min(1, S.hold.t / S.hold.need) : 0;
      D.pring.style.strokeDashoffset = String(119.4 * (1 - pr));
    } else D.prompt.classList.remove('on');
    const isDown = me.down && !me.dead;
    D.down.classList.toggle('on', isDown);
    if (isDown) D.downS.textContent = me.medT > 0 ? 'Kit de secours… tu te relèves' : S.solo ? '' : 'Un coéquipier peut te relever (maintenir E) — ' + Math.max(0, Math.ceil(me.bleed)) + ' s';
    D.vig.style.opacity = String(Math.min(1, S.danger * 1.1));
    D.click.classList.toggle('on', !S.locked && !S.paused && !S.chatOpen && !S.ended);
    if ((me.dead || me.escaped) && !S.solo) {
      const t = S.spec ? S.players.get(S.spec) : null;
      D.spec.classList.add('on');
      D.spec.innerHTML = t ? `Tu regardes <b>${BR.esc(t.name)}</b> <span>clic / Espace : joueur suivant</span>` : 'Plus personne à observer…';
    } else D.spec.classList.remove('on');
    compass(S);
    teamT -= dt;
    if (teamT <= 0 && S.players.size > 1) {
      teamT = 0.25;
      D.team.querySelectorAll('.tm').forEach(row => {
        const p = S.players.get(row.dataset.id); if (!p) { row.remove(); return; }
        const s = row.querySelector('.st'), h = statusOf(p) + (p.fuses ? ` · <span class="fz">${Ic.svg('fuse', 11)}${p.fuses}</span>` : '');
        if (s._h !== h) { s.innerHTML = h; s._h = h; }
        row.classList.toggle('down', p.down && !p.dead); row.classList.toggle('dead', p.dead); row.classList.toggle('esc', p.escaped);
        row.classList.toggle('talk', p.chatT > 0);
      });
    }
    miniT -= dt;
    if (miniT <= 0) { miniT = 0.1; drawMini(S); if (bigOpen) drawBig(S); }
    bodycam(S, dt);
    bloodStep(dt);
  };

  /* ---------------- incrustation « bodycam » (discrète, en bas à droite) ---------------- */
  let bcT = 0, bcTick = 0, bcBase = null, bcEl = null, bcOn = null, bcLens = null;
  const p2 = n => String(n).padStart(2, '0');
  function bodycam(S, dt) {
    const on = BR.settings.bodycam !== false && !S.me.dead && !S.me.escaped;
    const lens = BR.settings.bodycam !== false && BR.settings.quality !== 'low';
    const el = bcEl || (bcEl = root.querySelector('.h-bc'));
    if (bcOn !== on || bcLens !== lens) { bcOn = on; bcLens = lens; root.classList.toggle('bcam', lens); el.classList.toggle('on', on); }
    if (!on) return;
    bcT += dt; bcTick -= dt;
    if (bcTick > 0) return;
    bcTick = 0.25;
    // horodatage : la date du jour, mais une heure de nuit (l'enregistrement a commencé vers 2 h du matin)
    if (!bcBase) { bcBase = new Date(); bcBase.setHours(1 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60)); }
    const s = Math.floor(S.time), d = new Date(bcBase.getTime() + S.time * 1000);
    el.querySelector('.el').textContent = p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60);
    el.querySelector('.ts').textContent = `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}  ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  }

  /* ---------------- sang sur l'objectif : taches sur les bords et gouttes qui coulent ----------------
     Dessin incrémental sur une toile à demi-résolution : chaque goutte prolonge sa traînée image après image. */
  const BL = { c: null, g: null, drips: [], on: false, clearTO: 0 };
  function bloodCanvas() {
    if (!BL.c) { BL.c = root.querySelector('.h-blood'); BL.g = BL.c.getContext('2d'); }
    const w = Math.max(320, Math.round(window.innerWidth / 2)), h = Math.max(180, Math.round(window.innerHeight / 2));
    if (BL.c.width !== w || BL.c.height !== h) { BL.c.width = w; BL.c.height = h; }
    return BL.g;
  }
  function stain(g, x, y, r) {
    // tache irrégulière : sombre au centre, plus rouge et translucide sur les bords, éclaboussures autour
    const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r * 1.15);
    gr.addColorStop(0, 'rgba(55,0,2,0.94)'); gr.addColorStop(0.7, 'rgba(105,2,6,0.88)'); gr.addColorStop(1, 'rgba(140,8,10,0.55)');
    g.fillStyle = gr;
    for (let k = 0; k < 5; k++) {
      const cx = x + (Math.random() - 0.5) * r * 0.9, cy = y + (Math.random() - 0.5) * r * 0.7, rr = r * (0.45 + Math.random() * 0.45);
      g.beginPath(); const ph = Math.random() * 6.28;
      for (let i = 0; i <= 22; i++) { const a = i / 22 * 6.283, q = rr * (1 + 0.18 * Math.sin(a * 3 + ph) + 0.1 * Math.sin(a * 7 + ph * 2)); const px = cx + Math.cos(a) * q, py = cy + Math.sin(a) * q; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.fill();
    }
    g.fillStyle = 'rgba(95,0,4,0.85)';
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283, d = r * (1.1 + Math.random() * 1.2), s = 0.6 + Math.random() * r * 0.09; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s, 0, 6.283); g.fill(); }
    // reflet humide
    g.fillStyle = 'rgba(255,140,140,0.10)'; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.3, r * 0.35, r * 0.12, -0.5, 0, 6.283); g.fill();
  }
  /** amount 0..1 : 0,3 = un peu (attrapé), 1 = beaucoup (mort) */
  H.blood = function (amount) {
    if (!root) return;
    clearTimeout(BL.clearTO);
    const g = bloodCanvas(), W = BL.c.width, Hh = BL.c.height, k = W / 960, n = Math.round(2 + amount * 6);
    BL.c.classList.remove('out'); BL.c.classList.add('on');
    for (let i = 0; i < n; i++) {
      const side = Math.random(); let x, y;
      if (side < 0.4) { x = Math.random() * W * 0.1; y = Math.random() * Hh * 0.65; }
      else if (side < 0.8) { x = W - Math.random() * W * 0.1; y = Math.random() * Hh * 0.65; }
      else { x = Math.random() * W; y = Math.random() * Hh * 0.05; }
      const r = (16 + Math.random() * 30) * (0.6 + amount * 0.7) * k;
      stain(g, x, y, r);
      const nd = 1 + Math.floor(Math.random() * (1 + amount * 3));
      for (let j = 0; j < nd; j++) BL.drips.push({ x: x + (Math.random() - 0.5) * r * 1.3, y: y + r * 0.35, w: (1.3 + Math.random() * 2.4) * k * (0.8 + amount * 0.5), m: 0.5 + Math.random() * (0.6 + amount), wait: Math.random() * 0.6, run: 0, v: 0 });
    }
    BL.on = true;
  };
  H.bloodClear = function (now) {
    if (!root || !BL.c) return;
    clearTimeout(BL.clearTO);
    const wipe = () => { BL.drips = []; BL.on = false; if (BL.g) BL.g.clearRect(0, 0, BL.c.width, BL.c.height); BL.c.classList.remove('on', 'out'); };
    if (now) { wipe(); return; }
    BL.c.classList.add('out'); BL.clearTO = setTimeout(wipe, 3200);
  };
  function bloodStep(dt) {
    if (!BL.on || !BL.drips.length) return;
    const g = BL.g, k = BL.c.width / 960;
    BL.drips = BL.drips.filter(d => {
      if (d.wait > 0) { d.wait -= dt; return true; }
      // une goutte avance par à-coups : elle s'arrête, accumule, puis repart
      d.run -= dt;
      if (d.run <= 0) { d.run = 0.15 + Math.random() * 0.5; d.v = Math.random() < 0.25 ? 0 : (25 + Math.random() * 70) * k * (0.5 + d.m); }
      const dy = d.v * dt; if (dy <= 0) return true;
      const w = d.w * (0.45 + 0.55 * Math.min(1, d.m));
      g.fillStyle = 'rgba(105,2,6,0.9)';
      g.beginPath(); g.ellipse(d.x, d.y + dy * 0.5, w, Math.max(w, dy * 0.6), 0, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(255,120,120,0.12)'; g.fillRect(d.x - w * 0.45, d.y, Math.max(0.6, w * 0.25), dy);
      d.y += dy; d.x += (Math.random() - 0.5) * 0.25 * k;
      d.m -= dy / (BL.c.height * 0.55);
      if (d.m <= 0 || d.y > BL.c.height + 10) {
        g.fillStyle = 'rgba(80,0,3,0.92)'; g.beginPath(); g.arc(d.x, d.y, w * 1.5, 0, 6.283); g.fill();   // perle au bout de la coulure
        return false;
      }
      return true;
    });
  }

  function compass(S) {
    const me = S.me;
    let tgt = null;
    if (!me.dead && !me.escaped) {
      if (S.exitOpen && (S.exitSeen || S.fx.compass > 0)) tgt = { x: S.exitObj.x, y: 0, z: S.exitObj.z, c: '#3dff6e', label: 'SORTIE' };
      else if (S.fx.compass > 0) {
        let bd = 1e9;
        S.fuseObjs.forEach((f, i) => { if (S.fuseTaken[i]) return; const d = Math.hypot(f.x - me.x, f.z - me.z, (f.y - me.y) * 2); if (d < bd) { bd = d; tgt = { x: f.x, y: f.y, z: f.z, c: '#ffc23a', label: 'FUSIBLE' }; } });
        if (!tgt) tgt = { x: S.exitObj.x, y: 0, z: S.exitObj.z, c: '#ff5a4e', label: 'SORTIE' };
      }
    }
    if (!tgt) { D.compass.classList.remove('on'); return; }
    D.compass.classList.add('on');
    const dx = tgt.x - me.x, dz = tgt.z - me.z, y = S.camYaw;
    const fwd = -dx * Math.sin(y) - dz * Math.cos(y), right = dx * Math.cos(y) - dz * Math.sin(y);
    D.arrow.style.transform = `rotate(${Math.atan2(right, fwd)}rad)`; D.arrow.style.color = tgt.c;
    const df = floorOf(tgt.y) - floorOf(me.y);
    D.cdist.textContent = tgt.label + ' · ' + Math.round(Math.hypot(dx, dz)) + ' m' + (df > 0 ? ' · étage au-dessus' : df < 0 ? ' · étage en dessous' : '');
  }

  /* ---------------- minicarte (étage courant) ---------------- */
  function paintBase(S, f) {
    const m = S.map, g = miniBase[f].getContext('2d'), k = 4;
    g.clearRect(0, 0, miniBase[f].width, miniBase[f].height);
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const i = y * m.W + x; if (!S.explored[f * m.WH + i]) continue;
      const t = m.t[f][i];
      if (t === Wd.VOID) { g.fillStyle = 'rgba(20,18,12,0.5)'; g.fillRect(x * k, y * k, k, k); continue; }
      g.fillStyle = t === Wd.WALL ? 'rgba(235,220,160,0.75)' : t === Wd.RAMP ? 'rgba(120,200,255,0.7)' : m.propAt[f][i] >= 0 ? 'rgba(150,130,80,0.6)' : 'rgba(70,62,40,0.6)';
      g.fillRect(x * k, y * k, k, k);
    }
  }
  function markers(S, g, toPx, scale, f) {
    const me = S.me, t = S.time;
    const tri = (p, up, r, col) => { g.beginPath(); if (up) { g.moveTo(p.x, p.y - r); g.lineTo(p.x + r, p.y + r * 0.8); g.lineTo(p.x - r, p.y + r * 0.8); } else { g.moveTo(p.x, p.y + r); g.lineTo(p.x + r, p.y - r * 0.8); g.lineTo(p.x - r, p.y - r * 0.8); } g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#000'; g.stroke(); };
    const dot = (x, y, z, r, col, ring) => {
      const p = toPx(x, z), df = floorOf(y) - f;
      if (df !== 0) { g.globalAlpha = 0.75; tri(p, df > 0, r * 1.1, col); g.globalAlpha = 1; return; }
      g.beginPath(); g.arc(p.x, p.y, r, 0, 6.283); g.fillStyle = col; g.fill(); if (ring) { g.lineWidth = 2; g.strokeStyle = ring; g.stroke(); }
    };
    S.fuseObjs.forEach((o, i) => { if (!S.fuseTaken[i] && S.seenFuse[i]) dot(o.x, o.y, o.z, 4 * scale, '#ffc23a', 'rgba(0,0,0,0.6)'); });
    if (S.exitSeen) dot(S.exitObj.x, 0, S.exitObj.z, 5 * scale, S.exitOpen ? '#3dff6e' : '#ff4a3d', '#000');
    S.pings.forEach(p => dot(p.x, p.y, p.z, (3 + Math.sin(t * 8)) * scale, '#5ad1ff'));
    S.decoys.forEach(d => dot(d.x, d.y, d.z, 2.5 * scale, '#50ff78'));
    S.flares.forEach(fl => dot(fl.x, fl.y, fl.z, 3 * scale, '#ff5030'));
    if (S.fx.radar > 0) S.views.views.forEach(v => dot(v.x, v.y, v.z, 4 * scale, Math.sin(t * 10) > 0 ? '#ff2a2a' : '#a00', '#000'));
    S.players.forEach(p => { if (p === me || p.dead || p.escaped) return; dot(p.x, p.y, p.z, 3.5 * scale, p.down ? (Math.sin(t * 8) > 0 ? '#ff4a3d' : '#600') : '#4aa3ff', '#000'); });
    if (!me.dead && !me.escaped) {
      const p = toPx(me.x, me.z);
      g.save(); g.translate(p.x, p.y); g.rotate(-me.yaw);
      g.beginPath(); g.moveTo(0, -7 * scale); g.lineTo(5 * scale, 5 * scale); g.lineTo(0, 2.5 * scale); g.lineTo(-5 * scale, 5 * scale); g.closePath();
      g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#000'; g.stroke(); g.restore();
    }
  }
  function focus(S) { const me = S.me; if ((me.dead || me.escaped) && S.spec) { const t = S.players.get(S.spec); if (t) return t; } return me; }
  function drawMini(S) {
    const foc = focus(S), f = Math.min(S.map.F - 1, floorOf(foc.y));
    paintBase(S, f);
    if (f !== baseFloor) { baseFloor = f; D.floor.textContent = floorName(f); }
    const c = D.mini, g = c.getContext('2d'), W = c.width, ppm = 2.2, k = ppm * C / 4;
    g.clearRect(0, 0, W, W);
    g.save(); g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, 6.283); g.clip();
    g.fillStyle = 'rgba(10,9,6,0.72)'; g.fillRect(0, 0, W, W);
    g.imageSmoothingEnabled = false;
    g.drawImage(miniBase[f], W / 2 - foc.x * ppm, W / 2 - foc.z * ppm, miniBase[f].width * k, miniBase[f].height * k);
    markers(S, g, (x, z) => ({ x: W / 2 + (x - foc.x) * ppm, y: W / 2 + (z - foc.z) * ppm }), 1, f);
    g.restore();
  }
  function drawBig(S) {
    const foc = focus(S), f = Math.min(S.map.F - 1, floorOf(foc.y));
    const c = D.bigC, size = Math.floor(Math.min(window.innerWidth * 0.8, window.innerHeight * 0.74));
    if (c.width !== size) { c.width = size; c.height = size; }
    const g = c.getContext('2d'), m = S.map, ppm = size / (Math.max(m.W, m.H) * C);
    g.clearRect(0, 0, size, size);
    g.fillStyle = 'rgba(10,9,6,0.88)'; g.fillRect(0, 0, size, size);
    g.imageSmoothingEnabled = false;
    g.drawImage(miniBase[f], 0, 0, m.W * C * ppm, m.H * C * ppm);
    markers(S, g, (x, z) => ({ x: x * ppm, y: z * ppm }), Math.max(1, size / 500), f);
    g.fillStyle = '#ffd24a'; g.font = 'bold 16px Oswald, sans-serif'; g.fillText(floorName(f).toUpperCase(), 12, 24);
  }
})();

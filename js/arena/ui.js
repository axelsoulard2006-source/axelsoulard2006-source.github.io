/* ===== arena/ui.js : écrans du jeu 2 « COLOSSES » (menu, boss, duel, compétences, roulette, résultats) ===== */
(function () {
  const BR = window.BR, el = BR.el, esc = BR.esc, AR = BR.ARENA, UI = BR.UI, Au = BR.Audio, Acc = BR.Account, N = BR.Net;
  const AU = (BR.ArenaUI = {});
  const ICO = (n, sz, c) => BR.Icons.svg(n, sz, c), COIN = sz => BR.Icons.coin(sz);
  const RT = r => UI.rarityTag(r);
  let preview = null; const killPreview = () => { if (preview) { preview.dispose(); preview = null; } };
  let diffSel = 'normal';

  /* ---------- visages des boss ---------- */
  // image (dataURL) d'un sprite de monstre, pour les cartes de boss
  const faceCache = {};
  function faceURL(i) { if (faceCache[i]) return faceCache[i]; const s = BR.Ent.sprite(i); if (!s || !s.canvas) return ''; try { return (faceCache[i] = s.canvas.toDataURL('image/png')); } catch (e) { return ''; } }
  // visage attitré de chaque boss (stable), les autres visages au hasard
  function bossFace(id) { const n = BR.Ent.count() || 1, k = AR.BOSSES.findIndex(b => b.id === id); const withFace = BR.Ent.sprites.map((s, i) => s.face ? i : -1).filter(i => i >= 0); const pool = withFace.length >= 4 ? withFace : BR.Ent.sprites.map((s, i) => i); return pool[(k * 3 + 1) % pool.length] % n; }
  AU.pickFaces = function (n, first) {
    const all = BR.shuffle(BR.Ent.sprites.map((s, i) => i)); const out = first != null ? [first] : [];
    for (const i of all) { if (out.length >= n) break; if (!out.includes(i)) out.push(i); }
    while (out.length < n) out.push(out.length % Math.max(1, BR.Ent.count()));
    return out;
  };

  /* ---------- lancement ---------- */
  function launch(o) {
    BR.$$('.modal-back').forEach(m => m.remove());
    killPreview(); BR.MenuBG.stop(); AU.bg(false);
    o.onEnd = showResults;
    try { BR.Arena.start(o); }
    catch (e) { console.error(e); document.body.classList.remove('inarena'); UI.toast('Erreur au lancement : ' + e.message, 'error'); UI.show('arena'); }
  }
  const me = () => ({ id: 'me', name: Acc.p.name, look: Acc.p.look, level: Acc.level().level });
  AU.launchBoss = function (boss, diff) { launch({ mode: 'boss', boss, diff, seed: (Math.random() * 2 ** 31) >>> 0, roster: [me()], selfId: 'me', hostId: 'me', solo: true, faces: AU.pickFaces(8, bossFace(boss)) }); };
  AU.launchDuelBot = function (diff) { launch({ mode: 'duel', diff, seed: (Math.random() * 2 ** 31) >>> 0, roster: [me()], selfId: 'me', hostId: 'me', solo: true, bot: true }); };
  AU.launchNet = function (m) {
    if (m.map === 'a_asc' && BR.Asc) { BR.Asc.startNet(m); return; }
    const room = m.room, duel = m.map === 'a_duel', boss = duel ? null : m.map.slice(2);
    const faces = (m.cfg && m.cfg.faces) || AU.pickFaces(8);
    // équipes du duel : celles envoyées par l'hôte au lancement (sinon chacun pour soi)
    const teams = duel ? ((m.cfg && m.cfg.teams) || AR.defaultTeams(room.players.map(p => p.id))) : null;
    launch({ mode: duel ? 'duel' : 'boss', boss, diff: AR.DIFFS[m.diff] ? m.diff : 'normal', seed: m.seed, roster: room.players.map(p => ({ id: p.id, name: p.name, look: p.look, level: p.level })), selfId: N.id, hostId: room.host, solo: false, teams, faces: boss ? [bossFace(boss)].concat(faces.filter(f => f !== bossFace(boss))) : faces });
  };

  // duel entre amis : salon privé (jusqu'à 8 joueurs), code à partager ; l'hôte répartit les équipes dans le salon
  AU.duelFriend = function () {
    BR.curGame = 'arena'; UI.show('multi');
    const go = () => { N.create({ name: Acc.p.name + ' — duel', map: 'a_duel', diff: 'normal', max: 8, priv: true }); UI.toast("Duel créé : donne le code du salon à tes amis, puis répartis les équipes.", 'good'); };
    if (N.status === 'on') go(); else { UI.toast('Connexion au serveur… le duel sera créé dès que possible.'); N.connect().then(go).catch(() => UI.toast('Serveur injoignable.', 'error')); }
  };

  /* ---------- fond animé des menus COLOSSES : l'arène filmée en lent travelling (bloom compris) ---------- */
  let BG = null;
  AU.bg = function (on, force) {
    if (!on || (BR.Arena && BR.Arena.active)) { if (BG) { BG.run = false; BG.canvas.style.display = 'none'; } return; }
    if (BG && BG.run && (!force || BG.th === force)) return;
    if (BG && BG.run) BG.run = false;
    BR.MenuBG.stop();
    if (!BG) {
      const canvas = BR.el('canvas', { id: 'bg2' }); document.body.insertBefore(canvas, BR.$('#ui'));
      const R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
      R.setPixelRatio(1); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputEncoding = THREE.LinearEncoding;
      BG = { canvas, R, run: false, theme: 0 };
    }
    // un thème différent à chaque visite
    const themes = ['titan', 'knight', 'eye', 'frost', 'hydra', 'beast', 'spider', 'storm', 'duel'], th = force || themes[BG.theme++ % themes.length];
    BG.th = th; const inner = BR.ArenaScene.isBiome && BR.ArenaScene.isBiome(th) && th !== 'neant';
    if (BG.env) { BG.env.dispose(); BG.fx.dispose(); }
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900); scene.userData.cam = cam;
    BG.scene = scene; BG.cam = cam; BG.env = BR.ArenaScene.build(scene, th, 'low'); BG.fx = BR.AFX.create(scene, cam, null);
    try { BG.post = BR.AFX.post(BG.R, scene, cam, 'low'); } catch (e) { BG.post = null; BG.R.outputEncoding = THREE.sRGBEncoding; }
    if (BG.post) BG.post.grade.uVig.value = 0.6;
    BG.canvas.style.display = 'block'; BG.run = true;
    let last = performance.now(), t = Math.random() * 10;
    const loop = now => {
      if (!BG.run) return; requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; if (document.hidden) return;
      t += dt;
      const w = innerWidth, h = innerHeight; if (BG.w !== w || BG.h !== h) { BG.w = w; BG.h = h; BG.R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); if (BG.post) BG.post.setSize(w, h); }
      const a = t * 0.05, cr = inner ? 30 : 46; cam.position.set(Math.cos(a) * cr, (inner ? 4.5 : 9) + Math.sin(t * 0.13) * (inner ? 1 : 2), Math.sin(a) * cr); if (inner) cam.lookAt(-Math.cos(a) * 30, 6, -Math.sin(a) * 30); else cam.lookAt(0, 2, 0);
      // particules d'énergie qui montent des runes
      if (Math.random() < dt * 30) { const r = Math.random() < 0.5 ? 10 : 24, b = Math.random() * 6.283; BG.fx.spark(new THREE.Vector3(Math.cos(b) * r, 0.1, Math.sin(b) * r), new THREE.Vector3(0, 1.5 + Math.random() * 2, 0), { color: BG.env.theme.accent, life: 2.5, size: 0.5, size1: 0.05 }); }
      BG.env.update(dt, BG.fx); BG.fx.update(dt, dt);
      if (BG.post) BG.post.render(dt); else BG.R.render(scene, cam);
    };
    requestAnimationFrame(loop);
  };

  /* ---------- vignette 3D d'une arme (modèles KayKit) ---------- */
  let wR = null; const wCache = {};
  AU.weaponThumb = function (id) {
    if (wCache[id]) return wCache[id];
    const W = AR.WEAPONS[id]; if (!W || !BR.Assets.ready) return '';
    if (!wR) { wR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); wR.outputEncoding = THREE.sRGBEncoding; wR.toneMapping = THREE.ACESFilmicToneMapping; wR.toneMappingExposure = 1.2; wR.setPixelRatio(1); wR.setSize(200, 200, false); wR.setClearColor(0, 0); }
    const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x303040, 1.3)); const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(W.color), 2); rim.position.set(-3, 1, -2); scene.add(rim);
    const grp = new THREE.Group();
    W.models.forEach(([model, node], i) => {
      const g = BR.Assets.models[model]; let src = null; if (g) g.scene.traverse(o => { if (!src && o.name === node) src = o; });
      if (!src) return;
      const c = src.clone(true); c.position.set(0, 0, 0); c.quaternion.identity(); c.scale.set(1, 1, 1); c.visible = true; c.traverse(o => { o.visible = true; });
      const holder = new THREE.Group(); holder.add(c);
      const bx = new THREE.Box3().setFromObject(holder), sz = bx.getSize(new THREE.Vector3()), ctr = bx.getCenter(new THREE.Vector3());
      c.position.sub(ctr);
      // l'axe le plus long en diagonale
      const ax = sz.x > sz.y && sz.x > sz.z ? 'x' : sz.y > sz.z ? 'y' : 'z';
      if (ax === 'x') holder.rotation.z = Math.PI / 4; else if (ax === 'y') holder.rotation.z = -Math.PI / 4; else { holder.rotation.x = Math.PI / 2; holder.rotation.z = -Math.PI / 4; }
      if (/shield/i.test(node)) { holder.rotation.set(0, 0.5, 0); holder.position.set(0.45, -0.15, -0.3); holder.scale.setScalar(0.8); }
      else if (W.models.length > 1) holder.position.x = (i ? 0.35 : -0.35);
      grp.add(holder);
    });
    scene.add(grp);
    const b2 = new THREE.Box3().setFromObject(grp), s2 = b2.getSize(new THREE.Vector3()), c2 = b2.getCenter(new THREE.Vector3());
    grp.position.sub(c2);
    const r = Math.max(s2.x, s2.y, s2.z) * 0.62;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100); cam.position.set(0, 0, r / Math.tan(15 * Math.PI / 180)); cam.lookAt(0, 0, 0);
    wR.render(scene, cam);
    return (wCache[id] = wR.domElement.toDataURL('image/png'));
  };

  /* ---------- petit encart « mon équipement » ---------- */
  AU.kitBox = function (back) {
    const a = Acc.arena(), W = AR.WEAPONS[a.weapon];
    const box = el('div', { class: 'ar-kit' },
      el('div', { class: 'ak-h' }, el('b', null, 'Équipement'), el('span', { style: { color: W.color } }, W.name)),
      el('div', { class: 'ak-row' }, ...a.equip.map(id => el('div', { class: 'ak-s' + (id ? '' : ' empty') }, id ? el('img', { src: AR.icon(id, 64), title: AR.skill(id).name }) : '')), el('div', { class: 'ak-s ult' }, a.ult ? el('img', { src: AR.icon(a.ult, 64), title: AR.skill(a.ult).name }) : '')),
      el('button', { class: 'btn small', onclick: () => { Au.ui('click'); UI.show('a-skills', { back }); } }, el('span', { class: 'icw', html: ICO('bolt', 15) }), ' Compétences & arme'));
    return box;
  };

  /* =====================================================================
     MENU PRINCIPAL DU JEU
     ===================================================================== */
  UI.screen('arena', {
    enter(n) {
      BR.curGame = 'arena'; BR.ascMode = false; AU.bg(true); Au.track('music', 'arene_menu', 0.55);
      const a = Acc.arena();
      n.innerHTML = `<div class="main ar-main">
        <div class="main-left">
          <div class="logo"><div class="logo-t ar-logo">COLOSSES</div><div class="logo-s">C L A S S I Q U E &nbsp; · &nbsp; B O S S &nbsp; · &nbsp; D U E L S</div></div>
          <nav class="menu ar-menu">
            <button class="mi ar-hot" data-go="a-boss"><span>Combattre un boss</span></button>
            <button class="mi ar-hot" data-go="friend"><span>Duel entre amis</span></button>
            <button class="mi" data-go="multi"><span>Rejoindre un salon</span></button>
            <button class="mi" data-go="a-skills"><span>Pouvoirs${a.free ? ' <b class="ar-badge">1 tirage offert</b>' : ''}</span></button>
            <button class="mi" data-go="char"><span>Personnage</span></button>
            <button class="mi" data-go="a-duel"><span>Entraînement</span></button>
            <button class="mi back" data-go="hub"><span>${ICO('back', 16)} Changer de jeu</span></button>
          </nav>
        </div>
        <div class="main-right">
          <div class="pcard ar-pcard"><canvas class="pv"></canvas></div>
          <div class="kit-slot"></div>
        </div></div>`;
      n.querySelector('.kit-slot').appendChild(AU.kitBox('arena'));
      n.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
        const g = b.dataset.go; Au.ui(g === 'hub' ? 'back' : 'click');
        if (g === 'friend') { AU.duelFriend(); return; }
        UI.show(g, g === 'char' || g === 'settings' ? { back: 'arena' } : {});
      }));
      killPreview(); preview = BR.Avatar.Preview(n.querySelector('.pv')); preview.setLook(Acc.p.look);
    },
    leave() { killPreview(); },
  });

  /* =====================================================================
     CHOIX DU BOSS
     ===================================================================== */
  const fmtT = s => BR.fmtTime(s);
  function diffRow() { return `<div class="ar-diffs">${Object.values(AR.DIFFS).map(d => `<button class="ar-d ${diffSel === d.id ? 'on' : ''}" data-d="${d.id}" style="--dc:${d.color}"><b>${d.name}</b></button>`).join('')}</div>`; }
  // tous les colosses sont proposés (avant : 4 tirés au hasard, certains semblaient impossibles à choisir), + « Aléatoire » et l'entraînement
  UI.screen('a-boss', {
    enter(n) {
      const st = Acc.arena().st, offer = AR.BOSSES.slice();
      n.innerHTML = `<div class="panel wide ar-bpanel">
        <div class="ph"><button class="btn ghost back" data-act="back">${ICO('back', 18)}</button><h2>Choisis ton colosse</h2><span class="ar-bnote">${AR.BOSSES.length} colosses</span></div>
        <div class="ar-bosses all">${offer.map(b => `
          <div class="ar-boss" data-b="${b.id}" style="--bc:${b.color}">
            <div class="ab-art"><div class="ab-glow"></div><img src="${faceURL(bossFace(b.id))}" alt="">${b.isNew ? '<span class="ab-new">NOUVEAU</span>' : ''}</div>
            <div class="ab-body"><div class="ab-name">${b.name}</div><div class="ab-sub">${b.sub}</div><p class="ab-desc">${esc(b.desc)}</p>
              <div class="ab-evo" title="Le colosse évolue selon ses PV perdus et la durée du combat"><i></i><i></i><i></i><span>3 stades d'évolution</span></div>
              ${st.boss[b.id] ? `<div class="ab-rec">${ICO('check', 13)} Vaincu ×${st.boss[b.id]}</div>` : ''}</div>
          </div>`).join('')}</div>
        <div class="ar-bextra">
          <div class="ar-bx" data-x="random"><b>?</b><div><div class="ab-name">ALÉATOIRE</div><div class="ab-sub">Un colosse surprise parmi les ${AR.BOSSES.length}</div></div></div>
          <div class="ar-bx" data-x="duel"><b>${ICO('target', 26)}</b><div><div class="ab-name">DUEL</div><div class="ab-sub">Entraînement contre l'IA</div></div></div>
        </div>
        ${diffRow()}
</div>`;
      n.querySelector('.ar-diffs').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; diffSel = b.dataset.d; Au.ui('click'); n.querySelectorAll('.ar-d').forEach(x => x.classList.toggle('on', x === b)); });
      n.querySelectorAll('.ar-boss').forEach(c => c.addEventListener('click', () => { Au.ui('ok'); AU.launchBoss(c.dataset.b, diffSel); }));
      n.querySelectorAll('.ar-bx').forEach(c => c.addEventListener('click', () => {
        if (c.dataset.x === 'random') { Au.ui('ok'); AU.launchBoss(BR.pick(AR.BOSSES).id, diffSel); }
        else { Au.ui('click'); UI.show('a-duel'); }
      }));
    },
  });

  UI.screen('a-duel', {
    enter(n) {
      n.innerHTML = `<div class="panel">
        <div class="ph"><button class="btn ghost back" data-act="back">${ICO('back', 18)}</button><h2>Entraînement</h2></div>
        <p class="muted">Un duel contre l'ordinateur pour t'entraîner. Premier à 2 manches.</p>
        ${diffRow()}
        <div class="row center"><button class="btn primary big go">COMBATTRE</button></div>
</div>`;
      n.querySelector('.ar-diffs').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; diffSel = b.dataset.d; Au.ui('click'); n.querySelectorAll('.ar-d').forEach(x => x.classList.toggle('on', x === b)); });
      n.querySelector('.go').addEventListener('click', () => { Au.ui('ok'); AU.launchDuelBot(diffSel); });
    },
  });

  /* =====================================================================
     COMPÉTENCES & ARME
     ===================================================================== */
  let skTab = 'skill', skSel = null, slotSel = 0, skBack = 'arena';
  UI.screen('a-skills', {
    enter(n, o) {
      skBack = o.back || (UI.current() === 'a-skills' ? skBack : 'arena');
      n.innerHTML = `<div class="panel wide ar-sk">
        <div class="ph"><button class="btn ghost back" data-a="back">${ICO('back', 18)}</button><h2>Pouvoirs</h2><div class="pts">${COIN(18)} <b class="ptsv"></b></div></div>
        <div class="ar-skgrid">
          <div class="col">
            <h4>Arme</h4><div class="ar-weapons"></div>
            <h4>Équipés</h4><div class="ar-slots"></div>
            <div class="ar-detail"></div>
          </div>
          <div class="col">
            <div class="tabs"><button data-t="skill">Compétences</button><button data-t="ult">Ultimes</button></div>
            <div class="ar-list"></div>
            <button class="btn primary big" data-a="roul">${ICO('bolt', 18)} ROULETTE${Acc.arena().free ? ' — 1 tirage offert' : ''}</button>
          </div>
        </div></div>`;
      n.addEventListener('click', e => {
        const t = e.target.closest('[data-t]'); if (t) { skTab = t.dataset.t; skSel = null; Au.ui('click'); render(n); return; }
        const w = e.target.closest('[data-w]'); if (w) { Acc.setWeapon(w.dataset.w); Au.ui('ok'); render(n); return; }
        const sl = e.target.closest('[data-slot]'); if (sl) { const v = sl.dataset.slot; if (v === 'u') { skTab = 'ult'; skSel = Acc.arena().ult; } else { slotSel = +v; skTab = 'skill'; skSel = Acc.arena().equip[slotSel]; } Au.ui('click'); render(n); return; }
        const it = e.target.closest('[data-sk]'); if (it) { skSel = it.dataset.sk; Au.ui('click'); render(n); return; }
        const a = e.target.closest('[data-a]'); if (!a) return;
        const act = a.dataset.a;
        if (act === 'back') { Au.ui('back'); UI.show(skBack); }
        if (act === 'roul') { Au.ui('click'); UI.show('a-roul', { back: 'a-skills' }); }
        if (act === 'equip') { const d = AR.skill(skSel); if (d.type === 'ult') Acc.equipUlt(skSel); else Acc.equipSkill(slotSel, skSel); Au.ui('ok'); render(n); }
        if (act === 'unequip') { Acc.equipSkill(+a.dataset.i, null); Au.ui('back'); render(n); }
        if (act === 'up') { const r = Acc.upgradeSkill(skSel); if (r.ok) { Au.fx('reveal'); UI.toast(AR.skill(skSel).name + ' passe niveau ' + r.lv + ' !', 'good'); } else UI.toast(r.msg, 'error'); render(n); }
      });
      render(n);
    },
  });
  function render(n) {
    const a = Acc.arena();
    n.querySelector('.ptsv').textContent = BR.fmt(Acc.p.points);
    n.querySelectorAll('.tabs [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === skTab));
    n.querySelector('.ar-weapons').innerHTML = Object.entries(AR.WEAPONS).map(([id, w]) => `<button class="ar-w ${a.weapon === id ? 'on' : ''}" data-w="${id}" style="--wc:${w.color}" title="${esc(w.desc)}"><img src="${AU.weaponThumb(id)}" alt=""><div><b>${w.name}</b><span>${w.tag}</span>${['Vitesse', 'Puissance', 'Portée'].map((l, i) => `<div class="wst"><em>${l}</em><i>${[1, 2, 3, 4, 5].map(k => `<u class="${k <= w.stats[i] ? 'on' : ''}"></u>`).join('')}</i></div>`).join('')}</div></button>`).join('');
    n.querySelector('.ar-slots').innerHTML = a.equip.map((id, i) => `<div class="ar-slot ${slotSel === i && skTab === 'skill' ? 'sel' : ''}" data-slot="${i}">${id ? `<img src="${AR.icon(id, 96)}"><span class="lv">Niv. ${a.owned[id].lv}</span><button class="x" data-a="unequip" data-i="${i}" title="Retirer">×</button>` : '<div class="plus">+</div>'}<span class="key">${AR.key(AR.KEYS.skills[i])}</span></div>`).join('')
      + `<div class="ar-slot ult ${skTab === 'ult' ? 'sel' : ''}" data-slot="u">${a.ult ? `<img src="${AR.icon(a.ult, 96)}"><span class="lv">Niv. ${a.owned[a.ult].lv}</span>` : '<div class="plus">+</div>'}<span class="key">${AR.key(AR.KEYS.ult)}</span></div>`;
    const list = AR.SKILLS.filter(s => s.type === skTab);
    n.querySelector('.ar-list').innerHTML = list.map(s => { const o = a.owned[s.id], eq = a.equip.includes(s.id) || a.ult === s.id; return `<div class="ar-it ${o ? '' : 'locked'} ${skSel === s.id ? 'sel' : ''} ${eq ? 'eq' : ''}" data-sk="${s.id}" style="--rc:${BR.RARITY[s.rarity].color}"><img src="${AR.icon(s.id, 96, !o)}"><b>${s.name}</b>${o ? `<span>Niv. ${o.lv}${o.lv < AR.MAXLV ? ` <i class="xpb"><i style="width:${(o.xp / AR.xpNeed(o.lv)) * 100}%"></i></i>` : ' MAX'}</span>` : `<span class="muted">${BR.RARITY[s.rarity].label}</span>`}</div>`; }).join('');
    const d = n.querySelector('.ar-detail');
    const s = skSel && AR.skill(skSel);
    if (!s) { d.innerHTML = `<div class="muted">Choisis un pouvoir.</div>`; return; }
    const o = a.owned[s.id], lv = o ? o.lv : 1;
    const stat = [];
    if (s.cd) stat.push(`<div><span>Recharge</span><b>${(s.cd * AR.cdMult(lv)).toFixed(1)} s</b></div>`);
    const eqd = s.type === 'ult' ? a.ult === s.id : a.equip[slotSel] === s.id;
    d.innerHTML = `<div class="ad-h"><img src="${AR.icon(s.id, 96, !o)}"><div><b>${s.name}</b> ${RT(s.rarity)}<div class="stars">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= (o ? lv : 0) ? 'on' : ''}">★</i>`).join('')}</div></div></div>
      <p>${s.desc}</p><div class="ad-stats">${stat.join('')}</div>
      <div class="ad-aw">${s.aw.map((t, i) => `<div class="${o && lv >= (i ? 5 : 3) ? 'on' : ''}"><span>Niv. ${i ? 5 : 3}</span>${t}</div>`).join('')}</div>
      ${o ? `<div class="row">${eqd ? `<span class="tag ok">${ICO('check', 14)} Équipée</span>` : `<button class="btn primary" data-a="equip">${s.type === 'ult' ? 'Équiper comme ultime' : 'Équiper (emplacement ' + AR.key(AR.KEYS.skills[slotSel]) + ')'}</button>`}
        ${lv < AR.MAXLV ? `<button class="btn" data-a="up">Niv. ${lv + 1} — ${COIN(14)} ${BR.fmt(AR.upCost(s, lv))}</button>` : '<span class="tag gold">Niveau max</span>'}</div>`
        : `<div class="muted">À obtenir à la roulette.</div>`}`;
  }

  /* =====================================================================
     ROULETTE
     ===================================================================== */
  let roulBack = 'arena';
  UI.screen('a-roul', {
    enter(n, o) {
      roulBack = o.back || (UI.current() === 'a-roul' ? roulBack : 'arena');
      const a = Acc.arena();
      n.innerHTML = `<div class="panel wide">
        <div class="ph"><button class="btn ghost back" data-a="back">${ICO('back', 18)}</button><h2>Roulette</h2><div class="pts">${COIN(18)} <b>${BR.fmt(Acc.p.points)}</b></div></div>
        <div class="ar-rouls">${AR.ROULETTES.map(R => {
          const free = R.id === 'commune' && a.free > 0;
          return `<div class="ar-r" style="--rc:${R.color}"><div class="rr-art">${['commun', 'rare', 'epique', 'legendaire'].filter(k => R.odds[k]).map(k => { const pool = AR.SKILLS.filter(s => s.rarity === k && s.id !== 'u_lame'); return pool.length ? `<img src="${AR.icon(pool[(pool.length * 7 + k.length) % pool.length].id, 72)}">` : ''; }).join('')}</div>
            <b class="rr-n">${R.name}</b>
            <div class="rr-odds">${Object.entries(R.odds).filter(([, v]) => v).map(([k, v]) => `<span style="color:${BR.RARITY[k].color}">${BR.RARITY[k].label} ${v} %</span>`).join(' · ')}</div>
            <button class="btn ${free || Acc.p.points >= R.price ? 'primary' : 'ghost'} big" data-r="${R.id}">${free ? 'GRATUIT' : COIN(16) + ' ' + BR.fmt(R.price)}</button></div>`;
        }).join('')}</div>
        <p class="muted center tiny">Un doublon fait monter le pouvoir de niveau.</p></div>`;
      n.addEventListener('click', e => {
        const b = e.target.closest('[data-a=back]'); if (b) { Au.ui('back'); UI.show(roulBack); return; }
        const r = e.target.closest('[data-r]'); if (!r) return;
        const res = Acc.spin(r.dataset.r); if (!res.ok) { UI.toast(res.msg, 'error'); return; }
        Au.ui('buy'); spinModal(r.dataset.r, res, () => UI.show('a-roul', { back: roulBack }));
      });
    },
  });
  function spinModal(rid, res, after) {
    const R = AR.ROULETTES.find(x => x.id === rid), N_ITEMS = 48, WIN = 41, W = 112;
    const items = []; for (let i = 0; i < N_ITEMS; i++) items.push(i === WIN ? res.skill : AR.roll(rid));
    UI.modal((box, close) => {
      box.innerHTML = `<h3>${R.name}</h3><div class="ar-strip"><div class="track">${items.map(s => `<div class="cell" style="--rc:${BR.RARITY[s.rarity].color}"><img src="${AR.icon(s.id, 96)}"></div>`).join('')}</div><i class="mark"></i></div><div class="ar-reveal"></div><div class="row center"><button class="btn primary big rv-ok" style="visibility:hidden">Continuer</button></div>`;
      const track = box.querySelector('.track'), view = box.querySelector('.ar-strip');
      // la cible se calcule une fois la fenêtre affichée (sa largeur est alors connue)
      let target = null, t0 = 0; const dur = 5200, jitter = (Math.random() - 0.5) * W * 0.6; let lastCell = -1;
      const tick = now => {
        if (target == null) { if (!view.clientWidth) { requestAnimationFrame(tick); return; } target = WIN * W + 4 + 52 - view.clientWidth / 2 + jitter; t0 = now; }
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4), x = target * e;
        track.style.transform = `translateX(${-x}px)`;
        const cell = Math.floor((x + view.clientWidth / 2) / W); if (cell !== lastCell) { lastCell = cell; Au.fx('spin', { v: 1 - k }); }
        if (k < 1) requestAnimationFrame(tick); else reveal();
      };
      requestAnimationFrame(tick);
      function reveal() {
        const s = res.skill, c = BR.RARITY[s.rarity].color;
        track.children[WIN].classList.add('win');
        Au.fx('reveal', { rate: s.rarity === 'legendaire' ? 1.5 : s.rarity === 'epique' ? 1.25 : 1 });
        box.querySelector('.ar-reveal').innerHTML = `<div class="rv r-${s.rarity}" style="--rc:${c}"><img src="${AR.icon(s.id, 120)}"><div><div class="rv-t">${res.dupe ? 'DOUBLON' : 'NOUVEAU POUVOIR !'}</div><b>${s.name}</b> ${RT(s.rarity)}<p class="muted">${res.dupe ? `+${res.xp} XP pour cette compétence${res.ups ? ` — <b class="ok">niveau supérieur !</b>` : ''}` : s.desc}</p></div></div>`;
        if (s.rarity === 'legendaire' || s.rarity === 'epique') { box.closest('.modal').classList.add('shake-' + s.rarity); BR.Audio.fx('boom', { g: s.rarity === 'legendaire' ? 0.8 : 0.4, rate: 1.4 }); }
        box.querySelector('.rv-ok').style.visibility = 'visible';
      }
      box.querySelector('.rv-ok').addEventListener('click', () => { close(); after && after(); });
    }, { cls: 'wide', locked: true });
  }

  /* =====================================================================
     RÉSULTATS
     ===================================================================== */
  function showResults(sum) {
    const lv = Acc.applyArena(sum);
    UI.show('a-results', { sum, lv });
  }
  UI.screen('a-results', {
    enter(n, o) {
      const { sum, lv } = o, r = sum.res, rw = sum.reward;
      const win = !!r.win;
      const title = r.aborted ? 'COMBAT INTERROMPU' : r.mode === 'duel' ? (win ? 'DUEL REMPORTÉ' : 'DUEL PERDU') : (win ? 'VICTOIRE' : 'DÉFAITE');
      const sub = r.mode === 'boss' ? `${AR.boss(r.boss).name} · <span style="color:${AR.DIFFS[r.diff].color}">${AR.DIFFS[r.diff].name}</span>` : (r.bot ? 'Contre l\'IA · ' + AR.DIFFS[r.diff].name : 'Duel en ligne');
      const rows = Object.entries(r.players).map(([id, p]) => `<tr class="${id === (sum.res.selfId || '') ? 'me' : ''}"><td>${esc(p.n)}</td><td>${BR.fmt(p.d)}</td><td>${p.p}</td><td>${p.pf}</td><td>${p.x}</td></tr>`).join('');
      const inRoom = !r.solo && N.room && N.status === 'on';
      n.innerHTML = `<div class="panel results ${win ? 'win' : 'lose'}">
        <div class="r-title">${title}</div>
        <div class="r-sub">${sub} · ${BR.fmtTime(r.time)} · combo max ×${sum.maxCombo}${sum.newBest ? ' · nouveau record !' : ''}</div>
        <div class="r-grid">
          <div class="col"><table class="rtab"><tr><th>Joueur</th><th>Dégâts</th><th>Parades</th><th>Esquives</th><th>Chutes</th></tr>${rows}</table>
            ${lv.skillUps.length ? `<div class="ar-ups">${lv.skillUps.map(id => `<div><img src="${AR.icon(id, 48)}"><b>${AR.skill(id).name}</b> passe niveau ${Acc.arena().owned[id].lv} !</div>`).join('')}</div>` : ''}</div>
          <div class="col">
            <div class="rlines">${rw.lines.map(l => `<div><span>${esc(l.label)}</span><b>+${l.v}</b></div>`).join('') || '<div class="muted">Aucun gain cette fois…</div>'}</div>
            <div class="rtotal"><span>Points gagnés</span><b class="cnt">0</b></div>
            <div class="rxp"><div class="lvl">Niveau <b class="lvn">${lv.before.level}</b></div><div class="xpbar"><i style="width:${(lv.before.into / lv.before.need) * 100}%"></i><span>+${rw.xp} XP</span></div></div>
            <div class="lvup">NIVEAU SUPÉRIEUR ! <b></b></div>
          </div>
        </div>
        <div class="row center">
          ${r.solo ? '<button class="btn primary big" data-r="again">Rejouer</button>' : inRoom ? '<button class="btn primary big" data-r="lobby">Retour au salon</button>' : ''}
          <button class="btn big" data-r="arena">Menu Colosses</button>
        </div></div>`;
      const cnt = n.querySelector('.cnt'), t0 = performance.now();
      const tick = now => { const k = Math.min(1, (now - t0) / 1200); cnt.textContent = BR.fmt(rw.points * (1 - Math.pow(1 - k, 3))); if (k < 1 && cnt.isConnected) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      setTimeout(() => { const bar = n.querySelector('.rxp .xpbar i'); if (!bar) return; if (lv.levelUp) { bar.style.width = '100%'; const u = n.querySelector('.lvup'); u.querySelector('b').textContent = lv.after.level + ' — ' + BR.rankName(lv.after.level); u.classList.add('on'); n.querySelector('.lvn').textContent = lv.after.level; Au.ui('buy'); } else bar.style.width = (lv.after.into / lv.after.need) * 100 + '%'; }, 600);
      Au.track('music', 'arene_menu', 0.5);
      n.addEventListener('click', e => {
        const b = e.target.closest('[data-r]'); if (!b) return; Au.ui('click');
        const a = b.dataset.r;
        if (a === 'again') { if (r.mode === 'boss') AU.launchBoss(r.boss, r.diff); else AU.launchDuelBot(r.diff); }
        else if (a === 'lobby') UI.show(N.room ? 'lobby' : 'multi');
        else UI.show('arena');
      });
    },
  });
})();

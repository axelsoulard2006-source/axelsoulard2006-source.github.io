/* ===== ui.js : interface de Blocaria
   HUD (barre rapide animée, nom de l'objet tenu en fondu, cœurs, armure, faim, oxygène, expérience),
   infobulles détaillées, petits sons d'interface, inventaire (armure, main secondaire, aperçu 3D via preview.js),
   établi, four animé, coffre simple / double, livre de recettes (catégories + recherche), mode créatif, chat, menus.
   Style propre à Blocaria : bois et pierre chauds, bordures biseautées en relief, ombres portées.
   Les fenêtres sont construites une fois à l'ouverture puis mises à jour sur place (pas de clignotement,
   la recherche garde le focus, le four s'anime à chaque image). ===== */
(function () {
  const VX = window.VX;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const UI = VX.UI = {};
  let G, cursorEl, tipEl;
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  /* =====================================================================
     1. TEXTURES D'INTERFACE (bois, pierre, cuir) dessinées en pixels, données au CSS par des variables
     ===================================================================== */
  function makeTex(w, h, seed, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    paint(g, rnd, w, h); return c.toDataURL();
  }
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  function uiTextures() {
    // planches de bois : 4 lattes de 8 px, veinage horizontal, joints sombres décalés
    const wood = makeTex(32, 32, 7, (g, r) => {
      for (let p = 0; p < 4; p++) {
        const base = ['#b0814c', '#a87a46', '#b78a52', '#a2743f'][p];
        for (let y = p * 8; y < p * 8 + 8; y++) for (let x = 0; x < 32; x++) { g.fillStyle = shade(base, 0.92 + r() * 0.14); g.fillRect(x, y, 1, 1); }
        for (let k = 0; k < 3; k++) { const y = p * 8 + 1 + Math.floor(r() * 6), x0 = Math.floor(r() * 24); g.fillStyle = shade(base, 0.78); g.fillRect(x0, y, 4 + Math.floor(r() * 8), 1); }
        g.fillStyle = '#5e3c1c'; g.fillRect(0, p * 8 + 7, 32, 1);
        const j = (p * 13 + 5) % 32; g.fillRect(j, p * 8, 1, 7);
      }
    });
    // pierre taillée : bruit chaud et quelques fissures
    const stone = makeTex(32, 32, 11, (g, r) => {
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { g.fillStyle = shade('#8c8379', 0.85 + r() * 0.25); g.fillRect(x, y, 1, 1); }
      for (let k = 0; k < 7; k++) { let x = Math.floor(r() * 32), y = Math.floor(r() * 32); g.fillStyle = 'rgba(40,30,22,.35)'; for (let i = 0; i < 4; i++) { g.fillRect(x, y, 1, 1); x += r() < 0.5 ? 1 : 0; y += 1; } }
    });
    // pierre sombre (fond des cases, barre rapide)
    const dark = makeTex(16, 16, 23, (g, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = shade('#4a3f36', 0.85 + r() * 0.3); g.fillRect(x, y, 1, 1); } });
    // cuir vert du livre de recettes
    const leather = makeTex(16, 16, 31, (g, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = shade('#4f7a3a', 0.88 + r() * 0.2); g.fillRect(x, y, 1, 1); } });
    // parchemin (page du livre)
    const paper = makeTex(16, 16, 41, (g, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = shade('#e9d9b4', 0.94 + r() * 0.08); g.fillRect(x, y, 1, 1); } });
    const R = document.documentElement.style;
    R.setProperty('--tex-wood', `url(${wood})`); R.setProperty('--tex-stone', `url(${stone})`); R.setProperty('--tex-dark', `url(${dark})`);
    R.setProperty('--tex-leather', `url(${leather})`); R.setProperty('--tex-paper', `url(${paper})`);
  }

  /* =====================================================================
     2. ICÔNES DU HUD (9×9 pixels)
     ===================================================================== */
  function pix(rows, pal) { const c = document.createElement('canvas'); c.width = c.height = 9; const g = c.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } })); return c.toDataURL(); }
  const HEART = ['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', 'krrrrrrdk', '.krrrrdk.', '..krrdk..', '...kdk...', '....k....'];
  const PLATE = ['.kk...kk.', 'kwwkkkwwk', 'kwhwwwwwk', '.kwwwwwk.', '.kwhwwwk.', '.kwwwwwk.', '.kwwwwwk.', '.kkkkkkk.', '.........'];
  const BUBBLE = ['...kkk...', '..kbbbk..', '.kbwbbbk.', '.kbwbbbk.', '.kbbbbbk.', '.kbbbbbk.', '..kbbbk..', '...kkk...', '.........'];
  const APPLE = ['....g....', '...gl....', '..rrrrr..', '.rwrrrrr.', '.rrrrrrr.', '.rrrrrrr.', '.rrrrrrd.', '..rrrrd..', '...rdd...'];
  const ICONS = {
    heart: pix(HEART, { k: '#1a0a0a', r: '#e8202a', w: '#ffc0b8', d: '#a8121a' }),
    heartE: pix(HEART, { k: '#1a0a0a', r: '#3a2624', w: '#4a302c', d: '#2e1e1c' }),
    heartW: pix(HEART, { k: '#2a1010', r: '#ffffff', w: '#ffffff', d: '#f0e0e0' }),
    food: pix(APPLE, { g: '#5a3a20', l: '#47d16c', r: '#e0302a', w: '#ffd0c8', d: '#9a1a14' }),
    foodE: pix(APPLE, { g: '#3a3a3a', l: '#3a3a3a', r: '#3a2a2a', w: '#3a2a2a', d: '#3a2a2a' }),
    plate: pix(PLATE, { k: '#1a1a1a', w: '#d8d4cc', h: '#ffffff' }), plateE: pix(PLATE, { k: '#1a1a1a', w: '#3a3632', h: '#3a3632' }),
    bubble: pix(BUBBLE, { k: '#0a2a5a', b: '#4aa8ff', w: '#e8f6ff' }),
  };
  const ARMOR_HINT = ['casque', 'plastron', 'jambières', 'bottes'];

  /* =====================================================================
     3. SONS D'INTERFACE : on passe par VX.G.sfx. S'il existe un catalogue audio (audio.js) sans sons d'interface,
        on y ajoute deux petits « tic » boisés (aucune modification d'audio.js).
     ===================================================================== */
  function regUiSounds() {
    const A = VX.Audio; if (!A || !A.sounds || A.sounds.uiclick) return;
    const tick = (f1, f2, dur, vol, type) => t => {
      const c = A.ctx; if (!c) return; const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'triangle'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * (A.vol.sfx || 0) + 0.0001, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.04);
    };
    A.sounds.uiclick = tick(1250, 620, 0.045, 0.11);       // clic de bouton / de case
    A.sounds.uihover = tick(1900, 1500, 0.02, 0.025, 'sine'); // survol discret
    A.sounds.uipage = t => { tick(820, 500, 0.05, 0.08)(t); tick(1100, 700, 0.04, 0.06)(t + 0.05); };   // page du livre
  }
  const sfx = n => { try { regUiSounds(); if (G && G.sfx) G.sfx(n); } catch (e) {} };
  UI.sfx = sfx;

  /* =====================================================================
     4. INITIALISATION
     ===================================================================== */
  UI.init = function (game) {
    G = game;
    if (!('offhand' in G)) G.offhand = null;   // main secondaire (bouclier…) : gérée par le gameplay, affichée ici
    uiTextures();
    const hud = el('div', 'hud');
    hud.innerHTML = `<div class="cross"></div><div class="mine"><i></i></div>
      <div class="hudbot">
        <div class="held"></div>
        <div class="bars"><div class="left"><div class="armor"></div><div class="hearts"></div></div><div class="right"><div class="bubbles"></div><div class="foods"></div></div></div>
        <div class="xp" style="display:none"><b>0</b><div class="xpbar"><i></i></div></div>
        <div class="hotbar"><div class="selframe"></div></div>
      </div>
      <div class="info"></div><div class="toast"></div><div class="water"></div><div class="hurt"></div><div class="portalfx"></div>
      <div class="chat"><div class="chatlog"></div><input class="chatin" maxlength="160" spellcheck="false" autocomplete="off"></div>`;
    document.body.appendChild(hud);
    for (let i = 0; i < 9; i++) $('.hotbar').appendChild(el('div', 'slot', ''));
    buildBars();
    const scr = el('div', 'screens'); scr.innerHTML = `<div class="panel inv" style="display:none"></div><div class="panel menu" style="display:none"></div>`; document.body.appendChild(scr);
    cursorEl = el('div', 'cursor slot'); document.body.appendChild(cursorEl);
    tipEl = el('div', 'tip'); document.body.appendChild(tipEl);
    document.addEventListener('mousemove', e => {
      UI.mouse = { x: e.clientX, y: e.clientY };
      cursorEl.style.left = e.clientX - cursorEl.offsetWidth / 2 + 'px'; cursorEl.style.top = e.clientY - cursorEl.offsetHeight / 2 + 'px';
      placeTip();
    });
    document.addEventListener('contextmenu', e => { if (UI.open) e.preventDefault(); });
    // touches 1 à 9 sur une case survolée : échange avec la barre rapide (inventaire ouvert)
    document.addEventListener('keydown', e => {
      if (!UI.open || !hoverRef || /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName)) return;
      const m = /^Digit([1-9])$/.exec(e.code); if (!m) return;
      const h = +m[1] - 1, [k] = hoverRef.split(':'); if (k === 'r' || k === 'p' || hoverRef === 'c:out' || hoverRef === 'f:out') return;
      const a = getRef(hoverRef), b = G.inv[h]; if (k === 'a' && b && !armorSlotOk(+hoverRef.split(':')[1], b)) return;
      setRef(hoverRef, b); G.inv[h] = a; sfx('uiclick'); UI.refresh();
    });
    // chat : Entrée envoie, Échap ferme
    const ci = $('.chatin');
    ci.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); const t = ci.value; UI.closeChat(); G.command(t); G.relock(); }
      else if (e.key === 'Escape') { e.preventDefault(); UI.closeChat(); G.relock(); }
    });
    ci.addEventListener('blur', () => { if (UI.chatOpen) setTimeout(() => { if (UI.chatOpen && document.activeElement !== ci) ci.focus(); }, 0); });
    setInterval(() => { const now = Date.now(); document.querySelectorAll('.chatlog p').forEach(p => p.classList.toggle('old', now - +p.dataset.t > 9000)); }, 1000);
    // mises à jour à chaque image : expérience, four animé, validité du double coffre
    if (VX.hooks) VX.hooks.on('renderFrame', frameTick);
    window.addEventListener('resize', () => placeSelFrame(true));
  };

  /* =====================================================================
     5. HUD
     ===================================================================== */
  const slotHTML = st => {
    if (!st) return '';
    const dm = VX.duraOf(st.id), f = st.d != null && dm ? Math.max(0, st.d / dm) : 1;
    return `<img src="${VX.icon(st.id).url}" draggable="false">${st.n > 1 ? `<b>${st.n}</b>` : ''}${st.d != null && dm && f < 1 ? `<u style="--f:${f};--c:hsl(${f * 120},85%,48%)"></u>` : ''}`;
  };
  const sig = st => st ? st.id + ':' + st.n + ':' + (st.d == null ? '' : st.d) : '';
  // une rangée de 10 icônes persistantes (base + moitié superposée), mise à jour sans reconstruire
  function iconRow(box, rev) {
    const cells = [];
    for (let i = 0; i < 10; i++) { const w = el('span', 'ic'); const a = el('img'), b = el('img', 'half'); w.append(a, b); w.style.setProperty('--i', rev ? 9 - i : i); box.appendChild(w); cells.push({ w, a, b, k: '' }); }
    if (rev) cells.reverse();   // la faim et l'oxygène se vident par la gauche : la case 0 est à droite
    return cells;
  }
  function setIcon(c, v, i, full, empty, lost) {
    // v : valeur sur 20 ; lost : valeur avant les dégâts (affichée en blanc pendant le clignotement)
    const st = v >= i * 2 + 2 ? 'f' : v === i * 2 + 1 ? 'h' : 'e', ls = lost != null && lost > i * 2 && st !== 'f' ? 'w' : '';
    const k = st + ls + full; if (c.k === k) return; c.k = k;
    c.a.src = st === 'f' ? full : (ls ? ICONS.heartW : empty); c.b.src = full; c.b.style.display = st === 'h' ? '' : 'none';
  }
  let rows = null;
  function buildBars() {
    rows = { hearts: iconRow($('.hearts')), armor: iconRow($('.armor')), foods: iconRow($('.foods'), true), bubbles: iconRow($('.bubbles'), true) };
    rows.bubbles.forEach(c => { c.a.src = ICONS.bubble; c.b.remove(); });
    $('.bubbles').classList.add('off');   // cachée tant qu'on n'est pas sous l'eau
  }
  let lastHp = null, lastFood = null, lostHp = null, flashT = 0, lastSel = -1, lastHeld = null, hbSig = [];
  UI.hud = function () {
    if (!G || !rows) return;
    const P = G.player, cre = G.mode === 'creatif';
    // barre rapide (mise à jour case par case)
    const hb = document.querySelectorAll('.hotbar .slot');
    hb.forEach((s, i) => { const k = sig(G.inv[i]); if (hbSig[i] !== k) { hbSig[i] = k; s.innerHTML = slotHTML(G.inv[i]); } s.classList.toggle('sel', i === G.sel); });
    placeSelFrame();
    $('.bars').classList.toggle('off', cre);
    // cœurs : tremblent quand la vie est basse, clignotent en blanc à chaque dégât, petite vague quand on guérit
    const fl = performance.now() < flashT, hearts = $('.hearts');
    rows.hearts.forEach((c, i) => setIcon(c, P.hp, i, ICONS.heart, ICONS.heartE, fl ? lostHp : null));
    hearts.classList.toggle('low', P.hp > 0 && P.hp <= 6);
    if (lastHp != null && P.hp > lastHp) pulse(hearts, 'regen', 700);
    lastHp = P.hp;
    // faim : les pommes tressautent quand la faim baisse
    rows.foods.forEach((c, i) => setIcon(c, P.food, i, ICONS.food, ICONS.foodE));
    if (lastFood != null && P.food < lastFood) pulse($('.foods'), 'bob', 650);
    $('.foods').classList.toggle('starve', P.food <= 0);
    lastFood = P.food;
    // armure : au-dessus des cœurs, seulement si on porte quelque chose (points calculés par main.js / survie.js)
    const pts = G.armorPts ? G.armorPts() : 0;
    $('.armor').classList.toggle('none', !(pts > 0));
    if (pts > 0) rows.armor.forEach((c, i) => setIcon(c, Math.min(20, pts), i, ICONS.plate, ICONS.plateE));
    // nom de l'objet tenu : apparaît en fondu quand on change de case ou d'objet
    const it = G.inv[G.sel], hid = it ? it.id : 0;
    if (G.sel !== lastSel || hid !== lastHeld) {
      const h = $('.held'); h.textContent = it ? VX.nameOf(it.id) : ''; h.style.color = it ? rarity(it.id) : '';
      h.classList.remove('show'); void h.offsetWidth; if (it) h.classList.add('show');
      lastSel = G.sel; lastHeld = hid;
    }
  };
  // cadre de sélection qui glisse d'une case à l'autre
  let selX = null;
  function placeSelFrame(force) {
    const hb = $('.hotbar'), s = hb && hb.querySelectorAll('.slot')[G.sel], f = hb && hb.querySelector('.selframe'); if (!s || !f) return;
    const x = s.offsetLeft; if (x === selX && !force) return; selX = x;
    f.style.transform = `translateX(${x}px)`; f.style.width = s.offsetWidth + 'px'; f.style.height = s.offsetHeight + 'px'; f.style.top = s.offsetTop + 'px';
    f.classList.remove('kick'); void f.offsetWidth; f.classList.add('kick');
  }
  function pulse(e, cls, ms) { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); clearTimeout(e['_t' + cls]); e['_t' + cls] = setTimeout(() => e.classList.remove(cls), ms); }
  UI.flashHearts = () => {
    const e = $('.hearts'); if (!e) return;
    if (lostHp == null || performance.now() > flashT) lostHp = lastHp;   // vie avant le coup (les cœurs perdus s'affichent en blanc)
    flashT = performance.now() + 520; pulse(e, 'flash', 520);
    setTimeout(() => { if (performance.now() >= flashT) { lostHp = null; UI.hud(); } }, 540);
  };
  // oxygène : n bulles (−1 = barre cachée) ; chaque bulle perdue éclate
  let lastBub = -1;
  UI.bubbles = n => {
    const box = $('.bubbles'); if (!box || !rows) return;
    if (G.mode === 'creatif') n = -1;
    box.classList.toggle('off', n < 0);
    if (n >= 0) rows.bubbles.forEach((c, i) => {
      const on = i < n; c.w.classList.toggle('gone', !on);
      if (!on && lastBub > i) { c.w.classList.remove('pop'); void c.w.offsetWidth; c.w.classList.add('pop'); }
      if (on) c.w.classList.remove('pop');
    });
    lastBub = n;
  };
  // expérience : affichée seulement si le gameplay fournit player.xp et VX.xpLevel(xp) → { level, frac }
  let xpSig = '';
  function xpTick() {
    const P = G.player, xb = $('.xp'); if (!xb) return;
    const ok = typeof VX.xpLevel === 'function' && P && typeof P.xp === 'number' && G.mode !== 'creatif';
    if (!ok) { if (xpSig !== 'off') { xb.style.display = 'none'; xpSig = 'off'; } return; }
    const L = VX.xpLevel(P.xp) || { level: 0, frac: 0 }, k = L.level + ':' + (L.frac || 0).toFixed(3);
    if (k === xpSig) return;
    const prev = xpSig.split(':')[0]; xpSig = k; xb.style.display = '';
    xb.querySelector('i').style.width = Math.max(0, Math.min(1, L.frac || 0)) * 100 + '%';
    const b = xb.querySelector('b'); b.textContent = L.level > 0 ? L.level : ''; if (prev !== '' && prev !== 'off' && +prev < L.level) pulse(xb, 'up', 900);
  }
  UI.info = t => { const e = $('.info'); if (e) e.textContent = t; };
  let toastT = null;
  UI.toast = t => { const e = $('.toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); };
  UI.mining = f => { const e = $('.mine'); e.style.display = f > 0 ? 'block' : 'none'; e.firstChild.style.width = Math.round(f * 100) + '%'; };
  UI.fx = (water, hurt, portal) => { const w = $('.water'); w.style.opacity = water ? 1 : 0; w.classList.toggle('lava', water === 2); $('.hurt').style.opacity = hurt; $('.portalfx').style.opacity = portal; };

  /* =====================================================================
     6. INFOBULLES : nom (couleur de rareté), catégorie, description, durabilité
     ===================================================================== */
  const TOOLN = { pioche: 'la pioche', hache: 'la hache', pelle: 'la pelle', epee: "l'épée" };
  function rarity(id) {
    const n = VX.nameOf(id).toLowerCase();
    if (/astrium/.test(n)) return '#e59bff'; if (/saphir/.test(n)) return '#7cc4ff'; if (/\bor\b|d'or/.test(n)) return '#ffd75a';
    if (/obsidienne|portail|essence/.test(n)) return '#c79cff'; return '';
  }
  function category(id) {
    const it = VX.ITEMS[id], n = VX.nameOf(id).toLowerCase();
    if ((VX.ARMOR && VX.ARMOR[id]) || (it && it.tool && it.tool.kind === 'epee') || /bouclier|\barc\b|flèche/.test(n) || (it && (it.shield || it.weapon))) return 'equip';
    if ((it && it.tool) || id === VX.I.ALLUMEUR || /seau|briquet|canne|cisaille/.test(n)) return 'outils';
    const B = VX.B;
    if ((it && it.food) || [B.ETABLI, B.FOUR, B.COFFRE, B.TORCHE, B.BRAISIER].includes(id) || !VX.isBlock(id)) return 'survie';
    return 'blocs';
  }
  const CATN = { outils: 'Outil', blocs: 'Bloc', survie: 'Survie', equip: 'Équipement' };
  function describe(st, extra) {
    const id = st.id, D = VX.BLOCKS[id], it = VX.ITEMS[id], lines = [];
    let kind = CATN[category(id)];
    if (it && it.desc) lines.push(it.desc); else if (D && VX.isBlock(id) && D.desc) lines.push(D.desc);
    if (VX.isBlock(id) && D) {
      if (D.light) lines.push('Éclaire alentour (lumière ' + D.light + ')');
      if (D.plant) lines.push('Plante : tombe sans support');
      if (D.hurt) lines.push('Pique au contact');
      if (D.tool) lines.push('Se récolte vite avec ' + (TOOLN[D.tool] || D.tool) + (D.tier >= 0 && VX.TIERS[D.tier] ? ' ' + VX.TIERS[D.tier].name + ' au moins' : ''));
    }
    if (it && it.tool) {
      const t = VX.TIERS[it.tool.tier];
      kind = it.tool.kind === 'epee' ? 'Arme' : 'Outil';
      if (it.tool.kind === 'epee' && t) lines.push('Dégâts : ' + t.dmg); else lines.push('Vitesse de travail ×' + it.tool.speed);
    }
    if (it && it.food) lines.push('Nourriture : +' + (it.food / 2) + ' pomme' + (it.food > 2 ? 's' : ''));
    const ar = VX.ARMOR && VX.ARMOR[id]; if (ar) { kind = 'Armure'; lines.push(ARMOR_HINT[ar.slot][0].toUpperCase() + ARMOR_HINT[ar.slot].slice(1) + ' · protection +' + ar.pts); }
    const fu = VX.fuelOf(id); if (fu) lines.push('Combustible : ' + fu + ' s (' + (Math.round(fu / VX.SMELT_T * 10) / 10) + ' cuisson' + (fu / VX.SMELT_T >= 2 ? 's' : '') + ')');
    if (VX.SMELT && VX.SMELT[id]) lines.push('Au four : ' + VX.nameOf(VX.SMELT[id]));
    let h = `<div class="tt-n" style="${rarity(id) ? 'color:' + rarity(id) : ''}">${esc(VX.nameOf(id))}${st.n > 1 ? ` <small>×${st.n}</small>` : ''}</div><div class="tt-k">${esc(kind)}</div>`;
    if (lines.length) h += `<div class="tt-d">${lines.map(esc).join('<br>')}</div>`;
    const dm = VX.duraOf(id);
    if (dm) { const d = st.d != null ? st.d : dm, f = Math.max(0, d / dm); h += `<div class="tt-u">Durabilité ${d} / ${dm}<span><i style="width:${f * 100}%;background:hsl(${f * 120},85%,48%)"></i></span></div>`; }
    if (extra) h += extra;
    return h;
  }
  let tipOn = false;
  function showTip(html) { tipEl.innerHTML = html; tipEl.style.display = 'block'; tipOn = true; placeTip(); }
  function hideTip() { tipEl.style.display = 'none'; tipOn = false; }
  UI.showTip = showTip; UI.hideTip = hideTip;
  function placeTip() {
    if (!tipOn || !UI.mouse) return;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight; let x = UI.mouse.x + 16, y = UI.mouse.y + 12;
    if (x + w > innerWidth - 4) x = UI.mouse.x - w - 12; if (y + h > innerHeight - 4) y = innerHeight - h - 4;
    tipEl.style.left = Math.max(4, x) + 'px'; tipEl.style.top = Math.max(4, y) + 'px';
  }

  /* =====================================================================
     7. CHAT
     ===================================================================== */
  UI.say = function (text, kind) {
    const log = $('.chatlog'); if (!log) return; const p = el('p', kind || '', esc(text)); p.dataset.t = Date.now(); log.appendChild(p);
    while (log.children.length > 40) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
  };
  UI.openChat = function (pre) {
    UI.chatOpen = true; const ci = $('.chatin'); $('.chat').classList.add('open'); ci.value = pre || ''; document.exitPointerLock && document.exitPointerLock();
    ci.focus(); $('.chatlog').scrollTop = 1e6;
  };
  UI.closeChat = function () { if (!UI.chatOpen) return; UI.chatOpen = false; $('.chat').classList.remove('open'); $('.chatin').blur(); };

  /* =====================================================================
     8. FENÊTRES D'INVENTAIRE
     ctx : { kind: 'inv' | 'table' | 'four' | 'coffre', furnace, chest }
     ===================================================================== */
  let hoverRef = null, bookOpen = LS.get('blocaria_book', true), bookCat = 'tout', bookMode = 'connues', bookQ = '', palQ = '';
  const COFFRE = () => (VX.B.COFFRE != null ? VX.B.COFFRE : 40);
  UI.openInv = function (ctx) {
    UI.open = ctx; for (const s of G.inv) if (s) G.known[s.id] = 1;
    document.exitPointerLock && document.exitPointerLock();
    if (ctx.kind === 'coffre') linkDoubleChest(ctx);
    build(); $('.inv').style.display = 'block'; sfx('uiclick');
  };
  UI.closeInv = function () {
    if (!UI.open) return; const ctx = UI.open; UI.open = null; $('.inv').style.display = 'none'; hideTip(); hoverRef = null;
    if (VX.Preview && VX.Preview.unmount) VX.Preview.unmount();
    const back = arr => arr.forEach((st, i) => { if (st) { G.give(st.id, st.n, st.d); arr[i] = null; } });
    back(G.craft2); back(G.craft3);
    if (G.cursor) { G.give(G.cursor.id, G.cursor.n, G.cursor.d); G.cursor = null; }
    if (ctx.kind === 'coffre') G.sfx('chest');
    renderCursor(); UI.hud();
  };
  function renderCursor() { cursorEl.innerHTML = slotHTML(G.cursor); cursorEl.style.display = G.cursor ? 'flex' : 'none'; }
  const gridW = () => UI.open && UI.open.kind === 'table' ? 3 : 2;
  const grid = w => w === 3 ? G.craft3 : G.craft2;
  function craftResult(w) { return VX.craft(grid(w).map(s => s ? s.id : 0), w); }

  /* ---------- double coffre : deux coffres côte à côte (x ou z) forment un grand coffre de 54 cases.
     Chaque moitié reste stockée dans G.chests sous sa propre position (sauvegarde et casse inchangées). ---------- */
  function linkDoubleChest(ctx) {
    ctx.halves = [ctx.chest]; ctx.hkeys = null;
    let key = null; for (const k in G.chests) if (G.chests[k] === ctx.chest) { key = k; break; }
    const m = key && /^(\w+):(-?\d+),(-?\d+),(-?\d+)$/.exec(key); if (!m || !G.world) return;
    const dim = m[1], x = +m[2], y = +m[3], z = +m[4];
    for (const [dx, dz] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
      if (G.world.getG(x + dx, y, z + dz) !== COFFRE()) continue;
      const nk = dim + ':' + (x + dx) + ',' + y + ',' + (z + dz);
      const other = G.chests[nk] = G.chests[nk] || Array(27).fill(null);
      const first = dx < 0 || dz < 0;   // ordre stable : la moitié de plus petite coordonnée en haut
      ctx.halves = first ? [other, ctx.chest] : [ctx.chest, other];
      ctx.hkeys = first ? [nk, key] : [key, nk];
      return;
    }
  }
  const chestCell = i => { const h = UI.open.halves || [UI.open.chest]; return [h[Math.floor(i / 27)], i % 27]; };

  /* ---------- livre de recettes ---------- */
  const accepts = (want, id) => Array.isArray(want) ? want.includes(id) : want === id;
  function needs(r) {
    if (r.items) { const m = new Map(); for (const want of r.items) { const k = JSON.stringify(want); const e = m.get(k) || { want, n: 0 }; e.n++; m.set(k, e); } return [...m.values()]; }
    const m = new Map();
    for (const row of r.rows) for (const ch of row) if (ch !== ' ') m.set(ch, (m.get(ch) || 0) + 1);
    return [...m].map(([ch, n]) => ({ want: r.keys[ch], n }));
  }
  const fits = (r, w) => r.items ? r.items.length <= w * w : r.rows.length <= w && Math.max(...r.rows.map(s => s.length)) <= w;
  function stock() { const c = {}; const add = s => { if (s && s.d == null) c[s.id] = (c[s.id] || 0) + s.n; }; G.inv.forEach(add); grid(gridW()).forEach(add); return c; }
  function canMake(r, c) {
    const left = Object.assign({}, c);
    for (const g of needs(r).sort((a, b) => (Array.isArray(a.want) ? a.want.length : 1) - (Array.isArray(b.want) ? b.want.length : 1))) {
      let need = g.n; const ids = Array.isArray(g.want) ? g.want : [g.want];
      for (const id of ids) { const m = Math.min(need, left[id] || 0); left[id] = (left[id] || 0) - m; need -= m; if (!need) break; }
      if (need) return false;
    }
    return true;
  }
  const knownR = r => needs(r).every(g => (Array.isArray(g.want) ? g.want : [g.want]).some(id => G.known[id])) || G.known[r.out];
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // une entrée par objet fabriqué (les variantes d'une même recette sont regroupées)
  function bookList(w) {
    const c = stock(), groups = new Map(), cre = G.mode === 'creatif', q = norm(bookQ.trim());
    VX.RECIPES.forEach((r, i) => {
      const nm = VX.nameOf(r.out); if (!r.n || !nm || nm === '?') return;
      if (bookCat !== 'tout' && category(r.out) !== bookCat) return;
      if (q && !norm(nm).includes(q)) return;
      const big = !fits(r, w), ok = !big && canMake(r, c);
      let gp = groups.get(r.out); if (!gp) groups.set(r.out, gp = { out: r.out, vars: [], ok: false, big: true, known: false });
      gp.vars.push({ r, i, ok, big }); gp.ok = gp.ok || ok; gp.big = gp.big && big; gp.known = gp.known || knownR(r);
    });
    const out = [...groups.values()].filter(g => bookMode === 'fabricables' ? g.ok : (cre || bookMode === 'toutes' || g.ok || g.known || q));
    out.sort((a, b) => (b.ok - a.ok) || (a.big - b.big));
    return out;
  }
  const bestVar = (gp) => gp.vars.find(v => v.ok) || gp.vars.find(v => !v.big) || gp.vars[0];
  // place les ingrédients d'une recette dans la grille (Maj : autant que possible)
  function placeRecipe(r, many) {
    const w = gridW(), g = grid(w);
    if (!fits(r, w)) { UI.toast('Il faut un établi pour cette recette.'); return; }
    g.forEach((st, i) => { if (st) { G.give(st.id, st.n, st.d); g[i] = null; } });
    const cells = [];
    if (r.items) r.items.forEach((want, k) => cells.push([k, want]));
    else r.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ' ') cells.push([y * w + x, r.keys[ch]]); }));
    let times = many ? 64 : 1, done = 0;
    while (times-- > 0) {
      const c = {}; G.inv.forEach(s => { if (s && s.d == null) c[s.id] = (c[s.id] || 0) + s.n; });
      if (!canMake(r, c)) break;
      if (cells.some(([k]) => g[k] && g[k].n >= VX.stackOf(g[k].id))) break;
      for (const [k, want] of cells) {
        const prefer = g[k] && g[k].id;
        let idx = G.inv.findIndex(s => s && s.d == null && s.id === prefer);
        if (idx < 0) idx = G.inv.findIndex(s => s && s.d == null && accepts(want, s.id));
        if (idx < 0) break;
        const s = G.inv[idx]; s.n--; if (s.n <= 0) G.inv[idx] = null;
        if (g[k]) g[k].n++; else g[k] = { id: s.id, n: 1 };
      }
      done++;
    }
    if (!done) UI.toast('Il te manque des ingrédients.'); else sfx('uipage');
    UI.refresh();
  }
  const CATS = [['tout', 'Tout'], ['outils', 'Outils'], ['blocs', 'Blocs'], ['survie', 'Survie'], ['equip', 'Équipement']];
  function catIcon(k) {
    const B = VX.B, I = VX.I;
    const id = { tout: VX.B.ETABLI, outils: VX.toolId(1, 'pioche'), blocs: B.BRIQUES, survie: I.POMME, equip: (VX.SURV && VX.SURV.PLASTRON_FER) || VX.toolId(2, 'epee') }[k];
    return VX.icon(id).url;
  }
  function bookEl() {
    const box = el('div', 'book');
    box.innerHTML = `<div class="book-h"><span>Livre de recettes</span></div>
      <div class="book-tabs">${CATS.map(([k, n]) => `<button class="tab${k === bookCat ? ' on' : ''}" data-cat="${k}" data-tipt="${n}"><img src="${catIcon(k)}"></button>`).join('')}</div>
      <div class="book-search"><input type="text" placeholder="Rechercher…" spellcheck="false" autocomplete="off" value="${esc(bookQ)}"><button class="mode" data-mode="1"></button></div>
      <div class="bgrid"></div><p class="hint">Clic : placer les ingrédients · Maj + clic : le maximum</p>`;
    box.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { bookCat = t.dataset.cat; box.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t)); sfx('uipage'); renderBook(true); }));
    const inp = box.querySelector('input');
    inp.addEventListener('input', () => { bookQ = inp.value; renderBook(true); });
    searchKeys(inp);
    const mb = box.querySelector('.mode');
    mb.addEventListener('click', () => { bookMode = { connues: 'fabricables', fabricables: 'toutes', toutes: 'connues' }[bookMode]; sfx('uiclick'); renderBook(true); });
    return box;
  }
  // les champs de recherche ne doivent pas déclencher les touches du jeu (E ferme l'inventaire, chiffres…)
  function searchKeys(inp) {
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); inp.blur(); UI.closeInv(); G.relock && G.relock(); } else if (e.key === 'Enter') inp.blur(); });
    inp.addEventListener('keyup', e => e.stopPropagation());
    inp.addEventListener('mousedown', e => e.stopPropagation());
  }
  let bookSig = '', bookGroups = [];
  function renderBook(force) {
    const p = $('.inv'), gr = p && p.querySelector('.bgrid'); if (!gr) return;
    const w = gridW(), list = bookList(w), s = list.map(g => g.out + (g.ok ? '+' : g.big ? '#' : '-')).join(',') + '|' + bookMode;
    const mb = p.querySelector('.book .mode'); if (mb) { mb.textContent = { connues: 'Connues', fabricables: 'Fabricables', toutes: 'Toutes' }[bookMode]; mb.className = 'mode m-' + bookMode; }
    if (!force && s === bookSig) return; bookSig = s; bookGroups = list;
    gr.innerHTML = '';
    list.forEach((gp, j) => {
      const v = bestVar(gp), sl = el('div', 'slot rec' + (gp.ok ? '' : ' no') + (gp.big ? ' big' : ''), slotHTML({ id: gp.out, n: v.r.n }) + (gp.vars.length > 1 ? '<em>' + gp.vars.length + '</em>' : ''));
      sl.dataset.ref = 'r:' + j; gr.appendChild(sl);
    });
    if (!list.length) gr.appendChild(el('p', 'hint', bookQ ? 'Aucune recette ne correspond.' : bookMode === 'fabricables' ? 'Rien à fabriquer avec ce que tu as.' : 'Ramasse des matériaux pour découvrir des recettes.'));
  }
  // infobulle d'une recette : ingrédients avec ce qu'on possède
  function recipeTip(gp) {
    const v = bestVar(gp), c = stock();
    const ing = needs(v.r).map(g => {
      const ids = Array.isArray(g.want) ? g.want : [g.want], have = ids.reduce((s, id) => s + (c[id] || 0), 0);
      return `<span class="ing${have >= g.n ? '' : ' miss'}"><img src="${VX.icon(ids.find(id => c[id]) || ids[0]).url}">${g.n}× ${esc(VX.nameOf(ids.find(id => c[id]) || ids[0]))}${ids.length > 1 ? ' <small>(ou autre)</small>' : ''}</span>`;
    }).join('');
    const state = v.big ? '<div class="tt-w">Il faut un établi (grille 3×3).</div>' : gp.ok ? '<div class="tt-ok">Clic : placer dans la grille</div>' : '<div class="tt-w">Il manque des ingrédients.</div>';
    return describe({ id: gp.out, n: v.r.n }, `<div class="tt-r">${ing}</div>${gp.vars.length > 1 ? `<div class="tt-k">${gp.vars.length} variantes</div>` : ''}${state}`);
  }

  /* ---------- construction d'une fenêtre (une fois par ouverture) ---------- */
  function slotEl(ref, hint, cls) { const s = el('div', 'slot' + (cls ? ' ' + cls : '')); s.dataset.ref = ref; if (hint) s.dataset.hint = hint; return s; }
  function build() {
    const ctx = UI.open, p = $('.inv'); if (!ctx) return; p.innerHTML = ''; bookSig = '';
    const cre = G.mode === 'creatif', wrap = el('div', 'inv-wrap'), main = el('div', 'inv-main');
    const withBook = (ctx.kind === 'inv' || ctx.kind === 'table');
    p.className = 'panel inv k-' + ctx.kind;
    const top = el('div', 'inv-top');
    if (ctx.kind === 'four') {
      top.appendChild(el('h3', '', 'Four'));
      const box = el('div', 'furn');
      const col = el('div', 'fcol'); col.append(slotEl('f:in', 'à cuire'), el('div', 'flame', '<i></i>'), slotEl('f:fuel', 'combustible'));
      const arrow = el('div', 'farrow', '<i></i>');
      const outc = el('div', 'fout'); outc.appendChild(slotEl('f:out', null, 'out'));
      box.append(col, arrow, outc); top.appendChild(box);
    } else if (ctx.kind === 'coffre') {
      const dbl = ctx.halves && ctx.halves.length === 2;
      top.appendChild(el('h3', '', dbl ? 'Grand coffre' : 'Coffre'));
      const g = el('div', 'igrid chest' + (dbl ? ' dbl' : '')); for (let i = 0; i < (dbl ? 54 : 27); i++) g.appendChild(slotEl('k:' + i)); top.appendChild(g);
    } else {
      const w = ctx.kind === 'table' ? 3 : 2;
      const row = el('div', 'craftrow');
      if (ctx.kind === 'inv') {
        // personnage : 4 cases d'armure à gauche, aperçu 3D au centre, main secondaire en bas à droite
        const pers = el('div', 'persona');
        const ac = el('div', 'armorcol');
        for (let i = 0; i < 4; i++) {
          const s = slotEl('a:' + i, ARMOR_HINT[i], 'arm a' + i), sil = VX.SURV && VX.SURV.CASQUE_FER != null ? VX.SURV.CASQUE_FER + i : 0;   // silhouette de la pièce attendue
          if (sil && VX.ITEMS[sil]) s.style.setProperty('--sil', `url(${VX.icon(sil).url})`);
          ac.appendChild(s);
        }
        const pv = el('div', 'pv'); const off = slotEl('o:0', 'main secondaire', 'offh');
        pers.append(ac, pv, off); row.appendChild(pers);
        if (VX.Preview && VX.Preview.mount) VX.Preview.mount(pv); else pv.classList.add('static');
      }
      const box = el('div', 'craft');
      const head = el('h3', '', w === 3 ? 'Établi' : 'Fabrication');
      const bb = el('button', 'bookbtn' + (bookOpen ? ' on' : ''), '<span></span>'); bb.dataset.tipt = 'Livre de recettes';
      bb.addEventListener('click', () => { bookOpen = !bookOpen; LS.set('blocaria_book', bookOpen); sfx('uipage'); build(); });
      const g = el('div', 'cgrid g' + w); for (let i = 0; i < w * w; i++) g.appendChild(slotEl('c:' + i));
      const cr = el('div', 'craftbox'); cr.append(bb, g, el('div', 'carrow', '<i></i>'), slotEl('c:out', null, 'out'));
      box.append(head, cr); row.appendChild(box); top.appendChild(row);
    }
    main.appendChild(top);
    if (cre) {
      const pal = el('div', 'palette');
      pal.innerHTML = `<div class="pal-h"><h3>Créatif</h3><input type="text" placeholder="Rechercher…" spellcheck="false" autocomplete="off" value="${esc(palQ)}"></div>`;
      const pg = el('div', 'pgrid'); pal.appendChild(pg); main.appendChild(pal);
      const inp = pal.querySelector('input'); searchKeys(inp);
      const fill = () => { pg.innerHTML = ''; const q = norm(palQ.trim()); VX.CREATIVE.forEach(id => { if (q && !norm(VX.nameOf(id)).includes(q)) return; const s = slotEl('p:' + id); s.innerHTML = slotHTML({ id, n: 1 }); pg.appendChild(s); }); };
      inp.addEventListener('input', () => { palQ = inp.value; fill(); }); fill();
    }
    main.appendChild(el('h3', '', 'Inventaire'));
    const inv = el('div', 'igrid'); for (let i = 9; i < 36; i++) inv.appendChild(slotEl('i:' + i)); main.appendChild(inv);
    const hot = el('div', 'igrid hotrow'); for (let i = 0; i < 9; i++) hot.appendChild(slotEl('i:' + i)); main.appendChild(hot);
    main.appendChild(el('p', 'hint', 'Clic : prendre / poser · clic droit : moitié / un seul · Maj + clic : ranger vite · 1-9 sur une case : barre rapide · E : fermer'));
    if (withBook && bookOpen) wrap.appendChild(bookEl());
    wrap.appendChild(main);
    p.appendChild(wrap);
    // évènements délégués : un seul écouteur pour toutes les cases
    p.onmousedown = e => {
      const s = e.target.closest('.slot[data-ref]'); if (!s || !p.contains(s)) return;
      e.preventDefault(); clickSlot(s.dataset.ref, e.button, e.shiftKey);
    };
    p.onmouseover = e => {
      const s = e.target.closest('.slot[data-ref]'), b = e.target.closest('[data-tipt]');
      if (b && !s) { showTip(`<div class="tt-n">${esc(b.dataset.tipt)}</div>`); return; }
      if (!s) { hoverRef = null; hideTip(); return; }
      if (hoverRef === s.dataset.ref && tipOn) return;
      hoverRef = s.dataset.ref; tipFor(s);
    };
    p.onmouseleave = () => { hoverRef = null; hideTip(); };
    update(true);
  }
  function tipFor(s) {
    const ref = s.dataset.ref;
    if (ref.startsWith('r:')) { const gp = bookGroups[+ref.slice(2)]; if (gp) showTip(recipeTip(gp)); return; }
    const st = getRef(ref);
    if (st) {
      let extra = '';
      if (ref === 'f:fuel' && UI.open.furnace.burn > 0) extra = `<div class="tt-k">Feu : encore ${Math.ceil(UI.open.furnace.burn)} s</div>`;
      showTip(describe(st, extra));
    } else if (s.dataset.hint) showTip(`<div class="tt-k">Emplacement : ${esc(s.dataset.hint)}</div>`);
    else hideTip();
  }
  /* ---------- mise à jour sur place ---------- */
  function update(force) {
    const ctx = UI.open, p = $('.inv'); if (!ctx || !p) return;
    p.querySelectorAll('.slot[data-ref]').forEach(s => {
      const ref = s.dataset.ref; if (ref[0] === 'r' || ref[0] === 'p') return;
      const st = getRef(ref), k = sig(st);
      if (force || s._sig !== k) { s._sig = k; s.innerHTML = slotHTML(st); s.classList.toggle('empty', !st && !!s.dataset.hint); }
    });
    if (ctx.kind === 'inv' || ctx.kind === 'table') { p.querySelector('.craftbox').classList.toggle('ready', !!craftResult(gridW())); renderBook(force); }
    if (ctx.kind === 'four') furnaceAnim();
    if (hoverRef) { const s = p.querySelector(`.slot[data-ref="${hoverRef}"]`); if (s) tipFor(s); }
    renderCursor();
  }
  UI.refresh = () => { if (UI.open) update(); UI.hud(); };
  // four : flamme qui se consume, flèche de cuisson qui avance (lues à chaque image)
  function furnaceAnim() {
    const f = UI.open && UI.open.furnace, p = $('.inv'); if (!f || !p) return;
    const fl = p.querySelector('.flame'), ar = p.querySelector('.farrow'); if (!fl || !ar) return;
    const b = f.burnMax ? Math.max(0, Math.min(1, f.burn / f.burnMax)) : 0;
    fl.firstChild.style.height = (b * 100).toFixed(1) + '%'; fl.classList.toggle('lit', f.burn > 0);
    ar.firstChild.style.width = (Math.max(0, Math.min(1, f.prog / VX.SMELT_T)) * 100).toFixed(1) + '%'; ar.classList.toggle('go', f.prog > 0 && f.burn > 0);
  }
  function frameTick() {
    if (!G) return;
    xpTick();
    const o = UI.open; if (!o) return;
    if (o.kind === 'four') furnaceAnim();
    // grand coffre : si l'une des moitiés a été cassée, on ferme la fenêtre
    if (o.kind === 'coffre' && o.hkeys && (G.chests[o.hkeys[0]] !== o.halves[0] || G.chests[o.hkeys[1]] !== o.halves[1])) UI.closeInv();
  }

  /* ---------- lecture / écriture d'une case par sa référence ---------- */
  function getRef(ref) {
    const [k, v] = ref.split(':');
    if (k === 'i') return G.inv[+v];
    if (k === 'c') { if (v === 'out') { const r = craftResult(gridW()); return r ? { id: r.id, n: r.n } : null; } return grid(gridW())[+v]; }
    if (k === 'f') return UI.open.furnace[v]; if (k === 'p') return { id: +v, n: 1 };
    if (k === 'k') { const [h, j] = chestCell(+v); return h ? h[j] : null; }
    if (k === 'a') return G.armor[+v]; if (k === 'o') return G.offhand || null;
    return null;
  }
  function setRef(ref, st) {
    const [k, v] = ref.split(':'); if (st && st.n <= 0) st = null;
    if (k === 'i') G.inv[+v] = st; else if (k === 'c') grid(gridW())[+v] = st; else if (k === 'f') UI.open.furnace[v] = st;
    else if (k === 'k') { const [h, j] = chestCell(+v); if (h) h[j] = st; } else if (k === 'a') G.armor[+v] = st; else if (k === 'o') G.offhand = st;
  }
  function stowInto(arr, st) {
    st = Object.assign({}, st); const max = VX.stackOf(st.id);
    if (st.d == null) for (let i = 0; i < arr.length && st.n > 0; i++) { const s = arr[i]; if (s && s.id === st.id && s.d == null && s.n < max) { const m = Math.min(st.n, max - s.n); s.n += m; st.n -= m; } }
    for (let i = 0; i < arr.length && st.n > 0; i++) if (!arr[i]) { arr[i] = Object.assign({}, st); st.n = 0; }
    return st.n > 0 ? st : null;
  }
  const same = (a, b) => a && b && a.id === b.id && a.d == null && b.d == null;
  const armorSlotOk = (slot, st) => !st || (VX.ARMOR && VX.ARMOR[st.id] && VX.ARMOR[st.id].slot === slot);
  const isShield = st => { const it = st && VX.ITEMS[st.id]; return !!(it && (it.shield || /bouclier/i.test(it.name))); };
  function clickSlot(ref, btn, shift) {
    const [k, v] = ref.split(':'), max = st => VX.stackOf(st.id);
    sfx('uiclick');
    if (k === 'r') { const gp = bookGroups[+v]; if (gp) placeRecipe(bestVar(gp).r, shift); return; }
    if (k === 'p') {   // palette créative
      if (G.cursor) G.cursor = null; else { const id = +v; G.cursor = { id, n: VX.stackOf(id), d: VX.duraOf(id) || undefined }; if (shift) { G.give(id, VX.stackOf(id)); G.cursor = null; } }
      UI.refresh(); return;
    }
    if (k === 'c' && v === 'out') {   // résultat de fabrication
      const w = gridW(); let times = shift ? 64 : 1, made = 0;
      while (times-- > 0) {
        const r = craftResult(w); if (!r) break;
        const st = { id: r.id, n: r.n, d: VX.duraOf(r.id) || undefined };
        if (shift) { if (!G.canGive(r.id, r.n)) break; G.give(st.id, st.n, st.d); }
        else { if (G.cursor && !(same(G.cursor, st) && G.cursor.n + st.n <= max(st))) break; if (G.cursor) G.cursor.n += st.n; else G.cursor = st; }
        grid(w).forEach((s, i) => { if (s) { s.n--; if (s.n <= 0) grid(w)[i] = null; } });
        G.known[r.id] = 1; made++; VX.hooks.emit('craft', { id: r.id, n: r.n });
      }
      if (made) G.sfx('craft');
      UI.refresh(); return;
    }
    if (k === 'f' && v === 'out') {
      const st = UI.open.furnace.out; if (!st) return;
      if (shift) { if (G.canGive(st.id, st.n)) { G.give(st.id, st.n); UI.open.furnace.out = null; } }
      else if (!G.cursor) { G.cursor = st; UI.open.furnace.out = null; } else if (same(G.cursor, st) && G.cursor.n + st.n <= max(st)) { G.cursor.n += st.n; UI.open.furnace.out = null; }
      G.known[st.id] = 1; UI.refresh(); return;
    }
    const st = getRef(ref);
    if (shift && st) {   // rangement rapide
      if (k === 'i') {
        const i = +v, ar = VX.ARMOR && VX.ARMOR[st.id], kind = UI.open.kind;
        if (kind === 'coffre') { let left = st; for (const h of UI.open.halves || [UI.open.chest]) { if (!left) break; left = stowInto(h, left); } G.inv[i] = left; }
        else if (kind === 'four' && (VX.SMELT[st.id] || VX.fuelOf(st.id))) { const f = UI.open.furnace, slot = VX.SMELT[st.id] && !(f.in && !same(f.in, st) && VX.fuelOf(st.id)) ? 'in' : 'fuel'; if (!f[slot]) { f[slot] = st; G.inv[i] = null; } else if (same(f[slot], st)) { const m = Math.min(st.n, max(st) - f[slot].n); f[slot].n += m; st.n -= m; if (st.n <= 0) G.inv[i] = null; } }
        else if (kind === 'inv' && ar && !G.armor[ar.slot]) { G.armor[ar.slot] = st; G.inv[i] = null; G.sfx('equip'); }
        else if (kind === 'inv' && isShield(st) && !G.offhand) { G.offhand = st; G.inv[i] = null; G.sfx('equip'); }
        else { const range = i < 9 ? [9, 36] : [0, 9]; G.inv[i] = null; const left = G.giveRange(st, range[0], range[1]); if (left) G.inv[i] = left; }
      } else { setRef(ref, null); const left = G.giveRange(st, 0, 36); if (left) setRef(ref, left); }
      UI.refresh(); return;
    }
    const cur = G.cursor;
    if (k === 'a') {   // emplacement d'armure : seulement la bonne pièce, une à la fois
      const slot = +v; if (!armorSlotOk(slot, cur)) { UI.toast('Cette case attend : ' + ARMOR_HINT[slot] + '.'); return; }
      if (cur && cur.n > 1) return;
      G.armor[slot] = cur; G.cursor = st; if (cur) G.sfx('equip'); UI.refresh(); return;
    }
    if (btn === 2) {
      if (!cur && st) { const half = Math.ceil(st.n / 2); G.cursor = { id: st.id, n: half, d: st.d }; st.n -= half; setRef(ref, st.n > 0 ? st : null); }
      else if (cur && (!st || (same(st, cur) && st.n < max(st)))) { if (st) st.n++; else setRef(ref, { id: cur.id, n: 1, d: cur.d }); cur.n--; if (cur.n <= 0) G.cursor = null; }
    } else {
      if (!cur) { if (st) { G.cursor = st; setRef(ref, null); } }
      else if (!st) { setRef(ref, cur); G.cursor = null; }
      else if (same(st, cur)) { const m = Math.min(cur.n, max(st) - st.n); st.n += m; cur.n -= m; if (cur.n <= 0) G.cursor = null; }
      else { setRef(ref, cur); G.cursor = st; }
    }
    if (k === 'o' && G.offhand && G.offhand !== st) G.sfx('equip');
    UI.refresh();
  }

  /* =====================================================================
     9. MENUS : écran de mort, et menu de secours (title.js remplace « aide » et « pause » par l'écran titre)
     ===================================================================== */
  UI.menu = function (kind) {
    const m = $('.menu'); UI.menuOpen = kind; document.exitPointerLock && document.exitPointerLock();
    if (!kind) { m.style.display = 'none'; return; }
    UI.closeChat(); hideTip();
    m.style.display = 'block'; m.className = 'panel menu m-' + kind;
    if (kind === 'mort') { m.innerHTML = `<h2 class="dead">Tu es mort !</h2><p>Tu gardes ton inventaire. Attention aux chutes, à la lave, à la noyade, à la faim et aux créatures de la nuit.</p><div class="row"><button class="btn" data-a="respawn">Réapparaître</button></div>`; }
    else {
      const help = `<div class="keys"><b>ZQSD</b> se déplacer · <b>Espace</b> sauter / nager (2× en créatif : voler) · <b>Maj</b> s'accroupir · <b>Ctrl</b> ou <b>Z</b>×2 courir<br><b>Clic gauche</b> casser / frapper · <b>Clic droit</b> poser / utiliser · <b>E</b> inventaire · <b>1-9</b> ou molette : barre rapide · <b>A</b> jeter · <b>T</b> chat · <b>F3</b> débogage</div>`;
      const A = VX.Audio, vol = (k, label) => A ? `<label class="dist">${label} <input type="range" data-vol="${k}" min="0" max="1" step="0.05" value="${A.vol[k]}"></label>` : '';
      m.innerHTML = kind === 'aide'
        ? `<h2>BLOCARIA</h2><p class="sub">Bac à sable de blocs · Surface et Braises</p>${help}<div class="row"><button class="btn" data-a="play">Jouer</button></div>`
        : `<h2>Pause</h2>${help}<div class="row"><button class="btn" data-a="play">Reprendre</button><button class="btn" data-a="mode">Mode : ${G.mode === 'creatif' ? 'Créatif' : 'Survie'}</button><button class="btn" data-a="shaders">Shaders (F7)</button><button class="btn" data-a="gfx">Rendu : ${VX.fastMesh ? 'Rapide' : 'Beau'}</button></div>
          <div class="row">${VX.MP && VX.MP.on ? `<span class="mp">Salon <b>${VX.MP.room.code}</b> · ${VX.MP.room.players.length} joueur(s)</span><button class="btn" data-a="mpleave">Quitter le salon</button>` : '<button class="btn" data-a="mphost">Ouvrir mon monde</button><button class="btn" data-a="mpjoin">Rejoindre un pote</button>'}</div>
          <div class="row"><button class="btn" data-a="save">Sauvegarder</button><button class="btn" data-a="export">Exporter</button><button class="btn" data-a="import">Importer</button></div>
          <div class="row"><label class="dist">Distance de vue <input type="range" class="vd" min="2" max="7" step="1" value="${G.R}"></label></div>
          <div class="row">${vol('music', 'Musique')}${vol('sfx', 'Effets')}</div>
          <div class="row"><button class="btn warn" data-a="new">Nouveau monde</button><button class="btn" data-a="quit">Retour au site</button></div><p class="small">Graine : ${G.seed} · ${G.dimName()}</p>`;
    }
    m.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', () => { sfx('uiclick'); G.menuAction(b.dataset.a); }));
    const d = m.querySelector('.vd'); if (d) d.addEventListener('input', () => { G.R = +d.value; G.saveSettings(); });
    m.querySelectorAll('[data-vol]').forEach(r => r.addEventListener('input', () => VX.Audio && VX.Audio.setVol(r.dataset.vol, +r.value)));
  };
  // outils partagés avec title.js / debug.js / preview.js
  UI._lib = { el, esc, slotHTML, describe, rarity, category, sfx, LS, ICONS };
})();

/* ===== ui.js : HUD (réticule, barre rapide, vie, faim, armure, oxygène), inventaire, établi, four, coffre, armure,
   livre de recettes, mode créatif, chat, menus ===== */
(function () {
  const VX = window.VX;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const UI = VX.UI = {};
  let G, cursorEl, tipEl;

  // icônes du HUD (cœur, pomme, plastron, bulle), dessinées une fois
  function pix(rows, pal) { const c = document.createElement('canvas'); c.width = c.height = 9; const g = c.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } })); return c.toDataURL(); }
  const HEART = ['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'];
  const SHIELD = ['kkk...kkk', 'kwwkkkwwk', 'kwwwwwwwk', '.kwwwwwk.', '.kwwwwwk.', '.kwwwwwk.', '.kwwwwwk.', '.kkkkkkk.', '.........'];
  const BUBBLE = ['...kkk...', '..kbbbk..', '.kbwbbbk.', '.kbwbbbk.', '.kbbbbbk.', '.kbbbbbk.', '..kbbbk..', '...kkk...', '.........'];
  const ICONS = {
    heart: pix(HEART, { k: '#1a0a0a', r: '#e8202a', w: '#ffb0b0' }), heartE: pix(HEART, { k: '#1a0a0a', r: '#3a2a2a', w: '#3a2a2a' }),
    heartW: pix(HEART, { k: '#1a0a0a', r: '#ffffff', w: '#ffffff' }),
    food: pix(['....g....', '...gl....', '..rrrrr..', '.rwrrrrr.', '.rrrrrrr.', '.rrrrrrr.', '.rrrrrrd.', '..rrrrd..', '...rdd...'], { g: '#5a3a20', l: '#47d16c', r: '#e0302a', w: '#ffd0c8', d: '#9a1a14' }),
    foodE: pix(['....g....', '...gl....', '..rrrrr..', '.rrrrrrr.', '.rrrrrrr.', '.rrrrrrr.', '.rrrrrrr.', '..rrrrr..', '...rrr...'], { g: '#3a3a3a', l: '#3a3a3a', r: '#3a2a2a' }),
    shield: pix(SHIELD, { k: '#1a1a1a', w: '#d8d8e0' }), shieldE: pix(SHIELD, { k: '#1a1a1a', w: '#3a3a40' }),
    bubble: pix(BUBBLE, { k: '#0a2a5a', b: '#4aa8ff', w: '#e8f6ff' }),
  };
  const ARMOR_HINT = ['casque', 'plastron', 'jambières', 'bottes'];

  UI.init = function (game) {
    G = game;
    const hud = el('div', 'hud');
    hud.innerHTML = `<div class="cross"></div><div class="mine"><i></i></div>
      <div class="bars"><div class="left"><div class="armor"></div><div class="hearts"></div></div><div class="right"><div class="bubbles"></div><div class="foods"></div></div></div>
      <div class="hotbar"></div><div class="held"></div><div class="info"></div><div class="toast"></div><div class="water"></div><div class="hurt"></div><div class="portalfx"></div>
      <div class="chat"><div class="chatlog"></div><input class="chatin" maxlength="160" spellcheck="false" autocomplete="off"></div>`;
    document.body.appendChild(hud);
    for (let i = 0; i < 9; i++) $('.hotbar').appendChild(el('div', 'slot'));
    const scr = el('div', 'screens'); scr.innerHTML = `<div class="panel inv" style="display:none"></div><div class="panel menu" style="display:none"></div>`; document.body.appendChild(scr);
    cursorEl = el('div', 'cursor slot'); document.body.appendChild(cursorEl);
    tipEl = el('div', 'tip'); document.body.appendChild(tipEl);
    document.addEventListener('mousemove', e => { cursorEl.style.left = e.clientX - 20 + 'px'; cursorEl.style.top = e.clientY - 20 + 'px'; tipEl.style.left = e.clientX + 14 + 'px'; tipEl.style.top = e.clientY + 10 + 'px'; });
    document.addEventListener('contextmenu', e => { if (UI.open) e.preventDefault(); });
    // chat : Entrée envoie, Échap ferme
    const ci = $('.chatin');
    ci.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); const t = ci.value; UI.closeChat(); G.command(t); G.relock(); }
      else if (e.key === 'Escape') { e.preventDefault(); UI.closeChat(); G.relock(); }
    });
    ci.addEventListener('blur', () => { if (UI.chatOpen) setTimeout(() => { if (UI.chatOpen && document.activeElement !== ci) ci.focus(); }, 0); });
    // lignes du chat qui s'effacent
    setInterval(() => { const now = Date.now(); document.querySelectorAll('.chatlog p').forEach(p => p.classList.toggle('old', now - +p.dataset.t > 9000)); }, 1000);
  };
  const slotHTML = st => st ? `<img src="${VX.icon(st.id).url}" draggable="false">${st.n > 1 ? `<b>${st.n}</b>` : ''}${st.d != null && VX.duraOf(st.id) ? `<u style="width:${Math.max(0, st.d / VX.duraOf(st.id)) * 100}%;background:hsl(${Math.max(0, st.d / VX.duraOf(st.id)) * 120},90%,50%)"></u>` : ''}` : '';
  let flashT = 0;
  // une icône de barre : pleine, à moitié (moitié pleine posée sur une vide) ou vide
  const ico = (v, i, full, empty) => v >= i * 2 + 2 ? `<img src="${full}">` : v === i * 2 + 1 ? `<span class="hh"><img src="${empty}"><img src="${full}" class="half"></span>` : `<img src="${empty}">`;
  UI.hud = function () {
    const hb = document.querySelectorAll('.hotbar .slot');
    hb.forEach((s, i) => { s.innerHTML = slotHTML(G.inv[i]); s.classList.toggle('sel', i === G.sel); });
    const P = G.player, cre = G.mode === 'creatif', fl = performance.now() < flashT;
    $('.bars').style.visibility = cre ? 'hidden' : 'visible';
    let h = ''; for (let i = 0; i < 10; i++) h += ico(P.hp, i, ICONS.heart, fl ? ICONS.heartW : ICONS.heartE);
    let f = ''; for (let i = 9; i >= 0; i--) f += ico(P.food, i, ICONS.food, ICONS.foodE);
    $('.hearts').innerHTML = h; $('.foods').innerHTML = f;
    const pts = G.armorPts ? G.armorPts() : 0; let a = '';
    if (pts > 0) for (let i = 0; i < 10; i++) a += ico(pts, i, ICONS.shield, ICONS.shieldE);
    $('.armor').innerHTML = a;
    const it = G.inv[G.sel]; $('.held').textContent = it ? VX.nameOf(it.id) : '';
  };
  // les cœurs clignotent en rouge/blanc quand on prend des dégâts
  UI.flashHearts = () => { const e = $('.hearts'); if (!e) return; flashT = performance.now() + 450; e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); setTimeout(() => UI.hud(), 470); };
  // barre d'oxygène (n bulles, -1 = cachée)
  UI.bubbles = n => { const e = $('.bubbles'); if (!e) return; let s = ''; if (n >= 0 && G.mode !== 'creatif') for (let i = 9; i >= 0; i--) s += `<img src="${ICONS.bubble}" class="${i < n ? '' : 'gone'}">`; e.innerHTML = s; };
  UI.info = t => { $('.info').textContent = t; };
  let toastT = null;
  UI.toast = t => { const e = $('.toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); };
  UI.mining = f => { const e = $('.mine'); e.style.display = f > 0 ? 'block' : 'none'; e.firstChild.style.width = Math.round(f * 100) + '%'; };
  UI.fx = (water, hurt, portal) => { $('.water').style.opacity = water ? 1 : 0; $('.water').style.background = water === 2 ? 'rgba(255,90,0,.55)' : 'rgba(30,80,200,.35)'; $('.hurt').style.opacity = hurt; $('.portalfx').style.opacity = portal; };

  /* ---------- chat ---------- */
  UI.say = function (text, kind) {
    const log = $('.chatlog'); if (!log) return; const p = el('p', kind || '', esc(text)); p.dataset.t = Date.now(); log.appendChild(p);
    while (log.children.length > 40) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
  };
  UI.openChat = function (pre) {
    UI.chatOpen = true; const ci = $('.chatin'); $('.chat').classList.add('open'); ci.value = pre || ''; document.exitPointerLock && document.exitPointerLock();
    ci.focus(); $('.chatlog').scrollTop = 1e6;
  };
  UI.closeChat = function () { if (!UI.chatOpen) return; UI.chatOpen = false; $('.chat').classList.remove('open'); $('.chatin').blur(); };

  /* ---------- fenêtres d'inventaire ---------- */
  // ctx : { kind: 'inv' | 'table' | 'four' | 'coffre', furnace, chest }
  UI.openInv = function (ctx) { UI.open = ctx; for (const s of G.inv) if (s) G.known[s.id] = 1; document.exitPointerLock && document.exitPointerLock(); renderInv(); $('.inv').style.display = 'block'; };
  UI.closeInv = function () {
    if (!UI.open) return; const ctx = UI.open; UI.open = null; $('.inv').style.display = 'none'; tipEl.style.display = 'none';
    const back = arr => arr.forEach((st, i) => { if (st) { G.give(st.id, st.n, st.d); arr[i] = null; } });
    back(G.craft2); back(G.craft3);
    if (G.cursor) { G.give(G.cursor.id, G.cursor.n, G.cursor.d); G.cursor = null; }
    if (ctx.kind === 'coffre') G.sfx('chest');
    renderCursor(); UI.hud();
  };
  function renderCursor() { cursorEl.innerHTML = slotHTML(G.cursor); cursorEl.style.display = G.cursor ? 'block' : 'none'; }
  const gridW = () => UI.open && UI.open.kind === 'table' ? 3 : 2;
  function grid(w) { return w === 3 ? G.craft3 : G.craft2; }
  function craftResult(w) { return VX.craft(grid(w).map(s => s ? s.id : 0), w); }
  function slotEl(st, ref, hint) { const s = el('div', 'slot', slotHTML(st)); s.dataset.ref = ref; if (!st && hint) { s.classList.add('empty'); s.dataset.hint = hint; } return s; }

  /* ---------- livre de recettes ---------- */
  let bookAll = false;
  const accepts = (want, id) => Array.isArray(want) ? want.includes(id) : want === id;
  // besoins d'une recette : liste de groupes { want, n }
  function needs(r) {
    if (r.items) return r.items.map(want => ({ want, n: 1 }));
    const m = new Map();
    for (const row of r.rows) for (const ch of row) if (ch !== ' ') m.set(ch, (m.get(ch) || 0) + 1);
    return [...m].map(([ch, n]) => ({ want: r.keys[ch], n }));
  }
  const fits = (r, w) => r.items ? r.items.length <= w * w : r.rows.length <= w && Math.max(...r.rows.map(s => s.length)) <= w;
  function stock() { const c = {}; const add = s => { if (s) c[s.id] = (c[s.id] || 0) + s.n; }; G.inv.forEach(add); grid(gridW()).forEach(add); return c; }
  // combien de fois peut-on fabriquer la recette avec ce stock ?
  function canMake(r, c) {
    const left = Object.assign({}, c); let ok = true;
    for (const g of needs(r).sort((a, b) => (Array.isArray(a.want) ? a.want.length : 1) - (Array.isArray(b.want) ? b.want.length : 1))) {
      let need = g.n; const ids = Array.isArray(g.want) ? g.want : [g.want];
      for (const id of ids) { const m = Math.min(need, left[id] || 0); left[id] = (left[id] || 0) - m; need -= m; if (!need) break; }
      if (need) { ok = false; break; }
    }
    return ok;
  }
  const knownR = r => needs(r).every(g => (Array.isArray(g.want) ? g.want : [g.want]).some(id => G.known[id]));
  function bookList(w) {
    const c = stock(), out = [];
    VX.RECIPES.forEach((r, i) => { if (!r.n || !VX.nameOf(r.out) || VX.nameOf(r.out) === '?') return; const big = !fits(r, w), ok = !big && canMake(r, c); if (ok || bookAll || G.mode === 'creatif' || knownR(r)) out.push({ r, i, ok, big }); });
    out.sort((a, b) => (b.ok - a.ok) || (a.big - b.big)); return out;
  }
  // place les ingrédients d'une recette dans la grille (shift : autant que possible)
  function placeRecipe(r, many) {
    const w = gridW(), g = grid(w);
    if (!fits(r, w)) { UI.toast('Il faut un établi pour cette recette.'); return; }
    g.forEach((st, i) => { if (st) { G.give(st.id, st.n, st.d); g[i] = null; } });
    // cases à remplir : [index de case, ingrédient voulu]
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
    if (!done) UI.toast('Il te manque des ingrédients.');
    renderInv(); UI.hud();
  }
  function bookEl(w) {
    const box = el('div', 'book'); box.appendChild(el('h3', '', `Recettes <small>${G.mode === 'creatif' ? '' : `<label><input type="checkbox" ${bookAll ? 'checked' : ''}> toutes</label>`}</small>`));
    const gr = el('div', 'bgrid'), list = bookList(w);
    for (const { r, i, ok, big } of list) {
      const s = el('div', 'slot rec' + (ok ? '' : ' no') + (big ? ' big' : ''), slotHTML({ id: r.out, n: r.n })); s.dataset.ref = 'r:' + i; s.dataset.tip = VX.nameOf(r.out) + (big ? ' (établi)' : ok ? '' : ' (il manque des ingrédients)'); gr.appendChild(s);
    }
    if (!list.length) gr.appendChild(el('p', 'hint', 'Ramasse des matériaux pour découvrir des recettes.'));
    box.appendChild(gr); box.appendChild(el('p', 'hint', 'Clic : placer les ingrédients · Maj + clic : le maximum'));
    const cb = box.querySelector('input'); if (cb) cb.addEventListener('change', () => { bookAll = cb.checked; renderInv(); });
    return box;
  }

  function renderInv() {
    const ctx = UI.open, p = $('.inv'); if (!ctx) return; p.innerHTML = '';
    const cre = G.mode === 'creatif', wrap = el('div', 'inv-wrap'), main = el('div', 'inv-main');
    const top = el('div', 'inv-top');
    if (ctx.kind === 'four') {
      const f = ctx.furnace;
      top.innerHTML = `<h3>Four</h3>`;
      const box = el('div', 'furn');
      box.append(slotEl(f.in, 'f:in'), el('div', 'flame', `<i style="height:${f.burnMax ? Math.max(0, f.burn / f.burnMax) * 100 : 0}%"></i>`), slotEl(f.fuel, 'f:fuel'), el('div', 'arrow', `<i style="width:${f.prog / VX.SMELT_T * 100}%"></i>`), slotEl(f.out, 'f:out'));
      top.appendChild(box);
    } else if (ctx.kind === 'coffre') {
      top.innerHTML = `<h3>Coffre</h3>`;
      const g = el('div', 'igrid'); ctx.chest.forEach((st, i) => g.appendChild(slotEl(st, 'k:' + i))); top.appendChild(g);
    } else {
      const w = ctx.kind === 'table' ? 3 : 2;
      top.innerHTML = `<h3>${w === 3 ? 'Établi' : 'Fabrication'}</h3>`;
      const row = el('div', 'craftrow');
      if (ctx.kind === 'inv') { const ac = el('div', 'armorcol'); G.armor.forEach((st, i) => ac.appendChild(slotEl(st, 'a:' + i, ARMOR_HINT[i]))); row.appendChild(ac); }
      const box = el('div', 'craft'), g = el('div', 'cgrid g' + w);
      grid(w).forEach((st, i) => g.appendChild(slotEl(st, 'c:' + i)));
      const res = craftResult(w); const out = slotEl(res ? { id: res.id, n: res.n } : null, 'c:out'); out.classList.add('out');
      box.append(g, el('div', 'arrow big', '➜'), out); row.appendChild(box); top.appendChild(row);
    }
    main.appendChild(top);
    if (cre) {
      const pal = el('div', 'palette'); pal.appendChild(el('h3', '', 'Créatif <small>(clic : une pile ; clic sur la palette avec un objet : le jeter)</small>'));
      const pg = el('div', 'pgrid'); VX.CREATIVE.forEach(id => pg.appendChild(slotEl({ id, n: 1 }, 'p:' + id))); pal.appendChild(pg); main.appendChild(pal);
    }
    main.appendChild(el('h3', '', 'Inventaire'));
    const inv = el('div', 'igrid'); for (let i = 9; i < 36; i++) inv.appendChild(slotEl(G.inv[i], 'i:' + i)); main.appendChild(inv);
    const hot = el('div', 'igrid hotrow'); for (let i = 0; i < 9; i++) hot.appendChild(slotEl(G.inv[i], 'i:' + i)); main.appendChild(hot);
    main.appendChild(el('p', 'hint', 'Clic gauche : prendre / poser · clic droit : moitié / un seul · Maj + clic : ranger vite · E ou Échap : fermer'));
    wrap.appendChild(main);
    if (ctx.kind === 'inv' || ctx.kind === 'table') wrap.appendChild(bookEl(ctx.kind === 'table' ? 3 : 2));
    p.appendChild(wrap);
    p.querySelectorAll('.slot').forEach(s => {
      s.addEventListener('mousedown', e => { e.preventDefault(); clickSlot(s.dataset.ref, e.button, e.shiftKey); });
      s.addEventListener('mouseenter', () => { const st = getRef(s.dataset.ref); const t = s.dataset.tip || (st ? VX.nameOf(st.id) + (VX.ARMOR && VX.ARMOR[st.id] ? ' · protection ' + VX.ARMOR[st.id].pts : '') : s.dataset.hint ? 'Emplacement : ' + s.dataset.hint : ''); if (t) { tipEl.textContent = t; tipEl.style.display = 'block'; } });
      s.addEventListener('mouseleave', () => { tipEl.style.display = 'none'; });
    });
    renderCursor();
  }
  UI.refresh = () => { if (UI.open) renderInv(); UI.hud(); };
  function getRef(ref) {
    const [k, v] = ref.split(':');
    if (k === 'i') return G.inv[+v]; if (k === 'c') { if (v === 'out') { const r = craftResult(gridW()); return r ? { id: r.id, n: r.n } : null; } return grid(gridW())[+v]; }
    if (k === 'f') return UI.open.furnace[v]; if (k === 'p') return { id: +v, n: 1 };
    if (k === 'k') return UI.open.chest[+v]; if (k === 'a') return G.armor[+v];
    if (k === 'r') { const r = VX.RECIPES[+v]; return r ? { id: r.out, n: r.n } : null; }
    return null;
  }
  function setRef(ref, st) {
    const [k, v] = ref.split(':'); if (st && st.n <= 0) st = null;
    if (k === 'i') G.inv[+v] = st; else if (k === 'c') grid(gridW())[+v] = st; else if (k === 'f') UI.open.furnace[v] = st;
    else if (k === 'k') UI.open.chest[+v] = st; else if (k === 'a') G.armor[+v] = st;
  }
  // range une pile dans un tableau (fusion puis cases vides) ; renvoie le reste ou null
  function stowInto(arr, st) {
    st = Object.assign({}, st); const max = VX.stackOf(st.id);
    if (st.d == null) for (let i = 0; i < arr.length && st.n > 0; i++) { const s = arr[i]; if (s && s.id === st.id && s.d == null && s.n < max) { const m = Math.min(st.n, max - s.n); s.n += m; st.n -= m; } }
    for (let i = 0; i < arr.length && st.n > 0; i++) if (!arr[i]) { arr[i] = Object.assign({}, st); st.n = 0; }
    return st.n > 0 ? st : null;
  }
  const same = (a, b) => a && b && a.id === b.id && a.d == null && b.d == null;
  const armorSlotOk = (slot, st) => !st || (VX.ARMOR && VX.ARMOR[st.id] && VX.ARMOR[st.id].slot === slot);
  function clickSlot(ref, btn, shift) {
    const [k, v] = ref.split(':'), max = st => VX.stackOf(st.id);
    if (k === 'r') { const r = VX.RECIPES[+v]; if (r) placeRecipe(r, shift); return; }
    if (k === 'p') {   // palette créative
      if (G.cursor) G.cursor = null; else { const id = +v; G.cursor = { id, n: VX.stackOf(id), d: VX.duraOf(id) || undefined }; if (shift) { G.give(id, VX.stackOf(id)); G.cursor = null; } }
      renderInv(); UI.hud(); return;
    }
    if (k === 'c' && v === 'out') {   // résultat de fabrication
      const w = gridW();
      let times = shift ? 64 : 1;
      while (times-- > 0) {
        const r = craftResult(w); if (!r) break;
        const st = { id: r.id, n: r.n, d: VX.duraOf(r.id) || undefined };
        if (shift) { if (!G.canGive(r.id, r.n)) break; G.give(st.id, st.n, st.d); }
        else { if (G.cursor && !(same(G.cursor, st) && G.cursor.n + st.n <= max(st))) break; if (G.cursor) G.cursor.n += st.n; else G.cursor = st; }
        grid(w).forEach((s, i) => { if (s) { s.n--; if (s.n <= 0) grid(w)[i] = null; } });
        G.known[r.id] = 1; G.sfx('craft'); VX.hooks.emit('craft', { id: r.id, n: r.n });
      }
      renderInv(); UI.hud(); return;
    }
    if (k === 'f' && v === 'out') {
      const st = UI.open.furnace.out; if (!st) return;
      if (shift) { if (G.canGive(st.id, st.n)) { G.give(st.id, st.n); UI.open.furnace.out = null; } }
      else if (!G.cursor) { G.cursor = st; UI.open.furnace.out = null; } else if (same(G.cursor, st) && G.cursor.n + st.n <= max(st)) { G.cursor.n += st.n; UI.open.furnace.out = null; }
      G.known[st.id] = 1; renderInv(); UI.hud(); return;
    }
    let st = getRef(ref);
    if (shift && st) {   // rangement rapide
      if (k === 'i') {
        const i = +v, ar = VX.ARMOR && VX.ARMOR[st.id];
        if (UI.open.kind === 'coffre') { G.inv[i] = stowInto(UI.open.chest, st); }
        else if (UI.open.kind === 'four' && (VX.SMELT[st.id] || VX.fuelOf(st.id))) { const f = UI.open.furnace, slot = VX.SMELT[st.id] ? 'in' : 'fuel'; if (!f[slot]) { f[slot] = st; G.inv[i] = null; } else if (same(f[slot], st)) { const m = Math.min(st.n, max(st) - f[slot].n); f[slot].n += m; st.n -= m; if (st.n <= 0) G.inv[i] = null; } }
        else if (UI.open.kind === 'inv' && ar && !G.armor[ar.slot]) { G.armor[ar.slot] = st; G.inv[i] = null; G.sfx('equip'); }
        else { const range = i < 9 ? [9, 36] : [0, 9]; G.inv[i] = null; const left = G.giveRange(st, range[0], range[1]); if (left) G.inv[i] = left; }
      }
      else { setRef(ref, null); const left = G.giveRange(st, 0, 36); if (left) setRef(ref, left); }
      renderInv(); UI.hud(); return;
    }
    const cur = G.cursor;
    if (k === 'a') {   // emplacement d'armure : seulement la bonne pièce, une à la fois
      const slot = +v; if (!armorSlotOk(slot, cur)) { UI.toast('Cette case attend : ' + ARMOR_HINT[slot] + '.'); return; }
      G.armor[slot] = cur; G.cursor = st; if (cur) G.sfx('equip'); renderInv(); UI.hud(); return;
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
    renderInv(); UI.hud();
  }

  /* ---------- menus (pause, mort, aide) ---------- */
  UI.menu = function (kind) {
    const m = $('.menu'); UI.menuOpen = kind; document.exitPointerLock && document.exitPointerLock();
    if (!kind) { m.style.display = 'none'; return; }
    UI.closeChat();
    m.style.display = 'block';
    if (kind === 'mort') { m.innerHTML = `<h2 class="dead">Tu es mort !</h2><p>Tu gardes ton inventaire. Attention aux chutes, à la lave, à la noyade, à la faim et aux créatures de la nuit.</p><button data-a="respawn">Réapparaître</button>`; }
    else {
      const help = `<div class="keys"><b>ZQSD</b> se déplacer · <b>Espace</b> sauter / nager (2× en créatif : voler) · <b>Maj</b> s'accroupir / descendre · <b>Ctrl</b> ou <b>Z</b>×2 courir<br><b>Clic gauche</b> casser / frapper · <b>Clic droit</b> poser / utiliser / manger / enfiler · <b>E</b> inventaire · <b>1-9</b> ou molette : barre rapide · <b>A</b> jeter · <b>T</b> chat (<b>/mode survie</b>, <b>/mode creatif</b>, <b>/aide</b>)</div>`;
      const A = VX.Audio, vol = (k, label) => A ? `<label class="dist">${label} <input type="range" data-vol="${k}" min="0" max="1" step="0.05" value="${A.vol[k]}"></label>` : '';
      m.innerHTML = kind === 'aide'
        ? `<h2>BLOCARIA</h2><p class="sub">Bac à sable de blocs · Surface et Braises</p>${help}<p>Fabrique un établi (4 planches), des outils, un four, un coffre… Le livre de recettes, à droite de l'inventaire, montre ce que tu peux fabriquer. La nuit, les créatures hostiles sortent : construis un abri ! Trouve de l'obsidienne, construis un cadre (4 de large, 5 de haut) et allume-le avec l'<b>allumeur</b> pour passer dans <b>les Braises</b>.</p><button data-a="play">Jouer</button>`
        : `<h2>Pause</h2>${help}<div class="row"><button data-a="play">Reprendre</button><button data-a="mode">Mode : ${G.mode === 'creatif' ? 'Créatif' : 'Survie'}</button><button data-a="shaders">✨ Shaders (F7)</button><button data-a="gfx">Rendu : ${VX.fastMesh ? 'Rapide' : 'Beau'}</button></div>
          <div class="row">${VX.MP && VX.MP.on ? `<span class="mp">🌐 Salon <b>${VX.MP.room.code}</b> · ${VX.MP.room.players.length} joueur(s)${VX.MP.host ? ' · donne ce code à tes potes' : ''}</span><button data-a="mpleave">Quitter le salon</button>` : '<button data-a="mphost">🌐 Ouvrir mon monde aux potes</button><button data-a="mpjoin">🌐 Rejoindre un pote</button>'}</div>
          <div class="row"><button data-a="save">Sauvegarder</button><button data-a="export">Exporter le monde</button><button data-a="import">Importer</button></div>
          <div class="row"><label class="dist">Distance de vue <input type="range" class="vd" min="2" max="7" step="1" value="${G.R}"></label></div>
          <div class="row">${vol('music', 'Musique')}${vol('sfx', 'Effets')}</div>
          <div class="row"><button data-a="new" class="warn">Nouveau monde</button><button data-a="quit">Retour au site</button></div><p class="small">Graine : ${G.seed} · ${G.dimName()}</p>`;
    }
    m.querySelectorAll('button').forEach(b => b.addEventListener('click', () => G.menuAction(b.dataset.a)));
    const d = m.querySelector('.vd'); if (d) d.addEventListener('input', () => { G.R = +d.value; G.saveSettings(); });
    m.querySelectorAll('[data-vol]').forEach(r => r.addEventListener('input', () => VX.Audio && VX.Audio.setVol(r.dataset.vol, +r.value)));
  };
})();

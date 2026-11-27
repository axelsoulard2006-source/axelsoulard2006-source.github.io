/* ===== ui.js : HUD (réticule, barre rapide, vie, faim), inventaire, établi, four, mode créatif, pause ===== */
(function () {
  const VX = window.VX;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const UI = VX.UI = {};
  let G, cursorEl, tipEl;

  // icônes du HUD (cœur et pomme), dessinées une fois
  function pix(rows, pal) { const c = document.createElement('canvas'); c.width = c.height = 9; const g = c.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } })); return c.toDataURL(); }
  const HEART = ['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'];
  const ICONS = {
    heart: pix(HEART, { k: '#1a0a0a', r: '#e8202a', w: '#ffb0b0' }), heartE: pix(HEART, { k: '#1a0a0a', r: '#3a2a2a', w: '#3a2a2a' }),
    food: pix(['....g....', '...gl....', '..rrrrr..', '.rwrrrrr.', '.rrrrrrr.', '.rrrrrrr.', '.rrrrrrd.', '..rrrrd..', '...rdd...'], { g: '#5a3a20', l: '#47d16c', r: '#e0302a', w: '#ffd0c8', d: '#9a1a14' }),
    foodE: pix(['....g....', '...gl....', '..rrrrr..', '.rrrrrrr.', '.rrrrrrr.', '.rrrrrrr.', '.rrrrrrr.', '..rrrrr..', '...rrr...'], { g: '#3a3a3a', l: '#3a3a3a', r: '#3a2a2a' }),
  };

  UI.init = function (game) {
    G = game;
    const hud = el('div', 'hud');
    hud.innerHTML = `<div class="cross"></div><div class="mine"><i></i></div>
      <div class="bars"><div class="hearts"></div><div class="foods"></div></div>
      <div class="hotbar"></div><div class="held"></div><div class="info"></div><div class="toast"></div><div class="water"></div><div class="hurt"></div><div class="portalfx"></div>`;
    document.body.appendChild(hud);
    for (let i = 0; i < 9; i++) $('.hotbar').appendChild(el('div', 'slot'));
    const scr = el('div', 'screens'); scr.innerHTML = `<div class="panel inv" style="display:none"></div><div class="panel menu" style="display:none"></div>`; document.body.appendChild(scr);
    cursorEl = el('div', 'cursor slot'); document.body.appendChild(cursorEl);
    tipEl = el('div', 'tip'); document.body.appendChild(tipEl);
    document.addEventListener('mousemove', e => { cursorEl.style.left = e.clientX - 20 + 'px'; cursorEl.style.top = e.clientY - 20 + 'px'; tipEl.style.left = e.clientX + 14 + 'px'; tipEl.style.top = e.clientY + 10 + 'px'; });
    document.addEventListener('contextmenu', e => { if (UI.open) e.preventDefault(); });
  };
  const slotHTML = st => st ? `<img src="${VX.icon(st.id).url}" draggable="false">${st.n > 1 ? `<b>${st.n}</b>` : ''}${st.d != null && VX.duraOf(st.id) ? `<u style="width:${Math.max(0, st.d / VX.duraOf(st.id)) * 100}%;background:hsl(${Math.max(0, st.d / VX.duraOf(st.id)) * 120},90%,50%)"></u>` : ''}` : '';
  UI.hud = function () {
    const hb = document.querySelectorAll('.hotbar .slot');
    hb.forEach((s, i) => { s.innerHTML = slotHTML(G.inv[i]); s.classList.toggle('sel', i === G.sel); });
    const P = G.player, cre = G.mode === 'creatif';
    $('.bars').style.visibility = cre ? 'hidden' : 'visible';
    let h = ''; for (let i = 0; i < 10; i++) h += `<img src="${P.hp >= i * 2 + 2 ? ICONS.heart : ICONS.heartE}" class="${P.hp === i * 2 + 1 ? 'half' : ''}">`;
    let f = ''; for (let i = 9; i >= 0; i--) f += `<img src="${P.food >= i * 2 + 2 ? ICONS.food : P.food === i * 2 + 1 ? ICONS.food : ICONS.foodE}" class="${P.food === i * 2 + 1 ? 'half' : ''}">`;
    $('.hearts').innerHTML = h; $('.foods').innerHTML = f;
    const it = G.inv[G.sel]; $('.held').textContent = it ? VX.nameOf(it.id) : '';
  };
  UI.info = t => { $('.info').textContent = t; };
  let toastT = null;
  UI.toast = t => { const e = $('.toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); };
  UI.mining = f => { const e = $('.mine'); e.style.display = f > 0 ? 'block' : 'none'; e.firstChild.style.width = Math.round(f * 100) + '%'; };
  UI.fx = (water, hurt, portal) => { $('.water').style.opacity = water ? 1 : 0; $('.water').style.background = water === 2 ? 'rgba(255,90,0,.55)' : 'rgba(30,80,200,.35)'; $('.hurt').style.opacity = hurt; $('.portalfx').style.opacity = portal; };

  /* ---------- fenêtres d'inventaire ---------- */
  // ctx : { kind: 'inv' | 'table' | 'four', furnace }
  UI.openInv = function (ctx) { UI.open = ctx; document.exitPointerLock && document.exitPointerLock(); renderInv(); $('.inv').style.display = 'block'; };
  UI.closeInv = function () {
    if (!UI.open) return; const ctx = UI.open; UI.open = null; $('.inv').style.display = 'none'; tipEl.style.display = 'none';
    const back = arr => arr.forEach((st, i) => { if (st) { G.give(st.id, st.n, st.d); arr[i] = null; } });
    back(G.craft2); back(G.craft3);
    if (G.cursor) { G.give(G.cursor.id, G.cursor.n, G.cursor.d); G.cursor = null; }
    void ctx; renderCursor(); UI.hud();
  };
  function renderCursor() { cursorEl.innerHTML = slotHTML(G.cursor); cursorEl.style.display = G.cursor ? 'block' : 'none'; }
  function grid(w) { return w === 3 ? G.craft3 : G.craft2; }
  function craftResult(w) { return VX.craft(grid(w).map(s => s ? s.id : 0), w); }
  function slotEl(st, ref) { const s = el('div', 'slot', slotHTML(st)); s.dataset.ref = ref; return s; }
  function renderInv() {
    const ctx = UI.open, p = $('.inv'); if (!ctx) return; p.innerHTML = '';
    const cre = G.mode === 'creatif';
    const top = el('div', 'inv-top');
    if (ctx.kind === 'four') {
      const f = ctx.furnace;
      top.innerHTML = `<h3>Four</h3>`;
      const box = el('div', 'furn');
      box.append(slotEl(f.in, 'f:in'), el('div', 'flame', `<i style="height:${f.burnMax ? Math.max(0, f.burn / f.burnMax) * 100 : 0}%"></i>`), slotEl(f.fuel, 'f:fuel'), el('div', 'arrow', `<i style="width:${f.prog / VX.SMELT_T * 100}%"></i>`), slotEl(f.out, 'f:out'));
      top.appendChild(box);
    } else {
      const w = ctx.kind === 'table' ? 3 : 2;
      top.innerHTML = `<h3>${w === 3 ? 'Établi' : 'Fabrication'}</h3>`;
      const box = el('div', 'craft'), g = el('div', 'cgrid g' + w);
      grid(w).forEach((st, i) => g.appendChild(slotEl(st, 'c:' + i)));
      const res = craftResult(w); const out = slotEl(res ? { id: res.id, n: res.n } : null, 'c:out'); out.classList.add('out');
      box.append(g, el('div', 'arrow big', '➜'), out); top.appendChild(box);
    }
    p.appendChild(top);
    if (cre) {
      const pal = el('div', 'palette'); pal.appendChild(el('h3', '', 'Créatif <small>(clic : une pile ; clic sur la palette avec un objet : le jeter)</small>'));
      const pg = el('div', 'pgrid'); VX.CREATIVE.forEach(id => pg.appendChild(slotEl({ id, n: 1 }, 'p:' + id))); pal.appendChild(pg); p.appendChild(pal);
    }
    p.appendChild(el('h3', '', 'Inventaire'));
    const main = el('div', 'igrid'); for (let i = 9; i < 36; i++) main.appendChild(slotEl(G.inv[i], 'i:' + i)); p.appendChild(main);
    const hot = el('div', 'igrid hotrow'); for (let i = 0; i < 9; i++) hot.appendChild(slotEl(G.inv[i], 'i:' + i)); p.appendChild(hot);
    p.appendChild(el('p', 'hint', 'Clic gauche : prendre / poser · clic droit : moitié / un seul · Maj + clic : ranger vite · E ou Échap : fermer'));
    p.querySelectorAll('.slot').forEach(s => {
      s.addEventListener('mousedown', e => { e.preventDefault(); clickSlot(s.dataset.ref, e.button, e.shiftKey); });
      s.addEventListener('mouseenter', () => { const st = getRef(s.dataset.ref); if (st) { tipEl.textContent = VX.nameOf(st.id); tipEl.style.display = 'block'; } });
      s.addEventListener('mouseleave', () => { tipEl.style.display = 'none'; });
    });
    renderCursor();
  }
  UI.refresh = () => { if (UI.open) renderInv(); UI.hud(); };
  function getRef(ref) {
    const [k, v] = ref.split(':');
    if (k === 'i') return G.inv[+v]; if (k === 'c') { if (v === 'out') { const r = craftResult(UI.open.kind === 'table' ? 3 : 2); return r ? { id: r.id, n: r.n } : null; } return grid(UI.open.kind === 'table' ? 3 : 2)[+v]; }
    if (k === 'f') return UI.open.furnace[v]; if (k === 'p') return { id: +v, n: 1 };
    return null;
  }
  function setRef(ref, st) {
    const [k, v] = ref.split(':'); if (st && st.n <= 0) st = null;
    if (k === 'i') G.inv[+v] = st; else if (k === 'c') grid(UI.open.kind === 'table' ? 3 : 2)[+v] = st; else if (k === 'f') UI.open.furnace[v] = st;
  }
  const same = (a, b) => a && b && a.id === b.id && a.d == null && b.d == null;
  function clickSlot(ref, btn, shift) {
    const [k, v] = ref.split(':'), max = st => VX.stackOf(st.id);
    if (k === 'p') {   // palette créative
      if (G.cursor) G.cursor = null; else { const id = +v; G.cursor = { id, n: VX.stackOf(id), d: VX.duraOf(id) || undefined }; if (shift) { G.give(id, VX.stackOf(id)); G.cursor = null; } }
      renderInv(); UI.hud(); return;
    }
    if (k === 'c' && v === 'out') {   // résultat de fabrication
      const w = UI.open.kind === 'table' ? 3 : 2;
      let times = shift ? 64 : 1;
      while (times-- > 0) {
        const r = craftResult(w); if (!r) break;
        const st = { id: r.id, n: r.n, d: VX.duraOf(r.id) || undefined };
        if (shift) { if (!G.canGive(r.id, r.n)) break; G.give(st.id, st.n, st.d); }
        else { if (G.cursor && !(same(G.cursor, st) && G.cursor.n + st.n <= max(st))) break; if (G.cursor) G.cursor.n += st.n; else G.cursor = st; }
        grid(w).forEach((s, i) => { if (s) { s.n--; if (s.n <= 0) grid(w)[i] = null; } });
        G.sfx('craft'); VX.hooks.emit('craft', { id: r.id, n: r.n });
      }
      renderInv(); UI.hud(); return;
    }
    if (k === 'f' && v === 'out') {
      const st = UI.open.furnace.out; if (!st) return;
      if (shift) { if (G.canGive(st.id, st.n)) { G.give(st.id, st.n); UI.open.furnace.out = null; } }
      else if (!G.cursor) { G.cursor = st; UI.open.furnace.out = null; } else if (same(G.cursor, st) && G.cursor.n + st.n <= max(st)) { G.cursor.n += st.n; UI.open.furnace.out = null; }
      renderInv(); UI.hud(); return;
    }
    let st = getRef(ref);
    if (shift && st) {   // rangement rapide
      if (k === 'i') { const i = +v; if (UI.open.kind === 'four' && (VX.SMELT[st.id] || VX.fuelOf(st.id))) { const f = UI.open.furnace, slot = VX.SMELT[st.id] ? 'in' : 'fuel'; if (!f[slot]) { f[slot] = st; G.inv[i] = null; } else if (same(f[slot], st)) { const m = Math.min(st.n, max(st) - f[slot].n); f[slot].n += m; st.n -= m; if (st.n <= 0) G.inv[i] = null; } }
        else { const range = i < 9 ? [9, 36] : [0, 9]; G.inv[i] = null; const left = G.giveRange(st, range[0], range[1]); if (left) G.inv[i] = left; } }
      else { setRef(ref, null); const left = G.giveRange(st, 0, 36); if (left) setRef(ref, left); }
      renderInv(); UI.hud(); return;
    }
    const cur = G.cursor;
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
    m.style.display = 'block';
    if (kind === 'mort') { m.innerHTML = `<h2 class="dead">Tu es mort !</h2><p>Tu gardes ton inventaire. Attention aux chutes, à la lave et à la faim.</p><button data-a="respawn">Réapparaître</button>`; }
    else {
      const help = `<div class="keys"><b>ZQSD</b> se déplacer · <b>Espace</b> sauter (2× en créatif : voler) · <b>Maj</b> s'accroupir / descendre · <b>Ctrl</b> courir<br><b>Clic gauche</b> casser · <b>Clic droit</b> poser / utiliser / manger · <b>E</b> inventaire · <b>1-9</b> ou molette : barre rapide · <b>A</b> jeter · <b>G</b> survie / créatif</div>`;
      m.innerHTML = kind === 'aide'
        ? `<h2>BLOCARIA</h2><p class="sub">Bac à sable de blocs · Surface et Braises</p>${help}<p>Fabrique un établi (4 planches), des outils, un four… Trouve de l'obsidienne, construis un cadre (4 de large, 5 de haut) et allume-le avec l'<b>allumeur</b> pour passer dans <b>les Braises</b>, où se cache l'astrium.</p><button data-a="play">Jouer</button>`
        : `<h2>Pause</h2>${help}<div class="row"><button data-a="play">Reprendre</button><button data-a="mode">Mode : ${G.mode === 'creatif' ? 'Créatif' : 'Survie'}</button><button data-a="gfx">Rendu : ${VX.fastMesh ? 'Rapide' : 'Beau'}</button></div>
          <div class="row">${VX.MP && VX.MP.on ? `<span class="mp">🌐 Salon <b>${VX.MP.room.code}</b> · ${VX.MP.room.players.length} joueur(s)${VX.MP.host ? ' · donne ce code à tes potes' : ''}</span><button data-a="mpleave">Quitter le salon</button>` : '<button data-a="mphost">🌐 Ouvrir mon monde aux potes</button><button data-a="mpjoin">🌐 Rejoindre un pote</button>'}</div>
          <div class="row"><button data-a="save">Sauvegarder</button><button data-a="export">Exporter le monde</button><button data-a="import">Importer</button></div>
          <div class="row"><label class="dist">Distance de vue <input type="range" min="2" max="7" step="1" value="${G.R}"></label></div>
          <div class="row"><button data-a="new" class="warn">Nouveau monde</button><button data-a="quit">Retour au site</button></div><p class="small">Graine : ${G.seed} · ${G.dimName()}</p>`;
    }
    m.querySelectorAll('button').forEach(b => b.addEventListener('click', () => G.menuAction(b.dataset.a)));
    const d = m.querySelector('.dist input'); if (d) d.addEventListener('input', () => { G.R = +d.value; G.saveSettings(); });
  };
})();

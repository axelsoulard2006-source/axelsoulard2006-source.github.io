/* ===== arena/asc-quests.js : les contrats du tableau des aventuriers =====
   3 contrats du jour + 1 contrat de la semaine, tirés au hasard (même tirage toute la journée).
   La progression se fait pendant les courses (évènements de asc-combat.js / asc-run.js) ;
   on encaisse la récompense au village (éclats d'âme + XP de classe). */
(function () {
  const BR = window.BR, UI = BR.UI, Au = BR.Audio, Acc = BR.Account, esc = BR.esc;
  const Q = BR.Asc; if (!Q || !Q.on) return;
  const ICO = (n, sz, c) => BR.Icons.svg(n, sz, c);
  const CN = { chevalier: 'Chevalier', mage: 'Mage', archer: 'Archer' };

  /* ---------- modèles de contrats ---------- */
  const T = {
    kill:   { n: () => 'Abats 150 monstres', goal: 150, ico: 'skull' },
    elite:  { n: () => 'Abats 4 élites', goal: 4, ico: 'crown' },
    gob:    { n: () => 'Attrape un gobelin voleur', goal: 1, ico: 'gift' },
    guard:  { n: () => 'Terrasse un gardien', goal: 1, ico: 'trophy' },
    chest:  { n: () => 'Ouvre 2 coffres rares ou mieux', goal: 2, ico: 'gift' },
    perf:   { n: () => 'Réussis 12 esquives parfaites', goal: 12, ico: 'run' },
    deep:   { n: () => 'Atteins l\'étage 8', goal: 8, ico: 'up', max: true },
    cast:   { n: () => 'Lance 60 pouvoirs', goal: 60, ico: 'bolt' },
    ult:    { n: () => 'Lance 6 ultimes', goal: 6, ico: 'flare' },
    fl_chevalier: { n: () => 'Franchis 6 étages en Chevalier', goal: 6, ico: 'target', cls: 'chevalier' },
    fl_mage:      { n: () => 'Franchis 6 étages en Mage', goal: 6, ico: 'target', cls: 'mage' },
    fl_archer:    { n: () => 'Franchis 6 étages en Archer', goal: 6, ico: 'target', cls: 'archer' },
    // semaine
    w_win:   { n: () => 'Termine une Ascension (étage 15)', goal: 1, ico: 'trophy', week: true },
    w_coop:  { n: () => 'Franchis 25 étages entre amis', goal: 25, ico: 'users', week: true },
    w_kill:  { n: () => 'Abats 1 500 monstres', goal: 1500, ico: 'skull', week: true },
    w_leg:   { n: () => 'Ouvre un coffre légendaire', goal: 1, ico: 'gift', week: true },
    w_guard: { n: () => 'Terrasse 6 gardiens ou colosses', goal: 6, ico: 'crown', week: true },
  };
  const DAILY = Object.keys(T).filter(k => !T[k].week), WEEKLY = Object.keys(T).filter(k => T[k].week);
  const REW = { d: { sh: 25, xp: 450 }, w: { sh: 120, xp: 2200 } };

  /* ---------- dates et tirage ---------- */
  const pad = x => String(x).padStart(2, '0');
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const weekKey = d => { const m = new Date(d); const k = (m.getDay() + 6) % 7; m.setDate(m.getDate() - k); return dayKey(m); };
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(list, n, seed) { const r = BR.rngFrom(seed || 1), a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }
  // renouvelle les contrats si on a changé de jour / de semaine (les contrats terminés non encaissés sont perdus)
  function fresh() {
    const D = Q.data(), now = new Date(), dk = dayKey(now), wk = weekKey(now), who = String((Acc.p && Acc.p.name) || 'invite').toLowerCase();
    let ch = false;
    if (D.q.day !== dk || !D.q.d.length) {
      // jamais deux contrats de classe le même jour
      let ids = pick(DAILY, 6, hash(dk + who)), out = [], cls = false;
      for (const id of ids) { if (T[id].cls) { if (cls) continue; cls = true; } out.push(id); if (out.length >= 3) break; }
      D.q.day = dk; D.q.d = out.map(id => ({ id, p: 0, c: 0 })); ch = true;
    }
    if (D.q.week !== wk || !D.q.w.length) { D.q.week = wk; D.q.w = pick(WEEKLY, 1, hash(wk + who)).map(id => ({ id, p: 0, c: 0 })); ch = true; }
    if (ch) Q.saveData();
    return D;
  }
  Q.quests = () => { const D = fresh(); return { d: D.q.d, w: D.q.w }; };

  /* ---------- progression pendant la course (mise en mémoire, sauvegardée par paquets) ---------- */
  let pend = {}, done = new Set();
  function add(id, v, max) {
    const D = Q.data(); const all = D.q.d.concat(D.q.w), q = all.find(x => x.id === id); if (!q || q.c) return;
    const goal = T[id].goal, cur = q.p + (pend[id] || 0);
    if (cur >= goal) return;
    if (max) pend[id] = Math.max(pend[id] || 0, v - q.p); else pend[id] = (pend[id] || 0) + v;
    if (q.p + pend[id] >= goal && !done.has(id)) { done.add(id); flush(); BR.Arena.banner && BR.Arena.banner('CONTRAT REMPLI', T[id].n() + ' — récompense au tableau du village', 2.4, 'gold'); Au.fx && Au.fx('reveal', { rate: 1.4 }); }
  }
  function flush() {
    const ks = Object.keys(pend); if (!ks.length) return;
    const D = Q.data();
    for (const q of D.q.d.concat(D.q.w)) if (pend[q.id]) q.p = Math.min(T[q.id].goal, q.p + pend[q.id]);
    pend = {}; Q.saveData();
  }
  const active = id => { const D = Q.data(); return D.q.d.concat(D.q.w).some(q => q.id === id && !q.c); };
  Q.on('start', () => { fresh(); done = new Set(); });
  Q.on('kill', (S, a, silent) => {
    if (silent || !a) return;
    if (a.type === 'gobelin') { if (!a.escaped) add('gob', 1); return; }
    if (a.type === 'totem') return;
    add('kill', 1); add('w_kill', 1); if (a.elite) add('elite', 1);
  });
  Q.on('perfect', () => add('perf', 1));
  Q.on('cast', (S, f, id, slot) => { if (slot === 'ult') add('ult', 1); else add('cast', 1); });
  Q.on('chest', tier => { if (tier === 'rare' || tier === 'epique' || tier === 'legendaire') add('chest', 1); if (tier === 'legendaire') add('w_leg', 1); });
  Q.on('floor', (fl, kind, M, solo) => {
    add('deep', fl, true);
    if (M && M.cls) add('fl_' + M.cls, 1);
    if (kind === 'gardien' || kind === 'final') { add('guard', 1); add('w_guard', 1); }
    if (!solo) add('w_coop', 1);
    if (fl >= (Q.FLOORS || 15)) add('w_win', 1);
    flush();
  });
  Q.on('runEnd', () => flush());

  // encaisser
  function claim(kind, id) {
    const D = fresh(), q = (kind === 'w' ? D.q.w : D.q.d).find(x => x.id === id);
    if (!q || q.c || q.p < T[id].goal) return false;
    q.c = 1; D.st.quests = (D.st.quests || 0) + 1; const R = REW[kind], cls = T[id].cls || D.sel.cls || 'chevalier';
    D.sh += R.sh; if (D.cls[cls]) D.cls[cls].xp += R.xp;
    Q.saveData();
    return { sh: R.sh, xp: R.xp, cls };
  }
  Q.questsReady = () => { const D = fresh(); return D.q.d.concat(D.q.w).filter(q => !q.c && q.p >= T[q.id].goal).length; };

  /* ---------- écran : le tableau des contrats ---------- */
  function untilTxt(ms) { const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3); return h ? h + ' h ' + pad(m) : m + ' min'; }
  UI.screen('asc-quests', {
    enter(n) {
      BR.curGame = 'arena'; BR.ascMode = true;
      const paint = (pop) => {
        const D = fresh(), now = new Date(), tom = new Date(now); tom.setHours(24, 0, 0, 0);
        const nextW = new Date(D.q.week + 'T00:00:00'); nextW.setDate(nextW.getDate() + 7);
        const card = (q, kind) => { const t = T[q.id], k = Math.min(1, q.p / t.goal), ok = q.p >= t.goal, R = REW[kind];
          return `<div class="qc ${kind === 'w' ? 'week' : ''} ${q.c ? 'claimed' : ok ? 'ready' : ''} ${pop === q.id ? 'pop' : ''}">
            <i class="qc-pin"></i><div class="qc-ico">${ICO(t.ico, 30)}</div>
            <b>${esc(t.n())}</b>
            <div class="qc-bar"><i style="width:${Math.round(k * 100)}%"></i><span>${BR.fmt(Math.min(q.p, t.goal))} / ${BR.fmt(t.goal)}</span></div>
            <div class="qc-rw">${Q.glyph('univ', 14, '#b9a6ff')} ${R.sh} éclats · +${BR.fmt(R.xp)} XP ${t.cls ? CN[t.cls] : 'de classe'}</div>
            ${q.c ? `<div class="qc-done">${ICO('check', 14)} Encaissé</div>` : ok ? `<button class="btn primary" data-claim="${kind}:${q.id}">Encaisser</button>` : ''}</div>`; };
        n.innerHTML = `<div class="asc-quests">
          <div class="wh-top"><button class="btn ghost back" data-a="back">${ICO('back', 18)}</button><h2>Contrats du tableau</h2><div class="pts">${Q.glyph('univ', 20, '#b9a6ff')} <b>${D.sh}</b> éclats</div></div>
          <div class="qb">
            <div class="qb-col"><h4>Contrats du jour <small>nouveaux dans ${untilTxt(tom - now)}</small></h4><div class="qb-list">${D.q.d.map(q => card(q, 'd')).join('')}</div></div>
            <div class="qb-col wk"><h4>Contrat de la semaine <small>nouveau dans ${untilTxt(nextW - now)}</small></h4><div class="qb-list">${D.q.w.map(q => card(q, 'w')).join('')}</div>
              <p class="muted tiny">Les contrats avancent pendant tes courses, en solo comme entre amis. L'XP va à la classe indiquée, sinon à la classe que tu as choisie chez le Maître d'armes.</p></div>
          </div></div>`;
      };
      paint();
      n.onclick = e => {
        if (e.target.closest('[data-a=back]')) { Au.ui('back'); UI.show('asc'); return; }
        const c = e.target.closest('[data-claim]'); if (!c) return;
        const [kind, id] = c.dataset.claim.split(':'), r = claim(kind, id);
        if (r) { Au.ui('buy'); Au.fx('reveal', { rate: 1.3 }); UI.toast('+' + r.sh + ' éclats · +' + r.xp + ' XP ' + CN[r.cls], 'good'); paint(id); }
      };
    },
  });
})();

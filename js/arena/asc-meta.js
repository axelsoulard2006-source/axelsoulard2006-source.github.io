/* ===== arena/asc-meta.js : succès, titres, bestiaire, défi de la semaine et classements =====
   Les compteurs vivent dans Q.data() : st (statistiques), bes (monstres abattus), ach (succès obtenus), title, inf, wk. */
(function () {
  const BR = window.BR, UI = BR.UI, Au = BR.Audio, N = BR.Net, esc = BR.esc, AR = BR.ARENA;
  const Q = BR.Asc; if (!Q || !Q.on) return;
  const ICO = (n, sz, c) => BR.Icons.svg(n, sz, c);

  /* =====================================================================
     COMPTEURS (mis en mémoire pendant la course, sauvegardés par paquets)
     ===================================================================== */
  let pend = { st: {}, bes: {} }, runPerf = 0, runGold = 0;
  const inc = (k, v, sec) => { const P = pend[sec || 'st']; P[k] = (P[k] || 0) + (v || 1); };
  function flush() {
    const D = Q.data(); let ch = false;
    for (const k in pend.st) { D.st[k] = (D.st[k] || 0) + pend.st[k]; ch = true; }
    for (const k in pend.bes) { D.bes[k] = (D.bes[k] || 0) + pend.bes[k]; ch = true; }
    pend = { st: {}, bes: {} };
    if (ch) Q.saveData();
  }
  const maxSt = (k, v) => { const D = Q.data(); if (v > (D.st[k] || 0)) { D.st[k] = v; Q.saveData(); } };
  Q.on('start', () => { runPerf = runPerf || 0; });
  Q.on('classSet', () => { runPerf = 0; runGold = 0; });
  Q.on('kill', (S, a, silent) => {
    if (silent || !a) return;
    if (a.type === 'gobelin') { if (!a.escaped) { inc('gob'); inc('gobelin', 1, 'bes'); } return; }
    inc('kills'); inc(a.type, 1, 'bes'); if (a.elite) inc('elites');
  });
  Q.on('perfect', () => { runPerf++; });
  Q.on('chest', tier => inc('ch_' + tier));
  Q.on('floor', (fl, kind, M, solo, boss) => {
    if ((kind === 'gardien' || kind === 'final' || kind === 'elite') && boss && boss !== 'horde') { inc('b_' + boss, 1, 'bes'); if (kind !== 'elite') inc('guards'); }
    if (kind === 'enigme') inc('enigmes');
    if (M) runGold = Math.max(runGold, M.gold || 0);
    flush();
  });
  // salles du Savoir (questions de GMP) : terminées, et sans faute
  Q.on('quiz', sc => { inc('quiz'); if (sc >= 0.99) inc('quiz_ok'); flush(); setTimeout(() => Q.checkAch(true), 1500); });
  Q.on('parkour', () => { setTimeout(() => Q.checkAch(true), 400); });
  Q.on('runEnd', (o, M, D) => {
    flush();
    const D2 = Q.data(); D2.st.runs = (D2.st.runs || 0) + 1;
    if (o && o.win && M && M.cls) { D2.st['win_' + M.cls] = (D2.st['win_' + M.cls] || 0) + 1; if (Q.run && !Q.run.solo) D2.st.winmulti = (D2.st.winmulti || 0) + 1; }
    D2.st.perfmax = Math.max(D2.st.perfmax || 0, runPerf); D2.st.goldmax = Math.max(D2.st.goldmax || 0, runGold, (M && M.gold) || 0);
    runPerf = 0; runGold = 0;
    Q.saveData();
    setTimeout(() => Q.checkAch(true), 2500);
  });
  void maxSt;

  /* =====================================================================
     BESTIAIRE
     ===================================================================== */
  const BEAST = [
    { id: 'grunt', n: 'Cogneur', col: '#ff7a3a', at: [1, 50, 300], lore: ['Le gros de la horde. Il frappe fort et ne pense à rien.', 'On raconte qu\'ils naissent des pierres de l\'arène, réveillées par le bruit des combats.', 'Un Cogneur qui survit assez longtemps devient une Brute. Aucun n\'y est jamais arrivé.'] },
    { id: 'boomer', n: 'Kamikaze', col: '#ffd23a', at: [1, 40, 200], lore: ['Il court vers toi et explose. C\'est tout son plan.', 'Sa mèche est trempée dans l\'huile des braseros du temple.', 'Les Kamikazes se disputent pour savoir qui sautera le premier. Ils perdent tous.'] },
    { id: 'archer', n: 'Tireur', col: '#4ad8ff', at: [1, 40, 200], lore: ['Il reste à distance et tire des orbes brûlants.', 'Ses yeux voient la chaleur : il te repère même derrière un rocher.', 'Un Tireur rate rarement deux fois de suite. Esquive la deuxième.'] },
    { id: 'leaper', n: 'Bondisseur', col: '#57ff9a', at: [1, 40, 200], lore: ['Il saute de loin et retombe sur toi.', 'L\'ombre au sol trahit toujours l\'endroit où il va retomber.', 'Les Bondisseurs ont des jambes de grenouille et un ego de champion.'] },
    { id: 'shaman', n: 'Chaman', col: '#c070ff', at: [1, 25, 120], lore: ['Il soigne ses alliés et fait tomber des runes de feu.', 'Tue-le en premier : chaque seconde de vie qu\'il a, la horde en gagne dix.', 'Ses runes sont des prières volées aux bâtisseurs du temple.'] },
    { id: 'brute', n: 'Brute', col: '#ff3a5a', at: [1, 20, 100], lore: ['Énorme, lente, et elle te fait voler à travers l\'arène.', 'Ses coups au sol se lisent à l\'avance : le cercle rouge ne ment jamais.', 'Une Brute ne recule pas. Mais une Brute repoussée tombe, et elle a du mal à se relever.'] },
    { id: 'gobelin', n: 'Gobelin voleur', col: '#ffc83a', at: [1, 5, 25], lore: ['Il fuit avec un sac d\'or plus gros que lui. Attrape-le !', 'Il connaît chaque recoin de l\'arène et nargue ceux qui sont trop lents.', 'Personne ne sait d\'où vient son or. Lui non plus, sans doute.'] },
    { id: 'totem', n: 'Totem maudit', col: '#b06bff', at: [1, 15, 60], lore: ['Une pierre gravée qui appelle des monstres.', 'Les visages des totems sont ceux d\'anciens aventuriers tombés dans l\'arène.', 'Brise-les vite : leur appel devient plus fort avec le temps.'] },
  ];
  const BOSS_AT = [1, 3, 10];
  const bossEntries = () => (AR.BOSSES || []).map(b => ({ id: 'b_' + b.id, boss: b.id, n: b.name, col: b.color, at: BOSS_AT, lore: [b.sub || '', 'Un colosse ne meurt jamais vraiment : il revient, plus fort, au palier suivant.', 'Les anciens disaient qu\'il garde une porte. Personne ne sait vers où.'] }));
  const allBeasts = () => BEAST.concat(bossEntries());
  const BES_RW = [5, 15, 40];
  // paliers de lore atteints → éclats (une seule fois)
  function beastRewards() {
    const D = Q.data(); let got = 0, lines = [];
    for (const B of allBeasts()) { const k = D.bes[B.id] || 0; B.at.forEach((a, i) => { const key = 'l_' + B.id.replace(/^b_/, 'b') + i; if (k >= a && !D.ach[key]) { D.ach[key] = 1; got += BES_RW[i]; lines.push(B.n); } }); }
    if (got) { D.sh += got; Q.saveData(); }
    return { got, lines };
  }

  /* =====================================================================
     SUCCÈS (récompense en éclats, et un titre pour certains)
     ===================================================================== */
  const lvOf = (D, c) => Q.clsLevel ? Q.clsLevel((D.cls[c] || {}).xp || 0).lv : 1;
  const pwCount = D => ['chevalier', 'mage', 'archer'].reduce((s, c) => s + (Q.unlockedList ? Q.unlockedList(c).length : 0), 0);
  const nodesCount = D => ['chevalier', 'mage', 'archer'].reduce((s, c) => s + Object.values((D.cls[c] || {}).nodes || {}).reduce((a, b) => a + b, 0), 0);
  const ACH = [
    { id: 'a_run', n: 'Premier pas', d: 'Termine ta première course.', rw: 10, ok: D => (D.st.runs || 0) >= 1 },
    { id: 'a_guard', n: 'Tueur de gardiens', d: 'Terrasse un gardien.', rw: 20, title: 'Tueur de gardiens', ok: D => (D.st.guards || 0) >= 1 },
    { id: 'a_win', n: 'L\'Ascension', d: 'Termine une course (étage 15).', rw: 60, title: 'Ascendant', ok: D => D.wins >= 1 },
    { id: 'a_pal3', n: 'Vétéran', d: 'Débloque le palier 4 (bats le palier 3).', rw: 40, title: 'Vétéran', ok: D => D.pal >= 4 },
    { id: 'a_pal6', n: 'Champion', d: 'Débloque le palier 7.', rw: 80, title: 'Champion', ok: D => D.pal >= 7 },
    { id: 'a_pal10', n: 'Légende vivante', d: 'Atteins le palier 10.', rw: 200, title: 'Légende vivante', ok: D => D.pal >= 10 },
    { id: 'a_inf20', n: 'Pas dans le vide', d: 'Atteins l\'étage 20 de l\'Infini.', rw: 40, ok: D => D.inf >= 20 },
    { id: 'a_inf30', n: 'Marcheur de l\'Infini', d: 'Atteins l\'étage 30 de l\'Infini.', rw: 90, title: 'Marcheur de l\'Infini', ok: D => D.inf >= 30 },
    { id: 'a_inf50', n: 'Au-delà', d: 'Atteins l\'étage 50 de l\'Infini.', rw: 200, title: 'Celui qui ne tombe pas', ok: D => D.inf >= 50 },
    { id: 'a_enig5', n: 'Esprit vif', d: 'Résous 5 énigmes de la Citadelle.', rw: 20, ok: D => (D.st.enigmes || 0) >= 5 },
    { id: 'a_enig25', n: 'Maître des mécanismes', d: 'Résous 25 énigmes de la Citadelle.', rw: 80, title: 'Maître des mécanismes', ok: D => (D.st.enigmes || 0) >= 25 },
    { id: 'a_quiz', n: 'Bon élève', d: 'Termine une salle du Savoir sans faute.', rw: 25, ok: D => (D.st.quiz_ok || 0) >= 1 },
    { id: 'a_quiz10', n: 'Major de promo', d: 'Termine 10 salles du Savoir sans faute.', rw: 120, title: 'Major de promo', ok: D => (D.st.quiz_ok || 0) >= 10 },
    { id: 'a_k1k', n: 'Nettoyeur', d: 'Abats 1 000 monstres.', rw: 30, ok: D => (D.st.kills || 0) >= 1000 },
    { id: 'a_k10k', n: 'Fléau des hordes', d: 'Abats 10 000 monstres.', rw: 120, title: 'Fléau des hordes', ok: D => (D.st.kills || 0) >= 10000 },
    { id: 'a_elite', n: 'Chasseur d\'élites', d: 'Abats 100 élites.', rw: 50, title: 'Chasseur d\'élites', ok: D => (D.st.elites || 0) >= 100 },
    { id: 'a_gob', n: 'Chasseur de trésors', d: 'Attrape 10 gobelins voleurs.', rw: 40, title: 'Chasseur de trésors', ok: D => (D.st.gob || 0) >= 10 },
    { id: 'a_leg', n: 'Doigts dorés', d: 'Ouvre un coffre légendaire.', rw: 30, ok: D => (D.st.ch_legendaire || 0) >= 1 },
    { id: 'a_leg10', n: 'Chanceux', d: 'Ouvre 10 coffres légendaires.', rw: 100, title: 'Béni des dieux', ok: D => (D.st.ch_legendaire || 0) >= 10 },
    { id: 'a_col10', n: 'Collectionneur', d: 'Découvre 10 nouveaux pouvoirs (toutes classes).', rw: 30, ok: D => pwCount(D) >= 15 + 10 },
    { id: 'a_col75', n: 'Archiviste', d: 'Découvre les 25 pouvoirs des 3 classes.', rw: 200, title: 'Archiviste', ok: D => pwCount(D) >= 75 },
    { id: 'a_lvch', n: 'Lame de fer', d: 'Chevalier niveau 10.', rw: 40, title: 'Lame de fer', ok: D => lvOf(D, 'chevalier') >= 10 },
    { id: 'a_lvma', n: 'Archimage', d: 'Mage niveau 10.', rw: 40, title: 'Archimage', ok: D => lvOf(D, 'mage') >= 10 },
    { id: 'a_lvar', n: 'Œil de faucon', d: 'Archer niveau 10.', rw: 40, title: 'Œil de faucon', ok: D => lvOf(D, 'archer') >= 10 },
    { id: 'a_tree', n: 'Racines profondes', d: 'Apprends 20 rangs dans les arbres de compétences.', rw: 40, ok: D => nodesCount(D) >= 20 },
    { id: 'a_all3', n: 'Polyvalent', d: 'Termine une course avec chacune des 3 classes.', rw: 120, title: 'Polyvalent', ok: D => D.st.win_chevalier && D.st.win_mage && D.st.win_archer },
    { id: 'a_multi', n: 'Frères d\'armes', d: 'Termine une course entre amis.', rw: 50, title: 'Frère d\'armes', ok: D => (D.st.winmulti || 0) >= 1 },
    { id: 'a_perf', n: 'Insaisissable', d: 'Réussis 30 esquives parfaites dans une même course.', rw: 40, title: 'Insaisissable', ok: D => (D.st.perfmax || 0) >= 30 },
    { id: 'a_gold', n: 'Coffres pleins', d: 'Aie 1 000 pièces d\'or en même temps pendant une course.', rw: 30, ok: D => (D.st.goldmax || 0) >= 1000 },
    { id: 'a_quest', n: 'Homme de parole', d: 'Encaisse 20 contrats du tableau.', rw: 50, title: 'Homme de parole', ok: D => (D.st.quests || 0) >= 20 },
    { id: 'a_wk', n: 'Défi relevé', d: 'Atteins l\'étage 10 d\'un défi de la semaine.', rw: 40, ok: D => (D.wk && D.wk.fl) >= 10 },
    { id: 'a_pk', n: 'Au sommet', d: "Grimpe jusqu'en haut de l'arbre géant du village.", rw: 40, title: 'Grimpeur', ok: D => (D.st.pk_best || 0) > 0 },
    { id: 'a_pk3', n: 'Écureuil', d: "Grimpe l'arbre géant en moins de 3 minutes.", rw: 80, title: 'Écureuil', ok: D => (D.st.pk_best || 0) > 0 && D.st.pk_best <= 1800 },
    { id: 'a_bes', n: 'Érudit', d: 'Révèle tout le savoir sur un monstre.', rw: 30, ok: D => allBeasts().some(B => (D.bes[B.id] || 0) >= B.at[2]) },
    { id: 'a_besall', n: 'Bestiaire complet', d: 'Révèle tout le savoir sur tous les monstres et colosses.', rw: 250, title: 'Maître des bêtes', ok: D => allBeasts().every(B => (D.bes[B.id] || 0) >= B.at[2]) },
  ];
  Q.ACH = ACH;
  // vérifie les succès (et le bestiaire) ; annonce les nouveaux
  Q.checkAch = function (announce) {
    const D = Q.data(), fresh = [];
    for (const A of ACH) if (!D.ach[A.id] && A.ok(D)) { D.ach[A.id] = 1; D.sh += A.rw; fresh.push(A); }
    if (fresh.length) Q.saveData();
    const br = beastRewards();
    if (announce) {
      fresh.forEach((A, i) => setTimeout(() => { UI.toast('Succès : ' + A.n + ' (+' + A.rw + ' éclats)' + (A.title ? ' — titre « ' + A.title + ' »' : ''), 'good'); Au.fx('reveal', { rate: 1.3 }); }, i * 1400));
      if (br.got) setTimeout(() => UI.toast('Bestiaire : nouveau savoir (' + br.lines.slice(0, 3).join(', ') + ') +' + br.got + ' éclats', 'good'), fresh.length * 1400);
    }
    return fresh;
  };
  Q.titleOf = () => { const D = Q.data(), A = ACH.find(x => x.id === D.title); return A && D.ach[A.id] ? A.title : ''; };

  /* =====================================================================
     ÉCRAN : SUCCÈS + BESTIAIRE (avec un petit aperçu 3D du monstre)
     ===================================================================== */
  let viewer = null;
  function killViewer() { if (viewer) { cancelAnimationFrame(viewer.raf); viewer.r.dispose(); viewer.scene.traverse(o => { if (o.material && o.userData.own) o.material.dispose(); }); viewer = null; } }
  function showBeast(host, B) {
    killViewer();
    const src = BR.Assets && BR.Assets.models && BR.Assets.models['asc_m_' + B.id];
    if (!src) { host.innerHTML = `<div class="be-sil" style="--bc:${B.col}">${ICO('crown', 90, B.col)}</div>`; return; }
    host.innerHTML = '';
    const w = host.clientWidth || 300, h = host.clientHeight || 300;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(w, h); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(r.domElement);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xfff0e0, 0x302030, 1.1)); const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(B.col), 1.6); rim.position.set(-4, 3, -3); scene.add(rim);
    const root = src.scene.clone(true); scene.add(root);
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const s = 2.2 / Math.max(size.x, size.y, size.z); root.scale.setScalar(s); root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(B.col), transparent: true, opacity: 0.25 })); disc.rotation.x = -Math.PI / 2; disc.userData.own = true; scene.add(disc);
    cam.position.set(0, 1.4, 4.2); cam.lookAt(0, 1, 0);
    viewer = { r, scene, raf: 0 };
    const t0 = performance.now();
    const loop = () => { if (!viewer || viewer.r !== r) return; const t = (performance.now() - t0) / 1000; root.rotation.y = t * 0.6; r.render(scene, cam); viewer.raf = requestAnimationFrame(loop); };
    loop();
  }
  UI.screen('asc-ach', {
    enter(n, args) {
      BR.curGame = 'arena'; BR.ascMode = true; Q.checkAch(true);
      let tab = (args && args.tab) || 'ach', sel = null;
      const paint = () => {
        killViewer();
        const D = Q.data(), got = ACH.filter(A => D.ach[A.id]).length;
        const head = `<div class="wh-top"><button class="btn ghost back" data-a="back">${ICO('back', 18)}</button><h2>${tab === 'ach' ? 'Succès' : 'Bestiaire'}</h2>
          <div class="me-tabs"><button class="${tab === 'ach' ? 'on' : ''}" data-tab="ach">${ICO('trophy', 15)} Succès <em>${got}/${ACH.length}</em></button><button class="${tab === 'bes' ? 'on' : ''}" data-tab="bes">${ICO('skull', 15)} Bestiaire</button></div></div>`;
        if (tab === 'ach') {
          const titles = ACH.filter(A => A.title && D.ach[A.id]);
          n.innerHTML = `<div class="asc-meta">${head}
            <div class="me-title">Titre porté : <select data-title><option value="">— aucun —</option>${titles.map(A => `<option value="${A.id}" ${D.title === A.id ? 'selected' : ''}>${esc(A.title)}</option>`).join('')}</select></div>
            <div class="ach-grid">${ACH.map(A => { const ok = !!D.ach[A.id]; return `<div class="ach ${ok ? 'on' : ''}"><div class="ach-i">${ICO(ok ? 'trophy' : 'lock', 26)}</div><div><b>${esc(A.n)}</b><span>${esc(A.d)}</span><em>${Q.glyph('univ', 12, '#b9a6ff')} ${A.rw}${A.title ? ' · titre « ' + esc(A.title) + ' »' : ''}</em></div></div>`; }).join('')}</div></div>`;
        } else {
          const L = allBeasts(); sel = sel || L[0].id; const B = L.find(x => x.id === sel), k = D.bes[B.id] || 0;
          n.innerHTML = `<div class="asc-meta">${head}
            <div class="bes">
              <div class="bes-list">${L.map(x => { const kk = D.bes[x.id] || 0; return `<button class="bes-it ${x.id === sel ? 'on' : ''} ${kk ? '' : 'unk'}" data-b="${x.id}" style="--bc:${x.col}"><b>${kk ? esc(x.n) : '???'}</b><span>${BR.fmt(kk)} abattu${kk > 1 ? 's' : ''}</span></button>`; }).join('')}</div>
              <div class="bes-card" style="--bc:${B.col}">
                <div class="bes-view"></div>
                <div class="bes-txt"><h3>${k ? esc(B.n) : '???'}</h3><div class="bes-k">${BR.fmt(k)} abattu${k > 1 ? 's' : ''}</div>
                  ${B.lore.map((l, i) => k >= B.at[i] ? `<p>${esc(l)}</p>` : `<p class="lk">${ICO('lock', 13)} Abats-en ${B.at[i]} pour révéler ce savoir (+${BES_RW[i]} éclats).</p>`).join('')}</div>
              </div>
            </div></div>`;
          const v = n.querySelector('.bes-view'); if (v && k) setTimeout(() => showBeast(v, B), 30); else if (v) v.innerHTML = `<div class="be-sil" style="--bc:#444">${ICO('skull', 90, '#555')}</div>`;
        }
      };
      paint();
      n.onclick = e => {
        if (e.target.closest('[data-a=back]')) { Au.ui('back'); UI.show('asc'); return; }
        const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; Au.ui('click'); paint(); return; }
        const b = e.target.closest('[data-b]'); if (b) { sel = b.dataset.b; Au.ui('click'); paint(); }
      };
      n.onchange = e => { const s = e.target.closest('[data-title]'); if (!s) return; const D = Q.data(); D.title = s.value; Q.saveData(); Au.ui('ok'); UI.toast(s.value ? 'Titre porté : ' + Q.titleOf() : 'Titre retiré', 'good'); };
    },
    leave() { killViewer(); },
  });

  /* =====================================================================
     ÉCRAN : DÉFI DE LA SEMAINE + L'INFINI (classements entre joueurs du serveur)
     ===================================================================== */
  const fmtT = s => { s = s | 0; return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0'); };
  UI.screen('asc-chal', {
    enter(n) {
      BR.curGame = 'arena'; BR.ascMode = true;
      let lb = null, lbErr = false;
      const paint = () => {
        const D = Q.data(), C = Q.weekChallenge(), mine = D.wk && D.wk.key === C.key ? D.wk : null;
        const end = new Date(C.key + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 7); const left = Math.max(0, end - Date.now()), dd = Math.floor(left / 864e5), hh = Math.floor(left % 864e5 / 36e5);
        const list = (rows, kind) => rows && rows.length ? `<ol class="lbl">${rows.slice(0, 12).map((r, i) => `<li class="${r.name === (BR.Account.p && BR.Account.p.name) ? 'me' : ''}"><b>${i + 1}</b><span>${esc(r.name)}</span><em>étage ${r.fl}${kind === 'wk' && r.t ? ' · ' + fmtT(r.t) : ''}</em></li>`).join('')}</ol>`
          : `<p class="muted tiny">${lbErr ? 'Classement indisponible (serveur hors ligne ou pas encore à jour).' : lb ? 'Personne encore : sois le premier !' : 'Chargement du classement…'}</p>`;
        n.innerHTML = `<div class="asc-meta">
          <div class="wh-top"><button class="btn ghost back" data-a="back">${ICO('back', 18)}</button><h2>Défi de la semaine</h2></div>
          <div class="ch-wrap">
            <div class="ch-card">
              <div class="ch-h"><small>Semaine du ${C.key.split('-').reverse().join('/')}</small><b>La même course pour tout le monde</b><span>Mêmes étages, mêmes portes. Va le plus haut possible : le classement compte l'étage atteint, puis le temps. Se termine dans ${dd} j ${hh} h.</span></div>
              <div class="ch-mods">${C.mods.map(m => `<div class="ch-mod"><b>${esc(Q.CHAL_MODS[m].n)}</b><span>${esc(Q.CHAL_MODS[m].d)}</span></div>`).join('')}</div>
              <div class="ch-me">Ton record cette semaine : <b>${mine && mine.fl ? 'étage ' + mine.fl + (mine.t ? ' en ' + fmtT(mine.t) : '') : 'aucun'}</b></div>
              <button class="btn primary big" data-a="go">${ICO('play', 16)} Lancer le défi</button>
              <p class="muted tiny">En solo, avec ta classe et ton build du Maître d'armes. Le palier est fixé à 0 pour que tout le monde ait la même course.</p>
            </div>
            <div class="ch-lb"><h4>Classement de la semaine</h4>${list(lb && lb.wk, 'wk')}</div>
            <div class="ch-lb inf"><h4>L'Infini — records</h4><div class="ch-me">Ton record : <b>${D.inf ? 'étage ' + D.inf : 'aucun'}</b></div>${list(lb && lb.inf, 'inf')}<p class="muted tiny">Termine une Ascension (étage 15) puis choisis le portail de l'Infini.</p></div>
          </div></div>`;
      };
      paint();
      if (N && N.api) N.api('/api/leaderboard', { retries: 1, timeout: 20000 }).then(j => { lb = (j && j.asc) || null; if (!lb) lbErr = true; if (n.isConnected) paint(); }).catch(() => { lbErr = true; if (n.isConnected) paint(); });
      else lbErr = true;
      n.onclick = e => {
        if (e.target.closest('[data-a=back]')) { Au.ui('back'); UI.show('asc'); return; }
        if (e.target.closest('[data-a=go]')) {
          if (!Q.data().sel.cls) { UI.toast('Choisis d\'abord ta classe chez le Maître d\'armes !'); UI.show('asc-armory'); return; }
          Au.ui('ok'); Q.startChallenge();
        }
      };
    },
  });
})();

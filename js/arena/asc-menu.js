/* ===== arena/asc-menu.js : menus de « COLOSSES : L'ASCENSION » (accueil du jeu, autel des âmes, salon, maître d'armes en 3D) ===== */
(function () {
  const BR = window.BR, AR = BR.ARENA, UI = BR.UI, Au = BR.Audio, N = BR.Net, Acc = BR.Account, el = BR.el, esc = BR.esc;
  const Q = BR.Asc, AU = BR.ArenaUI;
  const ICO = (n, sz, c) => BR.Icons.svg(n, sz, c);
  let preview = null; const killPreview = () => { if (preview) { preview.dispose(); preview = null; } };

  /* ---------- accueil du jeu : le village 3D (js/arena/village.js) ---------- */
  UI.screen('asc', {
    enter(n) {
      BR.curGame = 'arena'; BR.ascMode = true;
      if (Q.running) Q.leave();
      if (BR.ArenaUI) BR.ArenaUI.bg(false); BR.MenuBG.stop();
      n.innerHTML = `<div class="vil">
        <div class="vil-top"><div class="vil-logo"><small>C O L O S S E S</small><b>L'ASCENSION</b></div><div class="vil-stats"></div></div>
        <div class="vil-help"><b>Le village</b><span>${(() => { const L = BR.Keys ? BR.Keys.label : (x => x); return `<b>${['up', 'left', 'down', 'right'].map(L).join(' ')}</b> marcher · <b>${L('dash')}</b> courir · <b>${L('jump')}</b> sauter (double saut en l'air) · <b>clic + glisser</b> caméra · <b>molette</b> zoom · <b>${L('interact')}</b> interagir · <b>${L('chat')}</b> discuter · <b>${['em1', 'em2', 'em3', 'em4'].map(L).join(' ')}</b> émotes · <b>${L('respawn')}</b> dernier repère (Arbre-Monde) · touches modifiables dans les paramètres`; })()}</span></div>
        <div class="vil-quick">
          <button data-v="portal">${Q.glyph('univ', 15, '#ffd76a')} Jouer seul</button><button data-v="board">${ICO('users', 15)} Entre amis</button><button data-v="multi">${ICO('door', 15)} Rejoindre</button>
          <button data-v="armory">${ICO('target', 15)} Classe &amp; build</button><button data-v="tree">${Q.glyph('univ', 15, '#7dffb0')} Arbre de compétences</button><button data-v="chal">${ICO('bolt', 15)} Défi de la semaine</button><button data-v="ach">${ICO('trophy', 15)} Succès &amp; bestiaire</button><button data-v="quests" class="vq-quests">${ICO('trophy', 15)} Contrats${Q.questsReady && Q.questsReady() ? ` <em>${Q.questsReady()}</em>` : ''}</button><button data-v="stall">${ICO('shirt', 15)} Personnage</button><button data-v="wheel">${Q.glyph('univ', 15, '#b9a6ff')} Autel des âmes</button><button data-v="sign">${ICO('back', 15)} Autres jeux</button>
        </div>
        <div class="vil-prompt"></div></div>`;
      const paint = () => {
        const D = Q.data(), pal = Q.selPal();
        n.querySelector('.vil-stats').innerHTML = `<div><span>Palier</span><b style="color:${Q.palCol(pal)}">${pal}</b></div><div><span>Record</span><b>${D.best[pal] || 0}/${Q.FLOORS}</b></div><div><span>Éclats</span><b>${Q.glyph('univ', 14, '#b9a6ff')} ${D.sh}</b></div><div><span>Victoires</span><b>${D.wins}</b></div>${D.inf ? `<div><span>Infini</span><b>${D.inf}</b></div>` : ''}${Q.titleOf && Q.titleOf() ? `<div class="vs-title"><span>Titre</span><b>${esc(Q.titleOf())}</b></div>` : ''}`;
      };
      paint();
      if (Q.checkAch) setTimeout(() => Q.checkAch(true), 1200);
      n.querySelector('.vil-quick').addEventListener('click', e => {
        const b = e.target.closest('[data-v]'); if (!b) return; Au.ui('click');
        if (b.dataset.v === 'multi') { UI.show('multi'); return; }
        if (b.dataset.v === 'quests') { UI.show('asc-quests'); return; }
        if (b.dataset.v === 'chal') { UI.show('asc-chal'); return; }
        if (b.dataset.v === 'ach') { UI.show('asc-ach'); return; }
        if ((b.dataset.v === 'armory' || b.dataset.v === 'tree') && !(BR.Village.hasSpot && BR.Village.hasSpot(b.dataset.v))) { UI.show(b.dataset.v === 'armory' ? 'asc-armory' : 'asc-tree'); return; }
        BR.Village.act(b.dataset.v);
      });
      try { BR.Village.start(n.querySelector('.vil')); BR.Village.onChange = paint; }
      catch (err) { console.error('village', err); }
    },
    leave() { BR.Village.stop(); },
  });
  // salon privé (jusqu'à 4) au palier choisi
  Q.friends = function () {
    BR.curGame = 'arena'; BR.ascMode = true; UI.show('multi');
    const go = () => { N.create({ name: Acc.p.name + ' — ascension', map: 'a_asc', diff: 'p' + Q.selPal(), max: 4, priv: true }); UI.toast('Salon créé : donne le code à tes amis !', 'good'); };
    if (N.status === 'on') go(); else { UI.toast('Connexion au serveur… le salon sera créé dès que possible.'); N.connect().then(go).catch(() => UI.toast('Serveur injoignable.', 'error')); }
  };
  // encart du salon (à la place de l'équipement de Colosses)
  Q.lobbyBox = function () {
    const r = N.room, p = r && /^p\d+$/.test(r.diff || '') ? +r.diff.slice(1) : 0;
    return el('div', { class: 'ar-kit asc-lb', html: `<div class="ak-h"><b>L'Ascension</b><span style="color:${Q.palCol(p)}">${Q.PALIERS[p].n}</span></div>
      <p class="muted tiny">Chacun part avec la classe et le build choisis chez le Maître d'armes du village (sinon : Chevalier de base). Les bénédictions de groupe (relever plus vite, cri de guerre…) se débloquent à l'autel des âmes.</p>
      <p class="muted tiny">La Citadelle : une salle sur deux pleine de monstres ; entre deux, des énigmes (leviers, clés, gouffres, engrenages…) et des salles du Savoir (questions de GMP) à résoudre ensemble.</p>
      <p class="muted tiny">Un joueur à terre se relève si un allié reste près de lui. Si tout le monde tombe : fin de la course.</p>` });
  };

  /* ---------- les cartes : de la Grotte (facile) au Néant ; chacune se débloque en terminant la précédente ---------- */
  UI.screen('asc-maps', {
    enter(n) {
      BR.curGame = 'arena'; BR.ascMode = true;
      const DGm = BR.Dungeon, D = Q.data(), done = (D.st && D.st.mapmax) || 0;
      let sel = Q.selMap();
      const paint = () => {
        n.innerHTML = `<div class="asc-maps"><div class="am-top"><button class="btn ghost back" data-a="back">${ICO('back', 18)}</button><h2>Choisis ton donjon</h2><span class="muted">Termine une carte pour débloquer la suivante</span></div>
          <div class="am-list">${DGm.MAPS.map(Mp => { const open = Mp.lvl <= done + 1, fin = Mp.lvl <= done;
            return `<button class="am-c ${open ? '' : 'lock'} ${sel === Mp.id ? 'on' : ''}" data-m="${Mp.id}" style="--mc:${Mp.col}" ${open ? '' : 'disabled'}>
              <div class="am-lv">CARTE ${Mp.lvl}</div><b>${esc(Mp.n)}</b><p>${esc(Mp.d)}</p>
              <div class="am-diff">${'<i></i>'.repeat(Mp.lvl)}${'<i class="off"></i>'.repeat(5 - Mp.lvl)}<span>×${Mp.diff} vie des monstres</span></div>
              <div class="am-st">${!open ? ICO('lock', 14) + ' Termine la carte ' + (Mp.lvl - 1) : fin ? ICO('check', 14) + ' Terminée' : 'À conquérir'}</div></button>`; }).join('')}</div>
          <div class="am-go"><button class="btn primary big" data-a="go">${ICO('play', 18)} Partir : ${esc(DGm.mapOf(sel).n)}</button><span class="muted tiny">En salon avec tes amis, c'est la carte choisie par l'hôte qui compte.</span></div></div>`;
      };
      paint();
      n.onclick = e => {
        if (e.target.closest('[data-a=back]')) { Au.ui('back'); UI.show('asc'); return; }
        const c = e.target.closest('[data-m]'); if (c && !c.disabled) { sel = c.dataset.m; BR.store.set('br_asc_map', sel); Au.ui('click'); paint(); return; }
        if (e.target.closest('[data-a=go]')) { BR.store.set('br_asc_map', sel); Au.ui('ok'); Q._goMap = sel; UI.show('asc'); }
      };
    },
  });

  /* ---------- autel des âmes : une roue à tourner ----------
     Chaque tour coûte des éclats et débloque au hasard un bonus permanent encore incomplet (le niveau suivant). Rien à lire avant : on tourne, on découvre. */
  const spinCost = D => 30 + 4 * Q.UNLOCKS.reduce((n, U) => n + (D.u[U.id] || 0), 0);   // 105 niveaux : de 30 à ~450 éclats le tour
  const famCol = U => (Q.FAM[U.fam] || Q.FAM.univ).col;
  UI.screen('asc-altar', {
    enter(n) {
      BR.curGame = 'arena'; BR.ascMode = true;
      let rot = 0, spinning = false;
      const left = D => Q.UNLOCKS.filter(U => (D.u[U.id] || 0) < U.cost.length);
      const wheelSvg = list => {
        const N = Math.max(1, list.length), R0 = 200, out = [];
        list.forEach((U, i) => {
          const a0 = (i / N) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / N) * Math.PI * 2 - Math.PI / 2, am = (a0 + a1) / 2;
          const P = a => `${(210 + Math.cos(a) * R0).toFixed(1)},${(210 + Math.sin(a) * R0).toFixed(1)}`;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          out.push(`<path d="M210,210 L${P(a0)} A${R0},${R0} 0 ${large} 1 ${P(a1)} Z" fill="${famCol(U)}" fill-opacity="${i % 2 ? 0.34 : 0.5}" stroke="#0b0a12" stroke-width="3"/>`);
          const gx = 210 + Math.cos(am) * 135, gy = 210 + Math.sin(am) * 135;
          out.push(`<g transform="translate(${gx.toFixed(1)},${gy.toFixed(1)}) rotate(${(am * 180 / Math.PI + 90).toFixed(1)})"><foreignObject x="-22" y="-22" width="44" height="44"><div xmlns="http://www.w3.org/1999/xhtml" class="wh-g">${Q.glyph(U.fam, 40, '#fff')}</div></foreignObject></g>`);
        });
        if (!list.length) out.push('<circle cx="210" cy="210" r="200" fill="#ffd76a" fill-opacity="0.25"/>');
        return `<svg viewBox="0 0 420 420" class="wh-svg">${out.join('')}<circle cx="210" cy="210" r="203" fill="none" stroke="#ffd76a" stroke-width="6"/><circle cx="210" cy="210" r="54" fill="#14111e" stroke="#ffd76a" stroke-width="5"/></svg>`;
      };
      const paint = (res, list, rot0) => {
        const D = Q.data(), L = list || left(D), cost = spinCost(D), can = !spinning && left(D).length && D.sh >= cost;
        n.innerHTML = `<div class="asc-wheel">
          <div class="wh-top"><button class="btn ghost back" data-a="back">${ICO('back', 18)}</button><h2>Autel des âmes</h2><div class="pts">${Q.glyph('univ', 20, '#b9a6ff')} <b>${D.sh}</b> éclats</div></div>
          <div class="wh-main">
            <div class="wh-wheel"><div class="wh-ptr"></div><div class="wh-rot" style="transform:rotate(${rot0 != null ? rot0 : rot}deg)">${wheelSvg(L)}</div><div class="wh-hub">${Q.glyph('univ', 46, '#ffd76a')}</div></div>
            <div class="wh-side">
              ${res ? `<div class="wh-res" style="--fc:${famCol(res.U)}"><div class="wh-res-i">${Q.glyph(res.U.fam, 84)}</div><small>${res.U.cost.length > 1 ? 'Niveau ' + res.lv + ' / ' + res.U.cost.length : 'Débloqué !'}</small><b>${esc(res.U.n)}</b><p>${esc(res.U.d)}</p></div>`
                : `<div class="wh-pitch"><b>Tente ta chance</b><p>Chaque tour débloque <b>pour toujours</b> un bonus au hasard : nouvelles bénédictions, or de départ, vie en plus, seconde chance…</p></div>`}
              ${L.length ? `<button class="btn primary big wh-go" data-a="spin" ${can ? '' : 'disabled'}>${spinning ? 'La roue tourne…' : `TOURNER · ${Q.glyph('univ', 16, '#fff')} ${cost}`}</button>${!can && !spinning ? `<span class="muted tiny">Il te manque ${cost - D.sh} éclats : joue une course pour en gagner.</span>` : ''}`
                : `<div class="wh-done">${ICO('check', 18)} Tu as tout débloqué !</div>`}
            </div>
          </div>
          <div class="wh-col">${Q.UNLOCKS.map(U => { const lv = D.u[U.id] || 0, mx = U.cost.length; return `<div class="wh-c ${lv ? 'on' : ''}" style="--fc:${famCol(U)}" title="${esc(U.n)} : ${esc(U.d)}">${Q.glyph(U.fam, 26, lv ? null : '#555')}${mx > 1 ? `<i>${lv}/${mx}</i>` : lv ? `<i>${ICO('check', 10)}</i>` : ''}</div>`; }).join('')}</div>
        </div>`;
      };
      paint();
      n.onclick = e => {
        const bk = e.target.closest('[data-a=back]'); if (bk) { if (spinning) return; Au.ui('back'); UI.show('asc'); return; }
        const sp = e.target.closest('[data-a=spin]'); if (!sp || sp.disabled || spinning) return;
        const D = Q.data(), L = left(D), cost = spinCost(D); if (!L.length || D.sh < cost) return;
        // tirage, débit et sauvegarde tout de suite (fermer la page pendant l'animation ne fait rien perdre)
        const i = Math.floor(Math.random() * L.length), U = L[i], lv = (D.u[U.id] || 0) + 1;
        D.sh -= cost; D.u[U.id] = lv; Q.saveData();
        spinning = true; Au.ui('click');
        const N = L.length, seg = 360 / N, mod = (x, m) => ((x % m) + m) % m;
        const from = rot; rot = rot - mod(rot, 360) + 360 * 6 + mod(-(i + 0.5) * seg + (Math.random() - 0.5) * seg * 0.6, 360);
        paint(null, L, from);
        const wr = n.querySelector('.wh-rot'); void wr.offsetWidth;
        wr.style.transition = 'transform 4.2s cubic-bezier(0.12, 0.7, 0.08, 1)'; wr.style.transform = `rotate(${rot}deg)`;
        let tk = 0; const tick = () => { if (!spinning) return; tk++; Au.ui('hover'); setTimeout(tick, 40 + tk * tk * 1.6); }; tick();
        setTimeout(() => { spinning = false; Au.fx('reveal', { rate: 1.2 }); Au.ui('ok'); paint({ U, lv }, L); const r2 = n.querySelector('.wh-res'); if (r2) r2.classList.add('pop'); }, 4300);
      };
    },
  });

  /* =====================================================================
     MAÎTRE D'ARMES (au village) : choisir sa CLASSE et son BUILD (4 pouvoirs + 1 ultime), dans la salle d'armes en 3D.
     - la salle : modèle Blender (outils/blender-armory.py -> assets-armory.js, clé arm_hall) ; sans lui, une salle simple
     - les 3 héros sur leurs estrades (KayKit) ; survol = lueur ; clic = la caméra s'approche et le héros fait une démonstration
     - le héros de la classe choisie porte l'apparence du joueur (Acc.p.look)
     - les pouvoirs : cartes lumineuses flottant devant la caméra ; ceux pas encore trouvés en course restent mystérieux
     - le choix est gardé dans le profil (D.sel) ; la course démarre directement avec
     ===================================================================== */
  const AV3 = THREE.Vector3;
  const lin = c => new THREE.Color(c).convertSRGBToLinear();
  const ARM_CLS = ['chevalier', 'mage', 'archer'];
  const ARM_LOOK = { chevalier: 'survivor', mage: 'mage', archer: 'rogue' };          // héros « de vitrine » des classes
  const ARM_SPOT = { chevalier: [-3.4, -3.0], mage: [0, -3.9], archer: [3.4, -3.0] };   // estrades (secours si la salle Blender manque)
  const ARM_TOP = 0.42, CARD_D = 1.2, CARD_AR = 256 / 360;
  const RAR_T = { commun: 0, rare: 1, epique: 2, legendaire: 3 };
  const KEYS = () => AR.KEYS.skills.map(k => AR.key(k)).concat([AR.key(AR.KEYS.ult)]);

  /* ---------- petits outils de dessin (cartes, emplacements, bannières) ---------- */
  const armIcons = {};
  function armIcon(id, cb) {
    let e = armIcons[id];
    if (!e) { e = armIcons[id] = { img: new Image(), ok: false, cbs: [] }; e.img.onload = () => { e.ok = true; e.cbs.splice(0).forEach(f => f()); }; e.img.src = AR.icon(id, 128); }
    if (e.ok) return e.img;
    if (cb) e.cbs.push(cb);
    return null;
  }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const hexMix = (a, b, t) => { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const c = [16, 8, 0].map(s => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t)); return `rgb(${c[0]},${c[1]},${c[2]})`; };
  function wrapLines(g, text, maxW, maxL) {
    const out = []; let cur = '';
    for (const w of String(text).split(' ')) { const t = cur ? cur + ' ' + w : w; if (!cur || g.measureText(t).width <= maxW) cur = t; else { out.push(cur); cur = w; } }
    if (cur) out.push(cur);
    if (out.length > maxL) { out.length = maxL; out[maxL - 1] += '…'; }
    return out;
  }
  function padlock(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s, s); g.lineWidth = 7; g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-15, 4); g.lineTo(-15, -10); g.arc(0, -10, 15, Math.PI, 0); g.lineTo(15, 4); g.stroke();
    rrect(g, -25, 0, 50, 38, 8); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(0, 15, 5.5, 0, 7); g.fill(); g.fillRect(-2.5, 17, 5, 11);
    g.restore();
  }
  /** carte d'un pouvoir (256×360, avec une marge pour la lueur de rareté) ; o = { id, cls, locked, badge, img } */
  function drawCard(c, o) {
    const g = c.getContext('2d'), W = c.width, H = c.height, s = AR.skill(o.id), T = RAR_T[s.rarity] || 0;
    const R = BR.RARITY[s.rarity] || BR.RARITY.commun, rc = R.color, M = 16, x = M, y = M, w = W - 2 * M, h = H - 2 * M;
    g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.shadowColor = rc; g.shadowBlur = o.locked ? 9 : 12 + T * 5; g.fillStyle = '#0b0a10'; rrect(g, x, y, w, h, 20); g.fill(); g.restore();
    const bg = g.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, o.locked ? '#1d1a25' : hexMix(rc, '#14111c', 0.74)); bg.addColorStop(0.55, o.locked ? '#121018' : '#100d16'); bg.addColorStop(1, '#08070b');
    g.fillStyle = bg; rrect(g, x, y, w, h, 20); g.fill();
    g.lineWidth = 4 + T; g.strokeStyle = o.locked ? hexMix(rc, '#000000', 0.42) : rc; rrect(g, x + 2, y + 2, w - 4, h - 4, 18); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.13)'; rrect(g, x + 9, y + 9, w - 18, h - 18, 13); g.stroke();
    // rareté
    g.font = '700 19px Oswald, "Arial Narrow", sans-serif'; g.fillStyle = o.locked ? hexMix(rc, '#000000', 0.15) : rc;
    g.fillText(R.label.toUpperCase(), W / 2, y + 27);
    // icône (pas encore découverte : silhouette sombre et désaturée + cadenas)
    const isz = w - 52, ix = (W - isz) / 2, iy = y + 44;
    if (o.img) {
      g.drawImage(o.img, ix, iy, isz, isz);
      if (o.locked) {
        g.save(); rrect(g, ix, iy, isz, isz, 24); g.clip();
        g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(ix, iy, isz, isz);
        g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(8,7,12,0.8)'; g.fillRect(ix, iy, isz, isz);
        g.restore();
      }
    } else { g.fillStyle = 'rgba(255,255,255,0.05)'; rrect(g, ix, iy, isz, isz, 24); g.fill(); }
    if (o.locked) { g.save(); g.shadowColor = rc; g.shadowBlur = 20; padlock(g, W / 2, iy + isz / 2 - 8, 1.25, hexMix(rc, '#ffffff', 0.35)); g.restore(); }
    // nom
    const ny = iy + isz + 18;
    if (o.locked) {
      g.font = '700 30px Oswald, "Arial Narrow", sans-serif'; g.fillStyle = '#d9d2e6'; g.fillText('? ? ?', W / 2, ny + 12);
      g.font = '600 17px Inter, Arial, sans-serif'; g.fillStyle = 'rgba(236,226,206,0.72)'; g.fillText('À découvrir', W / 2, ny + 42); g.fillText('dans les coffres', W / 2, ny + 63);
    } else {
      g.font = '600 29px Oswald, "Arial Narrow", sans-serif'; g.fillStyle = '#ffffff';
      const lines = wrapLines(g, Q.skillName(o.id, o.cls), w - 22, 2);
      lines.forEach((ln, i) => g.fillText(ln, W / 2, ny + 16 + i * 33 + (lines.length === 1 ? 14 : 0)));
    }
    // badge : la touche où ce pouvoir est équipé
    if (o.badge) {
      const bx = x + w - 22, by = y + 24;
      g.save(); g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8; g.fillStyle = '#ffd76a'; g.beginPath(); g.arc(bx, by, 21, 0, 7); g.fill(); g.restore();
      g.fillStyle = '#1b1505'; g.font = '800 23px Inter, Arial, sans-serif'; g.fillText(o.badge, bx, by + 1);
    }
  }
  /** emplacement du build (256×256) ; o = { id, key, ult, active, img } */
  function drawSlot(c, o) {
    const g = c.getContext('2d'), W = c.width, m = 20, x = m, y = m + 4, w = W - 2 * m, r = o.ult ? 46 : 26;
    g.clearRect(0, 0, W, W); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.shadowColor = o.active ? '#ffd76a' : 'rgba(0,0,0,0.9)'; g.shadowBlur = o.active ? 24 : 12; g.fillStyle = '#100d0a'; rrect(g, x, y, w, w - 4, r); g.fill(); g.restore();
    const bg = g.createRadialGradient(W / 2, W / 2, 8, W / 2, W / 2, w * 0.72); bg.addColorStop(0, '#2c251c'); bg.addColorStop(1, '#0d0b08');
    g.fillStyle = bg; rrect(g, x, y, w, w - 4, r); g.fill();
    if (o.img) { const p = o.ult ? 26 : 20; g.save(); rrect(g, x + p, y + p, w - 2 * p, w - 4 - 2 * p, o.ult ? 30 : 18); g.clip(); g.drawImage(o.img, x + p, y + p - 2, w - 2 * p, w - 2 * p); g.restore(); }
    g.lineWidth = o.active ? 9 : 5; g.strokeStyle = o.active ? '#ffd76a' : o.ult ? '#c9a24a' : '#7d6c4c'; rrect(g, x + 3, y + 3, w - 6, w - 10, r - 3); g.stroke();
    if (o.ult) { g.fillStyle = o.active ? '#ffe9a8' : '#c9a24a'; for (const [px, py] of [[W / 2, y + w - 6], [x + 2, y + w / 2], [x + w - 2, y + w / 2]]) { g.beginPath(); g.moveTo(px, py - 12); g.lineTo(px + 12, py); g.lineTo(px, py + 12); g.lineTo(px - 12, py); g.closePath(); g.fill(); } }
    const kx = W / 2, ky = y + 1;
    g.fillStyle = o.active ? '#ffd76a' : '#e8d9b0'; rrect(g, kx - 27, ky - 17, 54, 34, 9); g.fill();
    g.fillStyle = '#1b1505'; g.font = '800 24px Inter, Arial, sans-serif'; g.fillText(o.key, kx, ky + 1);
  }
  /** bannière d'une classe (couleur, galons dorés, emblème) */
  function bannerCanvas(cls) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const g = c.getContext('2d'), col = Q.CLASSES[cls].col, W = 256, H = 512, cut = 74;
    const shape = (k) => { g.beginPath(); g.moveTo(k, 0); g.lineTo(W - k, 0); g.lineTo(W - k, H - k * 1.2); g.lineTo(W / 2, H - cut - k * 0.4); g.lineTo(k, H - k * 1.2); g.closePath(); };
    shape(0); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, hexMix(col, '#000000', 0.3)); gr.addColorStop(1, hexMix(col, '#000000', 0.68)); g.fillStyle = gr; g.fill();
    g.lineJoin = 'round'; shape(10); g.lineWidth = 8; g.strokeStyle = '#e8b440'; g.stroke();
    shape(24); g.lineWidth = 3; g.strokeStyle = 'rgba(255,226,150,0.55)'; g.stroke();
    g.fillStyle = '#e8b440'; g.fillRect(0, 0, W, 30); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 26, W, 6);
    // médaillon + emblème
    const cx = W / 2, cy = 222;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(cx, cy, 86, 0, 7); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#e8b440'; g.beginPath(); g.arc(cx, cy, 86, 0, 7); g.stroke();
    g.fillStyle = '#ffe9b0'; g.strokeStyle = '#ffe9b0'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.save(); g.translate(cx, cy);
    if (cls === 'chevalier') {
      g.fillRect(-6, -70, 12, 118); g.fillRect(-30, 30, 60, 10); g.fillRect(-5, 40, 10, 20); g.beginPath(); g.arc(0, 64, 8, 0, 7); g.fill();
      g.beginPath(); g.moveTo(-6, -70); g.lineTo(0, -84); g.lineTo(6, -70); g.fill();
      g.fillStyle = hexMix(col, '#000000', 0.2); g.lineWidth = 6;
      g.beginPath(); g.moveTo(0, -46); g.lineTo(40, -32); g.quadraticCurveTo(38, 14, 0, 42); g.quadraticCurveTo(-38, 14, -40, -32); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, -34); g.lineTo(0, 30); g.moveTo(-26, -18); g.lineTo(26, -18); g.stroke();
    } else if (cls === 'mage') {
      g.lineWidth = 8; g.beginPath(); g.moveTo(-34, 70); g.lineTo(26, -40); g.stroke();
      g.beginPath(); g.arc(30, -48, 15, 0, 7); g.fill();
      const star = (sx, sy, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.42 : r; g.lineTo(sx + Math.cos(a) * rr2, sy + Math.sin(a) * rr2); } g.closePath(); g.fill(); };
      star(-22, -26, 30); star(36, 26, 14); star(-44, 30, 9);
      g.beginPath(); g.arc(14, -6, 26, 0.9, 4.0); g.arc(4, -14, 20, 3.6, 1.1, true); g.closePath(); g.globalAlpha = 0.8; g.fill(); g.globalAlpha = 1;
    } else {
      g.lineWidth = 7; g.beginPath(); g.arc(-62, 0, 78, -0.95, 0.95); g.stroke();
      g.lineWidth = 2.5; g.beginPath(); g.moveTo(-62 + Math.cos(-0.95) * 78, Math.sin(-0.95) * 78); g.lineTo(-62 + Math.cos(0.95) * 78, Math.sin(0.95) * 78); g.stroke();
      g.lineWidth = 6; g.beginPath(); g.moveTo(-40, 0); g.lineTo(56, 0); g.stroke();
      g.beginPath(); g.moveTo(70, 0); g.lineTo(48, -13); g.lineTo(48, 13); g.closePath(); g.fill();
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-40, 0); g.lineTo(-56, s * 14); g.lineTo(-30, s * 2); g.closePath(); g.fill(); }
    }
    g.restore();
    // franges dorées en bas
    g.strokeStyle = '#e8b440'; g.lineWidth = 3;
    for (let i = 0; i <= 12; i++) { const fx = 10 + i * (W - 20) / 12, fy = fx < W / 2 ? H - 12 - (fx / (W / 2)) * (cut - 2) : H - 12 - ((W - fx) / (W / 2)) * (cut - 2); g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy + 10); g.stroke(); }
    return c;
  }
  let glowTexC = null;
  function glowCanvas() {
    if (glowTexC) return glowTexC;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (glowTexC = c);
  }
  // arme d'une classe : copie du nœud KayKit (enfant d'un « handslot ») + son extrémité (bout du bâton, de l'arbalète)
  const armWeap = {};
  function armWeapon(model, node) {
    const k = model + '/' + node; if (armWeap[k] !== undefined) return armWeap[k];
    const g = BR.Assets.models[model]; let f = null; if (g) g.scene.traverse(o => { if (!f && o.name === node) f = o; });
    if (!f) return (armWeap[k] = null);
    const tmp = f.clone(true); tmp.position.set(0, 0, 0); tmp.quaternion.identity(); tmp.scale.set(1, 1, 1); tmp.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tmp), size = box.getSize(new AV3()), c = box.getCenter(new AV3());
    const ax = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z', a = c.clone(), b = c.clone(); a[ax] = box.min[ax]; b[ax] = box.max[ax];
    return (armWeap[k] = { node: f, tip: a.length() > b.length() ? a : b });
  }
  // fusion d'une liste de géométries (repère final + couleur par sommet) : une poignée d'appels de dessin pour toute la salle
  function armMerge(list, withColor) {
    let nv = 0, ni = 0; list.forEach(p => { const c = p.geo.attributes.position.count; nv += c; ni += p.geo.index ? p.geo.index.count : c; });
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = withColor ? new Float32Array(nv * 3) : null, idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const v = new AV3(), nm = new THREE.Matrix3(); let ov = 0, oi = 0;
    list.forEach(p => {
      const pa = p.geo.attributes.position, na = p.geo.attributes.normal, n = pa.count; nm.getNormalMatrix(p.m4);
      for (let i = 0; i < n; i++) {
        const j = (ov + i) * 3;
        v.fromBufferAttribute(pa, i).applyMatrix4(p.m4); pos[j] = v.x; pos[j + 1] = v.y; pos[j + 2] = v.z;
        if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nrm[j] = v.x; nrm[j + 1] = v.y; nrm[j + 2] = v.z; } else nrm[j + 1] = 1;
        if (col) { col[j] = p.col.r; col[j + 1] = p.col.g; col[j + 2] = p.col.b; }
      }
      if (p.geo.index) { const ix = p.geo.index; for (let i = 0; i < ix.count; i++) idx[oi + i] = ix.getX(i) + ov; oi += ix.count; }
      else { for (let i = 0; i < n; i++) idx[oi + i] = ov + i; oi += n; }
      ov += n;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    return g;
  }

  /* ---------- la scène et l'écran ---------- */
  let ARM = null;
  function armory(n) {
    const D0 = Q.data(), CL = Q.CLASSES;
    const q = (BR.settings && BR.settings.quality) || 'high', low = q === 'low';
    const st = { cls: CL[D0.sel.cls] ? D0.sel.cls : null, slot: 0, tab: 'skill', builds: {}, view: 'hall', hovCls: null, hov: null, unl: {}, leaving: false };
    if (st.cls) st.builds[st.cls] = { kit: D0.sel.kit.slice(), ult: D0.sel.ult };
    const unlocked = cls => (st.unl[cls] = st.unl[cls] || new Set(Q.unlockedList(cls)));
    // build valide : 4 pouvoirs distincts + 1 ultime, pris uniquement parmi les pouvoirs débloqués de la classe
    const buildOf = cls => {
      const C = CL[cls], b = st.builds[cls] || (st.builds[cls] = { kit: [], ult: null }), U = unlocked(cls);
      const ok = (id, t) => { const s = id && AR.skill(id); return s && s.type === t && U.has(id) ? id : null; };
      const k = (b.kit || []).map(id => ok(id, 'skill')).filter((id, i, a) => id && a.indexOf(id) === i);
      for (const id of C.kit) if (k.length < 4 && !k.includes(id)) k.push(id);
      b.kit = k.slice(0, 4); b.ult = ok(b.ult, 'ult') || C.ult;
      return b;
    };
    const lvOf = cls => { try { return Q.clsLevel ? Q.clsLevel(((Q.data().cls || {})[cls] || {}).xp || 0) : null; } catch (e) { return null; } };

    n.innerHTML = `<div class="amr hall">
      <canvas class="amr-gl"></canvas><div class="amr-fx"></div>
      <div class="amr-top">
        <button class="btn ghost back" data-a="back" title="Retour au village">${ICO('back', 18)}</button>
        <div class="amr-title"><small>Le maître d'armes</small><b>Classe &amp; pouvoirs</b></div>
        <div class="amr-tabs"></div>
        <button class="btn primary amr-ok" data-a="ok">${ICO('check', 16)} Valider</button>
      </div>
      <div class="amr-tags"></div>
      <div class="amr-hint"><b>Choisis ta classe</b><span>Clique sur un héros pour t'approcher de lui</span></div>
      <div class="amr-info"></div>
      <div class="amr-pool"></div>
      <div class="amr-build"></div>
      <div class="amr-tip"></div>
    </div>`;
    const root = n.querySelector('.amr'), canvas = root.querySelector('.amr-gl'), $ = s => root.querySelector(s);

    /* ---------- moteur ---------- */
    const R = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(low ? 1 : 1.5, devicePixelRatio || 1)); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.12; R.outputEncoding = THREE.LinearEncoding;
    R.shadowMap.enabled = !low; R.shadowMap.type = THREE.PCFSoftShadowMap; R.info.autoReset = false;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 80); scene.userData.cam = cam; scene.add(cam);
    scene.background = lin('#150e0a'); scene.fog = new THREE.FogExp2(lin('#24180f'), 0.02);
    const A = { R, scene, cam, root, canvas, t: 0, last: performance.now(), raf: 0, W: 0, H: 0, s: 1, uTime: { value: 0 }, own: [], timers: [], heroes: {}, fires: [], candles: [], spots: {}, bans: {}, dais: {}, daisL: {}, cards: [], slots: [], flies: [], camP: new AV3(0, 3, 6), camT: new AV3(0, 1.5, -3.5), fov: 44, fly: null, mouse: { x: 0, y: 0, nx: 0, ny: 0, in: false }, calls: 0 };
    ARM = A;
    const own = x => { A.own.push(x); return x; };
    const later = (t, f) => A.timers.push({ t, f });
    const hudFx = $('.amr-fx');
    const fx = BR.AFX.create(scene, cam, hudFx); A.fx = fx;
    let post = null; try { post = BR.AFX.post(R, scene, cam, low ? 'low' : 'high'); if (post) post.grade.uVig.value = 0.4; } catch (e) { post = null; }
    if (!post) R.outputEncoding = THREE.sRGBEncoding;
    A.post = post;
    const petals = BR.AscFX && BR.AscFX.petals ? BR.AscFX.petals(scene) : null;

    /* ---------- la salle ---------- */
    function buildHall() {
      const g = BR.Assets.models.arm_hall;
      if (!g) return fallbackHall();
      const src = g.scene; src.updateMatrixWorld(true);
      const parts = {};
      src.traverse(o => {
        if (o.isMesh) {
          const mat = Array.isArray(o.material) ? o.material[0] : o.material, nm = (mat && mat.name) || '';
          let b = 'std', k = 1;
          if (/^glow_dais_/.test(nm)) b = 'dais:' + nm.slice(10);
          else if (/^glow_win/.test(nm)) { b = 'glow'; k = 1.15; }
          else if (/^glow_/.test(nm)) { b = 'glow'; k = /flame/.test(nm) ? 2.6 : /ember/.test(nm) ? 2.3 : /gem/.test(nm) ? 1.9 : 1.5; }
          (parts[b] = parts[b] || []).push({ geo: o.geometry, m4: o.matrixWorld, col: mat.color.clone().multiplyScalar(k) });
          return;
        }
        if (o === src || o.children.length) return;
        const p = new AV3().setFromMatrixPosition(o.matrixWorld), nm = o.name || '';
        if (/^spot_/.test(nm)) A.spots[nm.slice(5)] = p;
        else if (/^ban_/.test(nm)) A.bans[nm.slice(4)] = p;
        else if (/^fire/.test(nm)) A.fires.push({ p, front: /fire_[ab]/.test(nm) });
        else if (/^candle/.test(nm)) A.candles.push(p);
        else if (/^chand/.test(nm)) A.chand = p;
        else if (/^dummy/.test(nm)) A.dummy = p;
      });
      for (const b in parts) {
        if (b === 'std') {
          const m = new THREE.Mesh(own(armMerge(parts[b], true)), own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 })));
          m.receiveShadow = true; scene.add(m);
        } else if (b === 'glow') {
          scene.add(new THREE.Mesh(own(armMerge(parts[b], true)), own(new THREE.MeshBasicMaterial({ vertexColors: true }))));
        } else {
          const cls = b.slice(5), mat = own(new THREE.MeshBasicMaterial({ color: lin(CL[cls] ? CL[cls].col : '#ffffff').multiplyScalar(1.3) }));
          scene.add(new THREE.Mesh(own(armMerge(parts[b], false)), mat)); A.dais[cls] = mat;
        }
      }
    }
    function fallbackHall() {
      const stone = own(new THREE.MeshStandardMaterial({ color: lin('#8f8474'), roughness: 0.9 })), wall = own(new THREE.MeshStandardMaterial({ color: lin('#c9b48e'), roughness: 0.9 }));
      const fl = new THREE.Mesh(own(new THREE.PlaneGeometry(20, 18)), stone); fl.rotation.x = -Math.PI / 2; fl.position.z = -2; fl.receiveShadow = true; scene.add(fl);
      const bw = new THREE.Mesh(own(new THREE.PlaneGeometry(20, 8)), wall); bw.position.set(0, 4, -9.4); scene.add(bw);
      for (const s of [-1, 1]) { const sw = new THREE.Mesh(own(new THREE.PlaneGeometry(18, 8)), wall); sw.position.set(s * 9.2, 4, -2); sw.rotation.y = -s * Math.PI / 2; scene.add(sw); }
      const dg = own(new THREE.CylinderGeometry(1.15, 1.3, ARM_TOP, 8)), rg = own(new THREE.TorusGeometry(0.86, 0.035, 4, 32)); rg.rotateX(Math.PI / 2);
      ARM_CLS.forEach(cls => {
        const [x, z] = ARM_SPOT[cls], d = new THREE.Mesh(dg, stone); d.position.set(x, ARM_TOP / 2, z); d.receiveShadow = true; scene.add(d);
        const mat = own(new THREE.MeshBasicMaterial({ color: lin(CL[cls].col).multiplyScalar(1.3) })), r = new THREE.Mesh(rg, mat); r.position.set(x, ARM_TOP + 0.01, z); scene.add(r);
        A.dais[cls] = mat; A.spots[cls] = new AV3(x, ARM_TOP, z); A.bans[cls] = new AV3(x * 1.5, 6.2, -8.4);
      });
      A.fires.push({ p: new AV3(-5.9, 1.1, -0.9), front: true }, { p: new AV3(5.9, 1.1, -0.9), front: true });
      A.chand = new AV3(0, 5.1, -0.6);
    }
    buildHall();
    ARM_CLS.forEach(cls => { if (!A.spots[cls]) A.spots[cls] = new AV3(ARM_SPOT[cls][0], ARM_TOP, ARM_SPOT[cls][1]); });

    /* ---------- lumières ---------- */
    scene.add(new THREE.HemisphereLight(lin('#ffdcb4'), lin('#3a2a1c'), 0.62));
    const sunDir = new AV3(1.0, -0.8, -0.35).normalize();
    const sun = new THREE.DirectionalLight(lin('#ffd49a'), 1.3); sun.position.set(0, 1.2, -3.5).addScaledVector(sunDir, -16); sun.target.position.set(0, 1.2, -3.5); scene.add(sun, sun.target);
    if (!low) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 6; sc.bottom = -6; sc.near = 2; sc.far = 34; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; }
    const front = A.fires.filter(f => f.front).slice(0, 2);
    A.fireL = front.map(f => { const l = new THREE.PointLight(lin('#ff9a4a'), 1.5, 10, 2); l.position.copy(f.p).add(new AV3(0, 0.45, 0)); scene.add(l); return l; });
    if (A.chand) { A.chandL = new THREE.PointLight(lin('#ffc98a'), 1.3, 13, 2); A.chandL.position.copy(A.chand); scene.add(A.chandL); }
    ARM_CLS.forEach(cls => { const p = A.spots[cls], l = new THREE.PointLight(lin(CL[cls].col), 0.45, 4.8, 2); l.position.set(p.x, 1.35, p.z + 1.1); scene.add(l); A.daisL[cls] = l; });
    const spot = new THREE.SpotLight(lin('#ffe6bf'), 0, 15, 0.38, 0.75, 1.5); spot.position.set(0, 7, 0); scene.add(spot, spot.target); A.spot = spot;

    /* ---------- bannières des classes (toile qui ondule) ---------- */
    const banGeo = own(new THREE.PlaneGeometry(2.0, 4.1, 6, 16)); banGeo.translate(0, -2.05, 0);
    { const pa = banGeo.attributes.position, sw = new Float32Array(pa.count); for (let i = 0; i < pa.count; i++) sw[i] = Math.min(1, -pa.getY(i) / 4.1); banGeo.setAttribute('sway', new THREE.BufferAttribute(sw, 1)); }
    ARM_CLS.forEach(cls => {
      const p = A.bans[cls] || new AV3(A.spots[cls].x * 1.5, 6.2, -8.4);
      const tex = own(new THREE.CanvasTexture(bannerCanvas(cls))); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
      const mat = own(new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.9 }));
      mat.onBeforeCompile = sh => {
        sh.uniforms.uTime = A.uTime;
        sh.vertexShader = 'attribute float sway;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = uTime * 1.5 + position.y * 1.2 + position.x * 0.7 + modelMatrix[3].x * 1.7;
          transformed.z += sin(ph) * 0.13 * sway; transformed.x += sin(ph * 0.6 + 1.3) * 0.04 * sway;`);
      };
      mat.customProgramCacheKey = () => 'arm-cloth';
      const m = new THREE.Mesh(banGeo, mat); m.position.copy(p); scene.add(m);
    });

    /* ---------- rayons de lumière et poussière dorée ---------- */
    const shafts = [];
    const shaftMat = a => own(new THREE.ShaderMaterial({
      uniforms: { uTime: A.uTime, uA: { value: a }, uCol: { value: lin('#ffd59a') } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying float vY; varying float vE; varying vec3 vP; void main(){ vY = uv.y; vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 nn = normalize(normalMatrix * normal); vE = abs(dot(nn, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uA, uTime; uniform vec3 uCol; varying float vY; varying float vE; varying vec3 vP; void main(){ float a = uA * pow(vE, 2.2) * (0.3 + 0.7 * vY) * smoothstep(0.0, 0.2, vY) * smoothstep(1.0, 0.9, vY); a *= 0.75 + 0.25 * sin(vP.y * 2.3 + vP.x * 3.1 + uTime * 0.7); gl_FragColor = vec4(uCol, a); }',
    }));
    function addShaft(from, dir, r0, r1, a) {
      const len = from.y / Math.max(0.2, -dir.y) * 1.02, geo = own(new THREE.CylinderGeometry(r0, r1, len, 18, 1, true)); geo.translate(0, -len / 2, 0);
      const m = new THREE.Mesh(geo, shaftMat(a)); m.position.copy(from); m.quaternion.setFromUnitVectors(new AV3(0, -1, 0), dir); m.renderOrder = 5; scene.add(m);
      shafts.push({ from: from.clone(), dir: dir.clone(), len, r0, r1 });
    }
    if (BR.Assets.models.arm_hall) {
      addShaft(new AV3(-9.0, 4.6, -0.2), sunDir, 0.5, 1.3, 0.11); addShaft(new AV3(-9.0, 4.6, -5.6), sunDir, 0.5, 1.3, 0.09);
      addShaft(new AV3(-2.7, 4.3, -9.2), new AV3(0.12, -0.55, 1).normalize(), 0.45, 1.2, 0.06); addShaft(new AV3(2.7, 4.3, -9.2), new AV3(-0.12, -0.55, 1).normalize(), 0.45, 1.2, 0.06);
    }
    {
      const N = low ? 160 : 380, pos = [], ph = [], br = [];
      for (let i = 0; i < N; i++) {
        const sh = shafts.length && i % 2 === 0 ? shafts[i % shafts.length] : null;
        if (sh) { const t = Math.random() * sh.len, r = (sh.r0 + (sh.r1 - sh.r0) * t / sh.len) * Math.sqrt(Math.random()), a = Math.random() * 6.283, p = sh.from.clone().addScaledVector(sh.dir, t); p.x += Math.cos(a) * r; p.z += Math.sin(a) * r; pos.push(p.x, p.y, p.z); br.push(1); }
        else { pos.push((Math.random() - 0.5) * 16, 0.3 + Math.random() * 5, -9 + Math.random() * 12); br.push(0.3); }
        ph.push(Math.random(), Math.random(), Math.random());
      }
      const g = own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 3)); g.setAttribute('aB', new THREE.Float32BufferAttribute(br, 1));
      const mat = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: A.uTime, uScale: { value: 600 }, uCol: { value: lin('#ffe2a0') } },
        vertexShader: `attribute vec3 aPh; attribute float aB; uniform float uTime, uScale; varying float vA;
          void main(){ vec3 p = position + vec3(sin(uTime * 0.21 + aPh.x * 6.28) * 0.35, sin(uTime * 0.17 + aPh.y * 6.28) * 0.3, cos(uTime * 0.19 + aPh.z * 6.28) * 0.35);
            vA = aB * (0.45 + 0.55 * sin(uTime * (0.8 + aPh.y) + aPh.x * 30.0));
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (0.035 + aPh.z * 0.03) * uScale / max(0.4, -mv.z); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(uCol * 1.6, (1.0 - d) * (1.0 - d) * max(vA, 0.0)); }' }));
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts); A.dust = mat;
    }

    /* ---------- les héros ---------- */
    const glowTex = own(new THREE.CanvasTexture(glowCanvas()));
    function makeHero(cls, mine) {
      let av; try { av = BR.Avatar.build(mine ? (Acc.p.look || { skin: 'survivor' }) : { skin: ARM_LOOK[cls] }); } catch (e) { console.warn('armory', e); return null; }
      av.weapon([]);
      const C = CL[cls], W = AR.WEAPONS[C.weapon], held = [], extra = [];
      if (W) for (const [model, node, hand] of W.models) {
        const P = armWeapon(model, node), par = hand === 'L' ? av.handL : av.handR; if (!P || !par) continue;
        const o = P.node.clone(true); o.visible = true; o.traverse(x => { x.visible = true; }); par.add(o); held.push({ o, tip: P.tip });
      }
      // lueur au survol : liseré (fresnel) de la couleur de la classe
      const rim = { value: new THREE.Color(0, 0, 0) };
      av.group.traverse(m => {
        if (!m.isMesh) return;
        m.castShadow = !low;
        const one = mt => {
          if (!mt || !mt.isMeshStandardMaterial) return mt;
          const c = mt.clone(); if (mt.userData.own) mt.dispose(); c.userData.own = true;
          c.onBeforeCompile = sh => { sh.uniforms.uRim = rim; sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <output_fragment>', 'outgoingLight += uRim * pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.2);\n#include <output_fragment>'); };
          c.customProgramCacheKey = () => 'arm-rim';
          return c;
        };
        m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
      });
      // bâton : cristal lumineux au bout
      if (C.weapon === 'staff' && held[0]) {
        const sm = new THREE.SpriteMaterial({ map: glowTex, color: lin(C.col).multiplyScalar(2.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
        const sp = new THREE.Sprite(sm); sp.scale.setScalar(0.55 / 0.78); sp.position.copy(held[0].tip); held[0].o.add(sp); extra.push(sm); held[0].orb = sp;
      }
      const p = A.spots[cls];
      av.group.position.copy(p); scene.add(av.group);
      const H = { cls, av, mine, rim, held, extra, pos: av.group.position, yaw: Math.atan2(A.camP.x - p.x, A.camP.z - p.z), rimK: 0, idleT: 5 + Math.random() * 5 };
      av.group.rotation.y = H.yaw;
      for (let k = 0; k < 3; k++) av.update(0.05, 0, {});
      return H;
    }
    function dropHero(H) { if (!H) return; scene.remove(H.av.group); try { H.av.dispose(); } catch (e) { /* rien */ } H.extra.forEach(m => m.dispose()); }
    function setHero(cls, mine, puff) {
      const old = A.heroes[cls]; if (old && old.mine === mine) return old;
      const H = makeHero(cls, mine); if (!H) return old;
      if (old) { H.yaw = old.yaw; H.av.group.rotation.y = old.yaw; dropHero(old); }
      A.heroes[cls] = H;
      if (puff && petals) { const c = H.pos.clone(), col = CL[cls].col; (mine ? petals.gather(c, 2.0, 0.5, ['#ffffff', col, '#ffe9a8'], 60, 0.8) : petals.burst(c, 2.0, 0.5, ['#ffffff', col], 40, 0.8)); }
      return H;
    }
    ARM_CLS.forEach(cls => setHero(cls, cls === st.cls, false));
    const tipOf = (H, i) => { const w = H && H.held[i || 0]; return w ? w.o.localToWorld(w.tip.clone()) : H.pos.clone().add(new AV3(0, 1.2, 0)); };
    const fwdOf = H => new AV3(Math.sin(H.yaw), 0, Math.cos(H.yaw));
    /** démonstration de la classe : coup d'épée, sort, tir */
    function flourish(cls, quiet) {
      const H = A.heroes[cls]; if (!H) return;
      const Au = quiet ? { fx() {} } : BR.Audio;
      const col = CL[cls].col, p = H.pos, av = H.av;
      H.idleT = 7 + Math.random() * 5;
      if (cls === 'chevalier') {
        av.act('1H_Melee_Attack_Slice_Diagonal', { speed: 1.0 });
        later(0.2, () => { Au.fx('swing', { rate: 0.9 }); });
        later(0.3, () => {
          const c = p.clone().add(new AV3(0, 1.15, 0)).addScaledVector(fwdOf(H), 0.55);
          fx.slash(c, H.yaw, { color: col, r: 1.7, tilt: 0.75, life: 0.34, arc: 2.6 });
          fx.burst(c, { n: 18, color: col, speed: 5, life: 0.5, size: 0.14, grav: 4 });
          fx.ring(p.clone().setY(ARM_TOP + 0.03), { r1: 2.4, color: col, life: 0.5 });
          fx.light(c, col, 3.5, 7, 0.4); Au.fx('parry', { g: 0.45 });
        });
      } else if (cls === 'mage') {
        av.act('Spellcast_Raise', { speed: 1.0 });
        later(0.05, () => Au.fx('charge', { len: 0.6, g: 0.5 }));
        later(0.15, () => { const t = tipOf(H); fx.burst(t, { n: 14, color: col, speed: 1.5, life: 0.6, size: 0.12, grav: -2 }); });
        later(0.55, () => {
          const t = tipOf(H);
          fx.flash(t, { color: col, r: 0.6, life: 0.3 });
          fx.pillar(p, { color: col, r: 0.85, h: 6.5, life: 0.9, alpha: 0.8 });
          fx.ring(p.clone().setY(ARM_TOP + 0.03), { r1: 2.8, color: col, life: 0.65 });
          fx.burst(p.clone().add(new AV3(0, 0.6, 0)), { n: 34, color: col, speed: 4, up: 2.5, grav: -1.5, life: 1.0, size: 0.15, jitter: 0.8 });
          Au.fx('magic', { rate: 0.8 });
          if (H.held[0] && H.held[0].orb) H.orbK = 1;
        });
      } else {
        av.act('2H_Ranged_Shoot', { speed: 0.85 });
        later(0.32, () => {
          const from = tipOf(H), right = new AV3().setFromMatrixColumn(cam.matrixWorld, 0), fwdC = new AV3(); cam.getWorldDirection(fwdC);
          const to = cam.position.clone().addScaledVector(right, -1.3).addScaledVector(fwdC, 1.6).add(new AV3(0, -0.25, 0));
          const ar = BR.AscFX && BR.AscFX.arrowMesh ? BR.AscFX.arrowMesh(col, 1.0) : null;
          Au.fx('swing', { rate: 1.6 });
          fx.flash(from, { color: col, r: 0.35, life: 0.18 });
          if (ar) {
            ar.position.copy(from); ar.lookAt(to);
            const last = from.clone();
            fx.add(ar, 0.34, (k, ob) => { ob.position.lerpVectors(from, to, k); fx.spark(ob.position, new AV3(0, 0, 0), { color: col, life: 0.35, size: 0.1, size1: 0.01 }); last.copy(ob.position); });
          }
        });
      }
    }

    /* ---------- cartes des pouvoirs et emplacements (devant la caméra) ---------- */
    const camGroup = new THREE.Group(); cam.add(camGroup);
    const quad = own(new THREE.PlaneGeometry(1, 1));
    const shadeMat = own(new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { uF: { value: 0 }, uX: { value: 0.43 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uF, uX; varying vec2 vUv; void main(){ float r = smoothstep(uX - 0.1, uX + 0.05, vUv.x) * 0.62; float b = smoothstep(0.3, 0.0, vUv.y) * (1.0 - smoothstep(uX - 0.05, uX + 0.08, vUv.x)) * 0.55; float t = smoothstep(0.82, 1.0, vUv.y) * 0.5; gl_FragColor = vec4(0.012, 0.008, 0.006, max(t, uF * max(r, b))); }' }));
    const shade = new THREE.Mesh(quad, shadeMat); shade.renderOrder = 18; shade.frustumCulled = false; camGroup.add(shade);
    const order = AR.SKILLS.map((s, i) => ({ s, i })).sort((a, b) => (a.s.type === b.s.type ? 0 : a.s.type === 'ult' ? 1 : -1) || (RAR_T[a.s.rarity] - RAR_T[b.s.rarity]) || a.i - b.i).map(x => x.s);
    order.forEach(s => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 360;
      const tex = own(new THREE.CanvasTexture(c)); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
      const mat = own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false })); mat.color.setScalar(0.8);
      const m = new THREE.Mesh(quad, mat); m.renderOrder = 20; m.frustumCulled = false; m.visible = false; camGroup.add(m);
      A.cards.push({ id: s.id, s, tab: s.type === 'ult' ? 'ult' : 'skill', c, tex, mat, m, rect: null, sig: '', show: false, fl: 0, delay: 0, hov: 0, shake: 0, pulse: 0 });
    });
    for (let i = 0; i < 5; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const tex = own(new THREE.CanvasTexture(c)); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
      const mat = own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false })); mat.color.setScalar(0.82);
      const m = new THREE.Mesh(quad, mat); m.renderOrder = 21; m.frustumCulled = false; m.visible = false; camGroup.add(m);
      A.slots.push({ i, c, tex, mat, m, rect: null, sig: '', hov: 0, pulse: 0, fl: 0 });
    }
    const keyName = i => KEYS()[i];
    const slotOf = (cls, id) => { const b = st.builds[cls]; if (!b) return -1; if (b.ult === id) return 4; return b.kit.indexOf(id); };
    function redrawCards(force) {
      if (!st.cls) return;
      const U = unlocked(st.cls);
      A.cards.forEach(cd => {
        const locked = !U.has(cd.id), j = slotOf(st.cls, cd.id), badge = j >= 0 ? keyName(j) : '', img = armIcon(cd.id, cd.wait ? null : () => { cd.wait = false; if (ARM === A) { cd.sig = ''; redrawCards(); } });
        if (!img) cd.wait = true;
        const sig = `${st.cls}|${locked}|${badge}|${!!img}`;
        if (!force && sig === cd.sig) return;
        cd.sig = sig; cd.locked = locked;
        drawCard(cd.c, { id: cd.id, cls: st.cls, locked, badge, img }); cd.tex.needsUpdate = true;
      });
    }
    function redrawSlots() {
      if (!st.cls) return;
      const b = st.builds[st.cls];
      A.slots.forEach(sl => {
        const id = sl.i < 4 ? b.kit[sl.i] : b.ult, active = st.slot === sl.i, img = id ? armIcon(id, sl.wait === id ? null : () => { sl.wait = null; if (ARM === A) { sl.sig = ''; redrawSlots(); } }) : null;
        if (id && !img) sl.wait = id;
        const sig = `${id}|${active}|${!!img}|${keyName(sl.i)}`;
        if (sig === sl.sig) return;
        sl.sig = sig; drawSlot(sl.c, { id, key: keyName(sl.i), ult: sl.i === 4, active, img }); sl.tex.needsUpdate = true;
      });
    }
    function showTab(tab, anim) {
      st.tab = tab;
      A.cards.forEach(cd => { const on = st.view === 'cls' && cd.tab === tab; if (on && (!cd.show || anim)) { cd.fl = 0; } cd.show = on; });
      let k = 0; A.cards.forEach(cd => { if (cd.show) cd.delay = (k++) * 0.035; });
      relayout(); paintPool();
    }

    /* ---------- mise en page (cartes WebGL et textes HTML alignés sur les mêmes rectangles) ---------- */
    function relayout() {
      const W = A.W, H = A.H, s = BR.clamp(Math.min(W / 1280, H / 720), 0.72, 1.7); A.s = s;
      root.style.fontSize = (15 * s).toFixed(2) + 'px';
      const px0 = Math.round(W * 0.43), px1 = W - 24 * s, pw = px1 - px0, gy0 = 72 + 108 * s, gy1 = H - 20 * s;
      A.px0 = px0; shadeMat.uniforms.uX.value = px0 / W;
      const list = A.cards.filter(cd => cd.tab === st.tab), cnt = list.length, cols = st.tab === 'ult' ? 4 : 6, rows = Math.ceil(cnt / cols), gap = 12 * s;
      const cw = Math.min((pw - (cols - 1) * gap) / cols, ((gy1 - gy0) - (rows - 1) * gap) / rows * CARD_AR, (st.tab === 'ult' ? 150 : 132) * s), ch = cw / CARD_AR;
      const gw = cols * cw + (cols - 1) * gap, gx0 = px0 + (pw - gw) / 2;
      list.forEach((cd, i) => { const r = Math.floor(i / cols), k = i % cols, inRow = Math.min(cols, cnt - r * cols), off = (cols - inRow) * (cw + gap) / 2; cd.rect = { x: gx0 + off + k * (cw + gap) + cw / 2, y: gy0 + r * (ch + gap) + ch / 2, w: cw, h: ch }; });
      // emplacements (en bas à gauche, sous le héros)
      const sz = Math.min(92 * s, (px0 - 48 * s - 4 * 14 * s - 26 * s) / 5.2), uz = sz * 1.2, sy = H - 26 * s - 22 * s - uz / 2;
      let x = 28 * s;
      A.slots.forEach(sl => { const z = sl.i === 4 ? uz : sz; if (sl.i === 4) x += 12 * s; sl.rect = { x: x + z / 2, y: sy + (sl.i === 4 ? 0 : (uz - sz) / 2), w: z, h: z }; x += z + 14 * s; });
      const pool = $('.amr-pool'); pool.style.left = px0 + 'px'; pool.style.top = (72 + 58 * s) + 'px'; pool.style.width = pw + 'px';
      const info = $('.amr-info'); info.style.left = 28 * s + 'px'; info.style.top = (72 + 58 * s) + 'px';
      paintBuild();
    }
    // pixels -> repère de la caméra (à la distance des cartes)
    const pxK = () => 2 * CARD_D * Math.tan(cam.fov * Math.PI / 360) / A.H;
    function place(m, r, sc, z) { const k = pxK(); m.position.set((r.x - A.W / 2) * k, (A.H / 2 - r.y) * k, -CARD_D + (z || 0)); m.scale.set(r.w * k * sc, r.h * k * sc, 1); }

    /* ---------- textes HTML ---------- */
    function paintTop() {
      $('.amr-tabs').innerHTML = ARM_CLS.map(id => { const c = CL[id], L = lvOf(id); return `<button class="amr-tab ${st.cls === id ? 'on' : ''}" data-cls="${id}" style="--cc:${c.col}" title="${esc(c.d)}"><b>${c.n}</b><span>${L ? 'Niv. ' + L.lv : esc(c.look)}</span></button>`; }).join('');
      const ok = $('.amr-ok'); ok.disabled = !st.cls;
    }
    function paintTags() {
      $('.amr-tags').innerHTML = ARM_CLS.map(id => { const c = CL[id], L = lvOf(id); return `<div class="amr-tag ${st.cls === id ? 'mine' : ''}" data-cls="${id}" style="--cc:${c.col}">${st.cls === id ? '<em>Ta classe</em>' : ''}<b>${c.n}</b><span>${esc(c.look)}</span>${L ? `<i>Niveau ${L.lv}</i>` : ''}<p>${esc(c.d)}</p></div>`; }).join('');
    }
    function paintInfo() {
      if (!st.cls) { $('.amr-info').innerHTML = ''; return; }
      const c = CL[st.cls], L = lvOf(st.cls), pct = L ? (L.max ? 100 : Math.round(100 * L.cur / Math.max(1, L.need))) : 0;
      $('.amr-info').innerHTML = `<b style="color:${c.col}">${c.n}</b><span>${esc(c.look)}${L ? ` · Niveau ${L.lv}` : ''}</span>${L ? `<i title="${L.max ? 'Niveau maximum' : L.cur + ' / ' + L.need + ' xp'}"><u style="width:${pct}%;background:${c.col}"></u></i>` : ''}`;
    }
    function paintPool() {
      if (!st.cls) { $('.amr-pool').innerHTML = ''; return; }
      const U = unlocked(st.cls), sk = AR.SKILLS.filter(s => s.type === 'skill'), ul = AR.SKILLS.filter(s => s.type === 'ult');
      const nS = sk.filter(s => U.has(s.id)).length, nU = ul.filter(s => U.has(s.id)).length, tot = AR.SKILLS.length, got = nS + nU;
      $('.amr-pool').innerHTML = `<div class="amr-ptabs"><button data-tab="skill" class="${st.tab === 'skill' ? 'on' : ''}">Pouvoirs <em>${nS}/${sk.length}</em></button><button data-tab="ult" class="${st.tab === 'ult' ? 'on' : ''}">Ultimes <em>${nU}/${ul.length}</em></button></div>
        <div class="amr-count"><span>${ICO('lock', 13)} Collection</span><b>${got} / ${tot}</b><small>pouvoirs découverts</small><i><u style="width:${Math.round(100 * got / tot)}%"></u></i></div>`;
    }
    function paintBuild() {
      const el2 = $('.amr-build');
      if (!st.cls || !A.slots[0].rect) { el2.innerHTML = ''; return; }
      const b = st.builds[st.cls], s0 = A.slots[0].rect, s4 = A.slots[4].rect;
      el2.innerHTML = `<div class="amr-blbl" style="left:${s0.x - s0.w / 2}px;top:${s4.y - s4.h / 2 - 30 * A.s}px"><b>Ton build</b><span>clique un emplacement, puis une carte</span></div>` +
        A.slots.map(sl => { const id = sl.i < 4 ? b.kit[sl.i] : b.ult, r = sl.rect; return `<div class="amr-sn ${st.slot === sl.i ? 'on' : ''}" data-slot="${sl.i}" style="left:${r.x}px;top:${r.y + r.h / 2 + 2 * A.s}px;width:${r.w + 14 * A.s}px">${id ? esc(Q.skillName(id, st.cls)) : '—'}</div>`; }).join('');
    }
    function paintAll() { paintTop(); paintTags(); paintInfo(); paintPool(); paintBuild(); }
    // infobulle d'un pouvoir (carte ou emplacement)
    function showTip(id, r, side) {
      const tip = $('.amr-tip'); if (!id) { tip.classList.remove('on'); return; }
      const s = AR.skill(id), R2 = BR.RARITY[s.rarity] || BR.RARITY.commun, U = unlocked(st.cls), locked = !U.has(id), j = slotOf(st.cls, id);
      const want = s.type === 'ult' ? 4 : (st.slot < 4 ? st.slot : 0);
      const status = locked ? `${ICO('lock', 13)} Pas encore découvert : ouvre des coffres pendant une course pour le trouver.`
        : j >= 0 ? `${ICO('check', 13)} Équipé sur la touche <kbd>${keyName(j)}</kbd>`
          : `Clic : équiper sur la touche <kbd>${keyName(want)}</kbd>`;
      tip.style.setProperty('--rc', R2.color);
      tip.innerHTML = `<small>${R2.label}${s.type === 'ult' ? ' · Ultime' : ' · Pouvoir'}</small><b>${locked ? 'Pouvoir inconnu' : esc(Q.skillName(id, st.cls))}</b>
        <p>${locked ? `Un pouvoir ${R2.label.toLowerCase()} t'attend quelque part dans l'Ascension.` : esc(Q.skillDesc(id, st.cls))}</p><em class="${locked ? 'lk' : ''}">${status}</em>`;
      tip.classList.add('on');
      const tw = tip.offsetWidth, th = tip.offsetHeight, m = 12 * A.s;
      let x, y;
      if (side === 'up') { x = r.x - tw / 2; y = r.y - r.h / 2 - th - m; }
      else { x = r.x - r.w / 2 - tw - m; if (x < 8) x = r.x + r.w / 2 + m; y = r.y - r.h / 2; }
      x = BR.clamp(x, 8, A.W - tw - 8); y = BR.clamp(y, 70, A.H - th - 8);
      tip.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    }

    /* ---------- caméra ---------- */
    function camFor(view, cls) {
      const asp = (A.W || innerWidth) / Math.max(1, A.H || innerHeight);
      if (view !== 'cls' || !cls) {
        const fov = 44, d = Math.max(7.2, 5.7 / (Math.tan(fov * Math.PI / 360) * asp));
        return { p: new AV3(0, 3.3, -3.55 + d), t: new AV3(0, 1.3, -3.55), f: fov };
      }
      const fov = 38, tn = Math.tan(fov * Math.PI / 360), P = A.spots[cls], hall = camFor('hall');
      const dir = new AV3(P.x - hall.p.x, 0, P.z - hall.p.z).normalize(), right = new AV3(-dir.z, 0, dir.x);
      const d = 1.95 / (0.52 * 2 * tn), off = 0.56 * d * tn * asp, yc = ARM_TOP + 0.28 * 2 * tn * d;
      const t = new AV3(P.x, yc - 0.12, P.z).addScaledVector(right, off);
      return { p: t.clone().addScaledVector(dir, -d).add(new AV3(0, 0.5, 0)), t, f: fov };
    }
    function flyTo(view, cls, dur) { const T = camFor(view, cls); A.fly = { p0: A.camP.clone(), t0: A.camT.clone(), f0: A.fov, view, cls, k: 0, dur: dur || 1.25 }; return T; }

    /* ---------- actions ---------- */
    function chooseClass(cls, opts) {
      if (!CL[cls]) return;
      const prev = st.cls, changed = prev !== cls;
      st.cls = cls; buildOf(cls);
      if (changed) { st.slot = 0; st.tab = 'skill'; }
      if (changed && prev) setHero(prev, false, true);
      setHero(cls, true, changed);
      st.view = 'cls'; root.classList.remove('hall'); root.classList.add('focus');
      flyTo('cls', cls, opts && opts.dur);
      A.cards.forEach(cd => { cd.show = false; cd.sig = changed ? '' : cd.sig; });
      A.slots.forEach(sl => { sl.sig = ''; sl.fl = 0; });
      redrawCards(); redrawSlots();
      later((opts && opts.dur || 1.25) * 0.55, () => { if (st.cls === cls) showTab(st.tab, true); });
      later((opts && opts.dur || 1.25) * 0.8, () => { if (st.cls === cls) flourish(cls); });
      hideTip(); st.hov = null;
      paintAll();
      if (!opts || !opts.quiet) Au.ui('click');
    }
    function hideTip() { $('.amr-tip').classList.remove('on'); }
    function selectSlot(i) {
      if (!st.cls || i < 0 || i > 4) return;
      st.slot = i; if (i < 4) st.lastSkill = i; const tab = i === 4 ? 'ult' : 'skill';
      if (tab !== st.tab) showTab(tab, true);
      A.slots[i].pulse = 1; redrawSlots(); paintBuild(); redrawCards(); Au.ui('click');
    }
    function equip(cd) {
      const b = st.builds[st.cls]; if (!b) return;
      if (cd.locked) { cd.shake = 1; Au.ui('error'); return; }
      let to;
      if (cd.s.type === 'ult') { if (b.ult === cd.id) { selectSlot(4); return; } b.ult = cd.id; to = 4; }
      else {
        const slot = st.slot < 4 ? st.slot : 0, j = b.kit.indexOf(cd.id);
        if (j === slot) return;
        if (j >= 0) b.kit[j] = b.kit[slot];
        b.kit[slot] = cd.id; to = slot;
      }
      // la carte s'envole jusqu'à l'emplacement
      const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: cd.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
      m.renderOrder = 22; m.frustumCulled = false; camGroup.add(m);
      A.flies.push({ m, from: Object.assign({}, cd.rect), to: A.slots[to], k: 0 });
      cd.pulse = 1; Au.ui('ok'); Au.fx('magic', { rate: 1.3, g: 0.6 });
      redrawCards(); paintBuild();
      showTip(cd.id, cd.rect);
    }
    function validate() {
      if (!st.cls || st.leaving) return;
      const b = buildOf(st.cls), D2 = Q.data();
      D2.sel = { cls: st.cls, kit: b.kit.slice(), ult: b.ult }; Q.saveData();
      st.leaving = true; Au.ui('ok'); Au.fx('reveal', { rate: 1.1 });
      const H = A.heroes[st.cls];
      if (H) { H.av.act('Cheer'); fx.pillar(H.pos, { color: CL[st.cls].col, r: 1.0, h: 9, life: 0.8 }); if (petals) petals.burst(H.pos.clone(), 2.0, 0.6, ['#ffffff', CL[st.cls].col, '#ffd76a'], 50, 1.1); }
      UI.toast(CL[st.cls].n + ' prêt au combat !', 'good');
      setTimeout(() => { if (ARM === A && UI.current() === 'asc-armory') UI.show('asc'); }, 750);
    }
    const back = () => { if (st.leaving) return; Au.ui('back'); UI.show('asc'); };

    /* ---------- souris et clavier ---------- */
    function hitAt(x, y) {
      if (st.view === 'cls') {
        for (const sl of A.slots) { const r = sl.rect; if (r && Math.abs(x - r.x) < r.w * 0.45 && Math.abs(y - r.y) < r.h * 0.45) return { kind: 'slot', sl }; }
        for (const cd of A.cards) { const r = cd.rect; if (cd.show && r && cd.fl > 0.5 && Math.abs(x - r.x) < r.w * 0.44 && Math.abs(y - r.y) < r.h * 0.45) return { kind: 'card', cd }; }
        if (x > A.px0 - 10) return null;
      }
      for (const cls of ARM_CLS) { const r = A.heroR && A.heroR[cls]; if (r && x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return { kind: 'hero', cls }; }
      return null;
    }
    const sameHit = (a, b) => (!a && !b) || (a && b && a.kind === b.kind && a.cd === b.cd && a.sl === b.sl && a.cls === b.cls);
    function onMove(e) {
      const r = root.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      A.mouse.x = x; A.mouse.y = y; A.mouse.nx = x / Math.max(1, A.W) * 2 - 1; A.mouse.ny = y / Math.max(1, A.H) * 2 - 1; A.mouse.in = true;
      const h = e.target === canvas ? hitAt(x, y) : null;
      if (sameHit(h, st.hov)) return;
      st.hov = h; canvas.style.cursor = h ? 'pointer' : '';
      st.hovCls = h && h.kind === 'hero' ? h.cls : null;
      root.querySelectorAll('.amr-tag').forEach(t => t.classList.toggle('hov', t.dataset.cls === st.hovCls));
      if (h && h.kind === 'card') showTip(h.cd.id, h.cd.rect);
      else if (h && h.kind === 'slot') { const b = st.builds[st.cls], id = h.sl.i < 4 ? b.kit[h.sl.i] : b.ult; showTip(id, h.sl.rect, 'up'); }
      else hideTip();
      if (h) Au.ui('hover');
    }
    function onLeave() { A.mouse.in = false; if (st.hov) { st.hov = null; st.hovCls = null; hideTip(); root.querySelectorAll('.amr-tag').forEach(t => t.classList.remove('hov')); } }
    function onCanvasClick(e) {
      if (st.leaving) return;
      const r = root.getBoundingClientRect(), h = hitAt(e.clientX - r.left, e.clientY - r.top); if (!h) return;
      if (h.kind === 'hero') { if (h.cls === st.cls && st.view === 'cls') { flourish(h.cls); return; } chooseClass(h.cls); return; }
      if (h.kind === 'slot') { selectSlot(h.sl.i); const b = st.builds[st.cls], id = h.sl.i < 4 ? b.kit[h.sl.i] : b.ult; showTip(id, h.sl.rect, 'up'); return; }
      if (h.kind === 'card') equip(h.cd);
    }
    function onClick(e) {
      const t = e.target;
      if (t.closest('[data-a=back]')) { back(); return; }
      if (t.closest('[data-a=ok]')) { validate(); return; }
      const c = t.closest('[data-cls]'); if (c) { if (c.dataset.cls !== st.cls || st.view !== 'cls') chooseClass(c.dataset.cls); return; }
      const tb = t.closest('[data-tab]'); if (tb) { if (tb.dataset.tab !== st.tab) selectSlot(tb.dataset.tab === 'ult' ? 4 : (st.lastSkill || 0)); return; }
      const sn = t.closest('[data-slot]'); if (sn) { selectSlot(+sn.dataset.slot); }
    }
    function onKey(e) {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName) || UI.current() !== 'asc-armory') return;
      if (e.code === 'Escape') { back(); return; }
      if (st.view !== 'cls') return;
      const i = AR.KEYS.skills.indexOf(e.code); if (i >= 0) { selectSlot(i); return; }
      if (e.code === AR.KEYS.ult) selectSlot(4);
    }
    root.addEventListener('pointermove', onMove); root.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onCanvasClick); root.addEventListener('click', onClick); document.addEventListener('keydown', onKey);

    /* ---------- boucle ---------- */
    const _v = new AV3(), _w = new AV3();
    const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    function projectPx(p) { _v.copy(p).project(cam); return [(_v.x * 0.5 + 0.5) * A.W, (-_v.y * 0.5 + 0.5) * A.H, _v.z]; }
    function loop(now) {
      if (ARM !== A) return;
      A.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - A.last) / 1000)); A.last = now;
      if (document.hidden || !root.isConnected) return;
      A.t += dt; A.uTime.value = A.t;
      const w = innerWidth, h = innerHeight;
      if (A.W !== w || A.H !== h) { A.W = w; A.H = h; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); if (post) post.setSize(w, h); relayout(); }
      // minuteries
      for (let i = A.timers.length - 1; i >= 0; i--) { const T = A.timers[i]; T.t -= dt; if (T.t <= 0) { A.timers.splice(i, 1); T.f(); } }
      // caméra : vol vers la cible (en arc) puis légère respiration + parallaxe de la souris
      const goal = camFor(st.view, st.cls);
      if (A.fly) {
        const F = A.fly; F.k = Math.min(1, F.k + dt / F.dur); const e2 = ease(F.k);
        A.camP.lerpVectors(F.p0, goal.p, e2).y += Math.sin(Math.PI * e2) * 0.5; A.camT.lerpVectors(F.t0, goal.t, e2); A.fov = F.f0 + (goal.f - F.f0) * e2;
        if (F.k >= 1) A.fly = null;
      } else { A.camP.lerp(goal.p, Math.min(1, dt * 4)); A.camT.lerp(goal.t, Math.min(1, dt * 4)); A.fov += (goal.f - A.fov) * Math.min(1, dt * 4); }
      const par = A.mouse.in ? 1 : 0;
      cam.position.copy(A.camP).add(_w.set(Math.sin(A.t * 0.31) * 0.05 + A.mouse.nx * 0.1 * par, Math.sin(A.t * 0.43) * 0.035 - A.mouse.ny * 0.05 * par, 0));
      cam.lookAt(A.camT); if (Math.abs(cam.fov - A.fov) > 1e-3) { cam.fov = A.fov; cam.updateProjectionMatrix(); }
      cam.updateMatrixWorld();
      // héros : regard, lueur, démonstrations de temps en temps
      ARM_CLS.forEach(cls => {
        const H = A.heroes[cls]; if (!H) return;
        const foc = st.view === 'cls' && st.cls === cls;
        const yawT = Math.atan2(cam.position.x - H.pos.x, cam.position.z - H.pos.z) + (foc ? 0.32 : 0);
        H.yaw += BR.angDiff(H.yaw, yawT) * Math.min(1, dt * 3); H.av.group.rotation.y = H.yaw;
        const hov = st.hovCls === cls;
        H.rimK += ((hov ? 1 : foc ? 0.22 + 0.08 * Math.sin(A.t * 2.4) : 0) - H.rimK) * Math.min(1, dt * 8);
        H.rim.value.copy(lin(CL[cls].col)).multiplyScalar(H.rimK * 0.95);
        if (H.orbK) { H.orbK = Math.max(0, H.orbK - dt * 1.5); }
        if (H.held[0] && H.held[0].orb) H.held[0].orb.scale.setScalar((0.55 + 0.08 * Math.sin(A.t * 3) + (H.orbK || 0) * 0.9) / 0.78);
        H.idleT -= dt; if (H.idleT <= 0 && !A.fly) { if (foc || (st.view === 'hall' && Math.random() < 0.5)) flourish(cls, true); else H.idleT = 4 + Math.random() * 6; }
        H.av.update(dt, 0, {});
        // estrade : liseré et lumière
        const k = hov ? 2.8 : foc ? 2.1 + 0.4 * Math.sin(A.t * 2.4) : 1.25 + 0.15 * Math.sin(A.t * 1.7 + H.pos.x);
        const dm = A.dais[cls]; if (dm) { dm.userData.k = (dm.userData.k || k) + (k - (dm.userData.k || k)) * Math.min(1, dt * 6); dm.color.copy(lin(CL[cls].col)).multiplyScalar(dm.userData.k); }
        const dl = A.daisL[cls]; dl.intensity += ((hov ? 1.9 : foc ? 1.1 : 0.45) - dl.intensity) * Math.min(1, dt * 6);
        if (Math.random() < dt * (hov ? 14 : foc ? 6 : 2.2)) { const a = Math.random() * 6.283, r = 0.55 + Math.random() * 0.35; fx.spark(_v.set(H.pos.x + Math.cos(a) * r, ARM_TOP + 0.05, H.pos.z + Math.sin(a) * r), _w.set(0, 0.6 + Math.random() * 0.8, 0), { color: CL[cls].col, life: 1.3, size: 0.09, size1: 0.01 }); }
      });
      // projecteur sur le héros choisi
      const fh = st.view === 'cls' && A.heroes[st.cls];
      spot.intensity += ((fh ? 2.2 : 0) - spot.intensity) * Math.min(1, dt * 3);
      if (fh) { spot.position.lerp(_v.set(fh.pos.x, 7.2, fh.pos.z + 2.4), Math.min(1, dt * 4)); spot.target.position.lerp(_w.set(fh.pos.x, 1.0, fh.pos.z), Math.min(1, dt * 4)); }
      // feux, bougies
      A.fireL.forEach((l, i) => { l.intensity = 1.45 + Math.sin(A.t * 13 + i * 2) * 0.12 + Math.random() * 0.15; });
      if (A.chandL) A.chandL.intensity = 1.25 + Math.sin(A.t * 7.3) * 0.05 + Math.random() * 0.05;
      A.fires.forEach(f => { if (Math.random() < dt * (f.front ? 16 : 10)) fx.spark(_v.copy(f.p).add(_w.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)), _w.set((Math.random() - 0.5) * 0.3, 1.1 + Math.random() * 1.2, (Math.random() - 0.5) * 0.3), { color: 0xff9a3a, life: 0.75, size: 0.26, size1: 0.03, drag: 0.5 }); });
      if (A.dust) A.dust.uniforms.uScale.value = A.H * 0.9;
      // étiquettes des héros (vue d'ensemble) et zones cliquables
      A.heroR = A.heroR || {};
      ARM_CLS.forEach(cls => {
        const p = A.spots[cls], a = projectPx(_w.set(p.x, ARM_TOP + 2.15, p.z)), b = projectPx(_w.set(p.x, 0.02, p.z + 1.25)), half = Math.abs(b[1] - a[1]) * 0.36;
        A.heroR[cls] = st.view === 'hall' || !A.fly ? { x0: a[0] - half, x1: a[0] + half, y0: a[1], y1: b[1] } : null;
        const tg = root.querySelector(`.amr-tag[data-cls="${cls}"]`); if (tg) tg.style.transform = `translate(${Math.round(b[0])}px,${Math.round(b[1] + 6 * A.s)}px) translate(-50%,0)`;
      });
      // cartes
      const mx = A.mouse.x, my = A.mouse.y;
      A.cards.forEach((cd, i) => {
        if (!cd.show || !cd.rect) { if (cd.m.visible && cd.rect) { cd.fl = Math.max(0, cd.fl - dt * 6); cd.mat.opacity = cd.fl; if (cd.fl <= 0) cd.m.visible = false; else place(cd.m, cd.rect, 0.9 + cd.fl * 0.1, 0); } else cd.m.visible = false; return; }
        if (cd.delay > 0) { cd.delay -= dt; cd.m.visible = false; return; }
        cd.fl = Math.min(1, cd.fl + dt * 3.2); cd.m.visible = true;
        const hv = st.hov && st.hov.cd === cd; cd.hov += ((hv ? 1 : 0) - cd.hov) * Math.min(1, dt * 12);
        cd.pulse = Math.max(0, cd.pulse - dt * 2.5); cd.shake = Math.max(0, cd.shake - dt * 3);
        const e2 = ease(cd.fl), r = cd.rect, T = RAR_T[cd.s.rarity] || 0;
        place(cd.m, { x: r.x + Math.sin(cd.shake * 40) * cd.shake * 6 * A.s, y: r.y + Math.sin(A.t * 1.3 + i * 0.7) * 2 * A.s * (1 - cd.hov), w: r.w, h: r.h }, (0.7 + 0.3 * e2) * (1 + cd.hov * 0.1 + cd.pulse * 0.08), cd.hov * 0.05);
        cd.m.rotation.set(-((my - r.y) / r.h) * 0.3 * cd.hov, (1 - e2) * 1.5 + ((mx - r.x) / r.w) * 0.35 * cd.hov, 0);
        const glow = cd.locked ? 0.55 : 0.8 + (T === 3 ? 0.05 * Math.sin(A.t * 3 + i) : 0);
        cd.mat.color.setScalar(glow + cd.hov * (cd.locked ? 0.15 : 0.35) + cd.pulse * 0.4); cd.mat.opacity = e2;
      });
      // emplacements
      A.slots.forEach(sl => {
        const on = st.view === 'cls' && !!st.cls && !!sl.rect && !(A.fly && A.fly.k < 0.5);
        if (!on) { if (st.view !== 'cls') sl.fl = 0; sl.m.visible = false; return; }
        sl.m.visible = true;
        sl.fl = Math.min(1, sl.fl + dt * 2.5); const e2 = ease(sl.fl);
        const hv = st.hov && st.hov.sl === sl; sl.hov += ((hv ? 1 : 0) - sl.hov) * Math.min(1, dt * 12); sl.pulse = Math.max(0, sl.pulse - dt * 2);
        const act = st.slot === sl.i;
        place(sl.m, sl.rect, (0.6 + 0.4 * e2) * (1 + sl.hov * 0.07 + sl.pulse * 0.12 + (act ? 0.03 * Math.sin(A.t * 4) : 0)), 0);
        sl.mat.color.setScalar(0.82 + sl.hov * 0.25 + sl.pulse * 0.5); sl.mat.opacity = e2;
      });
      // cartes qui s'envolent vers un emplacement
      for (let i = A.flies.length - 1; i >= 0; i--) {
        const F = A.flies[i]; F.k = Math.min(1, F.k + dt / 0.38); const e2 = ease(F.k), to = F.to.rect;
        const r = { x: F.from.x + (to.x - F.from.x) * e2, y: F.from.y + (to.y - F.from.y) * e2 - Math.sin(Math.PI * e2) * 70 * A.s, w: F.from.w + (to.w * CARD_AR - F.from.w) * e2, h: F.from.h + (to.w - F.from.h) * e2 };
        place(F.m, r, 1, 0.02); F.m.rotation.z = Math.sin(Math.PI * e2) * 0.3; F.m.material.opacity = 1 - Math.max(0, (F.k - 0.75) / 0.25);
        if (F.k >= 1) { camGroup.remove(F.m); F.m.material.dispose(); A.flies.splice(i, 1); F.to.pulse = 1; F.to.sig = ''; redrawSlots(); paintBuild(); Au.fx('reveal', { rate: 1.6, g: 0.4 }); const H = A.heroes[st.cls]; if (H) fx.burst(H.pos.clone().add(new AV3(0, 1.2, 0)), { n: 16, color: CL[st.cls].col, speed: 3, life: 0.6, size: 0.1, grav: -1 }); }
      }
      // voile sombre sous les cartes
      const vh = 2 * (CARD_D + 0.05) * Math.tan(cam.fov * Math.PI / 360); shade.position.set(0, 0, -(CARD_D + 0.05)); shade.scale.set(vh * cam.aspect, vh, 1);
      shadeMat.uniforms.uF.value += ((st.view === 'cls' ? 1 : 0) - shadeMat.uniforms.uF.value) * Math.min(1, dt * 3);
      fx.update(dt, dt); if (petals) petals.update(dt);
      R.info.reset();
      if (post) post.render(dt); else R.render(scene, cam);
      A.calls = R.info.render.calls;
    }

    /* ---------- départ ---------- */
    paintAll();
    A.W = 0; A.H = 0;
    const h0 = camFor('hall'); A.camP.copy(h0.p); A.camT.copy(h0.t); A.fov = h0.f;
    ARM_CLS.forEach(cls => { const H = A.heroes[cls]; if (H) { H.yaw = Math.atan2(h0.p.x - H.pos.x, h0.p.z - H.pos.z); H.av.group.rotation.y = H.yaw; } });
    // classe déjà choisie : petit plan d'ensemble, puis la caméra s'approche d'elle
    if (st.cls) { const c0 = st.cls; buildOf(c0); later(0.45, () => { if (st.view === 'hall' && st.cls === c0) chooseClass(c0, { dur: 1.6, quiet: true }); }); }
    A.raf = requestAnimationFrame(loop);

    return {
      dispose() {
        if (ARM === A) ARM = null;
        cancelAnimationFrame(A.raf);
        root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('click', onCanvasClick); root.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey);
        A.flies.forEach(F => F.m.material.dispose()); A.flies.length = 0;
        ARM_CLS.forEach(cls => dropHero(A.heroes[cls])); A.heroes = {};
        try { fx.dispose(); } catch (e) { /* rien */ }
        try { if (petals) petals.dispose(); } catch (e) { /* rien */ }
        try { if (post) post.dispose(); } catch (e) { /* rien */ }
        A.own.forEach(x => { try { x.dispose(); } catch (e) { /* rien */ } }); A.own.length = 0;
        R.dispose(); try { R.forceContextLoss(); } catch (e) { /* rien */ }
      },
    };
  }
  let armView = null;
  UI.screen('asc-armory', {
    enter(n) {
      BR.curGame = 'arena'; BR.ascMode = true;
      if (armView) { armView.dispose(); armView = null; }
      // pas de décor d'arène derrière cet écran : il a sa propre scène
      Promise.resolve().then(() => { if (UI.current() === 'asc-armory' && BR.ArenaUI) BR.ArenaUI.bg(false); });
      try { armView = armory(n); }
      catch (err) { console.error('maître d\'armes', err); n.innerHTML = `<div class="amr-err"><p>La salle d'armes n'a pas pu s'afficher.</p><button class="btn" data-a="back">${ICO('back', 16)} Retour au village</button></div>`; n.onclick = e => { if (e.target.closest('[data-a=back]')) UI.show('asc'); }; }
    },
    leave() { if (armView) { armView.dispose(); armView = null; } },
  });
  Q._armory = () => ARM;   // outil de test (console)
})();

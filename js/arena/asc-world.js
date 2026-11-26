/* ===== arena/asc-world.js : l'Ascension SANS fenêtres — tout se passe dans l'arène =====
   - reliques sur autels (bénédictions, pouvoirs, trésor, cœur) : on s'approche pour lire, on reste dessus pour prendre
   - portails (modèle Blender + tourbillon) : on entre dedans pour voter ; tout le monde est aspiré dans le gagnant
   - salles : feu de camp (3 autels), marchand (échoppe + vendeur + étals), autel maudit
   - arrivée sur un étage : les pétales reforment chaque joueur dans un rayon de lumière
   Le déroulement (qui choisit quoi, réseau) reste dans asc-run.js ; ici : objets 3D, interaction, animations. */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, AR = BR.ARENA, Q = BR.Asc;
  const W = (Q.W = {});
  const TAKE_KEY = 'KeyE';   // on s'approche pour lire, on appuie sur E pour prendre
  const R = () => BR.ArenaScene.R;

  /* ---------- étiquettes 3D (texte sur sprite) ---------- */
  function label(lines, o) {
    o = o || {};
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      const y = lines.length === 1 ? 80 : 50 + i * 62;
      g.font = (i === 0 ? '700 54px Oswald, Arial Narrow, sans-serif' : '500 36px Inter, Arial, sans-serif');
      g.lineWidth = 9; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(ln.t, 256, y);
      g.fillStyle = ln.c || '#ffffff'; g.fillText(ln.t, 256, y);
    });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: o.depth !== false }));
    s.scale.set(o.w || 4.2, (o.w || 4.2) * 160 / 512, 1); s.renderOrder = 12;
    return s;
  }
  // icône d'une récompense : glyphe de bénédiction, icône de pouvoir…
  function iconTex(it, cls) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    // icône sur un médaillon sombre cerclé de couleur : lisible même avec le bloom
    const draw = src => { const im = new Image(); im.onload = () => { g.save(); g.beginPath(); g.arc(64, 64, 54, 0, 7); g.clip(); g.drawImage(im, 18, 18, 92, 92); g.restore(); t.needsUpdate = true; }; im.src = src; };
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const rc = it.t === 'boon' ? Q.FAM[Q.boon(it.id).f].col : it.t === 'new' || it.t === 'up' ? (AR.skill(it.id) || {}).color || '#ffffff' : '#ffd76a';
    g.fillStyle = '#14111c'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = rc; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.stroke();
    if (it.t === 'boon') { const B = Q.boon(it.id); draw('data:image/svg+xml;utf8,' + encodeURIComponent(Q.glyph(B.f, 128).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))); }
    else if (it.t === 'new' || it.t === 'up') draw(AR.icon(it.id, 128));
    else { g.fillStyle = it.t === 'gold' ? '#ffc83a' : it.t === 'heart' ? '#ff4a6a' : '#7dff9a'; g.beginPath(); g.arc(64, 64, 44, 0, 7); g.fill(); }
    void cls;
    return t;
  }
  const RCOL = r => BR.RARITY[r] ? BR.RARITY[r].color : '#ffffff';
  function itemInfo(it, M) {
    const cls = M.cls;
    if (it.t === 'boon') { const B = Q.boon(it.id), lv = (M.boons[B.id] || 0) + 1, old = Q.boonOnSlot(M, B.s), rep = old && old.id !== B.id ? old : null; return { slot: Q.SLOTS[B.s].n, rep: rep ? rep.n : '', col: RCOL(B.r), fc: Q.FAM[B.f].col, name: B.n, rar: BR.RARITY[B.r].label + (B.duo ? ' · DUO' : ''), fam: Q.FAM[B.f].n, lv: lv > 1 ? 'Niveau ' + (lv - 1) + ' → ' + lv : 'Nouveau', d: B.d(lv), glyph: Q.glyph(B.f, 54) }; }
    if (it.t === 'new' || it.t === 'up') { const s = AR.skill(it.id), lv = it.t === 'up' ? (M.lv[s.id] || 1) + 1 : 1; return { col: RCOL(s.rarity), fc: s.color, name: Q.skillName(s.id, cls), rar: (s.type === 'ult' ? 'ULTIME · ' : '') + BR.RARITY[s.rarity].label, fam: it.t === 'up' ? 'Maîtrise' : s.type === 'ult' ? 'Nouvel ultime' : 'Nouveau pouvoir', lv: it.t === 'up' ? 'Niveau ' + (lv - 1) + ' → ' + lv : 'Niveau 1', d: Q.skillDesc(s.id, cls) + (it.t === 'up' && (lv === 3 || lv === 5) ? '<br><b>Éveil :</b> ' + Q.awText(s.id, cls, lv) : ''), img: AR.icon(s.id, 96) }; }
    if (it.t === 'gold') return { col: '#ffc83a', fc: '#ffc83a', name: '+' + it.v + ' or', rar: 'Trésor', fam: 'Coffre', lv: '', d: 'De quoi faire chauffer la bourse chez le marchand.', glyph: Q.coinSvg(54) };
    if (it.t === 'heart') return { col: '#ff4a6a', fc: '#ff4a6a', name: 'Cœur de colosse', rar: 'Cœur', fam: '', lv: '', d: '+120 PV max et la moitié de tes PV rendus.', glyph: BR.Icons.svg('heart', 54) };
    if (it.t === 'heal') return { col: '#7dff9a', fc: '#7dff9a', name: 'Soin ' + Math.round(it.v * 100) + ' %', rar: 'Potion', fam: '', lv: '', d: 'Remet de l\'ordre dans tes PV.', glyph: BR.Icons.svg('heart', 54) };
    if (it.t === 'rest') return { col: '#7dff9a', fc: '#7dff9a', name: 'Se reposer', rar: 'Feu de camp', fam: '', lv: '', d: 'Récupère <b>' + Math.round(it.v * 100) + ' %</b> de tes PV.', glyph: BR.Icons.svg('heart', 54) };
    if (it.t === 'forge') return { col: '#ffb24a', fc: '#ffb24a', name: 'Forger', rar: 'Feu de camp', fam: '', lv: '', d: '+1 niveau sur un de tes pouvoirs (au choix).', glyph: BR.Icons.svg('bolt', 54) };
    if (it.t === 'medit') return { col: '#ffd76a', fc: '#ffd76a', name: 'Méditer', rar: 'Feu de camp', fam: '', lv: '', d: '+1 niveau sur une de tes bénédictions (au choix).', glyph: Q.glyph('univ', 54) };
    if (it.t === 'reroll') return { col: '#b9a6ff', fc: '#b9a6ff', name: 'Relancer', rar: 'Destin', fam: '', lv: '', d: 'Remplace les choix proposés (' + it.n + ' restante' + (it.n > 1 ? 's' : '') + ').', glyph: BR.Icons.svg('refresh', 54) };
    if (it.t === 'home') return { col: '#ffd76a', fc: '#ffd76a', name: 'Rentrer en héros', rar: 'Victoire', fam: '', lv: '', d: 'Termine la course et rentre au village (la carte suivante se débloque). La porte, elle, mène à l\'Infini…', glyph: BR.Icons.svg('crown', 54) };
    if (it.t === 'pact') return { col: '#b06bff', fc: '#b06bff', name: 'Accepter le pacte', rar: 'Autel maudit', fam: '', lv: '', d: '<b>' + BR.esc(it.curse.n) + '</b> : ' + BR.esc(it.curse.d) + '<br>En échange : une bénédiction épique ou légendaire au choix.', glyph: Q.glyph('maudit', 54) };
    return { col: '#fff', fc: '#fff', name: '?', rar: '', fam: '', lv: '', d: '' };
  }

  /* ---------- état de l'étage en cours ---------- */
  let S = null, objs = [], portals = [], near = null, holdT = 0, prompt = null, sealed = true, pendingRep = null;
  W.reset = function (sess) {
    // l'étage précédent : on libère les matériaux, textures et ressources propres des objets restants (coffres ouverts…)
    if (S) objs.slice().forEach(o => { try { removeObj(o); } catch (e) { console.warn(e); } });
    S = sess; objs = []; portals = []; near = null; holdT = 0; sealed = true; pendingRep = null; W.myVote = undefined; W.sucking = null;
    prompt = BR.el('div', { class: 'asc-prompt' }); S.hud.appendChild(prompt);
    document.removeEventListener('keydown', repKey); document.addEventListener('keydown', repKey);
  };
  W.alive = () => !!S && BR.Arena.session() === S;
  function addObj(o) { objs.push(o); return o; }
  function removeObj(o, burst) {
    const i = objs.indexOf(o); if (i >= 0) objs.splice(i, 1);
    if (burst && o.pos) { const p = BR.AscFX.petals(S.scene); p.burst(o.pos.clone().setY(0.6), 2, 0.6, [o.color || '#ffffff', '#ffffff'], 30, 0.8); }
    if (o.dispose) { o.dispose(); o.dispose = null; }
    if (o.group) { S.scene.remove(o.group); o.group.traverse(m => { if (m.material && !m.userData.shared) { (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { if (x.map && x.map.isCanvasTexture) x.map.dispose(); x.dispose(); }); } }); }
  }
  W.clearRelics = function (tag) { objs.filter(o => !tag || o.tag === tag).slice().forEach(o => removeObj(o, true)); };
  const model = name => { const g = BR.Assets.models['asc_' + name]; if (!g) return null; const m = g.scene.clone(true); m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.shared = true; } }); return m; };

  /* ---------- autel de relique ---------- */
  /** pose une relique (it) sur un autel en p ; onTake(it) quand le joueur la prend */
  W.relic = function (p, it, onTake, o) {
    o = o || {};
    const info = itemInfo(it, Q.me()), col = new THREE.Color(info.col);
    const g = new THREE.Group(); g.position.copy(p); S.scene.add(g);
    const ped = model('p_pedestal'); if (ped) { ped.traverse(m => { if (m.isMesh && m.material && /glow/.test(m.material.name || '')) { m.material = m.material.clone(); m.material.emissive = col.clone(); m.userData.shared = false; } }); g.add(ped); }
    // la relique : icône flottante dans une bulle de lumière
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(it), transparent: true, depthWrite: false, toneMapped: false })); sp.scale.setScalar(1.35); sp.position.y = 2.05; g.add(sp);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 14), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.6), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.y = 2.05; g.add(halo);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 9, 18, 1, true), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.8), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 4.6; g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.6, 40), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const prog = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.6, 40, 1, 0, 0.001), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false })); prog.rotation.x = -Math.PI / 2; prog.position.y = 0.07; g.add(prog);
    if (info.slot || it.t === 'new' || it.t === 'up') { const tl = label([{ t: (info.slot || (it.t === 'up' ? 'AMÉLIORATION' : 'POUVOIR')).toUpperCase(), c: info.fc }, { t: info.name, c: '#ffffff' }], { w: 3.4 }); tl.position.y = o.price ? 3.75 : 3.2; g.add(tl); }
    if (o.price) { const lb = label([{ t: o.price + ' or', c: '#ffd84a' }], { w: 2.4 }); lb.position.y = 3.0; g.add(lb); o.priceLabel = lb; }
    BR.AscFX.petals(S.scene).gather(p.clone(), 2.4, 0.6, [info.col, '#ffffff'], 40, 0.8);
    const obj = addObj({ kind: 'relic', tag: o.tag || 'reward', it, info, pos: p.clone(), r: 1.6, group: g, color: info.col, onTake, price: o.price, prog,
      update(dt, t) { sp.position.y = 2.05 + Math.sin(t * 2 + p.x) * 0.12; halo.position.y = sp.position.y; halo.scale.setScalar(1 + Math.sin(t * 3) * 0.06); ring.rotation.z += dt * 0.6; if (Math.random() < dt * 6) S.fx.spark(p.clone().add(new V3((Math.random() - 0.5) * 1.2, 0.3, (Math.random() - 0.5) * 1.2)), new V3(0, 2, 0), { color: info.col, life: 0.8, size: 0.2, size1: 0.02 }); } });
    return obj;
  };
  // coffre (trésor) : on s'approche, E pour l'ouvrir (modèle du coffre commun ; ancien coffre en secours)
  W.chest = function (p, v, onTake) {
    const g = new THREE.Group(); g.position.copy(p); S.scene.add(g);
    const ch = model('p_chest_commun') || model('p_chest'); let lid = null; if (ch) { g.add(ch); ch.scale.setScalar(1.1); ch.rotation.y = Math.atan2(-p.x, -p.z); ch.traverse(o => { if (!lid && o.name === 'lid') lid = o; }); }
    const it = { t: 'gold', v };
    // keep: false → une seule ouverture (sinon E deux fois avant la disparition = l'or compté deux fois)
    return addObj({ kind: 'chest', tag: 'reward', it, info: itemInfo(it, Q.me()), pos: p.clone(), r: 1.8, group: g, color: '#ffc83a', onTake, lid, verb: 'ouvrir',
      update(dt, t) { if (this.open && lid) lid.rotation.x = Math.max(-1.9, lid.rotation.x - dt * 6); else if (Math.random() < dt * 3) S.fx.spark(p.clone().add(new V3((Math.random() - 0.5), 1, (Math.random() - 0.5))), new V3(0, 1.5, 0), { color: 0xffd84a, life: 0.6, size: 0.18 }); void t; } });
  };

  /* ---------- coffres de rareté (fin de combat) ----------
     W.lootChest(p, tier, onOpen) : le coffre apparaît (commun/rare : tombe du ciel ; épique : sort du sol en pétales ;
     légendaire : descend lentement dans une colonne d'or), on s'approche, E pour l'ouvrir ; animation selon la rareté,
     puis onOpen() (les reliques apparaissent devant, vers +z). Il reste ouvert jusqu'à la fin de l'étage (nettoyé par W.reset). */
  const CHEST = {
    commun: { m: 'p_chest_commun', s: 1.1, top: 1.2, mouth: 0.72, beam: 0.05, aura: 0.32, spk: 1.5, stars: '★', d: 'Un coffre de bois tout simple. Dedans : des récompenses <b>communes</b>.' },
    rare: { m: 'p_chest_rare', s: 1.12, top: 1.4, mouth: 0.86, beam: 0.09, aura: 0.45, spk: 3, stars: '★★', d: 'Cerclé d\'acier bleu, il garde des récompenses <b>rares</b>.' },
    epique: { m: 'p_chest_epique', s: 1.15, top: 1.75, mouth: 0.96, beam: 0.13, aura: 0.6, spk: 6, stars: '★★★', d: 'Il vibre d\'une magie violette : des récompenses <b>épiques</b> t\'attendent.' },
    legendaire: { m: 'p_chest_legendaire', s: 1.15, top: 2.35, mouth: 1.08, beam: 0.2, aura: 0.8, spk: 10, stars: '★★★★', d: 'Une lumière d\'or filtre sous le couvercle… des récompenses <b>légendaires</b> !' },
  };
  const chestSvg = (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><path d="M9 30Q9 12 32 12Q55 12 55 30Z" fill="${c}" stroke="#000" stroke-opacity=".55" stroke-width="2"/><rect x="7" y="30" width="50" height="24" rx="3" fill="${c}" stroke="#000" stroke-opacity=".55" stroke-width="2"/><rect x="7" y="29" width="50" height="5" fill="#000" opacity=".35"/><rect x="17" y="12" width="5" height="42" fill="#000" opacity=".28"/><rect x="42" y="12" width="5" height="42" fill="#000" opacity=".28"/><rect x="27" y="26" width="10" height="13" rx="2" fill="#fff" opacity=".92"/><rect x="31" y="30" width="2" height="5" fill="#000" opacity=".7"/></svg>`;
  // petites textures dessinées (une par coffre : removeObj les libère avec les matériaux)
  function gradTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
  const radialTex = () => gradTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  // bas opaque → haut transparent (en UV : v = 0 en bas), bords adoucis si soft
  const fadeTex = soft => gradTex(soft ? 32 : 4, 128, (g, w, h) => {
    const v = g.createLinearGradient(0, h, 0, 0); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.35, 'rgba(255,255,255,0.55)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
    if (soft) { g.globalCompositeOperation = 'destination-in'; const x = g.createLinearGradient(0, 0, w, 0); x.addColorStop(0, 'rgba(0,0,0,0)'); x.addColorStop(0.5, 'rgba(0,0,0,1)'); x.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = x; g.fillRect(0, 0, w, h); }
  });
  // gerbe de rayons de lumière qui sortent du coffre (une seule géométrie : deux quads croisés par rayon)
  function raysGeo(n, L, w0, w1, tilt) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + (i % 2) * 0.25, tl = tilt * (0.55 + (i % 3) * 0.3), len = L * (0.65 + ((i * 7) % 5) * 0.09);
      const dir = new V3(Math.sin(tl) * Math.cos(a), Math.cos(tl), Math.sin(tl) * Math.sin(a)), t1 = new V3(-Math.sin(a), 0, Math.cos(a)), t2 = new V3().crossVectors(dir, t1).normalize();
      for (const sd of [t1, t2]) {
        const b = pos.length / 3, tip = dir.clone().multiplyScalar(len);
        [sd.clone().multiplyScalar(-w0), sd.clone().multiplyScalar(w0), tip.clone().addScaledVector(sd, -w1), tip.clone().addScaledVector(sd, w1)].forEach(v => pos.push(v.x, v.y, v.z));
        uv.push(0, 0, 1, 0, 0, 1, 1, 1); idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  }
  const ease = k => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
  const back = k => { k = Math.max(0, Math.min(1, k)); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

  W.lootChest = function (p, tier, onOpen) {
    if (!CHEST[tier]) tier = 'commun';
    p = p.clone();
    const C = CHEST[tier], col = RCOL(tier), colC = new THREE.Color(col), rl = (BR.RARITY[tier] || { label: tier }).label;
    const lvl = ['commun', 'rare', 'epique', 'legendaire'].indexOf(tier);
    const g = new THREE.Group(); g.position.copy(p); S.scene.add(g);
    const body = new THREE.Group(); g.add(body);
    const geos = [];   // nos géométries (celles du modèle sont partagées)
    const G = x => { geos.push(x); return x; };
    // le modèle (avant vers +z : le couvercle s'ouvre vers l'arrière, les reliques apparaissent devant)
    const ch = model(C.m) || model('p_chest'); let lid = null;
    if (ch) { ch.scale.setScalar(C.s); body.add(ch); ch.traverse(o => { if (!lid && o.name === 'lid') lid = o; }); }
    const mouthY = C.mouth * C.s, topY = C.top * C.s;
    // au sol : halo coloré + anneau qui tourne (+ anneau intérieur à partir d'épique)
    const disc = new THREE.Mesh(G(new THREE.CircleGeometry(2.6, 40)), new THREE.MeshBasicMaterial({ map: radialTex(), color: colC.clone().multiplyScalar(1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; g.add(disc);
    const ring = new THREE.Mesh(G(new THREE.RingGeometry(1.75, 1.98, 56)), new THREE.MeshBasicMaterial({ color: colC.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    let ring2 = null;
    if (lvl >= 2) { ring2 = new THREE.Mesh(G(new THREE.RingGeometry(2.15, 2.24, 6 + lvl * 2)), new THREE.MeshBasicMaterial({ color: colC.clone().multiplyScalar(1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.07; g.add(ring2); }
    // faisceau vertical visible de loin (plus large et plus vif selon la rareté)
    const bw = 0.45 + lvl * 0.15;
    const beam = new THREE.Mesh(G(new THREE.CylinderGeometry(bw, bw * 1.5, 28, 20, 1, true)), new THREE.MeshBasicMaterial({ map: fadeTex(false), color: colC.clone().multiplyScalar(1.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 14; g.add(beam);
    // rayons (épique, légendaire) : lumière qui fuit du coffre puis jaillit à l'ouverture
    let rays = null;
    if (lvl >= 2) { rays = new THREE.Mesh(G(raysGeo(lvl === 3 ? 14 : 10, lvl === 3 ? 5.5 : 4, 0.06, lvl === 3 ? 0.55 : 0.4, lvl === 3 ? 0.75 : 0.6)), new THREE.MeshBasicMaterial({ map: fadeTex(true), color: colC.clone().multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); rays.position.y = mouthY; rays.scale.setScalar(0.3); rays.visible = false; body.add(rays); }
    // étiquette 3D au-dessus
    let tag = label([{ t: ('Coffre ' + rl).toUpperCase(), c: col }, { t: C.stars, c: col }], { w: 4.4 }); tag.position.y = topY + 1.05; tag.visible = false; g.add(tag);
    const info = { col, fc: col, name: 'Coffre ' + rl.toLowerCase(), rar: rl, fam: 'Coffre', lv: '', d: C.d, glyph: chestSvg(col, 54) };
    const pet = BR.AscFX.petals(S.scene), mouth = () => p.clone().setY(body.position.y + mouthY);
    // pluie de pièces (légendaire) : une seule InstancedMesh
    let coins = null;
    function coinRain(n) {
      const cg = G(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 12)), cm = new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0x7a4a00, emissiveIntensity: 0.7, roughness: 0.45, metalness: 0.2 });
      const im = new THREE.InstancedMesh(cg, cm, n); im.frustumCulled = false; g.add(im);
      const list = [];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 4.5;
        list.push({ p: new V3((Math.random() - 0.5) * 0.6, mouthY + 0.2, (Math.random() - 0.5) * 0.4), v: new V3(Math.cos(a) * sp, 7 + Math.random() * 6, Math.sin(a) * sp * 0.8 + 1.2), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: new V3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 18), age: -Math.random() * 0.35, life: 2.6 + Math.random() * 1.2 });
      }
      coins = { im, list, clink: 0, d: new THREE.Object3D() };
    }
    function coinStep(dt) {
      const c = coins; c.clink -= dt; let alive = 0;
      for (let i = 0; i < c.list.length; i++) {
        const k = c.list[i]; k.age += dt;
        let sc = 0;
        if (k.age >= 0 && k.age < k.life) {
          alive++;
          k.v.y -= 16 * dt; k.p.addScaledVector(k.v, dt); k.r.x += k.w.x * dt; k.r.y += k.w.y * dt; k.r.z += k.w.z * dt;
          if (k.p.y < 0.03 && k.v.y < 0) {
            if (k.v.y < -2.5 && c.clink <= 0) { c.clink = 0.045; BR.Audio.fx('spin', { v: 0.6 + Math.random() * 0.4, g: 0.7 }); }
            k.p.y = 0.03; k.v.y *= -0.32; k.v.x *= 0.55; k.v.z *= 0.55; k.w.multiplyScalar(0.5);
            if (Math.abs(k.v.y) < 0.6) { k.v.y = 0; k.r.x = Math.PI / 2 * Math.round(k.r.x / (Math.PI / 2)); k.w.set(0, k.w.y * 0.5, 0); }
          }
          sc = k.age < 0.06 ? k.age / 0.06 : Math.min(1, (k.life - k.age) / 0.4);
        } else if (k.age < 0) alive++;
        c.d.position.copy(k.p); c.d.rotation.copy(k.r); c.d.scale.setScalar(Math.max(0.0001, sc)); c.d.updateMatrix(); c.im.setMatrixAt(i, c.d.matrix);
      }
      c.im.instanceMatrix.needsUpdate = true;
      if (!alive) { g.remove(c.im); c.im.material.dispose(); coins = null; }
    }
    // dissolution (apparition épique) : copies de matériaux, libérées avec le coffre
    let dis = null;
    const spawnKind = lvl <= 1 ? 'drop' : lvl === 2 ? 'rise' : 'descend';
    const SPAWN_T = { drop: 0.6, rise: 1.25, descend: 1.75 }[spawnKind];
    if (spawnKind === 'drop') { body.position.y = 9; }
    if (spawnKind === 'rise' && ch) { dis = BR.AscFX.dissolve(ch, col); dis.U.uY0.value = p.y - 0.4; dis.U.uH.value = topY + 0.6; dis.set(0); body.position.y = -0.35; pet.gather(p.clone(), topY, 1.1, [col, '#ffffff', '#ff8af0'], 110, 1.1); BR.Audio.fx('magic', { rate: 0.7 }); BR.Audio.fx('reveal', { rate: 0.75, g: 0.5 }); }
    if (spawnKind === 'descend') { body.position.y = 8; body.visible = false; S.fx.pillar(p.clone(), { color: col, r: 1.7, h: 34, life: 2.6, alpha: 0.85, grow: 0.25 }); pet.gather(p.clone(), 3, 1.4, [col, '#ffffff', '#fff2b0'], 120, 1.6); BR.Audio.fx('timestop', { g: 0.35 }); BR.Audio.fx('charge', { len: 1.7, g: 0.7 }); }
    if (spawnKind === 'drop') BR.Audio.fx('swingBig', { rate: 0.6, g: 0.7 });
    const st = { ph: 'spawn', t: 0, f: {}, rat: 1.5 + Math.random(), glow: 0 };
    const once = (k, fn) => { if (!st.f[k]) { st.f[k] = 1; fn(); } };
    const impact = big => {
      const q = p.clone();
      S.fx.ring(q, { r0: 0.4, r1: big ? 11 : 5 + lvl, color: col, life: big ? 0.8 : 0.5, width: 0.3 });
      if (big) S.fx.ring(q, { r0: 0.3, r1: 6, color: 0xffffff, life: 0.45, width: 0.2 });
      S.fx.burst(q.clone().setY(0.25), { n: big ? 34 : 18, kind: 'smoke', color: 0x8c7c66, speed: big ? 6 : 4, up: 0.3, flat: true, life: 1, size: 0.8, size1: 1.6, grav: -0.4, alpha: 0.5 });
      if (lvl >= 1) S.fx.burst(q.clone().setY(0.6), { n: 16 + lvl * 14, color: col, speed: 6 + lvl * 2, up: 1.2, life: 0.7, size: 0.28 });
      S.fx.light(q.clone().setY(1.5), col, 2 + lvl * 1.5, 10 + lvl * 3, 0.4);
      BR.Audio.fx('stomp', { g: 0.5 + lvl * 0.15 }); if (big) BR.Audio.fx('boom', { g: 0.6, len: 1.1 }); else if (lvl === 1) BR.Audio.fx('ice', { g: 0.8 });
      BR.Arena.shake(big ? 0.55 : 0.12 + lvl * 0.06); if (big) S.fovKick = Math.max(S.fovKick || 0, 10);
    };
    const sparkle = (n, up, spread) => { for (let k = 0; k < n; k++) S.fx.spark(mouth().add(new V3((Math.random() - 0.5) * spread, 0.1, (Math.random() - 0.5) * spread * 0.6)), new V3((Math.random() - 0.5) * 2, up * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 2 + 0.6), { color: Math.random() < 0.3 ? 0xffffff : col, life: 0.9, size: 0.26, size1: 0.02, grav: 2 }); };
    const removeTag = () => { if (!tag) return; g.remove(tag); tag.material.map.dispose(); tag.material.dispose(); tag = null; };
    const setLid = a => { if (lid) lid.rotation.x = a; };

    function spawnStep(dt) {
      const t = st.t, k = Math.min(1, t / SPAWN_T);
      if (spawnKind === 'drop') {
        if (t < SPAWN_T) { body.position.y = 9 * (1 - k * k); if (lvl === 1 && Math.random() < 0.8) S.fx.spark(p.clone().setY(body.position.y + 0.8), new V3(0, 6, 0), { color: col, life: 0.35, size: 0.4, size1: 0.05 }); }
        else { body.position.y = 0; once('imp', () => impact(false)); const q = Math.min(1, (t - SPAWN_T) / 0.32); body.scale.set(1 + Math.sin(q * Math.PI) * 0.12 * (1 - q), 1 - Math.sin(q * Math.PI) * 0.2 * (1 - q), 1 + Math.sin(q * Math.PI) * 0.12 * (1 - q)); if (q >= 1) return true; }
        disc.material.opacity = C.aura * k; disc.scale.setScalar(0.4 + 0.6 * k);
      } else if (spawnKind === 'rise') {
        const e = ease(k); body.position.y = -0.35 * (1 - e); if (dis) dis.set(k * 1.02);
        if (Math.random() < 0.6) S.fx.spark(p.clone().add(new V3((Math.random() - 0.5) * 2, 0.1, (Math.random() - 0.5) * 2)), new V3(0, 2.5, 0), { color: col, life: 0.8, size: 0.25, size1: 0.02 });
        disc.material.opacity = C.aura * e;
        if (k >= 1) { once('imp', () => { if (dis) dis.set(1); S.fx.ring(p.clone(), { r1: 6, color: col, life: 0.5 }); S.fx.flash(p.clone().setY(mouthY), { color: col, r: 1.4, life: 0.3, intensity: 4 }); BR.Audio.fx('ice', { rate: 0.8 }); }); return true; }
      } else {
        const T0 = 0.25, e = ease((t - T0) / (SPAWN_T - T0));
        if (t > T0) { body.visible = true; body.position.y = 8 * (1 - e); body.rotation.y = (1 - e) * Math.PI * 2; if (Math.random() < 0.9) S.fx.spark(p.clone().add(new V3((Math.random() - 0.5) * 1.6, body.position.y + Math.random() * 2, (Math.random() - 0.5) * 1.6)), new V3(0, -1.5, 0), { color: Math.random() < 0.5 ? col : 0xffffff, life: 0.9, size: 0.3, size1: 0.02 }); }
        disc.material.opacity = C.aura * Math.min(1, t / SPAWN_T); disc.scale.setScalar(0.5 + 0.5 * Math.min(1, t / SPAWN_T));
        if (t >= SPAWN_T) {
          body.position.y = 0; body.rotation.y = 0;
          once('imp', () => { impact(true); S.fx.burst(p.clone().setY(1), { n: 60, color: col, speed: 10, up: 1.5, life: 0.9, size: 0.3 }); });
          const q = Math.min(1, (t - SPAWN_T) / 0.4); body.scale.set(1 + Math.sin(q * Math.PI) * 0.1 * (1 - q), 1 - Math.sin(q * Math.PI) * 0.16 * (1 - q), 1 + Math.sin(q * Math.PI) * 0.1 * (1 - q));
          if (q >= 1) return true;
        }
      }
      return false;
    }
    function idleStep(dt, t) {
      const pul = 0.85 + Math.sin(t * 2.2) * 0.15;
      disc.material.opacity = C.aura * pul; ring.material.opacity = 0.55 + lvl * 0.1; beam.material.opacity = C.beam * (0.8 + Math.sin(t * 1.7) * 0.2);
      if (Math.random() < dt * C.spk) S.fx.spark(p.clone().add(new V3((Math.random() - 0.5) * 2.4, 0.2, (Math.random() - 0.5) * 2.4)), new V3(0, 1.6 + lvl * 0.4, 0), { color: col, life: 1, size: 0.2 + lvl * 0.04, size1: 0.02 });
      // à partir de rare : le couvercle se soulève de temps en temps et laisse filer de la lumière
      if (lvl >= 1) {
        st.rat -= dt;
        if (st.rat < 0) { const q = -st.rat / 0.32; setLid(-(0.06 + lvl * 0.03) * Math.sin(Math.min(1, q) * Math.PI)); if (!st.ratFx) { st.ratFx = true; sparkle(3 + lvl * 2, 2.5, 1); BR.Audio.fx('tick', { g: 0.8 }); } if (q >= 1) { setLid(0); st.rat = 1.8 + Math.random() * 1.6; st.ratFx = false; } }
      }
      if (rays && lvl === 3) { rays.visible = true; rays.material.opacity = 0.18 + Math.sin(t * 3) * 0.05; rays.scale.setScalar(0.45); rays.rotation.y += dt * 0.4; }
    }
    // ouverture : chronologie par rareté ; renvoie true quand l'animation est finie
    function openStep(dt) {
      const t = st.t;
      if (lvl === 0) {
        setLid(-1.9 * back(t / 0.38));
        if (t > 0.1) once('b', () => { sparkle(26, 4, 1); S.fx.burst(mouth(), { n: 24, color: 0xffe2a8, speed: 5, up: 2, life: 0.7, size: 0.25 }); S.fx.light(mouth().setY(mouthY + 1), 0xffe2a8, 3, 10, 0.4); BR.Audio.fx('reveal', { rate: 1.2 }); removeTag(); });
        if (t > 0.42) once('o', onOpen);
        return t > 0.7;
      }
      if (lvl === 1) {
        if (t < 0.3) { setLid(-0.08 * Math.abs(Math.sin(t * 40))); body.scale.setScalar(1 + Math.sin(t / 0.3 * Math.PI) * 0.05); once('s', () => BR.Audio.fx('charge', { len: 0.35, g: 0.6 })); }
        else {
          body.scale.setScalar(1); setLid(-1.9 * back((t - 0.3) / 0.3));
          once('b', () => {   // éclat bleu
            S.fx.flash(mouth().setY(mouthY + 0.5), { color: col, r: 2, life: 0.35, intensity: 6 }); S.fx.ring(p.clone(), { r1: 7, color: col, life: 0.5 });
            S.fx.pillar(p.clone(), { color: col, r: 0.9, h: 10, life: 0.7, alpha: 0.8 }); S.fx.burst(mouth(), { n: 50, color: col, speed: 7, up: 2, life: 0.8, size: 0.28 }); sparkle(20, 5, 1);
            BR.Audio.fx('magic'); BR.Audio.fx('reveal', { rate: 1.1 }); BR.Audio.fx('ice', { g: 0.7 }); BR.Arena.shake(0.12); removeTag();
          });
        }
        if (t > 0.75) once('o', onOpen);
        return t > 1.1;
      }
      if (lvl === 2) {
        const T1 = 1.0;
        if (t < T1) {   // il tremble, la lumière violette fuit en rayons
          const k = t / T1;
          body.position.x = Math.sin(t * 61) * 0.05 * k; body.rotation.z = Math.sin(t * 47) * 0.05 * k; setLid(-0.1 * Math.abs(Math.sin(t * 28)) * k);
          rays.visible = true; rays.material.opacity = 0.5 * k; rays.scale.setScalar(0.3 + 0.5 * k); rays.rotation.y += dt * (1 + k * 3);
          if (Math.random() < 0.5 + k) S.fx.spark(mouth().add(new V3((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 0.8)), new V3((Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3), { color: col, life: 0.5, size: 0.25 });
          S.fovKick = Math.max(S.fovKick || 0, 6 * k);
          once('s', () => { BR.Audio.fx('charge', { len: 1.0, g: 0.8 }); });
        } else {
          body.position.x = 0; body.rotation.z = 0; setLid(-1.9 * back((t - T1) / 0.22));
          const k = Math.min(1, (t - T1) / 0.9); rays.scale.setScalar(0.8 + ease(k) * 0.9); rays.material.opacity = 0.75 * (1 - k); rays.rotation.y += dt * 1.5; if (k >= 1) rays.visible = false;
          once('b', () => {
            S.fx.flash(mouth().setY(mouthY + 0.6), { color: col, r: 2.8, life: 0.4, intensity: 7 }); S.fx.ring(p.clone(), { r1: 9, color: col, life: 0.6, width: 0.3 }); S.fx.ring(p.clone(), { r1: 5, color: 0xff8af0, life: 0.4 });
            S.fx.pillar(p.clone(), { color: col, r: 1.2, h: 16, life: 0.9, alpha: 0.9 }); S.fx.burst(mouth(), { n: 70, color: col, speed: 9, up: 2.5, life: 0.9, size: 0.3 }); S.fx.burst(mouth(), { n: 30, color: 0xff8af0, speed: 6, up: 3, life: 1, size: 0.22 });
            BR.Audio.fx('boom', { g: 0.45, rate: 1.3 }); BR.Audio.fx('reveal', { rate: 0.9 }); BR.Audio.fx('zap', { g: 0.7 }); BR.Arena.shake(0.3); S.fovKick = Math.max(S.fovKick || 0, 9);
            BR.Arena.banner('COFFRE ÉPIQUE', 'Choisis ta récompense', 1.5, ''); removeTag();
          });
          if (t > T1 + 0.35) once('o', onOpen);
        }
        return t > T1 + 1.0;
      }
      // légendaire : ralenti (montée en puissance), puis explosion de lumière, onde, pluie de pièces
      const T1 = 1.5;
      if (t < T1) {
        const k = t / T1, e = ease(k);
        once('s', () => {
          BR.Audio.fx('timestop', { g: 0.45 }); BR.Audio.fx('charge', { len: 1.5, g: 0.9 });
          for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2; pet.suck(p.clone().add(new V3(Math.cos(a) * 5, 0.5, Math.sin(a) * 5)), p.clone().setY(mouthY + 0.5), [col, '#ffffff', '#fff2b0'], 14, 1.4); }
          if (S.solo) S.slowT = Math.max(S.slowT || 0, T1);
        });
        body.position.y = 0.45 * e; body.rotation.z = Math.sin(t * 31) * 0.025 * k; body.position.x = Math.sin(t * 53) * 0.03 * k;
        setLid(-0.35 * ease(Math.max(0, (k - 0.2) / 0.8)) - 0.04 * Math.abs(Math.sin(t * 22)) * k);
        rays.visible = true; rays.material.opacity = 0.25 + 0.55 * k; rays.scale.setScalar(0.45 + 0.6 * e); rays.rotation.y += dt * (0.5 + k * 2.5);
        beam.material.opacity = C.beam + 0.5 * e; beam.scale.set(1 + e, 1, 1 + e);
        S.fovKick = Math.max(S.fovKick || 0, 12 * e);
        if (Math.random() < 0.8) sparkle(1, 3, 1.4);
      } else {
        const k = Math.min(1, (t - T1) / 1.6);
        body.position.y = 0.45 * (1 - ease((t - T1) / 0.18)); body.rotation.z = 0; body.position.x = 0;
        setLid(-1.9 * back((t - T1) / 0.2));
        rays.scale.setScalar(1.05 + ease(k) * 0.8); rays.material.opacity = 0.85 * (1 - k); rays.rotation.y += dt * 1.2; if (k >= 1) rays.visible = false;
        beam.material.opacity = (C.beam + 0.5) * (1 - k) + C.beam * 0.5 * k; const bs = 2 - k; beam.scale.set(bs, 1, bs);
        once('b', () => {
          const q = mouth().setY(mouthY + 0.8);
          S.fx.flash(q, { color: col, r: 3.6, life: 0.5, intensity: 9 }); S.fx.flash(q, { color: 0xffffff, r: 1.8, life: 0.25, light: false });
          S.fx.ring(p.clone(), { r1: 15, color: col, life: 1.0, width: 0.25 }); S.fx.ring(p.clone(), { r1: 7, color: 0xffffff, life: 0.5, width: 0.2 });
          S.fx.pillar(p.clone(), { color: col, r: 2.2, h: 40, life: 1.6, alpha: 1, grow: 0.5 });
          S.fx.burst(q, { n: 120, color: col, speed: 13, up: 2, life: 1.1, size: 0.32 }); S.fx.burst(q, { n: 40, color: 0xffffff, speed: 8, up: 3, life: 0.8, size: 0.22 });
          pet.burst(p.clone().setY(0.5), 2.5, 1.2, [col, '#ffffff', '#fff2b0'], 90, 1.4);
          coinRain(46);
          BR.Audio.fx('boom', { len: 1.4, g: 0.8 }); BR.Audio.fx('ult', { g: 0.8 }); BR.Arena.shake(0.7); S.fovKick = Math.max(S.fovKick || 0, 18);
          if (S.flash) S.flash.setRGB(0.55, 0.42, 0.12);
          BR.Arena.banner('LÉGENDAIRE', 'Choisis ta récompense', 2.2, 'gold'); removeTag();
        });
        if (t > T1 + 0.3) once('w', () => BR.Audio.fx('win', { g: 0.8 }));
        if (t > T1 + 0.55) once('o', onOpen);
      }
      return t > T1 + 1.8;
    }
    function doneStep(dt, t) {
      st.glow = Math.min(1, st.glow + dt * 0.8);
      disc.material.opacity = C.aura * (1 - 0.65 * st.glow); ring.material.opacity = (0.55 + lvl * 0.1) * (1 - 0.7 * st.glow); beam.material.opacity = C.beam * (1 - st.glow); beam.visible = st.glow < 1;
      if (Math.random() < dt * (1 + lvl)) S.fx.spark(mouth().add(new V3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.5)), new V3(0, 1.2, 0), { color: col, life: 0.9, size: 0.16, size1: 0.02 });
      void t;
    }
    const obj = addObj({ kind: 'lootchest', tag: 'lootchest', tier, info, pos: p.clone(), r: 2.1, group: g, color: col, verb: 'ouvrir', quiet: true, ready: false,
      onTake() { st.ph = 'open'; st.t = 0; st.f = {}; setLid(0); body.position.y = 0; body.scale.setScalar(1); BR.Audio.ui('ok'); },
      update(dt, t) {
        st.t += dt;
        ring.rotation.z += dt * (0.4 + lvl * 0.2); if (ring2) { ring2.rotation.z -= dt * 0.25; ring2.material.opacity = ring.material.opacity * 0.7; }
        if (st.ph === 'spawn') {
          ring.material.opacity = Math.min(0.55 + lvl * 0.1, st.t / SPAWN_T); beam.material.opacity = C.beam * Math.min(1, st.t / SPAWN_T);
          if (spawnStep(dt)) { st.ph = 'idle'; st.t = 0; body.scale.setScalar(1); obj.ready = true; tag.visible = true; }
        } else if (st.ph === 'idle') idleStep(dt, t);
        else if (st.ph === 'open') { if (openStep(dt)) { st.ph = 'done'; st.t = 0; once('o', onOpen); } }
        else doneStep(dt, t);
        if (tag) tag.position.y = topY + 1.05 + Math.sin(t * 2) * 0.06;
        if (coins) coinStep(dt);
      },
      dispose() { geos.forEach(x => x.dispose()); if (dis) dis.dispose(); if (coins) coins.im.material.dispose(); coins = null; } });
    return obj;
  };

  /* ---------- portails ---------- */
  const VORTEX_FS = `uniform float uTime, uSeal, uPull; uniform vec3 uCol; varying vec2 vUv;
    void main(){ vec2 p = vUv * 2.0 - 1.0; p.y = p.y * 1.55 - 0.25;
      float inArch = step(p.y, 0.55) * step(abs(p.x), 0.95); vec2 q = p - vec2(0.0, 0.55); float inTop = step(length(q), 0.95) * step(0.55, p.y);
      float m = max(inArch, inTop); if (m < 0.5) discard;
      float r = length(p - vec2(0.0, 0.3)), a = atan(p.y - 0.3, p.x);
      float sw = sin(a * 5.0 + r * 9.0 - uTime * (3.0 + uPull * 9.0)) * 0.5 + 0.5;
      float core = smoothstep(1.1, 0.0, r);
      vec3 c = mix(uCol * 0.25, uCol * 1.8, sw * 0.6 + core * 0.6) + vec3(1.0) * pow(core, 3.0) * (0.6 + uPull * 2.0);
      c = mix(c, vec3(0.12, 0.12, 0.14) + sw * 0.05, uSeal);
      gl_FragColor = vec4(c, 0.92); }`;
  const KCOL = { enigme: '#5ad1ff', savoir: '#7dff9a', combat: '#ffb24a', elite: '#ff5a6a', defi: '#ff3bd0', repos: '#ff9a3a', marchand: '#ffd84a', autel: '#b06bff', gardien: '#ff4a2a', final: '#ffffff', fin: '#ffd76a', infini: '#b06bff' };
  const KNAME = { enigme: 'Énigme', savoir: 'Salle du Savoir', combat: 'Combat', elite: 'Élite', defi: 'Défi', repos: 'Feu de camp', marchand: 'Marchand', autel: 'Autel maudit', gardien: 'Gardien', final: 'Colosse ascendant', fin: 'Victoire', infini: 'L\'Infini' };
  const kName = k => KNAME[k] || 'Portail', kCol = k => KCOL[k] || '#ffffff';
  const RWN = { boon: 'Bénédiction', power: 'Pouvoir', gold: 'Trésor', heal: 'Cœur de colosse', leg: 'Bénédiction légendaire', ult: 'Ultime' };
  W.portals = function (list, onVote) {
    portals.forEach(P => removeObj(P)); portals = []; W.myVote = undefined;
    // la Citadelle : des portes à herse dans le mur nord au lieu des portails
    if (S.env && S.env.dungeon && BR.Dungeon) {
      const subOf = d => d.kind === 'combat' ? RWN[d.rw] : d.kind === 'elite' ? 'Bénédiction rare ou mieux' : d.kind === 'defi' ? (Q.DEFIS[d.mod] || {}).n || 'Défi' : d.kind === 'repos' ? 'Soin ou amélioration' : d.kind === 'marchand' ? 'Dépense ton or' : d.kind === 'autel' ? 'Pacte maudit' : d.kind === 'enigme' ? (d.rw ? RWN[d.rw] + ' à la clé' : 'Un mécanisme à résoudre') : d.kind === 'savoir' ? 'Questions de GMP… et des éclats' : '';
      portals = BR.Dungeon.makeExits(S.env, list, { label, kName, kCol, sub: subOf, onVote, sealed: () => sealed });
      portals.forEach(P => addObj(P));
      return;
    }
    const n = list.length;
    list.forEach((d, i) => {
      const ang = Math.PI * 0 + (i - (n - 1) / 2) * 0.42, rr = R() - 4.5, p = new V3(Math.sin(ang) * rr, 0, Math.cos(ang) * rr);
      const col = new THREE.Color(kCol(d.kind));
      const g = new THREE.Group(); g.position.copy(p); g.rotation.y = Math.atan2(-p.x, -p.z); S.scene.add(g);
      const arch = model('p_portal'); if (arch) { arch.traverse(m => { if (m.isMesh && m.material && /glow/.test(m.material.name || '')) { m.material = m.material.clone(); m.material.emissive = col.clone(); m.material.emissiveIntensity = 2.5; m.userData.shared = false; } }); g.add(arch); }
      const U = { uTime: { value: 0 }, uSeal: { value: 1 }, uPull: { value: 0 }, uCol: { value: col.clone() } };
      const vx = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5.2), new THREE.ShaderMaterial({ uniforms: U, fragmentShader: VORTEX_FS, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      vx.position.set(0, 2.85, 0); g.add(vx);
      const sub = d.kind === 'combat' ? RWN[d.rw] : d.kind === 'elite' ? 'Bénédiction rare ou mieux' : d.kind === 'defi' ? (Q.DEFIS[d.mod] || {}).n || 'Défi' : d.kind === 'repos' ? 'Soin ou amélioration' : d.kind === 'marchand' ? 'Dépense ton or' : d.kind === 'autel' ? 'Un pacte dangereux' : d.kind === 'final' ? 'Le dernier combat' : d.kind === 'fin' ? 'Retour au village en héros' : d.kind === 'infini' ? 'Des étages sans fin · record entre amis' : d.kind === 'gardien' ? 'Le gardien de l\'acte' : '';
      const lb = label(sub ? [{ t: kName(d.kind), c: kCol(d.kind) }, { t: sub, c: '#ffffff' }] : [{ t: kName(d.kind), c: kCol(d.kind) }], { w: 4.6 }); lb.position.y = 6.9; g.add(lb);
      const light = new THREE.PointLight(col.clone(), 0, 12, 2); light.position.set(0, 3, 1.2); g.add(light);
      const P = addObj({ kind: 'portal', tag: 'portal', d, i, pos: p.clone(), r: 1.7, group: g, color: kCol(d.kind), U, light, votes: null, onVote,
        update(dt, t) { U.uTime.value = t; U.uSeal.value += ((sealed ? 1 : 0) - U.uSeal.value) * Math.min(1, dt * 3); light.intensity = (1 - U.uSeal.value) * 2.2 + U.uPull.value * 6;
          if (!sealed && Math.random() < dt * 10) { const a = Math.random() * 6.283; const q = p.clone().add(new V3(Math.cos(a) * 3, 0.3 + Math.random() * 4, Math.sin(a) * 3)); S.fx.spark(q, p.clone().setY(2.8).sub(q).multiplyScalar(1.2), { color: kCol(d.kind), life: 0.7, size: 0.25 }); } } });
      portals.push(P);
    });
  };
  W.unseal = function () { sealed = false; };
  W.isSealed = () => sealed;
  // noms des votants au-dessus des portails
  W.showVotes = function (votes, names) {
    portals.forEach(P => {
      const who = Object.keys(votes).filter(id => votes[id] === P.i).map(id => names[id] || '?');
      const key = who.join(',');
      if (P.votesKey === key) return; P.votesKey = key;
      if (P.votes) { P.group.remove(P.votes); P.votes.material.map.dispose(); P.votes.material.dispose(); P.votes = null; }
      if (who.length) { P.votes = label([{ t: who.join(' · '), c: '#ffffff' }], { w: 4.2 }); P.votes.position.y = 8.1; P.group.add(P.votes); }
    });
  };

  /* ---------- aspiration dans le portail choisi ---------- */
  W.suck = function (i, done) {
    const P = portals[i]; if (!P) { done(); return; }
    if (P.door && BR.Dungeon) {   // on passe la porte à pied, puis fondu au noir
      sealed = false;
      const fighters = [...S.fighters.values()].filter(f => f.alive);
      W.sucking = { door: true, upd: BR.Dungeon.walkOut(S, P, fighters, () => { W.sucking = null; done(); }) };
      BR.Arena.banner(kName(P.d.kind).toUpperCase(), '', 1.4, '');
      return;
    }
    const c = P.pos.clone().setY(2.6), pet = BR.AscFX.petals(S.scene), t0 = S.t;
    sealed = false;
    BR.Audio.fx('charge', { len: 1.4, g: 1 }); BR.Audio.fx('timestop', { g: 0.4 });
    const fighters = [...S.fighters.values()].filter(f => f.alive);
    fighters.forEach(f => { f.suck = { p0: f.pos.clone(), t: 0 }; });
    W.sucking = { P, c, t0, fighters, done, fired: false };
    for (let k = 0; k < 3; k++) fighters.forEach(f => pet.suck(f.pos.clone(), c, ['#ffffff', P.color], 30, 1.2));
    S.me.stun = 9; S.me.inv = 9;
    BR.Arena.banner(kName(P.d.kind).toUpperCase(), '', 1.4, '');
  };
  function updateSuck(dt) {
    const sk = W.sucking; if (!sk) return;
    if (sk.door) { sk.upd(dt); return; }
    const t = S.t - sk.t0, k = Math.min(1, t / 1.5);
    sk.P.U.uPull.value = k;
    for (const f of sk.fighters) {
      if (!f.suck) continue;
      const e = k * k * k;
      f.pos.lerpVectors(f.suck.p0, sk.c.clone().setY(1.2 + e * 1.4), e);
      f.vel.set(0, 0, 0); f.yaw += dt * (4 + k * 30);
      f.sizeMul = Math.max(0.05, 1 - e * 0.95) * (f.sizeBase || 1);
      if (Math.random() < dt * 30) S.fx.spark(f.center(), sk.c.clone().sub(f.center()).multiplyScalar(2), { color: sk.P.color, life: 0.4, size: 0.3 });
    }
    if (S.me.suck) { S.fovKick = Math.max(S.fovKick, k * 22); BR.Arena.shake(dt * 1.4); }
    if (k >= 1 && !sk.fired) {
      sk.fired = true; flash(true);
      setTimeout(() => { W.sucking = null; sk.done(); }, 380);
    }
  }
  // voile blanc pendant le changement d'étage
  function flash(on) {
    let el = BR.$('#asc-flash'); if (!el) { el = BR.el('div', { id: 'asc-flash' }); document.body.appendChild(el); }
    el.classList.toggle('on', !!on);
  }
  W.flash = flash;

  /* ---------- arrivée : les pétales reforment chaque joueur dans un rayon de lumière ---------- */
  W.arrive = function () {
    if (S.env && S.env.dungeon && BR.Dungeon) { BR.Dungeon.arrive(S); return; }
    flash(false);
    const pet = BR.AscFX.petals(S.scene);
    S.fighters.forEach(f => {
      const col = (Q.CLASSES[Q.classOf(f)] || {}).col || '#ffffff';
      f.sizeBase = f.sizeMul || 1; f.sizeMul = 0.02; f.arriveT = 0;
      pet.gather(f.pos.clone(), 2.1, 0.5, [col, '#ffffff', '#ffe9a8'], 70, 0.9);
      S.fx.pillar(f.pos.clone(), { color: col, r: 1.1, h: 30, life: 1.3, alpha: 0.6 });
    });
    BR.Audio.fx('reveal', { g: 0.6 });
  };
  function updateArrive(dt) {
    S.fighters.forEach(f => {
      if (f.arriveT == null) return;
      f.arriveT += dt;
      const k = Math.min(1, Math.max(0, (f.arriveT - 0.55) / 0.35));
      f.sizeMul = Math.max(0.02, (1 - Math.pow(1 - k, 3)) * (f.sizeBase || 1) * (1 + Math.sin(k * Math.PI) * 0.15));
      if (f.arriveT > 0.55 && !f.arrPop) { f.arrPop = true; S.fx.ring(f.pos.clone().setY(0.05), { r1: 4, color: 0xffffff, life: 0.45 }); S.fx.burst(f.center(), { n: 30, color: 0xffe9a8, speed: 7, life: 0.5 }); }
      if (k >= 1) { f.sizeMul = f.sizeBase || 1; f.arriveT = null; }
    });
  }

  /* ---------- salles ---------- */
  W.room = function (kind, room) {
    const absorb = g => { if (S.env && S.env.dungeon && BR.Dungeon) BR.Dungeon.absorbLights(g, S.env); };
    if (kind === 'repos') {
      const g = new THREE.Group(); S.scene.add(g); const cf = model('p_campfire'); if (cf) g.add(cf);
      const l = new THREE.PointLight(new THREE.Color('#ff9a3a'), 3, 18, 2); l.position.y = 1.4; g.add(l); absorb(g);
      addObj({ kind: 'deco', pos: new V3(), r: 0, group: g, update(dt, t) { l.intensity = 2.6 + Math.sin(t * 13) * 0.3 + Math.random() * 0.4; for (let k = 0; k < 2; k++) S.fx.spark(new V3((Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6), new V3((Math.random() - 0.5), 2.5 + Math.random() * 2, (Math.random() - 0.5)), { color: k ? 0xff7a2a : 0xffd060, life: 0.7, size: 0.5, size1: 0.05 }); if (Math.random() < dt * 3) S.fx.spark(new V3(0, 1.5, 0), new V3(0, 1.2, 0), { kind: 'smoke', color: 0x3a3430, life: 2.5, size: 0.8, size1: 2.4, alpha: 0.4 }); } });
    }
    if (kind === 'marchand') {
      const g = new THREE.Group(); g.position.set(0, 0, 7); g.rotation.y = Math.PI; S.scene.add(g);
      const st = model('p_stall'); if (st) g.add(st);
      // le vendeur (un personnage du jeu, capuche et cape) derrière son comptoir
      try { const av = BR.Avatar.build({ skin: 'hooded' }); av.group.position.set(0, 0, 1.0); av.group.rotation.y = 0; g.add(av.group); g.userData.av = av; } catch (e) { console.warn(e); }
      const lb = label([{ t: 'LE MARCHAND', c: '#ffd84a' }, { t: '« Tout se paie, surtout la puissance. »', c: '#ffffff' }], { w: 5.4 }); lb.position.y = 4.6; g.add(lb);
      addObj({ kind: 'deco', pos: new V3(), r: 0, group: g, update(dt) { const av = g.userData.av; if (av) av.update(dt, 0, {}); } });
    }
    if (kind === 'autel') {
      const g = new THREE.Group(); g.position.set(0, 0, 4); g.rotation.y = Math.PI; S.scene.add(g);
      const al = model('p_altar'); if (al) g.add(al);
      const l = new THREE.PointLight(new THREE.Color('#b05aff'), 3, 16, 2); l.position.set(0, 2.5, 0); g.add(l); absorb(g);
      addObj({ kind: 'deco', pos: new V3(), r: 0, group: g, update(dt, t) { l.intensity = 2.5 + Math.sin(t * 2) * 0.6; if (Math.random() < dt * 8) S.fx.spark(new V3((Math.random() - 0.5) * 4, 0.2, 4 + (Math.random() - 0.5) * 3), new V3(0, 1.2, 0), { color: 0xb05aff, life: 1.2, size: 0.25, size1: 0.02 }); } });
    }
    void room;
  };

  /* ---------- interaction : s'approcher pour lire, rester dessus pour prendre ---------- */
  W.tick = function (dt) {
    if (!W.alive()) return;
    const t = S.t, me = S.me;
    objs.slice().forEach(o => o.update && o.update(dt, t));
    updateSuck(dt); updateArrive(dt);
    if (W.sucking || !me.alive) { showPrompt(null); return; }
    // portail : on entre dedans
    let inPortal = null;
    for (const P of portals) { const d = Math.hypot(me.pos.x - P.pos.x, me.pos.z - P.pos.z); if (d < P.r) inPortal = P; }
    if (inPortal) {
      if (sealed) showPrompt({ kind: 'sealed' });
      else { showPrompt({ kind: 'portal', P: inPortal }); if (W.myVote !== inPortal.i) { W.myVote = inPortal.i; inPortal.onVote(inPortal.i); BR.Audio.ui('ok'); } }
      return;
    }
    // objet le plus proche
    let best = null, bd = 1e9;
    for (const o of objs) { if (!o.onTake || o.done || o.ready === false) continue; const d = Math.hypot(me.pos.x - o.pos.x, me.pos.z - o.pos.z); if (d < o.r && d < bd) { bd = d; best = o; } }
    if (best !== near) { if (near) setProg(near, 0); near = best; holdT = 0; if (near) BR.Audio.ui('click'); }
    if (!near) { showPrompt(null); return; }
    const canPay = !near.price || Q.me().gold >= near.price;
    holdT = Math.min(1, holdT + dt * 4); setProg(near, canPay ? holdT : 0);
    showPrompt({ kind: 'item', o: near, poor: !canPay });
  };
  // touche E près d'un objet : on le prend (renvoie true pour que le moteur ne lance pas le sort de la touche)
  W.wantsKey = function (code) {
    if (!(BR.Keys ? BR.Keys.is('interact', code) : code === TAKE_KEY) || !W.alive() || W.sucking || pendingRep || !near || near.done || !S.me.alive) return false;
    const o = near;
    if (o.price && Q.me().gold < o.price) { BR.Audio.ui('error'); return true; }
    near = null; holdT = 0; setProg(o, 0);
    o.done = !o.keep;
    if (!o.quiet) BR.Audio.fx('reveal', { rate: 1.2 });
    o.onTake(o);
    return true;
  };
  function setProg(o, k) {
    if (!o.prog) return; k = Math.max(0, Math.min(1, k));
    const g = new THREE.RingGeometry(1.35, 1.6, 40, 1, Math.PI / 2, Math.max(0.001, k * Math.PI * 2));
    o.prog.geometry.dispose(); o.prog.geometry = g;
  }
  let lastHtml = '';
  function showPrompt(p) {
    if (!prompt) return;
    let html = '';
    if (pendingRep) {
      const M = Q.me();
      html = `<div class="ap-card rep"><div class="ap-h">Remplacer quel pouvoir ?</div><div class="ap-rep">${M.skills.map((id, i) => `<div><img src="${AR.icon(id, 64)}"><b>${i + 1}</b><span>${BR.esc(Q.skillName(id, M.cls))}</span></div>`).join('')}</div><div class="ap-k">Touches <b>1</b> à <b>4</b> · <b>Échap</b> : annuler</div></div>`;
    } else if (p && p.kind === 'item') {
      const I = p.o.info;
      html = `<div class="ap-card" style="--rc:${I.col};--fc:${I.fc}"><div class="ap-i">${I.img ? `<img src="${I.img}">` : I.glyph || ''}</div><div class="ap-b">${I.slot ? `<div class="ap-slot">${BR.esc(I.slot)}</div>` : ''}<div class="ap-r">${I.rar}${I.fam ? ' · ' + I.fam : ''}</div><b>${BR.esc(I.name)}</b>${I.lv ? `<span class="ap-lv">${I.lv}</span>` : ''}<p>${I.d}</p>${I.rep ? `<p class="ap-rep2">Remplace <b>${BR.esc(I.rep)}</b></p>` : ''}</div>
        <div class="ap-k">${p.poor ? `<span class="bad">Pas assez d'or (${p.o.price})</span>` : `<kbd>${BR.Keys ? BR.Keys.label('interact') : 'E'}</kbd> ${p.o.price ? 'acheter (' + p.o.price + ' or)' : p.o.verb || 'prendre'}`}</div></div>`;
    } else if (p && p.kind === 'portal') {
      html = `<div class="ap-card small" style="--rc:${p.P.color}"><div class="ap-b"><b>${kName(p.P.d.kind)}</b><p>${Q.run && !Q.run.solo ? 'Tu as choisi cette porte. On part quand tout le monde a voté.' : 'En route…'}</p></div></div>`;
    } else if (p && p.kind === 'sealed') {
      html = `<div class="ap-card small"><div class="ap-b"><b>${S.env && S.env.dungeon ? 'Herse fermée' : 'Portail scellé'}</b><p>${S.env && S.env.puzzle && !S.env.puzzle.solved ? "Résous d'abord l'énigme (ou tire le levier « passer » près de l'entrée)." : "Prends d'abord ta récompense."}</p></div></div>`;
    }
    if (html !== lastHtml) { lastHtml = html; prompt.innerHTML = html; prompt.classList.toggle('on', !!html); }
  }
  // remplacement d'un pouvoir quand les 4 emplacements sont pleins
  W.askReplace = function (cb) { pendingRep = cb; showPrompt(null); };
  function repKey(e) {
    if (!pendingRep) return;
    if (e.code === 'Escape') { pendingRep = null; return; }
    const m = /^Digit([1-4])$/.exec(e.code); if (!m) return;
    const cb = pendingRep; pendingRep = null; cb(+m[1] - 1); e.preventDefault();
  }
  W.dispose = function () { document.removeEventListener('keydown', repKey); if (S) objs.slice().forEach(o => { try { removeObj(o); } catch (e) { console.warn(e); } }); objs = []; portals = []; S = null; W.sucking = null; };
  W.portalList = () => portals;
})();

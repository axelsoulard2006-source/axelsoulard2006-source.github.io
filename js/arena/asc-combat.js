/* ===== arena/asc-combat.js : effets des bénédictions pendant un étage de l'Ascension =====
   Le moteur (engine.js) appelle ces crochets quand S.asc existe. Chaque client applique SES bénédictions à SON
   joueur (il fait autorité sur les dégâts qu'il inflige et reçoit) ; les effets visibles par les autres (taille,
   grosse tête, cri de guerre, soins partagés, relevés) passent par de petits messages { k: 'qa' }. */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, AR = BR.ARENA;
  const Q = (BR.Asc = BR.Asc || {});
  const T = () => BR.Arena.ascTools();

  /* ---------- évènements de combat (l'arbre de compétences s'y abonne : Q.on('swing', fn) …) ----------
     stats(st, M) · start(S, f, M) · swing(S, f, st, k, n) · hit(S, f, t, dmg, crit, o, at) · cast(S, f, id, slot, lv) · dash(S, f, dir, kind)
     perfect(S, f, kind) · hurt(S, f, dmg) · kill(S, a, silent) · tick(S, dt) · runEnd(res, M, D) ; Q.emitMul('out', S, f, t, o) multiplie les dégâts */
  const HK = {};
  Q.on = (ev, fn) => { (HK[ev] = HK[ev] || []).push(fn); };
  Q.emit = function (ev) { const L = HK[ev]; if (!L) return; const a = Array.prototype.slice.call(arguments, 1); for (const fn of L) { try { fn.apply(null, a); } catch (e) { console.error('évènement', ev, e); } } };
  Q.emitMul = function (ev) { const L = HK[ev]; if (!L) return 1; const a = Array.prototype.slice.call(arguments, 1); let m = 1; for (const fn of L) { try { const v = fn.apply(null, a); if (typeof v === 'number' && v > 0) m *= v; } catch (e) { console.error('évènement', ev, e); } } return m; };
  Q.onSwing = (S, f, st, k, n) => { if (S.me === f) Q.emit('swing', S, f, st, k, n); };

  /* ---------- statistiques du joueur pour la course ---------- */
  Q.computeStats = function (M) {
    const b = M.boons || {}, c = M.curses || [], st = { dmg: 1, spd: 1, crit: 0, cdm: 1, en: 1, maxHp: 1000, dashMax: 2, jumpMax: 2, size: 1, head: 1, slip: false, taken: 1, ultG: 1 };
    const lv = id => b[id] || 0;
    st.maxHp *= 1 + 0.18 * lv('b_pv');
    st.spd *= 1 + 0.08 * lv('b_vit');
    if (lv('b_dash3')) st.dashMax++;
    if (lv('b_saut')) st.jumpMax = 3;
    st.crit += 0.08 * lv('b_crit');
    st.cdm *= Math.max(0.55, 1 - 0.1 * lv('b_cd'));
    st.en *= 1 + 0.4 * lv('b_en');
    st.dmg *= 1 + 0.12 * lv('b_dmg');
    st.ultG += 0.35 * lv('b_ultf');
    if (lv('b_sacri')) { st.dmg *= 1.6; st.maxHp *= 0.7; }
    if (lv('b_geant')) { st.size *= 1.35; st.dmg *= 1.25; st.maxHp *= 1.2; st.spd *= 0.92; }
    if (lv('b_mini')) { st.size *= 0.65; st.spd *= 1.2; st.dashMax++; st.maxHp *= 0.85; }
    st.taken *= 1 - 0.1 * lv('b_garde');
    for (const id of c) {
      if (id === 'm_tete') { st.head = 2.3; st.taken *= 1.25; }
      if (id === 'm_verre') st.maxHp *= 0.6;
      if (id === 'm_glisse') st.slip = true;
      if (id === 'm_lent') st.spd *= 0.85;
      if (id === 'm_rouille') st.dashMax = Math.max(1, st.dashMax - 1);
      if (id === 'm_nain') { st.size *= 0.55; st.dmg *= 0.75; }
    }
    const mt = M.meta || {};
    st.maxHp *= 1 + 0.08 * (mt.vital || 0);
    st.dmg *= 1 + 0.05 * (mt.force || 0); st.taken *= 1 - 0.04 * (mt.garde || 0); st.spd *= 1 + 0.03 * (mt.vivacite || 0);
    st.crit += 0.03 * (mt.oeil || 0); st.ultG += 0.06 * (mt.ardeur || 0); st.dcd = 1 - 0.05 * (mt.ombre || 0); st.bossDmg = 1 + 0.05 * (mt.colosse || 0);
    if (M.cls === 'chevalier') { st.maxHp *= 1.18; st.taken *= 0.9; } else if (M.cls === 'mage') { st.maxHp *= 0.86; st.cdm *= 0.9; st.en *= 1.2; } else if (M.cls === 'archer') { st.maxHp *= 0.95; st.spd *= 1.06; }
    if (M.chalMods && M.chalMods.includes('verre')) { st.maxHp *= 0.6; st.dmg *= 1.3; }
    Q.emit('stats', st, M);
    st.maxHp = Math.round(st.maxHp);
    return st;
  };

  /* ---------- affixes d'un élite / gardien (appliqués chez tous les clients) ---------- */
  Q.applyAffixes = function (S, b, aff) {
    if (!b || !aff || !aff.length) return;
    b.affixes = aff.slice();
    for (const a of aff) {
      if (a === 'enrage') { b.applyStage(Math.min(b.maxStage, 2)); b.coolMul *= 0.85; }
      if (a === 'rapide') { b.speed *= 1.25; b.speed0 *= 1.25; }
      if (a === 'geant') { b.evoScale = b.evoScale.map(x => x * 1.3); b.sc = b.evoScale[b.stage] || 1.3; b.size *= 1.3; }
      if (a === 'frenetique') { b.tier = Math.min(3, (b.tier || 0) + 1); }
      if (a === 'carapace') {
        const dmg0 = b.damage;
        b.damage = function (i, dmg, posture, src, opt) { return dmg0.call(b, i, b.broken > 0 ? dmg : dmg * 0.5, posture, src, opt); };
        b.carapace = true;
      }
      if (a === 'regen') b.regen = true;
    }
  };

  /* ---------- début d'étage ---------- */
  Q.onStart = function (S) {
    const A = S.asc, M = Q.me(), me = S.me;
    const st = Q.computeStats(M);
    me.asc = st; me.maxHp = st.maxHp; me.hp = Math.max(1, Math.round(st.maxHp * BR.clamp(M.hpK == null ? 1 : M.hpK, 0.05, 1)));
    me.dashMax = A.room && A.room.mod === 'nodash' ? 0 : st.dashMax; me.dashN = me.dashMax; me.jumpMax = st.jumpMax;
    me.sizeMul = st.size; me.headMul = st.head; me.ult = Math.min(100, M.ultC || 0);
    if (A.room && A.room.mod === 'rapide') me.asc.spd *= 1.3;
    S.ascL = { burns: new Map(), frozen: new Map(), hitN: 0, atkN: 0, ritual: 0, cyclone: 0, meteoT: 3, armT: 0, orbs: [], orbT: 0, heal: 0, healT: 0, thornT: 0, rv: 0, phoenix: false, counter: 0, cri: 0, chanceUsed: false, lookT: [0.8, 3, 8], lifeOrbs: [], downT: 0, buffs: {} };
    // le « boss » de l'étage : affixes, régénération
    if (S.boss && A.room && A.room.aff) Q.applyAffixes(S, S.boss, A.room.aff);
    if (S.boss && A.room && A.room.mod === 'rapide' && S.boss.id === 'horde') S.boss.speed *= 1.3;
    // lames orbitales
    const no = M.boons.b_orbes ? 2 + M.boons.b_orbes : 0;
    if (no) {
      const g = new THREE.OctahedronGeometry(0.32, 0), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd76a).multiplyScalar(1.6) });
      for (let i = 0; i < no; i++) { const m = new THREE.Mesh(g, mat); m.scale.set(0.6, 1.8, 0.6); S.scene.add(m); S.ascL.orbs.push(m); }
    }
    // HUD : étage, or, bénédictions
    S.hud.classList.add('asc-run'); if (S.boss && S.boss.id === 'horde') S.hud.classList.add('asc-horde');
    const top = BR.el('div', { class: 'asc-top', html: Q.hudTop(A) }); S.hud.appendChild(top);
    S.hud.appendChild(BR.el('div', { class: 'asc-rv' }));
    if (Q.W) { Q.W.reset(S); Q.W.arrive(); if (Q.isRoom && Q.isRoom() && Q.roomStart) Q.roomStart(S); }
    S.hud.appendChild(BR.el('div', { class: 'asc-hint' }));
    // titre de la barre du haut selon l'objectif de l'étage
    if (A.room && A.room.obj) { const bn = S.hud.querySelector('.a-bname'); if (bn && bn.firstChild) { bn.firstChild.textContent = A.room.obj === 'survie' ? 'TIENS BON !' : 'LES TOTEMS MAUDITS'; const sp = bn.querySelector('span'); if (sp && sp.firstChild) sp.firstChild.textContent = (A.room.obj === 'survie' ? 'Survis jusqu\'à la fin' : 'Détruis-les pour nettoyer l\'étage') + ' · '; } }
    // titre court en grand, détails dessous (les noms de boss sont longs)
    const k = A.room.kind, bn = A.room.boss && A.room.boss !== 'horde' ? AR.boss(A.room.boss).name : '', af = (A.room.aff || []).map(a => Q.AFFIX[a].n).join(' · ');
    const tt = k === 'gardien' ? ['GARDIEN', bn + (af ? ' — ' + af : '')] : k === 'elite' ? ['ÉLITE', bn + (af ? ' — ' + af : '')] : k === 'final' ? ['COLOSSE ASCENDANT', bn + (af ? ' — ' + af : '')]
      : k === 'defi' ? ['DÉFI', Q.DEFIS[A.room.mod].n + ' — ' + Q.DEFIS[A.room.mod].d] : k === 'repos' ? ['FEU DE CAMP', 'Un instant de calme : une seule faveur'] : k === 'marchand' ? ['LE MARCHAND', 'Dépense ton or, puis choisis une porte'] : k === 'autel' ? ['AUTEL MAUDIT', 'Un pacte… ou passe ton chemin'] : k === 'enigme' ? ['ÉNIGME', A.room.sub || 'Ouvre la porte'] : k === 'savoir' ? [String(A.room.title || 'SALLE DU SAVOIR'), A.room.sub || 'Questions de GMP'] : ['ÉTAGE ' + A.floor, A.room.sub || 'Repousse toutes les vagues'];
    BR.Arena.banner(tt[0], tt[1], 2.6, k === 'gardien' || k === 'final' ? 'evo' : '');
    Q.emit('start', S, me, M);
  };
  Q.hudTop = function (A) {
    const M = Q.me(), boons = Object.keys(M.boons);
    return `<div class="at-fl"><b>ÉTAGE ${A.floor}</b><span>/ ${Q.FLOORS}</span><i style="color:${Q.palCol(Q.run.pal)}">${Q.PALIERS[Q.run.pal].n}</i></div>
      <div class="at-g">${Q.coinSvg(15)} <b>${M.gold}</b></div>
      <div class="at-sl">${['atk', 'dash', 'pouv', 'ult'].map(s => { const B = Q.boonOnSlot(M, s); return `<span class="${B ? 'on r-' + B.r : ''}" style="--fc:${B ? Q.FAM[B.f].col : '#555'}" title="${Q.SLOTS[s].n}${B ? ' : ' + BR.esc(B.n) : ' : rien'}">${B ? Q.glyph(B.f, 15) : ''}<i>${Q.SLOTS[s].n}</i>${B && M.boons[B.id] > 1 ? `<em>${M.boons[B.id]}</em>` : ''}</span>`; }).join('')}</div>
      <div class="at-b">${boons.filter(id => { const B = Q.boon(id); return B && B.s === 'passif'; }).slice(0, 12).map(id => { const B = Q.boon(id); return `<span class="r-${B.r}" title="${BR.esc(B.n)}">${Q.glyph(B.f, 16)}${M.boons[id] > 1 ? `<em>${M.boons[id]}</em>` : ''}</span>`; }).join('')}${(M.curses || []).map(id => `<span class="cur" title="${BR.esc(Q.curse(id).n)}">${Q.glyph('maudit', 16)}</span>`).join('')}</div>`;
  };
  Q.coinSvg = sz => `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}"><circle cx="12" cy="12" r="10" fill="#ffc83a"/><circle cx="12" cy="12" r="7" fill="none" stroke="#a8741a" stroke-width="1.6"/><path d="M12 8v8M9.5 10.2c.5-1.2 4.5-1.4 4.8.4.4 2.4-5 1.3-4.7 3.6.3 1.8 4.4 1.6 5 .2" stroke="#a8741a" stroke-width="1.4" fill="none"/></svg>`;

  /* ---------- outils ---------- */
  const lvOf = id => (Q.me().boons[id] || 0);
  const isMe = (S, f) => f && S.me === f;
  const keyOf = t => BR.Arena.groupKey(t);
  function findTarget(S, key) { for (const t of T().enemiesOf(S.me)) if (keyOf(t) === key) return t; return null; }
  function boonHit(S, t, dmg, o) { T().applyHit(S.me, t, dmg, Object.assign({ kind: 'boon' }, o || {}), t.pos); }
  function zone(S, c, r, dmg, o) { return T().hitSphere(S.me, c, r, dmg, Object.assign({ kind: 'boon' }, o || {})); }
  function heal(S, amount, quiet) {
    const f = S.me; if (!f.alive || amount <= 0) return;
    const real = Math.min(amount, f.maxHp - f.hp); f.hp += real;
    S.ascL.heal += real;
    if (lvOf('c_partage') && real > 0) T().send({ k: 'qa', t: 'heal', a: Math.round(real * 0.3 * lvOf('c_partage')), x: +f.pos.x.toFixed(1), z: +f.pos.z.toFixed(1) });
    void quiet;
  }
  Q.heal = heal;
  // lame de vent qui file droit devant (visuel)
  function windBlade(S, a0, d, yaw) {
    const m = new THREE.Mesh(S.fx.geo.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7dffb0).multiplyScalar(2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.scale.set(2.4, 0.12, 0.5); m.rotation.y = yaw + Math.PI / 2; m.position.copy(a0);
    S.fx.add(m, 0.32, (k, o, dt) => { o.position.addScaledVector(d, dt * 40); o.material.opacity = 0.85 * (1 - k); if (Math.random() < 0.7) S.fx.spark(o.position.clone(), new V3(0, 0.5, 0), { color: 0x7dffb0, life: 0.25, size: 0.35, size1: 0.02 }); }, true);
  }
  // les n ennemis (groupes distincts) les plus proches d'un point
  function nearestN(S, f, from, n, max) {
    const seen = new Set(), out = [];
    T().enemiesOf(f).map(e => [e, e.pos.distanceTo(from)]).filter(x => x[1] < max).sort((a, b) => a[1] - b[1]).forEach(([e]) => { const k = keyOf(e); if (seen.has(k) || out.length >= n) return; seen.add(k); out.push(e); });
    return out;
  }
  // une braise qui tombe du ciel (marquage au sol puis impact)
  function meteor(S, p, dmg, delay) {
    S.fx.decal(p, 'circle', { r: 2.4, color: 0xff7a2a, dur: delay, noWarn: true });
    T().later(delay, () => { const c = p.clone().setY(0.5); S.fx.bolt(new V3(p.x - 3, 16, p.z - 2), c, { color: 0xff8a3a, life: 0.2, light: false }); S.fx.flash(c, { color: 0xff7a2a, r: 2, life: 0.25, intensity: 5 }); S.fx.burst(c, { n: 24, color: 0xff8a3a, speed: 8, life: 0.5 }); zone(S, c, 2.6, dmg, { color: '#ff8a3a' }); BR.Audio.fx('boom', { g: 0.3, rate: 1.6, len: 0.5 }); fxSend(S, { n: 'boom', x: c.x, y: c.y, z: c.z, r: 2.6, c: 0xff7a2a }); }, 'A');
  }
  function fxSend(S, o) { T().send(Object.assign({ k: 'qa', t: 'fx' }, o)); }
  // effets visuels joués chez les autres (explosions, éclairs) — pas de dégâts, c'est le lanceur qui frappe
  function playFx(S, d) {
    const p = new V3(d.x, d.y || 0.5, d.z);
    if (d.n === 'boom') { S.fx.flash(p, { color: d.c, r: d.r * 0.6, life: 0.25, intensity: 5 }); S.fx.ring(p.clone().setY(0.05), { r1: d.r * 1.2, color: d.c, life: 0.35, world: true }); S.fx.burst(p, { n: 26, color: d.c, speed: 8 + d.r, up: 1, life: 0.5, world: true }); }
    if (d.n === 'bolt') S.fx.bolt(new V3(d.x, 16, d.z), p, { color: d.c || 0x9ad8ff, life: 0.25 });
    if (d.n === 'ice') { S.fx.ring(p.clone().setY(0.05), { r1: 8, color: 0xa8f0ff, life: 0.5, world: true }); S.fx.burst(p, { n: 50, color: 0xa8f0ff, speed: 12, life: 0.6, world: true }); }
    if (d.n === 'wind') windBlade(S, new V3(d.x, d.y, d.z), new V3(d.dx, 0, d.dz), Math.atan2(d.dx, d.dz));
    if (d.n === 'line') { const a = new V3(d.x, 1, d.z), b = new V3(d.x2, 1, d.z2); S.fx.beam && S.fx.beam(a, b, { color: d.c, width: 0.8, life: 0.3, world: true }); }
  }

  /* ---------- dégâts infligés : multiplicateur (appelé avant le calcul du critique) ---------- */
  Q.outMul = function (S, owner, t, o) {
    if (!isMe(S, owner) || !owner.asc) return 1;
    const L = S.ascL, f = owner;
    let m = owner.asc.dmg;
    if (t && t.kind === 'boss' && owner.asc.bossDmg) m *= owner.asc.bossDmg;
    if (o.kind === 'boon') return m;
    m *= Q.emitMul('out', S, f, t, o);
    const hpk = f.hp / f.maxHp;
    if (lvOf('b_rage')) m *= 1 + 0.05 * lvOf('b_rage') * Math.floor((1 - hpk) * 10);
    if (lvOf('b_dern') && hpk < 0.35) m *= 1.8;
    if (lvOf('c_lien') && [...S.fighters.values()].some(a => a !== f && a.alive && a.pos.distanceTo(f.pos) < 8)) m *= 1 + 0.15 * lvOf('c_lien');
    if (L.cri > S.t) m *= 1.3;
    const key = keyOf(t);
    if (lvOf('b_bris') && (L.frozen.get(key) || 0) > S.t) m *= 1 + 0.35 * lvOf('b_bris');
    if (L.counter > 0 && (o.kind === 'basic' || o.kind === 'skill')) { m *= 1 + 0.8 * lvOf('b_contre'); L.counter = 0; S.fx.ring(f.center(), { r0: 0.3, r1: 3, color: 0xffffff, life: 0.25, width: 0.3 }); }
    // gel : la chance est tirée ici pour que l'information parte avec le coup (le boss / la horde ralentit chez l'hôte)
    // un « coup » = un geste (plusieurs ennemis touchés par le même geste ne comptent qu'une fois)
    if (o.kind === 'basic' && S.t > (L.swingT || 0)) { L.swingT = S.t + 0.08; L.atkN++; L.swingNew = true; }
    if (lvOf('b_belier') && o.kind === 'basic') o.kb = (typeof o.kb === 'number' ? o.kb : 2.2) * 2;
    if (lvOf('b_froid') && o.kind === 'basic' && L.atkN % 4 === 0) {
      o.freeze = 0.6 + 0.3 * lvOf('b_froid'); L.frozen.set(key, S.t + o.freeze + 1.2);
      S.fx.burst(t.pos, { n: 14, color: 0xa8f0ff, speed: 5, life: 0.4 });
      // choc thermique : la cible brûlait déjà
      if (lvOf('d_vapeur') && L.burns.has(key)) { const c = t.pos.clone(); T().later(0.05, () => { zone(S, c, 3.5, 400, { color: '#ffffff' }); S.fx.flash(c, { color: 0xffffff, r: 3, life: 0.3, intensity: 6 }); S.fx.burst(c, { n: 40, color: 0xe8f4ff, kind: 'smoke', speed: 8, life: 0.9, size: 0.8, grav: -2 }); fxSend(S, { n: 'boom', x: c.x, y: c.y, z: c.z, r: 3.5, c: 0xffffff }); }, 'A'); }
    }
    return m;
  };

  /* ---------- après un coup ---------- */
  Q.onHit = function (S, owner, t, dmg, crit, o, at) {
    if (!isMe(S, owner)) return;
    const L = S.ascL, f = owner, key = keyOf(t);
    Q.emit('hit', S, f, t, dmg, crit, o, at);
    // vol de vie
    const ls = (o.kind === 'basic' ? 0.03 * lvOf('b_vamp') : 0) + (lvOf('b_dern') && f.hp / f.maxHp < 0.35 ? 0.08 : 0);
    // rituel : les pouvoirs soignent par ennemi touché (plafonné par pouvoir lancé)
    if (lvOf('b_rituel') && o.kind === 'skill' && L.ritual > 0) { const h = Math.min(L.ritual, f.maxHp * 0.01 * lvOf('b_rituel')); L.ritual -= h; heal(S, h); if (h > 4) S.fx.num(f.center(), '+' + Math.round(h), { color: '#ff6a8a' }); }
    if (ls > 0) { L.healAcc = (L.healAcc || 0) + dmg * ls; }
    // ultime
    if (o.kind !== 'ult' && f.asc.ultG > 1) f.ult = Math.min(100, f.ult + dmg * (o.kind === 'basic' ? 0.0042 : 0.0016) * (f.asc.ultG - 1));
    // brûlure
    if (lvOf('b_brul') && o.kind === 'basic') { const b = L.burns.get(key) || { next: S.t + 0.5 }; b.end = S.t + 3; b.dps = 36 * lvOf('b_brul'); L.burns.set(key, b); }
    // arc électrique
    const nAtk = o.kind === 'basic' && L.swingNew ? (L.swingNew = false, L.atkN) : 0;
    if (lvOf('b_chain') && nAtk && nAtk % 3 === 0) {
      const others = T().enemiesOf(f).filter(e => keyOf(e) !== key && e.pos.distanceTo(t.pos) < 11).sort((a, b) => a.pos.distanceTo(t.pos) - b.pos.distanceTo(t.pos));
      const seen = new Set(), list = []; for (const e of others) { const k = keyOf(e); if (seen.has(k)) continue; seen.add(k); list.push(e); if (list.length >= 3) break; }
      if (!list.length) list.push(t);
      let from = (at || t.pos).clone();
      list.forEach((e, i) => T().later(0.06 * (i + 1), () => { S.fx.bolt(from, e.pos.clone(), { color: 0x9ad8ff, life: 0.2 }); boonHit(S, e, 70 * lvOf('b_chain'), { color: '#9ad8ff' }); from = e.pos.clone(); }, 'A'));
      BR.Audio.fx('zap', { g: 0.5, rate: 1.4 });
    }
    // lames de vent : un coup de base sur trois part en lame qui traverse tout
    if (lvOf('b_lvent') && nAtk && nAtk % 3 === 0) {
      const d = f.fwd().setY(0).normalize(), a0 = f.pos.clone().setY(1), a1 = a0.clone().addScaledVector(d, 12), yaw = Math.atan2(d.x, d.z);
      T().hitLine(f, a0, a1, 1.6, 90 * lvOf('b_lvent'), { kind: 'boon', color: '#7dffb0', kb: 3 });
      windBlade(S, a0, d, yaw); fxSend(S, { n: 'wind', x: a0.x, y: a0.y, z: a0.z, dx: +d.x.toFixed(3), dz: +d.z.toFixed(3) }); BR.Audio.fx('swing', { g: 0.8, rate: 0.7 });
    }
    // bélier : un coup de base sur quatre libère une onde de choc
    if (lvOf('b_belier') && nAtk && nAtk % 4 === 0) {
      const c = (at || t.pos).clone().setY(0.4); zone(S, c, 3.6, 120 * lvOf('b_belier'), { color: '#e8eef8', kb: 8 });
      S.fx.ring(c.clone().setY(0.06), { r0: 0.5, r1: 4.2, color: 0xe8eef8, life: 0.3, width: 0.35 }); if (S.fx.debris) S.fx.debris(c, { n: 8, r: 0.6, speed: 7, size: 0.25 });
      T().shake(0.25); BR.Audio.fx('stomp', { g: 0.6, rate: 1.2 }); fxSend(S, { n: 'boom', x: c.x, y: c.y, z: c.z, r: 3.6, c: 0xe8eef8 });
    }
    // forme orageuse : chaque coup de base appelle la foudre sur la cible
    if (f.buff.storm && o.kind === 'basic' && S.t > (L.stormT || 0)) {
      L.stormT = S.t + 0.18; const p = t.pos.clone();
      S.fx.bolt(new V3(p.x + (Math.random() - 0.5) * 2, p.y + 12, p.z), p, { color: 0x9ad8ff, life: 0.18, jitter: 1.1 });
      boonHit(S, t, dmg * 0.6 + 40 * (f.stormLv || 1), { color: '#9ad8ff' }); fxSend(S, { n: 'bolt', x: p.x, y: p.y, z: p.z, c: 0x9ad8ff });
    }
  };

  /* ---------- dégâts reçus ---------- */
  Q.inMul = function (S, f, dmg, o) {
    if (!isMe(S, f) || !f.asc) return dmg;
    return dmg * f.asc.taken;
  };
  Q.onHurt = function (S, f, dmg) {
    if (!isMe(S, f)) return;
    Q.emit('hurt', S, f, dmg);
    const L = S.ascL; Q.me().stats.taken += dmg; L.downT = 0;
    if (lvOf('b_epines') && S.t > L.thornT) {
      L.thornT = S.t + 0.35; const r = lvOf('d_saignee') ? 8 : 4;
      const hits = zone(S, f.center(), r, 90 * lvOf('b_epines'), { color: '#cfd8e6' });
      S.fx.ring(f.pos.clone().setY(0.1), { r0: 0.5, r1: r, color: 0xcfd8e6, life: 0.3, width: 0.25 });
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; S.fx.spark(f.center(), new V3(Math.cos(a) * 12, 1, Math.sin(a) * 12), { color: 0xe8eef8, life: 0.25, size: 0.25 }); }
      if (lvOf('d_saignee') && hits.length) heal(S, 30 * lvOf('b_epines') * hits.length);
    }
  };
  // cœur de phénix / seconde chance : on ne tombe pas
  Q.cheatDeath = function (S, f) {
    if (!isMe(S, f)) return false;
    const L = S.ascL, M = Q.me();
    let why = null;
    if (lvOf('b_phenix') && !L.phoenix) { L.phoenix = true; why = 'phenix'; }
    else if (M.chance > 0 && !S.ended) { M.chance--; why = 'chance'; }
    if (!why) return false;
    f.hp = Math.round(f.maxHp * 0.5); f.inv = 2.2; f.stun = 0;
    const p = f.pos.clone();
    S.fx.flash(p.clone().setY(1), { color: 0xff9a3a, r: 6, life: 0.6, intensity: 10 }); S.fx.pillar(p, { color: 0xffb04a, r: 2.2, h: 22, life: 1.1 });
    S.fx.burst(p.clone().setY(1), { n: 140, color: 0xff8a2a, speed: 18, life: 1, size: 0.5 }); S.fx.ring(p.clone().setY(0.05), { r1: 9, color: 0xffb04a, life: 0.6, width: 0.2 });
    if (why === 'phenix') zone(S, f.center(), 7, 450, { color: '#ffb04a' });
    BR.Audio.fx('ult'); BR.Audio.fx('boom', { g: 0.8 }); T().shake(0.7);
    T().banner(why === 'phenix' ? 'RENAISSANCE' : 'SECONDE CHANCE', why === 'phenix' ? 'Le phénix te relève' : 'Plus de seconde chance pour cette course', 1.8, 'gold');
    fxSend(S, { n: 'boom', x: p.x, y: 1, z: p.z, r: 7, c: 0xff9a3a });
    return true;
  };

  /* ---------- esquive ---------- */
  Q.onDash = function (S, f, kind, dir) {
    if (!isMe(S, f)) return;
    Q.emit('dash', S, f, dir, kind);
    if (f.buff.storm && dir) {
      const a = f.center(), d = dir.clone().setY(0).normalize();
      f.pos.addScaledVector(d, 7.5); const Rm = BR.ArenaScene.R - 1, r = Math.hypot(f.pos.x, f.pos.z); if (r > Rm) { f.pos.x *= Rm / r; f.pos.z *= Rm / r; }
      const b = f.center(); S.fx.bolt(a, b, { color: 0x9ad8ff, life: 0.25, jitter: 0.8, segs: 12 }); S.fx.bolt(a, b, { color: 0xffffff, life: 0.12, jitter: 0.4, segs: 8, light: false });
      S.fx.burst(a, { n: 24, color: 0x9ad8ff, speed: 8, life: 0.35 }); S.fx.burst(b, { n: 24, color: 0x9ad8ff, speed: 8, life: 0.35 });
      for (let i = 0; i < 6; i++) S.fx.spark(a.clone().lerp(b, i / 5), new V3(0, 0.5, 0), { kind: 'smoke', color: 0x14121e, life: 0.6, size: 0.8, size1: 1.4, alpha: 0.8 });
      T().hitLine(f, a, b, 1.8, 120 * (f.stormLv || 1), { kind: 'boon', color: '#9ad8ff', stun: 0.2 });
      BR.Audio.fx('zap', { g: 0.8, rate: 1.2 }); fxSend(S, { n: 'bolt', x: b.x, y: b.y, z: b.z, c: 0x9ad8ff });
    }
    const p0 = f.pos.clone();
    if (lvOf('b_expl')) T().later(0.22, () => { const c = p0.clone().setY(0.6); zone(S, c, 3.6, 110 * lvOf('b_expl'), { color: '#ff8a3a' }); S.fx.flash(c, { color: 0xff7a2a, r: 2.2, life: 0.25, intensity: 5 }); S.fx.ring(p0.clone().setY(0.05), { r1: 4.2, color: 0xff7a2a, life: 0.35 }); S.fx.burst(c, { n: 30, color: 0xff8a3a, speed: 9, life: 0.5 }); BR.Audio.fx('boom', { g: 0.35, rate: 1.5, len: 0.5 }); fxSend(S, { n: 'boom', x: c.x, y: c.y, z: c.z, r: 3.6, c: 0xff7a2a }); }, 'A');
    if (lvOf('b_dashz')) { const seen = new Set(); [0.05, 0.11, 0.18].forEach(tt => T().later(tt, () => { for (const e of T().enemiesOf(f)) { const k = keyOf(e); if (seen.has(k) || e.pos.distanceTo(f.center()) > 2.8 + e.r) continue; seen.add(k); S.fx.bolt(f.center(), e.pos.clone(), { color: 0x9ad8ff, life: 0.18 }); boonHit(S, e, 120 * lvOf('b_dashz'), { color: '#9ad8ff' }); } }, 'A')); }
    if (lvOf('b_trail')) T().later(0.2, () => { const p1 = f.pos.clone(); if (p1.distanceTo(p0) < 1) return; T().hitLine(f, p0.clone().setY(1), p1.clone().setY(1), 1.6, 140 * lvOf('b_trail'), { kind: 'boon', color: '#7dffb0' }); const yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z); S.fx.slash(p0.clone().lerp(p1, 0.5).setY(1), yaw, { r: p0.distanceTo(p1) * 0.6 + 1.5, arc: 0.5, color: 0x7dffb0, life: 0.3, tilt: Math.PI / 2 }); for (let k = 0; k <= 8; k++) S.fx.spark(p0.clone().lerp(p1, k / 8).setY(1), new V3(0, 2, 0), { color: 0x7dffb0, life: 0.4, size: 0.4 }); }, 'A');
    if (lvOf('b_glace')) T().later(0.2, () => {
      const p1 = f.pos.clone(); if (p1.distanceTo(p0) < 1) return; const n = Math.max(2, Math.round(p1.distanceTo(p0) / 1.2));
      for (let k = 0; k <= n; k++) { const q = p0.clone().lerp(p1, k / n); S.fx.spark(q.clone().setY(0.2), new V3(0, 1.5, 0), { color: 0xbfefff, life: 1.4, size: 0.55, size1: 0.1 }); }
      T().every(1.5, 0.3, () => { const hits = T().hitLine(f, p0.clone().setY(0.6), p1.clone().setY(0.6), 1.4, 80 * lvOf('b_glace') * 0.3, { kind: 'boon', color: '#bfefff', freeze: 1 }); hits.forEach(e => S.ascL && S.ascL.frozen.set(keyOf(e), S.t + 2)); });
      BR.Audio.fx('ice', { g: 0.5 }); fxSend(S, { n: 'line', x: p0.x, z: p0.z, x2: p1.x, z2: p1.z, c: 0xbfefff });
    }, 'A');
    if (lvOf('b_ruee')) { const seen = new Set(); [0.05, 0.12, 0.19].forEach(tt => T().later(tt, () => { for (const e of T().enemiesOf(f)) { const k = keyOf(e); if (seen.has(k) || e.pos.distanceTo(f.center()) > 2.6 + e.r) continue; seen.add(k); boonHit(S, e, 60 * lvOf('b_ruee'), { color: '#ff3a5a' }); const h = f.maxHp * 0.02 * lvOf('b_ruee'); heal(S, h); S.fx.num(f.center(), '+' + Math.round(h), { color: '#ff6a8a' }); S.fx.burst(e.pos.clone().setY(1), { n: 14, color: 0xff2a4a, speed: 6, life: 0.4 }); } }, 'A')); }
    if (lvOf('b_charge')) { const seen = new Set(); [0.04, 0.1, 0.16].forEach(tt => T().later(tt, () => { for (const e of T().enemiesOf(f)) { const k = keyOf(e); if (seen.has(k) || e.pos.distanceTo(f.center()) > 2.8 + e.r) continue; seen.add(k); boonHit(S, e, 90 * lvOf('b_charge'), { color: '#e8eef8', kb: 9, stun: 0.4 }); S.fx.burst(e.pos.clone().setY(1), { n: 12, color: 0xe8eef8, speed: 7, life: 0.3 }); BR.Audio.fx('metal', { g: 0.6 }); } }, 'A'));
      f.shield = Math.max(f.shield || 0, f.maxHp * 0.05 * lvOf('b_charge')); S.fx.ring(f.center(), { r0: 0.6, r1: 1.8, color: 0xe8eef8, life: 0.3, width: 0.25 }); }
    if (lvOf('d_ouragan')) { const c = f.center(); zone(S, c, 4.5, 220, { color: '#9ad8ff' }); S.fx.ring(f.pos.clone().setY(0.1), { r0: 0.5, r1: 4.5, color: 0x9ad8ff, life: 0.3, width: 0.25 }); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; S.fx.bolt(c, c.clone().add(new V3(Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5)), { color: 0x9ad8ff, life: 0.18, light: i === 0 }); } }
    void kind;
  };
  Q.onPerfect = function (S, f, kind) {
    if (!isMe(S, f)) return;
    Q.emit('perfect', S, f, kind);
    const st = Q.me().stats; if (kind === 'dodge') st.perfect++; else st.parries++;
    if (lvOf('b_contre')) S.ascL.counter = 1;
    if (kind === 'dodge' && lvOf('b_zero')) {
      const c = f.center(); zone(S, c, 8, 260 * lvOf('b_zero'), { color: '#a8f0ff', freeze: 1.5 });
      for (const e of T().enemiesOf(f)) if (e.pos.distanceTo(c) < 8 + e.r) S.ascL.frozen.set(keyOf(e), S.t + 2.7);
      playFx(S, { n: 'ice', x: c.x, y: c.y, z: c.z }); fxSend(S, { n: 'ice', x: c.x, y: c.y, z: c.z }); BR.Audio.fx('ice', { g: 0.8 });
    }
  };
  Q.onCast = function (S, f, id, slot, lv) {
    if (!isMe(S, f)) return;
    Q.emit('cast', S, f, id, slot, lv);
    if (slot !== 'ult' && lvOf('b_echo') && !f.echoing) {
      T().later(0.6, () => { if (!S || S.ended || !f.alive) return; f.echoing = true; const aim = f.ctl.aim.clone(); S.fx.ring(f.center(), { r0: 0.4, r1: 2.6, color: 0xffd76a, life: 0.3, width: 0.25 }); T().recast(f, id, lv, aim); f.echoing = false; }, 'A');
    }
    const L = S.ascL, aim = f.ctl && f.ctl.aim ? f.ctl.aim.clone().setY(0) : f.pos.clone();
    if (slot !== 'ult') {
      L.ritual = f.maxHp * 0.1;
      if (lvOf('b_cd')) { f.buff.haste = 1; f.buff.hasteT = 1.6; S.fx.ring(f.pos.clone().setY(0.1), { r0: 0.5, r1: 2.4, color: 0x7dffb0, life: 0.3, width: 0.2 }); }
      if (lvOf('b_nova')) T().later(0.12, () => { const c = f.center(); const hits = zone(S, c, 7, 100 * lvOf('b_nova'), { color: '#a8f0ff', freeze: 0.8 }); hits.forEach(e => L.frozen.set(keyOf(e), S.t + 1.6)); playFx(S, { n: 'ice', x: c.x, y: c.y, z: c.z }); fxSend(S, { n: 'ice', x: c.x, y: c.y, z: c.z }); BR.Audio.fx('ice', { g: 0.6 }); }, 'A');
      if (lvOf('b_orage')) { const list = nearestN(S, f, aim, 3, 22); list.forEach((e, i) => T().later(0.15 + i * 0.09, () => { const p = e.pos.clone(); S.fx.bolt(new V3(p.x, 18, p.z), p, { color: 0xbfe6ff, life: 0.3 }); S.fx.flash(p, { color: 0x9ad8ff, r: 3, life: 0.25, intensity: 6 }); boonHit(S, e, 200 * lvOf('b_orage'), { color: '#bfe6ff', stun: 0.3 }); fxSend(S, { n: 'bolt', x: p.x, y: p.y, z: p.z, c: 0xbfe6ff }); BR.Audio.fx('zap', { g: 0.7, rate: 0.9 + i * 0.15 }); }, 'A')); }
      if (lvOf('b_meteo')) { const list = nearestN(S, f, aim, 3, 24); for (let i = 0; i < 3; i++) { const e = list[i % Math.max(1, list.length)]; const p = (e ? e.pos.clone() : aim.clone()).setY(0).add(new V3((Math.random() - 0.5) * 2.5, 0, (Math.random() - 0.5) * 2.5)); meteor(S, p, 130 * lvOf('b_meteo'), 0.35 + i * 0.16); } }
    } else {
      if (lvOf('b_apoc')) T().later(0.3, () => { const c = f.center(); zone(S, c, 10, 400 * lvOf('b_apoc'), { color: '#ff7a2a', kb: 10 }); S.fx.ring(f.pos.clone().setY(0.08), { r0: 1, r1: 11, color: 0xff7a2a, life: 0.6, width: 0.5 }); S.fx.flash(c, { color: 0xff7a2a, r: 8, life: 0.4, intensity: 8 }); for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; S.fx.spark(c.clone(), new V3(Math.cos(a) * 22, 2, Math.sin(a) * 22), { color: 0xffa040, life: 0.5, size: 0.9, size1: 0.1 }); } T().shake(0.8); BR.Audio.fx('boom', { g: 1 }); fxSend(S, { n: 'boom', x: c.x, y: c.y, z: c.z, r: 10, c: 0xff7a2a }); }, 'A');
      if (lvOf('b_ultf')) for (let i = 0; i < 8; i++) T().later(0.2 + i * 0.12, () => { const a = Math.random() * 6.283, d = 3 + Math.random() * 7, p = f.pos.clone().add(new V3(Math.cos(a) * d, 0, Math.sin(a) * d)); S.fx.bolt(new V3(p.x, 18, p.z), p.clone().setY(0.2), { color: 0xbfe6ff, life: 0.25 }); zone(S, p.clone().setY(0.5), 3, 150 * lvOf('b_ultf'), { color: '#bfe6ff', stun: 0.3 }); fxSend(S, { n: 'bolt', x: p.x, y: 0.2, z: p.z, c: 0xbfe6ff }); BR.Audio.fx('zap', { g: 0.6, rate: 0.8 + Math.random() * 0.5 }); }, 'A');
      if (lvOf('b_hiver')) { const c = f.center(), dur = 1.5 + 0.5 * lvOf('b_hiver'); zone(S, c, 15, 80, { color: '#a8f0ff', freeze: dur, stun: dur }); for (const e of T().enemiesOf(f)) if (e.pos.distanceTo(c) < 15 + e.r) L.frozen.set(keyOf(e), S.t + dur + 1); S.fx.ring(f.pos.clone().setY(0.08), { r0: 1, r1: 16, color: 0xa8f0ff, life: 0.8, width: 0.6 }); playFx(S, { n: 'ice', x: c.x, y: c.y, z: c.z }); fxSend(S, { n: 'ice', x: c.x, y: c.y, z: c.z }); BR.Audio.fx('ice', { g: 1, rate: 0.7 }); }
      if (lvOf('b_festin')) { const h = f.maxHp * 0.15 * lvOf('b_festin'); heal(S, h); S.fx.num(f.center(), '+' + Math.round(h), { color: '#ff6a8a' }); S.fx.pillar && S.fx.pillar(f.pos.clone(), { color: 0xff3a5a, r: 1.6, h: 8, life: 0.8 }); BR.Audio.fx('heal'); }
      if (lvOf('b_cyclone')) { L.cyclone = S.t + 6; L.cycT = 0; }
    }
    if (slot === 'ult' && lvOf('c_cri')) { S.ascL.cri = S.t + 8; T().send({ k: 'qa', t: 'cri' }); T().banner('CRI DE GUERRE', '+30 % de dégâts pour toute l\'équipe', 1.4, 'gold'); }
  };

  /* ---------- serviteur abattu : orbe de vie (visible seulement par toi, ramassée par toi) ---------- */
  Q.onAddDeath = function (S, a, silent) {
    Q.emit('kill', S, a, silent);
    if (!silent && S.ascL && S.asc && (a.type === 'gobelin' && !a.escaped || a.elite)) {
      const fl = S.asc.floor || 1, g = Q.addGold ? Q.addGold(a.type === 'gobelin' ? 70 + 14 * fl : 12 + 3 * fl) : 0;
      if (g > 0) { const p = a.pos.clone().setY(2.2); S.fx.num(p, '+' + g + ' or', { color: '#ffc83a' }); BR.Audio.ui('buy'); const gb = S.hud.querySelector('.at-g b'); if (gb) gb.textContent = Q.me().gold; }
    }
    if (a.type === 'gobelin' || a.type === 'totem') return;
    if (silent || !S.ascL || Math.random() > 0.09) return;
    const m = new THREE.Mesh(S.fx.geo.sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7dff9a).multiplyScalar(1.6) }));
    m.scale.setScalar(0.35); m.position.copy(a.pos).setY(0.6); S.scene.add(m);
    S.ascL.lifeOrbs.push({ m, t: 0 });
  };

  /* ---------- étage nettoyé ---------- */
  Q.cleared = function (S) {
    const A = S.asc, k = A.room.kind;
    BR.Arena.banner(k === 'final' ? 'L\'ASCENSION EST ACCOMPLIE' : k === 'gardien' ? 'GARDIEN VAINCU' : k === 'elite' ? 'ÉLITE VAINCU' : 'ÉTAGE NETTOYÉ', '+' + A.room.gold + ' or', 3, 'gold');
  };

  /* ---------- tic ---------- */
  Q.tick = function (S, rdt, dt) {
    const L = S.ascL, f = S.me, A = S.asc; if (!L || dt <= 0 && rdt <= 0) return;
    if (Q.W && Q.W.alive()) Q.W.tick(rdt);
    if (f.alive && dt > 0) Q.emit('tick', S, dt);
    L.goldT = (L.goldT || 0) - rdt; if (L.goldT <= 0) { L.goldT = 0.25; const gb = S.hud.querySelector('.at-g b'), M = Q.me(); if (gb && M && gb.textContent !== String(M.gold)) gb.textContent = M.gold; }
    // apparence envoyée aux autres (plusieurs fois : ils ne démarrent pas tous au même instant)
    if (L.lookT.length && S.t > L.lookT[0]) { L.lookT.shift(); T().send({ k: 'qa', t: 'look', sz: f.sizeMul || 1, hd: f.headMul || 1 }); Q.announce(S); }
    // élite régénérant (hôte)
    if (S.isHost && S.boss && S.boss.regen && !S.boss.dead) { const b = S.boss; if (b.hp < b.lastHp - 1) b.quietT = 0; b.quietT = (b.quietT || 0) + dt; if (b.quietT > 3) { const amt = b.maxHp * 0.012 * dt; if (b.healPools) b.healPools(amt); else b.hp = Math.min(b.maxHp, b.hp + amt); } b.lastHp = b.hp; }
    if (!f.alive) { reviveLogic(S, rdt); }
    else { L.rv = 0; const rv = S.hud.querySelector('.asc-rv'); if (rv && rv.classList.contains('on')) rv.classList.remove('on'); }
    allyHint(S);
    if (!f.alive) return;
    // zones du décor : la lave brûle, la boue ralentit (seulement au sol)
    const hz = S.env && S.env.hazards; f.mud = 0;
    if (hz && hz.length && f.pos.y < 0.3) for (const z of hz) {
      if (Math.hypot(f.pos.x - z.x, f.pos.z - z.z) > z.r) continue;
      if (z.kind === 'mud') { f.mud = 1; if (Math.random() < dt * 6 && f.moving !== false) S.fx.burst(f.pos.clone().setY(0.1), { n: 2, color: 0x2a3a24, speed: 1.5, up: 1, life: 0.4, size: 0.3 }); }
      if (z.kind === 'lava') { L.lavaT = (L.lavaT || 0) - dt; if (L.lavaT <= 0) { L.lavaT = 0.4; T().hurtFighter(f, Math.round(f.maxHp * 0.035), { kind: 'lava', unblockable: true }); S.fx.burst(f.pos.clone().setY(0.2), { n: 10, color: 0xff6a1a, speed: 4, up: 3, life: 0.5, size: 0.4 }); BR.Audio.fx('fire', { g: 0.4 }); } }
    }
    // brûlures
    if (L.burns.size) for (const [key, b] of L.burns) {
      if (S.t > b.end) { L.burns.delete(key); continue; }
      if (S.t >= b.next) {
        b.next = S.t + 0.5; const t = findTarget(S, key); if (!t) { L.burns.delete(key); continue; }
        boonHit(S, t, b.dps * 0.5, { color: '#ff8a3a' });
        S.fx.burst(t.pos, { n: 8, color: 0xff7a2a, speed: 3, up: 1.5, life: 0.5, size: 0.35 });
        if (lvOf('d_plasma') && Math.random() < 0.5) { const o2 = T().enemiesOf(f).find(e => keyOf(e) !== key && e.pos.distanceTo(t.pos) < 9); if (o2) { S.fx.bolt(t.pos.clone(), o2.pos.clone(), { color: 0xffa0ff, life: 0.18, light: false }); boonHit(S, o2, b.dps * 0.6, { color: '#ffa0ff' }); } }
      }
    }
    // vol de vie (regroupé pour ne pas inonder l'écran de chiffres)
    L.healT -= dt; if (L.healT <= 0) { L.healT = 0.5; if (L.healAcc > 1) { const h = Math.min(L.healAcc, f.maxHp * 0.04); heal(S, h); if (h >= 5) S.fx.num(f.center(), '+' + Math.round(h), { color: '#7dff9a' }); } L.healAcc = 0; }
    // œil du cyclone (après l'ultime)
    if (L.cyclone > S.t) {
      L.cycT -= dt; const c = f.pos.clone();
      for (let k = 0; k < 3; k++) { const a = S.t * 9 + k * 2.094, r = 2 + (S.t * 3 + k) % 2.5; S.fx.spark(c.clone().add(new V3(Math.cos(a) * r, 0.4 + k * 0.9, Math.sin(a) * r)), new V3(-Math.sin(a) * 6, 1.5, Math.cos(a) * 6), { color: 0xcfffe8, life: 0.35, size: 0.6, size1: 0.1 }); }
      if (L.cycT <= 0) { L.cycT = 0.3; zone(S, c.clone().setY(1), 4.2, 60 * lvOf('b_cyclone'), { color: '#7dffb0' }); }
    }
    // armure de givre
    if (lvOf('b_armure')) { L.armT -= dt; if (L.armT <= 0) { L.armT = 12; f.shield = Math.max(f.shield || 0, f.maxHp * 0.1 * lvOf('b_armure')); S.fx.burst(f.center(), { n: 30, color: 0xa8f0ff, speed: 4, life: 0.5 }); } }
    // lames orbitales
    if (L.orbs.length) {
      const n = L.orbs.length, c = f.center(); L.orbT -= dt;
      const hit = L.orbT <= 0; if (hit) L.orbT = 0.35;
      L.orbs.forEach((m, i) => {
        const a = S.t * 3.2 + i / n * Math.PI * 2; m.position.set(c.x + Math.cos(a) * 2.3, c.y + Math.sin(S.t * 2 + i) * 0.3, c.z + Math.sin(a) * 2.3); m.rotation.y = -a; m.rotation.z = 0.5;
        if (hit) { const seen = new Set(); for (const e of T().enemiesOf(f)) { const k = keyOf(e); if (seen.has(k) || e.pos.distanceTo(m.position) > 1.1 + e.r) continue; seen.add(k); boonHit(S, e, 55 * lvOf('b_orbes'), { color: '#ffd76a' }); S.fx.burst(m.position, { n: 6, color: 0xffd76a, speed: 5, life: 0.25 }); } }
        if (Math.random() < dt * 20) S.fx.spark(m.position, new V3(), { color: 0xffd76a, life: 0.2, size: 0.25 });
      });
    }
    // orbes de vie
    for (let i = L.lifeOrbs.length - 1; i >= 0; i--) {
      const o = L.lifeOrbs[i]; o.t += dt; o.m.position.y = 0.6 + Math.sin(o.t * 4) * 0.15; o.m.scale.setScalar(0.32 + Math.sin(o.t * 8) * 0.04);
      if (Math.random() < dt * 8) S.fx.spark(o.m.position, new V3(0, 1.5, 0), { color: 0x7dff9a, life: 0.4, size: 0.25 });
      const d = Math.hypot(o.m.position.x - f.pos.x, o.m.position.z - f.pos.z);
      if (d < 1.8 || o.t > 25) { if (d < 1.8) { const h = f.maxHp * 0.1; heal(S, h); S.fx.num(f.center(), '+' + Math.round(h), { color: '#7dff9a' }); S.fx.burst(f.center(), { n: 20, color: 0x7dff9a, speed: 5, life: 0.5 }); BR.Audio.fx('heal', { g: 0.5 }); } S.scene.remove(o.m); o.m.material.dispose(); L.lifeOrbs.splice(i, 1); }
    }
  };
  // à terre : un allié qui reste près de toi te relève ; seul (ou tout le monde à terre) = défaite gérée par le moteur
  function reviveLogic(S, dt) {
    const L = S.ascL, f = S.me, rv = S.hud.querySelector('.asc-rv'); if (!rv) return;
    const allies = [...S.fighters.values()].filter(a => a !== f && a.alive);
    if (!allies.length) { rv.classList.remove('on'); return; }
    let near = null, nd = 1e9; for (const a of allies) { const d = a.pos.distanceTo(f.pos); if (d < nd) { nd = d; near = a; } }
    const speed = near && near.ascAnge ? 2 : 1;
    if (near && nd < 2.8) L.rv += dt * speed; else L.rv = Math.max(0, L.rv - dt * 0.5);
    rv.classList.add('on');
    rv.innerHTML = `<b>À TERRE</b><span>${near && nd < 2.8 ? BR.esc(near.name) + ' te relève…' : 'Un allié doit rester près de toi'}</span><i><i style="width:${Math.min(100, L.rv / 2.5 * 100)}%"></i></i>`;
    if (Math.random() < dt * 3) S.fx.ring(f.pos.clone().setY(0.05), { r0: 2.6, r1: 2.8, color: 0xffe08a, life: 0.5, width: 0.4 });
    if (L.rv >= 2.5) {
      L.rv = 0; T().revive(f, near && near.ascAnge ? 0.6 : 0.35);
      Q.me().stats.downs++;
      T().send({ k: 'qa', t: 'rvby', id: near.id });
      T().banner('RELEVÉ', 'par ' + near.name, 1.4, 'gold');
    }
  }
  // indication « relève X » quand un allié est à terre près de moi
  function allyHint(S) {
    const h = S.hud.querySelector('.asc-hint'); if (!h) return;
    let txt = '';
    if (S.me.alive) for (const a of S.fighters.values()) {
      if (a === S.me || a.alive) continue;
      const d = a.pos.distanceTo(S.me.pos);
      if (Math.random() < 0.05) S.fx.ring(a.pos.clone().setY(0.05), { r0: 2.6, r1: 2.8, color: 0xffe08a, life: 0.6, width: 0.4 });
      if (d < 9) { txt = d < 2.8 ? `Tu relèves <b>${BR.esc(a.name)}</b>… reste près de lui` : `<b>${BR.esc(a.name)}</b> est à terre : va le relever !`; break; }
    }
    if (h._t !== txt) { h._t = txt; h.innerHTML = txt; h.classList.toggle('on', !!txt); }
  }

  /* ---------- messages des autres joueurs pendant l'étage ---------- */
  Q.onNet = function (S, from, d) {
    if (d.k !== 'qa') return;
    const f = S.fighters.get(from);
    if (d.t === 'tree') { Q.emit('net', S, f, d); return; }
    switch (d.t) {
      case 'look': if (f) { f.sizeBase = BR.clamp(+d.sz || 1, 0.4, 1.6); if (f.arriveT == null && !f.suck) f.sizeMul = f.sizeBase; f.headMul = BR.clamp(+d.hd || 1, 1, 2.5); } break;
      case 'ange': if (f) f.ascAnge = true; break;
      case 'cri': S.ascL.cri = S.t + 8; T().banner('CRI DE GUERRE', (f ? f.name : 'Un allié') + ' : +30 % de dégâts', 1.4, 'gold'); BR.Audio.fx('roar', { g: 0.4, rate: 1.4 }); break;
      case 'heal': if (S.me.alive && Math.hypot(S.me.pos.x - d.x, S.me.pos.z - d.z) < 12 && d.a > 0) { const h = Math.min(d.a, S.me.maxHp - S.me.hp); S.me.hp += h; if (h >= 5) S.fx.num(S.me.center(), '+' + Math.round(h), { color: '#7dff9a' }); } break;
      case 'rvby': if (d.id === S.selfId) { Q.me().stats.revives++; T().banner('TU AS RELEVÉ ' + (f ? f.name.toUpperCase() : 'UN ALLIÉ'), '', 1.2, 'gold'); } break;
      case 'fx': playFx(S, d); break;
    }
  };
  // l'ange gardien se signale (les relevés qu'il fait vont 2× plus vite chez celui qui est à terre)
  Q.announce = function (S) { if (lvOf('c_ange')) T().send({ k: 'qa', t: 'ange' }); };
})();

/* ===== arena/asc-classes.js : les classes de l'Ascension (Chevalier, Mage, Archer) =====
   Chaque classe a son arme et joue CHAQUE pouvoir à sa façon : la même compétence (même icône, même niveau)
   devient une transformation ou une lame pour le Chevalier, un sort pour le Mage, des flèches pour l'Archer.
   Exemple — Tempête de foudre : le Chevalier devient une nuée d'orage (vitesse, coups foudroyants, esquives
   téléportées), le Mage invoque un nuage d'orage, l'Archer fait pleuvoir des flèches de foudre.
   Le sort lancé dépend de la classe du lanceur (f.kit.cls) : tout le monde voit la bonne version. */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, AR = BR.ARENA, SK = BR.ASkills;
  const Q = (BR.Asc = BR.Asc || {});
  const UP = new V3(0, 1, 0);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const C = c => new THREE.Color(c);

  /* ---------------- l'arbalète de l'Archer ---------------- */
  AR.WEAPONS.bow = {
    name: 'Arbalète', tag: 'Tirs rapides · perçants', stats: [4, 2, 5], desc: 'Tirs rapides à distance, coups critiques fréquents. Tir chargé perforant.', color: '#9aff7a',
    models: [['char_rogue', '2H_Crossbow', 'R']], parry: 0.18, ranged: true, crit: 0.14, dashCd: 0.85,
    combo: [
      { a: '2H_Ranged_Shoot', sp: 2.6, hit: 0.08, dur: 0.26, dmg: 52, arrow: 1 },
      { a: '2H_Ranged_Shoot', sp: 2.6, hit: 0.08, dur: 0.26, dmg: 52, arrow: 1 },
      { a: '2H_Ranged_Shoot', sp: 2.2, hit: 0.1, dur: 0.36, dmg: 40, arrow: 3, fin: true },
    ],
    heavy: { a: '2H_Ranged_Shoot', sp: 1.1, hit: 0.32, dur: 0.6, dmg: 280, arrow: 1, pierce: true, big: 1 },
    air: { dmg: 110, r: 3.4 },
  };

  /* ---------------- les classes ---------------- */
  Q.CLASSES = {
    chevalier: { id: 'chevalier', n: 'Chevalier', weapon: 'blade', col: '#7ec8ff', look: 'Épée et bouclier', d: 'Au contact. Pare, encaisse et tranche. Ses pouvoirs le transforment : lames géantes, charges, forme d\'orage.', start: ['fente', 'onde', 'tourbillon', 'bond', 'garde'], kit: ['fente', 'tourbillon', 'bond', 'garde'], ult: 'u_lame' },
    mage: { id: 'mage', n: 'Mage', weapon: 'staff', col: '#c070ff', look: 'Bâton arcanique', d: 'À distance. Sorts de zone, nuées, trous noirs et téléportations. Fragile mais dévastateur.', start: ['traits', 'fente', 'onde', 'tourbillon', 'bond'], kit: ['traits', 'onde', 'fente', 'pluie'], ult: 'u_meteore' },
    archer: { id: 'archer', n: 'Archer', weapon: 'bow', col: '#9aff7a', look: 'Arbalète', d: 'Agile et précis. Volées de flèches, pluies de traits, flèches piégées. Danse autour des colosses.', start: ['traits', 'fente', 'onde', 'tourbillon', 'bond'], kit: ['traits', 'fente', 'tourbillon', 'pluie'], ult: 'u_lames' },
  };
  Q.classOf = f => f && ((f.kit && f.kit.cls) || f.ascClass) || null;

  /* ---------------- noms et descriptions de chaque pouvoir selon la classe ---------------- */
  const NAMES = {
    chevalier: {
      traits: ['Lames volantes', 'Lance 3 épées spectrales qui traquent la cible (5 au niveau 3).'],
      chaine: ['Lame foudroyante', 'Un estoc chargé de foudre : l\'éclair saute d\'ennemi en ennemi depuis ton épée.'],
      lance: ['Charge glaciale', 'Fonce sur 9 m dans un sillage de glace qui gèle tout ce qu\'il traverse.'],
      tornade: ['Ouragan d\'acier', 'Tu tournoies au cœur d\'une tornade qui te suit et hache tout autour de toi.'],
      gravite: ['Lame du néant', 'Plante ton épée : une faille gravitationnelle s\'ouvre là où tu vises.'],
      tempete: ['Forme orageuse', 'Tu deviens une nuée d\'orage : bien plus rapide, chaque coup foudroie, tes esquives deviennent des téléportations électriques (6 s).'],
      u_rayon: ['Taille-monde', 'Une gigantesque lame d\'énergie fend l\'arène en ligne droite.'],
      u_meteore: ['Chute du colosse', 'Tu bondis dans les nuages et t\'écrases comme un météore à l\'endroit visé.'],
    },
    mage: {
      fente: ['Transfert', 'Te téléporte vers la zone visée ; une explosion arcanique au départ et à l\'arrivée.'],
      onde: ['Nova arcanique', 'Une onde d\'énergie pure jaillit de toi et repousse tout.'],
      tourbillon: ['Orbes tourbillonnants', '6 orbes tournent autour de toi et frappent tout ce qu\'ils touchent.'],
      bond: ['Chute astrale', 'Tu t\'élèves dans les airs puis frappes le sol d\'une explosion d\'étoiles.'],
      dragon: ['Souffle du dragon', 'Un souffle de flammes continu devant toi.'],
      pluie: ['Pluie d\'étoiles', 'Des éclats d\'étoiles s\'abattent sur la zone visée.'],
      tempete: ['Nuée d\'orage', 'Un nuage d\'orage noir se forme au-dessus de la zone et la foudroie.'],
      u_lames: ['Mille éclats', 'Une tempête de projectiles arcaniques converge de partout sur ta cible.'],
      fantomes: ['Grimoires gardiens', '6 lames de lumière gravitent autour de toi et partent seules sur la cible.'],
    },
    archer: {
      fente: ['Pas chassé', 'Bond de côté en tirant 3 flèches sur les ennemis les plus proches. Invulnérable pendant le saut.'],
      onde: ['Flèche sismique', 'Une flèche qui frappe le sol et libère une onde de choc.'],
      tourbillon: ['Tir en rafale', 'Tu pivotes en tirant des flèches tout autour de toi (12, puis 20).'],
      traits: ['Flèches traqueuses', '3 flèches à tête chercheuse (5 au niveau 3).'],
      bond: ['Saut de l\'aigle', 'Salto arrière, puis une volée de flèches explosives sur la zone visée.'],
      chaine: ['Flèche électrique', 'Une flèche chargée : l\'éclair rebondit sur 4 ennemis (7 au niveau 3).'],
      lance: ['Flèche de givre', 'Une flèche perforante qui gèle tout sur sa trajectoire.'],
      tornade: ['Flèche tornade', 'La flèche se change en tornade là où elle se plante.'],
      pluie: ['Pluie de flèches', 'Une averse de flèches s\'abat sur la zone visée.'],
      fantomes: ['Flèches spectrales', 'Des flèches fantômes tournent autour de toi et partent seules sur tes cibles.'],
      gravite: ['Flèche singularité', 'La flèche ouvre un trou noir là où elle se plante.'],
      dragon: ['Flèche du dragon', 'Une flèche de feu géante qui perfore tout et laisse une traînée brûlante.'],
      tempete: ['Déluge foudroyant', 'Une pluie de flèches de foudre tombe du ciel sur la zone visée.'],
      u_lame: ['Flèche céleste', 'Une flèche de lumière gigantesque tombe du ciel.'],
      u_lames: ['Mille flèches', 'Tu te téléportes autour de ta cible en la criblant de flèches.'],
      u_meteore: ['Flèche météore', 'Tu tires vers le ciel : un météore enflammé retombe sur la zone visée.'],
      u_rayon: ['Tir annihilateur', 'Un rayon dévastateur jaillit de ton arbalète et suit ta visée.'],
    },
  };
  Q.skillName = (id, cls) => (NAMES[cls] && NAMES[cls][id] && NAMES[cls][id][0]) || (AR.skill(id) || {}).name || id;
  Q.skillDesc = (id, cls) => (NAMES[cls] && NAMES[cls][id] && NAMES[cls][id][1]) || (AR.skill(id) || {}).desc || '';

  /* ---------------- flèches ---------------- */
  const AG = { shaft: new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5).rotateX(Math.PI / 2), head: new THREE.ConeGeometry(0.085, 0.26, 6).rotateX(Math.PI / 2).translate(0, 0, 0.6), fl: new THREE.PlaneGeometry(0.16, 0.28).translate(0, 0, -0.38), glow: new THREE.SphereGeometry(0.16, 8, 6).scale(1, 1, 4) };
  Object.values(AG).forEach(g => { g.userData.keep = true; });
  // flèche orientée vers +Z (les projectiles du moteur regardent dans le sens de leur vitesse)
  function arrowMesh(color, scale) {
    const c = C(color || '#ffffff');
    const g = new THREE.Group();
    const mShaft = new THREE.MeshBasicMaterial({ color: c.clone().lerp(C(0xffffff), 0.5).multiplyScalar(1.4) });
    const mHead = new THREE.MeshBasicMaterial({ color: C(0xffffff).multiplyScalar(2) });
    const mFl = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2), side: THREE.DoubleSide, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const mGlow = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    g.add(new THREE.Mesh(AG.shaft, mShaft), new THREE.Mesh(AG.head, mHead), new THREE.Mesh(AG.glow, mGlow));
    const f1 = new THREE.Mesh(AG.fl, mFl), f2 = new THREE.Mesh(AG.fl, mFl); f2.rotation.z = Math.PI / 2; g.add(f1, f2);
    g.scale.setScalar(scale || 1);
    g.userData.mats = [mShaft, mHead, mFl, mGlow];
    return g;
  }
  BR.AscFX = BR.AscFX || {}; BR.AscFX.arrowMesh = arrowMesh;
  const disposeArrow = m => { if (m && m.userData.mats) m.userData.mats.forEach(x => x.dispose()); };
  // tire une flèche (dégâts : seulement chez le lanceur ; les autres la voient)
  function shoot(ctx, dir, o) {
    o = o || {};
    const f = ctx.f, from = o.from || f.center().add(new V3(0, 0.25, 0)).addScaledVector(dir, 0.6);
    const mesh = arrowMesh(o.color || ctx.color, o.scale || 1), end = o.onEnd;
    return ctx.proj(Object.assign({ pos: from, vel: dir.clone().normalize().multiplyScalar(o.speed || 50), r: o.r || 0.45, life: o.life || 1.4, size: o.size || 0.6 }, o, { mesh, from: undefined, onEnd: p => { disposeArrow(mesh); if (end) end(p); } }));
  }
  const aimDir = (ctx, from) => { const a = ctx.aim.clone(); if (a.y < 0.6) a.y = 0.9; return a.sub(from || ctx.f.center()).normalize(); };
  // flèche qui tombe du ciel sur p (visuel) puis appelle onHit(p)
  function arrowFall(ctx, p, delay, o) {
    o = o || {};
    ctx.later(delay, () => {
      const m = arrowMesh(o.color || ctx.color, o.scale || 1.5), from = p.clone().add(new V3(rnd(-4, 4), 24 + Math.random() * 6, rnd(-4, 4)));
      m.position.copy(from); m.lookAt(p);
      ctx.fx.add(m, o.t || 0.32, (k, ob) => { ob.position.lerpVectors(from, p, k * k); }, false, () => { if (o.onHit) o.onHit(p); });
    });
  }
  const bowAnim = (ctx, s) => { ctx.anim('2H_Ranged_Shoot', s || 2); };
  function puff(ctx, p, c, k) { ctx.fx.flash(p, { color: c, r: 1.2 * k, life: 0.22, intensity: 4 }); ctx.fx.ring(p.clone().setY(0.06), { r1: 2.2 * k, color: c, life: 0.3 }); ctx.fx.burst(p, { n: Math.round(16 * k), color: c, speed: 7 * k, life: 0.4 }); }
  function bolt(ctx, a, b, c) { ctx.fx.bolt(a, b, { color: c, life: 0.2, jitter: 1.2, segs: 12 }); ctx.fx.bolt(a, b, { color: 0xffffff, life: 0.1, jitter: 0.6, segs: 8, light: false }); }
  // un sort « visé » (centré sur un point) relancé au point d'impact d'une flèche : on prête au sort une visée fixe
  function atPoint(ctx, p) { const q = p.clone().setY(0); return Object.assign({}, ctx, { clampAim: () => q.clone(), anim: () => {}, act: () => {}, face: () => ctx.f.yaw, dirToAim: () => ctx.dirToAim() }); }

  /* =====================================================================
     VARIANTES PAR CLASSE  (v(ctx, orig) ; orig = la version d'origine)
     ===================================================================== */
  const V = { chevalier: {}, mage: {}, archer: {} };

  /* ---------- CHEVALIER ---------- */
  V.chevalier.traits = (ctx) => {
    const { f } = ctx, n = ctx.lv >= 3 ? 5 : 3, c = ctx.color;
    ctx.anim('1H_Melee_Attack_Slice_Horizontal', 2); ctx.act({ dur: 0.3, face: ctx.face() });
    for (let i = 0; i < n; i++) ctx.later(i * 0.08, () => {
      const from = f.center().add(new V3(0, 0.6, 0)), v = ctx.dirToAim().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.4).multiplyScalar(20).add(new V3(0, 4, 0));
      const m = SKsword(c, 1.6); ctx.sfx('swing', { rate: 1.3 + i * 0.1 });
      ctx.proj({ pos: from, vel: v, r: 0.55, dmg: ctx.dmg(95), life: 2.2, size: 0.8, homing: 7, mesh: m, onUpdate: p => { m.rotateZ(0.4); } });
    });
  };
  V.chevalier.chaine = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, n = ctx.lv >= 3 ? 7 : 4;
    ctx.anim('1H_Melee_Attack_Stab', 2); const A = ctx.act({ dur: 0.35, face: ctx.face(), vel: ctx.dirToAim().multiplyScalar(14) });
    void A;
    ctx.later(0.12, () => {
      let from = f.tip ? f.tip(0) : f.center(), seen = new Set(); let cur = ctx.nearest(f.pos.clone().addScaledVector(ctx.dirToAim(), 3), 6);
      for (let i = 0; i < n && cur; i++) {
        const tgt = cur, a = from.clone(); ctx.later(i * 0.07, () => { bolt(ctx, a, tgt.pos.clone(), c); puff(ctx, tgt.pos.clone(), c, 0.6); ctx.hitTarget(tgt, ctx.dmg(240) * (1 + (ctx.lv >= 5 ? 0.15 * i : 0)), { stun: ctx.lv >= 5 ? 0.3 : 0 }); ctx.sfx('zap', { g: 0.6, rate: 1 + i * 0.1 }); });
        seen.add(BR.Arena.groupKey(cur)); from = cur.pos.clone();
        cur = ctx.enemies().filter(e => !seen.has(BR.Arena.groupKey(e))).sort((x, y) => x.pos.distanceTo(from) - y.pos.distanceTo(from))[0];
        if (cur && cur.pos.distanceTo(from) > 12) cur = null;
      }
      for (let k = 0; k < 14; k++) fx.spark(f.tip ? f.tip(0) : f.center(), new V3(rnd(-4, 4), rnd(0, 4), rnd(-4, 4)), { color: c, life: 0.3, size: 0.3 });
    });
  };
  V.chevalier.lance = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, d = ctx.dirToAim(), p0 = f.pos.clone();
    ctx.anim('1H_Melee_Attack_Stab', 1.6); ctx.act({ dur: 0.45, face: ctx.face(), vel: d.clone().multiplyScalar(22), lockMove: true }); f.inv = Math.max(f.inv, 0.45); ctx.sfx('ice', { g: 0.8 });
    ctx.every(0.42, 0.06, i => { const q = f.pos.clone(); fx.burst(q.clone().setY(0.3), { n: 8, color: c, speed: 4, life: 0.5 }); const sp = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 5), new THREE.MeshStandardMaterial({ color: C(c), emissive: C(c), emissiveIntensity: 1.2, roughness: 0.2, flatShading: true, transparent: true })); sp.geometry.userData.own = true; sp.position.copy(q).add(new V3(rnd(-0.6, 0.6), 0.6, rnd(-0.6, 0.6))); sp.rotation.set(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3)); fx.add(sp, 1.6, (k, o) => { o.material.opacity = k > 0.7 ? (1 - k) / 0.3 : 1; o.scale.setScalar(Math.min(1, k * 8)); }); void i; });
    ctx.later(0.45, () => { ctx.hitLine(p0.clone().setY(1), f.pos.clone().setY(1), 1.8, ctx.dmg(340), { freeze: 1.2 }); if (ctx.lv >= 3) { puff(ctx, f.pos.clone().setY(0.6), c, 1.4); ctx.hitSphere(f.center(), 3.5, ctx.dmg(140), { freeze: 1 }); } });
  };
  V.chevalier.tornade = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, dur = 3, k = ctx.lv >= 3 ? 1.3 : 1;
    ctx.anim('2H_Melee_Attack_Spinning', 1.4); ctx.sfx('swingBig', { rate: 0.7 });
    const tw = new THREE.Mesh(new THREE.ConeGeometry(3.2 * k, 7, 24, 1, true), new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(1.4), transparent: true, opacity: 0.25, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); tw.geometry.userData.own = true; tw.rotation.x = Math.PI;
    fx.add(tw, dur, (kk, o, dt, t) => { o.position.copy(f.pos).setY(3.4); o.rotation.y += dt * 12; o.material.opacity = 0.25 * Math.min(1, t * 4, (dur - t) * 3); for (let j = 0; j < 3; j++) { const a = Math.random() * 6.283, r = 1 + Math.random() * 2.6 * k; fx.spark(f.pos.clone().add(new V3(Math.cos(a) * r, Math.random() * 5, Math.sin(a) * r)), new V3(-Math.sin(a) * 9, 2, Math.cos(a) * 9), { color: j ? c : 0xffffff, life: 0.35, size: 0.3 }); } if (Math.random() < dt * 6) f.play('2H_Melee_Attack_Spinning', 1.6, { fade: 0.05 }); });
    ctx.every(dur, 0.2, () => ctx.hitSphere(f.center(), 3.4 * k, ctx.dmg(55), { kb: -2 }));
    ctx.buff('haste', 1, dur);
  };
  V.chevalier.gravite = (ctx, orig) => { ctx.anim('2H_Melee_Attack_Chop', 1.5); ctx.sfx('swingBig', { rate: 0.6 }); ctx.later(0.25, () => orig(atPoint(ctx, ctx.clampAim(14)))); };
  V.chevalier.tempete = (ctx) => {
    // forme orageuse : vapeur noire, éclairs, vitesse ; les coups et les esquives sont gérés par asc-combat (f.buff.storm)
    const { f, fx } = ctx, c = ctx.color, dur = 6 + (ctx.lv >= 3 ? 2 : 0);
    ctx.anim('Spellcast_Raise', 1.6); ctx.sfx('charge', { len: 0.6 }); ctx.sfx('zap', { g: 1 });
    for (let j = 0; j < 4; j++) bolt(ctx, f.center().add(new V3(rnd(-2, 2), 16, rnd(-2, 2))), f.center(), c);
    fx.flash(f.center(), { color: c, r: 3, life: 0.4, intensity: 8 });
    ctx.buff('storm', 1, dur); ctx.buff('haste', 1, dur); f.stormLv = ctx.lv;
    ctx.every(dur, 0.05, () => {
      if (!f.alive) return;
      for (let j = 0; j < 2; j++) fx.spark(f.center().add(new V3(rnd(-0.7, 0.7), rnd(-0.9, 0.9), rnd(-0.7, 0.7))), new V3(rnd(-0.6, 0.6), rnd(0.4, 1.4), rnd(-0.6, 0.6)), { kind: 'smoke', color: 0x14121e, life: 0.7, size: 0.7, size1: 1.3, alpha: 0.85 });
      if (Math.random() < 0.35) { const a = f.center().add(new V3(rnd(-0.8, 0.8), rnd(-0.8, 0.9), rnd(-0.8, 0.8))); fx.bolt(a, a.clone().add(new V3(rnd(-0.9, 0.9), rnd(-0.9, 0.9), rnd(-0.9, 0.9))), { color: c, life: 0.08, light: false, segs: 4 }); }
    });
  };
  V.chevalier.u_rayon = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, d = ctx.dirToAim(), yaw = Math.atan2(d.x, d.z), p0 = f.pos.clone();
    ctx.anim('2H_Melee_Attack_Slice', 1.1); ctx.act({ dur: 0.7, face: yaw }); ctx.sfx('charge', { len: 0.5 });
    ctx.later(0.4, () => {
      ctx.sfx('swingBig', { rate: 0.4, g: 1.6 }); ctx.shake(0.9); ctx.hitstop(0.12);
      const L = 34;
      for (let s = 2; s <= L; s += 2) ctx.later(s * 0.012, () => { const q = p0.clone().addScaledVector(d, s).setY(1.2); fx.slash(q, yaw, { r: 4.5, arc: 2.2, tilt: Math.PI / 2, color: s % 4 ? c : 0xffffff, life: 0.3, world: false }); fx.burst(q.clone().setY(0.2), { n: 6, color: c, speed: 6, up: 1, life: 0.4 }); });
      ctx.hitLine(p0.clone().setY(1), p0.clone().addScaledVector(d, L).setY(1), 3.2, ctx.dmg(1600), { launch: 10, posture: 6 });
    });
  };
  V.chevalier.u_meteore = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, p = ctx.clampAim(22), p0 = f.pos.clone();
    ctx.anim('Jump_Start', 1.4); f.inv = Math.max(f.inv, 2.2); ctx.sfx('charge', { len: 1.2 });
    fx.decal(p, 'circle', { r: 8, color: c, dur: 1.4, hold: 0.2, world: false });
    ctx.act({ dur: 1.5, lockMove: true, float: true, update(t) { const k = Math.min(1, t / 1.5); if (k < 0.45) { f.pos.lerpVectors(p0, p0, 1); f.pos.y = (k / 0.45) * 30; } else { const u = (k - 0.45) / 0.55; f.pos.x = p0.x + (p.x - p0.x) * u; f.pos.z = p0.z + (p.z - p0.z) * u; f.pos.y = 30 * (1 - u * u); for (let j = 0; j < 4; j++) fx.spark(f.center(), new V3(rnd(-2, 2), 6, rnd(-2, 2)), { color: j % 2 ? c : 0xffcc66, life: 0.5, size: 1.1, size1: 0.1 }); } },
      onEnd() { f.pos.set(p.x, 0, p.z); f.vel.set(0, 0, 0); fx.flash(p.clone().setY(1), { color: c, r: 6, life: 0.5, intensity: 10 }); fx.ring(p, { r1: 16, color: 0xffd080, life: 0.9, width: 0.06 }); fx.burst(p.clone().setY(0.5), { n: 160, color: c, speed: 22, life: 1, size: 0.5 }); ctx.sfx('boom', { len: 2 }); ctx.shake(1.3); ctx.hitstop(0.16); ctx.hitSphere(p.clone().setY(1), 8, ctx.dmg(1500), { launch: 14, posture: 8 }); f.play('Lie_StandUp', 1.8); } });
  };

  /* ---------- MAGE ---------- */
  V.mage.fente = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, p0 = f.pos.clone(), p1 = ctx.clampAim(10);
    ctx.anim('Spellcast_Shoot', 2); f.inv = Math.max(f.inv, 0.4); ctx.sfx('magic', { rate: 1.6 });
    puff(ctx, p0.clone().setY(1), c, 1.2); ctx.hitSphere(p0.clone().setY(1), 3, ctx.dmg(120), {});
    f.pos.set(p1.x, f.pos.y, p1.z); ctx.confine();
    fx.bolt(p0.clone().setY(1), f.center(), { color: c, life: 0.25, jitter: 0.4 });
    ctx.later(0.05, () => { puff(ctx, f.center(), c, 1.4); ctx.hitSphere(f.center(), 3.4, ctx.dmg(160), { kb: 6 }); if (ctx.lv >= 5) f.cds = {}; });
  };
  V.mage.onde = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, R = ctx.lv >= 3 ? 8.4 : 6;
    ctx.anim('Spellcast_Raise', 2); ctx.act({ dur: 0.3 }); ctx.sfx('magic', { rate: 0.6, g: 1 });
    const n = ctx.lv >= 5 ? 3 : 1;
    for (let i = 0; i < n; i++) ctx.later(i * 0.35, () => { const p = f.pos.clone(); fx.ring(p.clone().setY(0.1), { r0: 0.5, r1: R, color: c, life: 0.4, width: 0.25 }); fx.ring(f.center(), { r0: 0.4, r1: R * 0.8, color: 0xffffff, life: 0.3, width: 0.12, tilt: Math.PI / 2 }); fx.flash(f.center(), { color: c, r: 2.4, life: 0.25, intensity: 6 }); fx.burst(f.center(), { n: 40, color: c, speed: 14, life: 0.45, flat: true }); ctx.shake(0.3); ctx.hitSphere(f.center(), R, ctx.dmg(220), { kb: 10, launch: 4, posture: 2 }); });
  };
  V.mage.tourbillon = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, n = 6, dur = ctx.lv >= 5 ? 4 : 3;
    ctx.anim('Spellcast_Raise', 1.6); ctx.sfx('magic', { rate: 1.2 });
    const orbs = [];
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(2.4) })); m.geometry.userData.own = true; orbs.push(m); fx.add(m, dur, (k, o, dt, t) => { const a = t * 5 + i / n * 6.283, r = 2.2 + Math.sin(t * 3) * 0.4; o.position.set(f.pos.x + Math.cos(a) * r, f.pos.y + 1.1 + Math.sin(t * 4 + i) * 0.4, f.pos.z + Math.sin(a) * r); if (Math.random() < dt * 20) fx.spark(o.position, new V3(), { color: c, life: 0.3, size: 0.35 }); }); }
    ctx.every(dur, 0.2, () => orbs.forEach(o => ctx.hitSphere(o.position, 1.1, ctx.dmg(40), {})));
  };
  V.mage.bond = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, p = ctx.clampAim(14);
    ctx.anim('Spellcast_Raise', 1.4); f.inv = Math.max(f.inv, 0.9); ctx.sfx('charge', { len: 0.7 });
    fx.decal(p, 'circle', { r: 5, color: c, dur: 0.75, world: false });
    const p0 = f.pos.clone();
    ctx.act({ dur: 0.8, lockMove: true, float: true, update(t) { const u = Math.min(1, t / 0.8); f.pos.x = p0.x + (p.x - p0.x) * u; f.pos.z = p0.z + (p.z - p0.z) * u; f.pos.y = Math.sin(u * Math.PI) * 5; fx.spark(f.center(), new V3(rnd(-1, 1), -2, rnd(-1, 1)), { color: c, life: 0.4, size: 0.4 }); },
      onEnd() { f.pos.y = 0; const q = f.pos.clone(); for (let i = 0; i < 6; i++) fx.bolt(q.clone().add(new V3(rnd(-3, 3), 14, rnd(-3, 3))), q.clone().add(new V3(rnd(-3, 3), 0, rnd(-3, 3))), { color: c, life: 0.2, light: i === 0 }); puff(ctx, q.clone().setY(0.6), c, 2.2); ctx.shake(0.5); ctx.hitSphere(q.clone().setY(1), 5, ctx.dmg(260), { launch: 6, posture: 3 }); } });
  };
  V.mage.dragon = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, dur = ctx.lv >= 3 ? 1.6 : 1.1;
    ctx.anim('Spellcast_Long', 1.2); ctx.sfx('fire', { g: 0.9 });
    const A = ctx.act({ dur, lockMove: false, face: ctx.face() });
    void A;
    ctx.every(dur, 0.05, () => { const d = ctx.dirToAim(), from = f.center().addScaledVector(d, 0.8); f.yaw = Math.atan2(d.x, d.z); for (let j = 0; j < 4; j++) fx.spark(from, d.clone().multiplyScalar(18 + Math.random() * 8).add(new V3(rnd(-3, 3), rnd(-1, 2), rnd(-3, 3))), { color: j % 2 ? c : 0xffd060, life: 0.45, size: 0.9, size1: 2.2, drag: 1.5 }); });
    ctx.every(dur, 0.15, () => ctx.hitCone(f.pos, f.yaw, 9, 0.9, ctx.dmg(90), { kind: 'skill' }));
  };
  V.mage.pluie = (ctx) => {
    const { fx } = ctx, c = ctx.color, center = ctx.clampAim(18), n = ctx.lv >= 3 ? 24 : 14;
    ctx.anim('Spellcast_Raise', 1.6); ctx.act({ dur: 0.4, face: ctx.face() }); ctx.sfx('magic', { rate: 0.7 });
    fx.decal(center, 'circle', { r: 4.5, color: c, dur: 0.5, hold: 1.4, world: false });
    for (let i = 0; i < n; i++) ctx.later(0.3 + i * (1.2 / n), () => {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 4.2, p = center.clone().add(new V3(Math.cos(a) * r, 0, Math.sin(a) * r)), from = p.clone().add(new V3(-3, 18, -2));
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(2.5) })); st.geometry.userData.own = true;
      fx.add(st, 0.3, (k, o) => { o.position.lerpVectors(from, p, k * k); o.rotation.x += 0.4; fx.spark(o.position, new V3(), { color: c, life: 0.25, size: 0.5 }); }, false, () => { puff(ctx, p.clone().setY(0.3), c, 0.7); ctx.hitSphere(p.clone().setY(1), 1.9, ctx.dmg(55), {}); });
    });
  };
  V.mage.tempete = (ctx, orig) => {
    const { fx } = ctx, center = ctx.clampAim(18);
    // le nuage d'orage : boules de vapeur noire qui tourbillonnent au-dessus de la zone
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x14141e, roughness: 1, transparent: true, opacity: 0.85, flatShading: true })); m.geometry.userData.own = true; const a = i / 14 * 6.283, r = 2 + Math.random() * 4; const base = center.clone().add(new V3(Math.cos(a) * r, 13 + Math.random() * 1.5, Math.sin(a) * r)); m.scale.set(2 + Math.random() * 1.5, 1 + Math.random() * 0.6, 2 + Math.random() * 1.5);
      fx.add(m, 4, (k, o, dt, t) => { o.position.set(base.x + Math.sin(t * 0.7 + i) * 0.8, base.y + Math.sin(t * 1.3 + i) * 0.3, base.z + Math.cos(t * 0.7 + i) * 0.8); o.material.opacity = 0.85 * Math.min(1, t * 2, (4 - t) * 2); }); }
    orig(ctx);
  };
  V.mage.u_lames = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, tg = ctx.lockTarget(), n = 18;
    ctx.anim('Spellcast_Raise', 1.2); ctx.act({ dur: 0.6, face: ctx.face() }); ctx.sfx('charge', { len: 0.8 });
    const tp = tg ? tg.pos.clone() : ctx.clampAim(20).setY(1);
    for (let i = 0; i < n; i++) ctx.later(0.3 + i * 0.07, () => {
      const a = i / n * 6.283 * 2, from = tp.clone().add(new V3(Math.cos(a) * 12, 4 + Math.random() * 6, Math.sin(a) * 12));
      ctx.proj({ pos: from, vel: tp.clone().sub(from).normalize().multiplyScalar(34), r: 0.6, dmg: ctx.dmg(120), life: 1.2, size: 1.1, homing: 8, explode: i % 3 === 0 ? 2.5 : 0 });
      fx.flash(from, { color: c, r: 0.8, life: 0.15, light: false });
    });
  };
  V.mage.fantomes = null;   // version d'origine (lames de lumière en orbite)

  /* ---------- ARCHER ---------- */
  V.archer.fente = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, d = ctx.dirToAim(), side = new V3(d.z, 0, -d.x).multiplyScalar(ctx.f.ctl && ctx.f.ctl.move && ctx.f.ctl.move.dot(new V3(d.z, 0, -d.x)) < 0 ? -1 : 1);
    ctx.anim('Dodge_Left', 1.6); f.inv = Math.max(f.inv, 0.45); ctx.act({ dur: 0.35, vel: side.clone().multiplyScalar(20).addScaledVector(d, -4), lockMove: true, face: Math.atan2(d.x, d.z) });
    ctx.sfx('dash');
    const n = ctx.lv >= 3 ? 5 : 3;
    for (let i = 0; i < n; i++) ctx.later(0.06 + i * 0.07, () => { const tg = ctx.enemies().sort((x, y) => x.pos.distanceTo(f.pos) - y.pos.distanceTo(f.pos))[i % Math.max(1, ctx.enemies().length)]; const from = f.center(); const dir = tg ? tg.pos.clone().sub(from).normalize() : d; bowAnim(ctx, 3); ctx.sfx('swing', { rate: 2 }); shoot(ctx, dir, { dmg: ctx.dmg(120), speed: 60, homing: 3 }); });
    void fx;
  };
  V.archer.onde = (ctx) => {
    const { fx } = ctx, c = ctx.color, p = ctx.clampAim(20), R = ctx.lv >= 3 ? 8.4 : 6;
    bowAnim(ctx, 1.6); ctx.act({ dur: 0.35, face: ctx.face() }); ctx.sfx('swing', { rate: 0.8 });
    const from = ctx.f.center(), dist = from.distanceTo(p.clone().setY(0)), t = dist / 45;
    shoot(ctx, p.clone().setY(0).sub(from).normalize(), { dmg: 0, speed: 45, r: 0.01, life: t, scale: 1.6 });
    ctx.later(t, () => { const n = ctx.lv >= 5 ? 3 : 1; for (let i = 0; i < n; i++) ctx.later(i * 0.3, () => { fx.ring(p.clone().setY(0.1), { r0: 0.4, r1: R, color: c, life: 0.4, width: 0.3 }); fx.burst(p.clone().setY(0.3), { n: 40, color: 0x8a7a6a, kind: 'smoke', speed: 10, up: 0.6, life: 0.8, size: 0.8 }); puff(ctx, p.clone().setY(0.5), c, 1.5); ctx.shake(0.4); ctx.hitSphere(p.clone().setY(1), R, ctx.dmg(220), { launch: 7, posture: 3 }); }); });
  };
  V.archer.tourbillon = (ctx) => {
    const { f } = ctx, n = ctx.lv >= 3 ? 20 : 12;
    ctx.sfx('swingBig', { rate: 1.4 }); f.play('2H_Ranged_Shooting', 2.2);
    for (let i = 0; i < n; i++) ctx.later(i * (0.9 / n), () => { const a = f.yaw + i / n * 6.283 * 1.5, dir = new V3(Math.sin(a), 0.02, Math.cos(a)); f.yaw = a; shoot(ctx, dir, { dmg: ctx.dmg(80), speed: 48, explode: ctx.lv >= 5 ? 2.4 : 0 }); });
    ctx.act({ dur: 0.95, lockMove: false });
  };
  V.archer.traits = (ctx) => {
    const n = ctx.lv >= 3 ? 5 : 3;
    bowAnim(ctx, 2.2); ctx.act({ dur: 0.3, face: ctx.face() });
    for (let i = 0; i < n; i++) ctx.later(i * 0.07, () => { const v = aimDir(ctx).applyAxisAngle(UP, (i - (n - 1) / 2) * 0.35).add(new V3(0, 0.25, 0)); ctx.sfx('swing', { rate: 1.8 + i * 0.1 }); shoot(ctx, v, { dmg: ctx.dmg(95), speed: 30, homing: 7, life: 2.2, onHit: () => { if (ctx.lv >= 5) ctx.f.energy = Math.min(100, ctx.f.energy + 3); } }); });
  };
  V.archer.bond = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, d = ctx.dirToAim(), p0 = f.pos.clone(), target = ctx.clampAim(20);
    f.inv = Math.max(f.inv, 0.8); ctx.sfx('jump', { g: 1.2 }); f.play('Jump_Idle', 1);
    ctx.act({ dur: 0.75, lockMove: true, float: true, update(t) { const u = Math.min(1, t / 0.75); f.pos.x = p0.x - d.x * 8 * u; f.pos.z = p0.z - d.z * 8 * u; f.pos.y = Math.sin(u * Math.PI) * 5; f.yaw = Math.atan2(d.x, d.z); }, onEnd() { f.pos.y = 0; ctx.confine(); } });
    const n = ctx.lv >= 3 ? 8 : 5;
    for (let i = 0; i < n; i++) ctx.later(0.25 + i * 0.05, () => { const p = target.clone().add(new V3(rnd(-2.5, 2.5), 0, rnd(-2.5, 2.5))); const from = f.center(); bowAnim(ctx, 3); shoot(ctx, p.sub(from).normalize(), { dmg: ctx.dmg(110), speed: 46, explode: 2.6 }); });
    void fx; void c;
  };
  V.archer.chaine = (ctx) => {
    const c = ctx.color, n = ctx.lv >= 3 ? 7 : 4;
    bowAnim(ctx, 2); ctx.act({ dur: 0.3, face: ctx.face() }); ctx.sfx('zap', { g: 0.5, rate: 1.4 });
    shoot(ctx, aimDir(ctx), { dmg: ctx.dmg(200), speed: 60, color: c, homing: 2, onHit: (p, t) => {
      const seen = new Set([BR.Arena.groupKey(t)]); let from = t.pos.clone();
      for (let i = 0; i < n; i++) {
        const nx = ctx.enemies().filter(e => !seen.has(BR.Arena.groupKey(e))).sort((x, y) => x.pos.distanceTo(from) - y.pos.distanceTo(from))[0];
        if (!nx || nx.pos.distanceTo(from) > 12) break; seen.add(BR.Arena.groupKey(nx)); const a = from.clone(), b = nx.pos.clone();
        ctx.later(i * 0.07, () => { bolt(ctx, a, b, c); ctx.hitTarget(nx, ctx.dmg(170) * (1 + (ctx.lv >= 5 ? 0.15 * i : 0)), { stun: ctx.lv >= 5 ? 0.3 : 0 }); });
        from = b;
      }
      bolt(ctx, t.pos.clone().add(new V3(0, 10, 0)), t.pos.clone(), c);
    } });
  };
  V.archer.lance = (ctx) => {
    const c = ctx.color, n = ctx.lv >= 5 ? 3 : 1;
    bowAnim(ctx, 1.6); ctx.act({ dur: 0.35, face: ctx.face() }); ctx.sfx('ice', { g: 0.8 });
    for (let i = 0; i < n; i++) shoot(ctx, aimDir(ctx).applyAxisAngle(UP, (i - (n - 1) / 2) * 0.25), { dmg: ctx.dmg(340), speed: 55, pierce: 6, freeze: 1, scale: 1.4, r: 0.6, onHit: (p) => { if (ctx.lv >= 3) { puff(ctx, p.pos.clone(), c, 0.9); ctx.hitSphere(p.pos.clone(), 2.6, ctx.dmg(120), { freeze: 0.8 }); } } });
  };
  V.archer.tornade = (ctx) => {
    const { fx } = ctx, c = ctx.color, p = ctx.clampAim(20), n = ctx.lv >= 5 ? 2 : 1;
    bowAnim(ctx, 1.8); ctx.act({ dur: 0.3, face: ctx.face() }); ctx.sfx('swing', { rate: 0.9 });
    const from = ctx.f.center(), t = from.distanceTo(p) / 40;
    shoot(ctx, p.clone().setY(0.2).sub(from).normalize(), { dmg: 0, r: 0.01, speed: 40, life: t });
    for (let j = 0; j < n; j++) ctx.later(t + j * 0.4, () => {
      const q = p.clone().add(new V3(j ? 3 : 0, 0, 0)), dur = 4;
      const tw = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 24, 1, true), new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(1.3), transparent: true, opacity: 0.3, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); tw.geometry.userData.own = true; tw.rotation.x = Math.PI;
      const tgt = ctx.lv >= 3 ? ctx.nearest(q, 20) : null;
      fx.add(tw, dur, (k, o, dt, tt) => { if (tgt && tgt.pos) { q.x += (tgt.pos.x - q.x) * dt * 0.6; q.z += (tgt.pos.z - q.z) * dt * 0.6; } o.position.copy(q).setY(4); o.rotation.y += dt * 10; o.material.opacity = 0.3 * Math.min(1, tt * 4, (dur - tt) * 3); for (let s = 0; s < 3; s++) { const a = Math.random() * 6.283, r = Math.random() * 2.5; fx.spark(q.clone().add(new V3(Math.cos(a) * r, Math.random() * 7, Math.sin(a) * r)), new V3(-Math.sin(a) * 8, 2, Math.cos(a) * 8), { color: c, life: 0.4, size: 0.35 }); } });
      ctx.every(dur, 0.33, () => ctx.hitSphere(q.clone().setY(1.5), 3, ctx.dmg(60), { kb: -4 }));
    });
  };
  V.archer.pluie = (ctx) => {
    const { fx } = ctx, c = ctx.color, center = ctx.clampAim(20), n = ctx.lv >= 3 ? 36 : 22;
    bowAnim(ctx, 1.6); ctx.act({ dur: 0.4, face: ctx.face() }); ctx.sfx('swing', { rate: 0.7 });
    for (let k = 0; k < 6; k++) shoot(ctx, new V3(rnd(-0.1, 0.1), 1, rnd(-0.1, 0.1)), { dmg: 0, r: 0.01, speed: 40, life: 0.6 });
    fx.decal(center, 'circle', { r: 5, color: c, dur: 0.6, hold: 1.6, world: false });
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 4.8, p = center.clone().add(new V3(Math.cos(a) * r, 0, Math.sin(a) * r)); arrowFall(ctx, p, 0.55 + i * (1.4 / n), { onHit: q => { fx.burst(q.clone().setY(0.2), { n: 6, color: c, speed: 5, up: 0.6, life: 0.3 }); ctx.hitSphere(q.clone().setY(1), 1.7, ctx.dmg(55), {}); if (ctx.lv >= 5 && Math.random() < 0.3) ctx.later(0.6, () => { puff(ctx, q.clone().setY(0.4), c, 0.8); ctx.hitSphere(q.clone().setY(1), 2.2, ctx.dmg(50), {}); }); } }); }
  };
  V.archer.fantomes = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, n = ctx.lv >= 3 ? 10 : 6, dur = 8;
    ctx.anim('Spellcast_Raise', 1.6); ctx.sfx('magic', { rate: 1.4 });
    const arrows = [];
    for (let i = 0; i < n; i++) { const m = arrowMesh(c, 1.2); arrows.push({ m, alive: true }); fx.add(m, dur, (k, o, dt, t) => { if (!arrows[i].alive) { o.visible = false; return; } const a = t * 2.5 + i / n * 6.283; o.position.set(f.pos.x + Math.cos(a) * 1.6, f.pos.y + 1.6 + Math.sin(t * 3 + i) * 0.2, f.pos.z + Math.sin(a) * 1.6); o.lookAt(o.position.clone().add(new V3(-Math.sin(a), 0, Math.cos(a)))); }); }
    let next = 0.5;
    ctx.every(dur, 0.1, () => { next -= 0.1; if (next > 0) return; const tg = ctx.nearest(f.pos, 22); const a = arrows.find(x => x.alive); if (!tg || !a) return; next = 0.55; a.alive = false; shoot(ctx, tg.pos.clone().sub(a.m.position).normalize(), { from: a.m.position.clone(), dmg: ctx.dmg(85) * (ctx.lv >= 5 ? 1.6 : 1), speed: 40, homing: 8, scale: 1.2 }); });
  };
  V.archer.gravite = (ctx, orig) => {
    const p = ctx.clampAim(14), from = ctx.f.center(), t = from.distanceTo(p) / 42;
    bowAnim(ctx, 1.6); ctx.act({ dur: 0.3, face: ctx.face() }); ctx.sfx('swing', { rate: 0.7 });
    shoot(ctx, p.clone().setY(1.6).sub(from).normalize(), { dmg: 0, r: 0.01, speed: 42, life: t, color: ctx.color, scale: 1.4 });
    ctx.later(t, () => orig(atPoint(ctx, p)));
  };
  V.archer.dragon = (ctx) => {
    const { fx } = ctx, c = ctx.color, d = aimDir(ctx);
    bowAnim(ctx, 1.2); ctx.act({ dur: 0.45, face: ctx.face() }); ctx.sfx('fire', { g: 1 });
    ctx.later(0.15, () => {
      const passes = ctx.lv >= 5 ? 2 : 1;
      for (let i = 0; i < passes; i++) ctx.later(i * 0.5, () => shoot(ctx, d, { dmg: ctx.dmg(520), speed: 34, pierce: 8, r: 1.2, scale: 3, launch: 6, life: 1.4, color: c, onUpdate: p => { for (let j = 0; j < 4; j++) fx.spark(p.pos, new V3(rnd(-2, 2), rnd(0, 3), rnd(-2, 2)), { color: j % 2 ? c : 0xffd060, life: 0.5, size: 1, size1: 0.2 }); if (ctx.lv >= 3 && Math.random() < 0.3) ctx.zone({ pos: p.pos.clone().setY(0), life: 2, iv: 0.5, onTick: z => { ctx.hitSphere(z.pos.clone().setY(0.6), 1.6, ctx.dmg(30), {}); fx.spark(z.pos.clone().add(new V3(rnd(-1, 1), 0.2, rnd(-1, 1))), new V3(0, 3, 0), { color: c, life: 0.5, size: 0.6 }); } }); } }));
    });
  };
  V.archer.tempete = (ctx) => {
    const { fx } = ctx, c = ctx.color, center = ctx.clampAim(18), n = ctx.lv >= 3 ? 26 : 16;
    bowAnim(ctx, 1.4); ctx.act({ dur: 0.45, face: ctx.face() }); ctx.sfx('charge', { len: 0.5 });
    for (let k = 0; k < 4; k++) shoot(ctx, new V3(rnd(-0.1, 0.1), 1, rnd(-0.1, 0.1)), { dmg: 0, r: 0.01, speed: 46, life: 0.5, color: c });
    fx.decal(center, 'circle', { r: 6.5, color: c, dur: 0.6, hold: 3, world: false });
    for (let i = 0; i < n; i++) {
      const tg = Math.random() < 0.55 ? ctx.nearest(center, 8) : null;
      const p = tg ? tg.pos.clone().setY(0).add(new V3(rnd(-1, 1), 0, rnd(-1, 1))) : center.clone().add(new V3(rnd(-6, 6), 0, rnd(-6, 6)));
      arrowFall(ctx, p, 0.6 + i * (3 / n), { color: c, scale: 1.8, onHit: q => { bolt(ctx, q.clone().add(new V3(rnd(-1, 1), 12, rnd(-1, 1))), q, c); fx.ring(q, { r1: 2.4, color: c, life: 0.3 }); ctx.sfx('zap', { g: 0.4 }); ctx.hitSphere(q.clone().setY(1), 2.4, ctx.dmg(120), { stun: 0.1 }); } });
    }
    if (ctx.lv >= 5) arrowFall(ctx, center.clone(), 3.8, { color: c, scale: 6, t: 0.5, onHit: q => { for (let j = 0; j < 4; j++) bolt(ctx, q.clone().add(new V3(rnd(-1, 1), 30, rnd(-1, 1))), q, c); puff(ctx, q.clone().setY(0.5), c, 3); ctx.shake(0.8); ctx.hitSphere(q.clone().setY(1), 6, ctx.dmg(480), { stun: 1, posture: 4 }); } });
  };
  V.archer.u_lame = (ctx) => {
    const { fx } = ctx, c = ctx.color, center = ctx.clampAim(22);
    bowAnim(ctx, 1.2); ctx.act({ dur: 0.6, face: ctx.face() }); ctx.sfx('charge', { len: 0.8 });
    shoot(ctx, new V3(0, 1, 0), { dmg: 0, r: 0.01, speed: 60, life: 0.5, scale: 2, color: c });
    fx.decal(center, 'circle', { r: 7, color: c, dur: 1.0, hold: 0.2, world: false });
    fx.pillar(center, { color: c, r: 0.6, h: 60, life: 1, grow: 2, alpha: 0.6 });
    arrowFall(ctx, center.clone(), 0.5, { color: c, scale: 9, t: 0.5, onHit: q => { fx.flash(q.clone().setY(1), { color: c, r: 6, life: 0.5, intensity: 10 }); fx.ring(q, { r1: 14, color: 0xffffff, life: 0.8, width: 0.08 }); fx.burst(q.clone().setY(0.5), { n: 150, color: c, speed: 22, life: 1, size: 0.5 }); ctx.sfx('boom', { len: 2 }); ctx.shake(1.1); ctx.hitstop(0.18); ctx.hitSphere(q.clone().setY(1), 7, ctx.dmg(1800), { launch: 12, posture: 6, stun: ctx.lv >= 3 ? 2 : 0 }); } });
  };
  V.archer.u_lames = (ctx) => {
    const { f, fx } = ctx, c = ctx.color, tg = ctx.lockTarget() || ctx.nearest(f.pos, 30);
    if (!tg) return;
    f.inv = Math.max(f.inv, 2.4); ctx.sfx('charge', { len: 0.4 });
    for (let s = 0; s < 6; s++) ctx.later(0.15 + s * 0.35, () => {
      const a = s / 6 * 6.283 + Math.random(), r = (tg.r || 1) + 6, p = tg.pos.clone().add(new V3(Math.cos(a) * r, 0, Math.sin(a) * r)); p.y = 0;
      fx.burst(f.center(), { n: 20, color: c, speed: 6, life: 0.3 }); f.pos.copy(p); ctx.confine(); fx.flash(f.center(), { color: c, r: 1.4, life: 0.2 });
      f.yaw = Math.atan2(tg.pos.x - f.pos.x, tg.pos.z - f.pos.z); bowAnim(ctx, 3); ctx.sfx('dash', { rate: 1.4 });
      for (let k = 0; k < 4; k++) ctx.later(k * 0.05, () => shoot(ctx, tg.pos.clone().sub(f.center()).normalize().applyAxisAngle(UP, (k - 1.5) * 0.05), { dmg: ctx.dmg(130), speed: 70, homing: 6, crit: k === 3 }));
    });
  };
  V.archer.u_meteore = (ctx, orig) => {
    bowAnim(ctx, 1.2); ctx.act({ dur: 0.5, face: ctx.face() }); ctx.sfx('fire', { g: 0.8 });
    shoot(ctx, new V3(0.1, 1, 0.05), { dmg: 0, r: 0.01, speed: 70, life: 0.6, scale: 2.4, color: ctx.color });
    const p = ctx.clampAim(24);
    ctx.later(0.3, () => orig(atPoint(ctx, p)));
  };
  V.archer.u_rayon = (ctx, orig) => { orig(ctx); ctx.anim('2H_Ranged_Aiming', 1); };

  /* ---------------- aiguillage : chaque sort joue la version de la classe du lanceur ---------------- */
  // épée spectrale de skills.js (non exportée) : copie simple
  function SKsword(color, len) {
    const g = new THREE.Group(), c = C(color);
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: c, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.6 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09 * len, 0.02 * len, 0.8 * len), m); blade.position.z = 0.25 * len; blade.geometry.userData.own = true;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3 * len, 0.04 * len, 0.05 * len), m); guard.position.z = -0.17 * len; guard.geometry.userData.own = true;
    g.add(blade, guard); return g;
  }
  Object.keys(SK).forEach(id => {
    if (id[0] === '_') return;
    const orig = SK[id].cast;
    SK[id].cast = function (ctx) {
      const cls = Q.classOf(ctx.f), v = cls && V[cls] && V[cls][id];
      if (v) { try { return v(ctx, orig); } catch (e) { console.error('variante', cls, id, e); } }
      return orig(ctx);
    };
  });
  Q.hasVariant = (id, cls) => !!(V[cls] && V[cls][id]);
  /* ---------------- API pour les fichiers de classe (js/arena/cls-chevalier.js, cls-mage.js, cls-archer.js) ----------------
     Q.variant(cls, id, fn)        : fn(ctx, orig) remplace le sort id pour cette classe (orig = version de base de skills.js)
     Q.setName(cls, id, nom, desc) : nom + description affichés en jeu pour cette classe
     Q.FXH / BR.ASkills._H         : petits outils visuels partagés */
  Q.VARIANTS = V; Q.CLASS_NAMES = NAMES; Q.CLASS_AW = Q.CLASS_AW || {};
  // texte d'éveil (niveau 3 ou 5) propre à la classe, sinon celui de la version de base
  Q.awText = (id, cls, lv) => { const k = lv === 3 ? 0 : 1, c = Q.CLASS_AW[cls] && Q.CLASS_AW[cls][id]; return (c && c[k]) || ((AR.skill(id) || {}).aw || [])[k] || ''; };
  Q.variant = (cls, id, fn) => { V[cls][id] = fn; };
  Q.setName = (cls, id, n, d) => { (NAMES[cls] = NAMES[cls] || {})[id] = [n, d]; };
  Q.FXH = { arrowMesh, disposeArrow, shoot, aimDir, arrowFall, bowAnim, puff, bolt, atPoint, SKsword };
})();

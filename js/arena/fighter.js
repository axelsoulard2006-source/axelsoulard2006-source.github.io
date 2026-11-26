/* ===== arena/fighter.js : combattant (joueur local, distant, IA de duel, double spectral) =====
   Personnage KayKit animé + armes du style choisi (prises dans les modèles KayKit) + traînées lumineuses. */
(function () {
  const BR = window.BR, V3 = THREE.Vector3;

  // copie d'une arme depuis un modèle KayKit (nœud enfant d'un « handslot »)
  const weaponCache = {};
  function weaponProto(model, node) {
    const k = model + '/' + node;
    if (weaponCache[k] !== undefined) return weaponCache[k];
    const g = BR.Assets && BR.Assets.models[model]; let found = null;
    if (g) g.scene.traverse(o => { if (!found && o.name === node) found = o; });
    if (!found) return (weaponCache[k] = null);
    // extrémités de l'arme (axe le plus long) dans son repère local
    const tmp = found.clone(true); tmp.position.set(0, 0, 0); tmp.quaternion.identity(); tmp.scale.set(1, 1, 1); tmp.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(tmp), size = box.getSize(new V3()), c = box.getCenter(new V3());
    const ax = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
    // la pointe est le bout le plus éloigné de l'origine (la poignée est près de la main)
    const a = c.clone(), b = c.clone(); a[ax] = box.min[ax]; b[ax] = box.max[ax];
    const tip = a.length() > b.length() ? a : b, base = c.clone().lerp(tip, -0.15);
    return (weaponCache[k] = { node: found, tip, base, len: size[ax] });
  }

  BR.AFighter = function (S, o) {
    const av = BR.Avatar.build(o.look || { skin: 'survivor' });
    const f = {
      id: o.id, name: o.name || '?', kind: o.kind || 'remote', team: o.team || 'A', av, group: av.group,
      pos: av.group.position, vel: new V3(), yaw: 0, hp: o.hp || 1000, maxHp: o.hp || 1000, energy: 100, ult: 0,
      alive: true, down: false, inv: 0, stun: 0, slow: 0, shield: 0, guard: false, air: false, weaponId: null, weapon: null,
      buff: {}, cds: {}, stats: { dmg: 0, hits: 0, parries: 0, perfect: 0, deaths: 0, skills: {} },
      weapons: [], trails: [], dashT: 0, action: null, lastAnim: '',
    };
    if (o.pos) f.pos.copy(o.pos);
    S.scene.add(av.group);
    av.weapon([]);
    av.group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });

    f.setWeapon = function (id) {
      if (f.weaponId === id) return;
      f.weapons.forEach(w => { if (w.obj.parent) w.obj.parent.remove(w.obj); });
      f.trails.forEach(t => t.dispose()); f.weapons = []; f.trails = [];
      const def = BR.ARENA.WEAPONS[id] || BR.ARENA.WEAPONS.blade; f.weaponId = id; f.weapon = def;
      for (const [model, node, hand] of def.models) {
        const P = weaponProto(model, node); if (!P) continue;
        const parent = hand === 'L' ? av.handL : av.handR; if (!parent) continue;
        const obj = P.node.clone(true); obj.visible = true; obj.traverse(m => { if (m.isMesh) m.castShadow = true; });
        parent.add(obj);
        const w = { obj, P, hand };
        if (!/shield/i.test(node)) { w.trail = S.fx.trail(def.color); f.trails.push(w.trail); }
        f.weapons.push(w);
      }
      // bâton : cristal lumineux au bout
      if (id === 'staff' && f.weapons[0]) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(def.color).multiplyScalar(2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
        s.scale.setScalar(0.6 / 0.78); s.position.copy(f.weapons[0].P.tip); f.weapons[0].obj.add(s); f.weapons[0].orb = s;
      }
      if (o.ghost) ghostify();
    };
    const _a = new V3(), _b = new V3();
    f.tip = function (i) { const w = f.weapons[i || 0]; if (!w) return f.center(); return w.obj.localToWorld(_a.copy(w.P.tip)).clone(); };
    f.center = () => new V3(f.pos.x, f.pos.y + 1.05, f.pos.z);
    f.fwd = () => new V3(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    f.play = function (name, speed, opt) { f.lastAnim = name; return av.act(name, Object.assign({ speed: speed || 1 }, opt || {})); };
    f.attacking = () => !!(av.oneShot && /Attack|Spin|Stab|Slice|Chop|Kick|Punch|Spellcast|Block_Attack|Ranged/.test(av.oneShot.name));

    // double spectral / invocations : silhouette lumineuse translucide
    function ghostify() {
      const col = new THREE.Color(o.ghost).multiplyScalar(1.4);
      av.group.traverse(m => {
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (mats.some(x => x && (x.isShaderMaterial || x.uniforms))) return;   // aura (shaders animés) : on la laisse telle quelle
        const nm = mats.map(x => { const g = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, skinning: !!m.isSkinnedMesh }); g.userData.own = true; return g; });
        m.material = Array.isArray(m.material) ? nm : nm[0]; m.castShadow = false;
      });
      if (av.skinfx) av.skinfx.ghost();   // skins mythiques : pas d'effets (sol, échos, particules) sur les doubles
    }
    if (o.ghost && !o.weapon) ghostify();
    if (o.weapon) f.setWeapon(o.weapon);

    // mouvement secondaire du corps : l'orientation affichée suit la logique par un ressort (aucun à-coup visible),
    // le corps se penche dans les virages et vers l'avant à l'accélération, et s'écrase un peu à l'atterrissage
    const lean = { yaw: null, yv: 0, bank: 0, pitch: 0, pv: new V3(), squash: 0, sqv: 0, wasAir: false };
    av.group.rotation.order = 'YXZ';
    f.update = function (dt, st) {
      st = st || {};
      const sp = st.speed != null ? st.speed : Math.hypot(f.vel.x, f.vel.z);
      if (lean.yaw == null) lean.yaw = f.yaw;
      if (dt > 0) {
        const w = 22, n = Math.max(1, Math.ceil(dt * w / 0.25)), h = dt / n;
        for (let i = 0; i < n; i++) { const e = BR.angDiff(lean.yaw, f.yaw); if (Math.abs(e) > 2.6) { lean.yaw = f.yaw - Math.sign(e) * 2.6; } lean.yv += (w * w * BR.angDiff(lean.yaw, f.yaw) - 2 * w * lean.yv) * h; lean.yaw += lean.yv * h; }
        const ax = (f.vel.x - lean.pv.x) / dt, az = (f.vel.z - lean.pv.z) / dt; lean.pv.set(f.vel.x, 0, f.vel.z);
        const fwdA = ax * Math.sin(lean.yaw) + az * Math.cos(lean.yaw);
        const air = f.pos.y > 0.05, spinning = !!f.spin;
        const wantBank = spinning || air ? 0 : BR.clamp(-lean.yv * 0.045 * Math.min(1, sp / 6), -0.28, 0.28);
        const wantPitch = spinning ? 0 : BR.clamp(fwdA * 0.006, -0.12, 0.16) + (sp > 7 && !air ? 0.06 : 0);
        lean.bank += (wantBank - lean.bank) * Math.min(1, dt * 10); lean.pitch += (wantPitch - lean.pitch) * Math.min(1, dt * 8);
        if (lean.wasAir && !air && f.vel.y <= 0) lean.sqv -= 2.2;            // atterrissage : écrasement puis rebond
        lean.wasAir = air;
        lean.sqv += (-170 * lean.squash - 16 * lean.sqv) * dt; lean.squash += lean.sqv * dt;
      }
      av.group.rotation.set(lean.pitch, lean.yaw, lean.bank);
      const sq = BR.clamp(lean.squash, -0.18, 0.12), zm = f.sizeMul || 1; av.group.scale.set((1 - sq * 0.5) * zm, (1 + sq) * zm, (1 - sq * 0.5) * zm);
      av.update(dt, sp, { air: st.air, sprint: sp > 8.5, down: f.down, back: st.back, boost: st.boost || 0 });
      if (av.head && (f.headMul || av.head.userData.big)) { av.head.userData.big = 1; av.head.scale.setScalar(f.headMul || 1); }
      const on = f.attacking() || f.dashT > 0 || !!st.trail;
      for (const w of f.weapons) {
        if (!w.trail) continue;
        w.obj.localToWorld(_a.copy(w.P.base)); w.obj.localToWorld(_b.copy(w.P.tip));
        w.trail.push(_a, _b, on, dt);
      }
    };
    /* couleur d'équipe (mode Duel en équipes) : anneau lumineux au sol + nom écrit dans la couleur de l'équipe au-dessus de la tête */
    let teamRing = null, teamTag = null;
    f.setTeamColor = function (hex, showName) {
      const col = new THREE.Color(hex);
      if (!teamRing) {
        const g = new THREE.RingGeometry(0.62, 0.8, 40); g.rotateX(-Math.PI / 2);
        teamRing = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
        teamRing.renderOrder = 4; S.scene.add(teamRing);
      } else teamRing.material.color.copy(col).multiplyScalar(1.6);
      if (showName && f.kind !== 'local') {
        const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g2 = c.getContext('2d');
        g2.font = "bold 34px 'Segoe UI', Arial"; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineWidth = 7; g2.strokeStyle = 'rgba(0,0,0,0.85)';
        const nm = String(f.name).slice(0, 14); g2.strokeText(nm, 128, 34); g2.fillStyle = hex; g2.fillText(nm, 128, 34);
        if (teamTag) { teamTag.material.map.dispose(); teamTag.material.dispose(); av.group.remove(teamTag); }
        const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding;
        teamTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
        teamTag.scale.set(1.9, 0.48, 1); teamTag.position.y = 2.35; teamTag.renderOrder = 9; av.group.add(teamTag);
      }
    };
    const baseUpdate = f.update;
    f.update = function (dt, st) {
      baseUpdate(dt, st);
      if (teamRing) { teamRing.position.set(f.pos.x, 0.05, f.pos.z); teamRing.visible = f.alive; teamRing.material.opacity = 0.65 + Math.sin(performance.now() / 260) * 0.2; }
      if (teamTag) teamTag.visible = f.alive;
    };
    f.dispose = function () {
      f.trails.forEach(t => t.dispose());
      if (teamRing) { S.scene.remove(teamRing); teamRing.geometry.dispose(); teamRing.material.dispose(); }
      if (teamTag) { teamTag.material.map.dispose(); teamTag.material.dispose(); }
      S.scene.remove(av.group); av.dispose();
    };
    return f;
  };

  let gTex = null;
  function glowTex() {
    if (gTex) return gTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (gTex = new THREE.CanvasTexture(c));
  }
  BR.AFighter.glowTex = glowTex;
})();

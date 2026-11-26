/* ===== avatar.js : personnages 3D animés (modèles KayKit CC0, 76 animations partagées) + auras =====
   Le personnage regarde vers +z, pieds en y = 0. API : defaultLook, build, thumb, Preview.
   build(look, opt) -> { group, update(dt, speed, st), act(nom, o), weapon(nom), dispose, handR, handL, head, base }
   (av.base : animation de repos à la place de 'Idle' quand le personnage ne bouge pas, ex. assis) */
(function () {
  const BR = window.BR;
  const A = (BR.Avatar = {});
  const SCALE = 0.78;                    // modèles KayKit -> ~1,9 m
  const SLOT_WEAPONS = /handslot/i;

  /* ---------- recoloration de la palette (variantes de couleur) ---------- */
  const tintCache = {};
  function tinted(tex, filter) {
    const key = tex.uuid + filter;
    if (tintCache[key]) return tintCache[key];
    const im = tex.image; if (!im || !im.width) return tex;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.filter = filter; g.drawImage(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.encoding = tex.encoding; t.magFilter = tex.magFilter; t.minFilter = tex.minFilter;
    return (tintCache[key] = t);
  }
  let gTex = null;
  function glowTex() {
    if (gTex) return gTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (gTex = new THREE.CanvasTexture(c));
  }

  A.defaultLook = () => ({ skin: 'survivor', aura: null });

  // états de locomotion -> animations
  const LOCO = { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', sprint: 'Running_B', crouch: 'Walking_C', air: 'Jump_Idle', down: 'Lie_Idle', back: 'Walking_Backwards' };

  A.build = function (look, opt) {
    look = Object.assign(A.defaultLook(), look || {});
    opt = opt || {};
    const skin = BR.skinById(look.skin);
    const tier = { commun: 0, rare: 1, epique: 2, legendaire: 3, mythique: 4 }[skin.rarity] || 0;
    const root = new THREE.Group();
    const model = BR.Assets && BR.Assets.ready ? BR.Assets.character(skin.model) : null;
    const av = { group: root, look, tier, t: Math.random() * 6, state: '', actions: {}, oneShot: null, handR: null, handL: null, head: null, weapons: {} };
    let mixer = null;
    if (model) {
      model.scale.setScalar(SCALE);
      root.add(model);
      model.traverse(o => {
        if (/^handslotr$/i.test(o.name)) av.handR = o;
        if (/^handslotl$/i.test(o.name)) av.handL = o;
        if (o.name === 'head') av.head = o;
        if (o.isMesh) {
          o.frustumCulled = false;
          if (skin.tint) {
            const ms = Array.isArray(o.material) ? o.material : [o.material];
            const nm = ms.map(m => { const c = m.clone(); if (m.map) c.map = tinted(m.map, skin.tint); c.userData.own = true; return c; });
            o.material = Array.isArray(o.material) ? nm : nm[0];
          }
        }
      });
      // armes portées en main : cachées (le jeu affiche celles qu'il veut)
      [av.handR, av.handL].forEach(h => { if (h) h.children.slice().forEach(ch => { av.weapons[ch.name] = ch; ch.visible = false; }); });
      mixer = new THREE.AnimationMixer(model);
    }
    av.mixer = mixer;
    const action = name => {
      if (!mixer) return null;
      if (av.actions[name]) return av.actions[name];
      const clip = BR.Assets.clip(name); if (!clip) return null;
      return (av.actions[name] = mixer.clipAction(clip));
    };
    function setState(s, fade) {
      if (s === av.state) return;
      const prev = av.state ? action(LOCO[av.state] || av.state) : null, next = action(LOCO[s] || s);
      av.state = s;
      if (!next) return;
      next.reset(); next.setEffectiveWeight(1); next.play();
      if (prev && prev !== next) prev.crossFadeTo(next, fade == null ? 0.2 : fade, false);
    }
    /** joue une animation ponctuelle (attaque, sort, esquive…) puis revient à la locomotion */
    av.act = function (name, o) {
      o = o || {};
      const a = action(name); if (!a) return 0;
      const fi = o.fade == null ? 0.12 : o.fade;
      if (av.oneShot && av.oneShot.a !== a) av.oneShot.a.fadeOut(Math.max(0.08, fi));
      a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = o.speed || 1; a.setEffectiveWeight(1);
      a.fadeIn(fi).play();
      const cur = av.state ? action(LOCO[av.state] || av.state) : null; if (cur) cur.fadeOut(Math.max(0.12, fi * 1.4));
      const dur = a.getClip().duration / (o.speed || 1);
      av.oneShot = { a, t: dur * (o.cut || 0.92), name };
      if (av.skinfx && av.skinfx.kick) av.skinfx.kick(name);      // skins mythiques : éclat à l'attaque
      return dur;
    };
    /** affiche une arme tenue (noms KayKit : 1H_Sword, 2H_Sword, 1H_Wand, 2H_Staff, Knife, 1H_Crossbow, Round_Shield…) */
    av.weapon = function (names) {
      for (const k in av.weapons) av.weapons[k].visible = false;
      (names || []).forEach(n => { if (av.weapons[n]) av.weapons[n].visible = true; });
      return Object.keys(av.weapons);
    };
    // lampe torche (Backrooms) dans la main droite + faisceau visible par les autres
    const flash = new THREE.Group();
    flash.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 })));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), new THREE.MeshBasicMaterial({ color: 0xfff7c0 })); lens.position.y = 0.12; flash.add(lens);
    flash.visible = false;
    if (av.handR) { flash.scale.setScalar(1 / SCALE); flash.rotation.x = Math.PI / 2; av.handR.add(flash); } else root.add(flash);
    // faisceau : intense près de la lampe, s'estompe en douceur vers le bout et sur les bords
    const bg = new THREE.ConeGeometry(1.1, 6, 24, 6, true); bg.rotateX(-Math.PI / 2); bg.translate(0, 0, 3);
    { const pp = bg.attributes.position, cc = []; for (let i = 0; i < pp.count; i++) { const k = Math.pow(1 - BR.clamp(pp.getZ(i) / 6, 0, 1), 2.2); cc.push(k, k * 0.95, k * 0.8); } bg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); }
    const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xfff3c0, vertexColors: true, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(0.3, 1.35, 0.4); root.add(beam); beam.visible = false;
    av.beam = beam; av.flash = flash;
    // yeux lumineux (personnages épiques / légendaires)
    if (skin.eyes && av.head) {
      const eyes = new THREE.Group();
      const ep = skin.eyePos || [0.2, 0.62, 0.62];
      [-1, 1].forEach(s => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(skin.eyes), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.set(0.32, 0.22, 1); sp.position.set(s * ep[0], ep[1], ep[2]); eyes.add(sp); });
      av.head.add(eyes); av.eyes = eyes;
    }
    // aura
    const adef = BR.auraOf(look);
    if (adef && BR.AuraFX) { av.aura = BR.AuraFX.create(adef); root.add(av.aura.group); }
    if (tier >= 3) {
      const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(skin.eyes || '#ffffff'), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
      rim.scale.set(1.8, 2.6, 1); rim.position.y = 1.0; root.add(rim);
    }
    // skins mythiques : accessoires Blender + effets (js/skins-fx.js)
    if (model && skin.fx && BR.SkinFX && BR.SkinFX.dress) { try { av.skinfx = BR.SkinFX.dress(root, look, { model, head: av.head }); } catch (e) { console.warn('SkinFX', e); } }
    setState('idle', 0);

    /**
     * st : { crouch, down, sprint, light, pitch, air, dash, back, boost }
     */
    av.update = function (dt, speed, st) {
      st = st || {}; av.t += dt;
      let s;
      if (st.down) s = 'down';
      else if (st.air) s = 'air';
      else if (st.crouch && speed > 0.3) s = 'crouch';
      else if (speed < 0.35) s = av.base || 'idle';     // av.base : pose de repos choisie (ex. 'Sit_Chair_Idle', '2H_Melee_Idle')
      else if (st.back) s = 'back';
      else if (speed < 4.2) s = 'walk';
      else s = st.sprint ? 'sprint' : 'run';
      if (st.dash && !av._dash) { av.act('Dodge_Forward', { speed: 1.6, fade: 0.05 }); }
      av._dash = !!st.dash;
      // fin d'une animation ponctuelle : retour en fondu vers la locomotion, qui reprend là où elle en était (pas de saut de pose)
      if (av.oneShot) { av.oneShot.t -= dt; if (av.oneShot.t <= 0 || st.down) { const a = av.oneShot.a; av.oneShot = null; a.fadeOut(0.24); const cur = action(LOCO[s] || s); if (cur) { if (!cur.isRunning()) cur.reset(); cur.enabled = true; cur.setEffectiveWeight(1); cur.fadeIn(0.24).play(); } av.state = s; } }
      if (!av.oneShot) setState(s);
      const cur = action(LOCO[av.state] || av.state);
      if (cur && !av.oneShot) cur.timeScale = av.state === 'walk' ? BR.clamp(speed / 2.6, 0.6, 1.8) : av.state === 'run' || av.state === 'sprint' ? BR.clamp(speed / 6.5, 0.8, 1.8) : 1;
      if (mixer) mixer.update(dt);
      flash.visible = !!st.light && !st.down; beam.visible = !!st.light && !st.down; beam.rotation.x = -(st.pitch || 0);
      if (av.eyes) av.eyes.children.forEach((c, i) => { c.material.opacity = 0.7 + 0.3 * Math.sin(av.t * 4 + i); });
      if (av.aura) av.aura.update(dt, { speed, sprint: st.sprint, down: st.down, boost: st.boost || 0 });
      if (av.skinfx) av.skinfx.update(dt, { speed, sprint: st.sprint, down: st.down, air: st.air, boost: st.boost || 0 });
    };
    av.dispose = function () {
      if (av.skinfx) { av.skinfx.dispose(); av.skinfx = null; }
      if (av.aura) av.aura.dispose();
      if (mixer) mixer.stopAllAction();
      root.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.userData.own) m.dispose(); }); });
    };
    return av;
  };

  /* ---------- aperçu / vignettes ---------- */
  function studio(w, h) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xeef3ff, 0x2a1d10, 1.1));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.4); key.position.set(2, 3, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x7ab0ff, 1.2); rim.position.set(-3, 2, -2); scene.add(rim);
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 60); cam.position.set(0, 1.2, 5.6); cam.lookAt(0, 1.0, 0);
    return { scene, cam };
  }
  function setupRenderer(r) { r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1; }
  let thumbR = null; const thumbCache = {};
  A.thumb = function (look, w, h) {
    w = w || 220; h = h || 280;
    const key = JSON.stringify({ s: look && look.skin, a: look && look.aura }) + w + 'x' + h;
    if (thumbCache[key]) return thumbCache[key];
    if (!thumbR) { thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); setupRenderer(thumbR); }
    thumbR.setPixelRatio(1); thumbR.setSize(w, h, false); thumbR.setClearColor(0x000000, 0);
    const { scene, cam } = studio(w, h);
    const av = A.build(look); av.group.rotation.y = 0.45; for (let k = 0; k < 12; k++) av.update(0.05, 0, {}); scene.add(av.group);
    thumbR.render(scene, cam);
    const url = thumbR.domElement.toDataURL('image/png');
    av.dispose();
    if (BR.Assets && BR.Assets.ready) thumbCache[key] = url;
    return url;
  };

  /** aperçu tournant ; opt.stage = 'dressing' : la cabine d'essayage 3D (js/stage3d.js), même API, repli sur l'aperçu simple */
  A.Preview = function (canvas, opt) {
    if (opt && opt.stage && BR.Stage3D && BR.Stage3D[opt.stage]) { try { return BR.Stage3D[opt.stage](canvas, opt); } catch (e) { console.warn('Stage3D', e); } }
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); setupRenderer(r);
    let w = canvas.clientWidth || 300, h = canvas.clientHeight || 400;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(w, h, false); r.setClearColor(0x000000, 0);
    const st = studio(w, h); st.cam.aspect = w / h; st.cam.updateProjectionMatrix();
    let av = null, rotY = 0.5, drag = false, lx = 0, auto = true, run = true, zoom = 1, walk = 0, showT = 4, camZ = 5.6;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; st.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 0.96, 64), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.6 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; st.scene.add(ring);
    const pd = e => { drag = true; lx = e.clientX; auto = false; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} };
    const pm = e => { if (drag) { rotY += (e.clientX - lx) * 0.012; lx = e.clientX; } };
    const pu = () => { drag = false; };
    const wh = e => { zoom = BR.clamp(zoom + e.deltaY * 0.001, 0.6, 1.4); st.cam.position.z = camZ * zoom; e.preventDefault(); };
    canvas.addEventListener('pointerdown', pd); canvas.addEventListener('pointermove', pm); canvas.addEventListener('pointerup', pu); canvas.addEventListener('pointercancel', pu);
    canvas.addEventListener('wheel', wh, { passive: false });
    const poses = ['Cheer', '1H_Melee_Attack_Slice_Diagonal', 'Spellcast_Shoot', '2H_Melee_Attack_Spin', 'Block'];
    let last = performance.now();
    function loop(now) {
      if (!run) return; requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      if (!canvas.isConnected) return;
      // taille d'affichage bornée : si la mise en page ne fixe pas la hauteur, on ne la laisse pas grandir à l'infini
      const cw = Math.min(canvas.clientWidth, innerWidth), ch = Math.min(canvas.clientHeight, innerHeight);
      if (cw && (cw !== w || ch !== h)) { w = cw; h = ch; r.setSize(w, h, false); st.cam.aspect = w / h; st.cam.updateProjectionMatrix(); }
      if (auto) rotY += dt * 0.5;
      if (av) {
        av.group.rotation.y = rotY;
        // de temps en temps, une pose classe
        showT -= dt; if (showT <= 0 && !walk) { showT = 6 + Math.random() * 4; av.act(BR.pick(poses)); }
        av.update(dt, walk, { sprint: walk > 6 });
      }
      ring.rotation.z += dt * 0.3;
      r.render(st.scene, st.cam);
    }
    requestAnimationFrame(loop);
    return {
      setLook(look) {
        if (av) { st.scene.remove(av.group); av.dispose(); } av = A.build(look); st.scene.add(av.group); showT = 1.2;
        // skins mythiques (ailes, cornes, halos) : on recule un peu la caméra
        const myth = BR.skinById(look && look.skin).rarity === 'mythique'; camZ = myth ? 6.9 : 5.6;
        st.cam.position.set(0, myth ? 1.35 : 1.2, camZ * zoom); st.cam.lookAt(0, myth ? 1.15 : 1.0, 0);
      },
      setWalk(v) { walk = v === true ? 4 : v === 2 ? 9 : 0; },
      spin() { auto = true; },
      /** mise en scène (achat d'un skin) : pose de victoire + éclat des effets */
      celebrate() { if (!av) return; auto = true; showT = 7; av.act('Cheer'); if (av.skinfx && av.skinfx.kick) av.skinfx.kick('reveal'); if (av.aura && av.aura.kick) av.aura.kick(1.2); },
      dispose() {
        run = false; if (av) av.dispose();
        canvas.removeEventListener('pointerdown', pd); canvas.removeEventListener('pointermove', pm); canvas.removeEventListener('pointerup', pu); canvas.removeEventListener('wheel', wh);
        r.dispose(); try { r.forceContextLoss(); } catch (_) {}
      },
    };
  };
})();

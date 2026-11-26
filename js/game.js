/* ===== game.js : moteur d'une partie (solo = boucle locale, multi = relais via le serveur, l'hôte fait autorité) ===== */
(function () {
  const BR = window.BR, Wd = BR.World, E = BR.Ent, Au = BR.Audio, P = BR.PLAYER, C = Wd.C, SH = Wd.SH;
  const Gm = (BR.Game = { active: false });

  /* ---------------- réglages (partagés avec les menus) ---------------- */
  // bodycam : objectif + incrustation ; shake : force des tremblements (0..1,5) ; weather : météo des cartes extérieures (auto, clear, rain, storm)
  // fear : intensité de la peur ('normal' ou 'strong') — fréquence des frayeurs, baisse des lumières (voir FEARL plus bas et BR.Ent.FEAR)
  const DEF_SET = { autorun: false, sens: 1, fov: 80, quality: 'high', fps: false, invertY: false, master: 0.8, sfx: 1, amb: 0.8, mus: 0.6, bob: true, bodycam: true, shake: 1, weather: 'auto', fear: 'normal' };
  BR.settings = Object.assign({}, DEF_SET, BR.store.get('br_settings', {}));
  BR.saveSettings = function () {
    BR.store.set('br_settings', BR.settings);
    Au.setVolumes(BR.settings.master, BR.settings.sfx, BR.settings.amb, BR.settings.mus);
    if (R) applyQuality();
    if (S) { S.cam.fov = BR.settings.fov; S.cam.updateProjectionMatrix(); }
  };

  const BLEED = 35, REVIVE_HOLD = 3, PICK_HOLD = 0.6, INVULN = 3, MED_DELAY = 2.5, RAGE_AT = 480;
  const SEND_HZ = 15, WORLD_HZ = 12, R_PL = P.radius;

  /* ---------------- rendu ---------------- */
  let R = null;
  function renderer() {
    if (R) return R;
    R = new THREE.WebGLRenderer({ canvas: BR.$('#gl'), antialias: BR.settings.quality !== 'low', powerPreference: 'high-performance' });
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.1;
    applyQuality();
    window.addEventListener('resize', resize);
    return R;
  }
  function applyQuality() {
    const q = BR.settings.quality, dpr = window.devicePixelRatio || 1;
    R.setPixelRatio(Math.min(dpr, q === 'high' ? 1.5 : q === 'med' ? 1 : 0.7));
    resize();
  }
  function resize() {
    if (!R) return;
    R.setSize(window.innerWidth, window.innerHeight, false);
    if (S) { S.cam.aspect = window.innerWidth / window.innerHeight; S.cam.updateProjectionMatrix(); if (S.post) S.post.resize(); }
  }
  const POOL = { high: 8, med: 6, low: 4 };
  const MUSIC = { backrooms: ['backrooms', 0.45, 'bourdonnement', 0.8], mall: ['centre', 0.55, '', 0], city: ['', 0, 'ville', 0.9],
    park: ['', 0, 'ville', 0.6], tilted: ['', 0, 'ville', 0.9], bowling: ['centre', 0.4, 'bourdonnement', 0.5],
    halle6: ['', 0, 'bourdonnement', 0.8], iut: ['', 0, 'bourdonnement', 0.6], verdun: ['', 0, 'ville', 0.4],
    // cimetière : nappe d'horreur discrète, sans ambiance de ville (la circulation y serait déplacée)
    cimetiere: ['backrooms', 0.3, '', 0],
    // piscine : nappe d'horreur très basse + bourdonnement des néons
    piscine: ['backrooms', 0.22, 'bourdonnement', 0.5] };

  /* ---------------- session ---------------- */
  let S = null;
  const keys = {};
  Gm.session = () => S;

  /**
   * o = { mode:'solo'|'multi', mapId, diffId, seed, roster:[{id,name,look,level}], selfId, hostId, loadout:[{id,n}], onEnd(summary) }
   */
  Gm.start = function (o) {
    if (S) Gm.stop();
    const def = BR.MAPS.find(m => m.id === o.mapId) || BR.MAPS[0];
    const diff = BR.DIFFS[o.diffId] || BR.DIFFS.normal;
    const map = Wd.generate(def, o.seed >>> 0, diff);
    const T = BR.Tex.build(def.theme);
    renderer();

    S = {
      o, solo: o.mode === 'solo', selfId: o.selfId, hostId: o.hostId, isHost: o.mode === 'solo' || o.selfId === o.hostId,
      def, diff, map, T, time: 0, last: performance.now(), ended: false, endT: -1, paused: false, chatOpen: false, locked: false,
      players: new Map(), order: o.roster.map(r => r.id),
      fuseTaken: map.fuses.map(() => false), seenFuse: map.fuses.map(() => false), exitSeen: false, exitOpen: false, alarm: false, alarmT: 0,
      explored: new Uint8Array(map.WH * map.F), exploreT: 0,
      items: (o.loadout || []).map(x => ({ id: x.id, n: x.n })), fx: { energy: 0, smoke: 0, radar: 0, compass: 0 },
      flashOn: true, eye: P.eye, stepDist: 0, bobT: 0, shake: 0, camMode: 'fp', slide: 0, slideCd: 0, dash: 0, dashCd: 0, prox: 0,
      hold: null, inter: null, spec: null, specYaw: 0, camYaw: 0, camPitch: 0,
      flares: [], decoys: [], pings: [], snap: [], snapT: 0, monVel: new Map(), voices: new Map(),
      sendT: 0, worldT: 0, lastWorld: 0, lightT: 0, unsub: [], texs: [], danger: 0, grace: diff.grace, escSent: 0,
      // ambiance : caméra corporelle (ressorts), essoufflement, lampe défaillante, sang au sol, surfaces
      gait: Math.PI / 2, exert: 0, breathPh: 0, tens: 0, surfCache: {}, blood: [],
      bc: { amp: 0, run: 0, lastYaw: 0, lastPitch: 0, ly: { v: 0, vel: 0 }, lp: { v: 0, vel: 0 }, lr: { v: 0, vel: 0 }, land: { v: 0, vel: 0 } },
      lamp: { flick: 0, dead: 0, cd: 6, st: 0, cur: 1, k: 1, off: false, willDie: false },
    };

    // --- scène ---
    const scene = (S.scene = new THREE.Scene());
    scene.background = new THREE.Color(T.sky || T.fog);
    scene.fog = new THREE.FogExp2(T.fog, T.fogDensity);
    S.ambient = new THREE.AmbientLight(T.ambient, T.ambientI); scene.add(S.ambient);
    S.hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]); scene.add(S.hemi);
    if (T.moon) { const mo = new THREE.DirectionalLight(T.moon, 0.45); mo.position.set(-0.5, 1, 0.3); scene.add(mo); }
    if (T.outdoor) { S.skyDome = BR.Tex.skyDome(T); scene.add(S.skyDome); }
    R.toneMappingExposure = T.exposure || 1.1;
    S.built = Wd.build(map, T); scene.add(S.built.group);
    const cam = (S.cam = new THREE.PerspectiveCamera(BR.settings.fov, window.innerWidth / window.innerHeight, 0.1, 220));
    cam.rotation.order = 'YXZ'; scene.add(cam);
    S.spot = new THREE.SpotLight(0xfff1d0, 0, 34, 0.48, 0.55, 1.1);
    S.spot.position.set(0.18, -0.15, 0); S.spot.target.position.set(0, -0.05, -1); cam.add(S.spot, S.spot.target);
    // réserve fixe de lumières (évite les recompilations de shaders)
    S.pool = []; const nPool = POOL[BR.settings.quality] || 6;
    for (let i = 0; i < nPool; i++) { const l = new THREE.PointLight(T.lightColor, 0, 10, 2); l.userData.src = null; scene.add(l); S.pool.push(l); }
    S.flarePool = []; for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xff3a24, 0, 13, 2); scene.add(l); S.flarePool.push(l); }
    S.liveLights = map.lights.filter(l => !l.dead).map(l => ({ l, x: l.kind === 'lamp' ? l.px : (l.cx + 0.5) * C, y: l.kind === 'lamp' ? l.y : l.y - 0.35, z: l.kind === 'lamp' ? l.pz : (l.cy + 0.5) * C }));
    S.flickSet = new Map(); S.built.flickMeshes.forEach(f => S.flickSet.set(f.light, f));
    // Difficile : toutes les lumières deviennent rouges. Cauchemar : rouges ET elles grésillent sans arrêt.
    S.redLights = diff.id === 'hard' || diff.id === 'nightmare'; S.strobe = diff.id === 'nightmare'; S.strobeOn = true; S.strobeT = 0;
    if (S.redLights) {
      const red = new THREE.Color(1, 0.13, 0.08);
      S.pool.forEach(l => l.color.copy(red)); S.built.onMat.color.setRGB(1, 0.18, 0.12); S.built.dimMat.color.setRGB(0.25, 0.03, 0.02);
      S.ambient.color.multiply(new THREE.Color(1, 0.3, 0.26)); S.ambient.intensity *= 0.75;
      S.hemi.color.multiply(new THREE.Color(1, 0.28, 0.22)); S.hemi.groundColor.multiply(new THREE.Color(1, 0.3, 0.25));
      scene.fog.color.lerp(new THREE.Color(0x260303), 0.75); if (!T.outdoor) scene.background = scene.fog.color.clone();
    }
    S.panelBase = S.built.onMat.color.clone(); S.gSpike = 0; S.gAmt = 0;

    buildFuses(); buildExit();

    // --- joueurs ---
    o.roster.forEach((r, i) => {
      const c = map.spawnCells[i % map.spawnCells.length], p0 = Wd.center(c.cx, c.cy);
      const jit = i >= map.spawnCells.length ? 0.45 : 0;
      const p = mkPlayer(r, p0.x + jit, 0, p0.z + jit);
      p.yaw = bestYaw(p.x, p.z);
      S.players.set(r.id, p);
      p.av = BR.Avatar.build(r.look); p.av.group.rotation.order = 'YXZ'; p.av.group.visible = r.id !== S.selfId; scene.add(p.av.group);
      p.tag = nameTag(p); scene.add(p.tag.sprite); p.tag.sprite.visible = r.id !== S.selfId;
    });
    S.me = S.players.get(S.selfId);
    S.me.mk = hasItem('medkit');
    S.bc.lastYaw = S.me.yaw;
    initWeather();

    // --- entités ---
    const env = { fogColor: new THREE.Color(T.fog), fogDensity: T.fogDensity };
    S.views = new E.Views(scene, env);
    S.views.brightFn = brightAt;
    S.views.ampFn = id => { const v = S.voices.get(id); return v ? v.lastAmp || 0 : 0; };
    initFear();
    if (S.isHost) {
      // onFx : frayeurs scénarisées décidées par l'hôte (traque, coup d'œil, vague d'obscurité…) → évènements partagés
      S.director = new E.Director(map, diff, BR.rngFrom((o.seed ^ 0x5bd1e995) >>> 0), { onCatch, onFx: e => { if (S && !S.ended) ev(e); } });
      const all = [...S.players.values()];
      const n = S.director.population(all.length);
      for (let i = 0; i < n; i++) S.director.spawn(all);
    }

    // --- réseau ---
    if (!S.solo) {
      const N = BR.Net;
      S.unsub.push(N.on('r', onRelay), N.on('chat', onChat), N.on('left', onLeft), N.on('end', m => endGame(m.res, '')),
        N.on('abort', m => abortGame(m.msg || 'Partie interrompue.')), N.on('lost', () => abortGame('Connexion au serveur perdue.')),
        N.on('kicked', m => abortGame(m.msg || 'Exclu du salon.')));
    }

    bindInput(true);
    BR.$('#game').classList.add('on');
    Gm.active = true;
    resize();
    Au.startAmbience(def.theme); Au.setTension(0); Au.unmuffle();
    const mu = MUSIC[def.kind] || MUSIC.backrooms;
    Au.track('music', mu[0], mu[1]); Au.track('amb', mu[2], mu[3]);
    BR.Hud.reset(S);
    BR.Hud.title(def.name.toUpperCase(), def.sub, diff);
    S.raf = requestAnimationFrame(frame);
    if (!S.solo) S.bgTimer = setInterval(background, 50);
  };

  Gm.stop = function () {
    if (!S) return;
    cancelAnimationFrame(S.raf); clearInterval(S.bgTimer);
    if (S.post) { try { S.post.dispose(); } catch (e) {} }
    if (S.slideFx) { try { S.slideFx.stop(); } catch (e) {} S.slideFx = null; }
    if (S.under) Au.unmuffle();
    disposeFx();
    bindInput(false);
    S.unsub.forEach(f => f());
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    S.voices.forEach(v => v.h && v.h.stop()); S.voices.clear();
    killApp();
    S.views.clear();
    S.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m.userData || !m.userData.keep) m.dispose(); }); });
    S.texs.forEach(t => t.dispose());
    S.players.forEach(p => { if (p.tag) p.tag.tex.dispose(); });
    Au.stopAmbience(); Au.track('amb', ''); Au.track('music', 'menu', 0.8);
    if (vig) vig.style.opacity = 0;
    BR.Hud.hide();
    BR.$('#game').classList.remove('on');
    if (R) R.clear();
    S = null; Gm.active = false;
    for (const k in keys) keys[k] = false;
  };

  /* ---------------- construction ---------------- */
  function mkPlayer(r, x, y, z) {
    return {
      id: r.id, name: r.name, look: r.look || BR.Avatar.defaultLook(), level: r.level || 1,
      x, y, z, tx: x, ty: y, tz: z, vy: 0, ground: true, yaw: 0, tyaw: 0, pitch: 0, vx: 0, vz: 0, speed: 0,
      sprint: false, crouch: false, light: false, smoke: 0, slide: false,
      down: false, dead: false, escaped: false, bleed: 0, inv: 0, mk: false, medT: 0,
      fuses: 0, revives: 0, downs: 0, stepDist: 0, chat: '', chatT: 0, seen: 0,
    };
  }
  function bestYaw(x, z) {
    let best = 0, bd = -1;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, fx = -Math.sin(a), fz = -Math.cos(a);
      let d = 0; while (d < 24 && !Wd.blocked(S.map, x + fx * d, z + fz * d, 0, 0.3)) d += 0.5;
      if (d > bd) { bd = d; best = a; }
    }
    return best;
  }
  function canvasTex(c) { const t = new THREE.CanvasTexture(c); S.texs.push(t); return t; }

  function buildFuses() {
    S.fuseObjs = [];
    const glow = canvasTex(BR.Tex.glow(255, 190, 60));
    const bodyM = new THREE.MeshBasicMaterial({ color: 0xffc23a });
    const capM = new THREE.MeshLambertMaterial({ color: 0xb8bcc2, emissive: 0x222222 });
    S.map.fuses.forEach(f => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 12), bodyM);
      const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.09, 12), capM); c1.position.y = 0.21;
      const c2 = c1.clone(); c2.position.y = -0.21;
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb030, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      gl.scale.set(1.6, 1.6, 1);
      // colonne de lumière visible de loin
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.25, 3.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 0.9;
      const piv = new THREE.Group(); piv.add(body, c1, c2); piv.rotation.z = 0.5; g.add(piv, gl, beam);
      g.position.set(f.x, f.y + 1.05, f.z);
      S.scene.add(g);
      S.fuseObjs.push({ g, piv, gl, x: f.x, y: f.y, z: f.z, f: f.f });
    });
  }

  function buildExit() {
    const ex = S.map.exit, c = Wd.center(ex.cx, ex.cy);
    const g = new THREE.Group();
    g.position.set(c.x + ex.dx * (C / 2 - 0.02), 0, c.z + ex.dy * (C / 2 - 0.02));
    g.rotation.y = Math.atan2(-ex.dx, -ex.dy);
    const frameM = new THREE.MeshLambertMaterial({ color: 0x2a2c2e });
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); g.add(me); return me; };
    add(new THREE.BoxGeometry(0.14, 2.6, 0.18), frameM, -0.76, 1.3, 0.03);
    add(new THREE.BoxGeometry(0.14, 2.6, 0.18), frameM, 0.76, 1.3, 0.03);
    add(new THREE.BoxGeometry(1.66, 0.16, 0.18), frameM, 0, 2.62, 0.03);
    add(new THREE.PlaneGeometry(1.4, 2.56), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 1.28, -0.03);
    const hinge = new THREE.Group(); hinge.position.set(-0.7, 0, 0); g.add(hinge);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.56, 0.07), new THREE.MeshLambertMaterial({ color: 0x6b6f66 })); door.position.set(0.7, 1.28, 0); hinge.add(door);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.06), new THREE.MeshLambertMaterial({ color: 0xb9b9b0 })); bar.position.set(0.7, 1.1, 0.06); hinge.add(bar);
    const red = canvasTex(BR.Tex.sign('SORTIE', '#3a0606', '#ff3b30', 256, 96));
    const green = canvasTex(BR.Tex.sign('SORTIE', '#06300f', '#3dff6e', 256, 96));
    const sign = add(new THREE.PlaneGeometry(1.0, 0.38), new THREE.MeshBasicMaterial({ map: red }), 0, 3.05, 0.07);
    const lamp = add(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }), 0.95, 1.5, 0.09);
    const glow = canvasTex(BR.Tex.glow(255, 255, 255));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff3020, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(1.8, 0.9, 1); halo.position.set(0, 3.05, 0.16); g.add(halo);
    S.scene.add(g);
    S.exitObj = { g, hinge, sign, red, green, lamp, halo, open: 0, x: c.x + ex.dx * (C / 2 - 0.55), y: 0, z: c.z + ex.dy * (C / 2 - 0.55) };
  }

  /* ---------------- étiquette de nom ---------------- */
  function nameTag(p) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sprite.scale.set(1.9, 0.6, 1); sprite.renderOrder = 10;
    const t = { c, tex, sprite, key: '' };
    drawTag(p, t);
    return t;
  }
  function drawTag(p, t) {
    const state = p.down ? 'down' : '', chat = p.chatT > 0 ? p.chat : '';
    const key = p.name + '|' + state + '|' + chat;
    if (key === t.key) return; t.key = key;
    const g = t.c.getContext('2d'); g.clearRect(0, 0, 512, 160);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (chat) {
      g.font = '600 30px "Segoe UI", Arial'; const w = Math.min(500, g.measureText(chat).width + 36);
      g.fillStyle = 'rgba(255,255,255,0.92)'; roundRect(g, 256 - w / 2, 4, w, 52, 14); g.fill();
      g.fillStyle = '#16181c'; g.fillText(chat.length > 30 ? chat.slice(0, 29) + '…' : chat, 256, 31);
    }
    g.font = 'bold 40px "Segoe UI", Arial';
    g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(p.name, 256, 100);
    g.fillStyle = p.down ? '#ff5a4e' : '#ffffff'; g.fillText(p.name, 256, 100);
    if (p.down) { g.font = 'bold 26px "Segoe UI", Arial'; g.strokeText('À TERRE — E pour relever', 256, 138); g.fillStyle = '#ffb3ad'; g.fillText('À TERRE — E pour relever', 256, 138); }
    t.tex.needsUpdate = true;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  /* ---------------- entrées ---------------- */
  let bound = false;
  function bindInput(on) {
    const f = on ? 'addEventListener' : 'removeEventListener';
    if (on === bound) return; bound = on;
    window[f]('keydown', onKeyDown, true);
    window[f]('keyup', onKeyUp, true);
    document[f]('mousemove', onMouse);
    document[f]('pointerlockchange', onLockChange);
    BR.$('#gl')[f]('mousedown', onCanvasDown);
    BR.$('#gl')[f]('contextmenu', noCtx);
    window[f]('blur', onBlur);
  }
  function noCtx(e) { e.preventDefault(); }
  function onBlur() { for (const k in keys) keys[k] = false; }
  Gm.lock = function () {
    const c = BR.$('#gl');
    try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  };
  function onCanvasDown(e) {
    if (!S) return;
    if (!S.locked && !S.chatOpen) { Gm.lock(); return; }
    if (spectating() && e.button === 0) cycleSpec(1);
    else if (e.button === 2) startDash();
  }
  function onLockChange() {
    if (!S) return;
    S.locked = document.pointerLockElement === BR.$('#gl');
    if (S.locked) { S.paused = false; BR.Hud.pause(false); }
    else if (!S.chatOpen && !S.ended) { S.paused = true; BR.Hud.pause(true); for (const k in keys) keys[k] = false; }
  }
  Gm.resume = function () { if (S) { S.paused = false; BR.Hud.pause(false); Gm.lock(); } };
  Gm.quit = function () { if (S) leaveGame(); };

  function onMouse(e) {
    if (!S || !S.locked) return;
    const k = 0.0022 * BR.settings.sens;
    const mx = e.movementX || 0, my = (e.movementY || 0) * (BR.settings.invertY ? -1 : 1);
    if (Math.abs(mx) > 400 || Math.abs(my) > 400) return;
    if (spectating()) { S.specYaw -= mx * k; return; }
    const me = S.me;
    me.yaw -= mx * k; me.pitch = BR.clamp(me.pitch - my * k, -1.45, 1.45);
  }

  function onKeyDown(e) {
    if (!S) return;
    if (S.chatOpen) return;
    const code = e.code, key = (e.key || '').toLowerCase();
    if (code === 'Tab') { e.preventDefault(); BR.Hud.scoreboard(true); return; }
    if (S.paused && code !== 'Escape') return;
    keys[code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code) || kis('b_jump', code)) e.preventDefault();
    if (e.repeat) return;
    const me = S.me;
    if (code === 'Enter' && !S.solo) { e.preventDefault(); openChat(); return; }
    if (key === 'b' && !S.solo) { BR.Hud.quick(true); return; }
    if (BR.Hud.quickOpen && BR.Hud.quickOpen() && /^Digit[1-6]$/.test(code)) { const m = BR.QUICKCHAT[+code.slice(5) - 1]; if (m) BR.Net.chat(m, true); BR.Hud.quick(false); return; }
    if (/^Digit[1-3]$/.test(code)) { useItem(+code.slice(5) - 1); return; }
    if (key === 'm') { BR.Hud.bigMap(); return; }
    if (spectating()) { if (code === 'Space' || code === 'KeyD' || code === 'ArrowRight') cycleSpec(1); else if (code === 'KeyA' || code === 'ArrowLeft') cycleSpec(-1); return; }
    if (kis('b_flash', code)) { S.flashOn = !S.flashOn; Au.ui('click'); return; }
    if (kis('b_cam', code)) { S.camMode = S.camMode === 'fp' ? 'tp' : 'fp'; return; }
    if (kis('b_ping', code)) { doPing(); return; }
    if (kis('b_crouch', code) && me.ground && !me.down && S.slideCd <= 0 && me.speed > P.walk + 1) startSlide();
    if (kis('b_dash', code)) startDash();
    // saut mémorisé 0,2 s : appliqué dès qu'on touche le sol (ou juste après l'avoir quitté) — en pleine course,
    // une marche ou un bord d'escalier faisait parfois croire au jeu qu'on était en l'air et le saut était perdu
    if (kis('b_jump', code) && !me.down) { S.jumpBuf = 0.2; tryJump(); }
  }
  function tryJump() {
    const me = S.me;
    if (!(S.jumpBuf > 0) || me.down || me.dead || me.escaped) return;
    if (!me.ground && !(S.coyote > 0)) return;
    S.jumpBuf = 0; S.coyote = 0;
    me.vy = P.jump; me.ground = false; Au.jump(); if (S.slide > 0) S.slide = 0; S.bc.land.vel += 0.35; S.exert = Math.min(1, S.exert + 0.04);
  }
  function onKeyUp(e) {
    if (!S) return;
    keys[e.code] = false;
    if (e.code === 'Tab') BR.Hud.scoreboard(false);
  }
  const down = (...codes) => codes.some(c => keys[c]);
  // touches réglables (Paramètres → Touches, js/keys.js)
  const kh = id => BR.Keys.held(keys, id), kis = (id, c) => BR.Keys.is(id, c), kl = id => BR.Keys.label(id);

  function openChat() {
    S.chatOpen = true;
    try { document.exitPointerLock(); } catch (e) {}
    BR.Hud.chatInput(true, txt => {
      S.chatOpen = false;
      if (txt) BR.Net.chat(txt, false);
      if (S && !S.ended) Gm.lock();
    });
  }

  /* ---------------- boucle ---------------- */
  function frame(now) {
    if (!S) return;
    S.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.0005, (now - S.last) / 1000)); S.last = now;
    if (S.paused && S.solo) { BR.Hud.frame(S, 0); draw(); return; }
    step(dt, true);
  }
  // onglet masqué : le navigateur ne dessine plus mais, en multijoueur, la partie doit continuer
  function background() {
    if (!S) return;
    const now = performance.now();
    if (now - S.last < 250) return;
    let el = Math.min(1.5, (now - S.last) / 1000); S.last = now;
    while (el > 0.0005 && S) { const dt = Math.min(0.05, el); el -= dt; step(dt, false); }
  }
  function step(dt, render) {
    // premier contact en solo : bref ralenti (en multijoueur, seule la caméra réagit)
    if (S.fear && S.fear.slow > 0) { S.fear.slow -= dt; if (S.solo) dt *= 0.4; }
    S.time += dt;
    for (const k in S.fx) if (S.fx[k] > 0) S.fx[k] = Math.max(0, S.fx[k] - dt);
    updateLocal(dt);
    updateRemotes(dt);
    if (S.isHost) hostUpdate(dt); else clientMonsters(dt);
    if (!S) return;
    netSend(dt);
    updateWorld(dt);
    fearUpdate(dt, render);
    updateCamera(dt);
    if (S.map.wl) waterView(dt);
    if (!render) return;
    updateAudio(dt);
    BR.Hud.frame(S, dt);
    if (render !== 'nodraw') draw();
  }
  /* ---------------- objectif « bodycam » : grand-angle léger, distorsion en barillet, vignettage, bruit de capteur ----------------
     La scène est dessinée dans une cible (sRGB 8 bits, anticrénelée en WebGL2) puis recopiée à l'écran à travers ce filtre.
     Intensités volontairement discrètes (l'ancien filtre VHS était jugé trop fort). Désactivé en qualité basse. */
  const LENS_FS = `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime, uK, uCA, uVig, uNoise; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float asp = uRes.x / uRes.y; vec2 q = vec2(d.x * asp, d.y);
      float rr = dot(q, q) / (0.25 * (asp * asp + 1.0));          // 0 au centre, 1 dans les coins
      float f = (1.0 + uK * rr) / (1.0 + uK);                     // barillet : les coins restent en place, le centre grossit un peu
      vec2 uv = 0.5 + d * f;
      vec2 ca = d * uCA * rr;                                     // aberration chromatique, seulement sur les bords
      vec3 c = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
      c *= 1.0 - uVig * smoothstep(0.2, 1.2, rr);                 // vignettage de l'objectif
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      float n = h(floor(gl_FragCoord.xy) + fract(uTime * 7.31) * 113.0) - 0.5;
      c += n * uNoise * (1.3 - l);                                // bruit de capteur, surtout dans le noir
      gl_FragColor = vec4(c, 1.0);
    }`;
  function makePost() {
    try {
      const size = new THREE.Vector2(); R.getDrawingBufferSize(size);
      const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false };
      const ms = R.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget;
      const rt = ms ? new THREE.WebGLMultisampleRenderTarget(size.x, size.y, opts) : new THREE.WebGLRenderTarget(size.x, size.y, opts);
      if (ms) rt.samples = BR.settings.quality === 'high' ? 4 : 2;
      rt.texture.encoding = THREE.sRGBEncoding;      // la scène y est déjà convertie pour l'écran : le filtre la recopie telle quelle
      const U = { tDiffuse: { value: rt.texture }, uRes: { value: size.clone() }, uTime: { value: 0 }, uK: { value: 0.1 }, uCA: { value: 0.0035 }, uVig: { value: 0.3 }, uNoise: { value: 0.03 } };
      const mat = new THREE.ShaderMaterial({ uniforms: U, depthTest: false, depthWrite: false,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: LENS_FS });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
      const sc = new THREE.Scene(); sc.add(quad);
      const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      return {
        rt, U, sc, oc,
        resize() { R.getDrawingBufferSize(size); rt.setSize(size.x, size.y); U.uRes.value.copy(size); },
        dispose() { rt.dispose(); mat.dispose(); quad.geometry.dispose(); },
      };
    } catch (e) { console.warn('effet bodycam', e); return null; }
  }
  const lensOn = () => !!(S && BR.settings.bodycam && BR.settings.quality !== 'low');
  function draw() {
    if (lensOn()) {
      if (S.post === undefined) S.post = makePost();
      const P2 = S.post;
      if (P2) {
        P2.U.uTime.value = S.time;
        P2.U.uNoise.value = 0.026 + S.prox * 0.02;
        R.setRenderTarget(P2.rt); R.render(S.scene, S.cam);
        R.setRenderTarget(null); R.render(P2.sc, P2.oc);
        return;
      }
    }
    R.render(S.scene, S.cam);
  }

  /* ---------------- joueur local ---------------- */
  function startSlide() {
    const me = S.me, sp = Math.hypot(me.vx, me.vz) || 1;
    S.slide = 0.85; S.slideCd = 1.3;
    const boost = P.slide * (S.fx.energy > 0 ? 1.15 : 1);
    me.vx = me.vx / sp * boost; me.vz = me.vz / sp * boost;
    Au.sample('woosh', 0.5) || Au.throw();
  }
  // dash : courte poussée très rapide dans la direction de déplacement (ou vers l'avant)
  function startDash() {
    const me = S.me; if (!S || me.down || me.dead || me.escaped || S.dashCd > 0 || S.paused) return;
    let f = (kh('up') ? 1 : 0) - (kh('down') ? 1 : 0), s = (kh('right') ? 1 : 0) - (kh('left') ? 1 : 0);
    if (!f && !s) f = 1;
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw); let dx = -sy * f + cy * s, dz = -cy * f - sy * s; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    me.vx = dx * P.dash; me.vz = dz * P.dash; S.dash = 0.16; S.dashCd = 2.0; S.slide = 0;
    // au sol, le dash est une GLISSADE : pas de pas accélérés ni de secousse, la caméra file bas et l'élan retombe en douceur
    Au.throw(); S.dashCam = 0.5; if (me.ground) S.glide = Math.max(S.glide || 0, 0.3);
  }
  function updateLocal(dt) {
    const me = S.me;
    me.inv = Math.max(0, me.inv - dt);
    me.smoke = S.fx.smoke;
    S.slideCd = Math.max(0, S.slideCd - dt); S.dashCd = Math.max(0, S.dashCd - dt);
    if (me.dead || me.escaped) { S.hold = null; S.inter = null; return; }
    const ok = !S.chatOpen && !S.paused;
    let f = 0, s = 0;
    if (ok) {
      f = (kh('up') ? 1 : 0) - (kh('down') ? 1 : 0);
      s = (kh('right') ? 1 : 0) - (kh('left') ? 1 : 0);
    }
    const crouchKey = ok && !me.down && kh('b_crouch');
    const moving = !!(f || s);
    const energy = S.fx.energy > 0;
    // course automatique (option) : on court dès qu'on avance, la touche de course fait marcher — moins de touches tenues
    // en même temps, pour les claviers qui « perdent » le saut quand on tient déjà Maj + Z
    me.sprint = ok && !me.down && !crouchKey && moving && f >= 0 && (BR.settings.autorun ? !kh('b_run') : kh('b_run'));
    me.crouch = crouchKey || S.slide > 0;
    let dx = 0, dz = 0;
    if (moving) { const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw); dx = -sy * f + cy * s; dz = -cy * f - sy * s; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
    // Piscine : eau (profondeur aux pieds, bassin profond ?) et toboggans
    const wat = S.map.wl ? waterState(me) : null;
    const sr = S.map.slides && me.ground ? slideUnder(me) : null;
    if (sr && !S.slideFx) { S.slideFx = Au.loopFx ? Au.loopFx('wind') : null; }
    else if (!sr && S.slideFx && (S.glide || 0) <= 0.35) { S.slideFx.stop(); S.slideFx = null; }
    if (S.slideFx) S.slideFx.set(Math.min(1.4, Math.hypot(me.vx, me.vz) / 9));
    if (S.dash > 0) { S.dash -= dt; }
    else if (sr) {
      // toboggan : on est emporté vers le bas (on ne peut pas le remonter), on garde un peu de contrôle latéral
      S.glide = 0.9;
      const a = Math.min(1, dt * 2.6);
      me.vx += (-sr.dx * 13.5 - me.vx) * a + dx * dt * 4; me.vz += (-sr.dy * 13.5 - me.vz) * a + dz * dt * 4;
    }
    else if (S.slide > 0) {
      S.slide -= dt;
      const sp = Math.hypot(me.vx, me.vz), k = Math.max(0, 1 - dt * 1.3);
      me.vx *= k; me.vz *= k;
      if (moving && sp > 0.1) { const a = Math.min(1, dt * 1.5); me.vx += (dx * sp - me.vx) * a; me.vz += (dz * sp - me.vz) * a; }
    } else {
      let want = me.down ? 0.9 : crouchKey ? P.crouch : me.sprint ? P.sprint : P.walk;
      if (energy && !me.down) want *= 1.25;
      if (f < 0) want *= 0.85;
      // dans l'eau : on avance d'autant moins vite qu'elle est profonde ; en eau profonde, on nage
      const swim = wat && wat.deep && !me.ground;
      if (wat) want *= swim ? 0.6 : 1 - 0.45 * Math.min(1, wat.d / 1.1);
      if (S.glide > 0) S.glide -= dt;
      const acc = swim ? 4.5 : S.glide > 0 && !wat ? 1.3 : me.ground ? 16 : 2.4;      // élan conservé en l'air (et en sortie de toboggan)
      const tvx = dx * want, tvz = dz * want;
      if (me.ground || moving || swim) { me.vx += (tvx - me.vx) * Math.min(1, dt * acc); me.vz += (tvz - me.vz) * Math.min(1, dt * acc); }
    }
    let grav = P.grav;
    if (wat) {
      // plongeon : l'eau amortit la chute
      if (!S.wetPrev && me.vy < -2.5) { Au.splash(Math.min(1.5, -me.vy / 9)); S.bc.land.vel -= Math.min(1.2, -me.vy * 0.06); if (wat.deep) me.vy *= 0.35; }
      if (wat.deep) {
        // flottaison : équilibre la tête juste hors de l'eau, on y remonte tout seul.
        // Espace = nager vers le haut, C / Ctrl = plonger (et rester au fond tant qu'on le tient)
        const eq = wat.lv - 1.32, dive = ok && !me.down && kh('b_crouch'), up = ok && !me.down && kh('b_jump');
        if (!S.swimHint && BR.Hud.toast) { S.swimHint = true; BR.Hud.toast('Eau profonde : ' + kl('b_jump') + ' pour remonter, ' + kl('b_crouch') + ' pour plonger'); }
        if (dive) { grav = 0; me.vy += (-3 - me.vy) * Math.min(1, dt * 3); if (me.ground) me.vy = 0; }
        else if (up) { grav = 0; me.vy = Math.min(3.4, me.vy + dt * 16); me.ground = false; }
        else if (!me.ground || me.y < eq - 0.35) {
          grav = 0; me.ground = false;
          const tv = me.y > eq + 0.25 ? -3 : me.y < eq - 0.1 ? 1.3 : (eq - me.y) * 2;      // remonte doucement vers la surface
          me.vy += (tv - me.vy) * Math.min(1, dt * (me.vy < -1.5 ? 3 : 1.6));
        }
      }
    }
    S.wetPrev = !!wat;
    const ox = me.x, oz = me.z, oy = me.y, wasGround = me.ground;
    Wd.move(S.map, me, me.vx * dt, me.vz * dt, R_PL);
    const impact = Wd.vertical(S.map, me, dt, R_PL, grav);
    if (wat && wat.deep) {
      // la tête reste hors de l'eau en surface ; en nageant contre le bord, on se hisse sur la plage du bassin
      const top = wat.lv - 1.32;
      if (!me.ground && me.vy > 0 && oy <= top + 0.01 && me.y > top) { me.y = top; me.vy = 0; }
      if (moving && f > 0 && !me.ground && me.y > wat.lv - 1.7) {
        const ax = me.x + dx * 0.62, az = me.z + dz * 0.62, g = Wd.support(S.map, ax, az, me.y, R_PL, 2.3);
        if (g > me.y + 0.5 && g > wat.lv - 0.4 && !Wd.blocked(S.map, ax, az, g, R_PL)) { me.x = ax; me.z = az; me.y = g; me.vy = 0; me.ground = true; S.bc.land.vel -= 0.7; Au.splash(0.35); }
      }
      if (!me.ground && moving && me.y > wat.lv - 1.7) { S.strokeT = (S.strokeT || 0) - dt; if (S.strokeT <= 0) { S.strokeT = 0.75; Au.swim(); } }
    }
    // « coyote time » : on peut encore sauter 0,12 s après avoir quitté un rebord (pas après un saut)
    if (me.ground) S.coyote = 0.12; else S.coyote = Math.max(0, (S.coyote || 0) - dt);
    if (me.vy > 0.5) S.coyote = 0;
    if (S.jumpBuf > 0) { S.jumpBuf -= dt; tryJump(); }
    me.speed = Math.hypot(me.x - ox, me.z - oz) / dt;
    if (me.speed < 0.05 && me.ground) { me.vx *= 0.5; me.vz *= 0.5; }
    if (!wasGround && me.ground) {
      // atterrissage : à-coup de la caméra (ressort amorti) proportionnel à la vitesse de chute
      if (impact > 2.5) S.bc.land.vel -= Math.min(2.2, impact * 0.11);
      if (impact > 9) { Au.land(Math.min(1.6, impact / 12), surfAt(me.x, me.y, me.z), wetAt(me)); S.shake = Math.max(S.shake, Math.min(0.6, impact / 30)); S.gait = Math.ceil(S.gait / Math.PI) * Math.PI; }
      else if (impact > 4) Au.land(0.6, surfAt(me.x, me.y, me.z), wetAt(me));
    }
    me.light = S.flashOn && !S.lamp.off;      // ce que voient les autres : la lampe peut tomber en panne
    me.mk = hasItem('medkit');
    me.slide = S.slide > 0;
    // essoufflement : monte en sprint, redescend au repos
    S.exert = BR.clamp(S.exert + dt * (me.sprint ? 0.07 : S.dash > 0 ? 0.5 : me.speed > 0.6 ? -0.02 : -0.06), 0, 1);
    // pas : la phase de marche (π par pas) rythme à la fois le balancement de la caméra et le bruit des pas
    if (S.dashCam > 0) S.dashCam -= dt;
    if (me.ground && me.speed > 0.6 && S.slide <= 0 && !sr && !(S.dashCam > 0)) {
      const stride = me.down ? 1.1 : me.sprint ? 2.4 : me.crouch ? 1.15 : 1.75;
      const before = Math.floor(S.gait / Math.PI);
      S.gait += me.speed * dt / stride * Math.PI;
      if (Math.floor(S.gait / Math.PI) !== before) { const sf = surfAt(me.x, me.y, me.z); Au.step((me.sprint ? 0.95 : me.crouch ? 0.22 : 0.5) * (me.down ? 0.4 : 1), 0, sf, sf === 'water' && wat ? Math.min(1, wat.d / 0.7) : wetAt(me)); fearOnStep(sf); }
    } else if (me.ground) {
      // à l'arrêt, le pas en cours se termine en douceur (la tête revient au-dessus des appuis)
      const tgt = Math.floor(S.gait / Math.PI) * Math.PI + Math.PI / 2;
      S.gait += BR.clamp(tgt - S.gait, -dt * 3, dt * 3);
    }
    void oy;
    S.exploreT -= dt;
    if (S.exploreT <= 0) { S.exploreT = 0.25; explore(me); }
    interact(dt, ok);
    if (S.exitOpen && !me.down && Math.abs(me.y) < 0.6 && Math.hypot(me.x - S.exitObj.x, me.z - S.exitObj.z) < 1.2 && !(S.escSent > S.time)) { S.escSent = S.time + 0.6; act({ a: 'escape' }); }
  }

  function explore(me) {
    const m = S.map, c = Wd.cellOf(m, me.x, me.z), f = BR.clamp(Math.round(me.y / SH), 0, m.F - 1), R0 = 6, ey = me.y + 1.4;
    for (let dy = -R0; dy <= R0; dy++) for (let dx = -R0; dx <= R0; dx++) {
      const cx = c.cx + dx, cy = c.cy + dy; if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H || dx * dx + dy * dy > R0 * R0 + 1) continue;
      const i = cy * m.W + cx, k = f * m.WH + i; if (S.explored[k]) continue;
      const t = m.t[f][i], q = Wd.center(cx, cy);
      if (t === Wd.WALL) { if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(d => { const j = (cy + d[1]) * m.W + cx + d[0]; return j >= 0 && j < m.WH && S.explored[f * m.WH + j] && m.t[f][j] !== Wd.WALL; })) S.explored[k] = 1; continue; }
      if (Wd.los(m, me.x, ey, me.z, q.x, f * SH + 1.2, q.z)) S.explored[k] = 1;
    }
    S.fuseObjs.forEach((o, i) => { if (!S.seenFuse[i] && Math.hypot(o.x - me.x, o.z - me.z, (o.y - me.y)) < 18 && Wd.los(m, me.x, ey, me.z, o.x, o.y + 1.05, o.z)) S.seenFuse[i] = true; });
    if (!S.exitSeen && Math.hypot(S.exitObj.x - me.x, S.exitObj.z - me.z) < 18 && Wd.los(m, me.x, ey, me.z, S.exitObj.x, 1.2, S.exitObj.z)) S.exitSeen = true;
  }

  /* --- interactions : relever, ramasser ---- */
  function interact(dt, ok) {
    const me = S.me; let it = null;
    if (!me.down) {
      for (const p of S.players.values()) if (p !== me && p.down && !p.dead && Math.hypot(p.x - me.x, p.z - me.z) < 2 && Math.abs(p.y - me.y) < 1.6) { it = { kind: 'revive', id: p.id, text: 'Relever ' + p.name, need: REVIVE_HOLD }; break; }
      if (!it) S.fuseObjs.forEach((o, i) => { if (!it && !S.fuseTaken[i] && Math.hypot(o.x - me.x, o.z - me.z) < 1.6 && Math.abs(o.y - me.y) < 1.4) it = { kind: 'pick', i, text: 'Ramasser le fusible', need: PICK_HOLD }; });
      if (!it && !S.exitOpen && Math.abs(me.y) < 1 && Math.hypot(S.exitObj.x - me.x, S.exitObj.z - me.z) < 2) {
        const left = S.fuseTaken.filter(t => !t).length;
        it = { kind: 'info', text: 'Porte verrouillée : encore ' + left + ' fusible' + (left > 1 ? 's' : '') + ' à trouver' };
      }
    }
    S.inter = it;
    const holding = ok && kh('b_use') && it && it.need;
    if (holding) {
      const key = it.kind + (it.id || it.i);
      if (!S.hold || S.hold.key !== key) S.hold = { key, t: 0, need: it.need };
      S.hold.t += dt;
      if (S.hold.t >= S.hold.need) {
        S.hold = null;
        if (it.kind === 'revive') act({ a: 'revive', id: it.id });
        else if (it.kind === 'pick') act({ a: 'pick', i: it.i });
      }
    } else S.hold = null;
  }

  /* --- objets --- */
  function hasItem(id) { return S.items.some(x => x.id === id && x.n > 0); }
  function takeItem(id) { const it = S.items.find(x => x.id === id && x.n > 0); if (!it) return false; it.n--; BR.Account.consume(id); BR.Hud.items(S); return true; }
  function throwPos(maxD) {
    const me = S.me, fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    let d = 0.5; while (d < maxD && !Wd.blocked(S.map, me.x + fx * (d + 0.25), me.z + fz * (d + 0.25), me.y, 0.22)) d += 0.25;
    const x = me.x + fx * d, z = me.z + fz * d;
    let y = Wd.support(S.map, x, z, me.y + 0.3, 0.2); if (!isFinite(y)) y = me.y;
    return { x, y, z };
  }
  function useItem(slot) {
    const me = S.me, it = S.items[slot];
    if (!it || it.n <= 0 || me.dead || me.escaped) return;
    if (me.down && it.id !== 'radar' && it.id !== 'compass') return;
    switch (it.id) {
      case 'energy': S.fx.energy = 8; Au.drink(); BR.Hud.toast('Énergie à fond : +25 % de vitesse', 'good'); break;
      case 'flare': { const q = throwPos(6.5); act({ a: 'item', it: 'flare', x: q.x, y: q.y, z: q.z }); Au.throw(); break; }
      case 'decoy': { const q = throwPos(10); act({ a: 'item', it: 'decoy', x: q.x, y: q.y, z: q.z }); Au.throw(); break; }
      case 'medkit': BR.Hud.toast('Le kit s\'active tout seul si tu tombes.', ''); return;
      case 'radar': S.fx.radar = 15; Au.beep(0, 1); BR.Hud.toast('Entités révélées sur la carte', 'good'); break;
      case 'smoke': S.fx.smoke = 6; Au.throw(); BR.Hud.toast('Fumigène : les entités perdent ta trace', 'good'); act({ a: 'item', it: 'smoke', x: me.x, y: me.y, z: me.z }); break;
      case 'compass': S.fx.compass = 25; Au.ui('ok'); BR.Hud.toast('Boussole activée', 'good'); break;
    }
    takeItem(it.id);
  }

  /* --- marqueur (V) --- */
  function doPing() {
    const me = S.me; if (me.dead || me.escaped) return;
    if (S.pingCd > S.time) return; S.pingCd = S.time + 1.2;
    const dir = new THREE.Vector3(); S.cam.getWorldDirection(dir);
    const o = S.cam.position;
    let d = 0.5, hit = null;
    while (d < 40) { const x = o.x + dir.x * d, y = o.y + dir.y * d, z = o.z + dir.z * d; if (!Wd.los(S.map, o.x, o.y, o.z, x, y, z) || y < Wd.support(S.map, x, z, y, 0.1)) { hit = { x: o.x + dir.x * (d - 0.5), y: o.y + dir.y * (d - 0.5), z: o.z + dir.z * (d - 0.5) }; break; } d += 0.5; }
    if (!hit) hit = { x: o.x + dir.x * 40, y: o.y + dir.y * 40, z: o.z + dir.z * 40 };
    addPing(hit.x, hit.y, hit.z, me.name);
    if (!S.solo) BR.Net.relay({ k: 'ping', x: +hit.x.toFixed(2), y: +hit.y.toFixed(2), z: +hit.z.toFixed(2) }, '*');
  }
  let pingTex = null;
  function addPing(x, y, z, who) {
    if (!pingTex || !S.texs.includes(pingTex)) pingTex = canvasTex(BR.Tex.glow(80, 200, 255));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pingTex, color: 0x5ad1ff, transparent: true, depthTest: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(x, y + 0.3, z); sp.scale.set(1.1, 1.1, 1); sp.renderOrder = 20; S.scene.add(sp);
    S.pings.push({ x, y, z, who, t: 7, sp });
    Au.ping(panOf(x, z));
  }

  /* ---------------- joueurs distants ---------------- */
  function updateRemotes(dt) {
    for (const p of S.players.values()) {
      if (p.chatT > 0) p.chatT -= dt;
      if (p.tag) drawTag(p, p.tag);
      if (p === S.me) {
        const av = p.av; av.group.position.set(p.x, p.y, p.z); av.group.rotation.y = p.yaw + Math.PI;
        av.group.visible = S.camMode === 'tp' && !p.dead && !p.escaped;
        av.update(dt, p.speed, { crouch: p.crouch, down: p.down, sprint: p.sprint, light: p.light && S.lamp.k > 0.5, pitch: p.pitch });
        continue;
      }
      const ax = p.tx + p.vx * 0.06, az = p.tz + p.vz * 0.06;
      const dx = ax - p.x, dz = az - p.z, dy = p.ty - p.y;
      if (Math.hypot(dx, dz, dy) > 6) { p.x = p.tx; p.z = p.tz; p.y = p.ty; }
      else { const k = Math.min(1, dt * 12); p.x += dx * k; p.z += dz * k; p.y += dy * Math.min(1, dt * 14); }
      p.yaw += BR.angDiff(p.yaw, p.tyaw) * Math.min(1, dt * 14);
      p.speed = Math.hypot(p.vx, p.vz);
      const av = p.av; av.group.position.set(p.x, p.y, p.z); av.group.rotation.y = p.yaw + Math.PI;
      av.group.visible = !p.dead && !p.escaped;
      p.tag.sprite.visible = av.group.visible;
      p.tag.sprite.position.set(p.x, p.y + (p.down ? 1.0 : 2.15) - (p.crouch ? 0.35 : 0), p.z);
      // lampe d'un coéquipier qui grésille (panne reçue par le réseau : on rejoue un grésillement local)
      let lit = p.light;
      if (p.fk > 0) { p.fk -= dt; p.fkT = (p.fkT || 0) - dt; if (p.fkT <= 0) { p.fkT = 0.03 + Math.random() * 0.07; p.fkOn = Math.random() > 0.45; } lit = lit && p.fkOn; }
      av.update(dt, p.speed, { crouch: p.crouch, down: p.down, sprint: p.sprint, light: lit, pitch: p.pitch });
      if (av.group.visible && p.speed > 0.6 && !p.slide) {
        p.stepDist += p.speed * dt;
        if (p.stepDist > (p.sprint ? 2.4 : 1.75)) { p.stepDist = 0; const d = Math.hypot(p.x - S.cam.position.x, p.z - S.cam.position.z, p.y - S.cam.position.y); if (d < 22) Au.step((p.sprint ? 0.8 : 0.4) * (1 - d / 22), panOf(p.x, p.z), surfAt(p.x, p.y, p.z), wetAt(p)); }
      }
    }
  }

  /* ---------------- hôte : entités, règles, fin de manche ---------------- */
  function onCatch(m, p) {
    if (!S || S.ended || p.down || p.dead || p.escaped || p.inv > 0) return;
    ev(Object.assign({ e: 'down', id: p.id, sp: m.sp, med: p.mk ? 1 : 0 }, posOf(p)));
    // l'entité recule un instant après son « coup »
    m.stun = Math.max(m.stun, 1.4);
  }
  function hostUpdate(dt) {
    const arr = [...S.players.values()];
    // lv : tension de la partie (entités plus agressives, frayeurs plus fréquentes) ; fear : intensité choisie par l'hôte
    S.director.update(dt, arr, { grace: S.diff.grace, rage: S.time > RAGE_AT, alarm: S.alarm, lv: S.fear ? S.fear.lv : 0, fear: BR.settings.fear || 'normal' });
    S.grace = Math.max(0, S.diff.grace - S.director.time);
    for (const p of arr) {
      if (p !== S.me) p.inv = Math.max(0, (p.inv || 0) - dt);
      if (!p.down || p.dead) continue;
      if (p.medT > 0) { p.medT -= dt; if (p.medT <= 0) ev({ e: 'rev', id: p.id, by: p.id, med: 1 }); }
      else { p.bleed -= dt; if (p.bleed <= 0) ev(Object.assign({ e: 'dead', id: p.id }, posOf(p))); }
    }
    const active = arr.filter(p => !p.dead && !p.escaped);
    if (active.length && active.every(p => p.down && p.medT <= 0) && !S.solo) active.forEach(p => ev(Object.assign({ e: 'dead', id: p.id }, posOf(p))));
    if (!active.length && S.endT < 0) S.endT = S.time + (S.solo ? 0.5 : 1.6);
    if (S.endT > 0 && S.time >= S.endT && !S.endSent) finish();
    if (!S.solo) {
      S.worldT -= dt;
      if (S.worldT <= 0) {
        S.worldT = 1 / WORLD_HZ;
        const ps = {}; for (const p of arr) ps[p.id] = [p.down ? 1 : 0, p.dead ? 1 : 0, p.escaped ? 1 : 0, Math.ceil(p.bleed)];
        BR.Net.relay({ k: 'w', t: +S.time.toFixed(2), m: S.director.snapshot(), ps, f: maskOf(S.fuseTaken), ex: S.exitOpen ? 1 : 0, g: Math.ceil(S.grace), wx: S.wx ? S.wx.code : 0 }, '*');
      }
    }
    S.views.sync(S.director.snapshot(), dt, S.cam.position);
  }
  const maskOf = a => a.reduce((m, v, i) => m | (v ? 1 << i : 0), 0);
  // position jointe aux évènements « à terre » / « mort » : la flaque de sang apparaît au même endroit chez tout le monde
  const posOf = p => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, z: Math.round(p.z * 100) / 100 });

  function hostAct(pid, a) {
    const p = S.players.get(pid); if (!p || !a || S.ended) return;
    switch (a.a) {
      case 'pick': {
        const i = a.i | 0; if (i < 0 || i >= S.fuseTaken.length || S.fuseTaken[i] || p.down || p.dead || p.escaped) return;
        const fo = S.fuseObjs[i];
        if (Math.hypot(fo.x - p.x, fo.z - p.z) > 3.2 || Math.abs(fo.y - p.y) > 2.5) return;
        ev({ e: 'fuse', i, by: pid });
        const taken = S.fuseTaken.filter(Boolean).length, need = S.fuseTaken.length;
        const arr = [...S.players.values()];
        if (taken === Math.ceil(need / 2) && need > 2) S.director.spawn(arr, { near: { x: fo.x, z: fo.z } });
        if (taken === need) {
          ev({ e: 'alarm' });
          S.director.alertAll();
          if (S.diff.id === 'hard' || S.diff.id === 'nightmare') S.director.spawn(arr, { near: { x: S.exitObj.x, z: S.exitObj.z }, boost: 1.03 });
        }
        break;
      }
      case 'revive': {
        const t = S.players.get(a.id); if (!t || !t.down || t.dead || p.down || p.dead || p.escaped) return;
        if (Math.hypot(t.x - p.x, t.z - p.z) > 3.2 || Math.abs(t.y - p.y) > 2.5) return;
        ev({ e: 'rev', id: t.id, by: pid });
        break;
      }
      case 'escape': {
        if (!S.exitOpen || p.escaped || p.dead || p.down) return;
        if (Math.hypot(S.exitObj.x - p.x, S.exitObj.z - p.z) > 3 || Math.abs(p.y) > 1.5) return;
        ev({ e: 'esc', id: pid });
        break;
      }
      case 'item': {
        if (p.dead || p.escaped) return;
        const x = +a.x, y = +a.y || 0, z = +a.z; if (!isFinite(x) || !isFinite(z) || Math.hypot(x - p.x, z - p.z) > 12) return;
        if (a.it === 'flare') { ev({ e: 'flare', x, y, z, by: pid }); S.director.stunNear(x, y, z, 9, 4); }
        else if (a.it === 'decoy') { ev({ e: 'decoy', x, y, z, by: pid }); S.director.decoy(x, y, z, 10); }
        else if (a.it === 'smoke') { ev({ e: 'smoke', x, y, z, by: pid }); p.smoke = 6; for (const m of S.director.mons) if (m.tgt === pid) { m.st = 'wander'; m.wt = 0; } }
        break;
      }
    }
  }

  function ev(e) { applyEv(e); if (S && !S.solo) BR.Net.relay({ k: 'ev', e }, '*'); }
  function act(a) { if (S.isHost) hostAct(S.selfId, a); else BR.Net.relay({ k: 'act', a }, null); }

  function applyEv(e) {
    if (!S) return;
    const p = e.id != null ? S.players.get(e.id) : null, by = e.by != null ? S.players.get(e.by) : null;
    const self = e.id === S.selfId;
    switch (e.e) {
      case 'fuse': {
        if (S.fuseTaken[e.i]) return;
        S.fuseTaken[e.i] = true; S.seenFuse[e.i] = true; S.fuseObjs[e.i].g.visible = false;
        if (by) by.fuses++;
        const n = S.fuseTaken.filter(Boolean).length, need = S.fuseTaken.length;
        if (e.by === S.selfId) { Au.sample('pickup', 0.8) || Au.pickup(); BR.Hud.toast('Fusible récupéré (' + n + '/' + need + ')', 'good'); }
        else { Au.sample('coin', 0.5) || Au.beep(0, 0.8); BR.Hud.feed((by ? by.name : '?') + ' a trouvé un fusible (' + n + '/' + need + ')', 'fuse'); }
        brownout();      // le courant vacille partout, puis revient… un peu plus faible
        break;
      }
      case 'alarm': {
        if (S.exitOpen) return;
        S.exitOpen = true; S.alarm = true; S.alarmT = 0; S.exitSeen = true;
        Au.doorOpen(); Au.sample('alarm', 0.7) || Au.siren();
        Au.track('music', 'poursuite', 0.75);
        BR.Hud.banner('LA SORTIE EST OUVERTE', 'L\'alarme a rendu les entités folles. Courez !');
        S.shake = Math.max(S.shake, 0.5);
        // au loin, une sirène déformée : toutes les entités convergent
        if (S.fear) fearLater(1.4, () => Au.farSiren());
        break;
      }
      case 'down': {
        if (!p || p.down) return;
        // en solo sans kit de secours, personne ne peut te relever : juste le temps du « jumpscare », puis l'écran de défaite
        p.down = true; p.downs++; p.bleed = S.solo && !e.med ? 0.9 : BLEED; p.medT = e.med ? MED_DELAY : 0;
        // éclaboussures de sang là où il est tombé (même endroit chez tous les joueurs : position fournie par l'hôte)
        addBlood(e.x != null ? +e.x : p.x, e.y != null ? +e.y : p.y, e.z != null ? +e.z : p.z, false, hashStr(p.id) + p.downs * 7919);
        if (self) {
          S.hold = null; S.slide = 0;
          BR.Hud.jumpscare(E.scaryCanvas(e.sp)); Au.death(e.sp); S.shake = 1.3;
          setTimeout(() => { if (S) Au.down(); }, 600);
          setTimeout(() => { if (S && BR.Hud.blood) BR.Hud.blood(e.med ? 0.25 : 0.45); }, 900);   // un peu de sang sur l'objectif
          if (e.med) { takeItem('medkit'); BR.Hud.toast('Kit de secours : tu te relèves…', 'good'); }
        } else {
          Au.beep(panOf(p.x, p.z), 1); BR.Hud.feed(p.name + ' est à terre !', 'bad');
          const d = Math.hypot(p.x - S.cam.position.x, p.z - S.cam.position.z);
          if (d < 45) Au.screech(panOf(p.x, p.z), 0.5 * (1 - d / 45));      // son cri, au loin
        }
        break;
      }
      case 'rev': {
        if (!p || !p.down || p.dead) return;
        p.down = false; p.bleed = 0; p.medT = 0; p.inv = INVULN;
        if (by && by !== p) by.revives++;
        if (self) { Au.revive(); Au.unmuffle(); if (BR.Hud.bloodClear) BR.Hud.bloodClear(); BR.Hud.toast(e.med ? 'Relevé grâce au kit de secours !' : 'Relevé par ' + (by ? by.name : '?') + ' !', 'good'); }
        else if (e.by === S.selfId) { Au.revive(); BR.Hud.toast('Tu as relevé ' + p.name + ' !', 'good'); }
        else BR.Hud.feed((by && by !== p ? by.name + ' a relevé ' : '') + p.name + (by && by !== p ? '' : ' s\'est relevé'), 'good');
        break;
      }
      case 'dead': {
        if (!p || p.dead) return;
        p.dead = true; p.down = true; p.bleed = 0;
        // grande flaque qui s'étend lentement sous le corps
        addBlood(e.x != null ? +e.x : p.x, e.y != null ? +e.y : p.y, e.z != null ? +e.z : p.z, true, hashStr(p.id) * 31 + 17);
        if (self) {
          BR.Hud.banner(S.solo ? 'TU AS ÉTÉ ATTRAPÉ' : 'TU AS DISPARU', S.solo ? '' : 'Tu observes maintenant tes coéquipiers.', 'bad'); Au.flatline(); pickSpec();
          if (BR.Hud.blood) BR.Hud.blood(1);
          if (!S.solo && BR.Hud.bloodClear) setTimeout(() => { if (S) BR.Hud.bloodClear(); }, 5000);   // en spectateur, l'objectif se nettoie
        }
        else BR.Hud.feed(p.name + ' a été emporté…', 'bad');
        if (S.spec === p.id) pickSpec();
        break;
      }
      case 'esc': {
        if (!p || p.escaped) return;
        p.escaped = true; p.down = false;
        if (self) { Au.escape(); BR.Hud.banner('TU T\'ES ÉCHAPPÉ !', S.solo ? '' : 'Tu observes tes coéquipiers restants.', 'good'); pickSpec(); }
        else BR.Hud.feed(p.name + ' s\'est échappé !', 'good');
        if (S.spec === p.id) pickSpec();
        break;
      }
      case 'flare': addFlare(e.x, e.y || 0, e.z); if (e.by === S.selfId) BR.Hud.toast('Fusée lancée', ''); break;
      case 'decoy': addDecoy(e.x, e.y || 0, e.z); break;
      case 'smoke': addSmoke(e.x, e.y || 0, e.z); if (p) p.smoke = 6; break;
      case 'bolt': bolt(e); break;
      // frayeurs décidées par l'hôte (voir nextbot.js, section PEUR)
      case 'reveal': case 'sniff': fearReveal(e); break;
      case 'nape': fearNape(e); break;
      case 'dark': fearDark(e); break;
      case 'scream': fearScream(e); break;
    }
  }

  function finish() {
    S.endSent = true;
    const res = { won: false, time: Math.round(S.time), map: S.def.id, diff: S.diff.id, players: {}, mvp: null };
    let best = -1;
    S.players.forEach(p => {
      res.players[p.id] = { n: p.name, f: p.fuses, r: p.revives, d: p.downs, e: p.escaped ? 1 : 0, x: p.dead ? 1 : 0, sk: (p.look || {}).skin || 'survivor' };
      if (p.escaped) res.won = true;
      const sc = p.fuses * 3 + p.revives * 4 + (p.escaped ? 3 : 0) - p.downs;
      if (sc > best) { best = sc; res.mvp = p.id; }
    });
    if (S.solo) endGame(res, '');
    else { BR.Net.send({ t: 'end', res }); setTimeout(() => { if (S && !S.ended) endGame(res, ''); }, 4000); }
  }

  /* ---------------- client : entités reçues de l'hôte ---------------- */
  function clientMonsters(dt) {
    const age = Math.min(0.2, S.time - S.snapT);
    const list = S.snap.map(m => { const v = S.monVel.get(m.id); return v ? { id: m.id, sp: m.sp, st: m.st, tg: m.tg, x: m.x + v.x * age, y: m.y, z: m.z + v.z * age } : m; });
    S.views.sync(list, dt, S.cam.position);
    if (S.time - S.lastWorld > 15 && !S.ended) abortGame('L\'hôte ne répond plus.');
  }

  function onRelay(m) {
    if (!S) return;
    const d = m.d; if (!d || !d.k) return;
    const p = S.players.get(m.f);
    switch (d.k) {
      case 'st': {
        if (!p || p === S.me) return;
        p.tx = +d.x || p.tx; p.tz = +d.z || p.tz; p.ty = +d.y || 0; p.tyaw = +d.yaw || 0; p.pitch = +d.pi || 0;
        p.vx = +d.vx || 0; p.vz = +d.vz || 0; p.sprint = !!d.sp; p.crouch = !!d.cr; p.light = !!d.li; p.mk = !!d.mk;
        p.smoke = +d.sm || 0; p.slide = !!d.sl; p.seen = S.time; p.hide = !!d.hd;     // hd : caché dans le noir, souffle retenu
        if (+d.fk > 0) p.fk = Math.max(p.fk || 0, +d.fk);     // lampe qui grésille chez lui
        if (S.isHost) { p.x = p.tx; p.y = p.ty; p.z = p.tz; }
        break;
      }
      case 'w': {
        if (m.f !== S.hostId || S.isHost) return;
        const now = S.time;
        for (const mo of d.m || []) {
          const old = S.snap.find(o => o.id === mo.id);
          if (old && now > S.snapT) { const k = 1 / Math.max(0.05, now - S.snapT); S.monVel.set(mo.id, { x: BR.clamp((mo.x - old.x) * k, -10, 10), z: BR.clamp((mo.z - old.z) * k, -10, 10) }); }
        }
        S.snap = d.m || []; S.snapT = now; S.lastWorld = now;
        S.grace = d.g || 0;
        if (S.wx && d.wx != null && (d.wx | 0) !== S.wx.code) setWeather(d.wx | 0);     // météo choisie par l'hôte
        S.fuseTaken.forEach((t, i) => { if (!t && (d.f >> i) & 1) applyEv({ e: 'fuse', i, by: null }); });
        if (d.ex && !S.exitOpen) applyEv({ e: 'alarm' });
        for (const id in d.ps || {}) { const q = S.players.get(id); if (!q) continue; const a = d.ps[id]; if (q.down) q.bleed = a[3]; if (a[1] && !q.dead) applyEv({ e: 'dead', id }); if (a[2] && !q.escaped) applyEv({ e: 'esc', id }); }
        break;
      }
      case 'ev': if (m.f === S.hostId && !S.isHost) applyEv(d.e); break;
      case 'act': if (S.isHost) hostAct(m.f, d.a); break;
      case 'ping': if (p) addPing(+d.x, +d.y || 0, +d.z, p.name); break;
    }
  }
  function onChat(m) {
    if (!S) return;
    BR.Hud.chatLine(m.n, m.m, m.q);
    const p = S.players.get(m.f); if (p) { p.chat = m.m; p.chatT = 5; }
    Au.ui('msg');
  }
  function onLeft(m) {
    if (!S) return;
    const p = S.players.get(m.id); if (!p) return;
    S.scene.remove(p.av.group, p.tag.sprite); p.av.dispose(); p.tag.tex.dispose();
    S.players.delete(m.id); S.order = S.order.filter(x => x !== m.id);
    BR.Hud.feed(p.name + (m.reason === 'kick' ? ' a été exclu' : ' a quitté la partie'), '');
    BR.Hud.reset(S, true);
    if (S.spec === m.id) pickSpec();
  }

  function netSend(dt) {
    if (S.solo) return;
    S.sendT -= dt; if (S.sendT > 0) return;
    S.sendT = 1 / SEND_HZ;
    const me = S.me; if (me.dead || me.escaped) return;
    const r2 = v => Math.round(v * 100) / 100;
    BR.Net.relay({ k: 'st', x: r2(me.x), y: r2(me.y), z: r2(me.z), yaw: r2(me.yaw), pi: r2(me.pitch), vx: r2(me.vx), vz: r2(me.vz), sp: me.sprint ? 1 : 0, cr: me.crouch ? 1 : 0, li: me.light ? 1 : 0, mk: me.mk ? 1 : 0, sm: me.smoke > 0 ? r2(me.smoke) : 0, sl: me.slide ? 1 : 0, fk: S.lamp.flick > 0 ? r2(Math.min(2, S.lamp.flick)) : 0, hd: me.hide ? 1 : 0 }, '*');
  }

  /* ---------------- monde : lumières, fusibles, porte, effets ---------------- */
  function updateWorld(dt) {
    const t = S.time, cam = S.cam.position;
    // néons défaillants : allumés, puis rafales de coupures rapides (grésillement), parfois une longue panne
    S.built.flickMeshes.forEach(f => {
      const l = f.light;
      if (!(f.burst > 0) && Math.random() < dt * (S.strobe ? 2.2 : 0.45)) f.burst = Math.random() < 0.15 ? 0.8 + Math.random() * 1.6 : 0.12 + Math.random() * 0.7;
      let on = true;
      if (f.burst > 0) { f.burst -= dt; f.st = (f.st || 0) - dt; if (f.st <= 0) { f.st = 0.025 + Math.random() * 0.07; f.cur = Math.random() > (f.burst > 0.8 ? 0.8 : 0.5); } on = !!f.cur; }
      if (on !== f.on) { f.on = on; f.mesh.material = on ? S.built.onMat : S.built.dimMat; if (Math.hypot((l.cx + 0.5) * C - cam.x, (l.cy + 0.5) * C - cam.z, l.y - cam.y) < 8 && Math.random() < 0.6) Au.flick(); }
    });
    // Cauchemar : tout l'éclairage grésille en permanence, avec des coupures totales
    if (S.strobe) {
      S.strobeT -= dt;
      if (S.strobeT <= 0) { const black = Math.random() < 0.06; S.strobeOn = black ? false : Math.random() > 0.3; S.strobeT = black ? 0.25 + Math.random() * 0.5 : 0.03 + Math.random() * 0.1; if (!S.strobeOn && Math.random() < 0.3) Au.flick(); }
      S.built.onMat.color.copy(S.panelBase).multiplyScalar(S.strobeOn ? 0.75 + Math.random() * 0.25 : 0.06);
    }
    S.lightT -= dt;
    if (S.lightT <= 0) {
      S.lightT = 0.2;
      const cand = [];
      for (const o of S.liveLights) { const d = Math.hypot(o.x - cam.x, (o.y - cam.y) * 1.5, o.z - cam.z); if (d < 26) cand.push({ o, d }); }
      cand.sort((a, b) => a.d - b.d);
      S.pool.forEach((pl, i) => { const c = cand[i]; pl.userData.src = c ? c.o : null; if (c) { pl.position.set(c.o.x, c.o.y, c.o.z); const big = c.o.l.kind === 'lamp' ? 1.7 : c.o.l.kind === 'sky' ? 1.4 : 1; pl.distance = 10 * big; pl.userData.big = big; } });
    }
    const pulse = S.alarm ? 0.5 + 0.5 * Math.sin(t * 5) : 0;
    S.pool.forEach(pl => {
      const o = pl.userData.src;
      if (!o) { pl.intensity = 0; return; }
      const f = S.flickSet.get(o.l);
      let I = ((pl.userData.big || 1) > 1.5 ? 1.3 : 0.95) * (S.T.lightI || 1);
      if (f) I = f.on ? I : 0.06;
      else if (o.l.flicker) I *= Math.sin(t * 13 + o.l.phase) > -0.8 ? 1 : 0.1;
      if (S.strobe) I *= S.strobeOn ? 0.7 + Math.random() * 0.3 : 0.04;
      pl.intensity = I * (S.alarm ? 0.8 : 1) * lightK(o);      // tension, vague d'obscurité, baisse de courant
      if (S.alarm) pl.color.setRGB(1, 0.35 + 0.5 * (1 - pulse), 0.3 + 0.4 * (1 - pulse));
    });
    if (S.alarm) { S.alarmT += dt; S.ambient.color.setRGB(0.45 + 0.35 * pulse, 0.18, 0.16); }
    const me = S.me;
    // lampe torche : pannes aléatoires (grésillements, extinctions de 1 à 3 s), plus fréquentes quand une entité approche
    const lk = updateLamp(dt);
    const fl = lk * 1.05 * (S.T.flashI || 1);
    S.spot.intensity += (fl - S.spot.intensity) * Math.min(1, dt * (S.lamp.flick > 0 || S.lamp.dead > 0 ? 60 : 20));
    updateWeather(dt);
    updateBlood(dt);
    S.fuseObjs.forEach((f, i) => { if (S.fuseTaken[i]) return; f.piv.rotation.y += dt * 1.6; f.g.position.y = f.y + 1.05 + Math.sin(t * 2 + i) * 0.07; f.gl.material.opacity = 0.65 + 0.25 * Math.sin(t * 4 + i); });
    const ex = S.exitObj;
    if (S.exitOpen) {
      ex.open = Math.min(1, ex.open + dt * 0.7); ex.hinge.rotation.y = -ex.open * 1.75;
      if (ex.sign.material.map !== ex.green) { ex.sign.material.map = ex.green; ex.sign.material.needsUpdate = true; ex.lamp.material.color.set(0x3dff6e); ex.halo.material.color.set(0x3dff6e); }
    } else ex.lamp.material.color.setRGB(1, 0.15 + 0.15 * Math.sin(t * 6), 0.1);
    ex.halo.material.opacity = 0.35 + 0.2 * Math.sin(t * 3);
    S.flares = S.flares.filter(f => {
      f.t -= dt;
      if (f.t <= 0) { S.scene.remove(f.sp); f.sp.material.dispose(); if (f.light) f.light.intensity = 0; return false; }
      const k = Math.min(1, f.t / 3) * (0.85 + Math.random() * 0.3);
      if (f.light) f.light.intensity = 2.4 * k;
      f.sp.material.opacity = 0.9 * k; f.sp.scale.setScalar(1.2 + Math.random() * 0.25);
      return true;
    });
    S.decoys = S.decoys.filter(d => {
      d.t -= dt; d.beep -= dt;
      if (d.beep <= 0) { d.beep = 0.5; const dist = Math.hypot(d.x - cam.x, d.z - cam.z, d.y - cam.y); if (dist < 30) Au.beep(panOf(d.x, d.z), Math.max(0.05, 1 - dist / 30)); d.led.material.opacity = 1; }
      d.led.material.opacity = Math.max(0.15, d.led.material.opacity - dt * 3);
      if (d.t <= 0) { S.scene.remove(d.g); d.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); return false; }
      return true;
    });
    S.smokes = (S.smokes || []).filter(s => { s.t -= dt; s.sp.material.opacity = Math.min(0.75, s.t / 2) * 0.8; s.sp.scale.setScalar(3 + (6 - s.t) * 0.8); s.sp.position.y = s.y + 1.2 + (6 - s.t) * 0.15; if (s.t <= 0) { S.scene.remove(s.sp); s.sp.material.dispose(); return false; } return true; });
    S.pings = S.pings.filter(p => { p.t -= dt; p.sp.material.opacity = Math.min(1, p.t); p.sp.position.y = p.y + 0.3 + Math.sin(t * 4) * 0.08; if (p.t <= 0) { S.scene.remove(p.sp); p.sp.material.dispose(); return false; } return true; });
  }
  let flareTex = null, ledTex = null, smokeTex = null;
  function addFlare(x, y, z) {
    if (!flareTex || !S.texs.includes(flareTex)) flareTex = canvasTex(BR.Tex.glow(255, 80, 50));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: 0xff5030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(x, y + 0.25, z); S.scene.add(sp);
    const light = S.flarePool.find(l => !S.flares.some(f => f.light === l)) || null;
    if (light) light.position.set(x, y + 0.6, z);
    S.flares.push({ x, y, z, t: 30, sp, light });
    Au.flare(panOf(x, z));
  }
  function addDecoy(x, y, z) {
    if (!ledTex || !S.texs.includes(ledTex)) ledTex = canvasTex(BR.Tex.glow(80, 255, 120));
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.14), new THREE.MeshLambertMaterial({ color: 0x2c2c2c })); box.position.y = 0.1;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), new THREE.MeshLambertMaterial({ color: 0x999999 })); ant.position.set(0.1, 0.35, 0);
    const led = new THREE.Sprite(new THREE.SpriteMaterial({ map: ledTex, color: 0x50ff78, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); led.scale.set(0.5, 0.5, 1); led.position.set(-0.08, 0.24, 0.08);
    g.add(box, ant, led); g.position.set(x, y, z); g.rotation.y = Math.random() * 6;
    S.scene.add(g); S.decoys.push({ x, y, z, t: 10, beep: 0, g, led });
  }
  function addSmoke(x, y, z) {
    if (!smokeTex || !S.texs.includes(smokeTex)) smokeTex = canvasTex(BR.Tex.glow(200, 200, 205));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x9aa0a8, transparent: true, depthWrite: false, opacity: 0.7 }));
    sp.position.set(x, y + 1.2, z); S.scene.add(sp);
    (S.smokes || (S.smokes = [])).push({ x, y, z, t: 6, sp });
  }

  /* ---------------- luminosité d'un point (entités sombres dans le noir) ---------------- */
  const _v = new THREE.Vector3();
  function brightAt(x, y, z, dist) {
    let b = S.T.ambientI * 0.55 + (S.map.outdoor ? 0.15 : 0);
    for (const pl of S.pool) if (pl.intensity > 0.1) { const d = Math.hypot(pl.position.x - x, (pl.position.y - y - 1.5) * 0.7, pl.position.z - z); if (d < 9) b += (1 - d / 9) * 0.8 * pl.intensity; }
    if (S.spot.intensity > 0.3) {
      const cam = S.cam; cam.getWorldDirection(_v);
      const dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz) || 1;
      const c = (dx * _v.x + dz * _v.z) / (d * (Math.hypot(_v.x, _v.z) || 1));
      if (c > 0.86 && d < 30) b += (1 - d / 30) * 1.2 * BR.clamp((c - 0.86) / 0.08, 0, 1);
    }
    for (const f of S.flares) { const d = Math.hypot(f.x - x, f.z - z); if (d < 12) b += (1 - d / 12) * 1.1; }
    if (S.alarm) b += 0.12;
    if (dist < 3) b += 0.3;
    return BR.clamp(b, 0.28, 1.3);
  }

  /* ---------------- caméra ---------------- */
  function spectating() { return S.me.dead || S.me.escaped; }
  function pickSpec() {
    const list = S.order.map(id => S.players.get(id)).filter(p => p && p !== S.me && !p.dead && !p.escaped);
    S.spec = list.length ? (list.find(p => p.id === S.spec) || list[0]).id : null;
    if (S.spec) S.specYaw = S.players.get(S.spec).yaw;
  }
  function cycleSpec(dir) {
    const list = S.order.map(id => S.players.get(id)).filter(p => p && p !== S.me && !p.dead && !p.escaped);
    if (!list.length) { S.spec = null; return; }
    const i = list.findIndex(p => p.id === S.spec);
    S.spec = list[(i + dir + list.length) % list.length].id; S.specYaw = S.players.get(S.spec).yaw;
    Au.ui('click');
  }
  // caméra par-dessus l'épaule : décalée à droite, plus haute et plus loin, sans traverser les murs
  function thirdPerson(tx, ty, tz, yaw, pitch, maxD) {
    const bx = Math.sin(yaw), bz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let sh = 0;
    while (sh < 0.65 && Wd.los(S.map, tx, ty, tz, tx + rx * (sh + 0.25), ty, tz + rz * (sh + 0.25))) sh += 0.05;
    const sx = tx + rx * sh, sz = tz + rz * sh, lift = 0.4 - Math.sin(pitch) * 1.1;
    let d = 0.3;
    while (d < maxD && Wd.los(S.map, sx, ty, sz, sx + bx * (d + 0.25), ty + lift * (d / maxD), sz + bz * (d + 0.25))) d += 0.1;
    d = Math.max(0.3, d - 0.15);
    S.cam.position.set(sx + bx * d, ty + lift * (d / maxD), sz + bz * d);
    S.cam.rotation.set(pitch * 0.85 - 0.1, yaw, 0);
  }
  function updateCamera(dt) {
    const me = S.me, cam = S.cam;
    let yaw = me.yaw, fp = false, bx = 0, by = 0, bz = 0;
    const sh = BR.settings.shake == null ? 1 : +BR.settings.shake;
    if (spectating()) {
      const t = S.spec ? S.players.get(S.spec) : null;
      if (t) { thirdPerson(t.x, t.y + (t.down ? 0.7 : 1.5), t.z, S.specYaw, -0.15, 3.6); yaw = S.specYaw; }
      else { cam.position.set(S.exitObj.x, 3.6, S.exitObj.z); cam.rotation.set(-1.2, S.time * 0.1, 0); yaw = S.time * 0.1; }
    } else {
      const targetEye = me.down ? 0.42 : S.slide > 0 ? 0.85 : me.crouch ? P.eyeCrouch : P.eye;
      S.eye += (targetEye - S.eye) * Math.min(1, dt * 12);
      const rollT = me.down ? 0.25 : S.slide > 0 ? 0.06 : 0;
      S.bc.roll = (S.bc.roll || 0) + (rollT - (S.bc.roll || 0)) * Math.min(1, dt * 8);
      if (S.camMode === 'tp') thirdPerson(me.x, me.y + S.eye, me.z, me.yaw, me.pitch, 4.4);
      else {
        // caméra corporelle : pas, respiration, inertie de la tête, à-coups, tremblements (voir bodyCam)
        fp = true; bx = me.x; by = me.y + S.eye; bz = me.z;
        const o = bodyCam(dt, sh);
        cam.position.set(bx + Math.cos(me.yaw) * o.x, by + o.y, bz - Math.sin(me.yaw) * o.x);
        // premier contact : la caméra est attirée un instant vers l'entité
        const fl = fearLook(dt);
        if (fl) { o.ry += fl.ry; o.rx += fl.rx; }
        cam.rotation.set(BR.clamp(me.pitch + o.rx, -1.5, 1.5), me.yaw + o.ry, S.bc.roll + o.rz);
      }
    }
    S.camYaw = yaw;
    if (!fp) {
      // vue 3e personne / spectateur : seulement les secousses ponctuelles (bruit cohérent, pas du hasard pur)
      bx = cam.position.x; by = cam.position.y; bz = cam.position.z;
      if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt * 1.6); const k = S.shake * S.shake * sh, t = S.time; cam.position.x += pn1(t * 23 + 1) * 0.045 * k; cam.position.y += pn1(t * 27 + 5) * 0.045 * k; cam.rotation.z += pn1(t * 19 + 9) * 0.03 * k; }
    }
    // anti « vue à travers les murs » : le tremblement ne doit jamais faire entrer l'œil dans un mur ou une dalle
    if (S.camMode !== 'tp' && !spectating()) {
      const Wd2 = BR.World;
      if (Wd2.blocked(S.map, cam.position.x, cam.position.z, me.y, 0.22)) { cam.position.x = bx; cam.position.z = bz; }
      else if (Math.abs(cam.position.x - bx) + Math.abs(cam.position.z - bz) > 0.001) {
        // garde une marge de 22 cm avec les murs : on réduit le décalage si besoin
        if (Wd2.blocked(S.map, bx, bz, me.y, 0.22)) { cam.position.x = bx; cam.position.z = bz; }
      }
      if (cam.position.y > by + 0.08) cam.position.y = by + 0.08;   // jamais vers le haut dans la dalle
    }
    const spd = Math.hypot(me.vx, me.vz);
    // objectif bodycam un peu plus large (la distorsion en barillet resserre le centre)
    const F = S.fear, zoom = F ? F.zoom + F.punch * 7 : 0;     // léger zoom (premier contact) et sursaut (elle se dévoile)
    if (F) F.punch = Math.max(0, F.punch - dt * 2.5);
    const fov = BR.settings.fov + (lensOn() ? 8 : 0) + (spd > P.walk + 1 ? Math.min(14, (spd - P.walk) * 1.8) : 0) + S.prox * 4 * (0.6 + 0.4 * Math.sin(S.time * 9)) - zoom;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix(); }
  }
  function panOf(x, z) {
    const dx = x - S.cam.position.x, dz = z - S.cam.position.z, d = Math.hypot(dx, dz) || 1;
    return BR.clamp((dx * Math.cos(S.camYaw) - dz * Math.sin(S.camYaw)) / d, -1, 1);
  }

  /* ---------------- sons des entités (cris en boucle, spatialisés), tension ---------------- */
  function updateAudio(dt) {
    const cam = S.cam.position;
    S.cam.getWorldDirection(_v);
    Au.listener(cam, _v);
    let near = 99, chase = 99, fearT = 0, lurk = 0;
    S.views.views.forEach((v, id) => {
      let vo = S.voices.get(id);
      if (!vo) { vo = { h: Au.botVoice(v.sp != null ? v.sp : 0), lastAmp: 0 }; S.voices.set(id, vo); }
      const d = Math.hypot(v.x - cam.x, v.y + 1.4 - cam.y, v.z - cam.z);
      // entité silencieuse (traque, coup d'œil) : aucun cri, ni musique, ni tremblement… seulement un grondement très grave si elle est tout près
      const silent = !!E.SILENT[v.st];
      if (silent) { if (v.st === 'stalk') lurk = Math.max(lurk, BR.clamp(1 - (d - 2) / 12, 0, 1)); }
      else { near = Math.min(near, d); if (v.st === 'chase') chase = Math.min(chase, d); }
      // peur / tremblement comme dans l'ancien jeu : monstre en chasse ressenti jusqu'à ~33 m, monstre qui rôde jusqu'à ~16 m
      const fe = silent ? 0 : v.st === 'chase' ? Math.pow(BR.clamp(1 - (d - 1.5) / 32, 0, 1), 1.35) : Math.pow(BR.clamp(1 - (d - 1.5) / 15, 0, 1), 1.8) * 0.55;
      if (fe > fearT) fearT = fe;
      if (vo.h) {
        const g = silent ? 0 : v.st === 'chase' ? 1.0 : v.st === 'stun' ? 0.35 : 0.65;
        vo.h.set(v.x, v.y + 1.4, v.z, g);
        vo.lastAmp = d < 30 ? vo.h.amp() : 0;
      }
    });
    for (const [id, vo] of S.voices) if (!S.views.views.has(id)) { if (vo.h) vo.h.stop(); S.voices.delete(id); }
    const me = S.me;
    const dng = me.dead || me.escaped ? 0 : Math.max(BR.clamp(1 - (chase - 3) / 22, 0, 1), BR.clamp(1 - (near - 3) / 14, 0, 1) * 0.5);
    S.danger += (dng - S.danger) * Math.min(1, dt * 3);
    const px = me.dead || me.escaped ? 0 : fearT;
    S.prox += (px - S.prox) * Math.min(1, dt * (px > S.prox ? 5 : 1.2));
    Au.setTension(Math.max(S.danger * 0.6, S.alarm ? 0.3 : 0));
    S.heart = (S.heart || 0) - dt;
    if (S.danger > 0.35 && S.heart <= 0) { S.heart = 1.0 - S.danger * 0.55; Au.thump(0.25 + S.danger * 0.6); }
    // musique de tension en couches : monte avec la proximité du monstre le plus proche (calme → inquiétant → poursuite)
    const alive = !me.dead && !me.escaped;
    const tg = alive ? Math.max(fearT, BR.clamp(1 - (near - 4) / 40, 0, 1) * 0.35) : 0;
    S.tens += (tg - S.tens) * Math.min(1, dt * (tg > S.tens ? 1.6 : 0.45));
    Au.music(S.tens, alive && chase < 45, S.alarm);
    // respiration : s'accélère avec l'essoufflement et la peur (inspiration / expiration)
    const brK = alive ? Math.max(S.exert, S.prox * 0.9) : 0, rate = 0.22 + 0.55 * S.exert + 0.4 * S.prox;
    const ph0 = S.breathPh; S.breathPh += dt * 6.2832 * rate;
    Au.presence(alive ? lurk * 0.85 : 0);
    if (alive && brK > 0.12 && !me.down && !(S.fear && S.fear.hide)) {     // caché : souffle retenu
      const half = 0.5 / rate;
      if (Math.floor(ph0 / Math.PI) !== Math.floor(S.breathPh / Math.PI)) Au.breath(Math.floor(S.breathPh / Math.PI) % 2 === 0, brK, half * 0.85);
    }
    fxAudio(dt);
    // ambiance anxiogène : les évènements sonores aléatoires (cris lointains, murmures, faux pas, objets qui tombent…) sont dosés par fearSignals()
    // vignette sombre/rouge
    if (!vig) { vig = document.createElement('div'); vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 38%,rgba(40,0,0,.55) 75%,rgba(0,0,0,.92) 100%)'; document.body.appendChild(vig); }
    vig.style.opacity = (me.dead || me.escaped) ? 0 : Math.min(1, (lensOn() ? 0.05 : 0.18) + S.danger * 0.45 + S.prox * 0.45).toFixed(2);
    // la musique baisse quand une entité est proche (on entend son cri)
    const mu = MUSIC[S.def.kind] || MUSIC.backrooms;
    if (!S.alarm && mu[0]) Au.trackLevel('music', mu[1] * (1 - S.danger * 0.7));
  }

  /* =====================================================================
     AMBIANCE : caméra corporelle, lampe défaillante, sang, météo, surfaces, sons d'environnement
     ===================================================================== */
  // bruit de gradient 1D (Perlin) + somme d'octaves : des mouvements organiques, jamais du hasard pur image par image
  const GRAD = new Float32Array(512);
  { let s = 1234567; for (let i = 0; i < 512; i++) { s = (s * 16807) % 2147483647; GRAD[i] = (s / 2147483647) * 2 - 1; } }
  function pn1(x) { const i = Math.floor(x), f = x - i, a = GRAD[i & 511] * f, b = GRAD[(i + 1) & 511] * (f - 1), u = f * f * f * (f * (f * 6 - 15) + 10); return (a + (b - a) * u) * 2; }
  function fbm(x, seed, oct) { let v = 0, amp = 1, fr = 1, tot = 0; for (let o = 0; o < (oct || 3); o++) { v += pn1(x * fr + seed * 17.13 + o * 31.7) * amp; tot += amp; amp *= 0.5; fr *= 2.03; } return v / tot; }
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function spring(o, target, dt, k, c) { o.vel += ((target - o.v) * k - o.vel * c) * dt; o.v += o.vel * dt; }

  /* ---------- caméra corporelle : renvoie les décalages à ajouter à la vue (position en mètres, rotations en radians) ---------- */
  function bodyCam(dt, sh) {
    const me = S.me, B = S.bc, st = BR.settings, t = S.time;
    const o = { x: 0, y: 0, rx: 0, ry: 0, rz: 0 };
    const walking = me.ground && me.speed > 0.6 && S.slide <= 0 && !(S.dashCam > 0);
    // glissade du dash : la caméra descend un peu et pique légèrement vers l'avant, sans balancement (transition douce)
    B.gl = (B.gl || 0) + (((S.dashCam > 0 && me.ground) ? 1 : 0) - (B.gl || 0)) * Math.min(1, dt * 12);
    if (B.gl > 0.001) { o.y -= 0.07 * B.gl; o.rx -= 0.012 * B.gl; }
    const want = walking ? BR.clamp(me.speed / P.walk, 0.3, 1.5) : 0;
    B.amp += (want - B.amp) * Math.min(1, dt * (want > B.amp ? 4 : 6));
    B.run += ((me.sprint && walking ? 1 : 0) - B.run) * Math.min(1, dt * 3);
    const a = B.amp, ph = S.gait;
    if (st.bob) {
      // marche : creux brusque à chaque appui du talon, remontée arrondie, balancement d'un pied sur l'autre (période = 2 pas)
      const s = Math.abs(Math.sin(ph)), dip = Math.pow(1 - s, 2.5);
      o.y += a * ((-0.022 - 0.022 * B.run) * dip + 0.008 * s);
      o.x += Math.cos(ph) * (0.014 + 0.01 * B.run) * a;
      o.rz += Math.cos(ph) * (0.0045 + 0.004 * B.run) * a;
      o.rx += -dip * (0.004 + 0.007 * B.run) * a;          // la caméra « pique » un peu à chaque appui
      o.ry += Math.sin(ph) * 0.0025 * a;
      o.rx += fbm(t * 2.3, 1) * 0.0035 * a * (1 + B.run * 1.5);
      o.rz += fbm(t * 2.7, 2) * 0.004 * a * (1 + B.run * 1.5);
      // respiration (surtout visible à l'arrêt), plus ample quand on est essoufflé ou qu'on a peur
      const idle = BR.clamp(1 - a * 1.5, 0, 1), br = Math.sin(S.breathPh);
      const ba = idle * (0.0035 + 0.009 * S.exert + 0.005 * S.prox);
      o.y += br * ba; o.rx += br * ba * 0.45;
      // une caméra portée n'est jamais parfaitement immobile
      o.rx += fbm(t * 0.33, 3) * 0.003; o.ry += fbm(t * 0.29, 4) * 0.0035; o.rz += fbm(t * 0.41, 5) * 0.0025;
    }
    // inertie de la tête : léger retard sur les rotations, inclinaison dans les virages (plus forte en courant)
    const dy = BR.angDiff(B.lastYaw, me.yaw), dp = me.pitch - B.lastPitch; B.lastYaw = me.yaw; B.lastPitch = me.pitch;
    const idt = 1 / Math.max(dt, 0.004), yr = BR.clamp(dy * idt, -9, 9), pr = BR.clamp(dp * idt, -9, 9);
    spring(B.ly, -yr * 0.0045, dt, 110, 16); spring(B.lp, -pr * 0.004, dt, 110, 16);
    spring(B.lr, yr * (0.004 + 0.01 * Math.min(1, me.speed / P.sprint)), dt, 45, 11);
    o.ry += BR.clamp(B.ly.v, -0.03, 0.03); o.rx += BR.clamp(B.lp.v, -0.025, 0.025); o.rz += BR.clamp(B.lr.v, -0.05, 0.05);
    // à-coups (atterrissage, saut, dash) : ressort vertical amorti
    spring(B.land, 0, dt, 130, 12); B.land.v = BR.clamp(B.land.v, -0.22, 0.12);
    const lk = st.bob ? 1 : 0.4;
    o.y += B.land.v * lk; o.rx += B.land.v * 0.3 * lk;
    // secousses ponctuelles (chute, alarme, frayeur)
    if (S.shake > 0) {
      S.shake = Math.max(0, S.shake - dt * 1.6); const k = S.shake * S.shake * sh;
      o.x += pn1(t * 23 + 1) * 0.04 * k; o.y += pn1(t * 27 + 5) * 0.04 * k; o.rz += pn1(t * 19 + 9) * 0.035 * k; o.rx += pn1(t * 21 + 2) * 0.025 * k; o.ry += pn1(t * 17 + 4) * 0.02 * k;
    }
    // peur : tremblement en 3 bandes (sursauts lents, tremblement, frisson rapide), léger de loin, fort au contact
    const fk = Math.pow(Math.min(1, S.prox * 1.1), 1.5) * sh;
    if (fk > 0.001) {
      o.rx += (fbm(t * 1.3, 11) * 0.5 + fbm(t * 6.1, 12) * 0.32 + pn1(t * 17.3 + 3) * 0.18) * 0.045 * fk;
      o.ry += (fbm(t * 1.1, 13) * 0.5 + fbm(t * 5.6, 14) * 0.32 + pn1(t * 19.1 + 7) * 0.18) * 0.035 * fk;
      o.rz += (fbm(t * 0.9, 15) * 0.6 + fbm(t * 7.2, 16) * 0.4) * 0.05 * fk;
      o.x += fbm(t * 4.2, 17) * 0.05 * fk; o.y += fbm(t * 4.7, 18) * 0.04 * fk;
    }
    return o;
  }

  /* ---------- lampe torche défaillante ---------- */
  // renvoie le facteur d'intensité (0 = éteinte). Grésillement puis, parfois, extinction de 1 à 3 s et rallumage.
  function updateLamp(dt) {
    const L = S.lamp, me = S.me;
    const on = S.flashOn && !me.dead && !me.escaped && !spectating();
    if (!on) { L.flick = 0; L.dead = 0; L.k = 0; L.off = false; return 0; }
    L.cd -= dt;
    if (L.flick <= 0 && L.dead <= 0 && L.cd <= 0) {
      // risque par seconde : rare au calme, fréquent quand une entité est toute proche
      const h = 0.014 + 0.24 * S.prox * S.prox + (S.strobe ? 0.02 : 0);
      if (Math.random() < h * dt) { L.flick = 0.35 + Math.random() * (0.5 + S.prox); L.willDie = Math.random() < 0.35 + 0.4 * S.prox; Au.flashBuzz(L.flick); }
    }
    let k = 1;
    if (L.flick > 0) {
      L.flick -= dt; L.st -= dt;
      if (L.st <= 0) { L.st = 0.02 + Math.random() * 0.08; L.cur = Math.random() < 0.55 ? 0.04 + Math.random() * 0.3 : 0.7 + Math.random() * 0.35; }
      k = L.cur;
      if (L.flick <= 0) { if (L.willDie) { L.dead = 1 + Math.random() * 2; Au.flashClick(false); } else L.cd = 3 + Math.random() * 5; }
    } else if (L.dead > 0) {
      L.dead -= dt; k = 0;
      if (L.dead <= 0) { L.flick = 0.2 + Math.random() * 0.3; L.willDie = false; Au.flashClick(true); Au.flashBuzz(0.3); }
    }
    L.k = k; L.off = L.dead > 0;
    return k;
  }

  /* ---------- surfaces (bruit des pas) ---------- */
  const SURF_RX = [[/carpet|moquette|rug|tapis|rubber|caoutch/i, 'carpet'], [/grass|herbe|lawn|gazon|leaf|feuill|moss|mousse|sand|sable/i, 'grass'], [/mud|boue|dirt|terre(?!cotta)|trench|tranch|earth/i, 'mud'],
    [/gravel|gravier|ballast|rubble|gravat/i, 'gravel'], [/grate|metal|steel|escal|grille|tole|iron/i, 'metal'], [/wood|parquet|plank|planch|lane|piste|bois|deckW/i, 'wood'],
    [/tile|carrel|pool|faience|toilet|terracotta|marble|marbre/i, 'tile']];
  /* ---------- eau (carte Piscine : m.wl = hauteur de la surface au-dessus de chaque nœud, −1 sans eau) ---------- */
  function waterLevel(x, y, z) { const m = S.map; if (!m.wl) return -1; const n = Wd.nodeAt(m, x, y, z); return n < 0 ? -1 : m.wl[n]; }
  // { lv : surface, d : profondeur aux pieds, deep : assez profond pour nager } ou null hors de l'eau
  function waterState(p) {
    const lv = waterLevel(p.x, p.y + 0.3, p.z); if (lv < 0) return null;
    const d = lv - p.y; if (d <= 0.01) return null;
    const bottom = Wd.support(S.map, p.x, p.z, p.y + 0.05, R_PL, 0.05);
    return { lv, d, deep: lv - bottom > 1.7 };
  }
  // rampe « toboggan » sous les pieds
  function slideUnder(p) {
    const m = S.map, cx = Math.floor(p.x / C), cy = Math.floor(p.z / C); if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return null;
    const i = cy * m.W + cx;
    for (let f = 0; f < m.F; f++) { if (m.t[f][i] !== Wd.RAMP) continue; const r = m.ramps[m.rampAt[f][i]]; if (r && r.style === 'slide' && Math.abs(Wd.rampH(r, p.x, p.z) - p.y) < 0.35) return r; }
    return null;
  }
  // sous l'eau : brouillard bleu-vert, sons étouffés, léger roulis de la caméra
  const UW_FOG = new THREE.Color(0x1d6a77);
  function waterView(dt) {
    const cp = S.cam.position, lv = waterLevel(cp.x, cp.y, cp.z), under = lv > 0 && cp.y < lv - 0.02;
    const k0 = S.uwK || 0, k = BR.clamp(k0 + (under ? dt * 7 : -dt * 5), 0, 1);
    if (!S.fogBase) S.fogBase = { c: S.scene.fog.color.clone(), d: S.scene.fog.density };
    if (k > 0 || k0 > 0) { S.scene.fog.color.copy(S.fogBase.c).lerp(UW_FOG, k); S.scene.fog.density = S.fogBase.d + (0.1 - S.fogBase.d) * k; }
    if (under !== !!S.under) {
      S.under = under; Au.underwater(under);
      // le voile de mi-profondeur des bassins ne sert que vu d'en haut : sous l'eau, on le cache
      if (!S.deepVeil) { const vm = S.T.mats && S.T.mats.pdeep ? S.T.mat('pdeep') : null; S.deepVeil = []; if (vm) S.built.group.traverse(o => { if (o.isMesh && o.material === vm) S.deepVeil.push(o); }); }
      S.deepVeil.forEach(o => { o.visible = !under; });
    }
    if (k > 0) S.cam.rotation.z += Math.sin(S.time * 1.6) * 0.012 * k;
    S.uwK = k;
  }
  function surfAt(x, y, z) {
    const m = S.map, cx = Math.floor(x / C), cy = Math.floor(z / C);
    if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return 'concrete';
    if (m.wl && waterLevel(x, y + 0.3, z) - y > 0.02) return 'water';
    const f = BR.clamp(Math.round(y / SH), 0, m.F - 1), i = cy * m.W + cx, t = m.t[f][i], tx = S.T.tex || {};
    if (m.propAt[f][i] >= 0 && y - f * SH > 0.35) return 'metal';          // debout sur un objet (voiture, comptoir…)
    const spec = t === Wd.RAMP ? tx.r : (tx.floor || {})[m.zone[f][i]] || (tx.floor || {})[0];
    if (spec && spec.surf) return spec.surf;                                // une carte peut préciser sa surface : { t: '…', surf: 'mud' }
    const key = typeof spec === 'string' ? spec : spec ? String(spec.t || spec.facade || '') : '';
    if (S.surfCache[key]) return S.surfCache[key];
    let s = 'concrete'; for (const [rx, v] of SURF_RX) if (rx.test(key)) { s = v; break; }
    return (S.surfCache[key] = s);
  }
  // sol mouillé sous la pluie (seulement à ciel ouvert)
  function wetAt(p) {
    const W = S.wx; if (!W || W.wet < 0.05) return 0;
    return roofed(p.x, p.y + 0.5, p.z) ? 0 : W.wet;
  }
  // abrité de la pluie ? (même carte des hauteurs que les gouttes : toits, dalles, pièces intérieures)
  function roofed(x, y, z) {
    const W = S.wx; if (!W || !W.hm) return true;
    const m = S.map, cx = Math.floor(x / Wd.C), cy = Math.floor(z / Wd.C);
    if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return false;
    return y < W.hm[cy * m.W + cx] - 0.05;
  }

  /* ---------- sang au sol (visible par tous : déclenché par les évènements « à terre » / « mort ») ---------- */
  function blob(g, x, y, r, rnd, n) {
    n = n || 26; g.beginPath();
    const ph = rnd() * 6.283, ph2 = rnd() * 6.283;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * 6.283, k = 1 + 0.16 * Math.sin(a * 3 + ph) + 0.08 * Math.sin(a * 7 + ph2) + (rnd() - 0.5) * 0.08;
      const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.fill();
  }
  let bloodTx = null;
  function bloodTextures() {
    if (bloodTx && S.texs.includes(bloodTx[0])) return bloodTx;
    const mkC = draw => { const c = document.createElement('canvas'); c.width = c.height = 512; draw(c.getContext('2d')); const t = canvasTex(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
    const rnd = BR.rngFrom(9173);
    const shade = g => {
      // le sang frais est presque noir au centre et rouge vif sur les bords minces
      g.globalCompositeOperation = 'source-atop';
      const gr = g.createRadialGradient(256, 256, 10, 256, 256, 250);
      gr.addColorStop(0, 'rgba(20,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(45,0,2,0.35)'); gr.addColorStop(1, 'rgba(150,12,14,0.55)');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '15,0,0' : '120,8,10'},${0.05 + rnd() * 0.1})`; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 10 + rnd() * 50, 0, 6.283); g.fill(); }
      g.globalCompositeOperation = 'source-over';
    };
    const pool = mkC(g => {
      g.fillStyle = '#6a060a';
      for (let i = 0; i < 15; i++) { const a = rnd() * 6.283, d = Math.pow(rnd(), 0.7) * 95; blob(g, 256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 55 + rnd() * 75, rnd); }
      for (let i = 0; i < 8; i++) { const a = rnd() * 6.283, d = 150 + rnd() * 50; blob(g, 256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 14 + rnd() * 26, rnd, 14); }   // langues qui s'écoulent
      shade(g);
    });
    const splat = mkC(g => {
      g.fillStyle = '#720709'; g.strokeStyle = '#720709'; g.lineCap = 'round';
      blob(g, 256, 256, 52, rnd);
      for (let i = 0; i < 16; i++) { const a = rnd() * 6.283, d0 = 40, d1 = 110 + rnd() * 120; g.lineWidth = 2 + rnd() * 5; g.beginPath(); g.moveTo(256 + Math.cos(a) * d0, 256 + Math.sin(a) * d0); g.lineTo(256 + Math.cos(a) * d1, 256 + Math.sin(a) * d1); g.stroke(); }
      for (let i = 0; i < 90; i++) {
        const a = rnd() * 6.283, d = 45 + Math.pow(rnd(), 0.8) * 200, r = 1.5 + rnd() * 10 * (1 - d / 270);
        g.save(); g.translate(256 + Math.cos(a) * d, 256 + Math.sin(a) * d); g.rotate(a); g.beginPath(); g.ellipse(0, 0, r * (1.4 + rnd() * 2.6), r, 0, 0, 6.283); g.fill(); g.restore();
      }
      shade(g);
    });
    return (bloodTx = [pool, splat]);
  }
  function addBlood(x, y, z, big, seed) {
    if (!S || !isFinite(x) || !isFinite(z)) return;
    const tx = bloodTextures(), rnd = BR.rngFrom((seed >>> 0) || 1);
    let fy = Wd.support(S.map, x, z, (y || 0) + 0.4, 0.2); if (!isFinite(fy)) fy = y || 0;
    // la flaque ne déborde ni au-dessus du vide ni sur une marche : rayon limité par le sol plat autour
    // (un mur ne limite pas : la flaque passe dessous et reste cachée ; un trou, une marche ou un objet, si)
    let R0 = big ? 2.5 : 1.0;
    const mp = S.map, fl = BR.clamp(Math.round(fy / SH), 0, mp.F - 1);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4; let d = 0.3;
      while (d < R0) {
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, cx = Math.floor(px / C), cy = Math.floor(pz / C);
        if (cx < 0 || cy < 0 || cx >= mp.W || cy >= mp.H) break;
        if (mp.t[fl][cy * mp.W + cx] !== Wd.WALL) { const s2 = Wd.support(mp, px, pz, fy + 0.3, 0.05); if (!(Math.abs(s2 - fy) < 0.12)) break; }
        d += 0.15;
      }
      R0 = Math.min(R0, Math.max(0.6, d + 0.2));
    }
    if (!S.bloodGeo) { S.bloodGeo = new THREE.PlaneGeometry(1, 1); S.bloodGeo.rotateX(-Math.PI / 2); }
    const bloodGeo = S.bloodGeo;
    const n = S.blood.length;
    const mk = (map, lift) => {
      const m = new THREE.Mesh(bloodGeo, new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.16, metalness: 0.05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
      m.position.set(x, fy + 0.012 + lift + (n % 6) * 0.0015, z); m.rotation.y = rnd() * 6.283; m.renderOrder = 1; S.scene.add(m); return m;
    };
    const sp = mk(tx[1], 0); sp.scale.setScalar(R0 * (big ? 2.1 : 1.8));
    const po = mk(tx[0], 0.002); po.scale.setScalar(0.05);
    S.blood.push({ sp, po, R: R0 * 2, t: 0, grow: big ? 9 : 3 });
    while (S.blood.length > 10) { const o = S.blood.shift(); [o.sp, o.po].forEach(m => { S.scene.remove(m); m.material.dispose(); }); }
  }
  function updateBlood(dt) {
    for (const b of S.blood) {
      if (b.t > b.grow * 4) continue;
      b.t += dt;
      const k = 1 - Math.exp(-b.t / (b.grow * 0.5));       // s'étend vite puis de plus en plus lentement
      b.po.scale.setScalar(Math.max(0.05, b.R * k));
    }
  }

  /* ---------- météo des cartes extérieures : clair / pluie / orage (l'hôte décide, les autres suivent) ---------- */
  const WXN = ['clear', 'rain', 'storm'];
  const RW = 16;   // demi-largeur de la zone de pluie autour de la caméra (m)
  function wxAuto() { const r = BR.rngFrom((((S.o.seed >>> 0) ^ 0x6d2b79f5) >>> 0) || 3)(); return r < 0.4 ? 0 : r < 0.72 ? 1 : 2; }
  function initWeather() {
    S.wx = null;
    if (!S.map.outdoor && !S.T.outdoor) return;
    // hauteur où s'arrête la pluie dans chaque cellule (toit, dalle, sommet de mur, sol)
    const m = S.map, hm = new Float32Array(m.WH);
    for (let i = 0; i < m.WH; i++) {
      let h = 0;
      for (let f = m.F - 1; f >= 0; f--) { const t = m.t[f][i]; if (t === Wd.WALL) { h = (f + 1) * SH; break; } if (t === Wd.FLOOR || t === Wd.RAMP) { h = m.indoor[f][i] ? (f + 1) * SH : f * SH + (t === Wd.RAMP ? SH * 0.5 : 0); break; } }   // pièce intérieure sous le dernier étage : pas de pluie dedans
      hm[i] = h;
    }
    S.wx = { code: -1, k: 0, wet: 0, wetApplied: -1, wetT: 0, flash: 0, pulses: [], ft: 9, boltT: 5 + Math.random() * 6, hm, inside: 0, cover: 0, fdir: new THREE.Vector3(0, 1, 0),
      base: { hemi: S.hemi.intensity, amb: S.ambient.intensity, fog: S.scene.fog.color.clone(), fogD: S.scene.fog.density } };
    // lumière de l'éclair : directionnelle, créée dès le départ (éteinte) pour ne pas recompiler les matériaux pendant la partie
    S.wx.dl = new THREE.DirectionalLight(0xd4dcff, 0); S.wx.dl.position.set(0, 1, 0); S.scene.add(S.wx.dl, S.wx.dl.target);
    let code = 0;
    if (S.isHost) { const w = BR.settings.weather || 'auto'; code = w === 'auto' ? wxAuto() : Math.max(0, WXN.indexOf(w)); }
    setWeather(code, true);
  }
  function setWeather(code, instant) {
    const W = S && S.wx; if (!W) return;
    code = BR.clamp(code | 0, 0, 2); if (code === W.code) return;
    W.code = code;
    if (instant || S.time < 3) { W.k = code === 2 ? 1 : code === 1 ? 0.65 : 0; W.wet = code ? 0.9 : 0; W.cover = code ? 1 : 0; }
    if (code && !W.rain) buildRain();
    if (code && !W.clouds && S.skyDome) buildClouds();
  }
  Gm.setWeather = function (name) {
    if (!S || !S.wx || !S.isHost) return false;
    setWeather(name === 'auto' ? wxAuto() : Math.max(0, WXN.indexOf(name)));
    return true;
  };
  Gm.weather = () => (S && S.wx ? WXN[S.wx.code] : null);
  function groundAt(x, z) { const m = S.map, cx = Math.floor(x / C), cy = Math.floor(z / C); if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return 0; return S.wx.hm[cy * m.W + cx]; }
  function buildRain() {
    const W = S.wx, q = BR.settings.quality, N = q === 'low' ? 700 : q === 'med' ? 1500 : 2600;
    const pos = new Float32Array(N * 6), geo = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3); attr.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('position', attr);
    const mat = new THREE.LineBasicMaterial({ color: 0xaab6c8, transparent: true, opacity: 0, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.renderOrder = 3; S.scene.add(lines);
    W.rain = { lines, attr, pos, mat, N, D: { x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), v: new Float32Array(N), g: new Float32Array(N) }, sp: null };
    const c = S.cam.position;
    for (let i = 0; i < N; i++) dropSpawn(i, c, true);
    if (q !== 'low') {
      // éclaboussures : petits points qui ne vivent qu'un dixième de seconde
      const n = 160, sp = new Float32Array(n * 3).fill(-999), g2 = new THREE.BufferGeometry(), a2 = new THREE.BufferAttribute(sp, 3); a2.setUsage(THREE.DynamicDrawUsage); g2.setAttribute('position', a2);
      const c2 = document.createElement('canvas'); c2.width = c2.height = 32; const gg = c2.getContext('2d');
      const gr = gg.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 32, 32);
      const pm = new THREE.PointsMaterial({ size: 0.11, map: canvasTex(c2), color: 0xc4cedb, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true });
      const pts = new THREE.Points(g2, pm); pts.frustumCulled = false; S.scene.add(pts);
      W.rain.sp = { pts, a2, sp, life: new Float32Array(n), n, i: 0 };
    }
  }
  function dropSpawn(i, c, any) {
    const D = S.wx.rain.D, x = c.x + (Math.random() * 2 - 1) * RW, z = c.z + (Math.random() * 2 - 1) * RW;
    D.x[i] = x; D.z[i] = z; D.g[i] = groundAt(x, z); D.v[i] = 10 + Math.random() * 4;
    const top = Math.max(c.y + 12, D.g[i] + 3);
    D.y[i] = any ? D.g[i] + Math.random() * (top - D.g[i]) : top + Math.random() * 3;
  }
  function updateRain(dt) {
    const W = S.wx, Rn = W.rain; if (!Rn) return;
    const c = S.cam.position, D = Rn.D, pos = Rn.pos, n = Math.floor(Rn.N * BR.clamp(W.k, 0, 1));
    const wx = W.code === 2 ? 2.6 : 0.9, wz = W.code === 2 ? 1.2 : 0.4, len = 0.55, feet = c.y - S.eye, sp = Rn.sp;
    for (let i = 0; i < Rn.N; i++) {
      const j = i * 6;
      if (i >= n) { pos[j + 1] = pos[j + 4] = -999; continue; }
      let x = D.x[i] + wx * dt, z = D.z[i] + wz * dt, moved = false;
      // la zone de pluie suit la caméra : les gouttes qui sortent d'un côté reviennent de l'autre
      if (x - c.x > RW) { x -= 2 * RW; moved = true; } else if (c.x - x > RW) { x += 2 * RW; moved = true; }
      if (z - c.z > RW) { z -= 2 * RW; moved = true; } else if (c.z - z > RW) { z += 2 * RW; moved = true; }
      D.x[i] = x; D.z[i] = z; D.y[i] -= D.v[i] * dt;
      if (moved) D.g[i] = groundAt(x, z);
      if (D.y[i] < D.g[i]) {
        if (sp && Math.abs(D.g[i] - feet) < 2.5 && Math.abs(x - c.x) < 11 && Math.abs(z - c.z) < 11 && Math.random() < 0.5) {
          const k = sp.i; sp.i = (sp.i + 1) % sp.n; sp.sp[k * 3] = x; sp.sp[k * 3 + 1] = D.g[i] + 0.03; sp.sp[k * 3 + 2] = z; sp.life[k] = 0.1;
        }
        dropSpawn(i, c, false);
      } else if (D.y[i] > c.y + 24) dropSpawn(i, c, false);
      pos[j] = D.x[i]; pos[j + 1] = D.y[i]; pos[j + 2] = D.z[i];
      pos[j + 3] = D.x[i] - wx * 0.05; pos[j + 4] = D.y[i] + len; pos[j + 5] = D.z[i] - wz * 0.05;
    }
    Rn.attr.needsUpdate = true;
    Rn.mat.opacity = W.k > 0.01 ? Math.min(0.9, 0.2 + 0.16 * W.k + W.flash * 0.4) : 0;
    if (sp) {
      for (let k = 0; k < sp.n; k++) if (sp.life[k] > 0) { sp.life[k] -= dt; if (sp.life[k] <= 0) sp.sp[k * 3 + 1] = -999; }
      sp.a2.needsUpdate = true; sp.pts.material.opacity = 0.45 + W.flash * 0.4;
    }
  }
  // couche de nuages d'orage (cache les étoiles et la lune, s'illumine pendant les éclairs)
  const CLOUD_FS = `uniform float uCover, uFlash, uTime; uniform vec3 uDir; varying vec3 vP;
    float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main(){
      vec3 d = normalize(vP); float y = max(d.y, 0.02);
      vec2 uv = d.xz / (y + 0.15) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
      float n = vn(uv) * 0.5 + vn(uv * 2.1) * 0.25 + vn(uv * 4.3) * 0.15 + vn(uv * 8.7) * 0.1;
      float a = uCover * (0.84 + 0.16 * n) * smoothstep(-0.3, 0.04, d.y);
      vec3 col = mix(vec3(0.03, 0.035, 0.05), vec3(0.085, 0.095, 0.115), n);
      float glow = pow(max(dot(d, uDir), 0.0), 5.0);
      col += uFlash * vec3(0.72, 0.78, 1.0) * (0.3 + 0.7 * n) * (0.45 + 2.0 * glow);
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    }`;
  function buildClouds() {
    const W = S.wx;
    const U = { uCover: { value: W.cover }, uFlash: { value: 0 }, uTime: { value: 0 }, uDir: { value: W.fdir } };
    const mat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: CLOUD_FS });
    const m = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), mat); m.renderOrder = -9; m.frustumCulled = false;
    m.onBeforeRender = (r, sc, cam) => { m.position.copy(cam.position); };
    S.scene.add(m); W.clouds = { m, U };
  }
  // éclair : forme tirée de la graine (identique chez tous les joueurs), placé dans la direction de l'impact
  function showBolt(seed, dx, dz, dist, rnd) {
    const W = S.wx, c = S.cam.position;
    if (W.bolt) { S.scene.remove(W.bolt); W.bolt.geometry.dispose(); W.bolt.material.dispose(); W.bolt = null; }
    const D = Math.min(dist, 150), bx = c.x + dx * D, bz = c.z + dz * D, px = -dz, pz = dx;
    const v = [];
    const seg = (u0, y0, u1, y1, w) => {
      const du = u1 - u0, dy = y1 - y0, l = Math.hypot(du, dy) || 1, nu = (dy / l) * w * 0.5, ny = (-du / l) * w * 0.5;
      const P = (u, y) => [bx + px * u, y, bz + pz * u];
      const a = P(u0 + nu, y0 + ny), b = P(u0 - nu, y0 - ny), c2 = P(u1 + nu, y1 + ny), d2 = P(u1 - nu, y1 - ny);
      v.push(...a, ...b, ...c2, ...b, ...d2, ...c2);
    };
    const branch = (u, y, yEnd, w, depth) => {
      let cu = u, cy = y; const steps = Math.max(4, Math.round((y - yEnd) / 5));
      for (let s = 0; s < steps; s++) {
        const ny = cy - (y - yEnd) / steps * (0.7 + rnd() * 0.6), nu = cu + (rnd() - 0.5) * 9;
        seg(cu, cy, nu, Math.max(yEnd, ny), w);
        if (depth < 2 && rnd() < 0.22) branch(nu, ny, ny - 10 - rnd() * 25, w * 0.5, depth + 1);
        cu = nu; cy = Math.max(yEnd, ny);
      }
    };
    branch((rnd() - 0.5) * 20, 95, 0, D > 100 ? 1.1 : 0.7, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const mat = new THREE.MeshBasicMaterial({ color: 0xe6edff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    W.bolt = new THREE.Mesh(g, mat); W.bolt.frustumCulled = false; W.bolt.renderOrder = -8; S.scene.add(W.bolt);
    void seed;
  }
  function bolt(e) {
    const W = S && S.wx; if (!W) return;
    const c = S.cam.position, dx = (+e.x || 0) - c.x, dz = (+e.z || 0) - c.z, d = Math.hypot(dx, dz) || 1;
    const near = BR.clamp(1 - d / 1300, 0, 1), rnd = BR.rngFrom(((e.s >>> 0) || 7));
    const a0 = 0.25 + near * 0.9;
    W.pulses = [{ t: 0, a: a0 * 0.7 }, { t: 0.07 + rnd() * 0.05, a: a0 * 0.35 }, { t: 0.16 + rnd() * 0.12, a: a0 }];
    if (rnd() < 0.5) W.pulses.push({ t: 0.38 + rnd() * 0.15, a: a0 * 0.5 });
    W.ft = 0; W.fdir.set(dx / d, 0.35, dz / d).normalize();
    if (d < 2200) showBolt(e.s, dx / d, dz / d, d, rnd);
    const delay = Math.min(8, d / 343);                     // le tonnerre arrive après l'éclair (vitesse du son)
    Au.thunder(near, delay);
    if (near > 0.75) setTimeout(() => { if (S) S.shake = Math.max(S.shake, 0.2 + (near - 0.75) * 1.2); }, delay * 1000);
  }
  function applyWet(k) {
    const W = S.wx;
    if (BR.Tex.setWet) { try { BR.Tex.setWet(S.T, k); W.ext = true; return; } catch (e) { /* repli ci-dessous */ } }
    if (!W.mats) {
      // seuls les sols surtout à ciel ouvert deviennent brillants (pas l'intérieur des immeubles)
      W.mats = [];
      const m = S.map, tot = {}, exp = {}, used = new Set();
      for (let i = 0; i < m.WH; i++) for (let f = 0; f < m.F; f++) { if (m.t[f][i] !== Wd.FLOOR) continue; const z = m.zone[f][i]; tot[z] = (tot[z] || 0) + 1; if (Math.abs(W.hm[i] - f * SH) < 0.01) exp[z] = (exp[z] || 0) + 1; }
      S.built.group.traverse(o => { if (o.isMesh) used.add(o.material); });
      Object.keys(tot).filter(z => (exp[z] || 0) / tot[z] > 0.5).map(z => 'f' + z).concat(['e']).forEach(key => {
        let mt = null; try { mt = S.T.mat(key); } catch (e) { return; }
        if (mt && mt.isMeshStandardMaterial && used.has(mt)) W.mats.push({ m: mt, r: mt.roughness, c: mt.color.clone() });
      });
    }
    W.mats.forEach(o => { o.m.roughness = o.r * (1 - 0.62 * k); o.m.color.copy(o.c).multiplyScalar(1 - 0.25 * k); });
  }
  const FOG_FLASH = new THREE.Color(0x8c96aa);
  function updateWeather(dt) {
    const W = S.wx; if (!W) return;
    const tk = W.code === 2 ? 1 : W.code === 1 ? 0.65 : 0;
    W.k += (tk - W.k) * Math.min(1, dt * 0.25);
    W.cover += ((W.code ? 1 : 0) - W.cover) * Math.min(1, dt * 0.2);
    W.wet = BR.clamp(W.wet + (W.code ? dt / 25 : -dt / 70), 0, 1);
    W.wetT -= dt;
    if (W.wetT <= 0 && Math.abs(W.wet - W.wetApplied) > 0.02) { W.wetT = 0.5; W.wetApplied = W.wet; applyWet(W.wet); }
    // l'hôte déclenche les éclairs (orage : fréquents ; pluie : tonnerre lointain de temps en temps)
    if (S.isHost && W.code >= 1) {
      W.boltT -= dt;
      if (W.boltT <= 0) {
        const storm = W.code === 2;
        W.boltT = storm ? 6 + Math.random() * 14 : 25 + Math.random() * 35;
        const a = Math.random() * 6.283, d = storm ? 80 + Math.pow(Math.random(), 1.6) * 1300 : 1400 + Math.random() * 1500;
        const cx = S.map.W * C / 2, cz = S.map.H * C / 2;
        ev({ e: 'bolt', x: Math.round(cx + Math.cos(a) * d), z: Math.round(cz + Math.sin(a) * d), s: (Math.random() * 2147483647) | 0 });
      }
    }
    // flash : quelques impulsions rapides qui décroissent
    W.ft += dt; let fl = 0;
    for (const p of W.pulses) if (W.ft >= p.t) fl += p.a * Math.exp(-(W.ft - p.t) / 0.075);
    W.flash = fl;
    const fin = fl * (1 - 0.6 * W.inside), cov = W.cover;
    S.hemi.intensity = W.base.hemi * (1 - 0.3 * cov) + fin * 2.2;
    S.ambient.intensity = W.base.amb * (1 - 0.2 * cov) + fin * 0.6;
    // l'éclair éclaire toute la scène depuis sa direction (ombres franches des façades)
    W.dl.intensity = fin * 3.2;
    if (fin > 0.01) { const c = S.cam.position; W.dl.position.set(c.x + W.fdir.x * 50, c.y + 60, c.z + W.fdir.z * 50); W.dl.target.position.copy(c); }
    S.scene.fog.color.copy(W.base.fog).lerp(FOG_FLASH, Math.min(0.55, fin * 0.45));
    S.scene.fog.density = W.base.fogD * (1 + 0.45 * W.k);
    if (W.bolt) { W.bolt.material.opacity = Math.min(1, fl * 1.6); if (W.ft > 0.9) { S.scene.remove(W.bolt); W.bolt.geometry.dispose(); W.bolt.material.dispose(); W.bolt = null; } }
    if (W.clouds) { const U = W.clouds.U; U.uCover.value = cov; U.uFlash.value = Math.min(1.5, fl); U.uTime.value = S.time; }
    updateRain(dt);
  }

  /* ---------- sons d'environnement : dedans/dehors, pluie, vent, néons ---------- */
  function fxAudio(dt) {
    const c = S.cam.position, W = S.wx;
    const covered = !S.map.outdoor || (W ? roofed(c.x, c.y - 0.5, c.z) : Wd.ceiling(S.map, c.x, c.z, c.y - 0.5) !== Infinity) ? 1 : 0;
    S.inside = (S.inside == null ? covered : S.inside) + (covered - (S.inside == null ? covered : S.inside)) * Math.min(1, dt * 2.5);
    // réverbération : grande salle (centre commercial), pièces (backrooms), rues (écho des façades)
    const big = S.def.kind === 'mall' ? 1.3 : 1;
    if (S.map.outdoor) Au.setSpace(0.05 + 0.22 * S.inside, 0.12 * (1 - S.inside)); else Au.setSpace(0.28 * big, 0);
    if (W) { W.inside = S.inside; Au.rain(W.k, S.inside); Au.wind(W.code === 2 ? 0.95 : W.code === 1 ? 0.55 : 0.3, S.inside); }
    // néons qui bourdonnent quand on passe dessous
    let hum = 0;
    for (const pl of S.pool) {
      const o = pl.userData.src; if (!o || pl.intensity < 0.3 || o.l.kind === 'sky') continue;
      const d = Math.hypot(pl.position.x - c.x, (pl.position.y - c.y) * 1.3, pl.position.z - c.z), k = (1 - d / 6.5) * (o.l.kind === 'lamp' ? 0.45 : 1);
      if (k > hum) hum = k;
    }
    Au.hum(S.paused || S.me.dead ? 0 : hum);
  }

  function disposeFx() {
    const W = S.wx;
    if (W) {
      if (W.mats) W.mats.forEach(o => { o.m.roughness = o.r; o.m.color.copy(o.c); });     // matériaux partagés : on les sèche
      if (W.ext && BR.Tex.setWet) { try { BR.Tex.setWet(S.T, 0); } catch (e) {} }
    }
    S.blood = [];
    if (BR.Hud.bloodClear) BR.Hud.bloodClear(true);
  }

  /* =====================================================================
     PEUR : tension croissante, mise en scène des frayeurs décidées par l'hôte (traque silencieuse, coup d'œil,
     vague d'obscurité, entité qui te sent), et frayeurs « personnelles » locales (apparitions, faux signaux,
     chuchotement du prénom, premier contact, souffle retenu). Aucun filtre d'écran : lumière, son, caméra, rythme.
     ===================================================================== */
  // réglages locaux selon l'intensité (BR.settings.fear) — intervalles en secondes, avant accélération par la tension
  //   sig : faux signaux sonores ; app : apparitions furtives ; name : chuchotements du prénom par partie (nameAt : pas avant)
  //   dim : baisse maximale des lumières en fin de partie ; gap : écart minimal après une grosse frayeur
  const FEARL = {
    normal: { sig: [18, 34], app: [90, 160], name: 1, nameAt: 160, dim: 0.3, gap: 8 },
    strong: { sig: [11, 22], app: [55, 105], name: 2, nameAt: 100, dim: 0.42, gap: 6 },
  };
  const HIDE_B = 0.62;          // luminosité sous laquelle on peut se cacher (accroupi, immobile, lampe éteinte)
  const fearCfg = () => FEARL[BR.settings.fear] || FEARL.normal;
  function initFear() {
    const c = fearCfg();
    S.fear = {
      lv: 0, lastBig: -99, lastMed: -99, q: [], lastSig: '',
      sigT: 12 + Math.random() * 10, appT: c.app[0] * (0.55 + Math.random() * 0.4), nameT: c.nameAt + Math.random() * 90, names: 0,
      contact: false, look: null, zoom: 0, punch: 0, slow: 0, mimic: null,
      hide: false, hideT: 0, hideCd: 0, leakT: 0, hint: false,
      dark: new Map(), darkMe: null, brown: 0, brownSt: 0, brownOn: true, ak: 1, app: null, ov: [], peekSeen: new Set(),
      base: { amb: S.ambient.intensity, hemi: S.hemi.intensity },
    };
    // caches sombres posés sous les néons éteints par la vague (les dalles lumineuses sont fusionnées en un seul maillage)
    const F = S.fear, mat = new THREE.MeshBasicMaterial({ color: S.redLights ? 0x160504 : 0x1d1c19 });
    const gP = new THREE.PlaneGeometry(1.14, 0.58); gP.rotateX(Math.PI / 2);
    F.ovGeo = [gP, new THREE.BoxGeometry(0.5, 0.12, 0.5)];
    for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(gP, mat); m.visible = false; S.scene.add(m); F.ov.push(m); }
  }
  // tension 0..1 : monte avec le temps et les fusibles ; à fond quand la sortie est ouverte
  function fearLevel() {
    const need = S.fuseTaken.length || 1, got = S.fuseTaken.filter(Boolean).length;
    let lv = 0.55 * Math.min(1, S.time / 720) + 0.45 * got / need;
    if (S.exitOpen) lv = 1;
    if (BR.settings.fear === 'strong') lv += 0.12;
    return BR.clamp(lv, 0, 1);
  }
  function fearLater(sec, f) { if (S && S.fear) S.fear.q.push({ t: S.time + sec, f }); }
  // facteur d'éclairage d'une source : tension (les lumières baissent), vague d'obscurité, baisse de courant (fusible)
  function darkF(dk) { const t = S.time; if (t < dk.off || t >= dk.on + 0.6) return 1; if (t < dk.on) return 0.02; return Math.random() < 0.5 ? 0.9 : 0.04; }
  function lightK(o) {
    const F = S.fear; if (!F) return 1;
    let k = 1 - fearCfg().dim * F.lv;
    if (F.dark.size) { const dk = F.dark.get(o.l); if (dk) k *= darkF(dk); }
    if (F.brown > 0) k *= F.brownOn ? 0.55 : 0.06;
    return k;
  }
  function brownout() { const F = S && S.fear; if (!F) return; F.brown = 1.3; F.brownSt = 0; Au.powerDown(); }

  function fearUpdate(dt, render) {
    const F = S.fear; if (!F) return;
    F.lv = fearLevel();
    const me = S.me, cam = S.cam.position, alive = !me.dead && !me.escaped;
    // file d'attente (sons différés) : suit le temps de la partie, pas de setTimeout
    if (F.q.length) { const now = S.time, due = F.q.filter(o => o.t <= now); if (due.length) { F.q = F.q.filter(o => o.t > now); due.forEach(o => { try { o.f(); } catch (e) { console.warn('peur', e); } }); } }
    // vague d'obscurité : chaque néon s'éteint à son tour avec un claquement, puis se rallumera en grésillant
    if (F.dark.size) {
      let snd = 0;
      for (const [l, dk] of F.dark) {
        if (!dk.snd && S.time >= dk.off) {
          dk.snd = true;
          const o = dk.o, d = Math.hypot(o.x - cam.x, o.y - cam.y, o.z - cam.z);
          if (render && snd < 2 && d < 34) { snd++; Au.breaker({ x: o.x, y: o.y, z: o.z }, Math.min(1, 1.35 - d / 30)); }
        }
        if (S.time > dk.on + 0.7) F.dark.delete(l);
      }
    }
    const DM = F.darkMe;
    if (DM) {
      // la vague t'atteint : la lampe meurt, tout se tait
      if (!DM.cut && S.time >= DM.reach) {
        DM.cut = true;
        const L = S.lamp; if (S.flashOn) { L.flick = 0; L.dead = DM.sil + 4; L.willDie = false; L.cd = 5; Au.flashClick(false); }
        Au.silence(DM.sil + 1.2);
      }
      if (S.time > DM.end + 1.5) endDarkMe(false);     // pas de cri (entité étourdie…) : tout revient
    }
    // baisse de courant (fusible ramassé) : grésillement général
    if (F.brown > 0) { F.brown -= dt; F.brownSt -= dt; if (F.brownSt <= 0) { F.brownSt = 0.04 + Math.random() * 0.12; F.brownOn = Math.random() < 0.45; } }
    // dalles lumineuses et lumière ambiante qui baissent avec la tension
    const dim = fearCfg().dim, pk = (1 - dim * 0.6 * F.lv) * (F.brown > 0 ? (F.brownOn ? 0.6 : 0.12) : 1);
    if (S.strobe) S.built.onMat.color.multiplyScalar(pk); else S.built.onMat.color.copy(S.panelBase).multiplyScalar(pk);
    const akT = (1 - 0.22 * F.lv) * (DM && DM.cut ? 0.55 : 1) * (F.brown > 0 && !F.brownOn ? 0.7 : 1);
    F.ak += (akT - F.ak) * Math.min(1, dt * 4);
    if (!S.wx) { S.ambient.intensity = F.base.amb * F.ak; S.hemi.intensity = F.base.hemi * F.ak; }
    else { S.ambient.intensity *= F.ak; S.hemi.intensity *= F.ak; }
    if (render) updateOverlays();
    fearHide(dt);
    if (F.mimic && S.time > F.mimic.until + 1) F.mimic = null;
    if (F.mimic && !F.mimic.extra && F.mimic.n > 3 && S.time - F.mimic.last > 0.55 && me.speed < 0.3) {
      // tu t'arrêtes… les pas s'arrêtent aussi. Puis un dernier pas, juste derrière.
      F.mimic.extra = true; const M = F.mimic; F.mimic = null;
      fearLater(0.35, () => { const p = behind(2.6, M.side); Au.step(0.42, 0, surfAt(me.x, me.y, me.z), 0, p); });
    }
    if (render && alive && !S.paused && !S.ended) { fearWatch(); fearSignals(dt); fearApparition(dt); fearName(dt); }
    else if (F.app && (!alive || S.ended)) killApp();
  }
  const behind = (d, side) => { const me = S.me, y = me.yaw; return { x: me.x + Math.sin(y) * d + Math.cos(y) * (side || 0), y: me.y + 0.15, z: me.z + Math.cos(y) * d - Math.sin(y) * (side || 0) }; };
  function endDarkMe(scream) {
    const F = S.fear; if (!F || !F.darkMe) return;
    F.darkMe = null;
    Au.unsilence(scream ? 0 : 0.8);
    if (S.lamp.dead > 0.05) S.lamp.dead = scream ? 0.25 : 0.01;     // la lampe se rallume en grésillant
  }
  // caches sombres sur les néons éteints les plus proches
  function updateOverlays() {
    const F = S.fear, cam = S.cam.position, list = [];
    if (F.dark.size) for (const dk of F.dark.values()) { if (darkF(dk) > 0.5) continue; const o = dk.o, d = Math.hypot(o.x - cam.x, o.y - cam.y, o.z - cam.z); if (d < 48) list.push({ o, d }); }
    if (list.length > F.ov.length) list.sort((a, b) => a.d - b.d);
    F.ov.forEach((m, i) => {
      const it = list[i]; if (!it) { m.visible = false; return; }
      const l = it.o.l; m.visible = true;
      if (l.kind === 'lamp') { m.geometry = F.ovGeo[1]; m.position.set(it.o.x, 5.66, it.o.z); m.scale.setScalar(1); }
      else { m.geometry = F.ovGeo[0]; m.position.set((l.cx + 0.5) * C, l.y - 0.034, (l.cy + 0.5) * C); m.scale.setScalar(l.kind === 'sky' ? 1.6 : 1); }
    });
  }

  /* ---------- évènements partagés (décidés par l'hôte) ---------- */
  function fearReveal(e) {
    const F = S.fear; if (!F) return;
    const v = S.views.views.get(e.id), me = S.me;
    if (e.e === 'sniff' && e.p === S.selfId) { F.hide = false; F.hideCd = 8; me.hide = false; }
    if (e.p === S.selfId && !spectating()) {
      // elle était là, tout près : coup de son très fort, sursaut de la caméra
      if (F.darkMe) endDarkMe(true); else Au.unsilence(0);
      Au.stinger(e.e === 'sniff' || e.q ? 'sniff' : 'reveal');
      S.shake = Math.max(S.shake, e.e === 'reveal' && !e.q ? 0.9 : 0.6);
      F.punch = 1; S.bc.land.vel -= 0.5;
      F.lastBig = S.time; F.contact = true; F.look = null;
    } else if (v) {
      const d = Math.hypot(v.x - S.cam.position.x, v.z - S.cam.position.z);
      if (d < 25) Au.stinger('sniff', 0.35 * (1 - d / 25));
    }
  }
  function fearNape(e) {
    const F = S.fear; if (!F || e.p !== S.selfId || spectating()) return;
    // souffle au creux de l'oreille, du côté où elle se tient
    const v = S.views.views.get(e.id); let side = Math.random() < 0.5 ? -0.8 : 0.8;
    if (v) { const pn = panOf(v.x, v.z); side = (pn >= 0 ? 1 : -1) * Math.max(0.55, Math.abs(pn)); }
    Au.earBreath(side, 1.15); F.lastMed = S.time;
  }
  function fearDark(e) {
    const F = S.fear; if (!F) return;
    const ox = +e.x, oy = +e.y || 0, oz = +e.z, v = Math.max(3, +e.v || 9), R0 = Math.max(8, +e.r || 30), sil = +e.s || 1.6, t0 = S.time;
    if (!isFinite(ox) || !isFinite(oz)) return;
    const tw = Math.max(0.5, (R0 - 7) / v), hold = tw + sil + 9;
    // chaque néon dans le rayon s'éteint quand la vague (partie de l'entité) l'atteint
    for (const o of S.liveLights) {
      const d = Math.hypot(o.x - ox, o.z - oz, (o.y - oy - 2.5) * 1.2);
      if (d > R0) continue;
      const off = t0 + d / v + Math.random() * 0.06, prev = F.dark.get(o.l);
      F.dark.set(o.l, { o, off: prev && prev.off < off && S.time < prev.on ? prev.off : off, on: t0 + hold + Math.random() * 3, snd: !!(prev && prev.snd && S.time >= prev.off) });
    }
    const me = S.me, dMe = Math.hypot(me.x - ox, me.z - oz);
    if ((e.p === S.selfId || dMe < R0) && !spectating()) {
      F.darkMe = { id: e.id, sil, reach: t0 + Math.min(dMe, R0) / v, cut: false, end: t0 + tw + sil };
      F.lastBig = S.time; F.look = null;
    }
  }
  function fearScream(e) {
    const F = S.fear; if (!F) return;
    const v = S.views.views.get(e.id), x = v ? v.x : +e.x, y = v ? v.y : (+e.y || 0), z = v ? v.z : +e.z;
    if (!isFinite(x) || !isFinite(z)) return;
    const mine = !!(F.darkMe && F.darkMe.id === e.id), d = Math.hypot(x - S.cam.position.x, z - S.cam.position.z);
    if (mine) endDarkMe(true);
    if ((mine || e.p === S.selfId) && !spectating()) {
      Au.screamAt(e.sp, { x, y: y + 1.5, z }, 1); Au.stinger('reveal', 0.75);
      S.shake = Math.max(S.shake, 0.7); F.punch = 1; F.contact = true; F.lastBig = S.time;
    } else if (d < 45) Au.screamAt(e.sp, { x, y: y + 1.5, z }, 0.55);
  }

  /* ---------- premier contact, coup d'œil aperçu ---------- */
  function fearWatch() {
    const F = S.fear, cam = S.cam.position; S.cam.getWorldDirection(_v);
    S.views.views.forEach((v, id) => {
      if (v.st !== 'peek' && v.st !== 'lurk') F.peekSeen.delete(id);
      const peek = v.st === 'peek' && !F.peekSeen.has(id), contact = !F.contact && v.st === 'chase' && v.tg === S.selfId;
      if (!peek && !contact) return;
      const dx = v.x - cam.x, dy = v.y + 1.4 - cam.y, dz = v.z - cam.z, d = Math.hypot(dx, dy, dz) || 1, c = (dx * _v.x + dy * _v.y + dz * _v.z) / d;
      if (peek && d < 32 && c > 0.8 && Wd.los(S.map, cam.x, cam.y, cam.z, v.x, v.y + 1.4, v.z)) { F.peekSeen.add(id); Au.stinger('peek'); F.lastMed = S.time; }
      if (contact && d < 40 && (c > 0 || d < 12) && Wd.los(S.map, cam.x, cam.y, cam.z, v.x, v.y + 1.4, v.z)) fearContact(id);
    });
  }
  function fearContact(id) {
    const F = S.fear; F.contact = true;
    if (S.time - F.lastBig < 6) return;           // une grosse frayeur vient d'avoir lieu : pas de doublé
    F.lastBig = S.time;
    Au.stinger('contact'); Au.slowmo();
    F.slow = 0.75;   // plus d'attraction de la caméra vers l'entité : le joueur garde toujours la main sur sa vue
    S.shake = Math.max(S.shake, 0.35);
  }
  // décalage de la caméra vers l'entité pendant le premier contact (sans toucher à la visée du joueur)
  function fearLook(dt) {
    const F = S.fear; if (!F) return null;
    const L = F.look, v = L && S.views.views.get(L.id);
    if (!L || !v || L.t > L.dur) { F.look = null; F.zoom = Math.max(0, F.zoom - dt * 20); return null; }
    L.t += dt;
    const k = BR.clamp(L.t / L.dur, 0, 1), w = Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.25)), 0.6) * (k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2) * 0.8;
    const me = S.me, dx = v.x - me.x, dz = v.z - me.z, dy = v.y + 1.5 - (me.y + S.eye);
    const yawT = Math.atan2(-dx, -dz), pitchT = Math.atan2(dy, Math.hypot(dx, dz));
    F.zoom = 11 * w;
    return { ry: BR.angDiff(me.yaw, yawT) * w, rx: (pitchT - me.pitch) * w };
  }

  /* ---------- se cacher : accroupi, immobile, lampe éteinte, dans le noir, une entité pas loin ---------- */
  function fearHide(dt) {
    const F = S.fear, me = S.me;
    F.hideCd = Math.max(0, F.hideCd - dt);
    let can = false;
    if (me.crouch && !me.down && !me.dead && !me.escaped && me.ground && me.speed < 0.4 && S.slide <= 0 && F.hideCd <= 0 && (!S.flashOn || S.lamp.off)) {
      let near = 99; S.views.views.forEach(v => { if (Math.abs(v.y - me.y) < 3) near = Math.min(near, Math.hypot(v.x - me.x, v.z - me.z)); });
      // seuils avec hystérésis : une entité qui hésite à la limite ne fait pas « clignoter » la cachette
      can = near < (F.hide ? 22 : 16) && brightAt(me.x, me.y, me.z, 99) < HIDE_B + (F.hide ? 0.12 : 0);
    }
    if (can && !F.hide) {
      F.hide = true; F.hideT = 0; F.leakT = 2.5 + Math.random() * 2;
      if (S.time - (F.holdSnd || -9) > 4) { F.holdSnd = S.time; Au.holdBreath(); }
      if (!F.hint) { F.hint = true; BR.Hud.toast('Tu retiens ta respiration… ne bouge plus.', ''); }
    } else if (!can && F.hide) { F.hide = false; if (F.hideT > 1.5) Au.breathRelease(); }
    if (F.hide) { F.hideT += dt; F.leakT -= dt; if (F.leakT <= 0) { F.leakT = 2.5 + Math.random() * 2.5; Au.breathLeak(); } }
    me.hide = F.hide;
  }

  /* ---------- faux signaux : pas qui t'imitent, objet qui tombe, souffle à l'oreille, radio, téléphone… ---------- */
  function fearOnStep(sf) {
    const F = S.fear; if (!F || !F.mimic) return;
    const M = F.mimic; if (S.time > M.until) { F.mimic = null; return; }
    const me = S.me, pw = (me.sprint ? 0.75 : me.crouch ? 0.22 : 0.45) * 0.85, p = behind(3.2 + Math.random() * 0.8, M.side);
    fearLater(M.delay, () => Au.step(pw, 0, sf, wetAt(me), p));
    M.last = S.time; M.n++;
  }
  const SIGS = [['mimic', 0.2], ['clatter', 0.14], ['breath', 0.07], ['radio', 0.06], ['phone', 0.05], ['above', 0.1], ['knock', 0.08],
    ['growl', 0.08], ['screech', 0.05], ['whisper', 0.1], ['dread', 0.06], ['slam', 0.07]];
  function fearSignals(dt) {
    const F = S.fear;
    F.sigT -= dt; if (F.sigT > 0) return;
    if (S.danger > 0.45 || S.time - F.lastBig < fearCfg().gap || S.time - F.lastMed < 5 || F.darkMe || F.app || F.mimic) { F.sigT = 2 + Math.random() * 3; return; }
    const c = fearCfg(); F.sigT = (c.sig[0] + Math.random() * (c.sig[1] - c.sig[0])) * (1 - 0.4 * F.lv);
    for (let k = 0; k < 6; k++) {          // tirage pondéré, jamais deux fois le même d'affilée
      let tot = 0; SIGS.forEach(s => { if (s[0] !== F.lastSig) tot += s[1]; });
      let r = Math.random() * tot, pick = null;
      for (const s of SIGS) { if (s[0] === F.lastSig) continue; r -= s[1]; if (r <= 0) { pick = s[0]; break; } }
      if (pick && fearSignal(pick)) { F.lastSig = pick; return; }
    }
  }
  function fearSignal(name) {
    const me = S.me, F = S.fear, yaw = me.yaw, pn = Math.random() * 2 - 1;
    // point autour du joueur (back : plutôt dans son dos)
    const around = (d0, d1, back) => { const a = yaw + (back ? Math.PI + (Math.random() - 0.5) * 1.6 : Math.random() * 6.283), d = d0 + Math.random() * (d1 - d0); return { x: me.x - Math.sin(a) * d, y: me.y + 1, z: me.z - Math.cos(a) * d }; };
    switch (name) {
      case 'mimic': if (me.speed < 1.5) return false; F.mimic = { until: S.time + 6 + Math.random() * 5, delay: 0.26 + Math.random() * 0.12, side: (Math.random() - 0.5) * 1.2, n: 0, last: S.time, extra: false }; return true;
      case 'clatter': Au.clatter(around(6, 12, true), Math.random() < 0.6 ? 'can' : 'thud'); return true;
      case 'breath': if (S.danger > 0.15) return false; Au.earBreath(Math.random() < 0.5 ? -0.9 : 0.9, 0.75); return true;
      case 'radio': Au.radio(around(14, 26)); return true;
      case 'phone': Au.phone(around(14, 26)); return true;
      case 'above': {      // quelqu'un traverse l'étage du dessus
        const m = S.map, f = Math.round(me.y / SH) + 1; if (f >= m.F) return false;
        const a0 = Math.random() * 6.283, sx = me.x + Math.cos(a0) * 4.5, sz = me.z + Math.sin(a0) * 4.5, ex = me.x - Math.cos(a0) * 4.5, ez = me.z - Math.sin(a0) * 4.5;
        const ok = (x, z) => { const cx = Math.floor(x / C), cy = Math.floor(z / C); return cx >= 0 && cy >= 0 && cx < m.W && cy < m.H && m.t[f][cy * m.W + cx] === Wd.FLOOR; };
        if (!ok(sx, sz) || !ok(ex, ez) || !ok(me.x, me.z)) return false;
        for (let i = 0; i < 7; i++) { const t = i / 6, p = { x: sx + (ex - sx) * t, y: f * SH + 0.1, z: sz + (ez - sz) * t }; fearLater(i * 0.42, () => Au.step(0.8, 0, surfAt(p.x, p.y, p.z), 0, p)); }
        return true;
      }
      case 'knock': {      // on frappe contre le mur, tout près
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * 6.283, fx = -Math.sin(a), fz = -Math.cos(a); let d = 1;
          while (d < 8 && !Wd.blocked(S.map, me.x + fx * d, me.z + fz * d, me.y, 0.1)) d += 0.25;
          if (d >= 2.5 && d < 8) { Au.knock({ x: me.x + fx * d, y: me.y + 1.3, z: me.z + fz * d }, Math.random() < 0.3 ? 4 : 3); return true; }
        }
        return false;
      }
      case 'growl': Au.growl(pn, 0.45); return true;
      case 'screech': Au.screech(pn, 0.22); return true;
      case 'whisper': Au.whisper(pn); return true;
      case 'dread': Au.dread(); return true;
      case 'slam': Au.door('slam', pn, 0.35); return true;
    }
    return false;
  }

  /* ---------- apparitions furtives : une image au bout d'un couloir, du coin de l'œil, qui s'efface quand on la regarde ---------- */
  function fearApparition(dt) {
    const F = S.fear;
    if (F.app) { updateApp(dt); return; }
    F.appT -= dt; if (F.appT > 0) return;
    if (S.danger > 0.25 || S.time - F.lastBig < 20 || S.time - F.lastMed < 10 || F.darkMe || S.camMode !== 'fp' || S.grace > 0 || F.hide) { F.appT = 4; return; }
    if (!spawnApp()) { F.appT = 5; return; }
    const c = fearCfg(); F.appT = (c.app[0] + Math.random() * (c.app[1] - c.app[0])) * (1 - 0.4 * F.lv);
  }
  function spawnApp() {
    const F = S.fear, me = S.me, ey = me.y + P.eye, yaw = me.yaw, dMax = Math.max(12, Math.min(26, 0.95 / (S.scene.fog.density || 0.03)));
    let best = null;
    for (let k = 0; k < 24; k++) {
      // du coin de l'œil (17° à 36° du centre, elle reste jusqu'à ce qu'on la regarde) ou, dans un couloir,
      // droit devant tout au bout (elle n'est là qu'une fraction de seconde)
      const off = (Math.random() < 0.5 ? -1 : 1) * (k % 3 === 2 ? Math.random() * 0.2 : 0.3 + Math.random() * 0.33), a = yaw + off, fx = -Math.sin(a), fz = -Math.cos(a);
      let d = 1.5, last = -1;
      while (d < 32) {
        const x = me.x + fx * d, z = me.z + fz * d;
        if (Wd.blocked(S.map, x, z, me.y, 0.4) || !Wd.los(S.map, me.x, ey, me.z, x, ey, z)) break;
        const sy = Wd.support(S.map, x, z, me.y + 0.3, 0.3); if (!(Math.abs(sy - me.y) < 0.6)) break;
        last = d; d += 0.5;
      }
      const flash = Math.abs(off) < 0.25;
      if (last < (flash ? 12 : 10)) continue;                    // au bout d'un couloir, pas sous le nez
      const dd = Math.min(last - 0.5, dMax), x = me.x + fx * dd, z = me.z + fz * dd;   // pas plus loin que ce que laisse voir le brouillard
      const sc = Math.min(dd, 24) + Math.random() * 4 + (brightAt(x, me.y, z, dd) < 0.7 ? 5 : 0) + (flash ? -3 : 0);    // de préférence dans la pénombre
      if (!best || sc > best.sc) best = { x, z, y: me.y, sc, flash };
    }
    if (!best) return false;
    const sp = E.draw([...S.views.views.values()].map(v => v.sp));
    const view = E.MonsterView(sp, { fogColor: S.scene.fog.color.clone(), fogDensity: S.scene.fog.density });
    view.group.position.set(best.x, best.y, best.z);
    view.mat.uniforms.alpha.value = 1;
    S.scene.add(view.group);
    F.app = { view, x: best.x, y: best.y, z: best.z, t: 0, flash: best.flash, life: best.flash ? 0.28 + Math.random() * 0.2 : 1.4 + Math.random() * 1.2 };
    F.lastMed = S.time;
    return true;
  }
  function updateApp(dt) {
    const F = S.fear, A = F.app, cam = S.cam.position;
    A.t += dt;
    const dx = A.x - cam.x, dy = A.y + 1.3 - cam.y, dz = A.z - cam.z, d = Math.hypot(dx, dy, dz) || 1;
    A.view.update(dt, { state: 'wander', dist: d });
    A.view.mat.uniforms.alpha.value = 1;
    A.view.mat.uniforms.bright.value = Math.max(0.6, brightAt(A.x, A.y, A.z, d));     // assez lisible pour qu'on se demande si on a bien vu
    S.cam.getWorldDirection(_v);
    const c = (dx * _v.x + dy * _v.y + dz * _v.z) / d;
    // regardée en face : elle s'efface aussitôt (souffle à peine audible) ; sinon elle disparaît d'elle-même
    if (c > 0.985 && !A.flash) { killApp(); Au.stinger('vanish', 0.8); return; }
    if (A.t > A.life || d < 7) killApp();
  }
  function killApp() { const F = S && S.fear; if (!F || !F.app) return; S.scene.remove(F.app.view.group); F.app.view.dispose(); F.app = null; }

  /* ---------- chuchotement du prénom (très rare, seulement quand tout est calme et qu'on est seul) ---------- */
  function fearName(dt) {
    const F = S.fear, c = fearCfg();
    if (F.names >= c.name) return;
    F.nameT -= dt; if (F.nameT > 0) return;
    const me = S.me, alone = ![...S.players.values()].some(p => p !== me && !p.dead && !p.escaped && Math.hypot(p.x - me.x, p.z - me.z) < 14);
    if (S.danger > 0.15 || S.time - F.lastBig < 25 || S.time - F.lastMed < 12 || F.darkMe || F.app || !alone) { F.nameT = 6; return; }
    whisperName(); F.nameT = 200 + Math.random() * 120;
  }
  function whisperName() {
    const F = S.fear, raw = String((BR.Account && BR.Account.p && BR.Account.p.name) || S.me.name || '');
    // pseudo prononçable : sans chiffres ni tirets ; un invité n'a pas de vrai prénom → « Retourne-toi… »
    let nm = raw.replace(/[_\-.]+/g, ' ').replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    if (nm.length < 2 || /^invit/i.test(nm)) nm = '';
    const side = Math.random() < 0.5 ? -0.85 : 0.85;
    Au.whisper(side);                          // souffle chuchoté, d'un côté…
    fearLater(0.9, () => { if (!Au.speak(nm ? nm + '…' : 'Retourne-toi…', { rate: 0.45, pitch: 0.05, volume: 0.3 })) Au.whisper(-side); });
    F.names++; F.lastMed = S.time; F.lastBig = S.time;
  }

  /* ---------------- fin de partie ---------------- */
  function rewardFor(res) {
    const me = res.players[S.selfId] || { f: 0, r: 0, e: 0, x: 0, d: 0 };
    const lines = [];
    const add = (label, v) => { if (v) lines.push({ label, v }); return v; };
    let pts = 0;
    pts += add('Fusibles × ' + me.f, me.f * 40);
    pts += add('Coéquipiers relevés × ' + me.r, me.r * 60);
    pts += add('Évasion', me.e ? 150 : 0);
    pts += add('Survie (' + BR.fmtTime(res.time) + ')', Math.min(120, Math.floor(res.time / 10) * 2));
    pts += add('Équipe évadée', res.won && !S.solo ? 50 : 0);
    if (res.mvp === S.selfId && Object.keys(res.players).length > 1) pts += add('MVP de la manche', 40);
    const mult = S.diff.mult, total = Math.round(pts * mult), xp = Math.round(total * 1.2 + 25);
    return { points: total, xp, lines, mult, me };
  }
  let vig = null;
  function endGame(res, reason) {
    if (vig) vig.style.opacity = 0;
    if (!S || S.ended) return;
    S.ended = true;
    res = res || { won: false, time: Math.round(S.time), players: {} };
    if (!res.players[S.selfId]) res.players[S.selfId] = { n: S.me.name, f: S.me.fuses, r: S.me.revives, d: S.me.downs, e: S.me.escaped ? 1 : 0, x: S.me.dead ? 1 : 0, sk: S.me.look.skin };
    const rw = rewardFor(res), me = res.players[S.selfId];
    const ar = { points: rw.points, xp: rw.xp, escaped: !!me.e, died: !!me.x || !me.e, fuses: me.f, revives: me.r, downs: me.d, time: res.time, multi: !S.solo, teamEscaped: res.won, map: S.def.id, diff: S.diff.id };
    const lv = BR.Account.applyResult(ar);
    const summary = { res, reward: rw, level: lv, newBest: !!ar.newBest, reason, solo: S.solo, map: S.def, diff: S.diff, selfId: S.selfId, roster: S.o.roster };
    const cb = S.o.onEnd;
    BR.Hud.fadeOut(() => { Gm.stop(); cb && cb(summary); });
  }
  function abortGame(msg) {
    if (!S || S.ended) return;
    const res = { won: false, time: Math.round(S.time), map: S.def.id, diff: S.diff.id, players: {}, aborted: true };
    S.players.forEach(p => { res.players[p.id] = { n: p.name, f: p.fuses, r: p.revives, d: p.downs, e: p.escaped ? 1 : 0, x: 0, sk: p.look.skin }; });
    endGame(res, msg);
  }
  function leaveGame() {
    if (!S || S.ended) return;
    if (S.solo) { abortGame('Partie abandonnée.'); return; }
    BR.Net.leave();
    abortGame('Tu as quitté la partie.');
  }

  Gm._debug = () => S;
  // outil de test : avance la partie d'une image (même onglet masqué) ; render=false pour ne pas dessiner
  Gm._step = (dt, render) => { if (S) step(dt || 1 / 60, render === 'nodraw' ? 'nodraw' : render !== false); };
  /** outil de test : force une frayeur. Hôte : 'stalk', 'peek', 'dark', 'reveal', 'sniff' (o.p = joueur visé, o.id = entité) ;
      local : 'apparition', 'name', 'contact', 'brownout', 'siren', 'nape', et les faux signaux 'mimic', 'clatter', 'breath',
      'radio', 'phone', 'above', 'knock', 'growl', 'screech', 'whisper', 'dread', 'slam'. Renvoie un compte rendu. */
  Gm._scare = function (name, o) {
    if (!S || !S.fear) return 'pas de partie';
    o = o || {};
    const F = S.fear, pid = o.p || S.selfId, p = S.players.get(pid);
    const host = () => {
      if (!S.isHost) return null;
      const Dr = S.director; let m = o.id != null ? Dr.mons.find(x => x.id === o.id) : null;
      if (!m && p) { let bd = 1e9; for (const x of Dr.mons) { const d = Math.hypot(x.x - p.x, x.z - p.z); if (d < bd) { bd = d; m = x; } } }
      if (!m) return null;
      m.fx = null; m.stun = 0; m.wind = 0; m.calm = 0; Dr.fear.last[pid] = -1e9;
      let bn = Wd.nodeAt(S.map, m.x, m.y, m.z); if (bn < 0) bn = m.last;
      return { Dr, m, bn };
    };
    switch (name) {
      case 'stalk': { const h = host(); if (!h || !p) return 'impossible (hôte seulement)'; h.Dr.startStalk(h.m, p); return 'traque : entité ' + h.m.id; }
      case 'peek': { const h = host(); if (!h || !p) return 'impossible (hôte seulement)'; return h.Dr.startPeek(h.m, p, h.bn) ? 'coup d\'œil : entité ' + h.m.id + ' ' + JSON.stringify(h.m.fx.s) : 'pas d\'angle trouvé'; }
      case 'dark': { const h = host(); if (!h || !p) return 'impossible (hôte seulement)'; h.Dr.startDark(h.m, p, Math.max(16, Math.hypot(h.m.x - p.x, h.m.z - p.z)), E.FEAR[BR.settings.fear] || E.FEAR.normal); return 'vague : entité ' + h.m.id; }
      case 'reveal': { const h = host(); if (!h || !p) return 'impossible (hôte seulement)'; h.Dr.reveal(h.m, p, 0.4); return 'dévoilée : entité ' + h.m.id; }
      case 'sniff': { const h = host(); if (!h || !p) return 'impossible (hôte seulement)'; h.Dr.fear.sniff[pid] = 0; h.m.tgt = null; h.m.x = p.x + 1.2; h.m.z = p.z; h.m.y = p.y; return h.Dr.senses(h.m, Object.assign({}, p, { hide: true })) ? 'sentie' : 'non'; }
      case 'nape': fearNape({ e: 'nape', id: o.id != null ? o.id : (S.views.views.keys().next().value), p: S.selfId }); return 'souffle';
      case 'apparition': if (F.app) killApp(); return spawnApp() ? 'apparition en ' + F.app.x.toFixed(1) + ',' + F.app.z.toFixed(1) : 'pas d\'emplacement';
      case 'name': whisperName(); return 'chuchotement : ' + (window.speechSynthesis ? 'synthèse vocale' : 'souffle seul');
      case 'contact': { F.contact = false; F.lastBig = -99; let id = null, bd = 1e9; S.views.views.forEach((v, k) => { if (v.dist < bd) { bd = v.dist; id = k; } }); if (id == null) return 'aucune entité'; fearContact(id); return 'premier contact : entité ' + id; }
      case 'brownout': brownout(); return 'baisse de courant';
      case 'siren': Au.farSiren(); return 'sirène';
      default: return fearSignal(name) ? 'signal ' + name : 'signal ' + name + ' impossible ici';
    }
  };
  Gm._fear = () => S && S.fear;
})();

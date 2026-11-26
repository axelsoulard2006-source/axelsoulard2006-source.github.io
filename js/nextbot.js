/* ===== nextbot.js : rendu horrifique des entités (yeux, bouche, glitch) et IA de traque sur plusieurs étages ===== */
(function () {
  const BR = window.BR, E = BR.Ent, WD = () => BR.World;

  /* =====================================================================
     1. RENDU : image plate toujours tournée vers la caméra + effets
     ===================================================================== */
  const VS = `
    uniform vec2 size; varying vec2 vUv; varying float vDist;
    void main(){
      vUv = uv;
      vec3 center = (modelMatrix * vec4(0.,0.,0.,1.)).xyz;
      vec3 right = normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0]));
      float sx = length(modelMatrix[0].xyz), sy = length(modelMatrix[1].xyz);
      vec3 pos = center + right * position.x * size.x * sx + vec3(0.,1.,0.) * position.y * size.y * sy;
      vec4 mv = viewMatrix * vec4(pos,1.);
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const FS = `
    uniform sampler2D map; uniform float time, glitch, alpha, seed, fogDensity, bright, hasFace, amp, aspect, rage, horror;
    uniform vec3 fogColor, tint, eyeL, eyeR, mouth;
    varying vec2 vUv; varying float vDist;
    float h1(float n){ return fract(sin(n*12.9898+seed)*43758.5453); }
    vec2 bulge(vec2 uv, vec3 e, float k){
      vec2 d = (uv - e.xy) * vec2(aspect, 1.0); float r = length(d) / (e.z * 2.6);
      return e.xy + (uv - e.xy) * (1.0 - k * exp(-r * r * 1.6));
    }
    vec3 eye(vec3 col, vec3 e){
      vec2 d = (vUv - e.xy) * vec2(aspect, 1.0); float r = length(d) / e.z;
      float socket = 1.0 - smoothstep(0.6, 1.45, r);
      col = mix(col, vec3(0.0), socket * 0.97);
      float fl = 0.72 + 0.28 * sin(time * 23.0 + e.x * 50.0);
      float pupil = 1.0 - smoothstep(0.0, 0.34, r);
      col += vec3(1.0, 0.1, 0.04) * pupil * 3.0 * fl;
      col += vec3(0.9, 0.05, 0.02) * exp(-r * r * 0.9) * (0.25 + 0.5 * rage);
      // larmes noires
      float dx = abs(d.x) / e.z, below = (e.y - vUv.y) / e.z;
      float len = 2.2 + 1.6 * fract(e.x * 37.0);
      float tear = (1.0 - smoothstep(0.1, 0.32, dx)) * step(0.4, below) * (1.0 - smoothstep(len * 0.6, len, below));
      col = mix(col, vec3(0.02, 0.0, 0.0), tear * 0.9);
      return col;
    }
    void main(){
      vec2 uv = vUv;
      float t = floor(time * 14.0);
      float band = floor(uv.y * 28.0);
      float on = step(1.0 - glitch * 0.55, h1(band * 1.7 + t * 3.1));
      uv.x += (h1(band + t) - 0.5) * 0.16 * on * glitch;
      if (hasFace > 0.5 && horror > 0.01) {
        float k = (0.32 + 0.18 * sin(time * 3.3) + rage * 0.28) * horror;
        uv = bulge(uv, eyeL, k); uv = bulge(uv, eyeR, k);
        vec2 dm = (uv - mouth.xy) * vec2(aspect, 1.0); float rm = length(dm) / (mouth.z * 2.2);
        uv.y = mouth.y + (uv.y - mouth.y) * (1.0 - (0.18 + amp * 0.55) * horror * exp(-rm * rm * 1.8));
      }
      float ab = 0.0;
      vec4 a = texture2D(map, uv + vec2(ab, 0.0)), b = texture2D(map, uv), c = texture2D(map, uv - vec2(ab, 0.0));
      float al = max(max(a.a, b.a), c.a);
      if (al < 0.06) discard;
      vec3 col = vec3(a.r, b.g, c.b);
      vec3 orig = col;
      // étalonnage « cauchemar » : désaturé, contrasté, teinte maladive
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(l), 0.5);
      col = clamp((col - 0.5) * 1.4 + 0.42, 0.0, 1.0);
      col *= vec3(1.06, 0.84, 0.8);
      col *= 0.78 + 0.22 * smoothstep(0.0, 0.35, min(min(vUv.x, 1.0 - vUv.x) * aspect, min(vUv.y, 1.0 - vUv.y)) * 3.0);
      col = mix(orig, col, horror);
      if (hasFace > 0.5 && horror > 0.01) {
        vec3 pre = col;
        col = eye(col, eyeL); col = eye(col, eyeR);
        vec2 dm = (vUv - mouth.xy) * vec2(aspect, 1.0);
        float mw = mouth.z * (1.0 + amp * 0.7);
        float mr = length(dm / vec2(mw * 1.25, mw * (0.3 + amp * 1.25)));
        float hole = 1.0 - smoothstep(0.72, 1.05, mr);
        col = mix(col, vec3(0.03, 0.0, 0.0), hole * 0.96);
        col += vec3(0.6, 0.0, 0.0) * (1.0 - smoothstep(0.0, 0.7, mr)) * (0.2 + amp * 0.8) * hole;
        col = mix(pre, col, smoothstep(0.0, 0.6, horror));
      }
      float flick = step(0.982, h1(t * 2.3)) * glitch;
      col = mix(col, vec3(1.0) - col, flick);
      col += vec3(h1(uv.y * 400.0 + t) * 0.08) * glitch;
      col *= tint * bright;
      float f = 1.0 - exp(-pow(fogDensity * vDist, 2.0));
      col = mix(col, fogColor, clamp(f, 0.0, 0.9));
      gl_FragColor = vec4(col, al * alpha);
    }`;
  let planeGeo = null, shadowTex = null, glowTex = null;
  const getPlane = () => { if (!planeGeo) { planeGeo = new THREE.PlaneBufferGeometry(1, 1); planeGeo.translate(0, 0.5, 0); } return planeGeo; };
  function getShadowTex() {
    if (shadowTex) return shadowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (shadowTex = new THREE.CanvasTexture(c));
  }
  function faceUniforms(sp, U) {
    const f = sp && sp.face;
    U.hasFace.value = 0; return;   // demande utilisateur : plus d'effets sur les yeux et la bouche des monstres
    if (!f) { U.hasFace.value = 0; return; }
    const asp = sp.aspect, r = Math.max(0.02, f.w * asp * 0.12);
    U.hasFace.value = 1;
    U.eyeL.value.set(f.l[0], 1 - f.l[1], r);
    U.eyeR.value.set(f.r[0], 1 - f.r[1], r);
    U.mouth.value.set(f.m[0], 1 - f.m[1], r * 1.5);
  }
  E.MonsterView = function (spIdx, env) {
    const sp = E.sprite(spIdx);
    const group = new THREE.Group();
    const h = sp ? sp.h : 2.4, w = sp ? h * sp.aspect : 1.2;
    const U = {
      map: { value: sp ? sp.tex : null }, size: { value: new THREE.Vector2(w, h) }, time: { value: 0 }, glitch: { value: 0.15 }, alpha: { value: 0 }, seed: { value: Math.random() * 100 },
      fogColor: { value: env.fogColor.clone() }, fogDensity: { value: env.fogDensity }, tint: { value: new THREE.Color(1, 1, 1) }, bright: { value: 1 },
      hasFace: { value: 0 }, amp: { value: 0 }, aspect: { value: sp ? sp.aspect : 0.5 }, rage: { value: 0 }, horror: { value: 0 },
      eyeL: { value: new THREE.Vector3() }, eyeR: { value: new THREE.Vector3() }, mouth: { value: new THREE.Vector3() },
    };
    faceUniforms(sp, U);
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: true, side: THREE.DoubleSide });
    const quad = new THREE.Mesh(getPlane(), mat); quad.frustumCulled = false; group.add(quad);
    const shadow = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), new THREE.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.scale.set(Math.max(1.2, w * 0.8), Math.max(1.2, w * 0.8), 1); group.add(shadow);
    if (!glowTex) glowTex = new THREE.CanvasTexture(BR.Tex.glow(255, 40, 40));
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff2a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.scale.set(w * 1.5, h * 1.1, 1); aura.position.y = h * 0.55; group.add(aura);
    const v = { group, mat, sp: spIdx, t: Math.random() * 10, aggro: 0, faceVer: sp && sp.face };
    v.update = function (dt, st) {        // st : { moving, state, dist, amp }
      v.t += dt; U.time.value = v.t;
      const s2 = E.sprite(spIdx); if (s2 && s2.face !== v.faceVer) { v.faceVer = s2.face; faceUniforms(s2, U); }
      const chase = st.state === 'chase', stun = st.state === 'stun';
      v.aggro += ((chase ? 1 : stun ? 0.6 : 0.15) - v.aggro) * Math.min(1, dt * 3);
      // image « propre » : plus aucun effet d'horreur sur les monstres (ni yeux/bouche, ni glitch, ni teinte, ni aura)
      U.horror.value = 0; U.glitch.value = 0; U.rage.value = 0; U.amp.value = 0;
      aura.material.opacity = 0;
      // en chasse : l'image « court » (petits bonds), se balance et tremble légèrement ; sinon simple flottement
      v.run = (v.run || 0) + ((chase ? 1 : 0) - (v.run || 0)) * Math.min(1, dt * 4);
      const R = v.run, near = BR.clamp(1 - (st.dist || 99) / 12, 0, 1);
      quad.position.x = Math.sin(v.t * 6.5) * 0.07 * R + (Math.random() - 0.5) * 0.035 * R * (0.5 + near);
      quad.position.y = Math.sin(v.t * 2.2) * 0.04 * (1 - R) + Math.abs(Math.sin(v.t * 9.5)) * 0.13 * R + (Math.random() - 0.5) * 0.025 * R;
      const sq = 1 + Math.sin(v.t * 19) * 0.018 * R;
      quad.scale.set(1 / sq, sq, 1);
      U.tint.value.setRGB(1, 1, 1);
      U.alpha.value = Math.min(1, U.alpha.value + dt * 1.5);
    };
    v.setEnv = e => { U.fogColor.value.copy(e.fogColor); U.fogDensity.value = e.fogDensity; };
    v.dispose = () => { mat.dispose(); aura.material.dispose(); shadow.material.dispose(); shadow.geometry.dispose(); };
    return v;
  };

  /** Gestion des vues côté client (positions interpolées) */
  E.Views = function (scene, env) {
    const views = new Map();
    this.views = views; this.brightFn = null; this.ampFn = null;
    this.sync = function (list, dt, camPos) {
      const seen = new Set();
      for (const m of list) {
        seen.add(m.id);
        let v = views.get(m.id);
        if (!v) { v = { view: E.MonsterView(m.sp, env), x: m.x, y: m.y || 0, z: m.z, vx: 0, vz: 0, st: m.st, sp: m.sp }; v.view.group.position.set(m.x, v.y, m.z); scene.add(v.view.group); views.set(m.id, v); }
        const dx = m.x - v.x, dz = m.z - v.z, dy = (m.y || 0) - v.y, d = Math.hypot(dx, dz, dy);
        if (d > 7) { v.x = m.x; v.z = m.z; v.y = m.y || 0; v.vx = v.vz = 0; }
        else { const k = Math.min(1, dt * 12), nx = v.x + dx * k, nz = v.z + dz * k; v.vx = (nx - v.x) / Math.max(dt, 1e-3); v.vz = (nz - v.z) / Math.max(dt, 1e-3); v.x = nx; v.z = nz; v.y += dy * Math.min(1, dt * 14); }
        if (v.st !== m.st) v.stT = 0; else v.stT = (v.stT || 0) + dt;      // temps passé dans l'état courant
        v.st = m.st; v.tg = m.tg;
        v.view.group.position.set(v.x, v.y, v.z);
        const dist = camPos ? Math.hypot(camPos.x - v.x, camPos.y - (v.y + 1.4), camPos.z - v.z) : 99;
        v.dist = dist;
        v.view.update(dt, { moving: Math.hypot(v.vx, v.vz) > 0.4, state: m.st, dist, amp: this.ampFn ? this.ampFn(m.id) : 0 });
        const br = this.brightFn ? this.brightFn(v.x, v.y, v.z, dist) : 1;
        const u = v.view.mat.uniforms.bright; u.value += (br - u.value) * Math.min(1, dt * 8);
      }
      for (const [id, v] of views) if (!seen.has(id)) { scene.remove(v.view.group); v.view.dispose(); views.delete(id); }
    };
    this.nearest = () => { let b = 1e9; views.forEach(v => { if (v.dist < b) b = v.dist; }); return b; };
    this.clear = () => { views.forEach(v => { scene.remove(v.view.group); v.view.dispose(); }); views.clear(); };
    this.setEnv = e => views.forEach(v => v.view.setEnv(e));
  };

  /** Image du jumpscare avec les mêmes effets (canvas 2D) */
  E.scaryCanvas = function (i) {
    const s = E.sprite(i); if (!s) return null;
    return s.canvas;   // image propre, sans effet (demande utilisateur)
    if (s.scary) return s.scary;
    const src = s.canvas, w = src.width, h = src.height, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.filter = 'grayscale(0.55) contrast(1.6) brightness(0.85) sepia(0.25)';
    g.drawImage(src, 0, 0);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(120,0,0,0.18)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    const f = s.face;
    if (f) {
      const r = f.w * w * 0.12;
      for (const e of [f.l, f.r]) {
        const x = e[0] * w, y = e[1] * h;
        let gr = g.createRadialGradient(x, y, 0, x, y, r * 1.5); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.95)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.5, 0, 7); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.9)'; g.fillRect(x - r * 0.18, y, r * 0.36, r * (2.2 + Math.random() * 1.5));
        gr = g.createRadialGradient(x, y, 0, x, y, r * 0.9); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,40,20,1)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 0.9, 0, 7); g.fill();
      }
      const mx = f.m[0] * w, my = f.m[1] * h, mw = r * 2.2;
      g.fillStyle = 'rgba(10,0,0,0.96)'; g.beginPath(); g.ellipse(mx, my, mw, mw * 1.25, 0, 0, 7); g.fill();
      const gr = g.createRadialGradient(mx, my, 0, mx, my, mw); gr.addColorStop(0, 'rgba(160,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(mx, my, mw, mw * 1.25, 0, 0, 7); g.fill();
    }
    return (s.scary = c);
  };

  /* =====================================================================
     2. IA « NEXTBOT » (hôte / solo) : traque le joueur le plus proche à travers les étages
     ===================================================================== */
  const R_MON = 0.42, GRAV = 18;
  E.Director = function (map, diff, rng, cb) {
    this.map = map; this.diff = diff; this.rng = rng || Math.random; this.cb = cb || {};
    this.mons = []; this.nextId = 1; this.time = 0; this.decoys = [];
    this.cache = new Map(); this.pool = [];
    // peur : dernière grosse frayeur par joueur (jamais deux coup sur coup), joueur « senti » malgré sa cachette
    this.fear = { last: {}, sniff: {} }; this.converge = false;
  };
  const D = E.Director.prototype;
  /* réglages de la peur selon l'intensité choisie par l'hôte : écart minimal entre deux grosses frayeurs (s)
     et chances, au moment où une entité prend un joueur en chasse, de lancer une séquence scénarisée */
  //   eng : chance de scénariser une nouvelle prise en chasse ; stalk/peek/dark : poids relatifs des trois séquences
  //   quiet : chance (toutes les 0,25 s) qu'une longue poursuite sans se voir tourne en séquence ; lull : chance de lâcher prise un moment
  //   sil : durée du silence total de la vague d'obscurité
  E.FEAR = {
    normal: { gap: 55, eng: 0.5, stalk: 0.38, peek: 0.3, dark: 0.32, quiet: 0.03, lull: 0.012, sil: 1.6 },
    strong: { gap: 38, eng: 0.65, stalk: 0.36, peek: 0.3, dark: 0.34, quiet: 0.045, lull: 0.008, sil: 2.0 },
  };
  /** états « silencieux » envoyés aux clients : pas de cri, pas de musique de poursuite */
  E.SILENT = { stalk: 1, peek: 1, lurk: 1 };
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const r2 = v => Math.round(v * 100) / 100;
  D.fieldTo = function (node) {
    let c = this.cache.get(node);
    if (c) { c.t = this.time; return c.f; }
    if (this.cache.size >= 14) { let old = null, ot = 1e9; for (const [k, v] of this.cache) if (v.t < ot) { ot = v.t; old = k; } const v = this.cache.get(old); this.cache.delete(old); this.pool.push(v.f); }
    const f = WD().field(this.map, node, this.pool.pop());
    this.cache.set(node, { f, t: this.time });
    return f;
  };
  D.spawn = function (players, opts) {
    opts = opts || {};
    const W = WD(), map = this.map, rng = this.rng, cells = map.monNodes;
    let best = cells[0], bs = -1;
    for (let k = 0; k < 40; k++) {
      const n = cells[Math.floor(rng() * cells.length)], p = W.nodePos(map, n);
      let d = 1e9; for (const pl of players) d = Math.min(d, Math.hypot(pl.x - p.x, pl.z - p.z, (pl.y - p.y) * 2));
      for (const m of this.mons) d = Math.min(d, Math.hypot(m.x - p.x, m.z - p.z) * 0.7);
      if (opts.near) d = -Math.hypot(opts.near.x - p.x, opts.near.z - p.z) + (Math.hypot(opts.near.x - p.x, opts.near.z - p.z) < 14 ? -100 : 0);
      if (d > bs) { bs = d; best = n; }
    }
    const p = W.nodePos(map, best);
    const m = { id: this.nextId++, x: p.x, y: p.y, z: p.z, vx: 0, vz: 0, vy: 0, ground: true, st: 'wander', sp: opts.sp != null ? opts.sp : E.draw(this.mons.map(o => o.sp)), tgt: null, wgoal: -1, wt: 0, stun: 0, cool: 0, stuck: 0, last: best, boost: opts.boost || 1 };
    this.mons.push(m);
    return m;
  };
  D.population = function (n) {
    const base = (1.5 + 0.7 * (n - 1)) * this.diff.monMul + (this.map.kind === 'city' ? 0.6 : this.map.kind === 'mall' ? 0.3 : 0);
    return Math.max(1, Math.round(base));
  };
  // tg : joueur poursuivi (premier contact, côté client)
  D.snapshot = function () { return this.mons.map(m => { const o = { id: m.id, x: +m.x.toFixed(2), y: +m.y.toFixed(2), z: +m.z.toFixed(2), st: m.st, sp: m.sp }; if (m.st === 'chase' && m.tgt != null) o.tg = m.tgt; return o; }); };
  D.decoy = function (x, y, z, ttl) { const n = WD().nodeAt(this.map, x, y + 0.5, z); if (n >= 0) this.decoys.push({ x, y, z, node: n, t: ttl }); };
  D.stunNear = function (x, y, z, r, t) {
    for (const m of this.mons) if (Math.hypot(m.x - x, m.z - z, (m.y - y) * 1.5) < r && WD().los(this.map, x, y + 0.5, z, m.x, m.y + 1.2, m.z)) { m.stun = Math.max(m.stun, t); m.st = 'stun'; }
  };
  // ligne droite praticable (même étage, sans trou ni obstacle)
  // ligne droite praticable sur la dalle de l'étage courant : ni vide, ni escalier, ni obstacle (vérifié sur toute la largeur du corps)
  D.clear = function (m, x1, z1) {
    const W = WD(), map = this.map, dx = x1 - m.x, dz = z1 - m.z, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.25);
    const f = Math.round(m.y / W.SH); if (Math.abs(m.y - f * W.SH) > 0.2) return false;
    const px = -dz / (d || 1) * 0.38, pz = dx / (d || 1) * 0.38;
    for (let k = 1; k <= n; k++) {
      const x = m.x + dx * k / n, z = m.z + dz * k / n;
      for (const s of [0, 1, -1]) {
        const cx = Math.floor((x + px * s) / W.C), cy = Math.floor((z + pz * s) / W.C);
        if (cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) return false;
        const i = cy * map.W + cx;
        if (map.t[f][i] !== W.FLOOR || !map.nav.walk[f * map.WH + i]) return false;
      }
      if (W.blocked(map, x, z, m.y, R_MON * 0.95)) return false;
    }
    return true;
  };
  D.steer = function (m, bn, fld, tp) {
    const W = WD(), map = this.map;
    const cur = fld[bn]; if (cur < 0) return null;
    if (tp && cur <= 3 && Math.abs(tp.y - m.y) < 1.0 && this.clear(m, tp.x, tp.z)) return { x: tp.x, z: tp.z };
    let n = bn, aim = null, ny = W.nodePos(map, bn).y;
    for (let k = 0; k < 5; k++) {
      let best = -1, bv = fld[n];
      W.neighbors(map, n, q => { if (fld[q] >= 0 && fld[q] < bv) { bv = fld[q]; best = q; } });
      if (best < 0) break;
      const p = W.nodePos(map, best);
      if (k > 0 && (Math.abs(p.y - m.y) > 0.3 || !this.clear(m, p.x, p.z))) break;
      aim = p;
      if (Math.abs(p.y - ny) > 0.3) break;        // escalier ou chute : on avance pas à pas
      n = best; ny = p.y;
    }
    return aim;
  };
  D.update = function (dt, players, ctx) {
    ctx = ctx || {};
    const W = WD(), map = this.map;
    this.time += dt; this.players = players;
    const grace = this.time < (ctx.grace != null ? ctx.grace : this.diff.grace);
    this.decoys = this.decoys.filter(d => (d.t -= dt) > 0);
    const targets = [];
    for (const p of players) {
      if (p.down || p.escaped || p.dead || (p.smoke || 0) > 0) continue;
      const n = W.nodeAt(map, p.x, p.y, p.z); if (n < 0) continue;
      targets.push({ p, n });
    }
    for (const m of this.mons) this.updateOne(m, dt, players, targets, grace, ctx);
    // pas d'empilement
    for (let i = 0; i < this.mons.length; i++) for (let j = i + 1; j < this.mons.length; j++) {
      const a = this.mons[i], b = this.mons[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1.0 && d > 0.001 && Math.abs(a.y - b.y) < 1.5) { const push = (1.0 - d) * 0.5; W.move(map, a, -dx / d * push, -dz / d * push, R_MON); W.move(map, b, dx / d * push, dz / d * push, R_MON); }
    }
  };
  D.updateOne = function (m, dt, players, targets, grace, ctx) {
    const W = WD(), map = this.map, df = this.diff, rng = this.rng, lv = ctx.lv || 0;
    m.cool = Math.max(0, m.cool - dt);
    if (m.burst > 0) m.burst -= dt;
    if (m.calm > 0) m.calm -= dt;
    // étourdie (après un coup ou une fusée) : la prochaine prise en chasse sera « nouvelle » (séquence de peur possible)
    if (m.stun > 0) { if (m.fx) m.fx = null; m.wind = 0; m.eng = null; m.stun -= dt; m.st = 'stun'; m.vx *= 0.8; m.vz *= 0.8; W.vertical(map, m, dt, R_MON, GRAV); if (m.stun <= 0) m.st = 'wander'; return; }
    let bn = W.nodeAt(map, m.x, m.y, m.z); if (bn < 0 || !map.nav.walk[bn]) bn = m.last; else m.last = bn;
    // séquence de peur en cours (traque silencieuse, coup d'œil, vague d'obscurité) : elle pilote l'entité
    if (m.fx && this.fxStep(m, dt, players, bn, ctx)) return;
    // élan avant la charge (le cri éclate, l'image tremble sur place) : pas de capture pendant ce temps
    if (m.wind > 0) { m.wind -= dt; m.st = 'chase'; m.vx *= 0.6; m.vz *= 0.6; W.vertical(map, m, dt, R_MON, GRAV); return; }
    // choix de la cible
    let goal = -1, tp = null, mode = 'wander', fld = null, best = 1e9;
    let dd = 1e9, dec = null; for (const d of this.decoys) { const k = Math.hypot(d.x - m.x, d.z - m.z, d.y - m.y); if (k < 34 && k < dd) { dd = k; dec = d; } }
    if (dec) { goal = dec.node; mode = 'chase'; fld = this.fieldTo(goal); }
    else if (targets.length && !(m.calm > 0) && (!grace || targets.some(t => Math.hypot(t.p.x - m.x, t.p.z - m.z) < 10 && Math.abs(t.p.y - m.y) < 2 && W.los(map, m.x, m.y + 1.2, m.z, t.p.x, t.p.y + 1.2, t.p.z)))) {   // un joueur à côté est toujours repéré, même pendant la période de grâce
      let bt = null;
      for (const t of targets) {
        const f = this.fieldTo(t.n), v = f[bn]; if (v < 0 || v >= best) continue;
        // joueur caché dans le noir (accroupi, immobile, sans lampe) : invisible, sauf s'il est frôlé ou déjà talonné
        if (t.p.hide && !this.senses(m, t.p)) continue;
        best = v; bt = t;
      }
      const range = df.hunt * (ctx.alarm ? 1.8 : 1) * (m.tgt != null ? 1.3 : 1) * (1 + 0.3 * lv);
      if (bt && best <= range) { goal = bt.n; tp = bt.p; mode = 'chase'; fld = this.fieldTo(goal); }
    }
    // prise en chasse : au lieu de foncer en hurlant, l'entité peut lancer une séquence de peur
    if (mode === 'chase' && tp && !dec) {
      if (m.eng !== tp.id) { m.eng = tp.id; m.chaseT = 0; m.noLos = 0; m.losT = 0; if (this.engage(m, tp, bn, ctx, best)) return; }
      m.engLost = 0; m.chaseT = (m.chaseT || 0) + dt;
      m.losT = (m.losT || 0) - dt;
      if (m.losT <= 0) {
        m.losT = 0.25;
        const see = W.los(map, m.x, m.y + 1.3, m.z, tp.x, tp.y + 1.4, tp.z);
        m.noLos = see ? 0 : (m.noLos || 0) + 0.25;
        const cfg = E.FEAR[ctx.fear] || E.FEAR.normal;
        if (!ctx.alarm && m.noLos > 4 && best > 8 && this.free(tp.id, m)) {
          // longue poursuite sans se voir : elle se tait… et revient autrement (dans le dos, à l'angle d'un mur, ou en éteignant tout)
          if (this.bigOk(tp.id, ctx) && rng() < cfg.quiet * (1 + lv) && this.engage(m, tp, bn, ctx, best, true)) return;
          // ou elle lâche prise un moment (répit) : la prochaine prise en chasse pourra être scénarisée
          if (m.chaseT > 45 && rng() < cfg.lull * (1 - 0.6 * lv)) { m.calm = 10 + rng() * 8; m.wt = 0; m.wgoal = -1; }
        }
      }
    } else if (m.eng != null) { m.engLost = (m.engLost || 0) + dt; if (m.engLost > 4) m.eng = null; }
    if (mode === 'wander') {
      m.wt -= dt;
      if (m.wgoal < 0 || m.wt <= 0 || m.wgoal === bn) {
        // errance attirée vers les joueurs, sans être exacte (sortie ouverte : toutes convergent vers eux)
        let pick = map.reach[Math.floor(rng() * map.reach.length)];
        if (targets.length && (this.converge || rng() < 0.6) && !(m.calm > 0)) { const t = targets[Math.floor(rng() * targets.length)], p = t.p; let bd = 1e9; for (let k = 0; k < 12; k++) { const n = map.reach[Math.floor(rng() * map.reach.length)], q = W.nodePos(map, n), d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd && (this.converge || d > 6)) { bd = d; pick = n; } } }
        m.wgoal = pick; m.wt = this.converge ? 4 + rng() * 3 : 8 + rng() * 8;
      }
      goal = m.wgoal; fld = this.fieldTo(goal);
    }
    m.st = mode; m.tgt = tp ? tp.id : null;
    const speed = (mode === 'chase' ? df.chase * (1 + Math.min(0.2, this.time / 700)) * (ctx.rage ? 1.07 : 1) * (ctx.alarm ? 1.05 : 1) * (1 + 0.05 * lv) * (m.burst > 0 ? 1.16 : 1)
      : df.wander * (grace ? 0.7 : 1) * (this.converge ? 1.35 : 1)) * m.boost;
    this.go(m, dt, bn, fld, tp, speed, mode === 'wander');
    // capture
    if (m.cool <= 0) for (const p of players) {
      if (p.down || p.escaped || p.dead || (p.inv || 0) > 0) continue;
      if (Math.hypot(p.x - m.x, p.z - m.z) < 1.15 && Math.abs(p.y - m.y) < 1.8) { m.cool = 1.5; this.cb.onCatch && this.cb.onCatch(m, p); break; }
    }
  };
  /** pilotage + déplacement + anti-blocage (commun à la chasse, à l'errance et aux séquences de peur) */
  D.go = function (m, dt, bn, fld, tp, speed, wander) {
    const W = WD(), map = this.map;
    // pilotage (seulement au sol : en l'air on garde l'élan, comme dans une chute)
    if (m.ground) {
      const aim = fld ? this.steer(m, bn, fld, tp) : null;
      if (aim) { const dx = aim.x - m.x, dz = aim.z - m.z, d = Math.hypot(dx, dz) || 1, k = Math.min(1, d / 0.3); m.vx = dx / d * speed * k; m.vz = dz / d * speed * k; }
      else { m.vx *= 0.5; m.vz *= 0.5; if (wander) m.wt = 0; }
    }
    const ox = m.x, oz = m.z;
    W.move(map, m, m.vx * dt, m.vz * dt, R_MON);
    W.vertical(map, m, dt, R_MON, GRAV);
    // anti-blocage : si l'entité ne bouge plus, on la recale sur le centre de sa case
    const mv = Math.hypot(m.x - ox, m.z - oz);
    if (m.ground && Math.hypot(m.vx, m.vz) > 0.5 && mv < Math.hypot(m.vx, m.vz) * dt * 0.25) {
      m.stuck += dt;
      if (m.stuck > 1.2) { m.stuck = 0; const p = W.nodePos(map, bn); if (!W.blocked(map, p.x, p.z, p.y, R_MON)) { m.x = p.x; m.z = p.z; m.y = p.y; } m.wt = 0; }
    } else m.stuck = Math.max(0, m.stuck - dt);
  };
  /** toutes les entités convergent (alarme finale) : plus rapides, l'errance les mène droit sur les joueurs */
  D.alertAll = function () { this.converge = true; for (const m of this.mons) { m.boost = Math.max(m.boost, 1.03); m.wt = 0; if (m.fx) m.fx = null; m.calm = 0; } };

  /* =====================================================================
     3. PEUR (hôte / solo) : séquences scénarisées. Les frayeurs partagées passent par cb.onFx(évènement),
        que game.js diffuse aux autres joueurs ; chaque client joue ensuite sa mise en scène.
     ===================================================================== */
  const cfgOf = ctx => E.FEAR[ctx.fear] || E.FEAR.normal;
  D.emit = function (e) { if (this.cb.onFx) this.cb.onFx(e); };
  D.bigOk = function (pid, ctx) { const l = this.fear.last[pid]; return l == null || this.time - l > cfgOf(ctx).gap * (1 - 0.35 * (ctx.lv || 0)); };
  // la frayeur est aussi vécue par les joueurs proches (ils voient la vague, entendent le cri) : pas de doublé pour eux non plus
  D.markBig = function (pid, r) {
    this.fear.last[pid] = this.time;
    const p = (this.players || []).find(q => q.id === pid); if (!p) return;
    for (const q of this.players) if (q !== p && Math.hypot(q.x - p.x, q.z - p.z) < (r || 12)) this.fear.last[q.id] = this.time;
  };
  // aucune autre entité n'est déjà en train de jouer une séquence sur ce joueur
  D.free = function (pid, m) { return !this.mons.some(o => o !== m && o.fx && o.fx.pid === pid); };
  /** ce joueur voit-il ce point ? (dans l'axe du regard, pas trop loin, rien entre les deux) */
  D.sees = function (p, x, y, z, cosMin, maxD) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > maxD || Math.abs(y - p.y) > 3.2) return false;
    if (d > 0.6 && (-dx * Math.sin(p.yaw || 0) - dz * Math.cos(p.yaw || 0)) / d < cosMin) return false;
    return WD().los(this.map, p.x, p.y + 1.55, p.z, x, y + 1.3, z);
  };
  /** joueur caché : l'entité le sent quand même si elle le frôle (et le fait savoir), ou si elle le talonnait déjà */
  D.senses = function (m, p) {
    const d = Math.hypot(p.x - m.x, p.z - m.z), dy = Math.abs(p.y - m.y);
    if ((this.fear.sniff[p.id] || 0) > this.time) return true;
    // elle te poursuivait : de près, ou si elle te voit encore, se cacher ne sert à rien (il faut d'abord casser la ligne de vue)
    if (m.tgt === p.id && dy < 2 && (d < 7 || (d < 20 && WD().los(this.map, m.x, m.y + 1.3, m.z, p.x, p.y + 0.9, p.z)))) return true;
    if (d < 2.3 && dy < 1.6) {
      this.fear.sniff[p.id] = this.time + 8;
      m.wind = 0.35; m.burst = 2.2; m.tgt = p.id; m.eng = p.id;
      this.emit({ e: 'sniff', id: m.id, p: p.id, sp: m.sp });
      return true;
    }
    return false;
  };
  /** nouvelle prise en chasse : traque silencieuse, coup d'œil ou vague d'obscurité (sinon, poursuite classique) */
  // forced : l'occasion vient d'une longue poursuite sans se voir (la chance a déjà été tirée)
  D.engage = function (m, p, bn, ctx, steps, forced) {
    if (ctx.alarm || !this.bigOk(p.id, ctx) || !this.free(p.id, m) || (p.smoke || 0) > 0) return false;
    // la toute première poursuite reste « classique » : c'est le premier contact (coup de son et ralenti côté joueur)
    if (this.time < (ctx.grace != null ? ctx.grace : this.diff.grace) + 20) return false;
    const W = WD(), cfg = cfgOf(ctx), lv = ctx.lv || 0, rng = this.rng;
    if (!forced && rng() > Math.min(0.9, cfg.eng * (0.75 + 0.5 * lv))) return false;    // de plus en plus fréquent au fil de la partie
    const d = Math.hypot(p.x - m.x, p.z - m.z), los = W.los(this.map, m.x, m.y + 1.3, m.z, p.x, p.y + 1.4, p.z);
    const opts = [];
    if (d > 15 && d < 75) opts.push(['dark', cfg.dark]);
    if (!los && steps > 5) opts.push(['stalk', cfg.stalk]);
    if (d > 9 && !this.sees(p, m.x, m.y, m.z, 0.5, 40)) opts.push(['peek', cfg.peek]);
    // tirage pondéré ; si la séquence choisie est impossible ici (pas d'angle de mur…), on essaie les autres
    while (opts.length) {
      let tot = 0; opts.forEach(o => { tot += o[1]; });
      let r = rng() * tot, i = 0; while (i < opts.length - 1 && (r -= opts[i][1]) > 0) i++;
      const k = opts.splice(i, 1)[0][0];
      if (k === 'dark') return this.startDark(m, p, d, cfg);
      if (k === 'stalk') return this.startStalk(m, p);
      if (k === 'peek' && this.startPeek(m, p, bn)) return true;
    }
    return false;
  };
  D.fxStep = function (m, dt, players, bn, ctx) {
    const fx = m.fx, p = players.find(q => q.id === fx.pid);
    fx.t += dt;
    if (!p || p.down || p.dead || p.escaped || ctx.alarm || (p.smoke || 0) > 0) { m.fx = null; return false; }
    if (fx.k === 'stalk') return this.stepStalk(m, fx, p, dt, bn);
    if (fx.k === 'peek') return this.stepPeek(m, fx, p, dt, bn);
    if (fx.k === 'dark') return this.stepDark(m, fx, p, dt, bn);
    m.fx = null; return false;
  };
  /** l'entité se dévoile : coup de son très fort chez le joueur, bref élan sur place, puis charge */
  D.reveal = function (m, p, wind, quiet) {
    m.fx = null; m.st = 'chase'; m.wind = wind; m.burst = 2.6; m.eng = p.id; m.tgt = p.id; m.chaseT = 0; m.noLos = 0;
    m.cool = Math.max(m.cool, wind + 0.2);
    this.markBig(p.id);
    this.emit({ e: 'reveal', id: m.id, p: p.id, sp: m.sp, q: quiet ? 1 : 0 });
  };

  /* ---------- 1. traque silencieuse : plus de cri, elle s'approche dans ton dos ---------- */
  D.startStalk = function (m, p) { m.fx = { k: 'stalk', pid: p.id, t: 0, seen: 0, nape: 0, hold: 0 }; m.st = 'stalk'; m.calm = 0; return true; };
  D.stepStalk = function (m, fx, p, dt, bn) {
    const W = WD(), d = Math.hypot(p.x - m.x, p.z - m.z), dy = Math.abs(p.y - m.y);
    m.st = 'stalk';
    // tu te retournes et tu la vois : elle hurle et charge
    // (élan plus long quand elle est tout près : le joueur a le temps de fuir s'il réagit aussitôt)
    if (this.sees(p, m.x, m.y, m.z, 0.8, 15)) { fx.seen += dt; if (fx.seen > 0.1) { this.reveal(m, p, d < 5 ? 0.6 : 0.4); return true; } } else fx.seen = 0;
    // souffle dans la nuque : elle s'arrête un instant… puis se dévoile quand même
    if (fx.hold > 0) { fx.hold -= dt; m.vx *= 0.7; m.vz *= 0.7; W.vertical(this.map, m, dt, R_MON, GRAV); if (fx.hold <= 0) this.reveal(m, p, 0.7); return true; }
    if (!fx.nape && d < 3.0 && dy < 1.5) { fx.nape = 1; fx.hold = 1.4; this.emit({ e: 'nape', id: m.id, p: p.id }); return true; }
    if (fx.t > 32) { if (d < 18) this.reveal(m, p, 0.6); else { m.fx = null; m.st = 'chase'; } return true; }
    const n = W.nodeAt(this.map, p.x, p.y, p.z); if (n < 0) return true;
    const fld = this.fieldTo(n);
    // vise un point juste derrière le joueur (le regard est dirigé vers -sin, -cos)
    const bk = { x: p.x + Math.sin(p.yaw || 0) * 1.7, y: p.y, z: p.z + Math.cos(p.yaw || 0) * 1.7 };
    const ps = p.speed || Math.hypot(p.vx || 0, p.vz || 0);
    const sp = d > 12 ? Math.max(5.6, Math.min(9.6, ps * 1.05)) : d > 6 ? Math.max(4.4, Math.min(7.2, ps)) : 2.9;
    this.go(m, dt, bn, fld, bk, sp, false);
    return true;
  };

  /* ---------- 2. coup d'œil : elle passe la tête à l'angle d'un mur, te regarde, puis se retire ---------- */
  D.findPeek = function (m, p, bn) {
    const W = WD(), map = this.map, rng = this.rng, f = Math.round(p.y / W.SH);
    if (f < 0 || f >= map.F || Math.abs(p.y - f * W.SH) > 0.3) return null;
    const pc = Math.floor(p.x / W.C), pr = Math.floor(p.z / W.C), ey = p.y + 1.55;
    const fwd = W.forward(map, bn);     // distances (en pas) depuis l'entité
    let best = null, bs = -1e9;
    for (let k = 0; k < 140; k++) {
      const a = rng() * 6.283, r = 3.5 + rng() * 3.5;     // 7 à 14 m : assez près pour la reconnaître malgré le brouillard
      const cx = pc + Math.round(Math.cos(a) * r), cy = pr + Math.round(Math.sin(a) * r);
      if (cx < 1 || cy < 1 || cx >= map.W - 1 || cy >= map.H - 1) continue;
      const i = cy * map.W + cx, n = f * map.WH + i;
      if (map.t[f][i] !== W.FLOOR || !map.nav.walk[n] || map.propAt[f][i] >= 0) continue;
      const P = W.nodePos(map, n);
      if (!W.los(map, p.x, ey, p.z, P.x, P.y + 1.5, P.z)) continue;
      for (const [dx, dy] of D4) {
        const j = (cy + dy) * map.W + cx + dx, h = f * map.WH + j;
        if (map.t[f][j] !== W.FLOOR || !map.nav.walk[h] || map.propAt[f][j] >= 0) continue;
        const Hh = W.nodePos(map, h), steps = fwd[h];
        if (steps < 0 || steps > 42) continue;
        if (W.los(map, p.x, ey, p.z, Hh.x, Hh.y + 1.5, Hh.z)) continue;      // la cachette doit être hors de vue
        // limite de visibilité entre la cachette et l'angle : on s'arrête juste après
        let s0 = -1; for (let s = 0.1; s <= 1.0001; s += 0.1) { if (W.los(map, p.x, ey, p.z, Hh.x + (P.x - Hh.x) * s, Hh.y + 1.5, Hh.z + (P.z - Hh.z) * s)) { s0 = s; break; } }
        if (s0 < 0.35) continue;       // l'angle doit être assez loin de la cachette pour que l'image y soit bien cachée
        const vx = P.x - p.x, vz = P.z - p.z, dd = Math.hypot(vx, vz) || 1, front = (-vx * Math.sin(p.yaw || 0) - vz * Math.cos(p.yaw || 0)) / dd;
        const sc = front * 2 - steps * 0.04 + rng() * 0.6;
        if (sc > bs) {
          bs = sc;
          const out = Math.min(1, s0 + 0.32), hid = Math.max(0, s0 - 0.45);    // dehors : environ la moitié de l'image dépasse de l'angle
          best = { h, hx: Hh.x + (P.x - Hh.x) * hid, hz: Hh.z + (P.z - Hh.z) * hid, px: Hh.x + (P.x - Hh.x) * out, pz: Hh.z + (P.z - Hh.z) * out, y: Hh.y };
        }
      }
    }
    return best;
  };
  D.startPeek = function (m, p, bn) {
    const s = this.findPeek(m, p, bn); if (!s) return false;
    m.fx = { k: 'peek', pid: p.id, t: 0, ph: 'go', s, seen: 0, look: 1.4 + this.rng() * 1.4, marked: false };
    m.st = 'lurk'; m.calm = 0;
    return true;
  };
  // glisse l'entité vers un point (pas de chemin : la cachette et l'angle sont voisins)
  function slide(m, x, z, v, dt) {
    const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz);
    if (d < 0.03) { m.vx = m.vz = 0; return true; }
    const k = Math.min(1, v * dt / d); WD().move(this.map, m, dx * k, dz * k, R_MON * 0.8); m.vx = dx / d * v; m.vz = dz / d * v;
    return Math.hypot(x - m.x, z - m.z) < 0.06;
  }
  D.stepPeek = function (m, fx, p, dt, bn) {
    const W = WD(), s = fx.s, d = Math.hypot(p.x - m.x, p.z - m.z);
    if (fx.t > 26) { m.fx = null; m.st = 'chase'; return false; }
    if (fx.ph === 'go') {
      m.st = 'lurk';
      // repérée en chemin : de près elle se dévoile et charge ; de loin, simple poursuite (elle se remet à hurler)
      if (this.sees(p, m.x, m.y, m.z, 0.82, 16)) { fx.seen += dt; if (fx.seen > 0.3) { if (d < 10) this.reveal(m, p, 0.45); else { m.fx = null; m.st = 'chase'; } return true; } } else fx.seen = 0;
      const near = Math.hypot(s.hx - m.x, s.hz - m.z) < 0.5;
      if (near || bn === s.h) { fx.ph = 'out'; fx.seen = 0; return true; }
      this.go(m, dt, bn, this.fieldTo(s.h), { x: s.hx, y: s.y, z: s.hz }, 8.5, false);
      return true;
    }
    W.vertical(this.map, m, dt, R_MON, GRAV);
    if (fx.ph === 'out') { m.st = 'peek'; if (slide.call(this, m, s.px, s.pz, 1.5, dt)) fx.ph = 'look'; return true; }
    if (fx.ph === 'look') {
      m.st = 'peek'; m.vx = m.vz = 0;
      if (this.sees(p, m.x, m.y, m.z, 0.86, 30)) { fx.seen += dt; if (!fx.marked && fx.seen > 0.25) { fx.marked = true; this.markBig(p.id); } }
      fx.look -= dt;
      if (d < 5) { this.reveal(m, p, 0.3); return true; }
      if (fx.look <= 0 || fx.seen > 0.7) fx.ph = 'in';
      return true;
    }
    if (fx.ph === 'in') {
      m.st = 'lurk';
      if (slide.call(this, m, s.hx, s.hz, 4.2, dt)) {
        // le plus souvent elle disparaît (et reviendra plus tard) ; parfois elle surgit
        if (this.rng() < 0.28) this.reveal(m, p, 0.5, true);
        else { m.fx = null; m.st = 'wander'; m.calm = 7 + this.rng() * 6; m.wt = 0; m.wgoal = -1; }
      }
      return true;
    }
    m.fx = null; return false;
  };

  /* ---------- 3. vague d'obscurité : les néons s'éteignent un par un jusqu'à toi, silence total, puis le cri ---------- */
  D.startDark = function (m, p, d, cfg) {
    const v = Math.max(7, Math.min(16, d / 2.2)), sil = cfg.sil;
    m.fx = { k: 'dark', pid: p.id, t: 0, dur: d / v + sil }; m.st = 'lurk'; m.calm = 0;
    this.markBig(p.id, 20);
    this.emit({ e: 'dark', id: m.id, p: p.id, x: r2(m.x), y: r2(m.y), z: r2(m.z), v: r2(v), s: sil, r: r2(d + 7) });
    return true;
  };
  D.stepDark = function (m, fx, p, dt, bn) {
    m.st = 'lurk';
    if (fx.t >= fx.dur) {
      m.fx = null; m.st = 'chase'; m.wind = 0.3; m.burst = 3; m.eng = p.id; m.tgt = p.id; m.chaseT = 0; m.noLos = 0;
      this.emit({ e: 'scream', id: m.id, p: p.id, sp: m.sp, x: r2(m.x), y: r2(m.y), z: r2(m.z) });
      return true;
    }
    // elle avance lentement, sans un bruit, pendant que la lumière meurt
    const n = WD().nodeAt(this.map, p.x, p.y, p.z);
    if (n >= 0) this.go(m, dt, bn, this.fieldTo(n), p, 1.6, false); else WD().vertical(this.map, m, dt, R_MON, GRAV);
    return true;
  };
})();

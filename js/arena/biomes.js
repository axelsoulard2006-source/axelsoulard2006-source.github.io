/* ===== arena/biomes.js : décors de l'Ascension — de la prairie ensoleillée jusqu'au Néant =====
   Chaque étage a son monde : un ciel (soleil, nuages, lune, étoiles), un terrain qui monte en collines autour de
   l'arène (jouable : disque plat de 34 m), des éléments low-poly modélisés ici (arbres, moutons, colonnes, tombes,
   lave…) dessinés en quelques appels (instanciation), quelques lumières et des particules d'ambiance.
   Même interface que BR.ArenaScene.build : { group, theme, key, floor, floorMat, update(dt, fx), dispose() }. */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, AS = BR.ArenaScene;
  const R = AS.R;
  const L = c => new THREE.Color(c).convertSRGBToLinear();
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ---------- bruit 2D (relief, teintes) ---------- */
  function hash2(x, z, s) { let n = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(s, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
  function noise2(x, z, s) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  const fbm2 = (x, z, s) => noise2(x, z, s) * 0.55 + noise2(x * 2.1, z * 2.1, s + 7) * 0.3 + noise2(x * 4.3, z * 4.3, s + 13) * 0.15;

  /* ---------- textures de détail (tuiles répétées) ---------- */
  function cv(n, fn) { const c = document.createElement('canvas'); c.width = c.height = n; fn(c.getContext('2d'), n); return c; }
  function tex(c, rep, srgb) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; if (srgb !== false) t.encoding = THREE.sRGBEncoding; return t; }
  // brins / grain en niveaux de gris : la couleur vient du terrain (couleurs de sommets)
  const DETAIL = {
    grass: (g, n) => { g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, n, n); for (let i = 0; i < 40; i++) { const v = 170 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 10 + Math.random() * 30, 0, 7); g.fill(); }
      for (let i = 0; i < 3200; i++) { const x = Math.random() * n, y = Math.random() * n, l = 2 + Math.random() * 4, a = Math.random() * 6.283, v = 160 + Math.random() * 95 | 0; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1 + Math.random() * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } },
    soil: (g, n) => { g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { const v = 140 + Math.random() * 115 | 0; g.fillStyle = `rgba(${v},${v},${v},0.7)`; g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 1 + Math.random() * 5, 0, 7); g.fill(); } },
    snow: (g, n) => { g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, n, n); for (let i = 0; i < 700; i++) { const v = 205 + Math.random() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v},0.6)`; g.beginPath(); g.ellipse(Math.random() * n, Math.random() * n, 3 + Math.random() * 14, 2 + Math.random() * 5, Math.random() * 3, 0, 7); g.fill(); } },
  };
  // dallages colorés (sol de l'arène)
  function paving(kind, n) {
    return cv(n, (g) => {
      const P = { sand: ['#b9a07c', '#a88e6a', '#6b5c48', '#6f8a4a'], temple: ['#a8987e', '#968670', '#4a3e34', null], dark: ['#3a3640', '#2e2b34', '#141218', null], basalt: ['#26201e', '#1c1816', '#050303', null] }[kind];
      g.fillStyle = P[2]; g.fillRect(0, 0, n, n);
      const cells = kind === 'basalt' ? 5 : 4, s = n / cells;
      for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
        const off = (j % 2) * s * 0.5, x = i * s + off, y = j * s, v = 0.86 + Math.random() * 0.2;
        const c = new THREE.Color(Math.random() < 0.5 ? P[0] : P[1]).multiplyScalar(v);
        g.fillStyle = '#' + c.getHexString();
        for (const dx of [0, -n]) { if (kind === 'basalt') { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + Math.random() * 0.3, r = s * (0.42 + Math.random() * 0.08); g.lineTo(x + dx + s / 2 + Math.cos(a) * r, y + s / 2 + Math.sin(a) * r); } g.fill(); } else g.fillRect(x + dx + 3, y + 3, s - 6, s - 6); }
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 3, y + 3, s - 6, 4);
      }
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 2 + Math.random() * 10, 0, 7); g.fill(); }
      if (P[3]) for (let i = 0; i < 160; i++) { const x = Math.round(Math.random() * cells) * s + (Math.random() - 0.5) * 8, y = Math.random() * n; g.fillStyle = P[3]; g.fillRect(x - 2, y, 4, 3 + Math.random() * 6); }
    });
  }

  /* ---------- ciel : dégradé, astre, halo, nuages, étoiles ---------- */
  const SKY_FS = `uniform vec3 top, mid, hor, sunCol, cloudCol, sunDir; uniform float sunSize, sunGlow, cloudAmt, stars, uTime, flash; varying vec3 vP;
    float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
    float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y), mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
    void main(){
      float y = vP.y;
      vec3 c = mix(hor, mid, smoothstep(-0.02, 0.28, y)); c = mix(c, top, smoothstep(0.28, 0.95, y));
      c = mix(c, hor * 0.7, smoothstep(0.0, -0.4, y));
      vec3 sd = normalize(sunDir); float d = max(dot(vP, sd), 0.0);
      c += sunCol * (pow(d, 6.0) * 0.22 + pow(d, 40.0) * 0.35) * sunGlow;
      float disk = smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, d);
      vec2 cp = vP.xz / max(0.06, y + 0.12) * 0.55 + vec2(uTime * 0.008, uTime * 0.003);
      float cl = fbm(vec3(cp * 1.4, 0.5)); cl = smoothstep(1.0 - cloudAmt, 1.0 - cloudAmt + 0.32, cl) * smoothstep(-0.02, 0.16, y);
      vec3 cc = cloudCol * (0.75 + 0.35 * smoothstep(0.2, 0.9, fbm(vec3(cp * 2.6, 3.0)))) + sunCol * pow(d, 8.0) * 0.4;
      c = mix(c, sunCol * 1.5, disk * (1.0 - cl * 0.8));
      c = mix(c, cc, cl * 0.9);
      vec3 q = floor(vP * 280.0); c += vec3(step(0.996, h(q)) * smoothstep(0.05, 0.4, y) * stars * (0.5 + 0.8 * h(q + 3.0))) * (1.0 - cl);
      c += vec3(0.55, 0.5, 0.8) * flash * smoothstep(-0.1, 0.6, y);
      gl_FragColor = vec4(c, 1.0);
    }`;
  function sky(def) {
    const s = def.sky, U = { top: { value: L(s.top) }, mid: { value: L(s.mid) }, hor: { value: L(s.hor) }, sunCol: { value: L(s.sun || '#ffffff') }, cloudCol: { value: L(s.cloud || '#ffffff') }, sunDir: { value: new V3().fromArray(s.dir || [0.5, 0.5, -0.6]) },
      sunSize: { value: s.size || 0 }, sunGlow: { value: s.glow == null ? 1 : s.glow }, cloudAmt: { value: s.clouds || 0 }, stars: { value: s.stars || 0 }, uTime: { value: 0 }, flash: { value: 0 } };
    const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U, fragmentShader: SKY_FS,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }' });
    const m = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat); m.renderOrder = -10; m.frustumCulled = false;
    m.onBeforeRender = (r, sc, cam) => { m.position.copy(cam.position); };
    return m;
  }

  /* ---------- pièces low-poly (instanciées : une pièce = un appel de dessin, quel que soit leur nombre) ---------- */
  function kit(rng, quality) {
    const geos = {
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 7).translate(0, 0.5, 0), trunk: new THREE.CylinderGeometry(0.3, 0.5, 1, 6).translate(0, 0.5, 0),
      cone: new THREE.ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0), spike: new THREE.ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0),
      blob: new THREE.IcosahedronGeometry(0.5, 0), rock: (() => { const gg = new THREE.IcosahedronGeometry(0.5, 1), p = gg.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.78 + Math.random() * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); } gg.computeVertexNormals(); return gg; })(),
      box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), boxc: new THREE.BoxGeometry(1, 1, 1),
      cap: new THREE.SphereGeometry(0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), tuft: new THREE.ConeGeometry(0.07, 0.5, 3).translate(0, 0.25, 0),
      disk: new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2), plane: new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), sph: new THREE.SphereGeometry(0.5, 10, 8),
      tomb: (() => { const gg = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12, 1, false, 0, Math.PI); gg.rotateX(Math.PI / 2); gg.rotateZ(Math.PI / 2); gg.translate(0, 1, 0); return gg; })(),
    };
    const mats = {
      std: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.02, flatShading: true }),
      soft: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: false }),
      metal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.75, flatShading: true }),
      water: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0.65 }),
      cloth: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }),
    };
    const glow = {};
    const glowMat = hex => glow[hex] || (glow[hex] = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: L(hex), emissiveIntensity: 2.2, roughness: 0.5 }));
    const parts = new Map(), q = new THREE.Quaternion(), e = new THREE.Euler(), m4 = new THREE.Matrix4(), sv = new V3(), pv = new V3();
    const K = {
      rng, low: quality === 'low', geos, mats, glowMat,
      /** une pièce : g = géométrie, m = matériau (ou 'glow:#hex'), p = position, r = rotation [x,y,z], s = échelle (nombre ou [x,y,z]), c = couleur */
      add(g, m, p, r, s, c, shadow) {
        const key = g + '|' + m; let P = parts.get(key); if (!P) { P = { g, m, list: [], shadow: false }; parts.set(key, P); }
        e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); q.setFromEuler(e); pv.set(p[0], p[1], p[2]); if (typeof s === 'number') sv.set(s, s, s); else sv.set(s[0], s[1], s[2]);
        m4.compose(pv, q, sv); P.list.push({ mat: m4.clone(), c: c != null ? L(c) : null }); if (shadow) P.shadow = true;
      },
      flush(group) {
        parts.forEach(P => {
          const mat = P.m.startsWith('glow:') ? glowMat(P.m.slice(5)) : mats[P.m];
          const im = new THREE.InstancedMesh(geos[P.g], mat, P.list.length);
          P.list.forEach((it, i) => { im.setMatrixAt(i, it.mat); if (it.c) im.setColorAt(i, it.c); else if (im.instanceColor || P.list.some(x => x.c)) im.setColorAt(i, new THREE.Color(1, 1, 1)); });
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
          im.castShadow = P.shadow && !K.low; im.receiveShadow = true; im.frustumCulled = false;
          group.add(im);
        });
      },
      dispose() { Object.values(geos).forEach(g => g.dispose()); Object.values(mats).forEach(m => m.dispose()); Object.values(glow).forEach(m => m.dispose()); },
    };
    return K;
  }

  /* ---------- éléments composés ---------- */
  const P = {
    tree(K, x, y, z, s, cols, trunk) { const r = K.rng; K.add('trunk', 'std', [x, y, z], [0, r() * 6, 0], [0.55 * s, 2.4 * s, 0.55 * s], trunk || '#6b4a2e', true);
      const n = 2 + (r() * 2 | 0); for (let i = 0; i < n; i++) K.add('blob', 'std', [x + (r() - 0.5) * 1.2 * s, y + (2.6 + r() * 1.2 + i * 0.5) * s, z + (r() - 0.5) * 1.2 * s], [r() * 3, r() * 3, 0], (2.2 + r() * 1.3) * s, cols[(r() * cols.length) | 0], true); },
    pine(K, x, y, z, s, col, snow) { const r = K.rng; K.add('trunk', 'std', [x, y, z], null, [0.5 * s, 1.6 * s, 0.5 * s], '#4a3424', true);
      for (let i = 0; i < 3; i++) { const w = (2.8 - i * 0.7) * s, yy = y + (1.2 + i * 1.5) * s; K.add('cone', 'std', [x, yy, z], [0, r() * 3, 0], [w, 2.4 * s, w], col, true); if (snow) K.add('cone', 'std', [x, yy + 1.1 * s, z], [0, r() * 3, 0], [w * 0.62, 1.3 * s, w * 0.62], '#f2f6ff'); } },
    dead(K, x, y, z, s, col) { const r = K.rng, lean = (r() - 0.5) * 0.25;
      K.add('trunk', 'std', [x, y, z], [lean, r() * 6, 0], [0.5 * s, 4.5 * s, 0.5 * s], col, true);
      for (let i = 0; i < 4; i++) { const a = r() * 6.283, h = (2 + r() * 2.2) * s; K.add('trunk', 'std', [x + Math.sin(a) * 0.1, y + h, z + Math.cos(a) * 0.1], [Math.cos(a) * (0.7 + r() * 0.5), 0, -Math.sin(a) * (0.7 + r() * 0.5)], [0.18 * s, (1.4 + r() * 1.4) * s, 0.18 * s], col, true); } },
    rock(K, x, y, z, s, col) { const r = K.rng; K.add('rock', 'std', [x, y + s * 0.15, z], [r() * 3, r() * 6, r() * 3], [s * (1 + r() * 0.6), s * (0.7 + r() * 0.6), s * (1 + r() * 0.6)], col, true); },
    column(K, x, y, z, h, col, broken) { const r = K.rng;
      K.add('box', 'std', [x, y, z], [0, r() * 0.3, 0], [2, 0.5, 2], col, true);
      K.add('cyl', 'std', [x, y + 0.5, z], [broken ? (r() - 0.5) * 0.12 : 0, r() * 3, 0], [1.3, h, 1.3], col, true);
      if (!broken) K.add('box', 'std', [x, y + 0.5 + h, z], [0, r() * 0.3, 0], [1.9, 0.5, 1.9], col, true);
      else { K.add('rock', 'std', [x + (r() - 0.5) * 3, y + 0.3, z + (r() - 0.5) * 3], [r() * 3, r() * 3, r() * 3], [1.2, 0.9, 1.2], col, true); } },
    tomb(K, x, y, z, rot, col, kind) {
      if (kind === 0) { K.add('box', 'std', [x, y - 0.05, z], [(K.rng() - 0.5) * 0.25, rot, (K.rng() - 0.5) * 0.2], [1.1, 1.0, 0.3], col, true); K.add('tomb', 'std', [x, y - 0.05, z], [0, rot, 0], [1.1, 1.1, 1], col, true); }
      else if (kind === 1) { K.add('box', 'std', [x, y - 0.05, z], [(K.rng() - 0.5) * 0.3, rot, (K.rng() - 0.5) * 0.3], [0.25, 1.8, 0.25], col, true); K.add('boxc', 'std', [x, y + 1.25, z], [0, rot, 0], [1.0, 0.25, 0.25], col, true); }
      else { K.add('box', 'std', [x, y - 0.1, z], [0, rot, 0], [1.2, 0.35, 2.2], col, true); K.add('box', 'std', [x, y + 0.25, z], [0, rot, 0], [0.9, 0.25, 1.9], col, true); }
    },
  };
  // positions aléatoires dans une couronne
  function ring(rng, n, r0, r1, fn) { for (let i = 0; i < n; i++) { const a = rng() * Math.PI * 2, r = r0 + Math.sqrt(rng()) * (r1 - r0); fn(Math.cos(a) * r, Math.sin(a) * r, a, r, i); } }

  /* =====================================================================
     LES MONDES
     ===================================================================== */
  const B = {};
  // 1 — PRAIRIE : grand ciel bleu, collines vertes, fleurs, moutons, papillons
  B.prairie = { n: 'Prairie', accent: 0xffd84a,
    sky: { top: '#2f7fd8', mid: '#7fb9ee', hor: '#d6ecf8', sun: '#fff2c8', dir: [0.45, 0.62, -0.64], size: 0.0035, glow: 1.2, cloud: '#ffffff', clouds: 0.46 },
    fog: ['#bcd9ee', 0.0034], hemi: ['#cfe6ff', '#3f6a2a', 0.82], key: ['#fff0d0', 2.5, [40, 60, 25]], amb: 0.08,
    ground: { detail: 'grass', c1: '#4a8f30', c2: '#67a63a', hill: '#4a8c34', far: '#6a9a58', amp: 16, rep: 80 },
    props(K, H) {
      const r = K.rng;
      ring(r, K.low ? 40 : 70, R + 7, R + 80, (x, z) => P.tree(K, x, H(x, z), z, 1.1 + r() * 0.9, ['#3f8a30', '#5ea840', '#2f7a2c', '#78b84a']));
      ring(r, 14, R + 5, R + 60, (x, z) => P.rock(K, x, H(x, z), z, 0.6 + r() * 1.6, '#9aa0a0'));
      // clôture en bois (un passage tous les 90°)
      for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; if (i % 18 < 2) continue; const x = Math.cos(a) * (R + 2.4), z = Math.sin(a) * (R + 2.4); K.add('box', 'std', [x, 0, z], [0, -a, 0], [0.22, 1.25, 0.22], '#8a6640', true);
        const a2 = (i + 0.5) / 72 * Math.PI * 2, x2 = Math.cos(a2) * (R + 2.4), z2 = Math.sin(a2) * (R + 2.4); if (i % 18 !== 17) for (const hh of [0.45, 0.95]) K.add('boxc', 'std', [x2, hh, z2], [0, -a2, 0], [0.1, 0.12, 2 * Math.PI * (R + 2.4) / 72], '#a07a4c', true); }
      // fleurs et herbes hautes (aussi un peu dans l'arène)
      const fc = ['#ffffff', '#ffe14a', '#ff7ab0', '#b98cff', '#ff5a4a', '#7ad0ff'];
      ring(r, K.low ? 260 : 520, 6, R + 50, (x, z) => { const h = 0.35 + r() * 0.35; K.add('cyl', 'soft', [x, H(x, z), z], [(r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2], [0.025, h, 0.025], '#3e7a2a'); K.add('blob', 'std', [x, H(x, z) + h, z], [r(), r(), 0], 0.16 + r() * 0.07, fc[(r() * fc.length) | 0]); });
      // moutons qui broutent derrière la clôture
      const sheep = [];
      ring(r, 9, R + 6, R + 28, (x, z, a) => { const y = H(x, z), yaw = r() * 6.283;
        K.add('blob', 'soft', [x, y + 0.75, z], [0, yaw, 0], [1.5, 1.05, 1.1], '#f4f2ea', true); K.add('blob', 'soft', [x, y + 1.05, z], [0, yaw, 0], [1.1, 0.8, 1.2], '#fbfaf4', true);
        K.add('boxc', 'std', [x + Math.sin(yaw) * 0.9, y + 0.95, z + Math.cos(yaw) * 0.9], [0.3, yaw, 0], [0.42, 0.5, 0.55], '#2a2622', true);
        for (const [dx, dz] of [[0.35, 0.3], [-0.35, 0.3], [0.35, -0.3], [-0.35, -0.3]]) { const ca = Math.cos(yaw), sa = Math.sin(yaw); K.add('cyl', 'std', [x + dx * ca + dz * sa, y, z - dx * sa + dz * ca], null, [0.14, 0.45, 0.14], '#2a2622'); }
        sheep.push({ x, z, y, yaw }); void a; });
      return { sheep };
    },
    fx: { color: 0xfff4a0, rate: 14, kind: 'pollen' }, butterflies: 10,
    grass: { base: '#2c6418', tip: '#7fbf45', nIn: 11000, nOut: 9000 },
  };
  // 2 — LISIÈRE DORÉE : forêt en fin d'après-midi, champignons, troncs couchés, feuilles qui tombent
  B.foret = { n: 'Lisière dorée', accent: 0xffb24a,
    sky: { top: '#4b6aa8', mid: '#e9b07a', hor: '#ffd6a0', sun: '#ffb860', dir: [-0.62, 0.17, -0.76], size: 0.008, glow: 2.4, cloud: '#ffd2a6', clouds: 0.36 },
    fog: ['#d8a878', 0.006], hemi: ['#ffe0b8', '#3a4420', 0.7], key: ['#ffb26a', 2.5, [-50, 22, -45]], amb: 0.08,
    ground: { detail: 'grass', c1: '#5e7d30', c2: '#7a7a32', hill: '#4c6a2c', far: '#5a6a38', amp: 12, rep: 70 },
    props(K, H) {
      const r = K.rng;
      ring(r, K.low ? 80 : 150, R + 4, R + 60, (x, z) => { if (r() < 0.55) P.pine(K, x, H(x, z), z, 1 + r() * 0.9, r() < 0.5 ? '#2f5a2c' : '#3e6a30'); else P.tree(K, x, H(x, z), z, 1 + r() * 0.7, ['#c8862e', '#e0a23a', '#9aa83a', '#d9702a', '#6a8a30']); });
      ring(r, 20, R + 3, R + 20, (x, z) => { const y = H(x, z), s = 0.6 + r() * 1.1; K.add('cyl', 'std', [x, y, z], null, [0.3 * s, 0.8 * s, 0.3 * s], '#efe6d2'); K.add('cap', 'std', [x, y + 0.75 * s, z], null, [1.3 * s, 0.9 * s, 1.3 * s], r() < 0.6 ? '#d8322a' : '#c88a3a', true); });
      ring(r, 8, R + 4, R + 25, (x, z, a) => K.add('trunk', 'std', [x, H(x, z) + 0.5, z], [Math.PI / 2, a, 0], [1, 6 + r() * 4, 1], '#5a4028', true));
      ring(r, 14, R + 3, R + 30, (x, z) => K.add('trunk', 'std', [x, H(x, z), z], null, [1.4, 0.7, 1.4], '#6a4a2e', true));
      ring(r, K.low ? 60 : 130, R + 3, R + 40, (x, z) => { const y = H(x, z), s = 0.7 + r() * 0.9; for (let k = 0; k < 3; k++) K.add('blob', 'std', [x + (r() - 0.5) * s, y + s * 0.35, z + (r() - 0.5) * s], [r() * 3, r() * 3, 0], s * (0.9 + r() * 0.4), r() < 0.5 ? '#4e6e26' : '#6a7a2e', true); });
      ring(r, 16, R + 4, R + 40, (x, z) => P.rock(K, x, H(x, z), z, 0.6 + r() * 1.2, '#7a7a6a'));
    },
    fx: { color: 0xffa040, rate: 10, kind: 'leaves' },
    grass: { base: '#3a4a16', tip: '#b0a048', nIn: 9000, nOut: 8000 },
  };
  // 3 — RUINES AU CRÉPUSCULE : dallage envahi d'herbe, colonnes brisées, ciel rose
  B.ruines = { n: 'Ruines au crépuscule', accent: 0xff8a6a,
    sky: { top: '#262250', mid: '#b0577a', hor: '#ff9a5e', sun: '#ffb08a', dir: [0.7, 0.07, -0.7], size: 0.012, glow: 2.6, cloud: '#c86a8a', clouds: 0.42 },
    fog: ['#9a5a74', 0.0055], hemi: ['#ffb8b0', '#3a2a30', 0.7], key: ['#ff9a72', 2.2, [55, 14, -50]], amb: 0.08,
    ground: { detail: 'grass', c1: '#76804a', c2: '#8a8250', hill: '#7a6a58', far: '#6a5260', amp: 14, rep: 70 }, floor: { kind: 'sand', rep: 9 },
    props(K, H) {
      const r = K.rng;
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + 0.1, rr = R + 3.5 + (i % 2) * 2.5, x = Math.cos(a) * rr, z = Math.sin(a) * rr; P.column(K, x, H(x, z), z, 6 + r() * 7, '#c0a888', r() < 0.55); }
      // arches
      for (const a of [0.8, 2.9, 4.9]) { const x = Math.cos(a) * (R + 13), z = Math.sin(a) * (R + 13), y = H(x, z), t = a + Math.PI / 2, dx = Math.cos(t) * 3.5, dz = Math.sin(t) * 3.5;
        P.column(K, x + dx, y, z + dz, 7, '#b89c7c', false); P.column(K, x - dx, y, z - dz, 7, '#b89c7c', false); K.add('boxc', 'std', [x, y + 8.5, z], [0, -a, 0], [2.2, 1.2, 9.5], '#a88e70', true); }
      ring(r, 40, R + 3, R + 45, (x, z) => P.rock(K, x, H(x, z), z, 0.5 + r() * 1.6, r() < 0.5 ? '#a89070' : '#8a7860'));
      ring(r, 30, R + 6, R + 70, (x, z) => P.tree(K, x, H(x, z), z, 0.8 + r() * 0.6, ['#5a6a3a', '#6a7a40', '#4a5a34']));
    },
    fx: { color: 0xffc8a0, rate: 8, kind: 'dust' },
    grass: { base: '#4a5426', tip: '#b8b468', nIn: 0, nOut: 6000 },
  };
  // 4 — TEMPLE DU SOLEIL COUCHANT (gardien) : terrasse sacrée, colonnade, braseros géants, statues
  B.temple = { n: 'Temple du soleil couchant', accent: 0xff7a2a,
    sky: { top: '#1a1838', mid: '#8a2c3a', hor: '#ff6a32', sun: '#ff7a3a', dir: [0, 0.1, -1], size: 0.03, glow: 3, cloud: '#6a2a3a', clouds: 0.3 },
    fog: ['#5a2630', 0.008], hemi: ['#ffb08a', '#2a1418', 0.75], key: ['#ff8a4a', 1.9, [0, 18, -60]], amb: 0.14,
    ground: { detail: 'soil', c1: '#7a5a46', c2: '#8a6a50', hill: '#6a4a40', far: '#4a2a30', amp: 22, rep: 60 }, floor: { kind: 'temple', rep: 10, rune: true },
    props(K, H) {
      const r = K.rng;
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, x = Math.cos(a) * (R + 4), z = Math.sin(a) * (R + 4); P.column(K, x, 0, z, 11, '#c8b090', false); }
      // marches de la terrasse
      for (let k = 0; k < 4; k++) K.add('cyl', 'std', [0, -0.6 - k * 0.6, 0], null, [(R + 7 + k * 3) * 2, 0.6, (R + 7 + k * 3) * 2], k % 2 ? '#a08a70' : '#b09a7c', false);
      // statues de gardiens agenouillés (tournés vers l'arène)
      for (const a of [-Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5, Math.PI / 2]) { const x = Math.cos(a) * (R + 17), z = Math.sin(a) * (R + 17), y = 0, yaw = Math.atan2(-x, -z), c = '#9a8a74';
        K.add('box', 'std', [x, y - 2, z], [0, yaw, 0], [7, 3, 7], '#8a7a66', true);
        K.add('box', 'std', [x, y + 1, z], [0.15, yaw, 0], [4, 6, 3], c, true); K.add('boxc', 'std', [x + Math.sin(yaw) * 0.4, y + 8.2, z + Math.cos(yaw) * 0.4], [0.2, yaw, 0], [2.4, 2.6, 2.4], c, true);
        K.add('boxc', 'std', [x + Math.sin(yaw) * 2.2, y + 6.5, z + Math.cos(yaw) * 2.2], [0, yaw, 0], [0.5, 11, 0.5], '#c8a86a', true); K.add('boxc', 'std', [x + Math.sin(yaw) * 2.2, y + 9, z + Math.cos(yaw) * 2.2], [0, yaw, 0], [3, 0.5, 0.5], '#c8a86a', true); }
      ring(r, 24, R + 22, R + 70, (x, z) => P.rock(K, x, H(x, z), z, 2 + r() * 4, '#6a4a44'));
    },
    lights: [{ col: '#ff8a3a', n: 4, r: R + 1.2, h: 3.2, brazier: true }],
    fx: { color: 0xff8a3a, rate: 18, kind: 'embers' },
  };
  // 5 — MARAIS BRUMEUX : boue, flaques, arbres morts, roseaux, feux follets
  B.marais = { n: 'Marais brumeux', accent: 0x7affc0,
    sky: { top: '#16241f', mid: '#33483f', hor: '#6a7a62', sun: '#c8d8a8', dir: [-0.3, 0.25, -0.9], size: 0.006, glow: 1.2, cloud: '#4a5a50', clouds: 0.72 },
    fog: ['#46564a', 0.02], hemi: ['#a0b896', '#18201a', 0.75], key: ['#c8d8a8', 1.0, [-30, 40, -60]], amb: 0.16,
    ground: { detail: 'soil', c1: '#3e3a24', c2: '#2e3620', hill: '#2a3220', far: '#26302a', amp: 7, rep: 60 },
    props(K, H) {
      const r = K.rng;
      ring(r, 30, R + 4, R + 24, (x, z) => P.dead(K, x, H(x, z), z, 1 + r() * 0.9, '#3a3226'));
      ring(r, 18, R + 24, R + 70, (x, z) => P.dead(K, x, H(x, z), z, 1.3 + r() * 1.2, '#2e2a20'));
      ring(r, 50, R + 3, R + 70, (x, z) => K.add('disk', 'water', [x, H(x, z) + 0.03, z], [0, r() * 3, 0], [4 + r() * 9, 1, 3 + r() * 7], '#1a2620'));
      ring(r, 24, R + 3, R + 50, (x, z) => P.rock(K, x, H(x, z), z, 0.6 + r() * 1.4, '#3e4a36'));
      ring(r, 30, R + 4, R + 40, (x, z) => K.add('disk', 'std', [x, H(x, z) + 0.06, z], [0, r() * 3, 0], [1.2, 1, 1.2], '#3e6a2e'));
    },
    fx: { color: 0x7affc0, rate: 10, kind: 'wisps' },
    grass: { base: '#252c14', tip: '#7c8a46', nIn: 4000, nOut: 7000, tall: 1.9 },
  };
  // 6 — COL ENNEIGÉ : nuit claire, montagnes, sapins sous la neige, cristaux, neige qui tombe
  B.neige = { n: 'Col enneigé', accent: 0x8fd8ff,
    sky: { top: '#040918', mid: '#12244a', hor: '#3a5a84', sun: '#e8f2ff', dir: [-0.42, 0.5, -0.75], size: 0.007, glow: 1.4, cloud: '#2a3a5a', clouds: 0.22, stars: 1 },
    fog: ['#1e3050', 0.011], hemi: ['#a8c8ff', '#2a3448', 0.8], key: ['#a8c8ff', 1.35, [-35, 50, -55]], amb: 0.14,
    ground: { detail: 'snow', c1: '#dde8f4', c2: '#c4d4e8', hill: '#e8f0fa', far: '#b8c8e0', amp: 42, rep: 50 },
    props(K, H) {
      const r = K.rng;
      ring(r, K.low ? 60 : 100, R + 5, R + 80, (x, z) => P.pine(K, x, H(x, z), z, 1 + r() * 1.1, r() < 0.5 ? '#1e3a30' : '#24443a', true));
      ring(r, 30, R + 3, R + 50, (x, z) => { const y = H(x, z), s = 0.6 + r() * 1.6; K.add('rock', 'std', [x, y, z], [r() * 3, r() * 6, 0], [s * 1.5, s, s * 1.4], '#6a7484', true); K.add('blob', 'soft', [x, y + s * 0.55, z], [0, r() * 3, 0], [s * 1.3, s * 0.4, s * 1.2], '#f2f6ff'); });
      ring(r, 16, R + 3, R + 25, (x, z) => { const y = H(x, z), s = 0.8 + r() * 1.5; K.add('spike', 'glow:#7ac8ff', [x, y - 0.2, z], [(r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6], [s * 0.7, s * 2.6, s * 0.7]); });
    },
    lights: [{ col: '#7ac8ff', n: 3, r: R + 6, h: 2, glowOnly: true }],
    fx: { color: 0xffffff, rate: 70, kind: 'snow' },
  };
  // 7 — CIMETIÈRE MAUDIT : pleine lune, tombes, grilles, mausolée, brume au ras du sol
  B.cimetiere = { n: 'Cimetière maudit', accent: 0x9aff7a,
    sky: { top: '#05040a', mid: '#18122a', hor: '#3a2a46', sun: '#e2f2d2', dir: [0.35, 0.42, -0.84], size: 0.02, glow: 2.4, cloud: '#221a2c', clouds: 0.5, stars: 0.6 },
    fog: ['#1c1824', 0.013], hemi: ['#8a8ab8', '#121018', 0.75], key: ['#b8c8e0', 1.3, [25, 45, -60]], amb: 0.1,
    ground: { detail: 'grass', c1: '#2c3a28', c2: '#3a3424', hill: '#262e24', far: '#1e1e24', amp: 10, rep: 70 },
    props(K, H) {
      const r = K.rng;
      // rangées de tombes autour de l'arène
      for (let row = 0; row < 6; row++) { const rr = R + 4.5 + row * 3.2, n = Math.round(rr * 0.9); for (let i = 0; i < n; i++) { if (r() < 0.25) continue; const a = i / n * Math.PI * 2 + row * 0.13 + (r() - 0.5) * 0.04, x = Math.cos(a) * rr, z = Math.sin(a) * rr; P.tomb(K, x, H(x, z), z, -a + Math.PI / 2 + (r() - 0.5) * 0.2, r() < 0.5 ? '#8a8a92' : '#74747e', (r() * 3) | 0); } }
      // grille en fer
      for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2; if (i % 40 < 3) continue; const x = Math.cos(a) * (R + 2.3), z = Math.sin(a) * (R + 2.3); K.add('cyl', 'metal', [x, 0, z], null, [0.08, 1.9, 0.08], '#1a1a1e'); K.add('spike', 'metal', [x, 1.9, z], null, [0.16, 0.3, 0.16], '#1a1a1e'); }
      for (const hh of [0.4, 1.6]) for (let i = 0; i < 60; i++) { const a = (i + 0.5) / 60 * Math.PI * 2; if (Math.floor(i / 15) !== Math.floor((i + 1) / 15) || i % 15 === 0) continue; const x = Math.cos(a) * (R + 2.3), z = Math.sin(a) * (R + 2.3); K.add('boxc', 'metal', [x, hh, z], [0, -a, 0], [0.06, 0.08, 2 * Math.PI * (R + 2.3) / 60], '#1a1a1e'); }
      // mausolée
      { const a = -Math.PI / 2, x = Math.cos(a) * (R + 24), z = Math.sin(a) * (R + 24), y = H(x, z);
        K.add('box', 'std', [x, y - 0.5, z], [0, 0, 0], [12, 8, 10], '#4a4a52', true); K.add('spike', 'std', [x, y + 7.5, z], [0, Math.PI / 4, 0], [17, 5, 15], '#3a3a42', true);
        for (const dx of [-4, 4]) P.column(K, x + dx, y, z + 5.6, 6.5, '#55555e', false); K.add('box', 'glow:#7aff9a', [x, y, z + 5.05], null, [2.4, 3.8, 0.1]); }
      ring(r, 22, R + 22, R + 70, (x, z) => P.dead(K, x, H(x, z), z, 1 + r() * 1, '#2a2420'));
    },
    lights: [{ col: '#ffb060', n: 5, r: R + 3.4, h: 1.2, candle: true }],
    fx: { color: 0x9aff9a, rate: 16, kind: 'mist' },
    grass: { base: '#18221a', tip: '#56664a', nIn: 6000, nOut: 6000 },
  };
  // 8 — TERRES DE CENDRES : basalte fendu de lave, rivière de feu, roches acérées, cendres
  B.volcan = { n: 'Terres de cendres', accent: 0xff5a1a,
    sky: { top: '#0e0404', mid: '#3a0e06', hor: '#a02a0a', sun: '#ff6a2a', dir: [0, -0.2, -1], size: 0, glow: 1.6, cloud: '#2a1612', clouds: 0.62 },
    fog: ['#2c0e08', 0.011], hemi: ['#d88a6a', '#140604', 0.5], key: ['#ffa070', 1.5, [30, 25, -50]], amb: 0.06,
    ground: { detail: 'soil', c1: '#2a2422', c2: '#1e1a18', hill: '#241e1c', far: '#3a1a10', amp: 26, rep: 60 }, floor: { kind: 'basalt', rep: 10, lava: true },
    props(K, H) {
      const r = K.rng;
      ring(r, 60, R + 4, R + 75, (x, z) => { const y = H(x, z), s = 1 + r() * 3; K.add('spike', 'std', [x, y - 0.5, z], [(r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4], [s * 1.2, s * (2.5 + r() * 2.5), s * 1.2], r() < 0.5 ? '#1c1816' : '#2a2220', true); });
      ring(r, 30, R + 3, R + 40, (x, z) => P.rock(K, x, H(x, z), z, 0.6 + r() * 1.5, '#241e1c'));
      ring(r, 14, R + 10, R + 60, (x, z) => K.add('disk', 'glow:#ff5a1a', [x, H(x, z) + 0.05, z], [0, r() * 3, 0], [4 + r() * 8, 1, 3 + r() * 6]));
    },
    lava: true,
    fx: { color: 0xff7a2a, rate: 30, kind: 'embers' },
  };
  // 9 — CITADELLE DES OMBRES (gardien) : cour fortifiée, tours, bannières, pics, éclairs
  B.citadelle = { n: 'Citadelle des ombres', accent: 0xff2a4a,
    sky: { top: '#06030c', mid: '#1e0a26', hor: '#4a1030', sun: '#ff3a5a', dir: [0, 0.3, -1], size: 0, glow: 1.2, cloud: '#1a0c1e', clouds: 0.6, stars: 0.2 },
    fog: ['#180a18', 0.012], hemi: ['#b080c8', '#0c060c', 0.6], key: ['#c890ff', 1.1, [-30, 50, 40]], amb: 0.12, lightning: true,
    ground: { detail: 'soil', c1: '#2a2630', c2: '#221e28', hill: '#1e1a22', far: '#18121c', amp: 8, rep: 60 }, floor: { kind: 'dark', rep: 10, rune: true },
    props(K, H) {
      const r = K.rng;
      // remparts et tours
      const W = R + 13, nT = 8;
      for (let i = 0; i < nT; i++) { const a = i / nT * Math.PI * 2, x = Math.cos(a) * W, z = Math.sin(a) * W;
        K.add('cyl', 'std', [x, -1, z], null, [7, 22, 7], '#2e2a34', true); K.add('spike', 'std', [x, 21, z], [0, r(), 0], [8.5, 9, 8.5], '#1c1822', true); K.add('box', 'glow:#ff2a4a', [x + Math.cos(a) * -3.55, 12, z + Math.sin(a) * -3.55], [0, -a, 0], [0.2, 2.2, 1]);
        const a2 = (i + 0.5) / nT * Math.PI * 2, x2 = Math.cos(a2) * W * 0.98, z2 = Math.sin(a2) * W * 0.98;
        K.add('box', 'std', [x2, -1, z2], [0, -a2, 0], [2.5, 13, 2 * Math.PI * W / nT - 5], '#34303a', true);
        for (let k = -2; k <= 2; k++) { const t = a2 + Math.PI / 2, ox = Math.cos(t) * k * 3, oz = Math.sin(t) * k * 3; K.add('box', 'std', [x2 + ox, 12, z2 + oz], [0, -a2, 0], [2.7, 1.4, 1.4], '#34303a', true); }
        // bannière rouge
        K.add('plane', 'cloth', [x2 - Math.cos(a2) * 1.3, 11, z2 - Math.sin(a2) * 1.3], [0, -a2 - Math.PI / 2, 0], [3, 8, 1], '#8a0a1e'); }
      // pics en fer autour de l'arène
      for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; if (i % 30 < 2) continue; const x = Math.cos(a) * (R + 2.4), z = Math.sin(a) * (R + 2.4); K.add('spike', 'metal', [x, 0, z], [(r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2], [0.35, 2 + r() * 1.2, 0.35], '#26222a', true); }
      ring(r, 20, R + 3, R + 11, (x, z) => P.rock(K, x, H(x, z), z, 0.5 + r() * 1, '#2a2630'));
    },
    lights: [{ col: '#ff2a4a', n: 4, r: R + 1.2, h: 3.2, brazier: true }],
    fx: { color: 0xff2a4a, rate: 16, kind: 'embers' },
  };


  /* =====================================================================
     DÉCOR DANS L'ARÈNE : obstacles (on tourne autour, on s'en sert pour couper les lignes de tir)
     et zones (lave qui brûle, boue qui ralentit). Disposition fixe par monde (identique chez tous les joueurs).
     Le centre (récompenses), le côté des portails (+Z) et le point de départ (-Z) restent dégagés.
     ===================================================================== */
  function spotPicker(rng) {
    const used = [];
    return (n, rad, rMin, rMax) => {
      const out = []; rMin = rMin || 10; rMax = rMax || R - 7;
      for (let k = 0; k < n; k++) for (let t = 0; t < 80; t++) {
        const a = rng() * 6.283, rr = rMin + Math.sqrt(rng()) * (rMax - rMin), x = Math.sin(a) * rr, z = Math.cos(a) * rr, ang = Math.atan2(x, z);
        if (Math.abs(ang) < 0.75 && rr > 16) continue;
        if (Math.abs(ang) > Math.PI - 0.6 && rr > 14) continue;
        if (Math.abs(x) < 8.5 && Math.abs(z) < 8.5) continue;
        if (x < -7 && x > -16 && Math.abs(z) < 7) continue;   // la forge (après chaque combat)
        if (used.some(u => Math.hypot(u.x - x, u.z - z) < u.rad + rad + 3.4)) continue;
        const p = { x, z, a: rng() * 6.283, rad }; used.push(p); out.push(p); break;
      }
      return out;
    };
  }
  const D = {
    rocks(K, x, z, s, col, moss) { const r = K.rng; P.rock(K, x, 0, z, 1.5 * s, col); for (let i = 0; i < 3; i++) { const a = r() * 6.283; P.rock(K, x + Math.cos(a) * 1.5 * s, 0, z + Math.sin(a) * 1.5 * s, (0.45 + r() * 0.4) * s, col); }
      if (moss) K.add('blob', 'soft', [x, 1.05 * s, z], [0, r() * 3, 0], [1.6 * s, 0.35 * s, 1.5 * s], moss); },
    bale(K, x, z, rot) { K.add('cyl', 'std', [x, 0, z], [0, rot, 0], [2.1, 1.35, 2.1], '#d9b55a', true); K.add('disk', 'std', [x, 1.36, z], [0, rot, 0], [2.0, 1, 2.0], '#c49a3e'); K.add('cyl', 'std', [x, 0.42, z], [0, rot, 0], [2.14, 0.12, 2.14], '#8a5a2a'); },
    cart(K, x, z) { K.add('box', 'std', [x, 0.55, z], null, [3.2, 0.7, 1.8], '#8a6038', true); K.add('box', 'std', [x, 1.25, z - 0.85], null, [3.2, 0.7, 0.12], '#7a5230', true); K.add('box', 'std', [x, 1.25, z + 0.85], null, [3.2, 0.7, 0.12], '#7a5230', true);
      for (const dz of [-1.05, 0.95]) K.add('cyl', 'std', [x - 0.6, 0.62, z + dz], [Math.PI / 2, 0, 0], [1.25, 0.12, 1.25], '#5a3c22', true);
      K.add('box', 'std', [x + 2.4, 0.85, z], [0, 0, -0.25], [2.2, 0.12, 0.12], '#6a4a2a', true); K.add('blob', 'std', [x - 0.3, 1.2, z], [0.3, 0.4, 0], [1.6, 0.7, 1.1], '#d9b55a', true); },
    stump(K, x, z, s) { K.add('trunk', 'std', [x, 0, z], [0, K.rng() * 6, 0], [2.6 * s, 1.1 * s, 2.6 * s], '#6a4a2e', true); K.add('disk', 'std', [x, 1.11 * s, z], null, [1.55 * s, 1, 1.55 * s], '#c8965e');
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + K.rng(); K.add('trunk', 'std', [x + Math.cos(a) * 1.1 * s, 0, z + Math.sin(a) * 1.1 * s], [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2], [0.5 * s, 1.0 * s, 0.5 * s], '#5a3c24', true); } },
    shroom(K, x, z, s, col) { K.add('cyl', 'std', [x, 0, z], null, [0.7 * s, 2.2 * s, 0.7 * s], '#efe6d2', true); K.add('cap', 'std', [x, 2.0 * s, z], null, [3.2 * s, 1.8 * s, 3.2 * s], col, true);
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + K.rng(); K.add('blob', 'std', [x + Math.cos(a) * 1.05 * s, 2.55 * s, z + Math.sin(a) * 1.05 * s], null, 0.28 * s, '#fff6e0'); } },
    log(K, x, z, a, len) { K.add('trunk', 'std', [x - Math.sin(a) * len / 2, 0.55, z - Math.cos(a) * len / 2], [Math.PI / 2, a, 0], [1.1, len, 1.1], '#5a4028', true); },
    wall(K, x, z, a, len, col) { const n = Math.ceil(len / 1.4); for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * 1.4, h = 1.2 + K.rng() * 2.4 * (1 - Math.abs(t) / len); K.add('box', 'std', [x + Math.sin(a) * t, 0, z + Math.cos(a) * t], [0, a + (K.rng() - 0.5) * 0.06, 0], [1.1, h, 1.45], col, true); } },
    statue(K, x, z, yaw, col, glow) { K.add('box', 'std', [x, 0, z], [0, yaw, 0], [2.6, 1.0, 2.6], '#8a7a66', true); K.add('box', 'std', [x, 1.0, z], [0, yaw, 0], [1.5, 2.6, 1.1], col, true);
      K.add('boxc', 'std', [x, 4.1, z], [0.15, yaw, 0], [0.95, 1.0, 0.95], col, true); K.add('box', 'std', [x, 3.4, z], [0, yaw, 0], [2.4, 0.5, 0.8], col, true);
      if (glow) K.add('boxc', 'glow:' + glow, [x + Math.sin(yaw) * 0.49, 4.15, z + Math.cos(yaw) * 0.49], [0, yaw, 0], [0.6, 0.12, 0.04]); },
    brazier(K, x, z, col) { K.add('cyl', 'metal', [x, 0, z], null, [0.7, 1.7, 0.7], '#2a2624', true); K.add('cyl', 'metal', [x, 1.6, z], null, [1.6, 0.45, 1.6], '#3a3430', true); K.add('blob', 'glow:' + col, [x, 2.15, z], null, [1.1, 0.7, 1.1]); },
    crypt(K, x, z, yaw) { K.add('box', 'std', [x, 0, z], [0, yaw, 0], [3.2, 2.6, 4.4], '#5a5a64', true); K.add('spike', 'std', [x, 2.6, z], [0, yaw + Math.PI / 4, 0], [4.2, 1.6, 4.2], '#44444e', true);
      K.add('box', 'glow:#7aff9a', [x + Math.sin(yaw) * 2.21, 0.2, z + Math.cos(yaw) * 2.21], [0, yaw, 0], [1.1, 1.7, 0.05]); K.add('boxc', 'std', [x, 4.1, z], [0, yaw, 0], [0.18, 1.2, 0.18], '#6a6a74'); K.add('boxc', 'std', [x, 4.25, z], [0, yaw, 0], [0.7, 0.18, 0.18], '#6a6a74'); },
    crystals(K, x, z, s, col) { const r = K.rng; for (let i = 0; i < 5; i++) { const a = r() * 6.283, d = i ? 0.9 * s : 0; K.add('spike', 'glow:' + col, [x + Math.cos(a) * d, -0.2, z + Math.sin(a) * d], [(r() - 0.5) * 0.7, r() * 3, (r() - 0.5) * 0.7], [0.8 * s, (i ? 1.6 + r() * 1.2 : 3.6) * s, 0.8 * s]); } },
    spire(K, x, z, s, col) { K.add('spike', 'std', [x, -0.3, z], [(K.rng() - 0.5) * 0.2, K.rng() * 3, (K.rng() - 0.5) * 0.2], [2.4 * s, 6.5 * s, 2.4 * s], col, true); K.add('spike', 'std', [x + 1.1 * s, -0.3, z + 0.5 * s], [0.2, K.rng() * 3, 0], [1.1 * s, 3 * s, 1.1 * s], col, true); },
    pool(K, x, z, s, mat, col) { K.add('disk', mat, [x, 0.035, z], [0, K.rng() * 3, 0], [s * 2, 1, s * 1.7], col); },
    spikes(K, x, z, yaw) { K.add('boxc', 'std', [x, 0.55, z], [0, yaw, Math.PI / 2], [0.3, 3.6, 0.3], '#4a3a2a', true); for (let i = -2; i <= 2; i++) { const t = i * 0.75; K.add('boxc', 'metal', [x + Math.cos(yaw) * t, 0.6, z - Math.sin(yaw) * t], [0.7 * (i % 2 ? 1 : -1), yaw, 0], [0.16, 2.2, 0.16], '#2a262a', true); } },
  };
  // ob(x, z, rayon, hauteur) : obstacle ; hz(x, z, rayon, type) : zone
  B.prairie.arena = (K, ob, hz, sp) => { const r = K.rng;
    sp(2, 1.6, 18, R - 6).forEach(p => { P.tree(K, p.x, 0, p.z, 1.15, ['#3f8a30', '#5ea840', '#2f7a2c', '#78b84a']); ob(p.x, p.z, 0.85, 9); });
    sp(3, 2.2).forEach(p => { D.rocks(K, p.x, p.z, 1, '#9aa0a0', '#5a8a34'); ob(p.x, p.z, 1.9, 1.7); });
    sp(3, 1.2).forEach(p => { D.bale(K, p.x, p.z, p.a); ob(p.x, p.z, 1.15, 1.35); });
    sp(1, 2).forEach(p => { D.cart(K, p.x, p.z); ob(p.x - 0.8, p.z, 1.1, 1.6); ob(p.x + 0.8, p.z, 1.1, 1.6); });
    void r; };
  B.foret.arena = (K, ob, hz, sp) => { const r = K.rng;
    sp(3, 1.6).forEach(p => { D.stump(K, p.x, p.z, 1.1); ob(p.x, p.z, 1.5, 1.2); });
    sp(3, 1.4).forEach(p => { D.shroom(K, p.x, p.z, 0.9 + r() * 0.4, r() < 0.6 ? '#d8322a' : '#c88a3a'); ob(p.x, p.z, 0.5, 2.3); });
    sp(1, 3.5).forEach(p => { D.log(K, p.x, p.z, p.a, 7); for (let k = -2; k <= 2; k++) ob(p.x + Math.sin(p.a) * k * 1.4, p.z + Math.cos(p.a) * k * 1.4, 0.65, 1.1); });
    sp(2, 2).forEach(p => { D.rocks(K, p.x, p.z, 0.9, '#7a7a6a', '#5a7a2a'); ob(p.x, p.z, 1.7, 1.5); }); };
  B.ruines.arena = (K, ob, hz, sp) => { const r = K.rng;
    sp(4, 1.2).forEach(p => { const br = r() < 0.6; P.column(K, p.x, 0, p.z, br ? 2.5 + r() * 3 : 7, '#c0a888', br); ob(p.x, p.z, 1.15, br ? 3.5 : 8); });
    sp(2, 3.6).forEach(p => { D.wall(K, p.x, p.z, p.a, 6, '#b09878'); for (let k = -2; k <= 2; k++) ob(p.x + Math.sin(p.a) * k * 1.4, p.z + Math.cos(p.a) * k * 1.4, 0.8, 2); });
    sp(1, 3).forEach(p => { K.add('cyl', 'std', [p.x - Math.sin(p.a) * 3, 0.65, p.z - Math.cos(p.a) * 3], [Math.PI / 2, p.a, 0], [1.3, 6, 1.3], '#b8a080', true); for (let k = -1; k <= 1; k++) ob(p.x + Math.sin(p.a) * k * 2, p.z + Math.cos(p.a) * k * 2, 0.75, 1.3); }); };
  B.temple.arena = (K, ob) => {
    for (const a of [Math.PI / 2 - 0.55, Math.PI / 2 + 0.55, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55]) { const x = Math.sin(a) * 17, z = Math.cos(a) * 17; D.statue(K, x, z, Math.atan2(-x, -z), '#a89478', '#ff8a3a'); ob(x, z, 1.5, 5); }
    for (const a of [Math.PI / 2, -Math.PI / 2]) { const x = Math.sin(a) * 11, z = Math.cos(a) * 11; D.brazier(K, x, z, '#ff8a3a'); ob(x, z, 0.85, 2.2); } };
  B.marais.arena = (K, ob, hz, sp) => { const r = K.rng;
    sp(3, 3.2).forEach(p => { D.pool(K, p.x, p.z, 1.9, 'water', '#1e2a24'); hz(p.x, p.z, 3.2, 'mud'); });
    sp(3, 0.8).forEach(p => { P.dead(K, p.x, 0, p.z, 0.9 + r() * 0.3, '#3a3226'); ob(p.x, p.z, 0.6, 6); });
    sp(2, 1.8).forEach(p => { K.add('blob', 'soft', [p.x, 0.2, p.z], [0, r() * 3, 0], [3.6, 1.6, 3.2], '#3e5a2a', true); D.rocks(K, p.x, p.z, 0.6, '#3e4a36'); ob(p.x, p.z, 1.6, 1.2); }); };
  B.neige.arena = (K, ob, hz, sp) => { const r = K.rng;
    sp(3, 1.6).forEach(p => { D.crystals(K, p.x, p.z, 1, '#7ac8ff'); ob(p.x, p.z, 1.4, 3.5); });
    sp(3, 2).forEach(p => { D.rocks(K, p.x, p.z, 1, '#6a7484'); K.add('blob', 'soft', [p.x, 1.5, p.z], [0, r() * 3, 0], [3.2, 0.7, 3], '#f2f6ff'); ob(p.x, p.z, 1.8, 1.8); });
    sp(1, 3).forEach(p => { D.pool(K, p.x, p.z, 1.6, 'water', '#9ad0f0'); }); };
  B.cimetiere.arena = (K, ob, hz, sp) => { const r = K.rng;
    sp(2, 2.6).forEach(p => { const yaw = Math.atan2(-p.x, -p.z); D.crypt(K, p.x, p.z, yaw); ob(p.x, p.z, 2.4, 4); });
    sp(4, 1).forEach(p => { P.tomb(K, p.x, 0, p.z, p.a, '#7c7c86', 2); P.tomb(K, p.x + 1.4, 0, p.z + 0.6, p.a, '#8a8a92', 0); ob(p.x + 0.6, p.z + 0.3, 1.4, 1); });
    sp(2, 0.7).forEach(p => { P.dead(K, p.x, 0, p.z, 0.9 + r() * 0.3, '#2a2420'); ob(p.x, p.z, 0.6, 6); }); };
  B.volcan.arena = (K, ob, hz, sp) => { const r = K.rng;
    sp(3, 3).forEach(p => { D.pool(K, p.x, p.z, 1.6 + r() * 0.5, 'glow:#ff5a1a'); hz(p.x, p.z, 2.9, 'lava'); });
    sp(4, 1.6).forEach(p => { D.spire(K, p.x, p.z, 0.9 + r() * 0.3, r() < 0.5 ? '#1c1816' : '#2a2220'); ob(p.x, p.z, 1.5, 6); }); };
  B.citadelle.arena = (K, ob, hz, sp) => {
    for (const a of [Math.PI / 2 - 0.6, Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6]) { const x = Math.sin(a) * 15, z = Math.cos(a) * 15; P.column(K, x, 0, z, 9, '#3a3640', false); K.add('box', 'glow:#ff2a4a', [x, 5, z], [0, -a, 0], [1.45, 0.5, 1.45]); ob(x, z, 1.2, 10); }
    sp(3, 2).forEach(p => { D.spikes(K, p.x, p.z, p.a); for (let k = -1; k <= 1; k++) ob(p.x + Math.cos(p.a) * k * 1.2, p.z - Math.sin(p.a) * k * 1.2, 0.7, 1.3); });
    for (const a of [Math.PI / 2, -Math.PI / 2]) { const x = Math.sin(a) * 9.5, z = Math.cos(a) * 9.5; D.brazier(K, x, z, '#ff2a4a'); ob(x, z, 0.85, 2.2); } };

  /* ---------- champ d'herbe : touffes de brins fins (vert foncé au pied, clair à la pointe) qui ondulent au vent ----------
     courte dans l'arène (on voit toujours les marquages d'attaque), plus haute autour ; un seul appel de dessin */
  function clumpGeo(base, tip) {
    const pos = [], col = [], nrm = [], idx = [], cb = L(base), ct = L(tip), tmp = new THREE.Color();
    const BL = 5, SEG = 3;
    for (let b = 0; b < BL; b++) {
      const a = b / BL * Math.PI * 2 + Math.random() * 0.5, off = 0.02 + Math.random() * 0.09, ox = Math.cos(a) * off, oz = Math.sin(a) * off;
      const lean = 0.18 + Math.random() * 0.2, h = 0.55 + Math.random() * 0.4, w = 0.1 + Math.random() * 0.04, ry = a + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      const dx = Math.cos(ry), dz = Math.sin(ry), start = pos.length / 3;
      for (let s = 0; s <= SEG; s++) {
        const k = s / SEG, y = k * h * (1 - k * 0.12), bend = k * k * lean, ww = w * Math.max(0.04, Math.sin((1 - k) * Math.PI * 0.5) * (1 - k * 0.25));
        const cx = ox + Math.cos(a) * bend, cz = oz + Math.sin(a) * bend;
        pos.push(cx - dx * ww, y, cz - dz * ww, cx + dx * ww, y, cz + dz * ww);
        tmp.copy(cb).lerp(ct, Math.pow(k, 1.3)); col.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b);
        nrm.push(0, 1, 0, 0, 1, 0);
        if (s < SEG) { const i = start + s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
    return g;
  }
  AS.grass = function (group, H, o, rng, quality, minR, exclude) {
    const low = quality === 'low', nIn = Math.round((o.nIn || 0) * (low ? 0.4 : 1)), nOut = Math.round((o.nOut || 0) * (low ? 0.4 : 1)), N = nIn + nOut;
    if (!N) return null;
    const U = { uTime: { value: 0 } };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 gp = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 gp = vec3(0.0);
        #endif
        float gb = position.y * position.y;
        float gw = sin(uTime * 1.6 + gp.x * 0.32 + gp.z * 0.21) + 0.45 * sin(uTime * 2.9 + gp.x * 0.8 - gp.z * 0.5);
        transformed.x += gw * 0.16 * gb; transformed.z += cos(uTime * 1.2 + gp.z * 0.27) * 0.09 * gb;`);
    };
    // les deux faces d'un brin sont éclairées pareil (sinon le dos des brins paraît noir)
    const bc = mat.onBeforeCompile; mat.onBeforeCompile = sh => { bc(sh); sh.fragmentShader = sh.fragmentShader.replace(/gl_FrontFacing/g, 'true'); };
    mat.customProgramCacheKey = () => 'asc-grass3';
    const geo = clumpGeo(o.base, o.tip), im = new THREE.InstancedMesh(geo, mat, N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new V3(), pv = new V3(), c = new THREE.Color();
    let k = 0;
    const put = (x, z, h) => { pv.set(x, H(x, z) - 0.02, z); e.set((rng() - 0.5) * 0.15, rng() * 6.283, (rng() - 0.5) * 0.15); q.setFromEuler(e); const s = h * (0.9 + rng() * 0.35); sv.set(s, h, s); m4.compose(pv, q, sv); im.setMatrixAt(k, m4); const v = 0.93 + rng() * 0.12; c.setRGB(v, v * (0.98 + rng() * 0.04), v * (0.95 + rng() * 0.08)); im.setColorAt(k, c); k++; };
    const tall = o.tall || 1;
    for (let i = 0; i < nIn * 4 && k < nIn; i++) { const a = rng() * 6.283, r = Math.sqrt(rng()) * (R + 2); if (r < (minR || 0)) continue; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (exclude && exclude(x, z)) continue; put(x, z, 0.3 + rng() * 0.16); }
    for (let i = 0; i < nOut * 4 && k < N; i++) { const a = rng() * 6.283, r = Math.max(minR || 0, R + 2) + Math.sqrt(rng()) * 46; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (exclude && exclude(x, z)) continue; put(x, z, (0.5 + rng() * 0.45) * tall); }
    im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.receiveShadow = !low; im.castShadow = false; im.frustumCulled = false;
    group.add(im);
    return U;
  };

  /* =====================================================================
     CONSTRUCTION
     ===================================================================== */
  AS.BIOMES = B;
  AS.isBiome = id => !!B[id] || id === 'neant';
  AS.biomeName = id => id === 'neant' ? 'Le Néant' : (B[id] || {}).n || '';
  const buildBase = AS.build;
  AS.build = function (scene, themeId, quality, opts) {
    if (themeId === 'neant') return neant(scene, quality);
    const def = B[themeId]; if (!def) return buildBase(scene, themeId, quality);
    return biome(scene, def, quality, themeId, opts || {});
  };

  function biome(scene, def, quality, id, opts) {
    opts = opts || {};
    let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rng = BR.rngFrom(seed || 7), g = new THREE.Group(); scene.add(g);
    const acc = new THREE.Color(def.accent);
    scene.background = L(def.fog[0]); scene.fog = new THREE.FogExp2(L(def.fog[0]), def.fog[1]);
    const skyM = sky(def); g.add(skyM);
    const hemi = new THREE.HemisphereLight(L(def.hemi[0]), L(def.hemi[1]), def.hemi[2]); g.add(hemi);
    g.add(new THREE.AmbientLight(0xffffff, def.amb || 0.12));
    const key = new THREE.DirectionalLight(L(def.key[0]), def.key[1]); key.position.fromArray(def.key[2]); key.target.position.set(0, 0, 0); g.add(key, key.target);
    if (quality !== 'low') { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); const sc = key.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 220; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.04; }
    // le relief : plat dans l'arène, collines tout autour, montagnes au loin
    const G = def.ground, s0 = seed % 997;
    const H = (x, z) => { const r = Math.hypot(x, z); if (r < R + 4) return 0; const t = sstep(R + 4, R + 48, r); return t * t * G.amp * (0.35 + fbm2(x * 0.03, z * 0.03, s0)) + sstep(110, 190, r) * G.amp * 2.2 * fbm2(x * 0.012, z * 0.012, s0 + 3); };
    const geo = new THREE.PlaneGeometry(440, 440, 150, 150); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
    const c1 = L(G.c1), c2 = L(G.c2), ch = L(G.hill), cf = L(G.far), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
      pos.setY(i, H(x, z) - (r < R + 4 ? 0.02 : 0));
      tmp.copy(c1).lerp(c2, sstep(0.35, 0.65, noise2(x * 0.045, z * 0.045, s0 + 9))); tmp.lerp(ch, sstep(R + 6, R + 40, r) * 0.8); tmp.lerp(cf, sstep(90, 180, r));
      const jv = 0.84 + hash2(Math.round(x * 3), Math.round(z * 3), s0) * 0.06; tmp.multiplyScalar(jv);
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
    const ground = new THREE.Mesh(geo, groundMat); ground.receiveShadow = true; g.add(ground);
    // sol de l'arène (dallage) si le monde en a un
    let floorMat = groundMat, floor = ground, lavaU = null;
    if (def.floor) {
      const F = def.floor, tile = paving(F.kind, 512), big = cv(2048, (gg, n) => { const s = n / F.rep; for (let i = 0; i < F.rep; i++) for (let j = 0; j < F.rep; j++) gg.drawImage(tile, i * s, j * s, s, s); }), map = tex(big, 1);
      let em = null;
      if (F.rune || F.lava) {
        em = tex(cv(1024, (gg, n) => { gg.fillStyle = '#000'; gg.fillRect(0, 0, n, n); const c = '#' + acc.getHexString(), k = n / (2 * (R + 2.2)), cx = n / 2;
          gg.strokeStyle = c; gg.fillStyle = c;
          if (F.rune) for (const rr of [9, 22]) { gg.lineWidth = 3; gg.beginPath(); gg.arc(cx, cx, rr * k - 5, 0, 7); gg.stroke(); gg.beginPath(); gg.arc(cx, cx, rr * k + 5, 0, 7); gg.stroke(); const nr = Math.round(rr * 3.6); for (let i = 0; i < nr; i++) { const a = i / nr * Math.PI * 2; gg.save(); gg.translate(cx + Math.cos(a) * rr * k, cx + Math.sin(a) * rr * k); gg.rotate(a); gg.fillRect(-1.5, -4, 3, 8); if (i % 3 === 0) gg.fillRect(-4, -1, 8, 2); gg.restore(); } }
          if (F.lava) { gg.lineCap = 'round'; for (let i = 0; i < 70; i++) { let a = Math.random() * 6.283, rr = Math.random() * R * k; gg.lineWidth = 1.5 + Math.random() * 3; gg.beginPath(); gg.moveTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr); for (let s = 0; s < 6; s++) { a += (Math.random() - 0.5) * 0.25; rr += (Math.random() - 0.4) * 40; gg.lineTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr); } gg.stroke(); } }
        }), 1);
        em.wrapS = em.wrapT = THREE.ClampToEdgeWrapping;
      }
      floorMat = new THREE.MeshStandardMaterial({ map, roughness: F.kind === 'dark' ? 0.6 : 0.85, metalness: F.kind === 'dark' ? 0.15 : 0.02, emissive: em ? acc.clone() : new THREE.Color(0), emissiveMap: em, emissiveIntensity: em ? 1.5 : 0 });
      // la texture d'émission (runes) couvre le disque entier : coordonnées UV à part, sans répétition
      floor = new THREE.Mesh(new THREE.CircleGeometry(R + 2.2, 96), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.012; floor.receiveShadow = true; g.add(floor);
      const curb = new THREE.Mesh(new THREE.TorusGeometry(R + 2.2, 0.35, 6, 96), new THREE.MeshStandardMaterial({ color: L(F.kind === 'basalt' ? '#1a1614' : F.kind === 'dark' ? '#24202a' : '#8a7660'), roughness: 0.9, flatShading: true }));
      curb.rotation.x = -Math.PI / 2; curb.position.y = 0.05; curb.receiveShadow = true; g.add(curb);
    }
    // rivière de lave (volcan)
    if (def.lava) {
      lavaU = { uTime: { value: 0 } };
      const lm = new THREE.ShaderMaterial({ uniforms: lavaU, fog: false,
        vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `uniform float uTime; varying vec2 vW; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          void main(){ float a = atan(vW.y, vW.x), r = length(vW); vec2 p = vec2(a * 12.0 + uTime * 0.25, r * 0.5);
            float v = n(p * 1.3) * 0.6 + n(p * 3.1 + uTime * 0.2) * 0.4; vec3 c = mix(vec3(0.9, 0.12, 0.0), vec3(3.0, 1.3, 0.2), smoothstep(0.35, 0.8, v)); c = mix(vec3(0.08, 0.02, 0.01), c, smoothstep(0.18, 0.4, v));
            gl_FragColor = vec4(c, 1.0); }` });
      const lr = new THREE.Mesh(new THREE.RingGeometry(R + 4.5, R + 10, 96, 1), lm); lr.rotation.x = -Math.PI / 2; lr.position.y = 0.15; g.add(lr);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4, ll = new THREE.PointLight(L('#ff5a1a'), 1.6, 26, 2); ll.position.set(Math.cos(a) * (R + 6), 2, Math.sin(a) * (R + 6)); g.add(ll); }
    }
    // les éléments du décor
    const K = kit(rng, quality);
    // zone libre demandée (le village) : aucun élément de décor ni herbe dedans
    if (opts.exclude) { const add0 = K.add; K.add = (gk, m, p, r, s, c, sh) => { if (!opts.exclude(p[0], p[2])) add0(gk, m, p, r, s, c, sh); }; }
    const extra = def.props(K, H) || {};
    const obstacles = [], hazards = [];
    if (def.arena && !opts.exclude && opts.arena !== false) { const rA = BR.rngFrom(((seed * 2654435761) >>> 0) || 11); K.rng = rA; def.arena(K, (x, z, rr, h) => obstacles.push({ x, z, r: rr, h: h == null ? 3 : h }), (x, z, rr, kind) => hazards.push({ x, z, r: rr, kind }), spotPicker(rA)); K.rng = rng; }
    K.flush(g);
    const grassU = def.grass ? AS.grass(g, H, Object.assign({}, def.grass, { base: '#' + new THREE.Color(G.c1).multiplyScalar(0.86).getHexString() }), rng, quality, def.floor ? R + 2.6 : 0, opts.exclude) : null;
    // lumières ponctuelles (braseros, bougies, cristaux)
    const flick = [];
    (def.lights || []).forEach(Lg => {
      for (let i = 0; i < Lg.n; i++) {
        const a = i / Lg.n * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * Lg.r, z = Math.sin(a) * Lg.r, y = H(x, z);
        if (Lg.brazier) {
          const bm = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6, metalness: 0.5, flatShading: true });
          const st = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.2, 6), bm); st.position.set(x, y + 1.1, z); const bw = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.45, 0.6, 8), bm); bw.position.set(x, y + 2.4, z); g.add(st, bw);
        }
        if (Lg.candle) { const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xe8e0c8 })); cm.position.set(x, y + 0.95, z); g.add(cm); }
        if (Lg.glowOnly && quality === 'low') continue;
        const l = new THREE.PointLight(L(Lg.col), Lg.candle ? 1.4 : 2.2, Lg.candle ? 9 : 16, 2); l.position.set(x, y + Lg.h, z); g.add(l);
        flick.push({ l, p: new V3(x, y + Lg.h - 0.3, z), base: l.intensity, fire: Lg.brazier || Lg.candle, col: Lg.col });
      }
    });
    // papillons (prairie) : corps, antennes, 4 ailes découpées et peintes (motifs, bordure sombre, ocelles), battement réaliste
    const flies = [];
    if (def.butterflies) {
      const PAL = [['#ff8a1a', '#ffd24a', '#2a1406'], ['#2f7dff', '#8fe0ff', '#0c1a3a'], ['#ffe14a', '#fff6b0', '#3a2a06'], ['#ff6ab0', '#ffd0ea', '#3a0c24'], ['#c9a6ff', '#ffffff', '#2a1a4a']];
      // une aile (avant + arrière) dessinée sur une texture ; charnière à gauche de l'image (u = 0)
      const wingTex = p => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
        const shape = () => { x.beginPath(); x.moveTo(4, 60); x.bezierCurveTo(20, 8, 92, -4, 122, 18); x.bezierCurveTo(128, 40, 100, 62, 60, 64);
          x.bezierCurveTo(98, 70, 112, 102, 92, 120); x.bezierCurveTo(70, 132, 26, 108, 4, 70); x.closePath(); };
        shape(); const gr = x.createRadialGradient(6, 64, 6, 6, 64, 118); gr.addColorStop(0, p[2]); gr.addColorStop(0.28, p[0]); gr.addColorStop(0.75, p[1]); gr.addColorStop(1, p[0]);
        x.fillStyle = gr; x.fill();
        x.save(); shape(); x.clip();
        x.strokeStyle = p[2]; x.globalAlpha = 0.55; x.lineWidth = 2.2;                       // nervures
        for (const [ex, ey] of [[118, 20], [104, 44], [70, 60], [96, 108], [60, 116]]) { x.beginPath(); x.moveTo(6, 64); x.quadraticCurveTo((6 + ex) / 2, (64 + ey) / 2 - 6, ex, ey); x.stroke(); }
        x.globalAlpha = 1; x.lineWidth = 12; x.strokeStyle = p[2]; shape(); x.stroke();      // bordure sombre
        x.fillStyle = '#ffffff'; for (const [dx, dy, r] of [[110, 24, 4], [100, 34, 3.5], [114, 38, 3], [88, 112, 3.5]]) { x.beginPath(); x.arc(dx, dy, r, 0, 7); x.fill(); }
        x.fillStyle = p[2]; x.beginPath(); x.arc(72, 96, 9, 0, 7); x.fill(); x.fillStyle = p[1]; x.beginPath(); x.arc(72, 96, 5, 0, 7); x.fill();   // ocelle
        x.restore();
        const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
      };
      const wGeo = new THREE.PlaneGeometry(0.46, 0.46).rotateX(-Math.PI / 2).translate(0.23, 0, 0);   // à plat, charnière sur l'axe du corps
      const bodyGeo = new THREE.CylinderGeometry(0.03, 0.02, 0.26, 6).rotateX(Math.PI / 2);
      const antGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.16, 3).translate(0, 0.08, 0), tipGeo = new THREE.SphereGeometry(0.014, 5, 4);
      const bodyMat = new THREE.MeshStandardMaterial({ color: L('#1a120c'), roughness: 0.7 });
      const mats = PAL.map(p => new THREE.MeshBasicMaterial({ map: wingTex(p), side: THREE.DoubleSide, transparent: true, alphaTest: 0.4, depthWrite: true }));
      for (let i = 0; i < def.butterflies; i++) {
        const mat = mats[i % mats.length], b = new THREE.Group(), s = 0.75 + rng() * 0.5;
        const body = new THREE.Mesh(bodyGeo, bodyMat); b.add(body);
        for (const sx of [-1, 1]) { const an = new THREE.Mesh(antGeo, bodyMat); an.position.set(sx * 0.012, 0.01, 0.12); an.rotation.set(0.9, 0, -sx * 0.35); const tp = new THREE.Mesh(tipGeo, bodyMat); tp.position.set(0, 0.16, 0); an.add(tp); b.add(an); }
        const w1 = new THREE.Mesh(wGeo, mat), w2 = new THREE.Mesh(wGeo, mat); w2.scale.x = -1; b.add(w1, w2); b.scale.setScalar(s); g.add(b);
        flies.push({ b, w1, w2, c: new V3((rng() - 0.5) * 50, 0, (rng() - 0.5) * 50), ph: rng() * 6, sp: 0.4 + rng() * 0.5, rad: 3 + rng() * 6, last: new V3() });
      }
    }
    let t = 0, boltT = 4 + Math.random() * 6;
    const th = { accent: def.accent };
    return {
      group: g, theme: th, key, floor, floorMat, biome: id, obstacles, hazards,
      update(dt, fx) {
        t += dt;
        skyM.material.uniforms.uTime.value = t;
        if (lavaU) lavaU.uTime.value = t;
        if (grassU) grassU.uTime.value = t;
        if (def.floor && (def.floor.rune || def.floor.lava)) floorMat.emissiveIntensity = (def.floor.lava ? 1.6 : 1.3) + Math.sin(t * 1.4) * 0.3;
        flick.forEach(f => { if (f.fire) { f.l.intensity = f.base * (0.8 + Math.sin(t * 17 + f.p.x) * 0.1 + Math.random() * 0.15); if (fx && Math.random() < dt * 22) fx.spark(f.p, new V3((Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.6), { color: L(f.col).getHex(), life: 0.6, size: 0.4, size1: 0.05, drag: 0.5 }); } else f.l.intensity = f.base * (0.85 + Math.sin(t * 2 + f.p.z) * 0.15); });
        flies.forEach(f => {
          const a = t * f.sp + f.ph, x = f.c.x + Math.cos(a) * f.rad, z = f.c.z + Math.sin(a * 1.3) * f.rad;
          // petits planés de temps en temps, sinon battement rapide (descente vive, remontée plus lente)
          const glide = Math.sin(t * 0.7 + f.ph * 3) > 0.75, ph = t * 18 + f.ph, w = glide ? 0.25 + Math.sin(t * 3 + f.ph) * 0.08 : Math.pow(Math.sin(ph) * 0.5 + 0.5, 0.6) * 1.35 - 0.2;
          const y = 1.2 + Math.sin(t * 1.7 + f.ph) * 0.6 + (glide ? 0 : Math.sin(ph) * 0.04);
          const dx = x - f.last.x, dz = z - f.last.z; if (dx * dx + dz * dz > 1e-6) f.b.rotation.y = Math.atan2(dx, dz); f.last.set(x, y, z);
          f.b.position.set(x, y, z); f.b.rotation.x = -0.15 + (glide ? 0.05 : Math.sin(ph) * 0.06);
          f.w1.rotation.z = w; f.w2.rotation.z = -w;
        });
        if (def.lightning) { boltT -= dt; skyM.material.uniforms.flash.value *= Math.max(0, 1 - dt * 6); hemi.intensity = def.hemi[2] + skyM.material.uniforms.flash.value * 1.5;
          if (boltT <= 0) { boltT = 5 + Math.random() * 9; skyM.material.uniforms.flash.value = 1; if (fx) { const a = Math.random() * 6.283, p = new V3(Math.cos(a) * 80, 0, Math.sin(a) * 80); fx.bolt(new V3(p.x, 90, p.z), p, { color: 0xd8b0ff, life: 0.3, light: false }); } BR.Audio.fx('zap', { g: 0.25, rate: 0.5 }); } }
        if (fx && def.fx) ambient(def.fx, dt, fx);
      },
      dispose() { scene.remove(g); K.dispose(); g.traverse(o => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); }); } }); },
    };
  }
  // particules d'ambiance (autour du centre de l'arène)
  function ambient(A, dt, fx) {
    const n = A.rate * dt; let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    while (k-- > 0) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 42, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (A.kind === 'snow') fx.spark(new V3(x, 14 + Math.random() * 6, z), new V3(1.2 + Math.random(), -3 - Math.random() * 1.5, 0.5), { color: 0xffffff, life: 5, size: 0.16, size1: 0.12, world: true, alpha: 0.9 });
      else if (A.kind === 'leaves') fx.spark(new V3(x, 9 + Math.random() * 5, z), new V3(1.5, -1.4, 0.6), { color: Math.random() < 0.5 ? 0xff9a3a : 0xffc04a, life: 6, size: 0.22, size1: 0.18, world: true, kind: 'smoke', alpha: 0.95 });
      else if (A.kind === 'pollen') fx.spark(new V3(x, 0.5 + Math.random() * 3, z), new V3((Math.random() - 0.5) * 0.4, 0.25, (Math.random() - 0.5) * 0.4), { color: A.color, life: 4, size: 0.09, size1: 0.05, world: true });
      else if (A.kind === 'dust') fx.spark(new V3(x, 0.5 + Math.random() * 4, z), new V3(0.4, 0.1, 0.2), { color: A.color, life: 5, size: 0.08, size1: 0.06, world: true, alpha: 0.6 });
      else if (A.kind === 'wisps') fx.spark(new V3(x, 0.6 + Math.random() * 2.5, z), new V3((Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6), { color: A.color, life: 3.5, size: 0.35, size1: 0.05, world: true });
      else if (A.kind === 'mist') { if (Math.random() < 0.35) fx.spark(new V3(x, 0.15, z), new V3((Math.random() - 0.5) * 0.4, 0.03, (Math.random() - 0.5) * 0.4), { color: 0x3a3a4a, life: 7, size: 1.6, size1: 3, world: true, kind: 'smoke', alpha: 0.05 }); if (Math.random() < 0.15) fx.spark(new V3(x, 1 + Math.random() * 2, z), new V3(0, 0.4, 0), { color: A.color, life: 2.5, size: 0.3, size1: 0.02, world: true }); }
      else if (A.kind === 'embers') fx.spark(new V3(x, 0.2 + Math.random() * 2, z), new V3((Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.8), { color: A.color, life: 2.5, size: 0.14, size1: 0.02, world: true });
    }
  }

  /* ---------- 10 — LE NÉANT : le plateau flottant d'origine, version cauchemar (lune de sang, flèches noires) ---------- */
  function neant(scene, quality) {
    const base = buildBase(scene, 'neant', quality), g = base.group;
    g.traverse(o => { if (o.isHemisphereLight) o.intensity = 0.45; if (o.isAmbientLight) o.intensity = 0.05; });
    const m = new THREE.MeshStandardMaterial({ color: L('#0c0608'), roughness: 0.6, metalness: 0.3, flatShading: true });
    const spikes = [];
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * 6.283, r = 55 + Math.random() * 90, h = 20 + Math.random() * 60;
      const s = new THREE.Mesh(new THREE.ConeGeometry(2 + Math.random() * 4, h, 5), m); s.position.set(Math.cos(a) * r, -20 + Math.random() * 30, Math.sin(a) * r); s.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * 6, (Math.random() - 0.5) * 0.5); if (Math.random() < 0.4) s.rotation.x += Math.PI;
      g.add(s); spikes.push({ s, y0: s.position.y, p: Math.random() * 6 });
    }
    // lune de sang avec une pupille (elle te regarde)
    const moon = new THREE.Group();
    // un œil : blanc jaunâtre veiné, iris rouge sang, pupille fendue
    const eyeC = document.createElement('canvas'); eyeC.width = eyeC.height = 256;
    { const g2 = eyeC.getContext('2d'), gr = g2.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, '#f4ead0'); gr.addColorStop(0.75, '#d8c4a0'); gr.addColorStop(1, '#5a1a10'); g2.fillStyle = gr; g2.beginPath(); g2.arc(128, 128, 127, 0, 7); g2.fill();
      g2.strokeStyle = 'rgba(170,20,20,0.7)'; for (let i = 0; i < 26; i++) { let a = Math.random() * 6.283, r = 126; g2.lineWidth = 0.8 + Math.random() * 1.6; g2.beginPath(); g2.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); for (let s = 0; s < 5; s++) { r -= 10 + Math.random() * 10; a += (Math.random() - 0.5) * 0.3; g2.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g2.stroke(); } }
    const eyeT = new THREE.CanvasTexture(eyeC); eyeT.encoding = THREE.sRGBEncoding;
    const disk = new THREE.Mesh(new THREE.CircleGeometry(26, 48), new THREE.MeshBasicMaterial({ map: eyeT, color: new THREE.Color(1.5, 1.5, 1.5), fog: false }));
    const iris = new THREE.Mesh(new THREE.CircleGeometry(11, 40), new THREE.MeshBasicMaterial({ color: L('#c4000e').multiplyScalar(1.6), fog: false })); iris.position.z = 0.1;
    const pup = new THREE.Mesh(new THREE.CircleGeometry(8, 32), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); pup.position.z = 0.2; pup.scale.x = 0.22;
    moon.add(disk, iris, pup); moon.position.set(60, 120, -260); moon.lookAt(0, 0, 0); g.add(moon);
    let t = 0;
    const up0 = base.update;
    base.update = function (dt, fx) {
      up0(dt, fx); t += dt;
      spikes.forEach(s => { s.s.position.y = s.y0 + Math.sin(t * 0.3 + s.p) * 2; });
      // la pupille suit lentement la caméra
      const cam = scene.userData.cam; if (cam && cam.position) { const d = cam.position.clone().sub(moon.position).normalize(); iris.position.x = d.x * 3; iris.position.y = d.y * 3; pup.position.x = iris.position.x; pup.position.y = iris.position.y; }
      pup.scale.x = 0.18 + Math.abs(Math.sin(t * 0.4)) * 0.08;
      if (fx && Math.random() < dt * 20) { const a = Math.random() * 6.283, r = Math.random() * 38; fx.spark(new V3(Math.cos(a) * r, 0.2, Math.sin(a) * r), new V3(0, 1 + Math.random() * 2, 0), { color: 0xff1a3a, life: 2, size: 0.18, size1: 0.02, world: true }); }
    };
    base.biome = 'neant';
    return base;
  }

  // ordre des mondes de l'Ascension (un par étage)
  AS.ASC_BIOMES = ['prairie', 'foret', 'ruines', 'temple', 'marais', 'neige', 'cimetiere', 'volcan', 'citadelle', 'neant'];
})();

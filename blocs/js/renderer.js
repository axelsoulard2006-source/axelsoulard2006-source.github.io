/* ===== renderer.js : scène Three.js, caméra, ciel, astres, nuages, brouillard, jour/nuit et matériaux des blocs
   Les matériaux des blocs sont des MeshBasicMaterial étendus (onBeforeCompile) :
   - répétition de la tuile de l'atlas sur les grands rectangles fusionnés (attribut « tile » + fract)
   - lumière voxel (attribut « lit » : ciel 0..1, blocs 0..1, code d'animation) : courbe douce, lueur chaude des blocs,
     lit.x > 1.5 = bloc lumineux ; la lumière du ciel suit le jour/nuit (uDay) et sa couleur (uSkyCol)
   - animations : feuillage qui se balance, plantes dont le haut ondule, eau qui ondule, défile et scintille
   Ciel : dôme à dégradé (zénith / horizon / halo du soleil), étoiles qui tournent, soleil et lune ronds à halo doux,
   nuages en volume (cases fusionnées, motif périodique) qui dérivent lentement ; le brouillard prend la couleur de l'horizon.
   Point d'entrée pour de futurs shaders : VX.R.extendBlockShader(fn) ===== */
(function () {
  const VX = window.VX;
  const canvas = document.getElementById('gl');
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1, 0.05, 520);
  const resize = () => { gl.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); };
  window.addEventListener('resize', resize); resize();
  scene.fog = new THREE.Fog(0x000000, 10, 100);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x101010 }));
  outline.visible = false; scene.add(outline);

  /* ---------- dôme du ciel (dégradé + halo du soleil) : suit la caméra, dessiné en premier ---------- */
  const SU = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uFogC: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uGlowC: { value: new THREE.Color() }, uGlow: { value: 0 }, uTwi: { value: 0 },
  };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(440, 32, 16), new THREE.ShaderMaterial({
    uniforms: SU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uFogC; uniform vec3 uSunDir; uniform vec3 uGlowC; uniform float uGlow; uniform float uTwi;',
      'varying vec3 vDir;',
      'void main() {',
      '  vec3 d = normalize(vDir); float h = d.y;',
      '  vec3 c = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));',
      '  c = mix(c, uFogC, smoothstep(0.02, -0.18, h));',
      '  float s = max(dot(d, uSunDir), 0.0);',
      '  c += uGlowC * (pow(s, 32.0) * 0.4 + pow(s, 7.0) * 0.14) * uGlow;',   // halo autour du soleil
      '  vec2 dh = normalize(d.xz + 1e-4), sh = normalize(uSunDir.xz + 1e-4);',
      '  c += uGlowC * uTwi * exp(-abs(h) * 8.0) * pow(max(dot(dh, sh), 0.0), 3.0) * 0.22;',   // bande rosée / orangée à l'horizon
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'),
  }));
  dome.renderOrder = -100; dome.frustumCulled = false; scene.add(dome);

  /* ---------- étoiles (tournent avec la nuit) ---------- */
  const skyRig = new THREE.Group(); scene.add(skyRig);
  const stars = (() => {
    const g = new THREE.BufferGeometry(), p = [], c = [], r = VX.rng(5);
    for (let i = 0; i < 900; i++) {
      const u = r() * 2 - 1, a = r() * 6.283, s = Math.sqrt(1 - u * u), d = 400, b = 0.45 + r() * r() * 0.55, warm = r();
      p.push(Math.cos(a) * s * d, u * d, Math.sin(a) * s * d); c.push(b * (warm > 0.8 ? 1 : 0.85), b * 0.9, b * (warm > 0.8 ? 0.8 : 1));
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, fog: false, transparent: true, vertexColors: true, depthWrite: false }));
    m.renderOrder = -99; m.frustumCulled = false; return m;
  })();
  skyRig.add(stars);

  /* ---------- soleil et lune : disques ronds à halo doux (textures dessinées par le code) ---------- */
  function discTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; return t; }
  const sunTex = discTex(g => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,252,236,1)'); gr.addColorStop(0.17, 'rgba(255,247,214,1)'); gr.addColorStop(0.21, 'rgba(255,224,150,0.5)');
    gr.addColorStop(0.3, 'rgba(255,206,130,0.2)'); gr.addColorStop(0.6, 'rgba(255,190,110,0.05)'); gr.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  const moonTex = discTex(g => {
    const halo = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    halo.addColorStop(0, 'rgba(200,215,255,0.35)'); halo.addColorStop(0.3, 'rgba(170,190,255,0.12)'); halo.addColorStop(1, 'rgba(150,170,255,0)');
    g.fillStyle = halo; g.fillRect(0, 0, 128, 128);
    g.save(); g.beginPath(); g.arc(64, 64, 19, 0, 6.283); g.clip();
    const disc = g.createRadialGradient(58, 58, 2, 64, 64, 20); disc.addColorStop(0, '#f6f8ff'); disc.addColorStop(1, '#cdd5ea');
    g.fillStyle = disc; g.fillRect(40, 40, 48, 48);
    const r = VX.rng(77); g.fillStyle = 'rgba(120,132,165,0.28)';   // « mers » sombres
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(50 + r() * 28, 50 + r() * 28, 2 + r() * 5, 0, 6.283); g.fill(); }
    g.restore();
  });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, transparent: true, depthWrite: false }));
  sun.scale.set(66, 66, 1); moon.scale.set(70, 70, 1); sun.renderOrder = moon.renderOrder = -98; scene.add(sun, moon);

  /* ---------- nuages en volume : motif périodique (64 × 64 cases de 6 blocs), 3 × 3 copies autour du joueur ---------- */
  const CL = { cell: 6, n: 64, th: 4, y: 92 }; CL.period = CL.cell * CL.n;
  const CU = { uCol: { value: new THREE.Color(1, 1, 1) }, uFogC: { value: new THREE.Color() }, uNear: { value: 140 }, uFar: { value: 330 } };
  const cloudGeo = (() => {
    const N = CL.n, S = CL.cell, T = CL.th, r = VX.rng(31337);
    const lat = n => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = r(); return a; };
    const L1 = lat(8), L2 = lat(16);
    const val = (L, n, x, y) => {   // bruit de valeur périodique (raccord parfait d'une copie à l'autre)
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const g = (i, j) => L[((i % n) + n) % n + (((j % n) + n) % n) * n];
      return (g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx) * (1 - sy) + (g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx) * sy;
    };
    const fill = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) fill[i + j * N] = val(L1, 8, i / 8, j / 8) * 0.65 + val(L2, 16, i / 4, j / 4) * 0.35 > 0.55 ? 1 : 0;
    const at = (i, j) => fill[((i % N) + N) % N + (((j % N) + N) % N) * N];
    const p = [], sh = [], idx = [];
    const q = (pts, s) => { const b = p.length / 3; for (const v of pts) { p.push(v[0], v[1], v[2]); sh.push(s); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    // dessus et dessous : rectangles fusionnés
    const used = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!fill[i + j * N] || used[i + j * N]) continue;
      let w = 1; while (i + w < N && fill[i + w + j * N] && !used[i + w + j * N]) w++;
      let h = 1; grow: while (j + h < N) { for (let k = 0; k < w; k++) if (!fill[i + k + (j + h) * N] || used[i + k + (j + h) * N]) break grow; h++; }
      for (let jj = 0; jj < h; jj++) for (let k = 0; k < w; k++) used[i + k + (j + jj) * N] = 1;
      const x0 = i * S, x1 = (i + w) * S, z0 = j * S, z1 = (j + h) * S;
      q([[x0, T, z0], [x0, T, z1], [x1, T, z1], [x1, T, z0]], 1);
      q([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], 0.72);
    }
    // côtés : seulement au bord des nuages
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!fill[i + j * N]) continue; const x0 = i * S, x1 = x0 + S, z0 = j * S, z1 = z0 + S;
      if (!at(i + 1, j)) q([[x1, 0, z0], [x1, T, z0], [x1, T, z1], [x1, 0, z1]], 0.86);
      if (!at(i - 1, j)) q([[x0, 0, z0], [x0, 0, z1], [x0, T, z1], [x0, T, z0]], 0.86);
      if (!at(i, j + 1)) q([[x0, 0, z1], [x1, 0, z1], [x1, T, z1], [x0, T, z1]], 0.8);
      if (!at(i, j - 1)) q([[x0, 0, z0], [x0, T, z0], [x1, T, z0], [x1, 0, z0]], 0.8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('shade', new THREE.Float32BufferAttribute(sh, 1)); g.setIndex(idx);
    g.computeBoundingSphere(); return g;
  })();
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: CU, transparent: true, depthWrite: true, fog: false,
    vertexShader: 'attribute float shade; varying float vS; varying vec3 vW; void main() { vS = shade; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uCol; uniform vec3 uFogC; uniform float uNear; uniform float uFar; varying float vS; varying vec3 vW;\n' +
      'void main() { float f = smoothstep(uNear, uFar, length(vW.xz - cameraPosition.xz)); gl_FragColor = vec4(mix(uCol * vS, uFogC, f * 0.7), (1.0 - f) * 0.92); }',
  });
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(cloudGeo, cloudMat); m.renderOrder = 1; m.frustumCulled = false; clouds.add(m); }
  let drift = 0, lastT = performance.now();

  /* ---------- matériaux des blocs ---------- */
  const U = { uDay: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uMin: { value: 0.03 }, uTime: { value: 0 }, uSkyCol: { value: new THREE.Color(1, 1, 1) } };
  const extra = [];
  function blockMat(opts) {
    const m = new THREE.MeshBasicMaterial(Object.assign({ map: VX.TEX.tex, vertexColors: true }, opts));
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute vec2 tile;\nattribute vec3 lit;\nvarying vec2 vTile;\nvarying vec3 vLit;\nvarying vec2 vLocal;\nvarying vec3 vWPos;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = tile; vLit = lit; vLocal = uv;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'vec3 wp0 = (modelMatrix * vec4(transformed, 1.0)).xyz; vWPos = wp0;',
          'float an = lit.z;',
          // feuillage (1) et haut des plantes (2) : balancement doux, cohérent entre faces voisines (fonction de la position)
          'if (an > 0.5 && an < 2.5) { float amp = an < 1.5 ? 0.035 : 0.085; float ph = uTime * 1.6 + wp0.x * 0.55 + wp0.z * 0.45 + wp0.y * 0.3;',
          '  transformed.x += sin(ph) * amp; transformed.z += cos(ph * 0.83 + 1.7) * amp * 0.8; }',
          // surface de l'eau (3) : légère houle
          'if (an > 2.5 && an < 3.5) transformed.y += (sin(uTime * 1.3 + wp0.x * 0.7 + wp0.z * 0.45) * 0.5 - 0.5) * 0.05;',
        ].join('\n'));
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uDay;\nuniform vec3 uTint;\nuniform float uMin;\nuniform float uTime;\nuniform vec3 uSkyCol;\nvarying vec2 vTile;\nvarying vec3 vLit;\nvarying vec2 vLocal;\nvarying vec3 vWPos;')
        .replace('#include <map_fragment>', [
          'bool water = vLit.z > 2.5;',
          'vec2 lp = vLocal; if (water) lp += vec2(uTime * 0.035, uTime * 0.021);',   // l'eau défile doucement
          'vec2 auv = vTile + (fract(lp) * 0.996 + 0.002) * 0.0625;',
          'vec4 texelColor = texture2D( map, auv );',
          'texelColor = mapTexelToLinear( texelColor );',
          'diffuseColor *= texelColor;',
          'vec3 lc;',
          'if (vLit.x > 1.5) lc = vec3(1.0);',
          'else {',
          '  float sl = pow(clamp(vLit.x, 0.0, 1.0), 1.6), bl = pow(clamp(vLit.y, 0.0, 1.0), 1.6);',
          '  bl *= 0.95 + 0.05 * sin(uTime * 9.0 + vWPos.x * 1.3 + vWPos.z * 0.7);',   // flamme : vacillement à peine visible
          '  vec3 skyL = vec3(sl * uDay) * uSkyCol * uTint, blkL = bl * vec3(1.05, 0.82, 0.56);',
          '  lc = max(skyL, blkL) + 0.25 * min(skyL, blkL);',
          '}',
          'diffuseColor.rgb *= max(lc, vec3(uMin));',
          // eau : reflets qui scintillent au soleil
          'if (water) { float sp = sin(vWPos.x * 1.7 + uTime * 1.9) * sin(vWPos.z * 1.3 - uTime * 1.4 + vWPos.x * 0.4);',
          '  diffuseColor.rgb *= 1.0 + 0.07 * sp; diffuseColor.rgb += vec3(0.10, 0.13, 0.16) * smoothstep(0.82, 1.0, sp) * uDay * clamp(vLit.x, 0.0, 1.0); }',
        ].join('\n'));
      for (const fn of extra) fn(sh);
    };
    return m;
  }
  const mats = {
    o: blockMat({ alphaTest: 0.5 }),
    t: blockMat({ transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  };

  /* ---------- couleurs du cycle (20 min) ---------- */
  const C = hex => new THREE.Color(hex);
  const K = {
    dayZ: C('#4f8fe3'), dayH: C('#b3dbf6'), nightZ: C('#050918'), nightH: C('#141d3a'),
    dawnZ: C('#6874b4'), dawnH: C('#f3a9b6'), dawnG: C('#ffc4b0'),   // aube rosée
    duskZ: C('#5b5498'), duskH: C('#f29a55'), duskG: C('#ffae5e'),   // crépuscule orangé
    dayG: C('#fff1cf'), nightG: C('#9fb4ff'),
    cloudDay: C('#ffffff'), cloudDawn: C('#ffd2d6'), cloudDusk: C('#ffc596'), cloudNight: C('#2a3150'),
    skyDay: C('#ffffff'), skyTwi: C('#ffd9bd'), skyNight: C('#9fb6ff'),
    braises: C('#3a1838'), water: C('#1c3f8a'), lava: C('#c84a10'),
  };
  const zen = new THREE.Color(), hor = new THREE.Color(), twZ = new THREE.Color(), twH = new THREE.Color(), twG = new THREE.Color(), fogC = new THREE.Color(), tmp = new THREE.Color();
  const sunDir = new THREE.Vector3();
  const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  VX.R = {
    gl, scene, camera, outline, stars, sun, moon, clouds, dome, mats, uniforms: U,
    // ajoute une transformation de shader (appelée à la compilation des matériaux de blocs)
    extendBlockShader(fn) { extra.push(fn); mats.o.needsUpdate = mats.t.needsUpdate = true; },
    // ciel, astres, nuages, lumière et brouillard
    sky(dim, time, P, R, under) {
      const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      U.uTime.value = (now / 1000) % 3600;
      const cx = P.pos.x, cy = P.eye, cz = P.pos.z, surface = dim === 'surface', open = surface && !under;
      let fog;
      if (surface) {
        const ang = time * Math.PI * 2, s = Math.sin(ang), c = Math.cos(ang);
        const k = Math.max(0, Math.min(1, s * 2.2 + 0.45));   // luminosité du jour (même courbe qu'avant : créatures)
        const dayK = sstep(-0.12, 0.32, s), tw = Math.exp(-(s / 0.22) * (s / 0.22)), morn = sstep(-0.3, 0.3, c);
        U.uDay.value = 0.16 + 0.84 * k; U.uTint.value.setRGB(1, 1, 1);
        // aube (soleil qui se lève, c > 0) ou crépuscule (c < 0)
        twZ.copy(K.duskZ).lerp(K.dawnZ, morn); twH.copy(K.duskH).lerp(K.dawnH, morn); twG.copy(K.duskG).lerp(K.dawnG, morn);
        zen.copy(K.nightZ).lerp(K.dayZ, dayK).lerp(twZ, tw * 0.55);
        hor.copy(K.nightH).lerp(K.dayH, dayK).lerp(twH, tw * 0.85);
        fogC.copy(hor).lerp(zen, 0.18);
        SU.uZenith.value.copy(zen); SU.uHorizon.value.copy(hor); SU.uFogC.value.copy(fogC);
        sunDir.set(c, s, 0.28).normalize(); SU.uSunDir.value.copy(sunDir); if (s <= -0.15) SU.uSunDir.value.negate();   // la nuit, le halo suit la lune
        SU.uGlowC.value.copy(K.dayG).lerp(twG, tw); SU.uGlow.value = s > -0.15 ? 0.35 + tw * 0.45 : 0.12; SU.uTwi.value = tw * (s > -0.25 ? 1 : 0);
        if (s <= -0.15) SU.uGlowC.value.copy(K.nightG);   // la nuit : léger halo bleuté autour de la lune
        // couleur de la lumière du ciel sur les blocs
        U.uSkyCol.value.copy(K.skyNight).lerp(K.skyDay, dayK).lerp(K.skyTwi, tw * 0.6);
        // astres
        sun.position.set(cx + sunDir.x * 360, cy + sunDir.y * 360, cz + sunDir.z * 360);
        moon.position.set(cx - sunDir.x * 360, cy - sunDir.y * 360, cz - sunDir.z * 360);
        sun.material.opacity = sstep(-0.2, 0.05, s); moon.material.opacity = 1 - dayK * 0.85;
        // étoiles : tournent avec le ciel, s'effacent au jour
        skyRig.position.set(cx, cy, cz); skyRig.rotation.set(0, 0, ang); stars.material.opacity = Math.max(0, 1 - dayK * 1.4);
        // nuages : couleur selon l'heure, dérive lente vers +x
        CU.uCol.value.copy(K.cloudNight).lerp(K.cloudDay, dayK).lerp(tmp.copy(K.cloudDusk).lerp(K.cloudDawn, morn), tw * 0.7);
        CU.uFogC.value.copy(hor);
        fog = fogC;
      } else { U.uDay.value = 0.92; U.uTint.value.setRGB(1, 0.88, 0.95); U.uSkyCol.value.setRGB(1, 1, 1); fog = K.braises; }
      dome.visible = sun.visible = moon.visible = skyRig.visible = clouds.visible = open;
      if (open) {
        dome.position.set(cx, cy, cz);
        drift += dt * 0.9; const Lp = CL.period, bx = Math.floor((cx - drift) / Lp) * Lp + drift, bz = Math.floor(cz / Lp) * Lp;
        let k = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) clouds.children[k++].position.set(bx + i * Lp, CL.y, bz + j * Lp);
        CU.uFar.value = Math.max(220, Math.min(380, R * 16 * 3)); CU.uNear.value = CU.uFar.value * 0.45;
      }
      const bg = under === 1 ? K.water : under === 2 ? K.lava : fog;
      scene.background = open ? null : bg; if (open) gl.setClearColor(fog);
      scene.fog.color.copy(bg);
      scene.fog.near = under ? 1 : dim === 'braises' ? 8 : R * 16 * 0.55; scene.fog.far = under ? (under === 2 ? 3 : 14) : dim === 'braises' ? R * 16 * 0.75 : R * 16 * 0.95;
    },
    render() { gl.render(scene, camera); },
  };
})();

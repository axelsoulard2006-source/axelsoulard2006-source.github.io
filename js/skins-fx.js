/* ===== skins-fx.js : accessoires et effets des skins MYTHIQUES (BR.SKINS, champ « fx ») =====
   BR.SkinFX.dress(root, look, opt) habille un personnage construit par BR.Avatar.build et renvoie
   { update(dt, ctx), kick(nom), ghost(), dispose() } (ou null pour un skin sans effets).
   - accessoires modélisés dans Blender (outils/blender-skins.py -> assets-skins.js, clés skn_<nom>),
     accrochés aux os KayKit (tête, buste, bras) : ils suivent toutes les animations ;
   - shaders animés sur le corps (fissures de lave, givre, cosmos…), décalque au sol, empreintes,
     traînées lumineuses des yeux, échos fantômes, objets en orbite, particules.
   Les effets « monde » (empreintes, traînées, échos) sont rangés dans un groupe ajouté à la scène qui contient
   le personnage : ils restent sur place quand il bouge. Tout est léger (Points / InstancedMesh) et libéré par dispose().
   Le look est le même pour tout le monde : les autres joueurs voient les mêmes effets (look synchronisé par le serveur). */
(function () {
  const BR = window.BR;
  const SF = (BR.SkinFX = {});
  const V3 = THREE.Vector3, TAU = Math.PI * 2;
  const col = c => new THREE.Color(c);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ATTACK = /Attack|Spin|Stab|Slice|Chop|Kick|Punch|Spellcast|Cheer|Jump_Full|reveal/;

  /* ---------- GLSL commun ---------- */
  const NOISE = `
    float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
    vec3 h33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
    float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h13(i), h13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h13(i + vec3(0.0, 1.0, 0.0)), h13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                 mix(mix(h13(i + vec3(0.0, 0.0, 1.0)), h13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h13(i + vec3(0.0, 1.0, 1.0)), h13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
    float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n3(p); p = p * 2.02 + 1.3; a *= 0.5; } return s; }
    float ve3(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
      for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z)); vec3 r = g + h33(i + g) - f; float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      return sqrt(d2) - sqrt(d1); }
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n2(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
    float ve2(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 r = g + h22(i + g) - f; float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      return sqrt(d2) - sqrt(d1); }
  `;

  /* ---------- shader du corps (MeshStandardMaterial patché) : SK 1 lave, 2 givre, 3 sacré/or, 4 cosmos, 5 éclipse ---------- */
  const BODY = `
    vec3 skinGlow(vec3 P, vec3 N, vec3 VV){
      float fr = pow(1.0 - abs(dot(normalize(N), normalize(VV))), 2.4);
    #if SK == 1
      float e = ve3(P * 5.5);
      float crack = 1.0 - smoothstep(0.015, 0.085, e);
      float pulse = 0.55 + 0.45 * sin(uT * 2.6 - P.y * 4.0 + n3(P * 2.0) * 3.0);
      return mix(uC1, uC2, pulse * crack) * crack * (0.7 + 1.8 * pulse) * uK + uC1 * fr * 0.7;
    #elif SK == 2
      float vein = 1.0 - smoothstep(0.0, 0.045, ve3(P * 4.0));
      float glint = step(0.955, n3(P * 30.0 + floor(uT * 3.0)));
      return uC1 * (fr * 1.25 + vein * 0.3 * uK) + uC2 * glint * 0.9;
    #elif SK == 3
      float band = pow(0.5 + 0.5 * sin(P.y * 8.0 - uT * 3.0), 8.0);
      return uC1 * (fr * 1.3 + band * 0.3 * uK) + uC2 * fr * fr * 0.5;
    #elif SK == 4
      float neb = fbm3(P * 2.6 + vec3(0.0, uT * 0.18, uT * 0.05));
      vec3 sp = P * 34.0 + vec3(0.0, uT * 0.7, 0.0); vec3 cell = floor(sp); float hs = h13(cell);
      float star = step(0.88, hs) * smoothstep(0.32, 0.0, length(fract(sp) - 0.5)) * (0.55 + 0.45 * sin(uT * 4.0 + hs * 40.0));
      return mix(uC2, uC1, smoothstep(0.35, 0.85, neb)) * (0.25 + 0.9 * neb * neb) * uK + vec3(0.95, 0.9, 1.0) * star * 1.4 + uC1 * fr * 1.7;
    #else
      float vein = (1.0 - smoothstep(0.0, 0.04, ve3(P * 3.2))) * step(0.42, n3(P * 2.0));
      float scan = pow(0.5 + 0.5 * sin(P.y * 6.0 - uT * 4.0), 10.0);
      return uC1 * (vein * (0.7 + 1.5 * scan) * uK + fr * 1.35) + uC2 * scan * 0.12;
    #endif
    }`;
  function patchMat(src, sk, U) {
    const m = src.clone();
    m.defines = Object.assign({}, m.defines || {}, { SK: sk });
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = U.T; sh.uniforms.uK = U.K; sh.uniforms.uC1 = U.c1; sh.uniforms.uC2 = U.c2;
      sh.vertexShader = 'varying vec3 vSP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSP = position;');
      sh.fragmentShader = 'uniform float uT, uK; uniform vec3 uC1, uC2; varying vec3 vSP;\n' + NOISE + BODY + '\n' +
        sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += skinGlow(vSP, normal, vViewPosition);');
    };
    m.customProgramCacheKey = () => 'sknbody' + sk;
    return m;
  }

  /* ---------- particules (Points) ---------- */
  const PVS = `attribute float aSize; attribute float aAlpha; attribute vec3 aCol; attribute float aRot; uniform float uPx;
    varying float vA; varying vec3 vC; varying float vR;
    void main(){ vA = aAlpha; vC = aCol; vR = aRot; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPx / max(0.15, -mv.z); gl_Position = projectionMatrix * mv; }`;
  const PFS = `uniform float uShape; varying float vA; varying vec3 vC; varying float vR;
    void main(){
      vec2 p = gl_PointCoord - 0.5; float cs = cos(vR), sn = sin(vR); p = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
      float d = length(p), a;
      if (uShape < 0.5) a = smoothstep(0.5, 0.0, d);
      else if (uShape < 1.5) { vec2 q = abs(p); a = max(smoothstep(0.07, 0.0, q.x), smoothstep(0.07, 0.0, q.y)) * smoothstep(0.5, 0.1, d) + smoothstep(0.22, 0.0, d); }
      else if (uShape < 2.5) { vec2 q = abs(p); a = smoothstep(0.5, 0.36, q.x * 2.8 + q.y) * (0.55 + 0.45 * smoothstep(0.06, 0.0, q.x)); }
      else if (uShape < 3.5) a = smoothstep(0.5, 0.1, d) * 0.8;
      else { float an = atan(p.y, p.x); a = pow(abs(cos(an * 3.0)), 16.0) * smoothstep(0.5, 0.05, d) + smoothstep(0.15, 0.0, d); }
      a *= vA; if (a < 0.01) discard;
      gl_FragColor = vec4(vC, a);
    }`;
  const SHAPE = { glow: 0, spark: 1, feather: 2, smoke: 3, snow: 4 };
  /** système de particules ; o = { shape, normal (mélange normal), spawn(P, i, init), step(P, i, dt) } */
  function PSys(n, o) {
    const g = new THREE.BufferGeometry();
    const P = { n, o, pos: new Float32Array(n * 3), size: new Float32Array(n), alpha: new Float32Array(n), tint: new Float32Array(n * 3), rot: new Float32Array(n),
      vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), base: new Float32Array(n), spin: new Float32Array(n), a0: new Float32Array(n), dead: !!o.burst };
    g.setAttribute('position', new THREE.BufferAttribute(P.pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(P.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(P.alpha, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(P.tint, 3)); g.setAttribute('aRot', new THREE.BufferAttribute(P.rot, 1));
    const mat = new THREE.ShaderMaterial({ uniforms: { uShape: { value: SHAPE[o.shape] || 0 }, uPx: { value: 330 } }, vertexShader: PVS, fragmentShader: PFS,
      transparent: true, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 3;
    Object.assign(P, { g, mat, pts });
    P.set = (i, x, y, z, vx, vy, vz, life, size, c, a0, spin) => {
      const i3 = i * 3; P.pos[i3] = x; P.pos[i3 + 1] = y; P.pos[i3 + 2] = z; P.vel[i3] = vx; P.vel[i3 + 1] = vy; P.vel[i3 + 2] = vz;
      P.max[i] = life; P.life[i] = life; P.base[i] = size; P.size[i] = size; P.a0[i] = a0 == null ? 1 : a0; P.spin[i] = spin || 0; P.rot[i] = Math.random() * TAU;
      P.tint[i3] = c.r; P.tint[i3 + 1] = c.g; P.tint[i3 + 2] = c.b;
    };
    if (!o.burst) for (let i = 0; i < n; i++) { o.spawn(P, i, true); P.life[i] = Math.random() * P.max[i]; }
    P.update = function (dt, K) {
      const grav = o.grav || 0, drag = o.drag || 0, k0 = 1 - Math.min(1, drag * dt);
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        if (P.life[i] <= 0) { if (o.burst) { P.alpha[i] = 0; continue; } o.spawn(P, i, false); }
        P.life[i] -= dt;
        P.vel[i3 + 1] += grav * dt; P.vel[i3] *= k0; P.vel[i3 + 1] *= k0; P.vel[i3 + 2] *= k0;
        P.pos[i3] += P.vel[i3] * dt; P.pos[i3 + 1] += P.vel[i3 + 1] * dt; P.pos[i3 + 2] += P.vel[i3 + 2] * dt;
        if (o.step) o.step(P, i, dt, K);
        if (o.local && K) P.pos[i3 + 2] -= K.drag * dt * 2.4;      // traînée vers l'arrière quand on court
        const k = Math.max(0, P.life[i] / P.max[i]);
        P.alpha[i] = (o.fadeIn ? Math.min(1, (1 - k) * 6) * k : Math.sin(k * Math.PI)) * P.a0[i] * (o.power && K ? 0.45 + 0.55 * Math.min(1.4, K.P.value) : 1);
        P.size[i] = P.base[i] * (o.grow ? 1 + (1 - k) * o.grow : 1);
        P.rot[i] += P.spin[i] * dt;
      }
      const at = g.attributes; at.position.needsUpdate = at.aAlpha.needsUpdate = at.aSize.needsUpdate = at.aRot.needsUpdate = at.aCol.needsUpdate = true;
    };
    P.dispose = () => { g.dispose(); mat.dispose(); };
    return P;
  }

  /* ---------- texture de runes (bande 1024 x 64, alpha) ---------- */
  let runeTex = null;
  function runes() {
    if (runeTex) return runeTex;
    const c = document.createElement('canvas'); c.width = 1024; c.height = 64; const g = c.getContext('2d');
    let s = 1234567; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 6;
    for (let i = 0; i < 24; i++) {
      const x0 = i * (1024 / 24) + 9, w = 24, y0 = 12, h = 40;
      g.beginPath(); g.moveTo(x0 + w / 2, y0); g.lineTo(x0 + w / 2, y0 + h);
      for (let k = 0; k < 3; k++) {
        const ax = x0 + r() * w, ay = y0 + r() * h, bx = x0 + r() * w, by = y0 + r() * h;
        if (r() < 0.3) { g.moveTo(ax + 6, ay); g.arc(ax, ay, 6, 0, TAU * (0.5 + r() * 0.5)); } else { g.moveTo(ax, ay); g.lineTo(bx, by); }
      }
      g.stroke();
    }
    runeTex = new THREE.CanvasTexture(c); runeTex.wrapS = THREE.RepeatWrapping; runeTex.wrapT = THREE.ClampToEdgeWrapping;
    return runeTex;
  }

  /* ---------- décalque au sol (DK 1 givre, 2 lave, 3 runes d'or, 4 flaque d'ombre, 5 cercle d'éclipse) ---------- */
  const DECAL_FS = `uniform float uT, uK, uF; uniform vec3 uC1, uC2; uniform sampler2D uRune; varying vec2 vUv;
    ${NOISE}
    void main(){
      vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x); vec3 c; float al;
    #if DK == 1
      float R = 0.55 + 0.05 * sin(uT * 1.3) + 0.15 * uK;
      float edge = R + 0.2 * (fbm2(vec2(a * 2.5 + 3.0, uT * 0.15)) - 0.5);
      float cov = 1.0 - smoothstep(edge - 0.25, edge, r);
      float cr = 1.0 - smoothstep(0.0, 0.05, ve2(p * 7.0));
      float sp = step(0.965, h12(floor(p * 60.0) + floor(uT * 3.0)));
      c = mix(uC1 * 0.7, uC2, cr * 0.8 + sp); al = cov * (0.16 + 0.5 * cr + 0.9 * sp);
    #elif DK == 2
      float cr = 1.0 - smoothstep(0.0, 0.06, ve2(p * 4.0 + 7.0));
      float fade = 1.0 - smoothstep(0.3, 0.95, r + 0.18 * (fbm2(p * 3.0) - 0.5));
      float pulse = 0.6 + 0.4 * sin(uT * 2.6 - r * 6.0);
      c = mix(uC1, uC2, cr * pulse * 0.8); al = fade * (cr * pulse + 0.28 * (1.0 - r)) * (0.65 + 0.35 * uK);
    #elif DK == 3
      float rings = smoothstep(0.012, 0.0, abs(r - 0.86)) + smoothstep(0.01, 0.0, abs(r - 0.62)) + 0.5 * smoothstep(0.008, 0.0, abs(r - 0.36));
      float rune = texture2D(uRune, vec2(a / 6.2832 + uT * 0.04, (r - 0.65) / 0.18)).a * step(0.65, r) * step(r, 0.83);
      float rays = pow(0.5 + 0.5 * sin(a * 12.0 + uT * 0.8), 14.0) * smoothstep(0.62, 0.1, r) * 0.4;
      c = mix(uC1, uC2, rune * 0.5); al = (rings + rune + rays + smoothstep(0.6, 0.0, r) * 0.2) * (0.6 + 0.4 * uK);
    #elif DK == 4
      float n = fbm2(vec2(a * 1.5, uT * 0.3) + 4.0);
      float ten = pow(abs(sin(a * 4.0 + n * 4.0 + uT * 0.4)), 6.0) * 0.38 * (0.6 + 0.4 * sin(uT * 1.7 + a * 3.0));
      float edge = 0.46 + 0.1 * n + ten + 0.08 * uK;
      float inside = 1.0 - smoothstep(edge - 0.07, edge, r);
      float rim = smoothstep(0.07, 0.0, abs(r - edge + 0.035));
      float sw = fbm2(vec2(a * 2.0 - uT * 0.6 + r * 5.0, r * 4.0 - uT));
      c = uC1 * rim * 1.5 + uC2 * sw * inside * 0.7; al = inside * 0.82 + rim * 0.5;
    #else
      float rings = smoothstep(0.012, 0.0, abs(r - 0.92)) + smoothstep(0.012, 0.0, abs(r - 0.72)) + smoothstep(0.008, 0.0, abs(r - 0.46));
      float ra = texture2D(uRune, vec2(a / 6.2832 - uT * 0.05, (r - 0.74) / 0.16)).a * step(0.74, r) * step(r, 0.9);
      float rb = texture2D(uRune, vec2(a / 6.2832 * 2.0 + uT * 0.08 + 0.37, (r - 0.49) / 0.2)).a * step(0.49, r) * step(r, 0.69);
      float tri = max(abs(p.x) * 0.866 + p.y * 0.5, -p.y);
      float tri2 = max(abs(p.x) * 0.866 - p.y * 0.5, p.y);
      float star = (smoothstep(0.012, 0.0, abs(tri - 0.46)) + smoothstep(0.012, 0.0, abs(tri2 - 0.46))) * step(r, 0.47);
      float cr = (1.0 - smoothstep(0.0, 0.04, ve2(p * 5.0))) * smoothstep(0.75, 0.2, r) * (0.55 + 0.45 * sin(uT * 3.0));
      c = mix(uC1, uC2, ra * 0.6); al = (rings * 0.9 + ra + rb * 0.8 + star + cr * 0.8) * (0.65 + 0.35 * uK);
    #endif
      al *= (1.0 + uF * 1.5) * smoothstep(1.0, 0.92, r);
      if (al < 0.004) discard;
      gl_FragColor = vec4(c * (1.0 + uF), min(al, 1.0));
    }`;
  const UV_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

  /* ---------- halo vertical derrière la tête (HK 1 runes dorées, 2 soleil noir) ---------- */
  const HALO_FS = `uniform float uT, uK, uF; uniform vec3 uC1, uC2; uniform sampler2D uRune; varying vec2 vUv;
    ${NOISE}
    void main(){
      vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x);
    #if HK == 1
      float rune = texture2D(uRune, vec2(a / 6.2832 - uT * 0.06, (r - 0.62) / 0.2)).a * step(0.62, r) * step(r, 0.82);
      float rings = smoothstep(0.015, 0.0, abs(r - 0.86)) + smoothstep(0.012, 0.0, abs(r - 0.58));
      float rays = pow(0.5 + 0.5 * sin(a * 16.0 - uT * 1.2), 10.0) * smoothstep(1.0, 0.5, r) * step(0.86, r) * 0.6;
      float core = smoothstep(0.6, 0.2, r) * 0.18;
      vec3 c = mix(uC1, uC2, rune * 0.6 + rings * 0.4) * (1.0 + uF);
      float al = (rune + rings + rays + core) * (0.65 + 0.35 * uK);
      if (al < 0.004) discard;
      gl_FragColor = vec4(c, min(1.0, al));
    #else
      float n = fbm2(vec2(a * 3.0, r * 4.0 - uT * 1.4));
      float rr = r - n * 0.28 * (0.6 + 0.4 * sin(a * 5.0 + uT));
      float disk = 1.0 - smoothstep(0.38, 0.4, r);
      float cor = smoothstep(0.98, 0.4, rr) * step(0.39, r) * (0.7 + 0.3 * uK);
      float rim = smoothstep(0.04, 0.0, abs(r - 0.4));
      vec3 cc = mix(uC2, uC1, smoothstep(0.4, 0.75, r)) * (1.0 + uF);
      float al = max(disk, clamp(cor * 1.2 + rim, 0.0, 1.0));
      if (al < 0.004) discard;
      gl_FragColor = vec4(cc * (cor * 1.5 + rim * 2.2) * (1.0 - disk), al);
    #endif
    }`;

  /* ---------- empreintes (InstancedMesh) : PK comme DK ---------- */
  const PRINT_VS = `attribute float aAge; attribute float aSeed; varying vec2 vUv; varying float vAge; varying float vSeed;
    void main(){ vUv = uv; vAge = aAge; vSeed = aSeed; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
  const PRINT_FS = `uniform vec3 uC1, uC2; varying vec2 vUv; varying float vAge; varying float vSeed;
    ${NOISE}
    void main(){
      if (vAge >= 1.0) discard;
      vec2 q = (vUv - 0.5) * 2.0; float d = length(q), fade = 1.0 - vAge; vec3 c; float a;
    #if PK == 1
      float an = atan(q.y, q.x);
      float arms = pow(abs(cos(an * 3.0 + vSeed * 6.0)), 18.0) * smoothstep(0.95, 0.1, d);
      c = mix(uC1, uC2, 0.6); a = (arms + smoothstep(0.35, 0.0, d) * 0.6 + smoothstep(0.06, 0.0, abs(d - 0.5)) * 0.4) * fade;
    #elif PK == 2
      float e = length(q * vec2(1.6, 1.0));
      float cr = 1.0 - smoothstep(0.0, 0.08, ve2(q * 3.0 + vSeed * 10.0));
      float heat = fade * fade;
      c = mix(uC1 * 0.7, uC2, heat); a = smoothstep(0.9, 0.6, e) * (0.3 + cr) * (0.25 + heat);
      a *= fade;
    #elif PK == 3
      float ring = smoothstep(0.07, 0.0, abs(d - 0.62));
      float crs = (smoothstep(0.05, 0.0, abs(q.x)) + smoothstep(0.05, 0.0, abs(q.y))) * step(d, 0.85);
      c = mix(uC1, uC2, 0.4); a = (ring + crs * 0.7 + smoothstep(0.3, 0.0, d) * 0.5) * fade;
    #elif PK == 4
      float n = n2(q * 3.0 + vSeed * 9.0); float dd = d + n * 0.35;
      c = mix(vec3(0.0), uC1, smoothstep(0.55, 0.78, dd)); a = smoothstep(0.92, 0.6, dd) * 0.85 * fade;
    #else
      float tri = max(abs(q.x) * 0.866 + q.y * 0.5, -q.y);
      c = uC1; a = (smoothstep(0.06, 0.0, abs(tri - 0.42)) + smoothstep(0.05, 0.0, abs(d - 0.78)) + smoothstep(0.25, 0.0, d) * 0.6) * fade;
    #endif
      if (a < 0.01) discard;
      gl_FragColor = vec4(c, min(1.0, a));
    }`;

  /* ---------- flamme enveloppante (couronne de feu) ---------- */
  const FLAME_VS = 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }';
  const FLAME_FS = `uniform float uT, uK; uniform vec3 uC1, uC2; varying vec2 vUv; varying float vF;
    ${NOISE}
    void main(){
      vec2 p = vec2(vUv.x * 7.0, vUv.y * 1.6 - uT * 1.9);
      float f = fbm2(p + fbm2(p * 1.7 + uT * 0.4));
      float h = vUv.y;
      float shape = smoothstep(0.0, 0.1, h) * pow(1.0 - h, 1.2);
      float a = smoothstep(0.42 - h * 0.3, 0.95, f + 0.3 * (1.0 - h)) * shape * (0.35 + 0.65 * pow(1.0 - vF, 0.8)) * (0.8 + 0.4 * uK);
      vec3 c = mix(uC1, uC2, smoothstep(0.45, 0.95, f) * (1.0 - h * 0.6));
      if (a < 0.01) discard;
      gl_FragColor = vec4(c * 1.4, a);
    }`;

  /* ---------- ailes d'énergie ---------- */
  const WING_FS = `uniform float uT, uK, uF; uniform vec3 uC1, uC2; varying vec2 vUv; varying float vF;
    void main(){
      float u = vUv.x, v = vUv.y;
      float flow = 0.5 + 0.5 * sin(u * 9.0 - uT * 5.0 + v * 7.0);
      float tip = smoothstep(0.5, 1.0, u);
      vec3 c = mix(uC1, uC2, u * 0.6 + flow * 0.4) * (1.0 + tip * 0.8 + uF);
      float a = (0.22 + 0.45 * u + 0.25 * flow) * (0.6 + 0.4 * uK) * (0.6 + 0.4 * (1.0 - vF * 0.6)) * (1.0 + uF);
      gl_FragColor = vec4(c, min(1.0, a));
    }`;

  /* ---------- cape spectrale : ondule, traîne vers l'arrière quand on court, se dissout en bas ---------- */
  const CAPE_VS = `uniform float uT, uDrag; varying vec2 vUv; varying float vF;
    void main(){
      vUv = uv; float w = uv.y * uv.y; vec3 p = position;
      p.z -= w * uDrag * 0.75; p.y += w * uDrag * 0.35;
      p.x += w * sin(uT * 3.1 + uv.y * 6.0 + uv.x * 5.0) * 0.07;
      p.z += w * sin(uT * 2.3 + uv.y * 5.0 + uv.x * 8.0) * (0.1 + uDrag * 0.08) - w * 0.08;
      vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(p, 1.0); vF = abs(dot(n, normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
    }`;
  const CAPE_FS = `uniform float uT, uK; uniform vec3 uC1, uC2; varying vec2 vUv; varying float vF;
    ${NOISE}
    void main(){
      float n = fbm2(vec2(vUv.x * 3.0, vUv.y * 2.2 - uT * 0.35));
      float vein = pow(1.0 - abs(n - 0.5) * 2.0, 10.0);
      float stars = step(0.93, h12(floor(vUv * vec2(60.0, 80.0) + vec2(0.0, floor(uT * 2.0))))) * 0.8;
      vec3 c = uC2 * n * 0.55 + uC1 * (vein * 0.9 * uK + pow(1.0 - vF, 3.0) * 0.6) + vec3(0.9, 0.8, 1.0) * stars;
      float dis = smoothstep(n * 0.55 + 0.4, n * 0.55 + 0.5, vUv.y);
      float a = 0.93 * (1.0 - dis);
      c += uC1 * smoothstep(0.0, 0.12, dis) * (1.0 - dis) * 2.5;
      if (a < 0.02) discard;
      gl_FragColor = vec4(c, a);
    }`;
  /* voile : tourbillon violet dans le noir (le visage a disparu) */
  const VEIL_VS = 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const VEIL_FS = `uniform float uT, uK; uniform vec3 uC1; varying vec3 vP;
    ${NOISE}
    void main(){
      vec2 q = vec2(vP.x, vP.y - 1.6) / 0.44; float r = length(q), a = atan(q.y, q.x);
      float sw = fbm2(vec2(a * 2.0 + r * 5.0 - uT * 1.6, r * 3.0 - uT * 0.4));
      vec3 c = uC1 * pow(sw, 3.0) * (1.0 - r * 0.8) * 1.6 * uK;
      gl_FragColor = vec4(c, 1.0);
    }`;

  /* ---------- ressources ---------- */
  function glb(key) { const g = BR.Assets && BR.Assets.models && BR.Assets.models['skn_' + key]; return g ? g.scene : null; }
  const fbGeo = {};
  function fxGeo(name) {
    const s = glb('common'), o = s && s.getObjectByName('fx__' + name);
    if (o && o.geometry) return o.geometry;
    if (!fbGeo[name]) fbGeo[name] = name === 'blade' ? new THREE.BoxGeometry(0.1, 1, 0.03).translate(0, 0.45, 0) : name === 'rock' ? new THREE.DodecahedronGeometry(0.12, 0) : new THREE.OctahedronGeometry(0.1, 0).scale(0.6, 2, 0.6);
    return fbGeo[name];
  }
  function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }

  /* ================= habillage ================= */
  /**
   * root : groupe du personnage (BR.Avatar.build) ; look : { skin, aura } ; opt : { model, head }.
   */
  SF.dress = function (root, look, opt) {
    opt = opt || {};
    const skin = BR.skinById(look && look.skin);
    const build = skin && skin.fx && SKINS[skin.fx];
    if (!build) return null;
    const model = opt.model || root.children[0];
    if (!model) return null;
    const K = {
      root, model, skin, bones: {}, upd: [], disp: [], mats: [], geos: [], fxMeshes: [], ghosted: false,
      local: new THREE.Group(), world: new THREE.Group(),
      T: { value: Math.random() * 20 }, P: { value: 0.7 }, F: { value: 0 }, drag: 0, speed: 0, ctx: {}, lastUpd: 0,
      wpos: new V3(), prev: null, stride: 0, side: 0, kicks: [],
    };
    K.local.name = 'skinfx'; K.world.name = 'skinfx-world'; root.add(K.local);
    model.traverse(o => { if (o.isBone) K.bones[o.name] = o; });
    K.head = opt.head || K.bones.head;
    root.updateMatrixWorld(true);
    // garde-fou : un groupe monde qui n'est plus mis à jour (personnage retiré sans dispose) s'éteint tout seul
    const guard = () => { if (performance.now() - K.lastUpd > 500) K.world.visible = false; };
    K.worldAdd = o => { o.frustumCulled = false; o.onBeforeRender = guard; K.world.add(o); return o; };
    K.U = (c1, c2) => ({ T: K.T, K: K.P, c1: { value: col(c1) }, c2: { value: col(c2 || c1) } });
    K.own = m => { K.mats.push(m); return m; };
    K.fx = m => { K.fxMeshes.push(m); m.castShadow = false; m.receiveShadow = false; return m; };

    try { build(K); } catch (e) { console.warn('SkinFX', e); }

    let t = 0;
    const h = {
      update(dt, ctx) {
        ctx = ctx || {}; K.ctx = ctx; t += dt; K.lastUpd = performance.now();
        K.T.value += dt;
        K.speed = ctx.speed || 0;
        const sp = Math.min(1.6, K.speed / 6);
        K.drag += (sp - K.drag) * Math.min(1, dt * 4);
        const target = ctx.down ? 0.25 : 0.65 + sp * 0.4 + (ctx.sprint ? 0.15 : 0) + (ctx.boost || 0) + K.F.value * 0.8;
        K.P.value += (target - K.P.value) * Math.min(1, dt * 3);
        K.F.value = Math.max(0, K.F.value - dt * 1.8);
        // groupe monde : accroché à la scène qui contient le personnage (pas pour les vignettes ni si le personnage est caché)
        let top = root; while (top.parent) top = top.parent;
        const vis = !K.ghosted && top.isScene && shown(root);
        if (vis && K.world.parent !== top) { if (K.world.parent) K.world.parent.remove(K.world); top.add(K.world); }
        else if (!top.isScene && K.world.parent) K.world.parent.remove(K.world);
        K.world.visible = vis;
        K.local.visible = !K.ghosted;
        K.wpos.setFromMatrixPosition(root.matrixWorld);
        // pas (empreintes) : distance parcourue au sol
        if (K.prev) {
          const dx = K.wpos.x - K.prev.x, dz = K.wpos.z - K.prev.z, d = Math.hypot(dx, dz);
          if (d > 3) K.stride = 0; else if (!ctx.air && !ctx.down) K.stride += d;
        } else K.prev = new V3();
        K.prev.copy(K.wpos);
        for (const f of K.upd) f(dt, ctx);
        for (const m of K.fxMeshes) m.castShadow = false;
      },
      kick(name) { if (K.ghosted || (name && !ATTACK.test(name))) return; K.F.value = 1; for (const f of K.kicks) f(name); },
      ghost() { K.ghosted = true; K.local.visible = false; K.world.visible = false; for (const m of K.fxMeshes) m.visible = false; },
      dispose() {
        for (const f of K.disp) { try { f(); } catch (e) { } }
        if (K.world.parent) K.world.parent.remove(K.world);
        root.remove(K.local);
        K.mats.forEach(m => m.dispose()); K.geos.forEach(g => g.dispose());
        K.upd.length = 0;
      },
    };
    return h;
  };

  /* ================= briques ================= */
  // corps : shader patché sur toutes les pièces KayKit visibles (pas les armes)
  function body(K, sk, c1, c2) {
    const U = K.U(c1, c2), done = new Map();
    K.model.traverse(o => {
      if (!o.isMesh || !o.visible || o.userData.skn) return;
      for (let p = o.parent; p; p = p.parent) if (/^handslot/i.test(p.name)) return;
      const one = m => {
        if (done.has(m)) return done.get(m);
        const nm = K.own(patchMat(m, sk, U)); done.set(m, nm);
        if (m.userData.own) m.dispose();          // copie teintée intermédiaire (jamais rendue)
        return nm;
      };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
    return U;
  }
  function hide(K, names) { K.model.traverse(o => { if (names.includes(o.name)) o.visible = false; }); }
  // accessoires Blender : chaque objet « os__pièce » est accroché à son os en gardant sa place (pose de repos)
  function accessories(K, key, matFor) {
    const s = glb(key), out = {};
    if (!s) return out;
    K.root.updateMatrixWorld(true);
    s.children.forEach(src => {
      const i = src.name.indexOf('__'); if (i < 0) return;
      const bone = src.name.slice(0, i), part = src.name.slice(i + 2);
      const b = K.bones[bone]; if (!b) return;
      const o = src.clone();
      o.traverse(m => { m.userData.skn = true; if (m.isMesh) { m.frustumCulled = false; const mt = matFor(part, m); if (mt) m.material = mt; } });
      K.model.add(o); o.updateMatrixWorld(true); b.attach(o);
      out[part] = out[part] || []; out[part].push(o);
    });
    return out;
  }
  // décalque au sol
  function decal(K, dk, c1, c2, size, normal) {
    const g = new THREE.PlaneGeometry(size, size); g.rotateX(-Math.PI / 2); K.geos.push(g);
    const m = K.own(new THREE.ShaderMaterial({ defines: { DK: dk }, uniforms: { uT: K.T, uK: K.P, uF: K.F, uC1: { value: col(c1) }, uC2: { value: col(c2) }, uRune: { value: runes() } },
      vertexShader: UV_VS, fragmentShader: DECAL_FS, transparent: true, depthWrite: false, blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const mesh = K.fx(new THREE.Mesh(g, m)); mesh.position.y = 0.025; mesh.renderOrder = 1; mesh.frustumCulled = false; K.local.add(mesh);
    return mesh;
  }
  // halo vertical accroché à la tête (derrière)
  function halo(K, hk, c1, c2, size, y, z, normal) {
    if (!K.head) return null;
    const g = new THREE.PlaneGeometry(size, size); K.geos.push(g);
    const m = K.own(new THREE.ShaderMaterial({ defines: { HK: hk }, uniforms: { uT: K.T, uK: K.P, uF: K.F, uC1: { value: col(c1) }, uC2: { value: col(c2) }, uRune: { value: runes() } },
      vertexShader: UV_VS, fragmentShader: HALO_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending }));
    const mesh = K.fx(new THREE.Mesh(g, m)); mesh.position.set(0, y, z); mesh.renderOrder = 2; mesh.frustumCulled = false; mesh.userData.skn = true; K.head.add(mesh);
    return mesh;
  }
  // traînées lumineuses des yeux (monde)
  function eyeTrail(K, color, life, size) {
    const head = K.head; if (!head) return;
    const ep = K.skin.eyePos || [0.2, 0.62, 0.62], PER = 26, N = PER * 2;
    const c = col(color), P = PSys(N, { shape: 'glow', burst: true, spawn() {} });
    for (let i = 0; i < N; i++) { const i3 = i * 3; P.tint[i3] = c.r; P.tint[i3 + 1] = c.g; P.tint[i3 + 2] = c.b; }
    K.worldAdd(P.pts); K.disp.push(P.dispose);
    const hist = [], loc = [new V3(-ep[0], ep[1], ep[2]), new V3(ep[0], ep[1], ep[2])], tmp = new V3();
    let now = 0;
    K.upd.push(dt => {
      now += dt;
      const L = head.localToWorld(tmp.copy(loc[0])).clone(), R = head.localToWorld(tmp.copy(loc[1])).clone();
      const last = hist[hist.length - 1];
      if (last && last.l.distanceToSquared(L) > 9) hist.length = 0;      // téléportation
      hist.push({ t: now, l: L, r: R });
      while (hist.length > 2 && now - hist[1].t > life) hist.shift();
      for (let e = 0; e < 2; e++) for (let k = 0; k < PER; k++) {
        const i = e * PER + k, tt = now - (k / (PER - 1)) * life;
        let j = hist.length - 1; while (j > 0 && hist[j - 1].t > tt) j--;
        const A = hist[Math.max(0, j - 1)], B = hist[j], span = B.t - A.t, f = span > 1e-5 ? BR.clamp((tt - A.t) / span, 0, 1) : 1;
        const pa = e ? A.r : A.l, pb = e ? B.r : B.l, i3 = i * 3;
        P.pos[i3] = pa.x + (pb.x - pa.x) * f; P.pos[i3 + 1] = pa.y + (pb.y - pa.y) * f; P.pos[i3 + 2] = pa.z + (pb.z - pa.z) * f;
        const kk = 1 - k / PER, ok = tt >= hist[0].t;
        P.alpha[i] = ok ? kk * kk * (0.55 + 0.45 * Math.min(1.3, K.P.value)) : 0;
        P.size[i] = size * (0.35 + 0.65 * kk);
      }
      const at = P.g.attributes; at.position.needsUpdate = at.aAlpha.needsUpdate = at.aSize.needsUpdate = at.aCol.needsUpdate = true;
    });
  }
  // empreintes (monde) : une tous les ~0,8 m, sous le pied qui se pose
  function prints(K, pk, c1, c2, size, life, normal) {
    const n = 22, g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); K.geos.push(g);
    const age = new Float32Array(n).fill(1), seed = new Float32Array(n).map(() => Math.random());
    const aAge = new THREE.InstancedBufferAttribute(age, 1), aSeed = new THREE.InstancedBufferAttribute(seed, 1);
    g.setAttribute('aAge', aAge); g.setAttribute('aSeed', aSeed);
    const m = K.own(new THREE.ShaderMaterial({ defines: { PK: pk }, uniforms: { uC1: { value: col(c1) }, uC2: { value: col(c2) } }, vertexShader: PRINT_VS, fragmentShader: PRINT_FS,
      transparent: true, depthWrite: false, blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    const mesh = new THREE.InstancedMesh(g, m, n); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.renderOrder = 1;
    const dum = new THREE.Object3D(); dum.scale.setScalar(0); dum.updateMatrix();
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, dum.matrix);
    K.worldAdd(mesh); K.disp.push(() => mesh.dispose && mesh.dispose());
    let next = 0;
    const feet = [K.bones['footl'], K.bones['footr']], tmp = new V3();
    K.upd.push(dt => {
      for (let i = 0; i < n; i++) if (age[i] < 1) age[i] = Math.min(1, age[i] + dt / life);
      aAge.needsUpdate = true;
      if (K.stride > 0.78 && K.world.visible) {
        K.stride = 0; K.side ^= 1;
        const f = feet[K.side]; if (f) f.getWorldPosition(tmp); else tmp.copy(K.wpos);
        const e = K.root.matrixWorld.elements, yaw = Math.atan2(e[8], e[10]);
        dum.position.set(tmp.x, K.wpos.y + 0.03, tmp.z); dum.rotation.set(0, yaw + rnd(-0.3, 0.3), 0); dum.scale.setScalar(size * rnd(0.85, 1.15)); dum.updateMatrix();
        mesh.setMatrixAt(next, dum.matrix); age[next] = 0; seed[next] = Math.random(); aSeed.needsUpdate = true;
        mesh.instanceMatrix.needsUpdate = true; next = (next + 1) % n;
      }
    });
  }
  // échos fantômes : copies figées de la pose (squelettes gelés), laissées derrière soi
  function afterimages(K, color, n, every, life) {
    const live = []; K.model.traverse(o => { if (o.isSkinnedMesh && o.visible && o.skeleton) live.push(o); });
    if (!live.length) return;
    const pool = []; let acc = 0, forced = 0;
    const make = () => {
      const mat = K.own(new THREE.MeshBasicMaterial({ color: col(color), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, skinning: true }));
      const grp = new THREE.Group(), meshes = live.map(src => {
        const sk = new THREE.Skeleton(src.skeleton.bones, src.skeleton.boneInverses); sk.update = function () {};
        const m = new THREE.SkinnedMesh(src.geometry, mat); m.bind(sk, src.bindMatrix); m.frustumCulled = false; m.renderOrder = 2; grp.add(m);
        return { m, sk, src };
      });
      K.worldAdd(grp); meshes.forEach(x => { x.m.onBeforeRender = grp.onBeforeRender; });
      const G = { grp, mat, meshes, t: 1 }; grp.visible = false; pool.push(G);
      K.disp.push(() => meshes.forEach(x => x.sk.dispose()));
      return G;
    };
    const spawn = () => {
      let G = pool.find(q => q.t >= 1); if (!G) G = pool.length < n ? make() : pool.reduce((a, b) => (a.t > b.t ? a : b));
      for (const x of G.meshes) {
        const src = x.src.skeleton.boneMatrices, dst = x.sk.boneMatrices, len = Math.min(src.length, dst.length, x.sk.bones.length * 16);
        for (let i = 0; i < len; i++) dst[i] = src[i];
        if (x.sk.boneTexture) x.sk.boneTexture.needsUpdate = true;
      }
      G.t = 0; G.grp.visible = true;
    };
    K.kicks.push(() => { forced = 3; });
    K.upd.push(dt => {
      if (K.world.visible) {
        acc += dt;
        const moving = K.speed > 2.2;
        if ((moving && acc > every) || (forced > 0 && acc > 0.06)) { acc = 0; if (forced > 0) forced--; spawn(); }
      }
      for (const G of pool) {
        if (G.t >= 1) continue;
        G.t = Math.min(1, G.t + dt / life); G.mat.opacity = (1 - G.t) * (1 - G.t) * 0.5; if (G.t >= 1) G.grp.visible = false;
      }
    });
  }
  // onde de choc au sol (attaques)
  function shock(K, color) {
    const g = new THREE.RingGeometry(0.8, 1, 56); g.rotateX(-Math.PI / 2); K.geos.push(g);
    const m = K.own(new THREE.MeshBasicMaterial({ color: col(color), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const mesh = K.fx(new THREE.Mesh(g, m)); mesh.position.y = 0.05; mesh.frustumCulled = false; K.local.add(mesh);
    let s = 1;
    K.kicks.push(() => { s = 0; });
    K.upd.push(dt => { if (s < 1) { s = Math.min(1, s + dt * 1.6); mesh.scale.setScalar(0.4 + s * 3.2); m.opacity = (1 - s) * 0.85; } else m.opacity = 0; });
  }
  // particules locales (suivent le personnage) ou d'éclat (attaque)
  function parts(K, n, o) { const P = PSys(n, Object.assign({ local: true }, o)); K.local.add(P.pts); K.disp.push(P.dispose); K.upd.push(dt => P.update(dt, K)); return P; }
  function burst(K, n, o) {
    const P = parts(K, n, Object.assign({ burst: true }, o));
    K.kicks.push(() => { for (let i = 0; i < n; i++) o.spawn(P, i, false); });
    return P;
  }
  const headLocal = (K, v) => { if (!K.head) return v.set(0, 1.6, 0); v.setFromMatrixPosition(K.head.matrixWorld); return K.root.worldToLocal(v); };
  function ring(P, i, r0, r1, y0, y1) { const a = Math.random() * TAU, r = rnd(r0, r1); return [Math.cos(a) * r, rnd(y0, y1), Math.sin(a) * r, a]; }
  // objets en orbite (InstancedMesh, repère du personnage)
  function swarm(K, geo, mat, n, place) {
    const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; K.fx(m); K.local.add(m);
    const dum = new THREE.Object3D();
    K.upd.push(dt => { for (let i = 0; i < n; i++) { place(i, dum, dt); dum.updateMatrix(); m.setMatrixAt(i, dum.matrix); } m.instanceMatrix.needsUpdate = true; });
    K.disp.push(() => m.dispose && m.dispose());
    return m;
  }

  /* ================= les 5 skins ================= */
  const SKINS = {
    /* ---- Roi-Liche : couronne de glace, givre qui s'étend, éclats en orbite, regard d'hiver ---- */
    lich(K) {
      hide(K, ['Skeleton_Mage_Hat']);
      body(K, 2, '#5fd8ff', '#ffffff');
      const ice = K.own(patchMat(new THREE.MeshStandardMaterial({ color: 0xcdf3ff, emissive: 0x2a9fe0, emissiveIntensity: 0.75, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.92 }), 2, K.U('#7fe8ff', '#ffffff')));
      accessories(K, 'lich', () => ice);
      decal(K, 1, '#58d2ff', '#e8fbff', 3.4);
      prints(K, 1, '#6fdcff', '#ffffff', 0.55, 4.5);
      eyeTrail(K, '#8ff6ff', 0.5, 0.16);
      shock(K, '#9fefff');
      const tmp = new V3();
      swarm(K, fxGeo('shard'), ice, 3, (i, d) => {
        const t = K.T.value, a = t * 0.9 + i * TAU / 3;
        headLocal(K, tmp);
        d.position.set(Math.cos(a) * 0.72, tmp.y + 0.3 + Math.sin(t * 1.7 + i * 2) * 0.12, Math.sin(a) * 0.72);
        d.rotation.set(0.3 * Math.sin(t + i), -a, 0.25); d.scale.setScalar(0.9 + 0.15 * Math.sin(t * 3 + i));
      });
      const c1 = col('#e9fbff'), c2 = col('#7fdcff');
      parts(K, 60, { shape: 'snow', power: true, spawn(P, i) { const [x, y, z] = ring(P, i, 0.25, 1.1, 0.3, 2.3); P.set(i, x, y, z, rnd(-0.1, 0.1), rnd(-0.35, -0.12), rnd(-0.1, 0.1), rnd(2, 3.5), rnd(0.06, 0.12), c1.clone().lerp(c2, Math.random() * 0.5), 0.9, rnd(-1.5, 1.5)); } });
      parts(K, 26, { shape: 'smoke', spawn(P, i) { const [x, y, z] = ring(P, i, 0.1, 0.8, 0.02, 0.2); P.set(i, x, y, z, x * 0.25, rnd(0.02, 0.1), z * 0.25, rnd(1.6, 2.6), rnd(0.35, 0.6), c2, 0.18); }, grow: 0.8 });
      burst(K, 50, { shape: 'snow', drag: 1.6, spawn(P, i) { const a = Math.random() * TAU, v = rnd(2.5, 5); P.set(i, 0, rnd(0.4, 1.6), 0, Math.cos(a) * v, rnd(0, 2), Math.sin(a) * v, rnd(0.5, 0.9), rnd(0.08, 0.16), c1, 1, rnd(-6, 6)); } });
    },

    /* ---- Titan de Magma : armure d'obsidienne fendue de lave qui bat, couronne de feu, rochers en lévitation ---- */
    magma(K) {
      hide(K, ['Barbarian_Hat']);
      const U = body(K, 1, '#ff3206', '#ffcf3a');
      const obs = K.own(patchMat(new THREE.MeshStandardMaterial({ color: 0x140b0b, roughness: 0.32, metalness: 0.25 }), 1, U));
      accessories(K, 'magma', () => obs);
      // couronne de feu
      if (K.head) {
        const g = new THREE.CylinderGeometry(0.36, 0.46, 0.75, 20, 1, true); g.translate(0, 0.375, 0); K.geos.push(g);
        const m = K.own(new THREE.ShaderMaterial({ uniforms: { uT: K.T, uK: K.P, uC1: { value: col('#ff3a08') }, uC2: { value: col('#ffd84a') } }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
          transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        const crown = K.fx(new THREE.Mesh(g, m)); crown.position.y = 0.78; crown.renderOrder = 2; crown.frustumCulled = false; crown.userData.skn = true; K.head.add(crown);
      }
      decal(K, 2, '#ff2a04', '#ffc23a', 3.2);
      prints(K, 2, '#ff2a04', '#ffe070', 0.6, 3.5);
      eyeTrail(K, '#ffa53a', 0.45, 0.15);
      shock(K, '#ff7a2a');
      // rochers arrachés au sol qui montent en tournant
      const R = 7, ph = Array.from({ length: R }, () => Math.random()), ang = Array.from({ length: R }, () => Math.random() * TAU), rad = Array.from({ length: R }, () => rnd(0.65, 1.15));
      swarm(K, fxGeo('rock'), obs, R, (i, d, dt) => {
        ph[i] += dt * (0.16 + 0.1 * K.P.value); if (ph[i] > 1) { ph[i] = 0; ang[i] = Math.random() * TAU; rad[i] = rnd(0.65, 1.15); }
        const p = ph[i], a = ang[i] + p * 1.2;
        d.position.set(Math.cos(a) * rad[i], 0.1 + p * 2.3, Math.sin(a) * rad[i]);
        d.rotation.set(p * 5 + i, p * 3, i); d.scale.setScalar(Math.sin(Math.min(1, p * 1.15) * Math.PI) * (0.8 + 0.3 * (i % 3)));
      });
      const y1 = col('#ffe070'), r1 = col('#ff3a08');
      parts(K, 90, { shape: 'glow', power: true, spawn(P, i) { const [x, y, z] = ring(P, i, 0.15, 0.7, 0.05, 1.2); P.set(i, x, y, z, rnd(-0.3, 0.3), rnd(0.8, 2.2), rnd(-0.3, 0.3), rnd(0.7, 1.6), rnd(0.04, 0.09), y1.clone().lerp(r1, Math.random()), 1); },
        step(P, i, dt) { P.pos[i * 3] += Math.sin(K.T.value * 7 + i) * dt * 0.3; } });
      burst(K, 60, { shape: 'spark', grav: -6, drag: 0.8, spawn(P, i) { const a = Math.random() * TAU, v = rnd(2, 5); P.set(i, 0, rnd(0.2, 1.4), 0, Math.cos(a) * v, rnd(2, 5), Math.sin(a) * v, rnd(0.6, 1.1), rnd(0.07, 0.14), y1.clone().lerp(r1, Math.random()), 1); } });
    },

    /* ---- Valkyrie Céleste : ailes de lumière, halo de runes, plumes d'or ---- */
    valk(K) {
      hide(K, ['Rogue_Cape']);
      body(K, 3, '#ffcf5a', '#ffffff');
      const gold = K.own(patchMat(new THREE.MeshStandardMaterial({ color: 0xffd36a, roughness: 0.28, metalness: 0.35, emissive: 0xff9a1a, emissiveIntensity: 0.3 }), 3, K.U('#ffd36a', '#ffffff')));
      const wingMat = K.own(new THREE.ShaderMaterial({ uniforms: { uT: K.T, uK: K.P, uF: K.F, uC1: { value: col('#ffb43a') }, uC2: { value: col('#fff6d8') } }, vertexShader: FLAME_VS, fragmentShader: WING_FS,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      const acc = accessories(K, 'valk', part => (part === 'wing' ? wingMat : gold));
      // ailes : pivot à l'épaule, la seconde en miroir
      const wings = [];
      (acc.wing || []).forEach(w => {
        const chest = w.parent, piv0 = new V3(0.14, 1.12, -0.36).sub(new V3(0, 0.973, 0));
        [1, -1].forEach(s => {
          const piv = new THREE.Group(); piv.position.set(piv0.x * s, piv0.y, piv0.z); piv.scale.x = s;
          const o = s > 0 ? w : w.clone(); chest.remove(w);
          o.position.set(-piv0.x, -0.973 - piv0.y, -piv0.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
          piv.add(o); chest.add(piv); K.fx(o); o.renderOrder = 2;
          wings.push({ piv, s });
        });
      });
      let flapK = 0;
      K.kicks.push(() => { flapK = 1; });
      K.upd.push(dt => {
        flapK = Math.max(0, flapK - dt * 1.2);
        const t = K.T.value, run = Math.min(1, K.drag), air = K.ctx.air ? 1 : 0;
        const amp = 0.1 + 0.08 * run + 0.35 * air + 0.5 * flapK, f = 1.3 + 2.2 * run + 2.5 * air + 3 * flapK;
        const flap = Math.sin(t * f * TAU * 0.5) * amp;
        wings.forEach(({ piv, s }) => { piv.rotation.set(0, (0.12 + 0.5 * run - 0.2 * flapK) * s, (flap + 0.05) * s); });
      });
      halo(K, 1, '#ffc23a', '#fff3c8', 1.7, 0.55, -0.62);
      decal(K, 3, '#ffc23a', '#fff6d8', 3.4);
      prints(K, 3, '#ffcf5a', '#ffffff', 0.5, 3.5);
      eyeTrail(K, '#ffe9a0', 0.45, 0.14);
      shock(K, '#ffd75a');
      const g1 = col('#fff3c8'), g2 = col('#ffb43a'), tmp = new V3();
      parts(K, 26, { shape: 'feather', drag: 0.6, spawn(P, i) { headLocal(K, tmp); const s = Math.random() < 0.5 ? -1 : 1; P.set(i, s * rnd(0.3, 1.1), tmp.y + rnd(-0.2, 0.6), rnd(-0.5, -0.1), rnd(-0.1, 0.1), rnd(-0.35, -0.15), rnd(-0.1, 0.1), rnd(2.5, 4), rnd(0.1, 0.16), g1.clone().lerp(g2, Math.random() * 0.7), 0.9, rnd(-2, 2)); },
        step(P, i, dt) { P.pos[i * 3] += Math.sin(K.T.value * 2 + i) * dt * 0.25; } });
      parts(K, 50, { shape: 'glow', power: true, spawn(P, i) { const [x, y, z] = ring(P, i, 0.2, 0.8, 0.05, 1.6); P.set(i, x, y, z, 0, rnd(0.3, 0.8), 0, rnd(1.4, 2.6), rnd(0.04, 0.08), g1, 0.9); } });
      burst(K, 40, { shape: 'feather', drag: 1.4, spawn(P, i) { const a = Math.random() * TAU, v = rnd(1.5, 4); P.set(i, 0, rnd(0.8, 1.8), 0, Math.cos(a) * v, rnd(0.5, 2.5), Math.sin(a) * v, rnd(0.8, 1.4), rnd(0.12, 0.2), g1.clone().lerp(g2, Math.random()), 1, rnd(-5, 5)); } });
    },

    /* ---- Spectre du Néant : corps-galaxie, cape d'ombre, pas de visage, échos fantômes ---- */
    void(K) {
      hide(K, ['Rogue_Cape']);
      body(K, 4, '#a45cff', '#2a0a6a');
      const capeMat = K.own(new THREE.ShaderMaterial({ uniforms: { uT: K.T, uK: K.P, uDrag: { value: 0 }, uC1: { value: col('#a45cff') }, uC2: { value: col('#3a1280') } }, vertexShader: CAPE_VS, fragmentShader: CAPE_FS,
        transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const veilMat = K.own(new THREE.ShaderMaterial({ uniforms: { uT: K.T, uK: K.P, uC1: { value: col('#9b4dff') } }, vertexShader: VEIL_VS, fragmentShader: VEIL_FS }));
      const acc = accessories(K, 'void', part => (part === 'cape' ? capeMat : veilMat));
      (acc.cape || []).forEach(o => { o.renderOrder = 1; K.fx(o); });
      K.upd.push(() => { capeMat.uniforms.uDrag.value = Math.min(1.3, K.drag * 1.1 + (K.ctx.air ? 0.4 : 0)); });
      // couronne brisée : éclats noirs en anneau incliné au-dessus de la capuche
      const shardMat = K.own(patchMat(new THREE.MeshStandardMaterial({ color: 0x050008, roughness: 0.3, metalness: 0.2 }), 4, K.U('#b47cff', '#2a0a6a')));
      const tmp = new V3();
      swarm(K, fxGeo('shard'), shardMat, 7, (i, d) => {
        const t = K.T.value, a = t * 0.45 + i * TAU / 7;
        headLocal(K, tmp);
        d.position.set(Math.cos(a) * 0.48, tmp.y + 0.95 + Math.sin(a) * 0.08 + Math.sin(t * 2 + i) * 0.03, Math.sin(a) * 0.48 - 0.06);
        d.rotation.set(Math.sin(a) * 0.25, -a, Math.cos(a) * 0.25 - 0.1); d.scale.set(0.55, 0.7 + 0.25 * ((i * 7) % 3) / 2, 0.55);
      });
      decal(K, 4, '#b06bff', '#4a17a8', 3.3, true);
      prints(K, 4, '#9b4dff', '#000000', 0.6, 4, true);
      eyeTrail(K, '#c58bff', 0.7, 0.17);
      afterimages(K, '#7a3cff', 4, 0.1, 0.55);
      shock(K, '#a45cff');
      const v1 = col('#c58bff'), dk = col('#07000f');
      parts(K, 40, { shape: 'smoke', normal: true, grow: 1.2, spawn(P, i) { const [x, y, z] = ring(P, i, 0.1, 0.6, 0.0, 0.5); P.set(i, x, y, z, x * 0.3, rnd(0.3, 0.8), z * 0.3, rnd(1.2, 2.2), rnd(0.25, 0.45), dk, 0.55); } });
      parts(K, 46, { shape: 'spark', power: true, spawn(P, i) { const [x, y, z] = ring(P, i, 0.2, 0.75, 0.0, 1.8); P.set(i, x, y, z, rnd(-0.1, 0.1), rnd(0.3, 0.9), rnd(-0.1, 0.1), rnd(0.9, 1.8), rnd(0.05, 0.09), v1, 0.9, rnd(-2, 2)); } });
      burst(K, 50, { shape: 'smoke', normal: true, drag: 2, grow: 1.5, spawn(P, i) { const a = Math.random() * TAU, v = rnd(2, 4.5); P.set(i, 0, rnd(0.2, 1.4), 0, Math.cos(a) * v, rnd(0, 1), Math.sin(a) * v, rnd(0.6, 1), rnd(0.3, 0.5), dk, 0.7); } });
    },

    /* ---- Éclipse, le Dernier Souverain : soleil noir, six lames flottantes, foudre noire, terre qui se fend ---- */
    eclipse(K) {
      const U = body(K, 5, '#ff2a14', '#ffc040');
      const dark = K.own(patchMat(new THREE.MeshStandardMaterial({ color: 0x0b0709, roughness: 0.25, metalness: 0.45 }), 5, U));
      const gold = K.own(patchMat(new THREE.MeshStandardMaterial({ color: 0xffc24a, roughness: 0.25, metalness: 0.4, emissive: 0xff7a10, emissiveIntensity: 0.35 }), 3, K.U('#ff9a2a', '#fff0c0')));
      accessories(K, 'eclipse', part => (part === 'crown' || part === 'trim' ? gold : dark));
      halo(K, 2, '#ff2a14', '#ffd27a', 2.3, 0.75, -0.75, true);
      decal(K, 5, '#ff2a14', '#ffc040', 3.8);
      prints(K, 5, '#ff3a1a', '#ffc040', 0.55, 3.5);
      eyeTrail(K, '#ff3a2a', 0.6, 0.17);
      afterimages(K, '#ff2a14', 3, 0.13, 0.5);
      shock(K, '#ff3a1a');
      // six lames en éventail dans le dos ; elles tournoient autour de lui à l'attaque
      const blade = K.own(patchMat(new THREE.MeshStandardMaterial({ color: 0x120a0c, roughness: 0.2, metalness: 0.6 }), 5, U));
      let spin = 0;
      K.kicks.push(() => { spin = 1; });
      K.upd.push(dt => { spin = Math.max(0, spin - dt * 0.9); });
      swarm(K, fxGeo('blade'), blade, 6, (i, d) => {
        const t = K.T.value, k = (i - 2.5) / 2.5, e = spin * spin * (3 - 2 * spin);
        const fan = Math.PI + k * 1.25, orbit = t * 2.4 + i * TAU / 6;
        const a = fan + (orbit - fan) * e, r = 0.62 + 0.35 * e;
        d.position.set(Math.sin(a) * r, 1.25 + Math.abs(k) * -0.25 + Math.sin(t * 1.6 + i) * 0.06 + 0.2 * e, Math.cos(a) * r);
        d.rotation.set(0, a, -k * 0.55 * (1 - e) + e * Math.PI / 2);
        d.scale.setScalar(0.9);
      });
      // rochers en lévitation
      const R = 6, ph = Array.from({ length: R }, () => Math.random()), ang = Array.from({ length: R }, () => Math.random() * TAU);
      swarm(K, fxGeo('rock'), dark, R, (i, d, dt) => {
        ph[i] += dt * 0.12; if (ph[i] > 1) { ph[i] = 0; ang[i] = Math.random() * TAU; }
        const p = ph[i], a = ang[i] + p;
        d.position.set(Math.cos(a) * 1.25, 0.05 + p * 2.6, Math.sin(a) * 1.25);
        d.rotation.set(p * 4 + i, p * 2, 0); d.scale.setScalar(Math.sin(Math.min(1, p * 1.1) * Math.PI) * 0.9);
      });
      const r1 = col('#ff3a1a'), y1 = col('#ffc040'), ash = col('#050203');
      parts(K, 70, { shape: 'spark', power: true, spawn(P, i) { const [x, y, z] = ring(P, i, 0.2, 0.9, 0.0, 1.0); P.set(i, x, y, z, rnd(-0.15, 0.15), rnd(0.8, 1.8), rnd(-0.15, 0.15), rnd(0.8, 1.6), rnd(0.05, 0.1), r1.clone().lerp(y1, Math.random() * 0.4), 1, rnd(-3, 3)); } });
      parts(K, 34, { shape: 'feather', normal: true, spawn(P, i) { const [x, y, z] = ring(P, i, 0.3, 1.2, 0.0, 0.8); P.set(i, x, y, z, rnd(-0.2, 0.2), rnd(0.4, 1.0), rnd(-0.2, 0.2), rnd(1.6, 2.8), rnd(0.07, 0.12), ash, 0.85, rnd(-4, 4)); } });
      burst(K, 70, { shape: 'spark', grav: -4, drag: 0.9, spawn(P, i) { const a = Math.random() * TAU, v = rnd(3, 6.5); P.set(i, 0, rnd(0.3, 1.6), 0, Math.cos(a) * v, rnd(1, 4), Math.sin(a) * v, rnd(0.5, 1), rnd(0.08, 0.16), r1.clone().lerp(y1, Math.random()), 1, rnd(-6, 6)); } });
    },
  };
  SF.SKINS = SKINS;
})();

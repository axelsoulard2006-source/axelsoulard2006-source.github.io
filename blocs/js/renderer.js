/* ===== renderer.js : scène Three.js, caméra, ciel, astres, nuages, brouillard, jour/nuit, météo et matériaux des blocs
   Les matériaux des blocs sont des MeshBasicMaterial étendus (onBeforeCompile) :
   - répétition de la tuile de l'atlas sur les grands rectangles fusionnés (attribut « tile » + fract)
   - lumière voxel (attribut « lit » : ciel 0..1, blocs 0..1, code d'animation) : courbe douce, lueur chaude des blocs,
     lit.x > 1.5 = bloc lumineux ; la lumière du ciel suit le jour/nuit (uDay) et sa couleur (uSkyCol)
   - animations : feuillage et plantes au vent (rafales, force uWind), eau qui ondule, défile et scintille,
     vacillement des lumières (torches, lave, lumicristal)
   Deux ciels :
   - « léger » (shaders désactivés) : dôme à dégradé zénith / horizon, étoiles, soleil et lune en sprites, nuages-plaques ;
   - « physique » (mode shaders, VX.R.setAtmo({ phys: true })) : diffusion de Rayleigh + Mie + ozone calculée dans une
     petite table (LUT 128 × 64, rendue à chaque image selon l'angle du soleil), soleil éblouissant à assombrissement
     centre-bord, lune détaillée (cratères procéduraux) à halo argenté, cirrus hauts qui dérivent. Le même modèle est
     évalué en JS pour la couleur du brouillard, de la lumière du ciel sur les blocs et du soleil direct (VX.R.atmo).
   Météo : VX.G.weather = { rain, storm, flash } (facultatif) assombrit et grise le ciel, rapproche le brouillard,
   et les éclairs (flash) illuminent la scène, dans les deux modes.
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
  const isGL2 = !!gl.capabilities.isWebGL2;
  // demi-flottants rendables et filtrables (sinon 8 bits : un peu de bandes dans les dégradés de nuit)
  const halfOK = isGL2 ? !!(gl.extensions.get('EXT_color_buffer_float') || gl.extensions.get('EXT_color_buffer_half_float'))
    : !!(gl.extensions.get('OES_texture_half_float') && gl.extensions.get('OES_texture_half_float_linear') && gl.extensions.get('EXT_color_buffer_half_float'));

  /* ---------- texture de bruit 256 × 256 (partagée : ciel, lune, nuages volumétriques de shaders.js)
     r : bruit de valeur ; g : r décalé de (37, 17) → bruit 3D en une lecture (couche z = décalage (37, 17)·z)
     b : 2e bruit indépendant (bruit 2D : couverture des nuages, cirrus) ; a : b décalé de (37, 17) ---------- */
  const noiseTex = (() => {
    const N = 256, d = new Uint8Array(N * N * 4), r = VX.rng(9001), A = new Uint8Array(N * N), Bn = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) { A[i] = (r() * 256) | 0; Bn[i] = (r() * 256) | 0; }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = x + y * N, s = ((x + 37) & 255) + ((y + 17) & 255) * N;
      d[i * 4] = A[i]; d[i * 4 + 1] = A[s]; d[i * 4 + 2] = Bn[i]; d[i * 4 + 3] = Bn[s];
    }
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  })();

  /* =====================================================================
     MODÈLE D'ATMOSPHÈRE (diffusion simple Rayleigh + Mie + absorption de l'ozone)
     Mêmes constantes en GLSL (table du ciel) et en JS (brouillard, lumière des blocs, couleur du soleil).
     Observateur à 300 m d'altitude, planète de 6360 km, atmosphère de 60 km.
     ===================================================================== */
  const AT = { RE: 6360e3, RA: 6420e3, HR: 7994, HM: 1200, BR: [5.8e-6, 13.5e-6, 33.1e-6], BM: 12e-6, BO: [0.65e-6, 1.881e-6, 0.085e-6], G: 0.76, I: 22, EXPO: 0.9, N: 16, M: 6 };
  const ATMO_GLSL = `
#define AT_PI 3.14159265
const float AT_RE = 6360e3; const float AT_RA = 6420e3; const float AT_HR = 7994.0; const float AT_HM = 1200.0;
const vec3 AT_BR = vec3(5.8e-6, 13.5e-6, 33.1e-6); const float AT_BM = ${AT.BM.toExponential()}; const vec3 AT_BO = vec3(0.65e-6, 1.881e-6, 0.085e-6);
// intersection rayon / sphère centrée à l'origine : (t entrée, t sortie), (-1, -1) si manquée
vec2 atSph(vec3 o, vec3 d, float r) { float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c; if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b - h, -b + h); }
// densités relatives : Rayleigh, Mie, ozone (couche en tente centrée sur 25 km)
vec3 atDens(float h) { return vec3(exp(-h / AT_HR), exp(-h / AT_HM), max(0.0, 1.0 - abs(h - 25000.0) / 15000.0)); }
// luminance du ciel dans la direction d, soleil dans la direction s (intensité I)
vec3 atScatter(vec3 d, vec3 s, float I) {
  vec3 o = vec3(0.0, AT_RE + 300.0, 0.0);
  float tMax = atSph(o, d, AT_RA).y;
  vec2 g = atSph(o, d, AT_RE); if (g.x > 0.0) tMax = g.x;
  float mu = dot(d, s), mu2 = mu * mu, gg = 0.76 * 0.76;
  float pR = 3.0 / (16.0 * AT_PI) * (1.0 + mu2);
  float pM = 3.0 / (8.0 * AT_PI) * ((1.0 - gg) * (1.0 + mu2)) / ((2.0 + gg) * pow(1.0 + gg - 2.0 * 0.76 * mu, 1.5));
  vec3 od = vec3(0.0), sR = vec3(0.0), sM = vec3(0.0); float tPrev = 0.0;
  for (int i = 0; i < AT_N; i++) {
    float f = (float(i) + 1.0) / float(AT_N), t = tMax * f * f, dt = t - tPrev, tm = (t + tPrev) * 0.5; tPrev = t;   // pas quadratiques : plus fins près de l'observateur
    vec3 p = o + d * tm; vec3 dn = atDens(length(p) - AT_RE) * dt; od += dn;
    if (atSph(p, s, AT_RE).x > 0.0) continue;                                // dans l'ombre de la planète
    float sl = atSph(p, s, AT_RA).y / float(AT_M); vec3 odl = vec3(0.0);
    for (int j = 0; j < AT_M; j++) { vec3 q = p + s * (sl * (float(j) + 0.5)); odl += atDens(length(q) - AT_RE) * sl; }
    vec3 a = exp(-(AT_BR * (od.x + odl.x) + AT_BM * 1.1 * (od.y + odl.y) + AT_BO * (od.z + odl.z)));
    sR += a * dn.x; sM += a * dn.y;
  }
  return I * (sR * AT_BR * pR + sM * AT_BM * pM);
}
`;
  // --- version JS (mêmes formules) ---
  function atSph(ox, oy, oz, dx, dy, dz, r) { const b = ox * dx + oy * dy + oz * dz, c = ox * ox + oy * oy + oz * oz - r * r; let h = b * b - c; if (h < 0) return null; h = Math.sqrt(h); return [-b - h, -b + h]; }
  function atDensJS(h, out) { out[0] = Math.exp(-h / AT.HR); out[1] = Math.exp(-h / AT.HM); out[2] = Math.max(0, 1 - Math.abs(h - 25000) / 15000); return out; }
  const _dn = [0, 0, 0], _dl = [0, 0, 0];
  function atScatterJS(dx, dy, dz, sx, sy, sz, I, out) {
    const oy = AT.RE + 300; let tMax = atSph(0, oy, 0, dx, dy, dz, AT.RA)[1];
    const g = atSph(0, oy, 0, dx, dy, dz, AT.RE); if (g && g[0] > 0) tMax = g[0];
    const mu = dx * sx + dy * sy + dz * sz, mu2 = mu * mu, gg = AT.G * AT.G;
    const pR = 3 / (16 * Math.PI) * (1 + mu2), pM = 3 / (8 * Math.PI) * ((1 - gg) * (1 + mu2)) / ((2 + gg) * Math.pow(1 + gg - 2 * AT.G * mu, 1.5));
    let odR = 0, odM = 0, odO = 0, sR0 = 0, sR1 = 0, sR2 = 0, sM0 = 0, sM1 = 0, sM2 = 0, tPrev = 0;
    for (let i = 0; i < AT.N; i++) {
      const f = (i + 1) / AT.N, t = tMax * f * f, dt = t - tPrev, tm = (t + tPrev) * 0.5; tPrev = t;
      const px = dx * tm, py = oy + dy * tm, pz = dz * tm;
      atDensJS(Math.hypot(px, py, pz) - AT.RE, _dn); odR += _dn[0] * dt; odM += _dn[1] * dt; odO += _dn[2] * dt;
      const sh = atSph(px, py, pz, sx, sy, sz, AT.RE); if (sh && sh[0] > 0) continue;
      const sl = atSph(px, py, pz, sx, sy, sz, AT.RA)[1] / AT.M; let lR = 0, lM = 0, lO = 0;
      for (let j = 0; j < AT.M; j++) { const k = sl * (j + 0.5); atDensJS(Math.hypot(px + sx * k, py + sy * k, pz + sz * k) - AT.RE, _dl); lR += _dl[0] * sl; lM += _dl[1] * sl; lO += _dl[2] * sl; }
      const tR = odR + lR, tM = (odM + lM) * AT.BM * 1.1, tO = odO + lO;
      const a0 = Math.exp(-(AT.BR[0] * tR + tM + AT.BO[0] * tO)), a1 = Math.exp(-(AT.BR[1] * tR + tM + AT.BO[1] * tO)), a2 = Math.exp(-(AT.BR[2] * tR + tM + AT.BO[2] * tO));
      const wr = _dn[0] * dt, wm = _dn[1] * dt;
      sR0 += a0 * wr; sR1 += a1 * wr; sR2 += a2 * wr; sM0 += a0 * wm; sM1 += a1 * wm; sM2 += a2 * wm;
    }
    out[0] = I * (sR0 * AT.BR[0] * pR + sM0 * AT.BM * pM); out[1] = I * (sR1 * AT.BR[1] * pR + sM1 * AT.BM * pM); out[2] = I * (sR2 * AT.BR[2] * pR + sM2 * AT.BM * pM);
    return out;
  }
  // transmittance de l'observateur vers le soleil (couleur de la lumière directe : blanche à midi, orange-rouge au coucher)
  function atTransJS(sx, sy, sz, out) {
    const oy = AT.RE + 300, g = atSph(0, oy, 0, sx, sy, sz, AT.RE);
    const L = atSph(0, oy, 0, sx, sy, sz, AT.RA)[1], n = 24, sl = L / n; let R = 0, M = 0, O = 0;
    for (let j = 0; j < n; j++) { const k = sl * (j + 0.5); atDensJS(Math.hypot(sx * k, oy + sy * k, sz * k) - AT.RE, _dl); R += _dl[0] * sl; M += _dl[1] * sl; O += _dl[2] * sl; }
    const blocked = g && g[0] > 0 ? 1 : 0;   // soleil sous l'horizon : on garde la teinte du dernier rayon rasant (l'intensité est gérée à part)
    for (let c = 0; c < 3; c++) out[c] = Math.exp(-(AT.BR[c] * R + AT.BM * 1.1 * M + AT.BO[c] * O));
    out[3] = blocked; return out;
  }
  // finition commune (GLSL et JS) : exposition douce + gamma, ciel nocturne bleu nuit, pluie qui grise, éclair
  const NIGHT_Z = [0.010, 0.018, 0.05], NIGHT_H = [0.045, 0.07, 0.14];
  const FINISH_GLSL = `
uniform vec3 uNightZ; uniform vec3 uNightH; uniform float uSunY; uniform float uRain; uniform float uStorm; uniform float uFlash;
vec3 atFinish(vec3 L, vec3 d) {
  vec3 c = pow(1.0 - exp(-L * ${AT.EXPO.toFixed(3)}), vec3(1.0 / 2.2));
  c = max(mix(vec3(dot(c, vec3(0.3, 0.55, 0.15))), c, 1.18), 0.0);   // un peu plus de couleur (ciel « cinéma »)
  float nk = 1.0 - smoothstep(-0.3, 0.04, uSunY);
  c += mix(uNightH, uNightZ, sqrt(max(d.y, 0.0))) * nk;
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  c = mix(c, vec3(l) * vec3(0.9, 0.95, 1.0) * (1.0 - 0.45 * uStorm), uRain * 0.95);
  c *= 1.0 - 0.35 * uRain;
  c += vec3(0.5, 0.55, 0.72) * uFlash * (0.55 + 0.45 * max(d.y, 0.0));
  return c;
}
`;
  const smoothJ = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  function atFinishJS(L, d, sunY, W, out) {
    for (let k = 0; k < 3; k++) out[k] = Math.pow(1 - Math.exp(-L[k] * AT.EXPO), 1 / 2.2);
    const l0 = out[0] * 0.3 + out[1] * 0.55 + out[2] * 0.15; for (let k = 0; k < 3; k++) out[k] = Math.max(0, l0 + (out[k] - l0) * 1.18);
    const nk = 1 - smoothJ(-0.3, 0.04, sunY), dy = Math.sqrt(Math.max(d[1], 0));
    for (let k = 0; k < 3; k++) out[k] += (NIGHT_H[k] + (NIGHT_Z[k] - NIGHT_H[k]) * dy) * nk;
    const l = out[0] * 0.3 + out[1] * 0.55 + out[2] * 0.15, gs = [0.9, 0.95, 1.0];
    for (let k = 0; k < 3; k++) { out[k] += (l * gs[k] * (1 - 0.45 * W.storm) - out[k]) * W.rain * 0.95; out[k] *= 1 - 0.35 * W.rain; out[k] += [0.5, 0.55, 0.72][k] * W.flash * (0.55 + 0.45 * Math.max(d[1], 0)); }
    return out;
  }
  // direction ↔ coordonnées de la table du ciel (latitude en racine : plus de résolution près de l'horizon)
  const SKYUV_GLSL = `
vec2 skyUV(vec3 d) { float lat = asin(clamp(d.y, -1.0, 1.0)); return vec2(atan(d.z, d.x + 1e-6) / 6.2831853 + 0.5, 0.5 + 0.5 * sign(lat) * sqrt(abs(lat) / 1.5707963)); }
`;

  /* ---------- passe « table du ciel » (LUT) : chaque texel = une direction ---------- */
  const QUAD_V = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const lutScene = new THREE.Scene(), lutCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const LU = {
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunY: { value: 1 }, uRain: { value: 0 }, uStorm: { value: 0 }, uFlash: { value: 0 },
    uNightZ: { value: new THREE.Vector3().fromArray(NIGHT_Z) }, uNightH: { value: new THREE.Vector3().fromArray(NIGHT_H) },
  };
  const lutMat = new THREE.ShaderMaterial({
    uniforms: LU, depthTest: false, depthWrite: false, defines: { AT_N: AT.N, AT_M: AT.M },
    vertexShader: QUAD_V,
    fragmentShader: ATMO_GLSL + FINISH_GLSL + `
uniform vec3 uSun; varying vec2 vUv;
void main() {
  float az = (vUv.x - 0.5) * 6.2831853, t = vUv.y * 2.0 - 1.0, lat = sign(t) * t * t * 1.5707963;
  vec3 d = vec3(cos(lat) * cos(az), sin(lat), cos(lat) * sin(az));
  vec3 dd = d; dd.y = max(d.y, 0.0) + 0.3 * max(-d.y, 0.0) + 0.0015; dd = normalize(dd);   // sous l'horizon : brume bleutée (reflet atténué du bas du ciel)
  vec3 c = atFinish(atScatter(dd, uSun, ${AT.I.toFixed(1)}), dd);
  c *= mix(1.0, 0.62, smoothstep(0.0, -0.4, d.y));
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const lutMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lutMat); lutMesh.frustumCulled = false; lutScene.add(lutMesh);
  let lutRT = null;
  function ensureLUT() {
    if (lutRT) return lutRT;
    lutRT = new THREE.WebGLRenderTarget(128, 64, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: halfOK ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false });
    lutRT.texture.generateMipmaps = false; lutRT.texture.wrapS = THREE.RepeatWrapping; lutRT.texture.wrapT = THREE.ClampToEdgeWrapping;
    return lutRT;
  }

  /* ---------- dôme du ciel « léger » (dégradé + halo du soleil) : suit la caméra, dessiné en premier ---------- */
  const SU = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uFogC: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uGlowC: { value: new THREE.Color() }, uGlow: { value: 0 }, uTwi: { value: 0 },
  };
  const domeBasic = new THREE.ShaderMaterial({
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
  });

  /* ---------- dôme du ciel « physique » : table du ciel + disque solaire + halo de la lune + cirrus ---------- */
  const PU = {
    uLUT: { value: null }, uNoise: { value: noiseTex }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunC: { value: new THREE.Vector3(1, 1, 1) }, uSunVis: { value: 1 }, uMoonGlow: { value: new THREE.Vector3() },
    uCirrus: { value: 0.5 }, uCirLit: { value: new THREE.Vector3(1, 1, 1) }, uCirAmb: { value: new THREE.Vector3(0.6, 0.7, 0.8) },
    uWind: { value: new THREE.Vector2() }, uTime: { value: 0 },
  };
  const domePhys = new THREE.ShaderMaterial({
    uniforms: PU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKYUV_GLSL + `
uniform sampler2D uLUT; uniform sampler2D uNoise; uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uSunC; uniform float uSunVis; uniform vec3 uMoonGlow;
uniform float uCirrus; uniform vec3 uCirLit; uniform vec3 uCirAmb; uniform vec2 uWind; uniform float uTime;
varying vec3 vDir;
// bruit de valeur lissé en une lecture (interpolation C1 grâce au filtrage linéaire entre centres de texels)
float n2(vec2 p) { p *= 256.0; vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return texture2D(uNoise, (i + f + 0.5) / 256.0).b; }
void main() {
  vec3 d = normalize(vDir);
  vec3 c = texture2D(uLUT, skyUV(d)).rgb;
  // cirrus : voile fibreux très haut (projection sur un plan), étiré dans le sens du vent
  if (d.y > 0.0 && uCirrus > 0.01) {
    vec2 p = d.xz / (d.y + 0.12) * 0.022 + uWind * 0.000015;
    vec2 q = vec2(p.x * 0.55 + p.y * 0.2, p.y * 1.6 - p.x * 0.3);
    float n = n2(q * 0.5) * 0.5 + n2(q * 1.13 + 0.013) * 0.32 + n2(q * 2.3 + 0.037) * 0.18;
    float a = smoothstep(1.0 - uCirrus * 0.7, 1.25 - uCirrus * 0.6, n) * smoothstep(0.0, 0.25, d.y) * 0.4;
    float fw = pow(max(dot(d, uSunDir), 0.0), 6.0);   // diffusion vers l'avant : cirrus éclatants près du soleil
    c = mix(c, uCirAmb + uCirLit * (0.55 + 1.2 * fw), a);
  }
  // soleil : disque éblouissant (assombrissement centre-bord) + couronne
  float r = sqrt(max(0.0, 2.0 - 2.0 * dot(d, uSunDir)));
  float x = clamp(r / 0.03, 0.0, 1.0);
  float disc = (1.0 - smoothstep(0.9, 1.0, x)) * (1.0 - 0.6 * (1.0 - sqrt(1.0 - x * x)));
  c += uSunC * uSunVis * (disc * 16.0 + exp(-r * 55.0) * 1.1 + exp(-r * 13.0) * 0.2);
  // halo argenté de la lune
  float rm = sqrt(max(0.0, 2.0 - 2.0 * dot(d, uMoonDir)));
  c += uMoonGlow * (exp(-rm * 30.0) * 0.55 + exp(-rm * 8.0) * 0.14);
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;   // tramage : pas de bandes
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(440, 32, 16), domeBasic);
  dome.renderOrder = -100; dome.frustumCulled = false; scene.add(dome);

  /* ---------- étoiles (tournent avec la nuit) : additives, dessinées avant la lune et les nuages qui les cachent ---------- */
  const skyRig = new THREE.Group(); scene.add(skyRig);
  const stars = (() => {
    const g = new THREE.BufferGeometry(), p = [], c = [], r = VX.rng(5);
    for (let i = 0; i < 900; i++) {
      const u = r() * 2 - 1, a = r() * 6.283, s = Math.sqrt(1 - u * u), d = 400, b = 0.45 + r() * r() * 0.55, warm = r();
      p.push(Math.cos(a) * s * d, u * d, Math.sin(a) * s * d); c.push(b * (warm > 0.8 ? 1 : 0.85), b * 0.9, b * (warm > 0.8 ? 0.8 : 1));
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, fog: false, transparent: false, blending: THREE.AdditiveBlending, vertexColors: true, depthWrite: false }));
    m.renderOrder = -99; m.frustumCulled = false; return m;
  })();
  skyRig.add(stars);

  /* ---------- soleil et lune « légers » : disques ronds à halo doux (textures dessinées par le code) ---------- */
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

  /* ---------- lune « haute définition » (ciel physique) : disque procédural, cratères en relief, mers sombres ---------- */
  const MU = { uNoise: { value: noiseTex }, uAlpha: { value: 1 }, uBright: { value: 1.2 } };
  const moonHD = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: MU, fog: false, depthWrite: false, depthTest: true, transparent: false,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
uniform sampler2D uNoise; uniform float uAlpha; uniform float uBright; varying vec2 vUv;
float mh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// cratères : une cuvette par cellule (au hasard), avec un rebord en relief
float craters(vec2 q, float sc, float seed) {
  vec2 g = q * sc, c0 = floor(g); float h = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = c0 + vec2(float(i), float(j));
    float r3 = mh(c + seed + 41.7); if (r3 < 0.3) continue;
    vec2 ctr = c + vec2(mh(c + seed), mh(c + seed + 17.3));
    float d = length(g - ctr) / (0.16 + 0.3 * r3 * r3);
    if (d < 1.0) h += (d * d - 1.0) * 0.5;
    h += exp(-(d - 1.0) * (d - 1.0) * 30.0) * 0.25;
  }
  return h;
}
// bruit de valeur lissé (p en cellules du réseau)
float sn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return texture2D(uNoise, (i + f + 0.5) / 256.0).b; }
float hgt(vec2 q) { return craters(q, 2.4, 1.0) * 0.6 + craters(q, 5.2, 5.0) * 0.3; }
void main() {
  vec2 q = vUv * 2.0 - 1.0; float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  vec3 n = vec3(q, sqrt(1.0 - r2));
  vec2 sp = q / (0.6 + 0.4 * n.z);                 // coordonnées « collées » à la sphère (cratères aplatis au bord)
  float e = 0.012, h0 = hgt(sp), hx = hgt(sp + vec2(e, 0.0)), hy = hgt(sp + vec2(0.0, e));
  vec3 nb = normalize(n + vec3(-(hx - h0), -(hy - h0), 0.0) / e * 0.045);
  float m = sn(sp * 1.4 + 3.1) * 0.6 + sn(sp * 3.2 + 7.7) * 0.28 + sn(sp * 7.0 + 1.3) * 0.12;
  float mare = smoothstep(0.5, 0.64, m);         // mers sombres
  vec3 alb = mix(vec3(0.9, 0.91, 0.94), vec3(0.5, 0.53, 0.6), mare) * (0.93 + 0.07 * sn(sp * 14.0 + 5.0));
  vec3 L = normalize(vec3(-0.3, 0.22, 1.0));
  vec3 c = alb * (0.16 + 0.95 * max(dot(nb, L), 0.0)) * (0.78 + 0.22 * n.z) * vec3(0.95, 0.97, 1.04) * uBright;
  gl_FragColor = vec4(c, uAlpha * smoothstep(1.0, 0.94, r2));
}`,
  }));
  moonHD.renderOrder = -98.5; moonHD.frustumCulled = false; moonHD.visible = false; scene.add(moonHD);

  /* ---------- nuages-plaques (shaders désactivés et preset Bas) : motif périodique 64 × 64 cases de 6 blocs, 3 × 3 copies ---------- */
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
  const U = { uDay: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uMin: { value: 0.03 }, uTime: { value: 0 }, uSkyCol: { value: new THREE.Color(1, 1, 1) }, uWind: { value: 1 } };
  const extra = [];
  function blockMat(opts) {
    const m = new THREE.MeshBasicMaterial(Object.assign({ map: VX.TEX.tex, vertexColors: true }, opts));
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;\nattribute vec2 tile;\nattribute vec3 lit;\nvarying vec2 vTile;\nvarying vec3 vLit;\nvarying vec2 vLocal;\nvarying vec3 vWPos;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = tile; vLit = lit; vLocal = uv;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'vec3 wp0 = (modelMatrix * vec4(transformed, 1.0)).xyz; vWPos = wp0;',
          'float an = lit.z;',
          // feuillage (1) et haut des plantes (2) : balancement doux, cohérent entre faces voisines (fonction de la position) ;
          // rafales : une onde lente traverse le paysage (le vent « passe » sur les herbes et les arbres)
          'if (an > 0.5 && an < 2.5) { float amp = (an < 1.5 ? 0.035 : 0.085) * uWind;',
          '  float gust = 0.7 + 0.3 * sin(uTime * 0.45 + wp0.x * 0.045 + wp0.z * 0.03) + 0.25 * max(uWind - 1.0, 0.0) * sin(uTime * 2.3 + wp0.x * 0.2);',
          '  float ph = uTime * (1.6 + 0.5 * max(uWind - 1.0, 0.0)) + wp0.x * 0.55 + wp0.z * 0.45 + wp0.y * 0.3;',
          '  transformed.x += (sin(ph) * 0.8 + 0.25 * max(uWind - 1.0, 0.0)) * amp * gust; transformed.z += cos(ph * 0.83 + 1.7) * amp * 0.8 * gust; }',
          // surface de l'eau (3) : légère houle (plus forte par grand vent)
          'if (an > 2.5 && an < 3.5) transformed.y += (sin(uTime * 1.3 + wp0.x * 0.7 + wp0.z * 0.45) * 0.5 - 0.5) * 0.05 * min(uWind, 2.0);',
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
          // vacillement des flammes : 3 sinus de fréquences non multiples, phase qui dépend du lieu (chaque foyer vit sa vie)
          'float fph = vWPos.x * 0.9 + vWPos.z * 0.7 + vWPos.y * 0.5;',
          'float flk = sin(uTime * 7.3 + fph) * 0.5 + sin(uTime * 13.1 + fph * 1.9) * 0.3 + sin(uTime * 23.7 + fph * 0.6) * 0.2;',
          'vec3 lc;',
          'if (vLit.x > 1.5) lc = vec3(0.97 + 0.03 * flk);',   // bloc lumineux : à peine vivant
          'else {',
          '  float sl = pow(clamp(vLit.x, 0.0, 1.0), 1.6), bl = pow(clamp(vLit.y, 0.0, 1.0), 1.6);',
          '  bl *= 0.94 + 0.06 * flk;',   // lumière des torches et de la lave : vacillement léger
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

  /* ---------- couleurs du cycle (20 min) : ciel « léger » ---------- */
  const C = hex => new THREE.Color(hex);
  const K = {
    dayZ: C('#4f8fe3'), dayH: C('#b3dbf6'), nightZ: C('#050918'), nightH: C('#141d3a'),
    dawnZ: C('#6874b4'), dawnH: C('#f3a9b6'), dawnG: C('#ffc4b0'),   // aube rosée
    duskZ: C('#5b5498'), duskH: C('#f29a55'), duskG: C('#ffae5e'),   // crépuscule orangé
    dayG: C('#fff1cf'), nightG: C('#9fb4ff'),
    cloudDay: C('#ffffff'), cloudDawn: C('#ffd2d6'), cloudDusk: C('#ffc596'), cloudNight: C('#2a3150'),
    skyDay: C('#ffffff'), skyTwi: C('#ffd9bd'), skyNight: C('#9fb6ff'),
    braises: C('#3a1838'), water: C('#1c3f8a'), lava: C('#c84a10'), rain: C('#7d8590'), storm: C('#3c424c'),
  };
  const zen = new THREE.Color(), hor = new THREE.Color(), twZ = new THREE.Color(), twH = new THREE.Color(), twG = new THREE.Color(), fogC = new THREE.Color(), tmp = new THREE.Color();
  const sunDir = new THREE.Vector3();
  const sstep = smoothJ;

  /* ---------- état atmosphérique partagé (lu par shaders.js) ---------- */
  const Q = { phys: false, plates: true, cirrus: 0.5 };
  const ATM = {
    get on() { return Q.phys; }, noise: noiseTex, lut: null, GLSL: ATMO_GLSL, SKYUV: SKYUV_GLSL,
    sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, -1, 0),
    sunCol: new THREE.Vector3(1, 1, 1),      // couleur du soleil direct (transmittance normalisée, 0..1)
    sunK: 1,                                 // présence du soleil (0 sous l'horizon, réduit par la pluie)
    zen: new THREE.Vector3(), hor: new THREE.Vector3(), fog: new THREE.Vector3(), amb: new THREE.Vector3(),
    wind: new THREE.Vector2(), windV: new THREE.Vector2(3.2, 1.1), rain: 0, storm: 0, flash: 0, day: 1, s: 1,
  };
  const NOW = { rain: 0, storm: 0, flash: 0 };
  const W = { rain: 0, storm: 0, flash: 0 };
  const _L = [0, 0, 0], _o = [0, 0, 0], _tr = [0, 0, 0, 0], _d = [0, 0, 0];
  // couleur du ciel affichée (modèle JS) dans la direction (dx, dy, dz)
  function skyJS(dx, dy, dz, out) {
    let l = Math.hypot(dx, Math.max(dy, 0.0015), dz); _d[0] = dx / l; _d[1] = Math.max(dy, 0.0015) / l; _d[2] = dz / l;
    atScatterJS(_d[0], _d[1], _d[2], sunDir.x, sunDir.y, sunDir.z, AT.I, _L);
    atFinishJS(_L, _d, sunDir.y, W, out); return out;
  }
  function setAtmo(o) {
    Object.assign(Q, o || {});
    dome.material = Q.phys ? domePhys : domeBasic;
    if (Q.phys) { PU.uLUT.value = ensureLUT().texture; ATM.lut = lutRT.texture; }
  }
  const lum = v => v.x * 0.3 + v.y * 0.55 + v.z * 0.15;

  VX.R = {
    gl, scene, camera, outline, stars, sun, moon, moonHD, clouds, dome, mats, uniforms: U, atmo: ATM, noiseTex,
    // ajoute une transformation de shader (appelée à la compilation des matériaux de blocs)
    extendBlockShader(fn) { extra.push(fn); mats.o.needsUpdate = mats.t.needsUpdate = true; },
    // qualité du ciel : { phys: ciel physique + lune HD, plates: nuages-plaques visibles, cirrus: 0..1 }
    setAtmo, get atmoQuality() { return Object.assign({}, Q); },
    // ciel, astres, nuages, lumière, brouillard et météo
    sky(dim, time, P, R, under) {
      const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      U.uTime.value = (now / 1000) % 3600;
      const cx = P.pos.x, cy = P.eye, cz = P.pos.z, surface = dim === 'surface', open = surface && !under;
      // météo (weather.js, facultatif) : valeurs lissées ici pour éviter les sauts
      const wsrc = (VX.G && VX.G.weather) || NOW, cl = v => Math.max(0, Math.min(1, +v || 0)), ka = Math.min(1, dt * 1.5);
      W.rain += (cl(wsrc.rain) - W.rain) * ka; W.storm += (cl(wsrc.storm) - W.storm) * ka; W.flash = cl(wsrc.flash);
      if (!surface) { W.rain = W.storm = W.flash = 0; }
      ATM.rain = W.rain; ATM.storm = W.storm; ATM.flash = W.flash;
      U.uWind.value = 1 + W.rain * 0.5 + W.storm * 1.3;
      // vent : déplace nuages et cirrus (plus vite sous l'orage)
      const wv = 1 + W.storm * 2.5;
      ATM.wind.x += ATM.windV.x * wv * dt; ATM.wind.y += ATM.windV.y * wv * dt;
      let fog;
      if (surface) {
        const ang = time * Math.PI * 2, s = Math.sin(ang), c = Math.cos(ang);
        const k = Math.max(0, Math.min(1, s * 2.2 + 0.45));   // luminosité du jour (même courbe qu'avant : créatures)
        const dayK = sstep(-0.12, 0.32, s), tw = Math.exp(-(s / 0.22) * (s / 0.22)), morn = sstep(-0.3, 0.3, c);
        U.uDay.value = (0.16 + 0.84 * k) * (1 - 0.32 * W.rain - 0.12 * W.storm) + W.flash * 0.75; U.uTint.value.setRGB(1, 1, 1);
        sunDir.set(c, s, 0.28).normalize();
        ATM.sunDir.copy(sunDir); ATM.moonDir.copy(sunDir).negate(); ATM.s = s; ATM.day = dayK;
        if (Q.phys) {
          // --- ciel physique : table du ciel (GPU) + mêmes formules en JS pour le brouillard et la lumière ---
          LU.uSun.value.copy(sunDir); LU.uSunY.value = sunDir.y; LU.uRain.value = W.rain; LU.uStorm.value = W.storm; LU.uFlash.value = W.flash;
          const rt = ensureLUT(), prev = gl.getRenderTarget();
          gl.setRenderTarget(rt); gl.render(lutScene, lutCam); gl.setRenderTarget(prev);
          // horizon (3 azimuts), zénith
          const ax = sunDir.x, az = sunDir.z, al = Math.hypot(ax, az) || 1, hx = ax / al, hz = az / al;
          const h1 = skyJS(hx, 0.03, hz, [0, 0, 0]), h2 = skyJS(-hx, 0.03, -hz, [0, 0, 0]), h3 = skyJS(-hz, 0.03, hx, [0, 0, 0]), zz = skyJS(-hx * 0.45, 1, -hz * 0.45, [0, 0, 0]);
          ATM.hor.set((h1[0] + h2[0] + 2 * h3[0]) / 4, (h1[1] + h2[1] + 2 * h3[1]) / 4, (h1[2] + h2[2] + 2 * h3[2]) / 4);
          ATM.zen.fromArray(zz); ATM.fog.copy(ATM.hor);
          ATM.amb.copy(ATM.zen).add(ATM.hor).multiplyScalar(0.5);
          // soleil direct : transmittance (blanc à midi, orange-or au coucher), normalisée
          atTransJS(sunDir.x, Math.max(sunDir.y, 0.004), sunDir.z, _tr);
          const mx = Math.max(_tr[0], _tr[1], _tr[2], 1e-4);
          ATM.sunCol.set(_tr[0] / mx, _tr[1] / mx, _tr[2] / mx);
          ATM.sunK = sstep(-0.035, 0.06, s) * (1 - 0.85 * W.rain);
          // dôme
          PU.uSunDir.value.copy(sunDir); PU.uMoonDir.value.copy(ATM.moonDir);
          PU.uSunC.value.copy(ATM.sunCol).multiplyScalar(0.6 + 0.4 * sstep(0.0, 0.3, s)); PU.uSunVis.value = sstep(-0.06, 0.0, s) * (1 - 0.95 * W.rain);
          const mk = sstep(0.04, -0.12, s) * (1 - 0.9 * W.rain);
          PU.uMoonGlow.value.set(0.16, 0.2, 0.3).multiplyScalar(mk);
          PU.uCirrus.value = Q.cirrus * (1 - 0.6 * W.rain) * (0.85 + 0.15 * Math.sin(now / 90000));
          PU.uCirLit.value.copy(ATM.sunCol).multiplyScalar(0.55 * ATM.sunK + 0.04);
          PU.uCirAmb.value.copy(ATM.zen).lerp(ATM.hor, 0.5).multiplyScalar(0.9);
          PU.uWind.value.copy(ATM.wind); PU.uTime.value = U.uTime.value;
          // lumière du ciel sur les blocs : teinte = soleil direct + ciel, normalisée (bleu nuit, or au crépuscule)
          tmp.setRGB(ATM.sunCol.x * ATM.sunK * 0.9 + ATM.amb.x * 0.8, ATM.sunCol.y * ATM.sunK * 0.9 + ATM.amb.y * 0.8, ATM.sunCol.z * ATM.sunK * 0.9 + ATM.amb.z * 0.8);
          const tm = Math.max(tmp.r, tmp.g, tmp.b, 1e-4); tmp.multiplyScalar(1 / tm);
          U.uSkyCol.value.setRGB(1, 1, 1).lerp(tmp, 0.65);
          fogC.setRGB(ATM.fog.x, ATM.fog.y, ATM.fog.z); hor.copy(fogC); zen.setRGB(ATM.zen.x, ATM.zen.y, ATM.zen.z);
          // nuages-plaques assortis (preset Bas)
          const cb = 0.82 * ATM.sunK + 0.1;
          CU.uCol.value.setRGB(ATM.sunCol.x * cb + ATM.amb.x * 0.55, ATM.sunCol.y * cb + ATM.amb.y * 0.55, ATM.sunCol.z * cb + ATM.amb.z * 0.55);
          tmp.copy(K.rain).lerp(K.storm, W.storm).multiplyScalar(0.25 + 0.75 * dayK); CU.uCol.value.lerp(tmp, W.rain * 0.8);
          CU.uCol.value.r = Math.min(1, CU.uCol.value.r + W.flash * 0.5); CU.uCol.value.g = Math.min(1, CU.uCol.value.g + W.flash * 0.5); CU.uCol.value.b = Math.min(1, CU.uCol.value.b + W.flash * 0.6);
          CU.uFogC.value.copy(fogC);
        } else {
          // --- ciel léger : dégradés ---
          // aube (soleil qui se lève, c > 0) ou crépuscule (c < 0)
          twZ.copy(K.duskZ).lerp(K.dawnZ, morn); twH.copy(K.duskH).lerp(K.dawnH, morn); twG.copy(K.duskG).lerp(K.dawnG, morn);
          zen.copy(K.nightZ).lerp(K.dayZ, dayK).lerp(twZ, tw * 0.55);
          hor.copy(K.nightH).lerp(K.dayH, dayK).lerp(twH, tw * 0.85);
          // pluie : ciel gris et bas ; éclair : flash bleuté
          if (W.rain > 0.001) { tmp.copy(K.rain).lerp(K.storm, W.storm).multiplyScalar(0.2 + 0.8 * dayK); zen.lerp(tmp, W.rain * 0.85); hor.lerp(tmp, W.rain * 0.75); }
          if (W.flash > 0.001) { tmp.setRGB(0.78, 0.82, 1); zen.lerp(tmp, W.flash * 0.6); hor.lerp(tmp, W.flash * 0.6); }
          fogC.copy(hor).lerp(zen, 0.18);
          SU.uZenith.value.copy(zen); SU.uHorizon.value.copy(hor); SU.uFogC.value.copy(fogC);
          SU.uSunDir.value.copy(sunDir); if (s <= -0.15) SU.uSunDir.value.negate();   // la nuit, le halo suit la lune
          SU.uGlowC.value.copy(K.dayG).lerp(twG, tw); SU.uGlow.value = (s > -0.15 ? 0.35 + tw * 0.45 : 0.12) * (1 - 0.8 * W.rain); SU.uTwi.value = tw * (s > -0.25 ? 1 : 0) * (1 - W.rain);
          if (s <= -0.15) SU.uGlowC.value.copy(K.nightG);   // la nuit : léger halo bleuté autour de la lune
          // couleur de la lumière du ciel sur les blocs
          U.uSkyCol.value.copy(K.skyNight).lerp(K.skyDay, dayK).lerp(K.skyTwi, tw * 0.6 * (1 - W.rain));
          // nuages : couleur selon l'heure, plus gris sous la pluie
          CU.uCol.value.copy(K.cloudNight).lerp(K.cloudDay, dayK).lerp(tmp.copy(K.cloudDusk).lerp(K.cloudDawn, morn), tw * 0.7);
          if (W.rain > 0.001) CU.uCol.value.lerp(tmp.copy(K.rain).lerp(K.storm, W.storm).multiplyScalar(0.25 + 0.75 * dayK), W.rain * 0.8);
          if (W.flash > 0.001) CU.uCol.value.lerp(tmp.setRGB(0.9, 0.92, 1), W.flash * 0.5);
          CU.uFogC.value.copy(hor);
          ATM.zen.set(zen.r, zen.g, zen.b); ATM.hor.set(hor.r, hor.g, hor.b); ATM.fog.set(fogC.r, fogC.g, fogC.b);
        }
        // astres
        sun.position.set(cx + sunDir.x * 360, cy + sunDir.y * 360, cz + sunDir.z * 360);
        moon.position.set(cx - sunDir.x * 360, cy - sunDir.y * 360, cz - sunDir.z * 360);
        sun.material.opacity = sstep(-0.2, 0.05, s) * (1 - 0.9 * W.rain); moon.material.opacity = (1 - dayK * 0.85) * (1 - 0.9 * W.rain);
        moonHD.position.copy(moon.position); moonHD.quaternion.copy(camera.quaternion); moonHD.scale.set(30, 30, 1);
        MU.uAlpha.value = (1 - dayK * 0.8) * (1 - 0.92 * W.rain); MU.uBright.value = 1.05 + 0.25 * (1 - dayK);
        // étoiles : tournent avec le ciel, s'effacent au jour et sous les nuages de pluie
        skyRig.position.set(cx, cy, cz); skyRig.rotation.set(0, 0, ang); stars.material.opacity = Math.max(0, 1 - dayK * 1.4) * (1 - W.rain);
        fog = fogC;
      } else { U.uDay.value = 0.92; U.uTint.value.setRGB(1, 0.88, 0.95); U.uSkyCol.value.setRGB(1, 1, 1); fog = K.braises; }
      dome.visible = skyRig.visible = open;
      sun.visible = moon.visible = open && !Q.phys; moonHD.visible = open && Q.phys;
      clouds.visible = open && Q.plates;
      if (open) {
        dome.position.set(cx, cy, cz);
        drift += dt * 0.9 * wv; const Lp = CL.period, bx = Math.floor((cx - drift) / Lp) * Lp + drift, bz = Math.floor(cz / Lp) * Lp;
        let k = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) clouds.children[k++].position.set(bx + i * Lp, CL.y, bz + j * Lp);
        CU.uFar.value = Math.max(220, Math.min(380, R * 16 * 3)); CU.uNear.value = CU.uFar.value * 0.45;
      }
      const bg = under === 1 ? K.water : under === 2 ? K.lava : fog;
      scene.background = open ? null : bg; if (open) gl.setClearColor(fog);
      scene.fog.color.copy(bg);
      // brouillard : plus proche sous la pluie
      const wf = surface && !under ? 1 - 0.38 * W.rain - 0.12 * W.storm : 1;
      scene.fog.near = under ? 1 : dim === 'braises' ? 8 : R * 16 * 0.55 * wf; scene.fog.far = under ? (under === 2 ? 3 : 14) : dim === 'braises' ? R * 16 * 0.75 : R * 16 * 0.95 * wf;
    },
    render() { gl.render(scene, camera); },
  };
})();

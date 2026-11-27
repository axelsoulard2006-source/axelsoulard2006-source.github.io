/* ===== shaders.js : mode « Shaders » de Blocaria (module autonome, branché par l'API publique de VX.R)
   Presets : Désactivé / Bas / Moyen / Élevé / Ultra + réglages fins (panneau : touche F7 ou VX.Shaders.openPanel()).
   Effets (tous écrits pour Blocaria, techniques classiques) :
   - ombres du soleil / de la lune : carte de profondeur maison (caméra orthographique centrée sur le joueur,
     1 ou 2 cascades, alignée sur la grille des texels pour éviter le scintillement), filtrage PCF bilinéaire ;
   - éclairage recalculé dans le shader des blocs (VX.R.extendBlockShader) : ciel ambiant, lumière directe chaude
     le jour / bleutée la nuit, lumière des blocs plus chaude, blocs lumineux en HDR pour le bloom ;
   - ciel atmosphérique (dégradé zénith / horizon, halo du soleil, coucher de soleil) et brouillard assorti ;
   - eau : normales animées, reflet du ciel (Fresnel), reflet du soleil, scintillements, couleur plus profonde ;
   - feuillage et plantes au vent (seulement si renderer.js ne le fait pas déjà) ;
   - post-traitement : bloom (filtre dual), rayons de soleil (flou radial), occlusion ambiante écran,
     profondeur de champ légère, tonemapping filmique, saturation / contraste, vignette.
   Désactivé : VX.R.render d'origine, shaders des blocs strictement inchangés. ===== */
(function () {
  'use strict';
  const VX = window.VX;
  if (!VX || !VX.R || !window.THREE) { console.warn('[shaders] VX.R introuvable : module ignoré'); return; }
  const R = VX.R, gl = R.gl;
  const KEY = 'blocaria_shaders';
  const isGL2 = !!gl.capabilities.isWebGL2;
  const hasDepthTex = isGL2 || !!gl.extensions.get('WEBGL_depth_texture');
  const hasHalf = isGL2 ? !!(gl.extensions.get('EXT_color_buffer_float') || gl.extensions.get('EXT_color_buffer_half_float')) : !!(gl.extensions.get('OES_texture_half_float') && gl.extensions.get('EXT_color_buffer_half_float'));
  const ascii = src => src.replace(/[^\x00-\x7F]/g, '');   // GLSL : jeu de caractères ASCII uniquement (même dans les commentaires)
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* =====================================================================
     1. PRESETS ET RÉGLAGES
     ===================================================================== */
  const BASE = {
    on: true, sky: true, shadows: true, shadowRes: 2048, shadowDist: 48, cascades: 1, pcf: 1, shadowEvery: 1,
    bloom: true, bloomLv: 4, bloomStr: 0.55, rays: true, raySamples: 32, rayStr: 0.45,
    water: true, waterHQ: true, waterRefl: 0.7, wave: true, wind: 1, ao: false, aoSamples: 8, aoStr: 0.7, dof: false, dofStr: 1,
    exposure: 1, saturation: 1.12, contrast: 1.06, vignette: 0.28, glow: 1,
  };
  const PRESETS = {
    off: { on: false },
    bas: { shadowRes: 1024, shadowDist: 32, cascades: 1, pcf: 0, shadowEvery: 3, bloom: false, rays: false, ao: false, dof: false, wave: true, sky: false, waterHQ: false, saturation: 1.08, vignette: 0.2 },
    moyen: { shadowRes: 2048, shadowDist: 48, cascades: 1, pcf: 1, shadowEvery: 2, bloom: true, bloomLv: 4, rays: true, raySamples: 28, ao: false, dof: false },
    eleve: { shadowRes: 2048, shadowDist: 80, cascades: 2, pcf: 1, shadowEvery: 1, bloom: true, bloomLv: 5, rays: true, raySamples: 40, ao: true, aoSamples: 8, dof: false },
    ultra: { shadowRes: 3072, shadowDist: 112, cascades: 2, pcf: 2, shadowEvery: 1, bloom: true, bloomLv: 6, rays: true, raySamples: 64, ao: true, aoSamples: 16, dof: true },
  };
  const NAMES = { off: 'Désactivé', bas: 'Bas', moyen: 'Moyen', eleve: 'Élevé', ultra: 'Ultra' };

  // petite config : pas de WebGL2, logiciel, mobile, peu de cœurs ou de mémoire, puce graphique intégrée ancienne
  function lowEnd() {
    try {
      if (!isGL2) return true;
      const ctx = gl.getContext(), dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      const name = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
      if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return true;
      if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return true;
      if (/Mali|Adreno|PowerVR/i.test(name)) return true;
      if (cores <= 2 || mem <= 2) return true;
      if (/Intel/i.test(name) && !/Iris|Arc|Xe/i.test(name) && (cores <= 4 || mem <= 4)) return true;
    } catch (e) { /* inconnu : on considère la machine correcte */ }
    return false;
  }

  let preset = 'moyen', over = {};
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && PRESETS[s.preset]) { preset = s.preset; over = s.over || {}; } else preset = lowEnd() ? 'off' : 'moyen'; } catch (e) { preset = lowEnd() ? 'off' : 'moyen'; }
  const S = {};   // réglages effectifs
  function build() {
    for (const k in S) delete S[k];
    Object.assign(S, BASE, PRESETS[preset], preset === 'off' ? {} : over);
    if (preset === 'off') S.on = false;
    if (!hasDepthTex) { S.shadows = false; S.rays = false; S.ao = false; S.dof = false; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ preset, over })); } catch (e) { /* stockage indisponible */ } }
  build();

  /* =====================================================================
     2. UNIFORMS PARTAGÉS (mêmes objets { value } dans tous les matériaux)
     ===================================================================== */
  const V3 = () => new THREE.Vector3();
  const SU = {
    sxTime: { value: 0 }, sxWind: { value: 1 }, sxCam: { value: new THREE.Vector3() },
    sxLightDir: { value: new THREE.Vector3(0, 1, 0) }, sxSunCol: { value: V3() }, sxAmb: { value: V3() }, sxBlkCol: { value: new THREE.Vector3(1.4, 0.86, 0.44) },
    sxGlowGain: { value: 1.6 }, sxLightOn: { value: 0 }, sxUnder: { value: 0 }, sxReflStr: { value: 0.85 },
    sxZen: { value: V3() }, sxHor: { value: V3() }, sxFogC: { value: V3() }, sxSunDir: { value: new THREE.Vector3(0, 1, 0) }, sxGlow: { value: V3() }, sxSunset: { value: V3() },
    sxMoonDir: { value: new THREE.Vector3(0, -1, 0) }, sxMoonGlow: { value: V3() },
    sxSM0: { value: null }, sxSM1: { value: null }, sxSMat0: { value: new THREE.Matrix4() }, sxSMat1: { value: new THREE.Matrix4() },
    sxSInfo: { value: new THREE.Vector4(1 / 1024, 0.06, 0.2, 0.0002) },
    sxTiles: { value: [] },
  };
  const NT = 24;   // nombre max de tuiles « spéciales » (eau, feuillage, plantes, lave)
  for (let i = 0; i < NT; i++) SU.sxTiles.value.push(new THREE.Vector3(-1, -1, 0));

  // classes de tuiles : 1 = eau, 2 = feuillage, 3 = plante en croix, 4 = lave
  let tilesBuilt = false;
  function buildTiles() {
    if (tilesBuilt || !VX.TEX || !VX.TEX.workerTiles || !VX.BLOCKS) return;
    tilesBuilt = true;
    const t = VX.TEX.workerTiles(), out = [], seen = {};
    for (const id in VX.BLOCKS) {
      const b = VX.BLOCKS[id]; if (!b || !b.tex) continue;
      const cls = b.liquid && b.transparent ? 1 : b.liquid && b.glow ? 4 : b.leaves || (VX.B && +id === VX.B.FEUILLES) ? 2 : b.shape === 'cross' ? 3 : 0;
      if (!cls) continue;
      for (const f in b.tex) { const n = b.tex[f], ti = t.tiles[n]; if (ti == null || seen[n]) continue; seen[n] = 1; const o = t.origins[ti]; if (o) out.push([o[0], o[1], cls]); }
    }
    out.slice(0, NT).forEach((o, i) => SU.sxTiles.value[i].set(o[0], o[1], o[2]));
  }

  /* =====================================================================
     3. GLSL COMMUN : ciel atmosphérique
     ===================================================================== */
  // lecture de texture COULEUR sans dérivées (niveau 0) dans les boucles des passes de post-traitement
  // (pas pour les textures de profondeur : sous ANGLE/D3D11, textureLod sur une DepthTexture renvoie 0)
  const TEX0 = `
#if __VERSION__ >= 300
#define SXTEX(t, uv) textureLod(t, uv, 0.0)
#else
#define SXTEX(t, uv) texture2D(t, uv)
#endif
`;
  const SKY_PARS = `
uniform vec3 sxZen; uniform vec3 sxHor; uniform vec3 sxFogC; uniform vec3 sxSunDir; uniform vec3 sxGlow; uniform vec3 sxSunset;
uniform vec3 sxMoonDir; uniform vec3 sxMoonGlow;
// couleur du ciel dans la direction d (monde) : dégradé zénith → horizon, halo du soleil, bande de coucher de soleil
vec3 sxSky(vec3 d) {
  float y = d.y;
  float t = 1.0 - clamp(y, 0.0, 1.0);
  vec3 c = mix(sxZen, sxHor, t * t * t);
  c = mix(c, sxFogC, 1.0 - smoothstep(-0.25, 0.02, y));   // smoothstep exige bord0 < bord1
  float mu = dot(d, sxSunDir), m = max(mu, 0.0);
  float hz = t * t * t * t;
  c += sxSunset * hz * (0.3 + 0.7 * pow(mu * 0.5 + 0.5, 3.0));
  c += sxGlow * (pow(m, 5.0) * (0.12 + 0.5 * hz) + pow(m, 40.0) * 0.55 + pow(m, 400.0) * 1.4);
  float mm = max(dot(d, sxMoonDir), 0.0);
  c += sxMoonGlow * (pow(mm, 12.0) * 0.35 + pow(mm, 220.0) * 1.2);
  return c;
}
`;

  /* =====================================================================
     4. INJECTION DANS LE SHADER DES BLOCS
     ===================================================================== */
  const BLOCK_V_PARS = `
uniform float sxTime; uniform float sxWind; uniform vec3 sxCam; uniform vec3 sxTiles[${NT}];
varying vec3 sxRel; varying float sxCls;
float sxClass(vec2 t) { for (int i = 0; i < ${NT}; i++) { if (abs(t.x - sxTiles[i].x) + abs(t.y - sxTiles[i].y) < 0.0005) return sxTiles[i].z; } return 0.0; }
`;
  const BLOCK_V_WAVE = `
sxCls = sxClass(tile);
#ifdef SX_WAVE
{
  vec3 sxWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  float sxPh = sxTime * 1.6 + dot(sxWp, vec3(0.41, 0.23, 0.33));
  if (sxCls > 1.5 && sxCls < 2.5) {          // feuillage : champ continu (pas de fissure entre faces voisines)
    transformed += sxWind * vec3(sin(sxPh) * 0.04 + sin(sxPh * 2.7 + sxWp.y) * 0.015, sin(sxPh * 1.3 + sxWp.x) * 0.018, cos(sxPh * 0.8) * 0.04);
  } else if (sxCls > 2.5 && sxCls < 3.5 && uv.y > 0.5) {   // plantes : seul le haut bouge
    transformed.xz += sxWind * vec2(sin(sxPh) * 0.09 + sin(sxPh * 3.1) * 0.03, cos(sxPh * 0.9) * 0.07);
  }
}
#endif
`;
  const BLOCK_V_POS = `
sxRel = (modelMatrix * vec4(transformed, 1.0)).xyz - sxCam;   // cameraPosition n'est pas fourni aux MeshBasicMaterial en r128
`;
  const BLOCK_F_PARS = TEX0 + SKY_PARS + `
uniform float sxTime; uniform vec3 sxLightDir; uniform vec3 sxSunCol; uniform vec3 sxAmb; uniform vec3 sxBlkCol;
uniform vec3 sxCam; uniform float sxGlowGain; uniform float sxLightOn; uniform float sxUnder; uniform float sxReflStr;
varying vec3 sxRel; varying float sxCls;
#ifdef SX_SHADOW
uniform sampler2D sxSM0; uniform mat4 sxSMat0; uniform vec4 sxSInfo;
#if SX_CASC > 1
uniform sampler2D sxSM1; uniform mat4 sxSMat1;
#endif
// PCF bilinéaire : (2R+2)² lectures pondérées = bord doux sans bruit
float sxPCF(sampler2D m, vec3 c, float tx) {
  vec2 st = c.xy / tx - 0.5; vec2 f = fract(st); vec2 b = (floor(st) + 0.5) * tx;
  float sum = 0.0;
  for (int j = -SX_PCF; j <= SX_PCF + 1; j++) for (int i = -SX_PCF; i <= SX_PCF + 1; i++) {
    float s = step(c.z, texture2D(m, b + vec2(float(i), float(j)) * tx).r);   // texture2D : textureLod sur une texture de profondeur renvoie 0 sous ANGLE/D3D11
    float wx = i == -SX_PCF ? 1.0 - f.x : (i == SX_PCF + 1 ? f.x : 1.0);
    float wy = j == -SX_PCF ? 1.0 - f.y : (j == SX_PCF + 1 ? f.y : 1.0);
    sum += s * wx * wy;
  }
  return sum / float((2 * SX_PCF + 1) * (2 * SX_PCF + 1));
}
#endif
// visibilité du soleil (1 = éclairé) ; hors de la carte d'ombre : estimation par la lumière du ciel
float sxShadowAt(vec3 w, vec3 n, float skyL, float off) {
  float fall = smoothstep(0.6, 0.97, skyL);
#ifdef SX_SHADOW
  vec4 c = sxSMat0 * vec4(w + n * (sxSInfo.y * 1.6 + 0.015 + off), 1.0);
  vec2 e = abs(c.xy - 0.5); float m0 = max(e.x, e.y);
  float s0 = -1.0;
  if (m0 < 0.5) s0 = sxPCF(sxSM0, vec3(c.xy, c.z - sxSInfo.w), sxSInfo.x);
#if SX_CASC > 1
  if (m0 < 0.44) return s0;
  vec4 c1 = sxSMat1 * vec4(w + n * (sxSInfo.z * 1.6 + 0.015 + off), 1.0);
  vec2 e1 = abs(c1.xy - 0.5); float m1 = max(e1.x, e1.y);
  float s1 = m1 < 0.5 ? mix(sxPCF(sxSM1, vec3(c1.xy, c1.z - sxSInfo.w * 2.0), sxSInfo.x), fall, smoothstep(0.4, 0.5, m1)) : fall;
  return s0 < 0.0 ? s1 : mix(s0, s1, smoothstep(0.44, 0.5, m0));
#else
  return s0 < 0.0 ? fall : mix(s0, fall, smoothstep(0.42, 0.5, m0));
#endif
#else
  return fall;
#endif
}
#ifdef SX_WATER
// gradient d'une somme de vagues directionnelles (dérivées analytiques)
vec2 sxWaveGrad(vec2 p, float t) {
  vec2 g = vec2(0.0); vec2 d; float f; float a;
  d = vec2(0.86, 0.5);   f = 1.3; a = 0.045; g += d * a * f * cos(dot(d, p) * f + t * 1.4);
  d = vec2(-0.45, 0.89); f = 2.3; a = 0.026; g += d * a * f * cos(dot(d, p) * f + t * 1.9);
  d = vec2(0.21, -0.98); f = 4.1; a = 0.012; g += d * a * f * cos(dot(d, p) * f + t * 2.6);
  d = vec2(-0.93, -0.36); f = 7.3; a = 0.006; g += d * a * f * cos(dot(d, p) * f + t * 3.3);
  d = vec2(0.6, -0.8);   f = 13.0; a = 0.0028; g += d * a * f * cos(dot(d, p) * f - t * 4.1);
  return g;
}
#endif
`;
  // ce code remplace « #include <fog_fragment> » (gl_FragColor contient alors la couleur éclairée par renderer.js)
  const BLOCK_F_MAIN = `
{
  vec3 sxW = sxRel + sxCam;
  vec3 sxN = normalize(cross(dFdx(sxRel), dFdy(sxRel)));
  if (dot(sxN, sxRel) > 0.0) sxN = -sxN;                 // normale tournée vers la caméra
  float sxSkyL = SX_SKYL, sxBl = SX_BLK;
  bool sxGlowing = SX_GLOWING;
  bool sxPlant = sxCls > 2.5 && sxCls < 3.5;
  bool sxIsWater = sxCls > 0.5 && sxCls < 1.5;
  if (sxPlant) sxN = vec3(0.0, 1.0, 0.0);
  float sxSh = sxPlant ? 1.0 : (abs(sxN.y) > 0.5 ? (sxN.y > 0.0 ? 1.0 : 0.55) : (abs(sxN.x) > 0.5 ? 0.8 : 0.68));
  float sxNdl = dot(sxN, sxLightDir); if (sxPlant) sxNdl = 0.35 + 0.5 * max(sxNdl, 0.0);
  float sxVis = 0.0;
  if (sxNdl > 0.0 && sxLightOn > 0.5) sxVis = sxShadowAt(sxW, sxN, sxSkyL, sxCls > 1.5 && sxCls < 2.5 ? 0.22 : 0.0) * smoothstep(0.02, 0.3, sxSkyL);
  if (!sxGlowing) {
#ifdef SX_RELIGHT
    // lumière d'origine (renderer.js) → on retrouve albédo × ombre des coins, puis on rééclaire
    vec3 sxL0 = max(lc, vec3(uMin));
    vec3 sxAlb = gl_FragColor.rgb / sxL0 / sxSh;
    vec3 sxL = sxAmb * SX_SKYC * mix(1.0, sxSh, 0.7)
             + sxSunCol * max(sxNdl, 0.0) * sxVis
             + sxBlkCol * pow(sxBl, 2.0) * sxSh * (0.96 + 0.04 * sin(sxTime * 9.0 + sxW.x * 1.7 + sxW.z * 2.3));
    gl_FragColor.rgb = sxAlb * max(sxL, vec3(uMin) * sxSh);
#else
    // repli si renderer.js a changé sa formule : simple modulation par l'ombre
    gl_FragColor.rgb *= mix(0.62, 1.12, sxVis * max(sxNdl, 0.0));
#endif
  } else {
    float sxG = sxCls > 3.5 ? 1.25 + 0.15 * sin(sxTime * 1.3 + sxW.x * 0.7 + sxW.z * 0.5) : 1.0;
    gl_FragColor.rgb *= sxGlowGain * sxG;                    // HDR : nourrit le bloom
  }
#ifdef SX_WATER
  if (sxIsWater && !sxGlowing && abs(sxN.y) > 0.5) {
    vec3 sxV = normalize(-sxRel);
    vec3 sxWN = vec3(0.0, sign(sxN.y), 0.0);
    if (sxN.y > 0.0) {
      vec2 g = sxWaveGrad(sxW.xz, sxTime) * mix(1.0, 0.45, smoothstep(10.0, 60.0, length(sxRel)));
      sxWN = normalize(vec3(-g.x, 1.0, -g.y));
    }
    float sxCos = clamp(dot(sxWN, sxV), 0.0, 1.0);
    float sxF = 0.025 + 0.975 * pow(1.0 - sxCos, 5.0);
    vec3 sxRd = reflect(-sxV, sxWN); sxRd.y = abs(sxRd.y);
    vec3 sxRefl = sxSky(sxRd) * (0.3 + 0.7 * smoothstep(0.3, 0.9, sxSkyL));
    vec3 sxBody = gl_FragColor.rgb * vec3(0.62, 0.82, 0.95);
#ifdef SX_WATER_HQ
    float sxSpecV = sxN.y > 0.0 ? sxShadowAt(sxW, vec3(0.0, 1.0, 0.0), sxSkyL, 0.0) * sxLightOn : 0.0;
    float sxSp = pow(max(dot(sxRd, sxLightDir), 0.0), 260.0) * 5.0 + pow(max(dot(sxRd, sxLightDir), 0.0), 24.0) * 0.12;
    // scintillements : petites facettes très brillantes qui bougent
    vec2 sxQ = sxW.xz * 3.1 + vec2(sxTime * 0.7, -sxTime * 0.5);
    float sxGl = pow(max(sin(sxQ.x) * sin(sxQ.y * 1.3 + sin(sxQ.x * 0.7)), 0.0), 40.0) * pow(max(dot(sxRd, sxLightDir), 0.0), 6.0);
#else
    float sxSpecV = sxN.y > 0.0 ? smoothstep(0.6, 0.97, sxSkyL) * sxLightOn : 0.0;   // version légère : pas de 2e lecture d'ombre
    float sxSp = pow(max(dot(sxRd, sxLightDir), 0.0), 200.0) * 3.0, sxGl = 0.0;
#endif
    gl_FragColor.rgb = mix(sxBody, sxRefl, clamp(sxF * sxReflStr * (0.55 + 0.45 * sxSkyL), 0.0, 1.0)) + sxSunCol * (sxSp + sxGl * 3.0) * sxSpecV;
    gl_FragColor.a = clamp(mix(gl_FragColor.a * 1.12, 1.0, sxF), 0.0, 1.0);
  }
#endif
}
`;
  const BLOCK_F_FOG = `
#ifdef USE_FOG
{
  float sxFF = smoothstep(fogNear, fogFar, fogDepth);
  vec3 sxFC = fogColor;
#ifdef SX_SKY
  if (sxUnder < 0.5) {
    sxFF = max(sxFF, (1.0 - exp(-max(length(sxRel) - 20.0, 0.0) * 0.008)) * 0.2);   // légère perspective aérienne au-delà de 20 blocs
    if (sxFF > 0.004) sxFC = sxSky(normalize(sxRel));                                 // ciel calculé seulement si le fragment est voilé
  }
#endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, sxFC, sxFF);
}
#endif
`;

  // clé de compilation : change quand un réglage qui modifie le code GLSL change ('' = shader d'origine)
  let compileKey = '', engineWave = false, relightOk = true;
  function computeKey() {
    if (!S.on) return '';
    const sh = S.shadows ? 's' + S.cascades + 'p' + S.pcf : 'n';
    return 'sx1|' + sh + '|' + (S.water ? (S.waterHQ ? 'W' : 'w') : '') + (S.wave ? 'v' : '') + (S.sky ? 'k' : '');
  }
  function patchShader(sh) {
    if (!compileKey) return;                 // Désactivé : shader strictement inchangé
    buildTiles();
    const vs = sh.vertexShader, fs = sh.fragmentShader;
    // renderer.js anime-t-il déjà les sommets (feuillage / eau) ? on ne double pas l'effet
    engineWave = /transformed\s*(\.[xyzw]{1,3})?\s*[-+*/]?=[^=]/.test(vs) || /\b(sway|wind|uWave|vent)\b/i.test(vs);
    const hasLit = /varying\s+vec[23]\s+vLit/.test(fs);
    // lumière d'origine : variable « lc » du shader de renderer.js (diffuseColor.rgb *= max(lc, vec3(uMin)))
    const hasLc = /vec3\s+lc\b/.test(fs) && fs.indexOf('max(lc, vec3(uMin))') >= 0;
    relightOk = hasLit && hasLc;
    const skyCurve = fs.indexOf('pow(clamp(vLit.x, 0.0, 1.0), 1.6)') >= 0 ? 'pow(sxSkyL, 1.6)' : 'sxSkyL';
    const defs = ['#define SX_ON'];
    if (S.shadows && hasDepthTex) defs.push('#define SX_SHADOW', '#define SX_CASC ' + S.cascades, '#define SX_PCF ' + S.pcf);
    if (S.water) defs.push('#define SX_WATER'); if (S.water && S.waterHQ) defs.push('#define SX_WATER_HQ');
    if (S.wave && !engineWave) defs.push('#define SX_WAVE');
    if (S.sky) defs.push('#define SX_SKY');
    if (relightOk) defs.push('#define SX_RELIGHT', '#define SX_SKYC ' + skyCurve);
    defs.push('#define SX_SKYL ' + (hasLit ? 'clamp(vLit.x, 0.0, 1.0)' : '1.0'), '#define SX_BLK ' + (hasLit ? 'vLit.y' : '0.0'), '#define SX_GLOWING ' + (hasLit ? '(vLit.x > 1.5)' : 'false'));
    const D = defs.join('\n') + '\n';
    Object.assign(sh.uniforms, SU);
    if (vs.indexOf('#include <begin_vertex>') < 0 || vs.indexOf('#include <project_vertex>') < 0) return;
    sh.vertexShader = vs
      .replace('#include <common>', D + '#include <common>\n' + BLOCK_V_PARS + (/attribute\s+vec2\s+tile/.test(vs) ? '' : 'attribute vec2 tile;\n'))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + BLOCK_V_WAVE)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + BLOCK_V_POS);
    let f = fs.replace('#include <common>', D + '#include <common>\n' + BLOCK_F_PARS);
    if (f.indexOf('#include <fog_fragment>') >= 0) f = f.replace('#include <fog_fragment>', BLOCK_F_MAIN + BLOCK_F_FOG);
    else if (f.indexOf('#include <premultiplied_alpha_fragment>') >= 0) f = f.replace('#include <premultiplied_alpha_fragment>', BLOCK_F_MAIN + '#include <premultiplied_alpha_fragment>');
    sh.fragmentShader = ascii(f); sh.vertexShader = ascii(sh.vertexShader);
  }
  R.extendBlockShader(patchShader);

  // le cache de programmes de Three.js se base sur customProgramCacheKey : on y ajoute notre clé
  let patchedMats = [];
  function patchMats() {
    const list = R.mats ? Object.keys(R.mats).map(k => R.mats[k]).filter(m => m && m.isMaterial) : [];
    for (const m of list) {
      if (!m.__sx) {
        const prev = m.customProgramCacheKey;
        m.customProgramCacheKey = function () { return prev.call(this) + (compileKey ? '|' + compileKey : ''); };
        m.__sx = true;
      }
      if (!isGL2) { if (compileKey) m.extensions = Object.assign(m.extensions || {}, { derivatives: true }); else if (m.extensions) delete m.extensions.derivatives; }
      m.needsUpdate = true;
    }
    patchedMats = list;
  }
  function matsChanged() { if (!R.mats) return false; for (const k in R.mats) { const m = R.mats[k]; if (m && m.isMaterial && !m.__sx) return true; } return false; }

  /* =====================================================================
     5. CARTE D'OMBRE (cascades orthographiques autour du joueur)
     ===================================================================== */
  const depthMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: VX.TEX ? VX.TEX.tex : null } },
    vertexShader: 'attribute vec2 tile; varying vec2 vT; varying vec2 vL; void main() { vT = tile; vL = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D map; varying vec2 vT; varying vec2 vL; void main() { vec2 a = vT + (fract(vL) * 0.996 + 0.002) * 0.0625; if (texture2D(map, a).a < 0.5) discard; gl_FragColor = vec4(1.0); }',
    side: THREE.DoubleSide,
  });
  depthMat.colorWrite = false;
  const shadowScene = new THREE.Scene(); shadowScene.overrideMaterial = depthMat;
  const casc = [];
  const LIGHT_D = 180;
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const tq = new THREE.Quaternion(), tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
  function makeCascade(res, r) {
    const rt = new THREE.WebGLRenderTarget(res, res, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, stencilBuffer: false });
    rt.texture.generateMipmaps = false;
    rt.depthTexture = new THREE.DepthTexture(res, res); rt.depthTexture.type = THREE.UnsignedIntType;
    rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter;
    const cam = new THREE.OrthographicCamera(-r, r, r, -r, 1, LIGHT_D * 2);
    cam.up.set(0, 0, 1);
    return { rt, cam, r, res, mat: new THREE.Matrix4(), n: 0 };
  }
  function freeCascades() { for (const c of casc) { c.rt.depthTexture.dispose(); c.rt.dispose(); } casc.length = 0; }
  function setupCascades() {
    const want = S.on && S.shadows && hasDepthTex ? (S.cascades > 1 ? [Math.max(12, S.shadowDist * 0.22), S.shadowDist] : [S.shadowDist]) : [];
    const res = Math.min(S.shadowRes, gl.capabilities.maxTextureSize || 4096);
    if (casc.length === want.length && casc.every((c, i) => c.res === res && c.r === want[i])) return;
    freeCascades();
    for (const r of want) casc.push(makeCascade(res, r));
    SU.sxSM0.value = casc[0] ? casc[0].rt.depthTexture : null;
    SU.sxSM1.value = casc[1] ? casc[1].rt.depthTexture : null;
    shadowDirty = 99;
  }
  let shadowDirty = 99, frameNo = 0;
  function renderCascade(c, L, center, grp) {
    // orientation fixe de la lumière, centre aligné sur la grille des texels (pas de scintillement en marchant)
    const texel = (2 * c.r) / c.res;
    c.cam.position.copy(center).addScaledVector(L, LIGHT_D); c.cam.lookAt(center);
    tq.copy(c.cam.quaternion).invert();
    tv.copy(center).applyQuaternion(tq);
    tv.x = Math.round(tv.x / texel) * texel; tv.y = Math.round(tv.y / texel) * texel;
    tv.applyQuaternion(c.cam.quaternion);
    c.cam.position.copy(tv).addScaledVector(L, LIGHT_D); c.cam.lookAt(tv);
    c.cam.updateMatrixWorld(true);
    c.cam.updateProjectionMatrix();
    c.mat.multiplyMatrices(bias, c.cam.projectionMatrix).multiply(c.cam.matrixWorldInverse);
    gl.setRenderTarget(c.rt);
    gl.clear(true, true, false);
    gl.render(shadowScene, c.cam);
  }
  function renderShadows(L) {
    const G = VX.G, grp = G && G.world && G.world.group;
    if (!grp || !casc.length) return;
    frameNo++;
    const due = casc.map((c, i) => shadowDirty > 0 || (frameNo % Math.max(1, i === 0 ? S.shadowEvery : S.shadowEvery * 3)) === 0);
    if (!due.some(Boolean)) return;
    const P = G.player, center = tv2.set(P.pos.x, P.eye != null ? P.eye : P.pos.y + 1.6, P.pos.z);
    // seuls les maillages opaques projettent une ombre (l'eau et le verre transparent non)
    const parent = grp.parent, hidden = [];
    for (const m of grp.children) if (m.visible && m.material && m.material.transparent) { m.visible = false; hidden.push(m); }
    shadowScene.add(grp);
    const ac = gl.autoClear; gl.autoClear = false;
    casc.forEach((c, i) => { if (due[i]) { renderCascade(c, L, center, grp); SU['sxSMat' + i].value.copy(c.mat); } });
    gl.autoClear = ac;
    if (parent) parent.add(grp); else shadowScene.remove(grp);
    for (const m of hidden) m.visible = true;
    const c0 = casc[0], c1 = casc[1] || casc[0];
    SU.sxSInfo.value.set(1 / c0.res, (2 * c0.r) / c0.res, (2 * c1.r) / c1.res, 0.035 / (LIGHT_D * 2));
    shadowDirty = Math.max(0, shadowDirty - 1);
  }

  /* =====================================================================
     6. POST-TRAITEMENT
     ===================================================================== */
  const QUAD_V = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const qMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); qMesh.frustumCulled = false; qScene.add(qMesh);
  const PM = (frag, uniforms, defines) => new THREE.ShaderMaterial({ uniforms: uniforms || {}, defines: defines || {}, vertexShader: QUAD_V, fragmentShader: ascii(TEX0 + frag), depthTest: false, depthWrite: false });
  function pass(mat, target) { qMesh.material = mat; gl.setRenderTarget(target); gl.render(qScene, qCam); }

  // ciel atmosphérique (dessiné avant la scène, qui se pose dessus : nuages, étoiles, soleil gardent leur rendu)
  const skyMat = PM(SKY_PARS + `uniform mat4 uRayM; varying vec2 vUv;
void main() { vec4 p = uRayM * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 d = normalize(p.xyz / p.w); gl_FragColor = vec4(sxSky(d), 1.0); }`,
  Object.assign({ uRayM: { value: new THREE.Matrix4() } }, SU));

  // bloom : seuil doux puis filtre dual (réduction / agrandissement)
  const brightMat = PM(`uniform sampler2D tSrc; uniform vec2 uTx; uniform float uThr; varying vec2 vUv;
void main() {
  vec3 c = (texture2D(tSrc, vUv + uTx * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTx * vec2(0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTx * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTx * vec2(0.5, 0.5)).rgb) * 0.25;
  float l = max(c.r, max(c.g, c.b)); float k = uThr * 0.5;
  float s = clamp(l - uThr + k, 0.0, 2.0 * k); s = s * s / (4.0 * k + 1e-4);
  gl_FragColor = vec4(min(c * max(s, l - uThr) / max(l, 1e-4), vec3(8.0)), 1.0);
}`, { tSrc: { value: null }, uTx: { value: new THREE.Vector2() }, uThr: { value: 1 } });
  const downMat = PM(`uniform sampler2D tSrc; uniform vec2 uTx; varying vec2 vUv;
void main() { vec3 s = texture2D(tSrc, vUv).rgb * 4.0 + texture2D(tSrc, vUv - uTx).rgb + texture2D(tSrc, vUv + uTx).rgb + texture2D(tSrc, vUv + vec2(uTx.x, -uTx.y)).rgb + texture2D(tSrc, vUv - vec2(uTx.x, -uTx.y)).rgb; gl_FragColor = vec4(s / 8.0, 1.0); }`,
  { tSrc: { value: null }, uTx: { value: new THREE.Vector2() } });
  const upMat = PM(`uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 uTx; varying vec2 vUv;
void main() {
  vec2 h = uTx;
  vec3 s = texture2D(tSrc, vUv + vec2(-2.0 * h.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(2.0 * h.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, 2.0 * h.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, -2.0 * h.y)).rgb
         + (texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb + texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb + texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb + texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb) * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
}`, { tSrc: { value: null }, tAdd: { value: null }, uTx: { value: new THREE.Vector2() } });

  // rayons de soleil : masque (ciel lumineux près de l'astre) puis flou radial vers l'astre
  const rayMaskMat = PM(`uniform sampler2D tSrc; uniform sampler2D tDepth; uniform vec2 uSun; uniform float uAsp; varying vec2 vUv;
void main() {
  float d = texture2D(tDepth, vUv).r;
  float sky = step(0.99999, d);
  vec2 v = vUv - uSun; v.x *= uAsp;
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = dot(c, vec3(0.3, 0.5, 0.2));
  float m = sky * clamp(l - 0.55, 0.0, 3.0) * exp(-length(v) * 4.0);
  gl_FragColor = vec4(vec3(m), 1.0);
}`, { tSrc: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2() }, uAsp: { value: 1 } });
  const rayBlurMat = PM(`uniform sampler2D tSrc; uniform vec2 uSun; uniform float uDens; uniform float uDecay; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 dl = (vUv - uSun) * uDens / float(SAMPLES);
  vec2 p = vUv - dl * hash(vUv * 917.0);
  float il = 1.0, s = 0.0;
  for (int i = 0; i < SAMPLES; i++) { p -= dl; s += SXTEX(tSrc, clamp(p, 0.001, 0.999)).r * il; il *= uDecay; }
  gl_FragColor = vec4(vec3(s / float(SAMPLES)), 1.0);
}`, { tSrc: { value: null }, uSun: { value: new THREE.Vector2() }, uDens: { value: 0.9 }, uDecay: { value: 0.97 } }, { SAMPLES: 32 });

  // occlusion ambiante écran (demi-résolution) + flou 4×4
  const aoMat = PM(`uniform sampler2D tDepth; uniform mat4 uPInv; uniform vec2 uTx; uniform float uScale; uniform float uRad; varying vec2 vUv;
vec3 vp(vec2 uv) { float d = texture2D(tDepth, uv).r; vec4 p = uPInv * vec4(vec3(uv, d) * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main() {
  float d = texture2D(tDepth, vUv).r;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = vp(vUv);
  vec3 a1 = vp(vUv + vec2(uTx.x, 0.0)) - P, a2 = P - vp(vUv - vec2(uTx.x, 0.0));
  vec3 b1 = vp(vUv + vec2(0.0, uTx.y)) - P, b2 = P - vp(vUv - vec2(0.0, uTx.y));
  vec3 N = normalize(cross(abs(a1.z) < abs(a2.z) ? a1 : a2, abs(b1.z) < abs(b2.z) ? b1 : b2));
  if (dot(N, P) > 0.0) N = -N;
  float rad = clamp(uRad * uScale / max(-P.z, 0.1), 2.0, 80.0);
  float an = hash(vUv * 1731.0) * 6.2831, occ = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float f = (float(i) + 0.5) / float(SAMPLES);
    float a = an + f * 15.0;
    vec2 off = vec2(cos(a), sin(a)) * rad * sqrt(f) * uTx;
    vec3 v = vp(vUv + off) - P;
    float vv = dot(v, v);
    occ += max(0.0, dot(v, N) - 0.03 * -P.z * 0.02) / (vv + 0.02) * (1.0 - smoothstep(uRad * uRad, uRad * uRad * 4.0, vv));
  }
  gl_FragColor = vec4(vec3(clamp(1.0 - occ * 0.9 / float(SAMPLES), 0.0, 1.0)), 1.0);
}`, { tDepth: { value: null }, uPInv: { value: new THREE.Matrix4() }, uTx: { value: new THREE.Vector2() }, uScale: { value: 400 }, uRad: { value: 0.9 } }, { SAMPLES: 8 });
  const aoBlurMat = PM(`uniform sampler2D tSrc; uniform vec2 uTx; varying vec2 vUv;
void main() { float s = 0.0; for (int j = -2; j < 2; j++) for (int i = -2; i < 2; i++) s += SXTEX(tSrc, vUv + (vec2(float(i), float(j)) + 0.5) * uTx).r; gl_FragColor = vec4(vec3(s / 16.0), 1.0); }`,
  { tSrc: { value: null }, uTx: { value: new THREE.Vector2() } });

  // composition finale : DoF, AO, bloom, rayons, exposition + tonemapping filmique, saturation, contraste, vignette
  const compMat = PM(`uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tBloom; uniform sampler2D tRays; uniform sampler2D tAO;
uniform vec2 uTx; uniform float uBloom; uniform vec3 uRayCol; uniform float uAO; uniform float uExp; uniform float uSat; uniform float uCon; uniform float uVig;
uniform float uNear; uniform float uFar; uniform float uDof; uniform float uTime; varying vec2 vUv;
float lin(float d) { return uNear * uFar / (uFar - d * (uFar - uNear)); }
// courbe filmique : léger pied (noirs plus denses) et épaule douce (les hautes lumières saturent sans se brûler)
vec3 filmic(vec3 x) {
  x = x * x / (x + 0.018) * 1.018;
  vec3 k = vec3(0.68);
  return mix(x, k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k))), step(k, x));
}
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
#ifdef DOF
  {
    float z = lin(texture2D(tDepth, vUv).r), zf = lin(texture2D(tDepth, vec2(0.5)).r);
    float coc = clamp((abs(z - zf) - zf * 0.3) / (zf * 2.5 + 16.0), 0.0, 1.0) * uDof;
    if (coc > 0.04) {
      vec3 s = c; float n = 1.0;
      for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996; float r = sqrt((float(i) + 0.5) / 12.0); s += SXTEX(tScene, vUv + vec2(cos(a), sin(a)) * r * coc * 5.0 * uTx).rgb; n += 1.0; }
      c = s / n;
    }
  }
#endif
#ifdef AO
  c *= mix(1.0, texture2D(tAO, vUv).r, uAO);
#endif
#ifdef BLOOM
  c += texture2D(tBloom, vUv).rgb * uBloom;
#endif
#ifdef RAYS
  c += texture2D(tRays, vUv).r * uRayCol;
#endif
  vec3 o = filmic(max(c, 0.0) * uExp);
  float y = dot(o, vec3(0.2126, 0.7152, 0.0722));
  o = mix(vec3(y), o, uSat);
  o = clamp(o, 0.0, 1.0);
  o = mix(o, o * o * (3.0 - 2.0 * o), clamp((uCon - 1.0) * 2.5, -1.0, 1.0));   // contraste en S : noir et blanc préservés
  vec2 q = vUv - 0.5; o *= 1.0 - uVig * dot(q, q) * 1.6;
  o += (fract(sin(dot(vUv * 731.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(o, 0.0, 1.0), 1.0);
}`, {
    tScene: { value: null }, tDepth: { value: null }, tBloom: { value: null }, tRays: { value: null }, tAO: { value: null },
    uTx: { value: new THREE.Vector2() }, uBloom: { value: 0.6 }, uRayCol: { value: new THREE.Vector3() }, uAO: { value: 0.6 }, uExp: { value: 1 }, uSat: { value: 1.1 }, uCon: { value: 1.05 }, uVig: { value: 0.25 },
    uNear: { value: 0.05 }, uFar: { value: 420 }, uDof: { value: 1 }, uTime: { value: 0 },
  });

  /* ---------- cibles de rendu (réallouées au redimensionnement) ---------- */
  const T = { w: 0, h: 0, scene: null, down: [], up: [], rayM: null, rayA: null, rayB: null, ao: null, aoB: null, key: '' };
  const HDR = hasHalf ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const mkRT = (w, h, type) => { const rt = new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: type || THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false }); rt.texture.generateMipmaps = false; return rt; };
  function freeTargets() {
    const all = [T.scene, T.rayM, T.rayA, T.rayB, T.ao, T.aoB].concat(T.down, T.up);
    for (const rt of all) if (rt) { if (rt.depthTexture) rt.depthTexture.dispose(); rt.dispose(); }
    T.scene = T.rayM = T.rayA = T.rayB = T.ao = T.aoB = null; T.down = []; T.up = []; T.key = '';
  }
  const dbs = new THREE.Vector2();
  function ensureTargets() {
    gl.getDrawingBufferSize(dbs);
    const w = dbs.x, h = dbs.y;
    const key = [w, h, S.bloom ? 'h' : 'b', S.bloom ? S.bloomLv : 0, S.rays ? (S.raySamples >= 56 ? 2 : 1) : 0, S.ao ? 1 : 0].join(',');
    if (key === T.key) return;
    freeTargets(); T.key = key; T.w = w; T.h = h;
    // HDR (demi-flottants) seulement si le bloom en a besoin ; sinon 8 bits, moins de bande passante (preset Bas)
    T.scene = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: S.bloom ? HDR : THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false });
    T.scene.texture.generateMipmaps = false;
    if (hasDepthTex) { T.scene.depthTexture = new THREE.DepthTexture(w, h); T.scene.depthTexture.type = THREE.UnsignedIntType; }
    if (S.bloom) for (let i = 0, d = 2; i < S.bloomLv; i++, d *= 2) { T.down.push(mkRT(w / d, h / d, HDR)); if (i < S.bloomLv - 1) T.up.push(mkRT(w / d, h / d, HDR)); }
    if (S.rays) { const d = S.raySamples >= 56 ? 2 : 4; T.rayM = mkRT(w / d, h / d); T.rayA = mkRT(w / d, h / d); T.rayB = mkRT(w / d, h / d); }
    if (S.ao) { T.ao = mkRT(w / 2, h / 2); T.aoB = mkRT(w / 2, h / 2); }
  }
  function setDefine(mat, name, on, val) {
    const had = mat.defines[name]; const want = on ? (val != null ? val : '') : undefined;
    if (had === want) return;
    if (on) mat.defines[name] = want; else delete mat.defines[name];
    mat.needsUpdate = true;
  }

  /* =====================================================================
     7. LUMIÈRE, CIEL ET RENDU PAR IMAGE
     ===================================================================== */
  const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3(), col = new THREE.Color(), col2 = new THREE.Color();
  const L = { s: 0, sunUp: 0, moonUp: 0, day: 1, sunset: 0, rayVis: 0, surface: true };
  const setV = (v, r, g, b) => v.set(r, g, b);
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function updateLight(G, under) {
    const surface = G.dim === 'surface';
    const ang = (G.time || 0) * Math.PI * 2;
    // direction du soleil : celle du sprite de renderer.js s'il existe, sinon la course d'origine
    if (surface && R.sun && R.sun.position && R.camera) sunDir.subVectors(R.sun.position, R.camera.position).normalize();
    else sunDir.set(Math.cos(ang), Math.sin(ang), 0.16).normalize();
    const s = surface ? sunDir.y : Math.sin(ang);
    const day = smooth(-0.1, 0.3, s), sunUp = smooth(-0.03, 0.1, s), moonUp = smooth(-0.03, 0.1, -s);
    const sunset = Math.exp(-Math.abs(s) * 5) * smooth(-0.35, 0.0, s);
    Object.assign(L, { s, day, sunUp, moonUp, sunset, surface });
    SU.sxSunDir.value.copy(sunDir); SU.sxMoonDir.value.copy(sunDir).negate();
    SU.sxTime.value = (performance.now() / 1000) % 3600; SU.sxWind.value = S.wind;
    SU.sxUnder.value = under ? 1 : 0; SU.sxReflStr.value = S.waterRefl; SU.sxGlowGain.value = hasHalf ? 1 + 0.6 * S.glow : 1.15;
    if (surface) {
      const warm = smooth(0.0, 0.55, s);
      const sc = lerp3([0.95, 0.5, 0.25], [0.64, 0.6, 0.52], warm);
      if (s >= 0) { lightDir.copy(sunDir); setV(SU.sxSunCol.value, sc[0] * sunUp, sc[1] * sunUp, sc[2] * sunUp); }
      else { lightDir.copy(sunDir).negate(); setV(SU.sxSunCol.value, 0.075 * moonUp, 0.095 * moonUp, 0.16 * moonUp); }
      SU.sxLightOn.value = (s >= 0 ? sunUp : moonUp) > 0.01 ? 1 : 0;
      let a = lerp3([0.05, 0.065, 0.12], [0.42, 0.46, 0.55], day);
      a = lerp3(a, [0.42, 0.36, 0.42], sunset * 0.45 * day);
      setV(SU.sxAmb.value, a[0], a[1], a[2]);
    } else {
      // les Braises : pas d'astre, lumière d'ambiance de la dimension (comme renderer.js)
      lightDir.set(0, 1, 0); SU.sxSunCol.value.set(0, 0, 0); SU.sxLightOn.value = 0;
      const u = R.uniforms, d = u && u.uDay ? u.uDay.value : 0.92, t = u && u.uTint ? u.uTint.value : col.setRGB(1, 1, 1);
      setV(SU.sxAmb.value, d * t.r, d * t.g, d * t.b);
    }
    SU.sxLightDir.value.copy(lightDir);
    // ciel : on part de la couleur choisie par renderer.js (scene.background) pour suivre sa palette
    const bg = R.scene.background && R.scene.background.isColor ? R.scene.background : (R.scene.fog ? R.scene.fog.color : col2.setRGB(0.5, 0.7, 1));
    col.copy(bg);
    const du = R.dome && R.dome.material && R.dome.material.uniforms;
    if (surface && du && du.uZenith && du.uHorizon) {
      // dôme de renderer.js : on reprend ses couleurs (brouillard et reflets assortis au ciel visible)
      const z = du.uZenith.value, h = du.uHorizon.value, f = du.uFogC ? du.uFogC.value : h;
      setV(SU.sxZen.value, z.r, z.g, z.b); setV(SU.sxHor.value, h.r, h.g, h.b); setV(SU.sxFogC.value, f.r, f.g, f.b);
      setV(SU.sxSunset.value, 0.5 * sunset, 0.22 * sunset, 0.1 * sunset);
    } else if (surface) {
      setV(SU.sxZen.value, col.r * (0.72 + 0.1 * (1 - day)), col.g * 0.84, col.b * 0.98);
      const hz = 0.42 * day;
      setV(SU.sxHor.value, col.r + (0.94 - col.r) * hz, col.g + (0.96 - col.g) * hz, col.b + (1.0 - col.b) * hz);
      setV(SU.sxFogC.value, SU.sxHor.value.x * 0.85, SU.sxHor.value.y * 0.85, SU.sxHor.value.z * 0.85);
      setV(SU.sxSunset.value, 1.0 * sunset * 0.75, 0.42 * sunset * 0.75, 0.2 * sunset * 0.75);
    }
    if (surface) {
      const gk = smooth(-0.25, 0.05, s), gw = smooth(0.0, 0.5, s);
      setV(SU.sxGlow.value, (1.0) * gk, (0.62 + 0.3 * gw) * gk, (0.35 + 0.5 * gw) * gk);
      setV(SU.sxMoonGlow.value, 0.18 * moonUp, 0.22 * moonUp, 0.34 * moonUp);
    } else {
      setV(SU.sxZen.value, col.r * 0.8, col.g * 0.8, col.b * 0.8); setV(SU.sxHor.value, col.r * 1.1, col.g * 1.05, col.b * 1.05); setV(SU.sxFogC.value, col.r, col.g, col.b);
      SU.sxSunset.value.set(0, 0, 0); SU.sxGlow.value.set(0, 0, 0); SU.sxMoonGlow.value.set(0, 0, 0);
    }
  }

  const fwd = new THREE.Vector3(), sp = new THREE.Vector3(), rotM = new THREE.Matrix4();
  let origRender = R.render, active = false, lastNow = performance.now(), fps = 0, fpsAcc = 0, fpsN = 0;
  function renderSX() {
    const G = VX.G;
    if (!G || !G.world || !G.player) return origRender.call(R);
    if (matsChanged()) patchMats();
    const now = performance.now();
    const under = G.player.eyeWater | 0;
    updateLight(G, under);
    const cam = R.camera, scene = R.scene;
    cam.updateMatrixWorld();
    SU.sxCam.value.setFromMatrixPosition(cam.matrixWorld);
    // ombres
    if (casc.length && L.surface && SU.sxLightOn.value > 0) renderShadows(lightDir);
    // scène dans une cible HDR, ciel atmosphérique en fond
    ensureTargets();
    const ac = gl.autoClear;
    const dome = R.dome && R.dome.visible;
    const useSky = S.sky && !under && !dome && scene.background && scene.background.isColor;
    if (useSky) {
      rotM.extractRotation(cam.matrixWorld);
      skyMat.uniforms.uRayM.value.multiplyMatrices(rotM, cam.projectionMatrixInverse);
      pass(skyMat, T.scene);
      if (scene.fog) { const h = SU.sxHor.value; scene.fog.color.setRGB(h.x, h.y, h.z); }
    }
    const bg = scene.background;
    gl.setRenderTarget(T.scene);
    if (useSky) { scene.background = null; gl.autoClear = false; }
    try { origRender.call(R); } finally { scene.background = bg; gl.autoClear = ac; }
    const W = T.w, H = T.h, tex = T.scene.texture, dtex = T.scene.depthTexture;
    // bloom
    let bloomTex = null;
    if (S.bloom && T.down.length) {
      brightMat.uniforms.tSrc.value = tex; brightMat.uniforms.uTx.value.set(1 / W, 1 / H); brightMat.uniforms.uThr.value = hasHalf ? 1.12 : 0.9;
      pass(brightMat, T.down[0]);
      for (let i = 1; i < T.down.length; i++) { const s = T.down[i - 1]; downMat.uniforms.tSrc.value = s.texture; downMat.uniforms.uTx.value.set(1 / s.width, 1 / s.height); pass(downMat, T.down[i]); }
      let src = T.down[T.down.length - 1];
      for (let i = T.up.length - 1; i >= 0; i--) { upMat.uniforms.tSrc.value = src.texture; upMat.uniforms.tAdd.value = T.down[i].texture; upMat.uniforms.uTx.value.set(0.5 / src.width, 0.5 / src.height); pass(upMat, T.up[i]); src = T.up[i]; }
      bloomTex = src.texture;
    }
    // rayons de soleil (ou de lune, plus discrets)
    let rays = 0;
    if (S.rays && T.rayM && dtex && L.surface && !under) {
      const isSun = L.s > -0.02, dir = isSun ? sunDir : SU.sxMoonDir.value;
      cam.getWorldDirection(fwd);
      const facing = smooth(0.0, 0.45, fwd.dot(dir));
      sp.copy(cam.position).addScaledVector(dir, 100).project(cam);
      const edge = 1 - smooth(0.9, 1.6, Math.max(Math.abs(sp.x), Math.abs(sp.y)));
      const k = (isSun ? smooth(-0.02, 0.1, L.s) * (0.75 + 0.5 * L.sunset) : 0.22 * L.moonUp) * facing * edge * S.rayStr;
      if (k > 0.002) {
        const su = new THREE.Vector2(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
        rayMaskMat.uniforms.tSrc.value = tex; rayMaskMat.uniforms.tDepth.value = dtex; rayMaskMat.uniforms.uSun.value.copy(su); rayMaskMat.uniforms.uAsp.value = W / H;
        pass(rayMaskMat, T.rayM);
        setDefine(rayBlurMat, 'SAMPLES', true, Math.min(64, S.raySamples) | 0);
        rayBlurMat.uniforms.tSrc.value = T.rayM.texture; rayBlurMat.uniforms.uSun.value.copy(su); rayBlurMat.uniforms.uDens.value = 0.92; rayBlurMat.uniforms.uDecay.value = 0.985;
        pass(rayBlurMat, T.rayA);
        rayBlurMat.uniforms.tSrc.value = T.rayA.texture; rayBlurMat.uniforms.uDens.value = 0.25; rayBlurMat.uniforms.uDecay.value = 0.995;
        pass(rayBlurMat, T.rayB);
        const c = SU.sxGlow.value, m = isSun ? 1 : 0.6;
        compMat.uniforms.uRayCol.value.set(c.x + (isSun ? 0 : 0.35), c.y + (isSun ? 0 : 0.42), c.z + (isSun ? 0 : 0.6)).multiplyScalar(k * m * 1.4);
        rays = 1;
      }
    }
    // occlusion ambiante
    if (S.ao && T.ao && dtex) {
      setDefine(aoMat, 'SAMPLES', true, S.aoSamples | 0);
      aoMat.uniforms.tDepth.value = dtex; aoMat.uniforms.uPInv.value.copy(cam.projectionMatrixInverse);
      aoMat.uniforms.uTx.value.set(2 / W, 2 / H); aoMat.uniforms.uScale.value = cam.projectionMatrix.elements[5] * 0.5 * (H / 2);
      pass(aoMat, T.ao);
      aoBlurMat.uniforms.tSrc.value = T.ao.texture; aoBlurMat.uniforms.uTx.value.set(2 / W, 2 / H);
      pass(aoBlurMat, T.aoB);
    }
    // composition vers l'écran
    const u = compMat.uniforms;
    setDefine(compMat, 'BLOOM', !!bloomTex); setDefine(compMat, 'RAYS', !!rays); setDefine(compMat, 'AO', !!(S.ao && T.aoB && dtex)); setDefine(compMat, 'DOF', !!(S.dof && dtex && !under));
    u.tScene.value = tex; u.tDepth.value = dtex; u.tBloom.value = bloomTex; u.tRays.value = rays ? T.rayB.texture : null; u.tAO.value = T.aoB ? T.aoB.texture : null;
    u.uTx.value.set(1 / W, 1 / H); u.uBloom.value = S.bloomStr * (under ? 0.6 : 1); u.uAO.value = S.aoStr; u.uExp.value = S.exposure;
    u.uSat.value = S.saturation; u.uCon.value = S.contrast; u.uVig.value = S.vignette; u.uNear.value = cam.near; u.uFar.value = cam.far; u.uDof.value = S.dofStr; u.uTime.value = (now % 1000) / 1000;
    pass(compMat, null);
  }

  /* ---------- activation / désactivation ---------- */
  function apply() {
    build();
    setupCascades();
    const k = computeKey();
    if (k !== compileKey) { compileKey = k; patchMats(); }
    if (S.on && !active) { if (R.render !== renderSX) origRender = R.render; R.render = renderSX; active = true; }
    else if (!S.on && active) { if (R.render === renderSX) R.render = origRender; active = false; freeTargets(); freeCascades(); SU.sxSM0.value = SU.sxSM1.value = null; }
    T.key = active ? T.key + '*' : '';   // force la réallocation si les effets ont changé
    shadowDirty = 99;
    if (panel) refreshPanel();
  }
  if (VX.hooks) {
    // images par seconde (affichées dans le panneau, y compris en mode Désactivé)
    VX.hooks.on('renderFrame', () => { const now = performance.now(); fpsAcc += now - lastNow; fpsN++; lastNow = now; if (fpsAcc > 500) { fps = fpsN * 1000 / fpsAcc; fpsAcc = 0; fpsN = 0; } });
    VX.hooks.on('worldSet', () => { shadowDirty = Math.max(shadowDirty, 1); });
    VX.hooks.on('dimensionChange', () => { shadowDirty = 99; });
  }

  /* =====================================================================
     8. PANNEAU DE RÉGLAGES (F7)
     ===================================================================== */
  let panel = null, panelWasMenu = null, fpsTimer = 0;
  const CSS = `
#sxPanel { position: fixed; right: 14px; top: 14px; z-index: 80; width: 330px; max-height: calc(100vh - 28px); overflow: auto; background: rgba(20,14,10,.94);
  color: #fff; font-family: 'Courier New', ui-monospace, monospace; font-size: 13px; padding: 10px 12px; box-shadow: inset 3px 3px 0 #6a5a4a, inset -3px -3px 0 #120a05, 0 6px 24px rgba(0,0,0,.5); user-select: none; }
#sxPanel h3 { margin: 0 0 6px; font-size: 20px; color: #ffd75a; text-shadow: 2px 2px 0 #6a3a10; letter-spacing: 2px; display: flex; justify-content: space-between; align-items: center; }
#sxPanel h3 small { font-size: 11px; color: #bbb; text-shadow: none; letter-spacing: 0; }
#sxPanel .sxp { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
#sxPanel button { font-family: inherit; font-size: 12px; font-weight: bold; color: #fff; background: #6f6f6f; border: 2px solid #000; box-shadow: inset 2px 2px 0 #aaa, inset -2px -2px 0 #444; padding: 5px 7px; cursor: pointer; }
#sxPanel button:hover { background: #7f8fbf; } #sxPanel button.on { background: #3f7a3f; box-shadow: inset 2px 2px 0 #8c8, inset -2px -2px 0 #232; }
#sxPanel .sxx { position: absolute; right: 8px; top: 8px; padding: 1px 7px; }
#sxPanel fieldset { border: 1px solid #5a4a3a; margin: 6px 0; padding: 4px 8px 6px; } #sxPanel legend { color: #ffd75a; padding: 0 4px; }
#sxPanel label { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 3px 0; }
#sxPanel input[type=range] { width: 130px; } #sxPanel select { font-family: inherit; background: #333; color: #fff; border: 1px solid #000; }
#sxPanel .sxv { width: 34px; text-align: right; color: #ffd75a; } #sxPanel .dis { opacity: .45; } #sxPanel .hint { font-size: 11px; color: #aaa; margin-top: 6px; }`;
  const CHECKS = [['shadows', 'Ombres dynamiques'], ['sky', 'Ciel atmosphérique'], ['bloom', 'Halo lumineux (bloom)'], ['rays', 'Rayons de soleil'], ['water', 'Eau réaliste'], ['waterHQ', 'Eau : reflet du soleil et scintillements'], ['wave', 'Végétation au vent'], ['ao', 'Occlusion ambiante'], ['dof', 'Profondeur de champ']];
  const SLIDERS = [['exposure', 'Exposition', 0.5, 1.8, 0.05], ['saturation', 'Saturation', 0.5, 1.6, 0.02], ['contrast', 'Contraste', 0.8, 1.3, 0.01], ['vignette', 'Vignette', 0, 0.8, 0.02],
    ['bloomStr', 'Intensité du halo', 0, 1.5, 0.05], ['rayStr', 'Intensité des rayons', 0, 1.5, 0.05], ['glow', 'Lueur des blocs', 0, 2, 0.05], ['waterRefl', 'Reflets de l\'eau', 0, 1, 0.05], ['aoStr', 'Force de l\'occlusion', 0, 1, 0.05], ['wind', 'Force du vent', 0, 2.5, 0.05]];
  const SELECTS = [['shadowRes', 'Résolution des ombres', [[1024, '1024'], [2048, '2048'], [3072, '3072'], [4096, '4096']]], ['shadowDist', 'Distance des ombres', [[24, '24 blocs'], [32, '32 blocs'], [48, '48 blocs'], [80, '80 blocs'], [112, '112 blocs']]],
    ['cascades', 'Cascades', [[1, '1'], [2, '2']]], ['pcf', 'Douceur des ombres', [[0, 'Nette'], [1, 'Douce'], [2, 'Très douce']]]];
  function setOpt(k, v) {
    if (preset === 'off') { preset = 'moyen'; over = {}; }
    const base = Object.assign({}, BASE, PRESETS[preset]);
    if (base[k] === v) delete over[k]; else over[k] = v;
    save(); apply();
  }
  function setPreset(p) { preset = p; over = {}; save(); apply(); }
  function buildPanel() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    panel = document.createElement('div'); panel.id = 'sxPanel';
    let h = '<h3>SHADERS <small id="sxFps"></small></h3><button class="sxx" data-close="1">✕</button><div class="sxp">';
    for (const p in NAMES) h += `<button data-preset="${p}">${NAMES[p]}</button>`;
    h += '</div><div id="sxCustom" class="hint"></div><fieldset><legend>Effets</legend>';
    for (const [k, n] of CHECKS) h += `<label data-row="${k}"><span>${n}</span><input type="checkbox" data-k="${k}"></label>`;
    h += '</fieldset><fieldset><legend>Ombres</legend>';
    for (const [k, n, opts] of SELECTS) h += `<label data-row="${k}"><span>${n}</span><select data-k="${k}">${opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>`;
    h += '</fieldset><fieldset><legend>Image</legend>';
    for (const [k, n, a, b, s] of SLIDERS) h += `<label data-row="${k}"><span>${n}</span><input type="range" min="${a}" max="${b}" step="${s}" data-k="${k}"><span class="sxv" data-v="${k}"></span></label>`;
    h += '</fieldset><div class="hint">F7 : ouvrir / fermer · Désactivé = rendu d\'origine · réglages sauvegardés</div>';
    panel.innerHTML = h;
    panel.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.close) closePanel(); else if (b.dataset.preset) setPreset(b.dataset.preset);
    });
    panel.addEventListener('change', e => {
      const k = e.target.dataset.k; if (!k) return;
      if (e.target.type === 'checkbox') setOpt(k, e.target.checked);
      else if (e.target.tagName === 'SELECT') setOpt(k, +e.target.value);
    });
    panel.addEventListener('input', e => { const k = e.target.dataset.k; if (k && e.target.type === 'range') { setOpt(k, +e.target.value); } });
    for (const ev of ['mousedown', 'mouseup', 'wheel', 'keydown', 'keyup']) panel.addEventListener(ev, e => { if (!(ev.startsWith('key') && e.code === 'F7')) e.stopPropagation(); });
    document.body.appendChild(panel);
    refreshPanel();
  }
  function refreshPanel() {
    if (!panel) return;
    panel.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('on', b.dataset.preset === preset));
    const n = Object.keys(over).length;
    panel.querySelector('#sxCustom').textContent = preset === 'off' ? 'Rendu d\'origine du jeu.' : `Preset ${NAMES[preset]}${n ? ' · personnalisé (' + n + ' réglage' + (n > 1 ? 's' : '') + ')' : ''}${hasHalf ? '' : ' · couleurs 8 bits'}`;
    panel.querySelectorAll('[data-k]').forEach(el => {
      const k = el.dataset.k, v = S[k];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
      const vv = panel.querySelector(`[data-v="${k}"]`); if (vv) vv.textContent = (+v).toFixed(2);
    });
    const dis = { wave: engineWave, shadows: !hasDepthTex, rays: !hasDepthTex, ao: !hasDepthTex, dof: !hasDepthTex };
    panel.querySelectorAll('[data-row]').forEach(r => r.classList.toggle('dis', !!dis[r.dataset.row] || !S.on));
    const wr = panel.querySelector('[data-row="wave"] span'); if (wr) wr.textContent = engineWave ? 'Végétation au vent (moteur)' : 'Végétation au vent';
  }
  function openPanel() {
    if (!panel) buildPanel();
    panel.style.display = 'block'; refreshPanel();
    const UI = VX.UI;
    panelWasMenu = UI ? UI.menuOpen || null : null;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    clearInterval(fpsTimer);
    fpsTimer = setInterval(() => { const el = document.getElementById('sxFps'); if (el) el.textContent = Math.round(fps) + ' i/s'; }, 500);
  }
  function closePanel() {
    if (!panel || panel.style.display === 'none') return;
    panel.style.display = 'none'; clearInterval(fpsTimer);
    // si l'ouverture du panneau a provoqué le menu Pause, on reprend la partie directement
    const UI = VX.UI;
    if (UI && !panelWasMenu && UI.menuOpen === 'pause') { UI.menu(null); if (VX.G && VX.G.relock) VX.G.relock(); }
  }
  const isOpen = () => !!(panel && panel.style.display !== 'none');
  document.addEventListener('keydown', e => {
    if (e.code === 'F7') { e.preventDefault(); e.stopPropagation(); if (isOpen()) closePanel(); else openPanel(); }
    else if (e.code === 'Escape' && isOpen()) { e.preventDefault(); e.stopImmediatePropagation(); closePanel(); }
  }, true);

  /* ---------- API publique ---------- */
  VX.Shaders = {
    openPanel, closePanel, toggle() { if (isOpen()) closePanel(); else openPanel(); },
    setPreset, set: setOpt, get preset() { return preset; }, get settings() { return Object.assign({}, S); },
    presets: Object.keys(NAMES), names: NAMES, _u: SU,   // _u : uniforms partagés (débogage)
    get fps() { return fps; }, get active() { return active; },
    info() { return { preset, active, webgl2: isGL2, halfFloat: hasHalf, depthTexture: hasDepthTex, engineWave, relight: relightOk, cascades: casc.map(c => ({ res: c.res, r: c.r })) }; },
  };
  apply();
})();

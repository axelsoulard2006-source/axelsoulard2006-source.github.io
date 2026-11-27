/* ===== city.js : LA VILLE DES JEUX — l'accueil du jeu global
   Une ville 3D partagée : on s'y promène avec son personnage, on voit les autres joueurs connectés (présence « city »),
   et chaque bâtiment ouvre un jeu : Stade (Bousculade), Tour jaune (Backrooms), Citadelle (Colosses : L'Ascension),
   Tour aux portes (Les Portes), Chantier (Blocaria). Au centre : fontaine et grand panneau (en ligne, salons, défis).
   ZQSD / flèches : marcher · Espace : sauter · Maj : courir · clic : aller là · glisser : caméra · molette : zoom
   E : entrer · 1-4 : émotes · Entrée : discuter
   Rendu : tout est procédural. Le décor statique est fusionné en quelques gros maillages (couleurs par sommet,
   attribut aGlow = lueur constante / lueur la nuit / balancement au vent) ; cycle jour-soir-nuit doux ;
   petites vies (pigeons, chiens, oiseaux, lucioles, feux d'artifice, confettis) ; caméra douce qui évite les bâtiments. ===== */
(function () {
  const BR = window.BR, Au = BR.Audio, Acc = BR.Account, V3 = THREE.Vector3;
  const C = (BR.City = {}); let V = null;
  const DEST = [
    { id: 'bousculade', name: 'BOUSCULADE', sub: 'Le Stade · party game jusqu\'à 8', col: '#ff4f9e', ang: 0, ico: '🏟️', pk: 'bousculade' },
    { id: 'backrooms', name: 'BACKROOMS', sub: 'La Tour jaune · survie à plusieurs', col: '#e8cf62', ang: 72, ico: '🔦', pk: 'backrooms' },
    { id: 'ascension', name: 'COLOSSES', sub: 'La Citadelle · L\'Ascension', col: '#ffb24a', ang: 144, ico: '⚔️', pk: 'colosses' },
    { id: 'portes', name: 'LES PORTES', sub: 'La Tour aux portes · défis', col: '#5fe08c', ang: 216, ico: '🚪', pk: 'portes' },
    { id: 'blocs', name: 'BLOCARIA', sub: 'Le Chantier · bac à sable', col: '#6cc04a', ang: 288, ico: '🧱', pk: 'blocs' },
  ];
  const RING = 50, PLAZA = 17, BOUND = 115, PROM = 29;
  const PIN = { bousculade: [21, -6], backrooms: [12.4, 6], ascension: [15.8, 9], portes: [16.6, 10], blocs: [10.4, 5.6] };   // repères flottants : [hauteur, z local] au-dessus des entrées
  DEST.forEach(d => { const a = d.ang * Math.PI / 180; d.dir = [Math.sin(a), -Math.cos(a)]; d.pos = [d.dir[0] * RING, d.dir[1] * RING]; d.door = [d.dir[0] * (RING - 13), d.dir[1] * (RING - 13)]; d.yaw = Math.atan2(-d.dir[0], -d.dir[1]); });
  const EMO = [{ e: 'Cheer', i: '🎉', n: 'Hourra' }, { e: 'Spellcast_Raise', i: '✨', n: 'Magie' }, { e: '2H_Melee_Attack_Spin', i: '🌀', n: 'Toupie' }, { e: 'Interact', i: '👋', n: 'Salut' }];
  const PAL = ['#ff4f9e', '#7a6cff', '#ffe14a', '#3fd0ff', '#5fe08c', '#ff8a3d'];
  function goGame(id) {
    if (id === 'blocs') { Au.ui('ok'); try { sessionStorage.setItem('city_back', 'blocs'); } catch (e) {} location.href = 'blocs/index.html'; return; }   // (page séparée : le retour devant le Chantier passe par sessionStorage)
    Au.ui('ok'); BR.ascMode = id === 'ascension';
    BR.UI.show(id === 'ascension' ? 'asc' : id === 'portes' ? 'portes' : id === 'bousculade' ? 'party' : 'main');
  }

  /* ---------- couleurs, outils ---------- */
  const LC = new Map();
  const lin = h => { if (h && h.isColor) return h; let c = LC.get(h); if (!c) { c = new THREE.Color(h).convertSRGBToLinear(); LC.set(h, c); } return c; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const kExp = (dt, k) => 1 - Math.exp(-dt * k);
  function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise2(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz); const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1); return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz; }
  // hauteur du terrain : plat dans la ville, collines tout autour
  const gh = (x, z) => { const r = Math.hypot(x, z); if (r < 122) return 0; const k = sstep(122, 330, r); return Math.pow(k, 1.3) * (34 + 26 * noise2(x * 0.012, z * 0.012)) + k * 6 * noise2(x * 0.05 + 7, z * 0.05); };
  function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function ctex(c, rep) { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = V.aniso; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } V.disp.push(t); return t; }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const FONT = '"Trebuchet MS", system-ui, sans-serif';
  const G = {
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    cyl: (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s || 10),
    cone: (r, h, s) => new THREE.ConeGeometry(r, h, s || 8),
    ico: (r, d) => new THREE.IcosahedronGeometry(r, d || 0),
    sph: (r, w, h) => new THREE.SphereGeometry(r, w || 8, h || 6),
    tor: (R, t, rs, ts, arc) => new THREE.TorusGeometry(R, t, rs || 6, ts || 16, arc),
  };

  /* ---------- le « kit » : fusion du décor statique ---------- */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3(), _v = new V3(), _n = new V3(), _c = new THREE.Color(), _n3 = new THREE.Matrix3();
  function lmat(x, y, z, o) {
    _e.set((o && o.rx) || 0, (o && o.ry) || 0, (o && o.rz) || 0, 'YXZ'); _q.setFromEuler(_e);
    const s = o && o.s; if (s == null) _s.set(1, 1, 1); else if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s);
  }
  // put(géométrie, couleur, x, y, z, { rx, ry, rz, s, m, glow:[constante, nuit], wave, jit, cf, shadow })
  function put(geo, col, x, y, z, o) { o = o || {}; const m = lmat(x, y, z, o); if (o.m) m.premultiply(o.m); m.premultiply(V.K.base); kAdd(geo, col, m, o); }
  function kBucket(x, z, sh) {
    const r = Math.hypot(x, z), far = r > 150, key = (far ? 'far' : Math.floor(x / 64) + ',' + Math.floor(z / 64)) + (sh ? 's' : 'n');
    let b = V.K.b.get(key); if (!b) { b = { pos: [], nor: [], col: [], gl: [], sh: sh && !far }; V.K.b.set(key, b); } return b;
  }
  function kAdd(geo, col, m, o) {
    const K = V.K, g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, n = g.attributes.normal, cnt = p.count;
    _n3.getNormalMatrix(m);
    const sh = o.shadow !== false, base = col == null ? null : lin(col), g0 = o.glow ? o.glow[0] : 0, g1 = o.glow ? o.glow[1] : 0, wf = typeof o.wave === 'function' ? o.wave : null, w0 = wf ? 0 : (o.wave || 0);
    let B = K.tmp;
    for (let i = 0; i < cnt; i++) {
      if (i % 3 === 0) {
        const j = o.jit ? 1 + (K.rnd() - 0.5) * 2 * o.jit : 1;
        if (o.cf) _c.copy(lin(o.cf((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3))); else _c.copy(base);
        _c.multiplyScalar(j);
        if (!K.tmp) { _v.fromBufferAttribute(p, i).applyMatrix4(m); B = kBucket(_v.x, _v.z, sh); }
      }
      _v.fromBufferAttribute(p, i); const lx = _v.x, ly = _v.y, lz = _v.z; _v.applyMatrix4(m);
      if (n) _n.fromBufferAttribute(n, i).applyMatrix3(_n3).normalize(); else _n.set(0, 1, 0);
      B.pos.push(_v.x, _v.y, _v.z); B.nor.push(_n.x, _n.y, _n.z); B.col.push(_c.r, _c.g, _c.b);
      B.gl.push(g0, g1, wf ? wf(lx, ly, lz) : w0);
    }
    if (g !== geo) g.dispose(); geo.dispose();
  }
  function kGeo(B) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(B.gl, 3));
    g.computeBoundingSphere(); V.disp.push(g); return g;
  }
  function kFlush() {
    for (const B of V.K.b.values()) { if (!B.pos.length) continue; const ms = new THREE.Mesh(kGeo(B), V.mat); ms.castShadow = B.sh && V.shadows; ms.receiveShadow = V.shadows; V.scene.add(ms); V.statics.push(ms); }
    V.K.b.clear();
  }
  // mini-kit : une géométrie fusionnée pour un objet animé (repère local)
  function kBegin() { V.K.saved = V.K.base; V.K.base = new THREE.Matrix4(); V.K.tmp = { pos: [], nor: [], col: [], gl: [] }; }
  function kEnd() { const g = kGeo(V.K.tmp); V.K.tmp = null; V.K.base = V.K.saved; return g; }
  function kMesh(geo, shadow) { const ms = new THREE.Mesh(geo, V.mat); ms.castShadow = !!shadow && V.shadows; ms.receiveShadow = false; return ms; }
  function baseOf(d) { return new THREE.Matrix4().makeRotationY(d.yaw).setPosition(d.pos[0], 0, d.pos[1]); }
  function wpt(d, lx, lz) { const c = Math.cos(d.yaw), s = Math.sin(d.yaw); return [d.pos[0] + lx * c + lz * s, d.pos[1] - lx * s + lz * c]; }
  function addCol(x, z, r, h, b) { V.colliders.push({ x, z, r, h: h || 0, b: b || null }); }
  // lueurs (points additifs) : alpha < 0 → seulement la nuit
  function glow(x, y, z, col, size, alpha) { _v.set(x, y, z).applyMatrix4(V.K.base); V.glows.push(_v.x, _v.y, _v.z, col, size, alpha); }

  /* ---------- matériaux ---------- */
  function mainMat() {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0, flatShading: true });
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = V.uTime; sh.uniforms.uNight = V.uNight;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aGlow;\nuniform float uTime;\nuniform float uNight;\nvarying vec3 vGlowC;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          if (aGlow.z > 0.0) { float ph = uTime * 1.6 + position.x * 0.23 + position.z * 0.19; float fl = sin(uTime * 5.5 + (position.x + position.z) * 1.4 + position.y * 0.8);
            transformed.x += (sin(ph) * 0.65 + fl * 0.35) * aGlow.z; transformed.z += (cos(ph * 0.8 + 1.3) * 0.65 + fl * 0.35) * aGlow.z * 0.8; transformed.y += fl * aGlow.z * 0.2; }
          #ifdef USE_COLOR
          vGlowC = color * (aGlow.x + aGlow.y * uNight);
          #else
          vGlowC = vec3(0.0);
          #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlowC;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlowC;');
    };
    V.disp.push(m); return m;
  }
  function std(col, o) { const m = new THREE.MeshStandardMaterial(Object.assign({ color: lin(col).clone(), roughness: 0.7, flatShading: true }, o || {})); V.disp.push(m); return m; }
  function pointMat(add, soft) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: V.uScale, uNight: V.uNight },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aCol; uniform float uScale; uniform float uNight; varying vec3 vC; varying float vA;
        void main(){ vC = aCol; vA = aAlpha < 0.0 ? -aAlpha * uNight : aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(aSize * uScale / max(0.5, -mv.z), 220.0); gl_Position = projectionMatrix * mv; if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = ${soft ? 'pow(1.0 - r, 1.7)' : 'smoothstep(1.0, 0.55, r)'}; gl_FragColor = vec4(vC, a * vA);
        #include <encodings_fragment>
        }`,
      transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, fog: false,
    });
    V.disp.push(m); return m;
  }
  function radialTex(inner) {
    const [c, g] = cvs(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(inner || 0.2, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return ctex(c);
  }
  // système de points (particules) générique
  function mkPts(n, add, soft) {
    const geo = new THREE.BufferGeometry(), P = { n, pos: new Float32Array(n * 3), col: new Float32Array(n * 3), size: new Float32Array(n), alpha: new Float32Array(n) };
    geo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(P.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(P.size, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(P.alpha, 1));
    P.geo = geo; P.pts = new THREE.Points(geo, pointMat(add, soft)); P.pts.frustumCulled = false; V.disp.push(geo); V.scene.add(P.pts);
    P.dirty = () => { for (const k of ['position', 'aCol', 'aSize', 'aAlpha']) geo.attributes[k].needsUpdate = true; };
    return P;
  }
  function mkPS(n, add) {
    const P = mkPts(n, add, add); Object.assign(P, { vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), s0: new Float32Array(n), grav: new Float32Array(n), drag: new Float32Array(n), kind: new Uint8Array(n), i: 0, live: 0 });
    return P;
  }
  function spawn(P, x, y, z, vx, vy, vz, c, s, life, grav, drag, kind) {
    const i = P.i; P.i = (P.i + 1) % P.n; const c3 = lin(c);
    P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z; P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
    P.col[i * 3] = c3.r; P.col[i * 3 + 1] = c3.g; P.col[i * 3 + 2] = c3.b; P.s0[i] = s; P.size[i] = s; P.life[i] = P.max[i] = life; P.grav[i] = grav; P.drag[i] = drag; P.kind[i] = kind || 0; P.alpha[i] = 1;
  }
  function stepPS(P, dt, onDie) {
    let live = 0;
    for (let i = 0; i < P.n; i++) {
      if (P.life[i] <= 0) { if (P.alpha[i]) P.alpha[i] = 0; continue; }
      live++; P.life[i] -= dt; const k = Math.max(0, 1 - P.drag[i] * dt), i3 = i * 3;
      P.vel[i3] *= k; P.vel[i3 + 1] = P.vel[i3 + 1] * k - P.grav[i] * dt; P.vel[i3 + 2] *= k;
      P.pos[i3] += P.vel[i3] * dt; P.pos[i3 + 1] += P.vel[i3 + 1] * dt; P.pos[i3 + 2] += P.vel[i3 + 2] * dt;
      const f = P.life[i] / P.max[i];
      if (P.kind[i] === 1) { P.alpha[i] = 1; P.size[i] = P.s0[i]; }
      else if (P.kind[i] === 2) { P.alpha[i] = Math.min(1, f * 3) * (0.75 + 0.25 * Math.sin(P.life[i] * 25 + i)); P.size[i] = P.s0[i]; }
      else { P.alpha[i] = Math.min(1, f * 2.2) * (f < 0.35 ? 0.55 + 0.45 * Math.sin(P.life[i] * 40 + i) : 1); P.size[i] = P.s0[i] * (0.55 + 0.45 * f); }
      if (P.life[i] <= 0) { P.alpha[i] = 0; if (onDie) onDie(i); }
    }
    P.live = live; if (live || P.wasLive) P.dirty(); P.wasLive = live > 0;
  }

  /* ---------- cycle de la journée ---------- */
  const TOD = [
    { t: 0.00, top: '#5d6fd0', hor: '#ffb090', fog: '#e8b4a6', sun: '#ffb27a', si: 1.0, hs: '#c9c3ff', hg: '#6a5a78', hi: 0.6, ni: 0.35, el: 4, ex: 1.0, cl: '#ffd0c0' },
    { t: 0.08, top: '#57a8ff', hor: '#ffe2c4', fog: '#f2e2d6', sun: '#ffe2b8', si: 1.6, hs: '#e2f0ff', hg: '#7d8a5c', hi: 0.62, ni: 0, el: 26, ex: 0.95, cl: '#fff4ec' },
    { t: 0.25, top: '#3c98ff', hor: '#c4ebff', fog: '#d2efff', sun: '#fff6e6', si: 1.8, hs: '#e8f6ff', hg: '#88a85e', hi: 0.62, ni: 0, el: 62, ex: 0.9, cl: '#ffffff' },
    { t: 0.45, top: '#4a9cff', hor: '#d8edff', fog: '#ddeeff', sun: '#fff0d6', si: 1.75, hs: '#eef4ff', hg: '#8aa45a', hi: 0.62, ni: 0, el: 42, ex: 0.9, cl: '#fffaf2' },
    { t: 0.55, top: '#5b8ae6', hor: '#ffd39a', fog: '#f8d8b8', sun: '#ffc27a', si: 1.7, hs: '#ffe9d4', hg: '#8a7a52', hi: 0.6, ni: 0, el: 17, ex: 0.95, cl: '#ffe6c8' },
    { t: 0.63, top: '#5257c4', hor: '#ff8f6e', fog: '#e8a094', sun: '#ff7f50', si: 1.3, hs: '#ffc2d6', hg: '#6a4a6a', hi: 0.6, ni: 0.35, el: 5, ex: 1.0, cl: '#ffb0a0' },
    { t: 0.71, top: '#26287a', hor: '#c0559c', fog: '#6c4a8c', sun: '#ff6f9a', si: 0.7, hs: '#a28cff', hg: '#3a2a5a', hi: 0.62, ni: 0.8, el: -4, ex: 1.1, cl: '#d08ac0' },
    { t: 0.80, top: '#0d1340', hor: '#33408e', fog: '#262c5e', sun: '#a8bcff', si: 0.6, hs: '#7078d8', hg: '#2a2242', hi: 0.7, ni: 1, el: -30, ex: 1.15, cl: '#5a64a8' },
    { t: 0.93, top: '#283a8e', hor: '#a070b0', fog: '#76689c', sun: '#c8a8ff', si: 0.65, hs: '#9090e8', hg: '#4a3a5a', hi: 0.62, ni: 0.7, el: -6, ex: 1.08, cl: '#c0a0d0' },
  ];
  TOD.push(Object.assign({}, TOD[0], { t: 1 }));
  const TODC = ['top', 'hor', 'fog', 'sun', 'hs', 'hg', 'cl'], TODN = ['si', 'hi', 'ni', 'el', 'ex'];
  function sampleTOD(ph, out) {
    let i = 0; while (i < TOD.length - 2 && ph >= TOD[i + 1].t) i++;
    const a = TOD[i], b = TOD[i + 1], k = sstep(0, 1, (ph - a.t) / (b.t - a.t));
    for (const c of TODC) out[c].copy(lin(a[c])).lerp(lin(b[c]), k);
    for (const n of TODN) out[n] = a[n] + (b[n] - a[n]) * k;
    return out;
  }
  function todName(ph) { return ph < 0.06 || ph >= 0.9 ? '🌄 Aube' : ph < 0.2 ? '🌤️ Matin' : ph < 0.5 ? '☀️ Journée' : ph < 0.6 ? '🌇 Fin d\'après-midi' : ph < 0.68 ? '🌅 Coucher de soleil' : '🌙 Nuit'; }
  const CYCLE = 840;   // secondes pour une journée entière

  /* ---------- textures peintes ---------- */
  function plazaTex() {
    const S = 1024, [c, g] = cvs(S, S), R = S / 2;
    g.fillStyle = '#d9c3a3'; g.fillRect(0, 0, S, S);
    const stones = ['#e4d0b2', '#dcc4a2', '#ead9c0', '#d4ba96', '#e0c8a6'], rr = BR.rngFrom(31);
    for (let r = 150; r < 470; r += 30) {
      const n = Math.floor(2 * Math.PI * r / 34), off = rr() * 6;
      for (let i = 0; i < n; i++) {
        const a0 = (i + off) / n * Math.PI * 2, a1 = (i + 1 + off) / n * Math.PI * 2;
        g.beginPath(); g.arc(R, R, r + 28, a0, a1); g.arc(R, R, r, a1, a0, true); g.closePath();
        g.fillStyle = stones[Math.floor(rr() * stones.length)]; g.fill(); g.lineWidth = 3; g.strokeStyle = '#bfa27e'; g.stroke();
      }
    }
    // étoile en mosaïque : une branche par jeu, vers son bâtiment
    DEST.forEach(d => {
      const a = Math.atan2(d.dir[1], d.dir[0]);
      const tip = [R + Math.cos(a) * 455, R + Math.sin(a) * 455], l = [R + Math.cos(a - 0.2) * 175, R + Math.sin(a - 0.2) * 175], r2 = [R + Math.cos(a + 0.2) * 175, R + Math.sin(a + 0.2) * 175];
      g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(tip[0], tip[1]); g.lineTo(r2[0], r2[1]); g.closePath(); g.fillStyle = d.col; g.globalAlpha = 0.8; g.fill(); g.globalAlpha = 1;
      g.lineWidth = 8; g.strokeStyle = '#fff8ec'; g.stroke();
      g.beginPath(); g.moveTo(R + Math.cos(a) * 190, R + Math.sin(a) * 190); g.lineTo(R + Math.cos(a) * 420, R + Math.sin(a) * 420); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
    });
    g.beginPath(); g.arc(R, R, 168, 0, Math.PI * 2); g.lineWidth = 14; g.strokeStyle = '#c9a982'; g.stroke();
    // bordure : petits carreaux colorés
    g.beginPath(); g.arc(R, R, 490, 0, Math.PI * 2); g.lineWidth = 44; g.strokeStyle = '#c9a982'; g.stroke();
    const nb = 110; for (let i = 0; i < nb; i++) { const a = i / nb * Math.PI * 2, x = R + Math.cos(a) * 490, y = R + Math.sin(a) * 490; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = i % 2 ? '#ff7ab8' : '#8d80ff'; g.fillRect(-9, -9, 18, 18); g.restore(); }
    return ctex(c);
  }
  function paveTex() {
    const [c, g] = cvs(256, 256), cols = ['#e2cbaa', '#d9bf9c', '#e8d4b8', '#d2b690', '#dec4a2'], rr = BR.rngFrom(12);
    g.fillStyle = '#bea486'; g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) for (let i = -1; i < 5; i++) { const x = i * 64 + (row % 2) * 32, y = row * 32; g.fillStyle = cols[Math.floor(rr() * cols.length)]; rrect(g, x + 2, y + 2, 60, 28, 5); g.fill(); }
    return ctex(c, [1, 1]);
  }
  function gravelTex() {
    const [c, g] = cvs(256, 256), rr = BR.rngFrom(5); g.fillStyle = '#e4d3b2'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { g.fillStyle = ['#d3bf9a', '#f0e3c8', '#c9b48e', '#ece0cc'][i % 4]; const s = 2 + rr() * 4; g.beginPath(); g.arc(rr() * 256, rr() * 256, s, 0, 7); g.fill(); }
    return ctex(c, [16, 16]);
  }
  function grassTex() {
    const [c, g] = cvs(256, 256), rr = BR.rngFrom(9); g.fillStyle = '#eef6e6'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const x = rr() * 256, y = rr() * 256, l = 4 + rr() * 8; g.strokeStyle = rr() < 0.5 ? 'rgba(80,120,40,0.16)' : 'rgba(255,255,230,0.3)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rr() - 0.5) * 4, y - l); g.stroke(); }
    return ctex(c, [100, 100]);
  }
  function waterTex() {
    const [c, g] = cvs(256, 256), rr = BR.rngFrom(3); const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#5ccfff'); gr.addColorStop(1, '#3aa8f0'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineCap = 'round';
    for (let i = 0; i < 46; i++) { g.lineWidth = 1.5 + rr() * 3; const x = rr() * 256, y = rr() * 256; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 20, y - 14, x + 40, y + 14, x + 60, y); g.stroke(); }
    return ctex(c, [2, 2]);
  }
  function towerTex() {   // façade de la Tour jaune : papier peint + fenêtres néon
    const [c, g] = cvs(256, 512), [ce, ge] = cvs(256, 512), rr = BR.rngFrom(44);
    g.fillStyle = '#e4cd6c'; g.fillRect(0, 0, 256, 512);
    for (let x = 0; x < 256; x += 16) { g.fillStyle = 'rgba(160,130,40,0.13)'; g.fillRect(x, 0, 6, 512); }
    for (let y = 0; y < 512; y += 24) for (let x = 8; x < 256; x += 32) { g.fillStyle = 'rgba(150,120,30,0.12)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 8); g.lineTo(x, y + 16); g.lineTo(x - 6, y + 8); g.fill(); }
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 512);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
      const x = 18 + col * 60, y = 22 + row * 62, w = 40, h = 40;
      g.fillStyle = '#7a6a2a'; g.fillRect(x - 4, y - 4, w + 8, h + 8); g.fillStyle = '#fff6c2'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 3, y + 3, 10, h - 6);
      g.fillStyle = '#7a6a2a'; g.fillRect(x + w / 2 - 2, y, 4, h);
      const on = rr(); ge.fillStyle = on < 0.18 ? '#141005' : on < 0.4 ? '#8a7f50' : '#fff4b8'; ge.fillRect(x, y, w, h);
    }
    return [ctex(c), ctex(ce)];
  }
  // enseigne lumineuse (texte néon sur panneau sombre)
  function neonSign(title, sub, col, w) {
    const [c, g] = cvs(1024, 300);
    rrect(g, 14, 14, 996, 272, 56); g.fillStyle = 'rgba(28,16,56,0.94)'; g.fill();
    g.shadowColor = col; g.shadowBlur = 26; g.lineWidth = 10; g.strokeStyle = col; g.stroke(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${title.length > 9 ? 118 : 132}px ${FONT}`;
    g.shadowBlur = 30; g.fillStyle = '#ffffff'; g.fillText(title, 512, 122); g.shadowBlur = 12; g.fillText(title, 512, 122);
    g.shadowBlur = 0; g.font = `700 44px ${FONT}`; g.fillStyle = '#ffe9a8'; g.fillText(sub, 512, 228);
    const t = ctex(c), m = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }), geo = new THREE.PlaneGeometry(w, w * 300 / 1024);
    V.disp.push(m, geo); return new THREE.Mesh(geo, m);
  }
  function pillTex(text, col, bg, fg) {
    const [c, g] = cvs(512, 112); g.font = `800 50px ${FONT}`; const tw = Math.min(470, g.measureText(text).width), w = tw + (col ? 78 : 48), x = (512 - w) / 2;
    rrect(g, x, 12, w, 88, 44); g.fillStyle = bg || 'rgba(26,14,52,0.8)'; g.fill();
    if (col) { g.fillStyle = col; g.beginPath(); g.arc(x + 38, 56, 14, 0, 7); g.fill(); }
    g.fillStyle = fg || '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, x + (col ? 62 : 24), 58, 470);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function label(text, col, bg, fg) {
    const t = pillTex(text, col, bg, fg), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    s.scale.set(2.4, 0.525, 1); s.userData.kill = () => { t.dispose(); s.material.dispose(); }; return s;
  }
  function markerTex(d, n) {
    const [c, g] = cvs(256, 320);
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 14; g.fillStyle = d.col; g.beginPath(); g.arc(128, 118, 96, 0, 7); g.fill(); g.shadowBlur = 0;
    g.lineWidth = 12; g.strokeStyle = '#fff'; g.stroke();
    g.beginPath(); g.moveTo(98, 205); g.lineTo(158, 205); g.lineTo(128, 246); g.closePath(); g.fillStyle = '#fff'; g.fill();
    g.font = `100px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.ico, 128, 124);
    if (n != null) { g.font = `900 40px ${FONT}`; const txt = n + (n > 1 ? ' joueurs' : ' joueur'), w = g.measureText(txt).width + 34; rrect(g, 128 - w / 2, 262, w, 52, 26); g.fillStyle = 'rgba(26,14,52,0.88)'; g.fill(); g.fillStyle = '#fff'; g.fillText(txt, 128, 290); }
    return c;
  }

  /* ---------- les bâtiments (repère local : la porte regarde +z, vers la place ; porte en z = 13) ---------- */
  const BUILD = {
    bousculade(d, g) {
      const tier = ['#ffe14a', '#3fd0ff', '#ff4f9e', '#7a6cff', '#5fe08c'];
      const prof = [[12.6, 0], [12.6, 7.2], [12.3, 7.6], [11.5, 7.6], [11.5, 6.3], [10.6, 6.3], [10.6, 5.2], [9.7, 5.2], [9.7, 4.1], [8.8, 4.1], [8.8, 3.0], [7.9, 3.0], [7.9, 1.9], [7.3, 1.3], [7.3, 0.5]];
      put(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 40), null, 0, 0, 0, { cf: (x, y, z) => { const r = Math.hypot(x, z); if (r > 12.45) return y < 1.0 ? '#b8336f' : y > 6.5 ? '#ffffff' : (Math.round(Math.atan2(x, z) / (Math.PI * 2) * 40 + 40) % 2 ? '#ff6fb0' : '#ff86c2'); if (y > 7.3) return '#7a6cff'; return tier[Math.floor(y / 1.1) % 5]; } });
      put(new THREE.CircleGeometry(7.35, 40), null, 0, 0.55, 0, { rx: -Math.PI / 2, shadow: false, cf: x => Math.floor((x + 20) / 1.47) % 2 ? '#4fc45c' : '#5fd36b' });
      put(G.tor(1.7, 0.07, 3, 32), '#ffffff', 0, 0.58, 0, { rx: Math.PI / 2, shadow: false }); put(G.box(14.4, 0.04, 0.14), '#ffffff', 0, 0.58, 0, { shadow: false });
      for (const sx of [-1, 1]) { put(G.box(0.14, 0.14, 2.8), '#ffffff', sx * 6.3, 1.7, 0); for (const sz of [-1, 1]) put(G.box(0.14, 1.2, 0.14), '#ffffff', sx * 6.3, 1.1, sz * 1.35); }
      for (let i = 0; i < 20; i++) { const a = (i + 0.5) / 20 * Math.PI * 2; if (Math.abs(BR.angDiff(a, 0)) < 0.4) continue; put(G.box(0.8, 6.9, 0.5), '#ffffff', Math.sin(a) * 12.75, 3.45, Math.cos(a) * 12.75, { ry: a }); }
      put(G.tor(12.4, 0.45, 5, 40), '#7a6cff', 0, 7.55, 0, { rx: Math.PI / 2 });
      for (let i = 0; i < 12; i++) {
        const a = (i + 0.5) / 12 * Math.PI * 2, px = Math.sin(a) * 12.2, pz = Math.cos(a) * 12.2;
        put(G.cyl(0.07, 0.07, 3.2, 5), '#ffffff', px, 9.2, pz); const fg = G.box(1.5, 0.9, 0.04); fg.translate(0.75, 0, 0);
        put(fg, tier[i % 5], px, 10.3, pz, { ry: a, wave: lx => lx * 0.16 });
      }
      // entrée : tunnel, lumière, arche de ballons
      put(G.box(6, 5.2, 1.8), '#ff6fb0', 0, 2.6, 10.5, { jit: 0.03 }); put(G.box(6.4, 0.4, 2.2), '#7a6cff', 0, 5.4, 10.5);
      put(G.box(3.8, 3.6, 0.2), '#2a1640', 0, 1.8, 11.45); put(G.box(3.8, 0.25, 0.22), '#fff1c4', 0, 3.75, 11.5, { glow: [0.7, 1.8] });
      for (let k = 0; k <= 16; k++) { const th = k / 16 * Math.PI; put(G.sph(0.5, 8, 6), PAL[k % 4], Math.cos(th) * 3.5, 0.45 + Math.sin(th) * 4.5, 12.1, { s: [1, 1.1, 1] }); }
      // écran géant au fond, projecteurs
      put(G.box(12.6, 7.4, 0.6), '#2a1f4a', 0, 14, -11.2); for (const sx of [-4.6, 4.6]) put(G.box(0.9, 10.5, 0.9), '#3d2f6b', sx, 5.3, -11.6);
      put(G.box(12.6, 0.3, 0.7), '#ff4f9e', 0, 10.15, -11.1, { glow: [1.0, 1.8] }); put(G.box(12.6, 0.3, 0.7), '#3fd0ff', 0, 17.85, -11.1, { glow: [1.0, 1.8] });
      const [sc, sg] = cvs(512, 288), st = ctex(sc); const scr = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 6.5), new THREE.MeshBasicMaterial({ map: st, toneMapped: false }));
      V.disp.push(scr.geometry, scr.material); scr.position.set(0, 14, -10.88); g.add(scr); V.scr = { c: sc, g: sg, t: st, next: 0 };
      for (const a of [0.78, -0.78, 2.36, -2.36]) {
        const px = Math.sin(a) * 14, pz = Math.cos(a) * 14;
        put(G.box(0.55, 18, 0.55), '#e6e1f5', px, 9, pz); put(G.box(1.6, 0.6, 1.6), '#9a92b8', px, 0.3, pz);
        for (let y = 3; y < 17; y += 3.5) put(G.box(0.12, 0.12, 1.4), '#c8c0e0', px, y, pz, { ry: a + 0.6 });
        const hm = lmat(px, 18.4, pz, { ry: a + Math.PI, rx: 0.42 });
        put(G.box(3.4, 2.2, 0.5), '#3d3560', 0, 0, 0, { m: hm }); put(G.box(3.0, 1.8, 0.1), '#fffbe6', 0, 0, 0.3, { m: hm, glow: [0.35, 2.4] });
        glow(px * 0.95, 18.4, pz * 0.95, '#fff6dc', 9, -0.9);
      }
      const sg2 = neonSign(d.name, d.sub, d.col, 10); sg2.position.set(0, 9.2, 12.98); g.add(sg2); put(G.box(10.3, 3.1, 0.2), '#1c1238', 0, 9.2, 12.85);
      // ballons qui rebondissent sur la pelouse
      V.balls = []; const bg = G.sph(0.6, 14, 10); V.disp.push(bg);
      [['#ffe14a', -3, 1.5], ['#3fd0ff', 2.5, -2], ['#ff4f9e', 0.5, 3]].forEach(([c, x, z], i) => { const b = new THREE.Mesh(bg, std(c, { roughness: 0.35, flatShading: false })); b.castShadow = V.shadows; b.position.set(x, 1, z); g.add(b); V.balls.push({ m: b, x, z, ph: i * 1.3 }); });
      V.stadium = new V3(d.pos[0], 10, d.pos[1]);
      addCol(d.pos[0], d.pos[1], 12.6, 8.5, d);
    },
    backrooms(d, g) {
      put(G.box(16.6, 0.4, 11.6), '#9b8a48', 0, 0.2, -0.5); put(G.box(16, 4.6, 11), '#d4bc5e', 0, 2.5, -0.5, { jit: 0.03 }); put(G.box(16.4, 0.5, 11.4), '#8a7a3a', 0, 5.05, -0.5);
      put(G.box(10, 3.3, 0.15), '#fff3b0', 0, 2.25, 5.05, { glow: [0.25, 1.3] });
      for (let x = -5; x <= 5; x += 2) put(G.box(0.18, 3.4, 0.25), '#5a4e26', x, 2.25, 5.1);
      put(G.box(2.4, 3.0, 0.3), '#3a3320', 0, 1.7, 5.15); put(G.box(1.2, 0.4, 0.1), '#5fe08c', 0, 3.55, 5.25, { glow: [0.8, 1.5] });
      put(G.box(11, 0.25, 2.2), null, 0, 4.25, 6.15, { rx: -0.18, cf: x => Math.floor((x + 20) / 1.1) % 2 ? '#ffe14a' : '#3a3320' });
      const [tm, te] = towerTex(), tmat = new THREE.MeshStandardMaterial({ map: tm, emissiveMap: te, emissive: lin('#fff2a0').clone(), emissiveIntensity: 0.4, roughness: 0.8 });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(12.5, 22, 8.5), tmat); V.disp.push(tower.geometry, tmat); tower.position.set(0, 5.3 + 11, -1.5); tower.castShadow = V.shadows; tower.receiveShadow = V.shadows; g.add(tower); V.towerMat = tmat;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(G.box(0.6, 22.2, 0.6), '#b8a24c', sx * 6.25, 16.3, -1.5 + sz * 4.25);
      for (let k = 1; k <= 3; k++) put(G.box(12.8, 0.3, 8.8), '#c6ad52', 0, 5.3 + k * 5.5, -1.5);
      put(G.box(10, 3, 6.5), '#d9c062', 0, 28.8, -1.5); put(G.box(10.25, 0.32, 6.75), '#fff27a', 0, 29.6, -1.5, { glow: [1.0, 2.4] }); put(G.box(10.6, 0.4, 7.1), '#8a7a3a', 0, 30.5, -1.5);
      for (const [x, z] of [[-3, -3], [-1, -3.4], [3.2, 0.6]]) put(G.box(1.6, 1, 1.2), '#a8a49a', x, 31.2, z);
      put(G.cyl(1, 1, 1.8, 10), '#a09a8a', 2.6, 31.8, -3); put(G.cyl(0.1, 0.18, 6, 5), '#6a6a70', -2.5, 33.6, -1.5);
      const bl = new THREE.Mesh(G.sph(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: lin('#ff3a3a').clone(), toneMapped: false })); V.disp.push(bl.geometry, bl.material); bl.position.set(-2.5, 36.7, -1.5); g.add(bl); V.blinks.push({ m: bl, ph: 0 });
      for (const x of [-4.2, 4.2]) for (const s of [-1, 1]) put(G.box(0.55, 0.85, 0.04), '#ffe14a', x + s * 0.0, 0.42, 7.4 + s * 0.17, { rx: s * 0.28 });
      for (const x of [-6.8, 6.8]) { put(G.cyl(0.45, 0.35, 0.7, 8), '#8a6a4a', x, 0.35, 6); put(G.ico(0.7, 0), '#4fae3a', x, 1.1, 6, { jit: 0.08, wave: 0.03 }); }
      const sg = neonSign(d.name, d.sub, d.col, 11.5); sg.position.set(0, 7.0, 4.3); g.add(sg); put(G.box(11.7, 3.5, 0.2), '#1c1238', 0, 7.0, 4.15); V.flkSign = sg.material;
      glow(0, 2.2, 5.6, '#fff1b0', 6, -0.7); glow(0, 29.6, 2, '#fff27a', 8, 0.35);
      addCol(d.pos[0], d.pos[1], 10.8, 31, d);
    },
    ascension(d, g) {
      const stone = '#aaa296', dark = '#8f877b', roof = '#e0602a';
      put(G.box(12, 12, 9), stone, 0, 6, -4, { jit: 0.05 });
      const merl = (x0, x1, y, z, along) => { for (let t = x0; t <= x1 + 0.01; t += 1.6) put(G.box(0.9, 1, 0.9), stone, along ? t : z, y, along ? z : t, { jit: 0.05 }); };
      merl(-5.6, 5.6, 12.5, 0.1, true); merl(-5.6, 5.6, 12.5, -8.1, true); merl(-6.5, -0.5, 12.5, -5.6, false); merl(-6.5, -0.5, 12.5, 5.6, false);
      for (const [x, z] of [[-6.6, -8.6], [6.6, -8.6], [-6.6, 0.4], [6.6, 0.4]]) {
        put(G.cyl(2.2, 2.4, 15.5, 10), '#9f978a', x, 7.75, z, { jit: 0.05 }); put(G.tor(2.35, 0.25, 4, 12), dark, x, 15.5, z, { rx: Math.PI / 2 });
        put(G.cone(2.9, 5, 10), roof, x, 18.3, z, { jit: 0.04 }); put(G.cyl(0.06, 0.06, 2.2, 5), '#5a4030', x, 21.8, z);
        const fg = G.box(1.2, 0.7, 0.04); fg.translate(0.6, 0, 0); put(fg, '#ffe14a', x, 22.5, z, { wave: lx => lx * 0.2 });
        for (const y of [6, 11]) put(G.box(0.35, 1.2, 0.1), '#ffb860', x, y, z + 2.32, { glow: [0, 1.3] });
      }
      for (const x of [-6.6, 6.6]) { const bn = G.box(1.6, 5, 0.06); bn.translate(0, -2.5, 0); put(bn, null, x, 13.6, 2.85, { wave: (lx, ly) => -ly * 0.03, cf: (cx, cy) => cy < -4.4 || Math.abs(cx) > 0.62 ? '#ffe14a' : Math.abs(cx) + Math.abs(cy + 2.3) < 0.5 ? '#ffe14a' : '#ff9a2a' }); }
      // rempart, châtelet et porte
      for (const s of [-1, 1]) {
        put(G.box(4.8, 6.2, 1.6), '#a59d90', s * 7.1, 3.1, 6.4, { jit: 0.05 }); merl(5.2, 9.2, 6.7, 6.4, true); merl(-9.2, -5.2, 6.7, 6.4, true);
        put(G.box(3, 9, 3), '#a29a8d', s * 3.2, 4.5, 6.6, { jit: 0.05 });
        for (const a of [-1, 1]) for (const b of [-1, 1]) put(G.box(0.9, 0.9, 0.9), stone, s * 3.2 + a * 1.05, 9.45, 6.6 + b * 1.05);
        put(G.box(0.15, 0.6, 0.15), '#3a2a1a', s * 2.3, 3.4, 8.2); put(G.cyl(0.26, 0.12, 0.3, 6), '#3a2a1a', s * 2.3, 3.8, 8.25);
        glow(s * 2.3, 4.3, 8.3, '#ffb24a', 3.2, 0.55);
      }
      put(G.box(3.4, 4, 3), '#9b9387', 0, 7, 6.6, { jit: 0.04 }); put(G.tor(1.7, 0.3, 6, 12, Math.PI), dark, 0, 5, 8.12);
      put(G.box(3.4, 5, 0.2), '#ffb24a', 0, 2.5, 5.3, { glow: [0.5, 1.5] });
      for (let x = -1.4; x <= 1.41; x += 0.56) put(G.box(0.12, 1.6, 0.12), '#3a2a1a', x, 4.2, 7.9); for (const y of [3.6, 4.6]) put(G.box(3.2, 0.12, 0.12), '#3a2a1a', 0, y, 7.9);
      put(G.cyl(1.1, 1.1, 0.2, 16), '#ffb24a', 0, 7.4, 8.15, { rx: Math.PI / 2 }); put(G.cyl(0.8, 0.8, 0.22, 16), '#ffe14a', 0, 7.4, 8.2, { rx: Math.PI / 2 });
      for (const r of [-0.78, 0.78]) put(G.box(0.14, 1.6, 0.08), '#e8e8f0', 0, 7.4, 8.33, { rz: r });
      // donjon
      put(G.cyl(3, 3.3, 10, 12), '#a39b8e', 0, 17, -4, { jit: 0.05 }); put(G.tor(3.15, 0.3, 4, 14), dark, 0, 22, -4, { rx: Math.PI / 2 });
      put(G.cone(3.9, 6.5, 12), roof, 0, 25.4, -4, { jit: 0.04 }); put(G.cyl(0.08, 0.08, 3, 5), '#5a4030', 0, 30, -4);
      const bf = G.box(2.4, 1.3, 0.05); bf.translate(1.2, 0, 0); put(bf, '#ffb24a', 0, 30.8, -4, { wave: lx => lx * 0.18 });
      for (const y of [16, 19.5]) put(G.box(0.4, 1.3, 0.1), '#ffb860', 0, y, -0.85, { glow: [0, 1.3] });
      // flammes des torches
      V.fires = []; const fgeo = G.cone(0.22, 0.75, 6), fm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.75, 0.2), toneMapped: false }); V.disp.push(fgeo, fm);
      for (const s of [-1, 1]) { const f = new THREE.Mesh(fgeo, fm); f.position.set(s * 2.3, 4.3, 8.25); g.add(f); V.fires.push(f); }
      const sg = neonSign(d.name, d.sub, d.col, 9.5); sg.position.set(0, 11.2, 8.45); g.add(sg); put(G.box(9.7, 2.95, 0.2), '#1c1238', 0, 11.2, 8.3); put(G.box(0.3, 1.6, 0.3), '#3a2a1a', 0, 9.3, 8.1);
      addCol(d.pos[0], d.pos[1], 11.8, 13, d);
    },
    portes(d, g) {
      put(G.cyl(8.4, 8.6, 0.3, 20), '#c4b8ea', 0, 0.15, 0); put(G.cyl(7.6, 8.0, 0.8, 20), '#d7cff2', 0, 0.4, 0, { jit: 0.03 });
      put(G.cyl(5.3, 5.7, 27, 18), null, 0, 14.3, 0, { cf: (x, y) => Math.floor((y + 13.5) / 3) % 2 ? '#f3eefc' : '#e6dcfb' });
      [[9, '#ff4f9e'], [16.3, '#3fd0ff'], [23.6, '#ffe14a']].forEach(([y, c]) => put(G.tor(5.5, 0.22, 4, 24), c, 0, y, 0, { rx: Math.PI / 2, glow: [0.2, 0.9] }));
      for (let k = 0; k < 10; k++) { const a = k * 0.9 + 0.4, y = 3.5 + k * 2.3, r = 5.62 - y * 0.012; put(G.box(0.6, 0.9, 0.1), PAL[k % 6], Math.sin(a) * r, y, Math.cos(a) * r, { ry: a, glow: [0.15, 1.2] }); }
      put(G.tor(6.2, 0.35, 5, 24), '#3fb86a', 0, 27.9, 0, { rx: Math.PI / 2 }); put(G.cone(6.9, 7.5, 18), '#5fe08c', 0, 31.6, 0, { jit: 0.03 }); put(G.cyl(0.15, 0.15, 2.6, 6), '#ffe14a', 0, 36.4, 0);
      // entrée
      put(G.box(3.2, 4.4, 0.6), '#5fe08c', 0, 3.0, 5.75, { glow: [0.35, 1.2] }); put(G.box(2.4, 3.8, 0.3), '#7a6cff', 0, 2.7, 6.0); put(G.sph(0.14, 6, 4), '#ffe14a', 0.8, 2.6, 6.2);
      put(G.box(3.8, 0.4, 1.2), '#c4b8ea', 0, 0.2, 8.4);
      // anneaux de portes qui tournent
      V.rings = [];
      [5.2, 12.6, 20].forEach((y, ri) => {
        kBegin();
        put(G.tor(7.0, 0.16, 4, 48), '#ffe14a', 0, -1.45, 0, { rx: Math.PI / 2, glow: [0.25, 1] });
        for (let k = 0; k < 4; k++) put(G.box(1.7, 0.2, 0.2), '#d9cff7', Math.sin(k * Math.PI / 2) * 6.3, -1.45, Math.cos(k * Math.PI / 2) * 6.3, { ry: k * Math.PI / 2 + Math.PI / 2 });
        const n = 9;
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2, M2 = lmat(Math.sin(a) * 7.15, 0, Math.cos(a) * 7.15, { ry: a });
          put(G.box(1.6, 2.6, 0.22), '#ffffff', 0, 0, 0, { m: M2 }); put(G.box(1.25, 2.25, 0.3), PAL[(k + ri * 2) % 6], 0, -0.05, 0.02, { m: M2 });
          put(G.sph(0.09, 5, 4), '#ffe14a', 0.42, -0.1, 0.2, { m: M2 }); put(G.sph(0.12, 5, 4), '#fff6c2', 0, 1.5, 0.05, { m: M2, glow: [0.3, 1.6] });
        }
        const ms = kMesh(kEnd(), true); ms.position.y = y; g.add(ms); V.rings.push({ m: ms, s: (ri % 2 ? -1 : 1) * (0.22 + ri * 0.05) });
      });
      // portes volantes qui s'ouvrent sur un portail
      V.flyDoors = [];
      [[9.5, 0.3], [15.6, 2.4], [22.6, 4.4]].forEach(([y, ph], k) => {
        const grp = new THREE.Group(); kBegin(); put(G.box(1.8, 2.9, 0.25), '#ffffff', 0, 0, 0); put(G.box(1.4, 2.5, 0.05), '#bff7ff', 0, 0, -0.06, { glow: [1.2, 1.6] }); const fr = kMesh(kEnd(), false); grp.add(fr);
        const hinge = new THREE.Group(); hinge.position.set(-0.7, 0, 0.12); kBegin(); put(G.box(1.4, 2.5, 0.12), PAL[k * 2], 0.7, 0, 0); put(G.sph(0.08, 5, 4), '#ffe14a', 1.2, -0.1, 0.08); hinge.add(kMesh(kEnd(), false)); grp.add(hinge);
        g.add(grp); V.flyDoors.push({ g: grp, h: hinge, y, ph, r: 10.4 });
      });
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), std('#7affb0', { emissive: lin('#2fe07a').clone(), emissiveIntensity: 1.4, roughness: 0.3 })); V.disp.push(cr.geometry); cr.position.set(0, 38.8, 0); g.add(cr); V.crystal = cr;
      glow(0, 38.8, 0, '#7affb0', 9, 0.55);
      const sg = neonSign(d.name, d.sub, d.col, 10); sg.position.set(0, 9.1, 9.0); g.add(sg); put(G.box(10.2, 3.1, 0.2), '#1c1238', 0, 9.1, 8.85);
      for (const y of [8.2, 10.0]) for (const x of [-3, 3]) put(G.box(0.25, 0.25, 3.5), '#c4b8ea', x, y, 7.1);
      addCol(d.pos[0], d.pos[1], 8.9, 28, d);
    },
    blocs(d, g) {
      const grass = '#6cc04a', dirt = '#8a5a33', stone = '#8b8b90', ores = ['#3fd0ff', '#ffe14a', '#ff4f9e'], rr = BR.rngFrom(5);
      put(G.box(22, 0.05, 30), '#c49a66', 0, 0.03, -2, { jit: 0.05, shadow: false });
      let top = [];
      for (let cx = -5; cx <= 5; cx++) for (let cz = -5; cz <= 5; cz++) {
        const rad = Math.hypot(cx, cz); if (rad > 4.7) continue;
        const h = Math.max(1, Math.round(4.4 - rad * 0.75 + (Math.sin(cx * 1.7 + cz) + 1) * 0.9)), x = cx * 2, z = cz * 2 - 7;
        for (let y = 0; y < h; y++) {
          if (y === h - 1) { put(G.box(1.98, 0.5, 1.98), grass, x, y * 2 + 1.74, z, { jit: 0.06 }); put(G.box(1.98, 1.48, 1.98), dirt, x, y * 2 + 0.74, z, { jit: 0.05 }); }
          else if (y > h - 3) put(G.box(1.98, 1.98, 1.98), dirt, x, y * 2 + 1, z, { jit: 0.06 });
          else { const ore = rr() < 0.14; put(G.box(1.98, 1.98, 1.98), ore ? ores[Math.floor(rr() * 3)] : stone, x, y * 2 + 1, z, { jit: 0.07, glow: ore ? [0.12, 0.8] : null }); }
        }
        if (rad < 2.5) top.push([x, h * 2, z]);
      }
      top.sort((a, b) => b[1] - a[1]); top = [top[0], top[3]].filter(Boolean);
      for (const [x, y, z] of top) { put(G.box(0.9, 3, 0.9), '#8a5a33', x, y + 1.5, z); put(G.box(3, 2, 3), '#4fae3a', x, y + 3.6, z, { jit: 0.07, wave: 0.03 }); put(G.box(1.8, 1.2, 1.8), '#5cc04a', x, y + 5.1, z, { jit: 0.07, wave: 0.03 }); }
      // grue : mât en treillis
      const CX = 8, CZ = 3;
      put(G.box(3, 1, 3), '#9a9aa6', CX, 0.5, CZ);
      for (const a of [-1, 1]) for (const b of [-1, 1]) put(G.box(0.22, 20, 0.22), '#ffb13d', CX + a * 0.6, 11, CZ + b * 0.6);
      for (let y = 2; y < 21; y += 2.5) for (const s of [-1, 1]) { put(G.box(1.4, 0.14, 0.14), '#ffb13d', CX, y, CZ + s * 0.6); put(G.box(0.14, 0.14, 1.4), '#ffb13d', CX + s * 0.6, y, CZ); if (y < 19) { put(G.box(0.1, 2.77, 0.1), '#e89a2a', CX, y + 1.25, CZ + s * 0.6, { rz: s * 0.45 }); put(G.box(0.1, 2.77, 0.1), '#e89a2a', CX + s * 0.6, y + 1.25, CZ, { rx: s * 0.45 }); } }
      const crane = new THREE.Group(); crane.position.set(CX, 21, CZ); g.add(crane);
      kBegin();
      put(G.cyl(0.9, 0.9, 0.4, 10), '#555560', 0, 0, 0); put(G.box(1.7, 1.5, 1.7), '#ffe14a', 0, 0.95, 1.2); put(G.box(1.2, 0.6, 0.05), '#bfe8ff', 0, 1.1, 2.07, { glow: [0.1, 0.9] });
      put(G.cone(0.9, 3.2, 4), '#ffb13d', 0, 2.0, 0, { ry: Math.PI / 4 }); put(G.box(15, 0.9, 0.9), '#ffb13d', 7.9, 0.8, 0, { jit: 0.03 }); put(G.box(5, 0.7, 0.9), '#ffb13d', -2.9, 0.8, 0);
      put(G.box(1.6, 1.8, 1.4), '#8b8b90', -4.7, 0.2, 0, { jit: 0.05 });
      put(G.box(14.3, 0.08, 0.08), '#555', 7.0, 2.4, 0, { rz: Math.atan2(-2.2, 14) }); put(G.box(5.1, 0.08, 0.08), '#555', -2.3, 2.45, 0, { rz: Math.atan2(2.3, 4.5) });
      for (let x = 1; x < 15; x += 1.2) put(G.box(0.08, 0.8, 0.08), '#d98a1a', x, 0.8, 0.46, { rz: 0.6 });
      crane.add(kMesh(kEnd(), true));
      const trolley = new THREE.Group(); crane.add(trolley);
      kBegin(); put(G.box(1, 0.4, 1), '#555560', 0, 0.2, 0); trolley.add(kMesh(kEnd(), false));
      const cableG = G.box(0.06, 1, 0.06); cableG.translate(0, -0.5, 0); const cable = new THREE.Mesh(cableG, std('#333333')); V.disp.push(cableG); trolley.add(cable);
      kBegin(); put(G.box(1.6, 1.6, 1.6), '#3fa6ff', 0, -0.8, 0, { jit: 0.06, glow: [0.1, 0.6] }); put(G.box(0.3, 0.3, 0.3), '#555', 0, 0.15, 0); const hook = kMesh(kEnd(), true); trolley.add(hook);
      const bl = new THREE.Mesh(G.sph(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.15, 0.1), toneMapped: false })); V.disp.push(bl.geometry, bl.material); bl.position.set(15.2, 1.4, 0); crane.add(bl); V.blinks.push({ m: bl, ph: 0.5 });
      V.crane = { g: crane, tr: trolley, cable, hook };
      // barrières, cônes, piles de blocs
      for (const [x, z, r] of [[-6.5, 8.6, 0.2], [-3.6, 9.4, 0.05], [6.2, 9, -0.15]]) {
        const M2 = lmat(x, 0, z, { ry: r }); put(G.box(2.4, 0.4, 0.1), null, 0, 0.9, 0, { m: M2, cf: (cx, cy) => Math.floor((cx + cy + 5) / 0.4) % 2 ? '#ff4040' : '#ffffff' });
        for (const s of [-1, 1]) put(G.box(0.1, 1.0, 0.1), '#555560', s * 1.0, 0.5, 0, { m: M2 });
      }
      for (const [x, z] of [[-4.8, 10.8], [-2.6, 11.2], [3.4, 10.6], [4.6, 11.6], [8.6, 8.2], [-8.4, 7.8]]) { put(G.cone(0.32, 0.85, 8), '#ff7a2a', x, 0.43, z); put(G.cyl(0.22, 0.25, 0.14, 8), '#ffffff', x, 0.5, z); put(G.box(0.7, 0.06, 0.7), '#ff7a2a', x, 0.03, z); }
      [[-8, 4], [-8.8, 2.8], [-7, 2.9], [-7.9, 3.5]].forEach(([x, z], i) => put(G.box(1.2, 1.2, 1.2), PAL[i % 6], x, i === 3 ? 1.8 : 0.6, z, { jit: 0.05, ry: i * 0.3 }));
      for (let k = 0; k < 4; k++) put(G.box(3, 0.25, 0.6), '#c8935a', 5.2, 0.15 + k * 0.27, 6 + (k % 2) * 0.1, { ry: 0.1 * k });
      const sg = neonSign(d.name, d.sub, d.col, 10); sg.position.set(0, 5.0, 5.6); g.add(sg); put(G.box(10.2, 3.1, 0.2), '#3a2a1a', 0, 5.0, 5.45);
      for (const x of [-3.6, 3.6]) put(G.box(0.35, 3.6, 0.35), '#8a5a33', x, 1.8, 5.35);
      const [hx, hz] = wpt(d, 0, -7), [cx2, cz2] = wpt(d, CX, CZ), [sx1, sz1] = wpt(d, 0, 5.4);
      addCol(hx, hz, 10.3, 13, d); addCol(cx2, cz2, 2.1, 22, d); addCol(sx1, sz1, 1.2, 0, null);
      const [lx2, lz2] = wpt(d, -3.6, 5.4), [rx2, rz2] = wpt(d, 3.6, 5.4); addCol(lx2, lz2, 0.4); addCol(rx2, rz2, 0.4);
    },
  };

  /* ---------- petits éléments de décor ---------- */
  function tree(x, z, kind, s, rr) {
    const y0 = gh(x, z);
    if (kind === 0) {
      const h = (1.6 + rr() * 1.2) * s, gc = [['#4fae3a', '#5cc04a'], ['#3f9a3a', '#52b043'], ['#6cc04a', '#7fd05a']][Math.floor(rr() * 3)];
      put(G.cyl(0.18 * s, 0.3 * s, h, 6), '#8a5a33', x, y0 + h / 2, z, { jit: 0.05 });
      for (let k = 0; k < 3; k++) put(G.ico(1.45 * s * (0.8 + rr() * 0.35), 0), gc[k % 2], x + (rr() - 0.5) * 1.5 * s, y0 + h + 0.9 * s + rr() * 0.9 * s, z + (rr() - 0.5) * 1.5 * s, { jit: 0.08, wave: 0.05 * s, rx: rr() * 3, ry: rr() * 3 });
    } else if (kind === 1) {
      put(G.cyl(0.18 * s, 0.25 * s, 1.2 * s, 6), '#7a4a2a', x, y0 + 0.6 * s, z);
      for (let k = 0; k < 3; k++) put(G.cone((2.0 - k * 0.5) * s, 2.3 * s, 7), k % 2 ? '#2f8a5a' : '#3a9a62', x, y0 + (1.9 + k * 1.25) * s, z, { jit: 0.06, wave: 0.03 * s, ry: rr() * 3 });
    } else if (kind === 2) {
      const h = (1.8 + rr()) * s, lean = (rr() - 0.5) * 0.3;
      put(G.cyl(0.16 * s, 0.28 * s, h, 6), '#7a4a3a', x, y0 + h / 2, z, { rz: lean });
      for (let k = 0; k < 4; k++) put(G.ico(1.2 * s * (0.75 + rr() * 0.4), 0), ['#ff9ccf', '#ffb6da', '#ff86c0'][k % 3], x - lean * h * 0.5 + (rr() - 0.5) * 1.8 * s, y0 + h + 0.6 * s + rr() * 0.9 * s, z + (rr() - 0.5) * 1.8 * s, { jit: 0.07, wave: 0.05 * s, rx: rr() * 3 });
    } else {
      const h = (2.2 + rr() * 0.8) * s; put(G.cyl(0.12 * s, 0.16 * s, h, 6), '#6a4a3a', x, y0 + h / 2, z);
      put(G.ico(1.3 * s, 1), ['#ff7ab8', '#8d80ff', '#ffd84a', '#5fd0ff'][Math.floor(rr() * 4)], x, y0 + h + 1.0 * s, z, { jit: 0.05, wave: 0.04 * s });
    }
    if (Math.hypot(x, z) < BOUND + 2) addCol(x, z, 0.55 * s);
  }
  function lamp(x, z) {
    put(G.cyl(0.3, 0.36, 0.4, 8), '#3d2f6b', x, 0.2, z); put(G.cyl(0.1, 0.15, 4.4, 6), '#3d2f6b', x, 2.4, z);
    put(G.cyl(0.34, 0.22, 0.55, 6), '#3d2f6b', x, 4.75, z); put(G.ico(0.27, 0), '#fff1c4', x, 4.45, z, { glow: [0.12, 2.4] }); put(G.cone(0.48, 0.38, 6), '#ff4f9e', x, 5.2, z);
    glow(x, 4.45, z, '#ffd890', 3.4, -0.85); addCol(x, z, 0.35);
    return [x, 4.9, z];
  }
  function bunting(a, b, sag) {
    const n = Math.max(4, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.9)), pt = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
    for (let i = 0; i < n; i++) { const p0 = pt(i / n), p1 = pt((i + 1) / n); V.ropes.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]); }
    const ry = Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2;
    for (let i = 1; i < n; i++) { const p = pt(i / n), tri = G.cone(0.26, 0.55, 3); tri.rotateX(Math.PI); tri.scale(1, 1, 0.15); put(tri, PAL[i % 6], p[0], p[1] - 0.28, p[2], { ry, wave: 0.07, shadow: false }); }
  }
  function bench(x, z, ry) {
    const M2 = lmat(x, 0, z, { ry });
    for (const k of [-0.2, 0, 0.2]) put(G.box(2.4, 0.09, 0.18), '#c07d42', 0, 0.55, k, { m: M2 });
    for (const k of [0.75, 0.98]) put(G.box(2.4, 0.16, 0.06), '#c07d42', 0, k, -0.32, { m: M2, rx: -0.12 });
    for (const s of [-1, 1]) { put(G.box(0.1, 0.55, 0.5), '#3d2f6b', s * 1.0, 0.27, 0, { m: M2 }); put(G.box(0.08, 0.6, 0.08), '#3d2f6b', s * 1.0, 0.82, -0.32, { m: M2 }); }
  }

  /* ---------- construction de la ville ---------- */
  function build() {
    const S = V.scene, q = V.q, low = q === 'low', rr = BR.rngFrom(77);
    V.K = { b: new Map(), tmp: null, base: new THREE.Matrix4(), rnd: BR.rngFrom(991) };
    V.mat = mainMat();
    // lumières
    V.hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 0.85); S.add(V.hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.5); sun.castShadow = V.shadows;
    const sz = q === 'high' ? 52 : 42; Object.assign(sun.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 1, far: 260 }); sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    S.add(sun); S.add(sun.target); V.sun = sun; V.shTexel = sz * 2 / sun.shadow.mapSize.x;
    S.fog = new THREE.Fog(0xd2efff, 150, 560);
    // ciel (dôme à couleurs par sommet), soleil, lune, étoiles
    const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 40, 20), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(sky.geometry.attributes.position.count * 3), 3)); sky.renderOrder = -10; sky.frustumCulled = false;
    V.disp.push(sky.geometry, sky.material); S.add(sky); V.sky = sky;
    const rt = radialTex(0.15);
    V.sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: rt, color: 0xffffff, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, toneMapped: false, transparent: true })); V.sunS.scale.set(90, 90, 1); V.sunS.renderOrder = -9; S.add(V.sunS);
    V.moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(0.42), color: 0xdfe6ff, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, toneMapped: false, transparent: true })); V.moonS.scale.set(34, 34, 1); V.moonS.renderOrder = -9; S.add(V.moonS);
    V.disp.push(V.sunS.material, V.moonS.material);
    { const n = low ? 220 : 500, sp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rr() * Math.PI * 2, y = 0.08 + rr() * 0.92, r = Math.sqrt(1 - y * y); sp.set([Math.cos(a) * r * 420, y * 420, Math.sin(a) * r * 420], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); const sm = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false, toneMapped: false });
      V.stars = new THREE.Points(sg, sm); V.stars.renderOrder = -8; V.stars.frustumCulled = false; V.disp.push(sg, sm); S.add(V.stars); }
    // nuages (une seule géométrie qui tourne lentement)
    kBegin();
    for (let i = 0; i < (low ? 12 : 20); i++) {
      const a = rr() * Math.PI * 2, r = 170 + rr() * 170, y = 70 + rr() * 50, cx = Math.cos(a) * r, cz = Math.sin(a) * r, n = 4 + Math.floor(rr() * 4), w = 9 + rr() * 8;
      for (let k = 0; k < n; k++) put(G.ico(w * (0.55 + rr() * 0.5), 1), '#ffffff', cx + (k - n / 2) * w * 0.7, y + rr() * w * 0.3, cz + (rr() - 0.5) * w * 0.8, { s: [1, 0.62, 1] });
    }
    V.cloudMat = std('#ffffff', { roughness: 1, fog: false, emissive: lin('#ffffff').clone(), emissiveIntensity: 0.35 });
    V.clouds = new THREE.Mesh(kEnd(), V.cloudMat); V.clouds.frustumCulled = false; S.add(V.clouds);
    // le sol : vallée verte, collines tout autour
    { const pg = new THREE.PlaneGeometry(1000, 1000, 100, 100); pg.rotateX(-Math.PI / 2); const pa = pg.attributes.position, cl = new Float32Array(pa.count * 3);
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), z = pa.getZ(i), y = gh(x, z); pa.setY(i, y);
        const n1 = noise2(x * 0.03, z * 0.03), n2 = noise2(x * 0.11 + 3, z * 0.11), k = sstep(150, 420, Math.hypot(x, z));
        _c.copy(lin('#5aa843')).lerp(lin('#7cc455'), n1).lerp(lin('#4a983c'), n2 * 0.5).lerp(lin('#a2cc56'), Math.max(0, n1 - 0.62) * 1.6).lerp(lin('#6d9e5a'), k * 0.6);
        cl.set([_c.r, _c.g, _c.b], i * 3);
      }
      pg.setAttribute('color', new THREE.BufferAttribute(cl, 3)); pg.computeVertexNormals();
      const gm = new THREE.MeshStandardMaterial({ map: grassTex(), vertexColors: true, roughness: 1 }), gr = new THREE.Mesh(pg, gm); gr.receiveShadow = V.shadows; S.add(gr); V.disp.push(pg, gm); }
    // place pavée, promenade circulaire, boulevards
    const flat = (geo, tex, y, off) => { const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -off }), ms = new THREE.Mesh(geo, m); ms.rotation.x = -Math.PI / 2; ms.position.y = y; ms.receiveShadow = V.shadows; S.add(ms); V.disp.push(geo, m); return ms; };
    flat(new THREE.CircleGeometry(PLAZA, 72), plazaTex(), 0.05, 4);
    flat(new THREE.RingGeometry(PROM - 1.5, PROM + 1.5, 120, 1), gravelTex(), 0.03, 2);
    const pave = paveTex();
    DEST.forEach(d => {
      const a0 = PLAZA - 0.5, a1 = RING - 13 + 2.6, len = a1 - a0, pg = new THREE.PlaneGeometry(6.6, len), uv = pg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * len / 3.3);
      const ms = flat(pg, pave, 0.04, 3), mid = (a0 + a1) / 2; ms.position.set(d.dir[0] * mid, 0.04, d.dir[1] * mid);
      ms.rotation.order = 'YXZ'; ms.rotation.set(-Math.PI / 2, d.yaw, 0);
      // liseré coloré et plots lumineux qui guident vers le jeu
      V.K.base = new THREE.Matrix4().makeRotationY(d.yaw).setPosition(d.dir[0] * mid, 0, d.dir[1] * mid);
      for (const s of [-1, 1]) put(G.box(0.3, 0.14, len), '#d8c4a6', s * 3.45, 0.07, 0, { shadow: false });
      for (let z = -len / 2 + 1.5; z < len / 2 - 0.5; z += 2.2) put(G.box(0.36, 0.06, 0.9), d.col, 0, 0.06, z, { glow: [0.15, 1.6], shadow: false });
      V.K.base = new THREE.Matrix4();
      // réverbères le long du boulevard, guirlandes en travers
      for (let k = 6; k < len - 2; k += 9) {
        const p = PLAZA + k, tops = [];
        for (const sd of [-1, 1]) tops.push(lamp(d.dir[0] * p + Math.cos(d.yaw) * sd * 4.4, d.dir[1] * p - Math.sin(d.yaw) * sd * 4.4));
        bunting(tops[0], tops[1], 1.1);
      }
      // poteau indicateur au bord de la place
      const sp = PLAZA - 1.2, sx = d.dir[0] * sp + Math.cos(d.yaw) * 4.3, sz2 = d.dir[1] * sp - Math.sin(d.yaw) * 4.3;
      put(G.cyl(0.09, 0.11, 3.2, 6), '#8a6238', sx, 1.6, sz2); addCol(sx, sz2, 0.3);
      const [c2, g2] = cvs(512, 128); rrect(g2, 6, 6, 500, 116, 30); g2.fillStyle = d.col; g2.fill(); g2.lineWidth = 8; g2.strokeStyle = '#fff'; g2.stroke();
      g2.font = `60px "Segoe UI Emoji", sans-serif`; g2.textBaseline = 'middle'; g2.fillText(d.ico, 28, 68); g2.font = `900 54px ${FONT}`; g2.fillStyle = '#fff'; g2.strokeStyle = 'rgba(30,15,60,0.6)'; g2.lineWidth = 6; g2.strokeText(d.name, 110, 68, 380); g2.fillText(d.name, 110, 68, 380);
      const pm = new THREE.MeshBasicMaterial({ map: ctex(c2), toneMapped: false }), pgeo = new THREE.PlaneGeometry(3, 0.75); V.disp.push(pm, pgeo);
      for (const f of [0, Math.PI]) { const pl = new THREE.Mesh(pgeo, pm); pl.position.set(sx, 2.9, sz2); pl.rotation.y = d.yaw + Math.PI + f; pl.translateZ(0.02); S.add(pl); }
      // le bâtiment
      const g = new THREE.Group(); g.position.set(d.pos[0], 0, d.pos[1]); g.rotation.y = d.yaw; S.add(g); V.K.base = baseOf(d); BUILD[d.id](d, g); V.K.base = new THREE.Matrix4();
      // la porte : anneau au sol, colonne de lumière, repère flottant
      const pad = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.4, 40), new THREE.MeshBasicMaterial({ color: lin(d.col).clone(), transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false })); pad.rotation.x = -Math.PI / 2; pad.position.set(d.door[0], 0.09, d.door[1]);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), new THREE.MeshBasicMaterial({ color: lin(d.col).clone(), transparent: true, opacity: 0.28, toneMapped: false, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.set(d.door[0], 0.08, d.door[1]);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.2, 7, 24, 1, true), new THREE.MeshBasicMaterial({ map: V.beamTex, color: lin(d.col).clone(), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
      beam.position.set(d.door[0], 3.5, d.door[1]); S.add(pad, disc, beam); V.disp.push(pad.geometry, pad.material, disc.geometry, disc.material, beam.geometry, beam.material);
      const mc = markerTex(d, null), mt = ctex(mc), mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, depthWrite: false, toneMapped: false })); { const [px, pz] = wpt(d, 0, PIN[d.id][1]); mk.scale.set(3.2, 4, 1); mk.position.set(px, PIN[d.id][0], pz); } S.add(mk); V.disp.push(mk.material);
      V.pads.push({ m: pad, disc, beam, mk, mt, d, n: null });
    });
    // place : bordure, réverbères en anneau et guirlandes, bancs, jardinières, marchand de glaces
    put(G.tor(PLAZA, 0.28, 4, 72), '#d8c7ac', 0, 0.06, 0, { rx: Math.PI / 2, shadow: false });
    const ringTops = [];
    DEST.forEach((d, k) => { for (const off of [19, 53]) { const a = (d.ang + off) * Math.PI / 180; ringTops.push(lamp(Math.sin(a) * (PLAZA - 0.6), -Math.cos(a) * (PLAZA - 0.6))); } });
    for (let i = 0; i < ringTops.length; i++) bunting(ringTops[i], ringTops[(i + 1) % ringTops.length], 1.0);
    DEST.forEach((d, k) => {
      const am = (d.ang + 36) * Math.PI / 180, bx = Math.sin(am), bz = -Math.cos(am);
      if (k === 3) return;   // le grand panneau est dans ce secteur
      if (k === 1) { cart(bx * 13.4, bz * 13.4, Math.atan2(-bx, -bz)); return; }
      if (k !== 2) { bench(bx * 14.6, bz * 14.6, Math.atan2(-bx, -bz)); addCol(bx * 14.6, bz * 14.6, 1.2); }
      for (const s of [-1, 1]) { const a2 = am + s * 0.2, px = Math.sin(a2) * 14.2, pz = -Math.cos(a2) * 14.2; put(G.cyl(0.95, 0.8, 0.6, 10), '#e7dcf5', px, 0.3, pz); put(G.cyl(0.85, 0.85, 0.1, 10), '#6a4a3a', px, 0.58, pz); put(G.ico(0.55, 0), '#4fae3a', px, 0.95, pz, { jit: 0.08, wave: 0.03 }); for (let f = 0; f < 6; f++) { const fa = f / 6 * Math.PI * 2; put(G.ico(0.14, 0), PAL[(f + k) % 6], px + Math.cos(fa) * 0.6, 0.74, pz + Math.sin(fa) * 0.6); } addCol(px, pz, 0.95); }
      if (k === 0) V.catAt = [bx * 14.6 + Math.cos(am) * 0.6, 0.62, bz * 14.6 + Math.sin(am) * 0.6, Math.atan2(-bx, -bz)];
    });
    // fontaine
    fountain();
    // le grand panneau (en ligne, salons, défis)
    {
      const B = new THREE.Matrix4().makeRotationY(0.75).setPosition(-10.5, 0, 6); V.K.base = B;
      for (const x of [-3.8, 3.8]) { put(G.cyl(0.18, 0.22, 7.2, 8), '#3d2f6b', x, 3.6, -0.05); put(G.cyl(0.4, 0.45, 0.4, 8), '#3d2f6b', x, 0.2, -0.05); }
      put(G.box(8.4, 5.5, 0.3), '#3d2f6b', 0, 4.3, -0.12); put(G.box(9, 0.4, 1.0), '#ff4f9e', 0, 7.25, 0); put(G.box(9.2, 0.2, 1.2), '#7a6cff', 0, 7.5, 0);
      for (let i = 0; i < 9; i++) { put(G.ico(0.12, 0), '#fff1c4', -4 + i, 7.0, 0.5, { glow: [0.4, 2] }); glow(-4 + i, 7.0, 0.6, '#ffd890', 1.6, -0.6); }
      for (let i = 0; i < 5; i++) put(G.sph(0.45, 8, 6), PAL[i], -4.4 + (i % 2) * 0.5, 7.9 + i * 0.35, 0.3 + (i % 3) * 0.2, { s: [1, 1.15, 1] });
      V.boardT = { c: null }; const [bc, bg2] = cvs(1024, 640); V.boardT = { c: bc, g: bg2, t: ctex(bc) };
      const bp = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 4.875), new THREE.MeshBasicMaterial({ map: V.boardT.t, toneMapped: false })); V.disp.push(bp.geometry, bp.material);
      bp.position.set(-10.5, 4.3, 6); bp.rotation.y = 0.75; bp.translateZ(0.05); S.add(bp);
      V.K.base = new THREE.Matrix4();
      V.colliders.push({ x: 0, z: 0, r: 4.9, h: 0 }, { x: -10.5 - 2.6, z: 6 + 2.6, r: 0.4 }, { x: -10.5 + 2.6, z: 6 - 2.6, r: 0.4 });
      glow(-10.5 + Math.sin(0.75) * 1.5, 4.3, 6 + Math.cos(0.75) * 1.5, '#8d80ff', 9, -0.35);
    }
    // nature : arbres, buissons, fleurs, herbes, rochers
    const free = (x, z, m) => {
      const r = Math.hypot(x, z); if (r < PLAZA + 3 + m || Math.abs(r - PROM) < 2.4 + m) return false;
      for (const d of DEST) { if (Math.hypot(x - d.pos[0], z - d.pos[1]) < 16.5 + m) return false; const t = x * d.dir[0] + z * d.dir[1], o = Math.abs(x * d.dir[1] - z * d.dir[0]); if (t > 0 && t < RING - 8 && o < 6 + m) return false; }
      return true;
    };
    let placed = 0, tries = 0; const NT = low ? 70 : q === 'med' ? 120 : 160;
    while (placed < NT && tries++ < 4000) {
      const a = rr() * Math.PI * 2, r = 21 + Math.sqrt(rr()) * 92, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!free(x, z, 0.8)) continue;
      if (V.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 2.2)) continue;
      const kr = rr(), kind = r < 45 && kr < 0.22 ? 3 : kr < 0.45 ? 0 : kr < 0.72 ? 1 : kr < 0.9 ? 2 : 0;
      tree(x, z, kind, 0.85 + rr() * 0.5, rr); placed++;
    }
    for (let i = 0; i < (low ? 40 : 90); i++) { const a = rr() * Math.PI * 2, r = 20 + rr() * 92, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!free(x, z, 0)) continue; const s = 0.7 + rr() * 0.6; put(G.ico(0.8 * s, 0), ['#4fae3a', '#5cc04a', '#3f9a3a'][i % 3], x, 0.45 * s, z, { s: [1.3, 0.8, 1.3], jit: 0.08, wave: 0.02, ry: rr() * 3 }); if (rr() < 0.5) for (let f = 0; f < 4; f++) put(G.ico(0.12, 0), PAL[(i + f) % 6], x + (rr() - 0.5) * 1.6 * s, 0.75 * s, z + (rr() - 0.5) * 1.6 * s, { shadow: false }); }
    const flowers = (cx, cz, n, spread) => { for (let f = 0; f < n; f++) { const x = cx + (rr() - 0.5) * spread, z = cz + (rr() - 0.5) * spread, c = PAL[Math.floor(rr() * 6)]; put(G.cone(0.07, 0.32, 3), '#4f9a3a', x, 0.16, z, { shadow: false, wave: 0.02 }); put(G.ico(0.11, 0), c === '#5fe08c' ? '#ffffff' : c, x, 0.36, z, { shadow: false, wave: 0.02 }); } };
    for (let i = 0; i < (low ? 30 : 70); i++) { const a = rr() * Math.PI * 2, r = i % 3 === 0 ? PROM + (rr() < 0.5 ? -2.6 : 2.6) : 20 + rr() * 90, x = Math.cos(a) * r, z = Math.sin(a) * r; if (i % 3 !== 0 && !free(x, z, 0)) continue; flowers(x, z, 4 + Math.floor(rr() * 6), 1.8); }
    if (!low) for (let i = 0; i < (q === 'high' ? 700 : 380); i++) { const a = rr() * Math.PI * 2, r = 19 + rr() * 98, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!free(x, z, -0.5)) continue; const s = 0.7 + rr() * 0.7; put(G.cone(0.17 * s, 0.55 * s, 3, 1, true), ['#5aa846', '#6cc04a', '#4f9a3a'][i % 3], x, 0.25 * s, z, { shadow: false, wave: 0.05, jit: 0.1, ry: rr() * 3 }); }
    for (let i = 0; i < (low ? 14 : 34); i++) { const a = rr() * Math.PI * 2, r = 22 + rr() * 90, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!free(x, z, 0)) continue; const s = 0.5 + rr() * 0.9; put(G.ico(0.7 * s, 0), ['#a7a3b8', '#9a96a8', '#b6b0c6'][i % 3], x, 0.2 * s, z, { s: [1.2, 0.7, 1], jit: 0.1, rx: rr(), ry: rr() * 3 }); if (s > 0.9) addCol(x, z, 0.7 * s); }
    // forêt et montagnes à l'horizon
    for (let i = 0; i < (low ? 130 : 280); i++) { const a = rr() * Math.PI * 2, r = 121 + rr() * 75, x = Math.cos(a) * r, z = Math.sin(a) * r, y = gh(x, z), s = 1.6 + rr() * 1.6; put(G.cone(2.0 * s, 5 * s, 6), ['#2f8a5a', '#3a9a62', '#4a9a4a', '#2a7a50'][i % 4], x, y + 2.3 * s, z, { jit: 0.07, shadow: false, ry: rr() * 3 }); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + rr() * 0.3, r = 400 + rr() * 60, h = 90 + rr() * 80; put(G.cone(70 + rr() * 40, h, 7), null, Math.cos(a) * r, h / 2 - 5, Math.sin(a) * r, { shadow: false, ry: rr() * 3, jit: 0.05, cf: (x, y) => y > h * 0.18 ? '#f2f0ff' : '#7f88c0' }); }
    // montgolfières
    V.balloonsA = [];
    for (let i = 0; i < (low ? 1 : 2); i++) {
      const c1 = i ? '#3fd0ff' : '#ff4f9e', c2 = i ? '#7a6cff' : '#ffe14a';
      kBegin();
      const prof = [[0.05, 0], [1.1, 0.4], [2.5, 1.6], [3.3, 3.4], [3.5, 5.2], [3.1, 6.8], [2.1, 7.9], [0.05, 8.3]].map(p => new THREE.Vector2(p[0], p[1]));
      put(new THREE.LatheGeometry(prof, 14), null, 0, 0, 0, { shadow: false, cf: (x, y, z) => y < 0.9 ? '#ffffff' : Math.floor((Math.atan2(x, z) + Math.PI) / (Math.PI * 2) * 14) % 2 ? c1 : c2 });
      put(G.box(1.1, 0.8, 1.1), '#a8743f', 0, -2.2, 0); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(G.box(0.05, 2.0, 0.05), '#5a4030', a * 0.5, -1.0, b * 0.5, { rx: b * 0.1, rz: -a * 0.1 });
      put(G.box(0.4, 0.3, 0.4), '#ffb13d', 0, -1.1, 0, { glow: [0.4, 1.4] });
      const ms = kMesh(kEnd(), false); S.add(ms); V.balloonsA.push({ m: ms, r: 95 + i * 40, h: 42 + i * 14, ph: i * 2.7, sp: (i ? -1 : 1) * 0.012 });
    }
    kFlush();
    // cordes des guirlandes (une seule ligne)
    { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(V.ropes, 3)); const lm = new THREE.LineBasicMaterial({ color: lin('#5a4a70').clone() }); const ls = new THREE.LineSegments(lg, lm); S.add(ls); V.disp.push(lg, lm); }
    // lueurs fixes
    { const n = V.glows.length / 6, P = mkPts(n, true, true);
      for (let i = 0; i < n; i++) { const o = V.glows, b = i * 6, c3 = lin(o[b + 3]); P.pos.set([o[b], o[b + 1], o[b + 2]], i * 3); P.col.set([c3.r, c3.g, c3.b], i * 3); P.size[i] = o[b + 4]; P.alpha[i] = o[b + 5]; }
      P.dirty(); V.glowPts = P; }
    paintBoard();
  }
  function cart(x, z, ry) {
    const M2 = lmat(x, 0, z, { ry });
    put(G.box(2.2, 1.1, 1.1), null, 0, 0.9, 0, { m: M2, cf: cx => Math.floor((cx + 5) / 0.36) % 2 ? '#ff7ab8' : '#ffffff' }); put(G.box(2.3, 0.12, 1.2), '#7a6cff', 0, 1.5, 0, { m: M2 });
    for (const s of [-1, 1]) put(G.tor(0.35, 0.08, 4, 10), '#3d2f6b', s * 0.7, 0.35, 0.6, { m: M2 });
    put(G.cyl(0.05, 0.05, 2.2, 5), '#ffffff', 0, 2.5, 0, { m: M2 }); put(G.cone(1.7, 0.8, 10), null, 0, 3.6, 0, { m: M2, cf: (cx, cy, cz) => Math.floor((Math.atan2(cx, cz) + Math.PI) / (Math.PI * 2) * 10) % 2 ? '#ffe14a' : '#ff4f9e' });
    [['#ffb6da', -0.5], ['#bfe8ff', 0], ['#fff1a8', 0.5]].forEach(([c, ox]) => { put(G.cone(0.14, 0.4, 6), '#e8b070', ox, 1.75, 0, { m: M2, rx: Math.PI }); put(G.sph(0.17, 6, 5), c, ox, 2.02, 0, { m: M2 }); });
    _v.set(x, 0, z); addCol(x, z, 1.4);
  }
  function fountain() {
    const tiles = (x, y, z) => PAL[(Math.round((Math.atan2(x, z) + Math.PI) / (Math.PI * 2) * 32)) % 4];
    put(G.cyl(4.75, 4.95, 0.95, 32), null, 0, 0.47, 0, { cf: (x, y, z) => y > 0.15 ? '#ece6f6' : tiles(x, y, z) });
    put(G.tor(4.75, 0.2, 4, 40), '#ffd1e6', 0, 0.95, 0, { rx: Math.PI / 2 });
    put(G.cyl(0.75, 0.95, 2.6, 12), '#ece6f6', 0, 1.3, 0); put(G.cyl(2.0, 1.15, 0.55, 18), '#ece6f6', 0, 2.55, 0); put(G.tor(2.0, 0.12, 4, 24), '#ffd1e6', 0, 2.83, 0, { rx: Math.PI / 2 });
    put(G.cyl(0.3, 0.4, 1.1, 8), '#ece6f6', 0, 3.3, 0); put(G.sph(0.42, 10, 8), '#ffe14a', 0, 3.85, 0, { glow: [0.1, 0.8] });
    for (let i = 0; i < 5; i++) { const a = DEST[i].ang * Math.PI / 180; put(G.cyl(0.18, 0.22, 0.3, 8), DEST[i].col, Math.sin(a) * 4.35, 1.05, -Math.cos(a) * 4.35, { glow: [0.2, 1.2] }); }
    const wt = waterTex(); V.waterTex = wt;
    V.waterMat = new THREE.MeshStandardMaterial({ map: wt, color: lin('#9fe6ff').clone(), transparent: true, opacity: 0.88, roughness: 0.12, metalness: 0.15, emissive: lin('#1a6aa8').clone(), emissiveIntensity: 0.25 }); V.disp.push(V.waterMat);
    for (const [r, y] of [[4.5, 0.8], [1.85, 2.76]]) { const w = new THREE.Mesh(new THREE.CircleGeometry(r, 36), V.waterMat); w.rotation.x = -Math.PI / 2; w.position.y = y; w.receiveShadow = V.shadows; V.scene.add(w); V.disp.push(w.geometry); }
    // gouttes : jet du haut, rideau, cinq jets latéraux, éclats sur l'eau
    const low = V.q === 'low', rr = BR.rngFrom(8), F = [];
    const nTop = low ? 50 : 110, nCur = low ? 60 : 140, nJet = low ? 14 : 28, nSp = low ? 24 : 60;
    const land = (y0, vy, yl) => (vy + Math.sqrt(vy * vy + 2 * 9.8 * (y0 - yl))) / 9.8;
    for (let i = 0; i < nTop; i++) { const vy = 4.4 + rr() * 0.8; F.push({ k: 0, a: rr() * 6.28, vr: 0.35 + rr() * 0.55, vy, y0: 4.15, r0: 0.05, L: land(4.15, vy, 2.76), t: rr(), s: 0.15 + rr() * 0.08 }); }
    for (let i = 0; i < nCur; i++) { const vy = 0.2 + rr() * 0.3; F.push({ k: 1, a: rr() * 6.28, vr: 0.55 + rr() * 0.35, vy, y0: 2.78, r0: 2.02, L: land(2.78, vy, 0.8), t: rr(), s: 0.13 + rr() * 0.06 }); }
    for (let j = 0; j < 5; j++) for (let i = 0; i < nJet; i++) { const vy = 4.0 + rr() * 0.3; F.push({ k: 2, j, a: (DEST[j].ang * Math.PI / 180), vr: -1.25 - rr() * 0.15, vy, y0: 1.1, r0: 4.35, L: land(1.1, vy, 0.8), t: i / nJet, s: 0.16 }); }
    for (let i = 0; i < nSp; i++) { const a = rr() * 6.28, r = 2.3 + rr() * 2.0; F.push({ k: 3, x: Math.sin(a) * r, z: -Math.cos(a) * r, t: rr(), L: 0.7 + rr() * 1.2, s: 0.22 }); }
    V.ftn = { P: mkPts(F.length, false, false), F };
  }

  /* ---------- petites vies : pigeons, chiens, chat, oiseaux, lucioles ---------- */
  function life() {
    const S = V.scene, low = V.q === 'low', rr = BR.rngFrom(1234);
    // pigeons
    kBegin(); put(G.sph(0.2, 7, 5), '#9aa0b8', 0, 0.26, 0, { s: [1, 0.85, 1.35] }); put(G.sph(0.14, 6, 4), '#5fb39a', 0, 0.4, 0.18, { s: [1, 0.7, 1] }); put(G.sph(0.12, 6, 4), '#6d7a9a', 0, 0.5, 0.24);
    put(G.cone(0.035, 0.12, 4), '#ffb13d', 0, 0.49, 0.38, { rx: Math.PI / 2 }); put(G.box(0.15, 0.04, 0.22), '#7d8398', 0, 0.28, -0.3, { rx: 0.35 }); for (const s of [-1, 1]) { put(G.box(0.03, 0.14, 0.03), '#ff7a8a', s * 0.07, 0.07, 0); put(G.sph(0.022, 4, 3), '#111', s * 0.06, 0.53, 0.32); }
    const pBody = kEnd(); kBegin(); const wg = G.box(0.4, 0.03, 0.24); wg.translate(0.2, 0, 0); put(wg, '#868ca6', 0, 0, 0); const pWing = kEnd();
    V.pigeons = [];
    for (let i = 0; i < (low ? 5 : 9); i++) {
      const g = new THREE.Group(), b = kMesh(pBody, false), wl = kMesh(pWing, false), wr = kMesh(pWing, false); wl.position.set(-0.1, 0.32, 0); wl.scale.x = -1; wr.position.set(0.1, 0.32, 0); g.add(b, wl, wr);
      const a = rr() * 6.28, r = 7 + rr() * 7; g.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); g.rotation.y = rr() * 6; S.add(g);
      V.pigeons.push({ g, b, wl, wr, st: 'walk', tx: g.position.x, tz: g.position.z, wait: rr() * 2, vel: new V3(), ft: 0 });
    }
    // chiens
    V.dogs = [];
    [['#e0a85a', '#8a5a33'], ['#f0ece6', '#4a4048']].slice(0, low ? 1 : 2).forEach(([c1, c2], i) => {
      const g = new THREE.Group(); kBegin();
      put(G.box(0.46, 0.4, 0.9), c1, 0, 0.62, 0); put(G.box(0.42, 0.4, 0.42), c1, 0, 0.98, 0.5); put(G.box(0.22, 0.18, 0.24), i ? '#ffffff' : '#f4d8a8', 0, 0.9, 0.78);
      put(G.box(0.09, 0.07, 0.05), '#222', 0, 0.97, 0.91); for (const s of [-1, 1]) { put(G.box(0.12, 0.24, 0.1), c2, s * 0.18, 1.18, 0.42, { rz: s * 0.35 }); put(G.box(0.06, 0.06, 0.03), '#222', s * 0.11, 1.06, 0.715); }
      if (i) put(G.box(0.3, 0.22, 0.3), c2, 0.12, 0.72, -0.15); put(G.box(0.3, 0.06, 0.3), '#ff4f9e', 0, 0.82, 0.3);
      g.add(kMesh(kEnd(), true));
      kBegin(); const lg = G.box(0.13, 0.45, 0.13); lg.translate(0, -0.22, 0); put(lg, c1, 0, 0, 0); const legG = kEnd();
      const legs = [[-0.15, 0.32], [0.15, 0.32], [-0.15, -0.32], [0.15, -0.32]].map(([x, z]) => { const l = kMesh(legG, false); l.position.set(x, 0.45, z); g.add(l); return l; });
      kBegin(); const tg = G.box(0.08, 0.08, 0.38); tg.translate(0, 0, -0.19); put(tg, c1, 0, 0, 0); const tail = kMesh(kEnd(), false); tail.position.set(0, 0.75, -0.44); tail.rotation.x = -0.6; g.add(tail);
      g.position.set(i ? -8 : 8, 0, i ? -10 : 11); S.add(g);
      V.dogs.push({ g, legs, tail, tx: g.position.x, tz: g.position.z, wait: 1 + i, ph: 0, sp: 0 });
    });
    // un chat qui dort sur un banc
    if (V.catAt) { kBegin(); put(G.sph(0.26, 8, 6), '#ff9a4a', 0, 0.16, 0, { s: [1.2, 0.7, 1.6] }); put(G.sph(0.16, 8, 6), '#ff9a4a', 0.12, 0.2, 0.36); for (const s of [-1, 1]) put(G.cone(0.06, 0.14, 4), '#ff9a4a', 0.12 + s * 0.09, 0.36, 0.36); put(G.tor(0.22, 0.05, 4, 10, Math.PI * 1.3), '#e07a2a', -0.05, 0.08, -0.25, { rx: Math.PI / 2 });
      const cat = kMesh(kEnd(), true); cat.position.set(V.catAt[0], V.catAt[1], V.catAt[2]); cat.rotation.y = V.catAt[3] + 1.3; S.add(cat); V.cat = cat; }
    // oiseaux
    kBegin(); const bw = G.box(0.7, 0.03, 0.28); bw.translate(0.35, 0, 0); put(bw, '#3d2f6b', 0, 0, 0); const bWing = kEnd();
    kBegin(); put(G.sph(0.12, 5, 4), '#3d2f6b', 0, 0, 0, { s: [0.8, 0.8, 2.2] }); const bBody = kEnd();
    V.birds = [];
    for (let i = 0; i < (low ? 5 : 10); i++) {
      const g = new THREE.Group(), b = kMesh(bBody, false), l = kMesh(bWing, false), r = kMesh(bWing, false); l.scale.x = -1; g.add(b, l, r); S.add(g);
      V.birds.push({ g, l, r, R: 45 + rr() * 30, h: 26 + rr() * 10, ph: rr() * 6.28, w: 0.12 + rr() * 0.05, fl: rr() * 6 });
    }
    // lucioles (la nuit)
    const nF = low ? 30 : 80, P = mkPts(nF, true, true); V.flies = { P, d: [] };
    for (let i = 0; i < nF; i++) { const a = rr() * 6.28, r = 20 + rr() * 60; V.flies.d.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.6 + rr() * 2.2, ph: rr() * 6.28, sp: 0.4 + rr() * 0.6 }); const c3 = lin(i % 3 ? '#d8ff7a' : '#ffe14a'); P.col.set([c3.r, c3.g, c3.b], i * 3); P.size[i] = 0.35; }
    // feux d'artifice et confettis
    V.fw = mkPS(low ? 300 : 800, true); V.cf = mkPS(low ? 160 : 360, false); V.fwT = 4; V.cfT = 6;
  }

  /* ---------- le grand panneau et les compteurs ---------- */
  function counts() {
    const N = BR.Net, P = V.pres || {}, here = (V.remote ? V.remote.size : 0) + 1, online = N && N.status === 'on' ? N.online : null, rooms = (N && N.rooms) || [];
    return { here, online, P, open: rooms.filter(r => r.state === 'lobby').length, cnt: k => (P[k] || []).length };
  }
  function paintBoard() {
    if (!V || !V.boardT) return; const { g, c, t } = V.boardT, K = counts(), W = c.width, H = c.height;
    try { if (BR.Party && BR.Party.dailyInfo) V.daily = BR.Party.dailyInfo().name; } catch (e) {}
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2e2160'); bg.addColorStop(1, '#1a1236'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const hd = g.createLinearGradient(0, 0, W, 0); hd.addColorStop(0, '#ff4f9e'); hd.addColorStop(1, '#7a6cff'); g.fillStyle = hd; g.fillRect(0, 0, W, 96);
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `900 54px ${FONT}`; g.fillStyle = '#fff'; g.fillText('LA VILLE DES JEUX', 36, 50);
    g.textAlign = 'right'; g.font = `800 30px ${FONT}`; g.fillStyle = '#fff'; g.fillText('● EN DIRECT', W - 36, 50);
    // deux grandes tuiles
    const tile = (x, ico, lab, val, col) => { rrect(g, x, 116, 460, 120, 22); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fill(); g.fillStyle = col; g.fillRect(x, 116, 10, 120);
      g.textAlign = 'left'; g.font = `44px "Segoe UI Emoji", sans-serif`; g.fillText(ico, x + 30, 176); g.font = `700 30px ${FONT}`; g.fillStyle = '#d8ccff'; g.fillText(lab, x + 96, 150);
      g.font = `900 52px ${FONT}`; g.fillStyle = '#fff'; g.fillText(val, x + 96, 200); };
    tile(36, '🏙️', 'En ville', String(K.here), '#ffe14a'); tile(528, '🌐', 'Connectés au serveur', K.online == null ? '…' : String(K.online), '#3fd0ff');
    const rows = [['🏟️', 'Bousculade', K.cnt('bousculade') + ' en jeu', '#ff4f9e'], ['🔦', 'Backrooms', K.cnt('backrooms') + ' en jeu', '#e8cf62'], ['⚔️', 'Colosses', K.cnt('colosses') + ' en jeu', '#ffb24a'], ['🚪', 'Les Portes', K.cnt('portes') + ' en jeu', '#5fe08c'], ['🧱', 'Blocaria', K.cnt('blocs') + ' en jeu', '#6cc04a'], ['🏠', 'Salons ouverts', String(K.open), '#ff4f9e']];
    if (V.daily) rows.push(['⏱', 'Défi du jour', V.daily, '#7a6cff']);
    if (V.top) rows.push(['🏆', 'Champion classé', V.top, '#ffe14a']);
    // (8 lignes au plus : 5 jeux, salons, défi du jour, champion ; hauteur du panneau 640)
    rows.slice(0, 8).forEach(([ico, a, b, col], i) => {
      const y = 254 + i * 47; rrect(g, 36, y, W - 72, 41, 12); g.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'; g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(60, y + 20.5, 7, 0, 7); g.fill();
      g.textAlign = 'left'; g.font = `25px "Segoe UI Emoji", sans-serif`; g.fillText(ico, 78, y + 22); g.font = `700 27px ${FONT}`; g.fillStyle = '#ffe9a8'; g.fillText(a, 122, y + 22);
      g.textAlign = 'right'; g.font = `800 27px ${FONT}`; g.fillStyle = '#fff'; g.fillText(b, W - 56, y + 22, 520);
    });
    t.needsUpdate = true;
    // l'interface HTML
    if (V.chips) V.chips.innerHTML = `<span class="cy-chip"><i>🏙️</i><b>${K.here}</b> en ville</span><span class="cy-chip"><i>🌐</i><b>${K.online == null ? '…' : K.online}</b> connectés</span><span class="cy-chip"><i>🏠</i><b>${K.open}</b> salon${K.open > 1 ? 's' : ''}</span>${V.daily ? `<span class="cy-chip wide"><i>⏱</i>Défi du jour : <b>${BR.esc(V.daily)}</b></span>` : ''}${V.top ? `<span class="cy-chip wide"><i>🏆</i><b>${BR.esc(V.top)}</b></span>` : ''}`;
    for (const pd of V.pads || []) {
      const n = pd.d.pk ? K.cnt(pd.d.pk) : null, el = V.hud && V.hud.querySelector(`[data-n="${pd.d.id}"]`);
      if (el) { el.textContent = n ? n + ' en jeu' : ''; el.classList.toggle('hot', n > 0); }
      if (pd.n !== n) { pd.n = n; const mc = markerTex(pd.d, n ? n : null); pd.mt.image = mc; pd.mt.needsUpdate = true; }
    }
  }
  function drawScreen() {
    const S = V.scr; if (!S) return; const g = S.g, W = 512, H = 288, t = V.t, K = counts(), sc = Math.floor(t / 5) % 4;
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2a1060'); bg.addColorStop(1, '#8a1d6a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const big = (txt, y, size, col) => { g.font = `900 ${size}px ${FONT}`; g.lineWidth = size / 6; g.strokeStyle = 'rgba(20,5,40,0.8)'; g.strokeText(txt, W / 2, y, W - 30); g.fillStyle = col || '#fff'; g.fillText(txt, W / 2, y, W - 30); };
    if (sc === 0) { for (let i = 0; i < 6; i++) { g.fillStyle = PAL[i]; g.beginPath(); g.arc((i + 0.5) * W / 6, H * 0.8 - Math.abs(Math.sin(t * 3 + i)) * 56, 17, 0, 7); g.fill(); } big('BOUSCULADE', 96 + Math.sin(t * 4) * 4, 70); big('party game · jusqu\'à 8 joueurs', 160, 26, '#ffe14a'); }
    else if (sc === 1) { big('EN LIGNE', 70, 40, '#3fd0ff'); big(K.online == null ? '…' : String(K.online), 150, 96); big(K.here + ' en ville', 230, 32, '#ffe14a'); }
    else if (sc === 2) { big('DÉFI DU JOUR', 76, 44, '#ffe14a'); big(V.daily || 'Bousculade', 156, 52); big('Fais le meilleur temps !', 228, 28, '#ffc2e0'); }
    else { big('ENTRE DANS', 80, 48); big('LE STADE !', 150, 70, '#ffe14a'); if (Math.sin(t * 8) > 0) big('▼  ▼  ▼', 230, 36, '#3fd0ff'); }
    if (!S.pat) { const [pc, pg] = cvs(4, 4); pg.fillStyle = 'rgba(0,0,0,0.28)'; pg.fillRect(0, 3, 4, 1); pg.fillRect(3, 0, 1, 4); S.pat = g.createPattern(pc, 'repeat'); }
    g.fillStyle = S.pat; g.fillRect(0, 0, W, H); S.t.needsUpdate = true;
  }

  /* ---------- les autres joueurs (présence partagée « city ») ---------- */
  function netInit() {
    const N = BR.VNet; V.remote = new Map(); if (!N) return;
    V.netOff = [N.on('join', p => addRemote(p)), N.on('leave', p => removeRemote(p.id)), N.on('pos', p => { const R = V && V.remote.get(p.id); if (R) Object.assign(R.tgt, { x: p.x, y: p.y, z: p.z, r: p.r, a: p.a }); }),
      N.on('emote', m => { const R = V && V.remote.get(m.id); if (R) try { R.av.act(m.e); } catch (e) {} }), N.on('chat', m => chatIn(m)), N.on('reset', () => { if (V) [...V.remote.keys()].forEach(removeRemote); })];
    N.enter({ x: V.pos.x, y: V.pos.y, z: V.pos.z, r: V.face, a: 'Idle', w: 'city' });
    (N.players || new Map()).forEach(p => addRemote(p));
  }
  function addRemote(p) {
    if (!V || !p || V.remote.has(p.id)) return; let av; try { av = BR.Avatar.build(p.look || { skin: 'survivor' }); } catch (e) { return; }
    av.group.traverse(m => { if (m.isMesh) m.castShadow = V.shadows; });
    av.group.position.set(p.x || 0, p.y || 0, p.z || 0); V.scene.add(av.group); const lb = label(String(p.n || 'Joueur').slice(0, 18), '#3fd0ff'); lb.position.y = 2.45; av.group.add(lb);
    V.remote.set(p.id, { av, lb, tgt: { x: p.x || 0, y: p.y || 0, z: p.z || 0, r: p.r || 0, a: p.a || 'Idle' } }); paintBoard();
    if (V.t > 3) toast(`👋 <b>${BR.esc(String(p.n || 'Un joueur').slice(0, 18))}</b> arrive en ville`);
  }
  function removeRemote(id) { const R = V && V.remote.get(id); if (!R) return; V.scene.remove(R.av.group); try { R.lb.userData.kill(); if (R.av.group.userData.bub) R.av.group.userData.bub.userData.kill(); } catch (e) {} try { R.av.dispose(); } catch (e) {} V.remote.delete(id); paintBoard(); }
  function chatIn(m) {
    if (!V) return; const line = document.createElement('div'); line.innerHTML = `<b>${BR.esc(m.n || '?')}</b> ${BR.esc(m.m)}`; V.log.appendChild(line); while (V.log.children.length > 6) V.log.firstChild.remove(); setTimeout(() => line.remove(), 15000);
    const R = m.me ? { av: V.av } : V.remote.get(m.id); if (R) bubble(R.av.group, m.m);
  }
  function bubble(g, text) {
    if (g.userData.bub) { g.remove(g.userData.bub); g.userData.bub.userData.kill(); }
    const s = label(String(text).slice(0, 40), null, 'rgba(255,255,255,0.95)', '#2a1a4a'); s.position.y = 3.05; s.scale.set(4.2, 0.92, 1); g.add(s); g.userData.bub = s;
    setTimeout(() => { if (g.userData.bub === s) { g.remove(s); s.userData.kill(); g.userData.bub = null; } }, 4500);
  }
  function toast(html) {
    if (!V || !V.toastEl) return; const el = document.createElement('div'); el.className = 'cy-t'; el.innerHTML = html; V.toastEl.appendChild(el);
    while (V.toastEl.children.length > 3) V.toastEl.firstChild.remove(); setTimeout(() => el.classList.add('out'), 3800); setTimeout(() => el.remove(), 4400);
  }

  /* ---------- démarrage / arrêt ---------- */
  C.start = function (root) {
    C.stop();
    const q = (BR.settings && BR.settings.quality) || 'high';
    const canvas = BR.el('canvas', { class: 'city-gl' }); root.prepend(canvas);
    const R = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(q === 'low' ? 1 : q === 'med' ? 1.25 : 1.5, devicePixelRatio || 1)); R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1;
    R.shadowMap.enabled = q !== 'low'; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputEncoding = THREE.sRGBEncoding;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(58, (root.clientWidth || innerWidth) / (root.clientHeight || innerHeight), 0.1, 1200);
    V = { root, canvas, R, scene, cam, q, shadows: q !== 'low', aniso: Math.min(8, R.capabilities.getMaxAnisotropy()), disp: [], statics: [], colliders: [], pads: [], glows: [], ropes: [], blinks: [],
      keys: {}, yaw: Math.PI, pitch: 0.3, dist: 9.5, vy: 0, t: 0, last: performance.now(), face: Math.PI, near: null, vel: new V3(), idle: 0,
      uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 600 }, todS: { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), cl: new THREE.Color() } };
    { const now = new Date(); V.tod = (((now.getHours() + now.getMinutes() / 60 - 6) / 24) % 1 + 1) % 1; }
    V.beamTex = (() => { const [c, g] = cvs(4, 128), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return ctex(c); })();
    build(); life();
    // post-traitement (lueur douce) en qualité haute
    if (q === 'high' && BR.AFX && BR.AFX.post) { try { V.post = BR.AFX.post(R, scene, cam, 'high'); if (V.post) { R.outputEncoding = THREE.LinearEncoding; V.post.bloom.threshold = 0.9; V.post.bloom.strength = 0.42; V.post.bloom.radius = 0.5; V.post.grade.uVig.value = 0.3; } } catch (e) { V.post = null; R.outputEncoding = THREE.sRGBEncoding; } }
    const av = BR.Avatar.build(Acc.p.look || { skin: 'survivor' }); av.group.traverse(m => { if (m.isMesh) m.castShadow = V.shadows; }); scene.add(av.group); V.av = av;
    let back = C._back; C._back = null; try { if (!back) back = sessionStorage.getItem('city_back'); sessionStorage.removeItem('city_back'); } catch (e) {}
    const from = back && DEST.find(d => d.id === back);
    if (from) { av.group.position.set(from.door[0] - from.dir[0] * 4.5, 0, from.door[1] - from.dir[1] * 4.5); V.face = Math.atan2(-from.dir[0], -from.dir[1]); }
    else { av.group.position.set(0, 0, 13); V.face = Math.PI; }
    V.pos = av.group.position; V.yaw = V.face + Math.PI; av.group.rotation.y = V.face;
    V.cyaw = V.yaw; V.cpitch = V.pitch; V.cdist = V.dist; V.focus = new V3(V.pos.x, 1.5, V.pos.z);
    V.intro = { t: 0, dur: from ? 1.6 : 3.2, from: !!from };
    // marqueur de destination (clic au sol)
    V.tapMk = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.7, 28), new THREE.MeshBasicMaterial({ color: lin('#ffe14a').clone(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); V.tapMk.rotation.x = -Math.PI / 2; V.tapMk.position.y = 0.1; scene.add(V.tapMk); V.disp.push(V.tapMk.geometry, V.tapMk.material);
    V.ray = new THREE.Raycaster();
    // interface
    const name = BR.esc(String((Acc.p && Acc.p.name) || 'Joueur'));
    const hud = BR.el('div', { class: 'city-hud cy-intro' + (q === 'low' ? ' cy-low' : '') });
    hud.innerHTML = `<div class="cy-tl">
        <div class="cy-brand"><span class="cy-logo">🎡</span><div class="cy-bt"><b>La Ville des jeux</b><small>Bienvenue, ${name} ! Promène-toi ou choisis un jeu.</small></div><span class="cy-tod"></span></div>
        <div class="cy-chips"></div></div>
      <div class="cy-dest"><div class="cy-dh"><b>Destinations</b><small>clic : y aller · ▶ : entrer</small></div>
        ${DEST.map(d => `<button class="cy-card" data-go="${d.id}" style="--c:${d.col}"><i class="cy-ic">${d.ico}</i><span class="cy-tx"><b>${d.name}</b><small>${d.sub}</small></span><em class="cy-n" data-n="${d.id}"></em><span class="cy-in" data-in="${d.id}" title="Entrer directement">▶</span></button>`).join('')}
        <div class="cy-row"><button data-quick="1" class="cy-mini">⚡ Accès rapide</button><button data-char="1" class="cy-mini">🧑 Personnage</button></div></div>
      <div class="cy-map"><canvas width="300" height="300"></canvas></div>
      <div class="ch-log"></div><div class="ch-prompt"></div>
      <div class="cy-emo">${EMO.map((e, i) => `<button data-emo="${i}" title="${e.n} (${i + 1})">${e.i}</button>`).join('')}<button data-chat="1" title="Discuter (Entrée)">💬</button></div>
      <div class="ch-keys"><span><kbd>ZQSD</kbd> marcher</span><span><kbd>Maj</kbd> courir</span><span><kbd>Espace</kbd> sauter</span><span><kbd>Clic</kbd> aller là</span><span><kbd>Glisser</kbd> caméra</span><span><kbd>E</kbd> entrer</span><span><kbd>1-4</kbd> émotes</span><span><kbd>Entrée</kbd> discuter</span></div>
      <div class="cy-toast"></div><div class="cy-fade"></div>`;
    root.appendChild(hud); V.hud = hud; V.prompt = hud.querySelector('.ch-prompt'); V.log = hud.querySelector('.ch-log'); V.chips = hud.querySelector('.cy-chips'); V.todEl = hud.querySelector('.cy-tod'); V.toastEl = hud.querySelector('.cy-toast');
    V.mapCv = hud.querySelector('.cy-map canvas'); V.mapG = V.mapCv.getContext('2d'); V.mapT = 0;
    hud.querySelectorAll('[data-go]').forEach(b => b.onclick = e => { const d = DEST.find(x => x.id === b.dataset.go); if (e.target.closest('[data-in]')) { e.stopPropagation(); enter(d); return; } walkTo(d); });
    hud.querySelector('[data-quick]').onclick = () => { Au.ui('click'); BR.UI.show('games'); };
    hud.querySelector('[data-char]').onclick = () => { Au.ui('click'); BR.UI.show('char', { back: 'hub' }); };
    hud.querySelectorAll('[data-emo]').forEach(b => b.onclick = () => emote(+b.dataset.emo));
    hud.querySelector('[data-chat]').onclick = () => openChat();
    V.prompt.onclick = () => { if (V.near) enter(V.near); };
    bind(); try { netInit(); } catch (e) { console.warn('ville réseau', e); }
    paintBoard(); updTOD(0); drawScreen();
    V.presT = 0; V.raf = requestAnimationFrame(loop);
    V.fadeEl = hud.querySelector('.cy-fade');
    if (!from) setTimeout(() => { if (V && V.hud === hud) { toast('🎡 Bienvenue dans <b>la Ville des jeux</b> !'); burst(V.pos.x, 2.2, V.pos.z, 50); } }, 1400);
    loadTop();
  };
  C.stop = function () {
    if (!V) return; cancelAnimationFrame(V.raf); unbind();
    try { (V.netOff || []).forEach(off => off()); if (BR.VNet) BR.VNet.leave(); } catch (e) {}
    if (V.remote) [...V.remote.keys()].forEach(removeRemote);
    try { if (V.av.group.userData.bub) V.av.group.userData.bub.userData.kill(); V.av.dispose(); } catch (e) {}
    try { if (V.post) V.post.dispose(); } catch (e) {}
    V.disp.forEach(o => { try { o.dispose(); } catch (e) {} });
    try { V.R.renderLists.dispose(); V.R.dispose(); V.R.forceContextLoss(); } catch (e) {}
    V.canvas.remove(); if (V.hud) V.hud.remove(); V = null;
  };
  C.active = () => !!V;
  C._v = () => V;
  function loadTop() { try { BR.Net.api('/api/leaderboard', { retries: 1, timeout: 30000 }).then(j => { if (!V) return; const t = j && j.bz && j.bz.top && j.bz.top[0]; V.top = t ? t.name + ' · ' + t.rp + ' RP' : null; paintBoard(); }).catch(() => {}); } catch (e) {} }
  function enter(d) { if (!V || V.leaving) return; V.leaving = true; C._back = d.id; goGame(d.id); }
  function walkTo(d) { Au.ui('click'); V.auto = d; V.intro = null; V.idle = 0; }
  function emote(i) { const E = EMO[i]; if (!E || !V) return; try { V.av.act(E.e); } catch (x) {} if (BR.VNet) BR.VNet.emote(E.e); if (E.e === 'Cheer') burst(V.pos.x, 2.4, V.pos.z, 40); V.idle = 0; }
  function burst(x, y, z, n) { if (!V || !V.cf) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 3.5; spawn(V.cf, x, y, z, Math.cos(a) * s, 3 + Math.random() * 4, Math.sin(a) * s, PAL[i % 6], 0.2, 2.2 + Math.random() * 1.2, 4, 1.6, 2); } }

  /* ---------- entrées ---------- */
  function tap(cx, cy) {
    const r = V.canvas.getBoundingClientRect(); V.ray.setFromCamera({ x: (cx - r.left) / r.width * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 }, V.cam);
    const o = V.ray.ray.origin, dv = V.ray.ray.direction; let best = null, bt = Infinity;
    for (const c of V.colliders) { if (!c.b) continue; const ox = o.x - c.x, oz = o.z - c.z, a = dv.x * dv.x + dv.z * dv.z, b = 2 * (ox * dv.x + oz * dv.z), cc = ox * ox + oz * oz - c.r * c.r, disc = b * b - 4 * a * cc; if (disc < 0 || a < 1e-6) continue; const t = (-b - Math.sqrt(disc)) / (2 * a); if (t > 0 && t < bt && o.y + dv.y * t < c.h + 4) { bt = t; best = c.b; } }
    for (const pd of V.pads) { const p = pd.mk.position, t = _v.copy(p).sub(o).dot(dv); if (t > 0 && t < bt && _v.copy(o).addScaledVector(dv, t).distanceTo(p) < 2.4) { bt = t; best = pd.d; } }
    const gt = dv.y < -1e-4 ? -o.y / dv.y : Infinity;
    if (best && bt <= gt + 0.5) { walkTo(best); return; }
    if (gt < 300) { let x = o.x + dv.x * gt, z = o.z + dv.z * gt; const rr = Math.hypot(x, z); if (rr > BOUND) { x *= BOUND / rr; z *= BOUND / rr; } V.auto = { door: [x, z], pt: true }; V.tapMk.position.set(x, 0.1, z); V.tapMk.material.opacity = 1; V.tapT = 0; Au.ui('hover'); }
  }
  const H = {
    kd: e => { if (!V || /^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName)) return; V.keys[e.code] = true; V.idle = 0; if (V.intro && !V.intro.from && e.code !== 'Enter') V.intro = null;
      if (e.code === 'KeyE' && V.near) enter(V.near);
      if (/^Digit[1-4]$/.test(e.code)) emote(+e.code.slice(5) - 1);
      if (e.code === 'Enter') { e.preventDefault(); openChat(); }
      if (e.code === 'Space') e.preventDefault(); },
    ku: e => { if (V) V.keys[e.code] = false; },
    pd: e => { if (!V || e.target !== V.canvas) return; V.drag = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, moved: 0, btn: e.button }; V.intro = null; V.idle = 0; try { V.canvas.setPointerCapture(e.pointerId); } catch (x) {} },
    pm: e => { if (!V || !V.drag || e.pointerId !== V.drag.id) return; const dx = e.clientX - V.drag.x, dy = e.clientY - V.drag.y; V.drag.moved += Math.abs(dx) + Math.abs(dy); V.yaw -= dx * 0.006; V.pitch = clamp(V.pitch + dy * 0.004, 0.05, 1.25); V.drag.x = e.clientX; V.drag.y = e.clientY; },
    pu: e => { if (!V || !V.drag || e.pointerId !== V.drag.id) return; const D = V.drag; V.drag = null; if (D.moved < 8 && performance.now() - D.t < 450 && D.btn === 0) tap(e.clientX, e.clientY); },
    wh: e => { if (!V || e.target !== V.canvas) return; V.dist = clamp(V.dist + Math.sign(e.deltaY) * 1.2, 4, 24); V.idle = 0; },
    cm: e => { if (V && e.target === V.canvas) e.preventDefault(); },
    rs: () => { if (V) V.sz = null; },
  };
  function bind() { addEventListener('keydown', H.kd); addEventListener('keyup', H.ku); addEventListener('pointerdown', H.pd); addEventListener('pointermove', H.pm); addEventListener('pointerup', H.pu); addEventListener('pointercancel', H.pu); addEventListener('wheel', H.wh, { passive: true }); addEventListener('contextmenu', H.cm); addEventListener('resize', H.rs); }
  function unbind() { removeEventListener('keydown', H.kd); removeEventListener('keyup', H.ku); removeEventListener('pointerdown', H.pd); removeEventListener('pointermove', H.pm); removeEventListener('pointerup', H.pu); removeEventListener('pointercancel', H.pu); removeEventListener('wheel', H.wh); removeEventListener('contextmenu', H.cm); removeEventListener('resize', H.rs); }
  function openChat() {
    if (!V || V.chatEl) return; V.keys = {};
    const inp = BR.el('input', { class: 'ch-chat', maxlength: '120', placeholder: 'Message à la ville… (Entrée : envoyer · Échap : fermer)' }); V.hud.appendChild(inp); V.chatEl = inp; inp.focus();
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const t = inp.value.trim(); if (t) { if (BR.VNet && BR.VNet.inside && BR.Net.status === 'on') BR.VNet.chat(t); else chatIn({ n: Acc.p.name, m: t, me: true }); } inp.remove(); V.chatEl = null; } else if (e.key === 'Escape') { inp.remove(); V.chatEl = null; } });
  }

  /* ---------- boucle ---------- */
  function loop(now) { if (!V) return; V.raf = requestAnimationFrame(loop); tick(now); }
  C._step = dt => V && tick(V.last + dt * 1000);   // test
  function checkSize() {
    const w = V.root.clientWidth || innerWidth, h = V.root.clientHeight || innerHeight; if (V.sz && V.sz[0] === w && V.sz[1] === h) return; V.sz = [w, h];
    V.R.setSize(w, h, false); V.cam.aspect = w / h; V.cam.updateProjectionMatrix(); if (V.post) V.post.setSize(w, h);
    V.uScale.value = h * V.R.getPixelRatio() / (2 * Math.tan(V.cam.fov * Math.PI / 360)); V.hud.classList.toggle('cy-small', w < 760);
  }
  function updTOD(dt) {
    if (!V.todLock) V.tod = (V.tod + dt / CYCLE) % 1;
    V.todAcc = (V.todAcc || 0) - dt; if (V.todAcc > 0 && dt) return; V.todAcc = 0.25;
    const T = sampleTOD(V.tod, V.todS), az = V.tod * Math.PI * 2 + 0.9, el = T.el * Math.PI / 180;
    const sd = _v.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)); V.sunDir = (V.sunDir || new V3()).copy(sd);
    const lel = Math.max(T.el, 16) * Math.PI / 180; V.lightDir = (V.lightDir || new V3()).set(Math.cos(az) * Math.cos(lel), Math.sin(lel), Math.sin(az) * Math.cos(lel));
    V.sun.color.copy(T.sun); V.sun.intensity = T.si; V.hemi.color.copy(T.hs); V.hemi.groundColor.copy(T.hg); V.hemi.intensity = T.hi;
    V.scene.fog.color.copy(T.fog); V.R.toneMappingExposure = T.ex; V.uNight.value = T.ni;
    // dôme du ciel
    const g = V.sky.geometry, p = g.attributes.position, c = g.attributes.color, dayk = 1 - T.ni * 0.75;
    for (let i = 0; i < p.count; i++) {
      _n.fromBufferAttribute(p, i).normalize(); const h = _n.y;
      if (h >= 0) _c.copy(T.hor).lerp(T.top, Math.pow(h, 0.55)); else _c.copy(T.hor).lerp(T.fog, Math.min(1, -h * 5));
      const dd = Math.max(0, _n.dot(V.sunDir)); const k = (Math.pow(dd, 14) * 0.7 + Math.pow(dd, 3) * 0.14) * dayk; _c.r += T.sun.r * k; _c.g += T.sun.g * k; _c.b += T.sun.b * k;
      c.setXYZ(i, _c.r, _c.g, _c.b);
    }
    c.needsUpdate = true;
    V.sunS.material.color.copy(T.sun).multiplyScalar(1.4); V.sunS.material.opacity = sstep(-8, 4, T.el) * 0.95;
    V.moonS.material.opacity = T.ni * 0.95; V.stars.material.opacity = Math.max(0, T.ni - 0.25) * 1.2;
    V.cloudMat.color.copy(T.cl); V.cloudMat.emissive.copy(T.hor).lerp(T.cl, 0.5); V.cloudMat.emissiveIntensity = 0.28 + T.ni * 0.1;
    if (V.waterMat) V.waterMat.emissiveIntensity = 0.25 + T.ni * 0.6;
    if (V.todEl) { const nm = todName(V.tod); if (V.todEl.dataset.n !== nm) { const k = nm.indexOf(' '); V.todEl.dataset.n = nm; V.todEl.title = 'Heure de la ville : ' + nm.slice(k + 1); V.todEl.innerHTML = `<i>${nm.slice(0, k)}</i><span>${nm.slice(k + 1)}</span>`; } }
  }
  function tick(now) {
    const dt = clamp((now - V.last) / 1000, 0, 0.05); V.last = Math.max(V.last, now); V.t += dt; V.uTime.value = V.t;   // (l'horodatage d'image peut précéder le démarrage)
    checkSize(); updTOD(dt);
    if (V.fadeEl) { const f = 1 - clamp((V.t - 0.15) / 1.1, 0, 1); V.fadeEl.style.opacity = f; if (V.t > 0.35) V.hud.classList.remove('cy-intro'); if (!f) { V.fadeEl.remove(); V.fadeEl = null; } }
    const k = V.keys, P = V.pos;
    let ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), iz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    if (ix || iz) { V.auto = null; V.idle = 0; }
    const run = k.ShiftLeft || k.ShiftRight, spd = run ? 8.5 : 5;
    let wx = 0, wz = 0;
    if (V.auto) {
      const d = V.auto, dx = d.door[0] - P.x, dz = d.door[1] - P.z, dd = Math.hypot(dx, dz);
      if (dd < (d.pt ? 0.6 : 1.2)) V.auto = null;
      else {
        wx = dx / dd; wz = dz / dd;
        // contourne les gros obstacles (bâtiments, fontaine) sur le chemin
        let sx = 0, sz = 0;
        for (const c of V.colliders) { if (c.r < 2) continue; const cx = c.x - P.x, cz = c.z - P.z, pr = cx * wx + cz * wz; if (pr <= 0 || pr > dd) continue; const px = cx - wx * pr, pz = cz - wz * pr, pd = Math.hypot(px, pz), lim = c.r + 1.4; if (pd < lim) { const w = (lim - pd) / lim * 2.2 / Math.max(1, pr / (c.r + 4)); const nx = pd > 1e-3 ? -px / pd : -wz, nz = pd > 1e-3 ? -pz / pd : wx; sx += nx * w; sz += nz * w; } }
        wx += sx; wz += sz; const l = Math.hypot(wx, wz); wx /= l; wz /= l;
      }
    } else if (ix || iz) { const f = [-Math.sin(V.yaw), -Math.cos(V.yaw)], r = [Math.cos(V.yaw), -Math.sin(V.yaw)]; wx = f[0] * iz + r[0] * ix; wz = f[1] * iz + r[1] * ix; const l = Math.hypot(wx, wz); wx /= l; wz /= l; }
    const sp = V.auto ? 8.5 : spd;
    V.vel.x += (wx * sp - V.vel.x) * kExp(dt, 12); V.vel.z += (wz * sp - V.vel.z) * kExp(dt, 12);
    P.x += V.vel.x * dt; P.z += V.vel.z * dt;
    const vmag = Math.hypot(V.vel.x, V.vel.z);
    if (wx || wz) { const tf = Math.atan2(wx, wz); V.face += BR.angDiff(V.face, tf) * Math.min(1, dt * 12); V.av.group.rotation.y = V.face; if (V.auto) V.yaw += BR.angDiff(V.yaw, V.face + Math.PI) * Math.min(1, dt * 1.6); }
    // saut
    if (k.Space && P.y <= 0.001) { V.vy = 7; V.idle = 0; } V.vy -= 22 * dt; P.y = Math.max(0, P.y + V.vy * dt); if (P.y === 0) V.vy = Math.max(0, V.vy);
    // collisions (cercles) et limites
    for (const c of V.colliders) { const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz), r = c.r + 0.45; if (d < r && d > 1e-4) { P.x = c.x + dx / d * r; P.z = c.z + dz / d * r; } }
    const pr = Math.hypot(P.x, P.z); if (pr > BOUND) { P.x *= BOUND / pr; P.z *= BOUND / pr; }
    const moving = vmag > 0.4;
    V.av.update(dt, moving ? vmag : 0, { air: P.y > 0.05, sprint: vmag > 8 });
    // porte la plus proche
    let near = null;
    for (const pd of V.pads) {
      const dd = Math.hypot(P.x - pd.d.door[0], P.z - pd.d.door[1]), on = dd < 3; if (on) near = pd.d;
      const pulse = 0.5 + 0.5 * Math.sin(V.t * 3 + pd.d.ang);
      pd.m.material.opacity = on ? 1 : 0.6 + pulse * 0.3; pd.disc.material.opacity = on ? 0.55 : 0.2 + pulse * 0.1; pd.m.rotation.z += dt * 0.6;
      const camD = Math.hypot(V.cam.position.x - pd.d.door[0], V.cam.position.z - pd.d.door[1]);
      pd.beam.material.opacity = (0.32 + pulse * 0.18) * (on ? 1.5 : 1) * (0.7 + V.uNight.value * 0.5) * clamp((camD - 2.6) / 3, 0, 1); pd.mk.position.y = PIN[pd.d.id][0] + Math.sin(V.t * 2 + pd.d.ang) * 0.4;
    }
    if (near !== V.near) {
      V.near = near; V.prompt.classList.toggle('on', !!near);
      if (near) { V.prompt.style.setProperty('--c', near.col); V.prompt.innerHTML = `<kbd>E</kbd><span><b>${near.ico} ${near.name}</b><small>${near.sub}</small></span><em>Entrer ▶</em>`; Au.ui('hover'); }
      V.hud.querySelectorAll('.cy-card').forEach(b => b.classList.toggle('near', !!near && b.dataset.go === near.id));
    }
    if (near && V.auto === near) { V.auto = null; }
    const goId = V.auto && !V.auto.pt ? V.auto.id : null; if (goId !== V.goId) { V.goId = goId; V.hud.querySelectorAll('.cy-card').forEach(b => b.classList.toggle('go', b.dataset.go === goId)); }
    if (V.tapMk.material.opacity > 0) { V.tapT += dt; V.tapMk.material.opacity = Math.max(0, 1 - V.tapT / 1.2) * (V.auto && V.auto.pt ? 1 : 0.5); V.tapMk.scale.setScalar(1 + Math.sin(V.tapT * 8) * 0.12); }
    // les autres joueurs
    for (const R of (V.remote || new Map()).values()) { const g = R.av.group, t = R.tgt, kk = 1 - Math.exp(-dt * 10), ox = g.position.x, oz = g.position.z; if (Math.hypot(t.x - ox, t.z - oz) > 12) g.position.set(t.x, t.y, t.z); else { g.position.x += (t.x - ox) * kk; g.position.y += (t.y - g.position.y) * kk; g.position.z += (t.z - oz) * kk; } g.rotation.y += BR.angDiff(g.rotation.y, t.r) * kk; const mv = Math.hypot(g.position.x - ox, g.position.z - oz) / Math.max(dt, 1e-3); R.av.update(dt, Math.min(mv, 9), { air: /^Jump/.test(t.a) }); }
    if (BR.VNet) BR.VNet.move(P.x, P.y, P.z, V.face, P.y > 0.05 ? 'Jump_Idle' : moving ? (vmag > 8 ? 'Running_B' : 'Running_A') : 'Idle');
    animate(dt);
    // présence / panneau
    if ((V.presT -= dt) <= 0) { V.presT = 6; const N = BR.Net; if (N && N.status === 'on') N.send({ t: 'presence' }); paintBoard(); }
    if ((V.mapT -= dt) <= 0) { V.mapT = 0.1; drawMap(); }
    camera(dt);
    const lx = Math.round(P.x / V.shTexel) * V.shTexel, lz = Math.round(P.z / V.shTexel) * V.shTexel;
    V.sun.target.position.set(lx, 0, lz); V.sun.position.set(lx + V.lightDir.x * 120, V.lightDir.y * 120, lz + V.lightDir.z * 120);
    V.sky.position.copy(V.cam.position); V.stars.position.copy(V.cam.position);
    V.sunS.position.copy(V.cam.position).addScaledVector(V.sunDir, 400); V.moonS.position.copy(V.cam.position).addScaledVector(_v.set(-V.sunDir.x, Math.max(0.35, -V.sunDir.y), -V.sunDir.z).normalize(), 400);
    if (V.post) V.post.render(dt); else V.R.render(V.scene, V.cam);
  }
  /* ---------- caméra douce qui ne traverse pas les bâtiments ---------- */
  function camera(dt) {
    const P = V.pos, F = V.focus;
    if (!V.drag && !V.auto && V.idle > 30) V.yaw += dt * 0.05;   // au repos, la caméra tourne doucement
    V.idle += dt;
    F.x += (P.x - F.x) * kExp(dt, 14); F.z += (P.z - F.z) * kExp(dt, 14); F.y += (P.y + 1.5 - F.y) * kExp(dt, 7);
    V.cyaw += BR.angDiff(V.cyaw, V.yaw) * kExp(dt, 16); V.cpitch += (V.pitch - V.cpitch) * kExp(dt, 16);
    const cp = Math.cos(V.cpitch), dx = Math.sin(V.cyaw) * cp, dy = Math.sin(V.cpitch), dz = Math.cos(V.cyaw) * cp, hl = Math.hypot(dx, dz);
    let want = V.dist;
    for (const c of V.colliders) {
      if (!c.h) continue; const ox = F.x - c.x, oz = F.z - c.z, a = hl * hl, b = 2 * (ox * dx + oz * dz), cc = ox * ox + oz * oz - (c.r * 0.95) * (c.r * 0.95), disc = b * b - 4 * a * cc;
      if (disc <= 0 || a < 1e-6) continue; const t = (-b - Math.sqrt(disc)) / (2 * a); if (t <= 0 || t >= want) continue; if (F.y + dy * t < c.h) want = Math.max(1.8, t - 0.6);
    }
    V.cdist += (want - V.cdist) * kExp(dt, want < V.cdist ? 18 : 3);
    let cx = F.x + dx * V.cdist, cy = F.y + dy * V.cdist, cz = F.z + dz * V.cdist; cy = Math.max(cy, 0.5);
    let lx = F.x, ly = F.y, lz = F.z;
    if (V.intro) {
      const I = V.intro; I.t += dt; const s = clamp(I.t / I.dur, 0, 1), e = s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
      const sx = I.from ? cx + dx * 14 : 0 + dx * 70, sy = I.from ? cy + 10 : 46, sz = I.from ? cz + dz * 14 : 0 + dz * 70;
      cx = sx + (cx - sx) * e; cy = sy + (cy - sy) * e; cz = sz + (cz - sz) * e; const fl = I.from ? 1 : e; lx = lx * fl; ly = 4 + (ly - 4) * e; lz = lz * fl;
      if (s >= 1) V.intro = null;
    }
    V.cam.position.set(cx, cy, cz); V.cam.lookAt(lx, ly + 0.7, lz);
  }
  /* ---------- animations du décor ---------- */
  function animate(dt) {
    const t = V.t, night = V.uNight.value, P = V.pos;
    V.clouds.rotation.y += dt * 0.004;
    if (V.waterTex) { V.waterTex.offset.x = (V.waterTex.offset.x + dt * 0.03) % 1; V.waterTex.offset.y = Math.sin(t * 0.4) * 0.05; if (night > 0.2) { _c.setHSL((t * 0.05) % 1, 0.8, 0.5); V.waterMat.emissive.copy(_c); } else V.waterMat.emissive.copy(lin('#1a6aa8')); }
    // fontaine
    { const { P: FP, F } = V.ftn; let i = 0;
      for (const f of F) {
        f.t = (f.t + dt / f.L) % 1; const i3 = i * 3; let c = '#eaf8ff';
        if (f.k === 3) { FP.pos[i3] = f.x; FP.pos[i3 + 1] = 0.83; FP.pos[i3 + 2] = f.z; FP.alpha[i] = Math.max(0, Math.sin(f.t * Math.PI)) * 0.9; FP.size[i] = f.s * (0.5 + f.t); }
        else {
          const tau = f.t * f.L, r = f.r0 + f.vr * tau, y = f.y0 + f.vy * tau - 4.9 * tau * tau, a = f.k === 2 ? f.a : f.a;
          FP.pos[i3] = Math.sin(a) * r; FP.pos[i3 + 1] = y; FP.pos[i3 + 2] = -Math.cos(a) * r; FP.alpha[i] = f.t < 0.08 ? f.t / 0.08 : 0.85; FP.size[i] = f.s;
          if (f.k === 2 && night > 0.3) c = DEST[f.j].col;
        }
        const c3 = lin(c); FP.col[i3] = c3.r; FP.col[i3 + 1] = c3.g; FP.col[i3 + 2] = c3.b; i++;
      }
      FP.dirty(); }
    // bâtiments
    if (V.scr && t >= V.scr.next) { V.scr.next = t + (V.q === 'low' ? 0.25 : 0.1); drawScreen(); }
    for (const b of V.balls || []) { const h = Math.abs(Math.sin(t * 2.2 + b.ph)); b.m.position.set(b.x + Math.sin(t * 0.6 + b.ph) * 1.5, 1.15 + h * 2.6, b.z + Math.cos(t * 0.5 + b.ph) * 1.2); b.m.scale.set(1 + (1 - h) * 0.12 * (h < 0.15 ? 1 : 0), 1 - (h < 0.15 ? 0.15 : 0), 1); }
    if (V.towerMat) { if (!V.flk || t > V.flk.end) V.flk = Math.random() < 0.012 ? { end: t + 0.08 + Math.random() * 0.25 } : null; const f = V.flk ? 0.3 + Math.random() * 0.4 : 1; V.towerMat.emissiveIntensity = (0.3 + night * 1.0) * f; if (V.flkSign) V.flkSign.opacity = V.flk && Math.random() < 0.5 ? 0.55 : 1; }
    for (const b of V.blinks) b.m.visible = Math.sin(t * 3 + b.ph * 6) > 0.2;
    for (const f of V.fires || []) { f.scale.set(1 + Math.sin(t * 17 + f.position.x) * 0.12, 1 + Math.sin(t * 23 + f.position.x * 3) * 0.25, 1); }
    for (const r of V.rings || []) r.m.rotation.y += dt * r.s;
    for (const fd of V.flyDoors || []) { const a = t * 0.16 + fd.ph; fd.g.position.set(Math.sin(a) * fd.r, fd.y + Math.sin(t * 0.9 + fd.ph) * 0.6, Math.cos(a) * fd.r); fd.g.rotation.y = a; fd.h.rotation.y = -Math.max(0, Math.sin(t * 0.7 + fd.ph * 2)) * 1.6; }
    if (V.crystal) { V.crystal.rotation.y += dt * 1.2; V.crystal.position.y = 38.8 + Math.sin(t * 1.5) * 0.4; }
    if (V.crane) { const C2 = V.crane; C2.g.rotation.y = 0.3 + Math.sin(t * 0.16) * 1.1; C2.tr.position.x = 7.5 + Math.sin(t * 0.27) * 4.5; const L = 5.5 + Math.sin(t * 0.41) * 2; C2.cable.scale.y = L; C2.hook.position.y = -L; C2.hook.rotation.y = Math.sin(t * 0.5) * 0.4; }
    for (const b of V.balloonsA) { const a = t * b.sp + b.ph; b.m.position.set(Math.cos(a) * b.r, b.h + Math.sin(t * 0.3 + b.ph) * 3, Math.sin(a) * b.r); b.m.rotation.y = t * 0.05 + b.ph; }
    if (V.cat) V.cat.scale.y = 1 + Math.sin(t * 2.2) * 0.04;
    // pigeons : picorent, s'envolent quand on approche
    for (const p of V.pigeons) {
      const g = p.g, pos = g.position; let threat = Math.hypot(P.x - pos.x, P.z - pos.z) < 3.2;
      if (!threat && V.remote) for (const R of V.remote.values()) if (Math.hypot(R.av.group.position.x - pos.x, R.av.group.position.z - pos.z) < 2.6) { threat = true; break; }
      for (const dg of V.dogs) if (Math.hypot(dg.g.position.x - pos.x, dg.g.position.z - pos.z) < 2) threat = true;
      if (p.st !== 'fly' && threat) { p.st = 'fly'; p.ft = 0; const ax = pos.x - P.x, az = pos.z - P.z, l = Math.hypot(ax, az) || 1; p.vel.set(ax / l * 4, 5 + Math.random() * 2, az / l * 4); p.land = null; }
      if (p.st === 'fly') {
        p.ft += dt; const flap = Math.sin(t * 32 + pos.x) * 0.9; p.wl.rotation.z = flap; p.wr.rotation.z = -flap;
        if (!p.land && p.ft > 3 + Math.random() * 3) { for (let k = 0; k < 8; k++) { const a = Math.random() * 6.28, r = 6.5 + Math.random() * 8.5, x = Math.sin(a) * r, z = Math.cos(a) * r; if (Math.hypot(x - P.x, z - P.z) > 7) { p.land = [x, z]; break; } } }
        let gx, gy, gz; if (p.land) { gx = p.land[0]; gz = p.land[1]; const dd = Math.hypot(gx - pos.x, gz - pos.z); gy = Math.min(10, dd * 0.6); } else { const a = Math.atan2(pos.x, pos.z) + 0.6; gx = Math.sin(a) * 16; gz = Math.cos(a) * 16; gy = 10; }
        _v.set(gx - pos.x, gy - pos.y, gz - pos.z); const l = _v.length(); if (l > 0.01) _v.multiplyScalar(5.5 / Math.max(l, 1)); p.vel.lerp(_v, kExp(dt, 2)); pos.addScaledVector(p.vel, dt);
        g.rotation.y = Math.atan2(p.vel.x, p.vel.z); g.rotation.x = -clamp(p.vel.y * 0.08, -0.5, 0.5);
        if (p.land && Math.hypot(p.land[0] - pos.x, p.land[1] - pos.z) < 0.4 && pos.y < 0.5) { pos.y = 0; p.st = 'walk'; p.tx = pos.x; p.tz = pos.z; p.wait = 1; g.rotation.x = 0; p.wl.rotation.z = p.wr.rotation.z = 0; }
      } else {
        const dx = p.tx - pos.x, dz = p.tz - pos.z, dd = Math.hypot(dx, dz);
        if (dd < 0.15) { p.wait -= dt; p.b.rotation.x = Math.max(0, Math.sin(t * 9 + pos.x * 5)) * 0.5; if (p.wait <= 0) { for (let k = 0; k < 6; k++) { const nx = pos.x + (Math.random() - 0.5) * 5, nz = pos.z + (Math.random() - 0.5) * 5, r = Math.hypot(nx, nz); if (r > 5.6 && r < 15.5) { p.tx = nx; p.tz = nz; break; } } p.wait = 1 + Math.random() * 3; } }
        else { const s = Math.min(dd, 0.9 * dt); pos.x += dx / dd * s; pos.z += dz / dd * s; pos.y = Math.abs(Math.sin(t * 14 + pos.x)) * 0.06; g.rotation.y += BR.angDiff(g.rotation.y, Math.atan2(dx, dz)) * kExp(dt, 10); p.b.rotation.x = 0; }
      }
    }
    // chiens : se promènent, s'assoient, remuent la queue près de toi
    for (const dg of V.dogs) {
      const g = dg.g, pos = g.position, dx = dg.tx - pos.x, dz = dg.tz - pos.z, dd = Math.hypot(dx, dz), pd = Math.hypot(P.x - pos.x, P.z - pos.z);
      if (dd < 0.3) {
        dg.sp += (0 - dg.sp) * kExp(dt, 6); dg.wait -= dt;
        if (pd < 6) g.rotation.y += BR.angDiff(g.rotation.y, Math.atan2(P.x - pos.x, P.z - pos.z)) * kExp(dt, 4);
        if (dg.wait <= 0) { for (let k = 0; k < 10; k++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 34, x = Math.sin(a) * r, z = Math.cos(a) * r; if (!V.colliders.some(c => c.r > 1.5 && Math.hypot(c.x - x, c.z - z) < c.r + 1.5)) { dg.tx = x; dg.tz = z; break; } } dg.wait = 2 + Math.random() * 5; }
      } else { dg.sp += (2.2 - dg.sp) * kExp(dt, 3); pos.x += dx / dd * dg.sp * dt; pos.z += dz / dd * dg.sp * dt; g.rotation.y += BR.angDiff(g.rotation.y, Math.atan2(dx, dz)) * kExp(dt, 6); }
      for (const c of V.colliders) { const ex = pos.x - c.x, ez = pos.z - c.z, e = Math.hypot(ex, ez), r = c.r + 0.5; if (e < r && e > 1e-4) { pos.x = c.x + ex / e * r; pos.z = c.z + ez / e * r; } }
      dg.ph += dt * dg.sp * 5; const sw = Math.sin(dg.ph) * 0.6 * Math.min(1, dg.sp); dg.legs[0].rotation.x = dg.legs[3].rotation.x = sw; dg.legs[1].rotation.x = dg.legs[2].rotation.x = -sw;
      dg.tail.rotation.y = Math.sin(t * (pd < 6 ? 16 : 6)) * (pd < 6 ? 0.7 : 0.3); pos.y = Math.abs(Math.sin(dg.ph)) * 0.04 * Math.min(1, dg.sp);
    }
    // oiseaux le jour, lucioles la nuit
    const bv = night < 0.6;
    for (const b of V.birds) { b.g.visible = bv; if (!bv) continue; const a = t * b.w + b.ph; b.g.position.set(Math.cos(a) * b.R, b.h + Math.sin(t * 0.7 + b.ph) * 2, Math.sin(a) * b.R); b.g.rotation.y = -a; const f = Math.sin(t * 9 + b.fl) * 0.7; b.l.rotation.z = f; b.r.rotation.z = -f; }
    { const F = V.flies, FP = F.P, vis = Math.max(0, night - 0.3) * 1.4; if (vis > 0 || F.was) { F.d.forEach((f, i) => { const i3 = i * 3; FP.pos[i3] = f.x + Math.sin(t * f.sp + f.ph) * 2; FP.pos[i3 + 1] = f.y + Math.sin(t * f.sp * 1.7 + f.ph) * 0.6; FP.pos[i3 + 2] = f.z + Math.cos(t * f.sp * 0.8 + f.ph) * 2; FP.alpha[i] = vis * (0.4 + 0.6 * Math.max(0, Math.sin(t * 2.5 + f.ph * 3))); }); FP.dirty(); } F.was = vis > 0; }
    // feux d'artifice (soir et nuit), confettis au stade (jour)
    if (night > 0.45 && (V.fwT -= dt) <= 0) {
      V.fwT = (night > 0.85 ? 2.5 : 5) + Math.random() * 4; const d = DEST[Math.floor(Math.random() * 5)], x = d.pos[0] * 0.7 + (Math.random() - 0.5) * 30, z = d.pos[1] * 0.7 + (Math.random() - 0.5) * 30;
      const c1 = PAL[Math.floor(Math.random() * 6)]; spawn(V.fw, x, 2, z, (Math.random() - 0.5) * 2, 24 + Math.random() * 5, (Math.random() - 0.5) * 2, '#fff3c0', 0.7, 1.4 + Math.random() * 0.3, 9, 0.2, 1); V.fw.col2 = V.fw.col2 || []; V.fw.col2[(V.fw.i + V.fw.n - 1) % V.fw.n] = c1;
    }
    stepPS(V.fw, dt, i => { if (V.fw.kind[i] !== 1) return; const x = V.fw.pos[i * 3], y = V.fw.pos[i * 3 + 1], z = V.fw.pos[i * 3 + 2], c1 = (V.fw.col2 && V.fw.col2[i]) || '#ff4f9e', c2 = PAL[Math.floor(Math.random() * 6)], n = V.q === 'low' ? 40 : 90;
      for (let k = 0; k < n; k++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.28, r = Math.sqrt(1 - u * u), s = 10 + Math.random() * 2.5; spawn(V.fw, x, y, z, Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, k % 3 ? c1 : c2, 0.9, 1.6 + Math.random() * 0.8, 3.5, 1.5, 0); } });
    if (night < 0.3 && V.stadium && (V.cfT -= dt) <= 0) { V.cfT = 9 + Math.random() * 7; for (let k = 0; k < 70; k++) { const a = Math.random() * 6.28, s = 3 + Math.random() * 5; spawn(V.cf, V.stadium.x + (Math.random() - 0.5) * 4, V.stadium.y, V.stadium.z + (Math.random() - 0.5) * 4, Math.cos(a) * s, 7 + Math.random() * 6, Math.sin(a) * s, PAL[k % 6], 0.35, 3 + Math.random() * 1.5, 4, 1.4, 2); } }
    stepPS(V.cf, dt);
  }
  /* ---------- mini-carte (tourne avec la caméra) ---------- */
  function drawMap() {
    const cv = V.mapCv, g = V.mapG, S = cv.width, R = S / 2, sc = (R - 6) / 72, P = V.pos, cy = Math.cos(V.cyaw), sy = Math.sin(V.cyaw);
    const M2 = (x, z) => { const dx = x - P.x, dz = z - P.z; return [R + (dx * cy - dz * sy) * sc, R + (dx * sy + dz * cy) * sc]; };
    g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(R, R, R - 3, 0, 7); g.clip();
    const bg = g.createRadialGradient(R, R, 10, R, R, R); bg.addColorStop(0, '#7cc860'); bg.addColorStop(1, '#4f9a44'); g.fillStyle = bg; g.fillRect(0, 0, S, S);
    let p = M2(0, 0); g.strokeStyle = 'rgba(240,226,200,0.9)'; g.lineWidth = 3 * sc; g.beginPath(); g.arc(p[0], p[1], PROM * sc, 0, 7); g.stroke();
    for (const d of DEST) { const a = M2(d.dir[0] * PLAZA, d.dir[1] * PLAZA), b = M2(d.door[0], d.door[1]); g.strokeStyle = '#ecdcc0'; g.lineWidth = 6.6 * sc; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.strokeStyle = d.col; g.lineWidth = 1.6; g.stroke(); }
    g.fillStyle = '#f1e4d0'; g.beginPath(); g.arc(p[0], p[1], PLAZA * sc, 0, 7); g.fill(); g.fillStyle = '#5ccfff'; g.beginPath(); g.arc(p[0], p[1], 4.6 * sc, 0, 7); g.fill();
    for (const d of DEST) { const b = M2(d.pos[0], d.pos[1]); g.fillStyle = d.col; g.globalAlpha = 0.9; g.beginPath(); g.arc(b[0], b[1], 11 * sc, 0, 7); g.fill(); g.globalAlpha = 1; }
    if (V.remote) for (const Rm of V.remote.values()) { const q = M2(Rm.av.group.position.x, Rm.av.group.position.z); g.fillStyle = '#3fd0ff'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(q[0], q[1], 5, 0, 7); g.fill(); g.stroke(); }
    if (V.auto) { const q = M2(V.auto.door[0], V.auto.door[1]); g.strokeStyle = '#ffe14a'; g.setLineDash([6, 5]); g.lineWidth = 3; g.beginPath(); g.moveTo(R, R); g.lineTo(q[0], q[1]); g.stroke(); g.setLineDash([]); }
    g.restore();
    // icônes des jeux (sur le bord si hors de portée)
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const d of DEST) { let b = M2(d.pos[0], d.pos[1]); const ex = b[0] - R, ez = b[1] - R, l = Math.hypot(ex, ez), mx = R - 22; if (l > mx) b = [R + ex / l * mx, R + ez / l * mx]; g.fillStyle = 'rgba(26,14,52,0.8)'; g.beginPath(); g.arc(b[0], b[1], 17, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = d.col; g.stroke(); g.font = '19px "Segoe UI Emoji", sans-serif'; g.fillText(d.ico, b[0], b[1] + 1); }
    // le joueur
    const fa = V.face, fx = Math.sin(fa), fz = Math.cos(fa), ax = fx * cy - fz * sy, az = fx * sy + fz * cy;
    g.save(); g.translate(R, R); g.rotate(Math.atan2(ax, -az)); g.fillStyle = '#ffe14a'; g.strokeStyle = '#2a1a4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 10); g.lineTo(0, 5); g.lineTo(-10, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(R, R, R - 4, 0, 7); g.stroke();
  }
  // présence par jeu (réponse du serveur)
  if (BR.Net && BR.Net.on) BR.Net.on('presence', m => { if (V) { V.pres = m.p || {}; paintBoard(); } });
})();

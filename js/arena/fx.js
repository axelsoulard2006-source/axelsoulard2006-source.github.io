/* ===== arena/fx.js : effets visuels du jeu 2 (particules, croissants de taille, rayons, éclairs, ondes, marquages au sol, traînées, chiffres) =====
   Tous les effets « lumineux » utilisent des couleurs > 1 : le bloom les fait rayonner. */
(function () {
  const BR = window.BR;
  const V3 = THREE.Vector3;

  /* ---------- géométrie en arc (coordonnées polaires : u = angle, v = rayon) ---------- */
  const arcCache = {};
  function arcGeo(arc, segs) {
    const key = arc.toFixed(3) + ':' + segs;
    if (arcCache[key]) return arcCache[key];
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, a = -arc / 2 + u * arc;
      for (let j = 0; j <= 1; j++) { pos.push(Math.sin(a), 0, Math.cos(a)); uv.push(u, j); }
    }
    for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return (arcCache[key] = g);
  }
  // les deux rangées de sommets sont sur le cercle unité ; le shader les place au rayon intérieur (uInner) ou extérieur (1)
  // croissant : légère spirale + ondulation du rayon (pas un arc de compas parfait), épaisseur qui gonfle au milieu du geste
  const SLASH_VS2 = `varying vec2 vUv; uniform float uInner, uMode, uSeed; void main(){ vUv = uv;
      float inner = uInner;
      if (uMode < 0.5) { float sw = sin(uv.x * 3.14159); inner = mix(1.0, uInner, 0.35 + 0.65 * sw); }
      float r = mix(inner, 1.0, uv.y);
      if (uMode < 0.5) r *= mix(0.88, 1.06, uv.x) * (1.0 + 0.035 * sin(uv.x * 11.0 + uSeed) + 0.02 * sin(uv.x * 23.0 + uSeed * 2.3));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x * r, 0.0, position.z * r, 1.0); }`;
  const SLASH_FS = `varying vec2 vUv; uniform float uProg, uFade, uMode, uSeed, uTime; uniform vec3 uColor;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      float u = vUv.x, v = vUv.y, a;
      if (uMode < 0.5) {               // croissant de taille : la tête avance, la queue s'effiloche en volutes
        if (u > uProg) discard;
        float k = u / max(uProg, 1e-3);
        float flow = n2(vec2(u * 7.0 - uTime * 4.0 + uSeed, v * 3.0)) * 0.55 + n2(vec2(u * 22.0 - uTime * 9.0, v * 9.0 + uSeed)) * 0.45;
        float streak = 0.65 + 0.35 * n2(vec2(v * 26.0 + uSeed, u * 2.0));              // filets dans le sens du geste
        float outer = 1.0 - smoothstep(0.82 - flow * 0.22, 1.0, v);                      // bord extérieur irrégulier
        float body = smoothstep(0.0, 0.5, v) * outer;
        float dissolve = smoothstep(uFade * 1.15 - 0.1, uFade * 1.15 + 0.1, flow * 0.8 + k * 0.35);   // disparition en lambeaux
        a = body * pow(k, 1.3) * streak * dissolve;
        float hot = smoothstep(0.55, 0.92, v) * smoothstep(0.55, 1.0, k);
        vec3 c = mix(uColor * 1.5, vec3(2.6, 2.5, 2.3), hot);
        gl_FragColor = vec4(c * (1.0 + 0.25 * flow), a);
      } else {                          // anneau (onde de choc)
        float body = smoothstep(0.0, 0.5, v) * (1.0 - smoothstep(0.7, 1.0, v));
        a = body * (1.0 - uFade);
        vec3 c = mix(uColor, vec3(2.0), smoothstep(0.5, 0.8, v) * (1.0 - uFade));
        gl_FragColor = vec4(c * 1.5, a);
      }
    }`;

  /* ---------- marquage au sol (attaques du boss) ---------- */
  // uWarn : derniers instants avant l'impact (fenêtre d'esquive parfaite) -> le marquage vire au blanc et clignote
  const DECAL_FS = `varying vec2 vUv; uniform float uProg, uShape, uArc, uInner, uAlpha, uTime, uWarn; uniform vec3 uColor;
    void main(){
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), edge, fill, inside;
      if (uShape < 0.5) {                                  // disque
        inside = step(r, 1.0); edge = smoothstep(0.9, 0.97, r) * inside; fill = step(r, uProg) * inside;
      } else if (uShape < 1.5) {                           // secteur (cône), orienté +y
        float ang = abs(atan(p.x, p.y)); inside = step(r, 1.0) * step(ang, uArc * 0.5);
        edge = max(smoothstep(0.92, 0.98, r), smoothstep(uArc * 0.5 - 0.05, uArc * 0.5, ang)) * inside; fill = step(r, uProg) * inside;
      } else if (uShape < 2.5) {                           // rectangle (ligne), remplissage depuis l'origine (bas)
        vec2 q = abs(p); inside = step(q.x, 1.0) * step(q.y, 1.0);
        edge = max(smoothstep(0.88, 0.97, q.x), smoothstep(0.96, 0.995, q.y)) * inside; fill = step(vUv.y, uProg) * inside;
      } else {                                             // anneau
        inside = step(r, 1.0) * step(uInner, r); edge = (smoothstep(0.93, 0.98, r) + 1.0 - smoothstep(uInner, uInner + 0.04, r)) * inside; fill = inside * step(r, mix(uInner, 1.0, uProg));
      }
      if (inside < 0.5) discard;
      float pulse = 0.85 + 0.15 * sin(uTime * 18.0);
      float a = (0.16 + 0.34 * fill + 0.9 * edge) * uAlpha * pulse;
      vec3 c = uColor * (1.0 + edge * 1.4 + fill * 0.4);
      float w = uWarn * (0.65 + 0.35 * sin(uTime * 60.0));
      c = mix(c, vec3(2.6, 2.6, 2.8), w * (0.35 + edge * 0.65));
      a = min(1.0, a + w * (0.12 + edge * 0.5));
      gl_FragColor = vec4(c, a);
    }`;

  /* ---------- rayon (cylindre) ---------- */
  const BEAM_VS = 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
  const BEAM_FS = `varying vec2 vUv; varying vec3 vN, vV; uniform float uTime, uAlpha, uCore; uniform vec3 uColor;
    void main(){
      float f = abs(dot(normalize(vN), normalize(vV)));
      float flow = 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 50.0) * sin(vUv.x * 12.0 + uTime * 9.0);
      float a = pow(f, uCore) * uAlpha * flow;
      vec3 c = mix(uColor * 1.8, vec3(3.0), pow(f, 6.0) * 0.8);
      gl_FragColor = vec4(c, a);
    }`;

  /* ---------- particules ---------- */
  const P_VS = `attribute float aSize, aAlpha; attribute vec3 aColor; varying vec3 vC; varying float vA; uniform float uScale;
    void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
  const P_FS_ADD = 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r, 1.8) * vA; gl_FragColor = vec4(vC, a); }';
  const P_FS_NRM = 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = (1.0 - smoothstep(0.4, 1.0, r)) * vA; gl_FragColor = vec4(vC, a); }';

  function Particles(scene, max, additive) {
    const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
    const vel = new Float32Array(max * 3), life = new Float32Array(max), maxl = new Float32Array(max), s0 = new Float32Array(max), s1 = new Float32Array(max), grav = new Float32Array(max), drag = new Float32Array(max), world = new Uint8Array(max), a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 } }, vertexShader: P_VS, fragmentShader: additive ? P_FS_ADD : P_FS_NRM, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 5 : 4; scene.add(pts);
    let head = 0;
    const P = {
      mat,
      spawn(x, y, z, vx, vy, vz, o) {
        const i = head; head = (head + 1) % max;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
        col[i * 3] = o.r; col[i * 3 + 1] = o.g; col[i * 3 + 2] = o.b;
        life[i] = maxl[i] = o.life; s0[i] = o.size; s1[i] = o.size1 == null ? o.size * 0.2 : o.size1; grav[i] = o.grav || 0; drag[i] = o.drag || 0; world[i] = o.world ? 1 : 0; a0[i] = o.alpha || 1;
        size[i] = o.size; alpha[i] = a0[i];
      },
      update(dt, wdt) {
        for (let i = 0; i < max; i++) {
          if (life[i] <= 0) { if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; } continue; }
          const d = world[i] ? wdt : dt; if (d <= 0) continue;
          life[i] -= d; const k = Math.max(0, life[i] / maxl[i]);
          const dr = Math.max(0, 1 - drag[i] * d);
          vel[i * 3] *= dr; vel[i * 3 + 1] = vel[i * 3 + 1] * dr - grav[i] * d; vel[i * 3 + 2] *= dr;
          pos[i * 3] += vel[i * 3] * d; pos[i * 3 + 1] += vel[i * 3 + 1] * d; pos[i * 3 + 2] += vel[i * 3 + 2] * d;
          if (pos[i * 3 + 1] < 0.02 && grav[i] > 0) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.35; vel[i * 3] *= 0.7; vel[i * 3 + 2] *= 0.7; }
          size[i] = s1[i] + (s0[i] - s1[i]) * k; alpha[i] = a0[i] * Math.min(1, k * 2.5);
        }
        g.attributes.position.needsUpdate = true; g.attributes.aColor.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
      },
      dispose() { scene.remove(pts); g.dispose(); mat.dispose(); },
    };
    return P;
  }

  /* ---------- traînée d'arme (ruban) ---------- */
  // traînée « organique » : les positions de l'arme sont mémorisées avec leur âge (longueur fixe en temps, quelle que soit
  // la fluidité), lissées par une courbe de Catmull-Rom, et le shader dessine un cœur brûlant + des volutes qui se déchirent
  const TRAIL_FS = `uniform vec3 uColor; uniform float uTime; varying float vA; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      float u = vUv.x, v = vUv.y;                           // u : poignée -> pointe ; v : tête -> queue
      float wisp = n2(vec2(u * 6.0 + uTime * 3.0, v * 9.0 - uTime * 7.0)) * 0.6 + n2(vec2(u * 15.0, v * 22.0 - uTime * 11.0)) * 0.4;
      float edge = smoothstep(0.0, 0.35, u) * (1.0 - smoothstep(0.92, 1.0, u));
      float tear = smoothstep(v * 0.9 - 0.05, v * 0.9 + 0.25, wisp);    // la queue se déchire en volutes
      float core = pow(smoothstep(0.55, 0.96, u), 2.0) * (1.0 - v);
      float a = vA * edge * mix(1.0, tear, 0.85);
      vec3 c = mix(uColor * 1.7, vec3(2.8, 2.7, 2.5), core);
      gl_FragColor = vec4(c, a * (0.55 + core * 0.6));
    }`;
  function Trail(scene, color) {
    const R = 40, MAXAGE = 0.17;
    const pos = new Float32Array(R * 2 * 3), al = new Float32Array(R * 2), uvs = new Float32Array(R * 2 * 2);
    const idx = []; for (let i = 0; i < R - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute float aA; varying float vA; varying vec2 vUv; void main(){ vA = aA; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: TRAIL_FS,
    });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 6; scene.add(mesh);
    const hist = []; let power = 0, time = 0;
    const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
    return {
      mesh,
      push(a, b, on, dt) {
        time += dt; mat.uniforms.uTime.value = time;
        power += ((on ? 1 : 0) - power) * Math.min(1, dt * (on ? 30 : 7));
        for (const h of hist) h[6] += dt;
        hist.unshift([a.x, a.y, a.z, b.x, b.y, b.z, 0]);
        while (hist.length > 3 && hist[hist.length - 2][6] > MAXAGE) hist.pop();
        if (hist.length > 40) hist.length = 40;
        const n = hist.length;
        if (n < 2) { mesh.visible = false; return; }
        const span = Math.min(MAXAGE, hist[n - 1][6]) || 1e-3;
        for (let i = 0; i < R; i++) {
          // échantillon le long de la courbe (indice fractionnaire dans l'historique)
          const f = (i / (R - 1)) * (n - 1), j = Math.min(n - 2, Math.floor(f)), t = f - j;
          const P = k => hist[Math.max(0, Math.min(n - 1, k))];
          const p0 = P(j - 1), p1 = P(j), p2 = P(j + 1), p3 = P(j + 2);
          for (let c = 0; c < 6; c++) pos[i * 6 + c] = cr(p0[c], p1[c], p2[c], p3[c], t);
          const age = p1[6] + (p2[6] - p1[6]) * t, k = Math.max(0, 1 - age / span), fade = Math.pow(k, 1.3) * power;
          al[i * 2] = fade; al[i * 2 + 1] = fade;
          const v = 1 - k; uvs[i * 4] = 0; uvs[i * 4 + 1] = v; uvs[i * 4 + 2] = 1; uvs[i * 4 + 3] = v;
        }
        g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true; g.attributes.uv.needsUpdate = true;
        mesh.visible = power > 0.02;
      },
      setColor(c) { mat.uniforms.uColor.value.set(c); },
      dispose() { scene.remove(mesh); g.dispose(); mat.dispose(); },
    };
  }

  /* ---------- éclair (rubans en croix pour être visible de partout) ---------- */
  function boltGeo(a, b, segs, jit) {
    const pts = [a.clone()];
    const d = b.clone().sub(a), L = d.length(), n1 = new V3(-d.z, 0, d.x).normalize(), n2 = new V3().crossVectors(d, n1).normalize();
    for (let i = 1; i < segs; i++) { const k = i / segs; const p = a.clone().addScaledVector(d, k).addScaledVector(n1, (Math.random() - 0.5) * jit * L * 0.12).addScaledVector(n2, (Math.random() - 0.5) * jit * L * 0.12); pts.push(p); }
    pts.push(b.clone());
    const pos = [], al = [], idx = [];
    const w = 0.09 + L * 0.004;
    for (let pass = 0; pass < 2; pass++) {
      const off = pass ? n2 : n1, base = pos.length / 3;
      pts.forEach((p, i) => { const k = 1 - Math.abs(i / (pts.length - 1) - 0.5) * 0.6; pos.push(p.x - off.x * w * k, p.y - off.y * w * k, p.z - off.z * w * k, p.x + off.x * w * k, p.y + off.y * w * k, p.z + off.z * w * k); al.push(0, 1); });
      for (let i = 0; i < pts.length - 1; i++) { const q = base + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aE', new THREE.Float32BufferAttribute(al, 1)); g.setIndex(idx);
    return g;
  }
  const BOLT_MAT = () => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x9ad8ff) }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float aE; varying float vE; void main(){ vE = aE; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uA; varying float vE; void main(){ float c = 1.0 - abs(vE - 0.5) * 2.0; float a = pow(c, 1.5) * uA; gl_FragColor = vec4(mix(uColor * 2.0, vec3(3.0), pow(c, 4.0)), a); }',
  });

  /* =====================================================================
     Système d'effets d'une partie
     ===================================================================== */
  BR.AFX = {};
  BR.AFX.create = function (scene, cam, hudEl) {
    const add = Particles(scene, 5000, true), nrm = Particles(scene, 1500, false);
    const items = [];            // effets maillés temporaires
    const lights = [];
    for (let i = 0; i < 8; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.userData = { t: 0, life: 1, i0: 0 }; scene.add(l); lights.push(l); }
    const unitBox = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(1, 24, 16), cyl = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), cone = new THREE.ConeGeometry(1, 1, 24, 1, true);
    cyl.translate(0, 0.5, 0);
    const planeG = new THREE.PlaneGeometry(2, 2); planeG.rotateX(-Math.PI / 2);
    const C = c => (c && c.isColor) ? c : new THREE.Color(c == null ? 0xffffff : c);
    let time = 0;

    const fx = { scene, time: 0 };
    function track(obj, life, upd, world, onEnd) { const it = { obj, t: 0, life, upd, world: !!world, onEnd, dead: false }; scene.add(obj); items.push(it); return it; }
    function killItem(it) {
      it.dead = true; scene.remove(it.obj);
      it.obj.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } if (o.geometry && o.geometry.userData.own) o.geometry.dispose(); });
      if (it.onEnd) it.onEnd();
    }
    fx.kill = it => { if (it && !it.dead) killItem(it); };

    /** gerbe de particules : o = { n, color, speed, life, size, grav, spread (0..1, 1 = sphère), dir (V3), drag, kind: 'add' | 'smoke', up } */
    fx.burst = function (p, o) {
      o = o || {}; const n = o.n || 20, c = C(o.color || 0xffc070), sp = o.speed == null ? 8 : o.speed, P = o.kind === 'smoke' ? nrm : add;
      const mul = o.kind === 'smoke' ? 1 : (o.bright || 1.6);
      for (let i = 0; i < n; i++) {
        let vx = Math.random() * 2 - 1, vy = Math.random() * 2 - 1, vz = Math.random() * 2 - 1;
        const l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l;
        if (o.dir) { const s = o.spread == null ? 0.4 : o.spread; vx = o.dir.x + vx * s; vy = o.dir.y + vy * s; vz = o.dir.z + vz * s; }
        if (o.up) vy = Math.abs(vy) + o.up;
        if (o.flat) vy *= 0.15;
        const s = sp * (0.35 + Math.random() * 0.65);
        P.spawn(p.x + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0), p.y + (o.jitter ? (Math.random() - 0.5) * o.jitter * 0.5 : 0), p.z + (o.jitter ? (Math.random() - 0.5) * o.jitter : 0),
          vx * s, vy * s, vz * s, { r: c.r * mul, g: c.g * mul, b: c.b * mul, life: (o.life || 0.6) * (0.5 + Math.random() * 0.7), size: (o.size || 0.35) * (0.6 + Math.random() * 0.8), size1: o.size1, grav: o.grav == null ? 9 : o.grav, drag: o.drag == null ? 1.5 : o.drag, world: o.world, alpha: o.alpha });
      }
    };
    /** particule isolée */
    fx.spark = function (p, v, o) { const c = C(o.color), m = o.bright || 1.6; (o.kind === 'smoke' ? nrm : add).spawn(p.x, p.y, p.z, v.x, v.y, v.z, { r: c.r * m, g: c.g * m, b: c.b * m, life: o.life || 0.5, size: o.size || 0.3, size1: o.size1, grav: o.grav || 0, drag: o.drag || 0, world: o.world, alpha: o.alpha }); };

    /** lumière ponctuelle brève */
    fx.light = function (p, color, intensity, dist, life) {
      let l = lights.find(x => x.intensity <= 0.01) || lights.reduce((a, b) => (a.userData.t / a.userData.life > b.userData.t / b.userData.life ? a : b));
      l.position.copy(p); l.color.set(color); l.distance = dist || 14; l.userData.t = 0; l.userData.life = life || 0.3; l.userData.i0 = intensity || 3; l.intensity = l.userData.i0;
    };

    /** croissant de taille : o = { r, arc (rad), inner, color, life, tilt (rad autour de l'axe avant), pitch, sweep (durée de la tête) } */
    fx.slash = function (p, yaw, o) {
      o = o || {};
      const g = arcGeo(o.arc || 2.4, 40);
      const mat = new THREE.ShaderMaterial({ uniforms: { uProg: { value: 0 }, uFade: { value: 0 }, uMode: { value: 0 }, uSeed: { value: Math.random() * 50 }, uTime: { value: 0 }, uColor: { value: C(o.color || 0x9ad8ff) }, uInner: { value: o.inner == null ? 0.55 : o.inner } }, vertexShader: SLASH_VS2, fragmentShader: SLASH_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 7;
      const holder = new THREE.Group(); holder.position.copy(p); holder.rotation.order = 'YXZ'; holder.rotation.y = yaw; holder.add(m);
      m.rotation.z = o.tilt || 0; m.rotation.x = o.pitch || 0;
      if (o.flip) m.scale.x = -1;
      const r = o.r || 2.6; m.scale.set((o.flip ? -1 : 1) * r, r, r);
      const life = o.life || 0.28, sweep = o.sweep || life * 0.45;
      // la tête accélère puis freine (pas de vitesse constante) ; le croissant continue de s'ouvrir et de tourner un peu après le coup
      const rot0 = m.rotation.y;
      return track(holder, life, (k, obj, dt, t) => {
        const q = Math.min(1, t / sweep); mat.uniforms.uProg.value = 1 - Math.pow(1 - q, 2.2); mat.uniforms.uTime.value = t;
        mat.uniforms.uFade.value = Math.max(0, (t - sweep) / (life - sweep));
        const s = r * (1 + t * 0.9 - t * t * 0.6); m.scale.set((o.flip ? -1 : 1) * s, s, s); m.rotation.y = rot0 + (o.flip ? -1 : 1) * t * 0.5;
      }, o.world);
    };
    /** onde de choc au sol (ou inclinée) : o = { r0, r1, life, color, width (0..1), y, tilt } */
    fx.ring = function (p, o) {
      o = o || {};
      const mat = new THREE.ShaderMaterial({ uniforms: { uProg: { value: 1 }, uFade: { value: 0 }, uMode: { value: 1 }, uSeed: { value: 0 }, uTime: { value: 0 }, uColor: { value: C(o.color || 0xffd38a) }, uInner: { value: 1 - (o.width || 0.25) } }, vertexShader: SLASH_VS2, fragmentShader: SLASH_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      // o.arc : onde partielle (arc de cercle centré sur o.rotY) — les attaques « à trou » du boss
      const m = new THREE.Mesh(o.arc ? arcGeo(o.arc, Math.max(8, Math.round(64 * o.arc / 6.283))) : arcGeo(Math.PI * 2, 64), mat); m.frustumCulled = false; m.renderOrder = 7;
      m.position.set(p.x, (p.y || 0) + (o.y || 0.06), p.z); if (o.tilt) m.rotation.x = o.tilt; if (o.rotY) m.rotation.y = o.rotY;
      const r0 = o.r0 == null ? 0.3 : o.r0, r1 = o.r1 || 6, life = o.life || 0.45;
      return track(m, life, (k, obj, dt, t) => {
        const e = o.linear ? t / life : 1 - Math.pow(1 - t / life, 2.4); const r = Math.max(0.05, r0 + (r1 - r0) * e); m.scale.set(r, r, r);
        if (o.band) mat.uniforms.uInner.value = Math.max(0, 1 - o.band / r);
        mat.uniforms.uFade.value = o.linear ? Math.max(0, (t / life - 0.88) / 0.12) : Math.pow(t / life, 1.4);
      }, o.world);
    };
    /** boule de lumière qui gonfle puis s'éteint */
    fx.flash = function (p, o) {
      o = o || {};
      const mat = new THREE.MeshBasicMaterial({ color: C(o.color || 0xffe0a0).clone().multiplyScalar(o.bright || 2.5), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(sph, mat); m.position.copy(p); const r = o.r || 1.5, life = o.life || 0.25;
      if (o.light !== false) fx.light(p, o.color || 0xffe0a0, o.intensity || 4, r * 6, life * 1.5);
      return track(m, life, (k, obj, dt, t) => { const e = t / life; m.scale.setScalar(r * (0.4 + e * 0.9)); mat.opacity = 1 - e; }, o.world);
    };
    /** impact « organique » : éclair bref, gerbe d'étincelles étirées dans le sens du coup, onde face caméra, éclats qui retombent
        o = { color, crit, size, n } — dir : direction du coup (de l'attaquant vers la cible) */
    const ringG = new THREE.RingGeometry(0.55, 1, 40);
    fx.impact = function (p, dir, o) {
      o = o || {}; const col = C(o.color || 0xffe0a0), sz = (o.size || 1) * (o.crit ? 1.35 : 1), n = o.n || (o.crit ? 14 : 9);
      const d0 = (dir && dir.lengthSq() > 1e-6 ? dir.clone() : new V3(0, 0, 1)).normalize();
      // étincelles étirées (rubans recalculés face caméra à chaque image)
      const pos = new Float32Array(n * 4 * 3), al = new Float32Array(n * 4), ix = [];
      for (let i = 0; i < n; i++) { const a = i * 4; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage)); g.setIndex(ix); g.userData.own = true;
      const m = new THREE.ShaderMaterial({ uniforms: { uColor: { value: col } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(mix(uColor * 1.8, vec3(3.0), vA * 0.7), vA); }' });
      const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 8;
      const S2 = [];
      for (let i = 0; i < n; i++) {
        const r = new V3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
        const d = d0.clone().multiplyScalar(0.9).add(r.multiplyScalar(0.85)).normalize(); if (d.y < -0.3) d.y *= -0.5;
        S2.push({ d, v: (9 + Math.random() * 14) * sz, len: (0.5 + Math.random() * 0.9) * sz, w: (0.035 + Math.random() * 0.05) * sz, life: 0.14 + Math.random() * 0.16 });
      }
      const cp = new V3(), side = new V3(), head = new V3(), tail = new V3();
      track(mesh, 0.32, (k, obj, dt, t) => {
        cam.getWorldPosition(cp);
        S2.forEach((s, i) => {
          const q = Math.min(1, t / s.life), e = 1 - Math.pow(1 - q, 2.5);
          head.copy(p).addScaledVector(s.d, s.v * s.life * e * 0.6);
          tail.copy(head).addScaledVector(s.d, -s.len * (1 - q * 0.7));
          side.copy(s.d).cross(cp.clone().sub(head)).normalize().multiplyScalar(s.w * (1 - q));
          const b = i * 12;
          pos[b] = head.x + side.x; pos[b + 1] = head.y + side.y; pos[b + 2] = head.z + side.z;
          pos[b + 3] = head.x - side.x; pos[b + 4] = head.y - side.y; pos[b + 5] = head.z - side.z;
          pos[b + 6] = tail.x + side.x * 0.2; pos[b + 7] = tail.y + side.y * 0.2; pos[b + 8] = tail.z + side.z * 0.2;
          pos[b + 9] = tail.x - side.x * 0.2; pos[b + 10] = tail.y - side.y * 0.2; pos[b + 11] = tail.z - side.z * 0.2;
          const a = q >= 1 ? 0 : 1 - q; al[i * 4] = a; al[i * 4 + 1] = a; al[i * 4 + 2] = 0; al[i * 4 + 3] = 0;
        });
        g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true;
      }, o.world);
      // onde de choc face caméra (anneau qui s'ouvre et s'amincit)
      const rm = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringG, rm); ring.position.copy(p);
      track(ring, 0.22, (k, obj, dt, t) => { const e = 1 - Math.pow(1 - t / 0.22, 3); ring.lookAt(cam.getWorldPosition(cp)); ring.scale.setScalar((0.25 + e * 1.3) * sz); rm.opacity = 0.9 * (1 - t / 0.22); }, o.world);
      fx.flash(p, { color: col, r: 0.55 * sz, life: 0.1, intensity: o.crit ? 3 : 1.6, light: !!o.crit });
      // éclats lourds qui retombent + quelques braises
      fx.burst(p, { n: o.crit ? 10 : 6, color: 0x3a342e, kind: 'smoke', speed: 6 * sz, dir: d0, spread: 0.9, life: 0.6, size: 0.18 * sz, size1: 0.12, grav: 22, drag: 0.5 });
      fx.burst(p, { n: o.crit ? 14 : 8, color: col, speed: 7 * sz, dir: d0, spread: 1, life: 0.45, size: 0.16, grav: 14, drag: 1 });
    };
    /** éclats de roche/sol projetés par un impact lourd : vrais petits volumes qui tournoient, rebondissent et s'enfoncent
        o = { n, r (rayon de départ), speed, color, size, up, life } */
    const rockG = new THREE.IcosahedronGeometry(1, 0);
    fx.debris = function (p, o) {
      o = o || {};
      const n = o.n || 12, life = o.life || 1.6, grp = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: C(o.color || 0x2a231e).clone().convertSRGBToLinear(), roughness: 0.95, flatShading: true, transparent: true, opacity: 1 });
      const R = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(rockG, mat), a = Math.random() * Math.PI * 2, rr = (o.r || 1) * Math.sqrt(Math.random());
        const s = (o.size || 0.28) * (0.45 + Math.random() * 1.1);
        m.scale.set(s * (0.7 + Math.random() * 0.6), s * (0.5 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.6));
        m.position.set(p.x + Math.cos(a) * rr, (p.y || 0) + 0.15, p.z + Math.sin(a) * rr);
        const sp = (o.speed || 9) * (0.4 + Math.random() * 0.8);
        R.push({ m, v: new V3(Math.cos(a) * sp * 0.6, (o.up || 1) * sp * (0.6 + Math.random() * 0.7), Math.sin(a) * sp * 0.6), w: new V3(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7), rest: false, s });
        grp.add(m);
      }
      return track(grp, life, (k, obj, dt, t) => {
        for (const r of R) {
          if (!r.rest) {
            r.v.y -= 30 * dt; r.m.position.addScaledVector(r.v, dt);
            r.m.rotation.x += r.w.x * dt; r.m.rotation.y += r.w.y * dt; r.m.rotation.z += r.w.z * dt;
            if (r.m.position.y < r.s * 0.4) { r.m.position.y = r.s * 0.4; if (Math.abs(r.v.y) < 2.5) { r.rest = true; } else { r.v.y *= -0.32; r.v.x *= 0.55; r.v.z *= 0.55; r.w.multiplyScalar(0.5); } }
          }
        }
        // à la fin, les éclats s'enfoncent dans le sol et disparaissent
        const e = Math.max(0, (t - life * 0.7) / (life * 0.3)); mat.opacity = 1 - e; if (e > 0) R.forEach(r => { r.m.position.y -= dt * 0.4; });
      }, o.world);
    };
    /** colonne de lumière */
    fx.pillar = function (p, o) {
      o = o || {};
      const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uCore: { value: 1.6 }, uColor: { value: C(o.color || 0xffe9a8) } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const m = new THREE.Mesh(cyl, mat); m.position.set(p.x, p.y || 0, p.z); const r = o.r || 1, h = o.h || 14, life = o.life || 0.6; m.scale.set(r, h, r);
      return track(m, life, (k, obj, dt, t) => { mat.uniforms.uTime.value += dt; const e = t / life; mat.uniforms.uAlpha.value = (1 - e) * (o.alpha || 1); m.scale.set(r * (1 + e * (o.grow == null ? 0.6 : o.grow)), h, r * (1 + e * (o.grow == null ? 0.6 : o.grow))); }, o.world);
    };
    /** rayon persistant (renvoie une poignée : set(from, to, largeur), kill) */
    fx.beam = function (o) {
      o = o || {};
      const grp = new THREE.Group(); grp.frustumCulled = false;
      const mk = (core, alpha) => { const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uAlpha: { value: alpha }, uCore: { value: core }, uColor: { value: C(o.color || 0x7af0ff) } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); const m = new THREE.Mesh(cyl, mat); m.frustumCulled = false; grp.add(m); return m; };
      const outer = mk(1.2, 0.8), inner = mk(3.5, 1.2);
      let width = o.width || 1, alpha = 1, from = new V3(), to = new V3(0, 0, 1);
      const it = track(grp, 1e9, (k, obj, dt) => {
        outer.material.uniforms.uTime.value += dt; inner.material.uniforms.uTime.value += dt * 1.3;
        const d = to.clone().sub(from), L = Math.max(0.01, d.length());
        grp.position.copy(from); grp.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
        const wob = 1 + Math.sin(fx.time * 60) * 0.06;
        outer.scale.set(width * wob, L, width * wob); inner.scale.set(width * 0.38, L, width * 0.38);
        outer.material.uniforms.uAlpha.value = 0.8 * alpha; inner.material.uniforms.uAlpha.value = 1.3 * alpha;
      }, o.world);
      return { set(f, t2, w, a) { from.copy(f); to.copy(t2); if (w != null) width = w; if (a != null) alpha = a; }, kill() { fx.kill(it); }, it };
    };
    /** éclair entre deux points */
    fx.bolt = function (a, b, o) {
      o = o || {};
      const g = boltGeo(a, b, o.segs || 10, o.jitter == null ? 1 : o.jitter); g.userData.own = true;
      const mat = BOLT_MAT(); mat.uniforms.uColor.value = C(o.color || 0x9ad8ff);
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 8;
      const life = o.life || 0.18;
      if (o.light !== false) fx.light(b, o.color || 0x9ad8ff, 3, 12, life);
      return track(m, life, (k, obj, dt, t) => { mat.uniforms.uA.value = (1 - t / life) * (0.6 + Math.random() * 0.4); }, o.world);
    };
    /** marquage d'attaque au sol : shape 'circle' | 'sector' | 'line' | 'ring' ; dur = temps avant l'impact.
        o = { r, arc, len, width, inner, yaw, color, dur, hold } -> poignée { it, set(p, yaw) } */
    fx.decal = function (p, shape, o) {
      o = o || {};
      const sh = { circle: 0, sector: 1, line: 2, ring: 3 }[shape];
      const mat = new THREE.ShaderMaterial({ uniforms: { uProg: { value: 0 }, uShape: { value: sh }, uArc: { value: o.arc || 1.6 }, uInner: { value: o.inner || 0.6 }, uAlpha: { value: 0 }, uTime: { value: 0 }, uWarn: { value: 0 }, uColor: { value: C(o.color || 0xff3030) } }, fragmentShader: DECAL_FS, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
      const m = new THREE.Mesh(planeG, mat); m.renderOrder = 3; m.frustumCulled = false;
      const holder = new THREE.Group(); holder.add(m); holder.position.set(p.x, (p.y || 0) + 0.04, p.z); holder.rotation.y = o.yaw || 0;
      if (shape === 'line') { m.scale.set(o.width / 2, 1, o.len / 2); m.position.z = o.len / 2; m.rotation.y = Math.PI; }
      else { const r = o.r || 4; m.scale.set(r, 1, r); if (shape === 'sector') m.rotation.y = Math.PI; }
      const dur = o.dur || 1, hold = o.hold || 0.12;
      const wd = o.noWarn ? 0 : Math.min(0.3, dur * 0.4);
      const it = track(holder, dur + hold, (k, obj, dt, t) => { mat.uniforms.uTime.value = t; mat.uniforms.uProg.value = Math.min(1, t / dur); mat.uniforms.uWarn.value = wd > 0 && t > dur - wd && t < dur + 0.08 ? Math.min(1, (t - dur + wd) / wd) : 0; mat.uniforms.uAlpha.value = Math.min(1, t * 6) * (t > dur ? Math.max(0, 1 - (t - dur) / hold) : 1); }, o.world !== false);
      return { it, set(q, yaw) { holder.position.set(q.x, (q.y || 0) + 0.04, q.z); if (yaw != null) holder.rotation.y = yaw; } };
    };
    /** objet quelconque animé par une fonction (k = 0..1) ; renvoie l'entrée */
    fx.add = (obj, life, upd, world, onEnd) => track(obj, life, upd, world, onEnd);
    fx.geo = { sph, cyl, cone, box: unitBox };

    /** traînée d'arme */
    fx.trail = color => Trail(scene, color);

    /* ---------- chiffres de dégâts (DOM) ---------- */
    const nums = [];
    const tmp = new V3();
    fx.num = function (p, v, o) {
      o = o || {};
      if (!hudEl) return;
      const e = document.createElement('div'); e.className = 'a-num' + (o.crit ? ' crit' : '') + (o.cls ? ' ' + o.cls : '');
      e.textContent = typeof v === 'number' ? BR.fmt(v) : v; if (o.color) e.style.color = o.color;
      hudEl.appendChild(e);
      nums.push({ e, p: p.clone().add(new V3((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8)), t: 0, life: o.life || (o.crit ? 1.1 : 0.85), vy: 1.6 + Math.random() });
      if (nums.length > 60) { const n = nums.shift(); n.e.remove(); }
    };

    fx.update = function (dt, wdt) {
      time += dt; fx.time = time;
      add.update(dt, wdt); nrm.update(dt, wdt);
      add.mat.uniforms.uScale.value = nrm.mat.uniforms.uScale.value = window.innerHeight * 0.9;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; if (it.dead) { items.splice(i, 1); continue; }
        const d = it.world ? wdt : dt; it.t += d;
        if (it.t >= it.life) { killItem(it); items.splice(i, 1); continue; }
        if (it.upd) it.upd(it.t / it.life, it.obj, d, it.t);
      }
      for (const l of lights) { if (l.intensity <= 0) continue; l.userData.t += dt; const k = 1 - l.userData.t / l.userData.life; l.intensity = k > 0 ? l.userData.i0 * k * k : 0; }
      // chiffres
      const w = window.innerWidth, h = window.innerHeight;
      for (let i = nums.length - 1; i >= 0; i--) {
        const n = nums[i]; n.t += dt; n.p.y += n.vy * dt; n.vy *= 0.92;
        if (n.t > n.life) { n.e.remove(); nums.splice(i, 1); continue; }
        tmp.copy(n.p).project(cam);
        if (tmp.z > 1) { n.e.style.display = 'none'; continue; }
        n.e.style.display = '';
        const sc = n.t < 0.12 ? 1.6 - n.t * 5 : 1;
        n.e.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px,${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${sc})`;
        n.e.style.opacity = String(Math.min(1, (n.life - n.t) * 4));
      }
    };
    fx.clear = function () {
      for (const it of items) if (!it.dead) killItem(it);
      items.length = 0; nums.forEach(n => n.e.remove()); nums.length = 0;
    };
    fx.dispose = function () { fx.clear(); add.dispose(); nrm.dispose(); lights.forEach(l => scene.remove(l)); };
    return fx;
  };

  /* =====================================================================
     Post-traitement : bloom + étalonnage final (arrêt du temps, aberration, vignette, flash)
     ===================================================================== */
  BR.AFX.post = function (R, scene, cam, quality) {
    if (!THREE.EffectComposer || !THREE.UnrealBloomPass) return null;
    const w = window.innerWidth, h = window.innerHeight;
    let rt;
    try { rt = new THREE.WebGLRenderTarget(w, h, { type: R.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat }); } catch (e) { rt = undefined; }
    const comp = new THREE.EffectComposer(R, rt);
    comp.addPass(new THREE.RenderPass(scene, cam));
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), quality === 'low' ? 0.6 : 0.85, 0.55, 0.8);
    if (quality !== 'off') comp.addPass(bloom);
    const grade = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uStop: { value: 0 }, uRing: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uChrom: { value: 0 }, uVig: { value: 0.35 }, uFlash: { value: new THREE.Color(0, 0, 0) }, uSat: { value: 1 }, uTime: { value: 0 }, uAspect: { value: w / h }, uDomain: { value: 0 }, uDomCol: { value: new THREE.Color(1, 0.8, 0.3) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uStop, uRing, uChrom, uVig, uSat, uTime, uAspect, uDomain; uniform vec2 uCenter; uniform vec3 uFlash, uDomCol; varying vec2 vUv;
        vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
        void main(){
          vec2 uv = vUv; vec2 d = (uv - uCenter) * vec2(uAspect, 1.0); float r = length(d);
          // onde de l'arrêt du temps : distorsion sur un anneau qui s'étend
          float ringW = 0.06; float rk = exp(-pow((r - uRing) / ringW, 2.0)) * step(0.001, uRing) * (1.0 - smoothstep(1.2, 1.6, uRing));
          uv += normalize(d + 1e-5) / vec2(uAspect, 1.0) * rk * 0.03;
          float ca = uChrom * (0.4 + r);
          vec2 dir = normalize(d + 1e-5) / vec2(uAspect, 1.0);
          vec3 c = vec3(texture2D(tDiffuse, uv + dir * ca * 0.01).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir * ca * 0.01).b);
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, uSat);
          // temps figé : gris bleuté, négatif dans l'anneau
          vec3 frozen = vec3(l) * vec3(0.78, 0.86, 1.08);
          frozen = mix(frozen, vec3(0.9, 0.95, 1.1) - frozen * 0.9, rk);
          c = mix(c, frozen, uStop);
          // domaine : teinte dorée sur les bords
          c = mix(c, c * uDomCol * 1.25, uDomain * smoothstep(0.3, 1.1, r) * 0.6);
          c += uFlash;
          c *= 1.0 - uVig * smoothstep(0.45, 1.25, r);
          gl_FragColor = vec4(toSRGB(c), 1.0);
        }`,
    });
    comp.addPass(grade);
    return {
      comp, bloom, grade: grade.uniforms,
      setSize(w2, h2) { comp.setSize(w2, h2); bloom.setSize(w2, h2); grade.uniforms.uAspect.value = w2 / h2; },
      render(dt) { grade.uniforms.uTime.value += dt; comp.render(dt); },
      dispose() { try { comp.renderTarget1.dispose(); comp.renderTarget2.dispose(); bloom.dispose && bloom.dispose(); } catch (e) {} },
    };
  };
})();

/* ===== aura.js : effets d'aura autour des personnages (particules, flamme enveloppante, éclairs, ondes de choc…)
   Plus l'aura est rare, plus elle est spectaculaire. L'intensité augmente quand le personnage bouge / court. ===== */
(function () {
  const BR = window.BR;
  const AF = (BR.AuraFX = {});
  const col = c => new THREE.Color(c);

  /* ---------- particules ---------- */
  const PVS = `
    attribute float size; attribute float alpha; attribute vec3 tint; varying float vA; varying vec3 vC;
    void main(){ vA = alpha; vC = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
  const PFS = `
    uniform float kind; varying float vA; varying vec3 vC;
    void main(){
      vec2 p = gl_PointCoord - 0.5; float d = length(p);
      float a;
      if (kind < 0.5) a = smoothstep(0.5, 0.0, d);                              // braise / lumière
      else if (kind < 1.5) a = smoothstep(0.5, 0.15, d) * 0.85;                 // fumée
      else if (kind < 2.5) { vec2 q = abs(p); a = smoothstep(0.5, 0.35, q.x + q.y * 1.8) ; }   // pétale
      else { vec2 q = abs(p); a = max(smoothstep(0.08, 0.0, q.x) , smoothstep(0.08, 0.0, q.y)) * smoothstep(0.5, 0.1, d) + smoothstep(0.25, 0.0, d); } // étincelle en croix
      if (a * vA < 0.01) discard;
      gl_FragColor = vec4(vC, a * vA);
    }`;
  function Particles(n, kind, blending) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), tint = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1)); g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    const kindN = { ember: 0, mote: 0, frost: 3, spark: 3, wind: 0, smoke: 1, void: 1, petal: 2 }[kind] || 0;
    const mat = new THREE.ShaderMaterial({ uniforms: { kind: { value: kindN } }, vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false, blending: blending || THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
    const P = { pts, g, pos, size, alpha, tint, n, life: new Float32Array(n), max: new Float32Array(n), vel: new Float32Array(n * 3), ang: new Float32Array(n), rad: new Float32Array(n) };
    return P;
  }

  /* ---------- flamme enveloppante (cylindre ouvert, bruit qui monte) ---------- */
  const SVS = `varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
  const SFS = `
    uniform float time, power; uniform vec3 c1, c2; varying vec2 vUv; varying float vF;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
    void main(){
      vec2 p = vec2(vUv.x * 6.0, vUv.y * 2.0 - time * 1.6);
      float f = fbm(p + fbm(p * 1.7 + time * 0.3));
      float h0 = vUv.y;
      float shape = smoothstep(0.0, 0.12, h0) * pow(1.0 - h0, 1.4);
      float edge = pow(1.0 - vF, 1.3) * 0.85 + 0.15;
      float a = smoothstep(0.35 - h0 * 0.25, 0.95, f + 0.25 * (1.0 - h0)) * shape * edge * power;
      vec3 c = mix(c1, c2, smoothstep(0.4, 0.95, f) * (1.0 - h0 * 0.5));
      gl_FragColor = vec4(c, a);
    }`;
  function Shell(c1, c2, r, h, dark) {
    const mat = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, power: { value: 1 }, c1: { value: col(c1) }, c2: { value: col(c2) } }, vertexShader: SVS, fragmentShader: SFS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending });
    const g = new THREE.CylinderGeometry(r * 0.75, r, h, 24, 1, true); g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 2;
    return m;
  }

  /* ---------- éclairs : rubans épais en croix (visibles sous tous les angles), cœur brillant ou noir ---------- */
  function Bolts(n, color, black) {
    const segs = 7, quads = n * segs * 2, g = new THREE.BufferGeometry();
    const pos = new Float32Array(quads * 4 * 3), e = new Float32Array(quads * 4), idx = [];
    for (let q = 0; q < quads; q++) { const o = q * 4; e[o] = 0; e[o + 1] = 1; e[o + 2] = 0; e[o + 3] = 1; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aE', new THREE.BufferAttribute(e, 1)); g.setIndex(idx);
    const VS = 'attribute float aE; varying float vE; void main(){ vE = aE; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
    const glow = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uC: { value: col(color) }, uA: { value: 1 } }, vertexShader: VS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying float vE; void main(){ float c = 1.0 - abs(vE - 0.5) * 2.0; float a = pow(c, 1.4) * uA; gl_FragColor = vec4(mix(uC * 1.8, vec3(2.4), pow(c, 6.0)), a); }',
    }));
    glow.frustumCulled = false;
    const grp = new THREE.Group(); grp.add(glow);
    let core = null;
    if (black) {
      core = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        fragmentShader: 'varying float vE; void main(){ float c = 1.0 - abs(vE - 0.5) * 2.0; float a = smoothstep(0.45, 0.75, c); if (a < 0.02) discard; gl_FragColor = vec4(0.02, 0.0, 0.01, a * 0.95); }' }));
      core.frustumCulled = false; core.renderOrder = 3; grp.add(core);
    }
    glow.renderOrder = 4;
    return { grp, g, pos, n, segs, glow, core, t: 0 };
  }
  const _d = new THREE.Vector3(), _n1 = new THREE.Vector3(), _n2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function regenBolts(B, power, H) {
    const p = B.pos; let k = 0;
    const put = (x, y, z) => { p[k++] = x; p[k++] = y; p[k++] = z; };
    for (let b = 0; b < B.n; b++) {
      const on = Math.random() < 0.35 + power * 0.5;
      const a0 = Math.random() * 6.283, y0 = 0.2 + Math.random() * H * 0.9, r0 = 0.25 + Math.random() * 0.35;
      let x = Math.cos(a0) * r0, y = y0, z = Math.sin(a0) * r0;
      const da = (Math.random() - 0.5) * 2.2, dy = (Math.random() - 0.3) * 0.9;
      for (let s = 0; s < B.segs; s++) {
        const t = (s + 1) / B.segs, a = a0 + da * t, r = r0 + Math.sin(t * 3.1) * 0.25 + (Math.random() - 0.5) * 0.18;
        const nx = Math.cos(a) * r + (Math.random() - 0.5) * 0.12, ny = y0 + dy * t * 1.8 + (Math.random() - 0.5) * 0.2, nz = Math.sin(a) * r + (Math.random() - 0.5) * 0.12;
        if (!on) { for (let q = 0; q < 24; q++) p[k++] = 0; }
        else {
          const w = 0.035 * (1 - t * 0.5) * (0.7 + power * 0.6);
          _d.set(nx - x, ny - y, nz - z).normalize(); _n1.crossVectors(_d, _up); if (_n1.lengthSq() < 1e-4) _n1.set(1, 0, 0); _n1.normalize(); _n2.crossVectors(_d, _n1).normalize();
          for (const nn of [_n1, _n2]) { put(x - nn.x * w, y - nn.y * w, z - nn.z * w); put(x + nn.x * w, y + nn.y * w, z + nn.z * w); put(nx - nn.x * w, ny - nn.y * w, nz - nn.z * w); put(nx + nn.x * w, ny + nn.y * w, nz + nn.z * w); }
        }
        x = nx; y = ny; z = nz;
      }
    }
    B.g.attributes.position.needsUpdate = true;
  }

  /**
   * Crée l'aura d'un personnage. def = entrée de BR.AURAS. Retourne { group, update(dt, ctx), dispose }.
   * ctx : { speed, sprint, down, t }
   */
  AF.create = function (def, opt) {
    opt = opt || {};
    const fx = def.fx, H = 2.0, group = new THREE.Group();
    const c1 = col(fx.c), c2 = col(fx.c2);
    const tier = { commun: 0, rare: 1, epique: 2, legendaire: 3 }[def.rarity] || 0;
    const parts = [], disposables = [];
    // particules principales
    const kind = fx.parts || 'ember', dark = !!fx.dark;
    const P = Particles(fx.n, kind, kind === 'smoke' || kind === 'void' ? (dark ? THREE.NormalBlending : THREE.AdditiveBlending) : THREE.AdditiveBlending);
    group.add(P.pts); parts.push(P); disposables.push(P.g, P.pts.material);
    // seconde couche lumineuse pour les auras sombres (sinon trop discrètes)
    let P2 = null;
    if (dark) { P2 = Particles(Math.round(fx.n * 0.5), kind === 'smoke' ? 'ember' : 'spark'); group.add(P2.pts); parts.push(P2); disposables.push(P2.g, P2.pts.material); P2.light = true; }
    const spawn = (Q, i, init) => {
      const a = Math.random() * 6.283, r = 0.25 + Math.random() * (kind === 'wind' ? 0.5 : 0.35);
      Q.ang[i] = a; Q.rad[i] = r;
      Q.pos[i * 3] = Math.cos(a) * r; Q.pos[i * 3 + 1] = (init ? Math.random() * H : Math.random() * 0.4) + (kind === 'void' || kind === 'smoke' ? 0 : 0.05); Q.pos[i * 3 + 2] = Math.sin(a) * r;
      const up = kind === 'petal' ? 0.25 : kind === 'smoke' || kind === 'void' ? 0.9 : kind === 'wind' ? 0.15 : kind === 'frost' ? 0.35 : 1.1;
      Q.vel[i * 3] = (Math.random() - 0.5) * 0.3; Q.vel[i * 3 + 1] = up * (0.6 + Math.random() * 0.8); Q.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      Q.max[i] = 0.8 + Math.random() * 1.4; Q.life[i] = init ? Math.random() * Q.max[i] : Q.max[i];
      const m = Math.random(), cc = Q.light ? c1.clone().lerp(new THREE.Color(1, 1, 1), 0.4) : c1.clone().lerp(c2, m);
      Q.tint[i * 3] = cc.r; Q.tint[i * 3 + 1] = cc.g; Q.tint[i * 3 + 2] = cc.b;
      Q.size[i] = (kind === 'smoke' || kind === 'void' ? 0.35 : kind === 'petal' ? 0.12 : kind === 'wind' ? 0.06 : 0.07) * (0.6 + Math.random() * 0.8) * (Q.light ? 0.6 : 1);
    };
    parts.forEach(Q => { for (let i = 0; i < Q.n; i++) spawn(Q, i, true); });
    // flamme enveloppante
    const shells = [];
    if (fx.shell) {
      const s1 = Shell(fx.c, fx.c2, 0.62, 2.35, false); group.add(s1); shells.push(s1); disposables.push(s1.geometry, s1.material);
      if (fx.shell > 1) { const s2 = Shell(fx.dark ? '#000000' : fx.c2, fx.c, 0.5, 2.05, !!fx.dark); s2.material.uniforms.power.value = 0.8; group.add(s2); shells.push(s2); disposables.push(s2.geometry, s2.material); }
    }
    // éclairs
    let bolts = null;
    if (fx.bolts) { bolts = Bolts(fx.bolts, fx.blackBolts ? '#ff1d2e' : fx.c2 === '#ffffff' ? fx.c : fx.c, !!fx.blackBolts); group.add(bolts.grp); disposables.push(bolts.g, bolts.glow.material); if (bolts.core) disposables.push(bolts.core.material); }
    // anneau au sol
    let ring = null;
    if (fx.ring) {
      const g = new THREE.RingGeometry(0.45, 0.62, 48); g.rotateX(-Math.PI / 2);
      ring = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.y = 0.03; group.add(ring); disposables.push(g, ring.material);
    }
    // ondes de choc (pas / impacts)
    const shocks = [];
    if (fx.shock) for (let k = 0; k < 3; k++) {
      const g = new THREE.RingGeometry(0.85, 1, 48); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.y = 0.04; group.add(m); shocks.push({ m, t: 1 }); disposables.push(g, m.material);
    }
    // auréole + pilier
    let halo = null, pillar = null;
    if (fx.halo) { const g = new THREE.TorusGeometry(0.2, 0.02, 8, 32); g.rotateX(Math.PI / 2); halo = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.y = 2.05; group.add(halo); disposables.push(g, halo.material); }
    if (fx.pillar) { const g = new THREE.CylinderGeometry(0.55, 0.75, 7, 24, 1, true); g.translate(0, 3.5, 0); pillar = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); group.add(pillar); disposables.push(g, pillar.material); }
    // orbes en orbite
    const orbs = [];
    if (fx.orbs) for (let k = 0; k < fx.orbs; k++) {
      const g = new THREE.SphereGeometry(0.07, 12, 10), m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x050008 }));
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      const o = new THREE.Group(); o.add(m, gl); group.add(o); orbs.push(o); disposables.push(g, m.material, gl.geometry, gl.material);
    }
    let t = Math.random() * 10, shockT = 0, boltT = 0, stepAcc = 0, power = 0.5;
    const api = {
      group, tier,
      update(dt, ctx) {
        ctx = ctx || {};
        t += dt;
        const moving = (ctx.speed || 0) > 0.6, sp = Math.min(1.6, (ctx.speed || 0) / 6);
        const target = ctx.down ? 0.15 : 0.55 + sp * 0.35 + (ctx.sprint ? 0.15 : 0) + (ctx.boost || 0);
        power += (target - power) * Math.min(1, dt * 3);
        // particules
        for (const Q of parts) {
          for (let i = 0; i < Q.n; i++) {
            Q.life[i] -= dt * (0.8 + power * 0.5);
            if (Q.life[i] <= 0) { spawn(Q, i, false); continue; }
            const k = Q.life[i] / Q.max[i], i3 = i * 3;
            if (kind === 'wind' || kind === 'petal' || kind === 'void' || kind === 'frost') {
              Q.ang[i] += dt * (kind === 'wind' ? 4 : kind === 'void' ? 1.6 : 1.2) * (1 + sp);
              const r = Q.rad[i] * (kind === 'wind' ? 1.4 + Math.sin(t * 3 + i) * 0.2 : 1 + (1 - k) * 0.4);
              Q.pos[i3] = Math.cos(Q.ang[i]) * r; Q.pos[i3 + 2] = Math.sin(Q.ang[i]) * r;
              Q.pos[i3 + 1] += Q.vel[i3 + 1] * dt * (0.6 + power);
            } else {
              Q.pos[i3] += Q.vel[i3] * dt; Q.pos[i3 + 2] += Q.vel[i3 + 2] * dt; Q.pos[i3 + 1] += Q.vel[i3 + 1] * dt * (0.7 + power);
              // les particules « traînent » derrière quand on court
              Q.pos[i3 + 2] -= sp * dt * 2.2;
            }
            Q.alpha[i] = Math.sin(k * Math.PI) * (0.35 + power * 0.65) * (Q.light ? 0.8 : 1);
          }
          Q.g.attributes.position.needsUpdate = true; Q.g.attributes.alpha.needsUpdate = true; Q.g.attributes.tint.needsUpdate = true; Q.g.attributes.size.needsUpdate = true;
        }
        for (const s of shells) { s.material.uniforms.time.value = t; s.material.uniforms.power.value = (s === shells[1] ? 0.8 : 1) * Math.min(1.3, power * (0.75 + 0.25 * Math.sin(t * 7))); s.scale.set(1 + sp * 0.1, 1 + power * 0.12, 1 + sp * 0.1); }
        if (bolts) { boltT -= dt; if (boltT <= 0) { boltT = 0.04 + Math.random() * 0.1; regenBolts(bolts, power, H); } bolts.glow.material.uniforms.uA.value = 0.6 + Math.random() * 0.4; }
        if (ring) { ring.material.opacity = (0.25 + 0.25 * Math.sin(t * 4)) * Math.min(1, power); ring.scale.setScalar(1 + Math.sin(t * 2.5) * 0.08 + sp * 0.3); ring.rotation.y += dt; }
        if (shocks.length) {
          stepAcc += (ctx.speed || 0) * dt; shockT -= dt;
          const trig = (moving && stepAcc > (ctx.sprint ? 2.4 : 3.4)) || shockT <= 0;
          if (trig) { stepAcc = 0; shockT = 2.2 + Math.random(); const s = shocks.find(q => q.t >= 1) || shocks[0]; s.t = 0; }
          for (const s of shocks) { if (s.t < 1) { s.t += dt * 1.5; const e = s.t; s.m.scale.setScalar(0.3 + e * 2.6); s.m.material.opacity = (1 - e) * 0.7; } else s.m.material.opacity = 0; }
        }
        if (halo) { halo.rotation.y += dt * 0.8; halo.position.y = 2.05 + Math.sin(t * 2) * 0.03; }
        if (pillar) pillar.material.opacity = 0.05 + 0.04 * Math.sin(t * 3) + power * 0.03;
        orbs.forEach((o, k) => { const a = t * 1.7 + k * 6.283 / orbs.length; o.position.set(Math.cos(a) * 0.8, 1.1 + Math.sin(t * 2 + k) * 0.35, Math.sin(a) * 0.8); });
      },
      kick(v) { power = Math.min(2, power + (v || 0.8)); const s = shocks.find(q => q.t >= 1); if (s) s.t = 0; },
      dispose() { disposables.forEach(d => d.dispose && d.dispose()); },
    };
    api.update(0.016, {});
    return api;
  };
})();

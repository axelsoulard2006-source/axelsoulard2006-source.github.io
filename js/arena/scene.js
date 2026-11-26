/* ===== arena/scene.js : décor de l'arène (plateau circulaire flottant au-dessus du vide) ===== */
(function () {
  const BR = window.BR;
  const AS = (BR.ArenaScene = {});
  AS.R = 34;                      // rayon jouable

  // ambiance par boss : couleur d'accent, ciel, brouillard
  const THEMES = {
    titan:  { accent: 0xff6a1e, sky: [0x1a0805, 0x3a120a, 0x7a2a10], fog: 0x24100a, stone: '#4a403b', stone2: '#3b3330', hemi: [0xffb080, 0x2a1008], key: 0xffc49a, nebula: [1.0, 0.35, 0.1] },
    hydra:  { accent: 0x40ff90, sky: [0x03110c, 0x0a2a1e, 0x1f5a3a], fog: 0x0a1a14, stone: '#3f4a44', stone2: '#323c37', hemi: [0xa8ffd0, 0x0a1a12], key: 0xd8ffe8, nebula: [0.2, 1.0, 0.55] },
    spider: { accent: 0xb45cff, sky: [0x0c0518, 0x221038, 0x48206a], fog: 0x140a22, stone: '#46404e', stone2: '#38323f', hemi: [0xd8b0ff, 0x140a20], key: 0xe8d8ff, nebula: [0.7, 0.3, 1.0] },
    eye:    { accent: 0x3ad6ff, sky: [0x02081a, 0x06183a, 0x0e3a6a], fog: 0x081428, stone: '#3c4450', stone2: '#30363f', hemi: [0xa8e4ff, 0x081020], key: 0xd8f0ff, nebula: [0.2, 0.7, 1.0] },
    knight: { accent: 0xff2c4c, sky: [0x0d0308, 0x2a0812, 0x5e1426], fog: 0x1a060c, stone: '#4a4248', stone2: '#3a3338', hemi: [0xffb8c4, 0x1a0810], key: 0xffe0e6, nebula: [1.0, 0.18, 0.3] },
    beast:  { accent: 0xffa424, sky: [0x120a02, 0x2e1a06, 0x6a3e10], fog: 0x1e1206, stone: '#544a3c', stone2: '#443b30', hemi: [0xffd8a0, 0x1e1206], key: 0xfff0d0, nebula: [1.0, 0.62, 0.15] },
    frost:  { accent: 0x8fd8ff, sky: [0x040a14, 0x10243c, 0x3a6a8e], fog: 0x0c1826, stone: '#56606c', stone2: '#46505c', hemi: [0xdaf2ff, 0x0c1622], key: 0xf0faff, nebula: [0.55, 0.85, 1.0] },
    storm:  { accent: 0xffe03a, sky: [0x05040e, 0x15122e, 0x3a2e6a], fog: 0x0e0c1c, stone: '#4a4856', stone2: '#3a3846', hemi: [0xe8e0ff, 0x0e0c1a], key: 0xfff8e0, nebula: [0.55, 0.45, 1.0] },
    neant:  { accent: 0xff1a3a, sky: [0x010001, 0x0a0105, 0x26030a], fog: 0x070103, stone: '#221a1e', stone2: '#140f12', hemi: [0x7a2a36, 0x050102], key: 0xff8a90, nebula: [0.7, 0.03, 0.08] },
    duel:   { accent: 0xffc84a, sky: [0x0a0812, 0x231a2e, 0x6a4a3a], fog: 0x1a1420, stone: '#4c4640', stone2: '#3d3833', hemi: [0xffe0b0, 0x16101a], key: 0xfff0d8, nebula: [1.0, 0.7, 0.3] },
  };
  AS.theme = id => THEMES[id] || THEMES.duel;
  // les couleurs du thème sont écrites en sRGB : on les convertit pour le rendu linéaire
  const L = c => new THREE.Color(c).convertSRGBToLinear();
  AS.L = L;

  function canvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
  const hexCss = n => '#' + n.toString(16).padStart(6, '0');

  /* ---------- sol : dalles concentriques + cercles de runes ---------- */
  function floorTextures(th) {
    const S = 2048, R = AS.R, k = S / (2 * (R + 0.5)), cx = S / 2;
    const acc = hexCss(th.accent);
    const col = canvas(S, S, (g) => {
      g.fillStyle = th.stone2; g.fillRect(0, 0, S, S);
      // anneaux de dalles
      const rings = [0, 3.2, 6.5, 10, 13.6, 17.4, 21.2, 25, 28.8, 32, 34.5];
      for (let i = 0; i < rings.length - 1; i++) {
        const r0 = rings[i] * k, r1 = rings[i + 1] * k, n = Math.max(1, Math.round((rings[i] + rings[i + 1]) * Math.PI / 3.4));
        for (let j = 0; j < n; j++) {
          const a0 = (j / n) * Math.PI * 2 + i * 0.37, a1 = ((j + 1) / n) * Math.PI * 2 + i * 0.37;
          const v = 0.9 + Math.random() * 0.16;
          g.fillStyle = shade(th.stone, v);
          g.beginPath(); g.arc(cx, cx, r1 - 3, a0 + 0.004, a1 - 0.004); g.arc(cx, cx, Math.max(0, r0 + 3), a1 - 0.004, a0 + 0.004, true); g.closePath(); g.fill();
          // usure légère sur les arêtes
          g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cx, r1 - 5, a0 + 0.01, a1 - 0.01); g.stroke();
        }
      }
      // fissures fines
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
      for (let i = 0; i < 40; i++) { let a = Math.random() * 6.283, r = Math.random() * R * k; g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r); for (let s = 0; s < 4; s++) { a += (Math.random() - 0.5) * 0.15; r += (Math.random() - 0.3) * 40; g.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r); } g.stroke(); }
      // cercles gravés (sombres) sous les runes
      for (const rr of [10, 24]) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 26; g.beginPath(); g.arc(cx, cx, rr * k, 0, 7); g.stroke(); }
      // rosace centrale
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 10; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * 1.2 * k, cx + Math.sin(a) * 1.2 * k); g.lineTo(cx + Math.cos(a) * 6.3 * k, cx + Math.sin(a) * 6.3 * k); g.stroke(); }
    });
    const em = canvas(S, S, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
      g.strokeStyle = acc; g.fillStyle = acc;
      for (const rr of [10, 24]) {
        g.lineWidth = 5; g.beginPath(); g.arc(cx, cx, rr * k - 9, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cx, rr * k + 9, 0, 7); g.stroke();
        // runes entre les deux traits
        const n = Math.round(rr * 4.2);
        g.font = `bold ${Math.round(k * 0.55)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2; g.save(); g.translate(cx + Math.cos(a) * rr * k, cx + Math.sin(a) * rr * k); g.rotate(a + Math.PI / 2);
          const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'; g.fillText(glyphs[(i * 7 + rr) % glyphs.length], 0, 0); g.restore();
        }
      }
      g.lineWidth = 4; g.beginPath(); g.arc(cx, cx, 1.2 * k, 0, 7); g.stroke();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * 1.3 * k, cx + Math.sin(a) * 1.3 * k); g.lineTo(cx + Math.cos(a) * 6.2 * k, cx + Math.sin(a) * 6.2 * k); g.stroke(); }
      g.lineWidth = 6; g.beginPath(); g.arc(cx, cx, (R + 0.2) * k, 0, 7); g.stroke();
    });
    const t1 = new THREE.CanvasTexture(col), t2 = new THREE.CanvasTexture(em);
    t1.encoding = t2.encoding = THREE.sRGBEncoding; t1.anisotropy = t2.anisotropy = 8;
    return { map: t1, emissiveMap: t2 };
  }
  function shade(css, v) { const n = parseInt(css.slice(1), 16), f = x => Math.max(0, Math.min(255, Math.round(x * v))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

  /* ---------- ciel : dégradé, étoiles, nébuleuse, astre ---------- */
  function skyDome(th) {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { c0: { value: L(th.sky[0]) }, c1: { value: L(th.sky[1]) }, c2: { value: L(th.sky[2]) }, neb: { value: new THREE.Vector3().fromArray(th.nebula) }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 c0, c1, c2, neb; uniform float uTime; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y), mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
        float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){
          float y = vP.y;
          vec3 c = mix(c2, c1, smoothstep(-0.25, 0.25, y)); c = mix(c, c0, smoothstep(0.25, 0.85, y));
          float nb = fbm(vP * 2.4 + vec3(0.0, uTime * 0.004, 0.0)); nb = smoothstep(0.45, 0.85, nb) * smoothstep(-0.1, 0.5, y);
          c += neb * nb * 0.55;
          vec3 q = floor(vP * 300.0); float st = step(0.997, h(q)) * smoothstep(0.0, 0.3, y);
          c += vec3(st) * (0.5 + 0.8 * h(q + 2.0));
          // astre géant
          vec3 md = normalize(vec3(0.55, 0.32, -0.77)); float d = dot(vP, md);
          float disk = smoothstep(0.9935, 0.9945, d);
          c = mix(c, neb * 1.4 + vec3(0.25), disk * 0.85);
          c += neb * pow(max(d, 0.0), 60.0) * 0.6;
          // lueur du vide sous l'horizon
          c += neb * (1.0 - smoothstep(-0.6, 0.0, y)) * 0.25;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat); m.renderOrder = -10; m.frustumCulled = false;
    m.onBeforeRender = (r, sc, cam) => { m.position.copy(cam.position); };
    return m;
  }

  /* ---------- construction ---------- */
  AS.build = function (scene, themeId, quality) {
    const th = AS.theme(themeId), R = AS.R, acc = new THREE.Color(th.accent);
    const g = new THREE.Group(); scene.add(g);
    scene.background = L(th.fog);
    scene.fog = new THREE.FogExp2(L(th.fog), 0.0065);
    const sky = skyDome(th); g.add(sky);
    // lumières : ciel + clé (ombres) + contre-jour coloré
    g.add(new THREE.HemisphereLight(L(th.hemi[0]), L(th.hemi[1]), 0.85));
    g.add(new THREE.AmbientLight(0xffffff, 0.12));
    const key = new THREE.DirectionalLight(L(th.key), 1.5); key.position.set(30, 55, 20); key.target.position.set(0, 0, 0); g.add(key, key.target);
    if (quality !== 'low') {
      key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
      const sc = key.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 10; sc.far = 140; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
    }
    const rim = new THREE.DirectionalLight(L(th.accent), 0.9); rim.position.set(-30, 18, -35); g.add(rim);

    // sol
    const ft = floorTextures(th);
    const floorMat = new THREE.MeshStandardMaterial({ map: ft.map, emissiveMap: ft.emissiveMap, emissive: acc.clone(), emissiveIntensity: 1.4, roughness: 0.85, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 128), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    // tranche du plateau (roche) qui plonge dans le vide
    const rockMat = new THREE.MeshStandardMaterial({ color: L(th.stone2), roughness: 0.95, flatShading: true });
    const under = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5, R * 0.35, 26, 64, 6, true), rockMat); under.position.y = -13.05;
    { const p = under.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 12.9) { const s = 1 + (Math.random() - 0.5) * 0.16; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); p.setY(i, y + (Math.random() - 0.5) * 1.2); } } under.geometry.computeVertexNormals(); }
    g.add(under);
    // rebord : blocs de pierre
    const blockG = new THREE.BoxGeometry(1, 1, 1), blockM = new THREE.MeshStandardMaterial({ color: L(th.stone), roughness: 0.9, flatShading: true });
    const NB = 96, inst = new THREE.InstancedMesh(blockG, blockM, NB), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), P = new THREE.Vector3();
    for (let i = 0; i < NB; i++) {
      const a = (i / NB) * Math.PI * 2, gap = i % 12 === 0;
      const h = gap ? 0.25 : 0.9 + Math.random() * 0.6;
      P.set(Math.cos(a) * (R + 1.1), h / 2, Math.sin(a) * (R + 1.1)); Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + (Math.random() - 0.5) * 0.06);
      S3.set(1.5, h, 2 * Math.PI * (R + 1.1) / NB * 0.94); M.compose(P, Q, S3); inst.setMatrixAt(i, M);
    }
    inst.castShadow = true; inst.receiveShadow = true; g.add(inst);
    // cascade d'énergie tombant dans le vide (bord du plateau)
    const fallMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: acc.clone() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){ float x = vUv.x * 160.0; float col = floor(x); float sp = 0.6 + h(vec2(col, 1.0)) * 0.8;
          float y = fract(vUv.y * 2.0 + uTime * sp * 0.35 + h(vec2(col, 7.0)));
          float streak = smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.25, 1.0, y)) * (0.4 + 0.6 * smoothstep(0.3, 0.5, abs(fract(x) - 0.5) * -1.0 + 0.8));
          float a = streak * vUv.y * 0.9;
          gl_FragColor = vec4(uColor * 1.6, a); }`,
    });
    const fall = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.9, R + 2.6, 30, 96, 1, true), fallMat); fall.position.y = -15; g.add(fall);
    // vide : brume lumineuse loin en dessous
    const voidMat = new THREE.MeshBasicMaterial({ color: acc.clone().multiplyScalar(0.35), transparent: true, opacity: 0.55, depthWrite: false });
    const voidP = new THREE.Mesh(new THREE.CircleGeometry(300, 48), voidMat); voidP.rotation.x = -Math.PI / 2; voidP.position.y = -60; g.add(voidP);

    // obélisques brisés avec runes lumineuses + cristaux flottants
    const obMat = new THREE.MeshStandardMaterial({ color: L(th.stone), roughness: 0.85, flatShading: true });
    const runeMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: acc.clone(), emissiveIntensity: 2.6, roughness: 0.4 });
    const crysMat = new THREE.MeshStandardMaterial({ color: acc.clone(), emissive: acc.clone(), emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.1, flatShading: true });
    const crystals = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.31, r = R + 7 + (i % 2) * 5, h = 8 + Math.random() * 10;
      const ob = new THREE.Group(); ob.position.set(Math.cos(a) * r, -2, Math.sin(a) * r); ob.rotation.y = -a;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.6, h, 4, 1), obMat); body.position.y = h / 2; body.rotation.y = Math.PI / 4; body.castShadow = true; ob.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.2, 4), obMat); tip.position.y = h + 1.1; tip.rotation.y = Math.PI / 4; tip.rotation.z = (Math.random() - 0.5) * 0.5; if (Math.random() < 0.5) ob.add(tip);
      for (let k = 0; k < 4; k++) { const rn = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.05), runeMat); rn.position.set(0, 2.5 + k * 1.6, -1.25); rn.rotation.x = -0.05; ob.add(rn); }
      if (i % 2 === 0) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), crysMat); c.position.y = h + 3.5; c.scale.y = 1.8; ob.add(c); crystals.push({ m: c, y0: h + 3.5, p: Math.random() * 6 }); }
      g.add(ob);
    }
    // rochers flottants au loin
    const rocks = [];
    const rockG = new THREE.IcosahedronGeometry(1, 1);
    { const p = rockG.attributes.position; for (let i = 0; i < p.count; i++) { const s = 0.75 + Math.random() * 0.5; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.7, p.getZ(i) * s); } rockG.computeVertexNormals(); }
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 90, s = 2 + Math.random() * 7;
      const m = new THREE.Mesh(rockG, rockMat); m.position.set(Math.cos(a) * r, -10 + Math.random() * 40, Math.sin(a) * r); m.scale.setScalar(s); m.rotation.set(Math.random(), Math.random() * 6, Math.random());
      g.add(m); rocks.push({ m, y0: m.position.y, p: Math.random() * 6, sp: 0.2 + Math.random() * 0.3 });
    }
    // braseros sur le rebord
    const braziers = [];
    const brM = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6, metalness: 0.5, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4, r = R + 1.1;
      const b = new THREE.Group(); b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.2, 6), brM); stand.position.y = 1.1; b.add(stand);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.45, 0.6, 8), brM); bowl.position.y = 2.4; b.add(bowl);
      const l = new THREE.PointLight(L(th.accent), 2.2, 16, 2); l.position.y = 3.2; b.add(l);
      g.add(b); braziers.push({ p: new THREE.Vector3(b.position.x, 2.7, b.position.z), l });
    }

    let t = 0;
    return {
      group: g, theme: th, key, floor, floorMat,
      update(dt, fx) {
        t += dt;
        sky.material.uniforms.uTime.value = t; fallMat.uniforms.uTime.value = t;
        floorMat.emissiveIntensity = 1.2 + Math.sin(t * 1.6) * 0.25;
        crystals.forEach(c => { c.m.position.y = c.y0 + Math.sin(t * 1.2 + c.p) * 0.4; c.m.rotation.y += dt * 0.8; });
        rocks.forEach(r => { r.m.position.y = r.y0 + Math.sin(t * r.sp + r.p) * 1.2; r.m.rotation.y += dt * 0.03; });
        braziers.forEach(b => {
          b.l.intensity = 1.4 + Math.sin(t * 17 + b.p.x) * 0.25 + Math.random() * 0.2;
          if (fx && Math.random() < dt * 30) fx.spark(b.p, new THREE.Vector3((Math.random() - 0.5) * 0.6, 2 + Math.random() * 2, (Math.random() - 0.5) * 0.6), { color: th.accent, life: 0.7, size: 0.5, size1: 0.05, drag: 0.5 });
        });
      },
      dispose() { scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); }); } }); },
    };
  };
})();

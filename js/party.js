/* ===== party.js : LA BOUSCULADE — jeu 4 : party game multijoueur (course d'obstacles puis survie) =====
   BR.Party.start({ mode:'solo'|'multi', seed, roster:[{id,name,look,level}], selfId, hostId, onEnd(action) })
   Manche 1 « LE GRAND PARCOURS » : course d'obstacles, les premiers arrivés sont qualifiés.
   Manche 2 « LA TOUPIE » : plateau de dalles qui s'effritent + barres tournantes, le dernier debout gagne.
   Réseau : chaque joueur fait autorité sur son propre perso (relais BR.Net) ; l'hôte décide des manches et du classement. */
(function () {
  const BR = window.BR, Au = BR.Audio;
  const P = (BR.Party = { active: false });
  let S = null, R = null, DOM = null;
  const keys = {};
  // réglages du mouvement : rapide, nerveux, aérien
  const GRAV = 30, JUMP = 11.2, RUN = 9.2, ACC_G = 75, ACC_A = 28, DIVE_H = 14.5, DIVE_V = 5.2, RAD = 0.45, STEP = 0.45, TRAMP = 23;
  const ROUND = [
    { name: 'LE GRAND PARCOURS', sub: 'Les premiers arrivés sont qualifiés !', time: 150 },
    { name: 'LA TOUPIE', sub: 'Les dalles s\'effritent sous tes pieds. Saute les barres basses, pas les hautes !', time: 120 },
  ];
  const ST = { run: 0, air: 1, dive: 2, tumble: 3, slide: 4, spec: 9 };
  const STN = Object.fromEntries(Object.entries(ST).map(([k, v]) => [v, k]));
  const fx = (n, o) => { try { Au.fx(n, o || {}); } catch (e) {} };
  const sfx = n => { try { Au.ui(n); } catch (e) {} };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ===================== DOM / rendu ===================== */
  function ensureDom() {
    if (DOM) return;
    const st = document.createElement('style');
    st.textContent = `
#party{position:fixed;inset:0;z-index:60;display:none;background:#9fdcff;font-family:inherit;user-select:none}
#party.on{display:block}
#party canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#party .pt-top{position:absolute;top:14px;left:50%;transform:translateX(-50%);text-align:center;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.35),0 0 12px rgba(0,0,0,.25);pointer-events:none}
#party .pt-top b{display:block;font-size:26px;letter-spacing:2px;font-weight:900}
#party .pt-top span{font-size:15px;font-weight:700;opacity:.95}
#party .pt-time{position:absolute;top:14px;right:18px;color:#fff;font-size:30px;font-weight:900;text-shadow:0 3px 0 rgba(0,0,0,.35);pointer-events:none}
#party .pt-list{position:absolute;top:60px;right:16px;display:flex;flex-direction:column;gap:4px;pointer-events:none}
#party .pt-list div{background:rgba(20,30,60,.55);color:#fff;border-radius:10px;padding:4px 10px;font-size:14px;font-weight:700;min-width:150px;display:flex;justify-content:space-between;gap:10px}
#party .pt-list div.q{background:rgba(40,170,90,.8)}#party .pt-list div.x{background:rgba(160,40,60,.7);text-decoration:line-through}#party .pt-list div.me{outline:2px solid #ffe14a}
#party .pt-big{position:absolute;top:34%;left:0;right:0;text-align:center;color:#fff;font-size:84px;font-weight:900;letter-spacing:3px;text-shadow:0 6px 0 rgba(0,0,0,.35),0 0 30px rgba(255,120,200,.6);pointer-events:none;transform:scale(.6);opacity:0;transition:transform .25s cubic-bezier(.2,1.6,.4,1),opacity .2s}
#party .pt-big.on{transform:scale(1);opacity:1}
#party .pt-big small{display:block;font-size:24px;letter-spacing:1px}
#party .pt-help{position:absolute;left:16px;bottom:14px;color:#fff;font-size:13px;font-weight:700;background:rgba(20,30,60,.45);padding:8px 12px;border-radius:12px;line-height:1.6;pointer-events:none}
#party .pt-help kbd{background:#fff;color:#223;border-radius:5px;padding:0 6px;margin-right:4px;font-family:inherit}
#party .pt-click{position:absolute;bottom:64px;left:50%;transform:translateX(-50%);color:#fff;font-weight:800;background:rgba(255,80,160,.85);padding:8px 16px;border-radius:999px;pointer-events:none;display:none}
#party .pt-click.on{display:block}
#party .pt-panel{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(30,20,70,.55)}
#party .pt-panel.on{display:flex}
#party .pt-card{background:linear-gradient(#fff,#f3eaff);border-radius:22px;padding:24px 28px;min-width:380px;max-width:560px;color:#2a2050;box-shadow:0 14px 0 rgba(0,0,0,.18)}
#party .pt-card h2{margin:0 0 6px;font-size:34px;font-weight:900;color:#ff3f9b;text-align:center}
#party .pt-card p{margin:0 0 14px;text-align:center;font-weight:700}
#party .pt-card table{width:100%;border-collapse:collapse;margin-bottom:14px}
#party .pt-card td{padding:6px 8px;border-bottom:1px solid #e4d8ff;font-weight:700}
#party .pt-card tr.me td{background:#fff4b8}
#party .pt-card .pt-b{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
#party .pt-card button{border:0;border-radius:14px;padding:12px 20px;font-weight:900;font-size:16px;cursor:pointer;background:#6a5cff;color:#fff;box-shadow:0 5px 0 #4636c9}
#party .pt-card button.alt{background:#ff4f9e;box-shadow:0 5px 0 #c42a74}
#party .pt-card button:active{transform:translateY(3px);box-shadow:0 2px 0 #4636c9}
#party .pt-gain{text-align:center;font-weight:900;color:#2a9a55;margin-bottom:12px}`;
    document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'party';
    root.innerHTML = `<canvas></canvas><div class="pt-top"><b></b><span></span></div><div class="pt-time"></div><div class="pt-list"></div>
      <div class="pt-big"></div><div class="pt-click">Clique pour contrôler la caméra</div>
      <div class="pt-help"><kbd>ZQSD</kbd>courir · <kbd>Espace</kbd>sauter · <kbd>Maj</kbd>/<kbd>clic droit</kbd>plongeon · <kbd>Souris</kbd>caméra · <kbd>Échap</kbd>menu</div>
      <div class="pt-panel"><div class="pt-card"></div></div>`;
    document.body.appendChild(root);
    const q = s => root.querySelector(s);
    DOM = { root, gl: q('canvas'), title: q('.pt-top b'), sub: q('.pt-top span'), time: q('.pt-time'), list: q('.pt-list'), big: q('.pt-big'), click: q('.pt-click'), panel: q('.pt-panel'), card: q('.pt-card') };
  }
  function renderer() {
    if (R) return R;
    R = new THREE.WebGLRenderer({ canvas: DOM.gl, antialias: BR.settings.quality !== 'low', powerPreference: 'high-performance' });
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    R.shadowMap.enabled = BR.settings.quality !== 'low'; R.shadowMap.type = THREE.PCFSoftShadowMap;
    window.addEventListener('resize', resize);
    return R;
  }
  function resize() {
    if (!R) return;
    const q = BR.settings.quality, dpr = window.devicePixelRatio || 1;
    R.setPixelRatio(Math.min(dpr, q === 'high' ? 1.5 : q === 'med' ? 1 : 0.75));
    R.setSize(window.innerWidth, window.innerHeight, false);
    if (S) { S.cam.aspect = window.innerWidth / window.innerHeight; S.cam.updateProjectionMatrix(); }
  }
  let bigT = null;
  function big(txt, sub, ms) {
    DOM.big.innerHTML = txt + (sub ? `<small>${BR.esc(sub)}</small>` : ''); DOM.big.classList.remove('on'); void DOM.big.offsetWidth; DOM.big.classList.add('on');
    clearTimeout(bigT); if (ms !== 0) bigT = setTimeout(() => DOM && DOM.big.classList.remove('on'), ms || 1400);
  }

  /* ===================== monde : matériaux et primitives ===================== */
  const BOXG = new THREE.BoxGeometry(1, 1, 1);
  const matCache = {};
  function mat(hex, o) {
    const k = hex + (o ? JSON.stringify(o) : '');
    if (!matCache[k]) {
      const p = Object.assign({ roughness: 0.6, metalness: 0.0 }, o || {}); p.color = new THREE.Color(hex).convertSRGBToLinear();
      if (p.emissive) p.emissive = new THREE.Color(p.emissive).convertSRGBToLinear();
      matCache[k] = new THREE.MeshStandardMaterial(p);
    }
    return matCache[k];
  }
  const light = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k == null ? 0.2 : k).getHexString();
  function mesh(geo, m, cast) { const o = new THREE.Mesh(geo, m); o.castShadow = cast !== false; o.receiveShadow = true; return o; }
  function own(geo) { S.disp.push(geo); return geo; }

  // boîte solide : y = dessus ; o : { ry, move(t) -> {x,y,z,ry}, tramp, plain, col2 }
  function addBox(x, y, z, w, h, d, col, o) {
    o = o || {};
    const s = { t: 'box', x, y: y - h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2, ry: o.ry || 0, move: o.move || null, tramp: !!o.tramp, dx: 0, dy: 0, dz: 0, dry: 0 };
    const g = new THREE.Group(); g.position.set(x, s.y, z); g.rotation.y = s.ry;
    const b = mesh(BOXG, mat(col)); b.scale.set(w, h, d); g.add(b);
    if (!o.plain) { const c = mesh(BOXG, mat(o.col2 || light(col)), false); c.scale.set(w + 0.06, 0.14, d + 0.06); c.position.y = h / 2 - 0.05; g.add(c); }
    S.scene.add(g); s.g = g; s.c = Math.cos(s.ry); s.s = Math.sin(s.ry);
    S.solids.push(s); return s;
  }
  // disque (plateforme ronde), w = vitesse de rotation
  function addDisc(x, z, top, r, h, col, w, stripes) {
    const s = { t: 'disc', x, z, y: top, r, h, w: w || 0, ang: 0, dry: 0, dx: 0, dz: 0, dy: 0 };
    const g = new THREE.Group(); g.position.set(x, top, z);
    const b = mesh(own(new THREE.CylinderGeometry(r, r * 0.86, h, 44)), mat(col)); b.position.y = -h / 2; g.add(b);
    const c = mesh(own(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.14, 44)), mat(light(col)), false); c.position.y = -0.05; g.add(c);
    if (stripes) for (let i = 0; i < stripes; i++) { const k = mesh(BOXG, mat(stripes > 4 ? '#ffffff' : '#ffe14a'), false); k.scale.set(r * 1.9, 0.16, 0.5); k.rotation.y = i * Math.PI / stripes; k.position.y = 0.02; g.add(k); }
    S.scene.add(g); s.g = g; S.solids.push(s); return s;
  }
  // rampe (sol en pente le long de z)
  function addRamp(x, z0, z1, y0, y1, w, col) {
    const s = { t: 'ramp', x0: x - w / 2, x1: x + w / 2, z0, z1, y0, y1 };
    const L = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y1 - y0, z1 - z0);
    const g = new THREE.Group(); g.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2); g.rotation.x = -a;
    const b = mesh(BOXG, mat(col)); b.scale.set(w, 1, L); b.position.y = -0.5; g.add(b);
    for (let i = 0; i < Math.floor(L / 3); i++) { const k = mesh(BOXG, mat(light(col, 0.5)), false); k.scale.set(w + 0.04, 0.08, 0.6); k.position.set(0, 0.01, -L / 2 + 1.5 + i * 3); g.add(k); }
    S.scene.add(g); S.solids.push(s); return s;
  }
  const rampY = (s, z) => s.y0 + (s.y1 - s.y0) * clamp((z - s.z0) / (s.z1 - s.z0), 0, 1);

  /* ---------- dangers ---------- */
  // barre tournante autour de (cx,cz), entre yb et yb+h, demi-longueur L
  function addSweep(cx, cz, yb, h, L, th, w0, col, phase, acc) {
    const g = new THREE.Group(); g.position.set(cx, yb + h / 2, cz);
    const bar = mesh(BOXG, mat(col)); bar.scale.set(L * 2, h, th * 2); g.add(bar);
    [-1, 1].forEach(sd => { const tip = mesh(own(new THREE.SphereGeometry(h * 0.75, 16, 12)), mat('#ffffff')); tip.position.x = sd * L; g.add(tip); });
    S.scene.add(g);
    const hz = { t: 'sweep', cx, cz, yb, h, L, th, w0, acc: acc || 0, phase: phase || 0, g, a: 0, w: w0,
      update(t) { this.w = this.w0 * (1 + this.acc * t); this.a = this.phase + this.w0 * (t + this.acc * t * t / 2); this.g.rotation.y = this.a; },
      hit(m) {
        if (this.off || m.y > this.yb + this.h || m.y + 1.7 < this.yb) return null;
        const dx = m.x - this.cx, dz = m.z - this.cz, c = Math.cos(this.a), s = Math.sin(this.a);
        const along = dx * c - dz * s, perp = dx * s + dz * c;
        if (Math.abs(along) > this.L + 0.3 || Math.abs(perp) > this.th + RAD) return null;
        const sg = Math.sign(-this.w * along) || 1, sp = (10 + Math.abs(this.w * along) * 0.55) * (this.kb || 1);
        return { x: s * sg * sp, y: 7.5 * (this.kb || 1), z: c * sg * sp };
      } };
    S.haz.push(hz);
    addPillar(cx, cz, yb - 0.1, yb + h + 0.6, 0.9, '#ffffff');
    return hz;
  }
  function addPillar(x, z, y0, y1, r, col) {
    const m = mesh(own(new THREE.CylinderGeometry(r, r, y1 - y0, 20)), mat(col)); m.position.set(x, (y0 + y1) / 2, z); S.scene.add(m);
    S.solids.push({ t: 'cyl', x, z, r, y0, y1 });
  }
  // marteau-pendule au-dessus d'un pont, oscille le long de x
  function addHammer(px, py, pz, len, amp, period, phase, col) {
    const g = new THREE.Group(); g.position.set(px, py, pz);
    const arm = mesh(BOXG, mat('#5b4bd6')); arm.scale.set(0.35, len, 0.35); arm.position.y = -len / 2; g.add(arm);
    const head = mesh(own(new THREE.CylinderGeometry(1.05, 1.05, 2.6, 24)), mat(col)); head.rotation.x = Math.PI / 2; head.position.y = -len; g.add(head);
    [-1, 1].forEach(sd => { const cap = mesh(own(new THREE.CylinderGeometry(1.12, 1.12, 0.3, 24)), mat('#ffffff')); cap.rotation.x = Math.PI / 2; cap.position.set(0, -len, sd * 1.35); g.add(cap); });
    S.scene.add(g);
    // portique
    [-1, 1].forEach(sd => addDeco(BOXG, '#ffffff', px + sd * 4.2, py / 2 + 0.5, pz, 0.5, py + 1, 0.5));
    addDeco(BOXG, '#5b4bd6', px, py + 0.3, pz, 9, 0.6, 0.6);
    const hz = { t: 'hammer', px, py, pz, len, amp, period, phase, g, a: 0, da: 0,
      update(t) { const k = 2 * Math.PI / this.period, u = k * t + this.phase; this.a = this.amp * Math.sin(u); this.da = this.amp * k * Math.cos(u); this.g.rotation.z = this.a; },
      hit(m) {
        const hx = this.px + this.len * Math.sin(this.a), hy = this.py - this.len * Math.cos(this.a);
        if (Math.abs(m.z - this.pz) > 1.3 + RAD) return null;
        if (Math.hypot(m.x - hx, m.y + 0.9 - hy) > 1.05 + RAD + 0.35) return null;
        const sg = Math.sign(this.da) || 1;
        return { x: sg * 17, y: 8, z: (m.z - this.pz) * 2 };
      } };
    S.haz.push(hz); return hz;
  }
  function addDeco(geo, col, x, y, z, sx, sy, sz, cast) { const m = mesh(geo, mat(col), cast); m.position.set(x, y, z); m.scale.set(sx, sy, sz); S.scene.add(m); return m; }
  // rondins qui dévalent une rampe (de z1 vers z0)
  function addLogs(ramp, n, spd, r) {
    const xc = (ramp.x0 + ramp.x1) / 2, w = ramp.x1 - ramp.x0 - 1.2, L = ramp.z1 - ramp.z0;
    const geo = own(new THREE.CylinderGeometry(r, r, w, 18)); geo.rotateZ(Math.PI / 2);
    const logs = [];
    for (let i = 0; i < n; i++) { const g = new THREE.Group(); const b = mesh(geo, mat(i % 2 ? '#ff8a3d' : '#ffb13d')); g.add(b); const ring = mesh(own(new THREE.TorusGeometry(r * 0.75, 0.12, 6, 18)), mat('#ffffff'), false); ring.rotation.y = Math.PI / 2; ring.position.x = w / 2 + 0.02; g.add(ring); S.scene.add(g); logs.push({ g, z: 0, y: 0 }); }
    const hz = { t: 'logs', logs, n, spd, r, L, ramp, xc, w,
      update(t) { this.logs.forEach((lg, i) => { const s = (t * this.spd + i * this.L / this.n) % this.L; lg.z = this.ramp.z1 - s; lg.y = rampY(this.ramp, lg.z) + this.r; lg.g.position.set(this.xc, lg.y, lg.z); lg.g.rotation.x = -s / this.r; lg.g.visible = s > 0.3; }); },
      hit(m) {
        if (Math.abs(m.x - this.xc) > this.w / 2 + RAD) return null;
        for (const lg of this.logs) { if (Math.abs(m.z - lg.z) < this.r + RAD && m.y < lg.y + this.r && m.y + 1.7 > lg.y - this.r) return { x: (m.x - this.xc) * 0.6, y: 7, z: -13 }; }
        return null;
      } };
    S.haz.push(hz); return hz;
  }
  // champignon rebondissant
  function addBumper(x, z, y, r, col) {
    const stem = mesh(own(new THREE.CylinderGeometry(r * 0.55, r * 0.7, 1.4, 16)), mat('#fff6e6')); stem.position.set(x, y + 0.7, z); S.scene.add(stem);
    const cap = mesh(own(new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2)), mat(col)); cap.position.set(x, y + 1.2, z); cap.scale.y = 0.8; S.scene.add(cap);
    for (let i = 0; i < 5; i++) { const a = i * 1.26, dot = mesh(own(new THREE.SphereGeometry(0.22, 8, 6)), mat('#ffffff'), false); dot.position.set(x + Math.cos(a) * r * 0.6, y + 1.2 + r * 0.55, z + Math.sin(a) * r * 0.6); S.scene.add(dot); }
    const hz = { t: 'bump', x, z, y, r, cap, sq: 0,
      update(t, dt) { this.sq = Math.max(0, this.sq - dt * 4); this.cap.scale.set(1 + this.sq * 0.25, 0.8 - this.sq * 0.3, 1 + this.sq * 0.25); },
      hit(m) {
        if (m.y > this.y + 1.2 + this.r * 0.8 || m.y + 1.7 < this.y) return null;
        const dx = m.x - this.x, dz = m.z - this.z, d = Math.hypot(dx, dz);
        if (d > this.r + RAD || d < 1e-3) return null;
        this.sq = 1; return { x: dx / d * 15, y: 6, z: dz / d * 15, soft: true };
      } };
    S.haz.push(hz); return hz;
  }

  /* ===================== décor commun ===================== */
  function sky(top, bot) {
    const geo = own(new THREE.SphereGeometry(420, 24, 16)), pos = geo.attributes.position, cols = [], ct = new THREE.Color(top).convertSRGBToLinear(), cb = new THREE.Color(bot).convertSRGBToLinear();
    for (let i = 0; i < pos.count; i++) { const k = clamp(pos.getY(i) / 420 * 1.6 + 0.15, 0, 1); const c = cb.clone().lerp(ct, k); cols.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); S.disp.push(m.material);
    m.renderOrder = -1; S.scene.add(m); S.skyM = m;
  }
  function clouds(r, n, y0, y1, avoid) {
    const geo = own(new THREE.IcosahedronGeometry(1, 1)), m = mat('#ffffff', { roughness: 1, emissive: '#cfe8ff', emissiveIntensity: 0.25 });
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = 70 + r() * 160, cx = Math.cos(a) * d, cz = avoid(Math.sin(a) * d), cy = y0 + r() * (y1 - y0);
      for (let k = 0; k < 5; k++) { const s = 4 + r() * 6; const p = mesh(geo, m, false); p.position.set(cx + (r() - 0.5) * 14, cy + (r() - 0.5) * 3, cz + (r() - 0.5) * 8); p.scale.set(s * 1.4, s * 0.8, s); S.scene.add(p); }
    }
  }
  function sea(y) {
    const geo = own(new THREE.PlaneGeometry(900, 900, 1, 1)); geo.rotateX(-Math.PI / 2);
    const m = mesh(geo, mat('#38c6e8', { roughness: 0.25, metalness: 0.1, emissive: '#0d6c9a', emissiveIntensity: 0.25 }), false); m.position.y = y; S.scene.add(m);
  }
  function lights() {
    const sc = S.scene;
    sc.add(new THREE.HemisphereLight(0xcfe9ff, 0x7a5aa8, 0.75));
    const sun = new THREE.DirectionalLight(0xfff0d6, 1.9); sun.position.set(-30, 60, -20); sun.castShadow = !!(R && R.shadowMap.enabled);
    const q = BR.settings.quality; sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
    const sh = sun.shadow.camera; sh.left = -32; sh.right = 32; sh.top = 32; sh.bottom = -32; sh.near = 1; sh.far = 160; sun.shadow.bias = -0.0006;
    sc.add(sun); sc.add(sun.target); S.sun = sun;
  }

  /* ===================== manche 1 : LE GRAND PARCOURS ===================== */
  function buildCourse() {
    const r = rng(S.seed + 11);
    sky('#46a8ff', '#d9f2ff'); sea(-22); clouds(r, 26, -8, 30, z => z); lights();
    S.scene.fog = new THREE.Fog(0xcfeeff, 90, 360);
    const W = 14;
    // A. départ
    addBox(0, 0, 9, 18, 2, 22, '#7a6cff');
    [-1, 1].forEach(sd => { addBox(sd * 9.4, 1.2, 9, 0.8, 1.2, 22, '#ffffff', { plain: true }); });
    addDeco(BOXG, '#ff4f9e', 0, 7, 19.5, 18, 1.2, 1); [-1, 1].forEach(sd => addDeco(BOXG, '#ffffff', sd * 8.6, 3.5, 19.5, 0.9, 7, 0.9));
    S.checks.push({ z: -99, x: 0, y: 0, zz: 5 });
    // B. rampe puis les Moulinets
    addRamp(0, 20, 32, 0, 3, 10, '#ffb13d');
    addDisc(0, 44, 3, 12, 3, '#47d16c');
    addSweep(0, 44, 3, 0.75, 11.6, 0.45, 1.25, '#ff4f9e', 0, 0.004);
    addBox(0, 3, 58, 5, 2, 6, '#ffb13d');
    addDisc(0, 70, 3, 10, 3, '#47d16c');
    addSweep(0, 70, 3, 0.75, 9.6, 0.45, -1.6, '#ff4f9e', 1.3, 0.004);
    S.checks.push({ z: 33, x: 0, y: 3, zz: 34 });
    // C. plateformes mobiles au-dessus du vide
    addBox(0, 3, 83, 10, 2, 6, '#7a6cff');
    S.checks.push({ z: 80, x: 0, y: 3, zz: 83 });
    for (let i = 0; i < 6; i++) {
      const z = 90 + i * 5.6, ph = r() * 6, amp = 3.4 + (i % 3) * 0.6, per = 2.6 + r() * 1.4, kind = i % 2;
      addBox(0, 3, z, 4.2, 1, 3.6, kind ? '#3fd0ff' : '#ffe14a', { move: t => kind ? { x: Math.sin(t * 2 * Math.PI / per + ph) * amp, y: 3, z } : { x: Math.sin(t * 2 * Math.PI / per + ph) * 1.2, y: 3 + Math.sin(t * 2 * Math.PI / per + ph) * 1.1, z } });
    }
    // D. les Marteaux
    addBox(0, 3, 126, 10, 2, 6, '#7a6cff');
    S.checks.push({ z: 124, x: 0, y: 3, zz: 126 });
    addBox(0, 3, 149, 5, 2, 40, '#ffb13d');
    for (let i = 0; i < 5; i++) addHammer(0, 11, 136 + i * 7, 7.4, 1.05, 2.1 + (i % 2) * 0.4, i * 1.7, i % 2 ? '#ff4f9e' : '#3fd0ff');
    // E. la Montée des rondins
    addBox(0, 3, 172, W, 2, 6, '#7a6cff');
    S.checks.push({ z: 169, x: 0, y: 3, zz: 172 });
    const rp = addRamp(0, 175, 211, 3, 13, W, '#47d16c');
    [-1, 1].forEach(sd => { const L = Math.hypot(36, 10), a = Math.atan2(10, 36); const m = addDeco(BOXG, '#ffffff', sd * (W / 2 + 0.3), 8 + 0.6, 193, 0.6, 1.2, L); m.rotation.x = -a; });
    addLogs(rp, 5, 9.5, 0.75);
    // F. les Toupies
    addBox(0, 13, 214, W, 2, 6, '#7a6cff');
    S.checks.push({ z: 212, x: 0, y: 13, zz: 214 });
    addDisc(0, 223.5, 13, 5, 2, '#ffe14a', 1.1, 3);
    addDisc(0, 235.5, 13, 5, 2, '#3fd0ff', -1.4, 3);
    addDisc(0, 247.5, 13, 5, 2, '#ff8a3d', 1.8, 3);
    // G. le champ de champignons, puis les trampolines
    addBox(0, 13, 266.5, 16, 2, 27, '#7a6cff');
    S.checks.push({ z: 254, x: 0, y: 13, zz: 256 });
    [[-4, 259], [3, 261], [-1, 265], [5, 268], [-5, 269], [1, 271]].forEach(([x, z], i) => addBumper(x, z, 13, 1.5, i % 2 ? '#ff4f9e' : '#ff3b3b'));
    S.tramps.push(addBox(0, 13.25, 277.2, 15.6, 0.5, 4, '#ff4f9e', { tramp: true, col2: '#ffffff' }));
    for (let i = 0; i < 6; i++) addDeco(BOXG, '#ffffff', -6.5 + i * 2.6, 13.52, 277.2, 0.5, 0.06, 3.6, false);
    // arrivée
    addBox(0, 20, 292, 18, 2, 24, '#ffe14a');
    S.finishZ = 284; S.finishY = 19;
    const fl = cv(256, 32, g => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); } });
    const fm = new THREE.MeshStandardMaterial({ map: fl }); S.disp.push(fm, fl);
    const fline = mesh(BOXG, fm, false); fline.scale.set(18, 0.05, 1.2); fline.position.set(0, 20.04, S.finishZ); S.scene.add(fline);
    const arch = cv(512, 128, g => { g.fillStyle = '#ff3f9b'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#fff'; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ARRIVÉE', 256, 68); });
    const am = new THREE.MeshStandardMaterial({ map: arch, emissive: '#ffffff', emissiveMap: arch, emissiveIntensity: 0.25 }); S.disp.push(am, arch);
    const ab = mesh(BOXG, am); ab.scale.set(18, 3, 0.8); ab.position.set(0, 28, S.finishZ); S.scene.add(ab);
    [-1, 1].forEach(sd => addDeco(BOXG, '#ffffff', sd * 8.6, 24, S.finishZ, 1, 8, 1));
    // confettis de fond : petits îlots flottants
    for (let i = 0; i < 18; i++) { const sd = r() < 0.5 ? -1 : 1, x = sd * (24 + r() * 40), z = r() * 300, y = -6 + r() * 26, s = 2 + r() * 4; addDeco(own(new THREE.CylinderGeometry(s, s * 0.6, s * 0.8, 7)), ['#47d16c', '#ffb13d', '#7a6cff', '#ff4f9e'][i % 4], x, y, z, 1, 1, 1); }
    S.spawns = []; for (let i = 0; i < 12; i++) S.spawns.push({ x: ((i % 4) - 1.5) * 2.6, y: 0, z: 4 + Math.floor(i / 4) * 2.6 });
    S.fallY = -14;
  }
  function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }

  /* ===================== manche 2 : LA TOUPIE ===================== */
  function buildSpin() {
    const r = rng(S.seed + 23);
    sky('#ff7fc0', '#ffe1a8'); sea(-26); clouds(r, 22, -10, 24, z => z); lights();
    S.scene.fog = new THREE.Fog(0xffd9c4, 80, 330);
    S.tiles = [];
    const T = 2.5, RR = 13.2, cols = ['#7a6cff', '#47d16c', '#ffb13d', '#3fd0ff'];
    for (let ix = -6; ix <= 6; ix++) for (let iz = -6; iz <= 6; iz++) {
      const x = ix * T, z = iz * T; if (Math.hypot(x, z) > RR || Math.hypot(x, z) < 1.9) continue;
      const s = addBox(x, 0, z, T - 0.14, 0.7, T - 0.14, cols[(ix + iz + 20) % 4]);
      s.tile = S.tiles.length; s.state = 0; s.t0 = 0; S.tiles.push(s);
    }
    addPillar(0, 0, -6, 2.6, 1.6, '#ffffff');
    // barre basse (à sauter) et barre haute (à laisser passer)
    S.low = addSweep(0, 0, 0.15, 0.7, 13.6, 0.4, 1.0, '#ff3b3b', 0, 0.012);
    S.high = addSweep(0, 0, 2.15, 0.6, 13.6, 0.4, -0.75, '#ffe14a', Math.PI / 2, 0.012);
    S.high.g.visible = false; S.high.off = true; S.low.kb = S.high.kb = 0.62;
    const ring = mesh(own(new THREE.TorusGeometry(RR + 1.6, 0.5, 8, 64)), mat('#ffffff'), false); ring.rotation.x = Math.PI / 2; ring.position.y = -2.2; S.scene.add(ring);
    S.spawns = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; S.spawns.push({ x: Math.cos(a) * 8.2, y: 0, z: Math.sin(a) * 8.2 }); }
    S.fallY = -9;
  }

  /* ===================== physique du joueur ===================== */
  function groundAt(x, z, feet) {
    let best = -Infinity, obj = null; const lim = feet + STEP;
    for (const s of S.solids) {
      let top;
      if (s.t === 'box') {
        if (s.dead) continue;
        top = s.y + s.hy; if (top > lim || top <= best) continue;
        const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
        if (Math.abs(lx) > s.hx + 0.12 || Math.abs(lz) > s.hz + 0.12) continue;
      } else if (s.t === 'disc') {
        top = s.y; if (top > lim || top <= best) continue;
        if (Math.hypot(x - s.x, z - s.z) > s.r + 0.1) continue;
      } else if (s.t === 'ramp') {
        if (x < s.x0 || x > s.x1 || z < s.z0 - 0.05 || z > s.z1 + 0.05) continue;
        top = rampY(s, z); if (top > feet + 0.9 || top <= best) continue;
      } else if (s.t === 'cyl') {
        top = s.y1; if (top > lim || top <= best) continue;
        if (Math.hypot(x - s.x, z - s.z) > s.r) continue;
      } else continue;
      best = top; obj = s;
    }
    return { y: best, obj };
  }
  function pushWalls(m) {
    const feet = m.y, head = m.y + 1.7;
    for (const s of S.solids) {
      if (s.t === 'box') {
        if (s.dead) continue;
        const top = s.y + s.hy, bot = s.y - s.hy; if (top <= feet + STEP || bot >= head) continue;
        const dx = m.x - s.x, dz = m.z - s.z; let lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
        const qx = clamp(lx, -s.hx, s.hx), qz = clamp(lz, -s.hz, s.hz), ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
        if (d >= RAD) continue;
        if (d > 1e-5) { lx = qx + ox / d * RAD; lz = qz + oz / d * RAD; } else { const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz); if (px < pz) lx = Math.sign(lx || 1) * (s.hx + RAD); else lz = Math.sign(lz || 1) * (s.hz + RAD); }
        m.x = s.x + lx * s.c + lz * s.s; m.z = s.z - lx * s.s + lz * s.c;
      } else if (s.t === 'disc' || s.t === 'cyl') {
        const top = s.t === 'disc' ? s.y : s.y1, bot = s.t === 'disc' ? s.y - s.h : s.y0; if (top <= feet + STEP || bot >= head) continue;
        const dx = m.x - s.x, dz = m.z - s.z, d = Math.hypot(dx, dz), rr = s.r + RAD;
        if (d < rr && d > 1e-4) { m.x = s.x + dx / d * rr; m.z = s.z + dz / d * rr; }
      }
    }
  }
  function updateWorld(t, dt) {
    for (const s of S.solids) {
      if (s.t === 'box' && s.move) {
        const p = s.move(t); s.dx = p.x - s.x; s.dy = p.y - (s.y + s.hy); s.dz = p.z - s.z; s.x = p.x; s.y = p.y - s.hy; s.z = p.z; s.g.position.set(s.x, s.y, s.z);
      } else if (s.t === 'disc' && s.w) { const a = s.w * t; s.dry = a - s.ang; s.ang = a; s.g.rotation.y = a; }
    }
    for (const h of S.haz) h.update(t, dt);
    // dalles de la Toupie
    if (S.tiles) for (const s of S.tiles) {
      if (s.state === 1) { const k = S.rt - s.t0; s.g.position.x = s.x + Math.sin(k * 60) * 0.06; if (k > 1.0) { s.state = 2; s.dead = true; s.vy = 0; } }
      else if (s.state === 2 && s.g.visible) { s.vy -= 30 * dt; s.g.position.y += s.vy * dt; if (s.g.position.y < -30) s.g.visible = false; }
    }
  }
  function crumble(i) { const s = S.tiles && S.tiles[i]; if (!s || s.state) return; s.state = 1; s.t0 = S.rt; s.g.children[0].material = mat('#ffffff'); }

  function knock(m, v) {
    if (m.ghost > 0 && !v.soft) return;
    m.vx = v.x; m.vy = Math.max(m.vy, v.y); m.vz = v.z; m.ground = false;
    if (v.soft) { fx('land', { g: 0.6, rate: 1.4 }); return; }
    m.st = 'tumble'; m.stT = 0.85; m.spin = 0; S.shake = Math.max(S.shake, 0.35); fx('hit', { g: 0.8 }); fx('land', { g: 1 });
  }
  function stepMe(dt) {
    const m = S.me; if (!m.active) return;
    m.ghost = Math.max(0, m.ghost - dt);
    // entrée relative à la caméra
    let ix = 0, iz = 0;
    if (S.ctl && !S.paused) {
      if (keys.KeyW || keys.ArrowUp) iz += 1; if (keys.KeyS || keys.ArrowDown) iz -= 1;
      if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
    }
    const fwx = Math.sin(S.yaw), fwz = Math.cos(S.yaw);
    let wx = fwx * iz - fwz * ix, wz = fwz * iz + fwx * ix; const il = Math.hypot(wx, wz); if (il > 1) { wx /= il; wz /= il; }
    if (m.jbuf > 0) m.jbuf -= dt; if (m.coyote > 0) m.coyote -= dt;
    // plongeon
    if (S.diveReq) { S.diveReq = false; if ((m.st === 'run' || m.st === 'air' || m.st === 'slide') && !m.diveUsed) {
      const dl = Math.hypot(wx, wz), dx = dl > 0.1 ? wx / dl : Math.sin(m.face), dz = dl > 0.1 ? wz / dl : Math.cos(m.face);
      m.vx = dx * DIVE_H; m.vz = dz * DIVE_H; m.vy = m.ground ? DIVE_V + 1.5 : Math.max(m.vy, DIVE_V); m.ground = false;
      m.st = 'dive'; m.diveUsed = true; m.face = Math.atan2(dx, dz); fx('dash', { g: 0.9 }); } }
    if (m.st === 'tumble') { m.stT -= dt; m.spin += dt * 14; if (m.stT <= 0 && m.ground) { m.st = 'run'; m.ghost = 0.5; } }
    else if (m.st === 'dive') { m.vx += wx * dt * 6; m.vz += wz * dt * 6; }
    else if (m.st === 'slide') {
      const k = Math.max(0, 1 - dt * 5); m.vx *= k; m.vz *= k; m.stT -= dt; if (m.stT <= 0) m.st = 'run';
    } else {
      const ac = m.ground ? ACC_G : ACC_A, tx = wx * RUN, tz = wz * RUN;
      const ddx = tx - m.vx, ddz = tz - m.vz, dd = Math.hypot(ddx, ddz), mx = ac * dt;
      if (dd > mx) { m.vx += ddx / dd * mx; m.vz += ddz / dd * mx; } else { m.vx = tx; m.vz = tz; }
      if (il > 0.1) m.face += BR.angDiff(m.face, Math.atan2(wx, wz)) * Math.min(1, dt * 16);
    }
    // saut (aussi pour sortir d'une glissade)
    if (m.jbuf > 0 && (m.ground || m.coyote > 0) && (m.st === 'run' || m.st === 'slide')) {
      m.vy = JUMP; m.ground = false; m.coyote = 0; m.jbuf = 0; if (m.st === 'slide') m.st = 'run'; fx('dash', { g: 0.35, rate: 1.5 });
    }
    // porté par une plateforme qui bouge
    if (m.ground && m.gObj) {
      const s = m.gObj;
      if (s.t === 'box' && s.move) { m.x += s.dx; m.z += s.dz; m.y += s.dy; }
      else if (s.t === 'disc' && s.dry) { const c = Math.cos(s.dry), sn = Math.sin(s.dry), dx = m.x - s.x, dz = m.z - s.z; m.x = s.x + dx * c + dz * sn; m.z = s.z - dx * sn + dz * c; m.face += s.dry; }
    }
    const feet0 = m.y;
    m.vy -= GRAV * dt; if (m.vy < -40) m.vy = -40;
    m.x += m.vx * dt; m.z += m.vz * dt; m.y += m.vy * dt;
    pushWalls(m);
    const g = groundAt(m.x, m.z, Math.max(feet0, m.y));
    const wasG = m.ground;
    if (m.y <= g.y + (wasG && m.vy <= 0 ? 0.3 : 0) && m.vy <= 0 && isFinite(g.y)) {
      if (!wasG && m.vy < -14) fx('land', { g: 0.7 });
      m.y = g.y; m.vy = 0; m.ground = true; m.gObj = g.obj; m.diveUsed = false;
      if (m.st === 'dive') { m.st = 'slide'; m.stT = 0.32; }
      if (g.obj && g.obj.tramp) { m.vy = TRAMP; m.ground = false; m.gObj = null; g.obj.sq = 1; fx('land', { g: 1, rate: 1.8 }); }
      if (g.obj && g.obj.tile != null && !g.obj.state && S.round === 2 && S.ctl) { crumble(g.obj.tile); if (!S.solo) BR.Net.relay({ k: 'tl', i: g.obj.tile }); }
    } else {
      if (wasG) m.coyote = 0.11;
      m.ground = false; m.gObj = null;
    }
    // dangers
    if (S.ctl) for (const h of S.haz) { const v = h.hit(m); if (v) { knock(m, v); break; } }
    // bousculade entre joueurs
    for (const p of S.players.values()) {
      if (p === m || !p.av || !p.vis) continue;
      const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.95 && d > 1e-4 && Math.abs(m.y - p.y) < 1.5) {
        m.x += dx / d * (0.95 - d) * 0.6; m.z += dz / d * (0.95 - d) * 0.6;
        const ps = Math.hypot(p.vx, p.vz);
        if (p.st === ST.dive && ps > 8 && (m.bumpCd || 0) <= 0) { m.bumpCd = 0.7; knock(m, { x: p.vx * 0.8, y: 6, z: p.vz * 0.8 }); }
      }
    }
    m.bumpCd = Math.max(0, (m.bumpCd || 0) - dt);
    // points de passage, arrivée, chute
    if (S.round === 1) {
      if (m.ground) for (let i = S.check + 1; i < S.checks.length; i++) if (m.z > S.checks[i].z && Math.abs(m.y - S.checks[i].y) < 2.5) { S.check = i; if (i > 0) feed('Point de passage !'); }
      m.maxZ = Math.max(m.maxZ || 0, m.z);
      if (!m.finished && m.z > S.finishZ && m.y > S.finishY - 1.5) finishMe();
    }
    if (m.y < S.fallY) {
      if (S.round === 1) respawn(m); else eliminateMe();
    }
  }
  function respawn(m) {
    const c = S.checks[Math.max(0, S.check)];
    m.x = c.x + (Math.random() - 0.5) * 3; m.y = c.y + 0.2; m.z = c.zz; m.vx = m.vy = m.vz = 0; m.st = 'run'; m.ghost = 1.2; m.ground = false;
    S.yaw = 0; fx('land', { g: 0.5, rate: 0.7 });
  }

  /* ===================== joueurs ===================== */
  function nameTag(name, me) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.strokeStyle = 'rgba(30,20,70,0.85)'; g.strokeText(name, 256, 64); g.fillStyle = me ? '#ffe14a' : '#fff'; g.fillText(name, 256, 64);
    const t = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); sp.scale.set(1.8, 0.45, 1); sp.renderOrder = 10;
    return { sprite: sp, tex: t };
  }
  function makeAvatars() {
    for (const p of S.players.values()) {
      if (p.av) continue;
      p.av = BR.Avatar.build(p.look); p.av.group.rotation.order = 'YXZ';
      p.av.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
      p.tag = nameTag(p.name, p === S.me);
    }
  }
  function placeAll(list) {
    const ids = [...S.players.keys()].filter(id => list.includes(id));
    ids.forEach((id, i) => {
      const p = S.players.get(id), sp = S.spawns[i % S.spawns.length];
      p.x = p.tx = sp.x; p.y = p.ty = sp.y + 0.05; p.z = p.tz = sp.z; p.vx = p.vy = p.vz = 0;
      p.face = p.tf = S.round === 2 ? Math.atan2(-sp.x, -sp.z) : 0;
    });
  }
  function updateAvatars(dt) {
    for (const p of S.players.values()) {
      const av = p.av; if (!av) continue;
      if (p === S.me) {
        p.vis = p.active; p.stc = ST[p.st] != null ? ST[p.st] : 0;
      } else {
        const ax = p.tx + p.vx * 0.05, az = p.tz + p.vz * 0.05, dx = ax - p.x, dz = az - p.z, dy = p.ty - p.y;
        if (Math.hypot(dx, dz) > 8 || Math.abs(dy) > 5) { p.x = p.tx; p.z = p.tz; p.y = p.ty; }
        else { const k = Math.min(1, dt * 14); p.x += dx * k; p.z += dz * k; p.y += dy * Math.min(1, dt * 16); }
        p.face += BR.angDiff(p.face, p.tf) * Math.min(1, dt * 14);
        p.vis = p.st !== ST.spec && S.part.includes(p.id) && !S.out.has(p.id);
        p.stc = p.st;
      }
      const g = av.group, sc = p.stc;
      g.visible = p.vis; p.tag.sprite.visible = p.vis;
      if (!p.vis) continue;
      if (!g.parent) S.scene.add(g); if (!p.tag.sprite.parent) S.scene.add(p.tag.sprite);
      g.position.set(p.x, p.y, p.z); g.rotation.y = p.face;
      // poses : plongeon (à plat ventre), glissade, culbute
      p.tilt = p.tilt || 0; p.roll = p.roll || 0;
      let tilt = 0;
      if (sc === ST.dive) tilt = 1.25; else if (sc === ST.slide) tilt = 1.45;
      if (sc === ST.tumble) { p.roll += dt * 13; g.rotation.x = p.roll; g.position.y += 0.6; }
      else { p.roll = 0; p.tilt += (tilt - p.tilt) * Math.min(1, dt * 14); g.rotation.x = p.tilt; if (p.tilt > 0.3) g.position.y += 0.25 * Math.min(1, p.tilt); }
      const sp = Math.hypot(p.vx, p.vz), air = sc === ST.air || sc === ST.dive || (p === S.me && !p.ground && sc === ST.run);
      av.update(dt, sp, { air: air || sc === ST.tumble, sprint: sp > 7, dash: false });
      p.tag.sprite.position.set(p.x, p.y + 2.25, p.z);
    }
  }

  /* ===================== caméra ===================== */
  function updateCam(dt) {
    let tg = S.me;
    if (!S.me.active) {
      const alive = [...S.players.values()].filter(p => p !== S.me && p.vis);
      if (alive.length) { S.specI = ((S.specI || 0) % alive.length + alive.length) % alive.length; tg = alive[S.specI]; }
    }
    const tx = tg.x, ty = tg.y + 1.6, tz = tg.z;
    const d = 7.6, cp = Math.cos(S.pitch), x = tx - Math.sin(S.yaw) * d * cp, y = ty + Math.sin(S.pitch) * d, z = tz - Math.cos(S.yaw) * d * cp;
    const k = Math.min(1, dt * 12);
    S.camP.x += (x - S.camP.x) * k; S.camP.y += (y - S.camP.y) * Math.min(1, dt * 8); S.camP.z += (z - S.camP.z) * k;
    S.shake = Math.max(0, S.shake - dt * 1.6); const sh = S.shake * S.shake * 0.6;
    S.cam.position.set(S.camP.x + (Math.random() - 0.5) * sh, S.camP.y + (Math.random() - 0.5) * sh, S.camP.z + (Math.random() - 0.5) * sh);
    S.cam.lookAt(tx, ty, tz);
    const sp = Math.hypot(S.me.vx, S.me.vz); S.cam.fov += (68 + clamp(sp - 8, 0, 8) * 0.9 - S.cam.fov) * Math.min(1, dt * 5); S.cam.updateProjectionMatrix();
    if (S.sun) { S.sun.position.set(tx - 30, ty + 60, tz - 20); S.sun.target.position.set(tx, ty, tz); }
    if (S.skyM) S.skyM.position.set(tx, 0, tz);
  }

  /* ===================== manches ===================== */
  function clearWorld() {
    if (!S.scene) return;
    for (const p of S.players.values()) { if (p.av) S.scene.remove(p.av.group); if (p.tag) S.scene.remove(p.tag.sprite); }
    S.disp.forEach(x => x.dispose && x.dispose()); S.disp = [];
    S.scene = null;
  }
  function startRound(n, part) {
    clearWorld();
    S.round = n; S.high = S.low = null; S.part = part.slice(); S.out = new Set(); S.fin = []; S.check = 0; S.decided = false; S.tiles = null; S.tramps = [];
    S.scene = new THREE.Scene(); S.solids = []; S.haz = []; S.checks = [];
    if (n === 1) buildCourse(); else buildSpin();
    S.round === 1 ? S.checks.sort((a, b) => a.z - b.z) : 0;
    placeAll(S.part);
    const m = S.me; m.active = S.part.includes(m.id); m.finished = false; m.st = 'run'; m.ground = false; m.ghost = 0; m.maxZ = 0; m.jbuf = 0;
    S.yaw = n === 2 ? Math.atan2(-m.x, -m.z) : 0; S.pitch = 0.32; S.camP = new THREE.Vector3(m.x - Math.sin(S.yaw) * 8, m.y + 4, m.z - Math.cos(S.yaw) * 8);
    S.rt = 0; S.goAt = 3.2; S.ctl = false; S.endAt = null;
    const def = ROUND[n - 1];
    DOM.title.textContent = 'MANCHE ' + n + ' · ' + def.name; DOM.sub.textContent = def.sub;
    big(def.name, def.sub, 2400);
    if (!m.active) setTimeout(() => S && big('SPECTATEUR', 'Clique pour changer de joueur', 1800), 2600);
    try { Au.track('music', n === 1 ? 'duel' : 'boss_spider', 0.42); } catch (e) {}
    paintList();
  }
  function finishMe() {
    const m = S.me; m.finished = true; const t = S.rt - S.goAt;
    fx('land', { g: 1, rate: 1.3 }); sfx('buy');
    if (S.solo) { S.soloT = t; const best = BR.store.get('br_party_best', 0); if (!best || t < best) { BR.store.set('br_party_best', t); S.newBest = true; } big('ARRIVÉ !', fmt(t) + (S.newBest ? ' · NOUVEAU RECORD' : ''), 2600); S.endAt = S.rt + 3; }
    else { BR.Net.relay({ k: 'fin', t }); onFin(S.selfId, t); big('QUALIFIÉ !', fmt(t), 2400); }
  }
  function onFin(id, t) { if (S.round !== 1 || S.fin.some(f => f.id === id)) return; S.fin.push({ id, t }); const p = S.players.get(id); if (p && id !== S.selfId) feed(p.name + ' est qualifié(e) !'); paintList(); }
  function eliminateMe() {
    const m = S.me; if (!m.active) return;
    m.active = false; m.vx = m.vy = m.vz = 0; S.shake = 0.5; fx('land', { g: 1, rate: 0.6 });
    if (S.solo) { S.soloSurv = S.rt - S.goAt; big('TOMBÉ !', 'Tu as tenu ' + fmt(S.soloSurv), 2400); S.endAt = S.rt + 2.6; }
    else { BR.Net.relay({ k: 'out' }); onOut(S.selfId); big('ÉLIMINÉ', 'Regarde la fin de la manche', 2000); }
  }
  function onOut(id) { if (S.out.has(id)) return; S.out.add(id); S.outOrder.push(id); const p = S.players.get(id); if (p && id !== S.selfId) feed(p.name + ' est tombé(e) !'); paintList(); }
  let feedT = null;
  function feed(t) { DOM.sub.textContent = t; clearTimeout(feedT); feedT = setTimeout(() => { if (S) DOM.sub.textContent = ROUND[S.round - 1].sub; }, 2200); }
  const fmt = t => { t = Math.max(0, t); const mn = Math.floor(t / 60), s = t - mn * 60; return mn + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
  function paintList() {
    if (S.solo) { DOM.list.innerHTML = ''; return; }
    DOM.list.innerHTML = [...S.players.values()].map(p => {
      const inR = S.part.includes(p.id), q = S.round === 1 && S.fin.some(f => f.id === p.id), x = !inR || S.out.has(p.id);
      return `<div class="${q ? 'q' : x ? 'x' : ''} ${p === S.me ? 'me' : ''}"><span>${BR.esc(p.name)}</span><span>${q ? '✔' : x ? '✖' : S.round === 2 ? 'debout' : ''}</span></div>`;
    }).join('');
  }
  // l'hôte décide de la suite
  function hostTick() {
    if (S.solo || S.decided || !BR.Net.isHost()) return;
    const el = S.rt - S.goAt, n = S.part.length;
    if (S.round === 1) {
      const Q = n <= 2 ? n : Math.ceil(n * 0.6);
      const present = S.part.filter(id => S.players.has(id)).length;
      if (S.fin.length >= Math.min(Q, present) || el > ROUND[0].time) {
        S.decided = true; const q = S.fin.map(f => f.id);
        setTimeout(() => { if (!S) return; const msg = { k: 'rd', r: 2, q }; BR.Net.relay(msg); onRelay({ f: S.selfId, d: msg }); }, 2500);
      }
    } else {
      const alive = S.part.filter(id => S.players.has(id) && !S.out.has(id));
      if ((n > 1 && alive.length <= 1) || (n <= 1 && alive.length === 0) || el > ROUND[1].time) {
        S.decided = true;
        setTimeout(() => { if (!S) return; const msg = { k: 'res', rank: ranking(), win: alive }; BR.Net.relay(msg); onRelay({ f: S.selfId, d: msg }); }, 1800);
      }
    }
  }
  function ranking() {
    const ids = [...S.players.keys()];
    const alive = S.part.filter(id => S.players.has(id) && !S.out.has(id));
    const outs = S.outOrder.filter(id => S.players.has(id) && S.part.includes(id)).reverse();
    const rest = ids.filter(id => !alive.includes(id) && !outs.includes(id)).sort((a, b) => (S.players.get(b).maxZ || 0) - (S.players.get(a).maxZ || 0));
    return alive.concat(outs, rest);
  }

  /* ===================== réseau ===================== */
  function onRelay(m) {
    if (!S) return; const d = m.d || {}, p = S.players.get(m.f); if (!p) return;
    switch (d.k) {
      case 'p': if (p === S.me) return; p.tx = d.x; p.ty = d.y; p.tz = d.z; p.tf = d.f; p.vx = d.v[0]; p.vy = d.v[1]; p.vz = d.v[2]; p.st = d.s; p.maxZ = Math.max(p.maxZ || 0, d.z); if (d.r !== S.round) p.st = ST.spec; break;
      case 'fin': onFin(m.f, d.t); break;
      case 'out': onOut(m.f); break;
      case 'tl': crumble(d.i); break;
      case 'rd': if (d.r === 2 && S.round === 1) { if (!d.q.length) { showResults(ranking(), []); return; } S.outOrder = []; startRound(2, d.q.filter(id => S.players.has(id))); } break;
      case 'res': showResults(d.rank || [], d.win || []); break;
      case 'quit': onLeft({ id: m.f }); break;
    }
  }
  function onLeft(m) {
    const p = S && S.players.get(m.id); if (!p || p === S.me) return;
    if (p.av) { S.scene && S.scene.remove(p.av.group); p.av.dispose(); } if (p.tag) { S.scene && S.scene.remove(p.tag.sprite); p.tag.tex.dispose(); p.tag.sprite.material.dispose(); }
    S.players.delete(m.id); feed(p.name + ' a quitté la partie'); paintList();
  }
  function sendState(dt) {
    if (S.solo) return; S.sendT -= dt; if (S.sendT > 0) return; S.sendT = 1 / 14;
    const m = S.me, r2 = v => Math.round(v * 100) / 100;
    BR.Net.relay({ k: 'p', r: S.round, x: r2(m.x), y: r2(m.y), z: r2(m.z), f: r2(m.face), v: [r2(m.vx), r2(m.vy), r2(m.vz)], s: m.active ? (m.st === 'run' && !m.ground ? ST.air : ST[m.st]) : ST.spec });
  }

  /* ===================== résultats ===================== */
  function showResults(rank, win) {
    if (S.results) return; S.results = true; S.ctl = false; unlock();
    const me = S.selfId, pos = rank.indexOf(me), names = id => (S.players.get(id) || {}).name || '?';
    let pts, xp, title, sub;
    if (S.solo) {
      const fin = S.soloT != null, surv = S.soloSurv != null ? S.soloSurv : ROUND[1].time;
      pts = 10 + (fin ? 15 : 0) + Math.floor(surv / 4); title = fin ? 'BIEN JOUÉ !' : 'ENTRAÎNEMENT TERMINÉ';
      sub = (fin ? 'Parcours : ' + fmt(S.soloT) + (S.newBest ? ' (record !)' : '') : 'Parcours non terminé') + ' · Toupie : ' + fmt(surv);
    } else {
      const won = win.includes(me), qual = S.round === 2 && S.part.includes(me);
      pts = won ? 60 : qual ? 25 : 10; title = won ? 'VICTOIRE !' : pos === 1 ? '2e PLACE !' : 'PERDU…'; sub = win.length ? 'Gagnant : ' + win.map(names).join(', ') : 'Personne n\'est resté debout';
    }
    xp = pts * 3;
    let lv = null; try { lv = BR.Account.applyResult({ points: pts, xp, multi: !S.solo, time: S.rt }); } catch (e) {}
    fx('land', { g: 1, rate: 1.2 }); sfx(title.startsWith('VICT') || title.startsWith('BIEN') ? 'buy' : 'back');
    const rows = S.solo ? '' : `<table>${rank.map((id, i) => `<tr class="${id === me ? 'me' : ''}"><td>${i + 1}</td><td>${BR.esc(names(id))}</td><td>${win.includes(id) ? '👑 Vainqueur' : S.part.includes(id) ? 'Finaliste' : 'Manche 1'}</td></tr>`).join('')}</table>`;
    DOM.card.innerHTML = `<h2>${title}</h2><p>${BR.esc(sub)}</p>${rows}<div class="pt-gain">+${pts} points · +${xp} XP${lv && lv.levelUp ? ' · NIVEAU ' + lv.after.level + ' !' : ''}</div>
      <div class="pt-b">${S.solo ? '<button data-a="replay">Rejouer</button><button class="alt" data-a="menu">Menu</button>' : '<button data-a="lobby">Retour au salon</button>'}</div>`;
    DOM.panel.classList.add('on');
    DOM.card.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { sfx('click'); const a = b.dataset.a, cb = S.o.onEnd; P.stop(); if (cb) cb(a); }));
    if (!S.solo && BR.Net.isHost()) BR.Net.send({ t: 'end', res: { rank, win } });
  }

  /* ===================== boucle ===================== */
  function frame(now) {
    if (!S) return;
    S.raf = requestAnimationFrame(frame);
    let dt = (now - S.last) / 1000; S.last = now; if (!(dt > 0)) dt = 0; if (dt > 0.05) dt = 0.05;
    step(dt);
    R.render(S.scene, S.cam);
  }
  function step(dt) {
    S.rt += dt;
    updateWorld(S.round === 2 ? Math.max(0, S.rt - S.goAt) : S.rt, dt);
    // compte à rebours
    if (!S.ctl && !S.results && S.rt < S.goAt + 0.1) {
      const left = Math.ceil(S.goAt - S.rt);
      if (S.rt > 2.4 && left !== S.cd && left > 0) { S.cd = left; big(String(left), '', 700); sfx('click'); }
      if (S.rt >= S.goAt) { S.ctl = true; S.cd = 0; big('GO !', '', 800); sfx('ok'); }
    }
    if (S.round === 2 && S.high && S.high.off && S.rt - S.goAt > 25) { S.high.off = false; S.high.g.visible = true; feed('Attention : la barre HAUTE arrive — ne saute pas dessus !'); }
    // physique (2 sous-pas pour la précision)
    const n = dt > 1 / 70 ? 2 : 1; for (let i = 0; i < n; i++) stepMe(dt / n);
    updateAvatars(dt);
    updateCam(dt);
    sendState(dt);
    hostTick();
    // chrono
    const el = S.rt - S.goAt, lim = ROUND[S.round - 1].time;
    DOM.time.textContent = S.ctl ? (S.round === 1 ? fmt(Math.max(0, el)) : fmt(Math.max(0, lim - el))) : '';
    if (S.solo && !S.results) {
      if (S.endAt != null && S.rt > S.endAt) { S.endAt = null; if (S.round === 1) startRound(2, [S.selfId]); else showResults([S.selfId], []); }
      else if (S.endAt == null && S.ctl && el > lim) { if (S.round === 1) { big('TEMPS ÉCOULÉ', '', 1600); S.endAt = S.rt + 1.8; } else { S.soloSurv = lim; showResults([S.selfId], [S.selfId]); } }
    }
    DOM.click.classList.toggle('on', !S.locked && !S.results && !S.paused);
  }

  /* ===================== entrées ===================== */
  let bound = false;
  function bindInput(on) {
    if (on === bound) return; bound = on;
    const f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('keydown', onKey, true); window[f]('keyup', onKeyUp, true);
    document[f]('mousemove', onMouse); document[f]('pointerlockchange', onLock);
    DOM.gl[f]('mousedown', onDown); DOM.gl[f]('contextmenu', noCtx); window[f]('blur', onBlur);
  }
  const noCtx = e => e.preventDefault();
  function onBlur() { for (const k in keys) keys[k] = false; }
  function lock() { try { const r = DOM.gl.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  function unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} }
  function onLock() { if (S) S.locked = document.pointerLockElement === DOM.gl; }
  function onDown(e) {
    if (!S || S.results) return;
    if (!S.locked) { lock(); return; }
    if (e.button === 2) S.diveReq = true;
    else if (!S.me.active) S.specI = (S.specI || 0) + 1;
  }
  function onMouse(e) { if (!S || !S.locked) return; const k = 0.0024 * ((BR.settings.sens || 1)); S.yaw -= e.movementX * k; S.pitch = clamp(S.pitch + e.movementY * k, -0.25, 1.15); }
  function onKey(e) {
    if (!S) return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (e.code === 'Escape') { if (!S.results) pauseMenu(); return; }
    keys[e.code] = true;
    if (e.code === 'Space') { S.me.jbuf = 0.13; e.preventDefault(); }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') && !e.repeat) S.diveReq = true;
    if (/^(Key[WASDE]|Arrow|Space)/.test(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys[e.code] = false; }
  function pauseMenu() {
    if (S.paused) { S.paused = false; DOM.panel.classList.remove('on'); lock(); return; }
    S.paused = true; unlock();
    DOM.card.innerHTML = `<h2>PAUSE</h2><p>${S.solo ? 'Le jeu continue de tourner derrière.' : 'La partie continue pour les autres !'}</p><div class="pt-b"><button data-a="back">Reprendre</button><button class="alt" data-a="quit">Quitter la partie</button></div>`;
    DOM.panel.classList.add('on');
    DOM.card.querySelector('[data-a=back]').onclick = () => { sfx('click'); S.paused = false; DOM.panel.classList.remove('on'); lock(); };
    DOM.card.querySelector('[data-a=quit]').onclick = () => { sfx('back'); if (!S.solo) BR.Net.relay({ k: 'quit' }); const cb = S.o.onEnd; P.stop(); if (cb) cb(S && S.solo ? 'menu' : 'lobby'); };
  }

  /* ===================== démarrage / arrêt ===================== */
  P.start = function (o) {
    if (S) P.stop();
    ensureDom(); renderer();
    S = { o, solo: o.mode !== 'multi', seed: o.seed >>> 0, selfId: o.selfId, players: new Map(), disp: [], solids: [], haz: [], checks: [], spawns: [], tramps: [],
      unsub: [], sendT: 0, shake: 0, yaw: 0, pitch: 0.32, last: performance.now(), rt: 0, round: 0, part: [], out: new Set(), outOrder: [], fin: [], check: 0 };
    o.roster.forEach(r => S.players.set(r.id, { id: r.id, name: r.name, look: r.look || BR.Avatar.defaultLook(), x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, vx: 0, vy: 0, vz: 0, face: 0, tf: 0, st: 0,
      ground: false, active: true, jbuf: 0, coyote: 0, ghost: 0, diveUsed: false, stT: 0 }));
    S.me = S.players.get(S.selfId);
    S.cam = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
    makeAvatars();
    if (!S.solo) {
      const N = BR.Net;
      S.unsub.push(N.on('r', onRelay), N.on('left', onLeft),
        N.on('lost', () => abort('Connexion au serveur perdue.')), N.on('kicked', m => abort(m.msg || 'Exclu du salon.')));
    }
    DOM.panel.classList.remove('on'); DOM.root.classList.add('on'); DOM.big.classList.remove('on');
    bindInput(true); resize();
    startRound(1, [...S.players.keys()]);
    P.active = true;
    try { BR.MenuBG && BR.MenuBG.stop(); } catch (e) {}
    S.raf = requestAnimationFrame(frame);
    // onglet en arrière-plan : on continue d'envoyer sa position (sinon on « gèle » chez les autres)
    if (!S.solo) S.bg = setInterval(() => { if (S && document.hidden) { const now = performance.now(); step(Math.min(0.05, (now - S.last) / 1000)); S.last = now; } }, 50);
  };
  function abort(msg) { if (!S) return; const cb = S.o.onEnd; P.stop(); try { BR.UI.toast(msg, 'error'); } catch (e) {} if (cb) cb('menu'); }
  P.stop = function () {
    if (!S) return;
    cancelAnimationFrame(S.raf); clearInterval(S.bg);
    bindInput(false); unlock();
    S.unsub.forEach(f => f());
    for (const p of S.players.values()) { if (p.av) p.av.dispose(); if (p.tag) { p.tag.tex.dispose(); p.tag.sprite.material.dispose(); } }
    clearWorld();
    DOM.root.classList.remove('on'); DOM.panel.classList.remove('on');
    if (R) { R.clear(); R.renderLists.dispose(); }
    try { Au.track('music', 'menu', 0.8); } catch (e) {}
    S = null; P.active = false;
    for (const k in keys) keys[k] = false;
  };
  P.session = () => S;
  P._step = dt => S && step(dt);
})();

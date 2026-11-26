/* ===== arena/maps/neant.js : thème de la carte « Le Néant » (niveau 5, la finale) — voir js/arena/maps/README-CARTES.md =====
   Un sanctuaire céleste brisé qui flotte dans le cosmos :
   - chaque salle est une île : dallage en mosaïque (sceau runique au centre), racine de roche qui pend dans le vide ;
   - bord : garde-corps de marbre + voile runique (mur invisible matérialisé), colonnade antique, arches monumentales aux portes ;
   - altitude : terrasses à gradins (0,6 / 1,2 / 1,8 m), dais des gardiens ailés ;
   - en l'air : halo runique géant, anneaux autour des piliers, ceinture de ruines en orbite lente (colonnes, arches, escaliers) ;
   - au loin : îles flottantes, temple et arche colossaux, lignes de lumière, et un ciel cosmique (nébuleuse précalculée sur le GPU,
     étoiles, aurores, planète géante ou trou noir) dessiné comme une skybox qui suit la caméra.
   Modèles Blender : outils/blender-map-neant.py → assets-map-neant.js (map_neant_*), recolorés selon l'ambiance par nom de matériau.
   Tout le hasard de la géométrie passe par B.rnd() (même salle chez tous les joueurs). */
(function () {
  const BR = window.BR, DG = BR.Dungeon, A = DG.api, L = A.L, BOX = A.BOX, ROCK = A.ROCK;
  const M = DG.mapOf('neant');
  const PI = Math.PI, TAU = PI * 2;

  /* =====================================================================
     AMBIANCES (étages 1-5 : aube céleste dorée · 6-10 : nébuleuse violette · 11+ : trou noir rouge et noir)
     Champs du moteur (stone, floor, trim, sky, fog, hemi, moon…) + champs du thème (marbre, roche, cristal, nébuleuse, planète…)
     ===================================================================== */
  M.exp = 1.1;
  M.tiers = [
    { n: 'Le Sanctuaire céleste', stone: '#7c6c98', mortar: '#1a1226', floor: '#c8bdb2', trim: '#e0d6c6', wood: '#9a7486', metal: '#4a3e3a', accent: '#ffc65a', banner: '#4a1a7a', moss: 0, glow: '#5ae0ff',
      sky: ['#0a0a2a', '#34286a', '#b0647a'], fog: ['#3c2c5c', 0.0048], hemi: ['#e0d8ff', '#4a3a5e', 0.66], moon: ['#ffe2bc', 0.95],
      marbre: '#d4cabb', marbreF: '#a094b2', roche: '#584a74', rocheC: '#7e6e9a', or: '#e8b440', bronze: '#6a5848', rune: '#ffc65a', cristal: '#5ae0ff',
      dalle: ['#9a8e8c', '#8e8484', '#a49894', '#94888a'], dalleF: ['#7c7090', '#706484', '#847898'], joint: '#5c4c68',
      neb: ['#ff5a8a', '#ffae50', '#3cd6d6'], nebK: 0.9, nadir: '#1a0c34', vortex: '#ff9a6a', aur: '#ffd27a', veil: '#ffd890',
      pl: { k: 0, dir: [0.46, 0.2, 0.86], r: 0.2, c1: '#f4e0b4', c2: '#c4865a', ring: '#f6e8cc', ax: [0.28, 1, 0.12] } },
    { n: 'La Nébuleuse', stone: '#5a4c86', mortar: '#0e0a20', floor: '#aaa2c8', trim: '#c4bce0', wood: '#7a5a8a', metal: '#3a3448', accent: '#c58aff', banner: '#3a1a7a', moss: 0, glow: '#b07aff',
      sky: ['#04031a', '#24104e', '#8a3a9a'], fog: ['#281848', 0.005], hemi: ['#d0c4ff', '#30244c', 0.74], moon: ['#d8ccff', 0.95],
      marbre: '#c8c0e2', marbreF: '#8a80b0', roche: '#3c3266', rocheC: '#5a4e8a', or: '#e0b44a', bronze: '#4a4058', rune: '#5ae8ff', cristal: '#c07aff',
      dalle: ['#827aa0', '#787096', '#8a82a8', '#7e769c'], dalleF: ['#5e5680', '#544c76', '#665e88'], joint: '#3a305a',
      neb: ['#a04aff', '#2ab8ff', '#ff3ac0'], nebK: 1.15, nadir: '#0c0420', vortex: '#7a5aff', aur: '#4affd0', veil: '#7ae8ff',
      pl: { k: 0, dir: [-0.5, 0.24, 0.83], r: 0.24, c1: '#8ad0ff', c2: '#2a4a9e', ring: '#b8e8ff', ax: [-0.3, 1, 0.2] } },
    { n: 'Le Trône du Néant', stone: '#3a2a34', mortar: '#060204', floor: '#6a5862', trim: '#8a7680', wood: '#7a3a3a', metal: '#2a2024', accent: '#ff5a3a', banner: '#5a0a1a', moss: 0, glow: '#ff4a2a',
      sky: ['#020002', '#1c0408', '#6a160e'], fog: ['#1e080a', 0.0055], hemi: ['#ffd0c4', '#2a1418', 0.8], moon: ['#ffcaa8', 1.0],
      marbre: '#8e7c84', marbreF: '#5a4a52', roche: '#2a1e26', rocheC: '#43313c', or: '#d49a3a', bronze: '#3a2a26', rune: '#ff9a3a', cristal: '#ff3a2a',
      dalle: ['#6e5c66', '#64525c', '#76646e', '#5e4e58'], dalleF: ['#4a3c44', '#42343c', '#52444c'], joint: '#1e1218',
      neb: ['#ff2a1a', '#ff8a2a', '#8a1a6a'], nebK: 1.0, nadir: '#000000', vortex: '#ff3a1a', aur: '#ff4a6a', veil: '#ff6a3a',
      pl: { k: 1, dir: [0.16, 0.3, 0.94], r: 0.085, c1: '#ffe0a0', c2: '#ff3a10', ring: '#ffb060', ax: [0.1, 1, -0.78] } },
  ];

  /* =====================================================================
     MATÉRIAUX (couleurs unies, style KayKit ; recolorés par ambiance)
     ===================================================================== */
  const MATK = { marbre: 'n_marbre', marbre_f: 'n_marbre_f', roche: 'n_roche', roche_c: 'n_roche_c', or: 'n_or', bronze: 'n_bronze', cristal: 'n_cristal', rune: 'n_rune' };
  function std(c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: L(c), roughness: 0.8, metalness: 0 }, o || {})); }
  function glowMat(c, k, o) { return std('#000000', Object.assign({ color: L(c).multiplyScalar(0.35), emissive: L(c), emissiveIntensity: k, roughness: 0.3 }, o || {})); }
  // dalles du sol (UV « monde », 6 m) : grandes pierres en quinconce, joints fins, incrustations dorées
  function floorTex(P) {
    const key = 'nf' + P.id; if (A.texCache[key]) return A.texCache[key];
    const r = A.rnd(53);
    const map = A.mkTex(A.cv(512, (g, n) => {
      g.fillStyle = P.joint; g.fillRect(0, 0, n, n);
      const rows = 4, h = n / rows;
      for (let j = 0; j < rows; j++) {
        let x = -(j % 2) * n / 6 - r() * 20;
        while (x < n) {
          const w = n / 3 * (0.7 + r() * 0.6), cc = new THREE.Color(P.dalle[Math.floor(r() * P.dalle.length)]).multiplyScalar(0.84 + r() * 0.1);
          for (const ox of [0, n]) {
            const x0 = x - ox + 2.5, y0 = j * h + 2.5, ww = Math.min(w, n + ox - x) - 5, hh = h - 5;
            if (ww <= 0) continue;
            g.fillStyle = '#' + cc.getHexString(); g.fillRect(x0, y0, ww, hh);
            g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x0, y0, ww, 3);
            g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x0, y0 + hh - 5, ww, 5);
          }
          x += w;
        }
      }
      g.fillStyle = P.or; for (let k = 0; k < 6; k++) { const x = r() * n, y = Math.floor(r() * rows) * h; g.save(); g.translate(x, y); g.rotate(PI / 4); g.fillRect(-4, -4, 8, 8); g.restore(); }
    }));
    return (A.texCache[key] = { map });
  }
  function setup(B) {
    const P = B.P, q = B.quality;
    const mt = B.mats;
    mt.n_marbre = std(P.marbre, { roughness: 0.62 });
    mt.n_marbre_f = std(P.marbreF, { roughness: 0.78 });
    mt.n_roche = std(P.roche, { roughness: 0.95, flatShading: true });
    mt.n_roche_c = std(P.rocheC, { roughness: 0.92, flatShading: true });
    mt.n_or = std(P.or, { roughness: 0.32, metalness: 0.85, emissive: L(P.or).multiplyScalar(0.14) });
    mt.n_bronze = std(P.bronze, { roughness: 0.5, metalness: 0.6 });
    mt.n_cristal = glowMat(P.cristal, 1.7, { flatShading: true });
    mt.n_rune = glowMat(P.rune, 1.9);
    // matériaux du moteur (portes, ponts, énigmes) : mêmes teintes
    const ft = floorTex(P);
    mt.floor = std(P.floor, { color: 0xffffff, map: ft.map, roughness: 0.78 });
    mt.trim = std(P.marbre, { roughness: 0.65 });
    mt.wall = std(P.roche, { roughness: 0.95, flatShading: true });
    mt.wood = std(P.wood, { roughness: 0.85, flatShading: true });   // dalles friables des énigmes : pierre rosée fêlée
    mt.dark = std(P.nadir === '#000000' ? '#0a0406' : '#120a22', { roughness: 1 });
    mt.metal = std(P.bronze, { roughness: 0.45, metalness: 0.7 });
    mt.gold = std(P.or, { roughness: 0.32, metalness: 0.85, emissive: L(P.or).multiplyScalar(0.14) });
    mt.glow = glowMat(P.cristal, 1.4);
    B._bobU = { value: 0 }; B._bob = {}; B._q = q;
  }

  /* =====================================================================
     MODÈLES : géométries extraites une fois, puis fusionnées (B.add) ou animées (groupes « AG »)
     ===================================================================== */
  const MP = {};
  function parts(name) {
    if (MP[name]) return MP[name];
    const sc = A.model('map_neant_' + name); if (!sc) return [];
    sc.updateMatrixWorld(true);
    const out = [];
    sc.traverse(o => {
      if (!o.isMesh) return;
      const nm = String((o.material && o.material.name) || 'marbre').split('.')[0];
      let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); if (g.index) { const g2 = g.toNonIndexed(); g.dispose(); g = g2; }
      if (!g.attributes.normal) g.computeVertexNormals();
      out.push({ mk: MATK[nm] || 'n_marbre', geo: g });
    });
    return (MP[name] = out);
  }
  /** pose un modèle dans le décor fusionné */
  function put(B, name, x, y, z, ry, s, rx, rz) {
    const sx = Array.isArray(s) ? s[0] : (s || 1), sy = Array.isArray(s) ? s[1] : sx, sz = Array.isArray(s) ? s[2] : sx;
    for (const p of parts(name)) B.add(p.mk, p.geo, x, y, z, ry || 0, rx || 0, rz || 0, sx, sy, sz);
  }
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
  function mtx(x, y, z, ry, s, rx, rz) {
    const sx = Array.isArray(s) ? s[0] : (s || 1), sy = Array.isArray(s) ? s[1] : sx, sz = Array.isArray(s) ? s[2] : sx;
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz);
    return _m4.clone().compose(_v, _q, _s);
  }
  // matériau qui flotte (chaque pièce monte et descend doucement : attribut aPh = phase, amplitude)
  function bobMat(B, mk) {
    if (B._bob[mk]) return B._bob[mk];
    const m = B.mats[mk].clone(), U = B._bobU;
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = U;
      sh.vertexShader = 'attribute vec2 aPh;\nuniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.y += sin(uT * 0.55 + aPh.x) * aPh.y;');
    };
    m.customProgramCacheKey = () => 'neant-bob';
    B.disposables.push(m);
    return (B._bob[mk] = m);
  }
  /** groupe animé : pièces fusionnées par matériau dans un THREE.Group (qui peut tourner) */
  function AG(B, x, y, z) {
    const P = {}, grp = new THREE.Group(); grp.position.set(x || 0, y || 0, z || 0); B.g.add(grp);
    const G = {
      grp,
      add(mk, geo, m4, ph, amp) {
        let g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m4);
        const n = g.attributes.position.count, a = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) { a[i * 2] = ph || 0; a[i * 2 + 1] = amp || 0; }
        g.setAttribute('aPh', new THREE.BufferAttribute(a, 2));
        (P[mk] = P[mk] || []).push(g);
      },
      put(name, m4, ph, amp) { for (const p of parts(name)) G.add(p.mk, p.geo, m4, ph, amp); },
      build(shadow) {
        for (const mk in P) {
          const list = P[mk]; let n = 0; list.forEach(g => { n += g.attributes.position.count; });
          const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), ph = new Float32Array(n * 2); let o = 0;
          list.forEach(g => { pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3); ph.set(g.attributes.aPh.array, o * 2); o += g.attributes.position.count; g.dispose(); });
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 2));
          geo.computeBoundingSphere(); geo.boundingSphere.radius += 3;
          const m = new THREE.Mesh(geo, bobMat(B, mk)); m.castShadow = !!shadow; m.receiveShadow = true; grp.add(m);
        }
        return grp;
      },
    };
    return G;
  }
  function animate(B) { const U = B._bobU; B.anims.push((dt, t) => { U.value = t; }); }

  /* =====================================================================
     SOL EN MOSAÏQUE (sceau runique), dessiné une fois par ambiance
     ===================================================================== */
  function mosaic(P, kind, Rt) {
    const key = 'nm' + kind + P.id; if (A.texCache[key]) return A.texCache[key];
    const N = 2048, s = N / (2 * Rt), c0 = N / 2, r = A.rnd(kind === 'hall' ? 71 : 73);
    const hall = kind === 'hall';
    // anneaux : [r0, r1, type, segments, sous-anneaux]
    const rings = hall
      ? [[0, 3.3, 'medal'], [3.3, 3.6, 'gold'], [3.6, 9.5, 'slab', 16, 2], [9.5, 10.4, 'glow'], [10.4, 18, 'slab', 24, 3], [18, 18.5, 'gold'], [18.5, 25.9, 'slab', 32, 3], [25.9, 26.6, 'glow2'], [26.6, Rt, 'dark', 44, 4]]
      : [[0, 2.4, 'medal'], [2.4, 2.7, 'gold'], [2.7, 7.8, 'slab', 12, 2], [7.8, 8.5, 'glow'], [8.5, 13.6, 'slab', 20, 2], [13.6, 14.0, 'gold'], [14.0, Rt, 'dark', 28, 3]];
    const sector = (g, ra, rb, a0, a1) => { g.beginPath(); g.arc(c0, c0, rb * s, a0, a1); g.arc(c0, c0, ra * s, a1, a0, true); g.closePath(); g.fill(); };
    const hexc = c => '#' + c.getHexString();
    const map = A.mkTex(A.cv(N, g => {
      g.fillStyle = P.joint; g.fillRect(0, 0, N, N);
      for (const [r0, r1, type, nSeg, nSub] of rings) {
        if (type === 'slab' || type === 'dark') {
          const pal = type === 'dark' ? P.dalleF : P.dalle;
          for (let j = 0; j < nSub; j++) {
            const ra = r0 + (r1 - r0) * j / nSub, rb = r0 + (r1 - r0) * (j + 1) / nSub, off = (j % 2) * 0.5;
            for (let k = 0; k < nSeg; k++) {
              const a0 = (k + off) / nSeg * TAU, a1 = (k + 1 + off) / nSeg * TAU, jw = 3.2 / s;
              const cc = new THREE.Color(pal[Math.floor(r() * pal.length)]).multiplyScalar(0.95 + r() * 0.09);
              g.fillStyle = hexc(cc); sector(g, ra + jw, rb - jw, a0 + jw / rb, a1 - jw / rb);
              g.fillStyle = 'rgba(255,255,255,0.05)'; sector(g, rb - jw - 0.12, rb - jw, a0 + jw / rb, a1 - jw / rb);
            }
          }
        } else if (type === 'gold') { g.fillStyle = P.or; sector(g, r0, r1, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 64; k++) { const a = k / 64 * TAU; g.beginPath(); g.arc(c0 + Math.cos(a) * (r0 + r1) / 2 * s, c0 + Math.sin(a) * (r0 + r1) / 2 * s, (r1 - r0) * s * 0.22, 0, TAU); g.fill(); } }
        else if (type === 'glow' || type === 'glow2') { g.fillStyle = hexc(new THREE.Color(P.joint).multiplyScalar(0.7)); sector(g, r0, r1, 0, TAU); }
        else if (type === 'medal') {
          g.fillStyle = P.dalleF[0]; sector(g, 0, r1, 0, TAU);
          // étoile à 8 branches dorée sur fond clair
          g.fillStyle = P.dalle[2]; sector(g, 0, r1 * 0.86, 0, TAU);
          g.fillStyle = P.or; g.beginPath();
          for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = (k % 2 ? 0.38 : 0.95) * r1 * s; g.lineTo(c0 + Math.cos(a) * rr, c0 + Math.sin(a) * rr); } g.closePath(); g.fill();
          g.fillStyle = P.dalleF[1]; g.beginPath(); g.arc(c0, c0, r1 * 0.3 * s, 0, TAU); g.fill();
        }
      }
      // rayons de la rose des vents (dorés) et fins rayons sombres
      const rMax = hall ? 25.9 : 13.6;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * TAU + TAU / 32, w = (k % 2 ? 0.07 : 0.16) * s;
        g.save(); g.translate(c0, c0); g.rotate(a); g.fillStyle = k % 2 ? P.joint : P.or; g.fillRect((hall ? 3.6 : 2.7) * s, -w / 2, (rMax - (hall ? 3.6 : 2.7)) * s, w); g.restore();
      }
    }));
    const em = A.mkTex(A.cv(N, g => {
      g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.lineCap = 'round';
      const glyphRing = (rc, w, col, n) => {
        g.strokeStyle = col; g.lineWidth = Math.max(2, 0.05 * s);
        g.beginPath(); g.arc(c0, c0, (rc - w * 0.42) * s, 0, TAU); g.stroke(); g.beginPath(); g.arc(c0, c0, (rc + w * 0.42) * s, 0, TAU); g.stroke();
        g.lineWidth = Math.max(2, 0.06 * s);
        for (let k = 0; k < n; k++) {
          const a = (k + 0.5) / n * TAU, x = c0 + Math.cos(a) * rc * s, y = c0 + Math.sin(a) * rc * s, h = w * 0.28 * s, t = Math.floor(r() * 5);
          g.save(); g.translate(x, y); g.rotate(a + PI / 2); g.beginPath();
          if (t === 0) { g.arc(0, 0, h * 0.7, 0, TAU); g.moveTo(-h, 0); g.lineTo(h, 0); }
          else if (t === 1) { g.moveTo(-h * 0.7, h); g.lineTo(0, -h); g.lineTo(h * 0.7, h); g.moveTo(-h * 0.4, h * 0.2); g.lineTo(h * 0.4, h * 0.2); }
          else if (t === 2) { g.moveTo(0, -h); g.lineTo(0, h); g.moveTo(-h * 0.7, -h * 0.4); g.lineTo(h * 0.7, h * 0.4); }
          else if (t === 3) { g.rect(-h * 0.6, -h * 0.6, h * 1.2, h * 1.2); g.moveTo(0, -h); g.lineTo(0, h); }
          else { g.moveTo(-h, -h * 0.6); g.lineTo(h, -h * 0.6); g.moveTo(-h * 0.6, h * 0.6); g.lineTo(h * 0.6, h * 0.6); g.moveTo(0, -h); g.lineTo(0, h); }
          g.stroke(); g.restore();
        }
      };
      for (const [r0, r1, type] of rings) {
        if (type === 'glow') glyphRing((r0 + r1) / 2, r1 - r0, P.cristal, hall ? 36 : 28);
        if (type === 'glow2') glyphRing((r0 + r1) / 2, r1 - r0, P.rune, 64);
        if (type === 'medal') {
          g.strokeStyle = P.cristal; g.lineWidth = Math.max(3, 0.07 * s);
          g.beginPath(); g.arc(c0, c0, r1 * 0.3 * s, 0, TAU); g.stroke();
          g.beginPath(); for (let k = 0; k <= 16; k++) { const a = k / 16 * TAU, rr = (k % 2 ? 0.38 : 0.95) * r1 * s; g.lineTo(c0 + Math.cos(a) * rr, c0 + Math.sin(a) * rr); } g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1;
        }
      }
    }), true);
    return (A.texCache[key] = { map, em });
  }

  /* =====================================================================
     L'ÎLE : sol (physique : disque rayon rf), plateau visuel (rayon rv), tranche, racine qui pend dans le vide
     ===================================================================== */
  function island(B, rf, rv, kind) {
    const P = B.P;
    B.floors.push({ t: 'd', x: 0, z: 0, r: rf });
    const tx = mosaic(P, kind, rv);
    const top = new THREE.MeshStandardMaterial({ map: tx.map, emissive: 0xffffff, emissiveMap: tx.em, emissiveIntensity: 1.0, roughness: 0.58, metalness: 0.04 });
    const geo = new THREE.CylinderGeometry(rv, rv, 1.2, 96, 1, false);
    const m = new THREE.Mesh(geo, [B.mats.n_marbre_f, top, B.mats.n_roche]); m.position.y = -0.6; m.receiveShadow = true; B.g.add(m);
    B.disposables.push(top);
    // listel doré sur la tranche
    const band = new THREE.CylinderGeometry(rv + 0.06, rv + 0.06, 0.16, 96, 1, true); B.add('n_or', band, 0, -0.14, 0); band.dispose();
    // la racine
    put(B, 'racine', 0, -1.15, 0, B.rnd() * TAU, [rv + 0.3, rv * 0.95, rv + 0.3]);
  }

  /* ---------- voile runique : un mur invisible rendu visible (bande lumineuse qui s'efface vers le haut) ---------- */
  const VEIL_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const VEIL_FS = 'uniform vec3 col; uniform float uT; varying vec2 vUv; void main(){ float f = pow(1.0 - vUv.y, 2.2); float scan = 0.55 + 0.45 * sin(vUv.y * 24.0 - uT * 2.0); float cols = 0.6 + 0.4 * sin(vUv.x * 6.2831853 + uT * 0.5); float e = smoothstep(0.0, 0.06, vUv.y); gl_FragColor = vec4(col * f * scan * cols * e * 0.85, 1.0); }';
  function veilMat(B) {
    if (B._veil) return B._veil;
    const U = { col: { value: L(B.P.veil) }, uT: { value: 0 } };
    const m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VEIL_VS, fragmentShader: VEIL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    B.disposables.push(m); B.anims.push((dt, t) => { U.uT.value = t; });
    return (B._veil = m);
  }
  function veilMesh(B, geo, len) {
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 2.2);
    const m = new THREE.Mesh(geo, veilMat(B)); m.renderOrder = 2; B.g.add(m); return m;
  }

  /* ---------- garde-corps circulaire (rayon rr) : ouvert au nord et au sud sur |x| < gx ; mur invisible au-dessus ---------- */
  function railRing(B, rr, gx) {
    const d0 = Math.asin(gx / rr);
    for (const [a0, a1] of [[d0, PI - d0], [PI + d0, TAU - d0]]) {
      const n = Math.ceil((a1 - a0) * rr / 2.6);
      for (let i = 0; i < n; i++) {
        const b0 = a0 + (a1 - a0) * i / n, b1 = a0 + (a1 - a0) * (i + 1) / n, am = (b0 + b1) / 2, ch = 2 * rr * Math.sin((b1 - b0) / 2) + 0.06;
        const x = Math.sin(am) * rr, z = Math.cos(am) * rr;
        B.add('n_marbre_f', BOX, x, 0.42, z, am, 0, 0, ch, 0.84, 0.7);
        B.add('n_marbre', BOX, Math.sin(am) * (rr - 0.02), 0.92, Math.cos(am) * (rr - 0.02), am, 0, 0, ch + 0.02, 0.16, 0.92);
        B.add('n_or', BOX, Math.sin(am) * (rr - 0.47), 0.83, Math.cos(am) * (rr - 0.47), am, 0, 0, ch, 0.06, 0.04);
        if (i % 2 === 0) B.add('n_rune', BOX, Math.sin(am) * (rr - 0.36), 0.42, Math.cos(am) * (rr - 0.36), am, 0, 0, ch * 0.42, 0.14, 0.04);
        B.solid(x, z, ch / 2, 0.4, am, -2, 40);
      }
      const geo = new THREE.CylinderGeometry(rr - 0.1, rr - 0.1, 3.4, Math.ceil((a1 - a0) * 12), 1, true, a0, a1 - a0); geo.translate(0, 1.0 + 1.7, 0);
      veilMesh(B, geo, (a1 - a0) * rr);
    }
  }
  /* ---------- garde-corps droit (énigmes) ---------- */
  function railLine(B, x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(z1 - z0, x1 - x0) * -1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // ry : l'axe local x suit le segment
    B.add('n_marbre_f', BOX, cx, 0.42, cz, ry, 0, 0, len, 0.84, 0.7);
    B.add('n_marbre', BOX, cx, 0.92, cz, ry, 0, 0, len + 0.04, 0.16, 0.92);
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; if (i % 2 === 0) B.add('n_rune', BOX, cx + (x1 - x0) * t, 0.42, cz + (z1 - z0) * t, ry, 0, 0, len / n * 0.42, 0.14, 0.74); }
    B.solid(cx, cz, len / 2, 0.4, ry, -2, 40);
    const geo = new THREE.PlaneGeometry(len, 3.4); geo.translate(0, 2.7, 0); geo.rotateY(ry); geo.translate(cx, 0, cz);
    veilMesh(B, geo, len);
  }

  /* ---------- arche monumentale autour d'une porte (l'ouverture de la porte reste libre : |x| < 3,4) ---------- */
  function gate(B, D, broken) {
    put(B, broken ? 'arche_brisee' : 'arche', D.x, 0, D.z, D.ry);
    for (const s of [-1, 1]) B.solid(D.x + D.ux * s * 4.6, D.z + D.uz * s * 4.6, 0.65, 0.95, D.ry, -2, 40);
    // chemin de lumière sur le pont, lanternes de cristal qui flottent de chaque côté
    const P = B.P, mid = 4.6, L2 = 7;
    B.add('n_rune', BOX, D.x + D.ox * mid, 0.012, D.z + D.oz * mid, D.ry, 0, 0, 0.22, 0.025, L2 + 0.6);
    for (const s of [-1, 1]) B.add('n_cristal', BOX, D.x + D.ox * mid + D.ux * s * 1.2, 0.01, D.z + D.oz * mid + D.uz * s * 1.2, D.ry, 0, 0, 0.08, 0.02, L2 + 0.6);
    if (!B._lant) B._lant = AG(B);
    for (const s of [-1, 1]) for (const k of [2.2, 6.2]) {
      const x = D.x + D.ox * k + D.ux * s * 4.3, z = D.z + D.oz * k + D.uz * s * 4.3, y = 2.6 + B.rnd() * 0.8, ph = B.rnd() * 6;
      B._lant.put('cristaux', mtx(x, y, z, B.rnd() * TAU, 0.42, PI, 0), ph, 0.35);
      B._lant.add('n_roche', ROCK, mtx(x, y + 0.3, z, B.rnd() * TAU, [1.2, 0.7, 1.2]), ph, 0.35);
    }
    B.spot(D.x + D.ox * 4.2, 3.2, D.z + D.oz * 4.2, P.cristal, 1.3, { dist: 14 });
    // rochers sous le pont
    for (let i = 0; i < 3; i++) B.add('n_roche_c', ROCK, D.x + D.ox * (2 + i * 2.4) + D.ux * (B.rnd() - 0.5) * 3, -3 - B.rnd() * 3, D.z + D.oz * (2 + i * 2.4) + D.uz * (B.rnd() - 0.5) * 3, B.rnd() * 6, B.rnd(), B.rnd(), 2.2, 2.8, 2.2);
  }

  /* ---------- colonne (avec collision) ---------- */
  function column(B, x, z, broken, ry, s, y0) {
    s = s || 1;
    put(B, broken ? 'colonne_brisee' : 'colonne', x, y0 || 0, z, ry == null ? B.rnd() * TAU : ry, s);
    B.cyl(x, z, 0.85 * s, (y0 || 0) - 2, 40);
  }
  /* ---------- terrasse / marche (boîte praticable) ---------- */
  function step(B, x, z, w, d, h, ry, nose) {
    B.box('n_marbre_f', x, (h - 0.12) / 2, z, w, h - 0.12, d, ry, false);
    B.add('n_marbre', BOX, x, h - 0.06, z, ry, 0, 0, 0, w + 0.1, 0.12, d + 0.1);
    if (nose) { const ox = Math.sin(ry), oz = Math.cos(ry); B.add('n_rune', BOX, x - ox * (d / 2 + 0.06), h - 0.16, z - oz * (d / 2 + 0.06), ry, 0, 0, w * 0.86, 0.06, 0.04); }
    B.solid(x, z, w / 2, d / 2, ry, -1, h);
  }
  // une marche « radiale » : centre à la distance r du centre de la salle, dans la direction a
  function rstep(B, a, r0, r1, w, h, nose) { const r = (r0 + r1) / 2; step(B, Math.sin(a) * r, Math.cos(a) * r, w, r1 - r0, h, a, nose); }

  /* =====================================================================
     LE CIEL COSMIQUE : skybox qui suit la caméra (dessinée derrière tout), nébuleuse précalculée sur le GPU
     ===================================================================== */
  const NOISE = `
    float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    vec3 h33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
    float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h13(i), h13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h13(i + vec3(0.0, 1.0, 0.0)), h13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                 mix(mix(h13(i + vec3(0.0, 0.0, 1.0)), h13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h13(i + vec3(0.0, 1.0, 1.0)), h13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * vn(p); p = p * 2.03 + vec3(3.1, 1.7, 5.3); a *= 0.5; } return s; }`;
  const BAKE_FS = `uniform vec3 n1, n2, n3, bandN; uniform float seed; varying vec2 vUv;
    ${NOISE}
    void main(){
      float lon = (vUv.x - 0.5) * 6.2831853, lat = (vUv.y - 0.5) * 3.14159265;
      vec3 d = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
      vec3 q = d * 1.7 + seed;
      float w = fbm(q * 1.1);
      float n = fbm(q * 2.0 + w * 1.9);
      float m = fbm(q * 3.3 - w * 1.3 + 5.0);
      float b = dot(d, bandN), band = exp(-b * b * 5.0);
      float neb = smoothstep(0.36, 0.82, n) * (0.3 + 0.95 * band);
      vec3 col = mix(n1, n2, smoothstep(0.32, 0.72, m)) * neb + n3 * pow(smoothstep(0.48, 0.92, m), 2.0) * (0.3 + band) * 0.9;
      float dust = smoothstep(0.5, 0.72, fbm(q * 5.5 + 11.0)) * band;
      col *= 1.0 - 0.75 * dust;
      col += mix(n1, n2, 0.5) * band * 0.12;
      gl_FragColor = vec4(col * 0.5, fbm(q * 6.0 + 3.0));
    }`;
  const SKY_VS = 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * viewMatrix * vec4(position * 600.0 + cameraPosition, 1.0); gl_Position = p; gl_Position.z = p.w * 0.99998; }';
  const SKY_FS = `uniform sampler2D tNeb; uniform float uT, uNeb, uMode, pR;
    uniform vec3 cTop, cMid, cHor, cNad, cVort, cAur, sunD, pD, pAx, pC1, pC2, pRing;
    varying vec3 vD;
    float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    vec3 h33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
    void main(){
      vec3 d = normalize(vD); float y = d.y;
      vec3 c = y > 0.0 ? mix(cHor, mix(cMid, cTop, smoothstep(0.3, 0.95, y)), smoothstep(0.0, 0.32, y)) : mix(cHor, cNad, smoothstep(0.0, -0.3, y));
      float az = atan(d.x, d.z);
      vec4 nb = texture2D(tNeb, vec2(az * 0.15915494 + 0.5 + uT * 0.0005, asin(clamp(y, -1.0, 1.0)) * 0.31830989 + 0.5));
      c += nb.rgb * uNeb;
      // tourbillon de lumière tout en bas, dans le vide
      float nd = max(0.0, -y);
      float arms = 0.5 + 0.5 * sin(az * 3.0 - log(max(1e-3, 1.0 - nd)) * 9.0 - uT * 0.12);
      c += cVort * pow(nd, 3.0) * (0.3 + 0.7 * arms) * (0.6 + 0.4 * nb.a);
      // étoiles qui scintillent
      vec3 sp = d * 170.0, id = floor(sp); float hs = h13(id);
      if (hs > 0.972) { vec3 o = h33(id) * 0.7 + 0.15; float r = length(fract(sp) - o); float tw = 0.65 + 0.35 * sin(uT * (1.0 + hs * 3.0) + hs * 80.0);
        float s = smoothstep(0.1, 0.0, r) * tw * (hs > 0.996 ? 2.6 : 1.0) * smoothstep(-0.25, 0.05, y);
        c += mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.82, 0.6), h13(id + 7.0)) * s * 1.5; }
      // aurores (à l'est et à l'ouest)
      float sect = smoothstep(0.5, 0.95, abs(sin(az)));
      float b0 = 0.05 + 0.05 * sin(az * 3.0 + uT * 0.04), b1 = b0 + 0.2 + 0.08 * sin(az * 7.0 - uT * 0.06);
      float cur = smoothstep(b0, b0 + 0.03, y) * (1.0 - smoothstep(b0 + 0.02, b1, y));
      float rays = 0.5 + 0.5 * sin(az * 90.0 + 4.0 * sin(az * 11.0 + uT * 0.35));
      c += cAur * cur * (0.3 + 0.7 * rays) * sect * (0.42 + 0.12 * sin(uT * 0.3 + az * 3.0));
      // planète géante (anneaux) ou trou noir (disque d'accrétion)
      vec3 pd = normalize(pD), ax = normalize(pAx); float b = dot(d, pd), disc = pR * pR - (1.0 - b * b);
      float dn = dot(d, ax), rt = abs(dn) > 1e-4 ? dot(pd, ax) / dn : -1.0; vec3 rq = d * rt - pd; float rr = length(rq) / pR;
      float tP = disc > 0.0 ? b - sqrt(disc) : 1e9;
      float ang = acos(clamp(b, -1.0, 1.0)), pa = asin(pR);
      if (uMode < 0.5) {
        c += pC1 * 0.45 * exp(-max(0.0, ang - pa) / (pa * 0.1)) * step(pa, ang);
        if (disc > 0.0) {
          vec3 n = normalize(d * tP - pd); float lat = dot(n, ax);
          float bands = 0.5 + 0.5 * sin(lat * 15.0 + sin(lat * 5.0 + 1.3) * 2.2);
          float l = max(0.0, dot(n, sunD)); float rim = pow(1.0 - max(0.0, dot(n, -d)), 2.5);
          c = mix(pC2, pC1, bands) * (0.07 + 1.0 * l) + pC1 * rim * 0.4 * (0.3 + l);
        }
        if (rt > 0.0 && rr > 1.3 && rr < 2.35 && rt < tP) {
          float rb = 0.55 + 0.45 * sin(rr * 40.0) * sin(rr * 13.0 + 1.0);
          float a = smoothstep(1.3, 1.38, rr) * smoothstep(2.35, 2.2, rr) * (0.35 + 0.6 * rb) * (rr > 1.78 && rr < 1.86 ? 0.15 : 1.0);
          c = mix(c, pRing * (0.45 + 0.6 * rb), a);
        }
      } else {
        c += pC1 * exp(-max(0.0, ang - pa) / (pa * 0.35)) * 0.55;
        if (disc > 0.0) c = vec3(0.0);
        c += pC1 * smoothstep(pa * 1.14, pa * 1.02, ang) * smoothstep(pa * 0.97, pa * 1.03, ang) * 2.4;
        if (rt > 0.0 && rr > 1.4 && rr < 4.6 && rt < tP) {
          vec3 side = normalize(cross(ax, pd)); vec3 fw = cross(side, ax);
          float dop = 1.0 + 0.7 * dot(normalize(rq), side);
          float sw = 0.62 + 0.38 * sin(rr * 9.0 - uT * 0.8 + atan(dot(rq, side), dot(rq, fw)) * 2.0);
          float a = smoothstep(1.4, 1.65, rr) * smoothstep(4.6, 3.2, rr);
          c = mix(c, mix(pC2, pC1, smoothstep(3.8, 1.6, rr)) * dop * sw * 1.5, a * 0.94);
        }
      }
      gl_FragColor = vec4(c, 1.0);
    }`;
  function bakeNebula(P) {
    const key = 'nneb' + P.id; if (A.texCache[key]) return A.texCache[key];
    const R0 = BR.Arena && BR.Arena.renderer && BR.Arena.renderer();
    if (!R0) return null;
    const W = 2048, H = 1024, rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    rt.texture.wrapS = THREE.RepeatWrapping;
    const tier = P.id.slice(-1) | 0;
    const mat = new THREE.ShaderMaterial({ uniforms: { n1: { value: L(P.neb[0]) }, n2: { value: L(P.neb[1]) }, n3: { value: L(P.neb[2]) }, bandN: { value: new THREE.Vector3(0.35, 0.82, -0.45).normalize() }, seed: { value: 3.7 + tier * 11.3 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: BAKE_FS, depthTest: false, depthWrite: false });
    const sc = new THREE.Scene(), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); q.frustumCulled = false; sc.add(q);
    const prev = R0.getRenderTarget();
    R0.setRenderTarget(rt); R0.render(sc, new THREE.Camera()); R0.setRenderTarget(prev);
    q.geometry.dispose(); mat.dispose();
    return (A.texCache[key] = rt.texture);
  }
  function cosmos(B) {
    const P = B.P, pl = P.pl, tex = bakeNebula(P);
    const U = {
      tNeb: { value: tex || new THREE.Texture() }, uT: { value: 0 }, uNeb: { value: tex ? P.nebK * 2 : 0 }, uMode: { value: pl.k },
      cTop: { value: L(P.sky[0]) }, cMid: { value: L(P.sky[1]) }, cHor: { value: L(P.sky[2]) }, cNad: { value: L(P.nadir) }, cVort: { value: L(P.vortex) }, cAur: { value: L(P.aur) },
      sunD: { value: new THREE.Vector3().fromArray(pl.dir).normalize().multiplyScalar(-0.8).add(new THREE.Vector3(-0.55, 0.5, 0)).normalize() }, pD: { value: new THREE.Vector3().fromArray(pl.dir).normalize() }, pAx: { value: new THREE.Vector3().fromArray(pl.ax).normalize() },
      pR: { value: pl.r }, pC1: { value: L(pl.c1) }, pC2: { value: L(pl.c2) }, pRing: { value: L(pl.ring) },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false });
    const geo = new THREE.SphereGeometry(1, 48, 24), sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false; sky.renderOrder = -20; B.g.add(sky); B.disposables.push(geo, mat);
    // un seul ciel à la fois : celui de la salle courante (la salle suivante, préconstruite, est décalée)
    B.anims.push((dt, t) => {
      U.uT.value = t;
      const cur = B.g.position.lengthSq() < 1; sky.visible = cur;
      if (cur) { const Wd = B.g.parent && B.g.parent.userData.dgWorld; if (Wd && Wd.moon) Wd.moon.visible = false; }
    });
  }

  /* =====================================================================
     LE LOINTAIN : îles flottantes, temple et arche colossaux, lignes de lumière, débris
     (secteurs nord / sud libres jusqu'à 140 m : la salle suivante et la précédente y sont construites)
     ===================================================================== */
  const okSector = a => Math.abs(Math.sin(a)) > Math.sin(0.78);   // loin du nord (a = 0) et du sud (a = π)
  function skyline(B, R, seed, A2, L0) {
    cosmos(B);
    const P = B.P, rnd = B.rnd, isles = [];
    // îles moyennes (60-140 m) à l'est et à l'ouest
    for (let i = 0; i < 16; i++) {
      let a = rnd() * TAU; for (let k = 0; k < 6 && !okSector(a); k++) a = rnd() * TAU;
      if (!okSector(a)) continue;
      const d = Math.max(R + 50, 85) + rnd() * 75, y = -40 + rnd() * 62, s = 1.4 + rnd() * 2.6, x = Math.sin(a) * d, z = Math.cos(a) * d;
      put(B, 'ilot', x, y, z, rnd() * TAU, s);
      isles.push([x, y, z, s]);
    }
    // très loin (au-delà de 150 m), partout, en hauteur ou très bas
    for (let i = 0; i < 10; i++) { const a = rnd() * TAU, d = 160 + rnd() * 70, y = (rnd() < 0.5 ? 40 + rnd() * 40 : -90 + rnd() * 30), s = 4 + rnd() * 6; put(B, 'ilot', Math.sin(a) * d, y, Math.cos(a) * d, rnd() * TAU, s); }
    // le temple colossal (ouest) et l'arche géante (est)
    const tx = -(R + 95), tz = 18 + rnd() * 20;
    put(B, 'racine', tx, -6, tz, rnd() * TAU, [26, 34, 26]);
    const top = new THREE.CylinderGeometry(26, 26, 1.6, 24); B.add('n_marbre_f', top, tx, -5.4, tz); top.dispose();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, br = i % 4 === 1; put(B, br ? 'colonne_brisee' : 'colonne', tx + Math.sin(a) * 15, -4.6, tz + Math.cos(a) * 15, a, 2.4); }
    const archi = new THREE.TorusGeometry(15, 1.4, 6, 24, PI * 1.35); archi.rotateX(PI / 2); B.add('n_marbre', archi, tx, 12.4, tz, 0.6); archi.dispose();
    put(B, 'gardien', tx, -4.6, tz, PI / 2, 5.2);
    put(B, 'arche_brisee', R + 85, -10, -24 - rnd() * 20, PI / 2 + 0.3, 3.4);
    put(B, 'racine', R + 85, -10.4, -30, rnd() * TAU, [22, 26, 22]);
    put(B, 'obelisque', R + 70, 18, 34, rnd() * TAU, 2.6, 0.2, 0.1);
    put(B, 'obelisque', -(R + 60), 26, -40, rnd() * TAU, 2.2, -0.15, 0.25);
    // gros rochers à la dérive
    for (let i = 0; i < 26; i++) {
      let a = rnd() * TAU; if (!okSector(a)) a += PI / 2;
      const d = R + 26 + rnd() * 90, y = -50 + rnd() * 80, s = 1.5 + rnd() * 5;
      B.add(rnd() < 0.5 ? 'n_roche' : 'n_roche_c', ROCK, Math.sin(a) * d, y, Math.cos(a) * d, rnd() * 6, rnd() * 6, rnd() * 6, s * 1.6, s, s * 1.3);
    }
  }

  /* =====================================================================
     ORBITE : ceinture de ruines qui tourne lentement autour de la salle
     ===================================================================== */
  function orbit(B, r0, r1, yRanges, n, scale, speed) {
    const G = AG(B), rnd = B.rnd;
    const kinds = ['colonne_brisee', 'colonne', 'escalier', 'arche_brisee', 'cristaux', 'rock', 'colonne_brisee', 'rock', 'escalier', 'colonne'];
    for (let i = 0; i < n; i++) {
      const a = (i + rnd() * 0.6) / n * TAU, d = r0 + rnd() * (r1 - r0), yr = yRanges[i % yRanges.length], y = yr[0] + rnd() * (yr[1] - yr[0]);
      const k = kinds[Math.floor(rnd() * kinds.length)], x = Math.sin(a) * d, z = Math.cos(a) * d, ph = rnd() * TAU, amp = 0.4 + rnd() * 0.8;
      const rx = (rnd() - 0.5) * 1.2, rz = (rnd() - 0.5) * 1.2, s = scale * (0.7 + rnd() * 0.6);
      if (k === 'rock') { G.add('n_roche', ROCK, mtx(x, y, z, rnd() * 6, [s * 3.2, s * 2.2, s * 2.6], rnd() * 6, rnd() * 6), ph, amp); G.add('n_roche_c', ROCK, mtx(x + s, y - s * 0.6, z, rnd() * 6, s * 1.4), ph, amp); }
      else if (k === 'ilot') G.put('ilot', mtx(x, y, z, rnd() * TAU, s * 0.7, rx * 0.2, rz * 0.2), ph, amp);
      else if (k === 'arche_brisee') G.put(k, mtx(x, y, z, a + PI / 2 + rx, s * 0.55, rx * 0.4, rz * 0.6), ph, amp);
      else if (k === 'colonne' || k === 'colonne_brisee') G.put(k, mtx(x, y, z, rnd() * TAU, s * 0.9, PI / 2 * (rnd() < 0.5 ? 1 : 0.35) + rx * 0.3, rz), ph, amp);
      else G.put(k, mtx(x, y, z, rnd() * TAU, s * (k === 'cristaux' ? 1.2 : 0.8), rx, rz), ph, amp);
    }
    const grp = G.build(false), a0 = rnd() * TAU;
    B.anims.push((dt, t) => { grp.rotation.y = a0 + t * speed; });
    return grp;
  }
  /** anneau runique qui tourne (halo au-dessus de la salle, anneaux autour des piliers) */
  function spinRing(B, x, y, z, s, speed, tilt, shadow) {
    const G = AG(B, x, y, z); G.put('anneau', mtx(0, 0, 0, 0, s > 6 ? [s, s * 0.4, s] : s), 0, 0);
    const grp = G.build(shadow !== false && s < 6); grp.rotation.x = tilt || 0;
    B.anims.push((dt, t) => { grp.rotation.y = t * speed; });
    return grp;
  }

  /* =====================================================================
     GRANDE SALLE DE COMBAT
     ===================================================================== */
  function hall(B, room, rng, o) {
    o = o || {};
    const P = B.P, R = A.ROOM_R + 0.9, rnd = B.rnd;
    animate(B);
    island(B, R + 0.5, R + 2.4, 'hall');
    const ent = A.door(B, 0, -(R + 0.2), PI, { open: true }), exit = A.door(B, 0, R + 0.2, 0);
    gate(B, ent, false); gate(B, exit, false);
    // garde-corps runique + colonnade sur le pourtour
    railRing(B, R + 0.6, 3.45);
    const cols = [];
    for (let i = 0; i < 18; i++) {
      const a = (i + 0.5) / 18 * TAU; if (Math.abs(A.norm2(a)) < 0.3 || Math.abs(A.norm2(a - PI)) < 0.3) continue;
      const br = (i % 3 === 1) || rnd() < 0.2; cols.push({ a, br });
      column(B, Math.sin(a) * (R + 1.45), Math.cos(a) * (R + 1.45), br, a);
      if (i % 2 === 0) B.spot(Math.sin(a) * (R - 0.6), 3.2, Math.cos(a) * (R - 0.6), i % 4 === 0 ? P.cristal : P.rune, 1.4, { dist: 16 });
    }
    // linteaux entre colonnes intactes voisines (certains décrochés, qui flottent)
    for (let i = 0; i + 1 < cols.length; i++) {
      const c0 = cols[i], c1 = cols[i + 1]; if (c0.br || c1.br || c1.a - c0.a > 0.4) continue;
      const am = (c0.a + c1.a) / 2, rr = R + 1.45, ch = 2 * rr * Math.sin((c1.a - c0.a) / 2) + 1.4, fl = rnd() < 0.35;
      B.add('n_marbre', BOX, Math.sin(am) * rr, fl ? 8.6 + rnd() : 7.35, Math.cos(am) * rr, am, fl ? (rnd() - 0.5) * 0.3 : 0, fl ? (rnd() - 0.5) * 0.4 : 0, ch, 0.7, 1.3);
      B.add('n_or', BOX, Math.sin(am) * (rr - 0.66), fl ? 8.3 : 7.1, Math.cos(am) * (rr - 0.66), am, 0, 0, ch - 0.4, 0.12, 0.04);
    }
    // terrasses à gradins (diagonales) : 0,6 → 1,2 → 1,8 m, avec vasque, colonnes brisées et cristaux
    for (const a of [PI / 4, -PI / 4, 3 * PI / 4, -3 * PI / 4]) {
      rstep(B, a, 26.3, 27.5, 10, 0.6, true);
      rstep(B, a, 27.5, 28.7, 11, 1.2, true);
      rstep(B, a, 28.7, 34.4, 12.5, 1.8, true);
      const ux = Math.sin(a), uz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a), at = (r, t) => [ux * r + tx * t, uz * r + tz * t];
      const [bx, bz] = at(31.2, 0); put(B, 'brasero', bx, 1.8, bz, a, 1.15); B.cyl(bx, bz, 0.75, -1, 4.4);
      B.spot(bx, 4.6, bz, P.cristal, 1.9, { dist: 18 });
      for (const s of [-1, 1]) { const [cx, cz] = at(33.2, s * 4.6); column(B, cx, cz, true, a + s, 0.8, 1.8); }
      const [kx, kz] = at(29.9, (rnd() < 0.5 ? -1 : 1) * 4.2); put(B, 'cristaux', kx, 1.8, kz, rnd() * TAU, 0.9);
      B.obstacles.push({ x: ux * 30.5, z: uz * 30.5, r: 5.6, h: 1.8 });
    }
    // dais des gardiens (est, ouest)
    for (const a of [PI / 2, -PI / 2]) {
      rstep(B, a, 26.4, 28.2, 9, 0.6, true);
      rstep(B, a, 28.2, 34.4, 10, 1.2, true);
      const ux = Math.sin(a), uz = Math.cos(a);
      put(B, 'gardien', ux * 31.6, 1.2, uz * 31.6, a + PI, 1.45); B.cyl(ux * 31.6, uz * 31.6, 1.4, -1, 40);
      for (const s of [-1, 1]) { const x = ux * 30.2 + uz * s * 3.4, z = uz * 30.2 - ux * s * 3.4; put(B, 'brasero', x, 1.2, z, 0, 0.9); B.cyl(x, z, 0.6, -1, 3.4); B.spot(x, 3.4, z, P.rune, 1.6, { dist: 15 }); }
      B.obstacles.push({ x: ux * 30.8, z: uz * 30.8, r: 4.8, h: 1.2 });
    }
    // piliers du milieu (pas en salle de boss), chacun ceint d'un anneau runique qui tourne
    if (o.pillars !== false) {
      for (let k = 0; k < 4; k++) {
        const a = PI / 4 + k * PI / 2, x = Math.sin(a) * 16.5, z = Math.cos(a) * 16.5;
        put(B, 'colonne', x, 0, z, a, 1.25); B.cyl(x, z, 1.1, -2, 9); B.obstacles.push({ x, z, r: 1.2, h: 9 });
        spinRing(B, x, 4.2 + (k % 2) * 0.6, z, 2.1, (k % 2 ? 0.35 : -0.35), 0.18 * (k % 2 ? 1 : -1));
        B.spot(x - Math.sin(a) * 1.8, 4.4, z - Math.cos(a) * 1.8, k % 2 ? P.cristal : P.rune, 1.4, { dist: 14 });
      }
    }
    // la voûte : halo runique géant + cœur de cristal suspendu
    spinRing(B, 0, 25, 0, 15, 0.025, 0.1);
    spinRing(B, 0, 25.6, 0, 9.5, -0.04, -0.08);
    const H = AG(B, 0, 28, 0); const oc = new THREE.OctahedronGeometry(1, 0);
    H.add('n_cristal', oc, mtx(0, 0, 0, 0, [2.2, 4.6, 2.2]), 0, 0.8); oc.dispose();
    const hg = H.build(false); B.anims.push((dt, t) => { hg.rotation.y = t * 0.3; });
    // obélisques flottants à l'est et à l'ouest, escaliers qui ne mènent nulle part
    const F = AG(B);
    for (const a of [PI / 2 - 0.42, PI / 2 + 0.42, -PI / 2 - 0.42, -PI / 2 + 0.42]) F.put('obelisque', mtx(Math.sin(a) * (R + 8), 1 + rnd() * 3, Math.cos(a) * (R + 8), rnd() * TAU, 1.1), rnd() * 6, 0.7);
    for (const a of [PI / 4, -PI / 4, 3 * PI / 4, -3 * PI / 4]) F.put('escalier', mtx(Math.sin(a) * (R + 6.5), 2.2 + rnd() * 2, Math.cos(a) * (R + 6.5), a + PI / 2 + (rnd() - 0.5), 1.2, 0.1, 0), rnd() * 6, 0.5);
    for (const a of [PI / 2, -PI / 2]) F.put('arche_brisee', mtx(Math.sin(a) * (R + 14), -3, Math.cos(a) * (R + 14), a + PI / 2, 1.3, 0.12, 0.05), rnd() * 6, 0.6);
    F.build(true);
    // ceinture de ruines en orbite (haut : au-dessus des ponts ; bas : sous l'île)
    orbit(B, R + 7, R + 13, [[10, 20], [14, 26], [-26, -14]], B._q === 'low' ? 10 : 18, 1.1, 0.012);
    if (B._lant) B._lant.build(false);
    return { R, entrance: ent, exits: [exit], spawn: { x: 0, z: -(R - 7.5), yaw: 0 }, rewardAt: new A.V3(0, 0, 0) };
  }

  /* =====================================================================
     SALLE CALME : le sanctuaire (tholos à ciel ouvert, coupole brisée qui flotte, rai de lumière)
     ===================================================================== */
  const SHAFT_VS = 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
  const SHAFT_FS = 'uniform vec3 col; uniform float uT; varying vec2 vUv; varying vec3 vN, vV; void main(){ float e = pow(abs(dot(vN, vV)), 1.6); float f = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.7, vUv.y); float s = 0.75 + 0.25 * sin(vUv.x * 6.2831853 * 6.0 + uT * 0.4); gl_FragColor = vec4(col * e * f * s * 0.13, 1.0); }';
  function chapel(B, room, rng) {
    const P = B.P, R = 17, rnd = B.rnd;
    animate(B);
    island(B, R + 0.5, R + 2.3, 'chapel');
    const ent = A.door(B, 0, -(R + 0.2), PI, { open: true }), exit = A.door(B, 0, R + 0.2, 0, { w: 4.2 });
    gate(B, ent, false); gate(B, exit, false);
    railRing(B, R + 0.6, 3.45);
    // tholos : 10 colonnes intactes, architrave circulaire (brisée par endroits)
    const angs = []; for (let i = 1; i < 12; i++) if (i !== 6) angs.push(i / 12 * TAU);
    angs.forEach((a, i) => { column(B, Math.sin(a) * (R + 1.45), Math.cos(a) * (R + 1.45), false, a); if (i % 2 === 0) B.spot(Math.sin(a) * (R - 0.6), 3.4, Math.cos(a) * (R - 0.6), P.rune, 1.3, { dist: 14 }); });
    for (let i = 0; i + 1 < angs.length; i++) {
      if (angs[i + 1] - angs[i] > 0.6 || i === 2 || i === 6) continue;
      const am = (angs[i] + angs[i + 1]) / 2, rr = R + 1.45, ch = 2 * rr * Math.sin((angs[i + 1] - angs[i]) / 2) + 1.5, fl = i === 4;
      B.add('n_marbre', BOX, Math.sin(am) * rr, fl ? 9.2 : 7.35, Math.cos(am) * rr, am, fl ? 0.2 : 0, fl ? -0.25 : 0, ch, 0.7, 1.4);
      B.add('n_marbre_f', BOX, Math.sin(am) * rr, fl ? 9.8 : 7.95, Math.cos(am) * rr, am, fl ? 0.2 : 0, fl ? -0.25 : 0, ch + 0.2, 0.5, 1.6);
      B.add('n_or', BOX, Math.sin(am) * (rr - 0.72), fl ? 9.0 : 7.15, Math.cos(am) * (rr - 0.72), am, 0, 0, ch - 0.3, 0.14, 0.04);
    }
    // dais des gardiens (est, ouest) — le centre (rayon 8) reste libre
    for (const a of [PI / 2, -PI / 2]) {
      rstep(B, a, 11.6, 13.2, 7.5, 0.5, true);
      rstep(B, a, 13.2, 16.9, 8.5, 1.0, true);
      const ux = Math.sin(a), uz = Math.cos(a);
      put(B, 'gardien', ux * 15.1, 1.0, uz * 15.1, a + PI, 1.3); B.cyl(ux * 15.1, uz * 15.1, 1.3, -1, 40);
      for (const s of [-1, 1]) { const x = ux * 14.2 + uz * s * 2.9, z = uz * 14.2 - ux * s * 2.9; put(B, 'brasero', x, 1.0, z, 0, 0.85); B.cyl(x, z, 0.55, -1, 3.2); B.spot(x, 3.1, z, P.rune, 1.6, { dist: 14 }); }
      B.obstacles.push({ x: ux * 14.3, z: uz * 14.3, r: 4, h: 1 });
    }
    for (const a of [PI / 4, -PI / 4, 3 * PI / 4, -3 * PI / 4]) { const x = Math.sin(a) * 15.4, z = Math.cos(a) * 15.4; put(B, 'cristaux', x, 0, z, rnd() * TAU, 1.0); B.cyl(x, z, 0.9, -1, 3); B.spot(x, 2.2, z, P.cristal, 1.4, { dist: 13 }); }
    // sphère armillaire céleste au-dessus du sanctuaire : anneaux runiques imbriqués, cœur de cristal
    const arm = [[6.2, 0.21, 0.13, 0], [5.2, -0.17, 0.27, 1.1], [4.3, 0.31, -0.19, 2.2]];
    arm.forEach(([s, a, b, ph]) => {
      const G = AG(B, 0, 15.5, 0); G.put('anneau', mtx(0, 0, 0, 0, s), 0, 0); const grp = G.build(false);
      B.anims.push((dt, t) => { grp.rotation.set(PI / 2 + Math.sin(t * a + ph) * 1.2, t * b, Math.cos(t * a * 0.7 + ph) * 0.6); });
    });
    const core = AG(B, 0, 15.5, 0), oc = new THREE.OctahedronGeometry(1, 0);
    core.add('n_cristal', oc, mtx(0, 0, 0, 0, [1.3, 2.6, 1.3]), 0, 0.4); oc.dispose();
    const tor = new THREE.TorusGeometry(2.2, 0.08, 4, 32); core.add('n_or', tor, mtx(0, 0, 0, 0, 1, PI / 2), 0, 0.4); tor.dispose();
    const cg = core.build(false); B.anims.push((dt, t) => { cg.rotation.y = -t * 0.4; });
    B.spot(0, 12, 0, P.rune, 1.6, { dist: 22 });
    const shU = { col: { value: L(P.rune) }, uT: { value: 0 } };
    const shM = new THREE.ShaderMaterial({ uniforms: shU, vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const shG = new THREE.CylinderGeometry(1.6, 6.2, 14, 32, 1, true), sh = new THREE.Mesh(shG, shM); sh.position.y = 7; sh.renderOrder = 3; B.g.add(sh);
    B.disposables.push(shM, shG); B.anims.push((dt, t) => { shU.uT.value = t; });
    // obélisques et ruines qui flottent tout autour
    const F = AG(B);
    for (const a of [PI / 2 - 0.5, PI / 2 + 0.5, -PI / 2 - 0.5, -PI / 2 + 0.5]) F.put('obelisque', mtx(Math.sin(a) * (R + 7), 0.5 + rnd() * 3, Math.cos(a) * (R + 7), rnd() * TAU, 0.95), rnd() * 6, 0.6);
    for (const a of [PI / 2, -PI / 2]) F.put('escalier', mtx(Math.sin(a) * (R + 10), 3 + rnd() * 2, Math.cos(a) * (R + 10), a + 0.4, 1.3, 0.1, 0.05), rnd() * 6, 0.5);
    F.build(true);
    orbit(B, R + 6, R + 11, [[10, 20], [-22, -12]], B._q === 'low' ? 8 : 14, 1.0, 0.016);
    if (B._lant) B._lant.build(false);
    return { R, entrance: ent, exits: [exit], spawn: { x: 0, z: -13, yaw: 0 }, rewardAt: new A.V3(0, 0, 0) };
  }

  /* =====================================================================
     SALLES D'ÉNIGME : île rectangulaire, garde-corps runique, colonnade, arches aux portes
     full === false : gouffre (aucun sol entre y = -15 et 0 sous la salle)
     ===================================================================== */
  function rectShell(B, W, Lz, H, full) {
    const P = B.P, hx = W / 2, hz = Lz / 2, fg = 3.6, rnd = B.rnd;
    animate(B); B._nFull = full; B._nRect = { hx, hz };
    // bords
    railLine(B, -hx, -hz, -hx, hz); railLine(B, hx, -hz, hx, hz);
    railLine(B, -hx, -hz, -fg, -hz); railLine(B, fg, -hz, hx, -hz);
    railLine(B, -hx, hz, -fg, hz); railLine(B, fg, hz, hx, hz);
    // colonnade le long des grands côtés + coins
    const nz = Math.max(3, Math.round(Lz / 8.5));
    for (const sx of [-1, 1]) for (let i = 0; i <= nz; i++) {
      const z = -hz + i * Lz / nz, x = sx * (hx + 1.0), br = (i + (sx > 0 ? 1 : 0)) % 3 === 1;
      column(B, x, z, br, PI / 2 * sx);
      if (!full) { put(B, 'racine', x, -0.02, z, rnd() * TAU, [1.3, 3.5, 1.3]); }
      if (i % 2 === 0 && i < nz) B.spot(sx * (hx - 0.5), 3.4, z + Lz / nz / 2, i % 4 === 0 ? P.cristal : P.rune, 1.5, { dist: 16 });
    }
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const x = sx * (hx * 0.55 + 2), z = sz * (hz + 1.0); column(B, x, z, false, 0); if (!full) put(B, 'racine', x, -0.02, z, rnd() * TAU, [1.3, 3.5, 1.3]); }
    if (full) {
      // l'île : tranche de marbre, socle de roche en tronc de pyramide, racine qui pend
      const ex = hx + 1.9, ez = hz + 1.9;
      B.add('n_marbre_f', BOX, 0, -0.62, 0, 0, 0, 0, ex * 2, 1.2, ez * 2);
      B.add('n_or', BOX, 0, -0.14, 0, 0, 0, 0, ex * 2 + 0.1, 0.16, ez * 2 + 0.1);
      const fr = new THREE.CylinderGeometry(1, 0.78, 1, 4, 1); fr.rotateY(PI / 4);
      B.add('n_roche_c', fr, 0, -3.3, 0, 0, 0, 0, ex * 1.414, 4.2, ez * 1.414); fr.dispose();
      put(B, 'racine', 0, -5.2, 0, rnd() * TAU, [ex * 1.0, Math.max(ex, ez) * 0.95, ez * 1.0]);
      for (let i = 0; i < 10; i++) { const sx = rnd() < 0.5 ? -1 : 1, z = (rnd() - 0.5) * Lz; B.add('n_roche', ROCK, sx * ex * 0.92, -2.5 - rnd() * 2, z, rnd() * 6, rnd(), rnd(), 2.6, 2.2, 3.2); }
    } else {
      // gouffre : seulement une poutre sous le garde-corps (au bord, pas sous la salle) ; débris très loin en bas
      for (const sx of [-1, 1]) B.add('n_marbre_f', BOX, sx * hx, -0.45, 0, 0, 0, 0, 0.8, 0.9, Lz + 0.8);
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) B.add('n_marbre_f', BOX, sx * (hx + fg) / 2, -0.45, sz * hz, 0, 0, 0, hx - fg, 0.9, 0.8);
      for (let i = 0; i < 8; i++) B.add('n_roche', ROCK, (rnd() - 0.5) * W * 2, -32 - rnd() * 30, (rnd() - 0.5) * Lz, rnd() * 6, rnd(), rnd(), 3 + rnd() * 3, 2 + rnd() * 2, 3 + rnd() * 3);
    }
  }
  function roomDecor(B, W, Lz, H) {
    const P = B.P, hx = W / 2, hz = Lz / 2, rnd = B.rnd, full = B._nFull !== false;
    B.doors.forEach(D => gate(B, D, false));
    // près des bords seulement (moins de 1,5 m) : vasques et cristaux, si la salle a un sol
    if (full) {
      const n = Math.max(2, Math.floor(Lz / 12));
      for (const sx of [-1, 1]) for (let i = 0; i < n; i++) {
        const z = -hz + (i + 0.5) * Lz / n + (sx > 0 ? 2.5 : -2.5); if (Math.abs(z) > hz - 4) continue;
        if (i % 2 === 0) { put(B, 'brasero', sx * (hx - 1.1), 0, z, 0, 0.8); B.cyl(sx * (hx - 1.1), z, 0.55, -1, 3); B.obstacles.push({ x: sx * (hx - 1.1), z, r: 0.6, h: 3 }); }
        else { put(B, 'cristaux', sx * (hx - 1.0), 0, z, rnd() * TAU, 0.7); B.cyl(sx * (hx - 1.0), z, 0.7, -1, 2.5); }
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(B, 'cristaux', sx * (hx - 1.1), 0, sz * (hz - 1.2), rnd() * TAU, 0.55);
    }
    // en hauteur : grand anneau runique, ruines qui flottent au-dessus des garde-corps, lanternes
    spinRing(B, 0, H + 6, 0, Math.min(hx, hz) * 0.75, 0.04, 0.08);
    const F = AG(B), nf = Math.max(3, Math.floor(Lz / 10));
    for (const sx of [-1, 1]) for (let i = 0; i < nf; i++) {
      const z = -hz + (i + 0.5) * Lz / nf, k = (i + (sx > 0 ? 1 : 0)) % 3;
      if (k === 0) F.put('colonne_brisee', mtx(sx * (hx + 4.5), 7 + rnd() * 4, z, rnd() * TAU, 0.8, PI / 2 * 0.8, rnd()), rnd() * 6, 0.6);
      else if (k === 1) F.put('cristaux', mtx(sx * (hx + 0.2), 5 + rnd() * 1.5, z, rnd() * TAU, 0.5, PI, 0), rnd() * 6, 0.35);
      else F.put('escalier', mtx(sx * (hx + 5), 4 + rnd() * 3, z, PI / 2 * sx + (rnd() - 0.5), 1, 0.1, 0), rnd() * 6, 0.5);
    }
    for (const sz of [-1, 1]) F.put('obelisque', mtx((rnd() < 0.5 ? -1 : 1) * (hx + 8), 2 + rnd() * 3, sz * (hz - 6), rnd() * TAU, 0.9), rnd() * 6, 0.6);
    F.build(true);
    if (B._lant) B._lant.build(false);
  }

  /* =====================================================================
     ENREGISTREMENT
     ===================================================================== */
  DG.THEMES = DG.THEMES || {};
  DG.THEMES.neant = {
    setup(B) { setup(B); },
    hall, chapel, rectShell, roomDecor, skyline,
    // le fond lumineux des gouffres (posé par l'énigme) prend la couleur du tourbillon du Néant
    finish(B) {
      B.g.children.forEach(o => { if (o.isMesh && o.material && o.material.blending === THREE.AdditiveBlending && o.position.y < -30 && o.material.color) { o.material.color.copy(L(B.P.cristal)).multiplyScalar(0.22); o.material.opacity = 0.45; } });
    },
    signWall: false,
  };
})();

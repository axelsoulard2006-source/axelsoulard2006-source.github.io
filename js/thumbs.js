/* ===== thumbs.js : miniatures des niveaux du jeu 1, rendues en 3D à partir de la vraie carte =====
   Chaque miniature est une vraie vue dans le niveau (graine fixe), choisie automatiquement : une longue perspective
   éclairée, avec parfois une entité au loin. Rendu dans un petit moteur à part, une carte à la fois (sans figer le menu),
   puis mise en cache dans le navigateur. Utilisation : élément HTML avec data-thumb="<id de carte>" puis BR.Thumbs.fill(racine). */
(function () {
  const BR = window.BR;
  const T = (BR.Thumbs = {});
  const VER = 'br_thumb_v3_', W = 480, H = 270;
  const mem = {};                 // id -> dataURL
  const queue = []; let busy = false, R = null, canvas = null;

  T.get = function (id) {
    if (mem[id]) return mem[id];
    const c = BR.store.get(VER + id + '_' + sig(id), null);
    if (c) { mem[id] = c; return c; }
    if (!queue.includes(id)) queue.push(id);
    pump();
    return null;
  };
  // signature : si la description de la carte change, la miniature est refaite
  function sig(id) { const d = BR.MAPS.find(m => m.id === id); if (!d) return '0'; let h = 0; const s = d.kind + d.theme + d.name + (d.size || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  /** remplit tous les [data-thumb] sous root (ou du document) dès que les miniatures sont prêtes */
  T.fill = function (root) {
    (root || document).querySelectorAll('[data-thumb]').forEach(e => {
      const u = T.get(e.dataset.thumb);
      if (u) { e.style.backgroundImage = `url(${u})`; e.classList.add('has-thumb'); }
    });
  };
  function ready(id, url) {
    mem[id] = url;
    try { BR.store.set(VER + id + '_' + sig(id), url); } catch (e) {}
    document.querySelectorAll(`[data-thumb="${id}"]`).forEach(e => { e.style.backgroundImage = `url(${url})`; e.classList.add('has-thumb'); });
  }
  function pump() {
    if (busy || !queue.length) return;
    if (!(BR.Assets && BR.Assets.ready) || !(BR.Ent && BR.Ent.count && BR.Ent.count() >= 0)) { setTimeout(pump, 400); return; }
    busy = true;
    // laisse le menu respirer entre deux rendus
    setTimeout(() => {
      const id = queue.shift();
      let url = null;
      try { url = render(id); } catch (e) { console.warn('miniature', id, e); }
      if (url) ready(id, url);
      busy = false; pump();
    }, 60);
  }

  function renderer() {
    if (R) return R;
    canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    R = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    R.setPixelRatio(1); R.setSize(W, H, false);
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping;
    return R;
  }

  // meilleur point de vue : longue perspective dégagée, lumières devant, pas collé à un mur
  function pickView(map, Wd, rng) {
    const reach = map.reach; if (!reach || !reach.length) return null;
    const out = map.outdoor;
    let best = null, bs = -1e9;
    for (let k = 0; k < 70; k++) {
      const n = reach[Math.floor(rng() * reach.length)], p = Wd.nodePos(map, n);
      const ey = p.y + (out ? 1.9 : 1.62);
      for (let a = 0; a < 8; a++) {
        const yaw = a * Math.PI / 4 + rng() * 0.3, dx = Math.sin(yaw), dz = Math.cos(yaw);
        let free = 0;
        for (let d = 1.5; d <= 42; d += 1.5) { if (!Wd.los(map, p.x, ey, p.z, p.x + dx * d, ey, p.z + dz * d)) break; free = d; }
        if (free < 6) continue;
        // pas de mur juste à côté (vue étouffée) : on teste un peu sur les côtés
        let side = 0; for (const s of [-1, 1]) { const sx = -dz * s, sz = dx * s; if (Wd.los(map, p.x, ey, p.z, p.x + sx * 2.5, ey, p.z + sz * 2.5)) side++; }
        let lit = 0; for (const l of map.lights) { if (l.dead) continue; const lx = l.kind === 'lamp' ? l.px : (l.cx + 0.5) * Wd.C, lz = l.kind === 'lamp' ? l.pz : (l.cy + 0.5) * Wd.C; const vx = lx - p.x, vz = lz - p.z, along = vx * dx + vz * dz, perp = Math.abs(vx * dz - vz * dx); if (along > 1 && along < 22 && perp < 5) lit++; }
        const sc = Math.min(free, 30) + side * 2.5 + Math.min(lit, 4) * 2.2 + (p.y > 0.5 ? 2 : 0) + rng() * 2;
        if (sc > bs) { bs = sc; best = { x: p.x, y: ey, z: p.z, yaw, free, node: n }; }
      }
    }
    return best;
  }

  function render(id) {
    const def = BR.MAPS.find(m => m.id === id); if (!def) return null;
    const Wd = BR.World, TH = BR.Tex.build(def.theme), r = renderer();
    const rng = BR.rngFrom(1337 + id.length * 97);
    const map = Wd.generate(def, 777, BR.DIFFS.normal);
    const built = Wd.build(map, TH);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(TH.sky || TH.fog);
    scene.fog = new THREE.FogExp2(TH.fog, TH.fogDensity * 0.85);
    scene.add(new THREE.AmbientLight(TH.ambient, TH.ambientI * 1.15), new THREE.HemisphereLight(TH.hemi[0], TH.hemi[1], TH.hemi[2] * 1.1));
    if (TH.moon) { const mo = new THREE.DirectionalLight(TH.moon, 0.45); mo.position.set(-0.5, 1, 0.3); scene.add(mo); }
    if (TH.outdoor && BR.Tex.skyDome) { try { scene.add(BR.Tex.skyDome(TH)); } catch (e) {} }
    scene.add(built.group);
    const v = pickView(map, Wd, rng) || (() => { const s = Wd.nodePos(map, map.spawnNode); return { x: s.x, y: s.y + 1.62, z: s.z, yaw: 0, free: 10 }; })();
    const cam = new THREE.PerspectiveCamera(66, W / H, 0.05, 220); cam.rotation.order = 'YXZ';
    cam.position.set(v.x, v.y, v.z); cam.rotation.set(map.outdoor ? -0.04 : -0.02, v.yaw + Math.PI, 0);
    // éclairage : les lampes les plus proches de la zone regardée
    const fx = v.x + Math.sin(v.yaw) * 8, fz = v.z + Math.cos(v.yaw) * 8;
    const L = map.lights.filter(l => !l.dead).map(l => { const x = l.kind === 'lamp' ? l.px : (l.cx + 0.5) * Wd.C, y = l.kind === 'lamp' ? l.y : l.y - 0.35, z = l.kind === 'lamp' ? l.pz : (l.cy + 0.5) * Wd.C; return { l, x, y, z, d: Math.hypot(x - fx, z - fz, (y - v.y) * 1.5) }; }).sort((a, b) => a.d - b.d).slice(0, 8);
    L.forEach(o => { const pl = new THREE.PointLight(TH.lightColor, o.l.kind === 'lamp' ? 1.4 : 1.0, o.l.kind === 'lamp' ? 18 : 11, 2); pl.position.set(o.x, o.y, o.z); scene.add(pl); });
    // une entité au loin dans la perspective (une fois sur deux) : l'ambiance du jeu
    let views = null;
    if (BR.Ent.count() > 0 && v.free > 12 && rng() < 0.6) {
      const d = Math.min(v.free - 3, 10 + rng() * 10), ex = v.x + Math.sin(v.yaw) * d, ez = v.z + Math.cos(v.yaw) * d;
      const n = Wd.nodeAt(map, ex, v.y - 1.2, ez);
      if (n >= 0) {
        const q = Wd.nodePos(map, n);
        views = new BR.Ent.Views(scene, { fogColor: new THREE.Color(TH.fog), fogDensity: TH.fogDensity });
        views.brightFn = () => 0.75;
        const m = [{ id: 1, x: q.x, y: q.y, z: q.z, st: 'wander', sp: Math.floor(rng() * BR.Ent.count()) }];
        for (let i = 0; i < 10; i++) views.sync(m, 0.1, cam.position);
      }
    }
    r.toneMappingExposure = (TH.exposure || 1) * 1.15;
    scene.updateMatrixWorld(true);
    r.render(scene, cam);
    const url = canvas.toDataURL('image/jpeg', 0.82);
    // nettoyage (les matériaux du thème sont partagés : on ne les détruit pas)
    if (views) views.clear();
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!(m.userData && m.userData.keep)) { if (m.map && !(m.userData && m.userData.keep)) { /* textures partagées possibles : on garde */ } m.dispose(); } });
    });
    r.renderLists.dispose();
    return url;
  }
  /** pré-calcule toutes les miniatures en tâche de fond (appelé au démarrage) */
  T.warm = function () { BR.MAPS.forEach(m => T.get(m.id)); };
})();

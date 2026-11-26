/* ===== assets.js (chargeur) : modèles 3D et textures PBR embarqués dans assets.js (racine) =====
   Les fichiers sont encodés en base64 pour fonctionner même en double-clic (file://). */
(function () {
  const BR = window.BR;
  const AS = (BR.Assets = { ready: false, models: {}, tex: {}, clips: [], kits: {} });

  function b64buf(d) { const s = d.indexOf(','), bin = atob(d.slice(s + 1)), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function img(d) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = d; }); }
  function parse(loader, d) { return new Promise(res => { try { loader.parse(b64buf(d), '', g => res(g), e => { console.warn('glTF', e); res(null); }); } catch (e) { console.warn(e); res(null); } }); }

  AS.load = async function (progress) {
    if (AS.ready) return;
    const G = window.GAME_ASSETS; if (!G || !THREE.GLTFLoader) { console.warn('assets absents'); return; }
    const loader = new THREE.GLTFLoader();
    // textures des kits (palettes)
    for (const k in G.kits) { const i = await img(G.kits[k]); if (!i) continue; const t = new THREE.Texture(i); t.encoding = THREE.sRGBEncoding; t.flipY = false; t.needsUpdate = true; AS.kits[k] = t; }
    const names = Object.keys(G.models); let n = 0;
    for (const name of names) {
      const g = await parse(loader, G.models[name]);
      n++; progress && progress(n / names.length);
      if (!g) continue;
      const kit = name.startsWith('city_') ? AS.kits.city : name.startsWith('furn_') ? AS.kits.furn : null;
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = false; o.receiveShadow = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (kit && !m.map) { m.map = kit; m.needsUpdate = true; } m.userData.keep = true; if (m.metalness > 0.5) m.metalness = 0.2; m.roughness = Math.max(0.55, m.roughness); });
      });
      AS.models[name] = g;
      if (name === 'char_knight') AS.clips = g.animations;
    }
    AS.ready = true;
  };
  /** copie d'un objet décoratif (partage géométrie et matériaux) */
  AS.prop = function (name) { const g = AS.models[name]; return g ? g.scene.clone(true) : null; };
  /** copie indépendante d'un personnage animé (squelette cloné) */
  AS.character = function (name) { const g = AS.models[name] || AS.models.char_knight; return g ? THREE.SkeletonUtils.clone(g.scene) : null; };
  AS.clip = name => AS.clips.find(c => c.name === name) || null;
  /** boîte englobante d'un modèle (mise à l'échelle) */
  AS.size = function (name) { const g = AS.models[name]; if (!g) return null; const b = new THREE.Box3().setFromObject(g.scene); return b.getSize(new THREE.Vector3()); };

  /* ---------- matériaux PBR (textures ambientCG) ---------- */
  const texCache = {};
  function tx(name, k) {
    const key = name + ':' + k;
    if (texCache[key] !== undefined) return texCache[key];
    const e = window.GAME_ASSETS && window.GAME_ASSETS.tex[name]; const d = e && e[k];
    if (!d) return (texCache[key] = null);
    const i = new Image(); const t = new THREE.Texture(i);
    i.onload = () => { t.needsUpdate = true; }; i.src = d;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (k === 'c' || k === 'e') t.encoding = THREE.sRGBEncoding;
    return (texCache[key] = t);
  }
  /**
   * Matériau PBR. o = { color (teinte), rough (multiplicateur), emissive (intensité de la carte d'émission), normal (force) }
   */
  AS.pbr = function (name, o) {
    o = o || {};
    // o.repeat : la texture couvre 1/repeat unité d'UV (copie de texture partageant l'image)
    const rp = o.repeat;
    const T = k => { const t = tx(name, k); if (!t || !rp) return t; const c = t.clone(); c.repeat.set(rp, rp); const im = t.image; if (im && im.complete && im.width) c.needsUpdate = true; else if (im) im.addEventListener('load', () => { c.needsUpdate = true; }); return c; };
    const m = new THREE.MeshStandardMaterial({ map: o.map || T('c'), normalMap: T('n'), roughnessMap: T('r'), roughness: o.rough != null ? o.rough : 1, metalness: o.metal || 0, vertexColors: !!o.vc });
    if (m.normalMap) m.normalScale.set(o.normal || 1, o.normal || 1);
    if (o.color) m.color = new THREE.Color(o.color);
    const em = T('e');
    if (em && o.emissive) { m.emissiveMap = em; m.emissive = new THREE.Color(o.emissiveColor || 0xffffff); m.emissiveIntensity = o.emissive; }
    const mt = tx(name, 'm'); if (mt && o.metal) m.metalnessMap = mt;
    m.userData.keep = true;
    return m;
  };
  AS.has = name => !!(window.GAME_ASSETS && window.GAME_ASSETS.tex[name]);
})();

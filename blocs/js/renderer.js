/* ===== renderer.js : scène Three.js, caméra, ciel, astres, brouillard, jour/nuit et matériaux des blocs
   Les matériaux des blocs sont des MeshBasicMaterial étendus (onBeforeCompile) :
   - répétition de la tuile de l'atlas sur les grands rectangles fusionnés (attribut « tile » + fract)
   - lumière : max(lumière du ciel × jour, lumière des blocs teintée chaude) ; lit.x > 1.5 = bloc lumineux
   Point d'entrée pour de futurs shaders : VX.R.extendBlockShader(fn) ===== */
(function () {
  const VX = window.VX;
  const canvas = document.getElementById('gl');
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, 1, 0.05, 420);
  const resize = () => { gl.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); };
  window.addEventListener('resize', resize); resize();
  scene.fog = new THREE.Fog(0x000000, 10, 100);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x101010 }));
  outline.visible = false; scene.add(outline);
  const stars = (() => { const g = new THREE.BufferGeometry(), p = [], r = VX.rng(5); for (let i = 0; i < 500; i++) { const a = r() * 6.283, e = r() * 1.3 + 0.1, d = 300; p.push(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d); } g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true })); })();
  scene.add(stars);
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false })); scene.add(sun);

  const U = { uDay: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uMin: { value: 0.035 } };
  const extra = [];
  function blockMat(opts) {
    const m = new THREE.MeshBasicMaterial(Object.assign({ map: VX.TEX.tex, vertexColors: true }, opts));
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 tile;\nattribute vec2 lit;\nvarying vec2 vTile;\nvarying vec2 vLit;\nvarying vec2 vLocal;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = tile; vLit = lit; vLocal = uv;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uDay;\nuniform vec3 uTint;\nuniform float uMin;\nvarying vec2 vTile;\nvarying vec2 vLit;\nvarying vec2 vLocal;')
        .replace('#include <map_fragment>', [
          'vec2 auv = vTile + (fract(vLocal) * 0.996 + 0.002) * 0.0625;',
          'vec4 texelColor = texture2D( map, auv );',
          'texelColor = mapTexelToLinear( texelColor );',
          'diffuseColor *= texelColor;',
          'vec3 lc = vLit.x > 1.5 ? vec3(1.0) : max(vec3(vLit.x * uDay) * uTint, vLit.y * vec3(1.0, 0.84, 0.6));',
          'diffuseColor.rgb *= max(lc, vec3(uMin));',
        ].join('\n'));
      for (const fn of extra) fn(sh);
    };
    return m;
  }
  const mats = {
    o: blockMat({ alphaTest: 0.5 }),
    t: blockMat({ transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  };
  const SKY = { day: new THREE.Color('#8fd0ff'), night: new THREE.Color('#0b1030'), braises: new THREE.Color('#3a1838'), water: new THREE.Color('#1c3f8a'), lava: new THREE.Color('#c84a10') };
  const tmp = new THREE.Color();

  VX.R = {
    gl, scene, camera, outline, stars, sun, mats, uniforms: U,
    // ajoute une transformation de shader (appelée à la compilation des matériaux de blocs)
    extendBlockShader(fn) { extra.push(fn); mats.o.needsUpdate = mats.t.needsUpdate = true; },
    // ciel, astres, lumière et brouillard
    sky(dim, time, P, R, under) {
      let sky;
      if (dim === 'surface') {
        const s = Math.sin(time * Math.PI * 2), k = Math.max(0, Math.min(1, s * 2.2 + 0.45));
        U.uDay.value = 0.16 + 0.84 * k; U.uTint.value.setRGB(1, 1, 1);
        sky = tmp.copy(SKY.night).lerp(SKY.day, k); stars.material.opacity = 1 - k; stars.visible = sun.visible = true;
        const ang = time * Math.PI * 2; sun.position.set(P.pos.x + Math.cos(ang) * 250, Math.sin(ang) * 250, P.pos.z + 40); sun.lookAt(P.pos.x, P.eye, P.pos.z); sun.material.color.set(s > 0 ? 0xfff3b0 : 0xdde6ff);
      } else { U.uDay.value = 0.92; U.uTint.value.setRGB(1, 0.88, 0.95); sky = tmp.copy(SKY.braises); stars.visible = sun.visible = false; }
      scene.background = under === 1 ? SKY.water : under === 2 ? SKY.lava : sky.clone();
      scene.fog.color.copy(scene.background);
      scene.fog.near = under ? 1 : dim === 'braises' ? 8 : R * 16 * 0.55; scene.fog.far = under ? (under === 2 ? 3 : 14) : dim === 'braises' ? R * 16 * 0.75 : R * 16 * 0.95;
    },
    render() { gl.render(scene, camera); },
  };
})();

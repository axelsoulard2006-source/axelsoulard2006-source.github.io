/* ===== arena/asc-fx.js : effets de l'Ascension =====
   - pétales : nuée de pétales qui tourbillonnent et viennent se coller pour former une créature (ou un joueur),
     puis s'envolent quand elle meurt ; une seule « InstancedMesh » par scène (un appel de dessin)
   - dissolution : les matériaux d'un modèle apparaissent de bas en haut avec un liseré lumineux (et inversement) */
(function () {
  const BR = window.BR, V3 = THREE.Vector3;
  const X = (BR.AscFX = {});

  /* ---------- texture d'un pétale (goutte arrondie, cœur clair) ---------- */
  let petalTex = null;
  function tex() {
    if (petalTex) return petalTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.translate(32, 32);
    const gr = g.createRadialGradient(0, 6, 2, 0, 0, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.92)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -30); g.bezierCurveTo(22, -16, 22, 16, 0, 30); g.bezierCurveTo(-22, 16, -22, -16, 0, -30); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 24); g.stroke();
    petalTex = new THREE.CanvasTexture(c); petalTex.encoding = THREE.sRGBEncoding;
    return petalTex;
  }

  /* ---------- système de pétales (un par scène) ---------- */
  X.petals = function (scene) {
    if (scene.userData.petals) return scene.userData.petals;
    const N = 1400, geo = new THREE.PlaneGeometry(0.26, 0.17);
    const mat = new THREE.MeshBasicMaterial({ map: tex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
    const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.renderOrder = 7;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < N; i++) { im.setMatrixAt(i, zero); im.setColorAt(i, new THREE.Color(1, 1, 1)); }
    scene.add(im);
    const free = []; for (let i = N - 1; i >= 0; i--) free.push(i);
    const live = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new V3(), pv = new V3(), cc = new THREE.Color();
    const P = {
      /** les pétales arrivent de partout en spirale et se collent sur la forme (centre c, hauteur h, rayon r) */
      gather(c, h, r, cols, n, dur) {
        for (let k = 0; k < n && free.length; k++) {
          const i = free.pop(), a = Math.random() * 6.283, R0 = 2.5 + Math.random() * 3.5;
          const p0 = new V3(c.x + Math.cos(a) * R0, c.y + Math.random() * (h + 2.5), c.z + Math.sin(a) * R0);
          const ta = Math.random() * 6.283, ty = Math.random();
          const p1 = new V3(c.x + Math.cos(ta) * r * (0.5 + 0.5 * Math.sin(ty * Math.PI)), c.y + ty * h, c.z + Math.sin(ta) * r * (0.5 + 0.5 * Math.sin(ty * Math.PI)));
          // point de contrôle décalé sur le côté : trajectoire en spirale
          const side = new V3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(R0 * (0.7 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1));
          const ctrl = p0.clone().lerp(p1, 0.45).add(side).add(new V3(0, 1 + Math.random() * 1.5, 0));
          live.push({ i, mode: 0, p0, p1, ctrl, t: -Math.random() * dur * 0.35, dur: dur * (0.55 + Math.random() * 0.45), rot: new V3(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: new V3(rnd(8), rnd(8), rnd(8)), s: 0.8 + Math.random() * 0.7, col: pick(cols) });
        }
      },
      /** les pétales s'envolent de la forme (mort, disparition) */
      burst(c, h, r, cols, n, force) {
        for (let k = 0; k < n && free.length; k++) {
          const i = free.pop(), a = Math.random() * 6.283, y = Math.random();
          const p0 = new V3(c.x + Math.cos(a) * r * 0.8, c.y + y * h, c.z + Math.sin(a) * r * 0.8);
          const v = new V3(Math.cos(a) * (2 + Math.random() * 4), 1.5 + Math.random() * 4, Math.sin(a) * (2 + Math.random() * 4)).multiplyScalar(force || 1);
          live.push({ i, mode: 1, p0, v, t: 0, dur: 1.2 + Math.random() * 0.9, rot: new V3(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: new V3(rnd(10), rnd(10), rnd(10)), s: 0.8 + Math.random() * 0.7, col: pick(cols) });
        }
      },
      /** aspiration : les pétales filent vers un point (portail) */
      suck(from, to, cols, n, dur) {
        for (let k = 0; k < n && free.length; k++) {
          const i = free.pop(), p0 = from.clone().add(new V3(rnd(1.2), Math.random() * 2, rnd(1.2)));
          const ctrl = p0.clone().lerp(to, 0.5).add(new V3(rnd(3), 1 + Math.random() * 2, rnd(3)));
          live.push({ i, mode: 0, p0, p1: to.clone(), ctrl, t: -Math.random() * dur * 0.5, dur: dur * (0.5 + Math.random() * 0.5), rot: new V3(), spin: new V3(rnd(12), rnd(12), rnd(12)), s: 0.7 + Math.random() * 0.6, col: pick(cols) });
        }
      },
      update(dt) {
        for (let j = live.length - 1; j >= 0; j--) {
          const p = live[j]; p.t += dt;
          if (p.t < 0) continue;
          const k = Math.min(1, p.t / p.dur); let sc = p.s;
          if (p.mode === 0) {
            const u = k * k * (3 - 2 * k), a = 1 - u;   // ease
            pv.set(a * a * p.p0.x + 2 * a * u * p.ctrl.x + u * u * p.p1.x, a * a * p.p0.y + 2 * a * u * p.ctrl.y + u * u * p.p1.y, a * a * p.p0.z + 2 * a * u * p.ctrl.z + u * u * p.p1.z);
            sc *= Math.min(1, p.t * 6) * (k > 0.85 ? (1 - k) / 0.15 : 1);
          } else {
            p.v.y -= 3.2 * dt; p.v.multiplyScalar(Math.max(0, 1 - dt * 1.4));
            p.p0.addScaledVector(p.v, dt); pv.copy(p.p0); sc *= 1 - k * k;
            p.rot.x += Math.sin(p.t * 3 + p.i) * dt * 2;
          }
          p.rot.addScaledVector(p.spin, dt);
          e.set(p.rot.x, p.rot.y, p.rot.z); q.setFromEuler(e); sv.setScalar(Math.max(0.0001, sc));
          m4.compose(pv, q, sv); im.setMatrixAt(p.i, m4);
          cc.copy(p.col); im.setColorAt(p.i, cc);
          if (k >= 1) { im.setMatrixAt(p.i, zero); free.push(p.i); live.splice(j, 1); }
        }
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      },
      dispose() { scene.remove(im); geo.dispose(); mat.dispose(); scene.userData.petals = null; },
    };
    scene.userData.petals = P;
    return P;
  };
  const rnd = a => (Math.random() - 0.5) * 2 * a;
  const pick = cols => { const c = cols[(Math.random() * cols.length) | 0]; return c.isColor ? c : new THREE.Color(c).multiplyScalar(1.6); };

  /* ---------- dissolution des matériaux d'un modèle ---------- */
  const NOISE = `float dzH(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
    float dzN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(dzH(i), dzH(i+vec3(1,0,0)), f.x), mix(dzH(i+vec3(0,1,0)), dzH(i+vec3(1,1,0)), f.x), f.y), mix(mix(dzH(i+vec3(0,0,1)), dzH(i+vec3(1,0,1)), f.x), mix(dzH(i+vec3(0,1,1)), dzH(i+vec3(1,1,1)), f.x), f.y), f.z); }`;
  /** remplace les matériaux du modèle par des copies « dissolvables » ; renvoie { set(k), U } (k = 0 invisible … 1 entier) */
  X.dissolve = function (root, edge) {
    const U = { uDis: { value: 0 }, uEdge: { value: new THREE.Color(edge || 0xffffff).multiplyScalar(3) }, uY0: { value: 0 }, uH: { value: 2 } };
    const mats = [];
    root.traverse(o => {
      if (!o.isMesh || !o.material || o.material.isShaderMaterial) return;
      const src = Array.isArray(o.material) ? o.material : [o.material];
      const cl = src.map(m => {
        const c = m.clone(); c.userData.dis = true;
        c.onBeforeCompile = sh => {
          Object.assign(sh.uniforms, U);
          sh.vertexShader = 'varying vec3 vDisW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDisW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          sh.fragmentShader = 'uniform float uDis, uY0, uH; uniform vec3 uEdge; varying vec3 vDisW;\n' + NOISE + '\n' + sh.fragmentShader
            .replace('void main() {', 'void main() {\n  float dzL = clamp((vDisW.y - uY0) / max(0.2, uH), 0.0, 1.0) * 0.72 + dzN(vDisW * 5.0) * 0.28;\n  float dzT = uDis * 1.12;\n  if (dzL > dzT) discard;\n  float dzE = 1.0 - smoothstep(0.0, 0.07, dzT - dzL);')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uEdge * dzE * step(uDis, 0.999);');
        };
        c.customProgramCacheKey = () => 'asc-dissolve';
        mats.push(c); return c;
      });
      o.material = Array.isArray(o.material) ? cl : cl[0];
    });
    return { U, set(k) { U.uDis.value = Math.max(0, Math.min(1, k)); }, dispose() { mats.forEach(m => m.dispose()); } };
  };
})();

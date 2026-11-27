/* ===== noise.js : bruit de Perlin 2D/3D (graine), fbm et hachage déterministe ===== */
(function () {
  const VX = self.VX = self.VX || {};
  VX.makeNoise = function (seed) {
    let s = (seed >>> 0) || 1;
    const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    const perm = []; for (let i = 0; i < 256; i++) perm.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    const p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + t * (b - a);
    const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
    function n3(x, y, z) {
      const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z), X = fx & 255, Y = fy & 255, Z = fz & 255;
      x -= fx; y -= fy; z -= fz; const u = fade(x), v = fade(y), w = fade(z);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return lerp(lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
        lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
    }
    const n2 = (x, y) => n3(x, y, 0.371);
    const fbm2 = (x, y, o) => { let a = 1, f = 1, t = 0, n = 0; for (let i = 0; i < o; i++) { t += a * n2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return t / n; };
    const fbm3 = (x, y, z, o) => { let a = 1, f = 1, t = 0, n = 0; for (let i = 0; i < o; i++) { t += a * n3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return t / n; };
    return { n2, n3, fbm2, fbm3 };
  };
  // nombre pseudo-aléatoire stable pour une position (arbres, minerais…)
  VX.hash = function (x, y, z, seed) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041) + Math.imul(seed | 0, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  VX.rng = function (seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
})();

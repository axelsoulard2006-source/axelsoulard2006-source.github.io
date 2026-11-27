/* ===== crafting.js : logique de fabrication (grilles 2×2 / 3×3) et des fours (les recettes sont dans registry.js) ===== */
(function () {
  const VX = window.VX, R = VX.RECIPES;
  const ok = (want, id) => Array.isArray(want) ? want.includes(id) : want === id;
  // grille : tableau de w*w ids (0 = vide)
  VX.craft = function (grid, w) {
    let x0 = w, y0 = w, x1 = -1, y1 = -1; const items = [];
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const id = grid[y * w + x]; if (!id) continue; items.push(id); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (!items.length) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, at = (x, y) => grid[(y0 + y) * w + x0 + x];
    for (const r of R) {
      if (r.items) {
        if (r.items.length !== items.length) continue;
        const left = items.slice(); let good = true;
        for (const want of r.items) { const j = left.findIndex(id => ok(want, id)); if (j < 0) { good = false; break; } left.splice(j, 1); }
        if (good) return { id: r.out, n: r.n };
        continue;
      }
      const rh = r.rows.length, rw = Math.max(...r.rows.map(s => s.length)); if (rw !== bw || rh !== bh) continue;
      for (const mir of [false, true]) {
        let good = true;
        for (let y = 0; y < rh && good; y++) for (let x = 0; x < rw && good; x++) {
          const ch = r.rows[y][mir ? rw - 1 - x : x] || ' ', id = at(x, y);
          if (ch === ' ') { if (id) good = false; } else if (!id || !ok(r.keys[ch], id)) good = false;
        }
        if (good) return { id: r.out, n: r.n };
      }
    }
    return null;
  };

  VX.SMELT_T = 8;   // secondes par objet
  // un four : { in, fuel, out, burn, burnMax, prog } (piles {id, n} ou null)
  VX.furnaceTick = function (f, dt) {
    if (f.burn > 0) f.burn -= dt;
    const res = f.in && VX.SMELT[f.in.id];
    const fits = res && (!f.out || (f.out.id === res && f.out.n < VX.stackOf(res)));
    if (fits && f.burn <= 0 && f.fuel) { const t = VX.fuelOf(f.fuel.id); if (t > 0) { f.burn = f.burnMax = t; f.fuel.n--; if (f.fuel.n <= 0) f.fuel = null; } }
    if (fits && f.burn > 0) {
      f.prog += dt;
      if (f.prog >= VX.SMELT_T) { f.prog = 0; f.in.n--; if (f.in.n <= 0) f.in = null; if (f.out) f.out.n++; else f.out = { id: res, n: 1 }; return true; }
    } else f.prog = Math.max(0, f.prog - dt * 2);
    return false;
  };
})();

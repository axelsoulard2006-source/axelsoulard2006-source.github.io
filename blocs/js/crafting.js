/* ===== crafting.js : recettes (grille 2×2 et 3×3, avec ou sans forme) et cuisson au four ===== */
(function () {
  const VX = window.VX, B = VX.B, I = VX.I;
  const R = VX.RECIPES = [];
  // forme : lignes de caractères, clé : caractère -> id (ou liste d'ids acceptés)
  const shaped = (rows, keys, out, n) => R.push({ rows, keys, out, n: n || 1 });
  const shapeless = (items, out, n) => R.push({ items, out, n: n || 1 });

  shapeless([B.TRONC], B.PLANCHES, 4);
  shapeless([B.TIGE], B.PLANCHES, 4);
  shaped(['P', 'P'], { P: B.PLANCHES }, I.BATON, 4);
  shaped(['PP', 'PP'], { P: B.PLANCHES }, B.ETABLI);
  shaped(['GGG', 'G G', 'GGG'], { G: [B.GALETS, B.CENDRITE] }, B.FOUR);
  shaped(['C', 'S'], { C: I.CHARBON, S: I.BATON }, B.TORCHE, 4);
  shaped(['C', 'S'], { C: B.LUMICRISTAL, S: I.BATON }, B.TORCHE, 6);
  shaped(['PP', 'PP'], { P: B.PIERRE }, B.BRIQUES, 4);
  shaped(['F ', ' C'], { F: I.L_FER, C: [I.CHARBON, I.ECLAT] }, I.ALLUMEUR);
  shapeless([I.ECLAT, I.ECLAT, I.ECLAT, I.ECLAT, I.L_OR], I.L_ASTRIUM);
  // blocs de stockage et retour
  for (const [ing, blk] of [[I.L_FER, B.B_FER], [I.L_OR, B.B_OR], [I.SAPHIR, B.B_SAPHIR], [I.L_ASTRIUM, B.B_ASTRIUM]]) {
    shaped(['XXX', 'XXX', 'XXX'], { X: ing }, blk);
    shapeless([blk], ing, 9);
  }
  shaped(['XXX', 'XXX', 'XXX'], { X: I.CHARBON }, B.BRAISIER);
  // outils des 5 matériaux
  const MAT = [[B.PLANCHES, B.TIGE], [B.GALETS, B.CENDRITE, B.BASALTE], I.L_FER, I.SAPHIR, I.L_ASTRIUM];
  const SHAPES = { pioche: ['XXX', ' S ', ' S '], hache: ['XX', 'XS', ' S'], pelle: ['X', 'S', 'S'], epee: ['X', 'X', 'S'] };
  MAT.forEach((m, ti) => VX.TOOLS.forEach(k => shaped(SHAPES[k], { X: m, S: I.BATON }, VX.toolId(ti, k))));

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

  // cuisson : entrée -> sortie
  VX.SMELT = {
    [B.SABLE]: B.VERRE, [B.GALETS]: B.PIERRE, [B.M_FER]: I.L_FER, [B.M_OR]: I.L_OR, [B.M_CHARBON]: I.CHARBON, [B.M_SAPHIR]: I.SAPHIR,
    [B.TRONC]: I.CHARBON, [B.TIGE]: I.CHARBON, [B.M_ASTRIUM]: I.ECLAT, [I.MORCEAU]: I.ROTI, [B.CHAPEAU]: I.ROTI, [B.CENDRITE]: B.BRIQUES,
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

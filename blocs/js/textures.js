/* ===== textures.js : textures pixel 16×16 générées sur Canvas 2D + icônes d'inventaire ===== */
(function () {
  const VX = window.VX;
  const N = 16, COLS = 16, atlas = document.createElement('canvas'); atlas.width = atlas.height = N * COLS;
  const ctx = atlas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const names = [], idx = {}, r = VX.rng(90210);
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const vary = (h, k, a) => { const c = hex(h); return `rgba(${c.map(v => Math.max(0, Math.min(255, Math.round(v * (1 + k))))).join(',')},${a == null ? 1 : a})`; };
  function tile(name, fn) {
    const i = names.length; names.push(name); idx[name] = i; const ox = (i % COLS) * N, oy = Math.floor(i / COLS) * N;
    const P = (x, y, c) => { if (x < 0 || y < 0 || x >= N || y >= N) return; ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1); };
    const C = (x, y) => { ctx.clearRect(ox + x, oy + y, 1, 1); };
    fn(P, C);
  }
  const fill = (P, base, amp, a) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) P(x, y, vary(base, (r() - 0.5) * 2 * amp, a)); };
  const specks = (P, col, n, amp) => { for (let i = 0; i < n; i++) P(Math.floor(r() * N), Math.floor(r() * N), vary(col, (r() - 0.5) * (amp || 0.1))); };
  const blob = (P, cx, cy, rad, col, amp) => { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + 0.5 && r() > 0.15) P(cx + x, cy + y, vary(col, (r() - 0.5) * (amp || 0.25))); };
  const bevel = (P, base) => { fill(P, base, 0.05); for (let i = 0; i < N; i++) { P(i, 0, vary(base, 0.3)); P(0, i, vary(base, 0.25)); P(i, N - 1, vary(base, -0.35)); P(N - 1, i, vary(base, -0.3)); } for (let i = 3; i < 13; i++) { P(i, 3, vary(base, -0.15)); P(3, i, vary(base, -0.15)); P(i, 12, vary(base, 0.15)); P(12, i, vary(base, 0.15)); } };
  const ore = (P, base, col, n) => { fill(P, base, 0.08); for (let k = 0; k < n; k++) { const cx = 2 + Math.floor(r() * 12), cy = 2 + Math.floor(r() * 12); for (let j = 0; j < 4; j++) { const x = cx + Math.floor(r() * 3) - 1, y = cy + Math.floor(r() * 3) - 1; P(x, y, vary(col, (r() - 0.5) * 0.4)); if (r() < 0.5) P(x + 1, y, vary(col, -0.3)); } } };

  /* ---------- textures dessinées pixel par pixel (grilles 16×16 + palette) ---------- */
  // ' ' = pixel transparent (ou laissé tel quel pour une surcouche)
  function drawPixelGrid(P, C, palette, rows, overlay) {
    for (let y = 0; y < N; y++) { const row = (rows[y] || '').padEnd(N, '.').slice(0, N); for (let x = 0; x < N; x++) { const ch = row[x]; if (ch === ' ') { if (!overlay) C(x, y); continue; } const col = palette[ch]; if (col) P(x, y, col); } }
  }
  VX.drawPixelGrid = drawPixelGrid;
  const G = (name, pal, rows, alias) => { tile(name, (P, C) => drawPixelGrid(P, C, pal, rows)); if (alias) idx[alias] = idx[name]; };
  const G2 = (name, layers, alias) => { tile(name, (P, C) => layers.forEach(([pal, rows], i) => drawPixelGrid(P, C, pal, rows, i > 0))); if (alias) idx[alias] = idx[name]; };
  // motifs réutilisés avec plusieurs palettes (grains de terre, de sable…)
  const GRAIN = ['..a...b...a..c..', '.b..c..d..a....b', '...a.....b...a..', 'a..d..c.....b...', '..b..a...a..c..a', '.c.....b...d....', '...a.c...a...b..', 'b....d..c....a..', '..a....a...b...c', '.d..b....c....a.', '...c..a....a.d..', 'a.....b..d....b.', '..b.a...a...c...', '.....c..b.a...a.', 'c..d......c..b..', '..a...a.b....d..'];
  const FINE = ['..a....b..a...c.', '.b..c.....b.a...', 'a....a.b....b..a', '..b.....c.a.....', '.c..a.b.....b.a.', '....b...a.c.....', 'a.c...a.....a.b.', '..b.a....b.c....', '.a....c.....a..b', 'b..a....b.a...c.', '...c.b.a....b...', '.b.....a..c...a.', 'a..b.c....a.b...', '...a...b.c.....b', 'c.b...a.....a.a.', '..a.c....b.c....'];
  const ROCK = ['....a.....b.....', '.bb...cc......a.', '......a.b..aa...', 'a..c......b....c', '..aa..b.....c...', 'b......c.aa.....', '...b.a......b.a.', '.c......bb.c....', '....aa.......a..', 'b.......c..b....', '..cc.b.a.......b', '.......a..aa.c..', 'a.b..c.......a..', '....a...bb.c....', '.cc.....a.....b.', 'b....b.c...a....'];
  const DIRT = { '.': '#7b5433', a: '#6b4529', b: '#8f6642', c: '#5a3a20', d: '#a07450' };
  const STONE = { '.': '#8b8b90', a: '#7d7d83', b: '#9b9ba1', c: '#6c6c72' };
  const ASH = { '.': '#4a4352', a: '#3a3442', b: '#5c5468', c: '#2e2834', e: '#ff8a3a' };
  const ASHROWS = ['..a...b.....c..a', '.c..b....a.e....', '....a..c.....b..', 'b.e.....b..a....', '..a..c.....e..c.', '.....b..a.b.....', 'a.c.....e....a..', '...b.a.....c...b', '.e....c.b.a.....', '..a.b.......e.a.', 'c.....a..c......', '...e.b.....b.a..', '.a.....c.a....c.', '..c..e.....b....', 'b.....a.c...e..a', '...a....b.a.....'];
  const ORE = ['                ', '  oo        q   ', ' opqo      ooo  ', '  oq      oppq  ', '           oq   ', '     oo         ', '    opqo        ', '     oq     oo  ', '           opqo ', '  qo        oq  ', ' oppo           ', '  oq     ooo    ', '        opqo    ', '         oq     ', '   oo           ', '  opq           '];
  const bevelRows = () => { const r = []; for (let y = 0; y < N; y++) { let s = ''; for (let x = 0; x < N; x++) s += y === 0 || x === 0 ? 'l' : y === N - 1 || x === N - 1 ? 'x' : (y === 2 || x === 2) && x > 1 && y > 1 && x < 14 && y < 14 ? 'd' : (y === 13 || x === 13) && x > 1 && y > 1 ? 'h' : (x + y) % 7 === 0 && x > 3 && y > 3 && x < 12 && y < 12 ? 'h' : '.'; r.push(s); } return r; };
  const bevelB = (name, base, light, dark, alias) => G(name, { '.': base, l: light, x: dark, d: dark, h: light }, bevelRows(), alias);

  // --- Surface ---
  G('blocaria_terre', DIRT, GRAIN, 'dirt');
  G('blocaria_herbe_haut', { '.': '#5cab3c', a: '#4d9733', b: '#74c450', c: '#3f8228', d: '#86d35e' }, ['..a..b...c..a..b', '.b..d..a....b...', 'a...a....b.d..c.', '..c...b.a.....a.', '.d..a.....c..b..', '...b..c.d...a...', 'a.....a...b....d', '..b.d...c...a.c.', '.a....b...d.....', '...c.a..a...b.a.', 'b......d..c.....', '..a.b.....a..d..', '.d...c.b.....a..', '...a.....a.c...b', 'c..b..d.....b...', '.a....a..b.d..a.'], 'grass_top');
  G('blocaria_herbe_cote', Object.assign({ g: '#5cab3c', h: '#4d9733', k: '#74c450' }, DIRT), ['gkgghgkgghgkgghg', 'hggkgghgkgghgkgh', 'gghg.ghgg.hgkg.g', 'g.h..g.hg..g.h..', '..g.....g....g..', '.c.....b...d....', '...a.c...a...b..', 'b....d..c....a..', '..a....a...b...c', '.d..b....c....a.', '...c..a....a.d..', 'a.....b..d....b.', '..b.a...a...c...', '.....c..b.a...a.', 'c..d......c..b..', '..a...a.b....d..'], 'grass_side');
  G('blocaria_sable', { '.': '#e2d39c', a: '#d3c286', b: '#efe3b8', c: '#c8b578' }, FINE, 'sand');
  G('blocaria_eau', { '.': 'rgba(46,111,216,0.7)', a: 'rgba(64,132,232,0.72)', b: 'rgba(130,185,252,0.78)' }, ['................', '..bbb.......aa..', '.......aaa......', 'aa..........bbb.', '......bbb.......', '..aaa......aa...', '..........bb....', 'bb...aa.........', '........bbb..aa.', '..aa............', '.......aa...bbb.', 'bbb.............', '......bbb..aa...', '..aa............', '..........aaa...', '.bbb...aa.......'], 'water');
  G('blocaria_verre', { f: '#e8f6ff', g: '#9fbfcf', s: 'rgba(255,255,255,0.75)' }, ['ffffffffffffffff', 'f              g', 'f   s          g', 'f  s           g', 'f s            g', 'f              g', 'f        s     g', 'f       s      g', 'f      s       g', 'f     s        g', 'f              g', 'f              g', 'f           s  g', 'f          s   g', 'f              g', 'gggggggggggggggg'], 'glass');
  G('blocaria_neige', { '.': '#f2f6ff', a: '#dfe8f6', b: '#ffffff', c: '#cfdaee' }, FINE, 'snow');
  G('blocaria_neige_cote', Object.assign({ g: '#f2f6ff', h: '#dfe8f6', k: '#ffffff' }, DIRT), ['gkgghgkgghgkgghg', 'hggkgghgkgghgkgh', 'gghggghgggggkggg', 'g.hg.g.hg.gg.h.g', '..g.....g....g..'].concat(GRAIN.slice(5)), 'snow_side');
  // --- Roche & bois ---
  G('blocaria_roche', STONE, ROCK, 'stone');
  G('blocaria_galets', { '.': '#5d5d62', a: '#9c9ca2', b: '#86868c', c: '#b2b2b8' }, ['a..bbbb..aaab.ca', 'ac.bbab.aacab.aa', 'ab..bb..abbb..ab', '...........b....', 'bbb.aacab..bbab.', 'bab.acaab.bcabb.', 'bbb..aab..baab..', '....b.....bbb..a', '.aab.abba.....ab', 'acab.acbb..aacab', 'aab..bab..aacaab', '....b....bbaab..', 'bba..aaab..b...b', 'bcb.acaab.aab.bc', '.b..aab...acab..', 'a........aa....a'], 'cobble');
  G('blocaria_pierre_taillee', { m: '#5e5e64', '.': '#8f8f95', a: '#9d9da3', s: '#7a7a80' }, ['mmmmmmmmmmmmmmmm', 'a......ma.......', '..s....m....s...', '.......m.a......', '..a....m.....a..', 's......m..s.....', '....a..m........', 'sssssssmssssssss', 'mmmmmmmmmmmmmmmm', '...ma.......a...', '.s.m.....s......', '...m..a.......a.', 'a..m......s.....', '...m.s......a...', '.a.m............', 'sssmssssssssssss'], 'bricks');
  G('blocaria_tronc_cote', { '.': '#6b4a2b', a: '#59391f', b: '#7f5a35', c: '#46301a' }, ['a.b.ca..b.a.cb.a', 'a.b.ca..b.a.cb.a', 'a.b.c...b.a.cb.a', 'a...ca..b.a.c..a', 'a.b.ca..b...cb.a', 'a.b.ca.cb.a.cb.a', '..b.ca..b.a.cb.a', 'a.b.ca..b.a.c..a', 'a.b..a..b.a.cb.a', 'a.b.ca..b.a.cb..', 'a.b.ca....a.cb.a', 'a.b.ca..b.a.cb.a', 'a...ca..b.a..b.a', 'a.b.ca..b.a.cb.a', 'a.b.c...b.a.cb.a', 'a.b.ca..b.a.cb.a'], 'log_side');
  G('blocaria_tronc_haut', { x: '#5a3c22', '.': '#c99a63', r: '#a97c48' }, ['xxxxxxxxxxxxxxxx', 'x..............x', 'x.rrrrrrrrrrrr.x', 'x.r..........r.x', 'x.r.rrrrrrrr.r.x', 'x.r.r......r.r.x', 'x.r.r.rrrr.r.r.x', 'x.r.r.r..r.r.r.x', 'x.r.r.r..r.r.r.x', 'x.r.r.rrrr.r.r.x', 'x.r.r......r.r.x', 'x.r.rrrrrrrr.r.x', 'x.r..........r.x', 'x.rrrrrrrrrrrr.x', 'x..............x', 'xxxxxxxxxxxxxxxx'], 'log_top');
  G('blocaria_planches', { '.': '#b88a4f', a: '#a87b44', b: '#c99b5f', s: '#6e4c2a' }, ['ssssssssssssssss', 'b.....a...b.....', '...a.....s....a.', '..b....a.s..b...', 'ssssssssssssssss', '.a....b.....a..b', '....s.......b...', '.b..s..a.......a', 'ssssssssssssssss', '..a.....b...a...', 'b.....a....s..b.', '...b.......s....', 'ssssssssssssssss', 'a...b..s....a...', '..a....s..b.....', 'b....a.s.....a.b'], 'planks');
  G('blocaria_feuillage', { '.': '#3e8b30', a: '#2f7225', b: '#56a844' }, ['.a. .b..a .b.a..', 'b..a..a. ..b. .a', '. .b. ..ab.. a..', '.a..a. b.. .a.b.', '..b. .a..a.b. ..', 'a. ..b. ..a. .b.', '.b.a.. a.b. ..a.', ' ..b.a. .. a.b..', 'a.. ..b.a. b.. .', '.b.a. ..b..a. .a', '..a. .b. .a..b..', 'b. ..a..b. ..a. ', '.a.b. ..a.b. .b.', '. ..a.b. ..a..a.', 'b.a. ..b.a. .b..', '..b.a. ..b. a..b'], 'leaves');
  // --- Ateliers ---
  G('blocaria_etabli_haut', { x: '#6e4c2a', '.': '#c79a5c', a: '#b4884c', t: '#a4a4aa', h: '#7a5230' }, ['xxxxxxxxxxxxxxxx', 'x......x.......x', 'x.a....x....a..x', 'x..tt..x.hh....x', 'x..th..x..hh...x', 'x...h..x...hh..x', 'x......x.......x', 'xxxxxxxxxxxxxxxx', 'x......x.......x', 'x..a...x..tt...x', 'x.hhhh.x..tt...x', 'x.hhhh.x...h...x', 'x......x...h.a.x', 'x..a...x.......x', 'x......x.......x', 'xxxxxxxxxxxxxxxx'], 'bench_top');
  G('blocaria_etabli_cote', { '.': '#b88a4f', a: '#a87b44', x: '#6e4c2a', t: '#a4a4aa', h: '#7a5230', d: '#3a2a1a' }, ['xxxxxxxxxxxxxxxx', '................', 'xxxxxxxxxxxxxxxx', '.a.....a.....a..', '...ttt.....h....', '..t.dt.....h....', '...ttt....hhh...', '....h......h....', '....h......h..a.', '.a..h......h....', '....h...........', '..........a.....', '.x............x.', '.x..a.........x.', '.x............x.', '.x.....a......x.'], 'bench_side');
  G('blocaria_four_face', { '.': '#7a7a80', a: '#8e8e94', b: '#5e5e64', d: '#1e1e22', f: '#ff8a2a', y: '#ffd23a', c: '#a8a8ae' }, ['cccccccccccccccc', 'c.a....b..a....b', 'c..b.a....b.a..b', 'c.a....a.....a.b', 'c...bbbbbbbb...b', 'c.a.bddddddb.a.b', 'c...bddddddb...b', 'c.a.bddddddb...b', 'c...bbbbbbbb.a.b', 'c.a.bddddddb...b', 'c...bdyffydb...b', 'c...bfyffyfb.a.b', 'c.a.bbbbbbbb...b', 'c..a....a....a.b', 'c....a.....a...b', 'bbbbbbbbbbbbbbbb'], 'furnace_front');
  G('blocaria_four_cote', { '.': '#7a7a80', a: '#8e8e94', b: '#5e5e64', c: '#a8a8ae' }, ['cccccccccccccccc', 'c.a....b..a....b', 'c..b.a....b.a..b', 'c.a....a.....a.b', 'c....b....a....b', 'c.a.....b....a.b', 'c...a.a.....b..b', 'cbbbbbbbbbbbbbbb', 'c...a.....a....b', 'c.b....a.....a.b', 'c....a....b....b', 'c.a.....a....a.b', 'c...b.......b..b', 'c.a....a.a.....b', 'c....a.....a...b', 'bbbbbbbbbbbbbbbb'], 'furnace_top');
  // --- Minerais ---
  G2('blocaria_minerai_charbon', [[STONE, ROCK], [{ o: '#2a2a30', p: '#4a4a52', q: '#151518' }, ORE]], 'ore_coal');
  G2('blocaria_minerai_fer', [[STONE, ROCK], [{ o: '#d8a27c', p: '#f0c8a8', q: '#a8724c' }, ORE]], 'ore_iron');
  G2('blocaria_minerai_or', [[STONE, ROCK], [{ o: '#f6d33c', p: '#fff3a0', q: '#c8a020' }, ORE]], 'ore_gold');
  G2('blocaria_minerai_cristal', [[STONE, ROCK], [{ o: '#46c8ff', p: '#d8f6ff', q: '#1c7ac8' }, ORE]], 'ore_sapphire');
  G('blocaria_obsidienne', { '.': '#1b1229', a: '#2a1c40', b: '#0e0818', p: '#5a36a0' }, ['..a....b..p.....', '.b..p.....a..b..', '....a..b.....a..', 'a.b.....a.p....b', '...p.b......a...', '.a.....a.b......', 'b...a......p..a.', '..p....b.a....b.', '.....a.......a..', 'a.b....p..b.....', '...a.b.....a..p.', '.p......a.....b.', '....b.a...p.a...', 'b.a.......b.....', '...p..b.a....a.b', '.a.....p...b....'], 'obsidian');
  G('blocaria_socle', { '.': '#555559', a: '#2e2e32', b: '#7a7a80', c: '#1c1c20', d: '#909096' }, GRAIN, 'bedrock');
  // --- Les Braises (dimension ardente de Blocaria) ---
  G('blocaria_roche_ardente', ASH, ASHROWS, 'cendrite');
  G('blocaria_mousse_ardente_haut', { '.': '#e0762a', a: '#c85e1a', b: '#f59a48', y: '#ffd060', c: '#a4481a' }, ['..a..b..y..a..c.', '.b..c....a...b..', 'a..y..a.b..c...y', '..b...c....a.b..', '.c..a...y.b.....', '...b..a.....c.a.', 'y.....b.a..y....', '..a.c.....b...b.', '.b...y.a.c...a..', '...a.....b..y...', 'c..b.a.c....a..b', '..y....b..a.....', '.a..c.a...y..c..', 'b.....b.a.....a.', '..a.y....c.b....', '.c...a.b....a..y'], 'moss_top');
  G('blocaria_mousse_ardente_cote', { '.': '#e0762a', a: '#c85e1a', b: '#f59a48', y: '#ffd060', c: '#a4481a', r: '#4a4352', s: '#3a3442', t: '#5c5468', e: '#ff8a3a' }, ['..a..b..y..a..c.', '.b..c.a..a...b..', 'a.ab..a.ba.c.a.y', '..b.a.c.ra.a.b.r', 'r.c.ar..ar.b.ra.', 'rr.rrrr.rrr.rrrr', 'rsrrtrrrrsrrtrrr', 'rrrerrsrrrrrrsrr', 'rtrrrrrrtrrerrrr', 'rrsrrtrrrrsrrrtr', 'rrrrrrerrrrrrrrr', 'srrtrrrrsrrtrrsr', 'rrrrsrrrrrrrrerr', 'rtrrrrtrrsrrrrrr', 'rrrerrrrrrrtrrsr', 'rsrrrrsrrtrrrrrr'], 'moss_side');
  G('blocaria_tige', { '.': '#ddd0b2', a: '#c8b890', b: '#ece2c8' }, Array.from({ length: 16 }, (_, i) => ['a.b.a..b.a.b..a.', 'a.b.a..b.a.b..a.', 'a.b....b.a.b..a.', 'a...a..b.a....a.'][i % 4]), 'stalk');
  G('blocaria_tige_haut', { x: '#c8b48c', '.': '#ece2c8', r: '#d8c8a4' }, ['xxxxxxxxxxxxxxxx', 'x..............x', 'x..rrrrrrrrrr..x', 'x.r..........r.x', 'x.r..rrrrrr..r.x', 'x.r.r......r.r.x', 'x.r.r..rr..r.r.x', 'x.r.r.r..r.r.r.x', 'x.r.r.r..r.r.r.x', 'x.r.r..rr..r.r.x', 'x.r.r......r.r.x', 'x.r..rrrrrr..r.x', 'x.r..........r.x', 'x..rrrrrrrrrr..x', 'x..............x', 'xxxxxxxxxxxxxxxx'], 'stalk_top');
  G('blocaria_chapeau', { '.': '#22a89a', a: '#1a8a7e', b: '#3cc8b8', w: '#f4fff8' }, ['..a.....b...a...', '.www..a....www..', 'wwwww....a.wwww.', '.www..b.....ww..', '..a.......a.....', 'b....a.www....b.', '...b..wwwww.a...', 'a......www......', '..b.a.......b..a', '.www......a.....', 'wwwww.b.......ww', '.www....a..b.www', 'a....a.......ww.', '..b.....www....a', '.....b.wwwww.a..', 'a.a.....www.....'], 'cap');
  G('blocaria_basalte_cote', { '.': '#4b4b57', a: '#3a3a44', b: '#5e5e6c', c: '#2c2c34' }, Array.from({ length: 16 }, (_, i) => ['c.b..ac.b..ac.b.', 'c.b..ac.b..ac.b.', 'c.b.a.c.b..ac...', 'c....ac.b.a.c.b.'][i % 4]), 'basalt_side');
  G('blocaria_basalte_haut', { '.': '#555563', a: '#45454f', c: '#34343e', b: '#686878' }, ['cccc....cccc....', 'c..cb..bc..cb..b', 'c.a.cbbc.a.cbbc.', 'c..c....c..c....', 'cccc....cccc....', '....cccc....cccc', 'b..bc..cb..bc..c', '.bbc.a.cbbc.a.cb', '....c..c....c..c', '....cccc....cccc', 'cccc....cccc....', 'c..cb..bc..cb..b', 'c.a.cbbc.a.cbbc.', 'c..c....c..c....', 'cccc....cccc....', '....cccc....cccc'], 'basalt_top');
  G('blocaria_lumicristal', { '.': '#6fe6f0', a: '#2aa8c8', w: '#e8ffff', b: '#a8f4ff' }, Array.from({ length: 16 }, (_, i) => ['w.a..b..w.a..b..', '.w.a..b..w.a..b.', '..w.a..b..w.a..b', 'b..w.a..b..w.a..', '.b..w.a..b..w.a.', '..b..w.a..b..w.a', 'a..b..w.a..b..w.', '.a..b..w.a..b..w'][i % 8]), 'glowcrystal');
  G2('blocaria_minerai_astrium', [[ASH, ASHROWS], [{ o: '#c060f0', p: '#f0c8ff', q: '#7a2aa8' }, ORE]], 'ore_astrium');
  G('blocaria_braisier', { '.': '#2a1612', a: '#3a2018', c: '#1a0c08', e: '#ff7a1a', b: '#ffb13d' }, ['..a...e.....c..a', '.c..b.e..a......', '....aee.c.....b.', 'b......e...a....', '..a..c.ee.......', '.....b...eea.b..', 'a.c........e..a.', '...b.a.....ee..b', '.e....c.b.a..e..', '.ee.b.......ee..', 'c..e..a..c...e..', '...ee.b.....b.e.', '.a...e.c.a....e.', '..c..ee....b..e.', 'b......e.c...ee.', '...a....ea.ee...'], 'ember');
  bevelB('blocaria_bloc_fer', '#d6d6dc', '#f4f4f8', '#9a9aa2', 'iron_block');
  bevelB('blocaria_bloc_or', '#f3c935', '#fff2a0', '#b8901a', 'gold_block');
  bevelB('blocaria_bloc_cristal', '#3a9cff', '#bfe6ff', '#1c5fb8', 'sapphire_block');
  bevelB('blocaria_bloc_astrium', '#b45ae6', '#f0c8ff', '#6a2a90', 'astrium_block');
  G('blocaria_torche', { h: '#7a5230', k: '#5a3a20', y: '#ffd23a', o: '#ff8a2a', w: '#fff3a0' }, ['                ', '                ', '       w        ', '       yo       ', '       yo       ', '       yo       ', '       hk       ', '       hk       ', '       hk       ', '       hk       ', '       hk       ', '       hk       ', '       hk       ', '       hk       ', '       hk       ', '       hk       '], 'torch');
  // effets animés d'aspect (liquide de feu, voile du portail) : dessinés en ondes régulières
  tile('lava', P => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = Math.sin((x + y * 0.5) * 0.8) * 0.5 + Math.sin((y - x * 0.3) * 0.9) * 0.5; P(x, y, v > 0.55 ? '#ffd23a' : v > -0.2 ? '#ff7a1a' : '#d0420e'); } });
  tile('portal', P => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = Math.sin(x * 0.9 + Math.cos(y * 0.7) * 2) * 0.5 + 0.5; P(x, y, `rgba(${170 + v * 60 | 0},${70 + v * 60 | 0},255,0.72)`); } });

  const tex = new THREE.CanvasTexture(atlas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  const E = 0.0008;
  VX.TEX = {
    atlas, tex, names,
    uv(name) { const i = idx[name] != null ? idx[name] : 0, u0 = (i % COLS) / COLS, v0 = 1 - (Math.floor(i / COLS) + 1) / COLS; return [u0 + E, v0 + E, u0 + 1 / COLS - E, v0 + 1 / COLS - E]; },
    has: name => idx[name] != null,
    src(name) { const i = idx[name] || 0; return [(i % COLS) * N, Math.floor(i / COLS) * N]; },
  };

  /* ---------- icônes ---------- */
  const ICON = {};
  const art = (rows, pal) => { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } })); return c; };
  const TOOLART = {
    pioche: ['................', '....MMMMMM......', '...MmmmmmmMM....', '..Mm.....hMmM...', '..M.....h..Mm...', '.......h....M...', '......h.........', '.....h..........', '....h...........', '...h............', '..h.............', '.h..............', '................', '................', '................', '................'],
    hache: ['................', '.......MMM......', '......MmmmM.....', '.....Mmmmmm.....', '.....Mmmmhm.....', '......MMh.M.....', '.......h........', '......h.........', '.....h..........', '....h...........', '...h............', '..h.............', '.h..............', '................', '................', '................'],
    pelle: ['................', '..........MMM...', '.........MmmmM..', '.........MmmmM..', '..........Mmm...', '.........h......', '........h.......', '.......h........', '......h.........', '.....h..........', '....h...........', '...h............', '..h.............', '................', '................', '................'],
    epee: ['................', '............MM..', '...........MmM..', '..........MmM...', '.........MmM....', '........MmM.....', '.......MmM......', '...M..MmM.......', '....MMmM........', '.....MM.........', '....h.MM........', '...h............', '..h.............', '................', '................', '................'],
  };
  const withShadow = rows => rows.map((row, y) => [...row].map((ch, x) => ch === '.' && x > 0 && row[x - 1] === 'h' ? 'H' : ch).join(''));
  const ITEMART = {
    stick: [['................', '................', '................', '...........hH...', '..........hH....', '.........hH.....', '........hH......', '.......hH.......', '......hH........', '.....hH.........', '....hH..........', '...hH...........', '................', '................', '................', '................'], { h: '#8a5f33', H: '#5a3a20' }],
    coal: [['................', '................', '......kkk.......', '....kkKkkkk.....', '...kKkkkkKkk....', '...kkkkKkkkk....', '..kkKkkkkkkKk...', '..kkkkkkKkkkk...', '...kkKkkkkkk....', '...kkkkkkKk.....', '.....kkkkk......', '................', '................', '................', '................', '................'], { k: '#2a2a30', K: '#55555e' }],
    ingot_iron: [['................', '................', '................', '................', '......LLLLLLL...', '.....LwwwwwwL...', '....LwwwwwwLd...', '...LwwwwwwLdd...', '..LLLLLLLLddd...', '..Ldddddddddd...', '..Ldddddddd.....', '..LLLLLLLL......', '................', '................', '................', '................'], { L: '#8a8a92', w: '#f0f0f4', d: '#b8b8c0' }],
    ingot_gold: null, ingot_astrium: null,
    sapphire: [['................', '................', '.....bbbbbb.....', '....bBBwBBBb....', '...bBBwwBBBBb...', '..bbbbbbbbbbbb..', '...bBBBBBBBBb...', '....bBBBBBBb....', '.....bBBBBb.....', '......bBBb......', '.......bb.......', '................', '................', '................', '................', '................'], { b: '#1c5fb8', B: '#46b8ff', w: '#e8f8ff' }],
    shard: [['................', '................', '.........pp.....', '........pPp.....', '.......pPwp.....', '......pPPp......', '.....pPPp.......', '....pPPp........', '...pPPp.........', '...ppp..........', '................', '................', '................', '................', '................', '................'], { p: '#7a2aa8', P: '#d86cff', w: '#fbe0ff' }],
    apple: [['................', '........g.......', '.......gGl......', '.....rrgrrr.....', '....rRrrrrrr....', '...rRwrrrrrrr...', '...rRrrrrrrrr...', '...rrrrrrrrrr...', '...rrrrrrrrrd...', '....rrrrrrrd....', '.....rrdrrd.....', '................', '................', '................', '................', '................'], { r: '#e0302a', R: '#ff6a5a', w: '#ffd0c8', d: '#9a1a14', g: '#5a3a20', G: '#5a3a20', l: '#47d16c' }],
    igniter: [['................', '................', '............oy..', '...........oOo..', '..........mOo...', '.........mm.....', '........mm......', '.......mm.......', '......mm........', '.....mm.........', '....MM..........', '...MM...........', '................', '................', '................', '................'], { m: '#d6d6dc', M: '#8a8a92', o: '#ff8a2a', O: '#ffd23a', y: '#fff3a0' }],
    cap_piece: [['................', '................', '................', '.....oooooo.....', '...ooOoooowoo...', '..oowooooOoooo..', '..oooooooooowo..', '..cccccccccccc..', '................', '................', '................', '................', '................', '................', '................', '................'], { o: '#22a89a', O: '#4ad8c8', w: '#fff3df', c: '#ddd0b2' }],
    roast: [['................', '................', '................', '.....bbbbbb.....', '...bbBbbbbBbb...', '..bbBbbbdbbbbb..', '..bbbbbdbbbbBb..', '..cccccccccccc..', '.......cc.......', '.......cc.......', '................', '................', '................', '................', '................', '................'], { b: '#9a4a1e', B: '#c8743a', d: '#5a2a10', c: '#c8b48c' }],
  };
  ITEMART.ingot_gold = [ITEMART.ingot_iron[0], { L: '#b8901a', w: '#fff2a0', d: '#f3c935' }];
  ITEMART.ingot_astrium = [ITEMART.ingot_iron[0], { L: '#6a2a90', w: '#f4c8ff', d: '#c06ae8' }];
  function blockIcon(id) {
    const d = VX.BLOCKS[id], c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (d.shape === 'torch' || d.cutout && id === VX.B.VERRE && false) { const [sx, sy] = VX.TEX.src(d.tex.side); g.drawImage(atlas, sx, sy, 16, 16, 0, 0, 32, 32); return c; }
    const face = (name, m, dark) => { const [sx, sy] = VX.TEX.src(name); g.setTransform(...m); g.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16); if (dark) { g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, 16, 16); } };
    face(d.tex.top, [1, 0.5, -1, 0.5, 16, 0]); face(d.tex.side, [1, 0.5, 0, 1, 0, 8], 0.22); face(d.tex.side, [1, -0.5, 0, 1, 16, 16], 0.38);
    g.setTransform(1, 0, 0, 1, 0, 0); return c;
  }
  VX.icon = function (id) {
    if (ICON[id]) return ICON[id];
    let c;
    if (VX.isBlock(id)) c = blockIcon(id);
    else {
      const itd = VX.ITEMS[id];
      if (itd && itd.tool) { const t = VX.TIERS[itd.tool.tier]; c = art(withShadow(TOOLART[itd.tool.kind]), { m: t.col, M: vary(t.col, -0.35), h: '#8a5f33', H: '#5a3a20' }); }
      else if (itd && ITEMART[itd.icon]) { const [rows, pal] = ITEMART[itd.icon]; c = art(rows, pal); }
      else { c = document.createElement('canvas'); c.width = c.height = 16; }
    }
    ICON[id] = { canvas: c, url: c.toDataURL() };
    return ICON[id];
  };
  // texture (sprite) pour les objets posés par terre
  const STEX = {};
  VX.iconTex = id => { if (STEX[id]) return STEX[id]; const t = new THREE.CanvasTexture(VX.icon(id).canvas); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return (STEX[id] = t); };
})();

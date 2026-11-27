/* ===== debug.js : écran de débogage (touche F3)
   À gauche : images par seconde (+ petit graphe), position, bloc, chunk, direction du regard, biome,
   lumière estimée sous le joueur, dimension, heure, état du joueur, bloc visé.
   À droite : chunks chargés / maillés / en attente, temps de maillage, appels de dessin, mémoire, GPU, écran.
   Lecture seule : ne modifie rien dans le jeu. ===== */
(function () {
  const VX = window.VX;
  let on = false, box = null, L = null, Rr = null, graph = null, acc = 0, frames = 0, fps = 0, ms = 0;
  const hist = new Float32Array(120); let hi = 0;
  let gpu = null;

  function ensure() {
    if (box) return;
    box = document.createElement('div'); box.className = 'dbg';
    box.innerHTML = '<div class="col l"></div><div class="col r"></div>';
    document.body.appendChild(box); L = box.querySelector('.l'); Rr = box.querySelector('.r');
    graph = document.createElement('canvas'); graph.width = 240; graph.height = 50; graph.className = 'graph';
  }
  function toggle() { on = !on; ensure(); document.body.classList.toggle('dbg-on', on); if (on) refresh(); }
  document.addEventListener('keydown', e => {
    if (e.code !== 'F3') return; e.preventDefault();
    if (/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName)) return;
    toggle();
  });

  const f1 = v => (Math.round(v * 1000) / 1000).toFixed(3);
  const deg = r => ((r * 180 / Math.PI) % 360 + 360) % 360;
  // direction du regard : lacet 0 = vers −Z (nord)
  function facing(yaw) {
    const a = deg(yaw), dirs = [['Nord', '−Z'], ['Ouest', '−X'], ['Sud', '+Z'], ['Est', '+X']];
    const d = dirs[Math.round(a / 90) % 4]; return d[0] + ' (vers ' + d[1] + ')';
  }
  // lumière estimée : ciel = colonne dégagée jusqu'en haut ; blocs = source la plus proche (distance de Manhattan)
  function lightAt(w, x, y, z) {
    const D = VX.BLOCKS, H = VX.H || 64; let sky = 15;
    for (let yy = y + 1; yy < H; yy++) { const b = D[w.get(x, yy, z)]; if (b && b.opaque && !b.leaves) { sky = 0; break; } }
    let blk = 0; const R = 10;
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const m = Math.abs(dx) + Math.abs(dy) + Math.abs(dz); if (m > R) continue;
      const b = D[w.get(x + dx, y + dy, z + dz)]; if (b && b.light && b.light - m > blk) blk = b.light - m;
    }
    return { sky, blk };
  }
  function gpuName() {
    if (gpu != null) return gpu;
    try { const gl = VX.R.gl.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { gpu = '?'; }
    return gpu;
  }
  const line = (t, cls) => `<span${cls ? ` class="${cls}"` : ''}>${String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`;

  function refresh() {
    const G = VX.G; if (!G || !G.world || !box) return;
    const P = G.player, w = G.world, CS = VX.CS || 16;
    const bx = Math.floor(P.pos.x), by = Math.floor(P.pos.y), bz = Math.floor(P.pos.z), cx = Math.floor(bx / CS), cz = Math.floor(bz / CS);
    const left = [line('Blocaria — débogage (F3)', 'h'), line(`${fps} i/s · ${ms.toFixed(1)} ms par image`)];
    left.push(line(`XYZ : ${f1(P.pos.x)} / ${f1(P.pos.y)} / ${f1(P.pos.z)}`, 'g'));
    left.push(line(`Bloc : ${bx} ${by} ${bz}`));
    left.push(line(`Chunk : ${cx} ${cz} (case ${bx - cx * CS} ${bz - cz * CS})`));
    left.push(line(`Regard : ${facing(P.yaw)} · lacet ${deg(-P.yaw).toFixed(1)}° · tangage ${(P.pitch * 180 / Math.PI).toFixed(1)}°`));
    if (G.dim === 'surface' && w.gen && w.gen.biomeAt) { try { left.push(line(`Biome : ${w.gen.biomeAt(bx, bz)}`)); } catch (e) {} }
    try { const l = lightAt(w, bx, by, bz); left.push(line(`Lumière (estimée) : ciel ${l.sky} · blocs ${l.blk}`)); } catch (e) {}
    const t = G.time || 0, hh = Math.floor(((t * 24) + 6) % 24), mm = Math.floor((((t * 24) + 6) % 1) * 60);
    left.push(line(`Dimension : ${G.dimName ? G.dimName() : G.dim} (${G.dim})` + (G.dim === 'surface' ? ` · heure ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} (${t.toFixed(3)})` : '')));
    const sp = Math.hypot(P.vel.x, P.vel.z);
    left.push(line(`Joueur : ${G.mode === 'creatif' ? 'créatif' : 'survie'}${P.fly ? ', vol' : ''}${P.onGround ? ', au sol' : ''}${P.inWater ? ', dans l\'eau' : ''}${P.sneak ? ', accroupi' : ''}${P.sprint ? ', court' : ''} · ${sp.toFixed(2)} m/s`));
    left.push(line(`Vie ${P.hp}/20 · faim ${P.food}/20 · saturation ${(+P.sat || 0).toFixed(1)} · oxygène ${(+P.air || 0).toFixed(1)} s`));
    // bloc visé (rayon propre à l'écran de débogage)
    try {
      const dir = new THREE.Vector3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
      const h = w.raycast(new THREE.Vector3(P.pos.x, P.eye, P.pos.z), dir, 8);
      left.push(line(h ? `Visé : ${VX.nameOf(h.id)} (#${h.id}) à ${h.x} ${h.y} ${h.z}` : 'Visé : rien', 'g'));
    } catch (e) {}
    L.innerHTML = left.join(''); L.appendChild(graph); drawGraph();

    // colonne de droite : moteur
    const WK = VX.Workers || {}, ch = [...w.chunks.values()], meshed = ch.filter(c => c.meshed || (c.meshes && c.meshes.length)).length;
    const right = [line('Moteur', 'h'), line(`Chunks : ${ch.length} chargés · ${meshed} maillés · ${w.pendGen ? w.pendGen.size : 0} en génération`), line(`Maillage : ${w.inflight || 0} en cours · ${WK.meshMs ? WK.meshMs.toFixed(1) + ' ms en moyenne' : '—'} · ${WK.ok ? WK.list.length + ' Workers' : 'thread principal'}`)];
    right.push(line(`Distance de vue : ${G.R} chunks · rendu ${VX.fastMesh ? 'rapide' : 'beau'}${VX.Shaders && VX.Shaders.preset ? ' · shaders ' + VX.Shaders.preset : ''}`));
    try { const inf = VX.R.gl.info; right.push(line(`Dessin : ${inf.render.calls} appels · ${inf.render.triangles} triangles · ${inf.memory.geometries} géométries · ${inf.memory.textures} textures`)); } catch (e) {}
    if (performance.memory) { const m = performance.memory; right.push(line(`Mémoire JS : ${(m.usedJSHeapSize / 1048576).toFixed(0)} / ${(m.jsHeapSizeLimit / 1048576).toFixed(0)} Mo`)); }
    right.push(line(`Objets au sol : ${(G.items || []).filter(i => i.dim === G.dim).length}` + (VX.Mobs && VX.Mobs.list ? ` · créatures : ${VX.Mobs.list.length}` : '') + (VX.MP && VX.MP.on ? ` · salon ${VX.MP.room.code}` : '')));
    right.push(line(`GPU : ${gpuName()}`, 'g'), line(`Écran : ${innerWidth}×${innerHeight} · ratio ${(window.devicePixelRatio || 1).toFixed(2)}`));
    right.push(line(`Graine : ${G.seed}`));
    Rr.innerHTML = right.join('');
  }
  // graphe des temps d'image (vert < 17 ms, ambre < 34 ms, rouge au-delà)
  function drawGraph() {
    const g = graph.getContext('2d'), W = graph.width, H = graph.height; g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, H - 17 * 1.2, W, 1); g.fillRect(0, H - 33 * 1.2, W, 1);
    for (let i = 0; i < 120; i++) { const v = hist[(hi + i) % 120], h = Math.min(H, v * 1.2); g.fillStyle = v < 17 ? '#7ccf4e' : v < 34 ? '#ffc04a' : '#ff5a4a'; g.fillRect(i * 2, H - h, 2, h); }
  }
  let lastT = 0;   // temps réel entre deux images (le dt du jeu est plafonné à 50 ms)
  if (VX.hooks) VX.hooks.on('renderFrame', () => {
    const now = performance.now(), d = lastT ? Math.max(0.0001, (now - lastT) / 1000) : 0.016; lastT = now; hist[hi] = d * 1000; hi = (hi + 1) % 120;
    frames++; acc += d; if (acc >= 0.5) { fps = Math.round(frames / acc); ms = acc / frames * 1000; frames = 0; acc = 0; }
  });
  setInterval(() => { if (on) try { refresh(); } catch (e) { console.warn('[debug]', e); } }, 250);
  VX.Debug = { toggle, get on() { return on; } };
})();

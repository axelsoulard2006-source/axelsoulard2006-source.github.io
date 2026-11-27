/* ===== worker.js : génération de terrain et maillage (lumière comprise) hors du thread principal ===== */
self.window = self;
importScripts('noise.js?v=8', 'registry.js?v=8', 'modapi.js?v=9');
// mods actifs (passés par le thread principal dans l'adresse du Worker : worker.js?v=9&mods=a,b) : leurs blocs(api) tournent ici aussi
(function () {
  const m = /[?&]mods=([^&]*)/.exec(self.location.search), ids = m ? decodeURIComponent(m[1]).split(',').filter(s => /^[a-z0-9][a-z0-9_-]{0,40}$/.test(s)) : [];
  for (const id of ids) { try { importScripts('../mods/' + id + '.js?v=9'); } catch (e) { console.warn('[Worker] mod « ' + id + ' » non chargé :', e && e.message); } }
  self.VX.Mods.placeholders();   // ids 64 à 99 restés libres : bloc « inconnu » (comme sur le thread principal)
})();
importScripts('gen.js?v=8', 'mesher.js?v=8');
const gens = {};
let TILES = null, ORIG = null;
const genFor = (seed, dim) => gens[seed + dim] || (gens[seed + dim] = new self.VX.Gen(seed, dim));
self.onmessage = e => {
  const m = e.data;
  if (m.type === 'init') { TILES = m.tiles; ORIG = m.origins; return; }
  if (m.type === 'gen') {
    const data = genFor(m.seed, m.dim).generate(m.cx, m.cz);
    self.postMessage({ type: 'gen', id: m.id, data }, [data.buffer]);
    return;
  }
  if (m.type === 'mesh') {
    const t0 = performance.now();
    const r = self.VX.Mesher.build(m.vol, m.dim, TILES, ORIG, m.fast, m.ox, m.oz), tr = [];
    for (const k of ['o', 't']) for (const a of ['p', 'u', 't', 'c', 'l', 'i']) tr.push(r[k][a].buffer);
    self.postMessage({ type: 'mesh', id: m.id, r, ms: performance.now() - t0 }, tr);
  }
};

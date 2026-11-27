/* ===== worker.js : génération de terrain et maillage hors du thread principal ===== */
self.window = self;
importScripts('noise.js?v=3', 'registry.js?v=3', 'gen.js?v=3', 'mesher.js?v=3');
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
    const r = self.VX.Mesher.build(m.vol, m.dim, TILES, ORIG, m.fast), tr = [];
    for (const k of ['o', 't']) for (const a of ['p', 'u', 't', 'c', 'l', 'i']) tr.push(r[k][a].buffer);
    self.postMessage({ type: 'mesh', id: m.id, r }, tr);
  }
};

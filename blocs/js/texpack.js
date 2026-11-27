/* ===== texpack.js : pack de textures optionnel (surcharge par fichiers PNG)
   Au démarrage, pour chaque face de bloc utilisée par le jeu, on essaie de charger `textures/<nom_de_face>.png`
   (dossier blocs/textures/). Si le fichier existe, il remplace la tuile générée dans l'atlas ; s'il manque (404),
   la texture générée est gardée. Les images peuvent faire 16×16, 32×32, 64×64… : elles sont mises à la taille de la tuile
   sans lissage (pixels nets). La liste exacte des fichiers attendus est affichée dans la console. ===== */
(function () {
  const VX = window.VX, T = VX.TEX; if (!T) return;
  const DIR = 'textures/';
  const map = T.workerTiles().tiles;                 // nom (et alias) -> index de tuile
  const COLS = 16, big = T.hi || T.atlas, TS = T.tileSize || (big.width / COLS), small = T.atlas, ss = small.width / COLS;
  // faces réellement utilisées par les blocs déclarés, sous leur nom canonique (ex. blocaria_herbe_haut)
  const wanted = new Map();
  for (const b of VX.BLOCKS) { if (!b || !b.tex) continue; for (const f of ['top', 'side', 'bottom']) { const i = map[b.tex[f]]; if (i == null) continue; const name = T.names[i]; if (!wanted.has(name)) wanted.set(name, i); } }
  const files = [...wanted.keys()].sort().map(n => n + '.png');
  console.log('[Blocaria] Pack de textures : fichiers PNG reconnus dans blocs/' + DIR + ' (' + files.length + ') :\n' + files.join('\n'));
  VX.texpack = { files, loaded: [], ready: null };
  const loader = new THREE.TextureLoader();
  const one = (name, i) => new Promise(res => {
    loader.load(DIR + name + '.png', t => {
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      const img = t.image, x = i % COLS, y = Math.floor(i / COLS);
      for (const [cv, s] of [[big, TS], [small, ss]]) { const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(x * s, y * s, s, s); g.drawImage(img, x * s, y * s, s, s); }
      VX.texpack.loaded.push(name + '.png'); t.dispose(); res(true);
    }, undefined, () => res(false));   // absent : on garde la texture générée
  });
  VX.texpack.ready = Promise.all([...wanted].map(([n, i]) => one(n, i))).then(() => {
    if (!VX.texpack.loaded.length) { console.log('[Blocaria] Pack de textures : aucun fichier trouvé, textures générées utilisées.'); return; }
    T.tex.needsUpdate = true;
    console.log('[Blocaria] Pack de textures : ' + VX.texpack.loaded.length + ' fichier(s) chargé(s) : ' + VX.texpack.loaded.join(', '));
  });
})();

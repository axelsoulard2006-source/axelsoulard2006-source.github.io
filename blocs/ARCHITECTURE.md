# Blocaria : architecture du moteur

Un jeu de blocs original, en fichiers statiques, compatible GitHub Pages. Three.js r128 est chargé depuis `../lib/three.min.js`.

## Fichiers

```
blocs/
├─ index.html          ordre de chargement des scripts
├─ style.css           HUD et fenêtres (style pixel net, panneaux en relief)
└─ js/
   ├─ noise.js         bruit de Perlin 2D/3D avec graine, fbm, hachage            (partagé avec le Worker)
   ├─ registry.js      REGISTRE : blocs, objets, outils, recettes, cuisson, combustibles + API VX.registry   (partagé)
   ├─ gen.js           génération pure d'un chunk (Surface, Braises)             (partagé)
   ├─ mesher.js        maillage : fusion des faces, ombre aux coins, lumière      (partagé)
   ├─ worker.js        Web Worker : génération + maillage hors du thread principal
   ├─ hooks.js         évènements pour greffer des fonctions (VX.hooks)
   ├─ textures.js      atlas 16×16 dessiné par grilles de pixels (drawPixelGrid) + icônes
   ├─ renderer.js      scène, caméra, ciel, astres, brouillard, jour/nuit, matériaux à shader (VX.R)
   ├─ world.js         chunks d'une dimension : données, modifs, file des Workers, pool de maillages, visée
   ├─ crafting.js      logique des grilles de fabrication 2×2 / 3×3 et des fours
   ├─ player.js        physique AABB, accroupi, nage, vol, chute
   ├─ ui.js            HUD, inventaire, établi, four, créatif, menus
   └─ main.js          boucle, contrôles, minage, pose, objets au sol, faim, portails, sauvegarde
```

## Le cycle d'un chunk

1. `world.update()` demande les chunks manquants au Worker (`gen`). Au plus 8 demandes sont en attente à la fois.
2. À la réception, on applique les modifications du joueur (`mods`), puis le chunk est marqué « à mailler ».
3. Quand le chunk et ses 8 voisins sont présents, on construit un volume 32×64×32 (8 blocs de marge pour la lumière). Ce volume est transféré au Worker (`mesh`), avec au plus 4 maillages en cours.
4. Le Worker renvoie des tableaux typés transférables, donc sans copie. On en applique au plus 3 par image, en réutilisant les `Mesh` libérés (pool).
5. Chaque modification augmente `c.ver`, et un résultat périmé est ignoré.
6. Secours : si les Workers sont indisponibles, tout se calcule sur le thread principal avec les mêmes fichiers.

## Le rendu

- **Draw calls** : 2 par chunk (opaque et lumineux ensemble, puis transparent). Three.js ne dessine pas les chunks hors du champ de la caméra.
- **Fusion des faces** : les faces voisines de même tuile, même ombre et même lumière deviennent un seul rectangle. Le shader répète la tuile avec `fract()` dans l'atlas unique.
- **Gain mesuré sur le terrain réel** :
  - rendu « Beau » : −20 à −25 % de triangles (ombre aux coins complète) ;
  - rendu « Rapide » : −57 à −59 % (ombre simplifiée), à choisir dans la pause.
- **Lumière** : celle du ciel (par colonne, filtrée par le feuillage), multipliée par le jour/nuit. S'y ajoute la lumière chaude des blocs (torche, cristal, braisier, lave, portail) jusqu'à 8 blocs.

## Ajouter du contenu

```js
// un bloc (textures : noms de tuiles de textures.js)
VX.registry.block(40, 'Bloc de mousse', { top: 'blocaria_feuillage', side: 'blocaria_feuillage', bottom: 'blocaria_feuillage' }, { hard: 0.4, tool: 'hache' });
VX.registry.shapeless([VX.B.FEUILLES, VX.B.FEUILLES], 40, 1);
VX.registry.smelt(40, VX.B.TERRE);
VX.registry.creative(40);
```

Un bloc doit être déclaré dans `registry.js`, car le Worker le lit aussi. Une nouvelle tuile se dessine dans `textures.js` avec `G('nom', palette, lignes)`.

## Brancher une fonction (hooks)

```js
VX.hooks.on('blockBreak', e => { if (e.id === VX.B.OBSIDIENNE && e.dim === 'surface') console.log('obsidienne cassée'); });
VX.hooks.on('playerTick', ({ dt, player }) => { /* ex. effet de poison */ });
VX.hooks.on('renderFrame', ({ scene, camera }) => { /* ex. particules */ });
// renvoyer false dans blockBreak / blockPlace annule l'action
```

Les évènements disponibles : `blockBreak`, `blockPlace`, `playerTick`, `renderFrame`, `dimensionChange`, `itemPickup`, `craft`, `worldSet` (tout changement de bloc).

Modules branchés par les hooks :

- `mobs.js` : les créatures.
- `mp.js` : le multijoueur. Il passe par le serveur du site : salon privé, monde de l'hôte partagé, blocs et positions relayés, et l'invité ne sauvegarde jamais.

## Shaders personnalisés

```js
VX.R.extendBlockShader(sh => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', 'gl_FragColor.rgb *= 1.05;\n#include <fog_fragment>');
});
```

`VX.R.uniforms` contient `uDay` (jour/nuit), `uTint` (teinte de la dimension) et `uMin` (lumière minimale).

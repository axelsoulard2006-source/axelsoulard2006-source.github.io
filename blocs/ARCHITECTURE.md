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
   ├─ gen.js           génération pure d'un chunk : biomes, grottes, minerais (Surface), Braises   (partagé)
   ├─ mesher.js        maillage : lumière voxel propagée, fusion des faces, ombre aux coins, formes spéciales   (partagé)
   ├─ worker.js        Web Worker : génération + maillage hors du thread principal
   ├─ hooks.js         évènements pour greffer des fonctions (VX.hooks)
   ├─ textures.js      atlas 16×16 dessiné par grilles de pixels (drawPixelGrid) + icônes
   ├─ renderer.js      scène, caméra, ciel (léger ou physique Rayleigh + Mie), soleil/lune HD, étoiles, nuages-plaques, brouillard, météo, matériaux à shader (VX.R)
   ├─ world.js         chunks d'une dimension : données, modifs, file des Workers, pool de maillages, visée
   ├─ crafting.js      logique des grilles de fabrication 2×2 / 3×3 et des fours
   ├─ player.js        physique AABB, accroupi, nage, vol, chute
   ├─ ui.js            HUD, inventaire, établi, four, créatif, menus
   └─ main.js          boucle, contrôles, minage, pose, objets au sol, faim, portails, sauvegarde
```

## Le cycle d'un chunk

1. `world.update()` demande les chunks manquants au Worker (`gen`). Au plus 8 demandes sont en attente à la fois.
2. À la réception, on applique les modifications du joueur (`mods`), puis le chunk est marqué « à mailler ».
3. Quand le chunk et ses 8 voisins sont présents, on construit un volume 44×64×44 (`VX.MESH_PAD` = 14 blocs de marge : portée de la lumière). Ce volume est transféré au Worker (`mesh`, avec le coin `ox/oz` du chunk), avec au plus 4 maillages en cours. Le Worker renvoie aussi `ms` (temps de maillage) : moyenne glissante dans `VX.Workers.meshMs`.
4. Le Worker renvoie des tableaux typés transférables, donc sans copie. On en applique au plus 3 par image, en réutilisant les `Mesh` libérés (pool).
5. Chaque modification augmente `c.ver`, et un résultat périmé est ignoré. Le chunk modifié est marqué `urgent` (remaillé avant les autres) ; ses voisins ne sont remaillés que si la lumière peut les atteindre (changement d'opacité / d'émission, à moins de 14 blocs) ou si le bloc touche leur bord.
6. Une plante (`plant: true`) disparaît quand le bloc qui la porte n'est plus solide (`world.set`).
7. Secours : si les Workers sont indisponibles, tout se calcule sur le thread principal avec les mêmes fichiers.

## Le rendu

- **Draw calls** : 2 par chunk (opaque et lumineux ensemble, puis transparent). Three.js ne dessine pas les chunks hors du champ de la caméra.
- **Fusion des faces** : les faces voisines de même tuile, même ombre et même lumière deviennent un seul rectangle. Le shader répète la tuile avec `fract()` dans l'atlas unique.
- **Gain mesuré sur le terrain réel** :
  - rendu « Beau » : −20 à −25 % de triangles (ombre aux coins complète) ;
  - rendu « Rapide » : −57 à −59 % (ombre simplifiée), à choisir dans la pause.
- **Lumière voxel (0 à 15)**, calculée dans le Worker à chaque maillage :
  - *ciel* : chaque colonne reçoit 15 jusqu'au premier bloc opaque (l'eau retire 1 niveau tous les 2 blocs, le feuillage 1 par bloc), puis un remplissage en largeur par paliers (BFS) la propage sous les surplombs, dans les grottes et par les ouvertures : un abri fermé ou une grotte sans ouverture tombe à 0 ;
  - *blocs* : `light` dans le registre (torche 14, lave et lumicristal 13, braisier et portail 11), propagée de la même façon, rendue en lueur chaude qui vacille à peine ;
  - lumière lissée par sommet (moyenne des 4 cases autour du coin) + occlusion ambiante ; une face uniforme reste fusionnable, sinon elle sort en quad 1×1 ;
  - le shader applique une courbe douce (`pow(l, 1.6)`), multiplie le ciel par `uDay` et par sa couleur `uSkyCol` (bleutée la nuit, dorée au crépuscule) ; les Braises gardent une lumière diffuse.
- **Formes spéciales** (non fusionnées) : `shape: 'torch'`, `'cross'` (plantes : 2 quads diagonaux double face, léger décalage aléatoire stable), `'cactus'` (côtés rentrés de 1/16). `tex.front` (coffre) : la face avant est la première face dégagée parmi +z, −z, +x, −x.
- **Attribut `lit` (3 nombres)** : ciel, blocs, code d'animation (1 feuillage qui se balance, 2 haut d'une plante, 3 surface de l'eau qui ondule, 4 autre face d'eau). L'eau défile et scintille au soleil (`uTime`).
- **Ciel** (`VX.R.sky`, cycle de 20 min : `G.time` 0 lever, 0,25 midi, 0,5 coucher, 0,75 minuit) : deux modes, choisis par `VX.R.setAtmo({ phys, plates, cirrus })` (shaders.js l'appelle à chaque changement de preset).
  - *léger* (shaders désactivés) : dôme à dégradé zénith/horizon, halo autour du soleil, bande rosée à l'aube et orangée au crépuscule, soleil et lune en sprites, nuages-plaques (motif périodique 64×64 cases de 6 blocs, 3×3 copies, altitude 92). Le brouillard prend la couleur de l'horizon.
  - *physique* (tous les presets de shaders) : diffusion simple **Rayleigh + Mie + ozone** (planète de 6360 km, observateur à 300 m, 16 pas de vue × 6 pas vers le soleil) rendue chaque image dans une **table du ciel** 128×64 (`VX.R.atmo.lut`, latitude en racine pour plus de détail à l'horizon). Le dôme la lit, ajoute le disque solaire (assombrissement centre-bord + couronne, en HDR pour le halo), le halo argenté de la lune et un voile de cirrus qui dérive. La lune est un disque procédural (`VX.R.moonHD` : cratères en relief, mers sombres) dessiné après les étoiles et avant les nuages. Le même modèle est évalué en JS : `VX.R.atmo` donne `sunDir`, `sunCol` (transmittance : blanc à midi, or-rouge au coucher), `zen`, `hor`, `fog`, `amb`, `wind`, `rain/storm/flash` ; le brouillard, la teinte de la lumière du ciel sur les blocs (`uSkyCol`) et l'éclairage de shaders.js en découlent.
  - 900 étoiles additives qui tournent la nuit ; texture de bruit partagée `VX.R.noiseTex` (256², bruit 3D en une lecture : couches décalées de (37, 17)).
- **Météo** : `VX.G.weather = { rain, storm, flash }` (weather.js, facultatif) est lissé dans `VX.R.sky` : ciel gris et plus sombre, brouillard plus proche, étoiles et astres voilés, vent plus fort (`uWind` : feuillage, herbes, houle), éclairs qui illuminent ciel, nuages et blocs. Fonctionne aussi shaders désactivés.
- **Lumières vivantes** : la lumière des blocs vacille (3 sinus, phase selon le lieu) ; en mode shaders, classes de tuiles 4 lave (pulsation + vagues de chaleur), 5 torche (flamme vive), 6 lumicristal / braisier (scintillement lent). Le balancement au vent reste celui de renderer.js (rafales lentes qui traversent le paysage), shaders.js ne le double pas.

## Ajouter du contenu

```js
// un bloc (textures : noms de tuiles de textures.js)
VX.registry.block(60, 'Bloc de mousse', { top: 'blocaria_feuillage', side: 'blocaria_feuillage', bottom: 'blocaria_feuillage' }, { hard: 0.4, tool: 'hache' });
VX.registry.shapeless([VX.B.FEUILLES, VX.B.FEUILLES], 60, 1);
VX.registry.smelt(60, VX.B.TERRE);
VX.registry.creative(60);
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
- `mp.js` : le multijoueur (serveur du site, salons privés par code, relais `{ t:'r', to, d }`). L'hôte fait autorité : monde envoyé en morceaux à l'arrivée (blocs, coffres, fours, liens de portails, météo, liste des mods), blocs relayés, coffres / fours synchronisés (l'invité envoie à l'hôte qui rediffuse), heure + météo + pousse du blé décidées par l'hôte, créatures simulées par l'hôte autour de tous les joueurs de sa dimension (`VX.Mobs.snapshot` à 10 Hz, copies interpolées chez l'invité, coups envoyés à l'hôte). Chat partagé, liste des joueurs (Tab), JcJ désactivé par défaut (`/jcj`, choix de l'hôte), modèle cubique animé des autres joueurs (armure + objets tenus : message `look`), reprise automatique après une coupure, l'hôte qui part renvoie chacun dans son monde. L'invité ne sauvegarde jamais.

## Shaders personnalisés

```js
VX.R.extendBlockShader(sh => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', 'gl_FragColor.rgb *= 1.05;\n#include <fog_fragment>');
});
```

`VX.R.uniforms` contient `uDay` (jour/nuit, 0,16 à 1), `uTint` (teinte de la dimension), `uMin` (lumière minimale), `uTime` (secondes, animations), `uSkyCol` (couleur de la lumière du ciel) et `uWind` (force du vent, météo). Dans le shader des blocs : `vLit` (vec3 : ciel, blocs, animation) et `vWPos` (position monde).

### Pack de shaders (shaders.js, touche F7)

Presets : Désactivé (rendu léger d'origine) / Bas / Moyen / Élevé / Ultra, réglages fins sauvegardés.

| Effet | Bas | Moyen | Élevé | Ultra |
|---|---|---|---|---|
| Ciel physique, soleil et lune HD, cirrus, reflet d'objectif | oui | oui | oui | oui |
| Nuages | plaques | volumétriques ⅓ résolution, 22 pas | ½ résolution, 32 pas | ½ résolution, 48 pas |
| Ombres des nuages au sol | – | oui | oui | oui |
| Caustiques sous l'eau | – | oui | oui | oui |
| Rayons écran / lumière volumétrique (carte d'ombre) | – / – | oui / – | oui / 16 pas | oui / 28 pas |

- **Nuages volumétriques** : couche y 108–168 (au-dessus de tout le terrain), couverture 2D qui dérive avec `VX.R.atmo.wind` (cellules ~80 blocs) × profil de hauteur, érodée par un bruit 3D à 3 octaves ; lumière = soleil atténué (Beer, quelques pas vers l'astre + 2e octave de diffusion), phase Henyey-Greenstein à deux lobes, effet « poudre », ciel ambiant clair en haut et bleu-violet dessous, éclairs. Passe à résolution réduite, puis un quad plein écran dans la scène (`renderOrder` −97 : après ciel, étoiles et lune, avant le terrain, donc caché naturellement par le relief ; au-dessus des nuages, il passe en dernier et le rayon est arrêté par la profondeur de l'image précédente). Au loin, ils se fondent dans la couleur de l'horizon. Plus denses et gris sous la pluie.
- **Ombres des nuages** : la couverture est lue au point où le rayon du soleil traverse la couche (même fonction `sxCov` que les nuages).
- **Eau** : normales analytiques animées, Fresnel, reflet de la table du ciel, reflet et scintillements du soleil ; **caustiques** : carte de profondeur de l'eau vue de dessus (128×128 blocs autour du joueur, seules les faces d'eau, redessinée quand on s'éloigne ou qu'un bloc change), un fragment plus bas que la surface reçoit un réseau de filaments mouvants (égalité de deux bruits qui dérivent) et une absorption bleu-vert selon la profondeur.
- **Rayons** : flou radial du ciel visible autour du soleil (caché par relief, feuillage et nuages), dorés au coucher ; en Élevé/Ultra, lumière volumétrique par lancer dans la carte d'ombre (faisceaux entre les arbres même soleil hors écran).
- **Reflet d'objectif** : fantômes sur l'axe soleil → centre, étoile à 6 branches et traînée horizontale, visibilité testée sur la profondeur et la transmittance des nuages.
- Mesures (RX 6700 XT, 1024×768, image complète tick + rendu) : Désactivé ≈ 0,7–1,6 ms, Bas ≈ 1,6–2 ms, Moyen ≈ 2,6–3,8 ms (nuages volumétriques ≈ 0,5 ms), Élevé ≈ 3,1–4,7 ms, Ultra ≈ 3,4–4,5 ms.

## La génération (Surface)

- **Climat** par colonne (`gen.climate`) : continentalité (océans profonds / terres, le départ est forcé sur la terre), température, humidité, relief. Les poids de biome sont continus, donc la hauteur et les transitions sont douces ; la surface utilise un petit tramage pour des bords naturels.
- **Biomes** (`gen.biomeAt(x, z)` → `ocean`, `plage`, `desert`, `montagne`, `foret`, `plaine`) :
  - plaines et forêts : herbe, chênes et bouleaux (plus de bouleaux au frais), hautes herbes, massifs de fleurs rubis / d'ambre ;
  - désert : dunes de sable, grès dessous, cactus (1 à 3), arbustes secs ;
  - montagnes : crêtes escarpées, roche apparente sur les pentes ≥ 3, neige au-dessus de ~48 (`NEIGE` sur terre, `NEIGE_BLOC` sur roche) ;
  - océans : fond de sable, d'argile et de gravier ; plages de sable.
- **Sous-sol** (`gen.carved`, fonction pure) : galeries « spaghetti » (intersection de deux surfaces de bruit 3D, entrées plus étroites près de la surface), grandes cavernes en profondeur, lacs de lave sous y = 10 (toujours sous y = 4), filons de charbon, fer, or, saphir, poches de gravier / terre. Pas de trou sous la mer.
- Le terrain non modifié change avec cette génération ; les `mods` des mondes sauvegardés sont gardés tels quels.
- Les Braises ne changent pas.

## Blocs ajoutés (ids 36 à 47 ; 48 à 63 encore libres)

`BOULEAU` 36, `F_BOULEAU` 37, `GRES` 38, `ARGILE` 39, `COFFRE` 40 (hache, dureté 2,5, tuiles dessus / côté / face), `HERBES` 41, `FLEUR_R` 42, `FLEUR_J` 43, `ARBUSTE` 44, `CACTUS` 45 (`hurt: 1`), `NEIGE_BLOC` 46, `GRAVIER` 47.
Propriétés utiles du registre : `plant` (tombe sans support), `replace` (la pose d'un bloc peut la remplacer), `leaves`, `light`, `shade`, `shape`, `tex.front`, `hurt`.

## Mods (`blocs/mods/`)

- `js/modapi.js` (partagé avec le Worker) : `VX.mod({ id, nom, version, auteur, description, blocs(api), init(api) })`, registre surveillé (blocs 64 à 99, objets 300 à 499, conflits refusés), blocs « inconnus » pour les ids de mods absents.
- `js/mods.js` (thread principal) : lit `localStorage.blocaria_mods`, insère les `<script>` des mods activés juste après `modapi.js` (avant l'atlas et le maillage), complète l'api (`addTile`, `addItemArt`, `command`, hooks protégés, `G`, `R`…), lance les `init(api)` à la fin d'`index.html`. Un mod qui plante est désactivé avec un message.
- Le Worker reçoit la liste des mods actifs dans son adresse (`worker.js?v=9&mods=a,b`) et les charge après `registry.js`.
- Écran titre → **Mods** (liste `mods/liste.json`). Guide complet : `mods/LISEZ-MOI.md`.

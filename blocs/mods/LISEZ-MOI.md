# Écrire un mod pour Blocaria

Un mod est un simple fichier JavaScript placé dans ce dossier (`blocs/mods/`). Le joueur l'active dans l'écran **Mods** (écran titre → Mods) ; son choix est gardé dans le navigateur et **un changement demande de recharger la page**.

Trois mods d'exemple, commentés ligne à ligne, servent de modèles :

| Fichier | Ce qu'il montre |
|---|---|
| `lanternes.js` | tuiles dessinées en pixels, blocs lumineux, recettes, un hook |
| `jetpack.js` | un objet sans bloc, son icône, un hook `playerTick`, des particules, un affichage HTML |
| `marche-du-village.js` | un bloc, un objet, des commandes de chat (`/vendre`…), une interaction par clic droit |

## 1. Le squelette

```js
VX.mod({
  id: 'mon-mod',            // = nom du fichier sans .js (minuscules, chiffres, - ou _)
  nom: 'Mon mod',
  version: '1.0',
  auteur: 'Moi',
  description: 'Une phrase pour l’écran Mods.',

  // Contenu « monde » : tourne sur le thread principal ET dans le Worker (génération + maillage).
  blocs(api) {
    api.addTile('mon_bloc', { a: '#7a5230', b: '#c99a63' }, [ /* 16 lignes de 16 caractères */ ]);
    api.registry.block(64, 'Mon bloc', 'mon_bloc', { hard: 1, tool: 'hache' });
  },

  // Le jeu : thread principal seulement (objets, recettes, hooks, commandes, interface).
  init(api) {
    api.registry.shapeless([api.B.PLANCHES, api.B.PLANCHES], 64, 1);
    api.registry.creative(64);
  },
});
```

Puis ajoute ton mod à `liste.json` (c'est ce fichier que lit l'écran Mods) :

```json
{ "id": "mon-mod", "nom": "Mon mod", "version": "1.0", "auteur": "Moi", "description": "…" }
```

## 2. Les règles importantes

- **Ids réservés aux mods** : blocs **64 à 99**, objets **300 à 499**. Un id hors de ces plages, ou déjà pris par un autre mod, est **refusé** (le conflit est affiché dans l'écran Mods et la console). Choisis des ids éloignés de ceux des autres mods.
- **`blocs(api)` ne déclare que du contenu « monde »** : tuiles (`api.addTile`) et blocs (`api.registry.block`). Elle est aussi exécutée dans le Worker, qui n'a ni page, ni `VX.G`, ni `api.hooks` : n'y fais rien d'autre.
- **`init(api)`** est appelée une fois que tout le jeu est chargé : objets, recettes, cuisson, combustibles, hooks, commandes, éléments HTML.
- **Un mod qui plante est désactivé** (erreur de syntaxe, exception dans `blocs`, `init`, un hook ou une commande) : un message s'affiche, le jeu continue, et le mod reste désactivé jusqu'à ce que le joueur le réactive.
- Un monde garde les blocs d'un mod même si on le désactive : ils s'affichent alors en **« bloc de mod inconnu »** (damier violet), qu'on peut casser.

## 3. L'objet `api`

| Membre | Rôle |
|---|---|
| `api.registry.block(id, nom, tuiles, options)` | déclare un bloc (tuiles : un nom, ou `{ top, side, bottom, front }`) |
| `api.registry.item(id, nom, icône, options)` | déclare un objet (`{ stack, food, fuel, dura… }`) |
| `api.registry.shaped(lignes, clés, résultat, n)` | recette avec forme (`['F', 'T']`, `{ F: id, T: id }`) |
| `api.registry.shapeless(ingrédients, résultat, n)` | recette sans forme |
| `api.registry.smelt(entrée, sortie)` / `fuel(id, secondes)` / `creative(id)` | cuisson, combustible, palette du mode créatif |
| `api.addTile(nom, palette, lignes)` | dessine une tuile 16×16 dans l'atlas (avant OU après sa création) ; `' '` = transparent |
| `api.addItemArt(id, lignes, palette)` | icône 16×16 d'un objet (`'.'` = transparent) |
| `api.command(nom, (args, ctx) => …, aide)` | commande `/nom` du chat ; `ctx.say(texte, 'ok' \| 'err')` |
| `api.hooks.on(évènement, fonction)` | hook protégé (une erreur désactive le mod au lieu de casser le jeu) |
| `api.every(secondes, fonction)` | petite minuterie basée sur `playerTick` |
| `api.G`, `api.R`, `api.ui`, `api.FX` | état du jeu, rendu, interface, particules (`api.FX.burst(x, y, z, n, [r, g, b], options)`) |
| `api.B`, `api.I`, `api.BLOCKS`, `api.ITEMS` | identifiants et définitions du jeu |
| `api.toast(texte)`, `api.say(texte, genre)`, `api.log(…)` | messages |

Propriétés utiles d'un bloc : `hard` (dureté, -1 = incassable), `tool` (`'pioche'`, `'hache'`, `'pelle'`), `tier` (niveau d'outil minimum), `drop`, `light` (0 à 15), `glow` (rendu lumineux), `opaque`, `cutout` (pixels transparents), `solid`, `shape` (`'cross'` pour une plante, `'torch'`), `plant`, `hurt`.

Évènements (`api.hooks.on`) : `blockBreak`, `blockPlace` (renvoyer `false` annule), `use` (clic droit avec un objet ; `false` = action consommée), `attack`, `playerTick` (`{ dt, player }`), `renderFrame`, `dimensionChange`, `itemPickup`, `craft`, `worldSet`, `chat`, `death`, `respawn`, `swing`.

## 4. Dessiner une tuile

```js
api.addTile('mon_minerai', { '.': '#8b8b90', o: '#46c8ff', w: '#d8f6ff' }, [
  '................',
  '..oo.......o....',
  '.owo......oo....',
  // … 16 lignes en tout, de 16 caractères chacune
]);
```

Chaque caractère renvoie à une couleur de la palette. Un caractère absent de la palette n'est pas dessiné ; l'espace est transparent (utile pour un bloc `cutout: true`).

## 5. En multijoueur

L'hôte envoie la liste de ses mods à chaque invité. Si un invité ne les a pas activés, un message lui dit lesquels activer (menu Mods) avant de recharger et de rejoindre. Les blocs passent par le monde partagé ; ce que fait `init` (objets, commandes, effets) reste propre à chaque joueur.

## 6. Tester

1. Écran titre → **Mods** → Activer → **Recharger maintenant**.
2. Ouvre la console (F12) : `[mod mon-mod] …` pour tes `api.log`, et les avertissements en cas de conflit.
3. En jeu : `/mode creatif` puis l'inventaire (E) pour retrouver tes blocs dans la palette.

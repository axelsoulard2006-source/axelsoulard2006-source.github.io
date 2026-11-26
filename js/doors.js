/* ===== doors.js : jeu 3 « LES PORTES » =====
   Inspiré de « Doors » : une suite de SALLES toutes différentes, chacune avec son défi. Réussir le défi ouvre la porte
   de la salle suivante (la porte porte le numéro de la salle). Types de salles (section 6) :
     quiz (question de BUT GMP, deux portes), parkour (plateformes au-dessus de la lave), collapse (plancher qui s'effondre
     au-dessus du vide), redlight (1, 2, 3… soleil), maze (labyrinthe éteint, lampe torche), keys (trouver la bonne clé),
     trapdoors (portes piégées + énigme logique), lasers, chase (poursuite), eyes (ne pas regarder l'entité),
     hide (se cacher dans les armoires quand l'entité fonce), code (digicode, indices dans la salle),
     switches (interrupteurs : allumer toutes les ampoules), rest (salle de pause : +1 vie), start (salle 0).
   Vies : chaque échec coûte un cœur et renvoie au début de la salle. Plus de cœur : partie finie (ou spectateur à plusieurs).
   Score = salles franchies ; record par difficulté (stats.best.portes_<diff>).
   Multijoueur (salon « d_portes ») : l'hôte tire la graine, tout le monde a exactement les mêmes salles.
     - la porte d'une salle ne s'ouvre que lorsque tous les survivants sont dans la salle (l'hôte annonce le début : « rs ») ;
     - les énigmes résolues par l'un le sont pour tous (évènements « ev ») ;
     - les pièges en mouvement suivent l'horloge de l'hôte (S.off), donc tout le monde voit les mêmes lasers / feux.
   Outils de test : BR.Doors._step(dt, rendu), BR.Doors._debug(), BR.Doors._goto(k), BR.Doors._solve(). */
(function () {
  'use strict';
  const BR = window.BR, E = BR.Ent;
  // accès « sûr » au module son : une fonction absente ou en erreur ne bloque jamais la partie
  const Au = new Proxy({}, { get: (t, n) => (...a) => { try { const f = BR.Audio && BR.Audio[n]; return typeof f === 'function' ? f.apply(BR.Audio, a) : false; } catch (e) { return false; } } });
  const D = (BR.Doors = { active: false });

  /* =====================================================================
     1. QUESTIONS (BUT GMP 1re / 2e année)
        [question, bonne réponse, réponse fausse (plausible), niveau 1 à 3]
     ===================================================================== */
  const Q = [
    // ---- niveau 1 : bases ----
    ["Unité SI de la contrainte ?", "Pascal (Pa)", "Newton (N)", 1],
    ["1 MPa vaut…", "1 N/mm²", "1 N/m²", 1],
    ["1 bar vaut…", "100 000 Pa", "1 000 Pa", 1],
    ["Unité d'un moment de force ?", "N·m", "N/m", 1],
    ["Unité de la puissance ?", "Watt (W)", "Joule (J)", 1],
    ["Unité de l'énergie ?", "Joule (J)", "Watt (W)", 1],
    ["Module d'Young de l'acier ?", "≈ 210 GPa", "≈ 70 GPa", 1],
    ["Module d'Young de l'aluminium ?", "≈ 70 GPa", "≈ 210 GPa", 1],
    ["Masse volumique de l'acier ?", "≈ 7 850 kg/m³", "≈ 2 700 kg/m³", 1],
    ["Masse volumique de l'aluminium ?", "≈ 2 700 kg/m³", "≈ 7 850 kg/m³", 1],
    ["Dans « GMP », le P veut dire…", "Productique", "Prototypage", 1],
    ["En tournage, qui tourne ?", "La pièce", "L'outil", 1],
    ["En fraisage, qui tourne ?", "L'outil", "La pièce", 1],
    ["Unité usuelle de la vitesse de coupe Vc ?", "m/min", "tr/min", 1],
    ["Unité de l'avance f en tournage ?", "mm/tr", "m/min", 1],
    ["Outil pour percer dans le plein ?", "Foret", "Alésoir", 1],
    ["Outil pour fileter un trou ?", "Taraud", "Filière", 1],
    ["Outil pour fileter une tige ?", "Filière", "Taraud", 1],
    ["Usiner une face plane au tour ?", "Dressage", "Chariotage", 1],
    ["Usiner un cylindre extérieur au tour ?", "Chariotage", "Dressage", 1],
    ["Résolution d'un micromètre courant ?", "0,01 mm", "0,1 mm", 1],
    ["Résolution d'un vernier au 1/50 ?", "0,02 mm", "0,05 mm", 1],
    ["Résolution d'un vernier au 1/20 ?", "0,05 mm", "0,02 mm", 1],
    ["Température de référence en métrologie ?", "20 °C", "0 °C", 1],
    ["L'acier, c'est du fer allié à…", "du carbone", "du cuivre", 1],
    ["Le laiton : cuivre + …", "zinc", "étain", 1],
    ["Le bronze : cuivre + …", "étain", "zinc", 1],
    ["Élément clé d'un acier inoxydable ?", "Chrome", "Plomb", 1],
    ["Essai qui donne Re et Rm ?", "Traction", "Dureté", 1],
    ["Re désigne…", "la limite d'élasticité", "la résistance à la rupture", 1],
    ["Loi de Hooke ?", "σ = E · ε", "σ = E / ε", 1],
    ["Contrainte de traction σ = ?", "F / S", "F · S", 1],
    ["Pénétrateur de l'essai Brinell ?", "Une bille", "Une pyramide", 1],
    ["Pénétrateur de l'essai Vickers ?", "Pyramide en diamant", "Bille en acier", 1],
    ["Essai de résilience ?", "Charpy", "Brinell", 1],
    ["IT signifie…", "Intervalle de tolérance", "Indice technique", 1],
    ["IT = ?", "Cote max − cote min", "Cote max − cote nominale", 1],
    ["Unité usuelle de la rugosité Ra ?", "µm", "mm", 1],
    ["Trait d'un axe de symétrie ?", "Mixte fin", "Continu fort", 1],
    ["Trait d'une arête cachée ?", "Interrompu fin", "Mixte fin", 1],
    ["Sur une coupe, les hachures montrent…", "la matière coupée", "les surfaces usinées", 1],
    ["Échelle 2:1 : le dessin est…", "2 × plus grand", "2 × plus petit", 1],
    ["Dimensions d'un format A4 ?", "210 × 297 mm", "297 × 420 mm", 1],
    ["Vis M10 : que vaut 10 ?", "Le diamètre (mm)", "Le pas (mm)", 1],
    ["Clé pour une vis CHC ?", "Clé 6 pans mâle", "Clé plate", 1],
    ["Rôle d'un joint torique ?", "Étanchéité", "Guidage", 1],
    ["Rôle d'une clavette ?", "Transmettre un couple", "Assurer l'étanchéité", 1],
    ["G00 en code ISO ?", "Déplacement rapide", "Interpolation linéaire", 1],
    ["G01 en code ISO ?", "Interpolation linéaire", "Déplacement rapide", 1],
    ["M05 en code ISO ?", "Arrêt broche", "Arrosage", 1],
    ["M08 en code ISO ?", "Arrosage", "Arrêt broche", 1],
    ["API, en automatisme ?", "Automate programmable", "Axe piloté intégré", 1],
    ["Étape initiale d'un GRAFCET ?", "Double carré", "Cercle", 1],
    ["Entre deux étapes d'un GRAFCET ?", "Une transition", "Une action", 1],
    ["Capteur qui ne détecte que le métal ?", "Inductif", "Capacitif", 1],
    ["Vérin simple effet : retour par…", "ressort", "air comprimé", 1],
    ["Zéro absolu ?", "−273,15 °C", "−100 °C", 1],
    ["g sur Terre ≈ ?", "9,81 m/s²", "98,1 m/s²", 1],
    ["Poids P = ?", "m · g", "m / g", 1],
    ["Statique : la somme des forces vaut…", "0", "m · a", 1],
    ["Moment de F avec un bras de levier d ?", "F · d", "F / d", 1],
    ["Degrés de liberté d'une liaison pivot ?", "1", "2", 1],
    ["Degrés de liberté d'un encastrement ?", "0", "1", 1],
    ["Degrés de liberté d'une rotule ?", "3", "2", 1],
    ["Traitement qui durcit l'acier ?", "Trempe", "Recuit", 1],
    ["Règle de Pareto ?", "80 / 20", "50 / 50", 1],
    ["La roue PDCA est celle de…", "Deming", "Gantt", 1],
    ["Diagramme de planning des tâches ?", "Gantt", "Pareto", 1],
    ["Ishikawa, c'est le diagramme…", "causes-effet", "de Gantt", 1],
    ["Juste-à-temps : objectif ?", "Zéro stock", "Stock maximal", 1],
    ["Un poka-yoke, c'est…", "un détrompeur", "un stock tampon", 1],
    ["Maintenance corrective : quand ?", "Après la panne", "Avant la panne", 1],
    ["Norme du management de la qualité ?", "ISO 9001", "ISO 14001", 1],
    ["Format 3D neutre d'échange ?", "STEP", "SLDPRT", 1],
    ["Format maillé pour l'impression 3D ?", "STL", "STEP", 1],
    ["FAO signifie…", "Fabrication assistée par ordinateur", "Fonderie assistée par ordinateur", 1],
    ["Extrusion en CAO : on…", "translate une esquisse", "fait tourner une esquisse", 1],
    ["Un congé, c'est…", "un arrondi d'arête", "une arête en biais", 1],
    ["Un chanfrein, c'est…", "une arête en biais", "un arrondi d'arête", 1],
    ["Électrode du soudage TIG ?", "Tungstène", "Cuivre", 1],
    ["Énergie cinétique ?", "½ · m · v²", "m · v²", 1],
    ["Rendement η = ?", "P utile / P absorbée", "P absorbée / P utile", 1],
    ["Transformation isotherme : constante…", "la température", "la pression", 1],
    ["Transformation isobare : constante…", "la pression", "le volume", 1],
    ["Transformation isochore : constant…", "le volume", "la pression", 1],
    ["Fonction OU : 1 OU 0 = ?", "1", "0", 1],
    ["Fonction ET : 1 ET 0 = ?", "0", "1", 1],
    ["Lequel fait partie des 5M ?", "Milieu", "Marketing", 1],
    ["Tension électrique U = ?", "R · I", "R / I", 1],
    ["Pression × surface = ?", "Une force", "Une puissance", 1],
    ["Fluide de la pneumatique ?", "Air comprimé", "Huile", 1],
    ["Fluide de l'hydraulique industrielle ?", "Huile", "Air comprimé", 1],
    // ---- niveau 2 ----
    ["Fréquence de rotation N (tr/min) = ?", "1000 · Vc / (π · D)", "π · D · Vc / 1000", 2],
    ["Fraisage en avalant : les dents vont…", "dans le sens de l'avance", "contre l'avance", 2],
    ["Unité de l'avance par dent fz ?", "mm/dent", "mm/min", 2],
    ["Vitesse d'avance Vf = ?", "fz · Z · N", "fz · N / Z", 2],
    ["Agrandir un trou au tour ?", "Alésage", "Chariotage", 2],
    ["Outil pour finir un trou en H7 ?", "Alésoir", "Foret à centrer", 2],
    ["Outil de la rectification ?", "Meule", "Fraise", 2],
    ["Électroérosion : la matière part par…", "étincelles", "jet d'eau", 2],
    ["ARS signifie…", "Acier rapide supérieur", "Alliage résistant spécial", 2],
    ["Vc en carbure, comparée à l'ARS ?", "Plus élevée", "Plus faible", 2],
    ["Plaquette carbure : surtout du…", "carbure de tungstène", "carbure de silicium", 2],
    ["Axe Z d'un tour à CN ?", "Axe de la broche", "Perpendiculaire à la broche", 2],
    ["G02 en code ISO ?", "Cercle sens horaire", "Cercle sens trigo", 2],
    ["M03 en code ISO ?", "Broche sens horaire", "Arrêt broche", 2],
    ["M06 en code ISO ?", "Changement d'outil", "Fin de programme", 2],
    ["Ajustement H7/g6 ?", "Avec jeu", "Serré", 2],
    ["Ajustement H7/p6 ?", "Serré", "Avec jeu", 2],
    ["Tolérance ISO : la lettre H désigne…", "l'alésage normal", "l'arbre normal", 2],
    ["Dans H7, le 7 indique…", "la qualité (IT)", "la position", 2],
    ["Symbole GPS de la planéité ?", "Un parallélogramme", "Deux traits parallèles", 2],
    ["Symbole GPS de la coaxialité ?", "Deux cercles concentriques", "Un cercle seul", 2],
    ["Symbole de la perpendicularité ?", "⊥", "∥", 2],
    ["Symbole de la rectitude ?", "Un trait —", "Deux traits //", 2],
    ["Référence (datum) en GPS ?", "Une lettre encadrée", "Un chiffre encadré", 2],
    ["Ra est l'écart…", "moyen arithmétique", "maximal du profil", 2],
    ["Vue de dessus (méthode européenne) ?", "Sous la vue de face", "Au-dessus de la vue de face", 2],
    ["Perspective isométrique : angle entre axes ?", "120°", "90°", 2],
    ["Plan de coupe : trait…", "mixte, fort aux extrémités", "interrompu fin", 2],
    ["« SR » devant une cote ?", "Rayon de sphère", "Surface rectifiée", 2],
    ["Pas d'une vis M6 (pas gros) ?", "1 mm", "0,75 mm", 2],
    ["Perçage avant taraudage M10 ?", "Ø 8,5 mm", "Ø 10 mm", 2],
    ["Un tampon lisse contrôle…", "un alésage", "un arbre", 2],
    ["Une bague lisse contrôle…", "un arbre", "un alésage", 2],
    ["Les cales étalons sont dites…", "Johansson", "Brinell", 2],
    ["MMT signifie…", "Machine à mesurer tridimensionnelle", "Mesure multi-têtes", 2],
    ["Le comparateur fait une mesure…", "relative (un écart)", "absolue", 2],
    ["Degrés de liberté d'un pivot glissant ?", "2", "1", 2],
    ["Degrés de liberté d'un appui plan ?", "3", "2", 2],
    ["Degrés de liberté d'une hélicoïdale ?", "1", "2", 2],
    ["Degrés de liberté d'une sphère-plan ?", "5", "4", 2],
    ["Solide soumis à 2 forces : elles sont…", "directement opposées", "perpendiculaires", 2],
    ["3 forces non parallèles en équilibre ?", "Concourantes", "Parallèles", 2],
    ["Frottement de Coulomb : T ≤ ?", "f · N", "N / f", 2],
    ["Puissance d'une rotation P = ?", "C · ω", "C / ω", 2],
    ["ω (rad/s) à partir de N (tr/min) ?", "π · N / 30", "30 · N / π", 2],
    ["Vitesse d'un point à R de l'axe ?", "R · ω", "ω / R", 2],
    ["Diamètre primitif d'une roue dentée ?", "m · Z", "m / Z", 2],
    ["Système souvent irréversible ?", "Roue et vis sans fin", "Engrenage droit", 2],
    ["Une butée à billes supporte une charge…", "axiale", "radiale", 2],
    ["Un accouplement élastique compense…", "les désalignements", "les surcharges de vitesse", 2],
    ["Rôle d'une rondelle Grower ?", "Freinage", "Étanchéité", 2],
    ["S235 : que vaut 235 ?", "Re mini (MPa)", "Rm (MPa)", 2],
    ["C45 : teneur en carbone ?", "0,45 %", "45 %", 2],
    ["Fonte : teneur en carbone ?", "Plus de 2 %", "Moins de 0,5 %", 2],
    ["Effet principal d'un recuit ?", "Adoucir", "Durcir", 2],
    ["But du revenu après trempe ?", "Réduire la fragilité", "Augmenter la dureté", 2],
    ["Cémentation : apport de…", "carbone", "azote", 2],
    ["Nitruration : apport de…", "azote", "carbone", 2],
    ["Galvanisation : dépôt de…", "zinc", "chrome", 2],
    ["L'anodisation traite surtout…", "l'aluminium", "l'acier", 2],
    ["Polymère thermodurcissable ?", "Époxy", "Polyéthylène", 2],
    ["Polymère thermoplastique ?", "PVC", "Bakélite", 2],
    ["Le PTFE, c'est le…", "Téflon", "Plexiglas", 2],
    ["Le PMMA, c'est le…", "Plexiglas", "Téflon", 2],
    ["Fusion de l'aluminium ≈ ?", "660 °C", "1 500 °C", 2],
    ["Gaz parfait : PV = ?", "nRT", "nR / T", 2],
    ["Adiabatique : aucun échange de…", "chaleur", "travail", 2],
    ["1er principe : conservation de…", "l'énergie", "l'entropie", 2],
    ["Chaleur massique de l'eau ≈ ?", "4 180 J/(kg·K)", "418 J/(kg·K)", 2],
    ["Loi de la conduction thermique ?", "Fourier", "Ohm", 2],
    ["Meilleur conducteur thermique ?", "Cuivre", "Acier inox", 2],
    ["Soudage MIG : le gaz est…", "inerte", "actif", 2],
    ["Moulage au sable : le moule est…", "détruit à chaque pièce", "permanent", 2],
    ["Impression FDM : on dépose…", "un fil fondu", "de la poudre", 2],
    ["Impression SLS : on fritte…", "de la poudre", "un fil fondu", 2],
    ["Distributeur 5/2 : le 5 compte…", "les orifices", "les positions", 2],
    ["Distributeur 5/2 : le 2 compte…", "les positions", "les orifices", 2],
    ["TRS : taux de rendement…", "synthétique", "standard", 2],
    ["5S : « Seiri » veut dire…", "trier", "nettoyer", 2],
    ["5S : « Seiso » veut dire…", "nettoyer", "ranger", 2],
    ["Le Kanban organise un flux…", "tiré", "poussé", 2],
    ["SMED : réduire le temps de…", "changement de série", "livraison", 2],
    ["MTBF : temps moyen…", "entre pannes", "de réparation", 2],
    ["MTTR : temps moyen…", "de réparation", "entre pannes", 2],
    ["AMDEC : on étudie les…", "modes de défaillance", "coûts de revient", 2],
    ["ISO 14001 concerne…", "l'environnement", "la qualité", 2],
    ["Le Cp mesure…", "la capabilité", "la cadence", 2],
    ["Carte de contrôle (MSP) : on surveille…", "un procédé", "un stock", 2],
    ["Moteur asynchrone : il tourne…", "sous le synchronisme", "au synchronisme", 2],
    ["Contrainte de cisaillement τ = ?", "T / S", "T · S", 2],
    ["Unité d'un moment quadratique ?", "mm⁴", "mm²", 2],
    ["Fibre de composite la plus rigide ?", "Carbone", "Verre", 2],
    // ---- niveau 3 ----
    ["Flexion : σ max = ?", "Mf · v / I", "Mf · I / v", 3],
    ["Moment quadratique d'un disque Ø d ?", "π · d⁴ / 64", "π · d⁴ / 32", 3],
    ["Moment polaire I0 d'un disque Ø d ?", "π · d⁴ / 32", "π · d⁴ / 64", 3],
    ["Torsion : τ max = ?", "Mt · R / I0", "Mt · I0 / R", 3],
    ["Coefficient de sécurité s = ?", "Re / σ max", "σ max / Re", 3],
    ["Poutre sur 2 appuis, F au milieu : Mf max ?", "F · L / 4", "F · L / 2", 3],
    ["Poutre encastrée, F au bout : Mf max ?", "F · L", "F · L / 4", 3],
    ["Coefficient de Poisson de l'acier ?", "≈ 0,3", "≈ 0,5", 3],
    ["Module de Coulomb G = ?", "E / 2(1 + ν)", "E / (1 + ν)", 3],
    ["Ressorts en série : la raideur…", "diminue", "augmente", 3],
    ["Ressorts en parallèle : k = ?", "k1 + k2", "k1·k2 / (k1 + k2)", 3],
    ["Varignon : V(B) = V(A) + …", "BA ∧ Ω", "AB ∧ Ω", 3],
    ["Accélération normale an = ?", "R · ω²", "R · ω", 3],
    ["CIR signifie…", "Centre instantané de rotation", "Cercle intérieur de référence", 3],
    ["Degrés de liberté d'une linéaire annulaire ?", "4", "3", 3],
    ["Degrés de liberté d'une linéaire rectiligne ?", "4", "3", 3],
    ["Rapport ωs / ωe d'un engrenage ?", "Z menant / Z mené", "Z mené / Z menant", 3],
    ["Entraxe de deux roues dentées ?", "m (Z1 + Z2) / 2", "m (Z1 + Z2)", 3],
    ["Synchronisme à 50 Hz, 2 paires de pôles ?", "1 500 tr/min", "3 000 tr/min", 3],
    ["Vérin Ø 50 mm à 6 bar : force ≈ ?", "1 180 N", "118 N", 3],
    ["Rendement de Carnot ?", "1 − Tf / Tc", "Tf / Tc", 3],
    ["Unité de l'entropie ?", "J/K", "J", 3],
    ["Pas d'une vis M10 (pas gros) ?", "1,5 mm", "1,25 mm", 3],
    ["Perçage avant taraudage M8 ?", "Ø 6,8 mm", "Ø 7,5 mm", 3],
    ["Ⓔ en cotation : exigence…", "de l'enveloppe", "du maximum de matière", 3],
    ["Ⓜ en cotation : exigence…", "du maximum de matière", "de l'enveloppe", 3],
    ["Symbole du battement simple ?", "Une flèche", "Deux flèches", 3],
    ["Chaîne de cotes : IT de la condition ?", "Somme des IT", "Plus grand des IT", 3],
    ["Vue de dessus (méthode américaine) ?", "Au-dessus de la vue de face", "Sous la vue de face", 3],
    ["Structure d'un acier trempé ?", "Martensite", "Ferrite", 3],
    ["Perlite = ferrite + …", "cémentite", "martensite", 3],
    ["Eutectoïde fer-carbone : teneur ?", "≈ 0,8 % C", "≈ 4,3 % C", 3],
    ["Pénétrateur de la dureté Rockwell C ?", "Cône en diamant", "Bille en acier", 3],
    ["42CrMo4 : acier…", "faiblement allié", "non allié", 3],
    ["X5CrNi18-10 : acier…", "fortement allié", "faiblement allié", 3],
    ["AMDEC : criticité C = ?", "G × F × D", "G + F + D", 3],
    ["Takt time = ?", "Temps dispo / demande", "Demande / temps dispo", 3],
    ["Cp minimal souvent exigé ?", "1,33", "0,5", 3],
    ["Bague tournante / charge : montage…", "serré", "glissant", 3],
    ["Roulement à contact oblique : charges…", "radiales et axiales", "radiales seulement", 3],
    ["Rendement de 2 étages en série ?", "η1 × η2", "η1 + η2", 3],
    ["Alliage à mémoire de forme ?", "Ni-Ti", "Cu-Zn", 3],
  ];
  D.QUESTIONS = Q;

  /* ---------- difficultés : vies, temps des énigmes, vitesse des pièges ---------- */
  D.DIFFS = {
    easy:   { id: 'easy', name: 'Calme', color: '#6fd37a', desc: '5 vies. Pièges plus lents, plus de temps pour réfléchir.', lives: 5, time: 1.35, speed: 0.85, mult: 0.7 },
    normal: { id: 'normal', name: 'Normal', color: '#ffd24a', desc: '3 vies. Les salles se corsent au fil du couloir.', lives: 3, time: 1, speed: 1, mult: 1 },
    hard:   { id: 'hard', name: 'Panique', color: '#ff4a5e', desc: 'Une seule vie. Pièges rapides, chrono serré.', lives: 1, time: 0.75, speed: 1.15, mult: 1.5 },
  };

  /* =====================================================================
     2. DIMENSIONS, DÉPLACEMENT, PLAN DE LA PARTIE
     ===================================================================== */
  const SAS = 1.4, DW = 1.1, DH = 2.3, DX = 1.15, R_PL = 0.3, MAXR = 400;
  // déplacement propre à ce jeu (pas de dash : les parcours doivent rester des parcours)
  const MV = { walk: 5.2, sprint: 8.2, crouch: 2.6, slide: 10.5, jump: 7.2, grav: 20, eye: 1.6, eyeC: 0.98, hS: 1.78, hC: 1.12, step: 0.42 };
  const FONT = '"Segoe UI", Arial, sans-serif';
  const popcount = m => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };

  // types de salles : nom affiché, objectif, thème visuel, première salle possible, énigme partagée, chronomètre
  const TYPES = {
    start:     { name: 'Le hall', goal: 'Avance jusqu\'à la porte. Tout va bien se passer. Probablement.', theme: 'school', min: 1e9 },
    rest:      { name: 'Salle de pause', goal: 'Ici, rien ne te mangera. Le distributeur offre une vie (E).', theme: 'school', min: 1e9 },
    quiz:      { name: 'La question', goal: '', theme: 'school', min: 1, timer: true },
    parkour:   { name: 'Le sol est de la lave', goal: 'Saute de plateforme en plateforme. La lave, ça brûle.', theme: 'lava', min: 1 },
    collapse:  { name: 'Le plancher pourri', goal: 'Les planches cèdent sous tes pieds. Ne t\'arrête surtout pas !', theme: 'void', min: 3 },
    redlight:  { name: '1, 2, 3… soleil', goal: 'Avance au VERT. Au ROUGE : statue ! Les piliers te cachent.', theme: 'gym', min: 2 },
    maze:      { name: 'Le labyrinthe éteint', goal: 'Trouve la sortie à la lampe torche. Quelque chose rôde…', theme: 'dark', min: 5 },
    keys:      { name: 'Le trousseau', goal: 'Trouve la clé du cadenas (E pour la prendre), puis va à la porte.', theme: 'school', min: 2, puzzle: true, timer: true },
    trapdoors: { name: 'Les portes piégées', goal: 'Une seule porte est la bonne. Lis les indices !', theme: 'school', min: 3, puzzle: true },
    lasers:    { name: 'Épilation laser', goal: 'Saute (Espace), baisse-toi (C), passe au bon moment.', theme: 'lab', min: 2 },
    chase:     { name: 'COURS !', goal: 'Quelque chose arrive derrière toi. Cours jusqu\'à la porte !', theme: 'school', min: 4 },
    eyes:      { name: 'Ne le regarde pas', goal: 'Traverse sans regarder l\'entité. Elle est timide… et méchante.', theme: 'library', min: 5 },
    hide:      { name: 'Cache-cache', goal: 'Quand les lumières clignotent, cache-toi dans une armoire (E) !', theme: 'school', min: 4, puzzle: true },
    code:      { name: 'Le digicode', goal: 'Trouve les 4 chiffres cachés dans la salle, puis tape le code près de la porte.', theme: 'school', min: 6, puzzle: true, timer: true },
    switches:  { name: 'Les interrupteurs', goal: 'Allume toutes les ampoules au-dessus de la porte (E sur les leviers).', theme: 'school', min: 3, puzzle: true, timer: true },
  };
  D.TYPES = TYPES;
  // salles à thème : une toutes les 5 questions (salles 6, 12, 18…), tirées sans répétition dans ce sac
  const THEME_EVERY = 6;
  const POOL = ['parkour', 'collapse', 'redlight', 'maze', 'keys', 'trapdoors', 'lasers', 'chase', 'eyes', 'hide', 'code', 'switches'];
  const minW = pl => 2 * Math.abs(pl.en) + DW + 0.7;   // la porte d'entrée (= sortie de la salle d'avant) doit tenir dans la largeur

  /**
   * Plan complet d'une partie, identique chez tous les joueurs (même graine) :
   * pour chaque salle k : type, niveau (0 → 1), largeur W, longueur L, hauteur H, x de la porte d'entrée (en) et de sortie (ex),
   * z de son mur d'entrée (z0, la salle s'étend vers −z) et les données propres à son type.
   * force (tests) : liste de types imposés à partir de la salle 1.
   */
  function makePlan(seed, force) {
    const rng = BR.rngFrom((seed ^ 0x2545f491) >>> 0);
    // ordre des questions : les simples d'abord, puis les plus dures arrivent
    const tiers = [1, 2, 3].map(t => BR.shuffle(Q.map((q, i) => i).filter(i => Q[i][3] === t), rng));
    const qOrder = [];
    for (let n = 0; qOrder.length < Q.length; n++) {
      const p3 = BR.clamp((n - 4) / 12, 0, 0.45), p2 = BR.clamp((n - 1) / 5, 0, 0.75) * (1 - p3);
      const x = rng(); let t = x < p3 ? 2 : x < p3 + p2 ? 1 : 0;
      if (!tiers[t].length) t = [t, 1, 0, 2].find(i => tiers[i].length);
      qOrder.push(tiers[t].pop());
    }
    const rooms = []; let z = 0, ex = 0, bag = [], last = [], nq = 0;
    for (let k = 0; k < MAXR; k++) {
      let type;
      // rythme voulu par l'utilisateur : 5 questions, puis une salle à thème (défi), et ainsi de suite.
      // Une salle de pause remplace une salle à thème sur quatre.
      if (k === 0) type = 'start';
      else if (force && force.length) type = force[(k - 1) % force.length];
      else if (k % THEME_EVERY) type = 'quiz';
      else if ((k / THEME_EVERY) % 4 === 0) type = 'rest';
      else {
        const ok = t => TYPES[t].min <= k && !last.includes(t);
        let i = bag.findIndex(ok);
        if (i < 0) { bag = BR.shuffle(POOL.slice(), rng); i = bag.findIndex(ok); }
        type = i < 0 ? 'parkour' : bag.splice(i, 1)[0];
      }
      // niveau 0 → 1 : les questions durcissent sur ~25 salles, les salles à thème sur ~9 passages (salle 6 facile, salle 54 au maximum)
      const lvl = force || type === 'quiz' ? (k - 1) / 24 : (k / THEME_EVERY - 1) / 8;
      const pl = { k, type, lvl: BR.clamp(lvl, 0, 1), en: ex, ex: 0, W: 4.4, L: 12, H: 3.4, seed: (rng() * 4294967296) >>> 0 };
      if (type === 'quiz') pl.q = qOrder[nq++ % qOrder.length];
      TYPES[type].plan(pl, BR.rngFrom((pl.seed ^ 0x6c8e9cf5) >>> 0));
      pl.W = Math.max(pl.W, minW(pl));
      pl.ex = BR.clamp(pl.ex, -pl.W / 2 + DW / 2 + 0.3, pl.W / 2 - DW / 2 - 0.3);
      pl.z0 = z; z -= pl.L + SAS; ex = pl.ex;
      rooms.push(pl); last = [type, last[0]];
    }
    return { rooms };
  }
  D._plan = (seed, force) => makePlan(seed >>> 0, force).rooms.map(p => p.type);

  /* ---------- énigme des portes piégées : indices logiques qui ne laissent qu'une porte ---------- */
  const DCOL = [['rouge', '#b8312a'], ['bleue', '#2b5fbf'], ['verte', '#2f8f45'], ['jaune', '#d6b02a'], ['violette', '#7d3fb5'], ['orange', '#d9741f']];
  function riddle(n, c, rng) {
    const cols = BR.shuffle(DCOL.slice(), rng).slice(0, n), nm = i => cols[i][0];
    const gen = [];
    for (let i = 0; i < n; i++) {
      gen.push({ t: 'Ce n\'est pas la porte ' + nm(i) + '.', f: j => j !== i, w: 1 });
      gen.push({ t: 'Elle est à gauche de la porte ' + nm(i) + '.', f: j => j < i, w: 2 });
      gen.push({ t: 'Elle est à droite de la porte ' + nm(i) + '.', f: j => j > i, w: 2 });
      gen.push({ t: 'Elle touche la porte ' + nm(i) + '.', f: j => Math.abs(j - i) === 1, w: 2 });
      gen.push({ t: 'Ce n\'est ni la porte ' + nm(i) + ', ni une de ses voisines.', f: j => Math.abs(j - i) > 1, w: 2 });
    }
    gen.push({ t: 'Elle n\'est pas tout au bord.', f: j => j > 0 && j < n - 1, w: 2 });
    gen.push({ t: 'Elle est tout au bord.', f: j => j === 0 || j === n - 1, w: 2 });
    let cand = [...Array(n).keys()];
    const clues = [];
    // les indices « relatifs » d'abord (plus amusants), les « ce n'est pas la X » pour finir
    const pool = BR.shuffle(gen.filter(g => g.f(c)), rng).sort((a, b) => b.w - a.w);
    for (const g of pool) {
      const nc = cand.filter(g.f); if (nc.length === cand.length || !nc.length) continue;
      if (nc.length === 1 && clues.length === 0 && n > 3) continue;   // pas d'indice qui donne tout d'un coup
      clues.push(g.t); cand = nc;
      if (cand.length === 1 || clues.length >= 3) break;
    }
    while (cand.length > 1) { const w = cand.find(j => j !== c); clues.push('Ce n\'est pas la porte ' + nm(w) + '.'); cand = cand.filter(j => j !== w); }
    return { cols, clues };
  }

  /* ---------- plan propre à chaque type (dimensions + données tirées avec la graine de la salle) ---------- */
  const KCOL = [['rouge', '#d8342c'], ['bleue', '#2f72e8'], ['verte', '#2fae4c'], ['jaune', '#f0c62a']];
  const KSYM = ['★', '●', '▲', '■'], KSYMN = ['étoile', 'rond', 'triangle', 'carré'];
  TYPES.start.plan = pl => { pl.W = 4.4; pl.L = 10; pl.ex = 0; };
  TYPES.rest.plan = pl => { pl.W = 5.4; pl.L = 9; pl.ex = 0; };
  TYPES.quiz.plan = (pl, r) => { pl.W = 4.4; pl.L = 13; pl.good = r() < 0.5 ? 0 : 1; pl.ex = pl.good ? DX : -DX; };
  TYPES.parkour.plan = (pl, r) => {
    const lv = pl.lvl; pl.W = Math.max(6.4, minW(pl)); pl.H = 6; const HX = pl.W / 2;
    const n = 6 + Math.round(lv * 5) + ((r() * 2) | 0), plats = [];
    let u = 2.4, x = pl.en, y = 0;
    for (let i = 0; i < n; i++) {
      const sz = BR.lerp(1.8, 1.05, lv) + r() * 0.5, sx = BR.lerp(2.0, 1.05, lv) + r() * 0.5;
      let ny = BR.clamp(y + (r() - 0.45) * BR.lerp(0.6, 1.5, lv), -0.4, 1.4); if (ny - y > 0.8) ny = y + 0.8;
      let gap = BR.lerp(0.9, 2.1, lv) + r() * 0.6; if (ny - y > 0.45) gap = Math.min(gap, 1.5);
      const mv = lv > 0.3 && i > 0 && i < n - 1 && r() < 0.18 + lv * 0.35;
      const w = mv ? Math.min(sx, 1.4) : sx;
      const nx = mv ? 0 : BR.clamp(x + (r() - 0.5) * BR.lerp(2.2, 4.2, lv), -HX + w / 2 + 0.3, HX - w / 2 - 0.3);
      const p = { u0: u + gap, u1: u + gap + sz, x: nx, sx: w, y: ny };
      if (mv) { p.ax = Math.min(HX - w / 2 - 0.35, 1.0 + r() * 1.2); p.per = BR.lerp(4.2, 2.8, lv) + r(); p.ph = r() * 6.283; }
      plats.push(p); u = p.u1; x = nx; y = ny;
    }
    pl.plats = plats; pl.L = u + 1.5 + 2.4; pl.ex = BR.clamp(x * 0.5, -1.5, 1.5);
  };
  TYPES.collapse.plan = (pl, r) => {
    const lv = pl.lvl, T = 1.25;
    const cols = Math.max(4, Math.ceil(minW(pl) / T)), rows = 8 + Math.round(lv * 6);
    pl.W = cols * T; pl.L = 2.2 + rows * T + 2.2; pl.H = 4; pl.cols = cols; pl.rows = rows; pl.T = T;
    const tiles = []; let pc = (r() * cols) | 0;
    for (let j = 0; j < rows; j++) {
      if (j) pc = BR.clamp(pc + ((r() * 3) | 0) - 1, 0, cols - 1);
      for (let i = 0; i < cols; i++) tiles.push(i === pc || r() > 0.12 + lv * 0.33 ? 1 : 0);
    }
    pl.tiles = tiles; pl.delay = BR.lerp(0.8, 0.4, lv); pl.ex = 0;
  };
  TYPES.redlight.plan = (pl, r) => {
    const lv = pl.lvl; pl.W = Math.max(10, minW(pl)); pl.L = 20 + Math.round(lv * 8); pl.H = 6; pl.ex = 0;
    const segs = []; let tot = 0;
    for (let i = 0; i < 12; i++) { const g = BR.lerp(2.6, 1.2, lv) + r() * BR.lerp(1.6, 1.2, lv), rd = 1.8 + r() * 1.4; segs.push(g, rd); tot += g + rd; }
    pl.segs = segs; pl.tot = tot;
    const nc = 3 + ((r() * 3) | 0); pl.cover = [];
    for (let i = 0; i < nc; i++) pl.cover.push({ u: 4.5 + (i + 0.5) * (pl.L - 9) / nc + (r() - 0.5) * 1.2, x: (r() - 0.5) * (pl.W - 3.5) });
    pl.side = r() < 0.5 ? -1 : 1;
  };
  TYPES.maze.plan = (pl, r) => {
    const lv = pl.lvl, C = 2.4;
    const cols = Math.max(5, Math.ceil(minW(pl) / C)), rows = 5 + Math.round(lv * 3);
    pl.W = cols * C; pl.L = 1.6 + rows * C + 1.6; pl.H = 2.9; pl.cols = cols; pl.rows = rows; pl.C = C;
    const N = cols * rows, seen = new Uint8Array(N), wallE = new Uint8Array(N).fill(1), wallS = new Uint8Array(N).fill(1);
    const st = [(r() * cols) | 0]; seen[st[0]] = 1;
    while (st.length) {   // labyrinthe parfait (parcours en profondeur)
      const c = st[st.length - 1], i = c % cols, j = (c / cols) | 0, nb = [];
      if (i > 0 && !seen[c - 1]) nb.push(c - 1); if (i < cols - 1 && !seen[c + 1]) nb.push(c + 1);
      if (j > 0 && !seen[c - cols]) nb.push(c - cols); if (j < rows - 1 && !seen[c + cols]) nb.push(c + cols);
      if (!nb.length) { st.pop(); continue; }
      const n = nb[(r() * nb.length) | 0];
      if (n === c + 1) wallE[c] = 0; else if (n === c - 1) wallE[n] = 0; else if (n === c + cols) wallS[c] = 0; else wallS[n] = 0;
      seen[n] = 1; st.push(n);
    }
    for (let t = 0; t < Math.round(N * 0.07); t++) { const c = (r() * N) | 0; if (c % cols < cols - 1) wallE[c] = 0; }   // quelques boucles
    pl.wallE = wallE; pl.wallS = wallS;
    pl.inCol = BR.clamp(Math.floor((pl.en + pl.W / 2) / C), 0, cols - 1);
    pl.outCol = (r() * cols) | 0; pl.ex = -pl.W / 2 + (pl.outCol + 0.5) * C;
    pl.hunt = lv > 0.1; pl.huntSpeed = BR.lerp(1.7, 2.7, lv);
  };
  TYPES.keys.plan = (pl, r) => {
    const lv = pl.lvl; pl.W = Math.max(8, minW(pl)); pl.L = 12; pl.ex = 0;
    const n = 4 + Math.round(lv * 4), all = [];
    for (let c = 0; c < 4; c++) for (let s = 0; s < 4; s++) all.push([c, s]);
    const tgt = all[(r() * 16) | 0];
    const near = BR.shuffle(all.filter(a => (a[0] === tgt[0]) !== (a[1] === tgt[1])), r);   // même couleur OU même forme : on peut se tromper
    const far = BR.shuffle(all.filter(a => a[0] !== tgt[0] && a[1] !== tgt[1]), r);
    const nn = Math.min(near.length, Math.ceil((n - 1) * BR.lerp(0.5, 0.85, lv)));
    pl.keys = BR.shuffle([tgt].concat(near.slice(0, nn), far.slice(0, n - 1 - nn)), r).map(a => ({ c: a[0], s: a[1] }));
    pl.tgt = { c: tgt[0], s: tgt[1] }; pl.limit = BR.lerp(55, 38, lv);
  };
  TYPES.trapdoors.plan = (pl, r) => {
    const lv = pl.lvl, n = 3 + (lv > 0.35 ? 1 : 0) + (lv > 0.75 ? 1 : 0), sp = 1.6;
    pl.W = Math.max(n * sp + 1.4, 7); pl.L = 10;
    pl.xs = []; for (let i = 0; i < n; i++) pl.xs.push((i - (n - 1) / 2) * sp);
    pl.good = (r() * n) | 0; pl.ex = pl.xs[pl.good];
    const rd = riddle(n, pl.good, r); pl.cols = rd.cols; pl.clues = rd.clues;
    pl.traps = pl.xs.map((x, i) => i === pl.good ? '' : ['glove', 'monster', 'brick'][(r() * 3) | 0]);
    if (!pl.traps.includes('glove')) pl.traps[pl.good === 0 ? 1 : 0] = 'glove';
  };
  TYPES.lasers.plan = (pl, r) => {
    const lv = pl.lvl; pl.W = 5; pl.H = 3.2; pl.ex = 0;
    const n = 5 + Math.round(lv * 5);
    const kinds = lv < 0.2 ? ['low', 'high', 'blink'] : lv < 0.5 ? ['low', 'high', 'blink', 'sweepY', 'double'] : ['low', 'high', 'blink', 'sweepY', 'sweepX', 'double', 'sweepX'];
    const L = []; let u = 3;
    for (let i = 0; i < n; i++) {
      const kd = i === 0 ? 'low' : i === 1 ? 'high' : kinds[(r() * kinds.length) | 0];
      L.push({ kind: kd, u: u + 0.6, ph: r() * 10, per: BR.lerp(2.6, 1.8, lv) + r() * 0.6 });
      u += kd === 'double' ? 3.0 : 2.4;
    }
    pl.lasers = L; pl.L = u + 2.6;
  };
  TYPES.chase.plan = (pl, r) => {
    const lv = pl.lvl; pl.W = 5; pl.L = 30 + Math.round(lv * 10); pl.ex = 0;
    const obs = []; let u = 6;
    while (u < pl.L - 4.5) { obs.push({ kind: ['desk', 'lockers', 'pipe', 'desk', 'table', 'lockers'][(r() * 6) | 0], u, side: r() < 0.5 ? -1 : 1, f: r() }); u += 3.8 + r() * 2; }
    pl.obs = obs; pl.speed = BR.lerp(6.2, 7.4, lv);
  };
  TYPES.eyes.plan = (pl, r) => {
    const lv = pl.lvl; pl.W = 8; pl.L = 18 + Math.round(lv * 5); pl.H = 4; pl.ex = 0;
    const sh = []; let side = r() < 0.5 ? -1 : 1;
    for (let u = 3.6; u < pl.L - 3; u += 3.3 + r() * 0.8) { sh.push({ u, side, len: pl.W * (0.5 + r() * 0.12) }); side = -side; }
    pl.shelves = sh; pl.n = lv > 0.55 ? 2 : 1; pl.fill = BR.lerp(1.2, 0.75, lv); pl.ph = r() * 10;
  };
  TYPES.hide.plan = (pl, r) => {
    const lv = pl.lvl; pl.W = 5.2; pl.L = 24 + Math.round(lv * 6); pl.ex = 0;
    pl.wards = []; for (let u = 3.4; u < pl.L - 2.6; u += 3.0 + r() * 0.8) pl.wards.push({ u, side: pl.wards.length % 2 ? 1 : -1 });
    pl.n = lv > 0.45 ? 2 : 1; pl.first = 6.5 + r() * 2.5; pl.gap = 8 + r() * 3; pl.warn = BR.lerp(3.4, 2.4, lv);
  };
  TYPES.code.plan = (pl, r) => {
    const lv = pl.lvl; pl.W = 7.5; pl.L = 12; pl.ex = 0;
    pl.code = [0, 1, 2, 3].map(() => (r() * 10) | 0); pl.decoy = lv > 0.3; pl.limit = BR.lerp(70, 50, lv);
  };
  TYPES.switches.plan = (pl, r) => {
    const lv = pl.lvl; pl.W = 7; pl.L = 11; pl.ex = 0;
    const n = lv > 0.45 ? 5 : 4, full = (1 << n) - 1, masks = [];
    for (let i = 0; i < n; i++) { let mk = 0; const c = 1 + ((r() * Math.min(3, n - 1)) | 0); while (popcount(mk) < c) mk |= 1 << ((r() * n) | 0); masks.push(mk); }
    let s0 = full;
    while (s0 === full) { let x = 0; for (let i = 0; i < n; i++) if (r() < 0.5) x ^= masks[i]; s0 = full ^ x; }
    pl.n = n; pl.masks = masks; pl.s0 = s0; pl.show = lv < 0.5; pl.limit = BR.lerp(60, 45, lv);
  };

  /* ---------- échecs : titres et phrases (pour rire un peu) ---------- */
  const FAILS = {
    lava:   { t: 'FONDU', s: ['Le sol était de la lave. On t\'avait prévenu.', 'Tu as fondu comme une raclette.', 'Plouf. Mais en très, très chaud.', 'Petit conseil : la lave, ça ne se traverse pas à pied.'], meme: 'cartoon_scream' },
    void:   { t: 'AAAAAAH', s: ['Gravité : 1 — Toi : 0.', 'Le vide te remercie de ta visite.', 'Tu cherchais le fond ? Il n\'y en a pas.', 'Les planches pourries, c\'est pas fait pour danser.'], meme: 'woooaah' },
    zap:    { t: 'GRILLÉ', s: ['Épilation laser : réussie. Survie : ratée.', 'Bien cuit, comme une merguez.', 'Bzzzt. Ça sent le poulet grillé.'], meme: 'aaaah' },
    seen:   { t: 'IL T\'A VU', s: ['Tu as bougé. Il a TOUT vu.', 'Soleil… et toi tu dansais la macarena.', 'Statue, on a dit. STATUE.'], meme: 'sus' },
    look:   { t: 'TU L\'AS REGARDÉ', s: ['Il est très timide. Et très rancunier.', 'Contact visuel : très mauvaise idée.', 'On t\'avait dit de regarder tes pieds.'] },
    caught: { t: 'ATTRAPÉ', s: ['Il court plus vite que toi. Surprise !', 'Câlin non consenti.', 'Fallait courir plus vite. Ou mieux.'] },
    rush:   { t: 'PERCUTÉ', s: ['L\'armoire, c\'était pas pour décorer.', 'Ratatiné par l\'entité TGV.', 'Il fallait se cacher. Maintenant tu es plat.'] },
    punch:  { t: 'BAFFE', s: ['Gant de boxe surprise ! Mauvaise porte.', 'K.O. technique par une porte.', 'Celle-là, c\'était la porte à baffes.'], meme: 'tomfoolery' },
    wrong:  { t: 'MAUVAISE RÉPONSE', s: ['Elle s\'est détachée de la porte… et elle court vite.', 'Retourne réviser. Si tu peux.', 'Le prof est très déçu.'] },
    dark:   { t: 'DANS LE NOIR', s: ['Ce n\'était pas la bonne porte…', 'Le noir n\'a pas de sortie.'] },
    time:   { t: 'TEMPS ÉCOULÉ', s: ['Trop lent ! Quelque chose sort de la mauvaise porte.', 'Le chrono, c\'était pour de vrai.'] },
    keeper: { t: 'LE GARDIEN', s: ['Trop lent : le gardien de la salle est arrivé.', 'Le temps était compté. Lui, il comptait sur toi.'] },
  };

  /* =====================================================================
     3. TEXTURES DESSINÉES PAR CODE
     ===================================================================== */
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function grain(g, w, h, a, r) {
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
  }
  // tache radiale, répétée de l'autre côté des bords (texture raccordable)
  function blob(g, x, y, rad, col, a, SW, SH) {
    for (const ox of SW ? [-SW, 0, SW] : [0]) for (const oy of SH ? [-SH, 0, SH] : [0]) {
      const cx = x + ox, cy = y + oy;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
  }
  function tex(c, rep) {
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // sol : vieux carrelage vinyle d'école en damier, marbré, joints sales, traces de semelles (2,4 m de côté)
  function paintFloor() {
    const S = 1024, T = 128, c = cv(S, S), g = c.getContext('2d'), r = BR.rngFrom(11);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const dark = (i + j) % 2 === 1, b = dark ? [112, 121, 104] : [190, 180, 152], v = (r() - 0.5) * 16;
      g.fillStyle = 'rgb(' + ((b[0] + v) | 0) + ',' + ((b[1] + v) | 0) + ',' + ((b[2] + v * 0.8) | 0) + ')';
      g.fillRect(i * T, j * T, T, T);
      for (let k = 0; k < 90; k++) { const l = r() < 0.5; g.fillStyle = l ? 'rgba(255,250,232,' + (0.05 + r() * 0.14) + ')' : 'rgba(30,28,20,' + (0.05 + r() * 0.14) + ')'; const s = 1 + r() * 3; g.fillRect(i * T + r() * T, j * T + r() * T, s, s); }
      g.lineWidth = 2;
      for (let k = 0; k < 3; k++) { g.strokeStyle = 'rgba(70,62,48,' + (0.05 + r() * 0.08) + ')'; const x = i * T + 10 + r() * (T - 20), y = j * T + 10 + r() * (T - 20); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + r() * 40 - 20, y + r() * 40 - 20, x + r() * 50 - 25, y + r() * 50 - 25); g.stroke(); }
    }
    g.strokeStyle = 'rgba(28,25,20,0.6)'; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * T, 0); g.lineTo(i * T, S); g.stroke(); g.beginPath(); g.moveTo(0, i * T); g.lineTo(S, i * T); g.stroke(); }
    for (let k = 0; k < 55; k++) { g.strokeStyle = 'rgba(18,16,13,' + (0.08 + r() * 0.22) + ')'; g.lineWidth = 1 + r() * 3; const x = 20 + r() * (S - 40), y = 20 + r() * (S - 40), a = r() * 6.28, l = 6 + r() * 26; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    for (let k = 0; k < 14; k++) blob(g, r() * S, r() * S, 40 + r() * 140, '45,38,22', 0.1 + r() * 0.1, S, S);
    grain(g, S, S, 14, r);
    return c;
  }
  // murs : soubassement laqué vert d'eau, main courante en bois, plâtre crème taché d'humidité (2 m × 3,5 m)
  function paintWall() {
    const w = 512, h = 896, PM = 256, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(23);
    const yRail = h - 1.2 * PM, yBase = h - 0.12 * PM;
    let gr = g.createLinearGradient(0, 0, 0, yRail); gr.addColorStop(0, '#83795a'); gr.addColorStop(0.3, '#ada380'); gr.addColorStop(1, '#bbb290');
    g.fillStyle = gr; g.fillRect(0, 0, w, yRail);
    gr = g.createLinearGradient(0, yRail, 0, yBase); gr.addColorStop(0, '#41695b'); gr.addColorStop(1, '#2d4b41');
    g.fillStyle = gr; g.fillRect(0, yRail, w, yBase - yRail);
    // coulures d'humidité depuis le plafond
    for (let i = 0; i < 8; i++) {
      const x = r() * w, len = 80 + r() * 420, wd = 3 + r() * 16;
      gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(105,80,38,0.38)'); gr.addColorStop(1, 'rgba(105,80,38,0)');
      g.fillStyle = gr; g.fillRect(x, 0, wd, len); if (x + wd > w) g.fillRect(x - w, 0, wd, len);
    }
    for (let i = 0; i < 9; i++) blob(g, r() * w, r() * yRail, 30 + r() * 90, '120,95,50', 0.12 + r() * 0.12, w, 0);
    // salissures à hauteur de main, sur le soubassement
    for (let i = 0; i < 14; i++) blob(g, r() * w, yRail + r() * (yBase - yRail), 10 + r() * 40, '15,20,18', 0.15 + r() * 0.2, w, 0);
    for (let i = 0; i < 80; i++) { const x = r() * w, y = yRail + r() * (yBase - yRail), l = 5 + r() * 40, a = (r() - 0.5) * 0.7; g.strokeStyle = 'rgba(200,225,215,' + (0.06 + r() * 0.16) + ')'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    // fissures fines dans le plâtre
    for (let i = 0; i < 4; i++) { let x = r() * w, y = r() * yRail * 0.8; g.strokeStyle = 'rgba(60,50,35,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 30; y += 6 + r() * 18; g.lineTo(x, y); } g.stroke(); }
    // main courante
    g.fillStyle = '#563a20'; g.fillRect(0, yRail - 18, w, 20); g.fillStyle = 'rgba(255,220,170,0.25)'; g.fillRect(0, yRail - 18, w, 3); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, yRail + 2, w, 4);
    // plinthe
    g.fillStyle = '#241f1a'; g.fillRect(0, yBase, w, h - yBase); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, yBase, w, 2);
    gr = g.createLinearGradient(0, yBase - 40, 0, yBase); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(0, yBase - 40, w, 40);
    grain(g, w, h, 14, r);
    return c;
  }
  // faux plafond en dalles de 60 cm (2,4 m de côté)
  function paintCeiling() {
    const S = 1024, T = 256, c = cv(S, S), g = c.getContext('2d'), r = BR.rngFrom(37);
    g.fillStyle = '#d3cdbd'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const v = (r() - 0.5) * 0.12; g.fillStyle = v > 0 ? 'rgba(255,250,235,' + v + ')' : 'rgba(40,35,20,' + -v + ')'; g.fillRect(i * T, j * T, T, T);
      g.fillStyle = 'rgba(85,80,65,0.32)'; for (let k = 0; k < 320; k++) g.fillRect(i * T + 8 + r() * (T - 16), j * T + 8 + r() * (T - 16), 1.8, 1.8);
      if (r() < 0.14) {   // auréole d'infiltration irrégulière
        const x = i * T + 70 + r() * 110, y = j * T + 70 + r() * 110;
        for (let b = 0; b < 5; b++) { const bx = x + (r() - 0.5) * 60, by = y + (r() - 0.5) * 60, rad = 18 + r() * 36; const gg = g.createRadialGradient(bx, by, rad * 0.3, bx, by, rad); gg.addColorStop(0, 'rgba(130,100,50,0.10)'); gg.addColorStop(0.8, 'rgba(115,82,35,0.16)'); gg.addColorStop(1, 'rgba(115,82,35,0)'); g.fillStyle = gg; g.beginPath(); g.arc(bx, by, rad, 0, 7); g.fill(); }
      }
    }
    for (let i = 0; i <= 4; i++) { g.fillStyle = '#8c8980'; g.fillRect(i * T - 5, 0, 10, S); g.fillRect(0, i * T - 5, S, 10); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(i * T - 5, 0, 2, S); g.fillRect(0, i * T - 5, S, 2); }
    grain(g, S, S, 10, r);
    return c;
  }
  // rangée de 4 casiers métalliques (1,6 m × 1,8 m)
  function paintLockers(col, seed) {
    const w = 512, h = 576, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(51 + seed * 7);
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = i * 128;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, 0, 3, h);
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2; g.strokeRect(x + 9, 9, 110, h - 18);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.strokeRect(x + 11, 11, 110, h - 18);
      for (const y0 of [36, h - 110]) for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(8,8,8,0.78)'; rr(g, x + 30, y0 + k * 12, 68, 6, 3); g.fill(); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x + 30, y0 + k * 12 + 6, 68, 1); }
      g.fillStyle = '#d8d3c4'; g.fillRect(x + 42, 122, 44, 22); g.fillStyle = '#1d1d1d'; g.font = 'bold 15px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(100 + seed * 40 + i * 2 + ((r() * 2) | 0)), x + 64, 134);
      g.fillStyle = '#17191b'; g.fillRect(x + 98, 248, 10, 72); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 98, 248, 2, 72);
      if (r() < 0.35) { g.fillStyle = '#b08a2e'; rr(g, x + 92, 326, 22, 18, 3); g.fill(); g.strokeStyle = '#8d8f91'; g.lineWidth = 3; g.beginPath(); g.arc(x + 103, 326, 7, Math.PI, 0); g.stroke(); }
      for (let k = 0; k < 3; k++) blob(g, x + 20 + r() * 90, 150 + r() * 300, 8 + r() * 20, '0,0,0', 0.18, 0, 0);
      for (let k = 0; k < 18; k++) { g.strokeStyle = 'rgba(230,230,220,' + (0.05 + r() * 0.15) + ')'; g.lineWidth = 1; const sx = x + 14 + r() * 100, sy = 30 + r() * (h - 60); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (r() - 0.5) * 30, sy + (r() - 0.5) * 12); g.stroke(); }
    }
    for (let k = 0; k < 30; k++) blob(g, r() * w, h - r() * 70, 4 + r() * 12, '120,60,20', 0.25 + r() * 0.3, 0, 0);
    grain(g, w, h, 12, r);
    return c;
  }
  // porte de salle de classe (décor latéral) : bois, hublot, poignée, numéro
  function paintClassDoor(num, seed) {
    const w = 256, h = 540, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(80 + seed * 13);
    g.fillStyle = seed % 2 ? '#7d5a3a' : '#8e6c47'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { const x = r() * w; g.strokeStyle = r() < 0.5 ? 'rgba(50,30,15,' + (0.06 + r() * 0.12) + ')' : 'rgba(170,125,80,' + (0.05 + r() * 0.1) + ')'; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 30) g.lineTo(x + Math.sin(y * 0.02 + i) * 3, y); g.stroke(); }
    g.fillStyle = '#202224'; g.fillRect(148, 64, 66, 240);
    let gr = g.createLinearGradient(152, 70, 210, 300); gr.addColorStop(0, '#16222a'); gr.addColorStop(0.5, '#0a0f13'); gr.addColorStop(1, '#1a252c'); g.fillStyle = gr; g.fillRect(154, 70, 54, 228);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(160, 70); g.lineTo(178, 70); g.lineTo(158, 160); g.lineTo(154, 160); g.fill();
    g.fillStyle = '#e8e2d2'; g.fillRect(36, 44, 94, 40); g.strokeStyle = '#555'; g.lineWidth = 2; g.strokeRect(36, 44, 94, 40);
    g.fillStyle = '#222'; g.font = 'bold 22px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, 83, 65);
    g.fillStyle = '#8f9398'; g.fillRect(24, 262, 18, 44); g.fillRect(24, 276, 62, 13); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(24, 276, 62, 3);
    gr = g.createLinearGradient(0, h - 64, 0, h); gr.addColorStop(0, '#b9bdc2'); gr.addColorStop(1, '#7f8489'); g.fillStyle = gr; g.fillRect(0, h - 60, w, 60);
    for (let k = 0; k < 20; k++) blob(g, r() * w, h - 60 + r() * 60, 6 + r() * 14, '30,30,30', 0.25, 0, 0);
    blob(g, 50, 280, 40, '30,20,10', 0.25, 0, 0);
    grain(g, w, h, 14, r);
    return c;
  }
  // porte du choix : porte métallique peinte, panneaux en léger relief, plaque de propreté
  function paintDoor() {
    const w = 256, h = 563, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(71);
    let gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#b6b0a0'); gr.addColorStop(1, '#9c9686'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const panel = (x, y, pw, ph) => { g.strokeStyle = 'rgba(255,255,255,0.32)'; g.lineWidth = 3; g.strokeRect(x, y, pw, ph); g.strokeStyle = 'rgba(0,0,0,0.28)'; g.strokeRect(x + 3, y + 3, pw, ph); };
    panel(20, 24, w - 40, 250); panel(20, 296, w - 40, 190);
    gr = g.createLinearGradient(0, h - 70, 0, h); gr.addColorStop(0, '#cdd0d4'); gr.addColorStop(1, '#85898e'); g.fillStyle = gr; g.fillRect(0, h - 66, w, 66);
    for (let k = 0; k < 40; k++) { g.strokeStyle = 'rgba(40,40,40,' + (0.08 + r() * 0.2) + ')'; g.lineWidth = 1; const x = r() * w, y = h - 62 + r() * 58; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 6); g.stroke(); }
    for (let k = 0; k < 10; k++) blob(g, r() * w, h - 90 + r() * 30, 10 + r() * 25, '40,32,20', 0.18, 0, 0);
    blob(g, 30, 300, 45, '40,30,15', 0.22, 0, 0); blob(g, w - 30, 300, 45, '40,30,15', 0.22, 0, 0);
    for (let k = 0; k < 25; k++) { g.strokeStyle = 'rgba(60,55,45,' + (0.08 + r() * 0.15) + ')'; g.lineWidth = 1; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30); g.stroke(); }
    grain(g, w, h, 12, r);
    return c;
  }
  // tableau en liège avec affiches
  function paintBoard(seed) {
    const w = 512, h = 384, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(91 + seed * 17);
    g.fillStyle = '#5e4124'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a77a4b'; g.fillRect(16, 16, w - 32, h - 32);
    for (let k = 0; k < 2200; k++) { g.fillStyle = r() < 0.5 ? 'rgba(70,45,20,0.35)' : 'rgba(210,170,120,0.3)'; g.fillRect(16 + r() * (w - 32), 16 + r() * (h - 32), 2, 2); }
    const cols = ['#f1eee4', '#f6e7a0', '#f3d3d8', '#d5e6f2', '#ffffff'];
    const n = 4 + ((r() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const pw = 90 + r() * 90, ph = 110 + r() * 110, x = 24 + r() * (w - 48 - pw), y = 24 + r() * (h - 48 - ph), a = (r() - 0.5) * 0.12;
      g.save(); g.translate(x + pw / 2, y + ph / 2); g.rotate(a);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-pw / 2 + 4, -ph / 2 + 4, pw, ph);
      g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(-pw / 2, -ph / 2, pw, ph);
      g.fillStyle = 'rgba(40,40,40,0.8)'; g.fillRect(-pw / 2 + 10, -ph / 2 + 12, pw * (0.4 + r() * 0.4), 9);
      for (let l = 0; l < ph / 14 - 2; l++) { g.fillStyle = 'rgba(70,70,70,0.45)'; g.fillRect(-pw / 2 + 10, -ph / 2 + 32 + l * 12, (pw - 20) * (0.5 + r() * 0.5), 4); }
      g.fillStyle = r() < 0.5 ? '#c4231c' : '#2457b5'; g.beginPath(); g.arc(0, -ph / 2 + 6, 5, 0, 7); g.fill();
      g.restore();
    }
    grain(g, w, h, 10, r);
    return c;
  }
  function paintRadiator() {
    const w = 256, h = 160, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(101);
    g.fillStyle = '#cfcabd'; g.fillRect(0, 0, w, h);
    for (let x = 4; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 14, 0); gr.addColorStop(0, '#8f8a7e'); gr.addColorStop(0.4, '#e2ddd0'); gr.addColorStop(1, '#8a857a'); g.fillStyle = gr; g.fillRect(x, 10, 13, h - 20); }
    g.fillStyle = '#a19c90'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    for (let k = 0; k < 20; k++) blob(g, r() * w, h - r() * 50, 6 + r() * 16, '90,60,25', 0.25, 0, 0);
    grain(g, w, h, 10, r);
    return c;
  }
  function paintClock() {
    const c = cv(256, 256), g = c.getContext('2d');
    g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(128, 128, 127, 0, 7); g.fill();
    g.fillStyle = '#efeadc'; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fill();
    g.strokeStyle = '#222'; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, l = i % 5 ? 6 : 16; g.lineWidth = i % 5 ? 2 : 5; g.beginPath(); g.moveTo(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104); g.lineTo(128 + Math.sin(a) * (104 - l), 128 - Math.cos(a) * (104 - l)); g.stroke(); }
    g.fillStyle = '#222'; g.font = 'bold 26px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; g.fillText(String(i), 128 + Math.sin(a) * 76, 128 - Math.cos(a) * 76); }
    const hand = (a, l, wd, col) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(128 - Math.sin(a) * 14, 128 + Math.cos(a) * 14); g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); g.stroke(); };
    hand((3 + 33 / 60) / 12 * Math.PI * 2, 54, 8, '#151515'); hand(33 / 60 * Math.PI * 2, 86, 5, '#151515'); hand(12 / 60 * Math.PI * 2, 92, 2, '#b3161b');
    g.fillStyle = '#151515'; g.beginPath(); g.arc(128, 128, 7, 0, 7); g.fill();
    const gr = g.createLinearGradient(40, 40, 200, 200); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fill();
    return c;
  }
  function paintExit() {
    const c = cv(256, 96), g = c.getContext('2d');
    g.fillStyle = '#0a7d33'; g.fillRect(0, 0, 256, 96);
    g.strokeStyle = '#d9ffe5'; g.lineWidth = 4; g.strokeRect(5, 5, 246, 86);
    g.fillStyle = '#ecfff2'; g.strokeStyle = '#ecfff2'; g.lineCap = 'round';
    g.beginPath(); g.arc(46, 26, 8, 0, 7); g.fill();
    g.lineWidth = 7; g.beginPath(); g.moveTo(42, 36); g.lineTo(36, 58); g.lineTo(50, 74); g.moveTo(36, 58); g.lineTo(24, 76); g.moveTo(40, 42); g.lineTo(56, 52); g.moveTo(40, 42); g.lineTo(26, 48); g.stroke();
    g.font = 'bold 38px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('SORTIE', 80, 50);
    return c;
  }
  function paintPaper(seed) {
    const c = cv(128, 180), g = c.getContext('2d'), r = BR.rngFrom(131 + seed);
    g.fillStyle = '#ece8dc'; g.fillRect(0, 0, 128, 180);
    g.fillStyle = 'rgba(40,40,40,0.7)'; g.fillRect(12, 14, 60, 7);
    for (let l = 0; l < 11; l++) { g.fillStyle = 'rgba(70,70,70,0.4)'; g.fillRect(12, 32 + l * 12, 104 * (0.5 + r() * 0.5), 3); }
    for (let k = 0; k < 5; k++) { g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 2; g.beginPath(); g.moveTo(r() * 128, 0); g.lineTo(r() * 128, 180); g.stroke(); }
    blob(g, r() * 128, r() * 180, 30, '120,100,60', 0.2, 0, 0);
    return c;
  }
  function paintGlow() {
    const c = cv(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
  }

  // texte : césures propres (espaces insécables autour des nombres et symboles)
  const nb = s => String(s).replace(/(≈|×|·|=|−|\+|Ø|÷) /g, '$1 ').replace(/ (×|·|=|\/|−|\+)/g, ' $1').replace(/(\d) (?=\d)/g, '$1 ').replace(/(\d) (?=[A-Za-zµ°%²³⁴])/g, '$1 ');
  function wrapText(g, text, maxW) {
    const words = String(text).split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function fitText(g, text, maxW, maxH, maxSize, minSize, weight, lh) {
    for (let size = maxSize; size >= minSize; size -= 2) {
      g.font = weight + ' ' + size + 'px ' + FONT;
      const lines = wrapText(g, text, maxW);
      if (lines.length * size * lh <= maxH && lines.every(l => g.measureText(l).width <= maxW)) return { lines, size };
    }
    g.font = weight + ' ' + minSize + 'px ' + FONT; return { lines: wrapText(g, text, maxW), size: minSize };
  }
  function drawLines(g, ft, cx, cy, lh) {
    const tot = ft.lines.length * ft.size * lh;
    ft.lines.forEach((l, i) => g.fillText(l, cx, cy - tot / 2 + (i + 0.5) * ft.size * lh));
  }
  // panneau lumineux de la question
  function panelCanvas(k, q) {
    const w = 2048, h = 448, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(500 + k);
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f7f3e7'); gr.addColorStop(1, '#e2dbc7'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) blob(g, r() * w, r() * h, 60 + r() * 160, '150,130,90', 0.06 + r() * 0.06, 0, 0);
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 10; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#ad1519'; rr(g, 44, 38, 330, 76, 12); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 50px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SALLE ' + (k + 1), 209, 77);
    g.fillStyle = '#6a6252'; g.font = '600 36px ' + FONT; g.textAlign = 'right'; g.fillText('QUESTION · BUT GMP', w - 52, 77);
    g.fillStyle = '#121212'; g.textAlign = 'center';
    const ft = fitText(g, nb(q[0]), w - 170, h - 165, 124, 60, 'bold', 1.16);
    drawLines(g, ft, w / 2, 128 + (h - 128 - 26) / 2, 1.16);
    return c;
  }
  // plaque émaillée de la réponse, sur la porte
  function plaqueCanvas(text) {
    const w = 512, h = 208, c = cv(w, h), g = c.getContext('2d');
    g.fillStyle = '#1d1d1d'; rr(g, 0, 0, w, h, 22); g.fill();
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fbf8ef'); gr.addColorStop(1, '#e6e0cf'); g.fillStyle = gr; rr(g, 9, 9, w - 18, h - 18, 16); g.fill();
    g.fillStyle = '#8a8a86'; for (const [x, y] of [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ft = fitText(g, nb(text), w - 80, h - 50, 86, 34, 'bold', 1.12);
    drawLines(g, ft, w / 2, h / 2 + 2, 1.12);
    return c;
  }
  // affiche collée sur la porte : papier, image du monstre, ruban adhésif
  const posterCache = {}, chaseCache = {};
  function posterTex(i) {
    if (posterCache[i]) return posterCache[i];
    const w = 384, h = 512, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(700 + i);
    g.fillStyle = '#eee8d9'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 5; k++) blob(g, r() * w, r() * h, 50 + r() * 120, '150,130,90', 0.08, 0, 0);
    const s = E.sprite(i), im = s && s.canvas;
    if (im) {
      const mw = w - 44, mh = h - 44, k = Math.min(mw / im.width, mh / im.height), iw = im.width * k, ih = im.height * k;
      g.drawImage(im, (w - iw) / 2, (h - ih) / 2, iw, ih);
    }
    g.fillStyle = 'rgba(225,215,170,0.55)';
    for (const [x, y, a] of [[0, 0, -0.6], [w, 0, 0.6], [0, h, 0.6], [w, h, -0.6]]) { g.save(); g.translate(x, y); g.rotate(a); g.fillRect(-46, -14, 92, 28); g.restore(); }
    g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, h * 0.5); g.lineTo(w, h * 0.48); g.stroke();
    grain(g, w, h, 8, r);
    return (posterCache[i] = tex(c));
  }
  // image seule (détourée) pour le monstre qui poursuit
  function chaseTex(i) {
    if (chaseCache[i]) return chaseCache[i];
    const s = E.sprite(i); const t = s && s.canvas ? tex(s.canvas) : tex(cv(4, 4));
    return (chaseCache[i] = t);
  }

  /* ---------- textures des nouvelles salles ---------- */
  // roche volcanique (salles de lave), 512 px = 3 m
  function paintRock() {
    const S = 512, c = cv(S, S), g = c.getContext('2d'), r = BR.rngFrom(201);
    g.fillStyle = '#2e2724'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 46; i++) blob(g, r() * S, r() * S, 26 + r() * 90, r() < 0.5 ? '78,64,54' : '10,8,7', 0.22 + r() * 0.3, S, S);
    g.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      let x = r() * S, y = r() * S; g.strokeStyle = 'rgba(6,5,4,0.75)'; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); }
      g.stroke();
    }
    grain(g, S, S, 24, r);
    return c;
  }
  // lave : coulées claires, croûte sombre (texture qui défile)
  function paintLava() {
    const S = 512, c = cv(S, S), g = c.getContext('2d'), r = BR.rngFrom(211);
    g.fillStyle = '#ff6a10'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 30; i++) blob(g, r() * S, r() * S, 30 + r() * 80, '255,214,80', 0.3 + r() * 0.35, S, S);
    for (let i = 0; i < 34; i++) blob(g, r() * S, r() * S, 18 + r() * 60, '90,14,0', 0.35 + r() * 0.4, S, S);
    g.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      let x = r() * S, y = r() * S; g.strokeStyle = 'rgba(50,8,0,' + (0.35 + r() * 0.35) + ')'; g.lineWidth = 3 + r() * 6; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 90; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 18; i++) blob(g, r() * S, r() * S, 8 + r() * 20, '255,250,190', 0.6, S, S);
    grain(g, S, S, 14, r);
    return c;
  }
  // panneaux métalliques rivetés (laboratoire des lasers), 512 px = 2 m
  function paintMetal() {
    const w = 512, h = 512, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(221);
    g.fillStyle = '#2b3036'; g.fillRect(0, 0, w, h);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const x = i * 256, y = j * 256, gr = g.createLinearGradient(x, y, x + 256, y + 256);
      gr.addColorStop(0, '#4d545d'); gr.addColorStop(1, '#343940'); g.fillStyle = gr; g.fillRect(x + 4, y + 4, 248, 248);
      g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, 252, 252);
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2; g.strokeRect(x + 7, y + 7, 242, 242);
      for (const [a, b] of [[16, 16], [240, 16], [16, 240], [240, 240]]) { g.fillStyle = '#1d2024'; g.beginPath(); g.arc(x + a, y + b, 6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(x + a - 1.5, y + b - 1.5, 2, 0, 7); g.fill(); }
    }
    for (let i = 0; i < 18; i++) blob(g, r() * w, r() * h, 20 + r() * 60, '24,18,10', 0.22, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = 'rgba(210,220,230,' + (0.04 + r() * 0.08) + ')'; g.lineWidth = 1; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 50, y + (r() - 0.5) * 12); g.stroke(); }
    grain(g, w, h, 12, r);
    return c;
  }
  // caillebotis (sol du laboratoire), 512 px = 2 m
  function paintGrate() {
    const S = 512, c = cv(S, S), g = c.getContext('2d'), r = BR.rngFrom(231);
    g.fillStyle = '#08090a'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < S; j += 16) { g.fillStyle = '#3d4248'; g.fillRect(0, j, S, 5); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, j, S, 1); }
    for (let i = 0; i < S; i += 64) { g.fillStyle = '#545a61'; g.fillRect(i, 0, 8, S); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(i, 0, 2, S); }
    for (let i = 0; i < 14; i++) blob(g, r() * S, r() * S, 30 + r() * 70, '50,35,15', 0.25, S, S);
    grain(g, S, S, 10, r);
    return c;
  }
  // parquet de gymnase, 1024 px = 4 m
  function paintParquet() {
    const S = 1024, c = cv(S, S), g = c.getContext('2d'), r = BR.rngFrom(241), pw = 64;
    g.fillStyle = '#b8874c'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += pw) {
      let y = -r() * 300;
      while (y < S) {
        const len = 180 + r() * 320, v = (r() - 0.5) * 34;
        g.fillStyle = 'rgb(' + ((203 + v) | 0) + ',' + ((152 + v) | 0) + ',' + ((92 + v * 0.7) | 0) + ')'; g.fillRect(x + 1, y + 1, pw - 2, len - 2);
        for (let k = 0; k < 7; k++) { g.strokeStyle = 'rgba(110,65,25,' + (0.08 + r() * 0.12) + ')'; g.lineWidth = 1; const xx = x + 4 + r() * (pw - 8); g.beginPath(); g.moveTo(xx, y + 2); g.lineTo(xx + (r() - 0.5) * 6, y + len - 2); g.stroke(); }
        g.fillStyle = 'rgba(60,35,12,0.55)'; g.fillRect(x, y + len - 1, pw, 2);
        y += len;
      }
      g.fillStyle = 'rgba(60,35,12,0.5)'; g.fillRect(x, 0, 1.5, S);
    }
    for (let i = 0; i < 16; i++) blob(g, r() * S, r() * S, 60 + r() * 160, '255,240,210', 0.05 + r() * 0.06, S, S);
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(30,20,10,' + (0.06 + r() * 0.1) + ')'; g.lineWidth = 2 + r() * 3; const x = r() * S, y = r() * S; g.beginPath(); g.arc(x, y, 10 + r() * 30, r() * 6, r() * 6 + 1.2); g.stroke(); }   // traces de baskets
    grain(g, S, S, 10, r);
    return c;
  }
  // planche pourrie (plancher qui s'effondre), une dalle de 1,25 m
  function paintPlank(seed) {
    const S = 256, c = cv(S, S), g = c.getContext('2d'), r = BR.rngFrom(251 + seed);
    for (let i = 0; i < 4; i++) {
      const v = (r() - 0.5) * 30; g.fillStyle = 'rgb(' + ((112 + v) | 0) + ',' + ((84 + v) | 0) + ',' + ((58 + v) | 0) + ')'; g.fillRect(0, i * 64 + 1, S, 62);
      for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(40,25,12,' + (0.1 + r() * 0.2) + ')'; g.lineWidth = 1; const y = i * 64 + 4 + r() * 56; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 8, S * 0.7, y + (r() - 0.5) * 8, S, y); g.stroke(); }
      g.fillStyle = 'rgba(15,10,5,0.8)'; g.fillRect(0, i * 64, S, 2);
      g.fillStyle = '#2a2622'; for (const x of [14, S - 14]) { g.beginPath(); g.arc(x, i * 64 + 32, 3.5, 0, 7); g.fill(); }
    }
    for (let i = 0; i < 6; i++) blob(g, r() * S, r() * S, 20 + r() * 50, '20,30,10', 0.3, 0, 0);
    g.strokeStyle = 'rgba(10,6,2,0.85)'; g.lineWidth = 2;   // fissures
    for (let i = 0; i < 3; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += (r() - 0.3) * 30; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 6; g.strokeRect(0, 0, S, S);
    grain(g, S, S, 16, r);
    return c;
  }
  // papier peint défraîchi (labyrinthe), 512 px = 2 m
  function paintWallpaper() {
    const S = 512, c = cv(S, S), g = c.getContext('2d'), r = BR.rngFrom(261);
    g.fillStyle = '#a99a64'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 64) { g.fillStyle = 'rgba(120,100,50,0.25)'; g.fillRect(x, 0, 22, S); }
    g.fillStyle = 'rgba(90,72,30,0.28)';
    for (let y = 16; y < S; y += 64) for (let x = 43; x < S; x += 64) { g.save(); g.translate(x, y + ((x / 64) % 2) * 32); g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); g.restore(); }
    for (let i = 0; i < 12; i++) blob(g, r() * S, r() * S, 40 + r() * 120, '80,60,25', 0.15 + r() * 0.15, S, S);
    for (let i = 0; i < 6; i++) { const x = r() * S, len = 100 + r() * 300; const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(90,65,25,0.35)'); gr.addColorStop(1, 'rgba(90,65,25,0)'); g.fillStyle = gr; g.fillRect(x, 0, 4 + r() * 10, len); }
    grain(g, S, S, 14, r);
    return c;
  }
  // étagère pleine de livres (bibliothèque de l'entité), 512 px = 2 m × 2,4 m
  function paintBooks() {
    const w = 512, h = 612, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(271);
    g.fillStyle = '#3b2716'; g.fillRect(0, 0, w, h);
    const shelfH = 120;
    for (let s = 0; s < 5; s++) {
      const y0 = 12 + s * shelfH; let x = 10;
      g.fillStyle = '#1a110a'; g.fillRect(8, y0, w - 16, shelfH - 18);
      while (x < w - 14) {
        const bw = 10 + r() * 20, bh = 60 + r() * 40, hue = [[120, 30, 30], [30, 60, 110], [40, 90, 50], [150, 120, 60], [80, 40, 90], [170, 160, 140]][(r() * 6) | 0], v = (r() - 0.5) * 40;
        if (r() < 0.06) { x += bw; continue; }
        const lean = r() < 0.08;
        g.save(); g.translate(x, y0 + shelfH - 18); if (lean) g.rotate(-0.25);
        g.fillStyle = 'rgb(' + ((hue[0] + v) | 0) + ',' + ((hue[1] + v) | 0) + ',' + ((hue[2] + v) | 0) + ')'; g.fillRect(0, -bh, bw - 1, bh);
        g.fillStyle = 'rgba(255,230,160,0.35)'; g.fillRect(2, -bh + 10, bw - 5, 3); g.fillRect(2, -16, bw - 5, 2);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(bw - 4, -bh, 3, bh);
        g.restore(); x += bw;
      }
      g.fillStyle = '#5a3c22'; g.fillRect(0, y0 + shelfH - 18, w, 16); g.fillStyle = 'rgba(255,220,170,0.2)'; g.fillRect(0, y0 + shelfH - 18, w, 2);
    }
    for (let i = 0; i < 20; i++) blob(g, r() * w, r() * h, 20 + r() * 50, '200,200,190', 0.06, 0, 0);   // poussière
    grain(g, w, h, 12, r);
    return c;
  }
  // façade d'armoire à persiennes (cache-cache)
  function paintWardrobe() {
    const w = 256, h = 470, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(281);
    g.fillStyle = '#5b3d24'; g.fillRect(0, 0, w, h);
    for (const x0 of [10, 131]) {
      g.fillStyle = '#4a311c'; g.fillRect(x0, 12, 115, h - 24);
      for (let y = 30; y < h - 40; y += 13) { g.fillStyle = '#1b120a'; g.fillRect(x0 + 12, y, 91, 6); g.fillStyle = 'rgba(255,210,150,0.18)'; g.fillRect(x0 + 12, y + 6, 91, 2); }
      g.strokeStyle = 'rgba(255,220,170,0.15)'; g.lineWidth = 2; g.strokeRect(x0 + 4, 16, 107, h - 32);
    }
    g.fillStyle = '#b59a5a'; g.fillRect(118, h / 2 - 20, 6, 40); g.fillRect(132, h / 2 - 20, 6, 40);
    for (let i = 0; i < 10; i++) blob(g, r() * w, r() * h, 15 + r() * 40, '20,12,5', 0.25, 0, 0);
    grain(g, w, h, 14, r);
    return c;
  }
  // distributeur de vies (salle de pause)
  function paintVending() {
    const w = 256, h = 512, c = cv(w, h), g = c.getContext('2d');
    g.fillStyle = '#b3141d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9e2d0'; g.font = 'bold 34px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VIES', 128, 38);
    g.font = '600 15px ' + FONT; g.fillText('GRATUIT (pour une fois)', 128, 66);
    g.fillStyle = '#0c1218'; g.fillRect(18, 86, 160, 330);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) { heart(g, 44 + i * 54, 130 + j * 78, 17, '#ff3b4e'); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(22 + i * 54, 160 + j * 78, 46, 4); }
    const gr = g.createLinearGradient(18, 86, 178, 416); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.4, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(18, 86, 160, 330);
    g.fillStyle = '#2a2a2a'; g.fillRect(190, 110, 50, 120);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) { g.fillStyle = '#ccc'; g.fillRect(197 + i * 22, 120 + j * 26, 16, 16); }
    g.fillStyle = '#111'; g.fillRect(30, 436, 150, 46); g.fillStyle = '#e9e2d0'; g.font = 'bold 14px ' + FONT; g.fillText('POUSSER', 105, 459);
    return c;
  }
  function heart(g, x, y, s, col) {
    g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); g.fill();
  }
  // grand panneau au-dessus de la porte de sortie : nom de la salle + consigne
  function signCanvas(k, title, sub, kind) {
    const w = 2048, h = 448, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(900 + k);
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f7f3e7'); gr.addColorStop(1, '#e2dbc7'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) blob(g, r() * w, r() * h, 60 + r() * 160, '150,130,90', 0.06 + r() * 0.06, 0, 0);
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 10; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = kind === 'rest' ? '#1f7a3a' : '#ad1519'; rr(g, 44, 38, 330, 76, 12); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 50px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SALLE ' + (k + 1), 209, 77);
    g.fillStyle = '#121212'; g.textAlign = 'center';
    const ft = fitText(g, title.toUpperCase(), w - 520, 120, 112, 60, 'bold', 1.1);
    drawLines(g, ft, w / 2 + 120, 84, 1.1);
    g.fillStyle = '#3c372c';
    const fs = fitText(g, nb(sub), w - 170, h - 200, 70, 38, '600', 1.18);
    drawLines(g, fs, w / 2, 160 + (h - 160 - 30) / 2, 1.18);
    return c;
  }
  // petit mot sur papier (indices, blagues)
  function noteCanvas(text, sub, seed, col) {
    const w = 256, h = 320, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(1300 + seed);
    g.fillStyle = col || '#f4efe0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,120,200,0.25)'; g.lineWidth = 1.5; for (let y = 60; y < h; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = 'rgba(200,60,60,0.35)'; g.beginPath(); g.moveTo(30, 0); g.lineTo(30, h); g.stroke();
    blob(g, r() * w, r() * h, 60, '140,110,60', 0.15, 0, 0);
    g.fillStyle = '#1b2a6b'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ft = fitText(g, text, w - 50, sub ? 150 : 230, 96, 26, 'bold', 1.08); g.font = 'bold ' + ft.size + 'px "Comic Sans MS", "Segoe Print", cursive';
    drawLines(g, ft, w / 2 + 6, sub ? 110 : h / 2, 1.08);
    if (sub) { g.fillStyle = '#7a1c1c'; const fs = fitText(g, sub, w - 50, 110, 40, 18, 'bold', 1.1); g.font = 'bold ' + fs.size + 'px "Comic Sans MS", "Segoe Print", cursive'; drawLines(g, fs, w / 2 + 6, 245, 1.1); }
    g.fillStyle = 'rgba(225,215,170,0.6)'; g.save(); g.translate(w / 2, 8); g.rotate((r() - 0.5) * 0.2); g.fillRect(-40, -10, 80, 22); g.restore();
    grain(g, w, h, 8, r);
    return c;
  }
  // graffiti à la bombe (fond transparent)
  function sprayCanvas(text, col) {
    const w = 512, h = 256, c = cv(w, h), g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const ft = fitText(g, text, w - 40, h - 40, 110, 30, 'bold', 1.05); g.font = 'bold ' + ft.size + 'px "Comic Sans MS", "Segoe Print", cursive';
    g.shadowColor = col; g.shadowBlur = 10; g.fillStyle = col; drawLines(g, ft, w / 2, h / 2, 1.05);
    g.shadowBlur = 0; for (let i = 0; i < 120; i++) { g.fillStyle = col; g.globalAlpha = 0.4; g.fillRect(w / 2 + (Math.random() - 0.5) * w * 0.9, h / 2 + (Math.random() - 0.5) * h * 0.8, 2, 2); }
    g.globalAlpha = 1;
    return c;
  }
  // étiquette de clé (couleur + forme)
  function tagCanvas(ci, si) {
    const c = cv(128, 128), g = c.getContext('2d');
    g.fillStyle = '#f2ead6'; rr(g, 4, 4, 120, 120, 16); g.fill();
    g.fillStyle = KCOL[ci][1]; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 92px ' + FONT; g.fillText(KSYM[si], 64, 70);
    g.strokeStyle = '#333'; g.lineWidth = 4; rr(g, 4, 4, 120, 120, 16); g.stroke();
    return c;
  }
  // plaque de numéro sur la porte (laiton)
  function plateCanvas(num) {
    const c = cv(256, 96), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#e8c97a'); gr.addColorStop(0.5, '#b8913f'); gr.addColorStop(1, '#8a6a28');
    g.fillStyle = gr; rr(g, 2, 2, 252, 92, 14); g.fill(); g.strokeStyle = '#5a4214'; g.lineWidth = 4; rr(g, 6, 6, 244, 84, 10); g.stroke();
    g.fillStyle = '#2b1f08'; g.font = 'bold 60px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num).padStart(4, '0'), 128, 52);
    return c;
  }
  // parpaings peints (gymnase), 512 px = 2,4 m
  function paintBlocks() {
    const S = 512, c = cv(S, S), g = c.getContext('2d'), r = BR.rngFrom(311), bh = 64, bw = 128;
    g.fillStyle = '#8f8d86'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < S / bh; j++) for (let i = -1; i < S / bw + 1; i++) {
      const x = i * bw + (j % 2) * bw / 2, v = (r() - 0.5) * 12;
      g.fillStyle = 'rgb(' + ((222 + v) | 0) + ',' + ((220 + v) | 0) + ',' + ((211 + v) | 0) + ')'; g.fillRect(x + 3, j * bh + 3, bw - 6, bh - 6);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 3, j * bh + 3, bw - 6, 2);
      for (let k = 0; k < 25; k++) { g.fillStyle = 'rgba(80,80,70,' + (0.1 + r() * 0.15) + ')'; g.fillRect(x + 4 + r() * (bw - 8), j * bh + 4 + r() * (bh - 8), 2, 2); }
    }
    for (let i = 0; i < 10; i++) blob(g, r() * S, r() * S, 40 + r() * 90, '90,80,60', 0.08, S, S);
    grain(g, S, S, 8, r);
    return c;
  }
  // briques « RATÉ » derrière une fausse porte
  function paintBricks() {
    const w = 256, h = 512, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(301);
    g.fillStyle = '#5a4a3f'; g.fillRect(0, 0, w, h);
    for (let j = 0; j < h / 32; j++) for (let i = -1; i < w / 64 + 1; i++) { const v = (r() - 0.5) * 30; g.fillStyle = 'rgb(' + ((150 + v) | 0) + ',' + ((66 + v * 0.5) | 0) + ',' + ((48 + v * 0.4) | 0) + ')'; g.fillRect(i * 64 + (j % 2) * 32 + 2, j * 32 + 2, 60, 28); }
    g.save(); g.translate(w / 2, h * 0.42); g.rotate(-0.2); g.font = 'bold 70px "Comic Sans MS", cursive'; g.textAlign = 'center'; g.fillStyle = '#f5f5f5'; g.shadowColor = '#fff'; g.shadowBlur = 6; g.fillText('RATÉ', 0, 0); g.font = 'bold 60px ' + FONT; g.fillText(':)', 0, 80); g.restore();
    grain(g, w, h, 14, r);
    return c;
  }

  /* ---------- matériaux partagés (créés une fois) ---------- */
  let MAT = null, TX = null, GEO = null;
  function materials() {
    if (MAT) return MAT;
    const Ph = (o) => new THREE.MeshPhongMaterial(o);
    TX = {
      floor: tex(paintFloor(), true), wall: tex(paintWall(), true), ceil: tex(paintCeiling(), true), door: tex(paintDoor()),
      lockA: tex(paintLockers('#55708a', 0)), lockB: tex(paintLockers('#6e7752', 1)), rad: tex(paintRadiator()), clock: tex(paintClock()), exit: tex(paintExit()),
      cdoor: [tex(paintClassDoor('B 104', 0)), tex(paintClassDoor('B 108', 1)), tex(paintClassDoor('C 012', 2))],
      board: [tex(paintBoard(0)), tex(paintBoard(1)), tex(paintBoard(2))], paper: [tex(paintPaper(0)), tex(paintPaper(1))],
      glow: new THREE.CanvasTexture(paintGlow()),
      rock: tex(paintRock(), true), lava: tex(paintLava(), true), metal: tex(paintMetal(), true), grate: tex(paintGrate(), true), parquet: tex(paintParquet(), true),
      plank: [tex(paintPlank(0)), tex(paintPlank(1)), tex(paintPlank(2))], paperw: tex(paintWallpaper(), true), books: tex(paintBooks()), ward: tex(paintWardrobe()),
      vend: tex(paintVending()), bricks: tex(paintBricks()), plankw: tex(paintPlank(5), true), blocks: tex(paintBlocks(), true),
    };
    TX.lava2 = TX.lava.clone(); TX.lava2.needsUpdate = true;
    MAT = {
      floor: Ph({ map: TX.floor, specular: 0x3a3832, shininess: 70 }),
      wall: Ph({ map: TX.wall, specular: 0x161616, shininess: 16 }),
      ceil: Ph({ map: TX.ceil, specular: 0x000000, shininess: 2 }),
      dark: Ph({ color: 0x2a2c2e, specular: 0x333333, shininess: 30 }),
      metal: Ph({ color: 0x80848a, specular: 0x555555, shininess: 55 }),
      steel: Ph({ color: 0xb9bdc2, specular: 0x999999, shininess: 90 }),
      woodDark: Ph({ color: 0x4a3220, specular: 0x222222, shininess: 25 }),
      wood: Ph({ color: 0x8a6440, specular: 0x222222, shininess: 25 }),
      lockA: Ph({ map: TX.lockA, specular: 0x444444, shininess: 45 }), lockB: Ph({ map: TX.lockB, specular: 0x444444, shininess: 45 }),
      lockBodyA: Ph({ color: 0x3f566b, specular: 0x333333, shininess: 40 }), lockBodyB: Ph({ color: 0x565e3f, specular: 0x333333, shininess: 40 }),
      cdoor0: Ph({ map: TX.cdoor[0], specular: 0x222222, shininess: 30 }), cdoor1: Ph({ map: TX.cdoor[1], specular: 0x222222, shininess: 30 }), cdoor2: Ph({ map: TX.cdoor[2], specular: 0x222222, shininess: 30 }),
      board0: Ph({ map: TX.board[0], shininess: 4 }), board1: Ph({ map: TX.board[1], shininess: 4 }), board2: Ph({ map: TX.board[2], shininess: 4 }),
      rad: Ph({ map: TX.rad, specular: 0x333333, shininess: 30 }), radBody: Ph({ color: 0xbdb8ab, shininess: 20 }),
      red: Ph({ color: 0xa8140e, specular: 0x777777, shininess: 80 }), black: Ph({ color: 0x0e0e0e, shininess: 30 }),
      glass: Ph({ color: 0x020304, specular: 0x1c2630, shininess: 120 }),
      clock: Ph({ map: TX.clock, shininess: 60, specular: 0x444444 }),
      exit: new THREE.MeshBasicMaterial({ map: TX.exit }),
      paper0: Ph({ map: TX.paper[0], side: THREE.DoubleSide, shininess: 2 }), paper1: Ph({ map: TX.paper[1], side: THREE.DoubleSide, shininess: 2 }),
      puddle: Ph({ color: 0x15140f, specular: 0xbbbbbb, shininess: 140, transparent: true, opacity: 0.62, depthWrite: false }),
      hole: new THREE.MeshBasicMaterial({ color: 0x030303 }),
      void: new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: false }),
      door: Ph({ map: TX.door, specular: 0x333333, shininess: 35 }),
      rock: Ph({ map: TX.rock, specular: 0x221a14, shininess: 12 }),
      stone: Ph({ color: 0xb4a698, map: TX.rock, specular: 0x332a22, shininess: 20 }),
      plankw: Ph({ map: TX.plankw, specular: 0x221a10, shininess: 14 }),
      cap: Ph({ color: 0xe6d6c4, map: TX.rock, emissive: 0x3a1c0a, specular: 0x553322, shininess: 30 }),
      lava: new THREE.MeshBasicMaterial({ map: TX.lava, color: new THREE.Color(1.35, 1.0, 0.85) }),
      lava2: new THREE.MeshBasicMaterial({ map: TX.lava2, color: 0xffffff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
      mwall: Ph({ map: TX.metal, specular: 0x666a70, shininess: 60 }),
      grate: Ph({ map: TX.grate, specular: 0x555555, shininess: 70 }),
      parquet: Ph({ map: TX.parquet, specular: 0x6a5030, shininess: 90 }),
      gymwall: Ph({ map: TX.blocks, specular: 0x222222, shininess: 18 }),
      paperw: Ph({ map: TX.paperw, specular: 0x111111, shininess: 6 }),
      books: Ph({ map: TX.books, specular: 0x111111, shininess: 10 }),
      ward: Ph({ map: TX.ward, specular: 0x222222, shininess: 25 }),
      vend: Ph({ map: TX.vend, emissive: 0x401010, emissiveMap: TX.vend, specular: 0x666666, shininess: 80 }),
      bricks: Ph({ map: TX.bricks, shininess: 4 }),
      mat: Ph({ color: 0x2856a8, specular: 0x222222, shininess: 20 }),
      mat2: Ph({ color: 0xc23a2a, specular: 0x222222, shininess: 20 }),
      gold: Ph({ color: 0xd8b04a, specular: 0xfff0c0, shininess: 90 }),
      silver: Ph({ color: 0xbfc4c9, specular: 0xffffff, shininess: 90 }),
      glove: Ph({ color: 0xd0201a, specular: 0xffaaaa, shininess: 70 }),
      concrete: Ph({ color: 0x8d877c, map: TX.ceil, specular: 0x111111, shininess: 6 }),
    };
    MAT.plank = TX.plank.map(t => Ph({ map: t, specular: 0x222222, shininess: 18 }));
    const SCALE = { wall: [2, 3.5], floor: [2.4, 2.4], ceil: [2.4, 2.4], rock: [3, 3], stone: [3, 3], mwall: [2, 2], grate: [2, 2], parquet: [4, 4], gymwall: [2.4, 2.4], paperw: [2, 2], concrete: [2.4, 2.4], lava: [3, 3], lava2: [4.5, 4.5], plankw: [1.25, 1.25], cap: [2, 2] };
    MAT._scale = SCALE;
    GEO = {
      diff: new THREE.PlaneGeometry(1.24, 0.17).rotateX(Math.PI / 2),
      leaf: new THREE.BoxGeometry(DW - 0.02, DH - 0.01, 0.05),
      poster: new THREE.PlaneGeometry(0.7, 0.93), plaque: new THREE.PlaneGeometry(0.88, 0.36), plate: new THREE.PlaneGeometry(0.34, 0.13),
      lever: new THREE.BoxGeometry(0.15, 0.024, 0.03), rose: new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14).rotateX(Math.PI / 2),
      chase: new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
      beam: new THREE.CylinderGeometry(0.018, 0.018, 1, 6).rotateZ(Math.PI / 2), beamGlow: new THREE.CylinderGeometry(0.07, 0.07, 1, 8, 1, true).rotateZ(Math.PI / 2),
      bulb: new THREE.SphereGeometry(0.11, 14, 10), lamp: new THREE.SphereGeometry(0.06, 10, 8),
      keyRing: new THREE.TorusGeometry(0.035, 0.009, 6, 16), keyShaft: new THREE.BoxGeometry(0.012, 0.012, 0.09).translate(0, 0, -0.08), keyBit: new THREE.BoxGeometry(0.01, 0.03, 0.025).translate(0, -0.016, -0.11),
      tag: new THREE.PlaneGeometry(0.075, 0.075),
      tile: new THREE.BoxGeometry(1.22, 0.14, 1.22),
    };
    return MAT;
  }

  /* =====================================================================
     4. GÉOMÉTRIE : coordonnées monde, UV « monde » (textures raccordées), fusion par matériau
     ===================================================================== */
  function worldUV(geo, tw, th) {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      if (Math.abs(ny) > 0.5) uv.setXY(i, x / tw, z / th);
      else if (Math.abs(nx) > 0.5) uv.setXY(i, -z * Math.sign(nx) / tw, y / th);
      else uv.setXY(i, x * Math.sign(nz) / tw, y / th);
    }
    return geo;
  }
  function box(x0, x1, y0, y1, za, zb) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(zb - za));
    return g.translate((x0 + x1) / 2, (y0 + y1) / 2, (za + zb) / 2);
  }
  function plane(w, h, rx, ry, x, y, z) {
    const g = new THREE.PlaneGeometry(w, h); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry);
    return g.translate(x, y, z);
  }
  function merge(list) {
    let n = 0; const parts = list.map(gm => { const g2 = gm.index ? gm.toNonIndexed() : gm; n += g2.attributes.position.count; return g2; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    for (const g2 of parts) { pos.set(g2.attributes.position.array, o * 3); nor.set(g2.attributes.normal.array, o * 3); uv.set(g2.attributes.uv.array, o * 2); o += g2.attributes.position.count; }
    list.forEach(x => x.dispose()); parts.forEach(x => x.dispose());
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.computeBoundingSphere(); return out;
  }

  /* =====================================================================
     5. CONSTRUCTION D'UNE SALLE (coque commune + contenu propre au type)
     ===================================================================== */
  let S = null;
  const ht = () => S.time + S.off;   // horloge commune : celle de l'hôte (S.off = décalage estimé)
  const THEMES = {
    school:  { wall: 'wall', floor: 'floor', ceil: 'ceil', light: 0xfff0d0, fog: 0x0d0b07, dens: 0.05, amb: 0.1, surf: 'tile' },
    lava:    { wall: 'rock', floor: 'stone', ceil: 'rock', light: 0xffb070, fog: 0x1c0802, dens: 0.03, amb: 0.2, surf: 'concrete' },
    void:    { wall: 'plankw', floor: 'plankw', ceil: 'plankw', light: 0xffe2b0, fog: 0x04060a, dens: 0.05, amb: 0.1, surf: 'wood' },
    gym:     { wall: 'gymwall', floor: 'parquet', ceil: 'ceil', light: 0xf4f8ff, fog: 0x0b0c0e, dens: 0.02, amb: 0.14, surf: 'wood' },
    dark:    { wall: 'paperw', floor: 'floor', ceil: 'ceil', light: 0xffe0a0, fog: 0x010101, dens: 0.11, amb: 0.012, surf: 'carpet' },
    lab:     { wall: 'mwall', floor: 'grate', ceil: 'mwall', light: 0xd8f0ff, fog: 0x040507, dens: 0.05, amb: 0.06, surf: 'metal' },
    library: { wall: 'paperw', floor: 'parquet', ceil: 'ceil', light: 0xffd9a0, fog: 0x0a0610, dens: 0.05, amb: 0.06, surf: 'wood' },
  };
  // images de monstres de la salle k (2 par salle) : liste de l'hôte, sinon tirage déterministe
  function imgsFor(k) {
    if (S.imgs && S.imgs.length >= 2 * k + 2) return [S.imgs[2 * k] | 0, S.imgs[2 * k + 1] | 0];
    const n = Math.max(1, E.count());
    const r = BR.rngFrom((S.seed ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0), a = Math.floor(r() * n);
    let b = Math.floor(r() * n); if (b === a && n > 1) b = (a + 1 + Math.floor(r() * (n - 1))) % n;
    return [a, b];
  }

  // tirage sans répétition (BR.Ent.draw) : liste préparée par l'hôte et envoyée à tous au lancement (cfg.imgs du salon)
  function drawPair(prev) {
    const n = E.count(); if (!n) return [0, 0];
    const a = E.draw(prev || []);
    let b = E.draw((prev || []).concat([a])), tries = 0;
    while (b === a && n > 1 && tries++ < 6) b = E.draw([a]);
    return [a, b];
  }
  D.planImages = function (rooms) {
    const out = []; let prev = [];
    for (let k = 0; k < rooms; k++) { const p = drawPair(prev); out.push(p[0], p[1]); prev = p; }
    return out;
  };

  function buildRoom(k) {
    const pl = S.plan.rooms[k]; if (!pl) return null;
    const T = TYPES[pl.type], TH = THEMES[T.theme], M = materials();
    const rm = { k, pl, T, TH, type: pl.type, group: new THREE.Group(), solids: [], fix: [], geos: [], mats: [], texs: [], doors: [], inter: [], st: {}, bye: [],
      start: -1, solved: !T.puzzle, slammed: false, Z0: pl.z0, ZE: pl.z0 - pl.L, W: pl.W, HX: pl.W / 2, H: pl.H, spawn: null, killY: -6, flick: 0, tint: null, imgs: imgsFor(k) };
    const r = BR.rngFrom((pl.seed ^ 0x51ed27) >>> 0);
    const B = {};
    const C = {
      rm, pl, r, M, Z0: rm.Z0, ZE: rm.ZE, HX: rm.HX, W: rm.W, H: rm.H, L: pl.L,
      z: u => rm.Z0 - u,
      put(key, geo) { const sc = M._scale[key]; if (sc) worldUV(geo, sc[0], sc[1]); (B[key] = B[key] || []).push(geo); return geo; },
      // boîte de collision (et son visuel si une clé de matériau est donnée)
      solid(x0, x1, y0, y1, za, zb, key, o) {
        const b = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), z0: Math.min(za, zb), z1: Math.max(za, zb), off: false };
        if (o) Object.assign(b, o);
        rm.solids.push(b);
        if (key) C.put(key, box(b.x0, b.x1, b.y0, b.y1, b.z0, b.z1));
        return b;
      },
      add(o) { rm.group.add(o); return o; },
      mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); rm.group.add(m); rm.geos.push(geo); return m; },
      own(m) { rm.mats.push(m); return m; }, ownTex(t) { rm.texs.push(t); return t; },
      glow(x, y, z, col, sx, sy, op) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glow, color: col, transparent: true, opacity: op == null ? 0.4 : op, blending: THREE.AdditiveBlending, depthWrite: false }));
        s.scale.set(sx, sy, 1); s.position.set(x, y, z); rm.group.add(s); rm.mats.push(s.material); return s;
      },
      light(x, y, z, col, i, o) { const f = Object.assign({ x, y, z, col: new THREE.Color(col), i: i == null ? 1 : i, cur: 1, burst: 0, wob: r() * 10, dead: false }, o || {}); rm.fix.push(f); return f; },
      // image plaquée (affiche, mot, graffiti) ; o.flat = posée à plat
      decal(canvas, w, h, x, y, z, ry, o) {
        o = o || {};
        const t = C.ownTex(tex(canvas));
        const m = C.own(new THREE.MeshPhongMaterial({ map: t, transparent: !!o.transparent, depthWrite: !o.transparent, shininess: 5, emissive: o.emissive ? 0x555555 : 0x000000, emissiveMap: o.emissive ? t : null, polygonOffset: true, polygonOffsetFactor: -2, side: o.flat ? THREE.DoubleSide : THREE.FrontSide }));
        const ms = C.mesh(new THREE.PlaneGeometry(w, h), m); ms.position.set(x, y, z);
        if (o.flat) ms.rotation.set(-Math.PI / 2, 0, ry || 0); else ms.rotation.y = ry || 0;
        return ms;
      },
      inter(o) { rm.inter.push(o); return o; },
    };
    shell(rm, C);
    T.build(rm, C);
    for (const key in B) { const geo = merge(B[key]); const m = new THREE.Mesh(geo, M[key]); m.matrixAutoUpdate = false; m.updateMatrix(); rm.group.add(m); rm.geos.push(geo); }
    if (!rm.spawn) rm.spawn = { x: pl.en, y: 0, z: rm.Z0 - 1.1 };
    S.scene.add(rm.group);
    S.rooms.set(k, rm);
    // ce qui s'est passé avant que la salle soit construite (multijoueur)
    for (const d of rm.doors) if (S.doorOpen.has(k + ':' + d.s)) { d.open = d.target = 1; d.opened = true; d.col.off = true; d.piv.rotation.y = d.sign * 1.72; if (T.onOpen) T.onOpen(rm, d, null, false, true); }
    if (S.rsq[k] != null && rm.start < 0) startRoom(rm, S.rsq[k]);
    (S.evq[k] || []).forEach(e => roomEvent(rm, e));
    delete S.evq[k];
    return rm;
  }
  function disposeRoom(rm) {
    rm.bye.forEach(f => { try { f(); } catch (e) {} });
    S.scene.remove(rm.group);
    rm.geos.forEach(g => g.dispose()); rm.mats.forEach(m => m.dispose()); rm.texs.forEach(t => t.dispose());
    S.rooms.delete(rm.k);
  }

  /* ---------- coque commune : sol, plafond, murs, mur d'entrée, mur épais de sortie (sas), porte, panneau, néons ---------- */
  function shell(rm, C) {
    const { pl } = C, T = rm.T, TH = rm.TH, k = rm.k, Z0 = rm.Z0, ZE = rm.ZE, HX = rm.HX, H = rm.H, L = pl.L, mid = (Z0 + ZE) / 2;
    const yb = T.pit || 0, zs = ZE - SAS;
    if (!T.noFloor) C.solid(-HX, HX, -0.4, 0, ZE, Z0, TH.floor);
    C.put(TH.ceil, plane(rm.W, L, Math.PI / 2, 0, 0, H, mid));
    C.solid(-HX, HX, H, H + 1, zs, Z0);                                   // plafond (collision)
    C.put(TH.wall, plane(L + 0.02, H - yb, 0, Math.PI / 2, -HX, (H + yb) / 2, mid));
    C.put(TH.wall, plane(L + 0.02, H - yb, 0, -Math.PI / 2, HX, (H + yb) / 2, mid));
    C.solid(-HX - 1, -HX, yb - 5, H + 2, zs, Z0 + 0.3); C.solid(HX, HX + 1, yb - 5, H + 2, zs, Z0 + 0.3);
    // mur d'entrée (ouverture = fin du sas de la salle précédente)
    const en = pl.en, ybe = Math.min(yb, -0.4);
    if (k === 0) C.solid(-HX, HX, ybe, H, Z0, Z0 + 0.25, TH.wall);
    else {
      C.solid(-HX, en - DW / 2, ybe, H, Z0, Z0 + 0.25, TH.wall); C.solid(en + DW / 2, HX, ybe, H, Z0, Z0 + 0.25, TH.wall);
      C.solid(en - DW / 2, en + DW / 2, DH, H, Z0, Z0 + 0.25, TH.wall);
      if (ybe < -0.4) C.solid(en - DW / 2, en + DW / 2, ybe, -0.4, Z0, Z0 + 0.25, TH.wall);
      C.put('metal', box(en - DW / 2 - 0.07, en - DW / 2, 0, DH + 0.07, Z0 - 0.04, Z0)); C.put('metal', box(en + DW / 2, en + DW / 2 + 0.07, 0, DH + 0.07, Z0 - 0.04, Z0)); C.put('metal', box(en - DW / 2 - 0.07, en + DW / 2 + 0.07, DH, DH + 0.07, Z0 - 0.04, Z0));
      if (H > DH + 0.75) {   // panneau SORTIE (ironique) au-dessus de l'entrée
        C.put('dark', box(en - 0.34, en + 0.34, DH + 0.3, DH + 0.6, Z0 - 0.06, Z0));
        const ex = C.mesh(new THREE.PlaneGeometry(0.62, 0.23).rotateY(Math.PI), MAT.exit); ex.position.set(en, DH + 0.45, Z0 - 0.062);
        C.glow(en, DH + 0.45, Z0 - 0.08, 0x2bff6a, 1.3, 0.6, 0.35);
      }
    }
    // mur épais de sortie, percé d'une ou plusieurs portes (l'épaisseur forme le sas)
    const exits = (T.exits ? T.exits(rm) : [pl.ex]).slice().sort((a, b) => a - b);
    let xa = -HX;
    for (const x of exits) {
      C.solid(xa, x - DW / 2, ybe, H, zs, ZE, TH.wall);
      C.solid(x - DW / 2, x + DW / 2, DH, H, zs, ZE, TH.wall);
      if (ybe < -0.4) C.solid(x - DW / 2, x + DW / 2, ybe, -0.4, zs, ZE, TH.wall);
      xa = x + DW / 2;
    }
    C.solid(xa, HX, ybe, H, zs, ZE, TH.wall);
    if (!T.customDoors) { C.solid(pl.ex - DW / 2, pl.ex + DW / 2, -0.4, 0, zs, ZE, TH.floor); makeDoor(rm, C, pl.ex); }
    // panneau au-dessus de la porte : nom de la salle et consigne (ou la question)
    const shMax = Math.max(0.28, H - DH - 0.42), sw = Math.min(rm.W - 0.5, 4.1, shMax * 2048 / 448), sh = sw * 448 / 2048;
    const sy = Math.min(H - sh / 2 - 0.08, DH + 0.3 + sh / 2 + (H > 4.5 ? 0.5 : 0));
    C.put('dark', box(-sw / 2 - 0.05, sw / 2 + 0.05, sy - sh / 2 - 0.05, sy + sh / 2 + 0.05, ZE, ZE + 0.08));
    const qt = C.ownTex(tex(T.panel ? T.panel(rm) : signCanvas(k, T.name, T.goal, pl.type)));
    rm.qmat = C.own(new THREE.MeshBasicMaterial({ map: qt, fog: false, toneMapped: false }));
    const qp = C.mesh(new THREE.PlaneGeometry(sw, sh), rm.qmat); qp.position.set(0, sy, ZE + 0.082);
    rm.qglow = C.glow(0, sy, ZE + 0.3, 0xfff6dc, sw * 1.5, sh * 2.1, T.dark ? 0.06 : 0.2);
    if (!T.dark) C.light(0, sy - 0.4, ZE + 1.1, 0xfff4e0, 0.85, { panel: true });
    // néons au plafond
    if (T.neons !== false) {
      const n = Math.max(2, Math.round(L / 3.6)), deadP = (T.deadP != null ? T.deadP : 0.12) + Math.min(0.25, k * 0.008);
      for (let i = 0; i < n; i++) neon(C, 0, Z0 - (i + 0.5) * L / n, H, i > 0 && i < n - 1 && C.r() < deadP, TH.light);
    }
  }
  function neon(C, x, z, y, dead, col, inten) {
    C.put('dark', box(x - 0.68, x + 0.68, y - 0.08, y, z - 0.14, z + 0.14));
    const mat = C.own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const dif = new THREE.Mesh(GEO.diff, mat); dif.position.set(x, y - 0.082, z); C.add(dif);
    const glow = C.glow(x, y - 0.22, z, col, 2.5, 0.75, 0.5);
    return C.light(x, y - 0.4, z, col, inten || 1.05, { mat, glow, dead });
  }
  // porte de sortie générique (numéro en laiton, voyant rouge / vert)
  function makeDoor(rm, C, x, o) {
    o = o || {};
    const ZE = rm.ZE, s = rm.doors.length, sign = o.hinge || (x > 0.01 ? -1 : 1);
    C.put('metal', box(x - DW / 2 - 0.08, x - DW / 2, 0, DH + 0.08, ZE, ZE + 0.045)); C.put('metal', box(x + DW / 2, x + DW / 2 + 0.08, 0, DH + 0.08, ZE, ZE + 0.045)); C.put('metal', box(x - DW / 2 - 0.08, x + DW / 2 + 0.08, DH, DH + 0.08, ZE, ZE + 0.045));
    const piv = new THREE.Group(); piv.position.set(x - sign * DW / 2, 0, ZE - 0.03);
    const leaf = new THREE.Mesh(GEO.leaf, o.mat || MAT.door); leaf.position.set(sign * DW / 2, DH / 2, 0); piv.add(leaf);
    const lever = new THREE.Mesh(GEO.lever, MAT.steel); lever.position.set(sign * (DW - 0.13), 1.02, 0.05); piv.add(lever);
    const rose = new THREE.Mesh(GEO.rose, MAT.steel); rose.position.set(sign * (DW - 0.08), 1.02, 0.03); piv.add(rose);
    const lever2 = lever.clone(); lever2.position.z = -0.05; piv.add(lever2);
    if (o.plate !== false) {
      const pm = C.own(new THREE.MeshPhongMaterial({ map: C.ownTex(tex(plateCanvas(rm.k + 1))), specular: 0x886622, shininess: 80 }));
      const p = new THREE.Mesh(GEO.plate, pm); p.position.set(sign * DW / 2, 1.62, 0.027); piv.add(p);
    }
    C.add(piv);
    let lamp = null;
    if (o.lamp !== false) {
      const lm = C.own(new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
      lamp = C.mesh(GEO.lamp.clone(), lm); lamp.position.set(x - sign * (DW / 2 + 0.22), DH - 0.1, ZE + 0.06);
      C.put('dark', box(x - sign * (DW / 2 + 0.22) - 0.07, x - sign * (DW / 2 + 0.22) + 0.07, DH - 0.18, DH - 0.02, ZE, ZE + 0.04));
    }
    const col = C.solid(x - DW / 2, x + DW / 2, 0, DH, ZE - 0.1, ZE);
    const d = { s, x, piv, leaf, col, sign, lamp, open: 0, target: 0, speed: 2.4, opened: false, slam: false, good: o.good !== false };
    rm.doors.push(d);
    return d;
  }

  /* ---------- décor de couloir d'école (casiers, portes de classe, tableaux, radiateurs, fenêtres, extincteurs) ---------- */
  function schoolDecor(C, uA, uB, o) {
    o = o || {};
    const r = C.r, HX = C.HX, H = C.H;
    let clockDone = false;
    for (const side of [-1, 1]) {
      if (o.side && o.side !== side) continue;
      const wx = side * HX, rotY = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      let z = C.Z0 - uA; const end = C.Z0 - uB;
      while (z > end + 0.5) {
        const room = z - end, t = r();
        if (t < 0.3 && room > 1.8 && !o.noLockers) {
          const n = Math.min(1 + ((r() * 3) | 0), Math.floor(room / 1.62)), va = r() < 0.5;
          for (let i = 0; i < n; i++) {
            const zc = z - 0.8 - i * 1.6, fx = wx - side * 0.44;
            C.put(va ? 'lockBodyA' : 'lockBodyB', box(Math.min(wx, fx), Math.max(wx, fx), 0, 1.85, zc - 0.8, zc + 0.8));
            C.put(va ? 'lockA' : 'lockB', plane(1.6, 1.8, 0, rotY, fx - side * 0.002, 0.95, zc));
          }
          C.solid(wx, wx - side * 0.46, 0, 1.85, z - n * 1.6, z);
          z -= n * 1.6 + 0.35;
        } else if (t < 0.48 && room > 1.6) {
          const zc = z - 0.75, v = (r() * 3) | 0;
          C.put('cdoor' + v, plane(1.0, 2.1, 0, rotY, wx - side * 0.012, 1.05, zc));
          C.put('woodDark', box(wx - side * 0.06, wx, 0, 2.18, zc - 0.58, zc - 0.5)); C.put('woodDark', box(wx - side * 0.06, wx, 0, 2.18, zc + 0.5, zc + 0.58)); C.put('woodDark', box(wx - side * 0.06, wx, 2.1, 2.18, zc - 0.58, zc + 0.58));
          if (!clockDone && H > 2.9 && r() < 0.6) { clockDone = true; C.put('clock', new THREE.CircleGeometry(0.17, 28).rotateY(rotY).translate(wx - side * 0.047, 2.62, zc)); C.put('black', new THREE.CylinderGeometry(0.18, 0.18, 0.05, 28).rotateZ(Math.PI / 2).translate(wx - side * 0.02, 2.62, zc)); }
          z -= 1.6;
        } else if (t < 0.64 && room > 1.6) {
          const zc = z - 0.8, v = (r() * 3) | 0;
          C.put('board' + v, plane(1.2, 0.9, 0, rotY, wx - side * 0.02, 1.7, zc));
          if (r() < 0.6) { C.put('radBody', box(wx - side * 0.12, wx - side * 0.02, 0.14, 0.76, zc - 0.5, zc + 0.5)); C.put('rad', plane(1.0, 0.62, 0, rotY, wx - side * 0.122, 0.45, zc)); C.solid(wx, wx - side * 0.14, 0, 0.76, zc - 0.5, zc + 0.5); }
          z -= 1.6;
        } else if (t < 0.74 && side > 0 && room > 2.8 && H < 4.2) {
          const zc = z - 1.3;
          C.put('glass', plane(2.4, 1.25, 0, rotY, wx - side * 0.03, 1.62, zc));
          C.put('metal', box(wx - side * 0.07, wx, 0.95, 1.0, zc - 1.25, zc + 1.25)); C.put('metal', box(wx - side * 0.07, wx, 2.24, 2.3, zc - 1.25, zc + 1.25));
          for (const dz of [-1.22, -0.4, 0.4, 1.22]) C.put('metal', box(wx - side * 0.07, wx, 1.0, 2.24, zc + dz - 0.03, zc + dz + 0.03));
          C.put('steel', box(wx - side * 0.16, wx, 0.92, 0.95, zc - 1.25, zc + 1.25));
          z -= 2.7;
        } else if (t < 0.83) {
          const zc = z - 0.35;
          C.put('red', new THREE.CylinderGeometry(0.085, 0.085, 0.46, 16).translate(wx - side * 0.14, 0.62, zc));
          C.put('black', new THREE.CylinderGeometry(0.03, 0.04, 0.1, 10).translate(wx - side * 0.14, 0.9, zc));
          C.put('dark', box(wx - side * 0.04, wx, 0.5, 1.0, zc - 0.12, zc + 0.12));
          z -= 0.8;
        } else z -= 0.5 + r() * 0.9;
      }
    }
    if (o.floor !== false) {   // feuilles tombées, flaque
      const np = 1 + ((r() * 4) | 0);
      for (let i = 0; i < np; i++) C.put(r() < 0.5 ? 'paper0' : 'paper1', new THREE.PlaneGeometry(0.21, 0.297).rotateX(-Math.PI / 2).rotateY(r() * 6.28).translate((r() - 0.5) * (C.W - 1.4), 0.004 + i * 0.0006, C.Z0 - uA - r() * (uB - uA)));
      if (r() < 0.4) { const g = new THREE.CircleGeometry(0.5 + r() * 0.5, 20).rotateX(-Math.PI / 2); g.scale(1 + r(), 1, 0.6 + r() * 0.5); g.translate((r() - 0.5) * 2.2, 0.006, C.Z0 - uA - 1 - r() * Math.max(0.5, uB - uA - 2)); C.put('puddle', g); }
    }
  }
  // pupitres d'élèves (plateau + pieds) ; renvoie les points posables sur le plateau
  function desk(C, x, z, w, d, key) {
    const top = 0.76;
    C.solid(x - w / 2, x + w / 2, 0, top, z - d / 2, z + d / 2);
    C.put(key || 'wood', box(x - w / 2, x + w / 2, top - 0.04, top, z - d / 2, z + d / 2));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C.put('metal', box(x + a * (w / 2 - 0.06) - 0.02, x + a * (w / 2 - 0.06) + 0.02, 0, top - 0.04, z + b * (d / 2 - 0.06) - 0.02, z + b * (d / 2 - 0.06) + 0.02));
    C.put('metal', box(x - w / 2 + 0.05, x + w / 2 - 0.05, top - 0.2, top - 0.16, z - d / 2 + 0.05, z - d / 2 + 0.09));
    return [{ x: x - w * 0.25, y: top + 0.005, z }, { x: x + w * 0.25, y: top + 0.005, z }];
  }
  // graffiti à la bombe sur un mur latéral
  function spray(C, text, col, side, u, y, w) {
    w = w || 2;
    return C.decal(sprayCanvas(text, col), w, w / 2, side * (C.HX - 0.015), y, C.z(u), side < 0 ? Math.PI / 2 : -Math.PI / 2, { transparent: true, emissive: true });
  }

  /* =====================================================================
     6. LES TYPES DE SALLES
     Chaque type : plan (section 2), build(rm, C), et au besoin :
       update(rm, dt)  animation et pièges (toutes les salles construites)
       local(rm, dt)   tests du joueur local (sa salle seulement)
       start(rm)       début de la salle (tout le groupe est entré)
       touch(rm, d)    contact avec une porte (portes à choix)   tryDoor(rm, d)  porte verrouillée touchée
       onOpen(rm, d, by, local, silent)  une porte vient de s'ouvrir    event(rm, e)  évènement réseau
       timeLeft(rm)    chronomètre affiché      hud(rm) / side(rm)  textes de l'interface
       onRespawn(rm)   le joueur local revient au début de la salle
     ===================================================================== */

  /* ---------- salle 0 : le hall ---------- */
  TYPES.start.build = (rm, C) => {
    schoolDecor(C, 0.6, C.L - 1.2);
    spray(C, 'Bienvenue ! Il y a beaucoup de portes.', '#7dffa8', 1, 5.6, 2.75, 2.2);
  };

  /* ---------- salle de pause : distributeur de vies ---------- */
  TYPES.rest.build = (rm, C) => {
    const HX = C.HX, z = C.z(C.L / 2);
    C.solid(-HX, -HX + 0.8, 0, 1.95, z - 0.58, z + 0.58, 'dark');
    const f = C.mesh(new THREE.PlaneGeometry(1.1, 1.9), MAT.vend); f.position.set(-HX + 0.802, 0.98, z); f.rotation.y = Math.PI / 2;
    C.glow(-HX + 1.0, 1.1, z, 0xff4a5e, 2.2, 2.6, 0.25);
    C.light(-HX + 1.2, 1.4, z, 0xff8090, 0.7);
    C.inter({ x: -HX + 1.25, y: 1.2, z, r: 1.7, label: () => rm.st.took ? 'Distributeur vide (une vie par visite)' : 'E : prendre une vie gratuite', act: () => {
      if (rm.st.took) { Au.ui('error'); return; }
      const me = S.me, max = S.diff.lives + 2;
      if (me.lives >= max) { hint('Tu as déjà ' + me.lives + ' vies. Gourmand !'); Au.ui('error'); return; }
      rm.st.took = true; me.lives++; S.lifePop = 1;
      Au.pickup(); Au.meme('yeah_boy', 0.7);
      feed('+1 vie ! (' + me.lives + ')', 'good');
    } });
    // canapé
    const sx = HX - 0.5;
    C.solid(sx - 0.45, HX, 0, 0.45, z - 1.1, z + 1.1, 'mat'); C.solid(HX - 0.22, HX, 0.45, 0.95, z - 1.1, z + 1.1, 'mat');
    C.put('mat', box(sx - 0.45, HX, 0.45, 0.7, z - 1.1, z - 0.9)); C.put('mat', box(sx - 0.45, HX, 0.45, 0.7, z + 0.9, z + 1.1));
    C.decal(noteCanvas('Pas de monstres ici.', '(promis)', rm.k), 0.42, 0.52, HX - 0.012, 1.55, z, -Math.PI / 2);
    schoolDecor(C, 0.6, C.L / 2 - 1.3, { side: 1, noLockers: true, floor: false });
  };

  /* ---------- question de BUT GMP : deux portes, une réponse sur chaque ---------- */
  const quizTime = rm => BR.lerp(19, 10, rm.pl.lvl) * S.diff.time;
  TYPES.quiz.exits = () => [-DX, DX];
  TYPES.quiz.customDoors = true;
  TYPES.quiz.panel = rm => panelCanvas(rm.k, Q[rm.pl.q]);
  TYPES.quiz.build = (rm, C) => {
    const pl = rm.pl, q = Q[pl.q], ZE = rm.ZE; rm.q = q;
    for (const s of [0, 1]) {
      const x = s ? DX : -DX, good = s === pl.good;
      if (good) C.solid(x - DW / 2, x + DW / 2, -0.4, 0, ZE - SAS, ZE, 'floor');
      else {
        // derrière la mauvaise porte : le noir absolu
        const v = C.mesh(new THREE.BoxGeometry(DW - 0.004, DH - 0.004, SAS - 0.06), MAT.void); v.position.set(x, DH / 2, ZE - (SAS - 0.06) / 2 - 0.002);
        C.solid(x - DW / 2, x + DW / 2, -0.4, 0, ZE - SAS, ZE); C.solid(x - DW / 2, x + DW / 2, 0, DH, ZE - SAS - 0.3, ZE - SAS + 0.15);
      }
      const d = makeDoor(rm, C, x, { plate: false, lamp: false, good, hinge: s ? -1 : 1 });
      const sign = d.sign;
      const pmat = C.own(new THREE.MeshPhongMaterial({ map: posterTex(rm.imgs[s]), shininess: 8, specular: 0x111111 }));
      const poster = new THREE.Mesh(GEO.poster, pmat); poster.position.set(sign * (DW / 2 - 0.06), 1.0, 0.027); poster.rotation.z = (C.r() - 0.5) * 0.05; d.piv.add(poster); d.poster = poster;
      const pt = C.ownTex(tex(plaqueCanvas(good ? q[1] : q[2])));
      const plm = C.own(new THREE.MeshPhongMaterial({ map: pt, emissive: 0x3a3a3a, emissiveMap: pt, shininess: 60, specular: 0x444444 }));
      const plaque = new THREE.Mesh(GEO.plaque, plm); plaque.position.set(sign * DW / 2, 1.8, 0.027); d.piv.add(plaque);
      d.img = rm.imgs[s];
    }
    schoolDecor(C, 0.6, C.L - 1.3);
  };
  TYPES.quiz.timeLeft = rm => rm.start < 0 ? null : { left: quizTime(rm) - (ht() - rm.start), tot: quizTime(rm) };
  TYPES.quiz.hud = rm => rm.q[0];
  TYPES.quiz.title = rm => S.o.force ? 'La question' : 'Question ' + (((rm.k - 1) % THEME_EVERY) + 1) + ' / 5' + (rm.k % THEME_EVERY === THEME_EVERY - 1 ? ' · salle piège ensuite !' : '');
  TYPES.quiz.touch = (rm, d) => {
    const goodOpen = rm.doors[rm.pl.good].opened;
    if (rm.start < 0 || S.gRoom < rm.k) { locked(lockMsg(rm)); return; }
    if (goodOpen && !d.good) { locked('La bonne porte est déjà ouverte : suis-la !'); return; }
    openDoor(rm.k, d.s, S.me, true);
  };
  TYPES.quiz.onOpen = (rm, d, by, local, silent) => {
    if (d.poster && !d.good) d.poster.visible = false;
    if (silent) return;
    if (!d.good) {
      const fromMe = by === S.me;
      if (fromMe) chaserFromDoor(rm, d, null, rm.st.timeout ? 'time' : 'wrong');
      else if (by) chaserFromDoor(rm, d, by, 'wrong');
    } else if (local) { Au.tone({ freq: 196, dur: 0.9, gain: 0.07, type: 'triangle' }); Au.tone({ freq: 294, dur: 0.9, gain: 0.05, type: 'triangle', delay: 0.06 }); if (Math.random() < 0.5) Au.meme('amazing', 0.55); }
  };
  TYPES.quiz.update = rm => {
    if (rm.start < 0 || rm.st.timeout) return;
    if (ht() - rm.start > quizTime(rm)) {
      rm.st.timeout = true;
      const me = S.me, bad = rm.doors[1 - rm.pl.good], good = rm.doors[rm.pl.good];
      if (good.opened) return;
      // temps écoulé : la mauvaise porte s'ouvre quand même et son image sort ; la bonne s'ouvre peu après
      if (me.room === rm.k && !me.dead && !S.fail) { if (!bad.opened) openDoor(rm.k, bad.s, me, false); else chaserFromDoor(rm, bad, null, 'time'); }
      else if (!bad.opened) openDoor(rm.k, bad.s, null, false);
      rm.st.reveal = S.time + 2.6;
    }
  };
  TYPES.quiz.local = (rm, dt) => {
    const me = S.me;
    for (const d of rm.doors) if (!d.good && d.opened && Math.abs(me.x - d.x) < DW / 2 && me.z < rm.ZE - 0.25) { fail('dark', { sp: d.img }); return; }
    if (rm.st.reveal && S.time > rm.st.reveal && !rm.doors[rm.pl.good].opened) { rm.st.reveal = 0; openDoor(rm.k, rm.pl.good, null, false); banner('LA BONNE RÉPONSE', rm.q[1], 'good', 2600); }
  };
  function chaserFromDoor(rm, d, target, cause) {
    return spawnChaser({ sp: d.img, x: d.x, z: rm.ZE - 0.35, target, emerge: 0.8, vmax: 14, acc: 20, cause, door: true });
  }

  /* ---------- le sol est de la lave : plateformes (certaines bougent) ---------- */
  Object.assign(TYPES.parkour, { pit: -3, noFloor: true, deadP: 0.1, killCause: 'lava' });
  TYPES.parkour.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX, L = C.L;
    C.solid(-HX, HX, -3, 0, C.z(2.4), C.Z0, 'cap');
    C.solid(-HX, HX, -3, 0, rm.ZE, C.z(L - 2.4), 'cap');
    rm.movers = [];
    for (const p of pl.plats) {
      const zc = C.z((p.u0 + p.u1) / 2), dz = (p.u1 - p.u0) / 2;
      if (p.ax) {
        const geo = worldUV(box(-p.sx / 2, p.sx / 2, -0.45, 0, -dz, dz), 3, 3);
        const m = C.mesh(geo, MAT.cap); m.position.set(p.x, p.y, zc);
        const runes = C.glow(p.x, p.y - 0.5, zc, 0xff8a2a, p.sx * 1.4, 0.5, 0.5);
        const b = C.solid(p.x - p.sx / 2, p.x + p.sx / 2, p.y - 0.45, p.y, zc - dz, zc + dz);
        rm.movers.push({ p, b, m, runes, cx: null });
      } else {
        C.solid(p.x - p.sx / 2, p.x + p.sx / 2, -3, p.y - 0.12, zc - dz, zc + dz, 'stone');
        C.solid(p.x - p.sx / 2 - 0.04, p.x + p.sx / 2 + 0.04, p.y - 0.12, p.y, zc - dz - 0.04, zc + dz + 0.04, 'cap');
      }
      if (pl.plats.indexOf(p) % 2 === 0) C.light(p.x, p.y + 2.3, zc, 0xffc080, 0.75);
    }
    const len = L - 4.8 + 0.6;
    C.put('lava', plane(C.W, len, -Math.PI / 2, 0, 0, -1.0, C.z(L / 2)));
    C.put('lava2', plane(C.W, len, -Math.PI / 2, 0, 0, -0.97, C.z(L / 2)));
    rm.killY = -0.72;
    for (let u = 3; u < L - 2.4; u += 3.4) C.light(0, -0.35, C.z(u), 0xff6a1a, 1.4, { lava: true });
    // braises qui montent
    const N = 46, pos = new Float32Array(N * 3), gp = new THREE.BufferGeometry();
    for (let i = 0; i < N; i++) { pos[i * 3] = (C.r() - 0.5) * C.W; pos[i * 3 + 1] = -1 + C.r() * 4; pos[i * 3 + 2] = C.z(2.4 + C.r() * (L - 4.8)); }
    gp.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = C.own(new THREE.PointsMaterial({ color: 0xffa040, map: TX.glow, size: 0.16, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    const pts = new THREE.Points(gp, pm); pts.frustumCulled = false; C.add(pts); rm.geos.push(gp); rm.embers = { pos, gp, N, L };
    spray(C, 'Le sol est de la lave. Pour de vrai.', '#ffd04a', -1, 1.4, 2.3, 2.2);
    if (pl.plats.some(p => p.ax)) spray(C, 'Elles bougent. Bonne chance.', '#ff8a5a', 1, 4, 2.6, 2);
  };
  TYPES.parkour.update = (rm, dt) => {
    const t = ht() * S.diff.speed;
    for (const mv of rm.movers) {
      const p = mv.p, x = p.x + p.ax * Math.sin(t * 6.2832 / p.per + p.ph);
      mv.b.dx = mv.cx == null ? 0 : x - mv.cx; mv.cx = x;
      mv.b.x0 = x - p.sx / 2; mv.b.x1 = x + p.sx / 2; mv.m.position.x = x; mv.runes.position.x = x;
    }
    const e = rm.embers; if (!e) return;
    for (let i = 0; i < e.N; i++) { let y = e.pos[i * 3 + 1] + dt * (0.5 + (i % 5) * 0.2); if (y > 4) y = -0.9; e.pos[i * 3 + 1] = y; e.pos[i * 3] += Math.sin(S.time * 1.3 + i) * dt * 0.15; }
    e.gp.attributes.position.needsUpdate = true;
  };

  /* ---------- le plancher pourri : chaque planche cède peu après qu'on a marché dessus ---------- */
  Object.assign(TYPES.collapse, { pit: -26, noFloor: true, killCause: 'void' });
  TYPES.collapse.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX, T = pl.T;
    C.solid(-HX, HX, -0.45, 0, C.z(2.2), C.Z0, 'floor');
    C.solid(-HX, HX, -0.45, 0, rm.ZE, C.z(C.L - 2.2), 'floor');
    rm.tiles = [];
    for (let j = 0; j < pl.rows; j++) for (let i = 0; i < pl.cols; i++) {
      const idx = j * pl.cols + i; if (!pl.tiles[idx]) continue;
      const x = -HX + (i + 0.5) * T, z = C.z(2.2 + (j + 0.5) * T);
      const m = new THREE.Mesh(GEO.tile, MAT.plank[(C.r() * 3) | 0]); m.position.set(x, -0.07, z); m.rotation.y = ((C.r() * 4) | 0) * Math.PI / 2; C.add(m);
      const b = C.solid(x - T / 2 + 0.02, x + T / 2 - 0.02, -0.14, 0, z - T / 2 + 0.02, z + T / 2 - 0.02, null, { tile: idx });
      rm.tiles[idx] = { i: idx, x, z, m, b, st: 0, t: 0, vy: 0, rx: 0, rz: 0 };
    }
    // poutres rouillées sous le plancher (on voit le vide entre elles)
    for (let j = 0; j <= pl.rows; j += 2) C.put('metal', box(-HX, HX, -0.42, -0.3, C.z(2.2 + j * T) - 0.06, C.z(2.2 + j * T) + 0.06));
    const bot = C.mesh(new THREE.PlaneGeometry(C.W, C.L).rotateX(-Math.PI / 2), MAT.hole); bot.position.set(0, -26, (rm.Z0 + rm.ZE) / 2);
    rm.killY = -3.5;
    spray(C, 'NE T\'ARRÊTE PAS', '#ff5a3c', -1, 1.2, 2.2, 1.8);
    spray(C, 'le vide est très vide', '#a0c4ff', 1, C.L * 0.5, 2.4, 1.8);
  };
  function crumble(rm, t, local) {
    if (!t || t.st !== 0) return;
    t.st = 1; t.t = 0;
    const d = Math.hypot(t.x - S.cam.position.x, t.z - S.cam.position.z), g = BR.clamp(1.2 - d / 14, 0, 1);
    if (g > 0) { Au.noise({ type: 'bandpass', freq: 900, q: 2, dur: 0.25, gain: 0.12 * g, pan: panOf(t.x, t.z) }); Au.tone({ freq: 140, freqEnd: 90, dur: 0.3, gain: 0.05 * g, type: 'sawtooth', lp: 500, pan: panOf(t.x, t.z) }); }
    if (local && !S.solo) BR.Net.relay({ k: 'ev', r: rm.k, a: 't', v: t.i }, '*');
  }
  const tileAt = (rm, x, z) => rm.tiles.find(t => t && t.st === 0 && Math.abs(x - t.x) < 0.64 && Math.abs(z - t.z) < 0.64);
  TYPES.collapse.update = (rm, dt) => {
    const delay = rm.pl.delay / S.diff.speed;
    for (const t of rm.tiles) {
      if (!t) continue;
      if (t.st === 1) {
        t.t += dt; const k = t.t / delay;
        t.m.position.set(t.x + (Math.random() - 0.5) * 0.05 * k, -0.07 - k * 0.04 + (Math.random() - 0.5) * 0.03, t.z + (Math.random() - 0.5) * 0.05 * k);
        if (t.t >= delay) {
          t.st = 2; t.t = 0; t.b.off = true; t.vy = 0; t.rx = (Math.random() - 0.5) * 3; t.rz = (Math.random() - 0.5) * 3;
          const d = Math.hypot(t.x - S.cam.position.x, t.z - S.cam.position.z), g = BR.clamp(1.2 - d / 14, 0, 1);
          if (g > 0) { Au.noise({ type: 'lowpass', freq: 600, freqEnd: 120, dur: 0.5, gain: 0.25 * g, pan: panOf(t.x, t.z) }); Au.noise({ type: 'bandpass', freq: 2200, q: 3, dur: 0.12, gain: 0.08 * g }); }
        }
      } else if (t.st === 2) {
        t.t += dt; t.vy -= 14 * dt; t.m.position.y += t.vy * dt; t.m.rotation.x += t.rx * dt; t.m.rotation.z += t.rz * dt;
        if (t.t > 2.4) { t.st = 3; t.t = 0; t.m.visible = false; }
      } else if (t.st === 3) {
        t.t += dt;
        if (t.t > 6) { t.st = 0; t.m.visible = true; t.m.position.set(t.x, -0.07, t.z); t.m.rotation.x = t.m.rotation.z = 0; t.b.off = false; }
      }
    }
    for (const p of S.players.values()) if (p !== S.me && !p.dead && Math.abs(p.y) < 0.2) crumble(rm, tileAt(rm, p.x, p.z), false);
  };
  TYPES.collapse.local = rm => {
    const me = S.me;
    if (me.ground && me.plat && me.plat.tile != null) crumble(rm, rm.tiles[me.plat.tile], true);
  };
  TYPES.collapse.event = (rm, e) => { if (e.a === 't') crumble(rm, rm.tiles[e.v | 0], false); };

  /* ---------- 1, 2, 3… soleil : avancer au vert, statue au rouge ---------- */
  Object.assign(TYPES.redlight, { neons: false });
  TYPES.redlight.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX, H = C.H, L = C.L;
    for (let u = 2.5; u < L - 1; u += 4.5) for (const x of [-HX * 0.5, HX * 0.5]) neon(C, x, C.z(u), H, false, 0xf4f8ff, 1.15);
    C.put('steel', plane(C.W - 0.3, 0.12, -Math.PI / 2, 0, 0, 0.004, C.z(1.7)));
    C.put('red', plane(C.W - 0.3, 0.16, -Math.PI / 2, 0, 0, 0.004, C.z(L - 1.4)));
    C.put('steel', plane(0.08, L - 4, -Math.PI / 2, 0, 0, 0.003, C.z(L / 2)));
    for (const s of [-1, 1]) for (let u = 1.0; u < L - 2.2; u += 2.05) C.put('mat', box(s * HX - s * 0.09, s * HX, 0.12, 1.95, C.z(u + 1.9), C.z(u)));   // protections murales
    rm.covers = [];
    for (const cv0 of pl.cover) {
      const z = C.z(cv0.u);
      rm.covers.push(C.solid(cv0.x - 0.55, cv0.x + 0.55, 0, 2.3, z - 0.55, z + 0.55, 'mat'));
      C.put('mat2', box(cv0.x - 0.57, cv0.x + 0.57, 2.3, 2.4, z - 0.57, z + 0.57));
      C.put('mat2', box(cv0.x - 0.57, cv0.x + 0.57, 1.1, 1.22, z - 0.57, z + 0.57));
    }
    // l'entité, géante, au fond (dos tourné = silhouette noire)
    const sp = rm.imgs[0], spr = E.sprite(sp), hh = 3.7, ww = hh * (spr ? spr.aspect : 0.7);
    const g = new THREE.Group(); g.position.set(pl.side * 2.7, 0.3, rm.ZE + 1.1);
    const geo = new THREE.PlaneGeometry(ww, hh).translate(0, hh / 2, 0); rm.geos.push(geo);
    const front = new THREE.Mesh(geo, C.own(new THREE.MeshBasicMaterial({ map: chaseTex(sp), transparent: true, alphaTest: 0.06 })));
    const back = new THREE.Mesh(geo, C.own(new THREE.MeshBasicMaterial({ map: chaseTex(sp), color: 0x060606, transparent: true, alphaTest: 0.06 }))); back.rotation.y = Math.PI;
    g.add(front, back); g.rotation.y = Math.PI; C.add(g);
    C.solid(g.position.x - 1.1, g.position.x + 1.1, 0, 0.3, rm.ZE + 0.2, rm.ZE + 2.0, 'dark');
    const eyeGlow = C.glow(g.position.x, 0.3 + hh * 0.72, g.position.z + 0.4, 0xff2020, ww * 1.4, hh * 0.6, 0);
    rm.ent = { g, sp, ang: Math.PI, seg: -1, eyeGlow, x: g.position.x, z: g.position.z, h: hh };
    spray(C, 'Au rouge : STATUE.', '#ff4a4a', -1, 2.2, 2.4, 2.2);
    spray(C, 'Il voit à travers tout… sauf les tapis.', '#7ab8ff', 1, 6, 2.6, 2.4);
  };
  function rlPhase(rm) {
    if (rm.start < 0) return { red: false, tin: 0, left: 99, i: -1 };
    let t = ((ht() - rm.start) * S.diff.speed) % rm.pl.tot; const sg = rm.pl.segs;
    for (let i = 0; i < sg.length; i++) { if (t < sg[i]) return { red: i % 2 === 1, tin: t, left: sg[i] - t, i }; t -= sg[i]; }
    return { red: false, tin: 0, left: 1, i: 0 };
  }
  TYPES.redlight.update = (rm, dt) => {
    const ph = rlPhase(rm), e = rm.ent;
    const tgt = ph.red ? 0 : Math.PI;
    e.ang += BR.clamp(tgt - e.ang, -dt * 11, dt * 11); e.g.rotation.y = e.ang;
    e.eyeGlow.material.opacity = ph.red ? 0.35 + Math.sin(S.time * 20) * 0.08 : 0;
    rm.tint = rm.start < 0 ? null : ph.red ? RED_T : GREEN_T;
    rm.phase = ph;
    if (ph.i !== e.seg) {
      e.seg = ph.i;
      if (ph.i >= 0 && S.me.room === rm.k && !S.me.dead) {
        if (ph.red) { Au.speak('Soleil !', { rate: 1.05, pitch: 0.35, volume: 0.75 }); Au.tone({ freq: 220, freqEnd: 110, dur: 0.5, gain: 0.16, type: 'square', lp: 900 }); Au.noise({ type: 'lowpass', freq: 300, dur: 0.4, gain: 0.25 }); }
        else { Au.speak('Un, deux, trois…', { rate: 0.95, pitch: 0.6, volume: 0.6 }); [523, 659, 784].forEach((f, i) => Au.tone({ freq: f, dur: 0.18, gain: 0.06, type: 'triangle', delay: i * 0.22 })); }
      }
    }
  };
  const RED_T = new THREE.Color(1, 0.22, 0.18), GREEN_T = new THREE.Color(0.72, 1, 0.78), PURPLE_T = new THREE.Color(0.85, 0.6, 1);
  // segment (a → b) coupé par une boîte (vue de dessus)
  function segHits(ax, az, bx, bz, b, pad) {
    pad = pad || 0;
    let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
    for (const [p, d, lo, hi] of [[ax, dx, b.x0 - pad, b.x1 + pad], [az, dz, b.z0 - pad, b.z1 + pad]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
      let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) { const q = ta; ta = tb; tb = q; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false;
    }
    return true;
  }
  TYPES.redlight.local = rm => {
    const ph = rm.phase, me = S.me; if (!ph || !ph.red || rm.start < 0 || S.inv > 0) return;
    if (ph.tin < 0.45 / S.diff.speed) return;
    const moving = me.speed > 0.9 || Math.abs(me.vy) > 1.2;
    if (!moving) return;
    const e = rm.ent;
    if (rm.covers.some(b => segHits(e.x, e.z, me.x, me.z, b, -0.05))) return;   // caché derrière un tapis
    fail('seen', { sp: e.sp });
  };
  TYPES.redlight.onRespawn = () => {};

  /* ---------- labyrinthe éteint : lampe torche, une entité rôde ---------- */
  Object.assign(TYPES.maze, { neons: false, dark: true, deadP: 1 });
  TYPES.maze.build = (rm, C) => {
    const pl = rm.pl, Cc = pl.C, HX = C.HX, cols = pl.cols, rows = pl.rows, u0 = 1.6, H = C.H;
    const X = i => -HX + i * Cc, U = j => u0 + j * Cc;
    const wall = (x0, x1, ua, ub) => C.solid(x0, x1, 0, H, C.z(ub), C.z(ua), 'paperw');
    for (let i = 0; i < cols; i++) {
      if (i !== pl.inCol) wall(X(i) - 0.1, X(i + 1) + 0.1, U(0) - 0.1, U(0) + 0.1);
      if (i !== pl.outCol) wall(X(i) - 0.1, X(i + 1) + 0.1, U(rows) - 0.1, U(rows) + 0.1);
    }
    const faces = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const c = j * cols + i;
      if (i < cols - 1 && pl.wallE[c]) { wall(X(i + 1) - 0.1, X(i + 1) + 0.1, U(j) - 0.1, U(j + 1) + 0.1); faces.push({ x: X(i + 1) + 0.106, z: C.z(U(j) + Cc / 2), ry: Math.PI / 2 }, { x: X(i + 1) - 0.106, z: C.z(U(j) + Cc / 2), ry: -Math.PI / 2 }); }
      if (j < rows - 1 && pl.wallS[c]) { wall(X(i) - 0.1, X(i + 1) + 0.1, U(j + 1) - 0.1, U(j + 1) + 0.1); faces.push({ x: X(i) + Cc / 2, z: C.z(U(j + 1)) + 0.106, ry: 0 }, { x: X(i) + Cc / 2, z: C.z(U(j + 1)) - 0.106, ry: Math.PI }); }
    }
    const jokes = ['PAR ICI →', 'c\'est pas par là', 't\'es perdu ?', 'demi-tour !', 'ça sent le cul-de-sac', 'il est derrière toi (non)', '← SORTIE (peut-être)', 'coucou', 'j\'ai faim'];
    const cols2 = ['#ff4fd8', '#7dff6a', '#ffe14a', '#4ad8ff'];
    BR.shuffle(faces, C.r).slice(0, 5).forEach((f, i) => C.decal(sprayCanvas(jokes[(C.r() * jokes.length) | 0], cols2[i % 4]), 1.5, 0.75, f.x, 1.55, f.z, f.ry, { transparent: true, emissive: true }));
    C.light(pl.ex, H - 0.35, C.z(C.L - 0.7), 0xff2a1a, 0.9); C.glow(pl.ex, DH + 0.2, rm.ZE + 0.15, 0xff2a1a, 1.6, 0.7, 0.5);
    C.light(pl.en, H - 0.35, C.z(0.7), 0xffd9a0, 0.55);
    rm.cell = c => ({ x: X(c % cols) + Cc / 2, z: C.z(U((c / cols) | 0) + Cc / 2) });
    rm.cellAt = (x, z) => { const i = Math.floor((x + HX) / Cc), j = Math.floor((rm.Z0 - z - u0) / Cc); return i < 0 || j < 0 || i >= cols || j >= rows ? -1 : j * cols + i; };
    rm.nbs = c => { const i = c % cols, j = (c / cols) | 0, o = []; if (i < cols - 1 && !pl.wallE[c]) o.push(c + 1); if (i > 0 && !pl.wallE[c - 1]) o.push(c - 1); if (j < rows - 1 && !pl.wallS[c]) o.push(c + cols); if (j > 0 && !pl.wallS[c - cols]) o.push(c - cols); return o; };
    if (pl.hunt) {
      const sp = rm.imgs[1], mat = C.own(new THREE.MeshBasicMaterial({ map: chaseTex(sp), transparent: true, alphaTest: 0.06, side: THREE.DoubleSide }));
      const mesh = new THREE.Mesh(GEO.chase, mat); mesh.frustumCulled = false; C.add(mesh);
      const spr = E.sprite(sp), h = 1.9; mesh.scale.set(h * (spr ? spr.aspect : 0.7), h, 1);
      const home = (rows - 1) * cols + ((pl.outCol + Math.floor(cols / 2)) % cols);
      rm.hunt = { mesh, mat, sp, home, c: home, next: -1, prev: -1, x: 0, z: 0, voice: null };
      huntReset(rm);
      rm.bye.push(() => { if (rm.hunt.voice) rm.hunt.voice.stop(); });
    }
    spray(C, 'Lampe torche : automatique. Courage : non fourni.', '#ffe14a', -1, 0.8, 2.0, 1.4);
  };
  function huntReset(rm) { const h = rm.hunt; if (!h) return; h.c = h.home; h.next = -1; h.prev = -1; const p = rm.cell(h.c); h.x = p.x; h.z = p.z; h.mesh.position.set(h.x, 0, h.z); }
  TYPES.maze.update = (rm, dt) => {
    const h = rm.hunt; if (!h) return;
    const active = rm.start >= 0 && S.me.room === rm.k && !S.me.dead;
    h.mesh.visible = active;
    if (!active) { if (h.voice) { h.voice.stop(); h.voice = null; } return; }
    if (!h.voice) h.voice = Au.botVoice(h.sp) || null;
    if (h.next < 0) {
      let nb = rm.nbs(h.c); if (nb.length > 1) nb = nb.filter(c => c !== h.prev);
      const me = S.me, mc = rm.cellAt(me.x, me.z);
      if (mc >= 0 && Math.random() < 0.45) { const tp = rm.cell(mc); nb.sort((a, b) => { const pa = rm.cell(a), pb = rm.cell(b); return Math.hypot(pa.x - tp.x, pa.z - tp.z) - Math.hypot(pb.x - tp.x, pb.z - tp.z); }); h.next = nb[0]; }
      else h.next = nb[(Math.random() * nb.length) | 0];
    }
    const tp = rm.cell(h.next), dx = tp.x - h.x, dz = tp.z - h.z, d = Math.hypot(dx, dz), st = rm.pl.huntSpeed * S.diff.speed * dt;
    if (d <= st) { h.x = tp.x; h.z = tp.z; h.prev = h.c; h.c = h.next; h.next = -1; } else { h.x += dx / d * st; h.z += dz / d * st; }
    h.mesh.position.set(h.x + Math.sin(S.time * 7) * 0.04, Math.abs(Math.sin(S.time * 6)) * 0.08, h.z);
    h.mesh.rotation.y = Math.atan2(S.cam.position.x - h.x, S.cam.position.z - h.z);
    if (h.voice) h.voice.set(h.x, 1.3, h.z, 0.9);
  };
  TYPES.maze.local = rm => {
    const h = rm.hunt, me = S.me; if (!h || !h.mesh.visible || S.inv > 0) return;
    if (Math.hypot(h.x - me.x, h.z - me.z) < 0.75 && me.y < 1.2) fail('caught', { sp: h.sp });
  };
  TYPES.maze.onRespawn = rm => huntReset(rm);

  /* ---------- le trousseau : trouver la clé qui correspond au cadenas ---------- */
  const keyName = k => 'clé ' + KSYM[k.s] + ' ' + KCOL[k.c][0] + ' (' + KSYMN[k.s] + ')';
  function keyMesh(C, ci, si) {
    const g = new THREE.Group(), metal = si % 2 ? MAT.silver : MAT.gold;
    const ring = new THREE.Mesh(GEO.keyRing, metal), bit = new THREE.Mesh(GEO.keyBit, metal);
    ring.rotation.x = Math.PI / 2; bit.rotation.z = Math.PI / 2;   // posée à plat par défaut
    g.add(ring, new THREE.Mesh(GEO.keyShaft, metal), bit);
    const tm = C.own(new THREE.MeshPhongMaterial({ map: C.ownTex(tex(tagCanvas(ci, si))), side: THREE.DoubleSide, shininess: 10 }));
    const tag = new THREE.Mesh(GEO.tag, tm); tag.position.set(0, -0.005, 0.07); tag.rotation.x = -Math.PI / 2; g.add(tag);
    return g;
  }
  TYPES.keys.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX, r = C.r, spots = [];
    const nc = C.W > 9.5 ? 3 : 2, sx = Math.min(3.6, (C.W - 2.6) / (nc - 0.2));
    for (const u of [3.2, 5.7, 8.2]) for (let i = 0; i < nc; i++) desk(C, (i - (nc - 1) / 2) * sx + (r() - 0.5) * 0.3, C.z(u), 1.2, 0.6).forEach(p => spots.push(Object.assign(p, { flat: true })));
    desk(C, -HX + 1.4, C.z(C.L - 2.0), 1.8, 0.8, 'woodDark').forEach(p => spots.push(Object.assign(p, { flat: true })));
    // tableau à clés au mur de droite
    const kz = C.z(4.4); C.put('woodDark', box(HX - 0.05, HX, 1.2, 1.95, kz - 0.7, kz + 0.7));
    for (let i = 0; i < 5; i++) { const z = kz - 0.56 + i * 0.28; C.put('steel', box(HX - 0.12, HX - 0.05, 1.68, 1.7, z - 0.01, z + 0.01)); spots.push({ x: HX - 0.1, y: 1.6, z, hang: true }); }
    // sur les casiers, par terre dans un coin, sur le radiateur
    spots.push({ x: -HX + 0.4, y: 0.01, z: C.z(1.3), flat: true }, { x: HX - 0.4, y: 0.01, z: C.z(C.L - 1.0), flat: true }, { x: HX - 0.5, y: 0.01, z: C.z(7.2), flat: true });
    schoolDecor(C, 0.6, C.L - 1.2, { side: -1, floor: false });
    BR.shuffle(spots, r);
    rm.keys = pl.keys.map((k, j) => {
      const p = spots[j % spots.length], g = keyMesh(C, k.c, k.s);
      if (p.hang) { g.rotation.order = 'YXZ'; g.rotation.set(-Math.PI / 2, Math.PI / 2, 0); g.position.set(p.x, p.y + 0.06, p.z); }
      else { g.rotation.y = r() * 6.28; g.position.set(p.x + (r() - 0.5) * 0.2, p.y + 0.012, p.z + (r() - 0.5) * 0.15); }
      g.scale.setScalar(1.6); C.add(g);
      C.glow(g.position.x, g.position.y + 0.06, g.position.z, 0xfff0b0, 0.55, 0.55, pl.lvl < 0.5 ? 0.5 : 0.22);
      C.inter({ x: g.position.x, y: g.position.y, z: g.position.z, r: 1.6, label: () => 'E : prendre la ' + keyName(k), act: () => {
        S.held = { k: rm.k, c: k.c, s: k.s }; Au.pickup(); hint('Tu as la ' + keyName(k) + '. Va l\'essayer sur la porte.');
      } });
      return g;
    });
    // cadenas sur la porte
    const d = rm.doors[0], lock = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.06), MAT.gold); rm.geos.push(body.geometry);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 16, Math.PI), MAT.steel); sh.position.y = 0.075; rm.geos.push(sh.geometry);
    const tag = keyMesh(C, pl.tgt.c, pl.tgt.s).children[3]; tag.position.set(0, -0.06, 0.035); tag.rotation.set(0, 0, 0.12); tag.scale.set(1.5, 1.5, 1.5);
    lock.add(body, sh, tag); lock.position.set(d.sign * (DW - 0.16), 1.2, 0.07); d.piv.add(lock); rm.lock = lock;
  };
  TYPES.keys.timeLeft = rm => rm.start < 0 || rm.solved ? null : { left: rm.pl.limit * S.diff.time + (rm.st.bonus || 0) - (ht() - rm.start), tot: rm.pl.limit * S.diff.time, keeper: true };
  TYPES.keys.hud = rm => 'Cadenas : ' + keyName(rm.pl.tgt) + '. Prends-la (E) et va à la porte.';
  TYPES.keys.side = rm => S.held && S.held.k === rm.k ? '<div class="d-held"><span>Dans ta main</span><b style="color:' + KCOL[S.held.c][1] + '">' + KSYM[S.held.s] + '</b><em>' + KCOL[S.held.c][0] + '</em></div>' : '';
  TYPES.keys.lockMsg = rm => 'Il faut la ' + keyName(rm.pl.tgt) + '.';
  TYPES.keys.tryDoor = rm => {
    if (rm.start < 0 || S.gRoom < rm.k) { locked(lockMsg(rm)); return; }
    const h = S.held;
    if (!h || h.k !== rm.k) { locked('Il faut la ' + keyName(rm.pl.tgt) + '. Cherche dans la salle !'); return; }
    if (h.c === rm.pl.tgt.c && h.s === rm.pl.tgt.s) { S.held = null; solve(rm, true); Au.meme('amazing', 0.6); return; }
    S.held = null; rm.st.bonus = (rm.st.bonus || 0) - 6;
    Au.meme('goofy_horn', 0.7) || Au.ui('error');
    banner('MAUVAISE CLÉ', BR.pick(['Elle ne rentre même pas. Gênant.', 'Presque ! (non)', 'Le gardien a entendu… −6 s.']), 'bad', 1800);
  };
  TYPES.keys.onSolve = rm => { if (rm.lock) rm.lock.visible = false; };

  /* ---------- les portes piégées : énigme logique, une seule bonne porte ---------- */
  TYPES.trapdoors.exits = rm => rm.pl.xs;
  TYPES.trapdoors.customDoors = true;
  function riddleCanvas(clues, cols) {
    const w = 1024, h = 720, c = cv(w, h), g = c.getContext('2d'), r = BR.rngFrom(77);
    g.fillStyle = '#5a3c22'; g.fillRect(0, 0, w, h); g.fillStyle = '#20392c'; g.fillRect(24, 24, w - 48, h - 48);
    for (let i = 0; i < 10; i++) blob(g, 24 + r() * (w - 48), 24 + r() * (h - 48), 60 + r() * 120, '230,240,230', 0.05, 0, 0);
    g.fillStyle = '#f2f2e8'; g.font = 'bold 62px "Comic Sans MS", "Segoe Print", cursive'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('LA BONNE PORTE…', w / 2, 104);
    const names = {}; cols.forEach(cc => { names[cc[0]] = cc[1]; });
    let y = 190; const fs = clues.length > 3 ? 40 : 46; g.font = 'bold ' + fs + 'px "Comic Sans MS", "Segoe Print", cursive'; g.textAlign = 'left';
    for (const t of clues) {
      let x = 70; g.fillStyle = '#f2f2e8'; g.fillText('•', 46, y);
      for (const wd of t.split(' ')) {
        const bare = wd.replace(/[.,]/g, ''), ww = g.measureText(wd + ' ').width;
        if (x + ww > w - 50) { x = 70; y += fs * 1.2; }
        const col = names[bare]; g.fillStyle = col ? new THREE.Color(col).lerp(new THREE.Color(1, 1, 1), 0.35).getStyle() : '#f2f2e8';
        g.fillText(wd, x, y); x += ww;
      }
      y += fs * 1.55;
    }
    grain(g, w, h, 10, r);
    return c;
  }
  TYPES.trapdoors.build = (rm, C) => {
    const pl = rm.pl, ZE = rm.ZE, HX = C.HX;
    pl.xs.forEach((x, i) => {
      const good = i === pl.good, col = new THREE.Color(pl.cols[i][1]);
      const mat = C.own(new THREE.MeshPhongMaterial({ map: TX.door, color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.15), specular: 0x333333, shininess: 35 }));
      if (good) C.solid(x - DW / 2, x + DW / 2, -0.4, 0, ZE - SAS, ZE, 'floor');
      else {
        C.solid(x - DW / 2, x + DW / 2, -0.4, 0, ZE - 0.95, ZE, 'floor');
        C.solid(x - DW / 2, x + DW / 2, 0, DH, ZE - 1.05, ZE - 0.95, 'dark');
      }
      const d = makeDoor(rm, C, x, { plate: false, lamp: false, good, mat, hinge: 1 });
      d.trap = pl.traps[i];
      C.put('dark', box(x - 0.3, x + 0.3, DH + 0.1, DH + 0.24, ZE, ZE + 0.03));
      const nm = C.decal(sprayCanvas(pl.cols[i][0].toUpperCase(), pl.cols[i][1]), 0.6, 0.3, x, DH + 0.17, ZE + 0.035, 0, { transparent: true, emissive: true }); nm.renderOrder = 2;
      if (d.trap === 'glove') {
        const gl = new THREE.Group(), arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5), MAT.steel);
        const fist = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), MAT.glove); fist.scale.set(1, 0.85, 1.2); fist.position.z = 1.0;
        rm.geos.push(arm.geometry, fist.geometry); gl.add(arm, fist); gl.position.set(x, 1.25, ZE - 0.95); gl.scale.z = 0.15; C.add(gl); d.glove = gl;
      } else if (d.trap === 'brick') { const b = C.mesh(new THREE.PlaneGeometry(DW - 0.02, DH - 0.02), MAT.bricks); b.position.set(x, DH / 2, ZE - 0.4); }
      d.img = rm.imgs[i % 2];
    });
    C.decal(riddleCanvas(pl.clues, pl.cols), 1.75, 1.23, -HX + 0.015, 1.6, C.z(2.6), Math.PI / 2);
    C.decal(riddleCanvas(pl.clues, pl.cols), 1.75, 1.23, HX - 0.015, 1.6, C.z(2.6), -Math.PI / 2);
    C.light(-HX + 0.8, 2.6, C.z(2.6), 0xfff0d0, 0.5); C.light(HX - 0.8, 2.6, C.z(2.6), 0xfff0d0, 0.5);
  };
  TYPES.trapdoors.hud = () => 'Une seule porte est la bonne. Les indices sont au tableau (et ici à droite).';
  TYPES.trapdoors.side = rm => '<div class="d-clues"><h5>LA BONNE PORTE…</h5>' + rm.pl.clues.map(t => '<p>' + BR.esc(t).replace(new RegExp('\\b(' + rm.pl.cols.map(c => c[0]).join('|') + ')\\b', 'g'), m => '<b style="color:' + rm.pl.cols.find(c => c[0] === m)[1] + '">' + m + '</b>') + '</p>').join('') + '</div>';
  TYPES.trapdoors.touch = (rm, d) => {
    if (rm.start < 0 || S.gRoom < rm.k) { locked(lockMsg(rm)); return; }
    if (rm.solved && !d.good) { locked('La bonne porte est déjà ouverte !'); return; }
    openDoor(rm.k, d.s, S.me, true);
  };
  TYPES.trapdoors.onOpen = (rm, d, by, local, silent) => {
    if (d.good) { if (!rm.solved) solve(rm, false); if (local) { Au.meme('yeah_boy', 0.6); banner('BONNE PORTE !', 'Ton cerveau a survécu.', 'good', 1600); } return; }
    if (d.glove) d.punch = silent ? 1 : 0.001;
    if (silent) return;
    const me = by === S.me;
    if (d.trap === 'brick') { if (me) { Au.meme('what', 0.7); banner('RATÉ :)', 'Juste un mur. Et un peu de honte.', 'bad', 1800); } }
    else if (d.trap === 'monster') { chaserFromDoor(rm, d, me ? null : by, 'caught').vmax = 11; }
    else if (d.trap === 'glove') {
      Au.fx('hit', { g: 1.2 }); Au.tone({ freq: 300, freqEnd: 900, dur: 0.25, gain: 0.08, type: 'triangle', delay: 0.05 });
      if (me) rm.st.punch = S.time + 0.11;   // le gant sort… et frappe
    }
  };
  TYPES.trapdoors.update = (rm, dt) => {
    if (rm.st.punch && S.time >= rm.st.punch) {
      rm.st.punch = 0;
      if (!S.fail && !S.me.dead && S.me.room === rm.k && fail('punch')) { const m = S.me; m.vz = 10.5; m.vy = 6.2; m.vx = (Math.random() - 0.5) * 3; m.ground = false; m.plat = null; }
    }
    for (const d of rm.doors) if (d.glove && d.punch) {
      d.punch = Math.min(1, d.punch + dt * 1.2);
      const k = d.punch < 0.12 ? d.punch / 0.12 : d.punch < 0.5 ? 1 : 1 - (d.punch - 0.5) / 0.5 * 0.55;
      d.glove.scale.z = 0.15 + k * 1.35; d.glove.position.y = 1.25 + Math.sin(S.time * 18) * 0.01 * k;
    }
  };

  /* ---------- épilation laser ---------- */
  Object.assign(TYPES.lasers, { deadP: 0.35 });
  TYPES.lasers.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX, H = C.H;
    const core = C.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.15), toneMapped: false }));
    const halo = C.own(new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    const mk = (vert) => { const g = new THREE.Group(); g.add(new THREE.Mesh(GEO.beam, core), new THREE.Mesh(GEO.beamGlow, halo)); if (vert) g.rotation.z = Math.PI / 2; C.add(g); return g; };
    const emit = (y, z) => { for (const s of [-1, 1]) { C.put('dark', box(s * HX - 0.12, s * HX + 0.12, y - 0.07, y + 0.07, z - 0.09, z + 0.09)); } };
    rm.beams = [];
    const addH = (def, y, z, kind) => { const g = mk(false); g.scale.x = C.W; g.position.set(0, y, z); if (kind !== 'sweepY') emit(y, z); rm.beams.push({ def, kind, y, z, x: 0, g, on: true }); };
    for (const def of pl.lasers) {
      const z = C.z(def.u);
      if (def.kind === 'low') addH(def, 0.34, z, 'h');
      else if (def.kind === 'high') addH(def, 1.32, z, 'h');
      else if (def.kind === 'double') { addH(def, 0.34, z, 'h'); addH(def, 1.32, z - 1.25, 'h'); }
      else if (def.kind === 'blink') for (const y of [0.3, 0.7, 1.1, 1.5, 1.9]) addH(def, y, z, 'blink');
      else if (def.kind === 'sweepY') { addH(def, 0.5, z, 'sweepY'); for (const s of [-1, 1]) C.put('metal', box(s * HX - 0.06, s * HX + 0.06, 0, 2.2, z - 0.05, z + 0.05)); }
      else if (def.kind === 'sweepX') { const g = mk(true); g.scale.x = H; g.position.set(0, H / 2, z); rm.beams.push({ def, kind: 'sweepX', y: 0, z, x: 0, g, on: true }); C.put('metal', box(-HX, HX, H - 0.08, H, z - 0.06, z + 0.06)); C.put('metal', box(-HX, HX, 0, 0.03, z - 0.06, z + 0.06)); }
      C.light(0, 1.2, z, 0xff2010, 0.3, { laser: true });
    }
    spray(C, 'Épilation gratuite →', '#ff4a4a', -1, 1.4, 2.2, 1.6);
    spray(C, 'baisse-toi : C', '#7dffa8', 1, 3.6, 2.3, 1.4);
  };
  TYPES.lasers.update = rm => {
    const t = ht() * S.diff.speed, HX = rm.HX;
    for (const b of rm.beams) {
      const d = b.def, ph = (t + d.ph) / d.per;
      if (b.kind === 'sweepY') { b.y = 0.22 + (0.5 - 0.5 * Math.cos(ph * 6.2832)) * 1.55; b.g.position.y = b.y; }
      else if (b.kind === 'sweepX') { b.x = Math.sin(ph * 6.2832 / 1.3) * (HX - 0.35); b.g.position.x = b.x; }
      else if (b.kind === 'blink') { const c = ph - Math.floor(ph); b.on = c < 0.5; b.g.visible = b.on || (c > 0.88 && Math.sin(S.time * 60) > 0); }
    }
  };
  TYPES.lasers.local = rm => {
    if (S.inv > 0) return;
    const me = S.me, h = me.crouch ? MV.hC : MV.hS, R = 0.2;
    for (const b of rm.beams) {
      if (!b.on) continue;
      if (b.kind === 'sweepX') { if (Math.hypot(me.x - b.x, me.z - b.z) < R) { zap(b); return; } continue; }
      if (Math.abs(me.z - b.z) < R && b.y > me.y + 0.02 && b.y < me.y + h) { zap(b); return; }
    }
    function zap() { S.flashW = 1; fail('zap'); }
  };

  /* ---------- poursuite : l'entité surgit derrière toi ---------- */
  Object.assign(TYPES.chase, { deadP: 0.2 });
  TYPES.chase.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX, W = C.W;
    schoolDecor(C, 0.6, C.L - 1.2, { noLockers: true });
    for (const o of pl.obs) {
      const z = C.z(o.u);
      if (o.kind === 'desk') { const x = (o.f - 0.5) * (W - 2.2); C.solid(x - 0.7, x + 0.7, 0, 0.75, z - 0.35, z + 0.35, 'wood'); for (const a of [-0.6, 0.6]) C.put('metal', box(x + a - 0.03, x + a + 0.03, 0.75, 1.3, z - 0.03, z + 0.03)); }
      else if (o.kind === 'lockers') { const x0 = o.side * HX, x1 = o.side * (HX - W * 0.56); C.solid(x0, x1, 0, 0.55, z - 0.35, z + 0.35, 'lockBodyA'); }
      else if (o.kind === 'pipe') { C.solid(-HX, HX, 1.2, 1.38, z - 0.12, z + 0.12, 'metal'); C.put('red', box(-0.3, 0.3, 1.13, 1.2, z - 0.005, z + 0.005)); }
      else if (o.kind === 'table') { const x = (o.f - 0.5) * (W - 2.4); desk(C, x, z, 1.6, 0.9, 'woodDark'); }
    }
    spray(C, 'NE TE RETOURNE PAS', '#ff4a4a', 1, 2.0, 2.3, 2.2);
  };
  TYPES.chase.local = (rm, dt) => {
    const me = S.me, u = rm.Z0 - me.z, st = rm.st;
    if (!st.ch && !st.done && st.warn == null && u > 3.0 && rm.start >= 0) {
      st.warn = 0.9; S.panic = 1;
      banner('COURS !', 'Quelque chose arrive derrière toi…', 'bad', 1800);
      Au.fx('roar', { g: 1.2 }); Au.meme(BR.pick(['evil_laugh', 'possessed_laugh', 'demonic_laugh']), 0.6);
    }
    if (st.warn != null && !st.ch) {
      st.warn -= dt;
      if (st.warn <= 0) {
        st.warn = null;
        st.ch = spawnChaser({ sp: rm.imgs[0], x: rm.pl.en, z: rm.Z0 - 0.4, vmax: rm.pl.speed * S.diff.speed, acc: 5, emerge: 0.35, cause: 'caught' });
        if (!S.solo) BR.Net.relay({ k: 'ev', r: rm.k, a: 'run' }, '*');
      }
    }
    if (st.ch && me.z < rm.ZE + 0.6) {
      st.ch.flee = true; st.ch = null; st.done = true;
      Au.meme('wowowow', 0.6); banner('OUF !', 'Il s\'est cogné contre la porte.', 'good', 1700);
    }
  };
  TYPES.chase.onRespawn = rm => { rm.st.ch = null; rm.st.warn = null; };
  TYPES.chase.event = (rm, e, p) => { if (e.a === 'run' && p) spawnChaser({ sp: rm.imgs[0], x: rm.pl.en, z: rm.Z0 - 0.4, target: p, vmax: rm.pl.speed * S.diff.speed, acc: 5, emerge: 0.35, life: 9, until: rm.ZE + 0.6 }); };

  /* ---------- ne le regarde pas : une entité flotte, la regarder remplit la jauge ---------- */
  Object.assign(TYPES.eyes, { deadP: 0.3 });
  TYPES.eyes.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX;
    rm.shelves = [];
    for (const sh of pl.shelves) {
      const z = C.z(sh.u), x0 = sh.side * HX, x1 = sh.side * (HX - sh.len), xc = (x0 + x1) / 2;
      rm.shelves.push(C.solid(x0, x1, 0, 2.4, z - 0.25, z + 0.25, 'woodDark'));
      for (const s of [-1, 1]) { const m = C.mesh(new THREE.PlaneGeometry(sh.len - 0.04, 2.36), MAT.books); m.position.set(xc, 1.2, z + s * 0.252); m.rotation.y = s > 0 ? 0 : Math.PI; }
    }
    rm.eyes = [];
    for (let i = 0; i < pl.n; i++) {
      const sp = rm.imgs[i], spr = E.sprite(sp), h = 1.7;
      const mat = C.own(new THREE.MeshBasicMaterial({ map: chaseTex(sp), color: 0xe8c8ff, transparent: true, alphaTest: 0.06, side: THREE.DoubleSide }));
      const mesh = new THREE.Mesh(GEO.chase, mat); mesh.frustumCulled = false; mesh.scale.set(h * (spr ? spr.aspect : 0.7), h, 1); C.add(mesh);
      const glow = C.glow(0, 2, rm.Z0, 0xb050ff, 3.2, 3.2, 0.45);
      const f = C.light(0, 2, rm.Z0, 0xb050ff, 1.2, { eye: true });
      rm.eyes.push({ i, sp, mesh, glow, f, x: 0, y: 2, z: rm.Z0, h });
    }
    spray(C, 'Il est timide. Ne le regarde pas.', '#d68aff', -1, 1.4, 2.6, 2.2);
    spray(C, 'regarde tes pieds !', '#ffe14a', 1, 2.6, 2.7, 1.6);
  };
  TYPES.eyes.update = rm => {
    const t = ht() * S.diff.speed * 0.9, pl = rm.pl;
    for (const e of rm.eyes) {
      e.x = Math.sin(t * 0.35 + e.i * 2.1 + pl.ph) * (rm.HX - 1.2);
      const u = pl.L / 2 + Math.sin(t * 0.23 + pl.ph * 0.7 + e.i * 3.1) * (pl.L / 2 - 4);
      e.z = rm.Z0 - u; e.y = 1.5 + Math.sin(t * 1.3 + e.i) * 0.18;
      e.mesh.position.set(e.x, e.y, e.z); e.mesh.rotation.y = Math.atan2(S.cam.position.x - e.x, S.cam.position.z - e.z);
      const pulse = 1 + (S.me.room === rm.k ? S.meter : 0) * 0.15 * (1 + Math.sin(S.time * 18));
      e.mesh.scale.set(e.h * (E.sprite(e.sp) ? E.sprite(e.sp).aspect : 0.7) * pulse, e.h * pulse, 1);
      e.glow.position.set(e.x, e.y + e.h * 0.5, e.z - 0.05); e.f.x = e.x; e.f.y = e.y + 1; e.f.z = e.z;
    }
  };
  const _f = new THREE.Vector3();
  TYPES.eyes.local = (rm, dt) => {
    if (rm.start < 0) return;
    const cam = S.cam.position; S.cam.getWorldDirection(_f);
    let look = 0;
    for (const e of rm.eyes) {
      const dx = e.x - cam.x, dy = e.y + e.h * 0.55 - cam.y, dz = e.z - cam.z, d = Math.hypot(dx, dy, dz);
      if (d > 24) continue;
      const dot = (dx * _f.x + dy * _f.y + dz * _f.z) / d;
      if (dot < 0.86) continue;
      if (rm.shelves.some(b => segHits(cam.x, cam.z, e.x, e.z, b, 0))) continue;
      look = Math.max(look, d < 6 ? 1.6 : 1);
      rm.st.who = e.sp;
    }
    if (look && S.inv <= 0) S.meter += dt * look / (rm.pl.fill / S.diff.speed);
    else S.meter = Math.max(0, S.meter - dt * 0.45);
    if (look) { S.lookT = (S.lookT || 0) - dt; if (S.lookT <= 0) { S.lookT = 0.18; Au.noise({ type: 'bandpass', freq: 1800 + S.meter * 2500, q: 2, dur: 0.12, gain: 0.03 + S.meter * 0.1 }); } }
    if (S.meter >= 1) { S.meter = 0; fail('look', { sp: rm.st.who }); }
  };
  TYPES.eyes.onRespawn = () => { S.meter = 0; };

  /* ---------- cache-cache : l'entité fonce dans le couloir, il faut être dans une armoire ---------- */
  Object.assign(TYPES.hide, { deadP: 0.18 });
  const RUSH_V = 30;
  TYPES.hide.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX;
    for (const w of pl.wards) {
      const z = C.z(w.u), wx = w.side * HX, fx = w.side * (HX - 0.75);
      C.solid(Math.min(wx, fx), Math.max(wx, fx), 0, 2.25, z - 0.68, z + 0.68, 'woodDark');
      C.put('woodDark', box(Math.min(wx, fx) - 0.04, Math.max(wx, fx) + 0.04, 2.25, 2.35, z - 0.72, z + 0.72));
      const f = C.mesh(new THREE.PlaneGeometry(1.3, 2.2), MAT.ward); f.position.set(fx - w.side * 0.004, 1.12, z); f.rotation.y = w.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      w.z = z;
      C.inter({ x: w.side * (HX - 1.0), y: 1.2, z, r: 1.5, label: 'E : se cacher dans l\'armoire', act: () => hideIn(rm, w) });
    }
    const sp = rm.imgs[0], spr = E.sprite(sp), h = 2.7;
    const mat = C.own(new THREE.MeshBasicMaterial({ map: chaseTex(sp), transparent: true, alphaTest: 0.06, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(GEO.chase, mat); mesh.frustumCulled = false; mesh.scale.set(h * (spr ? spr.aspect : 0.7), h, 1); mesh.visible = false; C.add(mesh);
    const smoke = C.glow(0, 1.3, rm.Z0, 0x220000, 4, 3, 0); smoke.material.blending = THREE.NormalBlending;
    rm.rush = { mesh, mat, sp, smoke, voice: null, run: false };
    rm.bye.push(() => { if (rm.rush.voice) rm.rush.voice.stop(); });
    spray(C, 'SI ÇA CLIGNOTE : ARMOIRE !', '#ffe14a', -1, 1.4, 2.5, 2.2);
  };
  function hideState(rm) {
    if (rm.start < 0) return null;
    const pl = rm.pl, t = ht() - rm.start, v = RUSH_V * S.diff.speed, travel = (pl.L + 8) / v;
    for (let i = 0; i < pl.n; i++) {
      const tR = pl.first + i * pl.gap, tW = tR - pl.warn;
      if (t >= tW && t < tR) return { warn: (t - tW) / pl.warn, i };
      if (t >= tR && t < tR + travel) return { run: true, u: -4 + (t - tR) * v, i };
    }
    return { done: t >= pl.first + (pl.n - 1) * pl.gap + travel };
  }
  TYPES.hide.update = (rm, dt) => {
    const s = hideState(rm), R = rm.rush; rm.hs = s;
    rm.flick = s && s.warn != null ? 0.4 + s.warn * 0.6 : s && s.run ? 1 : 0;
    const here = S.me.room === rm.k && !S.me.dead;
    if (s && s.warn != null && here) { rm.st.rT = (rm.st.rT || 0) - dt; if (rm.st.rT <= 0) { rm.st.rT = 0.22; Au.noise({ type: 'lowpass', freq: 160 + s.warn * 300, dur: 0.35, gain: 0.1 + s.warn * 0.35 }); Au.tone({ freq: 40 + s.warn * 30, dur: 0.3, gain: 0.08 + s.warn * 0.2, type: 'sawtooth', lp: 200 }); } }
    if (s && s.run) {
      const z = rm.Z0 - s.u;
      R.mesh.visible = true; R.mesh.position.set(Math.sin(S.time * 30) * 0.15, 0.1 + Math.sin(S.time * 40) * 0.08, z); R.mesh.rotation.y = Math.atan2(S.cam.position.x, S.cam.position.z - z);
      R.smoke.position.set(0, 1.3, z + 1.2); R.smoke.material.opacity = 0.6;
      if (here) {
        if (!R.voice) { R.voice = Au.botVoice(R.sp) || null; Au.fx('roar', { g: 1.4, rate: 1.3 }); }
        if (R.voice) R.voice.set(0, 1.4, z, 2.2);
        const d = Math.abs(z - S.cam.position.z); if (d < 10) S.shake = Math.max(S.shake, 0.9 * (1 - d / 10));
      }
    } else {
      R.mesh.visible = false; R.smoke.material.opacity = 0;
      if (R.voice) { R.voice.stop(); R.voice = null; }
    }
    if (s && s.done && !rm.solved) { rm.solved = true; if (here) { banner('C\'EST PASSÉ', 'La porte est ouverte. Sors de là !', 'good', 2000); Au.meme('amazing', 0.6); } }
  };
  TYPES.hide.local = rm => {
    const s = rm.hs, me = S.me; if (!s || !s.run || me.hidden || S.inv > 0) return;
    if (Math.abs(s.u - (rm.Z0 - me.z)) < 1.4) fail('rush', { sp: rm.rush.sp });
  };
  TYPES.hide.hud = rm => { const s = rm.hs; return s && (s.warn != null || s.run) ? 'IL ARRIVE ! CACHE-TOI DANS UNE ARMOIRE (E) !' : rm.solved ? 'C\'est passé : file à la porte !' : TYPES.hide.goal; };
  TYPES.hide.lockMsg = () => 'La porte reste fermée tant que l\'entité n\'est pas passée. Cache-toi !';
  function hideIn(rm, w) {
    const me = S.me;
    S.hide = { rm, w, yaw: w.side < 0 ? -Math.PI / 2 : Math.PI / 2 };
    me.hidden = true; me.x = w.side * (rm.HX - 0.38); me.z = w.z; me.vx = me.vz = 0; me.yaw = S.hide.yaw; me.pitch = -0.05;
    Au.locker(); Au.door('close', 0, 0.5);
  }
  function unhide() {
    const h = S.hide, me = S.me; if (!h) return;
    S.hide = null; me.hidden = false; me.x = h.w.side * (h.rm.HX - 1.05); me.z = h.w.z;
    Au.locker(); Au.door('open', 0, 0.4);
  }

  /* ---------- le digicode : 4 chiffres cachés dans la salle ---------- */
  const ORD = ['1er', '2e', '3e', '4e'];
  function keypadCanvas() {
    const c = cv(128, 192), g = c.getContext('2d');
    g.fillStyle = '#1e2226'; rr(g, 0, 0, 128, 192, 12); g.fill();
    g.fillStyle = '#0e3a22'; g.fillRect(12, 12, 104, 30); g.fillStyle = '#5dff9a'; g.font = 'bold 22px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('_ _ _ _', 64, 28);
    const k = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    k.forEach((t, i) => { const x = 14 + (i % 3) * 36, y = 52 + ((i / 3) | 0) * 34; g.fillStyle = '#c9ced3'; rr(g, x, y, 30, 28, 5); g.fill(); g.fillStyle = '#222'; g.font = 'bold 18px ' + FONT; g.fillText(t, x + 15, y + 15); });
    return c;
  }
  TYPES.code.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX, r = C.r, spots = [];
    for (const u of [3.4, 6.2]) for (const x of [-1.8, 1.8]) desk(C, x, C.z(u), 1.2, 0.6).forEach(p => spots.push({ x: p.x, y: p.y + 0.002, z: p.z, flat: true }));
    desk(C, HX - 1.3, C.z(C.L - 2.2), 1.6, 0.8, 'woodDark').forEach(p => spots.push({ x: p.x, y: p.y + 0.002, z: p.z, flat: true }));
    for (let u = 2; u < C.L - 2; u += 1.7) { spots.push({ x: -HX + 0.012, y: 1.1 + r() * 0.9, z: C.z(u), ry: Math.PI / 2 }); spots.push({ x: HX - 0.012, y: 1.1 + r() * 0.9, z: C.z(u + 0.8), ry: -Math.PI / 2 }); }
    for (const x of [-HX + 0.8, HX - 0.8]) if (Math.abs(x - pl.en) > 1.2) spots.push({ x, y: 1.5, z: rm.Z0 - 0.012, ry: Math.PI, behind: true });
    BR.shuffle(spots, r);
    const used = [], pick = () => { const s = spots.find(p => !used.includes(p) && used.every(q => Math.hypot(q.x - p.x, q.z - p.z) > 1.4)) || spots.find(p => !used.includes(p)); used.push(s); return s; };
    const place = (txt, sub, seed, col) => {
      const p = pick(), m = C.decal(noteCanvas(txt, sub, seed, col), 0.3, 0.375, p.x, p.y, p.z, p.ry || r() * 6.28, { flat: p.flat });
      C.inter({ x: p.x, y: p.y, z: p.z, r: 2.4, read: true, label: '« ' + (sub ? sub + ' : ' : '') + txt + ' »' });
      return m;
    };
    pl.code.forEach((d, i) => place(String(d), ORD[i] + ' chiffre', rm.k * 10 + i));
    if (pl.decoy) { place('Le code, c\'est 1234', '(non)', rm.k * 10 + 7, '#fff3a8'); place('Regarde derrière toi', '', rm.k * 10 + 8, '#ffd0d0'); }
    // digicode à droite de la porte
    const px = pl.ex + DW / 2 + 0.45;
    C.put('dark', box(px - 0.13, px + 0.13, 1.15, 1.55, rm.ZE, rm.ZE + 0.04));
    const pad = C.decal(keypadCanvas(), 0.24, 0.36, px, 1.35, rm.ZE + 0.043, 0, { emissive: true }); void pad;
    rm.pad = { x: px, z: rm.ZE + 0.05 };
    C.inter({ x: px, y: 1.35, z: rm.ZE + 0.6, r: 2.0, code: true, label: 'Tape le code au clavier (chiffres), Retour arrière pour effacer' });
    C.glow(px, 1.35, rm.ZE + 0.1, 0x5dff9a, 0.6, 0.6, 0.3);
    schoolDecor(C, 0.6, 1.8, { floor: false });
  };
  TYPES.code.timeLeft = TYPES.keys.timeLeft;
  TYPES.code.hud = rm => 'Trouve les 4 chiffres (murs, tables… et derrière toi), puis tape le code au digicode.';
  TYPES.code.side = rm => rm.solved ? '' : '<div class="d-code' + (S.codeErr && S.time < S.codeErr ? ' bad' : '') + '"><span>CODE</span><b>' + [0, 1, 2, 3].map(i => S.code[i] || '_').join(' ') + '</b>' + (S.codeRoom === rm ? '<em>Tape les chiffres au clavier</em>' : '<em>Approche du digicode</em>') + '</div>';
  TYPES.code.lockMsg = () => 'Fermé par un digicode : tape le code (chiffres du clavier) à côté de la porte.';
  function typeDigit(rm, d) {
    if (S.codeErr) { if (S.time < S.codeErr) return; S.code = ''; S.codeErr = 0; }   // le code faux reste affiché 0,6 s
    if (rm.solved || S.code.length >= 4) return;
    S.code += d; Au.beep(0, 1);
    if (S.code.length < 4) return;
    if (S.code === rm.pl.code.join('')) { S.code = ''; solve(rm, true); Au.meme('yeah_boy', 0.6); return; }
    rm.st.bonus = (rm.st.bonus || 0) - 5;
    Au.ui('error'); Au.meme('wait_minute', 0.7);
    banner('CODE FAUX', BR.pick(['Le digicode rigole. −5 s.', 'Essaie encore. Le gardien approche…', '0000, c\'était tentant, hein ?']), 'bad', 1600);
    S.codeErr = S.time + 0.6;
  }

  /* ---------- les interrupteurs : allumer toutes les ampoules ---------- */
  function leverCanvas(i, mask, n, show) {
    const c = cv(128, 192), g = c.getContext('2d');
    g.fillStyle = '#d9d3c2'; rr(g, 0, 0, 128, 192, 10); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 4; rr(g, 4, 4, 120, 184, 8); g.stroke();
    g.fillStyle = '#222'; g.font = 'bold 64px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 64, 52);
    if (show) for (let b = 0; b < n; b++) { const x = 64 + (b - (n - 1) / 2) * 22; g.beginPath(); g.arc(x, 160, 8, 0, 7); g.fillStyle = mask & (1 << b) ? '#f0c020' : '#777'; g.fill(); g.strokeStyle = '#222'; g.lineWidth = 2; g.stroke(); }
    else { g.font = 'bold 40px ' + FONT; g.fillText('?', 64, 150); }
    return c;
  }
  TYPES.switches.build = (rm, C) => {
    const pl = rm.pl, HX = C.HX, n = pl.n, full = (1 << n) - 1;
    // tableau des ampoules à gauche de la porte
    const bx = pl.ex - DW / 2 - 1.35, by = 1.75, bw = n * 0.36 + 0.2;
    C.put('dark', box(bx - bw / 2, bx + bw / 2, by - 0.3, by + 0.3, rm.ZE, rm.ZE + 0.06));
    rm.bulbs = [];
    for (let b = 0; b < n; b++) {
      const m = C.own(new THREE.MeshBasicMaterial({ color: 0x400806 })), x = bx + (b - (n - 1) / 2) * 0.36;
      const bulb = C.mesh(GEO.bulb.clone(), m); bulb.position.set(x, by, rm.ZE + 0.14);
      const gl = C.glow(x, by, rm.ZE + 0.2, 0x40ff70, 0.8, 0.8, 0);
      rm.bulbs.push({ m, gl });
    }
    rm.levers = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, u = 2.6 + (i >> 1) * 2.9 + (side > 0 ? 1.3 : 0), z = C.z(u), wx = side * HX;
      C.put('dark', box(wx - side * 0.05, wx, 0.95, 1.55, z - 0.2, z + 0.2));
      C.decal(leverCanvas(i, pl.masks[i], n, pl.show), 0.26, 0.39, wx - side * 0.052, 1.8, z, side < 0 ? Math.PI / 2 : -Math.PI / 2);
      const piv = new THREE.Group(); piv.position.set(wx - side * 0.06, 1.25, z);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05).translate(0.17, 0, 0), MAT.steel); rm.geos.push(handle.geometry);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), MAT.red); knob.position.x = 0.34; rm.geos.push(knob.geometry);
      const arm = new THREE.Group(); arm.add(handle, knob); arm.rotation.y = side < 0 ? 0 : Math.PI; piv.add(arm); C.add(piv);
      rm.levers.push({ piv, side, up: false, a: 0 });
      C.inter({ x: wx - side * 0.7, y: 1.25, z, r: 1.5, label: () => rm.solved ? 'Toutes les ampoules sont allumées' : 'E : actionner le levier ' + (i + 1), act: () => { if (!rm.solved) setSwitch(rm, i, rm.st.s ^ pl.masks[i], true); } });
    }
    rm.st.s = pl.s0; rm.full = full;
    setBulbs(rm);
    schoolDecor(C, C.L - 2.2, C.L - 1.0, { floor: true, noLockers: true });
    spray(C, 'Allume TOUT. (oui, tout)', '#ffe14a', -1, 1.2, 2.5, 1.8);
  };
  function setBulbs(rm) {
    rm.bulbs.forEach((b, i) => { const on = !!(rm.st.s & (1 << i)); b.m.color.setHex(on ? 0x60ff90 : 0x4a0a08); b.gl.material.opacity = on ? 0.55 : 0; });
  }
  function setSwitch(rm, i, s, local) {
    rm.st.s = s; const L = rm.levers[i]; L.up = !L.up;
    setBulbs(rm);
    const d = Math.hypot(L.piv.position.x - S.cam.position.x, L.piv.position.z - S.cam.position.z), g = BR.clamp(1.2 - d / 16, 0.1, 1);
    Au.noise({ type: 'lowpass', freq: 900, dur: 0.12, gain: 0.25 * g }); Au.tone({ freq: 120, freqEnd: 70, dur: 0.12, gain: 0.15 * g });
    if (local && !S.solo) BR.Net.relay({ k: 'ev', r: rm.k, a: 'l', v: i, s }, '*');
    if (s === rm.full && !rm.solved) { solve(rm, false); Au.meme('amazing', 0.6); }
  }
  TYPES.switches.update = (rm, dt) => { for (const L of rm.levers) { const tgt = L.up ? 0.7 : -0.7; L.a += BR.clamp(tgt - L.a, -dt * 8, dt * 8); L.piv.rotation.z = L.a * (L.side < 0 ? 1 : -1); } };
  TYPES.switches.event = (rm, e) => { if (e.a === 'l' && rm.levers[e.v | 0]) setSwitch(rm, e.v | 0, e.s | 0, false); };
  TYPES.switches.timeLeft = TYPES.keys.timeLeft;
  TYPES.switches.hud = rm => 'Allume les ' + rm.pl.n + ' ampoules à gauche de la porte. Chaque levier en inverse plusieurs.' + (rm.pl.show ? ' (Les points jaunes sous le numéro te disent lesquelles.)' : '');
  TYPES.switches.lockMsg = () => 'Il faut allumer toutes les ampoules (leviers sur les murs).';

  /* =====================================================================
     7. RENDU, INTERFACE (DOM)
     ===================================================================== */
  let R = null, DOM = null;
  const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.6-4.7-9.6-9.3C.9 8.2 3.2 4.4 6.9 4.4c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.7 0 6 3.8 4.5 7.3C19.6 16.3 12 21 12 21z"/></svg>';
  function ensureDom() {
    if (DOM) return DOM;
    const root = BR.el('div', { id: 'doors' });
    root.innerHTML = `<canvas class="d-gl"></canvas>
      <div class="d-hud">
        <div class="d-vig"></div><div class="d-red"></div><div class="d-tint"></div><div class="d-lava"></div><div class="d-white"></div><div class="d-grain"></div>
        <div class="d-slats"></div>
        <div class="d-top"><div class="d-room">SALLE <b>1</b></div><div class="d-txt"><div class="d-name"></div><div class="d-q"></div></div><div class="d-tt"></div><div class="d-timer"><i></i></div></div>
        <div class="d-score"><b>0</b><span>SALLES</span><div class="d-lives"></div><small></small></div>
        <div class="d-plist"></div>
        <div class="d-side"></div>
        <div class="d-feed"></div>
        <div class="d-light"><i></i><span></span></div>
        <div class="d-eye"><span>NE LE REGARDE PAS</span><div><i></i></div></div>
        <div class="d-prompt"></div>
        <div class="d-hint"></div>
        <div class="d-cross"></div>
        <div class="d-banner"><b></b><span></span></div>
        <div class="d-title"><div class="t">LES PORTES</div><div class="s"></div><div class="d"></div></div>
        <div class="d-tab"></div>
        <div class="d-chat"><input maxlength="160" placeholder="Message… (Entrée pour envoyer, Échap pour annuler)"></div>
        <div class="d-jump"><canvas></canvas></div>
        <div class="d-fade"></div>
        <div class="d-pause"><div class="box"><h2>PAUSE</h2><p class="muted">Clique sur « Reprendre » pour revenir dans les salles.</p>
          <div class="row center"><button class="btn primary big" data-p="resume">Reprendre</button><button class="btn big danger" data-p="quit">Quitter la partie</button></div>
          <div class="keys"><span><b>Z Q S D</b> / flèches : se déplacer</span><span><b>Souris</b> : regarder</span><span><b>Maj</b> : courir</span><span><b>Espace</b> : sauter</span><span><b>C</b> : s'accroupir (en courant : glisser)</span><span><b>E</b> : prendre, actionner, se cacher</span><span><b>Chiffres</b> : digicode</span><span><b>Tab</b> : scores (à plusieurs)</span></div></div></div>
      </div>`;
    document.body.appendChild(root);
    const q = s => root.querySelector(s);
    DOM = { root, gl: q('.d-gl'), room: q('.d-room b'), name: q('.d-name'), q: q('.d-q'), timer: q('.d-timer i'), tt: q('.d-tt'), top: q('.d-top'), score: q('.d-score b'), best: q('.d-score small'), lives: q('.d-lives'),
      plist: q('.d-plist'), side: q('.d-side'), feed: q('.d-feed'), hint: q('.d-hint'), prompt: q('.d-prompt'), light: q('.d-light'), lightT: q('.d-light span'), eye: q('.d-eye'), eyeI: q('.d-eye i'),
      banner: q('.d-banner'), bt: q('.d-banner b'), bs: q('.d-banner span'), title: q('.d-title'), tab: q('.d-tab'), chat: q('.d-chat'), chatIn: q('.d-chat input'), jump: q('.d-jump'), jumpC: q('.d-jump canvas'),
      fade: q('.d-fade'), pause: q('.d-pause'), vig: q('.d-vig'), red: q('.d-red'), tint: q('.d-tint'), lava: q('.d-lava'), white: q('.d-white'), slats: q('.d-slats') };
    q('.d-pause').addEventListener('click', e => {
      const b = e.target.closest('[data-p]'); if (!b || !S) return;
      if (b.dataset.p === 'resume') { Au.ui('click'); D.lock(); }
      else { Au.ui('back'); quit(); }
    });
    DOM.chatIn.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { const t = DOM.chatIn.value.trim(); DOM.chatIn.value = ''; closeChat(); if (t && S && !S.solo) BR.Net.chat(t, false); }
      else if (e.key === 'Escape') closeChat();
    });
    return DOM;
  }
  function renderer() {
    if (R) return R;
    R = new THREE.WebGLRenderer({ canvas: DOM.gl, antialias: BR.settings.quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false });
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
    window.addEventListener('resize', resize);
    return R;
  }
  function resize() {
    if (!R) return;
    const q = BR.settings.quality, dpr = window.devicePixelRatio || 1;
    R.setPixelRatio(Math.min(dpr, q === 'high' ? 1.5 : q === 'med' ? 1 : 0.7));
    R.setSize(window.innerWidth, window.innerHeight, false);
    if (S) { S.cam.aspect = window.innerWidth / window.innerHeight; S.cam.updateProjectionMatrix(); }
  }
  let bannerTO = null, hintTxt = '';
  function banner(t, s, kind, dur) {
    DOM.bt.textContent = t; DOM.bs.textContent = s || '';
    DOM.banner.className = 'd-banner on ' + (kind || '');
    clearTimeout(bannerTO); bannerTO = setTimeout(() => DOM && DOM.banner.classList.remove('on'), dur || 2600);
  }
  function feed(text, kind) {
    const t = BR.el('div', { class: 'fd ' + (kind || '') }, text); DOM.feed.appendChild(t);
    while (DOM.feed.children.length > 5) DOM.feed.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 5500); setTimeout(() => t.remove(), 6200);
  }
  function hint(t) { if (t === hintTxt) return; hintTxt = t; DOM.hint.textContent = t; DOM.hint.classList.toggle('on', !!t); }

  /* =====================================================================
     8. SESSION
     ===================================================================== */
  const keys = {};
  D.session = () => S;
  /**
   * o = { mode:'solo'|'multi', diff, seed, roster:[{id,name,look,level}], selfId, hostId, imgs:[...]?, onEnd(summary), force:[types]? (tests) }
   */
  D.start = function (o) {
    if (S) D.stop();
    ensureDom(); renderer(); materials();
    const diff = D.DIFFS[o.diff] || D.DIFFS.normal;
    S = {
      o, solo: o.mode !== 'multi', seed: o.seed >>> 0, diff, selfId: o.selfId, hostId: o.hostId, isHost: o.mode !== 'multi' || o.selfId === o.hostId,
      imgs: Array.isArray(o.imgs) ? o.imgs : o.mode !== 'multi' ? D.planImages(60) : null, rooms: new Map(), doorOpen: new Set(), rsq: {}, evq: {}, off: 0, offOk: false,
      players: new Map(), order: o.roster.map(r => r.id), chasers: [], time: 0, last: performance.now(), paused: false, locked: false, chatOpen: false, ended: false,
      gRoom: 0, introUntil: 2.4, panic: 0, shake: 0, eye: MV.eye, bobT: 0, stepDist: 0, slide: 0, slideCd: 0, sendT: 0, unsub: [],
      lockT: 0, lockMsg: '', hudT: 0, spec: null, specYaw: 0, best: 0, flash: 0, flashW: 0, lifePop: 0, inv: 0, fail: null, death: null, endAt: null,
      held: null, code: '', codeRoom: null, hide: null, focus: null, meter: 0, coyote: 0, jumpBuf: 0, tumble: 0, tumbleA: 0, music: '', dread: 14,
      envD: 0.05, lightCol: new THREE.Color(),
    };
    S.plan = makePlan(S.seed, o.force);
    const key = 'portes_' + diff.id; S.best = ((BR.Account.p.stats || {}).best || {})[key] || 0;

    // --- scène ---
    const scene = (S.scene = new THREE.Scene());
    S.fogCol = new THREE.Color(0x0d0b07);
    scene.background = S.fogCol.clone(); scene.fog = new THREE.FogExp2(S.fogCol.clone(), 0.05);
    S.amb = new THREE.AmbientLight(0x6f6852, 0.1); scene.add(S.amb);
    S.hemi = new THREE.HemisphereLight(0xfff1d6, 0x2b2418, 0.1); scene.add(S.hemi);
    R.toneMappingExposure = 1.0;
    const cam = (S.cam = new THREE.PerspectiveCamera(BR.settings.fov, window.innerWidth / window.innerHeight, 0.05, 160));
    cam.rotation.order = 'YXZ'; scene.add(cam);
    // lampe torche (allumée dans le labyrinthe)
    const torch = new THREE.SpotLight(0xfff1d6, 0, 20, 0.52, 0.55, 1.4); torch.position.set(0.18, -0.16, 0.05); cam.add(torch);
    const tg = new THREE.Object3D(); tg.position.set(0, -0.06, -1); cam.add(tg); torch.target = tg; S.torch = torch;
    S.pool = []; const nPool = BR.settings.quality === 'low' ? 5 : BR.settings.quality === 'med' ? 7 : 9;
    for (let i = 0; i < nPool; i++) { const l = new THREE.PointLight(0xfff1d6, 0, 9, 2); scene.add(l); S.pool.push(l); }

    // --- joueurs ---
    const n = o.roster.length;
    o.roster.forEach((r, i) => {
      const p = { id: r.id, name: r.name, look: r.look || BR.Avatar.defaultLook(), level: r.level || 1, x: (i - (n - 1) / 2) * 0.8, y: 0, z: -1.4, tx: 0, ty: 0, tz: -1.4, vx: 0, vz: 0, vy: 0, yaw: 0, tyaw: 0, pitch: 0,
        ground: true, speed: 0, sprint: false, crouch: false, room: 0, score: 0, lives: diff.lives, dead: false, hidden: false, plat: null, stepDist: 0, seen: 0 };
      p.tx = p.x;
      S.players.set(r.id, p);
      if (r.id !== S.selfId) {
        p.av = BR.Avatar.build(p.look); p.av.group.rotation.order = 'YXZ'; scene.add(p.av.group);
        p.tag = nameTag(p.name); scene.add(p.tag.sprite);
      }
    });
    S.me = S.players.get(S.selfId);

    buildRoom(0); buildRoom(1);

    // --- réseau ---
    if (!S.solo) {
      const N = BR.Net;
      S.unsub.push(N.on('r', onRelay), N.on('chat', onChat), N.on('left', onLeft), N.on('end', m => endGame(m.res || null, '')),
        N.on('abort', m => abortGame(m.msg || 'Partie interrompue.')), N.on('lost', () => abortGame('Connexion au serveur perdue.')),
        N.on('kicked', m => abortGame(m.msg || 'Exclu du salon.')));
    }

    // --- interface ---
    bindInput(true);
    document.body.classList.add('indoors');
    DOM.root.classList.add('on');
    DOM.fade.classList.remove('on'); DOM.jump.classList.remove('on', 'stay'); DOM.pause.classList.remove('on'); DOM.tab.classList.remove('on'); closeChat();
    DOM.feed.innerHTML = ''; DOM.plist.innerHTML = ''; DOM.plist.style.display = S.solo ? 'none' : ''; DOM.side.innerHTML = '';
    DOM.title.querySelector('.s').textContent = S.solo ? 'Bonne réponse : porte suivante. Toutes les 5 questions : une salle piège.' : 'Mêmes salles pour tout le monde. On avance ensemble.';
    const dd = DOM.title.querySelector('.d'); dd.textContent = diff.name.toUpperCase() + ' · ' + diff.lives + (diff.lives > 1 ? ' VIES' : ' VIE'); dd.style.color = diff.color;
    DOM.title.classList.remove('out'); DOM.title.classList.add('on'); setTimeout(() => DOM && DOM.title.classList.add('out'), 2400);
    DOM.best.textContent = S.best ? 'Record : ' + S.best : '';
    S.hudRoom = -1; S.hudQ = null; S.hudSide = null; S.hudLives = -1;
    hintTxt = '#'; hint('');
    D.active = true;
    resize();

    // --- ambiance sonore ---
    try { Au.startAmbience('concrete'); Au.setTension(0); } catch (e) {}
    Au.track('music', 'backrooms', 0.22); S.music = 'backrooms'; Au.track('amb', 'bourdonnement', 0.45);
    startHum();
    S.raf = requestAnimationFrame(frame);
    if (!S.solo) S.bg = setInterval(background, 50);
  };

  D.stop = function () {
    if (!S) return;
    cancelAnimationFrame(S.raf); clearInterval(S.bg);
    bindInput(false);
    S.unsub.forEach(f => f());
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    S.chasers.forEach(c => killChaser(c, true));
    [...S.rooms.values()].forEach(disposeRoom);
    S.players.forEach(p => { if (p.av) { S.scene.remove(p.av.group); p.av.dispose(); } if (p.tag) { p.tag.tex.dispose(); p.tag.sprite.material.dispose(); } });
    for (const k in posterCache) { posterCache[k].dispose(); delete posterCache[k]; }
    for (const k in chaseCache) { chaseCache[k].dispose(); delete chaseCache[k]; }
    stopHum(); Au.hush();
    try { Au.stopAmbience(); } catch (e) {}
    Au.track('amb', ''); Au.track('music', 'menu', 0.8);
    DOM.root.classList.remove('on'); document.body.classList.remove('indoors');
    DOM.jump.classList.remove('on', 'stay'); DOM.pause.classList.remove('on'); DOM.tab.classList.remove('on');
    if (R) { R.clear(); R.renderLists.dispose(); }
    S = null; D.active = false;
    for (const k in keys) keys[k] = false;
  };

  function nameTag(name) {
    const c = cv(512, 128), g = c.getContext('2d');
    g.font = 'bold 44px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(name, 256, 64); g.fillStyle = '#fff'; g.fillText(name, 256, 64);
    const t = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
    sp.scale.set(1.7, 0.42, 1); sp.renderOrder = 10;
    return { sprite: sp, tex: t };
  }

  /* =====================================================================
     9. ENTRÉES
     ===================================================================== */
  let bound = false;
  function bindInput(on) {
    if (on === bound) return; bound = on;
    const f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('keydown', onKeyDown, true); window[f]('keyup', onKeyUp, true);
    document[f]('mousemove', onMouse); document[f]('pointerlockchange', onLockChange);
    DOM.gl[f]('mousedown', onCanvasDown); DOM.gl[f]('contextmenu', noCtx); window[f]('blur', onBlur);
  }
  function noCtx(e) { e.preventDefault(); }
  function onBlur() { for (const k in keys) keys[k] = false; }
  D.lock = function () { try { const r = DOM.gl.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
  function onCanvasDown(e) {
    if (!S) return;
    if (!S.locked && !S.chatOpen) { D.lock(); return; }
    if (spectating() && e.button === 0) cycleSpec(1);
  }
  function onLockChange() {
    if (!S) return;
    S.locked = document.pointerLockElement === DOM.gl;
    if (S.locked) { S.paused = false; DOM.pause.classList.remove('on'); }
    else if (!S.chatOpen && !S.ended) { S.paused = true; DOM.pause.classList.add('on'); Au.ui('back'); for (const k in keys) keys[k] = false; }
  }
  function onMouse(e) {
    if (!S || !S.locked) return;
    const k = 0.0022 * BR.settings.sens, mx = e.movementX || 0, my = (e.movementY || 0) * (BR.settings.invertY ? -1 : 1);
    if (Math.abs(mx) > 400 || Math.abs(my) > 400) return;
    if (spectating()) { S.specYaw -= mx * k; return; }
    if (S.fail && S.fail.ent) return;
    const me = S.me;
    me.yaw -= mx * k; me.pitch = BR.clamp(me.pitch - my * k, -1.45, 1.45);
    if (S.hide) { const d = BR.angDiff(S.hide.yaw, me.yaw); if (Math.abs(d) > 0.9) me.yaw = S.hide.yaw + Math.sign(d) * 0.9; me.pitch = BR.clamp(me.pitch, -0.6, 0.5); }
  }
  function onKeyDown(e) {
    if (!S || S.chatOpen) return;
    const code = e.code;
    if (code === 'Tab') { e.preventDefault(); if (!S.solo) scoreboard(true); return; }
    if (S.paused && code !== 'Escape') return;
    keys[code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(code)) e.preventDefault();
    if (e.repeat) return;
    if (code === 'Enter' && !S.solo) { e.preventDefault(); openChat(); return; }
    if (spectating()) { if (code === 'Space' || code === 'KeyD' || code === 'ArrowRight') cycleSpec(1); else if (code === 'KeyA' || code === 'ArrowLeft') cycleSpec(-1); return; }
    const me = S.me; if (me.dead || S.fail) return;
    const dg = /^(?:Digit|Numpad)(\d)$/.exec(code);
    if (dg && S.codeRoom) { typeDigit(S.codeRoom, dg[1]); return; }
    if (code === 'Backspace' && S.codeRoom) { S.code = S.code.slice(0, -1); Au.beep(0, 0.6); return; }
    if (code === 'KeyE') { interact(); return; }
    if ((code === 'KeyC' || code === 'ControlLeft' || code === 'ControlRight') && me.ground && S.slideCd <= 0 && me.speed > MV.walk + 1 && !S.hide) startSlide();
    if (code === 'Space') { if (S.hide) return; S.jumpBuf = 0.16; }
  }
  function onKeyUp(e) { if (!S) return; keys[e.code] = false; if (e.code === 'Tab') scoreboard(false); }
  const down = (...c) => c.some(k => keys[k]);
  function openChat() { S.chatOpen = true; try { document.exitPointerLock(); } catch (e) {} DOM.chat.classList.add('on'); setTimeout(() => DOM.chatIn.focus(), 30); }
  function closeChat() { if (!DOM) return; DOM.chat.classList.remove('on'); DOM.chatIn.blur(); if (S && S.chatOpen) { S.chatOpen = false; if (!S.ended) D.lock(); } }
  function startSlide() { const me = S.me, sp = Math.hypot(me.vx, me.vz) || 1; S.slide = 0.8; S.slideCd = 1.2; me.vx = me.vx / sp * MV.slide; me.vz = me.vz / sp * MV.slide; Au.throw(); }
  function interact() {
    if (S.hide) { unhide(); return; }
    const f = S.focus; if (f && f.act) f.act();
  }

  /* =====================================================================
     10. BOUCLE
     ===================================================================== */
  function frame(now) {
    if (!S) return;
    S.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.0005, (now - S.last) / 1000)); S.last = now;
    if (S.paused && S.solo) { R.render(S.scene, S.cam); return; }
    step(dt, true);
  }
  function background() {   // onglet masqué (multijoueur) : la partie continue
    if (!S) return;
    const now = performance.now(); if (now - S.last < 250) return;
    let el = Math.min(1.5, (now - S.last) / 1000); S.last = now;
    while (el > 0.0005 && S) { const dt = Math.min(0.05, el); el -= dt; step(dt, false); }
  }
  D._step = function (dt, render) { if (S) step(dt || 1 / 60, !!render); };
  function step(dt, render) {
    S.time += dt;
    S.flash = Math.max(0, S.flash - dt * 2.2); S.flashW = Math.max(0, S.flashW - dt * 2.2); S.lifePop = Math.max(0, S.lifePop - dt * 1.5);
    S.jumpBuf = Math.max(0, S.jumpBuf - dt);
    TX.lava.offset.set(S.time * 0.012, S.time * 0.008); TX.lava2.offset.set(-S.time * 0.02, S.time * 0.015);
    updateMe(dt);
    updateRemotes(dt);
    updateRooms(dt); if (!S) return;
    updateDoors(dt);
    updateChasers(dt); if (!S) return;
    updateFail(dt); if (!S) return;
    netSend(dt);
    updateLights(dt);
    updateCamera(dt);
    checkEnd();
    if (!S || !render) return;
    updateAudio(dt);
    updateHud(dt);
    R.render(S.scene, S.cam);
  }

  /* ---------- physique : boîtes de collision (cylindre du joueur contre boîtes) ---------- */
  function pushOut(p, h) {
    for (let it = 0; it < 2; it++) for (const rm of S.rooms.values()) for (const b of rm.solids) {
      if (b.off || b.y1 <= p.y + MV.step || b.y0 >= p.y + h) continue;
      if (p.x < b.x0 - R_PL || p.x > b.x1 + R_PL || p.z < b.z0 - R_PL || p.z > b.z1 + R_PL) continue;
      const cx = BR.clamp(p.x, b.x0, b.x1), cz = BR.clamp(p.z, b.z0, b.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= R_PL * R_PL) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (R_PL - d) / d; p.x += dx * k; p.z += dz * k; }
      else {
        const l = p.x - b.x0, r2 = b.x1 - p.x, t = p.z - b.z0, bo = b.z1 - p.z, m = Math.min(l, r2, t, bo);
        if (m === l) p.x = b.x0 - R_PL; else if (m === r2) p.x = b.x1 + R_PL; else if (m === t) p.z = b.z0 - R_PL; else p.z = b.z1 + R_PL;
      }
    }
  }
  // sol le plus haut sous les pieds (jusqu'à une marche au-dessus)
  function support(p, rad, up) {
    let y = -1e9, bb = null;
    for (const rm of S.rooms.values()) for (const b of rm.solids) {
      if (b.off || b.y1 > p.y + up) continue;
      if (p.x + rad < b.x0 || p.x - rad > b.x1 || p.z + rad < b.z0 || p.z - rad > b.z1) continue;
      if (b.y1 > y) { y = b.y1; bb = b; }
    }
    return { y, b: bb };
  }
  // plafond au-dessus de la tête
  function ceiling(p, h) {
    let c = 1e9; const rad = R_PL * 0.85;
    for (const rm of S.rooms.values()) for (const b of rm.solids) {
      if (b.off || b.y0 < p.y + h - 0.05) continue;
      if (p.x + rad < b.x0 || p.x - rad > b.x1 || p.z + rad < b.z0 || p.z - rad > b.z1) continue;
      if (b.y0 < c) c = b.y0;
    }
    return c;
  }

  /* ---------- joueur local ---------- */
  function updateMe(dt) {
    const me = S.me;
    S.slideCd = Math.max(0, S.slideCd - dt); S.inv = Math.max(0, S.inv - dt);
    if (me.dead) { me.vx = me.vz = 0; me.speed = 0; return; }
    if (S.hide) { me.vx = me.vz = 0; me.vy = 0; me.speed = 0; me.ground = true; return; }
    const F = S.fail;
    if (F && F.ent) { me.vx = me.vz = 0; me.speed = 0; return; }
    if (F && F.cause === 'lava') { me.vx *= 0.9; me.vz *= 0.9; me.y -= dt * 0.7; me.speed = 0; return; }
    const ok = !S.paused && !S.chatOpen && !F;
    let f = 0, s = 0;
    if (ok) { f = (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0); s = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0); }
    const crouchKey = ok && down('KeyC', 'ControlLeft', 'ControlRight'), moving = !!(f || s);
    const wasCrouch = me.crouch;
    me.crouch = crouchKey || S.slide > 0 || (wasCrouch && ceiling(me, MV.hC) < me.y + MV.hS);
    me.sprint = ok && !me.crouch && moving && f >= 0 && down('ShiftLeft', 'ShiftRight');
    const h = me.crouch ? MV.hC : MV.hS;
    let dx = 0, dz = 0;
    if (moving) { const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw); dx = -sy * f + cy * s; dz = -cy * f - sy * s; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
    if (S.slide > 0) { S.slide -= dt; const k = Math.max(0, 1 - dt * 1.4); me.vx *= k; me.vz *= k; }
    else if (F) { if (me.ground) { const k = Math.max(0, 1 - dt * 5); me.vx *= k; me.vz *= k; } }   // projeté (gant de boxe) : on glisse puis on s'arrête
    else {
      let want = me.crouch ? MV.crouch : me.sprint ? MV.sprint : MV.walk; if (f < 0) want *= 0.85;
      const acc = me.ground ? 16 : 3.2;
      if (me.ground || moving) { me.vx += (dx * want - me.vx) * Math.min(1, dt * acc); me.vz += (dz * want - me.vz) * Math.min(1, dt * acc); }
    }
    // saut (mémorisé 0,16 s, et toléré 0,1 s après avoir quitté un bord)
    if (!me.ground) S.coyote += dt; else S.coyote = 0;
    if (ok && S.jumpBuf > 0 && (me.ground || S.coyote < 0.1) && me.vy <= 0.01 && ceiling(me, h) > me.y + h + 0.25) {
      me.vy = MV.jump; me.ground = false; me.plat = null; S.coyote = 1; S.jumpBuf = 0; Au.jump(); if (S.slide > 0) S.slide = 0;
    }
    // plateforme mobile : on suit son déplacement
    if (me.ground && me.plat && me.plat.dx) { me.x += me.plat.dx; pushOut(me, h); }
    const ox = me.x, oz = me.z, mx = me.vx * dt, mz = me.vz * dt, n = Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.1));
    for (let i = 0; i < n; i++) { me.x += mx / n; me.z += mz / n; pushOut(me, h); }
    // vertical
    const sup = support(me, 0.17, MV.step);
    if (me.ground) {
      if (sup.b && sup.y >= me.y - 0.3 && me.vy <= 0) { if (sup.y > me.y + 0.05) Au.step(0.4, 0, rmSurf()); me.y = sup.y; me.vy = 0; me.plat = sup.b; }
      else { me.ground = false; me.plat = null; }
    }
    if (!me.ground) {
      me.vy = Math.max(-28, me.vy - MV.grav * dt);
      let ny = me.y + me.vy * dt;
      if (me.vy > 0) { const c = ceiling(me, h); if (ny + h > c) { ny = c - h; me.vy = 0; } }
      if (me.vy <= 0 && sup.b && ny <= sup.y) { if (me.vy < -6) Au.land(BR.clamp(-me.vy / 14, 0.3, 1.2), rmSurf()); me.y = sup.y; me.vy = 0; me.ground = true; me.plat = sup.b; }
      else me.y = ny;
    }
    me.speed = Math.hypot(me.x - ox, me.z - oz) / dt;
    if (me.ground && me.speed > 0.6 && S.slide <= 0) {
      S.stepDist += me.speed * dt;
      const stride = me.sprint ? 2.2 : me.crouch ? 1.1 : 1.65;
      if (S.stepDist > stride) { S.stepDist = 0; Au.step(me.sprint ? 0.9 : me.crouch ? 0.22 : 0.55, 0, rmSurf()); }
    }
  }
  function rmSurf() { const rm = S.rooms.get(S.me.room); return rm ? rm.TH.surf : 'tile'; }
  function roomAt(z) {
    const rs = S.plan.rooms; if (z > rs[0].z0) return 0;
    let lo = 0, hi = rs.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (rs[m].z0 >= z) lo = m; else hi = m - 1; }
    return lo;
  }

  /* ---------- joueurs distants ---------- */
  function updateRemotes(dt) {
    for (const p of S.players.values()) {
      if (p === S.me || !p.av) continue;
      const ax = p.tx + p.vx * 0.06, az = p.tz + p.vz * 0.06, dx = ax - p.x, dz = az - p.z, dy = p.ty - p.y;
      if (Math.hypot(dx, dz) > 6 || Math.abs(dy) > 4) { p.x = p.tx; p.z = p.tz; p.y = p.ty; }
      else { const k = Math.min(1, dt * 12); p.x += dx * k; p.z += dz * k; p.y += dy * Math.min(1, dt * 14); }
      p.yaw += BR.angDiff(p.yaw, p.tyaw) * Math.min(1, dt * 14);
      p.speed = Math.hypot(p.vx, p.vz);
      const av = p.av, vis = !p.hidden && !p.dead; av.group.position.set(p.x, p.y, p.z); av.group.rotation.y = p.yaw + Math.PI;
      av.group.visible = vis; p.tag.sprite.visible = vis;
      p.tag.sprite.position.set(p.x, p.y + 2.15 - (p.crouch ? 0.35 : 0), p.z);
      av.update(dt, p.speed, { crouch: p.crouch, sprint: p.sprint, pitch: p.pitch });
      if (vis && p.speed > 0.6 && Math.abs(p.y - p.ty) < 0.2) {
        p.stepDist += p.speed * dt;
        if (p.stepDist > (p.sprint ? 2.2 : 1.65)) { p.stepDist = 0; const d = Math.hypot(p.x - S.cam.position.x, p.z - S.cam.position.z); if (d < 20) Au.step((p.sprint ? 0.8 : 0.4) * (1 - d / 20), panOf(p.x, p.z)); }
      }
    }
  }

  /* ---------- salles : progression du groupe, début des salles, portes, interactions ---------- */
  function alivePlayers() { return [...S.players.values()].filter(p => !p.dead); }
  function updateRooms(dt) {
    const me = S.me;
    if (!me.dead && !S.fail) { const k = roomAt(me.z); if (k > me.room && k <= me.room + 1) enterRoom(k); }
    const alive = alivePlayers();
    if (alive.length) S.gRoom = Math.max(S.gRoom, Math.min(...alive.map(p => p.room)));
    const g = S.gRoom;
    for (const rm of S.rooms.values()) if (rm.k < g && !rm.slammed) slam(rm);
    const maxR = Math.max(g, ...[...S.players.values()].map(p => p.room));
    for (let k = Math.max(0, g - 1); k <= maxR + 1; k++) if (!S.rooms.has(k)) buildRoom(k);
    for (const rm of [...S.rooms.values()]) if (rm.k < g - 1 || rm.k > maxR + 1) disposeRoom(rm);
    // début de la salle du groupe (horloge commune ; l'hôte l'annonce)
    const cur = S.rooms.get(g);
    if (cur && cur.start < 0 && S.time >= S.introUntil && alive.length) {
      if (S.rsq[g] != null) startRoom(cur, S.rsq[g]);
      else if (S.solo || S.isHost) { startRoom(cur, ht()); if (!S.solo) BR.Net.relay({ k: 'rs', r: g, t: Math.round(ht() * 100) / 100 }, '*'); }
      else { cur.wait = (cur.wait || 0) + dt; if (cur.wait > 2.5) startRoom(cur, ht()); }   // filet de sécurité si l'annonce se perd
    }
    for (const rm of S.rooms.values()) if (rm.T.update) rm.T.update(rm, dt);
    S.codeRoom = null;
    if (me.dead || S.fail) { S.focus = null; return; }
    const rm = S.rooms.get(me.room); if (!rm) return;
    if (me.y < rm.killY) { fail(rm.T.killCause || 'void'); return; }
    if (rm.T.local) rm.T.local(rm, dt);
    if (!S || S.fail) return;
    keeper(rm);
    exitDoors(rm);
    interactions(rm);
  }
  function enterRoom(k) {
    const me = S.me; me.room = k; me.score = Math.max(me.score, k);
    S.held = null; S.code = ''; S.meter = 0;
    const pl = S.plan.rooms[k], T = TYPES[pl.type];
    S.flash = 1;
    Au.tone({ freq: 523, dur: 0.18, gain: 0.07, type: 'triangle' }); Au.tone({ freq: 784, dur: 0.32, gain: 0.07, type: 'triangle', delay: 0.09 });
    banner('SALLE ' + (k + 1), T.name, pl.type === 'rest' ? 'good' : '', 2200);
    if (me.score === S.best + 1 && S.best > 0) { feed('Nouveau record !', 'good'); Au.meme('dj_airhorn', 0.45); }
    else if (me.score > 0 && me.score % 10 === 0) { feed(me.score + ' salles ! Tu es une légende.', 'good'); Au.meme('yeah_boy', 0.5); }
  }
  function startRoom(rm, t) {
    if (rm.start >= 0) return;
    rm.start = t; S.rsq[rm.k] = t;
    if (rm.T.start) rm.T.start(rm);
  }
  function solve(rm, local) {
    if (rm.solved) return;
    rm.solved = true;
    if (rm.T.onSolve) rm.T.onSolve(rm);
    if (local && !S.solo) BR.Net.relay({ k: 'ev', r: rm.k, a: 'sol' }, '*');
    if (rm.st.keeper) { rm.st.keeper.flee = true; rm.st.keeper = null; }
    if (S.me.room === rm.k && !S.me.dead && !rm.T.customDoors) {
      Au.door('open', 0, 0.5); [659, 880, 1175].forEach((f, i) => Au.tone({ freq: f, dur: 0.25, gain: 0.07, type: 'triangle', delay: i * 0.09 }));
      banner('OUVERT !', 'La porte est déverrouillée.', 'good', 1600);
    }
  }
  function roomEvent(rm, e) {
    if (e.a === 'sol') solve(rm, false);
    else if (rm.T.event) rm.T.event(rm, e, e.p);
  }
  const unlocked = rm => rm.start >= 0 && rm.solved && S.gRoom >= rm.k;
  function lockMsg(rm) {
    if (rm.start < 0 || S.gRoom < rm.k) return S.solo ? 'Pas encore…' : 'Verrouillée : attends que tous les survivants soient dans la salle.';
    return rm.T.lockMsg ? rm.T.lockMsg(rm) : 'Verrouillée.';
  }
  function exitDoors(rm) {
    const me = S.me; let touching = false;
    for (const d of rm.doors) {
      const inX = Math.abs(me.x - d.x) < DW / 2 - 0.04;
      const touch = inX && me.z < rm.ZE + R_PL + 0.14 && me.z > rm.ZE - 0.3;
      if (rm.T.touch) { if (touch) { touching = true; if (!d.opened) rm.T.touch(rm, d); } continue; }
      if (d.opened) continue;
      if (unlocked(rm)) { if (Math.abs(me.x - d.x) < DW / 2 + 0.3 && me.z < rm.ZE + 1.6 && me.z > rm.ZE - 0.3) openDoor(rm.k, d.s, me, true); continue; }
      if (touch) { touching = true; if (rm.T.tryDoor && rm.start >= 0 && S.gRoom >= rm.k) rm.T.tryDoor(rm, d); else locked(lockMsg(rm)); }
    }
    if (!touching) S.lockMsg = '';
  }
  function locked(msg) {
    if (S.lockT > S.time) return;
    S.lockT = S.time + 1.1;
    Au.door('locked', 0, 0.8);
    if (msg) hint(msg);
    S.lockMsg = msg;
  }
  // chronomètre des énigmes : à zéro, le gardien de la salle arrive (et poursuit)
  function keeper(rm) {
    if (!rm.T.timeLeft || rm.type === 'quiz' || rm.solved || rm.start < 0 || rm.st.keeper || S.inv > 0) return;
    const tl = rm.T.timeLeft(rm); if (!tl || tl.left > 0) return;
    rm.st.keeper = spawnChaser({ sp: rm.imgs[1], x: rm.pl.en, z: rm.Z0 - 0.4, vmax: (4.6 + rm.pl.lvl * 1.4) * S.diff.speed, acc: 3, emerge: 1.4, cause: 'keeper' });
    banner('LE GARDIEN ARRIVE', 'Trop lent ! Résous l\'énigme… en courant.', 'bad', 2400);
    Au.fx('roar', { g: 1 }); Au.meme('evil_laugh', 0.5);
  }
  function interactions(rm) {
    const me = S.me;
    if (S.hide) { S.focus = null; return; }
    if (rm.pad && Math.hypot(me.x - rm.pad.x, me.z - rm.pad.z) < 2.3 && !rm.solved) S.codeRoom = rm;
    const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    let best = null, bs = 1e9;
    for (const it of rm.inter) {
      const dx = it.x - me.x, dz = it.z - me.z, d = Math.hypot(dx, dz); if (d > (it.r || 1.6)) continue;
      const dot = d > 0.25 ? (dx * fx + dz * fz) / d : 1; if (dot < 0.3) continue;
      const sc = d - dot * 1.5 + (it.read ? 0.8 : 0); if (sc < bs) { bs = sc; best = it; }
    }
    S.focus = best;
  }

  /* ---------- portes : ouverture, claquement, voyant ---------- */
  function openDoor(k, s, by, local) {
    const key = k + ':' + s; if (S.doorOpen.has(key)) return; S.doorOpen.add(key);
    const rm = S.rooms.get(k);
    if (rm && rm.doors[s]) {
      const d = rm.doors[s]; d.target = 1; d.opened = true; d.speed = d.good ? 2.4 : 5.5;
      const pan = panOf(d.x, rm.ZE), dist = Math.hypot(d.x - S.cam.position.x, rm.ZE - S.cam.position.z), g = BR.clamp(1.2 - dist / 25, 0.15, 1);
      Au.door('open', pan, g);
      if (!d.good) { Au.noise({ type: 'lowpass', freq: 380, dur: 0.6, gain: 0.45 * g, pan }); Au.tone({ freq: 70, freqEnd: 32, dur: 0.6, gain: 0.4 * g, type: 'sine', pan }); }
      if (rm.T.onOpen) rm.T.onOpen(rm, d, by, local, false);
      if (by && by !== S.me && d.good && rm.T.customDoors) feed(by.name + ' a trouvé la bonne porte !', 'good');
    }
    if (local && !S.solo) BR.Net.relay({ k: 'door', r: k, s }, '*');
  }
  function slam(rm) {
    rm.slammed = true;
    const d = rm.doors.find(x => x.good && x.opened) || rm.doors.find(x => x.good); if (!d) return;
    d.target = 0; d.speed = 7; d.slam = d.open > 0; d.col.off = false;
  }
  function updateDoors(dt) {
    for (const rm of S.rooms.values()) {
      const un = unlocked(rm);
      for (const d of rm.doors) {
        if (d.lamp) d.lamp.material.color.setHex(un || d.opened ? 0x30ff60 : 0xff2a1a);
        if (Math.abs(d.open - d.target) < 0.001) continue;
        const was = d.open;
        if (d.target > d.open) d.open = Math.min(d.target, d.open + dt * d.speed * (0.35 + (1 - d.open)));
        else d.open = Math.max(d.target, d.open - dt * d.speed);
        d.piv.rotation.y = d.sign * d.open * 1.72;
        if (d.target === 1 && d.open > 0.55) d.col.off = true;
        if (d.slam && was > 0 && d.open <= 0) {
          d.slam = false;
          const dist = Math.hypot(d.x - S.cam.position.x, rm.ZE - S.cam.position.z), g = BR.clamp(1.3 - dist / 18, 0.1, 1);
          Au.door('slam', 0, g); S.shake = Math.max(S.shake, 0.5 * g);
        }
      }
    }
  }

  /* ---------- entités qui poursuivent (images de monstres) ---------- */
  function spawnChaser(o) {
    const sp = o.sp | 0, spr = E.sprite(sp), h = spr ? spr.h : 2.4, w = h * (spr ? spr.aspect : 0.6);
    const mat = new THREE.MeshBasicMaterial({ map: chaseTex(sp), transparent: true, alphaTest: 0.06, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(GEO.chase, mat); mesh.frustumCulled = false;
    mesh.position.set(o.x, 0.45, o.z); mesh.scale.set(0.7, 0.93, 1); S.scene.add(mesh);
    const ch = { mesh, mat, sp, x: o.x, y: 0.45, z: o.z, z0: o.z, w, h, v: 2, t: 0, target: o.target || null, self: !o.target, done: false, fade: 1, voice: null,
      vmax: o.vmax || 14, acc: o.acc || 20, emerge: o.emerge == null ? 0.8 : o.emerge, cause: o.cause || 'caught', door: !!o.door, life: o.life || 0, until: o.until, flee: false };
    try { ch.voice = Au.botVoice(sp) || null; } catch (e) { ch.voice = null; }
    S.chasers.push(ch);
    if (ch.self) { S.panic = 1; Au.screech(0, 0.4); }
    return ch;
  }
  function killChaser(ch, now) {
    if (ch.voice) { try { ch.voice.stop(); } catch (e) {} ch.voice = null; }
    if (now || ch.fade <= 0) { S.scene.remove(ch.mesh); ch.mat.dispose(); ch.removed = true; }
  }
  function updateChasers(dt) {
    const cam = S.cam.position;
    for (const ch of S.chasers) {
      if (ch.removed) continue;
      ch.t += dt;
      const tg = ch.self ? S.me : ch.target;
      if (!ch.done && (ch.flee || (ch.self && (S.me.dead || (S.fail && S.fail.ch !== ch))) || (!ch.self && (!tg || tg.dead || (ch.life && ch.t > ch.life) || (ch.until != null && tg.z < ch.until))))) { ch.done = true; ch.fade = 1; }
      if (!ch.done) {
        const dx = tg.x - ch.x, dz = tg.z - ch.z, d = Math.hypot(dx, dz);
        if (ch.t < ch.emerge) { if (ch.door) ch.z = Math.min(ch.z0 + 0.9, ch.z + dt * 1.4); }
        else {
          const vmax = ch.door ? Math.max(ch.vmax, (ch.self ? S.me.speed : 8) + 3.6) : ch.vmax;
          ch.v = Math.min(vmax, ch.v + dt * ch.acc);
          if (d > 0.01) { const st = Math.min(d, ch.v * dt); ch.x += dx / d * st; ch.z += dz / d * st; }
        }
        const grow = ch.emerge > 0 ? BR.clamp(ch.t / ch.emerge, 0, 1) : 1, e = grow * grow * (3 - 2 * grow);
        ch.y = BR.lerp(0.53, 0.04, e) + Math.abs(Math.sin(ch.t * 9.5)) * 0.13 * e;
        ch.mesh.scale.set(BR.lerp(0.7, ch.w, e) * (1 + Math.sin(ch.t * 19) * 0.018), BR.lerp(0.93, ch.h, e), 1);
        if (d < 0.9 && ch.t > ch.emerge + 0.2) {
          ch.done = true;
          if (ch.self) { if (!S.fail && S.inv <= 0) fail(ch.cause, { sp: ch.sp, ch }); ch.fade = 0.25; }
          else ch.fade = 1;
        }
      } else {
        ch.fade -= dt * 2.5; ch.mat.opacity = Math.max(0, ch.fade); ch.mat.alphaTest = 0;
        if (ch.fade <= 0) killChaser(ch);
      }
      ch.mesh.position.set(ch.x + Math.sin(ch.t * 6.5) * 0.06, ch.y, ch.z);
      ch.mesh.rotation.y = Math.atan2(cam.x - ch.x, cam.z - ch.z);
      if (ch.voice) ch.voice.set(ch.x, 1.4, ch.z, ch.done ? 0 : 1);
    }
    S.chasers = S.chasers.filter(c => !c.removed);
  }

  /* ---------- échec : une vie en moins, retour au début de la salle ---------- */
  const SCARY = ['seen', 'look', 'caught', 'rush', 'wrong', 'time', 'keeper', 'dark'];
  function fail(cause, o) {
    const me = S.me; o = o || {};
    if (me.dead || S.fail || S.inv > 0 || S.ended) return false;
    if (S.hide) unhide();
    me.lives = Math.max(0, me.lives - 1);
    const F = FAILS[cause] || FAILS.caught, final = me.lives <= 0, ent = SCARY.includes(cause);
    const rm = S.rooms.get(me.room);
    S.fail = { cause, t: 0, dur: (ent ? 1.6 : cause === 'void' || cause === 'punch' ? 1.7 : 1.3) + (final ? 1.2 : 0), sp: o.sp != null ? o.sp : rm ? rm.imgs[0] : 0, final, ent, scared: false, ch: o.ch || null };
    S.death = { k: me.room, cause };
    banner(F.t, BR.pick(F.s), 'bad', 2600);
    if (F.meme) Au.meme(F.meme, 0.75);
    if (cause === 'void') { S.tumble = 1; Au.noise({ type: 'bandpass', freq: 700, freqEnd: 200, dur: 1.5, gain: 0.12, attack: 0.3 }); }
    else if (cause === 'lava') { Au.noise({ type: 'highpass', freq: 1800, freqEnd: 600, dur: 1.2, gain: 0.25 }); Au.fx('fire', { g: 1.5, len: 2 }); }
    else if (cause === 'zap') { Au.fx('zap', { g: 1.5 }); Au.fx('zap', { g: 1 }); S.flashW = 1; }
    else if (cause === 'punch') { S.tumble = 1; Au.tone({ freq: 180, freqEnd: 900, dur: 0.5, gain: 0.12, type: 'triangle' }); }
    if (ent) jumpscare(S.fail.sp);
    S.shake = Math.max(S.shake, ent ? 1.2 : 0.7);
    if (!S.solo) BR.Net.relay({ k: 'fail', r: me.room, c: cause, l: me.lives }, '*');
    return true;
  }
  function updateFail(dt) {
    const f = S.fail; if (!f) return;
    f.t += dt;
    if (S.tumble > 0) S.tumbleA += dt * 7;
    if (f.final && !f.ent && !f.scared && f.t > f.dur - 1.25) { f.scared = true; jumpscare(f.sp); }
    if (f.t >= f.dur) { if (f.final) out(); else respawn(); }
  }
  function respawn() {
    const me = S.me, rm = S.rooms.get(me.room) || buildRoom(me.room);
    S.fail = null; S.tumble = 0; S.tumbleA = 0;
    DOM.jump.classList.remove('on', 'stay');
    S.chasers.filter(c => c.self).forEach(c => killChaser(c, true));
    S.chasers = S.chasers.filter(c => !c.removed);
    const sp = rm.spawn; me.x = sp.x; me.y = sp.y; me.z = sp.z; me.vx = me.vy = me.vz = 0; me.ground = true; me.plat = null; me.yaw = 0; me.pitch = 0;
    S.inv = 1.4; S.slide = 0; S.code = ''; S.meter = 0;
    if (rm.st.keeper) { rm.st.keeper = null; rm.st.bonus = (rm.st.bonus || 0) + 25; }
    if (rm.T.onRespawn) rm.T.onRespawn(rm);
    Au.revive();
    feed(me.lives > 1 ? 'Encore ' + me.lives + ' vies.' : 'Dernière vie ! Attention…', me.lives > 1 ? '' : 'bad');
  }
  function out() {
    const me = S.me; S.fail = null; S.tumble = 0; me.dead = true; me.lives = 0;
    S.chasers.filter(c => c.self).forEach(c => killChaser(c, true));
    if (!S.solo) BR.Net.relay({ k: 'out', s: me.score }, '*');
    if (S.solo) { endGame(null, ''); return; }
    DOM.jump.classList.remove('on', 'stay');
    banner('PLUS DE VIES', alivePlayers().length ? 'Tu regardes les survivants (Espace pour changer).' : '', 'bad', 3500);
    pickSpec();
  }
  function jumpscare(sp) {
    const c = DOM.jumpC, w = window.innerWidth, h = window.innerHeight; c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const im = E.jumpCanvas(sp);
    if (im) { const k = Math.min(w / im.width, h / im.height) * 1.3, iw = im.width * k, ih = im.height * k; g.drawImage(im, (w - iw) / 2, (h - ih) / 2 + h * 0.05, iw, ih); }
    DOM.jump.classList.remove('on'); void DOM.jump.offsetWidth; DOM.jump.classList.add('on', 'stay');
    try { Au.botScream(sp); } catch (e) {}
    Au.sample('jumpscare', 0.9) || Au.jumpscare();
    Au.noise({ type: 'highpass', freq: 500, dur: 0.9, gain: 0.6 });
    Au.tone({ freq: 95, freqEnd: 38, dur: 1.1, gain: 0.6, type: 'square', lp: 1400 });
  }

  /* ---------- spectateur (multijoueur) ---------- */
  function spectating() { return S.me.dead && !S.fail; }
  function pickSpec() {
    const list = S.order.map(id => S.players.get(id)).filter(p => p && p !== S.me && !p.dead);
    S.spec = list.length ? (list.find(p => p.id === S.spec) || list[0]).id : null;
    if (S.spec) S.specYaw = S.players.get(S.spec).yaw;
  }
  function cycleSpec(dir) {
    const list = S.order.map(id => S.players.get(id)).filter(p => p && p !== S.me && !p.dead);
    if (!list.length) { S.spec = null; return; }
    const i = list.findIndex(p => p.id === S.spec);
    S.spec = list[(i + dir + list.length) % list.length].id; S.specYaw = S.players.get(S.spec).yaw; Au.ui('click');
  }

  /* ---------- lumières : réserve fixe de lampes attribuées aux sources les plus proches ---------- */
  const _c = new THREE.Color(), _red = new THREE.Color(0x1c0503);
  function updateLights(dt) {
    const cam = S.cam.position, panic = S.panic;
    if (S.panic > 0 && !S.chasers.some(c => c.self && !c.done)) S.panic = Math.max(0, S.panic - dt * 0.5);
    const crm = S.rooms.get(roomAt(cam.z)) || S.rooms.get(S.me.room), TH = crm ? crm.TH : THEMES.school, kk = Math.min(1, dt * 2.5);
    S.envD += (TH.dens - S.envD) * kk; S.scene.fog.density = S.envD + panic * 0.01;
    _c.setHex(TH.fog); S.fogCol.lerp(_c, kk); _c.copy(S.fogCol).lerp(_red, panic * 0.6);
    S.scene.fog.color.copy(_c); S.scene.background.copy(_c);
    S.amb.intensity += (TH.amb - S.amb.intensity) * kk; S.hemi.intensity = S.amb.intensity;
    S.torch.intensity += ((crm && crm.T.dark ? 2.4 : 0) - S.torch.intensity) * kk;
    const cand = [];
    for (const rm of S.rooms.values()) {
      const rate = 0.25 + rm.flick * 9 + panic * 3, tint = rm.tint;
      for (const f of rm.fix) {
        if (f.dead) { if (f.mat) f.mat.color.setRGB(0.09, 0.09, 0.08); if (f.glow) f.glow.material.opacity = 0; continue; }
        if (!(f.burst > 0) && Math.random() < dt * rate * 0.25) f.burst = Math.random() < 0.15 ? 0.6 + Math.random() * 1.4 : 0.1 + Math.random() * 0.5;
        let on = 1;
        if (f.burst > 0) { f.burst -= dt; on = Math.random() < 0.5 ? 0.06 : 1; if (on < 1 && Math.random() < dt * 8 && Math.hypot(f.x - cam.x, f.z - cam.z) < 9) Au.flick(); }
        if (f.lava) on = 0.85 + Math.sin(S.time * 2.3 + f.wob) * 0.15;
        f.cur += (on - f.cur) * Math.min(1, dt * 30);
        const k = f.cur * (0.92 + Math.sin(S.time * 0.7 + f.wob) * 0.04);
        _c.copy(f.col); if (tint && !f.panel) _c.multiply(tint);
        if (f.mat) f.mat.color.copy(_c).multiplyScalar(0.12 + 2.6 * k);
        if (f.glow) { f.glow.material.color.copy(_c); f.glow.material.opacity = 0.5 * k; }
        cand.push({ x: f.x, y: f.y, z: f.z, i: f.i * k, c: _c.clone(), d: (f.x - cam.x) ** 2 + (f.z - cam.z) ** 2 + (f.y - cam.y) ** 2 * 0.3 - (f.panel ? 4 : 0) });
      }
    }
    cand.sort((a, b) => a.d - b.d);
    S.pool.forEach((l, i) => {
      const c = cand[i];
      if (!c) { l.intensity = 0; return; }
      l.position.set(c.x, c.y, c.z); l.intensity = c.i; l.color.copy(c.c);
    });
  }

  /* ---------- caméra ---------- */
  function updateCamera(dt) {
    const me = S.me, cam = S.cam;
    if (spectating()) {
      const t = S.spec ? S.players.get(S.spec) : null;
      if (t && !t.dead) {
        const yaw = S.specYaw, bx = Math.sin(yaw), bz = Math.cos(yaw);
        const trm = S.rooms.get(t.room), hx = trm ? trm.HX - 0.3 : 2;
        cam.position.set(BR.clamp(t.x + bx * 2.6, -hx, hx), t.y + 2.0, t.z + bz * 2.6); cam.lookAt(t.x, t.y + 1.3, t.z);
      } else {
        if (S.spec) pickSpec();
        const rm = S.rooms.get(S.gRoom); const z = rm ? rm.ZE + Math.min(7, rm.pl.L - 1) : -5;
        cam.position.set(0, 2.2, z); cam.rotation.set(-0.08, Math.sin(S.time * 0.2) * 0.25, 0);
      }
    } else {
      const targetEye = S.hide ? 1.5 : S.slide > 0 ? 0.85 : me.crouch ? MV.eyeC : MV.eye;
      S.eye += (targetEye - S.eye) * Math.min(1, dt * 12);
      let bob = 0, roll = 0;
      if (BR.settings.bob && me.speed > 0.5 && me.ground && S.slide <= 0) { S.bobT += dt * me.speed * 2.1; bob = Math.sin(S.bobT * 2) * 0.035 * Math.min(1.4, me.speed / 4); roll = Math.sin(S.bobT) * 0.008 * me.speed / 4; }
      cam.position.set(me.x, me.y + S.eye + bob, me.z);
      if (S.tumble > 0) cam.rotation.set(me.pitch + Math.sin(S.tumbleA * 0.7) * 0.9, me.yaw + S.tumbleA * 0.35, S.tumbleA);
      else cam.rotation.set(me.pitch, me.yaw, roll);
    }
    if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt * 1.6); const k = S.shake * S.shake * 0.09; cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.rotation.z += (Math.random() - 0.5) * k * 0.6; }
    const ch = S.chasers.find(c => c.self && !c.done);
    if (ch) {   // tremblement croissant à l'approche de l'image
      const d = Math.hypot(ch.x - me.x, ch.z - me.z), k = Math.pow(BR.clamp(1 - (d - 1) / 14, 0, 1), 1.5), tt = S.time;
      cam.position.x += (Math.sin(tt * 47) * 0.6 + (Math.random() - 0.5) * 0.8) * 0.06 * k; cam.position.y += (Math.sin(tt * 53 + 1) * 0.6 + (Math.random() - 0.5) * 0.8) * 0.05 * k;
    }
    const spd = Math.hypot(me.vx, me.vz);
    const fov = BR.settings.fov + (spd > MV.walk + 1 && !spectating() ? Math.min(12, (spd - MV.walk) * 2.4) : 0) + (ch ? 6 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix(); }
  }
  function panOf(x, z) {
    const cam = S.cam, dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz) || 1, yaw = cam.rotation.y;
    return BR.clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d, -1, 1);
  }

  /* ---------- sons : bourdonnement des néons, musique de poursuite, petits bruits ---------- */
  let hum = null;
  function startHum() {
    stopHum();
    const ctx = Au.ctx && Au.ctx(); if (!ctx) return;
    try {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 100; o2.type = 'square'; o2.frequency.value = 200.6;
      f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 1.4; g.gain.value = 0.0001;
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(Au.bus());
      o.start(); o2.start();
      g.gain.setTargetAtTime(0.018, ctx.currentTime, 0.5);
      hum = { o, o2, g, ctx };
    } catch (e) { hum = null; }
  }
  function stopHum() { if (!hum) return; try { hum.g.gain.setTargetAtTime(0.0001, hum.ctx.currentTime, 0.1); hum.o.stop(hum.ctx.currentTime + 0.4); hum.o2.stop(hum.ctx.currentTime + 0.4); } catch (e) {} hum = null; }
  const _v = new THREE.Vector3();
  function updateAudio(dt) {
    const me = S.me, rm = S.rooms.get(me.room);
    S.cam.getWorldDirection(_v); Au.listener(S.cam.position, _v);
    const chase = S.chasers.some(c => c.self && !c.done) || !!(rm && rm.hs && (rm.hs.warn != null || rm.hs.run));
    const want = chase ? 'poursuite' : 'backrooms';
    if (S.music !== want) { S.music = want; Au.track('music', want, chase ? 0.85 : 0.22); }
    let press = 0;
    const tl = rm && rm.T.timeLeft && !me.dead ? rm.T.timeLeft(rm) : null;
    if (tl && !rm.solved) press = BR.clamp(1 - tl.left / tl.tot, 0, 1);
    try { Au.setTension(Math.min(1, press * 0.5 + S.panic * 0.6 + S.meter * 0.5)); } catch (e) {}
    if (tl && !rm.solved && tl.left > 0 && tl.left < 5.2) { const sec = Math.ceil(tl.left); if (sec !== S.tick) { S.tick = sec; Au.tone({ freq: sec <= 2 ? 2100 : 1700, dur: 0.05, gain: 0.07, type: 'square', lp: 5000 }); if (sec <= 3) Au.thump(0.6); } }
    if (hum) hum.g.gain.setTargetAtTime(rm && rm.T.dark ? 0.002 : 0.016, hum.ctx.currentTime, 0.3);
    if (!me.dead && !S.paused) {
      S.dread -= dt;
      if (S.dread <= 0) {
        S.dread = 18 + Math.random() * 14;
        const pn = Math.random() * 2 - 1, r = Math.random();
        if (r < 0.25) Au.growl(pn, 0.3); else if (r < 0.5) Au.whisper(pn);
        else if (r < 0.7) { for (let i = 0; i < 4; i++) setTimeout(() => S && Au.step(0.5, pn * 0.8), i * 340); }
        else Au.knock(null, 3);
      }
    }
  }

  /* ---------- interface en jeu ---------- */
  function updateHud(dt) {
    const me = S.me, k = me.dead ? S.gRoom : me.room, rm = S.rooms.get(k);
    DOM.score.textContent = me.score;
    if (S.hudLives !== me.lives) {
      S.hudLives = me.lives; const mx = Math.max(S.diff.lives, me.lives);
      DOM.lives.innerHTML = Array.from({ length: mx }, (_, i) => '<i class="' + (i < me.lives ? 'on' : '') + '">' + HEART + '</i>').join('');
      DOM.lives.classList.remove('pop'); void DOM.lives.offsetWidth; DOM.lives.classList.add('pop');
    }
    let light = '', eye = false;
    if (rm) {
      if (S.hudRoom !== k) { S.hudRoom = k; DOM.room.textContent = k + 1; DOM.name.textContent = rm.T.title ? rm.T.title(rm) : rm.T.name; DOM.top.classList.remove('pop'); void DOM.top.offsetWidth; DOM.top.classList.add('pop'); }
      const q = rm.T.hud ? rm.T.hud(rm) : rm.T.goal; if (q !== S.hudQ) { S.hudQ = q; DOM.q.textContent = q; }
      const tl = rm.T.timeLeft ? rm.T.timeLeft(rm) : null, waiting = rm.start < 0;
      let cls = 'd-top';
      if (waiting) { cls += ' notimer'; DOM.tt.textContent = S.time < S.introUntil ? 'PRÊT ?' : S.solo ? '' : 'ATTENTE…'; }
      else if (!tl || (rm.type === 'quiz' && rm.doors[rm.pl.good].opened)) { cls += rm.type === 'quiz' ? ' ok' : ' notimer'; DOM.tt.textContent = rm.type === 'quiz' ? 'OUVERTE' : rm.solved && rm.T.puzzle ? 'OUVERT' : ''; if (rm.type === 'quiz') DOM.timer.style.width = '100%'; }
      else {
        const left = Math.max(0, tl.left);
        DOM.timer.style.width = (left / tl.tot * 100).toFixed(1) + '%';
        DOM.tt.textContent = left <= 0 ? (tl.keeper ? 'IL ARRIVE' : '0,0 s') : left.toFixed(1).replace('.', ',') + ' s';
        cls += left < 3 ? ' crit' : left < tl.tot * 0.4 ? ' warn' : '';
      }
      if (DOM.top.className.replace(' pop', '') !== cls) DOM.top.className = cls + (DOM.top.classList.contains('pop') ? ' pop' : '');
      const sd = rm.T.side && !me.dead ? rm.T.side(rm) : '';
      if (sd !== S.hudSide) { S.hudSide = sd; DOM.side.innerHTML = sd; }
      if (rm.type === 'redlight' && rm.start >= 0 && rm.phase && !me.dead) light = rm.phase.red ? 'red' : 'green';
      eye = rm.type === 'eyes' && rm.start >= 0 && !me.dead;
    }
    DOM.light.className = 'd-light' + (light ? ' on ' + light : ''); DOM.lightT.textContent = light === 'red' ? 'STATUE !' : light === 'green' ? 'AVANCE' : '';
    DOM.eye.classList.toggle('on', eye); if (eye) DOM.eyeI.style.width = (S.meter * 100).toFixed(0) + '%';
    // invite d'action
    const f = S.focus, pr = S.hide ? 'E : sortir de l\'armoire' : f && !me.dead && !S.fail ? (typeof f.label === 'function' ? f.label() : f.label) : '';
    if (pr !== S.hudPr) { S.hudPr = pr; DOM.prompt.textContent = pr; DOM.prompt.classList.toggle('on', !!pr); DOM.prompt.classList.toggle('read', !!(f && f.read)); }
    // indications
    if (!S.locked && !S.paused && !S.chatOpen && !S.fail) hint('Clique dans la fenêtre pour prendre le contrôle.');
    else if (!me.dead && !S.lockMsg) {
      if (me.room === 0 && S.time > S.introUntil && S.time < 14) hint('Avance vers la porte. Toutes les 5 bonnes réponses, une salle piège t\'attend !');
      else if (rm && rm.start < 0 && !S.solo && S.time > S.introUntil) hint('Attends que tous les survivants soient dans la salle.');
      else if (S.inv > 0 && !S.fail) hint('De retour au début de la salle…');
      else hint('');
    } else if (me.dead) hint('');
    // voiles : rouge (poursuite), violet (regard), orange (lave), blanc (laser), flash de passage
    const ch = S.chasers.find(c => c.self && !c.done);
    const chk = ch ? BR.clamp(1 - Math.hypot(ch.x - me.x, ch.z - me.z) / 14, 0, 1) : 0;
    DOM.red.style.opacity = Math.max(chk * 0.7, S.panic * 0.25 * (0.7 + 0.3 * Math.sin(S.time * 10))).toFixed(2);
    DOM.tint.style.opacity = (S.meter * 0.85).toFixed(2);
    DOM.lava.style.opacity = S.fail && S.fail.cause === 'lava' ? Math.min(1, S.fail.t * 1.6).toFixed(2) : '0';
    DOM.white.style.opacity = S.flashW.toFixed(2);
    DOM.slats.classList.toggle('on', !!S.hide);
    DOM.vig.style.opacity = (0.55 + (rm && rm.T.dark ? 0.3 : 0)).toFixed(2);
    DOM.root.style.setProperty('--flash', S.flash.toFixed(2));
    DOM.root.classList.toggle('inv', S.inv > 0 && !S.fail);
    // joueurs (multi)
    S.hudT -= dt;
    if (!S.solo && S.hudT <= 0) {
      S.hudT = 0.25;
      DOM.plist.innerHTML = S.order.map(id => S.players.get(id)).filter(Boolean).map(p => `<div class="${p.dead ? 'dead' : ''} ${p === me ? 'me' : ''}"><span>${BR.esc(p.name)}</span><em>${p.dead ? '' : '♥'.repeat(Math.min(6, p.lives))}</em><b>${p.score}</b></div>`).join('');
      if (DOM.tab.classList.contains('on')) scoreboard(true);
    }
  }
  function scoreboard(on) {
    if (!S || !DOM) return;
    DOM.tab.classList.toggle('on', !!on); if (!on) return;
    const rows = S.order.map(id => S.players.get(id)).filter(Boolean).sort((a, b) => b.score - a.score)
      .map(p => `<tr class="${p === S.me ? 'me' : ''}"><td>${BR.esc(p.name)}</td><td>${p.score}</td><td>${p.dead ? '<span class="bad">Plus de vies</span>' : '<span class="ok">' + p.lives + (p.lives > 1 ? ' vies' : ' vie') + '</span>'}</td></tr>`).join('');
    DOM.tab.innerHTML = `<div class="box"><h3>LES PORTES <span style="color:${S.diff.color}">${S.diff.name}</span></h3><table><tr><th>Joueur</th><th>Salles</th><th>État</th></tr>${rows}</table><div class="ft">Salle ${S.gRoom + 1} · ${BR.fmtTime(S.time)}</div></div>`;
  }

  /* =====================================================================
     11. RÉSEAU (relais du serveur existant)
     ===================================================================== */
  function netSend(dt) {
    if (S.solo) return;
    S.sendT -= dt; if (S.sendT > 0) return; S.sendT = 1 / 15;
    const me = S.me, r2 = v => Math.round(v * 100) / 100;
    const m = { k: 'st', x: r2(me.x), y: r2(me.y), z: r2(me.z), yaw: r2(me.yaw), pi: r2(me.pitch), vx: r2(me.vx), vz: r2(me.vz), sp: me.sprint ? 1 : 0, cr: me.crouch ? 1 : 0, r: me.room, s: me.score, l: me.lives, dd: me.dead ? 1 : 0, hd: me.hidden ? 1 : 0 };
    if (S.isHost) m.ht = r2(S.time);
    BR.Net.relay(m, '*');
  }
  function onRelay(m) {
    if (!S) return;
    const d = m.d; if (!d || !d.k) return;
    const p = S.players.get(m.f); if (!p || p === S.me) return;
    switch (d.k) {
      case 'st':
        p.tx = +d.x || 0; p.ty = +d.y || 0; p.tz = +d.z || 0; p.tyaw = +d.yaw || 0; p.pitch = +d.pi || 0; p.vx = +d.vx || 0; p.vz = +d.vz || 0;
        p.sprint = !!d.sp; p.crouch = !!d.cr; p.hidden = !!d.hd; p.room = Math.max(p.room, d.r | 0); p.score = Math.max(p.score, d.s | 0); p.seen = S.time;
        if (d.l != null) p.lives = d.l | 0;
        if (d.dd && !p.dead) { p.dead = true; if (S.spec === p.id) pickSpec(); }
        if (d.ht != null && m.f === S.hostId && !S.isHost) {   // horloge de l'hôte (≈ 50 ms de trajet)
          const off = (+d.ht + 0.05) - S.time;
          if (!S.offOk || Math.abs(off - S.off) > 1.5) { S.off = off; S.offOk = true; } else S.off += (off - S.off) * 0.08;
        }
        break;
      case 'door': openDoor(d.r | 0, d.s | 0, p, false); break;
      case 'ev': { const e = { a: d.a, v: d.v, s: d.s, p }, rm = S.rooms.get(d.r | 0); if (rm) roomEvent(rm, e); else (S.evq[d.r | 0] = S.evq[d.r | 0] || []).push(e); break; }
      case 'rs': { const r = d.r | 0, t = +d.t; if (!isFinite(t)) break; S.rsq[r] = t; const rm = S.rooms.get(r); if (rm && rm.start < 0) startRoom(rm, t); else if (rm && Math.abs(rm.start - t) > 0.25) rm.start = t; break; }   // l'hôte fait foi
      case 'fail': { if (d.l != null) p.lives = d.l | 0; const F = FAILS[d.c] || FAILS.caught; feed(p.name + ' : ' + F.t.toLowerCase() + ' !' + (p.lives > 0 ? ' (' + p.lives + (p.lives > 1 ? ' vies)' : ' vie)') : ''), 'bad'); break; }
      case 'out': if (!p.dead) { p.dead = true; p.lives = 0; feed(p.name + ' n\'a plus de vies…', 'bad'); if (S.spec === p.id) pickSpec(); } break;
    }
  }
  function onChat(m) {
    if (!S) return;
    feed((m.n || '?') + ' : ' + (m.m || ''), 'chat'); Au.ui('msg');
  }
  function onLeft(m) {
    if (!S) return;
    const p = S.players.get(m.id); if (!p || p === S.me) return;
    if (p.av) { S.scene.remove(p.av.group); p.av.dispose(); } if (p.tag) { S.scene.remove(p.tag.sprite); p.tag.tex.dispose(); }
    S.players.delete(m.id); S.order = S.order.filter(x => x !== m.id);
    S.chasers.filter(c => c.target === p).forEach(c => { c.target = null; c.flee = true; c.self = false; });
    feed(p.name + (m.reason === 'kick' ? ' a été exclu' : ' a quitté la partie'), '');
    if (S.spec === m.id) pickSpec();
  }

  /* =====================================================================
     12. FIN DE PARTIE
     ===================================================================== */
  function buildRes(aborted) {
    const res = { players: {}, diff: S.diff.id, time: Math.round(S.time), room: S.gRoom, aborted: !!aborted };
    S.players.forEach(p => { res.players[p.id] = { n: p.name, s: p.score, sk: (p.look || {}).skin || 'survivor', x: p.dead ? 1 : 0 }; });
    return res;
  }
  function checkEnd() {
    if (S.ended || S.solo) return;
    if (alivePlayers().length || S.fail) { S.endAt = null; return; }
    if (S.endAt == null) S.endAt = S.time + (S.isHost ? 3 : 12);
    if (S.time < S.endAt) return;
    if (S.isHost && !S.endSent) { S.endSent = true; BR.Net.send({ t: 'end', res: buildRes() }); S.endAt = S.time + 5; return; }
    endGame(null, '');
  }
  function rewardFor(score, res) {
    const lines = [], add = (label, v) => { if (v) lines.push({ label, v }); return v; };
    let pts = 0;
    pts += add('Salles franchies × ' + score, score * 10);
    pts += add('Paliers de 10 salles × ' + Math.floor(score / 10), Math.floor(score / 10) * 50);
    if (!S.solo) {
      const all = Object.values(res.players), top = Math.max(...all.map(p => p.s || 0));
      if (all.length > 1 && score > 0 && score >= top) pts += add('Meilleur score de l\'équipe', 40);
    }
    const mult = S.diff.mult, total = Math.round(pts * mult), xp = Math.round(total * 1.2 + 15);
    return { points: total, xp, lines, mult };
  }
  const ENDT = ['FIN DU VOYAGE', 'LES PORTES ONT GAGNÉ', 'TOUTES TES VIES Y SONT PASSÉES'];
  function endGame(res, reason) {
    if (!S || S.ended) return;
    S.ended = true;
    res = res && res.players ? res : buildRes();
    const me = S.me; res.players[S.selfId] = { n: me.name, s: me.score, sk: (me.look || {}).skin || 'survivor', x: me.dead ? 1 : 0 };
    const Acc = BR.Account, st = Acc.p.stats, key = 'portes_' + S.diff.id;
    st.best = st.best || {};
    const prevBest = st.best[key] || 0, newBest = me.score > prevBest;
    if (newBest) st.best[key] = me.score;
    const rw = rewardFor(me.score, res);
    const lv = Acc.applyResult({ points: rw.points, xp: rw.xp, escaped: false, died: !res.aborted, time: Math.round(S.time), multi: !S.solo });
    const dk = S.death ? S.death.k : me.room, pl = S.plan.rooms[dk], T = TYPES[pl.type], F = S.death ? FAILS[S.death.cause] || FAILS.caught : null;
    const quiz = pl.type === 'quiz' ? Q[pl.q] : null;
    const death = { k: dk, room: T.name, why: F ? F.t.charAt(0) + F.t.slice(1).toLowerCase() + ' (' + T.name + ')' : '', reason: S.death ? S.death.cause : 'quit' };
    if (quiz && S.death && ['wrong', 'time', 'dark'].includes(S.death.cause)) Object.assign(death, { q: quiz[0], good: quiz[1], bad: quiz[2], reason: S.death.cause === 'time' ? 'time' : 'wrong' });
    const summary = { solo: S.solo, diff: S.diff, score: me.score, best: Math.max(prevBest, me.score), prevBest, newBest, reward: rw, level: lv, res, selfId: S.selfId, reason: reason || '', aborted: !!res.aborted,
      title: me.score >= 10 ? 'BEAU PARCOURS' : BR.pick(ENDT), unit: ['salle franchie', 'salles franchies'], death };
    const cb = S.o.onEnd;
    DOM.fade.classList.add('on');
    setTimeout(() => { D.stop(); if (cb) cb(summary); }, 1000);
  }
  function abortGame(msg) {
    if (!S || S.ended) return;
    endGame(buildRes(true), msg);
  }
  function quit() {
    if (!S || S.ended) return;
    if (!S.solo) { BR.Net.leave(); abortGame('Tu as quitté la partie.'); }
    else abortGame('Partie abandonnée.');
  }

  /* ---------- outils de test ---------- */
  D._debug = () => S;
  D._goto = function (k) {   // téléporte le joueur local au début de la salle k (solo)
    if (!S) return;
    const me = S.me, pl = S.plan.rooms[k]; if (!pl) return;
    for (let i = Math.max(0, k - 1); i <= k + 1; i++) if (!S.rooms.has(i)) buildRoom(i);
    me.room = k; me.score = k; S.gRoom = Math.max(S.gRoom, k); S.fail = null; S.inv = 0;
    me.x = pl.en; me.y = 0; me.z = pl.z0 - 1.1; me.vx = me.vy = me.vz = 0; me.ground = true; me.yaw = 0; me.pitch = 0;
    S.introUntil = Math.min(S.introUntil, S.time);
  };
  D._solve = function () {   // résout la salle du joueur local
    if (!S) return;
    const rm = S.rooms.get(S.me.room); if (!rm) return;
    if (rm.T.customDoors) { const g = rm.doors.find(d => d.good); if (g) openDoor(rm.k, g.s, S.me, true); }
    if (rm.type === 'hide') rm.solved = true;
    solve(rm, true);
  };
})();

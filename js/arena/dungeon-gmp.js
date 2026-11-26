/* ===== arena/dungeon-gmp.js : les salles du Savoir — questions de GMP, ludiques et (un peu) drôles =====
   - DG.GMPQ : banque de questions (thème, question, bonne réponse, 2 mauvaises, explication)
   - « Le Pont des Savoirs » : une passerelle au-dessus du vide ; on marche sur la dalle de la bonne réponse,
     les mauvaises s'effondrent (plouf… enfin, aïe)
   - « Le Grand Oral du Professeur Boulon » : un automate géant pose 5 questions ; on se place sur la plaque de sa
     réponse avant la fin du sablier ; il foudroie les mauvaises réponses (gentiment)
   Chaque joueur répond pour lui (récompense selon son propre score). */
(function () {
  const BR = window.BR, V3 = THREE.Vector3, DG = BR.Dungeon;
  const L = c => new THREE.Color(c).convertSRGBToLinear();
  const BOX = new THREE.BoxGeometry(1, 1, 1);

  /* =====================================================================
     BANQUE DE QUESTIONS (bonne réponse en premier ; mélangées à l'affichage)
     ===================================================================== */
  const Q = (t, q, a, b, c, x) => ({ t, q, a: [a, b, c], x });
  DG.GMPQ = [
    // ---- unités et bases ----
    Q('Unités', 'Unité SI de la contrainte ?', 'Le pascal (Pa)', 'Le newton (N)', 'Le joule (J)', 'Contrainte = force / surface : 1 N/m² = 1 Pa.'),
    Q('Unités', '1 MPa, ça vaut…', '1 N/mm²', '1 N/m²', '10 N/mm²', '1 MPa = 10⁶ Pa = 1 N/mm². Pratique en RDM !'),
    Q('Unités', '1 bar, c\'est…', '100 000 Pa', '1 000 Pa', '1 MPa', '1 bar = 10⁵ Pa = 0,1 MPa.'),
    Q('Unités', 'Unité d\'un moment de force ?', 'N·m', 'N/m', 'm/s', 'Moment = force × bras de levier → newton-mètre.'),
    Q('Unités', 'Puissance d\'un arbre en rotation ?', 'P = C × ω', 'P = C / ω', 'P = F × ω', 'C en N·m, ω en rad/s → P en watts.'),
    Q('Unités', '1500 tr/min, ça fait environ…', '157 rad/s', '25 rad/s', '1500 rad/s', 'ω = 2πN/60 = 2π × 1500 / 60 ≈ 157 rad/s.'),
    Q('Unités', '1 pouce (inch), c\'est…', '25,4 mm', '2,54 mm', '10 mm', 'Les Anglo-Saxons et leurs pouces : 25,4 mm pile.'),
    Q('Unités', 'Le préfixe « micro » (µ) vaut…', '10⁻⁶', '10⁻³', '10⁻⁹', 'Milli = 10⁻³, micro = 10⁻⁶, nano = 10⁻⁹.'),
    Q('Unités', 'Un couple de 10 N·m à 100 rad/s, ça donne…', '1 000 W', '10 W', '0,1 W', 'P = C·ω = 10 × 100 = 1000 W.'),
    // ---- RDM ----
    Q('RDM', 'La loi de Hooke, c\'est…', 'σ = E × ε', 'σ = E / ε', 'σ = F × S', 'Dans le domaine élastique, la contrainte est proportionnelle à l\'allongement relatif.'),
    Q('RDM', 'Module d\'Young de l\'acier ?', 'Environ 210 GPa', 'Environ 70 GPa', 'Environ 21 MPa', '70 GPa, c\'est l\'aluminium. L\'acier est 3 fois plus raide.'),
    Q('RDM', 'Module d\'Young de l\'aluminium ?', 'Environ 70 GPa', 'Environ 210 GPa', 'Environ 7 GPa', 'L\'alu est environ 3 fois moins raide que l\'acier.'),
    Q('RDM', 'L\'allongement relatif ε s\'exprime…', 'Sans unité', 'En mm', 'En MPa', 'ε = ΔL / L₀ : des mm divisés par des mm.'),
    Q('RDM', 'Re, c\'est…', 'La limite d\'élasticité', 'La résistance à la rupture', 'Le module d\'Young', 'Au-delà de Re, la déformation devient permanente.'),
    Q('RDM', 'Rm, c\'est…', 'La résistance à la rupture', 'La limite d\'élasticité', 'La dureté Rockwell', 'Rm = contrainte maximale atteinte à l\'essai de traction.'),
    Q('RDM', 'En flexion, la contrainte normale est maximale…', 'Sur les fibres extrêmes', 'Sur la fibre neutre', 'Partout pareil', 'Sur la fibre neutre, la contrainte normale est nulle.'),
    Q('RDM', 'En torsion d\'un arbre plein, le cisaillement est maximal…', 'En surface', 'Au centre', 'Il est nul', 'τ = C·r / I₀ : il croît avec le rayon.'),
    Q('RDM', 'Moment quadratique d\'un rectangle b × h (flexion « à plat sur b ») ?', 'b·h³ / 12', 'b³·h / 12', 'b·h / 12', 'La hauteur au cube : une poutre debout est bien plus raide.'),
    Q('RDM', 'Coefficient de Poisson de l\'acier ?', 'Environ 0,3', 'Environ 3', 'Environ 30', 'ν ≈ 0,3 pour la plupart des métaux.'),
    Q('RDM', 'Le coefficient de sécurité s = …', 'Re / σmax', 'σmax / Re', 'Re × σmax', 's > 1 : la pièce reste dans le domaine élastique.'),
    Q('RDM', 'Une poutre encastrée chargée à son bout : le moment fléchissant maxi est…', 'À l\'encastrement', 'Au bout libre', 'Au milieu', 'M = F × L à l\'encastrement, nul au bout libre.'),
    // ---- matériaux ----
    Q('Matériaux', 'Une fonte, c\'est du fer avec plus de…', '2 % de carbone', '0,2 % de carbone', '20 % de carbone', 'Au-delà d\'environ 2 % de carbone, l\'acier devient fonte.'),
    Q('Matériaux', 'La trempe d\'un acier sert à…', 'Le durcir', 'L\'adoucir', 'Le rendre inoxydable', 'Chauffe puis refroidissement brutal → martensite dure.'),
    Q('Matériaux', 'Le revenu après trempe sert à…', 'Réduire la fragilité', 'Augmenter la fragilité', 'Faire briller la pièce', 'Trempe = dur mais fragile ; le revenu redonne de la ténacité.'),
    Q('Matériaux', 'Le recuit sert surtout à…', 'Adoucir et détendre', 'Durcir la surface', 'Souder', 'Chauffe puis refroidissement lent : on supprime les contraintes internes.'),
    Q('Matériaux', 'C45, c\'est…', 'Un acier à 0,45 % de carbone', 'Un acier à 45 % de carbone', 'Un cuivre à 45 %', 'Acier non allié : le nombre = carbone × 100.'),
    Q('Matériaux', 'S235, c\'est…', 'Un acier de construction, Re ≥ 235 MPa', 'Un acier à 2,35 % de carbone', 'Un alu de série 235', 'S = Structural ; le nombre donne Re minimale en MPa.'),
    Q('Matériaux', 'Masse volumique de l\'acier ?', 'Environ 7 850 kg/m³', 'Environ 2 700 kg/m³', 'Environ 1 000 kg/m³', '2 700 kg/m³, c\'est l\'aluminium ; 1 000, l\'eau.'),
    Q('Matériaux', 'Masse volumique de l\'aluminium ?', 'Environ 2 700 kg/m³', 'Environ 7 850 kg/m³', 'Environ 19 300 kg/m³', '19 300, c\'est l\'or. L\'alu est presque 3 fois plus léger que l\'acier.'),
    Q('Matériaux', 'L\'essai Charpy mesure…', 'La résilience', 'La dureté', 'La limite élastique', 'Un mouton-pendule casse une éprouvette entaillée : énergie absorbée.'),
    Q('Matériaux', 'Brinell, Vickers, Rockwell mesurent…', 'La dureté', 'La résilience', 'La conductivité', 'On enfonce un pénétrateur et on mesure l\'empreinte.'),
    Q('Matériaux', 'Un matériau qui casse sans se déformer est…', 'Fragile', 'Ductile', 'Malléable', 'Le verre est fragile ; le cuivre est ductile.'),
    Q('Matériaux', 'L\'inox résiste à la corrosion grâce au…', 'Chrome (≥ 10,5 %)', 'Carbone', 'Plomb', 'Le chrome forme une fine couche d\'oxyde protectrice.'),
    Q('Matériaux', 'Le laiton, c\'est…', 'Cuivre + zinc', 'Cuivre + étain', 'Fer + zinc', 'Cuivre + étain, c\'est le bronze.'),
    Q('Matériaux', '42CrMo4, c\'est…', 'Un acier faiblement allié (chrome, molybdène)', 'Un acier à 42 % de chrome', 'Une fonte grise', '0,42 % de carbone, un peu de chrome et de molybdène.'),
    // ---- usinage ----
    Q('Usinage', 'Fréquence de rotation de la broche ?', 'N = 1000·Vc / (π·D)', 'N = π·D·Vc', 'N = Vc / D', 'Vc en m/min, D en mm → N en tr/min.'),
    Q('Usinage', 'Vc = 200 m/min, D = 50 mm : N ≈ …', '1 270 tr/min', '4 000 tr/min', '127 tr/min', '1000 × 200 / (π × 50) ≈ 1273 tr/min.'),
    Q('Usinage', 'En tournage…', 'La pièce tourne, l\'outil avance', 'L\'outil tourne, la pièce est fixe', 'Rien ne tourne', 'En fraisage, c\'est l\'inverse : l\'outil tourne.'),
    Q('Usinage', 'Vitesse d\'avance en fraisage ?', 'Vf = fz × Z × N', 'Vf = N / Z', 'Vf = Vc × D', 'Avance par dent × nombre de dents × fréquence de rotation.'),
    Q('Usinage', 'Un outil carbure, comparé à l\'ARS…', 'Accepte des Vc plus élevées', 'Doit tourner moins vite', 'Fond à 200 °C', 'Le carbure tient la chaleur : on peut couper bien plus vite.'),
    Q('Usinage', 'ARS veut dire…', 'Acier Rapide Supérieur', 'Alliage Résistant Spécial', 'Aluminium Recuit Standard', 'Le bon vieil acier rapide des forets.'),
    Q('Usinage', 'L\'arrosage en usinage sert surtout à…', 'Refroidir et évacuer les copeaux', 'Faire joli', 'Ralentir la broche', 'Il lubrifie aussi la coupe et protège l\'état de surface.'),
    Q('Usinage', 'Pour finir un trou précis (H7) après perçage, on fait…', 'Un alésage', 'Un chanfrein', 'Un moletage', 'L\'alésoir ou l\'outil d\'alésage donne la cote et l\'état de surface.'),
    Q('Usinage', 'Tarauder, c\'est…', 'Faire un filetage intérieur', 'Faire un filetage extérieur', 'Faire un trou lisse', 'Le filetage extérieur se fait à la filière ou au tour.'),
    Q('Usinage', 'Pas normal d\'une vis M10 ?', '1,5 mm', '1 mm', '2,5 mm', 'M10 × 1,5 en pas gros (le pas fin existe aussi).'),
    Q('Usinage', 'Avant de tarauder M10 × 1,5, on perce à…', '8,5 mm', '10 mm', '5 mm', 'Diamètre de perçage ≈ diamètre nominal − pas.'),
    Q('Usinage', 'En commande numérique, G00, c\'est…', 'Un déplacement rapide', 'Une interpolation linéaire en avance travail', 'L\'arrêt du programme', 'G01 = linéaire en avance travail ; G02/G03 = circulaire.'),
    Q('Usinage', 'M03, c\'est…', 'Rotation broche sens horaire', 'Arrêt broche', 'Changement d\'outil', 'M05 = arrêt broche, M06 = changement d\'outil.'),
    Q('Usinage', 'Le chariotage, en tournage, c\'est…', 'Usiner le diamètre le long de l\'axe', 'Usiner une face plane', 'Faire un filet', 'La face plane perpendiculaire à l\'axe, c\'est le dressage (surfaçage).'),
    Q('Usinage', 'Des copeaux bleus en tournage d\'acier, ça veut dire…', 'Ça chauffe fort', 'L\'outil est neuf', 'La pièce est en cuivre', 'La couleur vient de l\'oxydation à chaud.'),
    // ---- métrologie ----
    Q('Métrologie', 'Résolution d\'un pied à coulisse au 1/50 ?', '0,02 mm', '0,1 mm', '0,5 mm', '1/50 de mm = 0,02 mm.'),
    Q('Métrologie', 'Résolution d\'un micromètre classique ?', '0,01 mm', '0,1 mm', '1 mm', 'Tambour de 50 graduations, pas de vis de 0,5 mm → 0,01 mm.'),
    Q('Métrologie', 'Vernier au 1/10 : 10 divisions du vernier mesurent…', '9 mm', '10 mm', '1 mm', 'Chaque division vaut 0,9 mm : d\'où la lecture au dixième.'),
    Q('Métrologie', 'Température de référence en métrologie dimensionnelle ?', '20 °C', '0 °C', '37 °C', 'Les cotes sont définies à 20 °C (ISO 1). Pas à la température du café.'),
    Q('Métrologie', 'Un tampon « entre / n\'entre pas » contrôle…', 'Un alésage', 'Un arbre', 'Une planéité', 'Pour un arbre, on prend une bague (ou une fourche).'),
    Q('Métrologie', 'Un comparateur mesure…', 'Des écarts de position', 'Des masses', 'Des températures', 'Il amplifie un petit déplacement du palpeur.'),
    Q('Métrologie', 'La rugosité Ra s\'exprime en…', 'Micromètres (µm)', 'Millimètres', 'Pascals', 'Ra 0,8 µm : une belle surface rectifiée.'),
    // ---- cotation, tolérances ----
    Q('Cotation', 'Dans Ø20 H7, la majuscule H désigne…', 'Un alésage', 'Un arbre', 'Une vis', 'Majuscule = alésage, minuscule = arbre.'),
    Q('Cotation', 'Pour un alésage H, l\'écart inférieur vaut…', '0', 'Toujours négatif', '+1 mm', 'H : le diamètre mini est la cote nominale.'),
    Q('Cotation', 'L\'ajustement H7/g6, c\'est…', 'Avec jeu (glissant)', 'Serré', 'Impossible', 'g : arbre un peu plus petit que l\'alésage.'),
    Q('Cotation', 'L\'ajustement H7/p6, c\'est…', 'Serré', 'Avec jeu', 'Glissant juste', 'p : l\'arbre est plus gros que l\'alésage → montage à la presse.'),
    Q('Cotation', 'Un IT plus petit, c\'est une cote…', 'Plus précise', 'Moins précise', 'Plus longue', 'IT6 est plus serré (et plus cher) que IT11.'),
    Q('Cotation', 'Ø50 ± 0,1 : l\'intervalle de tolérance vaut…', '0,2 mm', '0,1 mm', '50 mm', 'De 49,9 à 50,1 mm : 0,2 mm.'),
    Q('Cotation', '30 (+0,05 / −0,02) : la cote maxi est…', '30,05 mm', '30,02 mm', '29,98 mm', 'Cote maxi = nominale + écart supérieur.'),
    Q('Cotation', 'La perpendicularité est une tolérance…', 'D\'orientation', 'De forme', 'De battement', 'Forme : planéité, circularité… Orientation : parallélisme, perpendicularité, inclinaison.'),
    Q('Cotation', 'La circularité est une tolérance…', 'De forme', 'De position', 'D\'orientation', 'Elle ne dépend d\'aucune référence.'),
    // ---- dessin technique ----
    Q('Dessin', 'Le trait mixte fin (trait d\'axe) représente…', 'Un axe ou un plan de symétrie', 'Une arête cachée', 'Une arête vue', 'Les arêtes cachées sont en trait interrompu fin.'),
    Q('Dessin', 'Une arête cachée se dessine en…', 'Trait interrompu fin', 'Trait continu fort', 'Trait mixte', 'Le trait continu fort, c\'est pour les arêtes vues.'),
    Q('Dessin', 'En projection européenne, la vue de gauche se place…', 'À droite de la vue de face', 'À gauche de la vue de face', 'Au-dessus', 'Oui, c\'est contre-intuitif. Merci l\'Europe.'),
    Q('Dessin', 'Les hachures indiquent…', 'La matière coupée', 'Un trou', 'Une pièce en plastique uniquement', 'Pas de hachures dans les vides ni sur les vis coupées en long.'),
    Q('Dessin', 'Échelle 1:2, le dessin est…', '2 fois plus petit que la pièce', '2 fois plus grand', 'Identique', '1:2 = réduction ; 2:1 = agrandissement.'),
    // ---- automatisme ----
    Q('Automatisme', 'GRAFCET : l\'étape initiale se dessine avec…', 'Un double carré', 'Un rond', 'Un triangle', 'Elle est active au démarrage du système.'),
    Q('Automatisme', 'Une transition est franchie quand…', 'L\'étape d\'avant est active et la réceptivité vraie', 'La réceptivité seule est vraie', 'On appuie sur F5', 'Les deux conditions en même temps.'),
    Q('Automatisme', 'La fonction ET donne 1 quand…', 'Toutes les entrées valent 1', 'Au moins une entrée vaut 1', 'Aucune entrée ne vaut 1', 'Le OU, lui, se contente d\'une seule entrée à 1.'),
    Q('Automatisme', 'Un capteur inductif détecte…', 'Les métaux', 'Le bois', 'La lumière', 'Il détecte les objets métalliques sans contact.'),
    Q('Automatisme', 'Un vérin double effet se pilote avec…', 'Un distributeur 5/2', 'Un fusible', 'Un thermomètre', '5 orifices, 2 positions : sortie et rentrée de tige.'),
    Q('Automatisme', 'API, en atelier, c\'est…', 'Un Automate Programmable Industriel', 'Un Appareil de Pression Isolé', 'Une Assiette Pour l\'Intervalle', 'L\'automate qui pilote la machine.'),
    // ---- mécanique, transmission ----
    Q('Mécanique', 'Rapport d\'un engrenage simple : N2 / N1 = …', 'Z1 / Z2', 'Z2 / Z1', 'Z1 × Z2', 'La petite roue tourne plus vite que la grande.'),
    Q('Mécanique', 'Deux roues dentées extérieures qui engrènent tournent…', 'En sens inverse', 'Dans le même sens', 'Une seule tourne', 'Pour garder le sens, on ajoute une roue intermédiaire.'),
    Q('Mécanique', 'Une roue intermédiaire (« folle ») change…', 'Le sens, pas le rapport', 'Le rapport', 'Rien du tout', 'Ses dents s\'annulent dans le calcul du rapport.'),
    Q('Mécanique', 'Diamètre primitif d\'une roue dentée ?', 'd = m × Z', 'd = Z / m', 'd = m + Z', 'm = module (mm), Z = nombre de dents.'),
    Q('Mécanique', 'Pour engrener ensemble, deux roues doivent avoir…', 'Le même module', 'Le même nombre de dents', 'La même couleur', 'Même module (et même angle de pression).'),
    Q('Mécanique', 'Une liaison pivot autorise…', '1 rotation', '1 translation', 'Aucun mouvement', 'Pivot glissant : 1 rotation + 1 translation de même axe.'),
    Q('Mécanique', 'Une liaison glissière autorise…', '1 translation', '1 rotation', '3 rotations', 'Comme un tiroir.'),
    Q('Mécanique', 'Une liaison rotule autorise…', '3 rotations', '3 translations', '1 rotation', 'Comme ton épaule (en mieux lubrifié).'),
    Q('Mécanique', 'Une liaison encastrement autorise…', 'Aucun mouvement', '1 rotation', '6 mouvements', 'Les deux pièces sont fixes l\'une par rapport à l\'autre.'),
    // ---- procédés, qualité, CAO ----
    Q('Procédés', 'Le soudage TIG utilise une électrode…', 'En tungstène, non fusible', 'En cuivre, fusible', 'En bois, recyclable', 'Le métal d\'apport est amené à part (baguette).'),
    Q('Procédés', 'La fabrication additive, c\'est…', 'L\'impression 3D', 'L\'usinage par enlèvement', 'La peinture', 'On ajoute la matière couche par couche.'),
    Q('Qualité', 'Le diagramme de Pareto sert à…', 'Hiérarchiser les causes (80/20)', 'Dessiner une pièce', 'Calculer une vitesse de coupe', '20 % des causes font souvent 80 % des défauts.'),
    Q('Qualité', 'Le Cpk mesure…', 'La capabilité d\'un procédé', 'La puissance d\'une machine', 'Le coût d\'une pièce', 'Cpk ≥ 1,33 : le procédé est jugé capable.'),
    Q('Qualité', 'La méthode 5S vient…', 'Du Japon', 'D\'Allemagne', 'Du Brésil', 'Seiri, Seiton, Seiso, Seiketsu, Shitsuke.'),
    Q('Qualité', 'AMDEC, c\'est…', 'Analyse des modes de défaillance', 'Atelier de maintenance', 'Un type de vis', 'On cherche ce qui peut casser, avant que ça casse.'),
    Q('CAO', 'Une esquisse bien faite est…', 'Totalement contrainte', 'Coloriée', 'Faite à main levée', 'Cotes et contraintes géométriques : plus rien ne bouge tout seul.'),
    Q('CAO', 'Une extrusion transforme…', 'Une esquisse 2D en volume', 'Un volume en esquisse', 'Une pièce en mise en plan', 'Une révolution, elle, fait tourner l\'esquisse autour d\'un axe.'),
  ];
  // réponses farfelues (pour les questions des Portes qui n'ont que 2 choix)
  const SILLY = ['42, évidemment', 'Demander au voisin', 'Ça dépend de la météo', 'La réponse D', 'Un bon coup de marteau', 'Aucune idée, je suis là pour l\'ambiance', 'Le prof l\'a dit en amphi, je dormais'];
  DG.allQuestions = function () {
    const out = DG.GMPQ.slice();
    const P = BR.Doors && BR.Doors.QUESTIONS;
    if (Array.isArray(P)) P.forEach((q, i) => { if (Array.isArray(q) && q.length >= 3) out.push({ t: 'GMP', q: q[0], a: [q[1], q[2], SILLY[i % SILLY.length]], x: '' }); });
    return out;
  };
  // n questions tirées (même graine = mêmes questions pour tout le monde), réponses mélangées
  DG.drawQuestions = function (rng, n) {
    const all = DG.allQuestions(), picked = [], used = new Set();
    // d'abord des questions « maison » (avec explication), puis le reste
    const pool = BR.shuffle(all.map((q, i) => i), rng).sort((a, b) => (all[b].x ? 1 : 0) - (all[a].x ? 1 : 0) + (rng() - 0.5) * 0.9);
    for (const i of pool) { if (picked.length >= n) break; if (used.has(all[i].q)) continue; used.add(all[i].q); picked.push(all[i]); }
    return picked.map(q => { const order = BR.shuffle([0, 1, 2], rng); return { t: q.t, q: q.q, x: q.x, opts: order.map(k => q.a[k]), good: order.indexOf(0) }; });
  };

  /* ---------- répliques ---------- */
  const PROF = {
    intro: ['Bienvenue à mon Grand Oral ! Cinq questions. Placez-vous sur la plaque de votre réponse avant la fin du sablier.', 'Ah, des étudiants ! Voyons si vous avez écouté en cours… ou si vous dormiez au fond.'],
    good: ['Bravo ! Je ne l\'aurais pas mieux dit. Enfin si, mais bravo.', 'Exact ! Un futur major de promo.', 'Juste ! Tu peux remettre ta casquette de génie.', 'Parfait. Tu mérites une vis dorée.', 'Bien ! Même mon tour à commande numérique est jaloux.'],
    bad: ['FAUX ! Petite décharge pédagogique…', 'Non non non. On révise ce soir, compris ?', 'Raté ! Mon boulon gauche en tremble encore.', 'Erreur ! Je note ça dans ton dossier. À l\'encre indélébile.', 'Aïe. Même un tournevis aurait trouvé.'],
    none: ['Tic-tac ! Le silence n\'est pas une réponse.', 'Pas de réponse ? On ne passe pas l\'oral en faisant la statue.'],
    end: [['Zéro… Je vais devoir appeler tes parents.', 'Une seule bonne réponse. C\'est un début. Très modeste.'], ['Pas mal ! Peut mieux faire, mais pas mal.', 'Honorable ! Tu repars avec quelque chose.'], ['Excellent ! Tu as tout compris, ou presque.', 'Sans faute ! Je te décerne le diplôme du Boulon d\'Or !']],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- bulle d'interface : question, réponses, sablier ---------- */
  function quizHud(S) {
    const el = BR.el('div', { class: 'dg-quiz' }); S.hud.appendChild(el);
    return {
      el,
      show(q, sel, tLeft, tMax, extra) {
        el.innerHTML = `<div class="dq-t">${BR.esc(q.t)}${extra ? ' · ' + BR.esc(extra) : ''}</div><div class="dq-q">${BR.esc(q.q)}</div><div class="dq-o">${q.opts.map((o, i) => `<div class="${sel === i ? 'on' : ''}" style="--c:${['#ff6a5a', '#5ad1ff', '#7dff9a'][i]}"><b>${'ABC'[i]}</b>${BR.esc(o)}</div>`).join('')}</div>${tMax ? `<div class="dq-bar"><i style="width:${Math.max(0, tLeft / tMax * 100)}%"></i></div>` : ''}`;
        el.classList.add('on');
      },
      say(who, t, cls) { el.innerHTML = `<div class="dq-say ${cls || ''}"><b>${BR.esc(who)}</b>${BR.esc(t)}</div>`; el.classList.add('on'); },
      hide() { el.classList.remove('on'); },
      dispose() { el.remove(); },
    };
  }

  /* =====================================================================
     LE PONT DES SAVOIRS
     ===================================================================== */
  DG.QUIZ.pont = {
    n: 'Le Pont des Savoirs', d: 'Marche sur la dalle de la bonne réponse… les autres s\'effondrent', shared: false, skippable: true,
    win: 'PONT TRAVERSÉ', winSub: 'Ton savoir te porte',
    hint: 'Salle du Savoir : avance sur le pont et marche sur la dalle de la bonne réponse (A, B ou C). Les mauvaises s\'effondrent !',
    layout(B, room, rng) {
      const W = 26, NQ = 5, rowL = 4, land = 4.2, entry = 9, exitL = 11;
      const Lz = entry + NQ * (rowL + land) + exitL, hz = Lz / 2, hx = W / 2;
      const Lr = DG.rectRoom(B, W, Lz, { floor: false });
      B.floorRect(-hx, -hz, hx, -hz + entry);
      let z = -hz + entry; const rows = [];
      for (let k = 0; k < NQ; k++) {
        // trois dalles côte à côte (A, B, C), puis un palier sûr
        const zc = z + rowL / 2, tiles = [];
        for (let i = 0; i < 3; i++) {
          const x = (1 - i) * 4.2, m = new THREE.Mesh(BOX, B.mats.trim); m.scale.set(4.1, 0.6, rowL - 0.06); m.position.set(x, -0.3, zc); m.receiveShadow = true; m.castShadow = true; B.g.add(m);
          tiles.push({ x, z: zc, m, s: B.solid(x, zc, 2.1, rowL / 2, 0, -0.6, 0, { crumble: true }), fall: 0 });
        }
        z += rowL;
        B.box('trim', 0, -0.3, z + land / 2, 12.6, 0.6, land, 0, true);
        // rambardes du palier
        for (const sx of [-1, 1]) B.box('wood', sx * 6.4, 0.55, z + land / 2, 0.18, 1.1, land - 0.4);
        rows.push({ k, z0: zc - rowL / 2, z1: zc + rowL / 2, tiles, landZ: z + land / 2 });
        z += land;
      }
      B.floorRect(-hx, z, hx, hz);
      B.box('dark', 0, -40, 0, W, 2, Lz - entry - exitL);
      Lr.rewardAt = new V3(0, 0, hz - 6.5); Lr.rewardW = 12;
      Lr.data = { rows, qs: DG.drawQuestions(rng, NQ), goalZ: z + 0.5 };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S;
      P.hud = quizHud(S); P.score = 0; P.answered = []; P.cur = -1;
      P.sign = DG.sign(S.scene, new V3(-7.5, 3.3, -S.env.layout.hz + 0.8), 0, [{ t: 'LE PONT DES SAVOIRS', s: 64, c: '#7dff9a' }, { t: 'Une question par rangée.', s: 44 }, { t: 'La bonne dalle tient. Les autres…', s: 38, c: '#cfc2a0' }], 5, 2.2);
      // panneaux de réponse au-dessus de chaque dalle
      P.boards = [];
      D.rows.forEach((r, k) => {
        const q = D.qs[k];
        r.tiles.forEach((T, i) => { const b = DG.sign(S.scene, new V3(T.x, 3.1, T.z + 1.9), Math.PI, [{ t: 'ABC'[i], s: 120, c: ['#ff6a5a', '#5ad1ff', '#7dff9a'][i] }, { t: q.opts[i], s: 54 }], 3.9, 1.7); P.boards.push(b); });
        const qb = DG.sign(S.scene, new V3(0, 6.2, r.z1 + 0.2), Math.PI, [{ t: 'QUESTION ' + (k + 1), s: 52, c: '#ffd76a' }, { t: q.q, s: 46 }], 12, 2.6); P.boards.push(qb);
      });
    },
    update(P, dt, t) {
      const D = P.data, S = P.S, me = S.me;
      // question de la rangée devant moi
      let row = -1; D.rows.forEach((r, k) => { if (me.pos.z > r.z0 - 6 && me.pos.z < r.z1 + 0.5 && !P.answered[k]) row = k; });
      if (row !== P.cur) { P.cur = row; if (row >= 0) P.hud.show(D.qs[row], -1, 0, 0, 'Question ' + (row + 1) + ' / ' + D.rows.length); else if (!P.solved) P.hud.hide(); }
      D.rows.forEach((r, k) => r.tiles.forEach((T, i) => {
        const good = D.qs[k].good === i;
        const on = me.gs === T.s && me.pos.y - (me.gy || 0) < 0.1;
        if (on && !P.answered[k]) {
          P.answered[k] = good ? 'ok' : 'ko';
          if (good) { P.score++; BR.Audio.fx('reveal', { rate: 1.3 }); S.fx.burst(new V3(T.x, 0.5, T.z), { n: 40, color: 0x7dff9a, speed: 6, life: 0.8 }); P.hud.say('Bonne réponse !', D.qs[k].x || 'Bien joué.', 'good'); }
          else { BR.Audio.ui('error'); P.hud.say('Faux ! C\'était « ' + D.qs[k].opts[D.qs[k].good] + ' »', D.qs[k].x || '', 'bad'); }
          setTimeout(() => { if (P.cur === -1 && !P.solved) P.hud.hide(); }, 4200);
        }
        if (good) return;
        if (T.fall > 0) { T.fall += dt; T.m.position.y = -0.3 - T.fall * T.fall * 20; if (T.fall > 2.5) { T.fall = 0; T.s.off = false; T.m.position.y = -0.3; T.m.visible = true; } else if (T.fall > 1) T.m.visible = false; }
        else if (on) { T.fall = 0.001; T.s.off = true; BR.Audio.fx('land', { g: 0.6, rate: 0.6 }); S.fx.burst(new V3(T.x, 0, T.z), { n: 20, color: 0x8a8070, speed: 4, life: 0.6 }); }
      }));
      if (!P.solved && me.alive && me.pos.z > D.goalZ && me.pos.y > -1 && isFinite(me.gy == null ? 0 : me.gy)) {
        const n = D.rows.length, sc = P.score / n;
        P.hud.say('Pont traversé', P.score + ' bonne' + (P.score > 1 ? 's' : '') + ' réponse' + (P.score > 1 ? 's' : '') + ' sur ' + n + (P.score === n ? ' — parfait !' : ''), P.score >= 3 ? 'good' : '');
        P.solve(sc);
      }
    },
    dispose(P) { if (P.hud) P.hud.dispose(); (P.boards || []).forEach(b => b.dispose()); if (P.sign) P.sign.dispose(); },
  };

  /* =====================================================================
     LE GRAND ORAL DU PROFESSEUR BOULON
     ===================================================================== */
  function professor(scene, pos) {
    const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
    const brass = new THREE.MeshStandardMaterial({ color: L('#c9a24a'), metalness: 0.9, roughness: 0.3 }), steel = new THREE.MeshStandardMaterial({ color: L('#8a8e96'), metalness: 0.85, roughness: 0.35 }), dark = new THREE.MeshStandardMaterial({ color: L('#2a2a30'), metalness: 0.6, roughness: 0.5 });
    const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: L('#7dff9a'), emissiveIntensity: 2.2 });
    const head = new THREE.Mesh(BOX, brass); head.scale.set(4.2, 3.4, 2.6); head.position.y = 1.9; head.castShadow = true; g.add(head);
    const brow = new THREE.Mesh(BOX, dark); brow.scale.set(4.4, 0.35, 2.7); brow.position.y = 3.2; g.add(brow);
    const eyes = [-0.95, 0.95].map(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), eyeM); e.position.set(x, 2.35, 1.3); g.add(e); return e; });
    const mono = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 24), brass); mono.position.set(0.95, 2.35, 1.36); g.add(mono);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 4), brass); chain.position.set(1.45, 1.7, 1.36); chain.rotation.z = 0.35; g.add(chain);
    // moustache en boulons
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 6), steel); b.rotation.x = Math.PI / 2; b.position.set((i - 2.5) * 0.36, 1.45 - Math.abs(i - 2.5) * 0.07, 1.36); g.add(b); }
    const jaw = new THREE.Group(); jaw.position.set(0, 0.6, 0.2); g.add(jaw);
    const jm = new THREE.Mesh(BOX, brass); jm.scale.set(3.4, 0.7, 2.2); jm.position.set(0, -0.3, 0.1); jaw.add(jm);
    const mouth = new THREE.Mesh(BOX, dark); mouth.scale.set(2.6, 0.25, 0.1); mouth.position.set(0, 0.95, 1.31); g.add(mouth);
    // chapeau haut-de-forme et engrenages qui tournent sur les tempes
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.9, 20), dark); hat.position.y = 4.45; g.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.15, 24), dark); brim.position.y = 3.5; g.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.3, 20), brass); band.position.y = 3.75; g.add(band);
    const gears = [-2.35, 2.35].map(x => { const gg = DG.gearMesh(10, 0.11, steel); gg.rotation.y = Math.PI / 2; gg.position.set(x, 2.1, 0); g.add(gg); return gg; });
    let talk = 0, mood = 0;
    return { g, eyeM,
      talk(sec, m) { talk = sec; mood = m || 0; },
      tick(dt, t) {
        talk = Math.max(0, talk - dt);
        jaw.rotation.x = talk > 0 ? Math.abs(Math.sin(t * 14)) * 0.35 : 0;
        gears.forEach((gg, i) => { gg.rotation.x += dt * (i ? -1 : 1) * (1 + talk * 3); });
        eyeM.emissive.copy(L(mood > 0 ? '#7dff9a' : mood < 0 ? '#ff4a3a' : '#ffd76a')); eyeM.emissiveIntensity = 1.6 + Math.sin(t * 6) * 0.4 + (talk > 0 ? 0.8 : 0);
        g.rotation.z = Math.sin(t * 0.8) * 0.03 + (mood < 0 && talk > 0 ? Math.sin(t * 30) * 0.03 : 0);
        eyes.forEach(e => { e.scale.y = (Math.sin(t * 0.7) > 0.985) ? 0.15 : 1; });
      },
      dispose() { scene.remove(g); g.traverse(o => { if (o.geometry && o.geometry !== BOX) o.geometry.dispose(); }); [brass, steel, dark, eyeM].forEach(m => m.dispose()); } };
  }
  // roue dentée (Z dents, module m en mètres)
  DG.gearMesh = function (Z, m, mat) {
    const r = m * Z / 2, g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r - m * 0.6, r - m * 0.6, 0.35, Math.max(12, Z)), mat); disc.rotation.x = Math.PI / 2; disc.castShadow = true; g.add(disc);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.12, r * 0.22), Math.max(0.12, r * 0.22), 0.5, 10), mat); hub.rotation.x = Math.PI / 2; g.add(hub);
    for (let i = 0; i < Z; i++) { const a = i / Z * Math.PI * 2, t = new THREE.Mesh(BOX, mat); t.scale.set(m * 1.05, m * 1.6, 0.33); t.position.set(Math.cos(a) * (r - m * 0.15), Math.sin(a) * (r - m * 0.15), 0); t.rotation.z = a - Math.PI / 2; t.castShadow = true; g.add(t); }
    g.userData.r = r;
    return g;
  };

  DG.QUIZ.oral = {
    n: 'Le Grand Oral du Professeur Boulon', d: 'Cinq questions de GMP : place-toi sur la plaque de ta réponse', shared: false,
    win: 'ORAL TERMINÉ', winSub: 'Le Professeur Boulon range ses notes',
    hint: 'Salle du Savoir : le Professeur Boulon pose 5 questions. Mets-toi sur la plaque A, B ou C avant la fin du sablier !',
    layout(B, room, rng) {
      const Lr = DG.rectRoom(B, 30, 36), hz = Lr.hz;
      // estrade du professeur, contre le mur nord (entre les portes : il est au-dessus de la porte du milieu)
      B.box('trim', 0, 0.25, hz - 5.5, 16, 0.5, 3, 0, false);
      // les trois plaques de réponse
      const plates = [7, 0, -7].map(x => new V3(x, 0, 3));   // A à gauche quand on regarde vers le nord
      plates.forEach((p, i) => { B.box('metal', p.x, 0.05, p.z, 4.6, 0.1, 4.6); });
      // gradins (pour l'ambiance) côté sud
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) B.box('wood', sx * 10, 0.3 + i * 0.6, -10 - i * 1.6, 6, 0.6 + i * 1.2, 1.6, 0, true);
      Lr.rewardAt = new V3(0, 0, -4.5); Lr.rewardW = 12;
      Lr.data = { plates, qs: DG.drawQuestions(rng, 5) };
      return Lr;
    },
    start(P) {
      const D = P.data, S = P.S;
      const mt = (BR.Asc && BR.Asc.me && BR.Asc.me() && BR.Asc.me().meta) || {};
      P.hud = quizHud(S); P.score = 0; P.k = -1; P.phase = 'intro'; P.pt = 5.5; P.QT = 15 + (mt.savoir || 0);
      P.prof = professor(S.scene, new V3(0, 7.2, S.env.layout.hz - 1.6));
      S.env.addSpot(0, 8, S.env.layout.hz - 6, L('#ffe2b0'), 3.2, { dist: 16 });
      P.prof.g.rotation.y = Math.PI;   // il regarde vers la salle (vers le sud)
      P.prof.talk(4, 0); P.hud.say('Professeur Boulon', pick(PROF.intro));
      const cols = ['#ff6a5a', '#5ad1ff', '#7dff9a'];
      P.pads = D.plates.map((p, i) => {
        const tex = DG.textTex([{ t: 'ABC'[i], s: 300, c: cols[i] }], { w: 512, h: 512, bg: '#14120f', border: cols[i] });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshStandardMaterial({ map: tex, emissive: L(cols[i]), emissiveIntensity: 0.15, emissiveMap: tex }));
        m.rotation.set(-Math.PI / 2, 0, Math.PI); m.position.set(p.x, 0.12, p.z); S.scene.add(m); return { m, tex };
      });
      P.board = null;
      P.sign = DG.sign(S.scene, new V3(-7.5, 3.3, -S.env.layout.hz + 0.8), 0, [{ t: 'LE GRAND ORAL', s: 64, c: '#7dff9a' }, { t: 'du Professeur Boulon', s: 46 }, { t: 'Plaque A, B ou C. Pas de triche.', s: 36, c: '#cfc2a0' }], 5, 2.2);
    },
    update(P, dt, t) {
      const D = P.data, S = P.S, me = S.me;
      if (P.prof) P.prof.tick(dt, t);
      if (P.pads) P.pads.forEach((pd, i) => { pd.m.material.emissiveIntensity = 0.15 + (P.sel === i ? 0.9 + Math.sin(t * 8) * 0.2 : 0); });
      if (P.solved) return;
      // ma plaque
      let sel = -1; D.plates.forEach((p, i) => { if (Math.abs(me.pos.x - p.x) < 2.3 && Math.abs(me.pos.z - p.z) < 2.3) sel = i; });
      P.sel = sel;
      P.pt -= dt;
      if (P.phase === 'intro' && P.pt <= 0) next(P);
      else if (P.phase === 'q') {
        P.hud.show(D.qs[P.k], sel, P.pt, P.QT, 'Question ' + (P.k + 1) + ' / ' + D.qs.length);
        if (P.pt <= 0) judge(P, sel);
      } else if (P.phase === 'res' && P.pt <= 0) { if (P.k + 1 >= D.qs.length) finish(P); else next(P); }
    },
    dispose(P) { if (P.hud) P.hud.dispose(); if (P.prof) P.prof.dispose();  (P.pads || []).forEach(pd => { P.S.scene.remove(pd.m); pd.m.geometry.dispose(); pd.m.material.dispose(); pd.tex.dispose(); }); if (P.board) P.board.dispose(); if (P.sign) P.sign.dispose(); },
  };
  function next(P) {
    const D = P.data, S = P.S; P.k++; P.phase = 'q'; P.pt = P.QT;
    if (P.board) P.board.dispose();
    const q = D.qs[P.k];
    P.board = DG.sign(S.scene, new V3(0, 3.4, S.env.layout.hz - 3.6), Math.PI, [{ t: 'QUESTION ' + (P.k + 1), s: 50, c: '#ffd76a' }, { t: q.q, s: 50 }, { t: q.opts.map((o, i) => 'ABC'[i] + ' : ' + o).join('   ·   '), s: 34, c: '#cfe8ff' }], 13, 3.2);
    P.prof.talk(1.8, 0); BR.Audio.fx('reveal', { rate: 0.7, g: 0.5 });
  }
  function judge(P, sel) {
    const D = P.data, S = P.S, me = S.me, q = D.qs[P.k];
    P.phase = 'res'; P.pt = 4.2;
    const top = P.prof.g.position.clone().add(new V3(0, 2.3, 1.4));
    if (sel === q.good) {
      P.score++; P.prof.talk(2.4, 1); BR.Audio.fx('levelup', { g: 0.5 });
      S.fx.burst(me.center(), { n: 70, color: 0x7dff9a, speed: 10, up: 4, life: 1.1 });
      for (let i = 0; i < 30; i++) S.fx.spark(me.center().add(new V3(0, 2, 0)), new V3((Math.random() - 0.5) * 10, 4 + Math.random() * 6, (Math.random() - 0.5) * 10), { color: [0xff6a5a, 0x5ad1ff, 0x7dff9a, 0xffd76a][i % 4], life: 1.4, size: 0.25 });
      P.hud.say('Professeur Boulon', pick(PROF.good) + (q.x ? '  — ' + q.x : ''), 'good');
    } else {
      P.prof.talk(2.6, -1);
      if (S.fx.bolt) S.fx.bolt(top, me.center(), { color: 0x9adfff, life: 0.35, width: 0.5 });
      BR.Audio.fx('timestop', { g: 0.3 });
      if (me.alive && me.inv <= 0) { const dmg = Math.max(1, Math.round(me.maxHp * 0.04)); me.hp = Math.max(1, me.hp - dmg); S.fx.num(me.center(), '-' + dmg, { color: '#9adfff' }); me.vel.y = 7; }
      const right = '« ' + q.opts[q.good] + ' »';
      P.hud.say('Professeur Boulon', (sel < 0 ? pick(PROF.none) : pick(PROF.bad)) + ' La bonne réponse : ' + right + (q.x ? '. ' + q.x : ''), 'bad');
    }
  }
  function finish(P) {
    const n = P.data.qs.length, sc = P.score / n, tier = P.score === n ? 2 : P.score >= 3 ? 1 : 0;
    P.prof.talk(3, tier >= 1 ? 1 : -1);
    P.hud.say('Professeur Boulon', P.score + ' / ' + n + ' — ' + pick(PROF.end[tier]), tier >= 1 ? 'good' : '');
    if (P.board) { P.board.dispose(); P.board = null; }
    P.solve(sc);
  }
})();

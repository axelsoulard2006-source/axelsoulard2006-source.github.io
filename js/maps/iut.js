/* ===== maps/iut.js : IUT DE NANTES — CAMPUS DE LA FLEURIAYE (Carquefou)
   Bâtiment d'enseignement en R+1 (milieu des années 90, agrandi en 2005) et hall technologique de plus de 2000 m²
   du département Génie Mécanique et Productique : tours et fraiseuses conventionnels, centres d'usinage et tours à
   commande numérique, perceuses à colonne, scie à ruban, rectifieuse, établis, cellule robotisée, imprimantes 3D,
   salle de métrologie (machine à mesurer tridimensionnelle), magasin d'outillage, mezzanine du bureau d'études,
   pont roulant. Amphithéâtre en gradins, hall d'entrée sur double hauteur, couloirs, salles de TD / CAO / TP.
   Dehors : parkings, parvis, pelouses et arbres, cour de service, loge du portail (sortie).
   Dépend de BR.CarteKit (maps/halle6.js, chargé avant).                                                       ===== */
(function () {
  const BR = window.BR, K = BR.CarteKit, Tx = BR.Tex, P = Tx.P, mk = K.mk;
  const C = 2, SH = 4, SLAB = 0.3, VOID = 0, FLOOR = 1, WALL = 2;
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* =====================================================================
     TEXTURES
     ===================================================================== */
  const cache = {};
  // fenêtre en bande de la façade (dehors comme dedans, alignée au même endroit)
  function ribbon(g, e, x0, x1, y0, y1, lit) {
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#16202e'); gr.addColorStop(1, '#263346'); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (e && lit) { e.fillStyle = 'rgba(60,70,85,1)'; e.fillRect(x0, y0, x1 - x0, y1 - y0); }
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); g.fillStyle = 'rgba(255,255,255,0.07)';
    const rx = x0 + (x1 - x0) * Math.random(); g.beginPath(); g.moveTo(rx, y0); g.lineTo(rx + 60, y0); g.lineTo(rx - 50, y1); g.lineTo(rx - 110, y1); g.fill(); g.restore();
    g.fillStyle = '#4a5560'; for (let x = x0; x <= x1; x += 128) g.fillRect(x - 4, y0, 8, y1 - y0); g.fillRect(x0, y0, x1 - x0, 6); g.fillRect(x0, y1 - 6, x1 - x0, 6);
  }
  function facadePair() {     // façade du bâtiment A : bardage clair, bandeau bleu-gris, fenêtres en bande
    if (cache.fa) return cache.fa;
    const col = mk(512, 512, () => {}), em = mk(512, 512, () => {}), g = col.getContext('2d'), e = em.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, 512, 512);
    g.fillStyle = '#d9d8d2'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, y, 512, 2); }
    g.fillStyle = '#56697c'; g.fillRect(0, 0, 512, 70); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 66, 512, 4);
    ribbon(g, e, 0, 512, 150, 360, Math.random() < 0.35);
    g.fillStyle = '#c9c7c0'; g.fillRect(0, 360, 512, 14); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 374, 512, 5);
    K.grain(g, 512, 512, 4);
    g.fillStyle = '#7c7b76'; g.fillRect(0, 492, 512, 20);
    return (cache.fa = { col, em });
  }
  function facadeInPair() {   // le même mur vu de l'intérieur : peinture, mêmes fenêtres
    if (cache.fi) return cache.fi;
    const col = mk(512, 512, () => {}), g = col.getContext('2d');
    g.fillStyle = '#e8e5dc'; g.fillRect(0, 0, 512, 512); K.grain(g, 512, 512, 3);
    ribbon(g, null, 0, 512, 150, 360, false);
    g.fillStyle = '#efece6'; g.fillRect(0, 360, 512, 18); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 378, 512, 4);
    g.fillStyle = '#6d6a64'; g.fillRect(0, 496, 512, 16);
    return (cache.fi = { col });
  }
  function bardagePair(inside) {   // hall technologique : bardage acier nervuré + bande de polycarbonate translucide en haut
    const k = inside ? 'bi' : 'ba'; if (cache[k]) return cache[k];
    const col = mk(512, 512, () => {}), em = mk(512, 512, () => {}), g = col.getContext('2d'), e = em.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, 512, 512);
    g.fillStyle = inside ? '#c3c6c4' : '#8b98a1'; g.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 32) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, 0, 8, 512); g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x + 8, 0, 3, 512); }
    K.grain(g, 512, 512, 4);
    // bande translucide (seulement sur l'étage du haut : la texture se répète par étage, on la garde fine)
    g.fillStyle = inside ? '#e2ebe9' : '#b9c8c4'; g.fillRect(0, 20, 512, 60); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < 512; x += 16) g.fillRect(x, 20, 2, 60);
    if (inside) { e.fillStyle = 'rgba(40,50,60,1)'; e.fillRect(0, 20, 512, 60); }
    g.fillStyle = inside ? '#a9aca9' : '#57626a'; g.fillRect(0, 470, 512, 42);
    return (cache[k] = { col, em });
  }
  function couloirTex() {     // murs de couloir : peinture claire, bande de protection, panneaux d'affichage
    return mk(512, 512, (g, w, h) => {
      g.fillStyle = '#ebe7dd'; g.fillRect(0, 0, w, h); K.grain(g, w, h, 3);
      g.fillStyle = '#5d7a99'; g.fillRect(0, 390, w, 26); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 390, w, 3);
      if (Math.random() < 0.8) {
        const x = 60 + Math.random() * 200; g.fillStyle = '#b48a55'; g.fillRect(x, 150, 200, 130); g.fillStyle = '#8a6a40'; g.fillRect(x, 150, 200, 6);
        for (let k = 0; k < 7; k++) { g.fillStyle = BR.pick(['#fff', '#f6f0c8', '#dbe9f6', '#f9d9d0']); g.save(); g.translate(x + 15 + Math.random() * 150, 165 + Math.random() * 80); g.rotate((Math.random() - 0.5) * 0.15); g.fillRect(0, 0, 34, 44); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let l = 0; l < 5; l++) g.fillRect(4, 6 + l * 7, 18 + Math.random() * 8, 2); g.restore(); }
      }
      g.fillStyle = '#4c4a45'; g.fillRect(0, h - 16, w, 16);
    });
  }
  function amphiTex() {       // amphi : panneaux bois acoustiques (rainurés)
    return mk(512, 512, (g, w, h) => {
      g.fillStyle = '#a77b4f'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 128) { g.fillStyle = K.vary('#a77b4f', 0.1); g.fillRect(x + 2, 0, 124, h); }
      g.fillStyle = 'rgba(40,25,10,0.35)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 3, h);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 256, w, 3); K.grain(g, w, h, 6);
      g.fillStyle = '#3e3a35'; g.fillRect(0, h - 18, w, 18);
    });
  }
  function atelierTex() {     // cloisons du hall : parpaings peints, bande jaune
    return mk(512, 512, (g, w, h) => {
      g.fillStyle = '#c9cccb'; g.fillRect(0, 0, w, h);
      for (let y = 0, r = 0; y < h; y += 26, r++) for (let x = -(r % 2) * 64; x < w; x += 128) { g.fillStyle = K.vary('#c9cccb', 0.05); g.fillRect(x + 2, y + 2, 124, 22); }
      g.fillStyle = '#e1b52b'; g.fillRect(0, 420, w, 30); g.fillStyle = '#2a2a2a'; for (let x = -30; x < w; x += 40) { g.beginPath(); g.moveTo(x, 450); g.lineTo(x + 20, 450); g.lineTo(x + 40, 420); g.lineTo(x + 20, 420); g.fill(); }
      K.grain(g, w, h, 4); g.fillStyle = '#5a5d5f'; g.fillRect(0, h - 14, w, 14);
    });
  }
  function vitragePair() {    // murs-rideaux (hall d'entrée, passerelle couverte)
    if (cache.vi) return cache.vi;
    const col = mk(512, 512, () => {}), em = mk(512, 512, () => {}), g = col.getContext('2d'), e = em.getContext('2d');
    e.fillStyle = '#000'; e.fillRect(0, 0, 512, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#1f2b3a'); gr.addColorStop(1, '#33404e'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    e.fillStyle = 'rgba(22,28,36,1)'; e.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(255,255,255,0.07)'; for (let k = 0; k < 2; k++) { const x = 80 + k * 240; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 70, 0); g.lineTo(x - 60, 512); g.lineTo(x - 130, 512); g.fill(); }
    g.fillStyle = '#5b6672'; for (let x = 0; x <= 512; x += 128) g.fillRect(x - 6, 0, 12, 512); g.fillRect(0, 0, 512, 10); g.fillRect(0, 160, 512, 8); g.fillRect(0, 498, 512, 14);
    return (cache.vi = { col, em });
  }
  function briqueTex() {      // loge du portail : brique
    return mk(512, 512, (g, w, h) => {
      g.fillStyle = '#7a6a5c'; g.fillRect(0, 0, w, h);
      for (let y = 0, r = 0; y < h; y += 28, r++) for (let x = -(r % 2) * 48; x < w; x += 96) { g.fillStyle = K.vary('#a5604a', 0.12); g.fillRect(x + 2, y + 2, 92, 24); }
      K.grain(g, w, h, 5); g.fillStyle = '#5a5550'; g.fillRect(0, h - 20, w, 20);
    });
  }
  function hmiTex() {         // écran de commande numérique (texte générique, pas de marque)
    return mk(256, 192, (g, w, h) => {
      g.fillStyle = '#0d1a26'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#163a5a'; g.fillRect(0, 0, w, 22); g.fillStyle = '#9fd0ff'; g.font = "bold 14px Consolas, monospace"; g.fillText('PROGRAMME  O1024  MEM', 8, 16);
      g.fillStyle = '#7dffb0'; g.font = "13px Consolas, monospace";
      const lines = ['N10 G90 G54 G17', 'N20 T05 M06', 'N30 S2400 M03', 'N40 G00 X-12.5 Y40.', 'N50 G43 Z5. H05 M08', 'N60 G01 Z-2. F180', 'N70 G02 X0 Y52.5 R12.5', 'N80 G01 X35.'];
      lines.forEach((l, k) => g.fillText(l, 8, 42 + k * 16));
      g.fillStyle = '#ffd34a'; g.fillRect(150, 36, 96, 60); g.fillStyle = '#0d1a26'; g.font = "bold 12px Consolas, monospace"; g.fillText('X  -12.500', 156, 54); g.fillText('Y   40.000', 156, 70); g.fillText('Z    5.000', 156, 86);
      g.fillStyle = '#2a4d6e'; for (let k = 0; k < 6; k++) g.fillRect(6 + k * 41, h - 22, 37, 16);
    });
  }
  function totemTex() {      // totem d'entrée
    return mk(512, 256, (g, w, h) => {
      g.fillStyle = '#1e2f45'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8eef4'; g.textAlign = 'center'; g.font = "800 64px 'Segoe UI', Arial"; g.fillText('IUT DE NANTES', w / 2, 92);
      g.font = "500 30px 'Segoe UI', Arial"; g.fillText('Campus de la Fleuriaye', w / 2, 140);
      g.fillStyle = '#e0a84a'; g.fillRect(w / 2 - 150, 160, 300, 4);
      g.fillStyle = '#c8d3de'; g.font = "400 22px 'Segoe UI', Arial"; g.fillText('GEII · GMP · GTE · QLIO · SGM', w / 2, 200); g.fillText('Nantes Université', w / 2, 230);
    });
  }
  function skyTex() {        // lanterneaux du hall, vus de nuit
    return mk(256, 256, (g, w, h) => { g.fillStyle = '#16233a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } g.fillStyle = '#5c666e'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 8, h); g.fillRect(0, 0, w, 8); });
  }
  function voirieTex() {     // enrobé de parking (plus clair que la ville)
    return mk(512, 512, (g, w, h) => {
      g.fillStyle = '#45474b'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 10, '0,0,0', 0.04, 0.08, 40, 140); K.blot(g, w, h, 6, '255,255,255', 0.02, 0.04, 40, 120);
      for (let k = 0; k < 2500; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    });
  }
  Object.assign(Tx.MAKE, {
    iu_facade: () => facadePair().col, iu_facadeE: () => facadePair().em, iu_facadeIn: () => facadeInPair().col,
    iu_bardage: () => bardagePair(false).col, iu_bardageIn: () => bardagePair(true).col, iu_bardageInE: () => bardagePair(true).em,
    iu_couloir: couloirTex, iu_salle: () => P.paint('#e9e6df', '#6f6c66'), iu_beton: () => P.concrete('#9c9b96', true), iu_amphi: amphiTex, iu_atelier: atelierTex,
    iu_vitre: () => vitragePair().col, iu_vitreE: () => vitragePair().em, iu_brique: briqueTex,
    iu_voirie: voirieTex, iu_trottoir: () => P.sidewalk(), iu_pelouse: () => P.grass(), iu_parvis: () => P.plaza(),
    iu_carrelage: () => P.tiles('#d8d3c7', '#cbc5b8', 2, 'rgba(110,100,90,0.45)'),
    iu_lino: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#8c8f86'; g.fillRect(0, 0, w, h); for (let k = 0; k < 1200; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } K.grain(g, w, h, 3); }),
    iu_linoB: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#5f6f80'; g.fillRect(0, 0, w, h); for (let k = 0; k < 1200; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } K.grain(g, w, h, 3); }),
    iu_resine: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#7c8a80'; g.fillRect(0, 0, w, h); K.blot(g, w, h, 6, '0,0,0', 0.03, 0.07, 30, 90); K.blot(g, w, h, 3, '40,30,20', 0.04, 0.08, 10, 30); K.grain(g, w, h, 3); }),
    iu_toit: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#6b6863'; g.fillRect(0, 0, w, h); for (let k = 0; k < 3000; k++) { g.fillStyle = K.vary('#77736c', 0.4); g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 2 + Math.random() * 2); } }),
    iu_bois: () => P.wood(), iu_moquette: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#5a3438'; g.fillRect(0, 0, w, h); K.grain(g, w, h, 12); }),
    iu_cour: () => P.concrete('#8f8e88', true),
    iu_plafond: () => P.ceilTiles('#ecebe6', '#bdbcb6'), iu_dessous: () => P.concrete('#a3a29c'),
    iu_marche: () => P.stairs('#5c6168', '#d9b13a'), iu_edge: () => P.edge('#a3a29c', '#56697c'), iu_limon: () => P.concrete('#9c9b96'),
    iu_tableau: () => K.whiteboard('meca'), iu_hmi: hmiTex, iu_totem: totemTex, iu_ciel: skyTex,
    iu_bac: () => mk(256, 256, (g, w, h) => { g.fillStyle = '#c8cbc8'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, 0, 10, h); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + 10, 0, 3, h); } K.grain(g, w, h, 4); }),
  });
  const ZF = { voirie: 1, trottoir: 2, pelouse: 3, parvis: 4, carrelage: 5, couloir: 6, salle: 7, resine: 8, toit: 9, bois: 10, moquette: 11, beton: 12, cour: 13, salleB: 14 };
  const ZW = { facade: 1, bardage: 2, couloir: 3, salle: 4, beton: 5, vitre: 6, amphi: 7, atelier: 8, brique: 9, facadeIn: 21, bardageIn: 22 };
  Tx.THEMES.iut = {
    name: 'IUT de Nantes', fog: 0x0b111c, fogDensity: 0.02, ambient: 0x56627a, ambientI: 0.42, hemi: [0x8ea2c8, 0x1e1d1a, 0.5], exposure: 1.1,
    lightColor: 0xf3f2ea, panel: '#f6f8ff', flicker: 0.12, deadLights: 0.17, outdoor: true, sky: 0x0a0f1c, moon: 0x9fb4e0, lightI: 1.2, flashI: 0.95,
    tex: {
      floor: {
        0: { t: 'iu_pelouse', surf: 'grass' }, 1: { t: 'iu_voirie', rep: [0.25, 0.25] }, 2: { t: 'iu_trottoir' }, 3: { t: 'iu_pelouse', surf: 'grass' }, 4: { t: 'iu_parvis', rep: [0.5, 0.5] }, 5: { t: 'iu_carrelage', rough: 0.35 },
        6: { t: 'iu_lino', rough: 0.45 }, 7: { t: 'iu_linoB', rough: 0.5 }, 8: { t: 'iu_resine', rough: 0.45 }, 9: { t: 'iu_toit', surf: 'gravel' }, 10: { t: 'iu_bois', rough: 0.6 }, 11: { t: 'iu_moquette', rough: 1 },
        12: { t: 'iu_cour' }, 13: { t: 'iu_cour' }, 14: { t: 'iu_lino', rough: 0.45 },
        40: { t: 'iu_tableau', rough: 0.3 }, 41: { t: 'iu_ciel', em: 'iu_ciel', ei: 0.6 }, 42: { t: 'iu_hmi', em: 'iu_hmi', ei: 1.2 }, 43: { t: 'iu_totem', em: 'iu_totem', ei: 0.6 }, 44: { t: 'iu_bac', rough: 0.6, metal: 0.3 },
      },
      wall: {
        0: { t: 'iu_salle' }, 1: { t: 'iu_facade', em: 'iu_facadeE', ei: 0.7, rough: 0.7 }, 2: { t: 'iu_bardage', rough: 0.55, metal: 0.35 }, 3: { t: 'iu_couloir' }, 4: { t: 'iu_salle' }, 5: { t: 'iu_beton' },
        6: { t: 'iu_vitre', em: 'iu_vitreE', ei: 0.7, rough: 0.2, metal: 0.2 }, 7: { t: 'iu_amphi' }, 8: { t: 'iu_atelier' }, 9: { t: 'iu_brique' },
        21: { t: 'iu_facadeIn' }, 22: { t: 'iu_bardageIn', em: 'iu_bardageInE', ei: 0.6, rough: 0.6, metal: 0.25 },
      },
      ci: { t: 'iu_plafond' }, co: { t: 'iu_dessous' }, e: { t: 'iu_edge' }, r: { t: 'iu_marche', rough: 0.6 }, rs: { t: 'iu_limon' },
    },
  };

  /* =====================================================================
     GÉNÉRATEUR
     ===================================================================== */
  function genIUT(def, seed, diff, rng, H) {
    const W = 64, Hh = 56, F = 3, ri = (a, b) => K.ri(rng, a, b);
    const m = H.newMap('iut', def, W, Hh, F, seed);
    const set = (f, x, y, t, z) => H.set(m, f, x, y, t, z), rect = (f, x0, y0, x1, y1, t, z) => H.rect(m, f, x0, y0, x1, y1, t, z);
    const indoor = (f, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.indoor[f][y * W + x] = 1; };
    const I = { rooms: [], doors: [], zones: [], stairs: [], lamps: [] };
    m.iut = I;
    // ---- terrain : pelouse partout, étages vides ----
    for (let i = 0; i < m.WH; i++) { m.t[0][i] = FLOOR; m.zone[0][i] = ZF.pelouse; m.t[1][i] = VOID; m.t[2][i] = VOID; }
    // voirie et parkings
    rect(0, 4, 47, 60, 47, FLOOR, ZF.trottoir); rect(0, 4, 48, 60, 53, FLOOR, ZF.voirie); rect(0, 4, 54, 60, 54, FLOOR, ZF.trottoir);
    rect(0, 55, 4, 60, 46, FLOOR, ZF.voirie); rect(0, 54, 4, 54, 46, FLOOR, ZF.trottoir); rect(0, 61, 4, 61, 46, FLOOR, ZF.trottoir);
    rect(0, 8, 1, 52, 3, FLOOR, ZF.cour); rect(0, 48, 1, 54, 3, FLOOR, ZF.voirie);
    rect(0, 24, 44, 43, 46, FLOOR, ZF.parvis);
    rect(0, 3, 4, 3, 46, FLOOR, ZF.trottoir); rect(0, 4, 24, 53, 25, FLOOR, ZF.trottoir); rect(0, 50, 26, 53, 46, FLOOR, ZF.pelouse);
    rect(0, 26, 22, 27, 27, FLOOR, ZF.trottoir);
    // ---- hall technologique ----
    const hx0 = 10, hx1 = 47, hy0 = 4, hy1 = 21;
    for (const f of [0, 1]) { rect(f, hx0, hy0, hx1, hy1, WALL, ZW.bardage); indoor(f, hx0, hy0, hx1, hy1); }
    rect(0, hx0 + 1, hy0 + 1, hx1 - 1, hy1 - 1, FLOOR, ZF.resine); rect(1, hx0 + 1, hy0 + 1, hx1 - 1, hy1 - 1, VOID);
    rect(2, hx0, hy0, hx1, hy1, FLOOR, ZF.toit);
    // locaux sous la mezzanine (côté sud du hall) : métrologie, magasin, essais, automatisme
    rect(0, hx0 + 1, 16, 36, 16, WALL, ZW.atelier);
    const locs = [['metrologie', 11, 17], ['magasin', 19, 23], ['essais', 25, 29], ['automatisme', 31, 36]];
    for (const [type, a, b] of locs) {
      if (b < 36) rect(0, b + 1, 17, b + 1, 20, WALL, ZW.atelier);
      const d = ri(a + 1, b - 1); set(0, d, 16, FLOOR, ZF.resine); I.doors.push({ f: 0, x: d, y: 16 });
      I.rooms.push({ f: 0, type, x0: a, x1: b, y0: 17, y1: 20, door: d, front: 16, side: 'N', hall: true });
      rect(0, a, 17, b, 20, FLOOR, type === 'metrologie' ? ZF.salleB : ZF.resine);
    }
    // mezzanine du bureau d'études (au-dessus des locaux), escalier métallique le long du bord
    rect(1, hx0 + 1, 16, 36, 20, FLOOR, ZF.beton); set(1, 36, 15, FLOOR, ZF.beton);
    set(0, 36, 15, WALL, ZW.atelier);
    if (!H.addRamp(m, 0, 40, 15, -1, 0, 4, { zone: ZF.resine })) return null;
    I.stairs.push({ f: 0, y: 15, x0: 40, dx: -1, metal: true });
    I.rooms.push({ f: 1, type: 'be', x0: 11, x1: 36, y0: 16, y1: 20, side: 'S', hall: true });
    // portes du hall
    for (const [x, y] of [[28, hy0], [29, hy0], [30, hy0], [26, hy1], [27, hy1], [hx1, 11], [hx0, 9]]) { set(0, x, y, FLOOR, ZF.resine); I.doors.push({ f: 0, x, y, out: y !== hy1 }); }
    I.bigDoor = { x0: 28, x1: 30, y: hy0 };
    // ---- passerelle couverte (hall <-> bâtiment A) ----
    for (const f of [0]) { rect(f, 25, 22, 25, 27, WALL, ZW.vitre); rect(f, 28, 22, 28, 27, WALL, ZW.vitre); rect(f, 26, 22, 27, 27, FLOOR, ZF.couloir); indoor(f, 25, 22, 28, 27); }
    rect(1, 25, 22, 28, 27, FLOOR, ZF.toit);
    // ---- bâtiment A (enseignement, R+1) ----
    const bx0 = 6, bx1 = 49, by0 = 28, by1 = 43;
    for (const f of [0, 1]) { rect(f, bx0, by0, bx1, by1, WALL, ZW.facade); indoor(f, bx0, by0, bx1, by1); }
    rect(2, bx0, by0, bx1, by1, FLOOR, ZF.toit);
    set(0, 26, by0, FLOOR, ZF.couloir); set(0, 27, by0, FLOOR, ZF.couloir);
    // amphithéâtre (ouest) : scène, gradins (rampes parallèles), haut de l'amphi à l'étage
    rect(0, 7, 29, 18, 42, FLOOR, ZF.carrelage); rect(0, 7, 29, 8, 42, FLOOR, ZF.bois); rect(0, 9, 29, 13, 29, FLOOR, ZF.moquette); rect(0, 9, 42, 13, 42, FLOOR, ZF.moquette);
    rect(0, 9, 30, 12, 41, FLOOR, ZF.moquette); rect(0, 13, 30, 13, 41, WALL, ZW.amphi);
    rect(0, 19, by0 + 1, 19, by1 - 1, WALL, ZW.amphi);
    rect(1, 7, 29, 12, 42, VOID); rect(1, 13, 29, 18, 42, FLOOR, ZF.moquette); rect(1, 19, by0 + 1, 19, by1 - 1, WALL, ZW.couloir);
    for (let y = 30; y <= 41; y++) if (!H.addRamp(m, 0, 9, y, 1, 0, 4, { zone: ZF.moquette })) return null;
    I.amphi = { x0: 7, x1: 18, y0: 29, y1: 42 };
    for (const f of [0, 1]) for (const y of [35, 36]) { set(f, 19, y, FLOOR, ZF.couloir); I.doors.push({ f, x: 19, y }); }
    set(0, bx0, 31, FLOOR, ZF.bois); I.doors.push({ f: 0, x: bx0, y: 31, out: true });
    // couloir central (rez et étage)
    for (const f of [0, 1]) { rect(f, 20, 34, bx1 - 1, 34, WALL, ZW.couloir); rect(f, 20, 37, bx1 - 1, 37, WALL, ZW.couloir); rect(f, 20, 35, bx1 - 1, 36, FLOOR, ZF.couloir); }
    for (const y of [35, 36]) { set(0, bx1, y, FLOOR, ZF.couloir); I.doors.push({ f: 0, x: bx1, y, out: true }); }
    // hall d'entrée sur double hauteur + escalier
    rect(0, 30, 37, 37, 42, FLOOR, ZF.carrelage);
    rect(1, 30, 37, 37, 37, FLOOR, ZF.couloir); rect(1, 30, 38, 30, 42, WALL, ZW.couloir); rect(1, 37, 38, 37, 42, WALL, ZW.couloir);
    rect(1, 31, 38, 35, 42, VOID); rect(1, 36, 38, 36, 40, FLOOR, ZF.couloir); rect(1, 36, 41, 36, 42, WALL, ZW.couloir);
    set(0, 36, 40, WALL, ZW.beton);
    if (!H.addRamp(m, 0, 32, 40, 1, 0, 4, { zone: ZF.carrelage })) return null;
    I.stairs.push({ f: 0, y: 40, x0: 32, dx: 1 });
    rect(0, 33, by1, 34, by1, FLOOR, ZF.carrelage); I.doors.push({ f: 0, x: 33, y: by1, out: true }, { f: 0, x: 34, y: by1, out: true });
    for (let x = 30; x <= 37; x++) m.zone[0][by1 * W + x] = ZW.vitre, m.zone[1][by1 * W + x] = ZW.vitre;
    I.atrium = { x0: 30, x1: 37, y0: 37, y1: 42 };
    // auvent de l'entrée (dalle portée par deux poteaux)
    rect(1, 31, 44, 36, 45, FLOOR, ZF.toit);
    // cage d'escalier est
    for (const f of [0, 1]) rect(f, 43, 38, 48, 42, FLOOR, ZF.couloir);
    set(0, 48, 39, WALL, ZW.beton);
    if (!H.addRamp(m, 0, 44, 39, 1, 0, 4, { zone: ZF.couloir })) return null;
    I.stairs.push({ f: 0, y: 39, x0: 44, dx: 1 });
    set(0, 45, 37, FLOOR, ZF.couloir); set(1, 44, 37, FLOOR, ZF.couloir); I.doors.push({ f: 0, x: 45, y: 37 }, { f: 1, x: 44, y: 37 });
    set(0, bx1, 41, FLOOR, ZF.couloir); I.doors.push({ f: 0, x: bx1, y: 41, out: true });
    I.rooms.push({ f: 0, type: 'escalier', x0: 43, x1: 48, y0: 38, y1: 42, side: 'S' });
    // salles le long du couloir
    const nameN = ['A', 'B'], plans = {
      N0: ['cao', 'td', 'tp_rdm', 'td', 'cafet'], N1: ['td', 'cao', 'td', 'tp_auto', 'profs'],
      S0: [[20, 28, ['admin', 'td']], [39, 41, ['bde']]], S1: [[20, 28, ['td', 'cdi']], [39, 41, ['td']]],
    };
    let num = 0;
    const carve = (f, side, a, b, types) => {
      const y0 = side === 'N' ? 29 : 38, y1 = side === 'N' ? 33 : 42, front = side === 'N' ? 34 : 37;
      const n = types.length, span = b - a + 1; let rest = span - (n - 1), x = a;
      BR.shuffle(types, rng);
      types.forEach((type, k) => {
        const left = n - k - 1, w = k === n - 1 ? rest : BR.clamp(Math.floor(rest / (left + 1)) + ri(-1, 1), 4, rest - left * 4);
        rest -= w;
        const x0 = x, x1 = x + w - 1;
        rect(f, x0, y0, x1, y1, FLOOR, type === 'cdi' || type === 'profs' || type === 'admin' ? ZF.moquette : ZF.salle);
        if (k < n - 1) rect(f, x1 + 1, y0, x1 + 1, y1, WALL, ZW.salle);
        const d = ri(x0 + 1, Math.max(x0 + 1, x1 - 1)); set(f, d, front, FLOOR, ZF.couloir); I.doors.push({ f, x: d, y: front });
        I.rooms.push({ f, type, x0, x1, y0, y1, front, side, door: d, num: nameN[f] + (f + 1) + String(++num).padStart(2, '0') });
        x = x1 + 2;
      });
    };
    carve(0, 'N', 20, bx1 - 1, plans.N0.slice()); carve(1, 'N', 20, bx1 - 1, plans.N1.slice());
    for (const [a, b, t] of plans.S0) carve(0, 'S', a, b, t.slice());
    for (const [a, b, t] of plans.S1) carve(1, 'S', a, b, t.slice());
    // ---- loge du portail (sortie) ----
    rect(0, 0, 49, 3, 53, WALL, ZW.brique);
    rect(1, 0, 49, 4, 53, FLOOR, ZF.toit);
    I.loge = { x0: 0, x1: 3, y0: 49, y1: 53 };
    // ---- départ dans le hall technologique, sortie : porte de la loge ----
    m.spawn = { f: 0, cx: ri(14, 20), cy: ri(9, 11) };
    m.exit = { cx: 4, cy: 51, dx: -1, dy: 0 };
    // murs intérieurs non découpés du bâtiment A : cloisons peintes (pas la façade)
    for (const f of [0, 1]) for (let y = by0 + 1; y < by1; y++) for (let x = bx0 + 1; x < bx1; x++) { const i = y * W + x; if (m.t[f][i] === WALL && m.zone[f][i] === ZW.facade) m.zone[f][i] = ZW.salle; }
    H.connectLayer(m, 0, ZF.resine);
    // ---- garde-corps (seulement à l'intérieur, pas autour des toits) ----
    K.rails(m, { skip: (f, x, y) => f !== 1 || !m.indoor[1][y * W + x] });
    furnishIUT(m, H, rng);
    exterior(m, H, rng);
    if (!H.finalize(m, rng, diff)) return null;
    if (!K.cutJumps(m)) return null;
    // éclairage : néons des pièces à hauteur normale, projecteurs du hall, suspensions de l'amphi et du hall d'entrée
    const th = BR.Tex.theme(def.theme);
    const inHall = i => { const x = i % W, y = (i / W) | 0; return x >= hx0 && x <= hx1 && y >= hy0 && y <= hy1; };
    H.panelLights(m, rng, th, (f, i) => m.indoor[f][i] === 1 && H.ceilY(m, f, i) - f * SH < 4.5 && !(inHall(i) && f === 0 && ((i / W) | 0) < 16));
    for (let x = 13; x <= 45; x += 5) for (const z of [12, 21, 28]) { const r = rng(); I.lamps.push({ x: x * C + 1, z: z + 0.5, y: 7.0, k: 'cloche' }); m.lights.push({ f: 0, cx: x, cy: Math.floor(z / C), y: 6.9, kind: 'lamp', px: x * C + 1, pz: z + 0.5, dead: r < 0.1, flicker: r > 0.1 && r < 0.2, phase: rng() * 100, deco: 'cloche' }); }
    for (const [x, z] of [[20, 62], [20, 74], [24, 68], [26, 62], [26, 76]]) m.lights.push({ f: 0, cx: Math.floor(x / C), cy: Math.floor(z / C), y: 7.2, kind: 'lamp', px: x, pz: z, dead: false, flicker: rng() < 0.15, phase: rng() * 100, deco: 'spot' });
    for (const [x, z] of [[64, 80], [70, 80], [67, 84]]) m.lights.push({ f: 0, cx: Math.floor(x / C), cy: Math.floor(z / C), y: 7.0, kind: 'lamp', px: x, pz: z, dead: false, flicker: false, phase: 0, deco: 'pend' });
    return m;
  }

  /* ---------- extérieur : voitures, lampadaires, arbres, mobilier ---------- */
  function exterior(m, H, rng) {
    const W = m.W, ri = (a, b) => K.ri(rng, a, b);
    const free = (x, y) => { const i = y * W + x; return x > 0 && y > 0 && x < W - 1 && y < m.H - 1 && m.t[0][i] === FLOOR && m.propAt[0][i] < 0 && m.t[1][i] === VOID && !m.indoor[0][i]; };
    const keep = (x, y) => Math.abs(x - m.exit.cx) + Math.abs(y - m.exit.cy) > 3;
    // parking sud : deux rangées de places perpendiculaires à la voie
    for (let x = 6; x <= 58; x += 1) { if (x >= 30 && x <= 37) continue; if (rng() < 0.55 && free(x, 48) && free(x, 49) && keep(x, 48)) H.carProps(m, 0, x, 48, rng, false); if (rng() < 0.45 && free(x, 52) && free(x, 53) && keep(x, 52)) H.carProps(m, 0, x, 52, rng, false); }
    // parking du personnel (est)
    for (let y = 5; y <= 44; y += 1) { if (y >= 24 && y <= 26) continue; if (rng() < 0.4 && free(55, y) && free(56, y)) H.carProps(m, 0, 55, y, rng, true); if (rng() < 0.35 && free(59, y) && free(60, y) && y < 22) H.carProps(m, 0, 59, y, rng, true); }
    m.iut.parkY = [48, 52];
    // voitures de particuliers uniquement (pas de taxi ni de police sur un parking de campus)
    const civ = [0, 1, 3, 5, 6, 8];
    const remap = new Map();
    for (const p of m.props) if (p.kind === 'car' && p.link != null) { if (!remap.has(p.link)) remap.set(p.link, civ[Math.abs(p.link) % civ.length]); }
    for (const p of m.props) if (p.kind === 'car' && remap.has(p.link)) p.link = remap.get(p.link);
    // lampadaires
    const lamp = (x, y, ax, az) => {
      if (!free(x, y)) return;
      const p = H.addProp(m, 0, x, y, 'lamp', 6.0, 0.3, 0.3, { rot: Math.atan2(az, -ax) });
      if (p) { p.hx = p.x + ax * 1.35; p.hz = p.z + az * 1.35; const r = rng(); m.lights.push({ f: 0, cx: x, cy: y, y: 5.5, kind: 'lamp', dead: r < 0.12, flicker: r > 0.12 && r < 0.25, phase: rng() * 100, px: p.hx, pz: p.hz, prop: p.id }); }
    };
    for (let x = 8; x <= 58; x += 9) { lamp(x, 47, 0, 1); lamp(x + 4, 54, 0, -1); }
    for (let y = 8; y <= 44; y += 9) { lamp(54, y, 1, 0); lamp(61, y + 4, -1, 0); }
    for (let x = 12; x <= 46; x += 11) lamp(x, 24, 0, 1);
    for (let y = 8; y <= 44; y += 10) lamp(3, y, 1, 0);
    for (let x = 14; x <= 48; x += 12) lamp(x, 3, 0, -1);
    // arbres sur les pelouses, bancs, poubelles
    let n = 0;
    for (let k = 0; k < 900 && n < 60; k++) {
      const x = ri(1, W - 2), y = ri(1, m.H - 2), i = y * W + x;
      if (!free(x, y) || m.zone[0][i] !== 3 || !keep(x, y)) continue;
      let ok = true; for (const [dx, dy] of D4) { const j = (y + dy) * W + x + dx; if (m.t[0][j] === WALL || m.propAt[0][j] >= 0) ok = false; }
      if (!ok) continue;
      H.addProp(m, 0, x, y, 'tree', 6, 0.6, 0.6); n++;
    }
    for (let x = 8; x <= 46; x += 7) if (free(x, 25)) H.addProp(m, 0, x, 25, 'bench', 0.45, 1.6, 0.7);
    for (const [x, y] of [[25, 45], [42, 45], [50, 47], [6, 46]]) if (free(x, y)) H.addProp(m, 0, x, y, 'bin', 0.9, 0.6, 0.6);
    for (let x = 12; x <= 50; x += 6) if (free(x, 2)) H.addProp(m, 0, x, 2, rng() < 0.6 ? 'dumpster' : 'box', rng() < 0.6 ? 1.3 : 1.15, 1.8, 1.2);
    // abri à vélos devant l'entrée
    for (let x = 38; x <= 42; x++) if (free(x, 45)) K.solid(m, H, 0, x, 45, 'velos', 1.0, 2.0, 0.6, { v: x === 38 ? 0 : 1 });
    // poteaux de l'auvent
    for (const x of [31, 36]) K.solid(m, H, 0, x, 45, 'poteau', 3.7, 0.3, 0.3, { oz: 0.6 });
    // totem d'entrée
    K.solid(m, H, 0, 29, 46, 'totem', 2.6, 1.4, 0.4);
  }

  /* ---------- mobilier des salles et machines du hall ---------- */
  function furnishIUT(m, H, rng) {
    const W = m.W, I = m.iut, ri = (a, b) => K.ri(rng, a, b);
    const doorNear = (f, x, y, r) => I.doors.some(d => d.f === f && Math.abs(d.x - x) <= r && Math.abs(d.y - y) <= r);
    const free = (f, x, y) => { if (x < 1 || y < 1 || x >= W - 1 || y >= m.H - 1) return false; const i = y * W + x; return m.t[f][i] === FLOOR && m.propAt[f][i] < 0 && m.rampAt[f][i] < 0 && !m.ramps.some(r => (r.f === f && r.approach === i) || (r.f + 1 === f && r.landing === i)); };
    const nearSpawn = (f, x, y) => f === 0 && Math.abs(x - m.spawn.cx) + Math.abs(y - m.spawn.cy) <= 3;
    const put = (f, x, y, sub, h, w, d, o) => { if (!free(f, x, y) || doorNear(f, x, y, 1) || nearSpawn(f, x, y)) return null; return K.solid(m, H, f, x, y, sub, h, w, d, o); };
    // machine sur deux cases (le long de x) : les deux cases doivent être libres
    const put2 = (x, y, sub, h, d, o) => { if (!free(0, x, y) || !free(0, x + 1, y) || doorNear(0, x, y, 1) || doorNear(0, x + 1, y, 1) || nearSpawn(0, x, y) || nearSpawn(0, x + 1, y)) return false; K.solid(m, H, 0, x, y, sub, h, 2, d, Object.assign({ v: 0 }, o)); K.solid(m, H, 0, x + 1, y, sub, h, 2, d, Object.assign({ v: 1 }, o)); I.zones.push({ x0: x, x1: x + 1, y0: y, y1: y }); return true; };
    // ---- hall technologique : îlots de machines ----
    // rangée nord : usinage conventionnel (tours), puis fraiseuses ; centre : commande numérique ; est : perçage, sciage, montage
    const zones = [
      { name: 'USINAGE CONVENTIONNEL', sub: 'Tournage', x0: 12, x1: 26, ys: [7, 10], kind: 'tour' },
      { name: 'USINAGE CONVENTIONNEL', sub: 'Fraisage', x0: 31, x1: 45, ys: [7, 10], kind: 'fraiseuse' },
      { name: 'COMMANDE NUMÉRIQUE', sub: 'Centres d\'usinage et tours CN', x0: 12, x1: 30, ys: [13], kind: 'cn' },
      { name: 'ATELIER', sub: 'Perçage, sciage, rectification', x0: 33, x1: 45, ys: [13], kind: 'divers' },
    ];
    I.hallZones = zones;
    for (const z of zones) for (const y of z.ys) {
      for (let x = z.x0; x <= z.x1;) {
        if (z.kind === 'tour') { if (put2(x, y, rng() < 0.75 ? 'tour' : 'tourcn', 1.55, 1.1)) x += 3; else x++; }
        else if (z.kind === 'fraiseuse') { if (put(0, x, y, 'fraiseuse', 2.1, 1.7, 1.6)) { I.zones.push({ x0: x, x1: x, y0: y, y1: y }); x += 2; } else x++; }
        else if (z.kind === 'cn') { if (put2(x, y, rng() < 0.6 ? 'centre' : 'tourcn', 2.5, 1.9)) x += 3; else x++; }
        else { const k = BR.pick(['perceuse', 'perceuse', 'scie', 'rectifieuse', 'etabli', 'etabli', 'imprimante3d'], rng); const dims = { perceuse: [2.0, 1.0, 1.0], scie: [1.6, 1.8, 0.9], rectifieuse: [1.8, 1.8, 1.4], etabli: [0.95, 1.9, 0.8], imprimante3d: [1.2, 0.9, 0.9] }[k]; if (put(0, x, y, k, dims[0], dims[1], dims[2])) { I.zones.push({ x0: x, x1: x, y0: y, y1: y }); x += 2; } else x++; }
      }
    }
    // cellule robotisée (avec grillage) et armoires, servantes le long des murs
    const rx = ri(42, 44); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(0, rx + dx, 17 + dy, 'cellule', 2.0, 2, 2, { v: dx + dy * 2 });
    for (let x = 12; x <= 45; x += ri(3, 5)) put(0, x, 5, rng() < 0.5 ? 'armoireoutils' : 'servante', rng() < 0.5 ? 1.9 : 1.0, 1.2, 0.6, { oz: -0.6 });
    for (let x = 38; x <= 46; x += 3) put(0, x, 20, 'bacs', 0.9, 1.4, 1.0, { oz: 0.4 });
    // ---- salles ----
    for (const R of I.rooms) {
      const f = R.f, inner = R.side === 'N' ? 1 : -1, backY = R.side === 'N' ? R.y0 : R.y1, frontY = R.side === 'N' ? R.y1 : R.y0;
      switch (R.type) {
        case 'metrologie': {
          put(f, R.x0 + 2, 18, 'mmt', 2.2, 1.9, 1.9);
          put(f, R.x0 + 4, 18, 'marbre', 0.9, 1.9, 1.2);
          for (let x = R.x0; x <= R.x1; x += 2) put(f, x, 20, 'armoire', 1.9, 1.0, 0.5, { oz: 0.7 });
          break;
        }
        case 'magasin': { for (let x = R.x0; x <= R.x1; x += 2) for (const y of [18, 20]) put(f, x, y, 'rayonnage', 2.2, 0.8, 1.8); break; }
        case 'essais': { put(f, R.x0 + 1, 18, 'traction', 2.4, 1.4, 1.0); put(f, R.x0 + 3, 19, 'etabli', 0.95, 1.9, 0.8); break; }
        case 'automatisme': { for (let x = R.x0; x <= R.x1; x += 2) put(f, x, 18, 'maquette', 1.6, 1.8, 0.9); for (let x = R.x0 + 1; x <= R.x1; x += 2) put(f, x, 20, 'armoireelec', 2.0, 1.0, 0.5, { oz: 0.7 }); break; }
        case 'be': { for (let x = R.x0 + 1; x <= R.x1 - 1; x += 2) for (const y of [17, 19]) put(f, x, y, 'postepc', 0.76, 1.9, 1.1, { ry: Math.PI }); break; }
        case 'td': case 'cao': case 'tp_rdm': case 'tp_auto': {
          // tableau sur une cloison latérale, rangées face à lui
          const bs = m.t[f][R.y0 * W + R.x0 - 1] === WALL && m.zone[f][R.y0 * W + R.x0 - 1] !== ZW.amphi ? -1 : 1;
          R.board = bs;
          const bx = bs < 0 ? R.x0 : R.x1, aisle = R.side === 'N' ? R.y0 + 2 : R.y0 + 2;
          put(f, bx, aisle, 'bureauprof', 0.78, 0.8, 1.6, { ry: bs < 0 ? -Math.PI / 2 : Math.PI / 2 });
          const sub = R.type === 'cao' ? 'postepc' : R.type === 'td' ? 'pupitre' : R.type === 'tp_rdm' ? 'bancrdm' : 'maquette';
          for (let x = bx - bs * 2; bs < 0 ? x <= R.x1 : x >= R.x0; x -= bs) for (let y = R.y0; y <= R.y1; y++) {
            if (y === aisle || y === frontY) continue;
            if (sub === 'bancrdm' || sub === 'maquette') { if ((x - R.x0) % 2) continue; put(f, x, y, sub, 1.5, 1.8, 0.9); }
            else put(f, x, y, sub, 0.76, 1.25, 1.9, { ox: -bs * 0.05, ry: bs < 0 ? Math.PI / 2 : -Math.PI / 2 });
          }
          break;
        }
        case 'cafet': { for (let x = R.x0; x <= R.x1; x++) put(f, x, backY, 'distributeur', 1.85, 1.0, 0.8, { oz: -inner * 0.55, v: x % 3 }); for (let x = R.x0 + 1; x <= R.x1 - 1; x += 2) put(f, x, backY + inner * 2, 'tableronde', 0.75, 1.2, 1.2); break; }
        case 'profs': case 'admin': { for (let x = R.x0; x <= R.x1; x += 2) put(f, x, R.y0 + 1 + (R.side === 'N' ? 0 : 2), 'bureau', 0.76, 1.5, 0.75, { ry: R.side === 'N' ? 0 : Math.PI }); for (let x = R.x0; x <= R.x1; x += 2) put(f, x, backY, 'armoire', 1.9, 1.0, 0.5, { oz: -inner * 0.7 }); break; }
        case 'cdi': { for (let x = R.x0; x <= R.x1; x += 2) put(f, x, backY, 'bibliotheque', 2.0, 1.9, 0.5, { oz: -inner * 0.7 }); for (let x = R.x0 + 1; x <= R.x1 - 1; x += 3) put(f, x, R.side === 'N' ? R.y0 + 2 : R.y1 - 2, 'tableronde', 0.75, 1.2, 1.2); break; }
        case 'bde': { put(f, R.x0 + 1, R.side === 'N' ? R.y0 + 1 : R.y1 - 1, 'canape', 0.85, 1.9, 0.9, { ry: R.side === 'N' ? 0 : Math.PI }); put(f, R.x0 + 2, R.side === 'N' ? R.y0 + 3 : R.y1 - 3, 'babyfoot', 0.95, 1.5, 0.9); put(f, R.x1 - 1, R.side === 'N' ? R.y0 + 2 : R.y1 - 2, 'tablebasse', 0.42, 1.2, 0.7); break; }
      }
    }
    // amphi : pupitre de l'enseignant sur la scène ; foyer : bancs ; hall d'entrée : accueil, vitrines de projets
    put(0, 8, 35, 'lutrin', 1.15, 0.8, 1.2);
    for (let y = 31; y <= 40; y += 3) put(0, 17, y, 'banc', 0.45, 0.6, 1.6);
    put(0, 31, 38, 'accueil', 1.1, 1.9, 1.0, { ry: Math.PI });
    put(0, 37, 39, 'vitrine', 1.8, 1.0, 1.6); put(0, 37, 42, 'vitrine', 1.8, 1.0, 1.6);
    for (let x = 21; x <= 47; x += ri(5, 8)) for (const f of [0, 1]) { const y = rng() < 0.5 ? 35 : 36; put(f, x, y, rng() < 0.6 ? 'casiers' : 'banc', rng() < 0.6 ? 1.9 : 0.45, 1.8, 0.5, { oz: y === 35 ? -0.7 : 0.7 }); }
  }

  /* =====================================================================
     DÉCOR
     ===================================================================== */
  function decorIUT(m, B, inst, rng, H, group) {
    const W = m.W, I = m.iut, PB = B('p'), col = K.col, glow = B('glow');
    // ---- doublage intérieur des murs extérieurs (façade -> peinture, bardage -> doublage) ----
    lining(m, B, { 1: 21, 2: 22, 9: 4 });
    // ---- hall technologique : bac acier, fermes, lanterneaux, pont roulant ----
    const X0 = 11 * C, X1 = 47 * C, Z0 = 5 * C, Z1 = 21 * C, yR = 7.66;
    const BAC = B('f44'), SKY = B('f41');
    K.face(BAC, [X0, yR, Z0], [X1, yR, Z0], [X1, yR, Z1], [X0, yR, Z1], 1, [0, -1, 0], 0.5);
    for (let x = X0 + 4; x < X1 - 2; x += 8) K.face(SKY, [x - 1.2, yR - 0.01, Z0 + 2], [x + 1.2, yR - 0.01, Z0 + 2], [x + 1.2, yR - 0.01, Z1 - 2], [x - 1.2, yR - 0.01, Z1 - 2], 1, [0, -1, 0], 0.25);
    const steel = col('#3f5466'), yellow = col('#e6b32c'), dark = col('#2a2f33');
    for (let x = X0 + 6; x < X1; x += 6) {
      K.bar(PB, [x, 7.5, Z0], [x, 7.5, Z1], 0.16, 0.16, steel); K.bar(PB, [x, 6.75, Z0 + 1], [x, 6.75, Z1 - 1], 0.14, 0.14, steel);
      for (let z = Z0 + 1; z < Z1 - 1; z += 2) { K.bar(PB, [x, 6.75, z], [x, 7.5, z + 1], 0.06, 0.06, steel); K.bar(PB, [x, 7.5, z + 1], [x, 6.75, z + 2], 0.06, 0.06, steel); }
      for (const z of [Z0 + 0.18, Z1 - 0.18]) { K.box(PB, x - 0.18, 0, z - 0.16, x + 0.18, 7.6, z + 0.16, steel); K.box(PB, x - 0.25, 6.0, z - (z < 20 ? -0.1 : 0.55), x + 0.25, 6.15, z + (z < 20 ? 0.55 : -0.1), steel); }
    }
    // chemins de roulement et pont roulant jaune
    const zA = Z0 + 0.55, zB = Z1 - 0.55;
    for (const z of [zA, zB]) K.box(PB, X0, 6.15, z - 0.15, X1, 6.5, z + 0.15, steel);
    const cx = X0 + 18 + rng() * 30;
    K.box(PB, cx - 0.35, 6.5, zA - 0.2, cx + 0.35, 7.05, zB + 0.2, yellow);
    for (const z of [zA, zB]) K.box(PB, cx - 0.9, 6.5, z - 0.3, cx + 0.9, 6.85, z + 0.3, yellow);
    const hz = Z0 + 8 + rng() * 14; K.box(PB, cx - 0.6, 6.25, hz - 0.5, cx + 0.6, 6.6, hz + 0.5, dark);
    K.cyl(PB, [cx, 4.2, hz], [cx, 6.25, hz], 0.03, 6, col('#555')); K.box(PB, cx - 0.15, 3.9, hz - 0.1, cx + 0.15, 4.25, hz + 0.1, yellow); K.cyl(PB, [cx, 3.6, hz], [cx, 3.9, hz], 0.08, 8, dark);
    for (let k = 0; k < 6; k++) K.box(PB, cx - 0.36, 6.55 + (k % 2) * 0.25, zA + k * 3 + 0.5, cx + 0.36, 6.8 + (k % 2) * 0.25, zA + k * 3 + 1.0, k % 2 ? dark : yellow);
    // projecteurs (cloches) du hall et éclairages divers
    for (const l of m.lights) {
      if (!l.deco) continue;
      if (l.deco === 'cloche') { K.cyl(PB, [l.px, l.y + 0.05, l.pz], [l.px, 7.5, l.pz], 0.015, 4, dark); K.cyl(PB, [l.px, l.y - 0.1, l.pz], [l.px, l.y + 0.12, l.pz], 0.45, 12, col('#8d969c'), false, 0.15); if (!l.dead) K.cyl(glow, [l.px, l.y - 0.11, l.pz], [l.px, l.y - 0.08, l.pz], 0.4, 12, [0.95, 0.97, 1], true); }
      else if (l.deco === 'spot' || l.deco === 'pend') { K.cyl(PB, [l.px, l.y, l.pz], [l.px, 7.68, l.pz], 0.012, 4, dark); K.cyl(PB, [l.px, l.y - 0.1, l.pz], [l.px, l.y + 0.1, l.pz], 0.3, 10, col('#2a2f33'), false, 0.1); K.cyl(glow, [l.px, l.y - 0.11, l.pz], [l.px, l.y - 0.09, l.pz], 0.26, 10, [1, 0.95, 0.85], true); }
    }
    // marquage au sol : allée piétonne verte et zones machines jaunes
    const PT = B('paint'), Y = 0.012;
    const line = (x0, z0, x1, z1, c) => K.face(PT, [x0, Y, z1], [x1, Y, z1], [x1, Y, z0], [x0, Y, z0], c, [0, 1, 0]);
    for (const z of I.zones) { const a = z.x0 * C + 0.15, b = (z.x1 + 1) * C - 0.15, c = z.y0 * C + 0.15, d = (z.y1 + 1) * C - 0.15, t = 0.08, yl = col('#e3b322'); line(a, c, b, c + t, yl); line(a, d - t, b, d, yl); line(a, c, a + t, d, yl); line(b - t, c, b, d, yl); }
    for (const z of [11 * C + 0.3, 12 * C - 0.3]) line(X0 + 0.5, z - 0.06, X1 - 0.5, z + 0.06, col('#3fae5a'));
    for (let x = X0 + 1; x < X1 - 1; x += 1.6) line(x, 11 * C + 0.45, x + 0.8, 12 * C - 0.45, col('#3fae5a'));
    // ---- amphithéâtre : rangées de fauteuils et tablettes sur les gradins ----
    const A = I.amphi;
    if (A) for (let k = 0; k < 8; k++) {
      const xr = 9 * C + 0.55 + k * 1.0, yb = SH * (xr + 0.5 - 9 * C) / (4 * C);       // hauteur du gradin
      const ys = Math.max(0, yb - SH * 0.55 / (4 * C));
      for (let y = 30; y <= 41; y++) {
        if (y === 35 || y === 36) continue;     // allée centrale
        const z0 = y * C, z1 = z0 + C;
        for (let s = 0; s < 3; s++) { const zc = z0 + 0.35 + s * 0.66; K.box(PB, xr - 0.05, ys, zc - 0.25, xr + 0.38, ys + 0.42, zc + 0.25, col('#7a2f33')); K.box(PB, xr + 0.3, ys + 0.42, zc - 0.25, xr + 0.42, ys + 0.95, zc + 0.25, col('#6a272b')); }
        K.box(PB, xr - 0.55, ys + 0.72, z0 + 0.02, xr - 0.2, ys + 0.76, z1 - 0.02, col('#c9b38f'));
        K.box(PB, xr - 0.25, ys, z0 + 0.02, xr - 0.2, ys + 0.72, z1 - 0.02, col('#8a6b47'));
      }
    }
    // écran et tableau de l'amphi
    if (A) {
      const xw = 7 * C + 0.03;
      K.face(B('f40'), [xw, 1.0, 33 * C], [xw, 1.0, 39 * C], [xw, 2.6, 39 * C], [xw, 2.6, 33 * C], 1, [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      K.box(PB, xw, 3.0, 31 * C, xw + 0.05, 6.8, 41 * C, col('#f2f2f0'));
      K.box(PB, xw, 6.8, 31 * C - 0.1, xw + 0.15, 6.95, 41 * C + 0.1, col('#2a2f33'));
    }
    // tableaux des salles
    for (const R of I.rooms) if (R.board) {
      const y0 = R.f * SH, xw = R.board < 0 ? R.x0 * C + 0.025 : (R.x1 + 1) * C - 0.025, zc = (R.y0 + 2.5) * C;
      K.face(B('f40'), [xw, y0 + 0.9, zc - 1.8], [xw, y0 + 0.9, zc + 1.8], [xw, y0 + 2.15, zc + 1.8], [xw, y0 + 2.15, zc - 1.8], 1, [-R.board, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      K.box(PB, xw - 0.04, y0 + 0.86, zc - 1.8, xw + 0.04, y0 + 0.9, zc + 1.8, col('#9aa0a4'));
    }
    // ---- escaliers : garde-corps latéraux ----
    for (const s of I.stairs) {
      const xs = s.dx > 0 ? s.x0 * C : (s.x0 + 1) * C, xe = xs + s.dx * 4 * C;
      for (const z of [s.y * C + 0.06, (s.y + 1) * C - 0.06]) { K.bar(PB, [xs, 1.0, z], [xe, SH + 1.0, z], 0.05, 0.05, dark); for (let k = 0; k <= 8; k++) { const t = k / 8, x = xs + (xe - xs) * t, y = SH * t; K.box(PB, x - 0.025, y, z - 0.025, x + 0.025, y + 1.0, z + 0.025, dark); } }
    }
    K.drawRails(m, B, group, { color: '#38424c', top: '#b8bec4', mesh: 'barreaux', meshColor: '#6d7780' });
    // ---- acrotères des toits, équipements techniques ----
    for (let y = 0; y < m.H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (m.t[2][i] !== FLOOR && m.t[1][i] !== FLOOR) continue;
      const f = m.t[2][i] === FLOOR ? 2 : 1, yy = f * SH;
      if (m.t[f][i] !== FLOOR || (f === 1 && m.indoor[1][i])) continue;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < m.H && m.t[f][ny * W + nx] === FLOOR) continue;
        const X = x * C, Z = y * C;
        if (dx === 1) K.box(PB, X + C - 0.22, yy, Z, X + C + 0.02, yy + 0.55, Z + C, col('#cfcdc6'));
        else if (dx === -1) K.box(PB, X - 0.02, yy, Z, X + 0.22, yy + 0.55, Z + C, col('#cfcdc6'));
        else if (dy === 1) K.box(PB, X, yy, Z + C - 0.22, X + C, yy + 0.55, Z + C + 0.02, col('#cfcdc6'));
        else K.box(PB, X, yy, Z - 0.02, X + C, yy + 0.55, Z + 0.22, col('#cfcdc6'));
      }
    }
    for (let k = 0; k < 7; k++) { const x = (12 + k * 5) * C + rng() * 3, z = (7 + rng() * 10) * C; K.box(PB, x, 2 * SH, z, x + 1.8, 2 * SH + 1.1, z + 1.2, col('#9aa1a6')); K.cyl(PB, [x + 0.9, 2 * SH + 1.1, z + 0.6], [x + 0.9, 2 * SH + 1.15, z + 0.6], 0.45, 10, dark, true); }
    for (let k = 0; k < 5; k++) { const x = (12 + k * 8) * C + rng() * 4, z = (30 + rng() * 10) * C; K.box(PB, x, 2 * SH, z, x + 1.4, 2 * SH + 0.9, z + 1.0, col('#9aa1a6')); }
    // ---- parkings : marquage des places, bordures ----
    for (const y0 of I.parkY || []) for (let x = 5; x <= 59; x++) { const X = x * C; line(X - 0.05, y0 * C + 0.2, X + 0.05, (y0 + 2) * C - 0.2, [0.9, 0.9, 0.88]); }
    for (let y = 5; y <= 45; y++) { line(55 * C + 0.2, y * C - 0.05, 57 * C - 0.2, y * C + 0.05, [0.9, 0.9, 0.88]); if (y < 23) line(59 * C + 0.2, y * C - 0.05, 61 * C - 0.2, y * C + 0.05, [0.9, 0.9, 0.88]); }
    for (let x = 6; x <= 58; x += 2) line(x * C, 51 * C - 0.06, x * C + 1.2, 51 * C + 0.06, [0.92, 0.92, 0.9]);
    // ---- clôture du campus, haies et environnement au-delà ----
    const FM = H.Buf(), Wm = W * C, Hm = m.H * C;
    const fence = (a, b) => { K.panel(FM, a, b, 1.9, 1); const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.ceil(L / 2.5); for (let k = 0; k <= n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t; K.box(PB, x - 0.04, 0, z - 0.04, x + 0.04, 2.0, z + 0.04, col('#2f4a3a')); } };
    fence([-0.15, 0, -0.15], [Wm + 0.15, 0, -0.15]); fence([-0.15, 0, Hm + 0.15], [Wm + 0.15, 0, Hm + 0.15]); fence([-0.15, 0, -0.15], [-0.15, 0, Hm + 0.15]); fence([Wm + 0.15, 0, -0.15], [Wm + 0.15, 0, Hm + 0.15]);
    K.addMesh(group, FM, K.meshMat('treillis', '#2f4a3a'));
    if (inst) {
      for (let t = 1; t < Wm; t += 2.2) { H.put(inst, 'city_bush', t, 0, -1.1, rng() * 6, 2.6 + rng()); H.put(inst, 'city_bush', t, 0, Hm + 1.1, rng() * 6, 2.6 + rng()); }
      for (let t = 1; t < Hm; t += 2.2) { H.put(inst, 'city_bush', -1.1, 0, t, rng() * 6, 2.6 + rng()); H.put(inst, 'city_bush', Wm + 1.1, 0, t, rng() * 6, 2.6 + rng()); }
    }
    // sol et route au-delà de la clôture
    const OUT = B('f3'), RD = B('f1');
    const big = (Bf, x0, z0, x1, z1, y) => K.face(Bf, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], 1, [0, 1, 0], 0.5);
    big(OUT, -90, -90, Wm + 90, -2.4, -0.01); big(OUT, -90, Hm + 16, Wm + 90, Hm + 90, -0.01); big(OUT, -90, -2.4, -2.4, Hm + 16, -0.01); big(OUT, Wm + 2.4, -2.4, Wm + 90, Hm + 16, -0.01);
    big(RD, -90, Hm + 2.4, Wm + 90, Hm + 16, -0.005); big(B('f2'), -90, Hm, Wm + 90, Hm + 2.4, -0.008); big(OUT, -2.4, -2.4, Wm + 2.4, 0, -0.012); big(OUT, -2.4, Hm, -0.0, Hm + 2.4, -0.012);
    for (let x = -80; x < Wm + 80; x += 6) line(x, Hm + 9.1, x + 3, Hm + 9.3, [0.92, 0.92, 0.9]);
    // bâtiments voisins du quartier de la Fleuriaye (bureaux, centres de formation), arbres
    const FAC = B('w1o');
    const bldg = (x0, z0, x1, z1, h) => {
      const face = (a, b, out) => { const L = Math.hypot(b[0] - a[0], b[2] - a[2]); K.face(FAC, [a[0], 0, a[2]], [b[0], 0, b[2]], [b[0], h, b[2]], [a[0], h, a[2]], 1, out, [[0, 0], [L / 4, 0], [L / 4, h / SH], [0, h / SH]]); };
      face([x0, 0, z1], [x1, 0, z1], [0, 0, 1]); face([x1, 0, z0], [x0, 0, z0], [0, 0, -1]); face([x0, 0, z0], [x0, 0, z1], [-1, 0, 0]); face([x1, 0, z1], [x1, 0, z0], [1, 0, 0]);
      K.box(PB, x0, h, z0, x1, h + 0.3, z1, col('#6b6863'));
    };
    bldg(-60, -40, -15, -14, 8); bldg(10, -46, 62, -18, 8); bldg(Wm + 14, -20, Wm + 56, 30, 12); bldg(Wm + 16, 46, Wm + 50, 90, 8); bldg(-56, 30, -18, 80, 8); bldg(20, Hm + 24, 80, Hm + 50, 12); bldg(-50, Hm + 26, 4, Hm + 60, 8);
    if (inst) for (let k = 0; k < 70; k++) {
      const side = k % 4, t = rng();
      const x = side === 0 ? -6 - rng() * 8 : side === 1 ? Wm + 6 + rng() * 8 : -20 + t * (Wm + 40), z = side < 2 ? -20 + t * (Hm + 40) : side === 2 ? -6 - rng() * 8 : Hm + 18 + rng() * 5;
      const TB = B('bark'), LB = B('leaf');
      K.cyl(TB, [x, 0, z], [x, 3, z], 0.22, 6, [0.32, 0.24, 0.16]);
      for (let j = 0; j < 4; j++) H.icoBlob(LB, x + (rng() - 0.5) * 1.6, 3.6 + rng() * 1.8, z + (rng() - 0.5) * 1.6, 1.2 + rng() * 0.6, K.col('#3b5e30'), 1, 1);
    }
    // ---- signalétique ----
    const S = K.signs();
    S.add({ text: 'HALL TECHNOLOGIQUE', sub: 'Génie Mécanique et Productique', bg: '#1e2f45', fg: '#f0f3f6', w: 6, h: 1.5, x: 28.5 * C + 1, y: 6.0, z: 4 * C - 0.04, ry: Math.PI });
    S.add({ text: 'IUT DE NANTES', sub: 'Bâtiment A — Enseignement', bg: '#1e2f45', fg: '#f0f3f6', w: 5, h: 1.25, x: 34 * C, y: 6.3, z: 44 * C + 0.04, ry: 0 });
    S.add({ text: 'HALL TECHNOLOGIQUE', sub: 'Génie Mécanique et Productique', bg: '#1e2f45', fg: '#f0f3f6', w: 5, h: 1.25, x: 27 * C, y: 6.0, z: 22 * C + 0.04, ry: 0 });
    for (const z of I.hallZones || []) S.add({ text: z.name, sub: z.sub, bg: '#2c3e50', fg: '#ffffff', w: 3.2, h: 0.8, x: ((z.x0 + z.x1) / 2 + 0.5) * C, y: 5.2, z: 5 * C + 0.05, ry: 0 });
    S.add({ text: 'PORT DES LUNETTES OBLIGATOIRE', bg: '#1f5fa8', fg: '#ffffff', w: 2.4, h: 0.6, x: 20 * C, y: 2.6, z: 21 * C - 0.04, ry: Math.PI });
    S.add({ text: 'CHAUSSURES DE SÉCURITÉ OBLIGATOIRES', bg: '#1f5fa8', fg: '#ffffff', w: 2.4, h: 0.6, x: 33 * C, y: 2.6, z: 21 * C - 0.04, ry: Math.PI });
    S.add({ text: 'DANGER — PONT ROULANT', bg: '#e3b322', fg: '#1a1a1a', w: 2.0, h: 0.5, x: 47 * C - 0.04, y: 3.0, z: 15 * C, ry: -Math.PI / 2 });
    for (const R of I.rooms) {
      const L = { metrologie: 'MÉTROLOGIE', magasin: 'MAGASIN OUTILLAGE', essais: 'ESSAIS MÉCANIQUES', automatisme: 'AUTOMATISME', td: 'SALLE ' + R.num, cao: 'CAO — ' + R.num, tp_rdm: 'TP RDM — ' + R.num, tp_auto: 'TP AUTOMATISMES', cafet: 'CAFÉTÉRIA', profs: 'SALLE DES ENSEIGNANTS', admin: 'SCOLARITÉ', cdi: 'BIBLIOTHÈQUE', bde: 'BDE' }[R.type];
      if (!L || R.door == null) continue;
      const zf = R.side === 'N' ? (R.front + 1) * C + 0.03 : R.front * C - 0.03;
      const wx = m.t[R.f][R.front * W + R.door - 1] === WALL ? R.door - 1 : R.door + 1;     // sur le mur à côté de la porte
      S.add({ text: L, bg: '#f2f2ee', fg: '#1e2f45', w: 1.5, h: 0.38, x: (wx + 0.5) * C, y: R.f * SH + 2.0, z: zf, ry: R.side === 'N' ? 0 : Math.PI });
    }
    S.add({ text: 'AMPHI A', sub: 'Amphithéâtre', bg: '#f2f2ee', fg: '#1e2f45', w: 1.6, h: 0.42, x: 20 * C + 0.03, y: 2.2, z: 34.5 * C, ry: Math.PI / 2 });
    S.add({ text: 'AMPHI A', sub: 'Haut de l\'amphi', bg: '#f2f2ee', fg: '#1e2f45', w: 1.6, h: 0.42, x: 20 * C + 0.03, y: SH + 2.2, z: 34.5 * C, ry: Math.PI / 2 });
    S.add({ text: 'LOGE — PORTAIL', sub: 'Sortie du campus', bg: '#1e2f45', fg: '#f0f3f6', w: 2.0, h: 0.5, x: 4 * C + 0.04, y: 2.0, z: 50.2 * C, ry: Math.PI / 2 });
    S.add({ text: 'SORTIE', bg: '#0d7a3a', fg: '#ffffff', w: 1.2, h: 0.4, x: 4 * C + 0.05, y: 3.25, z: 51.5 * C, ry: Math.PI / 2, glow: true, arrow: -1 });
    // issues de secours : panneau vert sur le linteau (côté intérieur)
    for (const d of I.doors) if (d.out && d.f === 0) {
      const isOut = (x, y) => I.doors.some(o => o.out && o.f === 0 && o.x === x && o.y === y);
      for (const [dx, dy] of D4) {
        const j = (d.y + dy) * W + d.x + dx; if (!m.indoor[0][j] || m.t[0][j] === WALL || isOut(d.x + dx, d.y + dy)) continue;
        const along = dx ? [0, 1] : [1, 0];
        if (isOut(d.x - along[0], d.y - along[1])) break;       // un seul panneau par ouverture (sur la première case)
        const fx = (d.x + 0.5 + dx * 0.5) * C + dx * 0.03, fz = (d.y + 0.5 + dy * 0.5) * C + dy * 0.03;
        let n = 1; while (I.doors.some(o => o.out && o.x === d.x + along[0] * n && o.y === d.y + along[1] * n)) n++;
        S.add({ text: 'SORTIE', bg: '#0d7a3a', fg: '#fff', w: 0.9, h: 0.26, x: fx + along[0] * (n - 1) * C / 2, y: 3.86, z: fz + along[1] * (n - 1) * C / 2, ry: dx ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dy > 0 ? 0 : Math.PI), glow: true });
        break;
      }
    }
    S.build(group);
    // ---- mobilier et machines ----
    const fur = BR.Maps2 && BR.Maps2.halle6 && BR.Maps2.halle6.furniture;
    for (const p of m.props) if (p.sub) { if (!machine(p, B, PB, inst, H, rng, group) && fur) fur(p, B, PB, inst, H, rng); }
  }

  // doublage : quad intérieur devant chaque face de mur extérieur tournée vers une pièce
  function lining(m, B, pairs) {
    const W = m.W;
    for (let f = 0; f < m.F; f++) for (let y = 0; y < m.H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (m.t[f][i] !== WALL) continue;
      const zin = pairs[m.zone[f][i]]; if (zin == null) continue;
      const bot = f === 0 ? 0 : f * SH - SLAB, top = (f + 1) * SH, e = 0.012, v0 = bot / SH, v1 = top / SH;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= m.H) continue;
        const j = ny * W + nx; if (m.t[f][j] === WALL || !m.indoor[f][j]) continue;
        const X0 = x * C, X1 = X0 + C, Z0 = y * C, Z1 = Z0 + C, Bf = B('w' + zin + 'i');
        if (dx === 1) K.face(Bf, [X1 + e, bot, Z1], [X1 + e, bot, Z0], [X1 + e, top, Z0], [X1 + e, top, Z1], 0.92, [1, 0, 0], [[Z1 / 4, v0], [Z0 / 4, v0], [Z0 / 4, v1], [Z1 / 4, v1]]);
        else if (dx === -1) K.face(Bf, [X0 - e, bot, Z0], [X0 - e, bot, Z1], [X0 - e, top, Z1], [X0 - e, top, Z0], 0.92, [-1, 0, 0], [[Z0 / 4, v0], [Z1 / 4, v0], [Z1 / 4, v1], [Z0 / 4, v1]]);
        else if (dy === 1) K.face(Bf, [X0, bot, Z1 + e], [X1, bot, Z1 + e], [X1, top, Z1 + e], [X0, top, Z1 + e], 0.92, [0, 0, 1], [[X0 / 4, v0], [X1 / 4, v0], [X1 / 4, v1], [X0 / 4, v1]]);
        else K.face(Bf, [X1, bot, Z0 - e], [X0, bot, Z0 - e], [X0, top, Z0 - e], [X1, top, Z0 - e], 0.92, [0, 0, -1], [[X1 / 4, v0], [X0 / 4, v0], [X0 / 4, v1], [X1 / 4, v1]]);
      }
    }
  }

  // machines-outils et équipements du hall (renvoie false si ce n'est pas un objet de cette carte)
  function machine(p, B, PB, inst, H, rng, group) {
    const col = K.col, b = p.base, ry = p.ry || 0;
    // machines sur deux cases : dessinées une seule fois, centrées entre les deux
    const two = p.sub === 'tour' || p.sub === 'tourcn' || p.sub === 'centre';
    if (two && p.v === 1) return true;
    const x = two ? p.x + 1 : p.x, z = p.z;
    const R = (lx0, y0, lz0, lx1, y1, lz1, c) => K.rbox(PB, x, z, ry, lx0, b + y0, lz0, lx1, b + y1, lz1, c);
    const Rg = (lx0, y0, lz0, lx1, y1, lz1, c) => K.rbox(B('glow'), x, z, ry, lx0, b + y0, lz0, lx1, b + y1, lz1, c);
    const L = (lx, ly, lz) => { const c = Math.cos(ry), s = Math.sin(ry); return [x + lx * c + lz * s, b + ly, z - lx * s + lz * c]; };
    const cylL = (a, c2, r, seg, cc, caps) => K.cyl(PB, L(...a), L(...c2), r, seg, typeof cc === 'string' ? col(cc) : cc, caps);
    const wheel = (cx, cy, cz, ax, r) => { const a = [cx, cy, cz], e = [cx + ax[0] * 0.04, cy + ax[1] * 0.04, cz + ax[2] * 0.04]; cylL(a, e, r, 10, '#b9bcbf', true); cylL(e, [e[0] + ax[0] * 0.12, e[1] + ax[1] * 0.12, e[2] + ax[2] * 0.12], 0.015, 5, '#2a2a2a'); };
    const screen = (lx0, ly0, lx1, ly1, lz) => { const a = L(lx0, ly0, lz), bb = L(lx1, ly0, lz), c = L(lx1, ly1, lz), d = L(lx0, ly1, lz); K.face(B('f42'), a, bb, c, d, 1, [Math.sin(ry) * Math.sign(lz || 1), 0, Math.cos(ry) * Math.sign(lz || 1)], [[0, 0], [1, 0], [1, 1], [0, 1]]); };
    switch (p.sub) {
      case 'tour': {           // tour parallèle conventionnel (≈ 2,6 m), vert machine-outil
        const g = '#5d7a6c', gd = '#4b6458';
        R(-1.45, 0, -0.38, -0.85, 0.85, 0.38, g); R(0.75, 0, -0.33, 1.3, 0.85, 0.33, g);          // pieds-armoires
        R(-1.5, 0.85, -0.45, 1.35, 0.92, 0.5, '#8f9596');                                            // bac à copeaux
        R(-1.3, 0.92, -0.25, 1.3, 1.12, 0.22, gd);                                                   // banc
        R(-1.3, 1.12, -0.24, 1.3, 1.15, 0.21, '#a9aeb0');                                            // glissières
        R(-1.45, 0.92, -0.42, -0.75, 1.55, 0.36, g); R(-1.45, 1.55, -0.32, -0.95, 1.62, 0.28, gd);   // poupée fixe
        R(-0.73, 1.42, 0.37, -0.72, 1.52, 0.38, '#222');
        cylL([-0.75, 1.32, 0], [-0.62, 1.32, 0], 0.17, 12, '#9da3a6', true);                         // mandrin
        for (let k = 0; k < 3; k++) { const a = k * 2.094; R(-0.62, 1.32 + Math.sin(a) * 0.13 - 0.025, Math.cos(a) * 0.13 - 0.025, -0.56, 1.32 + Math.sin(a) * 0.13 + 0.025, Math.cos(a) * 0.13 + 0.025, '#6d7275'); }
        cylL([-0.62, 1.32, 0], [-0.1, 1.32, 0], 0.035, 8, '#c9cdd0');                                // pièce
        R(-0.25, 1.12, -0.4, 0.15, 1.3, 0.32, gd); R(-0.18, 1.3, -0.16, 0.1, 1.38, 0.14, g); R(-0.08, 1.38, -0.06, 0.04, 1.46, 0.06, '#3a3a3a');   // chariot, porte-outil
        R(-0.24, 1.0, 0.32, 0.12, 1.12, 0.46, gd); wheel(-0.06, 1.05, 0.46, [0, 0, 1], 0.08);         // tablier + volant
        R(0.75, 1.12, -0.17, 1.15, 1.42, 0.17, g); cylL([0.75, 1.32, 0], [0.62, 1.32, 0], 0.03, 6, '#c9cdd0'); wheel(1.15, 1.3, 0, [1, 0, 0], 0.07);   // contre-pointe
        cylL([-0.8, 0.98, 0.43], [1.25, 0.98, 0.43], 0.012, 5, '#c9cdd0'); cylL([-0.8, 0.94, 0.43], [1.25, 0.94, 0.43], 0.012, 5, '#c9cdd0');   // vis-mère, barre de chariotage
        R(-1.5, 0.92, -0.46, 1.35, 1.65, -0.43, '#b9bdbf');                                           // dosseret
        R(-1.42, 1.25, 0.36, -1.0, 1.45, 0.38, '#2a2a2a'); R(-1.15, 1.32, 0.38, -1.05, 1.4, 0.4, '#c43b2d');   // pupitre, arrêt d'urgence
        cylL([-0.9, 1.62, -0.25], [-0.6, 2.05, -0.1], 0.015, 5, '#222'); cylL([-0.6, 2.05, -0.1], [-0.45, 1.85, 0.05], 0.05, 8, '#2a2a2a');   // lampe de machine
        return true;
      }
      case 'tourcn': {         // tour à commande numérique (carénage, porte vitrée, pupitre)
        R(-1.4, 0, -0.75, 1.4, 0.35, 0.75, '#3f4549');
        R(-1.4, 0.35, -0.75, 1.4, 1.95, 0.7, '#d9dcdf'); R(-1.4, 1.95, -0.75, 1.4, 2.05, 0.7, '#3f4549');
        R(-0.9, 0.85, 0.7, 0.5, 1.75, 0.73, '#2f3a44'); R(-0.85, 0.9, 0.73, 0.45, 1.7, 0.74, '#5d7486');   // porte + vitre
        R(0.55, 0.9, 0.7, 1.35, 1.85, 0.8, '#2f3539'); screen(0.62, 1.4, 1.28, 1.78, 0.805);
        R(-1.4, 0.35, 0.7, -0.95, 0.9, 0.95, '#3f4549');                                              // convoyeur à copeaux
        cylL([1.2, 2.05, -0.5], [1.2, 2.35, -0.5], 0.02, 5, '#333'); for (const [c, h] of [['#d0392b', 2.35], ['#f0a020', 2.45], ['#2fa84a', 2.55]]) cylL([1.2, h, -0.5], [1.2, h + 0.1, -0.5], 0.045, 8, c, true);
        return true;
      }
      case 'centre': {         // centre d'usinage vertical
        R(-1.6, 0, -0.85, 1.6, 0.4, 0.85, '#3f4549');
        R(-1.6, 0.4, -0.85, 1.6, 2.35, 0.8, '#dfe1e3'); R(-1.6, 2.35, -0.85, 1.6, 2.5, 0.8, '#3f4549'); R(-1.6, 1.9, 0.8, 1.6, 2.0, 0.82, '#3a6ea5');
        R(-1.1, 0.75, 0.8, 0.6, 1.85, 0.83, '#2f3a44'); R(-1.05, 0.95, 0.83, 0.55, 1.75, 0.84, '#56728a');   // porte coulissante vitrée
        R(-0.3, 1.0, 0.84, -0.22, 1.5, 0.88, '#bfc3c6');
        R(0.75, 0.85, 0.8, 1.55, 2.0, 0.92, '#2f3539'); screen(0.82, 1.45, 1.48, 1.92, 0.925); R(0.82, 0.95, 0.92, 1.48, 1.35, 0.93, '#40474d');
        for (let k = 0; k < 12; k++) R(0.86 + (k % 4) * 0.15, 1.0 + Math.floor(k / 4) * 0.11, 0.93, 0.96 + (k % 4) * 0.15, 1.07 + Math.floor(k / 4) * 0.11, 0.94, '#9aa3ab');
        R(-1.6, 0.4, -1.0, -0.9, 1.3, -0.85, '#3f4549'); R(1.0, 0.4, -1.0, 1.6, 2.1, -0.85, '#5d6670');   // convoyeur, armoire électrique
        cylL([1.45, 2.5, -0.6], [1.45, 2.8, -0.6], 0.02, 5, '#333'); for (const [c, h] of [['#d0392b', 2.8], ['#f0a020', 2.9], ['#2fa84a', 3.0]]) cylL([1.45, h, -0.6], [1.45, h + 0.1, -0.6], 0.045, 8, c, true);
        Rg(-1.0, 1.0, 0.845, 0.5, 1.02, 0.85, [0.9, 0.95, 1]);
        return true;
      }
      case 'fraiseuse': {      // fraiseuse universelle (bâti, console, table, tête)
        const g = '#55707f', gd = '#465d69';
        R(-0.45, 0, -0.7, 0.45, 0.12, 0.25, gd); R(-0.35, 0.12, -0.7, 0.35, 1.75, -0.2, g);             // socle, bâti
        R(-0.3, 1.75, -0.65, 0.3, 2.0, 0.45, g); cylL([0, 1.75, 0.3], [0, 1.45, 0.3], 0.09, 10, gd, true); cylL([0, 1.45, 0.3], [0, 1.32, 0.3], 0.025, 6, '#ccc');   // tête, broche, fraise
        R(-0.3, 0.55, -0.2, 0.3, 1.0, 0.3, g); R(-0.3, 1.0, -0.15, 0.3, 1.1, 0.45, gd);                // console, chariot
        R(-0.8, 1.1, 0.12, 0.8, 1.2, 0.5, '#7d8b93'); for (let k = 0; k < 3; k++) R(-0.8, 1.2, 0.17 + k * 0.12, 0.8, 1.205, 0.2 + k * 0.12, '#3a3a3a');   // table rainurée
        R(-0.12, 1.2, 0.22, 0.12, 1.3, 0.4, '#2f3539');                                                 // étau
        wheel(0.8, 1.15, 0.31, [1, 0, 0], 0.08); wheel(-0.8, 1.15, 0.31, [-1, 0, 0], 0.08); wheel(0, 0.8, 0.3, [0, 0, 1], 0.08);
        cylL([0, 0.12, 0.05], [0, 0.55, 0.05], 0.05, 8, '#9aa3ab');
        R(0.35, 1.2, -0.5, 0.42, 1.6, -0.3, '#2a2a2a'); R(0.42, 1.45, -0.45, 0.44, 1.52, -0.38, '#c43b2d');
        return true;
      }
      case 'perceuse': {       // perceuse à colonne
        R(-0.35, 0, -0.35, 0.35, 0.1, 0.35, '#5a6b5f'); cylL([0, 0.1, -0.2], [0, 1.85, -0.2], 0.06, 10, '#a9aeb0');
        R(-0.25, 0.75, -0.3, 0.25, 0.8, 0.2, '#5a6b5f'); R(-0.2, 1.45, -0.32, 0.22, 1.9, 0.25, '#5a6b5f'); cylL([0.05, 1.45, 0.08], [0.05, 1.3, 0.08], 0.03, 6, '#ccc');
        for (let k = 0; k < 3; k++) { const a = k * 2.094; cylL([0.22, 1.6, 0], [0.22 + Math.cos(a) * 0.01 + 0.05, 1.6 + Math.sin(a) * 0.25, Math.cos(a) * 0.25], 0.012, 4, '#222'); }
        return true;
      }
      case 'scie': { R(-0.85, 0, -0.35, 0.85, 0.75, 0.35, '#c8732b'); R(-0.6, 0.75, -0.2, 0.6, 0.85, 0.25, '#555'); R(-0.5, 0.85, -0.12, 0.5, 1.45, -0.02, '#c8732b'); cylL([-0.4, 1.0, 0.05], [0.4, 1.0, 0.05], 0.015, 4, '#ddd'); R(0.85, 0.7, -0.2, 1.6, 0.75, 0.2, '#888'); return true; }
      case 'rectifieuse': { R(-0.85, 0, -0.6, 0.85, 0.95, 0.6, '#6b7f8c'); R(-0.7, 0.95, -0.1, 0.7, 1.02, 0.5, '#9aa3ab'); R(-0.25, 0.95, -0.6, 0.25, 1.75, -0.15, '#6b7f8c'); cylL([0, 1.25, -0.15], [0, 1.25, 0.08], 0.18, 14, '#c9cdd0', true); R(-0.2, 1.3, -0.15, 0.2, 1.48, 0.12, '#576a75'); return true; }
      case 'etabli': {
        R(-0.95, 0.85, -0.4, 0.95, 0.92, 0.4, '#a57a4c'); for (const s of [-1, 1]) R(s * 0.95 - (s > 0 ? 0.08 : 0), 0, -0.4, s * 0.95 + (s < 0 ? 0.08 : 0), 0.85, 0.4, '#3a5f8a');
        R(-0.95, 0.2, -0.4, 0.95, 0.24, 0.4, '#3a5f8a'); R(0.45, 0.92, -0.12, 0.8, 1.08, 0.12, '#3a6ea5'); R(0.5, 1.08, -0.08, 0.75, 1.12, 0.08, '#2a2f33');   // étau
        R(-0.95, 0.92, -0.4, 0.95, 1.9, -0.37, '#a9aeb0'); for (let k = 0; k < 9; k++) R(-0.85 + k * 0.2, 1.25 + (k % 3) * 0.15, -0.37, -0.82 + k * 0.2, 1.5 + (k % 3) * 0.15, -0.34, '#2b2f33');
        return true;
      }
      case 'armoireoutils': { R(-0.6, 0, -0.3, 0.6, p.h, 0.3, '#b8312b'); for (let k = 0; k < 6; k++) R(-0.55, 0.1 + k * 0.28, 0.3, 0.55, 0.32 + k * 0.28, 0.31, '#a32a25'); return true; }
      case 'servante': { R(-0.45, 0.1, -0.28, 0.45, 0.95, 0.28, '#b8312b'); for (let k = 0; k < 5; k++) R(-0.4, 0.2 + k * 0.15, 0.28, 0.4, 0.32 + k * 0.15, 0.29, '#9a2621'); for (const [u, v] of [[-0.38, -0.22], [0.38, -0.22], [-0.38, 0.22], [0.38, 0.22]]) cylL([u, 0, v], [u, 0.1, v], 0.04, 6, '#222'); return true; }
      case 'bacs': { R(-0.65, 0, -0.45, 0.65, 0.75, 0.45, '#3a5f8a'); R(-0.6, 0.6, -0.4, 0.6, 0.72, 0.4, '#8c8f91'); return true; }
      case 'cellule': {        // cellule robotisée : robot 6 axes dans un enclos grillagé (2×2 cases)
        if (p.v !== 0) return true;
        const cx = p.x + 1, cz = p.z + 1, Bm = H.Buf();
        const pts = [[cx - 1.9, cz - 1.9], [cx + 1.9, cz - 1.9], [cx + 1.9, cz + 1.9], [cx - 1.9, cz + 1.9]];
        for (let k = 0; k < 4; k++) { const a = pts[k], c = pts[(k + 1) % 4]; K.panel(Bm, [a[0], b + 0.1, a[1]], [c[0], b + 0.1, c[1]], 1.9, 0.5); K.box(PB, a[0] - 0.04, b, a[1] - 0.04, a[0] + 0.04, b + 2.0, a[1] + 0.04, col('#e3b322')); }
        K.addMesh(group, Bm, K.meshMat('treillis', '#e3b322'));
        K.box(PB, cx - 0.4, b, cz - 0.4, cx + 0.4, b + 0.5, cz + 0.4, col('#3a3f44'));
        const o = col('#e8892b'), base = b + 0.5;
        K.cyl(PB, [cx, base, cz], [cx, base + 0.3, cz], 0.25, 14, o, true);
        const s1 = [cx + 0.2, base + 1.2, cz + 0.1], s2 = [cx + 0.9, base + 1.05, cz + 0.4];
        K.bar(PB, [cx, base + 0.3, cz], s1, 0.2, 0.2, o); K.bar(PB, s1, s2, 0.15, 0.15, o); K.cyl(PB, s2, [s2[0] + 0.05, s2[1] - 0.35, s2[2]], 0.06, 8, col('#2b2f33'), true);
        K.box(PB, cx + 0.6, b, cz - 1.2, cx + 1.4, b + 0.8, cz - 0.6, col('#9aa3ab'));
        return true;
      }
      case 'mmt': {            // machine à mesurer tridimensionnelle : marbre granit + portique + palpeur
        R(-0.95, 0, -0.9, 0.95, 0.75, 0.9, '#3a3d40'); R(-0.95, 0.75, -0.9, 0.95, 0.95, 0.9, '#4a4c4e');
        for (const s of [-1, 1]) R(s * 0.85 - 0.06, 0.95, -0.5, s * 0.85 + 0.06, 2.0, -0.35, '#d9dcdf');
        R(-0.92, 2.0, -0.55, 0.92, 2.15, -0.3, '#d9dcdf'); R(-0.1, 1.45, -0.5, 0.12, 2.25, -0.3, '#c43b2d'); cylL([0.01, 1.45, -0.4], [0.01, 1.25, -0.4], 0.012, 5, '#222'); cylL([0.01, 1.25, -0.4], [0.01, 1.23, -0.4], 0.02, 6, '#d33', true);
        R(-0.3, 0.95, 0.1, 0.3, 1.05, 0.35, '#8a8f93');
        return true;
      }
      case 'marbre': { R(-0.85, 0, -0.5, 0.85, 0.75, 0.5, '#5a5d5f'); R(-0.85, 0.75, -0.5, 0.85, 0.88, 0.5, '#2f3133'); R(-0.2, 0.88, -0.1, 0.0, 1.1, 0.1, '#bfc3c6'); return true; }
      case 'traction': { R(-0.6, 0, -0.4, 0.6, 0.6, 0.4, '#3a6ea5'); for (const s of [-0.4, 0.4]) cylL([s, 0.6, 0], [s, 2.3, 0], 0.05, 8, '#c9cdd0'); R(-0.55, 1.5, -0.15, 0.55, 1.65, 0.15, '#3a6ea5'); R(-0.55, 2.25, -0.2, 0.55, 2.4, 0.2, '#3a6ea5'); R(0.7, 0.72, -0.2, 1.1, 1.0, 0.1, '#2a2f33'); return true; }
      case 'maquette': { R(-0.9, 0, -0.45, 0.9, 0.85, 0.45, '#9aa3ab'); R(-0.9, 0.85, -0.45, 0.9, 1.55, -0.38, '#e8e8e4'); for (let k = 0; k < 8; k++) R(-0.8 + k * 0.2, 1.1, -0.38, -0.68 + k * 0.2, 1.3, -0.35, ['#3a6ea5', '#2a2f33', '#5d7486'][k % 3]); Rg(-0.8, 1.35, -0.375, 0.8, 1.38, -0.37, [0.3, 1, 0.5]); R(-0.5, 0.85, -0.1, 0.2, 1.0, 0.25, '#4c6a3d'); return true; }
      case 'armoireelec': { R(-0.5, 0, -0.25, 0.5, p.h, 0.25, '#c9ccce'); R(-0.02, 0.1, 0.25, 0.02, p.h - 0.1, 0.26, '#888'); Rg(-0.35, 1.6, 0.25, -0.25, 1.68, 0.26, [0.3, 1, 0.4]); return true; }
      case 'bancrdm': { R(-0.9, 0.85, -0.4, 0.9, 0.9, 0.4, '#d8d2c4'); for (const s of [-1, 1]) R(s * 0.9 - (s > 0 ? 0.06 : 0), 0, -0.4, s * 0.9 + (s < 0 ? 0.06 : 0), 0.85, 0.4, '#45494d'); R(-0.7, 0.9, -0.1, 0.7, 0.98, 0.1, '#3a6ea5'); for (const s of [-0.6, 0.6]) R(s - 0.05, 0.98, -0.15, s + 0.05, 1.45, 0.15, '#3a6ea5'); R(-0.15, 1.3, -0.1, 0.15, 1.42, 0.1, '#c43b2d'); return true; }
      case 'distributeur': { const c = ['#c43b2d', '#2f5f9a', '#2b2f33'][p.v % 3]; R(-0.45, 0, -0.38, 0.45, 1.85, 0.38, c); R(-0.38, 0.6, 0.38, 0.2, 1.7, 0.39, '#1a1d20'); Rg(-0.36, 0.62, 0.39, 0.18, 1.68, 0.395, [0.85, 0.9, 1]); R(0.25, 1.1, 0.38, 0.38, 1.5, 0.4, '#555'); return true; }
      case 'tableronde': { K.cyl(PB, [p.x, b + 0.72, p.z], [p.x, b + 0.76, p.z], 0.55, 14, col('#e8e5de'), true); K.cyl(PB, [p.x, b, p.z], [p.x, b + 0.72, p.z], 0.04, 8, col('#2b2f33')); if (inst) for (let k = 0; k < 3; k++) { const a = k * 2.1; H.put(inst, 'furn_chair_A', p.x + Math.cos(a) * 0.8, b, p.z + Math.sin(a) * 0.8, -a - Math.PI / 2, 0.72); } return true; }
      case 'babyfoot': { R(-0.7, 0.55, -0.4, 0.7, 0.9, 0.4, '#3a6e3a'); R(-0.7, 0.88, -0.4, 0.7, 0.92, 0.4, '#5a3c22'); for (const s of [-1, 1]) for (const t of [-1, 1]) R(s * 0.6 - 0.05, 0, t * 0.3 - 0.05, s * 0.6 + 0.05, 0.55, t * 0.3 + 0.05, '#5a3c22'); for (let k = 0; k < 8; k++) cylL([-0.6 + k * 0.17, 0.82, -0.55], [-0.6 + k * 0.17, 0.82, 0.55], 0.012, 4, '#ccc'); return true; }
      case 'lutrin': { R(-0.35, 0, -0.5, 0.35, 1.05, 0.5, '#8a6b47'); R(-0.4, 1.05, -0.55, 0.4, 1.12, 0.55, '#6b5235'); R(-0.15, 1.12, -0.2, 0.15, 1.35, -0.17, '#1a1c1e'); return true; }
      case 'vitrine': { R(-0.5, 0, -0.8, 0.5, 0.8, 0.8, '#d9d6cf'); R(-0.48, 0.8, -0.78, 0.48, 1.75, 0.78, '#9fb7c4'); for (let k = 0; k < 4; k++) cylL([-0.2 + (k % 2) * 0.3, 0.82, -0.5 + k * 0.3], [-0.2 + (k % 2) * 0.3, 0.98 + k * 0.03, -0.5 + k * 0.3], 0.05 + (k % 3) * 0.02, 10, '#b9bec2', true); return true; }
      case 'casiers': { R(-0.9, 0, -0.25, 0.9, 1.9, 0.25, '#4f6f8f'); for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) R(-0.88 + k * 0.3, 0.05 + j * 0.62, 0.25, -0.62 + k * 0.3, 0.6 + j * 0.62, 0.26, '#5c7fa3'); return true; }
      case 'velos': {
        if (p.v === 0) { const x0 = p.x - 1, x1 = p.x + 9; K.box(PB, x0, 2.3, p.z - 1.0, x1, 2.4, p.z + 1.0, col('#6d7780')); for (const xx of [x0 + 0.1, x1 - 0.1]) for (const zz of [p.z - 0.9, p.z + 0.9]) K.box(PB, xx - 0.05, 0, zz - 0.05, xx + 0.05, 2.3, zz + 0.05, col('#6d7780')); }
        for (let k = 0; k < 2; k++) { const xx = p.x - 0.5 + k; K.cyl(PB, [xx, b + 0.35, p.z - 0.55], [xx, b + 0.35, p.z - 0.5], 0.33, 12, col('#222')); K.cyl(PB, [xx, b + 0.35, p.z + 0.5], [xx, b + 0.35, p.z + 0.55], 0.33, 12, col('#222')); K.bar(PB, [xx, b + 0.35, p.z - 0.5], [xx, b + 0.75, p.z + 0.1], 0.04, 0.04, col(BR.pick(['#b8312f', '#2d5f9a', '#3c7a3c', '#e0b000'], rng))); K.bar(PB, [xx, b + 0.75, p.z + 0.1], [xx, b + 0.35, p.z + 0.5], 0.04, 0.04, col('#555')); }
        return true;
      }
      case 'poteau': { K.box(PB, p.x - 0.15, b, p.z - 0.15, p.x + 0.15, b + 3.7, p.z + 0.15, col('#5d6670')); return true; }
      case 'totem': { K.box(PB, p.x - 0.7, b, p.z - 0.18, p.x + 0.7, b + 2.6, p.z + 0.18, col('#1e2f45')); K.face(B('f43'), [p.x - 0.65, b + 1.0, p.z + 0.185], [p.x + 0.65, b + 1.0, p.z + 0.185], [p.x + 0.65, b + 2.5, p.z + 0.185], [p.x - 0.65, b + 2.5, p.z + 0.185], 1, [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]); return true; }
      default: return false;
    }
  }

  BR.World.gens.iut = genIUT;
  BR.World.decor.iut = decorIUT;
  BR.Maps2 = BR.Maps2 || {}; BR.Maps2.iut = { gen: genIUT };
})();

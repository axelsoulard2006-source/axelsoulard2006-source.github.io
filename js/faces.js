/* ===== faces.js : repère les yeux et la bouche sur les images de monstres (pour les effets d'horreur)
   1) données déjà présentes dans monsters.js (visages.json)  2) cache local  3) détection automatique
   (MediaPipe, chargé depuis Internet ; sans connexion, les entités gardent les autres effets) ===== */
(function () {
  const BR = window.BR;
  const F = (BR.Faces = {});
  const V = '0.10.14';
  F.run = async function () {
    const E = BR.Ent, need = [];
    const cache = BR.store.get('br_faces', {});
    E.sprites.forEach((s, i) => {
      if (s.face || s.kind !== 'img') return;
      if (cache[s.key] !== undefined) { if (cache[s.key]) E.setFace(i, E.parseFace(cache[s.key])); return; }
      need.push(i);
    });
    if (!need.length) return 0;
    let det = null;
    try {
      const vision = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/wasm`);
      det = await vision.FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
        runningMode: 'IMAGE', minDetectionConfidence: 0.35,
      });
    } catch (e) { console.warn('Détection des visages indisponible (hors ligne ?)', e); return 0; }
    let n = 0;
    for (const i of need) {
      const s = E.sprites[i], src = s.canvas;
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0);
      let f = 0;
      try {
        const r = det.detect(c);
        const d = r && r.detections && r.detections[0];
        if (d && d.keypoints && d.keypoints.length >= 4) {
          const k = d.keypoints, bw = d.boundingBox ? d.boundingBox.width / c.width : Math.abs(k[0].x - k[1].x) * 2.4;
          f = [k[0].x, k[0].y, k[1].x, k[1].y, k[3].x, k[3].y, bw].map(v => Math.round(v * 1000) / 1000);
          E.setFace(i, E.parseFace(f)); n++;
        }
      } catch (e) { f = 0; }
      cache[s.key] = f;
    }
    BR.store.set('br_faces', cache);
    try { det.close(); } catch (e) {}
    return n;
  };
  // pour l'outil de préparation : visages détectés, par nom d'image
  F.export = () => { const o = {}; BR.Ent.sprites.forEach(s => { if (s.face) o[s.name] = [s.face.l[0], s.face.l[1], s.face.r[0], s.face.r[1], s.face.m[0], s.face.m[1], s.face.w]; }); return o; };
})();

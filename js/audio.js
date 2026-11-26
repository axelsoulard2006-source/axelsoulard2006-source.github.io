/* ===== audio.js : sons 100 % synthétisés (Web Audio) ===== */
(function () {
  const BR = window.BR;
  let ctx = null, master, sfx, amb, musB, muffle, noiseBuf, ready = false;
  let revIn, revG, echoG, rainBuf = null;   // réverbération (intérieur) et écho (rues) : envois depuis le bus des effets
  let duckG = null, duckK = 1, posOverride = null;   // « silence total » (frayeurs) ; position 3D imposée aux sons d'un bruitage
  const vol = { master: 0.8, sfx: 1, amb: 0.8, mus: 0.6 };
  const A = (BR.Audio = {});

  A.setVolumes = function (m, s, a, mu) {
    if (m != null) vol.master = m; if (s != null) vol.sfx = s; if (a != null) vol.amb = a; if (mu != null) vol.mus = mu;
    musicTick();
    if (!ctx) return;
    master.gain.value = vol.master; sfx.gain.value = vol.sfx; amb.gain.value = vol.amb; musB.gain.value = vol.mus * 0.9;
  };

  A.unlock = function () {
    ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    ready = true;
    musicTick();
  };
  // contexte créé tôt (sans son tant que le joueur n'a pas cliqué) pour décoder les échantillons au chargement
  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      master = ctx.createGain(); sfx = ctx.createGain(); amb = ctx.createGain(); musB = ctx.createGain();
      sfx.connect(master); amb.connect(master); musB.connect(master);
      // « assourdissement » (mort, choc) : filtre passe-bas global, grand ouvert d'habitude
      muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 22000; muffle.Q.value = 0.4;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.2;
      // écrêtage doux de sécurité après le compresseur : un son très fort ne sature jamais la sortie
      const clip = ctx.createWaveShaper(), cv = new Float32Array(1024);
      for (let i = 0; i < cv.length; i++) { const x = (i / (cv.length - 1)) * 2 - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a < 0.75 ? a : 0.75 + 0.22 * Math.tanh((a - 0.75) / 0.22)); }
      clip.curve = cv;
      // « silence » : gain global abaissé pendant les frayeurs (tout se tait, puis le cri éclate)
      duckG = ctx.createGain(); duckG.gain.value = 1;
      master.connect(duckG); duckG.connect(muffle); muffle.connect(comp); comp.connect(clip); clip.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < d.length; i++) {           // bruit rose
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      }
      // réverbération : réponse impulsionnelle synthétisée (premières réflexions + queue qui s'assombrit)
      try {
        const conv = ctx.createConvolver(); conv.buffer = makeIR(2.2); conv.normalize = true;
        revIn = ctx.createGain(); revIn.gain.value = 1; revG = ctx.createGain(); revG.gain.value = 0;
        sfx.connect(revIn); revIn.connect(conv); conv.connect(revG); revG.connect(master);
        // écho de rue (réflexion sur les façades) : retard + rétroaction filtrée
        const dl = ctx.createDelay(1); dl.delayTime.value = 0.23; const fb = ctx.createGain(); fb.gain.value = 0.3;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
        echoG = ctx.createGain(); echoG.gain.value = 0;
        sfx.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(echoG); echoG.connect(master);
      } catch (e) { revG = null; echoG = null; }
      A.setVolumes();
    }
  }
  const ok = () => ready && ctx && ctx.state === 'running';
  // réponse impulsionnelle stéréo : quelques réflexions nettes puis une queue diffuse dont les aigus meurent plus vite
  function makeIR(dur) {
    const sr = ctx.sampleRate, n = Math.floor(sr * dur), buf = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n, w = Math.random() * 2 - 1;
        const k = 0.25 + 0.7 * t;                       // filtre qui se referme avec le temps
        lp += (w - lp) * (1 - k);
        d[i] = lp * Math.pow(1 - t, 2.6) * (t < 0.004 ? t / 0.004 : 1);
      }
      for (let r = 0; r < 7; r++) { const p = Math.floor(sr * (0.011 + r * 0.017 + Math.random() * 0.012 + ch * 0.003)); if (p < n) d[p] += (Math.random() < 0.5 ? -1 : 1) * (0.55 - r * 0.06); }
    }
    return buf;
  }

  function pan(p) {
    if (!ctx.createStereoPanner) return null;
    const n = ctx.createStereoPanner(); n.pan.value = BR.clamp(p || 0, -1, 1); return n;
  }
  // son placé dans le monde (HRTF : devant / derrière / au-dessus se distinguent au casque)
  function spatial(pos) {
    const pn = ctx.createPanner();
    pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = pos.ref || 2.5; pn.rolloffFactor = pos.roll || 1.1; pn.maxDistance = 120;
    if (pn.positionX) { pn.positionX.value = pos.x; pn.positionY.value = pos.y; pn.positionZ.value = pos.z; } else pn.setPosition(pos.x, pos.y, pos.z);
    return pn;
  }
  function chain(src, g, p, bus, pos) {
    let node = src;
    node.connect(g); node = g;
    pos = pos || posOverride;
    const pn = pos ? spatial(pos) : p ? pan(p) : null;
    if (pn) { node.connect(pn); node = pn; }
    node.connect(bus || sfx);
  }
  function noise(o) {
    if (!ok()) return;
    const t = ctx.currentTime + (o.delay || 0);
    // le tampon de bruit fait 2 s : les sons longs bouclent pour ne jamais être coupés net
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!o.loop || o.dur > 0.9;
    s.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q || 0.7;
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
    const g = ctx.createGain(); const peak = (o.gain || 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f); chain(f, g, o.pan, o.bus, o.pos);
    s.start(t, Math.random() * Math.max(0, 1.9 - (s.loop ? 0 : o.dur))); s.stop(t + o.dur + 0.05);
  }
  function tone(o) {
    if (!ok()) return;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.detune) osc.detune.value = o.detune;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; if (o.q) f.Q.value = o.q; osc.connect(f); node = f; }
    chain(node, g, o.pan, o.bus, o.pos);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }

  // primitives exposées pour que les autres fichiers (portes, colosses, cartes…) fabriquent leurs propres sons
  A.tone = o => tone(o); A.noise = o => noise(o);
  A.ctx = () => (ok() ? ctx : null); A.bus = () => sfx; A.ready = () => ok();

  /* ---------- UI ---------- */
  A.ui = function (kind) {
    if (!ok()) return;
    if (kind === 'hover') tone({ freq: 880, dur: 0.05, gain: 0.025, type: 'triangle' });
    else if (kind === 'click') { tone({ freq: 520, freqEnd: 760, dur: 0.07, gain: 0.07, type: 'triangle' }); }
    else if (kind === 'back') tone({ freq: 520, freqEnd: 330, dur: 0.1, gain: 0.07, type: 'triangle' });
    else if (kind === 'ok') { tone({ freq: 660, dur: 0.1, gain: 0.08, type: 'sine' }); tone({ freq: 990, dur: 0.18, gain: 0.08, type: 'sine', delay: 0.08 }); }
    else if (kind === 'error') { tone({ freq: 200, dur: 0.18, gain: 0.1, type: 'square', lp: 700 }); tone({ freq: 150, dur: 0.22, gain: 0.1, type: 'square', lp: 600, delay: 0.1 }); }
    else if (kind === 'buy') { tone({ freq: 1200, dur: 0.06, gain: 0.07, type: 'square', lp: 3000 }); tone({ freq: 1800, dur: 0.14, gain: 0.07, type: 'square', lp: 3000, delay: 0.06 }); }
    else if (kind === 'join') { tone({ freq: 440, dur: 0.12, gain: 0.07 }); tone({ freq: 660, dur: 0.18, gain: 0.07, delay: 0.1 }); }
    else if (kind === 'msg') tone({ freq: 1000, dur: 0.08, gain: 0.05, type: 'triangle' });
  };

  /* ---------- Jeu 2 : bruitages de combat ---------- */
  A.fx = function (kind, o) {
    if (!ok()) return;
    o = o || {}; const g = o.g == null ? 1 : o.g, p = o.pan || 0, r = o.rate || 1;
    switch (kind) {
      case 'swing': noise({ type: 'bandpass', freq: 1800 * r, freqEnd: 500, q: 1.2, dur: 0.16, gain: 0.09 * g, attack: 0.02, pan: p }); break;
      case 'swingBig': noise({ type: 'bandpass', freq: 900 * r, freqEnd: 220, q: 1, dur: 0.3, gain: 0.14 * g, attack: 0.04, pan: p }); tone({ freq: 140, freqEnd: 70, dur: 0.25, gain: 0.05 * g, type: 'sine', pan: p }); break;
      case 'hit': tone({ freq: 150 * r, freqEnd: 55, dur: 0.12, gain: 0.22 * g, type: 'sine', pan: p }); noise({ type: 'lowpass', freq: 2600, freqEnd: 400, dur: 0.09, gain: 0.16 * g, pan: p }); break;
      case 'crit': tone({ freq: 190, freqEnd: 50, dur: 0.18, gain: 0.28 * g, type: 'sine', pan: p }); noise({ type: 'highpass', freq: 3000, dur: 0.12, gain: 0.1 * g, pan: p }); tone({ freq: 1400, freqEnd: 900, dur: 0.12, gain: 0.05 * g, type: 'triangle', pan: p }); break;
      case 'parry': [2100, 3150, 4200].forEach((f, i) => tone({ freq: f, dur: 0.5 - i * 0.1, gain: 0.08 * g, type: 'sine', pan: p })); noise({ type: 'highpass', freq: 5000, dur: 0.08, gain: 0.12 * g }); break;
      case 'block': tone({ freq: 420, freqEnd: 300, dur: 0.12, gain: 0.12 * g, type: 'square', lp: 1600, pan: p }); noise({ type: 'bandpass', freq: 1500, dur: 0.08, gain: 0.1 * g, pan: p }); break;
      case 'dash': noise({ type: 'bandpass', freq: 600, freqEnd: 2400, q: 0.8, dur: 0.22, gain: 0.1 * g, attack: 0.02, pan: p }); break;
      case 'perfect': tone({ freq: 880, freqEnd: 1760, dur: 0.3, gain: 0.08 * g, type: 'triangle' }); noise({ type: 'highpass', freq: 4000, freqEnd: 1200, dur: 0.5, gain: 0.06 * g }); tone({ freq: 220, freqEnd: 110, dur: 0.6, gain: 0.08 * g, type: 'sine' }); break;
      case 'jump': noise({ type: 'bandpass', freq: 700, dur: 0.1, gain: 0.05 * g }); break;
      case 'land': noise({ type: 'lowpass', freq: 350, dur: 0.15, gain: 0.12 * g }); break;
      case 'zap': for (let i = 0; i < 3; i++) noise({ type: 'highpass', freq: 2500 + Math.random() * 3000, dur: 0.06 + Math.random() * 0.06, gain: 0.12 * g, delay: i * 0.035, pan: p }); tone({ freq: 90, dur: 0.12, gain: 0.08 * g, type: 'sawtooth', lp: 900 }); break;
      case 'boom': tone({ freq: 90 * r, freqEnd: 28, dur: 0.9 * (o.len || 1), gain: 0.4 * g, type: 'sine', pan: p }); noise({ type: 'lowpass', freq: 1400, freqEnd: 120, dur: 1.0 * (o.len || 1), gain: 0.35 * g, attack: 0.005, pan: p }); break;
      case 'stomp': tone({ freq: 70, freqEnd: 30, dur: 0.5, gain: 0.4 * g, type: 'sine', pan: p }); noise({ type: 'lowpass', freq: 500, freqEnd: 80, dur: 0.5, gain: 0.3 * g, pan: p }); break;
      case 'fire': noise({ type: 'bandpass', freq: 900, freqEnd: 300, q: 0.6, dur: 0.6 * (o.len || 1), gain: 0.14 * g, attack: 0.05, pan: p }); break;
      case 'ice': [2600, 3300].forEach((f, i) => tone({ freq: f, freqEnd: f * 0.7, dur: 0.25, gain: 0.05 * g, type: 'triangle', delay: i * 0.04, pan: p })); noise({ type: 'highpass', freq: 4000, dur: 0.2, gain: 0.08 * g, pan: p }); break;
      case 'charge': tone({ freq: 120, freqEnd: 900, dur: o.len || 0.8, gain: 0.07 * g, type: 'sawtooth', lp: 2000, attack: 0.2 }); noise({ type: 'bandpass', freq: 400, freqEnd: 3000, dur: o.len || 0.8, gain: 0.05 * g, attack: 0.3 }); break;
      case 'magic': tone({ freq: 660 * r, freqEnd: 1320 * r, dur: 0.18, gain: 0.06 * g, type: 'triangle', pan: p }); tone({ freq: 990 * r, dur: 0.22, gain: 0.04 * g, type: 'sine', delay: 0.05, pan: p }); break;
      case 'heal': [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.05 * g, type: 'sine', delay: i * 0.07 })); break;
      case 'timestop': tone({ freq: 1200, freqEnd: 60, dur: 1.2, gain: 0.18 * g, type: 'sawtooth', lp: 3000 }); noise({ type: 'highpass', freq: 6000, freqEnd: 300, dur: 1.0, gain: 0.12 * g }); [1568, 2093].forEach((f, i) => tone({ freq: f, dur: 2.2, gain: 0.06 * g, type: 'sine', delay: 0.15 + i * 0.1 })); break;
      case 'tick': tone({ freq: 1800, dur: 0.03, gain: 0.05 * g, type: 'square', lp: 5000 }); break;
      case 'timeresume': tone({ freq: 60, freqEnd: 900, dur: 0.6, gain: 0.14 * g, type: 'sawtooth', lp: 2500 }); noise({ type: 'bandpass', freq: 300, freqEnd: 4000, dur: 0.5, gain: 0.12 * g }); break;
      case 'roar': tone({ freq: 70 * r, freqEnd: 45 * r, dur: 1.3, gain: 0.35 * g, type: 'sawtooth', lp: 600, attack: 0.15, pan: p }); noise({ type: 'lowpass', freq: 800, freqEnd: 200, dur: 1.2, gain: 0.25 * g, attack: 0.1, pan: p }); break;
      case 'bossHit': tone({ freq: 110, freqEnd: 60, dur: 0.12, gain: 0.18 * g, type: 'square', lp: 900, pan: p }); break;
      case 'hurt': tone({ freq: 300, freqEnd: 120, dur: 0.2, gain: 0.16 * g, type: 'sawtooth', lp: 1200 }); noise({ type: 'lowpass', freq: 1200, dur: 0.15, gain: 0.2 * g }); break;
      case 'break': tone({ freq: 80, freqEnd: 40, dur: 1.0, gain: 0.35 * g, type: 'sine' }); noise({ type: 'bandpass', freq: 2000, freqEnd: 300, dur: 0.8, gain: 0.2 * g }); [600, 900, 1200].forEach((f, i) => tone({ freq: f, freqEnd: f * 0.5, dur: 0.4, gain: 0.06 * g, type: 'square', lp: 3000, delay: i * 0.06 })); break;
      case 'ult': tone({ freq: 55, freqEnd: 110, dur: 1.4, gain: 0.3 * g, type: 'sawtooth', lp: 800, attack: 0.1 }); [440, 554, 659, 880].forEach((f, i) => tone({ freq: f, dur: 0.9, gain: 0.05 * g, type: 'triangle', delay: i * 0.05 })); break;
      case 'win': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone({ freq: f, dur: 0.7, gain: 0.09 * g, type: 'triangle', delay: i * 0.11 })); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.6, gain: 0.1 * g, type: 'sawtooth', lp: 900, delay: i * 0.22 })); break;
      case 'spin': tone({ freq: 500 + (o.v || 0) * 900, dur: 0.035, gain: 0.05 * g, type: 'square', lp: 4000 }); break;
      case 'reveal': [392, 523, 659, 784, 1047].forEach((f, i) => tone({ freq: f * r, dur: 0.6, gain: 0.08 * g, type: 'triangle', delay: i * 0.06 })); noise({ type: 'highpass', freq: 5000, dur: 0.6, gain: 0.05 * g }); break;
    }
  };
  /** son continu (rayon, tornade…) : renvoie { set(gain), stop() } */
  A.loopFx = function (kind) {
    if (!ok()) return { set() {}, stop() {} };
    const t = ctx.currentTime, gn = ctx.createGain(); gn.gain.value = 0.0001; gn.connect(sfx);
    const nodes = [];
    if (kind === 'beam') {
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 72; const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 145;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; o1.connect(f); o2.connect(f); f.connect(gn); o1.start(); o2.start(); nodes.push(o1, o2);
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2500; n.connect(nf); nf.connect(gn); n.start(); nodes.push(n);
    } else {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = kind === 'wind' ? 700 : 300; nf.Q.value = 0.7; n.connect(nf); nf.connect(gn); n.start(); nodes.push(n);
    }
    gn.gain.setTargetAtTime(0.18, t, 0.05);
    return {
      set(v) { gn.gain.setTargetAtTime(0.18 * v, ctx.currentTime, 0.05); },
      stop() { const t2 = ctx.currentTime; gn.gain.setTargetAtTime(0.0001, t2, 0.08); nodes.forEach(n => { try { n.stop(t2 + 0.4); } catch (e) {} }); },
    };
  };
  /** cri « mème » d'une image de monstre, déformé (boss) */
  A.bossVoice = function (sp, rate, gain) {
    const buf = memeFor(sp); if (!ok() || !buf) return;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate || 0.75;
    const g = ctx.createGain(); g.gain.value = gain || 1.1; const ds = ctx.createWaveShaper();
    const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); } ds.curve = curve;
    s.connect(ds); ds.connect(g); g.connect(sfx); s.start(0, 0); s.stop(ctx.currentTime + 2.2);
  };

  /* ---------- Gameplay ---------- */
  /**
   * pas selon la surface : 'carpet' (moquette), 'tile' (carrelage), 'concrete' (béton/asphalte), 'grass', 'gravel', 'wood', 'metal', 'mud'
   * wet (0..1) : sol mouillé (pluie) → éclaboussure en plus. Chaque pas = talon puis pointe, avec de petites variations.
   */
  // pos (facultatif) : {x, y, z} → pas placé dans le monde (faux pas derrière soi, pas à l'étage du dessus…)
  A.step = function (power, panv, surf, wet, pos) {
    if (!ok()) return;
    if (pos) { posOverride = pos; try { A.step(power, 0, surf, wet); } finally { posOverride = null; } return; }
    const p = power, r = 0.9 + Math.random() * 0.2, pn = panv, toe = 0.03 + Math.random() * 0.025;
    switch (surf || 'concrete') {
      case 'carpet':
        noise({ type: 'lowpass', freq: 520 * r, freqEnd: 180, dur: 0.11, gain: 0.075 * p, pan: pn, attack: 0.006 });
        tone({ freq: 62 * r, freqEnd: 40, dur: 0.08, gain: 0.05 * p, pan: pn });
        noise({ type: 'bandpass', freq: 1400 * r, q: 0.8, dur: 0.06, gain: 0.014 * p, pan: pn, delay: toe });
        break;
      case 'tile':
        noise({ type: 'bandpass', freq: 3200 * r, q: 1.6, dur: 0.035, gain: 0.075 * p, pan: pn, attack: 0.001 });
        tone({ freq: 1750 * r, freqEnd: 1500, dur: 0.04, gain: 0.016 * p, type: 'triangle', pan: pn });
        tone({ freq: 95 * r, freqEnd: 60, dur: 0.07, gain: 0.05 * p, pan: pn });
        noise({ type: 'bandpass', freq: 2400 * r, q: 1.2, dur: 0.03, gain: 0.04 * p, pan: pn, delay: toe, attack: 0.001 });
        break;
      case 'wood':
        tone({ freq: 190 * r, freqEnd: 150, dur: 0.09, gain: 0.07 * p, type: 'triangle', lp: 900, pan: pn });
        noise({ type: 'bandpass', freq: 750 * r, q: 1.4, dur: 0.07, gain: 0.065 * p, pan: pn, attack: 0.002 });
        noise({ type: 'bandpass', freq: 1300 * r, q: 1.4, dur: 0.04, gain: 0.03 * p, pan: pn, delay: toe });
        if (Math.random() < 0.12) tone({ freq: 420 + Math.random() * 200, freqEnd: 300, dur: 0.24, gain: 0.014 * p, type: 'sawtooth', lp: 1200, q: 6, pan: pn, delay: 0.05, attack: 0.06 });
        break;
      case 'metal':
        [523, 1247, 2113, 3170].forEach((f, i) => tone({ freq: f * r, dur: 0.2 - i * 0.035, gain: (0.022 - i * 0.004) * p, type: 'sine', pan: pn }));
        noise({ type: 'highpass', freq: 2500, dur: 0.03, gain: 0.05 * p, pan: pn, attack: 0.001 });
        tone({ freq: 110 * r, freqEnd: 70, dur: 0.1, gain: 0.05 * p, pan: pn });
        break;
      case 'grass':
        noise({ type: 'highpass', freq: 2600 * r, dur: 0.17, gain: 0.04 * p, pan: pn, attack: 0.025 });
        noise({ type: 'bandpass', freq: 900 * r, q: 0.7, dur: 0.11, gain: 0.03 * p, pan: pn, attack: 0.012 });
        tone({ freq: 60, freqEnd: 40, dur: 0.07, gain: 0.03 * p, pan: pn });
        break;
      case 'gravel':       // gravier : crissement de petits cailloux
        tone({ freq: 75, freqEnd: 45, dur: 0.08, gain: 0.04 * p, pan: pn });
        for (let i = 0; i < 6; i++) noise({ type: 'bandpass', freq: 2200 + Math.random() * 3000, q: 2.5, dur: 0.02 + Math.random() * 0.03, gain: (0.02 + Math.random() * 0.03) * p, pan: pn, delay: i * 0.014 + Math.random() * 0.01, attack: 0.001 });
        noise({ type: 'lowpass', freq: 900, dur: 0.12, gain: 0.04 * p, pan: pn, attack: 0.004 });
        break;
      case 'mud':
        noise({ type: 'lowpass', freq: 280 * r, freqEnd: 900, q: 4, dur: 0.18, gain: 0.085 * p, pan: pn, attack: 0.012 });
        noise({ type: 'bandpass', freq: 600 * r, freqEnd: 1500, q: 5, dur: 0.12, gain: 0.045 * p, pan: pn, delay: 0.06 });
        tone({ freq: 70, freqEnd: 45, dur: 0.1, gain: 0.05 * p, pan: pn });
        break;
      case 'water': {     // pas dans l'eau (Piscine) : wet = profondeur 0..1 (0 = pellicule, 1 = jusqu'aux cuisses)
        const k = wet > 0 ? Math.min(1, wet) : 0.4;
        noise({ type: 'bandpass', freq: (1300 - 500 * k) * r, freqEnd: 600, q: 1.2, dur: 0.12 + 0.2 * k, gain: (0.05 + 0.07 * k) * p, pan: pn, attack: 0.01 + 0.03 * k });
        noise({ type: 'highpass', freq: 3500, dur: 0.08 + 0.1 * k, gain: (0.03 + 0.03 * k) * p, pan: pn, delay: 0.02 });
        if (k > 0.3) tone({ freq: 180 * r, freqEnd: 90, dur: 0.14, gain: 0.035 * p * k, pan: pn, delay: 0.05 });
        if (Math.random() < 0.35) tone({ freq: 700 + Math.random() * 500, freqEnd: 1400, dur: 0.05, gain: 0.012 * p, type: 'sine', pan: pn, delay: 0.08 + Math.random() * 0.06 });   // goutte
        return;
      }
      default:        // béton, asphalte : talon net + crissement de graviers
        noise({ type: 'bandpass', freq: 1700 * r, q: 0.9, dur: 0.05, gain: 0.07 * p, pan: pn, attack: 0.001 });
        noise({ type: 'lowpass', freq: 420 * r, freqEnd: 150, dur: 0.1, gain: 0.06 * p, pan: pn });
        tone({ freq: 80 * r, freqEnd: 48, dur: 0.08, gain: 0.045 * p, pan: pn });
        noise({ type: 'highpass', freq: 3800, dur: 0.05, gain: 0.02 * p, pan: pn, delay: toe });
    }
    if (wet > 0.05) {
      noise({ type: 'bandpass', freq: 1900 * r, q: 0.8, dur: 0.13, gain: 0.055 * p * wet, pan: pn, attack: 0.004, delay: 0.005 });
      noise({ type: 'highpass', freq: 4500, dur: 0.09, gain: 0.03 * p * wet, pan: pn, delay: toe });
    }
  };
  A.land = function (power, surf, wet) {
    power = power == null ? 1 : power;
    noise({ type: 'lowpass', freq: 300, dur: 0.2, gain: 0.14 * power });
    tone({ freq: 70, freqEnd: 35, dur: 0.16, gain: 0.12 * power });
    A.step(1.2 * power, 0, surf, wet);
  };
  /* respiration : inspiration / expiration, intensité 0..1 (essoufflement, peur). Au-delà de 0,55, la voix s'en mêle (halètement). */
  A.breath = function (inhale, k, dur) {
    if (!ok()) return;
    const g = 0.008 + 0.05 * k;
    if (inhale) noise({ type: 'bandpass', freq: 1500, freqEnd: 2400, q: 1.3, dur, gain: g, attack: dur * 0.55 });
    else {
      noise({ type: 'bandpass', freq: 1150, freqEnd: 650, q: 1.1, dur, gain: g * 1.25, attack: dur * 0.18 });
      if (k > 0.55) tone({ freq: 150 + Math.random() * 30, freqEnd: 118, dur: dur * 0.8, gain: 0.018 * (k - 0.5), type: 'sawtooth', lp: 650, attack: dur * 0.2 });
    }
  };
  /* lampe torche : clic de l'interrupteur, grésillement électrique */
  A.flashClick = function (on) {
    tone({ freq: on ? 2600 : 2100, dur: 0.012, gain: 0.05, type: 'square', lp: 6000 });
    noise({ type: 'highpass', freq: 3000, dur: 0.02, gain: 0.05, attack: 0.001 });
    tone({ freq: 900, dur: 0.02, gain: 0.02, type: 'triangle', delay: 0.012 });
  };
  A.flashBuzz = function (dur) {
    if (!ok()) return;
    tone({ freq: 100, dur, gain: 0.02, type: 'sawtooth', lp: 2400, attack: 0.01 });
    for (let t = 0; t < dur; t += 0.035 + Math.random() * 0.07) noise({ type: 'bandpass', freq: 2500 + Math.random() * 3500, q: 3, dur: 0.012 + Math.random() * 0.03, gain: 0.025 + Math.random() * 0.04, delay: t, attack: 0.001 });
  };
  /* portes (utilisable par doors.js) : 'open', 'creak', 'close', 'slam', 'locked' */
  A.door = function (kind, panv, g) {
    if (!ok()) return;
    g = g == null ? 1 : g;
    if (kind === 'open' || kind === 'creak') {
      // gond qui grince : dent de scie très filtrée dont la hauteur vacille
      const t = ctx.currentTime, d = kind === 'creak' ? 1.5 : 0.95;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(300 + Math.random() * 80, t); o.frequency.linearRampToValueAtTime(470 + Math.random() * 120, t + d);
      const lf = ctx.createOscillator(); lf.frequency.value = 9 + Math.random() * 6; const lg = ctx.createGain(); lg.gain.value = 22; lf.connect(lg); lg.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 6;
      const gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.06 * g, t + 0.12); gn.gain.setValueAtTime(0.06 * g, t + d * 0.7); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(f); chain(f, gn, panv); o.start(t); lf.start(t); o.stop(t + d + 0.05); lf.stop(t + d + 0.05);
      noise({ type: 'bandpass', freq: 2800, q: 4, dur: 0.03, gain: 0.05 * g, pan: panv, attack: 0.001 });
      noise({ type: 'lowpass', freq: 320, dur: 0.25, gain: 0.05 * g, pan: panv });
    } else if (kind === 'close' || kind === 'slam') {
      const k = kind === 'slam' ? 1.8 : 1;
      tone({ freq: 85, freqEnd: 48, dur: 0.28 * k, gain: 0.2 * g * k, pan: panv });
      noise({ type: 'lowpass', freq: 1000 * k, freqEnd: 180, dur: 0.25 * k, gain: 0.15 * g * k, pan: panv, attack: 0.002 });
      noise({ type: 'bandpass', freq: 2600, q: 3, dur: 0.05, gain: 0.06 * g, pan: panv, delay: 0.05 });
      if (kind === 'slam') for (let i = 0; i < 4; i++) noise({ type: 'bandpass', freq: 1800 + Math.random() * 1200, q: 6, dur: 0.04, gain: 0.04 * g, pan: panv, delay: 0.1 + i * 0.05 });
    } else if (kind === 'locked') {
      for (let i = 0; i < 3; i++) { noise({ type: 'bandpass', freq: 2100 + Math.random() * 600, q: 5, dur: 0.05, gain: 0.07 * g, pan: panv, delay: i * 0.11 }); tone({ freq: 180, freqEnd: 120, dur: 0.06, gain: 0.05 * g, pan: panv, delay: i * 0.11 }); }
    }
  };
  /* tonnerre : near 0..1 (1 = foudre toute proche → claquement sec), delay = décalage dû à la distance */
  A.thunder = function (near, delay) {
    if (!ok()) return;
    const d = delay || 0, g = 0.22 + near * 0.55, len = 3.5 + (1 - near) * 3;
    if (near > 0.55) {
      noise({ type: 'highpass', freq: 1400, dur: 0.3, gain: 0.45 * near, delay: d, attack: 0.002 });
      noise({ type: 'lowpass', freq: 3200, freqEnd: 300, dur: 0.9, gain: 0.45 * near, delay: d + 0.02, attack: 0.003 });
    }
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = d + 0.05 + (i / n) * len * (0.55 + Math.random() * 0.6);
      noise({ type: 'lowpass', freq: 180 + near * 320 + Math.random() * 120, freqEnd: 60, dur: 1.3 + Math.random() * 1.8, gain: g * (0.55 + Math.random() * 0.5) * (1 - i / (n + 2)), delay: t, attack: 0.06 + Math.random() * 0.3 });
    }
    tone({ freq: 44, freqEnd: 27, dur: len, gain: 0.22 * g, delay: d, attack: 0.25 });
  };
  /* assourdit tout (choc) puis revient progressivement : freq (Hz), maintien et retour en secondes */
  A.muffle = function (freq, rec, hold, delay) {
    if (!ok() || !muffle) return;
    const t = ctx.currentTime + (delay || 0), f = muffle.frequency;
    f.cancelScheduledValues(ctx.currentTime); f.setValueAtTime(f.value, ctx.currentTime); f.setValueAtTime(f.value, t);
    f.exponentialRampToValueAtTime(freq, t + 0.15); f.setValueAtTime(freq, t + 0.15 + (hold || 0)); f.exponentialRampToValueAtTime(22000, t + 0.15 + (hold || 0) + (rec || 2));
  };
  A.unmuffle = function () { if (!ctx || !muffle) return; const f = muffle.frequency; f.cancelScheduledValues(ctx.currentTime); f.setValueAtTime(22000, ctx.currentTime); };
  /* Piscine : sous l'eau, tout devient sourd (le filtre reste fermé tant qu'on est immergé) */
  A.underwater = function (on) {
    if (!ok() || !muffle) return;
    const f = muffle.frequency, t = ctx.currentTime;
    f.cancelScheduledValues(t); f.setValueAtTime(Math.max(40, f.value), t);
    f.exponentialRampToValueAtTime(on ? 420 : 22000, t + (on ? 0.12 : 0.35));
    if (on) for (let i = 0; i < 7; i++) tone({ freq: 500 + Math.random() * 900, freqEnd: 1500 + Math.random() * 800, dur: 0.05, gain: 0.03, type: 'sine', delay: 0.05 + i * (0.04 + Math.random() * 0.06) });   // bulles
  };
  /* plongeon / chute dans l'eau (power 0..1.5) */
  A.splash = function (power) {
    if (!ok()) return;
    const p = power == null ? 1 : power;
    noise({ type: 'lowpass', freq: 1800, freqEnd: 400, dur: 0.5 + 0.4 * p, gain: 0.16 * p, attack: 0.005 });
    noise({ type: 'highpass', freq: 2500, dur: 0.35 + 0.3 * p, gain: 0.1 * p, attack: 0.01 });
    tone({ freq: 120, freqEnd: 50, dur: 0.3, gain: 0.08 * p });
    for (let i = 0; i < 6; i++) tone({ freq: 600 + Math.random() * 1200, freqEnd: 1600, dur: 0.06, gain: 0.02 * p, type: 'sine', delay: 0.15 + Math.random() * 0.5 });
  };
  /* brasse (nage en surface) */
  A.swim = function () {
    if (!ok()) return;
    noise({ type: 'bandpass', freq: 900, freqEnd: 500, q: 0.9, dur: 0.45, gain: 0.05, attack: 0.12 });
    noise({ type: 'highpass', freq: 3000, dur: 0.25, gain: 0.025, attack: 0.05, delay: 0.1 });
  };
  /* attrapé : son de mort très fort et effrayant (tout passe par le compresseur + l'écrêtage doux) */
  A.death = function (sp) {
    if (!ok()) return;
    const t = ctx.currentTime;
    // impact grave énorme
    tone({ freq: 95, freqEnd: 24, dur: 2.6, gain: 0.85, attack: 0.004 });
    tone({ freq: 48, freqEnd: 29, dur: 3.0, gain: 0.45, type: 'triangle', attack: 0.01 });
    // déchirure distordue dont le filtre se referme
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const ws = ctx.createWaveShaper(), c = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 255.5 - 1; c[i] = Math.tanh(x * 9); } ws.curve = c;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(7500, t); f.frequency.exponentialRampToValueAtTime(160, t + 1.5); f.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    s.connect(ws); ws.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random()); s.stop(t + 1.7);
    // cordes qui crissent (grappe dissonante qui monte)
    [1180, 1245, 1570, 2230, 2960].forEach((fq, i) => tone({ freq: fq, freqEnd: fq * (1.16 + i * 0.03), dur: 1.7, gain: 0.075, type: 'sawtooth', lp: 7000, attack: 0.01, detune: (Math.random() - 0.5) * 30 }));
    // cri de l'entité + échantillon de frayeur
    A.botScream(sp);
    if (!A.sample('jumpscare', 0.9)) A.jumpscare();
    // acouphène puis assourdissement (choc)
    tone({ freq: 6100, dur: 5, gain: 0.022, delay: 0.7, attack: 0.5 });
    A.muffle(420, 3.2, 0.4, 1.0);
  };
  /* dernier souffle (mort définitive) : battements de cœur qui ralentissent puis s'arrêtent */
  A.flatline = function () {
    if (!ok()) return;
    [0, 0.9, 2.0, 3.5].forEach((d, i) => { const g = 0.45 - i * 0.09; tone({ freq: 60, freqEnd: 36, dur: 0.18, gain: g, delay: d, lp: 300 }); tone({ freq: 56, freqEnd: 34, dur: 0.16, gain: g * 0.7, delay: d + 0.19, lp: 300 }); });
    tone({ freq: 41, freqEnd: 36, dur: 6, gain: 0.12, type: 'sawtooth', lp: 140, delay: 0.5, attack: 1.5 });
  };
  A.jump = function () { noise({ type: 'bandpass', freq: 500, dur: 0.1, gain: 0.04 }); };
  A.pickup = function () { tone({ freq: 880, dur: 0.12, gain: 0.12, type: 'triangle' }); tone({ freq: 1320, dur: 0.2, gain: 0.12, type: 'triangle', delay: 0.09 }); tone({ freq: 1760, dur: 0.3, gain: 0.08, type: 'sine', delay: 0.18 }); };
  A.drink = function () { for (let i = 0; i < 3; i++) noise({ type: 'bandpass', freq: 700, q: 2, dur: 0.12, gain: 0.1, delay: i * 0.14 }); tone({ freq: 300, freqEnd: 800, dur: 0.4, gain: 0.07, delay: 0.4, type: 'triangle' }); };
  A.throw = function () { noise({ type: 'bandpass', freq: 900, freqEnd: 300, dur: 0.25, gain: 0.1 }); };
  A.flare = function (panv) { noise({ type: 'highpass', freq: 2500, dur: 1.4, gain: 0.12, pan: panv, attack: 0.05 }); tone({ freq: 160, freqEnd: 60, dur: 0.5, gain: 0.1, pan: panv }); };
  A.beep = function (panv, g) { tone({ freq: 1500, dur: 0.07, gain: 0.07 * (g == null ? 1 : g), type: 'square', lp: 4000, pan: panv }); };
  A.locker = function () { noise({ type: 'lowpass', freq: 700, dur: 0.18, gain: 0.16 }); tone({ freq: 95, freqEnd: 60, dur: 0.15, gain: 0.1 }); };
  A.revive = function () { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.28, gain: 0.1, delay: i * 0.1, type: 'triangle' })); };
  A.down = function () { tone({ freq: 220, freqEnd: 40, dur: 1.2, gain: 0.25, type: 'sawtooth', lp: 500 }); noise({ type: 'lowpass', freq: 400, dur: 1.0, gain: 0.25 }); };
  A.ping = function (panv) { tone({ freq: 1100, freqEnd: 1500, dur: 0.12, gain: 0.09, pan: panv, type: 'sine' }); tone({ freq: 1500, dur: 0.18, gain: 0.07, delay: 0.1, pan: panv }); };
  A.escape = function () { [392, 523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.1, delay: i * 0.12, type: 'triangle' })); };
  A.doorOpen = function () {
    // gros verrou électrique qui claque, puis la lourde porte métallique qui pivote en grinçant
    noise({ type: 'bandpass', freq: 2200, q: 3, dur: 0.06, gain: 0.18, attack: 0.001 }); tone({ freq: 140, freqEnd: 60, dur: 0.25, gain: 0.3 });
    noise({ type: 'lowpass', freq: 180, dur: 2.0, gain: 0.35, attack: 0.2, delay: 0.15 }); tone({ freq: 55, freqEnd: 90, dur: 2.0, gain: 0.2, type: 'sawtooth', lp: 200, delay: 0.15 });
    setTimeout(() => A.door('creak', 0, 1.3), 250);
  };
  A.siren = function () {
    for (let i = 0; i < 4; i++) tone({ freq: 500, freqEnd: 900, dur: 0.55, gain: 0.14, type: 'sawtooth', lp: 1400, delay: i * 0.6 });
  };
  A.growl = function (panv, g) {
    g = g == null ? 1 : g;
    tone({ freq: 70, freqEnd: 40, dur: 1.1, gain: 0.22 * g, type: 'sawtooth', lp: 380, pan: panv });
    noise({ type: 'bandpass', freq: 220, freqEnd: 120, q: 3, dur: 1.1, gain: 0.18 * g, pan: panv });
  };
  A.screech = function (panv, g) {
    g = g == null ? 1 : g;
    tone({ freq: 900, freqEnd: 1500, dur: 0.7, gain: 0.14 * g, type: 'sawtooth', lp: 3500, pan: panv });
    tone({ freq: 1180, freqEnd: 700, dur: 0.7, gain: 0.1 * g, type: 'square', lp: 3000, pan: panv });
    noise({ type: 'highpass', freq: 1800, dur: 0.7, gain: 0.12 * g, pan: panv });
  };
  A.jumpscare = function () {
    tone({ freq: 140, freqEnd: 60, dur: 1.4, gain: 0.5, type: 'sawtooth', lp: 900 });
    tone({ freq: 1400, freqEnd: 2600, dur: 0.9, gain: 0.3, type: 'sawtooth', lp: 5000 });
    tone({ freq: 1650, freqEnd: 900, dur: 0.9, gain: 0.25, type: 'square', lp: 4000 });
    noise({ type: 'highpass', freq: 800, dur: 1.2, gain: 0.45 });
  };
  A.whisper = function (panv) { for (let i = 0; i < 4; i++) noise({ type: 'bandpass', freq: 1400 + Math.random() * 1600, q: 7, dur: 0.5 + Math.random() * 0.5, gain: 0.05, pan: panv, attack: 0.15, delay: i * 0.38 }); };
  A.dread = function () { tone({ freq: 48, freqEnd: 40, dur: 3.5, gain: 0.16, type: 'sawtooth', lp: 160 }); tone({ freq: 71, freqEnd: 67, dur: 3.5, gain: 0.06, type: 'sine', delay: 0.3 }); };
  A.glitch = function () { noise({ type: 'bandpass', freq: 2200, q: 4, dur: 0.12, gain: 0.08 }); };
  // battement de cœur (« lub-dub ») : grave et étouffé, comme entendu de l'intérieur
  A.thump = function (g) {
    tone({ freq: 62, freqEnd: 36, dur: 0.17, gain: 0.42 * g, type: 'sine', lp: 260 }); noise({ type: 'lowpass', freq: 120, dur: 0.08, gain: 0.1 * g });
    tone({ freq: 58, freqEnd: 34, dur: 0.14, gain: 0.3 * g, type: 'sine', delay: 0.16, lp: 240 });
  };
  // néon qui grésille / claque en se coupant
  A.flick = function () { noise({ type: 'bandpass', freq: 3000, q: 3, dur: 0.05, gain: 0.07 }); tone({ freq: 100, dur: 0.06, gain: 0.03, type: 'sawtooth', lp: 1500 }); };

  /* =====================================================================
     PEUR : silence total, coups de son (« stingers »), faux signaux, voix chuchotée
     pos = {x, y, z} : son placé dans le monde (casque conseillé)
     ===================================================================== */
  let silTO = 0, presN = null;
  /** silence quasi total pendant dur secondes (effets, ambiance et musiques), puis retour en douceur */
  A.silence = function (dur, level) {
    duckK = level == null ? 0.05 : level; musicTick();
    if (ctx && duckG) { const t = ctx.currentTime; duckG.gain.cancelScheduledValues(t); duckG.gain.setValueAtTime(duckG.gain.value, t); duckG.gain.setTargetAtTime(duckK, t, 0.12); }
    clearTimeout(silTO); silTO = setTimeout(() => A.unsilence(0.8), Math.max(0.1, dur) * 1000);
  };
  /** fin du silence : retour brutal (fade ≈ 0, pour le cri) ou progressif (secondes) */
  A.unsilence = function (fade) {
    clearTimeout(silTO); duckK = 1; musicTick();
    if (ctx && duckG) { const t = ctx.currentTime; duckG.gain.cancelScheduledValues(t); duckG.gain.setValueAtTime(duckG.gain.value, t); duckG.gain.setTargetAtTime(1, t, Math.max(0.004, (fade || 0) / 3)); }
  };
  A.silenced = () => duckK < 1;
  /** coups de son : 'reveal' (très fort : elle était dans ton dos), 'contact' (premier contact), 'sniff' (elle t'a senti),
      'peek' (discret : quelque chose te regarde), 'vanish' (très discret : l'apparition s'efface) */
  A.stinger = function (kind, g) {
    if (!ok()) return;
    g = g == null ? 1 : g;
    const t = ctx.currentTime;
    if (kind === 'reveal' || kind === 'sniff') {
      const big = kind === 'reveal' ? 1 : 0.75;
      tone({ freq: 72, freqEnd: 28, dur: 1.7 * big, gain: 0.8 * g * big, attack: 0.003 });
      noise({ type: 'lowpass', freq: 7000, freqEnd: 220, dur: 0.85, gain: 0.5 * g, attack: 0.002 });
      noise({ type: 'highpass', freq: 1600, dur: 0.45, gain: 0.28 * g, attack: 0.002 });
      // grappe de cordes dissonantes qui glisse vers le haut
      [466, 494, 523, 554, 932, 988, 1397].forEach((f, i) => tone({ freq: f, freqEnd: f * (1.05 + i * 0.012), dur: 1.5 * big, gain: (i > 3 ? 0.05 : 0.07) * g, type: 'sawtooth', lp: 4200, attack: 0.006, detune: (Math.random() - 0.5) * 24 }));
      tone({ freq: 1800, freqEnd: 2700, dur: 0.65, gain: 0.1 * g, type: 'sawtooth', lp: 6500, attack: 0.004 });
      if (kind === 'reveal') tone({ freq: 6000, dur: 2.4, gain: 0.012 * g, delay: 0.5, attack: 0.4 });   // acouphène léger
    } else if (kind === 'contact') {
      // « BRAAAM » : cuivres graves dont le filtre s'ouvre d'un coup puis se referme lentement
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
      f.frequency.setValueAtTime(160, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.12); f.frequency.exponentialRampToValueAtTime(260, t + 2.6);
      const gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.32 * g, t + 0.05); gn.gain.setValueAtTime(0.32 * g, t + 0.5); gn.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      f.connect(gn); gn.connect(sfx);
      [[55, 0], [55, 9], [82.4, -6], [110, 5], [116.5, 0]].forEach(([fq, dt2]) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; o.detune.value = dt2; o.connect(f); o.start(t); o.stop(t + 3.05); });
      tone({ freq: 48, freqEnd: 30, dur: 2.2, gain: 0.55 * g, attack: 0.004 });
      noise({ type: 'lowpass', freq: 3000, freqEnd: 150, dur: 1.2, gain: 0.3 * g, attack: 0.003 });
      // violons aigus en trémolo par-dessus
      for (let k = 0; k < 18; k++) [1568, 1661].forEach(fq => tone({ freq: fq, dur: 0.07, gain: 0.014 * g * (1 - k / 20), type: 'sawtooth', lp: 5000, delay: 0.15 + k * 0.075, attack: 0.01 }));
    } else if (kind === 'peek') {
      [1975, 2093, 2217].forEach((fq, i) => tone({ freq: fq, freqEnd: fq * 0.985, dur: 2.2, gain: 0.016 * g, type: 'sine', attack: 0.6, delay: i * 0.05 }));
      tone({ freq: 58, freqEnd: 50, dur: 2.0, gain: 0.12 * g, lp: 200, attack: 0.3 });
    } else if (kind === 'vanish') {
      noise({ type: 'bandpass', freq: 350, freqEnd: 2600, q: 1.2, dur: 0.55, gain: 0.05 * g, attack: 0.45 });
      tone({ freq: 220, freqEnd: 104, dur: 0.9, gain: 0.025 * g, type: 'triangle', attack: 0.3 });
    }
  };
  /** cri de l'entité placé dans le monde (après la vague d'obscurité) */
  A.screamAt = function (sp, pos, g) {
    const buf = memeFor(sp); if (!ok()) return;
    if (!buf) { A.screech(0, 0.9 * (g || 1)); return; }
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = 0.86;
    const ds = ctx.createWaveShaper(), curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3.5); } ds.curve = curve;
    const gn = ctx.createGain(); gn.gain.value = 1.5 * (g || 1);
    s.connect(ds); ds.connect(gn);
    const pn = pos ? spatial(Object.assign({ ref: 7, roll: 0.8 }, pos)) : null;
    if (pn) { gn.connect(pn); pn.connect(sfx); } else gn.connect(sfx);
    s.start(0, 0); s.stop(ctx.currentTime + 1.9);
  };
  /** disjoncteur : un néon s'éteint d'un coup (claquement + bourdonnement qui meurt) */
  A.breaker = function (pos, g) {
    if (!ok()) return;
    g = g == null ? 1 : g;
    noise({ type: 'bandpass', freq: 1300, q: 2, dur: 0.05, gain: 0.22 * g, attack: 0.001, pos });
    tone({ freq: 95, freqEnd: 42, dur: 0.28, gain: 0.3 * g, pos });
    tone({ freq: 120, freqEnd: 48, dur: 0.6, gain: 0.05 * g, type: 'sawtooth', lp: 420, pos });
  };
  /** souffle au creux de l'oreille (side : -1 gauche, 1 droite) */
  A.earBreath = function (side, g) {
    if (!ok()) return;
    g = g == null ? 1 : g; const p = BR.clamp(side || 0.8, -1, 1);
    noise({ type: 'bandpass', freq: 1500, freqEnd: 2300, q: 1.1, dur: 0.9, gain: 0.05 * g, attack: 0.55, pan: p });
    noise({ type: 'bandpass', freq: 950, freqEnd: 480, q: 0.9, dur: 1.5, gain: 0.12 * g, attack: 0.35, pan: p, delay: 1.0 });
    noise({ type: 'lowpass', freq: 320, dur: 1.4, gain: 0.05 * g, attack: 0.3, pan: p, delay: 1.0 });
    tone({ freq: 112, freqEnd: 88, dur: 1.2, gain: 0.012 * g, type: 'sawtooth', lp: 500, attack: 0.4, pan: p, delay: 1.1 });
  };
  /** objet qui tombe : 'can' (boîte métallique qui rebondit et roule) ou 'thud' (chaise, carton lourd) */
  A.clatter = function (pos, kind) {
    if (!ok()) return;
    if (kind === 'thud') {
      tone({ freq: 105, freqEnd: 46, dur: 0.35, gain: 0.42, pos });
      noise({ type: 'lowpass', freq: 900, freqEnd: 150, dur: 0.3, gain: 0.3, attack: 0.002, pos });
      [0.22, 0.36].forEach((d, i) => { tone({ freq: 190 - i * 30, freqEnd: 130, dur: 0.1, gain: 0.16 - i * 0.05, type: 'triangle', lp: 900, delay: d, pos }); noise({ type: 'bandpass', freq: 800, q: 1.4, dur: 0.06, gain: 0.12 - i * 0.04, delay: d, pos }); });
      return;
    }
    const hits = [0, 0.3, 0.52, 0.68, 0.79, 0.87, 0.93];
    hits.forEach((d, i) => {
      const k = Math.pow(0.72, i), r = 0.95 + Math.random() * 0.1;
      [720, 1530, 2610, 3900].forEach((f, j) => tone({ freq: f * r, dur: 0.18 - j * 0.03, gain: (0.05 - j * 0.009) * k, type: 'sine', delay: d, pos }));
      noise({ type: 'highpass', freq: 2400, dur: 0.025, gain: 0.16 * k, attack: 0.001, delay: d, pos });
    });
    noise({ type: 'bandpass', freq: 1900, q: 3, dur: 1.1, gain: 0.03, attack: 0.05, delay: 0.98, pos });   // elle roule encore un peu
  };
  /** radio qui grésille au loin : parasites + voix incompréhensible */
  A.radio = function (pos) {
    if (!ok()) return;
    for (let t2 = 0; t2 < 2.8; t2 += 0.03 + Math.random() * 0.09) noise({ type: 'highpass', freq: 2800 + Math.random() * 3000, dur: 0.015 + Math.random() * 0.03, gain: 0.03 + Math.random() * 0.05, delay: t2, attack: 0.001, pos });
    noise({ type: 'bandpass', freq: 1300, q: 1.5, dur: 2.6, gain: 0.035, attack: 0.1, pos });
    let d = 0.35;
    for (let i = 0; i < 9; i++) {
      const l = 0.09 + Math.random() * 0.16;
      noise({ type: 'bandpass', freq: 600 + Math.random() * 1400, q: 5, dur: l, gain: 0.07, attack: 0.02, delay: d, pos });
      tone({ freq: 150 + Math.random() * 90, dur: l, gain: 0.02, type: 'square', lp: 1400, attack: 0.02, delay: d, pos });
      d += l + (Math.random() < 0.3 ? 0.18 : 0.04);
    }
    noise({ type: 'highpass', freq: 1800, dur: 0.28, gain: 0.09, attack: 0.003, delay: 2.75, pos });
  };
  /** vieux téléphone qui sonne au loin (la seconde sonnerie est coupée net) */
  A.phone = function (pos) {
    if (!ok()) return;
    const ring = (d0, len) => { for (let t2 = 0; t2 < len; t2 += 0.045) [880, 1105].forEach(f => tone({ freq: f, dur: 0.04, gain: 0.03, type: 'triangle', lp: 3000, delay: d0 + t2, attack: 0.003, pos })); };
    ring(0, 1.1); ring(1.6, 0.45);
  };
  /** coups frappés contre un mur */
  A.knock = function (pos, n) {
    if (!ok()) return;
    const k = n || 3;
    for (let i = 0; i < k; i++) { const d = i * 0.3 + (i === k - 1 && k > 3 ? 0.6 : 0); tone({ freq: 165, freqEnd: 88, dur: 0.09, gain: 0.3, delay: d, pos }); noise({ type: 'lowpass', freq: 1100, dur: 0.06, gain: 0.22, attack: 0.001, delay: d, pos }); }
  };
  /** sirène lointaine, déformée (la sortie s'ouvre : tout converge) */
  A.farSiren = function () {
    if (!ok()) return;
    const t = ctx.currentTime, L = 9.5;
    const ws = ctx.createWaveShaper(), cv = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 255.5 - 1; cv[i] = Math.tanh(x * 4); } ws.curve = cv;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 750; bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 1.6); g.gain.setValueAtTime(0.1, t + L - 2.5); g.gain.exponentialRampToValueAtTime(0.0001, t + L);
    ws.connect(bp); bp.connect(lp); lp.connect(g); g.connect(sfx);
    const wob = ctx.createOscillator(); wob.frequency.value = 0.6; const wg = ctx.createGain(); wg.gain.value = 35; wob.connect(wg);
    [0, 14].forEach(det => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det; wg.connect(o.detune);
      const f = o.frequency; f.setValueAtTime(210, t); f.linearRampToValueAtTime(620, t + 2.6); f.setValueAtTime(620, t + 3.8); f.linearRampToValueAtTime(260, t + 6.5); f.linearRampToValueAtTime(560, t + 8.3); f.linearRampToValueAtTime(180, t + L);
      o.connect(ws); o.start(t); o.stop(t + L + 0.05);
    });
    wob.start(t); wob.stop(t + L + 0.05);
  };
  /** présence : grondement très grave quand quelque chose rôde tout près, en silence (level 0..1) */
  A.presence = function (level) {
    if (!ok()) return;
    if (!presN) {
      if (level < 0.01) return;
      const o = ctx.createOscillator(); o.frequency.value = 31; const o2 = ctx.createOscillator(); o2.frequency.value = 33.4;
      const n = loopSrc(noiseBuf), nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 95; const ng = ctx.createGain(); ng.gain.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g); o2.connect(g); n.connect(nf); nf.connect(ng); ng.connect(g); g.connect(amb); o.start(); o2.start();
      presN = Object.assign(stopper([o, o2, n], [g]), { g });
    }
    presN.g.gain.setTargetAtTime(BR.clamp(level, 0, 1) * 0.16, ctx.currentTime, 0.4);
  };
  /** respiration retenue (cachée dans le noir) : inspiration coupée, fuites par le nez, puis relâchement */
  A.holdBreath = function () { noise({ type: 'bandpass', freq: 1800, freqEnd: 2700, q: 1.2, dur: 0.32, gain: 0.05, attack: 0.08 }); tone({ freq: 140, dur: 0.18, gain: 0.008, lp: 300, delay: 0.3 }); };
  A.breathLeak = function () { noise({ type: 'bandpass', freq: 1100, q: 2.2, dur: 0.45, gain: 0.011, attack: 0.18 }); };
  A.breathRelease = function () { noise({ type: 'bandpass', freq: 1050, freqEnd: 520, q: 1, dur: 1.1, gain: 0.07, attack: 0.06 }); tone({ freq: 150, freqEnd: 108, dur: 0.8, gain: 0.014, type: 'sawtooth', lp: 600, attack: 0.08 }); };
  /** coupure de courant (fusible) : le courant baisse, grésille, puis revient plus faible */
  A.powerDown = function () {
    if (!ok()) return;
    tone({ freq: 118, freqEnd: 34, dur: 1.3, gain: 0.09, type: 'sawtooth', lp: 520 });
    for (let t2 = 0; t2 < 1.1; t2 += 0.05 + Math.random() * 0.1) noise({ type: 'bandpass', freq: 2200 + Math.random() * 3000, q: 3, dur: 0.02 + Math.random() * 0.03, gain: 0.03 + Math.random() * 0.04, delay: t2, attack: 0.001 });
    noise({ type: 'bandpass', freq: 1200, q: 2, dur: 0.05, gain: 0.16, attack: 0.001, delay: 1.15 }); tone({ freq: 80, freqEnd: 40, dur: 0.25, gain: 0.2, delay: 1.15 });
    tone({ freq: 45, freqEnd: 100, dur: 0.8, gain: 0.035, type: 'sawtooth', lp: 400, delay: 1.35, attack: 0.3 });
  };
  /** ralenti du premier contact : souffle grave aspiré */
  A.slowmo = function () { noise({ type: 'lowpass', freq: 200, freqEnd: 1800, dur: 0.6, gain: 0.14, attack: 0.5 }); tone({ freq: 62, freqEnd: 30, dur: 1.6, gain: 0.3, attack: 0.02 }); };
  /** voix de synthèse du navigateur (chuchotement du prénom) : grave, lente, faible. Renvoie false si l'API manque. */
  A.speak = function (text, o) {
    o = o || {};
    const sy = window.speechSynthesis, U = window.SpeechSynthesisUtterance;
    if (!sy || !U || !text || !ok()) return false;
    try {
      const u = new U(String(text));
      const vs = (sy.getVoices && sy.getVoices()) || [], fr = vs.filter(v => /^fr/i.test(v.lang || ''));
      const male = fr.find(v => /paul|henri|claude|thomas|nicolas|mathieu|guillaume|male|homme/i.test(v.name || ''));
      if (male || fr[0]) u.voice = male || fr[0];
      u.lang = (u.voice && u.voice.lang) || 'fr-FR';
      u.rate = o.rate || 0.5; u.pitch = o.pitch == null ? 0.05 : o.pitch;
      u.volume = BR.clamp((o.volume == null ? 0.32 : o.volume) * vol.master * vol.sfx, 0, 1);
      sy.cancel(); sy.speak(u);
      return true;
    } catch (e) { return false; }
  };
  A.hush = function () { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} };

  /* ---------- Ambiance continue ---------- */
  let ambNodes = null;
  A.startAmbience = function (theme) {
    if (!ok()) return;
    A.stopAmbience();
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    const base = theme === 'tunnel' ? 48 : theme === 'pool' ? 62 : theme === 'concrete' ? 44 : 58;
    o.type = 'sine'; o.frequency.value = base; o2.type = 'sine'; o2.frequency.value = base * 2.01; o3.type = 'sawtooth'; o3.frequency.value = base * 2;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const g3 = ctx.createGain(); g3.gain.value = 0.006;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    o.connect(g); o2.connect(g); o3.connect(lp); lp.connect(g3); g.connect(amb); g3.connect(amb);
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = theme === 'pool' ? 900 : 500;
    const ng = ctx.createGain(); ng.gain.value = 0.06;
    n.connect(nf); nf.connect(ng); ng.connect(amb);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(nf.frequency);
    // drone de tension (poursuite)
    const d1 = ctx.createOscillator(); d1.type = 'sawtooth'; d1.frequency.value = 55;
    const d2 = ctx.createOscillator(); d2.type = 'sawtooth'; d2.frequency.value = 58.3;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 260;
    const dg = ctx.createGain(); dg.gain.value = 0;
    d1.connect(dlp); d2.connect(dlp); dlp.connect(dg); dg.connect(amb);
    [o, o2, o3, n, lfo, d1, d2].forEach(x => x.start());
    ambNodes = { stop() { [o, o2, o3, n, lfo, d1, d2].forEach(x => { try { x.stop(); } catch (e) {} }); }, dg, d1, d2, dlp };
  };
  A.stopAmbience = function () {
    if (ambNodes) { ambNodes.stop(); ambNodes = null; }
    [rainN, windN, humN, presN].forEach(n => n && n.stop()); rainN = windN = humN = presN = null;
    A.musicStop(); A.setSpace(0, 0); A.unmuffle(); A.unsilence(0); A.hush();
  };

  /* ---------- espace sonore : réverbération (pièces) et écho (rues) ---------- */
  A.setSpace = function (rev, echo) {
    if (!ctx || !revG) return;
    const t = ctx.currentTime;
    revG.gain.setTargetAtTime(BR.clamp(rev || 0, 0, 1), t, 0.5); echoG.gain.setTargetAtTime(BR.clamp(echo || 0, 0, 1), t, 0.5);
  };

  /* ---------- boucles d'environnement (créées à la demande, coupées par stopAmbience) ---------- */
  function loopSrc(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration); return s; }
  function stopper(nodes, gains) {
    return { stop() { const t = ctx.currentTime; gains.forEach(g => g.gain.setTargetAtTime(0, t, 0.15)); nodes.forEach(n => { try { n.stop(t + 0.8); } catch (e) {} }); } };
  }
  // pluie : bruit large + milliers de petites gouttes (tampon de 3 s fabriqué une fois)
  function makeRainBuf() {
    const sr = ctx.sampleRate, n = sr * 3, b = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; lp += (w - lp) * 0.55; d[i] = lp * 0.16; }
      for (let k = 0; k < 2600; k++) {
        const p = Math.floor(Math.random() * (n - 600)), a = Math.pow(Math.random(), 3) * 0.5, f = (1800 + Math.random() * 4500) / sr * 6.283, len = 80 + Math.floor(Math.random() * 380);
        for (let j = 0; j < len; j++) d[p + j] += Math.sin(j * f) * a * Math.exp(-j / (len * 0.25));
      }
      // raccord de boucle sans clic
      for (let j = 0; j < 400; j++) { const k = j / 400; d[j] = d[j] * k + d[n - 400 + j] * (1 - k); }
    }
    return b;
  }
  let rainN = null, windN = null, humN = null;
  /** pluie : level 0..1, indoor 0..1 (sous un toit : étouffée, tambourinement sourd) */
  A.rain = function (level, indoor) {
    if (!ok()) return;
    if (!rainN) {
      if (level < 0.01) return;
      if (!rainBuf) rainBuf = makeRainBuf();
      const s = loopSrc(rainBuf), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
      const out = ctx.createGain(); out.gain.value = 0;
      const lpI = ctx.createBiquadFilter(); lpI.type = 'lowpass'; lpI.frequency.value = 650; const inn = ctx.createGain(); inn.gain.value = 0;
      s.connect(hp); hp.connect(out); out.connect(amb); hp.connect(lpI); lpI.connect(inn); inn.connect(amb);
      // tambourinement grave sur le toit
      const s2 = loopSrc(noiseBuf), lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 180; const roof = ctx.createGain(); roof.gain.value = 0;
      s2.connect(lp2); lp2.connect(roof); roof.connect(amb);
      rainN = Object.assign(stopper([s, s2], [out, inn, roof]), { out, inn, roof });
    }
    const t = ctx.currentTime, l = BR.clamp(level, 0, 1), i = BR.clamp(indoor || 0, 0, 1);
    rainN.out.gain.setTargetAtTime(l * (1 - i) * 0.55, t, 0.35);
    rainN.inn.gain.setTargetAtTime(l * i * 0.5, t, 0.35);
    rainN.roof.gain.setTargetAtTime(l * i * 0.35, t, 0.35);
  };
  /** vent : rafales (filtre et volume qui ondulent lentement) */
  A.wind = function (level, indoor) {
    if (!ok()) return;
    if (!windN) {
      if (level < 0.01) return;
      const s = loopSrc(noiseBuf), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 480; f.Q.value = 0.8;
      const lf = ctx.createOscillator(); lf.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 260; lf.connect(lg); lg.connect(f.frequency);
      const gust = ctx.createGain(); gust.gain.value = 0.7; const lf2 = ctx.createOscillator(); lf2.frequency.value = 0.13; const lg2 = ctx.createGain(); lg2.gain.value = 0.3; lf2.connect(lg2); lg2.connect(gust.gain);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(gust); gust.connect(lp); lp.connect(g); g.connect(amb); lf.start(); lf2.start();
      windN = Object.assign(stopper([s, lf, lf2], [g]), { g, lp });
    }
    const t = ctx.currentTime, i = BR.clamp(indoor || 0, 0, 1);
    windN.g.gain.setTargetAtTime(BR.clamp(level, 0, 1) * (1 - i * 0.7) * 0.2, t, 0.5);
    windN.lp.frequency.setTargetAtTime(4000 - i * 3500, t, 0.5);
  };
  /** bourdonnement électrique des néons proches (level 0..1) */
  A.hum = function (level) {
    if (!ok()) return;
    if (!humN) {
      if (level < 0.01) return;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 200.4;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const bz = loopSrc(noiseBuf), bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 3800; bf.Q.value = 2; const bg = ctx.createGain(); bg.gain.value = 0.25;
      const g = ctx.createGain(); g.gain.value = 0;
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); bz.connect(bf); bf.connect(bg); bg.connect(g); g.connect(amb); o.start(); o2.start();
      humN = Object.assign(stopper([o, o2, bz], [g]), { g });
    }
    humN.g.gain.setTargetAtTime(BR.clamp(level, 0, 1) * 0.045, ctx.currentTime, 0.12);
  };

  /* =====================================================================
     MUSIQUE DE TENSION EN COUCHES (synthétisée) : calme → inquiétant → poursuite
     level 0..1 = proximité du monstre le plus proche ; chase = il nous poursuit
     ===================================================================== */
  let mz = null;
  const SH_F = [880, 932.3, 1046.5, 1108.7];
  const ss = (a, b, x) => { const t = BR.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function musicBuild() {
    const out = ctx.createGain(); out.gain.value = 1; out.connect(musB);
    const L1 = ctx.createGain(); L1.gain.value = 0; L1.connect(out);
    const L2 = ctx.createGain(); L2.gain.value = 0; L2.connect(out);
    const nodes = [];
    const osc = (type, f, dst, g, det) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; const gg = ctx.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(dst); o.start(); nodes.push(o); return { o, g: gg }; };
    // nappe dissonante grave (seconde mineure) qui « respire »
    const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 420; padF.Q.value = 3; padF.connect(L1);
    osc('sawtooth', 55, padF, 0.06); osc('sawtooth', 58.27, padF, 0.05, 6); osc('triangle', 110, padF, 0.05, -5); osc('sawtooth', 82.4, padF, 0.025, 4);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(padF.frequency); lfo.start(); nodes.push(lfo);
    // aigus vitreux qui tremblent
    const gl = ctx.createGain(); gl.gain.value = 0.6; gl.connect(L1);
    osc('sine', 1318.5, gl, 0.011); osc('sine', 1396.9, gl, 0.009); osc('sine', 1975.5, gl, 0.004, 9);
    const trem = ctx.createOscillator(); trem.frequency.value = 5.7; const tg = ctx.createGain(); tg.gain.value = 0.5; trem.connect(tg); tg.connect(gl.gain); trem.start(); nodes.push(trem);
    // poursuite : nappe stridente qui monte avec la proximité
    const shF = ctx.createBiquadFilter(); shF.type = 'bandpass'; shF.frequency.value = 1600; shF.Q.value = 1.2;
    const shG = ctx.createGain(); shG.gain.value = 0; shF.connect(shG); shG.connect(L2);
    const sh = SH_F.map((f, i) => osc('sawtooth', f, shF, 0.02, (i - 1.5) * 7));
    mz = { out, L1, L2, padF, shG, shF, sh, nodes, next: ctx.currentTime + 0.1, step: 0, ch: 0 };
  }
  const NOTES = [110, 110, 116.5, 110, 110, 130.8, 110, 116.5, 110, 110, 116.5, 110, 146.8, 138.6, 130.8, 116.5];
  function beat(at, s, lv, c) {
    const d = Math.max(0, at - ctx.currentTime), b = mz.L1, b2 = mz.L2, bar = s % 16;
    // inquiétant : battement sourd lent (« lub-dub ») + tintement métallique irrégulier
    if (bar % 8 === 0) tone({ freq: 58, freqEnd: 36, dur: 0.7, gain: 0.22, bus: b, delay: d, lp: 300 });
    if (bar % 8 === 1) tone({ freq: 56, freqEnd: 35, dur: 0.5, gain: 0.12, bus: b, delay: d, lp: 300 });
    if (Math.random() < 0.05) tone({ freq: 2400 + Math.random() * 1500, dur: 0.3, gain: 0.01, type: 'triangle', bus: b, delay: d });
    if (c < 0.02) return;
    // poursuite : grosse caisse, ostinato de cordes staccato, charleston, coup tous les 16 temps
    if (bar % 4 === 0 || (lv > 0.75 && bar % 4 === 3)) { tone({ freq: 125, freqEnd: 42, dur: 0.22, gain: 0.45, bus: b2, delay: d }); noise({ type: 'lowpass', freq: 900, dur: 0.05, gain: 0.1, bus: b2, delay: d }); }
    const f = NOTES[bar];
    tone({ freq: f, dur: 0.13, gain: 0.085, type: 'sawtooth', lp: 900 + lv * 1400, q: 2, bus: b2, delay: d, attack: 0.005 });
    tone({ freq: f * 2, dur: 0.1, gain: 0.035, type: 'sawtooth', lp: 1600, bus: b2, delay: d, detune: 8 });
    if (bar % 2 === 1) noise({ type: 'highpass', freq: 7000, dur: 0.04, gain: 0.04, bus: b2, delay: d });
    if (bar === 0) { noise({ type: 'lowpass', freq: 2500, freqEnd: 200, dur: 1.2, gain: 0.22, bus: b2, delay: d }); tone({ freq: 46, freqEnd: 30, dur: 1.2, gain: 0.28, bus: b2, delay: d }); }
  }
  A.music = function (level, chase, calm) {
    if (!ok()) return;
    level = BR.clamp(level || 0, 0, 1);
    if (!mz) { if (level < 0.05) return; musicBuild(); }
    const t = ctx.currentTime;
    const u = ss(0.1, 0.45, level), c = chase ? ss(0.42, 0.85, level) : 0;
    mz.ch = c * (calm ? 0.5 : 1);
    mz.L1.gain.setTargetAtTime(u * (1 - c * 0.5) * 0.9, t, 0.6);
    mz.L2.gain.setTargetAtTime(mz.ch, t, 0.35);
    mz.shG.gain.setTargetAtTime(0.25 + 0.75 * c, t, 0.3);
    mz.sh.forEach((s, i) => s.o.frequency.setTargetAtTime(SH_F[i] * (1 + 0.12 * level), t, 0.8));
    mz.shF.frequency.setTargetAtTime(1200 + 1800 * level, t, 0.5);
    const e = 60 / (92 + 70 * level) / 2;          // croche : le tempo accélère quand il se rapproche
    if (mz.next < t) mz.next = t + 0.03;
    while (mz.next < t + 0.2) { beat(mz.next, mz.step++, level, c); mz.next += e; }
  };
  A.musicStop = function () {
    if (!mz || !ctx) { mz = null; return; }
    const m = mz, t = ctx.currentTime; mz = null;
    m.out.gain.setTargetAtTime(0, t, 0.3);
    m.nodes.forEach(n => { try { n.stop(t + 1.5); } catch (e) {} });
  };
  A.setTension = function (t) {          // 0..1
    if (!ambNodes || !ok()) return;
    const now = ctx.currentTime;
    ambNodes.dg.gain.setTargetAtTime(t * 0.16, now, 0.3);
    ambNodes.dlp.frequency.setTargetAtTime(220 + t * 700, now, 0.3);
    ambNodes.d1.frequency.setTargetAtTime(55 + t * 22, now, 0.5);
    ambNodes.d2.frequency.setTargetAtTime(58.3 + t * 24, now, 0.5);
  };

  /* =====================================================================
     ÉCHANTILLONS (sons.js : sons téléchargés, encodés en base64 pour marcher même en double-clic)
     ===================================================================== */
  const buffers = {}, memeByName = {}; let memes = [];
  function b64(d) { const s = d.indexOf(','), bin = atob(d.slice(s + 1)), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function decode(d) { return new Promise(res => { try { ctx.decodeAudioData(b64(d), b => res(b), () => res(null)); } catch (e) { res(null); } }); }
  A.loadSamples = async function () {
    ensure(); if (!ctx) return 0;
    const S = window.GAME_SOUNDS || {};
    for (const k in (S.sfx || {})) buffers[k] = await decode(S.sfx[k]);
    memes = (await Promise.all((S.memes || []).map(async o => { const b = await decode(o.d); if (b && o.n) memeByName[o.n] = b; return b; }))).filter(Boolean);
    // sons propres à certaines images de monstres (fichier son du même nom dans « monstres »)
    if (BR.Ent) for (const s of BR.Ent.sprites) if (s.sound && !s.buf) s.buf = await decode(s.sound);
    return memes.length;
  };
  A.sample = function (name, gain, panv, rate) {
    const b = buffers[name]; if (!ok() || !b) return false;
    const s = ctx.createBufferSource(); s.buffer = b; if (rate) s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain == null ? 1 : gain;
    chain(s, g, panv); s.start();
    return true;
  };
  A.hasSample = n => !!buffers[n];
  /** son « mème » de sons.js joué par son nom (yeah_boy, goofy_horn, sus, what, wait_minute…) ; false s'il n'existe pas */
  A.meme = function (name, gain, rate, panv) {
    const b = memeByName[name]; if (!ok() || !b) return false;
    const s = ctx.createBufferSource(); s.buffer = b; if (rate) s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = gain == null ? 0.8 : gain;
    chain(s, g, panv); s.start();
    return true;
  };
  A.memeNames = () => Object.keys(memeByName);
  // chaque image de monstre a « son » cri (même attribution chez tous les joueurs)
  function memeFor(sp) {
    const s = BR.Ent && BR.Ent.sprite(sp);
    if (s && s.buf) return s.buf;
    if (!memes.length) return null;
    return memes[((sp * 7 + 3) % memes.length + memes.length) % memes.length];
  }
  A.memeBuffer = memeFor;
  /** voix en boucle, spatialisée, d'une entité */
  A.botVoice = function (sp) {
    if (!ok()) return null;
    const buf = memeFor(sp); if (!buf) return null;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0;
    const pn = ctx.createPanner();
    pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 3; pn.rolloffFactor = 1.15; pn.maxDistance = 90;
    const an = ctx.createAnalyser(); an.fftSize = 256; const data = new Uint8Array(an.fftSize);
    src.connect(g); g.connect(pn); pn.connect(sfx); src.connect(an);
    src.start(0, Math.random() * buf.duration);
    let stopped = false;
    return {
      set(x, y, z, gain) {
        const t = ctx.currentTime;
        if (pn.positionX) { pn.positionX.setTargetAtTime(x, t, 0.05); pn.positionY.setTargetAtTime(y, t, 0.05); pn.positionZ.setTargetAtTime(z, t, 0.05); } else pn.setPosition(x, y, z);
        g.gain.setTargetAtTime(gain, t, 0.15);
      },
      amp() { an.getByteTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i += 4) { const v = (data[i] - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / (data.length / 4)) * 3); },
      stop() { if (stopped) return; stopped = true; const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.1); try { src.stop(t + 0.5); } catch (e) {} },
    };
  };
  /** cri de l'entité, très fort, pour le jumpscare */
  A.botScream = function (sp) {
    const buf = memeFor(sp); if (!ok() || !buf) return;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = 0.92;
    const g = ctx.createGain(); g.gain.value = 1.6; const ds = ctx.createWaveShaper();
    const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3); } ds.curve = curve;
    s.connect(ds); ds.connect(g); g.connect(sfx); s.start(0, 0); s.stop(ctx.currentTime + 1.6);
  };
  A.listener = function (pos, fwd) {
    if (!ok()) return;
    const L = ctx.listener, t = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(pos.x, t, 0.02); L.positionY.setTargetAtTime(pos.y, t, 0.02); L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  };

  /* =====================================================================
     MUSIQUE (fichiers mp3 lus par <audio> : fonctionne aussi en double-clic)
     ===================================================================== */
  const chans = { music: { el: null, name: '', vol: 0, target: 0, base: 1 }, amb: { el: null, name: '', vol: 0, target: 0, base: 1 } };
  let fadeTimer = null;
  function musicTick() {
    for (const k in chans) {
      const c = chans[k]; if (!c.el) continue;
      c.el.volume = BR.clamp(c.vol * c.base * vol.mus * vol.master * duckK, 0, 1);
      if (ready && c.el.paused && c.target > 0) { const p = c.el.play(); if (p && p.catch) p.catch(() => {}); }
    }
  }
  function fade() {
    let busy = false;
    for (const k in chans) {
      const c = chans[k];
      if (c.old) { c.old.v -= 0.05; if (c.old.v <= 0) { c.old.el.pause(); c.old = null; } else { c.old.el.volume = BR.clamp(c.old.v * c.old.base * vol.mus * vol.master, 0, 1); busy = true; } }
      if (Math.abs(c.vol - c.target) > 0.01) { c.vol += Math.sign(c.target - c.vol) * 0.04; busy = true; } else c.vol = c.target;
    }
    musicTick();
    if (!busy) { clearInterval(fadeTimer); fadeTimer = null; }
  }
  /** joue une piste (dans sons/musique) sur un canal ('music' ou 'amb'), avec fondu */
  A.track = function (chan, name, level) {
    const c = chans[chan]; if (!c) return;
    level = level == null ? 1 : level;
    if (c.name === name) { c.target = name ? 1 : 0; c.base = level; if (!fadeTimer) fadeTimer = setInterval(fade, 50); return; }
    if (c.el) c.old = { el: c.el, v: c.vol, base: c.base };
    c.name = name || ''; c.el = null; c.vol = 0; c.target = 0; c.base = level;
    if (name) { const el = new Audio('sons/musique/' + name + '.mp3'); el.loop = true; el.volume = 0; c.el = el; c.target = 1; }
    if (!fadeTimer) fadeTimer = setInterval(fade, 50);
    musicTick();
  };
  A.trackLevel = function (chan, level) { const c = chans[chan]; if (c) { c.base = level; musicTick(); } };
})();

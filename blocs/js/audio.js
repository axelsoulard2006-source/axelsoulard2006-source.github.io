/* ===== audio.js : sons procéduraux (Web Audio, aucun fichier) et musique d'ambiance douce
   Remplace G.sfx(nom, options) avec la même signature. options : { id: bloc, dist: distance au joueur, vol }.
   Pas selon le bloc sous les pieds, éclaboussures, minage, explosion, créatures…
   Musique : petites phrases de piano et de clochettes générées au hasard, avec beaucoup de silence. ===== */
(function () {
  const VX = window.VX, B = VX.B, D = VX.BLOCKS, G = VX.G, H = VX.hooks;
  const KEY = 'blocaria_audio_v1';
  const A = VX.Audio = { ctx: null, vol: { sfx: 0.8, music: 0.4 } };
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s.sfx != null) A.vol.sfx = +s.sfx; if (s.music != null) A.vol.music = +s.music; } catch (e) {}
  let ctx = null, sfxBus, musBus, rev, noiseBuf;

  /* ---------- mise en route (après un geste du joueur, exigé par les navigateurs) ---------- */
  function ensure() {
    if (!ctx) {
      try { ctx = A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = A.vol.sfx; sfxBus.connect(comp);
      musBus = ctx.createGain(); musBus.gain.value = A.vol.music * 0.5; musBus.connect(comp);
      // réverbération : réponse impulsionnelle de bruit qui décroît (générée une fois)
      const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      rev = ctx.createConvolver(); rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.55; rev.connect(rg); rg.connect(musBus);
      // une seconde de bruit blanc réutilisée par tous les sons
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  for (const ev of ['mousedown', 'keydown', 'touchstart']) document.addEventListener(ev, ensure, { passive: true });
  A.setVol = function (k, v) {
    A.vol[k] = Math.max(0, Math.min(1, v)); try { localStorage.setItem(KEY, JSON.stringify(A.vol)); } catch (e) {}
    if (!ctx) return; if (k === 'sfx') sfxBus.gain.value = A.vol.sfx; else musBus.gain.setTargetAtTime(A.vol.music * 0.5, ctx.currentTime, 0.1);
  };

  /* ---------- briques de synthèse ---------- */
  // bruit filtré avec enveloppe ; f2 = fréquence finale du filtre (balayage)
  function noise(t, dur, vol, type, f, f2, q, out, atk) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q || 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (atk || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out || sfxBus); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.02);
  }
  function tone(t, f, f2, dur, type, vol, out, atk) {
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2 && f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (atk || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || sfxBus); o.start(t); o.stop(t + dur + 0.02); return o;
  }
  // voix de créature : oscillateur en dents de scie à travers un filtre « voyelle », avec vibrato
  function voice(t, f, f2, dur, formant, vol, vib, out) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f2, t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = vib || 6; lg.gain.value = f * 0.04; lfo.connect(lg); lg.connect(o.frequency);
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = formant; fl.Q.value = 2.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.05); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(out || sfxBus); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  /* ---------- matière d'un bloc (pour les pas, le minage, la pose) ---------- */
  function matOf(id) {
    if (id == null) return 'pierre';
    if (id === B.HERBE || id === B.FEUILLES || id === B.MOUSSE || id === B.CHAPEAU) return 'herbe';
    if (id === B.TERRE) return 'terre';
    if (id === B.SABLE) return 'sable';
    if (id === B.NEIGE) return 'neige';
    if (id === B.EAU) return 'eau';
    if (id === B.VERRE || id === B.LUMICRISTAL) return 'verre';
    if (id === B.TRONC || id === B.PLANCHES || id === B.ETABLI || id === B.TIGE || id === (B.COFFRE != null ? B.COFFRE : 40)) return 'bois';
    const b = D[id]; if (!b) return 'pierre';
    const n = (b.name || '').toLowerCase();
    if (/laine|tapis/.test(n)) return 'laine';
    return b.tool === 'pelle' ? 'terre' : b.tool === 'hache' ? 'bois' : 'pierre';
  }
  A.matOf = matOf;
  // un pas (ou un petit coup) dans une matière ; k = force (0.4 accroupi … 1.3 pose/casse)
  function matHit(t, m, k, long) {
    const r = 0.85 + Math.random() * 0.3, L = long ? 2 : 1;
    switch (m) {
      case 'herbe': noise(t, 0.09 * L, 0.16 * k, 'bandpass', 2600 * r, 1500, 0.9); noise(t + 0.025, 0.07 * L, 0.1 * k, 'highpass', 3500 * r, 0, 0.7); break;
      case 'terre': noise(t, 0.09 * L, 0.2 * k, 'lowpass', 1200 * r, 500, 1); break;
      case 'sable': noise(t, 0.14 * L, 0.16 * k, 'bandpass', 1800 * r, 900, 0.6, null, 0.03); break;
      case 'neige': for (let i = 0; i < 3; i++) noise(t + i * 0.022, 0.05 * L, 0.11 * k, 'bandpass', (1400 + i * 500) * r, 0, 2.5); break;
      case 'bois': noise(t, 0.06 * L, 0.14 * k, 'bandpass', 700 * r, 400, 3); tone(t, 210 * r, 150, 0.09 * L, 'triangle', 0.12 * k); break;
      case 'verre': tone(t, 2400 * r, 2100, 0.08, 'sine', 0.06 * k); noise(t, 0.05 * L, 0.12 * k, 'highpass', 3000, 0, 1); break;
      case 'eau': noise(t, 0.22, 0.13 * k, 'bandpass', 900 * r, 350, 1.2, null, 0.03); break;
      case 'laine': noise(t, 0.1 * L, 0.12 * k, 'lowpass', 700 * r, 300, 0.7, null, 0.02); break;
      default: noise(t, 0.05 * L, 0.2 * k, 'bandpass', 1500 * r, 900, 1.6); tone(t, 95 * r, 70, 0.06, 'sine', 0.12 * k); break;   // pierre
    }
  }

  /* ---------- catalogue des sons ---------- */
  const S = {
    dig: (t, o) => matHit(t, matOf(o.id), 0.75),
    break: (t, o) => { const m = matOf(o.id); matHit(t, m, 1.3, true); matHit(t + 0.04, m, 0.9); if (m === 'verre') for (let i = 0; i < 4; i++) tone(t + i * 0.03, 1800 + Math.random() * 1800, 0, 0.12, 'sine', 0.05); },
    place: (t, o) => { const m = matOf(o.id); matHit(t, m, 1.1); tone(t, 120, 80, 0.06, 'sine', 0.1); },
    step: (t, o) => matHit(t, o.mat || 'pierre', o.vol || 0.6),
    pop: t => { tone(t, 620, 1250, 0.07, 'sine', 0.14); tone(t + 0.04, 900, 1600, 0.06, 'sine', 0.08); },
    craft: t => { tone(t, 700, 1100, 0.07, 'triangle', 0.1); noise(t, 0.05, 0.06, 'bandpass', 2000, 0, 2); },
    eat: t => { for (let i = 0; i < 3; i++) noise(t + i * 0.11, 0.07, 0.17, 'bandpass', 1500 + Math.random() * 1200, 700, 1.5); },
    hurt: t => { tone(t, 330, 170, 0.18, 'triangle', 0.16); noise(t, 0.08, 0.12, 'lowpass', 1400, 300, 1); },
    fall: t => { tone(t, 95, 40, 0.22, 'sine', 0.35); noise(t, 0.16, 0.28, 'lowpass', 600, 120, 1); tone(t + 0.02, 300, 160, 0.14, 'triangle', 0.1); },
    block: t => { tone(t, 900, 700, 0.06, 'square', 0.04); noise(t, 0.05, 0.1, 'highpass', 2500, 0, 1); },
    equip: t => { noise(t, 0.08, 0.12, 'bandpass', 2200, 1400, 2); tone(t + 0.03, 520, 600, 0.08, 'triangle', 0.06); },
    chest: t => { tone(t, 180, 120, 0.18, 'triangle', 0.12); noise(t, 0.2, 0.08, 'bandpass', 500, 300, 3, null, 0.04); },
    toolbreak: t => { noise(t, 0.2, 0.25, 'highpass', 2500, 0, 1); for (let i = 0; i < 3; i++) tone(t + i * 0.04, 1400 - i * 300, 600, 0.1, 'square', 0.04); },
    splash: t => { noise(t, 0.45, 0.28, 'bandpass', 1400, 300, 0.8, null, 0.01); for (let i = 0; i < 5; i++) tone(t + 0.05 + Math.random() * 0.3, 500 + Math.random() * 700, 1300, 0.05, 'sine', 0.05); },
    swim: t => noise(t, 0.3, 0.1, 'bandpass', 700, 300, 1, null, 0.06),
    bubble: t => { for (let i = 0; i < 3; i++) tone(t + i * 0.07, 400 + Math.random() * 300, 900, 0.06, 'sine', 0.07); },
    explode: t => { noise(t, 1.6, 0.9, 'lowpass', 2400, 70, 0.7, null, 0.003); tone(t, 75, 28, 1.1, 'sine', 0.7); noise(t + 0.05, 0.9, 0.3, 'bandpass', 600, 120, 0.5); },
    fuse: (t, o) => { tone(t, 1900, 1700, 0.03, 'square', 0.05 * (o.vol || 1)); noise(t, 0.04, 0.05 * (o.vol || 1), 'highpass', 4000, 0, 1); },
    arrow: t => { noise(t, 0.06, 0.14, 'bandpass', 900, 500, 3); tone(t, 180, 120, 0.05, 'triangle', 0.08); },
    hit: t => { noise(t, 0.07, 0.25, 'lowpass', 1600, 400, 1); tone(t, 160, 90, 0.08, 'sine', 0.15); },
    poof: t => { noise(t, 0.35, 0.18, 'bandpass', 900, 2200, 0.8, null, 0.02); tone(t, 500, 900, 0.1, 'sine', 0.06); },
    sizzle: t => noise(t, 0.5, 0.1, 'highpass', 3000, 5000, 0.5, null, 0.05),
    portal: t => { tone(t, 120, 480, 1.2, 'sine', 0.1); tone(t, 180, 60, 1.2, 'triangle', 0.08); },
    fizz: t => noise(t, 0.4, 0.15, 'highpass', 3000, 0, 0.5),
    // agriculture
    till: t => { noise(t, 0.16, 0.22, 'lowpass', 1100, 380, 1.2); noise(t + 0.07, 0.12, 0.14, 'bandpass', 700, 300, 1.5); tone(t, 140, 90, 0.08, 'triangle', 0.08); },
    plant: t => { noise(t, 0.07, 0.1, 'bandpass', 1300, 800, 1.2); tone(t + 0.02, 330, 440, 0.07, 'sine', 0.05); },
    harvest: (t, o) => { noise(t, 0.12, 0.16, 'highpass', 2600, 0, 0.8, null, 0.01); noise(t + 0.03, 0.1, 0.12, 'bandpass', 1500, 700, 2); if (o.ripe) for (let i = 0; i < 3; i++) noise(t + 0.05 + i * 0.04, 0.05, 0.08, 'bandpass', 3000 + i * 600, 0, 3); },
    // arc, bouclier, coups
    bowdraw: t => { const o = tone(t, 70, 120, 0.9, 'sawtooth', 0.025, null, 0.2); noise(t, 0.9, 0.05, 'bandpass', 500, 900, 6, null, 0.3); return o; },
    bowready: t => { tone(t, 1250, 1250, 0.05, 'square', 0.02); },
    bow: (t, o) => { const k = o.k == null ? 1 : o.k; noise(t, 0.22, 0.12 + 0.12 * k, 'bandpass', 2600, 500, 1.2, null, 0.005); tone(t, 220, 110, 0.12, 'triangle', 0.1); },
    arrowhit: t => { noise(t, 0.08, 0.22, 'lowpass', 900, 300, 1); tone(t, 150, 80, 0.09, 'sine', 0.14); },
    shield: t => { tone(t, 170, 95, 0.14, 'triangle', 0.22); noise(t, 0.1, 0.22, 'bandpass', 650, 350, 3); noise(t, 0.05, 0.1, 'highpass', 3200, 0, 1); },
    shieldup: t => { noise(t, 0.06, 0.08, 'bandpass', 1600, 900, 1.5); tone(t, 260, 300, 0.05, 'triangle', 0.04); },
    crit: t => { noise(t, 0.08, 0.16, 'highpass', 3200, 0, 1); tone(t, 900, 1700, 0.09, 'sine', 0.07); tone(t + 0.03, 1350, 2400, 0.08, 'sine', 0.04); },
    // expérience : petite clochette (hauteur au hasard) et arpège de niveau
    xp: t => { const f = 1300 + Math.random() * 700; tone(t, f, f, 0.16, 'sine', 0.07); tone(t, f * 2.76, f * 2.76, 0.08, 'sine', 0.015); },
    levelup: t => { [0, 4, 7, 12].forEach((n, i) => { const f = 523.25 * Math.pow(2, n / 12); tone(t + i * 0.09, f, f, 0.5, 'triangle', 0.09); tone(t + i * 0.09, f * 2, f * 2, 0.3, 'sine', 0.03); }); },
    // tonnerre : claquement (si proche) puis grondement qui roule ; o.near 0..1
    thunder: (t, o) => {
      const n = o.near == null ? 0.5 : o.near;
      if (n > 0.4) { noise(t, 0.35, 0.5 * n, 'highpass', 1800, 400, 0.7, null, 0.003); noise(t, 0.6, 0.45 * n, 'lowpass', 3000, 200, 0.6, null, 0.005); }
      for (let i = 0; i < 4; i++) noise(t + 0.08 + i * (0.35 + Math.random() * 0.4), 2.2 + Math.random() * 1.6, (0.22 + 0.25 * n) * (1 - i * 0.18), 'lowpass', 420 - i * 60, 60, 0.9, null, 0.12);
      tone(t + 0.05, 55, 32, 2.5, 'sine', 0.25 * (0.4 + n));
    },
    // créatures (voix inventées pour Blocaria)
    mouton: t => { voice(t, 330, 300, 0.5, 1300, 0.12, 9); },
    cochon: t => { for (let i = 0; i < 2; i++) voice(t + i * 0.17, 150, 120, 0.14, 700, 0.12, 25); },
    vache: t => { voice(t, 115, 95, 1.0, 500, 0.15, 4); },
    zombi: t => { voice(t, 95, 75, 0.9, 420, 0.13, 3); noise(t, 0.8, 0.04, 'lowpass', 500, 200, 1, null, 0.2); },
    squelette: t => { for (let i = 0; i < 5; i++) noise(t + i * 0.05 + Math.random() * 0.02, 0.025, 0.1, 'bandpass', 2400 + Math.random() * 1500, 0, 4); },
    braiseron: t => { tone(t, 140, 90, 0.4, 'square', 0.04); noise(t, 0.5, 0.06, 'bandpass', 400, 900, 2, null, 0.1); },
  };
  A.sounds = S;   // catalogue (tests)
  G.sfx = function (k, o) {
    o = o || {}; if (A.vol.sfx <= 0 || !ensure() || ctx.state !== 'running') return;
    const fn = S[k]; if (!fn) return;
    try {
      if (o.dist != null) {   // atténuation avec la distance : on passe par un petit bus de volume
        const v = Math.max(0, 1 - o.dist / 24); if (v <= 0.02) return;
        const g = ctx.createGain(); g.gain.value = v; g.connect(sfxBus); const save = sfxBus; sfxBus = g; try { fn(ctx.currentTime + 0.005, o); } finally { sfxBus = save; }
      } else fn(ctx.currentTime + 0.005, o);
    } catch (e) {}
  };

  /* ---------- pluie : bruit continu (sifflement + crépitement), étouffé sous un toit ----------
     A.rain(niveau 0..1, abrité) — appelé à chaque image par weather.js */
  let rainNodes = null;
  A.rain = function (level, indoor) {
    if (!ctx || ctx.state !== 'running') return;
    if (!rainNodes) {
      if (level <= 0.001) return;
      const mk = (type, f, q) => { const sN = ctx.createBufferSource(); sN.buffer = noiseBuf; sN.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; sN.connect(fl); sN.start(0, Math.random()); return fl; };
      const hiss = mk('highpass', 2400, 0.5), patter = mk('bandpass', 1100, 0.7), low = mk('lowpass', 300, 0.7);
      const mufl = ctx.createBiquadFilter(); mufl.type = 'lowpass'; mufl.frequency.value = 12000; mufl.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0; const gh = ctx.createGain(); gh.gain.value = 0.55; const gp = ctx.createGain(); gp.gain.value = 0.5; const gl = ctx.createGain(); gl.gain.value = 0.35;
      hiss.connect(gh); patter.connect(gp); low.connect(gl); gh.connect(mufl); gp.connect(mufl); gl.connect(mufl); mufl.connect(g); g.connect(sfxBus);
      rainNodes = { g, mufl };
    }
    const tt = ctx.currentTime;
    rainNodes.g.gain.setTargetAtTime(Math.max(0, level) * 0.22 * (indoor ? 0.55 : 1), tt, 0.4);
    rainNodes.mufl.frequency.setTargetAtTime(indoor ? 650 : 12000, tt, 0.3);
  };

  /* ---------- pas, nage, éclaboussures ---------- */
  let stepD = 0, wasWater = false, wasGround = true, fallV = 0, swimT = 0;
  H.on('playerTick', ({ dt, player: P }) => {
    const hs = Math.hypot(P.vel.x, P.vel.z);
    if (!P.onGround) fallV = Math.min(fallV, P.vel.y);
    if (P.inWater && !wasWater && fallV < -5) G.sfx('splash');
    if (P.inWater && hs > 1 && (swimT -= dt) <= 0) { swimT = 0.7; G.sfx('swim'); }
    if (P.onGround && !P.fly && !P.inWater) {
      const under = () => G.world.get(Math.floor(P.pos.x), Math.floor(P.pos.y - 0.2), Math.floor(P.pos.z));
      if (!wasGround && fallV < -6) G.sfx('step', { mat: matOf(under()), vol: 0.9 });   // réception
      if (hs > 0.6) { stepD += hs * dt; if (stepD > (P.sprint ? 2.2 : 1.75)) { stepD = 0; G.sfx('step', { mat: matOf(under()), vol: P.sneak ? 0.3 : P.sprint ? 0.8 : 0.6 }); } }
    }
    if (P.onGround || P.inWater) fallV = 0;
    wasWater = P.inWater; wasGround = P.onGround;
  });

  /* ---------- musique d'ambiance : piano et clochettes, phrases courtes et beaucoup de silence ---------- */
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  // instrument « piano doux » : quelques partiels qui s'éteignent, filtre passe-bas
  function piano(t, n, vel, out) {
    const f = midi(n), g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2200; fl.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.008); g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    for (const [m, a] of [[1, 1], [2, 0.32], [3, 0.1], [4.02, 0.05]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * m; o.detune.value = (Math.random() - 0.5) * 6; og.gain.value = a; o.connect(og); og.connect(fl); o.start(t); o.stop(t + 3.3); }
    g.connect(out); g.connect(rev);
  }
  // instrument « clochette » : partiels inharmoniques
  function bell(t, n, vel, out) {
    const f = midi(n);
    for (const [m, a, d] of [[1, 1, 2.6], [2.76, 0.3, 1.2], [5.4, 0.12, 0.6], [8.93, 0.05, 0.3]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * m; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out); g.connect(rev); o.start(t); o.stop(t + d + 0.05);
    }
  }
  // accords (degrés de la gamme) — tonalité qui change doucement d'une phrase à l'autre
  const SCALE = [0, 2, 4, 5, 7, 9, 11], PROG = [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1], [1, 3, 5], [3, 5, 0, 2]];
  let root = 60, chordI = 0, nextPhrase = 0;
  const deg = (d, oct) => root + SCALE[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + (oct || 0));
  function phrase(t0) {
    A.phrases = (A.phrases || 0) + 1;
    const ch = PROG[chordI++ % PROG.length], night = G.dim === 'surface' && VX.R.uniforms.uDay.value < 0.4, braises = G.dim === 'braises';
    const inst = braises || night || Math.random() < 0.3 ? bell : piano;
    piano(t0, deg(ch[0], -2), 0.16, musBus);   // basse
    let t = t0 + 0.2 + Math.random() * 0.3; const notes = 3 + Math.floor(Math.random() * 5);
    let d = ch[Math.floor(Math.random() * ch.length)] + 7;
    for (let i = 0; i < notes; i++) {
      inst(t, deg(d, braises ? -1 : 0), 0.07 + Math.random() * 0.05, musBus);
      d += [-2, -1, 1, 2, 2, 3][Math.floor(Math.random() * 6)]; if (Math.random() < 0.5) d = ch[Math.floor(Math.random() * ch.length)] + 7 + (Math.random() < 0.3 ? 7 : 0);
      t += [0.42, 0.6, 0.84, 1.2][Math.floor(Math.random() * 4)];
    }
    if (Math.random() < 0.25) root = 55 + [0, 2, 5, 7, 3][Math.floor(Math.random() * 5)];   // modulation de temps en temps
    return t;
  }
  setInterval(() => {
    if (!ctx || ctx.state !== 'running' || A.vol.music <= 0 || document.hidden) return;
    const now = ctx.currentTime;
    if (!nextPhrase) nextPhrase = now + 3;
    if (now >= nextPhrase) { const end = phrase(now + 0.1); nextPhrase = end + 6 + Math.random() * 14; }
  }, 400);
})();

/* ===== party.js : LA BOUSCULADE — jeu 4 : party game multijoueur (course d'obstacles puis survie) =====
   BR.Party.start({ mode:'solo'|'multi', seed, roster:[{id,name,look,level}], selfId, hostId, onEnd(action) })
   Manche 1 « LA COURSE D'ADRESSE » : sections de parkour tirées au sort, les premiers arrivés sont qualifiés.
   Manche 2 « LA TOUPIE » : plateau de dalles qui s'effritent + barres tournantes, le dernier debout gagne.
   Réseau : chaque joueur fait autorité sur son propre perso (relais BR.Net) ; l'hôte décide des manches et du classement. */
(function () {
  const BR = window.BR, Au = BR.Audio;
  const P = (BR.Party = { active: false });
  let S = null, R = null, DOM = null;
  const keys = {};
  // réglages du mouvement : rapide, nerveux, aérien
  const GRAV = 34, JUMP = 12.2, RUN = 13, ACC_G = 95, ACC_A = 34, DIVE_H = 19, DIVE_V = 5.5, RAD = 0.45, STEP = 0.6, TRAMP = 25, PAD = 24;
  const ROUND = [
    { name: 'LA COURSE D\'ADRESSE', sub: 'Saute contre un mur pour courir dessus, ressaute pour rebondir. Les premiers arrivés sont qualifiés !', time: 210 },
    { name: 'LA TOUPIE', sub: 'Les dalles s\'effritent sous tes pieds. Saute les barres basses, pas les hautes !', time: 120 },
  ];
  const ST = { run: 0, air: 1, dive: 2, tumble: 3, slide: 4, wall: 5, zip: 7, spec: 9 };   // 6 = course murale côté gauche
  const STN = Object.fromEntries(Object.entries(ST).map(([k, v]) => [v, k]));
  const fx = (n, o) => { try { Au.fx(n, o || {}); } catch (e) {} };
  const sfx = n => { try { Au.ui(n); } catch (e) {} };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ===================== DOM / rendu ===================== */
  function ensureDom() {
    if (DOM) return;
    const st = document.createElement('style');
    st.textContent = `
#party{position:fixed;inset:0;z-index:60;display:none;background:#9fdcff;font-family:inherit;user-select:none}
#party.on{display:block}
#party canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#party.intro .pt-top,#party.intro .pt-help,#party.intro .pt-click,#party.intro .pt-list{opacity:0}
#party .pt-top{position:absolute;top:12px;left:16px;max-width:calc(50vw - 130px);transition:opacity .3s;text-align:left;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 10px rgba(0,0,0,.25);pointer-events:none}
#party .pt-top b{display:block;font-size:17px;letter-spacing:1px;font-weight:900}
#party .pt-top span{font-size:13px;font-weight:700;opacity:.95}
#party .pt-time{position:absolute;top:10px;left:50%;transform:translateX(-50%);color:#fff;font-size:40px;font-weight:900;text-shadow:0 4px 0 rgba(0,0,0,.3);pointer-events:none;font-variant-numeric:tabular-nums}
#party .pt-pos{position:absolute;top:58px;left:50%;transform:translateX(-50%);color:#ffe14a;font-size:20px;font-weight:900;text-shadow:0 3px 0 rgba(0,0,0,.35);pointer-events:none}
#party .pt-intro{position:absolute;left:0;right:0;bottom:9%;text-align:center;color:#fff;pointer-events:none;opacity:0;transform:translateY(30px);transition:opacity .4s,transform .5s cubic-bezier(.2,1.4,.4,1)}
#party .pt-intro.on{opacity:1;transform:none}
#party .pt-intro i{display:inline-block;background:#ff4f9e;border-radius:999px;padding:4px 16px;font-style:normal;font-weight:900;letter-spacing:3px;font-size:16px;box-shadow:0 4px 0 #b8246c}
#party .pt-intro b{display:block;font-size:clamp(30px,6.5vw,66px);font-weight:900;letter-spacing:3px;text-shadow:0 6px 0 rgba(60,20,110,.45),0 0 28px rgba(255,120,200,.5);margin:8px 0 4px}
#party .pt-intro span{display:block;font-size:clamp(14px,1.8vw,19px);padding:0 16px;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.35);max-width:900px;margin:0 auto}
#party .pt-intro em{display:block;margin-top:10px;font-size:13px;font-style:normal;font-weight:800;opacity:.85}
#party .pt-shout{position:absolute;top:24%;left:0;right:0;text-align:center;font-size:clamp(26px,4vw,46px);font-weight:900;letter-spacing:2px;text-shadow:0 4px 0 rgba(60,20,110,.5);pointer-events:none;opacity:0;transform:scale(.4) rotate(-8deg)}
#party .pt-shout.on{animation:ptshout 1.1s ease-out forwards}
@keyframes ptshout{0%{opacity:0;transform:scale(.4) rotate(-8deg)}15%{opacity:1;transform:scale(1.15) rotate(-4deg)}30%{transform:scale(1) rotate(-3deg)}80%{opacity:1}100%{opacity:0;transform:scale(1.05) rotate(-3deg) translateY(-20px)}}
#party .pt-grab{position:absolute;bottom:62px;left:50%;transform:translateX(-50%);color:#fff;font-weight:900;font-size:14px;background:rgba(20,30,60,.5);padding:5px 12px;border-radius:999px;pointer-events:none}
#party .pt-grab.ok{background:rgba(255,79,158,.85)}
#party.intro .pt-grab{opacity:0}
#party .pt-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .45s}
#party .pt-flash.on{opacity:.85;transition:none}
#party .pt-list{position:absolute;top:60px;right:16px;display:flex;flex-direction:column;gap:4px;pointer-events:none}
#party .pt-list div{background:rgba(20,30,60,.55);color:#fff;border-radius:10px;padding:4px 10px;font-size:14px;font-weight:700;min-width:150px;display:flex;justify-content:space-between;gap:10px}
#party .pt-list div.q{background:rgba(40,170,90,.8)}#party .pt-list div.x{background:rgba(160,40,60,.7);text-decoration:line-through}#party .pt-list div.me{outline:2px solid #ffe14a}
#party .pt-big{position:absolute;top:34%;left:0;right:0;text-align:center;color:#fff;font-size:84px;font-weight:900;letter-spacing:3px;text-shadow:0 6px 0 rgba(0,0,0,.35),0 0 30px rgba(255,120,200,.6);pointer-events:none;transform:scale(.6);opacity:0;transition:transform .25s cubic-bezier(.2,1.6,.4,1),opacity .2s}
#party .pt-big.on{transform:scale(1);opacity:1}
#party .pt-big small{display:block;font-size:24px;letter-spacing:1px}
@media (max-width:900px){#party .pt-top span{display:none}#party .pt-help{font-size:11px}}
#party .pt-help{transition:opacity .3s;position:absolute;left:16px;bottom:14px;color:#fff;font-size:13px;font-weight:700;background:rgba(20,30,60,.45);padding:8px 12px;border-radius:12px;line-height:1.6;pointer-events:none}
#party .pt-help kbd{background:#fff;color:#223;border-radius:5px;padding:0 6px;margin-right:4px;font-family:inherit}
#party .pt-click{position:absolute;bottom:100px;left:50%;transform:translateX(-50%);color:#fff;font-weight:800;background:rgba(255,80,160,.85);padding:8px 16px;border-radius:999px;pointer-events:none;display:none}
#party .pt-click.on{display:block}
#party .pt-panel{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(30,20,70,.55)}
#party .pt-panel.on{display:flex}
#party.pod .pt-panel{justify-content:flex-end;padding-right:3vw;background:linear-gradient(90deg,transparent 35%,rgba(30,20,70,.55))}
@media (max-width:900px){#party.pod .pt-panel{justify-content:center;padding:0;align-items:flex-end}#party.pod .pt-card{max-height:55vh;overflow:auto}}
#party .pt-card{background:linear-gradient(#fff,#f3eaff);border-radius:22px;padding:24px 28px;min-width:380px;max-width:560px;color:#2a2050;box-shadow:0 14px 0 rgba(0,0,0,.18)}
#party .pt-card h2{margin:0 0 6px;font-size:34px;font-weight:900;color:#ff3f9b;text-align:center}
#party .pt-card p{margin:0 0 14px;text-align:center;font-weight:700}
#party .pt-card table{width:100%;border-collapse:collapse;margin-bottom:14px}
#party .pt-card td{padding:6px 8px;border-bottom:1px solid #e4d8ff;font-weight:700}
#party .pt-card tr.me td{background:#fff4b8}
#party .pt-card .pt-b{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
#party .pt-card button{border:0;border-radius:14px;padding:12px 20px;font-weight:900;font-size:16px;cursor:pointer;background:#6a5cff;color:#fff;box-shadow:0 5px 0 #4636c9}
#party .pt-card button.alt{background:#ff4f9e;box-shadow:0 5px 0 #c42a74}
#party .pt-card button:active{transform:translateY(3px);box-shadow:0 2px 0 #4636c9}
#party .pt-set{display:grid;gap:10px;margin:6px 0 16px;font-weight:800;font-size:14px}#party .pt-set label{display:grid;grid-template-columns:1fr 1.3fr;align-items:center;gap:10px}#party .pt-set select{font:inherit;padding:4px 8px;border-radius:8px}#party .pt-set input[type=range]{-webkit-appearance:auto!important;appearance:auto!important;width:100%;accent-color:#ff4f9e;background:transparent!important;height:auto!important}
#party .pt-lb{background:#f3eaff;border-radius:12px;padding:8px 12px;margin:6px 0 12px;font-size:14px}#party .pt-lb>b{display:block;margin-bottom:4px;color:#7a6cff}#party .pt-lbl div{display:flex;justify-content:space-between;padding:1px 0}#party .pt-lbl div.me{color:#ff4f9e;font-weight:900}
#party .pt-gain{text-align:center;font-weight:900;color:#2a9a55;margin-bottom:12px}
.pt-rk{--rc:#c77b3b;display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;margin:8px auto 12px;max-width:420px;padding:10px 14px;border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--rc) 22%,#fff),#fff);border:3px solid var(--rc);color:#2a1a4a;box-shadow:0 4px 0 color-mix(in srgb,var(--rc) 60%,#000)}
.pt-rk b{font-size:20px;font-weight:900;color:color-mix(in srgb,var(--rc) 70%,#000)}.pt-rk span{font-weight:900;font-size:16px}
.pt-rk em{font-style:normal;padding:1px 8px;border-radius:999px;color:#fff;margin-left:4px}.pt-rk em.up{background:#2a9a55}.pt-rk em.dn{background:#e0445a}
.pt-rk i{grid-column:1/3;height:9px;border-radius:9px;background:rgba(0,0,0,.12);overflow:hidden}.pt-rk i u{display:block;height:100%;background:var(--rc);border-radius:9px;transition:width 1s}
.pt-rk small{grid-column:1/3;font-size:12px;opacity:.75;font-weight:700}.pt-rk.wait{display:block;text-align:center;font-weight:900;border-color:#7a6cff;--rc:#7a6cff}
.rw{display:grid;gap:14px;max-height:72vh;overflow:auto;padding-right:4px;text-align:left}.rw h4{margin:4px 0 6px;font-size:15px;letter-spacing:1px}
.rw-q{display:grid;grid-template-columns:1fr auto;gap:3px 10px;padding:8px 12px;border-radius:12px;background:rgba(122,108,255,.12);margin-bottom:6px;font-weight:700}.rw-q.ok{background:rgba(71,209,108,.18)}
.rw-q i{grid-column:1/3;height:7px;border-radius:7px;background:rgba(0,0,0,.15);overflow:hidden}.rw-q i u{display:block;height:100%;background:#7a6cff}.rw-q.ok i u{background:#47d16c}
.rw-pass{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:6px}.rw-pass div{border-radius:10px;padding:6px 2px;text-align:center;font-size:12px;font-weight:800;background:rgba(0,0,0,.08);opacity:.55;line-height:1.25}
.rw-pass div b{display:block;font-size:22px}.rw-pass div.got{opacity:1;background:rgba(255,225,74,.35)}.rw-pass div.nx{opacity:1;outline:2px dashed #ff4f9e}
.rw-bar{height:10px;border-radius:10px;background:rgba(0,0,0,.15);overflow:hidden;margin:4px 0 8px}.rw-bar u{display:block;height:100%;background:linear-gradient(90deg,#ff4f9e,#7a6cff)}
.rw-cos{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px}.rw-cos button{border:2px solid transparent;border-radius:12px;padding:6px 4px;background:rgba(0,0,0,.08);font:inherit;font-size:12px;font-weight:800;cursor:pointer;color:inherit}
.rw-cos button b{display:block;font-size:24px}.rw-cos button.on{border-color:#ff4f9e;background:rgba(255,79,158,.15)}.rw-cos button:disabled{opacity:.4;cursor:default}
.pt-main{font-family:'Trebuchet MS','Arial Rounded MT Bold',system-ui,sans-serif!important}
.pt-main::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(circle at 15% 15%,rgba(255,170,215,.9) 0,transparent 38%),radial-gradient(circle at 85% 80%,rgba(127,216,255,.85) 0,transparent 42%),linear-gradient(160deg,#6f5cff,#ff4f9e)}
.pt-main>*{position:relative;z-index:1}
.pt-main .menu .mi{background:#fff!important;border:none!important;border-radius:18px!important;box-shadow:0 5px 0 #b8246c!important;color:#3a1f6a!important;margin-bottom:10px;padding:10px 18px!important;transition:transform .12s}
.pt-main .menu .mi:hover{transform:translateY(-2px) scale(1.02)}.pt-main .menu .mi:active{transform:translateY(3px);box-shadow:0 2px 0 #b8246c!important}
.pt-main .menu .mi span{font-family:inherit!important;font-weight:900!important;font-size:21px!important;letter-spacing:.5px!important;color:#3a1f6a!important;text-shadow:none!important}
.pt-main .menu .mi small{color:#7a6cff!important;font-weight:700!important;font-family:inherit!important;opacity:1!important}
.pt-main .menu .mi.back{background:rgba(255,255,255,.22)!important;box-shadow:none!important}.pt-main .menu .mi.back span{color:#fff!important;font-size:16px!important}
.pt-main .menu .mi.pt-rkbtn{background:linear-gradient(90deg,#ffe14a,#ffb13d)!important;box-shadow:0 5px 0 #c77b00!important}
.pt-main .d-lrules{background:rgba(255,255,255,.93)!important;color:#2a1a4a!important;border-radius:20px!important;border:none!important;box-shadow:0 8px 0 rgba(60,20,110,.25)}
.pt-main .d-lrules,.pt-main .d-lrules *{font-family:'Trebuchet MS',system-ui,sans-serif!important;letter-spacing:0!important}
.pt-main .d-lrules h4,.pt-main .d-lrules b{color:#ff4f9e!important}.pt-main .d-lrules .muted{color:#5a4a7a!important}
.pt-main .logo-s{color:#fff!important;text-shadow:0 2px 0 rgba(0,0,0,.25)}.pt-main .logo-t{font-family:inherit!important;font-weight:900!important;color:#fff!important;text-shadow:0 6px 0 #b8246c,0 0 30px rgba(255,255,255,.5)!important;letter-spacing:4px}
.pt-main .pt-go{background:#ffe14a!important;color:#3a1f6a!important;border:none!important;box-shadow:0 6px 0 #c77b00!important;border-radius:18px!important;font-weight:900!important}
.rk-banner{margin:0 0 10px;padding:10px 16px;border-radius:12px;background:linear-gradient(90deg,#ff4f9e,#7a6cff);color:#fff;font-weight:800;text-align:center;box-shadow:0 4px 0 #4636c9}.rk-banner small{opacity:.85;font-weight:600}`;
    document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'party';
    root.innerHTML = `<canvas></canvas><div class="pt-flash"></div><div class="pt-shout"></div><div class="pt-grab"></div><div class="pt-top"><b></b><span></span></div><div class="pt-time"></div><div class="pt-pos"></div><div class="pt-list"></div>
      <div class="pt-intro"><i></i><b></b><span></span><em></em></div>
      <div class="pt-big"></div><div class="pt-click">Clique pour contrôler la caméra</div>
      <div class="pt-help"><kbd>ZQSD</kbd>courir · <kbd>Espace</kbd>sauter · <kbd>Maj</kbd>/<kbd>A</kbd>plongeon · <kbd>Clic gauche</kbd>attraper · <kbd>Souris</kbd>caméra · <kbd>1</kbd>-<kbd>4</kbd>émotes · <kbd>Échap</kbd>menu</div>
      <div class="pt-panel"><div class="pt-card"></div></div>`;
    document.body.appendChild(root);
    const q = s => root.querySelector(s);
    DOM = { root, gl: q('canvas'), title: q('.pt-top b'), sub: q('.pt-top span'), time: q('.pt-time'), list: q('.pt-list'), big: q('.pt-big'), click: q('.pt-click'), panel: q('.pt-panel'), card: q('.pt-card'), pos: q('.pt-pos'), flash: q('.pt-flash'), shout: q('.pt-shout'), grab: q('.pt-grab'),
      intro: q('.pt-intro'), iTag: q('.pt-intro i'), iName: q('.pt-intro b'), iSub: q('.pt-intro span'), iSkip: q('.pt-intro em') };
  }
  function renderer() {
    if (R) return R;
    R = new THREE.WebGLRenderer({ canvas: DOM.gl, antialias: BR.settings.quality !== 'low', powerPreference: 'high-performance' });
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    R.shadowMap.enabled = BR.settings.quality !== 'low'; R.shadowMap.type = THREE.PCFSoftShadowMap;
    window.addEventListener('resize', resize);
    return R;
  }
  function resize() {
    if (!R) return;
    const q = BR.settings.quality, dpr = window.devicePixelRatio || 1;
    R.setPixelRatio(Math.min(dpr, q === 'high' ? 1.5 : q === 'med' ? 1 : 0.75));
    R.setSize(window.innerWidth, window.innerHeight, false);
    if (S) { S.cam.aspect = window.innerWidth / window.innerHeight; S.cam.updateProjectionMatrix(); }
  }
  let bigT = null;
  function big(txt, sub, ms) {
    DOM.big.innerHTML = txt + (sub ? `<small>${BR.esc(sub)}</small>` : ''); DOM.big.classList.remove('on'); void DOM.big.offsetWidth; DOM.big.classList.add('on');
    clearTimeout(bigT); if (ms !== 0) bigT = setTimeout(() => DOM && DOM.big.classList.remove('on'), ms || 1400);
  }


  /* ===================== ambiance sonore : synthé maison (musique de fête + bruitages) ===================== */
  let AC = null, AM = null, AS = null, NZ = null;
  function audio() {
    if (AC) return AC; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    AM = AC.createGain(); AM.connect(AC.destination); AS = AC.createGain(); AS.connect(AC.destination); volUpd(); return AC;
  }
  function volUpd() { if (!AC) return; const st = BR.settings || {}, ma = st.master != null ? st.master : 0.8; AM.gain.value = 0.3 * ma * (st.mus != null ? st.mus : 0.6); AS.gain.value = 0.55 * ma * (st.sfx != null ? st.sfx : 1); }
  function noiseBuf() { if (NZ) return NZ; NZ = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = NZ.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return NZ; }
  function tone(type, f0, f1, t, dur, g, out, at) { const o = AC.createOscillator(), v = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur); v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + (at || 0.008)); v.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(v); v.connect(out || AS); o.start(t); o.stop(t + dur + 0.05); }
  function nz(t, dur, g, type, f, q, out) { const s = AC.createBufferSource(); s.buffer = noiseBuf(); const fl = AC.createBiquadFilter(); fl.type = type || 'highpass'; fl.frequency.value = f || 6000; fl.Q.value = q || 0.7; const v = AC.createGain(); v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(v); v.connect(out || AS); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); }
  const SFX = {
    boing(t) { tone('sine', 170, 640, t, 0.34, 0.5); tone('triangle', 85, 320, t, 0.3, 0.25); },
    whoosh(t) { nz(t, 0.45, 0.4, 'bandpass', 900, 0.8); },
    pop(t) { tone('sine', 560, 170, t, 0.13, 0.55); },
    whistle(t) { tone('square', 2050, 2120, t, 0.45, 0.1); tone('sine', 2060, 2130, t, 0.45, 0.2); },
    cheer(t) { for (let i = 0; i < 4; i++) nz(t + i * 0.06, 1.5, 0.16, 'bandpass', 700 + i * 450, 1.6); tone('sine', 880, 1320, t + 0.05, 0.25, 0.12); },
    aww(t) { tone('sawtooth', 320, 170, t, 0.7, 0.05); nz(t, 0.7, 0.12, 'bandpass', 550, 2); },
    boom(t) { tone('sine', 130, 40, t, 0.5, 0.9); nz(t, 0.4, 0.5, 'lowpass', 900, 0.7); },
    grab(t) { tone('square', 300, 460, t, 0.1, 0.12); tone('sine', 600, 900, t + 0.05, 0.08, 0.15); },
    tick(t) { tone('square', 880, 880, t, 0.1, 0.16); },
    go(t) { tone('square', 1320, 1320, t, 0.45, 0.16); tone('square', 660, 660, t, 0.45, 0.12); SFX.whistle(t); },
    jet(t) { nz(t, 0.6, 0.3, 'highpass', 1200, 0.5); },
  };
  function snd(n) { if (!audio() || !SFX[n]) return; if (AC.state === 'suspended') AC.resume(); try { SFX[n](AC.currentTime + 0.01); } catch (e) {} }
  const MUS = { on: false, bpm: 128, step: 0, next: 0, timer: null, key: 0, mel: [], lvl: 0.5 };
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
  const PROGS = [[[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], [[9, 12, 16], [5, 9, 12], [0, 4, 7], [7, 11, 14]], [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]]];
  const hz = n => 220 * Math.pow(2, n / 12);
  function musicStart(seed, bpm) {
    if (!audio()) return; musicStop(); const R = rng(seed);
    MUS.bpm = bpm; MUS.key = Math.floor(R() * 7) - 3; MUS.prog = PROGS[Math.floor(R() * PROGS.length)]; MUS.step = 0; MUS.next = AC.currentTime + 0.1; MUS.on = true; MUS.lvl = 0.5;
    MUS.mel = []; for (let i = 0; i < 32; i++) MUS.mel.push(R() < 0.66 ? SCALE[Math.floor(R() * SCALE.length)] : null);
    MUS.timer = setInterval(musicTick, 25); volUpd();
  }
  function musicStop() { MUS.on = false; clearInterval(MUS.timer); MUS.timer = null; }
  function musicTick() {
    if (!MUS.on || !AC) return; const sp = 60 / MUS.bpm / 4;
    while (MUS.next < AC.currentTime + 0.12) {
      const s = MUS.step, t = MUS.next, bar = Math.floor(s / 16) % 4, ch = MUS.prog[bar], k = MUS.key, beat = s % 16, full = MUS.lvl > 0.75;
      if (beat % 4 === 0) tone('sine', 150, 45, t, 0.22, 0.9, AM);
      if (full && (beat === 4 || beat === 12)) nz(t, 0.16, 0.4, 'bandpass', 1800, 0.6, AM);
      if (beat % 2 === 1) nz(t, 0.05, full ? 0.13 : 0.07, 'highpass', 8000, 0.7, AM);
      if (beat % 2 === 0) tone('triangle', hz(k + ch[0] - 24), 0, t, sp * 1.8, 0.4, AM);
      if (beat === 2 || beat === 6 || beat === 10 || beat === 14) ch.forEach(n => tone('square', hz(k + n), 0, t, sp * 1.1, 0.03, AM));
      if (full) { const m = MUS.mel[s % 32]; if (m != null) tone('square', hz(k + m + 12), 0, t, sp * 1.5, 0.045, AM); }
      MUS.step++; MUS.next += sp;
    }
  }
  /* ---------- messages rigolos ---------- */
  let shoutT = null;
  function shout(txt, col) { if (!DOM) return; DOM.shout.textContent = txt; DOM.shout.style.color = col || '#ffe14a'; DOM.shout.classList.remove('on'); void DOM.shout.offsetWidth; DOM.shout.classList.add('on'); clearTimeout(shoutT); shoutT = setTimeout(() => DOM && DOM.shout.classList.remove('on'), 1100); }
  /* ---------- public : tribunes avec spectateurs qui sautillent ---------- */
  function tribune(x, z0, len, y, side) {
    for (let r = 0; r < 4; r++) addDeco(BOXG, r % 2 ? '#ffffff' : '#ffd1ea', x + side * r * 1.4, y + 0.5 + r * 0.9, z0 + len / 2, 1.4, 1 + r * 1.8, len, true);
    const n = Math.floor(len / 1.1) * 4, geo = S.fanG || (S.fanG = own(new THREE.SphereGeometry(0.42, 10, 8)));
    const im = new THREE.InstancedMesh(geo, mat('#ffffff'), n); im.castShadow = true; S.scene.add(im);
    const base = [], c = new THREE.Color(), cols = ['#ff4f9e', '#3fd0ff', '#ffe14a', '#47d16c', '#7a6cff', '#ff8a3d', '#ffffff'];
    for (let i = 0; i < n; i++) { const r = i % 4, k = Math.floor(i / 4); base.push({ x: x + side * r * 1.4, y: y + 1.45 + r * 1.8, z: z0 + 0.6 + k * 1.1 + (r % 2) * 0.3, ph: Math.random() * 6 }); c.set(cols[Math.floor(Math.random() * cols.length)]).convertSRGBToLinear(); im.setColorAt(i, c); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1.5, 1), ps = new THREE.Vector3();
    S.anim.push(t => { const ex = 0.12 + (S.excite || 0); for (let i = 0; i < n; i++) { const b = base[i]; ps.set(b.x, b.y + Math.abs(Math.sin(t * 7 + b.ph)) * ex, b.z); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); } im.instanceMatrix.needsUpdate = true; });
  }
  /* ===================== progression : couronnes, records, titres ===================== */
  const PB = () => { const p = BR.Account.p; p.stats = p.stats || {}; p.stats.best = p.stats.best || {}; return p.stats.best; };
  const TITLES = [[0, 'Débutant'], [1, 'Bousculeur'], [3, 'Acrobate'], [8, 'Champion'], [15, 'Roi de la Bousculade'], [40, 'Légende']];
  // rang classé : paliers et divisions (III → II → I)
  const TIERS = [[0, 'Bronze', '#c77b3b', '🥉'], [150, 'Argent', '#a9b6c4', '🥈'], [400, 'Or', '#f2b400', '🥇'], [750, 'Platine', '#3fd0c4', '💠'], [1200, 'Diamant', '#5aa8ff', '💎'], [1800, 'Maître', '#b06cff', '🔮'], [2600, 'Champion', '#ff4f9e', '👑']];
  P.tier = rp => { rp = rp || 0; let i = 0; while (i + 1 < TIERS.length && rp >= TIERS[i + 1][0]) i++; const [lo, name, col, ico] = TIERS[i], hi = TIERS[i + 1] ? TIERS[i + 1][0] : null;
    const div = hi ? 3 - Math.min(2, Math.floor((rp - lo) / ((hi - lo) / 3))) : 0, f = hi ? (rp - lo) / (hi - lo) : 1;
    return { name, col, ico, div, label: ico + ' ' + name + (div ? ' ' + ['', 'I', 'II', 'III'][div] : ''), next: hi, f, i }; };
  P.rkHtml = (rk, d) => { const t = P.tier(rk.rp); return `<div class="pt-rk" style="--rc:${t.col}"><b>${t.label}</b><span>${rk.rp} RP${d != null ? ` <em class="${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '+' : ''}${d}</em>` : ''}</span><i><u style="width:${Math.round(t.f * 100)}%"></u></i>${t.next ? `<small>${t.next - rk.rp} RP avant le palier suivant</small>` : '<small>Rang maximal !</small>'}</div>`; };
  P.title = c => { let t = TITLES[0][1]; for (const [n, s] of TITLES) if (c >= n) t = s; return t; };
  P.progress = () => { const b = PB(); return { crowns: b.bz_c || 0, games: b.bz_g || 0, quals: b.bz_q || 0, maps: MAPS.map((m, i) => ({ name: m.name, t: b['bz' + i] ? b['bz' + i] / 10 : 0 })) }; };
  function recordMap(t) { const b = PB(), k = 'bz' + S.mapIdx, d = Math.max(1, Math.round(t * 10)); if (!b[k] || d < b[k]) { const old = b[k]; b[k] = d; return { best: true, old: old ? old / 10 : 0 }; } return { best: false, old: b[k] / 10 }; }

  /* ===================== récompenses : quêtes du jour, passe de saison, chapeaux et traînées ===================== */
  const BZ = () => { const p = BR.Account.p; const b = p.bz = p.bz || {}; b.own = b.own || []; b.st = b.st || {}; b.q = b.q || { day: '', l: [] }; b.sx = b.sx || 0; b.got = b.got || 0; return b; };
  const HATS = {
    cone: { n: 'Chapeau de fête', ico: '🥳' }, helice: { n: 'Casquette à hélice', ico: '🚁' }, haut: { n: 'Haut-de-forme', ico: '🎩' }, viking: { n: 'Casque viking', ico: '🪖' },
    cornes: { n: 'Petites cornes', ico: '😈' }, antennes: { n: 'Antennes', ico: '🐜' }, chef: { n: 'Toque de chef', ico: '👨‍🍳' }, aureole: { n: 'Auréole', ico: '😇' },
    fleur: { n: 'Fleur géante', ico: '🌼' }, pompon: { n: 'Bonnet à pompon', ico: '🧶' }, couronne: { n: 'Couronne du Champion', ico: '👑' }, diademe: { n: 'Diadème de diamant', ico: '💎' },
  };
  const TRAILS = { arcenciel: { n: 'Arc-en-ciel', ico: '🌈', cols: ['#ff3b3b', '#ffb13d', '#ffe14a', '#47d16c', '#3fd0ff', '#7a6cff'] }, etoiles: { n: 'Étoiles', ico: '✨', cols: ['#ffe14a', '#ffffff', '#fff3a0'] },
    feu: { n: 'Flammes', ico: '🔥', cols: ['#ff5a00', '#ffb13d', '#ff2a2a'] }, coeurs: { n: 'Cœurs', ico: '💖', cols: ['#ff4f9e', '#ff8ac4', '#ffffff'] }, bulles: { n: 'Bulles', ico: '🫧', cols: ['#bff0ff', '#ffffff', '#7fd8ff'] }, nuit: { n: 'Poussière de nuit', ico: '🌌', cols: ['#7a6cff', '#3a2a9a', '#c8c4ff'] } };
  // passe de saison : 25 paliers de 120 XP (gratuit pour tout le monde)
  const PASS = [['pts', 100], ['hat', 'cone'], ['pts', 150], ['trail', 'bulles'], ['pts', 150], ['hat', 'pompon'], ['pts', 200], ['hat', 'antennes'], ['trail', 'coeurs'], ['pts', 250],
    ['hat', 'chef'], ['pts', 250], ['hat', 'helice'], ['trail', 'etoiles'], ['pts', 300], ['hat', 'fleur'], ['pts', 300], ['hat', 'viking'], ['trail', 'feu'], ['pts', 400],
    ['hat', 'haut'], ['pts', 400], ['hat', 'cornes'], ['trail', 'arcenciel'], ['hat', 'aureole']];
  const PASS_XP = 120;
  // récompenses du classé (selon le meilleur rang atteint cette saison)
  const RANK_REW = [[400, 'trail', 'nuit'], [1200, 'hat', 'diademe'], [2600, 'hat', 'couronne']];
  const QUESTS = {
    qual: { t: 'Qualifie-toi dans 4 manches', n: 4 }, dive: { t: 'Fais tomber 6 joueurs en plongeant', n: 6 }, final: { t: 'Atteins une finale', n: 1 }, top3: { t: 'Finis une course dans le top 3', n: 1 },
    crown: { t: 'Garde la couronne 20 s au total', n: 20 }, paint: { t: 'Peins 60 dalles à ta couleur', n: 60 }, game: { t: 'Joue 3 parties', n: 3 }, grab: { t: 'Attrape 5 joueurs', n: 5 },
    wall: { t: 'Cours sur les murs 12 fois', n: 12 }, win: { t: 'Gagne une partie 👑', n: 1 }, rounds: { t: 'Joue 8 manches', n: 8 },
  };
  const today = () => new Date().toISOString().slice(0, 10);
  function dailyQuests() {
    const b = BZ(), d = today();
    if (b.q.day !== d) {
      let h = 0; for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0; const rr = rng(h), ks = Object.keys(QUESTS).filter(k => k !== 'win');
      const pick = []; while (pick.length < 3) { const k = ks[Math.floor(rr() * ks.length)]; if (!pick.includes(k)) pick.push(k); }
      if (rr() < 0.35) pick[2] = 'win';
      b.q = { day: d, l: pick.map(id => ({ id, p: 0, c: 0 })) };
    }
    return b.q.l;
  }
  function passLevel(sx) { return Math.min(PASS.length, Math.floor((sx || 0) / PASS_XP)); }
  function grant(r, quiet) {
    const b = BZ();
    if (r[0] === 'pts') { BR.Account.p.points = (BR.Account.p.points || 0) + r[1]; if (!quiet) rwToast('+' + r[1] + ' points'); }
    else if (!b.own.includes(r[1])) { b.own.push(r[1]); if (!quiet) { const d = r[0] === 'hat' ? HATS[r[1]] : TRAILS[r[1]]; rwToast('Nouveau ' + (r[0] === 'hat' ? 'chapeau' : 'traînée') + ' : ' + d.ico + ' ' + d.n + ' !'); } }
  }
  function rwToast(t) { if (S && DOM) { feed('🎁 ' + t); } else if (BR.UI && BR.UI.toast) BR.UI.toast('🎁 ' + t, 'ok'); S && (S.rwLog = (S.rwLog || []).concat(t)); }
  function passXp(n) {
    const b = BZ(); const ss = new Date().toISOString().slice(0, 7); if (b.ss !== ss) { b.ss = ss; b.sx = 0; b.got = 0; }   // le passe repart à chaque saison (les objets restent)
    b.sx += n; const lv = passLevel(b.sx);
    while (b.got < lv) { grant(PASS[b.got]); b.got++; }
  }
  function checkRankRewards() { const rk = BR.Net && BR.Net.rk; if (!rk) return; for (const [rp, k, id] of RANK_REW) if ((rk.best || 0) >= rp) grant([k, id], true); }
  // un évènement de jeu fait avancer les quêtes (et les stats Bousculade)
  function bzEv(kind, n) {
    n = n || 1; const b = BZ(); b.st[kind] = (b.st[kind] || 0) + n;
    for (const q of dailyQuests()) { const d = QUESTS[q.id]; if (!d || q.c || q.id !== kind) continue; q.p = Math.min(d.n, q.p + n); if (q.p >= d.n) { q.c = 1; BR.Account.p.points = (BR.Account.p.points || 0) + 120; passXp(100); if (S) { shout('QUÊTE RÉUSSIE !', '#47d16c'); sfx('buy'); } rwToast('Quête « ' + d.t + ' » : +120 points, +100 XP de saison'); } }
  }
  P.rewards = () => { const b = BZ(); checkRankRewards(); const ss = new Date().toISOString().slice(0, 7); if (b.ss !== ss) { b.ss = ss; b.sx = 0; b.got = 0; } return { b, quests: dailyQuests().map(q => Object.assign({}, QUESTS[q.id], q)), lv: passLevel(b.sx), sx: b.sx, PASS, PASS_XP, HATS, TRAILS, RANK_REW }; };
  P.equip = (kind, id) => { const b = BZ(); if (id && !b.own.includes(id)) return false; if (kind === 'hat') b.hat = id || ''; else b.trail = id || ''; try { BR.Account.save(); } catch (e) {} return true; };
  P.claimable = () => { const r = P.rewards(); return r.quests.filter(q => !q.c).length; };
  // --- objets 3D des chapeaux (créés une fois, partagés) ---
  const HG = {};
  function hatMesh(id) {
    const g = new THREE.Group(), M = (c, o) => mat(c, o), add = (geo, m, x, y, z, rx, rz) => { const k = new THREE.Mesh(geo, m); k.position.set(x || 0, y || 0, z || 0); if (rx) k.rotation.x = rx; if (rz) k.rotation.z = rz; k.castShadow = true; g.add(k); return k; };
    const G = (k, f) => HG[k] || (HG[k] = f());
    switch (id) {
      case 'cone': add(G('cone', () => new THREE.ConeGeometry(0.28, 0.75, 16)), M('#ff4f9e'), 0, 0.37); add(G('pball', () => new THREE.SphereGeometry(0.1, 10, 8)), M('#ffe14a'), 0, 0.78); break;
      case 'helice': add(G('dome', () => new THREE.SphereGeometry(0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), M('#3f8cff')); add(G('stick', () => new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6)), M('#ffffff'), 0, 0.45); { const pr = add(G('prop', () => new THREE.BoxGeometry(0.9, 0.03, 0.12)), M('#ff3b3b'), 0, 0.58); g.userData.spin = pr; } break;
      case 'haut': add(G('brim', () => new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20)), M('#1c1c28'), 0, 0.03); add(G('tube', () => new THREE.CylinderGeometry(0.3, 0.3, 0.55, 20)), M('#1c1c28'), 0, 0.3); add(G('band', () => new THREE.CylinderGeometry(0.31, 0.31, 0.1, 20)), M('#ff3b3b'), 0, 0.1); break;
      case 'viking': add(G('dome2', () => new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), M('#9aa4b0', { metalness: 0.5, roughness: 0.4 })); [-1, 1].forEach(s => add(G('horn', () => new THREE.ConeGeometry(0.09, 0.45, 10)), M('#fff4dc'), s * 0.42, 0.22, 0, 0, -s * 0.9)); break;
      case 'cornes': [-1, 1].forEach(s => add(G('horn2', () => new THREE.ConeGeometry(0.08, 0.3, 10)), M('#e0243a'), s * 0.2, 0.1, 0.05, 0, -s * 0.35)); break;
      case 'antennes': [-1, 1].forEach(s => { add(G('ant', () => new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6)), M('#2a2a3a'), s * 0.15, 0.25, 0, 0, -s * 0.3); add(G('antb', () => new THREE.SphereGeometry(0.08, 10, 8)), M('#47d16c'), s * 0.3, 0.5, 0); }); break;
      case 'chef': add(G('chefb', () => new THREE.CylinderGeometry(0.3, 0.27, 0.35, 16)), M('#ffffff'), 0, 0.17); add(G('chefp', () => new THREE.SphereGeometry(0.38, 14, 10)), M('#ffffff'), 0, 0.45).scale.set(1, 0.6, 1); break;
      case 'aureole': { const k = add(G('halo', () => new THREE.TorusGeometry(0.33, 0.05, 8, 28)), M('#ffe46a', { emissive: '#ffd000', emissiveIntensity: 0.9 }), 0, 0.35, 0, Math.PI / 2); g.userData.bob = k; } break;
      case 'fleur': add(G('fc', () => new THREE.SphereGeometry(0.12, 10, 8)), M('#ffe14a'), 0, 0.2); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(G('fp', () => new THREE.SphereGeometry(0.12, 10, 8)), M('#ffffff'), Math.cos(a) * 0.2, 0.18, Math.sin(a) * 0.2).scale.set(1, 0.4, 1); } break;
      case 'pompon': add(G('beanie', () => new THREE.SphereGeometry(0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), M('#47d16c')); add(G('pom', () => new THREE.SphereGeometry(0.13, 10, 8)), M('#ffffff'), 0, 0.42); add(G('rim', () => new THREE.TorusGeometry(0.37, 0.06, 8, 24)), M('#ffffff'), 0, 0.02, 0, Math.PI / 2); break;
      case 'couronne': case 'diademe': { const c = id === 'couronne' ? '#ffd23a' : '#9fe8ff', m = M(c, { emissive: id === 'couronne' ? '#a87800' : '#2a8fb0', emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.3 }); add(G('cband', () => new THREE.CylinderGeometry(0.32, 0.28, 0.22, 16, 1, true)), m, 0, 0.1); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(G('cspk', () => new THREE.ConeGeometry(0.07, 0.22, 6)), m, Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3); } } break;
      default: return null;
    }
    return g;
  }
  // pose un chapeau sur la tête d'un avatar (au sommet de la tête, quelle que soit l'échelle du modèle)
  function putHat(p, id) {
    const av = p.av; if (!av) return; if (av.hat) { av.hat.parent && av.hat.parent.remove(av.hat); av.hat = null; }
    if (!id || !HATS[id]) return; const h = hatMesh(id); if (!h) return;
    const host = av.head || av.group; av.group.updateMatrixWorld(true);
    const box = new THREE.Box3(); av.group.traverse(o => { if (!o.isMesh || o === av.beam || o.material && o.material.transparent) return; let v = true; for (let q = o; q; q = q.parent) if (!q.visible) { v = false; break; } if (!v || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }); if (box.isEmpty()) box.setFromObject(av.group); const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - 0.08, (box.min.z + box.max.z) / 2);
    const ws = new THREE.Vector3(); host.getWorldScale(ws); host.add(h); h.position.copy(host.worldToLocal(top)); h.scale.setScalar(0.78 / (ws.y || 1)); av.hat = h;
  }
  function trailTick(p, dt) {
    const tr = p.trail && TRAILS[p.trail]; if (!tr || !p.vis) return; const sp = Math.hypot(p.vx || 0, p.vz || 0); if (sp < 8) return;
    p.trT = (p.trT || 0) - dt; if (p.trT > 0) return; p.trT = 0.045; emit(p.x, p.y + 0.5, p.z, 1, { cols: tr.cols, spd: 0.4, up: 0.6, life: 0.7, grav: -0.5 });
  }
  /* ---------- poses procédurales (squelette des persos) ---------- */
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  const AXS = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const POSEB = ['upperarml', 'upperarmr', 'upperlegl', 'upperlegr'];
  function rigOf(av) {
    if (av._rig !== undefined) return av._rig;
    const B = {}; av.group.traverse(o => { if (o.isBone) B[o.name] = o; });
    if (!B.upperarml || !B.upperarmr || !B.upperlegl || !B.upperlegr || !B.handl || !B.handr || !B.footl || !B.footr) { av._rig = null; return null; }
    const g = av.group, sp = g.position.clone(), sr = g.rotation.clone(), ss = g.scale.clone(), par = g.parent;
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1); g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), pos = o => { o.getWorldPosition(_v); return _v.clone().applyMatrix4(inv); };
    function cal(bone, tip, dir) {
      const b0 = pos(tip), q0 = bone.quaternion.clone(); let best = null, bv = -1e9;
      for (let a = 0; a < 3; a++) for (const sg of [1, -1]) { bone.quaternion.copy(q0).multiply(_q.setFromAxisAngle(AXS[a], sg * 0.4)); g.updateMatrixWorld(true); const d = pos(tip).sub(b0).dot(dir); if (d > bv) { bv = d; best = { a, s: sg }; } }
      bone.quaternion.copy(q0); g.updateMatrixWorld(true); return best;
    }
    const up = new THREE.Vector3(0, 1, 0), fw = new THREE.Vector3(0, 0, 1), hl = pos(B.handl), hr = pos(B.handr);
    const R = { B, armUpL: cal(B.upperarml, B.handl, up), armUpR: cal(B.upperarmr, B.handr, up), armFwL: cal(B.upperarml, B.handl, fw), armFwR: cal(B.upperarmr, B.handr, fw),
      armOutL: cal(B.upperarml, B.handl, new THREE.Vector3(Math.sign(hl.x) || 1, 0, 0)), armOutR: cal(B.upperarmr, B.handr, new THREE.Vector3(Math.sign(hr.x) || -1, 0, 0)),
      legFwL: cal(B.upperlegl, B.footl, fw), legFwR: cal(B.upperlegr, B.footr, fw) };
    g.position.copy(sp); g.rotation.copy(sr); g.scale.copy(ss); if (par) g.updateMatrixWorld(true);
    av._rig = R; return R;
  }
  function rot(bone, c, ang) { if (c && Math.abs(ang) > 1e-3) bone.quaternion.multiply(_q.setFromAxisAngle(AXS[c.a], c.s * ang)); }
  function poseRestore(p) { const R = p.av && p.av._rig; if (!R || !p._pq) return; POSEB.forEach((n, i) => R.B[n].quaternion.copy(p._pq[i])); }
  function applyPose(p, sc, dt) {
    const R = rigOf(p.av); if (!R) return;
    p._pq = p._pq || POSEB.map(() => new THREE.Quaternion()); POSEB.forEach((n, i) => p._pq[i].copy(R.B[n].quaternion));
    const tgt = { zip: sc === 7 ? 1 : 0, dive: sc === ST.dive || sc === ST.slide ? 1 : 0, flail: sc === ST.tumble ? 1 : 0, grab: p.grabVis ? 1 : 0, wall: sc === ST.wall || sc === 6 ? 1 : 0, air: sc === ST.air ? 1 : 0 };
    const w = p.pw = p.pw || { zip: 0, dive: 0, flail: 0, grab: 0, wall: 0, air: 0 };
    for (const k in tgt) w[k] += (tgt[k] - w[k]) * Math.min(1, dt * 12);
    const t = S.rt, B = R.B;
    rot(B.upperarml, R.armUpL, 2.7 * w.dive + 2.9 * w.zip); rot(B.upperarmr, R.armUpR, 2.7 * w.dive + 2.9 * w.zip);                 // plongeon : bras tendus devant
    rot(B.upperarml, R.armFwL, 1.45 * w.grab); rot(B.upperarmr, R.armFwR, 1.45 * w.grab);               // attraper : bras en avant
    rot(B.upperarml, R.armOutL, 1.15 * w.wall); rot(B.upperarmr, R.armOutR, 1.15 * w.wall);             // course murale : bras écartés
    const fl = w.flail + w.air * 0.3;
    if (fl > 0.01) {                                                                                     // culbute / saut : ça gigote
      rot(B.upperarml, R.armUpL, (1.3 + Math.sin(t * 17) * 1.1) * fl); rot(B.upperarmr, R.armUpR, (1.3 + Math.sin(t * 17 + 2) * 1.1) * fl);
      rot(B.upperlegl, R.legFwL, Math.sin(t * 14) * 0.9 * w.flail); rot(B.upperlegr, R.legFwR, Math.sin(t * 14 + 2.5) * 0.9 * w.flail);
    }
  }
  /* ===================== manches finales (tirées au sort) ===================== */
  const R2 = {
    toupie: { name: 'LA TOUPIE', sub: 'Les dalles s\'effritent sous tes pieds. Saute la barre rouge, PAS la jaune !', time: 120 },
    etages: { name: 'LES TROIS ÉTAGES', sub: 'Les dalles tombent sous tes pieds… et il reste deux étages en dessous. Le dernier en vie gagne !', time: 150 },
    ile: { name: 'L\'ÎLE QUI RÉTRÉCIT', sub: 'Le bord s\'effondre petit à petit. Pousse les autres dans le vide (plongeon, clic gauche) !', time: 110 },
    couronne: { name: 'LA COURONNE', sub: 'Attrape la couronne et garde-la ! Plonge sur celui qui l\'a (ou attrape-le) pour la lui voler.', time: 60, score: 'crown' },
    foot: { name: 'LE FOOT FOU', sub: 'Deux équipes, un ballon géant : pousse-le dans le but adverse (plonge dedans pour une grosse frappe) !', time: 60, score: 'foot' },
    colline: { name: 'LE ROI DE LA COLLINE', sub: 'Reste dans la zone lumineuse pour marquer des points. Elle se déplace toutes les 12 s : pousse les autres dehors !', time: 60, score: 'hill' },
    bombe: { name: 'LA BOMBE', sub: 'Des bombes passent de joueur en joueur au toucher. Quand le compteur tombe à zéro : BOUM, éliminé ! Refile-la vite !', time: 120, bomb: true },
    peinture: { name: 'LA GUERRE DES COULEURS', sub: 'Deux équipes : cours partout pour peindre le sol à ta couleur. L\'équipe qui a le moins de sol est éliminée !', time: 50, score: 'team' },
  };
  P.pickR2 = () => { const ks = Object.keys(R2); let last = ''; try { last = BR.store.get('br_party_r2', ''); } catch (e) {} let k; do { k = ks[Math.floor(Math.random() * ks.length)]; } while (k === last && ks.length > 1); return k; };

  /* ===================== monde : matériaux et primitives ===================== */
  const BOXG = new THREE.BoxGeometry(1, 1, 1);
  const matCache = {};
  function mat(hex, o) {
    const k = hex + (o ? JSON.stringify(o) : '');
    if (!matCache[k]) {
      const p = Object.assign({ roughness: 0.6, metalness: 0.0 }, o || {}); p.color = new THREE.Color(hex).convertSRGBToLinear();
      if (p.emissive) p.emissive = new THREE.Color(p.emissive).convertSRGBToLinear();
      matCache[k] = new THREE.MeshStandardMaterial(p);
    }
    return matCache[k];
  }
  const light = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k == null ? 0.2 : k).getHexString();
  function mesh(geo, m, cast) { const o = new THREE.Mesh(geo, m); o.castShadow = cast !== false; o.receiveShadow = true; return o; }
  function own(geo) { S.disp.push(geo); return geo; }
  // textures dessinées une seule fois (multipliées par la couleur du matériau)
  let TEX = null;
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function texs() {
    if (TEX) return TEX;
    const mk = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; if (rep !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
    TEX = {
      top: mk(256, 256, (g, w) => { g.fillStyle = '#d9d4ea'; g.fillRect(0, 0, w, w); const gr = g.createLinearGradient(0, 0, w, w); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#efecf7'); g.fillStyle = gr; rr(g, 9, 9, w - 18, w - 18, 34); g.fill();
        g.fillStyle = 'rgba(255,255,255,.9)'; rr(g, 28, 24, 70, 14, 7); g.fill(); g.beginPath(); g.arc(112, 31, 7, 0, 7); g.fill(); }),
      side: mk(128, 128, (g, w) => { const gr = g.createLinearGradient(0, 0, 0, w); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d6d1e6'); g.fillStyle = gr; g.fillRect(0, 0, w, w); g.fillStyle = 'rgba(80,60,140,.10)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(16 + i * 32, 64, 9, 0, 7); g.fill(); } }),
      pad: mk(128, 128, (g, w) => { g.clearRect(0, 0, w, w); g.lineJoin = 'round'; g.lineCap = 'round';
        const chev = (col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(22, 38); g.lineTo(64, 88); g.lineTo(106, 38); g.stroke(); };   // (le haut de l'image est vers l'arrière une fois posée au sol)
        chev('#ff4f9e', 30); chev('#ffffff', 16); }),
      cloud: mk(256, 256, (g, w) => { g.fillStyle = '#c7dcf5'; g.fillRect(0, 0, w, w); const R = rng(7);
        for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * w, r = 14 + R() * 36; for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } } }),
      glow: mk(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,245,200,.85)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, false),
      dot: mk(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, false),
    };
    return TEX;
  }
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
  function matT(col) { const k = 'T' + col; if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({ color: lin(light(col, 0.1)), map: texs().top, roughness: 0.5 }); return matCache[k]; }
  function matS(col) { const k = 'S' + col; if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({ color: lin(shade(col, 0.88)), map: texs().side, roughness: 0.62 }); return matCache[k]; }
  // boîte aux bords arrondis, UV « monde » (les dalles gardent la même taille partout) ; groupe 0 = dessus/dessous, 1 = côtés
  const geoCache = {};
  function rboxGeo(w, h, d) {
    const key = w.toFixed(2) + '|' + h.toFixed(2) + '|' + d.toFixed(2); if (geoCache[key]) return geoCache[key];
    const b = Math.max(0.02, Math.min(0.16, h * 0.3, w * 0.25, d * 0.25)), sw = w / 2 - b, sd = d / 2 - b;
    const r = Math.max(0.02, Math.min(0.5 - b, sw * 0.8, sd * 0.8));
    const s = new THREE.Shape(); s.moveTo(-sw + r, -sd); s.lineTo(sw - r, -sd); s.quadraticCurveTo(sw, -sd, sw, -sd + r); s.lineTo(sw, sd - r); s.quadraticCurveTo(sw, sd, sw - r, sd); s.lineTo(-sw + r, sd); s.quadraticCurveTo(-sw, sd, -sw, sd - r); s.lineTo(-sw, -sd + r); s.quadraticCurveTo(-sw, -sd, -sw + r, -sd);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3 });
    g.rotateX(-Math.PI / 2); g.translate(0, -(h / 2 - b), 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.2, uv.getY(i) / 2.2);
    geoCache[key] = g; return g;
  }
  const CONE = new THREE.CylinderGeometry(1, 0.12, 1, 7);

  // boîte solide : y = dessus ; o : { ry, move(t) -> {x,y,z,ry}, tramp, plain, col2 }
  function addBox(x, y, z, w, h, d, col, o) {
    o = o || {};
    const s = { t: 'box', x, y: y - h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2, ry: o.ry || 0, move: o.move || null, tramp: !!o.tramp, dx: 0, dy: 0, dz: 0, dry: 0 };
    const g = new THREE.Group(); g.position.set(x, s.y, z); g.rotation.y = s.ry;
    const b = mesh(rboxGeo(w, h, d), [matT(o.col2 || col), matS(col)]); g.add(b);
    if (!o.plain && !o.noUnder && w * d >= 24 && h >= 1) { const cr = Math.min(w, d) * 0.4, k = mesh(CONE, matS(shade(col, 0.8)), false); k.scale.set(cr, cr * 1.2, cr); k.position.y = -h / 2 - cr * 0.6; g.add(k); }
    S.scene.add(g); s.g = g; s.c = Math.cos(s.ry); s.s = Math.sin(s.ry);
    S.solids.push(s); return s;
  }
  // disque (plateforme ronde), w = vitesse de rotation
  function addDisc(x, z, top, r, h, col, w, stripes) {
    const s = { t: 'disc', x, z, y: top, r, h, w: w || 0, ang: 0, dry: 0, dx: 0, dz: 0, dy: 0 };
    const g = new THREE.Group(); g.position.set(x, top, z);
    const b = mesh(own(new THREE.CylinderGeometry(r, r * 0.86, h, 40)), [matS(col), matT(col), matS(col)]); b.position.y = -h / 2; g.add(b);
    const c = mesh(own(new THREE.TorusGeometry(r - 0.05, 0.1, 6, 40)), mat(light(col, 0.55)), false); c.rotation.x = Math.PI / 2; c.position.y = -0.02; g.add(c);
    if (stripes) for (let i = 0; i < stripes; i++) { const k = mesh(BOXG, mat(stripes > 4 ? '#ffffff' : '#ffe14a'), false); k.scale.set(r * 1.9, 0.16, 0.5); k.rotation.y = i * Math.PI / stripes; k.position.y = 0.02; g.add(k); }
    S.scene.add(g); s.g = g; S.solids.push(s); return s;
  }
  // rampe (sol en pente le long de z)
  function addRamp(x, z0, z1, y0, y1, w, col) {
    const s = { t: 'ramp', x0: x - w / 2, x1: x + w / 2, z0, z1, y0, y1 };
    const L = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y1 - y0, z1 - z0);
    const g = new THREE.Group(); g.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2); g.rotation.x = -a;
    const b = mesh(rboxGeo(w, 1, L), [matT(col), matS(col)]); b.position.y = -0.5; g.add(b); s.mesh = b;
    for (let i = 0; i < Math.floor(L / 3); i++) { const k = mesh(BOXG, mat(light(col, 0.5)), false); k.scale.set(w + 0.04, 0.08, 0.6); k.position.set(0, 0.01, -L / 2 + 1.5 + i * 3); g.add(k); }
    S.scene.add(g); S.solids.push(s); return s;
  }
  const rampY = (s, z) => s.y0 + (s.y1 - s.y0) * clamp((z - s.z0) / (s.z1 - s.z0), 0, 1);

  /* ---------- dangers ---------- */
  // barre tournante autour de (cx,cz), entre yb et yb+h, demi-longueur L
  function addSweep(cx, cz, yb, h, L, th, w0, col, phase, acc) {
    const g = new THREE.Group(); g.position.set(cx, yb + h / 2, cz);
    const bar = mesh(BOXG, mat(col)); bar.scale.set(L * 2, h, th * 2); g.add(bar);
    [-1, 1].forEach(sd => { const tip = mesh(own(new THREE.SphereGeometry(h * 0.75, 16, 12)), mat('#ffffff')); tip.position.x = sd * L; g.add(tip); });
    S.scene.add(g);
    const hz = { t: 'sweep', cx, cz, yb, h, L, th, w0, acc: acc || 0, phase: phase || 0, g, a: 0, w: w0,
      update(t) { this.w = this.w0 * (1 + this.acc * t); this.a = this.phase + this.w0 * (t + this.acc * t * t / 2); this.g.rotation.y = this.a; },
      hit(m) {
        if (this.off || m.y > this.yb + this.h || m.y + 1.7 < this.yb) return null;
        const dx = m.x - this.cx, dz = m.z - this.cz, c = Math.cos(this.a), s = Math.sin(this.a);
        const along = dx * c - dz * s, perp = dx * s + dz * c;
        if (Math.abs(along) > this.L + 0.3 || Math.abs(perp) > this.th + RAD) return null;
        const sg = Math.sign(-this.w * along) || 1, sp = (10 + Math.abs(this.w * along) * 0.55) * (this.kb || 1);
        return { x: s * sg * sp, y: 7.5 * (this.kb || 1), z: c * sg * sp };
      } };
    S.haz.push(hz);
    addPillar(cx, cz, yb - 0.1, yb + h + 0.6, 0.9, '#ffffff');
    return hz;
  }
  function addPillar(x, z, y0, y1, r, col) {
    const m = mesh(own(new THREE.CylinderGeometry(r, r, y1 - y0, 20)), mat(col)); m.position.set(x, (y0 + y1) / 2, z); S.scene.add(m);
    S.solids.push({ t: 'cyl', x, z, r, y0, y1 });
  }
  // marteau-pendule au-dessus d'un pont, oscille le long de x
  function addHammer(px, py, pz, len, amp, period, phase, col) {
    const g = new THREE.Group(); g.position.set(px, py, pz);
    const arm = mesh(BOXG, mat('#5b4bd6')); arm.scale.set(0.35, len, 0.35); arm.position.y = -len / 2; g.add(arm);
    const head = mesh(own(new THREE.CylinderGeometry(1.05, 1.05, 2.6, 24)), mat(col)); head.rotation.x = Math.PI / 2; head.position.y = -len; g.add(head);
    [-1, 1].forEach(sd => { const cap = mesh(own(new THREE.CylinderGeometry(1.12, 1.12, 0.3, 24)), mat('#ffffff')); cap.rotation.x = Math.PI / 2; cap.position.set(0, -len, sd * 1.35); g.add(cap); });
    S.scene.add(g);
    // portique
    [-1, 1].forEach(sd => addDeco(BOXG, '#ffffff', px + sd * 4.2, py / 2 + 0.5, pz, 0.5, py + 1, 0.5));
    addDeco(BOXG, '#5b4bd6', px, py + 0.3, pz, 9, 0.6, 0.6);
    const hz = { t: 'hammer', px, py, pz, len, amp, period, phase, g, a: 0, da: 0,
      update(t) { const k = 2 * Math.PI / this.period, u = k * t + this.phase; this.a = this.amp * Math.sin(u); this.da = this.amp * k * Math.cos(u); this.g.rotation.z = this.a; },
      hit(m) {
        const hx = this.px + this.len * Math.sin(this.a), hy = this.py - this.len * Math.cos(this.a);
        if (Math.abs(m.z - this.pz) > 1.3 + RAD) return null;
        if (Math.hypot(m.x - hx, m.y + 0.9 - hy) > 1.05 + RAD + 0.35) return null;
        const sg = Math.sign(this.da) || 1;
        return { x: sg * 17, y: 8, z: (m.z - this.pz) * 2 };
      } };
    S.haz.push(hz); return hz;
  }
  function addDeco(geo, col, x, y, z, sx, sy, sz, cast) { const m = mesh(geo, mat(col), cast); m.position.set(x, y, z); m.scale.set(sx, sy, sz); S.scene.add(m); return m; }
  // rondins qui dévalent une rampe (de z1 vers z0)
  function addLogs(ramp, n, spd, r) {
    const xc = (ramp.x0 + ramp.x1) / 2, w = ramp.x1 - ramp.x0 - 1.2, L = ramp.z1 - ramp.z0;
    const geo = own(new THREE.CylinderGeometry(r, r, w, 18)); geo.rotateZ(Math.PI / 2);
    const logs = [];
    for (let i = 0; i < n; i++) { const g = new THREE.Group(); const b = mesh(geo, mat(i % 2 ? '#ff8a3d' : '#ffb13d')); g.add(b); const ring = mesh(own(new THREE.TorusGeometry(r * 0.75, 0.12, 6, 18)), mat('#ffffff'), false); ring.rotation.y = Math.PI / 2; ring.position.x = w / 2 + 0.02; g.add(ring); S.scene.add(g); logs.push({ g, z: 0, y: 0 }); }
    const hz = { t: 'logs', logs, n, spd, r, L, ramp, xc, w,
      update(t) { this.logs.forEach((lg, i) => { const s = (t * this.spd + i * this.L / this.n) % this.L; lg.z = this.ramp.z1 - s; lg.y = rampY(this.ramp, lg.z) + this.r; lg.g.position.set(this.xc, lg.y, lg.z); lg.g.rotation.x = -s / this.r; lg.g.visible = s > 0.3; }); },
      hit(m) {
        if (Math.abs(m.x - this.xc) > this.w / 2 + RAD) return null;
        for (const lg of this.logs) { if (Math.abs(m.z - lg.z) < this.r + RAD && m.y < lg.y + this.r && m.y + 1.7 > lg.y - this.r) return { x: (m.x - this.xc) * 0.6, y: 7, z: -13 }; }
        return null;
      } };
    S.haz.push(hz); return hz;
  }
  // champignon rebondissant
  function addBumper(x, z, y, r, col) {
    const stem = mesh(own(new THREE.CylinderGeometry(r * 0.55, r * 0.7, 1.4, 16)), mat('#fff6e6')); stem.position.set(x, y + 0.7, z); S.scene.add(stem);
    const cap = mesh(own(new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2)), mat(col)); cap.position.set(x, y + 1.2, z); cap.scale.y = 0.8; S.scene.add(cap);
    for (let i = 0; i < 5; i++) { const a = i * 1.26, dot = mesh(own(new THREE.SphereGeometry(0.22, 8, 6)), mat('#ffffff'), false); dot.position.set(x + Math.cos(a) * r * 0.6, y + 1.2 + r * 0.55, z + Math.sin(a) * r * 0.6); S.scene.add(dot); }
    const hz = { t: 'bump', x, z, y, r, cap, sq: 0,
      update(t, dt) { this.sq = Math.max(0, this.sq - dt * 4); this.cap.scale.set(1 + this.sq * 0.25, 0.8 - this.sq * 0.3, 1 + this.sq * 0.25); },
      hit(m) {
        if (m.y > this.y + 1.2 + this.r * 0.8 || m.y + 1.7 < this.y) return null;
        const dx = m.x - this.x, dz = m.z - this.z, d = Math.hypot(dx, dz);
        if (d > this.r + RAD || d < 1e-3) return null;
        this.sq = 1; return { x: dx / d * 15, y: 6, z: dz / d * 15, soft: true };
      } };
    S.haz.push(hz); return hz;
  }

  /* ===================== décor commun ===================== */
  function sky(top, bot) {
    const geo = own(new THREE.SphereGeometry(420, 24, 16)), pos = geo.attributes.position, cols = [], ct = new THREE.Color(top).convertSRGBToLinear(), cb = new THREE.Color(bot).convertSRGBToLinear();
    for (let i = 0; i < pos.count; i++) { const k = clamp(pos.getY(i) / 420 * 1.6 + 0.15, 0, 1); const c = cb.clone().lerp(ct, k); cols.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); S.disp.push(m.material);
    m.renderOrder = -1; S.scene.add(m); S.skyM = m;
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: texs().glow, color: 0xfff6d8, fog: false, depthWrite: false, transparent: true })); S.disp.push(sun.material);
    sun.position.set(-150, 190, -260); sun.scale.set(150, 150, 1); m.add(sun);
    const pm = new THREE.MeshBasicMaterial({ color: lin(light(bot, 0.55)), fog: false }), pg = own(new THREE.IcosahedronGeometry(1, 1)); S.disp.push(pm); const R = rng(3);
    for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2 + R() * 0.2, rr0 = 360, s = 30 + R() * 45; const p = new THREE.Mesh(pg, pm); p.position.set(Math.cos(a) * rr0, -50 + R() * 30, Math.sin(a) * rr0); p.scale.set(s * 1.6, s * 0.7, s); m.add(p); }
  }
  function clouds(r, n, y0, y1, avoid) {
    const geo = own(new THREE.IcosahedronGeometry(1, 1)), m = mat('#ffffff', { roughness: 1, emissive: '#cfe8ff', emissiveIntensity: 0.25 });
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = 70 + r() * 160, cx = Math.cos(a) * d, cz = avoid(Math.sin(a) * d), cy = y0 + r() * (y1 - y0);
      for (let k = 0; k < 5; k++) { const s = 4 + r() * 6; const p = mesh(geo, m, false); p.position.set(cx + (r() - 0.5) * 14, cy + (r() - 0.5) * 3, cz + (r() - 0.5) * 8); p.scale.set(s * 1.4, s * 0.8, s); S.scene.add(p); }
    }
  }
  function sea(y, tint) {   // mer de nuages
    const geo = own(new THREE.PlaneGeometry(2400, 2400, 1, 1)); geo.rotateX(-Math.PI / 2);
    const t = texs().cloud.clone(); t.needsUpdate = true; t.repeat.set(14, 14); S.cloudTex = t;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, color: lin(tint || '#ffffff') })); S.disp.push(m.material, t); m.position.y = y; S.scene.add(m); S.seaM = m;
  }
  function lights() {
    const sc = S.scene;
    sc.add(new THREE.HemisphereLight(0xcfe9ff, 0x7a5aa8, 0.75));
    const sun = new THREE.DirectionalLight(0xfff0d6, 1.9); sun.position.set(-30, 60, -20); sun.castShadow = !!(R && R.shadowMap.enabled);
    const q = BR.settings.quality; sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
    const sh = sun.shadow.camera; sh.left = -32; sh.right = 32; sh.top = 32; sh.bottom = -32; sh.near = 1; sh.far = 160; sun.shadow.bias = -0.0006;
    sc.add(sun); sc.add(sun.target); S.sun = sun;
  }

  /* ===================== manche 1 : LA COURSE D'ADRESSE =====================
     Une suite de sections tirées au sort (même tirage chez tout le monde) : élan + grand saut, piliers,
     poutre ou îlots, cheminée à saut mural, toboggan, îlots qui rétrécissent, trampolines. Rien ne bouge : que du skill. */
  let PAL = ['#7a6cff', '#47d16c', '#ffb13d', '#3fd0ff', '#ff6fb0', '#ff8a3d'];
  const nextCol = (col, k) => PAL[(PAL.indexOf(col) + k + PAL.length) % PAL.length];
  function plat(z0, len, w, y, col, x) { addBox(x || 0, y, z0 + len / 2, w, 2.4, len, col); return z0 + len; }
  function cp(z0, y) {
    S.checks.push({ z: z0 + 0.5, x: 0, y, zz: z0 + 2.5 });
    const n = S.checks.length, col = PAL[n % PAL.length], zz = z0 + 1.4;
    [-1, 1].forEach(sd => { addDeco(S.post || (S.post = own(new THREE.CylinderGeometry(0.22, 0.26, 1, 10))), '#ffffff', sd * 5.6, y + 2.3, zz, 1, 4.6, 1); });
    addDeco(BOXG, col, 0, y + 4.8, zz, 11.6, 0.7, 0.35);
    for (let i = 0; i < 9; i++) { const f = mesh(S.flag || (S.flag = own(new THREE.ConeGeometry(0.32, 0.7, 3))), mat(PAL[(i + n) % PAL.length]), false); f.position.set(-4.8 + i * 1.2, y + 4.1, zz); f.rotation.x = Math.PI; S.scene.add(f); }
  }
  function pad(x, y, z, w, d, yaw) {
    yaw = yaw || 0; const s = addBox(x, y + 0.08, z, w, 0.16, d, '#ffcf2e', { plain: true, ry: yaw }); s.pad = true; s.dir = fwd(yaw); S.pads.push(s);
    const t = texs().pad.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w / 2.4)), Math.max(1, Math.round(d / 1.7)));
    const pm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }); S.disp.push(pm, t);
    const geo = own(new THREE.PlaneGeometry(w * 0.86, d * 0.9)); geo.rotateX(-Math.PI / 2); if (yaw) geo.rotateY(yaw);
    const pl = new THREE.Mesh(geo, pm); pl.position.set(x, y + 0.18, z); pl.renderOrder = 2; S.scene.add(pl); S.scroll.push({ t, k: 2.4 });
    return s;
  }
  // mur (course murale / saut mural) : planches blanches à bandes roses
  function wallZ(x, y0, y1, z0, z1, col) { const w = addBox(x, y1, (z0 + z1) / 2, 0.9, y1 - y0, z1 - z0, col || '#ffffff', { col2: '#ff4f9e' }); w.wr = true; for (let zz = z0 + 2; zz < z1 - 1; zz += 4) addDeco(BOXG, '#ffe14a', x - Math.sign(x) * 0.47, (y0 + y1) / 2 + 1, zz, 0.06, 0.5, 1.6, false); return w; }
  // chaque section : d = difficulté (1 facile … 4 dur), f(c, r, col) -> nouveau curseur { z, y }
  const SEC = {
    saut: { d: 1, f(c, r, col) {          // élan sur la bande jaune, puis grand saut
      cp(c.z, c.y); let z = plat(c.z, 16, 12, c.y, col); pad(0, c.y, z - 4, 9, 6);
      z += 10 + r() * 3.5; z = plat(z, 9, 14, c.y - 1, nextCol(col, 2)); return { z, y: c.y - 1 }; } },
    piliers: { d: 2, f(c, r, col) {       // piliers en quinconce qui montent
      cp(c.z, c.y); let z = plat(c.z, 7, 12, c.y, col), y = c.y; const n = 6 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) { z += 4.6 + r() * 0.6; y += r() < 0.75 ? 0.6 + r() * 0.5 : -0.4; addDisc((i % 2 ? 1 : -1) * (1.2 + r() * 2.2), z, y, 1.2 + r() * 0.3, 6, PAL[i % PAL.length]); }
      z += 3.8; z = plat(z, 8, 12, y, col); return { z, y }; } },
    poutres: { d: 2, f(c, r, col) {       // à gauche la poutre (rapide, étroite), à droite des îlots (plus sûrs)
      cp(c.z, c.y); let z = plat(c.z, 7, 22, c.y, col); const y = c.y, sd = r() < 0.5 ? -1 : 1;
      const xs = [-5.5, -3.2, -6.4, -4.2, -5.5].map(v => v * sd);
      for (let i = 0; i < 4; i++) { const x0 = xs[i], x1 = xs[i + 1], L = Math.hypot(x1 - x0, 8); addBox((x0 + x1) / 2, y, z + i * 8 + 4, 1.1, 1, L + 0.7, '#ffffff', { ry: Math.atan2(x1 - x0, 8), col2: '#ff4f9e' }); }
      for (let i = 0; i < 4; i++) addBox(-sd * (5.5 + (i % 2 ? 0.9 : -0.9)), y + (i % 2 ? 0.5 : 0), z + 3.6 + i * 8.2, 3.4, 1.4, 3.4, PAL[(i + 1) % PAL.length]);
      z += 32; z = plat(z, 8, 22, y, col); return { z, y }; } },
    cheminee: { d: 3, f(c, r, col) {      // sauts muraux entre deux murs, ou l'escalier (plus lent)
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 14, 18, y, col);
      const zc = z - 3; [-1, 1].forEach(sd => addBox(sd * 2.05, y + 10, zc, 1.0, 10.5, 5.5, '#ffffff', { col2: '#ff4f9e' }));
      const st = r() < 0.5 ? -1 : 1; for (let i = 0; i < 5; i++) addBox(st * 6.5, y + 1.6 * (i + 1), z - 12 + i * 2.2, 3.2, 1.6 * (i + 1), 2.2, PAL[(i + 2) % PAL.length]);
      z = plat(z, 10, 18, y + 8, nextCol(col, 3)); return { z, y: y + 8 }; } },
    toboggan: { d: 1, f(c, r, col) {      // descente qui accélère, bande jaune, énorme saut
      cp(c.z, c.y); let z = plat(c.z, 6, 12, c.y, col); const L = 26 + r() * 12, y1 = c.y - L * 0.3;
      const rp = addRamp(0, z, z + L, c.y, y1, 12, '#3fd0ff'); rp.slide = true; z += L;
      z = plat(z, 7, 12, y1, col); pad(0, y1, z - 3.5, 10, 6);
      z += 12 + r() * 4; z = plat(z, 9, 16, y1 - 1, nextCol(col, 1)); return { z, y: y1 - 1 }; } },
    ilots: { d: 2, f(c, r, col) {         // îlots de plus en plus petits
      cp(c.z, c.y); let z = plat(c.z, 7, 12, c.y, col), y = c.y; const sz = [4, 3.4, 2.9, 2.5, 2.1, 1.8];
      for (let i = 0; i < 6; i++) { z += 5.8 + r() * 0.8; y += (r() - 0.4) * 1.1; addBox((i % 2 ? 1 : -1) * (1 + r() * 1.5), y, z, sz[i], 1.2, sz[i], PAL[(i + 3) % PAL.length]); }
      z += 5.4; z = plat(z, 8, 12, y, col); return { z, y }; } },
    rebonds: { d: 1, f(c, r, col) {       // trampolines vers des étages
      cp(c.z, c.y); let z = plat(c.z, 10, 14, c.y, col); const n = 2 + (r() < 0.4 ? 1 : 0); let y = c.y;
      // le vol d'un rebond fait ~15 m : chaque étage fait 20 m, trampoline au bout, on atterrit au milieu du suivant
      for (let i = 0; i < n; i++) { S.tramps.push(addBox(0, y + 0.25, z - 2.2, 12, 0.5, 3.6, '#ff4f9e', { tramp: true, col2: '#ffffff' })); z += 2; y += 6; z = plat(z, i === n - 1 ? 12 : 20, 14, y, nextCol(col, i + 1)); }
      return { z, y }; } },
    mur: { d: 3, f(c, r, col) {           // course sur un mur au-dessus du vide
      cp(c.z, c.y); const y = c.y, sd = r() < 0.5 ? -1 : 1, L = 16 + r() * 6;
      let z = plat(c.z, 9, 12, y, col);
      wallZ(sd * 3.6, y - 3.5, y + 4.5, z - 2, z + L);
      z += L; z = plat(z, 9, 14, y - 1, nextCol(col, 1)); return { z, y: y - 1 }; } },
    zigzag: { d: 4, f(c, r, col) {        // murs alternés : course murale + saut d'un mur à l'autre
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 9, 12, y, col), sd = r() < 0.5 ? -1 : 1; const n = 3;
      for (let i = 0; i < n; i++) { wallZ(sd * 3.4, y - 5, y + 7.5, z - 1 + i * 9, z + 13 + i * 9); sd = -sd; }
      z += n * 9 + 3; z = plat(z, 9, 14, y - 2, nextCol(col, 2)); return { z, y: y - 2 }; } },
    couloir: { d: 3, f(c, r, col) {       // deux murs parallèles au-dessus du vide
      cp(c.z, c.y); const y = c.y, L = 20 + r() * 6; let z = plat(c.z, 9, 12, y, col);
      [-1, 1].forEach(sd => wallZ(sd * 3.3, y - 4, y + 4.5, z - 1, z + L));
      z += L; z = plat(z, 9, 14, y - 1, nextCol(col, 3)); return { z, y: y - 1 }; } },
    marches: { d: 1, f(c, r, col) {       // escalier volant en lacets
      cp(c.z, c.y); let z = plat(c.z, 7, 12, c.y, col), y = c.y; const n = 7 + Math.floor(r() * 3), ph = r() * 6;
      for (let i = 0; i < n; i++) { z += 4.1; y += 0.75; addBox(Math.sin(ph + i * 0.9) * 3.5, y, z, 3.2, 1, 3.2, PAL[i % PAL.length]); }
      z += 3.6; z = plat(z, 8, 12, y, col); return { z, y }; } },
    tremplin: { d: 2, f(c, r, col) {      // rampe, bande jaune en haut, saut géant
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 6, 10, y, col);
      addRamp(0, z, z + 12, y, y + 3, 9, '#ffb13d'); z += 12;
      z = plat(z, 5, 9, y + 3, col); pad(0, y + 3, z - 2.5, 8, 4.4);
      z += 14 + r() * 3; z = plat(z, 10, 16, y, nextCol(col, 2)); return { z, y }; } },
    damier: { d: 2, f(c, r, col) {        // damier troué : à toi de trouver le chemin
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 7, 14, y, col); const rows = 6 + Math.floor(r() * 3);
      for (let row = 0; row < rows; row++) {
        const cols = [0, 1, 2, 3, 4]; for (let i = 4; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = cols[i]; cols[i] = cols[j]; cols[j] = t; }
        cols.slice(0, 2 + (r() < 0.5 ? 1 : 0)).forEach(k => addBox((k - 2) * 2.9, y + (r() - 0.5) * 0.4, z + 1.9 + row * 2.9, 2.4, 0.8, 2.4, PAL[(k + row) % PAL.length]));
      }
      z += 1.9 + rows * 2.9; z = plat(z, 8, 14, y, col); return { z, y }; } },
    pont: { d: 1, f(c, r, col) {          // pont étroit avec des trous
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 7, 12, y, col); const end = z + 38 + r() * 10, ph = r() * 6;
      while (z < end) { const L = 4 + r() * 5, x = Math.sin(ph + z * 0.08) * 2.5; addBox(x, y, z + L / 2, 2.2, 1, L, r() < 0.5 ? '#ffffff' : nextCol(col, 1)); z += L + 1.8 + r() * 1.6; }
      z = plat(z, 8, 12, y, col); return { z, y }; } },
    bosses: { d: 1, f(c, r, col) {        // montagnes russes : monte, descend (ça accélère), recommence
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 5, 10, y, col); const n = 3;
      for (let i = 0; i < n; i++) { const h = 1.8 + r() * 1.2; addRamp(0, z, z + 7, y, y + h, 10, PAL[(i + 1) % PAL.length]); const d = addRamp(0, z + 7, z + 14, y + h, y, 10, PAL[(i + 2) % PAL.length]); d.slide = true; z += 14; }
      z = plat(z, 8, 12, y, col); return { z, y }; } },
    tour: { d: 3, f(c, r, col) {          // grimper de bloc en bloc
      cp(c.z, c.y); let z = plat(c.z, 7, 12, c.y, col), y = c.y; const n = 5 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) { z += 3.1; y += 1.75; addBox((i % 2 ? 1 : -1) * 2, y, z, 3.2, 1.5, 3.2, PAL[(i + 2) % PAL.length]); }
      z += 3.2; z = plat(z, 9, 14, y, col); return { z, y }; } },
  };
  /* ===================== GROS OBSTACLES (cartes à thème) ===================== */
  function matIce() { if (!matCache.ICE) matCache.ICE = new THREE.MeshStandardMaterial({ color: lin('#e4f7ff'), map: texs().top, roughness: 0.08, metalness: 0.2 }); return matCache.ICE; }
  // murets le long d'une rampe (on peut courir dessus)
  function sideWalls(rp, W, z0, z1, col) {
    for (let z = z0; z < z1 - 0.5; z += 7) {
      const za = z, zb = Math.min(z1, z + 7), yTop = Math.max(rampY(rp, za), rampY(rp, zb)) + 2.6, yBot = Math.min(rampY(rp, za), rampY(rp, zb)) - 1.6;
      [-1, 1].forEach(sd => { addBox(sd * (W / 2 + 0.45), yTop, (za + zb) / 2, 0.9, yTop - yBot, zb - za, '#ffffff', { col2: col || '#ff4f9e', noUnder: true }).wr = true; });
    }
  }
  function giantHammer(px, py, pz, len, amp, period, phase, col, s, y0, halfW) {
    const g = new THREE.Group(); g.position.set(px, py, pz);
    const arm = mesh(BOXG, mat('#5b4bd6')); arm.scale.set(0.55, len, 0.55); arm.position.y = -len / 2; g.add(arm);
    const hr = 1.05 * s, hl = 1.3 * s;
    const head = mesh(own(new THREE.CylinderGeometry(hr, hr, hl * 2, 28)), mat(col)); head.rotation.x = Math.PI / 2; head.position.y = -len; g.add(head);
    [-1, 1].forEach(sd => { const cap = mesh(own(new THREE.CylinderGeometry(hr * 1.08, hr * 1.08, 0.45, 28)), mat('#ffffff')); cap.rotation.x = Math.PI / 2; cap.position.set(0, -len, sd * (hl + 0.12)); g.add(cap); });
    S.scene.add(g);
    [-1, 1].forEach(sd => addDeco(BOXG, '#ffffff', px + sd * (halfW + 1.2), (y0 + py) / 2, pz, 0.8, py - y0 + 1, 0.8));
    addDeco(BOXG, '#5b4bd6', px, py + 0.4, pz, halfW * 2 + 3.4, 0.9, 0.9);
    S.haz.push({ g, a: 0, da: 0, px, pz, len,
      update(t) { const k = 2 * Math.PI / period, u = k * t + phase; this.a = amp * Math.sin(u); this.da = amp * k * Math.cos(u); this.g.rotation.z = this.a; },
      hit(m) {
        const hx = px + len * Math.sin(this.a), hy = py - len * Math.cos(this.a);
        if (Math.abs(m.z - pz) > hl + RAD) return null;
        if (Math.hypot(m.x - hx, m.y + 0.9 - hy) > hr + RAD + 0.4) return null;
        return { x: (Math.sign(this.da) || 1) * 21, y: 9, z: (m.z - pz) * 2 };
      } });
  }
  // ventilateur géant : souffle vers le haut (on vole au-dessus du vide)
  function fan(x, z, yb, top, rad, col, dir) {
    S.winds.push({ x, z, r: rad, y0: yb, y1: top, ay: 70, ax: dir ? dir[0] * 5 : 0, az: dir ? dir[1] * 5 : 5, max: 8.5 });
    const g = new THREE.Group(); g.position.set(x, yb, z);
    const ring = mesh(own(new THREE.TorusGeometry(rad, 0.38, 8, 36)), mat(col)); ring.rotation.x = Math.PI / 2; g.add(ring);
    const hub = mesh(own(new THREE.CylinderGeometry(0.7, 0.9, 1.2, 16)), mat('#ffffff')); g.add(hub);
    const bl = new THREE.Group(); for (let i = 0; i < 4; i++) { const h = new THREE.Group(); h.rotation.y = i * Math.PI / 2; const b = mesh(BOXG, mat('#ffffff'), false); b.scale.set(rad * 0.9, 0.14, 1); b.position.x = rad * 0.48; b.rotation.x = 0.4; h.add(b); bl.add(h); } g.add(bl);
    const leg = mesh(own(new THREE.CylinderGeometry(0.5, 0.9, 30, 10)), mat(shade(col, 0.7))); leg.position.y = -15.6; g.add(leg);
    S.scene.add(g);
    S.anim.push(t => { bl.rotation.y = t * 9; if (Math.abs(S.me.z - z) < 70 && Math.random() < 0.7) emit(x + (Math.random() - 0.5) * rad * 1.5, yb + 0.6, z + (Math.random() - 0.5) * rad * 1.5, 1, { col: '#ffffff', spd: 0.2, up: 9, life: 1.7, grav: -3 }); });
  }
  // geyser : jaillit à intervalles réguliers et propulse vers le haut et l'avant
  function geyser(x, z, y, per, act, ph, dir) {
    const base = mesh(S.gyB || (S.gyB = own(new THREE.CylinderGeometry(1.5, 1.8, 0.5, 20))), mat('#ffffff')); base.position.set(x, y + 0.05, z); S.scene.add(base);
    const cm = new THREE.MeshStandardMaterial({ color: lin('#8fdcff'), emissive: lin('#3fb0ff'), emissiveIntensity: 0.45, transparent: true, opacity: 0.78 }); S.disp.push(cm);
    const col = new THREE.Mesh(S.gyG || (S.gyG = own(new THREE.CylinderGeometry(1.1, 1.45, 1, 16, 1, true))), cm); col.position.set(x, y, z); S.scene.add(col);
    S.haz.push({ on: false,
      update(t) { const u = ((t + ph) % per + per) % per; this.on = u < act; const hg = this.on ? Math.min(1, u / 0.12) * 7 : Math.max(0, 7 * (1 - (u - act) / 0.3)); col.scale.y = Math.max(0.01, hg); col.position.y = y + col.scale.y / 2; col.visible = hg > 0.05; if (this.on && Math.random() < 0.5 && Math.abs(S.me.z - z) < 50) emit(x, y + hg, z, 1, { col: '#c8efff', spd: 3, up: 3, life: 0.6 }); },
      hit(m) { if (!this.on || Math.hypot(m.x - x, m.z - z) > 1.7 || m.y > y + 3) return null; return { launch: true, y: 21, z: 12, dir }; } });
  }
  // tapis roulant (vx, vz = vitesse du tapis)
  function belt(x, y, z, w, d, vx, vz) {
    const s = addBox(x, y, z, w, 1.2, d, '#4b4a63', { col2: '#5d5c7a' }); s.conv = [vx, vz];
    const t = texs().pad.clone(); t.needsUpdate = true; const lat = Math.abs(vx) > Math.abs(vz), L = lat ? w : d, Wd = lat ? d : w;
    t.repeat.set(Math.max(1, Math.round(Wd / 2.4)), Math.max(1, Math.round(L / 1.7)));
    const pm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85 }); S.disp.push(pm, t);
    const geo = own(new THREE.PlaneGeometry(Wd * 0.9, L * 0.96)); geo.rotateX(-Math.PI / 2); if (lat) geo.rotateY(vx > 0 ? Math.PI / 2 : -Math.PI / 2); else if (vz < 0) geo.rotateY(Math.PI);
    const pl = new THREE.Mesh(geo, pm); pl.position.set(x, y + 0.04, z); pl.renderOrder = 2; S.scene.add(pl);
    S.scroll.push({ t, k: Math.hypot(vx, vz) / (L / t.repeat.y) });
    return s;
  }
  // grande roue : des nacelles qui montent (on monte dedans)
  function wheel(zc, yc, R, n, w, col) {
    const g = new THREE.Group(); g.position.set(0, yc, zc); S.scene.add(g);
    [-1, 1].forEach(sd => { const rim = mesh(own(new THREE.TorusGeometry(R, 0.3, 8, 48)), mat(col)); rim.rotation.y = Math.PI / 2; rim.position.x = sd * 2.7; g.add(rim);
      for (let i = 0; i < n; i++) { const h = new THREE.Group(); h.position.x = sd * 2.7; h.rotation.x = i * 2 * Math.PI / n; const sp = mesh(BOXG, mat('#ffffff'), false); sp.scale.set(0.2, R, 0.2); sp.position.y = R / 2; h.add(sp); g.add(h); } });
    const ax = mesh(own(new THREE.CylinderGeometry(0.7, 0.7, 6.4, 14)), mat('#ffffff')); ax.rotation.z = Math.PI / 2; g.add(ax);
    [-1, 1].forEach(sd => addDeco(BOXG, shade(col, 0.75), sd * 3.6, yc - (R + 9) / 2, zc, 0.7, R + 9, 0.7));
    for (let k = 0; k < 18; k++) { const b = mesh(S.bulb || (S.bulb = own(new THREE.SphereGeometry(0.22, 8, 6))), mat('#fff4a0', { emissive: '#ffe14a', emissiveIntensity: 0.9 }), false); const a = k / 18 * Math.PI * 2; b.position.set(2.7, Math.sin(a) * R, Math.cos(a) * R); g.add(b); }
    S.anim.push(t => { g.rotation.x = -w * t; });
    for (let i = 0; i < n; i++) { const a0 = i * 2 * Math.PI / n; addBox(0, yc, zc, 4.2, 0.6, 3.4, PAL[i % PAL.length], { noUnder: true, move: t => { const a = w * t + a0; return { x: 0, y: yc + R * Math.sin(a), z: zc + R * Math.cos(a) }; } }); }
  }
  // murs troués qui avancent vers toi : passe par le trou !
  function pusherWalls(z0, L, y, W, n, v, r) {
    for (let i = 0; i < n; i++) {
      const hole = 3.8, hx = (r() - 0.5) * (W - hole - 2.5), ph = i * L / n, H = 4.6, col = PAL[(i + 2) % PAL.length];
      const lw = (hx - hole / 2) + W / 2, rw = W / 2 - (hx + hole / 2);
      const mk = (cx, ww) => addBox(cx, y + H, z0 + L, ww, H + 0.3, 1.3, col, { noUnder: true, col2: '#ffffff', move: t => { const u = ((t * v + ph) % L) / L; let yy = y + H; if (u > 0.9) yy -= (u - 0.9) / 0.1 * (H + 0.6); else if (u < 0.06) yy -= (1 - u / 0.06) * (H + 0.6); return { x: cx, y: yy, z: z0 + L - u * L }; } });
      if (lw > 0.3) mk(-W / 2 + lw / 2, lw); if (rw > 0.3) mk(W / 2 - rw / 2, rw);
    }
  }
  Object.assign(SEC, {
    tobo: { d: 2, f(c, r, col) {          // toboggan géant à murets, avec deux bosses de saut
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 8, 14, y, col); pad(0, y, z - 3, 10, 5);
      const L = 70 + r() * 25, drop = L * 0.27, W = 11; const rp = addRamp(0, z, z + L, y, y - drop, W, '#3fd0ff'); rp.slide = true; sideWalls(rp, W, z, z + L, col);
      for (const f of [0.35, 0.7]) { const zk = z + L * f, yk = rampY(rp, zk); addRamp(0, zk, zk + 3.5, yk, yk + 1.3, W - 0.2, '#ffe14a'); }
      z += L + 9 + r() * 2.5; z = plat(z, 14, 18, y - drop - 2.5, nextCol(col, 1)); return { z, y: y - drop - 2.5 }; } },
    flipper: { d: 2, f(c, r, col) {       // pente large pleine de champignons rebondissants
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 6, 16, y, col); const L = 52 + r() * 10, drop = L * 0.22, W = 22;
      const rp = addRamp(0, z, z + L, y, y - drop, W, col); rp.slide = true; sideWalls(rp, W, z, z + L, nextCol(col, 2));
      for (let i = 0; i < 13; i++) { const zz = z + 6 + r() * (L - 11), x = (r() - 0.5) * (W - 4); addBumper(x, zz, rampY(rp, zz), 1.3 + r() * 0.7, PAL[i % PAL.length]); }
      z += L; z = plat(z, 10, 18, y - drop, nextCol(col, 3)); return { z, y: y - drop }; } },
    ventilos: { d: 3, f(c, r, col) {      // traverser le vide en se laissant porter par des ventilateurs géants
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 10, 14, y, col); const n = 3;
      for (let i = 0; i < n; i++) fan((i % 2 ? 1 : -1) * 1.2, z + 6 + i * 10, y - 9, y + 9.5, 3.9, PAL[(i + 1) % PAL.length]);
      z += 6 + (n - 1) * 10 + 8; z = plat(z, 10, 14, y + 3, nextCol(col, 2)); return { z, y: y + 3 }; } },
    roue: { d: 2, f(c, r, col) {          // grande roue : monte dans une nacelle, saute en haut
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 10, 14, y, col); const R = 9.5, zc = z + 2.8, yc = y + 9.3;
      wheel(zc, yc, R, 8, 0.6, col);
      z = zc + R + 2.3; z = plat(z, 12, 16, yc, nextCol(col, 2)); return { z, y: yc }; } },
    canons: { d: 2, f(c, r, col) {        // canons : on est propulsé à 20 m
      cp(c.z, c.y); let y = c.y, z = plat(c.z, 12, 16, y, col);
      for (let k = 0; k < 2; k++) {
        [-4.5, 0, 4.5].forEach(x => { const s = addBox(x, y + 0.2, z - 2.5, 3.2, 0.4, 3.2, '#ff3b3b', { plain: true }); s.cannon = [0, 19, 24];
          const bar = mesh(S.canG || (S.canG = own(new THREE.CylinderGeometry(0.95, 1.2, 3.6, 16, 1, true))), [mat('#3b3a52')]); bar.material = mat('#3b3a52'); bar.position.set(x, y + 1.3, z - 4.2); bar.rotation.x = 0.8; S.scene.add(bar); });
        z += 14; y += 4; z = plat(z, 14, 18, y, nextCol(col, k + 1));
      }
      return { z, y }; } },
    tapis: { d: 2, f(c, r, col) {         // tapis roulants express, puis tapis qui poussent sur le côté
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 6, 12, y, col);
      belt(0, y, z + 13, 7, 26, 0, 11); z += 26;
      const sd = r() < 0.5 ? 1 : -1; belt(0, y, z + 6, 12, 12, sd * 7, 0); z += 12;
      belt(0, y, z + 6, 12, 12, -sd * 7, 0); z += 12;
      belt(0, y, z + 13, 7, 26, 0, 11); z += 26;
      z = plat(z, 8, 14, y, col); return { z, y }; } },
    murs: { d: 3, f(c, r, col) {          // murs troués qui avancent
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 6, 16, y, col); const L = 48, W = 16;
      z = plat(z, L, W, y, nextCol(col, 1)); pusherWalls(z - L, L, y, W, 4, 4.2, r);
      [-1, 1].forEach(sd => addBox(sd * (W / 2 + 0.45), y + 2.5, z - L / 2, 0.9, 2.5, L, '#ffffff', { col2: col, noUnder: true }));
      z = plat(z, 8, 16, y, col); return { z, y }; } },
    marteaux: { d: 3, f(c, r, col) {      // marteaux géants
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 6, 14, y, col); const L = 48;
      z = plat(z, L, 9, y, nextCol(col, 1));
      for (let i = 0; i < 4; i++) giantHammer(0, y + 15, z - L + 8 + i * 11, 11.5, 1.1, 2.8 + (i % 2) * 0.5, i * 1.9, PAL[(i + 3) % PAL.length], 2.1, y, 4.5);
      z = plat(z, 8, 14, y, col); return { z, y }; } },
    mixeur: { d: 3, f(c, r, col) {        // plateau tournant + barre basse (à sauter) + barre haute (à ne pas sauter)
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 8, 12, y, col); const R0 = 14, zc = z + R0 + 0.5;
      addDisc(0, zc, y, R0, 3, nextCol(col, 1), 0.45, 6);
      addPillar(0, zc, y, y + 3.4, 1.0, '#ffffff');
      addSweep(0, zc, y + 0.05, 0.75, R0 - 0.3, 0.45, 1.5, '#ff3b3b', 0, 0);
      addSweep(0, zc, y + 2.15, 0.6, R0 - 0.3, 0.4, -1.0, '#ffe14a', 1.6, 0);
      z = zc + R0 + 0.5; z = plat(z, 9, 14, y, col); return { z, y }; } },
    vague: { d: 2, f(c, r, col) {         // champ de blocs qui ondulent comme une vague (elle avance avec toi)
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 7, 16, y, col); const rows = 15, cols = 6, s2 = 2.5, ph = r() * 6;
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const x = (j - (cols - 1) / 2) * s2, zz = z + 1.25 + i * s2; addBox(x, y, zz, s2 - 0.08, 6, s2 - 0.08, PAL[(i + j) % PAL.length], { noUnder: true, move: t => ({ x, y: y + 0.2 + 1.1 * Math.sin(0.2 * i * s2 + 0.15 * j - 2.4 * t + ph), z: zz }) }); }
      z += rows * s2 + 0.5; z = plat(z, 8, 16, y + 0.5, col); return { z, y: y + 0.5 }; } },
    geysers: { d: 2, f(c, r, col) {       // champ de geysers qui propulsent, puis un geyser pour monter à l'étage
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 6, 14, y, col); const L = 44;
      z = plat(z, L, 14, y, nextCol(col, 1));
      for (let i = 0; i < 10; i++) geyser(((i % 3) - 1) * 4 + (r() - 0.5), z - L + 4 + i * 3.6, y, 2.2, 0.8, -i * 0.25);
      [-4, 0, 4].forEach((x, k) => geyser(x, z - 1.2, y, 1.8, 0.8, k * 0.6));
      addBox(0, y + 6, z + 5, 14, 8, 10, col); z += 10; return { z, y: y + 6 }; } },
    glace: { d: 2, f(c, r, col) {         // pente de glace (ça glisse !) avec des champignons qui renvoient
      cp(c.z, c.y); const y = c.y; let z = plat(c.z, 6, 16, y, col); const L = 60 + r() * 15, drop = L * 0.16, W = 18;
      const rp = addRamp(0, z, z + L, y, y - drop, W, '#bfe9ff'); rp.slide = true; rp.ice = true; rp.mesh.material = [matIce(), matS('#9fd9ff')];
      for (let i = 0; i < 8; i++) { const zz = z + 9 + i * (L - 14) / 7, x = (r() - 0.5) * 12; addBumper(x, zz, rampY(rp, zz), 1.4, i % 2 ? '#ffffff' : '#7ab8ff'); }
      z += L; z = plat(z, 10, 18, y - drop, nextCol(col, 2)); return { z, y: y - drop }; } },
  });
  const BIG = ['tobo', 'flipper', 'ventilos', 'roue', 'canons', 'tapis', 'murs', 'marteaux', 'mixeur', 'vague', 'geysers', 'glace', 'mur', 'couloir', 'zigzag', 'tremplin', 'rebonds', 'saut'];
  const PAL0 = PAL.slice();
  // les cartes : chacune a son ambiance et ses gros obstacles (petits réglages tirés au sort à chaque partie)
  const MAPS = [
    { name: 'LES TOBOGGANS GÉANTS', desc: 'Ça descend, ça glisse, ça vole', sky: ['#2f8bff', '#bfe4ff'], seq: ['tobo', 'saut', 'flipper', 'tremplin', 'tobo', 'mur'] },
    { name: 'LA FÊTE FORAINE', desc: 'Grande roue, canons et flipper géant', sky: ['#ff6fbf', '#ffe3b0'], seq: ['roue', 'flipper', 'canons', 'mixeur', 'rebonds'] },
    { name: 'LA TEMPÊTE', desc: 'Laisse-toi porter par les ventilateurs géants', sky: ['#4f5bd0', '#c3c8ff'], sea: '#d6d8ff', seq: ['ventilos', 'couloir', 'marteaux', 'ventilos', 'zigzag'] },
    { name: 'LA BANQUISE', desc: 'Tout glisse : garde le contrôle !', sky: ['#5cbcff', '#effaff'], sea: '#f4fbff', pal: ['#9fd9ff', '#7ab8ff', '#c7b8ff', '#7fe0e0', '#5c9cff', '#b3e6ff'], seq: ['glace', 'mur', 'tremplin', 'glace', 'couloir', 'saut'] },
    { name: 'L\'USINE FOLLE', desc: 'Tapis roulants, murs qui avancent, marteaux', sky: ['#ff8a4a', '#ffe0b0'], sea: '#ffe9d6', pal: ['#ff8a3d', '#8a8aa8', '#ffcf2e', '#5d9cff', '#ff5f3d', '#3fd0ff'], seq: ['tapis', 'murs', 'marteaux', 'tapis', 'mixeur'] },
    { name: 'LE PARC À RESSORTS', desc: 'Geysers, canons et trampolines', sky: ['#2fc59a', '#d8fff0'], sea: '#e6fff6', seq: ['rebonds', 'geysers', 'canons', 'vague', 'saut'] },
    { name: 'LES VAGUES', desc: 'Surfe sur les blocs qui ondulent', sky: ['#1f9fff', '#bff2ff'], seq: ['vague', 'tobo', 'ventilos', 'vague', 'tremplin'] },
    { name: 'LE DÉFI DES MURS', desc: 'Cours sur les murs, passe dans les trous', sky: ['#8a5cff', '#e6dcff'], sea: '#efe8ff', seq: ['mur', 'couloir', 'murs', 'zigzag', 'tremplin', 'mur'] },
    { name: 'LE GRAND HUIT', desc: 'La carte la plus rapide', sky: ['#ff5f7a', '#ffe0e8'], sea: '#fff0f3', seq: ['tobo', 'canons', 'tapis', 'tobo', 'rebonds'] },
    { name: 'LE CHÂTEAU GONFLABLE', desc: 'Ça rebondit dans tous les sens', sky: ['#ffae2e', '#fff2c8'], sea: '#fff6e0', seq: ['flipper', 'geysers', 'mixeur', 'roue', 'marteaux'] },
    { name: 'LE GRAND MIX', desc: 'Un mélange au hasard de tous les obstacles', sky: ['#24c0d8', '#d6f8ff'], seq: null },
    { name: 'LE GRAND TOUR', desc: 'Virages, spirale du donjon, tyrolienne, pont fragile, ascenseur et toboggan géant', sky: ['#3a8dff', '#cfe8ff'], build: (r, MP) => buildGrandTour(r, MP) },
    { name: 'LA CITÉ DES TOITS', desc: 'De toit en toit au coucher du soleil : ruelle à murs, tyrolienne, canons', sky: ['#ff8a4a', '#ffd9b8'], sea: '#ffe6d6', build: (r, MP) => buildRooftops(r, MP) },
    { name: 'LE TEMPLE PERDU', desc: 'Spirale dans le puits, marteaux géants, ventilateurs et geysers', sky: ['#2fae7a', '#d9ffe9'], sea: '#e2fff0', build: (r, MP) => buildTemple(r, MP) },
    { name: 'LA FABRIQUE DE BONBONS', desc: 'Tapis roulants, mixeur, ascenseur et trampolines sucrés', sky: ['#ff6fbf', '#ffe6f4'], sea: '#fff0f8', build: (r, MP) => buildCandy(r, MP) },
    { name: 'LES MONTAGNES RUSSES', desc: 'Ça descend, ça tourne, ça décolle', sky: ['#5b6cff', '#e0e4ff'], sea: '#eef0ff', build: (r, MP) => buildCoaster(r, MP) },
    { name: 'LA STATION DE SKI', desc: 'Télécabine, pistes glacées, saut à ski et glaçons', sky: ['#6fb9ff', '#f4fbff'], sea: '#ffffff', build: (r, MP) => buildSki(r, MP) },
    { name: 'LE VOLCAN', desc: 'Pont au-dessus de la lave, marteaux et ascension du cratère', sky: ['#ff5a2a', '#ffcfa0'], sea: '#ffb08a', build: (r, MP) => buildVolcano(r, MP) },
    { name: 'LA BASE SPATIALE', desc: 'Tapis, couloir de murs, mixeur, canons… au milieu des planètes', sky: ['#1a1550', '#6a5bc0'], sea: '#4a3f8a', build: (r, MP) => buildSpace(r, MP) },
    { name: 'LA JUNGLE', desc: 'Murs des géants, pont de lianes, troncs qui cognent, tyrolienne', sky: ['#4fbf6f', '#e4ffd8'], sea: '#c8f0c0', build: (r, MP) => buildJungle(r, MP) },
    { name: 'LE CHÂTEAU', desc: 'Pont-levis tournant, donjon en spirale, dalles fantômes', sky: ['#5a4cb0', '#e0dcff'], sea: '#d8d2ff', build: (r, MP) => buildCastle(r, MP) },
    { name: 'LA PLAGE', desc: 'Vagues qui poussent, canons à eau, toboggan aquatique', sky: ['#3fb6ff', '#fff2c8'], sea: '#7fd8ff', build: (r, MP) => buildBeach(r, MP) },
    { name: 'LA CITÉ NÉON', desc: 'Tapis, couloirs de murs, mixeur, spirale vertigineuse', sky: ['#1a0f3a', '#5a2a8a'], sea: '#3a1f6a', build: (r, MP) => buildNeon(r, MP) },
  ];
  const pathIdx = () => MAPS.map((m, i) => m.build ? i : -1).filter(i => i >= 0);
  const mapFromSeed = s => { const pm = pathIdx(); return s % 4 !== 0 && pm.length ? pm[Math.floor(s / 4) % pm.length] : s % MAPS.length; };
  P.pathMaps = pathIdx;
  P.pickSeed = function () {
    let last = -1; try { last = BR.store.get('br_party_map', -1); } catch (e) {}
    let s; do { s = (Math.random() * 2 ** 31) >>> 0; } while (mapFromSeed(s) === last);
    return s;
  };

  /* ===================== CARTES À TRACÉ LIBRE : virages, spirales, tyroliennes… ===================== */
  // une « tortue » (position, hauteur, cap) pose les morceaux du parcours les uns après les autres
  const fwd = yaw => [Math.sin(yaw), Math.cos(yaw)], rgt = yaw => [Math.cos(yaw), -Math.sin(yaw)];
  function tp(c, lx, lz) { const f = fwd(c.yaw), r = rgt(c.yaw); return [c.x + r[0] * lx + f[0] * lz, c.z + r[1] * lx + f[1] * lz]; }
  function wp(x, y, z, o) { const P = S.path, l = P[P.length - 1]; P.push(Object.assign({ x, y, z, d: l ? l.d + Math.hypot(x - l.x, y - l.y, z - l.z) : 0 }, o || {})); }
  function cpAt(c, low) {   // point de passage (zone ronde) + arche orientée
    const [sx, sz] = tp(c, 0, -3);   // on réapparaît 3 m avant (sur la plateforme d'où on vient), jamais au bord du vide
    S.checks.push({ x: c.x, y: c.y, z: c.z, r: 7, sx, sz, yaw: c.yaw, low: low != null ? low : c.y });
    const n = S.checks.length, col = PAL[n % PAL.length];
    [-1, 1].forEach(sd => { const [px, pz] = tp(c, sd * 5.2, 1.2); addDeco(S.post || (S.post = own(new THREE.CylinderGeometry(0.22, 0.26, 1, 10))), '#ffffff', px, c.y + 2.3, pz, 1, 4.6, 1); });
    const [bx, bz] = tp(c, 0, 1.2); const bn = addDeco(BOXG, col, bx, c.y + 4.8, bz, 10.8, 0.7, 0.35); bn.rotation.y = c.yaw;
  }
  function pStraight(c, L, w, col, o) {
    o = o || {}; const [mx, mz] = tp(c, 0, L / 2);
    const s = addBox(mx, c.y, mz, w, o.h || 2.4, L + 0.3, col, { ry: c.yaw, noUnder: o.noUnder, col2: o.col2 });
    for (let k = 1; k <= Math.ceil(L / 6); k++) { const [x, z] = tp(c, 0, Math.min(L, k * 6)); wp(x, c.y, z, o.wp); }
    const [ex, ez] = tp(c, 0, L); c.x = ex; c.z = ez; return s;
  }
  // virage (ang > 0 : vers la droite) ; dy = montée totale (une spirale = un long virage qui monte)
  function pArc(c, ang, R, w, col, dy, o) {
    o = o || {}; dy = dy || 0; if (o.rail === undefined) o.rail = -Math.sign(ang);   // rebord côté extérieur du virage (sinon on est éjecté à pleine vitesse)
    const n = Math.max(4, Math.ceil(Math.abs(ang) * R / (o.seg || 2.2))), da = ang / n, ch = 2 * R * Math.sin(Math.abs(da) / 2);
    for (let i = 0; i < n; i++) {
      const hy = c.yaw + da / 2, f = fwd(hy), nx = c.x + f[0] * ch, nz = c.z + f[1] * ch, top = c.y + dy / n;
      addBox((c.x + nx) / 2, top, (c.z + nz) / 2, w, o.h || 2.4, ch + 0.6, o.alt && i % 2 ? o.alt : col, { ry: hy, noUnder: true });
      if (o.rail) { const r = rgt(hy), rh = o.railH || 1.1; for (const sd of o.both ? [1, -1] : [1]) { const k = sd * o.rail * (w / 2 + 0.3); addBox((c.x + nx) / 2 + r[0] * k, top + rh, (c.z + nz) / 2 + r[1] * k, 0.5, rh, ch + 0.6, '#ffffff', { ry: hy, noUnder: true, col2: col }); } }
      c.x = nx; c.z = nz; c.y = top; c.yaw += da; wp(c.x, c.y, c.z);
    }
    return c;
  }
  // pente dans n'importe quelle direction (dy < 0 : toboggan qui accélère)
  function pRamp(c, L, dy, w, col, o) {
    o = o || {}; const f = fwd(c.yaw), r = rgt(c.yaw), x0 = c.x, z0 = c.z, y0 = c.y, y1 = c.y + dy;
    const s = { t: 'ramp', gen: true, ox: x0, oz: z0, fx: f[0], fz: f[1], rx: r[0], rz: r[1], L, hw: w / 2, y0, y1, slide: dy < 0, dir: f };
    const g = new THREE.Group(); g.position.set(x0 + f[0] * L / 2, (y0 + y1) / 2, z0 + f[1] * L / 2); g.rotation.order = 'YXZ'; g.rotation.y = c.yaw; g.rotation.x = -Math.atan2(dy, L);
    const b = mesh(rboxGeo(w, 1, Math.hypot(L, dy)), [o.ice ? matIce() : matT(col), matS(col)]); b.position.y = -0.5; g.add(b);
    for (let i = 0; i < Math.floor(L / 3); i++) { const k = mesh(BOXG, mat(light(col, 0.5)), false); k.scale.set(w + 0.04, 0.08, 0.6); k.position.set(0, 0.01, -Math.hypot(L, dy) / 2 + 1.5 + i * 3); g.add(k); }
    S.scene.add(g); S.solids.push(s); s.mesh = b;
    if (o.walls) for (let t = 0; t < L - 0.5; t += 7) {   // murets (on peut courir dessus)
      const t1 = Math.min(L, t + 7), ya = y0 + dy * t / L, yb = y0 + dy * t1 / L, yT = Math.max(ya, yb) + 2.6, yB = Math.min(ya, yb) - 1.6;
      [-1, 1].forEach(sd => { const k = sd * (w / 2 + 0.45), tm = (t + t1) / 2; addBox(x0 + f[0] * tm + r[0] * k, yT, z0 + f[1] * tm + r[1] * k, 0.9, yT - yB, t1 - t, '#ffffff', { ry: c.yaw, noUnder: true, col2: o.walls }).wr = true; });
    }
    for (let k = 1; k <= Math.ceil(L / 6); k++) { const t = Math.min(L, k * 6); wp(x0 + f[0] * t, y0 + dy * t / L, z0 + f[1] * t); }
    c.x = x0 + f[0] * L; c.z = z0 + f[1] * L; c.y = y1; return s;
  }
  function padAt(c, lz, w, d) { const [x, z] = tp(c, 0, lz); return pad(x, c.y, z, w, d, c.yaw); }
  function gap(c, L, dy, o) { const [x, z] = tp(c, 0, L); for (let k = 1; k < 3; k++) { const [ix, iz] = tp(c, 0, L * k / 3); wp(ix, c.y + (dy || 0) * k / 3 + 1.5, iz, o); } c.x = x; c.z = z; c.y += dy || 0; wp(c.x, c.y, c.z); return c; }
  // tyrolienne : on s'accroche en passant dessous, on file au-dessus du vide (Espace pour lâcher)
  function zipline(ax, ay, az, bx, by, bz) {
    const zz = { ax, ay, az, bx, by, bz, L: Math.hypot(bx - ax, by - ay, bz - az) }; S.zips.push(zz);
    const dir = new THREE.Vector3(bx - ax, by - ay, bz - az).normalize();
    const cab = mesh(own(new THREE.CylinderGeometry(0.07, 0.07, zz.L, 6)), mat('#3b3a52'), false); cab.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); cab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); S.scene.add(cab);
    for (const [x, y, z] of [[ax, ay, az], [bx, by, bz]]) { addDeco(BOXG, '#ff4f9e', x, y - 1.4, z, 0.45, 3.4, 0.45); addDeco(BOXG, '#ffffff', x, y + 0.35, z, 1.6, 0.35, 0.45); }
    const hd = mesh(own(new THREE.TorusGeometry(0.35, 0.09, 6, 14)), mat('#ffe14a'), false); S.scene.add(hd);
    S.anim.push(t => { const u = (t * 0.3) % 1; hd.position.set(ax + (bx - ax) * u, ay + (by - ay) * u - 0.35, az + (bz - az) * u); });
    for (let k = 1; k <= 6; k++) { const u = k / 6; wp(ax + (bx - ax) * u, ay + (by - ay) * u - 1.9, az + (bz - az) * u); }
  }
  // pont fragile : chaque planche tombe 0,7 s après qu'on marche dessus, puis revient
  function crumbleBridge(c, L, w, col) {
    const n = Math.ceil(L / 2.2), l = L / n;
    for (let i = 0; i < n; i++) { const [x, z] = tp(c, 0, (i + 0.5) * l); const s = addBox(x, c.y, z, w, 0.7, l - 0.12, i % 2 ? col : '#c98b4a', { ry: c.yaw, noUnder: true }); s.crb = S.crs.length + 1; s.home = s.g.position.clone(); s.mat0 = s.g.children[0].material; S.crs.push(s); }
    for (let k = 1; k <= Math.ceil(L / 6); k++) { const [x, z] = tp(c, 0, Math.min(L, k * 6)); wp(x, c.y, z); }
    const [ex, ez] = tp(c, 0, L); c.x = ex; c.z = ez;
  }
  /* ---------- LE GRAND TOUR ---------- */
  function buildGrandTour(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 160, 560);
    S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 };
    // départ : grande place + tribunes
    S.checks.push({ x: 0, y: 0, z: 4, r: 0.1, sx: 0, sz: 5, yaw: 0, low: 0, start: true }); wp(0, 0, -2);
    pStraight(c, 22, 18, '#7a6cff'); tribune(-11, -1, 20, 0, -1); tribune(11, -1, 20, 0, 1);
    padAt(c, -5, 9, 5);
    // 1. l'avenue qui tourne (boosts + champignons dans le virage)
    cpAt(c); pArc(c, Math.PI / 2, 17, 10, '#ffb13d', 0, { alt: '#ffc85a' });
    { const [x, z] = tp(c, 0, -14); addBumper(x + rgt(c.yaw)[0] * 2.5, z + rgt(c.yaw)[1] * 2.5, 0, 1.4, '#ff4f9e'); }
    pStraight(c, 8, 10, '#ffb13d'); padAt(c, -4, 8, 5);
    // 2. la spirale du donjon : on monte en tournant autour de la tour
    cpAt(c);
    const R = 9, [tcx, tcz] = tp(c, R, 0), y0 = c.y;
    pArc(c, Math.PI * 2.5, R, 4.6, '#47d16c', 14, { rail: -1, alt: '#5fe07f', seg: 1.9 });
    addPillar(tcx, tcz, y0 - 6, y0 + 16, R - 2.9, '#e8e0f5');
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (i % 2) addDeco(BOXG, '#d6cdea', tcx + Math.cos(a) * (R - 3.2), y0 + 16.6, tcz + Math.sin(a) * (R - 3.2), 1.6, 1.4, 1.6); }
    { const roof = mesh(own(new THREE.ConeGeometry(R - 1.8, 7, 16)), mat('#ff4f9e')); roof.position.set(tcx, y0 + 21.5, tcz); S.scene.add(roof); addDeco(BOXG, '#ffffff', tcx, y0 + 27, tcz, 0.2, 4, 0.2); const fl = addDeco(BOXG, '#ffe14a', tcx + 1, y0 + 28.2, tcz, 2, 1.2, 0.1, false); S.anim.push(t => { fl.rotation.y = Math.sin(t * 3) * 0.3; }); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; const [px, pz] = [tcx + Math.cos(a) * (R - 2.7), tcz + Math.sin(a) * (R - 2.7)]; addDeco(BOXG, PAL[k % PAL.length], px, y0 + 9, pz, 0.15, 3, 1.4); }
    // 3. sommet + tyrolienne au-dessus du vide
    pStraight(c, 7, 7, '#7a6cff'); cpAt(c, c.y - 10);
    { const [ax, az] = tp(c, 0, 1.5), [bx, bz] = tp(c, 0, 46); zipline(ax, c.y + 3.1, az, bx, c.y - 6.4 + 3.1, bz); }
    c.x = tp(c, 0, 44)[0]; c.z = tp(c, 0, 44)[1]; c.y -= 9;
    pStraight(c, 10, 12, '#3fd0ff');
    // 4. le pont fragile en zigzag
    cpAt(c);
    c.yaw += 0.55; crumbleBridge(c, 12, 3.2, '#a86b35'); pStraight(c, 3.4, 4.2, '#ffb13d');
    c.yaw -= 1.1; crumbleBridge(c, 12, 3.2, '#a86b35'); pStraight(c, 3.4, 4.2, '#ffb13d');
    c.yaw += 0.55; crumbleBridge(c, 10, 3.2, '#a86b35');
    pStraight(c, 10, 22, '#ff6fb0');
    // 5. l'embranchement : à gauche le couloir de murs (raccourci), à droite les plateformes qui clignotent
    cpAt(c);
    { const L = 24, base = Object.assign({}, c);
      // couloir de murs (au-dessus du vide)
      [-8.6, -2.2].forEach(lx => { const [x, z] = tp(base, lx, L / 2); const w = addBox(x, base.y + 4.5, z, 0.9, 8.5, L, '#ffffff', { ry: base.yaw, noUnder: true, col2: '#ff4f9e' }); w.wr = true; });
      // plateformes clignotantes (le chemin des bots)
      for (let i = 0; i < 6; i++) { const [x, z] = tp(base, 5 + (i % 2 ? 1 : -1) * 0.9, 2.2 + i * 3.9); const s = addBox(x, base.y, z, 3, 0.8, 3, PAL[i % PAL.length], { ry: base.yaw, noUnder: true }); s.blink = { per: 3.2, on: 0.62, ph: i * 0.5 }; wp(x, base.y, z); }
      const [ex, ez] = tp(base, 0, L); c.x = ex; c.z = ez; }
    pStraight(c, 9, 22, '#ff6fb0');
    // 6. l'ascenseur
    cpAt(c);
    { const H = 10, [ex, ez] = tp(c, 0, 3.4), yb = c.y; addBox(ex, yb, ez, 6, 0.8, 6, '#ffe14a', { ry: c.yaw, noUnder: true, move: t => ({ x: ex, y: yb + H * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 6)), z: ez }) });
      [-1, 1].forEach(sd => { const [px, pz] = tp(c, sd * 3.6, 3.4); addDeco(BOXG, '#ffffff', px, yb + 6, pz, 0.5, 13, 0.5); });
      wp(ex, yb, ez, { wait: true }); wp(ex, yb + H, ez, { wait: true }); c.x = tp(c, 0, 6.6)[0]; c.z = tp(c, 0, 6.6)[1]; c.y += H; }
    pStraight(c, 9, 12, '#7a6cff');
    // 7. le grand toboggan à murets, avec deux bosses de saut
    cpAt(c, c.y - 18);
    padAt(c, -3.5, 9, 5);
    { const L = 56, yA = c.y, rp = pRamp(c, L, -15, 11, '#3fd0ff', { walls: '#ff4f9e' }); for (const fr of [0.3, 0.55]) { const cc = { x: rp.ox + rp.fx * L * fr, z: rp.oz + rp.fz * L * fr, y: yA - 15 * fr, yaw: c.yaw }; const save = S.path.length; pRamp(cc, 3.5, 1.3, 10.8, '#ffe14a'); S.path.length = save; } }
    gap(c, 10, -1.5);
    // 8. l'arène d'arrivée (avec arche et tribunes)
    const fy = c.y, [fx, fz] = tp(c, 0, 14);
    pStraight(c, 28, 22, '#ffe14a');
    S.finishBox = { x: fx, z: fz, hx: 11, hz: 4, ry: c.yaw, y: fy }; S.finishZ = fz; S.finishY = fy;
    { const fl = cv(256, 32, g => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); } }); const fm = new THREE.MeshStandardMaterial({ map: fl }); S.disp.push(fm, fl);
      const line = mesh(BOXG, fm, false); line.scale.set(22, 0.05, 1.2); line.position.set(fx, fy + 0.04, fz); line.rotation.y = c.yaw; S.scene.add(line);
      const arch = cv(512, 128, g => { g.fillStyle = '#ff3f9b'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#fff'; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ARRIVÉE', 256, 68); });
      const am = new THREE.MeshStandardMaterial({ map: arch, emissive: '#ffffff', emissiveMap: arch, emissiveIntensity: 0.25 }); S.disp.push(am, arch);
      const ab = mesh(BOXG, am); ab.scale.set(22, 3, 0.8); ab.position.set(fx, fy + 8, fz); ab.rotation.y = c.yaw; S.scene.add(ab);
      [-1, 1].forEach(sd => { const [px, pz] = tp({ x: fx, z: fz, yaw: c.yaw }, sd * 10.6, 0); addDeco(BOXG, '#ffffff', px, fy + 4, pz, 1, 8, 1); }); }
    // décor : nuages, îlots, mer de nuages (loin du tracé)
    let ymin = 0; S.path.forEach(q => { ymin = Math.min(ymin, q.y); });
    sea(ymin - 60, MP.sea || '#e2ecff');
    const geo = own(new THREE.IcosahedronGeometry(1, 1)), cm = mat('#ffffff', { roughness: 1, emissive: '#cfe8ff', emissiveIntensity: 0.25 });
    for (let i = 0; i < 40; i++) { const q = S.path[Math.floor(r() * S.path.length)], a = r() * Math.PI * 2, d = 45 + r() * 90, cx = q.x + Math.cos(a) * d, cz = q.z + Math.sin(a) * d, cy = q.y - 25 + r() * 50;
      if (S.path.some(w => Math.hypot(w.x - cx, w.z - cz) < 30)) continue;
      for (let k = 0; k < 5; k++) { const s = 4 + r() * 6, pp = mesh(geo, cm, false); pp.position.set(cx + (r() - 0.5) * 14, cy + (r() - 0.5) * 3, cz + (r() - 0.5) * 8); pp.scale.set(s * 1.4, s * 0.8, s); S.scene.add(pp); } }
    S.spawns = []; for (let i = 0; i < 12; i++) S.spawns.push({ x: ((i % 4) - 1.5) * 2.6, y: 0, z: 4 + Math.floor(i / 4) * 2.6 });
    S.fallY = -1e9;
  }

  /* ---------- pièces génériques (orientées selon le cap de la tortue) ---------- */
  function startPlaza(c) { S.checks.push({ x: 0, y: 0, z: 4, r: 0.1, sx: 0, sz: 5, yaw: 0, low: 0, start: true }); wp(0, 0, -2); pStraight(c, 22, 18, '#7a6cff'); tribune(-11, -1, 20, 0, -1); tribune(11, -1, 20, 0, 1); padAt(c, -5, 9, 5); }
  function finishArena(c, gateCol) {
    const fy = c.y, [fx, fz] = tp(c, 0, 14);
    pStraight(c, 28, 22, '#ffe14a');
    S.finishBox = { x: fx, z: fz, hx: 11, hz: 4, ry: c.yaw, y: fy }; S.finishZ = fz; S.finishY = fy;
    const fl = cv(256, 32, g => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); } }); const fm = new THREE.MeshStandardMaterial({ map: fl }); S.disp.push(fm, fl);
    const line = mesh(BOXG, fm, false); line.scale.set(22, 0.05, 1.2); line.position.set(fx, fy + 0.04, fz); line.rotation.y = c.yaw; S.scene.add(line);
    const arch = cv(512, 128, g => { g.fillStyle = gateCol || '#ff3f9b'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#fff'; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ARRIVÉE', 256, 68); });
    const am = new THREE.MeshStandardMaterial({ map: arch, emissive: '#ffffff', emissiveMap: arch, emissiveIntensity: 0.25 }); S.disp.push(am, arch);
    const ab = mesh(BOXG, am); ab.scale.set(22, 3, 0.8); ab.position.set(fx, fy + 8, fz); ab.rotation.y = c.yaw; S.scene.add(ab);
    [-1, 1].forEach(sd => { const [px, pz] = tp({ x: fx, z: fz, yaw: c.yaw }, sd * 10.6, 0); addDeco(BOXG, '#ffffff', px, fy + 4, pz, 1, 8, 1); });
    for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const [x, z] = tp({ x: fx, z: fz, yaw: c.yaw }, sd * 12.5, 3 + k * 5); addDeco(BOXG, k % 2 ? '#ffffff' : '#ffd1ea', x, fy + 1 + k * 0.2, z, 3, 2 + k * 0.4, 4).rotation.y = c.yaw; }
  }
  function decorAround(r, MP, extra) {
    let ymin = 0; S.path.forEach(q => { ymin = Math.min(ymin, q.y); });
    sea(ymin - 60, MP.sea || '#e2ecff');
    const geo = own(new THREE.IcosahedronGeometry(1, 1)), cm = mat('#ffffff', { roughness: 1, emissive: '#cfe8ff', emissiveIntensity: 0.25 });
    for (let i = 0; i < 40; i++) { const q = S.path[Math.floor(r() * S.path.length)], a = r() * Math.PI * 2, d = 45 + r() * 90, cx = q.x + Math.cos(a) * d, cz = q.z + Math.sin(a) * d, cy = q.y - 25 + r() * 50;
      if (S.path.some(w => Math.hypot(w.x - cx, w.z - cz) < 30)) continue;
      for (let k = 0; k < 5; k++) { const s = 4 + r() * 6, pp = mesh(geo, cm, false); pp.position.set(cx + (r() - 0.5) * 14, cy + (r() - 0.5) * 3, cz + (r() - 0.5) * 8); pp.scale.set(s * 1.4, s * 0.8, s); S.scene.add(pp); } }
    if (extra) for (let i = 0; i < 60; i++) { const q = S.path[Math.floor(r() * S.path.length)], a = r() * Math.PI * 2, d = 22 + r() * 70, x = q.x + Math.cos(a) * d, z = q.z + Math.sin(a) * d; if (S.path.some(w => Math.hypot(w.x - x, w.z - z) < 16)) continue; extra(x, q.y, z, r); }
    S.spawns = []; for (let i = 0; i < 12; i++) S.spawns.push({ x: ((i % 4) - 1.5) * 2.6, y: 0, z: 4 + Math.floor(i / 4) * 2.6 });
    S.fallY = -1e9;
  }
  // couloir de murs au-dessus du vide (course murale) ; les bots visent le mur de droite
  function pWallRun(c, L, col) {
    for (const lx of [-3.3, 3.3]) { const [x, z] = tp(c, lx, L / 2); addBox(x, c.y + 4.5, z, 0.9, 8.5, L, '#ffffff', { ry: c.yaw, noUnder: true, col2: col || '#ff4f9e' }).wr = true; }
    for (let k = 1; k <= Math.ceil(L / 5); k++) { const [x, z] = tp(c, 2.6, Math.min(L, k * 5)); wp(x, c.y + 1, z, { nodive: true }); }
    const [ex, ez] = tp(c, 0, L); c.x = ex; c.z = ez;
  }
  // trampoline au bout de la plateforme : on rebondit vers l'étage suivant
  function pTramp(c, up) {
    const [x, z] = tp(c, 0, -2.2); S.tramps.push(addBox(x, c.y + 0.25, z, 9, 0.5, 3.6, '#ff4f9e', { ry: c.yaw, tramp: true, col2: '#ffffff', noUnder: true }));
    gap(c, 3, up, { nodive: true });
  }
  // canons : propulsent à ~20 m (on ne saute pas, le canon s'en charge)
  function pCannons(c, dist, up) {
    const f = fwd(c.yaw);
    [-3.6, 0, 3.6].forEach(lx => { const [x, z] = tp(c, lx, -2.5); const s = addBox(x, c.y + 0.2, z, 3, 0.4, 3, '#ff3b3b', { plain: true, ry: c.yaw }); s.cannon = [f[0] * 24, 19, f[1] * 24];
      const [bx, bz] = tp(c, lx, -4.3); const bar = mesh(S.canG || (S.canG = own(new THREE.CylinderGeometry(0.95, 1.2, 3.6, 16, 1, true))), mat('#3b3a52')); bar.position.set(bx, c.y + 1.3, bz); bar.rotation.order = 'YXZ'; bar.rotation.y = c.yaw; bar.rotation.x = 0.8; S.scene.add(bar); });
    for (let i = Math.max(0, S.path.length - 3); i < S.path.length; i++) S.path[i].nojump = true;
    gap(c, dist, up, { nojump: true, nodive: true });
  }
  // marteau géant qui balaie le chemin (quel que soit le cap)
  function hammerAt(c, lz, len, amp, period, phase, col, sc, halfW) {
    const [px, pz] = tp(c, 0, lz), py = c.y + len + 3.5, yaw = c.yaw, f = fwd(yaw), rr = rgt(yaw);
    const g = new THREE.Group(); g.position.set(px, py, pz); g.rotation.order = 'YXZ'; g.rotation.y = yaw;
    const hr = 1.05 * sc, hl = 1.3 * sc;
    const arm = mesh(BOXG, mat('#5b4bd6')); arm.scale.set(0.55, len, 0.55); arm.position.y = -len / 2; g.add(arm);
    const head = mesh(own(new THREE.CylinderGeometry(hr, hr, hl * 2, 28)), mat(col)); head.rotation.x = Math.PI / 2; head.position.y = -len; g.add(head);
    [-1, 1].forEach(sd => { const cap = mesh(own(new THREE.CylinderGeometry(hr * 1.08, hr * 1.08, 0.45, 28)), mat('#ffffff')); cap.rotation.x = Math.PI / 2; cap.position.set(0, -len, sd * (hl + 0.12)); g.add(cap); });
    S.scene.add(g);
    [-1, 1].forEach(sd => { const [x, z] = tp(c, sd * (halfW + 1.2), lz); addDeco(BOXG, '#ffffff', x, (c.y + py) / 2, z, 0.8, py - c.y + 1, 0.8); });
    addDeco(BOXG, '#5b4bd6', px, py + 0.4, pz, halfW * 2 + 3.4, 0.9, 0.9).rotation.y = yaw;
    S.haz.push({ g, a: 0, da: 0,
      update(t) { const k = 2 * Math.PI / period, u = k * t + phase; this.a = amp * Math.sin(u); this.da = amp * k * Math.cos(u); this.g.rotation.z = this.a; },
      hit(m) {
        const lat = len * Math.sin(this.a), hx = px + rr[0] * lat, hz = pz + rr[1] * lat, hy = py - len * Math.cos(this.a), dx = m.x - hx, dz = m.z - hz;
        if (Math.abs(dx * f[0] + dz * f[1]) > hl + RAD) return null;
        if (Math.hypot(dx * rr[0] + dz * rr[1], m.y + 0.9 - hy) > hr + RAD + 0.4) return null;
        const sg = Math.sign(this.da) || 1; return { x: rr[0] * sg * 21, y: 9, z: rr[1] * sg * 21 };
      } });
  }
  function pHammers(c, L, n, cols) {
    const base = Object.assign({}, c); pStraight(c, L, 9, cols[0]);
    for (let i = 0; i < n; i++) hammerAt(base, 7 + i * (L - 12) / Math.max(1, n - 1), 11.5, 1.1, 2.7 + (i % 2) * 0.5, i * 1.9, cols[(i + 1) % cols.length], 2.1, 4.5);
  }
  function pBlink(c, n, cols) {
    for (let i = 0; i < n; i++) { const [x, z] = tp(c, (i % 2 ? 1 : -1) * 1.1, 2.4 + i * 3.9); const s = addBox(x, c.y, z, 3.2, 0.8, 3.2, cols[i % cols.length], { ry: c.yaw, noUnder: true }); s.blink = { per: 3.2, on: 0.62, ph: i * 0.45 }; wp(x, c.y, z, { nodive: true }); }
    const [ex, ez] = tp(c, 0, 2.4 + n * 3.9); c.x = ex; c.z = ez;
  }
  function pFans(c, n, up, col) {
    const f = fwd(c.yaw);
    for (let i = 0; i < n; i++) { const [x, z] = tp(c, (i % 2 ? 1 : -1) * 1.2, 6 + i * 10); fan(x, z, c.y - 9, c.y + 9.5, 3.9, PAL[(i + 1) % PAL.length], f); wp(x, c.y + 3, z, { nodive: true }); }
    const [ex, ez] = tp(c, 0, 6 + (n - 1) * 10 + 8); c.x = ex; c.z = ez; c.y += up; wp(c.x, c.y, c.z);
  }
  function pElev(c, H) {
    const [ex, ez] = tp(c, 0, 3.4), yb = c.y;
    addBox(ex, yb, ez, 6, 0.8, 6, '#ffe14a', { ry: c.yaw, noUnder: true, move: t => ({ x: ex, y: yb + H * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 6)), z: ez }) });
    [-1, 1].forEach(sd => { const [px, pz] = tp(c, sd * 3.6, 3.4); addDeco(BOXG, '#ffffff', px, yb + H / 2 + 1, pz, 0.5, H + 3, 0.5); });
    wp(ex, yb, ez, { wait: true }); wp(ex, yb + H, ez, { wait: true });
    const [nx, nz] = tp(c, 0, 6.6); c.x = nx; c.z = nz; c.y += H;
  }
  // tapis roulant dans le sens du cap (v > 0 : pousse vers l'avant ; lat : pousse sur le côté)
  function pBelt(c, L, w, v, lat) {
    const [x, z] = tp(c, 0, L / 2), f = fwd(c.yaw), r = rgt(c.yaw), vx = lat ? r[0] * lat : f[0] * v, vz = lat ? r[1] * lat : f[1] * v;
    const s = addBox(x, c.y, z, w, 1.2, L, '#4b4a63', { col2: '#5d5c7a', ry: c.yaw }); s.conv = [vx, vz];
    const t = texs().pad.clone(); t.needsUpdate = true; const along = lat ? w : L, across = lat ? L : w;
    t.repeat.set(Math.max(1, Math.round(across / 2.4)), Math.max(1, Math.round(along / 1.7)));
    const pm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85 }); S.disp.push(pm, t);
    const geo = own(new THREE.PlaneGeometry(across * 0.9, along * 0.96)); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.atan2(vx, vz));
    const pl = new THREE.Mesh(geo, pm); pl.position.set(x, c.y + 0.04, z); pl.renderOrder = 2; S.scene.add(pl);
    S.scroll.push({ t, k: Math.hypot(vx, vz) / (along / t.repeat.y) });
    for (let k = 1; k <= Math.ceil(L / 6); k++) { const [px, pz] = tp(c, 0, Math.min(L, k * 6)); wp(px, c.y, pz); }
    const [ex, ez] = tp(c, 0, L); c.x = ex; c.z = ez;
  }
  // plateau tournant avec deux barres (rouge à sauter, jaune à ne pas sauter)
  function pDisc(c, R, col) {
    const [cx, cz] = tp(c, 0, R + 0.5);
    addDisc(cx, cz, c.y, R, 3, col, 0.45, 6); addPillar(cx, cz, c.y, c.y + 3.4, 1.0, '#ffffff');
    addSweep(cx, cz, c.y + 0.05, 0.75, R - 0.3, 0.45, 1.4, '#ff3b3b', 0, 0);
    addSweep(cx, cz, c.y + 2.15, 0.6, R - 0.3, 0.4, -0.6, '#ffe14a', 1.6, 0);
    { const [x, z] = tp(c, R * 0.55, R * 0.5); wp(x, c.y, z); } { const [x, z] = tp(c, R * 0.6, R + 0.5); wp(x, c.y, z); } { const [x, z] = tp(c, R * 0.55, R * 1.5); wp(x, c.y, z); }
    const [ex, ez] = tp(c, 0, 2 * R + 1); c.x = ex; c.z = ez; wp(c.x, c.y, c.z);
  }
  function pZip(c, L, drop) {
    const [ax, az] = tp(c, 0, 1.5), [bx, bz] = tp(c, 0, L + 1.5); zipline(ax, c.y + 3.1, az, bx, c.y - drop + 3.1 + 2.6, bz);
    const [nx, nz] = tp(c, 0, L - 0.5); c.x = nx; c.z = nz; c.y -= drop;
  }
  function pSpiral(c, turns, R, dy, w, cols, deco, tall) {   // spirale (turns > 0 : vers la droite) autour d'une colonne décorée
    const sg = Math.sign(turns), [tcx, tcz] = tp(c, sg * R, 0), y0 = c.y;
    pArc(c, turns * Math.PI * 2, R, w, cols[0], dy, { rail: -sg, alt: cols[1], seg: 1.9, both: !!tall, railH: tall ? 2.7 : 1.1 });
    const ylo = Math.min(y0, y0 + dy), yhi = Math.max(y0, y0 + dy);
    addPillar(tcx, tcz, ylo - 8, yhi + 3, R - w / 2 - 0.7, deco || '#e8e0f5');
    return [tcx, tcz, ylo, yhi];
  }

  /* ---------- 1. LA CITÉ DES TOITS ---------- */
  function buildRooftops(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 160, 560); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, roof = ['#c65f4a', '#e0794f', '#b84a5e', '#8a5cff'];
    const bldg = (cc, L, w) => { const [x, z] = tp(cc, 0, -L / 2); addDeco(BOXG, shade(roof[Math.floor(r() * roof.length)], 0.7), x, cc.y - 22, z, w, 40, L).rotation.y = cc.yaw; };
    startPlaza(c);
    cpAt(c); pArc(c, -Math.PI / 2, 16, 9, '#e0794f', 0, { alt: '#f0905f' }); padAt(c, -6, 7, 5);
    for (let i = 0; i < 3; i++) { gap(c, 4.5 + i * 0.8, i === 1 ? 1 : -0.5); pStraight(c, 9, 10, roof[i % 4]); bldg(c, 9, 10); }
    cpAt(c); pWallRun(c, 16, '#ffe14a'); pStraight(c, 10, 12, '#c65f4a'); bldg(c, 10, 12);
    cpAt(c); pStraight(c, 8, 12, '#b84a5e'); bldg(c, 8, 12); pTramp(c, 6); pStraight(c, 20, 12, '#e0794f'); bldg(c, 20, 12);
    pArc(c, Math.PI / 2, 14, 8, '#8a5cff', 0); pStraight(c, 6, 9, '#8a5cff'); bldg(c, 6, 9);
    cpAt(c, c.y - 12); pZip(c, 40, 9); pStraight(c, 12, 12, '#c65f4a'); bldg(c, 12, 12);
    cpAt(c); crumbleBridge(c, 14, 3.2, '#a86b35'); pStraight(c, 10, 12, '#e0794f'); bldg(c, 10, 12);
    cpAt(c); pCannons(c, 14, 4); pStraight(c, 14, 14, '#b84a5e'); bldg(c, 14, 14);
    cpAt(c, c.y - 14); pArc(c, -Math.PI / 3, 18, 10, '#8a5cff', 0); padAt(c, -3.5, 8, 5); pRamp(c, 30, -8, 11, '#3fd0ff', { walls: '#ffe14a' }); gap(c, 9, -1.5);
    finishArena(c, '#ff8a3d');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.55) { const h = 20 + rr() * 30, w = 6 + rr() * 8; addDeco(BOXG, shade(roof[Math.floor(rr() * 4)], 0.65 + rr() * 0.2), x, y - 30 + h / 2, z, w, h, w); } });
  }
  /* ---------- 2. LE TEMPLE PERDU ---------- */
  function buildTemple(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 140, 520); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, st = ['#9aa36a', '#b5b07a', '#7e8a5a'];
    startPlaza(c);
    cpAt(c); pStraight(c, 12, 12, st[0]); { const [x, z] = tp(c, -3, -6); addBumper(x, z, c.y, 1.4, '#47d16c'); const [x2, z2] = tp(c, 3, -3); addBumper(x2, z2, c.y, 1.4, '#ff6fb0'); }
    pArc(c, Math.PI / 2, 15, 10, st[1], 0, { alt: st[0] });
    cpAt(c, c.y - 18);
    { const [tx, tz, ylo, yhi] = pSpiral(c, -1, 9, -12, 4.6, [st[1], st[0]], '#c9c29a', true);   // descente en spirale autour de la statue
      const head = mesh(own(new THREE.SphereGeometry(4.6, 14, 10)), mat('#d8cf9f')); head.position.set(tx, yhi + 6.5, tz); head.scale.set(1, 1.15, 1); S.scene.add(head);
      [-1, 1].forEach(sd => addDeco(BOXG, '#47d16c', tx + sd * 1.6, yhi + 7.5, tz + 3.9, 1.1, 1.1, 0.3, false)); }
    pStraight(c, 8, 10, st[2]);
    cpAt(c); pHammers(c, 42, 3, [st[0], '#ff6fb0', '#ffb13d', '#3fd0ff']);
    cpAt(c, c.y - 16); pBlink(c, 6, ['#47d16c', '#9aa36a', '#2fae7a']); pStraight(c, 8, 12, st[1]);
    cpAt(c, c.y - 16); pFans(c, 3, 3); pStraight(c, 10, 14, st[0]);
    cpAt(c);
    { pStraight(c, 30, 14, st[2]); const base = { x: c.x, z: c.z, y: c.y, yaw: c.yaw }, f = fwd(c.yaw);
      for (let i = 0; i < 8; i++) { const [x, z] = tp(base, ((i % 3) - 1) * 4, -27 + i * 3.4); geyser(x, z, c.y, 2.2, 0.8, -i * 0.25, f); }
      [-4, 0, 4].forEach((lx, k) => { const [x, z] = tp(base, lx, -1.2); geyser(x, z, c.y, 1.8, 0.8, k * 0.6, f); });
      const [bx, bz] = tp(c, 0, 5); addBox(bx, c.y + 6, bz, 14, 8, 10, st[1], { ry: c.yaw }); wp(bx, c.y + 6, bz); const [ex, ez] = tp(c, 0, 10); c.x = ex; c.z = ez; c.y += 6; }
    cpAt(c, c.y - 14); padAt(c, -2.5, 8, 4); pRamp(c, 34, -10, 11, '#2fae7a', { walls: '#ffe14a' }); gap(c, 9, -1.5);
    finishArena(c, '#2fae7a');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.6) { const h = 6 + rr() * 10; addDeco(own(new THREE.CylinderGeometry(0.6, 0.9, h, 7)), '#7a5a3a', x, y - 8 + h / 2, z, 1, 1, 1); const cr = mesh(own(new THREE.IcosahedronGeometry(2.4 + rr() * 2, 0)), mat(rr() < 0.5 ? '#2fae7a' : '#47d16c'), false); cr.position.set(x, y - 8 + h + 1.5, z); cr.scale.set(1.3, 0.9, 1.3); S.scene.add(cr); } });
  }
  /* ---------- 3. LA FABRIQUE DE BONBONS ---------- */
  function buildCandy(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 160, 560); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, cand = ['#ff6fb0', '#ffb3d9', '#7fd6ff', '#ffe14a', '#b38cff'];
    startPlaza(c);
    cpAt(c); pBelt(c, 24, 8, 11); pArc(c, Math.PI / 2, 14, 9, cand[1], 0, { alt: cand[0] });
    cpAt(c, c.y - 16); pBelt(c, 12, 12, 0, 7); pBelt(c, 12, 12, 0, -7); pStraight(c, 6, 12, cand[2]);
    cpAt(c, c.y - 16); pDisc(c, 13, cand[4]); pStraight(c, 6, 12, cand[3]);
    cpAt(c, c.y - 16); pElev(c, 10); pStraight(c, 10, 12, cand[0]);
    pTramp(c, 6); pStraight(c, 20, 14, cand[2]); pTramp(c, 6); pStraight(c, 12, 14, cand[1]);
    cpAt(c, c.y - 12); pArc(c, -Math.PI / 2, 15, 9, cand[4], 0); pStraight(c, 6, 9, cand[4]); pZip(c, 42, 9); pStraight(c, 12, 12, cand[0]);
    cpAt(c, c.y - 16); pBlink(c, 5, cand); pStraight(c, 8, 12, cand[3]);
    cpAt(c, c.y - 20); pArc(c, -Math.PI / 2, 16, 10, cand[2], -5, { alt: cand[1] }); padAt(c, -2.5, 8, 4); pRamp(c, 28, -8, 11, '#ff6fb0', { walls: '#ffe14a' }); gap(c, 9, -1.5);
    finishArena(c, '#ff4f9e');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.5) { const h = 10 + rr() * 16; addDeco(own(new THREE.CylinderGeometry(0.35, 0.35, h, 8)), '#ffffff', x, y - 20 + h / 2, z, 1, 1, 1); const top = mesh(own(new THREE.SphereGeometry(2.6 + rr() * 1.6, 16, 12)), mat(cand[Math.floor(rr() * cand.length)], { roughness: 0.3 }), false); top.position.set(x, y - 20 + h + 1.6, z); S.scene.add(top); } else if (rr() < 0.5) { const d = mesh(own(new THREE.TorusGeometry(3 + rr() * 2, 1.2, 10, 24)), mat(cand[Math.floor(rr() * cand.length)], { roughness: 0.35 }), false); d.position.set(x, y - 6 + rr() * 16, z); d.rotation.set(rr() * 3, rr() * 3, 0); S.scene.add(d); S.anim.push(t => { d.rotation.y += 0.004; }); } });
  }
  /* ---------- 4. LES MONTAGNES RUSSES ---------- */
  function buildCoaster(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 160, 600); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, rail = ['#5b6cff', '#ff4f9e', '#ffe14a', '#3fd0ff'];
    startPlaza(c);
    cpAt(c, c.y - 26); pRamp(c, 28, -9, 11, rail[0], { walls: rail[2] }); pArc(c, Math.PI / 2, 14, 11, rail[3], -3, { rail: -1 }); pRamp(c, 22, -7, 11, rail[0], { walls: rail[1] }); gap(c, 9, -1.5); pStraight(c, 10, 14, rail[2]);
    cpAt(c); pCannons(c, 14, 4); pStraight(c, 14, 14, rail[1]);
    cpAt(c); pTramp(c, 6); pStraight(c, 20, 12, rail[3]); pArc(c, -Math.PI / 2, 16, 10, rail[0], 0); padAt(c, -5, 8, 5);
    cpAt(c, c.y - 12); pZip(c, 44, 9); pStraight(c, 12, 12, rail[2]);
    cpAt(c); pWallRun(c, 16, rail[1]); pStraight(c, 10, 12, rail[0]);
    cpAt(c, c.y - 30); padAt(c, -3, 8, 4); pRamp(c, 36, -11, 11, rail[3], { walls: rail[2] }); pArc(c, Math.PI / 2, 14, 11, rail[1], -4, { rail: -1 }); pRamp(c, 18, -5, 11, rail[0], { walls: rail[2] }); gap(c, 9, -1.5);
    finishArena(c, '#5b6cff');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.4) { const h = 14 + rr() * 20; addDeco(BOXG, '#ffffff', x, y - 20 + h / 2, z, 0.5, h, 0.5); addDeco(BOXG, '#ffffff', x + 3, y - 20 + h / 2, z, 0.5, h, 0.5); for (let k = 0; k < h; k += 3) addDeco(BOXG, rail[k % 4], x + 1.5, y - 20 + k, z, 3, 0.25, 0.25); } });
  }

  /* ---------- 5. LA STATION DE SKI ---------- */
  function buildSki(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 160, 560); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, sn = ['#e8f6ff', '#cfe9ff', '#7cc4ff', '#ff6f6f'];
    startPlaza(c);
    cpAt(c); pStraight(c, 6, 12, sn[2]); pElev(c, 10); pStraight(c, 8, 12, sn[1]);
    cpAt(c, c.y - 24); padAt(c, -3, 8, 4); pRamp(c, 30, -8, 11, sn[0], { ice: true, walls: sn[3] }); pArc(c, Math.PI / 2, 16, 11, sn[1], -3); pRamp(c, 26, -6, 11, sn[0], { ice: true, walls: sn[3] });
    pRamp(c, 5, 1.6, 10, sn[3]); gap(c, 12, -3); pStraight(c, 14, 14, sn[1]);   // tremplin de saut à ski
    cpAt(c); pTramp(c, 6); pStraight(c, 20, 12, sn[0]);
    cpAt(c, c.y - 12); pArc(c, -Math.PI / 2, 14, 9, sn[2], 0); pStraight(c, 6, 9, sn[2]); pZip(c, 40, 9); pStraight(c, 12, 12, sn[1]);
    cpAt(c, c.y - 16); pBlink(c, 5, ['#bfe6ff', '#e8f6ff', '#9fd9ff']); pStraight(c, 8, 12, sn[0]);
    cpAt(c, c.y - 24); pArc(c, -Math.PI / 2, 16, 11, sn[1], -4); padAt(c, -3, 8, 4); pRamp(c, 34, -10, 11, sn[0], { ice: true, walls: sn[3] }); gap(c, 9, -1.5);
    finishArena(c, '#3a8dff');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.7) { const h = 3 + rr() * 4; for (let k = 0; k < 3; k++) { const cn = mesh(S.pine || (S.pine = own(new THREE.ConeGeometry(1, 1.4, 7))), mat(k === 2 ? '#ffffff' : '#2f8a5a'), false); cn.position.set(x, y - 12 + h * (0.4 + k * 0.32), z); cn.scale.setScalar(h * (0.9 - k * 0.22)); S.scene.add(cn); } } });
  }
  /* ---------- 6. LE VOLCAN ---------- */
  function buildVolcano(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 140, 520); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, rk = ['#6b4a3f', '#8a5a48', '#4f3630', '#ff6a2a'];
    startPlaza(c);
    cpAt(c); pStraight(c, 10, 12, rk[1]); pArc(c, -Math.PI / 2, 15, 10, rk[0], 0, { alt: rk[1] });
    cpAt(c, c.y - 16); crumbleBridge(c, 16, 3.2, '#3a2622'); pStraight(c, 8, 12, rk[2]);
    cpAt(c); pHammers(c, 40, 3, [rk[1], '#ff6a2a', '#ffb13d', '#ff3b3b']);
    cpAt(c, c.y - 16); pFans(c, 3, 3); pStraight(c, 10, 14, rk[0]);
    cpAt(c);
    { const [tx, tz, ylo, yhi] = pSpiral(c, 1, 9, 12, 4.6, [rk[1], rk[0]], '#5a3a32');   // on grimpe autour du cratère
      const cone = mesh(own(new THREE.CylinderGeometry(3.5, 6.2, 6, 14, 1, true)), mat('#4f3630')); cone.position.set(tx, yhi + 6, tz); S.scene.add(cone);
      const lava = mesh(own(new THREE.CircleGeometry(3.4, 18)), mat('#ff6a2a', { emissive: '#ff4a10', emissiveIntensity: 1.2 }), false); lava.rotation.x = -Math.PI / 2; lava.position.set(tx, yhi + 8.6, tz); S.scene.add(lava);
      S.anim.push(t => { if (Math.random() < 0.5) emit(tx + (Math.random() - 0.5) * 4, yhi + 9, tz + (Math.random() - 0.5) * 4, 1, { cols: ['#ff8a3d', '#ffcf2e', '#5a4a48'], spd: 1.5, up: 7, life: 2.2, grav: -1 }); }); }
    pStraight(c, 7, 7, rk[2]);
    cpAt(c, c.y - 12); pZip(c, 42, 9); pStraight(c, 12, 12, rk[1]);
    cpAt(c, c.y - 16); pBlink(c, 6, ['#ff6a2a', '#6b4a3f', '#ffb13d']); pStraight(c, 10, 14, rk[0]);
    cpAt(c, c.y - 14); padAt(c, -2.5, 8, 4); pRamp(c, 34, -10, 11, '#ff8a3d', { walls: '#ffcf2e' }); gap(c, 9, -1.5);
    finishArena(c, '#ff4a10');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.55) { const s = 2 + rr() * 5, rock = mesh(own(new THREE.DodecahedronGeometry(s, 0)), mat(rr() < 0.5 ? '#4f3630' : '#6b4a3f'), false); rock.position.set(x, y - 10 + rr() * 20, z); rock.rotation.set(rr() * 3, rr() * 3, 0); S.scene.add(rock); } });
  }
  /* ---------- 7. LA BASE SPATIALE ---------- */
  function buildSpace(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 180, 620); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, sp = ['#7a6cff', '#3fd0ff', '#c8c4ff', '#ff6fb0'];
    startPlaza(c);
    cpAt(c); pBelt(c, 22, 8, 12); pArc(c, Math.PI / 2, 14, 9, sp[2], 0, { alt: sp[0] });
    cpAt(c); pStraight(c, 6, 10, sp[1]); pWallRun(c, 16, sp[3]); pStraight(c, 10, 12, sp[0]);
    cpAt(c, c.y - 16); pDisc(c, 13, sp[0]); pStraight(c, 6, 12, sp[2]);
    cpAt(c); pCannons(c, 14, 4); pStraight(c, 14, 14, sp[1]);
    cpAt(c, c.y - 16); pElev(c, 10); pStraight(c, 10, 12, sp[0]); pTramp(c, 6); pStraight(c, 20, 12, sp[3]);
    cpAt(c, c.y - 12); pArc(c, -Math.PI / 2, 15, 9, sp[2], 0); pStraight(c, 6, 9, sp[2]); pZip(c, 42, 9); pStraight(c, 12, 12, sp[1]);
    cpAt(c, c.y - 16); pBlink(c, 5, sp); pStraight(c, 8, 12, sp[0]);
    cpAt(c, c.y - 24); pArc(c, Math.PI / 2, 16, 11, sp[1], -4); padAt(c, -3, 8, 4); pRamp(c, 30, -9, 11, '#3fd0ff', { walls: '#ff6fb0' }); gap(c, 9, -1.5);
    finishArena(c, '#7a6cff');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.18) { const s = 4 + rr() * 9, pl = mesh(own(new THREE.SphereGeometry(s, 20, 14)), mat(sp[Math.floor(rr() * 4)], { roughness: 0.6 }), false); pl.position.set(x, y + 10 + rr() * 30, z); S.scene.add(pl); if (rr() < 0.6) { const ring = mesh(own(new THREE.TorusGeometry(s * 1.6, s * 0.12, 6, 40)), mat('#ffe9a8'), false); ring.position.copy(pl.position); ring.rotation.set(1.2 + rr() * 0.4, rr(), 0); S.scene.add(ring); } } });
    const st = new THREE.BufferGeometry(), pts = []; for (let i = 0; i < 600; i++) { const a = r() * Math.PI * 2, e = r() * 1.2, d = 300; pts.push(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d); }
    st.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const sm = new THREE.PointsMaterial({ size: 2.2, color: 0xffffff, fog: false, sizeAttenuation: false }); S.disp.push(st, sm); S.skyM.add(new THREE.Points(st, sm));
  }

  /* ---------- 8. LA JUNGLE ---------- */
  function buildJungle(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 150, 540); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, g = ['#47d16c', '#2fa55a', '#8bd84a', '#a8743f'];
    startPlaza(c);
    cpAt(c); pStraight(c, 8, 12, g[0]); pArc(c, -Math.PI / 3, 16, 10, g[1], 2, { alt: g[2] });
    cpAt(c); pStraight(c, 5, 10, g[2]); pWallRun(c, 18, '#3a8a3a'); pStraight(c, 8, 12, g[0]);
    cpAt(c, c.y - 16); crumbleBridge(c, 18, 3.4, g[3]); pStraight(c, 8, 12, g[1]);
    cpAt(c); pHammers(c, 40, 3, [g[3], '#6b4a2f', '#8a5a33', '#c98a4a']);
    cpAt(c); pArc(c, Math.PI / 2, 15, 10, g[0], 0, { alt: g[2] }); pStraight(c, 6, 9, g[2]); pZip(c, 44, 10); pStraight(c, 12, 12, g[1]);
    cpAt(c, c.y - 16); pFans(c, 3, 4, '#c8efff'); pStraight(c, 10, 14, g[0]);
    cpAt(c, c.y - 14); pTramp(c, 7); pStraight(c, 16, 12, g[2]);
    cpAt(c, c.y - 20); pArc(c, -Math.PI / 6, 16, 11, g[1], -3); padAt(c, -3, 8, 4); pRamp(c, 32, -10, 11, '#3fd0ff', { ice: true, walls: g[3] }); gap(c, 9, -1.5);
    finishArena(c, '#2fa55a');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.6) { const h = 8 + rr() * 10, tr = mesh(S.trunk || (S.trunk = own(new THREE.CylinderGeometry(0.5, 0.8, 1, 8))), mat('#8a5a33'), false); tr.scale.set(1, h, 1); tr.position.set(x, y - 14 + h / 2, z); S.scene.add(tr);
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, lf = mesh(S.leaf || (S.leaf = own(new THREE.SphereGeometry(1, 8, 6))), mat(k % 2 ? '#2fa55a' : '#47d16c'), false); lf.scale.set(2.6, 0.5, 1.2); lf.position.set(x + Math.cos(a) * 1.8, y - 14 + h, z + Math.sin(a) * 1.8); lf.rotation.y = -a; S.scene.add(lf); } } });
  }
  /* ---------- 9. LE CHÂTEAU ---------- */
  function buildCastle(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 150, 540); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, st = ['#b9b3d6', '#9a93c4', '#7a6cff', '#ffcf4a'];
    startPlaza(c);
    cpAt(c); pStraight(c, 10, 12, st[0]); pDisc(c, 12, st[2]); pStraight(c, 6, 12, st[1]);
    cpAt(c, c.y - 16);
    { const [tx, tz, , yhi] = pSpiral(c, 1, 9, 14, 4.6, [st[0], st[1]], '#d9d3f0', true);   // le donjon : on grimpe en spirale
      const roof = mesh(own(new THREE.ConeGeometry(7.6, 8, 12)), mat('#7a6cff')); roof.position.set(tx, yhi + 7, tz); S.scene.add(roof);
      const fl = mesh(BOXG, mat('#ff4f9e'), false); fl.scale.set(0.12, 1.2, 1.8); fl.position.set(tx, yhi + 11.7, tz + 0.9); S.scene.add(fl); }
    pStraight(c, 7, 8, st[1]);
    cpAt(c, c.y - 14); pBlink(c, 6, ['#c8c4ff', '#7a6cff', '#ffffff']); pStraight(c, 10, 12, st[0]);
    cpAt(c, c.y - 16); pHammers(c, 38, 3, [st[1], '#ffcf4a', '#ff4f9e', '#7a6cff']);
    cpAt(c); pArc(c, -Math.PI / 2, 15, 10, st[0], 0, { alt: st[1] }); pCannons(c, 15, 0); pStraight(c, 14, 14, st[0]);
    cpAt(c, c.y - 18); pStraight(c, 6, 9, st[1]); pZip(c, 40, 12); pStraight(c, 10, 12, st[0]);
    cpAt(c, c.y - 20); padAt(c, -3, 8, 4); pRamp(c, 30, -9, 11, '#7a6cff', { walls: '#ffcf4a' }); gap(c, 9, -1.5);
    finishArena(c, '#7a6cff');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.35) { const h = 10 + rr() * 14, tw = mesh(S.tower || (S.tower = own(new THREE.CylinderGeometry(2.2, 2.6, 1, 10))), mat('#b9b3d6'), false); tw.scale.set(1, h, 1); tw.position.set(x, y - 12 + h / 2, z); S.scene.add(tw);
      const rf = mesh(S.troof || (S.troof = own(new THREE.ConeGeometry(2.9, 4, 10))), mat(rr() < 0.5 ? '#7a6cff' : '#ff4f9e'), false); rf.position.set(x, y - 12 + h + 2, z); S.scene.add(rf); } });
  }
  /* ---------- 10. LA PLAGE ---------- */
  function buildBeach(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 160, 560); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, sb = ['#ffe3a0', '#ffd27a', '#3fd0ff', '#ff6f6f'];
    startPlaza(c);
    cpAt(c); pStraight(c, 8, 12, sb[0]); pBelt(c, 26, 10, 0, 5); pStraight(c, 6, 12, sb[1]);   // les vagues poussent sur le côté
    cpAt(c); pArc(c, Math.PI / 2, 15, 10, sb[0], 0, { alt: sb[1] }); pTramp(c, 6); pStraight(c, 16, 12, sb[0]);
    cpAt(c, c.y - 14); pCannons(c, 16, 2); pStraight(c, 14, 14, sb[1]);
    cpAt(c, c.y - 16); padAt(c, -3, 8, 4); pRamp(c, 30, -8, 11, '#3fd0ff', { ice: true, walls: sb[3] }); pStraight(c, 8, 12, sb[0]);   // toboggan aquatique
    cpAt(c, c.y - 14); pBelt(c, 22, 10, 0, -5); pArc(c, -Math.PI / 2, 15, 10, sb[1], 0, { alt: sb[0] });
    cpAt(c); pElev(c, 10); pStraight(c, 8, 12, sb[0]); pZip(c, 40, 9); pStraight(c, 10, 12, sb[1]);
    cpAt(c, c.y - 16); pBlink(c, 5, ['#3fd0ff', '#ffe3a0', '#ff6f6f']); pStraight(c, 8, 12, sb[0]);
    cpAt(c, c.y - 14); padAt(c, -3, 8, 4); pRamp(c, 26, -7, 11, '#ffb13d', { walls: '#3fd0ff' }); gap(c, 9, -1.5);
    finishArena(c, '#ff6f6f');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.5) { const pole = mesh(S.pole || (S.pole = own(new THREE.CylinderGeometry(0.15, 0.15, 6, 6))), mat('#ffffff'), false); pole.position.set(x, y - 8, z); S.scene.add(pole);
      const um = mesh(S.umb || (S.umb = own(new THREE.ConeGeometry(3, 1.4, 10))), mat(['#ff6f6f', '#3fd0ff', '#ffe14a', '#47d16c'][Math.floor(rr() * 4)]), false); um.position.set(x, y - 4.6, z); S.scene.add(um); } });
  }
  /* ---------- 11. LA CITÉ NÉON ---------- */
  function buildNeon(r, MP) {
    sky(MP.sky[0], MP.sky[1]); lights(); S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 170, 600); S.pathMode = true; S.secAt = [];
    const c = { x: 0, y: 0, z: -2, yaw: 0 }, ne = ['#3a2a6a', '#4b3a8a', '#ff4fd8', '#3fffe0'];
    startPlaza(c);
    cpAt(c); pBelt(c, 22, 10, 9); pArc(c, -Math.PI / 2, 14, 9, ne[1], 0, { alt: ne[0] });
    cpAt(c); pStraight(c, 6, 10, ne[0]); pWallRun(c, 16, ne[2]); pStraight(c, 6, 10, ne[1]); pWallRun(c, 16, ne[3]); pStraight(c, 10, 12, ne[0]);
    cpAt(c, c.y - 16); pDisc(c, 13, ne[1]); pStraight(c, 6, 12, ne[0]);
    cpAt(c); pElev(c, 12); pStraight(c, 8, 12, ne[1]); pBlink(c, 5, [ne[2], ne[3], '#ffe14a']); pStraight(c, 8, 12, ne[0]);
    cpAt(c, c.y - 16); pArc(c, Math.PI / 2, 15, 9, ne[1], 0, { alt: ne[0] }); pFans(c, 2, 3, '#ff4fd8'); pStraight(c, 10, 12, ne[0]);
    cpAt(c, c.y - 16);
    pSpiral(c, -1, 9, -14, 4.6, [ne[1], ne[0]], '#ff4fd8', true);   // descente en spirale (bords hauts : pas de raccourci)
    pStraight(c, 8, 10, ne[0]);
    cpAt(c, c.y - 14); pCannons(c, 15, 0); pStraight(c, 12, 14, ne[1]);
    cpAt(c, c.y - 16); padAt(c, -3, 8, 4); pRamp(c, 30, -9, 11, '#ff4fd8', { walls: '#3fffe0' }); gap(c, 9, -1.5);
    finishArena(c, '#ff4fd8');
    decorAround(r, MP, (x, y, z, rr) => { if (rr() < 0.45) { const h = 12 + rr() * 26, bd = mesh(BOXG, mat('#241a48'), false); bd.scale.set(5, h, 5); bd.position.set(x, y - 14 + h / 2, z); S.scene.add(bd);
      const col = rr() < 0.5 ? '#ff4fd8' : '#3fffe0', st = mesh(BOXG, mat(col, { emissive: col, emissiveIntensity: 1.2 }), false); st.scale.set(5.1, 0.35, 5.1); st.position.set(x, y - 14 + h * (0.4 + rr() * 0.5), z); S.scene.add(st); } });
  }
  // distance parcourue le long du tracé (classement, bots)
  function pathProg(x, y, z) {
    const P = S.path; let best = 1e9, d = 0;
    for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], ux = b.x - a.x, uz = b.z - a.z, L2 = ux * ux + uz * uz || 1; const u = clamp(((x - a.x) * ux + (z - a.z) * uz) / L2, 0, 1), px = a.x + ux * u, pz = a.z + uz * u, py = a.y + (b.y - a.y) * u, dd = Math.hypot(x - px, z - pz) + Math.abs(y - py) * 1.6; if (dd < best) { best = dd; d = a.d + (b.d - a.d) * u; } }
    return d;
  }
  function pathAt(d) { const P = S.path; for (let i = 1; i < P.length; i++) if (P[i].d >= d) { const a = P[i - 1], b = P[i], u = (d - a.d) / ((b.d - a.d) || 1); return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u, wait: !!(a.wait || b.wait), nojump: !!(a.nojump || b.nojump), nodive: !!(a.nodive || b.nodive) }; } return P[P.length - 1]; }
  const progOf = p => S.pathMode ? pathProg(p.x, p.y, p.z) : p.z;
  function cloudsSide(r, n, zmax) {
    const geo = own(new THREE.IcosahedronGeometry(1, 1)), m = mat('#ffffff', { roughness: 1, emissive: '#cfe8ff', emissiveIntensity: 0.25 });
    for (let i = 0; i < n; i++) {
      const sd = r() < 0.5 ? -1 : 1, cx = sd * (48 + r() * 130), cz = -60 + r() * (zmax + 120), cy = -45 + r() * 70;
      for (let k = 0; k < 5; k++) { const s = 4 + r() * 6; const p = mesh(geo, m, false); p.position.set(cx + (r() - 0.5) * 14, cy + (r() - 0.5) * 3, cz + (r() - 0.5) * 8); p.scale.set(s * 1.4, s * 0.8, s); S.scene.add(p); }
    }
  }
  function buildCourse(mapIdx) {
    const r = rng(S.seed + 11);
    const mi = mapIdx != null ? mapIdx : ((S.seed % MAPS.length) + MAPS.length) % MAPS.length, MP = S.map = MAPS[mi]; S.mapIdx = mi; try { BR.store.set('br_party_map', mi); } catch (e) {}
    PAL = MP.pal || PAL0;
    if (MP.build) { MP.build(r, MP); return; }
    sky(MP.sky[0], MP.sky[1]); lights();
    S.scene.fog = new THREE.Fog(new THREE.Color(MP.sky[1]).getHex(), 160, 560);
    // départ
    addBox(0, 0, 9, 18, 2.4, 22, '#7a6cff');
    addDeco(BOXG, '#ff4f9e', 0, 7, 19.5, 18, 1.2, 1); [-1, 1].forEach(sd => addDeco(BOXG, '#ffffff', sd * 8.6, 3.5, 19.5, 0.9, 7, 0.9));
    S.checks.push({ z: -99, x: 0, y: 0, zz: 5 });
    // 10 sections tirées au sort parmi 16 (au moins une section de murs), des plus faciles aux plus dures
    let pick = MP.seq ? MP.seq.slice() : null;
    if (!pick) { const ks = BIG.slice(); for (let i = ks.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = ks[i]; ks[i] = ks[j]; ks[j] = t; } pick = ks.slice(0, 6); }
    let c = { z: 20, y: 0 }; S.secAt = [];
    pick.forEach((k, i) => { S.secAt.push({ k, z: c.z, y: c.y }); const n0 = S.checks.length, y0 = c.y; c = SEC[k].f(c, r, PAL[i % PAL.length]); if (S.checks[n0]) S.checks[n0].low = Math.min(y0, c.y); });
    tribune(-11, -1, 20, 0, -1); tribune(11, -1, 20, 0, 1);
    // arrivée
    const zf = c.z, yf = c.y; plat(zf, 26, 20, yf, '#ffe14a'); tribune(-12.5, zf + 2, 22, yf, -1); tribune(12.5, zf + 2, 22, yf, 1);
    S.finishZ = zf + 9; S.finishY = yf;
    const fl = cv(256, 32, g => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); } });
    const fm = new THREE.MeshStandardMaterial({ map: fl }); S.disp.push(fm, fl);
    const fline = mesh(BOXG, fm, false); fline.scale.set(20, 0.05, 1.2); fline.position.set(0, yf + 0.04, S.finishZ); S.scene.add(fline);
    const arch = cv(512, 128, g => { g.fillStyle = '#ff3f9b'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#fff'; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ARRIVÉE', 256, 68); });
    const am = new THREE.MeshStandardMaterial({ map: arch, emissive: '#ffffff', emissiveMap: arch, emissiveIntensity: 0.25 }); S.disp.push(am, arch);
    const ab = mesh(BOXG, am); ab.scale.set(20, 3, 0.8); ab.position.set(0, yf + 8, S.finishZ); S.scene.add(ab);
    [-1, 1].forEach(sd => addDeco(BOXG, '#ffffff', sd * 9.6, yf + 4, S.finishZ, 1, 8, 1));
    // décor : nuages et îlots sur les côtés seulement (jamais sur le parcours)
    let ymin = 0; S.secAt.forEach(s => { ymin = Math.min(ymin, s.y); }); ymin = Math.min(ymin, yf);
    sea(ymin - 60, MP.sea || '#e2ecff'); cloudsSide(r, 34, zf + 30);
    const bg = own(new THREE.SphereGeometry(0.9, 14, 10)), str = own(new THREE.CylinderGeometry(0.02, 0.02, 3, 4));
    S.secAt.forEach((s, i) => { for (const sd of [-1, 1]) { if (r() < 0.35) continue; const gb = new THREE.Group(); gb.position.set(sd * (11 + r() * 6), s.y + 5 + r() * 5, s.z + 4 + r() * 10);
      for (let k = 0; k < 3 + Math.floor(r() * 3); k++) { const b = mesh(bg, mat(PAL[(i + k) % PAL.length], { roughness: 0.25 }), false); b.position.set((r() - 0.5) * 1.6, k * 0.5 + r() * 0.6, (r() - 0.5) * 1.6); b.scale.set(1, 1.2, 1); gb.add(b); const st = mesh(str, mat('#ffffff'), false); st.position.set(b.position.x * 0.5, b.position.y - 1.9, b.position.z * 0.5); gb.add(st); }
      S.scene.add(gb); S.bob.push({ g: gb, y: gb.position.y, ph: r() * 6 }); } });
    for (let i = 0; i < 34; i++) { const sd = r() < 0.5 ? -1 : 1, x = sd * (30 + r() * 55), z = r() * (zf + 30), y = ymin - 20 + r() * 40, s = 2 + r() * 5; addDeco(own(new THREE.CylinderGeometry(s, s * 0.6, s * 0.8, 7)), PAL[i % PAL.length], x, y, z, 1, 1, 1); }
    S.spawns = []; for (let i = 0; i < 12; i++) S.spawns.push({ x: ((i % 4) - 1.5) * 2.6, y: 0, z: 4 + Math.floor(i / 4) * 2.6 });
    S.fallY = -1e9;
  }
  function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }

  function buildSpinOld() {
    const r = rng(S.seed + 23);
    sky('#ff7fc0', '#ffe1a8'); sea(-26, '#ffe3f0'); clouds(r, 22, -10, 24, z => z); lights();
    S.scene.fog = new THREE.Fog(0xffd9c4, 80, 330);
    S.tiles = [];
    const T = 2.5, RR = 13.2, cols = ['#7a6cff', '#47d16c', '#ffb13d', '#3fd0ff'];
    for (let ix = -6; ix <= 6; ix++) for (let iz = -6; iz <= 6; iz++) {
      const x = ix * T, z = iz * T; if (Math.hypot(x, z) > RR || Math.hypot(x, z) < 1.9) continue;
      const s = addBox(x, 0, z, T - 0.14, 0.7, T - 0.14, cols[(ix + iz + 20) % 4]);
      s.tile = S.tiles.length; s.state = 0; s.t0 = 0; S.tiles.push(s);
    }
    addPillar(0, 0, -6, 2.6, 1.6, '#ffffff');
    // barre basse (à sauter) et barre haute (à laisser passer)
    S.low = addSweep(0, 0, 0.15, 0.7, 13.6, 0.4, 1.0, '#ff3b3b', 0, 0.012);
    S.high = addSweep(0, 0, 2.15, 0.6, 13.6, 0.4, -0.75, '#ffe14a', Math.PI / 2, 0.012);
    S.high.g.visible = false; S.high.off = true; S.low.kb = S.high.kb = 0.62;
    const ring = mesh(own(new THREE.TorusGeometry(RR + 1.6, 0.5, 8, 64)), mat('#ffffff'), false); ring.rotation.x = Math.PI / 2; ring.position.y = -2.2; S.scene.add(ring);
    S.spawns = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; S.spawns.push({ x: Math.cos(a) * 8.2, y: 0, z: Math.sin(a) * 8.2 }); }
    S.fallY = -9;
  }

  /* ===================== manche 2 : finales ===================== */
  function buildSpin(kind) {
    if (kind === 'couronne') return buildCrown();
    if (kind === 'peinture') return buildPaint();
    if (kind === 'bombe') return buildBomb();
    if (kind === 'colline') return buildHill();
    if (kind === 'foot') return buildFoot();
    const r = rng(S.seed + 23);
    const sk = { toupie: ['#ff7fc0', '#ffe1a8', '#ffe3f0'], etages: ['#5a6cff', '#d6dcff', '#e8ebff'], ile: ['#ff9a3d', '#ffe6b0', '#fff0dc'] }[kind] || ['#ff7fc0', '#ffe1a8', '#ffe3f0'];
    sky(sk[0], sk[1]); sea(kind === 'etages' ? -40 : -26, sk[2]); clouds(r, 22, -10, 24, z => z); lights();
    S.scene.fog = new THREE.Fog(new THREE.Color(sk[1]).getHex(), 80, 330);
    S.tiles = []; S.touchCrumble = kind !== 'ile';
    const T = 2.5;
    const layer = (y, RR, cols, hole) => {
      for (let ix = -7; ix <= 7; ix++) for (let iz = -7; iz <= 7; iz++) {
        const x = ix * T, z = iz * T, d = Math.hypot(x, z); if (d > RR || d < hole) continue;
        const s = addBox(x, y, z, T - 0.14, 0.7, T - 0.14, cols[(ix + iz + 20) % cols.length], { noUnder: true });
        s.tile = S.tiles.length; s.state = 0; s.t0 = 0; s.dist = d; S.tiles.push(s);
      }
    };
    if (kind === 'etages') {
      layer(0, 14.6, ['#ff6fb0', '#ffb13d'], 0); layer(-9, 14.6, ['#3fd0ff', '#7a6cff'], 0); layer(-18, 14.6, ['#47d16c', '#ffe14a'], 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; addDeco(own(new THREE.CylinderGeometry(0.9, 0.9, 34, 12)), '#ffffff', Math.cos(a) * 18, -14, Math.sin(a) * 18, 1, 1, 1); }
      S.fallY = -27;
    } else if (kind === 'ile') {
      layer(0, 15.2, ['#47d16c', '#ffb13d', '#3fd0ff', '#ff6fb0'], 1.9);
      S.tiles.forEach(s => { s.fallAt = 4 + (15.2 - s.dist) * 3.6; });
      S.low = addSweep(0, 0, 0.15, 0.7, 15.6, 0.4, 0.8, '#ff3b3b', 0, 0.01); S.low.kb = 0.6; S.low.off = true; S.low.g.visible = false;
      addPillar(0, 0, -6, 2.4, 1.6, '#ffffff');
      S.fallY = -9;
    } else {
      layer(0, 13.2, ['#7a6cff', '#47d16c', '#ffb13d', '#3fd0ff'], 1.9);
      addPillar(0, 0, -6, 2.6, 1.6, '#ffffff');
      S.low = addSweep(0, 0, 0.15, 0.7, 13.6, 0.4, 1.0, '#ff3b3b', 0, 0.012);
      S.high = addSweep(0, 0, 2.15, 0.6, 13.6, 0.4, -0.75, '#ffe14a', Math.PI / 2, 0.012);
      S.high.g.visible = false; S.high.off = true; S.low.kb = S.high.kb = 0.62;
      // les dalles tombent une à une, dans un ordre tiré au sort (le même pour tout le monde)
      S.touchCrumble = false; { const rr = rng(S.seed + 5), ids = S.tiles.map((t, i) => i); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; } ids.forEach((id, k) => { S.tiles[id].fallAt = 6 + k * 0.8; }); }
      S.fallY = -9;
    }
    const RR = kind === 'ile' ? 15.2 : 13.2;
    const ring = mesh(own(new THREE.TorusGeometry(RR + 1.6, 0.5, 8, 64)), mat('#ffffff'), false); ring.rotation.x = Math.PI / 2; ring.position.y = -2.2; S.scene.add(ring);
    const sr = kind === 'ile' ? 9.5 : 8.2;
    S.spawns = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; S.spawns.push({ x: Math.cos(a) * sr, y: 0, z: Math.sin(a) * sr }); }
  }


  /* ===================== manches à score : LA COURONNE et LA GUERRE DES COULEURS ===================== */
  const TEAMS = [{ n: 'BLEUS', c: '#1f5fff', e: '🟦' }, { n: 'ORANGES', c: '#ff5a00', e: '🟧' }];
  const isDive = p => p.st === 'dive' || p.st === ST.dive;
  const isGrab = p => p.grabT > 0 || !!p.holding || !!p.grabVis;
  const inRound = p => p && S.part.includes(p.id) && S.players.has(p.id);
  function packTimes() { const o = {}; for (const id in S.ctime) o[id] = Math.round(S.ctime[id] * 10) / 10; return o; }
  function buildCrown(sk, noCrown) {
    const r = rng(S.seed + 23); sk = sk || ['#ffb13d', '#fff4d0', '#fff6e0'];
    sky(sk[0], sk[1]); sea(-26, sk[2]); clouds(r, 22, -10, 24, z => z); lights();
    S.scene.fog = new THREE.Fog(0xfff0c8, 80, 330);
    const T = 2.5, R = 17, cols = ['#ffb13d', '#ffe14a', '#ff8a3d'];
    for (let ix = -7; ix <= 7; ix++) for (let iz = -7; iz <= 7; iz++) { const x = ix * T, z = iz * T; if (Math.hypot(x, z) > R) continue; addBox(x, 0, z, T - 0.06, 0.7, T - 0.06, cols[(ix + iz + 21) % 3], { noUnder: true }); }
    addPillar(0, 0, -6, 1.1, 2.1, '#ffffff');   // le trône : la couronne y apparaît
    S.low = addSweep(0, 0, 0.15, 0.7, 16.5, 0.4, 0.55, '#ff3b3b', 0, 0.008); S.low.kb = 0.55;
    if (!noCrown) for (const [x, z] of [[10, 0], [-10, 0], [0, 10], [0, -10]]) addBox(x, 0.4, z, 2.6, 0.8, 2.6, '#ff4f9e', { tramp: true, noUnder: true });   // pas de trampolines pour la bombe (on s'envolerait hors de l'arène)
    for (const [x, z] of [[7, 7], [-7, 7], [7, -7], [-7, -7]]) addBox(x, 2.2, z, 2.2, 2.9, 2.2, '#ffffff', { noUnder: true });   // blocs pour se cacher / sauter
    const ring = mesh(own(new THREE.TorusGeometry(R + 1.6, 0.5, 8, 64)), mat('#ffffff'), false); ring.rotation.x = Math.PI / 2; ring.position.y = -2.2; S.scene.add(ring);
    // la couronne
    const g = new THREE.Group(), gold = mat('#ffd23a', { emissive: '#ffb000', emissiveIntensity: 0.45, metalness: 0.4, roughness: 0.35 });
    const band = mesh(own(new THREE.CylinderGeometry(0.55, 0.48, 0.42, 16, 1, true)), gold); g.add(band);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, sp = mesh(own(new THREE.ConeGeometry(0.13, 0.42, 6)), gold); sp.position.set(Math.cos(a) * 0.5, 0.36, Math.sin(a) * 0.5); g.add(sp); const gem = mesh(own(new THREE.SphereGeometry(0.08, 8, 6)), mat(['#ff3b6b', '#3fd0ff', '#47d16c'][i % 3]), false); gem.position.set(Math.cos(a) * 0.53, 0, Math.sin(a) * 0.53); g.add(gem); }
    const glow = mesh(own(new THREE.TorusGeometry(1.1, 0.06, 6, 30)), mat('#fff3a0', { emissive: '#ffe14a', emissiveIntensity: 1 }), false); glow.rotation.x = Math.PI / 2; glow.position.y = -0.6; g.add(glow);
    S.scene.add(g); S.crownY = 1.1; S.crown = { h: null, x: 0, y: S.crownY, z: 0, cd: 0, g, glow }; if (noCrown) { S.scene.remove(g); S.crown = null; }
    S.spawns = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; S.spawns.push({ x: Math.cos(a) * 12.5, y: 0, z: Math.sin(a) * 12.5 }); }
    S.fallY = -9;
  }
  function teamSplit() {
    const ids = S.part.slice().sort(), rr = rng(S.seed + 77);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
    const tm = {}; ids.forEach((id, i) => { tm[id] = i % 2; }); return tm;
  }
  function buildPaint() {
    const r = rng(S.seed + 23);
    sky('#5a4cdf', '#c9c0ff'); sea(-26, '#d9d2ff'); clouds(r, 22, -10, 24, z => z); lights();
    S.scene.fog = new THREE.Fog(0xe6e0ff, 80, 330);
    S.teams = teamSplit(); S.paint = []; S.pq = []; S.pqT = 0; S.pfT = 0;
    const T = 2.4, N = 6, W = (2 * N + 1) * T;
    for (let ix = -N; ix <= N; ix++) for (let iz = -N; iz <= N; iz++) { const s = addBox(ix * T, 0, iz * T, T - 0.08, 0.7, T - 0.08, '#a9a2cf', { noUnder: true }); s.pi = S.paint.length; s.pt = -1; S.paint.push(s); }
    for (const sd of [-1, 1]) { addBox(sd * (W / 2 + 0.4), 1.2, 0, 0.8, 1.9, W + 1.6, '#ffffff', { noUnder: true }); addBox(0, 1.2, sd * (W / 2 + 0.4), W, 1.9, 0.8, '#ffffff', { noUnder: true }); }
    S.low = addSweep(0, 0, 0.15, 0.7, 9.5, 0.4, 0.8, '#ff3b3b', 0, 0.006); S.low.kb = 0.5;
    for (const [x, z] of [[8.4, 8.4], [-8.4, 8.4], [8.4, -8.4], [-8.4, -8.4]]) addBox(x, 0.4, z, 2.2, 0.8, 2.2, '#ffe14a', { tramp: true, noUnder: true });
    // camps de départ : chaque équipe d'un côté
    const k = [0, 0];
    S.spawnFor = id => { const tm = S.teams[id] || 0, i = k[tm]++; return { x: (tm ? 1 : -1) * 11.5, y: 0, z: -9 + (i % 7) * 3 }; };
    S.spawns = [{ x: 0, y: 0, z: 0 }]; S.fallY = -9;
  }
  function paintTile(i, tm, local) {
    const s = S.paint && S.paint[i]; if (!s || s.pt === tm) return false; s.pt = tm;
    s.g.children[0].material = tm < 0 ? [matT('#a9a2cf'), matS('#a9a2cf')] : [mat(TEAMS[tm].c, { roughness: 0.45 }), matS(TEAMS[tm].c)];
    if (local && !S.solo) S.pq.push(i, tm);
    return true;
  }
  function paintCount() { const c = [0, 0]; if (S.paint) for (const s of S.paint) if (s.pt >= 0) c[s.pt]++; return c; }


  /* ---------- LE FOOT FOU (équipes, ballon géant ; l'hôte simule le ballon) ---------- */
  const FL = 19, FW = 12, FGW = 4.2, FGH = 3.4, BR_ = 1.25;
  function buildFoot() {
    const r = rng(S.seed + 23);
    sky('#3fb6ff', '#e4f6ff'); sea(-26, '#eaf8ff'); clouds(r, 22, -10, 24, z => z); lights();
    S.scene.fog = new THREE.Fog(0xe4f6ff, 90, 340);
    S.teams = teamSplit(); S.goals = [0, 0];
    addBox(0, 0, 0, FL * 2, 0.8, FW * 2, '#47d16c', { noUnder: true });
    for (let i = -4; i <= 4; i++) { const st = mesh(BOXG, mat(i % 2 ? '#3fbf5e' : '#56dc78'), false); st.scale.set(4.2, 0.02, FW * 2 - 0.2); st.position.set(i * 4.2, 0.01, 0); S.scene.add(st); }
    const line = (x, z, w, d) => { const k = mesh(BOXG, mat('#ffffff'), false); k.scale.set(w, 0.03, d); k.position.set(x, 0.03, z); S.scene.add(k); };
    line(0, 0, 0.25, FW * 2 - 0.4); { const c = mesh(own(new THREE.TorusGeometry(3.5, 0.12, 6, 40)), mat('#ffffff'), false); c.rotation.x = Math.PI / 2; c.position.y = 0.04; S.scene.add(c); }
    for (const sd of [-1, 1]) {
      addBox(0, 2.2, sd * (FW + 0.4), FL * 2 + 1.6, 3, 0.8, '#ffffff', { noUnder: true });                       // bords longs
      for (const zs of [-1, 1]) addBox(sd * (FL + 0.4), 2.2, zs * (FGW + FW) / 2, 0.8, 3, FW - FGW, '#ffffff', { noUnder: true });   // bords des buts
      const tc = TEAMS[sd < 0 ? 0 : 1].c;   // but défendu par l'équipe 0 à gauche (x < 0), l'équipe 1 à droite
      addBox(sd * (FL + 1.9), 0, 0, 3, 0.8, FGW * 2 + 0.6, '#dfe8f0', { noUnder: true });
      addBox(sd * (FL + 3.7), FGH + 0.6, 0, 0.6, FGH + 1.4, FGW * 2 + 1.2, tc, { noUnder: true });
      for (const zs of [-1, 1]) addBox(sd * (FL + 1.9), FGH + 0.6, zs * (FGW + 0.3), 3.6, FGH + 1.4, 0.6, tc, { noUnder: true });
      const bar = mesh(BOXG, mat(tc), false); bar.scale.set(0.5, 0.5, FGW * 2 + 1.2); bar.position.set(sd * (FL + 0.4), FGH + 0.25, 0); S.scene.add(bar);
      const net = mesh(BOXG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }), false); net.scale.set(3.4, FGH, FGW * 2); net.position.set(sd * (FL + 1.9), FGH / 2, 0); S.disp.push(net.material); S.scene.add(net);
      tribune(sd * (FL + 7), -FW, FW * 2, 0, sd);
    }
    // le ballon
    const g = new THREE.Group(), ball = mesh(own(new THREE.SphereGeometry(BR_, 24, 16)), mat('#ffffff', { roughness: 0.4 })); g.add(ball);
    for (let i = 0; i < 3; i++) { const b = mesh(own(new THREE.TorusGeometry(BR_ * 1.002, 0.09, 6, 32)), mat(['#ff4f9e', '#3f8cff', '#ffe14a'][i]), false); b.rotation.set(i === 0 ? Math.PI / 2 : 0, i === 2 ? Math.PI / 2 : 0, 0); g.add(b); }
    S.scene.add(g); S.ball = { g, x: 0, y: BR_ + 3, z: 0, vx: 0, vy: 0, vz: 0, dead: 0, last: null, sT: 0 };
    const k = [0, 0]; S.spawnFor = id => { const tm = S.teams[id] || 0, i = k[tm]++; return { x: (tm ? 1 : -1) * (6 + (i % 2) * 4), y: 0, z: -6 + (i % 4) * 4 }; };
    S.spawns = [{ x: 0, y: 0, z: 0 }]; S.fallY = -9;
  }
  function onGoal(tm, sc, by) {
    S.goals = sc.slice(); const p = by && S.players.get(by), mine = (S.teams[S.selfId] || 0) === tm;
    big(mine ? 'BUUUT !' : 'BUT…', TEAMS[0].e + ' ' + S.goals[0] + ' — ' + S.goals[1] + ' ' + TEAMS[1].e + (p ? ' · ' + p.name : ''), 1800);
    snd(mine ? 'cheer' : 'aww'); S.excite = 1.4; if (by === S.selfId) bzEv('goal');
    const B = S.ball; emit(B.x, B.y + 1, B.z, 120, { cols: mine ? CONF : [TEAMS[tm].c, '#ffffff'], spd: 8, up: 9, life: 1.6, grav: 7, spread: 2 });
    paintList();
  }
  function ballTick(dt, host) {
    const B = S.ball; if (!B) return;
    if (B.dead > 0) { B.dead -= dt; if (B.dead <= 0 && host) { B.x = 0; B.z = 0; B.y = BR_ + 4; B.vx = B.vy = B.vz = 0; } }
    B.vy -= GRAV * 0.55 * dt; B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt;
    if (B.y < BR_) { B.y = BR_; B.vy = B.vy < -2.5 ? -B.vy * 0.55 : 0; const f = Math.max(0, 1 - 0.55 * dt); B.vx *= f; B.vz *= f; }
    if (Math.abs(B.z) > FW - BR_) { B.z = Math.sign(B.z) * (FW - BR_); B.vz = -B.vz * 0.8; }
    const inGoal = Math.abs(B.z) < FGW - 0.2 && B.y < FGH;
    if (Math.abs(B.x) > FL - BR_ && !inGoal) { B.x = Math.sign(B.x) * (FL - BR_); B.vx = -B.vx * 0.8; }
    if (Math.abs(B.x) > FL + 3.2 - BR_) { B.x = Math.sign(B.x) * (FL + 3.2 - BR_); B.vx = -B.vx * 0.3; }
    if (host && S.ctl && !S.decided && B.dead <= 0 && Math.abs(B.x) > FL + BR_ * 0.6 && inGoal) {   // BUT : la balle est entrée côté x>0 → but pour l'équipe 0
      const tm = B.x > 0 ? 0 : 1, sc = S.goals.slice(); sc[tm]++; B.dead = 2.2; onGoal(tm, sc, B.last); if (!S.solo) BR.Net.relay({ k: 'gl', tm, sc, by: B.last });
    }
    if (host && B.dead <= 0) for (const p of S.players.values()) {   // frappes
      if (!p.active || !p.vis || !inRound(p)) continue;
      const dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz) || 0.01, dy = B.y - (p.y + 0.9);
      if (d < BR_ + 0.5 && Math.abs(dy) < BR_ + 0.9) {
        const nx = dx / d, nz = dz / d, ps = Math.hypot(p.vx, p.vz), dv = isDive(p), kk = dv ? 25 : Math.max(9, ps * 1.35 + 3), rel = B.vx * nx + B.vz * nz;
        if (rel < kk) { B.vx = nx * kk + p.vx * 0.15; B.vz = nz * kk + p.vz * 0.15; B.vy = Math.max(B.vy, dv ? 7.5 : 3.5); if (p === S.me) snd('pop'); }
        B.x = p.x + nx * (BR_ + 0.52); B.z = p.z + nz * (BR_ + 0.52); B.last = p.id;
      }
    }
    if (host && !S.solo && (B.sT -= dt) <= 0) { B.sT = 1 / 12; const q = v => Math.round(v * 100) / 100; BR.Net.relay({ k: 'bl', b: [q(B.x), q(B.y), q(B.z), q(B.vx), q(B.vy), q(B.vz)], l: B.last }); }
    B.g.position.set(B.x, B.y, B.z); const sp = Math.hypot(B.vx, B.vz); if (sp > 0.1) { B.g.rotateOnWorldAxis(new THREE.Vector3(B.vz / sp, 0, -B.vx / sp), sp * dt / BR_); }
  }
  function footAI(b, inp, dt) {
    const B = S.ball, tm = S.teams[b.id] || 0, goalX = tm === 0 ? FL + 2 : -FL - 2, ownX = -goalX;
    const mates = S.part.filter(id => S.teams[id] === tm && S.players.has(id)).sort(), keeper = mates.length > 2 && mates.filter(id => S.players.get(id).bot)[0] === b.id;
    const bx = B.x + B.vx * 0.3, bz = B.z + B.vz * 0.3;
    if (keeper && Math.abs(bx - ownX) > 12) { steer(b, inp, ownX * 0.82, clamp(bz * 0.5, -FGW, FGW), 0.6); return; }
    const gx = goalX - bx, gz = -bz, gl = Math.hypot(gx, gz) || 1, px = bx - gx / gl * 2.2, pz = bz - gz / gl * 2.2;
    const behind = ((b.x - bx) * gx + (b.z - bz) * gz) / gl < -0.5, dB = Math.hypot(bx - b.x, bz - b.z);
    if (behind || dB < 2) { steer(b, inp, bx, bz, 1); if (dB < 3.2 && behind && b.ground && Math.random() < dt * (1 + 2 * b.skill) && Math.abs(bx) > FL - 10) { inp.dive = true; inp.wx = (bx - b.x) / dB; inp.wz = (bz - b.z) / dB; } }
    else { const side = Math.sign((b.z - bz) || 1); steer(b, inp, px + (Math.abs(b.z - pz) < 1.5 ? 0 : 0), pz + side * (dB < 4 ? 2.5 : 0), 1); }
  }
  function buildHill() {
    buildCrown(['#47d16c', '#e8ffd8', '#f0fff0'], true);
    const g = new THREE.Group();
    const col = mesh(own(new THREE.CylinderGeometry(3.3, 3.3, 3.2, 32, 1, true)), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }), false); col.position.y = 1.6; g.add(col);
    const ring = mesh(own(new THREE.TorusGeometry(3.3, 0.16, 8, 40)), mat('#ffe14a', { emissive: '#ffb000', emissiveIntensity: 1 }), false); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    S.disp.push(col.material); S.scene.add(g); S.hill = { g, x: 0, z: 0, k: -1, r: 3.3, ring };
  }
  function buildBomb() {
    buildCrown(['#ff5a5a', '#ffd9c0', '#ffe8de'], true);
    S.bomb = { h: [], t: 0, wait: 3.5, cd: {}, ms: {}, wave: 0 };
  }
  function bombMesh() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(HG.bomb || (HG.bomb = new THREE.SphereGeometry(0.42, 16, 12)), mat('#1c1c28', { roughness: 0.3 })); g.add(b);
    const f = new THREE.Mesh(HG.fuse || (HG.fuse = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6)), mat('#c9a36b')); f.position.y = 0.5; f.rotation.z = 0.3; g.add(f);
    const sp = new THREE.Mesh(HG.spark || (HG.spark = new THREE.SphereGeometry(0.1, 8, 6)), mat('#ffb13d', { emissive: '#ff6a00', emissiveIntensity: 1.5 }), false); sp.position.set(0.08, 0.66, 0); g.add(sp); g.userData.sp = sp;
    S.scene.add(g); return g;
  }
  function onBomb(h, t) {
    const B = S.bomb; if (!B) return; const was = B.h.includes(S.selfId);
    B.h = (h || []).filter(id => S.players.has(id)); if (t != null) B.t = t;
    for (const id in B.ms) if (!B.h.includes(id)) { S.scene.remove(B.ms[id]); delete B.ms[id]; }
    for (const id of B.h) if (!B.ms[id]) B.ms[id] = bombMesh();
    const has = B.h.includes(S.selfId);
    if (has && !was) { shout('TU AS LA BOMBE ! REFILE-LA !', '#ff3b3b'); snd('boom'); S.shake = Math.max(S.shake, 0.25); }
    else if (!has && was && S.me.active) { shout('OUF, REFILÉE !', '#47d16c'); snd('pop'); }
    paintList();
  }
  function bombTick(dt, host) {
    const B = S.bomb; if (!B) return;
    if (B.h.length) B.t -= dt;
    for (const id in B.ms) { const p = S.players.get(id), g = B.ms[id]; if (!p) continue; g.position.set(p.x, p.y + 2.6 + Math.sin(S.rt * 8) * 0.08, p.z); const k = 1 + (B.t < 4 ? Math.abs(Math.sin(S.rt * (B.t < 2 ? 18 : 9))) * 0.25 : 0); g.scale.setScalar(k); g.userData.sp.visible = Math.sin(S.rt * 30) > 0; }
    if (B.h.includes(S.selfId) && B.t > 0 && B.t < 5 && Math.ceil(B.t) !== B.last) { B.last = Math.ceil(B.t); big(String(B.last), 'Refile la bombe !', 600); snd('pop'); }
    if (!host || !S.ctl || S.decided) return;
    const alive = S.part.filter(id => S.players.has(id) && !S.out.has(id));
    for (const id in B.cd) B.cd[id] -= dt;
    if (!B.h.length) {
      if ((B.wait -= dt) > 0 || alive.length <= S.target) return;
      const k = Math.max(1, Math.min(alive.length - S.target, Math.floor(alive.length / 3))), pool = alive.slice(), h = [];
      while (h.length < k && pool.length) h.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      B.wave++; const t = Math.max(9, 16 - B.wave * 1.5); onBomb(h, t); if (!S.solo) BR.Net.relay({ k: 'bm', h, t }); feed('💣 ' + h.length + ' bombe' + (h.length > 1 ? 's' : '') + ' en jeu !'); return;
    }
    if (B.t <= 0) {   // BOUM
      const gone = B.h.slice(); onBomb([], 0); if (!S.solo) BR.Net.relay({ k: 'bm', h: [], t: 0 }); B.wait = 3;
      for (const id of gone) { const p = S.players.get(id); if (!p) continue; emit(p.x, p.y + 1, p.z, 60, { cols: ['#ff5a00', '#ffb13d', '#1c1c28', '#ffffff'], spd: 9, up: 8, life: 1, grav: 9, spread: 1 }); snd('boom'); if (p.active) eliminateP(p); }
      return;
    }
    // passe au toucher
    let changed = false; const h = B.h.slice();
    for (let i = 0; i < h.length; i++) {
      const a = S.players.get(h[i]); if (!a || !a.active || (B.cd[h[i]] || 0) > 0) continue;
      for (const id of alive) { if (h.includes(id) || (B.cd[id] || 0) > 0) continue; const p = S.players.get(id); if (!p || !p.active) continue; if (Math.hypot(p.x - a.x, p.z - a.z) < 1.6 && Math.abs(p.y - a.y) < 1.8) { h[i] = id; B.cd[id] = 0.9; changed = true; break; } }
      if (!a.active && !changed) { const c = alive.filter(id => !h.includes(id)); if (c.length) { h[i] = c[Math.floor(Math.random() * c.length)]; changed = true; } }
    }
    if (changed) { onBomb(h, B.t); if (!S.solo) BR.Net.relay({ k: 'bm', h, t: Math.round(B.t * 10) / 10 }); }
  }
  function bombAI(b, inp) {
    const B = S.bomb, mine = B.h.includes(b.id), dC = Math.hypot(b.x, b.z);
    if (barAhead(b) === 'low' && b.ground) inp.jump = true;
    let tg = null, td = 1e9;
    for (const p of S.players.values()) { if (p === b || !p.active || !inRound(p) || S.out.has(p.id)) continue; const other = B.h.includes(p.id); if (mine ? other : !other) continue; const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < td) { td = d; tg = p; } }
    if (!tg) { steer(b, inp, 0, 0, 0.4); return; }
    if (mine) { steer(b, inp, tg.x + tg.vx * 0.3, tg.z + tg.vz * 0.3, 0.85 + 0.15 * b.skill); return; }
    if (td > 9) { steer(b, inp, 0, 0, 0.35); return; }
    b.ai.dir = b.ai.dir || (Math.random() < 0.5 ? 1 : -1);
    let fx = (b.x - tg.x) / td, fz = (b.z - tg.z) / td; const tx = -b.z / (dC || 1), tz = b.x / (dC || 1); fx += tx * b.ai.dir * 0.7; fz += tz * b.ai.dir * 0.7; if (dC > 8) { fx -= b.x / dC * 3; fz -= b.z / dC * 3; }
    steer(b, inp, b.x + fx * 5, b.z + fz * 5, 0.8 + 0.2 * b.skill); if (td < 2.2 && b.ground && Math.random() < 0.3) inp.jump = true;
  }
  // émotes (touches 1 à 4) : animation + bulle, visibles par tout le monde
  const EMOTES = [['Cheer', '🎉', 'BRAVO !'], ['Spellcast_Raise', '👋', 'SALUT !'], ['2H_Melee_Attack_Spin', '🌀', 'TOUPIE !'], ['Interact', '😜', 'NANANÈRE !']];
  function emote(i, p, remote) {
    const E = EMOTES[i]; if (!E || !p || !p.av || !p.vis) return; if (!remote && ((p.emCd || 0) > S.rt)) return; p.emCd = S.rt + 1.6;
    try { p.av.act(E[0], { speed: 1 }); } catch (e) {}
    emit(p.x, p.y + 2.3, p.z, 10, { cols: ['#ffe14a', '#ff4f9e', '#3fd0ff', '#ffffff'], spd: 2.5, up: 3, life: 0.8 });
    if (p === S.me) { shout(E[1] + ' ' + E[2], '#ffffff'); if (!S.solo) BR.Net.relay({ k: 'em', i }); }
    else if (Math.hypot(p.x - S.me.x, p.z - S.me.z) < 30) feed(E[1] + ' ' + p.name);
  }
  function respawnArena(m) {
    const a = Math.random() * Math.PI * 2, sp = S.spawnFor ? S.spawnFor(m.id) : { x: Math.cos(a) * 12, y: 0, z: Math.sin(a) * 12 };
    m.x = sp.x; m.z = sp.z; m.y = 3; m.vx = m.vy = m.vz = 0; m.st = 'run'; m.ghost = 1.5; m.ground = false; m.grabbed = m.holding = null;
    if (m === S.me) { S.yaw = Math.atan2(-m.x, -m.z); snd('aww'); shout('PLOUF !', '#3fd0ff'); }
  }
  function onCrown(id, times) {
    const C = S.crown; if (!C) return; C.h = id || null; C.cd = 1.6; if (times) Object.assign(S.ctime, times);
    if (!id) { C.x = 0; C.z = 0; C.y = S.crownY; }
    const p = id && S.players.get(id); snd('pop');
    if (p) { feed(p.name + ' a la couronne ! 👑'); emit(p.x, p.y + 2.5, p.z, 30, { cols: ['#ffe14a', '#ffb13d', '#ffffff'], spd: 4, up: 4, life: 0.8 }); if (p === S.me) { shout('TU AS LA COURONNE !', '#ffe14a'); sfx('buy'); } }
    else feed('La couronne retourne sur le trône !');
    paintList();
  }
  function setCrown(id) { onCrown(id); if (!S.solo) BR.Net.relay({ k: 'ck', h: id, t: packTimes() }); }
  function modeTick(dt) {
    const host = S.solo || BR.Net.isHost();
    if ((S.plT = (S.plT || 0) - dt) <= 0) { S.plT = 1; paintList(); }
    if (S.ball) ballTick(dt, host);
    if (S.hill) {
      const H = S.hill, el = S.rt - S.goAt, k = Math.max(0, Math.floor(el / 12));
      if (k !== H.k) { H.k = k; const spots = [[0, 0], [9, 0], [-9, 0], [0, 9], [0, -9], [6.5, 6.5], [-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5]], rr = rng(S.seed + k * 7 + 1); let sp = k ? spots[1 + Math.floor(rr() * (spots.length - 1))] : spots[0]; if (k && sp[0] === H.x && sp[1] === H.z) sp = spots[0]; H.tx = sp[0]; H.tz = sp[1]; if (H.k > 0) { feed('⚠️ La zone se déplace !'); snd('pop'); } }
      H.x += ((H.tx || 0) - H.x) * Math.min(1, dt * 3); H.z += ((H.tz || 0) - H.z) * Math.min(1, dt * 3); H.g.position.set(H.x, 0, H.z); H.ring.scale.setScalar(1 + Math.sin(S.rt * 4) * 0.04);
      if (S.ctl && !S.decided) for (const p of S.players.values()) { if (!p.active || !inRound(p)) continue; if (Math.hypot(p.x - H.x, p.z - H.z) < H.r && p.y > -1 && p.y < 3.5) { S.ctime[p.id] = (S.ctime[p.id] || 0) + dt; if (p === S.me && (S.myC = (S.myC || 0) + dt) >= 1) { S.myC -= 1; bzEv('crown'); } } }
      if (host && !S.solo && S.ctl && (S.csT = (S.csT || 0) - dt) <= 0) { S.csT = 1; BR.Net.relay({ k: 'cs', t: packTimes() }); }
    }
    if (S.crown) {
      const C = S.crown, hp = C.h && S.players.get(C.h);
      if (S.ctl && !S.decided && hp) { S.ctime[C.h] = (S.ctime[C.h] || 0) + dt; if (hp === S.me && (S.myC = (S.myC || 0) + dt) >= 1) { S.myC -= 1; bzEv('crown'); } }
      if (hp) C.g.position.set(hp.x, hp.y + 2.55, hp.z); else C.g.position.set(C.x, C.y + 0.9 + Math.sin(S.rt * 3) * 0.25, C.z);
      C.g.rotation.y += dt * 2; C.glow.visible = !hp;
      if (host && S.ctl && !S.decided) {
        C.cd -= dt;
        if (hp && (hp.y < -3 || !inRound(hp))) setCrown(null);
        else if (!hp) { for (const p of S.players.values()) { if (!p.active || !inRound(p)) continue; if (Math.hypot(p.x - C.x, p.z - C.z) < 1.6 && p.y > C.y - 1.2 && p.y < C.y + 2.5) { setCrown(p.id); break; } } }
        else if (C.cd <= 0) { for (const p of S.players.values()) { if (p === hp || !p.active || !inRound(p)) continue; const d = Math.hypot(p.x - hp.x, p.z - hp.z); if (d < 1.5 && Math.abs(p.y - hp.y) < 1.7 && (isDive(p) || isGrab(p))) { setCrown(p.id); break; } } }
        if (!S.solo && (S.csT = (S.csT || 0) - dt) <= 0) { S.csT = 1; BR.Net.relay({ k: 'cs', t: packTimes(), h: C.h }); }
      }
    }
    if (S.paint && !S.solo) {
      if ((S.pqT -= dt) <= 0 && S.pq.length) { S.pqT = 0.15; BR.Net.relay({ k: 'pt', a: S.pq.splice(0) }); }
      if (host && (S.pfT -= dt) <= 0) { S.pfT = 2.5; BR.Net.relay({ k: 'pf', s: S.paint.map(s => s.pt + 1).join('') }); }
    }
  }
  // fin d'une manche à score : liste des qualifiés (et ordre des éliminés, du pire au meilleur)
  function scoreQualified() {
    const part = S.part.filter(id => S.players.has(id));
    if (S.crown || S.hill) {
      const rk = part.slice().sort((a, b) => (S.ctime[b] || 0) - (S.ctime[a] || 0));
      const q = rk.slice(0, S.final ? 1 : Math.max(1, S.target)); S.outOrder = rk.filter(id => !q.includes(id)).reverse(); return q;
    }
    if (S.ball && S.goals[0] === S.goals[1] && S.rt - S.goAt < S.def.time + 25) return null;   // égalité : but en or (25 s max)
    const c = S.ball ? S.goals : paintCount(); let win = c[0] > c[1] ? 0 : c[1] > c[0] ? 1 : (S.seed & 1);
    if (!part.some(id => S.teams[id] === win)) win = 1 - win;
    const q = part.filter(id => S.teams[id] === win); S.outOrder = part.filter(id => !q.includes(id)); return q;
  }
  function modeAI(b, inp, dt) {
    const ai = b.ai; ai.t = (ai.t || 0) - dt;
    const R = S.crown ? 15 : 13, dC = Math.hypot(b.x, b.z);
    if (barAhead(b) === 'low' && b.ground) inp.jump = true;
    if (S.ball) return footAI(b, inp, dt);
    if (S.hill) {
      const H = S.hill, tx = H.tx != null ? H.tx : H.x, tz = H.tz != null ? H.tz : H.z, d = Math.hypot(tx - b.x, tz - b.z);
      ai.off = ai.off || [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3];
      steer(b, inp, tx + (d < 4 ? ai.off[0] : 0), tz + (d < 4 ? ai.off[1] : 0), d < 2 ? 0.3 : 0.85 + 0.15 * b.skill);
      if (d < 2.5 && Math.hypot(b.x, b.z) < 1.5 && b.ground && Math.random() < dt * 2) inp.jump = true;   // le trône au centre
      if (d < 4 && b.ground && Math.random() < dt * (0.8 + 1.5 * b.skill)) for (const p of S.players.values()) { if (p === b || !p.active) continue; const dx = p.x - b.x, dz = p.z - b.z, dd = Math.hypot(dx, dz); if (dd < 2.6 && dd > 0.3 && Math.abs(p.y - b.y) < 1.2) { if (Math.random() < 0.5) { inp.dive = true; inp.wx = dx / dd; inp.wz = dz / dd; } else { b.face = Math.atan2(dx, dz); inp.grab = true; } break; } }
      return;
    }
    if (S.crown) {
      const C = S.crown;
      if (C.h === b.id) {   // je l'ai : je fuis le plus proche, en tournant
        let nx = 0, nz = 0, nd = 1e9; for (const p of S.players.values()) { if (p === b || !p.active || !inRound(p)) continue; const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < nd) { nd = d; nx = p.x; nz = p.z; } }
        let fx = b.x - nx, fz = b.z - nz; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
        const tx = -b.z / (dC || 1), tz = b.x / (dC || 1); ai.dir = ai.dir || (Math.random() < 0.5 ? 1 : -1);
        let wx = fx + tx * ai.dir * 0.8, wz = fz + tz * ai.dir * 0.8; if (dC > R - 4) { wx -= b.x / dC * 1.6; wz -= b.z / dC * 1.6; }
        steer(b, inp, b.x + wx * 5, b.z + wz * 5, 0.85 + 0.15 * b.skill);
        if (nd < 2.2 && b.ground && Math.random() < dt * 3) inp.jump = true;
        return;
      }
      const hp = C.h && S.players.get(C.h);
      const tx = hp ? hp.x + hp.vx * 0.25 : C.x, tz = hp ? hp.z + hp.vz * 0.25 : C.z, d = Math.hypot(tx - b.x, tz - b.z);
      steer(b, inp, tx, tz, 0.8 + 0.2 * b.skill);
      if (!hp && d < 2.4 && b.ground) inp.jump = true;   // monter sur le trône
      if (hp && d < 3.4 && b.ground && Math.abs(hp.y - b.y) < 1.2 && Math.random() < dt * (2 + 3 * b.skill)) { if (Math.random() < 0.6) { inp.dive = true; inp.wx = (tx - b.x) / d; inp.wz = (tz - b.z) / d; } else { b.face = Math.atan2(tx - b.x, tz - b.z); inp.grab = true; } }
      return;
    }
    // peinture : la dalle la plus intéressante pas encore à ma couleur
    const tm = S.teams[b.id] || 0;
    if (ai.t <= 0 || !ai.tg) {
      let best = null, bs = 1e9;
      for (let k = 0; k < 14; k++) { const s = S.paint[Math.floor(Math.random() * S.paint.length)]; if (s.pt === tm) continue; const sc = Math.hypot(s.x - b.x, s.z - b.z) - (s.pt >= 0 ? 4 : 0); if (sc < bs) { bs = sc; best = s; } }
      ai.tg = best ? [best.x, best.z] : [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20]; ai.t = 0.5 + Math.random() * 0.6;
    }
    steer(b, inp, ai.tg[0], ai.tg[1], 0.8 + 0.2 * b.skill);
    if (dC > R) steer(b, inp, 0, 0, 0.8);
  }

  /* ===================== physique du joueur ===================== */
  function groundAt(x, z, feet) {
    let best = -Infinity, obj = null; const lim = feet + STEP;
    for (const s of S.solids) {
      let top;
      if (s.t === 'box') {
        if (s.dead) continue;
        top = s.y + s.hy; if (top > lim || top <= best) continue;
        const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
        if (Math.abs(lx) > s.hx + 0.12 || Math.abs(lz) > s.hz + 0.12) continue;
      } else if (s.t === 'disc') {
        top = s.y; if (top > lim || top <= best) continue;
        if (Math.hypot(x - s.x, z - s.z) > s.r + 0.1) continue;
      } else if (s.t === 'ramp') {
        if (s.gen) { const dx = x - s.ox, dz = z - s.oz, al = dx * s.fx + dz * s.fz, la = dx * s.rx + dz * s.rz; if (al < -0.05 || al > s.L + 0.05 || Math.abs(la) > s.hw) continue; top = s.y0 + (s.y1 - s.y0) * clamp(al / s.L, 0, 1); }
        else { if (x < s.x0 || x > s.x1 || z < s.z0 - 0.05 || z > s.z1 + 0.05) continue; top = rampY(s, z); }
        if (top > feet + 0.9 || top <= best) continue;
      } else if (s.t === 'cyl') {
        top = s.y1; if (top > lim || top <= best) continue;
        if (Math.hypot(x - s.x, z - s.z) > s.r) continue;
      } else continue;
      best = top; obj = s;
    }
    return { y: best, obj };
  }
  function pushWalls(m) {
    const feet = m.y, head = m.y + 1.7, x0 = m.x, z0 = m.z;
    for (const s of S.solids) {
      if (s.t === 'box') {
        if (s.dead) continue;
        const top = s.y + s.hy, bot = s.y - s.hy; if (top <= feet + STEP || bot >= head) continue;
        const dx = m.x - s.x, dz = m.z - s.z; let lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
        const qx = clamp(lx, -s.hx, s.hx), qz = clamp(lz, -s.hz, s.hz), ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
        if (d >= RAD) continue;
        if (d > 1e-5) { lx = qx + ox / d * RAD; lz = qz + oz / d * RAD; } else { const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz); if (px < pz) lx = Math.sign(lx || 1) * (s.hx + RAD); else lz = Math.sign(lz || 1) * (s.hz + RAD); }
        m.x = s.x + lx * s.c + lz * s.s; m.z = s.z - lx * s.s + lz * s.c; m.lastPush = s;
      } else if (s.t === 'disc' || s.t === 'cyl') {
        const top = s.t === 'disc' ? s.y : s.y1, bot = s.t === 'disc' ? s.y - s.h : s.y0; if (top <= feet + STEP || bot >= head) continue;
        const dx = m.x - s.x, dz = m.z - s.z, d = Math.hypot(dx, dz), rr = s.r + RAD;
        if (d < rr && d > 1e-4) { m.x = s.x + dx / d * rr; m.z = s.z + dz / d * rr; }
      }
    }
    const px = m.x - x0, pz = m.z - z0, pl = Math.hypot(px, pz);
    return pl > 1e-4 ? [px / pl, pz / pl] : null;
  }
  function updateWorld(t, dt) {
    for (const s of S.solids) {
      if (s.t === 'box' && s.move) {
        const p = s.move(t); s.dx = p.x - s.x; s.dy = p.y - (s.y + s.hy); s.dz = p.z - s.z; s.x = p.x; s.y = p.y - s.hy; s.z = p.z; s.g.position.set(s.x, s.y, s.z);
      } else if (s.t === 'disc' && s.w) { const a = s.w * t; s.dry = a - s.ang; s.ang = a; s.g.rotation.y = a; }
    }
    for (const h of S.haz) h.update(t, dt);
    if (S.scroll) for (const sc of S.scroll) sc.t.offset.y = ((sc.t.offset.y + dt * sc.k) % 1 + 1) % 1;   // défile vers l'avant
    if (S.anim) for (const f of S.anim) f(t, dt);
    if (S.bob) for (const b of S.bob) b.g.position.y = b.y + Math.sin(S.rt * 1.3 + b.ph) * 0.5;
    if (S.cloudTex) S.cloudTex.offset.x = (S.cloudTex.offset.x + dt * 0.004) % 1;
    // dalles de la Toupie
    if (S.tiles && (S.r2 === 'ile' || S.r2 === 'toupie') && S.round === 2 && S.ctl) for (const s of S.tiles) if (!s.state && s.fallAt != null && t > s.fallAt) crumble(s.tile);
    if (S.crs) for (const s of S.crs) {   // planches du pont fragile : tombent puis reviennent
      if (s.state === 1) { const k = S.rt - s.t0; s.g.position.x = s.home.x + Math.sin(k * 60) * 0.05; if (k > 0.7) { s.state = 2; s.dead = true; s.vy = 0; } }
      else if (s.state === 2) { s.vy -= 30 * dt; s.g.position.y += s.vy * dt; if (S.rt - s.t0 > 3.6) { s.state = 0; s.dead = false; s.g.position.copy(s.home); s.g.children[0].material = s.mat0; s.g.visible = true; } else if (s.g.position.y < s.home.y - 30) s.g.visible = false; }
    }
    for (const s of S.solids) if (s.blink) {   // plateformes qui clignotent (même rythme pour tout le monde)
      const u = (((t + s.blink.ph) % s.blink.per) + s.blink.per) % s.blink.per / s.blink.per, on = u < s.blink.on; s.dead = !on;
      s.g.visible = on && !(u > s.blink.on - 0.16 && Math.floor(t * 14) % 2);
    }
    if (S.tiles) for (const s of S.tiles) {
      if (s.state === 1) { const k = S.rt - s.t0; s.g.position.x = s.x + Math.sin(k * 60) * 0.06; if (k > (S.r2 === 'etages' ? 1.4 : 1.0)) { s.state = 2; s.dead = true; s.vy = 0; } }
      else if (s.state === 2 && s.g.visible) { s.vy -= 30 * dt; s.g.position.y += s.vy * dt; if (s.g.position.y < -30) s.g.visible = false; }
    }
  }
  function initFx() {
    const N = 700, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3).fill(-9999), col = new Float32Array(N * 3).fill(1);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 0.42, map: texs().dot, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; S.scene.add(pts); S.disp.push(geo, m);
    S.fxp = { N, pos, col, vel: new Float32Array(N * 3), life: new Float32Array(N), grav: new Float32Array(N), i: 0, geo };
  }
  const _c = new THREE.Color();
  function emit(x, y, z, n, o) {
    const F = S.fxp; if (!F) return; o = o || {};
    for (let k = 0; k < n; k++) {
      const i = F.i; F.i = (F.i + 1) % F.N; const a = Math.random() * Math.PI * 2, sp = (o.spd || 3) * (0.4 + Math.random() * 0.8);
      F.pos[i * 3] = x + (Math.random() - 0.5) * (o.spread || 0.4); F.pos[i * 3 + 1] = y; F.pos[i * 3 + 2] = z + (Math.random() - 0.5) * (o.spread || 0.4);
      F.vel[i * 3] = Math.cos(a) * sp + (o.vx || 0); F.vel[i * 3 + 1] = (o.up || 2) * (0.5 + Math.random()); F.vel[i * 3 + 2] = Math.sin(a) * sp + (o.vz || 0);
      F.life[i] = (o.life || 0.5) * (0.7 + Math.random() * 0.6); F.grav[i] = o.grav != null ? o.grav : 6;
      _c.set(o.cols ? o.cols[Math.floor(Math.random() * o.cols.length)] : (o.col || '#ffffff')); F.col[i * 3] = _c.r; F.col[i * 3 + 1] = _c.g; F.col[i * 3 + 2] = _c.b;
    }
  }
  function updateFx(dt) {
    const F = S.fxp; if (!F) return;
    for (let i = 0; i < F.N; i++) {
      if (F.life[i] <= 0) continue;
      F.life[i] -= dt; if (F.life[i] <= 0) { F.pos[i * 3 + 1] = -9999; continue; }
      F.vel[i * 3 + 1] -= F.grav[i] * dt; const dr = Math.max(0, 1 - dt * 1.5); F.vel[i * 3] *= dr; F.vel[i * 3 + 2] *= dr;
      F.pos[i * 3] += F.vel[i * 3] * dt; F.pos[i * 3 + 1] += F.vel[i * 3 + 1] * dt; F.pos[i * 3 + 2] += F.vel[i * 3 + 2] * dt;
    }
    F.geo.attributes.position.needsUpdate = true; F.geo.attributes.color.needsUpdate = true;
  }
  const CONF = ['#ff4f9e', '#ffe14a', '#3fd0ff', '#47d16c', '#7a6cff', '#ffffff'];
  function crumbleCr(i) { const s = S.crs && S.crs[i]; if (!s || s.state) return; s.state = 1; s.t0 = S.rt; s.g.children[0].material = [mat('#ffffff'), mat('#ffd6ea')]; emit(s.x, s.y + s.hy, s.z, 4, { col: '#c98b4a', spd: 2, up: 2, life: 0.5 }); }
  function crumble(i) { const s = S.tiles && S.tiles[i]; if (!s || s.state) return; s.state = 1; s.t0 = S.rt; s.g.children[0].material = [mat('#ffffff'), mat('#ffd6ea')]; emit(s.x, 0.1, s.z, 5, { col: '#ffffff', spd: 2, up: 2, life: 0.6 }); }

  // un joueur simulé ici ? (moi, ou un bot quand je suis seul ou l'hôte)
  const simHere = p => p === S.me || (!!p.bot && (S.solo || BR.Net.isHost()));
  const stOf = p => simHere(p) ? (p.st === 'run' && !p.ground ? ST.air : p.st === 'wall' && p.wallSide < 0 ? 6 : (ST[p.st] != null ? ST[p.st] : 0)) : p.st;
  function hitPlayer(p, v) {   // bousculade infligée à p (là où p est simulé)
    if (simHere(p)) { if ((p.bumpCd || 0) > 0 || !p.active) return; p.bumpCd = 0.7; knock(p, v); if (p === S.me) shout('BOUSCULÉ !', '#ff4f9e'); }
    else BR.Net.relay({ k: 'bp', to: p.id, v: [Math.round(v.x * 10) / 10, v.y, Math.round(v.z * 10) / 10] });
  }
  function grabPlayer(p, byId) {
    if (simHere(p)) { if (!p.active) return; p.grabbed = { by: byId, t: 1.3 }; if (p === S.me) { shout('ON T\'ATTRAPE !', '#ff4f9e'); snd('grab'); } }
    else BR.Net.relay({ k: 'gr', to: p.id, by: byId });
  }
  function doGrab(m) {
    const me = m === S.me; m.grabCd = 3.5; m.grabT = 0.45; if (me) snd('grab');
    const fx0 = Math.sin(m.face), fz0 = Math.cos(m.face); let best = null, bd = 2.3;
    for (const p of S.players.values()) { if (p === m || !p.vis) continue; const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz); if (d < bd && Math.abs(p.y - m.y) < 1.6 && (dx * fx0 + dz * fz0) / (d || 1) > 0.1) { bd = d; best = p; } }
    if (best) { m.holding = { id: best.id, t: 1.3 }; grabPlayer(best, m.id); if (me) { shout('ATTRAPÉ !'); bzEv('grab'); } }
  }
  function knock(m, v) {
    if (m.ghost > 0 && !v.soft) return;
    m.vx = v.x; m.vy = Math.max(m.vy, v.y); m.vz = v.z; m.ground = false;
    if (v.soft) { if (m === S.me) snd('pop'); return; }
    m.st = 'tumble'; m.stT = 0.85; m.spin = 0; m.holding = null;
    if (m === S.me) { S.shake = Math.max(S.shake, 0.35); fx('hit', { g: 0.8 }); fx('land', { g: 1 }); }
    emit(m.x, m.y + 1, m.z, 12, { col: '#ffe14a', spd: 4, up: 3, life: 0.5 });
  }
  /* ---------- entrées du joueur local (clavier / manette), relatives à la caméra ---------- */
  function myInput() {
    let ix = 0, iz = 0;
    if (S.ctl && !S.paused) {
      if (keys.KeyW || keys.ArrowUp) iz += 1; if (keys.KeyS || keys.ArrowDown) iz -= 1;
      if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
      const gp = S.gp; if (gp && Math.hypot(gp.lx, gp.ly) > 0.2) { ix = gp.lx; iz = -gp.ly; }
    }
    const fwx = Math.sin(S.yaw), fwz = Math.cos(S.yaw);
    const inp = { wx: fwx * iz - fwz * ix, wz: fwz * iz + fwx * ix, jump: false, dive: S.diveReq, grab: S.grabReq };
    S.diveReq = S.grabReq = false; return inp;
  }
  /* ---------- physique d'un joueur (moi ou un bot) ---------- */
  function stepPlayer(m, dt, inp) {
    if (!m.active) return;
    const me = m === S.me;
    m.ghost = Math.max(0, m.ghost - dt);
    if (inp.jump) m.jbuf = 0.13;
    let wx = inp.wx, wz = inp.wz;
    // juste après la fin d'un mur : on ignore la direction qui pousse vers le mur (sinon on repasse derrière)
    if (m.wallExit > 0) { m.wallExit -= dt; const dn = wx * m.exitN[0] + wz * m.exitN[1]; if (dn < 0) { wx -= dn * m.exitN[0]; wz -= dn * m.exitN[1]; } }
    const il = Math.hypot(wx, wz); if (il > 1) { wx /= il; wz /= il; }
    if (m.jbuf > 0) m.jbuf -= dt; if (m.coyote > 0) m.coyote -= dt;
    m.grabCd = Math.max(0, (m.grabCd || 0) - dt); m.grabT = Math.max(0, (m.grabT || 0) - dt);
    if (inp.grab && S.ctl && m.grabCd <= 0 && m.st !== 'tumble') doGrab(m);
    if (m.holding) { m.holding.t -= dt; if (m.holding.t <= 0 || !S.players.has(m.holding.id)) m.holding = null; }
    if (m.grabbed) { m.grabbed.t -= dt; const gb = S.players.get(m.grabbed.by); if (!gb || m.grabbed.t <= 0) m.grabbed = null; else { const dx = gb.x - m.x, dz = gb.z - m.z, d = Math.hypot(dx, dz); if (d > 1.2) { m.vx += dx / d * 30 * dt; m.vz += dz / d * 30 * dt; } } }
    // plongeon
    if (inp.dive && S.ctl && !m.grabbed && (m.st === 'run' || m.st === 'air' || m.st === 'slide') && !m.diveUsed) {
      const dl = Math.hypot(wx, wz), dx = dl > 0.1 ? wx / dl : Math.sin(m.face), dz = dl > 0.1 ? wz / dl : Math.cos(m.face);
      const dv = Math.max(DIVE_H, Math.hypot(m.vx, m.vz) + 1.5); m.vx = dx * dv; m.vz = dz * dv; m.vy = m.ground ? DIVE_V + 1.5 : Math.max(m.vy, DIVE_V); m.ground = false;
      m.st = 'dive'; m.diveUsed = true; m.face = Math.atan2(dx, dz); if (me) fx('dash', { g: 0.9 });
    }
    // tyrolienne : on s'accroche en passant dessous ; Espace pour lâcher ; à la fin on est projeté
    m.zipCd = Math.max(0, (m.zipCd || 0) - dt);
    if (m.st !== 'zip' && m.st !== 'tumble' && S.zips && S.zips.length && !m.zipCd) for (const zz of S.zips) {
      const ux = zz.bx - zz.ax, uy = zz.by - zz.ay, uz = zz.bz - zz.az, u = ((m.x - zz.ax) * ux + (m.y + 1.9 - zz.ay) * uy + (m.z - zz.az) * uz) / (zz.L * zz.L); if (u < 0 || u > 0.85) continue;
      if (Math.hypot(zz.ax + ux * u - m.x, zz.ay + uy * u - m.y - 1.9, zz.az + uz * u - m.z) < 1.4) { m.st = 'zip'; m.zip = zz; m.zipU = u; m.zipV = Math.max(9, Math.hypot(m.vx, m.vz)); m.ground = false; m.holding = m.grabbed = null; if (me) { snd('whoosh'); shout('TYROLIENNE !', '#3fd0ff'); } break; }
    }
    if (m.st === 'zip' && m.zip) {
      const zz = m.zip; m.zipV = Math.min(25, m.zipV + 10 * dt); m.zipU += m.zipV * dt / zz.L;
      const dx = (zz.bx - zz.ax) / zz.L, dy = (zz.by - zz.ay) / zz.L, dz = (zz.bz - zz.az) / zz.L, u = Math.min(1, m.zipU);
      m.x = zz.ax + (zz.bx - zz.ax) * u; m.y = zz.ay + (zz.by - zz.ay) * u - 1.9; m.z = zz.az + (zz.bz - zz.az) * u;
      m.vx = dx * m.zipV; m.vy = dy * m.zipV; m.vz = dz * m.zipV; m.face = Math.atan2(dx, dz);
      if (m.jbuf > 0 || m.zipU >= 1) { m.st = 'run'; m.zipCd = 0.7; m.jbuf = 0; m.vy = Math.max(0, m.vy) + (m.zipU >= 1 ? 4 : JUMP * 0.7); const hs = Math.hypot(m.vx, m.vz); if (hs > 11) { m.vx *= 11 / hs; m.vz *= 11 / hs; } m.zip = null; if (me) fx('jump', { g: 0.6 }); }
      else { m.prog = progOf(m); return; }
    }
    if (m.st === 'tumble') { m.stT -= dt; m.spin += dt * 14; if (m.stT <= 0 && m.ground) { m.st = 'run'; m.ghost = 0.5; } }
    else if (m.st === 'dive') { m.vx += wx * dt * 6; m.vz += wz * dt * 6; }
    else if (m.st === 'wall') {
      m.wrT += dt; const n = m.wallN; let tx = -n[1], tz = n[0]; if (tx * m.vx + tz * m.vz < 0) { tx = -tx; tz = -tz; }
      const sp = Math.max(RUN, Math.abs(tx * m.vx + tz * m.vz)); m.vx = tx * sp - n[0] * 2.5; m.vz = tz * sp - n[1] * 2.5;
      m.face = Math.atan2(tx, tz); m.wallSide = (n[0] * tz - n[1] * tx) > 0 ? 1 : -1;
      if (m.wallT <= 0.08 || m.ground) { m.st = 'run'; m.wrCd = 0.25; }
      const ws = m.wallS; if (m.st === 'wall' && ws && ws.t === 'box') { const dx = m.x - ws.x, dz = m.z - ws.z, lx = dx * ws.c - dz * ws.s, lz = dx * ws.s + dz * ws.c, alz = ws.hz >= ws.hx, al = alz ? lz : lx, half = alz ? ws.hz : ws.hx; if (Math.abs(al) > half - 0.2) { m.st = 'run'; m.wrCd = 0.5; m.wallT = 0; m.vx += m.wallN[0] * 2.5; m.vz += m.wallN[1] * 2.5; m.wallExit = 0.7; m.exitN = m.wallN.slice(); } }
    }
    else if (m.st === 'slide') {
      const k = Math.max(0, 1 - dt * 5); m.vx *= k; m.vz *= k; m.stT -= dt; if (m.stT <= 0) m.st = 'run';
    } else {
      const sp = Math.hypot(m.vx, m.vz);
      if (sp > RUN + 0.4) {
        const icy = m.ground && m.gObj && m.gObj.ice; let ns = Math.max(RUN, sp - (m.ground ? (icy ? 1.2 : il > 0.1 ? 7 : 26) : 1.5) * dt);
        const a0 = Math.atan2(m.vx, m.vz), a1 = il > 0.1 ? a0 + BR.angDiff(a0, Math.atan2(wx, wz)) * Math.min(1, dt * (m.ground ? 5 : 2.8)) : a0;
        m.vx = Math.sin(a1) * ns; m.vz = Math.cos(a1) * ns;
      } else {
        const RB = S.bomb && S.bomb.h.includes(m.id) ? RUN * 1.14 : RUN, ac = m.ground ? (m.gObj && m.gObj.ice ? 9 : ACC_G) : ACC_A, tx = wx * RB, tz = wz * RB;
        const ddx = tx - m.vx, ddz = tz - m.vz, dd = Math.hypot(ddx, ddz), mx = ac * dt;
        if (dd > mx) { m.vx += ddx / dd * mx; m.vz += ddz / dd * mx; } else { m.vx = tx; m.vz = tz; }
      }
      if (il > 0.1) m.face += BR.angDiff(m.face, Math.atan2(wx, wz)) * Math.min(1, dt * 16);
    }
    if (m.grabbed || m.holding) { const cap = m.grabbed ? 4 : RUN * 0.62, hs = Math.hypot(m.vx, m.vz); if (hs > cap) { m.vx *= cap / hs; m.vz *= cap / hs; } }
    // saut (aussi pour sortir d'une glissade)
    if (m.jbuf > 0 && S.ctl && (m.ground || m.coyote > 0) && (m.st === 'run' || m.st === 'slide')) {
      if (m.gObj && m.gObj.conv) { m.vx += m.gObj.conv[0]; m.vz += m.gObj.conv[1]; }
      m.vy = JUMP; m.ground = false; m.coyote = 0; m.jbuf = 0; if (m.st === 'slide') m.st = 'run';
      if (me) fx('jump', { g: 0.6 }); emit(m.x, m.y + 0.1, m.z, 6, { col: '#ffffff', spd: 2.5, up: 1.5, life: 0.45 });
    } else if (m.jbuf > 0 && S.ctl && !m.ground && m.wallT > 0 && (m.st === 'run' || m.st === 'dive' || m.st === 'wall')) {
      // saut mural : rebondir deux fois de suite sur LE MÊME mur ne fait presque plus monter (pas d'escalade infinie)
      const same = m.lastWJS && m.lastWJS === m.wallS, keep = m.st === 'wall' ? 0.95 : 0.25; m.wrCd = 0.3;
      m.wjChain = (S.rt - (m.wjT || -9) < 1.5 ? (m.wjChain || 0) : 0) + 1; m.wjT = S.rt;
      if (me) { if (m.wjChain === 3) shout('ENCHAÎNEMENT !'); else if (m.wjChain === 5) shout('NINJA !', '#47d16c'); }
      m.vy = JUMP * (same ? 0.42 : 0.98); m.vx = m.wallN[0] * 9.5 + m.vx * keep; m.vz = m.wallN[1] * 9.5 + m.vz * keep; m.jbuf = 0; m.wallT = 0; m.lastWJS = m.wallS;
      m.st = 'run'; m.diveUsed = false; m.face = Math.atan2(m.vx, m.vz); if (me) fx('jump', { g: 0.7, rate: 1.2 });
      emit(m.x - m.wallN[0] * 0.4, m.y + 0.8, m.z - m.wallN[1] * 0.4, 9, { col: '#ff8ac2', spd: 3, up: 2, life: 0.5 });
    }
    if (m.wallT > 0) m.wallT -= dt;
    // porté par une plateforme qui bouge
    if (m.ground && m.gObj) {
      const s = m.gObj;
      const fk = dt / (S.fdt || dt);   // la plateforme a bougé une fois pour toute l'image : on répartit sur les sous-pas
      if (s.t === 'box' && s.move) { m.x += s.dx * fk; m.z += s.dz * fk; m.y += s.dy * fk; }
      if (s.conv) { m.x += s.conv[0] * dt; m.z += s.conv[1] * dt; }
      else if (s.t === 'disc' && s.dry) { const c = Math.cos(s.dry * fk), sn = Math.sin(s.dry * fk), dx = m.x - s.x, dz = m.z - s.z; m.x = s.x + dx * c + dz * sn; m.z = s.z - dx * sn + dz * c; m.face += s.dry * fk; }
    }
    const feet0 = m.y;
    if (m.st === 'wall') { if (m.wrT < 0.8) m.vy = m.vy > 0 ? Math.max(0, m.vy - GRAV * dt * 0.6) : 0; else { m.vy -= GRAV * 0.32 * dt; if (m.vy < -5) m.vy = -5; } }
    else m.vy -= GRAV * dt;
    if (S.winds) for (const w of S.winds) { if (m.y > w.y1 || m.y + 1.7 < w.y0 || Math.hypot(m.x - w.x, m.z - w.z) > w.r) continue; m.vy += w.ay * dt; m.vx += (w.ax || 0) * dt; m.vz += w.az * dt; if (m.vy > w.max) m.vy = w.max; m.diveUsed = false; if (m.st === 'tumble' || m.st === 'wall') m.st = 'run'; }
    if (m.vy < -40) m.vy = -40; m.wrCd = Math.max(0, (m.wrCd || 0) - dt);
    m.x += m.vx * dt; m.z += m.vz * dt; m.y += m.vy * dt;
    m.lastPush = null; const wn = pushWalls(m);
    if (wn && m.st === 'wall' && m.wallN && wn[0] * m.wallN[0] + wn[1] * m.wallN[1] < 0.8) { m.st = 'run'; m.wrCd = 0.4; }
    if (wn && !m.ground) { m.wallN = wn; m.wallT = 0.22; if (m.lastPush) m.wallS = m.lastPush; }
    // course murale : seulement sur les vrais murs (pas sur le côté d'une plateforme)
    if (wn && !m.ground && (m.st === 'run' || m.st === 'dive') && !m.wrCd && m.lastPush && m.lastPush.wr && Math.abs(-wn[1] * m.vx + wn[0] * m.vz) > 7 && m.vy < 9) { m.st = 'wall'; m.wrT = 0; if (me) bzEv('wall'); m.vy = Math.max(m.vy, 1.5); m.diveUsed = false; if (me) fx('dash', { g: 0.5, rate: 1.2 }); }
    const g = groundAt(m.x, m.z, Math.max(feet0, m.y));
    const wasG = m.ground;
    if (m.y <= g.y + (wasG && m.vy <= 0 ? 0.3 : 0) && m.vy <= 0 && isFinite(g.y)) {
      if (!wasG && m.vy < -7) { if (me) fx('land', { g: clamp(-m.vy / 25, 0.3, 1) }); emit(m.x, g.y + 0.05, m.z, Math.min(16, Math.round(-m.vy / 2)), { col: '#ffffff', spd: 4, up: 1.2, life: 0.5, grav: 3 }); }
      m.y = g.y; m.vy = 0; m.ground = true; m.gObj = g.obj; m.diveUsed = false; m.lastWJS = null;
      if (m.st === 'dive') { m.st = 'slide'; m.stT = 0.32; }
      if (g.obj && g.obj.slide) { const dd = g.obj.dir || [0, 1], va = m.vx * dd[0] + m.vz * dd[1]; if (va > -2 && va < 23) { const add = Math.min(18 * dt, 23 - va); m.vx += dd[0] * add; m.vz += dd[1] * add; } }
      if (g.obj && g.obj.cannon) { const cn = g.obj.cannon; m.vx = cn[0]; m.vy = cn[1]; m.vz = cn[2]; m.ground = false; m.gObj = null; if (me) { S.shake = Math.max(S.shake, 0.4); snd('boom'); shout('BOUM !', '#ff8a3d'); } emit(m.x, m.y + 0.5, m.z, 20, { cols: ['#ffcf2e', '#ff8a3d', '#ffffff'], spd: 4, up: 3, life: 0.6 }); }
      if (g.obj && g.obj.tramp) { if (me) { snd('boing'); shout('BOING !', '#ff4f9e'); fx('jump', { g: 1, rate: 0.8 }); } m.vy = TRAMP; m.ground = false; m.gObj = null; g.obj.sq = 1; emit(m.x, m.y + 0.3, m.z, 18, { cols: ['#ff4f9e', '#ffffff'], spd: 4, up: 4, life: 0.6 }); }
      if (g.obj && g.obj.crb && !g.obj.state && S.ctl) { crumbleCr(g.obj.crb - 1); if (!S.solo) BR.Net.relay({ k: 'cr', i: g.obj.crb - 1 }); }
      if (g.obj && g.obj.pi != null && S.ctl && S.teams && S.teams[m.id] != null && paintTile(g.obj.pi, S.teams[m.id], true) && me) bzEv('paint');
      if (g.obj && g.obj.tile != null && !g.obj.state && S.round === 2 && S.ctl && S.touchCrumble) { crumble(g.obj.tile); if (!S.solo) BR.Net.relay({ k: 'tl', i: g.obj.tile }); }
    } else {
      if (wasG) m.coyote = 0.11;
      m.ground = false; m.gObj = null;
    }
    // bandes d'accélération : on prend le boost même en passant au-dessus en sautant
    if (S.pads) for (const s of S.pads) { const top = s.y + s.hy, dx = m.x - s.x, dz = m.z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c; if (m.y < top - 0.6 || m.y > top + 4 || Math.abs(lx) > s.hx + 0.35 || Math.abs(lz) > s.hz + 0.35) continue;
      const dd = s.dir || [0, 1], va = m.vx * dd[0] + m.vz * dd[1];
      if (va < PAD - 0.5) { const ox = (m.vx - dd[0] * va) * 0.4, oz = (m.vz - dd[1] * va) * 0.4; m.vx = dd[0] * PAD + ox; m.vz = dd[1] * PAD + oz; if (m.st === 'slide' || m.st === 'tumble') m.st = 'run'; if (!m.padFx) { if (me) { snd('whoosh'); shout('TURBO !', '#ffe14a'); } emit(m.x, m.y + 0.2, m.z, 14, { col: '#ffe14a', spd: 3, up: 2.5, life: 0.5, vz: 10 }); } } m.padFx = 0.3; }
    // dangers
    if (S.ctl) for (const h of S.haz) { const v = h.hit(m); if (!v) continue; if (v.launch) { if (m.vy < v.y - 1) { m.vy = v.y; if (v.dir) { const va = m.vx * v.dir[0] + m.vz * v.dir[1]; if (va < v.z) { m.vx += v.dir[0] * (v.z - va); m.vz += v.dir[1] * (v.z - va); } } else m.vz = Math.max(m.vz, v.z); m.ground = false; m.gObj = null; if (m.st !== 'tumble') m.st = 'run'; if (me) snd('jet'); emit(m.x, m.y, m.z, 10, { col: '#c8efff', spd: 3, up: 4, life: 0.6 }); } continue; } knock(m, v); break; }
    // bousculade entre joueurs
    for (const p of S.players.values()) {
      if (p === m || !p.av || !p.vis) continue;
      const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
      const sepR = S.r2 === 'ile' && S.round === 2 && m.y > 1.8 && Math.hypot(m.x, m.z) < 2 ? 1.25 : 0.95;   // le poteau ne tient pas tout le monde
      if (d < sepR && d > 1e-4 && Math.abs(m.y - p.y) < 1.5) {
        m.x += dx / d * (sepR - d) * 0.6; m.z += dz / d * (sepR - d) * 0.6;
        const ps = Math.hypot(p.vx, p.vz);
        // un joueur distant qui me plonge dessus (s'il est simulé ici, c'est lui qui gère)
        if (!simHere(p) && p.st === ST.dive && ps > 8 && (m.bumpCd || 0) <= 0) { m.bumpCd = 0.7; knock(m, { x: p.vx * 0.8, y: 6, z: p.vz * 0.8 }); if (me) shout('BOUSCULÉ !', '#ff4f9e'); }
        // je plonge sur quelqu'un : c'est moi qui décide
        if (m.st === 'dive' && Math.hypot(m.vx, m.vz) > 8 && (p.hitCd || 0) <= 0) { p.hitCd = 0.8; hitPlayer(p, { x: m.vx * 0.8, y: 6, z: m.vz * 0.8 }); if (me) { snd('pop'); shout('BOUM !'); bzEv('dive'); } }
      }
    }
    m.bumpCd = Math.max(0, (m.bumpCd || 0) - dt); m.padFx = Math.max(0, (m.padFx || 0) - dt);
    // points de passage, arrivée, chute
    if (S.round === 1) {
      if (m.ground) for (let i = (m.check || 0) + 1; i < S.checks.length; i++) { const ck = S.checks[i], hit = ck.r ? Math.hypot(m.x - ck.x, m.z - ck.z) < ck.r && Math.abs(m.y - ck.y) < 3 : m.z > ck.z && Math.abs(m.y - ck.y) < 2.5; if (hit) { m.check = i; if (i > 0 && me) feed('Point de passage !'); } }
      m.prog = progOf(m); m.maxZ = Math.max(m.maxZ || 0, m.prog);
      const fb = S.finishBox, inF = fb ? (() => { const dx = m.x - fb.x, dz = m.z - fb.z, c = Math.cos(fb.ry), s = Math.sin(fb.ry), lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < fb.hx && lz > -fb.hz && lz < fb.hz + 12 && m.y > fb.y - 1.5; })() : m.z > S.finishZ && m.y > S.finishY - 1.5;
      if (!m.finished && inF) finishP(m);
    }
    const ck = S.round === 1 ? S.checks[Math.max(0, m.check || 0)] : null;
    if (m.y < (ck ? (ck.low != null ? ck.low : ck.y) - 16 : S.fallY)) {
      if (S.round === 1) respawn(m); else if (S.def.score) respawnArena(m); else eliminateP(m);
    }
  }
  function respawn(m) {
    // un bot qui tombe 3 fois au même endroit repart au point de passage suivant (la partie ne traîne pas)
    if (m.bot) { m.resp = m.lastRespCk === m.check ? (m.resp || 0) + 1 : 1; m.lastRespCk = m.check; if (m.resp >= 3 && m.check + 1 < S.checks.length) { m.check++; m.resp = 0; m.lastRespCk = m.check; } }
    const c = S.checks[Math.max(0, m.check || 0)];
    const rx = (Math.random() - 0.5) * 3; if (c.sx != null) { const rr = rgt(c.yaw || 0); m.x = c.sx + rr[0] * rx; m.z = c.sz + rr[1] * rx; m.face = c.yaw || 0; } else { m.x = c.x + rx; m.z = c.zz; m.face = 0; }
    m.y = c.y + 0.2; m.vx = m.vy = m.vz = 0; m.st = 'run'; m.ghost = 1.2; m.ground = false; m.grabbed = m.holding = null; m.zip = null;
    if (m === S.me) { S.yaw = c.yaw || 0; snd('aww'); shout('PLOUF !', '#3fd0ff'); }
  }

  /* ===================== bots ===================== */
  const BOT_NAMES = ['Bouboule', 'Mimi Fusée', 'Captain Patate', 'Gégé', 'Choupette', 'Rillette', 'Biscotte', 'Kiwi', 'Tonton Turbo', 'Mamie Glisse', 'Pépito', 'Zigzag', 'Moumoune', 'Flan Royal', 'Nugget', 'Cacahuète', 'Super Mamie', 'Le Grand Gégé'];
  function secOf(z) { let s = null; if (S.secAt) for (const x of S.secAt) { if (x.z <= z + 1) s = x; else break; } return s; }
  function botThink(b, dt) {
    const inp = { wx: 0, wz: 0, jump: false, dive: false, grab: false };
    if (!S.ctl || !b.active || (S.round === 1 && b.finished)) return inp;
    const ai = b.ai = b.ai || { t: 0, react: 0 };
    if (b.st === 'tumble') return inp;
    if (S.round === 1) raceAI(b, inp, dt); else if (S.def.score) modeAI(b, inp, dt); else if (S.bomb) bombAI(b, inp); else survAI(b, inp, dt);
    // de temps en temps : bousculer ou attraper un joueur proche
    if (!S.bomb && Math.random() < dt * 0.6 * b.skill) for (const p of S.players.values()) {
      if (p === b || !p.vis || (p.bot && Math.random() < 0.85)) continue; const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
      if (d < 2.4 && Math.abs(p.y - b.y) < 1.2) { const safe = S.round !== 2 || !ai.safe || ai.safe(b.x + dx / d * 4, b.z + dz / d * 4); if (Math.random() < 0.55 && safe) { inp.dive = true; inp.wx = dx / d; inp.wz = dz / d; } else { b.face = Math.atan2(dx, dz); inp.grab = true; } break; }
    }
    return inp;
  }
  function steer(b, inp, tx, tz, spd) { const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz) || 1; inp.wx = dx / d * spd; inp.wz = dz / d * spd; }
  // barres tournantes : la rouge (basse) se saute, la jaune (haute) non
  function barAhead(b) {
    for (const h of S.haz) {
      if (h.t !== 'sweep' || h.off) continue;
      const a2 = h.a + h.w * 0.24, dx = b.x - h.cx, dz = b.z - h.cz, c = Math.cos(a2), s = Math.sin(a2);
      if (Math.abs(dx * c - dz * s) < h.L && Math.abs(dx * s + dz * c) < 1.3) return h.yb < b.y + 1 ? 'low' : 'high';
    }
    return null;
  }
  function raceAI(b, inp, dt) {
    if (S.pathMode) return pathAI(b, inp, dt);
    const ai = b.ai, sec = secOf(b.z), k = sec ? sec.k : '', spd = 0.86 + 0.14 * b.skill;
    let tx = b.lane, go = 1;
    if (k === 'canons') tx = ai.can != null ? ai.can : (ai.can = [-4.5, 0, 4.5][Math.floor(Math.random() * 3)]);
    else if (k === 'geysers') tx = Math.max(-4, Math.min(4, Math.round(b.lane / 4) * 4));
    else if (k === 'ventilos') { const f = S.winds.find(w => w.z > b.z - 3); if (f) tx = f.x; }
    else if (k === 'murs') { const ws = S.solids.filter(s => s.move && Math.abs(s.hz - 0.65) < 0.01 && s.z > b.z - 0.5 && s.z < b.z + 13 && s.y + s.hy > b.y + 1).sort((a, c) => a.z - c.z);
      if (ws.length) { const z1 = ws[0].z, pr = ws.filter(s => Math.abs(s.z - z1) < 0.1).sort((a, c) => a.x - c.x); tx = pr.length === 2 ? (pr[0].x + pr[0].hx + pr[1].x - pr[1].hx) / 2 : pr[0].x > 0 ? pr[0].x - pr[0].hx - 1.9 : pr[0].x + pr[0].hx + 1.9; } }
    else if (k === 'mur' || k === 'couloir' || k === 'zigzag') {
      if (b.st === 'wall') { tx = b.x - b.wallN[0] * 2; if (k === 'zigzag' && b.wrT > 0.28 + (1 - b.skill) * 0.15) inp.jump = true; }
      else { const wl = S.solids.filter(s => s.wr && s !== b.lastWJS && s.z + s.hz > b.z + 1 && s.z - s.hz < b.z + 16).sort((a, c) => Math.abs(a.z - b.z) - Math.abs(c.z - b.z))[0];
        if (wl && (!b.ground || wl.z - wl.hz < b.z + 4)) tx = wl.x * 1.4; }
    }
    else if (k === 'marteaux') {   // attendre que la tête soit passée (et qu'elle s'éloigne), puis foncer ; ne jamais s'arrêter dessous
      for (const h of S.haz) { if (h.pz == null) continue; const dz = h.pz - b.z; if (dz < 1.6 || dz > 5.5) continue;
        const hx = h.px + h.len * Math.sin(h.a), away = Math.sign(h.da || 1) * (hx - b.x) > 0; if (Math.abs(hx - b.x) < 3.2 || (!away && Math.abs(hx - b.x) < 8)) go = 0; } }
    if (k === 'mixeur' || k === 'marteaux') { const bar = barAhead(b); if (bar === 'low' && b.ground) inp.jump = true; }
    if (go) steer(b, inp, tx, b.z + 8, spd);
    // bords : sauter (mais attendre la nacelle sur la grande roue)
    const gx = b.x + inp.wx * 2.2, gz = b.z + Math.max(1.6, inp.wz * 2.4), g = groundAt(gx, gz, b.y + 0.3), gap = !isFinite(g.y) || g.y < b.y - 1.2;
    if (b.ground && gap && go) {
      if (k === 'roue') { inp.wx = inp.wz = 0; }
      else if (k === 'canons') { /* le canon s'en charge */ }
      else if (Math.random() < 0.55 + 0.45 * b.skill) inp.jump = true;
    }
    // plongeon pour allonger un saut quand il n'y a rien dessous
    if (!b.ground && b.vy < 0.5 && !b.diveUsed && b.st === 'run' && k !== 'mur' && k !== 'couloir' && k !== 'zigzag' && k !== 'ventilos' && k !== 'canons') { const gb = groundAt(b.x, b.z + 3, b.y); if (!isFinite(gb.y) || gb.y < b.y - 5) inp.dive = true; }
  }
  function pathAI(b, inp, dt) {
    if (b.st === 'zip') return;
    const d = b.prog != null ? b.prog : pathProg(b.x, b.y, b.z), here = pathAt(d), tg = pathAt(d + 6), fx0 = tg.x - here.x, fz0 = tg.z - here.z, l = Math.hypot(fx0, fz0) || 1;
    const lane = b.lane * 0.35, tx = tg.x + fz0 / l * lane, tz = tg.z - fx0 / l * lane;
    steer(b, inp, tx, tz, 0.86 + 0.14 * b.skill);
    if (barAhead(b) === 'low' && b.ground && Math.random() < 0.6 + 0.4 * b.skill) inp.jump = true;
    // plateformes qui clignotent : attendre que la suivante reste allumée assez longtemps
    let blinkWait = false;
    if (b.ground) { const rem = s => { const B = s.blink, u = (((S.rt + B.ph) % B.per) + B.per) % B.per / B.per; return u < B.on ? (B.on - u) * B.per : -(1 - u) * B.per; };
      const hx = inp.wx, hz = inp.wz, hl = Math.hypot(hx, hz) || 1; let nb = null, bd = 7;
      for (const s of S.solids) { if (!s.blink || s === b.gObj) continue; const dx = s.x - b.x, dz = s.z - b.z, al = (dx * hx + dz * hz) / hl, d = Math.hypot(dx, dz); if (al > 1.5 && d < bd && Math.abs(s.y + s.hy - b.y) < 1.5) { bd = d; nb = s; } }
      if (nb && rem(nb) < 0.8) { const rc = b.gObj && b.gObj.blink ? rem(b.gObj) : 9; if (rc > 0.4) { blinkWait = true; inp.wx = inp.wz = 0; } } }
    const g = groundAt(b.x + inp.wx * 2.2, b.z + inp.wz * 2.2, b.y + 0.3), gap = !isFinite(g.y) || g.y < b.y - 1.2;
    if (b.ground && gap && !blinkWait) { if (here.wait || tg.wait) { inp.wx = inp.wz = 0; } else if (!here.nojump && !tg.nojump && Math.random() < 0.55 + 0.45 * b.skill) inp.jump = true; }
    if (!b.ground && b.vy < 0.5 && !b.diveUsed && b.st === 'run' && !here.nodive && !tg.nodive && !here.nojump) { const gb = groundAt(b.x + inp.wx * 3, b.z + inp.wz * 3, b.y); if (!isFinite(gb.y) || gb.y < b.y - 5) inp.dive = true; }
  }
  function survAI(b, inp, dt) {
    const ai = b.ai; ai.t -= dt;
    const onTile = (x, z) => { const g = groundAt(x, z, b.y + 0.3); return isFinite(g.y) && g.y > b.y - 1.2 && !(g.obj && g.obj.state); };
    const hasGround = (x, z) => { const g = groundAt(x, z, b.y + 0.3); return isFinite(g.y) && g.y > b.y - 1.2 && !(g.obj && g.obj.state === 2); };
    const RM = S.r2 === 'ile' ? 6 : 10;
    if (S.r2 === 'ile') { const dC = Math.hypot(b.x, b.z), el = S.rt - S.goAt;
      if (b.y > 1.8 && dC < 1.9) { if (dC > 0.5) steer(b, inp, 0, 0, 0.25);   // roi du poteau : on pousse les autres dans le vide
        if ((b.shoveCd = (b.shoveCd || 0) - dt) <= 0) { b.shoveCd = 1 + Math.random() * 1.4; for (const p of S.players.values()) { if (p === b || !p.vis || !p.av) continue; const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1; if (d < 1.7 && Math.abs(p.y - b.y) < 1 && Math.random() < 0.3 + 0.45 * b.skill) { b.face = Math.atan2(dx, dz); b.grabT = 0.45; hitPlayer(p, { x: dx / d * 8.5, y: 5, z: dz / d * 8.5 }); break; } } }
        return; }
      if (dC < 7 || el > 14 + 10 * (1 - b.skill)) { steer(b, inp, 0, 0, 0.7); if (dC < 2.8 && b.ground) inp.jump = true; const br = barAhead(b); if (br === 'low' && b.ground) inp.jump = true; return; } }
    if (ai.R == null) { ai.R = 3 + Math.random() * (RM - 4); ai.dir = Math.random() < 0.5 ? 1 : -1; }
    // on tourne en rond (comme un vrai joueur : ne jamais rester sur une dalle qui s'effrite)
    const ang = Math.atan2(b.z, b.x) + ai.dir * 0.75;
    let tx = Math.cos(ang) * ai.R, tz = Math.sin(ang) * ai.R;
    if (!onTile(tx, tz) || (ai.t <= 0 && Math.random() < 0.25)) {   // le cercle est cassé : on en cherche un autre
      let best = null, bs = 1e9;
      for (let i = 0; i < 16; i++) { const r = Math.random() * RM, a = Math.random() * 6.283, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!onTile(x, z)) continue; const sc = Math.hypot(x - b.x, z - b.z) + r * 0.5; if (sc < bs) { bs = sc; best = [x, z, r]; } }
      if (best) { tx = best[0]; tz = best[1]; ai.R = Math.max(2.5, best[2]); if (Math.random() < 0.3) ai.dir = -ai.dir; }
      ai.t = 1 + Math.random();
    }
    steer(b, inp, tx, tz, 0.5 + 0.25 * b.skill);
    // jamais vers le vide
    if (b.ground && !hasGround(b.x + inp.wx * 1.9, b.z + inp.wz * 1.9)) { inp.wx = -inp.wx * 0.6; inp.wz = -inp.wz * 0.6; ai.t = 0; }
    const bar = barAhead(b);
    if (bar === 'low' && b.ground && Math.random() < 0.6 + 0.4 * b.skill) inp.jump = true;
    ai.safe = hasGround;
  }
  function makeBots(seed) {
    const r = rng(seed + 77), have = S.players.size, n = Math.max(0, 8 - have), skins = (BR.SKINS || []).map(s => s.id).filter(Boolean), names = BOT_NAMES.slice();
    for (let i = 0; i < n; i++) {
      const nm = names.splice(Math.floor(r() * names.length), 1)[0] || ('Bot ' + (i + 1)), id = 'bot' + (i + 1);
      S.players.set(id, { id, name: nm, bot: true, skill: 0.55 + r() * 0.45, lane: (r() - 0.5) * 3.6, look: { skin: skins.length ? skins[Math.floor(r() * skins.length)] : 'survivor', aura: null },
        x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, vx: 0, vy: 0, vz: 0, face: 0, tf: 0, st: 'run', ground: false, active: true, jbuf: 0, coyote: 0, ghost: 0, diveUsed: false, stT: 0 });
    }
  }

  /* ===================== joueurs ===================== */
  const RK_ICO = ['🥉', '🥈', '🥇', '💠', '💎', '🔮', '👑'];
  const tagTxt = p => (p.rk ? p.rk + ' ' : '') + p.name + (p.crowns ? ' 👑' + p.crowns : '');
  function retag(p) { if (!p.tag) return; const par = p.tag.sprite.parent; if (par) par.remove(p.tag.sprite); p.tag.tex.dispose(); p.tag.sprite.material.dispose(); p.tag = nameTag(tagTxt(p), p === S.me); }
  function nameTag(name, me) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.strokeStyle = 'rgba(30,20,70,0.85)'; g.strokeText(name, 256, 64); g.fillStyle = me ? '#ffe14a' : '#fff'; g.fillText(name, 256, 64);
    const t = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); sp.scale.set(1.8, 0.45, 1); sp.renderOrder = 10;
    return { sprite: sp, tex: t };
  }
  function makeAvatars() {
    for (const p of S.players.values()) {
      if (p.av) continue;
      p.av = BR.Avatar.build(p.look); p.av.group.rotation.order = 'YXZ';
      p.av.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
      if (p === S.me) { p.crowns = P.progress().crowns; const b = BZ(); p.hat = b.hat || ''; p.trail = b.trail || ''; }
      else if (p.bot) { const hk = Object.keys(HATS).filter(k => k !== 'couronne' && k !== 'diademe'), h = (p.id.charCodeAt(p.id.length - 1) * 7 + S.seed) % (hk.length + 3); p.hat = hk[h] || ''; }
      if (p.hat) try { putHat(p, p.hat); } catch (e) {}
      if (p === S.me && BR.Net && BR.Net.rk && BR.Net.rk.g) p.rk = P.tier(BR.Net.rk.rp).ico;
      p.tag = nameTag(tagTxt(p), p === S.me);
    }
  }
  function placeAll(list) {
    const ids = [...S.players.keys()].filter(id => list.includes(id));
    ids.forEach((id, i) => {
      const p = S.players.get(id), sp = S.spawnFor ? S.spawnFor(id) : S.spawns[i % S.spawns.length];
      p.x = p.tx = sp.x; p.y = p.ty = sp.y + 0.05; p.z = p.tz = sp.z; p.vx = p.vy = p.vz = 0;
      p.face = p.tf = S.round === 2 ? Math.atan2(-sp.x, -sp.z) : 0;
    });
  }
  function updateAvatars(dt) {
    for (const p of S.players.values()) {
      const av = p.av; if (!av) continue;
      trailTick(p, dt); if (av.hat && av.hat.userData.spin) av.hat.userData.spin.rotation.y += dt * 14;
      if (simHere(p)) {
        p.vis = p.active; p.stc = p.st === 'run' && !p.ground ? ST.air : ST[p.st] != null ? ST[p.st] : 0;
      } else {
        const ax = p.tx + p.vx * 0.05, az = p.tz + p.vz * 0.05, dx = ax - p.x, dz = az - p.z, dy = p.ty - p.y;
        if (Math.hypot(dx, dz) > 8 || Math.abs(dy) > 5) { p.x = p.tx; p.z = p.tz; p.y = p.ty; }
        else { const k = Math.min(1, dt * 14); p.x += dx * k; p.z += dz * k; p.y += dy * Math.min(1, dt * 16); }
        p.face += BR.angDiff(p.face, p.tf) * Math.min(1, dt * 14);
        p.vis = p.st !== ST.spec && S.part.includes(p.id) && !S.out.has(p.id); if (S.round === 1 && S.pathMode && Math.random() < 0.2) p.prog = progOf(p);
        p.stc = p.st;
      }
      const g = av.group, sc = p.stc;
      g.visible = p.vis; p.tag.sprite.visible = p.vis;
      if (!p.vis) continue;
      if (!g.parent) S.scene.add(g); if (!p.tag.sprite.parent) S.scene.add(p.tag.sprite);
      g.position.set(p.x, p.y, p.z); g.rotation.y = p.face;
      // poses : plongeon (à plat ventre), glissade, culbute
      p.tilt = p.tilt || 0; p.roll = p.roll || 0;
      let tilt = 0;
      if (sc === ST.dive) tilt = 1.25; else if (sc === ST.slide) tilt = 1.45;
      // course murale : les pieds contre le mur, le corps penché vers le vide (rotation autour de l'axe de course)
      const side = sc === ST.wall || sc === 6 ? (simHere(p) ? p.wallSide || 1 : sc === 6 ? -1 : 1) : 0;
      if (side) p.wside = side;
      p.wallK = (p.wallK || 0) + ((side ? 1 : 0) - (p.wallK || 0)) * Math.min(1, dt * 14);
      const ws = p.wside || 1, nx = ws * Math.cos(p.face), nz = -ws * Math.sin(p.face), wk = p.wallK;
      g.position.x -= nx * 0.44 * wk; g.position.z -= nz * 0.44 * wk; g.position.y += 0.3 * wk;
      g.rotation.z = -ws * 1.08 * wk;
      // poussière / étincelles
      p.dustT = (p.dustT || 0) - dt; const spd = Math.hypot(p.vx, p.vz);
      if (p.dustT <= 0) {
        if (side) { emit(p.x - nx * 0.5, p.y + 0.3, p.z - nz * 0.5, 2, { cols: ['#ffffff', '#ff8ac2'], spd: 1.2, up: 0.8, life: 0.4, grav: 2 }); p.dustT = 0.04; }
        else if (sc === ST.run && spd > 7 && (p !== S.me || p.ground)) { emit(p.x, p.y + 0.08, p.z, 1, { col: '#f2eeff', spd: 1, up: 0.9, life: 0.4, grav: 1.5 }); p.dustT = 0.06; }
        else if (sc === ST.slide) { emit(p.x, p.y + 0.1, p.z, 2, { col: '#ffffff', spd: 2, up: 1, life: 0.35 }); p.dustT = 0.04; }
      }
      // écrasement à l'atterrissage, étirement au saut
      if (p.prevSc === ST.air && (sc === ST.run || sc === ST.slide)) p.sq = 0.24;
      else if ((p.prevSc === ST.run || p.prevSc == null) && sc === ST.air && p.vy > 5) p.sq = -0.16;
      p.prevSc = sc; p.sq = (p.sq || 0) * Math.max(0, 1 - dt * 9); g.scale.set(1 + p.sq * 0.6, 1 - p.sq, 1 + p.sq * 0.6);
      if (sc === ST.tumble) { p.roll += dt * 13; g.rotation.x = p.roll; g.position.y += 0.6; }
      else { p.roll = 0; p.tilt += (tilt - p.tilt) * Math.min(1, dt * 14); g.rotation.x = p.tilt; if (p.tilt > 0.3) g.position.y += 0.25 * Math.min(1, p.tilt); }
      const sp = Math.hypot(p.vx, p.vz), air = sc === ST.air || sc === ST.dive || sc === 7 || (p === S.me && !p.ground && sc === ST.run && !side);
      if (simHere(p)) p.grabVis = p.grabT > 0 || !!p.holding;
      if (p.prevSc2 !== ST.tumble && sc === ST.tumble) { try { av.act('Hit_A', { speed: 1.5 }); } catch (e) {} } p.prevSc2 = sc;
      poseRestore(p);
      av.update(dt, sp, { air: air || sc === ST.tumble, sprint: sp > 7, dash: false });
      applyPose(p, sc, dt);
      p.hitCd = Math.max(0, (p.hitCd || 0) - dt);
      p.tag.sprite.position.set(p.x, p.y + 2.25, p.z);
    }
  }

  /* ===================== caméra ===================== */
  function trackY(z) {
    const pts = S.trackPts; if (!pts || !pts.length) return 0;
    if (z <= pts[0].z) return pts[0].y;
    for (let i = 1; i < pts.length; i++) if (z < pts[i].z) { const a = pts[i - 1], b = pts[i], k = (z - a.z) / (b.z - a.z); return a.y + (b.y - a.y) * k; }
    return pts[pts.length - 1].y;
  }
  function introCam(u) {
    const e = u * u * (3 - 2 * u);
    let x, y, z, lx, ly, lz;
    if (S.round === 1 && S.pathMode && S.path.length > 1) {
      const tot = S.path[S.path.length - 1].d, a = pathAt(e * tot), b = pathAt(Math.min(tot, e * tot + 8)), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, la = pathAt(Math.min(tot, e * tot + 22));
      x = a.x - dx / l * 12 + dz / l * 6; z = a.z - dz / l * 12 - dx / l * 6; y = a.y + 10; lx = la.x; ly = la.y; lz = la.z;
    } else if (S.round === 1) {
      z = -25 + (S.finishZ + 12 + 25) * e; x = 14 * Math.sin(u * Math.PI * 2.1); y = trackY(z + 25) + 9 + 6 * Math.sin(u * Math.PI);
      lz = z + 32; lx = 0; ly = trackY(lz) + 1;
    } else {
      const a = u * Math.PI * 1.25 + 0.7, R0 = 36 - 14 * u; x = Math.cos(a) * R0; z = Math.sin(a) * R0; y = 24 - 12 * u; lx = 0; ly = 0; lz = 0;
    }
    S.cam.position.set(x, y, z); S.cam.lookAt(lx, ly, lz); S.cam.fov = 72; S.cam.updateProjectionMatrix();
    if (S.sun) { S.sun.position.set(lx - 30, ly + 60, lz - 20); S.sun.target.position.set(lx, ly, lz); }
    if (S.skyM) S.skyM.position.set(x, 0, z);
    if (S.seaM) { S.seaM.position.x = x; S.seaM.position.z = z; }
  }
  function flash() { DOM.flash.classList.add('on'); void DOM.flash.offsetWidth; requestAnimationFrame(() => DOM && DOM.flash.classList.remove('on')); }
  // la caméra ne traverse pas les murs : on la rapproche avant le premier obstacle
  function camBlocked(x, y, z) {
    for (const s of S.solids) {
      if (s.t === 'box') { if (s.dead || y > s.y + s.hy || y < s.y - s.hy) continue; const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c; if (Math.abs(lx) < s.hx + 0.2 && Math.abs(lz) < s.hz + 0.2) return true; }
      else if (s.t === 'cyl') { if (y > s.y1 || y < s.y0) continue; if (Math.hypot(x - s.x, z - s.z) < s.r + 0.2) return true; }
      else if (s.t === 'disc') { if (y > s.y || y < s.y - s.h) continue; if (Math.hypot(x - s.x, z - s.z) < s.r + 0.2) return true; }
    }
    return false;
  }
  function updateCam(dt) {
    let tg = S.me;
    if (!S.me.active) {
      const alive = [...S.players.values()].filter(p => p !== S.me && p.vis);
      if (alive.length) { S.specI = ((S.specI || 0) % alive.length + alive.length) % alive.length; tg = alive[S.specI]; }
    }
    // recentrage automatique derrière le joueur quand il court et qu'on ne touche pas à la souris
    const spd = Math.hypot(tg.vx, tg.vz);
    if (tg === S.me && S.rt - (S.lastLook || 0) > 1.2 && spd > 5 && S.me.st !== 'wall') S.yaw += BR.angDiff(S.yaw, Math.atan2(tg.vx, tg.vz)) * Math.min(1, dt * 1.6);
    const tx = tg.x, ty = tg.y + 1.6, tz = tg.z;
    let d = 7.6 + clamp(spd - 12, 0, 12) * 0.16;
    const cp = Math.cos(S.pitch), ux = -Math.sin(S.yaw) * cp, uy = Math.sin(S.pitch), uz = -Math.cos(S.yaw) * cp;
    for (let k = 0.8; k < d; k += 0.4) if (camBlocked(tx + ux * k, ty + uy * k, tz + uz * k)) { d = Math.max(1.4, k - 0.5); break; }
    const x = tx + ux * d, y = ty + uy * d, z = tz + uz * d;
    const kk = Math.min(1, dt * 12), near = d < S.camD - 0.3; S.camD = d;
    if (near) { S.camP.set(x, y, z); } else { S.camP.x += (x - S.camP.x) * kk; S.camP.y += (y - S.camP.y) * Math.min(1, dt * 8); S.camP.z += (z - S.camP.z) * kk; }
    S.shake = Math.max(0, S.shake - dt * 1.6); const sh = S.shake * S.shake * 0.6 * (BR.settings.shake != null ? BR.settings.shake : 1);
    S.cam.position.set(S.camP.x + (Math.random() - 0.5) * sh, S.camP.y + (Math.random() - 0.5) * sh, S.camP.z + (Math.random() - 0.5) * sh);
    S.cam.lookAt(tx, ty, tz);
    S.cam.fov += (68 + clamp(spd - 12, 0, 12) * 0.8 - S.cam.fov) * Math.min(1, dt * 5); S.cam.updateProjectionMatrix();
    if (S.sun) { S.sun.position.set(tx - 30, ty + 60, tz - 20); S.sun.target.position.set(tx, ty, tz); }
    if (S.skyM) S.skyM.position.set(tx, 0, tz);
    if (S.seaM) { S.seaM.position.x = tx; S.seaM.position.z = tz; }
  }

  /* ===================== déroulé de la partie : 4 manches avec éliminations ===================== */
  const RACE_DEF = { name: 'LA COURSE', sub: 'Les premiers arrivés sont qualifiés ! Saute contre un mur pour courir dessus.', time: 150 };
  function clearWorld() {
    if (!S.scene) return;
    for (const p of S.players.values()) { if (p.av) S.scene.remove(p.av.group); if (p.tag) S.scene.remove(p.tag.sprite); }
    S.disp.forEach(x => x.dispose && x.dispose()); S.disp = [];
    S.scene = null;
  }
  // nombre de manches restantes (pour l'affichage « manche 2 / 4 »)
  function planLen(n, type) { let k = 0; while (n > 1 && k < 9) { k++; if (n <= 2) break; if (type === 'race') { n = Math.max(2, Math.min(n - 1, Math.round(n * 0.66))); type = 'surv'; } else { n = Math.max(1, Math.ceil(n / 2)); type = 'race'; } } return k; }
  function startRound(cfg) {
    clearWorld();
    S.cfg = cfg; S.rn = cfg.rn; S.final = !!cfg.final; S.seed = cfg.seed >>> 0; S.target = cfg.target;
    S.round = cfg.type === 'race' ? 1 : 2;
    if (S.round === 2) { S.r2 = cfg.kind; S.def = Object.assign({}, R2[S.r2], { time: R2[S.r2].score ? R2[S.r2].time + (S.final ? 15 : 0) : S.final ? 90 : 75 }); S.usedR2.push(cfg.kind); try { BR.store.set('br_party_r2', S.r2); } catch (e) {} }
    else { S.def = RACE_DEF; S.usedMaps.push(cfg.map); }
    S.high = S.low = null; S.part = cfg.q.filter(id => S.players.has(id)); S.out = new Set(); S.outOrder = []; S.fin = []; S.decided = false; S.tiles = null; S.tramps = [];
    S.scene = new THREE.Scene(); S.solids = []; S.haz = []; S.checks = []; S.scroll = []; S.anim = []; S.winds = []; S.pads = []; S.zips = []; S.crs = []; S.path = []; S.pathMode = false; S.finishBox = null; S.gyB = S.gyG = S.canG = S.bulb = null; S.bob = []; S.cloudTex = null; S.seaM = null; S.post = S.flag = S.fanG = S.pine = S.trunk = S.leaf = S.tower = S.troof = S.pole = S.umb = null; S.crown = S.paint = S.teams = S.spawnFor = S.bomb = S.hill = S.ball = null; S.ctime = {}; S.csT = 0; S.goals = [0, 0]; S.ggT = 0;
    initFx();
    if (S.round === 1) buildCourse(cfg.map); else buildSpin(S.r2);
    if (S.round === 1 && !S.pathMode) S.checks.sort((a, b) => a.z - b.z);
    placeAll(S.part);
    for (const p of S.players.values()) {
      p.active = S.part.includes(p.id); p.finished = false; p.st = simHere(p) ? 'run' : 0; p.ground = false; p.ghost = 0; p.maxZ = 0; p.jbuf = 0; p.check = 0;
      p.grabbed = p.holding = null; p.ai = null; p.wallExit = 0; p.vis = p.active;
    }
    const m = S.me;
    S.yaw = S.round === 2 ? Math.atan2(-m.x, -m.z) : 0; S.pitch = 0.32; S.camP = new THREE.Vector3(m.x - Math.sin(S.yaw) * 8, m.y + 4, m.z - Math.cos(S.yaw) * 8); S.camD = 7.6;
    S.trackPts = S.round === 1 ? S.secAt.map(s => ({ z: s.z, y: s.y })).concat([{ z: S.finishZ, y: S.finishY }]) : null;
    S.introT = S.round === 1 ? 5 : 3.4; S.introDone = false;
    S.rt = 0; S.goAt = S.introT + 3.2; S.ctl = false; S.endAt = null; S.cd = 0;
    const tot = S.rn - 1 + planLen(S.part.length, cfg.type), nm = S.round === 1 && S.map ? S.map.name : S.def.name;
    DOM.title.textContent = 'MANCHE ' + S.rn + ' / ' + tot + ' · ' + nm; DOM.sub.textContent = S.def.sub;
    DOM.iTag.textContent = (S.final ? 'FINALE' : 'MANCHE ' + S.rn + ' / ' + tot) + ' · ' + (S.round === 1 ? 'COURSE' : 'SURVIE');
    DOM.iName.textContent = nm; DOM.iSub.textContent = S.round === 1 && S.map ? S.map.desc + ' — ' + S.def.sub : S.def.sub;
    const goal = S.round === 1 ? 'Les ' + S.target + ' premiers arrivés sont qualifiés (sur ' + S.part.length + ')' : S.def.score === 'foot' ? 'Tu es chez les ' + TEAMS[S.teams[S.selfId] || 0].n + ' ' + TEAMS[S.teams[S.selfId] || 0].e + ' : marque dans le but de l\'autre couleur !' : S.def.score === 'hill' ? (S.final ? 'Celui qui reste le plus longtemps dans la zone gagne 👑' : 'Les ' + S.target + ' meilleurs scores sont qualifiés') : S.def.score === 'crown' ? (S.final ? 'Celui qui garde la couronne le plus longtemps gagne 👑' : 'Les ' + S.target + ' qui l\'ont gardée le plus longtemps sont qualifiés') : S.def.score === 'team' ? 'Tu es chez les ' + TEAMS[S.teams[S.selfId] || 0].n + ' ' + TEAMS[S.teams[S.selfId] || 0].e + ' : peins plus que l\'autre équipe !' : S.final ? 'Le dernier debout gagne la couronne 👑' : 'Qualifiés dès qu\'il ne reste que ' + S.target + ' joueurs debout (sur ' + S.part.length + ')';
    DOM.iSkip.textContent = goal + (S.solo ? ' · Espace : passer' : '');
    DOM.intro.classList.remove('on'); void DOM.intro.offsetWidth; DOM.intro.classList.add('on'); DOM.big.classList.remove('on'); DOM.root.classList.add('intro');
    if (!m.active) setTimeout(() => S && big('SPECTATEUR', 'Clique pour changer de joueur', 1800), (S.introT + 0.6) * 1000);
    try { Au.track('music', '', 0); } catch (e) {} musicStart(S.seed + S.rn * 101, S.round === 1 ? 130 : S.final ? 150 : 142);
    if (S.solo === false && S.rn === 1) BR.Net.relay({ k: 'hi', c: P.progress().crowns, h: S.me.hat || '', tr: S.me.trail || '', rk: S.me.rk || '' });
    paintList();
  }

  /* ---------- DÉFI DU JOUR : une carte imposée, seul contre le chrono, classement mondial du jour ---------- */
  const dayKey = () => new Date().toISOString().slice(0, 10);
  P.dailyMap = () => { const pm = P.pathMaps(), d = dayKey(); let h = 0; for (const c of d) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0; return pm[h % pm.length]; };
  P.dailyInfo = () => { const b = BZ(), dj = b.dj && b.dj.day === dayKey() ? b.dj : null, mi = P.dailyMap(); return { map: mi, name: MAPS[mi].name, best: dj ? dj.t / 10 : 0, tries: dj ? dj.n || 0 : 0 }; };
  function trialEnd(t) {
    if (S.results || t < 5) return; S.results = true; S.ctl = false; unlock();
    const b = BZ(), d = dayKey(); let best = false;
    if (!b.dj || b.dj.day !== d) b.dj = { day: d, t: 0, m: S.mapIdx, n: 0 };
    b.dj.n = (b.dj.n || 0) + 1; const tt = Math.round(t * 10); if (!b.dj.t || tt < b.dj.t) { b.dj.t = tt; best = true; }
    if (best) { passXp(30); bzEv('trial'); }
    try { BR.Account.save(true); } catch (e) {}
    snd('cheer'); sfx(best ? 'buy' : 'click');
    DOM.card.innerHTML = `<h2>⏱ DÉFI DU JOUR</h2><p>${BR.esc(MAPS[S.mapIdx].name)}</p><div class="pt-gain" style="font-size:30px;color:#7a6cff">${fmt(t)}</div>
      <p>${best ? '🏆 Nouveau meilleur temps du jour !' : 'Ton record du jour : <b>' + fmt(b.dj.t / 10) + '</b>'} · essai n° ${b.dj.n}</p>
      <div class="pt-lb"><b>Classement du jour</b><div class="pt-lbl">Chargement…</div></div>
      <div class="pt-b"><button data-a="trial">Réessayer</button><button class="alt" data-a="menu">Menu</button></div>`;
    DOM.panel.classList.add('on');
    DOM.card.querySelectorAll('button').forEach(bt => bt.addEventListener('click', () => { sfx('click'); const a = bt.dataset.a, cb = S.o.onEnd; P.stop(); if (cb) cb(a); }));
    const fill = j => { const el = DOM && DOM.card.querySelector('.pt-lbl'); if (!el) return; const L = (j && j.bzDay && j.bzDay.day === d ? j.bzDay.top : []) || []; const me = (BR.Account.p.name || '').toLowerCase();
      el.innerHTML = L.length ? L.slice(0, 8).map((e, i) => `<div class="${e.name.toLowerCase() === me ? 'me' : ''}"><span>${i + 1}. ${BR.esc(e.name)}</span><b>${fmt(e.t / 10)}</b></div>`).join('') : '<i>Personne encore… ' + (BR.Account.logged ? 'ton temps arrive dans le classement dès la sauvegarde.' : 'crée un compte pour y apparaître !') + '</i>'; };
    setTimeout(() => { try { BR.Net.api('/api/leaderboard', { retries: 1, timeout: 20000 }).then(fill).catch(() => fill(null)); } catch (e) { fill(null); } }, 1500);
  }
  function finishP(m) {
    if (m.finished || S.round !== 1) return; m.finished = true; const t = S.rt - S.goAt;
    if (m === S.me) {
      snd('cheer'); S.excite = 1.2; sfx('buy'); emit(m.x, m.y + 1, m.z, 160, { cols: CONF, spd: 7, up: 9, life: 2.2, grav: 7, spread: 3 });
      try { m.av.act('Cheer', { speed: 1 }); } catch (e) {}
      const rec = recordMap(t); S.newBest = rec.best; S.mapT = t;
      if (S.o.trial) { trialEnd(t); return; }
      const k = S.fin.length + 1; if (k <= 3) bzEv('top3'); big('QUALIFIÉ !', k + (k === 1 ? 'er' : 'e') + ' · ' + fmt(t) + (S.newBest ? ' · RECORD' : ''), 2400);
      try { BR.Account.save(); } catch (e) {}
    }
    if (!S.solo) BR.Net.relay(m === S.me ? { k: 'fin', t } : { k: 'fin', t, id: m.id });
    onFin(m.id, t);
  }
  function onFin(id, t) {
    if (S.round !== 1 || S.fin.some(f => f.id === id)) return; S.fin.push({ id, t }); const p = S.players.get(id);
    if (p) { p.finished = true; if (id !== S.selfId) { feed(p.name + ' est qualifié(e) !'); try { p.av.act('Cheer'); } catch (e) {} emit(p.x, p.y + 1, p.z, 50, { cols: CONF, spd: 6, up: 8, life: 1.6, grav: 7, spread: 2 }); if (Math.hypot(p.x - S.me.x, p.z - S.me.z) < 40) snd('cheer'); } }
    paintList();
  }
  function eliminateP(m) {
    if (!m.active) return;
    m.active = false; m.vx = m.vy = m.vz = 0;
    if (m === S.me) { S.shake = 0.5; snd('aww'); big('ÉLIMINÉ', S.solo ? '' : 'Regarde la fin de la partie', 2000); }
    if (!S.solo) BR.Net.relay(m === S.me ? { k: 'out' } : { k: 'out', id: m.id });
    onOut(m.id);
  }
  function onOut(id) { if (S.out.has(id)) return; S.out.add(id); S.outOrder.push(id); const p = S.players.get(id); if (p) { p.active = false; if (id !== S.selfId) feed(p.name + ' est tombé(e) !'); } paintList(); }
  function paintPos() {
    let t = '';
    if (S.ctl && !S.results) {
      const m = S.me;
      if (S.round === 1) {
        if (m.finished) { const k = S.fin.findIndex(f => f.id === S.selfId) + 1; t = 'Qualifié · ' + k + (k === 1 ? 'er' : 'e'); }
        else if (m.active) { let k = 1 + S.fin.length; const mp = m.prog != null ? m.prog : m.z; for (const p of S.players.values()) if (p !== m && S.part.includes(p.id) && !p.finished && (p.prog != null ? p.prog : p.z) > mp) k++; t = k + (k === 1 ? 'er' : 'e') + ' / ' + S.part.length + ' · ' + S.fin.length + ' / ' + S.target + ' qualifiés'; }
        else t = S.fin.length + ' / ' + S.target + ' qualifiés';
      } else if (S.def.score === 'crown' || S.def.score === 'hill') { const rk = S.part.filter(id => S.players.has(id)).sort((a, b) => (S.ctime[b] || 0) - (S.ctime[a] || 0)), k = rk.indexOf(S.selfId) + 1; t = '👑 ' + (S.ctime[S.selfId] || 0).toFixed(1) + ' s · ' + (k ? k + (k === 1 ? 'er' : 'e') : '') + (S.final ? '' : ' · qualifiés : top ' + S.target); }
      else if (S.def.score === 'foot') { const mt = S.teams[S.selfId] || 0; t = TEAMS[0].e + ' ' + S.goals[0] + '  —  ' + S.goals[1] + ' ' + TEAMS[1].e + ' · ' + TEAMS[mt].n + (mt === 0 ? ' →' : ' ←'); }
      else if (S.def.score === 'team') { const c = paintCount(), tot = (S.paint.length || 1), mt = S.teams[S.selfId] || 0; t = TEAMS[0].e + ' ' + Math.round(c[0] / tot * 100) + ' %  —  ' + Math.round(c[1] / tot * 100) + ' % ' + TEAMS[1].e + ' · tu es ' + TEAMS[mt].n; }
      else { const a = S.part.filter(id => S.players.has(id) && !S.out.has(id)).length; t = (S.bomb && S.bomb.h.length ? '💣 ' + Math.max(0, S.bomb.t).toFixed(1) + ' s' + (S.bomb.h.includes(S.selfId) ? ' · TU L\'AS !' : '') + ' · ' : '') + 'Debout : ' + a + (S.final ? '' : ' · qualifiés à ' + S.target); }
    }
    if (t !== S.posTxt) { S.posTxt = t; DOM.pos.textContent = t; }
    const gc = S.me.grabCd || 0, gt = !S.ctl || !S.me.active ? '' : gc > 0 ? '✋ ' + gc.toFixed(1) + ' s' : '✋ Attraper : clic gauche';
    if (gt !== S.grabTxt) { S.grabTxt = gt; DOM.grab.textContent = gt; DOM.grab.classList.toggle('ok', gc <= 0); DOM.grab.style.display = gt ? '' : 'none'; }
  }
  let feedT = null;
  function feed(t) { DOM.sub.textContent = t; clearTimeout(feedT); feedT = setTimeout(() => { if (S && S.def) DOM.sub.textContent = S.def.sub; }, 2200); }
  const fmt = t => { t = Math.max(0, t); const mn = Math.floor(t / 60), s = t - mn * 60; return mn + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
  function paintList() {
    DOM.list.innerHTML = [...S.players.values()].filter(p => S.part.includes(p.id) || p === S.me).map(p => {
      const inR = S.part.includes(p.id), q = S.round === 1 && p.finished, x = !inR || S.out.has(p.id);
      const extra = S.round === 2 && S.bomb && S.bomb.h.includes(p.id) ? '💣' : S.round === 2 && S.def && (S.def.score === 'crown' || S.def.score === 'hill') ? (S.crown && S.crown.h === p.id ? '👑 ' : '') + (S.ctime[p.id] || 0).toFixed(0) + ' s' : S.round === 2 && S.teams && S.teams[p.id] != null ? TEAMS[S.teams[p.id]].e : '';
      return `<div class="${q ? 'q' : x ? 'x' : ''} ${p === S.me ? 'me' : ''}"><span>${p.bot ? '🤖 ' : ''}${BR.esc(p.name)}</span><span>${extra || (q ? '✔' : x ? '✖' : '')}</span></div>`;
    }).join('');
  }
  /* ---------- fin de manche et manche suivante (décidées en solo, ou par l'hôte) ---------- */
  function roundOver() {
    const el = S.rt - S.goAt, part = S.part.filter(id => S.players.has(id));
    if (S.round === 1) { if (S.fin.length >= Math.min(S.target, part.length) || el > S.def.time) return S.fin.map(f => f.id).filter(id => S.players.has(id)); return null; }
    if (S.def.score) { if (el <= S.def.time) return null; if (S.ball && S.goals[0] === S.goals[1] && !S.ggT) { S.ggT = 1; big('BUT EN OR !', 'Le prochain but gagne', 2200); } return scoreQualified(); }
    const alive = part.filter(id => !S.out.has(id));
    if (alive.length <= S.target || el > S.def.time) return alive;
    return null;
  }
  function decideTick() {
    if (S.o.trial) return;
    if (S.decided || S.results || !S.ctl) return;
    if (!S.solo && !BR.Net.isHost()) return;
    let q = roundOver();
    // en solo, si je suis éliminé de la survie, inutile d'attendre
    if (!q && S.solo && S.round === 2 && !S.me.active) q = S.part.filter(id => !S.out.has(id));
    if (!q) return;
    S.decided = true; S.ctl = S.round === 2 ? S.ctl : S.ctl;
    big(S.round === 1 ? 'FIN DE LA COURSE' : 'FIN DE LA MANCHE', q.includes(S.selfId) ? 'Tu es qualifié(e) !' : '', 2200);
    setTimeout(() => { if (S) nextRound(q); }, 2600);
  }
  function pickMap() { const used = S.usedMaps; let last = -1; try { last = BR.store.get('br_party_map', -1); } catch (e) {} const pool = MAPS.map((m, i) => i).filter(i => !used.includes(i) && i !== last); const arr = pool.length ? pool : MAPS.map((m, i) => i).filter(i => !used.includes(i)); const pa = arr.filter(i => MAPS[i].build); const fin = pa.length && Math.random() < 0.75 ? pa : arr; return fin[Math.floor(Math.random() * fin.length)] || 0; }
  function pickR2b() { const ks = Object.keys(R2).filter(k => !S.usedR2.includes(k)); const arr = ks.length ? ks : Object.keys(R2); let last = ''; try { last = BR.store.get('br_party_r2', ''); } catch (e) {} const a2 = arr.filter(k => k !== last); const f = a2.length ? a2 : arr; return f[Math.floor(Math.random() * f.length)]; }
  function nextRound(q) {
    const n = q.length; let msg;
    if (S.final || n <= 1) msg = { k: 'res', win: q.slice() };
    else if (S.solo && !q.includes(S.selfId)) msg = { k: 'res', win: [], q };
    else {
      const final = n <= 2, type = final ? 'surv' : S.round === 1 ? 'surv' : 'race';
      msg = { k: 'rd', rn: S.rn + 1, type, q, final, seed: (Math.random() * 2 ** 31) >>> 0 };
      if (type === 'race') { msg.map = pickMap(); msg.target = Math.max(2, Math.min(n - 1, Math.round(n * 0.66))); }
      else { msg.kind = pickR2b(); msg.target = final ? 1 : Math.max(1, Math.ceil(n / 2)); }
    }
    if (!S.solo) BR.Net.relay(msg);
    onRelay({ f: S.selfId, d: msg });
  }
  // éliminés de la manche qui se termine, du moins bon au meilleur
  function elimFrom(q) {
    const gone = S.part.filter(id => !q.includes(id));
    let order;
    if (S.round === 1) order = gone.sort((a, b) => ((S.players.get(a) || {}).maxZ || 0) - ((S.players.get(b) || {}).maxZ || 0));
    else { const o = S.outOrder.filter(id => gone.includes(id)); order = gone.filter(id => !o.includes(id)).concat(o); }
    for (const id of order) if (!S.elim.includes(id)) { S.elim.push(id); S.elimRn[id] = S.rn; }
  }
  function finalRank(win) { const ids = [...S.players.keys()], rk = win.slice(); for (const id of S.elim.slice().reverse()) if (!rk.includes(id)) rk.push(id); for (const id of ids) if (!rk.includes(id)) rk.push(id); return rk; }

  /* ===================== réseau ===================== */
  function onRelay(m) {
    if (!S) return; const d = m.d || {}, from = S.players.get(m.f); if (!from) return;
    const pid = d.id || m.f, p = S.players.get(pid);
    switch (d.k) {
      case 'p': if (from === S.me) return; from.tx = d.x; from.ty = d.y; from.tz = d.z; from.tf = d.f; from.vx = d.v[0]; from.vy = d.v[1]; from.vz = d.v[2]; from.st = d.s; from.grabVis = !!d.g; from.maxZ = Math.max(from.maxZ || 0, d.z); if (d.r !== S.rn) from.st = ST.spec; break;
      case 'pb': if (BR.Net.isHost() || d.r !== S.rn) return; for (const e of d.b) { const b = S.players.get(e[0]); if (!b) continue; b.tx = e[1]; b.ty = e[2]; b.tz = e[3]; b.tf = e[4]; b.vx = e[5]; b.vy = e[6]; b.vz = e[7]; b.st = e[8]; b.grabVis = !!e[9]; b.maxZ = Math.max(b.maxZ || 0, e[3]); } break;
      case 'fin': onFin(pid, d.t); break;
      case 'out': onOut(pid); break;
      case 'tl': crumble(d.i); break;
      case 'ck': if (d.r == null || true) onCrown(d.h, d.t); break;
      case 'cs': if ((S.crown || S.hill) && !BR.Net.isHost()) { Object.assign(S.ctime, d.t || {}); if (S.crown && (d.h || null) !== S.crown.h) onCrown(d.h); } break;
      case 'em': emote(d.i | 0, from, true); break;
      case 'bl': if (S.ball && !BR.Net.isHost() && Array.isArray(d.b)) { const B = S.ball; [B.x, B.y, B.z, B.vx, B.vy, B.vz] = d.b; B.last = d.l; } break;
      case 'gl': if (S.ball && !BR.Net.isHost()) { S.ball.dead = 2.2; onGoal(d.tm, d.sc, d.by); } break;
      case 'bm': if (S.bomb && !BR.Net.isHost()) onBomb(d.h, d.t); break;
      case 'pt': if (S.paint && Array.isArray(d.a)) for (let i = 0; i + 1 < d.a.length; i += 2) paintTile(d.a[i], d.a[i + 1], false); break;
      case 'pf': if (S.paint && typeof d.s === 'string' && !BR.Net.isHost()) for (let i = 0; i < d.s.length && i < S.paint.length; i++) paintTile(i, (+d.s[i]) - 1, false); break;
      case 'cr': crumbleCr(d.i); break;
      case 'tk': if (d.r === S.rn && !BR.Net.isHost()) { const tgt = d.t + (BR.Net.rtt || 80) / 2000, df = tgt - S.rt; if (Math.abs(df) > 0.04) S.rt += Math.abs(df) > 0.6 ? df : df * 0.5; } break;
      case 'gr': { const tp = S.players.get(d.to); if (tp && simHere(tp)) grabPlayer(tp, d.by || m.f); } break;
      case 'bp': { const tp = S.players.get(d.to); if (tp && simHere(tp)) hitPlayer(tp, { x: d.v[0], y: d.v[1], z: d.v[2] }); } break;
      case 'hi': from.crowns = d.c || 0; if (RK_ICO.includes(d.rk)) from.rk = d.rk; retag(from); if (typeof d.h === 'string' && HATS[d.h] && d.h !== from.hat) { from.hat = d.h; try { putHat(from, d.h); } catch (e) {} } if (typeof d.tr === 'string' && TRAILS[d.tr]) from.trail = d.tr; break;
      case 'rd': if (d.rn === S.rn + 1) { elimFrom(d.q); bzEv('rounds'); if (d.q.includes(S.selfId)) { bzEv('qual'); passXp(15); if (d.final) bzEv('final'); } if (!d.q.includes(S.selfId) && S.me.active !== false) big('ÉLIMINÉ', 'Tu regardes la suite', 2200); startRound(d); } break;
      case 'res': elimFrom(d.q || d.win); showResults(finalRank(d.q ? d.q.concat() : d.win), d.win || []); break;
      case 'quit': onLeft({ id: m.f }); break;
    }
  }
  function onLeft(m) {
    const p = S && S.players.get(m.id); if (!p || p === S.me) return;
    if (p.av) { S.scene && S.scene.remove(p.av.group); p.av.dispose(); } if (p.tag) { S.scene && S.scene.remove(p.tag.sprite); p.tag.tex.dispose(); p.tag.sprite.material.dispose(); }
    S.players.delete(m.id); feed(p.name + ' a quitté la partie'); paintList();
  }
  function sendState(dt) {
    if (S.solo) return; S.sendT -= dt; if (S.sendT > 0) return; S.sendT = 1 / 20;
    const m = S.me, r2 = v => Math.round(v * 100) / 100;
    BR.Net.relay({ k: 'p', r: S.rn, x: r2(m.x), y: r2(m.y), z: r2(m.z), f: r2(m.face), v: [r2(m.vx), r2(m.vy), r2(m.vz)], s: m.active ? stOf(m) : ST.spec, g: m.grabT > 0 || m.holding ? 1 : 0 });
    if (BR.Net.isHost()) {
      S.tkT = (S.tkT || 0) - 1 / 20; if (S.tkT <= 0) { S.tkT = 1; BR.Net.relay({ k: 'tk', r: S.rn, t: Math.round(S.rt * 1000) / 1000 }); }
      S.pbT = (S.pbT || 0) - 1 / 20;
      if (S.pbT <= 0) { S.pbT = 1 / 12; const b = []; for (const p of S.players.values()) if (p.bot) b.push([p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.face), r2(p.vx), r2(p.vy), r2(p.vz), p.active ? stOf(p) : ST.spec, p.grabT > 0 || p.holding ? 1 : 0]); if (b.length) BR.Net.relay({ k: 'pb', r: S.rn, b }); }
    }
  }

  /* ---------- podium de fin de partie ---------- */
  function podium(ids) {
    const Y = 260, H = [2.4, 1.6, 1.0], X = [0, -2.7, 2.7], C = ['#ffd23a', '#c9d3de', '#d99a5b'];
    const fl = mesh(own(new THREE.CylinderGeometry(9, 9.5, 0.6, 40)), mat('#ffffff')); fl.position.set(0, Y - 0.3, 0); S.scene.add(fl);
    const ring = mesh(own(new THREE.TorusGeometry(9.1, 0.25, 8, 48)), mat('#ff4f9e'), false); ring.rotation.x = Math.PI / 2; ring.position.set(0, Y, 0); S.scene.add(ring);
    ids.slice(0, 3).forEach((id, k) => { addBox(X[k], Y + H[k], 0, 2.5, H[k], 2.5, C[k], { noUnder: true });
      const n = nameTag(['1er', '2e', '3e'][k], false); n.sprite.position.set(X[k], Y + H[k] / 2, 1.4); S.scene.add(n.sprite); });
    S.podium = { ids: ids.slice(0, 3), Y, H, X, t: 0 }; DOM.root.classList.add('pod');
  }
  function podiumTick(dt) {
    const P0 = S.podium; P0.t -= dt;
    for (const p of S.players.values()) {
      const k = P0.ids.indexOf(p.id);
      if (k < 0) { p.vis = false; if (p.av) p.av.group.visible = false; if (p.tag) p.tag.sprite.visible = false; continue; }
      p.x = p.tx = P0.X[k]; p.z = p.tz = 0; p.y = p.ty = P0.Y + P0.H[k]; p.vx = p.vy = p.vz = 0; p.face = p.tf = 0; p.vis = true; if (p.av) p.av.group.visible = true;
      if (P0.t <= 0 && p.av) try { p.av.act(k === 0 ? 'Cheer' : Math.random() < 0.5 ? 'Cheer' : 'Spellcast_Raise'); } catch (e) {}
    }
    if (P0.t <= 0) { P0.t = 2.6; emit(0, P0.Y + 5, 0, 60, { cols: CONF, spd: 6, up: 6, life: 2.2, grav: 6, spread: 4 }); }
    const off = window.innerWidth > 900 ? 4.6 : 0; S.cam.position.set(off, P0.Y + 3.6, 10.5); S.cam.lookAt(off, P0.Y + (window.innerWidth > 900 ? 2.2 : 0.6), 0);
  }

  /* ===================== résultats ===================== */
  function showResults(rank, win) {
    if (S.results) return; S.results = true; S.ctl = false; unlock();
    const me = S.selfId, pos = rank.indexOf(me) + 1, names = id => { const p = S.players.get(id); return p ? (p.bot ? '🤖 ' : '') + p.name : '?'; }, tot = rank.length;
    const won = win.includes(me), lastRn = S.elimRn[me] || S.rn;
    const pts = won ? 70 : pos <= 3 ? 40 : 12 + lastRn * 6, xp = pts * 3;
    const title = won ? 'VICTOIRE !' : pos === 2 ? '2e PLACE !' : pos === 3 ? '3e PLACE !' : 'ÉLIMINÉ';
    const sub = won ? 'Tu as gagné les ' + S.rn + ' manches ! 👑' : 'Classement : ' + pos + (pos === 1 ? 'er' : 'e') + ' sur ' + tot + ' · éliminé(e) à la manche ' + lastRn + (win.length ? ' · gagnant : ' + win.map(names).join(', ') : '');
    bzEv('game'); bzEv('rounds'); if (won && tot > 1) bzEv('win'); passXp(25 + (won ? 80 : 0) + (S.final && S.part.includes(me) ? 30 : 0));
    const pb = PB(), c0 = pb.bz_c || 0; pb.bz_g = (pb.bz_g || 0) + 1; let crownTxt = '';
    if (S.final && (won || S.part.includes(me))) pb.bz_q = (pb.bz_q || 0) + 1;
    if (won && tot > 1) { pb.bz_c = c0 + 1; crownTxt = '<div class="pt-gain" style="color:#e0a800;font-size:22px">+1 couronne 👑 (' + pb.bz_c + ')' + (P.title(pb.bz_c) !== P.title(c0) ? ' · nouveau titre : ' + P.title(pb.bz_c) : '') + '</div>'; }
    let lv = null; try { lv = BR.Account.applyResult({ points: pts, xp, multi: !S.solo, time: S.rt }); } catch (e) {}
    snd(won ? 'cheer' : 'aww'); sfx(won ? 'buy' : 'back'); if (won) { S.excite = 1.5; emit(S.me.x, S.me.y + 1, S.me.z, 200, { cols: CONF, spd: 8, up: 10, life: 2.4, grav: 7, spread: 4 }); }
    const rows = `<table>${rank.slice(0, 8).map((id, i) => `<tr class="${id === me ? 'me' : ''}"><td>${i + 1}</td><td>${BR.esc(names(id))}</td><td>${win.includes(id) ? '👑 Vainqueur' : S.elimRn[id] ? 'Manche ' + S.elimRn[id] : 'Finaliste'}</td></tr>`).join('')}</table>`;
    const rkBox = S.o.ranked ? '<div class="pt-rkw">' + (BR.Net.rk && BR.Net.rk.d != null && BR.Net.rk._g === S.seed ? P.rkHtml(BR.Net.rk, BR.Net.rk.d) : '<div class="pt-rk wait">🏆 Calcul du rang classé…</div>') + '</div>' : '';
    DOM.card.innerHTML = `<h2>${S.o.ranked ? '🏆 ' : ''}${title}</h2><p>${BR.esc(sub)}</p>${rkBox}${S.mapT ? '<p style="margin-top:-8px;color:#7a6cff">Meilleur temps de course : ' + fmt(S.mapT) + (S.newBest ? ' (record !)' : '') + '</p>' : ''}${rows}${crownTxt}${S.rwLog && S.rwLog.length ? '<div class="pt-gain" style="color:#7a6cff">🎁 ' + S.rwLog.map(BR.esc).join('<br>') + '</div>' : ''}<div class="pt-gain">+${pts} points · +${xp} XP${lv && lv.levelUp ? ' · NIVEAU ' + lv.after.level + ' !' : ''}</div>
      <div class="pt-b">${S.solo ? '<button data-a="replay">Rejouer</button><button class="alt" data-a="menu">Menu</button>' : '<button data-a="lobby">Retour au salon</button>'}</div>`;
    DOM.panel.classList.add('on');
    try { podium(rank); } catch (e) { console.warn('podium', e); }
    DOM.card.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { sfx('click'); const a = b.dataset.a, cb = S.o.onEnd; P.stop(); if (cb) cb(a); }));
    if (!S.solo && BR.Net.isHost()) BR.Net.send({ t: 'end', res: { rank, win } });
  }

  /* ===================== boucle ===================== */
  function frame(now) {
    if (!S) return;
    S.raf = requestAnimationFrame(frame);
    let dt = (now - S.last) / 1000; S.last = now; if (!(dt > 0)) dt = 0; if (dt > 0.05) dt = 0.05;
    step(dt);
    R.render(S.scene, S.cam);
  }
  function pollPad(dt) {
    const gps = navigator.getGamepads ? navigator.getGamepads() : []; let g = null; for (const x of gps) if (x && x.connected) { g = x; break; }
    if (!g) { S.gp = null; return; }
    const dz = v => Math.abs(v || 0) < 0.18 ? 0 : v, b = i => !!(g.buttons[i] && g.buttons[i].pressed), prev = S.gpPrev || [], edge = i => b(i) && !prev[i];
    S.gp = { lx: dz(g.axes[0]), ly: dz(g.axes[1]), rx: dz(g.axes[2]), ry: dz(g.axes[3]) };
    if (edge(0)) { S.me.jbuf = 0.13; if (S.solo && S.rt < S.introT - 0.3) { S.introT = S.rt; S.goAt = S.rt + 3.2; } }
    if (edge(1) || edge(2)) S.diveReq = true;
    if (edge(5) || edge(7) || edge(3)) S.grabReq = true;
    if (edge(9) && !S.results) pauseMenu();
    S.gpPrev = g.buttons.map(x => x.pressed);
    if (S.gp.rx || S.gp.ry) { S.yaw -= S.gp.rx * 2.6 * dt; S.pitch = clamp(S.pitch + S.gp.ry * 1.8 * dt, -0.25, 1.15); S.lastLook = S.rt; }
  }
  function step(dt) {
    S.rt += dt;
    pollPad(dt);
    updateWorld(S.round === 2 ? Math.max(0, S.rt - S.goAt) : S.rt, dt);
    // compte à rebours
    if (!S.ctl && !S.results && !S.decided && S.rt < S.goAt + 0.1) {
      const left = Math.ceil(S.goAt - S.rt);
      if (S.rt > S.introT && left !== S.cd && left > 0 && left <= 3) { S.cd = left; big(String(left), '', 700); snd('tick'); }
      if (S.rt >= S.goAt) { S.ctl = true; S.cd = 0; big('GO !', '', 800); snd('go'); MUS.lvl = 1; S.excite = 0.9; }
    }
    if (S.round === 2 && S.r2 === 'ile' && S.low && S.low.off && S.rt - S.goAt > 25) { S.low.off = false; S.low.g.visible = true; feed('La barre arrive : saute-la !'); shout('ATTENTION !', '#ff4f9e'); }
    if (S.round === 2 && S.high && S.high.off && S.rt - S.goAt > 18) { S.high.off = false; S.high.g.visible = true; feed('Attention : la barre HAUTE arrive — ne saute pas dessus !'); }
    // physique (2 sous-pas pour la précision) : moi, puis les bots simulés ici
    S.fdt = dt; const n = dt > 1 / 70 ? 2 : 1;
    const bots = [...S.players.values()].filter(p => p.bot && simHere(p) && p.active), binp = bots.map(b => botThink(b, dt));
    for (let i = 0; i < n; i++) {
      stepPlayer(S.me, dt / n, myInput());
      bots.forEach((b, j) => { stepPlayer(b, dt / n, binp[j]); if (i === 0) { binp[j].jump = binp[j].dive = binp[j].grab = false; } });
    }
    updateAvatars(dt);
    updateFx(dt); S.excite = Math.max(0, (S.excite || 0) - dt * 0.4);
    if (S.rt < S.introT) introCam(S.rt / S.introT);
    else {
      if (!S.introDone) { S.introDone = true; DOM.intro.classList.remove('on'); DOM.root.classList.remove('intro'); flash(); const tg = S.me; S.camP.set(tg.x - Math.sin(S.yaw) * 7.6, tg.y + 1.6 + Math.sin(S.pitch) * 7.6, tg.z - Math.cos(S.yaw) * 7.6); S.cam.fov = 68; }
      updateCam(dt);
    }
    paintPos();
    sendState(dt);
    if (S.round === 2 && S.def.score) modeTick(dt);
    if (S.round === 2 && S.bomb) bombTick(dt, S.solo || BR.Net.isHost());
    decideTick();
    // chrono
    const el = S.rt - S.goAt, lim = S.def.time;
    DOM.time.textContent = S.ctl ? (S.round === 1 ? fmt(Math.max(0, el)) : fmt(Math.max(0, lim - el))) : '';
    DOM.click.classList.toggle('on', !S.locked && !S.results && !S.paused);
    if (S.podium) podiumTick(dt);
  }

  /* ===================== entrées ===================== */
  let bound = false;
  function bindInput(on) {
    if (on === bound) return; bound = on;
    const f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('keydown', onKey, true); window[f]('keyup', onKeyUp, true);
    document[f]('mousemove', onMouse); document[f]('pointerlockchange', onLock);
    DOM.gl[f]('mousedown', onDown); DOM.gl[f]('contextmenu', noCtx); window[f]('blur', onBlur);
  }
  const noCtx = e => e.preventDefault();
  function onBlur() { for (const k in keys) keys[k] = false; }
  function lock() { try { const r = DOM.gl.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  function unlock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {} }
  function onLock() { if (S) S.locked = document.pointerLockElement === DOM.gl; }
  function onDown(e) {
    if (!S || S.results) return;
    if (!S.locked) { lock(); return; }
    if (e.button !== 0) return;
    if (!S.me.active) S.specI = (S.specI || 0) + 1; else S.grabReq = true;
  }
  function onMouse(e) { if (!S || !S.locked) return; S.lastLook = S.rt; const k = 0.0024 * ((BR.settings.sens || 1)); S.yaw -= e.movementX * k; S.pitch = clamp(S.pitch + e.movementY * k, -0.25, 1.15); }
  function onKey(e) {
    if (!S) return;
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (e.code === 'Escape') { if (!S.results) pauseMenu(); return; }
    if (e.code === 'KeyF') { S.grabReq = true; return; }
    if (/^Digit[1-4]$/.test(e.code) && !e.repeat) { emote(+e.code.slice(5) - 1, S.me); return; }
    keys[e.code] = true;
    if (e.code === 'Space') { S.me.jbuf = 0.13; e.preventDefault(); if (S.solo && S.rt < S.introT - 0.3) { S.introT = S.rt; S.goAt = S.rt + 3.2; } }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || (e.key && e.key.toLowerCase() === 'a' && e.code !== 'KeyA')) && !e.repeat) S.diveReq = true;
    if (/^(Key[WASDE]|Arrow|Space)/.test(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys[e.code] = false; }
  function pauseMenu() {
    if (S.paused) { S.paused = false; DOM.panel.classList.remove('on'); lock(); return; }
    S.paused = true; unlock();
    DOM.card.innerHTML = `<h2>PAUSE</h2><p>${S.solo ? 'Le jeu continue de tourner derrière.' : 'La partie continue pour les autres !'}</p><div class="pt-set"><label>Sensibilité souris <input type="range" min="0.3" max="2.5" step="0.05" data-s="sens" value="${BR.settings.sens || 1}"></label><label>Qualité <select data-s="quality"><option value="low">Basse (petit PC)</option><option value="med">Moyenne</option><option value="high">Haute</option></select></label><label>Secousses <input type="range" min="0" max="1.5" step="0.1" data-s="shake" value="${BR.settings.shake != null ? BR.settings.shake : 1}"></label></div><div class="pt-b"><button data-a="back">Reprendre</button><button class="alt" data-a="quit">Quitter la partie</button></div>`;
    DOM.panel.classList.add('on');
    { const sel = DOM.card.querySelector('select[data-s]'); sel.value = BR.settings.quality || 'high'; }
    DOM.card.querySelectorAll('[data-s]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { const k = el.dataset.s; BR.settings[k] = k === 'quality' ? el.value : +el.value; try { BR.saveSettings(); } catch (e) {} if (k === 'quality') { R.shadowMap.enabled = el.value !== 'low'; resize(); S.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); } }));
    DOM.card.querySelector('[data-a=back]').onclick = () => { sfx('click'); S.paused = false; DOM.panel.classList.remove('on'); lock(); };
    DOM.card.querySelector('[data-a=quit]').onclick = () => { sfx('back'); if (!S.solo) BR.Net.relay({ k: 'quit' }); const cb = S.o.onEnd; P.stop(); if (cb) cb(S && S.solo ? 'menu' : 'lobby'); };
  }

  /* ===================== démarrage / arrêt ===================== */
  let rkHooked = false;
  P.start = function (o) {
    if (!rkHooked && BR.Net && BR.Net.on) { rkHooked = true; BR.Net.on('rk', m => { if (S) m._g = S.seed; const w = DOM && DOM.card && DOM.card.querySelector('.pt-rkw'); if (w) { w.innerHTML = P.rkHtml(m, m.d); if (m.d > 0) sfx('buy'); } }); }
    if (S) P.stop();
    ensureDom(); renderer();
    S = { o, solo: o.mode !== 'multi', seed: o.seed >>> 0, selfId: o.selfId, players: new Map(), disp: [], solids: [], haz: [], checks: [], spawns: [], tramps: [],
      unsub: [], sendT: 0, shake: 0, yaw: 0, pitch: 0.32, last: performance.now(), rt: 0, round: 0, part: [], out: new Set(), outOrder: [], fin: [], check: 0 };
    o.roster.forEach(r => S.players.set(r.id, { id: r.id, name: r.name, look: r.look || BR.Avatar.defaultLook(), x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, vx: 0, vy: 0, vz: 0, face: 0, tf: 0, st: 0,
      ground: false, active: true, jbuf: 0, coyote: 0, ghost: 0, diveUsed: false, stT: 0 }));
    S.me = S.players.get(S.selfId);
    if (!o.trial) makeBots(S.seed); S.usedMaps = []; S.usedR2 = []; S.elim = []; S.elimRn = {};
    S.cam = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
    makeAvatars();
    if (!S.solo) {
      const N = BR.Net;
      S.unsub.push(N.on('r', onRelay), N.on('left', onLeft),
        N.on('lost', () => abort('Connexion au serveur perdue.')), N.on('kicked', m => abort(m.msg || 'Exclu du salon.')));
    }
    DOM.panel.classList.remove('on'); DOM.root.classList.add('on'); DOM.big.classList.remove('on');
    bindInput(true); resize();
    { const n = S.players.size; startRound({ rn: 1, type: 'race', map: o.forceMap != null ? o.forceMap : mapFromSeed(S.seed), seed: S.seed, q: [...S.players.keys()], target: Math.max(2, Math.min(n - 1, Math.round(n * 0.66))), final: false }); }
    P.active = true;
    try { BR.MenuBG && BR.MenuBG.stop(); } catch (e) {}
    S.raf = requestAnimationFrame(frame);
    // onglet en arrière-plan : on continue d'envoyer sa position (sinon on « gèle » chez les autres)
    if (!S.solo) S.bg = setInterval(() => { if (S && document.hidden) { const now = performance.now(); step(Math.min(0.05, (now - S.last) / 1000)); S.last = now; } }, 50);
  };
  function abort(msg) { if (!S) return; const cb = S.o.onEnd; P.stop(); try { BR.UI.toast(msg, 'error'); } catch (e) {} if (cb) cb('menu'); }
  P.stop = function () {
    if (!S) return;
    cancelAnimationFrame(S.raf); clearInterval(S.bg);
    bindInput(false); unlock();
    S.unsub.forEach(f => f());
    for (const p of S.players.values()) { if (p.av) p.av.dispose(); if (p.tag) { p.tag.tex.dispose(); p.tag.sprite.material.dispose(); } }
    clearWorld();
    DOM.root.classList.remove('on', 'intro', 'pod'); DOM.panel.classList.remove('on'); DOM.intro.classList.remove('on');
    if (R) { R.clear(); R.renderLists.dispose(); }
    musicStop(); try { Au.track('music', 'menu', 0.8); } catch (e) {}
    S = null; P.active = false;
    for (const k in keys) keys[k] = false;
  };
  P.session = () => S;
  P.prep = () => ensureDom();
  P._next = kind => { if (!S) return; const q = S.part.filter(id => S.players.has(id)); const msg = { k: 'rd', rn: S.rn + 1, type: kind ? 'surv' : 'race', q, final: false, seed: 4242 + S.rn, kind, map: kind ? undefined : pickMap(), target: Math.max(1, Math.ceil(q.length / 2)) }; if (!S.solo) BR.Net.relay(msg); onRelay({ f: S.selfId, d: msg }); };   // test
  P._step = dt => S && step(dt);
  P._ground = (x, z, y) => S && groundAt(x, z, y);
  P._render = () => { if (S && R) R.render(S.scene, S.cam); };
  P._round = cfg => S && startRound(cfg);
  P.mapCount = () => MAPS.length;
  P._freeze = on => { if (!S) return; if (on) cancelAnimationFrame(S.raf); else S.raf = requestAnimationFrame(frame); };
})();

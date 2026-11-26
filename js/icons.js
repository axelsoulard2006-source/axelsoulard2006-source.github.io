/* ===== icons.js : icônes dessinées par code (aucun emoji) ===== */
(function () {
  const BR = window.BR;
  const I = (BR.Icons = {});
  // pictogrammes vectoriels (traits) — 24×24
  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
    crown: '<path d="M3 19h18M4 8l4.5 4L12 5l3.5 7L20 8l-2 9H6z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    cloud: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 9.5a4.3 4.3 0 0 1-1 8.5z"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
    shirt: '<path d="M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>',
    fuse: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M8 7h8M8 17h8M12 9.5v5"/>',
    trophy: '<path d="M8 21h8M12 16v5M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14a5 5 0 0 1 5 5"/>',
    pin: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    heart: '<path d="M12 21s-8-5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6-8 11-8 11z"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    gift: '<rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M12 8v13M3 12.5h18M12 8c-1.5-4-6-4.5-6-1.5S10 8 12 8zm0 0c1.5-4 6-4.5 6-1.5S14 8 12 8z"/>',
    skull: '<path d="M12 3a8 8 0 0 0-5 14.2V21h10v-3.8A8 8 0 0 0 12 3z"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><path d="M10 21v-2M14 21v-2"/>',
    door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="15" cy="12" r="1"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    run: '<circle cx="14" cy="4" r="2"/><path d="M8 21l3-6 3 2v5M6 11l3-3 4 1 3 4 3 1M11 15l-2-4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  };
  I.svg = function (name, size, cls) {
    const s = size || 18;
    return `<svg class="ico ${cls || ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  };
  // pièce « points » : losange doré plein
  I.coin = function (size) {
    const s = size || 16;
    return `<svg class="ico coin" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="cg${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".5" stop-color="#ffcf3a"/><stop offset="1" stop-color="#c78b12"/></linearGradient></defs><path d="M12 1.5 21.5 12 12 22.5 2.5 12z" fill="url(#cg${s})" stroke="#7a5306" stroke-width="1.2"/><path d="M12 5.5 17.5 12 12 18.5 6.5 12z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/></svg>`;
  };

  /* ---------- illustrations des objets (canvas) ---------- */
  const cache = {};
  function mk(fn) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'; fn(g); return c.toDataURL('image/png'); }
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const shadow = g => { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(64, 116, 34, 7, 0, 0, 7); g.fill(); };
  const DRAW = {
    energy: g => {
      shadow(g);
      rr(g, 40, 18, 48, 96, 12); g.fillStyle = lin(g, 40, 0, 88, 0, [[0, '#1f3b8a'], [0.45, '#3f6fe0'], [1, '#162c66']]); g.fill();
      g.fillStyle = lin(g, 40, 0, 88, 0, [[0, '#9aa3ad'], [0.5, '#eef2f6'], [1, '#7c858f']]); rr(g, 40, 12, 48, 12, 5); g.fill(); rr(g, 42, 108, 44, 8, 4); g.fill();
      g.fillStyle = '#ffd23a'; g.strokeStyle = '#7a4d00'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(70, 34); g.lineTo(50, 66); g.lineTo(63, 66); g.lineTo(56, 96); g.lineTo(80, 58); g.lineTo(67, 58); g.lineTo(74, 34); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.25)'; rr(g, 46, 26, 7, 80, 3); g.fill();
    },
    flare: g => {
      shadow(g);
      g.save(); g.translate(64, 70); g.rotate(-0.6);
      rr(g, -12, -40, 24, 80, 6); g.fillStyle = lin(g, -12, 0, 12, 0, [[0, '#8a0f0f'], [0.5, '#e8402f'], [1, '#7a0c0c']]); g.fill();
      g.fillStyle = '#f4e9d6'; g.fillRect(-12, 6, 24, 10); g.fillStyle = '#222'; g.fillRect(-12, 30, 24, 10);
      g.restore();
      const gr = g.createRadialGradient(92, 28, 2, 92, 28, 30); gr.addColorStop(0, '#fff7d0'); gr.addColorStop(0.3, '#ffb040'); gr.addColorStop(1, 'rgba(255,60,20,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(92, 28, 30, 0, 7); g.fill();
      g.strokeStyle = '#ffd27a'; g.lineWidth = 3; for (let k = 0; k < 7; k++) { const a = k * 0.9, r0 = 10, r1 = 22 + (k % 2) * 8; g.beginPath(); g.moveTo(92 + Math.cos(a) * r0, 28 + Math.sin(a) * r0); g.lineTo(92 + Math.cos(a) * r1, 28 + Math.sin(a) * r1); g.stroke(); }
    },
    decoy: g => {
      shadow(g);
      g.strokeStyle = '#9aa0a8'; g.lineWidth = 4; g.beginPath(); g.moveTo(80, 48); g.lineTo(94, 12); g.stroke(); g.fillStyle = '#e33'; g.beginPath(); g.arc(94, 12, 5, 0, 7); g.fill();
      rr(g, 24, 46, 80, 62, 10); g.fillStyle = lin(g, 0, 46, 0, 108, [[0, '#4a4f55'], [1, '#23262a']]); g.fill();
      g.fillStyle = '#16181b'; for (let y = 56; y < 100; y += 7) rr(g, 32, y, 36, 4, 2), g.fill();
      g.fillStyle = '#5bff7c'; g.beginPath(); g.arc(86, 62, 6, 0, 7); g.fill(); g.fillStyle = '#c9ced4'; g.beginPath(); g.arc(86, 88, 9, 0, 7); g.fill();
      g.strokeStyle = 'rgba(120,255,150,0.8)'; g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(104, 30, 10 + k * 9, -1.2, 0.2); g.stroke(); }
    },
    medkit: g => {
      shadow(g);
      rr(g, 46, 22, 36, 18, 6); g.strokeStyle = '#d7dbe0'; g.lineWidth = 6; g.stroke();
      rr(g, 18, 34, 92, 74, 12); g.fillStyle = lin(g, 0, 34, 0, 108, [[0, '#ffffff'], [1, '#cfd5dc']]); g.fill();
      g.fillStyle = '#e02b2b'; rr(g, 54, 46, 20, 50, 3); g.fill(); rr(g, 39, 61, 50, 20, 3); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2; rr(g, 18, 34, 92, 74, 12); g.stroke();
    },
    radar: g => {
      shadow(g);
      rr(g, 20, 20, 88, 92, 14); g.fillStyle = lin(g, 0, 20, 0, 112, [[0, '#3c4148'], [1, '#1d2024']]); g.fill();
      g.fillStyle = '#062b14'; g.beginPath(); g.arc(64, 62, 34, 0, 7); g.fill();
      g.strokeStyle = 'rgba(80,255,140,0.45)'; g.lineWidth = 2; for (const r of [11, 22, 33]) { g.beginPath(); g.arc(64, 62, r, 0, 7); g.stroke(); }
      g.beginPath(); g.moveTo(30, 62); g.lineTo(98, 62); g.moveTo(64, 28); g.lineTo(64, 96); g.stroke();
      const sw = g.createRadialGradient(64, 62, 0, 64, 62, 34); sw.addColorStop(0, 'rgba(90,255,150,0.9)'); sw.addColorStop(1, 'rgba(90,255,150,0)');
      g.fillStyle = sw; g.beginPath(); g.moveTo(64, 62); g.arc(64, 62, 34, -1.6, -0.6); g.closePath(); g.fill();
      g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(80, 50, 4.5, 0, 7); g.fill(); g.beginPath(); g.arc(50, 76, 3.5, 0, 7); g.fill();
    },
    smoke: g => {
      shadow(g);
      const puff = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, `rgba(220,224,230,${a})`); gr.addColorStop(1, 'rgba(160,166,175,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
      puff(80, 34, 30, 0.9); puff(56, 26, 24, 0.8); puff(96, 52, 20, 0.7);
      rr(g, 34, 52, 40, 60, 10); g.fillStyle = lin(g, 34, 0, 74, 0, [[0, '#4b5a3a'], [0.5, '#7d9160'], [1, '#3f4c31']]); g.fill();
      g.fillStyle = '#c9cfd6'; rr(g, 40, 44, 28, 12, 4); g.fill(); g.fillStyle = '#e8c33a'; g.fillRect(34, 78, 40, 8);
    },
    compass: g => {
      shadow(g);
      g.fillStyle = lin(g, 0, 16, 0, 112, [[0, '#d9b35a'], [1, '#8a6420']]); g.beginPath(); g.arc(64, 64, 48, 0, 7); g.fill();
      g.fillStyle = '#f5f1e6'; g.beginPath(); g.arc(64, 64, 40, 0, 7); g.fill();
      g.strokeStyle = '#555'; g.lineWidth = 2; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r0 = k % 4 ? 35 : 31; g.beginPath(); g.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0); g.lineTo(64 + Math.cos(a) * 39, 64 + Math.sin(a) * 39); g.stroke(); }
      g.fillStyle = '#d92b2b'; g.beginPath(); g.moveTo(64, 30); g.lineTo(73, 64); g.lineTo(55, 64); g.closePath(); g.fill();
      g.fillStyle = '#2b3240'; g.beginPath(); g.moveTo(64, 98); g.lineTo(73, 64); g.lineTo(55, 64); g.closePath(); g.fill();
      g.fillStyle = '#ddd'; g.beginPath(); g.arc(64, 64, 5, 0, 7); g.fill();
    },
  };
  I.item = function (id) { if (!cache[id]) cache[id] = DRAW[id] ? mk(DRAW[id]) : ''; return cache[id]; };
  I.itemImg = (id, size, cls) => `<img class="itemico ${cls || ''}" src="${I.item(id)}" width="${size || 32}" height="${size || 32}" alt="">`;
})();

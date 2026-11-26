/* ===== util.js : outils communs ===== */
(function () {
  const BR = (window.BR = window.BR || {});

  BR.rngFrom = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  BR.hashStr = function (s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  BR.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  BR.lerp = (a, b, t) => a + (b - a) * t;
  BR.rand = (a, b) => a + Math.random() * (b - a);
  BR.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  BR.pick = (arr, rng) => arr[Math.floor((rng || Math.random)() * arr.length)];
  BR.shuffle = function (arr, rng) {
    rng = rng || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  BR.angDiff = function (a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  BR.$ = (s, r) => (r || document).querySelector(s);
  BR.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  BR.el = function (tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return e;
  };
  BR.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  BR.fmt = n => Math.round(n).toLocaleString('fr-FR');
  BR.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  BR.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  BR.Emitter = function () {
    const m = {};
    return {
      on(t, f) { (m[t] = m[t] || []).push(f); return () => { m[t] = (m[t] || []).filter(x => x !== f); }; },
      emit(t, ...a) { (m[t] || []).slice().forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); },
      clear() { for (const k in m) delete m[k]; },
    };
  };
  BR.uid = () => Math.random().toString(36).slice(2, 10);
  BR.sleep = ms => new Promise(r => setTimeout(r, ms));
})();

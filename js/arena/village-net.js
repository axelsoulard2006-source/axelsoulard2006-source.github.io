/* ===== arena/village-net.js : présence des joueurs au village (accueil de l'Ascension) =====
   Tous les joueurs qui sont au village se voient : position, animation, émotes et bulles de discussion.
   Le serveur relaie (messages vjoin / vpos / vleave / vemote / vchat) ; rien n'est simulé côté serveur.
   API pour village.js :
     BR.VNet.enter({ x, y, z, r, a })   entrer (se connecte si besoin)
     BR.VNet.move(x, y, z, r, a)        position (envoyée ~10 fois/s au plus, seulement si elle change)
     BR.VNet.leave()                    sortir
     BR.VNet.emote(e) · BR.VNet.chat(texte)
     BR.VNet.players                    Map id → { id, n, look, lv, x, y, z, r, a, t }
     BR.VNet.on(ev, fn)                 ev : 'join' | 'leave' | 'pos' | 'emote' | 'chat' | 'reset' */
(function () {
  const BR = window.BR, N = BR.Net;
  const V = BR.VNet = { players: new Map(), inside: false };
  const L = {};
  V.on = (ev, fn) => { (L[ev] = L[ev] || []).push(fn); return () => { L[ev] = (L[ev] || []).filter(f => f !== fn); }; };
  const emit = (ev, a) => (L[ev] || []).forEach(fn => { try { fn(a); } catch (e) { console.error('village net', ev, e); } });
  let last = { x: 0, y: 0, z: 0, r: 0, a: 'Idle' }, sentAt = 0, dirty = false, timer = null;
  const round = v => Math.round(v * 100) / 100;
  function sendJoin() { if (!V.inside || !N || N.status !== 'on') return; N.send(Object.assign({ t: 'vjoin' }, last)); }
  V.enter = function (st) {
    if (st) Object.assign(last, st);
    V.inside = true;
    if (!N) return;
    if (N.status === 'on') sendJoin();
    else if (N.connect) N.connect().then(sendJoin).catch(() => {});
    clearInterval(timer); timer = setInterval(flush, 100);
  };
  V.move = function (x, y, z, r, a) {
    if (!V.inside) return;
    const n = { x: round(x), y: round(y), z: round(z), r: round(r), a: a || 'Idle' };
    if (n.x !== last.x || n.y !== last.y || n.z !== last.z || Math.abs(n.r - last.r) > 0.02 || n.a !== last.a) { last = n; dirty = true; }
  };
  function flush() {
    if (!V.inside || !dirty || !N || N.status !== 'on') return;
    const now = performance.now(); if (now - sentAt < 95) return;
    sentAt = now; dirty = false; N.send(Object.assign({ t: 'vpos' }, last));
  }
  V.leave = function () {
    if (!V.inside) return;
    V.inside = false; clearInterval(timer); timer = null;
    if (N && N.status === 'on') N.send({ t: 'vleave' });
    V.players.clear(); emit('reset');
  };
  V.emote = e => { if (V.inside && N && N.status === 'on') N.send({ t: 'vemote', e }); };
  V.chat = m => { if (V.inside && N && N.status === 'on' && m) N.send({ t: 'vchat', m: String(m).slice(0, 120) }); };

  if (!N || !N.on) return;
  const put = p => { const o = Object.assign(V.players.get(p.id) || {}, p, { t: performance.now() }); V.players.set(p.id, o); return o; };
  N.on('vlist', m => { if (!V.inside) return; V.players.clear(); emit('reset'); (m.p || []).forEach(p => emit('join', put(p))); });
  N.on('vjoin', m => { if (!V.inside) return; emit('join', put(m)); });
  N.on('vpos', m => { if (!V.inside) return; const known = V.players.has(m.id); const o = put(m); if (!known) emit('join', o); emit('pos', o); });
  N.on('vleave', m => { if (!V.inside) return; const o = V.players.get(m.id); V.players.delete(m.id); if (o) emit('leave', o); });
  N.on('vemote', m => { if (V.inside && V.players.has(m.id)) emit('emote', { id: m.id, e: m.e }); });
  N.on('vchat', m => { if (V.inside) emit('chat', { id: m.id, n: m.n, m: m.m, me: m.id === N.id }); });
  // reconnexion : on revient au village automatiquement
  N.on('status', s => { if (s === 'on' && V.inside) sendJoin(); if (s !== 'on' && V.inside) { V.players.clear(); emit('reset'); } });
})();

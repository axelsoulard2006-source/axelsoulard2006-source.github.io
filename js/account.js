/* ===== account.js : profil du joueur (invité local ou compte en ligne sauvegardé sur le serveur / GitHub) ===== */
(function () {
  const BR = window.BR;
  const K_GUEST = 'br_profile', K_TOKEN = 'br_token', K_CACHE = 'br_acc_cache', K_PENDING = 'br_acc_pending';
  const STAT_KEYS = ['games', 'escapes', 'deaths', 'fuses', 'revives', 'downs', 'time', 'wins', 'items', 'solo', 'multi'];

  const A = (BR.Account = {
    p: null,            // profil courant
    token: '',          // jeton de session (si compte)
    logged: false,      // connecté à un compte
    sync: 'local',      // local | ok | saving | offline | error
    ev: BR.Emitter(),
  });

  function fresh(name) {
    const stats = {}; STAT_KEYS.forEach(k => stats[k] = 0); stats.best = {};
    return {
      v: 1, name: name || ('Invité' + Math.floor(1000 + Math.random() * 9000)), points: 300, xp: 0, stats,
      look: { skin: 'survivor', aura: null },
      ownedSkins: ['survivor'], ownedAcc: [], inv: { flare: 1, energy: 1 }, loadout: ['flare', 'energy'],
      title: '', created: Date.now(), daily: 0, streak: 0, achievements: [], arena: freshArena(),
    };
  }
  // ---- jeu 2 (COLOSSES) : compétences possédées { id: { lv, xp } }, équipement, statistiques ----
  function freshArena() { const s = BR.ARENA.STARTER; return { owned: JSON.parse(JSON.stringify(s.owned)), equip: s.equip.slice(), ult: s.ult, weapon: s.weapon, free: 1, st: { boss: {}, best: {}, duelW: 0, duelL: 0, botW: 0 } }; }
  function normArena(a) {
    const f = freshArena(); if (!a || typeof a !== 'object') return f;
    const AR = BR.ARENA, o = { owned: {}, equip: [null, null, null, null], ult: f.ult, weapon: AR.WEAPONS[a.weapon] ? a.weapon : f.weapon, free: Math.max(0, Math.min(5, a.free | 0)), st: Object.assign({}, f.st, a.st || {}) };
    o.st.boss = Object.assign({}, (a.st && a.st.boss) || {}); o.st.best = Object.assign({}, (a.st && a.st.best) || {});
    for (const id in Object.assign({}, f.owned, a.owned || {})) { if (!AR.skill(id)) continue; const v = (a.owned && a.owned[id]) || f.owned[id]; o.owned[id] = { lv: Math.max(1, Math.min(AR.MAXLV, v.lv | 0 || 1)), xp: Math.max(0, v.xp | 0) }; }
    (Array.isArray(a.equip) ? a.equip : f.equip).slice(0, 4).forEach((id, i) => { const d = AR.skill(id); if (d && d.type === 'skill' && o.owned[id] && !o.equip.includes(id)) o.equip[i] = id; });
    if (a.ult && o.owned[a.ult] && AR.skill(a.ult).type === 'ult') o.ult = a.ult;
    return o;
  }
  // remet le profil dans une forme sûre (anciennes versions, champs manquants)
  function normalize(p, name) {
    const f = fresh(name || (p && p.name));
    if (!p || typeof p !== 'object') return f;
    const o = Object.assign({}, f, p);
    o.stats = Object.assign({}, f.stats, p.stats || {}); o.stats.best = Object.assign({}, (p.stats && p.stats.best) || {});
    o.look = { skin: (p.look && p.look.skin) || 'survivor', aura: (p.look && p.look.aura) || null };
    o.ownedSkins = Array.from(new Set(['survivor'].concat(Array.isArray(p.ownedSkins) ? p.ownedSkins : [])));
    o.ownedAcc = Array.isArray(p.ownedAcc) ? p.ownedAcc.slice() : [];
    // anciens skins / accessoires retirés du jeu : remboursés une fois, au prix d'achat
    let refund = 0;
    o.ownedAcc = o.ownedAcc.filter(id => { if (BR.OLD_ACC[id] && !BR.auraById(id)) { refund += BR.OLD_ACC[id]; return false; } return !!BR.auraById(id); });
    o.ownedSkins = o.ownedSkins.filter(id => { if (BR.OLD_SKINS[id] && !BR.SKINS.some(s => s.id === id)) { refund += BR.OLD_SKINS[id]; return false; } return BR.SKINS.some(s => s.id === id); });
    if (refund) { o.points = (o.points || 0) + refund; o.refunded = (o.refunded || 0) + refund; }
    o.inv = Object.assign({}, (p.inv && typeof p.inv === 'object') ? p.inv : {});
    if (o.inv.silence) { o.inv.smoke = (o.inv.smoke || 0) + o.inv.silence; delete o.inv.silence; }     // ancien objet remplacé
    o.loadout = Array.isArray(p.loadout) ? p.loadout.filter(i => BR.ITEMS[i]).slice(0, BR.LOADOUT_SLOTS) : [];
    o.achievements = Array.isArray(p.achievements) ? p.achievements : [];
    if (!o.ownedSkins.includes(o.look.skin)) o.look.skin = 'survivor';
    if (o.look.aura && !o.ownedAcc.includes(o.look.aura)) o.look.aura = null;
    o.arena = normArena(p.arena);
    return o;
  }

  const changed = () => A.ev.emit('change', A.p);
  const setSync = s => { if (A.sync !== s) { A.sync = s; A.ev.emit('sync', s); } };

  A.level = () => BR.levelFromXp(A.p.xp || 0);
  A.helloData = () => ({ name: A.p.name, look: A.p.look, level: A.level().level, token: A.token || undefined });
  A.on = (t, f) => A.ev.on(t, f);

  // ---------- démarrage ----------
  A.init = async function () {
    A.token = BR.store.get(K_TOKEN, '') || '';
    if (!A.token) { A.p = normalize(BR.store.get(K_GUEST, null)); BR.store.set(K_GUEST, A.p); A.logged = false; setSync('local'); changed(); return; }
    // compte : on affiche tout de suite le cache, puis le serveur fait foi
    A.logged = true;
    A.p = normalize(BR.store.get(K_CACHE, null));
    changed();
    A.refresh();          // en arrière-plan : le serveur peut mettre une minute à se réveiller
  };
  A.refresh = async function () {
    if (!A.token) return;
    try {
      if (BR.store.get(K_PENDING, false)) { await pushSave(); return; }   // des progrès faits hors ligne attendent d'être envoyés
      const j = await BR.Net.api('/api/me', { token: A.token, retries: 2, timeout: 60000 });
      A.p = normalize(j.profile); BR.store.set(K_CACHE, A.p); setSync('ok'); changed();
    } catch (e) {
      if (e.status === 401) { A.ev.emit('expired', e.message); A.logout(true); return; }
      setSync('offline');
    }
  };

  // ---------- sauvegarde ----------
  let saveTimer = null, saving = null;
  function persistLocal() {
    if (A.logged) { BR.store.set(K_CACHE, A.p); BR.store.set(K_PENDING, true); } else BR.store.set(K_GUEST, A.p);
  }
  async function pushSave() {
    if (!A.logged || !A.token) return;
    if (saving) { await saving; if (!BR.store.get(K_PENDING, false)) return; }
    setSync('saving');
    saving = (async () => {
      try {
        const j = await BR.Net.api('/api/save', { token: A.token, body: { profile: A.p }, retries: 2, timeout: 60000 });
        BR.store.set(K_PENDING, false);
        if (j.profile) { A.p = normalize(j.profile); BR.store.set(K_CACHE, A.p); }
        setSync('ok');
      } catch (e) {
        if (e.status === 401) { A.ev.emit('expired', e.message); A.logout(true); return; }
        setSync(e.status ? 'error' : 'offline');
        clearTimeout(saveTimer); saveTimer = setTimeout(pushSave, 20000);
      }
    })();
    try { await saving; } finally { saving = null; }
  }
  // enregistre localement tout de suite, envoie au serveur peu après (regroupe les petites modifications)
  A.save = function (now) {
    persistLocal(); changed();
    if (!A.logged) return Promise.resolve();
    clearTimeout(saveTimer);
    if (now) return pushSave();
    saveTimer = setTimeout(pushSave, 1500);
    return Promise.resolve();
  };

  // ---------- comptes ----------
  A.register = async function (name, pass) {
    name = String(name || '').trim();
    if (!/^[A-Za-z0-9_\-À-ÿ]{3,16}$/.test(name)) throw new Error('Pseudo : 3 à 16 caractères (lettres, chiffres, _ ou -).');
    if (String(pass || '').length < 4) throw new Error('Mot de passe : 4 caractères minimum.');
    // la progression de l'invité est transférée vers le nouveau compte
    const body = { name, pass, profile: Object.assign({}, A.logged ? fresh(name) : A.p, { name }) };
    const j = await BR.Net.api('/api/register', { body, retries: 2 });
    if (!A.logged) BR.store.set(K_GUEST, fresh());          // l'invité repart de zéro (pas de duplication)
    loginWith(j.token, j.profile);
  };
  A.login = async function (name, pass) {
    const j = await BR.Net.api('/api/login', { body: { name: String(name || '').trim(), pass }, retries: 2 });
    loginWith(j.token, j.profile);
  };
  function loginWith(token, profile) {
    A.token = token; A.logged = true; A.p = normalize(profile);
    BR.store.set(K_TOKEN, token); BR.store.set(K_CACHE, A.p); BR.store.set(K_PENDING, false);
    setSync('ok'); changed(); A.ev.emit('login', A.p);
    pushProfileToRoom(true);
  }
  A.logout = function (silent) {
    clearTimeout(saveTimer);
    A.token = ''; A.logged = false;
    BR.store.del(K_TOKEN); BR.store.del(K_CACHE); BR.store.del(K_PENDING);
    A.p = normalize(BR.store.get(K_GUEST, null)); BR.store.set(K_GUEST, A.p);
    setSync('local'); changed(); A.ev.emit('logout', !!silent);
    pushProfileToRoom(true);
  };
  A.changePassword = async function (oldPass, newPass) {
    if (!A.logged) throw new Error('Pas connecté.');
    if (String(newPass || '').length < 4) throw new Error('Mot de passe : 4 caractères minimum.');
    const j = await BR.Net.api('/api/password', { token: A.token, body: { old: oldPass, pass: newPass }, retries: 1 });
    A.token = j.token; BR.store.set(K_TOKEN, j.token);
  };
  A.setGuestName = function (n) {
    if (A.logged) return false;
    n = String(n || '').replace(/[^\wÀ-ÿ\-]/g, '').slice(0, 16);
    if (n.length < 3) return false;
    A.p.name = n; A.save(); pushProfileToRoom(true); return true;
  };

  // si connecté au serveur, informe le salon du nouveau look / niveau (ou rouvre la session si le nom change)
  function pushProfileToRoom(identity) {
    const N = BR.Net; if (!N || N.status !== 'on') return;
    if (identity && !N.room) { N.close(); N.connect().catch(() => {}); return; }
    N.send({ t: 'profile', look: A.p.look, level: A.level().level });
  }

  // ---------- boutique / équipement ----------
  const fail = msg => ({ ok: false, msg });
  A.canAfford = price => A.p.points >= price;
  A.buySkin = function (id) {
    const s = BR.SKINS.find(x => x.id === id); if (!s) return fail('Skin inconnu.');
    if (A.p.ownedSkins.includes(id)) return fail('Déjà possédé.');
    if (A.p.points < s.price) return fail('Pas assez de points.');
    A.p.points -= s.price; A.p.ownedSkins.push(id); A.p.look.skin = id; A.save(true); pushProfileToRoom();
    return { ok: true };
  };
  A.buyAura = function (id) {
    const a = BR.auraById(id); if (!a) return fail('Aura inconnue.');
    if (A.p.ownedAcc.includes(id)) return fail('Déjà possédée.');
    if (A.p.points < a.price) return fail('Pas assez de points.');
    A.p.points -= a.price; A.p.ownedAcc.push(id); A.p.look.aura = id; A.save(true); pushProfileToRoom();
    return { ok: true };
  };
  A.buyItem = function (id) {
    const it = BR.ITEMS[id]; if (!it) return fail('Objet inconnu.');
    const have = A.p.inv[id] || 0;
    if (have >= A.INV_CAP) return fail('Stock plein pour cet objet (' + A.INV_CAP + ' max).');
    if (A.p.points < it.price) return fail('Pas assez de points.');
    A.p.points -= it.price; A.p.inv[id] = have + 1;
    if (!A.p.loadout.includes(id) && A.p.loadout.length < BR.LOADOUT_SLOTS) A.p.loadout.push(id);
    A.save(); return { ok: true };
  };
  A.equipSkin = function (id) { if (!A.p.ownedSkins.includes(id)) return false; A.p.look.skin = id; A.save(); pushProfileToRoom(); return true; };
  A.equipAura = function (id) {
    if (id && !A.p.ownedAcc.includes(id)) return false;
    A.p.look.aura = id || null; A.save(); pushProfileToRoom(); return true;
  };
  A.toggleLoadout = function (id) {
    const l = A.p.loadout, i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1);
    else { if (!(A.p.inv[id] > 0)) return fail('Tu n\'en as pas : achète-en à la boutique.'); if (l.length >= BR.LOADOUT_SLOTS) return fail(BR.LOADOUT_SLOTS + ' objets maximum.'); l.push(id); }
    A.save(); return { ok: true };
  };
  // objets emportés en partie : [{ id, n }] — n = min(stock, max transportable de l'objet)
  A.INV_CAP = 20;
  A.loadoutForGame = () => A.p.loadout.filter(id => (A.p.inv[id] || 0) > 0).slice(0, BR.LOADOUT_SLOTS).map(id => ({ id, n: Math.min(A.p.inv[id], BR.ITEMS[id].max) }));
  A.consume = function (id) {
    if (!(A.p.inv[id] > 0)) return false;
    A.p.inv[id]--; A.p.stats.items++; A.save(); return true;
  };

  // ---------- récompense quotidienne ----------
  const dayNum = t => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);
  A.dailyState = function () {
    const today = dayNum(Date.now()), last = A.p.daily ? dayNum(A.p.daily) : -10;
    const streak = last === today - 1 ? A.p.streak + 1 : last === today ? A.p.streak : 1;
    return { available: last !== today, streak, reward: 100 + 20 * Math.min(streak - 1, 10) };
  };
  A.claimDaily = function () {
    const s = A.dailyState(); if (!s.available) return fail('Déjà récupérée aujourd\'hui.');
    A.p.daily = Date.now(); A.p.streak = s.streak; A.p.points += s.reward; A.save(true);
    return { ok: true, reward: s.reward, streak: s.streak };
  };

  /* ---------- jeu 2 : compétences, roulette, équipement ---------- */
  A.arena = () => A.p.arena;
  function addSkillXp(id, xp) {
    const AR = BR.ARENA, o = A.p.arena.owned[id]; if (!o) return 0; let ups = 0;
    o.xp += xp; while (o.lv < AR.MAXLV && o.xp >= AR.xpNeed(o.lv)) { o.xp -= AR.xpNeed(o.lv); o.lv++; ups++; }
    if (o.lv >= AR.MAXLV) o.xp = 0; return ups;
  }
  /** tirage à la roulette : renvoie { ok, skill, dupe, xp, ups, free } */
  A.spin = function (rid) {
    const AR = BR.ARENA, R = AR.ROULETTES.find(r => r.id === rid); if (!R) return fail('Roulette inconnue.');
    const a = A.p.arena, free = rid === 'commune' && a.free > 0;
    if (!free && A.p.points < R.price) return fail('Pas assez de points.');
    if (free) a.free--; else A.p.points -= R.price;
    const s = AR.roll(rid); const dupe = !!a.owned[s.id]; let xp = 0, ups = 0;
    if (dupe) { xp = AR.DUPE_XP[s.rarity]; ups = addSkillXp(s.id, xp); }
    else { a.owned[s.id] = { lv: 1, xp: 0 }; if (s.type === 'skill') { const i = a.equip.indexOf(null); if (i >= 0) a.equip[i] = s.id; } }
    A.save(true); return { ok: true, skill: s, dupe, xp, ups, free };
  };
  A.upgradeSkill = function (id) {
    const AR = BR.ARENA, d = AR.skill(id), o = A.p.arena.owned[id]; if (!d || !o) return fail('Compétence non possédée.');
    if (o.lv >= AR.MAXLV) return fail('Niveau maximum atteint.');
    const cost = AR.upCost(d, o.lv); if (A.p.points < cost) return fail('Pas assez de points.');
    A.p.points -= cost; o.lv++; o.xp = 0; A.save(true); return { ok: true, lv: o.lv };
  };
  A.equipSkill = function (slot, id) {
    const a = A.p.arena, d = id && BR.ARENA.skill(id); if (id && (!d || !a.owned[id] || d.type !== 'skill')) return false;
    const prev = a.equip.indexOf(id); if (id && prev >= 0) a.equip[prev] = a.equip[slot];
    a.equip[slot] = id || null; A.save(); return true;
  };
  A.equipUlt = function (id) { const a = A.p.arena, d = BR.ARENA.skill(id); if (!d || d.type !== 'ult' || !a.owned[id]) return false; a.ult = id; A.save(); return true; };
  A.setWeapon = function (id) { if (!BR.ARENA.WEAPONS[id]) return false; A.p.arena.weapon = id; A.save(); return true; };
  /** fin de combat (jeu 2) : points, XP du joueur, XP des compétences, statistiques */
  A.applyArena = function (sum) {
    const before = A.level(), r = sum.res, a = A.p.arena, st = a.st;
    A.p.points += Math.max(0, Math.round(sum.reward.points)); A.p.xp += Math.max(0, Math.round(sum.reward.xp));
    const ups = []; for (const id in sum.skillXp) { const n = addSkillXp(id, sum.skillXp[id]); if (n) ups.push(id); }
    if (r.mode === 'boss' && r.win) { st.boss[r.boss] = (st.boss[r.boss] || 0) + 1; const k = r.boss + '_' + r.diff, t = Math.round(r.time); if (!st.best[k] || t < st.best[k]) { st.best[k] = t; sum.newBest = true; } }
    if (r.mode === 'duel') { if (r.bot) { if (r.win) st.botW++; } else if (r.win) st.duelW++; else st.duelL++; }
    A.p.stats.games++; if (r.solo) A.p.stats.solo++; else A.p.stats.multi++;
    A.save(true);
    const after = A.level();
    return { before, after, levelUp: after.level > before.level, skillUps: ups };
  };

  // ---------- fin de partie ----------
  // r = { points, xp, escaped, died, fuses, revives, downs, time, multi, teamEscaped, map, diff }
  A.applyResult = function (r) {
    const before = A.level();
    const st = A.p.stats;
    A.p.points += Math.max(0, Math.round(r.points || 0));
    A.p.xp += Math.max(0, Math.round(r.xp || 0));
    st.games++; if (r.multi) st.multi++; else st.solo++;
    if (r.escaped) st.escapes++; if (r.died) st.deaths++;
    if (r.teamEscaped) st.wins++;
    st.fuses += r.fuses || 0; st.revives += r.revives || 0; st.downs += r.downs || 0; st.time += Math.round(r.time || 0);
    if (r.escaped && r.map && r.diff) {   // meilleur temps d'évasion par carte/difficulté
      const k = r.map + '_' + r.diff, t = Math.round(r.time);
      if (!st.best[k] || t < st.best[k]) { st.best[k] = t; r.newBest = true; }
    }
    A.save(true);
    const after = A.level();
    return { before, after, levelUp: after.level > before.level };
  };
})();

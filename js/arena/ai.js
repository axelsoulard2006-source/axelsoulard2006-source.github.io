/* ===== arena/ai.js : adversaire de duel contrôlé par l'ordinateur =====
   Il utilise exactement les mêmes commandes qu'un joueur (déplacement, combos, esquive, parade, compétences, ultime). */
(function () {
  const BR = window.BR, V3 = THREE.Vector3;
  const PROFILES = {
    normal: { react: 0.36, dodge: 0.3, parry: 0.12, aggr: 0.55, skill: 0.45, heavy: 0.15 },
    heroique: { react: 0.24, dodge: 0.55, parry: 0.28, aggr: 0.8, skill: 0.75, heavy: 0.25 },
    cauchemar: { react: 0.15, dodge: 0.78, parry: 0.45, aggr: 1, skill: 1, heavy: 0.3 },
  };
  BR.ArenaAI = {
    create(S, f, diffId) {
      const P = PROFILES[diffId] || PROFILES.normal, c = f.ctl;
      const st = { atkT: 0.6, combo: 3, skT: 2, react: 0, kind: '', lastA: null, guardT: 0, holdT: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 2, lastProj: 0 };
      return {
        think(dt) {
          const me = S.me;
          c.move.set(0, 0, 0);
          if (!f.alive || !me.alive) { c.guard = false; return; }
          c.aim.copy(me.center());
          const to = me.pos.clone().sub(f.pos).setY(0), dist = to.length(); to.normalize();
          const side = new V3(to.z, 0, -to.x);
          // --- réactions aux attaques du joueur ---
          const A = me.action;
          if (A && A !== st.lastA && /attack|skill|air/.test(A.type) && dist < 7) {
            st.lastA = A;
            const r = Math.random();
            if (r < P.dodge) { st.react = P.react * (0.7 + Math.random() * 0.6) + (A.step && A.step.hit ? Math.max(0, A.step.hit - 0.25) : 0); st.kind = Math.random() < P.parry / Math.max(0.01, P.dodge) ? 'parry' : 'dash'; }
          }
          // projectiles qui arrivent
          if (S.t - st.lastProj > 0.8) for (const p of S.projs) { if (p.src === me && p.pos.distanceTo(f.center()) < 5 && p.vel.clone().normalize().dot(f.center().sub(p.pos).normalize()) > 0.8) { st.lastProj = S.t; if (Math.random() < P.dodge) { st.react = P.react * 0.6; st.kind = 'dash'; } break; } }
          if (st.react > 0) {
            st.react -= dt;
            if (st.react <= 0) {
              if (st.kind === 'parry') { f.parryT = S.t; c.guard = true; st.guardT = 0.35; }
              else { c.move.copy(side).multiplyScalar(Math.random() < 0.5 ? 1 : -1).addScaledVector(to, -0.3).normalize(); c.dash = true; if (Math.random() < 0.25) c.jump = true; return; }
            }
          }
          if (st.guardT > 0) { st.guardT -= dt; if (st.guardT <= 0) c.guard = false; else return; }
          // --- compétences et ultime ---
          st.skT -= dt;
          if (st.skT <= 0 && !f.action) {
            st.skT = (0.5 + Math.random() * 1.5) / P.skill;
            const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
            for (const i of order) {
              const id = f.kit.s[i]; if (!id) continue;
              const def = BR.ARENA.skill(id), impl = BR.ASkills[id]; if (!def || !impl || (f.cds[i] || 0) > 0 || f.energy < def.cost) continue;
              const k = impl.ai, hp = f.hp / f.maxHp;
              const ok = (k === 'gap' && dist > 5 && dist < 16) || (k === 'close' && dist < 4.5) || (k === 'mid' && dist < 20) || (k === 'self' && dist < 9) || (k === 'heal' && hp < 0.6) || (k === 'react' && dist < 3.5);
              if (ok) { c.skill = i; break; }
            }
          }
          if (f.ult >= 100 && dist < 15 && Math.random() < dt * 1.5) { c.ult = true; }
          // --- déplacement et combos ---
          st.strafeT -= dt; if (st.strafeT <= 0) { st.strafeT = 1 + Math.random() * 2; st.strafe *= -1; }
          if (st.holdT > 0) { st.holdT -= dt; c.attackHeld = st.holdT > 0; }
          if (dist > 2.7) {
            c.move.copy(to).addScaledVector(side, st.strafe * 0.35).normalize();
            if (dist > 9 && Math.random() < dt * 0.6) c.dash = true;
          } else {
            c.move.copy(side).multiplyScalar(st.strafe * 0.4);
            st.atkT -= dt;
            if (st.atkT <= 0) {
              if (Math.random() < P.heavy * dt * 6 && st.combo === 3) { c.attack = true; st.holdT = 0.5; c.attackHeld = true; st.atkT = 1.0; return; }
              c.attack = true; c.attackHeld = false; st.combo--; st.atkT = 0.18 + Math.random() * 0.1;
              if (st.combo <= 0) {
                st.combo = 2 + Math.floor(Math.random() * 3); st.atkT = (0.5 + Math.random() * 0.9) / P.aggr;
                if (Math.random() < 0.35) { c.move.copy(to).multiplyScalar(-1); c.dash = true; }
              }
            }
          }
          if (Math.random() < dt * 0.15) c.jump = true;
        },
      };
    },
  };
})();

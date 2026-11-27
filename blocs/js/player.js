/* ===== player.js : joueur (physique AABB, marche, saut, accroupi, nage, vol, dégâts de chute, oxygène) ===== */
(function () {
  const VX = window.VX, B = VX.B, D = VX.BLOCKS;
  const W = 0.3, HGT = 1.8, EPS = 1e-4, GRAV = 30, JUMP = 9.2;
  class Player {
    constructor() {
      this.pos = new THREE.Vector3(0.5, 40, 0.5); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0;
      this.onGround = false; this.fly = false; this.hp = 20; this.food = 20; this.sat = 5; this.exh = 0;
      this.fallTop = null; this.inWater = false; this.inLava = false; this.eyeWater = false; this.sneak = false; this.sprint = false;
      this.hurtT = 0; this.lavaT = 0; this.air = VX.AIR_MAX || 15;   // oxygène (secondes) sous l'eau
      this.xp = 0;   // points d'expérience (niveau : VX.xpLevel)
    }
    get eye() { return this.pos.y + (this.sneak && !this.fly ? 1.42 : 1.62); }
    solid(world, x, y, z) { const b = D[world.getG(x, y, z)]; return !!(b && b.solid); }
    hits(world, px, py, pz) {
      const x0 = Math.floor(px - W), x1 = Math.floor(px + W - EPS), y0 = Math.floor(py), y1 = Math.floor(py + HGT - EPS), z0 = Math.floor(pz - W), z1 = Math.floor(pz + W - EPS);
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (this.solid(world, x, y, z)) return true;
      return false;
    }
    supported(world, px, pz) {   // y a-t-il un sol sous l'empreinte du joueur à cette position ?
      const y = Math.floor(this.pos.y - 0.05), x0 = Math.floor(px - W), x1 = Math.floor(px + W - EPS), z0 = Math.floor(pz - W), z1 = Math.floor(pz + W - EPS);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (this.solid(world, x, y, z)) return true;
      return false;
    }
    liquids(world) {
      const p = this.pos, at = (dy) => world.getG(Math.floor(p.x), Math.floor(p.y + dy), Math.floor(p.z));
      const f = at(0.2), m = at(0.9), e = world.getG(Math.floor(p.x), Math.floor(this.eye), Math.floor(p.z));
      this.inWater = f === B.EAU || m === B.EAU; this.inLava = f === B.LAVE || m === B.LAVE; this.eyeWater = e === B.EAU ? 1 : e === B.LAVE ? 2 : 0;
      this.inPortal = f === B.PORTAIL || m === B.PORTAIL;
    }
    moveAxis(world, ax, d) {
      const p = this.pos, n = Math.max(1, Math.ceil(Math.abs(d) / 0.35)), s = d / n;
      for (let i = 0; i < n; i++) {
        const nx = p.x + (ax === 0 ? s : 0), ny = p.y + (ax === 1 ? s : 0), nz = p.z + (ax === 2 ? s : 0);
        if (!this.hits(world, nx, ny, nz)) { p.x = nx; p.y = ny; p.z = nz; continue; }
        if (ax === 0) { p.x = s > 0 ? Math.floor(nx + W) - W - EPS : Math.floor(nx - W) + 1 + W + EPS; this.vel.x = 0; }
        else if (ax === 2) { p.z = s > 0 ? Math.floor(nz + W) - W - EPS : Math.floor(nz - W) + 1 + W + EPS; this.vel.z = 0; }
        else { if (s < 0) { p.y = Math.floor(ny) + 1; this.onGround = true; } else p.y = Math.floor(ny + HGT) - HGT - EPS; this.vel.y = 0; }
        return true;
      }
      return false;
    }
    // inp : { f, b, l, r, jump, sneak, sprint } ; renvoie les dégâts de chute éventuels
    step(world, inp, dt, creative) {
      const v = this.vel, p = this.pos; this.liquids(world);
      this.sneak = !!inp.sneak; this.sprint = !!inp.sprint && !inp.sneak && !inp.slow && inp.f && this.food > 6;
      let sp = this.fly ? (this.sprint ? 12 : 7) : this.inWater || this.inLava ? 2.6 : this.sneak ? 1.35 : this.sprint ? 5.7 : 4.3;
      if (inp.slow && !this.fly) sp = Math.min(sp, 1.7);   // bouclier levé ou arc tendu
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      let wx = (inp.f ? fx : 0) - (inp.b ? fx : 0) + (inp.r ? rx : 0) - (inp.l ? rx : 0), wz = (inp.f ? fz : 0) - (inp.b ? fz : 0) + (inp.r ? rz : 0) - (inp.l ? rz : 0);
      const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
      const k = Math.min(1, dt * (this.fly ? 8 : this.onGround ? 14 : 3.2));
      v.x += (wx * sp - v.x) * k; v.z += (wz * sp - v.z) * k;
      if (this.fly) { const ty = inp.jump ? sp : inp.sneak ? -sp : 0; v.y += (ty - v.y) * Math.min(1, dt * 10); }
      else if (this.inWater || this.inLava) { v.y -= 9 * dt; v.y = Math.max(v.y, -3); if (inp.jump) v.y = Math.min(v.y + 26 * dt, 3.4); v.x *= 1 - dt * 2; v.z *= 1 - dt * 2; }
      else { v.y -= GRAV * dt; v.y = Math.max(v.y, -55); if (inp.jump && this.onGround) { v.y = JUMP; this.exh += this.sprint ? 0.2 : 0.05; } }
      const wasG = this.onGround; this.onGround = false;
      // accroupi : on ne tombe pas du bord
      let dx = v.x * dt, dz = v.z * dt;
      if (this.sneak && wasG && !this.fly) { if (!this.supported(world, p.x + dx, p.z)) dx = 0; if (!this.supported(world, p.x + dx, p.z + dz)) dz = 0; }
      this.moveAxis(world, 1, v.y * dt); this.moveAxis(world, 0, dx); this.moveAxis(world, 2, dz);
      if (this.sprint && this.onGround) this.exh += dt * 0.1;
      // chute
      let dmg = 0;
      if (this.onGround || this.fly || this.inWater || this.inLava) {
        if (this.fallTop != null && this.onGround && !creative && !this.inWater) { const h = this.fallTop - p.y; if (h > 3.4) dmg = Math.floor(h - 3); }
        this.fallTop = null;
      } else this.fallTop = this.fallTop == null ? p.y : Math.max(this.fallTop, p.y);
      if (p.y < -30) { dmg = Math.max(dmg, 4); p.y = 80; }
      return dmg;
    }
  }
  VX.Player = Player;
  // niveau d'expérience : points nécessaires pour passer au niveau suivant (7, 9, 11… puis plus raide après 15 et 30)
  VX.xpNeed = L => L < 16 ? 2 * L + 7 : L < 31 ? 5 * L - 38 : 9 * L - 158;
  VX.xpLevel = function (xp) {
    xp = Math.max(0, xp || 0); let level = 0;
    while (level < 1000 && xp >= VX.xpNeed(level)) { xp -= VX.xpNeed(level); level++; }
    return { level, frac: xp / VX.xpNeed(level) };
  };
})();

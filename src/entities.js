// Fighters: the shared Fighter base, the Player (input-driven) and Enemy (AI-driven).
// Movement, timers and state machines live here; drawing lives in sprites.js.
import { ATTACKS, attackPhase, attackDuration } from './combat.js';
import { GROUND_Y, HALL_WIDTH, PHYSICS, PLAYER, KIAI } from './constants.js';

let nextId = 1;

export class Fighter {
  constructor({ x, facing = 1, hp = 100, kind = 'fighter' }) {
    this.id = nextId++;
    this.kind = kind;
    this.x = x;
    this.y = GROUND_Y;      // feet position
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;   // 1 = right, -1 = left
    this.hp = hp;
    this.maxHp = hp;
    this.state = 'idle';    // idle | walk | crouch | jump | attack | block | hurt | dead
    this.stateTime = 0;
    this.attack = null;     // { name, t, hits:Set }
    this.blocking = false;
    this.crouching = false;
    this.grounded = true;
    this.invulnerable = 0;
    this.hurtTimer = 0;
    this.knockVx = 0;
    this.dead = false;
    this.deadTimer = 0;
    this.remove = false;
    this.walkCycle = 0;
    this.flashTimer = 0;
    this.lastEvent = null;  // set by takeHit so the game can trigger sounds/particles
  }

  get canAct() {
    return !this.dead && this.state !== 'hurt' && !this.attack;
  }

  get attackPhase() {
    return this.attack ? attackPhase(ATTACKS[this.attack.name], this.attack.t) : null;
  }

  startAttack(name) {
    this.attack = { name, t: 0, hits: new Set() };
    this.state = 'attack';
    this.stateTime = 0;
    this.blocking = false;
    this.vx = 0;
  }

  // Apply damage/knockback from a resolved hit. Returns true if damage was taken.
  takeHit({ damage, blocked, direction, knockback }) {
    if (this.dead || this.invulnerable > 0) return false;
    if (blocked) {
      this.knockVx = direction * knockback * 0.3;
      this.lastEvent = 'block';
      return false;
    }
    this.hp = Math.max(0, this.hp - damage);
    this.attack = null;
    this.blocking = false;
    this.crouching = false;
    this.knockVx = direction * knockback;
    this.flashTimer = 0.08;
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      this.stateTime = 0;
      this.deadTimer = 0;
      this.lastEvent = 'ko';
    } else {
      this.state = 'hurt';
      this.stateTime = 0;
      this.hurtTimer = PHYSICS.hurtTime;
      this.lastEvent = 'hurt';
    }
    return true;
  }

  // Shared physics for every fighter: gravity, knockback decay, timers.
  integrate(dt, minX, maxX) {
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    this.stateTime += dt;

    if (this.attack) {
      this.attack.t += dt;
      if (this.attack.t >= attackDuration(ATTACKS[this.attack.name])) {
        this.attack = null;
        if (!this.dead) this.state = this.grounded ? 'idle' : 'jump';
      }
    }
    if (this.state === 'hurt') {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) this.state = 'idle';
    }
    if (this.dead) {
      this.deadTimer += dt;
    }

    // Knockback is a separate velocity so it stacks on top of walking.
    const totalVx = this.vx + this.knockVx;
    this.knockVx *= Math.pow(0.001, dt); // fast exponential decay
    if (Math.abs(this.knockVx) < 1) this.knockVx = 0;

    this.x += totalVx * dt;
    this.vy += PHYSICS.gravity * dt;
    this.y += this.vy * dt;
    if (this.y >= GROUND_Y) {
      const wasAirborne = !this.grounded;
      this.y = GROUND_Y;
      this.vy = 0;
      this.grounded = true;
      if (wasAirborne) {
        this.lastEvent = this.lastEvent || 'land';
        if (this.state === 'jump') this.state = 'idle';
      }
    } else {
      this.grounded = false;
    }
    this.x = Math.min(maxX, Math.max(minX, this.x));
  }
}

export class Player extends Fighter {
  constructor(x) {
    super({ x, facing: 1, hp: PLAYER.maxHp, kind: 'player' });
    this.kiaiTimer = 0;     // seconds of Kiai mode left
    this.kiaiCooldown = 0;  // seconds until Kiai can be used again
  }

  get kiaiActive() {
    return this.kiaiTimer > 0;
  }

  get kiaiReady() {
    return this.kiaiCooldown <= 0 && !this.dead;
  }

  // Fraction for the HUD meter: draining while active, refilling while cooling down.
  get kiaiFraction() {
    if (this.kiaiActive) return this.kiaiTimer / KIAI.duration;
    if (this.kiaiCooldown > 0) return 1 - this.kiaiCooldown / KIAI.cooldown;
    return 1;
  }

  activateKiai() {
    if (!this.kiaiReady || this.kiaiActive) return false;
    this.kiaiTimer = KIAI.duration;
    this.kiaiCooldown = KIAI.duration + KIAI.cooldown;
    this.lastEvent = 'kiai';
    return true;
  }

  startAttack(name) {
    super.startAttack(name);
    this.lastEvent = 'attack';
  }

  tickKiai(dt) {
    if (this.kiaiTimer > 0) this.kiaiTimer = Math.max(0, this.kiaiTimer - dt);
    if (this.kiaiCooldown > 0) this.kiaiCooldown = Math.max(0, this.kiaiCooldown - dt);
  }

  // `input` is a snapshot: { left, right, down, jump, punch, kick, block } where
  // jump/punch/kick are "just pressed" edges and the rest are "held".
  update(dt, input) {
    this.tickKiai(dt);
    if (this.dead) {
      this.vx = 0;
      this.integrate(dt, 10, HALL_WIDTH - 10);
      return;
    }
    if (input.kiai) this.activateKiai();
    if (this.state === 'hurt') {
      this.vx = 0;
      this.integrate(dt, 10, HALL_WIDTH - 10);
      return;
    }

    if (this.attack) {
      // Committed to the attack; can still drift in the air.
      if (this.grounded) this.vx = 0;
      this.integrate(dt, 10, HALL_WIDTH - 10);
      return;
    }

    if (this.grounded) {
      this.blocking = Boolean(input.block);
      this.crouching = !this.blocking && Boolean(input.down);
    }

    if (this.blocking) {
      this.vx = 0;
      this.state = 'block';
    } else if (this.crouching) {
      this.vx = 0;
      this.state = 'crouch';
      if (input.punch) this.startAttack('crouchPunch');
      else if (input.kick) this.startAttack('crouchKick');
    } else {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir !== 0) this.facing = dir;
      this.vx = dir * PHYSICS.playerSpeed;
      if (this.grounded) {
        this.state = dir !== 0 ? 'walk' : 'idle';
        if (dir !== 0) this.walkCycle += dt * 9; else this.walkCycle = 0;
        if (input.jump) {
          this.vy = PHYSICS.playerJumpVelocity;
          this.grounded = false;
          this.state = 'jump';
          this.lastEvent = 'jump';
        }
      } else {
        this.state = 'jump';
      }
      if (input.punch) this.startAttack('punch');
      else if (input.kick) this.startAttack('kick');
    }
    this.integrate(dt, 10, HALL_WIDTH - 10);
  }
}

// Enemy archetypes. Each one has a distinct, readable behaviour:
//  - striker: walks straight at you and throws a mid punch. Fragile.
//  - kicker: keeps distance, throws a high kick (duck under it!), then steps back.
//  - boss: faster, mixes punches and high kicks, and sometimes blocks your attacks.
export const ENEMY_TYPES = {
  striker: { hp: 10, speed: 48, range: 20, keepAway: 0, attacks: ['enemyPunch'], cooldown: [0.5, 1.0], retreatTime: 0, score: 100, canBlock: false, boss: false, label: 'Striker' },
  // Kicker mixes a high kick (duck it) with a low sweep (jump it); the wind-ups look different.
  kicker:  { hp: 20, speed: 40, range: 27, keepAway: 12, attacks: ['enemyHighKick', 'enemyLowSweep'], attackWeights: [0.6, 0.4], cooldown: [0.7, 1.2], retreatTime: 0.5, score: 200, canBlock: false, boss: false, label: 'Kicker' },
  // The Master blocks, counters right after a block, and speeds up below 40% health.
  boss:    { hp: 120, speed: 62, range: 25, keepAway: 8, attacks: ['bossPunch', 'bossKick'], cooldown: [0.4, 0.75], retreatTime: 0.25, score: 1000, canBlock: true, blockChance: 0.65, counters: true, rageBelow: 0.4, boss: true, label: 'Master Kage' },
};

export class Enemy extends Fighter {
  constructor(type, x, facing, rng = Math.random) {
    const cfg = ENEMY_TYPES[type];
    super({ x, facing, hp: cfg.hp, kind: type });
    this.cfg = cfg;
    this.rng = rng;
    this.cooldown = 0.4 + rng() * 0.4; // brief pause after entering
    this.retreatTimer = 0;
    this.blockTimer = 0;
    this.blockCooldown = 0;
    this.attackIndex = 0;
  }

  // Weighted random choice when weights are given, otherwise cycle through the list.
  pickAttack() {
    const cfg = this.cfg;
    if (cfg.attackWeights) {
      let r = this.rng();
      for (let i = 0; i < cfg.attacks.length; i++) {
        r -= cfg.attackWeights[i];
        if (r <= 0) return cfg.attacks[i];
      }
      return cfg.attacks[cfg.attacks.length - 1];
    }
    const name = cfg.attacks[this.attackIndex % cfg.attacks.length];
    this.attackIndex += 1;
    return name;
  }

  update(dt, player) {
    const minX = -40, maxX = HALL_WIDTH + 40;
    if (this.dead || this.state === 'hurt') {
      this.vx = 0;
      this.integrate(dt, minX, maxX);
      return;
    }
    if (this.attack) {
      this.vx = 0;
      this.integrate(dt, minX, maxX);
      return;
    }

    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    const cfg = this.cfg;
    this.facing = dx >= 0 ? 1 : -1;
    this.vx = 0;

    const enraged = cfg.rageBelow ? this.hp / this.maxHp <= cfg.rageBelow : false;
    const speed = enraged ? cfg.speed + 12 : cfg.speed;

    if (this.blockTimer > 0) {
      this.blockTimer -= dt;
      this.blocking = this.blockTimer > 0;
      this.state = this.blocking ? 'block' : 'idle';
      // Guard dropped: a counter-attacking boss strikes straight away if you are still close.
      if (!this.blocking && cfg.counters && dist <= cfg.range + 4 && !player.dead) this.cooldown = 0;
      this.integrate(dt, minX, maxX);
      return;
    }
    this.blocking = false;
    if (this.blockCooldown > 0) this.blockCooldown -= dt;

    // The boss reads the player's wind-up and sometimes raises a guard.
    if (cfg.canBlock && this.blockCooldown <= 0 && player.attack && player.attackPhase === 'startup'
        && dist < 34 && !player.dead && this.rng() < (cfg.blockChance || 0.5)) {
      this.blockTimer = 0.5;
      this.blockCooldown = 1.6;
      this.blocking = true;
      this.state = 'block';
      this.integrate(dt, minX, maxX);
      return;
    }

    if (this.retreatTimer > 0) {
      this.retreatTimer -= dt;
      this.vx = -this.facing * speed * 0.8;
      this.state = 'walk';
      this.walkCycle += dt * 8;
    } else if (this.cooldown > 0) {
      this.cooldown -= enraged ? dt * 1.4 : dt;
      if (dist < cfg.keepAway) {
        this.vx = -this.facing * speed * 0.6;
        this.state = 'walk';
        this.walkCycle += dt * 8;
      } else {
        this.state = 'idle';
      }
    } else if (dist > cfg.range || player.dead) {
      if (player.dead) {
        this.state = 'idle';
      } else {
        this.vx = this.facing * speed;
        this.state = 'walk';
        this.walkCycle += dt * 8;
      }
    } else {
      const name = this.pickAttack();
      this.startAttack(name);
      this.cooldown = cfg.cooldown[0] + this.rng() * (cfg.cooldown[1] - cfg.cooldown[0]);
      this.retreatTimer = cfg.retreatTime;
    }
    this.integrate(dt, minX, maxX);
  }
}

// Gently push fighters apart so they do not stand inside each other.
export function separate(a, b, minDist) {
  if (a.dead || b.dead || !a.grounded || !b.grounded) return;
  const dx = b.x - a.x;
  const overlap = minDist - Math.abs(dx);
  if (overlap <= 0) return;
  const dir = dx === 0 ? 1 : Math.sign(dx);
  a.x -= dir * overlap / 2;
  b.x += dir * overlap / 2;
}

// Game orchestration: state machine (start → playing → paused/gameover/victory),
// spawning, hit resolution between fighters, camera, particles and scoring.
// This file has no DOM access so the whole simulation can run in tests.
import { VIEW_W, HALL_WIDTH, GROUND_Y, PHYSICS, SCORE, KIAI, COMBO } from './constants.js';
import { Player, Enemy, separate } from './entities.js';
import { Spawner, LEVEL_1, totalEnemies } from './level.js';
import { ATTACKS, resolveHit } from './combat.js';

const NO_INPUT = { left: false, right: false, down: false, block: false, jump: false, punch: false, kick: false, kiai: false };
const NULL_UI = { showOverlay() {}, setHud() {}, showDialogue(lines, done) { done(); } };

// Exchange shown immediately before the final battle.
export const KAGE_DIALOGUE = [
  ['MASTER KAGE: POWER CREATES RESPECT.'],
  ['TAMÁS: RESPECT CREATES POWER.'],
];
const NULL_AUDIO = { play() {} };

export class Game {
  constructor({ input, audio = NULL_AUDIO, ui = NULL_UI, reducedMotion = false, rng = Math.random, level = LEVEL_1 }) {
    this.input = input;
    this.audio = audio;
    this.ui = ui;
    this.reducedMotion = reducedMotion;
    this.rng = rng;
    this.level = level;
    this.state = 'start';   // start | playing | dialogue | paused | gameover | victory
    this.reset();
  }

  reset() {
    this.player = new Player(90);
    this.enemies = [];
    this.spawner = new Spawner(this.level);
    this.score = 0;
    this.elapsed = 0;
    this.defeated = 0;
    this.defeatedRegular = 0;
    this.particles = [];
    this.texts = [];
    this.camX = 0;
    this.shake = 0;
    this.banner = null;
    this.boss = null;
    this.ending = null;     // 'victory' | 'gameover' while the end animation plays
    this.endTimer = 0;
    this.bonus = null;
    this.combo = 0;         // consecutive hits landed without taking damage
  }

  // Score multiplier earned by the current combo.
  get comboMultiplier() {
    for (const [hits, mult] of COMBO.tiers) if (this.combo >= hits) return mult;
    return 1;
  }

  get remainingEnemies() {
    return totalEnemies(this.level) - this.defeated;
  }

  start() {
    this.reset();
    this.state = 'playing';
    if (this.input) { this.input.active = true; this.input.reset(); }
    this.ui.showOverlay(null);
    this.audio.play('start');
    this.syncHud(true);
  }

  pause() {
    if (this.state !== 'playing' || this.ending) return;
    this.state = 'paused';
    if (this.input) this.input.reset();
    this.ui.showOverlay('paused');
    this.audio.play('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    if (this.input) this.input.reset();
    this.ui.showOverlay(null);
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  // One fixed simulation step. `inputOverride` lets tests drive the player.
  step(dt, inputOverride = null) {
    if (this.state !== 'playing') return;
    this.elapsed += dt;
    const p = this.player;
    const snap = this.ending ? NO_INPUT : (inputOverride || (this.input ? this.input.snapshot() : NO_INPUT));

    p.update(dt, snap);
    this.consumeEvent(p);

    const alive = this.enemies.filter((e) => !e.dead).length;
    for (const s of this.spawner.update(dt, { alive, defeatedRegular: this.defeatedRegular })) this.spawn(s);

    for (const e of this.enemies) {
      e.update(dt, p);
      this.consumeEvent(e);
    }

    // Keep fighters from standing inside each other.
    for (const e of this.enemies) separate(p, e, 11);
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) separate(this.enemies[i], this.enemies[j], 9);
    }

    this.resolveCombat();

    for (const e of this.enemies) {
      if (e.dead && e.deadTimer > PHYSICS.deathLingerTime) e.remove = true;
    }
    this.enemies = this.enemies.filter((e) => !e.remove);

    // Camera eases toward the player with a small look-ahead in the facing direction.
    const target = p.x - VIEW_W / 2 + p.facing * 14;
    this.camX += (target - this.camX) * Math.min(1, dt * 5);
    this.camX = Math.max(0, Math.min(HALL_WIDTH - VIEW_W, this.camX));

    this.updateEffects(dt);
    this.checkEnd(dt);
    this.syncHud();
  }

  spawn({ side, type }) {
    const p = this.player;
    let x = side === 'left' ? this.camX - 24 : this.camX + VIEW_W + 24;
    x = Math.max(-30, Math.min(HALL_WIDTH + 30, x));
    const enemy = new Enemy(type, x, x < p.x ? 1 : -1, this.rng);
    this.enemies.push(enemy);
    if (enemy.cfg.boss) {
      this.boss = enemy;
      this.banner = { text: 'MASTER KAGE APPROACHES', life: 2.6 };
      this.audio.play('bossAppear');
      this.startDialogue(KAGE_DIALOGUE);
    }
  }

  // Freeze the fight while a short exchange is shown; the UI calls back when it is over.
  startDialogue(lines) {
    this.state = 'dialogue';
    if (this.input) { this.input.active = false; this.input.reset(); }
    this.ui.showDialogue(lines, () => {
      if (this.state !== 'dialogue') return;
      this.state = 'playing';
      if (this.input) { this.input.active = true; this.input.reset(); }
    });
  }

  resolveCombat() {
    const p = this.player;
    if (p.attack && p.attackPhase === 'active') {
      const atk = ATTACKS[p.attack.name];
      for (const e of this.enemies) {
        if (e.dead || p.attack.hits.has(e.id)) continue;
        const r = resolveHit(p, e, p.attack.name);
        if (!r.hit) continue;
        p.attack.hits.add(e.id);
        this.onPlayerHits(e, r, atk);
      }
    }
    for (const e of this.enemies) {
      if (!e.attack || e.attackPhase !== 'active' || e.attack.hits.has(p.id) || p.dead) continue;
      const r = resolveHit(e, p, e.attack.name);
      if (!r.hit) continue;
      e.attack.hits.add(p.id);
      this.onEnemyHits(e, r, ATTACKS[e.attack.name]);
    }
  }

  onPlayerHits(enemy, r, atk) {
    const p = this.player;
    const kiai = p.kiaiActive;
    // Kiai strikes cannot be blocked: they break the guard instead.
    if (r.blocked && !kiai) {
      enemy.takeHit({ damage: 0, blocked: true, direction: r.direction, knockback: atk.knockback });
      this.audio.play('block');
      this.addText('BLOCK', enemy.x, enemy.y - 48, '#9ad1ff');
      return;
    }
    const damage = Math.round(atk.damage * (kiai ? KIAI.damageMultiplier : 1));
    const knockback = atk.knockback * (kiai ? KIAI.knockbackMultiplier : 1);
    enemy.takeHit({ damage, blocked: false, direction: r.direction, knockback });
    enemy.lastEvent = null;
    if (r.blocked) this.addText('BREAK!', enemy.x, enemy.y - 52, '#ffb347');

    this.combo += 1;
    const prevMult = this.comboMultiplierFor(this.combo - 1);
    const mult = this.comboMultiplier;
    if (mult > prevMult) this.addText(`X${mult} COMBO`, p.x, p.y - 52, '#ffd166');

    this.score += Math.round(SCORE.hit * mult);
    this.shake = kiai ? 0.18 : 0.12;
    this.audio.play(enemy.dead ? 'enemyDown' : (kiai ? 'hitHeavy' : 'hit'));
    this.burst(enemy.x + r.direction * 4, enemy.y - 28, kiai ? '#ffb347' : '#fff3c4', kiai ? 10 : 6);
    if (enemy.dead) {
      this.defeated += 1;
      if (!enemy.cfg.boss) this.defeatedRegular += 1;
      const points = Math.round(enemy.cfg.score * mult);
      this.score += points;
      this.addText(`+${points}`, enemy.x, enemy.y - 46, '#ffd166');
    }
  }

  comboMultiplierFor(hits) {
    for (const [need, mult] of COMBO.tiers) if (hits >= need) return mult;
    return 1;
  }

  onEnemyHits(enemy, r, atk) {
    const p = this.player;
    if (r.blocked) {
      p.takeHit({ damage: 0, blocked: true, direction: r.direction, knockback: atk.knockback });
      this.audio.play('block');
      this.addText('BLOCK', p.x, p.y - 48, '#9ad1ff');
      this.burst(p.x + r.direction * -4, p.y - 28, '#bfe3ff', 4);
      return;
    }
    const took = p.takeHit({ damage: r.damage, blocked: false, direction: r.direction, knockback: atk.knockback });
    p.lastEvent = null;
    if (!took) return;
    this.combo = 0;
    p.invulnerable = PHYSICS.invulnerableTime;
    this.shake = 0.2;
    this.audio.play('hurt');
    this.burst(p.x, p.y - 28, '#ff8a7a', 6);
  }

  // Sounds/particles for things fighters notice about themselves (jump, landing).
  consumeEvent(f) {
    const ev = f.lastEvent;
    f.lastEvent = null;
    if (!ev) return;
    if (ev === 'jump' && f === this.player) this.audio.play('jump');
    if (ev === 'kiai') {
      this.audio.play('kiaiStart');
      this.addText('KIAI!', f.x, f.y - 54, '#ffb347', 2);
      this.burst(f.x, f.y - 20, '#ffb347', 12);
    }
    if (ev === 'attack' && f === this.player) {
      if (f.kiaiActive) {
        this.audio.play('kiai');
        this.addText('KIAI!', f.x + f.facing * 6, f.y - 50, '#ffb347');
      } else {
        this.audio.play(/kick/i.test(f.attack?.name || '') ? 'kick' : 'punch');
      }
    }
    if (ev === 'land') {
      if (f === this.player) this.audio.play('land');
      this.burst(f.x, GROUND_Y - 1, '#d9b27c', 4, 0.5);
    }
  }

  burst(x, y, color, count, speed = 1) {
    const n = this.reducedMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = (20 + this.rng() * 40) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30 * speed, life: 0.35 + this.rng() * 0.2, color, size: this.rng() < 0.5 ? 1 : 2 });
    }
  }

  addText(text, x, y, color, scale = 1) {
    this.texts.push({ text, x, y, life: scale > 1 ? 1.1 : 0.8, color, scale });
  }

  updateEffects(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 160 * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 18 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    if (this.shake > 0) this.shake -= dt;
  }

  checkEnd(dt) {
    const p = this.player;
    if (!this.ending) {
      if (p.dead) {
        this.ending = 'gameover';
        this.endTimer = 1.7;
        this.audio.play('gameOver');
      } else if (this.boss && this.boss.dead) {
        this.ending = 'victory';
        this.endTimer = 1.7;
        const healthBonus = p.hp * SCORE.healthBonusPerPoint;
        const timeBonus = Math.max(0, Math.round(SCORE.timeBonusLimit - this.elapsed)) * SCORE.timeBonusPerSecond;
        this.bonus = { healthBonus, timeBonus };
        this.score += healthBonus + timeBonus;
        this.audio.play('victory');
      }
      return;
    }
    this.endTimer -= dt;
    if (this.endTimer <= 0) {
      this.state = this.ending;
      if (this.input) this.input.active = false;
      this.ui.showOverlay(this.state, { score: this.score, elapsed: this.elapsed, bonus: this.bonus });
    }
  }

  syncHud(force = false) {
    const boss = this.boss && !this.boss.remove ? { hp: this.boss.hp, maxHp: this.boss.maxHp } : null;
    const p = this.player;
    const kiai = { active: p.kiaiActive, ready: p.kiaiReady && !p.kiaiActive, fraction: p.kiaiFraction };
    this.ui.setHud({ hp: p.hp, maxHp: p.maxHp, score: this.score, remaining: this.remainingEnemies, boss, kiai, combo: this.combo, multiplier: this.comboMultiplier }, force);
  }
}

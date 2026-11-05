// Level definition and spawn scheduling for the first training hall.
// Times are seconds since the level started. `side` is where the enemy enters.
export const LEVEL_1 = {
  name: 'Training Hall',
  maxAlive: 5,
  bossDelay: 1.6,
  spawns: [
    { t: 1.0,  side: 'right', type: 'striker' },
    { t: 3.5,  side: 'left',  type: 'striker' },
    { t: 6.5,  side: 'right', type: 'striker' },
    { t: 7.0,  side: 'right', type: 'striker' },
    { t: 10.5, side: 'right', type: 'kicker' },
    { t: 11.5, side: 'left',  type: 'striker' },
    { t: 14.5, side: 'left',  type: 'kicker' },
    { t: 15.0, side: 'right', type: 'striker' },
    { t: 18.5, side: 'left',  type: 'striker' },
    { t: 18.8, side: 'right', type: 'striker' },
    { t: 22.5, side: 'right', type: 'kicker' },
    { t: 23.0, side: 'left',  type: 'kicker' },
    { t: 26.5, side: 'right', type: 'striker' },
    { t: 27.0, side: 'right', type: 'striker' },
    { t: 27.6, side: 'left',  type: 'striker' },
    { t: 31.0, side: 'left',  type: 'kicker' },
    { t: 31.5, side: 'right', type: 'striker' },
    { t: 32.0, side: 'right', type: 'striker' },
    { t: 36.0, side: 'left',  type: 'kicker' },
    { t: 36.4, side: 'right', type: 'kicker' },
    { t: 40.0, side: 'right', type: 'striker' },
    { t: 40.3, side: 'left',  type: 'striker' },
    { t: 40.8, side: 'right', type: 'striker' },
    { t: 44.5, side: 'left',  type: 'kicker' },
    { t: 45.0, side: 'right', type: 'striker' },
    { t: 45.4, side: 'left',  type: 'striker' },
  ],
};

export function totalEnemies(level) {
  return level.spawns.length + 1; // + boss
}

// Drives the spawn list. Pure state machine: call update() and act on the returned list.
export class Spawner {
  constructor(level = LEVEL_1) {
    this.level = level;
    this.time = 0;
    this.index = 0;
    this.bossSpawned = false;
    this.bossTimer = null;
  }

  get regularDone() {
    return this.index >= this.level.spawns.length;
  }

  // `alive` = number of enemies currently in the arena, `defeated` = regular enemies beaten.
  update(dt, { alive, defeatedRegular }) {
    this.time += dt;
    const out = [];
    while (!this.regularDone && alive + out.length < this.level.maxAlive) {
      const next = this.level.spawns[this.index];
      if (next.t > this.time) break;
      out.push({ ...next });
      this.index += 1;
    }
    if (this.regularDone && !this.bossSpawned && defeatedRegular >= this.level.spawns.length && alive === 0) {
      if (this.bossTimer === null) this.bossTimer = this.level.bossDelay;
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) {
        this.bossSpawned = true;
        out.push({ t: this.time, side: 'right', type: 'boss' });
      }
    }
    return out;
  }
}

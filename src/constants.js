// Central tuning values for Karate Challenge.
// All distances are in "world pixels" at the game's native low resolution.

export const VIEW_W = 320;       // native canvas width (scaled up on screen)
export const VIEW_H = 180;       // native canvas height
export const GROUND_Y = 150;     // y position of the floor line
export const HALL_WIDTH = 1100;  // total length of the training hall
export const STEP = 1 / 60;      // fixed physics step in seconds

export const PHYSICS = {
  gravity: 560,
  playerSpeed: 72,
  playerJumpVelocity: -205,
  hurtTime: 0.35,
  invulnerableTime: 0.7,
  deathLingerTime: 0.9,
};

export const PLAYER = {
  maxHp: 100,
};

// Kiai mode: a short burst of doubled damage that also breaks guards, then a cooldown.
export const KIAI = {
  duration: 4,
  cooldown: 14,
  damageMultiplier: 2,
  knockbackMultiplier: 1.4,
};

// Consecutive hits without taking damage raise the score multiplier (easy to play, hard to master).
export const COMBO = {
  tiers: [[12, 3], [8, 2], [4, 1.5]], // [hits needed, multiplier], checked top-down
};

// Colours are kept in one place so a real art pass can swap palettes later.
export const COLORS = {
  skin: '#f2c9a0',
  skinShade: '#d39c70',
  hairDark: '#2b1d16',
  hairBrown: '#6a3d22',
  eye: '#1a1210',
  giWhite: '#f4f1e6',
  giWhiteShade: '#cfc8b6',
  giGray: '#5b5f68',
  giGrayShade: '#3f434a',
  giBlue: '#3a5ba8',
  giBlueShade: '#2a4177',
  giBlack: '#2c2a30',
  giBlackShade: '#1a191d',
  beltBlack: '#1a1a1a',
  beltRed: '#c8372d',
  beltBlue: '#2f5fc4',
  beltWhite: '#efefef',
  kiai: '#ffb347',
  headbandRed: '#d8402f',
  flash: '#ffffff',
  shadow: 'rgba(0,0,0,0.28)',
};

export const SCORE = {
  hit: 10,
  healthBonusPerPoint: 10,
  timeBonusPerSecond: 20,
  timeBonusLimit: 90,
};

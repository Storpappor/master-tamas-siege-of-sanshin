// The 18 first-package poses, as joint positions in figure space (px, y up, anchor at the soles).
// Planted feet: ankle 5 px above the floor so the sole sits on the anchor row.
const HALF = Math.PI / 2;
const guardLead = { sh: [9, 76], elbow: [15, 65], hand: [22, 75], handType: 'open', handAngle: HALF };
const guardRear = { sh: [-7, 76], elbow: [-6, 64], hand: [3, 68], handType: 'fist', handAngle: 0 };
const standing = (dx = 0, dy = 0) => ({ head: [4 + dx, 87 + dy], shC: [1 + dx, 78 + dy], hipC: [0 + dx, 46 + dy], sw: 21, ww: 15, hw: 17, skirt: 4 });

export const POSES = {
  // --- idle ---
  idle: { ...standing(), lead: { ...guardLead, hip: [5, 46], knee: [12, 27], ankle: [17, 5], footAngle: 0 },
    rear: { ...guardRear, hip: [-5, 46], knee: [-11, 27], ankle: [-17, 5], footAngle: 0 } },
  // --- walk: contact, pass (bob), contact, pass (bob) ---
  walk1: { ...standing(1, 0), flutter: -1, sway: -1,
    lead: { ...guardLead, hand: [21, 74], hip: [5, 46], knee: [11, 27], ankle: [15, 5], footAngle: 0 },
    rear: { ...guardRear, hand: [5, 68], hip: [-4, 46], knee: [-10, 26], ankle: [-15, 5], footAngle: -0.15 } },
  walk2: { ...standing(1, 2), flutter: 1, sway: 1,
    lead: { ...guardLead, hip: [4, 48], knee: [6, 28], ankle: [4, 5], footAngle: 0 },
    rear: { ...guardRear, hand: [4, 69], hip: [-4, 48], knee: [-2, 30], ankle: [-3, 12], footAngle: -0.5 } },
  walk3: { ...standing(1, 0), flutter: -1, sway: 2,
    lead: { ...guardLead, hand: [21, 75], hip: [5, 46], knee: [0, 27], ankle: [-13, 5], footAngle: -0.1 },
    rear: { ...guardRear, hand: [2, 67], hip: [-4, 46], knee: [4, 27], ankle: [16, 5], footAngle: 0 } },
  walk4: { ...standing(1, 2), flutter: 1, sway: 0,
    lead: { ...guardLead, hip: [4, 48], knee: [2, 31], ankle: [-2, 12], footAngle: -0.5 },
    rear: { ...guardRear, hand: [4, 69], hip: [-4, 48], knee: [-6, 28], ankle: [-4, 5], footAngle: 0 } },
  // --- high kick: chambered knee, extended kick, leg coming down ---
  kickWind: { head: [1, 87], shC: [-3, 78], hipC: [0, 46], sw: 21, ww: 15, hw: 17, skirt: 4, flutter: 1, sway: -2,
    lead: { sh: [6, 76], elbow: [12, 66], hand: [16, 74], handType: 'fist', handAngle: HALF, hip: [3, 46], knee: [13, 52], ankle: [9, 37], footAngle: -1.1 },
    rear: { sh: [-10, 76], elbow: [-17, 68], hand: [-19, 60], handType: 'fist', handAngle: -HALF, hip: [-3, 46], knee: [-8, 26], ankle: [-11, 5], footAngle: 0 } },
  highKick: { head: [-6, 84], shC: [-9, 75], hipC: [-1, 46], sw: 21, ww: 15, hw: 17, skirt: 4, flutter: -2, sway: -5,
    lead: { sh: [-3, 74], elbow: [8, 69], hand: [17, 63], handType: 'open', handAngle: -0.4, hip: [3, 48], knee: [24, 68], ankle: [44, 77], footAngle: 0.42, flex: 1 },
    rear: { sh: [-16, 73], elbow: [-23, 65], hand: [-25, 57], handType: 'fist', handAngle: -HALF, hip: [-5, 46], knee: [-9, 26], ankle: [-12, 5], footAngle: 0 } },
  kickDown: { head: [2, 87], shC: [-2, 78], hipC: [0, 46], sw: 21, ww: 15, hw: 17, skirt: 4, flutter: 1, sway: -3,
    lead: { sh: [7, 76], elbow: [14, 66], hand: [20, 73], handType: 'fist', handAngle: HALF, hip: [3, 46], knee: [17, 40], ankle: [23, 22], footAngle: -0.5 },
    rear: { sh: [-9, 76], elbow: [-13, 66], hand: [-6, 63], handType: 'fist', handAngle: 0.3, hip: [-3, 46], knee: [-8, 26], ankle: [-11, 5], footAngle: 0 } },
  // --- low sweep: crouched wind-up, the sweep, crouched recovery ---
  sweepWind: { head: [12, 63], shC: [6, 54], hipC: [-2, 27], sw: 21, ww: 15, hw: 17, skirt: 3, flutter: 1, sway: 2,
    lead: { sh: [12, 52], elbow: [20, 45], hand: [23, 55], handType: 'fist', handAngle: HALF, hip: [3, 27], knee: [15, 22], ankle: [17, 5], footAngle: 0 },
    rear: { sh: [0, 53], elbow: [-7, 30], hand: [-12, 3], handType: 'flat', handAngle: 0, hip: [-7, 27], knee: [-18, 20], ankle: [-16, 5], footAngle: 0 } },
  sweep: { head: [5, 57], shC: [-2, 48], hipC: [-4, 24], sw: 21, ww: 15, hw: 17, skirt: 3, flutter: 2, sway: 4,
    lead: { sh: [6, 47], elbow: [15, 37], hand: [21, 30], handType: 'open', handAngle: -0.6, hip: [0, 24], knee: [22, 16], ankle: [43, 10], footAngle: 0.05, flex: 0.5 },
    rear: { sh: [-10, 47], elbow: [-19, 26], hand: [-23, 3], handType: 'flat', handAngle: 0, hip: [-8, 24], knee: [-19, 16], ankle: [-15, 5], footAngle: 0 } },
  sweepDown: { head: [11, 63], shC: [5, 54], hipC: [-2, 27], sw: 21, ww: 15, hw: 17, skirt: 3, flutter: 0, sway: 3,
    lead: { sh: [11, 52], elbow: [19, 44], hand: [22, 54], handType: 'fist', handAngle: HALF, hip: [3, 27], knee: [17, 19], ankle: [23, 5], footAngle: 0 },
    rear: { sh: [-1, 53], elbow: [-9, 40], hand: [-11, 28], handType: 'open', handAngle: -HALF, hip: [-7, 27], knee: [-18, 20], ankle: [-16, 5], footAngle: 0 } },
  // --- hurt: impact (head back), stagger (hunched) ---
  hurtImpact: { head: [-3, 86], tilt: 0.3, shC: [-6, 76], hipC: [0, 46], sw: 21, ww: 15, hw: 17, skirt: 4, flutter: -2, sway: -4, eyesShut: true, mouthOpen: true,
    lead: { sh: [1, 75], elbow: [9, 80], hand: [17, 86], handType: 'open', handAngle: 0.9, hip: [5, 46], knee: [12, 27], ankle: [17, 5], footAngle: 0 },
    rear: { sh: [-13, 74], elbow: [-20, 66], hand: [-25, 58], handType: 'open', handAngle: -0.7, hip: [-5, 46], knee: [-10, 26], ankle: [-14, 5], footAngle: 0 } },
  hurtStagger: { head: [9, 81], tilt: -0.3, shC: [5, 72], hipC: [0, 46], sw: 21, ww: 15, hw: 17, skirt: 4, flutter: 1, sway: 1, eyesShut: true,
    lead: { sh: [13, 70], elbow: [15, 59], hand: [12, 50], handType: 'fist', handAngle: -HALF, hip: [5, 46], knee: [12, 25], ankle: [15, 5], footAngle: 0 },
    rear: { sh: [-3, 71], elbow: [-8, 60], hand: [-6, 50], handType: 'fist', handAngle: -HALF, hip: [-5, 46], knee: [-9, 26], ankle: [-12, 5], footAngle: 0 } },
  // --- knockdown: topple back, back meets the floor, settled on the back ---
  topple: { head: [-27, 63], tilt: 0.7, shC: [-21, 55], hipC: [-2, 34], sw: 21, ww: 15, hw: 17, skirt: 4, flutter: -2, sway: -6, eyesShut: true, mouthOpen: true,
    lead: { sh: [-15, 56], elbow: [-5, 60], hand: [5, 66], handType: 'open', handAngle: 0.5, hip: [3, 34], knee: [16, 28], ankle: [21, 8], footAngle: 0.35 },
    rear: { sh: [-27, 53], elbow: [-36, 46], hand: [-41, 38], handType: 'open', handAngle: -0.8, hip: [-7, 34], knee: [-13, 20], ankle: [-7, 5], footAngle: -0.1 } },
  floorHit: { head: [-42, 17], tilt: 1.25, shC: [-30, 15], hipC: [0, 12], sw: 21, ww: 15, hw: 17, skirt: 4, flutter: 0, sway: -3, eyesShut: true, mouthOpen: true, beltEnds: false,
    lead: { sh: [-22, 20], elbow: [-15, 34], hand: [-7, 42], handType: 'open', handAngle: 1.1, hip: [4, 14], knee: [20, 30], ankle: [35, 27], footAngle: -0.5 },
    rear: { sh: [-36, 9], elbow: [-45, 22], hand: [-49, 33], handType: 'open', handAngle: 1.6, hip: [-4, 11], knee: [13, 26], ankle: [28, 20], footAngle: -0.6 },
    order: ['rearArm', 'rearLeg', 'torso', 'head', 'leadLeg', 'leadArm'] },
  lying: { head: [-40, 9], tilt: 1.4, shC: [-26, 8], hipC: [0, 7], sw: 21, ww: 15, hw: 17, skirt: 4, flutter: 0, sway: 0, eyesShut: true, beltEnds: false,
    lead: { sh: [-20, 12], elbow: [-8, 15], hand: [2, 13], handType: 'open', handAngle: -0.2, hip: [4, 9], knee: [18, 14], ankle: [30, 8], footAngle: 1.2 },
    rear: { sh: [-28, 4], elbow: [-38, 3], hand: [-45, 3], handType: 'open', handAngle: Math.PI, hip: [-3, 6], knee: [14, 9], ankle: [27, 4], footAngle: 1.35 },
    order: ['rearArm', 'rearLeg', 'torso', 'head', 'leadLeg', 'leadArm'] },
  // --- fallen: the throw victim just landed on his back (its own drawing, distinct from the KO
  //     lying cell): arms flung out, the near knee raised, head to -x, soles toward Tamas ---
  fallen: { head: [-41, 10], tilt: 1.55, shC: [-27, 9], hipC: [0, 8], sw: 21, ww: 15, hw: 17, skirt: 4, flutter: 2, sway: 0, eyesShut: true, mouthOpen: true, beltEnds: false,
    lead: { sh: [-21, 13], elbow: [-13, 23], hand: [-5, 28], handType: 'open', handAngle: 1.3, hip: [4, 10], knee: [15, 23], ankle: [26, 9], footAngle: 1.05 },
    rear: { sh: [-29, 5], elbow: [-39, 9], hand: [-47, 12], handType: 'open', handAngle: 2.7, hip: [-3, 7], knee: [13, 11], ankle: [31, 5], footAngle: 1.3 },
    order: ['rearArm', 'rearLeg', 'torso', 'head', 'leadLeg', 'leadArm'] },
  // --- get-up: kneeling on the rear knee, hand on the floor ---
  getUp: { head: [12, 61], tilt: -0.1, shC: [6, 52], hipC: [0, 24], sw: 21, ww: 15, hw: 17, skirt: 3, flutter: 1, sway: 2,
    lead: { sh: [12, 51], elbow: [19, 41], hand: [18, 31], handType: 'fist', handAngle: -HALF, hip: [3, 24], knee: [16, 22], ankle: [18, 5], footAngle: 0 },
    rear: { sh: [0, 50], elbow: [-8, 33], hand: [-14, 3], handType: 'flat', handAngle: 0, hip: [-4, 22], knee: [-14, 7], ankle: [-24, 5], footAngle: -2.7 } },
};

// Cell map: which pose fills which slot of the first package. Every slot is its own drawing.
export const CELLS = [
  [0, 'idle', 'idle'], [4, 'walk1', 'walk'], [5, 'walk2', 'walk'], [6, 'walk3', 'walk'], [7, 'walk4', 'walk'],
  [8, 'kickWind', 'enemyHighKick/startup'], [9, 'highKick', 'enemyHighKick/active'], [10, 'kickDown', 'enemyHighKick/recovery'],
  [12, 'sweepWind', 'enemyLowSweep/startup'], [13, 'sweep', 'enemyLowSweep/active'], [14, 'sweepDown', 'enemyLowSweep/recovery'],
  [16, 'hurtImpact', 'hurt'], [17, 'hurtStagger', 'hurt'],
  [20, 'topple', 'knockdown'], [21, 'floorHit', 'knockdown'], [22, 'lying', 'knockdown'],
  [36, 'fallen', 'fallen'], [40, 'getUp', 'getUp'],
];
export const MAP = {
  image: 'kicker.png',
  cell: { w: 128, h: 112 },
  anchor: { x: 64, y: 111 },
  columns: 4,
  states: { idle: [0], walk: [4, 5, 6, 7], enemyHighKick: [8, 9, 10], enemyLowSweep: [12, 13, 14], hurt: [16, 17], knockdown: [20, 21, 22], fallen: [36], getUp: [40] },
};

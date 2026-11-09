# Per-cell notes and declared departures from the brief

Bounds are measured on `kicker.png` (`export-report.json`): width × height, the horizontal extent
relative to the anchor column (negative = behind, toward the ponytail) and the height above the
anchor row (0 = the sole row 111). Every cell faces right; the renderer mirrors. Nothing here asks
for a gameplay change.

**Shared K1 anatomy choice.** The figure follows the approved K1 concept's proportions rather than
the brief's procedural landmarks: belt centre **60 px up** (the brief's procedural waist was 40),
shoulders **78 px**, chin **81 px**, long legs with the knees at **27 px**, cream shin wraps from
9 to 21 px, bare feet 14 px long, a **38 px stance** (the brief's procedural stance was 20) and
the ponytail reaching **16-23 px behind** the anchor instead of 23-25. The head is about 15 px
tall with its centre 87 px up (brief: 79): K1's head sits higher on a shorter torso. The
collision box is untouched; the torso stays inside the ±12 px collision column in every standing
cell. The palette is 21 colours sampled from K1 (gi navy ramp, skin, belt blue, wrap cream, hair
brown, emblem gold), independent of the H1 locked palette.

| Cell | State | Bounds | Note |
|---|---|---|---|
| 0 | `idle` | 50 × 96, x −23..+26, up 0..95 | 96 px target met, soles on row 111, crown on row 16. K1 guard: rear fist at the chest, lead hand open and raised. 50 px wide against the brief's estimate of 46 (K1's wider stance). |
| 4 | `walk` | 46 × 96, x −21..+24 | contact stride A (feet at ±15), guard kept up, tail swung back. |
| 5 | `walk` | 38 × 98, x −13..+24, up 0..97 | passing step: body bobs 2 px (98 px, the brief's allowance), the planted sole stays on row 111, the swing foot 12 px up with toes down. |
| 6 | `walk` | 45 × 96, x −19..+25 | contact stride B (opposite legs). |
| 7 | `walk` | 38 × 98, up 0..97 | passing step B, same bob. |
| 8 | `enemyHighKick` startup | 43 × 96, x −23..+19 | knee chambered high on the lead leg, rear arm back for balance, weight on the rear leg; 96 px. |
| 9 | `enemyHighKick` active | 84 × 93, x −29..+54, up 0..92 | lead leg extended: the **foot occupies x +38..+54, 68-84 px up**, inside the hitbox (12-54 ahead, 60-84 up); no pixel of the leg lies below 58 px beyond +24, so a crouching Tamas's head (56 px) stays clear. Torso leans back, lead arm low for balance. 93 px tall (head dropped back). Reaches the cell's usable edge minus 9 px, as the brief allows. |
| 10 | `enemyHighKick` recovery | 49 × 96, x −18..+30 | leg coming down, foot 22 px up, body upright again. |
| 12 | `enemyLowSweep` startup | 51 × 72, x −24..+26, up 0..71 | the crouched preparation as the sweep's own first cell: rear hand flat on the floor, lead fist up. 72 px (brief about 75). |
| 13 | `enemyLowSweep` active | 80 × 66, x −26..+53, up 0..65 | the **sweeping shin and foot along x +30..+53, 4-24 px up**, inside the hitbox (8-52 ahead, 4-24 up); supporting leg deeply bent, hand on the floor, torso low (crown 65 px). Replaces the procedural crouching-punch frame. |
| 14 | `enemyLowSweep` recovery | 57 × 72, x −24..+32 | crouch again, the lead leg back under the body, hand off the floor. |
| 16 | `hurt` | 56 × 95, x −29..+26, up 0..94 | impact: head thrown back (mouth open, eyes shut), lead arm flung up, torso leaning back. |
| 17 | `hurt` | 43 × 90, x −18..+24, up 0..89 | stagger: hunched forward, hands dropped. |
| 20 | `knockdown` | 77 × 72, x −45..+31, up 0..71 | topple backward at about 40°, knees bent, arms out; an explicit posture choice (the procedural art has no topple pose). |
| 21 | `knockdown` | 96 × 50, x −53..+42, up 0..49 | back meeting the floor, legs raised, arms up; 96 px long, under the 120 px maximum, 11 px clear of the cell edge behind. |
| 22 | `knockdown` | 92 × 20, x −53..+38, up 0..19 | settled on the back, **head toward −x, feet toward +x** with the soles facing Tamas; knees slightly raised; 92 px long. The head reaches 3 px beyond the brief's −50 estimate; the feet sit +38 from the hip anchor (brief: 19-29), matching the S1 Striker's +40 choice so that both types land with their feet at Tamas's lead foot. Flatter (20 px) than the brief's 33 px estimate. |
| 36 | `fallen` | 94 × 36, x −55..+38, up 0..35 | **its own drawing**, distinct from the KO lying cell 22 (revision 2: every populated slot is a separate drawing): the throw victim just landed on his back, mouth open, the near arm flung up off the floor, the far arm thrown out above the head, the near knee raised; head toward −x, soles toward Tamas. 94 px long, 36 px tall (brief estimate 33); the far hand reaches −55, 9 px clear of the cell edge. |
| 40 | `getUp` | 64 × 70, x −36..+27, up 0..69 | kneeling up on the rear knee, lead foot planted, rear hand on the floor, lead fist on the knee; the rear foot trails to −36 (brief estimate −25). 70 px (brief 71). |
| 24, 28, 32 | `held`, `thrownDown1`, `thrownDown2` | empty | **PENDING** the paired visual decision on the victim arm treatment; unmapped, so the game draws the procedural poses. |

Differences a reviewer may want to send back: the K1 belt height, stance width and **head-centre
placement** (87 px up against the brief's 79; shared anatomy choice above), the **kick's balance
arm** in cell 9 (drawn low and forward; could be drawn back instead), the **flat 20 px lying
silhouette** of the KO cell 22 (the fallen cell 36 is taller, 36 px), and the trailing rear foot
of cell 40. Each is a drawing choice inside the brief's cell and anchor; none touches the map.

# Background lighting pass

Re-lights the two production backgrounds to the approved colour and lighting references
received 8 November 2026. The geometry of both strips is untouched (same dimensions,
architecture, floor row, doorway and sign positions); only colour and light change, so no
renderer constant moves.

| Environment | Reference | Treatment |
|---|---|---|
| Street (`assets/backgrounds/street.png`, 2000 x 360) | `ref-street-neon.webp`, "GATAN · LJUSSTUDIE" | Very dark midnight navy/purple surfaces that fall away toward the roofline; vivid magenta and cyan neon tubes on the drainpipes at the building joints and a magenta tube around the SANSHIN KAN KARATE sign, each throwing a broad coloured wash over its facade; warm amber shop windows, lamps and the dojo door; cyan/magenta/amber reflections smeared down the wet pavement and road. |
| Dojo (`assets/backgrounds/dojo.png`, 1840 x 360) | `ref-dojo-muted.webp`, "DOJON · DÄMPAD NEON" | Calmer and warmer: navy/purple shadows that keep the wall and floor detail, soft nearly neutral light under the first-screen tube, warm amber glow around the TEAM SANSHIN emblem and under the tube above it, muted natural reds on the padded pillars and mat borders, sage/grey-green mat centres, matte materials, no neon. |

The two treatments are deliberately different: the street is dark and vivid, the dojo is
restrained. Neither reference's character, score, arrow, caption or border is in the assets.

## Reproducing

`relight.mjs` is pure pixel code (no DOM). `relight.html` loads the production PNGs, runs it
and exposes `window.RL` for driving from a console; it needs to be served over http (for
example `npm start`, then `/docs/art/lighting/relight.html`). The parameters that produced
the shipped assets are the defaults in `relight.mjs`; the measured geometry (sign box,
drainpipe columns and their tube colours, the yellow building's cool zone, the dojo tube
fixtures and emblem box) is in `relight.html`.

The inputs were the previous production assets:

| Input | SHA-256 |
|---|---|
| street.png (street-v1 delivery) | a8dcc7c05dfcd488510ed7895afb10638a25857dc5baf8e9206b39aa5732a934 |
| dojo.png (approved full dojo) | 8db7254d4f917504fcf4acc34b7e92b7b7a6383f2dba40bc550333f70af58ce8 |

Those earlier versions remain in git history and can be restored by reverting the lighting
commit.

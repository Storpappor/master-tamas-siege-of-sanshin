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

## How the street light is built (revision 3)

The neon is horizontal and lives in the shopfront architecture: a thin magenta border around
the Sanshin sign (its short vertical sides included), a magenta strip under the pizzeria
awning, a cyan edge under the ETC sign plate and one short cyan strip above a window near the
dojo. No full-height tubes: drainpipes, seams and door sides are dark architecture that only
receives light. The approved reference's palette and atmosphere are kept; its tall vertical
tubes are deliberately not reproduced.

Each receiving surface is treated on its own, so no light continues as one band across
facade, pavement and road:

- **Sign**: the face stays dark, the lettering is kept warm and readable and the red roundel
  keeps its colour; only the magenta tube around the frame emits, with a short spill.
- **Shopfront strips**: each throws a wider coloured spill over its own shopfront, with dark
  sections between shops.
- **Lamps**: only saturated bright lamp glass counts as a core; it keeps its brightness and
  gets a small cone. Pale cream (painted lamp cones, curtains, sills) is ordinary material.
- **Windows**: ground-floor glass is amber-lit while keeping each pane's own shading, so
  plants, frames and curtains survive; upper glass stays dark and cool.
- **Facade**: dark night grade that preserves the pixel texture; tubes on the drainpipes add
  a local spill of a few pixels, nothing broad.
- **Pavement**: a limited pool under each light source, following the slab texture.
- **Road**: irregular clusters of short horizontal strokes anchored under each source. Bands
  of rows switch off by noise, rows inside a band are gated again, strokes are one or two
  rows thick with varying width, offset and intensity, so there are substantial dark gaps
  and no ladder.

## How the dojo is built (revision 3)

Target: `ref-dojo-approved-direction.webp` (approved 8 November 2026). The dojo is drawn as
materials under light, from the preserved approved asset, keeping every object position:

- **Wall**: continuous indigo plaster from a smooth vertical gradient with low-frequency
  mottling and fine grain, independent of the source's flat colour bands. Plaster is
  recognised by the source's own wall palette (the few exact colours that cover most of the
  wall band), so wall objects of any colour survive. The painted peach halo behind TEAM
  SANSHIN and the pale glow behind the exit sign become plain plaster; the lettering keeps its
  dark navy and the red brush stroke its colour.
- **Floor**: the source's projected geometry is kept exactly: every red pixel of the
  approved asset is band (the angled mat edges included), everything else is mat, and the
  band runs under each pillar's foot. Within those shapes the material is drawn: sage-grey-
  green mats with an embossed cross-hatch, stitched rows, low-frequency wear, grain and a
  tone of their own per mat; a dark rim and a light bevel at each edge (from distances to
  the bands), panel and mid seams, a lighter compressed edge on some mats and sparse training
  scuffs of varying length and direction. Deep burgundy bands with a seam shadow against the
  mats. Dry and matte.
- **Light**: dark indigo ambient falling off toward the ceiling and the wall/floor junction;
  each ceiling fixture casts a cone down the wall and a wide soft pool on the floor that
  crosses mats and bands alike; only the fixture above TEAM SANSHIN is amber, the rest are
  near neutral. The floor darkens toward the viewer.
- **Materials**: cylindrical shading and a dark edge on the padded pillars, muted ivory
  bands, warm wood, cream banner cloth, and the wall mirror as dark glass with a light frame
  and a soft sheen (it shares a colour with the plaster, so it is placed by a measured box).
  The hanging calligraphy scroll on the boss screen is protected by a measured box (its cream
  cloth is otherwise read as plaster), and the painted glow around the SANSHIN KAN banner is
  flattened to plaster by another. Tube faces and the exit sign stay emissive.
- **Shadows**: a cool shadow along the wall base on the floor, contact shadows at the pillar
  bases and beside each pillar foot, and drop shadows under every wall object.

The in-game frame was verified pixel-identical to the loaded `dojo.png` outside the fighters,
so the earlier washed-out look was entirely in the asset, not a runtime tint.

## Reproducing

`relight.mjs` is pure pixel code (no DOM). `relight.html` loads the preserved pre-relight
assets from `source/`, runs the pipeline and exposes `window.RL` for driving from a console;
it needs to be served over http (for example `npm start`, then
`/docs/art/lighting/relight.html`). Always regenerate from `source/`, never from an already
lit output. The parameters that produced the shipped assets are the defaults in
`relight.mjs`; the measured geometry (sign box, door box, drainpipe columns and their tube
colours, the yellow building's cool zone, the dojo tube fixtures and emblem box) is in
`relight.html`.

The inputs are the previous production assets, kept byte-identical in `source/`:

| Input | SHA-256 |
|---|---|
| street.png (street-v1 delivery) | a8dcc7c05dfcd488510ed7895afb10638a25857dc5baf8e9206b39aa5732a934 |
| dojo.png (approved full dojo) | 8db7254d4f917504fcf4acc34b7e92b7b7a6383f2dba40bc550333f70af58ce8 |

Those earlier versions remain in git history and can be restored by reverting the lighting
commit.

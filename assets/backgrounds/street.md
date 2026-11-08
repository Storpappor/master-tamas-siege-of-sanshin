# Street background (`street.png`)

Delivered as `street-artwork-v1` on 8 November 2026, built to the measured brief in
`docs/street-background/STREET-BRIEF.md` (revision 2). Installed byte-for-byte.

| Item | Value |
|---|---|
| File | `assets/backgrounds/street.png` |
| Dimensions | 2000 x 360 px, RGBA, every pixel opaque |
| SHA-256 | 548709aa41e305ec1d7b9df6c23f699f28dc5d6e393ae788327d8f6d9db1df11 (lighting pass revision 2 of 8 November 2026; the street-v1 delivery it was made from is a8dcc7c0…, kept in `docs/art/lighting/source/`, see `docs/art/lighting/README.md`) |
| Placement | world art column 0 (world x 0), row 0, drawn 1:1, never scaled |
| Wall/pavement boundary | art row 244 (`FLOOR_TOP` 122); walkable feet rows 244-340 |
| Dojo door leaves | art x 1816-1903, y 140-243 (88 x 104): two 44 px leaves centred on x 1860 (`exit.x` 930) |
| Dojo sign | art x 1783-1936, y 100-135; lettering and lighting are in the image |

Renderer values that match this geometry (`src/renderer.js`): `DOOR_TOP` 70, so the near-black
fill drawn during the walk-in covers exactly the leaves; `drawDoorArrow` top 24, so the blinking
arrow (art rows 48-86) sits above the sign. `exit` (x 930, width 44) and the entry trigger are
unchanged.

Landmarks, art columns: opening cream bay 0-60, Pizzeria Söder 60-225, residential bays,
ETC 420-603, residential door 802-901, number 15 and the grey gate 1100-1235, Sanshin dojo
1777-1942, yellow building edge 1942-2000. All café furniture ends above row 244.

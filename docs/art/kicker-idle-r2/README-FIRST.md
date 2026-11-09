# Kicker idle, revision 2 (kicker-idle-r2): ONE revised native idle cell

**Status: APPROVED by the founder on 9 November 2026 as artwork and as the visual reference for the
remaining first-package poses** (the approval names this PNG by SHA-256
`9ea1446a850e6c7222b2326a5c4ff9ea4937030b0d689f8e703938f05edb0ee0`; it approves the idle only). One
cell, produced after the founder rejected the kicker-native-v1 look. PR #15 is unchanged and stays an unapproved
draft; nothing here is staged, committed or mapped into the game. Cells 24, 28 and 32 of the
Kicker sheet remain pending and unmapped. No gameplay change.

## Sources

| Reference | Role | SHA-256 |
|---|---|---|
| `Kicker-K1-design-concept.png` (from `kicker-K1-H1-S1-references.zip`) | character identity | `323adb5460796e3fa31700ec4c367dd4bb36fb1bdaf1a31a8b4f8eca54e73713` |
| `kicker-idle-look-study.webp` (the new idle look study, received 9 November) | guidance for face, volume, cloth folds and guard; **the sampled source of this cell** | `5b64dd6a2c4c1c277a5a8ec01566d92c3df90f59523cde7647d51f948774e289` |
| `tamas-idle-h1.png` (96 × 96 H1 idle reference) and `assets/sprites/striker.png` cell 0 | size comparison only | as in the references archive / on `main` |

## Method (the S1 method, not the joint painter)

`sample-idle.mjs` samples the look study at **one shared scale** (0.08488 native px per source px:
11.78 source px per native px), chosen so the figure stands **exactly 96 px with its soles on the
anchor row 111**; the source anchor column is the midpoint of the stance. Each native pixel takes
the **most common palette colour** of the source block it covers and is opaque when at least half
of that block is; the **28-colour palette is derived from the study's own colours** (25 used);
alpha is binary; 27 light edge pixels lost to sampling were set to the study's outline colour so
the figure is outlined all round like H1 and S1. Nothing is painted: the joint-and-primitive
painter of kicker-native-v1 does not touch this cell. The cell is reproducible from the study
with the same command.

## The cell

| Item | Value |
|---|---|
| `kicker-idle-r2.png` | 128 × 112 RGBA, one cell, anchor (64, 111), binary alpha, 25 colours |
| figure | **58 × 96 px**, cols 35-92 (x −29 .. +28), rows 16-111: crown row 16, soles row 111 |
| `kicker-idle-r2.json` | `{ cell 128 × 112, anchor (64, 111), columns 1, states: { idle: [0] } }`, loadable by `SpriteSheet` as a one-state sheet |
| `export-report.json` | scale, anchor, palette, bounds, hashes |

Retained from the brief and the feedback: K1's determined profile, swept hair and ponytail with
the blue tie; a lean body in a loose dark gi with visible folds and the sleeve/trouser shading;
the open front hand and the separate rear fist; the gold chest emblem; the blue belt tied with
two tails; cream shin wraps and bare feet; the 96 px height in the 128 × 112 cell with the (64,
111) anchor. The stance is 58 px wide (K1's wide guard stance; the brief's estimate was 46-52).

## Evidence labels

- `kicker-idle-r2-beside-h1-s1.png` is an **artwork preview** of this cell. It is the only image
  that shows the r2 look.
- The real-game captures and the fallen/get-up images in PR #15 and kicker-native-v1 show the
  **previous, rejected candidate** (`b2c0e4ef…`) or the **procedural fallback**, not this look.
- A future game capture of r2-style artwork will name the exact sheet SHA-256 and cells it holds.

## Next: the remaining 17 cells

`ART-CHAT-HANDOFF.md` briefs the art chat; `sample-studies.mjs` with `studies.json` assembles
pose studies in this style into the sheet at the idle's fixed scale and palette (proven to
reproduce this cell pixel for pixel from the idle study).

## What to look at

`kicker-idle-r2-beside-h1-s1.png`: the cell at **3×** facing right as drawn and facing left as the
renderer mirrors it, beside H1 Tamas (90 px) and the S1 Striker (86 px) on one floor line, and the
same four at **1×** (art pixels). Artwork preview, not a game capture. With this look accepted, the
remaining 17 cells follow through pose studies (see `ART-CHAT-HANDOFF.md`).

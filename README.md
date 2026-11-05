# Master Tamás: Siege of Sanshin

An original, NES-inspired side-scrolling karate game. Defend the dojo against the
Shadow League and face Master Kage at the end of the hall.

**Play it in your browser:** https://storpappor.github.io/master-tamas-siege-of-sanshin/

## Controls

| Action | Keyboard | Phone |
|---|---|---|
| Move | ← → or A D | ◀ ▶ buttons |
| Crouch | ↓ or S | ▼ button |
| Jump | Space (or ↑ / W) | Jump |
| Punch / Kick / Block | J / K / L | Punch / Kick / Block |
| Kiai (double damage, breaks guards) | I | Kiai |
| Pause | P or Esc | Pause button |

Tips: duck under high kicks, jump over low sweeps, hold block to absorb a strike,
and land hits without getting hit to build a combo multiplier.

## Run locally

It is plain HTML, CSS and JavaScript with no build step. Serve the folder with any
static file server, for example:

```bash
npx serve .
```

Opening `index.html` directly from disk does not work in most browsers because the
game uses JavaScript modules; it needs to be served over http.

## Layout

```
index.html         page shell: HUD, overlays, touch buttons
karate-game.css    styles (all prefixed "kg-")
assets/            hero sprite sheet
src/               game code (ES modules)
```

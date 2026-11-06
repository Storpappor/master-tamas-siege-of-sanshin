// Gameplay guard: the files that define rules, AI, waves, controls and sound must be identical
// to where this branch forked from main. Visual work never touches them; if main itself moves,
// rebase first. Usage: node scripts/guard.mjs   (exit code 1 lists the differing files)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GUARDED = ['src/game.js', 'src/entities.js', 'src/combat.js', 'src/level.js', 'src/input.js', 'src/audio.js', 'src/constants.js'];
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

let base;
try { base = git('merge-base', 'origin/main', 'HEAD'); } catch { base = 'HEAD'; }
const changed = git('diff', '--name-only', base, '--', ...GUARDED).split('\n').filter(Boolean);
if (changed.length) {
  console.error(`Gameplay files differ from ${base.slice(0, 7)}:\n` + changed.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log(`Guard OK: ${GUARDED.length} gameplay files identical to ${base.slice(0, 7)}`);

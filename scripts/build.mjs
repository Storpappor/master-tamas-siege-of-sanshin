// "Production build" for a static site: validate, then copy the deployable files into dist/.
// There is no bundler on purpose: the game is plain ES modules and needs no compile step.
import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
// Files that make up the playable site; tests, scripts and tooling stay out of the build.
const DEPLOY = ['index.html', 'karate-game.css', '.nojekyll', 'assets', 'src'];

execFileSync(process.execPath, [join(ROOT, 'scripts', 'lint.mjs')], { stdio: 'inherit' });

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
for (const entry of DEPLOY) {
  await cp(join(ROOT, entry), join(DIST, entry), { recursive: true, filter: (src) => !src.endsWith('.DS_Store') });
}

async function size(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? await size(full) : (await stat(full)).size;
  }
  return total;
}
console.log(`Build OK -> dist (${(await size(DIST) / 1024).toFixed(1)} KB)`);

// Lightweight lint without external dependencies:
//  1. Every JS file must parse (node --check).
//  2. Every relative import must point to a file that exists.
//  3. index.html must only reference files that exist.
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const problems = [];

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = await walk(ROOT);
const jsFiles = files.filter((f) => /\.(m?js)$/.test(f));

for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    problems.push(`${relative(ROOT, file)}: syntax error\n${err.stderr}`);
  }
  const src = await readFile(file, 'utf8');
  const importRe = /(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  let m;
  while ((m = importRe.exec(src))) {
    const spec = m[1] || m[2];
    const target = resolve(dirname(file), spec);
    const ok = await stat(target).then((s) => s.isFile()).catch(() => false);
    if (!ok) problems.push(`${relative(ROOT, file)}: import "${spec}" does not exist`);
  }
}

for (const html of files.filter((f) => f.endsWith('.html'))) {
  const src = await readFile(html, 'utf8');
  const refRe = /(?:src|href)=["']([^"'#?]+)["']/g;
  let m;
  while ((m = refRe.exec(src))) {
    const ref = m[1];
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith('/') || ref.startsWith('data:')) continue;
    const target = resolve(dirname(html), ref);
    const ok = await stat(target).then((s) => s.isFile()).catch(() => false);
    if (!ok) problems.push(`${relative(ROOT, html)}: reference "${ref}" does not exist`);
  }
}

if (problems.length) {
  console.error('Lint problems:\n' + problems.map((p) => ' - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Lint OK (${jsFiles.length} JS files checked)`);

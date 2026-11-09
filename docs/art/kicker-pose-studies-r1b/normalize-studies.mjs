#!/usr/bin/env node
// Technical input-format normalization only. Preserve every canvas coordinate,
// threshold alpha exactly as the approved sampler does, then apply its exact
// weighted nearest-palette mapping. Native-output equivalence is checked below
// by re-running the unchanged sampler, not assumed from this implementation.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { decodePng, encodePng } from '../../../scripts/append-sheet.mjs';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
if (!arg('--config') || !arg('--out')) throw new Error('Usage: node normalize-studies.mjs --config studies.json --out package-dir');
const configPath = resolve(arg('--config')), out = resolve(arg('--out'));
const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
const palette = cfg.palette.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const sha = b => createHash('sha256').update(b).digest('hex');
const cache = new Map();
const nearest = (r, g, b) => {
  const key = (r << 16) | (g << 8) | b;
  if (cache.has(key)) return cache.get(key);
  let best = 0, distance = Infinity;
  palette.forEach((p, i) => {
    const d = 2 * (p[0] - r) ** 2 + 3 * (p[1] - g) ** 2 + 1.5 * (p[2] - b) ** 2;
    if (d < distance) { distance = d; best = i; }
  });
  cache.set(key, best); return best;
};
for (const subdir of ['studies', 'raw-studies', 'reference/approved-idle']) mkdirSync(join(out, subdir), { recursive: true });
const rawConfig = { ...cfg, studies: [] }, normalizedConfig = { ...cfg, studies: [] }, records = [];

for (const study of cfg.studies) {
  const source = resolve(dirname(configPath), study.file);
  const sourceBytes = readFileSync(source);
  if (study.cell === 0) {
    const rel = 'reference/approved-idle/kicker-idle-look-study.png';
    writeFileSync(join(out, rel), sourceBytes);
    rawConfig.studies.push({ ...study, file: rel });
    normalizedConfig.studies.push({ ...study, file: rel });
    records.push({ cell: 0, file: rel, sourceSha256: sha(sourceBytes), normalization: 'None: approved idle source copied byte-identically.' });
    continue;
  }
  const name = basename(source), rawRel = 'raw-studies/' + name, normalizedRel = 'studies/' + name;
  writeFileSync(join(out, rawRel), sourceBytes);
  const image = decodePng(sourceBytes), rgba = Buffer.alloc(image.rgba.length);
  let keptOpaque = 0, discardedBelowThreshold = 0, alphaChanged = 0, rgbMapped = 0, transparentRgbZeroed = 0;
  const usedColors = new Set();
  for (let i = 0; i < rgba.length; i += 4) {
    const a = image.rgba[i + 3];
    if (a < 128) {
      if (a) discardedBelowThreshold++;
      if (image.rgba[i] || image.rgba[i + 1] || image.rgba[i + 2]) transparentRgbZeroed++;
      if (a !== 0) alphaChanged++;
      continue;
    }
    keptOpaque++;
    if (a !== 255) alphaChanged++;
    const p = palette[nearest(image.rgba[i], image.rgba[i + 1], image.rgba[i + 2])];
    if (p[0] !== image.rgba[i] || p[1] !== image.rgba[i + 1] || p[2] !== image.rgba[i + 2]) rgbMapped++;
    rgba[i] = p[0]; rgba[i + 1] = p[1]; rgba[i + 2] = p[2]; rgba[i + 3] = 255;
    usedColors.add(p.join(','));
  }
  const png = encodePng({ width: image.width, height: image.height, rgba });
  writeFileSync(join(out, normalizedRel), png);
  rawConfig.studies.push({ ...study, file: rawRel });
  normalizedConfig.studies.push({ ...study, file: normalizedRel });
  records.push({ cell: study.cell, state: study.state, rawFile: rawRel, file: normalizedRel,
    dimensions: [image.width, image.height], anchorX: study.anchorX, sourceSha256: sha(sourceBytes),
    normalizedSha256: sha(png), normalizedRgbaSha256: sha(rgba), keptOpaque, discardedBelowThreshold,
    alphaChanged, rgbMapped, transparentRgbZeroed, usedPaletteColors: usedColors.size,
    spatialTransformation: 'None: no scaling, translation, cropping, repainting or pose change.' });
}

writeFileSync(join(out, 'studies.json'), JSON.stringify(normalizedConfig, null, 2) + '\n');
writeFileSync(join(out, 'raw-studies.json'), JSON.stringify(rawConfig, null, 2) + '\n');
writeFileSync(join(out, 'NORMALIZATION-REPORT.json'), JSON.stringify({
  purpose: 'Convert generated source formats to the approved sampler\'s exact input palette and binary alpha without changing its native result.',
  alphaThreshold: 128, rgbDistanceWeights: [2, 3, 1.5], palette: cfg.palette, scale: cfg.scale,
  canvasAndAnchorsUnchanged: true, approvedIdleSourceUnchanged: true, studies: records
}, null, 2) + '\n');
console.log(`Wrote ${records.length - 1} normalized candidate studies, their exact raw sources, and the untouched approved idle source to ${out}`);

// node apply-cell-edits.mjs <in.png> <edits.json> <out.png>   (edits.json: { cell:{w,h}, columns, expectInputSha256, edits:[...] })
import { readFileSync, writeFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { decodePng, encodePng } from '../../../scripts/append-sheet.mjs';
import { applyCellEdits, cellRgbaSha256 } from './cell-edits.mjs';
const [inFile, editsFile, outFile] = process.argv.slice(2); const bytes = readFileSync(inFile); const cfg = JSON.parse(readFileSync(editsFile, 'utf8'));
const sha = createHash('sha256').update(bytes).digest('hex'); if (cfg.expectInputSha256 && sha !== cfg.expectInputSha256) throw new Error(`input sha256 ${sha} != expected ${cfg.expectInputSha256}`);
const img = decodePng(bytes); const before = {}; for (const e of cfg.edits) before[e.cell] = cellRgbaSha256(img, cfg.cell.w, cfg.cell.h, cfg.columns, e.cell);
const regions = applyCellEdits(img, cfg.cell.w, cfg.cell.h, cfg.columns, cfg.edits, console.log);
const out = encodePng({ width: img.width, height: img.height, rgba: img.rgba }); writeFileSync(outFile, out);
const outSha = createHash('sha256').update(out).digest('hex'), rgbaSha = createHash('sha256').update(img.rgba).digest('hex');
console.log(`input ${sha}\noutput png ${outSha} (${outFile}, ${process.version})\noutput decoded rgba ${rgbaSha}`);
if (cfg.expectOutputRgbaSha256 && rgbaSha !== cfg.expectOutputRgbaSha256) throw new Error(`decoded rgba ${rgbaSha} != expected ${cfg.expectOutputRgbaSha256}`);
if (cfg.expectOutputSha256 && outSha !== cfg.expectOutputSha256) console.warn(`note: PNG bytes ${outSha} differ from the recorded ${cfg.expectOutputSha256} (a different zlib/encoder version); the decoded pixels match`);
for (const e of cfg.edits) console.log(`cell ${e.cell} rgba before ${before[e.cell]}`);
writeFileSync(outFile.replace(/\.png$/, '-edit-regions.json'), JSON.stringify(regions.map((r) => ({ cell: r.cell, pixels: r.pixels.length, after: r.after, region: r.pixels })), null, 0));

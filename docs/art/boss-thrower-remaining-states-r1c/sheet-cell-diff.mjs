import { readFileSync } from 'node:fs';
import { decodePng } from '../../../scripts/append-sheet.mjs';
const [a, b, cw, ch] = process.argv.slice(2); const A = decodePng(readFileSync(a)), B = decodePng(readFileSync(b)); const [CW, CH] = [cw, ch].map(Number);
if (A.width !== B.width || A.height !== B.height) throw new Error('size differs'); const diff = [];
for (let cell = 0; cell < (A.height / CH) * 4; cell++) { const cx = cell % 4, cy = Math.floor(cell / 4); let n = 0; for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const o = ((cy * CH + y) * A.width + cx * CW + x) * 4; for (let k = 0; k < 4; k++) if (A.rgba[o + k] !== B.rgba[o + k]) { n++; break; } } if (n) diff.push(`cell ${cell}: ${n} px`); }
console.log(diff.length ? 'cells differing: ' + diff.join(', ') : 'identical');

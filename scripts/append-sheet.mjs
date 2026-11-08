// Append review sheets to the production hero atlas without touching existing cells.
//
//   node scripts/append-sheet.mjs <candidate.json> [more.json ...]
//
// Each candidate is an isolated package map (same cell size, anchor and column count as
// assets/sprites/tamas.json) with its PNG next to it. Its rows are appended below the
// production image and its state arrays are re-indexed by the number of cells already in the
// atlas, so `grab: [0, 1, 2]` in a package becomes `grab: [56, 57, 58]` in production.
// Existing cells are copied byte for byte and the script refuses to overwrite a state that is
// already mapped. Zero dependencies: a minimal PNG decoder/encoder lives below.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = join(ROOT, 'assets', 'sprites', 'tamas.json');

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  let p = 8; let ihdr = null, plte = null, trns = null; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') ihdr = data; else if (type === 'IDAT') idat.push(data); else if (type === 'PLTE') plte = data; else if (type === 'tRNS') trns = data;
    p += 12 + len;
  }
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4), depth = ihdr[8], type = ihdr[9];
  if (ihdr[12] !== 0) throw new Error('Interlaced PNGs are not supported');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`Unsupported colour type ${type}`);
  const bpp = Math.max(1, (channels * depth) >> 3), stride = (width * channels * depth + 7) >> 3;
  const raw = inflateSync(Buffer.concat(idat));
  const rows = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = rows.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    prev = cur;
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4;
    if (type === 6) rows.copy(rgba, o, y * stride + x * 4, y * stride + x * 4 + 4);
    else if (type === 2) { rows.copy(rgba, o, y * stride + x * 3, y * stride + x * 3 + 3); rgba[o + 3] = 255; }
    else if (type === 3) {
      const idx = depth === 8 ? rows[y * stride + x] : (rows[y * stride + ((x * depth) >> 3)] >> (8 - depth - ((x * depth) % 8))) & ((1 << depth) - 1);
      rgba[o] = plte[idx * 3]; rgba[o + 1] = plte[idx * 3 + 1]; rgba[o + 2] = plte[idx * 3 + 2]; rgba[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
    } else throw new Error(`Unsupported colour type ${type}`);
  }
  return { width, height, rgba };
}

const CRC_TABLE = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

export function encodePng({ width, height, rgba }) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Pure: returns the merged image and map. `base` and each candidate are { map, image }.
export function appendSheets(base, candidates) {
  const { map } = base;
  const columns = map.columns || 1;
  if (base.image.width !== map.cell.w * columns) throw new Error('Production image width does not match the map');
  if (base.image.height % map.cell.h) throw new Error('Production image height is not a whole number of rows');
  let image = base.image;
  const states = { ...map.states };
  for (const cand of candidates) {
    const m = cand.map;
    for (const key of ['w', 'h']) if (m.cell[key] !== map.cell[key]) throw new Error(`${cand.name}: cell size differs from production`);
    for (const key of ['x', 'y']) if (m.anchor[key] !== map.anchor[key]) throw new Error(`${cand.name}: anchor differs from production`);
    if ((m.columns || 1) !== columns) throw new Error(`${cand.name}: column count differs from production`);
    if (cand.image.width !== image.width) throw new Error(`${cand.name}: image width differs from production`);
    if (cand.image.height % map.cell.h) throw new Error(`${cand.name}: image height is not a whole number of rows`);
    const offset = (image.height / map.cell.h) * columns;
    for (const [state, cells] of Object.entries(m.states)) {
      if (states[state]) throw new Error(`${cand.name}: state "${state}" is already mapped in production`);
      states[state] = cells.map((c) => c + offset);
    }
    image = { width: image.width, height: image.height + cand.image.height, rgba: Buffer.concat([image.rgba, cand.image.rgba]) };
  }
  return { image, map: { ...map, states } };
}

function loadSheet(jsonPath) {
  const map = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const pngPath = map.image ? resolve(dirname(jsonPath), map.image) : jsonPath.replace(/\.json$/, '.png');
  return { name: jsonPath, map, image: decodePng(readFileSync(pngPath)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const candidates = process.argv.slice(2).map((p) => loadSheet(resolve(p)));
  if (!candidates.length) { console.error('usage: node scripts/append-sheet.mjs <candidate.json> [more.json ...]'); process.exit(1); }
  const base = loadSheet(JSON_PATH);
  const before = base.image;
  const { image, map } = appendSheets(base, candidates);
  if (!image.rgba.subarray(0, before.rgba.length).equals(before.rgba)) throw new Error('Existing cells changed; aborting');
  const { image: _omit, ...jsonMap } = map; // the production map has no `image` key: the PNG sits next to it
  const pngPath = JSON_PATH.replace(/\.json$/, '.png');
  writeFileSync(pngPath, encodePng(image));
  writeFileSync(JSON_PATH, JSON.stringify(jsonMap, null, 2) + '\n');
  const added = candidates.flatMap((c) => Object.keys(c.map.states));
  console.log(`Atlas ${before.width} x ${before.height} -> ${image.width} x ${image.height}; added ${added.map((s) => `${s} ${JSON.stringify(map.states[s])}`).join(', ')}`);
}

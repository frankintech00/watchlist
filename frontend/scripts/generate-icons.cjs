/**
 * generate-icons.cjs
 * Generates PNG icons (192x192 and 512x512) for the Watchlist PWA.
 * Dark background (#141414) with a white "W" polygon.
 * Pure Node.js — no extra npm packages required.
 */

const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

// ── CRC32 ────────────────────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// ── PNG helpers ───────────────────────────────────────────────────────────────

function uint32BE(n) {
  return Buffer.from([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF])
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const crcInput  = Buffer.concat([typeBytes, data])
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc32(crcInput))])
}

function encodePNG(width, height, rgbPixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width,  0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8]  = 8  // bit depth
  ihdr[9]  = 2  // color type: RGB
  ihdr[10] = 0  // compression method
  ihdr[11] = 0  // filter method
  ihdr[12] = 0  // interlace method

  // Raw scanlines: filter byte (0 = None) followed by RGB triplets
  const stride = 1 + width * 3
  const raw    = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0  // filter byte
    for (let x = 0; x < width; x++) {
      const pi = (y * width + x) * 3
      const ri = y * stride + 1 + x * 3
      raw[ri]     = rgbPixels[pi]
      raw[ri + 1] = rgbPixels[pi + 1]
      raw[ri + 2] = rgbPixels[pi + 2]
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Point-in-polygon (ray casting) ───────────────────────────────────────────

function pointInPolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// ── W polygon (normalised 0-1 space) ─────────────────────────────────────────
//
//  Outer top-left → outer top-right → outer bottom-right → (inner points) → outer bottom-left
//  Produces a thick serif-style W that reads clearly at 192 px and 512 px.

const W_POLY_NORM = [
  [0.05, 0.10],   // outer top-left
  [0.23, 0.10],   // inner top-left
  [0.40, 0.68],   // lower-left valley
  [0.50, 0.44],   // centre peak
  [0.60, 0.68],   // lower-right valley
  [0.77, 0.10],   // inner top-right
  [0.95, 0.10],   // outer top-right
  [0.77, 0.90],   // outer bottom-right
  [0.67, 0.90],   // inner bottom-right
  [0.50, 0.63],   // centre bottom
  [0.33, 0.90],   // inner bottom-left
  [0.23, 0.90],   // outer bottom-left (was missing — closes the shape correctly)
]

// ── Icon generation ───────────────────────────────────────────────────────────

function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 3)

  const BG = [0x14, 0x14, 0x14]  // #141414
  const FG = [0xFF, 0xFF, 0xFF]  // #FFFFFF

  // Map normalised [0,1] coords into [pad, size-pad] pixel space
  const pad   = Math.round(0.07 * size)
  const inner = size - 2 * pad
  const scaled = W_POLY_NORM.map(([x, y]) => [pad + x * inner, pad + y * inner])

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = pointInPolygon(x + 0.5, y + 0.5, scaled) ? FG : BG
      const i = (y * size + x) * 3
      pixels[i]     = color[0]
      pixels[i + 1] = color[1]
      pixels[i + 2] = color[2]
    }
  }

  return encodePNG(size, size, pixels)
}

// ── Write icons ───────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

for (const size of [192, 512]) {
  const png     = generateIcon(size)
  const outPath = path.join(outDir, `icon-${size}.png`)
  fs.writeFileSync(outPath, png)
  console.log(`  ✓ ${outPath} (${png.length} bytes)`)
}

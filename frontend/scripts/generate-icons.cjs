/**
 * generate-icons.cjs
 * Draws the Watchlist app icon — a screen in the app's primary colour with a tick on it ("watched") —
 * and writes it as PNGs for the PWA manifest plus an SVG favicon.
 * Pure Node.js: shapes are signed-distance functions, anti-aliased by supersampling.
 * Runs automatically before every build (see "prebuild" in package.json).
 */

const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

const INK   = [0x0d, 0x12, 0x1b]
const PRIMARY = [0xa1, 0xb5, 0xd8]  // the app's primary colour

// ── Geometry (unit square, 0-1) ───────────────────────────────────────────────

const SCREEN = { x0: 0.18, y0: 0.24, x1: 0.82, y1: 0.68, r: 0.08 }
const STAND  = { x0: 0.36, y0: 0.75, x1: 0.64, y1: 0.81, r: 0.03 }
const TICK   = [[0.36, 0.46], [0.46, 0.56], [0.65, 0.36]]
const TICK_HALF_WIDTH = 0.036
const TILE_RADIUS = 0.22

function roundedRect(px, py, { x0, y0, x1, y1, r }) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const dx = Math.abs(px - cx) - ((x1 - x0) / 2 - r)
  const dy = Math.abs(py - cy) - ((y1 - y0) / 2 - r)
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r
}

function segmentDistance(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax, vy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
}

/** Colour of the icon at a point: [r, g, b, a]. */
function sample(x, y, { maskable }) {
  // Maskable icons are full-bleed with the artwork inside the central safe zone.
  const scale = maskable ? 0.74 : 1
  const u = (x - 0.5) / scale + 0.5
  const v = (y - 0.5) / scale + 0.5

  if (!maskable && roundedRect(x, y, { x0: 0, y0: 0, x1: 1, y1: 1, r: TILE_RADIUS }) > 0) {
    return [0, 0, 0, 0]
  }
  const onTick = Math.min(
    segmentDistance(u, v, TICK[0], TICK[1]),
    segmentDistance(u, v, TICK[1], TICK[2]),
  ) < TICK_HALF_WIDTH
  if (roundedRect(u, v, SCREEN) < 0) return onTick ? [...INK, 255] : [...PRIMARY, 255]
  if (roundedRect(u, v, STAND) < 0) return [...PRIMARY, 255]
  return [...INK, 255]
}

// ── PNG encoding ──────────────────────────────────────────────────────────────

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

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // colour type: RGBA

  const stride = 1 + size * 4
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function render(size, options) {
  const SS = 4  // 4x4 supersampling
  const rgba = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, options)
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3]
        }
      }
      const i = (y * size + x) * 4
      if (a > 0) { rgba[i] = r / a; rgba[i + 1] = g / a; rgba[i + 2] = b / a }
      rgba[i + 3] = a / (SS * SS)
    }
  }
  return encodePNG(size, rgba)
}

// ── SVG (favicon) — same geometry ─────────────────────────────────────────────

const pct = (n) => +(n * 100).toFixed(2)
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
const rect = (s, fill) =>
  `<rect x="${pct(s.x0)}" y="${pct(s.y0)}" width="${pct(s.x1 - s.x0)}" height="${pct(s.y1 - s.y0)}" rx="${pct(s.r)}" fill="${fill}"/>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${pct(TILE_RADIUS)}" fill="${hex(INK)}"/>
  ${rect(SCREEN, hex(PRIMARY))}
  ${rect(STAND, hex(PRIMARY))}
  <path d="M${TICK.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(' L')}" fill="none" stroke="${hex(INK)}" stroke-width="${pct(TICK_HALF_WIDTH * 2)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`

// ── Write files ───────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

const outputs = [
  ['icon-192.png', render(192, { maskable: false })],
  ['icon-512.png', render(512, { maskable: false })],
  ['icon-maskable-512.png', render(512, { maskable: true })],
  ['icon.svg', Buffer.from(svg)],
]
for (const [name, data] of outputs) {
  fs.writeFileSync(path.join(outDir, name), data)
  console.log(`  ✓ icons/${name} (${data.length} bytes)`)
}

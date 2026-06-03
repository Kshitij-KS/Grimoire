/**
 * Generate minimal valid PNG favicon files for the Grimoire brand.
 * Uses raw PNG generation with zlib deflate (Node.js built-in).
 * Brand colors: dark #0A0A0B, gold #E5A85A
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Brand colors as RGB
const DARK = [0x0A, 0x0A, 0x0B];
const GOLD = [0xE5, 0xA8, 0x5A];

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createPNGChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  
  return Buffer.concat([length, typeAndData, crc]);
}

function createPNG(width, height, pixelData) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createPNGChunk('IHDR', ihdr);
  
  // IDAT chunk - raw pixel data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 3)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 3;
      const dstIdx = y * (1 + width * 3) + 1 + x * 3;
      rawData[dstIdx] = pixelData[srcIdx];
      rawData[dstIdx + 1] = pixelData[srcIdx + 1];
      rawData[dstIdx + 2] = pixelData[srcIdx + 2];
    }
  }
  const compressed = deflateSync(rawData);
  const idatChunk = createPNGChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createPNGChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Draw a simple "G" letter icon using brand colors.
 * Gold letter on dark background.
 */
function generateIconPixels(size) {
  const pixels = Buffer.alloc(size * size * 3);
  
  // Fill with dark background
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = DARK[0];
    pixels[i * 3 + 1] = DARK[1];
    pixels[i * 3 + 2] = DARK[2];
  }
  
  // Draw a stylized "G" shape in gold
  // The G is drawn as a circle with a gap on the right and a horizontal bar
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.4;
  const innerR = size * 0.28;
  const thickness = outerR - innerR;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Ring of the G (exclude top-right quadrant for the gap)
      const isInRing = dist >= innerR && dist <= outerR;
      const isInGap = angle > -Math.PI / 4 && angle < Math.PI / 4 && dy < 0;
      
      // Horizontal bar of the G (middle-right)
      const barY = cy;
      const barStartX = cx;
      const barEndX = cx + outerR;
      const barThickness = thickness;
      const isInBar = x >= barStartX && x <= barEndX && 
                      y >= barY - barThickness / 2 && y <= barY + barThickness / 2;
      
      // Top horizontal cap (top of the gap closure on right side)
      // We actually want a simple G: ring with gap at top-right, and a horizontal bar at center-right
      
      if ((isInRing && !isInGap) || isInBar) {
        const idx = (y * size + x) * 3;
        pixels[idx] = GOLD[0];
        pixels[idx + 1] = GOLD[1];
        pixels[idx + 2] = GOLD[2];
      }
    }
  }
  
  return pixels;
}

// Generate all sizes
const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
];

for (const { name, size } of sizes) {
  const pixels = generateIconPixels(size);
  const png = createPNG(size, size, pixels);
  const outPath = join(publicDir, name);
  writeFileSync(outPath, png);
  console.log(`Created ${name} (${size}x${size}) - ${png.length} bytes`);
}

console.log('\nAll favicon assets generated successfully!');

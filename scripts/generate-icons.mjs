import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = join(root, "public", "icons");
const appDir = join(root, "app");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function createCanvas(size, scale) {
  return {
    size: size * scale,
    data: new Float32Array(size * scale * size * scale * 4),
  };
}

function setPixel(canvas, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) {
    return;
  }
  const index = (y * canvas.size + x) * 4;
  canvas.data[index] = r;
  canvas.data[index + 1] = g;
  canvas.data[index + 2] = b;
  canvas.data[index + 3] = a;
}

function drawRoundedRect(canvas, x, y, width, height, radius, color) {
  const [r, g, b, a = 255] = color;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(canvas.size, Math.ceil(x + width));
  const y1 = Math.min(canvas.size, Math.ceil(y + height));

  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const cx = px + 0.5;
      const cy = py + 0.5;
      const nearestX = Math.max(x + radius, Math.min(cx, x + width - radius));
      const nearestY = Math.max(y + radius, Math.min(cy, y + height - radius));
      const dx = cx - nearestX;
      const dy = cy - nearestY;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(canvas, px, py, r, g, b, a);
      }
    }
  }
}

function downsample(canvas, size, scale) {
  const output = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const index =
            ((y * scale + sy) * canvas.size + (x * scale + sx)) * 4;
          const alpha = canvas.data[index + 3] / 255;
          r += canvas.data[index] * alpha;
          g += canvas.data[index + 1] * alpha;
          b += canvas.data[index + 2] * alpha;
          a += alpha;
        }
      }
      const out = (y * size + x) * 4;
      if (a > 0) {
        output[out] = Math.round(r / a);
        output[out + 1] = Math.round(g / a);
        output[out + 2] = Math.round(b / a);
      }
      output[out + 3] = Math.round((a / (scale * scale)) * 255);
    }
  }

  return output;
}

function drawIcon(size, { maskable = false, rounded = true } = {}) {
  const scale = 4;
  const canvas = createCanvas(size, scale);
  const S = canvas.size;
  const radius = rounded && !maskable ? S * 0.22 : 0;

  // Background: rounded square with a subtle violet gradient and glow.
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const t = (x / S) * 0.35 + (y / S) * 0.65;
      let r = lerp(151, 124, t);
      let g = lerp(93, 58, t);
      let b = lerp(246, 237, t);

      const glowX = x / S - 0.22;
      const glowY = y / S - 0.12;
      const glow = Math.max(0, 1 - Math.sqrt(glowX * glowX + glowY * glowY) * 2.2);
      r = Math.min(255, r + glow * 34);
      g = Math.min(255, g + glow * 22);
      b = Math.min(255, b + glow * 20);
    }
  }

  // Re-draw using the rounded-rect helper for the background so corners are
  // transparent on non-maskable icons.
  if (radius > 0) {
    canvas.data.fill(0);
    drawRoundedRect(canvas, 0, 0, S, S, radius, [139, 92, 246]);
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        const index = (y * S + x) * 4;
        if (canvas.data[index + 3] === 0) {
          continue;
        }
        const t = (x / S) * 0.35 + (y / S) * 0.65;
        let r = lerp(151, 124, t);
        let g = lerp(93, 58, t);
        let b = lerp(246, 237, t);
        const glowX = x / S - 0.22;
        const glowY = y / S - 0.12;
        const glow = Math.max(
          0,
          1 - Math.sqrt(glowX * glowX + glowY * glowY) * 2.2,
        );
        r = Math.min(255, r + glow * 34);
        g = Math.min(255, g + glow * 22);
        b = Math.min(255, b + glow * 20);
        canvas.data[index] = r;
        canvas.data[index + 1] = g;
        canvas.data[index + 2] = b;
      }
    }
  } else {
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        const t = (x / S) * 0.35 + (y / S) * 0.65;
        let r = lerp(151, 124, t);
        let g = lerp(93, 58, t);
        let b = lerp(246, 237, t);
        const glowX = x / S - 0.22;
        const glowY = y / S - 0.12;
        const glow = Math.max(
          0,
          1 - Math.sqrt(glowX * glowX + glowY * glowY) * 2.2,
        );
        r = Math.min(255, r + glow * 34);
        g = Math.min(255, g + glow * 22);
        b = Math.min(255, b + glow * 20);
        setPixel(canvas, x, y, r, g, b, 255);
      }
    }
  }

  // Torii mark, sized into the safe zone for maskable icons.
  const glyphScale = maskable ? 0.62 : 0.68;
  const unit = (S * glyphScale) / 24;
  const offset = (S - unit * 24) / 2;
  const u = (value) => offset + value * unit;
  const white = [255, 255, 255, 255];

  drawRoundedRect(canvas, u(4.6), u(7.0), unit * 14.8, unit * 1.55, unit * 0.6, white);
  drawRoundedRect(canvas, u(6.2), u(10.4), unit * 11.6, unit * 1.45, unit * 0.55, white);
  drawRoundedRect(canvas, u(7.05), u(7.0), unit * 1.55, unit * 10.9, unit * 0.5, white);
  drawRoundedRect(canvas, u(15.4), u(7.0), unit * 1.55, unit * 10.9, unit * 0.5, white);
  drawRoundedRect(canvas, u(11.25), u(4.9), unit * 1.5, unit * 2.5, unit * 0.5, white);

  return encodePng(size, size, downsample(canvas, size, scale));
}

mkdirSync(iconDir, { recursive: true });

const outputs = [
  { path: join(iconDir, "icon-192.png"), buffer: drawIcon(192) },
  { path: join(iconDir, "icon-512.png"), buffer: drawIcon(512) },
  {
    path: join(iconDir, "maskable-512.png"),
    buffer: drawIcon(512, { maskable: true, rounded: false }),
  },
  {
    path: join(iconDir, "apple-touch-icon.png"),
    buffer: drawIcon(180, { rounded: false }),
  },
  { path: join(appDir, "icon.png"), buffer: drawIcon(512) },
];

for (const output of outputs) {
  writeFileSync(output.path, output.buffer);
  console.log(
    `wrote ${output.path} (${Math.round(output.buffer.length / 1024)} KB)`,
  );
}

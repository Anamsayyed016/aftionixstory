import sharp from "sharp";

const path = "public/aftionix-logo.jpg";
const img = sharp(path);
const meta = await img.metadata();
const { width, height } = meta;

const { data, info } = await img
  .raw()
  .toBuffer({ resolveWithObject: true });

const channels = info.channels;

// Sample the bright glow of the "A" strokes: a band across the vertical
// center of the letter, well inside the hexagon, avoiding background noise.
const samples = [];
const yStart = Math.floor(height * 0.25);
const yEnd = Math.floor(height * 0.55);
const xStart = Math.floor(width * 0.3);
const xEnd = Math.floor(width * 0.7);

function brightness(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

for (let y = yStart; y < yEnd; y += 2) {
  for (let x = xStart; x < xEnd; x += 2) {
    const idx = (y * width + x) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // Only count clearly blue/cyan, bright, saturated pixels (the glow strokes),
    // skip near-black background and near-white text.
    if (b > 150 && b >= r + 20 && brightness(r, g, b) < 245 && brightness(r, g, b) > 60) {
      samples.push([r, g, b]);
    }
  }
}

samples.sort((a, b) => brightness(...b) - brightness(...a));
const top = samples.slice(0, Math.max(1, Math.floor(samples.length * 0.15)));

function avg(arr, i) {
  return Math.round(arr.reduce((s, c) => s + c[i], 0) / arr.length);
}

function toHex(n) {
  return n.toString(16).padStart(2, "0");
}

const rAvg = avg(top, 0);
const gAvg = avg(top, 1);
const bAvg = avg(top, 2);

console.log("samples used:", samples.length, "top-bright subset:", top.length);
console.log("brightest-glow average RGB:", rAvg, gAvg, bAvg);
console.log("brightest-glow hex:", `#${toHex(rAvg)}${toHex(gAvg)}${toHex(bAvg)}`);

// Also compute overall average of all matched blue pixels (a "mid" tone).
const midR = avg(samples, 0);
const midG = avg(samples, 1);
const midB = avg(samples, 2);
console.log("mid-tone average RGB:", midR, midG, midB);
console.log("mid-tone hex:", `#${toHex(midR)}${toHex(midG)}${toHex(midB)}`);

/**
 * Build App Router favicon assets from public/aftionix-logo.jpg.
 * Crops to the glowing "A" mark (drops the wordmark) so 16×16 stays legible.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPath = path.join(root, "public", "aftionix-logo.jpg");
const appDir = path.join(root, "app");
const previewDir = path.join(root, "tmp-screenshots");

/** Pack PNG buffers into a multi-size ICO (PNG-compressed entries). */
function pngsToIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];

  for (const png of pngBuffers) {
    // Read IHDR width/height
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    entries.push({
      width: width >= 256 ? 0 : width,
      height: height >= 256 ? 0 : height,
      size: png.length,
      offset,
      png,
    });
    offset += png.length;
  }

  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0); // reserved
  out.writeUInt16LE(1, 2); // type = icon
  out.writeUInt16LE(count, 4);

  let entryOffset = 6;
  for (const e of entries) {
    out.writeUInt8(e.width, entryOffset);
    out.writeUInt8(e.height, entryOffset + 1);
    out.writeUInt8(0, entryOffset + 2); // color palette
    out.writeUInt8(0, entryOffset + 3); // reserved
    out.writeUInt16LE(1, entryOffset + 4); // color planes
    out.writeUInt16LE(32, entryOffset + 6); // bits per pixel
    out.writeUInt32LE(e.size, entryOffset + 8);
    out.writeUInt32LE(e.offset, entryOffset + 12);
    entryOffset += 16;
  }

  for (const e of entries) {
    e.png.copy(out, e.offset);
  }
  return out;
}

async function markPipeline() {
  const meta = await sharp(srcPath).metadata();
  const w = meta.width ?? 1254;
  const h = meta.height ?? 1254;

  // Tight crop on the glowing "A" — drop wordmark and most of the outer hexagon rim.
  const crop = Math.round(Math.min(w, h) * 0.48);
  const left = Math.round((w - crop) / 2);
  const top = Math.round(h * 0.10);

  return sharp(srcPath)
    .extract({ left, top, width: crop, height: crop })
    .resize(512, 512, { fit: "cover", position: "centre" })
    .png();
}

async function main() {
  fs.mkdirSync(previewDir, { recursive: true });

  const base = await markPipeline();
  const mark512 = await base.toBuffer();

  // Preview crop at readable size for inspection
  await sharp(mark512)
    .resize(128, 128)
    .png()
    .toFile(path.join(previewDir, "favicon-mark-preview-128.png"));

  const sizes = {
    icon: 32,
    icon48: 48,
    apple: 180,
  };

  const icon32 = await sharp(mark512).resize(32, 32).ensureAlpha().png().toBuffer();
  const icon48 = await sharp(mark512).resize(48, 48).ensureAlpha().png().toBuffer();
  const icon16 = await sharp(mark512).resize(16, 16).ensureAlpha().png().toBuffer();
  const apple = await sharp(mark512).resize(180, 180).ensureAlpha().png().toBuffer();

  // Next.js App Router conventions
  fs.writeFileSync(path.join(appDir, "icon.png"), icon32);
  fs.writeFileSync(path.join(appDir, "apple-icon.png"), apple);

  const ico = pngsToIco([icon16, icon32, icon48]);
  fs.writeFileSync(path.join(appDir, "favicon.ico"), ico);

  // Also drop verification previews
  fs.writeFileSync(path.join(previewDir, "favicon-16.png"), icon16);
  fs.writeFileSync(path.join(previewDir, "favicon-32.png"), icon32);
  fs.writeFileSync(path.join(previewDir, "favicon-48.png"), icon48);

  console.log("Wrote:", {
    favicon: path.join(appDir, "favicon.ico"),
    icon: path.join(appDir, "icon.png"),
    apple: path.join(appDir, "apple-icon.png"),
    bytes: {
      ico: ico.length,
      icon32: icon32.length,
      apple: apple.length,
    },
    cropNote: "tight 48% square on A mark",
    sizes,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
